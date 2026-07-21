// === js/worklets/lib/sid-luts.js ===
// =========================================================
// MOS 6581 HARDWARE LOOKUP TABLES (LUTs)
// Pre-computed physical anomalies, bit-weight errors & non-linear curves
// =========================================================

export const DAC_LUT = new Float32Array(256);
export const CUTOFF_LUT = new Float32Array(2048);
export const PWM_LUT = new Uint16Array(4096);

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
// Real MOS 6581 R2/R4 FET Range: 30 Hz (Sub-Bass) bis ~5800 Hz (Max Cutoff)
// Beseitigt den Maultrommel-Effekt und gibt dem Bass seine echte C64-Tiefe!
for (let i = 0; i < 2048; i++) {
    let norm = i / 2047.0;
    
    // Gemessene 6581 NMOS FET-Kurve (30Hz bis 5800Hz)
    let hz = 30.0 + (Math.pow(norm, 1.5) * 5770.0);
    
    if (hz < 30) hz = 30;
    if (hz > 5800) hz = 5800;
    CUTOFF_LUT[i] = hz;
}

// 3. GENERATE PWM COMPARATOR OFFSET (4096 Entries)
for (let i = 0; i < 4096; i++) {
    let shifted = i + 76; 
    if (shifted > 4095) shifted = 4095;
    PWM_LUT[i] = shifted;
}