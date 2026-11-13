// === js/visuals/dse/c64/vector-star.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: 3D ROTATING VECTOR STAR
// 6510 Assembly aesthetics with time-quantized mechanical 3-tick
// rotation stutter, LUT-driven responsive Lissajous orbit,
// fake 2-pass Z-buffer, Y-coordinate Raster-Interrupt splits,
// opaque wireframe ghost trails & clipped Bresenham lines.
// =========================================================

import { C64_PALETTE, rgbToHex } from '../../utils/hardware-constraints.js';

const TRANSITION_DURATION = 1.1;
const STUTTER_STEP_SEC = 0.06; // 3 PAL ticks @ 50Hz

// Exact 16-color VIC-II Colodore hex cache
const PAL = Object.freeze(C64_PALETTE.map(([r, g, b]) => rgbToHex(r, g, b)));

// 256-entry integer sine/cosine lookup tables
const SIN_LUT = new Float32Array(256);
const COS_LUT = new Float32Array(256);
for (let i = 0; i < 256; i++) {
    const angle = (i / 256) * Math.PI * 2;
    SIN_LUT[i] = Math.sin(angle);
    COS_LUT[i] = Math.cos(angle);
}

// 4 curated VIC-II Y-Raster-Interrupt split palettes + cool afterglow palette
const RASTER_PALETTES = Object.freeze([
    Object.freeze([6, 14, 3, 1, 3, 14]),   // 0: Classic Ice Cyan
    Object.freeze([2, 8, 7, 1, 7, 8]),     // 1: Fire Copper
    Object.freeze([6, 5, 13, 1, 13, 5]),   // 2: Acid Emerald
    Object.freeze([4, 10, 7, 1, 10, 4])    // 3: Royal Sunset Neon
]);
const AFTERGLOW_RASTER = Object.freeze([11, 6, 14, 12, 14, 6]);

// 8-pointed 3D star topology (8 inner cube + 6 outer pyramid spikes, 36 edges)
const BASE_VERTICES = Object.freeze([
    { x: -0.3, y: -0.3, z: -0.3 }, { x: 0.3, y: -0.3, z: -0.3 },
    { x: 0.3, y: 0.3, z: -0.3 },   { x: -0.3, y: 0.3, z: -0.3 },
    { x: -0.3, y: -0.3, z: 0.3 },  { x: 0.3, y: -0.3, z: 0.3 },
    { x: 0.3, y: 0.3, z: 0.3 },    { x: -0.3, y: 0.3, z: 0.3 },
    { x: 1.0, y: 0, z: 0 },        { x: -1.0, y: 0, z: 0 },
    { x: 0, y: 1.0, z: 0 },        { x: 0, y: -1.0, z: 0 },
    { x: 0, y: 0, z: 1.0 },        { x: 0, y: 0, z: -1.0 }
]);

const STAR_EDGES = Object.freeze([
    // Inner cube (0..11)
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
    // Pyramid spikes (12..35)
    [8, 1], [8, 2], [8, 5], [8, 6],
    [9, 0], [9, 3], [9, 4], [9, 7],
    [10, 2], [10, 3], [10, 6], [10, 7],
    [11, 0], [11, 1], [11, 4], [11, 5],
    [12, 4], [12, 5], [12, 6], [12, 7],
    [13, 0], [13, 1], [13, 2], [13, 3]
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

    if (
        !clipTest(-dx, x0) ||
        !clipTest(dx, maxX - x0) ||
        !clipTest(-dy, y0) ||
        !clipTest(dy, maxY - y0)
    ) {
        return;
    }

    let cx0 = Math.floor(x0 + t0 * dx);
    let cy0 = Math.floor(y0 + t0 * dy);
    let cx1 = Math.floor(x0 + t1 * dx);
    let cy1 = Math.floor(y0 + t1 * dy);

    cx0 = cx0 < 0 ? 0 : (cx0 > maxX ? maxX : cx0);
    cy0 = cy0 < 0 ? 0 : (cy0 > maxY ? maxY : cy0);
    cx1 = cx1 < 0 ? 0 : (cx1 > maxX ? maxX : cx1);
    cy1 = cy1 < 0 ? 0 : (cy1 > maxY ? maxY : cy1);

    ctx.fillStyle = colorHex;
    const adx = Math.abs(cx1 - cx0);
    const ady = Math.abs(cy1 - cy0);
    const sx = cx0 < cx1 ? 1 : -1;
    const sy = cy0 < cy1 ? 1 : -1;
    let err = adx - ady;
    const maxSteps = adx + ady + 2;
    const pxSize = thick ? 2 : 1;

    for (let step = 0; step < maxSteps; step++) {
        const wPlot = thick && cx0 + 1 <= maxX ? pxSize : 1;
        const hPlot = thick && cy0 + 1 <= maxY ? pxSize : 1;
        ctx.fillRect(cx0, cy0, wPlot, hPlot);
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

export class C64VectorStar {
    constructor() {
        this.name = 'C64 Vector Star';

        // Time & state tracking
        this.lastT = null;
        this.lastState = 'idle';
        this.stateAge = 0;

        // Preallocated vertex/trail buffers (zero per-frame allocations)
        this.rotated = Array.from({ length: BASE_VERTICES.length }, () => ({ x: 0, y: 0, z: 0 }));
        this.projected = Array.from({ length: BASE_VERTICES.length }, () => ({ x: 0, y: 0 }));
        this.trailFrames = [
            Array.from({ length: BASE_VERTICES.length }, () => ({ x: 0, y: 0 })),
            Array.from({ length: BASE_VERTICES.length }, () => ({ x: 0, y: 0 }))
        ];
        this.trailValidCount = 0;
        this.trailAccum = 0;
        this.lastW = -1;
        this.lastH = -1;

        // 6510 integer LUT rotation & Lissajous path state
        this.rotX = 0;
        this.rotY = 0;
        this.rotZ = 0;
        this.rotTickAccum = 0;
        this.pathT = 0.0;
        this.smoothedSpeed = 1.0;
        this.afterglowMix = 0.0;

        // Discrete beat-driven state
        this.lastBeatCount = 0;
        this.beatDirection = 1;
        this.paletteIndex = 0;
        this.renderMode = 0; // 0: Classic, 1: Vertex Sparks, 2: Thick Hero Front, 3: Ghost Trails
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
            this.trailValidCount = 0; // Drop stale pixel-space ghost trails on dimension change
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
        // Defensive metric parsing (3 C64 SID voices)
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
        const allowDiscrete = state !== 'afterglow' && state !== 'stopping';
        if (beatStarted) {
            const incomingCount = Number.isFinite(safeMetrics.beatCount)
                ? Math.floor(safeMetrics.beatCount)
                : (this.lastBeatCount + 1);

            if (incomingCount !== this.lastBeatCount || !Number.isFinite(safeMetrics.beatCount)) {
                this.lastBeatCount = incomingCount;
                this.beatDirection = (incomingCount & 1) ? 1 : -1;

                this.flashAge = 0;
                const levelWeight = beatLevel >= 3 ? 1.0 : (beatLevel === 2 ? 0.65 : (beatLevel === 1 ? 0.35 : 0.0));
                this.flashPeak = Math.max(beatStrength, levelWeight);

                if (allowDiscrete && incomingCount > 0) {
                    if (incomingCount % 4 === 0) {
                        this.paletteIndex = (this.paletteIndex + 1) % RASTER_PALETTES.length;
                    }
                    if (incomingCount % 8 === 0) {
                        if (state === 'buildup' || state === 'climax') {
                            this.renderMode = (this.renderMode + 1) % 4;
                        } else if (state === 'playing') {
                            this.renderMode = (this.renderMode + 1) % 2;
                        }
                    }
                }
            }
        }

        this.flashAge = Math.min(10.0, this.flashAge + dt);

        // ---------------------------------------------------------
        // Macro State Dynamics & Geometric Transitions
        // ---------------------------------------------------------
        let targetSpeed = 1.0 + tension * 0.4;
        let targetAfterglow = 0.0;
        let geoScale = 1.0;
        let spikeMult = 1.3;
        let maxVisibleEdges = STAR_EDGES.length;

        if (state === 'starting') {
            const prog = clamp01((this.stateAge + 0.08) / TRANSITION_DURATION);
            targetSpeed = 0.85;
            geoScale = 0.35 + 0.65 * prog;
            spikeMult = 0.3 + 1.0 * prog;
            maxVisibleEdges = Math.max(4, Math.ceil(STAR_EDGES.length * prog));
        } else if (state === 'stopping') {
            const prog = 1.0 - clamp01(this.stateAge / TRANSITION_DURATION);
            if (prog <= 0.01) {
                return;
            }
            targetSpeed = 0.55;
            geoScale = prog;
            spikeMult = 0.25 + 1.05 * prog;
            maxVisibleEdges = Math.max(0, Math.ceil(STAR_EDGES.length * prog));
            if (maxVisibleEdges <= 0) return;
        } else if (state === 'playing') {
            targetSpeed = 0.95 + tension * 0.40;
            spikeMult = 1.24 + 0.14 * sidBass;
        } else if (state === 'buildup') {
            targetSpeed = 1.45 + tension * 0.55;
            spikeMult = 1.26 + 0.20 * sidBass;
        } else if (state === 'climax') {
            targetSpeed = 2.15 + tension * 0.65 + (isClimaxLocked ? 0.25 : 0);
            spikeMult = 1.30 + 0.26 * sidBass;
        } else if (state === 'afterglow') {
            targetSpeed = 0.35;
            targetAfterglow = 1.0;
            spikeMult = 1.08 + 0.06 * sidBass;
        }

        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * Math.min(1.0, dt * 4.5);
        this.afterglowMix += (targetAfterglow - this.afterglowMix) * Math.min(1.0, dt * 2.0);
        const ag = this.afterglowMix;

        // Beat-weighted spike expansion & FOV punch (clearly differentiates 0.20 / 0.50 / 0.90)
        const beatScaleKick = beatImpulse * (state === 'afterglow' ? 0.04 : 0.18);
        spikeMult += beatScaleKick * 0.8;

        // Time-quantized 6510 3-tick mechanical rotation stutter
        this.rotTickAccum += dt;
        while (this.rotTickAccum >= STUTTER_STEP_SEC) {
            this.rotTickAccum -= STUTTER_STEP_SEC;
            const rStepX = Math.max(1, Math.round(2 * this.smoothedSpeed));
            const rStepY = Math.max(1, Math.round(3 * this.smoothedSpeed)) * this.beatDirection;
            const rStepZ = Math.max(1, Math.round(1 * this.smoothedSpeed));

            this.rotX = (this.rotX + rStepX) & 255;
            this.rotY = (this.rotY + rStepY) & 255;
            this.rotZ = (this.rotZ + rStepZ) & 255;
        }

        // Lissajous path progression
        const orbitSpeed = this.smoothedSpeed * (0.85 + 0.35 * sidMid);
        this.pathT = (this.pathT + dt * 30.0 * orbitSpeed) % 4096;

        // ---------------------------------------------------------
        // Responsive Safe-Area Projection (Portrait -> Ultrawide)
        // ---------------------------------------------------------
        const minDim = Math.min(w, h);
        const fovPulse = 1.0 + beatScaleKick;
        const fov = Math.max(10, Math.floor(minDim * 0.78 * geoScale * fovPulse));

        // Max projected radius for vertex radius = spikeMult at zOff >= (3.5 - spikeMult)
        const minZOff = Math.max(1.4, 3.5 - spikeMult);
        const estMaxRadius = (spikeMult * fov) / minZOff;
        const safeOrbitX = Math.max(0, Math.floor(w * 0.46 - estMaxRadius));
        const safeOrbitY = Math.max(0, Math.floor(h * 0.46 - estMaxRadius));

        const pXIdx = Math.floor(this.pathT) & 255;
        const pYIdx = Math.floor(this.pathT * 0.7) & 255;
        const targetX = Math.floor(w * 0.5 + SIN_LUT[pXIdx] * safeOrbitX);
        const targetY = Math.floor(h * 0.5 + COS_LUT[pYIdx] * safeOrbitY);

        const sinX = SIN_LUT[this.rotX];
        const cosX = COS_LUT[this.rotX];
        const sinY = SIN_LUT[this.rotY];
        const cosY = COS_LUT[this.rotY];
        const sinZ = SIN_LUT[this.rotZ];
        const cosZ = COS_LUT[this.rotZ];

        for (let i = 0; i < BASE_VERTICES.length; i++) {
            const baseV = BASE_VERTICES[i];
            const vx = baseV.x * (i >= 8 ? spikeMult : 1.0);
            const vy = baseV.y * (i >= 8 ? spikeMult : 1.0);
            const vz = baseV.z * (i >= 8 ? spikeMult : 1.0);

            const ry = vy * cosX - vz * sinX;
            const rz = vy * sinX + vz * cosX;

            const rx = vx * cosY + rz * sinY;
            const rz2 = -vx * sinY + rz * cosY;

            const rx2 = rx * cosZ - ry * sinZ;
            const ry2 = rx * sinZ + ry * cosZ;

            this.rotated[i].x = rx2;
            this.rotated[i].y = ry2;
            this.rotated[i].z = rz2;

            const zOff = Math.max(1.2, rz2 + 3.5);
            this.projected[i].x = Math.floor(targetX + (rx2 * fov) / zOff);
            this.projected[i].y = Math.floor(targetY + (ry2 * fov) / zOff);
        }

        // ---------------------------------------------------------
        // Opaque 6510 Vector Ghost Trails (Mode 3 or Climax)
        // ---------------------------------------------------------
        const trailsActive = (this.renderMode === 3 || state === 'climax') && ag < 0.6 && state !== 'starting' && state !== 'stopping';
        if (trailsActive && this.trailValidCount > 0) {
            const tCount = Math.min(2, this.trailValidCount);
            for (let tr = tCount - 1; tr >= 0; tr--) {
                const trailPts = this.trailFrames[tr];
                const trailCol = tr === 1 ? PAL[11] : PAL[6];
                for (let i = 0; i < maxVisibleEdges; i++) {
                    const edge = STAR_EDGES[i];
                    const p0 = trailPts[edge[0]];
                    const p1 = trailPts[edge[1]];
                    drawClippedLine(ctx, p0.x, p0.y, p1.x, p1.y, w, h, trailCol, false);
                }
            }
        }

        // ---------------------------------------------------------
        // 2-Pass Fake Z-Buffer & Y-Raster-Interrupt Rendering
        // ---------------------------------------------------------
        const flashActive = this.flashAge < 0.09 && this.flashPeak > 0.3 && ag < 0.4;
        const activeRaster = ag > 0.5 ? AFTERGLOW_RASTER : RASTER_PALETTES[this.paletteIndex];
        const backCol = flashActive ? PAL[15] : (ag > 0.5 ? PAL[0] : PAL[11]);
        const rasterScroll = Math.floor(this.pathT * (0.5 + 0.3 * sidMid));
        const bandHeight = Math.max(6, Math.floor(h / 16));

        // PASS 1: Back edges (avgZ > 0)
        for (let i = 0; i < maxVisibleEdges; i++) {
            const edge = STAR_EDGES[i];
            const avgZ = (this.rotated[edge[0]].z + this.rotated[edge[1]].z) * 0.5;
            if (avgZ > 0) {
                const p0 = this.projected[edge[0]];
                const p1 = this.projected[edge[1]];
                drawClippedLine(ctx, p0.x, p0.y, p1.x, p1.y, w, h, backCol, false);
            }
        }

        // PASS 2: Front edges (avgZ <= 0) with Y-Raster-Interrupt splits
        const thickFront = (this.renderMode === 2 || state === 'climax') && minDim >= 100 && ag < 0.5;
        for (let i = 0; i < maxVisibleEdges; i++) {
            const edge = STAR_EDGES[i];
            const avgZ = (this.rotated[edge[0]].z + this.rotated[edge[1]].z) * 0.5;
            if (avgZ <= 0) {
                const p0 = this.projected[edge[0]];
                const p1 = this.projected[edge[1]];

                let color;
                if (flashActive) {
                    color = this.flashPeak >= 0.66 ? PAL[1] : PAL[7];
                } else if (i < 12 && (state === 'climax' || tension > 0.6) && ag < 0.4) {
                    // Inner control cube glows in contrasting amber/yellow during high energy
                    color = pulse > 0.4 ? PAL[1] : PAL[7];
                } else {
                    const midY = Math.floor((p0.y + p1.y) * 0.5);
                    const rawIdx = Math.floor((midY + rasterScroll) / bandHeight);
                    const rIdx = ((rawIdx % activeRaster.length) + activeRaster.length) % activeRaster.length;
                    color = PAL[activeRaster[rIdx]];
                }

                const useThick = thickFront && avgZ < -0.25;
                drawClippedLine(ctx, p0.x, p0.y, p1.x, p1.y, w, h, color, useThick);
            }
        }

        // ---------------------------------------------------------
        // Outer Spike Vertex Nodes (SID Voice 3 Highs / Mode 1 / Climax)
        // ---------------------------------------------------------
        if ((this.renderMode === 1 || sidHigh > 0.45 || state === 'climax') && ag < 0.65 && maxVisibleEdges > 12) {
            const nodeSize = (beatImpulse > 0.55 || this.renderMode === 1) && minDim >= 80 ? 2 : 1;
            const nodeCol = flashActive ? PAL[1] : (sidHigh > 0.7 ? PAL[7] : PAL[3]);
            ctx.fillStyle = nodeCol;
            for (let i = 8; i < BASE_VERTICES.length; i++) {
                if (this.rotated[i].z <= 0.15) {
                    const p = this.projected[i];
                    fillClippedRect(ctx, p.x - (nodeSize >> 1), p.y - (nodeSize >> 1), nodeSize, nodeSize, w, h);
                }
            }
        }

        // Update trail ring buffer at ~25Hz cadence
        this.trailAccum += dt;
        if (this.trailAccum >= 0.04) {
            this.trailAccum = 0;
            for (let i = 0; i < BASE_VERTICES.length; i++) {
                this.trailFrames[1][i].x = this.trailFrames[0][i].x;
                this.trailFrames[1][i].y = this.trailFrames[0][i].y;
                this.trailFrames[0][i].x = this.projected[i].x;
                this.trailFrames[0][i].y = this.projected[i].y;
            }
            if (this.trailValidCount < 2) this.trailValidCount++;
        }
    }
}