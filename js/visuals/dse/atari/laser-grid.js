// =========================================================
// DEMO-SCENE-ELEMENT: ATARI LASER GRID (Floor DSE)
// Perspektivisches 80er/90er Atari-ST-Lasergitter ab y >= horizon.
// Features:
// - Strenger Horizont-Vertrag (y >= floor(height * 0.55)), Null Pixel darueber
// - 9-Bit-Shifter-Rampen (max 6 Farben/Scanline) mit Timer-B-Raster-Wipe
// - 3 YM2149-Lanes (A/B/C) als 50%-Scanline-Raster ohne Alpha-Blending
// - Horizontale Moire-Schutz-Dunstzone & kontinuierliche Perspektiv-Spannen
// - Fest allokierter 4er-Pulse-Pool, Gitterwelle & Climax-Laser-Sweeps
// =========================================================

import {
    bayerFadeCells,
    drawAliasedLineClipped
} from '../../utils/hardware-constraints.js';
import { FAM, INK, RAMPS } from './atari-kit.js';

const T_IN = 1.5;
const T_OUT = 1.5;
const WIPE_DURATION = 0.5;
const DZ_LINE = 0.4;
const HORIZ_COUNT = 10;
const HORIZ_PERIOD = HORIZ_COUNT * DZ_LINE; // 4.0
const PULSE_POOL_SIZE = 4;
const MAX_LINE_COLS = 128;

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

function posMod(a, m) {
    const r = a % m;
    return r < 0 ? r + m : r;
}

export class AtariLaserGrid {
    constructor() {
        this.name = 'Atari Laser Grid';

        // Zeit- & Zustandsverwaltung
        this.lastT = null;
        this.lastState = 'idle';
        this.stateAge = 0;
        this.simAcc = 0;
        this.simT = 0;

        // Geglaettete Tension
        this.ten = 0.30;
        this.tenInit = false;

        // Beat-Zustand
        this.lastBeatCount = -1;
        this.hardCooldown = 0;
        this.softFrontTimer = 0;
        this.waveTimer = 0;
        this.laneBoostTimer = 0;
        this.boostedLane = -1; // 0..2 = einzelne Stimme, 3 = alle Lanen

        // Persistente Floor-Parameter (ueberleben Resize/Rotation)
        this.dist = 0;
        this.fam = 0;
        this.driftSign = 1;
        this.driftNorm = 0.05;
        this.inAfterglow = false;

        // Timer-B Raster-Wipe Zustand
        this.wipeFrom = FAM[0];
        this.wipeTo = FAM[0];
        this.wipeAge = WIPE_DURATION;

        // Fest allokierter Pulse-Pool (Zero-GC)
        this.pulses = Array.from({ length: PULSE_POOL_SIZE }, () => ({
            active: false,
            zp: 4.2
        }));
        this.pulseCursor = 0;

        // Fest allokierte Zeilen-Puffer (Zero-GC)
        this.prevVertX = new Int16Array(MAX_LINE_COLS);
        this.rowWob = new Float32Array(512);
    }

    resize() {
        // Geometrie leitet sich dynamisch aus width/height ab;
        // dist, fam, driftNorm und Pulse-Pool laufen nahtlos weiter.
    }

    _startWipe(nextRamp) {
        if (this.wipeTo === nextRamp) return;
        this.wipeFrom = this.wipeAge < WIPE_DURATION ? this.wipeFrom : this.wipeTo;
        this.wipeTo = nextRamp;
        this.wipeAge = 0;
    }

    _spawnPulse() {
        for (let i = 0; i < PULSE_POOL_SIZE; i++) {
            const idx = (this.pulseCursor + i) % PULSE_POOL_SIZE;
            if (!this.pulses[idx].active) {
                this.pulses[idx].active = true;
                this.pulses[idx].zp = 4.2;
                this.pulseCursor = (idx + 1) % PULSE_POOL_SIZE;
                return;
            }
        }
        const p = this.pulses[this.pulseCursor];
        p.active = true;
        p.zp = 4.2;
        this.pulseCursor = (this.pulseCursor + 1) % PULSE_POOL_SIZE;
    }

    _stepSimulation(stepDt, speed, impulse, waveAmp) {
        this.simT += stepDt;
        this.dist = posMod(this.dist + speed * (1 + 1.2 * impulse) * stepDt, HORIZ_PERIOD * 10);

        const targetDrift = this.driftSign * 0.05;
        this.driftNorm += (targetDrift - this.driftNorm) * (1 - Math.exp(-stepDt / 0.16));

        for (let i = 0; i < PULSE_POOL_SIZE; i++) {
            const p = this.pulses[i];
            if (!p.active) continue;
            p.zp -= 3.0 * speed * stepDt;
            if (p.zp < 1.0) {
                p.active = false;
            }
        }

        this.currentWave = waveAmp;
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

        // Zeit-Schritt (PAL-freundlich geklemmt)
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

        // Sichtbarkeit (Floor darf ab vis <= 0 nichts mehr malen)
        const safeStateTime = Number.isFinite(stateTime) && stateTime >= 0 ? stateTime : this.stateAge;
        let vis = 1;
        if (state === 'starting') vis = clamp01(safeStateTime / T_IN);
        else if (state === 'stopping') vis = 1 - clamp01(safeStateTime / T_OUT);

        const horizon = Math.floor(h * 0.55);
        const floorH = h - horizon;
        const visH = vis >= 1 ? floorH : Math.floor(vis * floorH);
        const yMax = horizon + visH;

        // Abklingende Kurzzeit-Timer fortschreiben
        this.hardCooldown = Math.max(0, this.hardCooldown - dt);
        this.softFrontTimer = Math.max(0, this.softFrontTimer - dt);
        this.waveTimer = Math.max(0, this.waveTimer - dt);
        this.laneBoostTimer = Math.max(0, this.laneBoostTimer - dt);
        if (this.laneBoostTimer <= 0) this.boostedLane = -1;
        this.wipeAge = Math.min(WIPE_DURATION, this.wipeAge + dt);

        // Tension (asymmetrisch geglaettet; erster Frame snappt fuer warmup:0-Stills)
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

        // Diskretes Beat-Event (nur ueber beatStarted + beatCount)
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
            this._startWipe(FAM[this.fam]);
        }

        if (onBeat) {
            if (level === 1) {
                this.softFrontTimer = 0.10;
            } else if (level === 2) {
                if (!isAfterglow) this._spawnPulse();
                let bestC = 0;
                if (ch1 > chVals[bestC]) bestC = 1;
                if (ch2 > chVals[bestC]) bestC = 2;
                this.boostedLane = bestC;
                this.laneBoostTimer = 0.18;
            } else if (level === 3) {
                if (this.hardCooldown <= 0) {
                    this.hardCooldown = 0.25;
                    if (!isAfterglow) this.waveTimer = 0.50;
                    this.boostedLane = 3;
                    this.laneBoostTimer = 0.22;
                }
            }

            if (!isAfterglow && count > 0 && count % 4 === 0) {
                this.fam = (this.fam + 1) & 3;
                this._startWipe(FAM[this.fam]);
            }
            if (count > 0 && count % 8 === 0) {
                this.driftSign = -this.driftSign;
            }
        }

        // Simulation im festen 50-Hz-Raster fortschreiben
        const minDim = Math.min(w, h);
        const baseSpeed = lerp(0.5, 2.6, this.ten) * (isAfterglow ? 0.30 : 1.0);
        let waveAmp = (!isAfterglow && (state === 'climax' || this.ten >= 0.70)) ? 0.06 * minDim : 0;
        if (!isAfterglow && this.waveTimer > 0) {
            waveAmp += (this.waveTimer / 0.50) * 0.05 * minDim;
        }

        this.simAcc += dt;
        let steps = 0;
        while (this.simAcc >= 0.02 && steps++ < 4) {
            this._stepSimulation(0.02, baseSpeed, impulse, waveAmp);
            this.simAcc -= 0.02;
        }
        if (steps === 0 && dt > 0) {
            this.currentWave = waveAmp;
        }

        // Bei vis <= 0 auf Floor komplett transparent beenden
        if (visH <= 0 || floorH <= 0) return;

        // Timer-B Split-Zeile
        const wipeY = this.wipeAge < WIPE_DURATION
            ? horizon + Math.floor((this.wipeAge / WIPE_DURATION) * floorH)
            : h;
        const rampAt = y => (y < wipeY ? this.wipeTo : this.wipeFrom);

        // =========================================================
        // 1. GRUNDFLAECHE (Stufe 0, an wipeY gesplittet)
        // =========================================================
        if (wipeY > horizon && wipeY < yMax) {
            this._fr(ctx, 0, horizon, w, wipeY - horizon, this.wipeTo[0], w, horizon, yMax);
            this._fr(ctx, 0, wipeY, w, yMax - wipeY, this.wipeFrom[0], w, horizon, yMax);
        } else {
            this._fr(ctx, 0, horizon, w, visH, rampAt(horizon)[0], w, horizon, yMax);
        }

        // =========================================================
        // 2. MOIRE-SCHUTZ-DUNSTZONE & YM2149 LANE-GLOW (vor Linien!)
        // =========================================================
        const dxB = Math.max(10, Math.round(0.14 * Math.min(w, 1.6 * h))) * (1 + 0.04 * impulse);
        const vx = w * 0.5 + this.driftNorm * w;
        const hazeRows = Math.sqrt((2 * floorH) / DZ_LINE); // ~obere 23 % des Floors

        for (let r = 1; r <= visH; r++) {
            const y = horizon + r - 1;
            const p = r / floorH;
            const ramp = rampAt(y);

            // Feine Zeilen-Dither-Dunstzone nahe Horizont gegen Moire
            if (r < hazeRows && (y & 1) === 1) {
                this._fr(ctx, 0, y, w, 1, ramp[1], w, horizon, yMax);
            }

            // 3 stimmenspezifische Lanes auf jeder zweiten Zeile (historisches Scanline-Dithering)
            if ((y & 1) === 0) {
                const halfCenter = 1.5 * dxB * p;
                const xLeft = vx - halfCenter;
                const xRight = vx + halfCenter;

                const agSub = isAfterglow ? 1 : 0;
                const b0 = (this.boostedLane === 0 || this.boostedLane === 3) ? 1 : 0;
                const b1 = (this.boostedLane === 1 || this.boostedLane === 3) ? 1 : 0;
                const b2 = (this.boostedLane === 2 || this.boostedLane === 3) ? 1 : 0;

                const lvl0 = Math.max(0, Math.min(4, Math.round(ch0 * 3) + b0 - agSub));
                const lvl1 = Math.max(0, Math.min(4, Math.round(ch1 * 3) + b1 - agSub));
                const lvl2 = Math.max(0, Math.min(4, Math.round(ch2 * 3) + b2 - agSub));

                if (lvl0 >= 1 && xLeft > 0) {
                    this._fr(ctx, 0, y, xLeft, 1, ramp[lvl0], w, horizon, yMax);
                }
                if (lvl1 >= 1 && xRight > xLeft) {
                    this._fr(ctx, xLeft, y, xRight - xLeft, 1, ramp[lvl1], w, horizon, yMax);
                }
                if (lvl2 >= 1 && w > xRight) {
                    this._fr(ctx, xRight, y, w - xRight, 1, ramp[lvl2], w, horizon, yMax);
                }
            }
        }

        // =========================================================
        // 3. HORIZONTALE Z-LINIEN & SOFT-BEAT FRONT-HIGHLIGHT
        // =========================================================
        let frontK = -1;
        let frontZ = Infinity;
        if (this.softFrontTimer > 0) {
            for (let k = 0; k < HORIZ_COUNT; k++) {
                const zk = 1 + posMod(k * DZ_LINE - this.dist, HORIZ_PERIOD);
                if (zk < frontZ) {
                    frontZ = zk;
                    frontK = k;
                }
            }
        }

        for (let k = 0; k < HORIZ_COUNT; k++) {
            const zk = 1 + posMod(k * DZ_LINE - this.dist, HORIZ_PERIOD);
            const spacing = (floorH * DZ_LINE) / (zk * zk);
            if (spacing < 2) continue;

            const rk = floorH / zk;
            const yk = Math.max(horizon, Math.min(yMax - 1, horizon + Math.round(rk) - 1));
            if (yk < horizon || yk >= yMax) continue;

            const pk = 1 / zk;
            let lvl = Math.max(1, Math.min(4, 1 + Math.floor(pk * 4)));
            let thick = pk > 0.66 ? 2 : 1;

            if (k === frontK) {
                lvl = 4;
                thick = 2;
            }

            this._fr(ctx, 0, yk, w, 1, rampAt(yk)[lvl], w, horizon, yMax);
            if (thick === 2 && yk + 1 < yMax) {
                this._fr(ctx, 0, yk + 1, w, 1, rampAt(yk + 1)[lvl], w, horizon, yMax);
            }
        }

        // =========================================================
        // 4. PERSPEKTIVISCHE VERTIKALLINIEN (Fluchtpunkt + Wellengitter)
        // =========================================================
        const N = Math.min(
            Math.floor((MAX_LINE_COLS - 1) / 2),
            Math.ceil((w * 0.5 + Math.abs(this.driftNorm * w) + dxB) / dxB)
        );
        const lineCount = 2 * N + 1;

        // Wobble einmal je Zeile vorrechnen
        if (visH <= this.rowWob.length) {
            for (let r = 1; r <= visH; r++) {
                this.rowWob[r - 1] = waveAmp > 0
                    ? waveAmp * Math.sin(0.22 * r - 4 * this.simT) * (1 + 0.5 * Math.sin(0.07 * r))
                    : 0;
            }
        }

        const denomH = Math.max(1, floorH - 1);
        const vxInt = Math.round(vx);

        for (let r = 1; r <= visH; r++) {
            const y = horizon + r - 1;
            const pDepth = r / floorH;
            const pFan = floorH <= 1 ? 0 : (r - 1) / denomH;
            const wobR = r <= this.rowWob.length ? this.rowWob[r - 1] : 0;
            const lvl = Math.max(2, Math.min(4, 1 + Math.floor(pDepth * 4)));
            const col = rampAt(y)[lvl];

            for (let idx = 0; idx < lineCount; idx++) {
                const i = idx - N;
                const xCur = r === 1
                    ? vxInt
                    : Math.round(vx + i * dxB * pFan + wobR * pFan);

                const xPrev = r === 1 ? xCur : this.prevVertX[idx];
                this.prevVertX[idx] = xCur;

                const sx = xPrev < xCur ? xPrev : xCur;
                const sw = Math.abs(xCur - xPrev) + 1;
                if (sx + sw > 0 && sx < w) {
                    this._fr(ctx, sx, y, sw, 1, col, w, horizon, yMax);
                }
            }
        }

        // =========================================================
        // 5. PULSE-LINIEN (Pool 4)
        // =========================================================
        for (let i = 0; i < PULSE_POOL_SIZE; i++) {
            const p = this.pulses[i];
            if (!p.active) continue;
            const yp = horizon + Math.round(floorH / p.zp) - 1;
            if (yp < horizon || yp >= yMax) continue;

            const pp = 1 / p.zp;
            this._fr(ctx, 0, yp, w, 1, rampAt(yp)[4], w, horizon, yMax);
            if (pp > 0.66 && yp + 1 < yMax) {
                this._fr(ctx, 0, yp + 1, w, 1, rampAt(yp + 1)[4], w, horizon, yMax);
            }
        }

        // =========================================================
        // 6. LASER-SWEEPS (nur ten >= 0.70 und nicht im Afterglow)
        // =========================================================
        if (!isAfterglow && this.ten >= 0.70) {
            const basePhi = 0.8 * Math.sin(0.5 * this.simT);
            const rayLen = Math.hypot(w, h) + 16;

            for (let s = 0; s < 2; s++) {
                const phi = basePhi + (s === 0 ? -0.35 : 0.35);
                const ex = vxInt + Math.sin(phi) * rayLen;
                const ey = horizon + Math.cos(phi) * rayLen;

                if (wipeY > horizon && wipeY < yMax) {
                    drawAliasedLineClipped(ctx, vxInt, horizon, ex, ey, this.wipeTo[4], {
                        x: 0, y: horizon, w, h: wipeY - horizon
                    });
                    drawAliasedLineClipped(ctx, vxInt, horizon, ex, ey, this.wipeFrom[4], {
                        x: 0, y: wipeY, w, h: yMax - wipeY
                    });
                } else {
                    drawAliasedLineClipped(ctx, vxInt, horizon, ex, ey, rampAt(horizon)[4], {
                        x: 0, y: horizon, w, h: visH
                    });
                }
            }
        }

        // =========================================================
        // 7. BAYER-4x4 TRANSITION FADE (nur unterhalb Horizont!)
        // =========================================================
        if (vis < 1) {
            bayerFadeCells(ctx, 0, horizon, w, visH, vis, 2, INK);
        }
    }
}