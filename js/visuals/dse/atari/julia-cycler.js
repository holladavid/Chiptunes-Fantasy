// =========================================================
// DEMO-SCENE-ELEMENT: ATARI JULIA CYCLER (Background DSE)
// Klassisches Atari-ST-Julia-Fraktal mit 50-Hz-Palettenzyklus.
// Features:
// - <= 6000 Chunky-Zellen mit horizontalem Run-Merging (Zero-GC)
// - 4 klassische Julia-Konstanten (inkl. Douady-Hase & Siegel-Scheibe) mit 1,0-s-Morph
// - 14-farbiger luminanzausgeglichener RING_HUE + 3 Rampenringe (max 16 Farben/Scanline)
// - Flackerschutz: Palettenzyklus <= 6 Schritte/s; Kontur-Flash max 1x/0,25 s
// - 3 Radialzonen fuer YM2149 A/B/C & Timer-B-Raster-Wipe am 8. Beat
// =========================================================

import { bayerFadeCells } from '../../utils/hardware-constraints.js';
import { INK, RAMPS, RING_HUE, WHITE } from './atari-kit.js';

const T_IN = 1.5;
const T_OUT = 1.5;
const WIPE_DURATION = 0.5;
const MORPH_DURATION = 1.0;

const C0_FAMILIES = Object.freeze([
    Object.freeze({ r: -0.800, i: 0.156 }),   // F0: Klassische Spirale
    Object.freeze({ r: -0.123, i: 0.745 }),   // F1: Douady-Hase
    Object.freeze({ r: -0.391, i: -0.587 }),  // F2: Siegel-Scheibe
    Object.freeze({ r: 0.285, i: 0.010 })     // F3: Korallendendrit
]);

function ringOf(ramp) {
    return Object.freeze([ramp[1], ramp[2], ramp[3], ramp[4], ramp[3], ramp[2]]);
}

const RINGS = Object.freeze([
    RING_HUE,
    ringOf(RAMPS.AMB5),
    ringOf(RAMPS.GRN5),
    ringOf(RAMPS.BLU5)
]);

const FALLBACK_TENSION = {
    playing: 0.30,
    buildup: 0.65,
    climax: 1.0,
    afterglow: 0.20
};

function clamp01(v) {
    return Number.isFinite(v) ? (v < 0 ? 0 : (v > 1 ? 1 : v)) : 0;
}

function lerp(a, b, k) {
    return a + (b - a) * k;
}

export class AtariJuliaCycler {
    constructor() {
        this.name = 'Atari Julia Cycler';

        // Zeit- & Zustandsverwaltung
        this.lastT = null;
        this.lastState = 'idle';
        this.stateAge = 0;
        this.simAcc = 0;
        this.simT = 0;

        // Geglaettete Tension & dynamische Fraktal-Parameter
        this.ten = 0.30;
        this.tenInit = false;
        this.rho = 0.015;
        this.zoomAmpMul = 1.0;

        // Beat- & Zykluszustand
        this.lastBeatCount = -1;
        this.hardCooldown = 0;
        this.medIterTimer = 0;
        this.hardFlashTimer = 0;
        this.contourBand = 1;
        this.cycle = 0;
        this.cycleRate = 2.5;
        this.cycleJump = 0;

        // Julia-Parameter c0 mit 1,0-s-Morph
        this.fam = 0;
        this.fromC0r = C0_FAMILIES[0].r;
        this.fromC0i = C0_FAMILIES[0].i;
        this.curC0r = C0_FAMILIES[0].r;
        this.curC0i = C0_FAMILIES[0].i;
        this.morphAge = MORPH_DURATION;

        this.psi = 0;
        this.psiSign = 1;

        // Ringfamilie & Timer-B-Raster-Wipe
        this.ringIdx = 0;
        this.inAfterglow = false;
        this.wipeFrom = RINGS[0];
        this.wipeTo = RINGS[0];
        this.wipeAge = WIPE_DURATION;

        // Diagnose-Metrik (fuer Tests: aktuelles maxIter)
        this.currentMaxIter = 16;
    }

    resize() {
        // Abbildung skaliert direkt ueber minDim; C-Orbit, Zyklus & Morph laufen weiter.
    }

    _startWipe(nextRing) {
        if (this.wipeTo === nextRing) return;
        this.wipeFrom = this.wipeAge < WIPE_DURATION ? this.wipeFrom : this.wipeTo;
        this.wipeTo = nextRing;
        this.wipeAge = 0;
    }

    _stepSimulation(stepDt, isAfterglow, state) {
        this.simT += stepDt;

        // Palettenzyklus (streng <= 6 Schritte/s)
        this.cycleRate = isAfterglow ? 0.8 : Math.min(6.0, lerp(2.0, 6.0, this.ten));
        this.cycle += this.cycleRate * stepDt;

        // c-Orbit
        const psiDot = (0.5 + 1.5 * this.ten) * (isAfterglow ? 0.30 : 1.0);
        this.psi += psiDot * stepDt * this.psiSign;

        const targetRho = isAfterglow ? 0.005 : lerp(0.01, 0.04, this.ten);
        this.rho += (targetRho - this.rho) * (1 - Math.exp(-stepDt / 0.35));

        const targetAmp = (!isAfterglow && (state === 'climax' || this.ten > 0.70)) ? 1.5 : 1.0;
        this.zoomAmpMul += (targetAmp - this.zoomAmpMul) * (1 - Math.exp(-stepDt / 0.35));

        // c0-Morph über 1,0 s
        if (this.morphAge < MORPH_DURATION) {
            this.morphAge = Math.min(MORPH_DURATION, this.morphAge + stepDt);
            const k = this.morphAge / MORPH_DURATION;
            const tgt = C0_FAMILIES[this.fam];
            this.curC0r = lerp(this.fromC0r, tgt.r, k);
            this.curC0i = lerp(this.fromC0i, tgt.i, k);
        }
    }

    _fr(ctx, x, y, rw, rh, color, w, h) {
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(rw) || !Number.isFinite(rh)) return;
        const x0 = Math.max(0, Math.round(x));
        const y0 = Math.max(0, Math.round(y));
        const x1 = Math.min(w, Math.round(x + rw));
        const y1 = Math.min(h, Math.round(y + rh));
        const cw = x1 - x0;
        const ch = y1 - y0;
        if (cw > 0 && ch > 0) {
            ctx.fillStyle = color;
            ctx.fillRect(x0, y0, cw, ch);
        }
    }

    _iterateJulia(zx0, zy0, cr, ci, maxIter) {
        let zx = zx0;
        let zy = zy0;
        let n = 0;
        while (n < maxIter) {
            const zx2 = zx * zx;
            const zy2 = zy * zy;
            if (zx2 + zy2 > 16) break;
            zy = 2 * zx * zy + ci;
            zx = zx2 - zy2 + cr;
            n++;
        }
        return n;
    }

    _colorForEscape(n, maxIter, cycleInt, zoneOff, ring, hardFlash, contourBand) {
        if (n >= maxIter) return INK;
        if (hardFlash && n === contourBand) return WHITE;
        const len = ring.length;
        const idx = (n + cycleInt + zoneOff) % len;
        return ring[idx < 0 ? idx + len : idx];
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
        this.medIterTimer = Math.max(0, this.medIterTimer - dt);
        this.hardFlashTimer = Math.max(0, this.hardFlashTimer - dt);
        this.wipeAge = Math.min(WIPE_DURATION, this.wipeAge + dt);

        // Tension (asymmetrisch geglaettet; erster Frame snappt fuer warmup:0-Stills)
        const safeMetrics = metrics || {};
        let targetTen = clamp01(safeMetrics.tensionPct ?? FALLBACK_TENSION[state] ?? 0.2);
        if (state === 'afterglow') targetTen = Math.min(targetTen, 0.30);
        if (state === 'starting' || state === 'stopping') targetTen = Math.min(targetTen, 0.25);

        const isAfterglow = state === 'afterglow';
        if (!this.tenInit) {
            this.ten = targetTen;
            this.rho = isAfterglow ? 0.005 : lerp(0.01, 0.04, this.ten);
            this.zoomAmpMul = (!isAfterglow && (state === 'climax' || this.ten > 0.70)) ? 1.5 : 1.0;
            this.cycleRate = isAfterglow ? 0.8 : Math.min(6.0, lerp(2.0, 6.0, this.ten));
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
            this._startWipe(RINGS[3]);
        } else if (!isAfterglow && this.inAfterglow) {
            this.inAfterglow = false;
            this._startWipe(RINGS[this.ringIdx]);
        }

        if (onBeat) {
            if (level === 1) {
                this.cycleJump += 1;
            } else if (level === 2) {
                this.cycleJump += 2;
                if (!isAfterglow) this.medIterTimer = 0.20;
            } else if (level === 3) {
                this.cycleJump += 3;
                if (this.hardCooldown <= 0) {
                    this.hardCooldown = 0.25;
                    if (!isAfterglow) {
                        this.contourBand = 1 + (count % 8);
                        this.hardFlashTimer = 0.12;
                    }
                }
            }

            if (!isAfterglow && count > 0 && count % 4 === 0) {
                this.fromC0r = this.curC0r;
                this.fromC0i = this.curC0i;
                this.fam = (this.fam + 1) & 3;
                this.morphAge = 0;
            }

            if (count > 0 && count % 8 === 0) {
                this.psiSign = -this.psiSign;
                if (!isAfterglow) {
                    this.ringIdx = (this.ringIdx + 1) & 3;
                    this._startWipe(RINGS[this.ringIdx]);
                }
            }
        }

        // Simulation im festen 50-Hz-Schritt
        this.simAcc += dt;
        let steps = 0;
        while (this.simAcc >= 0.02 && steps++ < 4) {
            this._stepSimulation(0.02, isAfterglow, state);
            this.simAcc -= 0.02;
        }

        const baseIter = isAfterglow ? 14 : (this.ten < 0.35 ? 16 : 24);
        const maxIter = baseIter + (!isAfterglow && this.medIterTimer > 0 ? 4 : 0);
        this.currentMaxIter = maxIter;

        // Bei vis <= 0 vollstaendig Schwarz ausblenden
        if (vis <= 0) {
            this._fr(ctx, 0, 0, w, h, INK, w, h);
            return;
        }

        // =========================================================
        // 1. ZELLRASTER & ABBILDUNG
        // =========================================================
        let cell = Math.max(3, Math.ceil(Math.sqrt((w * h) / 6000)));
        while (Math.ceil(w / cell) * Math.ceil(h / cell) > 6000) {
            cell++;
        }

        const minDim = Math.max(1, Math.min(w, h));
        const cxMid = w * 0.5;
        const cyMid = h * 0.5;
        const zoom = (1 + 0.12 * this.zoomAmpMul * Math.sin(0.4 * this.simT))
            * (1 + 0.18 * impulse)
            * (1 + 2 * (1 - vis));
        const kScale = 3.2 / (minDim * zoom);

        const cr = this.curC0r + this.rho * Math.cos(this.psi) + 0.01 * impulse * Math.cos(0.7 * dir);
        const ci = this.curC0i + this.rho * Math.sin(this.psi) + 0.01 * impulse * Math.sin(0.7 * dir);

        const halfDiag = Math.max(1, 0.5 * Math.hypot(w, h));
        const r0Sq = (0.33 * halfDiag) * (0.33 * halfDiag);
        const r1Sq = (0.66 * halfDiag) * (0.66 * halfDiag);
        const zOff0 = Math.round(ch0 * 3);
        const zOff1 = Math.round(ch1 * 3);
        const zOff2 = Math.round(ch2 * 3);

        const cycleInt = Math.floor(this.cycle) + this.cycleJump;
        const hardFlash = !isAfterglow && this.hardFlashTimer > 0;
        const contourBand = this.contourBand;

        const wipeY = this.wipeAge < WIPE_DURATION
            ? Math.floor((this.wipeAge / WIPE_DURATION) * h)
            : h;

        // =========================================================
        // 2. JULIA-ITERATION & HORIZONTALES RUN-MERGING
        // =========================================================
        for (let cy = 0; cy < h; cy += cell) {
            const rowH = Math.min(cell, h - cy);
            const py = cy + rowH * 0.5;
            const dyC = py - cyMid;
            const dyC2 = dyC * dyC;
            const zy0 = dyC * kScale;
            const crossesWipe = wipeY > cy && wipeY < cy + rowH;

            if (!crossesWipe) {
                const ring = cy < wipeY ? this.wipeTo : this.wipeFrom;
                let runColor = null;
                let runStartX = 0;

                for (let cx = 0; cx < w; cx += cell) {
                    const colW = Math.min(cell, w - cx);
                    const px = cx + colW * 0.5;
                    const dxC = px - cxMid;
                    const dist2 = dxC * dxC + dyC2;
                    const zoneOff = dist2 < r0Sq ? zOff0 : (dist2 < r1Sq ? zOff1 : zOff2);

                    const n = this._iterateJulia(dxC * kScale, zy0, cr, ci, maxIter);
                    const col = this._colorForEscape(n, maxIter, cycleInt, zoneOff, ring, hardFlash, contourBand);

                    if (col !== runColor) {
                        if (runColor !== null) {
                            this._fr(ctx, runStartX, cy, cx - runStartX, rowH, runColor, w, h);
                        }
                        runColor = col;
                        runStartX = cx;
                    }
                }
                if (runColor !== null) {
                    this._fr(ctx, runStartX, cy, w - runStartX, rowH, runColor, w, h);
                }
            } else {
                const topH = wipeY - cy;
                const botH = (cy + rowH) - wipeY;
                let runTop = null;
                let startTopX = 0;
                let runBot = null;
                let startBotX = 0;

                for (let cx = 0; cx < w; cx += cell) {
                    const colW = Math.min(cell, w - cx);
                    const px = cx + colW * 0.5;
                    const dxC = px - cxMid;
                    const dist2 = dxC * dxC + dyC2;
                    const zoneOff = dist2 < r0Sq ? zOff0 : (dist2 < r1Sq ? zOff1 : zOff2);

                    const n = this._iterateJulia(dxC * kScale, zy0, cr, ci, maxIter);

                    const colTop = this._colorForEscape(n, maxIter, cycleInt, zoneOff, this.wipeTo, hardFlash, contourBand);
                    if (colTop !== runTop) {
                        if (runTop !== null) {
                            this._fr(ctx, startTopX, cy, cx - startTopX, topH, runTop, w, h);
                        }
                        runTop = colTop;
                        startTopX = cx;
                    }

                    const colBot = this._colorForEscape(n, maxIter, cycleInt, zoneOff, this.wipeFrom, hardFlash, contourBand);
                    if (colBot !== runBot) {
                        if (runBot !== null) {
                            this._fr(ctx, startBotX, wipeY, cx - startBotX, botH, runBot, w, h);
                        }
                        runBot = colBot;
                        startBotX = cx;
                    }
                }
                if (runTop !== null) {
                    this._fr(ctx, startTopX, cy, w - startTopX, topH, runTop, w, h);
                }
                if (runBot !== null) {
                    this._fr(ctx, startBotX, wipeY, w - startBotX, botH, runBot, w, h);
                }
            }
        }

        // =========================================================
        // 3. BAYER-4x4 TRANSITION FADE (Background Vollflaeche)
        // =========================================================
        if (vis < 1) {
            bayerFadeCells(ctx, 0, 0, w, h, vis, 2, INK);
        }
    }
}