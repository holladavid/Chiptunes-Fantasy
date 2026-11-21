// =========================================================
// DEMO-SCENE-ELEMENT: ATARI FLAT SHADED TRIO (Foreground DSE)
// Klassische Atari-ST-3D-Vektorkoerper mit Lambert-Flat-Shading.
// Features:
// - 6 auf Umkugelradius 1 normierte Polyeder mit vorab berechneten CCW-Normalen
// - Backface-Culling (n.z <= 0 & Perspektiv-Sichtstrahl), Painter-Z-Sort (Zero-GC)
// - 5-stufiges Flat-Shading pro YM2149-Stimme + 1px INK-Kantenpass (max 16 Farben)
// - 4. Beat: reiner Geometrie-Meshwechsel (0,15 s Schrumpf + 0,25 s Wuchs)
// - 8. Beat: Spin-Umkehr + Timer-B-Raster-Wipe; gestaffeltes visI-Ein-/Ausblenden
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
const MAX_VERTS = 8;
const MAX_FACES = 12;

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

function buildMesh(rawVerts, rawFaces) {
    const verts = rawVerts.map(([x, y, z]) => {
        const len = Math.hypot(x, y, z) || 1;
        return Object.freeze([x / len, y / len, z / len]);
    });

    const faces = [];
    const edgeMap = new Map();

    for (let f = 0; f < rawFaces.length; f++) {
        let indices = [...rawFaces[f]];
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

        // Sicherstellen, dass jede Normale streng nach aussen zeigt
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

const CUBE = buildMesh(
    [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
    [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [0, 4, 7, 3], [1, 2, 6, 5]]
);

const OCTA = buildMesh(
    [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]],
    [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [0, 4, 3], [4, 1, 3], [1, 5, 3], [5, 0, 3]]
);

const TETRA = buildMesh(
    [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]],
    [[0, 1, 2], [0, 2, 3], [0, 3, 1], [1, 3, 2]]
);

const PRISM3 = buildMesh(
    [
        [Math.cos(0), -0.75, Math.sin(0)],
        [Math.cos((2 * Math.PI) / 3), -0.75, Math.sin((2 * Math.PI) / 3)],
        [Math.cos((4 * Math.PI) / 3), -0.75, Math.sin((4 * Math.PI) / 3)],
        [Math.cos(0), 0.75, Math.sin(0)],
        [Math.cos((2 * Math.PI) / 3), 0.75, Math.sin((2 * Math.PI) / 3)],
        [Math.cos((4 * Math.PI) / 3), 0.75, Math.sin((4 * Math.PI) / 3)]
    ],
    [[0, 1, 2], [3, 5, 4], [0, 3, 4, 1], [1, 4, 5, 2], [2, 5, 3, 0]]
);

const PYRAMID4 = buildMesh(
    [[0, -1, 0], [-0.8, 0.55, -0.8], [0.8, 0.55, -0.8], [0.8, 0.55, 0.8], [-0.8, 0.55, 0.8]],
    [[1, 2, 3, 4], [0, 1, 2], [0, 2, 3], [0, 3, 4], [0, 4, 1]]
);

const BIPYR6 = buildMesh(
    [
        [0, -1, 0],
        [0, 1, 0],
        ...Array.from({ length: 6 }, (_, k) => [Math.cos((k * Math.PI) / 3), 0, Math.sin((k * Math.PI) / 3)])
    ],
    [
        ...Array.from({ length: 6 }, (_, k) => [0, 2 + k, 2 + ((k + 1) % 6)]),
        ...Array.from({ length: 6 }, (_, k) => [1, 2 + ((k + 1) % 6), 2 + k])
    ]
);

const MESHSETS = Object.freeze([
    Object.freeze([CUBE, OCTA, TETRA]),
    Object.freeze([PRISM3, PYRAMID4, BIPYR6]),
    Object.freeze([OCTA, CUBE, PYRAMID4]),
    Object.freeze([TETRA, BIPYR6, PRISM3])
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

        this.faceVisible = new Uint8Array(MAX_FACES);
        this.faceDepth = new Float32Array(MAX_FACES);
        this.faceStage = new Uint8Array(MAX_FACES);
        this.faceNx = new Float32Array(MAX_FACES);
        this.faceNy = new Float32Array(MAX_FACES);
        this.faceNz = new Float32Array(MAX_FACES);
        this.sortOrder = new Uint8Array(MAX_FACES);

        this.polyBuf3 = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];
        this.polyBuf4 = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];
    }

    resize() {
        // Layout auf der langen Achse & minDim-Radius passen sich nahtlos an.
    }

    _startWipe(nextSet) {
        if (this.wipeTo === nextSet) return;
        this.wipeFrom = this.wipeAge < WIPE_DURATION ? this.wipeFrom : this.wipeTo;
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
            // Foreground endet ohne Schwarz-Vorhang sauber bei 0 Ops
            return;
        }

        // =========================================================
        // LICHTVEKTOR, LAYOUT & RASTER-WIPE-PARAMETER
        // =========================================================
        const lam = this.lightAngle + this.lightPhase;
        const lxRaw = 0.6 * Math.cos(lam);
        const lyRaw = -0.5;
        const lzRaw = 0.6 * Math.sin(lam) + 0.6;
        const lInv = 1 / (Math.hypot(lxRaw, lyRaw, lzRaw) || 1);
        const Lx = lxRaw * lInv;
        const Ly = lyRaw * lInv;
        const Lz = lzRaw * lInv;

        const isLandscape = w >= h;
        const longDim = Math.max(w, h);
        const minDim = Math.min(w, h);
        const spacing = Math.min(longDim / 3, 0.95 * minDim);
        const lcenter = 0.5 * longDim;
        const scaleState = isAfterglow ? 0.70 : lerp(0.72, 1.10, this.ten);
        const baseExplode = isAfterglow ? 0 : 0.06 * smoothstep(0.70, 1.0, this.ten);
        const wipeY = this.wipeAge < WIPE_DURATION
            ? Math.floor((this.wipeAge / WIPE_DURATION) * h)
            : h;
        const clipFull = { x: 0, y: 0, w, h };

        // =========================================================
        // 3 KOERPER TRANSFORMIEREN, SORTIEREN & RASTERN
        // =========================================================
        for (let i = 0; i < NUM_BODIES; i++) {
            const visI = clamp01((vis - 0.2 * i) / (1 - 0.2 * i));
            const R = 0.30 * minDim * scaleState * (0.75 + 0.5 * chVals[i]) * (1 + 0.30 * impulse) * visI * this.shrink;
            if (R < 0.8) continue;

            const posLong = lcenter + (i - 1) * spacing;
            const posShort = 0.5 * minDim + 0.04 * minDim * Math.sin(0.8 * this.simT + 2.1 * i);
            const cx = isLandscape ? posLong : posShort;
            const cy = isLandscape ? posShort : posLong;

            const mesh = MESHSETS[this.meshSet][i];
            const baseAng = i * 3;
            const ax = this.angles[baseAng] + 0.4 * impulse;
            const ay = this.angles[baseAng + 1];
            const az = this.angles[baseAng + 2];
            const m = this._computeRotMatrix(ax, ay, az);

            const verts = mesh.verts;
            for (let v = 0; v < verts.length; v++) {
                const vx = verts[v][0], vy = verts[v][1], vz = verts[v][2];
                const rx = m[0] * vx + m[1] * vy + m[2] * vz;
                const ry = m[3] * vx + m[4] * vy + m[5] * vz;
                const rz = m[6] * vx + m[7] * vy + m[8] * vz;
                this.rotX[v] = rx;
                this.rotY[v] = ry;
                this.rotZ[v] = rz;
                const persp = 4 / (4 - rz);
                this.projX[v] = cx + rx * R * persp;
                this.projY[v] = cy + ry * R * persp;
            }

            const explode = isAfterglow ? 0 : (baseExplode + this.boom[i]);
            const faces = mesh.faces;
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

                // Strenges Backface-Culling (normale Z & perspektivischer Sichtstrahl)
                if (nz <= 0 || viewDot >= 0) {
                    this.faceVisible[f] = 0;
                    continue;
                }

                this.faceVisible[f] = 1;
                this.faceNx[f] = nx;
                this.faceNy[f] = ny;
                this.faceNz[f] = nz;

                const s = clamp01(nx * Lx + ny * Ly + nz * Lz);
                let stage = Math.max(0, Math.min(4, Math.round(s * 3.5) + Math.round(chVals[i])));
                if (!isAfterglow && this.hardFlashTimer > 0 && i === this.hardBody) {
                    stage = 4;
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

            // Flaechen rastern (+ explodierte Kanten pro Flaeche falls explode > 0)
            const explodedMode = explode > 0.001;
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
                        pts[k].x = cx + px3 * R * persp;
                        pts[k].y = cy + py3 * R * persp;
                    }
                    this._drawPolygonSplit(ctx, pts, i, this.faceStage[f], w, h, wipeY);
                    for (let k = 0; k < len; k++) {
                        const p0 = pts[k];
                        const p1 = pts[(k + 1) % len];
                        drawAliasedLineClipped(ctx, p0.x, p0.y, p1.x, p1.y, INK, clipFull);
                    }
                }
            }

            // Deduplizierter INK-Kantenpass im kompakten Zustand (spart ~40% Linien-Calls)
            if (!explodedMode) {
                const edges = mesh.edges;
                for (let ei = 0; ei < edges.length; ei++) {
                    const e = edges[ei];
                    const v0 = this.faceVisible[e.f0] === 1;
                    const v1 = e.f1 >= 0 && this.faceVisible[e.f1] === 1;
                    if (!v0 && !v1) continue;
                    drawAliasedLineClipped(
                        ctx,
                        this.projX[e.a], this.projY[e.a],
                        this.projX[e.b], this.projY[e.b],
                        INK,
                        clipFull
                    );
                }
            }
        }
    }
}