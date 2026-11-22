// =========================================================
// DEMO-SCENE-ELEMENT: ATARI POND RIPPLES (Floor DSE)
// Perspektivische Wasserflaeche mit 9-Bit-Shifter-Rampen ab y >= horizon.
// Features:
// - Strenger Horizont-Vertrag (y >= floor(height * 0.55)), Null Pixel darueber
// - Perspektivischer Tiefenverlauf (Horizon-Glanz -> Liquid-Streak-Dither -> tiefer Grund)
// - HBL-Scanline-Lichtspiegelung (zentral + YM2149 A/C Nebenreflexe)
// - 3D-Wellen (Wellental + Kamm, 2px-Bold-Crest & #fcfcfc Peak auf Hard/Climax)
// - Kontinuierlich driftende, weich modulierte 24er-Glitzer (kein 12.5-Hz-Rauschen)
// - Timer-B Raster-Wipe mit 1px Split-Glanzlinie & sauberem Mid-Wipe-Snapshot
// - Transparentes Bayer-4x4-Floor-Fade (kein schwarzer Block ueber dem Background)
// =========================================================

import {
    createXorshift32,
    drawAliasedEllipseOutlineClipped
} from '../../utils/hardware-constraints.js';
import { INK, RAMPS, WHITE, st } from './atari-kit.js';

const TWO_PI = Math.PI * 2;
const T_IN = 1.5;
const T_OUT = 1.5;
const WIPE_DURATION = 0.5;
const RIPPLE_POOL_SIZE = 12;
const SPRAY_POOL_SIZE = 12;
const GLINT_POOL_SIZE = 24;

// Organisch gestaffelte YM2149-Tiefen (A=links-fern, B=mittig-nah, C=rechts-mittel)
const SOURCE_ZW = [2.9, 1.65, 2.45];

// Kuratierte 4. Teich-Palette: Tiefes Nordmeer-Teal (streng 9-Bit quantisiert)
const SEA5 = Object.freeze([
    st(0, 1, 2), // '#002448'
    st(0, 2, 3), // '#00486c'
    st(0, 4, 5), // '#0090b4'
    st(2, 6, 6), // '#48d8d8'
    st(5, 7, 7)  // '#b4fcfc'
]);

const POND_FAMILIES = Object.freeze([
    RAMPS.BLU5,
    RAMPS.CYN5,
    RAMPS.VIO5,
    SEA5
]);

const BAYER_4X4 = Object.freeze([
     0,  8,  2, 10,
    12,  4, 14,  6,
     3, 11,  1,  9,
    15,  7, 13,  5
]);

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
        this.shimmerPhase = 0;

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
        this.wipeFrom = POND_FAMILIES[0];
        this.wipeTo = POND_FAMILIES[0];
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

        // Fest allokierter Glitzer-Pool (24 Slots, kontinuierliche Twinkle-Phasen)
        this.glints = Array.from({ length: GLINT_POOL_SIZE }, () => ({
            xNorm: 0.5,
            rNorm: 0.5,
            lenMax: 3,
            phase: 0,
            rate: 3.0,
            driftMul: 1.0
        }));
        this.glintDriftPx = 0;
        this._initGlints();
    }

    resize() {
        // Normalisierte Weltkoordinaten (xw, zw) & Glitzer (xNorm, rNorm)
        // projizieren ohne Neuaufbau direkt auf jedes neue Seitenverhaeltnis.
    }

    _initGlints() {
        for (let i = 0; i < GLINT_POOL_SIZE; i++) {
            const g = this.glints[i];
            const rndY = this.rng.float();
            g.xNorm = this.rng.float();
            g.rNorm = 0.06 + 0.88 * rndY * rndY;
            g.lenMax = 2 + this.rng.int(6); // 2..7 px
            g.phase = (i / GLINT_POOL_SIZE) * TWO_PI + this.rng.float() * 0.4;
            g.rate = 2.0 + this.rng.float() * 2.4;
            g.driftMul = 0.65 + this.rng.float() * 0.70;
        }
        this.glintDriftPx = 0;
    }

    _rerollSingleGlint(g) {
        const rndY = this.rng.float();
        g.xNorm = this.rng.float();
        g.rNorm = 0.06 + 0.88 * rndY * rndY;
        g.lenMax = 2 + this.rng.int(6);
        g.rate = 2.0 + this.rng.float() * 2.4;
        g.driftMul = 0.65 + this.rng.float() * 0.70;
    }

    _startWipe(nextRamp) {
        if (this.wipeTo === nextRamp) return;
        this.wipeFrom = this.wipeTo;
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
        rp.life = 1.45 + 0.65 * amp;
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
            s.theta = h1 * TWO_PI;
            s.len = 2 + Math.floor(h2 * 3); // 2..4 px
            s.age = 0;
            s.rw = 0.08;
            s.amp = amp;
        }
    }

    _stepSimulation(stepDt, ten, ripMax, rings, isAfterglow, allowDrip) {
        this.stepCounter++;
        const stateMul = isAfterglow ? 0.42 : 1.0;
        const windVel = 0.045 * this.driftSign * stateMul;

        this.glintDriftPx = (this.glintDriftPx + this.driftSign * (4.5 + 7.5 * ten) * stepDt * stateMul) % 4096;
        this.shimmerPhase = (this.shimmerPhase + stepDt * (0.9 + 1.5 * ten) * (isAfterglow ? 0.40 : 1.0)) % TWO_PI;

        // Einzelne Glitzer weich durch ihre Twinkle-Phase fuehren (kein Pool-Flicker!)
        for (let i = 0; i < GLINT_POOL_SIZE; i++) {
            const g = this.glints[i];
            g.phase += g.rate * stepDt * stateMul;
            if (g.phase >= TWO_PI) {
                g.phase -= TWO_PI;
                this._rerollSingleGlint(g);
            }
        }

        // Bestehende Ripples integrieren
        const speedBase = (1.0 + 0.8 * ten) * (isAfterglow ? 0.50 : 1.0);
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

        // Tropfen ueber die volle Tiefe (1.25 .. 4.1) & Breite ohne Audio-Beats
        if (allowDrip) {
            const dripP = lerp(0.004, 0.035, ten) * (isAfterglow ? 0.30 : 1.0);
            if (this.rng.float() < dripP) {
                const zw = 1.25 + 2.85 * this.rng.float();
                const xw = (this.rng.float() - 0.5) * 1.45 * zw;
                this._spawnRipple(xw, zw, 1, rings, ripMax, 0, false);
            }
        }
    }

    // Perspektivische Wassertiefen-Beschreibung pro Scanline (garantiert max. 2 Farben/Zeile!)
    _describeWaterRow(r, floorH) {
        const denom = Math.max(1, floorH - 1);
        const p = r / denom;

        // Zone 1: Horizont-Reflexionssaum (ramp[2] -> ramp[1])
        if (p < 0.09) return { base: 2, accent: 2, mix: 0 };
        if (p < 0.17) return { base: 2, accent: 1, mix: (p - 0.09) / 0.08 };

        // Zone 2: Mitteltiefer Teich (ramp[1] -> ramp[0])
        if (p < 0.41) return { base: 1, accent: 1, mix: 0 };
        if (p < 0.54) return { base: 1, accent: 0, mix: (p - 0.41) / 0.13 };

        // Zone 3: Tiefer Vordergrund (ramp[0], Trough-Schatten duerfen ab hier INK nutzen)
        return { base: 0, accent: 0, mix: 0 };
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

    // Transparentes Bayer-4x4-Span-Emission ohne #000000-Klotz (bei bayerLevel === 16: 1 fillRect)
    _emitWaterSpan(ctx, x, y, len, color, bayerLevel, horizon, w, yMax) {
        const x0 = Math.max(0, Math.round(x));
        const x1 = Math.min(w, Math.round(x + len));
        const iy = Math.round(y);
        if (x1 <= x0 || iy < horizon || iy >= yMax || bayerLevel <= 0) return;

        ctx.fillStyle = color;
        if (bayerLevel >= 16) {
            ctx.fillRect(x0, iy, x1 - x0, 1);
            return;
        }

        const bayerRow = (((iy - horizon) >> 1) & 3) * 4;
        let runStart = -1;
        let px = x0;
        while (px < x1) {
            const cellEnd = Math.min(x1, (px & ~1) + 2);
            const bx = (px >> 1) & 3;
            if (BAYER_4X4[bayerRow + bx] < bayerLevel) {
                if (runStart === -1) runStart = px;
            } else if (runStart !== -1) {
                ctx.fillRect(runStart, iy, px - runStart, 1);
                runStart = -1;
            }
            px = cellEnd;
        }
        if (runStart !== -1) {
            ctx.fillRect(runStart, iy, x1 - runStart, 1);
        }
    }

    _drawLiquidStreaks(ctx, r, y, w, mix, colorB, bayerLevel, horizon, yMax) {
        if (mix <= 0.02 || w <= 0) return;
        const slots = Math.min(w, 12);
        for (let s = 0; s < slots; s++) {
            const slotStart = Math.floor((s * w) / slots);
            const slotEnd = Math.floor(((s + 1) * w) / slots);
            const slotW = slotEnd - slotStart;
            if (slotW <= 0) continue;

            const h1 = hash01((r * 131 + s * 37) ^ 0x41545354);
            const h2 = hash01((r * 257 + s * 73) ^ 0x52495050);
            const xOff = Math.floor(h1 * Math.max(0, slotW * 0.35));
            const dashW = Math.round(slotW * mix * (0.65 + 0.70 * h2));
            const dashX = slotStart + xOff;
            const dashLen = Math.min(slotEnd - dashX, dashW);
            if (dashLen > 0) {
                this._emitWaterSpan(ctx, dashX, y, dashLen, colorB, bayerLevel, horizon, w, yMax);
            }
        }
    }

    _drawClippedEllipseRange(ctx, xc, yc, rx, ry, color, x, yStart, yEnd, w) {
        const clipH = yEnd - yStart;
        if (clipH > 0 && w > 0) {
            drawAliasedEllipseOutlineClipped(ctx, xc, yc, rx, ry, color, {
                x,
                y: yStart,
                w,
                h: clipH
            });
        }
    }

    _drawClippedEllipseSplit(ctx, xc, yc, rx, ry, colorTo, colorFrom, w, yStart, yEnd, wipeY) {
        if (yEnd <= yStart || yc + ry < yStart || yc - ry >= yEnd) return;

        if (wipeY > yStart && wipeY < yEnd) {
            if (yc - ry < wipeY) {
                this._drawClippedEllipseRange(ctx, xc, yc, rx, ry, colorTo, 0, yStart, wipeY, w);
            }
            if (yc + ry >= wipeY) {
                this._drawClippedEllipseRange(ctx, xc, yc, rx, ry, colorFrom, 0, wipeY, yEnd, w);
            }
            return;
        }
        const col = yStart < wipeY ? colorTo : colorFrom;
        this._drawClippedEllipseRange(ctx, xc, yc, rx, ry, col, 0, yStart, yEnd, w);
    }

    _drawWaterSurface(ctx, w, horizon, floorH, visH, yMax, vis, wipeY, rampAt) {
        const bayerLevel = vis >= 1 ? 16 : Math.max(0, Math.min(16, Math.round(vis * 16)));
        if (bayerLevel <= 0) return;

        // Solide Flaeche vertikal run-mergen solange bayerLevel === 16 & keine Uebergangs-Streaks
        let runColor = null;
        let runStartY = horizon;

        for (let r = 0; r < visH; r++) {
            const y = horizon + r;
            const desc = this._describeWaterRow(r, floorH);
            const ramp = rampAt(y);
            const colA = ramp[desc.base];

            if (desc.mix > 0 || bayerLevel < 16) {
                if (runColor !== null) {
                    this._fr(ctx, 0, runStartY, w, y - runStartY, runColor, w, horizon, yMax);
                    runColor = null;
                }
                this._emitWaterSpan(ctx, 0, y, w, colA, bayerLevel, horizon, w, yMax);
                if (desc.mix > 0) {
                    this._drawLiquidStreaks(ctx, r, y, w, desc.mix, ramp[desc.accent], bayerLevel, horizon, yMax);
                }
            } else {
                if (colA !== runColor) {
                    if (runColor !== null) {
                        this._fr(ctx, 0, runStartY, w, y - runStartY, runColor, w, horizon, yMax);
                    }
                    runColor = colA;
                    runStartY = y;
                }
            }
        }
        if (runColor !== null) {
            this._fr(ctx, 0, runStartY, w, yMax - runStartY, runColor, w, horizon, yMax);
        }
    }

    // HBL-Scanline-Lichtspiegelung: Wackelnde Horizont/Mond-Lichtreflexion + YM2149 Seiten-Wisps
    _drawShimmerColumn(ctx, w, h, horizon, floorH, yMax, vis, rampAt, isAfterglow, impulse, ch0, ch1, ch2, wideHalf) {
        if (w < 6 || floorH < 4 || vis < 0.35) return;

        const cx = w * 0.5;
        const step = floorH > 120 ? 2 : 1;
        const colScale = Math.min(w * 0.72, 1.5 * h);
        const widthMult = isAfterglow
            ? 0.48
            : (0.76 + 0.48 * this.ten + 0.38 * impulse + 0.34 * ch1);
        const wobbleBase = isAfterglow
            ? 0.9
            : (1.4 + 2.4 * this.ten + 2.8 * impulse);

        const ch0X = cx - 0.75 * wideHalf / SOURCE_ZW[0];
        const ch2X = cx + 0.75 * wideHalf / SOURCE_ZW[2];
        const drawSideRibs = !isAfterglow && w >= 64 && (ch0 > 0.28 || ch2 > 0.28);

        for (let y = horizon + 1; y < yMax; y += step) {
            const r = y - horizon;
            const depth = r / Math.max(1, floorH - 1);
            const waveGate = Math.sin(y * 0.44 - this.shimmerPhase * 3.1) + 0.32 * impulse;
            if (waveGate < -0.22) continue;

            const ramp = rampAt(y);
            const wobbleAmp = wobbleBase * (0.4 + 0.85 * depth);
            const wobble = Math.round(
                Math.sin(y * 0.33 - this.shimmerPhase * 4.2) * wobbleAmp +
                Math.cos(y * 0.17 + this.shimmerPhase * 2.1) * wobbleAmp * 0.45
            );

            const halfW = Math.max(1, Math.round((0.02 + 0.085 * Math.pow(depth, 0.85)) * colScale * widthMult));
            const coreW = Math.max(1, Math.floor(halfW * 0.9));

            // Gebrochene horizontale Reflexions-Striche (klassischer ST-Blitter-Look)
            this._fr(ctx, cx - halfW + wobble, y, halfW * 2, 1, ramp[2], w, horizon, yMax);
            if (coreW >= 2 && waveGate > 0.05) {
                const usePeakWhite = !isAfterglow && (impulse >= 0.72 || (this.ten >= 0.78 && waveGate > 0.72));
                const coreCol = usePeakWhite
                    ? WHITE
                    : (waveGate > 0.48 && !isAfterglow ? ramp[4] : ramp[3]);
                this._fr(ctx, cx - Math.floor(coreW * 0.5) + wobble, y, coreW, 1, coreCol, w, horizon, yMax);
            }

            // Sekundaere YM2149 Kanal-A/C Wasserspiegelungen (erhoeht Sichtbarkeit auf Ultrawide)
            if (drawSideRibs && (r & 1) === 0) {
                if (ch0 > 0.28 && depth > 0.14 && depth < 0.75) {
                    const ribW = Math.max(2, Math.round(colScale * 0.04 * ch0 * (0.5 + depth)));
                    const sideCol = ch0 > 0.65 ? ramp[3] : ramp[2];
                    this._fr(ctx, ch0X - ribW * 0.5 - wobble, y, ribW, 1, sideCol, w, horizon, yMax);
                }
                if (ch2 > 0.28 && depth > 0.18 && depth < 0.82) {
                    const ribW = Math.max(2, Math.round(colScale * 0.04 * ch2 * (0.5 + depth)));
                    const sideCol = ch2 > 0.65 ? ramp[3] : ramp[2];
                    this._fr(ctx, ch2X - ribW * 0.5 + wobble, y, ribW, 1, sideCol, w, horizon, yMax);
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

        // Afterglow-Palettenwechsel per Timer-B Raster-Wipe auf BLU5
        const isAfterglow = state === 'afterglow';
        if (isAfterglow && !this.inAfterglow) {
            this.inAfterglow = true;
            this._startWipe(RAMPS.BLU5);
        } else if (!isAfterglow && this.inAfterglow) {
            this.inAfterglow = false;
            this._startWipe(POND_FAMILIES[this.fam]);
        }

        const ripMax = this.ten < 0.35 ? 4 : (this.ten < 0.70 ? 8 : 12);
        const rings = isAfterglow ? 1 : (this.ten < 0.35 ? 1 : (this.ten < 0.70 ? 2 : 3));
        const sx = 0.5 * Math.min(w, 1.6 * h);
        const wideHalf = Math.max(sx, w * 0.5 * 1.25);
        const allowEmit = !isAfterglow && state !== 'stopping' && (state !== 'starting' || vis >= 0.6);

        if (onBeat) {
            if (allowEmit) {
                let bestC = 0;
                if (ch1 > chVals[bestC]) bestC = 1;
                if (ch2 > chVals[bestC]) bestC = 2;

                if (level === 1) {
                    const xw = (bestC - 1) * 0.75;
                    this._spawnRipple(xw, SOURCE_ZW[bestC], 1, rings, ripMax, 0, true);
                } else if (level === 2 || level === 3) {
                    const canHard = level === 3 && this.hardCooldown <= 0;
                    if (canHard) this.hardCooldown = 0.25;

                    let any = false;
                    for (let c = 0; c < 3; c++) {
                        if (chVals[c] >= 0.25) {
                            any = true;
                            const xw = (c - 1) * 0.75;
                            const amp = 1 + Math.round(2 * chVals[c]);
                            this._spawnRipple(xw, SOURCE_ZW[c], amp, rings, ripMax, 0, true);
                        }
                    }
                    if (!any) {
                        const xw = (bestC - 1) * 0.75;
                        const amp = 1 + Math.round(2 * chVals[bestC]);
                        this._spawnRipple(xw, SOURCE_ZW[bestC], amp, rings, ripMax, 0, true);
                    }

                    if (canHard) {
                        const xwBest = (bestC - 1) * 0.75;
                        const ampBest = 1 + Math.round(2 * chVals[bestC]);
                        this._spawnRipple(xwBest, SOURCE_ZW[bestC], ampBest, rings, ripMax, 0.12, true);
                        this._spawnSprays(xwBest, SOURCE_ZW[bestC], ampBest, count + this.rippleSeq++);
                    }
                }
            }

            if (!isAfterglow && count > 0 && count % 4 === 0) {
                this.fam = (this.fam + 1) & 3;
                this._startWipe(POND_FAMILIES[this.fam]);
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
            this._stepSimulation(0.02, this.ten, ripMax, rings, isAfterglow, allowDrip);
            this.simAcc -= 0.02;
        }

        // Bei vis <= 0 auf Floor komplett transparent beenden
        if (visH <= 0 || floorH <= 0) return;

        // Timer-B Split-Zeile & Vordergrund-Trough-Grenze (garantiert <= 6 Farben/Scanline!)
        const wipeActive = this.wipeAge < WIPE_DURATION;
        const wipeY = wipeActive
            ? horizon + Math.floor((this.wipeAge / WIPE_DURATION) * floorH)
            : h;
        const rampAt = y => (y < wipeY ? this.wipeTo : this.wipeFrom);
        const fgSolidY = horizon + Math.ceil(0.54 * Math.max(0, floorH - 1));

        // =========================================================
        // 1. WASSERFLAECHE (Perspektivtiefe & Liquid-Streak-Dither)
        // =========================================================
        this._drawWaterSurface(ctx, w, horizon, floorH, visH, yMax, vis, wipeY, rampAt);

        // 1px Timer-B Raster-Split-Lichtlinie waehrend Palettenwechsel
        if (wipeActive && wipeY >= horizon && wipeY < yMax && floorH >= 8) {
            const splitCol = isAfterglow ? RAMPS.BLU5[3] : this.wipeTo[4];
            this._fr(ctx, 0, wipeY, w, 1, splitCol, w, horizon, yMax);
        }

        // =========================================================
        // 2. HBL SCANLINE-LICHTSPIEGELUNG (Ab vis >= 0.35)
        // =========================================================
        this._drawShimmerColumn(ctx, w, h, horizon, floorH, yMax, vis, rampAt, isAfterglow, impulse, ch0, ch1, ch2, wideHalf);

        // =========================================================
        // 3. KONTINUIERLICHE GLITZER (Pool 24, weicher Twinkle + Wrap)
        // =========================================================
        if (vis >= 0.35) {
            const glintCount = isAfterglow ? 6 : (8 + Math.round(16 * this.ten));
            const activeGlints = Math.min(GLINT_POOL_SIZE, glintCount);
            for (let i = 0; i < activeGlints; i++) {
                const g = this.glints[i];
                const twinkle = Math.sin(g.phase * 0.5);
                if (twinkle < 0.08) continue;

                const gy = horizon + Math.min(floorH - 1, Math.floor(g.rNorm * floorH));
                if (gy < horizon || gy >= yMax) continue;

                const curLen = Math.max(1, Math.floor(
                    1 + twinkle * (g.lenMax - 1) + (isAfterglow ? 0 : impulse * 2)
                ));
                const gx = Math.floor(posMod(g.xNorm * w + this.glintDriftPx * g.driftMul, w));
                const useWhite = !isAfterglow && twinkle > 0.78 && (impulse >= 0.45 || this.ten >= 0.68);
                const col = useWhite ? WHITE : rampAt(gy)[g.rNorm >= 0.45 ? 4 : 3];

                const firstLen = Math.min(curLen, w - gx);
                this._fr(ctx, gx, gy, firstLen, 1, col, w, horizon, yMax);
                if (firstLen < curLen && w > 1) {
                    this._fr(ctx, 0, gy, curLen - firstLen, 1, col, w, horizon, yMax);
                }
            }
        }

        // =========================================================
        // 4. 3D-RIPPLES (Wellental + Kamm, 4-stufiges beatImpulse)
        // =========================================================
        const impulseTier = impulse >= 0.72 ? 3 : (impulse >= 0.42 ? 2 : (impulse >= 0.12 ? 1 : 0));
        const activeRippleCount = this._countActiveRipples();
        const showRipples = vis >= 0.45;

        if (showRipples) {
            for (let i = 0; i < RIPPLE_POOL_SIZE; i++) {
                const rp = this.ripples[i];
                if (!rp.active || rp.delay > 0) continue;

                const p0 = 1 / rp.zw;
                const xc = w * 0.5 + rp.xw * wideHalf * p0;
                const yc = horizon + floorH / rp.zw;
                const rx = rp.rw * sx * p0;
                if (!Number.isFinite(rx) || rx < 1) continue;

                const gap = Math.max(2, Math.round(0.06 * sx * p0));
                const ageFrac = rp.age / rp.life;
                const baseLvl = ageFrac < 0.35 ? 4 : (ageFrac < 0.70 ? 3 : 2);
                const lvlBoost = impulseTier >= 2 ? 1 : 0;
                const lvl = clamp(baseLvl + lvlBoost, 2, 4);
                const ringCount = isAfterglow ? 1 : rp.rings;

                for (let j = 0; j < ringCount; j++) {
                    const rjx = rx - j * gap;
                    if (rjx < 1) break;
                    const rjy = Math.max(0.5, rjx * (0.18 + 0.20 * p0));

                    // 4a. Dunkles Wellental (+1px nach unten; oben ramp[0], im Vordergrund INK)
                    if (rjx >= 4 && (j === 0 || (j === 1 && rjx >= 6 && activeRippleCount <= 8))) {
                        if (horizon < fgSolidY) {
                            const troughEnd = Math.min(yMax, fgSolidY);
                            this._drawClippedEllipseSplit(
                                ctx, xc, yc + 1, rjx, rjy,
                                this.wipeTo[0], this.wipeFrom[0],
                                w, horizon, troughEnd, wipeY
                            );
                        }
                        if (yMax > fgSolidY) {
                            const troughStart = Math.max(horizon, fgSolidY);
                            this._drawClippedEllipseRange(
                                ctx, xc, yc + 1, rjx, rjy,
                                INK, 0, troughStart, yMax, w
                            );
                        }
                    }

                    // 4b. Wellenkamm (Hard-Beat / Climax Peak mit #fcfcfc Highlight!)
                    const peakWhite = !isAfterglow && j === 0 && ageFrac < 0.45 &&
                        (impulseTier === 3 || (state === 'climax' && impulseTier >= 2));
                    const crestTo = peakWhite ? WHITE : this.wipeTo[lvl];
                    const crestFrom = peakWhite ? WHITE : this.wipeFrom[lvl];
                    this._drawClippedEllipseSplit(ctx, xc, yc, rjx, rjy, crestTo, crestFrom, w, horizon, yMax, wipeY);

                    // 4c. 2px Bold-Kamm + innerer Glanz-Bevel bei Medium/Hard
                    const drawBold = impulseTier >= 2 && (j === 0 || activeRippleCount <= 8) && rjx >= 3;
                    if (drawBold) {
                        const innerRy = Math.max(0.5, rjy - 1);
                        const bevelLvl = peakWhite ? 4 : Math.max(2, lvl - 1);
                        this._drawClippedEllipseSplit(
                            ctx, xc, yc, rjx - 1, innerRy,
                            this.wipeTo[bevelLvl], this.wipeFrom[bevelLvl],
                            w, horizon, yMax, wipeY
                        );
                    }
                }
            }
        }

        // =========================================================
        // 5. SPRUEHSTRICHE (Pool 12)
        // =========================================================
        if (showRipples) {
            for (let i = 0; i < SPRAY_POOL_SIZE; i++) {
                const s = this.sprays[i];
                if (!s.active) continue;
                const p0 = 1 / s.zw;
                const xc = w * 0.5 + s.xw * wideHalf * p0;
                const yc = horizon + floorH / s.zw;
                const rx = Math.max(4, s.rw * sx * p0);
                const ry = Math.max(1.5, rx * (0.18 + 0.20 * p0));
                const px = xc + Math.cos(s.theta) * rx - s.len * 0.5;
                const py = Math.round(yc + Math.sin(s.theta) * ry);
                if (py < horizon || py >= yMax) continue;
                const sprayCol = (!isAfterglow && s.age < 0.08) ? WHITE : rampAt(py)[4];
                this._fr(ctx, px, py, s.len, 1, sprayCol, w, horizon, yMax);
            }
        }
    }
}