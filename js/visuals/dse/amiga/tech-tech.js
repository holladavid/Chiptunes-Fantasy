// =========================================================
// DEMO-SCENE-ELEMENT: AMIGA TECH-TECH (Background)
// Copper-gesteuerter Zeilenversatz (BPLCON1 + Blitter-Shift)
// ueber 4 periodische Muster (Schachbrett, Vorhang, Rauten, Ziegel),
// 3 Wellenharmonische, 4 horizontale Paula-Zonen, Shockwave-Band
// und Zeilen-Wipe.
// =========================================================

import { bayerFadeCells } from '../../utils/hardware-constraints.js';
import {
    RAMPS,
    INK,
    FAM,
    PP6,
    TRANSITION_IN,
    TRANSITION_OUT
} from './amiga-kit.js';

const TWO_PI = Math.PI * 2;
const PHASE_WRAP = TWO_PI * 10; // Exaktes Vielfaches fuer 1.0, 1.3 und 1.7
const FALLBACK_TENSION = Object.freeze({
    playing: 0.30,
    buildup: 0.65,
    climax: 1.0,
    afterglow: 0.20
});

const clamp01 = (v) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
const lerp = (a, b, k) => a + (b - a) * k;

export class AmigaTechTech {
    constructor() {
        this.name = 'Amiga Tech-Tech';

        // Zeit- und Zustandsverfolgung
        this.lastT = null;
        this.simTime = 0;
        this.lastState = 'idle';
        this.stateAge = 0;

        // Kontinuierliche Wellenphasen (bleiben bei Resize/Rotation erhalten)
        this.phi1 = 0;
        this.phiSign = 1;
        this.phiSignTarget = 1;
        this.ten = 0.2;

        // Diskreter Beat- und Musterzustand
        this.lastBeatCount = 0;
        this.hardCooldown = 0;
        this.shift = 0;

        // Muster & Zeilen-Wipe (0.5s von oben nach unten)
        this.pat = 0;
        this.patPrev = 0;
        this.patWipeT0 = -10;

        // Rampenfamilie & Wipe (0.6s, q = y / height)
        this.fam = 0;
        this.wipeFrom = FAM[0];
        this.wipeTo = FAM[0];
        this.wipeT0 = -10;

        // Beat-Sondereffekte
        this.zoneBoostIdx = 0;
        this.zoneBoostTimer = 0;
        this.shockActive = false;
        this.shockY = 0;

        // Wiederverwendbarer Laufpuffer: [start, len, level] je Lauf (max. 16 Laeufe)
        this.runBuf = new Int16Array(16 * 3);

        // Messwerte fuer Diagnostik/Tests
        this.lastRowH = 2;
        this.lastMaxAbsDx = 0;
        this.lastZoneAmps = new Float32Array(4);
    }

    resize() {
        // Musterperioden und Wellenlaengen leiten sich dynamisch aus (width, height) ab;
        // phi1, pat und fam bleiben ueber Rotationen hinweg erhalten.
    }

    _setRamp(nextRampName) {
        if (nextRampName === this.wipeTo) return;
        const progress = clamp01((this.simTime - this.wipeT0) / 0.6);
        this.wipeFrom = progress < 1 ? (progress > 0.5 ? this.wipeTo : this.wipeFrom) : this.wipeTo;
        this.wipeTo = nextRampName;
        this.wipeT0 = this.simTime;
    }

    _computeRowH(w, h, ts) {
        const aspect = w / h;
        let rowH = aspect > 2.2 ? 3 : 2;
        // Verhindert > 6000 fillRects bei breiten Zwischenformaten wie 844x390 (aspect ~2.16)
        const maxRunsPerRow = Math.ceil(w / ts) * 3 + 3;
        while (Math.ceil(h / rowH) * maxRunsPerRow > 5800 && rowH < 4) {
            rowH++;
        }
        return rowH;
    }

    /**
     * Schreibt eine volle Periode des Musters `pat` in `this.runBuf`
     * und liefert `{ count, period, rowShift }`.
     * level === -1 bedeutet INK (#000000 fuer Moertel).
     */
    _fillPatternRuns(pat, y, ts) {
        const buf = this.runBuf;

        if (pat === 0) {
            // P0: Schachbrett (Kachelbreite ts, Periode 2*ts)
            const yTile = Math.floor(y / ts);
            const parity = yTile & 1;
            buf[0] = 0;  buf[1] = ts; buf[2] = parity ? 4 : 2;
            buf[3] = ts; buf[4] = ts; buf[5] = parity ? 2 : 4;
            return { count: 2, period: ts * 2, rowShift: 0 };
        }

        if (pat === 1) {
            // P1: Vorhang (Periode ts)
            const w0 = Math.max(1, Math.round(0.15 * ts));
            const w1 = Math.max(1, Math.round(0.60 * ts) - w0);
            const w2 = Math.max(1, ts - w0 - w1);
            buf[0] = 0;        buf[1] = w0; buf[2] = 5;
            buf[3] = w0;       buf[4] = w1; buf[5] = 3;
            buf[6] = w0 + w1;  buf[7] = w2; buf[8] = 1;
            return { count: 3, period: w0 + w1 + w2, rowShift: 0 };
        }

        if (pat === 2) {
            // P2: Rauten (Periode ts; Hintergrund ueber Kachelgrenze verschmolzen -> max. 2 Laeufe)
            const half = ts * 0.5;
            const dy = Math.abs((y % ts) - half);
            const hw = Math.round(half - dy);
            if (hw <= 0) {
                buf[0] = 0; buf[1] = ts; buf[2] = 2;
                return { count: 1, period: ts, rowShift: 0 };
            }
            const mid = Math.floor(half);
            const dStart = Math.max(0, mid - hw);
            const dEnd = Math.min(ts, mid + hw);
            const dLen = dEnd - dStart;
            if (dLen >= ts) {
                buf[0] = 0; buf[1] = ts; buf[2] = 4;
                return { count: 1, period: ts, rowShift: 0 };
            }
            buf[0] = dStart; buf[1] = dLen;      buf[2] = 4;
            buf[3] = dEnd;   buf[4] = ts - dLen; buf[5] = 2;
            return { count: 2, period: ts, rowShift: 0 };
        }

        // P3: Ziegel (Reihenhoehe ts/3, Ziegelbreite 1.5*ts, Periode 3*bw, 1px INK-Moertel)
        const bh = Math.max(4, Math.round(ts / 3));
        const bw = Math.max(8, Math.round(1.5 * ts));
        const row = Math.floor(y / bh);
        const yInRow = y % bh;
        if (yInRow === 0) {
            buf[0] = 0; buf[1] = bw; buf[2] = -1;
            return { count: 1, period: bw, rowShift: 0 };
        }
        const rowShift = (row & 1) ? Math.floor(bw * 0.5) : 0;
        let off = 0;
        for (let b = 0; b < 3; b++) {
            const bx = b * bw;
            const id = row * 3 + b;
            const lvl = 2 + ((id * 7) % 3);
            buf[off++] = bx;     buf[off++] = 1;      buf[off++] = -1;
            buf[off++] = bx + 1; buf[off++] = bw - 1; buf[off++] = lvl;
        }
        return { count: 6, period: bw * 3, rowShift };
    }

    render(ctx, width, height, t, state, stateTime, metrics) {
        const safeT = Number.isFinite(t) ? t : (this.lastT !== null ? this.lastT : 0);

        if (
            !ctx ||
            !Number.isFinite(width) ||
            !Number.isFinite(height) ||
            width <= 0 ||
            height <= 0 ||
            !Number.isFinite(width / height)
        ) {
            this.lastT = safeT;
            return;
        }

        const w = Math.floor(width);
        const h = Math.floor(height);
        if (w <= 0 || h <= 0) {
            this.lastT = safeT;
            return;
        }

        if (state === 'idle') {
            this.lastT = safeT;
            this.lastState = 'idle';
            this.stateAge = 0;
            return;
        }

        let dt = this.lastT === null ? 0.02 : (safeT - this.lastT);
        this.lastT = safeT;
        if (!Number.isFinite(dt) || dt < 0) {
            dt = 0.02;
        } else if (dt > 0.1) {
            dt = 0.1;
        }

        if (this.lastState !== state) {
            this.lastState = state;
            this.stateAge = 0;
        } else {
            this.stateAge += dt;
        }

        this.simTime += dt;
        this.hardCooldown = Math.max(0, this.hardCooldown - dt);
        this.zoneBoostTimer = Math.max(0, this.zoneBoostTimer - dt);

        if (this.shockActive) {
            this.shockY += 300 * dt;
            if (this.shockY >= h) {
                this.shockActive = false;
            }
        }

        // Sichtbarkeit (StageManager TRANSITION_TIME = 1.5s)
        const stTime = Number.isFinite(stateTime) ? stateTime : this.stateAge;
        let vis = 1;
        if (state === 'starting') {
            vis = clamp01(stTime / TRANSITION_IN);
        } else if (state === 'stopping') {
            vis = 1 - clamp01(stTime / TRANSITION_OUT);
            if (vis <= 0) {
                return;
            }
        }

        // Defensives Metrik-Parsing (ohne Audio ueber t/ten lebendig)
        const safeMetrics = metrics || {};
        const fallbackTen = FALLBACK_TENSION[state] ?? 0.2;
        let targetTen = clamp01(safeMetrics.tensionPct ?? fallbackTen);
        if (state === 'afterglow') targetTen = Math.min(targetTen, 0.30);
        if (state === 'starting' || state === 'stopping') targetTen = Math.min(targetTen, 0.25);

        this.ten += (targetTen - this.ten) * (1 - Math.exp(-dt / (targetTen > this.ten ? 0.30 : 0.90)));

        const impulseArr = safeMetrics.beatImpulse;
        const beatArr = safeMetrics.beat;
        const impulse = clamp01(
            (impulseArr && impulseArr.length > 0 ? impulseArr[0] : undefined) ??
            (beatArr && beatArr.length > 0 ? beatArr[0] : 0)
        );

        const hasBeatCount = Number.isFinite(safeMetrics.beatCount);
        const count = hasBeatCount ? Math.floor(safeMetrics.beatCount) : (this.lastBeatCount + 1);
        const onBeat = safeMetrics.beatStarted === true && (!hasBeatCount || count !== this.lastBeatCount);
        let level = 0;
        if (onBeat) {
            if ([1, 2, 3].includes(safeMetrics.beatLevel)) {
                level = safeMetrics.beatLevel;
            } else {
                const s = Number.isFinite(safeMetrics.beatStrength) ? safeMetrics.beatStrength : 1;
                level = s < 1 / 3 ? 1 : (s < 2 / 3 ? 2 : 3);
            }
            this.lastBeatCount = count;
        }
        const dir = (this.lastBeatCount & 1) ? 1 : -1;

        const smooth = (Array.isArray(safeMetrics.smooth) || ArrayBuffer.isView(safeMetrics.smooth))
            ? safeMetrics.smooth
            : null;
        const ch0 = smooth && smooth.length > 0 ? clamp01(smooth[0]) : 0;
        const ch1 = smooth && smooth.length > 1 ? clamp01(smooth[1]) : 0;
        const ch2 = smooth && smooth.length > 2 ? clamp01(smooth[2]) : 0;
        const ch3 = smooth && smooth.length > 3 ? clamp01(smooth[3]) : 0;
        const chVals = [ch0, ch1, ch2, ch3];

        // ---------------------------------------------------------
        // Diskrete Beat-Reaktionen
        // ---------------------------------------------------------
        const allowDiscrete = state !== 'afterglow' && state !== 'stopping';
        if (onBeat && allowDiscrete) {
            if (level === 1) {
                this.phi1 = (this.phi1 + 0.4) % PHASE_WRAP;
            } else if (level === 2) {
                this.phi1 = (this.phi1 + 0.4) % PHASE_WRAP;
                this.shift = (this.shift + 1) % 10;
                let maxIdx = 0;
                for (let c = 1; c < 4; c++) {
                    if (chVals[c] > chVals[maxIdx]) maxIdx = c;
                }
                this.zoneBoostIdx = maxIdx;
                this.zoneBoostTimer = 0.2;
            } else if (level === 3) {
                this.shift = (this.shift + 2) % 10;
                if (this.hardCooldown <= 0) {
                    this.shockActive = true;
                    this.shockY = 0;
                    this.hardCooldown = 0.25;
                }
            }

            if (count > 0 && count % 4 === 0) {
                this.patPrev = this.pat;
                this.pat = (this.pat + 1) & 3;
                this.patWipeT0 = this.simTime;
            }
            if (count > 0 && count % 8 === 0) {
                this.phiSignTarget = -this.phiSignTarget;
                this.fam = (this.fam + 1) & 3;
            }
        }

        const targetRampName = state === 'afterglow' ? 'STEEL' : FAM[this.fam];
        this._setRamp(targetRampName);

        // ---------------------------------------------------------
        // Wellenkinematik (Slew & Integration)
        // ---------------------------------------------------------
        if (this.phiSign !== this.phiSignTarget) {
            const maxStep = (2 * dt) / 0.25;
            const diff = this.phiSignTarget - this.phiSign;
            this.phiSign = Math.abs(diff) <= maxStep ? this.phiSignTarget : this.phiSign + Math.sign(diff) * maxStep;
        }

        const isAfterglow = state === 'afterglow';
        const speedMul = isAfterglow ? 0.3 : 1.0;
        const phaseRate = (0.6 + 1.4 * this.ten) * this.phiSign * speedMul;
        this.phi1 = (this.phi1 + phaseRate * dt) % PHASE_WRAP;
        if (this.phi1 < 0) this.phi1 += PHASE_WRAP;

        const phiEff = this.phi1 + 0.25 * impulse * dir;
        const phi2Eff = 1.3 * phiEff;
        const phi3Eff = 1.7 * phiEff;

        // ---------------------------------------------------------
        // Geometrie, Zeilenraster & Zonenamplituden
        // ---------------------------------------------------------
        const minDim = Math.min(w, h);
        const ts = Math.max(16, Math.round(0.14 * minDim));
        const rowH = this._computeRowH(w, h, ts);
        this.lastRowH = rowH;
        const nRows = Math.ceil(h / rowH);

        const lam1 = Math.max(1, 0.55 * h);
        const lam2 = Math.max(1, 0.23 * h);
        const lam3 = Math.max(1, 0.11 * h);
        const h2 = this.ten >= 0.35 ? 0.45 : 0;
        const h3 = this.ten >= 0.70 ? 0.25 : 0;

        const aBase = lerp(0.03, 0.12, this.ten) * minDim * (isAfterglow ? 0.3 : 1.0);
        const maxDx = 0.2 * minDim;
        const impulseGain = 1 + 1.2 * impulse;

        for (let c = 0; c < 4; c++) {
            const boost = (this.zoneBoostTimer > 0 && this.zoneBoostIdx === c) ? 1.5 : 1.0;
            this.lastZoneAmps[c] = aBase * (0.6 + 0.8 * chVals[c]) * impulseGain * vis * boost;
        }

        const patP = clamp01((this.simTime - this.patWipeT0) / 0.5);
        const patWipeY = patP >= 1 ? h + 1 : patP * h;

        const rampP = clamp01((this.simTime - this.wipeT0) / 0.6);
        const rampWipeY = rampP >= 1 ? h + 1 : rampP * h;
        const rampNew = RAMPS[this.wipeTo];
        const rampOld = RAMPS[this.wipeFrom];

        const shockEnd = this.shockY + 6;
        let maxAbsDx = 0;

        const fr = (rx, ry, rw, rh) => {
            const x0 = Math.max(0, Math.round(rx));
            const y0 = Math.max(0, Math.round(ry));
            const x1 = Math.min(w, Math.round(rx + rw));
            const y1 = Math.min(h, Math.round(ry + rh));
            const fw = x1 - x0;
            const fh = y1 - y0;
            if (fw > 0 && fh > 0) {
                ctx.fillRect(x0, y0, fw, fh);
            }
        };

        // ---------------------------------------------------------
        // Zeilenweises Zeichnen mit Kachel-Wrap & Run-Merging
        // ---------------------------------------------------------
        for (let r = 0; r < nRows; r++) {
            const y = r * rowH;
            const ySample = Math.min(h - 1, y + rowH * 0.5);
            const yNorm = ySample / h;

            // Zonen-Interpolation ueber Anker [1/8, 3/8, 5/8, 7/8]*h
            const uZone = Math.min(3, Math.max(0, yNorm * 4 - 0.5));
            const z0 = Math.floor(uZone);
            const z1 = Math.min(3, z0 + 1);
            const zoneCh = lerp(chVals[z0], chVals[z1], uZone - z0);

            let zoneBoostMul = 1.0;
            if (this.zoneBoostTimer > 0) {
                const dist = Math.abs(uZone - this.zoneBoostIdx);
                if (dist < 1) {
                    zoneBoostMul = 1 + 0.5 * (1 - dist);
                }
            }

            const inShock = this.shockActive && ySample >= this.shockY && ySample < shockEnd;
            const shockAmpMul = inShock ? 2.0 : 1.0;
            const shockBoost = inShock ? 2 : 0;

            const amp = aBase * (0.6 + 0.8 * zoneCh) * impulseGain * vis * zoneBoostMul * shockAmpMul;
            const wave = Math.sin((TWO_PI * ySample) / lam1 + phiEff)
                + (h2 > 0 ? h2 * Math.sin((TWO_PI * ySample) / lam2 - phi2Eff) : 0)
                + (h3 > 0 ? h3 * Math.sin((TWO_PI * ySample) / lam3 + phi3Eff) : 0);

            let dx = amp * wave;
            if (dx > maxDx) dx = maxDx;
            else if (dx < -maxDx) dx = -maxDx;

            const absDx = Math.abs(dx);
            if (absDx > maxAbsDx) maxAbsDx = absDx;

            let copperDim = (yNorm < 0.12 || yNorm > 0.88) ? 1 : 0;
            if (isAfterglow) copperDim += 1;

            const patEff = ySample < patWipeY ? this.pat : this.patPrev;
            const ramp = ySample < rampWipeY ? rampNew : rampOld;
            const info = this._fillPatternRuns(patEff, y, ts);
            const P = info.period;
            const runCount = info.count;
            const dxTot = Math.round(dx) + info.rowShift;
            const offset = ((dxTot % P) + P) % P;
            const buf = this.runBuf;

            // Von offset - 2*P starten, damit uebergreifende Laeufe (P2/P3) links lueckenlos abdecken
            let mergeHex = '';
            let mergeStart = 0;
            let mergeEnd = 0;
            let hasRun = false;

            for (let base = offset - P * 2; base < w; base += P) {
                for (let k = 0; k < runCount; k++) {
                    const o = k * 3;
                    const rs = base + buf[o];
                    const rl = buf[o + 1];
                    const re = rs + rl;
                    if (re <= 0 || rs >= w || rl <= 0) continue;

                    const sx0 = rs < 0 ? 0 : rs;
                    const sx1 = re > w ? w : re;
                    if (sx1 <= sx0) continue;

                    const lvl = buf[o + 2];
                    let hex;
                    if (lvl < 0) {
                        hex = INK;
                    } else {
                        let cIdx = PP6[(lvl + this.shift) % 10] + shockBoost - copperDim;
                        if (cIdx < 0) cIdx = 0;
                        else if (cIdx > 5) cIdx = 5;
                        hex = ramp[cIdx];
                    }

                    if (!hasRun) {
                        mergeHex = hex;
                        mergeStart = sx0;
                        mergeEnd = sx1;
                        hasRun = true;
                    } else if (hex === mergeHex && sx0 === mergeEnd) {
                        mergeEnd = sx1;
                    } else {
                        ctx.fillStyle = mergeHex;
                        fr(mergeStart, y, mergeEnd - mergeStart, rowH);
                        mergeHex = hex;
                        mergeStart = sx0;
                        mergeEnd = sx1;
                    }
                }
            }

            if (hasRun) {
                ctx.fillStyle = mergeHex;
                fr(mergeStart, y, mergeEnd - mergeStart, rowH);
            }
        }

        this.lastMaxAbsDx = maxAbsDx;

        if (vis < 1) {
            bayerFadeCells(ctx, 0, 0, w, h, vis, 2, INK);
        }
    }
}