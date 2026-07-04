# Chiptunes Fantasy

The Ultimate 8-Bit/16-Bit Bare-Metal Music Disk Emulator. Built with 100% vanilla HTML5, CSS3, and modern Web Audio API. 

No MP3s, no pre-rendered streams — just pure mathematical real-time synthesis running asynchronously inside low-latency AudioWorklets.

---

> **🎉 MILESTONE REACHED: VERSION 1.1.1 [The Fine-Tuning Cycle]**  
> We have officially hit **Version 1.1.1**! Following the visual overhaul in v1.1, this patch cycle brings mathematically perfect 3D phase-staggered helix-coppers, smooth RGB phosphor-blending on the oscilloscope, authentic 12-bit Amiga tab styling, and massive contrast and touch-spacing usability upgrades for our veteran sceners.

---

## 🚀 The Vision & Tribute
This project is a love letter to the audio wizards of the 80s and 90s — legends like Jochen Hippel (Mad Max), Rob Hubbard, Chris Hülsbeck, Martin Galway, and Jeroen Tel. They didn't just compose music; they hacked the hardware. They abused CPU timers, manipulated pulse widths, and wrote their own assembly drivers to make simple programmable sound generators sound like entire orchestras.

*Chiptunes-Fantasy* makes these genius programming tricks tangible. We don't just play the music; we expose the guts of the hardware in real-time, honoring the artists, explaining the physics, and educating the nerds.

## 📺 Demoscene Visuals & UX

*   **C64 Cold Boot:** The app launches with a mathematically authentic, pixel-perfect Commodore 64 basic CRT cold-boot sequence.
*   **Interactive Demoscene Easter Eggs:** Click the main logo to swap the clinical lab-scope for real-time, system-specific 3D demoscene effects:
    *   *Amiga:* A rotating 3D "Glenz" glass vector cube featuring real-time backface culling, Z-centroid Painter's Algorithm, and audio-reactive blooming outlines.
    *   *Atari ST:* A swarm of pre-rendered, 3D-shaded metallic spheres (Blitter Bobs) weaving through endless Lissajous knots that pulse to the beat.
    *   *C64:* A 3D parallax starfield with velocity-based motion blur streaks quantized strictly to the original 16-color Commodore VIC-II palette.
*   **Physical CRT Oscilloscope:** Simulates an authentic cathode-ray tube using an offscreen accumulation buffer for true exponential phosphor decay. The beam features dynamic intensity modulation, electromagnetic flares, and throws glowing, cooling phosphor sparks across the screen on sharp audio transients.
*   **Segmented VFD Analyzer:** A system-themed, tri-color Vacuum Fluorescent Display spectrum analyzer. Features a studio-grade "Peak Hold" logic that perfectly snaps to the physical LED grid gaps.
*   **3D Helix Copperbars:** Rasterbars orbit each other using true 3D Z-buffer sorting and depth shading. Features historic scanline quantization and color banding (12-bit Amiga OCS, 9-bit Atari ST, chunky 16-color C64).
*   **Tactile Hardware UI:** Volume and timeline sliders are designed as deeply recessed, shadow-milled hardware grooves. The track selector mimics an authentic 90s DOS/Tracker terminal with inverted-color block selection and a blinking hardware cursor.
*   **DSP Debug HUD:** A real-time debugger showing register matrices, custom state LEDs (like the Amiga power-filter LED or YM Digidrum activity), and sparkline mini-scopes per channel.
*   **Pure Audio (ECO) Mode:** Completely halts the Canvas loop, pauses all CSS animations, and locks the screen wake state to save battery on mobile devices while continuing pure AudioWorklet synthesis.

## 🎛️ Core Emulation Features

### 💻 Commodore 64 (MOS SID 6581)
*   **1MHz Cycle-Exact Lockstep Core:** The 6502 CPU, SID registers, and CIA/VBLANK IRQ timers execute in perfect chronological synchronicity on a clock-by-clock basis (985248 Hz PAL).
*   **255-Tap Polyphase Sinc-FIR Decimator:** Custom windowed Sinc downsampling replaces naive averaging, eliminating high-frequency foldback aliasing on hard-sync leads and preserving raw high-end brilliance.
*   **Asymmetric JFET Filter Saturation:** Modeling the non-linear triode region of the original 6581 VCF feedback path for that warm, resonant "Wizball-Growl".
*   **Sustain-Drop & Pipeline Delay:** True hardware envelope emulation replicating the 1-cycle pipeline freeze on gate toggles and the infamous sustain target-miss bug.
*   **True Analog Wire-AND:** Simulates the pull-down transistor resistance on the 12-bit digital bus when combining waveforms, bringing back the dirty, iconic crunch of mixed states (essential for *Maniacs of Noise* tracks).
*   **Thermal Cutoff Drift:** Live physical modeling of the analog filter temperature drift, manually adjustable via the UI temperature slider.

### 🐨 Commodore Amiga (MOS Paula 8364)
*   **192kHz (4x) Oversampled ZOH DAC:** Samples are rendered as raw analog stair-steps (Zero-Order Hold) at 192 kHz. This preserves the high-frequency mirror images (the legendary "Amiga Shimmer") in the ultrasonic domain before filtering, preventing digital foldback.
*   **Sinc-FIR Decimation:** Smoothly and cleanly downsamples the internal 192 kHz high-res stream to 48 kHz for the audio destination.
*   **High-Res Analog Filter Chain:** The 6dB RC lowpass (4.42 kHz) and the 12dB Butterworth LED filter (3.09 kHz) are calculated directly in the 192 kHz domain to accurately smooth the physical ZOH stair-steps.
*   **100% Hard-Panning & Crosstalk:** Rejects modern software panning commands to enforce the brutal hardware-wired L-R-R-L panning configuration, softened only by a 3.5% inductive motherboard crosstalk.
*   **DMA Word Alignment:** Replicates Paula's 16-bit DMA memory fetches by strictly masking all loop boundaries and sample offsets to even byte boundaries (`& ~1`).

### 🦎 Atari ST (Yamaha YM2149F)
*   **2MHz True Lockstep Core:** Cycle-accurate execution of the Tone (toggle every 8*TP), Noise (shift every 16*NP), and Envelope (step every 8*EP) generators on a 2.0 MHz clock.
*   **32-Step Logarithmic DAC:** Fully emulates the YM2149F's internal 32-step DAC ladder (-1.5dB per step) by translating 4-bit register volume to 5-bit DAC via `(v * 2) + 1` for smoother volume sweeps and authentic "Zipper-Noise".
*   **Zero-Click Hijack Isolation:** Captures PCM Digidrums and completely isolates them from the volume registers to prevent 50Hz DC-popping, holding the DAC state on completion.
*   **Combinational Envelope Logic:** Renders the 5-bit envelope without artificial "flat-spot" loop delays at the peaks and troughs.
*   **Atari ST Motherboard RC Filter:** Simulates the thin, biting frequency response of the Atari ST's physical output stage.

## 🏗️ Architecture
The engine is highly modular. Visual elements are decoupled into clean ES6 classes and you can easily plug in new hardware simulator cores or add new binary parsers.

```mermaid
graph TD
    subgraph UI [1. User Interface & Controls]
        A[Playlists, Volume, Custom Sliders & Museum]
    end

    subgraph PARSE [2. Binary Decoders]
        B[Parsers for raw .sid, .ym, .mod and .xm files]
    end

    subgraph SYNTH [3. Real-Time Synthesis]
        C[Low-latency AudioWorklets: SID, Paula & YM Cores]
    end

    subgraph VIS [4. Visual Feedback & GFX]
        D[FFT Spectrum, CRT Oscilloscope & live DSP HUD]
    end

    %% Signal & Data Flow
    A -->|User Selection| B
    B -->|Register Frames| C
    C ==>|16-Bit Audio Signal| Speaker((🔊 Speaker))
    C -.->|Wave & Metric Dumps| D