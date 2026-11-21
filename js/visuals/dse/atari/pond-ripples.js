// =========================================================
// DEMO-SCENE-ELEMENT: ATARI POND RIPPLES (Floor DSE)
// Perspektivische Wasserflaeche mit 9-Bit-Shifter-Rampen ab y >= horizon.
// Features:
// - Strenger Horizont-Vertrag (y >= floor(height * 0.55)), Null Pixel darueber
// - Gestufter Tiefenverlauf mit Zeilen-Dither & Timer-B-Raster-Wipe
// - 3 YM2149-Wellenquellen (A=links-fern, B=mittig-nah, C=rechts-fern)
// - Feste Pools (12 Ripples, 12 Spruehstriche, 24 Glitzer) & Xorshift32
// - Run-merged geclippte Midpoint-Ellipsen (drawAliasedEllipseOutlineClipped)
// =========================================================

import {
    bayerFadeCells,
    createXorshift32,
    drawAliasedEllipseOutlineClipped
} from '../../utils/hardware-constraints.js';
import { INK, RAMPS, WFAM } from './atari-kit.js';

const T_IN = 1.5;
const T_OUT = 1.5;
const WIPE_DURATION = 0.5;
const RIPPLE_POOL_SIZE = 12;
const SPRAY_POOL_SIZE = 12;
const GLINT_POOL_SIZE = 24;

const SOURCE_ZW = [2.8, 1.8, 2.8];

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

function posMod(a, m) {
    const r = a % m;
    return r < 0 ? r + m : r;
}

function hash01(seed) {
    let x = (seed | 0) ^ 0x9E3779B9;
    x = Math.imul(x ^ (x >>> 16), 0x85EBCA6B);
    x = Math.imul(x ^ (x >>> 13), 0xC2B2AE35);
    return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

export class AtariPondRipples {
    constructor() {
        this.name = 'Atari Pond Ripples';

        // Zeit- & Zustandsverwaltung
        this.lastT = null;
        this.lastState = 'idle';
        this.stateAge = 0;
        this.simAcc = 0;
        this.stepCounter = 0;

        // Geglaettete Tension
        this.ten = 0.30;
        this.tenInit = false;

        // Beat- & Familienzustand
        this.lastBeatCount = -1;
        this.hardCooldown = 0;
        this.fam = 0;
        this.driftSign = 1;
        this.inAfterglow = false;

        // Timer-B Raster-Wipe Zustand
        this.wipeFrom = WFAM[0];
        this.wipeTo = WFAM[0];
        this.wipeAge = WIPE_DURATION;

        // Instanzeigener deterministischer PRNG (Zero Math.random)
        this.rng = createXorshift32(0x504E4431); // 'PND1'

        // Fest allokierter Ripple-Pool (12 Slots, Zero-GC)
        this.ripples = Array.from({ length: RIPPLE_POOL_SIZE }, () => ({
            active: false,
            xw: 0,
            zw: 2.0,
            age: 0,
            life: 2.0,
            rw: 0,
            amp: 1,
            rings: 1,
            delay: 0
        }));
        this.rippleSeq = 0;

        // Fest allokierter Spruehstrich-Pool (12 Slots, Zero-GC)
        this.sprays = Array.from({ length: SPRAY_POOL_SIZE }, () => ({
            active: false,
            xw: 0,
            zw: 2.0,
            theta: 0,
            len: 3,
            age: 0,
            rw: 0.12,
            amp: 1
        }));
        this.sprayCursor = 0;

        // Fest allokierter Glitzer-Pool (24 Slots, Zero-GC)
        this.glints = Array.from({ length: GLINT_POOL_SIZE }, () => ({
            xNorm: 0.5,
            rNorm: 0.5,
            len: 3
        }));
        this.glintDriftPx = 0;
        this._rerollGlints();
    }

    resize() {
        // Weltkoordinaten (xw, zw) und normalisierte Glitzer (xNorm, rNorm)
        // projizieren direkt auf das neue width/height ohne Neuaufbau.
    }

    _rerollGlints() {
        for (let i = 0; i < GLINT_POOL_SIZE; i++) {
            const g = this.glints[i];
            const rndY = this.rng.float();
            g.xNorm = this.rng.float();
            g.rNorm = 0.2 + 0.8 * rndY * rndY;
            g.len = 2 + this.rng.int(5); // 2..6 px
        }
        this.glintDriftPx = 0;
    }

    _startWipe(nextRamp) {
        if (this.wipeTo === nextRamp) return;
        this.wipeFrom = this.wipeAge < WIPE_DURATION ? this.wipeFrom : this.wipeTo;
        this.wipeTo = nextRamp;
        this.wipeAge = 0;
    }

    _countActiveRipples() {
        let count = 0;
        for (let i = 0; i < RIPPLE_POOL_SIZE; i++) {
            if (this.ripples[i].active) count++;
        }
        return count;
    }

    _spawnRipple(xw, zw, amp, rings, maxActive, delay = 0, allowReplace = true) {
        let freeIdx = -1;
        let activeCount = 0;
        let oldestIdx = 0;
        let oldestScore = -Infinity;

        for (let i = 0; i < RIPPLE_POOL_SIZE; i++) {
            const rp = this.ripples[i];
            if (!rp.active) {
                if (freeIdx === -1) freeIdx = i;
            } else {
                activeCount++;
                const score = rp.age - rp.delay;
                if (score > oldestScore) {
                    oldestScore = score;
                    oldestIdx = i;
                }
            }
        }

        let targetIdx = -1;
        if (activeCount < maxActive && freeIdx !== -1) {
            targetIdx = freeIdx;
        } else if (allowReplace && activeCount > 0) {
            targetIdx = oldestIdx;
        }

        if (targetIdx === -1) return;

        const rp = this.ripples[targetIdx];
        rp.active = true;
        rp.xw = xw;
        rp.zw = zw;
        rp.age = 0;
        rp.life = 1.4 + 0.6 * amp;
        rp.rw = 0;
        rp.amp = amp;
        rp.rings = rings;
        rp.delay = delay;
    }

    _spawnSprays(xw, zw, amp, countSeed) {
        for (let i = 0; i < 6; i++) {
            const s = this.sprays[this.sprayCursor];
            this.sprayCursor = (this.sprayCursor + 1) % SPRAY_POOL_SIZE;
            const h1 = hash01(countSeed * 31 + i * 17 + 3);
            const h2 = hash01(countSeed * 53 + i * 29 + 7);
            s.active = true;
            s.xw = xw;
            s.zw = zw;
            s.theta = h1 * Math.PI * 2;
            s.len = 2 + Math.floor(h2 * 3); // 2..4 px
            s.age = 0;
            s.rw = 0.08;
            s.amp = amp;
        }
    }

    _stepSimulation(stepDt, ten, wideK, ripMax, rings, isAfterglow, allowDrip) {
        this.stepCounter++;
        const windVel = 0.06 * this.driftSign * (isAfterglow ? 0.5 : 1.0);
        this.glintDriftPx += this.driftSign * 6 * stepDt * (isAfterglow ? 0.5 : 1.0);

        if (this.stepCounter % 4 === 0) {
            this._rerollGlints();
        }

        // Bestehende Ripples integrieren (rw integriert -> kein Sprung bei Tempo-Aenderung)
        const speedBase = (1 + 0.8 * ten) * (isAfterglow ? 0.5 : 1.0);
        for (let i = 0; i < RIPPLE_POOL_SIZE; i++) {
            const rp = this.ripples[i];
            if (!rp.active) continue;
            if (rp.delay > 0) {
                rp.delay = Math.max(0, rp.delay - stepDt);
                continue;
            }
            const rpSpeed = (0.30 + 0.12 * rp.amp) * speedBase;
            rp.age += stepDt;
            rp.rw += rpSpeed * stepDt;
            rp.xw += windVel * stepDt;
            if (rp.age >= rp.life) {
                rp.active = false;
            }
        }

        // Spruehstriche fortschreiben (Lebensdauer 0.25 s)
        for (let i = 0; i < SPRAY_POOL_SIZE; i++) {
            const s = this.sprays[i];
            if (!s.active) continue;
            const sSpeed = (0.30 + 0.12 * s.amp) * speedBase;
            s.age += stepDt;
            s.rw += sSpeed * stepDt;
            s.xw += windVel * stepDt;
            if (s.age >= 0.25) {
                s.active = false;
            }
        }

        // Tropfen ohne Beats (hält den Teich ohne Audio lebendig)
        if (allowDrip) {
            const dripP = lerp(0.002, 0.03, ten) * (isAfterglow ? 0.3 : 1.0);
            if (this.rng.float() < dripP) {
                const xw = (this.rng.float() - 0.5) * 1.6 * wideK;
                const zw = 1.4 + 2.6 * this.rng.float();
                this._spawnRipple(xw, zw, 1, rings, ripMax, 0, false);
            }
        }
    }

    _waterStep(r, floorH) {
        const p = r / floorH;
        const base = clamp(Math.floor(1 + p * 2.99), 1, 3);
        const band = Math.max(2, Math.round(floorH * 0.04));
        const b1 = floorH / 3;
        const b2 = (2 * floorH) / 3;

        if (Math.abs(r - b1) <= band) {
            return (r & 1) === 0 ? 1 : 2;
        }
        if (Math.abs(r - b2) <= band) {
            return (r & 1) === 0 ? 2 : 3;
        }
        return base;
    }

    _fr(ctx, x, y, rw, rh, color, w, yMin, yMax) {
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(rw) || !Number.isFinite(rh)) return;
        const x0 = Math.max(0, Math.round(x));
        const y0 = Math.max(yMin, Math.round(y));
        const x1 = Math.min(w, Math.round(x + rw));
        const y1 = Math.min(yMax, Math.round(y + rh));
        const cw = x1 - x0;
        const ch = y1 - y0;
        if (cw > 0 && ch > 0) {
            ctx.fillStyle = color;
            ctx.fillRect(x0, y0, cw, ch);
        }
    }

    _drawClippedEllipseSplit(ctx, xc, yc, rx, ry, lvl, w, horizon, yMax, wipeY) {
        if (wipeY > horizon && wipeY < yMax) {
            const topH = wipeY - horizon;
            const botH = yMax - wipeY;
            if (yc - ry < wipeY && topH > 0) {
                drawAliasedEllipseOutlineClipped(ctx, xc, yc, rx, ry, this.wipeTo[lvl], {
                    x: 0, y: horizon, w, h: topH
                });
            }
            if (yc + ry >= wipeY && botH > 0) {
                drawAliasedEllipseOutlineClipped(ctx, xc, yc, rx, ry, this.wipeFrom[lvl], {
                    x: 0, y: wipeY, w, h: botH
                });
            }
            return;
        }
        const ramp = horizon < wipeY ? this.wipeTo : this.wipeFrom;
        drawAliasedEllipseOutlineClipped(ctx, xc, yc, rx, ry, ramp[lvl], {
            x: 0, y: horizon, w, h: yMax - horizon
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

        const horizon = Math.floor(h * 0.55);
        const floorH = h - horizon;
        const visH = vis >= 1 ? floorH : Math.floor(vis * floorH);
        const yMax = horizon + visH;

        this.hardCooldown = Math.max(0, this.hardCooldown - dt);
        this.wipeAge = Math.min(WIPE_DURATION, this.wipeAge + dt);

        // Tension (asymmetrisch geglaettet; Frame 0 snappt fuer warmup:0-Stills)
        const safeMetrics = metrics || {};
        let targetTen = clamp01(safeMetrics.tensionPct ?? FALLBACK_TENSION[state] ?? 0.2);
        if (state === 'afterglow') targetTen = Math.min(targetTen, 0.30);
        if (state === 'starting' || state === 'stopping') targetTen = Math.min(targetTen, 0.25);

        if (!this.tenInit) {
            this.ten = targetTen;
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
        const isAfterglow = state === 'afterglow';
        if (isAfterglow && !this.inAfterglow) {
            this.inAfterglow = true;
            this._startWipe(RAMPS.BLU5);
        } else if (!isAfterglow && this.inAfterglow) {
            this.inAfterglow = false;
            this._startWipe(WFAM[this.fam]);
        }

        const ripMax = this.ten < 0.35 ? 4 : (this.ten < 0.70 ? 8 : 12);
        const rings = isAfterglow ? 1 : (this.ten < 0.35 ? 1 : (this.ten < 0.70 ? 2 : 3));
        const sx = 0.5 * Math.min(w, 1.6 * h);
        const wideK = clamp(w / Math.max(1, 1.6 * h), 1, 1.5);
        const allowEmit = !isAfterglow && state !== 'stopping' && (state !== 'starting' || vis >= 0.6);

        if (onBeat) {
            if (allowEmit) {
                let bestC = 0;
                if (ch1 > chVals[bestC]) bestC = 1;
                if (ch2 > chVals[bestC]) bestC = 2;

                if (level === 1) {
                    const xw = (bestC - 1) * 0.55 * wideK;
                    this._spawnRipple(xw, SOURCE_ZW[bestC], 1, rings, ripMax, 0, true);
                } else if (level === 2 || level === 3) {
                    const canHard = level === 3 && this.hardCooldown <= 0;
                    if (canHard) this.hardCooldown = 0.25;

                    let any = false;
                    for (let c = 0; c < 3; c++) {
                        if (chVals[c] >= 0.25) {
                            any = true;
                            const xw = (c - 1) * 0.55 * wideK;
                            const amp = 1 + Math.round(2 * chVals[c]);
                            this._spawnRipple(xw, SOURCE_ZW[c], amp, rings, ripMax, 0, true);
                        }
                    }
                    if (!any) {
                        const xw = (bestC - 1) * 0.55 * wideK;
                        const amp = 1 + Math.round(2 * chVals[bestC]);
                        this._spawnRipple(xw, SOURCE_ZW[bestC], amp, rings, ripMax, 0, true);
                    }

                    if (canHard) {
                        const xwBest = (bestC - 1) * 0.55 * wideK;
                        const ampBest = 1 + Math.round(2 * chVals[bestC]);
                        this._spawnRipple(xwBest, SOURCE_ZW[bestC], ampBest, rings, ripMax, 0.12, true);
                        this._spawnSprays(xwBest, SOURCE_ZW[bestC], ampBest, count + this.rippleSeq++);
                    }
                }
            }

            if (!isAfterglow && count > 0 && count % 4 === 0) {
                this.fam = (this.fam + 1) & 3;
                this._startWipe(WFAM[this.fam]);
            }
            if (count > 0 && count % 8 === 0) {
                this.driftSign = -this.driftSign;
            }
        }

        // Simulation im festen 50-Hz-Schritt
        const allowDrip = state !== 'stopping' && (state !== 'starting' || vis >= 0.6);
        this.simAcc += dt;
        let steps = 0;
        while (this.simAcc >= 0.02 && steps++ < 4) {
            this._stepSimulation(0.02, this.ten, wideK, ripMax, rings, isAfterglow, allowDrip);
            this.simAcc -= 0.02;
        }

        // Bei vis <= 0 auf Floor komplett transparent beenden
        if (visH <= 0 || floorH <= 0) return;

        // Timer-B Split-Zeile
        const wipeY = this.wipeAge < WIPE_DURATION
            ? horizon + Math.floor((this.wipeAge / WIPE_DURATION) * floorH)
            : h;
        const rampAt = y => (y < wipeY ? this.wipeTo : this.wipeFrom);

        // =========================================================
        // 1. WASSERFLAECHE (Stufen 1..3 mit Zeilen-Dither & Run-Merging)
        // =========================================================
        let runColor = null;
        let runStartY = horizon;
        for (let r = 1; r <= visH; r++) {
            const y = horizon + r - 1;
            const step = this._waterStep(r, floorH);
            const col = rampAt(y)[step];
            if (col !== runColor) {
                if (runColor !== null) {
                    this._fr(ctx, 0, runStartY, w, y - runStartY, runColor, w, horizon, yMax);
                }
                runColor = col;
                runStartY = y;
            }
        }
        if (runColor !== null) {
            this._fr(ctx, 0, runStartY, w, yMax - runStartY, runColor, w, horizon, yMax);
        }

        // =========================================================
        // 2. GLITZER (Pool 24)
        // =========================================================
        const glintCount = isAfterglow ? 6 : (8 + Math.round(16 * this.ten));
        const activeGlints = Math.min(GLINT_POOL_SIZE, glintCount);
        for (let i = 0; i < activeGlints; i++) {
            const g = this.glints[i];
            const gy = horizon + Math.min(floorH - 1, Math.floor(g.rNorm * floorH));
            if (gy < horizon || gy >= yMax) continue;
            const gx = posMod(g.xNorm * w + this.glintDriftPx, w);
            const lvl = g.rNorm >= 0.5 ? 4 : 3;
            this._fr(ctx, gx, gy, g.len, 1, rampAt(gy)[lvl], w, horizon, yMax);
        }

        // =========================================================
        // 3. RIPPLES (Pool 12, run-merged Midpoint-Ellipsen)
        // =========================================================
        const impulseStep = Math.round(impulse);
        const thick = 1 + impulseStep;
        const activeRippleCount = this._countActiveRipples();

        for (let i = 0; i < RIPPLE_POOL_SIZE; i++) {
            const rp = this.ripples[i];
            if (!rp.active || rp.delay > 0) continue;

            const p0 = 1 / rp.zw;
            const xc = w * 0.5 + rp.xw * sx * p0;
            const yc = horizon + floorH / rp.zw;
            const rx = rp.rw * sx * p0;
            if (!Number.isFinite(rx) || rx < 1) continue;

            const gap = Math.max(2, Math.round(0.06 * sx * p0));
            const baseLvl = 4 - Math.floor(3 * (rp.age / rp.life));
            const lvl = clamp(baseLvl + impulseStep, 1, 4);
            const ringCount = isAfterglow ? 1 : rp.rings;

            for (let j = 0; j < ringCount; j++) {
                const rjx = rx - j * gap;
                if (rjx < 1) break;
                const rjy = Math.max(0.5, rjx * (0.18 + 0.20 * p0));

                this._drawClippedEllipseSplit(ctx, xc, yc, rjx, rjy, lvl, w, horizon, yMax, wipeY);

                if (thick === 2 && (j === 0 || activeRippleCount <= 8) && rjx >= 3) {
                    const innerRy = Math.max(0.5, rjy - 1);
                    this._drawClippedEllipseSplit(ctx, xc, yc, rjx - 1, innerRy, lvl, w, horizon, yMax, wipeY);
                }
            }
        }

        // =========================================================
        // 4. SPRUEHSTRICHE (Pool 12, Stufe 4 auf erstem Ring)
        // =========================================================
        for (let i = 0; i < SPRAY_POOL_SIZE; i++) {
            const s = this.sprays[i];
            if (!s.active) continue;
            const p0 = 1 / s.zw;
            const xc = w * 0.5 + s.xw * sx * p0;
            const yc = horizon + floorH / s.zw;
            const rx = Math.max(4, s.rw * sx * p0);
            const ry = Math.max(1.5, rx * (0.18 + 0.20 * p0));
            const px = xc + Math.cos(s.theta) * rx - s.len * 0.5;
            const py = Math.round(yc + Math.sin(s.theta) * ry);
            if (py < horizon || py >= yMax) continue;
            this._fr(ctx, px, py, s.len, 1, rampAt(py)[4], w, horizon, yMax);
        }

        // =========================================================
        // 5. BAYER-4x4 TRANSITION FADE (nur unterhalb Horizont!)
        // =========================================================
        if (vis < 1) {
            bayerFadeCells(ctx, 0, horizon, w, visH, vis, 2, INK);
        }
    }
}