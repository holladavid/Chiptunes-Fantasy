// === js/visuals/dse/c64/fire-wall.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: C64 FIRE WALL (BACKGROUND)
// VIC-II Multicolor-Chunky-Feuerwand:
// - 50-Hz-Hitzesimulation (bündig bis horizon, Nearest-Resample bei Resize)
// - 3 kosinus-interpolierte SID-Stimmenzonen [1/6, 1/2, 5/6]
// - Horizontales Run-Merging + 2x2-Stufen-Dither
// - 24er Int16Array-Funkenpool & Bayer-Fade bei starting/stopping
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

// Index 3 = FIRE als Start-Feuerwand, Index 0 = BLUE als Afterglow
const FAM = Object.freeze([RAMP.BLUE, RAMP.PURPLE, RAMP.GREEN, RAMP.FIRE]);

const T_IN = 1.5;
const T_OUT = 1.5;
const STOP_FADE_WINDOW = 0.6;
const WIPE_DURATION = 0.6;
const HARD_COOLDOWN = 0.25;
const FIXED_STEP = 0.02;
const SPARK_POOL_SIZE = 24;

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

function hashSegment(n) {
    let h = Math.imul((n | 0) ^ 0x9E3779B9, 0x85EBCA6B);
    h = Math.imul(h ^ (h >>> 13), 0xC2B2AE35);
    return (h ^ (h >>> 16)) >>> 0;
}

export class C64FireWall {
    constructor() {
        this.name = 'C64 Fire Wall';

        this.lastT = null;
        this.lastState = 'idle';
        this.stateAge = 0;
        this.simT = 0;
        this.ten = 0.30;
        this.acc = 0;

        // Gitter- & Hitzefeld (Instanzbesitz, bei Resize per Nearest-Resample erhalten)
        this.cell = 3;
        this.cols = 0;
        this.hRow = 0;
        this.heat = new Uint8Array(0);

        // Beat-, Wind- & Boost-Status (-1 schützt beatCount === 0)
        this.lastBeatCount = -1;
        this.beatDir = 1;
        this.hardCooldown = 0;
        this.hardColCount = 0;
        this.windSign = 1;
        this.gustTimer = 0;
        this.emberTickAcc = 0;
        this.emberSeed = 1;

        // Beat-Quell-Boosts über feste Segmentmaske (6 Segmente + Feuersäule)
        this.segBoostSteps = new Uint8Array(6);
        this.colBoostX = 0;
        this.colBoostW = 0;
        this.colBoostSteps = 0;

        // Familien & Wipe (Start: FIRE = 3)
        this.fam = 3;
        this.savedFam = 3;
        this.wipeFrom = 3;
        this.wipeTo = 3;
        this.wipeActive = false;
        this.wipeElapsed = 0;

        // Fester Funkenpool (24; Int16Array in 1/16 px Festkomma)
        this.sparkX = new Int16Array(SPARK_POOL_SIZE);
        this.sparkY = new Int16Array(SPARK_POOL_SIZE);
        this.sparkVx = new Int16Array(SPARK_POOL_SIZE);
        this.sparkVy = new Int16Array(SPARK_POOL_SIZE);
        this.sparkLife = new Int16Array(SPARK_POOL_SIZE);

        this.rng = createXorshift32(0x46495245); // 'FIRE'
        this.ch = new Float32Array(3);
        this.lastImpulse = 0;
        this.lastVis = 1.0;
        this.lastSourceHeatSum = 0;
    }

    _ensureGrid(w, h) {
        const horizon = Math.min(h - 1, Math.max(2, Math.floor(h * 0.55)));
        const cell = Math.min(4, Math.max(2, Math.ceil(w / 120)));
        const cols = Math.max(4, Math.ceil(w / cell));
        // Math.ceil stellt sicher, dass die unterste Flammenzeile bündig auf horizon endet (ohne dunkle Lücke)
        const hRow = Math.max(2, Math.ceil(horizon / cell));

        if (cols === this.cols && hRow === this.hRow && cell === this.cell && this.heat.length > 0) {
            return { horizon, cell, cols, hRow };
        }

        const newLen = cols * (hRow + 2);
        if (this.cols === 0 || this.hRow === 0 || this.heat.length === 0) {
            this.heat = new Uint8Array(newLen);
        } else {
            const oldCols = this.cols;
            const oldHRow = this.hRow;
            const oldHeat = this.heat;
            const nextHeat = new Uint8Array(newLen);

            // Nearest-Neighbor Resample bewahrt brennende Flammen über Rotation/Resize hinweg
            for (let y = 0; y < hRow + 2; y++) {
                const oy = Math.min(oldHRow + 1, Math.floor((y * oldHRow) / Math.max(1, hRow)));
                for (let x = 0; x < cols; x++) {
                    const ox = Math.min(oldCols - 1, Math.floor((x * oldCols) / cols));
                    nextHeat[y * cols + x] = oldHeat[oy * oldCols + ox];
                }
            }
            this.heat = nextHeat;

            // Aktive Funken auf neue Dimensionen abbilden
            const sx = (cols * cell) / Math.max(1, oldCols * this.cell);
            const sy = horizon / Math.max(1, oldHRow * this.cell);
            for (let i = 0; i < SPARK_POOL_SIZE; i++) {
                if (this.sparkLife[i] > 0) {
                    const nx = Math.round(this.sparkX[i] * sx);
                    const ny = Math.round(this.sparkY[i] * sy);
                    if (nx < 0 || ny < 0 || nx >= w * 16 || ny >= horizon * 16) {
                        this.sparkLife[i] = 0;
                    } else {
                        this.sparkX[i] = nx;
                        this.sparkY[i] = ny;
                    }
                }
            }
        }

        this.cell = cell;
        this.cols = cols;
        this.hRow = hRow;
        return { horizon, cell, cols, hRow };
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

    _spawnSparksFromRange(colStart, colEnd, count, horizon) {
        if (count <= 0 || this.cols <= 0 || this.hRow <= 0) return;
        const c0 = Math.max(0, Math.min(this.cols - 1, colStart));
        const c1 = Math.max(c0 + 1, Math.min(this.cols, colEnd));
        const span = Math.max(1, c1 - c0);
        const startY = Math.max(2, horizon - this.cell * 2) * 16;

        let spawned = 0;
        for (let i = 0; i < SPARK_POOL_SIZE && spawned < count; i++) {
            if (this.sparkLife[i] <= 0) {
                const col = c0 + this.rng.int(span);
                this.sparkX[i] = col * this.cell * 16;
                this.sparkY[i] = startY;
                this.sparkVx[i] = this.rng.int(33) - 16;
                this.sparkVy[i] = -(18 + this.rng.int(22));
                this.sparkLife[i] = 25 + this.rng.int(36); // 0.50 .. 1.20 s bei 50 Hz
                spawned++;
            }
        }
    }

    _step50Hz(state, isAfterglow, horizon) {
        this.simT += FIXED_STEP * (isAfterglow ? 0.4 : 1.0);
        this.gustTimer = Math.max(0, this.gustTimer - FIXED_STEP);

        // 12,5-Hz-Zeilenjitter-Seed für das Glutbett
        this.emberTickAcc += FIXED_STEP;
        if (this.emberTickAcc >= 0.08) {
            this.emberTickAcc -= 0.08;
            this.emberSeed = this.rng.next();
        }

        const cols = this.cols;
        const hRow = this.hRow;
        const cell = this.cell;
        const heat = this.heat;

        // Kosinus-interpolierte SID-Stimmenzonen [1/6, 1/2, 5/6] * cols
        const z0 = 0.62 + 0.38 * this.ch[0];
        const z1 = 0.62 + 0.38 * this.ch[1];
        const z2 = 0.62 + 0.38 * this.ch[2];
        const a0 = cols / 6;
        const a1 = cols / 2;
        const a2 = (5 * cols) / 6;
        const span01 = Math.max(1, a1 - a0);
        const span12 = Math.max(1, a2 - a1);

        let srcLevel = lerp(0.68, 1.00, this.ten) * (1 + 0.9 * this.lastImpulse);
        let coolBase = lerp(6.2, 2.6, this.ten);
        if (isAfterglow) {
            srcLevel *= 0.45;
            coolBase *= 1.65;
        } else if (state === 'stopping') {
            srcLevel = 0;
        }
        const coolEff = coolBase * (cell * 0.5);

        // Aktive Breite beim starting (wächst von der Mitte nach außen)
        let activeHalf = cols;
        if (state === 'starting') {
            activeHalf = Math.max(1, Math.ceil(this.lastVis * cols * 0.5));
        }
        const midCol = cols * 0.5;

        // Quellzeile hRow berechnen
        const segWidth = cols / 6;
        let stepSourceSum = 0;
        for (let x = 0; x < cols; x++) {
            let zoneW;
            if (x <= a0) {
                zoneW = z0;
            } else if (x < a1) {
                const u = 0.5 * (1 - Math.cos(Math.PI * ((x - a0) / span01)));
                zoneW = lerp(z0, z1, u);
            } else if (x < a2) {
                const u = 0.5 * (1 - Math.cos(Math.PI * ((x - a1) / span12)));
                zoneW = lerp(z1, z2, u);
            } else {
                zoneW = z2;
            }

            let hVal = 0;
            if (state !== 'stopping' && (state !== 'starting' || Math.abs(x + 0.5 - midCol) <= activeHalf)) {
                hVal = 255 * srcLevel * zoneW * (0.80 + 0.20 * this.rng.float());
            }

            const seg = Math.min(5, Math.floor(x / Math.max(1e-6, segWidth)));
            if (this.segBoostSteps[seg] > 0 && state !== 'stopping') {
                hVal += 60;
            }

            if (this.colBoostSteps > 0 && x >= this.colBoostX && x < this.colBoostX + this.colBoostW && state !== 'stopping') {
                hVal = 255;
            }

            const clamped = hVal < 0 ? 0 : (hVal > 255 ? 255 : Math.round(hVal));
            heat[hRow * cols + x] = clamped;
            heat[(hRow + 1) * cols + x] = clamped;
            stepSourceSum += clamped;
        }
        this.lastSourceHeatSum = stepSourceSum;

        for (let s = 0; s < 6; s++) {
            if (this.segBoostSteps[s] > 0) this.segBoostSteps[s]--;
        }
        if (this.colBoostSteps > 0) this.colBoostSteps--;

        // Windversatz in Zellen
        const windAmp = isAfterglow ? 0 : (this.ten < 0.35 ? 0 : (this.ten < 0.70 ? 1 : 2));
        let windWave = 0;
        if (windAmp === 1) {
            windWave = ((Math.floor(this.simT / 0.8) & 1) === 0 ? 1 : -1) * this.windSign;
        } else if (windAmp >= 2) {
            windWave = Math.round(windAmp * Math.sin(this.simT * 2.1) * this.windSign);
        }
        if (this.gustTimer > 0 && !isAfterglow) {
            windWave += this.windSign;
        }
        const windCells = windWave + this.beatDir * Math.round(this.lastImpulse * 1.5);

        // Flammenausbreitung nach oben (y = 0 .. hRow - 1)
        for (let y = 0; y < hRow; y++) {
            const rowDst = y * cols;
            const row1 = (y + 1) * cols;
            const row2 = (y + 2) * cols;

            for (let x = 0; x < cols; x++) {
                const wx = Math.max(0, Math.min(cols - 1, x + windCells));
                const wxL = Math.max(0, wx - 1);
                const wxR = Math.min(cols - 1, wx + 1);
                const avg = (heat[row1 + wxL] + heat[row1 + wx] + heat[row1 + wxR] + heat[row2 + wx]) >> 2;
                const cool = coolEff * (0.6 + 0.8 * this.rng.float());
                const next = avg - cool;
                heat[rowDst + x] = next > 0 ? Math.min(255, Math.round(next)) : 0;
            }
        }

        // Kontinuierliche Funken je Tension-Band (Pool 24, im afterglow/stopping aus)
        const sparkMax = (isAfterglow || state === 'stopping')
            ? 0
            : (this.ten < 0.35 ? 0 : (this.ten < 0.70 ? 12 : 24));
        if (sparkMax > 0) {
            let activeSparks = 0;
            for (let i = 0; i < SPARK_POOL_SIZE; i++) {
                if (this.sparkLife[i] > 0) activeSparks++;
            }
            if (activeSparks < sparkMax && this.rng.float() < (this.ten >= 0.70 ? 0.55 : 0.30)) {
                this._spawnSparksFromRange(0, cols, 1, horizon);
            }
        }

        // Funken bewegen
        const windPxStep = Math.round(windCells * cell * 2);
        const maxXFP = cols * cell * 16;
        for (let i = 0; i < SPARK_POOL_SIZE; i++) {
            if (this.sparkLife[i] <= 0) continue;
            this.sparkX[i] += this.sparkVx[i] + windPxStep;
            this.sparkY[i] += this.sparkVy[i];
            this.sparkLife[i]--;
            if (this.sparkY[i] < 0 || this.sparkX[i] < 0 || this.sparkX[i] >= maxXFP) {
                this.sparkLife[i] = 0;
            }
        }
    }

    resize() {
        // Puffergröße und Nearest-Resample erfolgen sauber in render() anhand realer Retro-Buffer-Maße.
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

        const effectiveStateTime = Number.isFinite(stateTime) ? stateTime : this.stateAge;
        let vis = 1.0;
        let fadeVis = 1.0;
        if (state === 'starting') {
            vis = clamp01((effectiveStateTime + 0.06) / T_IN);
            fadeVis = vis;
        } else if (state === 'stopping') {
            vis = 1.0 - clamp01(effectiveStateTime / T_OUT);
            if (vis <= 0.001) {
                return;
            }
            const remaining = Math.max(0, T_OUT - effectiveStateTime);
            fadeVis = remaining < STOP_FADE_WINDOW ? clamp01(remaining / STOP_FADE_WINDOW) : 1.0;
        }
        this.lastVis = vis;

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
        this.lastImpulse = clamp01(Number.isFinite(rawImpulse) ? rawImpulse : rawBeat);

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

        if (this.wipeActive) {
            this.wipeElapsed += dt;
            if (this.wipeElapsed >= WIPE_DURATION) {
                this.wipeActive = false;
                this.fam = this.wipeTo;
            }
        }

        const { horizon, cell, cols, hRow } = this._ensureGrid(w, h);
        const isAfterglow = state === 'afterglow';

        // Diskrete Beat-Reaktionen (§5.2)
        if (onBeat && state !== 'stopping') {
            if (!isAfterglow) {
                if (level === 1) {
                    const seg = hashSegment(count) % 6;
                    this.segBoostSteps[seg] = Math.max(this.segBoostSteps[seg], 2);
                } else if (level === 2) {
                    const s0 = this.rng.int(6);
                    const s1 = (s0 + 1 + this.rng.int(2)) % 6;
                    const s2 = (s1 + 1 + this.rng.int(2)) % 6;
                    const segs = [s0, s1, s2];
                    for (let i = 0; i < 3; i++) {
                        const seg = segs[i];
                        this.segBoostSteps[seg] = Math.max(this.segBoostSteps[seg], 2);
                        const cStart = Math.floor((seg * cols) / 6);
                        const cEnd = Math.ceil(((seg + 1) * cols) / 6);
                        this._spawnSparksFromRange(cStart, cEnd, i === 0 ? 2 : 1, horizon);
                    }
                } else if (level === 3 && this.hardCooldown <= 0) {
                    this.hardCooldown = HARD_COOLDOWN;
                    this.hardColCount++;
                    const colW = Math.max(3, Math.floor(cols / 16));
                    const maxStart = Math.max(1, cols - colW);
                    const colX = hashSegment(count + 17) % maxStart;
                    this.colBoostX = colX;
                    this.colBoostW = colW;
                    this.colBoostSteps = 6; // 0.12 s bei 50 Hz
                    this._spawnSparksFromRange(colX, colX + colW, 10, horizon);
                }

                if (count > 0) {
                    if (count % 4 === 0) {
                        const nextFam = ((this.wipeActive ? this.wipeTo : this.fam) + 1) % 4;
                        this._startWipe(nextFam);
                        this.savedFam = nextFam;
                    }
                    if (count % 8 === 0) {
                        this.windSign = -this.windSign;
                        this.gustTimer = 0.6;
                    }
                }
            } else if (level === 1) {
                const seg = hashSegment(count) % 6;
                this.segBoostSteps[seg] = Math.max(this.segBoostSteps[seg], 2);
            }
        }

        // Feste 50-Hz-Simulation
        this.acc += dt;
        let simSteps = 0;
        while (this.acc >= FIXED_STEP && simSteps++ < 4) {
            this._step50Hz(state, isAfterglow, horizon);
            this.acc -= FIXED_STEP;
        }

        // ---------------------------------------------------------
        // Darstellung: Himmel + Glutschein + Feuerwand + Glutbett + Funken
        // ---------------------------------------------------------
        // 1. Himmel in Index 0
        ctx.fillStyle = HEX[0];
        fr(ctx, 0, 0, w, h, w, h);

        const wipeProgress = this.wipeActive ? clamp01(this.wipeElapsed / WIPE_DURATION) : 1.0;

        // 2. Glutschein (letzte 12 px über Horizont: oben 25%, unten 50% Checker in Index 1 der Rampe)
        const glowTop = Math.max(0, horizon - 12);
        const glowMid = Math.max(glowTop, horizon - 6);
        const glowFam = FAM[(this.wipeActive && 0 > wipeProgress) ? this.wipeFrom : this.fam];
        ctx.fillStyle = HEX[glowFam[1]];
        const gStep = Math.max(2, cell);
        for (let gy = glowTop; gy < horizon; gy += gStep) {
            const gh = Math.min(gStep, horizon - gy);
            const isUpper = gy < glowMid;
            const rowParity = Math.floor((gy - glowTop) / gStep) & 1;
            for (let gx = 0; gx < w; gx += gStep) {
                const colIdx = Math.floor(gx / gStep);
                const drawCell = isUpper
                    ? ((colIdx & 1) === 0 && rowParity === 0)
                    : (((colIdx + rowParity) & 1) === 0);
                if (drawCell) {
                    fr(ctx, gx, gy, Math.min(gStep, w - gx), gh, w, h);
                }
            }
        }

        // 3. Feuerwand bündig von unten an horizon ausgerichtet (y = horizon - (hRow - row) * cell)
        const heat = this.heat;
        for (let row = 0; row < hRow; row++) {
            const rawPy = horizon - (hRow - row) * cell;
            const rawBot = rawPy + cell;
            if (rawBot <= 0) continue;
            const py = Math.max(0, rawPy);
            const ph = Math.min(horizon, rawBot) - py;
            if (ph <= 0) continue;

            const q = 1.0 - row / Math.max(1, hRow);
            const activeFam = (this.wipeActive && q > wipeProgress) ? this.wipeFrom : this.fam;
            const ramp = FAM[activeFam];
            const L = ramp.length;
            const rowOff = row * cols;

            let runStart = -1;
            let runStage = 0;

            for (let col = 0; col <= cols; col++) {
                let stage = 0;
                if (col < cols) {
                    const hv = heat[rowOff + col];
                    if (hv > 0) {
                        const sf = (hv * L) / 256;
                        stage = Math.min(L - 1, Math.floor(sf));
                        const frac = sf - stage;
                        if (frac >= 0.4 && frac <= 0.6 && stage + 1 < L && ((col + row) & 1) === 1) {
                            stage++;
                        }
                    }
                }

                if (stage === runStage && col < cols) {
                    if (stage > 0 && runStart === -1) runStart = col;
                } else {
                    if (runStage > 0 && runStart !== -1) {
                        const rx = runStart * cell;
                        const rw = Math.min(w, col * cell) - rx;
                        if (rw > 0) {
                            ctx.fillStyle = HEX[ramp[runStage]];
                            fr(ctx, rx, py, rw, ph, w, h);
                        }
                    }
                    runStage = stage;
                    runStart = stage > 0 ? col : -1;
                }
            }
        }

        // 4. Glutbett (y >= horizon, reine Darstellung im cell-Raster, wird von aktiven Floors überdeckt)
        const rowsBelow = h - horizon;
        if (rowsBelow > 0) {
            const emberRamp = FAM[(this.wipeActive && 0 > wipeProgress) ? this.wipeFrom : this.fam];
            const eL = emberRamp.length;
            const bandH = Math.max(2, cell);
            const emberBands = Math.ceil(rowsBelow / bandH);
            const maxE = isAfterglow ? 2 : (this.ten < 0.35 ? 3 : 4);

            for (let b = 0; b < emberBands; b++) {
                const ey = horizon + b * bandH;
                const eh = Math.min(bandH, h - ey);
                if (eh <= 0) break;

                const rMid = b * bandH;
                const jh = hashSegment(this.emberSeed + b * 31) % 3;
                const flick = (jh - 1) * 0.45;
                const eVal = Math.max(0, Math.min(maxE, Math.round(maxE - (maxE * rMid) / rowsBelow + flick)));
                const ePrev = Math.max(0, eVal - 1);

                const idxPrev = Math.min(eL - 1, ePrev);
                const idxCurr = Math.min(eL - 1, eVal);

                if (idxPrev > 0) {
                    ctx.fillStyle = HEX[emberRamp[idxPrev]];
                    fr(ctx, 0, ey, w, eh, w, h);
                }

                if (idxCurr !== idxPrev && idxCurr > 0) {
                    ctx.fillStyle = HEX[emberRamp[idxCurr]];
                    for (let gx = (b & 1) * cell; gx < w; gx += cell * 2) {
                        fr(ctx, gx, ey, Math.min(cell, w - gx), eh, w, h);
                    }
                }
            }
        }

        // 5. Funken (1-Zellen-Quadrate in Stufe L-2 bzw. L-1)
        const sparkRamp = FAM[this.fam];
        const sL = sparkRamp.length;
        const brightHex = HEX[sparkRamp[sL - 1]];
        const warmHex = HEX[sparkRamp[Math.max(1, sL - 2)]];
        for (let i = 0; i < SPARK_POOL_SIZE; i++) {
            const life = this.sparkLife[i];
            if (life <= 0) continue;
            const sx = this.sparkX[i] >> 4;
            const sy = this.sparkY[i] >> 4;
            if (sy >= horizon) continue;
            ctx.fillStyle = life > 22 ? brightHex : warmHex;
            fr(ctx, sx, sy, cell, cell, w, horizon);
        }

        // 6. Bayer-Fade bei starting / Ende von stopping
        if (fadeVis < 1.0) {
            bayerFadeCells(ctx, 0, 0, w, h, fadeVis, 2, HEX[0]);
        }
    }
}