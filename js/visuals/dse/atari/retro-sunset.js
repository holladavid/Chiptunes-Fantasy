// === js/visuals/dse/atari/retro-sunset.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: ATARI ST RETRO SUNSET (IK+ TORII & BONSAI)
// 100% DOM-free 9-bit Shifter palette rendering via pure fillRect:
// Dithered sky & clouds, clipped mountains, beat-pulsing sun,
// shimmering shoreline reflection, stone path, shrines, Torii gate
// with glowing Kanji, sculpted Bonsai tree & Zen afterglow.
// =========================================================

import { quantizeAtari9Bit, rgbToHex } from '../../utils/hardware-constraints.js';

const TWO_PI = Math.PI * 2;
const TRANSITION_DURATION = 1.15;

// 4x4 Bayer threshold matrix (0..15)
const BAYER_4X4 = Object.freeze([
    0, 8, 2, 10,
    12, 4, 14, 6,
    3, 11, 1, 9,
    15, 7, 13, 5
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

// Precomputed half-width LUT for integer circles radii 1..36
const CIRCLE_HALF_WIDTHS = (() => {
    const tables = [null];
    for (let r = 1; r <= 36; r++) {
        const hw = new Int8Array(r * 2 + 1);
        const rSq = r * r;
        for (let dy = -r; dy <= r; dy++) {
            hw[dy + r] = Math.floor(Math.sqrt(Math.max(0, rSq - dy * dy)));
        }
        tables.push(hw);
    }
    return Object.freeze(tables);
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

function fillClippedCircle(ctx, cx, cy, r, colorHex, bufW, maxY) {
    const ri = Math.floor(r);
    if (ri <= 0) return;
    const icx = Math.floor(cx);
    const icy = Math.floor(cy);
    if (icx + ri < 0 || icx - ri >= bufW || icy - ri >= maxY || icy + ri < 0) return;

    ctx.fillStyle = colorHex;
    const hw = ri < CIRCLE_HALF_WIDTHS.length ? CIRCLE_HALF_WIDTHS[ri] : null;
    const rSq = ri * ri;

    for (let dy = -ri; dy <= ri; dy++) {
        const py = icy + dy;
        if (py < 0 || py >= maxY) continue;
        const dx = hw ? hw[dy + ri] : Math.floor(Math.sqrt(Math.max(0, rSq - dy * dy)));
        const x0 = Math.max(0, icx - dx);
        const x1 = Math.min(bufW, icx + dx + 1);
        const cw = x1 - x0;
        if (cw > 0) ctx.fillRect(x0, py, cw, 1);
    }
}

function fillDitheredCircle(ctx, cx, cy, r, col1, col2, bufW, maxY) {
    const ri = Math.floor(r);
    if (ri <= 0) return;
    const icx = Math.floor(cx);
    const icy = Math.floor(cy);
    if (icx + ri < 0 || icx - ri >= bufW || icy - ri >= maxY || icy + ri < 0) return;

    const hw = ri < CIRCLE_HALF_WIDTHS.length ? CIRCLE_HALF_WIDTHS[ri] : null;
    const rSq = ri * ri;

    ctx.fillStyle = col1;
    for (let dy = -ri; dy <= ri; dy++) {
        const py = icy + dy;
        if (py < 0 || py >= maxY) continue;
        const dx = hw ? hw[dy + ri] : Math.floor(Math.sqrt(Math.max(0, rSq - dy * dy)));
        const x0 = Math.max(0, icx - dx);
        const x1 = Math.min(bufW, icx + dx + 1);
        const cw = x1 - x0;
        if (cw > 0) ctx.fillRect(x0, py, cw, 1);
    }

    ctx.fillStyle = col2;
    for (let dy = -ri; dy <= ri; dy++) {
        const py = icy + dy;
        if (py < 0 || py >= maxY) continue;
        const dx = hw ? hw[dy + ri] : Math.floor(Math.sqrt(Math.max(0, rSq - dy * dy)));
        let startX = Math.max(0, icx - dx);
        const endX = Math.min(bufW - 1, icx + dx);
        if (((startX + py) & 1) !== 0) startX++;
        for (let px = startX; px <= endX; px += 2) {
            ctx.fillRect(px, py, 1, 1);
        }
    }
}

function drawClippedLine(ctx, x0, y0, x1, y1, bufW, bufH) {
    if (!Number.isFinite(x0) || !Number.isFinite(y0) || !Number.isFinite(x1) || !Number.isFinite(y1)) return;
    const maxX = bufW - 1;
    const maxY = bufH - 1;
    let t0 = 0;
    let t1 = 1;
    const dx = x1 - x0;
    const dy = y1 - y0;

    const clipTest = (p, q) => {
        if (p === 0) return q >= 0;
        const r = q / p;
        if (p < 0) {
            if (r > t1) return false;
            if (r > t0) t0 = r;
        } else {
            if (r < t0) return false;
            if (r < t1) t1 = r;
        }
        return true;
    };

    if (!clipTest(-dx, x0) || !clipTest(dx, maxX - x0) || !clipTest(-dy, y0) || !clipTest(dy, maxY - y0)) return;

    let cx0 = Math.min(maxX, Math.max(0, Math.floor(x0 + t0 * dx)));
    let cy0 = Math.min(maxY, Math.max(0, Math.floor(y0 + t0 * dy)));
    const cx1 = Math.min(maxX, Math.max(0, Math.floor(x0 + t1 * dx)));
    const cy1 = Math.min(maxY, Math.max(0, Math.floor(y0 + t1 * dy)));

    const adx = Math.abs(cx1 - cx0);
    const ady = Math.abs(cy1 - cy0);
    const sx = cx0 < cx1 ? 1 : -1;
    const sy = cy0 < cy1 ? 1 : -1;
    let err = adx - ady;
    const maxSteps = adx + ady + 2;

    for (let step = 0; step < maxSteps; step++) {
        ctx.fillRect(cx0, cy0, 1, 1);
        if (cx0 === cx1 && cy0 === cy1) break;
        const e2 = err * 2;
        if (e2 > -ady) { err -= ady; cx0 += sx; }
        if (e2 < adx) { err += adx; cy0 += sy; }
    }
}

const LEAF_CLUSTERS = Object.freeze([
    { dx: -0.15, dy: -0.02, r: 0.10 },
    { dx: -0.06, dy: -0.15, r: 0.12 },
    { dx: 0.08, dy: -0.12, r: 0.11 },
    { dx: 0.16, dy: 0.02, r: 0.09 }
]);

const SHRINES = Object.freeze([
    { xDir: -1, z: 0.85 }, { xDir: 1, z: 0.85 },
    { xDir: -1, z: 0.55 }, { xDir: 1, z: 0.55 },
    { xDir: -1, z: 0.25 }, { xDir: 1, z: 0.25 },
    { xDir: -1, z: 0.05 }, { xDir: 1, z: 0.05 }
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

        // Normalized drifting cloud states
        this.clouds = [
            { y: 0.15, normX: 0.15, r: 0.038, speed: -0.020 },
            { y: 0.28, normX: 0.68, r: 0.046, speed: 0.028 },
            { y: 0.38, normX: 0.22, r: 0.042, speed: -0.013 }
        ];

        // Deterministic Bonsai foliage pads (flatter cushions, sunlit tops / shaded bottoms)
        this.treeLeaves = [];
        for (let c = 0; c < LEAF_CLUSTERS.length; c++) {
            const cl = LEAF_CLUSTERS[c];
            for (let i = 0; i < 42; i++) {
                const angle = this._nextRandom() * TWO_PI;
                const dist = Math.sqrt(this._nextRandom()) * cl.r;
                const sinA = Math.sin(angle);
                const roll = this._nextRandom();
                let colType;
                if (sinA < -0.2) {
                    colType = roll > 0.45 ? 1 : 0; // Top: sunlit yellow-gold & spring green
                } else if (sinA > 0.35) {
                    colType = roll > 0.35 ? 2 : 0; // Underside: deeper warm orange & green shadow
                } else {
                    colType = roll > 0.60 ? 0 : (roll > 0.30 ? 1 : 2);
                }
                this.treeLeaves.push({
                    dx: cl.dx + Math.cos(angle) * dist * 1.15,
                    dy: cl.dy + sinA * dist * 0.65,
                    r: Math.floor(this._nextRandom() * 3) + 2,
                    colType,
                    phase: this._nextRandom() * TWO_PI
                });
            }
        }

        // Preallocated falling Bonsai petals pool (max 10 petals)
        this.petals = Array.from({ length: 10 }, () => ({
            active: false,
            xFrac: 0.8,
            yFrac: 0.3,
            vx: -0.03,
            vy: 0.09,
            phase: 0
        }));
    }

    _nextRandom() {
        let x = this.prngState | 0;
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        this.prngState = x;
        return (x >>> 0) / 4294967296;
    }

    _spawnPetals(count) {
        let spawned = 0;
        for (let i = 0; i < this.petals.length && spawned < count; i++) {
            const p = this.petals[i];
            if (!p.active) {
                p.active = true;
                p.xFrac = 0.72 + this._nextRandom() * 0.20;
                p.yFrac = 0.25 + this._nextRandom() * 0.16;
                p.vx = -(0.025 + this._nextRandom() * 0.045);
                p.vy = 0.08 + this._nextRandom() * 0.08;
                p.phase = this._nextRandom() * TWO_PI;
                spawned++;
            }
        }
    }

    resize() {
        // Clouds, shrines, Torii and Bonsai scale proportionally from width/height;
        // time phases and petals persist cleanly across rotations.
    }

    _drawDitheredBand(ctx, w, yStart, yEnd, col1, col2, horizon) {
        const y0 = Math.max(0, Math.floor(yStart));
        const y1 = Math.min(horizon, Math.floor(yEnd));
        for (let y = y0; y < y1; y++) {
            ctx.fillStyle = (y & 1) === 0 ? col1 : col2;
            ctx.fillRect(0, y, w, 1);
        }
    }

    _drawChunkyCloud(ctx, cx, cy, r, col1, col2, w, horizon) {
        const ri = Math.max(2, Math.floor(r));
        fillDitheredCircle(ctx, cx, cy, ri, col1, col2, w, horizon);
        fillDitheredCircle(ctx, cx - Math.floor(ri * 0.7), cy + Math.floor(ri * 0.1), Math.max(1, Math.floor(ri * 0.7)), col1, col2, w, horizon);
        fillDitheredCircle(ctx, cx + Math.floor(ri * 0.7), cy + Math.floor(ri * 0.1), Math.max(1, Math.floor(ri * 0.7)), col1, col2, w, horizon);
        fillDitheredCircle(ctx, cx - Math.floor(ri * 1.25), cy + Math.floor(ri * 0.3), Math.max(1, Math.floor(ri * 0.45)), col1, col2, w, horizon);
        fillDitheredCircle(ctx, cx + Math.floor(ri * 1.25), cy + Math.floor(ri * 0.3), Math.max(1, Math.floor(ri * 0.45)), col1, col2, w, horizon);
        fillDitheredCircle(ctx, cx - Math.floor(ri * 0.35), cy - Math.floor(ri * 0.35), Math.max(1, Math.floor(ri * 0.65)), col1, col2, w, horizon);
        fillDitheredCircle(ctx, cx + Math.floor(ri * 0.35), cy - Math.floor(ri * 0.35), Math.max(1, Math.floor(ri * 0.65)), col1, col2, w, horizon);
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
            return;
        }

        let dt = this.lastT === null ? 0.02 : (safeT - this.lastT);
        this.lastT = safeT;
        if (!Number.isFinite(dt) || dt < 0) dt = 0.02;
        else if (dt > 0.1) dt = 0.1;

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
        const pulse = clamp01(safeMetrics.pulse ?? 0);
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
        // Discrete Beat Events (strictly gated on beatStarted)
        // ---------------------------------------------------------
        const allowPetals = (state === 'buildup' || state === 'climax');
        if (beatStarted) {
            const incomingCount = Number.isFinite(safeMetrics.beatCount)
                ? Math.floor(safeMetrics.beatCount)
                : (this.lastBeatCount + 1);

            if (incomingCount !== this.lastBeatCount || !Number.isFinite(safeMetrics.beatCount)) {
                this.lastBeatCount = incomingCount;
                this.beatParity = incomingCount & 1;

                this.waterWaveAge = 0;
                const levelWeight = beatLevel >= 3 ? 1.0 : (beatLevel === 2 ? 0.65 : (beatLevel === 1 ? 0.35 : 0.0));
                this.waterWavePeak = Math.max(beatStrength, levelWeight);

                if (allowPetals) {
                    this._spawnPetals(beatLevel >= 3 ? 3 : 1);
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

        // ---------------------------------------------------------
        // Dynamic 9-bit IK+ Palette (Warm Sunset -> Zen Moonlit Dusk)
        // ---------------------------------------------------------
        const cSky1 = toAtariHex(0, 0, lerp(0, 36, ag));
        const cSky2 = mixHex([144, 0, 108], [36, 0, 72], ag);
        const cSky3 = mixHex([216, 36, 72], [72, 36, 108], ag);
        const cSky4 = mixHex([252, 108, 72], [108, 72, 144], ag);
        const cSky5 = mixHex([252, 216, 144], [144, 144, 180], ag);

        const cCloudW = mixHex([252, 252, 252], [180, 180, 216], ag);
        const cCloudP = mixHex([216, 144, 180], [108, 108, 144], ag);
        const cCloudD = mixHex([144, 72, 108], [72, 72, 108], ag);

        const cSun = mixHex([252, 252, 0], [216, 180, 144], ag);
        const cWater = mixHex([36, 72, 252], [0, 36, 108], ag);
        const cWaterDark = mixHex([0, 36, 180], [0, 0, 72], ag);
        const cWaterRefl = mixHex([252, 252, 0], [180, 180, 216], ag);
        const cWaterRefl2 = mixHex([252, 144, 0], [108, 108, 144], ag);

        const cMountain = mixHex([36, 0, 0], [0, 0, 36], ag);
        const cTorii = mixHex([36, 0, 0], [0, 0, 36], ag);
        const cToriiHigh = mixHex([108, 36, 0], [72, 36, 72], ag);
        const kanjiGlow = (0.7 + 0.3 * ymMid + 0.4 * beatImpulse) * (1.0 - 0.55 * ag);
        const cKanji = toAtariHex(252 * kanjiGlow, 180 * kanjiGlow, 36 * kanjiGlow * (beatImpulse > 0.55 ? 2.5 : 1.0));

        const pathContrast = 1.0 + 0.15 * ymMid;
        const cPathLight = mixHex([180 * pathContrast, 180 * pathContrast, 180 * pathContrast], [108, 108, 144], ag);
        const cStoneMid = mixHex([108, 108, 108], [72, 72, 108], ag);
        const cPathDark = mixHex([72, 72, 72], [36, 36, 72], ag);
        const cStoneDark = mixHex([36, 36, 36], [36, 36, 72], ag);
        const cStoneLine = toAtariHex(0, 0, 0);

        const cTreeTrunk = mixHex([108, 36, 0], [72, 36, 36], ag);
        const cLeafCols = [
            mixHex([144, 216, 36], [72, 108, 72], ag),
            mixHex([252, 216, 0], [144, 108, 72], ag),
            mixHex([252, 108, 0], [108, 72, 72], ag)
        ];
        const cMoss = mixHex([36, 216, 36], [36, 108, 72], ag);

        // ---------------------------------------------------------
        // 1. THE SKY (Atari Banding & Dithering)
        // ---------------------------------------------------------
        const h1 = Math.floor(horizon * 0.15);
        const h2 = Math.floor(horizon * 0.35);
        const h3 = Math.floor(horizon * 0.60);
        const h4 = Math.floor(horizon * 0.85);

        ctx.fillStyle = cSky1;
        ctx.fillRect(0, 0, w, Math.max(1, h1));
        this._drawDitheredBand(ctx, w, h1, h2, cSky1, cSky2, horizon);
        if (h3 > h2) {
            ctx.fillStyle = cSky2;
            ctx.fillRect(0, h2, w, h3 - h2);
        }
        this._drawDitheredBand(ctx, w, h3, h4, cSky2, cSky3, horizon);
        if (horizon > h4) {
            ctx.fillStyle = cSky3;
            ctx.fillRect(0, h4, w, horizon - h4);
        }
        this._drawDitheredBand(ctx, w, horizon - Math.max(2, Math.floor(horizon * 0.1)), horizon, cSky3, cSky4, horizon);
        ctx.fillStyle = cSky5;
        fillClippedRect(ctx, 0, horizon - 2, w, 2, w, h, 0, horizon);

        // ---------------------------------------------------------
        // 2. SHIFTER-DITHERED CLOUDS (Normalized Drift, Zero DOM)
        // ---------------------------------------------------------
        for (let i = 0; i < this.clouds.length; i++) {
            const c = this.clouds[i];
            c.normX = (((c.normX + dt * c.speed * speedMult) % 1.0) + 1.0) % 1.0;

            const cy = Math.floor(horizon * c.y);
            const rSize = Math.max(2, Math.floor(minDim * c.r));
            const span = w + rSize * 3;
            const finalX = Math.floor(c.normX * span - rSize * 1.5);

            this._drawChunkyCloud(ctx, finalX + 3, cy + 2, rSize, cCloudP, cCloudD, w, horizon);
            this._drawChunkyCloud(ctx, finalX, cy, rSize, ymHigh > 0.7 && !ag ? cSky5 : cCloudW, cCloudP, w, horizon);
        }

        // ---------------------------------------------------------
        // 3. MOUNTAINS (Scanline Columns Clipped to [0, w-1])
        // ---------------------------------------------------------
        ctx.fillStyle = cMountain;
        const h1A = Math.floor(horizon * 0.40);
        const h1B = Math.floor(horizon * 0.20);
        const x1A = Math.max(1, Math.floor(w * 0.15));
        const x1B = Math.min(w - 1, Math.max(x1A + 1, Math.floor(w * 0.35)));

        for (let x = 0; x <= x1B; x++) {
            const mh = x <= x1A
                ? Math.floor(h1A + (h1B - h1A) * (x / x1A))
                : Math.floor(h1B * (1.0 - (x - x1A) / Math.max(1, x1B - x1A)));
            if (mh > 0) fillClippedRect(ctx, x, horizon - mh, 1, mh, w, h, 0, horizon);
        }

        const h2A = Math.floor(horizon * 0.35);
        const h2B = Math.floor(horizon * 0.15);
        const x2B = Math.min(w - 2, Math.floor(w * 0.65));
        const x2A = Math.min(w - 1, Math.max(x2B + 1, Math.floor(w * 0.80)));

        for (let x = x2B; x < w; x++) {
            const mh = x <= x2A
                ? Math.floor(h2B * ((x - x2B) / Math.max(1, x2A - x2B)))
                : Math.floor(h2B + (h2A - h2B) * ((x - x2A) / Math.max(1, w - 1 - x2A)));
            if (mh > 0) fillClippedRect(ctx, x, horizon - mh, 1, mh, w, h, 0, horizon);
        }

        // ---------------------------------------------------------
        // 4. PULSING SUN (Clipped above horizon without save/clip)
        // ---------------------------------------------------------
        const baseSunR = Math.max(3, Math.floor(minDim * 0.12));
        const sunBoost = (0.65 * beatImpulse + 0.35 * ymBass) * (1.0 - 0.65 * ag);
        const activeSunR = baseSunR + Math.floor(sunBoost * minDim * 0.038);
        fillClippedCircle(ctx, cx, horizon, activeSunR, cSun, w, horizon);

        // ---------------------------------------------------------
        // 5. WATER & BEAT-RIPPLE REFLECTION (Strictly clipped to shoreY)
        // ---------------------------------------------------------
        ctx.fillStyle = cWater;
        ctx.fillRect(0, horizon, w, Math.max(1, shoreY - horizon));

        ctx.fillStyle = cWaterDark;
        fillClippedRect(ctx, 0, horizon, Math.floor(w * 0.35), 4, w, h, horizon, shoreY);
        fillClippedRect(ctx, Math.floor(w * 0.65), horizon, w - Math.floor(w * 0.65), 4, w, h, horizon, shoreY);

        const waterSpan = Math.max(1, shoreY - horizon);
        const waveActive = this.waterWaveAge < 0.65 && this.waterWavePeak > 0.01;
        const waveY = horizon + (this.waterWaveAge / 0.65) * waterSpan;

        for (let y = horizon + 2; y < shoreY; y += 2) {
            const depth = (y - horizon) / waterSpan;
            const shimmer = Math.sin(y * 1.2 - this.waterT * 6.0);
            const onWave = waveActive && Math.abs(y - waveY) < 3;

            if (shimmer > -0.3 || onWave) {
                let rWidth = activeSunR * 0.6 + depth * activeSunR * 1.2;
                rWidth *= (0.5 + Math.sin(y * 0.15) * 0.8);
                rWidth += (beatImpulse * 14.0 + ymBass * 6.0 + (onWave ? 10.0 : 0.0)) * (1.0 - 0.55 * ag);
                rWidth = Math.max(2, rWidth);

                const jitterX = Math.floor(Math.sin(y * 0.5 + this.waterT * 8.0) * (2 + ymHigh * 1.5));

                ctx.fillStyle = cWaterRefl2;
                fillClippedRect(ctx, cx - rWidth * 0.5 - 2 + jitterX, y, rWidth + 4, 1, w, h, horizon, shoreY);

                ctx.fillStyle = onWave && !ag ? cCloudW : cWaterRefl;
                if (depth > 0.3 && (y % 4) === 0 && rWidth > 8) {
                    const half = Math.floor(rWidth * 0.5);
                    fillClippedRect(ctx, cx - rWidth * 0.5 + jitterX, y, half - 2, 1, w, h, horizon, shoreY);
                    fillClippedRect(ctx, cx + 2 + jitterX, y, half - 2, 1, w, h, horizon, shoreY);
                } else {
                    fillClippedRect(ctx, cx - rWidth * 0.5 + jitterX, y, rWidth, 1, w, h, horizon, shoreY);
                }
            }
        }

        // ---------------------------------------------------------
        // 6. SHORELINE & PERSPECTIVE STONE PATH
        // ---------------------------------------------------------
        const pathZoneH = Math.max(1, h - shoreY);
        ctx.fillStyle = cStoneDark;
        ctx.fillRect(0, shoreY, w, pathZoneH);
        ctx.fillStyle = cStoneLine;
        fillClippedRect(ctx, 0, shoreY, w, 2, w, h, shoreY, h);

        const pathBottomW = w * 0.90;
        const pathTopW = w * 0.15;
        const hMinusHorizon = Math.max(1, h - horizon);

        for (let y = shoreY; y < h; y++) {
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

            if ((y % 8) < 2 && trueDepth > 0.2) {
                ctx.fillStyle = cMoss;
                fillClippedRect(ctx, px - 2, y, 2, 1, w, h, shoreY, h);
                fillClippedRect(ctx, px + pathW, y, 2, 1, w, h, shoreY, h);
            }
        }

        // ---------------------------------------------------------
        // 7. STONE SHRINES ALONG THE PATH (Clamped inside Viewport)
        // ---------------------------------------------------------
        for (let i = 0; i < SHRINES.length; i++) {
            const s = SHRINES[i];
            const scale = Math.pow(s.z, 1.5);
            const sy = Math.min(h - 1, Math.floor(shoreY + scale * pathZoneH));
            const trueDepth = (sy - horizon) / hMinusHorizon;
            const pathWAtZ = pathTopW + trueDepth * (pathBottomW - pathTopW);

            const sWidth = Math.max(4, Math.min(w * 0.16, 8 + scale * (minDim * 0.14)));
            const sHeight = Math.max(6, Math.min(h * 0.25, 12 + scale * (minDim * 0.18)));
            const rawSx = cx + s.xDir * (pathWAtZ * 0.5 + 4 + scale * Math.min(36, w * 0.12));
            const sx = Math.min(w - Math.max(2, sWidth * 0.5), Math.max(Math.max(2, sWidth * 0.5), rawSx));

            ctx.fillStyle = cPathDark;
            fillClippedRect(ctx, sx - sWidth * 0.5, sy - Math.floor(sHeight * 0.2), sWidth, Math.floor(sHeight * 0.2), w, h);

            ctx.fillStyle = cStoneMid;
            fillClippedRect(ctx, sx - sWidth * 0.25, sy - Math.floor(sHeight * 0.7), sWidth * 0.5, Math.floor(sHeight * 0.5), w, h);

            ctx.fillStyle = cPathLight;
            fillClippedRect(ctx, sx - sWidth * 0.6, sy - Math.floor(sHeight * 0.9), sWidth * 1.2, Math.floor(sHeight * 0.2), w, h);

            fillClippedCircle(ctx, sx, sy - Math.floor(sHeight * 0.9), Math.max(1, Math.floor(sWidth * 0.35)), cStoneDark, w, h);

            ctx.fillStyle = cMoss;
            fillClippedRect(ctx, sx - sWidth * 0.5, sy - Math.floor(sHeight * 0.7), 2, Math.floor(sHeight * 0.3), w, h);
        }

        // ---------------------------------------------------------
        // 8. THE TORII GATE (Proportional & Clipped)
        // ---------------------------------------------------------
        const toriiTop = Math.max(2, horizon - Math.floor(horizon * 0.82));
        const toriiBot = Math.min(h - 1, shoreY + Math.floor(minDim * 0.05));
        const toriiSpanScale = Math.min(minDim, w * 0.82);

        for (let y = toriiTop; y <= toriiBot; y++) {
            const depth = Math.max(0, (y - horizon) / hMinusHorizon);
            const offset = Math.floor(toriiSpanScale * 0.22) + depth * Math.floor(toriiSpanScale * 0.05);
            const postW = Math.max(2, Math.floor(toriiSpanScale * 0.03) + depth * 3);

            const pxLeft = cx - offset - postW * 0.5;
            const pxRight = cx + offset - postW * 0.5;

            ctx.fillStyle = cTorii;
            fillClippedRect(ctx, pxLeft, y, postW, 1, w, h);
            fillClippedRect(ctx, pxRight, y, postW, 1, w, h);

            ctx.fillStyle = cToriiHigh;
            fillClippedRect(ctx, pxLeft + postW - 1, y, 1, 1, w, h);
            fillClippedRect(ctx, pxRight + postW - 1, y, 1, 1, w, h);

            if (y > toriiTop + 10 && y < toriiBot - 10 && ((y * 7) % 11) < 3) {
                ctx.fillStyle = cKanji;
                fillClippedRect(ctx, pxLeft + postW * 0.5 - 1, y, 2, 1, w, h);
                fillClippedRect(ctx, pxRight + postW * 0.5 - 1, y, 2, 1, w, h);
            }
        }

        const beamW = Math.min(w - 2, Math.floor(toriiSpanScale * 0.60));
        const beamH = Math.max(2, Math.floor(minDim * 0.04));
        const beamX = Math.floor(cx - beamW * 0.5);
        ctx.fillStyle = cTorii;
        fillClippedRect(ctx, beamX, toriiTop, beamW, beamH, w, h);
        ctx.fillStyle = cToriiHigh;
        fillClippedRect(ctx, beamX, toriiTop, beamW, 1, w, h);

        const beamW2 = Math.min(w - 2, Math.floor(toriiSpanScale * 0.50));
        const beamH2 = Math.max(1, Math.floor(minDim * 0.02));
        ctx.fillStyle = cTorii;
        fillClippedRect(ctx, Math.floor(cx - beamW2 * 0.5), toriiTop + Math.max(3, Math.floor(minDim * 0.06)), beamW2, beamH2, w, h);
        fillClippedRect(ctx, cx - 2, toriiTop, 4, Math.max(3, Math.floor(minDim * 0.06)), w, h);

        // ---------------------------------------------------------
        // 9. THE SCULPTED BONSAI TREE & FALLING PETALS
        // ---------------------------------------------------------
        const treeScale = Math.min(minDim, w * 0.78);
        const trunkBaseX = Math.min(w - Math.max(8, Math.floor(treeScale * 0.22)), Math.floor(w * 0.85));
        const trunkBaseY = Math.min(h - 1, shoreY + Math.floor(minDim * 0.14));
        const trunkTopY = Math.max(4, shoreY - Math.floor(minDim * 0.24));
        const trunkH = Math.max(1, trunkBaseY - trunkTopY);
        const crownBaseX = trunkBaseX;

        // Curved, tapered Bonsai boughs ending tucked neatly beneath each leaf cushion
        const joinY = Math.min(trunkBaseY, trunkTopY + Math.max(2, Math.floor(treeScale * 0.06)));
        const joinDepth = (joinY - trunkTopY) / trunkH;
        const joinX = Math.floor(trunkBaseX + Math.sin(joinDepth * 3.5) * Math.floor(treeScale * 0.05));

        for (let c = 0; c < LEAF_CLUSTERS.length; c++) {
            const cl = LEAF_CLUSTERS[c];
            const endX = Math.floor(crownBaseX + cl.dx * treeScale * 0.88);
            const endY = Math.floor(trunkTopY + (cl.dy + 0.02) * treeScale);
            const bendSign = cl.dx < 0 ? -1 : 1;
            const midX = Math.floor((joinX + endX) * 0.5 + bendSign * treeScale * 0.02);
            const midY = Math.floor((joinY + endY) * 0.5 + treeScale * 0.03);

            // Lower thicker bough (3px) + bark highlight
            ctx.fillStyle = cTreeTrunk;
            drawClippedLine(ctx, joinX, joinY, midX, midY, w, h);
            drawClippedLine(ctx, joinX, joinY + 1, midX, midY + 1, w, h);
            drawClippedLine(ctx, joinX + bendSign, joinY, midX + bendSign, midY, w, h);
            ctx.fillStyle = cToriiHigh;
            drawClippedLine(ctx, joinX, joinY - 1, midX, midY - 1, w, h);

            // Upper tapered twig (2px) tucking cleanly under leaf pad
            ctx.fillStyle = cTreeTrunk;
            drawClippedLine(ctx, midX, midY, endX, endY, w, h);
            drawClippedLine(ctx, midX, midY + 1, endX, endY + 1, w, h);
        }

        // Gnarled trunk drawn cleanly over branch junctions
        for (let y = trunkTopY; y <= trunkBaseY; y++) {
            const depth = (y - trunkTopY) / trunkH;
            const tw = Math.max(2, Math.floor(treeScale * 0.04) + Math.pow(depth, 2) * Math.floor(treeScale * 0.09));
            const tx = trunkBaseX + Math.sin(depth * 3.5) * Math.floor(treeScale * 0.05);

            ctx.fillStyle = cTreeTrunk;
            fillClippedRect(ctx, tx - tw * 0.5, y, tw, 1, w, h);

            if ((y & 3) === 0 && tw >= 4) {
                ctx.fillStyle = cToriiHigh;
                fillClippedRect(ctx, tx - tw * 0.5 + 1, y, Math.max(1, tw * 0.35), 1, w, h);
            }
        }

        // Foliage pads drawn on top of branch tips
        const leafSizeScale = Math.max(0.5, Math.min(1.0, minDim / 180));
        const rustleGain = (1.0 + beatImpulse * 2.2 + ymHigh * 1.2) * (1.0 - 0.7 * ag);
        for (let i = 0; i < this.treeLeaves.length; i++) {
            const leaf = this.treeLeaves[i];
            const rustleX = Math.round(Math.sin(this.internalT * 3.0 + leaf.phase) * rustleGain);
            const rustleY = Math.round(Math.cos(this.internalT * 2.0 + leaf.phase) * (0.5 * rustleGain));
            const lx = Math.floor(crownBaseX + leaf.dx * treeScale + rustleX);
            const ly = Math.floor(trunkTopY + leaf.dy * treeScale + rustleY);
            const lr = Math.max(1, Math.round(leaf.r * leafSizeScale));
            fillClippedCircle(ctx, lx, ly, lr, cLeafCols[leaf.colType], w, h);
        }

        // Drifting petals spawned on buildup/climax beats
        for (let i = 0; i < this.petals.length; i++) {
            const p = this.petals[i];
            if (!p.active) continue;
            p.xFrac += dt * (p.vx + Math.sin(this.internalT * 2.5 + p.phase) * 0.015) * speedMult;
            p.yFrac += dt * p.vy * speedMult;
            if (p.yFrac >= 0.98 || p.xFrac <= 0.02) {
                p.active = false;
                continue;
            }
            ctx.fillStyle = (i & 1) === 0 ? cLeafCols[1] : cLeafCols[2];
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