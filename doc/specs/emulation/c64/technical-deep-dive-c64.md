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
│                                            │  Rate-Sized SID Ring Buffer  │  │
│                                            └──────────────┬───────────────┘  │
└───────────────────────────────────────────────────────────┼──────────────────┘
                                                            │
┌───────────────────────────────────────────────────────────┼──────────────────┐
│                        48 kHz HOST AUDIO DOMAIN           ▼                  │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ 256-Phase Kaiser-Sinc Resampler (20kHz Passband, 96dB Design)          │  │
│  └────────────────────────────────────┬───────────────────────────────────┘  │
│                                       ▼                                      │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ C64 Mainboard Analog Stage (16kHz RC LP + 16Hz C13 HP)                 │  │
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

## 3. MOS 6581 R3 Digital Core: Oscillators, Waveforms & ADSR (`sid-chip.js`, `sid-waveforms-6581.js`, `sid-envelope.js`)

### 3.1. Parallel 24-Bit Phase Accumulators & Symmetric Hard-Sync / RingMod
On a real MOS 6581, all three 24-bit phase accumulators are clocked simultaneously on the $\Phi_1/\Phi_2$ clock phases. Our engine splits the 1MHz oscillator step into two parallel passes:
1. **Pass 1 (`clockOscillatorsOneCycle`):** All 3 voices advance their 24-bit `phase`, latch their MSB rising edge (`0x800000`), and clock their 23-bit Noise LFSR on bit-19 (`0x080000`) rising edges.
2. **Pass 2 (Hard-Sync & RingMod):** Hard-Sync (`ctrl & 2`) resets `ch.phase = 0` if the modulating neighbor voice (`v-1`) latched an MSB rising edge in Pass 1. Ring-Modulation (`ctrl & 4`) XORs the current voice's MSB with the synchronized neighbor voice's MSB (`ownMSB ^ prevMSB`).

### 3.2. Full 12-Bit Waveform Selector & DAC Latch
The Exact path keeps the full 12-bit DAC input for sawtooth, triangle, pulse and noise; only the OSC3 read mirror is reduced to eight bits. Noise uses the documented LFSR taps at full scale. The direct 12-bit pulse comparator has no artificial PWM offset, and TEST forces all 12 pulse bits high.
* **No-waveform latch:** With `ctrl & 0xF0 === 0`, the last 12-bit waveform-DAC input is retained instead of drifting toward a synthetic DC constant.
* **Combined-selector baseline:** Multiple selected generators use the documented wired-AND topology at 12-bit resolution. The former invented bleed coefficients, frequency relaxation and `busCharge` approximation are removed from Exact. Analogue 6581 pull-down interactions still require real-chip capture calibration; logical AND alone is not claimed to reproduce them.
* **Model-specific conversion:** `SIDChip.model` is explicitly `MOS6581_R3`, with separate waveform and envelope DAC bindings. The artistic Fantasy core remains separate and is not an Exact 8580 profile.

### 3.3. 15-Bit ADSR Envelope State Machine
* **Persistent rate state:** The rate counter wraps at `$7FFF`, cannot be reset by GATE or TEST, and fires only on exact period equality. Shortening a rate below the running counter therefore waits for wraparound instead of forcing an immediate tick.
* **Two-clock GATE pipeline:** Gate changes enter Attack or Release after two SID clocks. Attack resets the exponential divider and zero hold, but not the rate counter.
* **Piecewise exponential Decay/Release:** Divider periods `1, 2, 4, 8, 16, 30` are loaded after decrements through envelope thresholds `93, 54, 26, 14, 6`. Attack increments linearly and switches to Decay at 255; envelope zero holds until the next Attack.

See `sid-digital-model.md` for the exact digital contract, source references and remaining hardware-validation limits.

---

## 4. MOS 6581 R3 Analog Path: Calibrated Filter, Mixer Routing & Parameterized DAC/DC (`sid-chip.js`, `sid-filter-6581.js`)

### 4.1. Parameterized R-2R DAC Fingerprints (`WAVE_DAC_6581_R3`, `DAC_LUT_6581_R3`)
The 8-bit envelope DAC retains the project's parameterized R3 bit weights (`[1.00, 1.98, 3.92, 8.08, 15.82, 31.90, 63.20, 127.10]`), mid-scale kink and cubic saturation. The waveform path expands that existing fingerprint to 4096 entries, adding four lower DAC-input bits by monotone segment interpolation. This removes premature 8-bit waveform quantization; it is not a new independent analogue DAC calibration. Phase 3 measures cutoff, damping and modal feedthrough, while DAC, DC and amplitude-dependent distortion acceptance remain open.

### 4.2. Black-Box-Calibrated 2MHz Zero-Delay Feedback Filter
The existing two-integrator multimode filter is solved at **1.970496 MHz** (two substeps per 985248Hz PAL SID clock) using trapezoidal **Zero-Delay Feedback (ZDF)** integration:
$$\text{hp} = \frac{x - (g + k) \cdot s_1 - s_2}{1 + g(g + k)}, \quad \text{bp} = g \cdot \text{hp} + s_1, \quad \text{lp} = g \cdot \text{bp} + s_2$$
* **Measured register maps:** `sid-filter-6581.js` expands nine measured cutoff anchors into 2048 entries and cutoff-dependent base damping/resonance slopes into a 2048×16 matrix. The fitted cutoff anchors span 240Hz to approximately 14.124kHz; they replace the former unsupported 30Hz–6.2kHz polynomial.
* **Direct parameter binding:** Register writes set $g=\tan(\pi f_c/1970496)$ and damping $k$ directly from these maps. The old second feedback calculation, uncalibrated bandpass `tanh` path and temperature detuning of the measured filter are removed.
* **Evidence boundary:** The maps were independently fitted to EXT-IN observations from libresidfp revision `c1791383ca843a855e5d4366da6a7277e34e801d` through its public API. No reference implementation code or internal tables were imported. This is agreement with an external reference model at the documented stimulus level, not a real-chip capture or universal MOS 6581 calibration.

### 4.3. Additive Filter Modes, Feedthrough & Linear Master Volume
* LP, BP and HP outputs remain additive, including LP+HP notch behavior. HP uses the documented $1/\sqrt{2}$ (−3dB) tap in every mode combination.
* Separate BP and HP feedthrough terms (`0.24` and `0.08`) fit measured stopband floors. The previous shared heuristic leakage and inter-voice bleed coefficients are removed.
* The sixteen `$D418` master-volume steps are linear from 0 through 1. The production analog entry point `processFilterMixer()` is directly exercised by the 639-point external-reference comparison: 1.876dB median absolute error, 6.737dB p95 and 3.396dB RMS. These are measured model-comparison results, not hardware acceptance figures.

### 4.4. `3OFF` Routing & Parameterized Output VCA/DC
* **`3OFF` direct disconnect:** Setting `$D418` bit 7 disconnects Voice 3 only from the direct unfiltered summer. Voice 3 routed into the filter through `$D417` bit 2 remains audible. No invented Voice-3 DC leakage path is added.
* **Output VCA and DC remain parameterized:** The existing gain, soft saturation and nominal 0.9 master DC-bias model are retained. They are not relabeled as real-chip measurements; multi-level distortion, DC drift and `$D418` behavior still require hardware/reference identification.

### 4.5. Temperature Control Boundary
The Hardware Lab temperature control still adjusts the project's parameterized DAC gain/offset and output DC terms around 55°C. It no longer modifies cutoff, integrator constant or resonance damping, because doing so would detune the archived Phase-3 calibration. These remaining thermal terms are exploratory model parameters, not measured semiconductor laws.

See `sid-filter-model.md` for provenance, measurement conditions, complete cutoff anchors and reproduction commands.

---

## 5. Polyphase Decimation & C64 Mainboard Output Stage

### 5.1. 256-Phase Kaiser-Sinc Resampler (`sid-resampler.js`)
Downsampling from $985,248\text{ Hz}$ to $48,000\text{ Hz}$ involves a non-integer ratio ($20.526\text{ cycles/sample}$). `SidResampler` preserves the existing cycle scheduler while replacing the former 32-phase/255-tap kernel in both C64 cores.
* A causal, odd-length **Kaiser-windowed sinc** is designed for the actual host rate. The bank contains 256 fractional phases plus an explicit interpolation endpoint; adjacent phases are interpolated per output sample.
* At 48 kHz the filter uses 1511 taps, reaches $-0.00014\text{ dB}$ at 20 kHz in the worst un-interpolated branch, and measures at least $96.3\text{ dB}$ attenuation at the 24 kHz stopband start. At 44.1 kHz it uses 2741 taps and measures at least $96.4\text{ dB}$ at 22.05 kHz.
* The linear-phase group delay is explicit: approximately $0.766\text{ ms}$ at 48/96 kHz and $1.391\text{ ms}$ at 44.1 kHz. Impulse tests verify the runtime alignment.
* Ring storage and coefficient tables are allocated only during setup. Mono and stereo convolution allocate nothing in the audio hot path; stereo shares each interpolated coefficient across both channels.

### 5.2. C64 Mainboard Analog Stage & 16Hz `C13` Coupling (`dsp-utils.js`)
The resampled signal passes through `C64AnalogFilter`, modeling the passive components on the Commodore 64 motherboard:
1. **No Resampler-Droop EQ in the Exact path:** The old $+2.5\text{ dB}$ compensation belonged to the former 255-tap kernel and is disabled with `droopCompensation = 0` to avoid boosting the now-flat resampler.
2. **16 kHz 1-Pole RC Lowpass:** Models the external audio output EMI filter cap.
3. **16 Hz 1-Pole AC-Coupling Highpass (`C13` 10 µF Capacitor):** Preserves the 35–90 Hz sub-bass fundamental on `$D418` kick drums without a higher-cutoff generic DC blocker.

Reproduce coefficient and timing measurements with `node tools/sid-resampler-measure.mjs` and streaming tests with `node --expose-gc --test test/sid-resampler.test.mjs`.

---

## 6. The Audiophile Twin: `sid-fantasy.js` (CSG 8580 Studio Core)
For listeners who prefer the crystal-clear HMOS-II sound of the later C64C (CSG 8580) combined with modern studio staging, the **SID 6581/8580 Chiptunes Fantasy Studio** core provides:
* **Linear 8-Bit & 4-Bit HMOS-II R-2R DACs (`DAC_LUT_8580` / `VOLUME_DAC_8580`)** with zero distortion kink.
* **20 kHz Studio Airband ZDF Stereo VCF** with extended high-frequency sheen.
* **Constant-Power StereoSID Spatializer:** Voice 1 panned $-25\%$ Left (Lead), Voice 2 panned $+25\%$ Right (Chords/Arps), Voice 3 centered (Bass/Drums) — feeding directly into the Master Bus **Bauer Binaural Crossfeed (bs2b)** for zero headphone fatigue.
* **48 Hz Sub-Harmonic Digidrum Transient Exciter:** Automatically detects steep `$D418` volume edges and injects a phase-locked 48 Hz sub-bass sine transient underneath 4-bit digidrums.
