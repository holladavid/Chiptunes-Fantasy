// === js/visuals/dse/amiga/retro-sunset.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: AMIGA RETRO SUNSET
// Pure 12-bit OCS Copper sky, dual parallax clouds, aspect-stable
// tiled parallax mountains with rim-lighting, beat-reactive Copper
// sun with climax raster slits, clipped seagulls, 1px 1/z Copper
// water with mountain mirror, scattered glints, fish & blue-hour afterglow.
// Horizon aligned with KefrensCheckerboard at floor(height * 0.55).
// =========================================================

import { quantizeAmiga12Bit, rgbToHex } from '../../utils/hardware-constraints.js';

const TWO_PI = Math.PI * 2;
const TRANSITION_DURATION = 1.15;

// 4x4 Bayer threshold matrix (0..15) for deterministic power curtains
const BAYER_4X4 = Object.freeze([
    0, 8, 2, 10,
    12, 4, 14, 6,
    3, 11, 1, 9,
    15, 7, 13, 5
]);

// Precompute all 4096 Amiga 12-bit OCS hex colors once (zero per-frame allocations)
const AMIGA_HEX_LUT = (() => {
    const lut = new Array(4096);
    for (let r4 = 0; r4 < 16; r4++) {
        for (let g4 = 0; g4 < 16; g4++) {
            for (let b4 = 0; b4 < 16; b4++) {
                const [qr, qg, qb] = quantizeAmiga12Bit(r4 * 17, g4 * 17, b4 * 17);
                lut[(r4 << 8) | (g4 << 4) | b4] = rgbToHex(qr, qg, qb);
            }
        }
    }
    return Object.freeze(lut);
})();

// 28-band OCS Copper sky palette (raw RGB before dynamic tension/afterglow cooling)
const SKY_BANDS_RGB = Object.freeze([
    [0, 0, 34], [0, 0, 34], [17, 0, 51], [17, 0, 51],
    [34, 0, 68], [34, 0, 68], [68, 0, 68], [68, 0, 68],
    [102, 0, 51], [102, 0, 51], [136, 0, 34], [136, 0, 34],
    [170, 17, 17], [170, 17, 17], [204, 51, 0], [204, 51, 0],
    [238, 85, 0], [238, 85, 0], [255, 119, 0], [255, 119, 0],
    [255, 153, 0], [255, 153, 0], [255, 187, 0], [255, 187, 0],
    [255, 221, 0], [255, 221, 0], [255, 255, 17], [255, 255, 17]
]);

// Blue-hour / dusk target bands for smooth afterglow transition
const DUSK_BANDS_RGB = Object.freeze([
    [0, 0, 17], [0, 0, 17], [0, 0, 34], [0, 0, 34],
    [17, 0, 51], [17, 0, 51], [17, 17, 68], [17, 17, 68],
    [34, 17, 85], [34, 17, 85], [34, 34, 102], [34, 34, 102],
    [51, 34, 102], [51, 34, 102], [68, 34, 102], [68, 34, 102],
    [85, 51, 102], [85, 51, 102], [102, 51, 102], [102, 51, 102],
    [119, 68, 102], [119, 68, 102], [136, 85, 102], [136, 85, 102],
    [153, 102, 119], [153, 102, 119], [170, 119, 136], [170, 119, 136]
]);

// Seamless tiled mountain ranges (positive base height eliminates 0px horizon gaps)
const MOUNTAINS_BG = Object.freeze([
    { x: 0, y: 6 }, { x: 15, y: 15 }, { x: 25, y: 6 }, { x: 38, y: 24 },
    { x: 52, y: 8 }, { x: 68, y: 28 }, { x: 82, y: 6 }, { x: 100, y: 6 }
]);

const MOUNTAINS_FG = Object.freeze([
    { x: 0, y: 6 }, { x: 20, y: 9 }, { x: 35, y: 16 }, { x: 50, y: 6 },
    { x: 65, y: 18 }, { x: 78, y: 6 }, { x: 90, y: 12 }, { x: 100, y: 6 }
]);

// Cloud puff offsets relative to base size
const CLOUD_PUFFS = Object.freeze([
    { dx: 0, dy: 0, r: 4 },
    { dx: 8, dy: 1, r: 6 },
    { dx: 18, dy: -3, r: 10 },
    { dx: 30, dy: 1, r: 7 },
    { dx: 42, dy: -4, r: 11 },
    { dx: 56, dy: -1, r: 8 },
    { dx: 68, dy: -5, r: 9 },
    { dx: 80, dy: 2, r: 4 }
]);

function clamp01(v) {
    if (!Number.isFinite(v)) return 0;
    return v < 0 ? 0 : (v > 1 ? 1 : v);
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function readChannel(arr, idx, fallback) {
    if (!arr || idx >= arr.length) return fallback;
    return clamp01(arr[idx]);
}

function toAmigaHex(r, g, b) {
    const r4 = r <= 0 ? 0 : (r >= 255 ? 15 : Math.round(r / 17));
    const g4 = g <= 0 ? 0 : (g >= 255 ? 15 : Math.round(g / 17));
    const b4 = b <= 0 ? 0 : (b >= 255 ? 15 : Math.round(b / 17));
    return AMIGA_HEX_LUT[(r4 << 8) | (g4 << 4) | b4];
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
    if (icx + ri < 0 || icx - ri >= bufW || icy - ri >= maxY || icy + ri < 0) {
        return;
    }
    ctx.fillStyle = colorHex;
    const rSq = ri * ri;
    for (let dy = -ri; dy <= ri; dy++) {
        const py = icy + dy;
        if (py < 0 || py >= maxY) continue;
        const dx = Math.floor(Math.sqrt(rSq - dy * dy));
        const x0 = Math.max(0, icx - dx);
        const x1 = Math.min(bufW, icx + dx + 1);
        const cw = x1 - x0;
        if (cw > 0) {
            ctx.fillRect(x0, py, cw, 1);
        }
    }
}

function drawClippedLine(ctx, x0, y0, x1, y1, minX, minY, maxX, maxY) {
    if (
        !Number.isFinite(x0) || !Number.isFinite(y0) ||
        !Number.isFinite(x1) || !Number.isFinite(y1) ||
        maxX < minX || maxY < minY
    ) {
        return;
    }

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

    if (
        !clipTest(-dx, x0 - minX) ||
        !clipTest(dx, maxX - x0) ||
        !clipTest(-dy, y0 - minY) ||
        !clipTest(dy, maxY - y0)
    ) {
        return;
    }

    let cx0 = Math.floor(x0 + t0 * dx);
    let cy0 = Math.floor(y0 + t0 * dy);
    let cx1 = Math.floor(x0 + t1 * dx);
    let cy1 = Math.floor(y0 + t1 * dy);

    cx0 = cx0 < minX ? minX : (cx0 > maxX ? maxX : cx0);
    cy0 = cy0 < minY ? minY : (cy0 > maxY ? maxY : cy0);
    cx1 = cx1 < minX ? minX : (cx1 > maxX ? maxX : cx1);
    cy1 = cy1 < minY ? minY : (cy1 > maxY ? maxY : cy1);

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
        if (e2 > -ady) {
            err -= ady;
            cx0 += sx;
        }
        if (e2 < adx) {
            err += adx;
            cy0 += sy;
        }
    }
}

export class AmigaRetroSunset {
    constructor() {
        this.name = 'Amiga Retro Sunset';

        // Time & state tracking
        this.lastT = null;
        this.lastState = 'idle';
        this.stateAge = 0;

        // Continuous simulation phases (normalized for rotation continuity)
        this.internalT = 0;
        this.waterT = 0;
        this.starCycle = 0;
        this.smoothedSpeed = 1.0;
        this.afterglowMix = 0.0;

        this.bgScrollNorm = 0.0;
        this.fgScrollNorm = 0.0;
        this.cloud1NormX = 0.72;
        this.cloud2NormX = 0.18;

        // Discrete beat-driven state
        this.beatCounter = 0;
        this.lastBeatCount = -1;
        this.horizonParity = 0;
        this.flarePulseAge = 10.0;
        this.flarePeak = 0.0;

        // Seagulls in normalized coordinates
        this.birdX = new Float32Array([-1, -1, -1]);
        this.birdYNorm = new Float32Array([0.5, 0.5, 0.5]);
        this.birdActive = [false, false, false];
        this.birdPhase = new Float32Array([0, 0.5, 1.0]);

        // Leaping fish in normalized coordinates
        this.fishActive = false;
        this.fishT = 0;
        this.fishStartFrac = 0.5;
        this.fishDepthFrac = 0.5;

        // Instance-owned deterministic Xorshift32 PRNG (zero Math.random!)
        this.prngState = 0x53554E53; // 'SUNS'

        // Height-dependent 1/z water LUT & per-frame mountain mask cache
        this.cachedWaterHeight = -1;
        this.cachedWaterHorizon = -1;
        this.waterLineCount = 0;
        this.waterDepths = new Float32Array(0);
        this.waterInvZ = new Float32Array(0);
        this.mountainProfile = new Uint16Array(0);
        this.maxMountainH = 0;
    }

    _nextRandom() {
        let x = this.prngState | 0;
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        this.prngState = x;
        return (x >>> 0) / 4294967296;
    }

    _ensureWaterCache(height, horizon) {
        if (this.cachedWaterHeight === height && this.cachedWaterHorizon === horizon) {
            return;
        }
        this.cachedWaterHeight = height;
        this.cachedWaterHorizon = horizon;

        const floorHeight = Math.max(1, height - horizon);
        this.waterLineCount = floorHeight;

        if (this.waterDepths.length < floorHeight) {
            this.waterDepths = new Float32Array(floorHeight);
            this.waterInvZ = new Float32Array(floorHeight);
        }

        const invFloor = 1.0 / floorHeight;
        for (let row = 0; row < floorHeight; row++) {
            const depth = clamp01(row * invFloor);
            this.waterDepths[row] = depth;
            this.waterInvZ[row] = 1.0 / (depth + 0.085);
        }
    }

    resize(width, height) {
        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
            return;
        }
        const w = Math.floor(width);
        const h = Math.floor(height);
        const horizon = Math.min(h - 1, Math.max(1, Math.floor(h * 0.55)));
        this._ensureWaterCache(h, horizon);
        if (this.mountainProfile.length < w) {
            this.mountainProfile = new Uint16Array(w);
        }
    }

    _drawMountainRange(ctx, w, horizon, periodW, points, colorHex, scrollNorm, heightScale, outlineHex) {
        const sOff = scrollNorm * periodW;
        const minMh = horizon >= 12 ? 2 : (horizon >= 4 ? 1 : 0);

        for (let x = 0; x < w; x++) {
            let vx = (x + sOff) % periodW;
            if (vx < 0) vx += periodW;
            const pct = (vx / periodW) * 100;

            let p1 = null;
            let p2 = null;
            for (let i = 0; i < points.length - 1; i++) {
                if (pct >= points[i].x && pct <= points[i + 1].x) {
                    p1 = points[i];
                    p2 = points[i + 1];
                    break;
                }
            }
            if (!p1 || !p2 || p2.x === p1.x) continue;

            const u = (pct - p1.x) / (p2.x - p1.x);
            const tSmooth = (1 - Math.cos(u * Math.PI)) * 0.5;
            const hPct = p1.y + (p2.y - p1.y) * tSmooth;

            let mh = Math.max(minMh, Math.floor(horizon * heightScale * (hPct / 100)));
            if (mh <= 0) continue;

            let drawY = horizon - mh;
            if (drawY < 0) {
                mh += drawY;
                drawY = 0;
            }
            const drawH = Math.min(mh, horizon - drawY);
            if (drawH <= 0) continue;

            if (drawH > this.mountainProfile[x]) {
                this.mountainProfile[x] = drawH;
            }
            if (drawH > this.maxMountainH) {
                this.maxMountainH = drawH;
            }

            ctx.fillStyle = colorHex;
            ctx.fillRect(x, drawY, 1, drawH);

            if (outlineHex && drawH >= 2 && drawY < horizon) {
                ctx.fillStyle = outlineHex;
                ctx.fillRect(x, drawY, 1, 1);
            }
        }
    }

    _fillWaterMaskedSpan(ctx, xStart, xEnd, y, checkMountMask, mountWobble, w, mirrorH) {
        let x0 = Math.floor(xStart);
        let x1 = Math.floor(xEnd);
        if (x0 < 0) x0 = 0;
        if (x1 > w) x1 = w;
        if (!(x1 > x0)) return;

        if (!checkMountMask) {
            ctx.fillRect(x0, y, x1 - x0, 1);
            return;
        }

        let runStart = -1;
        for (let x = x0; x < x1; x++) {
            const mx = x + mountWobble;
            const sampleX = mx < 0 ? 0 : (mx >= w ? w - 1 : mx);
            if (mirrorH >= this.mountainProfile[sampleX]) {
                if (runStart < 0) runStart = x;
            } else if (runStart >= 0) {
                ctx.fillRect(runStart, y, x - runStart, 1);
                runStart = -1;
            }
        }
        if (runStart >= 0) {
            ctx.fillRect(runStart, y, x1 - runStart, 1);
        }
    }

    _drawCloud(ctx, baseX, baseY, scale, colCore, colMid, colShad, w, horizon) {
        for (let i = 0; i < CLOUD_PUFFS.length; i++) {
            const p = CLOUD_PUFFS[i];
            const px = baseX + p.dx * scale;
            const py = baseY + (p.dy + 2) * scale;
            const pr = Math.max(1, Math.round(p.r * scale));
            fillClippedCircle(ctx, px, py, pr, colShad, w, horizon);
        }
        for (let i = 0; i < CLOUD_PUFFS.length; i++) {
            const p = CLOUD_PUFFS[i];
            const px = baseX + p.dx * scale;
            const py = baseY + (p.dy + 1) * scale;
            const pr = Math.max(1, Math.round(p.r * scale));
            fillClippedCircle(ctx, px, py, pr, colMid, w, horizon);
        }
        for (let i = 0; i < CLOUD_PUFFS.length; i++) {
            const p = CLOUD_PUFFS[i];
            const px = baseX + p.dx * scale;
            const py = baseY + p.dy * scale;
            const pr = Math.max(1, Math.round((p.r - 1) * scale));
            fillClippedCircle(ctx, px, py, pr, colCore, w, horizon);
        }
    }

    _drawPowerCurtain(ctx, w, h, horizon, revealRatio) {
        const skyActiveTop = Math.min(horizon, Math.max(0, Math.ceil(horizon * (1.0 - revealRatio))));
        const floorHeight = Math.max(1, h - horizon);
        const floorActiveBottom = Math.min(
            h,
            Math.max(horizon, horizon + Math.floor(floorHeight * revealRatio))
        );

        ctx.fillStyle = '#000000';
        if (skyActiveTop > 0) {
            ctx.fillRect(0, 0, w, skyActiveTop);
        }
        if (floorActiveBottom < h) {
            ctx.fillRect(0, floorActiveBottom, w, h - floorActiveBottom);
        }

        const bandPx = Math.max(4, Math.min(18, Math.floor(h * 0.07)));
        const stepX = Math.max(2, Math.min(4, Math.floor(w * 0.02)));
        const stepY = 2;

        const topEnd = Math.min(horizon, skyActiveTop + bandPx);
        for (let y = skyActiveTop; y < topEnd; y += stepY) {
            const vis = (y - skyActiveTop + 1) / bandPx;
            const bayerRow = ((y >> 1) & 3) * 4;
            for (let x = 0; x < w; x += stepX) {
                const bayerX = Math.floor(x / stepX) & 3;
                if (BAYER_4X4[bayerRow + bayerX] >= vis * 16) {
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
                const bayerX = Math.floor(x / stepX) & 3;
                if (BAYER_4X4[bayerRow + bayerX] >= vis * 16) {
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
            this.smoothedSpeed = 1.0;
            this.afterglowMix = 0.0;
            this.flarePulseAge = 10.0;
            this.flarePeak = 0.0;
            this.fishActive = false;
            this.birdActive[0] = false;
            this.birdActive[1] = false;
            this.birdActive[2] = false;
            return;
        }

        // Safe PAL-friendly dt clamped against tab jumps
        let dt = this.lastT === null ? 0.02 : (safeT - this.lastT);
        this.lastT = safeT;
        if (!Number.isFinite(dt) || dt < 0) {
            dt = 0.02;
        } else if (dt > 0.1) {
            dt = 0.1;
        }

        if (this.lastState !== state) {
            this.lastState = state;
            this.stateAge = 0;
        } else {
            this.stateAge += dt;
        }

        // ---------------------------------------------------------
        // Defensive metric parsing
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
        const chBass = readChannel(smooth, 0, energy);
        const chMid = readChannel(smooth, 1, energy * 0.9);
        const chHigh = readChannel(smooth, 2, energy * 0.75);

        // ---------------------------------------------------------
        // Discrete Beat Events (strictly gated on beatStarted)
        // ---------------------------------------------------------
        const horizon = Math.min(h - 1, Math.max(1, Math.floor(h * 0.55)));
        const floorHeight = Math.max(1, h - horizon);
        const allowSpawns = state !== 'afterglow' && state !== 'stopping';

        if (beatStarted) {
            const incomingCount = Number.isFinite(safeMetrics.beatCount)
                ? Math.floor(safeMetrics.beatCount)
                : (this.lastBeatCount + 1);

            if (incomingCount !== this.lastBeatCount || !Number.isFinite(safeMetrics.beatCount)) {
                this.lastBeatCount = incomingCount;
                this.beatCounter++;
                this.horizonParity = incomingCount & 1;

                this.flarePulseAge = 0;
                const levelWeight = beatLevel >= 3 ? 1.0 : (beatLevel === 2 ? 0.65 : (beatLevel === 1 ? 0.35 : 0.0));
                this.flarePeak = Math.max(beatStrength, levelWeight);

                if (allowSpawns && incomingCount > 0) {
                    if (incomingCount % 16 === 0 && !this.fishActive && floorHeight >= 10) {
                        this.fishActive = true;
                        this.fishT = 0;
                        this.fishStartFrac = 0.20 + this._nextRandom() * 0.58;
                        this.fishDepthFrac = 0.25 + this._nextRandom() * 0.50;
                    }
                    if (
                        incomingCount % 24 === 0 &&
                        !(this.birdActive[0] || this.birdActive[1] || this.birdActive[2])
                    ) {
                        const baseNormY = 0.45 + this._nextRandom() * 0.15;
                        this.birdActive[0] = true; this.birdX[0] = 1.04; this.birdYNorm[0] = baseNormY;
                        this.birdActive[1] = true; this.birdX[1] = 1.11; this.birdYNorm[1] = Math.max(0.15, baseNormY - 0.08);
                        this.birdActive[2] = true; this.birdX[2] = 1.14; this.birdYNorm[2] = Math.min(0.85, baseNormY + 0.08);
                    }
                }
            }
        }

        this.flarePulseAge = Math.min(10.0, this.flarePulseAge + dt);

        // ---------------------------------------------------------
        // Macro State Dynamics & Tension Mapping
        // ---------------------------------------------------------
        let targetSpeed = 1.0 + tension * 0.35;
        let targetAfterglow = 0.0;

        if (state === 'starting') {
            targetSpeed = 0.8;
        } else if (state === 'playing') {
            targetSpeed = 0.95 + tension * 0.4;
        } else if (state === 'buildup') {
            targetSpeed = 1.35 + tension * 0.55;
        } else if (state === 'climax') {
            targetSpeed = 1.9 + tension * 0.65 + (isClimaxLocked ? 0.2 : 0);
        } else if (state === 'afterglow') {
            targetSpeed = 0.35;
            targetAfterglow = 1.0;
        } else if (state === 'stopping') {
            targetSpeed = 0.45;
            targetAfterglow = this.afterglowMix;
        }

        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * Math.min(1.0, dt * 4.0);
        this.afterglowMix += (targetAfterglow - this.afterglowMix) * Math.min(1.0, dt * 2.0);
        const ag = this.afterglowMix;

        const speedMult = this.smoothedSpeed;
        this.internalT = (this.internalT + dt * speedMult) % 4096;
        this.waterT = (this.waterT + dt * speedMult) % 4096;
        this.starCycle = (this.starCycle + dt * (0.30 + 0.15 * chHigh) * (1.0 - 0.5 * ag)) % TWO_PI;

        // Parallax scroll phases (normalized [0, 1) so rotation keeps exact positions)
        this.bgScrollNorm = (this.bgScrollNorm + dt * 0.016 * speedMult) % 1.0;
        this.fgScrollNorm = (this.fgScrollNorm + dt * 0.036 * speedMult) % 1.0;
        this.cloud1NormX = (this.cloud1NormX + dt * (0.042 + 0.018 * speedMult)) % 1.0;
        this.cloud2NormX = (this.cloud2NormX + dt * (0.020 + 0.012 * speedMult)) % 1.0;

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

        const minDim = Math.min(w, h);
        this._ensureWaterCache(h, horizon);
        if (this.mountainProfile.length < w) {
            this.mountainProfile = new Uint16Array(w);
        }
        this.mountainProfile.fill(0, 0, w);
        this.maxMountainH = 0;

        // ---------------------------------------------------------
        // Dynamic 12-Bit OCS Palette (Tension + Beats + Afterglow)
        // ---------------------------------------------------------
        const warmGlow = (0.12 * tension + 0.18 * beatImpulse) * (1.0 - ag);
        const cSunCore = toAmigaHex(lerp(255, 221, ag), lerp(255, 204, ag), lerp(255, 238, ag));
        const cSunYellow = toAmigaHex(lerp(255, 187, ag), lerp(221, 136, ag), lerp(0, 119, ag));
        const cSunOrange = toAmigaHex(lerp(255, 153, ag), lerp(119, 85, ag), lerp(0, 102, ag));
        const cSunRed = toAmigaHex(lerp(204, 102, ag), lerp(51, 34, ag), lerp(0, 68, ag));
        const cSunGlow = toAmigaHex(lerp(255, 170, ag), lerp(153, 102, ag), lerp(0, 102, ag));

        const cMountain1 = toAmigaHex(lerp(68, 34, ag), lerp(17, 17, ag), lerp(102, 68, ag));
        const cMountain2 = toAmigaHex(lerp(25, 17, ag), lerp(5, 8, ag), lerp(45, 34, ag));
        const rimGain = (0.85 + 0.35 * chMid + 0.45 * beatImpulse) * (1.0 - 0.55 * ag);
        const cMountOutl = toAmigaHex(128 * rimGain + 40 * warmGlow, 72 * rimGain, 165 * rimGain);

        const cloudLit = (0.88 + 0.18 * chMid + 0.12 * beatImpulse) * (1.0 - 0.42 * ag);
        const cCloudCore = toAmigaHex(255 * cloudLit, lerp(255, 204, ag) * cloudLit, lerp(255, 238, ag) * cloudLit);
        const cCloudMid = toAmigaHex(lerp(204, 102, ag) * cloudLit, lerp(136, 85, ag) * cloudLit, lerp(68, 119, ag) * cloudLit);
        const cCloudShad = toAmigaHex(lerp(102, 51, ag), lerp(68, 34, ag), lerp(68, 68, ag));

        const cLensCore = cSunCore;
        const cLensRing = toAmigaHex(lerp(255, 153, ag), lerp(170, 119, ag), lerp(0, 136, ag));
        const cWaterMountMirror = toAmigaHex(lerp(34, 17, ag), 0, lerp(51, 34, ag));
        const cReflCrimson = toAmigaHex(lerp(187, 85, ag), lerp(34, 17, ag), lerp(0, 68, ag));
        const cReflDeep = toAmigaHex(lerp(136, 68, ag), lerp(17, 17, ag), lerp(17, 68, ag));
        const cWaterRefl = cSunOrange;

        // ---------------------------------------------------------
        // LAYER 1: 28-BAND COPPER SKY
        // ---------------------------------------------------------
        const bandCount = SKY_BANDS_RGB.length;
        const bandH = horizon / bandCount;
        for (let i = 0; i < bandCount; i++) {
            const startY = Math.floor(i * bandH);
            const endY = (i === bandCount - 1)
                ? horizon
                : Math.min(horizon, Math.floor((i + 1) * bandH));
            const drawH = endY - startY;
            if (drawH <= 0) continue;

            const src = SKY_BANDS_RGB[i];
            const dst = DUSK_BANDS_RGB[i];
            const bandPct = i / (bandCount - 1);
            const bandBoost = 1.0 + warmGlow * bandPct;

            const r = lerp(src[0], dst[0], ag) * bandBoost;
            const g = lerp(src[1], dst[1], ag) * bandBoost;
            const b = lerp(src[2], dst[2], ag) * (1.0 + 0.12 * ag);

            ctx.fillStyle = toAmigaHex(r, g, b);
            ctx.fillRect(0, startY, w, drawH);
        }

        // ---------------------------------------------------------
        // LAYER 2: SINGLE BIG TWINKLING STAR
        // ---------------------------------------------------------
        if (this.starCycle < 0.95) {
            const starBrightness = Math.sin((this.starCycle / 0.95) * Math.PI) * (0.75 + 0.35 * chHigh);
            const sxStar = Math.floor(w * 0.80);
            const syStar = Math.floor(horizon * 0.20);

            ctx.fillStyle = starBrightness > 0.66
                ? cSunCore
                : (starBrightness > 0.33 ? cSunYellow : cSunOrange);
            fillClippedRect(ctx, sxStar, syStar, 2, 2, w, h, 0, horizon);
            fillClippedRect(ctx, sxStar - 2, syStar, 6, 2, w, h, 0, horizon);
            fillClippedRect(ctx, sxStar, syStar - 2, 2, 6, w, h, 0, horizon);
        }

        // ---------------------------------------------------------
        // LAYER 3: SOLAR LENSFLARE (Climax / High Tension)
        // ---------------------------------------------------------
        const flareActive = (state === 'climax' || (state === 'buildup' && tension > 0.6)) && ag < 0.5;
        if (flareActive) {
            const lx = Math.floor(w * 0.15);
            const ly = Math.floor(horizon * 0.25);
            const flareDecay = this.flarePulseAge < 0.25 ? this.flarePeak : 0.0;
            const lfScale = Math.max(
                1,
                Math.floor((minDim / 200) * (2 + 2 * Math.max(beatImpulse, flareDecay) + chHigh))
            );

            ctx.fillStyle = cLensCore;
            fillClippedRect(ctx, lx, ly, lfScale, lfScale, w, h, 0, horizon);
            ctx.fillStyle = cLensRing;
            fillClippedRect(ctx, lx - lfScale * 2, ly, lfScale * 5, 1, w, h, 0, horizon);
            fillClippedRect(ctx, lx, ly - lfScale * 2, 1, lfScale * 5, w, h, 0, horizon);
        }

        // ---------------------------------------------------------
        // LAYER 4: COPPER SUN (with Beat Pump & Climax Raster Slits)
        // ---------------------------------------------------------
        const sunPulseGain = (0.65 * beatImpulse + 0.35 * chBass) * (1.0 - 0.65 * ag);
        const sunR = Math.max(3, Math.floor((minDim * 0.23) + (sunPulseGain * minDim * 0.042)));
        const sx = Math.floor(w * 0.44);
        const sy = Math.floor(horizon - Math.max(4, Math.floor(horizon * 0.07)));

        const sunRadiusSq = sunR * sunR;
        const rasterSlitsActive = state === 'climax' && (beatImpulse > 0.32 || isClimaxLocked) && ag < 0.3;

        for (let dy = -sunR; dy <= sunR; dy += 2) {
            const yLine = sy + dy;
            if (yLine >= horizon || yLine + 2 <= 0) continue;

            const yNorm = dy / sunR;
            if (rasterSlitsActive && yNorm > -0.15) {
                if ((((yLine >> 1) + this.beatCounter) % 3 + 3) % 3 === 0) continue;
            }

            const dx = Math.round(Math.sqrt(Math.max(0, sunRadiusSq - dy * dy)));
            if (dx <= 0) continue;

            let sunColor = cSunRed;
            if (yNorm < -0.5) {
                sunColor = cSunCore;
            } else if (yNorm < 0.0) {
                sunColor = cSunYellow;
            } else if (yNorm < 0.5) {
                sunColor = cSunOrange;
            }

            ctx.fillStyle = sunColor;
            fillClippedRect(ctx, sx - dx, yLine, dx * 2, 2, w, h, 0, horizon);
        }

        // ---------------------------------------------------------
        // LAYER 5: DUAL PARALLAX CLOUDS (normalized coordinates)
        // ---------------------------------------------------------
        const cloudScale1 = Math.max(0.35, Math.min(0.85, minDim / 280));
        const cloudSpan1 = w + 180 * cloudScale1;
        const cx1 = this.cloud1NormX * cloudSpan1 - 90 * cloudScale1;
        const cy1 = Math.floor(horizon * 0.24);
        if (state === 'buildup' || state === 'climax' || tension > 0.35) {
            this._drawCloud(ctx, cx1, cy1, cloudScale1, cCloudMid, cCloudShad, cMountain1, w, horizon);
        }

        const cloudScale2 = Math.max(0.45, Math.min(1.15, minDim / 220));
        const cloudSpan2 = w + 180 * cloudScale2;
        const cx2 = this.cloud2NormX * cloudSpan2 - 90 * cloudScale2;
        const cy2 = Math.floor(horizon * 0.45);
        this._drawCloud(ctx, cx2, cy2, cloudScale2, cCloudCore, cCloudMid, cCloudShad, w, horizon);

        // ---------------------------------------------------------
        // LAYER 6: ASPECT-STABLE PARALLAX MOUNTAINS
        // ---------------------------------------------------------
        const periodW = Math.max(80, Math.floor(horizon * 2.2));
        this._drawMountainRange(
            ctx, w, horizon, periodW, MOUNTAINS_BG, cMountain1, this.bgScrollNorm, 0.38, null
        );
        this._drawMountainRange(
            ctx, w, horizon, periodW, MOUNTAINS_FG, cMountain2, this.fgScrollNorm, 0.25, cMountOutl
        );

        // ---------------------------------------------------------
        // LAYER 7: GLIDING SEAGULLS (clipped to sky)
        // ---------------------------------------------------------
        const wingSpan = Math.max(2, Math.min(5, Math.floor(minDim * 0.022)));
        for (let b = 0; b < 3; b++) {
            if (!this.birdActive[b]) continue;
            this.birdX[b] -= dt * 0.075 * (0.7 + 0.3 * speedMult);
            if (this.birdX[b] < -0.08) {
                this.birdActive[b] = false;
                continue;
            }
            const bx = Math.floor(this.birdX[b] * w);
            const yBob = Math.sin(this.internalT * 2.0 + this.birdPhase[b]) * (horizon * 0.028);
            const by = Math.floor(this.birdYNorm[b] * horizon + yBob);
            const flap = Math.sin(this.internalT * 8.0 + this.birdPhase[b]) > 0;
            const wingY = flap ? -Math.max(1, wingSpan >> 1) : Math.max(1, wingSpan >> 1);

            ctx.fillStyle = cMountain2;
            drawClippedLine(ctx, bx - wingSpan, by + wingY, bx, by, 0, 0, w - 1, horizon - 1);
            drawClippedLine(ctx, bx, by, bx + wingSpan, by + wingY, 0, 0, w - 1, horizon - 1);
        }

        // ---------------------------------------------------------
        // LAYER 8: 1PX 1/Z COPPER WATER & MIRRORED SUNSET REFLECTION
        // ---------------------------------------------------------
        const shimmerMod = 1.0 + 0.28 * beatImpulse + 0.16 * chBass;
        const hShift = this.horizonParity === 0 ? 1 : 0;
        const maxMountH = this.maxMountainH;
        const discDepthLimit = 0.62;
        const bgGain = 1.0 - 0.30 * ag;

        for (let row = 0; row < floorHeight; row++) {
            const y = horizon + row;
            const d = this.waterDepths[row];
            const invZ = this.waterInvZ[row];

            const wave1 = Math.sin(invZ * 5.2 + this.waterT * 3.1);
            const wave2 = Math.sin(invZ * 8.7 - this.waterT * 2.3 + d * 4.0);
            const waveCrest = 0.62 * wave1 + 0.38 * wave2;

            // 8a. Full-width 1px Copper twilight ocean gradient + subtle wave ripples
            const crestLift = waveCrest > 0.32 ? 17 : 0;
            const wg = (d < 0.35 ? 0 : (d < 0.72 ? 17 : 34)) * bgGain + (d > 0.38 && crestLift > 0 ? 17 : 0);
            const wb = (34 + d * 51) * bgGain + crestLift;
            ctx.fillStyle = toAmigaHex(0, wg, wb);
            ctx.fillRect(0, y, w, 1);

            // 8b. Rippled mountain reflection mask along the shoreline
            const mirrorH = Math.floor(row * 0.72);
            const checkMountMask = mirrorH <= maxMountH;
            const mountWobble = checkMountMask
                ? Math.round(Math.sin(row * 0.55 + this.waterT * 3.5) * (1.0 + row * 0.08))
                : 0;

            if (checkMountMask && row > 0 && waveCrest < 0.28) {
                ctx.fillStyle = cWaterMountMirror;
                let runStart = -1;
                for (let x = 0; x < w; x++) {
                    const mx = x + mountWobble;
                    const sampleX = mx < 0 ? 0 : (mx >= w ? w - 1 : mx);
                    if (mirrorH < this.mountainProfile[sampleX]) {
                        if (runStart < 0) runStart = x;
                    } else if (runStart >= 0) {
                        ctx.fillRect(runStart, y, x - runStart, 1);
                        runStart = -1;
                    }
                }
                if (runStart >= 0) {
                    ctx.fillRect(runStart, y, w - runStart, 1);
                }
            }

            if (row < 2) continue;

            // 8c. Sun reflection: mirrored solar disc tapering into broken glitter path
            const sway = Math.round(
                Math.sin(invZ * 3.8 + this.waterT * 2.6) * (1.2 + d * 8.5) +
                Math.sin(row * 0.45 - this.waterT * 4.2) * (0.6 + d * 3.5)
            );
            const rowCenter = sx + sway + (row & 1 ? 0 : hShift);

            const discChord = d < discDepthLimit
                ? Math.sqrt(Math.max(0, 1.0 - (d / discDepthLimit) * (d / discDepthLimit)))
                : 0.0;
            const glitterBase = Math.max(0.16, 0.72 * (1.0 - d * 0.78));
            const waveSpread = 0.76 + 0.36 * waveCrest;
            const halfW = sunR * (0.58 * discChord + 0.42 * glitterBase) * waveSpread * shimmerMod;
            if (halfW < 1.5) continue;

            const fadeOut = 1.0 - Math.max(0, (d - 0.78) / 0.22);
            const crestThreshold = -0.34 - 0.14 * beatImpulse + (1.0 - fadeOut) * 0.45;
            if (waveCrest < crestThreshold) continue;

            // Warm Copper glow (splits into separated wave segments in mid/foreground)
            ctx.fillStyle = d < 0.32
                ? cSunOrange
                : (d < 0.68 ? (waveCrest > 0.15 ? cSunOrange : cReflCrimson) : cReflDeep);

            const splitFactor = Math.sin(invZ * 11.4 + this.waterT * 2.4 + row * 0.25);
            if (d > 0.22 && splitFactor < -0.15) {
                const gapHalf = Math.max(1.5, halfW * (0.18 + 0.18 * (-splitFactor)));
                const shiftA = Math.sin(invZ * 7.1 - this.waterT * 3.0) * halfW * 0.18;
                this._fillWaterMaskedSpan(
                    ctx, rowCenter - halfW + shiftA, rowCenter - gapHalf + shiftA,
                    y, checkMountMask, mountWobble, w, mirrorH
                );
                this._fillWaterMaskedSpan(
                    ctx, rowCenter + gapHalf + shiftA, rowCenter + halfW + shiftA,
                    y, checkMountMask, mountWobble, w, mirrorH
                );
            } else {
                const asym = Math.sin(invZ * 6.3 + this.waterT * 2.8) * halfW * 0.14;
                this._fillWaterMaskedSpan(
                    ctx, rowCenter - halfW + asym, rowCenter + halfW + asym * 0.6,
                    y, checkMountMask, mountWobble, w, mirrorH
                );
            }

            // Golden wave ribbons (offset & split to avoid solid block look)
            if (waveCrest > -0.08 - 0.10 * beatImpulse) {
                ctx.fillStyle = (d < 0.28 || waveCrest > 0.35) ? cSunYellow : cSunOrange;
                const ribbonW = halfW * (0.42 + 0.24 * Math.max(0, waveCrest));
                const ribbonShift = Math.sin(invZ * 6.4 + this.waterT * 3.9 + row * 0.35) * (halfW * 0.28);

                if (d > 0.15 && wave2 < 0.2) {
                    const segW = Math.max(2, ribbonW * 0.45);
                    this._fillWaterMaskedSpan(
                        ctx, rowCenter - ribbonW * 0.85 + ribbonShift, rowCenter - ribbonW * 0.85 + ribbonShift + segW,
                        y, checkMountMask, mountWobble, w, mirrorH
                    );
                    this._fillWaterMaskedSpan(
                        ctx, rowCenter + ribbonW * 0.25 + ribbonShift * 0.5, rowCenter + ribbonW * 0.25 + ribbonShift * 0.5 + segW * 0.85,
                        y, checkMountMask, mountWobble, w, mirrorH
                    );
                } else {
                    this._fillWaterMaskedSpan(
                        ctx, rowCenter - ribbonW * 0.5 + ribbonShift, rowCenter + ribbonW * 0.5 + ribbonShift,
                        y, checkMountMask, mountWobble, w, mirrorH
                    );
                }
            }

            // Scattered specular Copper sparkles on sharpest crests (no centered divider)
            const sparkleGate = waveCrest + 0.18 * beatImpulse + 0.14 * chHigh;
            if (sparkleGate > 0.28) {
                ctx.fillStyle = (sparkleGate > 0.56 || d < 0.18) ? cSunCore : cSunYellow;
                const glintCount = (sparkleGate > 0.65 && d < 0.65) ? 3 : 2;
                const spreadRange = Math.max(3, halfW * 0.72);
                for (let g = 0; g < glintCount; g++) {
                    const hashPhase = invZ * (17.3 + g * 11.4) + row * (1.91 - g * 0.73) + this.waterT * (4.1 + g * 1.7);
                    const gx = rowCenter + Math.sin(hashPhase) * spreadRange;
                    const gw = 2 + Math.floor((0.5 + 0.5 * Math.cos(hashPhase * 1.7)) * (4.5 - d * 2.0 + 2.0 * beatImpulse));
                    this._fillWaterMaskedSpan(
                        ctx, gx - gw * 0.5, gx + gw * 0.5,
                        y, checkMountMask, mountWobble, w, mirrorH
                    );
                }
            }
        }

        // ---------------------------------------------------------
        // LAYER 9: LEAPING FISH (deterministic & clipped to water)
        // ---------------------------------------------------------
        if (this.fishActive) {
            this.fishT += dt * 1.8;
            if (this.fishT >= 1.0) {
                this.fishActive = false;
            } else {
                const swimSpan = Math.max(8, Math.min(40, Math.floor(minDim * 0.14)));
                const arcHeight = Math.max(4, Math.min(24, Math.floor(floorHeight * 0.24)));
                const fx = Math.floor(this.fishStartFrac * w + this.fishT * swimSpan);
                const u = 2.0 * this.fishT - 1.0;
                const arc = 1.0 - u * u;
                const baseY = horizon + Math.floor(this.fishDepthFrac * Math.max(4, floorHeight - 4));
                const fy = Math.floor(baseY - arc * arcHeight);

                if (this.fishT < 0.15 || this.fishT > 0.85) {
                    ctx.fillStyle = cSunCore;
                    fillClippedRect(ctx, fx - 4, baseY, 1, 1, w, h, horizon, h);
                    fillClippedRect(ctx, fx + 4, baseY, 1, 1, w, h, horizon, h);
                    fillClippedRect(ctx, fx - 2, baseY - 2, 1, 1, w, h, horizon, h);
                    fillClippedRect(ctx, fx + 2, baseY - 2, 1, 1, w, h, horizon, h);
                    fillClippedRect(ctx, fx, baseY - 4, 1, 1, w, h, horizon, h);
                }

                ctx.fillStyle = cSunGlow;
                fillClippedRect(ctx, fx - 2, fy - 1, 4, 3, w, h, horizon, h);
                ctx.fillStyle = cWaterRefl;
                fillClippedRect(ctx, fx - 4, fy, 2, 1, w, h, horizon, h);
            }
        }

        // ---------------------------------------------------------
        // LAYER 10: BAYER 4x4 POWER CURTAIN (starting / stopping)
        // ---------------------------------------------------------
        if (revealRatio < 1.0) {
            this._drawPowerCurtain(ctx, w, h, horizon, revealRatio);
        }
    }
}