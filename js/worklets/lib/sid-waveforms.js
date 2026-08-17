// === js/worklets/lib/sid-waveforms.js ===
// =========================================================
// MOS 6581 WAVEFORM GENERATOR & BIT-LOGIC
// Hardware-accurate 8-Bit DAC quantization & Floating DC Bias
// Employs physical LUTs for Wire-AND combined waveforms (O(1) execution)
// with Dynamic High-Register Frequency-Dependent Pulldown Relaxation (>2kHz)
// =========================================================

import { 
    PWM_LUT, 
    WAVE_LUT_TRISAW, 
    WAVE_LUT_TRIPULSE, 
    WAVE_LUT_SAWPULSE, 
    WAVE_LUT_TRISAWPULSE 
} from './sid-luts.js';

export function calculateWaveform8Bit(ctrl, phase24, pw12, lfsr23, ringMSB, freq = 0) {
    let hasWave = false;
    
    // Basis-Wellenformen in 8-Bit berechnen
    let tri = 0xFF, saw = 0xFF, pulse = 0xFF, noise = 0xFF;

    if (ctrl & 16) {
        // Exakte 11-Bit Phasen-Akkumulator Magnitude (Bits 22..12)
        let raw11 = (phase24 >> 12) & 0x7FF;
        
        // RingMod / Triangle Richtung:
        if (ringMSB) {
            raw11 = raw11 ^ 0x7FF;
        }
        
        // Skalierung von 11-Bit auf 8-Bit
        tri = raw11 >> 3;
        hasWave = true;
    }

    if (ctrl & 32) {
        saw = (phase24 >> 16) & 0xFF;
        hasWave = true;
    }

    if (ctrl & 64) {
        let testPhase = (phase24 >> 12) & 0xFFF;
        let pwMapped = PWM_LUT[pw12 & 0xFFF];
        pulse = (testPhase < pwMapped) ? 0xFF : 0x00;
        hasWave = true;
    }

    if (ctrl & 128) {
        // Hardware-exakte LFSR Noise-Taps (6581)
        let rawNoise = ((lfsr23 & 0x100000) >> 13) | // Bit 20 -> Bit 7
                       ((lfsr23 & 0x040000) >> 12) | // Bit 18 -> Bit 6
                       ((lfsr23 & 0x004000) >>  9) | // Bit 14 -> Bit 5
                       ((lfsr23 & 0x000800) >>  7) | // Bit 11 -> Bit 4
                       ((lfsr23 & 0x000200) >>  6) | // Bit 9  -> Bit 3
                       ((lfsr23 & 0x000020) >>  3) | // Bit 5  -> Bit 2
                       ((lfsr23 & 0x000004) >>  1) | // Bit 2  -> Bit 1
                       (lfsr23 & 0x000001);          // Bit 0  -> Bit 0
        
        noise = Math.floor(rawNoise * 0.68);
        hasWave = true;
    }

    // Floating DAC DC-Bias
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
    // NMOS TRANSISTOR WIRE-AND LUTS & FREQUENCY DEGRADATION
    // =========================================================
    // Frequenz-Normierungsfaktor für hohe Oktaven (ab ~1 kHz ansteigend)
    let freqNorm = freq > 4000 ? Math.min(1.0, (freq - 4000) / 28000.0) : 0.0;

    // 1. TRIANGLE + SAWTOOTH ($30)
    if (waveMask === 0x30) {
        let base = WAVE_LUT_TRISAW[(tri << 8) | saw];
        if (freqNorm > 0.0) {
            return Math.min(255, Math.floor(base + (tri - base) * (0.18 * freqNorm)));
        }
        return base;
    }

    // 2. TRIANGLE + PULSE ($50) - DIE HÜLSBECK ENGELSSTIMME!
    if (waveMask === 0x50) {
        let pIdx = (pulse === 0xFF) ? 1 : 0;
        let base = WAVE_LUT_TRIPULSE[(pIdx << 8) | tri];
        if (pIdx === 0 && freqNorm > 0.0) {
            // Parasitäre Ladungs-Entspannung: Pulldown schwächt bei hohen Frequenzen sachte ab
            return Math.min(255, Math.floor(base + (tri - base) * (0.28 * freqNorm)));
        }
        return base;
    }

    // 3. SAWTOOTH + PULSE ($60) - DER MON / GALWAY BASS!
    if (waveMask === 0x60) {
        let pIdx = (pulse === 0xFF) ? 1 : 0;
        let base = WAVE_LUT_SAWPULSE[(pIdx << 8) | saw];
        if (pIdx === 0 && freqNorm > 0.0) {
            return Math.min(255, Math.floor(base + (saw - base) * (0.25 * freqNorm)));
        }
        return base;
    }

    // 4. TRIANGLE + SAWTOOTH + PULSE ($70)
    if (waveMask === 0x70) {
        let pIdx = (pulse === 0xFF) ? 1 : 0;
        let base = WAVE_LUT_TRISAWPULSE[(pIdx << 16) | (tri << 8) | saw];
        if (pIdx === 0 && freqNorm > 0.0) {
            let triSaw = WAVE_LUT_TRISAW[(tri << 8) | saw];
            return Math.min(255, Math.floor(base + (triSaw - base) * (0.22 * freqNorm)));
        }
        return base;
    }

    // 5. NOISE + COMBINED WAVEFORMS (0x90, 0xA0, 0xC0, 0xD0, 0xE0, 0xF0)
    let bitAnd = 0xFF;
    let xorSum = 0;

    if (ctrl & 16) { bitAnd &= tri; xorSum |= tri; }
    if (ctrl & 32) { bitAnd &= saw; xorSum |= saw; }
    if (ctrl & 64) { bitAnd &= pulse; xorSum |= pulse; }
    if (ctrl & 128) { bitAnd &= noise; xorSum |= noise; }

    let xorVal = xorSum ^ bitAnd;
    let bleed = ((xorVal & 0x0F) >> 1) + ((xorVal & 0xF0) >> 3);

    if ((ctrl & 64) && pulse === 0) {
        bleed >>= 1; 
    }

    let out = bitAnd + bleed + 0x12;
    return Math.min(255, Math.max(0, out));
}