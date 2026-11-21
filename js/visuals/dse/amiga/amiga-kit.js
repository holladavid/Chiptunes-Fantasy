// =========================================================
// AMIGA OCS/ECS SHARED DATA KIT (Immutable Ramps & Helpers)
// 12-Bit-RGB Paletten (Nibble * 17) als #rrggbb ueber
// quantizeAmiga12Bit + rgbToHex fuer Fake-Canvas & Browser.
// =========================================================

import { quantizeAmiga12Bit, rgbToHex } from '../../utils/hardware-constraints.js';

function q12(shortHex) {
    const r = parseInt(shortHex[1], 16) * 17;
    const g = parseInt(shortHex[2], 16) * 17;
    const b = parseInt(shortHex[3], 16) * 17;
    const [qr, qg, qb] = quantizeAmiga12Bit(r, g, b);
    return rgbToHex(qr, qg, qb);
}

function freezeRamp(shortHexes) {
    return Object.freeze(shortHexes.map(q12));
}

export const INK = q12('#000');
export const SNOW = q12('#fff');

export const RAMPS = Object.freeze({
    MAGMA:  freezeRamp(['#200', '#501', '#a12', '#e42', '#f93', '#fd7']),
    OCEAN:  freezeRamp(['#003', '#016', '#05a', '#28d', '#5bf', '#aef']),
    JADE:   freezeRamp(['#021', '#043', '#076', '#1a8', '#4db', '#9fd']),
    VIOLET: freezeRamp(['#102', '#313', '#626', '#94a', '#c7d', '#ecf']),
    GOLD:   freezeRamp(['#210', '#430', '#760', '#a90', '#dc2', '#ff8']),
    STEEL:  freezeRamp(['#112', '#223', '#445', '#668', '#99a', '#cce'])
});

export const FAM = Object.freeze(['OCEAN', 'MAGMA', 'JADE', 'VIOLET']);
export const CH_RAMPS = Object.freeze(['MAGMA', 'OCEAN', 'JADE', 'GOLD']);
export const COOL = Object.freeze(['OCEAN', 'STEEL', 'OCEAN', 'STEEL']);

// Exakte Links-nach-Rechts-Reihenfolge der 4 Paula-Kanaele wie in paula-silicon-bg.js (L-R-R-L)
export const PAULA_LRRL = Object.freeze([0, 3, 1, 2]);

// Angeglichen an StageManager.TRANSITION_TIME = 1.5
export const TRANSITION_IN = 1.5;
export const TRANSITION_OUT = 1.5;

export function pp(length) {
    const n = Math.max(1, Math.floor(length));
    if (n === 1) return Object.freeze([0]);
    const out = [];
    for (let i = 0; i < n; i++) out.push(i);
    for (let i = n - 2; i >= 1; i--) out.push(i);
    return Object.freeze(out);
}

export const PP6 = pp(6);