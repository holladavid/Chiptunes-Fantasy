// === js/visuals/dse/c64/sine-scroller.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: C64 SINE SCROLLER (FOREGROUND)
// VIC-II DYCP-Sinus-Scroller (wide) & vertikaler Dist-Scroller (tall):
// - 5x7 Bitmap-Font mit vorberechneten Spalten-/Zeilenläufen
// - 1px schwarze Kontur vor mehrfarbigem Raster-IRQ-Farbpass
// - 3 SID-Stimmenzonen, Hysterese-Echo-Zeile & Wipe-Familien
// - Kein Schwarz-Vollbild-Dither (reines Geometrie-/Scroll-Fade)
// =========================================================

import { C64_PALETTE, rgbToHex } from '../../utils/hardware-constraints.js';
import {
    GLYPH_WIDTH,
    GLYPH_HEIGHT,
    GLYPH_STEP,
    getGlyphColRuns,
    getGlyphRowRuns
} from '../../utils/bitmap-font.js';

const HEX = Object.freeze(C64_PALETTE.map(([r, g, b]) => rgbToHex(r, g, b)));

const RAMP = Object.freeze({
    GREY: Object.freeze([0, 11, 12, 15, 1]),
    BLUE: Object.freeze([0, 6, 14, 3, 1]),
    PURPLE: Object.freeze([0, 6, 4, 10, 1]),
    GREEN: Object.freeze([0, 11, 5, 13, 1]),
    FIRE: Object.freeze([0, 9, 2, 8, 7, 1])
});

const FAM = Object.freeze([RAMP.BLUE, RAMP.PURPLE, RAMP.GREEN, RAMP.FIRE]);

function buildTextPingPong(ramp) {
    // Indizes 1 .. L-1 als Ping-Pong (nie Index 0 Schwarz im Farbpass wegen schwarzer Kontur)
    const out = [];
    for (let i = 1; i < ramp.length; i++) out.push(i);
    for (let i = ramp.length - 2; i >= 2; i--) out.push(i);
    return Object.freeze(out);
}

const PP_TEXT = Object.freeze(FAM.map(buildTextPingPong));
const PP_ECHO = buildTextPingPong(RAMP.GREY);

const SCROLL_TEXT =
    '* CHIPTUNES FANTASY * GREETZ TO ALL SID FANS * 6581 + VIC-II POWER * KEEP THE BEAT ALIVE * ';

const TWO_PI = Math.PI * 2;
const T_IN = 1.5;
const T_OUT = 1.5;
const WIPE_DURATION = 0.6;
const BEATLESS_PENDING_TIMEOUT = 1.2;
const HARD_COOLDOWN = 0.25;

const FALLBACK_TENSION = Object.freeze({
    starting: 0.25,
    playing: 0.30,
    buildup: 0.65,
    climax: 1.0,
    afterglow: 0.20,
    stopping: 0.20
});

function clamp01(v) {
    if (!Number.isFinite(v)) return 0;
    return v < 0 ? 0 : (v > 1 ? 1 : v);
}

function lerp(a, b, k) {
    return a + (b - a) * k;
}

function fr(ctx, x, y, w, h, bufW, bufH) {
    let x0 = Math.round(x);
    let y0 = Math.round(y);
    let x1 = Math.round(x + w);
    let y1 = Math.round(y + h);
    if (x0 < 0) x0 = 0;
    if (y0 < 0) y0 = 0;
    if (x1 > bufW) x1 = bufW;
    if (y1 > bufH) y1 = bufH;
    const cw = x1 - x0;
    const ch = y1 - y0;
    if (cw > 0 && ch > 0) {
        ctx.fillRect(x0, y0, cw, ch);
    }
}

export class C64SineScroller {
    constructor() {
        this.name = 'C64 Sine Scroller';

        this.lastT = null;
        this.lastState = 'idle';
        this.stateAge = 0;
        this.ten = 0.30;

        // Kontinuierlicher Scroll- & Phasen-Zustand (bleibt über Porträt <-> Querformat erhalten!)
        this.scrollPos = 0;
        this.phi = 0;
        this.phiSign = 1;
        this.beatDir = 1;
        this.rasterPhase = 0;

        // Beat-Zustand (-1 schützt beatCount === 0)
        this.lastBeatCount = -1;
        this.hardCooldown = 0;
        this.zoneBoostTimer = 0;
        this.boostZone = 0;
        this.centerFlashTimer = 0;
        this.lastTopGlyphCount = 0;

        // Echo-Zeilen-Hysterese (an >= 0.35, aus < 0.25, übernommen bei Beat oder nach 1.2 s)
        this.echoActive = false;
        this.echoDesired = false;
        this.echoPendingTimer = 0;

        // Familien & Wipe (Start: BLUE)
        this.fam = 0;
        this.savedFam = 0;
        this.wipeFrom = 0;
        this.wipeTo = 0;
        this.wipeActive = false;
        this.wipeElapsed = 0;

        // Stopping-Grenze: Indizes >= stopCutoff liefern nur noch Leerzeichen
        this.stopCutoff = Infinity;
        this.ch = new Float32Array(3);
    }

    _startWipe(nextFam) {
        const target = ((nextFam % 4) + 4) % 4;
        const current = this.wipeActive ? this.wipeTo : this.fam;
        if (target === current && !this.wipeActive) return;
        this.wipeFrom = current;
        this.wipeTo = target;
        this.wipeElapsed = 0;
        this.wipeActive = true;
    }

    _charAt(index, isStopping) {
        if (index < 0) return ' ';
        if (isStopping && index >= this.stopCutoff) return ' ';
        return SCROLL_TEXT[index % SCROLL_TEXT.length];
    }

    _wch(relPos) {
        // Lineare Interpolation zwischen den Ankern [1/6, 1/2, 5/6]
        const q = clamp01(relPos);
        if (q <= 1 / 6) return this.ch[0];
        if (q <= 0.5) return lerp(this.ch[0], this.ch[1], (q - 1 / 6) / (1 / 3));
        if (q <= 5 / 6) return lerp(this.ch[1], this.ch[2], (q - 0.5) / (1 / 3));
        return this.ch[2];
    }

    _zoneAt(relPos) {
        const q = clamp01(relPos);
        if (q < 1 / 3) return 0;
        if (q < 2 / 3) return 1;
        return 2;
    }

    _waveOffset(s, axisLen, lambda, h2, phiEff, abase, isStarting, vis) {
        const rel = axisLen > 0 ? s / axisLen : 0.5;
        const wch = this._wch(rel);
        const aeff = abase * (0.55 + 0.9 * wch) * (isStarting ? vis : 1.0);
        const k1 = (TWO_PI * s) / Math.max(1, lambda);
        const k2 = (TWO_PI * s) / Math.max(1, 0.43 * lambda);
        return aeff * (Math.sin(k1 + phiEff) + h2 * Math.sin(k2 - 1.3 * phiEff));
    }

    _resolveRampColor(qBand, yAbs, glyphCh, isCenterFlash, isZoneBoost, isEcho, isAfterglow, wipeProgress) {
        if (isEcho) {
            const band = Math.floor((yAbs + this.rasterPhase) / this._bandRows);
            const ppIdx = ((band % PP_ECHO.length) + PP_ECHO.length) % PP_ECHO.length;
            return HEX[RAMP.GREY[PP_ECHO[ppIdx]]];
        }

        const activeFam = isAfterglow
            ? 0
            : ((this.wipeActive && qBand > wipeProgress) ? this.wipeFrom : this.fam);
        const ramp = FAM[activeFam];
        const L = ramp.length;

        if (isCenterFlash) {
            return HEX[ramp[L - 1]];
        }

        const pp = PP_TEXT[activeFam];
        const band = Math.floor((yAbs + this.rasterPhase) / this._bandRows);
        const ppIdx = ((band % pp.length) + pp.length) % pp.length;
        let cIdx = pp[ppIdx] + Math.round(1.5 * glyphCh);
        if (isZoneBoost) cIdx += 1;
        cIdx = Math.min(L - 1, Math.max(1, cIdx));
        return HEX[ramp[cIdx]];
    }

    _renderWide(ctx, w, h, horizon, scale, gw, gh, stepX, isStopping, isStarting, isAfterglow, vis, impulse, wipeProgress, isEcho) {
        const bandRows = this._bandRows;
        const abase = (isEcho ? 0.6 : 1.0) * lerp(0.015, 0.075, this.ten) * h * (1 + 0.9 * impulse)
            * (isAfterglow ? Math.min(1, this.ten / 0.30) * 0.6 : 1.0)
            * (isStopping ? vis : 1.0);
        const lambda = lerp(14, 7, this.ten) * gw;
        const h2 = (!isAfterglow && this.ten > 0.70) ? 0.4 : 0;
        const phiEff = this.phi + (isEcho ? 0.8 : 0) + 0.6 * impulse * this.beatDir;

        const baseHop = isEcho ? 0 : Math.round(impulse * scale * 2);
        let yBase = Math.floor(0.30 * h - gh * 0.5) - baseHop;
        if (isEcho) yBase += Math.round(1.6 * gh);

        const maxAllowedY = Math.max(2, horizon - gh - 3);
        const minAllowedY = Math.min(3, maxAllowedY);
        yBase = Math.max(minAllowedY, Math.min(maxAllowedY, yBase));

        const firstIdx = Math.max(0, Math.floor(this.scrollPos - 1));
        const lastIdx = Math.ceil(this.scrollPos + w / stepX + 1);
        const centerCharFloat = this.scrollPos + (w * 0.5) / stepX;

        // Pass 1: 1 px schwarze Kontur für den gesamten Textzug (immer vor dem Farbpass!)
        ctx.fillStyle = HEX[0];
        for (let k = firstIdx; k <= lastIdx; k++) {
            const ch = this._charAt(k, isStopping);
            if (ch === ' ') continue;
            const gx = Math.round((k - this.scrollPos) * stepX);
            if (gx + gw + 1 <= 0 || gx - 1 >= w) continue;

            const colRuns = getGlyphColRuns(ch);
            for (let col = 0; col < GLYPH_WIDTH; col++) {
                const runs = colRuns[col];
                if (runs.length === 0) continue;
                const px = gx + col * scale;
                if (px + scale + 1 <= 0 || px - 1 >= w) continue;
                const off = this._waveOffset(px, w, lambda, h2, phiEff, abase, isStarting, vis);
                const cy = Math.max(minAllowedY, Math.min(maxAllowedY, Math.round(yBase + off)));

                for (let r = 0; r < runs.length; r++) {
                    const run = runs[r];
                    fr(ctx, px - 1, cy + run.start * scale - 1, scale + 2, run.len * scale + 2, w, h);
                }
            }
        }

        // Pass 2: Farbpass mit Zerlegung an Rasterband-Grenzen (yAbs)
        for (let k = firstIdx; k <= lastIdx; k++) {
            const ch = this._charAt(k, isStopping);
            if (ch === ' ') continue;
            const gx = Math.round((k - this.scrollPos) * stepX);
            if (gx + gw <= 0 || gx >= w) continue;

            const relGlyph = clamp01((gx + gw * 0.5) / Math.max(1, w));
            const zone = this._zoneAt(relGlyph);
            const glyphCh = this.ch[zone];
            const isZoneBoost = !isEcho && this.zoneBoostTimer > 0 && zone === this.boostZone;
            const isCenterFlash = !isEcho && this.centerFlashTimer > 0 && Math.abs(k - centerCharFloat) <= 1.5;

            const colRuns = getGlyphColRuns(ch);
            for (let col = 0; col < GLYPH_WIDTH; col++) {
                const runs = colRuns[col];
                if (runs.length === 0) continue;
                const px = gx + col * scale;
                if (px + scale <= 0 || px >= w) continue;
                const off = this._waveOffset(px, w, lambda, h2, phiEff, abase, isStarting, vis);
                const cy = Math.max(minAllowedY, Math.min(maxAllowedY, Math.round(yBase + off)));

                for (let r = 0; r < runs.length; r++) {
                    const run = runs[r];
                    const ry0 = cy + run.start * scale;
                    const ry1 = ry0 + run.len * scale;
                    let segY = ry0;
                    while (segY < ry1) {
                        const bandShift = Math.floor(this.rasterPhase);
                        const absVal = segY + bandShift;
                        const nextBoundary = (Math.floor(absVal / bandRows) + 1) * bandRows - bandShift;
                        const segEnd = Math.min(ry1, Math.max(segY + 1, nextBoundary));
                        ctx.fillStyle = this._resolveRampColor(
                            relGlyph, segY, glyphCh, isCenterFlash, isZoneBoost, isEcho, isAfterglow, wipeProgress
                        );
                        fr(ctx, px, segY, scale, segEnd - segY, w, h);
                        segY = segEnd;
                    }
                }
            }
        }
    }

    _renderTall(ctx, w, h, scale, gw, gh, stepY, isStopping, isStarting, isAfterglow, vis, impulse, wipeProgress, isEcho) {
        const abase = (isEcho ? 0.6 : 1.0) * lerp(0.015, 0.075, this.ten) * w * (1 + 0.9 * impulse)
            * (isAfterglow ? Math.min(1, this.ten / 0.30) * 0.6 : 1.0)
            * (isStopping ? vis : 1.0);
        const lambda = lerp(14, 7, this.ten) * gh;
        const h2 = (!isAfterglow && this.ten > 0.70) ? 0.4 : 0;
        const phiEff = this.phi + (isEcho ? 0.8 : 0) + 0.6 * impulse * this.beatDir;

        const baseHop = isEcho ? 0 : Math.round(impulse * scale * 2) * this.beatDir;
        let xBase = Math.floor(w * 0.5 - gw * 0.5) - baseHop;
        if (isEcho) xBase += Math.round(1.6 * gw);

        const maxAllowedX = Math.max(2, w - gw - 2);
        const minAllowedX = Math.min(2, maxAllowedX);
        xBase = Math.max(minAllowedX, Math.min(maxAllowedX, xBase));

        const firstIdx = Math.max(0, Math.floor(this.scrollPos - 1));
        const lastIdx = Math.ceil(this.scrollPos + h / stepY + 1);
        const centerCharFloat = this.scrollPos + (h * 0.5) / stepY;

        // Pass 1: 1 px schwarze Kontur vor dem Farbpass
        ctx.fillStyle = HEX[0];
        for (let k = firstIdx; k <= lastIdx; k++) {
            const ch = this._charAt(k, isStopping);
            if (ch === ' ') continue;
            const gy = Math.round((k - this.scrollPos) * stepY);
            if (gy + gh + 1 <= 0 || gy - 1 >= h) continue;

            const rowRuns = getGlyphRowRuns(ch);
            for (let row = 0; row < GLYPH_HEIGHT; row++) {
                const runs = rowRuns[row];
                if (runs.length === 0) continue;
                const py = gy + row * scale;
                if (py + scale + 1 <= 0 || py - 1 >= h) continue;
                const off = this._waveOffset(py, h, lambda, h2, phiEff, abase, isStarting, vis);
                const cx = Math.max(minAllowedX, Math.min(maxAllowedX, Math.round(xBase + off)));

                for (let r = 0; r < runs.length; r++) {
                    const run = runs[r];
                    fr(ctx, cx + run.start * scale - 1, py - 1, run.len * scale + 2, scale + 2, w, h);
                }
            }
        }

        // Pass 2: Farbpass pro Pixelzeile (Rasterfarbe je yAbs)
        for (let k = firstIdx; k <= lastIdx; k++) {
            const ch = this._charAt(k, isStopping);
            if (ch === ' ') continue;
            const gy = Math.round((k - this.scrollPos) * stepY);
            if (gy + gh <= 0 || gy >= h) continue;

            const relGlyph = clamp01((gy + gh * 0.5) / Math.max(1, h));
            const zone = this._zoneAt(relGlyph);
            const glyphCh = this.ch[zone];
            const isZoneBoost = !isEcho && this.zoneBoostTimer > 0 && zone === this.boostZone;
            const isCenterFlash = !isEcho && this.centerFlashTimer > 0 && Math.abs(k - centerCharFloat) <= 1.5;

            const rowRuns = getGlyphRowRuns(ch);
            for (let row = 0; row < GLYPH_HEIGHT; row++) {
                const runs = rowRuns[row];
                if (runs.length === 0) continue;
                const py = gy + row * scale;
                if (py + scale <= 0 || py >= h) continue;
                const off = this._waveOffset(py, h, lambda, h2, phiEff, abase, isStarting, vis);
                const cx = Math.max(minAllowedX, Math.min(maxAllowedX, Math.round(xBase + off)));

                ctx.fillStyle = this._resolveRampColor(
                    relGlyph, py, glyphCh, isCenterFlash, isZoneBoost, isEcho, isAfterglow, wipeProgress
                );
                for (let r = 0; r < runs.length; r++) {
                    const run = runs[r];
                    fr(ctx, cx + run.start * scale, py, run.len * scale, scale, w, h);
                }
            }
        }
    }

    resize() {
        // scrollPos bleibt in Glyphen-Einheiten exakt erhalten über Porträt <-> Querformat hinweg.
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

        const minDim = Math.min(w, h);
        const scale = Math.min(4, Math.max(2, Math.floor(minDim / 52)));
        const gw = GLYPH_WIDTH * scale;
        const gh = GLYPH_HEIGHT * scale;
        const stepX = GLYPH_STEP * scale;
        const stepY = (GLYPH_HEIGHT + 1) * scale;
        const isWide = w >= 0.75 * h;
        const glyphStep = isWide ? stepX : stepY;
        const visibleGlyphSpan = (isWide ? w : h) / Math.max(1, glyphStep);
        this._bandRows = scale * 2;

        const prevState = this.lastState;
        if (prevState !== state) {
            this.lastState = state;
            this.stateAge = 0;

            if (state === 'starting') {
                // Startet mit erstem Zeichen am Rand einlaufend
                this.scrollPos = -visibleGlyphSpan + 0.8;
                this.stopCutoff = Infinity;
            } else if (state === 'stopping') {
                // Keine neuen Nicht-Leerzeichen mehr einspeisen!
                this.stopCutoff = Math.max(1, Math.ceil(this.scrollPos + visibleGlyphSpan));
            } else {
                this.stopCutoff = Infinity;
            }

            if (state === 'afterglow') {
                if (prevState === 'idle' || prevState === 'starting') {
                    this.fam = 0;
                    this.wipeTo = 0;
                    this.wipeActive = false;
                } else {
                    this.savedFam = this.wipeActive ? this.wipeTo : this.fam;
                    this._startWipe(0);
                }
            } else if (prevState === 'afterglow' && state !== 'stopping') {
                this._startWipe(this.savedFam);
            }
        } else {
            this.stateAge += dt;
        }

        // Sichtbarkeit auf Foreground-Layer (kein Schwarz-Vollbild-Dither!)
        const effectiveStateTime = Number.isFinite(stateTime) ? stateTime : this.stateAge;
        let vis = 1.0;
        if (state === 'starting') {
            vis = clamp01((effectiveStateTime + 0.06) / T_IN);
        } else if (state === 'stopping') {
            vis = 1.0 - clamp01(effectiveStateTime / T_OUT);
            if (vis <= 0.001) {
                return;
            }
        }

        // Asymmetrische Tension-Glättung (§2)
        const targetTenBase = clamp01(metrics?.tensionPct ?? FALLBACK_TENSION[state] ?? 0.2);
        let targetTen = targetTenBase;
        if (state === 'afterglow') targetTen = Math.min(targetTen, 0.30);
        if (state === 'starting' || state === 'stopping') targetTen = Math.min(targetTen, 0.25);
        const tau = targetTen > this.ten ? 0.30 : 0.90;
        this.ten += (targetTen - this.ten) * (1 - Math.exp(-dt / tau));

        // Metriken & SID-Stimmen
        const rawImpulse = metrics?.beatImpulse?.[0];
        const rawBeat = metrics?.beat?.[0];
        const impulse = clamp01(Number.isFinite(rawImpulse) ? rawImpulse : rawBeat);

        for (let k = 0; k < 3; k++) {
            const rawCh = metrics?.smooth?.[k];
            this.ch[k] = clamp01(Number.isFinite(rawCh) ? rawCh : 0);
        }

        const count = Number.isFinite(metrics?.beatCount)
            ? Math.floor(metrics.beatCount)
            : (this.lastBeatCount + 1);
        const onBeat = metrics?.beatStarted === true && count !== this.lastBeatCount;
        const rawStrength = Number.isFinite(metrics?.beatStrength) ? metrics.beatStrength : 1;
        const level = !onBeat ? 0 : ([1, 2, 3].includes(metrics?.beatLevel)
            ? metrics.beatLevel
            : (rawStrength < 1 / 3 ? 1 : (rawStrength < 2 / 3 ? 2 : 3)));
        if (onBeat) {
            this.lastBeatCount = count;
            this.beatDir = (count & 1) ? 1 : -1;
        }

        this.hardCooldown = Math.max(0, this.hardCooldown - dt);
        this.zoneBoostTimer = Math.max(0, this.zoneBoostTimer - dt);
        this.centerFlashTimer = Math.max(0, this.centerFlashTimer - dt);

        if (this.wipeActive) {
            this.wipeElapsed += dt;
            if (this.wipeElapsed >= WIPE_DURATION) {
                this.wipeActive = false;
                this.fam = this.wipeTo;
            }
        }

        const isAfterglow = state === 'afterglow';
        const isStarting = state === 'starting';
        const isStopping = state === 'stopping';

        // Echo-Zeilen-Hysterese (an >= 0.35, aus < 0.25)
        if (isAfterglow || isStopping) {
            this.echoDesired = false;
        } else if (!this.echoDesired && this.ten >= 0.35) {
            this.echoDesired = true;
        } else if (this.echoDesired && this.ten < 0.25) {
            this.echoDesired = false;
        }

        if (this.echoActive !== this.echoDesired) {
            this.echoPendingTimer += dt;
            if (onBeat || this.echoPendingTimer >= BEATLESS_PENDING_TIMEOUT || isAfterglow) {
                this.echoActive = this.echoDesired;
                this.echoPendingTimer = 0;
            }
        } else {
            this.echoPendingTimer = 0;
        }

        // Diskrete Beat-Reaktionen (§5.3)
        if (onBeat) {
            if (level === 1) {
                this.rasterPhase += this._bandRows;
                this.lastTopGlyphCount = 0;
            } else if (level === 2) {
                this.rasterPhase += 2 * this._bandRows;
                let bestZ = 0;
                if (this.ch[1] > this.ch[bestZ]) bestZ = 1;
                if (this.ch[2] > this.ch[bestZ]) bestZ = 2;
                this.boostZone = bestZ;
                this.zoneBoostTimer = 0.20;
                this.lastTopGlyphCount = 1;
            } else if (level === 3) {
                this.rasterPhase += 3 * this._bandRows;
                if (this.hardCooldown <= 0 && !isAfterglow) {
                    this.hardCooldown = HARD_COOLDOWN;
                    this.centerFlashTimer = 0.12;
                    this.lastTopGlyphCount = 3;
                }
            }

            if (count > 0 && !isAfterglow && !isStopping) {
                if (count % 4 === 0) {
                    const nextFam = ((this.wipeActive ? this.wipeTo : this.fam) + 1) % 4;
                    this._startWipe(nextFam);
                    this.savedFam = nextFam;
                }
                if (count % 8 === 0) {
                    this.phiSign = -this.phiSign;
                }
            }
        }

        // Scroll- & Phasen-Fortschritt (in stopping beschleunigt damit Text bis vis=0 ausläuft)
        let speed = lerp(32, 96, this.ten);
        if (isAfterglow) speed *= 0.4;
        if (isStopping) speed = Math.max(speed * 2, ((visibleGlyphSpan * glyphStep) / T_OUT) * 1.1);

        this.scrollPos += (speed / Math.max(1, glyphStep)) * dt;
        const rasterSpeed = isAfterglow ? 6 : lerp(8, 40, this.ten);
        this.rasterPhase += rasterSpeed * dt;
        this.phi += this.phiSign * (0.9 + 1.6 * this.ten) * (isAfterglow ? 0.4 : 1.0) * dt;

        // ---------------------------------------------------------
        // Darstellung (Echo zuerst, dann Hauptzeile: Outline vor Farbe)
        // ---------------------------------------------------------
        const horizon = Math.floor(h * 0.55);
        const wipeProgress = this.wipeActive ? clamp01(this.wipeElapsed / WIPE_DURATION) : 1.0;

        if (this.echoActive && !isAfterglow && !isStopping) {
            if (isWide) {
                this._renderWide(ctx, w, h, horizon, scale, gw, gh, stepX, isStopping, isStarting, isAfterglow, vis, impulse, wipeProgress, true);
            } else {
                this._renderTall(ctx, w, h, scale, gw, gh, stepY, isStopping, isStarting, isAfterglow, vis, impulse, wipeProgress, true);
            }
        }

        if (isWide) {
            this._renderWide(ctx, w, h, horizon, scale, gw, gh, stepX, isStopping, isStarting, isAfterglow, vis, impulse, wipeProgress, false);
        } else {
            this._renderTall(ctx, w, h, scale, gw, gh, stepY, isStopping, isStarting, isAfterglow, vis, impulse, wipeProgress, false);
        }
    }
}