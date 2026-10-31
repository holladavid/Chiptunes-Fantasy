// === js/visuals/dse/universal/starfield.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: UNIVERSAL 3D WARP STARFIELD (SCENE EDITION)
// Strict Aliased Rendering & Depth-Palettes (Zero Canvas-AA).
// C64: VIC-II 1x1 pixels, 72 stars, 8-line Rasterwobble, Voice 1/2 register sync.
// Amiga: OCS 180 stars, discrete Copper-nebula bands, Parallax Voice volume triggers.
// Atari: Shifter 120 stars, pure CPU Math, YM2149 Vol register rotation speed.
// Beat-switched warp/vortex patterns, aliased trails and deterministic recycling.
// =========================================================

import { C64_PALETTE, rgbToHex, quantizeAmiga12Bit, quantizeAtari9Bit, drawAliasedLine, applyOrderedDitherFade } from '../../utils/hardware-constraints.js';

const TWO_PI = Math.PI * 2;

export class Starfield {
    constructor() {
        this.name = 'Universal 3D Starfield';
        this.computerType = ['all'];
        this.placementType = 'background';

        // 256-Byte Sinus-Tabelle für mechatronische Raster-Interrupts
        this.sinLUT = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
            this.sinLUT[i] = Math.sin((i / 256) * TWO_PI);
        }

        this.numStars = 180; // Maximaler Pool für Amiga
        this.stars = Array.from({ length: this.numStars }, (v, i) => ({
            x: (Math.random() - 0.5) * 2000,
            y: (Math.random() - 0.5) * 2000,
            z: Math.random() * 990 + 10,
            type: i % 3,
            age: Math.random()
        }));

        this.smoothedWarp = 2.0;
        this.smoothedSpin = 0.15;
        this.atariSpeed = 0.05;
        this.angleZ = 0.0;
        this.internalT = 0;
        this.lastT = 0;

        // Makrozustände setzen stateTime nicht bei jedem Wechsel zurück.
        this.lastState = 'idle';
        this.stateAge = 0;
        this.pattern = 0;
        this.palettePhase = 0;
        this.lastBeatCount = 0;

        // Ein 23-Bit-LFSR ersetzt Math.random() beim Frustum-Recycling.
        this.recycleState = 0x5eed1234 & 0x7fffff;
        this.projectedX = 0;
        this.projectedY = 0;
    }

    resize(width, height) {}

    nextRandom() {
        const feedback = (this.recycleState ^ (this.recycleState >> 5)) & 1;
        this.recycleState = (this.recycleState >>> 1) | (feedback << 22);
        return this.recycleState / 0x800000;
    }

    recycleStar(star, rangeX, rangeY) {
        const randZ = this.nextRandom();
        star.z = 1000 - randZ * randZ * 900;
        star.x = (this.nextRandom() - 0.5) * rangeX;
        star.y = (this.nextRandom() - 0.5) * rangeY;
    }

    project(x, y, z, cx, cy, fov, twist) {
        let angle = 0;
        if (this.pattern === 1) {
            angle = (this.internalT * 0.8 + (1000 - z) * 0.002) * twist;
        } else if (this.pattern === 2) {
            const index = (Math.floor(this.internalT * 24) + Math.floor(z * 0.05)) & 255;
            angle = this.sinLUT[index] * 0.45 * twist;
        }
        const angleIndex = Math.floor(angle * 256 / TWO_PI) & 255;
        const sin = this.sinLUT[angleIndex];
        const cos = this.sinLUT[(angleIndex + 64) & 255];
        const rx = x * cos - y * sin;
        const ry = x * sin + y * cos;
        this.projectedX = Math.floor(cx + (rx / z) * fov);
        this.projectedY = Math.floor(cy + (ry / z) * fov);
    }

    render(ctx, width, height, t, state, stateTime, metrics) {
        if (width <= 0 || height <= 0 || !isFinite(width / height)) {
            this.lastT = t;
            return;
        }
        if (state === 'idle') {
            this.lastT = t;
            this.lastState = state;
            return;
        }

        const dt = this.lastT === 0 ? 0.02 : Math.max(0, Math.min(0.1, t - this.lastT));
        this.lastT = t;
        if (this.lastState !== state) {
            this.lastState = state;
            this.stateAge = 0;
        } else {
            this.stateAge += dt;
        }

        // Nur das exakte Ereignis schaltet Muster und Farbphase. Die Hülle
        // darf weiterhin jeden Frame für Warp und Helligkeit ausgewertet werden.
        if (metrics.beatStarted) {
            const count = Number.isFinite(metrics.beatCount)
                ? metrics.beatCount
                : this.lastBeatCount + 1;
            this.lastBeatCount = count;
            this.palettePhase = count & 3;
            if (count > 0 && count % 4 === 0) {
                this.pattern = (this.pattern + 1) % 3;
            }
        }

        const beat = metrics.beat?.[0] || 0;
        const fallbackTension = state === 'afterglow' ? Math.max(0, 1 - this.stateAge / 5) : 0.5;
        const tension = Math.max(0, Math.min(1,
            Number.isFinite(metrics.tensionPct) ? metrics.tensionPct : fallbackTension));

        let globalAlpha = 1.0;
        let targetWarp = 1.65;
        let beatWarp = 0.3;
        let spinSpeed = 0.12;
        let trail = 0;

        if (state === 'starting') {
            globalAlpha = Math.min(1.0, stateTime / 1.5);
            targetWarp *= globalAlpha;
        } else if (state === 'stopping') {
            globalAlpha = Math.max(0.0, 1.0 - stateTime / 1.5);
            targetWarp *= globalAlpha;
        } else if (state === 'buildup') {
            targetWarp = 3.1;
            beatWarp = 1.2;
            spinSpeed = 0.55;
            trail = 2.5;
        } else if (state === 'climax') {
            targetWarp = 5.5;
            beatWarp = 6.0;
            spinSpeed = 1.65;
            trail = 7.0;
        } else if (state === 'afterglow') {
            targetWarp = 0.65 + tension * 1.25;
            beatWarp = tension * 0.25;
            spinSpeed = 0.06 + tension * 0.18;
        }

        const warpBlend = 1 - Math.exp(-dt * 6);
        const spinBlend = 1 - Math.exp(-dt * 5);
        this.smoothedWarp += (targetWarp - this.smoothedWarp) * warpBlend;
        this.smoothedSpin += (spinSpeed - this.smoothedSpin) * spinBlend;

        const activeWarp = Math.max(0, this.smoothedWarp + beat * beatWarp);
        this.internalT += dt * this.smoothedSpin;
        ctx.globalAlpha = 1.0;

        if (metrics.system === 'c64') {
            this.drawC64(ctx, width, height, activeWarp, metrics, state, tension, trail);
        } else if (metrics.system === 'amiga') {
            this.drawAmiga(ctx, width, height, activeWarp, metrics, state, tension, trail, beat);
        } else {
            this.drawAtari(ctx, width, height, activeWarp, metrics, dt, state, tension, trail);
        }

        applyOrderedDitherFade(ctx, width, height, globalAlpha);
        ctx.globalAlpha = 1.0;
    }

    // =========================================================
    // RENDERER 1: COMMODORE 64 (VIC-II)
    // =========================================================
    drawC64(ctx, w, h, activeWarp, metrics, state, tension, trail) {
        const cx = Math.floor(w / 2);
        const cy = Math.floor(h / 2);
        const fov = Math.min(250, Math.min(w, h) * 1.25);
        const N = 72;
        const v1Gate = metrics.regs ? (metrics.regs[4] & 1) : 0;
        const warp = activeWarp * (1.0 + v1Gate * 1.5);

        let waveAmp = 2.0;
        if (state === 'buildup') waveAmp = 5.0;
        else if (state === 'climax') waveAmp = 9.0;
        else if (state === 'afterglow') waveAmp = 1.0 + tension * 3.0;

        const v2Gate = metrics.regs ? (metrics.regs[11] & 1) : 0;
        const wobbleAmp = (waveAmp + metrics.beat[0] * 12.0) * (v2Gate ? -1.5 : 1.0);
        const twist = state === 'climax' ? 1.15 : state === 'buildup' ? 0.75 : 0.16;

        for (let i = 0; i < N; i++) {
            const star = this.stars[i];
            star.z -= warp;
            this.project(star.x, star.y, star.z, cx, cy, fov, twist);
            let px = this.projectedX;
            const py = this.projectedY;

            const rowStep = this.pattern === 2 ? 4 : 8;
            const row = Math.floor(py / rowStep);
            const phase = Math.floor(this.internalT * (this.pattern === 0 ? 15 : 24));
            const wobble = Math.floor(this.sinLUT[(row + phase) & 255] * wobbleAmp);
            px += wobble;

            if (star.z <= 6 || px < -5 || px > w + 5 || py < -5 || py > h + 5) {
                this.recycleStar(star, w * 4.0, h * 4.0);
                continue;
            }

            const birthFactor = star.z > 900 ? (1000 - star.z) / 100 : 1.0;
            const zLimit = star.z / birthFactor;
            let colIdx = 11;
            if (zLimit < 250) colIdx = 1;
            else if (zLimit < 500) colIdx = 15;
            else if (zLimit < 750) colIdx = 12;

            if (state === 'afterglow') {
                colIdx = zLimit < 250 && tension > 0.25 ? 3 : zLimit < 600 ? 12 : 11;
            } else if (state === 'climax' && zLimit < 500 && ((i + this.palettePhase) & 3) === 0) {
                colIdx = this.pattern === 1 ? 3 : this.pattern === 2 ? 13 : 1;
            }

            const color = rgbToHex(...C64_PALETTE[colIdx]);
            if (trail > 0 && star.z < 600) {
                const tailZ = Math.min(1000, star.z + warp * trail);
                this.project(star.x, star.y, tailZ, cx, cy, fov, twist);
                drawAliasedLine(ctx, this.projectedX + wobble, this.projectedY, px, py, color);
            }
            ctx.fillStyle = color;
            ctx.fillRect(px, py, 1, 1);
        }
    }

    // =========================================================
    // RENDERER 2: AMIGA 500 (OCS)
    // =========================================================
    drawAmiga(ctx, w, h, activeWarp, metrics, state, tension, trail, beat) {
        const cx = Math.floor(w / 2);
        const cy = Math.floor(h / 2);
        const fov = Math.min(250, Math.min(w, h) * 1.25);
        const N = 180;

        const copperIndex = Math.floor(this.internalT * 40) & 255;
        let copperY = Math.floor(cy + this.sinLUT[copperIndex] * h * 0.22);
        if (this.pattern === 2 && state !== 'afterglow') {
            copperY = Math.floor(cy + ((this.palettePhase & 1) ? -1 : 1) * h * 0.18);
        }
        const copperH = Math.floor(h * (state === 'climax' ? 0.22 : state === 'afterglow' ? 0.12 : 0.18));
        const bandCount = 12;
        const bandHeight = Math.max(1, Math.ceil(copperH / bandCount));
        const nebulaBeat = state === 'afterglow' ? 0 : beat;

        for (let b = 0; b < bandCount; b++) {
            const pct = Math.abs(b - bandCount / 2) / (bandCount / 2);
            const band = 1.0 - pct;
            let r = (20 + (this.pattern === 2 ? 45 : 0)) * nebulaBeat * band;
            let g = (10 + (this.pattern === 1 ? 30 : 0)) * band;
            let bVal = (50 + nebulaBeat * 70) * band;
            if (state === 'afterglow') {
                r = 0;
                g = 22 * tension * band;
                bVal = 72 * tension * band;
            }
            ctx.fillStyle = rgbToHex(...quantizeAmiga12Bit(r, g, bVal));
            ctx.fillRect(0, Math.floor(copperY - copperH / 2 + b * bandHeight), w, bandHeight);
        }

        const twist = state === 'climax' ? 1.2 : state === 'buildup' ? 0.8 : state === 'afterglow' ? tension * 0.2 : 0.18;
        for (let i = 0; i < N; i++) {
            const star = this.stars[i];
            const volMod = metrics.smooth[star.type] || 0.0;
            const speed = activeWarp * (1.0 + star.type * 0.45 + volMod * 3.5);
            star.z -= speed;
            this.project(star.x, star.y, star.z, cx, cy, fov, twist);
            const px = this.projectedX;
            const py = this.projectedY;

            if (star.z <= 6 || px < -5 || px > w + 5 || py < -5 || py > h + 5) {
                this.recycleStar(star, w * 4.0, h * 4.0);
                continue;
            }

            const birthFactor = star.z > 900 ? (1000 - star.z) / 100 : 1.0;
            let brightness = Math.max(0.0, 1.0 - star.z / 1000) * birthFactor;
            if (state === 'afterglow') brightness *= 0.3 + tension * 0.7;
            else if (state === 'climax') brightness = Math.min(1, brightness * (1 + beat * 0.25));

            let starColor;
            if (state === 'afterglow') {
                starColor = rgbToHex(...quantizeAmiga12Bit(0, 190 * brightness, 255 * brightness));
            } else if (star.type === 0) {
                starColor = rgbToHex(...quantizeAmiga12Bit(100 * brightness, 150 * brightness, 255 * brightness));
            } else if (star.type === 1) {
                starColor = rgbToHex(...quantizeAmiga12Bit(100 * brightness, 220 * brightness, 255 * brightness));
            } else {
                starColor = rgbToHex(...quantizeAmiga12Bit(255 * brightness, 255 * brightness, 255 * brightness));
            }

            if (trail > 0 && star.z < 600 && brightness > 0.08) {
                const tailZ = Math.min(1000, star.z + speed * trail);
                this.project(star.x, star.y, tailZ, cx, cy, fov, twist);
                drawAliasedLine(ctx, this.projectedX, this.projectedY, px, py, starColor);
            }
            const size = Math.max(1, Math.floor(1.0 + brightness * 1.5));
            ctx.fillStyle = starColor;
            ctx.fillRect(Math.floor(px - size / 2), Math.floor(py - size / 2), size, size);
        }
    }

    // =========================================================
    // RENDERER 3: ATARI ST (SHIFTER)
    // =========================================================
    drawAtari(ctx, w, h, activeWarp, metrics, dt, state, tension, trail) {
        const cx = Math.floor(w / 2);
        const cy = Math.floor(h / 2);
        const fov = Math.min(250, Math.min(w, h) * 1.25);
        const N = 120;

        const volA = metrics.regs ? (metrics.regs[8] & 15) : 0;
        const volB = metrics.regs ? (metrics.regs[9] & 15) : 0;
        const volC = metrics.regs ? (metrics.regs[10] & 15) : 0;
        const totalVol = (volA + volB + volC) / 45.0;

        let targetRot = 0.05 + totalVol * 0.8;
        if (state === 'afterglow') targetRot *= 0.25 + tension * 0.75;
        this.atariSpeed += (targetRot - this.atariSpeed) * Math.min(1, dt * 6);

        const stateSpin = state === 'climax' ? 2.5 : state === 'buildup' ? 1.6 : 1.0;
        const direction = this.pattern === 1 ? -1 : 1;
        this.angleZ += dt * this.atariSpeed * stateSpin * direction;
        const displayAngle = this.pattern === 2
            ? Math.floor(this.angleZ * 16 / TWO_PI) * TWO_PI / 16
            : this.angleZ;
        const angleIndex = Math.floor(displayAngle * 256 / TWO_PI) & 255;
        const sinR = this.sinLUT[angleIndex];
        const cosR = this.sinLUT[(angleIndex + 64) & 255];

        const diag = Math.sqrt(w * w + h * h) / 2;
        const cullDistSq = (diag + 5) * (diag + 5);
        const spawnRange = diag * 8.0;

        for (let i = 0; i < N; i++) {
            const star = this.stars[i];
            star.z -= activeWarp;
            const rxRot = star.x * cosR - star.y * sinR;
            const ryRot = star.x * sinR + star.y * cosR;
            const px = Math.floor(cx + (rxRot / star.z) * fov);
            const py = Math.floor(cy + (ryRot / star.z) * fov);
            const distFromCenterSq = (px - cx) * (px - cx) + (py - cy) * (py - cy);

            if (star.z <= 6 || distFromCenterSq > cullDistSq) {
                this.recycleStar(star, spawnRange, spawnRange);
                continue;
            }

            const birthFactor = star.z > 900 ? (1000 - star.z) / 100 : 1.0;
            const brightness = Math.max(0.0, 1.0 - star.z / 1000) * birthFactor;
            const zLimit = star.z / birthFactor;
            let starColor;
            if (state === 'afterglow') {
                const cool = brightness * (0.3 + tension * 0.7);
                starColor = rgbToHex(...quantizeAtari9Bit(0, 180 * cool, 255 * cool));
            } else if (zLimit < 250) {
                starColor = rgbToHex(...quantizeAtari9Bit(255, 255, 255));
            } else if (zLimit < 500) {
                starColor = rgbToHex(...quantizeAtari9Bit(0, 255, 255));
            } else if (zLimit < 750) {
                starColor = rgbToHex(...quantizeAtari9Bit(136, 136, 136));
            } else {
                starColor = rgbToHex(...quantizeAtari9Bit(0, 0, 136));
            }

            if (trail > 0 && star.z < 600) {
                const tailZ = Math.min(1000, star.z + activeWarp * trail);
                const tailX = Math.floor(cx + (rxRot / tailZ) * fov);
                const tailY = Math.floor(cy + (ryRot / tailZ) * fov);
                drawAliasedLine(ctx, tailX, tailY, px, py, starColor);
            }
            const size = star.z < 300 && state !== 'afterglow' ? 2 : 1;
            ctx.fillStyle = starColor;
            ctx.fillRect(px, py, size, size);
        }
    }
}
