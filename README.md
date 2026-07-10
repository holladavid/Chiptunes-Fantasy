# Chiptunes Fantasy

### The Ultimate 8-Bit/16-Bit Bare-Metal Music Disk Emulator
**Version 1.3.0-beta.3 🌀 The Responsive Sync**

Built with 100% vanilla HTML5, CSS3, and modern Web Audio API. No MP3s, no pre-rendered streams — just pure mathematical real-time synthesis running asynchronously inside low-latency AudioWorklets.

---

## 🚀 The Vision & Philosophy

*Chiptunes-Fantasy* exposes the guts of retro-computing hardware in real-time, explaining the physics, honoring the coders of the 80s/90s, and educating the curious. 

### The Dual-Constraint Design Philosophy
1. **Bare-Metal Fidelity Per Element:** Each individual **Demo-Scene-Element (DSE)** is engineered to strictly fit the visual and performance boundaries of its target retro platform (e.g., adhering strictly to the 16-color VIC-II palette, Atari ST 9-bit limits, or Amiga OCS 12-bit stepping).
2. **Modern Composited Power:** While each individual element is authentic, the *Demoscene-Sequencer* stacks, crossfades, and swaps these layers dynamically. This modern orchestration leverages CPU/GPU capabilities to create a seamless, high-fidelity experience that wouldn't have been possible on a single physical machine.

---

## 📺 Demoscene Orchestration (The Scene-DJ Engine)

The **Demoscene-Sequencer (DSS)** orchestrates dynamic, rule-based visual choreographies using an Entity-Component-System (ECS) architecture. 

With the **v1.3.0** milestone, the engine introduces the **Retro Blitter**, a strict internal offscreen buffer running at historical resolutions (e.g., 200p / 256p). All elements are rendered without HTML5 Canvas sub-pixel anti-aliasing or modern alpha blending, before being upscaled to modern 4K/1080p displays using flawless Nearest-Neighbor scaling for true chunky pixels.

### 1. The Modular Scene-DJ (ECS Architecture)
*   **TrackMonitor:** Translates raw channel volumes into filtered DSP metrics (`masterEnergy`, `transientPulse`, and an exponential `beatEnvelope`).
*   **TensionManager:** Evaluates track progression (`idle`, `playing`, `buildup`, `climax`) based on a simulated tension accumulator.
*   **SetlistManager:** Dynamically swaps DSEs using a weighted roulette algorithm.
*   **StageManager:** Manages visual crossfades (`starting` -> `stopping`) and absolute Z-Order placement.

### 2. Demo-Scene-Element (DSE) Arsenal
Visual effects are decoupled, hardware-constrained classes injected dynamically by the Scene-DJ.
*   **Track Presenter:** A new ECS *One-Shot* overlay that elegantly slides in to display track metadata upon song change, self-destructing after 8 seconds.
*   **C64 Chunky Plasma:** A mathematical PETSCII-style plasma locked strictly to the 16-color VIC-II palette with beat-reactive color cycling.
*   **Amiga Kefrens Checkerboard:** The iconic infinite zooming 3D floor, featuring scanline-based perspective math and strict 12-bit Copper Z-depth banding.
*   **Atari Wireframe Morph:** A CPU-driven 3D polygon morphing from a cube to a stellated octahedron, drawn with our custom Bresenham algorithm to prevent sub-pixel line blurring.
*   **Legacy DSEs Refined:** `Retro Sunset`, `Starfield`, `LimitBar`, `AmigaCube`, and `AtariBobs` have all been strictly quantized to their respective hardware color spaces and cleared of illegal `rgba()` alpha-blending.

### 3. Strict Hardware Constraints & Math Rendering (v1.3.0 Additions)
*   **The Retro Blitter:** All Demo-Scene-Elements are now isolated to render into a constrained low-res offscreen buffer (`200p` for C64/Atari, `256p` for Amiga). The buffer is upscaled via Nearest-Neighbor (`imageSmoothingEnabled = false`), resulting in crisp, authentic chunky pixels.
*   **Bypassing Canvas AA:** Standard vector paths (`ctx.arc()`, `ctx.stroke()`) are banned. All outlines use a custom JS-Bresenham algorithm (`drawAliasedLine`), and circles are filled line-by-line via scanline calculation (`fillAliasedCircle`).
*   **Grid-Snapped Subpixel-Killers:** All coordinates, widths, and heights passed to `fillRect` are dynamically integer-floored to prevent the browser from blurring moving edges.
*   **Dynamic Frustum Recycling:** An advanced clipping optimization in the 3D Starfield that recycles star coordinates the millisecond they cross the 2D screen boundary, keeping active star density at 100% capacity.
*   **One-Shot Metadata Presenter:** A specialized `presenter` overlay layer that slides in upon song changes and auto-destructs using ECS lifecycle bindings.

### 3. Strict Hardware Constraints & Math Rendering (v1.3.0 Additions)
*   **The Retro Blitter:** All Demo-Scene-Elements are now isolated to render into a constrained low-res offscreen buffer (`200p` for C64/Atari, `256p` for Amiga). The buffer is upscaled via Nearest-Neighbor (`imageSmoothingEnabled = false`), resulting in crisp, authentic chunky pixels.
*   **Bypassing Canvas AA:** Standard vector paths (`ctx.arc()`, `ctx.stroke()`) are banned. All outlines use a custom JS-Bresenham algorithm (`drawAliasedLine`), and circles are filled line-by-line via scanline calculation (`fillAliasedCircle`).
*   **Grid-Snapped Subpixel-Killers:** All coordinates, widths, and heights passed to `fillRect` are dynamically integer-floored to prevent the browser from blurring moving edges.
*   **Dynamic Frustum & Radial Recycling:** An advanced clipping optimization in the 3D Starfield that recycles star coordinates the millisecond they cross the visible 2D screen boundary. For rotating fields (Atari ST), the system shifts to Radial Bounding Circle culling, preventing empty corners during rolls.
*   **Aspect-Ratio Safe Pathing:** Star generation boundaries, 3D scales, and water dashes scale dynamically using `minDim = Math.min(width, height)`. Horizontal element thicknesses scale proportionally using `Math.min(1.0, width / height)` to prevent block distortion on portrait screens.
*   **Dynamic Text Truncation (`measureText`):** The TrackPresenter uses native Canvas `ctx.measureText` API measurements recursively to dynamically truncate text to fit the viewport padding, overriding platform-specific webfont metric discrepancies.
*   **Global Inactivity Fading:** Implemented `.user-inactive` state to fade the collapsed HUD globally after 3 seconds of inactivity in both windowed and fullscreen modes, keeping the viewport clean.