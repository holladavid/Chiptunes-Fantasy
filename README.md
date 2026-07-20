# 💾 CHIPTUNES FANTASY (v1.4.0-beta.7)
> **The Ultimate 8-Bit/16-Bit Bare-Metal Music Disk Emulator & Hardware Laboratory**

---

## 🎯 The Vision ("Von Nerds für Nerds")
**Chiptunes Fantasy** is not a simple music player. It is a high-fidelity, real-time emulated music disk that runs entirely in your web browser with 100% hardware accuracy and zero external framework dependencies. We do not play MP3s or pre-recorded audio. We parse genuine, vintage binary tracker formats (`.sid`, `.ym`, `.mod`, `.xm`) and synthesize every single waveform, filter, and envelope on-the-fly using highly optimized, low-latency asynchronous `AudioWorkletProcessors`.

With the **v1.4.0 "Hardware Laboratory"** milestone, Chiptunes Fantasy transitions from a flat visualizer into an immersive, skeuomorphic measurement bay. Users don't just listen—they interact with the operational temperature of physical JFET resistors, watch raw binary data packets flow down copper buses, and observe the precise, mechanical rendering of late 80s demo graphics.

---

## 🎛️ The Three Soundchip Pillars

### 1. MOS Technology SID 6581 (Commodore 64)
Our cycle-exact 1MHz SID engine emulates the ultimate analog synthesizer chip:
*   **6502 CPU Lockstep:** Runs a complete, highly optimized MOS 6502 CPU emulator inside the audio thread to execute original player routines in real time.
*   **Thermal Physical Modeling:** Simulates JFET transistor resistance drift based on real operating temperatures (adjustable from 15°C to 75°C), warping the cutoff frequency and resonance.
*   **Non-Linear Saturation:** Emulates non-linear NMOS triode saturation (`Math.tanh`) and asymmetric clipping, giving the low-end its legendary, warm growl.
*   **Sustain-Drop & Pipeline Delay:** Replicates the historical hardware envelope bugs and the 1-cycle ADSR pipeline delay to guarantee authentic drum "snapping."
*   **Analog Wire-ANDing:** Models the physical signal pull-down and bleeding of illegal combined waveforms.
*   **Analog Combined Waveforms ($30, $50, $60, $70):** Modelliert das diskrete, asymmetrische NMOS-Pull-Down-Verhalten und Sickerströme (Leakage) kombinierter Wellenformen anstelle pauschaler Binär-Mischungen – essenziell für Galways charakteristische Leads.
*   **Historically Accurate Noise Taps:** Nutzt die physisch korrekten 23-Bit-LFSR-Ausgangskontakte (Bits 20, 18, 14, 11, 9, 5, 2, 0) für das originale, seidig glänzende Rauschspektrum.
*   **15-Bit ADSR Rate Counter (Phase-Transition Delay):** Emuliert das freilaufende LFSR-Register, das bei `0x8000` überläuft und die Null überspringt, wodurch die Hüllkurve bei schnellen Rate-Wechseln und Phasenübergängen originalgetreu "hängenbleibt" (Sustain Lock).
*   **Floating DAC Discharge:** Simuliert die kapazitive Ladungsspeicherung der DAC-Gatter beim Deaktivieren aller Wellenformen (Wellenform `$00`), was ein weiches, analoges Ausbluten des Signals über ca. 15,5 ms bewirkt.
*   **VCF Squelch (Filter Memory):** Modelliert das asymmetrische Übersteuerungsverhalten des analogen Addierer-Op-Amps (`hp`), was bei starker Resonanz zu einem dynamischen Pegel-Ausweichen ("Schmatzen") führt.
*   **Volume DAC Bug & VCA Offset:** Bildet die unregelmäßigen 16 Stufen des R-2R-Lautstärke-Wandlers über gemessene Tabellenwerte ab, gekoppelt mit einem dynamisch ansteigenden Gleichspannungs-Offset des Stimmenmischers für knackige prozedurale Trommeln.
*   **Floating Open Bus:** Lesezugriffe auf schreibgeschützte SID-Register spiegeln die kapazitive Trägheit des C64-Datenbusses wider und geben das High-Byte der gerade ausgeführten Befehlsadresse zurück.

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
*   **Digidrum DAC Injection:** Simulates the legendary 4-bit sample-injection hacks by routing PCM samples directly through the logarithmic volume registers.
*   **Dynamic Staging:** Analyzes registers to dynamically pan voices, apply simulated tape-flutter, and inject stereo-delay/reverb on-the-fly.

---

## 🔬 The Hardware Laboratory Paradigm

The user interface represents a physical rack-mount oscilloscope and measurement bay:
*   **Cherry-Switch System Tabs:** Weighted buttons with skeuomorphic 3D bevels, pressed states, and glowing, theme-colored LEDs.
*   **"Living Silicon" Dies:** Modally swapped SVG chip maps showing the active silicon die. Data buses, pins, and filters physically glow, fade, and flicker in exact synchronization with active register writes.
*   **Environmental Sensor Bay:** High-fidelity readouts next to the interactive Temperature Slider track real-time hardware variables (Voltage Sag, thermal noise floor, and transistor Bias drift).
*   **Custom VFD Dropdown:** Custom styled, low-res vacuum fluorescent display terminal selector replacing native browser drop-down boxes.
*   **Fluent Builder Diagnostic Suite:** Entwickler können in der `registry.js` Gimmicks über `.disabled()` vollständig deinstallieren oder über `.exclusive()` isolieren, um das Verhalten einzelner Demo-Szenen-Elemente ohne Störeinflüsse anderer managed Layer zu debuggen.

---

## 🎨 DSE Visuals & The Blitter Philosophy (v1.5.0 Standard)

Every visual Demo-Scene-Element (DSE) is subject to strict rendering limitations to preserve absolute historical authenticity:

1.  **The Retro Blitter:** All GFX layers (background, floor, foreground) render to a tiny, offscreen canvas locked to the exact vertical resolutions of the era (200p for C64/ST, 256p for Amiga). The width scales dynamically with the monitor's aspect ratio to prevent squishing.
2.  **Strictly Aliased (Nearest-Neighbor):** No native browser anti-aliasing is permitted. The low-res buffer is upscaled to high-res screens using crisp nearest-neighbor interpolation (`image-rendering: pixelated;` enforced via CSS).
3.  **Bresenham & Scanline-Filling:** No curves or smooth lines are allowed. We use custom Bresenham line drawers and Scanline circle fillers to ensure every pixel is sharp, solid, and blocky.
4.  **The Alpha-Blending Ban:** In accordance with 80s hardware, we use **zero alpha transparency** on GFX layers. Overlapping objects overwrite pixels opaquely. Transitions utilize mechanical vertical collapses, and inactive channels are hard-gated out (`if (vol < 0.04) continue;`).
5.  **Event-Based Climax & Afterglow:** Visual climaxes are treated as finite, explosive events. After a climax peak (exactly 50% of the active DSE's hold time), the system drops into a calm **Afterglow** (cooldown) state for the remaining 50%, letting the tension bar and graphics slowly decay and breathe.
6.  **Concentric Shading & Highlight Pulsing:** Standard CSS gradients are forbidden. Copperbars and limit-bars use discrete, quantized color lists. Sound volumes expand or compress the white-hot core of the shading palette, keeping the physical bar thickness constant on the screen.
7.  **Deterministic Randomness:** No `Math.random()` inside the 60FPS loop to prevent "modern" noise. We emulate a 23-bit LFSR for SID noise, and use pre-allocated, constructor-shuffled offset arrays for organic water shimmer and starfield dispersion.

---

## ⚡ High-Speed Performance & Zero Allocation
To achieve solid 60FPS visuals and jitter-free audio, the rendering and processing pipelines follow a strict **Zero-Allocation Paradigm**:
*   No objects (`new`, `[]`, `{}`) are instantiated inside the 60Hz visual loops or the 1MHz audio loops to prevent Garbage Collection stutter.
*   All temporary states are cached inside pre-allocated `Float32Arrays`, `Uint8Arrays`, or localized primitive variables.
*   We use bitwise integer math (`| 0`, `& ~1`, `>>`) for high-speed coordinate clamping and clipping.
*   Static visual elements (e.g. diagonal mountain peaks, grid floors) are pre-compiled onto offscreen canvases once on resize and blitted to the GPU in a single `drawImage` pass.

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
*   **SID (C64):** *Commando* (Rob Hubbard), *Wizball* (Martin Galway), *Last Ninja 1 & 2* (Matt Gray / Ben Daglish), *Comic Bakery* (Martin Galway), *Arkanoid* (Martin Galway - first ever PCM sample track in game history!), *Sanxion* & *Crazy Comets* (Rob Hubbard), and *Myth* (Jeroen Tel).
*   **PAULA (Amiga):** *Elysium* (Jester/Sanity - the ultimate 4-channel ProTracker anthem), *Space Debris* (Captain), *Guitar Slinger* (Jogeir Liljedahl), *Agony Intro* (Jochen Hippel), and *Turrican II Title* (Chris Hülsbeck).
*   **YM2149F (Atari ST):** *Thalion Loader* (Jochen Hippel), *Syntax Terror* (Big Alec/Delta Force), *Mega Apocalypse* (Rob Hubbard/Jochen Hippel - brutal 4-bit digidrum injection), *Bionic Commando* (Tim Follin), *Dragonflight* (Jochen Hippel), *Xenon 1-3* (David Whittaker), and his absolute RPG masterpiece *Amberstar 01-20*!