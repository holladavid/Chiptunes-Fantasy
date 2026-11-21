// === js/visuals/dse/c64/border-rasters.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: C64 BORDER RASTERS (FOREGROUND)
// VIC-II $D020 Open-Border-Instrument:
// - 3 SID-Stimmen-Balkengruppen mit rotierenden Rampenfamilien
// - Run-gemergte Seitenrahmen + Cycle-exact 16px-Schrägstreifen im Climax
// - 1px schwarze Innenkante auf dem Rahmenrand (Innenbereich bleibt sauber)
// - 8 Hardware-Stern-Sprites auf der Rahmenmittellinie, rein geometrischer Fade
// =========================================================

import { C64_PALETTE, rgbToHex } from '../../utils/hardware-constraints.js';

const HEX = Object.freeze(C64_PALETTE.map(([r, g, b]) => rgbToHex(r, g, b)));

const RAMP = Object.freeze({
    BLUE: Object.freeze([0, 6, 14, 3, 1]),
    GREEN: Object.freeze([0, 11, 5, 13, 1]),
    FIRE: Object.freeze([0, 9, 2, 8, 7, 1])
});

// Stimmenfamilien-Rotation (FIRE / GREEN / BLUE)
const VOICE_FAM = Object.freeze([RAMP.FIRE, RAMP.GREEN, RAMP.BLUE]);

// Hartkodiertes 7x7-Stern-Sprite mit vorberechneten Zeilenläufen (zero allocs)
const STAR_7X7 = Object.freeze([
    0b0001000,
    0b0011100,
    0b1111111,
    0b0111110,
    0b0011100,
    0b0110110,
    0b1000001
]);

const STAR_ROW_RUNS = Object.freeze(STAR_7X7.map(mask => {
    const runs = [];
    let runStart = -1;
    for (let col = 0; col <= 7; col++) {
        const on = col < 7 && (mask & (1 << (6 - col))) !== 0;
        if (on) {
            if (runStart === -1) runStart = col;
        } else if (runStart !== -1) {
            runs.push(Object.freeze({ start: runStart, len: col - runStart }));
            runStart = -1;
        }
    }
    return Object.freeze(runs);
}));

const TWO_PI = Math.PI * 2;
const T_IN = 1.5;
const T_OUT = 1.5;
const WIPE_DURATION = 0.6;
const HARD_COOLDOWN = 0.25;
const SPRITE_POOL_SIZE = 8;

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

export class C64BorderRasters {
    constructor() {
        this.name = 'C64 Border Rasters';

        this.lastT = null;
        this.lastState = 'idle';
        this.stateAge = 0;
        this.ten = 0.30;

        // Instanzeigener Zeilenpuffer (wird nur bei Höhenänderung neu angelegt)
        this.lineColor = new Uint8Array(0);

        // Kontinuierliche Phasen je SID-Stimme (bleiben bei Richtungswechsel & Resize stetig)
        this.barPhase = new Float64Array(3);
        this.sinSign = 1;
        this.loopDir = 1;
        this.beatDir = 1;

        // Beat- & Familien-Zustand (-1 verhindert Verlust von beatCount === 0)
        this.lastBeatCount = -1;
        this.hardCooldown = 0;
        this.rot = 0;
        this.prevRot = 0;
        this.wipeActive = false;
        this.wipeElapsed = 0;
        this.afterglowBlend = false;

        // Core-/Balken-Boosts (soft: bis nächster Beat; medium: 0.55s Kern / 0.2s Balken; hard: alle Kerne Top)
        this.softCoreVoice = -1;
        this.medVoice = -1;
        this.medCoreTimer = 0;
        this.medBarTimer = 0;
        this.hardCoreTimer = 0;
        this.lastCoreStage = 0;

        // Fester 8er Hardware-Sprite-Pool (max 8 pro Frame)
        this.sprites = Array.from({ length: SPRITE_POOL_SIZE }, () => ({
            active: false,
            sPos: 0,
            dist: 0,
            age: 0,
            colorHex: HEX[1]
        }));

        this.ch = new Float32Array(3);
        this.lastBtEff = 0;
    }

    _ensureLineBuffer(h) {
        if (this.lineColor.length !== h) {
            this.lineColor = new Uint8Array(h);
        }
    }

    _highestVoice() {
        let best = 0;
        if (this.ch[1] > this.ch[best]) best = 1;
        if (this.ch[2] > this.ch[best]) best = 2;
        return best;
    }

    _voiceRampAt(g, q, isAfterglow) {
        if (isAfterglow) return RAMP.BLUE;
        const activeRot = (this.wipeActive && q > clamp01(this.wipeElapsed / WIPE_DURATION))
            ? this.prevRot
            : this.rot;
        return VOICE_FAM[(g + activeRot) % 3];
    }

    _spawnSprite(isAfterglow, w, h, bt) {
        let freeSlot = -1;
        let oldestIdx = 0;
        let maxAge = -1;
        for (let i = 0; i < SPRITE_POOL_SIZE; i++) {
            const sp = this.sprites[i];
            if (!sp.active) {
                freeSlot = i;
                break;
            }
            if (sp.age > maxAge) {
                maxAge = sp.age;
                oldestIdx = i;
            }
        }

        const slot = this.sprites[freeSlot !== -1 ? freeSlot : oldestIdx];
        const voice = this._highestVoice();
        const ramp = isAfterglow ? RAMP.BLUE : VOICE_FAM[(voice + this.rot) % 3];
        const wPath = Math.max(1, w - bt);
        const hPath = Math.max(1, h - bt);
        const Lp = 2 * (wPath + hPath);

        slot.active = true;
        // Start gleichmäßig um den Rahmen verteilt basierend auf Beat-Zähler
        slot.sPos = ((Math.max(0, this.lastBeatCount) * 0.27) % 1) * Lp;
        slot.dist = 0;
        slot.age = 0;
        slot.colorHex = HEX[ramp[ramp.length - 2]];
    }

    _drawSprite(ctx, cx, cy, s, colorHex, w, h) {
        const half = (7 * s) * 0.5;
        const sx = Math.round(cx - half);
        const sy = Math.round(cy - half);

        // Pass 1: 1 px schwarze Kontur
        ctx.fillStyle = HEX[0];
        for (let row = 0; row < 7; row++) {
            const runs = STAR_ROW_RUNS[row];
            const py = sy + row * s;
            for (let r = 0; r < runs.length; r++) {
                const run = runs[r];
                fr(ctx, sx + run.start * s - 1, py - 1, run.len * s + 2, s + 2, w, h);
            }
        }

        // Pass 2: Sprite-Farbe
        ctx.fillStyle = colorHex;
        for (let row = 0; row < 7; row++) {
            const runs = STAR_ROW_RUNS[row];
            const py = sy + row * s;
            for (let r = 0; r < runs.length; r++) {
                const run = runs[r];
                fr(ctx, sx + run.start * s, py, run.len * s, s, w, h);
            }
        }
    }

    resize() {
        // lineColor wird direkt in render() auf die tatsächliche Buffer-Höhe angepasst;
        // Balkenphasen, Rotation und laufende Sprites bleiben beim Resize erhalten.
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

        const prevState = this.lastState;
        if (prevState !== state) {
            this.lastState = state;
            this.stateAge = 0;
        } else {
            this.stateAge += dt;
        }

        // Geometrische Sichtbarkeit auf Foreground-Layer (kein Schwarz-Vollbild-Dither!)
        const effectiveStateTime = Number.isFinite(stateTime) ? stateTime : this.stateAge;
        let vis = 1.0;
        if (state === 'starting') {
            vis = clamp01((effectiveStateTime + 0.06) / T_IN);
        } else if (state === 'stopping') {
            vis = 1.0 - clamp01(effectiveStateTime / T_OUT);
            if (vis <= 0.001) {
                this.lastBtEff = 0;
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
        this.medCoreTimer = Math.max(0, this.medCoreTimer - dt);
        this.medBarTimer = Math.max(0, this.medBarTimer - dt);
        this.hardCoreTimer = Math.max(0, this.hardCoreTimer - dt);

        if (this.wipeActive) {
            this.wipeElapsed += dt;
            if (this.wipeElapsed >= WIPE_DURATION) {
                this.wipeActive = false;
                this.prevRot = this.rot;
            }
        }

        const minDim = Math.min(w, h);
        const bt = Math.min(14, Math.max(4, Math.round(minDim * 0.07)));
        const maxBtCap = Math.floor(minDim / 4);
        const breath = (state === 'starting' || state === 'stopping') ? 0 : Math.round(impulse * 2);
        const rawBtEff = state === 'starting'
            ? Math.max(1, Math.floor(bt * vis))
            : (Math.floor(bt * vis) + breath);
        const btEff = Math.min(maxBtCap, rawBtEff);
        this.lastBtEff = btEff;
        if (btEff <= 0) return;

        const isAfterglow = state === 'afterglow';
        const isStopping = state === 'stopping';

        // Diskrete Beat-Reaktionen (§5.4)
        if (onBeat) {
            // Jeder Beat löst den vorherigen soft-Kernstatus ab
            this.softCoreVoice = -1;

            if (level === 1) {
                this.softCoreVoice = this._highestVoice();
                this.lastCoreStage = 1;
            } else if (level === 2) {
                this.medVoice = this._highestVoice();
                this.medCoreTimer = 0.55;
                this.medBarTimer = 0.20;
                this.lastCoreStage = 2;
                if (!isAfterglow && !isStopping && (state === 'climax' || this.ten > 0.70)) {
                    this._spawnSprite(isAfterglow, w, h, bt);
                }
            } else if (level === 3) {
                this.lastCoreStage = 3;
                if (this.hardCooldown <= 0) {
                    this.hardCooldown = HARD_COOLDOWN;
                    this.hardCoreTimer = 0.55;
                    if (!isAfterglow && !isStopping) {
                        this._spawnSprite(isAfterglow, w, h, bt);
                    }
                }
            }

            if (count > 0 && !isAfterglow && !isStopping) {
                if (count % 4 === 0) {
                    this.prevRot = this.rot;
                    this.rot = (this.rot + 1) % 3;
                    this.wipeActive = true;
                    this.wipeElapsed = 0;
                }
                if (count % 8 === 0) {
                    this.sinSign = -this.sinSign;
                    this.loopDir = -this.loopDir;
                }
            }
        }

        // Balkenphasen & Sprite-Umlauf fortschalten
        const speedMul = isAfterglow ? 0.4 : 1.0;
        for (let g = 0; g < 3; g++) {
            const fg = lerp(0.16, 0.45, this.ten) * (1 + 0.12 * g) * speedMul;
            this.barPhase[g] += TWO_PI * fg * this.sinSign * dt;
        }

        const wPath = Math.max(1, w - bt);
        const hPath = Math.max(1, h - bt);
        const Lp = 2 * (wPath + hPath);
        const spriteSpeed = lerp(50, 120, this.ten) * speedMul;
        for (let i = 0; i < SPRITE_POOL_SIZE; i++) {
            const sp = this.sprites[i];
            if (!sp.active) continue;
            const step = spriteSpeed * dt;
            sp.sPos += this.loopDir * step;
            sp.dist += step;
            sp.age += dt;
            if (sp.dist >= Lp || sp.age >= 4.0) {
                sp.active = false;
            }
        }

        // ---------------------------------------------------------
        // 1. Zeilenfarbe lineColor[y] berechnen (für alle h Zeilen)
        // ---------------------------------------------------------
        this._ensureLineBuffer(h);
        const lc = this.lineColor;
        lc.fill(0);

        const nb = this.ten < 0.35 ? 1 : (this.ten < 0.70 ? 2 : 3);
        const thickScale = isAfterglow ? 0.6 : 1.0;

        for (let g = 0; g < 3; g++) {
            const phiG = (g * TWO_PI) / 3;
            const th = Math.max(1, Math.round(
                lerp(3, 6, this.ten) * (0.6 + 0.9 * this.ch[g]) * (1 + 0.2 * impulse) * thickScale
            ));

            const isSoft = this.softCoreVoice === g;
            const isMedCore = this.medCoreTimer > 0 && this.medVoice === g;
            const isMedBar = this.medBarTimer > 0 && this.medVoice === g;
            const isHardCore = this.hardCoreTimer > 0;

            for (let k = 0; k < nb; k++) {
                const yc = h * (0.5 + 0.42 * Math.sin(this.barPhase[g] + phiG + (k * TWO_PI) / nb))
                    + this.beatDir * 0.06 * h * impulse;
                const yStart = Math.max(0, Math.ceil(yc - th));
                const yEnd = Math.min(h - 1, Math.floor(yc + th));
                const ycInt = Math.round(yc);

                for (let y = yStart; y <= yEnd; y++) {
                    const u = Math.abs(y - yc) / th;
                    const ramp = this._voiceRampAt(g, y / h, isAfterglow);
                    const L = ramp.length;
                    // Basis-Peak bei L-3 damit soft (+1), medium (+2) & hard (Top L-1) deutlich abstufen
                    const basePeak = Math.max(1, L - 3);
                    let stepIdx = Math.round((1 - u) * basePeak);
                    if (stepIdx <= 0) continue;

                    if (isMedBar) stepIdx = Math.min(L - 1, stepIdx + 1);
                    if (y === ycInt) {
                        if (isHardCore) {
                            stepIdx = L - 1;
                        } else if (isMedCore) {
                            stepIdx = Math.min(L - 1, basePeak + 2);
                        } else if (isSoft) {
                            stepIdx = Math.min(L - 1, basePeak + 1);
                        }
                    }
                    lc[y] = ramp[stepIdx];
                }
            }
        }

        // ---------------------------------------------------------
        // 2. Rahmen zeichnen (strikt außerhalb [btEff..w-btEff) x [btEff..h-btEff))
        // ---------------------------------------------------------
        const shearActive = !isAfterglow && (state === 'climax' || this.ten > 0.70);

        // Oben & Unten (je btEff Zeilen)
        if (!shearActive) {
            // Obere & Untere Border als volle Zeilenstreifen
            for (let y = 0; y < btEff; y++) {
                ctx.fillStyle = HEX[lc[y]];
                fr(ctx, 0, y, w, 1, w, h);
            }
            for (let y = h - btEff; y < h; y++) {
                ctx.fillStyle = HEX[lc[y]];
                fr(ctx, 0, y, w, 1, w, h);
            }
        } else {
            // Climax Schrägstreifen in 16-px-Segmenten (mit horizontalem Run-Merging)
            const drawShearBand = (yStart, yStop) => {
                for (let y = yStart; y < yStop; y++) {
                    let segStart = 0;
                    let segColor = lc[(y + 0) % h];
                    for (let x = 16; x < w; x += 16) {
                        const c = lc[(y + (x >> 4) * 2) % h];
                        if (c !== segColor) {
                            ctx.fillStyle = HEX[segColor];
                            fr(ctx, segStart, y, x - segStart, 1, w, h);
                            segStart = x;
                            segColor = c;
                        }
                    }
                    ctx.fillStyle = HEX[segColor];
                    fr(ctx, segStart, y, w - segStart, 1, w, h);
                }
            };
            drawShearBand(0, btEff);
            drawShearBand(h - btEff, h);
        }

        // Links & Rechts für y in [btEff, h - btEff) mit vertikalem Run-Merging
        const sideTop = btEff;
        const sideBot = h - btEff;
        if (sideBot > sideTop) {
            let runY = sideTop;
            let runCol = lc[sideTop];
            for (let y = sideTop + 1; y <= sideBot; y++) {
                const c = y < sideBot ? lc[y] : -1;
                if (c !== runCol) {
                    const runH = y - runY;
                    ctx.fillStyle = HEX[runCol];
                    fr(ctx, 0, runY, btEff, runH, w, h);
                    fr(ctx, w - btEff, runY, btEff, runH, w, h);
                    runY = y;
                    runCol = c;
                }
            }
        }

        // ---------------------------------------------------------
        // 3. 1 px schwarze Innenkante auf dem innersten Rahmenpixel (4 fillRects)
        // ---------------------------------------------------------
        if (btEff >= 2 && w > btEff * 2 && h > btEff * 2) {
            ctx.fillStyle = HEX[0];
            const innerW = w - (btEff - 1) * 2;
            const innerSideH = h - btEff * 2;
            fr(ctx, btEff - 1, btEff - 1, innerW, 1, w, h);
            fr(ctx, btEff - 1, h - btEff, innerW, 1, w, h);
            if (innerSideH > 0) {
                fr(ctx, btEff - 1, btEff, 1, innerSideH, w, h);
                fr(ctx, w - btEff, btEff, 1, innerSideH, w, h);
            }
        }

        // ---------------------------------------------------------
        // 4. Open-Border Sprites (Pool <= 8) auf der Rahmenmittellinie
        // ---------------------------------------------------------
        const sScale = isStopping
            ? Math.max(0, Math.floor(Math.max(1, Math.floor(bt / 4)) * vis))
            : Math.max(1, Math.floor(bt / 4));
        if (sScale > 0) {
            const mid = bt * 0.5;
            for (let i = 0; i < SPRITE_POOL_SIZE; i++) {
                const sp = this.sprites[i];
                if (!sp.active) continue;
                const u = ((sp.sPos % Lp) + Lp) % Lp;
                let cx, cy;
                if (u < wPath) {
                    cx = mid + u;
                    cy = mid;
                } else if (u < wPath + hPath) {
                    cx = w - mid;
                    cy = mid + (u - wPath);
                } else if (u < 2 * wPath + hPath) {
                    cx = w - mid - (u - wPath - hPath);
                    cy = h - mid;
                } else {
                    cx = mid;
                    cy = h - mid - (u - 2 * wPath - hPath);
                }
                this._drawSprite(ctx, cx, cy, sScale, sp.colorHex, w, h);
            }
        }
    }
}