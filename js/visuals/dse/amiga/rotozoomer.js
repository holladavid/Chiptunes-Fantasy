// =========================================================
// DEMO-SCENE-ELEMENT: AMIGA ROTOZOOMER (Background)
// 4x4-Chunky-inspirierter Amiga OCS Rotozoomer mit 4 kachelnden
// 64x64 Texturen, Kaleidoskop-Faltung, vertikalen Copper-Wipes,
// Paula L-R-R-L Zonenglanz & Copper-Vignette.
// =========================================================

import { bayerFadeCells } from '../../utils/hardware-constraints.js';
import {
    RAMPS,
    INK,
    FAM,
    PAULA_LRRL,
    PP6,
    TRANSITION_IN,
    TRANSITION_OUT
} from './amiga-kit.js';

const TWO_PI = Math.PI * 2;
const FALLBACK_TENSION = Object.freeze({
    playing: 0.30,
    buildup: 0.65,
    climax: 1.0,
    afterglow: 0.20
});

const clamp01 = (v) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
const lerp = (a, b, k) => a + (b - a) * k;

function hashInt(n) {
    let x = (n | 0) ^ 0x9e3779b9;
    x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
    x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
    return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

function buildTextures() {
    const t0 = new Uint8Array(4096); // Diamanten
    const t1 = new Uint8Array(4096); // Schachbrett mit Fase
    const t2 = new Uint8Array(4096); // Ziegel
    const t3 = new Uint8Array(4096); // Interferenz

    for (let v = 0; v < 64; v++) {
        const fv = Math.abs(((v + 32) & 63) - 32);
        const row = v >> 3;
        const vEdge = v & 7;
        const mv = v & 15;
        const sinV = Math.sin((TWO_PI * 3 * v) / 64);

        for (let u = 0; u < 64; u++) {
            const idx = (v << 6) | u;
            const fu = Math.abs(((u + 32) & 63) - 32);

            // T0: Diamanten
            t0[idx] = ((fu + fv) >> 2) % 6;

            // T1: Schachbrett mit Fase
            const base = (((u >> 4) ^ (v >> 4)) & 1) ? 4 : 1;
            const mu = u & 15;
            if (mu === 0 || mv === 0) {
                t1[idx] = base + 1;
            } else if (mu === 15 || mv === 15) {
                t1[idx] = base - 1;
            } else {
                t1[idx] = base;
            }

            // T2: Ziegel (8px hoch, 16px breit, ungerade Reihen +8 versetzt)
            const uEff = (row & 1) ? ((u + 8) & 63) : u;
            if (vEdge === 0 || (uEff & 15) === 0) {
                t2[idx] = 0;
            } else {
                const brickId = row * 4 + (uEff >> 4);
                t2[idx] = 2 + ((brickId * 5) % 3);
            }

            // T3: Sinus-Interferenz (gleichmaessig auf 0..5 skaliert)
            const sinU = Math.sin((TWO_PI * 2 * u) / 64);
            const raw = Math.floor(3 + 1.55 * sinU + 1.55 * sinV);
            t3[idx] = raw < 0 ? 0 : (raw > 5 ? 5 : raw);
        }
    }

    return Object.freeze([t0, t1, t2, t3]);
}

const TEXTURES = buildTextures();

export class AmigaRotoZoomer {
    constructor() {
        this.name = 'Amiga RotoZoomer';

        // Zeit & Zustandsverfolgung
        this.lastT = null;
        this.simTime = 0;
        this.lastState = 'idle';
        this.stateAge = 0;

        // Kontinuierliche Simulationsphasen (bleiben bei Resize/Rotation erhalten)
        this.theta = 0;
        this.ou = 16;
        this.ov = 16;
        this.ten = 0.2;
        this.rotSign = 1;
        this.rotSignTarget = 1;
        this.snap = 1.0;

        // Diskreter Beat- & Musterzustand
        this.lastBeatCount = 0;
        this.hardCooldown = 0;
        this.shift = 0;

        // Textur & Wipe (0.5s vertikale Kante)
        this.tex = 0;
        this.texPrev = 0;
        this.texWipeT0 = -10;

        // Kaleidoskop & Pending-Regel (Beat oder 1.2s)
        this.kMode = 0;
        this.kPrev = 0;
        this.kTarget = 0;
        this.kPendingAge = 0;
        this.kWipeT0 = -10;

        // Rampenfamilie & Wipe (0.6s)
        this.fam = 0;
        this.wipeFrom = FAM[0];
        this.wipeTo = FAM[0];
        this.wipeT0 = -10;

        // Copper-Band-Event (medium/hard Beat)
        this.copperTimer = 0;
        this.copperYFrac = 0.5;
        this.copperHFrac = 0.08;
    }

    resize() {
        // Zellraster leitet sich direkt aus (width, height) ab;
        // kontinuierliche Koordinaten (theta, ou, ov) bleiben erhalten.
    }

    _setRamp(nextRampName) {
        if (nextRampName === this.wipeTo) return;
        const progress = clamp01((this.simTime - this.wipeT0) / 0.6);
        this.wipeFrom = progress < 1 ? (progress > 0.5 ? this.wipeTo : this.wipeFrom) : this.wipeTo;
        this.wipeTo = nextRampName;
        this.wipeT0 = this.simTime;
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
        this.copperTimer = Math.max(0, this.copperTimer - dt);

        // Sichtbarkeit (starting / stopping ueber StageManager 1.5s)
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
        const ch = (c) => (smooth && c < smooth.length ? clamp01(smooth[c]) : 0);

        // ---------------------------------------------------------
        // Diskrete Beat-Reaktionen
        // ---------------------------------------------------------
        const allowDiscrete = state !== 'afterglow' && state !== 'stopping';
        if (onBeat && allowDiscrete) {
            if (level === 1) {
                this.shift = (this.shift + 1) % 10;
            } else if (level === 2) {
                this.shift = (this.shift + 2) % 10;
                this.copperTimer = 0.15;
                this.copperYFrac = hashInt(count * 31 + 7) * 0.92;
                this.copperHFrac = 0.08;
            } else if (level === 3) {
                this.shift = (this.shift + 3) % 10;
                if (this.hardCooldown <= 0) {
                    this.snap = 1.25;
                    this.copperTimer = 0.12;
                    this.copperYFrac = hashInt(count * 53 + 11) * 0.88;
                    this.copperHFrac = 0.12;
                    this.hardCooldown = 0.25;
                }
            }

            if (count > 0 && count % 4 === 0) {
                this.texPrev = this.tex;
                this.tex = (this.tex + 1) & 3;
                this.texWipeT0 = this.simTime;
            }
            if (count > 0 && count % 8 === 0) {
                this.rotSignTarget = -this.rotSignTarget;
                this.fam = (this.fam + 1) & 3;
            }
        }

        // Afterglow vs aktive Rampe per Wipe
        const targetRampName = state === 'afterglow' ? 'STEEL' : FAM[this.fam];
        this._setRamp(targetRampName);

        // Kaleidoskop-Hysterese & Pending-Regel (Beat oder 1.2s ohne Beat)
        if (state === 'afterglow' || state === 'stopping') {
            this.kTarget = 0;
            if (state === 'afterglow' && this.kMode !== 0) {
                this.kPrev = this.kMode;
                this.kMode = 0;
                this.kWipeT0 = this.simTime;
                this.kPendingAge = 0;
            }
        } else {
            if (this.kTarget === 0) {
                if (this.ten >= 0.38) this.kTarget = this.ten >= 0.73 ? 2 : 1;
            } else if (this.kTarget === 1) {
                if (this.ten < 0.32) this.kTarget = 0;
                else if (this.ten >= 0.73) this.kTarget = 2;
            } else {
                if (this.ten < 0.32) this.kTarget = 0;
                else if (this.ten < 0.67) this.kTarget = 1;
            }

            if (this.kTarget !== this.kMode) {
                this.kPendingAge += dt;
                if (onBeat || this.kPendingAge >= 1.2) {
                    this.kPrev = this.kMode;
                    this.kMode = this.kTarget;
                    this.kWipeT0 = this.simTime;
                    this.kPendingAge = 0;
                }
            } else {
                this.kPendingAge = 0;
            }
        }

        // ---------------------------------------------------------
        // Kontinuierliche Kinematik (Slew & Integration)
        // ---------------------------------------------------------
        if (this.rotSign !== this.rotSignTarget) {
            const maxStep = (2 * dt) / 0.25; // 0.25s volle Umkehr
            const diff = this.rotSignTarget - this.rotSign;
            this.rotSign = Math.abs(diff) <= maxStep ? this.rotSignTarget : this.rotSign + Math.sign(diff) * maxStep;
        }

        this.snap = 1 + (this.snap - 1) * Math.exp(-dt / 0.2);

        const speedMul = state === 'afterglow' ? 0.3 : 1.0;
        const omega = lerp(0.25, 1.4, this.ten) * this.rotSign * speedMul;
        const drift = lerp(6, 40, this.ten) * speedMul;

        this.theta = (this.theta + omega * dt) % TWO_PI;
        const driftAngle = 0.7 * this.simTime;
        this.ou = (this.ou + Math.cos(driftAngle) * drift * dt) % 64;
        this.ov = (this.ov + Math.sin(driftAngle) * drift * dt) % 64;
        if (this.ou < 0) this.ou += 64;
        if (this.ov < 0) this.ov += 64;

        // ---------------------------------------------------------
        // Projektion & Zellraster (max. 6000 Zellen)
        // ---------------------------------------------------------
        const minDim = Math.min(w, h);
        let cell = Math.max(3, Math.ceil(Math.sqrt((w * h) / 6000)));
        while (Math.ceil(w / cell) * Math.ceil(h / cell) > 6000) {
            cell++;
        }
        const cols = Math.ceil(w / cell);
        const rows = Math.ceil(h / cell);

        const zoomAmp = state === 'afterglow' ? 0.15 : lerp(0.22, 0.42, this.ten);
        const zoomBase = 1 + zoomAmp * Math.sin(0.55 * this.simTime);
        const zFactor = zoomBase * this.snap * (1 + 0.35 * impulse) * (1 + 3 * (1 - vis));
        const sc = 64 / Math.max(1, 0.42 * minDim) / Math.max(0.05, zFactor);

        const thetaEff = this.theta + 0.18 * impulse * dir;
        const cosT = Math.cos(thetaEff) * sc;
        const sinT = Math.sin(thetaEff) * sc;
        const cx = w * 0.5;
        const cy = h * 0.5;
        const ou = this.ou;
        const ov = this.ov;

        // Wipe-Grenzen (Pixel X)
        const texP = clamp01((this.simTime - this.texWipeT0) / 0.5);
        const texWipeX = texP >= 1 ? w + 1 : texP * w;

        const kP = clamp01((this.simTime - this.kWipeT0) / 0.5);
        const kWipeX = kP >= 1 ? w + 1 : kP * w;

        const rampP = clamp01((this.simTime - this.wipeT0) / 0.6);
        const rampWipeX = rampP >= 1 ? w + 1 : rampP * w;
        const rampNew = RAMPS[this.wipeTo];
        const rampOld = RAMPS[this.wipeFrom];

        // 4 vertikale Paula-Zonen in paula-silicon-bg-Reihenfolge [0, 3, 1, 2]
        const zoneBiasLUT = [
            Math.round(ch(PAULA_LRRL[0]) * 2),
            Math.round(ch(PAULA_LRRL[1]) * 2),
            Math.round(ch(PAULA_LRRL[2]) * 2),
            Math.round(ch(PAULA_LRRL[3]) * 2)
        ];

        const copperActive = this.copperTimer > 0;
        const copperY0 = Math.floor(this.copperYFrac * h);
        const copperY1 = copperY0 + Math.max(1, Math.round(this.copperHFrac * h));
        const isAfterglow = state === 'afterglow';

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
        // Chunky-Scan mit horizontalem Run-Merging
        // ---------------------------------------------------------
        for (let gy = 0; gy < rows; gy++) {
            const pyRaw = gy * cell + cell * 0.5;
            const pyNorm = pyRaw / h;
            let vig = 0;
            if (pyNorm < 0.12 || pyNorm > 0.88) {
                vig = isAfterglow ? 2 : 1;
            } else if (isAfterglow && (pyNorm < 0.25 || pyNorm > 0.75)) {
                vig = 1;
            }

            const bandBoost = (copperActive && pyRaw >= copperY0 && pyRaw < copperY1) ? 2 : 0;
            const pyFolded = cy + Math.abs(pyRaw - cy);
            const dyBase = pyRaw - cy;
            const dyFold = pyFolded - cy;

            let runHex = '';
            let runStart = 0;

            for (let gx = 0; gx < cols; gx++) {
                const pxRaw = gx * cell + cell * 0.5;
                const kEff = pxRaw <= kWipeX ? this.kMode : this.kPrev;
                const px = kEff >= 1 ? cx + Math.abs(pxRaw - cx) : pxRaw;
                const dy = kEff === 2 ? dyFold : dyBase;
                const dx = px - cx;

                const u = (dx * cosT - dy * sinT + ou) | 0;
                const v = (dx * sinT + dy * cosT + ov) | 0;
                const texEff = pxRaw <= texWipeX ? this.tex : this.texPrev;
                const texel = TEXTURES[texEff][((v & 63) << 6) | (u & 63)];

                const zoneIdx = Math.min(3, Math.floor((pxRaw * 4) / w));
                let idx = PP6[(texel + this.shift) % 10] + zoneBiasLUT[zoneIdx] + bandBoost - vig;
                if (idx < 0) idx = 0;
                else if (idx > 5) idx = 5;

                const ramp = pxRaw <= rampWipeX ? rampNew : rampOld;
                const hex = ramp[idx];

                if (gx === 0) {
                    runHex = hex;
                    runStart = 0;
                } else if (hex !== runHex) {
                    ctx.fillStyle = runHex;
                    fr(runStart * cell, gy * cell, (gx - runStart) * cell, cell);
                    runHex = hex;
                    runStart = gx;
                }
            }

            if (cols > 0) {
                ctx.fillStyle = runHex;
                fr(runStart * cell, gy * cell, (cols - runStart) * cell, cell);
            }
        }

        if (vis < 1) {
            bayerFadeCells(ctx, 0, 0, w, h, vis, 2, INK);
        }
    }
}