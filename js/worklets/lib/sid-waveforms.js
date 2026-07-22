// === js/worklets/lib/sid-waveforms.js ===
// =========================================================
// MOS 6581 WAVEFORM GENERATOR & BIT-LOGIC
// Hardware-accurate 8-Bit DAC quantization & Floating DC Bias
// Phase 5: PWM_LUT NMOS Comparator Integration & Wire-AND Bleed
// 100% Integer Bitwise Operations (Zero Allocations / Zero Floats)
// =========================================================

import { PWM_LUT } from './sid-luts.js';

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
        // Map 12-bit PW value through NMOS comparator LUT with strict < threshold
        let pwMapped = PWM_LUT[pw12 & 0xFFF];
        pulse = (testPhase < pwMapped) ? 0xFF : 0x00;
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
    // NMOS TRANSISTOR BIT-WEIGHTED WIRE-AND (MOS 6581)
    // MSBs (Bits 4-7) haben größere Transistoren -> starrer Pull-Down.
    // LSBs (Bits 0-3) haben höheren Ron -> Sicker-Signal / Bleed.
    // =========================================================

    // 1. TRIANGLE + SAWTOOTH ($30)
    if (waveMask === 0x30) {
        let andVal = tri & saw;
        let xorVal = tri ^ saw;
        let bleed = ((xorVal & 0x0F) >> 1) + ((xorVal & 0xF0) >> 3);
        return Math.min(255, andVal + bleed + 0x04);
    }

    // 2. TRIANGLE + PULSE ($50)
    if (waveMask === 0x50) {
        if (pulse === 0xFF) {
            let xorVal = tri ^ 0xFF;
            let bleed = ((xorVal & 0x0F) >> 1) + ((xorVal & 0xF0) >> 3);
            return Math.min(255, tri + bleed + 0x06);
        }
        let bleed = ((tri & 0x0F) >> 1) + ((tri & 0xF0) >> 3);
        return Math.min(255, bleed + 0x08);
    }

    // 3. SAWTOOTH + PULSE ($60) - THE MON / GALWAY BASS!
    if (waveMask === 0x60) {
        if (pulse === 0xFF) {
            let xorVal = saw ^ 0xFF;
            let bleed = ((xorVal & 0x0F) >> 1) + ((xorVal & 0xF0) >> 3);
            return Math.min(255, saw + bleed + 0x06);
        }
        let bleed = ((saw & 0x0F) >> 1) + ((saw & 0xF0) >> 3);
        return Math.min(255, bleed + 0x0B);
    }

    // 4. TRIANGLE + SAWTOOTH + PULSE ($70)
    if (waveMask === 0x70) {
        let triSaw = tri & saw;
        if (pulse === 0xFF) {
            let xorVal = triSaw ^ 0xFF;
            let bleed = ((xorVal & 0x0F) >> 1) + ((xorVal & 0xF0) >> 3);
            return Math.min(255, triSaw + bleed + 0x08);
        }
        let bleed = ((triSaw & 0x0F) >> 1) + ((triSaw & 0xF0) >> 3);
        return Math.min(255, bleed + 0x0A);
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