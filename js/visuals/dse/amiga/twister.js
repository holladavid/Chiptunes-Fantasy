// =========================================================
// DEMO-SCENE-ELEMENT: AMIGA TWISTER (Foreground)
// Vierseitiger Amiga-Rasterbalken entlang der Y-Achse,
// 1-3 Balken je Seitenverhaeltnis, 4 Twist-Modi mit weichem
// Morph, feste Zuordnung Flaeche i <-> Paula-Kanal i,
// geometrisches Starting/Stopping (kein Schwarz-Dither).
// =========================================================

import {
    RAMPS,
    INK,
    CH_RAMPS,
    COOL,
    TRANSITION_IN,
    TRANSITION_OUT
} from './amiga-kit.js';

const TWO_PI = Math.PI * 2;
const HALF_PI = Math.PI * 0.5;
const SQRT2 = Math.SQRT2;
const FALLBACK_TENSION = Object.freeze({
    playing: 0.30,
    buildup: 0.65,
    climax: 1.0,
    afterglow: 0.20
});

const clamp01 = (v) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
const lerp = (a, b, k) => a + (b - a) * k;

function smoothstep(edge0, edge1, x) {
    const t = clamp01((x - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
}

function evalTwistMode(mode, y, h, simTime) {
    if (mode === 0) {
        return y / h;
    }
    if (mode === 1) {
        const f = (2 * y) / h;
        return f - Math.floor(f);
    }
    if (mode === 2) {
        const x = y / 128;
        const m = (((x + 1) % 2) + 2) % 2;
        return 2 * Math.abs(m - 1);
    }
    return (y / h) * (0.6 + 0.4 * Math.sin(1.3 * simTime));
}

export class AmigaTwister {
    constructor() {
        this.name = 'Amiga Twister';

        // Zeit- und Zustandsverfolgung
        this.lastT = null;
        this.simTime = 0;
        this.lastState = 'idle';
        this.stateAge = 0;

        // Kontinuierliche Kinematik (bleibt bei Resize/Rotation erhalten)
        this.rotPhase = 0;
        this.rotSign = 1;
        this.rotSignTarget = 1;
        this.ten = 0.2;
        this.twist = 1.2;
        this.bulge = 0;

        // Diskreter Beat-, Modus- und Farb-Zustand
        this.lastBeatCount = 0;
        this.hardCooldown = 0;
        this.bandPhase = 0;
        this.twistKick = 0;

        this.mode = 0;
        this.modePrev = 0;
        this.modeBlend = 1;

        this.rot = 0;
        this.rotPrev = 0;
        this.coolCurr = false;
        this.coolPrev = false;
        this.rampWipeT0 = -10;

        // Kanal-Beat-Highlights
        this.medFlashTimer = 0;
        this.medFlashCh = 0;
        this.hardFlashTimer = 0;
        this.hardFlashCh = 0;

        // Diagnostik-Zaehler fuer Tests (max. sichtbare Flaechen pro Zeile, Anzahl Balken)
        this.lastTwisterCount = 1;
        this.lastMaxVisibleFacesPerRow = 0;
        this.lastMaxChannelShown = new Float32Array(4);
    }

    resize() {
        // Anzahl n und R0 leiten sich dynamisch aus (width, height) ab;
        // Phasen, Modus und Farbrotation bleiben ueber Rotationen erhalten.
    }

    _triggerRampWipe(nextRot, nextCool) {
        if (nextRot === this.rot && nextCool === this.coolCurr) return;
        const p = clamp01((this.simTime - this.rampWipeT0) / 0.6);
        if (p < 1 && p > 0.5) {
            this.rotPrev = this.rot;
            this.coolPrev = this.coolCurr;
        } else if (p >= 1) {
            this.rotPrev = this.rot;
            this.coolPrev = this.coolCurr;
        }
        this.rot = nextRot;
        this.coolCurr = nextCool;
        this.rampWipeT0 = this.simTime;
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
        this.medFlashTimer = Math.max(0, this.medFlashTimer - dt);
        this.hardFlashTimer = Math.max(0, this.hardFlashTimer - dt);
        this.twistKick *= Math.exp(-dt / 0.25);

        if (this.modeBlend < 1) {
            this.modeBlend = clamp01(this.modeBlend + dt / 0.5);
        }

        // Geometrische Sichtbarkeit (kein Schwarz-Vollbild-Dither auf Foreground!)
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
        const ch = [
            smooth && smooth.length > 0 ? clamp01(smooth[0]) : 0,
            smooth && smooth.length > 1 ? clamp01(smooth[1]) : 0,
            smooth && smooth.length > 2 ? clamp01(smooth[2]) : 0,
            smooth && smooth.length > 3 ? clamp01(smooth[3]) : 0
        ];

        let loudestCh = 0;
        for (let c = 1; c < 4; c++) {
            if (ch[c] > ch[loudestCh]) loudestCh = c;
        }

        // ---------------------------------------------------------
        // Diskrete Beat-Reaktionen
        // ---------------------------------------------------------
        const allowDiscrete = state !== 'afterglow' && state !== 'stopping';
        let nextRot = this.rot;
        if (onBeat && allowDiscrete) {
            if (level === 1) {
                this.bandPhase = (this.bandPhase + 1) & 1;
            } else if (level === 2) {
                this.twistKick = 0.6;
                this.medFlashTimer = 0.2;
                this.medFlashCh = loudestCh;
            } else if (level === 3) {
                if (this.hardCooldown <= 0) {
                    this.hardFlashTimer = 0.12;
                    this.hardFlashCh = loudestCh;
                    this.hardCooldown = 0.25;
                }
            }

            if (count > 0 && count % 4 === 0) {
                this.modePrev = this.mode;
                this.mode = (this.mode + 1) & 3;
                this.modeBlend = 0;
            }
            if (count > 0 && count % 8 === 0) {
                this.rotSignTarget = -this.rotSignTarget;
                nextRot = (this.rot + 1) & 3;
            }
        }

        const isAfterglow = state === 'afterglow';
        this._triggerRampWipe(nextRot, isAfterglow);

        // ---------------------------------------------------------
        // Kontinuierliche Kinematik (Slew & Integration)
        // ---------------------------------------------------------
        if (this.rotSign !== this.rotSignTarget) {
            const maxStep = (2 * dt) / 0.4; // 0.4s Slew
            const diff = this.rotSignTarget - this.rotSign;
            this.rotSign = Math.abs(diff) <= maxStep ? this.rotSignTarget : this.rotSign + Math.sign(diff) * maxStep;
        }

        const omega = lerp(0.9, 2.2, this.ten) * this.rotSign * (isAfterglow ? 0.3 : 1.0);
        this.rotPhase = (this.rotPhase + omega * dt) % TWO_PI;
        if (this.rotPhase < 0) this.rotPhase += TWO_PI;

        const twistTarget = isAfterglow ? 0.6 : lerp(1.2, 3.5, this.ten);
        const twistTau = isAfterglow ? 0.40 : 0.25; // 1.2s Beruhigung in Afterglow
        this.twist += (twistTarget - this.twist) * (1 - Math.exp(-dt / twistTau));

        const bulgeTarget = isAfterglow ? 0 : 0.25 * smoothstep(0.3, 0.6, this.ten);
        this.bulge += (bulgeTarget - this.bulge) * (1 - Math.exp(-dt / 0.30));

        // ---------------------------------------------------------
        // Responsives Layout (1-3 Balken je Seitenverhaeltnis)
        // ---------------------------------------------------------
        const aspect = w / h;
        const minDim = Math.min(w, h);
        const n = aspect < 1.5 ? 1 : (aspect < 2.3 ? 2 : 3);
        const rowH = n === 1 ? 1 : 2;
        const nRows = Math.ceil(h / rowH);
        const r0 = 0.28 * minDim * (n > 1 ? 0.8 : 1);

        this.lastTwisterCount = n;
        this.lastMaxVisibleFacesPerRow = 0;
        for (let i = 0; i < 4; i++) this.lastMaxChannelShown[i] = 0;

        const rampP = clamp01((this.simTime - this.rampWipeT0) / 0.6);
        const rampWipeY = rampP >= 1 ? h + 1 : rampP * h;

        const isClimax = state === 'climax';
        const hasLoudEdge = isClimax && ch[loudestCh] > 0.05;
        const chRound = [
            Math.round(ch[0]),
            Math.round(ch[1]),
            Math.round(ch[2]),
            Math.round(ch[3])
        ];
        const chActive = [ch[0], ch[1], ch[2], ch[3]];

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
        // Raster-Rendering pro Balken und Scanline
        // ---------------------------------------------------------
        const mb = this.modeBlend;
        const modeOld = this.modePrev;
        const modeNew = this.mode;
        const simTime = this.simTime;
        const bulgeAmp = this.bulge;
        const impRadiusGain = 1 + 0.35 * impulse;
        const impAngleOffset = 0.5 * impulse * dir;
        const bandPhase = this.bandPhase;
        const twistKick = this.twistKick;
        const medFlash = this.medFlashTimer > 0;
        const hardFlash = this.hardFlashTimer > 0;

        for (let k = 0; k < n; k++) {
            const visK = clamp01((vis - 0.2 * k) / (1 - 0.2 * k));
            if (visK <= 0) continue;

            const cx = w * ((k + 0.5) / n) + 0.04 * minDim * Math.sin(0.5 * simTime + 1.7 * k);
            const kPhase = (k * TWO_PI) / 3;

            for (let r = 0; r < nRows; r++) {
                const y = r * rowH;
                const ySample = Math.min(h - 1, y + rowH * 0.5);

                const g = mb >= 1
                    ? evalTwistMode(modeNew, ySample, h, simTime)
                    : lerp(evalTwistMode(modeOld, ySample, h, simTime), evalTwistMode(modeNew, ySample, h, simTime), mb);

                const theta = this.rotPhase
                    + TWO_PI * this.twist * g * visK
                    + TWO_PI * twistKick * (ySample / h)
                    + impAngleOffset
                    + kPhase;

                const radius = r0
                    * (1 + bulgeAmp * Math.sin((TWO_PI * ySample) / (0.7 * h) + 0.8 * simTime))
                    * impRadiusGain
                    * visK;

                if (radius < 0.75) continue;

                const x0 = cx + radius * Math.cos(theta);
                const x1 = cx + radius * Math.cos(theta + HALF_PI);
                const x2 = cx + radius * Math.cos(theta + Math.PI);
                const x3 = cx + radius * Math.cos(theta + HALF_PI * 3);
                const xs = [x0, x1, x2, x3];

                const useNewRamp = ySample < rampWipeY;
                const rotEff = useNewRamp ? this.rot : this.rotPrev;
                const coolEff = useNewRamp ? this.coolCurr : this.coolPrev;
                const band = (Math.floor(y / 8) + bandPhase) & 1;
                const invMaxW = 1 / (SQRT2 * radius);

                let visCount = 0;
                let leftOuter = Infinity;
                let rightOuter = -Infinity;
                let seamX = null;
                let seamEdgeColor = INK;
                let leftEdgeColor = INK;
                let rightEdgeColor = INK;

                for (let i = 0; i < 4; i++) {
                    const xaRaw = xs[i];
                    const xbRaw = xs[(i + 1) & 3];
                    if (xbRaw <= xaRaw) continue;

                    visCount++;
                    const xa = Math.round(xaRaw);
                    const xb = Math.round(xbRaw);
                    if (xb <= xa) continue;

                    const lit = clamp01((xbRaw - xaRaw) * invMaxW);
                    let lvl = 1 + Math.round(lit * 3) + chRound[i] - band;
                    if (medFlash && i === this.medFlashCh) lvl += 1;
                    if (hardFlash && i === this.hardFlashCh) lvl = 5;
                    if (lvl < 0) lvl = 0;
                    else if (lvl > 5) lvl = 5;

                    const rampName = coolEff ? COOL[i] : CH_RAMPS[(i + rotEff) & 3];
                    const ramp = RAMPS[rampName];
                    ctx.fillStyle = ramp[lvl];
                    fr(xa, y, xb - xa, rowH);

                    if (chActive[i] > this.lastMaxChannelShown[i]) {
                        this.lastMaxChannelShown[i] = chActive[i];
                    }

                    const edgeColor = (hasLoudEdge && i === loudestCh) ? ramp[5] : INK;
                    if (xa < leftOuter) {
                        if (leftOuter !== Infinity) seamX = xa;
                        leftOuter = xa;
                        leftEdgeColor = edgeColor;
                    } else {
                        seamX = xa;
                        if (edgeColor !== INK) seamEdgeColor = edgeColor;
                    }

                    if (xb > rightOuter) {
                        rightOuter = xb;
                        rightEdgeColor = edgeColor;
                    } else if (edgeColor !== INK) {
                        seamEdgeColor = edgeColor;
                    }
                }

                if (visCount > this.lastMaxVisibleFacesPerRow) {
                    this.lastMaxVisibleFacesPerRow = visCount;
                }

                if (visCount > 0 && rightOuter > leftOuter) {
                    // Aeussere Silhouette & Trennfuge
                    ctx.fillStyle = leftEdgeColor;
                    fr(leftOuter, y, 1, rowH);
                    if (rightOuter - 1 > leftOuter) {
                        ctx.fillStyle = rightEdgeColor;
                        fr(rightOuter - 1, y, 1, rowH);
                    }
                    if (seamX !== null && seamX > leftOuter && seamX < rightOuter - 1) {
                        ctx.fillStyle = seamEdgeColor;
                        fr(seamX, y, 1, rowH);
                    }
                }
            }
        }
    }
}