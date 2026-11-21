// =========================================================
// DEMO-SCENE-ELEMENT: ATARI LINE RIBBONS (Foreground DSE)
// Klassische Atari-ST-Bresenham-Linienbaender (Mystify-Stil).
// Features:
// - 3 Baender (YM2149 A/B/C), Pool 6 Ecken, nv=4 (5 im Climax mit Warteregel)
// - Ringpuffer mit 8 Momentaufnahmen (25 Hz + snapNow bei Medium/Hard)
// - Proportionales Resize-Mapping inkl. History-Ringpuffer (Toleranz <= 1 px)
// - 1px INK-Schattenlinie (+1,+1) + Doppelkopf fuer klaren Foreground-Kontrast
// - Timer-B-Raster-Wipe am 8. Beat; Ein-/Ausblendung rein ueber Ghost/Band-Anzahl
// =========================================================

import {
    createXorshift32,
    drawAliasedLineClipped
} from '../../utils/hardware-constraints.js';
import { COOL, INK, SETS } from './atari-kit.js';

const T_IN = 1.5;
const T_OUT = 1.5;
const WIPE_DURATION = 0.5;
const NUM_RIBBONS = 3;
const MAX_VERTS = 6;
const HISTORY_LEN = 8;

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
        this.link = 0; // 0 = Umriss, 1 = Stern, 2 = Umriss + Diagonalen

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

        // Ringpuffer fuer 8 Momentaufnahmen: Int16Array(3 * 6 * 2 * 8)
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
        for (let b = 0; b < NUM_RIBBONS; b++) {
            // Deterministische Startregion entlang der Breite verteilen,
            // damit auch Ultrawide sofort voll bespielt wird.
            const bandCenterU = 0.20 + b * 0.30;
            for (let v = 0; v < MAX_VERTS; v++) {
                const idx = b * MAX_VERTS + v;
                const u = clamp(bandCenterU + (this.rng.float() - 0.5) * 0.45, 0.04, 0.96);
                const wv = clamp(0.10 + this.rng.float() * 0.80, 0.04, 0.96);
                const ang = this.rng.float() * Math.PI * 2;
                const spd = 0.8 + 0.4 * this.rng.float();
                this.initNormX[idx] = u;
                this.initNormY[idx] = wv;
                this.vx[idx] = Math.cos(ang) * spd;
                this.vy[idx] = Math.sin(ang) * spd;
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

            // Bestehende History-Slots fuellen, damit kein Spikes nach (0,0) entsteht
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
        this.wipeFrom = this.wipeAge < WIPE_DURATION ? this.wipeFrom : this.wipeTo;
        this.wipeTo = nextSet;
        this.wipeAge = 0;
    }

    _stepSimulation(stepDt, w, h, chVals, impulse, vBase, isAfterglow) {
        this.stepCounter++;
        const box = this._safeMargins(w, h);
        const kDecay = Math.exp(-stepDt / 0.25);
        const activeVerts = this.nv;

        for (let b = 0; b < NUM_RIBBONS; b++) {
            const chMul = 1 + 0.6 * chVals[b];
            const impMul = 1 + 0.8 * impulse;
            const baseSpeed = vBase * chMul * impMul;
            const nudge = this.nudgeVx[b];

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
            }
            this.nudgeVx[b] *= kDecay;
        }

        // Schrink-Uebergang (Ecke 4 laeuft in 0,5 s auf Ecke 3 zu)
        if (this.shrinkingV4 && !isAfterglow) {
            this.shrinkAge += stepDt;
            if (this.shrinkAge >= 0.50) {
                this.nv = 4;
                this.shrinkingV4 = false;
                this.shrinkAge = 0;
                this.lowTenAge = 0;
            }
        }

        // Alle 2 PAL-Schritte (25 Hz) Momentaufnahme schreiben
        if ((this.stepCounter & 1) === 0) {
            this._recordSnapshot();
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
            const starCount = nv === 4 ? 2 : nv;
            for (let i = 0; i < starCount; i++) {
                const j = (i + 2) % nv;
                this._drawClippedLineSplit(
                    ctx, xs[i] + dxOff, ys[i] + dyOff, xs[j] + dxOff, ys[j] + dyOff,
                    bandIdx, lvl, w, h, wipeY, overrideColor
                );
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
        const vBase = lerp(30, 90, this.ten) * (minDim / 200) * (isAfterglow ? 0.35 : 1.0);

        if (onBeat) {
            let bestC = 0;
            if (ch1 > chVals[bestC]) bestC = 1;
            if (ch2 > chVals[bestC]) bestC = 2;

            if (level === 1) {
                this.nudgeVx[bestC] += dir * 0.15 * vBase;
            } else if (level === 2) {
                this._recordSnapshot(); // snapNow
                for (let b = 0; b < NUM_RIBBONS; b++) {
                    this._applyRadialShove(b, 0.25 * vBase);
                }
            } else if (level === 3) {
                this._recordSnapshot(); // snapNow
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

        // Aktive Ghost-Anzahl bestimmen (inkl. Budget-Schutz im Climax bei link=2)
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

        const activeGh = Math.floor(gh * vis);
        if (vis <= 0 || activeGh <= 0) {
            // Foreground blendet ohne Schwarz-Vorhang sauber auf 0 aus
            return;
        }

        const availGh = Math.min(activeGh, this.filledSlots);
        const wipeY = this.wipeAge < WIPE_DURATION
            ? Math.floor((this.wipeAge / WIPE_DURATION) * h)
            : h;
        const shrinkFrac = this.shrinkingV4 ? clamp01(this.shrinkAge / 0.50) : 0;
        const headDouble = (!isAfterglow && (state === 'climax' || this.ten >= 0.70 || this.hardHeadTimer > 0))
            || Math.round(impulse) >= 1;

        // =========================================================
        // ZEICHNEN: Aelteste Ghosts zuerst, Kopf (mit INK-Kontrast) zuletzt
        // =========================================================
        for (let b = 0; b < NUM_RIBBONS; b++) {
            if (vis <= 0.2 * b) continue;

            for (let g = availGh - 1; g >= 0; g--) {
                const lvl = Math.max(1, 4 - Math.floor((g * 4) / activeGh));
                const slot = (this.headSlot - g + HISTORY_LEN) % HISTORY_LEN;
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

                // Bei link=2 Diagonalen nur auf den juengsten Kopien (Budget-Schutz)
                const copyLink = (this.link === 2 && g >= 2) ? 0 : this.link;

                if (g === 0) {
                    // 1. Kontrast-Schatten in INK (+1, +1) unter dem gesamten Kopf
                    this._drawRibbonEdges(
                        ctx, this.drawX, this.drawY, this.nv, copyLink, b, lvl, w, h, wipeY, 1, 1, INK
                    );

                    // 2. Kopf in Stufe 4 zeichnen
                    this._drawRibbonEdges(
                        ctx, this.drawX, this.drawY, this.nv, copyLink, b, 4, w, h, wipeY, 0, 0, null
                    );

                    // 3. Doppelkopf (2 px dick: flach -> y+1, steil -> x+1)
                    if (headDouble) {
                        const drawOne = (i0, i1) => {
                            const x0 = this.drawX[i0];
                            const y0 = this.drawY[i0];
                            const x1 = this.drawX[i1];
                            const y1 = this.drawY[i1];
                            const flat = Math.abs(x1 - x0) >= Math.abs(y1 - y0);
                            const dxOff = flat ? 0 : 1;
                            const dyOff = flat ? 1 : 0;
                            this._drawClippedLineSplit(
                                ctx, x0 + dxOff, y0 + dyOff, x1 + dxOff, y1 + dyOff, b, 4, w, h, wipeY, null
                            );
                        };
                        if (copyLink === 0 || copyLink === 2) {
                            for (let i = 0; i < this.nv; i++) drawOne(i, (i + 1) % this.nv);
                        }
                        if (copyLink === 1 || copyLink === 2) {
                            const starCount = this.nv === 4 ? 2 : this.nv;
                            for (let i = 0; i < starCount; i++) drawOne(i, (i + 2) % this.nv);
                        }
                    }
                } else {
                    this._drawRibbonEdges(
                        ctx, this.drawX, this.drawY, this.nv, copyLink, b, lvl, w, h, wipeY, 0, 0, null
                    );
                }
            }
        }
    }
}