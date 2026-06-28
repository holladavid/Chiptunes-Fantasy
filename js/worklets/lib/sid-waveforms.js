// === js/worklets/lib/sid-waveforms.js ===
// =========================================================
// MOS 6581 WAVEFORM GENERATOR & BIT-LOGIC
// Hardware-accurate 8-Bit DAC quantization & Floating DC Bias
// =========================================================

export function calculateWaveform8Bit(ctrl, phase24, pw12, lfsr23, ringMSB) {
    let out = 0xFF; 
    let hasWave = false;

    if (ctrl & 16) {
        let tri12 = (phase24 >> 11) & 0xFFF;
        if (ringMSB) tri12 = (~tri12) & 0xFFF;
        out &= (tri12 >> 4);
        hasWave = true;
    }

    if (ctrl & 32) {
        out &= (phase24 >> 16) & 0xFF;
        hasWave = true;
    }

    if (ctrl & 64) {
        let testPhase = (phase24 >> 12) & 0xFFF;
        let pulseOut = (testPhase <= pw12) ? 0xFF : 0x00;
        out &= pulseOut;
        hasWave = true;
    }

    if (ctrl & 128) {
        let noiseOut = ((lfsr23 & 0x400000) >> 15) | 
                       ((lfsr23 & 0x100000) >> 14) | 
                       ((lfsr23 & 0x010000) >> 11) | 
                       ((lfsr23 & 0x002000) >>  9) | 
                       ((lfsr23 & 0x000800) >>  8) | 
                       ((lfsr23 & 0x000080) >>  5) | 
                       ((lfsr23 & 0x000010) >>  3) | 
                       ((lfsr23 & 0x000004) >>  2);  
        out &= noiseOut;
        hasWave = true;
    }

    // --- PHASE 4: Floating DAC DC-Bias ---
    // Wenn keine Welle selektiert ist, fällt der originale SID nicht auf absolute Null ab.
    // Die analogen DAC-Gatter "floaten" und erzeugen eine permanente Restgleichspannung (DC Offset).
    if (!hasWave) {
        return 0x18; // Simulierter Leckstrom der offenen Gates
    }

    return out;
}