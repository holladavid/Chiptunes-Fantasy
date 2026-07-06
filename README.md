# Chiptunes Fantasy

### The Ultimate 8-Bit/16-Bit Bare-Metal Music Disk Emulator
**Version 1.2.0-beta.2 [The Scene-DJ Cycle]**

Built with 100% vanilla HTML5, CSS3, and modern Web Audio API. No MP3s, no pre-rendered streams — just pure mathematical real-time synthesis running asynchronously inside low-latency AudioWorklets.

---

## 🚀 The Vision & Philosophy

*Chiptunes-Fantasy* exposes the guts of retro-computing hardware in real-time, explaining the physics, honoring the coders of the 80s/90s, and educating the curious. 

### The Dual-Constraint Design Philosophy
1. **Bare-Metal Fidelity Per Element:** Each individual **Demo-Scene-Element (DSE)** is engineered to strictly fit the visual and performance boundaries of its target retro platform. If it's a C64 element, it strictly adheres to the 16-color VIC-II palette. If it's Atari ST, it respects the 16-color constraints and sharp raster interrupt bands.
2. **Modern Composited Power:** While each individual element is authentic, the *Demoscene-Sequencer* stacks, crossfades, and swaps these layers dynamically. This modern orchestration leverages modern CPU/GPU capabilities to create a seamless, high-fidelity experience that wouldn't have been possible on a single physical machine.

---

## 📺 Demoscene Orchestration (The Scene-DJ Engine)

With the **v1.2.0** milestone, we introduced the **Demoscene-Sequencer (DSS)**, which takes visual control away from hardcoded rendering loops and introduces rule-based, dynamic orchestrations using zero-allocation arrays.

### 1. The Demoscene-Sequencer (DSS) / "Scene-DJ"
The `SceneDJ` acts as a pure, render-free logical coordinator. It utilizes **Unidirectional State Syncing** to analyze real-time audio streams and route lifecycle states to active visual elements.
*   **Weighted Roulette Selection:** The DJ uses a relative weighting system (`weight`) to roll for the next visual theme, allowing dynamic layer swapping while preserving visual harmony.
*   **Black Screen Protection:** A `VoidElement` placeholder ensures the DJ can periodically clear layers for visual breathing room, while a fail-safe mechanism guarantees the screen is never entirely empty.
*   **Immediate Wake-Up Routing:** When unpausing the player, the DJ instantly discards non-permanent elements and rolls a fresh visual canvas.

### 2. Demo-Scene-Element (DSE) & Centralized Registry
All demoscene visual effects are decoupled into highly encapsulated classes under `js/visuals/dse/` and registered inside `js/visuals/dse/registry.js`. 
Every DSE implements a strict, lower-case state-machine contract:
*   `idle`: Deep sleep state (0% CPU footprint, early returns).
*   `starting`: Transparent fade-in.
*   `playing`: Normal base behavior.
*   `buildup`: Increased speed and tension.
*   `climax`: Peak intensity (strobe effects, physics distortion, beat-throbbing).
*   `stopping`: Transparent cross-fade out.

### 3. Integrated Tension Meter (Limit Break)
Represented by the borderless, highly-reactive `LimitBar` overlay. It dynamically scales its width and fades in only when music tension is present.
*   **Macro vs. Micro Dynamics:** 
    *   *Tension (Macro):* Accumulates over time based on RMS energy. Reaching maximum tension naturally locks the engine into `climax` mode.
    *   *Beat Envelope (Micro):* Zero-allocation exponential decay curve capturing raw transients (kicks/snares) to drive instantaneous visual pumping and border strobing.
*   **System-Themed Visuals:** 
    *   *C64*: Blocky, chunky VIC-II segmented layout framed by moving rasterbars.
    *   *Amiga*: Workbench 2.0-style 3D bevels with smooth horizontal Copper-gradients.
    *   *Atari ST*: Authentic sharp-pixel, 16-color VU-meter layout with neon-vector glitches.

---

## 🎛️ Core Chip Factsheet (Simplified)

*   **MOS Technology SID 6581 (Commodore 64):** 1MHz cycle-exact lockstep. Features a 255-Tap Polyphase Sinc-FIR decimator, asymmetric JFET filter saturation, and true silicon Wire-AND logic.
*   **MOS Paula 8364 (Amiga 500):** 192kHz (4x) oversampled Zero-Order Hold DAC reproducing the physical "Amiga Shimmer". Authentic 6dB RC and 12dB Butterworth LED filtering.
*   **Yamaha YM2149F (Atari ST):** 2MHz lockstep. True 32-step logarithmic DAC ladders. **True 8-Bit Linear PCM Simulation** bypasses the log-DAC for Jochen Hippel-style high-fidelity digidrum injection.

---

## 📺 Tactile Hardware UI & GFX

*   **Cathode-Ray Oscilloscope:** Phosphor-accumulation buffer simulating genuine CRT electron beam glow, electromagnetic flares, and transient spark particles.
*   **Unobtrusive Fullscreen UI:** A sleek, DOM-based overlay for playback controls and track metadata that faddishly disappears alongside the mouse cursor to maintain demoscene focus.
*   **Interactive HUD:** A highly detailed DSP matrix debugger featuring tactile, skeuomorphic interactive LEDs (like the Amiga Power Filter bypass).