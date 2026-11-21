// =========================================================
// DEMO-SCENE-ELEMENT: AMIGA VECTOR BALLS (Foreground)
// Schattierte Blitter-Bob-Kugeln auf 4 morphbaren 3D-Koerpern
// (Wuerfelgitter, Doppelhelix, Fibonacci-Kugel, Kleeblattknoten),
// Back-to-Front-Sortierung, Paula i % 4 Kanalzuordnung,
// Ghost-Trails (ten > 0.70) und Ultrawide-Doppelkoerper.
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
const MAX_SLOTS = 36;
const MIN_R = 2;
const MAX_R = 14;
const GHOST_RING = 5;

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

function buildFormations() {
    const f0 = new Float32Array(MAX_SLOTS * 3); // Wuerfelgitter (26)
    const f1 = new Float32Array(MAX_SLOTS * 3); // Doppelhelix (28)
    const f2 = new Float32Array(MAX_SLOTS * 3); // Fibonacci-Kugel (32)
    const f3 = new Float32Array(MAX_SLOTS * 3); // Kleeblattknoten (36)

    // F0: 26 Punkte aus {-1,0,1}^3 \ {(0,0,0)} * 0.62 (Ecken -> Flaechen -> Kanten)
    const corners = [];
    const faces = [];
    const edges = [];
    for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
            for (let z = -1; z <= 1; z++) {
                const manh = Math.abs(x) + Math.abs(y) + Math.abs(z);
                if (manh === 0) continue;
                const pt = [x * 0.62, y * 0.62, z * 0.62];
                if (manh === 3) corners.push(pt);
                else if (manh === 1) faces.push(pt);
                else edges.push(pt);
            }
        }
    }
    const cubeList = [...corners, ...faces, ...edges];
    for (let i = 0; i < cubeList.length; i++) {
        f0[i * 3] = cubeList[i][0];
        f0[i * 3 + 1] = cubeList[i][1];
        f0[i * 3 + 2] = cubeList[i][2];
    }

    // F1: Doppelhelix 2x14 Punkte (symmetrische Hoehenreihenfolge)
    const mOrder = [0, 13, 6, 7, 3, 10, 1, 12, 4, 9, 2, 11, 5, 8];
    let idx1 = 0;
    for (let k = 0; k < mOrder.length; k++) {
        const m = mOrder[k];
        const y = (-1 + (2 * m) / 13) * 0.85;
        for (let s = 0; s < 2; s++) {
            const ang = 0.55 * m + s * Math.PI;
            f1[idx1 * 3] = 0.62 * Math.cos(ang) * 0.85;
            f1[idx1 * 3 + 1] = y;
            f1[idx1 * 3 + 2] = 0.62 * Math.sin(ang) * 0.85;
            idx1++;
        }
    }

    // F2: Kugelschale (Fibonacci, 32 Punkte, 5-Bit-Bit-Reversal fuer gleichmaessiges Praefix)
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < 32; i++) {
        let rev = 0;
        for (let b = 0; b < 5; b++) {
            rev = (rev << 1) | ((i >> b) & 1);
        }
        const y = 1 - (2 * rev + 1) / 32;
        const rad = Math.sqrt(Math.max(0, 1 - y * y));
        const phi = rev * golden;
        f2[i * 3] = Math.cos(phi) * rad * 0.95;
        f2[i * 3 + 1] = y * 0.95;
        f2[i * 3 + 2] = Math.sin(phi) * rad * 0.95;
    }

    // F3: Kleeblattknoten (36 Punkte, gerade Indizes zuerst -> geschlossener Knoten ab 18)
    let idx3 = 0;
    for (let pass = 0; pass < 2; pass++) {
        for (let m = pass; m < 36; m += 2) {
            const t = (TWO_PI * m) / 36;
            f3[idx3 * 3] = (Math.sin(t) + 2 * Math.sin(2 * t)) / 3.2;
            f3[idx3 * 3 + 1] = (Math.cos(t) - 2 * Math.cos(2 * t)) / 3.2;
            f3[idx3 * 3 + 2] = -Math.sin(3 * t) / 3.2;
            idx3++;
        }
    }

    return {
        data: Object.freeze([f0, f1, f2, f3]),
        counts: Object.freeze([26, 28, 32, 36])
    };
}

function buildBallTemplates() {
    // Licht L = (-0.45, -0.55, 0.7) normiert
    const lLen = Math.hypot(-0.45, -0.55, 0.7);
    const lx = -0.45 / lLen;
    const ly = -0.55 / lLen;
    const lz = 0.7 / lLen;

    const templates = new Array(MAX_R + 1);
    for (let r = MIN_R; r <= MAX_R; r++) {
        const r2 = r * r + (r <= 3 ? 0.5 : 0.25);
        const runs = [];

        for (let dy = -r; dy <= r; dy++) {
            let runStart = 0;
            let runLvl = -99;
            let inRun = false;

            for (let dx = -r; dx <= r; dx++) {
                const d2 = dx * dx + dy * dy;
                if (d2 > r2) {
                    if (inRun) {
                        runs.push(dy, runStart, dx - 1, runLvl);
                        inRun = false;
                    }
                    continue;
                }

                // 1px INK-Aussenkontur ueber 4-Nachbarn
                const isEdge =
                    ((dx - 1) * (dx - 1) + dy * dy > r2) ||
                    ((dx + 1) * (dx + 1) + dy * dy > r2) ||
                    (dx * dx + (dy - 1) * (dy - 1) > r2) ||
                    (dx * dx + (dy + 1) * (dy + 1) > r2);

                let lvl;
                if (isEdge) {
                    lvl = -1;
                } else {
                    const nz = Math.sqrt(Math.max(0, r * r - d2)) / r;
                    const ndl = Math.max(0, (dx / r) * lx + (dy / r) * ly + nz * lz);
                    lvl = Math.min(5, Math.floor(ndl * 5.99));
                }

                if (!inRun) {
                    runStart = dx;
                    runLvl = lvl;
                    inRun = true;
                } else if (lvl !== runLvl) {
                    runs.push(dy, runStart, dx - 1, runLvl);
                    runStart = dx;
                    runLvl = lvl;
                }
            }

            if (inRun) {
                runs.push(dy, runStart, r, runLvl);
            }
        }

        templates[r] = Int16Array.from(runs);
    }

    return Object.freeze(templates);
}

const FORMATIONS = buildFormations();
const BALL_TEMPLATES = buildBallTemplates();

export class AmigaVectorBalls {
    constructor() {
        this.name = 'Amiga Vector Balls';

        // Zeit- und Zustandsverfolgung
        this.lastT = null;
        this.simTime = 0;
        this.lastState = 'idle';
        this.stateAge = 0;
        this.palAcc = 0;

        // Kontinuierliche Rotation & Slew
        this.ay = 0;
        this.ax = 0;
        this.az = 0;
        this.axTilt = 0.35;
        this.axRate = 0;
        this.azRate = 0;
        this.rotSign = 1;
        this.rotSignTarget = 1;
        this.axisMode = 0;
        this.ten = 0.2;

        // Morph & aktive Baelle (Index-Aktivierung, kein Re-Seed)
        this.f = 0;
        this.fPrev = 0;
        this.morphE = 1;
        this.ballScale = new Float32Array(MAX_SLOTS);
        this.scalesInitialized = false;

        // Diskreter Beat- & Palettenzustand
        this.lastBeatCount = 0;
        this.hardCooldown = 0;
        this.boom = 0;
        this.hardFlashTimer = 0;
        this.hardFlashCh = 0;

        this.rot = 0;
        this.rotPrev = 0;
        this.coolCurr = false;
        this.coolPrev = false;
        this.rampWipeT0 = -10;

        // Allokationsfreie Projektions- & Sortierpuffer
        this.projX = new Float32Array(MAX_SLOTS);
        this.projY = new Float32Array(MAX_SLOTS);
        this.projZ = new Float32Array(MAX_SLOTS);
        this.projR = new Int16Array(MAX_SLOTS);
        this.projNormZ = new Float32Array(MAX_SLOTS);
        this.order = new Uint8Array(MAX_SLOTS);

        // Fester Ghost-Ringpuffer (2 Gruppen x 5 PAL-Schritte x 36 Baelle x [x, y, r])
        this.ghostPos = new Int16Array(2 * GHOST_RING * MAX_SLOTS * 3);
        this.ghostValid = new Uint8Array(2 * GHOST_RING * MAX_SLOTS);
        this.ghostHead = 0;

        // Diagnostik-Werte fuer Tests
        this.lastGroups = 1;
        this.lastMaxR = 0;
        this.lastMinR = MAX_R;
        this.lastGhostsDrawn = 0;
        this.lastHardFlashBalls = 0;
        this.lastOrderSorted = true;
    }

    resize() {
        // Gruppenanzahl und S leiten sich dynamisch aus (width, height) ab;
        // Phasen, Morph-Fortschritt und Formation bleiben erhalten.
    }

    _triggerRampWipe(nextRot, nextCool) {
        if (nextRot === this.rot && nextCool === this.coolCurr) return;
        const p = clamp01((this.simTime - this.rampWipeT0) / 0.6);
        if (p >= 1 || p > 0.5) {
            this.rotPrev = this.rot;
            this.coolPrev = this.coolCurr;
        }
        this.rot = nextRot;
        this.coolCurr = nextCool;
        this.rampWipeT0 = this.simTime;
    }

    _drawBallTemplate(ctx, sx, sy, r, ramp, depthShift, forceLevel5, ghostShift, w, h) {
        const clampedR = r < MIN_R ? MIN_R : (r > MAX_R ? MAX_R : r);
        const tmpl = BALL_TEMPLATES[clampedR];
        const len = tmpl.length;

        for (let k = 0; k < len; k += 4) {
            const py = sy + tmpl[k];
            if (py < 0 || py >= h) continue;

            const px0 = sx + tmpl[k + 1];
            const px1 = sx + tmpl[k + 2];
            const cx0 = px0 < 0 ? 0 : px0;
            const cx1 = px1 >= w ? w - 1 : px1;
            const cw = cx1 - cx0 + 1;
            if (cw <= 0) continue;

            const rawLvl = tmpl[k + 3];
            if (rawLvl < 0) {
                ctx.fillStyle = INK;
            } else if (forceLevel5) {
                ctx.fillStyle = ramp[5];
            } else {
                let lvl = rawLvl + depthShift + ghostShift;
                if (lvl < 0) lvl = 0;
                else if (lvl > 5) lvl = 5;
                ctx.fillStyle = ramp[lvl];
            }
            ctx.fillRect(cx0, py, cw, 1);
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
        this.hardFlashTimer = Math.max(0, this.hardFlashTimer - dt);
        this.boom *= Math.exp(-dt / 0.12);

        if (this.morphE < 1) {
            this.morphE = clamp01(this.morphE + dt / 0.8);
        }

        // Geometrische Sichtbarkeit (kein Schwarz-Vollbild-Dither auf Foreground!)
        const stTime = Number.isFinite(stateTime) ? stateTime : this.stateAge;
        let vis = 1;
        if (state === 'starting') {
            vis = clamp01(stTime / TRANSITION_IN);
        } else if (state === 'stopping') {
            vis = 1 - clamp01(stTime / TRANSITION_OUT);
            if (vis <= 0) {
                this.lastGhostsDrawn = 0;
                this.lastHardFlashBalls = 0;
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
        const isAfterglow = state === 'afterglow';
        const allowDiscrete = !isAfterglow && state !== 'stopping';
        let nextRot = this.rot;

        if (onBeat && allowDiscrete) {
            if (level === 1) {
                this.ay += 0.12 * dir;
            } else if (level === 2) {
                this.boom = 1.0;
            } else if (level === 3) {
                if (this.hardCooldown <= 0) {
                    this.boom = 1.4;
                    this.hardFlashTimer = 0.12;
                    this.hardFlashCh = loudestCh;
                    this.hardCooldown = 0.25;
                }
            }

            if (count > 0 && count % 4 === 0) {
                this.fPrev = this.f;
                this.f = (this.f + 1) & 3;
                this.morphE = 0;
            }
            if (count > 0 && count % 8 === 0) {
                this.axisMode = (this.axisMode + 1) % 3;
                this.rotSignTarget = -this.rotSignTarget;
                nextRot = (this.rot + 1) & 3;
            }
        }

        this._triggerRampWipe(nextRot, isAfterglow);

        // ---------------------------------------------------------
        // Kontinuierliche Rotation (Slew 0.4s)
        // ---------------------------------------------------------
        if (this.rotSign !== this.rotSignTarget) {
            const maxStep = (2 * dt) / 0.4;
            const diff = this.rotSignTarget - this.rotSign;
            this.rotSign = Math.abs(diff) <= maxStep ? this.rotSignTarget : this.rotSign + Math.sign(diff) * maxStep;
        }

        const tiltTarget = this.axisMode === 0 ? 0.35 : 0;
        const axRateTarget = this.axisMode === 1 ? 0.6 : 0;
        const azRateTarget = (this.axisMode === 2 ? 0.6 : 0) + 0.3 * smoothstep(0.6, 0.85, this.ten);
        const slewK = 1 - Math.exp(-dt / 0.13);
        this.axTilt += (tiltTarget - this.axTilt) * slewK;
        this.axRate += (axRateTarget - this.axRate) * slewK;
        this.azRate += (azRateTarget - this.azRate) * slewK;

        const omegaY = lerp(0.5, 1.8, this.ten) * this.rotSign * (isAfterglow ? 0.3 : 1.0);
        this.ay = (this.ay + omegaY * dt) % TWO_PI;
        this.ax = (this.ax + omegaY * this.axRate * dt) % TWO_PI;
        this.az = (this.az + omegaY * this.azRate * dt) % TWO_PI;

        // ---------------------------------------------------------
        // Aktive Baelle & Skala pro Slot
        // ---------------------------------------------------------
        const aspect = w / h;
        const minDim = Math.min(w, h);
        const groups = aspect >= 2.0 ? 2 : 1;
        this.lastGroups = groups;

        const baseAct = this.ten < 0.35 ? 18 : (this.ten < 0.70 ? 28 : 36);
        const scaledAct = groups === 2 ? Math.floor(baseAct * 0.75) : baseAct;
        const cntCurr = FORMATIONS.counts[this.f];
        const cntPrev = FORMATIONS.counts[this.fPrev];
        const effCap = Math.min(scaledAct, cntCurr);
        const activeCap = (state === 'starting' || state === 'stopping')
            ? Math.floor(effCap * vis)
            : effCap;

        if (!this.scalesInitialized) {
            this.scalesInitialized = true;
            for (let i = 0; i < MAX_SLOTS; i++) {
                this.ballScale[i] = (state === 'starting') ? 0 : (i < activeCap ? 1 : 0);
            }
        }

        const scaleK = 1 - Math.exp(-dt / 0.12);
        const maxDrawSlots = this.morphE < 1 ? Math.max(cntCurr, cntPrev) : cntCurr;
        for (let i = 0; i < MAX_SLOTS; i++) {
            const targetS = (i < activeCap && i < cntCurr) ? 1 : 0;
            this.ballScale[i] += (targetS - this.ballScale[i]) * scaleK;
        }

        const sBase = Math.min(
            0.30 * minDim,
            minDim * lerp(0.16, 0.24, this.ten) * (1 + 0.22 * impulse) * (1 + 0.3 * this.boom)
        );
        const boomScale = 1 + 0.3 * this.boom;
        const cy = 0.45 * h;
        const morphAlpha = this.morphE >= 1 ? 1 : smoothstep(0, 1, this.morphE);
        const fNewData = FORMATIONS.data[this.f];
        const fOldData = FORMATIONS.data[this.fPrev];

        // 50-Hz PAL-Schritt fuer Ghost-Ringpuffer
        this.palAcc += dt;
        let advanceGhost = false;
        if (this.palAcc >= 0.02) {
            this.palAcc %= 0.02;
            advanceGhost = true;
        }
        const writeHead = advanceGhost ? (this.ghostHead + 1) % GHOST_RING : this.ghostHead;
        const showGhosts = !isAfterglow && state !== 'stopping' && this.ten > 0.70;
        if (!showGhosts && state === 'afterglow') {
            this.ghostValid.fill(0);
        }

        const rampP = clamp01((this.simTime - this.rampWipeT0) / 0.6);
        const hardFlash = this.hardFlashTimer > 0;
        const rPulseAdd = Math.round(impulse * 1.5);

        const axEff = this.ax + this.axTilt;
        const cosX = Math.cos(axEff);
        const sinX = Math.sin(axEff);
        const cosZ = Math.cos(this.az);
        const sinZ = Math.sin(this.az);

        this.lastMaxR = 0;
        this.lastMinR = MAX_R;
        this.lastGhostsDrawn = 0;
        this.lastHardFlashBalls = 0;
        this.lastOrderSorted = true;

        // ---------------------------------------------------------
        // Gruppenprojektion, Insertion-Sort & Zeichnen
        // ---------------------------------------------------------
        for (let g = 0; g < groups; g++) {
            const cx = w * ((g + 0.5) / groups);
            const ayGroup = g === 0 ? this.ay : -this.ay;
            const cosY = Math.cos(ayGroup);
            const sinY = Math.sin(ayGroup);

            let drawCount = 0;
            for (let i = 0; i < maxDrawSlots; i++) {
                const sc = this.ballScale[i];
                if (sc <= 0.08) continue;

                const off = i * 3;
                let vx = fNewData[off];
                let vy = fNewData[off + 1];
                let vz = fNewData[off + 2];
                if (morphAlpha < 1) {
                    vx = lerp(fOldData[off], vx, morphAlpha);
                    vy = lerp(fOldData[off + 1], vy, morphAlpha);
                    vz = lerp(fOldData[off + 2], vz, morphAlpha);
                }
                vx *= boomScale;
                vy *= boomScale;
                vz *= boomScale;

                // Euler-Rotation Y -> X -> Z
                const x1 = vx * cosY + vz * sinY;
                const z1 = -vx * sinY + vz * cosY;
                const y2 = vy * cosX - z1 * sinX;
                const z2 = vy * sinX + z1 * cosX;
                const x3 = x1 * cosZ - y2 * sinZ;
                const y3 = x1 * sinZ + y2 * cosZ;

                const persp = 3.2 / Math.max(0.4, 3.2 - z2);
                const sx = Math.round(cx + x3 * sBase * persp);
                const sy = Math.round(cy + y3 * sBase * persp);

                const rawR = Math.round(0.12 * sBase * persp * (0.75 + 0.6 * ch[i & 3]) * sc) + rPulseAdd;
                const r = rawR < MIN_R ? MIN_R : (rawR > MAX_R ? MAX_R : rawR);

                this.projX[i] = sx;
                this.projY[i] = sy;
                this.projZ[i] = z2;
                this.projR[i] = r;
                this.projNormZ[i] = clamp01((z2 + 1) * 0.5);
                this.order[drawCount++] = i;

                if (r > this.lastMaxR) this.lastMaxR = r;
                if (r < this.lastMinR) this.lastMinR = r;

                // Ringpuffer fuer Ghost-Trails beschreiben
                const gIdx = (g * GHOST_RING + writeHead) * MAX_SLOTS + i;
                this.ghostValid[gIdx] = 1;
                this.ghostPos[gIdx * 3] = sx;
                this.ghostPos[gIdx * 3 + 1] = sy;
                this.ghostPos[gIdx * 3 + 2] = r;
            }

            // Insertion-Sort nach z (Ruecken zuerst = kleinstes z zuerst)
            for (let a = 1; a < drawCount; a++) {
                const key = this.order[a];
                const keyZ = this.projZ[key];
                let b = a - 1;
                while (b >= 0 && this.projZ[this.order[b]] > keyZ) {
                    this.order[b + 1] = this.order[b];
                    b--;
                }
                this.order[b + 1] = key;
            }

            for (let a = 1; a < drawCount; a++) {
                if (this.projZ[this.order[a]] < this.projZ[this.order[a - 1]]) {
                    this.lastOrderSorted = false;
                }
            }

            const ghostLag2 = (writeHead + GHOST_RING - 2) % GHOST_RING;
            const ghostLag4 = (writeHead + GHOST_RING - 4) % GHOST_RING;

            for (let a = 0; a < drawCount; a++) {
                const i = this.order[a];
                const zVal = this.projZ[i];
                const depthShift = zVal < -0.4 ? -1 : (zVal > 0.5 ? 1 : 0);
                const useNewRamp = this.projNormZ[i] <= rampP;
                const rotEff = useNewRamp ? this.rot : this.rotPrev;
                const coolEff = useNewRamp ? this.coolCurr : this.coolPrev;
                const chIdx = i & 3;
                const rampName = coolEff ? COOL[chIdx] : CH_RAMPS[(chIdx + rotEff) & 3];
                const ramp = RAMPS[rampName];

                if (showGhosts) {
                    if (groups === 1) {
                        const g4Idx = (g * GHOST_RING + ghostLag4) * MAX_SLOTS + i;
                        if (this.ghostValid[g4Idx]) {
                            const gr4 = Math.max(MIN_R, Math.round(this.ghostPos[g4Idx * 3 + 2] * 0.6));
                            this._drawBallTemplate(
                                ctx, this.ghostPos[g4Idx * 3], this.ghostPos[g4Idx * 3 + 1],
                                gr4, ramp, depthShift, false, -3, w, h
                            );
                            this.lastGhostsDrawn++;
                        }
                    }
                    const g2Idx = (g * GHOST_RING + ghostLag2) * MAX_SLOTS + i;
                    if (this.ghostValid[g2Idx]) {
                        const gr2 = Math.max(MIN_R, Math.round(this.ghostPos[g2Idx * 3 + 2] * 0.8));
                        this._drawBallTemplate(
                            ctx, this.ghostPos[g2Idx * 3], this.ghostPos[g2Idx * 3 + 1],
                            gr2, ramp, depthShift, false, -2, w, h
                        );
                        this.lastGhostsDrawn++;
                    }
                }

                const isHardFlash = hardFlash && chIdx === this.hardFlashCh;
                if (isHardFlash) this.lastHardFlashBalls++;
                this._drawBallTemplate(
                    ctx, this.projX[i], this.projY[i], this.projR[i],
                    ramp, depthShift, isHardFlash, 0, w, h
                );
            }
        }

        if (advanceGhost) {
            this.ghostHead = writeHead;
        }
    }
}