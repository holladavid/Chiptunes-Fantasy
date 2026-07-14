# Chiptunes Fantasy

### The Ultimate 8-Bit/16-Bit Bare-Metal Music Disk Emulator
**Version 1.4.0-beta.3 [Living Silicon Refinement & Responsive Architecture]**

Built with 100% vanilla HTML5, CSS3, and modern Web Audio API. No MP3s, no pre-rendered streams — just pure mathematical real-time synthesis running asynchronously inside low-latency AudioWorklets. From nerds, for nerds.

---

## 🚀 The Vision & Philosophy

*Chiptunes-Fantasy* exposes the guts of retro-computing hardware in real-time, explaining the physics, honoring the coders of the 80s/90s, and educating the curious. 

### The Dual-Constraint DSE Philosophy
In version 1.3.0, we introduced a ruthless constraint-driven architecture to ensure absolute visual authenticity. Every **Demo-Scene-Element (DSE)** must obey the physical laws of the machine it represents:
1. **The Retro Blitter:** All rendering is trapped inside an offscreen buffer locked to historical resolutions (e.g., `320x200` for C64/Atari, `320x256` for Amiga). It is scaled to modern 4K/1080p displays using flawless Nearest-Neighbor interpolation, enforcing true chunky pixels.
2. **Sub-Pixel & Anti-Aliasing Ban:** Native HTML5 vector smoothing is bypassed. All lines use our custom JS-Bresenham algorithm (`drawAliasedLine`), circles are drawn via scanline filling, and all coordinates are strictly integer-floored.
3. **Hardware Palette Quantization:** DSEs are not allowed to blend freely. Every RGB value is routed through our central `hardware-constraints.js` utility, locking outputs to the 16-color VIC-II palette, 12-bit Amiga OCS banding, or 9-bit Atari ST Shifter steppings. 

---

## 📺 Demoscene Orchestration (The Scene-DJ Engine)

The **Demoscene-Sequencer (DSS)** orchestrates dynamic, rule-based visual choreographies using an Entity-Component-System (ECS) architecture. 

### 1. Cycle-Accurate Track Syncing
We abolished analog volume-guessing. The `TrackMonitor` now hooks directly into the emulator's hardware databus. By evaluating 6581 Gate-Bits, 8364 DMA spikes, and YM2149 volume registers in real-time, the visual engine triggers animations (`metrics.beat`) with 100% frame-accurate demoscene precision.

### 2. Demo-Scene-Element (DSE) Arsenal
*   **Track Presenter:** A universal ECS *One-Shot* overlay that elegantly slides in upon track change. It uses native `ctx.measureText` to dynamically truncate metadata on mobile portrait screens and self-destructs gracefully after 5 seconds.
*   **C64 Chunky Plasma:** A mathematical 8x8 PETSCII-style plasma locked strictly to the 16-color palette. Features fluid, beat-reactive color-cycling and a geometric zooming pump.
*   **Amiga Boing Ball:** The legendary 1984 prototype, rendered as a 16x14 3D mesh with an authentic 17-degree right tilt. Features a majestic parabolic flight path and 12-bit quantized depth-shading.
*   **Amiga Kefrens Checkerboard:** The iconic infinite zooming 3D floor with scanline-based perspective math, dynamically shifted by 1 pixel to seamlessly merge with the background horizon.
*   **Atari 3D Dot Torus:** A tribute to classic 68000 CPU point-plotting. A massive 3D donut that rotates, pulses, and flashes in high-energy 9-bit neon colors.
*   **Legacy DSEs Overhauled:** 
    *   *Retro Sunset* now features C64 Outrun slits, an Amiga Copper-melt sky with parallax mountains, and an Atari elastic 3D water grid. 
    *   *Starfield* utilizes *Dynamic Radial/Frustum Recycling* to keep visible star density at a permanent 100%, even during Atari 3D Z-roll rotations.
    
*   **Living Silicon (Core Visualization):** Ein hochperformantes Vektor-Die-Modul der drei verbauten Soundprozessoren (MOS 6581, MOS Paula 8364, YM2149F). Zeigt physische Pinout-Glows, Live-Mixer-Gatter, flackernde Noise-Generatoren und Echtzeit-Frequenzanalysen direkt auf dem Silizium-Plättchen.
*   **Amiga Boing Ball (1984 Tribute):** Ein historisch akkurates 16x14-Demoszene-Mesh mit starrer 3D-Kinematik, 17-Grad-Neigung und originaler parabolischer Schwerkraft-Physik.
*   **Environmental Sensor Bay:** Live-Diagnostik der virtuellen analogen Ströme. Simuliert dynamische Spannungsabfälle (Voltage Sags) bei tiefen Frequenzen, Transistor-Bias-Drifts und thermische Rauschpegel.
*   **Cinematic CRT Transitions:** Asynchroner Systemwechsel, der einen gefrästen Relais-Chassis-Reset mit Stromschwankungen, weichem FFT-Physik-Absturz und einem CRT-Degauss-Glitch auf dem Canvas verbindet.

*   **Strategy-Pattern Chip Emulation:** Die `LivingSilicon`-Klasse wurde von einer monolithischen Klasse in einen schlanken Orchestrator refaktorisiert. Die globalen Hardware-Schnittstellen (Pins generieren, Bus-Ströme steuern) werden über eine `BaseChip`-Mutterklasse vererbt, während die chip-spezifischen Schaltpläne (Registerschnittstellen, Gatter-Layouts, Signal-Weichen) in eigenständigen Modulen gekapselt sind:
    *   `Sid6581`: Verwaltet die ADSR-Envelopes und das dynamische VCF-Filter-Bypass-Routing.
    *   `Paula8364`: Verwaltet den DMA-Zustand und das physische L-R-R-L-Stereo-Routing.
    *   `Ym2149`: Verwaltet die Mixer-Matrix (Reg 7), die Rauschfrequenzen und die Hüllkurvenformen.
*   **Database & Archive Expandability:** Über eine neue Systemleiste oberhalb der Museums-Inhalte lässt sich das Living-Silicon-Modul temporär abschalten. Dadurch dehnt sich das Lese-Terminal flexibel über die gesamte rechte Konsolen-Spalte aus.

*   **SID 6581 Microverse (C64 Background DSE):** Ein systemgetreues Vektor-Die-Szenario. Integriert ein kochendes 8x8 PETSCII-Plasma, isometrische Oszillator-Kerne und an die Sound-Transienten gekoppelte Datenbusse, eingebettet über ein tension-reaktives Parallax-Tech-Grid.
*   **Paula 8364 Microverse (Amiga Background DSE):** Visualisiert die 4 DMA-Kanäle als ferne Monolithen direkt am 3D-Fluchtpunkt des Horizonts. Datenpakete schießen nach oben in einen 12-Bit quantisierten Moiré-Himmel, während sich der 3D-Boden exakt an den 55%-Schnitt des `KefrensCheckerboards` anschmiegt.
*   **YM2149F Microverse (Atari ST Background DSE):** Zeigt live pulsierende Rechteckwellen-Oszilloskope, einen gedämpften Magenta-Rauschregen und simuliert im Climax die berühmten Timer-B-Overscan-Glitches, indem das Canvas zeilenweise horizontal zerrissen wird.
