// =========================================================
// DEMO-SCENE-ELEMENT: ATARI META BLOBS (Background DSE)
// Atari-ST-Chunky-Metaballs in <= 5000 Zellen mit Run-Merging.
// Features:
// - 3 YM2149-Stimmenbälle (A/B/C) + bis zu 4 Orbit-Satelliten mit Index-Aktivierung
// - Responsives Layout entlang der langen Achse (Portraet vertikal, Widescreen horizontal)
// - 4 Satellitenbahnformen (Ellipse, Acht, quer, laengs) mit 0,5 s Uebergang
// - 4 Iso-Schwellen + INK + Climax-WHITE-Kern (max 14 Farben je Scanline)
// - Timer-B-Raster-Wipe am 8. Beat & nativer DOM-freier Bayer-4x4-Fade
// =========================================================

import { bayerFadeCells } from '../../utils/hardware-constraints.js';
import { COOL, INK, SETS, WHITE } from './atari-kit.js';

const T_IN = 1.5;
const T_OUT = 1.5;
const WIPE_DURATION = 0.5;
const SHAPE_DURATION = 0.5;
const MAX_BALLS = 7;

const SHAPE_PARAMS = Object.freeze([
    Object.freeze({ ax: 0.36, ay1: 0.30, ay2: 0.00 }), // 0: Ellipse
    Object.freeze({ ax: 0.36, ay1: 0.00, ay2: 0.24 }), // 1: Acht
    Object.freeze({ ax: 0.22, ay1: 0.40, ay2: 0.00 }), // 2: Ellipse quer
    Object.freeze({ ax: 0.42, ay1: 0.18, ay2: 0.00 })  // 3: Ellipse laengs
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

export class AtariMetaBlobs {
    constructor() {
        this.name = 'Atari Meta Blobs';

        // Zeit- & Zustandsverwaltung
        this.lastT = null;
        this.lastState = 'idle';
        this.stateAge = 0;
        this.simAcc = 0;
        this.voicePhase = 0;

        // Geglaettete Tension & Ball-Aktivierung (mit Hysterese)
        this.ten = 0.30;
        this.tenInit = false;
        this.nActive = 3;

        // Beat- & Bahn-Zustand
        this.lastBeatCount = -1;
        this.hardCooldown = 0;
        this.repel = 0;
        this.medTimer = 0;
        this.hardFlashTimer = 0;
        this.pop = new Float32Array([1.0, 1.0, 1.0]);

        this.orbit = 0;
        this.orbitSign = 1;
        this.orbitShape = 0;
        this.shapeAge = SHAPE_DURATION;
        this.fromAx = SHAPE_PARAMS[0].ax;
        this.fromAy1 = SHAPE_PARAMS[0].ay1;
        this.fromAy2 = SHAPE_PARAMS[0].ay2;
        this.curAx = SHAPE_PARAMS[0].ax;
        this.curAy1 = SHAPE_PARAMS[0].ay1;
        this.curAy2 = SHAPE_PARAMS[0].ay2;

        // Satelliten-Index-Aktivierung (tau 0.2 s)
        this.satScale = new Float32Array(4);

        // Familien- & Timer-B-Raster-Wipe Zustand
        this.setIdx = 0;
        this.inAfterglow = false;
        this.wipeFrom = SETS[0];
        this.wipeTo = SETS[0];
        this.wipeAge = WIPE_DURATION;

        // Fest allokierte Ball-Arbeitsarrays (7 Slots, Zero-GC)
        this.ballX = new Float32Array(MAX_BALLS);
        this.ballY = new Float32Array(MAX_BALLS);
        this.ballR2 = new Float32Array(MAX_BALLS);
        this.ballVoice = new Uint8Array(MAX_BALLS);
    }

    resize() {
        // Normierte U/V-Bahnen und Radien passen sich im naechsten render()
        // sofort an die neuen Buffer-Dimensionen an.
    }

    _startWipe(nextSet) {
        if (this.wipeTo === nextSet) return;
        this.wipeFrom = this.wipeAge < WIPE_DURATION ? this.wipeFrom : this.wipeTo;
        this.wipeTo = nextSet;
        this.wipeAge = 0;
    }

    _updateActiveCount(isAfterglow) {
        if (isAfterglow) return;
        if (!this.tenInit) {
            this.nActive = this.ten < 0.35 ? 3 : (this.ten < 0.70 ? 5 : 7);
            return;
        }
        // Hysterese +/-0.05 verhindert Flackern an Bandgrenzen
        if (this.nActive === 3) {
            if (this.ten >= 0.40) this.nActive = this.ten >= 0.75 ? 7 : 5;
        } else if (this.nActive === 5) {
            if (this.ten < 0.30) this.nActive = 3;
            else if (this.ten >= 0.75) this.nActive = 7;
        } else {
            if (this.ten < 0.65) this.nActive = this.ten < 0.30 ? 3 : 5;
        }
    }

    _stepSimulation(stepDt, isAfterglow) {
        const speedMul = isAfterglow ? 0.30 : 1.0;
        this.voicePhase += stepDt * speedMul;

        const omegaS = lerp(0.25, 0.90, this.ten) * speedMul;
        this.orbit += omegaS * stepDt * this.orbitSign;

        // Satelliten-Bahnform weich über 0,5 s interpolieren
        if (this.shapeAge < SHAPE_DURATION) {
            this.shapeAge = Math.min(SHAPE_DURATION, this.shapeAge + stepDt);
            const k = this.shapeAge / SHAPE_DURATION;
            const tgt = SHAPE_PARAMS[this.orbitShape];
            this.curAx = lerp(this.fromAx, tgt.ax, k);
            this.curAy1 = lerp(this.fromAy1, tgt.ay1, k);
            this.curAy2 = lerp(this.fromAy2, tgt.ay2, k);
        }

        // Satelliten-Radien per Index-Aktivierung mit tau 0.2 s fahren
        const kSat = 1 - Math.exp(-stepDt / 0.20);
        for (let s = 0; s < 4; s++) {
            const target = (3 + s) < this.nActive ? 1.0 : 0.0;
            this.satScale[s] += (target - this.satScale[s]) * kSat;
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

    _computeCellColor(px, py, activeBallCount, th0, th1, th2, th3, rampSet, showClimaxCore, hardFlash) {
        let sum = 0;
        let maxTerm = -1;
        let domVoice = 0;

        for (let i = 0; i < activeBallCount; i++) {
            const dx = px - this.ballX[i];
            const dy = py - this.ballY[i];
            const term = this.ballR2[i] / (dx * dx + dy * dy + 1);
            sum += term;
            if (term > maxTerm) {
                maxTerm = term;
                domVoice = this.ballVoice[i];
            }
        }

        if (sum <= th0) return INK;

        let level = 1;
        if (sum > th1) {
            level = 2;
            if (sum > th2) {
                level = 3;
                if (sum > th3) level = 4;
            }
        }

        if (hardFlash && level === 3) return WHITE;
        if (showClimaxCore && sum > 4.5) return WHITE;
        return rampSet[domVoice][level];
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

        // Kurzzeit-Timer & Beat-Abklingkurven fortschreiben
        this.hardCooldown = Math.max(0, this.hardCooldown - dt);
        this.medTimer = Math.max(0, this.medTimer - dt);
        this.hardFlashTimer = Math.max(0, this.hardFlashTimer - dt);
        this.wipeAge = Math.min(WIPE_DURATION, this.wipeAge + dt);

        if (this.repel > 0) {
            this.repel *= Math.exp(-dt / 0.20);
            if (this.repel < 1e-4) this.repel = 0;
        }
        const kPop = Math.exp(-dt / 0.10);
        for (let c = 0; c < 3; c++) {
            this.pop[c] = 1.0 + (this.pop[c] - 1.0) * kPop;
        }

        // Tension (asymmetrisch geglaettet; erster Frame snappt fuer warmup:0-Stills)
        const safeMetrics = metrics || {};
        let targetTen = clamp01(safeMetrics.tensionPct ?? FALLBACK_TENSION[state] ?? 0.2);
        if (state === 'afterglow') targetTen = Math.min(targetTen, 0.30);
        if (state === 'starting' || state === 'stopping') targetTen = Math.min(targetTen, 0.25);

        const isAfterglow = state === 'afterglow';
        if (!this.tenInit) {
            this.ten = targetTen;
            this._updateActiveCount(false);
            this.tenInit = true;
            for (let s = 0; s < 4; s++) {
                this.satScale[s] = (3 + s) < this.nActive ? 1.0 : 0.0;
            }
        } else {
            const tau = targetTen > this.ten ? 0.30 : 0.90;
            this.ten += (targetTen - this.ten) * (1 - Math.exp(-dt / tau));
            this._updateActiveCount(isAfterglow);
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
            if (level === 1) {
                this.repel = 1.0;
            } else if (level === 2) {
                this.medTimer = 0.15;
            } else if (level === 3) {
                if (this.hardCooldown <= 0) {
                    this.hardCooldown = 0.25;
                    let bestC = 0;
                    if (ch1 > chVals[bestC]) bestC = 1;
                    if (ch2 > chVals[bestC]) bestC = 2;
                    this.pop[bestC] = 1.6;
                    if (!isAfterglow) this.hardFlashTimer = 0.12;
                }
            }

            if (!isAfterglow && count > 0 && count % 4 === 0) {
                this.fromAx = this.curAx;
                this.fromAy1 = this.curAy1;
                this.fromAy2 = this.curAy2;
                this.orbitShape = (this.orbitShape + 1) & 3;
                this.shapeAge = 0;
            }

            if (count > 0 && count % 8 === 0) {
                this.orbitSign = -this.orbitSign;
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
            this._stepSimulation(0.02, isAfterglow);
            this.simAcc -= 0.02;
        }

        // Bei vis <= 0 vollstaendig Schwarz ausblenden
        if (vis <= 0) {
            this._fr(ctx, 0, 0, w, h, INK, w, h);
            return;
        }

        // =========================================================
        // 1. ZELLRASTER & BALL-POSITIONEN
        // =========================================================
        let cell = Math.max(3, Math.ceil(Math.sqrt((w * h) / 5000)));
        while (Math.ceil(w / cell) * Math.ceil(h / cell) > 5000) {
            cell++;
        }

        const minDim = Math.min(w, h);
        const longDim = Math.max(w, h);
        const isLandscape = w >= h;
        const R0 = 0.11 * (minDim + longDim) * 0.5;
        const visScale = (state === 'starting' || state === 'stopping') ? vis : 1.0;
        const agScale = isAfterglow ? 0.80 : 1.0;
        const vp = this.voicePhase;

        let activeBalls = 0;

        // Slots 0..2: Stimmenbälle A, B, C
        for (let c = 0; c < 3; c++) {
            const u = 0.2 + 0.3 * c + 0.07 * Math.sin(0.31 * vp * (1 + 0.3 * c) + 2.1 * c) + (c - 1) * 0.02 * this.repel;
            const v = 0.5 + 0.22 * Math.sin(0.43 * vp + 1.7 * c);
            const r = R0 * (0.55 + 0.9 * chVals[c]) * (1 + 0.3 * impulse) * this.pop[c] * visScale * agScale;
            this.ballX[activeBalls] = isLandscape ? u * w : v * w;
            this.ballY[activeBalls] = isLandscape ? v * h : u * h;
            this.ballR2[activeBalls] = r * r;
            this.ballVoice[activeBalls] = c;
            activeBalls++;
        }

        // Slots 3..6: Satelliten (gehoeren Stimme (i - 3) % 3)
        for (let s = 0; s < 4; s++) {
            const scale = this.satScale[s];
            if (scale <= 0.01) continue;
            const voice = s % 3;
            const ang = this.orbit + s * (Math.PI * 0.5);
            const u = 0.5 + this.curAx * Math.cos(ang);
            const v = 0.5 + this.curAy1 * Math.sin(ang) + this.curAy2 * Math.sin(2 * ang);
            const r = 0.6 * R0 * (0.6 + 0.8 * chVals[voice]) * (1 + 0.3 * impulse) * scale * visScale * agScale;
            this.ballX[activeBalls] = isLandscape ? u * w : v * w;
            this.ballY[activeBalls] = isLandscape ? v * h : u * h;
            this.ballR2[activeBalls] = r * r;
            this.ballVoice[activeBalls] = voice;
            activeBalls++;
        }

        // =========================================================
        // 2. FELD AUSWERTEN & MIT RUN-MERGING ZEICHNEN
        // =========================================================
        const thMul = (1.25 - 0.5 * this.ten) * (this.medTimer > 0 ? 0.85 : 1.0);
        const th0 = 0.55 * thMul;
        const th1 = 0.90 * thMul;
        const th2 = 1.40 * thMul;
        const th3 = 2.20 * thMul;

        const showClimaxCore = !isAfterglow && (state === 'climax' || this.ten > 0.70);
        const hardFlash = !isAfterglow && this.hardFlashTimer > 0;
        const wipeY = this.wipeAge < WIPE_DURATION
            ? Math.floor((this.wipeAge / WIPE_DURATION) * h)
            : h;

        for (let cy = 0; cy < h; cy += cell) {
            const rowH = Math.min(cell, h - cy);
            const py = cy + rowH * 0.5;
            const crossesWipe = wipeY > cy && wipeY < cy + rowH;

            if (!crossesWipe) {
                const rampSet = cy < wipeY ? this.wipeTo : this.wipeFrom;
                let runColor = null;
                let runStartX = 0;

                for (let cx = 0; cx < w; cx += cell) {
                    const colW = Math.min(cell, w - cx);
                    const px = cx + colW * 0.5;
                    const color = this._computeCellColor(
                        px, py, activeBalls, th0, th1, th2, th3, rampSet, showClimaxCore, hardFlash
                    );

                    if (color !== runColor) {
                        if (runColor !== null) {
                            this._fr(ctx, runStartX, cy, cx - runStartX, rowH, runColor, w, h);
                        }
                        runColor = color;
                        runStartX = cx;
                    }
                }
                if (runColor !== null) {
                    this._fr(ctx, runStartX, cy, w - runStartX, rowH, runColor, w, h);
                }
            } else {
                // Zellzeile exakt an Timer-B-Split wipeY teilen (strict <= 14 Farben/Scanline)
                const topH = wipeY - cy;
                const botH = (cy + rowH) - wipeY;
                let runTop = null;
                let startTopX = 0;
                let runBot = null;
                let startBotX = 0;

                for (let cx = 0; cx < w; cx += cell) {
                    const colW = Math.min(cell, w - cx);
                    const px = cx + colW * 0.5;

                    const colTop = this._computeCellColor(
                        px, py, activeBalls, th0, th1, th2, th3, this.wipeTo, showClimaxCore, hardFlash
                    );
                    if (colTop !== runTop) {
                        if (runTop !== null) {
                            this._fr(ctx, startTopX, cy, cx - startTopX, topH, runTop, w, h);
                        }
                        runTop = colTop;
                        startTopX = cx;
                    }

                    const colBot = this._computeCellColor(
                        px, py, activeBalls, th0, th1, th2, th3, this.wipeFrom, showClimaxCore, hardFlash
                    );
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