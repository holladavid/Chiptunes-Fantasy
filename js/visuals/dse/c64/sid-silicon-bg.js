// === js/visuals/dse/c64/sid-silicon-bg.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: SID 6581 MICROVERSE (BACKGROUND)
// DOM-free 16-color VIC-II Colodore schematic rendering:
// Dual adaptive layout (Landscape L->R & Portrait Top->Bottom),
// register-reactive 6581 waveforms (Noise LFSR, PW, Saw, Tri)
// with graceful music-metric fallback, ADSR envelope tracers,
// VCF resonance comb, Manhattan bus electrons & cooled afterglow.
// =========================================================

import { C64_PALETTE, rgbToHex } from '../../utils/hardware-constraints.js';

const TRANSITION_DURATION = 1.15;

// 4x4 Bayer threshold matrix (0..15) for deterministic power curtains
const BAYER_4X4 = Object.freeze([
    0, 8, 2, 10,
    12, 4, 14, 6,
    3, 11, 1, 9,
    15, 7, 13, 5
]);

// Exact 16-color VIC-II Colodore hex cache
const PAL = Object.freeze(C64_PALETTE.map(([r, g, b]) => rgbToHex(r, g, b)));
const IDLE_REGS = new Uint8Array(32);

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

export class SidSiliconBg {
    constructor() {
        this.name = 'SID 6581 Microverse';

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
        this.busAccentPhase = 0;

        // Zero-Allocation Register Cache
        this.lastRegs = new Uint8Array(32);

        // Local per-voice SID phase & 23-bit hardware LFSR
        this.phase = new Float32Array(3);
        this.lfsr = new Uint32Array(3);
        this.lfsr.fill(0x7FFFFF);

        // Preallocated signal electron packets (max 6 per voice)
        this.electrons = Array.from({ length: 3 }, () => Array.from({ length: 6 }, () => ({
            pos: 0.0,
            active: false,
            speed: 1.5,
            type: 0 // 0: Freq, 1: PW, 2: ADSR
        })));
    }

    resize() {
        // Adaptive layout derives cleanly from current width/height;
        // phases, LFSRs and electron positions remain intact.
    }

    _triggerElectron(v, type) {
        const pool = this.electrons[v];
        for (let e = 0; e < pool.length; e++) {
            const el = pool[e];
            if (!el.active) {
                el.active = true;
                el.pos = 0.0;
                el.type = type;
                el.speed = type === 0 ? 2.6 : (type === 1 ? 1.8 : 1.0);
                break;
            }
        }
    }

    _drawElectronLandscape(ctx, startX, startY, endX, endY, midX, pos, type, w, h, cool) {
        const seg1 = Math.max(0, midX - startX);
        const seg2 = Math.abs(endY - startY);
        const seg3 = Math.max(0, endX - midX);
        const totalDist = seg1 + seg2 + seg3;
        if (totalDist <= 0) return;

        const curDist = pos * totalDist;
        let curX;
        let curY;

        if (curDist < seg1) {
            curX = startX + curDist;
            curY = startY;
        } else if (curDist < seg1 + seg2) {
            curX = midX;
            const vDist = curDist - seg1;
            curY = startY + (startY < endY ? vDist : -vDist);
        } else {
            curX = midX + (curDist - seg1 - seg2);
            curY = endY;
        }

        if (type === 0) {
            ctx.fillStyle = cool ? PAL[14] : PAL[1];
            fillClippedRect(ctx, curX, curY, 1, 1, w, h);
        } else if (type === 1) {
            ctx.fillStyle = cool ? PAL[14] : PAL[3];
            fillClippedRect(ctx, curX - 1, curY - 1, 2, 2, w, h);
        } else {
            ctx.fillStyle = cool ? PAL[12] : PAL[8];
            fillClippedRect(ctx, curX - 1, curY, 3, 1, w, h);
        }
    }

    _drawElectronPortrait(ctx, startX, startY, laneX, endY, pos, type, w, h, cool) {
        const seg1 = Math.max(0, laneX - startX);
        const seg2 = Math.max(0, endY - startY);
        const totalDist = seg1 + seg2;
        if (totalDist <= 0) return;

        const curDist = pos * totalDist;
        let curX;
        let curY;

        if (curDist < seg1) {
            curX = startX + curDist;
            curY = startY;
        } else {
            curX = laneX;
            curY = startY + (curDist - seg1);
        }

        if (type === 0) {
            ctx.fillStyle = cool ? PAL[14] : PAL[1];
            fillClippedRect(ctx, curX, curY, 1, 1, w, h);
        } else if (type === 1) {
            ctx.fillStyle = cool ? PAL[14] : PAL[3];
            fillClippedRect(ctx, curX - 1, curY - 1, 2, 2, w, h);
        } else {
            ctx.fillStyle = cool ? PAL[12] : PAL[8];
            fillClippedRect(ctx, curX, curY - 1, 1, 3, w, h);
        }
    }

    _drawChipHousing(ctx, x, y, cw, ch, isVcf, w, h, cool) {
        const xi = x | 0;
        const yi = y | 0;
        const wi = cw | 0;
        const hi = ch | 0;
        if (wi < 4 || hi < 4) return;

        // Hard drop shadow
        ctx.fillStyle = PAL[0];
        fillClippedRect(ctx, xi + 2, yi + 2, wi, hi, w, h);

        // PCB chip body
        ctx.fillStyle = cool
            ? (isVcf ? PAL[6] : PAL[11])
            : (isVcf ? PAL[4] : PAL[14]);
        fillClippedRect(ctx, xi, yi, wi, hi, w, h);

        // Crisp 1px top/left highlight & bottom/right bevel
        const edgeHi = cool ? PAL[14] : PAL[1];
        const edgeLo = cool ? PAL[12] : PAL[15];
        ctx.fillStyle = edgeHi;
        fillClippedRect(ctx, xi, yi, wi, 1, w, h);
        fillClippedRect(ctx, xi, yi, 1, hi, w, h);

        ctx.fillStyle = edgeLo;
        fillClippedRect(ctx, xi + 1, yi + hi - 1, wi - 1, 1, w, h);
        fillClippedRect(ctx, xi + wi - 1, yi + 1, 1, hi - 1, w, h);
    }

    _drawOscillatingCore(ctx, x, y, cw, ch, ctrl, pw12, phase, lfsr, vol, w, h, cool, beatImpulse) {
        const xi = x | 0;
        const yi = y | 0;
        const wi = cw | 0;
        const hi = ch | 0;
        if (wi < 4 || hi < 4) return;

        ctx.fillStyle = PAL[0];
        fillClippedRect(ctx, xi, yi, wi, hi, w, h);

        if (vol < 0.05) {
            ctx.fillStyle = PAL[12];
            fillClippedRect(ctx, xi, yi + (hi >> 1), wi, 1, w, h);
            return;
        }

        // Silicon transistor background gates
        if (wi >= 10 && hi >= 8) {
            ctx.fillStyle = PAL[11];
            for (let px = xi + 3; px < xi + wi - 3; px += 6) {
                if ((px * 3 + yi) % 7 < 4) {
                    fillClippedRect(ctx, px, yi + 2, 2, hi - 4, w, h);
                }
            }
        }

        const innerX0 = xi + 1;
        const innerX1 = xi + wi - 1;
        const innerW = Math.max(1, innerX1 - innerX0);
        const padY = hi >= 12 ? 3 : 1;
        const waveTop = yi + padY;
        const waveBot = yi + hi - padY - 1;
        const waveSpan = Math.max(1, waveBot - waveTop);

        ctx.fillStyle = cool ? PAL[3] : (beatImpulse > 0.65 ? PAL[7] : PAL[1]);

        if (ctrl & 128) {
            // NOISE: 23-bit LFSR bits
            const noiseMod = Math.max(1, waveSpan);
            for (let px = innerX0; px < innerX1; px += 2) {
                const bitIdx = (px - innerX0) % 23;
                if ((lfsr & (1 << bitIdx)) !== 0) {
                    const py = waveTop + ((px - innerX0) % noiseMod);
                    fillClippedRect(ctx, px, py, 2, Math.min(2, waveSpan), w, h, xi, yi, xi + wi, yi + hi);
                }
            }
        } else if (ctrl & 64) {
            // PULSE: hardware 12-bit pulse width
            const pwNorm = Math.max(0.05, Math.min(0.95, pw12 / 4095.0));
            const highLimit = Math.floor(innerW * pwNorm);
            for (let localX = 0; localX < innerW; localX++) {
                const px = innerX0 + localX;
                const isHigh = localX < highLimit;
                fillClippedRect(ctx, px, isHigh ? waveTop : waveBot, 1, 1, w, h);
                if (localX === highLimit && waveSpan > 1) {
                    fillClippedRect(ctx, px, waveTop, 1, waveSpan + 1, w, h);
                }
            }
        } else if (ctrl & 32) {
            // SAWTOOTH
            for (let localX = 0; localX < innerW; localX++) {
                const localPhase = (phase + localX / innerW) % 1.0;
                const py = waveTop + Math.floor(localPhase * waveSpan);
                fillClippedRect(ctx, innerX0 + localX, py, 1, 1, w, h);
            }
        } else if (ctrl & 16) {
            // TRIANGLE
            for (let localX = 0; localX < innerW; localX++) {
                const localPhase = (phase + localX / innerW) % 1.0;
                const tri = localPhase < 0.5 ? (localPhase * 2.0) : (2.0 - localPhase * 2.0);
                const py = waveTop + Math.floor(tri * waveSpan);
                fillClippedRect(ctx, innerX0 + localX, py, 1, 1, w, h);
            }
        } else {
            // Fallback smooth sine modulated by voice volume
            const midY = waveTop + waveSpan * 0.5;
            const amp = waveSpan * 0.48 * Math.max(0.25, vol);
            for (let localX = 0; localX < innerW; localX++) {
                const angle = (localX / innerW) * Math.PI * 4 + phase * Math.PI * 2;
                const py = Math.floor(midY + Math.sin(angle) * amp);
                fillClippedRect(ctx, innerX0 + localX, py, 1, 1, w, h);
            }
        }
    }

    _drawAdsrBlock(ctx, x, y, cw, ch, gate, envVal, sr, w, h, cool) {
        const x0 = x | 0;
        const y0 = y | 0;
        const wVal = cw | 0;
        const hVal = ch | 0;
        if (wVal < 6 || hVal < 6) return;

        const minX = Math.max(0, x0);
        const minY = Math.max(0, y0);
        const maxX = Math.min(w - 1, x0 + wVal - 1);
        const maxY = Math.min(h - 1, y0 + hVal - 1);
        if (maxX < minX || maxY < minY) return;

        const rightX = x0 + wVal - 1;
        const botY = y0 + hVal - 1;
        const xA = Math.floor(x0 + wVal * 0.20);
        const xD = Math.floor(x0 + wVal * 0.45);
        const yD = Math.floor(y0 + hVal * 0.42);
        const xS = Math.floor(x0 + wVal * 0.75);

        ctx.fillStyle = cool ? PAL[11] : PAL[12];
        drawClippedLine(ctx, x0, botY, xA, y0, minX, minY, maxX, maxY);
        drawClippedLine(ctx, xA, y0, xD, yD, minX, minY, maxX, maxY);
        drawClippedLine(ctx, xD, yD, xS, yD, minX, minY, maxX, maxY);
        drawClippedLine(ctx, xS, yD, rightX, botY, minX, minY, maxX, maxY);

        let dotX = x0;
        let dotY = botY;
        const sustainLevel = ((sr >> 4) & 15) / 15.0;
        const clampedEnv = clamp01(envVal);

        if (gate) {
            if (clampedEnv < 0.98 && clampedEnv > sustainLevel) {
                const decaySpan = Math.max(0.05, 1.0 - sustainLevel);
                const tDecay = clamp01((1.0 - clampedEnv) / decaySpan);
                dotX = x0 + (0.20 + tDecay * 0.25) * wVal;
                dotY = botY - clampedEnv * (hVal - 1);
            } else if (clampedEnv <= sustainLevel + 0.05) {
                dotX = x0 + 0.60 * wVal;
                dotY = botY - clampedEnv * (hVal - 1);
            } else {
                dotX = x0 + (clampedEnv * 0.20) * wVal;
                dotY = botY - clampedEnv * (hVal - 1);
            }
        } else {
            const tRel = 1.0 - clampedEnv;
            dotX = x0 + (0.75 + tRel * 0.25) * wVal;
            dotY = botY - clampedEnv * (hVal - 1);
        }

        ctx.fillStyle = cool ? PAL[14] : PAL[1];
        fillClippedRect(ctx, dotX - 1, dotY - 1, 2, 2, w, h, minX, minY, maxX + 1, maxY + 1);
    }

    _drawVcfBlock(ctx, x, y, cw, ch, cutoffReg, resReg, w, h, cool, beatImpulse) {
        const xi = x | 0;
        const yi = y | 0;
        const wi = cw | 0;
        const hi = ch | 0;
        if (wi < 6 || hi < 6) return;

        ctx.fillStyle = PAL[0];
        fillClippedRect(ctx, xi, yi, wi, hi, w, h);

        // Silicon bus bars inside VCF
        if (wi >= 10 && hi >= 8) {
            ctx.fillStyle = PAL[11];
            for (let py = yi + 3; py < yi + hi - 3; py += 4) {
                fillClippedRect(ctx, xi + 3, py, wi - 6, 1, w, h);
            }
        }

        // VIC-II resonance comb raster
        const spacing = Math.max(2, 16 - Math.min(15, Math.max(0, resReg | 0)));
        ctx.fillStyle = cool ? PAL[14] : (beatImpulse > 0.6 ? PAL[1] : PAL[7]);
        const combH = Math.max(2, hi - 8);
        for (let rx = xi + 3; rx < xi + wi - 3; rx += spacing) {
            fillClippedRect(ctx, rx, yi + 4, 1, combH, w, h);
        }

        // Cutoff needle
        const normCut = clamp01(cutoffReg / 2047.0);
        const spanX = Math.max(1, wi - 8);
        const cutX = Math.floor(xi + 3 + normCut * spanX);
        const needleW = beatImpulse > 0.5 && !cool ? 3 : 2;
        ctx.fillStyle = cool ? PAL[3] : PAL[10];
        fillClippedRect(ctx, cutX - 1, yi + 2, needleW, Math.max(2, hi - 4), w, h);
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
        // Defensive metric & optional register parsing
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

        const hasRegs = Boolean(safeMetrics.regs && safeMetrics.regs.length >= 24);
        const regs = hasRegs ? safeMetrics.regs : IDLE_REGS;

        // ---------------------------------------------------------
        // Discrete Beat Events (strictly gated on beatStarted)
        // ---------------------------------------------------------
        const allowSwitches = state !== 'afterglow' && state !== 'stopping';
        if (beatStarted) {
            const incomingCount = Number.isFinite(safeMetrics.beatCount)
                ? Math.floor(safeMetrics.beatCount)
                : (this.lastBeatCount + 1);

            if (incomingCount !== this.lastBeatCount || !Number.isFinite(safeMetrics.beatCount)) {
                this.lastBeatCount = incomingCount;
                this.beatParity = incomingCount & 1;

                // Fire synchronized electron bursts scaled by graded beatLevel
                if (state !== 'stopping') {
                    if (beatLevel >= 3 || beatStrength >= 0.66) {
                        this._triggerElectron(0, 0);
                        this._triggerElectron(1, 1);
                        this._triggerElectron(2, 2);
                    } else if (beatLevel === 2 || beatStrength >= 0.33) {
                        this._triggerElectron(incomingCount % 3, 1);
                        this._triggerElectron((incomingCount + 1) % 3, 0);
                    } else {
                        this._triggerElectron(incomingCount % 3, 2);
                    }
                }

                if (allowSwitches && incomingCount > 0 && incomingCount % 4 === 0) {
                    this.busAccentPhase = (this.busAccentPhase + 1) & 1;
                }
            }
        }

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
            targetSpeed = 2.25 + tension * 0.70 + (isClimaxLocked ? 0.2 : 0);
        } else if (state === 'afterglow') {
            targetSpeed = 0.32;
            targetAfterglow = 1.0;
        } else if (state === 'stopping') {
            targetSpeed = 0.40;
        }

        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * Math.min(1.0, dt * 4.0);
        this.afterglowMix += (targetAfterglow - this.afterglowMix) * Math.min(1.0, dt * 2.0);
        const ag = this.afterglowMix;
        const isCool = ag > 0.5;

        const busBoost = 1.0 + beatImpulse * (state === 'afterglow' ? 0.12 : 0.45);
        this.internalT = (this.internalT + dt * this.smoothedSpeed * busBoost) % 4096;

        // ---------------------------------------------------------
        // Bayer 4x4 Transition Visibility (starting / stopping)
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
        // 1. BACKGROUND: SILICON SUBSTRATE MICRO-GATES (strictly >= 0)
        // ---------------------------------------------------------
        ctx.fillStyle = PAL[0];
        ctx.fillRect(0, 0, w, h);

        const stepGrid = 16;
        const offX = (stepGrid - (Math.floor(this.internalT * 8) % stepGrid)) % stepGrid;
        const offY = (stepGrid - (Math.floor(this.internalT * 4) % stepGrid)) % stepGrid;

        let gridCol = PAL[11];
        if (!isCool && (beatImpulse > 0.65 || (state === 'climax' && isClimaxLocked))) {
            gridCol = PAL[6];
        } else if (!isCool && this.busAccentPhase === 1 && tension > 0.5) {
            gridCol = PAL[12];
        }
        ctx.fillStyle = gridCol;
        for (let y = offY; y < h; y += stepGrid) {
            for (let x = offX; x < w; x += stepGrid) {
                ctx.fillRect(x, y, 1, 1);
            }
        }

        // ---------------------------------------------------------
        // 2. ADAPTIVE DUAL SCHEMATIC GEOMETRY (Landscape vs Portrait)
        // ---------------------------------------------------------
        const isLandscape = w >= h * 1.1;

        let modX;
        let modW;
        let modH;
        const oscModY = [0, 0, 0];

        let vcfModX;
        let vcfModY;
        let vcfModW;
        let vcfModH;

        if (isLandscape) {
            const padX = Math.max(3, Math.floor(w * 0.05));
            const padY = Math.max(3, Math.floor(h * 0.07));
            modW = Math.max(16, Math.floor(w * 0.34));
            modH = Math.max(8, Math.floor((h - padY * 2) * 0.25));
            modX = padX;
            const availH = Math.max(0, h - padY * 2 - modH * 3);
            const gapY = Math.floor(availH * 0.5);
            for (let v = 0; v < 3; v++) {
                oscModY[v] = padY + v * (modH + gapY);
            }

            vcfModW = Math.max(16, Math.floor(w * 0.28));
            vcfModH = Math.max(12, Math.floor(h * 0.58));
            vcfModX = w - padX - vcfModW;
            vcfModY = Math.floor((h - vcfModH) * 0.5);
        } else {
            const padX = Math.max(3, Math.floor(w * 0.07));
            const padY = Math.max(3, Math.floor(h * 0.05));
            const busChannelW = Math.max(6, Math.floor(w * 0.18));
            modW = Math.max(12, w - padX * 2 - busChannelW);
            const oscRegionH = Math.max(24, Math.floor((h - padY * 2) * 0.60));
            modH = Math.max(8, Math.floor((oscRegionH - 6) / 3));
            const oscGapY = Math.max(2, Math.floor((oscRegionH - modH * 3) * 0.5));
            modX = padX;
            for (let v = 0; v < 3; v++) {
                oscModY[v] = padY + v * (modH + oscGapY);
            }

            const gapToVcf = Math.max(4, Math.floor(h * 0.06));
            vcfModX = padX;
            vcfModY = Math.min(h - padY - 8, padY + oscRegionH + gapToVcf);
            vcfModW = Math.max(14, w - padX * 2);
            vcfModH = Math.max(8, h - vcfModY - padY);
        }

        // ---------------------------------------------------------
        // 3. MANHATTAN BUS TRACES (with Beat-Reactive Bus Lighting)
        // ---------------------------------------------------------
        let busCol = PAL[6];
        if (!isCool) {
            if (beatImpulse > 0.65 || (state === 'climax' && isClimaxLocked)) {
                busCol = PAL[3];
            } else if (beatImpulse > 0.30 || tension > 0.65) {
                busCol = PAL[14];
            }
        }

        const busStartX = modX + modW;
        const busThickness = (w >= 160 && h >= 120) ? 2 : 1;

        for (let v = 0; v < 3; v++) {
            const yStart = oscModY[v] + Math.floor(modH * 0.5);
            ctx.fillStyle = (!isCool && vols[v] > 0.72 && beatImpulse > 0.35) ? PAL[3] : busCol;

            if (isLandscape) {
                const spanX = Math.max(2, vcfModX - busStartX);
                const midX = Math.floor(busStartX + spanX * (0.38 + v * 0.12));
                const yEnd = vcfModY + Math.floor(vcfModH * (0.25 + v * 0.25));

                fillClippedRect(ctx, busStartX, yStart, Math.max(0, midX - busStartX), busThickness, w, h);
                const vY = Math.min(yStart, yEnd);
                const vH = Math.abs(yStart - yEnd) + busThickness;
                fillClippedRect(ctx, midX, vY, busThickness, vH, w, h);
                fillClippedRect(ctx, midX, yEnd, Math.max(0, vcfModX - midX), busThickness, w, h);
            } else {
                const busEndEdge = vcfModX + vcfModW;
                const channelSpan = Math.max(4, busEndEdge - busStartX);
                const laneX = Math.floor(busStartX + (channelSpan * (v + 1)) / 4);

                fillClippedRect(ctx, busStartX, yStart, Math.max(0, laneX - busStartX + busThickness), busThickness, w, h);
                fillClippedRect(ctx, laneX, yStart, busThickness, Math.max(0, vcfModY - yStart), w, h);
            }
        }

        // ---------------------------------------------------------
        // 4. REGISTER ACTIVITY & ELECTRON PACKETS
        // ---------------------------------------------------------
        if (hasRegs) {
            const regLimit = Math.min(32, regs.length);
            for (let v = 0; v < 3; v++) {
                const base = v * 7;
                if (base + 6 < regLimit) {
                    if (regs[base] !== this.lastRegs[base] || regs[base + 1] !== this.lastRegs[base + 1]) {
                        this._triggerElectron(v, 0);
                    }
                    if (regs[base + 2] !== this.lastRegs[base + 2] || regs[base + 3] !== this.lastRegs[base + 3]) {
                        this._triggerElectron(v, 1);
                    }
                    if (regs[base + 5] !== this.lastRegs[base + 5] || regs[base + 6] !== this.lastRegs[base + 6]) {
                        this._triggerElectron(v, 2);
                    }
                }
            }
            for (let i = 0; i < regLimit; i++) {
                this.lastRegs[i] = regs[i];
            }
        }

        const electronSpeedScale = this.smoothedSpeed * (1.0 + beatImpulse * 0.45) * (isCool ? 0.45 : 1.0);
        for (let v = 0; v < 3; v++) {
            const pool = this.electrons[v];
            const yStart = oscModY[v] + Math.floor(modH * 0.5);
            for (let e = 0; e < pool.length; e++) {
                const el = pool[e];
                if (!el.active) continue;
                el.pos += dt * el.speed * electronSpeedScale;
                if (el.pos >= 1.0) {
                    el.active = false;
                    el.pos = 0.0;
                    continue;
                }
                if (isLandscape) {
                    const spanX = Math.max(2, vcfModX - busStartX);
                    const midX = Math.floor(busStartX + spanX * (0.38 + v * 0.12));
                    const yEnd = vcfModY + Math.floor(vcfModH * (0.25 + v * 0.25));
                    this._drawElectronLandscape(ctx, busStartX, yStart, vcfModX, yEnd, midX, el.pos, el.type, w, h, isCool);
                } else {
                    const busEndEdge = vcfModX + vcfModW;
                    const channelSpan = Math.max(4, busEndEdge - busStartX);
                    const laneX = Math.floor(busStartX + (channelSpan * (v + 1)) / 4);
                    this._drawElectronPortrait(ctx, busStartX, yStart, laneX, vcfModY, el.pos, el.type, w, h, isCool);
                }
            }
        }

        // ---------------------------------------------------------
        // 5. THREE OSCILLATOR & ADSR MODULES
        // ---------------------------------------------------------
        const fallbackCtrls = [64, 32, 16];
        for (let v = 0; v < 3; v++) {
            const vol = vols[v];
            let ctrl;
            let pw12;
            let freq;
            let sr;

            if (hasRegs) {
                const base = v * 7;
                ctrl = regs[base + 4];
                pw12 = regs[base + 2] | ((regs[base + 3] & 15) << 8);
                freq = regs[base] | (regs[base + 1] << 8);
                sr = regs[base + 6];
            } else {
                // Graceful deterministic waveform synthesis when regs are absent
                ctrl = (state === 'climax' && v === 2 && beatImpulse > 0.6) ? 128 : fallbackCtrls[v];
                pw12 = Math.floor(600 + 2800 * (0.5 + 0.5 * Math.sin(this.internalT * 1.4 + v)));
                freq = Math.floor(140 + v * 90 + tension * 120);
                sr = 0x94;
            }

            const phaseStep = freq * dt * 0.15 * (0.75 + 0.25 * this.smoothedSpeed);
            this.phase[v] = (this.phase[v] + phaseStep) % 1.0;

            if ((ctrl & 128) && (this.phase[v] < phaseStep || !hasRegs)) {
                const bit = ((this.lfsr[v] >> 22) ^ (this.lfsr[v] >> 17)) & 1;
                this.lfsr[v] = ((this.lfsr[v] << 1) & 0x7FFFFF) | bit;
            }

            const mx = modX;
            const my = oscModY[v];
            this._drawChipHousing(ctx, mx, my, modW, modH, false, w, h, isCool);

            const pad = modH >= 24 ? 3 : 2;
            const innerH = Math.max(4, modH - pad * 2);

            if (modW >= 34) {
                const adsrW = Math.max(8, Math.floor((modW - pad * 3) * 0.30));
                const coreW = Math.max(8, modW - pad * 3 - adsrW);
                const gate = hasRegs ? ((ctrl & 1) !== 0) : (vol > 0.25 || beatImpulse > 0.2);

                this._drawAdsrBlock(ctx, mx + pad, my + pad, adsrW, innerH, gate, vol, sr, w, h, isCool);
                this._drawOscillatingCore(
                    ctx, mx + pad * 2 + adsrW, my + pad, coreW, innerH,
                    ctrl, pw12, this.phase[v], this.lfsr[v], vol, w, h, isCool, beatImpulse
                );
            } else {
                this._drawOscillatingCore(
                    ctx, mx + pad, my + pad, Math.max(4, modW - pad * 2), innerH,
                    ctrl, pw12, this.phase[v], this.lfsr[v], vol, w, h, isCool, beatImpulse
                );
            }
        }

        // ---------------------------------------------------------
        // 6. VCF FILTER & RESONANCE MODULE (Readable in Climax!)
        // ---------------------------------------------------------
        let cutoffReg;
        let resReg;
        if (hasRegs) {
            cutoffReg = (regs[21] & 7) | (regs[22] << 3);
            resReg = (regs[23] >> 4) & 15;
        } else {
            cutoffReg = Math.floor(350 + 1100 * (0.5 + 0.5 * Math.sin(this.internalT * 0.9)) + beatImpulse * 500 + pulse * 200);
            resReg = Math.min(15, Math.floor(3 + tension * 8 + beatImpulse * 4));
        }

        this._drawChipHousing(ctx, vcfModX, vcfModY, vcfModW, vcfModH, true, w, h, isCool);
        const vcfPad = Math.max(2, Math.min(6, Math.floor(Math.min(vcfModW, vcfModH) * 0.12)));
        this._drawVcfBlock(
            ctx,
            vcfModX + vcfPad,
            vcfModY + vcfPad,
            Math.max(4, vcfModW - vcfPad * 2),
            Math.max(4, vcfModH - vcfPad * 2),
            cutoffReg,
            resReg,
            w,
            h,
            isCool,
            beatImpulse
        );

        // ---------------------------------------------------------
        // 7. BAYER 4x4 POWER CURTAIN (starting / stopping)
        // ---------------------------------------------------------
        if (revealRatio < 1.0) {
            this._drawPowerCurtain(ctx, w, h, revealRatio);
        }
    }
}