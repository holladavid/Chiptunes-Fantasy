# 💾 CHIPTUNES FANTASY (v1.5.2)
> **The Ultimate 8-Bit/16-Bit Bare-Metal Music Disk Emulator & Hardware Laboratory**

---

## 🎯 The Vision ("Von Nerds für Nerds")
**Chiptunes Fantasy** is not a simple music player. It is a high-fidelity, real-time emulated music disk and interactive hardware laboratory that runs entirely in your web browser with zero external framework dependencies. Hardware-oriented emulation is validated subsystem by subsystem; measured reference agreement is not a claim of universal chip accuracy.

We do not play MP3s or pre-recorded audio. We parse genuine, vintage binary tracker and music-driver formats (`.sid`, `.hipc`, `.mod`, `.xm`, `.dw`, `.ym`) and synthesize every single waveform, DMA fetch, filter, and envelope on-the-fly using highly optimized, low-latency asynchronous `AudioWorkletProcessors`.

### 🌌 Why "Fantasy"?
A real Commodore 64, Amiga 500, or Atari ST could *never* execute a cycle-exact sound routine, calculate a 3D vector star, render a PETSCII plasma, and drive a logic analyzer simultaneously—it would have melted the CPU instantly. 

But memory paints the past grander than it actually was. **This is our Fantasy.**
Every single *Demo-Scene-Element (DSE)* you see on screen is programmed with ruthless historical accuracy (strict hardware palettes, true bit-banged integer math, zero anti-aliasing). Our `Scene-DJ` then acts as the ultimate virtual orchestrator, taking these isolated, period-accurate effects and layering them into a breathtaking, synchronized demoscene experience that feels *exactly* like our childhood memories.

---

## 🚀 v1.5.2 Release Highlights

### Living Silicon — SID Activity Instrument
The C64 hardware laboratory now includes a demoscene-style activity instrument driven by real emulator telemetry rather than decorative animation. Three 16-segment meters display the normalized envelope level of each SID voice, with GATE indicators, short peak holds, and the actual internal ADSR phase. A separate register-bus instrument reports writes per second on a bounded logarithmic scale, retains a 48-column history, and marks `$D418` activity independently.

Envelope activity is deliberately not presented as loudness, processor utilization, or an undefined “SID load” percentage. Repeated writes of the same value and multiple writes between display frames are counted. Exact and Fantasy expose the same telemetry semantics, while their panel titles distinguish **MOS 6581 R3 Exact** from the artistic **SID Fantasy Studio** path. The responsive layout preserves the instrument on desktop, laptop, and mobile screens. Meter state and history storage are preallocated; numeric hot-path updates use primitive values and dirty-checked DOM writes.

### Original-Recording Exact Calibration
The MOS 6581 R3 Exact envelope restarts its 15-bit rate phase on a resolved rising GATE, resets the exponential divider, and clears zero hold. `TEST` does not restart this phase, and Release preserves the running counters. This bounded correction was calibrated against a supplied original-C64 recording of *Wizball*'s high-score melody, Subsong 7. In the examined 5.5–10.5-second passage, all 21 short voice-2 GATE attacks now reach envelope level 255; the former implementation left 20 of them at level 0 or 1. This validates the observed short-GATE sequence against that recording, not every ADSR property or every 6581 revision.

The earlier zero-level hold remains in place, preventing short GATE pulses from underflowing the envelope and producing non-finite output. No synthesis behavior was imported from reSIDfp or VICE.

### Giana `$50` Combined-Waveform Refinement
*The Great Giana Sisters* high-score melody, Subsong 2, exposed a missing Exact-path “angel voice” around the 30-second mark. The hardware-oriented 6581 path now uses an independently measured, phase-indexed triangle-plus-pulse (`$50`) transfer model with 257 precomputed 12-bit anchors and primitive interpolation. Other combined selectors retain their documented wired-AND baseline. The artistic Fantasy DSP remains separate and unchanged by this calibration.

### Independent Display Time
The displayed SID timeline now advances from an independent 50 Hz display accumulator rather than the music program's play-call rate. Tracks using CIA or other non-50 Hz dispatch schemes therefore keep a meaningful elapsed-time display without altering CPU, CIA, audio, or subsong timing.

### 🎵 SID Refinement Program — Phases 0–5
The C64 engine has been refined through six bounded, individually documented phases:

| Phase | Delivered improvement |
|---|---|
| **0 — Measurement foundation** | Added a deterministic raw-chip harness with cycle-stamped events, PCM/CSV traces and archived regression baselines. Measurements bypass hidden output processing and distinguish self-generated regression pins from independent evidence. |
| **1 — Resampling and output** | Added measured 256-phase interpolated Kaiser-Sinc resampling with a 20 kHz passband and at least 96 dB stopband attenuation at 44.1/48 kHz, while retaining the parameterized motherboard output stage. |
| **2 — MOS 6581 R3 digital model** | Preserves full 12-bit waveform DAC inputs, explicit noise taps and the no-waveform DAC latch. The stateful ADSR model adds a two-clock GATE pipeline, wrapping 15-bit rate counter, exact period matching and documented exponential divider thresholds. |
| **3 — Filter and mixer calibration** | Fits cutoff and damping maps through the public libresidfp API and corrects additive LP/BP/HP routing, feedthrough, linear master volume and direct-path-only `3OFF`. The archived 639-point comparison reports 1.876 dB median and 6.737 dB p95 absolute response error. |
| **4 — CPU and CIA timing** | Corrects final-cycle stores, NMOS RMW dummy writes, interrupt polling, selected final-cycle ICR reads, RDY behavior, CIA timer pipelines and delayed IRQ/NMI outputs. Coverage is bounded to the documented scheduler paths, not a complete physical C64 model. |
| **5 — Fantasy studio acceptance** | Adds deterministic production-worklet comparisons and sample-rate-independent 16 Hz stereo output coupling to `sid-fantasy`. The Exact renders remained byte-identical; no Exact analog settings were inferred from the Fantasy tuning. |

The hardware-oriented path explicitly targets the **MOS 6581 R3**. A separate hardware-oriented CSG 8580 model remains future work. `sid-fantasy` is an artistic stereo studio interpretation, not an Exact hardware mode. External libsidplayfp/reSIDfp observations are black-box references only; no implementation code or internal tables were imported. Reference-model agreement and self-generated baselines are not real-chip captures or proof of universal hardware accuracy.

Technical evidence: [measurement harness](doc/specs/emulation/c64/sid-measurement-harness.md), [digital model](doc/specs/emulation/c64/sid-digital-model.md), [filter/mixer](doc/specs/emulation/c64/sid-filter-model.md), [CPU/CIA timing](doc/specs/emulation/c64/sid-cpu-cia-timing.md), and [Fantasy studio acceptance](doc/specs/emulation/c64/sid-fantasy-studio.md).

### 🩹 SID Exact Hotfix — Short GATE Pulses
A v1.5.1 playback failure affecting *Crazy Comets* and *Wizball* Subsong 7 was traced to a zero-level ADSR underflow. A short GATE pulse could enter Release before Attack produced its first increment; Release then decremented the envelope below zero, causing an invalid DAC lookup and non-finite audio output.

The Exact envelope now enforces the documented zero-level hold at the Decay/Release decrement. The correction is allocation-free and leaves CPU/CIA scheduling, filter/mixer calibration, resampling, parsing, and Fantasy DSP unchanged. Twenty-second production-worklet renders of both reproductions now contain zero non-finite frames and nonzero audio. Chromium playback additionally verified the original uploads, including UI-driven selection of *Wizball* Subsong 7.

### 📱 Media Session System Controls
The browser's Media Session integration exposes the decoded track title, composer, sound system and dedicated cover artwork to supported OS media controls and lock screens. Play, pause, stop, next and previous use the same transport functions as the on-screen and fullscreen controls. Next/previous preserves SID subsong order before advancing through the playlist.

Amiga and Atari tracks additionally support system seeking, ten-second skip actions and throttled position reporting. C64/SID playback deliberately exposes no seek actions because its generative music programs do not currently provide reliable random-access seeking. Missing Media Session APIs and unsupported individual actions are ignored safely.

Media Session improves system integration; it does **not** guarantee uninterrupted background playback. Mobile operating systems may suspend audio or the page, especially on iOS, according to their own browser and power-management policies.

### 🖼️ Player Stability
The visualizer now skips the complete frame when its canvas has a zero-sized drawable surface. This prevents `drawImage` failures while hidden or before layout and resumes normally after a positive resize.

---

## 🔬 Living Silicon & Hardware-Oriented Chip Telemetry

### 🧬 Interactive "Living Silicon" Die & Motherboard Telemetry
Each of the three sound pillars features a real-time SVG silicon die and external motherboard circuit model driven by emulator telemetry:
*   **MOS 6581 (C64):** Features live 12-bit PWM duty-cycle bars, `TEST`-bit DC lock & `W&` (NMOS Wire-AND) indicators, inter-voice Hard-Sync (`SY`) and XOR Ring-Modulation (`RM`) pathways, register-driven ADSR graphs with live phase/level tracer dots, a morphing 2MHz ZDF VCF response display (`LP`/`BP`/`HP`/`NOTCH`), direct-path `3OFF` routing, `$D418` Galway/PlaySID digi detection, and active DIP-28 address/data (`A0–A4`, `D0–D7`, `/CS`, `PHI2`) pin flashing. The v1.5.2 SID Activity instrument adds three envelope/GATE meters with peak holds and actual ADSR phases, plus a logarithmic register-write counter and 48-column bus history.
*   **MOS 8364 Paula (Amiga 500):** Displays zero-clipping 4-channel Agnus/Paula DMA telemetry (`LC`, `LEN`, `PER`, `Hz`, 6-bit `AUDxVOL` bars), Dual 14-Bit Multiplying DACs with **live animated 192 kHz Zero-Order Hold (ZOH) staircase oscilloscopes**, an on-die `DMACON` (`D0–D3`) & 16-bit FIFO core, jumper-arc PCB routing, and an external **Amiga 500 Board** stage (`LF347` $13\text{ V}/\mu\text{s}$ op-amp + 4.42 kHz static RC + live morphing 3.09 kHz Butterworth LED filter curves).
*   **Yamaha YM2149F (Atari ST):** Showcases live period-scaled **Square-Wave Oscilloscopes** in Tone A/B/C, a 17-bit LFSR noise activity bar, a dedicated CRT scope for all 16 5-bit Hardware Envelope (HEG) shapes with automatic **Sync-Buzzer** detection, visible HEG and Digidrum DAC injection buses, an on-die 32-step Log-DAC & Digidrum hijack detector, and an external **Atari ST Board** model with linear `R43–R45` summing, a summed-level meter, 256-phase Kaiser-sinc resampling and linear 15.9 kHz / 25 Hz output filters.

---

## 🎛️ The Three Soundchip Pillars

### 1. MOS Technology SID 6581 / CSG 8580 (Commodore 64)
Our PAL-clock SID engine combines a documented digital core with independently measured analogue calibration:
*   **Re-Entrant 50Hz Play-IRQ Dispatcher (`$FFD0–$FFDD`):** A 14-byte phantom KERNAL IRQ wrapper allows 50Hz music voice updates to cleanly interrupt Martin Galway's multi-frame foreground `$D418` drum synthesis loops (*Arkanoid*) whenever `CLI` (`I = 0`) is active, resuming the procedural drum loop via `RTI` with zero dropped music frames.
*   **6510 Sub-Cycle Bus Write Pipelining & RMW Dummy-Writes:** Store instructions (`STA/STX/STY`) commit to the hardware bus strictly on the final 4th clock cycle, while Read-Modify-Write instructions (`INC/DEC/ASL/LSR/ROL/ROR`) execute a penultimate-cycle dummy write of the unmodified byte before committing the new value.
*   **Phase 4 CPU / MOS 6526 Timing:** Penultimate-cycle IRQ polling, delayed CLI/SEI mask behavior, RDY write-cycle progression, CIA timer start/force-load/reload pipelines, cascaded Timer B, one-clock delayed IRQ/NMI outputs and final-cycle `LDA $DC0D` acknowledgement are regression-tested against a synthetic corpus and external libsidplayfp black-box traces. This is bounded reference-model agreement, not a complete bus-cycle CPU or real-hardware proof; see `doc/specs/emulation/c64/sid-cpu-cia-timing.md`.
*   **Mirror-Safe PlaySID 3.6× Auto-Conversion & Volume Restore:** Isolates PlaySID extended DMA registers strictly to `(addr & 0x1F) >= 0x1D`, converts Amiga-Paula clock periods ($\ge 280$) to C64 PAL cycles ($907 \to 252$ cycles = $3.91\text{ kHz}$), supports `$D47D` nibble endianness and sample loops, and automatically restores the tracker's shadow `$D418` master volume upon sample completion (*The Great Giana Sisters*).
*   **MOS 6581 R3 12-Bit Digital Core:** Advances three 24-bit phase accumulators with Hard-Sync/RingMod on the 1MHz grid, preserves full 12-bit saw/triangle/pulse/noise DAC inputs, retains the DAC latch with no waveform selected, and uses a documented wired-AND combined-selector baseline. Combined-waveform analogue pull-down calibration remains explicitly measurement-dependent.
*   **Measured `$50` Triangle+Pulse Transfer:** A 257-anchor phase-domain model restores the calibrated Exact-path combined waveform used by *The Great Giana Sisters* Subsong 2. It is special-cased before generic wired-AND and does not alter other combined selectors or Fantasy DSP.
*   **Stateful 15-Bit ADSR:** Two-clock GATE pipeline, wrapping rate counter, exact period matching, linear Attack, and documented exponential divider thresholds preserve state-dependent timing. A resolved rising GATE restarts the rate phase and exponential divider; `TEST` does not, and Release preserves running counters. The zero-level hold also covers short GATE pulses that enter Release before Attack's first increment, preventing envelope underflow and non-finite output. The rising-GATE behavior is bounded to the original-recording calibration documented for *Wizball* Subsong 7.
*   **Black-Box-Calibrated MOS 6581 R3 Filter & Mixer:** The two-substep ZDF solver uses cutoff and damping maps fitted through the public API of libresidfp revision `c1791383`—without importing its code or internal tables. The archived 639-point EXT-IN comparison currently measures 1.876dB median and 6.737dB p95 absolute response error. Additive LP/BP/HP routing, separate measured feedthrough, linear 16-step master volume and direct-path-only `3OFF` are regression-tested. This is reference-model agreement, not a real-chip capture or universal hardware-accuracy claim; see `doc/specs/emulation/c64/sid-filter-model.md`.
*   **Measured Resampling & Output Coupling:** 256-phase interpolated Kaiser-Sinc resampling provides a measured 20kHz passband and at least 96dB stopband attenuation at 44.1/48kHz. The motherboard stage retains its parameterized 16kHz output low-pass and **16Hz** `C13` AC-coupling high-pass.
*   **SID 6581/8580 "Chiptunes Fantasy Studio" Core:** Audiophile dual-channel engine featuring CSG 8580 linear R-2R DACs, 20kHz Studio Airband ZDF VCF, Constant-Power StereoSID dynamic voice staging, and a 48Hz digidrum sub-harmonic transient exciter. Phase 5 adds measured sample-rate-independent **16Hz stereo output coupling** (−0.448dB at 48Hz), with deterministic 20-second worklet comparisons archived for *Commando* and *Arkanoid*. The Exact renders remained byte-identical; external-model STFT agreement is diagnostic evidence, not real-hardware proof. See `doc/specs/emulation/c64/sid-fantasy-studio.md`.

### 2. MOS Technology Paula 8364 / AHI (Amiga 500 & A1200)
*   **Native Jochen Hippel COSO / HIPC Replay Engine (v1.5.0):** Bit-accurate binary parser (`parseCoso`) and zero-allocation 50Hz state machine (`CosoReplayer` & `CosoVirtualMachine`) verified against UADE reference renders ($>95\%$ energy correlation) for *Wings of Death* (Levels 1–7) and *Dragonflight* (Title, Surface, Town, Dungeon). Features two-layer Timbre/Instrument execution (`$E8` envelope sustain, `$E2` vs. `$E4/$E7` split wave-latching, `$E5/$E6` loop sliding, proportional portamento `period * t * slope >> 10`), exact pre-computed song durations (`cosoSongTicks`), and instant deterministic seeking (`seekToTick`).
*   **Hardware Agnus/Paula Latch-on-Wrap DMA (`paula-exact` & `paula-fantasy`):** Models true Amiga shared Chip-RAM and `AUDxLC`/`AUDxLEN` register latching (where pointer/length writes take effect only on the next loop wrap while `hwStartDMA()` triggers the initial pass).
*   **Paula 8364 True Analog (A500):** 192kHz oversampling, Zero-Order Hold (ZOH) DAC modeling, analog LF347 JFET op-amp slew rate stage ($13\text{ V}/\mu\text{s}$), passive 4.42kHz RC filter, active 3.09kHz Butterworth LED filter, 255-tap Sinc-FIR decimator, and physical hard-panning with 3.5% crosstalk.
*   **Paula 8364/AHI Studio Core:** Audiophile A1200/AHI 14-bit Hermite cubic interpolation (following the live DMA loop stream across sample boundaries), Constant-Power spatialized stereo panning, parametric Schroeder/Moorer stereo diffusion reverb, and $>8\text{ kHz}$ airband presence exciter.

### 3. Yamaha YM2149F (Atari ST)
*   **2MHz True Lockstep & 32-Step Log-DAC:** Cycle-exact 2.0 MHz emulation with 32-step logarithmic DAC curves (-1.5dB/step), 64-step hardware envelope state machine, and 4-bit Digidrum DAC injection.
*   **Linear Passive Summing Baseline:** Sums the three YM channels with one fixed level-preserving output scale. The previous additional bus compression and `tanh` saturation are not part of the Exact path; no uncalibrated motherboard-nonlinearity claim is made.
*   **Two-Stage Interpolated 256-Phase Kaiser-Sinc Resampler:** Converts the 2MHz lockstep stream to 44.1, 48 or 96kHz with a 20kHz passband and a 96dB stopband design target. The two stages use 181+493, 163+297 and 73+87 taps respectively; measured worst-case stopband-start responses are −99.46, −103.00 and −98.94dB. Constant group delay and the linear 15.9kHz low-pass / 25Hz high-pass output model are documented in the Atari measurement notes.

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
