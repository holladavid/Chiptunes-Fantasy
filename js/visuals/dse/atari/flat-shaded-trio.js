// =========================================================
// DEMO-SCENE-ELEMENT: ATARI FLAT SHADED TRIO (Foreground DSE)
// Klassische Atari-ST-3D-Vektorkoerper mit Lambert-Flat-Shading.
// Features:
// - 6 planar-normierte Polyeder-Kristalle (Cubocta, Rhombic, Crystal5, Antiprism4, Bipyr6, Octa)
// - Backface-Culling (n.z > 0 & Perspektiv-Sichtstrahl), Painter-Z-Sort (Zero-GC)
// - Front-Hemisphere Wrap-Lambert + 1px Specular-Rim & INK-Kanten (<= 16 Farben)
// - Solides Kristall-Splitting (dunkler Kern statt Hohlraum), Climax-Ghost-Trails & 3D-Weave
// - 4. Beat: reiner Geometrie-Meshwechsel; 8. Beat: Spin-Umkehr + Timer-B-Raster-Wipe
// =========================================================

import {
    drawAliasedLineClipped,
    fillAliasedPolygonClipped
} from '../../utils/hardware-constraints.js';
import { COOL, INK, SETS } from './atari-kit.js';

const T_IN = 1.5;
const T_OUT = 1.5;
const WIPE_DURATION = 0.5;
const NUM_BODIES = 3;
const MAX_VERTS = 16;
const MAX_FACES = 20;

const KMUL = [1.0, 0.70, 0.45];

const FALLBACK_TENSION = {
    playing: 0.30,
    buildup: 0.65,
    climax: 1.0,
    afterglow: 0.20
};

function clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
}

function clamp01(v) {
    return Number.isFinite(v) ? clamp(v, 0, 1) : 0;
}

function lerp(a, b, k) {
    return a + (b - a) * k;
}

function smoothstep(edge0, edge1, x) {
    const t = clamp01((x - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
}

// Gleichmaessige Normierung auf Maximalradius 1 (erhaelt 100% planare Quads!)
function buildMesh(rawVerts, rawFaces) {
    let maxLen = 0;
    for (let i = 0; i < rawVerts.length; i++) {
        const [x, y, z] = rawVerts[i];
        const len = Math.hypot(x, y, z);
        if (len > maxLen) maxLen = len;
    }
    const invMax = maxLen > 0 ? 1 / maxLen : 1;
    const verts = rawVerts.map(([x, y, z]) => Object.freeze([x * invMax, y * invMax, z * invMax]));

    const faces = [];
    const edgeMap = new Map();

    for (let f = 0; f < rawFaces.length; f++) {
        const indices = [...rawFaces[f]];
        let cx = 0, cy = 0, cz = 0;
        for (let k = 0; k < indices.length; k++) {
            const v = verts[indices[k]];
            cx += v[0];
            cy += v[1];
            cz += v[2];
        }
        cx /= indices.length;
        cy /= indices.length;
        cz /= indices.length;

        const v0 = verts[indices[0]];
        const v1 = verts[indices[1]];
        const v2 = verts[indices[2]];
        const ax = v1[0] - v0[0], ay = v1[1] - v0[1], az = v1[2] - v0[2];
        const bx = v2[0] - v0[0], by = v2[1] - v0[1], bz = v2[2] - v0[2];
        let nx = ay * bz - az * by;
        let ny = az * bx - ax * bz;
        let nz = ax * by - ay * bx;

        // Jede Flaechennormale streng nach aussen richten
        if (nx * cx + ny * cy + nz * cz < 0) {
            indices.reverse();
            nx = -nx;
            ny = -ny;
            nz = -nz;
        }

        const nLen = Math.hypot(nx, ny, nz) || 1;
        const faceIdx = faces.length;
        faces.push(Object.freeze({
            indices: Object.freeze(indices),
            normal: Object.freeze([nx / nLen, ny / nLen, nz / nLen]),
            centroid: Object.freeze([cx, cy, cz])
        }));

        for (let k = 0; k < indices.length; k++) {
            const a = indices[k];
            const b = indices[(k + 1) % indices.length];
            const lo = a < b ? a : b;
            const hi = a < b ? b : a;
            const key = (lo << 8) | hi;
            const existing = edgeMap.get(key);
            if (!existing) {
                edgeMap.set(key, { a: lo, b: hi, f0: faceIdx, f1: -1 });
            } else {
                existing.f1 = faceIdx;
            }
        }
    }

    const edges = Array.from(edgeMap.values()).map(e => Object.freeze(e));
    return Object.freeze({
        verts: Object.freeze(verts),
        faces: Object.freeze(faces),
        edges: Object.freeze(edges)
    });
}

// 1. Cuboctahedron (12 Verts, 14 Facetten: 6 Quadrate + 8 Dreiecke)
const CUBOCTA = buildMesh(
    [
        [ 1,  1,  0], [ 1, -1,  0], [-1,  1,  0], [-1, -1,  0],
        [ 1,  0,  1], [ 1,  0, -1], [-1,  0,  1], [-1,  0, -1],
        [ 0,  1,  1], [ 0,  1, -1], [ 0, -1,  1], [ 0, -1, -1]
    ],
    [
        [0, 4, 1, 5], [2, 7, 3, 6],
        [0, 9, 2, 8], [1, 10, 3, 11],
        [4, 8, 6, 10], [5, 11, 7, 9],
        [0, 8, 4], [0, 5, 9], [1, 4, 10], [1, 11, 5],
        [2, 6, 8], [2, 9, 7], [3, 10, 6], [3, 7, 11]
    ]
);

// 2. Rhombendodekaeder (14 Verts, 12 exakt planare Rauten-Facetten)
const RHOMBIC = buildMesh(
    [
        [ 2,  0,  0], [-2,  0,  0], [ 0,  2,  0], [ 0, -2,  0], [ 0,  0,  2], [ 0,  0, -2],
        [ 1,  1,  1], [ 1,  1, -1], [ 1, -1,  1], [ 1, -1, -1],
        [-1,  1,  1], [-1,  1, -1], [-1, -1,  1], [-1, -1, -1]
    ],
    [
        [0, 6, 2, 7],  [0, 9, 3, 8],  [0, 8, 4, 6],  [0, 7, 5, 9],
        [1, 11, 2, 10],[1, 12, 3, 13],[1, 10, 4, 12],[1, 13, 5, 11],
        [2, 6, 4, 10], [2, 11, 5, 7], [3, 12, 4, 8], [3, 9, 5, 13]
    ]
);

// 3. Quadratisches Antiprisma (8 Verts, 10 Facetten: 2 Quadrate + 8 Dreiecke)
const ANTIPRISM4 = buildMesh(
    [
        [ 0.82, -0.62,  0.00], [ 0.00, -0.62,  0.82], [-0.82, -0.62,  0.00], [ 0.00, -0.62, -0.82],
        [ 0.58,  0.62,  0.58], [-0.58,  0.62,  0.58], [-0.58,  0.62, -0.58], [ 0.58,  0.62, -0.58]
    ],
    [
        [0, 3, 2, 1], [4, 5, 6, 7],
        [0, 1, 4], [1, 5, 4], [1, 2, 5], [2, 6, 5],
        [2, 3, 6], [3, 7, 6], [3, 0, 7], [0, 4, 7]
    ]
);

// 4. 5-seitiger geschliffener Kristall (12 Verts, 15 Facetten)
const CRYSTAL5 = buildMesh(
    [
        [0, -1.0, 0],
        ...Array.from({ length: 5 }, (_, k) => [0.76 * Math.cos((k * 2 * Math.PI) / 5), -0.34, 0.76 * Math.sin((k * 2 * Math.PI) / 5)]),
        ...Array.from({ length: 5 }, (_, k) => [0.76 * Math.cos((k * 2 * Math.PI) / 5),  0.34, 0.76 * Math.sin((k * 2 * Math.PI) / 5)]),
        [0, 1.0, 0]
    ],
    [
        ...Array.from({ length: 5 }, (_, k) => [0, 1 + ((k + 1) % 5), 1 + k]),
        ...Array.from({ length: 5 }, (_, k) => [1 + k, 1 + ((k + 1) % 5), 6 + ((k + 1) % 5), 6 + k]),
        ...Array.from({ length: 5 }, (_, k) => [11, 6 + k, 6 + ((k + 1) % 5)])
    ]
);

// 5. Oktaeder (6 Verts, 8 Facetten)
const OCTA = buildMesh(
    [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]],
    [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [0, 4, 3], [4, 1, 3], [1, 5, 3], [5, 0, 3]]
);

// 6. Hexagonale Bipyramide (8 Verts, 12 Facetten)
const BIPYR6 = buildMesh(
    [
        [0, -1, 0],
        [0, 1, 0],
        ...Array.from({ length: 6 }, (_, k) => [0.92 * Math.cos((k * Math.PI) / 3), 0, 0.92 * Math.sin((k * Math.PI) / 3)])
    ],
    [
        ...Array.from({ length: 6 }, (_, k) => [0, 2 + k, 2 + ((k + 1) % 6)]),
        ...Array.from({ length: 6 }, (_, k) => [1, 2 + ((k + 1) % 6), 2 + k])
    ]
);

const MESHSETS = Object.freeze([
    Object.freeze([CUBOCTA, RHOMBIC, ANTIPRISM4]),
    Object.freeze([CRYSTAL5, BIPYR6, CUBOCTA]),
    Object.freeze([RHOMBIC, ANTIPRISM4, OCTA]),
    Object.freeze([ANTIPRISM4, CRYSTAL5, RHOMBIC])
]);

export class AtariFlatShadedTrio {
    constructor() {
        this.name = 'Atari Flat Shaded Trio';

        // Zeit- & Zustandsverwaltung
        this.lastT = null;
        this.lastState = 'idle';
        this.stateAge = 0;
        this.simAcc = 0;
        this.simT = 0;

        // Geglaettete Tension & Rotation/Licht-Phasen
        this.ten = 0.30;
        this.tenInit = false;
        this.omega = 0.8;
        this.spinSign = 1;
        this.lightAngle = 0.4;
        this.lightPhase = 0;

        // 3x3 integrierte Euler-Winkel (Startphase 0.3 * i)
        this.angles = new Float32Array([
            0.0, 0.0, 0.0,
            0.3, 0.3, 0.3,
            0.6, 0.6, 0.6
        ]);

        // Beat- & Meshwechsel-Zustand
        this.lastBeatCount = -1;
        this.hardCooldown = 0;
        this.hardFlashTimer = 0;
        this.hardBody = 0;
        this.boom = new Float32Array(NUM_BODIES);

        this.meshSet = 0;
        this.nextMeshSet = 0;
        this.meshPhase = 'idle'; // 'idle' | 'shrinking' | 'growing'
        this.meshAge = 0;
        this.shrink = 1.0;

        // Familien- & Timer-B-Raster-Wipe Zustand
        this.setIdx = 0;
        this.inAfterglow = false;
        this.wipeFrom = SETS[0];
        this.wipeTo = SETS[0];
        this.wipeAge = WIPE_DURATION;

        // Fest allokierte 3D-Arbeits-Puffer (Zero-GC im Renderloop)
        this.rotX = new Float32Array(MAX_VERTS);
        this.rotY = new Float32Array(MAX_VERTS);
        this.rotZ = new Float32Array(MAX_VERTS);
        this.projX = new Float32Array(MAX_VERTS);
        this.projY = new Float32Array(MAX_VERTS);

        this.ghostX = new Float32Array(MAX_VERTS);
        this.ghostY = new Float32Array(MAX_VERTS);
        this.ghostVis = new Uint8Array(MAX_FACES);

        this.faceVisible = new Uint8Array(MAX_FACES);
        this.faceDepth = new Float32Array(MAX_FACES);
        this.faceStage = new Uint8Array(MAX_FACES);
        this.faceNx = new Float32Array(MAX_FACES);
        this.faceNy = new Float32Array(MAX_FACES);
        this.faceNz = new Float32Array(MAX_FACES);
        this.sortOrder = new Uint8Array(MAX_FACES);
        this.bodyOrder = new Uint8Array(NUM_BODIES);
        this.bodyDepth = new Float32Array(NUM_BODIES);

        this.polyBuf3 = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];
        this.polyBuf4 = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];
    }

    resize() {
        // Layout auf der langen Achse & minDim-Radius passen sich nahtlos an.
    }

    _startWipe(nextSet) {
        if (this.wipeTo === nextSet) return;
        if (this.wipeAge < WIPE_DURATION) {
            // Bei ueberlappendem Wipe ueberhalb der Mitte direkt von wipeTo weiterwischen
            this.wipeFrom = this.wipeAge >= WIPE_DURATION * 0.5 ? this.wipeTo : this.wipeFrom;
        } else {
            this.wipeFrom = this.wipeTo;
        }
        this.wipeTo = nextSet;
        this.wipeAge = 0;
    }

    _stepSimulation(stepDt, chVals, isAfterglow) {
        const speedMul = isAfterglow ? 0.30 : 1.0;
        this.simT += stepDt * speedMul;

        this.omega = lerp(0.5, 1.6, this.ten) * speedMul;
        for (let i = 0; i < NUM_BODIES; i++) {
            const chMul = 1 + 1.5 * chVals[i];
            const base = i * 3;
            for (let k = 0; k < 3; k++) {
                this.angles[base + k] += this.omega * KMUL[k] * chMul * stepDt * this.spinSign;
            }
        }

        const lightSpeed = lerp(0.3, 1.4, this.ten) * speedMul;
        this.lightPhase += lightSpeed * stepDt;

        // 4.-Beat-Meshwechsel (0,15 s schrumpfen -> Wechsel -> 0,25 s wachsen)
        if (this.meshPhase === 'shrinking') {
            this.meshAge += stepDt;
            this.shrink = Math.max(0, 1 - this.meshAge / 0.15);
            if (this.meshAge >= 0.15) {
                this.meshSet = this.nextMeshSet;
                this.meshPhase = 'growing';
                this.meshAge = 0;
                this.shrink = 0;
            }
        } else if (this.meshPhase === 'growing') {
            this.meshAge += stepDt;
            this.shrink = Math.min(1, this.meshAge / 0.25);
            if (this.meshAge >= 0.25) {
                this.meshPhase = 'idle';
                this.shrink = 1.0;
            }
        }
    }

    _computeRotMatrix(ax, ay, az) {
        const cx = Math.cos(ax), sx = Math.sin(ax);
        const cy = Math.cos(ay), sy = Math.sin(ay);
        const cz = Math.cos(az), sz = Math.sin(az);
        // R = Rz * Ry * Rx
        return [
            cy * cz, cz * sx * sy - cx * sz, cx * cz * sy + sx * sz,
            cy * sz, cx * cz + sx * sy * sz, cx * sy * sz - cz * sx,
            -sy,     cy * sx,                cx * cy
        ];
    }

    _rampColor(bodyIdx, stage, y, wipeY) {
        const rampSet = y < wipeY ? this.wipeTo : this.wipeFrom;
        return rampSet[bodyIdx][stage];
    }

    _drawPolygonSplit(ctx, pts, bodyIdx, stage, w, h, wipeY) {
        if (wipeY > 0 && wipeY < h) {
            let minY = pts[0].y;
            let maxY = pts[0].y;
            for (let k = 1; k < pts.length; k++) {
                if (pts[k].y < minY) minY = pts[k].y;
                if (pts[k].y > maxY) maxY = pts[k].y;
            }
            if (minY < wipeY) {
                fillAliasedPolygonClipped(ctx, pts, this.wipeTo[bodyIdx][stage], false, {
                    x: 0, y: 0, w, h: wipeY
                });
            }
            if (maxY >= wipeY) {
                fillAliasedPolygonClipped(ctx, pts, this.wipeFrom[bodyIdx][stage], false, {
                    x: 0, y: wipeY, w, h: h - wipeY
                });
            }
            return;
        }
        const rampSet = wipeY > 0 ? this.wipeTo : this.wipeFrom;
        fillAliasedPolygonClipped(ctx, pts, rampSet[bodyIdx][stage], false, {
            x: 0, y: 0, w, h
        });
    }

    _drawSplitLine(ctx, x0, y0, x1, y1, bodyIdx, stage, w, h, wipeY, clipFull) {
        if (wipeY > 0 && wipeY < h) {
            const minY = Math.min(y0, y1);
            const maxY = Math.max(y0, y1);
            if (minY < wipeY) {
                drawAliasedLineClipped(ctx, x0, y0, x1, y1, this.wipeTo[bodyIdx][stage], {
                    x: 0, y: 0, w, h: wipeY
                });
            }
            if (maxY >= wipeY) {
                drawAliasedLineClipped(ctx, x0, y0, x1, y1, this.wipeFrom[bodyIdx][stage], {
                    x: 0, y: wipeY, w, h: h - wipeY
                });
            }
            return;
        }
        const rampSet = wipeY > 0 ? this.wipeTo : this.wipeFrom;
        drawAliasedLineClipped(ctx, x0, y0, x1, y1, rampSet[bodyIdx][stage], clipFull);
    }

    render(ctx, width, height, t, state = 'playing', stateTime = 0, metrics = {}) {
        if (width <= 0 || height <= 0 || !Number.isFinite(width / height)) {
            this.lastT = t;
            return;
        }
        if (!ctx || !Number.isFinite(t)) return;

        const w = Math.floor(width);
        const h = Math.floor(height);
        if (w <= 0 || h <= 0) {
            this.lastT = t;
            return;
        }

        if (state === 'idle') {
            this.lastT = t;
            this.lastState = 'idle';
            this.stateAge = 0;
            return;
        }

        let dt = this.lastT === null ? 0.02 : (t - this.lastT);
        this.lastT = t;
        if (!Number.isFinite(dt) || dt < 0) dt = 0.02;
        else if (dt > 0.1) dt = 0.1;

        if (this.lastState !== state) {
            if (state === 'starting') {
                this.lastBeatCount = -1;
            }
            this.lastState = state;
            this.stateAge = 0;
        } else {
            this.stateAge += dt;
        }

        const safeStateTime = Number.isFinite(stateTime) && stateTime >= 0 ? stateTime : this.stateAge;
        let vis = 1;
        if (state === 'starting') vis = clamp01(safeStateTime / T_IN);
        else if (state === 'stopping') vis = 1 - clamp01(safeStateTime / T_OUT);

        this.hardCooldown = Math.max(0, this.hardCooldown - dt);
        this.hardFlashTimer = Math.max(0, this.hardFlashTimer - dt);
        this.wipeAge = Math.min(WIPE_DURATION, this.wipeAge + dt);

        const kBoom = Math.exp(-dt / 0.12);
        for (let i = 0; i < NUM_BODIES; i++) {
            this.boom[i] *= kBoom;
            if (this.boom[i] < 1e-4) this.boom[i] = 0;
        }

        // Tension (asymmetrisch geglaettet; Frame 0 snappt fuer warmup:0-Stills)
        const safeMetrics = metrics || {};
        let targetTen = clamp01(safeMetrics.tensionPct ?? FALLBACK_TENSION[state] ?? 0.2);
        if (state === 'afterglow') targetTen = Math.min(targetTen, 0.30);
        if (state === 'starting' || state === 'stopping') targetTen = Math.min(targetTen, 0.25);

        const isAfterglow = state === 'afterglow';
        if (!this.tenInit) {
            this.ten = targetTen;
            this.omega = lerp(0.5, 1.6, this.ten) * (isAfterglow ? 0.30 : 1.0);
            this.tenInit = true;
        } else {
            const tau = targetTen > this.ten ? 0.30 : 0.90;
            this.ten += (targetTen - this.ten) * (1 - Math.exp(-dt / tau));
        }

        // Defensives Lesen der Musikmetriken & YM2149-Stimmen (A=0, B=1, C=2)
        const impulse = clamp01(safeMetrics.beatImpulse?.[0] ?? safeMetrics.beat?.[0] ?? 0);
        const smooth = (Array.isArray(safeMetrics.smooth) || ArrayBuffer.isView(safeMetrics.smooth))
            ? safeMetrics.smooth
            : null;
        const ch0 = smooth && Number.isFinite(smooth[0]) ? clamp01(smooth[0]) : 0;
        const ch1 = smooth && Number.isFinite(smooth[1]) ? clamp01(smooth[1]) : 0;
        const ch2 = smooth && Number.isFinite(smooth[2]) ? clamp01(smooth[2]) : 0;
        const chVals = [ch0, ch1, ch2];

        // Diskretes Beat-Event
        let onBeat = false;
        if (safeMetrics.beatStarted === true) {
            const nextCount = Number.isFinite(safeMetrics.beatCount)
                ? safeMetrics.beatCount
                : (this.lastBeatCount < 0 ? 1 : this.lastBeatCount + 1);
            if (nextCount !== this.lastBeatCount) {
                this.lastBeatCount = nextCount;
                onBeat = true;
            }
        }
        const count = Math.max(0, this.lastBeatCount);
        const level = !onBeat ? 0 : (
            [1, 2, 3].includes(safeMetrics.beatLevel)
                ? safeMetrics.beatLevel
                : (s => (s < 1 / 3 ? 1 : (s < 2 / 3 ? 2 : 3)))(
                    Number.isFinite(safeMetrics.beatStrength) ? safeMetrics.beatStrength : 1
                )
        );

        // Afterglow-Palettenwechsel per Raster-Wipe
        if (isAfterglow && !this.inAfterglow) {
            this.inAfterglow = true;
            this._startWipe(COOL);
        } else if (!isAfterglow && this.inAfterglow) {
            this.inAfterglow = false;
            this._startWipe(SETS[this.setIdx]);
        }

        if (onBeat) {
            let bestC = 0;
            if (ch1 > chVals[bestC]) bestC = 1;
            if (ch2 > chVals[bestC]) bestC = 2;

            if (level === 1) {
                this.lightAngle += Math.PI / 6;
            } else if (level === 2) {
                if (!isAfterglow) this.boom[bestC] = 0.25;
            } else if (level === 3) {
                if (!isAfterglow) {
                    for (let i = 0; i < NUM_BODIES; i++) this.boom[i] = 0.30;
                    if (this.hardCooldown <= 0) {
                        this.hardCooldown = 0.25;
                        this.hardBody = bestC;
                        this.hardFlashTimer = 0.12;
                    }
                }
            }

            if (!isAfterglow && count > 0 && count % 4 === 0) {
                this.nextMeshSet = (this.meshSet + 1) & 3;
                this.meshPhase = 'shrinking';
                this.meshAge = 0;
            }

            if (count > 0 && count % 8 === 0) {
                this.spinSign = -this.spinSign;
                if (!isAfterglow) {
                    this.setIdx = (this.setIdx + 1) & 1;
                    this._startWipe(SETS[this.setIdx]);
                }
            }
        }

        // Simulation im festen 50-Hz-Schritt
        this.simAcc += dt;
        let steps = 0;
        while (this.simAcc >= 0.02 && steps++ < 4) {
            this._stepSimulation(0.02, chVals, isAfterglow);
            this.simAcc -= 0.02;
        }

        if (vis <= 0 || this.shrink <= 0.001) {
            return;
        }

        // =========================================================
        // FRONT-HEMISPHERE KEY LIGHT, LAYOUT & RASTER-WIPE
        // =========================================================
        const lam = this.lightAngle + this.lightPhase;
        const lxRaw = 0.72 * Math.cos(lam);
        const lyRaw = -0.58 + 0.18 * Math.sin(lam * 0.7);
        const lzRaw = 0.85 + 0.23 * Math.sin(lam); // bleibt immer vor der Kamera!
        const lInv = 1 / (Math.hypot(lxRaw, lyRaw, lzRaw) || 1);
        const Lx = lxRaw * lInv;
        const Ly = lyRaw * lInv;
        const Lz = lzRaw * lInv;

        const isLandscape = w >= h;
        const longDim = Math.max(w, h);
        const minDim = Math.min(w, h);
        const spacing = Math.min(longDim / 3, 0.95 * minDim);
        const lcenter = 0.5 * longDim;

        const scaleState = isAfterglow ? 0.74 : lerp(0.76, 1.06, this.ten);
        const baseExplode = isAfterglow ? 0 : 0.05 * smoothstep(0.72, 1.0, this.ten);
        const wipeY = this.wipeAge < WIPE_DURATION
            ? Math.floor((this.wipeAge / WIPE_DURATION) * h)
            : h;
        const clipFull = { x: 0, y: 0, w, h };

        // Makrozustandsspezifische Choreografie
        const isClimax = state === 'climax';
        const isBuildup = state === 'buildup';
        const waveAmp = isAfterglow
            ? 0.03 * minDim
            : (isClimax ? 0.15 * minDim : (isBuildup ? 0.10 * minDim : 0.05 * minDim));
        const orbitAmp = isClimax ? 0.09 * minDim : 0;
        const showGhostTrail = isClimax && vis >= 0.95 && minDim >= 64;

        // Cross-Body Tiefensortierung im Climax (in playing/buildup fest 0,1,2 -> volle Kanalisolation)
        for (let i = 0; i < NUM_BODIES; i++) {
            this.bodyOrder[i] = i;
            this.bodyDepth[i] = isClimax ? Math.sin(this.simT * 1.4 + i * 2.094) * 0.42 : 0;
        }
        if (isClimax) {
            for (let a = 1; a < NUM_BODIES; a++) {
                const key = this.bodyOrder[a];
                const d = this.bodyDepth[key];
                let b = a - 1;
                while (b >= 0 && this.bodyDepth[this.bodyOrder[b]] > d) {
                    this.bodyOrder[b + 1] = this.bodyOrder[b];
                    b--;
                }
                this.bodyOrder[b + 1] = key;
            }
        }

        // =========================================================
        // 3 KOERPER TRANSFORMIEREN, SORTIEREN & RASTERN
        // =========================================================
        for (let bi = 0; bi < NUM_BODIES; bi++) {
            const i = this.bodyOrder[bi];
            const visI = clamp01((vis - 0.2 * i) / (1 - 0.2 * i));
            const depthScale = isClimax ? (4 / (4 - this.bodyDepth[i])) : 1.0;

            // Saubere Maximal-Radius-Kalibrierung gegen Clipping & Ueberlappung
            const R = 0.21 * minDim * scaleState * depthScale * (0.78 + 0.34 * chVals[i]) * (1 + 0.18 * impulse) * visI * this.shrink;
            if (R < 0.8) continue;

            const phasePos = this.simT * (isClimax ? 1.5 : 0.95) + i * 2.094;
            const posLong = lcenter + (i - 1) * spacing + Math.cos(phasePos) * orbitAmp;
            const posShort = 0.5 * minDim + waveAmp * Math.sin(phasePos * (isBuildup ? 1.35 : 1.0));
            const cx = isLandscape ? posLong : posShort;
            const cy = isLandscape ? posShort : posLong;

            const mesh = MESHSETS[this.meshSet][i];
            const verts = mesh.verts;
            const faces = mesh.faces;
            const edges = mesh.edges;
            const baseAng = i * 3;
            const ax = this.angles[baseAng];
            const ay = this.angles[baseAng + 1];
            const az = this.angles[baseAng + 2];

            // ---------------------------------------------------------
            // CLIMAX OPAQUE WIREFRAME ECHO-TRAIL (Zero Alpha!)
            // ---------------------------------------------------------
            if (showGhostTrail) {
                const lag = 0.20 * this.spinSign;
                const gm = this._computeRotMatrix(
                    ax - lag * KMUL[0],
                    ay - lag * KMUL[1],
                    az - lag * KMUL[2]
                );
                const gCx = cx - Math.cos(phasePos) * orbitAmp * 0.35 - (isLandscape ? 3 * this.spinSign : 0);
                const gCy = cy - Math.sin(phasePos) * waveAmp * 0.14;
                const gR = R * 0.96;

                for (let v = 0; v < verts.length; v++) {
                    const vx = verts[v][0], vy = verts[v][1], vz = verts[v][2];
                    const rx = gm[0] * vx + gm[1] * vy + gm[2] * vz;
                    const ry = gm[3] * vx + gm[4] * vy + gm[5] * vz;
                    const rz = gm[6] * vx + gm[7] * vy + gm[8] * vz;
                    const persp = 4 / (4 - rz);
                    this.ghostX[v] = Math.round(gCx + rx * gR * persp);
                    this.ghostY[v] = Math.round(gCy + ry * gR * persp);
                }
                for (let f = 0; f < faces.length; f++) {
                    const fn = faces[f].normal;
                    const nz = gm[6] * fn[0] + gm[7] * fn[1] + gm[8] * fn[2];
                    this.ghostVis[f] = nz > 0 ? 1 : 0;
                }
                for (let ei = 0; ei < edges.length; ei++) {
                    const e = edges[ei];
                    const v0 = this.ghostVis[e.f0] === 1;
                    const v1 = e.f1 >= 0 && this.ghostVis[e.f1] === 1;
                    if (v0 === v1) continue; // nur saubere Aussen-Silhouette als Echo!
                    this._drawSplitLine(
                        ctx,
                        this.ghostX[e.a], this.ghostY[e.a],
                        this.ghostX[e.b], this.ghostY[e.b],
                        i, 1, w, h, wipeY, clipFull
                    );
                }
            }

            // ---------------------------------------------------------
            // HAUPTKOERPER TRANSFORMIEREN (Integer Vertex Snap!)
            // ---------------------------------------------------------
            const m = this._computeRotMatrix(ax, ay, az);
            for (let v = 0; v < verts.length; v++) {
                const vx = verts[v][0], vy = verts[v][1], vz = verts[v][2];
                const rx = m[0] * vx + m[1] * vy + m[2] * vz;
                const ry = m[3] * vx + m[4] * vy + m[5] * vz;
                const rz = m[6] * vx + m[7] * vy + m[8] * vz;
                this.rotX[v] = rx;
                this.rotY[v] = ry;
                this.rotZ[v] = rz;
                const persp = 4 / (4 - rz);
                this.projX[v] = Math.round(cx + rx * R * persp);
                this.projY[v] = Math.round(cy + ry * R * persp);
            }

            const explode = isAfterglow ? 0 : (baseExplode + this.boom[i]);
            const explodedMode = explode > 0.001;
            const isHardFlashing = !isAfterglow && this.hardFlashTimer > 0 && i === this.hardBody;

            // Dunkler innerer Kristallkern im Explode-Zustand (verhindert Hohlraum-Luecken!)
            if (explodedMode && R >= 4) {
                const coreScale = Math.max(0.55, 1.0 - 0.35 * explode);
                for (let f = 0; f < faces.length; f++) {
                    const face = faces[f];
                    const fn = face.normal;
                    const nz = m[6] * fn[0] + m[7] * fn[1] + m[8] * fn[2];
                    if (nz <= 0) continue;
                    const idxList = face.indices;
                    const len = idxList.length;
                    const pts = len === 3 ? this.polyBuf3 : this.polyBuf4;
                    for (let k = 0; k < len; k++) {
                        const vi = idxList[k];
                        const persp = 4 / (4 - this.rotZ[vi] * coreScale);
                        pts[k].x = Math.round(cx + this.rotX[vi] * coreScale * R * persp);
                        pts[k].y = Math.round(cy + this.rotY[vi] * coreScale * R * persp);
                    }
                    fillAliasedPolygonClipped(ctx, pts, INK, false, clipFull);
                }
            }

            this.faceVisible.fill(0);
            let visCount = 0;

            for (let f = 0; f < faces.length; f++) {
                const face = faces[f];
                const fn = face.normal;
                const fc = face.centroid;

                const nx = m[0] * fn[0] + m[1] * fn[1] + m[2] * fn[2];
                const ny = m[3] * fn[0] + m[4] * fn[1] + m[5] * fn[2];
                const nz = m[6] * fn[0] + m[7] * fn[1] + m[8] * fn[2];

                const fcx = m[0] * fc[0] + m[1] * fc[1] + m[2] * fc[2];
                const fcy = m[3] * fc[0] + m[4] * fc[1] + m[5] * fc[2];
                const fcz = m[6] * fc[0] + m[7] * fc[1] + m[8] * fc[2];
                const viewDot = fcx * nx + fcy * ny + (fcz - 4) * nz;

                // Strenges Backface-Culling (normale Z > 0 & perspektivischer Sichtstrahl)
                if (nz <= 0 || viewDot >= 0) {
                    continue;
                }

                this.faceVisible[f] = 1;
                this.faceNx[f] = nx;
                this.faceNy[f] = ny;
                this.faceNz[f] = nz;

                // Wrap-Lambert + kontinuierliche Kanal-/Beat-Modulation (kein Schwarz-Absaufen!)
                const dot = nx * Lx + ny * Ly + nz * Lz;
                const key = dot > 0 ? dot : 0;
                const wrap = clamp01((dot + 0.55) / 1.55);
                const shade = clamp01(
                    (isAfterglow ? 0.16 : 0.22)
                    + 0.46 * wrap
                    + 0.22 * key * key
                    + 0.16 * chVals[i]
                    + (isAfterglow ? 0.04 : 0.14) * impulse
                );

                // Stage 4 bewusst als Glanzlicht-Spitze reservieren; Hard-Flash behaelt 3D-Kontrast!
                let stage;
                if (shade >= 0.84) stage = 4;
                else if (shade >= 0.62) stage = 3;
                else if (shade >= 0.40) stage = 2;
                else if (shade >= 0.22) stage = 1;
                else stage = 0;

                if (isHardFlashing) {
                    stage = stage >= 1 ? 4 : 2;
                }
                this.faceStage[f] = stage;

                let avgZ = 0;
                const idxList = face.indices;
                for (let k = 0; k < idxList.length; k++) {
                    avgZ += this.rotZ[idxList[k]];
                }
                this.faceDepth[f] = (avgZ / idxList.length) + explode * nz;
                this.sortOrder[visCount++] = f;
            }

            // Insertion Sort nach mittlerer Tiefe (hinten -> vorne)
            for (let a = 1; a < visCount; a++) {
                const keyFace = this.sortOrder[a];
                const keyDepth = this.faceDepth[keyFace];
                let b = a - 1;
                while (b >= 0 && this.faceDepth[this.sortOrder[b]] > keyDepth) {
                    this.sortOrder[b + 1] = this.sortOrder[b];
                    b--;
                }
                this.sortOrder[b + 1] = keyFace;
            }

            // Flaechen rastern (+ geschlossene Kanten je Splitter bei Explode)
            for (let si = 0; si < visCount; si++) {
                const f = this.sortOrder[si];
                const face = faces[f];
                const idxList = face.indices;
                const len = idxList.length;
                const pts = len === 3 ? this.polyBuf3 : this.polyBuf4;

                if (!explodedMode) {
                    for (let k = 0; k < len; k++) {
                        const vi = idxList[k];
                        pts[k].x = this.projX[vi];
                        pts[k].y = this.projY[vi];
                    }
                    this._drawPolygonSplit(ctx, pts, i, this.faceStage[f], w, h, wipeY);
                } else {
                    const ox = explode * this.faceNx[f];
                    const oy = explode * this.faceNy[f];
                    const oz = explode * this.faceNz[f];
                    for (let k = 0; k < len; k++) {
                        const vi = idxList[k];
                        const px3 = this.rotX[vi] + ox;
                        const py3 = this.rotY[vi] + oy;
                        const pz3 = this.rotZ[vi] + oz;
                        const persp = 4 / (4 - pz3);
                        pts[k].x = Math.round(cx + px3 * R * persp);
                        pts[k].y = Math.round(cy + py3 * R * persp);
                    }
                    this._drawPolygonSplit(ctx, pts, i, this.faceStage[f], w, h, wipeY);
                    const edgeStage = this.faceStage[f] >= 2 ? 4 : 2;
                    for (let k = 0; k < len; k++) {
                        const p0 = pts[k];
                        const p1 = pts[(k + 1) % len];
                        if (this.faceStage[f] >= 2) {
                            this._drawSplitLine(ctx, p0.x, p0.y, p1.x, p1.y, i, edgeStage, w, h, wipeY, clipFull);
                        } else {
                            drawAliasedLineClipped(ctx, p0.x, p0.y, p1.x, p1.y, INK, clipFull);
                        }
                    }
                }
            }

            // Deduplizierter ST-Specular- & INK-Kantenpass im kompakten Zustand
            if (!explodedMode) {
                for (let ei = 0; ei < edges.length; ei++) {
                    const e = edges[ei];
                    const v0 = this.faceVisible[e.f0] === 1;
                    const v1 = e.f1 >= 0 && this.faceVisible[e.f1] === 1;
                    if (!v0 && !v1) continue;

                    const x0 = this.projX[e.a], y0 = this.projY[e.a];
                    const x1 = this.projX[e.b], y1 = this.projY[e.b];

                    if (v0 !== v1) {
                        // Aussen-Silhouette: beleuchtete Raender erhalten hellen Specular-Rim statt Schwarz!
                        const vf = v0 ? e.f0 : e.f1;
                        const st = this.faceStage[vf];
                        if (st >= 2) {
                            this._drawSplitLine(ctx, x0, y0, x1, y1, i, isAfterglow ? 3 : 4, w, h, wipeY, clipFull);
                        } else {
                            // Auf Schatten-Silhouetten feiner Mittelton-Rand fuer Kontrast vor dunklen Stages
                            this._drawSplitLine(ctx, x0, y0, x1, y1, i, 1, w, h, wipeY, clipFull);
                        }
                    } else {
                        // Innere Falte zwischen zwei sichtbaren Facetten
                        const s0 = this.faceStage[e.f0];
                        const s1 = this.faceStage[e.f1];
                        const maxS = s0 > s1 ? s0 : s1;
                        const minS = s0 < s1 ? s0 : s1;
                        if (maxS >= 3 && minS >= 2) {
                            this._drawSplitLine(ctx, x0, y0, x1, y1, i, isAfterglow ? 3 : 4, w, h, wipeY, clipFull);
                        } else if (s0 === s1 || minS === 0) {
                            drawAliasedLineClipped(ctx, x0, y0, x1, y1, INK, clipFull);
                        }
                    }
                }
            }
        }
    }
}