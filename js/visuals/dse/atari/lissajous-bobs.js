// === js/visuals/dse/atari/lissajous-bobs.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: ATARI ST LISSAJOUS METAL-BOBS
// 100% DOM-free 9-bit RGB software sprites using precomputed
// 3D-shaded raytraced sphere scanline LUTs (zero sqrt in loop),
// true 3D (X,Y,Z) Lissajous/knot curves with Painter Z-sorting,
// opaque Climax echo-trails, cascading Midnight-Chrome afterglow,
// graded beat shockwaves & foreground-safe 1.5s transitions.
// =========================================================

import { quantizeAtari9Bit, rgbToHex } from '../../utils/hardware-constraints.js';

const TWO_PI = Math.PI * 2;
const T_IN = 1.5;
const T_OUT = 1.5;
const NUM_BOBS = 48;
const MAX_TRAIL_ECHOES = 16;
const MAX_BOB_R = 10;
const CAM_DIST = 3.2;

function quantHex(r, g, b) {
    const [qr, qg, qb] = quantizeAtari9Bit(r, g, b);
    return rgbToHex(qr, qg, qb);
}

const INK = quantHex(0, 0, 0);        // '#000000'
const WHITE = quantHex(252, 252, 252); // '#fcfcfc' (Max 9-Bit ST)

// Strict Atari ST 9-bit RGB 4-ring metal palettes + Midnight Chrome afterglow
// [0]=deep shadow, [1]=mid metal, [2]=bright sheen, [3]=hot specular core
const METAL_PALETTES = Object.freeze({
    green: Object.freeze([
        quantHex(0, 36, 0),
        quantHex(0, 144, 36),
        quantHex(72, 252, 108),
        WHITE
    ]),
    cyan: Object.freeze([
        quantHex(0, 36, 108),
        quantHex(0, 144, 180),
        quantHex(108, 216, 252),
        WHITE
    ]),
    magenta: Object.freeze([
        quantHex(72, 0, 72),
        quantHex(180, 0, 144),
        quantHex(252, 108, 216),
        WHITE
    ]),
    gold: Object.freeze([
        quantHex(108, 36, 0),
        quantHex(180, 72, 0),
        quantHex(252, 180, 36),
        WHITE
    ]),
    afterglow: Object.freeze([
        quantHex(0, 0, 36),
        quantHex(36, 72, 108),
        quantHex(108, 144, 180),
        quantHex(180, 216, 252)
    ])
});

const PALETTE_KEYS = Object.freeze(['green', 'cyan', 'magenta', 'gold']);

// Classic Atari ST 3D Bob Formations
// type: 'lissajous' | 'halo' | 'helix' | 'trefoil' | 'ribbon' | 'galaxy'
const BOB_FORMATIONS = Object.freeze([
    { type: 'lissajous', ratioX: 2, ratioY: 3, ratioZ: 2, scale: 0.94, palette: 'gold' },      // 3D Torus Lissajous
    { type: 'halo',      ratioX: 1, ratioY: 1, ratioZ: 2, scale: 1.00, palette: 'cyan' },      // Tilted 3D Orbital Crown
    { type: 'helix',     ratioX: 1, ratioY: 2, ratioZ: 1, scale: 0.94, palette: 'magenta' },   // Dual-Strand 3D DNA Helix
    { type: 'trefoil',   ratioX: 2, ratioY: 3, ratioZ: 3, scale: 0.88, palette: 'green' },     // 3D Trefoil Bob-Knot
    { type: 'ribbon',    ratioX: 1, ratioY: 2, ratioZ: 3, scale: 0.96, palette: 'cyan' },      // Infinity Wave Ribbon
    { type: 'galaxy',    ratioX: 4, ratioY: 4, ratioZ: 2, scale: 0.92, palette: 'magenta' }    // 4-Arm 3D Spiral Vortex
]);

// =========================================================
// PRECOMPUTED 3D RAYTRACED SPHERE SCANLINE-RUN LUT (r = 1..10)
// Tone codes: 0 = INK border, 1..4 = pal[0..3]
// =========================================================
const SPHERE_SPRITES = (() => {
    const sprites = [null];

    // Upper-left 45-deg light & specular half-vector
    const lx = -0.48, ly = -0.52, lz = 0.706;
    const hx = -0.34, hy = -0.37, hz = 0.864;

    for (let r = 1; r <= MAX_BOB_R; r++) {
        if (r === 1) {
            sprites.push(Object.freeze([
                Object.freeze({ dy: 0, x0: 0, w: 1, runs: Object.freeze([Object.freeze({ x0: 0, w: 1, tone: 3 })]) })
            ]));
            continue;
        }

        const rThresh = r === 2 ? 2.6 : (r * r + r * 0.42);
        const hasOutline = r >= 3;
        const rows = [];
        const gridW = r * 2 + 1;

        const inDisc = (dx, dy) => (dx * dx + dy * dy) <= rThresh;

        for (let dy = -r; dy <= r; dy++) {
            let xMin = gridW;
            let xMax = -gridW;
            const tones = new Int8Array(gridW);
            tones.fill(-1);

            for (let dx = -r; dx <= r; dx++) {
                if (!inDisc(dx, dy)) continue;
                if (dx < xMin) xMin = dx;
                if (dx > xMax) xMax = dx;

                const isEdge = hasOutline && (
                    !inDisc(dx - 1, dy) ||
                    !inDisc(dx + 1, dy) ||
                    !inDisc(dx, dy - 1) ||
                    !inDisc(dx, dy + 1)
                );

                if (isEdge) {
                    tones[dx + r] = 0;
                    continue;
                }

                const nx = dx / r;
                const ny = dy / r;
                const nz = Math.sqrt(Math.max(0.04, 1.0 - nx * nx - ny * ny));

                const ndotl = nx * lx + ny * ly + nz * lz;
                // Subtle metallic lower-right rim bounce
                const bounce = Math.max(0, -(nx * lx + ny * ly) * 0.30 * (1.0 - nz));
                const diffuse = Math.max(0, ndotl) * 0.85 + bounce;

                const ndoth = Math.max(0, nx * hx + ny * hy + nz * hz);
                const spec = Math.pow(ndoth, r <= 3 ? 10 : 15);

                let tone;
                if (spec > (r <= 3 ? 0.56 : 0.62)) {
                    tone = 4;
                } else if (diffuse > 0.54 || spec > 0.25) {
                    tone = 3;
                } else if (diffuse > 0.22) {
                    tone = 2;
                } else {
                    tone = 1;
                }
                tones[dx + r] = tone;
            }

            if (xMax < xMin) continue;

            // Compress interior tones >= 1 (base row span draws INK if hasOutline)
            const runs = [];
            let runTone = -1;
            let runStart = xMin;
            for (let dx = xMin; dx <= xMax; dx++) {
                const t = tones[dx + r];
                const emitTone = hasOutline ? (t === 0 ? -1 : t) : t;
                if (emitTone !== runTone) {
                    if (runTone !== -1) {
                        runs.push(Object.freeze({ x0: runStart, w: dx - runStart, tone: runTone }));
                    }
                    runTone = emitTone;
                    runStart = dx;
                }
            }
            if (runTone !== -1) {
                runs.push(Object.freeze({ x0: runStart, w: xMax + 1 - runStart, tone: runTone }));
            }

            rows.push(Object.freeze({
                dy,
                x0: xMin,
                w: xMax - xMin + 1,
                hasOutline,
                runs: Object.freeze(runs)
            }));
        }

        sprites.push(Object.freeze(rows));
    }

    return Object.freeze(sprites);
})();

function clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
}

function clamp01(v) {
    return Number.isFinite(v) ? clamp(v, 0, 1) : 0;
}

function readChannel(arr, idx, fallback) {
    if (!arr || idx >= arr.length) return fallback;
    return clamp01(arr[idx]);
}

function drawShadedBob(ctx, cx, cy, radius, palette, bufW, bufH, pulseTier = 0, echoDim = false) {
    const r = clamp(radius | 0, 1, MAX_BOB_R);
    const icx = Math.round(cx);
    const icy = Math.round(cy);

    if (icx + r < 0 || icx - r >= bufW || icy + r < 0 || icy - r >= bufH) {
        return;
    }

    const rows = SPHERE_SPRITES[r];
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const py = icy + row.dy;
        if (py < 0 || py >= bufH) continue;

        if (row.hasOutline && !echoDim) {
            const x0 = Math.max(0, icx + row.x0);
            const x1 = Math.min(bufW, icx + row.x0 + row.w);
            const cw = x1 - x0;
            if (cw > 0) {
                ctx.fillStyle = INK;
                ctx.fillRect(x0, py, cw, 1);
            }
        }

        const runs = row.runs;
        for (let j = 0; j < runs.length; j++) {
            const run = runs[j];
            const x0 = Math.max(0, icx + run.x0);
            const x1 = Math.min(bufW, icx + run.x0 + run.w);
            const cw = x1 - x0;
            if (cw <= 0) continue;

            let color;
            if (echoDim) {
                // Opaque dark echo trail shade (zero alpha)
                color = run.tone <= 2 ? INK : (run.tone === 3 ? palette[0] : palette[1]);
            } else {
                const idx = Math.min(3, (run.tone - 1) + pulseTier);
                color = palette[idx];
            }
            ctx.fillStyle = color;
            ctx.fillRect(x0, py, cw, 1);
        }
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
        this.tiltPhase = 0.0;
        this.smoothedSpeed = 1.0;
        this.afterglowMix = 0.0;

        // Discrete beat-driven state
        this.stateIndex = 0;
        this.paletteShift = 0;
        this.beatCounter = 0;
        this.lastBeatCount = -1;
        this.rotDirection = 1;
        this.climaxMirror = 0;
        this.chainPulseAge = 10.0;
        this.chainPulsePeak = 0.0;
        this.chainPulseLevel = 0;
        this.beatKickZ = 0.0;

        // Zero-GC 3D evaluation & Z-sort buffers
        this.bobX = new Float32Array(NUM_BOBS);
        this.bobY = new Float32Array(NUM_BOBS);
        this.bobZ = new Float32Array(NUM_BOBS);
        this.bobR = new Uint8Array(NUM_BOBS);
        this.bobPulseTier = new Uint8Array(NUM_BOBS);
        this.bobPalFlag = new Uint8Array(NUM_BOBS); // 0 = main, 1 = afterglow cascade
        this.sortOrder = new Uint8Array(NUM_BOBS);

        // Smooth harmonic modulation LUT along the chain (zero jagged clumping)
        this.waveLUT = new Float32Array(NUM_BOBS);
        for (let i = 0; i < NUM_BOBS; i++) {
            this.waveLUT[i] = Math.sin((i / NUM_BOBS) * TWO_PI * 3);
        }
    }

    resize() {
        // Coordinates and bob radii scale dynamically from width/height;
        // internalT, carrierPhase, angleZ and stateIndex stay continuous.
    }

    _evalFormationPoint(formation, i, count, simT, twinMirror) {
        const idx = twinMirror ? (i >> 1) : i;
        const nCount = twinMirror ? Math.max(1, count >> 1) : count;
        const u = (idx / nCount) * TWO_PI;

        let x = 0, y = 0, z = 0;
        switch (formation.type) {
            case 'halo': {
                x = Math.cos(u + simT * 0.9);
                y = Math.sin(u + simT * 0.9) * Math.cos(simT * 0.65);
                z = Math.sin(u + simT * 0.9) * Math.sin(simT * 0.65) + 0.25 * Math.cos(2 * u - simT);
                break;
            }
            case 'helix': {
                const strand = (idx & 1) === 0 ? 1 : -1;
                const hu = (Math.floor(idx / 2) / Math.max(1, Math.floor(nCount / 2))) * TWO_PI;
                x = Math.cos(hu * 2 + simT * 1.4) * 0.72 * strand;
                y = Math.sin(hu + simT * 0.45) * 0.92;
                z = Math.sin(hu * 2 + simT * 1.4) * 0.72 * strand;
                break;
            }
            case 'trefoil': {
                const r = 0.62 + 0.34 * Math.cos(3 * u + simT * 0.7);
                x = r * Math.cos(2 * u + simT * 0.55);
                y = r * Math.sin(2 * u + simT * 0.55);
                z = 0.75 * Math.sin(3 * u + simT * 0.7);
                break;
            }
            case 'ribbon': {
                x = Math.sin(u + simT * 0.85);
                y = Math.sin(2 * u - simT * 0.55) * 0.86;
                z = Math.cos(3 * u + simT * 0.65) * 0.78;
                break;
            }
            case 'galaxy': {
                const arm = idx & 3;
                const armFrac = Math.floor(idx / 4) / Math.max(1, Math.floor(nCount / 4));
                const ang = arm * (Math.PI * 0.5) + armFrac * 2.2 - simT * 1.1;
                const rad = 0.18 + armFrac * 0.82;
                x = Math.cos(ang) * rad;
                y = Math.sin(ang) * rad;
                z = Math.cos(armFrac * Math.PI * 2 - simT * 2.2) * 0.55;
                break;
            }
            default: { // 'lissajous' 2:3:2
                x = Math.sin(simT * 0.9 + u * formation.ratioX);
                y = Math.sin(simT * 0.7 + u * formation.ratioY) * 0.92;
                z = Math.cos(simT * 0.8 + u * formation.ratioZ) * 0.82;
                break;
            }
        }

        if (twinMirror && (i & 1) === 1) {
            x = -x;
            y = -y;
        }

        return [x, y, z];
    }

    render(ctx, width, height, t, state = 'playing', stateTime = 0, metrics = {}) {
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
        if (!Number.isFinite(dt) || dt < 0) {
            dt = 0.02;
        } else if (dt > 0.1) {
            dt = 0.1;
        }

        if (this.lastState !== state) {
            if (state === 'starting' && (this.lastState === 'idle' || this.lastState === 'stopping')) {
                this.lastBeatCount = -1;
            }
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
                : (this.lastBeatCount < 0 ? 1 : this.lastBeatCount + 1);

            if (incomingCount !== this.lastBeatCount) {
                this.lastBeatCount = incomingCount;
                this.beatCounter++;

                if (state !== 'afterglow' && state !== 'stopping') {
                    this.chainPulseAge = 0;
                    const resolvedLevel = (beatLevel >= 1 && beatLevel <= 3)
                        ? beatLevel
                        : (beatStrength >= 2 / 3 ? 3 : (beatStrength >= 1 / 3 ? 2 : (beatStrength > 0 ? 1 : 0)));
                    const levelWeight = resolvedLevel === 3 ? 1.0 : (resolvedLevel === 2 ? 0.6 : (resolvedLevel === 1 ? 0.25 : 0.0));
                    this.chainPulsePeak = Math.max(beatStrength, levelWeight);
                    this.chainPulseLevel = resolvedLevel;
                    this.beatKickZ = resolvedLevel === 3 ? 0.28 : (resolvedLevel === 2 ? 0.14 : 0.05);
                }

                if (allowDiscrete && incomingCount > 0) {
                    if (incomingCount % 4 === 0) {
                        this.rotDirection *= -1;
                        this.paletteShift = (this.paletteShift + 1) % PALETTE_KEYS.length;
                    }
                    if (incomingCount % 8 === 0) {
                        this.stateIndex = (this.stateIndex + 1) % BOB_FORMATIONS.length;
                        this.climaxMirror = (this.climaxMirror + 1) & 1;
                    }
                }
            }
        }

        this.chainPulseAge = Math.min(10.0, this.chainPulseAge + dt);
        this.beatKickZ *= Math.exp(-dt * 8.0);

        // ---------------------------------------------------------
        // Macro State Dynamics & Foreground-Safe 1.5s Transitions
        // ---------------------------------------------------------
        const safeStateTime = (state === 'starting' || state === 'stopping') && Number.isFinite(stateTime) && stateTime >= 0
            ? stateTime
            : this.stateAge;

        let targetSpeed = 1.0 + tension * 0.45;
        let rotBaseSpeed = 0.22 + tension * 0.18;
        let targetAfterglow = 0.0;
        let bobRevealRatio = 1.0;
        let bobRadiusScale = 1.0;

        if (state === 'starting') {
            const prog = clamp01(safeStateTime / T_IN);
            if (prog <= 0.001) return;
            targetSpeed = 0.85;
            rotBaseSpeed = 0.16;
            bobRevealRatio = prog;
            bobRadiusScale = 0.35 + 0.65 * prog;
        } else if (state === 'stopping') {
            const prog = 1.0 - clamp01(safeStateTime / T_OUT);
            if (prog <= 0.001) return;
            targetSpeed = 0.45;
            rotBaseSpeed = 0.10;
            bobRevealRatio = prog;
            bobRadiusScale = prog;
        } else if (state === 'playing') {
            targetSpeed = 0.90 + tension * 0.40;
            rotBaseSpeed = 0.20 + tension * 0.14;
        } else if (state === 'buildup') {
            targetSpeed = 1.35 + tension * 0.55;
            rotBaseSpeed = 0.42 + tension * 0.30;
        } else if (state === 'climax') {
            targetSpeed = 1.90 + tension * 0.65 + (isClimaxLocked ? 0.20 : 0);
            rotBaseSpeed = 0.78 + tension * 0.32;
        } else if (state === 'afterglow') {
            targetSpeed = 0.26;
            rotBaseSpeed = 0.06;
            targetAfterglow = 1.0;
            bobRadiusScale = 0.85;
        }

        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * Math.min(1.0, dt * 4.5);
        this.afterglowMix += (targetAfterglow - this.afterglowMix) * Math.min(1.0, dt * 2.2);
        const ag = this.afterglowMix;

        this.angleZ = (this.angleZ + dt * rotBaseSpeed * this.rotDirection) % TWO_PI;
        this.tiltPhase = (this.tiltPhase + dt * (0.28 + 0.22 * tension) * this.smoothedSpeed) % TWO_PI;
        const kineticScale = this.smoothedSpeed * (1.0 + tension * 0.35 + beatImpulse * (state === 'afterglow' ? 0.05 : 0.28));
        this.internalT = (this.internalT + dt * kineticScale) % 4096;
        this.carrierPhase = (this.carrierPhase + dt * (0.42 + 0.48 * ymMid) * this.smoothedSpeed) % TWO_PI;

        // ---------------------------------------------------------
        // Responsive 3D Bounds & Aspect-Aware Scale (Portrait & Ultrawide!)
        // ---------------------------------------------------------
        const activeFormation = BOB_FORMATIONS[this.stateIndex];
        const minDim = Math.min(w, h);
        const maxBobRadius = Math.max(2, Math.min(8, Math.floor(minDim * 0.040)));
        const safeMargin = maxBobRadius + 2;
        const maxPersp = 1.42;

        const beatExpand = 1.0 + beatImpulse * (state === 'afterglow' ? 0.04 : 0.16) + 0.12 * ymBass;
        const maxSpanX = Math.max(4, (w * 0.45 - safeMargin) / maxPersp);
        const maxSpanY = Math.max(4, (h * 0.45 - safeMargin) / maxPersp);

        const wideBlend = clamp01((w / Math.max(1, h) - 1.2) / 1.2);
        const tallBlend = clamp01((h / Math.max(1, w) - 1.2) / 1.2);

        const baseRadiusX = minDim * (0.34 + 0.22 * wideBlend) * activeFormation.scale * beatExpand;
        const baseRadiusY = minDim * (0.29 + 0.18 * tallBlend) * activeFormation.scale * beatExpand;
        const radiusX = Math.min(maxSpanX, Math.max(baseRadiusX, w * 0.28 * wideBlend));
        const radiusY = Math.min(maxSpanY, Math.max(baseRadiusY, h * 0.26 * tallBlend));

        const carrierAmpX = Math.max(0, w * 0.47 - radiusX * maxPersp - safeMargin) * (0.40 + 0.60 * tension) * (1.0 - 0.70 * ag);
        const carrierAmpY = Math.max(0, h * 0.47 - radiusY * maxPersp - safeMargin) * (0.40 + 0.60 * tension) * (1.0 - 0.70 * ag);
        const cx = w * 0.5 + Math.sin(this.carrierPhase) * carrierAmpX;
        const cy = h * 0.5 + Math.cos(this.carrierPhase * 0.75) * carrierAmpY;

        const palKey = PALETTE_KEYS[(PALETTE_KEYS.indexOf(activeFormation.palette) + this.paletteShift) % PALETTE_KEYS.length];
        const mainPalette = METAL_PALETTES[palKey];
        const afterglowPalette = METAL_PALETTES.afterglow;

        const visibleBobs = Math.max(1, Math.min(NUM_BOBS, Math.ceil(NUM_BOBS * bobRevealRatio)));

        // 3D Tilt & Rotation Matrices
        const cosZ = Math.cos(this.angleZ);
        const sinZ = Math.sin(this.angleZ);
        const tiltX = Math.sin(this.tiltPhase) * (state === 'afterglow' ? 0.22 : 0.55);
        const cosX = Math.cos(tiltX);
        const sinX = Math.sin(tiltX);

        // Graded traveling pulse wave along chain
        const pulseWindow = this.chainPulseLevel >= 3 ? 0.85 : (this.chainPulseLevel === 2 ? 0.68 : 0.50);
        const chainPulseActive = this.chainPulseAge < pulseWindow && this.chainPulsePeak > 0.05 && ag < 0.7;
        const pulseHead = (this.chainPulseAge / pulseWindow) * NUM_BOBS;
        const pulseHalfWidth = 2.0 + this.chainPulsePeak * 5.0; // soft ~3.2, medium ~5.0, hard ~7.0

        const useTwinMirror = state === 'climax' || (state === 'buildup' && tension > 0.68);
        const rippleAmp = (0.04 + beatImpulse * 0.09 + pulse * 0.04) * (1.0 - 0.75 * ag);

        // =========================================================
        // 1. OPAQUE CLIMAX ECHO-TRAILS (Zero Alpha, Drawn Behind)
        // =========================================================
        if ((state === 'climax' || (state === 'buildup' && tension > 0.75)) && ag < 0.5 && visibleBobs >= 8) {
            const echoT = this.internalT - 0.09;
            const echoStep = Math.max(1, Math.floor(visibleBobs / MAX_TRAIL_ECHOES));
            for (let i = 0; i < visibleBobs; i += echoStep) {
                const [ex0, ey0, ez0] = this._evalFormationPoint(activeFormation, i, visibleBobs, echoT, useTwinMirror);
                const ey1 = ey0 * cosX - ez0 * sinX;
                const ez1 = ey0 * sinX + ez0 * cosX;
                const ex2 = ex0 * cosZ - ey1 * sinZ;
                const ey2 = ex0 * sinZ + ey1 * cosZ;
                const ePersp = CAM_DIST / Math.max(1.2, CAM_DIST - ez1);
                const er = Math.max(2, Math.round(maxBobRadius * 0.72 * ePersp * bobRadiusScale) - 1);
                drawShadedBob(
                    ctx,
                    cx + ex2 * radiusX * ePersp,
                    cy + ey2 * radiusY * ePersp,
                    er,
                    mainPalette,
                    w,
                    h,
                    0,
                    true
                );
            }
        }

        // =========================================================
        // 2. EVALUATE 3D POSITIONS & SORT FAR -> NEAR (ZERO-GC)
        // =========================================================
        for (let i = 0; i < visibleBobs; i++) {
            const [px0, py0, pz0] = this._evalFormationPoint(activeFormation, i, visibleBobs, this.internalT, useTwinMirror);

            // Smooth standing wave ripple along the curve (zero jagged clumping)
            const waveOffset = this.waveLUT[i] * rippleAmp;
            const xw = px0 * (1.0 + waveOffset);
            const yw = py0 * (1.0 - waveOffset * 0.5);
            const zw = pz0 + this.beatKickZ * Math.cos((i / visibleBobs) * TWO_PI);

            // 3D pitch + roll
            const y1 = yw * cosX - zw * sinX;
            const z1 = yw * sinX + zw * cosX;
            const x2 = xw * cosZ - y1 * sinZ;
            const y2 = xw * sinZ + y1 * cosZ;

            const persp = CAM_DIST / Math.max(1.2, CAM_DIST - z1);

            let pulseTier = 0;
            let pulseRadiusBoost = 0;
            if (chainPulseActive) {
                const dist = Math.abs(i - pulseHead);
                if (dist < pulseHalfWidth) {
                    const hitStrength = (1.0 - dist / pulseHalfWidth) * this.chainPulsePeak;
                    if (hitStrength > 0.62) {
                        pulseTier = 2;
                        pulseRadiusBoost = 2;
                    } else if (hitStrength > 0.16) {
                        pulseTier = 1;
                        pulseRadiusBoost = 1;
                    }
                }
            }

            const ymScale = 0.84 + 0.24 * ymHigh + 0.14 * beatImpulse;
            const rawR = maxBobRadius * (0.72 + 0.36 * (persp - 0.70) / 0.72) * ymScale * bobRadiusScale + pulseRadiusBoost;

            this.bobX[i] = cx + x2 * radiusX * persp;
            this.bobY[i] = cy + y2 * radiusY * persp;
            this.bobZ[i] = z1;
            this.bobR[i] = clamp(Math.round(rawR), 1, MAX_BOB_R);
            this.bobPulseTier[i] = pulseTier;
            // Cascading Midnight-Chrome transition along chain during afterglow
            this.bobPalFlag[i] = (i / Math.max(1, visibleBobs)) < ag ? 1 : 0;
            this.sortOrder[i] = i;
        }

        // Insertion sort by Z ascending (farthest first -> nearest on top)
        for (let a = 1; a < visibleBobs; a++) {
            const keyIdx = this.sortOrder[a];
            const keyZ = this.bobZ[keyIdx];
            let b = a - 1;
            while (b >= 0 && this.bobZ[this.sortOrder[b]] > keyZ) {
                this.sortOrder[b + 1] = this.sortOrder[b];
                b--;
            }
            this.sortOrder[b + 1] = keyIdx;
        }

        // =========================================================
        // 3. RASTER SHADED 3D BOBS BACK-TO-FRONT
        // =========================================================
        for (let s = 0; s < visibleBobs; s++) {
            const idx = this.sortOrder[s];
            const pal = this.bobPalFlag[idx] ? afterglowPalette : mainPalette;
            drawShadedBob(
                ctx,
                this.bobX[idx],
                this.bobY[idx],
                this.bobR[idx],
                pal,
                w,
                h,
                this.bobPulseTier[idx],
                false
            );
        }
    }
}