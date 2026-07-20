# 💾 CHIPTUNES FANTASY (v1.4.0)
> **The Ultimate 8-Bit/16-Bit Bare-Metal Music Disk Emulator & Hardware Laboratory**

---

## 🎯 The Vision ("Von Nerds für Nerds")
**Chiptunes Fantasy** is not a simple music player. It is a high-fidelity, real-time emulated music disk that runs entirely in your web browser with 100% hardware accuracy and zero external framework dependencies. 

We do not play MP3s or pre-recorded audio. We parse genuine, vintage binary tracker formats (`.sid`, `.ym`, `.mod`, `.xm`) and synthesize every single waveform, filter, and envelope on-the-fly using highly optimized, low-latency asynchronous `AudioWorkletProcessors`.

### 🌌 Why "Fantasy"?
A real Commodore 64 or Atari ST could *never* play a highly complex tracker routine, calculate a 3D vector star, render a PETSCII plasma, and update an oscilloscope simultaneously—it would have crashed the CPU instantly. 

But memory paints the past grander than it actually was. **This is our Fantasy.**
Every single *Demo-Scene-Element (DSE)* you see on screen is programmed with ruthless historical accuracy (strict hardware palettes, true bit-banged math, zero anti-aliasing). Our `Scene-DJ` then acts as the ultimate virtual orchestrator, taking these isolated, period-accurate effects and layering them into a breathtaking, synchronized demoscene experience that feels *exactly* like our childhood memories.

With the **v1.4.0 "Hardware Laboratory"** milestone, the UI transitions from a flat visualizer into an immersive, skeuomorphic measurement bay. Users don't just listen—they interact with the operational temperature of physical JFET resistors, watch raw binary data packets flow down copper buses, and observe the precise, mechanical rendering of late 80s demo graphics.

*Insert Disk. Inject ROM. Let the analog filters burn.*
---

## 🎛️ The Three Soundchip Pillars

### 1. MOS Technology SID 6581 (Commodore 64)
Our cycle-exact 1MHz SID engine is arguably one of the deepest analogue emulations available on the web:
*   **6502 CPU Lockstep:** Runs a complete, highly optimized MOS 6502 CPU emulator inside the audio thread. It includes a phantom KERNAL OS, perfect memory mapping, and full Open Bus emulation to execute complex custom player routines in real time.
*   **Thermal Physical Modeling:** Simulates JFET transistor resistance drift based on real operating temperatures (adjustable from 15°C to 75°C), warping the cutoff frequency and resonance exactly like a hot studio C64.
*   **The Galway $D418 Bug:** Features a fully non-linear 16-step volume DAC modeled after physical R-2R ladder measurements, saturated by an analog DC-Bias injection. This is what gives Martin Galway's procedural *Arkanoid* digidrums their massive, speaker-shredding crunch.
*   **ADSR Delay Bug (15-Bit Wrap):** Hardware-accurate 15-bit LFSR up-counter wrapping guarantees exact micro-timing delays during phase transitions.
*   **Floating DAC Discharge:** Opaque, analog charge bleeding. When oscillators are muted, the DAC capacitance discharges slowly over ~15.5ms against a floating DC bias, creating incredibly warm, soft note releases.
*   **Filter Squelch:** Simulates the asymmetric clipping of the overworked analog summer op-amp, creating the famous wet "smacking" sound of SID resonance sweeps.

### 2. MOS Technology Paula 8364 (Amiga 500)
A deep emulation of the Amiga’s legendary 4-channel DMA PCM engine:
*   **192kHz Oversampling & ZOH:** Emulates the exact staircase wave-shapes of Paula's non-interpolating Zero-Order Hold (ZOH) DACs, capturing the iconic high-frequency "Amiga Shimmer."
*   **Sinc-FIR Decimation:** Translates the oversampled 192kHz signal back to standard 48kHz using a studio-grade 255-tap polyphase Sinc-FIR filter, eradicating digital aliasing.
*   **L-R-R-L Hard-Panning & Crosstalk:** Rigorously enforces the physical stereo routing of the Amiga motherboard, including a 3.5% inductive trace crosstalk.
*   **Dual Analog Filtering:** Replicates the permanent 1-pole RC low-pass filter (4.42kHz) and the interactive, switchable 2-pole LED Butterworth filter (3.09kHz).

### 3. Yamaha YM2149F (Atari ST)
A cycle-exact 2MHz emulation of the ST's Programmable Sound Generator (PSG):
*   **32-Step Logarithmic DAC:** Replicates the exact, measured voltage steps (-1.5dB per step) of the physical logarithmic D/A converter.
*   **Hardware Envelope Generator (HEG):** Accurate 5-bit envelope shaping for butter-smooth "zipper" noise and volume sweeps.
*   **Digidrum DAC Injection:** Simulates the legendary Jochen Hippel 4-bit sample-injection hacks by routing PCM samples directly through the logarithmic volume registers.
*   **Dynamic Staging:** Analyzes registers to dynamically pan voices, apply simulated tape-flutter, and inject stereo-delay/reverb on-the-fly.

---

## 🎨 DSE Visuals & The Blitter Philosophy 

Every visual Demo-Scene-Element (DSE) is subject to strict rendering limitations to preserve absolute historical authenticity:

1.  **The Retro Blitter:** All GFX layers (background, floor, foreground) render to a tiny, offscreen canvas locked to the exact vertical resolutions of the era (200p for C64/ST, 256p for Amiga). The width scales dynamically with the monitor's aspect ratio to prevent squishing.
2.  **Strictly Aliased (Nearest-Neighbor):** No native browser anti-aliasing is permitted. The low-res buffer is upscaled to high-res screens using crisp nearest-neighbor interpolation (`image-rendering: pixelated;` enforced via CSS).
3.  **Bresenham & Scanline-Filling:** No curves or smooth lines are allowed. We use custom Bresenham line drawers and Scanline circle fillers to ensure every pixel is sharp, solid, and blocky.
4.  **The Alpha-Blending Ban:** In accordance with 80s hardware, we use **zero alpha transparency** on GFX layers. Overlapping objects overwrite pixels opaquely. Transitions utilize mechanical vertical collapses, and inactive channels are hard-gated out.
5.  **Deterministic Randomness:** No `Math.random()` inside the 60FPS loop to prevent "modern" noise. We emulate a 23-bit LFSR for SID noise, and use pre-allocated, constructor-shuffled offset arrays for organic water shimmer and starfield dispersion.

---

## ⚡ High-Speed Performance & Zero Allocation
To achieve solid 60FPS visuals and jitter-free audio, the rendering and processing pipelines follow a strict **Zero-Allocation Paradigm**:
*   No objects (`new`, `[]`, `{}`) are instantiated inside the 60Hz visual loops or the 1MHz audio loops to prevent Garbage Collection stutter.
*   All temporary states are cached inside pre-allocated `Float32Arrays`, `Uint8Arrays`, or localized primitive variables.
*   We use bitwise integer math (`| 0`, `& ~1`, `>>`) for high-speed coordinate clamping and clipping.
*   A dedicated **1Hz Diagnostics Dispatcher** allows real-time CPU telemetry without compromising thread performance.

---

## 📂 Repository Structure
*   `/tracks/` - Binary tracker playlists and format parsers (`sid-parser.js`, `mod-parser.js`, `ym-parser.js`).
*   `/css/` - Tactile skeuomorphic stylesheet featuring responsive `clamp()` designs and CPU-level nearest-neighbor filters.
*   `/js/worklets/` - Asynchronous, low-latency `AudioWorkletProcessors` running CPU-exact lockstep emulation.
*   `/js/visuals/` - The standardized `Demo-Scene-Elements` (DSEs) and the central, render-free `Scene-DJ` coordinator.
*   `/js/ui/` - Skeuomorphic HUD registers, "Living Silicon" strategies, and environmental diagnostics.

---

## 🛠️ Installation & Local Playback
Because the emulator relies on ES6 Modules and native `AudioWorklet` threads, you must run it through a local web server (loading directly from `file://` is blocked by browser CORS security policies).

### Quickstart (No installation needed if Python or NodeJS is present):
**Using NodeJS:**
```bash
npx serve .
```

**Using Python:**
```bash
python3 -m http.server 8080
```
Then, open your browser and navigate to `http://localhost:8080` (or the port specified).

---

## 🎼 Curated Masterpiece Playlist
Chiptunes Fantasy includes a carefully curated showcase of legendary tracks, demonstrating the absolute peak of 80s/90s chiptune composition:
*   **SID (C64):** *Commando* (Rob Hubbard), *Wizball* (Martin Galway), *Last Ninja 1 & 2* (Matt Gray / Ben Daglish), *Comic Bakery* (Martin Galway), *Arkanoid* (Martin Galway - procedural $D418 digidrums!), *Sanxion* & *Crazy Comets* (Rob Hubbard).
*   **PAULA (Amiga):** *Elysium* (Jester/Sanity - the ultimate 4-channel ProTracker anthem), *Space Debris* (Captain), *Guitar Slinger* (Jogeir Liljedahl), *Agony Intro* (Jochen Hippel), and *Turrican II Title* (Chris Hülsbeck).
*   **YM2149F (Atari ST):** *Thalion Loader* (Jochen Hippel), *Syntax Terror* (Big Alec/Delta Force), *Mega Apocalypse* (Rob Hubbard/Jochen Hippel - brutal 4-bit digidrum injection), *Bionic Commando* (Tim Follin), *Dragonflight* (Jochen Hippel), and his absolute RPG masterpiece *Amberstar*.