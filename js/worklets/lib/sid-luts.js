// === js/worklets/lib/sid-luts.js ===
// =========================================================
// MOS 6581 HARDWARE LOOKUP TABLES (LUTs)
// Pre-computed physical anomalies, bit-weight errors & non-linear curves
// =========================================================

export const DAC_LUT = new Float32Array(256);
export const CUTOFF_LUT = new Float32Array(2048);
export const PWM_LUT = new Uint16Array(4096);
export const OPAMP_LUT = new Float32Array(2048);

// 1. GENERATE 6581 DAC CURVE (256 Entries)
const bitWeights = [1.00, 2.01, 3.98, 8.05, 15.90, 32.15, 63.70, 128.50];
let maxWeight = 0;
for (let b of bitWeights) maxWeight += b;

for (let i = 0; i < 256; i++) {
    let sum = 0;
    for (let b = 0; b < 8; b++) {
        if (i & (1 << b)) sum += bitWeights[b];
    }
    let v = sum / maxWeight;
    DAC_LUT[i] = v + 0.12 * v * (1.0 - v);
}

// 2. GENERATE REAL 6581 FILTER CUTOFF CURVE (2048 Entries)
// Midrange-preserving S-curve JFET mapping: 30 Hz (Sub-Bass) to ~6200 Hz (Max 6581 NMOS Cutoff)
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

// 4. GENERATE 6581 OPAMP SATURATION TABLE (2048 Entries)
// Pre-computed non-linear OpAmp transfer function (-4.0V to +4.0V input)
for (let i = 0; i < 2048; i++) {
    let vin = (i - 1024) / 256.0; // Input range -4.0 to +4.0 V
    // Non-linear JFET OpAmp transfer curve matching 6581 die measurements
    OPAMP_LUT[i] = Math.tanh(vin * 1.15) / 1.05;
}