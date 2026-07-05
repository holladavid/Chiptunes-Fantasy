---

# Chiptunes Fantasy

### The Ultimate 8-Bit/16-Bit Bare-Metal Music Disk Emulator
**Version 1.2.0-beta [The Scene-DJ Cycle]**

Built with 100% vanilla HTML5, CSS3, and modern Web Audio API. No MP3s, no pre-rendered streams — just pure mathematical real-time synthesis running asynchronously inside low-latency AudioWorklets.

---

## 🚀 The Vision & Philosophy

*Chiptunes-Fantasy* exposes the guts of retro-computing hardware in real-time, explaining the physics, honoring the coders of the 80s/90s, and educating the curious. 

### The Dual-Constraint Design Philosophy (v1.2.0+)
1. **Bare-Metal Fidelity Per Element:** Each individual **Demo-Scene-Element (DSE)** is engineered to strictly fit the visual and performance boundaries of its target retro platform. If it's a C64 element, it strictly adheres to the 16-color VIC-II palette and chunky pixel scrolling. If it's Atari ST, it respects the 16-color 9-bit palette steps and sharp raster interrupt bands.
2. **Modern Composited Power:** While each individual element is authentic, the *Demoscene-Sequencer* is allowed to stack, crossfade, and swap these layers dynamically. This modern multi-layer orchestration is designed to leverage modern CPU/GPU capabilities to create a seamless, high-fidelity experience that wouldn't have been possible on a single physical machine.

---

## 📺 Demoscene Orchestration (The Scene-DJ Engine)

With the **v1.2.0-beta** milestone, we introduce the foundational **Demoscene-Sequencer (DSS)**, which takes visual control away from hardcoded rendering loops and introduces rule-based, dynamic orchestrations.

### 1. The Demoscene-Sequencer (DSS) / "Scene-DJ"
The `SceneDJ` acts as a pure, render-free logical coordinator. It analyzes real-time audio streams (RMS energy and transients) and dynamically manages the lifecycle states of active visual elements. 
*   **Weighted Roulette Selection:** Instead of absolute probabilities, the DJ uses a relative weighting system (`weight`) to roll for the next visual theme. 
*   **Crossfade Swapping:** When swapping elements, the outgoing element smoothly fades out (`stopping`), while the incoming alternative fades in (`starting`) simultaneously over a 1.5-second window.
*   **Play-Safe Hysteresis:** The DJ monitors the minimum playtime (`minPlayTime`, standard 15s) of active DSEs. It also protects high-energy sections, only allowing swaps during calm (`playing` or `buildup`) phases.
*   **Wake-Up Rolls:** When unpausing the player (`idle` $\to$ active), the DJ instantly discards non-permanent elements and rolls a fresh visual canvas.

### 2. Demo-Scene-Element (DSE) & Centralized Registry
All demoscene visual effects are decoupled into highly encapsulated classes under `js/visuals/dse/` and registered inside `js/visuals/dse/registry.js`. 
Every DSE implements a strict state-machine contract:
*   `idle`: Deep sleep state (0% CPU footprint, early returns in loops).
*   `starting`: Transparent fade-in.
*   `playing`: Normal base behavior.
*   `buildup`: Fast-paced, expanded orbital amplitude.
*   `climax`: Peak intensity (strobe effects, physics distortion, beat-throbbing).
*   `stopping`: Transparent fade-out.

### 3. Integrated Tension Meter (Limit Break)
Represented by the borderless, highly-reactive `LimitBar` DSE (which is automatically locked via `minPlayTime: Infinity`). It faddishly appears only when music tension is present.
*   **The Math:** Accumulates tension via `power = (energy * 0.5) + (pulse * 2.0)`. During high-energy `Overdrive` frames, accumulation is boosted `4x` (Atari ST gets an additional `1.5x` boost, C64 `1.2x` boost).
*   **The Lock:** Once `tension` hits maximum, it locks into `climax` and holds. The hold timer only ticks down when the track falls back to `buildup`, visually draining the bar backwards while keeping the surrounding DSE animations at maximum intensity.
*   **System-Themed Visuals:** 
    *   *C64*: Blocky, chunky VIC-II segmented layout framed by moving rasterbars.
    *   *Amiga*: Workbench 2.0-style 3D bevels with smooth horizontal Copper-gradients.
    *   *Atari ST*: Authentic sharp-pixel, 16-color VU-meter layout with neon-vector glitches.

---

## 🎛️ Core Chip Factsheet (Simplified)

### MOS Technology SID 6581 (Commodore 64)
*   **Lockstep Core:** 1MHz cycle-exact synchronization between the CPU, registers, and CIA/VBLANK timers.
*   **Decimation:** 255-Tap Polyphase Sinc-FIR decimator preventing high-frequency foldback.
*   **Analog Anomalies:** Asymmetric JFET filter saturation, thermal cutoff drift manual slider, and true silicon Wire-AND logic for combined wave states.

### MOS Paula 8364 (Amiga 500)
*   **ZOH oversampling:** 192kHz (4x) oversampled Zero-Order Hold DAC reproducing the physical "Amiga Shimmer".
*   **Filters:** 6dB RC lowpass (4.42 kHz) and 12dB Butterworth LED filter (3.09 kHz).
*   **Stereo Separation:** Hard L-R-R-L panning mitigated by 3.5% inductive motherboard crosstalk.

### Yamaha YM2149F (Atari ST)
*   **Clock lockstep:** 2MHz execution of Tone, Noise, and Envelope generators.
*   **Logarithmic DAC:** True 32-step logarithmic DAC ladders (`(v * 2) + 1` mapping).
*   **Digital Tricks:** Zero-click PCM Digidrum isolation, discrete 5-bit hardware envelope loop-logic.

---

## 📺 Tactile Hardware UI & GFX

*   **Cathode-Ray Oscilloscope:** Phosphor-accumulation buffer simulating genuine CRT electron beam glow, electromagnetic flares, and transient spark particles.
*   **VFD Spectrum Analyzer:** Vacuum Fluorescent Display with grid-snapped peak-hold gravity calculations.
*   **Subdued Fullscreen Remote:** A highly-unobtrusive DOM-overlay overlaying the canvas in fullscreen mode (`opacity: 0.3` on hover, faddishly disappearing completely when the mouse is idle).

---
