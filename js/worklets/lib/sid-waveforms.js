// === js/worklets/lib/sid-waveforms.js ===
// =========================================================
// MOS 6581 WAVEFORM GENERATOR & BIT-LOGIC
// Hardware-accurate 8-Bit DAC quantization & Floating DC Bias
// True Analog NMOS Transistor Formulation for Combined Waveforms
// =========================================================

import { PWM_LUT } from './sid-luts.js';

export function calculateWaveform8Bit(ctrl, phase24, pw12, lfsr23, ringMSB) {
    let hasWave = false;
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
        let pwMapped = PWM_LUT[pw12 & 0xFFF];
        pulse = (testPhase < pwMapped) ? 0xFF : 0x00;
        hasWave = true;
    }

    if (ctrl & 128) {
        noise = ((lfsr23 & 0x100000) >> 13) | 
                ((lfsr23 & 0x040000) >> 12) | 
                ((lfsr23 & 0x004000) >>  9) | 
                ((lfsr23 & 0x000800) >>  7) | 
                ((lfsr23 & 0x000200) >>  6) | 
                ((lfsr23 & 0x000020) >>  3) | 
                ((lfsr23 & 0x000004) >>  1) | 
                (lfsr23 & 0x000001);          
        hasWave = true;
    }

    if (!hasWave) return 0x18; 
    
    let waveMask = ctrl & 0xF0;
    if (waveMask === 0x10) return tri;
    if (waveMask === 0x20) return saw;
    if (waveMask === 0x40) return pulse;
    if (waveMask === 0x80) return noise;

    // =========================================================
    // TRUE ANALOG NMOS TRANSISTOR PULL-DOWN (Combined Waveforms)
    // Continuous polynomial voltage dividers replacing rigid bitwise logic
    // =========================================================

    // 1. TRIANGLE + SAWTOOTH ($30)
    if (waveMask === 0x30) {
        let aTri = tri / 255.0;
        let aSaw = saw / 255.0;
        let out = aTri * aSaw * (1.0 + 0.2 * Math.abs(aTri - aSaw));
        return Math.min(255, out * 255);
    }

    // 2. TRIANGLE + PULSE ($50) - THE HÜLSBECK GLASSY LEAD!
    if (waveMask === 0x50) {
        let aTri = tri / 255.0;
        if (pulse === 0xFF) {
            // Gate open: Smooth triangle with a tiny bit of non-linear capacitive rounding
            let out = aTri * 0.98 + (aTri * aTri) * 0.02;
            return Math.min(255, out * 255);
        }
        // Gate closed: NMOS pulls down, but channel resistance creates a parabolic bleed
        let bleed = (aTri * aTri) * 0.08; 
        return Math.min(255, bleed * 255);
    }

    // 3. SAWTOOTH + PULSE ($60) - THE MON / GALWAY BASS!
    if (waveMask === 0x60) {
        let aSaw = saw / 255.0;
        if (pulse === 0xFF) {
            let out = aSaw * 0.95 + (aSaw * aSaw) * 0.05;
            return Math.min(255, out * 255);
        }
        let bleed = (aSaw * aSaw * aSaw) * 0.15;
        return Math.min(255, bleed * 255);
    }

    // 4. TRIANGLE + SAWTOOTH + PULSE ($70)
    if (waveMask === 0x70) {
        let aTri = tri / 255.0;
        let aSaw = saw / 255.0;
        let baseMix = aTri * aSaw;
        if (pulse === 0xFF) {
            return Math.min(255, baseMix * 255);
        }
        let bleed = (baseMix * baseMix) * 0.12;
        return Math.min(255, bleed * 255);
    }

    // Fallback for Noise combinations
    let bitAnd = 0xFF;
    let xorSum = 0;
    if (ctrl & 16) { bitAnd &= tri; xorSum |= tri; }
    if (ctrl & 32) { bitAnd &= saw; xorSum |= saw; }
    if (ctrl & 64) { bitAnd &= pulse; xorSum |= pulse; }
    if (ctrl & 128) { bitAnd &= noise; xorSum |= noise; }

    let xorVal = xorSum ^ bitAnd;
    let bleed = ((xorVal & 0x0F) >> 1) + ((xorVal & 0xF0) >> 3);
    if ((ctrl & 64) && pulse === 0) bleed >>= 1; 

    let out = bitAnd + bleed + 0x12;
    return Math.min(255, Math.max(0, out));
}