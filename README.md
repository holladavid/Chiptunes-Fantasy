# 💾 CHIPTUNES FANTASY (v1.4.5)
> **The Ultimate 8-Bit/16-Bit Bare-Metal Music Disk Emulator & Hardware Laboratory**

---

## 🎯 The Vision ("Von Nerds für Nerds")
**Chiptunes Fantasy** is not a simple music player. It is a high-fidelity, real-time emulated music disk that runs entirely in your web browser with 100% hardware accuracy and zero external framework dependencies. 

We do not play MP3s or pre-recorded audio. We parse genuine, vintage binary tracker formats (`.sid`, `.ym`, `.mod`, `.xm`) and synthesize every single waveform, filter, and envelope on-the-fly using highly optimized, low-latency asynchronous `AudioWorkletProcessors`.

### 🌌 Why "Fantasy"?
A real Commodore 64 or Atari ST could *never* play a highly complex tracker routine, calculate a 3D vector star, render a PETSCII plasma, and update an oscilloscope simultaneously—it would have crashed the CPU instantly. 

But memory paints the past grander than it actually was. **This is our Fantasy.**
Every single *Demo-Scene-Element (DSE)* you see on screen is programmed with ruthless historical accuracy (strict hardware palettes, true bit-banged math, zero anti-aliasing). Our `Scene-DJ` then acts as the ultimate virtual orchestrator, taking these isolated, period-accurate effects and layering them into a breathtaking, synchronized demoscene experience that feels *exactly* like our childhood memories.

With the **v1.4.0 "Hardware Laboratory"** milestone and the **v1.4.5 C64 Precision Update**, the UI functions as a tactile measurement bay. Users don't just listen—they interact with the operational temperature of physical JFET resistors, watch raw binary data packets flow down copper buses, observe measured NMOS DAC fingerprints, and hear dynamic sample-rate stepping on 4-bit C64 digidrums.

*Insert Disk. Inject ROM. Let the analog filters burn.*

---

## 🎛️ The Three Soundchip Pillars

### 1. MOS Technology SID 6581 (Commodore 64)
Our cycle-exact 1MHz SID engine is arguably one of the deepest analogue emulations available on the web:
*   **6502 CPU Lockstep:** Runs a complete, highly optimized MOS 6502 CPU emulator inside the audio thread. It includes a phantom KERNAL OS, perfect memory mapping, and full Open Bus emulation to execute complex custom player routines in real time.
*   **Dynamic PSID Sample Traps ($D45D / $D45E / $D45F) (New in v1.4.5):** Fixed static sample rate traps. $D45D (Period Low) and $D45E (Period High) now dynamically reload `psidSamplePeriod` per drum instrument (*Great Giana Sisters*, *Turbo Outrun*, *Arkanoid*), allowing drums to shift sample rates dynamically.
*   **Hülsbeck SoundMonitor NMI Alignment (New in v1.4.5):** Aligned $D45F step increment handling and $D41D trap logic directly with Chris Hülsbeck's 6502 assembly disassembly (`WCC30` / `W9B19` / `W9B6B`).
*   **Giana "Engelsstimme" $50 Lead Restoration (New in v1.4.5):** Restored $50 (Triangle + Pulse) Wire-AND NMOS pull-down impedance in `WAVE_LUT_TRIPULSE` (`tri * 0.86 + 14`), restoring full fundamental mid-range power to the glassy lead voice.
*   **Measured MOS 6581 R3 DAC Fingerprint (New in v1.4.5):** Integrated oscilloscope-measured non-monotonic R-2R bit weights and $1.10v - 0.11v^3$ cubic NMOS output buffer saturation curve (reSID-fp matched).
*   **Parasitic $C_{gate}$ Gate-Capacitance Charge Bleed (New in v1.4.5):** Modeled internal $C_{gate} \approx 0.8\text{ pF}$ floating bus charge bleed ($\alpha = 0.82$ @ 1MHz, $f_c = 268.9\text{ kHz}$) on combined waveforms ($30, $50, $60, $70).
*   **Rock-Solid VCF Filter Stability (v1.4.5):** Preserved 100% unconditionally stable Chamberlin SVF sweeps without resonance tipping or muting on extreme $R=15$ tracks (*Wizball Title*, *Commando*).
*   **Thermal Physical Modeling:** Simulates JFET transistor resistance drift based on real operating temperatures (adjustable from 15°C to 75°C), warping the cutoff frequency and resonance exactly like a hot studio C64.
*   **The Galway $D418 Bug:** Features a fully non-linear 16-step volume DAC modeled after physical R-2R ladder measurements, saturated by an analog DC-Bias injection.
*   **ADSR Delay Bug (15-Bit Wrap):** Hardware-accurate 15-bit LFSR up-counter wrapping guarantees exact micro-timing delays during phase transitions.
*   **Floating DAC Discharge:** Opaque, analog charge bleeding over ~15.5ms against a floating DC bias.
*   **Zero-Allocation Boxcar Decimation & Sinc-Droop Compensation:** Integrated 1MHz Integrate-and-Dump (Boxcar) decimator paired with a 16kHz RC output stage and a Sinc-Droop pre-emphasis equalizer (+2.5dB at 16kHz).

### 2. MOS Technology Paula 8364 (Amiga 500)
A deep emulation of the Amiga’s legendary 4-channel DMA PCM engine:
*   **192kHz Oversampling & ZOH:** Emulates the exact staircase wave-shapes of Paula's non-interpolating Zero-Order Hold (ZOH) DACs ("Amiga Shimmer").
*   **Sinc-FIR Decimation:** Translates 192kHz back to standard 48kHz using a 255-tap polyphase Sinc-FIR filter.
*   **L-R-R-L Hard-Panning & Crosstalk:** Enforces physical stereo routing with 3.5% inductive trace crosstalk.
*   **Dual Analog Filtering:** Replicates 1-pole RC low-pass (4.42kHz) and 2-pole LED Butterworth filter (3.09kHz).

### 3. Yamaha YM2149F (Atari ST)
A cycle-exact 2MHz emulation of the ST's Programmable Sound Generator (PSG):
*   **32-Step Logarithmic DAC:** Replicates exact voltage steps (-1.5dB per step) of the physical logarithmic DAC.
*   **Hardware Envelope Generator (HEG):** Accurate 5-bit envelope shaping for smooth sweeps.
*   **Digidrum DAC Injection:** Simulates Jochen Hippel 4-bit sample-injection hacks via logarithmic volume registers.
*   **Dynamic Staging:** Analyzes registers to dynamically pan voices, apply tape-flutter, and inject stereo-delay/reverb.

---

## 🎛️ 3-Channel Mixing Desk & Zero OS Ducking (v1.4.5)
We replaced the Web Audio API `DynamicsCompressorNode` with a **calibrated 3-channel mixing desk stage**:
*   Dedicated system gain nodes (`sidGain`, `paulaGain`, `ymGain`) allow clean, independent RMS level alignment.
*   C64 output is scaled by `0.42x` with a klangneutral `Math.tanh()` soft-clipper in `sid-exact.js` / `sid-standard.js`.
*   Audio signals never exceed 0.95 (0 dBFS Limit), completely preventing operating system / browser safety limiters (macOS CoreAudio, WASAPI) from ducking master volume for 1–2 seconds when resuming playback!

---

## 🎨 DSE Visuals & The Blitter Philosophy 
Every visual Demo-Scene-Element (DSE) follows strict historical limitations:
1.  **The Retro Blitter:** All GFX layers render to a tiny offscreen canvas locked to period vertical resolutions (200p C64/ST, 256p Amiga) and upscaled using crisp nearest-neighbor interpolation.
2.  **Strictly Aliased:** Custom Bresenham line drawers and Scanline circle fillers ensure zero subpixel bleeding.
3.  **Alpha-Blending Ban:** Zero alpha transparency on GFX layers. Overlapping objects overwrite pixels opaquely.

---

## ⚡ High-Speed Performance & Zero Allocation
*   **Zero-Allocation in Hot Paths:** No objects (`new`, `[]`, `{}`) are instantiated inside 60Hz visual or 1MHz audio loops.
*   **Bitwise Integer Math:** Fast coordinate clamping via `| 0`, `& ~1`, `>>`.

---

## 🛠️ Local Playback
Run via a local web server (due to ES6 Module & AudioWorklet CORS rules):

```bash
# Using NodeJS:
npx serve .

# Using Python:
python3 -m http.server 8080
```