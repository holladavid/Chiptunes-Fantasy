# Chiptunes Fantasy

### The Ultimate 8-Bit/16-Bit Bare-Metal Music Disk Emulator
**Version 1.2.0 [The Scene-DJ Cycle]**

Built with 100% vanilla HTML5, CSS3, and modern Web Audio API. No MP3s, no pre-rendered streams — just pure mathematical real-time synthesis running asynchronously inside low-latency AudioWorklets.

---

## 🚀 The Vision & Philosophy

*Chiptunes-Fantasy* exposes the guts of retro-computing hardware in real-time, explaining the physics, honoring the coders of the 80s/90s, and educating the curious. 

### The Dual-Constraint Design Philosophy
1. **Bare-Metal Fidelity Per Element:** Each individual **Demo-Scene-Element (DSE)** is engineered to strictly fit the visual and performance boundaries of its target retro platform (e.g., adhering strictly to the 16-color VIC-II palette or Atari ST raster limits).
2. **Modern Composited Power:** While each individual element is authentic, the *Demoscene-Sequencer* stacks, crossfades, and swaps these layers dynamically. This modern orchestration leverages CPU/GPU capabilities to create a seamless, high-fidelity experience that wouldn't have been possible on a single physical machine.

---

## 📺 Demoscene Orchestration (The Scene-DJ Engine)

With the **v1.2.0** milestone, we introduced the **Demoscene-Sequencer (DSS)**, which takes visual control away from hardcoded rendering loops and introduces rule-based, dynamic orchestrations using an Entity-Component-System (ECS) architecture.

### 1. The Modular Scene-DJ (ECS Architecture)
The `SceneDJ` acts as a pure, render-free logical coordinator, relying on Unidirectional State Syncing (`playbackSessionId`) to manage audio context. Its logic is split into highly specialized zero-allocation skills:
*   **TrackMonitor:** Translates raw channel volumes into filtered DSP metrics (`masterEnergy`, `transientPulse`, and an exponential `beatEnvelope`).
*   **TensionManager (Macro-Dynamics):** Evaluates track progression (`idle`, `playing`, `buildup`, `climax`) based on a simulated tension accumulator rather than hardcoded timers.
*   **SetlistManager (Crate Digger):** Uses a weighted roulette-wheel algorithm (`metadata.weight`) to dynamically swap DSEs. It enforces a *Black-Screen Protection* protocol via `VoidElement` placeholders.
*   **StageManager:** Manages flawless visual crossfades (`starting` -> `stopping`) and exact Z-Order placement (`background`, `floor`, `foreground`, `overlay`).

### 2. Demo-Scene-Element (DSE) Arsenal
Visual effects are fully decoupled classes inside `js/visuals/dse/` and registered via a strict schema-validated contract (`registry.js`).
*   **LimitBar (Tension Meter):** A borderless, system-themed gauge that accumulates RMS tension and visually locks into an overdrive state during the track's climax, flashing exactly to the kick-drum beat.
*   **Retro Sunset:** An *IK+* inspired, system-accurate background (C64 chunky pixels, Amiga copper-sine waves, Atari ST 16-color dithering & raster lines).
*   **Universal Starfield:** The classic warp starfield, now universally available with system-specific rendering logic (sharp vector dots vs. soft sub-pixel glow).
*   **Legacy DSEs:** Helix Copperbars, Amiga Glenz Cube, and Atari Lissajous Bobs updated with micro-dynamic beat responsiveness and continuous math smoothing.

---

## 🔮 Roadmap: Looking ahead to v1.3.0 [The Visual Expansion]

With the bulletproof ECS architecture and zero-allocation Scene-DJ established in v1.2.0, the upcoming **v1.3.0** release cycle will focus entirely on **content generation and visual expansion**. 

Expect a massive influx of new, hardware-authentic Demo-Scene-Elements (DSEs) across all placement layers — think C64 Plasma effects, Amiga Moiré patterns, Atari 3D Vector worlds, and parallax scrollers. We will also further refine the Scene-DJ's orchestration logic to direct these new visual actors with even greater musical precision, fully utilizing the newly created plug-and-play DSE registry.

---

## 🎛️ Core Chip Factsheet

*   **MOS Technology SID 6581 (Commodore 64):** 1MHz cycle-exact lockstep. Features a 255-Tap Polyphase Sinc-FIR decimator, asymmetric JFET filter saturation, and true silicon Wire-AND logic.
*   **MOS Paula 8364 (Amiga 500):** 192kHz (4x) oversampled Zero-Order Hold DAC reproducing the physical "Amiga Shimmer". Authentic 6dB RC and 12dB Butterworth LED filtering.
*   **Yamaha YM2149F (Atari ST):** 2MHz lockstep. True 32-step logarithmic DAC ladders. Features **True 8-Bit Linear PCM Simulation** that bypasses the log-DAC for Jochen Hippel-style high-fidelity digidrum injection.

---

## 📺 Tactile Hardware UI & GFX

*   **Unobtrusive Fullscreen UI:** A sleek, DOM-based overlay for playback controls and track metadata that faddishly disappears alongside the mouse cursor to maintain demoscene focus.
*   **Interactive HUD:** A highly detailed DSP matrix debugger featuring tactile, skeuomorphic interactive LEDs (like the enlarged Amiga Power Filter bypass) that auto-fades in fullscreen mode.
*   **Logo Breathing Glow:** The main logo emits a system-colored CSS radial glow indicating the active demoscene status.