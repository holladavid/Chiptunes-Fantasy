// === js/worklets/lib/sid-waveforms.js ===
// =========================================================
// MOS 6581 WAVEFORM GENERATOR & BIT-LOGIC
// Hardware-accurate 8-Bit DAC quantization & Floating DC Bias
// Upgraded with Discrete Analog Models for Combined (Illegal) Waveforms
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
    // =========================================================

    // 1. TRIANGLE + SAWTOOTH ($30)
    // Auf dem 6581 entsteht ein Nicht-Linearer "Stufen-Sägezahn".
    // Bitweises AND dominiert, aber analoger Bleed hebt die Senken an.
    if (waveMask === 0x30) {
        let bitAnd = tri & saw;
        return Math.floor(bitAnd * 0.78 + (tri + saw) * 0.11);
    }

    // 2. TRIANGLE + PULSE ($50)
    // Puls-High schaltet die Dreieckswelle durch; Puls-Low zieht ab, lässt aber ~22% Restsignal.
    if (waveMask === 0x50) {
        if (pulse === 0xFF) return Math.floor(tri * 0.90 + 0x0C);
        return Math.floor(tri * 0.22 + 0x08);
    }

    // 3. SAWTOOTH + PULSE ($60) - DAS GALWAY-FAVORIT!
    // Der stärkste NMOS-Pull-Down. Bei Pulse-High folgt die Sägezahnwelle satt,
    // bei Pulse-Low zieht der Puls-Transistor ab, hinterlässt aber ein ~25% Sägezahn-Sicker-Signal.
    if (waveMask === 0x60) {
        if (pulse === 0xFF) return Math.floor(saw * 0.92 + 0x0A);
        return Math.floor(saw * 0.25 + 0x0E);
    }

    // 4. TRIANGLE + SAWTOOTH + PULSE ($70)
    // Drei Wellen kombiniert: Starke Dämpfung durch dreifache Widerstandslast.
    if (waveMask === 0x70) {
        let triSaw = tri & saw;
        if (pulse === 0xFF) return Math.floor(triSaw * 0.82 + 0x12);
        return Math.floor(triSaw * 0.18 + 0x0A);
    }

    // 5. NOISE + COMBINED WAVEFORMS (0x90, 0xA0, 0xC0, 0xD0, 0xE0, 0xF0)
    // Das Rauschen zieht bei Aktivierung anderer Wellenformen die Ausgangsstufe 
    // in eine abgedämpfte, hybride Rausch-Matrix.
    let bitAnd = 0xFF;
    let sum = 0;
    let count = 0;

    if (ctrl & 16) { bitAnd &= tri; sum += tri; count++; }
    if (ctrl & 32) { bitAnd &= saw; sum += saw; count++; }
    if (ctrl & 64) { bitAnd &= pulse; sum += pulse; count++; }
    if (ctrl & 128) { bitAnd &= noise; sum += noise; count++; }

    let avg = sum / count;
    let bleed = (avg - bitAnd) * 0.28;

    if ((ctrl & 64) && pulse === 0) {
        bleed *= 0.15;
    }

    let out = (bitAnd + bleed) * 0.72 + 0x18;
    return Math.min(255, Math.max(0, Math.floor(out)));
}