// =========================================================
// DEMO-SCENE-ELEMENT: ATARI ST RETRO SUNSET (IK+ TORII & BONSAI)
// 100% DOM-free 9-bit Shifter palette rendering via pure fillRect:
// Timer-B rasterized 10-band sunset sky & lake reflection,
// clean OutRun/ST sliced sun, dual-ridge twilight valley mountains,
// asymmetric pixel-art dusk clouds, curved Myojin Torii with Kanji
// plaque, glowing Toro lanterns, lush Moyogi S-curve Pine Bonsai with
// 5 cloud tiers, settling fallen leaves on courtyard stones, IK+ Sprite
// choreography, & Zen moonlit afterglow.
// =========================================================

import { quantizeAtari9Bit, rgbToHex } from '../../utils/hardware-constraints.js';
import {
    IK_SPRITE_FRAMES,
    resolveFighterPalette,
    drawGroundShadow,
    drawCompiledSprite,
    drawFighterTrailingDetail,
    drawStrikeSparks
} from './ik-fighter-sprites.js';

const TWO_PI = Math.PI * 2;
const TRANSITION_DURATION = 1.5;
const PETAL_POOL_SIZE = 18;

// 4x4 Bayer threshold matrix (0..15)
const BAYER_4X4 = Object.freeze([
    0, 8, 2, 10,
    12, 4, 14, 6,
    3, 11, 1, 9,
    15, 7, 13, 5
]);

// 10-Stop Timer-B Raster Sky Palettes (Warm Sunset -> Zen Moonlit Dusk)
const SKY_SUNSET_RGB = Object.freeze([
    [0, 0, 72],     // Deep Prussian dusk zenith
    [36, 0, 72],    // Nocturnal indigo
    [72, 0, 72],    // Deep twilight plum
    [108, 0, 72],   // Rich dusk purple
    [144, 0, 72],   // Crimson magenta
    [180, 36, 72],  // Warm rose-crimson
    [216, 36, 36],  // Sunset vermilion
    [252, 72, 36],  // Fiery tangerine
    [252, 144, 36], // Golden amber glow
    [252, 216, 108] // Warm horizon mist
]);

const SKY_AFTERGLOW_RGB = Object.freeze([
    [0, 0, 36],
    [0, 0, 72],
    [0, 36, 72],
    [36, 36, 108],
    [36, 72, 108],
    [72, 72, 144],
    [72, 108, 144],
    [108, 108, 180],
    [108, 144, 180],
    [144, 144, 216]
]);

// 5-Stop Timer-B Lake Water Palettes
const WATER_SUNSET_RGB = Object.freeze([
    [108, 36, 108],
    [72, 36, 144],
    [36, 72, 180],
    [0, 36, 144],
    [0, 36, 108]
]);

const WATER_AFTERGLOW_RGB = Object.freeze([
    [36, 36, 108],
    [0, 36, 108],
    [0, 36, 72],
    [0, 0, 72],
    [0, 0, 36]
]);

// 3 Asymmetric Hand-Pixeled Dusk Cloud Silhouettes (zero UFO symmetry!)
// Offsets normalized to cloud radius r; sunSide (+1/-1) flips towards scene center.
const CLOUD_SHAPES = Object.freeze([
    Object.freeze({
        puffs: [
            { dx: -0.75, dy: -0.18, rx: 1.05, ry: 0.56 },
            { dx:  0.22, dy:  0.04, rx: 1.25, ry: 0.44 },
            { dx:  1.15, dy:  0.22, rx: 0.90, ry: 0.28 },
            { dx: -1.55, dy:  0.14, rx: 0.65, ry: 0.30 }
        ],
        wisps: [
            { dx: -2.35, dy: 0.28, w: 1.45 },
            { dx:  1.65, dy: 0.26, w: 1.35 }
        ],
        rim: { dx: -0.25, w: 1.75 }
    }),
    Object.freeze({
        puffs: [
            { dx:  0.60, dy: -0.24, rx: 0.92, ry: 0.52 },
            { dx: -0.35, dy: -0.06, rx: 1.15, ry: 0.45 },
            { dx: -1.30, dy:  0.16, rx: 0.85, ry: 0.28 },
            { dx:  1.45, dy:  0.12, rx: 0.72, ry: 0.30 }
        ],
        wisps: [
            { dx: -2.40, dy: 0.22, w: 1.55 },
            { dx:  0.95, dy: 0.32, w: 1.40 }
        ],
        rim: { dx: 0.15, w: 1.65 }
    }),
    Object.freeze({
        puffs: [
            { dx: -0.20, dy: -0.12, rx: 1.35, ry: 0.42 },
            { dx:  0.95, dy: -0.22, rx: 0.75, ry: 0.38 },
            { dx: -1.45, dy:  0.08, rx: 0.95, ry: 0.26 },
            { dx:  1.65, dy:  0.14, rx: 0.65, ry: 0.22 }
        ],
        wisps: [
            { dx: -2.75, dy: 0.18, w: 1.90 },
            { dx:  1.80, dy: 0.22, w: 1.30 }
        ],
        rim: { dx: 0.10, w: 1.95 }
    })
]);

// Precompute all 512 Atari ST 9-bit RGB hex colors once
const ATARI_HEX_LUT = (() => {
    const lut = new Array(512);
    for (let r3 = 0; r3 < 8; r3++) {
        for (let g3 = 0; g3 < 8; g3++) {
            for (let b3 = 0; b3 < 8; b3++) {
                const [qr, qg, qb] = quantizeAtari9Bit(r3 * 36, g3 * 36, b3 * 36);
                lut[(r3 << 6) | (g3 << 3) | b3] = rgbToHex(qr, qg, qb);
            }
        }
    }
    return Object.freeze(lut);
})();

// Precomputed half-width LUT for integer circles radii 1..40
const CIRCLE_HALF_WIDTHS = (() => {
    const tables = [null];
    for (let r = 1; r <= 40; r++) {
        const hw = new Int8Array(r * 2 + 1);
        const rSq = r * r;
        for (let dy = -r; dy <= r; dy++) {
            hw[dy + r] = Math.floor(Math.sqrt(Math.max(0, rSq - dy * dy)));
        }
        tables.push(hw);
    }
    return Object.freeze(tables);
})();

// =========================================================
// IK+ CHOREOGRAPHY MOVE CATALOG (50 Hz PAL-ALIGNED TIMINGS)
// =========================================================
const MOVES = Object.freeze({
    IDLE: Object.freeze({
        tier: 0, air: false, canCancelAt: 0.0, peakHeight: 0, dxTotal: 0,
        frames: ['IDLE_0'], durations: [0.20]
    }),
    STEP_FORWARD: Object.freeze({
        tier: 0, air: false, canCancelAt: 0.25, peakHeight: 0, dxTotal: 12,
        frames: ['STEP_PASS', 'STEP_REACH', 'IDLE_2'], durations: [0.08, 0.10, 0.06]
    }),
    GLIDE_ADVANCE: Object.freeze({
        tier: 0, air: false, canCancelAt: 0.35, peakHeight: 0, dxTotal: 18,
        frames: ['STEP_PASS', 'STEP_REACH', 'STEP_PASS', 'IDLE_0'], durations: [0.08, 0.10, 0.08, 0.06]
    }),
    BOW_OPEN: Object.freeze({
        tier: 0, air: false, canCancelAt: 0.70, peakHeight: 0, dxTotal: 0,
        frames: ['BOW_READY', 'BOW_DEEP', 'BOW_READY', 'IDLE_0'], durations: [0.18, 0.34, 0.16, 0.12]
    }),
    BOW_CLOSE: Object.freeze({
        tier: 0, air: false, canCancelAt: 1.0, peakHeight: 0, dxTotal: 0,
        frames: ['BOW_READY', 'BOW_DEEP', 'BOW_READY'], durations: [0.20, 0.50, 0.40]
    }),
    JAB: Object.freeze({
        tier: 1, air: false, canCancelAt: 0.50, peakHeight: 0, dxTotal: 4,
        frames: ['JAB_CHAMBER', 'JAB_EXTEND', 'JAB_CHAMBER'], durations: [0.06, 0.12, 0.06]
    }),
    PARRY_HIGH: Object.freeze({
        tier: 1, air: false, canCancelAt: 0.45, peakHeight: 0, dxTotal: 0,
        frames: ['BLOCK_HIGH', 'IDLE_2'], durations: [0.16, 0.08]
    }),
    PARRY_LOW: Object.freeze({
        tier: 1, air: false, canCancelAt: 0.45, peakHeight: 0, dxTotal: 0,
        frames: ['BLOCK_LOW', 'IDLE_1'], durations: [0.16, 0.08]
    }),
    FRONT_KICK: Object.freeze({
        tier: 1, air: false, canCancelAt: 0.55, peakHeight: 0, dxTotal: 4,
        frames: ['KICK_CHAMBER', 'FRONT_KICK', 'KICK_CHAMBER'], durations: [0.06, 0.14, 0.06]
    }),
    ROUNDHOUSE: Object.freeze({
        tier: 2, air: false, canCancelAt: 0.58, peakHeight: 0, dxTotal: 8,
        frames: ['KICK_CHAMBER', 'ROUNDHOUSE_KICK', 'KICK_CHAMBER', 'IDLE_0'], durations: [0.06, 0.18, 0.08, 0.06]
    }),
    LOW_SWEEP: Object.freeze({
        tier: 2, air: false, canCancelAt: 0.62, peakHeight: 0, dxTotal: 9,
        frames: ['CROUCH_PREP', 'SWEEP_DROP', 'SWEEP_EXTEND', 'SWEEP_DROP'], durations: [0.06, 0.06, 0.18, 0.08]
    }),
    LUNGE_PUNCH: Object.freeze({
        tier: 2, air: false, canCancelAt: 0.58, peakHeight: 0, dxTotal: 11,
        frames: ['STEP_PASS', 'JAB_CHAMBER', 'LUNGE_PUNCH', 'STEP_REACH'], durations: [0.06, 0.04, 0.18, 0.08]
    }),
    HIGH_KICK: Object.freeze({
        tier: 3, air: false, canCancelAt: 0.65, peakHeight: 0, dxTotal: 5,
        frames: ['KICK_CHAMBER', 'HIGH_KICK_RISE', 'HIGH_KICK', 'HIGH_KICK_RISE', 'KICK_CHAMBER'],
        durations: [0.06, 0.06, 0.20, 0.06, 0.06]
    }),
    FLYING_KICK: Object.freeze({
        tier: 3, air: true, canCancelAt: 0.86, peakHeight: 15, dxTotal: 20,
        frames: ['CROUCH_PREP', 'JUMP_LAUNCH', 'FLYING_KICK', 'JUMP_LAUNCH', 'CROUCH_PREP'],
        durations: [0.06, 0.08, 0.24, 0.06, 0.06]
    }),
    SPLIT_KICK: Object.freeze({
        tier: 3, air: true, canCancelAt: 0.86, peakHeight: 16, dxTotal: 0,
        frames: ['CROUCH_PREP', 'JUMP_LAUNCH', 'SPLIT_KICK', 'JUMP_LAUNCH', 'CROUCH_PREP'],
        durations: [0.06, 0.08, 0.24, 0.06, 0.06]
    }),
    BACKFLIP: Object.freeze({
        tier: 3, air: true, canCancelAt: 0.88, peakHeight: 17, dxTotal: -17,
        frames: ['CROUCH_PREP', 'BACKFLIP_1', 'BACKFLIP_2', 'BACKFLIP_3', 'BACKFLIP_4', 'CROUCH_PREP'],
        durations: [0.06, 0.08, 0.08, 0.10, 0.08, 0.06]
    })
});

const MOVE_TOTAL_DURATIONS = (() => {
    const map = {};
    const names = Object.keys(MOVES);
    for (let i = 0; i < names.length; i++) {
        const name = names[i];
        const durs = MOVES[name].durations;
        let sum = 0;
        for (let j = 0; j < durs.length; j++) sum += durs[j];
        map[name] = sum;
    }
    return Object.freeze(map);
})();

function toAtariHex(r, g, b) {
    const r3 = r <= 0 ? 0 : (r >= 252 ? 7 : Math.round(r / 36));
    const g3 = g <= 0 ? 0 : (g >= 252 ? 7 : Math.round(g / 36));
    const b3 = b <= 0 ? 0 : (b >= 252 ? 7 : Math.round(b / 36));
    return ATARI_HEX_LUT[(r3 << 6) | (g3 << 3) | b3];
}

function clamp01(v) {
    if (!Number.isFinite(v)) return 0;
    return v < 0 ? 0 : (v > 1 ? 1 : v);
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function mixHex(rgbA, rgbB, t) {
    return toAtariHex(lerp(rgbA[0], rgbB[0], t), lerp(rgbA[1], rgbB[1], t), lerp(rgbA[2], rgbB[2], t));
}

function readChannel(arr, idx, fallback) {
    if (!arr || idx >= arr.length) return fallback;
    return clamp01(arr[idx]);
}

function easeOutQuad(t) {
    const u = 1.0 - t;
    return 1.0 - u * u;
}

function avalancheHash32(x) {
    let h = x | 0;
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return h >>> 0;
}

function fillClippedRect(ctx, x, y, rw, rh, bufW, bufH, minY = 0, maxY = bufH) {
    let x0 = Math.floor(x);
    let y0 = Math.floor(y);
    let x1 = Math.floor(x + rw);
    let y1 = Math.floor(y + rh);
    if (x0 < 0) x0 = 0;
    if (y0 < minY) y0 = minY;
    if (x1 > bufW) x1 = bufW;
    if (y1 > maxY) y1 = maxY;
    const cw = x1 - x0;
    const ch = y1 - y0;
    if (cw > 0 && ch > 0) {
        ctx.fillRect(x0, y0, cw, ch);
    }
}

function fillClippedCircle(ctx, cx, cy, r, colorHex, bufW, maxY, minY = 0) {
    const ri = Math.floor(r);
    if (ri <= 0) return;
    const icx = Math.floor(cx);
    const icy = Math.floor(cy);
    if (icx + ri < 0 || icx - ri >= bufW || icy - ri >= maxY || icy + ri < minY) return;

    ctx.fillStyle = colorHex;
    const hw = ri < CIRCLE_HALF_WIDTHS.length ? CIRCLE_HALF_WIDTHS[ri] : null;
    const rSq = ri * ri;

    for (let dy = -ri; dy <= ri; dy++) {
        const py = icy + dy;
        if (py < minY || py >= maxY) continue;
        const dx = hw ? hw[dy + ri] : Math.floor(Math.sqrt(Math.max(0, rSq - dy * dy)));
        const x0 = Math.max(0, icx - dx);
        const x1 = Math.min(bufW, icx + dx + 1);
        const cw = x1 - x0;
        if (cw > 0) ctx.fillRect(x0, py, cw, 1);
    }
}

function fillClippedEllipse(ctx, cx, cy, rx, ry, colorHex, bufW, maxY, minY = 0) {
    const irx = Math.floor(rx);
    const iry = Math.floor(ry);
    if (irx <= 0 || iry <= 0) return;
    const icx = Math.floor(cx);
    const icy = Math.floor(cy);
    if (icx + irx < 0 || icx - irx >= bufW || icy - iry >= maxY || icy + iry < minY) return;

    ctx.fillStyle = colorHex;
    for (let dy = -iry; dy <= iry; dy++) {
        const py = icy + dy;
        if (py < minY || py >= maxY) continue;
        const norm = dy / (iry + 0.35);
        const dx = Math.floor(irx * Math.sqrt(Math.max(0, 1.0 - norm * norm)));
        const x0 = Math.max(0, icx - dx);
        const x1 = Math.min(bufW, icx + dx + 1);
        const cw = x1 - x0;
        if (cw > 0) ctx.fillRect(x0, py, cw, 1);
    }
}

function bonsaiTrunkOffset(u, treeScale) {
    return -Math.sin(u * Math.PI * 2.25) * (treeScale * (0.095 - 0.035 * u));
}

function drawTaperedBranch(ctx, x0, y0, cx, cy, x1, y1, rStart, rEnd, colDark, colMid, colLit, bufW, bufH) {
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
        const s = i / steps;
        const inv = 1.0 - s;
        const bx = inv * inv * x0 + 2 * inv * s * cx + s * s * x1;
        const by = inv * inv * y0 + 2 * inv * s * cy + s * s * y1;
        const r = Math.max(1, Math.round(rStart + (rEnd - rStart) * s));

        if (r === 1) {
            ctx.fillStyle = colDark;
            fillClippedRect(ctx, bx, by + 1, 2, 1, bufW, bufH);
            ctx.fillStyle = colMid;
            fillClippedRect(ctx, bx, by, 2, 1, bufW, bufH);
        } else {
            fillClippedCircle(ctx, bx, by + 1, r, colDark, bufW, bufH);
            fillClippedCircle(ctx, bx, by, r, colMid, bufW, bufH);
            if (r >= 2) {
                ctx.fillStyle = colLit;
                fillClippedRect(ctx, bx - Math.floor(r * 0.5), by - r + 1, Math.max(1, Math.floor(r * 1.1)), 1, bufW, bufH);
            }
        }
    }
}

// 5 Asymmetric Japanese Moyogi Pine Bonsai Cloud Pads (lush fuller green volume)
const BONSAI_PADS = Object.freeze([
    { uAttach: 0.34, padX: -0.185, padFracY: 0.56, rx: 0.108, ry: 0.042, bBendX: -0.11, bBendY: 0.59, rStart: 0.025, rEnd: 0.010, leaves: 44 },
    { uAttach: 0.48, padX:  0.125, padFracY: 0.43, rx: 0.095, ry: 0.039, bBendX:  0.07, bBendY: 0.47, rStart: 0.022, rEnd: 0.009, leaves: 40 },
    { uAttach: 0.66, padX: -0.130, padFracY: 0.25, rx: 0.092, ry: 0.037, bBendX: -0.05, bBendY: 0.29, rStart: 0.019, rEnd: 0.008, leaves: 38 },
    { uAttach: 0.80, padX:  0.088, padFracY: 0.16, rx: 0.078, ry: 0.032, bBendX:  0.04, bBendY: 0.19, rStart: 0.015, rEnd: 0.007, leaves: 32 },
    { uAttach: 0.96, padX: -0.025, padFracY: 0.02, rx: 0.090, ry: 0.038, bBendX: -0.03, bBendY: 0.05, rStart: 0.013, rEnd: 0.006, leaves: 38 }
]);

const SHRINES = Object.freeze([
    { xDir: -1, z: 0.85 }, { xDir: 1, z: 0.85 },
    { xDir: -1, z: 0.55 }, { xDir: 1, z: 0.55 },
    { xDir: -1, z: 0.25 }, { xDir: 1, z: 0.25 },
    { xDir: -1, z: 0.05 }, { xDir: 1, z: 0.05 }
]);

const SKY_STARS = Object.freeze([
    { x: 0.06, y: 0.07, p: 0.4 }, { x: 0.16, y: 0.12, p: 1.9 },
    { x: 0.29, y: 0.05, p: 3.1 }, { x: 0.42, y: 0.14, p: 4.6 },
    { x: 0.57, y: 0.08, p: 2.2 }, { x: 0.69, y: 0.04, p: 5.1 },
    { x: 0.82, y: 0.11, p: 1.1 }, { x: 0.93, y: 0.07, p: 3.8 }
]);

export class AtariRetroSunset {
    constructor() {
        this.name = 'Atari Retro Sunset';

        // Time & state tracking
        this.lastT = null;
        this.lastState = 'idle';
        this.stateAge = 0;

        // Continuous simulation phases (preserved across resize/rotation)
        this.internalT = 0;
        this.waterT = 0;
        this.smoothedSpeed = 1.0;
        this.afterglowMix = 0.0;

        // Discrete beat-driven state
        this.lastBeatCount = 0;
        this.beatParity = 0;
        this.waterWaveAge = 10.0;
        this.waterWavePeak = 0.0;

        // Instance-owned deterministic Xorshift32 PRNG (zero Math.random!)
        this.prngState = 0x494B2B53; // 'IK+S'
        this.appearanceCount = 0;

        // Preallocated per-frame Timer-B ramp buffers (Zero-GC!)
        this.skyRamp = new Array(SKY_SUNSET_RGB.length).fill('#000000');
        this.waterRamp = new Array(WATER_SUNSET_RGB.length).fill('#000000');

        // Normalized drifting cloud states (mapped to 3 asymmetric cloud shapes)
        this.clouds = [
            { shapeIdx: 0, y: 0.16, normX: 0.14, r: 0.044, speed: -0.018 },
            { shapeIdx: 1, y: 0.25, normX: 0.68, r: 0.052, speed: 0.024 },
            { shapeIdx: 2, y: 0.35, normX: 0.26, r: 0.045, speed: -0.012 }
        ];

        // Deterministic Bonsai cloud-pad foliage leaves (rich rounded pine foliage!)
        this.treeLeaves = [];
        for (let c = 0; c < BONSAI_PADS.length; c++) {
            const pad = BONSAI_PADS[c];
            for (let i = 0; i < pad.leaves; i++) {
                const angle = this._nextRandom() * TWO_PI;
                const dist = Math.sqrt(this._nextRandom());
                const sinA = Math.sin(angle);
                const roll = this._nextRandom();
                let colType;
                if (sinA < -0.30) {
                    colType = roll > 0.35 ? 1 : 2; // Sunlit fresh pine needles on upper ridge
                } else if (sinA > 0.20) {
                    colType = roll > 0.25 ? 0 : 2; // Rich deep evergreen underside
                } else {
                    colType = roll > 0.45 ? 2 : (roll > 0.15 ? 0 : 1);
                }
                this.treeLeaves.push({
                    padIdx: c,
                    dx: Math.cos(angle) * dist * pad.rx,
                    dy: (sinA > 0 ? sinA * 0.45 : sinA) * dist * pad.ry,
                    r: Math.floor(this._nextRandom() * 3) + 2,
                    colType,
                    phase: this._nextRandom() * TWO_PI
                });
            }
        }

        // Preallocated falling & settling Bonsai leaves/petals pool
        this.petals = Array.from({ length: PETAL_POOL_SIZE }, () => ({
            active: false,
            landed: false,
            xFrac: 0.8,
            yFrac: 0.3,
            landYFrac: 0.82,
            vx: -0.03,
            vy: 0.09,
            phase: 0,
            restAge: 0,
            restDuration: 3.2,
            variant: 0
        }));

        // IK+ Sprite Fighter State
        this.fighter = {
            style: null,
            xNorm: 0.0,
            facing: 1,
            moveName: 'IDLE',
            moveElapsed: 0,
            moveDuration: 0.20,
            jumpY: 0,
            timeSinceBeat: 2.0,
            idlePhase: 0,
            trailPhase: 0,
            sparkAge: 1.0,
            sparkFrameName: 'IDLE_0',
            moveSeq: 0,
            afterglowSettled: false,
            paletteTable: new Array(19).fill('')
        };
    }

    _nextRandom() {
        let x = this.prngState | 0;
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        this.prngState = x;
        return (x >>> 0) / 4294967296;
    }

    _rollFighterOnFadeIn(safeT, beatCount, isStarting) {
        this.appearanceCount++;
        const prngRoll = Math.floor(this._nextRandom() * 0x7fffffff);
        const tickSeed = Math.round(safeT * 50) | 0;
        const mixed = avalancheHash32(prngRoll ^ tickSeed ^ (beatCount | 0) ^ (this.appearanceCount * 0x9e3779b9));
        const f = this.fighter;
        f.style = (mixed & 1) === 0 ? 'karateka' : 'kaempferin';
        f.xNorm = 0.0;
        f.facing = ((mixed >>> 1) & 1) === 0 ? 1 : -1;
        f.jumpY = 0;
        f.timeSinceBeat = 2.0;
        f.sparkAge = 1.0;
        f.afterglowSettled = false;
        f.moveSeq = 0;
        if (isStarting) {
            this._startFighterMove('BOW_OPEN');
        } else {
            this._startFighterMove('IDLE');
        }
    }

    _startFighterMove(moveName) {
        const f = this.fighter;
        f.moveName = moveName;
        f.moveElapsed = 0;
        f.moveDuration = MOVE_TOTAL_DURATIONS[moveName] || 0.20;
    }

    _chooseFighterMove(state, beatLevel, beatCount, tension) {
        const f = this.fighter;
        const isFemale = f.style === 'kaempferin';
        f.moveSeq++;

        if (f.xNorm > 0.80) f.facing = -1;
        else if (f.xNorm < -0.80) f.facing = 1;
        else if (beatCount > 0 && (beatCount % 8) === 0) {
            f.facing = -f.facing;
        }

        const roll = this._nextRandom();

        if (beatLevel >= 3) {
            if (state === 'climax' || (state === 'buildup' && tension > 0.45)) {
                const canBackflip = (f.facing > 0 && f.xNorm > -0.60) || (f.facing < 0 && f.xNorm < 0.60);
                if (canBackflip && roll < (isFemale ? 0.30 : 0.24)) return 'BACKFLIP';
                if (roll < (isFemale ? 0.58 : 0.46)) return 'SPLIT_KICK';
                if (roll < 0.84) return 'FLYING_KICK';
                return 'HIGH_KICK';
            }
            if (beatCount > 0 && (beatCount % 4) === 0 && roll < 0.42) return 'SPLIT_KICK';
            return roll < 0.72 ? 'HIGH_KICK' : 'ROUNDHOUSE';
        }

        if (beatLevel === 2) {
            if (state === 'climax' && roll < 0.22) return 'FLYING_KICK';
            if (roll < (isFemale ? 0.44 : 0.32)) return 'ROUNDHOUSE';
            if (roll < 0.68) return 'LOW_SWEEP';
            return 'LUNGE_PUNCH';
        }

        if (state === 'buildup' || state === 'climax') {
            if (roll < 0.30) return 'FRONT_KICK';
            if (roll < 0.56) return 'JAB';
            if (roll < 0.82) return 'GLIDE_ADVANCE';
            return (f.moveSeq & 1) === 0 ? 'PARRY_HIGH' : 'PARRY_LOW';
        }
        if (roll < 0.28) return 'JAB';
        if (roll < 0.56) return 'FRONT_KICK';
        if (roll < 0.78) return 'STEP_FORWARD';
        return (f.moveSeq & 1) === 0 ? 'PARRY_HIGH' : 'PARRY_LOW';
    }

    _updateFighterChoreography(dt, state, beatStarted, beatCount, beatLevel, beatImpulse, tension, energy, ymBass, ymMid, ymHigh, roamRadius) {
        const f = this.fighter;
        f.timeSinceBeat = Math.min(10.0, f.timeSinceBeat + dt);
        f.sparkAge = Math.min(1.0, f.sparkAge + dt);
        f.trailPhase = (f.trailPhase + dt * (5.5 + tension * 4.5 + ymHigh * 5.0 + beatImpulse * 6.0)) % TWO_PI;

        const speedScale = state === 'afterglow' ? 0.65 : (state === 'climax' ? 1.18 : (state === 'buildup' ? 1.08 : 0.96));
        const activeMove = MOVES[f.moveName] || MOVES.IDLE;
        const prevProgress = f.moveDuration > 0 ? clamp01(f.moveElapsed / f.moveDuration) : 1.0;

        if (state === 'stopping') {
            if (f.jumpY <= 0.1 && f.moveName !== 'BOW_CLOSE') {
                this._startFighterMove('BOW_CLOSE');
            }
        } else if (state === 'afterglow') {
            if (f.jumpY <= 0.1 && !f.afterglowSettled && f.moveName !== 'BOW_CLOSE' && f.moveName !== 'IDLE') {
                this._startFighterMove('BOW_CLOSE');
                f.afterglowSettled = true;
            } else if (f.moveName === 'BOW_CLOSE' && prevProgress >= 1.0) {
                this._startFighterMove('IDLE');
            }
        } else if (beatStarted && state !== 'starting') {
            f.timeSinceBeat = 0;
            const allowOverride =
                f.moveName === 'IDLE' ||
                f.moveName === 'STEP_FORWARD' ||
                f.moveName === 'GLIDE_ADVANCE' ||
                f.moveName === 'BOW_OPEN' ||
                (!activeMove.air && prevProgress >= activeMove.canCancelAt) ||
                (activeMove.air && prevProgress >= 0.86);

            if (allowOverride) {
                const nextMove = this._chooseFighterMove(state, beatLevel, beatCount, tension);
                this._startFighterMove(nextMove);
                if (beatLevel >= 3 && (state === 'buildup' || state === 'climax')) {
                    f.sparkAge = 0;
                    const chosen = MOVES[nextMove];
                    const midIdx = Math.min(chosen.frames.length - 1, Math.floor(chosen.frames.length * 0.5));
                    f.sparkFrameName = chosen.frames[midIdx];
                }
            }
        } else if (
            state !== 'starting' &&
            f.moveName === 'IDLE' &&
            f.timeSinceBeat > 0.68 &&
            roamRadius > 14
        ) {
            if (f.xNorm > 0.78) f.facing = -1;
            else if (f.xNorm < -0.78) f.facing = 1;
            this._startFighterMove(state === 'playing' ? 'STEP_FORWARD' : 'GLIDE_ADVANCE');
            f.timeSinceBeat = 0.22;
        }

        const curMove = MOVES[f.moveName] || MOVES.IDLE;
        f.moveElapsed += dt * speedScale;
        const progress = f.moveDuration > 0 ? clamp01(f.moveElapsed / f.moveDuration) : 1.0;

        if (curMove.dxTotal !== 0 && roamRadius > 2) {
            const deltaEase = Math.max(0, easeOutQuad(progress) - easeOutQuad(prevProgress));
            const dxWorld = curMove.dxTotal * deltaEase * f.facing;
            const normStep = dxWorld / Math.max(16, roamRadius);
            f.xNorm = Math.max(-0.95, Math.min(0.95, f.xNorm + normStep));
        }

        if (curMove.air) {
            const airT = clamp01((progress - 0.12) / 0.76);
            f.jumpY = Math.sin(airT * Math.PI) * curMove.peakHeight;
        } else {
            f.jumpY = Math.max(0, f.jumpY - dt * 60);
        }

        if (progress >= 1.0 && f.moveName !== 'IDLE') {
            if (f.moveName === 'BOW_CLOSE' && (state === 'stopping' || state === 'afterglow')) {
                f.moveElapsed = f.moveDuration;
            } else {
                this._startFighterMove('IDLE');
                f.jumpY = 0;
            }
        }

        if (f.moveName !== 'IDLE') {
            const durs = curMove.durations;
            let acc = 0;
            let frameKey = curMove.frames[curMove.frames.length - 1];
            for (let i = 0; i < durs.length; i++) {
                acc += durs[i];
                if (f.moveElapsed <= acc) {
                    frameKey = curMove.frames[i];
                    break;
                }
            }
            return frameKey;
        }

        const bounceRate = state === 'afterglow' ? 1.8 : (3.4 + energy * 3.0 + ymBass * 2.2);
        f.idlePhase = (f.idlePhase + dt * bounceRate) % TWO_PI;

        if (state === 'afterglow') {
            return Math.sin(f.idlePhase) > 0.15 ? 'ZEN_KATA_B' : 'ZEN_KATA_A';
        }

        if (f.timeSinceBeat > 1.35 && state !== 'stopping') {
            const kataCycle = (this.internalT * (0.65 + energy * 0.45)) % 4.0;
            if (kataCycle > 2.6 && ymMid > 0.25) return 'ZEN_KATA_B';
            if (kataCycle > 1.8) return 'ZEN_KATA_A';
        }

        const bounce = Math.sin(f.idlePhase);
        if (bounce < -0.35) return 'IDLE_1';
        if (bounce > 0.45 && (ymBass > 0.35 || beatImpulse > 0.2)) return 'IDLE_2';
        return 'IDLE_0';
    }

    _spawnPetals(count) {
        let spawned = 0;
        for (let i = 0; i < this.petals.length && spawned < count; i++) {
            const p = this.petals[i];
            if (!p.active) {
                p.active = true;
                p.landed = false;
                p.xFrac = 0.68 + this._nextRandom() * 0.22;
                p.yFrac = 0.26 + this._nextRandom() * 0.18;
                p.landYFrac = 0.72 + this._nextRandom() * 0.23; // Lands across stone path
                p.vx = -(0.035 + this._nextRandom() * 0.055);
                p.vy = 0.09 + this._nextRandom() * 0.08;
                p.phase = this._nextRandom() * TWO_PI;
                p.restAge = 0;
                p.restDuration = 2.6 + this._nextRandom() * 1.8;
                p.variant = Math.floor(this._nextRandom() * 3);
                spawned++;
            }
        }
    }

    resize() {
        // Clouds, shrines, Torii, Bonsai and fighter xNorm scale proportionally;
        // character identity, phases and choreography persist cleanly across rotations.
    }

    _drawTimerBRamp(ctx, w, yStart, yEnd, ramp, stepX) {
        const y0 = Math.floor(yStart);
        const y1 = Math.floor(yEnd);
        const spanH = y1 - y0;
        if (spanH <= 0 || w <= 0) return;

        const maxIdx = ramp.length - 1;
        let runColor = null;
        let runStartY = y0;

        for (let y = y0; y < y1; y++) {
            const norm = spanH <= 1 ? 0 : (y - y0) / (spanH - 1);
            const pos = norm * maxIdx;
            const idx = Math.min(maxIdx, Math.floor(pos));
            const baseCol = ramp[idx];
            if (baseCol !== runColor) {
                if (runColor !== null) {
                    ctx.fillStyle = runColor;
                    ctx.fillRect(0, runStartY, w, y - runStartY);
                }
                runColor = baseCol;
                runStartY = y;
            }
        }
        if (runColor !== null) {
            ctx.fillStyle = runColor;
            ctx.fillRect(0, runStartY, w, y1 - runStartY);
        }

        if (spanH < 10) return;
        const sx = Math.max(1, stepX);
        const period = sx * 2;
        for (let y = y0; y < y1; y++) {
            const norm = (y - y0) / (spanH - 1);
            const pos = norm * maxIdx;
            const idx = Math.floor(pos);
            if (idx >= maxIdx) continue;
            const frac = pos - idx;
            if (frac >= 0.42 && frac <= 0.88) {
                ctx.fillStyle = ramp[idx + 1];
                const offset = (y & 1) * sx;
                for (let x = offset; x < w; x += period) {
                    const cw = Math.min(sx, w - x);
                    if (cw > 0) ctx.fillRect(x, y, cw, 1);
                }
            }
        }
    }

    // Irregular hand-pixeled dusk clouds with wispy asymmetric tails & sunset rim
    _drawIrregularCloud(ctx, cx, cy, r, shapeIdx, cShadow, cMid, cLit, w, horizon, towardSunX) {
        const shape = CLOUD_SHAPES[shapeIdx % CLOUD_SHAPES.length];
        const dir = towardSunX >= 0 ? 1 : -1;

        // 1. Dark upper/rear silhouette puffs
        for (let i = 0; i < shape.puffs.length; i++) {
            const pf = shape.puffs[i];
            const px = cx + pf.dx * r * dir;
            const py = cy + pf.dy * r;
            fillClippedEllipse(ctx, px, py, Math.max(2, pf.rx * r), Math.max(1, pf.ry * r), cShadow, w, horizon);
        }

        // 2. Trailing wispy cloud streaks at staggered heights
        ctx.fillStyle = cShadow;
        for (let i = 0; i < shape.wisps.length; i++) {
            const ws = shape.wisps[i];
            const ww = Math.max(2, Math.floor(ws.w * r));
            const wx = dir > 0 ? (cx + ws.dx * r) : (cx - ws.dx * r - ww);
            const wy = Math.min(horizon - 1, Math.floor(cy + ws.dy * r));
            fillClippedRect(ctx, wx, wy, ww, 1, w, horizon);
        }

        // 3. Warm rose-purple lit inner puffs shifted slightly sunward & down
        const shiftX = dir * Math.max(1, Math.floor(r * 0.12));
        for (let i = 0; i < shape.puffs.length; i++) {
            const pf = shape.puffs[i];
            const px = cx + pf.dx * r * dir + shiftX;
            const py = cy + pf.dy * r + Math.max(1, Math.floor(r * 0.14));
            fillClippedEllipse(ctx, px, py, Math.max(2, pf.rx * r * 0.80), Math.max(1, pf.ry * r * 0.72), cMid, w, horizon);
        }

        // 4. Crisp irregular sunset-kissed lower rim facing setting sun
        const rimW = Math.max(3, Math.floor(shape.rim.w * r));
        const rimX = cx + shape.rim.dx * r * dir - Math.floor(rimW * 0.5) + shiftX;
        const rimY = Math.min(horizon - 1, cy + Math.max(1, Math.floor(r * 0.34)));
        ctx.fillStyle = cLit;
        fillClippedRect(ctx, rimX, rimY, rimW, 1, w, horizon);
        if (r >= 5) {
            fillClippedRect(ctx, rimX + Math.floor(rimW * 0.18), rimY - 1, Math.max(2, Math.floor(rimW * 0.56)), 1, w, horizon);
        }
    }

    _drawPowerCurtain(ctx, w, h, horizon, revealRatio) {
        const skyActiveTop = Math.min(horizon, Math.max(0, Math.ceil(horizon * (1.0 - revealRatio))));
        const floorHeight = Math.max(1, h - horizon);
        const floorActiveBottom = Math.min(h, Math.max(horizon, horizon + Math.floor(floorHeight * revealRatio)));

        ctx.fillStyle = '#000000';
        if (skyActiveTop > 0) ctx.fillRect(0, 0, w, skyActiveTop);
        if (floorActiveBottom < h) ctx.fillRect(0, floorActiveBottom, w, h - floorActiveBottom);

        const bandPx = Math.max(4, Math.min(16, Math.floor(h * 0.07)));
        const stepX = Math.max(2, Math.min(4, Math.floor(w * 0.02)));
        const stepY = 2;

        const topEnd = Math.min(horizon, skyActiveTop + bandPx);
        for (let y = skyActiveTop; y < topEnd; y += stepY) {
            const vis = (y - skyActiveTop + 1) / bandPx;
            const bayerRow = ((y >> 1) & 3) * 4;
            for (let x = 0; x < w; x += stepX) {
                if (BAYER_4X4[bayerRow + ((x >> 2) & 3)] >= vis * 16) {
                    const bw = Math.min(stepX, w - x);
                    const bh = Math.min(stepY, topEnd - y);
                    if (bw > 0 && bh > 0) ctx.fillRect(x, y, bw, bh);
                }
            }
        }

        const botStart = Math.max(horizon, floorActiveBottom - bandPx);
        for (let y = botStart; y < floorActiveBottom; y += stepY) {
            const vis = (floorActiveBottom - y) / bandPx;
            const bayerRow = ((y >> 1) & 3) * 4;
            for (let x = 0; x < w; x += stepX) {
                if (BAYER_4X4[bayerRow + ((x >> 2) & 3)] >= vis * 16) {
                    const bw = Math.min(stepX, w - x);
                    const bh = Math.min(stepY, floorActiveBottom - y);
                    if (bw > 0 && bh > 0) ctx.fillRect(x, y, bw, bh);
                }
            }
        }
    }

    render(ctx, width, height, t, state, stateTime, metrics) {
        const safeT = Number.isFinite(t) ? t : (this.lastT !== null ? this.lastT : 0);

        if (
            !ctx ||
            !Number.isFinite(width) ||
            !Number.isFinite(height) ||
            width <= 0 ||
            height <= 0 ||
            !Number.isFinite(width / height)
        ) {
            this.lastT = safeT;
            return;
        }

        const w = Math.floor(width);
        const h = Math.floor(height);
        if (w <= 0 || h <= 0) {
            this.lastT = safeT;
            return;
        }

        if (state === 'idle') {
            this.lastT = safeT;
            this.lastState = 'idle';
            this.stateAge = 0;
            this.fighter.style = null;
            for (let i = 0; i < this.petals.length; i++) {
                this.petals[i].active = false;
                this.petals[i].landed = false;
            }
            return;
        }

        let dt = this.lastT === null ? 0.02 : (safeT - this.lastT);
        this.lastT = safeT;
        if (!Number.isFinite(dt) || dt < 0) dt = 0.02;
        else if (dt > 0.1) dt = 0.1;

        const prevState = this.lastState;
        if (this.lastState !== state) {
            this.lastState = state;
            this.stateAge = 0;
        } else {
            this.stateAge += dt;
        }

        // ---------------------------------------------------------
        // Defensive metric parsing (Atari YM2149 channels)
        // ---------------------------------------------------------
        const safeMetrics = metrics || {};
        const energy = clamp01(safeMetrics.energy ?? 0.35);
        const tension = clamp01(safeMetrics.tensionPct ?? 0.3);
        const isClimaxLocked = Boolean(safeMetrics.isClimaxLocked);

        const beatArr = safeMetrics.beat;
        const beatEnv = beatArr && beatArr.length > 0 ? clamp01(beatArr[0]) : 0;

        const impulseArr = safeMetrics.beatImpulse;
        const beatImpulse = impulseArr && impulseArr.length > 0
            ? clamp01(impulseArr[0])
            : beatEnv;

        const beatStarted = Boolean(safeMetrics.beatStarted);
        const beatStrength = Number.isFinite(safeMetrics.beatStrength)
            ? clamp01(safeMetrics.beatStrength)
            : beatImpulse;
        const beatLevel = Number.isFinite(safeMetrics.beatLevel) ? safeMetrics.beatLevel : 0;

        const smooth = (Array.isArray(safeMetrics.smooth) || ArrayBuffer.isView(safeMetrics.smooth))
            ? safeMetrics.smooth
            : null;
        const ymBass = readChannel(smooth, 0, energy);
        const ymMid = readChannel(smooth, 1, energy * 0.85);
        const ymHigh = readChannel(smooth, 2, energy * 0.7);

        // ---------------------------------------------------------
        // Roll Fighter Archetype ONCE per Fade-In
        // ---------------------------------------------------------
        const enteringStage = (state === 'starting' && (prevState === 'idle' || prevState === 'stopping'));
        if (enteringStage || this.fighter.style === null) {
            this._rollFighterOnFadeIn(safeT, safeMetrics.beatCount || 0, state === 'starting');
        }

        // ---------------------------------------------------------
        // Discrete Beat Events (strictly gated on beatStarted)
        // ---------------------------------------------------------
        let acceptedBeat = false;
        let acceptedBeatCount = this.lastBeatCount;
        let acceptedLevel = beatLevel;
        const allowPetals = (state === 'buildup' || state === 'climax');

        if (beatStarted) {
            const incomingCount = Number.isFinite(safeMetrics.beatCount)
                ? Math.floor(safeMetrics.beatCount)
                : (this.lastBeatCount + 1);

            if (incomingCount !== this.lastBeatCount || !Number.isFinite(safeMetrics.beatCount)) {
                this.lastBeatCount = incomingCount;
                this.beatParity = incomingCount & 1;
                acceptedBeat = true;
                acceptedBeatCount = incomingCount;

                this.waterWaveAge = 0;
                const levelWeight = beatLevel >= 3 ? 1.0 : (beatLevel === 2 ? 0.65 : (beatLevel === 1 ? 0.35 : 0.0));
                this.waterWavePeak = Math.max(beatStrength, levelWeight);

                if (acceptedLevel <= 0 && beatStrength > 0) {
                    acceptedLevel = beatStrength >= (2 / 3) ? 3 : (beatStrength >= (1 / 3) ? 2 : 1);
                }

                if (allowPetals) {
                    this._spawnPetals(acceptedLevel >= 3 ? 3 : 1);
                }
            }
        }

        this.waterWaveAge = Math.min(10.0, this.waterWaveAge + dt);

        // ---------------------------------------------------------
        // Macro State Dynamics & Zen Afterglow
        // ---------------------------------------------------------
        let targetSpeed = 1.0 + tension * 0.35;
        let targetAfterglow = 0.0;

        if (state === 'starting') {
            targetSpeed = 0.85;
        } else if (state === 'playing') {
            targetSpeed = 0.95 + tension * 0.35;
        } else if (state === 'buildup') {
            targetSpeed = 1.45 + tension * 0.50;
        } else if (state === 'climax') {
            targetSpeed = 2.25 + tension * 0.65 + (isClimaxLocked ? 0.2 : 0);
        } else if (state === 'afterglow') {
            targetSpeed = 0.30;
            targetAfterglow = 1.0;
        } else if (state === 'stopping') {
            targetSpeed = 0.40;
        }

        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * Math.min(1.0, dt * 4.0);
        this.afterglowMix += (targetAfterglow - this.afterglowMix) * Math.min(1.0, dt * 2.0);
        const ag = this.afterglowMix;

        const speedMult = this.smoothedSpeed;
        this.internalT = (this.internalT + dt * speedMult) % 4096;
        this.waterT = (this.waterT + dt * (speedMult + beatImpulse * 0.7)) % 4096;

        // ---------------------------------------------------------
        // Transition Progress (starting / stopping)
        // ---------------------------------------------------------
        let revealRatio = 1.0;
        if (state === 'starting') {
            revealRatio = clamp01((this.stateAge + 0.08) / TRANSITION_DURATION);
        } else if (state === 'stopping') {
            revealRatio = 1.0 - clamp01(this.stateAge / TRANSITION_DURATION);
            if (revealRatio <= 0.001) {
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, w, h);
                return;
            }
        }

        const horizon = Math.min(h - 3, Math.max(2, Math.floor(h * 0.55)));
        const minDim = Math.min(w, h);
        const cx = Math.floor(w * 0.5);
        const shoreY = Math.min(h - 2, horizon + Math.max(3, Math.floor(minDim * 0.15)));
        const stepX = w > 480 ? 3 : 2;

        // ---------------------------------------------------------
        // Dynamic 9-bit Timer-B Palettes (Sunset -> Zen Moonlit Dusk)
        // ---------------------------------------------------------
        for (let i = 0; i < SKY_SUNSET_RGB.length; i++) {
            this.skyRamp[i] = mixHex(SKY_SUNSET_RGB[i], SKY_AFTERGLOW_RGB[i], ag);
        }
        for (let i = 0; i < WATER_SUNSET_RGB.length; i++) {
            this.waterRamp[i] = mixHex(WATER_SUNSET_RGB[i], WATER_AFTERGLOW_RGB[i], ag);
        }

        const cStar = mixHex([252, 216, 180], [216, 216, 252], ag);
        const cCloudShadow = mixHex([72, 0, 72], [36, 36, 72], ag);
        const cCloudMid = mixHex([144, 36, 108], [72, 72, 108], ag);
        const cCloudLit = mixHex([252, 144, 108], [180, 180, 216], ag);
        const cCloudFlare = mixHex([252, 216, 144], [216, 216, 252], ag);

        const cSunTop = mixHex([252, 252, 144], [252, 252, 252], ag);
        const cSunMid = mixHex([252, 216, 0], [216, 216, 252], ag);
        const cSunLow = mixHex([252, 144, 0], [144, 144, 180], ag);
        const cSunBase = mixHex([252, 72, 0], [108, 108, 144], ag);
        const cSunCorona = mixHex([252, 180, 72], [144, 144, 216], ag);
        const cSunSlit = mixHex([216, 36, 36], [72, 108, 144], ag);

        const cWaterRefl = mixHex([252, 216, 72], [216, 216, 252], ag);
        const cWaterRefl2 = mixHex([252, 108, 36], [108, 144, 180], ag);
        const cWaterRim = mixHex([108, 144, 180], [72, 108, 144], ag);

        const cMountFar = mixHex([72, 0, 72], [36, 36, 72], ag);
        const cMountNear = mixHex([36, 0, 36], [0, 0, 36], ag);
        const cMountRim = mixHex([144, 36, 72], [72, 72, 108], ag);

        const cTorii = mixHex([72, 0, 0], [0, 0, 36], ag);
        const cToriiDark = mixHex([36, 0, 0], [0, 0, 36], ag);
        const cToriiHigh = mixHex([144, 36, 0], [72, 36, 72], ag);
        const kanjiGlow = (0.72 + 0.28 * ymMid + 0.42 * beatImpulse) * (1.0 - 0.55 * ag);
        const cKanji = toAtariHex(252 * kanjiGlow, 180 * kanjiGlow, 36 * kanjiGlow * (beatImpulse > 0.55 ? 2.5 : 1.0));

        const pathContrast = 1.0 + 0.14 * ymMid;
        const cPathLight = mixHex([180 * pathContrast, 180 * pathContrast, 180 * pathContrast], [108, 108, 144], ag);
        const cStoneMid = mixHex([108, 108, 108], [72, 72, 108], ag);
        const cPathDark = mixHex([72, 72, 72], [36, 36, 72], ag);
        const cStoneDark = mixHex([36, 36, 36], [36, 36, 72], ag);
        const cStoneLine = toAtariHex(0, 0, 0);
        const cLanternFlame = toAtariHex(
            252 * (0.75 + 0.25 * ymMid + 0.3 * beatImpulse) * (1.0 - 0.45 * ag),
            180 * (0.65 + 0.35 * ymMid) * (1.0 - 0.40 * ag),
            lerp(36, 144, ag)
        );

        // Lush Japanese Pine Bonsai palette
        const cTreeDark = mixHex([72, 36, 0], [36, 0, 36], ag);
        const cTreeTrunk = mixHex([108, 72, 36], [72, 36, 36], ag);
        const cTreeLit = mixHex([180, 108, 72], [108, 72, 72], ag);
        const cLeafShadow = mixHex([0, 36, 0], [0, 36, 36], ag);
        const cLeafCols = [
            mixHex([36, 108, 36], [0, 72, 36], ag),      // Deep evergreen pine core
            mixHex([108, 180, 36], [72, 144, 108], ag),  // Fresh sunlit pine needles
            mixHex([72, 144, 36], [36, 108, 72], ag)     // Lush vibrant mid pine green
        ];
        // Distinct fallen leaf hues so settled leaves stand out crisply on gray courtyard stones
        const cFallenLeaves = [
            mixHex([216, 144, 0], [108, 108, 180], ag),
            mixHex([180, 72, 0], [72, 72, 144], ag),
            mixHex([36, 108, 36], [36, 72, 108], ag)
        ];
        const cMoss = mixHex([36, 108, 36], [36, 72, 72], ag);

        const baseSunR = Math.max(3, Math.floor(minDim * 0.125));
        const sunBoost = (0.65 * beatImpulse + 0.35 * ymBass) * (1.0 - 0.65 * ag);
        const activeSunR = baseSunR + Math.floor(sunBoost * minDim * 0.040);
        const sunValleyClear = Math.ceil(activeSunR * 1.15) + 2;

        // ---------------------------------------------------------
        // 1. TIMER-B RASTER SKY + DUSK STARS
        // ---------------------------------------------------------
        this._drawTimerBRamp(ctx, w, 0, horizon, this.skyRamp, stepX);

        if (horizon >= 20) {
            const starZoneH = Math.floor(horizon * 0.45);
            for (let i = 0; i < SKY_STARS.length; i++) {
                const st = SKY_STARS[i];
                const sx = Math.floor(st.x * w);
                const sy = Math.floor(st.y * horizon);
                if (sy >= starZoneH) continue;
                const tw = Math.sin(this.internalT * 2.1 + st.p) + ymHigh * 0.4 + ag * 0.6;
                if (tw > 0.35) {
                    ctx.fillStyle = tw > 1.05 ? cSunTop : cStar;
                    fillClippedRect(ctx, sx, sy, 1, 1, w, horizon);
                }
            }
        }

        // ---------------------------------------------------------
        // 2. ASYMMETRIC PIXEL-ART DUSK CLOUDS
        // ---------------------------------------------------------
        for (let i = 0; i < this.clouds.length; i++) {
            const c = this.clouds[i];
            c.normX = (((c.normX + dt * c.speed * speedMult) % 1.0) + 1.0) % 1.0;

            const cy = Math.floor(horizon * c.y);
            const rSize = Math.max(2, Math.floor(minDim * c.r));
            const span = w + rSize * 5;
            const finalX = Math.floor(c.normX * span - rSize * 2.5);
            const towardSun = finalX < cx ? 1 : -1;
            const litCol = (ymHigh > 0.65 && !ag) ? cCloudFlare : cCloudLit;

            this._drawIrregularCloud(ctx, finalX, cy, rSize, c.shapeIdx, cCloudShadow, cCloudMid, litCol, w, horizon, towardSun);
        }

        // ---------------------------------------------------------
        // 3. DUAL-LAYER TWILIGHT MOUNTAINS (Clear of Setting Sun!)
        // ---------------------------------------------------------
        if (horizon >= 10) {
            const farLeftEnd = Math.max(1, Math.min(Math.floor(w * 0.42), cx - sunValleyClear));
            const farRightStart = Math.min(w - 2, Math.max(Math.floor(w * 0.58), cx + sunValleyClear));

            ctx.fillStyle = cMountFar;
            for (let x = 0; x <= farLeftEnd; x++) {
                const u = x / farLeftEnd;
                const mh = Math.floor(horizon * Math.max(0, (1.0 - u) * 0.36 + Math.sin(u * 6.5) * 0.035 * (1.0 - u)));
                if (mh > 0) fillClippedRect(ctx, x, horizon - mh, 1, mh, w, horizon);
            }
            for (let x = farRightStart; x < w; x++) {
                const u = (x - farRightStart) / Math.max(1, w - 1 - farRightStart);
                const mh = Math.floor(horizon * Math.max(0, u * 0.34 + Math.cos(u * 5.8) * 0.035 * u));
                if (mh > 0) fillClippedRect(ctx, x, horizon - mh, 1, mh, w, horizon);
            }

            const x1B = Math.max(1, Math.min(Math.floor(w * 0.35), cx - sunValleyClear - 4));
            const x2B = Math.min(w - 2, Math.max(Math.floor(w * 0.65), cx + sunValleyClear + 4));
            for (let x = 0; x <= x1B; x++) {
                const u = x / x1B;
                const mh = Math.floor(horizon * Math.max(0, 0.31 * (1.0 - Math.pow(u, 0.85)) + Math.sin(u * 14.0) * 0.015 * (1.0 - u)));
                if (mh > 0) {
                    ctx.fillStyle = cMountNear;
                    fillClippedRect(ctx, x, horizon - mh, 1, mh, w, horizon);
                    ctx.fillStyle = cMountRim;
                    fillClippedRect(ctx, x, horizon - mh, 1, 1, w, horizon);
                }
            }
            for (let x = x2B; x < w; x++) {
                const u = (x - x2B) / Math.max(1, w - 1 - x2B);
                const mh = Math.floor(horizon * Math.max(0, 0.29 * Math.pow(u, 0.85) + Math.cos(u * 13.0) * 0.015 * u));
                if (mh > 0) {
                    ctx.fillStyle = cMountNear;
                    fillClippedRect(ctx, x, horizon - mh, 1, mh, w, horizon);
                    ctx.fillStyle = cMountRim;
                    fillClippedRect(ctx, x, horizon - mh, 1, 1, w, horizon);
                }
            }
        }

        // ---------------------------------------------------------
        // 4. TIMER-B RASTER SUN (Clean Horizon Slits, Zero Bleed!)
        // ---------------------------------------------------------
        if (activeSunR > 0) {
            const hwTable = activeSunR < CIRCLE_HALF_WIDTHS.length ? CIRCLE_HALF_WIDTHS[activeSunR] : null;
            const rSq = activeSunR * activeSunR;
            const coronaW = beatImpulse > 0.35 && !ag ? 1 : 0;

            for (let dy = -activeSunR; dy < 0; dy++) {
                const py = horizon + dy;
                if (py < 0 || py >= horizon) continue;
                const dx = hwTable ? hwTable[dy + activeSunR] : Math.floor(Math.sqrt(Math.max(0, rSq - dy * dy)));
                if (dx <= 0) continue;

                const distFromBottom = -dy;
                if (activeSunR >= 14 && (distFromBottom === 3 || distFromBottom === 7)) {
                    ctx.fillStyle = cSunSlit;
                    fillClippedRect(ctx, cx - dx, py, dx * 2 + 1, 1, w, horizon);
                    continue;
                }

                const vFrac = (dy + activeSunR) / Math.max(1, activeSunR);
                const sunCol = vFrac < 0.25 ? cSunTop : (vFrac < 0.56 ? cSunMid : (vFrac < 0.82 ? cSunLow : cSunBase));

                if (coronaW > 0) {
                    ctx.fillStyle = cSunCorona;
                    fillClippedRect(ctx, cx - dx - 1, py, dx * 2 + 3, 1, w, horizon);
                }
                ctx.fillStyle = sunCol;
                fillClippedRect(ctx, cx - dx, py, dx * 2 + 1, 1, w, horizon);
            }
        }

        // ---------------------------------------------------------
        // 5. TIMER-B LAKE WATER & TAPERED SUN REFLECTION
        // ---------------------------------------------------------
        this._drawTimerBRamp(ctx, w, horizon, shoreY, this.waterRamp, stepX);

        ctx.fillStyle = cMountNear;
        fillClippedRect(ctx, 0, horizon, Math.floor(w * 0.28), 2, w, shoreY, horizon, shoreY);
        fillClippedRect(ctx, Math.floor(w * 0.72), horizon, w - Math.floor(w * 0.72), 2, w, shoreY, horizon, shoreY);

        const waterSpan = Math.max(1, shoreY - horizon);
        const waveActive = this.waterWaveAge < 0.65 && this.waterWavePeak > 0.01;
        const waveY = horizon + (this.waterWaveAge / 0.65) * waterSpan;

        if (waterSpan >= 6) {
            ctx.fillStyle = cWaterRim;
            for (let y = horizon + 3; y < shoreY - 1; y += 3) {
                const segPhase = ((y * 19) % 13) / 13;
                const drift = Math.floor(Math.sin(this.waterT * 1.8 + y * 0.7) * 6);
                const leftX = Math.floor(w * (0.08 + segPhase * 0.24)) + drift;
                const rightX = Math.floor(w * (0.68 + segPhase * 0.22)) - drift;
                const len = Math.max(2, Math.floor(minDim * 0.03));
                fillClippedRect(ctx, leftX, y, len, 1, w, shoreY, horizon, shoreY);
                fillClippedRect(ctx, rightX, y, len, 1, w, shoreY, horizon, shoreY);
            }
        }

        for (let y = horizon + 1; y < shoreY - 1; y += 2) {
            const depth = (y - horizon) / waterSpan;
            const shimmer = Math.sin(y * 1.15 - this.waterT * 5.8);
            const onWave = waveActive && Math.abs(y - waveY) < 2.5;

            if (shimmer > -0.35 || onWave) {
                let rWidth = activeSunR * (1.20 - depth * 0.52) * (0.55 + Math.sin(y * 0.35 + this.waterT * 2.0) * 0.35);
                rWidth += (beatImpulse * activeSunR * 0.55 + ymBass * 4.0 + (onWave ? activeSunR * 0.45 : 0.0)) * (1.0 - 0.55 * ag);
                rWidth = Math.max(2, Math.min(activeSunR * 1.65, rWidth));

                const jitterX = Math.floor(Math.sin(y * 0.55 + this.waterT * 7.5) * (1.5 + ymHigh * 1.6));

                ctx.fillStyle = cWaterRefl2;
                fillClippedRect(ctx, cx - rWidth * 0.5 - 1 + jitterX, y, rWidth + 2, 1, w, shoreY, horizon, shoreY);

                ctx.fillStyle = onWave && !ag ? cSunTop : cWaterRefl;
                if (depth > 0.28 && rWidth > 7) {
                    const seg = Math.max(2, Math.floor(rWidth * 0.36));
                    fillClippedRect(ctx, cx - rWidth * 0.5 + jitterX, y, seg, 1, w, shoreY, horizon, shoreY);
                    fillClippedRect(ctx, cx + rWidth * 0.5 - seg + jitterX, y, seg, 1, w, shoreY, horizon, shoreY);
                    if (depth < 0.72) {
                        fillClippedRect(ctx, cx - 1 + jitterX, y, 3, 1, w, shoreY, horizon, shoreY);
                    }
                } else {
                    fillClippedRect(ctx, cx - rWidth * 0.5 + jitterX, y, rWidth, 1, w, shoreY, horizon, shoreY);
                }
            }
        }

        ctx.fillStyle = cWaterRim;
        fillClippedRect(ctx, 0, shoreY - 1, w, 1, w, shoreY, horizon, shoreY);

        // ---------------------------------------------------------
        // 6. SHORELINE & PERSPECTIVE STONE PATH
        // ---------------------------------------------------------
        const pathZoneH = Math.max(1, h - shoreY);
        ctx.fillStyle = cStoneDark;
        ctx.fillRect(0, shoreY, w, pathZoneH);
        ctx.fillStyle = cStoneLine;
        fillClippedRect(ctx, 0, shoreY, w, 2, w, h, shoreY, h);

        const pathBottomW = w * 0.88;
        const pathTopW = w * 0.16;
        const hMinusHorizon = Math.max(1, h - horizon);

        for (let y = shoreY + 1; y < h; y++) {
            const trueDepth = (y - horizon) / hMinusHorizon;
            const pathW = pathTopW + trueDepth * (pathBottomW - pathTopW);
            const px = cx - pathW * 0.5;

            ctx.fillStyle = cPathLight;
            fillClippedRect(ctx, px, y, pathW, 1, w, h, shoreY, h);

            ctx.fillStyle = cStoneLine;
            fillClippedRect(ctx, px - 1, y, 1, 1, w, h, shoreY, h);
            fillClippedRect(ctx, px + pathW, y, 1, 1, w, h, shoreY, h);

            if (Math.sin(Math.pow(Math.max(0, trueDepth), 0.5) * 50.0) > 0.95) {
                ctx.fillStyle = cPathDark;
                fillClippedRect(ctx, px, y, pathW, 1, w, h, shoreY, h);
            }

            for (let lane = 1; lane < 6; lane++) {
                const laneX = cx + pathW * (lane / 6 - 0.5);
                ctx.fillStyle = cStoneLine;
                fillClippedRect(ctx, laneX, y, 1, 1, w, h, shoreY, h);
            }

            if ((y % 11) === 0 && trueDepth > 0.25) {
                ctx.fillStyle = cMoss;
                fillClippedRect(ctx, px - 2, y, 2, 1, w, h, shoreY, h);
                fillClippedRect(ctx, px + pathW, y, 2, 1, w, h, shoreY, h);
            }
        }

        // ---------------------------------------------------------
        // 7. JAPANESE TORO STONE LANTERNS ALONG PATH
        // ---------------------------------------------------------
        for (let i = 0; i < SHRINES.length; i++) {
            const s = SHRINES[i];
            const scale = Math.pow(s.z, 1.45);
            const sy = Math.min(h - 1, Math.floor(shoreY + scale * pathZoneH));
            const trueDepth = (sy - horizon) / hMinusHorizon;
            const pathWAtZ = pathTopW + trueDepth * (pathBottomW - pathTopW);

            const sWidth = Math.max(4, Math.min(w * 0.14, 7 + scale * (minDim * 0.12)));
            const sHeight = Math.max(6, Math.min(h * 0.24, 11 + scale * (minDim * 0.17)));
            const rawSx = cx + s.xDir * (pathWAtZ * 0.5 + 4 + scale * Math.min(34, w * 0.11));
            const sx = Math.min(w - Math.max(3, sWidth * 0.6), Math.max(Math.max(3, sWidth * 0.6), rawSx));

            const baseH = Math.max(1, Math.floor(sHeight * 0.18));
            const postH = Math.max(2, Math.floor(sHeight * 0.42));
            const boxH = Math.max(2, Math.floor(sHeight * 0.22));
            const roofH = Math.max(2, Math.floor(sHeight * 0.22));

            ctx.fillStyle = cPathDark;
            fillClippedRect(ctx, sx - sWidth * 0.48, sy - baseH, sWidth * 0.96, baseH, w, h);

            const postW = Math.max(2, Math.floor(sWidth * 0.34));
            ctx.fillStyle = cStoneMid;
            fillClippedRect(ctx, sx - postW * 0.5, sy - baseH - postH, postW, postH, w, h);
            if (postH >= 4) {
                ctx.fillStyle = cMoss;
                fillClippedRect(ctx, sx - postW * 0.5, sy - baseH - 2, 1, 2, w, h);
            }

            const boxW = Math.max(3, Math.floor(sWidth * 0.64));
            const boxY = sy - baseH - postH - boxH;
            ctx.fillStyle = cPathDark;
            fillClippedRect(ctx, sx - boxW * 0.5, boxY, boxW, boxH, w, h);
            if (boxW >= 4 && boxH >= 2) {
                ctx.fillStyle = cLanternFlame;
                fillClippedRect(ctx, sx - Math.max(1, Math.floor(boxW * 0.25)), boxY + 1, Math.max(1, Math.floor(boxW * 0.5)), Math.max(1, boxH - 1), w, h);
            }

            const roofBaseY = boxY;
            for (let ry = 0; ry < roofH; ry++) {
                const rFrac = ry / Math.max(1, roofH);
                const rw = Math.max(2, Math.floor(sWidth * 1.15 * (1.0 - rFrac * 0.72)));
                ctx.fillStyle = ry === 0 ? cPathLight : cStoneMid;
                fillClippedRect(ctx, sx - rw * 0.5, roofBaseY - ry - 1, rw, 1, w, h);
            }
            ctx.fillStyle = cPathLight;
            fillClippedRect(ctx, sx, roofBaseY - roofH - 1, 1, 1, w, h);
        }

        // ---------------------------------------------------------
        // 8. CURVED MYOJIN TORII GATE (Straight Korobi Pillars!)
        // ---------------------------------------------------------
        const toriiTop = Math.max(2, horizon - Math.floor(horizon * 0.80));
        const toriiBot = Math.min(h - 1, shoreY + Math.floor(minDim * 0.05));
        const toriiH = Math.max(1, toriiBot - toriiTop);
        const toriiSpanScale = Math.min(minDim, w * 0.80);

        for (let y = toriiTop; y <= toriiBot; y++) {
            const vFrac = (y - toriiTop) / toriiH;
            const offset = Math.floor(toriiSpanScale * (0.215 + vFrac * 0.020));
            const postW = Math.max(2, Math.floor(toriiSpanScale * (0.032 + vFrac * 0.012)));

            const pxLeft = cx - offset - postW * 0.5;
            const pxRight = cx + offset - postW * 0.5;

            ctx.fillStyle = cTorii;
            fillClippedRect(ctx, pxLeft, y, postW, 1, w, h);
            fillClippedRect(ctx, pxRight, y, postW, 1, w, h);

            ctx.fillStyle = cToriiHigh;
            fillClippedRect(ctx, pxLeft + postW - 1, y, 1, 1, w, h);
            fillClippedRect(ctx, pxRight + postW - 1, y, 1, 1, w, h);

            if (y >= toriiBot - Math.max(2, Math.floor(minDim * 0.025))) {
                ctx.fillStyle = cToriiDark;
                fillClippedRect(ctx, pxLeft - 1, y, postW + 2, 1, w, h);
                fillClippedRect(ctx, pxRight - 1, y, postW + 2, 1, w, h);
            }
        }

        const beamW = Math.min(w - 2, Math.floor(toriiSpanScale * 0.62));
        const beamH = Math.max(2, Math.floor(minDim * 0.038));
        const beamX = Math.floor(cx - beamW * 0.5);

        ctx.fillStyle = cToriiDark;
        fillClippedRect(ctx, beamX, toriiTop, beamW, beamH, w, h);
        ctx.fillStyle = cToriiHigh;
        fillClippedRect(ctx, beamX + 2, toriiTop, Math.max(2, beamW - 4), 1, w, h);
        const eaveW = Math.max(2, Math.floor(beamW * 0.14));
        ctx.fillStyle = cToriiDark;
        fillClippedRect(ctx, beamX - 2, toriiTop - 1, eaveW, 2, w, h);
        fillClippedRect(ctx, beamX + beamW - eaveW + 2, toriiTop - 1, eaveW, 2, w, h);
        ctx.fillStyle = cToriiHigh;
        fillClippedRect(ctx, beamX - 2, toriiTop - 1, Math.max(1, eaveW - 2), 1, w, h);
        fillClippedRect(ctx, beamX + beamW - eaveW + 4, toriiTop - 1, Math.max(1, eaveW - 2), 1, w, h);

        const beamW2 = Math.min(w - 2, Math.floor(toriiSpanScale * 0.52));
        const beamH2 = Math.max(1, Math.floor(minDim * 0.02));
        const nukiY = toriiTop + Math.max(3, Math.floor(minDim * 0.062));
        ctx.fillStyle = cTorii;
        fillClippedRect(ctx, Math.floor(cx - beamW2 * 0.5), nukiY, beamW2, beamH2, w, h);

        const plaqueW = Math.max(4, Math.floor(toriiSpanScale * 0.048));
        const plaqueH = Math.max(3, nukiY - toriiTop);
        ctx.fillStyle = cToriiDark;
        fillClippedRect(ctx, cx - Math.floor(plaqueW * 0.5), toriiTop + 1, plaqueW, plaqueH, w, h);
        if (plaqueW >= 4 && plaqueH >= 4) {
            ctx.fillStyle = cKanji;
            fillClippedRect(ctx, cx - 1, toriiTop + 2, 3, 1, w, h);
            fillClippedRect(ctx, cx, toriiTop + 2, 1, Math.max(1, plaqueH - 2), w, h);
            fillClippedRect(ctx, cx - 1, toriiTop + Math.floor(plaqueH * 0.65), 3, 1, w, h);
        }

        // ---------------------------------------------------------
        // 9. MOYOGI S-CURVE PINE BONSAI (Gnarled Trunk & Lush Cloud Tiers)
        // ---------------------------------------------------------
        const treeScale = Math.min(minDim, w * 0.78);
        const trunkBaseX = Math.min(w - Math.max(10, Math.floor(treeScale * 0.20)), Math.floor(w * 0.85));
        const trunkBaseY = Math.min(h - 1, shoreY + Math.floor(minDim * 0.14));
        const trunkTopY = Math.max(4, shoreY - Math.floor(minDim * 0.28));
        const trunkH = Math.max(1, trunkBaseY - trunkTopY);

        if (treeScale >= 32) {
            const moundRx = Math.max(4, Math.floor(treeScale * 0.115));
            const moundRy = Math.max(2, Math.floor(treeScale * 0.025));
            fillClippedEllipse(ctx, trunkBaseX, trunkBaseY, moundRx, moundRy, cStoneLine, w, h);
            fillClippedEllipse(ctx, trunkBaseX, trunkBaseY - 1, Math.max(3, moundRx - 1), Math.max(1, moundRy - 1), cMoss, w, h);
        }

        for (let y = trunkTopY; y <= trunkBaseY; y++) {
            const u = 1.0 - (y - trunkTopY) / trunkH;
            const rootFlare = u < 0.20 ? Math.pow((0.20 - u) / 0.20, 1.5) * 0.075 : 0;
            const knotWave = Math.sin(u * 18.0) * 0.006;
            const tw = Math.max(2, Math.round(treeScale * (0.016 + (1.0 - u) * 0.076 + rootFlare + knotWave)));
            const tx = trunkBaseX + bonsaiTrunkOffset(u, treeScale);

            const leftEdge = Math.floor(tx - tw * 0.5);
            ctx.fillStyle = cTreeDark;
            fillClippedRect(ctx, leftEdge, y, tw, 1, w, h);

            ctx.fillStyle = cTreeTrunk;
            fillClippedRect(ctx, leftEdge, y, Math.max(1, Math.floor(tw * 0.74)), 1, w, h);

            if (tw >= 4) {
                ctx.fillStyle = cTreeLit;
                const litW = Math.max(1, Math.floor(tw * 0.24));
                fillClippedRect(ctx, leftEdge + 1, y, litW, 1, w, h);
                if (tw >= 7 && (((y + (leftEdge & 3)) % 5) === 0)) {
                    ctx.fillStyle = cTreeDark;
                    fillClippedRect(ctx, leftEdge + Math.floor(tw * 0.44), y, 1, 2, w, h);
                }
            }
        }

        const leafSizeScale = Math.max(0.55, Math.min(1.15, minDim / 170));
        const rustleGain = (0.75 + beatImpulse * 1.8 + ymHigh * 1.0) * (1.0 - 0.7 * ag);

        // Pass 1: Lush evergreen pad under-cushions (deep pine shadow + rich evergreen core)
        for (let c = 0; c < BONSAI_PADS.length; c++) {
            const pad = BONSAI_PADS[c];
            const padX = Math.floor(trunkBaseX + pad.padX * treeScale);
            const padY = Math.floor(trunkTopY + pad.padFracY * trunkH);
            const padRx = Math.max(3, Math.floor(pad.rx * treeScale * 1.02));
            const padRy = Math.max(2, Math.floor(pad.ry * treeScale * 0.90));
            fillClippedEllipse(ctx, padX, padY + Math.max(1, Math.floor(padRy * 0.28)), padRx, padRy, cLeafShadow, w, h);
            fillClippedEllipse(ctx, padX, padY, Math.max(2, Math.floor(padRx * 0.92)), Math.max(1, Math.floor(padRy * 0.85)), cLeafCols[0], w, h);
        }

        // Pass 2: Gnarled horizontal Bonsai limbs sweeping from S-trunk bends into each pad
        for (let c = 0; c < BONSAI_PADS.length; c++) {
            const pad = BONSAI_PADS[c];
            const startX = Math.floor(trunkBaseX + bonsaiTrunkOffset(pad.uAttach, treeScale));
            const startY = Math.floor(trunkBaseY - pad.uAttach * trunkH);
            const endX = Math.floor(trunkBaseX + pad.padX * treeScale * 0.90);
            const endY = Math.floor(trunkTopY + (pad.padFracY + 0.025) * trunkH);
            const ctrlX = Math.floor(trunkBaseX + pad.bBendX * treeScale);
            const ctrlY = Math.floor(trunkTopY + pad.bBendY * trunkH);
            const rStart = Math.max(1, Math.round(pad.rStart * treeScale));
            const rEnd = Math.max(1, Math.round(pad.rEnd * treeScale));

            drawTaperedBranch(ctx, startX, startY, ctrlX, ctrlY, endX, endY, rStart, rEnd, cTreeDark, cTreeTrunk, cTreeLit, w, h);

            if (treeScale >= 48) {
                const subX = Math.floor((ctrlX + endX) * 0.5);
                const subY = Math.floor((ctrlY + endY) * 0.5);
                const dir = pad.padX < 0 ? -1 : 1;
                const forkX = endX + dir * Math.max(2, Math.floor(treeScale * 0.035));
                const forkY = endY - Math.max(1, Math.floor(treeScale * 0.01));
                drawTaperedBranch(ctx, subX, subY, subX + dir * 2, forkY + 1, forkX, forkY, Math.max(1, rEnd), 1, cTreeDark, cTreeTrunk, cTreeLit, w, h);
            }
        }

        // Pass 3: Rounded pine-foliage clusters grouped into the 5 Bonsai cloud tiers
        for (let i = 0; i < this.treeLeaves.length; i++) {
            const leaf = this.treeLeaves[i];
            const pad = BONSAI_PADS[leaf.padIdx];
            const rustleX = Math.round(Math.sin(this.internalT * 2.8 + leaf.phase) * rustleGain);
            const rustleY = Math.round(Math.cos(this.internalT * 1.9 + leaf.phase) * (0.40 * rustleGain));
            const lx = Math.floor(trunkBaseX + (pad.padX + leaf.dx) * treeScale + rustleX);
            const ly = Math.floor(trunkTopY + pad.padFracY * trunkH + leaf.dy * treeScale + rustleY);
            const lr = Math.max(1, Math.round(leaf.r * leafSizeScale));
            fillClippedCircle(ctx, lx, ly, lr, cLeafCols[leaf.colType], w, h);
        }

        // ---------------------------------------------------------
        // 9A. ADVANCE LEAVES & RENDER SETTLED LEAVES ON STONES
        // (Drawn under the fighter so Karateka moves over fallen leaves!)
        // ---------------------------------------------------------
        const minLandYFrac = Math.min(0.95, Math.max(0.68, (shoreY + 2) / h));
        for (let i = 0; i < this.petals.length; i++) {
            const p = this.petals[i];
            if (!p.active) continue;

            if (!p.landed) {
                p.xFrac += dt * (p.vx + Math.sin(this.internalT * 2.5 + p.phase) * 0.016) * speedMult;
                p.yFrac += dt * p.vy * speedMult;
                if (p.xFrac <= 0.02 || p.xFrac >= 0.98) {
                    p.active = false;
                    continue;
                }
                const targetLand = Math.max(minLandYFrac, p.landYFrac);
                if (p.yFrac >= targetLand) {
                    p.yFrac = targetLand;
                    p.landed = true;
                    p.restAge = 0;
                }
            } else {
                p.restAge += dt;
                if (beatImpulse > 0.65 && !ag && (i & 1) === 0) {
                    p.xFrac = Math.max(0.03, p.xFrac - dt * 0.025);
                }
                if (p.restAge >= p.restDuration) {
                    p.active = false;
                    continue;
                }

                const lx = Math.floor(p.xFrac * w);
                const ly = Math.min(h - 1, Math.max(shoreY, Math.floor(p.yFrac * h)));
                if (p.restAge < p.restDuration - 0.35 || ((Math.floor(p.restAge * 16)) & 1) === 0) {
                    ctx.fillStyle = cStoneDark;
                    fillClippedRect(ctx, lx, ly + 1, 2, 1, w, h);
                    ctx.fillStyle = cFallenLeaves[p.variant];
                    fillClippedRect(ctx, lx, ly, 2, 1, w, h);
                }
            }
        }

        // ---------------------------------------------------------
        // 9B. IK+ SPRITE KARATEKA / KAEMPFERIN CHOREOGRAPHY
        // ---------------------------------------------------------
        const spriteScale = (w >= 84 && h >= 140)
            ? 1.0
            : Math.max(0.25, Math.min(1.0, w / 84, h / 140));

        const groundY = Math.min(h - 3, Math.floor(shoreY + pathZoneH * 0.68));
        const groundDepth = (groundY - horizon) / hMinusHorizon;
        const pathWAtGround = pathTopW + groundDepth * (pathBottomW - pathTopW);
        const bonsaiClearance = Math.max(10, trunkBaseX - cx - Math.floor(18 * spriteScale));
        const roamRadius = Math.max(4, Math.min(pathWAtGround * 0.43, bonsaiClearance, w * 0.39));

        const frameKey = this._updateFighterChoreography(
            dt,
            state,
            acceptedBeat,
            acceptedBeatCount,
            acceptedLevel,
            beatImpulse,
            tension,
            energy,
            ymBass,
            ymMid,
            ymHigh,
            roamRadius
        );

        const activeFrame = IK_SPRITE_FRAMES[frameKey] || IK_SPRITE_FRAMES.IDLE_0;
        const f = this.fighter;

        const isStriking =
            f.moveName === 'JAB' ||
            f.moveName === 'LUNGE_PUNCH' ||
            f.moveName === 'FRONT_KICK' ||
            f.moveName === 'ROUNDHOUSE' ||
            f.moveName === 'HIGH_KICK' ||
            f.moveName === 'LOW_SWEEP' ||
            f.moveName === 'FLYING_KICK';
        const strikeNudge = isStriking ? (beatImpulse * 2.0 * spriteScale * f.facing) : 0;

        const fighterScreenX = Math.floor(cx + f.xNorm * roamRadius + strikeNudge);
        const fighterAnchorY = Math.floor(groundY - f.jumpY * spriteScale);

        resolveFighterPalette(f.paletteTable, f.style, ag);

        drawGroundShadow(ctx, fighterScreenX, groundY, f.jumpY, spriteScale, w, h, shoreY, cStoneLine, cStoneDark);

        drawCompiledSprite(ctx, activeFrame, f.paletteTable, fighterScreenX, fighterAnchorY, f.facing, spriteScale, w, h);
        drawFighterTrailingDetail(
            ctx,
            f.style,
            activeFrame,
            f.paletteTable,
            fighterScreenX,
            fighterAnchorY,
            f.facing,
            spriteScale,
            f.trailPhase,
            (beatImpulse + ymHigh * 0.6 + (f.jumpY > 0 ? 0.5 : 0)) * (1.0 - 0.7 * ag),
            w,
            h
        );

        if (f.sparkAge < 0.10) {
            const sparkFrame = IK_SPRITE_FRAMES[f.sparkFrameName] || activeFrame;
            drawStrikeSparks(
                ctx,
                sparkFrame,
                fighterScreenX,
                fighterAnchorY,
                f.facing,
                spriteScale,
                f.sparkAge,
                cCloudFlare,
                cSunMid,
                w,
                h
            );
        }

        // ---------------------------------------------------------
        // 9C. AIRBORNE FALLING LEAVES (PASSING IN FRONT OF FIGHTER)
        // ---------------------------------------------------------
        for (let i = 0; i < this.petals.length; i++) {
            const p = this.petals[i];
            if (!p.active || p.landed) continue;
            ctx.fillStyle = cFallenLeaves[p.variant];
            fillClippedRect(ctx, p.xFrac * w, p.yFrac * h, 2, 1, w, h);
        }

        // ---------------------------------------------------------
        // 10. BAYER 4x4 POWER CURTAIN (starting / stopping)
        // ---------------------------------------------------------
        if (revealRatio < 1.0) {
            this._drawPowerCurtain(ctx, w, h, horizon, revealRatio);
        }
    }
}