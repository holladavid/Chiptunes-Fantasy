# 💾 TECHNICAL DEEP-DIVE: THE C64 MOS 6581 / CSG 8580 SID EMULATION ENGINE (v1.5.0)
> **"Von Nerds für Nerds" — Cycle-Exact 1MHz Lockstep, NMOS Silicon Physics & Zero-Allocation DSP**

This document provides a bare-metal engineering breakdown of the Commodore 64 sound emulation architecture in **Chiptunes Fantasy (v1.5.0)**. Rather than relying on frame-based approximations or pre-baked wavetables, our engine executes genuine 6502/6510 machine code in **1:1 cycle-exact lockstep** at the PAL master clock frequency (**985,248 Hz**) inside an asynchronous, zero-allocation Web Audio `AudioWorkletProcessor`.

---

## 1. High-Level Signal & Execution Pipeline

Every single PAL clock cycle ($\approx 1.015\ \mu\text{s}$), the system advances the CPU, dual CIA 6526 timers, VIC-II raster line counters, and the MOS 6581 sound chip in lockstep before folding the 1MHz analog stream down to the host sample rate (48 kHz):

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                        1 MHz PAL LOCKSTEP DOMAIN (985,248 Hz)                │
│                                                                              │
│  ┌─────────────────────┐   Sub-Cycle Bus   ┌──────────────────────────────┐  │
│  │  MOS 6510 CPU Core  │ ───(4th Cycle /──►│   MOS 6581 / 8580 SID Core   │  │
│  │  + Phantom KERNAL   │    RMW Dummy)     │  - Parallel 24-Bit Phase Acc │  │
│  │  + Re-Entrant $FFD0 │                   │  - 15-Bit ADSR + Exp LUT     │  │
│  └──────────┬──────────┘                   │  - NMOS Wire-AND Matrix      │  │
│             ▲                              │  - 2MHz ZDF State-Space VCF  │  │
│             │ IRQ / NMI / RDY              │  - Multiplying Master VCA    │  │
│  ┌──────────┴──────────┐                   └──────────────┬───────────────┘  │
│  │  VIC-II + 2x CIA    │                                  │ 985.248 kHz      │
│  │  + PlaySID DMA Trap │                                  ▼                  │
│  └─────────────────────┘                   ┌──────────────────────────────┐  │
│                                            │  512-Sample Ring Buffer      │  │
│                                            └──────────────┬───────────────┘  │
└───────────────────────────────────────────────────────────┼──────────────────┘
                                                            │
┌───────────────────────────────────────────────────────────┼──────────────────┐
│                        48 kHz HOST AUDIO DOMAIN           ▼                  │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ 32-Phase Fractional Polyphase Sinc-FIR Decimator (255 Taps, >75dB)     │  │
│  └────────────────────────────────────┬───────────────────────────────────┘  │
│                                       ▼                                      │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ C64 Mainboard Analog Stage (Sinc-Droop EQ + 16kHz RC LP + 16Hz C13 HP) │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. MOS 6510 CPU, Bus Timing & Interrupt Architecture (`cpu6502.js`)

Sample-heavy C64 soundtracks (Martin Galway, Chris Hülsbeck, Jeroen Tel, Tim Follin) abuse the 6510 CPU, CIA timers, and VIC-II raster interrupts at the sub-instruction level. A simple instruction-level emulator fails on these tracks.

### 2.1. Sub-Cycle Write Pipelining & 6510 RMW Dummy-Writes
On real 6502/6510 silicon, an instruction like `STA $D418` takes 4 clock cycles, but the actual hardware bus write occurs **exclusively on the final 4th cycle**.
* **Deferred Final-Cycle Commit:** Store instructions (`STA`, `STX`, `STY`) stage their target address and value during instruction decoding and commit the physical write to the SID/CIA/VIC registers strictly when `cpuCyclesRemaining === 0`. This eliminates sub-instruction sample jitter on tight Galway digi loops.
* **Penultimate-Cycle RMW Dummy-Writes:** On an NMOS 6510, Read-Modify-Write instructions (`ASL`, `LSR`, `ROL`, `ROR`, `INC`, `DEC`, plus illegal opcodes `SLO`, `RLA`, `SRE`, `RRA`, `DCP`, `ISB`) perform **two consecutive bus writes**:
  1. At `cpuCyclesRemaining === 1` (penultimate cycle), the CPU writes the **unmodified original byte** back to the hardware bus (`commitDummyWrite()`).
  2. At `cpuCyclesRemaining === 0` (final cycle), the CPU writes the **modified byte** (`commitPendingWrite()`).
  * *Why it matters:* Dozens of C64 routines acknowledge VIC-II raster interrupts via `ASL $D019` or `INC $D019`, relying on the dummy write to clear the IRQ flag, or trigger 1-cycle SID register glitches via RMW opcodes.

### 2.2. Re-Entrant 50Hz Play-IRQ Dispatcher (`$FFD0–$FFDD`) — The *Arkanoid* Fix
In Martin Galway's *Arkanoid*, the drum synthesizer does not use NMI interrupts; instead, inside the `play` routine, it clears the Interrupt Disable flag (`CLI`) and enters a **procedural foreground synthesis loop** (`SBC #$01 / BNE ... ADC #$65 / AND #$0F / STA $D418`) that runs across **multiple 50Hz frames** (up to 60,000 cycles).
* If the emulator waits for `PC` to return to the idle loop (`$FFE0`) before firing the next 50Hz `play` call, all music frames during a drum hit are dropped and the melody freezes.
* **Our Solution:** We inject a hardware-accurate **14-byte Re-Entrant Play-IRQ Wrapper** at `$FFD0–$FFDD` alongside a `CLI` idle stub at `$FFE0`:
  ```assembly
  ; === $FFD0: Re-Entrant Play-IRQ Wrapper ===
  $FFD0: PHA            ; $48 - Save Accumulator
  $FFD1: TXA            ; $8A
  $FFD2: PHA            ; $48 - Save X Register
  $FFD3: TYA            ; $98
  $FFD4: PHA            ; $48 - Save Y Register
  $FFD5: JSR playAddr   ; $20 <lo> <hi> - Execute 50Hz Voice Update
  $FFD8: PLA            ; $68
  $FFD9: TAY            ; $A8 - Restore Y Register
  $FFDA: PLA            ; $68
  $FFDB: TAX            ; $AA - Restore X Register
  $FFDC: PLA            ; $68 - Restore Accumulator
  $FFDD: RTI            ; $40 - Restore Status Flags (P) & resume Digi Loop PC!

  ; === $FFE0: Idle Loop Stub ===
  $FFE0: CLI            ; $58 - Clear Interrupt Disable after SEI Play frame
  $FFE1: JMP $FFE0      ; $4C $E0 $FF
  ```
* When a 50Hz frame tick (`hostPlayPending`) arrives while the CPU is spinning inside Galway's foreground drum loop with interrupts enabled (`I == 0`), the CPU pushes `PC` and `P`, sets `I = 1` (`SEI`), and vectors to `$FFD0`. The 3 SID voices are updated for the new 50Hz frame, and `RTI` returns the CPU **to the exact cycle and register state** of the ongoing drum synthesis loop.

### 2.3. VIC-II Badline DMA Stalling (`RDY` Line)
Whenever display output is enabled (`$D011` Bit 4) on raster lines `$30` through `$F7` and `(rasterCounter & 7) === ($D011 & 7)`, the VIC-II asserts a **Badline**, pulling the 6510 `RDY` line low for 40 cycles (`rasterCycles 12..51`). During this window, CPU execution freezes while timers and SID oscillators continue to run, reproducing the authentic pitch-grit on CPU-timed digi loops.

### 2.4. Dual CIA 6526 Cascading & Physical NMI Edge Latching
* **1-Cycle Timer Cascade Latency:** Both CIA-1 (`$DC00`) and CIA-2 (`$DD00`) model Timer A and Timer B in 1MHz lockstep, including 1-cycle delayed underflow pulses for 32-bit cascaded timer modes (`(CtrlB & 0x60) === 0x40`) and BCD Time-Of-Day (`TOD`) read latches.
* **Falling-Edge NMI Latch:** CIA-2 NMI generation tracks the physical wire state (`nmiLineState`). An NMI is triggered strictly on a **high-to-low transition** (`cia2NmiLine && !this.nmiLineState`), preventing infinite NMI re-trigger loops when routines leave `$DD0D` unacknowledged (*Turbo Outrun*, *Robocop 3*).

### 2.5. PlaySID Extended Register Trap (`$D41D–$D47F`) — The *Giana Sisters* Engine
Vintage Amiga PlaySID rips (such as Chris Hülsbeck's *The Great Giana Sisters*) offload 4-bit digidrums to extended virtual DMA registers:
* **Mirror-Safe Address Decoding:** Intercepts strictly addresses where `(addr & 0x1F) >= 0x1D`, allowing mirrored SID writes in `$D420–$D438` to pass unhindered to the SID core.
* **3.6× Amiga-Paula Clock Auto-Conversion:** Detects Amiga Paula 3.55 MHz periods ($\ge 280$) written to `$D45D/$D45E` and scales them to C64 PAL cycles via $\text{Period}_{\text{C64}} = \text{round}\left(\text{Period}_{\text{Paula}} \times \frac{985248}{3546895}\right)$ (e.g. $907 \to 252\text{ cycles} \approx 3.91\text{ kHz}$).
* **Nibble Endianness, Loops & Volume Restore:** Supports packed 4-bit streaming (`$D45F == 0`), transposed byte-stepping (`$D45F > 0`), configurable nibble order (`$D47D`: Big-Endian vs. Little-Endian), sample looping (`$D43F`, `$D47E/$D47F`), and automatically restores the tracker's last written `$D418` master volume and filter flags (`cpuLastD418`) the instant a one-shot sample finishes.

---

## 3. MOS 6581 Digital Core: Oscillators, Waveforms & ADSR (`sid-chip.js`, `sid-waveforms.js`, `sid-luts.js`)

### 3.1. Parallel 24-Bit Phase Accumulators & Symmetric Hard-Sync / RingMod
On a real MOS 6581, all three 24-bit phase accumulators are clocked simultaneously on the $\Phi_1/\Phi_2$ clock phases. Our engine splits the 1MHz oscillator step into two parallel passes:
1. **Pass 1 (`clockOscillatorsOneCycle`):** All 3 voices advance their 24-bit `phase`, latch their MSB rising edge (`0x800000`), and clock their 23-bit Noise LFSR on bit-19 (`0x080000`) rising edges.
2. **Pass 2 (Hard-Sync & RingMod):** Hard-Sync (`ctrl & 2`) resets `ch.phase = 0` if the modulating neighbor voice (`v-1`) latched an MSB rising edge in Pass 1. Ring-Modulation (`ctrl & 4`) XORs the current voice's MSB with the synchronized neighbor voice's MSB (`ownMSB ^ prevMSB`).

### 3.2. True NMOS Open-Drain Wire-AND Combined Waveforms (`$30, $50, $60, $70`)
When multiple waveforms are selected simultaneously on the MOS 6581, the 12-bit waveform selector acts as an **NMOS open-drain Wire-AND bus** driving the R-2R ladder:
* **Active Pulse-Low Bus Grounding (`$50, $60, $70`):** During the low half-cycle of the Pulse waveform (`pulse === 0x00`), all 12 bits of the pulse generator are `0`. The NMOS selector FETs pull the entire 12-bit bus to ground, gating the Triangle (`$50`) or Sawtooth (`$60`) wave. During the high half-cycle (`pulse === 0xFF`), the Triangle/Sawtooth wave drives the R-2R ladder with **neighbor-bit pulldown** (`nmosNeighborPulldown`), where `0` bits pull down adjacent `1` bits across the R-2R bridge resistors. This restores the unmistakable, glassy PWM-gated triangle lead in *The Great Giana Sisters* (`$50`) and the nasal reed bass in Jeroen Tel tracks (`$60`).
* **Dynamic High-Register Pulldown Relaxation ($>2\text{ kHz}$):** At high oscillator frequencies (`freq > 4000`), the parasitic gate capacitance ($C_{\text{gate}} \approx 1\text{ pF}$) cannot discharge completely between clock cycles. Our waveform generator interpolates the Wire-AND pulldown depth as a function of frequency, giving high-octave leads a warm, liquid analog character.
* **Capacitive Bus Charge & Floating DAC Decay:** A 1MHz capacitive state variable (`busCharge`) models the finite charging time of the 8-bit waveform bus (`alpha = 0.35` on combined waveforms) and slowly bleeds toward the floating NMOS DC bias (`0x18` at `alpha = 0.00015`) when all waveform bits are cleared (`ctrl & 0xF0 === 0`).

### 3.3. Exact 12-Bit PWM Comparator & Test-Bit (`$08`) Force-High Latch
* **True DC at `PW = $000`:** `PWM_LUT[0] = 0` ensures that setting Pulse Width to `$000` produces flat DC rather than a false 1.8% pulse buzz.
* **Test-Bit Pulse Latch:** In accordance with MOS 6581 silicon behavior, setting the Test Bit (`ctrl & 8`) while the Pulse waveform (`ctrl & 64`) is selected forces the pulse comparator output to **`0xFF` (all ones)**, supporting Martin Galway's and Rob Hubbard's Test-Bit DC-offset and digi-booster tricks.

### 3.4. 15-Bit ADSR Envelope State Machine
* **Exact Rate & Exponential Counters:** Uses the hardware-verified `RATE_COUNTER_PERIOD` table (`9` to `31256` cycles) and the 6-step exponential counter divider (`1, 2, 4, 8, 16, 30` at envelope thresholds `255, 93, 54, 26, 14, 6`) with a 1-cycle gate-transition pipeline delay (`envDelay`).
* **Wizball Highscore Arpeggio Protection:** Enforces `rate_counter >= ratePeriod` and resets the rate/exponential dividers on `Gate-On` transitions, preventing 32ms ADSR counter wrap-around deadlocks during rapid 50Hz note re-triggers (*Wizball Subsong 7*).

---

## 4. MOS 6581 Analog Core: R-2R DACs, 2MHz ZDF VCF & Thermal Drift (`sid-chip.js`, `dsp-utils.js`)

### 4.1. Non-Linear 8-Bit R-2R DAC Fingerprints (`DAC_LUT_6581_R3`)
The MOS 6581's 8-bit voice and envelope DACs suffer from imperfect NMOS transistor length-to-width ratios (`2R/R > 2.0`), creating voltage kinks at bit transitions (especially bit 7). `DAC_LUT_6581_R3` models the measured bit weights (`[1.00, 1.98, 3.92, 8.08, 15.82, 31.90, 63.20, 127.10]`), mid-scale kink, and cubic MOSFET saturation.

### 4.2. 2MHz Oversampled Zero-Delay Feedback (ZDF) State-Space OTA Filter
The 6581's 12dB/oct multimode State-Variable Filter (LP / BP / HP / Notch) is solved at **1.97 MHz** (2× oversampled inside the 1MHz cycle loop) using a trapezoidal **Zero-Delay Feedback (ZDF)** integrator:
$$\text{hp} = \frac{x - (g + k) \cdot s_1 - s_2}{1 + g(g + k)}, \quad \text{bp} = \frac{\tanh\left((g \cdot \text{hp} + s_1) \cdot d_{\text{JFET}}\right)}{d_{\text{JFET}}}, \quad \text{lp} = g \cdot \text{bp} + s_2$$
* **MOS 6581 R3 S-Curve Cutoff (`30 Hz – 6,200 Hz`):** Models the physical JFET voltage-controlled resistance S-curve, preventing unnatural digital screeching on full-scale filter sweeps.
* **Symmetric JFET Triode Resonance Quenching:** Non-linear $\tanh$ saturation inside the bandpass feedback loop caps self-oscillation at $Q_{\max} \approx 3.0$, guaranteeing zero DC latchup on extreme $R=15$ sweeps (*Wizball Title*).

### 4.3. Schematic-Accurate `3OFF` (`$D418` Bit 7) & Calibrated `$D418` Digidrum Bias
* **`3OFF` Unfiltered Disconnect:** Just like on the physical MOS 6581 schematic, setting Bit 7 of `$D418` (`3OFF`) disconnects Voice 3 **only** from the direct unfiltered summer (`unfilteredSum`). If Voice 3 is routed into the VCF (`$D417` Bit 2), it remains audible through the filter! When muted via `3OFF`, Voice 3's envelope-scaled analog DC offset (`0.14 * envDac3`) still leaks into the summer.
* **Calibrated Master Mixer DC Bias (`1.12`):** The ratio between the saturated AC voice sum (`acSaturated * 1.45`) and the static mixer DC offset (`thermalMasterDcBias = 1.12`) is calibrated to real 6581 R3 voltage measurements, giving 4-bit `$D418` volume-wiggling digis their full chest-hitting analog weight alongside active synth voices.

### 4.4. Real-Time Semiconductor Thermal Drift ($15^\circ\text{C} - 75^\circ\text{C}$)
Controlled live via the `[ TEMP ]` fader in the Hardware Lab UI, seven coupled equations modulate the analog silicon parameters around the $55^\circ\text{C}$ nominal operating point:
1. **VCF Cutoff Drift:** $\text{coeff} = e^{-(T - 55) \cdot 0.003}$ (cooler = brighter; hotter = darker/creamy).
2. **Integrator Constant ($g$):** $+0.05\%$ per $^\circ\text{C}$.
3. **Resonance Damping ($Q$):** $+0.15\%$ damping per $^\circ\text{C}$.
4. **JFET Triode Saturation Drive:** Earlier, warmer harmonic clipping as die temperature rises.
5. **VCF Unfiltered Bleed (`thermalLeakage`):** Increases with temperature.
6. **Voice & Master VCA DC-Leakage:** Scales exponentially with die heat.
7. **R-2R DAC Gain & Offset Drift:** Subtle compression of DAC swing at high temperatures.

---

## 5. Polyphase Decimation & C64 Mainboard Output Stage

### 5.1. 32-Phase Fractional Polyphase Sinc-FIR Decimator (`sid-exact.js`)
Downsampling from $985,248\text{ Hz}$ to $48,000\text{ Hz}$ involves a non-integer ratio ($20.526\text{ cycles/sample}$). Integer-cycle convolution introduces $\pm 0.5\ \mu\text{s}$ sub-cycle sampling jitter, which aliases high-frequency Hard-Sync sweeps (*Commando*).
* Our decimator maintains a **512-sample ring buffer** at 1MHz and convolves it using a **255-tap Blackman-windowed Sinc-FIR filterbank** pre-computed across **32 fractional sub-cycle phases** ($>75\text{ dB}$ stopband rejection at $20\text{ kHz}$, $0.0\ \mu\text{s}$ phase jitter).

### 5.2. C64 Mainboard Analog Stage & 16Hz `C13` Coupling (`dsp-utils.js`)
The decimated 48 kHz signal passes through `C64AnalogFilter`, modeling the passive components on the Commodore 64 motherboard:
1. **Sinc-Droop Pre-Emphasis Equalizer:** Restores $+2.5\text{ dB}$ of airband presence at $16\text{ kHz}$.
2. **16 kHz 1-Pole RC Lowpass:** Models the external audio output EMI filter cap.
3. **16 Hz 1-Pole AC-Coupling Highpass (`C13` 10 µF Capacitor):** Replaces generic 45 Hz DC blockers with the historically accurate **16 Hz** cutoff of the C64's 10 µF coupling capacitor, preserving 100% of the 35–90 Hz sub-bass fundamental on `$D418` kick drums without artificial DC bounce.

---

## 6. The Audiophile Twin: `sid-fantasy.js` (CSG 8580 Studio Core)
For listeners who prefer the crystal-clear HMOS-II sound of the later C64C (CSG 8580) combined with modern studio staging, the **SID 6581/8580 Chiptunes Fantasy Studio** core provides:
* **Linear 8-Bit & 4-Bit HMOS-II R-2R DACs (`DAC_LUT_8580` / `VOLUME_DAC_8580`)** with zero distortion kink.
* **20 kHz Studio Airband ZDF Stereo VCF** with extended high-frequency sheen.
* **Constant-Power StereoSID Spatializer:** Voice 1 panned $-25\%$ Left (Lead), Voice 2 panned $+25\%$ Right (Chords/Arps), Voice 3 centered (Bass/Drums) — feeding directly into the Master Bus **Bauer Binaural Crossfeed (bs2b)** for zero headphone fatigue.
* **48 Hz Sub-Harmonic Digidrum Transient Exciter:** Automatically detects steep `$D418` volume edges and injects a phase-locked 48 Hz sub-bass sine transient underneath 4-bit digidrums.