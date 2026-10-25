// Independently fitted MOS 6581 R3 filter calibration.
// Source: black-box EXT IN frequency-response measurements of libresidfp
// c1791383ca843a855e5d4366da6a7277e34e801d. No reference source code or
// internal tables are imported. See test/fixtures/sid-r3-filter-reference.json.

export const SID_FILTER_SUBCLOCK = 1970496;
export const HP_GAIN_6581_R3 = Math.SQRT1_2; // documented -3 dB mixer tap
// Residual modal feedthrough fitted from the reference stopband floors.
export const BP_FEEDTHROUGH_6581_R3 = 0.24;
export const HP_FEEDTHROUGH_6581_R3 = 0.08;

const FC_POINTS = [0, 256, 512, 768, 1024, 1280, 1536, 1792, 2047];
const CUTOFF_POINTS = [
    240.00, 250.96, 1768.67, 4926.26, 7859.61,
    9242.60, 11041.01, 12693.17, 14123.64
];
const DAMPING_POINTS = [
    1.19, 1.25, 1.47, 1.49, 1.78,
    1.34, 1.45, 1.57, 1.69
];
const RESONANCE_SLOPE_POINTS = [
    0.055, 0.055, 0.054, 0.060, 0.066,
    0.060, 0.055, 0.055, 0.055
];

function interpolate(points, values, register) {
    let upper = 1;
    while (upper < points.length - 1 && register > points[upper]) upper++;
    const lower = upper - 1;
    const span = points[upper] - points[lower];
    const fraction = (register - points[lower]) / span;
    return values[lower] + (values[upper] - values[lower]) * fraction;
}

export const CUTOFF_HZ_6581_R3 = new Float32Array(2048);
export const FILTER_DAMPING_6581_R3 = new Float32Array(2048 * 16);

// Setup-time only: playback and measurement hot paths read these typed arrays.
for (let register = 0; register < 2048; register++) {
    CUTOFF_HZ_6581_R3[register] = interpolate(FC_POINTS, CUTOFF_POINTS, register);
    const baseDamping = interpolate(FC_POINTS, DAMPING_POINTS, register);
    const resonanceSlope = interpolate(FC_POINTS, RESONANCE_SLOPE_POINTS, register);
    const row = register * 16;
    for (let resonance = 0; resonance < 16; resonance++) {
        FILTER_DAMPING_6581_R3[row + resonance] =
            Math.max(0.35, baseDamping - resonance * resonanceSlope);
    }
}
