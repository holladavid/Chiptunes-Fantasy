# 💾 CHIPTUNES FANTASY (v1.6.8)
> **The Ultimate 8-Bit/16-Bit Bare-Metal Music Disk Emulator & Hardware Laboratory**

---

## 🎯 The Vision ("Von Nerds für Nerds")
**Chiptunes Fantasy** is not a simple music player. It is a high-fidelity, real-time emulated music disk and interactive hardware laboratory that runs entirely in your web browser with zero external framework dependencies. Hardware-oriented emulation is validated subsystem by subsystem; measured reference agreement is not a claim of universal chip accuracy.

We do not play MP3s or pre-recorded audio. We parse genuine, vintage binary tracker and music-driver formats (`.sid`, `.hipc`, `.mod`, `.xm`, `.ym`) and synthesize every single waveform, DMA fetch, filter, and envelope on-the-fly using highly optimized, low-latency asynchronous `AudioWorkletProcessors`.

### 🌌 Why "Fantasy"?
A real Commodore 64, Amiga 500, or Atari ST could *never* execute a cycle-exact sound routine, calculate a 3D vector star, render a PETSCII plasma, and drive a logic analyzer simultaneously—it would have melted the CPU instantly.

But memory paints the past grander than it actually was. **This is our Fantasy.**
Every single *Demo-Scene-Element (DSE)* you see on screen is programmed with ruthless historical accuracy (strict hardware palettes, true bit-banged integer math, zero anti-aliasing). Our `Scene-DJ` then acts as the ultimate virtual orchestrator, taking these isolated, period-accurate effects and layering them into a breathtaking, synchronized demoscene experience that feels *exactly* like our childhood memories.

### 🏛️ The Road Ahead: A Living Museum of the Home-Computer Era
While **Chiptunes Fantasy** began with music at its core—and its spirit is already growing beyond chiptunes alone—our long-term dream is to build a lasting, playable **historical testimony to both the chiptunes and the demoscene of the home-computer era**.

Today, our **Digital Museum** already documents the tracks, their composers, the soundchips, and the hardware engineers who built them. Looking ahead, we want to expand the Museum into an interactive **Demoscene Effects Encyclopedia**:
*   **Read It, Then Watch It Live:** Every classic technique—from *Copperbars*, *Tech-Tech*, and *Open-Border Rasters* to *Rotozoomers*, *Voxel Hills*, *Vector Balls*, *Metaballs*, *Julia Fractals*, and *Flat-Shaded 3D*—paired directly with its matching **Demo-Scene-Element (DSE)** so visitors can inspect and experience the effect right alongside the historical text.
*   **Evolution of Craftsmanship:** Tracing the historical progression of each effect over time—from early, rough hardware tricks to ever smoother, faster, multi-layered breakthroughs as coders pushed 8-bit and 16-bit machines past their limits.
*   **Origins, Pioneers & Milestones:** Recording **who invented each technique**, **which demo or game showcased it first**, and **on which home computer** (C64, Amiga, Atari ST, and their contemporaries) the breakthrough was born.

---

## 🚀 What's New in v1.6.8

Version 1.6.8 delivers a sweeping **Atari ST 9-Bit Shifter, Timer-B Raster & 3D Visual Overhaul** across **9 Atari DSEs and sprite sheets**, upgrades the **`TrackPresenter` overlay (`v3.2.0`)**, hardens core geometry primitives in **`hardware-constraints.js`**, codifies authentic multi-technique hardware raster rules in **`dse_development_rules.md`**, and expands automated fake-canvas test coverage across Atari DSEs.

### 🟩 Atari ST 9-Bit Shifter & Timer-B Overhaul (9 DSEs + IK+ Sprites)
*   **Timer-B Raster Floors (`AtariLaserGrid` & `AtariPondRipples`):** Upgraded `AtariLaserGrid` with **4×16 Timer-B raster themes** (*Cyber Outrun*, *Synth Sunset*, *Solar Copper*, *Toxic Aurora* + `BLU5` afterglow, `<= 6` colors/scanline), moving shimmer bands, smooth Bresenham 3D waved curves, gapless run-merged perspective rays, converging YM2149 lanes, and `#fcfcfc` twin-core laser sweeps. `AtariPondRipples` gains a 4th *North-Sea Teal* palette (`SEA5`), 3-zone perspective water with liquid-streak dithering, HBL scanline shimmer + YM2149 side wisps, flicker-free continuous twinkling across 24 glints, 3D trough+crest waves, and a transparent Bayer-4×4 floor fade.
*   **3D Solid & Vector Craftsmanship (`AtariFlatShadedTrio`, `AtariBobs`, `WireframeMorph` & `AtariLineRibbons`):**
    *   `AtariFlatShadedTrio` replaces basic primitives with **6 planar-normalized crystal polyhedra** (*Cuboctahedron*, *Rhombic Dodecahedron*, *Square Antiprism*, *5-Sided Crystal*, *Octahedron*, *Hex Bipyramid*), front-hemisphere wrap-Lambert shading, `1 px` specular rims, dark inner crystal cores during explosions, and `climax` opaque silhouette echo-trails with 3D cross-body sorting.
    *   `AtariBobs` (`lissajous-bobs.js`) evolves into a true **3D Lissajous & Knot Bob engine** across 6 formations (*Lissajous*, *Halo*, *Helix*, *Trefoil*, *Ribbon*, *Galaxy*) powered by precomputed **3D raytraced sphere scanline LUTs** (`r = 1..10`, zero `Math.sqrt` per frame), Painter Z-sorting, opaque `climax` echo trails, graded 3-tier chain waves, and cascading Midnight-Chrome afterglow.
    *   `WireframeMorph` adds a counter-rotating **4D Hyper-Core**, Painter Z-sorting across up to 48 edges, theme-matched 3-step opaque trails, `1 px` `INK` drop shadows & parallel bevels, vertex star crosshairs, and a Lissajous figure-8 roaming path.
    *   `AtariLineRibbons` doubles history depth (`8 → 16` slots) with stride-2 airy trail fanning (`3 → 2 → 1`), cohesive anti-collapse rotation geometry, symmetrical `INK` double-head contrast, corner jewels, and `#fcfcfc` hard-beat flashes.
*   **Scenic & Silicon Masterpieces (`AtariRetroSunset`, `ik-fighter-sprites.js` & `YmSiliconBg`):**
    *   `AtariRetroSunset` introduces 10-stop Timer-B raster skies & 5-stop lake reflections, twinkling dusk stars, 3 asymmetric hand-pixeled cloud silhouettes, dual-layer twilight mountain valleys, *Toro* stone lanterns, a curved *Myojin* Torii with straight *Korobi* pillars, a gnarled *Moyogi* S-curve Pine Bonsai with 5 cloud tiers, and an 18-slot falling & courtyard-settling leaf pool—paired with refined leg/kick anatomy across 7 frames in `ik-fighter-sprites.js`.
    *   `YmSiliconBg` enforces a strict `0.55 * h` horizon contract (DIP-40 IC die & 3 oscillators above; perspective Log-DAC & copper bus packets below), 15-color 9-bit silicon palette, true per-voice YM2149F waveforms (4-bit Log-DAC bass, hardware envelope, Sync-Buzzer/PWM) with 10-segment LED peak meters & optional `metrics.regs` tuning, 16-bit LFSR + envelope monitor, and `1.5 s` Bayer fades.

### 🏷️ TrackPresenter v3.2.0 & Registry Timing (`track-presenter.js`, `registry.js`)
*   **Atari ST Timer-B Raster Banner & Rock-Steady Typography:** Extended overlay duration from `3.0 s` to `4.0 s` and locked title/subtitle alignment cleanly centered across all systems (scrolling only when wider than the frame). Redesigned the Atari ST presenter with 4 iconic demoscene themes (*Goldrunner*, *ST Shifter*, *Union*, *Carebears*), a 50 Hz PAL CRT shutter unfold, counter-moving rail glints, stepped 16-bit corner brackets, Copper-split dividers, and symmetrical 3-channel YM2149 raster wings.

### 🔧 Shared Retro Geometry, DSE Rules & Atari Test Suites
*   **Midpoint Circle Parity & Clipping Hardening (`hardware-constraints.js`):** Replaced `Math.sqrt` even-span circles in `fillAliasedCircle` with an exact odd-span integer Midpoint rasterizer matching `drawAliasedCircleOutline` 1:1 (deduplicated octant vertices, optional `clipRect`, plus `*Clipped` aliases), added NaN/bounds guards across palette/geometry helpers, and optimized `transparentDither` polygon fills.
*   **Expanded Hardware Raster Rules (`doc/concepts/dse_development_rules.md`):** Documented system-authentic raster modes (C64 *Hires/Multicolor/FLI*, Amiga *EHB/HAM6/Mid-Scanline Copper*, Atari ST *16-color/scanline + Timer-B/Spectrum-512*), *Bitplane-Index-Addition / Shade-Bobs*, strict `getImageData()` prohibition, and preallocated chunky/C2P `putImageData()` buffer rules.
*   **Automated Fake-Canvas Test Coverage:** Populated `test/atari-bobs.test.mjs` (8 suites), expanded `test/atari-pond-ripples.test.mjs` (`9 → 13` suites), and upgraded `test/ym-silicon-bg.test.mjs` (10 suites) validating strict 9-bit `#fcfcfc` max palettes, `<= 16` scanline color budgets, horizon contracts, `1.5 s` transitions, graded beats, and `fillRect` budgets.

---

## ✨ Core Features & Architecture

### 🎬 Scene-DJ & System-Accurate Demo-Scene Elements (DSEs)
*   **50 Hz PAL Orchestration:** Our `Scene-DJ` monitors channel energies, track novelty, beat strength (`soft` / `medium` / `hard` impulses vs. exact musical beat boundaries), and macro tension (`playing`, `buildup`, `climax`, `afterglow`) to choreograph layered background, floor, foreground, and presenter DSEs—spanning classic *Castles*, *Retro Sunsets*, *Kefrens Checkerboards*, *PETSCII Plasmas*, *C64 Raster Tunnels/Roads*, *Amiga Voxel Hills/Twisters/Vector Balls*, and *Atari ST Timer-B Laser Grids/Pond Ripples/3D Raytraced Bobs/Flat-Shaded Crystals/Julia Cyclers*.
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