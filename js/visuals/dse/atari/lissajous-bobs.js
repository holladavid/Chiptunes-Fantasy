// === js/visuals/dse/atari/lissajous-bobs.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: ATARI ST LISSAJOUS METAL-BOBS
// 100% DOM-free 9-bit RGB software sprites using precomputed
// scanline circle LUTs, symmetric 4-quadrant kaleidoscope
// mirroring, 3D chain-wave sizing, beat-synced choreography
// & foreground-safe geometric transitions.
// =========================================================

import { quantizeAtari9Bit, rgbToHex } from '../../utils/hardware-constraints.js';

const TWO_PI = Math.PI * 2;
const TRANSITION_DURATION = 1.1;
const NUM_BOBS = 48;

// Precomputed half-width scanlines for integer circle radii 1..10 (zero sqrt in loop)
const CIRCLE_HALF_WIDTHS = (() => {
    const tables = [null];
    for (let r = 1; r <= 10; r++) {
        const hw = new Int8Array(r * 2 + 1);
        const rSq = r * r;
        for (let dy = -r; dy <= r; dy++) {
            hw[dy + r] = Math.floor(Math.sqrt(Math.max(0, rSq - dy * dy)));
        }
        tables.push(hw);
    }
    return Object.freeze(tables);
})();

function quantHex(r, g, b) {
    const [qr, qg, qb] = quantizeAtari9Bit(r, g, b);
    return rgbToHex(qr, qg, qb);
}

// Strict Atari ST 9-bit RGB 4-ring metal palettes + Midnight Chrome afterglow
const METAL_PALETTES = Object.freeze({
    green: Object.freeze([
        quantHex(0, 36, 0),
        quantHex(0, 144, 0),
        quantHex(108, 252, 108),
        quantHex(252, 252, 252)
    ]),
    cyan: Object.freeze([
        quantHex(0, 36, 108),
        quantHex(0, 144, 180),
        quantHex(108, 216, 252),
        quantHex(252, 252, 252)
    ]),
    magenta: Object.freeze([
        quantHex(72, 0, 72),
        quantHex(144, 0, 144),
        quantHex(252, 108, 252),
        quantHex(252, 252, 252)
    ]),
    gold: Object.freeze([
        quantHex(72, 36, 0),
        quantHex(180, 72, 0),
        quantHex(252, 180, 0),
        quantHex(252, 252, 252)
    ]),
    afterglow: Object.freeze([
        quantHex(0, 0, 36),
        quantHex(36, 72, 108),
        quantHex(108, 144, 180),
        quantHex(180, 216, 252)
    ])
});

const PALETTE_KEYS = Object.freeze(['green', 'cyan', 'magenta', 'gold']);

// Choreography formations (ratios, base scale, symmetry mode, palette)
const BOB_FORMATIONS = Object.freeze([
    { ratioX: 2, ratioY: 3, scale: 0.92, mirror: 0, palette: 'green' },   // 2:3 Classic Star
    { ratioX: 1, ratioY: 1, scale: 1.04, mirror: 0, palette: 'cyan' },    // 1:1 Orbital Ring
    { ratioX: 1, ratioY: 2, scale: 0.92, mirror: 1, palette: 'magenta' }, // 1:2 Symmetric DNA Helix
    { ratioX: 5, ratioY: 4, scale: 0.78, mirror: 0, palette: 'gold' },    // 5:4 Trefoil Knot
    { ratioX: 3, ratioY: 4, scale: 0.96, mirror: 2, palette: 'green' },   // 3:4 Symmetric Twin Wave
    { ratioX: 0, ratioY: 0, scale: 0.88, mirror: 3, palette: 'magenta' }  // 4-Quadrant Radial Burst
]);

function clamp01(v) {
    if (!Number.isFinite(v)) return 0;
    return v < 0 ? 0 : (v > 1 ? 1 : v);
}

function readChannel(arr, idx, fallback) {
    if (!arr || idx >= arr.length) return fallback;
    return clamp01(arr[idx]);
}

function fillClippedCircleLUT(ctx, cx, cy, r, colorHex, bufW, bufH) {
    const ri = r | 0;
    if (ri <= 0 || ri >= CIRCLE_HALF_WIDTHS.length) return;
    const icx = Math.floor(cx);
    const icy = Math.floor(cy);
    if (icx + ri < 0 || icx - ri >= bufW || icy + ri < 0 || icy - ri >= bufH) {
        return;
    }
    const hw = CIRCLE_HALF_WIDTHS[ri];
    ctx.fillStyle = colorHex;
    for (let dy = -ri; dy <= ri; dy++) {
        const py = icy + dy;
        if (py < 0 || py >= bufH) continue;
        const dx = hw[dy + ri];
        if (dx <= 0) continue;
        const x0 = Math.max(0, icx - dx);
        const x1 = Math.min(bufW, icx + dx);
        const cw = x1 - x0;
        if (cw > 0) {
            ctx.fillRect(x0, py, cw, 1);
        }
    }
}

function drawMetalBob(ctx, x, y, radius, palette, bufW, bufH, highlightBoost = false) {
    const r0 = Math.max(1, Math.min(9, radius | 0));
    if (r0 <= 1) {
        const px = Math.floor(x);
        const py = Math.floor(y);
        if (px >= 0 && px < bufW && py >= 0 && py < bufH) {
            ctx.fillStyle = palette[2];
            ctx.fillRect(px, py, 1, 1);
        }
        return;
    }

    const r1 = Math.max(1, Math.round(r0 * 0.74));
    const r2 = Math.max(1, Math.round(r0 * 0.48));
    const r3 = Math.max(1, Math.round(r0 * 0.24));

    fillClippedCircleLUT(ctx, x, y, r0, palette[0], bufW, bufH);
    fillClippedCircleLUT(ctx, x, y, r1, highlightBoost ? palette[2] : palette[1], bufW, bufH);
    fillClippedCircleLUT(ctx, x, y, r2, highlightBoost ? palette[3] : palette[2], bufW, bufH);
    fillClippedCircleLUT(ctx, x, y, r3, palette[3], bufW, bufH);

    // Upper-left specular gleam inside core
    const gx = Math.floor(x - Math.max(1, r0 >> 2));
    const gy = Math.floor(y - Math.max(1, r0 >> 2));
    if (gx >= 0 && gx < bufW && gy >= 0 && gy < bufH) {
        ctx.fillStyle = palette[3];
        ctx.fillRect(gx, gy, 1, 1);
    }
}

export class AtariBobs {
    constructor() {
        this.name = 'Atari Lissajous Bobs';
        this.numBobs = NUM_BOBS;

        // Time & state tracking
        this.lastT = null;
        this.lastState = 'idle';
        this.stateAge = 0;

        // Continuous simulation accumulators (preserved across resize/rotation)
        this.internalT = 0.0;
        this.carrierPhase = 0.0;
        this.angleZ = 0.0;
        this.smoothedSpeed = 1.0;
        this.afterglowMix = 0.0;

        // Discrete beat-driven state
        this.stateIndex = 0;
        this.paletteShift = 0;
        this.beatCounter = 0;
        this.lastBeatCount = 0;
        this.rotDirection = 1;
        this.climaxMirror = 0;
        this.chainPulseAge = 10.0;
        this.chainPulsePeak = 0.0;

        // Preallocated quantized phase LUT for mechanical ST stutter wave
        this.phaseLUT = new Float32Array(NUM_BOBS);
        for (let i = 0; i < NUM_BOBS; i++) {
            this.phaseLUT[i] = Math.round(Math.sin((i / NUM_BOBS) * TWO_PI) * 4) * 0.25;
        }
    }

    resize() {
        // Coordinates and bob radii scale dynamically from width/height;
        // internalT, carrierPhase, angleZ and stateIndex stay continuous.
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
                this.beatCounter++;
                this.climaxMirror = this.beatCounter & 3;

                // Trigger highlight wave along the 48-bob chain
                this.chainPulseAge = 0;
                const levelWeight = beatLevel >= 3 ? 1.0 : (beatLevel === 2 ? 0.65 : (beatLevel === 1 ? 0.35 : 0.0));
                this.chainPulsePeak = Math.max(beatStrength, levelWeight);

                if (allowDiscrete && incomingCount > 0) {
                    if (incomingCount % 4 === 0) {
                        this.rotDirection *= -1;
                        this.paletteShift = (this.paletteShift + 1) % PALETTE_KEYS.length;
                    }
                    if (incomingCount % 8 === 0) {
                        this.stateIndex = (this.stateIndex + 1) % BOB_FORMATIONS.length;
                    }
                }
            }
        }

        this.chainPulseAge = Math.min(10.0, this.chainPulseAge + dt);

        // ---------------------------------------------------------
        // Macro State Dynamics & Foreground-Safe Transitions
        // ---------------------------------------------------------
        let targetSpeed = 1.0 + tension * 0.45;
        let rotBaseSpeed = 0.18 + tension * 0.14;
        let targetAfterglow = 0.0;
        let bobRevealRatio = 1.0;
        let bobRadiusScale = 1.0;

        if (state === 'starting') {
            const prog = clamp01((this.stateAge + 0.08) / TRANSITION_DURATION);
            targetSpeed = 0.85;
            rotBaseSpeed = 0.14;
            bobRevealRatio = prog;
            bobRadiusScale = 0.35 + 0.65 * prog;
        } else if (state === 'stopping') {
            const prog = 1.0 - clamp01(this.stateAge / TRANSITION_DURATION);
            if (prog <= 0.01) return;
            targetSpeed = 0.50;
            rotBaseSpeed = 0.10;
            bobRevealRatio = prog;
            bobRadiusScale = prog;
        } else if (state === 'playing') {
            targetSpeed = 0.95 + tension * 0.40;
            rotBaseSpeed = 0.18 + tension * 0.12;
        } else if (state === 'buildup') {
            targetSpeed = 1.40 + tension * 0.55;
            rotBaseSpeed = 0.38 + tension * 0.28;
        } else if (state === 'climax') {
            targetSpeed = 2.0 + tension * 0.65 + (isClimaxLocked ? 0.25 : 0);
            rotBaseSpeed = 0.85 + tension * 0.30;
        } else if (state === 'afterglow') {
            targetSpeed = 0.30;
            rotBaseSpeed = 0.07;
            targetAfterglow = 1.0;
            bobRadiusScale = 0.88;
        }

        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * Math.min(1.0, dt * 4.5);
        this.afterglowMix += (targetAfterglow - this.afterglowMix) * Math.min(1.0, dt * 2.0);
        const ag = this.afterglowMix;

        this.angleZ = (this.angleZ + dt * rotBaseSpeed * this.rotDirection) % TWO_PI;
        const kineticScale = this.smoothedSpeed * (1.0 + tension * 0.45 + beatImpulse * (state === 'afterglow' ? 0.08 : 0.35));
        this.internalT = (this.internalT + dt * kineticScale) % 4096;
        this.carrierPhase = (this.carrierPhase + dt * (0.45 + 0.45 * ymMid) * this.smoothedSpeed) % TWO_PI;

        // ---------------------------------------------------------
        // Responsive Scale, Carrier Sweep & Palette Selection
        // ---------------------------------------------------------
        const activeFormation = BOB_FORMATIONS[this.stateIndex];
        const minDim = Math.min(w, h);
        const maxBobRadius = Math.max(2, Math.min(8, Math.floor(minDim * 0.042)));
        const safeMargin = maxBobRadius + 2;

        const beatExpand = 1.0 + beatImpulse * (state === 'afterglow' ? 0.05 : 0.20) + 0.10 * ymBass;
        const maxSafeR = Math.max(4, minDim * 0.44 - safeMargin);
        const radiusX = Math.min(maxSafeR, minDim * 0.34 * activeFormation.scale * beatExpand);
        const radiusY = Math.min(maxSafeR, minDim * 0.26 * activeFormation.scale * beatExpand);

        // Sweep across extra horizontal space in Ultrawide or vertical space in Portrait
        const carrierAmpX = Math.max(0, w * 0.46 - radiusX - safeMargin) * (0.45 + 0.55 * tension) * (1.0 - 0.65 * ag);
        const carrierAmpY = Math.max(0, h * 0.46 - radiusX - safeMargin) * (0.45 + 0.55 * tension) * (1.0 - 0.65 * ag);
        const cx = w * 0.5 + Math.sin(this.carrierPhase) * carrierAmpX;
        const cy = h * 0.5 + Math.cos(this.carrierPhase * 0.8) * carrierAmpY;

        const palKey = ag > 0.5
            ? 'afterglow'
            : PALETTE_KEYS[(PALETTE_KEYS.indexOf(activeFormation.palette) + this.paletteShift) % PALETTE_KEYS.length];
        const activePalette = METAL_PALETTES[palKey];

        const visibleBobs = Math.max(1, Math.min(NUM_BOBS, Math.ceil(NUM_BOBS * bobRevealRatio)));
        const cosZ = Math.cos(this.angleZ);
        const sinZ = Math.sin(this.angleZ);
        const phaseStep = TWO_PI / NUM_BOBS;

        // Traveling pulse index along the 48-bob chain
        const chainPulseActive = this.chainPulseAge < 0.7 && this.chainPulsePeak > 0.05 && ag < 0.6;
        const pulseHead = (this.chainPulseAge / 0.7) * NUM_BOBS;

        // Symmetric mirror mode (keeps full-screen balance instead of trapping in 1 quadrant)
        let activeMirror = activeFormation.mirror;
        if (state === 'climax') {
            activeMirror = this.climaxMirror;
        } else if (state === 'buildup' && tension > 0.6 && activeMirror === 0) {
            activeMirror = 1;
        }

        const warpGain = 1.0 + beatImpulse * (state === 'afterglow' ? 0.3 : 2.2) + pulse * 0.5;
        const explodeSpan = minDim * (0.14 + 0.24 * (0.5 + 0.5 * Math.sin(this.internalT * 6.0))) * beatExpand;

        for (let i = 0; i < visibleBobs; i++) {
            const phase = i * phaseStep + this.phaseLUT[i] * warpGain;

            let x;
            let y;
            if (activeFormation.ratioX === 0) {
                x = Math.sin(phase) * explodeSpan;
                y = Math.cos(phase) * explodeSpan;
            } else {
                x = Math.sin(this.internalT * activeFormation.ratioX + phase) * radiusX;
                y = Math.sin(this.internalT * activeFormation.ratioY + phase) * Math.cos(this.internalT * 0.5 + phase) * radiusY;
            }

            // True kaleidoscope mirroring across quadrants
            if (activeMirror === 1) {
                x = (i & 1) === 0 ? Math.abs(x) : -Math.abs(x);
            } else if (activeMirror === 2) {
                y = (i & 1) === 0 ? Math.abs(y) : -Math.abs(y);
            } else if (activeMirror === 3) {
                const q = i & 3;
                x = (q === 0 || q === 2) ? Math.abs(x) : -Math.abs(x);
                y = (q === 0 || q === 1) ? Math.abs(y) : -Math.abs(y);
            }

            const rotatedX = x * cosZ - y * sinZ;
            const rotatedY = x * sinZ + y * cosZ;

            // 3D depth-wave bob sizing along chain (modulated by YM High & beatImpulse)
            const depthWave = 0.78 + 0.22 * Math.sin(phase + this.internalT * 2.5);
            const ymScale = 0.88 + 0.22 * ymHigh + 0.12 * beatImpulse;
            const bobR = Math.max(1, Math.round(maxBobRadius * depthWave * ymScale * bobRadiusScale));

            const isPulseHit = chainPulseActive && Math.abs(i - pulseHead) < 3.5;
            drawMetalBob(
                ctx,
                cx + rotatedX,
                cy + rotatedY,
                isPulseHit ? Math.min(9, bobR + 1) : bobR,
                activePalette,
                w,
                h,
                isPulseHit
            );
        }
    }
}