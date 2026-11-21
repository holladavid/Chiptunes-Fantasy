# 💾 CHIPTUNES FANTASY (v1.6.7)
> **The Ultimate 8-Bit/16-Bit Bare-Metal Music Disk Emulator & Hardware Laboratory**

---

## 🎯 The Vision ("Von Nerds für Nerds")
**Chiptunes Fantasy** is not a simple music player. It is a high-fidelity, real-time emulated music disk and interactive hardware laboratory that runs entirely in your web browser with zero external framework dependencies. Hardware-oriented emulation is validated subsystem by subsystem; measured reference agreement is not a claim of universal chip accuracy.

We do not play MP3s or pre-recorded audio. We parse genuine, vintage binary tracker and music-driver formats (`.sid`, `.hipc`, `.mod`, `.xm`, `.ym`) and synthesize every single waveform, DMA fetch, filter, and envelope on-the-fly using highly optimized, low-latency asynchronous `AudioWorkletProcessors`.

### 🌌 Why "Fantasy"?
A real Commodore 64, Amiga 500, or Atari ST could *never* execute a cycle-exact sound routine, calculate a 3D vector star, render a PETSCII plasma, and drive a logic analyzer simultaneously—it would have melted the CPU instantly.

But memory paints the past grander than it actually was. **This is our Fantasy.**
Every single *Demo-Scene-Element (DSE)* you see on screen is programmed with ruthless historical accuracy (strict hardware palettes, true bit-banged integer math, zero anti-aliasing). Our `Scene-DJ` then acts as the ultimate virtual orchestrator, taking these isolated, period-accurate effects and layering them into a breathtaking, synchronized demoscene experience that feels *exactly* like our childhood memories.

---

## 🚀 What's New in v1.6.7

Version 1.6.7 expands the `Scene-DJ` visual repertoire with **18 brand-new, system-authentic Demo-Scene Elements (6 per hardware pillar)** spanning `background`, `floor`, and `foreground`—closing the missing `floor` layer gap on **Commodore 64** and **Atari ST**, expanding **Amiga's** parallax and 3D terrain visuals, and backing every effect with a **DOM-free, zero-allocation retro graphics kit**.

### 🟦 Commodore 64 (VIC-II + 3-Voice SID)
- **Backgrounds:** *Raster Tunnel* (nested horizon-anchored intro frames with 32-ring SID waterfall, `climax` splits & pulse pool) and *Fire Wall* (50 Hz chunky heat cellular fire with 3 SID zones, ember bed & 24-spark pool).
- **Floors (New Layer):** *Raster Road* (scanline perspective road with 4 wipeable terrain families, anti-moiré haze, 3 hysteresis-lit SID lanes, Z-sorted pylons & gates) and *Dance Floor* (61×9 Color-RAM tile grid with 4 beat-driven 50 Hz patterns & SID sparkles).
- **Foregrounds:** *Sine Scroller* (2-pass black-outlined `5×7` DYCP scroller with Raster-IRQ bands & adaptive horizontal/vertical rotation continuity) and *Border Rasters* (VIC-II `$D020` open-border bars with 8 orbiting `7×7` hardware star sprites).

### 🟥 Amiga OCS/ECS (Copper + Blitter + 4-Channel Paula)
- **Backgrounds:** *RotoZoomer* (chunky 4×4-style rotozoomer across 4 `64×64` textures, tension-gated kaleidoscope mirrors & Copper flash bands) and *Tech-Tech* (`BPLCON1` multi-harmonic scanline-shift curtain with sweeping shockwaves).
- **Floors:** *Voxel Hills* (`128×128` Comanche-style height-map raycaster with winding canyon flight, 3D mountain peaks silhouetted against transparent sky & 4 Paula `L-R-R-L` ridges) and *Parallax Ground* (*Shadow of the Beast*-inspired 8-band terrain equalizer with cascading wipes, `8×10` sprites & dust particles).
- **Foregrounds:** *Twister* (1–3 phase-offset 4-sided raster bars with 4 morphing twist modes & fixed 1:1 Paula face binding) and *Vector Balls* (pre-shaded Blitter-bob spheres across 4 morphing 3D formations, ultrawide twin bodies & `climax` ghost trails).

### 🟩 Atari ST (9-Bit Shifter + Timer-B Rasters + 3-Voice YM2149)
- **Backgrounds:** *Meta Blobs* (chunky metaball field with 3 YM voice blobs + 4 orbiting satellites & `climax` `#fcfcfc` cores) and *Julia Cycler* (4-constant morphing Julia fractal with 3 radial YM zones & flicker-safe `RING_HUE` cycling).
- **Floors (New Layer):** *Laser Grid* (perspective wireframe floor with scanline-dithered YM lane glows, grid sine waves & `climax` laser sweeps) and *Pond Ripples* (row-dithered water surface with 3 YM wave emitters, ambient droplets & run-merged Midpoint-ellipse ripples).
- **Foregrounds:** *Flat Shaded Trio* (6 unit-normalized polyhedra with Lambert flat shading, Painter Z-sort, deduplicated `1 px` black edges & face explosions) and *Line Ribbons* (Mystify-style Bresenham ribbons with `25 Hz` history ring buffer, black drop shadow & proportional resize mapping).
- **Timer-B Raster Wipes & Strict Scanline Budgets:** Every Atari ST DSE enforces `0..7 × 36` 9-bit color quantization (max `#fcfcfc`) and splits crossing primitives cleanly along `wipeY` to stay within hardware per-scanline color limits (`<= 6` for floors, `<= 13–16` overall).

### 🔧 Shared DOM-Free Retro Rendering Infrastructure
- **`hardware-constraints.js` & `bitmap-font.js`:** Added `createXorshift32`, run-merged `bayerFadeCells`, clipped Bresenham/scanline/Midpoint-ellipse primitives, and extracted the shared `5×7` bitmap font with precomputed glyph runs for `TrackPresenter` and `C64SineScroller`.
- **Aligned Stage Transitions & Verification:** Synchronized all 18 new DSEs to `StageManager`'s `1.5 s` fade timings, balanced `VoidFloor` weights across all three systems, and added **21 Node.js strict fake-canvas test suites** covering determinism, graded beat intensities, rotation continuity, and `fillRect` budgets.

---

## ✨ Core Features & Architecture

### 🎬 Scene-DJ & System-Accurate Demo-Scene Elements (DSEs)
*   **50 Hz PAL Orchestration:** Our `Scene-DJ` monitors channel energies, track novelty, beat strength (`soft` / `medium` / `hard` impulses vs. exact musical beat boundaries), and macro tension (`playing`, `buildup`, `climax`, `afterglow`) to choreograph layered background, floor, foreground, and presenter DSEs—spanning classic *Castles*, *Retro Sunsets*, *Kefrens Checkerboards*, *PETSCII Plasmas*, *C64 Raster Tunnels/Roads*, *Amiga Voxel Hills/Twisters/Vector Balls*, and *Atari ST Flat-Shaded Trios/Julia Cyclers/Laser Grids*.
*   **Ruthless Historical Accuracy:** All DSEs run DOM-free inside system-strict retro rasters and hardware color tables (16-color C64 Colodore, 4,096-color 12-bit Amiga OCS, 512-color 9-bit Atari ST Shifter) with Bayer 4×4 ordered dithering, zero alpha blending, and crisp `image-rendering: pixelated` scaling.
*   **Row-Batched FFT Phosphor Analyzer:** 48 logarithmic VFD/phosphor bars from `45 Hz` to `12 kHz` sampled from a 4096-point FFT with DC-offset rejection, time-based peak-hold gravity, and row-batched draw calls.

### 🎛️ Interactive CRT & Scope Calibration Deck (`[ CRT / SCOPE ]`, Shortcut `[C]`)
*   **Live Calibration & Persistent Profiles:** Tune every CRT optics and oscilloscope parameter in real time via `DisplaySettingsStore` (`localStorage`-persisted) across **FACTORY**, **AUTO SYS** (`C64 → 1702 COMP`, `Amiga → 1084S RGB`, `Atari ST → TRINITRON`), **1084S RGB**, **1702 COMP**, **TRINITRON**, and **DELTA** profiles, with double-click per-slider reset, `[ RESET ]`, and instant **A/B live factory comparison (`[B]`)**.
*   **Linear-Light WebGL CRT Shadow Mask (`crt-shadow-mask.js`):** Gamma-2.0 linear-light pipeline on a `highp` fullscreen triangle with analytical pixel-snapped **Slot**, **Delta**, and **Aperture Grille** masks, 2-pass low-res FBO glass halation (`HIGH` tier), beam-current spot blooming, 1×/2× scanlines, R/B convergence drift, barrel curvature with rounded SDF bezel, $\cos^4$ vignette, and clean `MED`/CSS fallbacks.
*   **100 Hz-Capped Phosphor Oscilloscope (`oscilloscope.js`):** Decoupled `simulate()`/`compose()` architecture (`10 ms` step cap) delivering identical phosphor persistence across 60 Hz–240 Hz displays, level-normalized Schmitt + `-MSE` triggering, layer-batched drawing, and front-panel **V/DIV Gain**, **Timebase**, **Persistence**, **Phosphor Glow**, **Graticule**, **Beam FX**, **Trigger Mode**, and **Phosphor Tint** (`SYS`, `P31`, `P11`, `AMBER`) controls.

### 🧬 Interactive "Living Silicon" Die & Motherboard Telemetry
Each soundchip pillar drives a real-time SVG silicon die and external motherboard circuit model directly from emulator telemetry:
*   **MOS 6581 SID (C64):** Live 12-bit PWM duty-cycle bars, `TEST`-bit DC lock & `W&` (NMOS Wire-AND) indicators, Hard-Sync (`SY`) and Ring-Mod (`RM`) pathways, register-driven ADSR graphs with live phase/level tracer dots, logarithmic 6581 ZDF VCF response curve (`LP`/`BP`/`HP`/`NOTCH`), `3OFF` direct routing, `$D418` digi detection, active DIP-28 pins (`A0–A4`, `D0–D7`, `/CS`, `PHI2`), and a 48-column bus history meter.
*   **MOS 8364 Paula (Amiga 500):** 4-channel Agnus/Paula DMA telemetry (`LC`, `LEN`, `PER`, `Hz`, 6-bit `AUDxVOL`), Dual 14-Bit Multiplying DACs with **live animated 4× Zero-Order Hold (ZOH) staircase oscilloscopes**, authentic DIP-48 pin assignments (`Pin 31 AUDA`, `Pin 30 AUDB`, `Pin 28 CCK`, `Pin 12 DMAL`), `DMACON` & FIFO status, and an external linear A500 filter stage (`4.421 kHz` static RC + morphing `3.09 kHz` LED filter).
*   **Yamaha YM2149F (Atari ST):** Live period-scaled square-wave oscilloscopes for Tone A/B/C, 17-bit LFSR noise activity, dedicated CRT scope for all 16 5-bit Hardware Envelope shapes with Sync-Buzzer detection, visible HEG and Digidrum DAC injection buses, authentic `Pin 22 CLOCK` indicator, 32-step Log-DAC readout, and external Atari ST board output filters.

### 📚 216-Entry Curated Library & Story-First Digital Museum
*   **Three Computer Pillars:** **216 curated entries** across **Amiga (73)**, **Commodore 64 (57: 56 music tracks + 1 60-test SID emulation suite)**, and **Atari ST (86)** with full-library cross-folder transport stepping (`BUS >` / `< MEM`), search, and subsong switching.
*   **Story-First Museum & Workspace Modes:** Switch right-hand panels between `[ SPLIT ]`, `[ MUSEUM ]` (`[A]`), and `[ CHIP ]` modes. Every track features fact-checked historical liner notes, DeepSID/CSDb/Demozoo/Modland provenance, binary structure analysis, system hardware dossiers, register cheat sheets, and a synchronized adaptive bottom scroller (`TRACK` / `TECH` / `STORY`) with direct `MUSEUM ↗` jumping.

### 🎧 Audiophile Master Bus DSP & Ergonomics
*   **Complementary Bauer Binaural Crossfeed (bs2b):** 700 Hz crossfeed low-pass + 1000 Hz direct high-shelf (`0 dB` DC mono sum, `-4.73 dB` crossfeed) with a click-free 10 ms toggle crossfade (`[ STEREO BLEND ]`) to eliminate headphone fatigue on hard-panned Amiga and StereoSID mixes.
*   **1.0 ms Smoothed Lookahead Brickwall Limiter:** O(1) monotonic sliding-window minimum deque with moving-average attack smoothing capping peaks cleanly at `-0.35 dBFS` without pre-transient stepping or OS ducking.
*   **Cockpit & Power Saving:** Supports Desktop Command Deck layouts (up to 3-column ultrawide), native & pseudo-fullscreen stages with timeline scrubbing and auto-hiding overlays, Media Session lockscreen integration, and `[ HALT GFX ]` Eco Mode (`[M]`).

---

## 🎛️ The Three Soundchip Pillars

Each system supports an **Exact** hardware-oriented core plus optional **Fantasy Studio** / **Blade Runner** DSP reinterpretations:

### 1. MOS Technology SID 6581 / CSG 8580 (Commodore 64)
*   **1 MHz Cycle-Stepped 6510 / MOS 6526 CIA / SID Core:** Sub-cycle store pipelining, RMW dummy-writes, re-entrant 50 Hz Play-IRQ dispatcher (`$FFD0–$FFDD`), CIA timer pipelines, and mirror-safe PlaySID DMA (`3.6×` auto-conversion & `$D418` restore).
*   **MOS 6581 R3 Digital & Analogue Stage:** 24-bit phase accumulators, Hard-Sync/RingMod, measured `$50` Triangle+Pulse transfer, stateful 15-bit ADSR (with saturation-safe Attack retrigger), black-box-calibrated 2× oversampled ZDF-SVF filter & mixer, 256-phase Kaiser-Sinc resampling (`≥96 dB` stopband), and `16 Hz` `C13` AC coupling.
*   **Studio & Blade Runner Cores:** *Fantasy Studio* (CSG 8580 R-2R DACs, 20 kHz airband ZDF, StereoSID staging, 48 Hz digidrum sub-exciter) and *Blade Runner v1.1* (1 MHz lockstep Stereo SID + 3-voice Yamaha CS-80 dual-rank PolyBLEP layer, 64-cycle bus-settle latch, `$D418` onset designer, Dimension-D chorus, multi-tap tape delay, orthogonal Lexicon 224 FDN reverb, and $C^\infty$ tape saturation).

### 2. MOS Technology Paula 8364 / AHI (Amiga 500 & A1200)
*   **Native COSO / HIPC / HIP68K & Tracker Replay:** Bit-accurate Jochen Hippel replay at PAL CIA timer period 14188 (`~49.99852 Hz`), raster-timed 68000 DMA latches (`HIP68K`), plus full `.mod` and `.xm` effect execution (arpeggio, portamento, vibrato, tremolo, volume slides, linear XM frequencies, variable pattern lengths, and multi-channel attenuation).
*   **Paula 8364 Exact / A500 Output Approximation:** 4× host-rate oversampling, word-aligned 16-bit Agnus latch-on-wrap DMA, 6-bit volume scaling, physical L-R-R-L panning with 3.5% crosstalk, and a linear A500 filter approximation (`4.421 kHz` RC, switchable `3.09 kHz` LED filter with continuous bypass state, 255-tap Sinc-FIR decimator).
*   **Paula / AHI Studio Core:** 14-bit Hermite cubic interpolation across live DMA loop wraps, constant-power stereo panning, Schroeder/Moorer diffusion reverb, and `>8 kHz` airband exciter.

### 3. Yamaha YM2149F (Atari ST)
*   **2 MHz Cycle-Stepped Digital Core:** Three tone generators, shared 17-bit noise LFSR, 5-bit hardware envelope, active-low mixer gates, and 32-level logarithmic DAC summing.
*   **YM3/YM5/YM6 & MFP-Timer Effects:** Full format support (including YM5 R3 Digidrum normalization) and two MFP-clocked YM6 effect slots for Digidrum, SID-Voice, Sinus-SID, and Sync-Buzzer.
*   **Two-Stage 256-Phase Kaiser-Sinc Resampler & Blade Runner v2.5:** Converts 2 MHz output to 44.1/48/96 kHz (`>98 dB` stopband attenuation) with linear `15.9 kHz` LP / `25 Hz` HP filtering, alongside the *YM Blade Runner v2.5* CS-80 ZDF-SVF + Dimension-D + Lexicon 224 core.

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| **`C`** | Open / close the CRT & Oscilloscope Calibration Deck |
| **`B`** | Toggle **A/B** Factory Default live comparison (while Calibration Deck is open) |
| **`F`** | Toggle Fullscreen Stage |
| **`M`** | Toggle Eco Mode (`[ HALT GFX ]`) |
| **`A`** | Toggle Right Panel (`[ MUSEUM ]` / `[ SPLIT ]`) |
| **`L`** | Toggle Chip Logic HUD |
| **`Esc`** | Close Calibration Deck / Exit Eco Mode / Exit Pseudo-Fullscreen |

---

## 🛠️ Local Playback & Testing

Run via a local web server (required by ES6 Modules and `AudioWorklet` CORS rules):

```bash
# Using Node.js:
npx serve .

# Using Python:
python3 -m http.server 8080

# Run automated Node.js unit & DSE test suites:
node --test test/*.test.mjs