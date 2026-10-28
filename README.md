# 💾 CHIPTUNES FANTASY (v1.5.4)
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

## 🚀 v1.5.4 Release Highlights

Version 1.5.4 combines the six-stage Amiga Exact refinement program with a substantially expanded, researched music disk and targeted C64/Atari corrections. The curated library now contains **205 directly playable tracks**: **69 Amiga**, **50 C64**, and **86 Atari ST** titles. The **48 new classics** comprise 24 Amiga modules and 24 C64 SIDs; existing entries remain in the playlists.

### Amiga Exact — measurement, replay, output, and production acceptance
Phases 0–5 establish reproducible evidence before changing behavior, then correct the production `paula-exact` path subsystem by subsystem:

- **Measurement foundation:** A real-worklet offline harness exposes separate Paula, ZOH, and A500 taps, while the corpus inventory records formats, tracker features, source hashes, and reference requirements.
- **Digital state and transport:** `AUDxVOL = 0` now silences the DAC without stopping DMA or period state. `PLAY_TRACK` performs a complete restart reset; pause/resume preserves sequencer, sample, effect, DMA, and filter state.
- **COSO/HIPC and HIP68K:** Replay uses the PAL CIA timer period 14188—approximately **49.99852 Hz**, not an assumed exact 50 Hz. HIP68K schedules its documented DMA start and loop-latch writes at raster-derived positions within the replay tick.
- **MOD/XM:** Continuous arpeggio, portamento, tone-portamento, vibrato, tremolo, volume slides, combined effects, effect memory, sample offset, linear XM frequencies, panning, global volume, variable pattern lengths, and multi-channel attenuation are covered by focused tests and real modules.
- **Linear A500 approximation:** Uncalibrated LF347/`tanh` stages were removed. The documented 4.421 kHz RC filter, optional 3.09 kHz LED filter with continuous bypass history, 255-tap FIR, and 0.7 output scale remain software approximations—not a measured Amiga-mainboard calibration.

The [Phase 5 production report](doc/verification/amiga/phase5-report.md) and the earlier phase reports retain their historical evidence instead of rewriting old baselines as new behavior landed.

### Curated Amiga and C64 libraries — 48 new classics
The **69-track Amiga library** contains 35 HIPC-family, 31 MOD, and 3 XM entries. Its 24 additions are split between 12 game and 12 demo-scene modules, with nested folders, individual museum research, local binary facts, and hash-bound provenance. Selection and editorial decisions are documented in [Amiga track sources](doc/museum/amiga-track-sources.md).

The **50-track C64 library** retains all 26 existing paths and adds 24 HVSC #85 files: 20 game soundtracks and four demo-scene works. Every entry has an individual museum card and official sub-song lengths. Folder navigation is now enabled in the production C64 interface. The 43 direct MD5 mappings, seven path-based legacy mappings, source decisions, and the documented 23-subsong Rambo variant are covered in [C64 track sources](doc/museum/c64-track-sources.md).

Public availability in Modland or HVSC does **not** imply public domain, redistribution permission, or a commercial-use license. Rights remain with their respective holders; the provenance files document origin and integrity, not a new license grant.

### C64 environmental diagnostics and Atari YM5 Digidrums
C64 environmental readouts no longer average the fourth telemetry slot—the SID bus-rate value—as a fictitious audio channel. Random jitter was removed and smoothing is time-based rather than frame-rate-dependent. This changes the presentation/sensor model only, not SID emulation.

Atari YM5 frames now receive a version-specific normalization for Digidrum start bits in R3; global YM6 decoding is unchanged. A regression test uses a real *Punish Your Machine* frame and proves that normalized R3 value `0x31` starts sample 0 as a Digidrum on voice C. The sample audit covers 20 sample-based tracks: eight affected YM5 files were repaired by the normalization, eleven YM6 files remain correctly decoded, and *Turrican 1* contains sample blocks but no Digidrum start commands.

### Validation and known limitations
- **Full suite:** 361 tests — 353 passed, 7 skipped, 1 known pre-existing failure.
- **Amiga library:** 69/69 tracks passed audible, finite, deterministic, block-size-independent, and restart-identical offline acceptance; no silent A500 title was found.
- **C64 library:** 50/50 tracks passed the equivalent four-render offline acceptance. Representative PSID and RSID playback, folders, museum cards, and source links were also exercised in desktop and mobile-viewport Chromium.
- **Atari:** The real YM5 Punish-frame regression and sample audit cover the corrected behavior without changing YM6 semantics.

The remaining full-suite failure is `SID synthetic corpus matches the reviewed Phase 3 raw/trace/WAV hashes`; its `noise-adsr` baseline was not overwritten. Details and hashes are retained in the [C64 curation report](doc/verification/c64/curation-report.md). Offline timing ratios are not device underrun guarantees, headless mobile viewports are not physical-device tests, and self-generated hashes are regression anchors—not hardware truth references. C64/SID random-access seeking remains unavailable.

Copy-ready GitHub texts are included for the [v1.5.4 pull request](doc/releases/v1.5.4-PR-Text.md) and [v1.5.4 release](doc/releases/v1.5.4-Release-Text.md).

---

## 🔬 Living Silicon & Hardware-Oriented Chip Telemetry

### 🧬 Interactive "Living Silicon" Die & Motherboard Telemetry
Each of the three sound pillars features a real-time SVG silicon die and external motherboard circuit model driven by emulator telemetry:
*   **MOS 6581 (C64):** Features live 12-bit PWM duty-cycle bars, `TEST`-bit DC lock & `W&` (NMOS Wire-AND) indicators, inter-voice Hard-Sync (`SY`) and XOR Ring-Modulation (`RM`) pathways, register-driven ADSR graphs with live phase/level tracer dots, a morphing 2MHz ZDF VCF response display (`LP`/`BP`/`HP`/`NOTCH`), direct-path `3OFF` routing, `$D418` Galway/PlaySID digi detection, and active DIP-28 address/data (`A0–A4`, `D0–D7`, `/CS`, `PHI2`) pin flashing. The v1.5.2 SID Activity instrument adds three envelope/GATE meters with peak holds and actual ADSR phases, plus a logarithmic register-write counter and 48-column bus history.
*   **MOS 8364 Paula (Amiga 500):** Displays zero-clipping 4-channel Agnus/Paula DMA telemetry (`LC`, `LEN`, `PER`, `Hz`, 6-bit `AUDxVOL` bars), Dual 14-Bit Multiplying DACs with **live animated four-times-host-rate Zero-Order Hold (ZOH) staircase oscilloscopes**, an on-die `DMACON` (`D0–D3`) & 16-bit FIFO core, jumper-arc PCB routing, and an external **linear A500 approximation** (4.421 kHz static RC + live morphing 3.09 kHz Butterworth LED filter curves).
*   **Yamaha YM2149F (Atari ST):** Showcases live period-scaled **Square-Wave Oscilloscopes** in Tone A/B/C, a 17-bit LFSR noise activity bar, a dedicated CRT scope for all 16 5-bit Hardware Envelope (HEG) shapes with automatic **Sync-Buzzer** detection, visible HEG and Digidrum DAC injection buses, an on-die 32-step Log-DAC & Digidrum hijack detector, and an external **Atari ST Board** model with linear `R43–R45` summing, a summed-level meter, 256-phase Kaiser-sinc resampling and linear 15.9 kHz / 25 Hz output filters.

---

## 🎛️ The Three Soundchip Pillars

### 1. MOS Technology SID 6581 / CSG 8580 (Commodore 64)
Our PAL-clock SID engine combines a documented digital core with independently measured analogue calibration:
*   **Curated 50-Track Library & Official Song Lengths:** Retains 26 existing paths and adds 24 HVSC #85 classics in game/demo folders, with 50 individual museum cards, hash-bound provenance, and sub-song lengths matched to every local PSID/RSID header. See [C64 track sources](doc/museum/c64-track-sources.md) and the [curation report](doc/verification/c64/curation-report.md).
*   **Stable Environmental Diagnostics:** Excludes the SID bus-rate telemetry slot from channel-level averaging, removes random jitter, and uses time-based smoothing so readouts behave consistently across display refresh rates. SID synthesis is unchanged.
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
*   **Curated 69-Track Library:** Preserves all 45 existing entries and adds 24 game/demo classics, with nested folders, researched museum texts, and hash-bound Modland provenance. The complete 35-HIPC/31-MOD/3-XM selection passes deterministic offline acceptance; see [Amiga track sources](doc/museum/amiga-track-sources.md).
*   **Native Jochen Hippel COSO / HIPC and HIP68K Replay:** Bit-accurate binary parsing and deterministic replay use the PAL CIA timer period 14188 (approximately 49.99852Hz rather than an assumed exact 50Hz). HIP68K executes the original 68000 player with raster-timed DMA starts and loop latches. Two-layer Timbre/Instrument execution, song-duration calculation and deterministic seeking remain covered by the fixture and production corpus.
*   **Hardware Agnus/Paula Latch-on-Wrap DMA (`paula-exact` & `paula-fantasy`):** Models true Amiga shared Chip-RAM and `AUDxLC`/`AUDxLEN` register latching (where pointer/length writes take effect only on the next loop wrap while `hwStartDMA()` triggers the initial pass).
*   **MOD/XM Tracker Playback:** The Exact path covers tick-based arpeggio, portamento, tone-portamento, vibrato, tremolo, volume slides, combined effects, effect memory, sample offset, linear XM frequencies and panning, global volume, variable pattern lengths, and the existing 16/24/32-channel mix attenuation.
*   **Paula 8364 Exact / A500 Output Approximation:** Four-times host-rate oversampling, word-aligned 16-bit DMA with high/low-byte output phases, signed 8-bit sample and 6-bit volume scaling, physical L-R-R-L panning with 3.5% crosstalk, and deterministic full-track reset feed a linear A500 approximation. The output chain retains the project’s 4.421kHz one-pole RC filter, optional 3.09kHz Butterworth LED filter with continuous bypass state, 255-tap Sinc-FIR decimator, and 0.7 output scale. The former uncalibrated LF347/`tanh` stages are not part of Exact. These filter values are documented software approximations, not a measured Amiga-mainboard calibration.
*   **Paula 8364/AHI Studio Core:** Audiophile A1200/AHI 14-bit Hermite cubic interpolation (following the live DMA loop stream across sample boundaries), Constant-Power spatialized stereo panning, parametric Schroeder/Moorer stereo diffusion reverb, and $>8\text{ kHz}$ airband presence exciter.

### 3. Yamaha YM2149F (Atari ST)
*   **2MHz Cycle-Stepped Digital Core:** Advances three tone generators, a shared 17-bit noise LFSR, the 5-bit hardware envelope, active-low mixer gates, and the project's 32-level logarithmic DAC table on the native YM timeline. The current production profile plays fixed-2-MHz register dumps rather than executing a complete Atari ST.
*   **YM3/YM5/YM6 Formats & MFP-Derived Effects:** Supports YM3!, YM3b, YM5!, and YM6! register layouts, Digidrum encodings, player rates, and stored loop points. YM5-only normalization maps R3 Digidrum start bits without changing global YM6 decoding; a real *Punish Your Machine* frame guards the voice-C `0x31` case. Two YM6 effect slots implement Digidrum, SID-Voice, Sinus-SID, and Sync-Buzzer with integer MFP-to-YM phase accumulation.
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
