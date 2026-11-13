// === js/visuals/dse/atari/wireframe-morph.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: ATARI 3D WIREFRAME MORPH
// CPU-Math tribute morphing a 3D cube into an 8-pointed star.
// Strict 9-bit Shifter LUT colors, 2-pass Z-depth wireframe,
// inner-cube dual-shell mode, opaque vector ghost trails,
// clipped Bresenham lines & foreground-safe transitions.
// =========================================================

import { quantizeAtari9Bit, rgbToHex } from '../../utils/hardware-constraints.js';

const TWO_PI = Math.PI * 2;
const TRANSITION_DURATION = 1.1;

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

function quantHex(r, g, b) {
    const r3 = r <= 0 ? 0 : (r >= 252 ? 7 : Math.round(r / 36));
    const g3 = g <= 0 ? 0 : (g >= 252 ? 7 : Math.round(g / 36));
    const b3 = b <= 0 ? 0 : (b >= 252 ? 7 : Math.round(b / 36));
    return ATARI_HEX_LUT[(r3 << 6) | (g3 << 3) | b3];
}

// 4 curated Atari ST 9-bit vector palettes (back, mid, front, flash/node, innerShell)
const WIREFRAME_THEMES = Object.freeze([
    Object.freeze({
        back: quantHex(0, 72, 0),
        mid: quantHex(0, 144, 0),
        front: quantHex(72, 252, 72),
        node: quantHex(252, 252, 252),
        inner: quantHex(216, 216, 0)
    }),
    Object.freeze({
        back: quantHex(0, 36, 108),
        mid: quantHex(0, 144, 180),
        front: quantHex(72, 252, 252),
        node: quantHex(252, 252, 252),
        inner: quantHex(252, 144, 0)
    }),
    Object.freeze({
        back: quantHex(108, 36, 0),
        mid: quantHex(216, 108, 0),
        front: quantHex(252, 216, 72),
        node: quantHex(252, 252, 252),
        inner: quantHex(252, 72, 144)
    }),
    Object.freeze({
        back: quantHex(72, 0, 108),
        mid: quantHex(180, 36, 180),
        front: quantHex(252, 108, 252),
        node: quantHex(252, 252, 180),
        inner: quantHex(72, 216, 252)
    })
]);

const AFTERGLOW_THEME = Object.freeze({
    back: quantHex(0, 0, 72),
    mid: quantHex(36, 72, 108),
    front: quantHex(108, 144, 180),
    node: quantHex(180, 216, 252),
    inner: quantHex(72, 72, 144)
});

const GHOST_TRAIL_HEX = Object.freeze([quantHex(36, 36, 108), quantHex(36, 36, 72)]);

const BASE_CORNERS = Object.freeze([
    [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1],
    [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1]
]);

const BASE_TIPS = Object.freeze([
    [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]
]);

const STAR_EDGES = Object.freeze([
    [8, 0], [8, 1], [8, 2], [8, 3],
    [9, 4], [9, 5], [9, 6], [9, 7],
    [10, 0], [10, 1], [10, 4], [10, 5],
    [11, 2], [11, 3], [11, 6], [11, 7],
    [12, 0], [12, 2], [12, 4], [12, 6],
    [13, 1], [13, 3], [13, 5], [13, 7]
]);

const CUBE_EDGES = Object.freeze([
    [0, 1], [2, 3], [4, 5], [6, 7],
    [0, 2], [1, 3], [4, 6], [5, 7],
    [0, 4], [1, 5], [2, 6], [3, 7]
]);

function clamp01(v) {
    if (!Number.isFinite(v)) return 0;
    return v < 0 ? 0 : (v > 1 ? 1 : v);
}

function readChannel(arr, idx, fallback) {
    if (!arr || idx >= arr.length) return fallback;
    return clamp01(arr[idx]);
}

function fillClippedRect(ctx, x, y, rw, rh, bufW, bufH) {
    let x0 = Math.floor(x);
    let y0 = Math.floor(y);
    let x1 = Math.floor(x + rw);
    let y1 = Math.floor(y + rh);
    if (x0 < 0) x0 = 0;
    if (y0 < 0) y0 = 0;
    if (x1 > bufW) x1 = bufW;
    if (y1 > bufH) y1 = bufH;
    const cw = x1 - x0;
    const ch = y1 - y0;
    if (cw > 0 && ch > 0) {
        ctx.fillRect(x0, y0, cw, ch);
    }
}

function drawClippedLine(ctx, x0, y0, x1, y1, bufW, bufH, colorHex, thick = false) {
    if (
        !Number.isFinite(x0) || !Number.isFinite(y0) ||
        !Number.isFinite(x1) || !Number.isFinite(y1) ||
        bufW <= 0 || bufH <= 0
    ) {
        return;
    }

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

    if (!clipTest(-dx, x0) || !clipTest(dx, maxX - x0) || !clipTest(-dy, y0) || !clipTest(dy, maxY - y0)) {
        return;
    }

    let cx0 = Math.min(maxX, Math.max(0, Math.floor(x0 + t0 * dx)));
    let cy0 = Math.min(maxY, Math.max(0, Math.floor(y0 + t0 * dy)));
    const cx1 = Math.min(maxX, Math.max(0, Math.floor(x0 + t1 * dx)));
    const cy1 = Math.min(maxY, Math.max(0, Math.floor(y0 + t1 * dy)));

    ctx.fillStyle = colorHex;
    const adx = Math.abs(cx1 - cx0);
    const ady = Math.abs(cy1 - cy0);
    const sx = cx0 < cx1 ? 1 : -1;
    const sy = cy0 < cy1 ? 1 : -1;
    let err = adx - ady;
    const maxSteps = adx + ady + 2;

    for (let step = 0; step < maxSteps; step++) {
        const pw = thick && cx0 + 1 <= maxX ? 2 : 1;
        const ph = thick && cy0 + 1 <= maxY ? 2 : 1;
        ctx.fillRect(cx0, cy0, pw, ph);
        if (cx0 === cx1 && cy0 === cy1) break;
        const e2 = err * 2;
        if (e2 > -ady) { err -= ady; cx0 += sx; }
        if (e2 < adx) { err += adx; cy0 += sy; }
    }
}

export class WireframeMorph {
    constructor() {
        this.name = 'Atari Wireframe Morph';

        // Time & state tracking
        this.lastT = null;
        this.lastState = 'idle';
        this.stateAge = 0;

        // Preallocated vertex, projection & trail buffers (zero per-frame allocations)
        this.vertices = Array.from({ length: 14 }, () => ({ x: 0, y: 0, z: 0 }));
        this.rotatedZ = new Float32Array(14);
        this.projected = Array.from({ length: 14 }, () => ({ x: 0, y: 0 }));
        this.trailFrames = [
            Array.from({ length: 14 }, () => ({ x: 0, y: 0 })),
            Array.from({ length: 14 }, () => ({ x: 0, y: 0 }))
        ];
        this.trailValidCount = 0;
        this.trailAccum = 0;
        this.lastW = -1;
        this.lastH = -1;

        // Continuous simulation state (preserved across resize/rotation)
        this.internalT = 0;
        this.roamPhase = 0;
        this.smoothedSpeed = 1.0;
        this.smoothedMorph = 0.0;
        this.afterglowMix = 0.0;

        // Discrete beat-driven state
        this.lastBeatCount = 0;
        this.spinDirection = 1;
        this.themeIndex = 0;
        this.detailMode = 0; // 0: Classic, 1: Z-Depth + Nodes, 2: Ghost Trails, 3: Dual-Shell Crystal
        this.flashAge = 10.0;
        this.flashPeak = 0.0;
    }

    resize(width, height) {
        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
            return;
        }
        const w = Math.floor(width);
        const h = Math.floor(height);
        if (w !== this.lastW || h !== this.lastH) {
            this.lastW = w;
            this.lastH = h;
            this.trailValidCount = 0;
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

        if (w !== this.lastW || h !== this.lastH) {
            this.lastW = w;
            this.lastH = h;
            this.trailValidCount = 0;
        }

        if (state === 'idle') {
            this.lastT = safeT;
            this.lastState = 'idle';
            this.stateAge = 0;
            this.trailValidCount = 0;
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
        const allowDiscrete = state !== 'afterglow' && state !== 'stopping';
        if (beatStarted) {
            const incomingCount = Number.isFinite(safeMetrics.beatCount)
                ? Math.floor(safeMetrics.beatCount)
                : (this.lastBeatCount + 1);

            if (incomingCount !== this.lastBeatCount || !Number.isFinite(safeMetrics.beatCount)) {
                this.lastBeatCount = incomingCount;

                this.flashAge = 0;
                const levelWeight = beatLevel >= 3 ? 1.0 : (beatLevel === 2 ? 0.65 : (beatLevel === 1 ? 0.35 : 0.0));
                this.flashPeak = Math.max(beatStrength, levelWeight);

                if (allowDiscrete && incomingCount > 0) {
                    if (incomingCount % 4 === 0) {
                        this.themeIndex = (this.themeIndex + 1) % WIREFRAME_THEMES.length;
                        this.spinDirection *= -1;
                    }
                    if (incomingCount % 8 === 0) {
                        if (state === 'buildup' || state === 'climax') {
                            this.detailMode = (this.detailMode + 1) % 4;
                        } else if (state === 'playing') {
                            this.detailMode = (this.detailMode + 1) % 2;
                        }
                    }
                }
            }
        }

        this.flashAge = Math.min(10.0, this.flashAge + dt);

        // ---------------------------------------------------------
        // Macro State Dynamics & Foreground-Safe Transitions
        // ---------------------------------------------------------
        let targetSpeed = 1.0 + tension * 0.4;
        let targetMorph = tension * 0.35;
        let beatScaleGain = 0.16;
        let targetAfterglow = 0.0;
        let geoReveal = 1.0;
        let maxVisibleEdges = STAR_EDGES.length;

        if (state === 'starting') {
            const prog = clamp01((this.stateAge + 0.08) / TRANSITION_DURATION);
            targetSpeed = 0.85;
            targetMorph = 0.0;
            beatScaleGain = 0.10;
            geoReveal = 0.25 + 0.75 * prog;
            maxVisibleEdges = Math.max(4, Math.ceil(STAR_EDGES.length * prog));
        } else if (state === 'stopping') {
            const prog = 1.0 - clamp01(this.stateAge / TRANSITION_DURATION);
            if (prog <= 0.01) return;
            targetSpeed = 0.50;
            targetMorph = 0.1;
            beatScaleGain = 0.05;
            geoReveal = prog;
            maxVisibleEdges = Math.max(0, Math.ceil(STAR_EDGES.length * prog));
            if (maxVisibleEdges <= 0) return;
        } else if (state === 'playing') {
            targetSpeed = 0.95 + tension * 0.40;
            targetMorph = tension * 0.40;
            beatScaleGain = 0.18;
        } else if (state === 'buildup') {
            targetSpeed = 1.65 + tension * 0.60;
            targetMorph = 0.35 + (Math.sin(this.internalT * 2.6) * 0.5 + 0.5) * 0.55;
            beatScaleGain = 0.24;
        } else if (state === 'climax') {
            targetSpeed = 2.6 + tension * 0.85 + (isClimaxLocked ? 0.3 : 0);
            targetMorph = 0.92 + 0.08 * Math.sin(this.internalT * 4.0);
            beatScaleGain = 0.32;
        } else if (state === 'afterglow') {
            targetSpeed = 0.35;
            targetMorph = 0.25;
            beatScaleGain = 0.06;
            targetAfterglow = 1.0;
        }

        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * Math.min(1.0, dt * 4.5);
        this.smoothedMorph += (targetMorph - this.smoothedMorph) * Math.min(1.0, dt * 4.0);
        this.afterglowMix += (targetAfterglow - this.afterglowMix) * Math.min(1.0, dt * 2.0);
        const ag = this.afterglowMix;

        this.internalT = (this.internalT + dt * this.smoothedSpeed) % 4096;
        this.roamPhase = (this.roamPhase + dt * (0.55 + 0.35 * ymMid) * this.smoothedSpeed) % TWO_PI;

        // ---------------------------------------------------------
        // Morph Geometry & Safe Responsive Projection
        // ---------------------------------------------------------
        const morph = clamp01(this.smoothedMorph + beatImpulse * 0.12 * (1.0 - ag));
        const cornerScale = Math.max(0.25, (1.0 - morph * 0.65) * (1.0 - 0.12 * ymMid));
        const tipScale = (1.0 + morph * 1.18) + (ymBass * 0.18 + beatImpulse * 0.16) * (1.0 - 0.6 * ag);

        for (let i = 0; i < 8; i++) {
            this.vertices[i].x = BASE_CORNERS[i][0] * cornerScale;
            this.vertices[i].y = BASE_CORNERS[i][1] * cornerScale;
            this.vertices[i].z = BASE_CORNERS[i][2] * cornerScale;
        }
        for (let i = 0; i < 6; i++) {
            this.vertices[8 + i].x = BASE_TIPS[i][0] * tipScale;
            this.vertices[8 + i].y = BASE_TIPS[i][1] * tipScale;
            this.vertices[8 + i].z = BASE_TIPS[i][2] * tipScale;
        }

        const minDim = Math.min(w, h);
        const beatScale = 1.0 + beatImpulse * beatScaleGain;
        const projScale = Math.max(8, minDim * 0.42 * geoReveal * beatScale);

        const maxRadiusUnits = Math.max(1.732 * cornerScale, tipScale);
        const minZOff = Math.max(1.8, 4.5 - maxRadiusUnits);
        const estMaxRadius = (maxRadiusUnits * projScale) / minZOff;

        const roamAmpX = Math.max(0, w * 0.45 - estMaxRadius) * (0.35 + 0.55 * tension) * (1.0 - 0.65 * ag);
        const roamAmpY = Math.max(0, h * 0.45 - estMaxRadius) * (0.25 + 0.45 * ymMid) * (1.0 - 0.65 * ag);
        const cx = Math.floor(w * 0.5 + Math.sin(this.roamPhase) * roamAmpX);
        const cy = Math.floor(h * 0.5 + Math.cos(this.roamPhase * 0.7) * roamAmpY);

        const rx = this.internalT * 0.9;
        const ry = this.internalT * 1.3 * this.spinDirection;
        const rz = this.internalT * 0.6;

        const sinX = Math.sin(rx); const cosX = Math.cos(rx);
        const sinY = Math.sin(ry); const cosY = Math.cos(ry);
        const sinZ = Math.sin(rz); const cosZ = Math.cos(rz);

        for (let i = 0; i < 14; i++) {
            const v = this.vertices[i];
            const y1 = v.y * cosX - v.z * sinX;
            const z1 = v.y * sinX + v.z * cosX;
            const x2 = v.x * cosY + z1 * sinY;
            const z2 = -v.x * sinY + z1 * cosY;
            const x3 = x2 * cosZ - y1 * sinZ;
            const y3 = x2 * sinZ + y1 * cosZ;

            this.rotatedZ[i] = z2;
            const zOff = Math.max(1.6, z2 + 4.5);
            this.projected[i].x = Math.floor(cx + (x3 * projScale) / zOff);
            this.projected[i].y = Math.floor(cy + (y3 * projScale) / zOff);
        }

        // ---------------------------------------------------------
        // Opaque Ghost Trails (Mode 2 or Climax)
        // ---------------------------------------------------------
        const showTrails = (this.detailMode === 2 || state === 'climax') && ag < 0.55 && state !== 'starting' && state !== 'stopping';
        if (showTrails && this.trailValidCount > 0) {
            const tCount = Math.min(2, this.trailValidCount);
            for (let tr = tCount - 1; tr >= 0; tr--) {
                const pts = this.trailFrames[tr];
                const trailCol = GHOST_TRAIL_HEX[tr];
                for (let i = 0; i < maxVisibleEdges; i++) {
                    const p1 = pts[STAR_EDGES[i][0]];
                    const p2 = pts[STAR_EDGES[i][1]];
                    drawClippedLine(ctx, p1.x, p1.y, p2.x, p2.y, w, h, trailCol, false);
                }
            }
        }

        // ---------------------------------------------------------
        // 2-Pass Z-Depth Shifter Wireframe + Dual-Shell Core
        // ---------------------------------------------------------
        const isCool = ag > 0.5;
        const theme = isCool ? AFTERGLOW_THEME : WIREFRAME_THEMES[this.themeIndex];
        const flashActive = !isCool && this.flashAge < 0.09 && this.flashPeak > 0.3;
        const highBoost = beatImpulse > 0.55 || pulse > 0.5 || ymHigh > 0.7;

        // Optional inner cube wireframe shell (Mode 3 or Climax)
        const showInnerCube = (this.detailMode === 3 || state === 'climax') && maxVisibleEdges >= 12 && !isCool;
        if (showInnerCube) {
            const innerCol = flashActive ? theme.node : theme.inner;
            for (let i = 0; i < CUBE_EDGES.length; i++) {
                const p1 = this.projected[CUBE_EDGES[i][0]];
                const p2 = this.projected[CUBE_EDGES[i][1]];
                drawClippedLine(ctx, p1.x, p1.y, p2.x, p2.y, w, h, innerCol, false);
            }
        }

        // Pass 1: Back edges (avgZ > 0)
        for (let i = 0; i < maxVisibleEdges; i++) {
            const e = STAR_EDGES[i];
            const avgZ = (this.rotatedZ[e[0]] + this.rotatedZ[e[1]]) * 0.5;
            if (avgZ > 0) {
                const p1 = this.projected[e[0]];
                const p2 = this.projected[e[1]];
                drawClippedLine(ctx, p1.x, p1.y, p2.x, p2.y, w, h, flashActive ? theme.mid : theme.back, false);
            }
        }

        // Pass 2: Front edges (avgZ <= 0)
        const thickFront = (this.detailMode === 1 || state === 'climax') && minDim >= 100 && !isCool;
        for (let i = 0; i < maxVisibleEdges; i++) {
            const e = STAR_EDGES[i];
            const avgZ = (this.rotatedZ[e[0]] + this.rotatedZ[e[1]]) * 0.5;
            if (avgZ <= 0) {
                const p1 = this.projected[e[0]];
                const p2 = this.projected[e[1]];
                const edgeCol = flashActive
                    ? (this.flashPeak >= 0.66 ? theme.node : theme.front)
                    : (avgZ < -0.35 && highBoost ? theme.node : (avgZ < -0.1 ? theme.front : theme.mid));
                drawClippedLine(ctx, p1.x, p1.y, p2.x, p2.y, w, h, edgeCol, thickFront && avgZ < -0.3);
            }
        }

        // Crisp 2x2 vertex nodes on front star tips (Mode 1, Climax or high YM)
        if ((this.detailMode === 1 || state === 'climax' || ymHigh > 0.65) && !isCool && maxVisibleEdges > 12) {
            const nodeSize = minDim >= 80 && (beatImpulse > 0.45 || this.detailMode === 1) ? 2 : 1;
            ctx.fillStyle = theme.node;
            for (let i = 8; i < 14; i++) {
                if (this.rotatedZ[i] <= 0.25) {
                    const p = this.projected[i];
                    fillClippedRect(ctx, p.x - (nodeSize >> 1), p.y - (nodeSize >> 1), nodeSize, nodeSize, w, h);
                }
            }
        }

        // Snapshot trail ring buffer at ~25Hz cadence
        this.trailAccum += dt;
        if (this.trailAccum >= 0.04) {
            this.trailAccum = 0;
            for (let i = 0; i < 14; i++) {
                this.trailFrames[1][i].x = this.trailFrames[0][i].x;
                this.trailFrames[1][i].y = this.trailFrames[0][i].y;
                this.trailFrames[0][i].x = this.projected[i].x;
                this.trailFrames[0][i].y = this.projected[i].y;
            }
            if (this.trailValidCount < 2) this.trailValidCount++;
        }
    }
}