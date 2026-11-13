// === js/visuals/dse/c64/chunky-plasma.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: C64 CHUNKY PETSCII PLASMA
// Authentic 16-color VIC-II Colodore palette, animated 8x8
// PETSCII sub-block dithering, 4 beat-switched plasma families,
// 3-voice SID channel reactivity & Bayer 4x4 cell transitions.
// =========================================================

import { C64_PALETTE, rgbToHex } from '../../utils/hardware-constraints.js';

const TWO_PI = Math.PI * 2;
const TRANSITION_DURATION = 1.15;

// 4x4 Bayer threshold matrix (0..15) for deterministic VIC-II dither transitions
const BAYER_4X4 = Object.freeze([
    0, 8, 2, 10,
    12, 4, 14, 6,
    3, 11, 1, 9,
    15, 7, 13, 5
]);

// Precompute exact 16-color VIC-II Colodore hex strings once
const C64_HEX_TABLE = Object.freeze(
    C64_PALETTE.map(([r, g, b]) => rgbToHex(r, g, b))
);

// 4 curated 12-step circular VIC-II color ramps + cool night afterglow ramp
const VIC_PALETTE_RAMPS = Object.freeze([
    // 0: Classic VIC-II Fire & Plasma
    Object.freeze([6, 4, 2, 10, 8, 7, 1, 7, 8, 10, 2, 4]),
    // 1: Cyber Ice & Electric Violet
    Object.freeze([6, 14, 3, 15, 1, 15, 3, 13, 5, 6, 4, 14]),
    // 2: Colodore Copper & Acid Jungle
    Object.freeze([11, 9, 2, 8, 7, 13, 5, 3, 14, 4, 2, 9]),
    // 3: Technical Cobalt & Chrome
    Object.freeze([0, 11, 6, 14, 12, 15, 1, 15, 12, 14, 6, 11])
]);

const AFTERGLOW_RAMP = Object.freeze([0, 11, 6, 14, 12, 14, 6, 11, 0, 6, 11, 0]);
const RAMP_LEN = 12;

function clamp01(v) {
    if (!Number.isFinite(v)) return 0;
    return v < 0 ? 0 : (v > 1 ? 1 : v);
}

function readChannel(arr, idx, fallback) {
    if (!arr || idx >= arr.length) return fallback;
    return clamp01(arr[idx]);
}

export class ChunkyPlasma {
    constructor() {
        this.name = 'C64 Chunky Plasma';

        // Time & state tracking
        this.lastT = null;
        this.lastState = 'idle';
        this.stateAge = 0;

        // Continuous simulation state (preserved across resize/rotation)
        this.internalT = 0;
        this.wavePhase = 0;
        this.orbPhase = 0;
        this.smoothedSpeed = 1.0;
        this.colorCyclePhase = 0.0;
        this.afterglowMix = 0.0;

        // Discrete beat-driven state
        this.paletteIndex = 0;
        this.patternIndex = 0; // 0: Classic, 1: Twin-Orb, 2: Diamond, 3: Hyper-Vortex
        this.lastBeatCount = 0;
        this.beatDirection = 1;
        this.ringImpulseAge = 10.0;
        this.ringImpulsePeak = 0.0;

        // Reusable row lookup buffers (zero per-frame allocations)
        this.sinX1 = new Float32Array(0);
        this.sinX2 = new Float32Array(0);
        this.cosX3 = new Float32Array(0);
    }

    _ensureColBuffers(cols) {
        if (this.sinX1.length < cols) {
            this.sinX1 = new Float32Array(cols);
            this.sinX2 = new Float32Array(cols);
            this.cosX3 = new Float32Array(cols);
        }
    }

    resize(width, height) {
        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
            return;
        }
        const w = Math.floor(width);
        const h = Math.floor(height);
        const minDim = Math.min(w, h);
        const blockSize = minDim < 64 ? 4 : 8;
        const cols = Math.max(1, Math.ceil(w / blockSize));
        this._ensureColBuffers(cols);
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
                this.beatDirection = (incomingCount & 1) ? 1 : -1;

                // Launch radial plasma shock-ring weighted by graded beatLevel/beatStrength
                this.ringImpulseAge = 0;
                const levelWeight = beatLevel >= 3 ? 1.0 : (beatLevel === 2 ? 0.65 : (beatLevel === 1 ? 0.35 : 0.0));
                this.ringImpulsePeak = Math.max(beatStrength, levelWeight);

                if (allowDiscreteSwitches && incomingCount > 0) {
                    if (incomingCount % 4 === 0) {
                        this.paletteIndex = (this.paletteIndex + 1) % VIC_PALETTE_RAMPS.length;
                    }
                    if (incomingCount % 8 === 0) {
                        if (state === 'buildup' || state === 'climax') {
                            this.patternIndex = (this.patternIndex + 1) % 4;
                        } else if (state === 'playing') {
                            this.patternIndex = (this.patternIndex + 1) % 2;
                        }
                    }
                }
            }
        }

        this.ringImpulseAge = Math.min(10.0, this.ringImpulseAge + dt);

        // ---------------------------------------------------------
        // Macro State Dynamics & Tension Mapping
        // ---------------------------------------------------------
        let targetSpeed = 1.0 + tension * 0.45;
        let cycleSpeed = 2.0 + tension * 1.5;
        let beatZoomGain = 0.16;
        let targetAfterglow = 0.0;
        let activePattern = this.patternIndex;

        if (state === 'starting') {
            targetSpeed = 0.85;
            cycleSpeed = 1.6;
            beatZoomGain = 0.10;
            activePattern = 0;
        } else if (state === 'playing') {
            targetSpeed = 0.95 + tension * 0.45;
            cycleSpeed = 2.2 + tension * 1.6;
            beatZoomGain = 0.18;
        } else if (state === 'buildup') {
            targetSpeed = 1.45 + tension * 0.65;
            cycleSpeed = 5.0 + tension * 3.5;
            beatZoomGain = 0.28;
            if (tension > 0.55 && activePattern === 0) {
                activePattern = 1;
            }
        } else if (state === 'climax') {
            targetSpeed = 2.25 + tension * 0.75 + (isClimaxLocked ? 0.25 : 0);
            cycleSpeed = 10.0 + tension * 4.5;
            beatZoomGain = 0.40;
        } else if (state === 'afterglow') {
            // Preserve phases and pattern; smoothly slow down and cool colors
            targetSpeed = 0.30;
            cycleSpeed = 0.85;
            beatZoomGain = 0.06;
            targetAfterglow = 1.0;
        } else if (state === 'stopping') {
            targetSpeed = 0.40;
            cycleSpeed = 1.0;
            beatZoomGain = 0.05;
        }

        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * Math.min(1.0, dt * 4.0);
        this.afterglowMix += (targetAfterglow - this.afterglowMix) * Math.min(1.0, dt * 2.0);
        const ag = this.afterglowMix;

        this.internalT = (this.internalT + dt * this.smoothedSpeed) % 4096;
        this.wavePhase = (this.wavePhase + dt * this.smoothedSpeed) % TWO_PI;
        this.orbPhase = (this.orbPhase + dt * (0.55 + 0.35 * this.smoothedSpeed)) % TWO_PI;
        this.colorCyclePhase = (this.colorCyclePhase + (cycleSpeed + beatImpulse * cycleSpeed * 1.6) * dt) % RAMP_LEN;

        // ---------------------------------------------------------
        // Bayer 4x4 Transition Visibility (no globalAlpha, no DOM)
        // ---------------------------------------------------------
        let revealRatio = 1.0;
        if (state === 'starting') {
            revealRatio = clamp01((this.stateAge + 0.08) / TRANSITION_DURATION);
        } else if (state === 'stopping') {
            revealRatio = 1.0 - clamp01(this.stateAge / TRANSITION_DURATION);
            if (revealRatio <= 0.001) {
                ctx.fillStyle = C64_HEX_TABLE[0];
                ctx.fillRect(0, 0, w, h);
                return;
            }
        }

        // ---------------------------------------------------------
        // Responsive Chunky Cell Grid (25 rows @ C64 200px height)
        // ---------------------------------------------------------
        const minDim = Math.min(w, h);
        const blockSize = minDim < 64 ? 4 : 8;
        const cols = Math.max(1, Math.ceil(w / blockSize));
        const rows = Math.max(1, Math.ceil(h / blockSize));
        this._ensureColBuffers(cols);

        const blocksMin = Math.max(4, minDim / blockSize);
        const baseCoordScale = 3.5 / blocksMin;
        const activePulse = 1.0 - Math.min(0.45, beatImpulse * (beatZoomGain + 0.10 * sidBass));
        const coordScale = baseCoordScale * activePulse;

        const cx = cols * 0.5;
        const cy = rows * 0.5;
        const tWave = this.internalT;
        const dir = this.beatDirection;

        // Precompute horizontal wave lookup tables in reusable buffers
        const sinX1 = this.sinX1;
        const sinX2 = this.sinX2;
        const cosX3 = this.cosX3;
        for (let x = 0; x < cols; x++) {
            const rx = (x - cx) * coordScale;
            sinX1[x] = Math.sin(rx + tWave * 0.85);
            sinX2[x] = Math.sin(rx * 0.65 + tWave * 1.45 * dir);
            cosX3[x] = Math.cos(rx * 1.15 - tWave * 1.1);
        }

        // Twin-orb centers (used in pattern 1; spread across full aspect width)
        const orb1X = cx + Math.sin(this.orbPhase) * (cols * 0.28);
        const orb1Y = cy + Math.cos(this.orbPhase * 1.3) * (rows * 0.25);
        const orb2X = cx + Math.sin(this.orbPhase + Math.PI) * (cols * 0.28);
        const orb2Y = cy + Math.cos(this.orbPhase * 0.9 + Math.PI) * (rows * 0.25);

        // Music modulation factors
        const ringAmp = (0.75 + 0.55 * sidBass + 0.45 * beatImpulse) * (1.0 - 0.40 * ag);
        const contrastBoost = 1.0 + (0.25 * sidMid + 0.20 * energy + (isClimaxLocked ? 0.15 : 0)) * (1.0 - 0.5 * ag);
        const beatPhaseShift = beatImpulse * 1.85 * (1.0 - 0.55 * ag);
        const petsciiThreshold = clamp01(0.62 - 0.24 * sidHigh - 0.15 * tension + 0.15 * ag);

        // Expanding beat ring shockwave from center
        const ringPulseActive = this.ringImpulseAge < 0.75 && this.ringImpulsePeak > 0.01;
        const ringPulseRadius = this.ringImpulseAge * 8.0;
        const ringPulseAmp = ringPulseActive ? this.ringImpulsePeak * (1.0 - this.ringImpulseAge / 0.75) * 1.35 * (1.0 - 0.6 * ag) : 0.0;

        const mainRamp = VIC_PALETTE_RAMPS[this.paletteIndex];
        const bayerAfterglowThresh = ag * 16.0;
        const bayerRevealThresh = revealRatio * 16.0;
        const timeY = tWave * 1.2;

        // ---------------------------------------------------------
        // Chunky Cell + PETSCII Sub-Block Dither Rendering
        // ---------------------------------------------------------
        for (let row = 0; row < rows; row++) {
            const py = row * blockSize;
            const bh = Math.min(blockSize, h - py);
            if (bh <= 0) continue;

            const ry = (row - cy) * coordScale;
            const sinY1 = Math.sin(ry + timeY);
            const sinY2 = Math.sin(ry * 0.85 - timeY * 0.55);
            const bayerRowOff = (row & 3) * 4;
            const dyC = row - cy;
            const dy1 = row - orb1Y;
            const dy2 = row - orb2Y;

            for (let col = 0; col < cols; col++) {
                const px = col * blockSize;
                const bw = Math.min(blockSize, w - px);
                if (bw <= 0) continue;

                const bayerVal = BAYER_4X4[bayerRowOff + (col & 3)];

                // Ordered Bayer cell fade for starting / stopping (C64 black #000000)
                if (revealRatio < 1.0 && bayerVal >= bayerRevealThresh) {
                    ctx.fillStyle = C64_HEX_TABLE[0];
                    ctx.fillRect(px, py, bw, bh);
                    continue;
                }

                const dxC = col - cx;
                const distCenter = Math.sqrt(dxC * dxC + dyC * dyC) * coordScale;

                let v;
                if (activePattern === 1) {
                    // Twin-Orb Interference
                    const d1 = Math.sqrt((col - orb1X) * (col - orb1X) + dy1 * dy1) * coordScale;
                    const d2 = Math.sqrt((col - orb2X) * (col - orb2X) + dy2 * dy2) * coordScale;
                    v = (sinX1[col] + sinY1) * 0.75
                        + Math.sin(d1 * 1.55 - tWave * 2.1)
                        + Math.sin(d2 * 1.55 + tWave * 1.85);
                } else if (activePattern === 2) {
                    // C64 Diamond / Manhattan Interference
                    const manhattan = (Math.abs(dxC) + Math.abs(dyC)) * coordScale;
                    v = sinX1[col] + sinY2 + 1.2 * Math.sin(manhattan * 1.4 - tWave * 2.3 * dir);
                } else if (activePattern === 3) {
                    // Hyper-Vortex / Diagonal Interference
                    v = Math.sin((dxC + dyC) * coordScale * 0.9 + tWave * 1.65 * dir)
                        + Math.cos((dxC - dyC) * coordScale * 0.9 - tWave * 1.4)
                        + ringAmp * Math.sin(distCenter * 1.75 - tWave * 2.4);
                } else {
                    // Classic Dual-Sine + Ring Interference
                    v = sinX1[col] + sinY1 + Math.sin(sinX2[col] + sinY2)
                        + ringAmp * Math.sin(distCenter * 1.5 - tWave * 2.0 * dir);
                }

                if (ringPulseAmp > 0.01) {
                    const rDist = Math.abs(distCenter - ringPulseRadius);
                    if (rDist < 1.1) {
                        v += (1.0 - rDist / 1.1) * ringPulseAmp;
                    }
                }

                v = v * contrastBoost + pulse * 0.35;

                // Continuous ramp lookup + fractional phase for PETSCII sub-block dithering
                const rawIdx = (v + 4.0) * 1.45 + this.colorCyclePhase + beatPhaseShift;
                const baseStep = Math.floor(rawIdx);
                const frac = rawIdx - baseStep;

                const idx0 = ((baseStep % RAMP_LEN) + RAMP_LEN) % RAMP_LEN;
                const idx1 = (idx0 + 1) % RAMP_LEN;

                // Smoothly dither between active ramp and cool night afterglow ramp
                const useAfterglow = ag > 0.001 && bayerVal < bayerAfterglowThresh;
                const activeRamp = useAfterglow ? AFTERGLOW_RAMP : mainRamp;

                const vic0 = activeRamp[idx0];
                const vic1 = activeRamp[idx1];

                ctx.fillStyle = C64_HEX_TABLE[vic0];
                ctx.fillRect(px, py, bw, bh);

                // Animated C64 PETSCII 2x2 sub-block checkerboard dither between adjacent colors
                if (vic0 !== vic1 && bw >= 4 && bh >= 4 && frac > petsciiThreshold) {
                    const subW = bw >> 1;
                    const subH = bh >> 1;
                    ctx.fillStyle = C64_HEX_TABLE[vic1];
                    ctx.fillRect(px, py, subW, subH);
                    ctx.fillRect(px + subW, py + subH, bw - subW, bh - subH);
                    if (frac > 0.84) {
                        ctx.fillRect(px + subW, py, bw - subW, subH);
                    }
                }
            }
        }
    }
}