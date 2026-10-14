// === js/worklets/lib/sid-luts.js ===
// =========================================================
// MOS 6581 & CSG 8580 HARDWARE LOOKUP TABLES (LUTs)
// v1.5.0: True NMOS Wire-AND Pulse-Gating & R-2R Neighbor
// Pulldown Physics for $30, $50, $60, $70 + Exact 12-Bit PWM
// =========================================================

export const DAC_LUT = new Float32Array(256);
export const DAC_LUT_6581_R3 = new Float32Array(256);
export const DAC_LUT_8580 = new Float32Array(256);
export const CUTOFF_LUT = new Float32Array(2048);
export const PWM_LUT = new Uint16Array(4096);

// =========================================================
// 1. GENERATE PHYSICAL MOS 6581 R3 DAC FINGERPRINT (256 Entries)
// =========================================================
const bitWeights6581 = [1.00, 1.98, 3.92, 8.08, 15.82, 31.90, 63.20, 127.10];
let maxWeight6581 = 0;
for (let b of bitWeights6581) maxWeight6581 += b;

for (let i = 0; i < 256; i++) {
    let sum = 0;
    for (let b = 0; b < 8; b++) {
        if (i & (1 << b)) sum += bitWeights6581[b];
    }
    let v = sum / maxWeight6581;
    let vKinked = v + 0.05 * v * (1.0 - v); 
    let vSaturated = 1.10 * vKinked - 0.11 * Math.pow(vKinked, 3.0);
    
    DAC_LUT_6581_R3[i] = Math.max(0.0, Math.min(1.0, vSaturated));
    DAC_LUT[i] = DAC_LUT_6581_R3[i]; 
}

// =========================================================
// 2. GENERATE CSG 8580 HMOS-II DAC FINGERPRINT (Linear R-2R)
// =========================================================
for (let i = 0; i < 256; i++) {
    DAC_LUT_8580[i] = i / 255.0;
}

// =========================================================
// 3. GENERATE REAL 6581 FILTER CUTOFF CURVE (2048 Entries)
// =========================================================
for (let i = 0; i < 2048; i++) {
    let norm = i / 2047.0;
    let hz = 30.0 + (1200.0 * norm) + (7200.0 * norm * norm) - (2230.0 * norm * norm * norm);
    if (hz < 30) hz = 30;
    if (hz > 6200) hz = 6200;
    CUTOFF_LUT[i] = hz;
}

// =========================================================
// 4. GENERATE EXACT 12-BIT PWM COMPARATOR LUT (4096 Entries)
// PW = $000 is true flat DC (0), eliminating false 1.8% buzz
// =========================================================
PWM_LUT[0] = 0;
for (let i = 1; i < 4096; i++) {
    PWM_LUT[i] = i < 4 ? 4 : i;
}

// =========================================================
// 5. C64 HARDWARE ADSR RATE COUNTER PERIODS
// =========================================================
export const RATE_COUNTER_PERIOD = [
    9, 32, 63, 95, 149, 220, 267, 313, 
    392, 977, 1954, 3126, 3907, 11720, 19530, 31256
];

// =========================================================
// 6. GENERATE ANALOG WIRE-AND WAVEFORM LUTS (NMOS Bus Physics)
// Models R-2R neighbor-bit pulldown & active Pulse-Low bus grounding
// =========================================================
export const WAVE_LUT_TRISAW = new Uint8Array(65536);
export const WAVE_LUT_TRIPULSE = new Uint8Array(512); 
export const WAVE_LUT_SAWPULSE = new Uint8Array(512);
export const WAVE_LUT_TRISAWPULSE = new Uint8Array(131072);

// Helper: Simulates NMOS open-drain R-2R neighbor-bit pulldown on an 8-bit bus
function nmosNeighborPulldown(val, strength) {
    let out = 0;
    for (let b = 0; b < 8; b++) {
        if (val & (1 << b)) {
            let pull = 1.0;
            if (b > 0 && (val & (1 << (b - 1))) === 0) pull -= strength * 0.45;
            if (b < 7 && (val & (1 << (b + 1))) === 0) pull -= strength * 0.65;
            if (pull > 0.38) out |= (1 << b);
        }
    }
    return out;
}

// $30: Triangle + Sawtooth
for (let tri = 0; tri < 256; tri++) {
    for (let saw = 0; saw < 256; saw++) {
        let andVal = nmosNeighborPulldown(tri & saw, 0.55);
        let triBleed = (tri & ~saw) * 0.14; 
        let sawBleed = (saw & ~tri) * 0.10; 
        let out = andVal + triBleed + sawBleed; 
        WAVE_LUT_TRISAW[(tri << 8) | saw] = Math.min(255, Math.floor(out));
    }
}

// $50: Triangle + Pulse (Chris Hülsbeck Glassy PWM Lead / Giana Sisters)
// When Pulse == 0 (pIdx = 0), all 12 Pulse selector FETs pull the Wire-AND bus to ground!
// When Pulse == 1 (pIdx = 1), Triangle drives the bus with NMOS neighbor-bit pulldown.
for (let tri = 0; tri < 256; tri++) {
    WAVE_LUT_TRIPULSE[(0 << 8) | tri] = Math.floor(tri * 0.04); 
    let activeTri = nmosNeighborPulldown(tri, 0.42);
    WAVE_LUT_TRIPULSE[(1 << 8) | tri] = Math.min(255, Math.floor(activeTri * 0.85 + tri * 0.15));
}

// $60: Sawtooth + Pulse (Maniacs of Noise / Martin Galway Bass & Reed Lead)
for (let saw = 0; saw < 256; saw++) {
    WAVE_LUT_SAWPULSE[(0 << 8) | saw] = Math.floor(saw * 0.03);
    let activeSaw = nmosNeighborPulldown(saw, 0.48);
    WAVE_LUT_SAWPULSE[(1 << 8) | saw] = Math.min(255, Math.floor(activeSaw * 0.84 + saw * 0.16));
}

// $70: Triangle + Sawtooth + Pulse
for (let tri = 0; tri < 256; tri++) {
    for (let saw = 0; saw < 256; saw++) {
        let baseTriSaw = WAVE_LUT_TRISAW[(tri << 8) | saw];
        WAVE_LUT_TRISAWPULSE[(0 << 16) | (tri << 8) | saw] = 0;
        WAVE_LUT_TRISAWPULSE[(1 << 16) | (tri << 8) | saw] = Math.min(255, Math.floor(baseTriSaw * 0.90));
    }
}