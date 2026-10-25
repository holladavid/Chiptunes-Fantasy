# 💾 CHIPTUNES FANTASY (v1.5.0)
> **The Ultimate 8-Bit/16-Bit Bare-Metal Music Disk Emulator & Hardware Laboratory**

---

## 🎯 The Vision ("Von Nerds für Nerds")
**Chiptunes Fantasy** is not a simple music player. It is a high-fidelity, real-time emulated music disk and interactive hardware laboratory that runs entirely in your web browser with 100% hardware accuracy and zero external framework dependencies. 

We do not play MP3s or pre-recorded audio. We parse genuine, vintage binary tracker and music-driver formats (`.sid`, `.hipc`, `.mod`, `.xm`, `.dw`, `.ym`) and synthesize every single waveform, DMA fetch, filter, and envelope on-the-fly using highly optimized, low-latency asynchronous `AudioWorkletProcessors`.

### 🌌 Why "Fantasy"?
A real Commodore 64, Amiga 500, or Atari ST could *never* execute a cycle-exact sound routine, calculate a 3D vector star, render a PETSCII plasma, and drive a logic analyzer simultaneously—it would have melted the CPU instantly. 

But memory paints the past grander than it actually was. **This is our Fantasy.**
Every single *Demo-Scene-Element (DSE)* you see on screen is programmed with ruthless historical accuracy (strict hardware palettes, true bit-banged integer math, zero anti-aliasing). Our `Scene-DJ` then acts as the ultimate virtual orchestrator, taking these isolated, period-accurate effects and layering them into a breathtaking, synchronized demoscene experience that feels *exactly* like our childhood memories.

---

## 🔬 New in v1.5.0: Next-Gen "Living Silicon" & Authentic Chip Physics

### 🧬 Interactive "Living Silicon" Die & Motherboard Telemetry
Each of the three sound pillars now features a zero-allocation, schematic-grade SVG silicon die and external motherboard circuit model that breathes in 60FPS lockstep with the emulators:
*   **MOS 6581 (C64):** Features live 12-bit PWM duty-cycle bars, `TEST`-bit DC lock & `W&` (NMOS Wire-AND) indicators, inter-voice Hard-Sync (`SY`) and XOR Ring-Modulation (`RM`) pathways, register-driven dynamic A-D-S-R envelope graphs with live phase/level tracer dots, a morphing 2MHz ZDF VCF frequency response curve (`LP`/`BP`/`HP`/`NOTCH`), schematic-accurate `3OFF` bypass switching, `$D418` Galway/PlaySID digi detection, and active DIP-28 address/data (`A0–A4`, `D0–D7`, `/CS`, `PHI2`) pin flashing.
*   **MOS 8364 Paula (Amiga 500):** Displays zero-clipping 4-channel Agnus/Paula DMA telemetry (`LC`, `LEN`, `PER`, `Hz`, 6-bit `AUDxVOL` bars), Dual 14-Bit Multiplying DACs with **live animated 192 kHz Zero-Order Hold (ZOH) staircase oscilloscopes**, an on-die `DMACON` (`D0–D3`) & 16-bit FIFO core, jumper-arc PCB routing, and an external **Amiga 500 Board** stage (`LF347` $13\text{ V}/\mu\text{s}$ op-amp + 4.42 kHz static RC + live morphing 3.09 kHz Butterworth LED filter curves).
*   **Yamaha YM2149F (Atari ST):** Showcases live period-scaled **Square-Wave Oscilloscopes** in Tone A/B/C, a 17-bit LFSR noise activity bar, a dedicated CRT scope for all 16 5-bit Hardware Envelope (HEG) shapes with automatic **Sync-Buzzer** detection, visible HEG and Digidrum DAC injection buses, an on-die 32-step Log-DAC & Digidrum hijack detector, and an external **Atari ST Board** model with `R43–R45` ($1\text{ k}\Omega$) open-collector summing ("Atari Bus Glue" compression meter) and 15.9 kHz / 25 Hz analog filtering.

---

## 🎛️ The Three Soundchip Pillars

### 1. MOS Technology SID 6581 / CSG 8580 (Commodore 64)
Our cycle-exact 1MHz SID engine is one of the deepest analog emulations available on the web:
*   **Re-Entrant 50Hz Play-IRQ Dispatcher (`$FFD0–$FFDD`):** A 14-byte phantom KERNAL IRQ wrapper allows 50Hz music voice updates to cleanly interrupt Martin Galway's multi-frame foreground `$D418` drum synthesis loops (*Arkanoid*) whenever `CLI` (`I = 0`) is active, resuming the procedural drum loop via `RTI` with zero dropped music frames.
*   **6510 Sub-Cycle Bus Write Pipelining & RMW Dummy-Writes:** Store instructions (`STA/STX/STY`) commit to the hardware bus strictly on the final 4th clock cycle, while Read-Modify-Write instructions (`INC/DEC/ASL/LSR/ROL/ROR`) execute a genuine penultimate-cycle dummy write of the unmodified byte before committing the new value.
*   **Mirror-Safe PlaySID 3.6× Auto-Conversion & Volume Restore:** Isolates PlaySID extended DMA registers strictly to `(addr & 0x1F) >= 0x1D`, converts Amiga-Paula clock periods ($\ge 280$) to C64 PAL cycles ($907 \to 252$ cycles = $3.91\text{ kHz}$), supports `$D47D` nibble endianness and sample loops, and automatically restores the tracker's shadow `$D418` master volume upon sample completion (*The Great Giana Sisters*).
*   **Parallel 3-Voice Clocking & Dynamic Wire-AND Relaxation:** Advances all three 24-bit phase accumulators and Hard-Sync/RingMod edges in parallel on the 1MHz grid, models Chris Hülsbeck's `$50` "Engelsstimme" Wire-AND LUT (*Giana Sisters Subsong 2*), latches Pulse output to `0xFF` on `Test-Bit` (`$08`), and models NMOS parasitic gate capacitance ($C_{\text{gate}} \approx 1\text{ pF}$) relaxation above $2\text{ kHz}$.
*   **Wizball-Stable 2MHz ZDF State-Space Solver & 16Hz `C13` Coupling:** Enforces the physical MOS 6581 R3 S-curve cutoff ceiling ($30\text{ Hz} - 6.2\text{ kHz}$), symmetric JFET triode resonance quenching ($Q_{\max} \approx 3.0$), real-time semiconductor thermal drift ($15^\circ\text{C} - 75^\circ\text{C}$), 256-phase interpolated Kaiser-Sinc resampling with a measured 20kHz passband and at least 96dB stopband attenuation at 44.1/48kHz, and the authentic **16 Hz** motherboard `C13` AC-coupling highpass filter for full kick-drum weight.
*   **SID 6581/8580 "Chiptunes Fantasy Studio" Core:** Audiophile dual-channel engine featuring CSG 8580 linear R-2R DACs, 20kHz Studio Airband ZDF VCF, Constant-Power StereoSID dynamic voice staging, and a 48Hz digidrum sub-harmonic transient exciter.

### 2. MOS Technology Paula 8364 / AHI (Amiga 500 & A1200)
*   **Native Jochen Hippel COSO / HIPC Replay Engine (v1.5.0):** Bit-accurate binary parser (`parseCoso`) and zero-allocation 50Hz state machine (`CosoReplayer` & `CosoVirtualMachine`) verified against UADE reference renders ($>95\%$ energy correlation) for *Wings of Death* (Levels 1–7) and *Dragonflight* (Title, Surface, Town, Dungeon). Features two-layer Timbre/Instrument execution (`$E8` envelope sustain, `$E2` vs. `$E4/$E7` split wave-latching, `$E5/$E6` loop sliding, proportional portamento `period * t * slope >> 10`), exact pre-computed song durations (`cosoSongTicks`), and instant deterministic seeking (`seekToTick`).
*   **Hardware Agnus/Paula Latch-on-Wrap DMA (`paula-exact` & `paula-fantasy`):** Models true Amiga shared Chip-RAM and `AUDxLC`/`AUDxLEN` register latching (where pointer/length writes take effect only on the next loop wrap while `hwStartDMA()` triggers the initial pass).
*   **Paula 8364 True Analog (A500):** 192kHz oversampling, Zero-Order Hold (ZOH) DAC modeling, analog LF347 JFET op-amp slew rate stage ($13\text{ V}/\mu\text{s}$), passive 4.42kHz RC filter, active 3.09kHz Butterworth LED filter, 255-tap Sinc-FIR decimator, and physical hard-panning with 3.5% crosstalk.
*   **Paula 8364/AHI Studio Core:** Audiophile A1200/AHI 14-bit Hermite cubic interpolation (following the live DMA loop stream across sample boundaries), Constant-Power spatialized stereo panning, parametric Schroeder/Moorer stereo diffusion reverb, and $>8\text{ kHz}$ airband presence exciter.

### 3. Yamaha YM2149F (Atari ST)
*   **2MHz True Lockstep & 32-Step Log-DAC:** Cycle-exact 2.0 MHz emulation with 32-step logarithmic DAC curves (-1.5dB/step), 64-step hardware envelope state machine, and 4-bit Digidrum DAC injection.
*   **Open-Collector Passive Summing Bus:** Emulates mutual impedance loading and non-linear current compression on the Atari ST motherboard summing resistors ($R_{43}, R_{44}, R_{45}$), gluing complex 3-voice chords and digidrums naturally together ("Atari Bus Glue").
*   **32-Phase Polyphase Sinc-FIR Decimator:** Downsamples the 2MHz lockstep audio stream to 48kHz with zero fractional phase flutter ($>75\text{ dB}$ stopband rejection @ 12.5 kHz).

---

## 🎛️ Master Bus DSP Stage & Audiophile Headphone Acoustics
*   **Bauer Binaural Crossfeed (bs2b 700Hz / 4.5dB @ 250µs delay):** Eliminates headphone listening fatigue on extreme hard-panned Amiga and StereoSID tracks. Toggleable via the `[ STEREO BLEND: ON/OFF ]` HUD button.
*   **1.0ms Lookahead True-Peak Brickwall Limiter:** Seamlessly caps dynamic inter-sample peaks at $-0.35\text{ dBFS}$, guaranteeing 100% full $0\text{ dBFS}$ loudness with zero distortion and zero OS ducking on macOS CoreAudio and Windows WASAPI.

---

## 🛠️ Local Playback
Run via a local web server (due to ES6 Module & AudioWorklet CORS rules):

```bash
# Using NodeJS:
npx serve .

# Using Python:
python3 -m http.server 8080
```
