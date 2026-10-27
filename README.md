# 💾 CHIPTUNES FANTASY (v1.5.3)
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

## 🚀 v1.5.3 Release Highlights

### Atari ST / YM2149 Exact — deterministic 2 MHz register-dump playback
Version 1.5.3 completes the bounded Atari-ST/YM2149 refinement program. The hardware-oriented `ym-exact` path now combines validated YM parsing and transport, deterministic digital state machines, MFP-derived YM6 effect timing, linear channel summing, and a measured two-stage output chain. It remains a fixed-2-MHz register-dump player—not a complete MC68000/MFP/SNDH emulator or a claim of universal physical-hardware equivalence.

- **Raw measurement harness:** Cycle-stamped register events, stable same-cycle ordering, preallocated internal traces, CSV, and deterministic IEEE-float32 WAV expose the digital core without hidden resampling or output processing.
- **Digital corrections:** R13 envelope writes select the correct initial level and preserve a full first step; `$FF` leaves the envelope running. Fixed volume zero is silent. Restarting a track is bit-identical to a fresh worklet, while stop/resume preserves digital and transport state.
- **YM6 effects:** Two independent slots implement Digidrum, SID-Voice, Sinus-SID, and Sync-Buzzer with `2457600 / predivisor / timerCount` timing mapped onto the YM timeline through integer phase accumulation.
- **Formats and transport:** YM3!, YM3b, YM5!, and YM6! support includes both register layouts, signed/unsigned/already-4-bit samples, parsed player rates, stored loop points, seeking, UI duration, and Media Session position.

### Measured linear output and two-stage resampling
The three YM voices sum linearly with one fixed level-preserving scale. The former additional bus compression and `tanh` saturation are not part of Exact. Two cascaded 256-phase Kaiser-windowed-sinc stages retain a 20 kHz requested passband and 96 dB design target while using an intermediate rate of four times the host rate:

| Output rate | Stage taps | Constant group delay | Worst stopband-start response |
|---:|---:|---:|---:|
| 44.1 kHz | 181 + 493 | 1.439558 ms | −99.463 dB |
| 48 kHz | 163 + 297 | 0.811333 ms | −102.999 dB |
| 96 kHz | 73 + 87 | 0.129979 ms | −98.939 dB |

The declared output model uses a linear 15.9 kHz low-pass and 25 Hz high-pass. These are measured software/filter properties, not a physical Atari-mainboard calibration. Register-derived periods and fixed levels are cached on writes, and the mono FIR loop is unrolled without changing accumulation order.

### Curated Atari library — 86 tracks, 13 new highlights
The Atari music disk now contains **86 directly playable tracks**. New additions cover *Ghouls ’n Ghosts*, *Speedball*, *Stormlord*, *Chambers of Shaolin*, *Xenon 2 – Megablast*, *LED Storm*, *Synergy*, and *Punish Your Machine*.

Nested logical folders separate games and demo-scene productions, while concise `listTitle` labels keep browsing readable. Existing physical `sourcePath` locations and production-baseline paths remain unchanged. Every museum card was reviewed: generic fallbacks, incorrect credits, invented scene names, and unsupported technical superlatives were replaced by defensible metadata and editorial context.

The new files were unpacked from their LH5 source archives without changing register data, embedded metadata, or Digidrums. Sources, inner filenames, provenance, and rights boundaries are documented in [Atari track sources](tracks/atari/SOURCES.md).

### Technical Deep Dive and release documentation
The [Atari ST YM2149F Technical Deep Dive](doc/specs/emulation/atari/technical-deep-dive-atari.md) explains the actual implementation: parser and transport, tone/noise/envelope state machines, YM6/MFP-derived effects, DAC summing, resampling, output filtering, performance, alternative cores, and evidence limits.

Copy-ready GitHub texts are included for the [v1.5.3 pull request](doc/releases/v1.5.3-PR-Text.md) and [v1.5.3 release](doc/releases/v1.5.3-Release-Text.md).

### Validation and known limitations
- **Focused Atari selection:** 48 tests — 48 passed, 0 failed.
- **Full suite:** 273 tests — 211 passed, 1 known pre-existing SID-corpus failure, 61 skipped.
- All **86** curated YM files parse as 2 MHz / 50 Hz register dumps; all **12** nonzero stored loop points are exercised through the production worklet.
- Production output is deterministic and independent of audio block size at 44.1, 48, and 96 kHz.
- Documented sixty-second production renders are bit-identical across fresh runs and contain zero non-finite samples.
- Real Chromium AudioWorklet checks cover 44.1/48 kHz at desktop and mobile-emulation viewports; nested Atari navigation and representative YM3!/YM5!/YM6! playback were also checked.

The single full-suite failure remains the previously documented SID synthetic-corpus mismatch; its baselines were not overwritten. Seventeen HIP tests skip because `tracks/amiga/Wings_Of_Death-Title.hip` is absent. Real YM2149 DAC/mainboard calibration, controlled reference-device listening tests, full SNDH replay, and arbitrary non-2-MHz production playback remain outside this release. Self-generated hashes are regression anchors, not hardware truth references.

### Foundation carried forward from v1.5.2
The C64 hardware laboratory retains its telemetry-driven **SID Activity** instrument with envelope/GATE meters, actual ADSR phases, register writes per second, and a 48-column bus history. The documented *Wizball* rising-GATE correction, *Giana Sisters* `$50` transfer refinement, and independent display-time accumulator also remain part of the player.

Media Session metadata and transport, Atari/Amiga seeking, responsive Living Silicon telemetry, and zero-sized Canvas frame protection are retained. C64/SID system seeking remains unavailable because reliable random-access seeking is not implemented.

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
*   **2MHz Cycle-Stepped Digital Core:** Advances three tone generators, a shared 17-bit noise LFSR, the 5-bit hardware envelope, active-low mixer gates, and the project's 32-level logarithmic DAC table on the native YM timeline. The current production profile plays fixed-2-MHz register dumps rather than executing a complete Atari ST.
*   **YM3/YM5/YM6 Formats & MFP-Derived Effects:** Supports YM3!, YM3b, YM5!, and YM6! register layouts, Digidrum encodings, player rates, and stored loop points. Two YM6 effect slots implement Digidrum, SID-Voice, Sinus-SID, and Sync-Buzzer with integer MFP-to-YM phase accumulation.
*   **Linear Summing Baseline:** Sums the three YM channels with one fixed level-preserving output scale. The previous additional bus compression and `tanh` saturation are not part of the Exact path; no uncalibrated motherboard-nonlinearity claim is made.
*   **Two-Stage Interpolated 256-Phase Kaiser-Sinc Resampler:** Converts the 2MHz stream to 44.1, 48 or 96kHz with a 20kHz requested passband and a 96dB stopband design target. The two stages use 181+493, 163+297 and 73+87 taps respectively; measured worst-case stopband-start responses are −99.46, −103.00 and −98.94dB. Constant group delay and the linear 15.9kHz low-pass / 25Hz high-pass output model are documented in the Atari measurement notes.
*   **Curated 86-Track Library:** Adds 13 highlights, nested game/demo folders, concise list labels, reviewed museum cards, and documented source provenance while preserving existing physical and baseline paths.

**Technical Deep Dive:** [Atari ST YM2149F emulation engine](doc/specs/emulation/atari/technical-deep-dive-atari.md) — parser and transport, 2MHz digital core, YM6/MFP-derived effects, DAC summing, two-stage resampling, output filtering, performance and evidence limits.

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
