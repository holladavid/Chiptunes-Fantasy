// === js/visuals/dse/atari/laser-grid.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: ATARI LASER GRID (Floor DSE)
// Perspektivisches 80er/90er Atari-ST-Lasergitter ab y >= horizon.
// Features:
// - Strenger Horizont-Vertrag (y >= floor(height * 0.55)), Null Pixel darueber
// - Echte 16-stufige Timer-B Raster-Interrupt-Farbverlaeufe pro Scanline-Band
//   (16+ 9-Bit-Shifter-Farben im Frame bei mathematisch <= 6 Farben/Scanline)
// - Bewegtes Timer-B-Glanzband auf Beat-Impuls & Climax
// - Lueckenlose, run-merged 3D-Wellen-Strahlen & weiche Bresenham-3D-Pulskurven
// - Perspektivisch konvergierende 3 YM2149-Spuren ohne eckige Seitenfluegel
// =========================================================

import {
    bayerFadeCells,
    drawAliasedLineClipped
} from '../../utils/hardware-constraints.js';
import { FAM, INK, RAMPS, WHITE, st } from './atari-kit.js';

const T_IN = 1.5;
const T_OUT = 1.5;
const WIPE_DURATION = 0.5;
const DZ_LINE = 0.55;
const HORIZ_COUNT = 36;
const HORIZ_PERIOD = HORIZ_COUNT * DZ_LINE; // 19.8 -> zk in [1.0 .. 20.8]
const PULSE_POOL_SIZE = 4;
const MAX_LINE_COLS = 128;
const RASTER_BANDS = 16;
const WAVE_CURVE_SEGMENTS = 12;

// 4x16 Timer-B Raster-Interrupt-Tabellen (pro Scanline-Band echte 9-Bit ST Shifter-Farben)
const RASTER_THEMES = Object.freeze([
    // 0: Cyber Outrun (Horizont Purpur/Magenta -> Kobalt -> Laser-Cyan FAM[0])
    Object.freeze({
        haze: Object.freeze([
            st(2, 0, 3), st(2, 0, 3), st(1, 0, 3), st(1, 0, 2),
            st(1, 0, 2), st(0, 1, 2), st(0, 1, 2), st(0, 1, 2),
            st(0, 1, 1), st(0, 1, 1), st(0, 1, 1), st(0, 1, 1),
            st(0, 1, 1), st(0, 1, 1), st(0, 1, 1), st(0, 1, 1)
        ]),
        grid: Object.freeze([
            st(4, 0, 5), st(5, 0, 6), st(4, 1, 7), st(3, 2, 7),
            st(1, 3, 7), st(0, 4, 7), st(0, 5, 6), st(0, 5, 6),
            st(1, 5, 5), st(1, 6, 6), st(2, 6, 6), st(3, 7, 6),
            st(3, 7, 6), st(4, 7, 7), RAMPS.CYN5[4], RAMPS.CYN5[4]
        ]),
        laneBoost: st(2, 0, 4),
        accent: RAMPS.VIO5[4],
        sweep: FAM[0][4]
    }),
    // 1: Synth Sunset (Horizont Karmesin/Ruby -> Orchid -> Neon-Violett FAM[1])
    Object.freeze({
        haze: Object.freeze([
            st(3, 0, 1), st(2, 0, 1), st(2, 0, 2), st(2, 0, 2),
            st(1, 0, 2), st(1, 0, 2), st(1, 0, 2), st(1, 0, 2),
            st(1, 0, 2), st(1, 0, 2), st(1, 0, 2), st(1, 0, 2),
            st(1, 0, 2), st(1, 0, 2), st(1, 0, 2), st(1, 0, 2)
        ]),
        grid: Object.freeze([
            st(4, 0, 2), st(6, 0, 3), st(7, 1, 4), st(7, 2, 5),
            st(6, 2, 7), st(5, 2, 7), st(4, 2, 7), st(4, 1, 6),
            st(5, 2, 7), st(6, 3, 7), st(6, 3, 7), st(7, 4, 7),
            st(7, 5, 7), RAMPS.VIO5[4], RAMPS.VIO5[4], RAMPS.VIO5[4]
        ]),
        laneBoost: st(0, 2, 3),
        accent: RAMPS.CYN5[4],
        sweep: FAM[1][4]
    }),
    // 2: Solar Copper (Horizont Blutrot -> Feuerorange -> Solar-Amber FAM[2])
    Object.freeze({
        haze: Object.freeze([
            st(3, 0, 0), st(3, 0, 0), st(2, 1, 0), st(2, 1, 0),
            st(1, 1, 0), st(1, 1, 0), st(1, 1, 0), st(1, 1, 0),
            st(1, 1, 0), st(1, 1, 0), st(1, 1, 0), st(1, 1, 0),
            st(1, 1, 0), st(1, 1, 0), st(1, 1, 0), st(1, 1, 0)
        ]),
        grid: Object.freeze([
            st(4, 0, 0), st(6, 1, 0), st(7, 2, 0), st(7, 3, 0),
            st(7, 4, 0), st(6, 4, 0), st(6, 5, 1), st(7, 5, 1),
            st(7, 6, 1), st(7, 6, 2), st(7, 6, 3), st(7, 7, 3),
            RAMPS.AMB5[4], RAMPS.AMB5[4], RAMPS.AMB5[4], RAMPS.AMB5[4]
        ]),
        laneBoost: st(4, 1, 0),
        accent: RAMPS.CYN5[4],
        sweep: FAM[2][4]
    }),
    // 3: Toxic Aurora (Horizont Tief-Kobalt -> Tuerkis -> Smaragd -> Matrix-Gruen FAM[3])
    Object.freeze({
        haze: Object.freeze([
            st(0, 1, 3), st(0, 1, 3), st(0, 2, 2), st(0, 2, 2),
            st(0, 1, 1), st(0, 1, 1), st(0, 1, 0), st(0, 1, 0),
            st(0, 1, 0), st(0, 1, 0), st(0, 1, 0), st(0, 1, 0),
            st(0, 1, 0), st(0, 1, 0), st(0, 1, 0), st(0, 1, 0)
        ]),
        grid: Object.freeze([
            st(0, 2, 5), st(0, 3, 6), st(0, 5, 6), st(0, 6, 5),
            st(1, 6, 4), st(1, 5, 2), st(1, 5, 1), st(2, 6, 1),
            st(3, 7, 2), st(4, 7, 2), st(5, 7, 3), st(5, 7, 4),
            RAMPS.GRN5[4], RAMPS.GRN5[4], RAMPS.GRN5[4], RAMPS.GRN5[4]
        ]),
        laneBoost: st(0, 3, 3),
        accent: RAMPS.CYN5[4],
        sweep: FAM[3][4]
    })
]);

const AFTERGLOW_THEME = Object.freeze({
    haze: Object.freeze(new Array(RASTER_BANDS).fill(RAMPS.BLU5[0])),
    grid: Object.freeze([
        RAMPS.BLU5[1], RAMPS.BLU5[1], RAMPS.BLU5[1], RAMPS.BLU5[1],
        RAMPS.BLU5[2], RAMPS.BLU5[2], RAMPS.BLU5[2], RAMPS.BLU5[2],
        RAMPS.BLU5[3], RAMPS.BLU5[3], RAMPS.BLU5[3], RAMPS.BLU5[3],
        RAMPS.BLU5[4], RAMPS.BLU5[4], RAMPS.BLU5[4], RAMPS.BLU5[4]
    ]),
    laneBoost: RAMPS.BLU5[1],
    accent: RAMPS.BLU5[4],
    sweep: RAMPS.BLU5[4]
});

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
    return Number.isFinite(v) ? (v < 0 ? 0 : (v > 1 ? 1 : v)) : 0;
}

function lerp(a, b, k) {
    return a + (b - a) * k;
}

function posMod(a, m) {
    const r = a % m;
    return r < 0 ? r + m : r;
}

function getTheme(famIdx) {
    return famIdx < 0 ? AFTERGLOW_THEME : RASTER_THEMES[famIdx & 3];
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
        this.vpFlashTimer = 0;
        this.currentWave = 0;

        // Persistente Floor-Parameter (ueberleben Resize/Rotation)
        this.dist = 0;
        this.fam = 0;
        this.driftSign = 1;
        this.driftNorm = 0.05;
        this.inAfterglow = false;

        // Timer-B Raster-Wipe Zustand (-1 = Afterglow BLU5, 0..3 = RASTER_THEMES[fam])
        this.wipeFromFam = 0;
        this.wipeToFam = 0;
        this.wipeFrom = FAM[0];
        this.wipeTo = FAM[0];
        this.wipeAge = WIPE_DURATION;

        // Fest allokierter Pulse-Pool (Zero-GC)
        this.pulses = Array.from({ length: PULSE_POOL_SIZE }, () => ({
            active: false,
            zp: 6.5,
            isHard: false
        }));
        this.pulseCursor = 0;

        // Fest allokierte Zeilen-Puffer (Zero-GC)
        this.rowWob = new Float32Array(512);
    }

    resize() {
        // Geometrie leitet sich dynamisch aus width/height ab;
        // dist, fam, driftNorm und Pulse-Pool laufen nahtlos weiter.
    }

    _startWipe(nextFamIdx) {
        if (this.wipeToFam === nextFamIdx) return;
        this.wipeFromFam = this.wipeToFam;
        this.wipeFrom = this.wipeFromFam < 0 ? RAMPS.BLU5 : FAM[this.wipeFromFam & 3];
        this.wipeToFam = nextFamIdx;
        this.wipeTo = nextFamIdx < 0 ? RAMPS.BLU5 : FAM[nextFamIdx & 3];
        this.wipeAge = 0;
    }

    _spawnPulse(isHard = false) {
        const startZ = isHard ? 8.5 : 6.5;
        for (let i = 0; i < PULSE_POOL_SIZE; i++) {
            const idx = (this.pulseCursor + i) % PULSE_POOL_SIZE;
            if (!this.pulses[idx].active) {
                this.pulses[idx].active = true;
                this.pulses[idx].zp = startZ;
                this.pulses[idx].isHard = isHard;
                this.pulseCursor = (idx + 1) % PULSE_POOL_SIZE;
                return;
            }
        }
        const p = this.pulses[this.pulseCursor];
        p.active = true;
        p.zp = startZ;
        p.isHard = isHard;
        this.pulseCursor = (this.pulseCursor + 1) % PULSE_POOL_SIZE;
    }

    _stepSimulation(stepDt, speed, impulse, waveAmp, isAfterglow) {
        this.simT += stepDt;
        this.dist = posMod(this.dist + speed * (1 + 1.15 * impulse) * stepDt, HORIZ_PERIOD * 10);

        const sway = isAfterglow ? 0.012 : 0.024;
        const targetDrift = this.driftSign * 0.05 + sway * Math.sin(this.simT * 0.55);
        this.driftNorm += (targetDrift - this.driftNorm) * (1 - Math.exp(-stepDt / 0.18));

        for (let i = 0; i < PULSE_POOL_SIZE; i++) {
            const p = this.pulses[i];
            if (!p.active) continue;
            const zRate = p.isHard ? 3.8 : 3.2;
            p.zp -= zRate * speed * stepDt;
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

    // Weiche Bresenham-3D-Bodenwelle statt klobiger Segment-Treppen
    _drawWavedHorizCurve(ctx, yBase, thick, waveAmp, zk, color, w, horizon, yMax) {
        const yStart = horizon + 1;
        if (yStart >= yMax || w <= 0) return;

        const ampPx = Math.min(6, Math.max(1, (waveAmp * 0.65) / Math.max(1, zk * 0.55)));
        const zPhase = zk * 1.4 - this.simT * 6.5;
        const clip = { x: 0, y: yStart, w, h: yMax - yStart };
        const segs = Math.min(WAVE_CURVE_SEGMENTS, Math.max(1, w));

        let prevX = 0;
        let prevY = clamp(
            Math.round(yBase + ampPx * Math.cos(-0.5 * Math.PI * 3.0) * Math.sin(zPhase + 2.25)),
            yStart,
            yMax - 1
        );

        for (let s = 1; s <= segs; s++) {
            const frac = s / segs;
            const curX = s === segs ? w - 1 : Math.round(frac * (w - 1));
            const u = frac - 0.5;
            const curY = clamp(
                Math.round(yBase + ampPx * Math.cos(u * Math.PI * 3.0) * Math.sin(zPhase + Math.abs(u) * 4.5)),
                yStart,
                yMax - 1
            );

            drawAliasedLineClipped(ctx, prevX, prevY, curX, curY, color, clip);
            if (thick === 2 && yMax - yStart >= 2) {
                drawAliasedLineClipped(ctx, prevX, prevY + 1, curX, curY + 1, color, clip);
            }
            prevX = curX;
            prevY = curY;
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
        this.vpFlashTimer = Math.max(0, this.vpFlashTimer - dt);
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
            this._startWipe(-1);
        } else if (!isAfterglow && this.inAfterglow) {
            this.inAfterglow = false;
            this._startWipe(this.fam);
        }

        if (onBeat) {
            if (level === 1) {
                this.softFrontTimer = 0.14;
            } else if (level === 2) {
                if (!isAfterglow) this._spawnPulse(false);
                let bestC = 0;
                if (ch1 > chVals[bestC]) bestC = 1;
                if (ch2 > chVals[bestC]) bestC = 2;
                this.boostedLane = bestC;
                this.laneBoostTimer = 0.20;
            } else if (level === 3) {
                if (this.hardCooldown <= 0) {
                    this.hardCooldown = 0.25;
                    if (!isAfterglow) {
                        this.waveTimer = 0.50;
                        this._spawnPulse(true);
                        this.vpFlashTimer = 0.16;
                    }
                    this.boostedLane = 3;
                    this.laneBoostTimer = 0.24;
                }
            }

            if (!isAfterglow && count > 0 && count % 4 === 0) {
                this.fam = (this.fam + 1) & 3;
                this._startWipe(this.fam);
            }
            if (count > 0 && count % 8 === 0) {
                this.driftSign = -this.driftSign;
            }
        }

        // Simulation im festen 50-Hz-Raster fortschreiben
        const minDim = Math.min(w, h);
        const baseSpeed = lerp(0.55, 2.75, this.ten) * (isAfterglow ? 0.30 : 1.0);
        let waveAmp = (!isAfterglow && (state === 'climax' || this.ten >= 0.70)) ? 0.06 * minDim : 0;
        if (!isAfterglow && this.waveTimer > 0) {
            waveAmp += (this.waveTimer / 0.50) * 0.05 * minDim;
        }

        this.simAcc += dt;
        let steps = 0;
        while (this.simAcc >= 0.02 && steps++ < 4) {
            this._stepSimulation(0.02, baseSpeed, impulse, waveAmp, isAfterglow);
            this.simAcc -= 0.02;
        }
        if (steps === 0 && dt > 0) {
            this.currentWave = waveAmp;
        }

        // Bei vis <= 0 auf Floor komplett transparent beenden
        if (visH <= 0 || floorH <= 0) return;

        // Timer-B Split-Zeile & Raster-Theme Lookup
        const wipeY = this.wipeAge < WIPE_DURATION
            ? horizon + Math.floor((this.wipeAge / WIPE_DURATION) * floorH)
            : h;
        const topTheme = getTheme(this.wipeToFam);
        const botTheme = getTheme(this.wipeFromFam);
        const themeAt = y => (y < wipeY ? topTheme : botTheme);

        // Bewegter Timer-B Glanz-Band-Index (wandert bei Beat-Impuls/Climax durch das Gitter)
        const shimmerActive = !isAfterglow && (impulse > 0.18 || state === 'climax' || state === 'buildup');
        const shimmerBand = shimmerActive
            ? Math.floor(((this.simT * 2.4) % 1.0) * RASTER_BANDS)
            : -10;

        const bandForRow = r => {
            const baseB = clamp(Math.floor(((r - 1) / Math.max(1, floorH)) * RASTER_BANDS), 0, RASTER_BANDS - 1);
            if (shimmerActive && Math.abs(baseB - shimmerBand) <= 1) {
                return Math.min(RASTER_BANDS - 1, baseB + 2);
            }
            return baseB;
        };

        // =========================================================
        // 1. TIEFES INK-VOID + HORIZONT-TIMER-B-NAHT
        // =========================================================
        this._fr(ctx, 0, horizon, w, visH, INK, w, horizon, yMax);
        this._fr(ctx, 0, horizon, w, 1, themeAt(horizon).grid[0], w, horizon, yMax);

        // =========================================================
        // 2. TIMER-B HORIZONT-ATMOSPHAERE & PERSPEKTIVISCHE YM2149-SPUREN
        //    Strikt max 1 Nicht-INK Hintergrundfarbe pro Scanline!
        //    -> Garantiert <= 6 Farben/Scanline auch mit Grid + Pulse + Sweep + WHITE
        // =========================================================
        const dxB = Math.max(10, Math.round(0.14 * Math.min(w, 1.6 * h))) * (1 + 0.04 * impulse);
        const vx = w * 0.5 + this.driftNorm * w;
        const vxInt = clamp(Math.round(vx), 0, Math.max(0, w - 1));
        const hazeRows = Math.max(4, Math.floor(floorH * 0.24));
        const useWavedLines = waveAmp > 0;

        for (let r = 2; r <= visH; r++) {
            const y = horizon + r - 1;
            const b = bandForRow(r);
            const tm = themeAt(y);

            if ((y & 1) === 1) {
                // Gestufter Timer-B Horizont-Dunst (fliesst sanft vom Horizont ins tiefe Schwarz)
                if (r <= hazeRows) {
                    const hazeBand = Math.min(RASTER_BANDS - 1, Math.floor((r / hazeRows) * 6));
                    this._fr(ctx, 0, y, w, 1, tm.haze[hazeBand], w, horizon, yMax);
                }
            } else {
                // 3 perspektivisch zum Fluchtpunkt konvergierende YM2149-Spuren (keine eckigen Seiten-Fluegel!)
                const p = r / floorH;
                const halfCenter = 1.5 * dxB * p;
                const halfOuter = 4.8 * dxB * p;
                const xFarLeft = vx - halfOuter;
                const xLeft = vx - halfCenter;
                const xRight = vx + halfCenter;
                const xFarRight = vx + halfOuter;

                const isBoostRow = (y & 3) === 0;
                const laneCol = isBoostRow ? tm.laneBoost : tm.haze[b];

                const draw0 = isBoostRow
                    ? (this.boostedLane === 0 || this.boostedLane === 3)
                    : (ch0 >= 0.22);
                const draw1 = isBoostRow
                    ? (this.boostedLane === 1 || this.boostedLane === 3)
                    : (ch1 >= 0.22);
                const draw2 = isBoostRow
                    ? (this.boostedLane === 2 || this.boostedLane === 3)
                    : (ch2 >= 0.22);

                if (draw0 && xLeft > xFarLeft) {
                    this._fr(ctx, xFarLeft, y, xLeft - xFarLeft, 1, laneCol, w, horizon, yMax);
                }
                if (draw1 && xRight > xLeft) {
                    this._fr(ctx, xLeft, y, xRight - xLeft, 1, laneCol, w, horizon, yMax);
                }
                if (draw2 && xFarRight > xRight) {
                    this._fr(ctx, xRight, y, xFarRight - xRight, 1, laneCol, w, horizon, yMax);
                }
            }
        }

        // =========================================================
        // 3. HORIZONTALE Z-LINIEN (Timer-B Bandfarbe + weiche 3D-Bodenwelle)
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

        let lastFarY = Infinity;
        for (let k = 0; k < HORIZ_COUNT; k++) {
            const zk = 1 + posMod(k * DZ_LINE - this.dist, HORIZ_PERIOD);
            const rk = floorH / zk;
            const yk = Math.max(horizon + 1, Math.min(yMax - 1, horizon + Math.round(rk) - 1));
            if (yk <= horizon || yk >= yMax) continue;

            if (zk > 5.0 && Math.abs(lastFarY - yk) < 2) continue;
            lastFarY = yk;

            const pk = 1 / zk;
            const rLine = yk - horizon + 1;
            const bLine = bandForRow(rLine);
            let thick = pk > 0.66 ? 2 : 1;
            let lineCol = themeAt(yk).grid[bLine];

            if (k === frontK) {
                lineCol = themeAt(yk).sweep;
                thick = 2;
            }

            if (useWavedLines && k !== frontK && zk < 6.5 && visH > 12) {
                this._drawWavedHorizCurve(ctx, yk, thick, waveAmp, zk, lineCol, w, horizon, yMax);
            } else {
                this._fr(ctx, 0, yk, w, 1, lineCol, w, horizon + 1, yMax);
                if (thick === 2 && yk + 1 < yMax) {
                    const bNext = bandForRow(rLine + 1);
                    const nextCol = k === frontK ? themeAt(yk + 1).sweep : themeAt(yk + 1).grid[bNext];
                    this._fr(ctx, 0, yk + 1, w, 1, nextCol, w, horizon + 1, yMax);
                }
            }
        }

        // =========================================================
        // 4. PERSPEKTIVISCHE VERTIKALLINIEN (Timer-B Bänder + Lueckenlose 3D-Kurven)
        // =========================================================
        const N = Math.min(
            Math.floor((MAX_LINE_COLS - 1) / 2),
            Math.ceil((w * 0.5 + Math.abs(this.driftNorm * w) + dxB) / dxB)
        );
        const lineCount = 2 * N + 1;

        if (!useWavedLines) {
            // Gerader Modus: je Timer-B Farbwechsel als sauberes geklipptes Segment
            if (visH > 1) {
                const denomH = Math.max(1, floorH - 1);
                const bandStep = Math.max(2, Math.ceil(floorH / RASTER_BANDS));

                for (let ry = horizon + 1; ry < yMax; ry += bandStep) {
                    const yEnd = Math.min(yMax, ry + bandStep);
                    const rMid = Math.floor((ry + yEnd) * 0.5) - horizon + 1;
                    const bMid = bandForRow(rMid);

                    const clips = (wipeY > ry && wipeY < yEnd)
                        ? [
                            { x: 0, y: ry, w, h: wipeY - ry, col: topTheme.grid[bMid] },
                            { x: 0, y: wipeY, w, h: yEnd - wipeY, col: botTheme.grid[bMid] }
                        ]
                        : [{ x: 0, y: ry, w, h: yEnd - ry, col: themeAt(ry).grid[bMid] }];

                    for (let idx = 0; idx < lineCount; idx++) {
                        const i = idx - N;
                        const xTop = vx + i * dxB * (1 / denomH);
                        const xBot = vx + i * dxB;
                        if ((xTop < -2 && xBot < -2) || (xTop > w + 2 && xBot > w + 2)) continue;

                        for (let c = 0; c < clips.length; c++) {
                            const cl = clips[c];
                            if (cl.h > 0) {
                                drawAliasedLineClipped(ctx, xTop, horizon + 1, xBot, horizon + floorH - 1, cl.col, cl);
                            }
                        }
                    }
                }
            }
        } else {
            // Wellen-Modus: Wobble vorrechnen, dann lueckenlos & run-merged pro Ray zeichnen!
            const maxRows = Math.min(visH, this.rowWob.length);
            for (let r = 1; r <= maxRows; r++) {
                this.rowWob[r - 1] = waveAmp * Math.sin(0.22 * r - 4 * this.simT) * (1 + 0.5 * Math.sin(0.07 * r));
            }

            const denomH = Math.max(1, floorH - 1);
            const startR = visH >= 2 ? 2 : 1;

            for (let idx = 0; idx < lineCount; idx++) {
                const i = idx - N;
                let prevX = null;
                let runX = 0;
                let runY = -1;
                let runH = 0;
                let runCol = null;

                for (let r = startR; r <= maxRows; r++) {
                    const y = horizon + r - 1;
                    const pFan = floorH <= 1 ? 0 : (r - 1) / denomH;
                    const wobR = this.rowWob[r - 1];
                    const xCur = Math.round(vx + i * dxB * pFan + wobR * pFan);
                    const col = themeAt(y).grid[bandForRow(r)];

                    if (prevX === null) {
                        prevX = xCur;
                        runX = xCur;
                        runY = y;
                        runH = 1;
                        runCol = col;
                        continue;
                    }

                    const dx = xCur - prevX;
                    prevX = xCur;

                    if (dx === 0) {
                        if (col === runCol) {
                            runH++;
                        } else {
                            if (runH > 0) this._fr(ctx, runX, runY, 1, runH, runCol, w, horizon + 1, yMax);
                            runX = xCur;
                            runY = y;
                            runH = 1;
                            runCol = col;
                        }
                    } else if (dx === 1 || dx === -1) {
                        if (runH > 0) this._fr(ctx, runX, runY, 1, runH, runCol, w, horizon + 1, yMax);
                        runX = xCur;
                        runY = y;
                        runH = 1;
                        runCol = col;
                    } else {
                        // Lueckenlose 1px-hohe horizontale Bruecke ohne Doppel-Ueberlappung (kein Punkt-Abreissen!)
                        if (runH > 0) {
                            this._fr(ctx, runX, runY, 1, runH, runCol, w, horizon + 1, yMax);
                            runH = 0;
                        }
                        const spanX = dx > 0 ? (xCur - dx + 1) : xCur;
                        const spanW = Math.abs(dx);
                        if (spanX + spanW > -2 && spanX < w + 2) {
                            this._fr(ctx, spanX, y, spanW, 1, col, w, horizon + 1, yMax);
                        }
                    }
                }
                if (runH > 0) {
                    this._fr(ctx, runX, runY, 1, runH, runCol, w, horizon + 1, yMax);
                }
            }
        }

        // Fluchtpunkt-Anker exakt an y === horizon bei vxInt
        const vpCol = isAfterglow
            ? RAMPS.BLU5[3]
            : ((this.vpFlashTimer > 0 || state === 'climax') ? WHITE : topTheme.grid[15]);
        this._fr(ctx, vxInt, horizon, 1, 1, vpCol, w, horizon, yMax);

        // =========================================================
        // 5. SHOCKWAVE PULSE-LINIEN (Pool 4, Dual-Tone Akzent + WHITE Core)
        // =========================================================
        for (let i = 0; i < PULSE_POOL_SIZE; i++) {
            const p = this.pulses[i];
            if (!p.active) continue;
            const yp = horizon + Math.round(floorH / p.zp) - 1;
            if (yp <= horizon || yp >= yMax) continue;

            const pp = 1 / p.zp;
            const thick = pp > 0.66 ? 2 : 1;
            const pulseCol = themeAt(yp).accent;

            if (useWavedLines && p.zp < 8.0 && visH > 12) {
                this._drawWavedHorizCurve(ctx, yp, thick, waveAmp, p.zp, pulseCol, w, horizon, yMax);
            } else {
                this._fr(ctx, 0, yp, w, thick, pulseCol, w, horizon + 1, yMax);
            }

            if (!isAfterglow && w >= 12) {
                const coreHalf = Math.max(2, Math.floor(1.5 * dxB * (yp - horizon + 1) / Math.max(1, floorH)));
                const coreX = Math.max(0, vxInt - coreHalf);
                const coreW = Math.min(w - coreX, coreHalf * 2);
                if (coreW > 0) {
                    this._fr(ctx, coreX, yp, coreW, 1, WHITE, w, horizon + 1, yMax);
                }
            }
        }

        // =========================================================
        // 6. TWIN-CORE LASER-SWEEPS (Climax / ten >= 0.70, nicht im Afterglow)
        // =========================================================
        if (!isAfterglow && (state === 'climax' || this.ten >= 0.70) && visH > 1) {
            const basePhi = 0.78 * Math.sin(0.55 * this.simT);
            const rayLen = Math.hypot(w, h) + 16;
            const sweepStartY = horizon + 1;
            const sweepH = yMax - sweepStartY;

            for (let s = 0; s < 2; s++) {
                const phi = basePhi + (s === 0 ? -0.36 : 0.36);
                const ex = vxInt + Math.sin(phi) * rayLen;
                const ey = horizon + Math.cos(phi) * rayLen;

                // Hauptstrahl in theme.sweep (= FAM[fam][4])
                if (wipeY > sweepStartY && wipeY < yMax) {
                    drawAliasedLineClipped(ctx, vxInt, sweepStartY, ex, ey, topTheme.sweep, {
                        x: 0, y: sweepStartY, w, h: wipeY - sweepStartY
                    });
                    drawAliasedLineClipped(ctx, vxInt, sweepStartY, ex, ey, botTheme.sweep, {
                        x: 0, y: wipeY, w, h: yMax - wipeY
                    });
                } else {
                    drawAliasedLineClipped(ctx, vxInt, sweepStartY, ex, ey, themeAt(sweepStartY).sweep, {
                        x: 0, y: sweepStartY, w, h: sweepH
                    });
                }

                // Versetzter Akzent-Mantel + heisser WHITE-Laser-Kern
                if (w >= 24 && sweepH >= 8) {
                    drawAliasedLineClipped(ctx, vxInt + (s === 0 ? -1 : 1), sweepStartY, ex + (s === 0 ? -1 : 1), ey, themeAt(sweepStartY).accent, {
                        x: 0, y: sweepStartY, w, h: sweepH
                    });
                    const coreEndX = vxInt + Math.sin(phi) * (rayLen * 0.45);
                    const coreEndY = horizon + Math.cos(phi) * (rayLen * 0.45);
                    drawAliasedLineClipped(ctx, vxInt, sweepStartY, coreEndX, coreEndY, WHITE, {
                        x: 0, y: sweepStartY, w, h: sweepH
                    });
                }
            }
        }

        // =========================================================
        // 7. TIMER-B RASTER-SPLIT-LINIE (sichtbarer ST-Scanline-Interrupt beim Wipe)
        // =========================================================
        if (this.wipeAge < WIPE_DURATION && wipeY > horizon && wipeY < yMax) {
            const splitCol = isAfterglow ? RAMPS.BLU5[4] : WHITE;
            this._fr(ctx, 0, wipeY, w, 1, splitCol, w, horizon + 1, yMax);
        }

        // =========================================================
        // 8. BAYER-4x4 TRANSITION FADE (nur unterhalb Horizont!)
        // =========================================================
        if (vis < 1) {
            bayerFadeCells(ctx, 0, horizon, w, visH, vis, 2, INK);
        }
    }
}