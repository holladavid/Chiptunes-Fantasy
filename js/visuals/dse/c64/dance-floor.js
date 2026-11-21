// === js/visuals/dse/c64/dance-floor.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: C64 DANCE FLOOR (FLOOR)
// VIC-II Color-RAM Kachelboden unterhalb horizon = floor(0.55 * h):
// 9 perspektivische Reihen x 61 Kachelspalten bis direkt an den Horizont,
// 50-Hz-Musterengine (Chase, Stimmen-Wasserfall, Ripple-Pool 3,
// Suchscheinwerfer), 3 SID-Stimmenzonen, Climax-Regenbogenreihen & 2-Hz-Takt.
// =========================================================

import {
    C64_PALETTE,
    rgbToHex,
    createXorshift32,
    bayerFadeCells
} from '../../utils/hardware-constraints.js';

const HEX = Object.freeze(C64_PALETTE.map(([r, g, b]) => rgbToHex(r, g, b)));

// Luminanz-Rampen aus §3
const RAMP = Object.freeze({
    BLUE: Object.freeze([0, 6, 14, 3, 1]),
    PURPLE: Object.freeze([0, 6, 4, 10, 1]),
    GREEN: Object.freeze([0, 11, 5, 13, 1]),
    FIRE: Object.freeze([0, 9, 2, 8, 7, 1])
});

// Familienreihenfolge gemäß §5.0 (Index 0 = BLUE als Start/Afterglow)
const FAM = Object.freeze([RAMP.BLUE, RAMP.PURPLE, RAMP.GREEN, RAMP.FIRE]);
const LVL_IDX_5 = Object.freeze([0, 1, 2, 3, 4]);
const LVL_IDX_6 = Object.freeze([0, 1, 2, 4, 5]);

const T_IN = 1.5;
const T_OUT = 1.5;
const WIPE_DURATION = 0.6;
const BEATLESS_PENDING_TIMEOUT = 1.2;
const HARD_COOLDOWN = 0.25;
const FIXED_STEP = 0.02;

const ROWS = 9;          // j = 0 (vorne) .. 8 (hinten bis an horizon)
const HALF_COLS = 30;    // i in [-30 .. +30]
const NC = HALF_COLS * 2 + 1; // 61
const RIPPLE_POOL_SIZE = 3;

// Projektive Normierung: z_j = 1 + j * 0.45 wird lückenlos auf [0 .. H) abgebildet
const P_MIN = 1.0 / (1.0 + ROWS * 0.45);
const INV_P_SPAN = 1.0 / (1.0 - P_MIN);

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

function fr(ctx, x, y, w, h, bufW, minY, bufH) {
    let x0 = Math.round(x);
    let y0 = Math.round(y);
    let x1 = Math.round(x + w);
    let y1 = Math.round(y + h);
    if (x0 < 0) x0 = 0;
    if (y0 < minY) y0 = minY;
    if (x1 > bufW) x1 = bufW;
    if (y1 > bufH) y1 = bufH;
    const cw = x1 - x0;
    const ch = y1 - y0;
    if (cw > 0 && ch > 0) {
        ctx.fillRect(x0, y0, cw, ch);
    }
}

function tileColorHex(famIdx, lvl, impBoost, isAfterglow) {
    if (lvl <= 0) {
        return HEX[isAfterglow ? 6 : 11];
    }
    const ramp = FAM[famIdx];
    const map = ramp.length === 6 ? LVL_IDX_6 : LVL_IDX_5;
    let dispLvl = lvl;
    if (lvl >= 2 && impBoost > 0) {
        dispLvl = Math.min(4, lvl + impBoost);
    }
    return HEX[ramp[map[dispLvl]]];
}

export class C64DanceFloor {
    constructor() {
        this.name = 'C64 Dance Floor';

        this.lastT = null;
        this.lastState = 'idle';
        this.stateAge = 0;
        this.simT = 0;
        this.ten = 0.30;
        this.acc = 0;

        // Kachel-Matrix 61 x 9 (Werte 0..4), Instanzbesitz
        this.lvl = new Uint8Array(NC * ROWS);

        // Beat- & Muster-Zustand (-1 schützt beatCount === 0)
        this.lastBeatCount = -1;
        this.beatSeqCount = 0;
        this.pat = 0; // 0: Chase, 1: Wasserfall, 2: Ripple, 3: Suchscheinwerfer
        this.hardCooldown = 0;
        this.timeSinceBeat = 0;
        this.internalClockAcc = 0;
        this.internalBeatTick = 0;

        // 50-Hz-Schrittzähler
        this.decayTick = 0;
        this.waterfallTick = 0;
        this.sparkleTick = 0;
        this.phi0 = 0.35;

        // Familien & Wipe
        this.fam = 0; // Start: BLUE
        this.savedFam = 0;
        this.wipeFrom = 0;
        this.wipeTo = 0;
        this.wipeActive = false;
        this.wipeElapsed = 0;
        this.pendingFamily = -1;
        this.pendingTimer = 0;

        // Fester Ripple-Pool (max 3) & PRNG
        this.rng = createXorshift32(0x44414E43); // 'DANC'
        this.ripples = Array.from({ length: RIPPLE_POOL_SIZE }, () => ({
            active: false,
            radius: 0,
            amp: 2
        }));

        // Aktuelle Viewport-Abmessung für Zonen-Sparkles
        this.lastWidth = 320;
        this.lastHeight = 200;
        this.lastImpulse = 0;
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

    _setTileMax(colOffset, row, val) {
        if (colOffset < -HALF_COLS || colOffset > HALF_COLS || row < 0 || row >= ROWS) return;
        const idx = row * NC + (colOffset + HALF_COLS);
        const clamped = val > 4 ? 4 : (val < 0 ? 0 : val);
        if (clamped > this.lvl[idx]) {
            this.lvl[idx] = clamped;
        }
    }

    _zoneForTile(colOffset, row, w, wb) {
        const pMid = 1.0 / (1.0 + (row + 0.5) * 0.45);
        const xScreen = w * 0.5 + colOffset * wb * pMid;
        if (xScreen < w / 3) return 0;
        if (xScreen < (2 * w) / 3) return 1;
        return 2;
    }

    _visibleColBounds(row, w, wb) {
        const pMid = 1.0 / (1.0 + (row + 0.5) * 0.45);
        const tileW = Math.max(1, wb * pMid);
        return Math.min(HALF_COLS, Math.max(1, Math.ceil((w * 0.5) / tileW)));
    }

    _spawnRipple(amp) {
        let slot = -1;
        let maxR = -1;
        let oldestIdx = 0;
        for (let i = 0; i < RIPPLE_POOL_SIZE; i++) {
            if (!this.ripples[i].active) {
                slot = i;
                break;
            }
            if (this.ripples[i].radius > maxR) {
                maxR = this.ripples[i].radius;
                oldestIdx = i;
            }
        }
        const target = slot !== -1 ? this.ripples[slot] : this.ripples[oldestIdx];
        target.active = true;
        target.radius = 0;
        target.amp = amp;
    }

    _applyChase(phaseCount, cappedAmp) {
        const targetPhase = ((phaseCount % 4) + 4) % 4;
        for (let j = 0; j < ROWS; j++) {
            for (let i = -HALF_COLS; i <= HALF_COLS; i++) {
                if (((((i + j) % 4) + 4) % 4) === targetPhase) {
                    this._setTileMax(i, j, cappedAmp);
                }
            }
        }
    }

    _applySearchlight(cappedAmp) {
        const phi = this.phi0 + 0.6 * (1 + this.ten) * this.simT;
        const s = Math.sin(phi);
        const c = Math.cos(phi);
        const targetVal = Math.min(cappedAmp, 3);
        for (let j = 0; j < ROWS; j++) {
            const dj = j - 3;
            for (let i = -HALF_COLS; i <= HALF_COLS; i++) {
                if (Math.abs(i * s - dj * c) < 0.7) {
                    this._setTileMax(i, j, targetVal);
                }
            }
        }
    }

    _triggerSparkles(zone, count, targetVal) {
        const wb = Math.max(8, Math.round(Math.min(this.lastWidth, 1.6 * this.lastHeight) / 8));
        for (let n = 0; n < count; n++) {
            const row = this.rng.int(ROWS);
            const maxOff = this._visibleColBounds(row, this.lastWidth, wb);
            let colMin = -maxOff;
            let colMax = maxOff;
            if (zone === 0) {
                colMax = Math.max(-maxOff, Math.floor(-maxOff / 3));
            } else if (zone === 1) {
                colMin = Math.floor(-maxOff / 3);
                colMax = Math.ceil(maxOff / 3);
            } else {
                colMin = Math.min(maxOff, Math.ceil(maxOff / 3));
            }
            const span = Math.max(1, colMax - colMin + 1);
            const col = colMin + this.rng.int(span);
            this._setTileMax(col, row, targetVal);
        }
    }

    _applyBeatPattern(level, phaseIndex, isAfterglow, state) {
        const lvlCap = isAfterglow ? 2 : (this.ten < 0.35 ? 2 : (this.ten < 0.70 ? 3 : 4));
        const rawAmp = level === 1 ? 2 : (level === 2 ? 3 : 4);
        const cappedAmp = Math.min(rawAmp, lvlCap);

        if (this.pat === 0) {
            this._applyChase(phaseIndex, cappedAmp);
        } else if (this.pat === 1) {
            const wb = Math.max(8, Math.round(Math.min(this.lastWidth, 1.6 * this.lastHeight) / 8));
            const maxOff = this._visibleColBounds(0, this.lastWidth, wb);
            for (let i = -maxOff; i <= maxOff; i++) {
                this._setTileMax(i, 0, cappedAmp);
            }
        } else if (this.pat === 2) {
            this._spawnRipple(cappedAmp);
            this._setTileMax(0, 2, cappedAmp);
        } else {
            this.phi0 += 0.15 * level;
            this._applySearchlight(Math.max(cappedAmp, Math.min(lvlCap, 3)));
        }

        // Climax Doppelmuster: zusätzlich Diagonal-Chase auf jedem Beat
        if (!isAfterglow && (state === 'climax' || this.ten > 0.70) && this.pat !== 0) {
            this._applyChase(phaseIndex, cappedAmp);
        }

        // Level-spezifische Akzente
        if (level === 2 && !isAfterglow) {
            let bestZone = 0;
            if (this.ch[1] > this.ch[bestZone]) bestZone = 1;
            if (this.ch[2] > this.ch[bestZone]) bestZone = 2;
            this._triggerSparkles(bestZone, 6, Math.min(3, lvlCap));
        } else if (level === 3 && !isAfterglow && this.hardCooldown <= 0) {
            this.hardCooldown = HARD_COOLDOWN;
            const wb = Math.max(8, Math.round(Math.min(this.lastWidth, 1.6 * this.lastHeight) / 8));
            const edge = Math.min(HALF_COLS, Math.max(2, Math.floor((this.lastWidth * 0.5) / wb)));
            const cornerLvl = Math.min(4, Math.max(lvlCap, 3));
            this._setTileMax(-edge, 0, cornerLvl);
            this._setTileMax(-edge + 1, 0, cornerLvl);
            this._setTileMax(edge - 1, 0, cornerLvl);
            this._setTileMax(edge, 0, cornerLvl);
        }
    }

    _step50Hz(state, isAfterglow) {
        this.simT += FIXED_STEP * (isAfterglow ? 0.35 : 1.0);
        this.timeSinceBeat += FIXED_STEP;

        const lvlCap = isAfterglow ? 2 : (this.ten < 0.35 ? 2 : (this.ten < 0.70 ? 3 : 4));

        // 1. Zerfall alle decayEvery Schritte
        const decayEvery = isAfterglow ? 10 : (this.ten < 0.35 ? 8 : (this.ten < 0.70 ? 6 : 5));
        this.decayTick++;
        if (this.decayTick >= decayEvery) {
            this.decayTick = 0;
            for (let k = 0; k < this.lvl.length; k++) {
                if (this.lvl[k] > 0) this.lvl[k]--;
            }
        }

        // 2. Muster-spezifische kontinuierliche Schritte
        if (this.pat === 1) {
            // Stimmen-Wasserfall: alle 5 Schritte Reihen nach hinten schieben
            this.waterfallTick++;
            if (this.waterfallTick >= 5) {
                this.waterfallTick = 0;
                for (let j = ROWS - 1; j >= 1; j--) {
                    const dst = j * NC;
                    const src = (j - 1) * NC;
                    for (let c = 0; c < NC; c++) {
                        this.lvl[dst + c] = this.lvl[src + c];
                    }
                }
                const wb = Math.max(8, Math.round(Math.min(this.lastWidth, 1.6 * this.lastHeight) / 8));
                for (let i = -HALF_COLS; i <= HALF_COLS; i++) {
                    const zone = this._zoneForTile(i, 0, this.lastWidth, wb);
                    const val = Math.min(lvlCap, Math.round(this.ch[zone] * 4));
                    this.lvl[i + HALF_COLS] = val;
                }
            }
        } else if (this.pat === 2) {
            // Ripple-Pool expandieren
            for (let r = 0; r < RIPPLE_POOL_SIZE; r++) {
                const rp = this.ripples[r];
                if (!rp.active) continue;
                rp.radius += 9.0 * FIXED_STEP;
                const cap = Math.min(rp.amp, lvlCap);
                for (let j = 0; j < ROWS; j++) {
                    const dj = j - 2;
                    for (let i = -HALF_COLS; i <= HALF_COLS; i++) {
                        if (Math.abs(Math.hypot(i, dj) - rp.radius) < 0.6) {
                            this._setTileMax(i, j, cap);
                        }
                    }
                }
                if (rp.radius > 34) {
                    rp.active = false;
                }
            }
        } else if (this.pat === 3) {
            this._applySearchlight(Math.min(3, lvlCap));
        }

        // 3. Funkeln (alle Muster) alle 4 Schritte je SID-Stimme
        this.sparkleTick++;
        if (this.sparkleTick >= 4) {
            this.sparkleTick = 0;
            const sparkScale = isAfterglow ? 0.3 : 1.0;
            const sparkVal = Math.min(3, lvlCap);
            for (let v = 0; v < 3; v++) {
                const rawN = Math.floor(this.ch[v] * 3 + 0.4);
                const n = isAfterglow ? (this.rng.float() < sparkScale ? (rawN > 0 ? 1 : 0) : 0) : rawN;
                if (n > 0) {
                    this._triggerSparkles(v, n, sparkVal);
                }
            }
        }

        // 4. Interner 2-Hz-Takt ohne beatStarted seit > 1.2 s (wechselt nie Muster)
        if (this.timeSinceBeat > 1.2 && state !== 'stopping') {
            this.internalClockAcc += FIXED_STEP;
            if (this.internalClockAcc >= 0.5) {
                this.internalClockAcc -= 0.5;
                this.internalBeatTick++;
                this._applyBeatPattern(1, this.beatSeqCount + this.internalBeatTick, isAfterglow, state);
            }
        } else {
            this.internalClockAcc = 0;
        }
    }

    resize() {
        // Alle Perspektivkoordinaten leiten sich direkt aus (w, h) ab;
        // Kachelzustand lvl, Pattern & Ripple-Pool bleiben beim Resize erhalten.
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

        this.lastWidth = w;
        this.lastHeight = h;

        let dt = this.lastT === null ? FIXED_STEP : (safeT - this.lastT);
        this.lastT = safeT;
        if (!Number.isFinite(dt) || dt < 0) {
            dt = FIXED_STEP;
        } else if (dt > 0.1) {
            dt = 0.1;
        }

        const prevState = this.lastState;
        if (prevState !== state) {
            this.lastState = state;
            this.stateAge = 0;
            if (state === 'afterglow') {
                if (prevState === 'idle' || prevState === 'starting') {
                    this.fam = 0; // BLUE
                    this.wipeTo = 0;
                    this.wipeActive = false;
                    this.pendingFamily = -1;
                } else {
                    this.savedFam = this.wipeActive ? this.wipeTo : this.fam;
                    if ((this.wipeActive ? this.wipeTo : this.fam) !== 0) {
                        this.pendingFamily = 0;
                        this.pendingTimer = 0;
                    }
                }
            } else if (prevState === 'afterglow' && state !== 'stopping') {
                const returnFam = this.savedFam;
                if ((this.wipeActive ? this.wipeTo : this.fam) !== returnFam) {
                    this.pendingFamily = returnFam;
                    this.pendingTimer = 0;
                }
            }
        } else {
            this.stateAge += dt;
        }

        // Sichtbarkeit auf dem Floor-Layer (abgeglichen mit StageManager 1.5 s)
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

        // Beat-Metriken & SID-Kanäle 0..2
        const rawImpulse = metrics?.beatImpulse?.[0];
        const rawBeat = metrics?.beat?.[0];
        const impulse = clamp01(Number.isFinite(rawImpulse) ? rawImpulse : rawBeat);
        this.lastImpulse = impulse;

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
            this.beatSeqCount++;
            this.timeSinceBeat = 0;
        }

        this.hardCooldown = Math.max(0, this.hardCooldown - dt);

        if (this.wipeActive) {
            this.wipeElapsed += dt;
            if (this.wipeElapsed >= WIPE_DURATION) {
                this.wipeActive = false;
                this.fam = this.wipeTo;
            }
        }

        if (this.pendingFamily !== -1) {
            this.pendingTimer += dt;
            if (onBeat || this.pendingTimer >= BEATLESS_PENDING_TIMEOUT) {
                this._startWipe(this.pendingFamily);
                this.pendingFamily = -1;
                this.pendingTimer = 0;
            }
        }

        const isAfterglow = state === 'afterglow';

        // Diskrete Beat-Wechsel (Muster bei count % 4 === 0, Familie bei count % 8 === 0)
        if (onBeat) {
            if (!isAfterglow && state !== 'stopping' && count > 0) {
                if (count % 4 === 0) {
                    this.pat = Math.floor(count / 4) % 4;
                }
                if (count % 8 === 0) {
                    const nextFam = ((this.wipeActive ? this.wipeTo : this.fam) + 1) % 4;
                    this._startWipe(nextFam);
                    this.savedFam = nextFam;
                    this.pendingFamily = -1;
                }
            }
            const beatEffectiveLevel = isAfterglow ? 1 : level;
            this._applyBeatPattern(beatEffectiveLevel, count, isAfterglow, state);
        }

        // Fester 50-Hz-Schritt für Zerfall, Ripple, Wasserfall, Funkeln & 2-Hz-Fallback
        this.acc += dt;
        let stepCounter = 0;
        while (this.acc >= FIXED_STEP && stepCounter++ < 4) {
            this._step50Hz(state, isAfterglow);
            this.acc -= FIXED_STEP;
        }

        // ---------------------------------------------------------
        // Darstellung ausschließlich für y >= horizon
        // ---------------------------------------------------------
        const horizon = Math.min(h - 1, Math.max(0, Math.floor(h * 0.55)));
        const H = h - horizon;
        if (H <= 0) return;

        // Basis unterhalb Horizont in Index 0 (Fugenfarbe)
        ctx.fillStyle = HEX[0];
        fr(ctx, 0, horizon, w, H, w, horizon, h);

        const wb = Math.max(8, Math.round(Math.min(w, 1.6 * h) / 8)) * (1 + 0.03 * impulse);
        const impBoost = Math.round(impulse);
        const wipeProgress = this.wipeActive ? clamp01(this.wipeElapsed / WIPE_DURATION) : 1.0;
        const rainbowRows = !isAfterglow && (state === 'climax' || this.ten > 0.70);

        // Starting / Stopping Reihen-Sichtbarkeit (starting: hinten -> vorn, stopping: vorn -> hinten)
        const jVis = (state === 'starting' || state === 'stopping')
            ? Math.ceil(ROWS * vis)
            : ROWS;
        const minVisibleRow = ROWS - jVis;

        for (let j = 0; j < ROWS; j++) {
            if (j < minVisibleRow) continue;

            const pNear = 1.0 / (1.0 + j * 0.45);
            const pFar = 1.0 / (1.0 + (j + 1) * 0.45);
            const rTop = Math.round(H * (pFar - P_MIN) * INV_P_SPAN);
            const rBot = Math.round(H * (pNear - P_MIN) * INV_P_SPAN);
            if (rBot <= rTop + 1) {
                // Fuge bleibt auf der ersten Zeile (rTop); mindestens 1 Kachelzeile nötig
                continue;
            }

            const rowOffset = j * NC;

            // Erste Zeile jeder Reihe bleibt Index 0 (Fuge) -> Start ab rTop + 1
            for (let r = rTop + 1; r < rBot; r++) {
                const y = horizon + r;
                if (y >= h) break;

                const q = r / H;
                const p = P_MIN + q * (1.0 - P_MIN);
                const baseFam = (this.wipeActive && q > wipeProgress) ? this.wipeFrom : this.fam;
                const rowFam = rainbowRows ? ((baseFam + j) % 4) : baseFam;
                const colStepW = wb * p;
                const hasColGrout = p > 0.45;

                // Sichtbare Spalten auf [0 .. w] begrenzen + benachbarte gleiche Farben mergen
                const minCol = Math.max(-HALF_COLS, Math.floor(-(w * 0.5) / colStepW - 0.5));
                const maxCol = Math.min(HALF_COLS, Math.ceil((w * 0.5) / colStepW + 0.5));

                if (hasColGrout) {
                    for (let i = minCol; i <= maxCol; i++) {
                        const xl = Math.round(w * 0.5 + (i - 0.5) * colStepW);
                        const xr = Math.round(w * 0.5 + (i + 0.5) * colStepW) - 1;
                        if (xr <= 0 || xl >= w || xr <= xl) continue;

                        const tileLvl = this.lvl[rowOffset + i + HALF_COLS];
                        ctx.fillStyle = tileColorHex(rowFam, tileLvl, impBoost, isAfterglow);
                        fr(ctx, xl, y, xr - xl, 1, w, horizon, h);
                    }
                } else {
                    let runStartX = 0;
                    let runEndX = 0;
                    let runColor = null;

                    for (let i = minCol; i <= maxCol; i++) {
                        const xl = Math.max(0, Math.round(w * 0.5 + (i - 0.5) * colStepW));
                        const xr = Math.min(w, Math.round(w * 0.5 + (i + 0.5) * colStepW));
                        if (xr <= xl) continue;

                        const tileLvl = this.lvl[rowOffset + i + HALF_COLS];
                        const color = tileColorHex(rowFam, tileLvl, impBoost, isAfterglow);

                        if (runColor === color && xl <= runEndX) {
                            runEndX = Math.max(runEndX, xr);
                        } else {
                            if (runColor !== null && runEndX > runStartX) {
                                ctx.fillStyle = runColor;
                                fr(ctx, runStartX, y, runEndX - runStartX, 1, w, horizon, h);
                            }
                            runColor = color;
                            runStartX = xl;
                            runEndX = xr;
                        }
                    }
                    if (runColor !== null && runEndX > runStartX) {
                        ctx.fillStyle = runColor;
                        fr(ctx, runStartX, y, runEndX - runStartX, 1, w, horizon, h);
                    }
                }
            }
        }

        // Bayer-Fade unterhalb horizon bei vis < 1
        if (vis < 1.0) {
            bayerFadeCells(ctx, 0, horizon, w, H, vis, 2, HEX[0]);
        }
    }
}