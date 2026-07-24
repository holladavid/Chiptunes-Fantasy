# 💾 CHIPTUNES FANTASY (v1.4.6)
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

### 1. MOS Technology SID 6581 (Commodore 64)
Our cycle-exact 1MHz SID engine is arguably one of the deepest analogue emulations available on the web:
*   **6502 CPU Lockstep:** Runs a complete, highly optimized MOS 6502 CPU emulator inside the audio thread with phantom KERNAL OS and full Open Bus emulation.
*   **Wizball Highscore Arpeggio Sweep Restoration (v1.4.6):** Restored exact 100% timing to all 16 ADSR rates (from 9 to 31,256 cycles) by reverting broken LFSR counters back to `RATE_COUNTER_PERIOD`. Martin Galway's iconic, long, bubbling arpeggio and filter sweeps in *Wizball Highscore* are fully restored!
*   **reSID-fp Non-Linear OTA State-Space Model & $Q_{max}$ Clamp (v1.4.6):** Upgraded the VCF stage to a 2MHz Zero-Delay Feedback (ZDF) trapezoidal state-space solver. Features oscilloscope-measured MOS 6581 $Q_{max} \approx 3.0$ clamping ($k = 1.414 \to 0.334$), eliminating the "bowed saw" digital whistle and guaranteeing 100% tuning stability on extreme $R=15$ sweeps (*Wizball Title*).
*   **Dynamic PSID Sample Traps ($D45D / $D45E / $D45F):** $D45D$ (Period Low) and $D45E$ (Period High) dynamically reload `psidSamplePeriod` per drum instrument (*Great Giana Sisters*, *Turbo Outrun*, *Arkanoid*).
*   **Giana "Engelsstimme" $50 Lead Restoration:** Restored $50 (Triangle + Pulse) Wire-AND NMOS pull-down impedance in `WAVE_LUT_TRIPULSE` (`tri * 0.86 + 14`), restoring full fundamental mid-range power to the glassy lead voice.
*   **Measured MOS 6581 R3 DAC Fingerprint:** Integrated oscilloscope-measured non-monotonic R-2R bit weights and $1.10v - 0.11v^3$ cubic NMOS output buffer saturation curve (reSID-fp matched).
*   **Parasitic $C_{gate}$ Gate-Capacitance Charge Bleed:** Modeled internal $C_{gate} \approx 0.8\text{ pF}$ floating bus charge bleed ($\alpha = 0.82$ @ 1MHz, $f_c = 268.9\text{ kHz}$) on combined waveforms ($30, $50, $60, $70).

### 2. MOS Technology Paula 8364 (Amiga 500)
*   **192kHz Oversampling & ZOH:** Emulates staircase wave-shapes of Paula's non-interpolating Zero-Order Hold (ZOH) DACs ("Amiga Shimmer") with a 255-tap polyphase Sinc-FIR decimator.
*   **L-R-R-L Hard-Panning & Crosstalk:** Enforces physical stereo routing with 3.5% inductive trace crosstalk.

### 3. Yamaha YM2149F (Atari ST)
*   **32-Step Logarithmic DAC & Digidrums:** Replicates 32-step log voltage curves (-1.5dB/step) and 4-bit Digidrum DAC injection.

---

## 🎛️ 3-Channel Mixing Desk & Zero OS Ducking
*   Dedicated system gain nodes (`sidGain`, `paulaGain`, `ymGain`) for independent level alignment.
*   C64 output is scaled by `0.42x` with a `Math.tanh()` soft-clipper in `sid-exact.js` / `sid-standard.js`, preventing macOS CoreAudio and Windows WASAPI limiters from ducking master volume on unpause!

---

## 🛠️ Local Playback
Run via a local web server (due to ES6 Module & AudioWorklet CORS rules):

```bash
# Using NodeJS:
npx serve .

# Using Python:
python3 -m http.server 8080
```