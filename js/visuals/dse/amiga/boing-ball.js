// === js/visuals/dse/amiga/boing-ball.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: AMIGA BOING BALL (Foreground DSE)
// Transparent foreground layer with 100% Amiga 12-bit LUTs,
// zero-GC render loop, perspective pole-accurate sphere mesh,
// silhouette contour, raster-interlaced ghost trails, and
// full musical synchronization (tension, beatLevel 1-3,
// beatImpulse, smooth[0..2], and macro states).
// =========================================================

import {
    quantizeAmiga12Bit,
    rgbToHex,
    drawAliasedLine,
    fillAliasedPolygon
} from '../../utils/hardware-constraints.js';

const LAT_BANDS = 14;
const LON_BANDS = 16;
const NUM_FACES = LAT_BANDS * LON_BANDS;
const SHADE_STEPS = 32;
const MAX_TRAILS = 4;
const TRAIL_SAMPLE_INTERVAL = 0.04; // 2 PAL ticks (25 Hz)
const SPHERE_Z_OFFSET = 3.5;
const SPHERE_PROJ_SCALE = 1 / Math.sqrt(SPHERE_Z_OFFSET * SPHERE_Z_OFFSET - 1);

const BAYER_4X4 = [
    0, 8, 2, 10,
    12, 4, 14, 6,
    3, 11, 1, 9,
    15, 7, 13, 5
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const qHex = (r, g, b) => rgbToHex(...quantizeAmiga12Bit(r, g, b));

function buildShadeLut(baseR, baseG, baseB, minFactor) {
    const lut = new Array(SHADE_STEPS);
    for (let i = 0; i < SHADE_STEPS; i++) {
        const t = i / (SHADE_STEPS - 1);
        const factor = minFactor + (1 - minFactor) * t;
        lut[i] = qHex(
            Math.round(baseR * factor),
            Math.round(baseG * factor),
            Math.round(baseB * factor)
        );
    }
    return Object.freeze(lut);
}

const COLOR_LUT = Object.freeze({
    red: buildShadeLut(255, 0, 0, 0.16),
    white: buildShadeLut(255, 255, 255, 0.20),
    coolRed: buildShadeLut(205, 38, 108, 0.14),
    coolWhite: buildShadeLut(175, 208, 255, 0.18),
    rimRed: buildShadeLut(255, 76, 136, 0.24),
    rimWhite: buildShadeLut(155, 238, 255, 0.26)
});

const PALETTE = Object.freeze({
    black: qHex(0, 0, 0),
    white: qHex(255, 255, 255),
    shadow: qHex(0, 0, 0),
    reflSoft: qHex(125, 0, 18),
    reflMed: qHex(188, 0, 18),
    reflHard: qHex(255, 34, 17),
    reflGold: qHex(255, 204, 68),
    ghostRed: Object.freeze([qHex(68, 0, 24), qHex(102, 0, 24), qHex(145, 0, 22)]),
    ghostWhite: Object.freeze([qHex(48, 56, 108), qHex(74, 88, 140), qHex(108, 126, 175)])
});

function macroFallbackTension(state) {
    if (state === 'climax') return 0.90;
    if (state === 'buildup') return 0.70;
    if (state === 'afterglow') return 0.22;
    if (state === 'starting') return 0.35;
    return 0.42;
}

export class AmigaBoingBall {
    constructor() {
        this.name = 'Amiga Boing Ball';

        this.vertices = [];
        this.facesDef = [];

        for (let lat = 0; lat <= LAT_BANDS; lat++) {
            const theta = (lat * Math.PI) / LAT_BANDS;
            const sinTheta = Math.sin(theta);
            const cosTheta = Math.cos(theta);

            for (let lon = 0; lon <= LON_BANDS; lon++) {
                const phi = (lon * 2 * Math.PI) / LON_BANDS;
                this.vertices.push({
                    x: Math.cos(phi) * sinTheta,
                    y: cosTheta,
                    z: Math.sin(phi) * sinTheta
                });
            }
        }

        for (let lat = 0; lat < LAT_BANDS; lat++) {
            const stagger = Math.floor(lat / 2) % 2;
            for (let lon = 0; lon < LON_BANDS; lon++) {
                const first = lat * (LON_BANDS + 1) + lon;
                const second = first + LON_BANDS + 1;
                this.facesDef.push({
                    idxs: [first, first + 1, second + 1, second],
                    lat,
                    lon,
                    isRed: (lon + stagger) % 2 === 0
                });
            }
        }

        const numVerts = this.vertices.length;
        this.transformed = Array.from({ length: numVerts }, () => ({ x: 0, y: 0, z: 0 }));
        this.projected = Array.from({ length: numVerts }, () => ({ x: 0, y: 0 }));
        this.facesToDraw = Array.from({ length: NUM_FACES }, () => ({
            idxs: null,
            hex: '',
            z: 0,
            lat: 0,
            lon: 0,
            dot: 0
        }));
        this.faceVisible = new Uint8Array(NUM_FACES);
        this.quad = [null, null, null, null];
        this.tri = [null, null, null];

        // Normalisierte Trail-Historie (überlebt Resize/Rotation nahtlos)
        this.trailHistory = Array.from({ length: MAX_TRAILS }, () => ({
            active: false,
            xNorm: 0,
            bounceFrac: 0,
            rotY: 0,
            scaleX: 1,
            scaleY: 1
        }));
        this.trailHead = 0;
        this.trailTimer = 0;

        // Zeit- & Zustandsverwaltung
        this.lastT = 0;
        this.hasRendered = false;
        this.lastState = 'idle';
        this.stateAge = 0;

        // Physik- & Animations-Akkumulatoren
        this.moveXPhase = 0.0;
        this.moveYPhase = 0.0;
        this.currentRotY = 0.0;
        this.currentRotSpeed = 1.8;
        this.smoothedSpeed = 1.0;
        this.tension = 0.42;
        this.afterglowMix = 0.0;
        this.tiltDir = 1;
        this.currentTiltZ = 0.30;

        // Beat- & Bounce-Dynamik
        this.lastBeatCount = -1;
        this.fallbackBeatCount = 0;
        this.lastBeatEvent = false;
        this.beatPulse = 0;
        this.beatPop = 0;
        this.floorFlash = 0;
        this.floorFlashLevel = 1;
        this.rotKick = 0;
        this.bounceTimer = 0;
        this.shakeTimer = 0;
        this.squashAmount = 0;
    }

    resize() {
        // Geometrie & Trail-Positionen sind normalisiert und passen sich im nächsten render() direkt an.
    }

    resetTransients() {
        this.beatPulse = 0;
        this.beatPop = 0;
        this.floorFlash = 0;
        this.rotKick = 0;
        this.bounceTimer = 0;
        this.shakeTimer = 0;
        this.squashAmount = 0;
        this.trailTimer = 0;
        for (let i = 0; i < MAX_TRAILS; i++) {
            this.trailHistory[i].active = false;
        }
    }

    drawGhostSphere(ctx, width, height, cx, cy, rx, ry, rotY, tierIndex) {
        if (rx < 2 || ry < 2) return;
        const redCol = PALETTE.ghostRed[tierIndex];
        const whiteCol = PALETTE.ghostWhite[tierIndex];
        const seamShift = Math.sin(rotY) * rx * 0.45;

        const yStart = Math.max(0, cy - ry);
        const yEnd = Math.min(height - 1, cy + ry);
        for (let py = yStart; py <= yEnd; py++) {
            if ((py & 1) === 1) continue; // Opakes Scanline-Interlace ohne Alpha
            const dy = py - cy;
            const span = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry))));
            if (span < 1) continue;

            const left = Math.max(0, cx - span);
            const right = Math.min(width - 1, cx + span);
            if (right < left) continue;

            const splitX = clamp(Math.round(cx + seamShift), left, right + 1);
            const bandAlt = (Math.floor((dy + ry) / Math.max(2, Math.floor(ry * 0.35))) & 1) === 0;
            const leftCol = bandAlt ? redCol : whiteCol;
            const rightCol = bandAlt ? whiteCol : redCol;

            if (splitX > left) {
                ctx.fillStyle = leftCol;
                ctx.fillRect(left, py, splitX - left, 1);
            }
            if (right >= splitX) {
                ctx.fillStyle = rightCol;
                ctx.fillRect(splitX, py, right - splitX + 1, 1);
            }
        }
    }

    render(ctx, width, height, t, state, stateTime, metrics) {
        if (!Number.isFinite(width) || !Number.isFinite(height) ||
            width <= 0 || height <= 0 || !Number.isFinite(width / height)) {
            this.lastT = Number.isFinite(t) ? t : this.lastT;
            return;
        }

        const time = Number.isFinite(t) ? t : this.lastT;
        if (state === 'idle') {
            this.lastT = time;
            this.lastState = 'idle';
            this.stateAge = 0;
            return;
        }

        const dt = this.hasRendered ? clamp(time - this.lastT, 0, 0.1) : 0.02;
        this.lastT = time;
        this.hasRendered = true;

        if (this.lastState !== state) {
            if (state === 'starting' && this.lastState === 'idle') {
                this.resetTransients();
            }
            this.lastState = state;
            this.stateAge = 0;
        } else {
            this.stateAge += dt;
        }

        // =========================================================
        // 1. DEFENSIVE METRICS & TENSION / BEAT EXTRACTION
        // =========================================================
        const requestedTension = Number.isFinite(metrics?.tensionPct)
            ? clamp(metrics.tensionPct, 0, 1)
            : macroFallbackTension(state);
        this.tension += (requestedTension - this.tension) * Math.min(1, dt * 3.0);

        const smoothArr = metrics?.smooth;
        const hasSmooth = Array.isArray(smoothArr) || ArrayBuffer.isView(smoothArr);
        const chBass = hasSmooth && Number.isFinite(smoothArr[0]) ? clamp(smoothArr[0], 0, 1) : 0;
        const chMid = hasSmooth && Number.isFinite(smoothArr[1]) ? clamp(smoothArr[1], 0, 1) : 0;
        const chHigh = hasSmooth && Number.isFinite(smoothArr[2]) ? clamp(smoothArr[2], 0, 1) : 0;

        const rawEnv = Number.isFinite(metrics?.beat?.[0]) ? clamp(metrics.beat[0], 0, 1) : 0;
        const rawImpulse = Number.isFinite(metrics?.beatImpulse?.[0])
            ? clamp(metrics.beatImpulse[0], 0, 1)
            : rawEnv;

        // Zeitbasiertes Abklingen aller Impulse
        this.beatPulse = Math.max(0, this.beatPulse - dt * 3.2);
        this.beatPop = Math.max(0, this.beatPop - dt * 5.2);
        this.floorFlash = Math.max(0, this.floorFlash - dt * 4.2);
        this.rotKick = Math.max(0, this.rotKick - dt * 4.0);
        this.bounceTimer = Math.max(0, this.bounceTimer - dt);
        this.shakeTimer = Math.max(0, this.shakeTimer - dt);
        this.squashAmount = Math.max(0, this.squashAmount - dt * 5.0);

        const beatStarted = metrics?.beatStarted === true;
        const rawBeatCount = Number.isFinite(metrics?.beatCount)
            ? Math.max(0, Math.floor(metrics.beatCount))
            : null;

        if (beatStarted) {
            const isNewBeat = rawBeatCount === null
                ? !this.lastBeatEvent
                : rawBeatCount !== this.lastBeatCount;

            if (isNewBeat) {
                const beatIndex = rawBeatCount === null ? this.fallbackBeatCount++ : rawBeatCount;
                if (rawBeatCount !== null) this.lastBeatCount = rawBeatCount;

                const strength = Number.isFinite(metrics?.beatStrength)
                    ? clamp(metrics.beatStrength, 0, 1)
                    : metrics?.beatLevel === 3 ? 0.90
                        : metrics?.beatLevel === 2 ? 0.50
                            : metrics?.beatLevel === 1 ? 0.20
                                : (rawImpulse > 0 ? rawImpulse : 0.50);

                const level = (metrics?.beatLevel === 1 || metrics?.beatLevel === 2 || metrics?.beatLevel === 3)
                    ? metrics.beatLevel
                    : (strength >= 2 / 3 ? 3 : (strength >= 1 / 3 ? 2 : 1));

                this.beatPulse = Math.max(this.beatPulse, strength);
                this.beatPop = Math.max(this.beatPop, level === 3 ? 1.0 : (level === 2 ? 0.52 : 0.18));
                this.floorFlash = Math.max(this.floorFlash, level === 3 ? 1.0 : (level === 2 ? 0.58 : 0.24));
                this.floorFlashLevel = level;
                this.rotKick = Math.max(this.rotKick, level === 3 ? 2.6 : (level === 2 ? 1.25 : 0.45));

                if (state !== 'afterglow' && state !== 'stopping') {
                    if (level === 3) {
                        this.shakeTimer = Math.max(this.shakeTimer, 0.08); // 4 PAL-Ticks
                    }
                    if (beatIndex > 0 && beatIndex % 4 === 0 &&
                        (level >= 2 && (state === 'climax' || state === 'buildup' || this.tension > 0.52))) {
                        this.tiltDir = -this.tiltDir;
                    }
                }
            }
        }
        this.lastBeatEvent = beatStarted;

        // =========================================================
        // 2. MAKROZUSTÄNDE, TRANSITIONS & PALETTEN-STEUERUNG
        // =========================================================
        let visibility = 1.0;
        let dropFrac = 0.0;

        if (state === 'starting') {
            const tt = Number.isFinite(stateTime) ? Math.max(0, stateTime) : this.stateAge;
            visibility = clamp(tt / 1.5, 0, 1);
            const easeOut = 1 - Math.pow(1 - visibility, 2);
            dropFrac = -(1 - easeOut) * 0.55;
        } else if (state === 'stopping') {
            const tt = Number.isFinite(stateTime) ? Math.max(0, stateTime) : this.stateAge;
            visibility = clamp(1 - tt / 1.5, 0, 1);
        }

        let targetSpeed = 0.85 + this.tension * 0.45;
        let targetBounceFrac = 0.22 + this.tension * 0.09;
        let targetAfterglow = 0.0;

        if (state === 'buildup') {
            targetSpeed = 1.05 + this.tension * 0.45;
            targetBounceFrac = 0.25 + this.tension * 0.09;
        } else if (state === 'climax') {
            targetSpeed = 1.28 + this.tension * 0.42;
            targetBounceFrac = 0.28 + this.tension * 0.08;
        } else if (state === 'afterglow') {
            targetSpeed = 0.45 + this.tension * 0.20;
            targetBounceFrac = 0.14 + this.tension * 0.05;
            targetAfterglow = 1.0;
        } else if (state === 'stopping') {
            targetSpeed = 0.55;
            targetBounceFrac = 0.18 * visibility;
        }

        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * Math.min(1, dt * 4.0);
        this.afterglowMix += (targetAfterglow - this.afterglowMix) * Math.min(1, dt * 1.8);

        const targetTilt = this.tiltDir * (0.22 + this.tension * 0.14);
        this.currentTiltZ += (targetTilt - this.currentTiltZ) * Math.min(1, dt * 6.0);

        if (visibility <= 0) {
            return;
        }

        // =========================================================
        // 3. KOORDINATEN, RESPONSIVE PHYSIK & SQUASH/STRETCH
        // =========================================================
        const minDim = Math.min(width, height);
        const cx = Math.floor(width * 0.5);
        const horizon = Math.floor(height * 0.90);

        // Minimal-Fallback für winzige Test-Canvases (< 8px)
        if (minDim < 8) {
            const dotX = clamp(cx, 0, width - 1);
            const dotY = clamp(Math.floor(height * 0.5), 0, height - 1);
            ctx.fillStyle = PALETTE.reflHard;
            ctx.fillRect(dotX, dotY, 1, 1);
            return;
        }

        const baseFov = minDim * 0.58;
        const activeSignal = Math.max(rawImpulse, this.beatPulse);
        const popScale = 1.0 + this.beatPop * 0.085 + activeSignal * 0.025;
        const fov = baseFov * popScale;

        const baseRadius = baseFov * SPHERE_PROJ_SCALE;
        const projRadius = fov * SPHERE_PROJ_SCALE;

        // Horizontale Bewegung an Seitenverhältnis angleichen (flüssig in Porträt & Ultrawide)
        const aspectNorm = clamp(Math.sqrt(minDim / Math.max(1, width)), 0.55, 1.30);
        const speedX = 0.27 * this.smoothedSpeed * aspectNorm;
        this.moveXPhase = (this.moveXPhase + dt * speedX) % 2.0;

        const isMovingRight = this.moveXPhase < 1.0;
        const xNorm = isMovingRight
            ? (this.moveXPhase * 2.0 - 1.0)
            : (1.0 - (this.moveXPhase - 1.0) * 2.0);

        // Y-Bounce (Parabel) + Aufprall-Detektor
        const bounceFreq = 1.02 * this.smoothedSpeed;
        const prevYPhase = this.moveYPhase;
        this.moveYPhase = (this.moveYPhase + dt * bounceFreq) % 1.0;

        if (this.moveYPhase < prevYPhase && state !== 'starting' && state !== 'stopping') {
            this.bounceTimer = 0.08;
            this.squashAmount = Math.max(this.squashAmount, 0.85);
            if (state !== 'afterglow') {
                this.shakeTimer = Math.max(this.shakeTimer, 0.06);
            }
            this.currentRotSpeed *= 0.88;
        }

        const u = 2.0 * this.moveYPhase - 1.0;
        const parabolicArc = 1.0 - u * u;
        const safeBounceFrac = Math.min(targetBounceFrac, Math.max(0.05, (horizon - baseRadius * 2.3 - 2) / height));
        const bounceFrac = parabolicArc * safeBounceFrac;

        // Elastisches Squash & Stretch (Aufprall + Beat-Volumenimpuls)
        const totalSquash = clamp(this.squashAmount * 0.12 + this.beatPop * 0.06, 0, 0.18);
        const scaleX = 1.0 + totalSquash;
        const scaleY = 1.0 - totalSquash * 0.85;

        const maxBallExtentX = projRadius * 1.20;
        const maxAmplitude = Math.max(0, width * 0.5 - maxBallExtentX - 1);
        const moveX = xNorm * maxAmplitude;

        // Rotation mit Beat-Kick
        const targetRotSpeed = (1.75 * this.smoothedSpeed + this.rotKick * 1.8) * (1.0 + activeSignal * 0.55);
        this.currentRotSpeed += (targetRotSpeed - this.currentRotSpeed) * Math.min(1, dt * 3.5);
        this.currentRotY += isMovingRight ? (dt * this.currentRotSpeed) : -(dt * this.currentRotSpeed);

        // PAL-Tick-konformer Screen Shake (50 Hz diskret)
        let shakeX = 0;
        let shakeY = 0;
        if (this.shakeTimer > 0) {
            const palTick = Math.floor(this.shakeTimer * 50);
            shakeX = (palTick & 1) === 0 ? 1 : -1;
            shakeY = (palTick & 1) === 0 ? 1 : 0;
        }

        const finalCx = cx + shakeX;
        const finalHorizon = clamp(horizon + shakeY, 1, height - 1);
        const ballCenterX = Math.round(finalCx + moveX);
        const ballCenterY = Math.round(finalHorizon - projRadius * scaleY - bounceFrac * height + dropFrac * height);

        // =========================================================
        // 4. RETRO GHOST TRAILS (Climax / High-Tension Buildup / Afterglow-Fade)
        // =========================================================
        this.trailTimer += dt;
        if (this.trailTimer >= TRAIL_SAMPLE_INTERVAL) {
            this.trailTimer %= TRAIL_SAMPLE_INTERVAL;
            const slot = this.trailHistory[this.trailHead];
            slot.active = true;
            slot.xNorm = xNorm;
            slot.bounceFrac = bounceFrac;
            slot.rotY = this.currentRotY;
            slot.scaleX = scaleX;
            slot.scaleY = scaleY;
            this.trailHead = (this.trailHead + 1) % MAX_TRAILS;
        }

        let targetTrails = 0;
        if (state === 'climax') {
            targetTrails = this.tension > 0.78 ? 3 : 2;
        } else if (state === 'buildup' && this.tension > 0.56) {
            targetTrails = 1;
        } else if (state === 'afterglow' && this.stateAge < 1.0) {
            targetTrails = this.stateAge < 0.45 ? 2 : 1;
        }

        if (targetTrails > 0 && visibility > 0.85) {
            for (let g = targetTrails; g >= 1; g--) {
                const idx = (this.trailHead - 1 - g + MAX_TRAILS * 2) % MAX_TRAILS;
                const ghost = this.trailHistory[idx];
                if (!ghost.active) continue;

                const gx = Math.round(finalCx + ghost.xNorm * maxAmplitude);
                const gy = Math.round(finalHorizon - baseRadius * ghost.scaleY - ghost.bounceFrac * height);
                const grX = Math.max(2, Math.round(baseRadius * ghost.scaleX));
                const grY = Math.max(2, Math.round(baseRadius * ghost.scaleY));
                const tier = clamp(MAX_TRAILS - 1 - g, 0, 2);
                this.drawGhostSphere(ctx, width, height, gx, gy, grX, grY, ghost.rotY, tier);
            }
        }

        // =========================================================
        // 5. SCHATTEN & BEAT-LEVEL BODEN-REFLEX (100 % Integer-Raster)
        // =========================================================
        const shadowX = Math.round(finalCx + moveX);
        const shadowY = finalHorizon;
        const bayerThreshold = Math.ceil(visibility * 16);

        // Boden-Schockwelle / Reflexion (sofort am Onset nach beatLevel unterscheidbar)
        const reflPower = Math.max(this.floorFlash, this.bounceTimer > 0 ? 0.80 : 0, chBass * 0.42);
        if (reflPower > 0.08 && visibility > 0.25) {
            const lvl = this.bounceTimer > 0 ? Math.max(2, this.floorFlashLevel) : this.floorFlashLevel;
            const halfW = Math.max(
                2,
                Math.round(baseRadius * (lvl === 3 ? 1.15 : (lvl === 2 ? 0.80 : 0.46)) * (0.75 + 0.25 * reflPower))
            );
            const bandH = Math.max(1, Math.round(height * (lvl === 3 ? 0.022 : (lvl === 2 ? 0.014 : 0.008))));
            const reflTop = clamp(shadowY + 1, 0, height - 1);
            const drawH = Math.min(bandH, height - reflTop);
            const reflLeft = clamp(shadowX - halfW, 0, width - 1);
            const reflRight = clamp(shadowX + halfW, 0, width);
            const drawW = reflRight - reflLeft;

            if (drawW > 0 && drawH > 0) {
                ctx.fillStyle = lvl === 3 ? PALETTE.reflHard : (lvl === 2 ? PALETTE.reflMed : PALETTE.reflSoft);
                ctx.fillRect(reflLeft, reflTop, drawW, drawH);

                if (lvl === 3 && drawW >= 6) {
                    const coreHalf = Math.max(2, Math.floor(halfW * 0.52));
                    const coreLeft = clamp(shadowX - coreHalf, 0, width - 1);
                    const coreW = clamp(shadowX + coreHalf, 0, width) - coreLeft;
                    if (coreW > 0) {
                        ctx.fillStyle = PALETTE.reflGold;
                        ctx.fillRect(coreLeft, reflTop, coreW, Math.max(1, Math.floor(drawH * 0.55)));
                    }
                    if (this.floorFlash > 0.55) {
                        const sparkHalf = Math.max(1, Math.floor(halfW * 0.22));
                        const sparkLeft = clamp(shadowX - sparkHalf, 0, width - 1);
                        const sparkW = clamp(shadowX + sparkHalf, 0, width) - sparkLeft;
                        if (sparkW > 0) {
                            ctx.fillStyle = PALETTE.white;
                            ctx.fillRect(sparkLeft, reflTop, sparkW, 1);
                        }
                    }
                }
            }
        }

        // Dither-Schatten
        const heightAtten = clamp(1.0 - bounceFrac * 1.5, 0.35, 1.0);
        const shadowW = Math.max(1, Math.round(baseRadius * 1.18 * scaleX * heightAtten));
        const shadowH = Math.max(1, Math.round(baseRadius * 0.27 * heightAtten));
        ctx.fillStyle = PALETTE.shadow;

        for (let dy = -shadowH; dy <= shadowH; dy++) {
            const sy = shadowY + dy;
            if (sy < 0 || sy >= height) continue;

            const span = Math.floor(shadowW * Math.sqrt(Math.max(0, 1 - (dy * dy) / (shadowH * shadowH))));
            for (let dx = -span; dx <= span; dx++) {
                const sx = shadowX + dx;
                if (sx < 0 || sx >= width) continue;
                if (((sx + sy) & 1) !== 0) continue;
                if (bayerThreshold < 16 && BAYER_4X4[((sy & 3) << 2) | (sx & 3)] >= bayerThreshold) continue;
                ctx.fillRect(sx, sy, 1, 1);
            }
        }

        // =========================================================
        // 6. 3D-TRANSFORMATION & PROJEKTION
        // =========================================================
        const sinRy = Math.sin(this.currentRotY);
        const cosRy = Math.cos(this.currentRotY);
        const sinTz = Math.sin(this.currentTiltZ);
        const cosTz = Math.cos(this.currentTiltZ);
        const tiltX = 0.16; // Leichte Kamera-Neigung zeigt das Polmuster sauber
        const sinTx = Math.sin(tiltX);
        const cosTx = Math.cos(tiltX);

        for (let i = 0; i < this.vertices.length; i++) {
            const v = this.vertices[i];

            // 1) Spin um Y
            const rx = v.x * cosRy - v.z * sinRy;
            const rz = v.x * sinRy + v.z * cosRy;
            const ry = v.y;

            // 2) Seitliche Neigung um Z
            const zx = rx * cosTz - ry * sinTz;
            const zy = rx * sinTz + ry * cosTz;

            // 3) Leichte Vorwärtsneigung um X
            const xy = zy * cosTx - rz * sinTx;
            const xz = zy * sinTx + rz * cosTx;

            // 4) Elastisches Squash & Stretch + Kameraversatz
            const fx = zx * scaleX;
            const fy = xy * scaleY;
            const fz = xz * (1.0 + totalSquash * 0.35) + SPHERE_Z_OFFSET;

            this.transformed[i].x = fx;
            this.transformed[i].y = fy;
            this.transformed[i].z = fz;

            this.projected[i].x = Math.round(ballCenterX + (fx * fov) / fz);
            this.projected[i].y = Math.round(ballCenterY + (fy * fov) / fz);
        }

        // =========================================================
        // 7. BELEUCHTUNG, PERSPEKTIVISCHES CULLING & LUT-SHADING
        // =========================================================
        const lx = 0.22;
        const ly = -0.78;
        const lz = -0.58;
        const lLen = Math.sqrt(lx * lx + ly * ly + lz * lz);
        const nlx = lx / lLen;
        const nly = ly / lLen;
        const nlz = lz / lLen;

        this.faceVisible.fill(0);
        let activeFaces = 0;
        let maxDot = -1.0;
        let specFaceIdx = -1;

        const ambientBoost = chMid * 0.12 + activeSignal * 0.14;
        const specThreshold = 0.84 - activeSignal * 0.14 - chHigh * 0.08;
        const useCopperRim = (state === 'climax' || (state === 'buildup' && this.tension > 0.65)) && activeSignal > 0.25;

        for (let i = 0; i < this.facesDef.length; i++) {
            const faceDef = this.facesDef[i];
            const idxs = faceDef.idxs;

            // Bayer-Materialisierung / -Abbau auf Facettenebene (transparent ohne Alpha!)
            if (bayerThreshold < 16) {
                const cell = BAYER_4X4[((faceDef.lat & 3) << 2) | (faceDef.lon & 3)];
                if (cell >= bayerThreshold) continue;
            }

            const p0 = this.transformed[idxs[0]];
            const p1 = this.transformed[idxs[1]];
            const p2 = this.transformed[idxs[2]];
            const p3 = this.transformed[idxs[3]];

            // Normale über Diagonalen (p2 - p0) x (p3 - p1) -> gültig auch an beiden Polen!
            const d1x = p2.x - p0.x;
            const d1y = p2.y - p0.y;
            const d1z = p2.z - p0.z;
            const d2x = p3.x - p1.x;
            const d2y = p3.y - p1.y;
            const d2z = p3.z - p1.z;

            let nx = d1y * d2z - d1z * d2y;
            let ny = d1z * d2x - d1x * d2z;
            let nz = d1x * d2y - d1y * d2x;

            const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
            if (len <= 1e-6) continue;
            nx /= len;
            ny /= len;
            nz /= len;

            const cx3 = (p0.x + p1.x + p2.x + p3.x) * 0.25;
            const cy3 = (p0.y + p1.y + p2.y + p3.y) * 0.25;
            const cz3 = (p0.z + p1.z + p2.z + p3.z) * 0.25;

            // Echtes perspektivisches Backface-Culling gegen Kamera (0, 0, 0)
            if (nx * cx3 + ny * cy3 + nz * cz3 >= 0) continue;

            const dotLight = nx * nlx + ny * nly + nz * nlz;
            if (dotLight > maxDot) {
                maxDot = dotLight;
                specFaceIdx = activeFaces;
            }

            // Korrekte Diffuse-Beleuchtung (+dotLight!) + dezentes Scanline-Dither
            let brightness = 0.22 + ambientBoost + (0.78 - ambientBoost * 0.5) * Math.max(0.0, dotLight);
            if ((faceDef.lat & 1) === 1) brightness *= 0.94;
            const shadeIdx = clamp(Math.round(brightness * (SHADE_STEPS - 1)), 0, SHADE_STEPS - 1);

            // Bayer-Übergang in kühlere Afterglow-Palette oder Climax-Rim
            const useCool = this.afterglowMix > 0.02 &&
                BAYER_4X4[((faceDef.lat & 3) << 2) | (faceDef.lon & 3)] < this.afterglowMix * 16;

            let hex;
            if (useCool) {
                hex = faceDef.isRed ? COLOR_LUT.coolRed[shadeIdx] : COLOR_LUT.coolWhite[shadeIdx];
            } else if (useCopperRim && nz > -0.36 && dotLight < 0.15) {
                hex = faceDef.isRed ? COLOR_LUT.rimRed[shadeIdx] : COLOR_LUT.rimWhite[shadeIdx];
            } else {
                hex = faceDef.isRed ? COLOR_LUT.red[shadeIdx] : COLOR_LUT.white[shadeIdx];
            }

            this.faceVisible[faceDef.lat * LON_BANDS + faceDef.lon] = 1;

            const f = this.facesToDraw[activeFaces++];
            f.idxs = idxs;
            f.hex = hex;
            f.z = cz3;
            f.lat = faceDef.lat;
            f.lon = faceDef.lon;
            f.dot = dotLight;
        }

        // Specular Highlight auf Reinweiß (inkl. Nachbar-Aufhellung bei Hard-Beat)
        if (specFaceIdx !== -1 && maxDot > specThreshold) {
            this.facesToDraw[specFaceIdx].hex = PALETTE.white;
        }

        // In-Place-Insertion-Sort absteigend nach Z (0 Bytes Allokation)
        for (let i = 1; i < activeFaces; i++) {
            const current = this.facesToDraw[i];
            const currentZ = current.z;
            let j = i - 1;
            while (j >= 0 && this.facesToDraw[j].z < currentZ) {
                this.facesToDraw[j + 1] = this.facesToDraw[j];
                j--;
            }
            this.facesToDraw[j + 1] = current;
        }

        // =========================================================
        // 8. POLYGONE & 1px-SILHOUETTE RENDERN
        // =========================================================
        for (let i = 0; i < activeFaces; i++) {
            const face = this.facesToDraw[i];
            const idxs = face.idxs;
            if (face.lat === 0) {
                this.tri[0] = this.projected[idxs[0]];
                this.tri[1] = this.projected[idxs[2]];
                this.tri[2] = this.projected[idxs[3]];
                fillAliasedPolygon(ctx, this.tri, face.hex);
            } else if (face.lat === LAT_BANDS - 1) {
                this.tri[0] = this.projected[idxs[0]];
                this.tri[1] = this.projected[idxs[1]];
                this.tri[2] = this.projected[idxs[2]];
                fillAliasedPolygon(ctx, this.tri, face.hex);
            } else {
                this.quad[0] = this.projected[idxs[0]];
                this.quad[1] = this.projected[idxs[1]];
                this.quad[2] = this.projected[idxs[2]];
                this.quad[3] = this.projected[idxs[3]];
                fillAliasedPolygon(ctx, this.quad, face.hex);
            }
        }

        // Gestochen scharfe 1px-Außenkontur an sichtbaren Silhouette-Kanten
        for (let i = 0; i < activeFaces; i++) {
            const face = this.facesToDraw[i];
            const idxs = face.idxs;
            const lat = face.lat;
            const lon = face.lon;

            if (lat > 0 && this.faceVisible[(lat - 1) * LON_BANDS + lon] === 0) {
                const a = this.projected[idxs[0]];
                const b = this.projected[idxs[1]];
                drawAliasedLine(ctx, a.x, a.y, b.x, b.y, PALETTE.black);
            }
            const rightLon = (lon + 1) % LON_BANDS;
            if (this.faceVisible[lat * LON_BANDS + rightLon] === 0) {
                const a = this.projected[idxs[1]];
                const b = this.projected[idxs[2]];
                drawAliasedLine(ctx, a.x, a.y, b.x, b.y, PALETTE.black);
            }
            if (lat < LAT_BANDS - 1 && this.faceVisible[(lat + 1) * LON_BANDS + lon] === 0) {
                const a = this.projected[idxs[2]];
                const b = this.projected[idxs[3]];
                drawAliasedLine(ctx, a.x, a.y, b.x, b.y, PALETTE.black);
            }
            const leftLon = (lon - 1 + LON_BANDS) % LON_BANDS;
            if (this.faceVisible[lat * LON_BANDS + leftLon] === 0) {
                const a = this.projected[idxs[3]];
                const b = this.projected[idxs[0]];
                drawAliasedLine(ctx, a.x, a.y, b.x, b.y, PALETTE.black);
            }
        }
    }
}