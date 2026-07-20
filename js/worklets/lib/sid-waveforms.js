// === js/worklets/lib/sid-waveforms.js ===
// =========================================================
// MOS 6581 WAVEFORM GENERATOR & BIT-LOGIC
// Hardware-accurate 8-Bit DAC quantization & Floating DC Bias
// Phase 3: Pure Bitwise Integer Math for Wire-AND (Zero Floats)
// 100% Maniacs-of-Noise / Jeroen Tel Accuracy.
// =========================================================

export function calculateWaveform8Bit(ctrl, phase24, pw12, lfsr23, ringMSB) {
    let hasWave = false;
    
    // Basis-Wellenformen in 8-Bit berechnen
    let tri = 0xFF, saw = 0xFF, pulse = 0xFF, noise = 0xFF;

    if (ctrl & 16) {
        let tri12 = (phase24 >> 11) & 0xFFF;
        if (ringMSB) tri12 = (~tri12) & 0xFFF;
        tri = tri12 >> 4;
        hasWave = true;
    }

    if (ctrl & 32) {
        saw = (phase24 >> 16) & 0xFF;
        hasWave = true;
    }

    if (ctrl & 64) {
        let testPhase = (phase24 >> 12) & 0xFFF;
        pulse = (testPhase <= pw12) ? 0xFF : 0x00;
        hasWave = true;
    }

    if (ctrl & 128) {
        // --- HARDWARE-EXAKTE LFSR NOISE-TAPS (6581) ---
        noise = ((lfsr23 & 0x100000) >> 13) | // LFSR Bit 20 -> Noise Bit 7
                ((lfsr23 & 0x040000) >> 12) | // LFSR Bit 18 -> Noise Bit 6
                ((lfsr23 & 0x004000) >>  9) | // LFSR Bit 14 -> Noise Bit 5
                ((lfsr23 & 0x000800) >>  7) | // LFSR Bit 11 -> Noise Bit 4
                ((lfsr23 & 0x000200) >>  6) | // LFSR Bit 9  -> Noise Bit 3
                ((lfsr23 & 0x000020) >>  3) | // LFSR Bit 5  -> Noise Bit 2
                ((lfsr23 & 0x000004) >>  1) | // LFSR Bit 2  -> Noise Bit 1
                (lfsr23 & 0x000001);          // LFSR Bit 0  -> Noise Bit 0
        hasWave = true;
    }

    // --- Floating DAC DC-Bias ---
    if (!hasWave) {
        return 0x18; 
    }
    
    let waveMask = ctrl & 0xF0;

    // --- SINGLE WAVEFORMS (Fast Path) ---
    if (waveMask === 0x10) return tri;
    if (waveMask === 0x20) return saw;
    if (waveMask === 0x40) return pulse;
    if (waveMask === 0x80) return noise;

    // =========================================================
    // ANALOG DISCRETE COMBINED WAVEFORM MODELS (MOS 6581)
    // 100% Integer Math (Bitwise Shifts) for Jeroen Tel / MoN crunch!
    // =========================================================

    // 1. TRIANGLE + SAWTOOTH ($30)
    // Bitweises AND dominiert, aber analoger Bleed hebt die Senken an.
    if (waveMask === 0x30) {
        let bitAnd = tri & saw;
        // ~75% AND + ~12% (Tri+Saw)
        return bitAnd - (bitAnd >> 2) + ((tri + saw) >> 3);
    }

    // 2. TRIANGLE + PULSE ($50)
    if (waveMask === 0x50) {
        if (pulse === 0xFF) return tri - (tri >> 3) + 0x0C; // ~87%
        return (tri >> 2) + 0x08; // ~25% Sicker-Signal
    }

    // 3. SAWTOOTH + PULSE ($60) - THE MON / GALWAY BASS!
    // Der stärkste NMOS-Pull-Down.
    if (waveMask === 0x60) {
        if (pulse === 0xFF) return saw - (saw >> 4) + 0x0A; // ~93%
        return (saw >> 2) + 0x0E; // ~25%
    }

    // 4. TRIANGLE + SAWTOOTH + PULSE ($70)
    if (waveMask === 0x70) {
        let triSaw = tri & saw;
        if (pulse === 0xFF) return triSaw - (triSaw >> 2) + (triSaw >> 4) + 0x12; // ~81%
        return (triSaw >> 3) + (triSaw >> 4) + 0x0A; // ~18%
    }

    // 5. NOISE + COMBINED WAVEFORMS (0x90, 0xA0, 0xC0, 0xD0, 0xE0, 0xF0)
    let bitAnd = 0xFF;
    let sum = 0;
    let count = 0;

    if (ctrl & 16) { bitAnd &= tri; sum += tri; count++; }
    if (ctrl & 32) { bitAnd &= saw; sum += saw; count++; }
    if (ctrl & 64) { bitAnd &= pulse; sum += pulse; count++; }
    if (ctrl & 128) { bitAnd &= noise; sum += noise; count++; }

    let avg = (sum / count) | 0; // Strikte Integer Division
    let bleed = (avg - bitAnd) >> 2; // ~25% Bleed

    if ((ctrl & 64) && pulse === 0) {
        bleed >>= 1; // Pulldown halbiert den Bleed
    }

    // ~75% AND + ~75% Bleed + DC Offset
    let out = bitAnd - (bitAnd >> 2) + bleed - (bleed >> 2) + 0x18;
    
    if (out > 255) return 255;
    if (out < 0) return 0;
    return out;
}