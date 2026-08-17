# 💾 CHIPTUNES FANTASY (v1.4.8)
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
*   **32-Phase Fractional Polyphase Sinc-FIR Decimator (v1.4.8):** 32-phase Blackman-windowed FIR filterbank (255 taps, $>75\text{ dB}$ stopband rejection @ 20 kHz), eliminating all fractional sub-cycle phase jitter on the 1MHz PAL clock for crystal-clear sync leads and pulse waves.
*   **6502 Sub-Cycle Bus Write Pipelining:** Hardware I/O bus commits (`STA/STX/STY/RMW`) are staged during instruction execution and deferred to the exact final 4th clock cycle, eliminating sub-instruction jitter on Galway digis and timer-driven routines.
*   **15-Bit ADSR LFSR Wrap-Around Bug (v1.4.8):** Replicates the physical 6581 15-bit rate counter equality match delay (up to $32.768$ cycles freeze on dynamic rate changes), restoring authentic "snap-drums" (*The Last Ninja*, *Cybernoid II*).
*   **Dynamic High-Register Wire-AND Pulldown Relaxation (v1.4.8):** Models NMOS parasitic gate capacitance charge retention ($C_{\text{gate}} \approx 1\text{ pF}$) on combined waveforms ($30, $50, $60, $70) for frequencies $>2\text{ kHz}$, giving high octave leads a warm, liquid analog character.
*   **PlaySID 3.6× Auto-Conversion & Big-Endian Nibble Streamer:** Automatically converts vintage PlaySID Amiga-Paula clock periods ($\ge 280$) to C64 PAL cycles ($907 \to 252$ cycles = $3.91\text{ kHz}$) with chronological big-endian high-nibble first decoding (*The Great Giana Sisters*).
*   **Persistent Voice 3 DC-Leakage on 3OFF:** Models physical MOS 6581 virtual ground summing behavior when Voice 3 is muted via `$D418` Bit 7 (3OFF), retaining full transient weight for Galway digidrum hacks (*Arkanoid*).
*   **Wizball-Stable 2MHz ZDF State-Space Solver:** Enforces physical MOS 6581 R3 S-curve cutoff ceiling ($30\text{ Hz} - 6.2\text{ kHz}$) and symmetric JFET triode resonance quenching ($Q_{max} \approx 3.0$), eliminating DC latchup on extreme $R=15$ sweeps (*Wizball Title*).
*   **Default `$D418 = $0F` PSID Initialization (v1.4.8):** Initializes power-on master volume to 15 per PSID standard, fixing silence on early 1985 Ocean soundtracks (*Rambo: First Blood Part II*).
*   **NEW Core: SID 6581/8580 "Chiptunes Fantasy Studio" (v1.4.8):** Audiophile dual-channel engine featuring CSG 8580 linear R-2R DACs, 20kHz Studio Airband ZDF VCF, Constant-Power StereoSID dynamic voice staging (Lead Left, Chords Right, Rhythm Center), and 48Hz digidrum sub-harmonic transient exciter.

### 2. MOS Technology Paula 8364 / AHI (Amiga 500 & A1200)
*   **Paula 8364 True Analog (A500):** 192kHz oversampling, Zero-Order Hold (ZOH) DAC modeling, analog LF347 JFET op-amp slew rate stage ($13\text{ V}/\mu\text{s}$), passive 4.42kHz RC filter, active 3.09kHz Butterworth LED filter, 255-tap Sinc-FIR decimator, and physical hard-panning with 3.5% crosstalk.
*   **NEW Core: Paula 8364/AHI Studio Core (v1.4.8):** Audiophile A1200/AHI 14-bit Hermite cubic interpolation, Constant-Power spatialized stereo panning (no ear fatigue), parametric Schroeder/Moorer stereo diffusion reverb (4 comb filters + 2 allpass diffusers with phase decorrelation), and >8kHz airband presence exciter.

### 3. Yamaha YM2149F (Atari ST)
*   **2MHz True Lockstep & 32-Step Log-DAC:** Cycle-exact 2.0 MHz emulation with 32-step logarithmic DAC curves and 4-bit Digidrum DAC injection.
*   **Open-Collector Passive Summing Bus (v1.4.8):** Emulates mutual impedance loading and non-linear current compression on the Atari ST motherboard summing resistors ($R_{43}, R_{44}, R_{45}$), gluing complex 3-voice chords and digidrums naturally together ("Atari Bus Glue").
*   **32-Phase Polyphase Sinc-FIR Decimator (v1.4.8):** Downsamples the 2MHz lockstep audio stream to 48kHz with zero fractional phase flutter ($>75\text{ dB}$ stopband rejection @ 12.5 kHz).

---

## 🎛️ Master Bus DSP Stage & Audiophile Headphone Acoustics
*   **Bauer Binaural Crossfeed (bs2b 700Hz / 4.5dB @ 250µs delay):** Eliminates headphone listening fatigue on extreme hard-panned Amiga and StereoSID tracks. Toggleable via the `[ BS2B: ON/OFF ]` HUD button.
*   **1.0ms Lookahead True-Peak Brickwall Limiter:** Seamlessly caps dynamic inter-sample peaks at $-0.35\text{ dBFS}$, guaranteeing 100% full $0\text{ dBFS}$ loudness with zero distortion and zero OS ducking on macOS CoreAudio and Windows WASAPI.
*   **3-Channel Hardware Mixing Desk:** Dedicated system gain nodes (`sidGain`, `paulaGain`, `ymGain`) for calibrated level alignment across all 3 platforms.

---

## 🛠️ Local Playback
Run via a local web server (due to ES6 Module & AudioWorklet CORS rules):

```bash
# Using NodeJS:
npx serve .

# Using Python:
python3 -m http.server 8080
```