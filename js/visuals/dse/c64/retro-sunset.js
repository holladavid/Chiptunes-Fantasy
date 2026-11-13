// === js/visuals/dse/c64/retro-sunset.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: C64 RETRO SUNSET
// Authentic 16-color VIC-II Colodore background aesthetics:
// Ordered-dither sky band transitions, inner-edge sun dither,
// climax sun slits, 1px horizon heat-haze, deterministic $D016
// parallax water shimmer & 3-voice SID channel reactivity.
// =========================================================

import { C64_PALETTE, rgbToHex } from '../../utils/hardware-constraints.js';

const TWO_PI = Math.PI * 2;
const TRANSITION_DURATION = 1.15;

// 4x4 Bayer threshold matrix (0..15)
const BAYER_4X4 = Object.freeze([
    0, 8, 2, 10,
    12, 4, 14, 6,
    3, 11, 1, 9,
    15, 7, 13, 5
]);

// Exact 16-color VIC-II Colodore hex cache
const C64_HEX = Object.freeze(
    C64_PALETTE.map(([r, g, b]) => rgbToHex(r, g, b))
);

// Fixed 32-bit deterministic water ripple bitmask ($D016 sprite stripe feel)
const WATER_PATTERN = Object.freeze([
    1, 0, 1, 1, 0, 0, 1, 0,
    1, 0, 0, 0, 1, 1, 1, 0,
    0, 1, 0, 0, 1, 0, 1, 1,
    0, 1, 0, 0, 0, 0, 1, 0
]);

function clamp01(v) {
    if (!Number.isFinite(v)) return 0;
    return v < 0 ? 0 : (v > 1 ? 1 : v);
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

export class C64RetroSunset {
    constructor() {
        this.name = 'C64 Retro Sunset';

        // Time & state tracking (100% time-based, zero frame counters)
        this.lastT = null;
        this.lastState = 'idle';
        this.stateAge = 0;

        // Continuous simulation state (preserved across resize/rotation)
        this.internalT = 0;
        this.waterT = 0;
        this.starCycle = 0;
        this.smoothedSpeed = 1.0;
        this.smoothedWaveSpeed = 1.0;
        this.afterglowMix = 0.0;

        // Discrete beat-driven state
        this.lastBeatCount = 0;
        this.beatParity = 0;
        this.skyAccentPhase = 0;
        this.waterWaveAge = 10.0;
        this.waterWavePeak = 0.0;

        // Instance-owned deterministic Xorshift32 PRNG (zero Math.random!)
        this.prngState = 0x43363453; // 'C64S'

        // Deterministic per-row water offsets for zero-moire $D016 scrolling
        this.waterOffsets = new Uint16Array(256);
        for (let i = 0; i < this.waterOffsets.length; i++) {
            this.waterOffsets[i] = Math.floor(this._nextRandom() * 256);
        }
    }

    _nextRandom() {
        let x = this.prngState | 0;
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        this.prngState = x;
        return (x >>> 0) / 4294967296;
    }

    resize() {
        // Geometry derives dynamically from width/height;
        // waterOffsets and time phases persist cleanly across rotations.
    }

    _drawBandDitherSeam(ctx, y, w, upperHex, lowerHex, maxY) {
        if (y < 0 || y + 2 > maxY || w <= 0) return;
        ctx.fillStyle = lowerHex;
        for (let x = 0; x < w; x += 8) {
            const bw = Math.min(4, w - x);
            if (bw > 0) ctx.fillRect(x, y, bw, 1);
            const x2 = x + 4;
            if (x2 < w) {
                const bw2 = Math.min(4, w - x2);
                if (bw2 > 0) ctx.fillRect(x2, y + 1, bw2, 1);
            }
        }
        ctx.fillStyle = upperHex;
        for (let x = 4; x < w; x += 8) {
            const bw = Math.min(4, w - x);
            if (bw > 0) ctx.fillRect(x, y, bw, 1);
        }
    }

    _drawPowerCurtain(ctx, w, h, horizon, revealRatio) {
        const skyActiveTop = Math.min(horizon, Math.max(0, Math.ceil(horizon * (1.0 - revealRatio))));
        const floorHeight = Math.max(1, h - horizon);
        const floorActiveBottom = Math.min(
            h,
            Math.max(horizon, horizon + Math.floor(floorHeight * revealRatio))
        );

        ctx.fillStyle = C64_HEX[0];
        if (skyActiveTop > 0) {
            ctx.fillRect(0, 0, w, skyActiveTop);
        }
        if (floorActiveBottom < h) {
            ctx.fillRect(0, floorActiveBottom, w, h - floorActiveBottom);
        }

        const bandPx = Math.max(4, Math.min(16, Math.floor(h * 0.08)));
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
        // Defensive metric parsing (3 physical C64 SID voices)
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
        const sidBass = readChannel(smooth, 0, energy);
        const sidMid = readChannel(smooth, 1, energy * 0.85);
        const sidHigh = readChannel(smooth, 2, energy * 0.7);

        // ---------------------------------------------------------
        // Discrete Beat Events (strictly gated on beatStarted)
        // ---------------------------------------------------------
        const allowDiscreteSwitches = state !== 'afterglow' && state !== 'stopping';
        if (beatStarted) {
            const incomingCount = Number.isFinite(safeMetrics.beatCount)
                ? Math.floor(safeMetrics.beatCount)
                : (this.lastBeatCount + 1);

            if (incomingCount !== this.lastBeatCount || !Number.isFinite(safeMetrics.beatCount)) {
                this.lastBeatCount = incomingCount;
                this.beatParity = incomingCount & 1;

                // Launch specular sparkle wave down the water cone
                this.waterWaveAge = 0;
                const levelWeight = beatLevel >= 3 ? 1.0 : (beatLevel === 2 ? 0.65 : (beatLevel === 1 ? 0.35 : 0.0));
                this.waterWavePeak = Math.max(beatStrength, levelWeight);

                if (allowDiscreteSwitches && incomingCount > 0 && incomingCount % 4 === 0) {
                    this.skyAccentPhase = (this.skyAccentPhase + 1) & 1;
                }
            }
        }

        this.waterWaveAge = Math.min(10.0, this.waterWaveAge + dt);

        // ---------------------------------------------------------
        // Macro State Dynamics & Tension Mapping
        // ---------------------------------------------------------
        let targetSpeed = 1.0 + tension * 0.35;
        let targetWaveSpeed = 1.0 + tension * 0.8;
        let targetAfterglow = 0.0;

        if (state === 'starting') {
            targetSpeed = 0.85;
            targetWaveSpeed = 0.9;
        } else if (state === 'playing') {
            targetSpeed = 0.95 + tension * 0.35;
            targetWaveSpeed = 1.0 + tension * 0.7;
        } else if (state === 'buildup') {
            targetSpeed = 1.35 + tension * 0.45;
            targetWaveSpeed = 2.0 + tension * 1.6;
        } else if (state === 'climax') {
            targetSpeed = 2.1 + tension * 0.55 + (isClimaxLocked ? 0.2 : 0);
            targetWaveSpeed = 5.0 + tension * 2.2;
        } else if (state === 'afterglow') {
            // Preserve phases; slow cleanly down to dusk
            targetSpeed = 0.32;
            targetWaveSpeed = 0.38;
            targetAfterglow = 1.0;
        } else if (state === 'stopping') {
            targetSpeed = 0.40;
            targetWaveSpeed = 0.45;
        }

        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * Math.min(1.0, dt * 3.0);
        this.smoothedWaveSpeed += (targetWaveSpeed - this.smoothedWaveSpeed) * Math.min(1.0, dt * 3.0);
        this.afterglowMix += (targetAfterglow - this.afterglowMix) * Math.min(1.0, dt * 2.0);
        const ag = this.afterglowMix;

        this.internalT = (this.internalT + dt * this.smoothedSpeed) % 4096;
        const activeWaveSpeed = this.smoothedWaveSpeed + beatImpulse * (state === 'afterglow' ? 0.8 : 7.5);
        this.waterT = (this.waterT + dt * activeWaveSpeed) % 4096;
        this.starCycle = (this.starCycle + dt * (0.31 + 0.14 * sidHigh) * (1.0 - 0.45 * ag)) % TWO_PI;

        // ---------------------------------------------------------
        // Bayer 4x4 Transition Visibility (starting / stopping)
        // ---------------------------------------------------------
        let revealRatio = 1.0;
        if (state === 'starting') {
            revealRatio = clamp01((this.stateAge + 0.08) / TRANSITION_DURATION);
        } else if (state === 'stopping') {
            revealRatio = 1.0 - clamp01(this.stateAge / TRANSITION_DURATION);
            if (revealRatio <= 0.001) {
                ctx.fillStyle = C64_HEX[0];
                ctx.fillRect(0, 0, w, h);
                return;
            }
        }

        // ---------------------------------------------------------
        // Responsive Geometry (C64 200px height, Portrait -> Ultrawide)
        // ---------------------------------------------------------
        const horizon = Math.min(h - 1, Math.max(1, Math.floor(h * 0.55)));
        const floorHeight = Math.max(1, h - horizon);
        const minDim = Math.min(w, h);
        const cx = Math.floor(w * 0.5);

        // ---------------------------------------------------------
        // 1. THE SKY (Clean VIC-II Bands + Subtle Ordered Dither Seams)
        // ---------------------------------------------------------
        // SID Mid shifts the warm orange/light-red boundary slightly upward
        const warmLift = (sidMid * 0.05 + beatImpulse * 0.03) * (1.0 - ag);
        const y1 = Math.max(1, Math.floor(horizon * (0.26 - warmLift * 0.3)));
        const y2 = Math.max(y1, Math.floor(horizon * (0.52 - warmLift * 0.6)));
        const y3 = Math.max(y2, Math.floor(horizon * (0.76 - warmLift * 0.4)));
        const y4 = Math.max(y3, Math.floor(horizon * 0.90));

        // Time-based subtle VIC-II band breathing (no frame counters)
        const breathWindow = (this.internalT % 3.6) < 0.12 && ag < 0.4;
        const duskPhase = ag > 0.55;
        const deepTransition = ag > 0.25 && ag <= 0.55;

        let cSky1 = duskPhase ? C64_HEX[0] : (breathWindow ? C64_HEX[14] : C64_HEX[6]);
        let cSky2 = duskPhase ? C64_HEX[6] : (deepTransition ? C64_HEX[6] : C64_HEX[2]);
        let cSky3 = duskPhase ? C64_HEX[14] : (deepTransition ? C64_HEX[4] : C64_HEX[10]);
        let cSky4 = duskPhase ? C64_HEX[4] : (this.skyAccentPhase === 1 && tension > 0.5 ? C64_HEX[8] : C64_HEX[10]);
        let cSky5 = duskPhase ? C64_HEX[2] : (state === 'climax' || tension > 0.4 ? C64_HEX[8] : C64_HEX[7]);
        if (!duskPhase && y4 < horizon) {
            cSky5 = C64_HEX[7];
        }

        ctx.fillStyle = cSky1; ctx.fillRect(0, 0, w, y1);
        if (y2 > y1) { ctx.fillStyle = cSky2; ctx.fillRect(0, y1, w, y2 - y1); }
        if (y3 > y2) { ctx.fillStyle = cSky3; ctx.fillRect(0, y2, w, y3 - y2); }
        if (y4 > y3) { ctx.fillStyle = cSky4; ctx.fillRect(0, y3, w, y4 - y3); }
        if (horizon > y4) { ctx.fillStyle = cSky5; ctx.fillRect(0, y4, w, horizon - y4); }

        // Crisp 2px C64 checkerboard dither seams between sky bands
        this._drawBandDitherSeam(ctx, y1 - 1, w, cSky1, cSky2, horizon - 1);
        this._drawBandDitherSeam(ctx, y2 - 1, w, cSky2, cSky3, horizon - 1);
        this._drawBandDitherSeam(ctx, y3 - 1, w, cSky3, cSky4, horizon - 1);
        this._drawBandDitherSeam(ctx, y4 - 1, w, cSky4, cSky5, horizon - 1);

        // Subtle single evening star high in the upper dark sky (SID High twinkle)
        if (this.starCycle < 1.1 && y1 >= 6) {
            const starBright = Math.sin((this.starCycle / 1.1) * Math.PI) * (0.7 + 0.3 * sidHigh);
            const sxStar = Math.floor(w * 0.80);
            const syStar = Math.max(2, Math.floor(y1 * 0.48));
            ctx.fillStyle = starBright > 0.65 ? C64_HEX[1] : (starBright > 0.35 ? C64_HEX[3] : C64_HEX[14]);
            fillClippedRect(ctx, sxStar, syStar, 2, 2, w, h, 0, horizon - 1);
            if (starBright > 0.65) {
                fillClippedRect(ctx, sxStar - 1, syStar, 4, 1, w, h, 0, horizon - 1);
            }
        }

        // ---------------------------------------------------------
        // 2. THE BLOCK SUN (Inner-Edge Dither & Climax Sun-Slits)
        // ---------------------------------------------------------
        const sunBlockSize = minDim < 64 ? 2 : 4;
        const sunPulse = (0.65 * beatImpulse + 0.35 * sidBass) * (1.0 - 0.65 * ag);
        const sunR = Math.max(sunBlockSize, Math.floor(minDim * (0.16 + 0.025 * sunPulse)));
        const blockR = Math.max(1, Math.floor(sunR / sunBlockSize));
        const rasterSunR = blockR * sunBlockSize;
        const sy = Math.floor(horizon + rasterSunR * 0.375);

        const edgeShift = Math.floor(this.internalT * 6.0) & 1;
        const slitsActive = state === 'climax' && ag < 0.3 && (beatImpulse > 0.25 || isClimaxLocked);

        const cSunCore = duskPhase ? C64_HEX[15] : C64_HEX[1];
        const cSunEdge = duskPhase ? C64_HEX[14] : C64_HEX[7];

        for (let by = -blockR; by <= 0; by++) {
            const drawY = sy + by * sunBlockSize;
            if (drawY >= horizon - 1 || drawY + sunBlockSize <= 0) continue;

            const dx = Math.round(Math.sqrt(Math.max(0, blockR * blockR - by * by)));
            if (dx <= 0) continue;

            const startX = cx - dx * sunBlockSize;
            const endX = cx + dx * sunBlockSize;
            const spanW = endX - startX;

            // Leave 1px sky slit in lower solar rows during climax
            const hasSlit = slitsActive && by >= -Math.floor(blockR * 0.45) && (((Math.abs(by) + this.beatParity) & 1) === 1);
            const drawBlockH = hasSlit && sunBlockSize >= 3 ? sunBlockSize - 1 : sunBlockSize;

            ctx.fillStyle = cSunCore;
            fillClippedRect(ctx, startX, drawY, spanW, drawBlockH, w, h, 0, horizon - 1);

            // Inner-Edge Dithering: yellow/white edge flicker synced to time & SID Mid
            const isEdgeBlock = ((Math.abs(by) + edgeShift) & 1) === 0;
            if (isEdgeBlock || sidMid > 0.72) {
                ctx.fillStyle = cSunEdge;
                fillClippedRect(ctx, startX, drawY, sunBlockSize, drawBlockH, w, h, 0, horizon - 1);
                fillClippedRect(ctx, endX - sunBlockSize, drawY, sunBlockSize, drawBlockH, w, h, 0, horizon - 1);
            }
        }

        // ---------------------------------------------------------
        // 3. HORIZON HEAT HAZE (1px time-based shimmer at horizon - 1)
        // ---------------------------------------------------------
        const hazeTick = Math.floor(this.internalT * (8.0 + 4.0 * sidHigh) + this.beatParity) & 1;
        if (duskPhase) {
            ctx.fillStyle = hazeTick === 0 ? C64_HEX[14] : C64_HEX[4];
        } else {
            ctx.fillStyle = (hazeTick === 0 || beatImpulse > 0.6) ? C64_HEX[1] : C64_HEX[7];
        }
        fillClippedRect(ctx, 0, horizon - 1, w, 1, w, h, 0, horizon);

        // ---------------------------------------------------------
        // 4. DETERMINISTIC $D016 PARALLAX WATER & CONE REFLECTION
        // ---------------------------------------------------------
        ctx.fillStyle = duskPhase ? C64_HEX[0] : C64_HEX[6];
        ctx.fillRect(0, horizon, w, floorHeight);

        const blockW = minDim < 64 ? 4 : 8;
        const patternLen = WATER_PATTERN.length;
        const coneBeatExpand = beatImpulse * (minDim * 0.08) * (1.0 - 0.6 * ag);
        const coneSidBase = sidBass * (minDim * 0.04);
        const whiteDepth = (8 + beatImpulse * 16 + sidHigh * 6) * (1.0 - 0.55 * ag);

        const waveActive = this.waterWaveAge < 0.75 && this.waterWavePeak > 0.01;
        const waveY = (this.waterWaveAge / 0.75) * floorHeight;

        const waterBandColor = duskPhase ? C64_HEX[6] : C64_HEX[14];
        const reflPrimary = duskPhase ? C64_HEX[14] : C64_HEX[7];
        const reflSecondary = duskPhase ? C64_HEX[4] : C64_HEX[10];
        const reflCore = duskPhase ? C64_HEX[15] : C64_HEX[1];

        for (let y = horizon; y < h; y += 4) {
            const stripH = Math.min(2, h - y);
            if (stripH <= 0) break;

            const dy = y - horizon;
            const rowIdx = Math.floor(dy / 4);
            const initOffset = this.waterOffsets[rowIdx & 255];
            const pixelOffset = Math.floor(initOffset + this.waterT * (12 + dy * 0.35));
            const shift = ((pixelOffset % blockW) + blockW) % blockW;

            const coneW = Math.max(4, Math.floor((minDim * 0.08) + dy * 1.15 + coneSidBase + coneBeatExpand));
            const onWaveRow = waveActive && Math.abs(dy - waveY) < 6;

            for (let px = -shift; px < w; px += blockW) {
                const i = Math.floor((px + pixelOffset) / blockW);
                const bitIdx = ((i % patternLen) + patternLen) % patternLen;
                if (WATER_PATTERN[bitIdx] !== 1) continue;

                const segCenter = px + blockW * 0.5;
                const distToCenter = Math.abs(segCenter - cx);

                if (distToCenter < coneW) {
                    if ((dy < whiteDepth && (bitIdx % 3 === 0)) || (onWaveRow && distToCenter < coneW * 0.85)) {
                        ctx.fillStyle = reflCore;
                    } else if (pulse > 0.45 && distToCenter < coneW * 0.35 && (bitIdx & 1) === 0) {
                        ctx.fillStyle = reflCore;
                    } else {
                        ctx.fillStyle = ((dy % 8) < 4) ? reflPrimary : reflSecondary;
                    }
                } else {
                    ctx.fillStyle = waterBandColor;
                }

                fillClippedRect(ctx, px, y, blockW, stripH, w, h, horizon, h);
            }
        }

        // ---------------------------------------------------------
        // 5. BAYER 4x4 POWER CURTAIN (starting / stopping)
        // ---------------------------------------------------------
        if (revealRatio < 1.0) {
            this._drawPowerCurtain(ctx, w, h, horizon, revealRatio);
        }
    }
}