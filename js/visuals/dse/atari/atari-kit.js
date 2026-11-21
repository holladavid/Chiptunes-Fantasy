// =========================================================
// ATARI ST SHIFTER KIT (Immutable 9-Bit Palettes & Ramps)
// Gemeinsame unveraenderliche Farbtabellen & Ping-Pong-Indizes.
// Kein DSE-Modul — wird nicht in registry.js eingetragen.
// =========================================================

import { quantizeAtari9Bit, rgbToHex } from '../../utils/hardware-constraints.js';

export function st(r, g, b) {
    const [R, G, B] = quantizeAtari9Bit(r * 36, g * 36, b * 36);
    return rgbToHex(R, G, B);
}

export const INK = st(0, 0, 0);     // '#000000'
export const WHITE = st(7, 7, 7);   // '#fcfcfc' (Max 9-Bit-Wert 252!)

export const RAMPS = Object.freeze({
    RED5: Object.freeze([st(1, 0, 0), st(3, 0, 0), st(5, 1, 0), st(7, 3, 1), st(7, 6, 3)]),
    GRN5: Object.freeze([st(0, 1, 0), st(0, 3, 1), st(1, 5, 1), st(3, 7, 2), st(6, 7, 4)]),
    BLU5: Object.freeze([st(0, 0, 2), st(0, 1, 4), st(1, 3, 6), st(3, 5, 7), st(5, 6, 7)]),
    AMB5: Object.freeze([st(1, 1, 0), st(3, 2, 0), st(5, 4, 0), st(7, 6, 1), st(7, 7, 4)]),
    CYN5: Object.freeze([st(0, 1, 1), st(0, 3, 3), st(1, 5, 5), st(3, 7, 6), st(5, 7, 7)]),
    VIO5: Object.freeze([st(1, 0, 2), st(2, 0, 4), st(4, 1, 6), st(6, 3, 7), st(7, 6, 7)])
});

export const FAM = Object.freeze([
    RAMPS.CYN5,
    RAMPS.VIO5,
    RAMPS.AMB5,
    RAMPS.GRN5
]);

export const WFAM = Object.freeze([
    RAMPS.BLU5,
    RAMPS.CYN5,
    RAMPS.VIO5,
    RAMPS.AMB5
]);

export const SETS = Object.freeze([
    Object.freeze([RAMPS.RED5, RAMPS.GRN5, RAMPS.BLU5]),
    Object.freeze([RAMPS.AMB5, RAMPS.CYN5, RAMPS.VIO5])
]);

export const COOL = Object.freeze([
    RAMPS.BLU5,
    RAMPS.CYN5,
    RAMPS.VIO5
]);

export const RING_HUE = Object.freeze([
    st(7, 2, 1), st(6, 4, 0), st(4, 5, 0), st(2, 6, 1),
    st(1, 6, 3), st(0, 5, 5), st(0, 4, 6), st(1, 3, 7),
    st(3, 2, 7), st(5, 2, 7), st(6, 2, 6), st(7, 2, 5),
    st(7, 3, 4), st(7, 2, 2)
]);

export function pp(len) {
    const n = Math.max(1, Math.floor(len));
    if (n === 1) return Object.freeze([0]);
    const out = [];
    for (let i = 0; i < n; i++) out.push(i);
    for (let i = n - 2; i >= 1; i--) out.push(i);
    return Object.freeze(out);
}

export const PP5 = pp(5);