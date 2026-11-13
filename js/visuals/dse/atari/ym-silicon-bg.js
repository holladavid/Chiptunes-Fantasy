// === js/visuals/dse/atari/ym-silicon-bg.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: YM2149F MICROVERSE (BACKGROUND)
// DOM-free 9-bit Atari ST rendering via pure fillRect:
// Dual adaptive layout (Landscape columns / Portrait rows),
// Log-DAC perspective staircase, 3 live Square-Wave & VU cores,
// deterministic LFSR noise rain & Timer-B Sync-Buzzer tears.
// =========================================================

import { quantizeAtari9Bit, rgbToHex } from '../../utils/hardware-constraints.js';

const TRANSITION_DURATION = 1.15;

// 4x4 Bayer threshold matrix (0..15)
const BAYER_4X4 = Object.freeze([
    0, 8, 2, 10,
    12, 4, 14, 6,
    3, 11, 1, 9,
    15, 7, 13, 5
]);

function quantHex(r, g, b) {
    const [qr, qg, qb] = quantizeAtari9Bit(r, g, b);
    return rgbToHex(qr, qg, qb);
}

// Strict Atari ST 9-bit Neon Cyberpunk Palette + Cool Afterglow Slate
const PAL = Object.freeze([
    quantHex(0, 0, 0),       // 0: Black
    quantHex(252, 252, 252), // 1: White
    quantHex(0, 252, 0),     // 2: Neon Green
    quantHex(0, 108, 0),     // 3: Dark Green
    quantHex(252, 0, 252),   // 4: Magenta
    quantHex(108, 0, 108),   // 5: Dark Magenta
    quantHex(0, 252, 252),   // 6: Cyan
    quantHex(0, 108, 108),   // 7: Dark Cyan
    quantHex(0, 72, 72),     // 8: Deep Slate Teal (Afterglow)
    quantHex(72, 144, 144),  // 9: Cool Silver Teal (Afterglow)
    quantHex(36, 72, 108)    // 10: Midnight Steel (Afterglow)
]);

function clamp01(v) {
    if (!Number.isFinite(v)) return 0;
    return v < 0 ? 0 : (v > 1 ? 1 : v);
}

function readChannel(arr, idx, fallback) {
    if (!arr || idx >= arr.length) return fallback;
    return clamp01(arr[idx]);
}

function fillClippedRect(ctx, x, y, rw, rh, bufW, bufH, minX = 0, minY = 0, maxX = bufW, maxY = bufH) {
    let x0 = Math.floor(x);
    let y0 = Math.floor(y);
    let x1 = Math.floor(x + rw);
    let y1 = Math.floor(y + rh);
    if (x0 < minX) x0 = minX;
    if (y0 < minY) y0 = minY;
    if (x1 > maxX) x1 = maxX;
    if (y1 > maxY) y1 = maxY;
    const cw = x1 - x0;
    const ch = y1 - y0;
    if (cw > 0 && ch > 0) {
        ctx.fillRect(x0, y0, cw, ch);
    }
}

export class YmSiliconBg {
    constructor() {
        this.name = 'YM2149F Microverse';

        // Time & state tracking
        this.lastT = null;
        this.lastState = 'idle';
        this.stateAge = 0;

        // Continuous simulation state (preserved across resize/rotation)
        this.internalT = 0;
        this.smoothedSpeed = 1.0;
        this.afterglowMix = 0.0;

        // Discrete beat-driven state
        this.lastBeatCount = 0;
        this.beatParity = 0;
        this.themePhase = 0;
        this.dacWaveAge = 10.0;
        this.dacWavePeak = 0.0;
        this.tearBurstAge = 10.0;

        // Instance-owned deterministic Xorshift32 PRNG (zero Math.random!)
        this.prngState = 0x594D3231; // 'YM21'

        // Preallocated Timer-B Sync-Buzzer scanline tear slots
        this.tearSlots = Array.from({ length: 5 }, () => ({
            yFrac: 0.2,
            hFrac: 0.05,
            dir: 1
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

    resize() {
        // Adaptive layout derives dynamically from width/height;
        // internalT and beat phases remain continuous.
    }

    _drawSquareWave(ctx, boxX, boxY, boxW, boxH, vol, time, tearShift, bufW, bufH, isCool, beatImpulse) {
        if (boxW < 4 || boxH < 4) return;
        const midY = Math.floor(boxY + boxH * 0.5);
        const amp = Math.floor(clamp01(vol) * (boxH * 0.78));

        if (amp < 2) {
            ctx.fillStyle = isCool ? PAL[8] : PAL[3];
            fillClippedRect(ctx, boxX + 1, midY, Math.max(1, boxW - 2), 1, bufW, bufH, boxX, boxY, boxX + boxW, boxY + boxH);
            return;
        }

        const period = Math.max(4, Math.floor(20 - clamp01(vol) * 11));
        const halfPeriod = Math.max(2, period >> 1);
        const offset = Math.floor(time * 48) % period;
        const halfAmp = Math.max(1, amp >> 1);
        const topY = Math.max(boxY + 1, midY - halfAmp);
        const botY = Math.min(boxY + boxH - 2, midY + halfAmp);
        const edgeH = Math.max(2, botY - topY + 1);

        if (isCool) {
            ctx.fillStyle = PAL[9];
        } else if (vol > 0.65 || beatImpulse > 0.65) {
            ctx.fillStyle = PAL[1];
        } else {
            ctx.fillStyle = PAL[2];
        }

        // Draw span-merged square-wave runs (fast & strictly clipped to core interior)
        let runStart = 0;
        let runHigh = ((offset) % period) < halfPeriod;
        const innerW = Math.max(1, boxW - 2);
        const baseX = boxX + 1;

        for (let x = 1; x <= innerW; x++) {
            const localHigh = x < innerW ? (((x + offset) % period) < halfPeriod) : !runHigh;
            if (localHigh !== runHigh) {
                const segY = runHigh ? topY : botY;
                const sx = baseX + runStart + tearShift;
                const sw = x - runStart;
                fillClippedRect(ctx, sx, segY, sw, 2, bufW, bufH, boxX, boxY, boxX + boxW, boxY + boxH);

                if (x < innerW) {
                    fillClippedRect(ctx, baseX + x + tearShift, topY, 2, edgeH, bufW, bufH, boxX, boxY, boxX + boxW, boxY + boxH);
                }
                runStart = x;
                runHigh = localHigh;
            }
        }
    }

    _drawPowerCurtain(ctx, w, h, revealRatio) {
        const halfH = Math.floor(h * 0.5);
        const activeTop = Math.min(halfH, Math.max(0, Math.ceil(halfH * (1.0 - revealRatio))));
        const activeBottom = Math.min(h, Math.max(halfH, h - activeTop));

        ctx.fillStyle = PAL[0];
        if (activeTop > 0) ctx.fillRect(0, 0, w, activeTop);
        if (activeBottom < h) ctx.fillRect(0, activeBottom, w, h - activeBottom);

        const bandPx = Math.max(4, Math.min(16, Math.floor(h * 0.08)));
        const stepX = Math.max(2, Math.min(4, Math.floor(w * 0.02)));
        const stepY = 2;

        const topEnd = Math.min(halfH, activeTop + bandPx);
        for (let y = activeTop; y < topEnd; y += stepY) {
            const vis = (y - activeTop + 1) / bandPx;
            const bayerRow = ((y >> 1) & 3) * 4;
            for (let x = 0; x < w; x += stepX) {
                if (BAYER_4X4[bayerRow + ((x >> 2) & 3)] >= vis * 16) {
                    const bw = Math.min(stepX, w - x);
                    const bh = Math.min(stepY, topEnd - y);
                    if (bw > 0 && bh > 0) ctx.fillRect(x, y, bw, bh);
                }
            }
        }

        const botStart = Math.max(halfH, activeBottom - bandPx);
        for (let y = botStart; y < activeBottom; y += stepY) {
            const vis = (activeBottom - y) / bandPx;
            const bayerRow = ((y >> 1) & 3) * 4;
            for (let x = 0; x < w; x += stepX) {
                if (BAYER_4X4[bayerRow + ((x >> 2) & 3)] >= vis * 16) {
                    const bw = Math.min(stepX, w - x);
                    const bh = Math.min(stepY, activeBottom - y);
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
        if (!Number.isFinite(dt) || dt < 0) dt = 0.02;
        else if (dt > 0.1) dt = 0.1;

        if (this.lastState !== state) {
            this.lastState = state;
            this.stateAge = 0;
        } else {
            this.stateAge += dt;
        }

        // ---------------------------------------------------------
        // Defensive metric parsing (3 Atari YM2149F channels)
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
        const vols = [
            readChannel(smooth, 0, energy),
            readChannel(smooth, 1, energy * 0.9),
            readChannel(smooth, 2, energy * 0.8)
        ];

        // ---------------------------------------------------------
        // Discrete Beat Events (strictly gated on beatStarted)
        // ---------------------------------------------------------
        const allowDiscrete = state !== 'afterglow' && state !== 'stopping';
        if (beatStarted) {
            const incomingCount = Number.isFinite(safeMetrics.beatCount)
                ? Math.floor(safeMetrics.beatCount)
                : (this.lastBeatCount + 1);

            if (incomingCount !== this.lastBeatCount || !Number.isFinite(safeMetrics.beatCount)) {
                this.lastBeatCount = incomingCount;
                this.beatParity = incomingCount & 1;

                this.dacWaveAge = 0;
                const levelWeight = beatLevel >= 3 ? 1.0 : (beatLevel === 2 ? 0.65 : (beatLevel === 1 ? 0.35 : 0.0));
                this.dacWavePeak = Math.max(beatStrength, levelWeight);

                // Trigger deterministic Timer-B Sync-Buzzer scanline tear slots in climax/buildup
                if ((state === 'climax' || (state === 'buildup' && tension > 0.55)) && beatLevel >= 2) {
                    this.tearBurstAge = 0;
                    for (let s = 0; s < this.tearSlots.length; s++) {
                        this.tearSlots[s].yFrac = this._nextRandom() * 0.88;
                        this.tearSlots[s].hFrac = 0.02 + this._nextRandom() * 0.06;
                        this.tearSlots[s].dir = this._nextRandom() > 0.5 ? 1 : -1;
                    }
                }

                if (allowDiscrete && incomingCount > 0 && incomingCount % 4 === 0) {
                    this.themePhase = (this.themePhase + 1) % 3;
                }
            }
        }

        this.dacWaveAge = Math.min(10.0, this.dacWaveAge + dt);
        this.tearBurstAge = Math.min(10.0, this.tearBurstAge + dt);

        // ---------------------------------------------------------
        // Macro State Dynamics & Tension Mapping
        // ---------------------------------------------------------
        let targetSpeed = 1.0 + tension * 0.35;
        let targetAfterglow = 0.0;

        if (state === 'starting') {
            targetSpeed = 0.85;
        } else if (state === 'playing') {
            targetSpeed = 0.95 + tension * 0.35;
        } else if (state === 'buildup') {
            targetSpeed = 1.45 + tension * 0.55;
        } else if (state === 'climax') {
            targetSpeed = 2.30 + tension * 0.70 + (isClimaxLocked ? 0.25 : 0);
        } else if (state === 'afterglow') {
            targetSpeed = 0.30;
            targetAfterglow = 1.0;
        } else if (state === 'stopping') {
            targetSpeed = 0.40;
        }

        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * Math.min(1.0, dt * 4.0);
        this.afterglowMix += (targetAfterglow - this.afterglowMix) * Math.min(1.0, dt * 2.0);
        const ag = this.afterglowMix;
        const isCool = ag > 0.5;

        const busKick = 1.0 + beatImpulse * (isCool ? 0.12 : 0.40);
        this.internalT = (this.internalT + dt * this.smoothedSpeed * busKick) % 4096;
        const time = this.internalT;

        // ---------------------------------------------------------
        // Transition Progress (starting / stopping)
        // ---------------------------------------------------------
        let revealRatio = 1.0;
        if (state === 'starting') {
            revealRatio = clamp01((this.stateAge + 0.08) / TRANSITION_DURATION);
        } else if (state === 'stopping') {
            revealRatio = 1.0 - clamp01(this.stateAge / TRANSITION_DURATION);
            if (revealRatio <= 0.001) {
                ctx.fillStyle = PAL[0];
                ctx.fillRect(0, 0, w, h);
                return;
            }
        }

        // ---------------------------------------------------------
        // 1. LOG-DAC PERSPECTIVE STAIRCASE & COPPER SHOCKWAVE
        // ---------------------------------------------------------
        ctx.fillStyle = PAL[0];
        ctx.fillRect(0, 0, w, h);

        const cy = Math.floor(h * 0.5);
        const halfH = Math.max(1, cy);
        const scrollStep = Math.max(6, Math.floor(h * 0.10));
        const scrollY = (time * 15) % scrollStep;

        const dacWaveActive = this.dacWaveAge < 0.75 && this.dacWavePeak > 0.01;
        const dacWaveNorm = this.dacWaveAge / 0.75;

        let baseDacCol = PAL[3];
        if (isCool) {
            baseDacCol = PAL[8];
        } else if (this.themePhase === 1 || tension > 0.5) {
            baseDacCol = PAL[7];
        } else if (this.themePhase === 2 && state === 'climax') {
            baseDacCol = PAL[5];
        }

        const tearActive = !isCool && this.tearBurstAge < 0.12 && (state === 'climax' || tension > 0.55);
        const maxTearShift = Math.max(2, Math.floor(w * 0.04 * (0.4 + 0.6 * beatImpulse)));

        for (let i = 0; i < 10; i++) {
            const yDist = Math.floor(Math.pow(1.32, i) * Math.max(2, h * 0.025));
            const yTop = Math.floor(cy - yDist - scrollY);
            const yBot = Math.floor(cy + yDist + scrollY);

            const lineNorm = Math.min(1.0, (yDist + scrollY) / halfH);
            const isWaveHit = dacWaveActive && Math.abs(lineNorm - dacWaveNorm) < 0.14;

            ctx.fillStyle = isWaveHit && !isCool
                ? (this.dacWavePeak >= 0.66 ? PAL[6] : PAL[2])
                : baseDacCol;

            if (yTop >= 0 && yTop < h) ctx.fillRect(0, yTop, w, 1);
            if (yBot >= 0 && yBot < h) ctx.fillRect(0, yBot, w, 1);
        }

        // Center YM reference bus line
        ctx.fillStyle = isCool ? PAL[10] : (beatImpulse > 0.5 || (state === 'climax' && isClimaxLocked) ? PAL[6] : PAL[7]);
        ctx.fillRect(0, cy, w, 1);

        // ---------------------------------------------------------
        // 2. ADAPTIVE 3-CHANNEL YM2149F SQUARE-TONE CORES
        // ---------------------------------------------------------
        const isLandscape = w >= h * 1.1;
        const borderCol = isCool ? PAL[8] : (beatImpulse > 0.65 ? PAL[6] : PAL[3]);
        const gridCol = isCool ? PAL[10] : PAL[3];

        for (let i = 0; i < 3; i++) {
            const vol = vols[i];
            let boxX;
            let boxY;
            let boxW;
            let boxH;

            if (isLandscape) {
                const padX = Math.max(4, Math.floor(w * 0.06));
                const availW = Math.max(18, w - padX * 2);
                const gapX = Math.max(4, Math.floor(availW * 0.08));
                boxW = Math.max(10, Math.floor((availW - gapX * 2) / 3));
                boxH = Math.max(16, Math.floor(h * 0.58));
                const totalUsed = boxW * 3 + gapX * 2;
                const startX = Math.floor((w - totalUsed) * 0.5);
                boxX = startX + i * (boxW + gapX);
                boxY = Math.floor((h - boxH) * 0.5);
            } else {
                const padX = Math.max(4, Math.floor(w * 0.10));
                const padY = Math.max(4, Math.floor(h * 0.08));
                const availH = Math.max(24, h - padY * 2);
                const gapY = Math.max(4, Math.floor(availH * 0.08));
                boxW = Math.max(14, w - padX * 2);
                boxH = Math.max(10, Math.floor((availH - gapY * 2) / 3));
                const totalUsedH = boxH * 3 + gapY * 2;
                boxX = padX;
                boxY = Math.floor((h - totalUsedH) * 0.5) + i * (boxH + gapY);
            }

            // Timer-B Sync-Buzzer horizontal jitter on active tear slots
            let tearShift = 0;
            if (tearActive) {
                const slot = this.tearSlots[i % this.tearSlots.length];
                const coreCenterFrac = (boxY + boxH * 0.5) / h;
                if (Math.abs(coreCenterFrac - slot.yFrac) < 0.25) {
                    tearShift = slot.dir * Math.max(1, maxTearShift >> 1);
                }
            }

            const drawX = Math.min(w - boxW, Math.max(0, boxX + tearShift));

            // Frame & Dark Interior
            ctx.fillStyle = borderCol;
            fillClippedRect(ctx, drawX - 2, boxY - 2, boxW + 4, boxH + 4, w, h);
            ctx.fillStyle = PAL[0];
            fillClippedRect(ctx, drawX, boxY, boxW, boxH, w, h);

            // Internal oscilloscope gridlines
            ctx.fillStyle = gridCol;
            const gridStep = Math.max(4, Math.floor(boxH / 8));
            for (let gy = boxY + gridStep; gy < boxY + boxH; gy += gridStep) {
                fillClippedRect(ctx, drawX, gy, boxW, 1, w, h);
            }

            // Live Square-Wave Oscillator Trace
            this._drawSquareWave(ctx, drawX, boxY, boxW, boxH, vol, time + i * 0.7, tearShift, w, h, isCool, beatImpulse);

            // 4-bit Log-DAC VU Bar Indicator above/beside each core
            if (boxY >= 6) {
                const vuMaxW = Math.max(4, Math.min(boxW, Math.floor(boxW * 0.75)));
                const vuW = Math.max(1, Math.floor(vuMaxW * clamp01(0.10 + vol * 0.75 + beatImpulse * 0.15)));
                const vuX = Math.floor(drawX + (boxW - vuMaxW) * 0.5);
                const vuY = Math.max(1, boxY - 6);
                ctx.fillStyle = isCool
                    ? PAL[9]
                    : ((vol > 0.70 || beatImpulse > 0.65) ? PAL[1] : (this.themePhase === 1 ? PAL[6] : PAL[2]));
                fillClippedRect(ctx, vuX, vuY, vuW, Math.min(3, boxY - vuY - 1), w, h);
            }
        }

        // ---------------------------------------------------------
        // 3. DETERMINISTIC LFSR NOISE RAIN (Zero Math.random)
        // ---------------------------------------------------------
        const noiseVol = (vols[0] + vols[1] + vols[2]) / 3.0;
        if (noiseVol > 0.08 || tension > 0.2) {
            const rainIntensity = (noiseVol * 0.35 + tension * 0.45 + beatImpulse * 0.20) * (1.0 - 0.55 * ag);
            const dropCount = Math.min(48, Math.floor(rainIntensity * 44));
            ctx.fillStyle = isCool ? PAL[10] : (pulse > 0.5 ? PAL[6] : PAL[4]);

            for (let i = 0; i < dropCount; i++) {
                const xFrac = ((i * 0.61803398875) % 1.0);
                const rx = Math.floor(xFrac * Math.max(1, w - 2));
                const fallSpeed = 55 + (i % 5) * 16;
                const ry = Math.floor((i * 19 + time * fallSpeed) % h);
                const len = 2 + (i % 4);
                fillClippedRect(ctx, rx, ry, 2, len, w, h);
            }
        }

        // ---------------------------------------------------------
        // 4. TIMER-B SYNC-BUZZER RASTER BARS (Zero getImageData)
        // ---------------------------------------------------------
        if (tearActive) {
            for (let s = 0; s < this.tearSlots.length; s++) {
                const slot = this.tearSlots[s];
                const ty = Math.floor(slot.yFrac * h);
                const th = Math.max(1, Math.floor(slot.hFrac * h * 0.4));
                const tx = slot.dir > 0 ? 0 : Math.floor(w * 0.15);
                const tw = Math.floor(w * 0.85);
                ctx.fillStyle = (s & 1) === 0 ? PAL[4] : PAL[6];
                fillClippedRect(ctx, tx, ty, tw, Math.min(2, th), w, h);
            }
        }

        // ---------------------------------------------------------
        // 5. BAYER 4x4 POWER CURTAIN (starting / stopping)
        // ---------------------------------------------------------
        if (revealRatio < 1.0) {
            this._drawPowerCurtain(ctx, w, h, revealRatio);
        }
    }
}