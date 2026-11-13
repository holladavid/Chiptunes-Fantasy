// === js/visuals/dse/amiga/glenz-cube.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: AMIGA OCS GLENZ-CUBE (Foreground DSE)
// 100% DOM-free & alpha-free. Phase-shifted Amiga 12-bit
// checkerboard dither, 1024-step mechanical rotation LUT,
// normal-aligned facet explosion, inner crystal core, and
// full musical sync (tensionPct, beatLevel 1-3, beatImpulse,
// smooth[0..2], climax wireframe echoes, and afterglow).
// =========================================================

import {
    quantizeAmiga12Bit,
    rgbToHex,
    drawAliasedLine
} from '../../utils/hardware-constraints.js';

const SHADE_STEPS = 16;
const MAX_TRAILS = 2;
const TRAIL_SAMPLE_INTERVAL = 0.045;
const CAMERA_Z = 5.2;

const BAYER_4X4 = [
    0, 8, 2, 10,
    12, 4, 14, 6,
    3, 11, 1, 9,
    15, 7, 13, 5
];

const CUBE_VERTICES = [
    [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
    [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]
];

const CUBE_EDGES = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7]
];

const CUBE_FACES_DEF = [
    { idxs: [4, 5, 6, 7], baseColorIdx: 0 }, // +Z
    { idxs: [1, 0, 3, 2], baseColorIdx: 1 }, // -Z
    { idxs: [3, 7, 6, 2], baseColorIdx: 2 }, // +Y (korrigiertes Outward-Winding)
    { idxs: [1, 5, 4, 0], baseColorIdx: 3 }, // -Y
    { idxs: [0, 4, 7, 3], baseColorIdx: 4 }, // -X
    { idxs: [5, 1, 2, 6], baseColorIdx: 5 }  // +X
];

// Innerer Crystal-Core (Oktaeder)
const CORE_VERTICES = [
    [0.48, 0, 0], [-0.48, 0, 0],
    [0, 0.48, 0], [0, -0.48, 0],
    [0, 0, 0.48], [0, 0, -0.48]
];

const CORE_EDGES = [
    [0, 2], [0, 3], [0, 4], [0, 5],
    [1, 2], [1, 3], [1, 4], [1, 5],
    [2, 4], [4, 3], [3, 5], [5, 2]
];

const NORMAL_BASE_COLORS = [
    [255, 102, 0],   // Orange
    [255, 187, 0],   // Gold
    [34, 102, 255],  // Blue
    [34, 221, 255],  // Cyan
    [204, 34, 170],  // Purple
    [255, 68, 136]   // Pink
];

const COOL_BASE_COLORS = [
    [68, 85, 187],   // Deep Indigo
    [85, 136, 221],  // Slate Blue
    [102, 204, 238], // Ice Cyan
    [170, 204, 255], // Moonlight Silver
    [136, 68, 187],  // Twilight Violet
    [170, 85, 153]   // Dusk Rose
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const qHex = (r, g, b) => rgbToHex(...quantizeAmiga12Bit(r, g, b));

function buildPaletteGroup(colors, minBright, maxBright) {
    return Object.freeze(colors.map(rgb => {
        const shades = new Array(SHADE_STEPS);
        for (let i = 0; i < SHADE_STEPS; i++) {
            const factor = minBright + (maxBright - minBright) * (i / (SHADE_STEPS - 1));
            shades[i] = qHex(
                Math.round(rgb[0] * factor),
                Math.round(rgb[1] * factor),
                Math.round(rgb[2] * factor)
            );
        }
        return Object.freeze(shades);
    }));
}

const COLOR_LUT = Object.freeze({
    frontNormal: buildPaletteGroup(NORMAL_BASE_COLORS, 0.45, 1.0),
    backNormal: buildPaletteGroup(NORMAL_BASE_COLORS, 0.22, 0.52),
    frontCool: buildPaletteGroup(COOL_BASE_COLORS, 0.38, 0.90),
    backCool: buildPaletteGroup(COOL_BASE_COLORS, 0.18, 0.42)
});

const LINE_COLORS = Object.freeze({
    frontDim: qHex(170, 187, 221),
    frontBright: qHex(255, 255, 255),
    frontGold: qHex(255, 221, 102),
    back: qHex(85, 85, 119),
    backCool: qHex(51, 68, 102),
    coreCyan: qHex(68, 221, 255),
    coreGold: qHex(255, 204, 68),
    coreWhite: qHex(255, 255, 255),
    trailFar: qHex(51, 34, 102),
    trailNear: qHex(102, 51, 153)
});

const SIN_LUT = new Float32Array(1024);
const COS_LUT = new Float32Array(1024);
for (let i = 0; i < 1024; i++) {
    const angle = (i / 1024) * Math.PI * 2;
    SIN_LUT[i] = Math.sin(angle);
    COS_LUT[i] = Math.cos(angle);
}

function macroFallbackTension(state) {
    if (state === 'climax') return 0.90;
    if (state === 'buildup') return 0.70;
    if (state === 'afterglow') return 0.22;
    if (state === 'starting') return 0.35;
    return 0.42;
}

export class AmigaCube {
    constructor() {
        this.name = 'Amiga Glenz Cube';

        // Vorallokierte Geometrie-Puffer (0 Bytes Allokation im Renderloop)
        this.rotatedBase = Array.from({ length: 8 }, () => ({ x: 0, y: 0, z: 0 }));
        this.coreProjected = Array.from({ length: 6 }, () => ({ x: 0, y: 0 }));
        this.trailProjected = Array.from({ length: 8 }, () => ({ x: 0, y: 0 }));
        this.faceProjected = Array.from({ length: 6 }, () =>
            Array.from({ length: 4 }, () => ({ x: 0, y: 0 }))
        );
        this.facesToDraw = Array.from({ length: 6 }, (_, idx) => ({
            pts: this.faceProjected[idx],
            z: 0,
            isBackface: false,
            hex: LINE_COLORS.back,
            isSpecular: false
        }));

        this.trailHistory = Array.from({ length: MAX_TRAILS }, () => ({
            active: false,
            normX: 0,
            normY: 0,
            phaseX: 0,
            phaseY: 0,
            phaseZ: 0,
            scale: 1
        }));
        this.trailHead = 0;
        this.trailTimer = 0;

        // Kontinuierliche Float-Phasen für 1024-LUT (verhindert Einfrieren bei kleinem dt)
        this.phaseX = 0;
        this.phaseY = 128;
        this.phaseZ = 256;
        this.corePhaseY = 0;
        this.corePhaseX = 0;
        this.driftPhase = 0;

        this.spinDirX = 1;
        this.spinDirY = 1;
        this.spinDirZ = 1;

        this.lastT = 0;
        this.hasRendered = false;
        this.lastState = 'idle';
        this.stateAge = 0;

        this.smoothedSpeed = 1.0;
        this.tension = 0.42;
        this.afterglowMix = 0.0;
        this.faceExplode = 0.0;
        this.beatPop = 0.0;
        this.beatPulse = 0.0;
        this.rotKick = 0.0;
        this.shakeTimer = 0.0;
        this.activeBeatLevel = 1;
        this.paletteOffset = 0;

        this.lastBeatCount = -1;
        this.fallbackBeatCount = 0;
        this.lastBeatEvent = false;
    }

    resize() {
        // Alle Positionen & Projektionen passen sich im nächsten render() nahtlos an.
    }

    resetTransients() {
        this.faceExplode = 0.0;
        this.beatPop = 0.0;
        this.beatPulse = 0.0;
        this.rotKick = 0.0;
        this.shakeTimer = 0.0;
        this.trailTimer = 0.0;
        for (let i = 0; i < MAX_TRAILS; i++) {
            this.trailHistory[i].active = false;
        }
    }

    drawDitheredLine(ctx, width, height, x0, y0, x1, y1, hex, bayerThreshold) {
        let ix0 = Math.round(x0);
        let iy0 = Math.round(y0);
        const ix1 = Math.round(x1);
        const iy1 = Math.round(y1);
        const dx = Math.abs(ix1 - ix0);
        const dy = Math.abs(iy1 - iy0);
        const sx = ix0 < ix1 ? 1 : -1;
        const sy = iy0 < iy1 ? 1 : -1;
        let err = dx - dy;
        let guard = dx + dy + 2;

        ctx.fillStyle = hex;
        while (guard-- > 0) {
            if (ix0 >= 0 && ix0 < width && iy0 >= 0 && iy0 < height) {
                if (bayerThreshold >= 16 || BAYER_4X4[((iy0 & 3) << 2) | (ix0 & 3)] < bayerThreshold) {
                    ctx.fillRect(ix0, iy0, 1, 1);
                }
            }
            if (ix0 === ix1 && iy0 === iy1) break;
            const e2 = err << 1;
            if (e2 > -dy) {
                err -= dy;
                ix0 += sx;
            }
            if (e2 < dx) {
                err += dx;
                iy0 += sy;
            }
        }
    }

    drawLine(ctx, width, height, x0, y0, x1, y1, hex, bayerThreshold) {
        if (bayerThreshold < 16) {
            this.drawDitheredLine(ctx, width, height, x0, y0, x1, y1, hex, bayerThreshold);
        } else {
            const cx0 = clamp(x0, 0, width - 1);
            const cy0 = clamp(y0, 0, height - 1);
            const cx1 = clamp(x1, 0, width - 1);
            const cy1 = clamp(y1, 0, height - 1);
            drawAliasedLine(ctx, cx0, cy0, cx1, cy1, hex);
        }
    }

    fillGlenzQuad(ctx, width, height, pts, hex, isBackface, bayerThreshold) {
        let minY = pts[0].y;
        let maxY = pts[0].y;
        let minX = pts[0].x;
        let maxX = pts[0].x;
        for (let i = 1; i < 4; i++) {
            const px = pts[i].x;
            const py = pts[i].y;
            if (py < minY) minY = py;
            if (py > maxY) maxY = py;
            if (px < minX) minX = px;
            if (px > maxX) maxX = px;
        }
        if (maxX < 0 || minX >= width) return;

        const yStart = Math.max(0, minY);
        const yEnd = Math.min(height - 1, maxY);
        if (yStart > yEnd) return;

        ctx.fillStyle = hex;

        for (let y = yStart; y <= yEnd; y++) {
            // Backfaces zeichnen nur ungerade Zeilen (y & 1 === 1) im versetzten Raster,
            // Frontfaces auf (x + y) & 1 === 0 -> 50% Front, 25% Back, 25% Hintergrund!
            if (isBackface && (y & 1) === 0) continue;

            let spanMin = width;
            let spanMax = -1;

            for (let i = 0; i < 4; i++) {
                const a = pts[i];
                const b = pts[(i + 1) & 3];
                const y0 = a.y;
                const y1 = b.y;
                if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
                    const ix = a.x + ((y - y0) * (b.x - a.x)) / (y1 - y0);
                    if (ix < spanMin) spanMin = ix;
                    if (ix > spanMax) spanMax = ix;
                }
            }

            if (spanMax < spanMin) continue;

            const xLeft = Math.max(0, Math.round(spanMin));
            const xRight = Math.min(width - 1, Math.round(spanMax));
            if (xLeft > xRight) continue;

            // Exakte Parität für phasengetrenntes Glenz-Dither
            let startX = xLeft;
            if (isBackface) {
                if ((startX & 1) !== 0) startX++;
            } else {
                if (((startX + y) & 1) !== 0) startX++;
            }

            if (bayerThreshold >= 16) {
                for (let x = startX; x <= xRight; x += 2) {
                    ctx.fillRect(x, y, 1, 1);
                }
            } else {
                const rowShift = (y & 3) << 2;
                for (let x = startX; x <= xRight; x += 2) {
                    if (BAYER_4X4[rowShift | (x & 3)] < bayerThreshold) {
                        ctx.fillRect(x, y, 1, 1);
                    }
                }
            }
        }
    }

    drawWireframeEcho(ctx, width, height, cx, cy, fov, trail, hex, bayerThreshold) {
        const ix = Math.floor(trail.phaseX) & 1023;
        const iy = Math.floor(trail.phaseY) & 1023;
        const iz = Math.floor(trail.phaseZ) & 1023;
        const sx = SIN_LUT[ix];
        const cxr = COS_LUT[ix];
        const sy = SIN_LUT[iy];
        const cyr = COS_LUT[iy];
        const sz = SIN_LUT[iz];
        const czr = COS_LUT[iz];
        const s = trail.scale;

        for (let i = 0; i < 8; i++) {
            const x = CUBE_VERTICES[i][0] * s;
            const y = CUBE_VERTICES[i][1] * s;
            const z = CUBE_VERTICES[i][2] * s;

            const y1 = y * cxr - z * sx;
            const z1 = y * sx + z * cxr;
            const x2 = x * cyr + z1 * sy;
            const z2 = -x * sy + z1 * cyr;
            const x3 = x2 * czr - y1 * sz;
            const y3 = x2 * sz + y1 * czr;

            const zOff = z2 + CAMERA_Z;
            this.trailProjected[i].x = Math.round(cx + (x3 * fov) / zOff);
            this.trailProjected[i].y = Math.round(cy + (y3 * fov) / zOff);
        }

        for (let e = 0; e < 12; e++) {
            const a = this.trailProjected[CUBE_EDGES[e][0]];
            const b = this.trailProjected[CUBE_EDGES[e][1]];
            this.drawLine(ctx, width, height, a.x, a.y, b.x, b.y, hex, bayerThreshold);
        }
    }

    drawCrystalCore(ctx, width, height, cx, cy, fov, coreScale, hex, bayerThreshold) {
        const ix = Math.floor(this.corePhaseX) & 1023;
        const iy = Math.floor(this.corePhaseY) & 1023;
        const sx = SIN_LUT[ix];
        const cxr = COS_LUT[ix];
        const sy = SIN_LUT[iy];
        const cyr = COS_LUT[iy];

        for (let i = 0; i < 6; i++) {
            const x = CORE_VERTICES[i][0] * coreScale;
            const y = CORE_VERTICES[i][1] * coreScale;
            const z = CORE_VERTICES[i][2] * coreScale;

            const y1 = y * cxr - z * sx;
            const z1 = y * sx + z * cxr;
            const x2 = x * cyr + z1 * sy;
            const z2 = -x * sy + z1 * cyr;

            const zOff = z2 + CAMERA_Z;
            this.coreProjected[i].x = Math.round(cx + (x2 * fov) / zOff);
            this.coreProjected[i].y = Math.round(cy + (y1 * fov) / zOff);
        }

        for (let e = 0; e < 12; e++) {
            const a = this.coreProjected[CORE_EDGES[e][0]];
            const b = this.coreProjected[CORE_EDGES[e][1]];
            this.drawLine(ctx, width, height, a.x, a.y, b.x, b.y, hex, bayerThreshold);
        }
    }

    render(ctx, width, height, t, state, stateTime, metrics) {
        if (!Number.isFinite(width) || !Number.isFinite(height) ||
            width <= 0 || height <= 0 || !Number.isFinite(width / height)) {
            this.lastT = Number.isFinite(t) ? t : this.lastT;
            return;
        }

        const time = Number.isFinite(t) ? t : this.lastT;
        if (state === 'idle') {
            this.lastT = time;
            this.lastState = 'idle';
            this.stateAge = 0;
            return;
        }

        const dt = this.hasRendered ? clamp(time - this.lastT, 0, 0.1) : 0.02;
        this.lastT = time;
        this.hasRendered = true;

        if (this.lastState !== state) {
            if (state === 'starting' && this.lastState === 'idle') {
                this.resetTransients();
            }
            this.lastState = state;
            this.stateAge = 0;
        } else {
            this.stateAge += dt;
        }

        // =========================================================
        // 1. DEFENSIVE METRICS & TENSION / BEAT-LEVEL AUSWERTUNG
        // =========================================================
        const requestedTension = Number.isFinite(metrics?.tensionPct)
            ? clamp(metrics.tensionPct, 0, 1)
            : macroFallbackTension(state);
        this.tension += (requestedTension - this.tension) * Math.min(1, dt * 3.0);

        const smoothArr = metrics?.smooth;
        const hasSmooth = Array.isArray(smoothArr) || ArrayBuffer.isView(smoothArr);
        const chBass = hasSmooth && Number.isFinite(smoothArr[0]) ? clamp(smoothArr[0], 0, 1) : 0;
        const chMid = hasSmooth && Number.isFinite(smoothArr[1]) ? clamp(smoothArr[1], 0, 1) : 0;
        const chHigh = hasSmooth && Number.isFinite(smoothArr[2]) ? clamp(smoothArr[2], 0, 1) : 0;

        const rawEnv = Number.isFinite(metrics?.beat?.[0]) ? clamp(metrics.beat[0], 0, 1) : 0;
        const rawImpulse = Number.isFinite(metrics?.beatImpulse?.[0])
            ? clamp(metrics.beatImpulse[0], 0, 1)
            : rawEnv;

        // Zeitbasiertes Abklingen (PAL-Tick-unabhängig)
        const decayFactor = Math.min(1, dt * 7.5);
        this.faceExplode += (0.0 - this.faceExplode) * decayFactor;
        this.beatPop = Math.max(0, this.beatPop - dt * 4.5);
        this.beatPulse = Math.max(0, this.beatPulse - dt * 3.2);
        this.rotKick = Math.max(0, this.rotKick - dt * 4.0);
        this.shakeTimer = Math.max(0, this.shakeTimer - dt);

        const beatStarted = metrics?.beatStarted === true;
        const rawBeatCount = Number.isFinite(metrics?.beatCount)
            ? Math.max(0, Math.floor(metrics.beatCount))
            : null;

        if (beatStarted) {
            const isNewBeat = rawBeatCount === null
                ? !this.lastBeatEvent
                : rawBeatCount !== this.lastBeatCount;

            if (isNewBeat) {
                const beatIndex = rawBeatCount === null ? this.fallbackBeatCount++ : rawBeatCount;
                if (rawBeatCount !== null) this.lastBeatCount = rawBeatCount;

                const strength = Number.isFinite(metrics?.beatStrength)
                    ? clamp(metrics.beatStrength, 0, 1)
                    : metrics?.beatLevel === 3 ? 0.90
                        : metrics?.beatLevel === 2 ? 0.50
                            : metrics?.beatLevel === 1 ? 0.20
                                : (rawImpulse > 0 ? rawImpulse : 0.50);

                const level = (metrics?.beatLevel === 1 || metrics?.beatLevel === 2 || metrics?.beatLevel === 3)
                    ? metrics.beatLevel
                    : (strength >= 2 / 3 ? 3 : (strength >= 1 / 3 ? 2 : 1));

                this.activeBeatLevel = level;
                this.beatPulse = Math.max(this.beatPulse, strength);
                this.beatPop = Math.max(this.beatPop, level === 3 ? 1.0 : (level === 2 ? 0.55 : 0.20));

                // Echte Facetten-Explosion entlang der Flächennormalen nach Beat-Level
                const explodeTarget = level === 3 ? 0.34 : (level === 2 ? 0.18 : 0.06);
                this.faceExplode = Math.max(this.faceExplode, explodeTarget);
                this.rotKick = Math.max(this.rotKick, level === 3 ? 1.5 : (level === 2 ? 0.75 : 0.25));

                if (state !== 'afterglow' && state !== 'stopping') {
                    if (level === 3) {
                        this.paletteOffset = (this.paletteOffset + (state === 'climax' ? 2 : 1)) % 6;
                        if (state === 'climax' || state === 'buildup') {
                            this.shakeTimer = Math.max(this.shakeTimer, 0.08);
                        }
                        // Deterministische Achsen-Umkehr auf jedem 4. harten Beat (ohne Math.random)
                        if (beatIndex > 0 && beatIndex % 4 === 0) {
                            this.spinDirX = -this.spinDirX;
                            if ((beatIndex & 7) === 0) this.spinDirY = -this.spinDirY;
                        }
                    } else if (level === 2 && (beatIndex & 1) === 0) {
                        this.paletteOffset = (this.paletteOffset + 1) % 6;
                    }
                }
            }
        }
        this.lastBeatEvent = beatStarted;

        // =========================================================
        // 2. MAKROZUSTÄNDE, TRANSITIONS & ROTATIONS-AKKUMULATION
        // =========================================================
        let visibility = 1.0;
        let transitionScale = 1.0;

        if (state === 'starting') {
            const tt = Number.isFinite(stateTime) ? Math.max(0, stateTime) : this.stateAge;
            visibility = clamp(tt / 1.5, 0, 1);
            transitionScale = 0.20 + 0.80 * (1 - Math.pow(1 - visibility, 2));
        } else if (state === 'stopping') {
            const tt = Number.isFinite(stateTime) ? Math.max(0, stateTime) : this.stateAge;
            visibility = clamp(1 - tt / 1.5, 0, 1);
            transitionScale = 0.35 + 0.65 * visibility;
        }

        let targetSpeed = 0.90 + this.tension * 0.80;
        let targetAfterglow = 0.0;
        let driftScale = 0.30 + this.tension * 0.55;

        if (state === 'buildup') {
            targetSpeed = 1.25 + this.tension * 0.95;
            driftScale = 0.55 + this.tension * 0.45;
        } else if (state === 'climax') {
            targetSpeed = 1.95 + this.tension * 1.15;
            driftScale = 0.90;
        } else if (state === 'afterglow') {
            targetSpeed = 0.38 + this.tension * 0.22;
            targetAfterglow = 1.0;
            driftScale = 0.22;
        } else if (state === 'stopping') {
            targetSpeed = 0.55;
            driftScale = 0.25 * visibility;
        }

        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * Math.min(1, dt * 3.5);
        this.afterglowMix += (targetAfterglow - this.afterglowMix) * Math.min(1, dt * 1.6);

        const spinMult = this.smoothedSpeed + this.rotKick;
        this.phaseX = (this.phaseX + dt * 145 * spinMult * this.spinDirX + 1024) % 1024;
        this.phaseY = (this.phaseY + dt * 210 * spinMult * this.spinDirY + 1024) % 1024;
        this.phaseZ = (this.phaseZ + dt * 105 * spinMult * this.spinDirZ + 1024) % 1024;
        this.corePhaseY = (this.corePhaseY - dt * 290 * (0.8 + this.tension) + 1024) % 1024;
        this.corePhaseX = (this.corePhaseX + dt * 175 * (0.8 + this.tension) + 1024) % 1024;
        this.driftPhase += dt * (0.45 + this.tension * 0.55);

        if (visibility <= 0) {
            return;
        }

        // =========================================================
        // 3. RESPONSIVE PROJEKTION & SICHERE WELTGRENZEN
        // =========================================================
        const minDim = Math.min(width, height);
        if (minDim < 8) {
            ctx.fillStyle = LINE_COLORS.coreCyan;
            ctx.fillRect(Math.floor(width * 0.5), Math.floor(height * 0.5), 1, 1);
            return;
        }

        const activeSignal = Math.max(rawImpulse, this.beatPulse);
        const cubeScale = transitionScale * (1.0 + chBass * 0.06 + this.beatPop * 0.08 + activeSignal * 0.02);
        const fov = minDim * 0.88;

        // Maximal möglicher Screen-Radius inkl. Explosion -> garantiert null Clipping
        const maxSafeScreenRadius = 0.415 * minDim;
        const driftAmpX = Math.max(0, width * 0.5 - maxSafeScreenRadius - 2) * driftScale;
        const driftAmpY = Math.max(0, height * 0.5 - maxSafeScreenRadius - 2) * driftScale * 0.70;

        const normDriftX = Math.sin(this.driftPhase);
        const normDriftY = Math.sin(this.driftPhase * 2.0) * 0.85;

        let shakeX = 0;
        let shakeY = 0;
        if (this.shakeTimer > 0) {
            const palTick = Math.floor(this.shakeTimer * 50);
            shakeX = (palTick & 1) === 0 ? 1 : -1;
            shakeY = (palTick & 1) === 0 ? 0 : 1;
        }

        const centerX = Math.floor(width * 0.5 + normDriftX * driftAmpX) + shakeX;
        const centerY = Math.floor(height * 0.5 + normDriftY * driftAmpY) + shakeY;
        const bayerThreshold = Math.ceil(visibility * 16);

        // =========================================================
        // 4. CLIMAX WIREFRAME ECHOES (Ringpuffer in normierten Koordinaten)
        // =========================================================
        this.trailTimer += dt;
        if (this.trailTimer >= TRAIL_SAMPLE_INTERVAL) {
            this.trailTimer %= TRAIL_SAMPLE_INTERVAL;
            const slot = this.trailHistory[this.trailHead];
            slot.active = true;
            slot.normX = normDriftX * driftScale;
            slot.normY = normDriftY * driftScale;
            slot.phaseX = this.phaseX;
            slot.phaseY = this.phaseY;
            slot.phaseZ = this.phaseZ;
            slot.scale = cubeScale;
            this.trailHead = (this.trailHead + 1) % MAX_TRAILS;
        }

        let targetTrails = 0;
        if (state === 'climax') {
            targetTrails = 2;
        } else if (state === 'buildup' && this.tension > 0.70) {
            targetTrails = 1;
        } else if (state === 'afterglow' && this.stateAge < 0.70) {
            targetTrails = 1;
        }

        if (targetTrails > 0 && visibility > 0.85) {
            const maxAmpX = Math.max(0, width * 0.5 - maxSafeScreenRadius - 2);
            const maxAmpY = Math.max(0, height * 0.5 - maxSafeScreenRadius - 2) * 0.70;
            for (let g = targetTrails; g >= 1; g--) {
                const idx = (this.trailHead - 1 - g + MAX_TRAILS * 2) % MAX_TRAILS;
                const trail = this.trailHistory[idx];
                if (!trail.active) continue;
                const tx = Math.floor(width * 0.5 + trail.normX * maxAmpX);
                const ty = Math.floor(height * 0.5 + trail.normY * maxAmpY);
                const echoHex = g === 1 ? LINE_COLORS.trailNear : LINE_COLORS.trailFar;
                this.drawWireframeEcho(ctx, width, height, tx, ty, fov, trail, echoHex, bayerThreshold);
            }
        }

        // =========================================================
        // 5. 3D-ROTATION DER 8 BASIS-ECKEN (1024-LUT)
        // =========================================================
        const ix = Math.floor(this.phaseX) & 1023;
        const iy = Math.floor(this.phaseY) & 1023;
        const iz = Math.floor(this.phaseZ) & 1023;

        const sinX = SIN_LUT[ix];
        const cosX = COS_LUT[ix];
        const sinY = SIN_LUT[iy];
        const cosY = COS_LUT[iy];
        const sinZ = SIN_LUT[iz];
        const cosZ = COS_LUT[iz];

        for (let i = 0; i < 8; i++) {
            const x = CUBE_VERTICES[i][0] * cubeScale;
            const y = CUBE_VERTICES[i][1] * cubeScale;
            const z = CUBE_VERTICES[i][2] * cubeScale;

            const y1 = y * cosX - z * sinX;
            const z1 = y * sinX + z * cosX;
            const x2 = x * cosY + z1 * sinY;
            const z2 = -x * sinY + z1 * cosY;
            const x3 = x2 * cosZ - y1 * sinZ;
            const y3 = x2 * sinZ + y1 * cosZ;

            this.rotatedBase[i].x = x3;
            this.rotatedBase[i].y = y3;
            this.rotatedBase[i].z = z2;
        }

        // =========================================================
        // 6. FACETTEN-EXPLOSION, LAMBERT-SHADING & BACKFACE-CULLING
        // =========================================================
        const lx = 0.35;
        const ly = -0.62;
        const lz = -0.70;
        const lLen = Math.sqrt(lx * lx + ly * ly + lz * lz);
        const nlx = lx / lLen;
        const nly = ly / lLen;
        const nlz = lz / lLen;

        const explodeDist = this.faceExplode * transitionScale;
        const lightFillBoost = chMid * 0.16 + activeSignal * 0.20;
        let maxFrontDot = -1.0;
        let specFrontIdx = -1;

        for (let i = 0; i < 6; i++) {
            const faceDef = CUBE_FACES_DEF[i];
            const idxs = faceDef.idxs;
            const p0 = this.rotatedBase[idxs[0]];
            const p1 = this.rotatedBase[idxs[1]];
            const p2 = this.rotatedBase[idxs[2]];
            const p3 = this.rotatedBase[idxs[3]];

            const abX = p1.x - p0.x;
            const abY = p1.y - p0.y;
            const abZ = p1.z - p0.z;
            const acX = p2.x - p0.x;
            const acY = p2.y - p0.y;
            const acZ = p2.z - p0.z;

            let nx = abY * acZ - abZ * acY;
            let ny = abZ * acX - abX * acZ;
            let nz = abX * acY - abY * acX;
            const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
            if (len > 1e-6) {
                nx /= len;
                ny /= len;
                nz /= len;
            }

            const ex = nx * explodeDist;
            const ey = ny * explodeDist;
            const ez = nz * explodeDist;

            // 4 explodierte Face-Ecken direkt in faceProjected[i] projizieren
            const pts = this.faceProjected[i];
            for (let k = 0; k < 4; k++) {
                const v = this.rotatedBase[idxs[k]];
                const zOff = v.z + ez + CAMERA_Z;
                pts[k].x = Math.round(centerX + ((v.x + ex) * fov) / zOff);
                pts[k].y = Math.round(centerY + ((v.y + ey) * fov) / zOff);
            }

            const cx3 = (p0.x + p1.x + p2.x + p3.x) * 0.25 + ex;
            const cy3 = (p0.y + p1.y + p2.y + p3.y) * 0.25 + ey;
            const cz3 = (p0.z + p1.z + p2.z + p3.z) * 0.25 + ez;

            // Exaktes perspektivisches Backface-Culling gegen Kamera (0, 0, 0)
            const isBackface = (nx * cx3 + ny * cy3 + nz * (cz3 + CAMERA_Z)) >= 0;
            const colorIdx = (faceDef.baseColorIdx + this.paletteOffset) % 6;

            const dotLight = nx * nlx + ny * nly + nz * nlz;
            const shadeVal = clamp(0.30 + lightFillBoost + 0.65 * Math.max(0.0, dotLight), 0, 1);
            const shadeIdx = clamp(Math.round(shadeVal * (SHADE_STEPS - 1)), 0, SHADE_STEPS - 1);

            const useCool = this.afterglowMix > 0.02 &&
                BAYER_4X4[((i & 3) << 2) | (colorIdx & 3)] < this.afterglowMix * 16;

            let hex;
            if (useCool) {
                hex = isBackface
                    ? COLOR_LUT.backCool[colorIdx][shadeIdx]
                    : COLOR_LUT.frontCool[colorIdx][shadeIdx];
            } else {
                hex = isBackface
                    ? COLOR_LUT.backNormal[colorIdx][shadeIdx]
                    : COLOR_LUT.frontNormal[colorIdx][shadeIdx];
            }

            const f = this.facesToDraw[i];
            f.pts = pts;
            f.z = cz3;
            f.isBackface = isBackface;
            f.hex = hex;
            f.isSpecular = false;

            if (!isBackface && dotLight > maxFrontDot) {
                maxFrontDot = dotLight;
                specFrontIdx = i;
            }
        }

        // Specular-Flash auf der hellsten Frontfläche bei Medium/Hard-Impuls
        if (specFrontIdx !== -1 && (this.beatPop > 0.45 || activeSignal > 0.55) && maxFrontDot > 0.45) {
            this.facesToDraw[specFrontIdx].isSpecular = true;
            if (this.activeBeatLevel === 3 && this.beatPop > 0.65) {
                this.facesToDraw[specFrontIdx].hex = LINE_COLORS.frontGold;
            }
        }

        // In-Place-Insertion-Sort (Back-to-front Painter's Order, 0 Allokation)
        for (let i = 1; i < 6; i++) {
            const current = this.facesToDraw[i];
            const currentZ = current.z;
            let j = i - 1;
            while (j >= 0 && this.facesToDraw[j].z < currentZ) {
                this.facesToDraw[j + 1] = this.facesToDraw[j];
                j--;
            }
            this.facesToDraw[j + 1] = current;
        }

        // =========================================================
        // 7. RENDERING: BACKFACES -> CRYSTAL CORE -> FRONTFACES
        // =========================================================
        const backLineHex = this.afterglowMix > 0.5 ? LINE_COLORS.backCool : LINE_COLORS.back;
        const frontLineHex = (this.activeBeatLevel === 3 && this.beatPop > 0.55)
            ? LINE_COLORS.frontGold
            : ((activeSignal > 0.35 || chHigh > 0.45 || this.beatPop > 0.30)
                ? LINE_COLORS.frontBright
                : LINE_COLORS.frontDim);

        // Pass A: Backfaces zuerst (inkl. Back-Wireframe)
        for (let i = 0; i < 6; i++) {
            const face = this.facesToDraw[i];
            if (!face.isBackface) continue;

            this.fillGlenzQuad(ctx, width, height, face.pts, face.hex, true, bayerThreshold);
            const pts = face.pts;
            for (let e = 0; e < 4; e++) {
                const a = pts[e];
                const b = pts[(e + 1) & 3];
                this.drawLine(ctx, width, height, a.x, a.y, b.x, b.y, backLineHex, bayerThreshold);
            }
        }

        // Pass B: Innerer Crystal-Core (leuchtet durch die Glenz-Lücken & offenen Fugen)
        const showCore = state === 'climax' ||
            (state === 'buildup' && (this.tension > 0.50 || activeSignal > 0.25)) ||
            this.faceExplode > 0.04;
        if (showCore) {
            const coreHex = (this.activeBeatLevel === 3 && this.beatPop > 0.50)
                ? LINE_COLORS.coreWhite
                : (this.beatPop > 0.30 || state === 'climax' ? LINE_COLORS.coreGold : LINE_COLORS.coreCyan);
            const coreScale = transitionScale * (0.95 + this.beatPop * 0.22 + activeSignal * 0.10);
            this.drawCrystalCore(ctx, width, height, centerX, centerY, fov, coreScale, coreHex, bayerThreshold);
        }

        // Pass C: Frontfaces (Checkerboard + leuchtende Kristall-Kanten)
        for (let i = 0; i < 6; i++) {
            const face = this.facesToDraw[i];
            if (face.isBackface) continue;

            this.fillGlenzQuad(ctx, width, height, face.pts, face.hex, false, bayerThreshold);
            const pts = face.pts;
            const edgeCol = face.isSpecular ? LINE_COLORS.frontBright : frontLineHex;
            for (let e = 0; e < 4; e++) {
                const a = pts[e];
                const b = pts[(e + 1) & 3];
                this.drawLine(ctx, width, height, a.x, a.y, b.x, b.y, edgeCol, bayerThreshold);
            }
        }
    }
}