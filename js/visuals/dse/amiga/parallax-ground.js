// =========================================================
// DEMO-SCENE-ELEMENT: AMIGA PARALLAX GROUND (Floor)
// Dual-Playfield / Copper-Parallax-Boden mit 8 Tiefenbaendern
// ab horizon = floor(height * 0.55), 4 Themen mit kaskadierendem
// Wipe, Paula-Bandzonen (0..3), 8x10 Pixel-Art-Objekten und
// 50-Hz-Staubpartikeln.
// =========================================================

import { createXorshift32, bayerFadeCells } from '../../utils/hardware-constraints.js';
import {
    RAMPS,
    INK,
    SNOW,
    TRANSITION_IN,
    TRANSITION_OUT
} from './amiga-kit.js';

const NUM_BANDS = 8;
const OBJ_POOL_SIZE = 6;
const DUST_POOL_SIZE = 16;
const BAND_WEIGHT_SUM = 20.6; // sum_{i=0..7} (1 + 0.45 * i)

const THEME_RAMPS = Object.freeze(['JADE', 'STEEL', 'GOLD', 'OCEAN']);
const FALLBACK_TENSION = Object.freeze({
    playing: 0.30,
    buildup: 0.65,
    climax: 1.0,
    afterglow: 0.20
});

// 8x10 Bitmaps je Thema: '.' transparent, '#' INK, '1' dunkel, '2' mittel, '3' hell/Spitze
const OBJECT_SPRITES = Object.freeze([
    // 0: Wiese - Holzpfosten / Wegweiser
    Object.freeze([
        '..####..',
        '.#3322#.',
        '.#2221#.',
        '..####..',
        '...#2#..',
        '...#2#..',
        '...#1#..',
        '...#1#..',
        '..#111#.',
        '.#######'
    ]),
    // 1: Fels - Moosiger Findling
    Object.freeze([
        '..####..',
        '.#3322#.',
        '#322211#',
        '#222111#',
        '#221111#',
        '#111111#',
        '#111111#',
        '#111111#',
        '.######.',
        '........'
    ]),
    // 2: Sand - Wuestenbusch / Kaktus
    Object.freeze([
        '...##...',
        '..#32#..',
        '.##22#..',
        '#3222#..',
        '#2122##.',
        '.##2232#',
        '..#2121#',
        '..#11##.',
        '..#11#..',
        '.######.'
    ]),
    // 3: Schnee - Eiskristall-Monolith
    Object.freeze([
        '...##...',
        '..#33#..',
        '.#3322#.',
        '.#3221#.',
        '#322111#',
        '#222111#',
        '#221111#',
        '#111111#',
        '.######.',
        '........'
    ])
]);

const clamp01 = (v) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
const lerp = (a, b, k) => a + (b - a) * k;

export class AmigaParallaxGround {
    constructor() {
        this.name = 'Amiga Parallax Ground';

        // Zeit- und Zustandsverfolgung
        this.lastT = null;
        this.simTime = 0;
        this.lastState = 'idle';
        this.stateAge = 0;
        this.palAcc = 0;

        // Kontinuierliche Simulation (bleibt bei Resize/Rotation erhalten)
        this.scroll = new Float64Array(NUM_BANDS);
        this.ten = 0.2;
        this.dirTarget = 1;
        this.dirSlew = 1;

        // Diskreter Beat- und Themenzustand
        this.lastBeatCount = 0;
        this.hardCooldown = 0;
        this.theme = 0;
        this.themePrev = 0;
        this.themeWipeT0 = -10;

        // Beat-Sondereffekte
        this.softLineTimer = 0;
        this.softLineBand = 0;
        this.medFlashTimer = 0;
        this.quakeTimer = 0;

        // Instanzeigener Xorshift32 (kein Math.random)
        this.rng = createXorshift32(0x414d4947);

        // Feste Pools (Objekte max 6, Staub max 16)
        this.objects = new Array(OBJ_POOL_SIZE);
        for (let i = 0; i < OBJ_POOL_SIZE; i++) {
            this.objects[i] = { active: false, band: 4, x: 0, theme: 0 };
        }
        this.objSpawnTimer = 0.4;

        this.dust = new Array(DUST_POOL_SIZE);
        for (let i = 0; i < DUST_POOL_SIZE; i++) {
            this.dust[i] = { active: false, x: 0, y: 0, vx: 0, vy: 0, age: 0, maxLife: 0.4 };
        }

        // Band-Layout-Puffer
        this.bandY = new Int16Array(NUM_BANDS);
        this.bandH = new Int16Array(NUM_BANDS);
        this.lastActiveObjects = 0;
        this.lastActiveDust = 0;
    }

    resize() {
        // Bandhoehen berechnen sich direkt aus (width, height);
        // Scroll-Offsets, Thema, Objekte und Staub bleiben erhalten.
    }

    _computeBands(horizon, h) {
        const H = h - horizon;
        let curY = horizon;
        for (let i = 0; i < NUM_BANDS; i++) {
            this.bandY[i] = curY;
            if (i === NUM_BANDS - 1) {
                this.bandH[i] = Math.max(0, h - curY);
            } else {
                const remain = (NUM_BANDS - 1) - i;
                const w_i = 1 + 0.45 * i;
                let bh = Math.round((H * w_i) / BAND_WEIGHT_SUM);
                if (bh < 1) bh = 1;
                if (curY + bh > h - remain) {
                    bh = Math.max(0, h - curY - remain);
                }
                this.bandH[i] = bh;
                curY += bh;
            }
        }
    }

    _spawnObject(w, dirSign, theme) {
        let slot = -1;
        for (let i = 0; i < OBJ_POOL_SIZE; i++) {
            if (!this.objects[i].active) {
                slot = i;
                break;
            }
        }
        if (slot === -1) return;

        const band = 4 + this.rng.int(4); // Baender 4..7
        const spawnX = dirSign >= 0 ? w + 12 : -20;

        // Mindestabstand 40px auf demselben Band pruefen
        for (let i = 0; i < OBJ_POOL_SIZE; i++) {
            const o = this.objects[i];
            if (o.active && o.band === band && Math.abs(o.x - spawnX) < 40) {
                return;
            }
        }

        const obj = this.objects[slot];
        obj.active = true;
        obj.band = band;
        obj.x = spawnX;
        obj.theme = theme;
    }

    _spawnDust(count, w, dirSign, v0) {
        let spawned = 0;
        for (let i = 0; i < DUST_POOL_SIZE && spawned < count; i++) {
            const p = this.dust[i];
            if (p.active) continue;

            const band = 6 + this.rng.int(2); // Baender 6..7
            const fBand = 0.15 + 0.85 * Math.pow((band + 1) / NUM_BANDS, 1.5);
            p.active = true;
            p.x = this.rng.float() * Math.max(1, w - 1);
            p.y = this.bandY[band];
            p.vx = -dirSign * v0 * fBand * 0.4 + (this.rng.float() - 0.5) * 14;
            p.vy = -(20 + this.rng.float() * 30);
            p.age = 0;
            p.maxLife = 0.28 + this.rng.float() * 0.22; // <= 0.5s
            spawned++;
        }
    }

    _stepPhysics(dt, w, horizon, objMax, allowSpawn, v0) {
        // Vorhandene Objekte bewegen (scrollt auch bei Afterglow aus)
        for (let i = 0; i < OBJ_POOL_SIZE; i++) {
            const o = this.objects[i];
            if (!o.active) continue;
            const n_i = (o.band + 1) / NUM_BANDS;
            const f_i = 0.15 + 0.85 * Math.pow(n_i, 1.5);
            o.x -= this.dirSlew * v0 * f_i * dt;
            if (o.x < -32 || o.x > w + 32) {
                o.active = false;
            }
        }

        // Neue Objekte spawnen (nur ausserhalb Afterglow/Stopping bis objMax)
        if (allowSpawn && objMax > 0) {
            let activeObjs = 0;
            for (let i = 0; i < OBJ_POOL_SIZE; i++) {
                if (this.objects[i].active) activeObjs++;
            }
            this.objSpawnTimer -= dt;
            if (this.objSpawnTimer <= 0) {
                if (activeObjs < objMax) {
                    this._spawnObject(w, this.dirSlew >= 0 ? 1 : -1, this.theme);
                }
                this.objSpawnTimer = 0.45 + this.rng.float() * 0.65;
            }
        }

        // Staubpartikel integrieren
        for (let i = 0; i < DUST_POOL_SIZE; i++) {
            const p = this.dust[i];
            if (!p.active) continue;
            p.age += dt;
            if (p.age >= p.maxLife) {
                p.active = false;
                continue;
            }
            p.vy += 120 * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if (p.y < horizon) {
                p.y = horizon;
                if (p.vy < 0) p.vy = 0;
            }
        }
    }

    _drawFoliageTile(ctx, fr, x, yBase, tw, th, worldK, theme, stemHex, tipHex, lean, maxH) {
        const clampedTh = Math.min(th, maxH);
        if (clampedTh < 1) return;

        if (theme === 0) {
            // Wiese: 2 Halme mit Neigung
            const h1 = Math.max(1, Math.floor(clampedTh * 0.6));
            const hTip = clampedTh - h1;
            ctx.fillStyle = stemHex;
            fr(x, yBase - h1, 1, h1);
            if (hTip > 0) {
                ctx.fillStyle = tipHex;
                fr(x + lean, yBase - clampedTh, 1, hTip);
            }
            const x2 = x + Math.max(2, Math.floor(tw * 0.42)) + Math.round(lean * 0.5);
            const h2 = Math.max(1, Math.round(clampedTh * 0.68));
            ctx.fillStyle = tipHex;
            fr(x2, yBase - h2, 1, h2);
            return;
        }

        if (theme === 1) {
            // Fels: gestockter Block mit heller Oberkante
            const fw = Math.max(3, Math.round(tw * 0.48));
            const hBase = Math.max(1, Math.floor(clampedTh * 0.6));
            ctx.fillStyle = stemHex;
            fr(x, yBase - hBase, fw, hBase);
            ctx.fillStyle = tipHex;
            fr(x + 1, yBase - clampedTh, Math.max(1, fw - 2), Math.max(1, clampedTh - hBase + 1));
            return;
        }

        if (theme === 2) {
            // Sand: zweistufige Duene
            const w1 = Math.max(4, Math.round(tw * 0.72));
            const h1 = Math.max(1, Math.floor(clampedTh * 0.55));
            ctx.fillStyle = stemHex;
            fr(x, yBase - h1, w1, h1);
            const w2 = Math.max(2, Math.round(tw * 0.36));
            const off2 = Math.round(tw * 0.16) + Math.round(lean * 0.4);
            ctx.fillStyle = tipHex;
            fr(x + off2, yBase - clampedTh, w2, Math.max(1, clampedTh - h1 + 1));
            return;
        }

        // Schnee: kleiner Hang + 3x3-Eiskristall in SNOW
        const sw = Math.max(3, Math.round(tw * 0.5));
        const sh = Math.max(1, clampedTh - 2);
        ctx.fillStyle = stemHex;
        fr(x + 1, yBase - sh, sw, sh);
        const cx = x + Math.floor(sw * 0.5) + 1;
        const cy = yBase - clampedTh + 1;
        ctx.fillStyle = SNOW;
        fr(cx - 1, cy, 3, 1);
        fr(cx, cy - 1, 1, 3);
    }

    _drawObjectSprite(ctx, fr, x0, yBottom, scale, ramp, theme) {
        const sprite = OBJECT_SPRITES[theme];
        const rows = 10;
        const topY = yBottom - rows * scale;
        const tipCol = theme === 3 ? SNOW : ramp[5];

        for (let r = 0; r < rows; r++) {
            const line = sprite[r];
            let c = 0;
            while (c < 8) {
                const ch = line[c];
                if (ch === '.') {
                    c++;
                    continue;
                }
                let end = c + 1;
                while (end < 8 && line[end] === ch) end++;

                ctx.fillStyle = ch === '#'
                    ? INK
                    : (ch === '1' ? ramp[1] : (ch === '2' ? ramp[3] : tipCol));
                fr(x0 + c * scale, topY + r * scale, (end - c) * scale, scale);
                c = end;
            }
        }
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
        this.softLineTimer = Math.max(0, this.softLineTimer - dt);
        this.medFlashTimer = Math.max(0, this.medFlashTimer - dt);
        this.quakeTimer = Math.max(0, this.quakeTimer - dt);

        // Sichtbarkeit & harter Horizont-Schnitt
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

        const horizon = Math.floor(h * 0.55);
        const H = h - horizon;
        if (H <= 0) return;

        this._computeBands(horizon, h);

        // Defensives Metrik-Parsing (ohne Audio lebendig)
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
        const isAfterglow = state === 'afterglow';
        const allowDiscrete = !isAfterglow && state !== 'stopping';
        const v0 = lerp(10, 70, this.ten) * (isAfterglow ? 0.25 : 1.0);

        if (onBeat && allowDiscrete) {
            if (level === 1) {
                this.softLineTimer = 0.1;
                this.softLineBand = Math.min(NUM_BANDS - 1, loudestCh * 2 + 1);
            } else if (level === 2) {
                this.medFlashTimer = 0.15;
                this._spawnDust(4, w, this.dirSlew >= 0 ? 1 : -1, v0);
            } else if (level === 3) {
                if (this.hardCooldown <= 0) {
                    this.quakeTimer = 0.1;
                    this._spawnDust(12, w, this.dirSlew >= 0 ? 1 : -1, v0);
                    this.hardCooldown = 0.25;
                }
            }

            if (count > 0 && count % 4 === 0) {
                this.themePrev = this.theme;
                this.theme = (this.theme + 1) & 3;
                this.themeWipeT0 = this.simTime;
            }
            if (count > 0 && count % 8 === 0) {
                this.dirTarget = -this.dirTarget;
            }
        }

        // ---------------------------------------------------------
        // Scroll-, Slew- und 50-Hz-Physikschritte
        // ---------------------------------------------------------
        if (this.dirSlew !== this.dirTarget) {
            const maxStep = (2 * dt) / 0.4;
            const diff = this.dirTarget - this.dirSlew;
            this.dirSlew = Math.abs(diff) <= maxStep ? this.dirTarget : this.dirSlew + Math.sign(diff) * maxStep;
        }

        const scrollMul = this.dirSlew * v0 * (1 + 0.9 * impulse) * dt;
        for (let i = 0; i < NUM_BANDS; i++) {
            const n_i = (i + 1) / NUM_BANDS;
            const f_i = 0.15 + 0.85 * Math.pow(n_i, 1.5);
            this.scroll[i] += scrollMul * f_i;
        }

        const objMax = isAfterglow || state === 'stopping'
            ? 0
            : (this.ten < 0.35 ? 0 : (this.ten < 0.70 ? 3 : 6));
        const allowSpawn = !isAfterglow && state !== 'stopping' && state !== 'starting';

        this.palAcc += dt;
        let steps = 0;
        while (this.palAcc >= 0.02 && steps++ < 4) {
            this._stepPhysics(0.02, w, horizon, objMax, allowSpawn, v0 * (1 + 0.9 * impulse));
            this.palAcc -= 0.02;
        }

        // ---------------------------------------------------------
        // Clipping-Helfer: hart auf [0..w] x [horizon..h]
        // ---------------------------------------------------------
        const fr = (rx, ry, rw, rh) => {
            const x0 = Math.max(0, Math.round(rx));
            const y0 = Math.max(horizon, Math.round(ry));
            const x1 = Math.min(w, Math.round(rx + rw));
            const y1 = Math.min(h, Math.round(ry + rh));
            const fw = x1 - x0;
            const fh = y1 - y0;
            if (fw > 0 && fh > 0) {
                ctx.fillRect(x0, y0, fw, fh);
            }
        };

        const minDim = Math.min(w, h);
        const twScale = Math.min(1.4, Math.max(0.6, minDim / 200));
        const wind = isAfterglow ? 0.5 : lerp(0.5, 3.0, this.ten);
        const isClimax = state === 'climax';
        const bVis = (state === 'starting' || state === 'stopping')
            ? Math.min(NUM_BANDS, Math.max(0, Math.ceil(NUM_BANDS * vis)))
            : NUM_BANDS;

        const wipeElapsed = this.simTime - this.themeWipeT0;
        const hasQuake = this.quakeTimer > 0;
        const medFlash = this.medFlashTimer > 0;

        // ---------------------------------------------------------
        // Baender von fern (0) nach nah (bVis - 1) zeichnen
        // ---------------------------------------------------------
        for (let i = 0; i < bVis; i++) {
            const by = this.bandY[i];
            const bh = this.bandH[i];
            if (bh <= 0) continue;

            const n_i = (i + 1) / NUM_BANDS;
            const chIdx = i >> 1; // 0-1->0, 2-3->1, 4-5->2, 6-7->3
            const chVal = ch[chIdx];

            // Kaskadierender Themen-Wipe (70ms Versatz pro Band, 0.25s Kantenlauf R->L)
            const localAge = wipeElapsed - i * 0.07;
            let sweepX = -1;
            let bandThemeA = this.theme;
            let bandThemeB = this.theme;
            if (localAge <= 0) {
                bandThemeA = this.themePrev;
                bandThemeB = this.themePrev;
                sweepX = w + 1;
            } else if (localAge < 0.25) {
                bandThemeA = this.themePrev;
                bandThemeB = this.theme;
                sweepX = Math.round(w * (1 - localAge / 0.25));
            }

            const resolveBandRampName = (tId) => {
                if (isAfterglow) return i < 4 ? 'STEEL' : 'OCEAN';
                if (isClimax && i < 4) return 'MAGMA';
                return THEME_RAMPS[tId];
            };

            let baseLvl = 1 + Math.floor(n_i * 2.99);
            if (medFlash && i >= 6) baseLvl = Math.min(4, baseLvl + 1);
            const litLvl = Math.min(5, baseLvl + 1);
            const topH = Math.max(1, Math.round(bh * 0.35));
            const restH = bh - topH;

            // Bandhintergrund (bei aktivem Band-Wipe gesplittet)
            const rampA = RAMPS[resolveBandRampName(bandThemeA)];
            if (sweepX <= 0) {
                const rampB = RAMPS[resolveBandRampName(bandThemeB)];
                ctx.fillStyle = rampB[litLvl];
                fr(0, by, w, topH);
                if (restH > 0) {
                    ctx.fillStyle = rampB[baseLvl];
                    fr(0, by + topH, w, restH);
                }
            } else if (sweepX >= w) {
                ctx.fillStyle = rampA[litLvl];
                fr(0, by, w, topH);
                if (restH > 0) {
                    ctx.fillStyle = rampA[baseLvl];
                    fr(0, by + topH, w, restH);
                }
            } else {
                const rampB = RAMPS[resolveBandRampName(bandThemeB)];
                ctx.fillStyle = rampA[litLvl];
                fr(0, by, sweepX, topH);
                ctx.fillStyle = rampB[litLvl];
                fr(sweepX, by, w - sweepX, topH);
                if (restH > 0) {
                    ctx.fillStyle = rampA[baseLvl];
                    fr(0, by + topH, sweepX, restH);
                    ctx.fillStyle = rampB[baseLvl];
                    fr(sweepX, by + topH, w - sweepX, restH);
                }
            }

            // Soft-Beat-Kante (1px Top-Stufe am Band der staerksten Stimme)
            if (this.softLineTimer > 0 && i === this.softLineBand) {
                const softRamp = RAMPS[resolveBandRampName(sweepX <= 0 ? bandThemeB : bandThemeA)];
                ctx.fillStyle = softRamp[5];
                fr(0, by, w, 1);
            }

            // Bewuchs je Welt-Kachel (stabile Neigung pro worldK)
            const tw = Math.max(6, Math.round(lerp(10, 44, n_i) * twScale));
            const th = Math.max(2, Math.round(bh * 0.5 * (0.7 + 0.9 * chVal)) + Math.round(2 * impulse));
            const quakeDy = hasQuake ? ((i & 1) === 0 ? 1 : -1) : 0;
            // Band 0 sitzt am Horizont: Basis in das Band einruecken, damit Halme unter y>=horizon sichtbar bleiben
            const yBase = i === 0
                ? by + Math.min(th, Math.max(2, Math.floor(bh * 0.65))) + quakeDy
                : by + quakeDy;
            const maxFoliageH = Math.max(1, yBase - horizon);

            const firstWorldK = Math.floor(this.scroll[i] / tw) - 1;
            const numTiles = Math.ceil(w / tw) + 3;
            const tipLvl = Math.min(5, baseLvl + 1 + (chVal >= 0.6 ? 1 : 0));

            for (let j = 0; j < numTiles; j++) {
                const worldK = firstWorldK + j;
                const tx = Math.round(worldK * tw - this.scroll[i]);
                if (tx + tw < -4 || tx > w + 4) continue;

                const tUse = (sweepX >= 0 && tx >= sweepX) ? bandThemeB : bandThemeA;
                const tRamp = RAMPS[resolveBandRampName(tUse)];
                const lean = Math.round(Math.sin(1.7 * this.simTime + 0.9 * worldK) * wind);

                this._drawFoliageTile(
                    ctx, fr, tx, yBase, tw, th, worldK, tUse,
                    tRamp[baseLvl], tRamp[tipLvl], lean, maxFoliageH
                );
            }

            // Objekte auf diesem Band (Pool 6, 8x10 Bitmaps mit 1px INK-Kontur)
            if (i >= 4) {
                const objScale = (n_i >= 0.85 && minDim >= 180) ? 2 : 1;
                for (let oIdx = 0; oIdx < OBJ_POOL_SIZE; oIdx++) {
                    const o = this.objects[oIdx];
                    if (!o.active || o.band !== i) continue;
                    const oRamp = RAMPS[resolveBandRampName(o.theme)];
                    this._drawObjectSprite(
                        ctx, fr, Math.round(o.x), by + topH + quakeDy, objScale, oRamp, o.theme
                    );
                }
            }
        }

        // Staubpartikel (Pool 16, GOLD Stufe 3, strikt auf y >= horizon)
        let activeDust = 0;
        ctx.fillStyle = RAMPS.GOLD[3];
        for (let i = 0; i < DUST_POOL_SIZE; i++) {
            const p = this.dust[i];
            if (!p.active) continue;
            activeDust++;
            fr(Math.round(p.x), Math.round(p.y), 1, 1);
        }

        let activeObjs = 0;
        for (let i = 0; i < OBJ_POOL_SIZE; i++) {
            if (this.objects[i].active) activeObjs++;
        }
        this.lastActiveObjects = activeObjs;
        this.lastActiveDust = activeDust;

        // Bayer-Fade nur unterhalb des Horizonts
        if (vis < 1) {
            bayerFadeCells(ctx, 0, horizon, w, H, vis, 2, INK);
        }
    }
}