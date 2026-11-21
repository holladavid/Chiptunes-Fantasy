// === js/visuals/dse/c64/raster-road.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: C64 RASTER ROAD (FLOOR)
// VIC-II Scanline-Perspektivstraße unterhalb horizon = floor(0.55 * h):
// 4 Farbfamilien per Wipe (Gras/Wüste/Eis/Nacht), Zeilen-Dither-Dunstzone,
// 3 SID-Lanes mit Hysterese, Z-sortierte Pylonen & Hard-Beat-Gates,
// Climax-Speed-Streaks.
// =========================================================

import {
    C64_PALETTE,
    rgbToHex,
    createXorshift32,
    bayerFadeCells,
    drawAliasedLineClipped
} from '../../utils/hardware-constraints.js';

const HEX = Object.freeze(C64_PALETTE.map(([r, g, b]) => rgbToHex(r, g, b)));

// Abgeglichen mit StageManager (TRANSITION_TIME = 1.5) & DSEBaseline.runTransition
const T_IN = 1.5;
const T_OUT = 1.5;
const WIPE_DURATION = 0.6;
const BEATLESS_PENDING_TIMEOUT = 1.2;
const HARD_COOLDOWN = 0.25;
const GATE_POOL_SIZE = 3;
const GATE_SPAWN_Z = 5.5;
const MIN_GATE_Z_GAP = 1.35;
const STREAK_POOL_SIZE = 12;
const PYLON_COUNT = 10;
const MAX_PROPS = PYLON_COUNT + GATE_POOL_SIZE;

// 0: Gras, 1: Wüste, 2: Eis, 3: Nacht (afterglow erzwingt 3)
const FAMILIES = Object.freeze([
    Object.freeze({
        grass: Object.freeze([13, 5]),
        road: Object.freeze([11, 12]),
        roadLit: Object.freeze([12, 15]),
        kerb: Object.freeze([2, 1]),
        center: 1,
        medCenter: 7,
        gate: 1
    }),
    Object.freeze({
        grass: Object.freeze([7, 8]),
        road: Object.freeze([12, 15]),
        roadLit: Object.freeze([15, 1]),
        kerb: Object.freeze([9, 1]),
        center: 1,
        medCenter: 7,
        gate: 1
    }),
    Object.freeze({
        grass: Object.freeze([1, 15]),
        road: Object.freeze([11, 12]),
        roadLit: Object.freeze([12, 15]),
        kerb: Object.freeze([14, 1]),
        center: 3,
        medCenter: 7,
        gate: 1
    }),
    Object.freeze({
        grass: Object.freeze([6, 0]),
        road: Object.freeze([0, 11]),
        roadLit: Object.freeze([11, 12]),
        kerb: Object.freeze([4, 3]),
        center: 7,
        medCenter: 1,
        gate: 7
    })
]);

const RAINBOW_KERB = Object.freeze([2, 8, 7, 5]);

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

export class C64RasterRoad {
    constructor() {
        this.name = 'C64 Raster Road';

        this.lastT = null;
        this.lastState = 'idle';
        this.stateAge = 0;
        this.simT = 0;
        this.ten = 0.30;

        this.dist = 0;
        this.lastVEff = 0;
        this.curveSign = 1;
        this.curveSignTarget = 1;
        this.kerbPhase = 0;

        // Beat tracking (-1 verhindert Verschlucken von beatCount === 0)
        this.lastBeatCount = -1;
        this.hardCooldown = 0;
        this.mediumFlashTimer = 0;
        this.rainbowKerbTimer = 0;

        // Familien & Wipe-Status
        this.famIdx = 0;
        this.savedFamIdx = 0;
        this.wipeFrom = 0;
        this.wipeTo = 0;
        this.wipeActive = false;
        this.wipeElapsed = 0;
        this.pendingFamily = -1;
        this.pendingTimer = 0;

        // 3 SID-Lanes mit Hysterese (>= 0.6 an, < 0.4 aus)
        this.laneLit = new Uint8Array(3);

        // Feste Pools & einheitlicher Z-Sortierpuffer (keine Allokation im Renderloop)
        this.rng = createXorshift32(0x524F4144);
        this.gates = Array.from({ length: GATE_POOL_SIZE }, () => ({ active: false, z: GATE_SPAWN_Z }));
        this.streaks = Array.from({ length: STREAK_POOL_SIZE }, () => ({
            side: this.rng.int(2) === 0 ? -1 : 1,
            offsetRatio: 1.35 + this.rng.float() * 1.85,
            z: 1.0 + this.rng.float() * 4.5,
            len: 0.35 + this.rng.float() * 0.45
        }));
        this.propZ = new Float32Array(MAX_PROPS);
        this.propType = new Uint8Array(MAX_PROPS); // 0 = Pylonen-Paar, 1 = Gate
        this.propIndex = new Uint8Array(MAX_PROPS);
        this.propOrder = new Uint8Array(MAX_PROPS);
        this.floorClip = { x: 0, y: 0, width: 0, height: 0 };
    }

    _startWipe(nextFam) {
        const target = ((nextFam % 4) + 4) % 4;
        const current = this.wipeActive ? this.wipeTo : this.famIdx;
        if (target === current && !this.wipeActive) return;
        this.wipeFrom = current;
        this.wipeTo = target;
        this.wipeElapsed = 0;
        this.wipeActive = true;
    }

    _resetStreak(s, farStart = false) {
        s.side = this.rng.int(2) === 0 ? -1 : 1;
        s.offsetRatio = 1.35 + this.rng.float() * 1.85;
        s.z = farStart ? (4.6 + this.rng.float() * 1.0) : (1.0 + this.rng.float() * 4.5);
        s.len = 0.35 + this.rng.float() * 0.45;
    }

    _spawnGate() {
        const minAllowedZ = GATE_SPAWN_Z - MIN_GATE_Z_GAP;
        let slot = -1;
        let lowestZ = Infinity;
        let lowestIdx = 0;

        for (let i = 0; i < GATE_POOL_SIZE; i++) {
            const g = this.gates[i];
            if (g.active) {
                if (g.z > minAllowedZ) {
                    // Vorheriges Gate steckt noch zu nah am Horizont -> keinen Stau spawnen
                    return false;
                }
                if (g.z < lowestZ) {
                    lowestZ = g.z;
                    lowestIdx = i;
                }
            } else if (slot === -1) {
                slot = i;
            }
        }

        const target = slot !== -1 ? this.gates[slot] : this.gates[lowestIdx];
        target.active = true;
        target.z = GATE_SPAWN_Z;
        return true;
    }

    resize() {
        // Alle Größen berechnen sich dynamisch aus (w, h);
        // Fahrtdistanz, Pools, Kurvenphase & Familie bleiben erhalten.
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
            if (state === 'afterglow') {
                if (prevState === 'idle' || prevState === 'starting') {
                    this.famIdx = 3;
                    this.wipeTo = 3;
                    this.wipeActive = false;
                    this.pendingFamily = -1;
                } else {
                    this.savedFamIdx = this.wipeActive ? this.wipeTo : this.famIdx;
                    if ((this.wipeActive ? this.wipeTo : this.famIdx) !== 3) {
                        this.pendingFamily = 3;
                        this.pendingTimer = 0;
                    }
                }
            } else if (prevState === 'afterglow' && state !== 'stopping') {
                const returnFam = this.savedFamIdx === 3 ? 0 : this.savedFamIdx;
                if ((this.wipeActive ? this.wipeTo : this.famIdx) !== returnFam) {
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

        // Defensive Beat-Auswertung (§2)
        const rawImpulse = metrics?.beatImpulse?.[0];
        const rawBeat = metrics?.beat?.[0];
        const impulse = clamp01(Number.isFinite(rawImpulse) ? rawImpulse : rawBeat);

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
        }

        // Cooldowns & Timer
        this.hardCooldown = Math.max(0, this.hardCooldown - dt);
        this.mediumFlashTimer = Math.max(0, this.mediumFlashTimer - dt);
        this.rainbowKerbTimer = Math.max(0, this.rainbowKerbTimer - dt);

        if (this.wipeActive) {
            this.wipeElapsed += dt;
            if (this.wipeElapsed >= WIPE_DURATION) {
                this.wipeActive = false;
                this.famIdx = this.wipeTo;
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

        // Diskrete Beat-Reaktionen (§5.5)
        if (onBeat) {
            if (level === 1) {
                this.kerbPhase ^= 1;
            } else if (level === 2) {
                this.kerbPhase ^= 1;
                this.mediumFlashTimer = 0.55;
            } else if (level === 3) {
                this.kerbPhase ^= 1;
                if (this.hardCooldown <= 0 && state !== 'afterglow' && state !== 'stopping') {
                    this.hardCooldown = HARD_COOLDOWN;
                    this._spawnGate();
                    if (state === 'climax' || this.ten > 0.70) {
                        this.rainbowKerbTimer = 0.30;
                    }
                }
            }

            if (count > 0 && state !== 'afterglow' && state !== 'stopping') {
                if (count % 4 === 0) {
                    const nextFam = ((this.wipeActive ? this.wipeTo : this.famIdx) + 1) % 4;
                    this._startWipe(nextFam);
                    if (state !== 'afterglow') this.savedFamIdx = nextFam;
                    this.pendingFamily = -1;
                }
                if (count % 8 === 0) {
                    this.curveSignTarget = -this.curveSignTarget;
                }
            }
        }

        // SID-Kanäle 0..2 -> Lane-Hysterese (an ab >= 0.6, aus ab < 0.4)
        for (let k = 0; k < 3; k++) {
            const rawCh = metrics?.smooth?.[k];
            const chVal = clamp01(Number.isFinite(rawCh) ? rawCh : 0);
            if (this.laneLit[k]) {
                if (chVal < 0.4) this.laneLit[k] = 0;
            } else {
                if (chVal >= 0.6) this.laneLit[k] = 1;
            }
        }

        // Zeit- & Bewegungssimulation
        const isAfterglow = state === 'afterglow';
        let v = lerp(0.28, 1.10, this.ten);
        if (isAfterglow) v *= 0.35;
        const vEff = Math.min(1.7, v * (1 + 1.5 * impulse));
        this.lastVEff = vEff;
        this.dist += vEff * dt;
        this.simT += dt * (isAfterglow ? 0.35 : 1.0);

        let curveAmp = lerp(0.15, 0.90, this.ten);
        if (isAfterglow) curveAmp = Math.min(curveAmp, 0.20);
        this.curveSign += (this.curveSignTarget - this.curveSign) * (1 - Math.exp(-dt / 0.16));
        const curve = curveAmp * this.curveSign * (
            0.7 * Math.sin(0.37 * this.simT) + 0.3 * Math.sin(0.91 * this.simT + 1.3)
        );

        // Gates und Speed-Streaks fortschalten
        for (let i = 0; i < GATE_POOL_SIZE; i++) {
            const g = this.gates[i];
            if (!g.active) continue;
            g.z -= vEff * dt;
            if (g.z < 1.0) g.active = false;
        }

        const showStreaks = !isAfterglow && (state === 'climax' || this.ten > 0.70) && vis > 0.45;
        if (showStreaks) {
            for (let i = 0; i < STREAK_POOL_SIZE; i++) {
                const s = this.streaks[i];
                s.z -= vEff * 1.65 * dt;
                if (s.z < 0.8) this._resetStreak(s, true);
            }
        }

        // ---------------------------------------------------------
        // Geometrie unterhalb horizon = floor(0.55 * height)
        // ---------------------------------------------------------
        const horizon = Math.min(h - 1, Math.max(0, Math.floor(h * 0.55)));
        const H = h - horizon;
        if (H <= 0) return;

        const minDim = Math.min(w, h);
        const hwB = 0.5 * Math.min(0.92 * w, 1.05 * h);
        const roadWidthVis = (state === 'starting' || state === 'stopping') ? vis : 1.0;
        const hwScale = (1 + 0.04 * impulse) * roadWidthVis;
        const period = 0.28;
        const wipeProgress = this.wipeActive ? clamp01(this.wipeElapsed / WIPE_DURATION) : 1.0;
        const rainbowActive = this.rainbowKerbTimer > 0 && !isAfterglow;
        const mediumFlash = this.mediumFlashTimer > 0;
        const lit0 = this.laneLit[0] === 1;
        const lit1 = this.laneLit[1] === 1;
        const lit2 = this.laneLit[2] === 1;
        const sameLaneLit = (lit0 === lit1) && (lit1 === lit2);

        // 1. Scanlines r = 1..H (y = horizon .. h - 1)
        for (let r = 1; r <= H; r++) {
            const y = horizon + r - 1;
            const p = r / H;
            const z = H / r;
            const fam = FAMILIES[(this.wipeActive && p > wipeProgress) ? this.wipeFrom : this.famIdx];

            const inHaze = (period * r * r) / H < 1.5;
            const band = inHaze ? (r & 1) : (Math.floor((z + this.dist) / period) & 1);
            const kerbBand = inHaze ? (r & 1) : ((band ^ this.kerbPhase) & 1);

            const cx = w * 0.5 + curve * (1 - p) * (1 - p) * 0.30 * w;
            const hw = hwB * p * hwScale;
            const xl = Math.round(cx - hw);
            const xr = Math.round(cx + hw);
            const roadW = xr - xl;
            const kw = hw >= 2 ? Math.min(Math.floor(hw), Math.max(1, Math.round(hw * 0.10))) : 0;
            const kL = xl - kw;
            const kR = xr + kw;

            const grassColor = HEX[fam.grass[band]];
            const kerbColor = (rainbowActive && !inHaze)
                ? HEX[RAINBOW_KERB[(Math.floor(r / 3) + kerbBand) & 3]]
                : HEX[fam.kerb[kerbBand]];

            // Linkes Gras
            if (kL > 0) {
                ctx.fillStyle = grassColor;
                fr(ctx, 0, y, Math.min(w, kL), 1, w, horizon, h);
            }

            // Linker Kerb
            if (kw > 0 && xl > 0 && kL < w) {
                ctx.fillStyle = kerbColor;
                fr(ctx, kL, y, kw, 1, w, horizon, h);
            }

            // Straße (3 SID-Lanes + Mittelstriche)
            if (roadW > 0 && xr > 0 && xl < w) {
                if (sameLaneLit) {
                    ctx.fillStyle = HEX[lit0 ? fam.roadLit[band] : fam.road[band]];
                    fr(ctx, xl, y, roadW, 1, w, horizon, h);
                } else {
                    const l1 = Math.round(xl + roadW / 3);
                    const l2 = Math.round(xl + (2 * roadW) / 3);
                    if (l1 > xl) {
                        ctx.fillStyle = HEX[lit0 ? fam.roadLit[band] : fam.road[band]];
                        fr(ctx, xl, y, l1 - xl, 1, w, horizon, h);
                    }
                    if (l2 > l1) {
                        ctx.fillStyle = HEX[lit1 ? fam.roadLit[band] : fam.road[band]];
                        fr(ctx, l1, y, l2 - l1, 1, w, horizon, h);
                    }
                    if (xr > l2) {
                        ctx.fillStyle = HEX[lit2 ? fam.roadLit[band] : fam.road[band]];
                        fr(ctx, l2, y, xr - l2, 1, w, horizon, h);
                    }
                }

                // Mittelstriche an den Lane-Grenzen (nur band == 0, außerhalb Dunstzone, hw >= 6)
                if (!inHaze && band === 0 && hw >= 6) {
                    const mw = Math.max(1, Math.round(hw * 0.02));
                    const mOff = Math.floor(mw * 0.5);
                    const s1X = Math.round(xl + roadW / 3) - mOff;
                    const s2X = Math.round(xl + (2 * roadW) / 3) - mOff;
                    const baseStripe = mediumFlash ? fam.medCenter : fam.center;

                    ctx.fillStyle = HEX[(lit0 || lit1) ? 1 : baseStripe];
                    fr(ctx, s1X, y, mw, 1, w, horizon, h);

                    ctx.fillStyle = HEX[(lit1 || lit2) ? 1 : baseStripe];
                    fr(ctx, s2X, y, mw, 1, w, horizon, h);
                }
            }

            // Rechter Kerb
            if (kw > 0 && kR > 0 && xr < w) {
                ctx.fillStyle = kerbColor;
                fr(ctx, xr, y, kw, 1, w, horizon, h);
            }

            // Rechtes Gras
            if (kR < w) {
                ctx.fillStyle = grassColor;
                fr(ctx, kR, y, w - Math.max(0, kR), 1, w, horizon, h);
            }
        }

        // 2. Speed-Streaks (nur high/climax, Pool 12, außerhalb der Straße, geclippt)
        if (showStreaks) {
            this.floorClip.x = 0;
            this.floorClip.y = horizon;
            this.floorClip.width = w;
            this.floorClip.height = H;

            for (let i = 0; i < STREAK_POOL_SIZE; i++) {
                const s = this.streaks[i];
                const z0 = s.z;
                const z1 = Math.max(0.55, s.z - s.len);
                const p0 = 1 / z0;
                const p1 = 1 / z1;
                if (p0 > 1.0) continue;

                const y0 = horizon + H * p0 - 1;
                const y1 = Math.min(h - 1, horizon + H * p1 - 1);
                const cx0 = w * 0.5 + curve * (1 - p0) * (1 - p0) * 0.30 * w;
                const cx1 = w * 0.5 + curve * (1 - p1) * (1 - p1) * 0.30 * w;
                const hw0 = hwB * p0 * hwScale;
                const hw1 = hwB * p1 * hwScale;

                const x0 = cx0 + s.side * hw0 * s.offsetRatio;
                const x1 = cx1 + s.side * hw1 * s.offsetRatio;
                const streakColor = (i & 1) === 0 ? HEX[1] : HEX[15];
                drawAliasedLineClipped(ctx, x0, y0, x1, y1, streakColor, this.floorClip);
            }
        }

        // 3. Einheitlicher Z-Painter-Pass (fern -> nah) für Pylonen & Gates
        if (!isAfterglow && vis > 0.35) {
            let propCount = 0;

            if (this.ten >= 0.35) {
                for (let k = 0; k < PYLON_COUNT; k++) {
                    const rawZ = k * 0.55 - this.dist;
                    const zk = (((rawZ % 5.5) + 5.5) % 5.5) + 1.0;
                    const rk = H / zk;
                    if (rk < 1 || rk > H) continue;
                    this.propZ[propCount] = zk;
                    this.propType[propCount] = 0;
                    this.propIndex[propCount] = k;
                    this.propOrder[propCount] = propCount;
                    propCount++;
                }
            }

            for (let i = 0; i < GATE_POOL_SIZE; i++) {
                const g = this.gates[i];
                if (!g.active) continue;
                const rg = H / g.z;
                if (rg < 1 || rg > H) continue;
                this.propZ[propCount] = g.z;
                this.propType[propCount] = 1;
                this.propIndex[propCount] = i;
                this.propOrder[propCount] = propCount;
                propCount++;
            }

            // Insertion-Sort absteigend nach z (größtes z zuerst = am weitesten entfernt)
            for (let i = 1; i < propCount; i++) {
                const keyIdx = this.propOrder[i];
                const keyZ = this.propZ[keyIdx];
                let j = i - 1;
                while (j >= 0 && this.propZ[this.propOrder[j]] < keyZ) {
                    this.propOrder[j + 1] = this.propOrder[j];
                    j--;
                }
                this.propOrder[j + 1] = keyIdx;
            }

            const headHex = HEX[mediumFlash ? 7 : 2];
            const bodyHex = HEX[1];
            const outlineHex = HEX[0];

            for (let idx = 0; idx < propCount; idx++) {
                const item = this.propOrder[idx];
                const zItem = this.propZ[item];
                const pItem = 1 / zItem;
                const rItem = H * pItem;
                const baseY = Math.round(horizon + rItem - 1);
                const cxItem = w * 0.5 + curve * (1 - pItem) * (1 - pItem) * 0.30 * w;
                const hwItem = hwB * pItem * hwScale;

                if (this.propType[item] === 0) {
                    // Pylonen-Paar
                    const pylonH = Math.max(2, Math.round(0.12 * minDim * pItem));
                    const pylonW = Math.max(1, Math.round(pylonH / 4));
                    const topY = baseY - pylonH;
                    const headH = Math.min(2, pylonH);
                    const bodyH = pylonH - headH;
                    const lx = Math.round(cxItem - hwItem * 1.18 - pylonW * 0.5);
                    const rx = Math.round(cxItem + hwItem * 1.18 - pylonW * 0.5);

                    ctx.fillStyle = outlineHex;
                    fr(ctx, lx - 1, topY - 1, pylonW + 2, pylonH + 2, w, horizon, h);
                    ctx.fillStyle = headHex;
                    fr(ctx, lx, topY, pylonW, headH, w, horizon, h);
                    if (bodyH > 0) {
                        ctx.fillStyle = bodyHex;
                        fr(ctx, lx, topY + headH, pylonW, bodyH, w, horizon, h);
                    }

                    ctx.fillStyle = outlineHex;
                    fr(ctx, rx - 1, topY - 1, pylonW + 2, pylonH + 2, w, horizon, h);
                    ctx.fillStyle = headHex;
                    fr(ctx, rx, topY, pylonW, headH, w, horizon, h);
                    if (bodyH > 0) {
                        ctx.fillStyle = bodyHex;
                        fr(ctx, rx, topY + headH, pylonW, bodyH, w, horizon, h);
                    }
                } else {
                    // Hard-Beat Gate
                    const fam = FAMILIES[(this.wipeActive && pItem > wipeProgress) ? this.wipeFrom : this.famIdx];
                    const postH = Math.max(4, Math.round(0.20 * minDim * pItem));
                    const postW = Math.max(2, Math.round(postH * 0.14));
                    const barH = Math.max(2, Math.round(postW * 0.9));
                    const topY = Math.max(horizon, baseY - postH);
                    const actualH = Math.max(2, baseY - topY);

                    const leftPostX = Math.round(cxItem - hwItem - postW);
                    const rightPostX = Math.round(cxItem + hwItem);
                    const spanW = Math.max(postW * 2, rightPostX + postW - leftPostX);

                    ctx.fillStyle = outlineHex;
                    fr(ctx, leftPostX - 1, topY - 1, postW + 2, actualH + 2, w, horizon, h);
                    fr(ctx, rightPostX - 1, topY - 1, postW + 2, actualH + 2, w, horizon, h);
                    fr(ctx, leftPostX - 1, topY - 1, spanW + 2, barH + 2, w, horizon, h);

                    ctx.fillStyle = HEX[fam.gate];
                    fr(ctx, leftPostX, topY, postW, actualH, w, horizon, h);
                    fr(ctx, rightPostX, topY, postW, actualH, w, horizon, h);
                    fr(ctx, leftPostX, topY, spanW, barH, w, horizon, h);
                }
            }
        }

        // 4. Bayer-Fade nur unterhalb horizon bei vis < 1
        if (vis < 1.0) {
            bayerFadeCells(ctx, 0, horizon, w, H, vis, 2, HEX[0]);
        }
    }
}