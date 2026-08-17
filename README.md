# 💾 CHIPTUNES FANTASY (v1.4.7)
> **The Ultimate 8-Bit/16-Bit Bare-Metal Music Disk Emulator & Hardware Laboratory**

---

## 🎯 The Vision ("Von Nerds für Nerds")
**Chiptunes Fantasy** is not a simple music player. It is a high-fidelity, real-time emulated music disk that runs entirely in your web browser with 100% hardware accuracy and zero external framework dependencies. 

We do not play MP3s or pre-recorded audio. We parse genuine, vintage binary tracker formats (`.sid`, `.ym`, `.mod`, `.xm`) and synthesize every single waveform, filter, and envelope on-the-fly using highly optimized, low-latency asynchronous `AudioWorkletProcessors`.

### 🌌 Why "Fantasy"?
A real Commodore 64 or Atari ST could *never* play a highly complex tracker routine, calculate a 3D vector star, render a PETSCII plasma, and update an oscilloscope simultaneously—it would have crashed the CPU instantly. 

But memory paints the past grander than it actually was. **This is our Fantasy.**
Every single *Demo-Scene-Element (DSE)* you see on screen is programmed with ruthless historical accuracy (strict hardware palettes, true bit-banged math, zero anti-aliasing). Our `Scene-DJ` then acts as the ultimate virtual orchestrator, taking these isolated, period-accurate effects and layering them into a breathtaking, synchronized demoscene experience that feels *exactly* like our childhood memories.

---

## 🎛️ The Three Soundchip Pillars

### 1. MOS Technology SID 6581 / CSG 8580 (Commodore 64)
Our cycle-exact 1MHz SID engine is arguably one of the deepest analogue emulations available on the web:
*   **255-Tap Polyphase Sinc-FIR Decimator (v1.4.7):** Replaces crude box-filters with a true 255-tap Blackman-windowed Sinc-FIR decimation stage ($>75\text{ dB}$ stopband rejection @ 20 kHz), completely eliminating ultrasonic foldback aliasing on pulse, hard-sync, and 4-bit sample leads.
*   **6502 Sub-Cycle Bus Write Pipelining (v1.4.7):** Hardware I/O bus commits (`STA/STX/STY/RMW`) are staged during instruction execution and deferred to the exact final 4th clock cycle, eliminating sub-instruction jitter on Galway digis and timer-driven routines.
*   **PlaySID 3.6× Auto-Conversion & Big-Endian Nibble Streamer (v1.4.7):** Automatically converts vintage PlaySID Amiga-Paula clock periods ($\ge 280$) to C64 PAL cycles ($907 \to 252$ cycles = $3.91\text{ kHz}$) with chronological big-endian high-nibble first decoding (*The Great Giana Sisters*).
*   **Persistent Voice 3 DC-Leakage on 3OFF (v1.4.7):** Models physical MOS 6581 virtual ground summing behavior when Voice 3 is muted via `$D418` Bit 7 (3OFF), retaining full transient weight for Galway digidrum hacks (*Arkanoid*).
*   **Wizball-Stable 2MHz ZDF State-Space Solver (v1.4.7):** Enforces physical MOS 6581 R3 S-curve cutoff ceiling ($30\text{ Hz} - 6.2\text{ kHz}$) and symmetric JFET triode resonance quenching ($Q_{max} \approx 3.0$), eliminating DC latchup on extreme $R=15$ sweeps (*Wizball Title*).
*   **Single-Stage Sub-Bass AC-Coupling (v1.4.7):** Removed redundant cascaded DC blocking in favor of the C64 motherboard 45Hz AC-coupling capacitor emulation, restoring full 50Hz kickdrum sub-bass punch without phase smear.
*   **NEW: SID 6581/8580 "Chiptunes Fantasy Studio" Core (v1.4.7):** Audiophile dual-channel engine featuring CSG 8580 linear R-2R DACs, 20kHz Studio Airband ZDF VCF, Constant-Power StereoSID dynamic voice staging (Lead Left, Chords Right, Rhythm Center), and 48Hz digidrum sub-harmonic transient exciter.
*   **Giana "Engelsstimme" $50 Lead Restoration:** Restored $50 (Triangle + Pulse) Wire-AND NMOS pull-down impedance in `WAVE_LUT_TRIPULSE` (`tri * 0.86 + 14`), restoring full fundamental mid-range power to the glassy lead voice.
*   **Measured MOS 6581 R3 DAC Fingerprint:** Integrated oscilloscope-measured non-monotonic R-2R bit weights and $1.10v - 0.11v^3$ cubic NMOS output buffer saturation curve.
*   **Parasitic $C_{gate}$ Gate-Capacitance Charge Bleed:** Modeled internal $C_{gate} \approx 0.8\text{ pF}$ floating bus charge bleed ($\alpha = 0.82$ @ 1MHz, $f_c = 268.9\text{ kHz}$) on combined waveforms ($30, $50, $60, $70).

### 2. MOS Technology Paula 8364 (Amiga 500)
*   **192kHz Oversampling & ZOH:** Emulates staircase wave-shapes of Paula's non-interpolating Zero-Order Hold (ZOH) DACs ("Amiga Shimmer") with a 255-tap polyphase Sinc-FIR decimator.
*   **LF347 JFET Op-Amp Slew-Rate Modeling (v1.5.0):** Emulates the analog slew-rate limitation ($13\text{ V}/\mu\text{s}$) and JFET input asymmetry of the Amiga 500 motherboard output buffer, smoothly rounding discrete 8-bit DAC steps into a warm, analog sheen.
*   **L-R-R-L Hard-Panning & Crosstalk:** Enforces physical stereo routing with 3.5% inductive trace crosstalk.
*   **NEW: Paula 8364/AHI Studio Core (v1.5.0):** Audiophile A1200/AHI 14-bit Hermite cubic interpolation, Constant-Power spatialized stereo panning (no ear fatigue), parametric Schroeder/Moorer stereo diffusion reverb, and >8kHz airband presence exciter.

### 3. Yamaha YM2149F (Atari ST)
*   **32-Step Logarithmic DAC & Digidrums:** Replicates 32-step log voltage curves (-1.5dB/step) and 4-bit Digidrum DAC injection.
*   **Open-Collector Passive Summing Bus (v1.5.0):** Emulates mutual impedance loading and non-linear current compression on the Atari ST motherboard summing resistors ($R_{43}, R_{44}, R_{45}$), gluing complex 3-voice chords and digidrums naturally together.
*   **32-Phase Polyphase Sinc-FIR Decimator (v1.5.0):** Downsamples the 2MHz lockstep audio stream to 48kHz with zero fractional phase flutter ($>75\text{ dB}$ stopband rejection @ 12.5 kHz).

---

## 🎛️ 3-Channel Mixing Desk & Zero OS Ducking
*   Dedicated system gain nodes (`sidGain`, `paulaGain`, `ymGain`) for independent level alignment.
*   C64 output is scaled by `0.42x` with a `Math.tanh()` soft-clipper in `sid-exact.js`, preventing macOS CoreAudio and Windows WASAPI limiters from ducking master volume on unpause!

---

## 🛠️ Local Playback
Run via a local web server (due to ES6 Module & AudioWorklet CORS rules):

```bash
# Using NodeJS:
npx serve .

# Using Python:
python3 -m http.server 8080
```