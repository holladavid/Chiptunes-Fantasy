// =========================================================
// DEMO-SCENE-ELEMENT: ATARI LINE RIBBONS (Foreground DSE)
// Klassische Atari-ST-Bresenham-Linienbaender (Mystify-/Qix-Stil).
// Features:
// - 3 Baender (YM2149 A/B/C), Pool 6 Ecken, nv=4 (5 im Climax mit Warteregel)
// - Kohesive, rotierende Anti-Kollaps-Geometrie (kein Ausfransen zu Nadeln)
// - Ringpuffer (16 Slots, 25 Hz + snapNow) mit luftigem Stride-2-Echo-Fächer
// - Sauber gestaffelte Trail-Rampen (3->2->1), schlanke Ghost-Kontur (Background bleibt frei!)
// - Symmetrischer INK-Kontrast, Corner-Jewels & WHITE (#fcfcfc) Hard-Beat-Flash
// - Timer-B-Raster-Wipe am 8. Beat; proportionales Resize-Mapping (<= 1 px)
// =========================================================

import {
    createXorshift32,
    drawAliasedLineClipped
} from '../../utils/hardware-constraints.js';
import { COOL, INK, SETS, WHITE } from './atari-kit.js';

const T_IN = 1.5;
const T_OUT = 1.5;
const WIPE_DURATION = 0.5;
const NUM_RIBBONS = 3;
const MAX_VERTS = 6;
const HISTORY_LEN = 16;

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

export class AtariLineRibbons {
    constructor() {
        this.name = 'Atari Line Ribbons';

        // Zeit- & Zustandsverwaltung
        this.lastT = null;
        this.lastState = 'idle';
        this.stateAge = 0;
        this.simAcc = 0;
        this.stepCounter = 0;
        this.snappedThisFrame = false;

        // Geglaettete Tension & Eckenzahl-Zustand
        this.ten = 0.30;
        this.tenInit = false;
        this.nv = 4;
        this.pendingGrow = false;
        this.growWait = 0;
        this.lowTenAge = 0;
        this.shrinkingV4 = false;
        this.shrinkAge = 0;

        // Beat- & Effektzustand
        this.lastBeatCount = -1;
        this.hardCooldown = 0;
        this.hardHeadTimer = 0;
        this.link = 0; // 0 = Umriss, 1 = Twisted Ribbon / Stern, 2 = Kristall (Umriss + Diagonalen)
        this.spinDir = 1;

        // Familien- & Afterglow-Zustand
        this.setIdx = 0;
        this.inAfterglow = false;
        this.afterglowAge = 0;
        this.wipeFrom = SETS[0];
        this.wipeTo = SETS[0];
        this.wipeAge = WIPE_DURATION;

        // Instanzeigener deterministischer PRNG (Zero Math.random)
        this.rng = createXorshift32(0x4C524231); // 'LRB1'

        // Normierte Startkoordinaten + feste Arbeits-Pools (Zero-GC)
        this.initNormX = new Float32Array(NUM_RIBBONS * MAX_VERTS);
        this.initNormY = new Float32Array(NUM_RIBBONS * MAX_VERTS);
        this.px = new Float32Array(NUM_RIBBONS * MAX_VERTS);
        this.py = new Float32Array(NUM_RIBBONS * MAX_VERTS);
        this.vx = new Float32Array(NUM_RIBBONS * MAX_VERTS);
        this.vy = new Float32Array(NUM_RIBBONS * MAX_VERTS);
        this.shoveVx = new Float32Array(NUM_RIBBONS * MAX_VERTS);
        this.shoveVy = new Float32Array(NUM_RIBBONS * MAX_VERTS);
        this.nudgeVx = new Float32Array(NUM_RIBBONS);

        // Ringpuffer fuer 16 Momentaufnahmen: Int16Array(3 * 6 * 2 * 16)
        this.history = new Int16Array(NUM_RIBBONS * MAX_VERTS * 2 * HISTORY_LEN);
        this.headSlot = 0;
        this.filledSlots = 0;

        // Groessen-Tracking fuer proportionales Resize-Mapping
        this.posInit = false;
        this.prevW = 0;
        this.prevH = 0;
        this.prevMx = 0;
        this.prevMy = 0;

        // Arbeits-Puffer fuer gezeichnete Eckpunkte (Zero-GC)
        this.drawX = new Float32Array(MAX_VERTS);
        this.drawY = new Float32Array(MAX_VERTS);

        this._seedVertices();
    }

    _seedVertices() {
        // 3 ausgewogene Zonen (links/mitte/rechts, leicht in oberer/mittlerer Buehne),
        // mit einwaerts gerichteter Startgeschwindigkeit und sauber geordnetem Polygon.
        const centersU = [0.26, 0.50, 0.74];
        const centersV = [0.36, 0.48, 0.38];
        const baseVelDirs = [
            [0.86, 0.42],
            [-0.45, -0.78],
            [-0.84, 0.44]
        ];

        for (let b = 0; b < NUM_RIBBONS; b++) {
            const cx = centersU[b];
            const cy = centersV[b];
            const phaseOffset = b * 0.75 + this.rng.float() * 0.4;
            const spd = 0.72 + 0.22 * this.rng.float();
            const bvx = baseVelDirs[b][0] * spd;
            const bvy = baseVelDirs[b][1] * spd;

            for (let v = 0; v < MAX_VERTS; v++) {
                const idx = b * MAX_VERTS + v;
                const vAngle = phaseOffset + (v / 4) * Math.PI * 2;
                const rad = 0.10 + (v & 1) * 0.03;
                this.initNormX[idx] = clamp(cx + Math.cos(vAngle) * rad, 0.08, 0.92);
                this.initNormY[idx] = clamp(cy + Math.sin(vAngle) * rad * 1.35, 0.08, 0.92);
                this.vx[idx] = bvx;
                this.vy[idx] = bvy;
            }
        }
    }

    _safeMargins(w, h) {
        const minDim = Math.min(w, h);
        const rawM = Math.round(0.06 * minDim);
        const mx = Math.min(rawM, Math.max(0, Math.floor((w - 2) * 0.5)));
        const my = Math.min(rawM, Math.max(0, Math.floor((h - 2) * 0.5)));
        return {
            mx,
            my,
            xMin: mx,
            xMax: Math.max(mx, w - mx),
            yMin: my,
            yMax: Math.max(my, h - my)
        };
    }

    _initOrResizePositions(w, h) {
        const box = this._safeMargins(w, h);
        const newSpanX = Math.max(1, box.xMax - box.xMin);
        const newSpanY = Math.max(1, box.yMax - box.yMin);

        if (!this.posInit) {
            for (let i = 0; i < NUM_RIBBONS * MAX_VERTS; i++) {
                this.px[i] = box.xMin + this.initNormX[i] * newSpanX;
                this.py[i] = box.yMin + this.initNormY[i] * newSpanY;
            }
            this.headSlot = 0;
            this.filledSlots = 1;
            this._recordSnapshot();
            this.posInit = true;
            this.prevW = w;
            this.prevH = h;
            this.prevMx = box.mx;
            this.prevMy = box.my;
            return;
        }

        if (w !== this.prevW || h !== this.prevH) {
            const oldXMin = this.prevMx;
            const oldYMin = this.prevMy;
            const oldSpanX = Math.max(1, (this.prevW - this.prevMx) - this.prevMx);
            const oldSpanY = Math.max(1, (this.prevH - this.prevMy) - this.prevMy);

            for (let i = 0; i < NUM_RIBBONS * MAX_VERTS; i++) {
                const nx = clamp01((this.px[i] - oldXMin) / oldSpanX);
                const ny = clamp01((this.py[i] - oldYMin) / oldSpanY);
                this.px[i] = box.xMin + nx * newSpanX;
                this.py[i] = box.yMin + ny * newSpanY;
            }

            // Alle gespeicherten Snapshots im Ringpuffer proportional mitabbilden
            for (let s = 0; s < HISTORY_LEN; s++) {
                const slotBase = s * NUM_RIBBONS * MAX_VERTS * 2;
                for (let i = 0; i < NUM_RIBBONS * MAX_VERTS; i++) {
                    const hi = slotBase + i * 2;
                    const nx = clamp01((this.history[hi] - oldXMin) / oldSpanX);
                    const ny = clamp01((this.history[hi + 1] - oldYMin) / oldSpanY);
                    this.history[hi] = Math.round(box.xMin + nx * newSpanX);
                    this.history[hi + 1] = Math.round(box.yMin + ny * newSpanY);
                }
            }

            this.prevW = w;
            this.prevH = h;
            this.prevMx = box.mx;
            this.prevMy = box.my;
        }
    }

    resize(width, height) {
        if (width > 0 && height > 0 && Number.isFinite(width / height)) {
            this._initOrResizePositions(Math.floor(width), Math.floor(height));
        }
    }

    _recordSnapshot() {
        this.headSlot = (this.headSlot + 1) % HISTORY_LEN;
        this.filledSlots = Math.min(HISTORY_LEN, this.filledSlots + 1);
        const slotBase = this.headSlot * NUM_RIBBONS * MAX_VERTS * 2;
        for (let i = 0; i < NUM_RIBBONS * MAX_VERTS; i++) {
            const hi = slotBase + i * 2;
            this.history[hi] = Math.round(this.px[i]);
            this.history[hi + 1] = Math.round(this.py[i]);
        }
    }

    _activateFifthVertex() {
        if (this.nv >= 5) return;
        for (let b = 0; b < NUM_RIBBONS; b++) {
            const i3 = b * MAX_VERTS + 3;
            const i4 = b * MAX_VERTS + 4;
            const i0 = b * MAX_VERTS;
            this.px[i4] = (this.px[i3] + this.px[i0]) * 0.5;
            this.py[i4] = (this.py[i3] + this.py[i0]) * 0.5;
            this.vx[i4] = this.vx[i3];
            this.vy[i4] = this.vy[i3];
            this.shoveVx[i4] = this.shoveVx[i3];
            this.shoveVy[i4] = this.shoveVy[i3];

            // Bestehende History-Slots fuellen, damit kein Spike nach (0,0) entsteht
            for (let s = 0; s < HISTORY_LEN; s++) {
                const slotBase = s * NUM_RIBBONS * MAX_VERTS * 2;
                const h3 = slotBase + i3 * 2;
                const h0 = slotBase + i0 * 2;
                const h4 = slotBase + i4 * 2;
                this.history[h4] = Math.round((this.history[h3] + this.history[h0]) * 0.5);
                this.history[h4 + 1] = Math.round((this.history[h3 + 1] + this.history[h0 + 1]) * 0.5);
            }
        }
        this.nv = 5;
        this.shrinkingV4 = false;
        this.shrinkAge = 0;
    }

    _applyRadialShove(ribbonIdx, mag) {
        const base = ribbonIdx * MAX_VERTS;
        let cx = 0;
        let cy = 0;
        for (let v = 0; v < this.nv; v++) {
            cx += this.px[base + v];
            cy += this.py[base + v];
        }
        cx /= this.nv;
        cy /= this.nv;

        for (let v = 0; v < this.nv; v++) {
            const idx = base + v;
            const dx = this.px[idx] - cx;
            const dy = this.py[idx] - cy;
            const len = Math.hypot(dx, dy);
            if (len > 1e-4) {
                this.shoveVx[idx] += (dx / len) * mag;
                this.shoveVy[idx] += (dy / len) * mag;
            } else {
                const ang = (v / this.nv) * Math.PI * 2;
                this.shoveVx[idx] += Math.cos(ang) * mag;
                this.shoveVy[idx] += Math.sin(ang) * mag;
            }
        }
    }

    _startWipe(nextSet) {
        if (this.wipeTo === nextSet) return;
        this.wipeFrom = this.wipeAge < WIPE_DURATION * 0.5 ? this.wipeFrom : this.wipeTo;
        this.wipeTo = nextSet;
        this.wipeAge = 0;
    }

    _stepSimulation(stepDt, w, h, chVals, impulse, vBase, isAfterglow) {
        this.stepCounter++;
        const box = this._safeMargins(w, h);
        const minDim = Math.min(w, h);
        const spanX = Math.max(2, box.xMax - box.xMin);
        const spanY = Math.max(2, box.yMax - box.yMin);
        const maxSpanR = 0.42 * Math.min(spanX, spanY);
        const kDecay = Math.exp(-stepDt / 0.25);
        const radialRelax = 1 - Math.exp(-stepDt / 0.26);
        const activeVerts = this.nv;

        for (let b = 0; b < NUM_RIBBONS; b++) {
            const chMul = 1 + 0.6 * chVals[b];
            const impMul = 1 + 0.7 * impulse;
            const baseSpeed = vBase * chMul * impMul;
            const nudge = this.nudgeVx[b];

            // 1. Translationale Bewegung + Wandreflexion (vx/vy bleiben rein fuer Bounce/8.Beat)
            let cx = 0;
            let cy = 0;
            for (let v = 0; v < activeVerts; v++) {
                const idx = b * MAX_VERTS + v;
                let nx = this.px[idx] + (this.vx[idx] * baseSpeed + this.shoveVx[idx] + nudge) * stepDt;
                let ny = this.py[idx] + (this.vy[idx] * baseSpeed + this.shoveVy[idx]) * stepDt;

                if (nx < box.xMin) {
                    nx = box.xMin + (box.xMin - nx);
                    if (nx > box.xMax) nx = box.xMin;
                    this.vx[idx] = Math.abs(this.vx[idx]);
                    this.shoveVx[idx] = Math.abs(this.shoveVx[idx]);
                } else if (nx > box.xMax) {
                    nx = box.xMax - (nx - box.xMax);
                    if (nx < box.xMin) nx = box.xMax;
                    this.vx[idx] = -Math.abs(this.vx[idx]);
                    this.shoveVx[idx] = -Math.abs(this.shoveVx[idx]);
                }

                if (ny < box.yMin) {
                    ny = box.yMin + (box.yMin - ny);
                    if (ny > box.yMax) ny = box.yMin;
                    this.vy[idx] = Math.abs(this.vy[idx]);
                    this.shoveVy[idx] = Math.abs(this.shoveVy[idx]);
                } else if (ny > box.yMax) {
                    ny = box.yMax - (ny - box.yMax);
                    if (ny < box.yMin) ny = box.yMax;
                    this.vy[idx] = -Math.abs(this.vy[idx]);
                    this.shoveVy[idx] = -Math.abs(this.shoveVy[idx]);
                }

                this.px[idx] = nx;
                this.py[idx] = ny;
                this.shoveVx[idx] *= kDecay;
                this.shoveVy[idx] *= kDecay;
                cx += nx;
                cy += ny;
            }
            this.nudgeVx[b] *= kDecay;

            // 2. Kohesive Band-Skulptur: harmonische Rotation + Anti-Kollaps-Radius
            // Verhindert flache Nadeln und uebermaessiges Zerschneiden von Background/Floor
            cx /= activeVerts;
            cy /= activeVerts;

            const stateScale = isAfterglow ? 0.115 : lerp(0.135, 0.195, this.ten);
            const targetR = Math.min(
                maxSpanR,
                Math.max(3, minDim * stateScale * (0.86 + 0.28 * chVals[b] + 0.14 * impulse))
            );
            const twistRate = (0.78 + 1.40 * this.ten + 0.72 * chVals[b])
                * (isAfterglow ? 0.30 : 1.0)
                * this.spinDir
                * (b === 1 ? -1 : 1);
            const dAng = twistRate * stepDt;
            const cosA = Math.cos(dAng);
            const sinA = Math.sin(dAng);

            for (let v = 0; v < activeVerts; v++) {
                const idx = b * MAX_VERTS + v;
                let dx = this.px[idx] - cx;
                let dy = this.py[idx] - cy;
                const dist = Math.hypot(dx, dy);

                if (dist < 0.25 * targetR) {
                    const fallbackAng = this.stepCounter * 0.04 + b * 1.4 + (v / activeVerts) * Math.PI * 2;
                    dx = Math.cos(fallbackAng) * (0.35 * targetR);
                    dy = Math.sin(fallbackAng) * (0.35 * targetR);
                }

                // Sanft rotieren + organisch in kompakte Polygon-Huellkurve atmen
                const rx = dx * cosA - dy * sinA;
                const ry = dx * sinA + dy * cosA;
                const curR = Math.hypot(rx, ry) || 1;
                const wave = 1 + 0.14 * Math.sin(this.stepCounter * 0.05 + v * 1.9 + b * 2.1);
                const nextR = lerp(curR, targetR * wave, radialRelax);
                const scaleR = nextR / curR;

                this.px[idx] = clamp(cx + rx * scaleR, box.xMin, box.xMax);
                this.py[idx] = clamp(cy + ry * scaleR, box.yMin, box.yMax);
            }
        }

        // Shrink-Uebergang (Ecke 4 laeuft in 0,5 s auf Ecke 3 zu)
        if (this.shrinkingV4 && !isAfterglow) {
            this.shrinkAge += stepDt;
            if (this.shrinkAge >= 0.50) {
                this.nv = 4;
                this.shrinkingV4 = false;
                this.shrinkAge = 0;
                this.lowTenAge = 0;
            }
        }

        // Alle 2 PAL-Schritte (25 Hz) Momentaufnahme schreiben (sofern kein snapNow lief)
        if ((this.stepCounter & 1) === 0 && !this.snappedThisFrame) {
            this._recordSnapshot();
        }
        this.snappedThisFrame = false;
    }

    _drawCornerPip(ctx, x, y, size, color, w, h) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        const ix = Math.round(x);
        const iy = Math.round(y);
        const x0 = Math.max(0, ix);
        const y0 = Math.max(0, iy);
        const x1 = Math.min(w, ix + size);
        const y1 = Math.min(h, iy + size);
        const cw = x1 - x0;
        const ch = y1 - y0;
        if (cw > 0 && ch > 0) {
            ctx.fillStyle = color;
            ctx.fillRect(x0, y0, cw, ch);
        }
    }

    _drawClippedLineSplit(ctx, x0, y0, x1, y1, bandIdx, lvl, w, h, wipeY, overrideColor = null) {
        if (overrideColor !== null) {
            drawAliasedLineClipped(ctx, x0, y0, x1, y1, overrideColor, { x: 0, y: 0, w, h });
            return;
        }
        if (wipeY > 0 && wipeY < h) {
            if (Math.min(y0, y1) < wipeY) {
                drawAliasedLineClipped(ctx, x0, y0, x1, y1, this.wipeTo[bandIdx][lvl], {
                    x: 0, y: 0, w, h: wipeY
                });
            }
            if (Math.max(y0, y1) >= wipeY) {
                drawAliasedLineClipped(ctx, x0, y0, x1, y1, this.wipeFrom[bandIdx][lvl], {
                    x: 0, y: wipeY, w, h: h - wipeY
                });
            }
            return;
        }
        const rampSet = wipeY > 0 ? this.wipeTo : this.wipeFrom;
        drawAliasedLineClipped(ctx, x0, y0, x1, y1, rampSet[bandIdx][lvl], { x: 0, y: 0, w, h });
    }

    _drawRibbonEdges(ctx, xs, ys, nv, drawMode, bandIdx, lvl, w, h, wipeY, dxOff, dyOff, overrideColor) {
        if (drawMode === 0 || drawMode === 2) {
            for (let i = 0; i < nv; i++) {
                const j = (i + 1) % nv;
                this._drawClippedLineSplit(
                    ctx, xs[i] + dxOff, ys[i] + dyOff, xs[j] + dxOff, ys[j] + dyOff,
                    bandIdx, lvl, w, h, wipeY, overrideColor
                );
            }
        }
        if (drawMode === 1 || drawMode === 2) {
            if (nv === 4) {
                // Gekreuzte Diagonalen + bei Modus 1 zusaetzliche Endkappen fuer 3D-Twisted-Ribbon
                this._drawClippedLineSplit(
                    ctx, xs[0] + dxOff, ys[0] + dyOff, xs[2] + dxOff, ys[2] + dyOff,
                    bandIdx, lvl, w, h, wipeY, overrideColor
                );
                this._drawClippedLineSplit(
                    ctx, xs[1] + dxOff, ys[1] + dyOff, xs[3] + dxOff, ys[3] + dyOff,
                    bandIdx, lvl, w, h, wipeY, overrideColor
                );
                if (drawMode === 1) {
                    this._drawClippedLineSplit(
                        ctx, xs[0] + dxOff, ys[0] + dyOff, xs[1] + dxOff, ys[1] + dyOff,
                        bandIdx, lvl, w, h, wipeY, overrideColor
                    );
                    this._drawClippedLineSplit(
                        ctx, xs[2] + dxOff, ys[2] + dyOff, xs[3] + dxOff, ys[3] + dyOff,
                        bandIdx, lvl, w, h, wipeY, overrideColor
                    );
                }
            } else {
                for (let i = 0; i < nv; i++) {
                    const j = (i + 2) % nv;
                    this._drawClippedLineSplit(
                        ctx, xs[i] + dxOff, ys[i] + dyOff, xs[j] + dxOff, ys[j] + dyOff,
                        bandIdx, lvl, w, h, wipeY, overrideColor
                    );
                }
            }
        }
    }

    _drawHeadWithSymShadow(ctx, xs, ys, nv, drawMode, bandIdx, w, h, wipeY, headDouble, headOverride) {
        if (!headDouble) {
            this._drawRibbonEdges(ctx, xs, ys, nv, drawMode, bandIdx, 4, w, h, wipeY, 1, 1, INK);
            this._drawRibbonEdges(ctx, xs, ys, nv, drawMode, bandIdx, 4, w, h, wipeY, 0, 0, headOverride);
            return;
        }

        const drawEdgePair = (i0, i1, pass) => {
            const x0 = xs[i0], y0 = ys[i0];
            const x1 = xs[i1], y1 = ys[i1];
            const flat = Math.abs(x1 - x0) >= Math.abs(y1 - y0);
            const dx2 = flat ? 0 : 1;
            const dy2 = flat ? 1 : 0;

            if (pass === 0) {
                // Ununterbrochener INK-Kontrast unter beiden Kopflinien
                this._drawClippedLineSplit(ctx, x0 + 1, y0 + 1, x1 + 1, y1 + 1, bandIdx, 4, w, h, wipeY, INK);
                this._drawClippedLineSplit(
                    ctx, x0 + dx2 + 1, y0 + dy2 + 1, x1 + dx2 + 1, y1 + dy2 + 1,
                    bandIdx, 4, w, h, wipeY, INK
                );
            } else {
                this._drawClippedLineSplit(ctx, x0, y0, x1, y1, bandIdx, 4, w, h, wipeY, headOverride);
                this._drawClippedLineSplit(
                    ctx, x0 + dx2, y0 + dy2, x1 + dx2, y1 + dy2,
                    bandIdx, 4, w, h, wipeY, headOverride
                );
            }
        };

        for (let pass = 0; pass < 2; pass++) {
            if (drawMode === 0 || drawMode === 2) {
                for (let i = 0; i < nv; i++) drawEdgePair(i, (i + 1) % nv, pass);
            }
            if (drawMode === 1 || drawMode === 2) {
                if (nv === 4) {
                    drawEdgePair(0, 2, pass);
                    drawEdgePair(1, 3, pass);
                    if (drawMode === 1) {
                        drawEdgePair(0, 1, pass);
                        drawEdgePair(2, 3, pass);
                    }
                } else {
                    for (let i = 0; i < nv; i++) drawEdgePair(i, (i + 2) % nv, pass);
                }
            }
        }
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

        // Initialisierung oder proportionales Resize-Mapping (inkl. History)
        this._initOrResizePositions(w, h);

        const safeStateTime = Number.isFinite(stateTime) && stateTime >= 0 ? stateTime : this.stateAge;
        let vis = 1;
        if (state === 'starting') vis = clamp01(safeStateTime / T_IN);
        else if (state === 'stopping') vis = 1 - clamp01(safeStateTime / T_OUT);

        this.hardCooldown = Math.max(0, this.hardCooldown - dt);
        this.hardHeadTimer = Math.max(0, this.hardHeadTimer - dt);
        this.wipeAge = Math.min(WIPE_DURATION, this.wipeAge + dt);
        this.snappedThisFrame = false;

        // Tension (asymmetrisch geglaettet; erster Frame snappt fuer warmup:0-Stills)
        const safeMetrics = metrics || {};
        let targetTen = clamp01(safeMetrics.tensionPct ?? FALLBACK_TENSION[state] ?? 0.2);
        if (state === 'afterglow') targetTen = Math.min(targetTen, 0.30);
        if (state === 'starting' || state === 'stopping') targetTen = Math.min(targetTen, 0.25);

        const isAfterglow = state === 'afterglow';
        if (!this.tenInit) {
            this.ten = targetTen;
            this.tenInit = true;
            if (!isAfterglow && this.ten >= 0.70) {
                this._activateFifthVertex();
            }
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
        const dir = (count & 1) ? 1 : -1;

        // Afterglow-Palettenwechsel per Raster-Wipe
        if (isAfterglow && !this.inAfterglow) {
            this.inAfterglow = true;
            this.afterglowAge = 0;
            this._startWipe(COOL);
        } else if (!isAfterglow && this.inAfterglow) {
            this.inAfterglow = false;
            this._startWipe(SETS[this.setIdx]);
        }
        if (isAfterglow) {
            this.afterglowAge += dt;
        }

        // Eckenzahl-Warteregel (nv 4 <-> 5)
        if (!isAfterglow) {
            if (this.nv === 4 && this.ten >= 0.70) {
                this.pendingGrow = true;
                this.growWait += dt;
                this.lowTenAge = 0;
                if (onBeat || this.growWait >= 1.20) {
                    this._activateFifthVertex();
                    this.pendingGrow = false;
                    this.growWait = 0;
                }
            } else {
                this.pendingGrow = false;
                this.growWait = 0;
            }

            if (this.nv === 5 && this.ten < 0.50 && !this.shrinkingV4) {
                this.lowTenAge += dt;
                if (this.lowTenAge >= 1.20) {
                    this.shrinkingV4 = true;
                    this.shrinkAge = 0;
                }
            } else if (this.ten >= 0.50) {
                this.lowTenAge = 0;
            }
        }

        const minDim = Math.min(w, h);
        const vBase = lerp(30, 88, this.ten) * (minDim / 200) * (isAfterglow ? 0.35 : 1.0);

        if (onBeat) {
            let bestC = 0;
            if (ch1 > chVals[bestC]) bestC = 1;
            if (ch2 > chVals[bestC]) bestC = 2;

            if (level === 1) {
                this.nudgeVx[bestC] += dir * 0.15 * vBase;
            } else if (level === 2) {
                this._recordSnapshot(); // snapNow
                this.snappedThisFrame = true;
                for (let b = 0; b < NUM_RIBBONS; b++) {
                    this._applyRadialShove(b, 0.25 * vBase);
                }
            } else if (level === 3) {
                this._recordSnapshot(); // snapNow
                this.snappedThisFrame = true;
                for (let b = 0; b < NUM_RIBBONS; b++) {
                    this._applyRadialShove(b, 0.40 * vBase);
                }
                if (this.hardCooldown <= 0) {
                    this.hardCooldown = 0.25;
                    if (!isAfterglow) this.hardHeadTimer = 0.12;
                }
            }

            if (!isAfterglow && count > 0 && count % 4 === 0) {
                this.link = (this.link + 1) % 3;
            }
            if (count > 0 && count % 8 === 0) {
                for (let i = 0; i < NUM_RIBBONS * MAX_VERTS; i++) {
                    this.vx[i] = -this.vx[i];
                }
                this.spinDir = -this.spinDir;
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
            this._stepSimulation(0.02, w, h, chVals, impulse, vBase, isAfterglow);
            this.simAcc -= 0.02;
        }

        // Aktive Ghost-Anzahl bestimmen (inkl. Budget- & Sichtbarkeitsschutz fuer Background/Floor)
        let gh;
        if (isAfterglow) {
            gh = Math.max(1, 5 - Math.floor(this.afterglowAge / 0.15));
        } else if (this.ten < 0.35) {
            gh = 3;
        } else if (this.ten < 0.70) {
            gh = 5;
        } else {
            gh = this.link === 2 ? 5 : 6;
        }

        const activeGh = vis <= 0 ? 0 : Math.max(1, Math.ceil(gh * vis));
        if (vis <= 0 || activeGh <= 0) {
            // Foreground blendet ohne Schwarz-Vorhang sauber auf 0 aus
            return;
        }

        const wipeY = this.wipeAge < WIPE_DURATION
            ? Math.floor((this.wipeAge / WIPE_DURATION) * h)
            : h;
        const shrinkFrac = this.shrinkingV4 ? clamp01(this.shrinkAge / 0.50) : 0;
        const headDouble = (!isAfterglow && (state === 'climax' || this.ten >= 0.70 || this.hardHeadTimer > 0))
            || Math.round(impulse) >= 1;
        const canUseWhite = !isAfterglow && state !== 'starting' && vis > 0.25 && this.hardHeadTimer > 0;
        const headOverride = canUseWhite ? WHITE : null;
        const drawPips = w >= 48 && h >= 48;
        const trailCount = Math.max(1, activeGh - 1);

        // =========================================================
        // ZEICHNEN: Luftige Stride-2-Trails zuerst, Kopf mit INK + Pips zuletzt
        // =========================================================
        for (let b = 0; b < NUM_RIBBONS; b++) {
            if (vis <= 0.2 * b) continue;

            for (let g = activeGh - 1; g >= 0; g--) {
                let slotOffset = 0;
                if (g > 0) {
                    slotOffset = g * 2;
                    if (slotOffset >= this.filledSlots) {
                        // Beim Einblenden sanft vorhandene Slots auffuellen, ohne Sprung
                        slotOffset = g;
                        if (slotOffset >= this.filledSlots) continue;
                    }
                }

                const slot = (this.headSlot - slotOffset + HISTORY_LEN) % HISTORY_LEN;
                const slotBase = slot * NUM_RIBBONS * MAX_VERTS * 2;
                const bandBase = b * MAX_VERTS;

                for (let v = 0; v < this.nv; v++) {
                    if (g === 0) {
                        this.drawX[v] = this.px[bandBase + v];
                        this.drawY[v] = this.py[bandBase + v];
                    } else {
                        const hi = slotBase + (bandBase + v) * 2;
                        this.drawX[v] = this.history[hi];
                        this.drawY[v] = this.history[hi + 1];
                    }
                }
                if (this.shrinkingV4 && this.nv === 5) {
                    this.drawX[4] = lerp(this.drawX[4], this.drawX[3], shrinkFrac);
                    this.drawY[4] = lerp(this.drawY[4], this.drawY[3], shrinkFrac);
                }

                if (g === 0) {
                    // 1. Kopf mit symmetrischem INK-Kontrast & optionalem 2px-Doppelkopf
                    this._drawHeadWithSymShadow(
                        ctx, this.drawX, this.drawY, this.nv, this.link, b, w, h, wipeY, headDouble, headOverride
                    );

                    // 2. Crisp Atari-ST Corner-Jewels an den Ecken des Kopfs (sparen 13-Farben-Limit!)
                    if (drawPips) {
                        const pipSize = headDouble ? 2 : 1;
                        const rampSet = wipeY > 0 ? this.wipeTo : this.wipeFrom;
                        for (let v = 0; v < this.nv; v++) {
                            const vx = this.drawX[v];
                            const vy = this.drawY[v];
                            const pipCol = headOverride !== null
                                ? headOverride
                                : ((wipeY > 0 && wipeY < h && vy >= wipeY) ? this.wipeFrom[b][4] : rampSet[b][4]);
                            this._drawCornerPip(ctx, vx + 1, vy + 1, pipSize, INK, w, h);
                            this._drawCornerPip(ctx, vx, vy, pipSize, pipCol, w, h);
                        }
                    }
                } else {
                    // Trails nutzen streng Stufen 3 -> 2 -> 1 (niemals Stufe 4 -> Kopf bleibt glasklar)
                    // und bei Kristall/Stern bleiben aeltere Geister auf schlanker Kontur (Background-Schutz!)
                    const lvl = Math.max(1, Math.min(3, 4 - Math.ceil((g * 3) / trailCount)));
                    const copyLink = this.link === 2 ? 0 : (this.link === 1 && g >= 2 ? 0 : this.link);
                    this._drawRibbonEdges(
                        ctx, this.drawX, this.drawY, this.nv, copyLink, b, lvl, w, h, wipeY, 0, 0, null
                    );
                }
            }
        }
    }
}