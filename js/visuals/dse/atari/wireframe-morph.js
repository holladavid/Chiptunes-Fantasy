// === js/visuals/dse/atari/wireframe-morph.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: ATARI 3D WIREFRAME MORPH
// 68000er Demo-Tribut: Morphing 3D-Cube <-> 14-Vert-Stella-Star
// mit gegenlaeufigem 4D-Tesseract-Kern, Z-Painter-Edge-Sort,
// 9-Bit Shifter-Themen, themen-treuen Opaque-Ghost-Trails,
// Kontrast-Schatten, Stern-Crosshairs & Lissajous-Flugbahn.
// =========================================================

import {
    drawAliasedLineClipped,
    quantizeAtari9Bit,
    rgbToHex
} from '../../utils/hardware-constraints.js';

const TWO_PI = Math.PI * 2;
const TRANSITION_DURATION = 1.5;
const CAM_Z = 4.15;
const MAX_TRAILS = 3;
const MAX_EDGES = 48; // 24 Star + 12 Morph-Cube + 12 Counter-HyperCore

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

const INK = quantHex(0, 0, 0);

// 4 kuratierte Atari ST 9-Bit Vector-Paletten inkl. themen-passender Trails
const WIREFRAME_THEMES = Object.freeze([
    Object.freeze({
        // 0: Acid Phosphor & Solar Gold
        back: quantHex(0, 72, 0),
        mid: quantHex(0, 180, 36),
        front: quantHex(108, 252, 72),
        node: quantHex(252, 252, 252),
        inner: quantHex(252, 216, 0),
        innerBack: quantHex(108, 72, 0),
        trails: Object.freeze([quantHex(0, 108, 36), quantHex(0, 72, 0), quantHex(0, 36, 0)])
    }),
    Object.freeze({
        // 1: Cyber Cyan & Copper Amber
        back: quantHex(0, 36, 108),
        mid: quantHex(0, 144, 216),
        front: quantHex(108, 252, 252),
        node: quantHex(252, 252, 252),
        inner: quantHex(252, 144, 0),
        innerBack: quantHex(108, 36, 0),
        trails: Object.freeze([quantHex(0, 108, 180), quantHex(0, 72, 108), quantHex(0, 36, 72)])
    }),
    Object.freeze({
        // 2: Inferno Gold & Crimson Rose
        back: quantHex(108, 36, 0),
        mid: quantHex(216, 108, 0),
        front: quantHex(252, 216, 72),
        node: quantHex(252, 252, 252),
        inner: quantHex(252, 72, 144),
        innerBack: quantHex(108, 0, 72),
        trails: Object.freeze([quantHex(180, 72, 0), quantHex(108, 36, 0), quantHex(72, 0, 0)])
    }),
    Object.freeze({
        // 3: Laser Magenta & Ice Cyan
        back: quantHex(72, 0, 108),
        mid: quantHex(180, 36, 216),
        front: quantHex(252, 108, 252),
        node: quantHex(252, 252, 180),
        inner: quantHex(72, 252, 252),
        innerBack: quantHex(0, 72, 108),
        trails: Object.freeze([quantHex(144, 0, 180), quantHex(108, 0, 108), quantHex(36, 0, 72)])
    })
]);

const AFTERGLOW_THEME = Object.freeze({
    back: quantHex(0, 36, 72),
    mid: quantHex(36, 108, 144),
    front: quantHex(144, 180, 216),
    node: quantHex(216, 252, 252),
    inner: quantHex(72, 108, 180),
    innerBack: quantHex(36, 36, 108),
    trails: Object.freeze([quantHex(36, 72, 108), quantHex(0, 36, 72), quantHex(0, 0, 36)])
});

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

function drawTipCrosshair(ctx, x, y, arm, color, coreColor, bufW, bufH) {
    if (arm <= 0) {
        ctx.fillStyle = color;
        fillClippedRect(ctx, x, y, 1, 1, bufW, bufH);
        return;
    }
    ctx.fillStyle = color;
    fillClippedRect(ctx, x - arm, y, arm * 2 + 1, 1, bufW, bufH);
    fillClippedRect(ctx, x, y - arm, 1, arm * 2 + 1, bufW, bufH);
    if (coreColor && arm >= 2) {
        ctx.fillStyle = coreColor;
        fillClippedRect(ctx, x, y, 1, 1, bufW, bufH);
    }
}

export class WireframeMorph {
    constructor() {
        this.name = 'Atari Wireframe Morph';

        // Time & state tracking
        this.lastT = null;
        this.lastState = 'idle';
        this.stateAge = 0;

        // Preallocated vertex, core & trail buffers (Zero-GC)
        this.vertices = Array.from({ length: 14 }, () => ({ x: 0, y: 0, z: 0 }));
        this.rotatedZ = new Float32Array(14);
        this.projected = Array.from({ length: 14 }, () => ({ x: 0, y: 0 }));

        // Counter-rotating inner 4D Hyper-Core (8 vertices)
        this.coreRotatedZ = new Float32Array(8);
        this.coreProjected = Array.from({ length: 8 }, () => ({ x: 0, y: 0 }));

        // Preallocated Painter-Sort Edge Buffers (max 48 edges)
        this.edgeA = new Uint8Array(MAX_EDGES);
        this.edgeB = new Uint8Array(MAX_EDGES);
        this.edgeKind = new Uint8Array(MAX_EDGES); // 0=morphCube, 1=star, 2=counterCore
        this.edgeDepth = new Float32Array(MAX_EDGES);
        this.edgeOrder = new Uint8Array(MAX_EDGES);

        // 3-step Opaque Motion Echo Ring Buffer
        this.trailFrames = Array.from({ length: MAX_TRAILS }, () =>
            Array.from({ length: 14 }, () => ({ x: 0, y: 0 }))
        );
        this.trailValidCount = 0;
        this.trailAccum = 0;
        this.lastW = -1;
        this.lastH = -1;

        // Continuous simulation state (preserved across resize/rotation)
        this.internalT = 0;
        this.roamPhase = 0;
        this.coreAngle = 0;
        this.smoothedSpeed = 1.0;
        this.smoothedMorph = 0.0;
        this.afterglowMix = 0.0;

        // Discrete beat-driven state
        this.lastBeatCount = 0;
        this.spinDirection = 1;
        this.themeIndex = 0;
        this.detailMode = 0; // 0: Crisp Cube/Star, 1: Bevel + Crosshairs, 2: Ghost Trails, 3: Dual-Shell Hyper-Core
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
        // Macro State Dynamics & Foreground-Safe 1.5s Transitions
        // ---------------------------------------------------------
        let targetSpeed = 1.0 + tension * 0.4;
        let targetMorph = tension * 0.35;
        let beatScaleGain = 0.14;
        let targetAfterglow = 0.0;
        let geoReveal = 1.0;
        let revealRatio = 1.0;

        if (state === 'starting') {
            const prog = clamp01((this.stateAge + 0.08) / TRANSITION_DURATION);
            targetSpeed = 0.85;
            targetMorph = 0.05;
            beatScaleGain = 0.08;
            geoReveal = 0.28 + 0.72 * prog;
            revealRatio = Math.max(0.2, prog);
        } else if (state === 'stopping') {
            const prog = 1.0 - clamp01(this.stateAge / TRANSITION_DURATION);
            if (prog <= 0.01) return;
            targetSpeed = 0.45;
            targetMorph = 0.10;
            beatScaleGain = 0.05;
            geoReveal = prog;
            revealRatio = prog;
        } else if (state === 'playing') {
            targetSpeed = 0.95 + tension * 0.40;
            targetMorph = 0.15 + 0.35 * tension + 0.15 * Math.sin(this.internalT * 0.85);
            beatScaleGain = 0.16;
        } else if (state === 'buildup') {
            targetSpeed = 1.55 + tension * 0.55;
            targetMorph = 0.38 + (Math.sin(this.internalT * 2.2) * 0.5 + 0.5) * 0.55;
            beatScaleGain = 0.20;
        } else if (state === 'climax') {
            targetSpeed = 2.35 + tension * 0.75 + (isClimaxLocked ? 0.25 : 0);
            targetMorph = 0.84 + 0.16 * Math.sin(this.internalT * 3.4);
            beatScaleGain = 0.24;
        } else if (state === 'afterglow') {
            targetSpeed = 0.32;
            targetMorph = 0.22;
            beatScaleGain = 0.05;
            targetAfterglow = 1.0;
        }

        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * Math.min(1.0, dt * 4.5);
        this.smoothedMorph += (targetMorph - this.smoothedMorph) * Math.min(1.0, dt * 4.0);
        this.afterglowMix += (targetAfterglow - this.afterglowMix) * Math.min(1.0, dt * 2.0);
        const ag = this.afterglowMix;

        // Kontinuierlicher Vorwaerts-Spin-Boost bei Beat (kein Rueckwaerts-Zucken!)
        const spinBoost = 1.0 + beatImpulse * 0.85 * (1.0 - ag);
        this.internalT = (this.internalT + dt * this.smoothedSpeed * spinBoost) % 4096;
        this.roamPhase = (this.roamPhase + dt * (0.58 + 0.36 * ymMid) * this.smoothedSpeed) % TWO_PI;
        this.coreAngle = (this.coreAngle + dt * (1.35 + 0.95 * ymMid) * this.smoothedSpeed) % TWO_PI;

        // ---------------------------------------------------------
        // Morph Geometry: Cube (12) + Stella Tips (6) + Counter Core
        // ---------------------------------------------------------
        const morph = clamp01(this.smoothedMorph + beatImpulse * 0.14 * (1.0 - ag));
        const cornerScale = Math.max(0.42, (1.0 - morph * 0.52) * (1.0 - 0.10 * ymMid));
        const tipScale = (0.86 + morph * 0.96) + (ymBass * 0.22 + beatImpulse * 0.18) * (1.0 - 0.65 * ag);

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

        // Kalibrierte Projektion fuer imposante Demo-Groesse ohne Abschneiden
        const minDim = Math.min(w, h);
        const beatScale = 1.0 + beatImpulse * beatScaleGain * (1.0 - 0.6 * ag);
        const projScale = Math.max(10, minDim * 0.72 * geoReveal * beatScale);

        const maxRadiusUnits = Math.max(1.732 * cornerScale, tipScale);
        const safeDenom = Math.sqrt(Math.max(1.0, CAM_Z * CAM_Z - maxRadiusUnits * maxRadiusUnits));
        const estMaxRadius = Math.min(minDim * 0.45, (maxRadiusUnits * projScale) / safeDenom);

        // Lissajous-Achter-Flugbahn nutzt Portraet, 4:3 und Ultrawide voll aus
        const roamAmpX = Math.max(0, w * 0.46 - estMaxRadius) * (0.45 + 0.50 * tension) * (1.0 - 0.70 * ag);
        const roamAmpY = Math.max(0, h * 0.44 - estMaxRadius) * (0.30 + 0.45 * ymMid) * (1.0 - 0.70 * ag);
        const cx = Math.floor(w * 0.5 + Math.sin(this.roamPhase) * roamAmpX);
        const cy = Math.floor(h * 0.5 + Math.sin(this.roamPhase * 1.5) * roamAmpY);

        const rx = this.internalT * 0.78;
        const ry = this.internalT * 1.15 * this.spinDirection;
        const rz = this.internalT * 0.48;

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
            const zOff = Math.max(1.6, z2 + CAM_Z);
            this.projected[i].x = Math.floor(cx + (x3 * projScale) / zOff);
            this.projected[i].y = Math.floor(cy + (y3 * projScale) / zOff);
        }

        const isCool = ag > 0.5;
        const theme = isCool ? AFTERGLOW_THEME : WIREFRAME_THEMES[this.themeIndex];
        const showCounterCore = (this.detailMode === 3 || state === 'climax') && !isCool;

        // Gegenlaeufiger innerer Hyper-Cube (4D-Tesseract-Effekt im Climax / Mode 3)
        if (showCounterCore) {
            const coreR = Math.max(0.30, cornerScale * (0.76 + 0.14 * ymBass + 0.12 * beatImpulse));
            const crx = -this.coreAngle * 1.1;
            const cry = this.coreAngle * 1.45 * -this.spinDirection;
            const crz = this.coreAngle * 0.65;
            const csX = Math.sin(crx); const ccX = Math.cos(crx);
            const csY = Math.sin(cry); const ccY = Math.cos(cry);
            const csZ = Math.sin(crz); const ccZ = Math.cos(crz);

            for (let i = 0; i < 8; i++) {
                const vx = BASE_CORNERS[i][0] * coreR;
                const vy = BASE_CORNERS[i][1] * coreR;
                const vz = BASE_CORNERS[i][2] * coreR;
                const y1 = vy * ccX - vz * csX;
                const z1 = vy * csX + vz * ccX;
                const x2 = vx * ccY + z1 * csY;
                const z2 = -vx * csY + z1 * ccY;
                const x3 = x2 * ccZ - y1 * csZ;
                const y3 = x2 * csZ + y1 * ccZ;

                this.coreRotatedZ[i] = z2;
                const zOff = Math.max(1.6, z2 + CAM_Z);
                this.coreProjected[i].x = Math.floor(cx + (x3 * projScale) / zOff);
                this.coreProjected[i].y = Math.floor(cy + (y3 * projScale) / zOff);
            }
        }

        const clipRect = { x: 0, y: 0, w, h };

        // ---------------------------------------------------------
        // 1. Themen-treue Opaque Ghost Trails (Mode 2 oder Climax)
        // ---------------------------------------------------------
        const showTrails = (this.detailMode === 2 || state === 'climax' || state === 'buildup') &&
            ag < 0.55 && state !== 'starting' && state !== 'stopping';
        if (showTrails && this.trailValidCount > 0) {
            const maxTrail = state === 'climax' ? Math.min(3, this.trailValidCount) : Math.min(2, this.trailValidCount);
            const cubeFadeLimit = Math.max(4, Math.floor(CUBE_EDGES.length * revealRatio));
            const starFadeLimit = Math.max(4, Math.floor(STAR_EDGES.length * revealRatio));

            for (let tr = maxTrail - 1; tr >= 0; tr--) {
                const pts = this.trailFrames[tr];
                const trailCol = theme.trails[tr];
                for (let i = 0; i < starFadeLimit; i++) {
                    const p1 = pts[STAR_EDGES[i][0]];
                    const p2 = pts[STAR_EDGES[i][1]];
                    drawAliasedLineClipped(ctx, p1.x, p1.y, p2.x, p2.y, trailCol, clipRect);
                }
                if (tr === 0) {
                    for (let i = 0; i < cubeFadeLimit; i++) {
                        const p1 = pts[CUBE_EDGES[i][0]];
                        const p2 = pts[CUBE_EDGES[i][1]];
                        drawAliasedLineClipped(ctx, p1.x, p1.y, p2.x, p2.y, trailCol, clipRect);
                    }
                }
            }
        }

        // ---------------------------------------------------------
        // 2. Aktive Kanten einsammeln & nach Z-Tiefe sortieren (Back -> Front)
        // ---------------------------------------------------------
        let totalEdges = 0;

        // 12 Morph-Cube Rahmenkanten (immer Teil des Morphs!)
        const cubeLimit = Math.min(CUBE_EDGES.length, Math.max(4, Math.ceil(CUBE_EDGES.length * revealRatio)));
        for (let i = 0; i < cubeLimit; i++) {
            const e = CUBE_EDGES[i];
            this.edgeA[totalEdges] = e[0];
            this.edgeB[totalEdges] = e[1];
            this.edgeKind[totalEdges] = 0;
            this.edgeDepth[totalEdges] = (this.rotatedZ[e[0]] + this.rotatedZ[e[1]]) * 0.5;
            this.edgeOrder[totalEdges] = totalEdges;
            totalEdges++;
        }

        // 24 Stella-Sternkanten
        const starLimit = Math.min(STAR_EDGES.length, Math.max(4, Math.ceil(STAR_EDGES.length * revealRatio)));
        for (let i = 0; i < starLimit; i++) {
            const e = STAR_EDGES[i];
            this.edgeA[totalEdges] = e[0];
            this.edgeB[totalEdges] = e[1];
            this.edgeKind[totalEdges] = 1;
            this.edgeDepth[totalEdges] = (this.rotatedZ[e[0]] + this.rotatedZ[e[1]]) * 0.5;
            this.edgeOrder[totalEdges] = totalEdges;
            totalEdges++;
        }

        // 12 Gegenlaeufige Hyper-Core-Kanten
        if (showCounterCore) {
            for (let i = 0; i < CUBE_EDGES.length; i++) {
                const e = CUBE_EDGES[i];
                this.edgeA[totalEdges] = e[0];
                this.edgeB[totalEdges] = e[1];
                this.edgeKind[totalEdges] = 2;
                this.edgeDepth[totalEdges] = (this.coreRotatedZ[e[0]] + this.coreRotatedZ[e[1]]) * 0.5;
                this.edgeOrder[totalEdges] = totalEdges;
                totalEdges++;
            }
        }

        // Insertion Sort absteigend nach Z (groesseres Z = weiter hinten -> zuerst zeichnen)
        for (let a = 1; a < totalEdges; a++) {
            const keyIdx = this.edgeOrder[a];
            const keyZ = this.edgeDepth[keyIdx];
            let b = a - 1;
            while (b >= 0 && this.edgeDepth[this.edgeOrder[b]] < keyZ) {
                this.edgeOrder[b + 1] = this.edgeOrder[b];
                b--;
            }
            this.edgeOrder[b + 1] = keyIdx;
        }

        // ---------------------------------------------------------
        // 3. Z-Sorted Shifter Vector Rendering + Contrast Drop-Shadow
        // ---------------------------------------------------------
        const flashActive = !isCool && this.flashAge < 0.10 && this.flashPeak > 0.25;
        const hardFlash = flashActive && this.flashPeak >= 0.75;
        const medFlash = flashActive && this.flashPeak >= 0.45;
        const highBoost = beatImpulse > 0.55 || pulse > 0.5 || ymHigh > 0.68;
        const useBevel = (this.detailMode === 1 || state === 'climax' || hardFlash) && minDim >= 80 && !isCool;
        const useContrastShadow = minDim >= 64;

        for (let si = 0; si < totalEdges; si++) {
            const idx = this.edgeOrder[si];
            const kind = this.edgeKind[idx];
            const a = this.edgeA[idx];
            const b = this.edgeB[idx];
            const avgZ = this.edgeDepth[idx];

            const pts = kind === 2 ? this.coreProjected : this.projected;
            const p1 = pts[a];
            const p2 = pts[b];

            let col;
            if (kind === 2) {
                // Gegenlaeufiger Hyper-Core
                col = hardFlash ? theme.node : (avgZ > 0.1 ? theme.innerBack : theme.inner);
            } else if (kind === 0 && morph > 0.55 && showCounterCore) {
                // Bei aktivem Hyper-Core bleibt der Morph-Rahmen dezent als Bruecke
                col = avgZ > 0 ? theme.back : theme.mid;
            } else if (avgZ > 0.12) {
                col = medFlash ? theme.mid : theme.back;
            } else if (avgZ > -0.22) {
                col = hardFlash ? theme.front : (medFlash ? theme.front : theme.mid);
            } else {
                col = hardFlash
                    ? theme.node
                    : ((highBoost && avgZ < -0.42) || (medFlash && avgZ < -0.28) ? theme.node : theme.front);
            }

            // 1px Kontrast-Schatten (+1,+1) fuer helle Frontkanten ueber hellen Hintergruenden
            if (useContrastShadow && avgZ <= -0.05) {
                drawAliasedLineClipped(ctx, p1.x + 1, p1.y + 1, p2.x + 1, p2.y + 1, INK, clipRect);
            }

            // Saubere 1px Parallel-Bevel-Kante statt klobiger 2x2-Ecken!
            if (useBevel && avgZ <= -0.32 && kind !== 2) {
                const ox = Math.abs(p2.x - p1.x) >= Math.abs(p2.y - p1.y) ? 0 : 1;
                const oy = ox === 0 ? 1 : 0;
                drawAliasedLineClipped(ctx, p1.x + ox, p1.y + oy, p2.x + ox, p2.y + oy, theme.mid, clipRect);
            }

            drawAliasedLineClipped(ctx, p1.x, p1.y, p2.x, p2.y, col, clipRect);
        }

        // ---------------------------------------------------------
        // 4. Atari ST Vertex Star Crosshairs (+-Funken an Frontspitzen)
        // ---------------------------------------------------------
        if (!isCool && minDim >= 48) {
            const showCrosshairs = this.detailMode === 1 || state === 'climax' || state === 'buildup' || ymHigh > 0.60 || beatImpulse > 0.40;
            if (showCrosshairs) {
                const bigSpark = hardFlash || (state === 'climax' && beatImpulse > 0.65);
                const arm = minDim >= 100 ? (bigSpark ? 2 : 1) : 1;
                for (let i = 8; i < 14; i++) {
                    if (this.rotatedZ[i] <= 0.15) {
                        const p = this.projected[i];
                        drawTipCrosshair(
                            ctx,
                            p.x,
                            p.y,
                            arm,
                            bigSpark || this.rotatedZ[i] < -0.35 ? theme.node : theme.front,
                            theme.node,
                            w,
                            h
                        );
                    }
                }
            }
        }

        // ---------------------------------------------------------
        // 5. Trail Ring Buffer Snapshot (~25 Hz)
        // ---------------------------------------------------------
        this.trailAccum += dt;
        if (this.trailAccum >= 0.04) {
            this.trailAccum = 0;
            for (let tr = MAX_TRAILS - 1; tr >= 1; tr--) {
                const dst = this.trailFrames[tr];
                const src = this.trailFrames[tr - 1];
                for (let i = 0; i < 14; i++) {
                    dst[i].x = src[i].x;
                    dst[i].y = src[i].y;
                }
            }
            const head = this.trailFrames[0];
            for (let i = 0; i < 14; i++) {
                head[i].x = this.projected[i].x;
                head[i].y = this.projected[i].y;
            }
            if (this.trailValidCount < MAX_TRAILS) this.trailValidCount++;
        }
    }
}