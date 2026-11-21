// =========================================================
// DEMO-SCENE-ELEMENT: AMIGA VOXEL HILLS (Floor)
// Echter Comanche-Style Height-Map-Raycaster (128x128 wrappend)
// mit gewundener Canyon-Flugbahn, markantem 3D-Relief,
// frei ueber den Horizont ragenden Berggipfeln (leerer Himmel
// bleibt transparent) und 4x256 Paula-Gebirgsketten [0,3,1,2].
// =========================================================

import { createXorshift32, bayerFadeCells } from '../../utils/hardware-constraints.js';
import {
    RAMPS,
    INK,
    CH_RAMPS,
    PAULA_LRRL,
    TRANSITION_IN,
    TRANSITION_OUT
} from './amiga-kit.js';

const TWO_PI = Math.PI * 2;
const MAP_SIZE = 128;
const MAP_MASK = 127;
const RIDGE_RING = 256;
const RIDGE_MASK = 255;

const TERRAIN_RAMPS = Object.freeze(['JADE', 'GOLD', 'STEEL', 'MAGMA']);
const FALLBACK_TENSION = Object.freeze({
    playing: 0.30,
    buildup: 0.65,
    climax: 1.0,
    afterglow: 0.20
});

const clamp01 = (v) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
const lerp = (a, b, k) => a + (b - a) * k;

function samplePeriodicNoise(grid, gridSize, fx, fz) {
    const mask = gridSize - 1;
    const x0 = Math.floor(fx);
    const z0 = Math.floor(fz);
    const tx = fx - x0;
    const tz = fz - z0;
    const sx = tx * tx * (3 - 2 * tx);
    const sz = tz * tz * (3 - 2 * tz);

    const ix0 = x0 & mask;
    const ix1 = (ix0 + 1) & mask;
    const iz0 = z0 & mask;
    const iz1 = (iz0 + 1) & mask;

    const n00 = grid[iz0 * gridSize + ix0];
    const n10 = grid[iz0 * gridSize + ix1];
    const n01 = grid[iz1 * gridSize + ix0];
    const n11 = grid[iz1 * gridSize + ix1];
    return lerp(lerp(n00, n10, sx), lerp(n01, n11, sx), sz);
}

function buildTerrainMaps() {
    const rng = createXorshift32(0x564f584c); // 'VOXL'
    const grid16 = new Float32Array(16 * 16);
    const grid32 = new Float32Array(32 * 32);
    for (let i = 0; i < grid16.length; i++) grid16[i] = rng.float();
    for (let i = 0; i < grid32.length; i++) grid32[i] = rng.float();

    const hm = new Uint8Array(MAP_SIZE * MAP_SIZE);
    const cm = new Uint8Array(MAP_SIZE * MAP_SIZE);

    for (let z = 0; z < MAP_SIZE; z++) {
        for (let x = 0; x < MAP_SIZE; x++) {
            // Mehrere dichte Berg-Frequenzen (Wellenlaengen 8..32 Einheiten)
            const nLarge = samplePeriodicNoise(grid16, 16, x / 8, z / 8);   // 8u Zellen
            const nMed = samplePeriodicNoise(grid32, 32, x / 4, z / 4);     // 4u Kegel/Kaemme
            const rLarge = 1 - Math.abs(2 * nLarge - 1);
            const rMed = 1 - Math.abs(2 * nMed - 1);

            const o1 = 0.42 * Math.sin((TWO_PI * 4 * x) / MAP_SIZE) * Math.cos((TWO_PI * 4 * z) / MAP_SIZE + 0.5);
            const o2 = 0.34 * Math.sin((TWO_PI * 8 * (x + z)) / MAP_SIZE + 1.1);
            const o3 = 0.24 * Math.cos((TWO_PI * 16 * (x - z)) / MAP_SIZE + 2.3);
            const octNorm = 0.5 + 0.5 * (o1 + o2 + o3);

            const combined = clamp01(0.42 * rLarge + 0.33 * rMed + 0.25 * octNorm);
            const shaped = Math.pow(clamp01((combined - 0.14) / 0.72), 1.2);
            hm[(z << 7) | x] = Math.round(shaped * 255);
        }
    }

    // 2D-Sonnenlicht-Shading (Licht von vorne links) fuer klare Bergflanken und Vordergrund-Relief
    for (let z = 0; z < MAP_SIZE; z++) {
        const rowOff = z << 7;
        const zmOff = ((z - 1) & MAP_MASK) << 7;
        const zpOff = ((z + 1) & MAP_MASK) << 7;
        for (let x = 0; x < MAP_SIZE; x++) {
            const xm = (x - 1) & MAP_MASK;
            const xp = (x + 1) & MAP_MASK;
            const sx = hm[rowOff | xm] - hm[rowOff | xp];
            const sz = hm[zpOff | x] - hm[zmOff | x];
            const slopeRaw = sx * 1.1 + sz * 0.85;
            const slope = Math.max(-2, Math.min(2, Math.round(slopeRaw / 18)));
            const base = 1 + Math.floor((hm[rowOff | x] / 255) * 3.4);
            let lvl = base + slope;
            if (lvl < 0) lvl = 0;
            else if (lvl > 5) lvl = 5;
            cm[rowOff | x] = lvl;
        }
    }

    return { hm, cm };
}

const MAPS = buildTerrainMaps();

function winding(z) {
    return 6 * Math.sin(0.045 * z);
}

export class AmigaVoxelHills {
    constructor() {
        this.name = 'Amiga Voxel Hills';

        // Zeit- und Zustandsverfolgung
        this.lastT = null;
        this.simTime = 0;
        this.lastState = 'idle';
        this.stateAge = 0;
        this.palAcc = 0;

        // Kamera & kontinuierliche Phase (bleibt bei Resize/Rotation erhalten)
        this.camZ = 8.0;
        this.ten = 0.2;
        this.yawSign = 1;
        this.yawSignTarget = 1;
        this.yawKick = 0;
        this.yawKickTimer = 0;

        // Diskreter Beat- & Terrainzustand
        this.lastBeatCount = 0;
        this.hardCooldown = 0;
        this.terrain = 0;
        this.wipeFrom = TERRAIN_RAMPS[0];
        this.wipeTo = TERRAIN_RAMPS[0];
        this.wipeT0 = -10;

        // Konturband-Effekt (soft/medium/hard)
        this.contourActive = false;
        this.contourZ = 0;
        this.contourHalfW = 0.8;
        this.contourBoost = 1;

        // Paula-Wasserfall-Ringpuffer: 4 Lanes x 256 Zellen
        this.ridge = new Float32Array(4 * RIDGE_RING);
        this.lastSpawnCell = null;
        this.ridgeBoostPending = false;

        // Spaltenpuffer & optionale Budget-Schutzstufe
        this.yTop = new Int16Array(0);
        this.colWBoost = 0;
        this.zMaxCap = 58;

        // Diagnostik fuer Tests & Messung
        this.lastSamples = 0;
        this.lastSpawnStepCells = 0;
        this.lastMonotonicYTop = true;
        this.lastAllFinite = true;
        this.lastContourBoost = 0;
        this.lastContourWidth = 0;
        this.lastMaxYawKick = 0;
        this.lastMinPeakY = 256;
    }

    resize(width) {
        if (Number.isFinite(width) && width > 0) {
            const w = Math.floor(width);
            const colW = (w <= 300 ? 2 : (w <= 520 ? 3 : 4)) + this.colWBoost;
            const nCols = Math.ceil(w / colW);
            if (this.yTop.length < nCols) {
                this.yTop = new Int16Array(nCols);
            }
        }
    }

    _setTerrainRamp(nextRampName) {
        if (nextRampName === this.wipeTo) return;
        const p = clamp01((this.simTime - this.wipeT0) / 0.6);
        if (p >= 1 || p > 0.5) {
            this.wipeFrom = this.wipeTo;
        }
        this.wipeTo = nextRampName;
        this.wipeT0 = this.simTime;
    }

    _stepRidgeSpawn(ch, ridgeGain, isAfterglow, zMax) {
        const targetCell = Math.floor((this.camZ + 0.92 * zMax) / 0.5);
        if (this.lastSpawnCell === null) {
            this.lastSpawnCell = targetCell - 110;
        }
        if (targetCell - this.lastSpawnCell > 64) {
            this.lastSpawnCell = targetCell - 64;
        }

        let spawned = 0;
        const agMul = isAfterglow ? 0.5 : 1.0;
        const beatMul = this.ridgeBoostPending ? 1.4 : 1.0;

        while (this.lastSpawnCell < targetCell && spawned < 64) {
            this.lastSpawnCell++;
            const c = this.lastSpawnCell & RIDGE_MASK;
            for (let lane = 0; lane < 4; lane++) {
                const chIdx = PAULA_LRRL[lane];
                this.ridge[(lane << 8) | c] = ch[chIdx] * ridgeGain * agMul * beatMul;
            }
            spawned++;
        }

        if (spawned > 0) {
            this.ridgeBoostPending = false;
        }
        this.lastSpawnStepCells = spawned;
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

        if (this.yawKickTimer > 0) {
            this.yawKickTimer = Math.max(0, this.yawKickTimer - dt);
            this.yawKick *= Math.exp(-dt / 0.10);
            if (this.yawKickTimer <= 0) this.yawKick = 0;
        }

        // Sichtbarkeit & Horizont-Referenz
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

        // ---------------------------------------------------------
        // Diskrete Beat-Reaktionen
        // ---------------------------------------------------------
        const isAfterglow = state === 'afterglow';
        const allowDiscrete = !isAfterglow && state !== 'stopping';

        if (onBeat && allowDiscrete) {
            if (level === 1) {
                this.contourActive = true;
                this.contourZ = 1.2;
                this.contourHalfW = 0.6;
                this.contourBoost = 1;
                this.lastContourBoost = 1;
                this.lastContourWidth = 1.2;
            } else if (level === 2) {
                this.contourActive = true;
                this.contourZ = 1.2;
                this.contourHalfW = 0.6;
                this.contourBoost = 2;
                this.ridgeBoostPending = true;
                this.lastContourBoost = 2;
                this.lastContourWidth = 1.2;
            } else if (level === 3) {
                if (this.hardCooldown <= 0) {
                    this.contourActive = true;
                    this.contourZ = 1.2;
                    this.contourHalfW = 1.2;
                    this.contourBoost = 3;
                    this.yawKick = 0.08 * dir;
                    this.yawKickTimer = 0.3;
                    this.hardCooldown = 0.25;
                    this.lastContourBoost = 3;
                    this.lastContourWidth = 2.4;
                    this.lastMaxYawKick = Math.abs(this.yawKick);
                }
            }

            if (count > 0 && count % 4 === 0) {
                this.terrain = (this.terrain + 1) & 3;
            }
            if (count > 0 && count % 8 === 0) {
                this.yawSignTarget = -this.yawSignTarget;
            }
        }

        const targetTerrainRamp = isAfterglow ? 'STEEL' : TERRAIN_RAMPS[this.terrain];
        this._setTerrainRamp(targetTerrainRamp);

        // ---------------------------------------------------------
        // Kamera-, Yaw- und 50-Hz-Ruecken-Simulation
        // ---------------------------------------------------------
        if (this.yawSign !== this.yawSignTarget) {
            const maxStep = (2 * dt) / 0.5;
            const diff = this.yawSignTarget - this.yawSign;
            this.yawSign = Math.abs(diff) <= maxStep ? this.yawSignTarget : this.yawSign + Math.sign(diff) * maxStep;
        }

        const vBase = lerp(8, 32, this.ten) * (isAfterglow ? 0.3 : 1.0);
        const vEff = vBase * (1 + 0.4 * impulse);
        this.camZ += vEff * dt;

        const camX = winding(this.camZ);
        const camZ = this.camZ;
        const hm = MAPS.hm;
        const cm = MAPS.cm;

        if (this.contourActive) {
            this.contourZ += 40 * dt;
            if (this.contourZ > this.zMaxCap + 4) {
                this.contourActive = false;
            }
        }

        const ridgeGain = lerp(0.6, 1.4, this.ten);
        this.palAcc += dt;
        let palSteps = 0;
        while (this.palAcc >= 0.02 && palSteps++ < 4) {
            this._stepRidgeSpawn(ch, ridgeGain, isAfterglow, this.zMaxCap);
            this.palAcc -= 0.02;
        }
        if (palSteps === 0 && this.lastSpawnCell === null) {
            this._stepRidgeSpawn(ch, ridgeGain, isAfterglow, this.zMaxCap);
        }

        // ---------------------------------------------------------
        // Echte 3D-Voxel-Projektion & Spaltenbudget
        // ---------------------------------------------------------
        const minDim = Math.min(w, h);
        const aspect = w / h;
        const baseColW = w <= 300 ? 2 : (w <= 520 ? 3 : 4);
        const colW = baseColW + this.colWBoost;
        const nCols = Math.ceil(w / colW);
        if (this.yTop.length < nCols) {
            this.yTop = new Int16Array(nCols);
        }

        const zMax = this.zMaxCap;
        const spread = Math.min(1.4, Math.max(0.55, 0.4 + 0.35 * aspect));
        const yawAmp = lerp(0.05, 0.35, this.ten);
        const psi = yawAmp * this.yawSign * Math.sin(0.21 * this.simTime) + this.yawKick;
        const sinPsi = Math.sin(psi);
        const cosPsi = Math.cos(psi);

        // Hohe vertikale Brennweite (140..230 px bei 256px Hoehe) fuer plastische 3D-Berge
        let vs = lerp(0.55, 0.90, this.ten) * minDim * (1 + 0.12 * impulse);
        if (isAfterglow) vs = Math.min(vs, 0.58 * minDim);
        const camAlt = 0.72;
        const skyCeilingY = Math.max(0, Math.floor(h * 0.14));

        const wipeP = clamp01((this.simTime - this.wipeT0) / 0.6);
        const rampNew = RAMPS[this.wipeTo];
        const rampOld = RAMPS[this.wipeFrom];
        const ridge = this.ridge;
        const spawnHead = this.lastSpawnCell ?? 0;
        const ridgeMinCell = spawnHead - RIDGE_RING;
        const invRidgeGain = 1 / Math.max(0.1, ridgeGain);
        const heightScale = vis;

        const contourOn = this.contourActive;
        const contourZ = this.contourZ;
        const contourHalfW = this.contourHalfW;
        const contourBoost = this.contourBoost;

        const fr = (rx, ry, rw, rh) => {
            const x0 = Math.max(0, Math.round(rx));
            const y0 = Math.max(skyCeilingY, Math.round(ry));
            const x1 = Math.min(w, Math.round(rx + rw));
            const y1 = Math.min(h, Math.round(ry + rh));
            const fw = x1 - x0;
            const fh = y1 - y0;
            if (fw > 0 && fh > 0) {
                ctx.fillRect(x0, y0, fw, fh);
            }
        };

        let totalSamples = 0;
        let monotonicOk = true;
        let allFinite = true;
        let minPeakY = h;

        const renderStartMs = (typeof performance !== 'undefined' && typeof performance.now === 'function')
            ? performance.now()
            : 0;

        // ---------------------------------------------------------
        // Spalten-Raycasting (nah -> fern, Canyon + freie Berggipfel)
        // ---------------------------------------------------------
        for (let col = 0; col < nCols; col++) {
            const colX = col * colW;
            const colWActual = Math.min(colW, w - colX);
            if (colWActual <= 0) continue;

            const dxRay = (((col + 0.5) * colW) / w - 0.5) * 2 * spread;
            const rayDirX = sinPsi + dxRay * cosPsi;
            const rayDirZ = cosPsi - dxRay * sinPsi;

            let yTop = h;
            this.yTop[col] = yTop;

            let pendHex = '';
            let pendY0 = 0;
            let pendY1 = 0;
            let hasPend = false;

            let z = 0.75;
            let dz = 0.28;

            while (z <= zMax && yTop > skyCeilingY && totalSamples < 12000) {
                totalSamples++;
                const wx = camX + rayDirX * z;
                const wz = camZ + rayDirZ * z;
                const mapIdx = ((Math.floor(wz) & MAP_MASK) << 7) | (Math.floor(wx) & MAP_MASK);

                // Canyon-Schneise entlang winding(z): sanfte Talsohle im unmittelbaren Zentrum,
                // markante Flanken und Gipfel bis 1.18 rechts/links und in den Kurven voraus
                const windX = winding(wz);
                const dCenter = Math.abs(wx - windX);
                const canyonMask = dCenter < 2.6 ? (0.35 + 0.65 * (dCenter / 2.6)) : 1.0;

                let heightVal = (hm[mapIdx] / 255) * 1.18 * canyonMask;
                let useRidge = false;
                let ridgeShade = 0;

                // 4 Paula-Gebirgszuege bei -8.25, -2.75, +2.75, +8.25 (Abstand 5.5, Breite +-2.8)
                const laneFloat = (wx - windX) / 5.5 + 1.5;
                const kk = Math.round(laneFloat);
                if (kk >= 0 && kk <= 3) {
                    const laneCenter = windX + (kk - 1.5) * 5.5;
                    const dLane = Math.abs(wx - laneCenter);
                    if (dLane < 2.8) {
                        const cellAbs = Math.floor(wz * 2);
                        if (cellAbs <= spawnHead && cellAbs > ridgeMinCell) {
                            const rVal = ridge[(kk << 8) | (cellAbs & RIDGE_MASK)];
                            const falloff = 1 - (dLane / 2.8) * (dLane / 2.8);
                            const rContrib = 0.72 * rVal * falloff;
                            if (rContrib > 0) {
                                heightVal += rContrib;
                                if (rContrib > 0.06) {
                                    useRidge = true;
                                    const sideSlope = (wx < laneCenter ? 1 : -1);
                                    ridgeShade = clamp01(rVal * invRidgeGain * falloff) + sideSlope * 0.14;
                                }
                            }
                        }
                    }
                }

                heightVal *= heightScale;
                if (heightVal > 2.2) heightVal = 2.2;
                if (!Number.isFinite(heightVal)) allFinite = false;

                const yScRaw = horizon + ((camAlt - heightVal) * vs) / z;
                if (!Number.isFinite(yScRaw)) allFinite = false;
                let ySc = Math.floor(yScRaw);
                if (ySc < skyCeilingY) ySc = skyCeilingY;

                if (ySc < yTop) {
                    const prevTop = this.yTop[col];
                    if (ySc > prevTop) monotonicOk = false;
                    this.yTop[col] = ySc;
                    if (ySc < minPeakY) minPeakY = ySc;

                    const fogDrop = z >= 46 ? 2 : (z >= 26 ? 1 : 0);
                    const inContour = contourOn && Math.abs(z - contourZ) <= contourHalfW;

                    let lvl;
                    let ramp;
                    if (useRidge) {
                        const chIdx = PAULA_LRRL[kk];
                        ramp = RAMPS[CH_RAMPS[chIdx]];
                        lvl = 2 + Math.round(clamp01(ridgeShade) * 3) - fogDrop;
                        if (isAfterglow) lvl -= 2;
                    } else {
                        const q = 1 - z / zMax;
                        ramp = q <= wipeP ? rampNew : rampOld;
                        lvl = cm[mapIdx] - fogDrop;
                    }

                    if (inContour) lvl += contourBoost;
                    if (lvl < 0) lvl = 0;
                    else if (lvl > 5) lvl = 5;

                    if (!useRidge && z > 48 && lvl <= 1 && ((ySc & 1) === 1)) {
                        lvl = 0;
                    }

                    const hex = ramp[lvl];
                    if (!hasPend) {
                        pendHex = hex;
                        pendY0 = ySc;
                        pendY1 = yTop;
                        hasPend = true;
                    } else if (hex === pendHex && yTop === pendY0) {
                        pendY0 = ySc;
                    } else {
                        ctx.fillStyle = pendHex;
                        fr(colX, pendY0, colWActual, pendY1 - pendY0);
                        pendHex = hex;
                        pendY0 = ySc;
                        pendY1 = yTop;
                    }

                    yTop = ySc;
                }

                z += dz;
                dz *= 1.045;
            }

            // Bodenebene ab horizon lueckenlos schliessen; leerer Himmel bleibt transparent
            if (yTop > horizon) {
                const fogHex = (wipeP >= 1 ? rampNew : rampOld)[0];
                if (hasPend && pendHex === fogHex && yTop === pendY0) {
                    pendY0 = horizon;
                } else {
                    if (hasPend) {
                        ctx.fillStyle = pendHex;
                        fr(colX, pendY0, colWActual, pendY1 - pendY0);
                    }
                    pendHex = fogHex;
                    pendY0 = horizon;
                    pendY1 = yTop;
                    hasPend = true;
                }
            }

            if (hasPend) {
                ctx.fillStyle = pendHex;
                fr(colX, pendY0, colWActual, pendY1 - pendY0);
            }

            // 1px INK-Kammkontur nur auf ueber den Horizont ragenden Berggipfeln
            if (yTop < horizon && yTop >= skyCeilingY) {
                ctx.fillStyle = INK;
                fr(colX, yTop, colWActual, 1);
            }
        }

        this.lastSamples = totalSamples;
        this.lastMonotonicYTop = monotonicOk;
        this.lastAllFinite = allFinite;
        this.lastMinPeakY = minPeakY;

        if (renderStartMs > 0 && (performance.now() - renderStartMs) > 16) {
            if (this.zMaxCap > 48) {
                this.zMaxCap = 48;
            } else if (this.colWBoost < 2) {
                this.colWBoost++;
            }
        }

        if (vis < 1) {
            bayerFadeCells(ctx, 0, horizon, w, H, vis, 2, INK);
        }
    }
}