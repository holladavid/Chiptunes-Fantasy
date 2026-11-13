// === js/visuals/dse/atari/dot-torus.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: ATARI ST 3D DOT TORUS
// 100% Sinus-LUT-driven 3D torus with 9-bit Shifter palette
// cycling, depth-cued 1x1 / 2x2 ST pixel passes, beat-synced
// Shifter knot morphing, opaque ghost dots & strict clipping.
// =========================================================

import { quantizeAtari9Bit, rgbToHex } from '../../utils/hardware-constraints.js';

const TRANSITION_DURATION = 1.1;
const U_STEPS = 32;
const V_STEPS = 10;
const NUM_DOTS = U_STEPS * V_STEPS;

// 256-entry fixed-point style sine/cosine LUT
const SIN_LUT = new Float32Array(256);
const COS_LUT = new Float32Array(256);
for (let i = 0; i < 256; i++) {
    const angle = (i / 256) * Math.PI * 2;
    SIN_LUT[i] = Math.sin(angle);
    COS_LUT[i] = Math.cos(angle);
}

// Precompute all 512 Atari ST 9-bit RGB hex colors (8x8x8)
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

// 4 curated 16-color Atari ST Shifter cycling ramps + Midnight Steel afterglow
const SHIFTER_PALETTES = Object.freeze([
    // 0: Atari Union Fire & Magenta
    Object.freeze([
        [0, 0, 72], [0, 0, 144], [72, 0, 144], [144, 0, 144],
        [216, 0, 144], [252, 0, 108], [252, 72, 0], [252, 144, 0],
        [252, 216, 0], [252, 252, 108], [252, 252, 252], [252, 252, 108],
        [252, 180, 0], [216, 36, 108], [108, 0, 108], [0, 0, 108]
    ].map(([r, g, b]) => quantHex(r, g, b))),
    // 1: ST Cyber Cyan & Emerald
    Object.freeze([
        [0, 36, 72], [0, 72, 144], [0, 144, 180], [0, 216, 216],
        [108, 252, 252], [252, 252, 252], [144, 252, 180], [36, 216, 108],
        [0, 144, 72], [0, 108, 108], [0, 180, 216], [108, 216, 252],
        [252, 252, 252], [72, 180, 216], [0, 108, 180], [0, 36, 108]
    ].map(([r, g, b]) => quantHex(r, g, b))),
    // 2: TCB Chrome & Copper
    Object.freeze([
        [36, 36, 72], [72, 72, 108], [108, 108, 144], [180, 180, 216],
        [252, 252, 252], [252, 216, 144], [252, 144, 72], [216, 72, 36],
        [144, 36, 36], [180, 108, 72], [252, 180, 108], [252, 252, 216],
        [180, 180, 180], [108, 108, 144], [72, 72, 108], [36, 36, 72]
    ].map(([r, g, b]) => quantHex(r, g, b))),
    // 3: Hyper Acid Plasma
    Object.freeze([
        [72, 0, 108], [144, 0, 180], [216, 36, 216], [252, 108, 180],
        [252, 216, 72], [252, 252, 252], [180, 252, 108], [72, 252, 180],
        [36, 180, 252], [72, 72, 252], [144, 36, 216], [216, 72, 252],
        [252, 180, 252], [144, 108, 252], [72, 36, 180], [36, 0, 108]
    ].map(([r, g, b]) => quantHex(r, g, b)))
]);

const AFTERGLOW_PALETTE = Object.freeze([
    [0, 0, 36], [0, 36, 72], [36, 36, 108], [36, 72, 144],
    [72, 108, 180], [108, 144, 216], [144, 180, 216], [108, 144, 180],
    [72, 108, 144], [36, 72, 108], [36, 36, 108], [0, 36, 72],
    [36, 72, 108], [72, 72, 144], [36, 36, 108], [0, 0, 72]
].map(([r, g, b]) => quantHex(r, g, b)));

const BACK_DIM_HEX = quantHex(36, 36, 108);
const GHOST_DIM_HEX = quantHex(36, 36, 72);
const HOTSPOT_HEX = quantHex(252, 252, 252);

const BEAT_ZOOMS = Object.freeze([1.0, 1.18, 0.84, 1.04, 1.14, 0.90]);

function clamp01(v) {
    if (!Number.isFinite(v)) return 0;
    return v < 0 ? 0 : (v > 1 ? 1 : v);
}

function readChannel(arr, idx, fallback) {
    if (!arr || idx >= arr.length) return fallback;
    return clamp01(arr[idx]);
}

function fillClippedDot(ctx, px, py, size, bufW, bufH) {
    let x0 = px | 0;
    let y0 = py | 0;
    let x1 = x0 + size;
    let y1 = y0 + size;
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

export class AtariDotTorus {
    constructor() {
        this.name = 'Atari Dot Torus';

        this.uSteps = U_STEPS;
        this.vSteps = V_STEPS;
        this.numDots = NUM_DOTS;
        this.radiusMain = 1.0;
        this.tubeRadius = 0.38;

        // Time & state tracking
        this.lastT = null;
        this.lastState = 'idle';
        this.stateAge = 0;

        // Continuous rotation & Shifter cycling (modulo-wrapped floats -> symmetric axes!)
        this.rotPhaseX = 0;
        this.rotPhaseY = 0;
        this.rotPhaseZ = 0;
        this.speedX = 1.0;
        this.speedY = 1.4;
        this.speedZ = 0.6;
        this.smoothedSpeed = 1.0;

        this.orbitPhase = 0.0;
        this.twistPhase = 0.0;
        this.colorCycleAccum = 0.0;
        this.paletteOffset = 0;
        this.afterglowMix = 0.0;

        this.currentScale = 1.0;
        this.targetScale = 1.0;

        // Discrete beat-driven state
        this.beatIndex = 0;
        this.lastBeatCount = 0;
        this.paletteIndex = 0;
        this.morphMode = 0; // 0: Classic, 1: 3-Lobe Twist, 2: Spiral Tube, 3: Ghost Trail

        // Preallocated dot geometry and projected buffers (zero per-frame allocations)
        this.dots = new Array(NUM_DOTS);
        this.projected = new Array(NUM_DOTS);
        this.ghostX = new Int16Array(NUM_DOTS);
        this.ghostY = new Int16Array(NUM_DOTS);
        this.ghostValid = false;
        this.ghostAccum = 0;
        this.lastW = -1;
        this.lastH = -1;

        let idx = 0;
        for (let i = 0; i < U_STEPS; i++) {
            const uIdx = Math.floor((i / U_STEPS) * 256) & 255;
            const ringColor = Math.floor((i / U_STEPS) * 16) & 15;
            // Ordered prime-step rank for smooth non-clustered dot emergence
            const revealOrder = ((i * 7 + (i >> 1)) * 13) & 15;
            for (let j = 0; j < V_STEPS; j++) {
                const vIdx = Math.floor((j / V_STEPS) * 256) & 255;
                this.dots[idx] = {
                    u: uIdx,
                    v: vIdx,
                    colorIdx: ringColor,
                    revealRank: (revealOrder + j * 3) & 15
                };
                this.projected[idx] = { x: 0, y: 0, z: 0, colorIdx: ringColor };
                idx++;
            }
        }
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
            this.ghostValid = false; // Prevent stretched ghost dots on resize/rotation
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
            this.ghostValid = false;
        }

        if (state === 'idle') {
            this.lastT = safeT;
            this.lastState = 'idle';
            this.stateAge = 0;
            this.ghostValid = false;
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
        // Discrete Beat Choreography (strictly gated on beatStarted)
        // ---------------------------------------------------------
        const allowDiscrete = state !== 'afterglow' && state !== 'stopping';
        if (beatStarted) {
            const incomingCount = Number.isFinite(safeMetrics.beatCount)
                ? Math.floor(safeMetrics.beatCount)
                : (this.lastBeatCount + 1);

            if (incomingCount !== this.lastBeatCount || !Number.isFinite(safeMetrics.beatCount)) {
                this.lastBeatCount = incomingCount;
                this.beatIndex++;

                if (allowDiscrete) {
                    const zoomIdx = this.beatIndex % BEAT_ZOOMS.length;
                    this.targetScale = BEAT_ZOOMS[zoomIdx];

                    if ((this.beatIndex & 1) === 0) {
                        this.speedX = -this.speedX;
                    } else {
                        this.speedY = -this.speedY;
                    }

                    const shiftStep = beatLevel >= 3 ? 4 : (beatLevel === 2 ? 3 : 2);
                    this.paletteOffset = (this.paletteOffset + shiftStep) & 15;

                    if (incomingCount > 0) {
                        if (incomingCount % 4 === 0) {
                            this.paletteIndex = (this.paletteIndex + 1) % SHIFTER_PALETTES.length;
                        }
                        if (incomingCount % 8 === 0) {
                            if (state === 'buildup' || state === 'climax') {
                                this.morphMode = (this.morphMode + 1) % 4;
                            } else if (state === 'playing') {
                                this.morphMode = (this.morphMode + 1) % 2;
                            }
                        }
                    }
                }
            }
        }

        // ---------------------------------------------------------
        // Macro State Dynamics & Foreground-Safe Transitions
        // ---------------------------------------------------------
        let targetSpeed = 1.0 + tension * 0.45;
        let cycleRate = 3.0 + tension * 2.5 + ymMid * 2.0;
        let targetAfterglow = 0.0;
        let geoReveal = 1.0;
        let dotRankCutoff = 16;

        if (state === 'starting') {
            const prog = clamp01((this.stateAge + 0.08) / TRANSITION_DURATION);
            targetSpeed = 0.8;
            cycleRate = 2.0;
            geoReveal = 0.25 + 0.75 * prog;
            dotRankCutoff = Math.max(2, Math.ceil(prog * 16));
        } else if (state === 'stopping') {
            const prog = 1.0 - clamp01(this.stateAge / TRANSITION_DURATION);
            if (prog <= 0.01) return;
            targetSpeed = 0.5;
            cycleRate = 1.0;
            geoReveal = prog;
            dotRankCutoff = Math.max(0, Math.ceil(prog * 16));
            if (dotRankCutoff <= 0) return;
        } else if (state === 'playing') {
            targetSpeed = 0.95 + tension * 0.40;
            cycleRate = 3.0 + tension * 2.0 + ymMid * 1.5;
        } else if (state === 'buildup') {
            targetSpeed = 1.45 + tension * 0.65;
            cycleRate = 6.5 + tension * 3.5 + ymMid * 2.5;
        } else if (state === 'climax') {
            targetSpeed = 2.15 + tension * 0.75 + (isClimaxLocked ? 0.25 : 0);
            cycleRate = 11.0 + tension * 4.0 + ymMid * 3.0;
        } else if (state === 'afterglow') {
            targetSpeed = 0.30;
            cycleRate = 1.2;
            targetAfterglow = 1.0;
            this.targetScale = 0.90;
        }

        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * Math.min(1.0, dt * 4.5);
        this.afterglowMix += (targetAfterglow - this.afterglowMix) * Math.min(1.0, dt * 2.0);
        this.currentScale += (this.targetScale - this.currentScale) * Math.min(1.0, dt * 6.0);
        const ag = this.afterglowMix;

        // Time-based Shifter cycling (independent of call frequency)
        this.colorCycleAccum += dt * cycleRate;
        if (this.colorCycleAccum >= 1.0) {
            const steps = Math.floor(this.colorCycleAccum);
            this.colorCycleAccum -= steps;
            this.paletteOffset = (this.paletteOffset + steps) & 15;
        }

        // Smooth 3-axis phase accumulation (fixes dead Z-axis at 50Hz PAL!)
        const rotRate = 48.0 * this.smoothedSpeed * (1.0 + beatImpulse * 0.25);
        this.rotPhaseX = (((this.rotPhaseX + dt * rotRate * this.speedX) % 256) + 256) % 256;
        this.rotPhaseY = (((this.rotPhaseY + dt * rotRate * this.speedY) % 256) + 256) % 256;
        this.rotPhaseZ = (((this.rotPhaseZ + dt * rotRate * this.speedZ) % 256) + 256) % 256;

        const rotX = Math.floor(this.rotPhaseX) & 255;
        const rotY = Math.floor(this.rotPhaseY) & 255;
        const rotZ = Math.floor(this.rotPhaseZ) & 255;

        this.orbitPhase = (this.orbitPhase + dt * (0.65 + 0.35 * this.smoothedSpeed)) % (Math.PI * 2);
        this.twistPhase = (this.twistPhase + dt * (1.8 + 1.2 * this.smoothedSpeed)) % 256;

        const sinX = SIN_LUT[rotX];
        const cosX = COS_LUT[rotX];
        const sinY = SIN_LUT[rotY];
        const cosY = COS_LUT[rotY];
        const sinZ = SIN_LUT[rotZ];
        const cosZ = COS_LUT[rotZ];

        // ---------------------------------------------------------
        // Responsive Projection & Beat Scale Kick
        // ---------------------------------------------------------
        const minDim = Math.min(w, h);
        const beatScaleKick = beatImpulse * (state === 'afterglow' ? 0.04 : 0.16);
        const activeScale = this.currentScale * geoReveal * (1.0 + beatScaleKick);
        const fov = Math.max(10, minDim * 0.62);

        const activeTubeR = (this.tubeRadius + 0.08 * ymBass + 0.05 * beatImpulse) * (state === 'starting' ? geoReveal : 1.0);
        const maxExtent = (this.radiusMain + activeTubeR) * activeScale;
        const estMaxRadius = (maxExtent * fov) / 2.15;

        const roamAmpX = Math.max(0, w * 0.45 - estMaxRadius) * (0.35 + 0.65 * tension) * (1.0 - 0.6 * ag);
        const roamAmpY = Math.max(0, h * 0.45 - estMaxRadius) * (0.25 + 0.45 * ymMid) * (1.0 - 0.6 * ag);
        const cx = Math.floor(w * 0.5 + Math.sin(this.orbitPhase) * roamAmpX);
        const cy = Math.floor(h * 0.5 + Math.cos(this.orbitPhase * 0.7) * roamAmpY);

        const twistDepth = (this.morphMode === 1 || this.morphMode === 2 || state === 'climax')
            ? (0.12 + 0.16 * ymHigh + 0.10 * tension) * (1.0 - 0.7 * ag)
            : 0.0;
        const twistShift = Math.floor(this.twistPhase) & 255;

        for (let i = 0; i < this.numDots; i++) {
            const dot = this.dots[i];
            const cosV = COS_LUT[dot.v];
            const sinV = SIN_LUT[dot.v];
            const cosU = COS_LUT[dot.u];
            const sinU = SIN_LUT[dot.u];

            let localTube = activeTubeR;
            let localMain = this.radiusMain;
            if (twistDepth > 0.01) {
                const waveIdx = (dot.u * 3 + twistShift) & 255;
                if (this.morphMode === 2) {
                    localTube *= 1.0 + SIN_LUT[(dot.u * 2 + dot.v + twistShift) & 255] * twistDepth * 1.4;
                } else {
                    localMain += SIN_LUT[waveIdx] * twistDepth;
                }
            }

            const baseR = localMain + localTube * cosV;
            const lx = baseR * cosU;
            const ly = baseR * sinU;
            const lz = localTube * sinV;

            const y1 = ly * cosX - lz * sinX;
            const z1 = ly * sinX + lz * cosX;

            const x2 = lx * cosY + z1 * sinY;
            const z2 = -lx * sinY + z1 * cosY;

            const x3 = x2 * cosZ - y1 * sinZ;
            const y3 = x2 * sinZ + y1 * cosZ;

            const zOff = Math.max(1.4, z2 + 3.5);
            const p = this.projected[i];
            p.x = Math.floor(cx + (x3 * fov) / zOff * activeScale);
            p.y = Math.floor(cy + (y3 * fov) / zOff * activeScale);
            p.z = z2;
            p.colorIdx = dot.colorIdx;
        }

        // ---------------------------------------------------------
        // Ghost Trail Pass (Mode 3 or Climax, 100% opaque)
        // ---------------------------------------------------------
        const showGhost = (this.morphMode === 3 || state === 'climax') && ag < 0.5 && state !== 'starting' && state !== 'stopping';
        if (showGhost && this.ghostValid) {
            ctx.fillStyle = GHOST_DIM_HEX;
            for (let i = 0; i < this.numDots; i++) {
                if (this.dots[i].revealRank >= dotRankCutoff) continue;
                fillClippedDot(ctx, this.ghostX[i], this.ghostY[i], 1, w, h);
            }
        }

        // ---------------------------------------------------------
        // 2-Pass Depth-Cued Atari ST Shifter Rendering (strictly clipped)
        // ---------------------------------------------------------
        const isCool = ag > 0.5;
        const activePal = isCool ? AFTERGLOW_PALETTE : SHIFTER_PALETTES[this.paletteIndex];
        const frontDotSize = minDim < 80 ? 1 : 2;
        const hotspotZThresh = -0.65 + 0.30 * beatImpulse + 0.18 * ymHigh;

        // Pass 1: Back hemisphere (z > 0) as sharp 1x1 ST background dots
        for (let i = 0; i < this.numDots; i++) {
            if (this.dots[i].revealRank >= dotRankCutoff) continue;
            const p = this.projected[i];
            if (p.z <= 0) continue;

            if (isCool) {
                ctx.fillStyle = GHOST_DIM_HEX;
            } else {
                const cIdx = (p.colorIdx + this.paletteOffset) & 15;
                ctx.fillStyle = (cIdx & 1) === 0 ? BACK_DIM_HEX : activePal[cIdx];
            }
            fillClippedDot(ctx, p.x, p.y, 1, w, h);
        }

        // Pass 2: Front hemisphere (z <= 0) as crisp 2x2 Shifter blocks
        for (let i = 0; i < this.numDots; i++) {
            if (this.dots[i].revealRank >= dotRankCutoff) continue;
            const p = this.projected[i];
            if (p.z > 0) continue;

            if (!isCool && (p.z < -0.95 + hotspotZThresh * 0.4) && (beatImpulse > 0.45 || pulse > 0.5 || ymHigh > 0.7)) {
                ctx.fillStyle = HOTSPOT_HEX;
            } else {
                const cIdx = (p.colorIdx + this.paletteOffset) & 15;
                ctx.fillStyle = activePal[cIdx];
            }
            fillClippedDot(ctx, p.x, p.y, frontDotSize, w, h);
        }

        // Snapshot ghost dots at ~25Hz cadence
        this.ghostAccum += dt;
        if (this.ghostAccum >= 0.04) {
            this.ghostAccum = 0;
            for (let i = 0; i < this.numDots; i++) {
                this.ghostX[i] = this.projected[i].x;
                this.ghostY[i] = this.projected[i].y;
            }
            this.ghostValid = true;
        }
    }
}