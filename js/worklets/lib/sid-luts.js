// === js/worklets/lib/sid-luts.js ===
// =========================================================
// MOS 6581 HARDWARE LOOKUP TABLES (LUTs)
// Phase 5: Physical Measured MOS 6581 R3 DAC Fingerprint
// =========================================================

export const DAC_LUT = new Float32Array(256);
export const CUTOFF_LUT = new Float32Array(2048);
export const PWM_LUT = new Uint16Array(4096);

// 1. GENERATE PHYSICAL 6581 R3 DAC FINGERPRINT (256 Entries)
// Measured NMOS R-2R ladder bit-weights with termination non-linearities
const bitWeights6581 = [1.00, 1.98, 3.92, 8.08, 15.82, 31.90, 63.20, 127.10];
let maxWeight = 0;
for (let b of bitWeights6581) maxWeight += b;

for (let i = 0; i < 256; i++) {
    let sum = 0;
    for (let b = 0; b < 8; b++) {
        if (i & (1 << b)) sum += bitWeights6581[b];
    }
    let v = sum / maxWeight;
    // Physical NMOS channel termination non-linearity
    DAC_LUT[i] = v + 0.08 * v * (1.0 - v);
}

// 2. GENERATE REAL 6581 FILTER CUTOFF CURVE (2048 Entries)
for (let i = 0; i < 2048; i++) {
    let norm = i / 2047.0;
    let hz = 30.0 + (1200.0 * norm) + (7200.0 * norm * norm) - (2230.0 * norm * norm * norm);
    if (hz < 30) hz = 30;
    if (hz > 6200) hz = 6200;
    CUTOFF_LUT[i] = hz;
}

// 3. GENERATE PWM COMPARATOR OFFSET (4096 Entries)
for (let i = 0; i < 4096; i++) {
    let shifted = i + 76; 
    if (shifted > 4096) shifted = 4096;
    PWM_LUT[i] = shifted;
}

// 4. GENERATE 15-BIT XNOR LFSR TARGETS FOR ADSR RATE COUNTER
const RATE_COUNTER_PERIOD = [9, 32, 63, 95, 149, 220, 267, 313, 392, 977, 1954, 3126, 3907, 11720, 19530, 31256];
export const ADSR_LFSR_TARGETS = new Uint16Array(16);

let adsrLfsr = 0x0000;
for (let step = 0; step <= 32767; step++) {
    let idx = RATE_COUNTER_PERIOD.indexOf(step);
    if (idx !== -1) {
        ADSR_LFSR_TARGETS[idx] = adsrLfsr;
    }
    let bit = (~((adsrLfsr >> 14) ^ (adsrLfsr >> 13))) & 1;
    adsrLfsr = ((adsrLfsr << 1) | bit) & 0x7FFF;
}

// =========================================================
// 5. GENERATE ANALOG WIRE-AND WAVEFORM LUTS (Zero-Allocation Physics)
// =========================================================

export const WAVE_LUT_TRISAW = new Uint8Array(65536);
export const WAVE_LUT_TRIPULSE = new Uint8Array(512); 
export const WAVE_LUT_SAWPULSE = new Uint8Array(512);
export const WAVE_LUT_TRISAWPULSE = new Uint8Array(131072);

// $30: Triangle + Sawtooth
for (let tri = 0; tri < 256; tri++) {
    for (let saw = 0; saw < 256; saw++) {
        let andVal = tri & saw;
        let triBleed = (tri & ~saw) * 0.18; 
        let sawBleed = (saw & ~tri) * 0.12; 
        let out = andVal + triBleed + sawBleed + 8; 
        WAVE_LUT_TRISAW[(tri << 8) | saw] = Math.min(255, Math.floor(out));
    }
}

// $50: Triangle + Pulse (Hülsbeck Glassy Lead / Engelsstimme)
for (let tri = 0; tri < 256; tri++) {
    WAVE_LUT_TRIPULSE[(0 << 8) | tri] = Math.min(255, Math.floor(tri * 0.86 + 14)); 
    WAVE_LUT_TRIPULSE[(1 << 8) | tri] = tri;
}

// $60: Sawtooth + Pulse (Maniacs of Noise Bass)
for (let saw = 0; saw < 256; saw++) {
    WAVE_LUT_SAWPULSE[(0 << 8) | saw] = Math.min(255, Math.floor((saw & 0xFE) * 0.25 + 18));
    WAVE_LUT_SAWPULSE[(1 << 8) | saw] = Math.min(255, Math.floor(saw * 0.95 + 6));
}

// $70: Triangle + Sawtooth + Pulse
for (let tri = 0; tri < 256; tri++) {
    for (let saw = 0; saw < 256; saw++) {
        let baseTriSaw = WAVE_LUT_TRISAW[(tri << 8) | saw];
        WAVE_LUT_TRISAWPULSE[(0 << 16) | (tri << 8) | saw] = Math.min(255, Math.floor(baseTriSaw * 0.25 + 14));
        WAVE_LUT_TRISAWPULSE[(1 << 16) | (tri << 8) | saw] = Math.min(255, Math.floor(baseTriSaw * 0.88 + 8));
    }
}