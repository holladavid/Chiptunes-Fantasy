// === js/visuals/dse/amiga/castle-fireworks.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: AMIGA CASTLE FIREWORKS (Background DSE)
// Cinemaware / "Defender of the Crown" (Jim Sachs) inspired medieval
// fantasy fortress with cylindrical 3D-shaded stone towers, conical
// slate roofs, corbelled parapets, twin-towered gatehouse, rocky cliff
// promontory, forested ridges, and a BPLCON1 reflective castle moat.
// Embedded Amiga Demo-Scene effects: scanline-dithered Copper sky,
// horizon aurora waves, multi-stage Blitter fireworks with directional
// tower rim-lighting, battlement spark fountains, swooping bats, and
// forked Copper lightning.
// Fully reactive to music beat-levels (1=soft, 2=medium, 3=hard),
// continuous beat-strength, and tension progression.
// 100% Amiga 12-bit quantized 27-color OCS palette, zero-GC render loop.
// =========================================================

import {
    applyOrderedDitherFade,
    quantizeAmiga12Bit,
    rgbToHex
} from '../../utils/hardware-constraints.js';

const RAW_PALETTE = [
    [0, 0, 0], [8, 8, 35], [12, 16, 61], [26, 16, 82],
    [54, 22, 92], [90, 29, 79], [123, 28, 58], [156, 41, 37],
    [90, 20, 30], [17, 13, 35], [32, 24, 55], [21, 18, 40],
    [39, 30, 61], [75, 52, 84], [70, 146, 193], [50, 205, 225],
    [243, 230, 167], [192, 210, 239], [255, 208, 79], [255, 127, 33],
    [230, 53, 60], [209, 73, 170], [67, 216, 157], [255, 255, 255],
    [64, 69, 105], [110, 122, 157], [28, 52, 104]
];

export const AMIGA_CASTLE_FIREWORKS_PALETTE = Object.freeze(
    RAW_PALETTE.map(color => rgbToHex(...quantizeAmiga12Bit(...color)))
);
export const MAX_FIREWORK_BURSTS = 6;
const MAX_BATS = 4;
const MAX_FOUNTAINS = 4;
const MAX_COMETS = 3;

const COLOR = Object.freeze({
    black: 0,
    deepSky: 1,
    blueSky: 2,
    indigo: 3,
    purple: 4,
    horizon: 5,
    wine: 6,
    rust: 7,
    blood: 8,
    farHill: 9,
    midHill: 10,
    castle: 11,
    stone: 12,
    stoneLight: 13,
    blue: 14,
    cyan: 15,
    moon: 16,
    silver: 17,
    gold: 18,
    orange: 19,
    red: 20,
    magenta: 21,
    jade: 22,
    white: 23,
    cloud: 24,
    cloudLight: 25,
    copperBlue: 26
});

const STAR_POSITIONS = [
    [0.035, 0.12], [0.095, 0.32], [0.16, 0.19], [0.225, 0.09],
    [0.29, 0.29], [0.355, 0.15], [0.42, 0.39], [0.48, 0.11],
    [0.54, 0.25], [0.60, 0.08], [0.66, 0.34], [0.72, 0.16],
    [0.78, 0.41], [0.84, 0.10], [0.90, 0.27], [0.965, 0.18],
    [0.07, 0.48], [0.24, 0.44], [0.40, 0.50], [0.61, 0.47],
    [0.76, 0.51], [0.93, 0.46]
];

const DIRECTIONS_X = [100, 92, 71, 38, 0, -38, -71, -92, -100, -92, -71, -38, 0, 38, 71, 92];
const DIRECTIONS_Y = [0, 38, 71, 92, 100, 92, 71, 38, 0, -38, -71, -92, -100, -92, -71, -38];
const SUB_DIRS_X = [70, -70, 0, 0];
const SUB_DIRS_Y = [0, 0, 70, -70];

// Fallback 8x8 moon table for ultra-tiny test canvases
const MOON_ROWS = [
    [3, 4], [2, 6], [1, 7], [0, 7],
    [0, 6], [1, 5], [2, 4], [3, 4]
];

// High-res 18-row Deluxe Paint spherical moon chord table [startCol, endCol, MariaCraterStart, MariaCraterEnd]
const DP_MOON_CHORDS = [
    [6, 11, -1, -1],
    [4, 13, -1, -1],
    [3, 14, 8, 11],
    [2, 15, 7, 12],
    [1, 16, 6, 12],
    [1, 16, 5, 10],
    [0, 17, 4, 9],
    [0, 17, 5, 11],
    [0, 17, 8, 13],
    [0, 17, 9, 14],
    [0, 17, 7, 12],
    [0, 17, 5, 9],
    [1, 16, 6, 10],
    [1, 16, -1, -1],
    [2, 15, 8, 11],
    [3, 14, -1, -1],
    [4, 13, -1, -1],
    [6, 11, -1, -1]
];

// Sculpted cumulus cloud dome profile [xOffsetUnits, widthUnits, heightUnits]
const CLOUD_DOMES = [
    [2, 5, 2],
    [5, 7, 4],
    [10, 6, 3],
    [14, 5, 2],
    [7, 6, 5]
];

const SKY_BAND_EDGES = [0, 0.12, 0.27, 0.43, 0.57, 0.68, 0.78, 1];
const SKY_BAND_COLORS = [
    COLOR.black, COLOR.deepSky, COLOR.blueSky, COLOR.indigo,
    COLOR.purple, COLOR.horizon, COLOR.wine
];

const COPPER_BAR_CALM = [COLOR.indigo, COLOR.copperBlue, COLOR.cyan, COLOR.copperBlue, COLOR.indigo];
const COPPER_BAR_MYSTIC = [COLOR.purple, COLOR.magenta, COLOR.silver, COLOR.magenta, COLOR.purple];
const COPPER_BAR_TENSE = [COLOR.blood, COLOR.rust, COLOR.orange, COLOR.gold, COLOR.rust];
const COPPER_BAR_CLIMAX = [COLOR.wine, COLOR.red, COLOR.white, COLOR.gold, COLOR.blood];

const FOUNTAIN_X_OFFSETS = [0.23, 0.38, 0.62, 0.77];
const TORCH_DEPTHS = [0.22, 0.54, 0.84];

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const paletteColor = index => AMIGA_CASTLE_FIREWORKS_PALETTE[index];

function macroTension(state) {
    if (state === 'climax') return 0.9;
    if (state === 'buildup') return 0.72;
    if (state === 'afterglow') return 0.24;
    if (state === 'starting') return 0.35;
    return 0.4;
}

export class AmigaCastleFireworks {
    constructor() {
        this.name = 'Amiga Castle Fireworks';
        this.lastT = 0;
        this.hasRendered = false;
        this.lastBeatCount = -1;
        this.fallbackBeatCount = 0;
        this.lastBeatEvent = false;
        this.burstCursor = 0;
        this.batCursor = 0;
        this.fountainCursor = 0;
        this.cometCursor = 0;
        this.tension = 0.4;
        this.beatPulse = 0;
        this.softPulse = 0;
        this.medPulse = 0;
        this.heavyPulse = 0;
        this.currentBeatLevel = 1;
        this.copperPhase = 0;
        this.lightningTimer = 0;
        this.lightningX = 0.5;
        this.lightningSeed = 0;
        this.leftGlow = 0;
        this.rightGlow = 0;
        this.leftGlowColor = COLOR.stoneLight;
        this.rightGlowColor = COLOR.stoneLight;

        // Pre-allocated bounded firework burst pool (Zero-GC)
        this.bursts = Array.from({ length: MAX_FIREWORK_BURSTS }, () => ({
            active: false,
            x: 0,
            y: 0,
            launchY: 0.72,
            startTime: 0,
            duration: 0,
            radiusFactor: 0,
            strength: 0,
            beatLevel: 1,
            particleCount: 0,
            pattern: 0,
            color: COLOR.gold,
            secondaryColor: COLOR.orange
        }));

        // Pre-allocated Amiga hardware sprite vampire bats (Zero-GC)
        this.bats = Array.from({ length: MAX_BATS }, () => ({
            active: false,
            startX: 0,
            startY: 0,
            targetX: 0,
            targetY: 0,
            startTime: -100,
            duration: 2.5,
            flapSpeed: 10
        }));

        // Pre-allocated castle battlement sparkler fountains (Zero-GC)
        this.fountains = Array.from({ length: MAX_FOUNTAINS }, () => ({
            active: false,
            slot: 0,
            startTime: -100,
            duration: 0.55,
            level: 1,
            color: COLOR.gold,
            secondaryColor: COLOR.white
        }));

        // Pre-allocated Chiptune sky comets / shooting stars (Zero-GC)
        this.comets = Array.from({ length: MAX_COMETS }, () => ({
            active: false,
            startX: 0,
            startY: 0,
            dx: 0,
            dy: 0,
            startTime: -100,
            duration: 0.45,
            color: COLOR.cyan
        }));
    }

    rect(ctx, width, height, x, y, rectWidth, rectHeight, colorIndex) {
        if (!Number.isFinite(x) || !Number.isFinite(y) ||
            !Number.isFinite(rectWidth) || !Number.isFinite(rectHeight) ||
            rectWidth <= 0 || rectHeight <= 0) return;

        const left = Math.max(0, Math.floor(x));
        const top = Math.max(0, Math.floor(y));
        const right = Math.min(width, Math.ceil(x + rectWidth));
        const bottom = Math.min(height, Math.ceil(y + rectHeight));
        if (right <= left || bottom <= top) return;

        ctx.fillStyle = paletteColor(colorIndex);
        ctx.fillRect(left, top, right - left, bottom - top);
    }

    scaledRect(ctx, width, height, left, top, castleWidth, castleHeight, x, y, rectWidth, rectHeight, color) {
        this.rect(
            ctx, width, height,
            left + x * castleWidth,
            top + y * castleHeight,
            rectWidth * castleWidth,
            rectHeight * castleHeight,
            color
        );
    }

    drawSky(ctx, width, height, time, tension, beatImpulse) {
        // 1. Deluxe Paint / Amiga Copper sky gradient with scanline interleave dithering
        const ditherSpan = clamp(Math.floor(height / 45), 1, 8);
        for (let i = 0; i < SKY_BAND_COLORS.length; i++) {
            const edgeOffset = i >= 4 ? tension * 0.04 : 0;
            const top = Math.floor(height * Math.min(1, SKY_BAND_EDGES[i] + edgeOffset));
            const nextEdge = i === SKY_BAND_COLORS.length - 1
                ? 1
                : Math.min(1, SKY_BAND_EDGES[i + 1] + (i + 1 >= 4 ? tension * 0.04 : 0));
            const bottom = Math.floor(height * nextEdge);
            if (bottom > top) {
                this.rect(ctx, width, height, 0, top, width, bottom - top, SKY_BAND_COLORS[i]);

                // 2-stage Amiga scanline dither transition between sky bands
                if (i < SKY_BAND_COLORS.length - 1 && height >= 48) {
                    const nextColor = SKY_BAND_COLORS[i + 1];
                    const seamStart = Math.max(top, bottom - ditherSpan);
                    for (let sy = seamStart; sy < bottom; sy++) {
                        const rel = sy - seamStart;
                        if ((sy & 1) === 1 || (rel > ditherSpan * 0.6 && (sy % 3 === 0))) {
                            this.rect(ctx, width, height, 0, sy, width, 1, nextColor);
                        }
                    }
                }
            }
        }

        // 2. Embedded Amiga Copper Aurora / Horizon Raster Ribbons behind the mountains
        const baseRasterY = Math.floor(height * (0.53 + tension * 0.05));
        const waveAmp = Math.max(1, Math.floor(height * (0.010 + tension * 0.014 + beatImpulse * 0.010)));
        const barCount = tension > 0.68 ? 3 : 2;
        const phase = this.copperPhase || (time * 3.2);

        for (let b = 0; b < barCount; b++) {
            const barWave = Math.sin(phase + b * 2.1) * waveAmp
                + Math.cos(phase * 0.65 - b * 1.4) * (waveAmp * 0.45);
            const centerLine = Math.floor(baseRasterY + barWave);
            const palette = this.heavyPulse > 0.45
                ? COPPER_BAR_CLIMAX
                : (tension > 0.65
                    ? (b % 2 === 0 ? COPPER_BAR_TENSE : COPPER_BAR_MYSTIC)
                    : (b % 2 === 0 ? COPPER_BAR_CALM : COPPER_BAR_MYSTIC));

            if (height < 60) {
                this.rect(ctx, width, height, 0, centerLine, width, 1, palette[2]);
            } else {
                for (let row = 0; row < 5; row++) {
                    const ly = centerLine + row - 2;
                    let col = palette[row];
                    if (row === 2 && (beatImpulse > 0.5 || this.medPulse > 0.5)) {
                        col = tension > 0.65 ? COLOR.white : COLOR.gold;
                    }
                    this.rect(ctx, width, height, 0, ly, width, 1, col);
                }
            }
        }

        // 3. Twinkling stars with beat-level glints
        const twinkle = Math.floor(time * (1.8 + tension * 2.4));
        for (let i = 0; i < STAR_POSITIONS.length; i++) {
            const x = Math.floor(STAR_POSITIONS[i][0] * width);
            const y = Math.floor(STAR_POSITIONS[i][1] * height * 0.62);
            const isGlintStar = (i + twinkle) % 4 === 0;

            if (isGlintStar && (beatImpulse > 0.20 || this.softPulse > 0.25)) {
                const arm = (this.heavyPulse > 0.4 && i % 2 === 0) ? 2 : 1;
                const armCol = tension > 0.7 ? COLOR.gold : COLOR.silver;
                this.rect(ctx, width, height, x - arm, y, arm * 2 + 1, 1, armCol);
                this.rect(ctx, width, height, x, y - arm, 1, arm * 2 + 1, COLOR.cyan);
                this.rect(ctx, width, height, x, y, 1, 1, COLOR.white);
            } else {
                const color = (i + twinkle) % 4 === 0
                    ? COLOR.white
                    : ((i + twinkle) % 6 === 0 ? COLOR.cyan : COLOR.silver);
                this.rect(ctx, width, height, x, y, 1, 1, color);
            }
        }

        // 4. Shooting Comets on medium/hard beats
        for (let c = 0; c < this.comets.length; c++) {
            const comet = this.comets[c];
            if (!comet.active) continue;
            const age = time - comet.startTime;
            if (age < 0 || age >= comet.duration) {
                comet.active = false;
                continue;
            }
            const prog = age / comet.duration;
            const cx = Math.floor((comet.startX + comet.dx * prog) * width);
            const cy = Math.floor((comet.startY + comet.dy * prog) * height);
            const tailStepX = Math.sign(comet.dx) * 2 || 2;
            const tailStepY = Math.sign(comet.dy) || 1;
            this.rect(ctx, width, height, cx - tailStepX * 2, cy - tailStepY * 2, 1, 1, COLOR.indigo);
            this.rect(ctx, width, height, cx - tailStepX, cy - tailStepY, 2, 1, comet.color);
            this.rect(ctx, width, height, cx, cy, 2, 1, COLOR.white);
        }

        this.drawMoon(ctx, width, height, tension);
        // Multi-layered Deluxe Paint clouds drifting across moon and sky
        this.drawCloud(ctx, width, height, time, 0.12, 0.21, 0.008 + tension * 0.005, COLOR.cloud);
        this.drawCloud(ctx, width, height, time, 0.42, 0.17, 0.013 + tension * 0.008, COLOR.cloud);
        this.drawCloud(ctx, width, height, time, 0.74, 0.31, -0.010 - tension * 0.006, COLOR.cloudLight);
    }

    drawMoon(ctx, width, height, tension) {
        const minDim = Math.min(width, height);
        if (minDim < 8) return;

        // Fallback for very small test canvases
        if (minDim < 64) {
            const unit = clamp(Math.floor(minDim / 55), 1, 7);
            if (width < unit * 8 || height < unit * 8) return;
            const x = clamp(Math.floor(width * 0.10), 0, width - unit * 8);
            const y = clamp(Math.floor(height * 0.13), 0, height - unit * 8);
            const moonColor = tension > 0.72 ? COLOR.rust : COLOR.moon;
            for (let row = 0; row < MOON_ROWS.length; row++) {
                const [start, end] = MOON_ROWS[row];
                this.rect(ctx, width, height, x + start * unit, y + row * unit, (end - start + 1) * unit, unit, moonColor);
            }
            return;
        }

        // Deluxe Paint 18-row Spherical Moon with lunar Maria craters & spherical shading
        const unit = clamp(Math.floor(minDim / 95), 1, 4);
        const moonSize = unit * 18;
        if (width < moonSize || height < moonSize) return;
        const x = clamp(Math.floor(width * 0.09), 0, width - moonSize);
        const y = clamp(Math.floor(height * 0.10), 0, height - moonSize);

        const isBloodMoon = tension > 0.72;
        const baseCol = isBloodMoon ? COLOR.orange : COLOR.moon;
        const rimCol = isBloodMoon ? COLOR.gold : COLOR.white;
        const shadeCol = isBloodMoon ? COLOR.rust : COLOR.silver;
        const craterCol = isBloodMoon ? COLOR.blood : COLOR.cloudLight;

        // Scanline-dithered outer lunar corona
        if (x >= unit * 3 && y >= unit * 3) {
            const haloCol = isBloodMoon ? COLOR.wine : COLOR.blueSky;
            for (let r = -2; r < 20; r++) {
                if ((r & 1) === 0) {
                    const chord = DP_MOON_CHORDS[clamp(r, 0, 17)];
                    const hx = x + (chord[0] - 2) * unit;
                    const hw = (chord[1] - chord[0] + 5) * unit;
                    this.rect(ctx, width, height, hx, y + r * unit, hw, unit, haloCol);
                }
            }
        }

        for (let r = 0; r < DP_MOON_CHORDS.length; r++) {
            const [start, end, cStart, cEnd] = DP_MOON_CHORDS[r];
            const span = end - start + 1;
            const rowY = y + r * unit;

            // Main spherical body
            this.rect(ctx, width, height, x + start * unit, rowY, span * unit, unit, baseCol);
            // Bright upper-left rim highlight
            this.rect(ctx, width, height, x + start * unit, rowY, Math.max(1, Math.floor(span * 0.22)) * unit, unit, rimCol);
            // Lower-right spherical terminator shading
            const shadeW = Math.max(1, Math.floor(span * 0.28));
            this.rect(ctx, width, height, x + (end - shadeW + 1) * unit, rowY, shadeW * unit, unit, shadeCol);

            // Lunar Maria (seas & craters)
            if (cStart >= 0 && cEnd >= cStart) {
                this.rect(ctx, width, height, x + cStart * unit, rowY, (cEnd - cStart + 1) * unit, unit, craterCol);
            }
        }
    }

    drawCloud(ctx, width, height, time, baseX, baseY, speed, color) {
        const minDim = Math.min(width, height);
        if (minDim < 12) return;
        const unit = clamp(Math.floor(minDim / 115), 1, 5);
        const cloudWidth = unit * 22;
        if (cloudWidth >= width) return;

        const travel = width + cloudWidth;
        const offset = time * minDim * speed;
        const x = ((baseX * width + offset + cloudWidth) % travel + travel) % travel - cloudWidth;
        const y = Math.floor(baseY * height);

        // Dynamic top highlight from moon, lightning, or nearby firework bursts
        let rimColor = COLOR.silver;
        let midHighlight = COLOR.cloudLight;
        if (this.lightningTimer > 0.08) {
            rimColor = COLOR.white;
            midHighlight = COLOR.cyan;
        } else if (baseX < 0.5 && this.leftGlow > 0.22) {
            rimColor = this.leftGlowColor;
        } else if (baseX >= 0.5 && this.rightGlow > 0.22) {
            rimColor = this.rightGlowColor;
        }

        // Sculpted multi-dome Deluxe Paint cumulus cloud bank
        for (let d = 0; d < CLOUD_DOMES.length; d++) {
            const [dx, dw, dh] = CLOUD_DOMES[d];
            const domeX = x + dx * unit;
            const domeY = y - dh * unit;
            const domeW = dw * unit;
            const domeH = dh * unit;

            // Silver/lit upper rim
            this.rect(ctx, width, height, domeX + unit, domeY, domeW - unit * 2, unit, rimColor);
            // Upper billow highlight
            this.rect(ctx, width, height, domeX, domeY + unit, domeW, Math.max(unit, domeH - unit), midHighlight);
            // Core cloud volume
            this.rect(ctx, width, height, domeX + unit, domeY + unit * 2, domeW - unit, Math.max(unit, domeH - unit), color);
        }

        // Flat shadowed cloud base & stratus wisps
        this.rect(ctx, width, height, x + unit, y, unit * 19, unit * 2, color);
        this.rect(ctx, width, height, x + unit * 2, y + unit, unit * 18, unit, COLOR.indigo);
        this.rect(ctx, width, height, x + unit * 4, y + unit * 2, unit * 14, Math.max(1, Math.floor(unit * 0.7)), COLOR.deepSky);
    }

    drawLightning(ctx, width, height) {
        if (this.lightningTimer <= 0) return;
        const flashIntensity = this.lightningTimer / 0.22;

        // 1. Amiga Copper sky flash bars
        const cloudY = Math.floor(height * 0.20);
        this.rect(ctx, width, height, 0, cloudY, width, 2, flashIntensity > 0.5 ? COLOR.white : COLOR.silver);
        if (flashIntensity > 0.65) {
            this.rect(ctx, width, height, 0, Math.floor(height * 0.12), width, 1, COLOR.cyan);
        }

        // 2. Jagged gothic forked lightning bolt
        const startX = Math.floor(this.lightningX * width);
        const startY = Math.floor(height * 0.10);
        const endY = Math.floor(height * 0.54);
        const segments = 8;
        const stepY = Math.max(1, Math.floor((endY - startY) / segments));
        let curX = startX;
        let curY = startY;

        for (let s = 0; s < segments; s++) {
            const nextY = Math.min(endY, curY + stepY);
            const zig = (((s + this.lightningSeed) * 11) % 7 - 3) * Math.max(1, Math.floor(width / 180));
            const nextX = clamp(curX + zig, 0, Math.max(0, width - 2));
            const segX = Math.min(curX, nextX);
            const segW = Math.max(1, Math.abs(nextX - curX) + 1);
            const segCol = (s & 1) === 0 ? COLOR.white : COLOR.cyan;
            this.rect(ctx, width, height, segX, curY, segW, Math.max(1, nextY - curY), segCol);

            if (s === 2 || s === 5) {
                const dir = s === 2 ? -1 : 1;
                const forkX = clamp(curX + dir * Math.abs(zig * 2 + 3), 0, Math.max(0, width - 1));
                const fLeft = Math.min(curX, forkX);
                this.rect(ctx, width, height, fLeft, curY, Math.max(1, Math.abs(forkX - curX)), Math.max(1, Math.floor(stepY * 0.8)), COLOR.silver);
                this.rect(ctx, width, height, forkX, curY + Math.floor(stepY * 0.8), 1, stepY, COLOR.blue);
            }
            curX = nextX;
            curY = nextY;
        }
    }

    drawBats(ctx, width, height, time) {
        for (let i = 0; i < this.bats.length; i++) {
            const bat = this.bats[i];
            if (!bat.active) continue;

            const age = time - bat.startTime;
            if (age < 0 || age >= bat.duration) {
                bat.active = false;
                continue;
            }

            const prog = age / bat.duration;
            const wave = Math.sin(prog * Math.PI * 4 + bat.startTime) * height * 0.038;
            const curX = clamp(
                Math.floor((bat.startX + (bat.targetX - bat.startX) * prog) * width),
                0,
                Math.max(0, width - 7)
            );
            const curY = clamp(
                Math.floor((bat.startY + (bat.targetY - bat.startY) * prog) * height + wave),
                0,
                Math.max(0, height - 5)
            );
            const flap = Math.floor((age * bat.flapSpeed) % 3);
            const wingCol = this.tension > 0.72 ? COLOR.blood : COLOR.castle;

            if (flap === 0) {
                this.rect(ctx, width, height, curX + 2, curY + 1, 3, 2, COLOR.black);
                this.rect(ctx, width, height, curX, curY, 2, 2, wingCol);
                this.rect(ctx, width, height, curX + 5, curY, 2, 2, wingCol);
            } else if (flap === 1) {
                this.rect(ctx, width, height, curX + 2, curY + 1, 3, 2, COLOR.black);
                this.rect(ctx, width, height, curX, curY + 1, 2, 1, wingCol);
                this.rect(ctx, width, height, curX + 5, curY + 1, 2, 1, wingCol);
            } else {
                this.rect(ctx, width, height, curX + 2, curY, 3, 2, COLOR.black);
                this.rect(ctx, width, height, curX + 1, curY + 2, 2, 2, wingCol);
                this.rect(ctx, width, height, curX + 4, curY + 2, 2, 2, wingCol);
            }
            const eyeCol = this.heavyPulse > 0.4 ? COLOR.gold : COLOR.red;
            this.rect(ctx, width, height, curX + 3, curY + 1, 1, 1, eyeCol);
        }
    }

    acceptsBeat(index, state) {
        if (state === 'climax') return true;
        if (state === 'buildup') return index % 2 === 1;
        if (state === 'afterglow') return index % 4 === 0;
        if (state === 'starting') return index % 4 === 1;
        if (state === 'stopping' || state === 'idle') return false;
        return index % 3 === 1;
    }

    spawnFountain(index, level, tension, time) {
        const count = level === 3 ? 2 : 1;
        for (let f = 0; f < count; f++) {
            const fountain = this.fountains[this.fountainCursor];
            this.fountainCursor = (this.fountainCursor + 1) % MAX_FOUNTAINS;
            fountain.active = true;
            fountain.slot = (index + f * 2) % FOUNTAIN_X_OFFSETS.length;
            fountain.startTime = time;
            fountain.duration = 0.42 + level * 0.14 + tension * 0.12;
            fountain.level = level;
            fountain.color = level === 3
                ? COLOR.white
                : (level === 2 ? (index % 2 === 0 ? COLOR.cyan : COLOR.magenta) : COLOR.gold);
            fountain.secondaryColor = level >= 2 ? COLOR.gold : COLOR.orange;
        }
    }

    spawnComet(index, time) {
        const comet = this.comets[this.cometCursor];
        this.cometCursor = (this.cometCursor + 1) % MAX_COMETS;
        const fromLeft = (index & 1) === 0;
        comet.active = true;
        comet.startX = fromLeft ? 0.08 + ((index * 7) % 25) / 100 : 0.92 - ((index * 7) % 25) / 100;
        comet.startY = 0.06 + ((index * 5) % 18) / 100;
        comet.dx = fromLeft ? 0.22 : -0.22;
        comet.dy = 0.10 + ((index % 3) * 0.03);
        comet.startTime = time;
        comet.duration = 0.38;
        comet.color = (index % 3 === 0) ? COLOR.cyan : ((index % 3 === 1) ? COLOR.gold : COLOR.magenta);
    }

    spawnBurst(index, strength, tension, state, time, beatLevel = 2) {
        if (!this.acceptsBeat(index, state)) return;
        const burst = this.bursts[this.burstCursor];
        this.burstCursor = (this.burstCursor + 1) % MAX_FIREWORK_BURSTS;

        const variation = (index * 7) % 5;
        const leftSide = (index & 1) === 0;
        burst.active = true;
        burst.x = leftSide ? 0.16 + variation * 0.025 : 0.84 - variation * 0.025;
        burst.y = 0.18 + ((index * 3) % 5) * 0.052;
        burst.launchY = 0.72;
        burst.startTime = time;
        burst.duration = 0.85 + tension * 0.40;
        burst.radiusFactor = 0.028 + strength * 0.088 + tension * 0.036;
        burst.strength = strength;
        burst.beatLevel = beatLevel;
        burst.particleCount = 6 + Math.round(strength * 10);
        burst.pattern = (beatLevel === 3 || state === 'climax')
            ? ((index % 2 === 0) ? 4 : 1)
            : (index + (state === 'buildup' ? 2 : 0)) % 4;
        burst.color = 14 + (index % 10);
        burst.secondaryColor = 18 + (index % 6);

        if (strength >= 0.50 || tension >= 0.58 || state === 'climax' || beatLevel >= 2) {
            const bat = this.bats[this.batCursor];
            this.batCursor = (this.batCursor + 1) % this.bats.length;
            bat.active = true;
            bat.startTime = time;
            bat.duration = 2.1 + ((index * 7) % 3) * 0.45;
            const spawnLeft = (index & 1) === 0;
            bat.startX = spawnLeft ? 0.28 : 0.72;
            bat.startY = 0.40 + ((index % 3) * 0.04);
            bat.targetX = spawnLeft ? -0.08 : 1.08;
            bat.targetY = 0.10 + ((index * 5) % 5) * 0.05;
            bat.flapSpeed = 10 + Math.round(strength * 6);
        }
    }

    drawFireworks(ctx, width, height, horizon, time) {
        const minDim = Math.min(width, height);
        if (minDim <= 0 || horizon <= 0) return;

        for (let i = 0; i < this.bursts.length; i++) {
            const burst = this.bursts[i];
            if (!burst.active) continue;

            const age = time - burst.startTime;
            if (!Number.isFinite(age) || age < 0 || age >= burst.duration) {
                burst.active = false;
                continue;
            }

            const progress = age / burst.duration;
            const rawRadius = minDim * burst.radiusFactor * (0.24 + progress * 0.76);
            const radius = Math.max(1, Math.floor(Math.min(
                rawRadius,
                Math.max(1, width * 0.16),
                Math.max(1, horizon * 0.17)
            )));
            const maxParticleSize = burst.strength > 0.66 ? 3 : burst.strength > 0.33 ? 2 : 1;
            const safeRadius = Math.max(0, Math.min(radius, (width - maxParticleSize) / 2));
            const centerX = clamp(
                Math.floor(burst.x * width),
                Math.ceil(safeRadius + maxParticleSize / 2),
                Math.floor(width - safeRadius - maxParticleSize / 2)
            );
            const centerY = clamp(
                Math.floor(burst.y * height),
                Math.ceil(safeRadius + maxParticleSize / 2),
                Math.floor(Math.min(horizon * 0.63, height - safeRadius - maxParticleSize / 2))
            );

            // Ascending corkscrew rocket trail
            if (progress < 0.24) {
                const rocketProg = progress / 0.24;
                const launchBaseline = Math.floor(horizon * 0.92);
                const curRocketY = clamp(
                    Math.floor(launchBaseline + (centerY - launchBaseline) * rocketProg),
                    0,
                    Math.max(0, horizon - 2)
                );
                const corkscrew = Math.floor(Math.sin(rocketProg * Math.PI * 5 + i) * 2);
                const rx = clamp(centerX + corkscrew, 0, Math.max(0, width - 2));
                this.rect(ctx, width, height, rx, curRocketY, 2, 2, COLOR.white);

                if (curRocketY + 3 < horizon) {
                    this.rect(ctx, width, height, clamp(centerX - corkscrew, 0, Math.max(0, width - 1)), curRocketY + 3, 1, 2, burst.secondaryColor);
                }
                if (curRocketY + 6 < horizon) {
                    const sparkX = clamp(centerX + ((Math.floor(time * 40)) % 3 - 1), 0, Math.max(0, width - 1));
                    this.rect(ctx, width, height, sparkX, curRocketY + 6, 1, 1, COLOR.orange);
                }
            }

            // Subtle Copper horizon flash at detonation
            if (progress >= 0.20 && progress <= 0.28 && burst.strength >= 0.55 && height >= 40) {
                const flashY = clamp(centerY, 0, Math.max(0, horizon - 1));
                this.rect(ctx, width, height, 0, flashY, width, 1, burst.color);
            }

            const fadeColor = progress > 0.68 ? burst.secondaryColor : burst.color;
            const particleSize = progress > 0.77 ? 1 : maxParticleSize;

            for (let particle = 0; particle < burst.particleCount; particle++) {
                const direction = particle % DIRECTIONS_X.length;
                const isOdd = (particle & 1) === 1;
                const rayScale = (burst.pattern === 1 || burst.pattern === 4) && isOdd
                    ? 0.54
                    : (burst.pattern === 0 && isOdd ? 0.74 : 1);

                let dx = DIRECTIONS_X[direction] / 100 * radius * rayScale;
                let dy = DIRECTIONS_Y[direction] / 100 * radius * rayScale;

                if (burst.pattern === 2) {
                    dy += Math.floor(progress * progress * minDim * 0.08);
                } else if (burst.pattern === 3) {
                    const sway = Math.sin(progress * 8 + particle) * minDim * 0.012;
                    dx = (dx + sway) * 0.72;
                    dy += Math.floor(progress * progress * minDim * 0.06);
                } else if (burst.pattern === 4) {
                    dx *= 0.92;
                    dy *= 0.92;
                }

                const px = clamp(Math.floor(centerX + dx), 0, Math.max(0, width - particleSize));
                const py = clamp(Math.floor(centerY + dy), 0, Math.max(0, horizon - particleSize));
                const sparkColor = (burst.pattern === 4 && isOdd) ? COLOR.white : fadeColor;
                this.rect(ctx, width, height, px, py, particleSize, particleSize, sparkColor);

                if ((burst.pattern >= 2 || burst.strength > 0.48) && progress > 0.18) {
                    const trailX = clamp(Math.floor(px - dx * 0.18), 0, Math.max(0, width - 1));
                    const trailY = clamp(Math.floor(py - dy * 0.18), 0, Math.max(0, horizon - 1));
                    this.rect(ctx, width, height, trailX, trailY, 1, 1, burst.secondaryColor);

                    if ((burst.pattern === 2 || burst.pattern === 4) && progress > 0.38) {
                        const cascadeX = clamp(Math.floor(px - dx * 0.36), 0, Math.max(0, width - 1));
                        const cascadeY = clamp(Math.floor(py - dy * 0.36), 0, Math.max(0, horizon - 1));
                        this.rect(ctx, width, height, cascadeX, cascadeY, 1, 1, COLOR.gold);
                    }
                }

                if ((burst.pattern === 4 || burst.beatLevel === 3) && progress > 0.52 && (particle % 3 === 0)) {
                    const subRadius = Math.max(1, Math.floor(radius * 0.14 * ((progress - 0.52) / 0.48)));
                    for (let s = 0; s < 4; s++) {
                        const sx = clamp(Math.floor(px + (SUB_DIRS_X[s] * subRadius) / 100), 0, Math.max(0, width - 1));
                        const sy = clamp(Math.floor(py + (SUB_DIRS_Y[s] * subRadius) / 100), 0, Math.max(0, horizon - 1));
                        this.rect(ctx, width, height, sx, sy, 1, 1, COLOR.white);
                    }
                }
            }

            if (burst.pattern === 1 || burst.pattern === 4 || burst.strength > 0.60) {
                const coreCol = progress < 0.40 ? COLOR.white : burst.secondaryColor;
                const cLeft = clamp(centerX - 1, 0, Math.max(0, width - 3));
                const cTop = clamp(centerY - 1, 0, Math.max(0, horizon - 3));
                this.rect(ctx, width, height, cLeft, clamp(centerY, 0, Math.max(0, horizon - 1)), 3, 1, coreCol);
                this.rect(ctx, width, height, clamp(centerX, 0, Math.max(0, width - 1)), cTop, 1, 3, coreCol);
            }
        }

        // Castle Battlement Sparkler Fountains (strictly above horizon)
        for (let f = 0; f < this.fountains.length; f++) {
            const fountain = this.fountains[f];
            if (!fountain.active) continue;
            const age = time - fountain.startTime;
            if (!Number.isFinite(age) || age < 0 || age >= fountain.duration) {
                fountain.active = false;
                continue;
            }
            const prog = age / fountain.duration;
            const baseX = Math.floor(FOUNTAIN_X_OFFSETS[fountain.slot] * width);
            const baseY = Math.floor(horizon * 0.66);
            const maxRise = Math.max(2, Math.floor(horizon * (0.08 + fountain.level * 0.04)));
            const spread = Math.max(1, Math.floor(width * 0.032));

            for (let p = -2; p <= 2; p++) {
                const jetProg = clamp(prog * 1.2 - Math.abs(p) * 0.08, 0, 1);
                const archY = Math.sin(jetProg * Math.PI) * maxRise;
                const fx = clamp(Math.floor(baseX + p * spread * jetProg), 0, Math.max(0, width - 1));
                const fy = clamp(Math.floor(baseY - archY), 0, Math.max(0, horizon - 1));
                const col = jetProg < 0.45 ? COLOR.white : (jetProg < 0.75 ? fountain.color : fountain.secondaryColor);
                this.rect(ctx, width, height, fx, fy, 1, 1, col);
            }
        }
    }

    // Helper: Jim Sachs / Defender of the Crown 3D Cylindrical Tower with Corbels, Merlons & Conical Slate Roof
    drawCylinderTower(ctx, width, height, castleX, castleY, castleWidth, castleHeight, tx, ty, tw, th, roofH, merlonCount, leftRim, rightRim) {
        // 1. Cylindrical 3D shaded vertical stone strips (Moonlight from left, deep shadow on right)
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, tx, ty, tw * 0.13, th, leftRim);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, tx + tw * 0.13, ty, tw * 0.25, th, COLOR.stoneLight);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, tx + tw * 0.38, ty, tw * 0.28, th, COLOR.stone);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, tx + tw * 0.66, ty, tw * 0.20, th, COLOR.castle);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, tx + tw * 0.86, ty, tw * 0.14, th, rightRim);

        // 2. Horizontal Ashlar masonry courses & stone blocks
        const courseStep = 0.065;
        for (let cy = ty + 0.05; cy < ty + th - 0.03; cy += courseStep) {
            this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, tx + tw * 0.08, cy, tw * 0.82, 0.008, COLOR.castle);
            const stagger = ((Math.floor((cy - ty) * 100)) & 1) === 0 ? 0.16 : 0.32;
            this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, tx + tw * stagger, cy - 0.025, tw * 0.18, 0.015, COLOR.silver);
        }

        // 3. Overhanging Machicolation / Corbelled Parapet Collar
        const overhang = tw * 0.06;
        const pLeft = tx - overhang;
        const pWidth = tw + overhang * 2;
        // Dark shadow under the overhanging corbels
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, pLeft, ty + 0.018, pWidth, 0.018, COLOR.black);
        // Shaded parapet cornice band
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, pLeft, ty, pWidth * 0.45, 0.020, leftRim);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, pLeft + pWidth * 0.45, ty, pWidth * 0.35, 0.020, COLOR.stone);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, pLeft + pWidth * 0.80, ty, pWidth * 0.20, 0.020, rightRim);

        // Individual stone corbel brackets underneath
        const corbelStep = pWidth / (merlonCount * 2);
        for (let c = 0; c < merlonCount * 2; c += 2) {
            const cx = pLeft + (c + 0.3) * corbelStep;
            const cCol = c < merlonCount ? COLOR.stoneLight : COLOR.stone;
            this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, cx, ty + 0.018, corbelStep * 0.8, 0.016, cCol);
        }

        // 4. 3D-shaded Battlement Merlons (Crenellations)
        if (merlonCount > 0) {
            const mSpan = pWidth / merlonCount;
            const mWidth = mSpan * 0.62;
            const mHeight = 0.036;
            for (let m = 0; m < merlonCount; m++) {
                const mx = pLeft + m * mSpan + mSpan * 0.1;
                const mFaceCol = m < merlonCount * 0.45 ? COLOR.stoneLight : (m < merlonCount * 0.75 ? COLOR.stone : COLOR.castle);
                const mEdgeCol = m === 0 ? leftRim : COLOR.silver;
                this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, mx, ty - mHeight, mWidth, mHeight, mFaceCol);
                this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, mx, ty - mHeight, mWidth * 0.28, mHeight, mEdgeCol);
                this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, mx, ty - mHeight, mWidth, 0.007, COLOR.silver);
            }
        }

        // 5. Steep Conical Slate Roof (Scanline-stepped triangle with 3D cylindrical slate shading)
        if (roofH > 0) {
            const steps = 10;
            const roofBaseY = ty - (merlonCount > 0 ? 0.022 : 0);
            const roofLeftSlope = this.lightningTimer > 0 ? COLOR.white : COLOR.blue;
            const roofMidSlope = COLOR.copperBlue;
            const roofRightSlope = this.rightGlow > 0.22 ? this.rightGlowColor : COLOR.deepSky;

            for (let s = 0; s < steps; s++) {
                const t0 = s / steps;
                const t1 = (s + 1) / steps;
                const sliceW = pWidth * (1 - t0 * 0.88);
                const sliceX = pLeft + (pWidth - sliceW) * 0.5;
                const sliceY = roofBaseY - t1 * roofH;
                const sliceH = (roofH / steps) + 0.004;

                this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, sliceX, sliceY, sliceW * 0.26, sliceH, roofLeftSlope);
                this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, sliceX + sliceW * 0.26, sliceY, sliceW * 0.34, sliceH, roofMidSlope);
                this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, sliceX + sliceW * 0.60, sliceY, sliceW * 0.40, sliceH, roofRightSlope);
            }
            // Wrought-iron roof finial spire
            this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, tx + tw * 0.47, roofBaseY - roofH - 0.045, tw * 0.06, 0.048, COLOR.silver);
        }
    }

    // Helper: Recessed Pointed Gothic Window with Stone Jambs, Mullions & Stained/Torchlit Glass
    drawGothicWindow(ctx, width, height, castleX, castleY, castleWidth, castleHeight, wx, wy, ww, wh, glassColor, glowCoreColor) {
        // Deep recessed stone shadow
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, wx - 0.005, wy, ww + 0.010, wh + 0.008, COLOR.black);
        // Moonlit right interior stone jamb & sill
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, wx + ww, wy + wh * 0.2, 0.007, wh * 0.8, COLOR.stoneLight);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, wx - 0.005, wy + wh, ww + 0.012, 0.009, COLOR.silver);

        // Pointed Gothic arch top + main window lancet body
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, wx + ww * 0.20, wy - wh * 0.22, ww * 0.60, wh * 0.24, glassColor);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, wx, wy, ww, wh, glassColor);
        // Inner warm/arcane glow core
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, wx + ww * 0.22, wy + wh * 0.15, ww * 0.56, wh * 0.65, glowCoreColor);

        // Leaded glass central mullion & transom crossbar
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, wx + ww * 0.46, wy - wh * 0.15, ww * 0.08, wh * 1.15, COLOR.castle);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, wx, wy + wh * 0.45, ww, wh * 0.10, COLOR.castle);
    }

    drawCastle(ctx, width, height, baseline, castleX, castleY, castleWidth, castleHeight, time, tension, beatPulse, glowIntensity, glowColor) {
        // Determine directional lighting colors from moon, lightning, and left/right fireworks
        const leftRim = this.lightningTimer > 0
            ? COLOR.white
            : (this.leftGlow > 0.20 ? this.leftGlowColor : COLOR.silver);
        const rightRim = this.lightningTimer > 0
            ? COLOR.silver
            : (this.rightGlow > 0.20 ? this.rightGlowColor : COLOR.farHill);

        // 1. Rear Great Keep (Central Citadel & Cathedral Hall) with 3D cylindrical volume
        this.drawCylinderTower(
            ctx, width, height, castleX, castleY, castleWidth, castleHeight,
            0.33, 0.21, 0.34, 0.77, 0.13, 6, leftRim, rightRim
        );

        // High belfry spire & flapping royal pennant banner
        this.drawCylinderTower(
            ctx, width, height, castleX, castleY, castleWidth, castleHeight,
            0.43, 0.08, 0.14, 0.14, 0.07, 3, leftRim, rightRim
        );
        const flagWave = Math.sin(time * (6 + tension * 10)) > 0 ? 0.008 : -0.006;
        const flagColor = tension > 0.68 ? COLOR.red : (this.currentBeatLevel === 3 ? COLOR.gold : COLOR.magenta);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.50, 0.015, 0.055, 0.022, flagColor);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.555, 0.018 + flagWave, 0.040, 0.015, COLOR.gold);

        // 2. Inner Curtain Walls & Stepped Flying Buttresses
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.12, 0.50, 0.30, 0.48, COLOR.stone);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.12, 0.50, 0.12, 0.48, COLOR.stoneLight);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.58, 0.50, 0.30, 0.48, COLOR.castle);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.80, 0.50, 0.08, 0.48, rightRim);

        // Curtain wall crenellations & parapet walk
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.10, 0.49, 0.80, 0.018, COLOR.silver);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.10, 0.508, 0.80, 0.015, COLOR.black);
        for (let i = 0; i < 11; i++) {
            const mx = 0.11 + i * 0.072;
            const mCol = i < 5 ? COLOR.stoneLight : COLOR.stone;
            this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, mx, 0.462, 0.042, 0.030, mCol);
        }

        // 3. Outer Flanking Bastion Towers (Anchored into the cliffside)
        this.drawCylinderTower(
            ctx, width, height, castleX, castleY, castleWidth, castleHeight,
            0.05, 0.47, 0.12, 0.51, 0.10, 3, leftRim, rightRim
        );
        this.drawCylinderTower(
            ctx, width, height, castleX, castleY, castleWidth, castleHeight,
            0.83, 0.47, 0.12, 0.51, 0.10, 3, leftRim, rightRim
        );

        // 4. Tall Left & Right Watchtowers (Jim Sachs style round drum towers with conical roofs)
        this.drawCylinderTower(
            ctx, width, height, castleX, castleY, castleWidth, castleHeight,
            0.16, 0.33, 0.18, 0.65, 0.12, 4, leftRim, rightRim
        );
        this.drawCylinderTower(
            ctx, width, height, castleX, castleY, castleWidth, castleHeight,
            0.66, 0.33, 0.18, 0.65, 0.12, 4, leftRim, rightRim
        );

        // 5. Cathedral Rose Window & Lancet Windows in Great Keep
        const roseOuter = beatPulse > 0.45
            ? (tension > 0.65 ? COLOR.gold : COLOR.cyan)
            : (tension > 0.65 ? COLOR.magenta : COLOR.blue);
        const roseCore = this.heavyPulse > 0.35
            ? COLOR.white
            : (this.medPulse > 0.3 ? COLOR.gold : COLOR.cyan);

        // Sculpted Rose Window with stone tracery spokes
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.445, 0.27, 0.11, 0.11, COLOR.black);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.455, 0.28, 0.09, 0.09, roseOuter);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.475, 0.30, 0.05, 0.05, roseCore);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.495, 0.27, 0.01, 0.11, COLOR.castle);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.445, 0.32, 0.11, 0.01, COLOR.castle);

        // Great Hall Lancet Windows
        this.drawGothicWindow(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.38, 0.43, 0.045, 0.11, roseOuter, roseCore);
        this.drawGothicWindow(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.478, 0.42, 0.045, 0.12, roseOuter, roseCore);
        this.drawGothicWindow(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.575, 0.43, 0.045, 0.11, roseOuter, roseCore);

        // 6. Watchtower & Bastion Torch-lit Gothic Windows
        for (let row = 0; row < 3; row++) {
            const wy = 0.44 + row * 0.15;
            const flicker = Math.sin(time * 8.5 + row * 2.1) > 0.1;
            const glassCol = flicker ? COLOR.orange : COLOR.rust;
            const coreCol = beatPulse > 0.5 ? COLOR.white : (flicker ? COLOR.gold : COLOR.orange);

            // Left & Right Watchtower windows
            this.drawGothicWindow(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.225, wy, 0.042, 0.085, glassCol, coreCol);
            this.drawGothicWindow(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.730, wy, 0.042, 0.085, glassCol, coreCol);
        }
        // Outer bastion arrow slits
        this.drawGothicWindow(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.095, 0.58, 0.025, 0.075, COLOR.rust, COLOR.gold);
        this.drawGothicWindow(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.875, 0.58, 0.025, 0.075, COLOR.rust, COLOR.gold);

        // 7. Foreground Twin-Towered Gatehouse & Barbican (Signature Defender of the Crown feature)
        this.drawCylinderTower(
            ctx, width, height, castleX, castleY, castleWidth, castleHeight,
            0.35, 0.60, 0.10, 0.39, 0, 3, leftRim, rightRim
        );
        this.drawCylinderTower(
            ctx, width, height, castleX, castleY, castleWidth, castleHeight,
            0.55, 0.60, 0.10, 0.39, 0, 3, leftRim, rightRim
        );
        // Gatehouse central upper bridgehouse
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.43, 0.62, 0.14, 0.37, COLOR.stone);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.43, 0.60, 0.14, 0.022, COLOR.silver);

        // Recessed Stone Archway & Portcullis Gate
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.445, 0.74, 0.11, 0.25, COLOR.stoneLight);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.455, 0.76, 0.09, 0.23, COLOR.black);
        // Warm interior courtyard firelight glowing through the gate
        const gateGlow = beatPulse > 0.45 ? COLOR.gold : COLOR.orange;
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.465, 0.78, 0.07, 0.21, COLOR.rust);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.475, 0.80, 0.05, 0.19, gateGlow);
        // Iron Portcullis Lattice & Spikes
        for (let gx = 0.468; gx <= 0.528; gx += 0.018) {
            this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, gx, 0.77, 0.006, 0.16, COLOR.castle);
        }
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.462, 0.81, 0.076, 0.012, COLOR.castle);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.462, 0.86, 0.076, 0.012, COLOR.castle);

        // 8. Blazing Tower Braziers on the Gatehouse & Watchtowers
        const flamePulse = beatPulse * 0.024;
        const flameFlicker = Math.sin(time * 12) * 0.006;
        const flameH = Math.max(0.018, 0.038 + flamePulse + flameFlicker);
        const flameCol = this.heavyPulse > 0.35
            ? COLOR.cyan
            : (beatPulse > 0.60 ? COLOR.white : (beatPulse > 0.28 ? COLOR.gold : COLOR.orange));

        const brazierPositions = [0.17, 0.38, 0.60, 0.81];
        for (let b = 0; b < brazierPositions.length; b++) {
            const bx = brazierPositions[b];
            const by = (b === 1 || b === 2) ? 0.57 : 0.30;
            this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, bx, by, 0.022, 0.022, COLOR.castle);
            this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, bx + 0.003, by - flameH, 0.016, flameH, COLOR.orange);
            this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, bx + 0.006, by - flameH * 0.75, 0.010, flameH * 0.75, flameCol);
        }

        // 9. Sculpted Rocky Crag / Cliff Promontory Base under the Castle
        for (let c = 0; c < 9; c++) {
            const cragX = 0.04 + c * 0.102;
            const cragW = 0.115;
            const cragY = 0.93 + ((c * 3) % 3) * 0.012;
            const cragH = 0.08;
            this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, cragX, cragY, cragW * 0.35, cragH, leftRim);
            this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, cragX + cragW * 0.35, cragY, cragW * 0.40, cragH, COLOR.stone);
            this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, cragX + cragW * 0.75, cragY, cragW * 0.25, cragH, COLOR.black);
        }
    }

    drawHills(ctx, width, height, baseline, time, tension) {
        const step = Math.max(1, Math.ceil(width / 380));
        const moatTop = Math.floor(baseline - height * 0.008);
        const moatBottom = Math.min(height, Math.floor(baseline + height * 0.078));

        // 1. Distant Two-Tone Shaded Carpathian / Sherwood Mountain Peaks & Mid-Ground Forested Hills
        for (let x = 0; x < width; x += step) {
            const nx = x / Math.max(1, width);
            const farWave1 = Math.sin(nx * Math.PI * 4 + 0.7);
            const farSlope = Math.cos(nx * Math.PI * 4 + 0.7);
            const farRise = farWave1 * height * 0.042 + Math.sin(nx * Math.PI * 9 + 1.4) * height * 0.016;
            const farY = Math.floor(baseline - height * 0.095 + farRise);

            // Mountain body + directional moonlit slope shading on ascending ridges
            const mtnBodyCol = farSlope > 0.15 ? COLOR.midHill : COLOR.farHill;
            const mtnRidgeCol = this.lightningTimer > 0
                ? COLOR.white
                : (farSlope > 0 ? COLOR.stoneLight : COLOR.stone);
            this.rect(ctx, width, height, x, farY, step, height - farY, mtnBodyCol);
            this.rect(ctx, width, height, x, farY, step, Math.max(2, Math.floor(height * 0.008)), mtnRidgeCol);

            // Mid-ground rolling hills
            const nearRise = Math.sin(nx * Math.PI * 3 + 2.2) * height * 0.038
                + Math.sin(nx * Math.PI * 7 + 0.5) * height * 0.014;
            const nearY = Math.floor(baseline - height * 0.015 + nearRise);
            this.rect(ctx, width, height, x, nearY, step, height - nearY, COLOR.midHill);

            // Lush Deluxe Paint Forest Canopy Silhouette along the hills flanking the castle
            if (nx < 0.26 || nx > 0.74) {
                const treeCluster = Math.abs(Math.sin(nx * 42) * Math.cos(nx * 19));
                const canopyH = Math.max(3, Math.floor(height * (0.018 + treeCluster * 0.032)));
                const treeTop = nearY - canopyH;
                // Dark forest shadow base
                this.rect(ctx, width, height, x, treeTop + 2, step, canopyH, COLOR.black);
                // Mid-tone foliage volume
                this.rect(ctx, width, height, x, treeTop + 1, step, Math.max(2, Math.floor(canopyH * 0.6)), COLOR.castle);
                // Moonlit treetop foliage highlights
                const tipCol = (Math.floor(x / step) & 1) === 0 ? COLOR.copperBlue : COLOR.stone;
                this.rect(ctx, width, height, x, treeTop, step, 2, tipCol);
            }
        }

        // 2. Sculpted Castle Moat with Stone Embankments & BPLCON1 Scanline Water Reflections
        if (moatBottom > moatTop + 2) {
            const moatWidth = Math.floor(width * 0.84);
            const moatLeft = Math.floor((width - moatWidth) / 2);

            // Far stone embankment wall
            this.rect(ctx, width, height, moatLeft, moatTop - 3, moatWidth, 3, COLOR.stone);
            this.rect(ctx, width, height, moatLeft, moatTop - 1, moatWidth, 1, COLOR.black);
            // Deep moat water basin
            this.rect(ctx, width, height, moatLeft, moatTop, moatWidth, moatBottom - moatTop, COLOR.black);

            for (let wy = moatTop; wy < moatBottom; wy++) {
                const depth = (wy - moatTop) / Math.max(1, moatBottom - moatTop);
                const bplShift = Math.floor(Math.sin(wy * 0.85 + time * 7.2) * (1.5 + depth * 3.5));
                const inset = Math.floor((1 - depth) * width * 0.04);
                const rowLeft = moatLeft + inset;
                const rowWidth = moatWidth - inset * 2;

                // Interleaved Copper water gradient
                if ((wy & 1) === 0) {
                    const waterCol = depth < 0.4 ? COLOR.deepSky : (depth < 0.75 ? COLOR.blueSky : COLOR.indigo);
                    this.rect(ctx, width, height, rowLeft, wy, rowWidth, 1, waterCol);
                }

                // Shimmering Moon Reflection Column on left moat
                const moonRefX = Math.floor(width * 0.14 + bplShift);
                const moonRefW = Math.max(2, Math.floor(width * 0.045 * (0.5 + depth * 0.5)));
                const moonRefCol = tension > 0.72 ? COLOR.rust : ((wy & 1) === 0 ? COLOR.silver : COLOR.copperBlue);
                this.rect(ctx, width, height, moonRefX, wy, moonRefW, 1, moonRefCol);

                // Reflected Castle Tower Stonework & Warm Torchlit Windows in the water
                const leftTowerRefX = Math.floor(width * 0.30 + bplShift);
                const rightTowerRefX = Math.floor(width * 0.66 - bplShift);
                this.rect(ctx, width, height, leftTowerRefX, wy, Math.max(2, Math.floor(width * 0.05)), 1, (wy & 1) ? COLOR.castle : COLOR.stone);
                this.rect(ctx, width, height, rightTowerRefX, wy, Math.max(2, Math.floor(width * 0.05)), 1, (wy & 1) ? COLOR.castle : COLOR.stone);

                if ((wy % 3) === 0) {
                    this.rect(ctx, width, height, leftTowerRefX + 2, wy, Math.max(1, Math.floor(width * 0.015)), 1, COLOR.orange);
                    this.rect(ctx, width, height, rightTowerRefX + 2, wy, Math.max(1, Math.floor(width * 0.015)), 1, COLOR.orange);
                }

                // Reflected Gatehouse Golden Torchlight
                const gateRefX = Math.floor(width * 0.47 + bplShift * 0.5);
                this.rect(ctx, width, height, gateRefX, wy, Math.max(2, Math.floor(width * 0.06)), 1, (wy & 1) ? COLOR.gold : COLOR.rust);

                // Active Firework Color Reflections on the water surface
                if (this.leftGlow > 0.15) {
                    const lx = Math.floor(width * 0.24 + bplShift * 1.5);
                    this.rect(ctx, width, height, lx, wy, Math.max(2, Math.floor(width * 0.05)), 1, this.leftGlowColor);
                }
                if (this.rightGlow > 0.15) {
                    const rx = Math.floor(width * 0.72 - bplShift * 1.5);
                    this.rect(ctx, width, height, rx, wy, Math.max(2, Math.floor(width * 0.05)), 1, this.rightGlowColor);
                }
            }
        }

        // 3. Textured Foreground Meadow & Rocky Outcrops (from moat shore to bottom of screen)
        const fgTop = moatBottom;
        if (fgTop < height) {
            this.rect(ctx, width, height, 0, fgTop, width, height - fgTop, COLOR.farHill);
            // Near moat stone embankment & rocky shore
            this.rect(ctx, width, height, 0, fgTop, width, Math.max(2, Math.floor(height * 0.012)), COLOR.stone);
            this.rect(ctx, width, height, 0, fgTop + Math.max(2, Math.floor(height * 0.012)), width, 2, COLOR.black);

            // Dithered Deluxe Paint turf/rock horizontal strata bands
            const bandStep = Math.max(2, Math.floor((height - fgTop) / 14));
            for (let fy = fgTop + 4; fy < height; fy += bandStep) {
                const rel = (fy - fgTop) / Math.max(1, height - fgTop);
                const turfCol = rel < 0.35 ? COLOR.castle : (rel < 0.7 ? COLOR.midHill : COLOR.black);
                this.rect(ctx, width, height, 0, fy, width, Math.max(1, Math.floor(bandStep * 0.55)), turfCol);

                // Moonlit rock outcrops on left & right foreground banks
                const rockW = Math.floor(width * (0.12 + rel * 0.14));
                this.rect(ctx, width, height, Math.floor(width * 0.04), fy, rockW, 2, COLOR.stone);
                this.rect(ctx, width, height, Math.floor(width * 0.96 - rockW), fy, rockW, 2, COLOR.stone);
            }
        }

        // 4. Atmospheric Rolling Mist Drifting over the Moat
        for (let m = 0; m < 2; m++) {
            const mistSpeed = m === 0 ? 0.022 : -0.016;
            const mistY = Math.floor(baseline + height * (0.012 + m * 0.038));
            const mistOffset = Math.floor(time * width * mistSpeed);
            for (let mx = 0; mx < width; mx += 10) {
                const px = ((mx + mistOffset) % width + width) % width;
                const wave = Math.sin(mx * 0.04 + time * 2.2 + m) * 2;
                const mistCol = (m + Math.floor(time)) % 2 === 0 ? COLOR.copperBlue : COLOR.stone;
                this.rect(ctx, width, height, px, Math.floor(mistY + wave), 6, 1, mistCol);
            }
        }
    }

    drawPath(ctx, width, height, time, tension, beatPulse) {
        const startY = Math.floor(height * 0.72);
        const moatEndY = Math.floor(height * 0.798);
        const maxWidth = Math.max(1, Math.floor(Math.min(width * 0.26, height * 0.21)));
        const rowStep = Math.max(1, Math.ceil(height / 240));

        // 1. Stone Bridge Piers & Dark Archways spanning the Moat
        if (moatEndY > startY + 2) {
            const bridgeTopW = Math.max(4, Math.floor(maxWidth * 0.34));
            const bridgeX = Math.floor(width * 0.5 - bridgeTopW * 0.65);
            const bridgeW = Math.floor(bridgeTopW * 1.3);
            const bridgeH = moatEndY - startY;

            // Stone bridge masonry spandrel
            this.rect(ctx, width, height, bridgeX, startY, bridgeW, bridgeH, COLOR.stone);
            this.rect(ctx, width, height, bridgeX, startY, Math.max(2, Math.floor(bridgeW * 0.25)), bridgeH, COLOR.stoneLight);
            // Twin dark bridge arches over the water
            const archW = Math.max(2, Math.floor(bridgeW * 0.26));
            const archH = Math.max(2, Math.floor(bridgeH * 0.65));
            this.rect(ctx, width, height, bridgeX + Math.floor(bridgeW * 0.16), startY + bridgeH - archH, archW, archH, COLOR.black);
            this.rect(ctx, width, height, bridgeX + Math.floor(bridgeW * 0.58), startY + bridgeH - archH, archW, archH, COLOR.black);
        }

        // 2. Winding Cobblestone Causeway with Perspective Stone Courses & Parapet Curbs
        for (let y = Math.max(0, startY); y < height; y += rowStep) {
            const depth = (y - startY) / Math.max(1, height - startY);
            const isBridge = y < moatEndY;
            const sway = Math.sin(depth * Math.PI * 2.1) * maxWidth * 0.20;
            const pathWidth = Math.max(2, Math.floor(maxWidth * (0.24 + depth * 0.76)));
            const center = Math.floor(width * 0.5 + sway);
            const leftEdge = Math.floor(center - pathWidth / 2);
            const curbW = Math.max(1, Math.floor(pathWidth * 0.09));

            // Outer stone parapet / curbstone walls (lit left curb, shadowed right curb)
            this.rect(ctx, width, height, leftEdge - curbW, y, curbW, rowStep, COLOR.silver);
            this.rect(ctx, width, height, leftEdge + pathWidth, y, curbW, rowStep, COLOR.castle);

            // Base cobblestone roadbed
            const courseIdx = Math.floor((y - startY) / (rowStep * 2));
            const baseStoneCol = (courseIdx & 1) === 0 ? COLOR.stone : COLOR.castle;
            this.rect(ctx, width, height, leftEdge, y, pathWidth, rowStep, baseStoneCol);

            // Individual perspective cobblestone blocks across the road width
            if (pathWidth >= 8) {
                const stones = 4;
                const stoneW = Math.floor(pathWidth / stones);
                const stagger = (courseIdx & 1) === 0 ? 0 : Math.floor(stoneW * 0.45);
                for (let s = 0; s < stones; s++) {
                    const sx = leftEdge + s * stoneW + stagger;
                    if (sx + stoneW * 0.7 < leftEdge + pathWidth) {
                        const cobbleCol = s === 0 ? COLOR.stoneLight : (s === stones - 1 ? COLOR.castle : COLOR.stone);
                        this.rect(ctx, width, height, sx, y, Math.max(1, Math.floor(stoneW * 0.72)), rowStep, cobbleCol);
                    }
                }
            }

            // Wooden Drawbridge Planks at the top of the bridge
            if (isBridge && depth < 0.16) {
                const plankCol = (courseIdx & 1) === 0 ? COLOR.rust : COLOR.blood;
                this.rect(ctx, width, height, leftEdge + 1, y, Math.max(1, pathWidth - 2), rowStep, plankCol);
            } else if (pathWidth > 4) {
                // Center cobblestone crown highlight (pulses gold/cyan on heavy beats)
                const crownCol = (this.heavyPulse > 0.38 && (courseIdx % 3 === 0))
                    ? COLOR.cyan
                    : ((tension > 0.70 && (courseIdx % 4 === 0)) ? COLOR.gold : COLOR.stoneLight);
                this.rect(ctx, width, height, center - 1, y, 2, rowStep, crownCol);
            }
        }

        // 3. Wrought-Iron Cresset Torches & Warm Cobblestone Light Pools
        for (let t = 0; t < TORCH_DEPTHS.length; t++) {
            const depth = TORCH_DEPTHS[t];
            const y = Math.floor(startY + depth * (height - startY));
            const sway = Math.sin(depth * Math.PI * 2.1) * maxWidth * 0.20;
            const pathWidth = Math.max(2, Math.floor(maxWidth * (0.24 + depth * 0.76)));
            const primarySide = (t & 1) === 0 ? -1 : 1;

            const sides = tension > 0.52 ? 2 : 1;
            for (let s = 0; s < sides; s++) {
                const side = s === 0 ? primarySide : -primarySide;
                const torchX = Math.floor(width * 0.5 + sway + side * (pathWidth / 2 + 4));
                const postH = Math.max(5, Math.floor(5 + depth * 5));

                // Multi-ring warm torchlight pool cast onto the cobblestones
                const poolX = Math.floor(torchX - side * (4 + depth * 5));
                const poolW = Math.max(3, Math.floor(4 + depth * 6 + beatPulse * 3));
                this.rect(ctx, width, height, poolX - 1, y - 1, poolW + 2, 3, COLOR.wine);
                this.rect(ctx, width, height, poolX, y, poolW, 2, COLOR.rust);
                this.rect(ctx, width, height, poolX + 1, y, Math.max(1, poolW - 2), 1, beatPulse > 0.4 ? COLOR.gold : COLOR.orange);

                // Wrought-iron pillar & cresset basket
                this.rect(ctx, width, height, torchX, y - postH, 2, postH + 2, COLOR.black);
                this.rect(ctx, width, height, torchX, y - postH, 1, postH, COLOR.stone);
                this.rect(ctx, width, height, torchX - 2, y - postH - 2, 6, 2, COLOR.castle);
                this.rect(ctx, width, height, torchX - 1, y - postH - 1, 4, 1, COLOR.stoneLight);

                // Layered 3-tone dancing flame reactive to beatLevel & beatPulse
                const flamePulse = beatPulse * 3.5 + this.heavyPulse * 2.5;
                const flameFlicker = Math.sin(time * 13 + t * 3.5 + s * 2) * 1.5;
                const flameH = Math.max(3, Math.floor(4 + depth * 2 + flamePulse + flameFlicker));
                const outerFlame = this.heavyPulse > 0.4 ? COLOR.magenta : COLOR.orange;
                const innerFlame = this.heavyPulse > 0.4
                    ? COLOR.cyan
                    : (beatPulse > 0.5 ? COLOR.white : COLOR.gold);

                this.rect(ctx, width, height, torchX - 1, y - postH - 2 - flameH, 4, flameH, outerFlame);
                this.rect(ctx, width, height, torchX, y - postH - 1 - Math.floor(flameH * 0.75), 2, Math.max(1, Math.floor(flameH * 0.75)), innerFlame);
                this.rect(ctx, width, height, torchX, y - postH - 3 - flameH, 1, 1, COLOR.white);
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
            return;
        }

        const dt = this.hasRendered ? clamp(time - this.lastT, 0, 0.1) : 0.02;
        this.lastT = time;
        this.hasRendered = true;

        // Exponential decay of beat-level envelopes and atmosphere impulses
        this.beatPulse = Math.max(0, this.beatPulse - dt * 2.8);
        this.softPulse = Math.max(0, this.softPulse - dt * 3.4);
        this.medPulse = Math.max(0, this.medPulse - dt * 2.9);
        this.heavyPulse = Math.max(0, this.heavyPulse - dt * 2.4);
        this.lightningTimer = Math.max(0, this.lightningTimer - dt);

        const fallbackTension = macroTension(state);
        const requestedTension = Number.isFinite(metrics?.tensionPct)
            ? clamp(metrics.tensionPct, 0, 1)
            : fallbackTension;
        this.tension += (requestedTension - this.tension) * Math.min(1, dt * 2.5);
        this.copperPhase += dt * (2.6 + this.tension * 3.8 + this.beatPulse * 2.2);

        const rawBeatCount = Number.isFinite(metrics?.beatCount)
            ? Math.max(0, Math.floor(metrics.beatCount))
            : null;
        const beatStarted = metrics?.beatStarted === true;
        if (beatStarted) {
            const isNewEvent = rawBeatCount === null
                ? !this.lastBeatEvent
                : rawBeatCount !== this.lastBeatCount;
            if (isNewEvent) {
                const beatIndex = rawBeatCount === null ? this.fallbackBeatCount++ : rawBeatCount;
                if (rawBeatCount !== null) this.lastBeatCount = rawBeatCount;

                const rawStrength = Number.isFinite(metrics?.beatStrength)
                    ? clamp(metrics.beatStrength, 0, 1)
                    : metrics?.beatLevel === 3 ? 0.9
                        : metrics?.beatLevel === 2 ? 0.5
                            : metrics?.beatLevel === 1 ? 0.2
                                : Number.isFinite(metrics?.beatImpulse?.[0])
                                    ? clamp(metrics.beatImpulse[0], 0, 1)
                                    : 0.5;

                const beatLevel = (metrics?.beatLevel === 1 || metrics?.beatLevel === 2 || metrics?.beatLevel === 3)
                    ? metrics.beatLevel
                    : (rawStrength >= 0.68 ? 3 : (rawStrength >= 0.35 ? 2 : 1));
                this.currentBeatLevel = beatLevel;

                const stateTension = Math.max(requestedTension, macroTension(state));
                this.spawnBurst(beatIndex, rawStrength, stateTension, state, time, beatLevel);

                if (state !== 'stopping') {
                    this.spawnFountain(beatIndex, beatLevel, stateTension, time);
                    if (beatLevel >= 2 || stateTension > 0.65) {
                        this.spawnComet(beatIndex, time);
                    }
                }

                this.beatPulse = Math.max(this.beatPulse, rawStrength);
                this.softPulse = Math.max(this.softPulse, 0.6 + rawStrength * 0.4);
                if (beatLevel >= 2 || rawStrength >= 0.45) {
                    this.medPulse = Math.max(this.medPulse, 0.85);
                }
                if (beatLevel === 3 || rawStrength >= 0.68) {
                    this.heavyPulse = 1.0;
                }

                if ((rawStrength >= 0.72 && this.tension >= 0.55) ||
                    (beatLevel === 3 && this.tension >= 0.50) ||
                    (state === 'climax' && beatIndex % 3 === 0 && rawStrength >= 0.55)) {
                    this.lightningTimer = 0.22;
                    this.lightningX = ((beatIndex * 73 + 19) % 70 + 15) / 100;
                    this.lightningSeed = beatIndex;
                }
            }
        }
        this.lastBeatEvent = beatStarted;

        const beatImpulse = Number.isFinite(metrics?.beatImpulse?.[0])
            ? clamp(metrics.beatImpulse[0], 0, 1)
            : this.beatPulse;

        // Compute directional firework illumination for 3D cylindrical tower & water reflections
        let maxGlow = 0;
        let glowColor = COLOR.stoneLight;
        this.leftGlow = 0;
        this.rightGlow = 0;

        for (let i = 0; i < this.bursts.length; i++) {
            const burst = this.bursts[i];
            if (!burst.active) continue;
            const age = time - burst.startTime;
            if (age >= 0 && age < burst.duration) {
                const prog = age / burst.duration;
                const glow = Math.max(0, 1 - prog * 2.0) * burst.strength;
                if (glow > maxGlow) {
                    maxGlow = glow;
                    glowColor = burst.color;
                }
                if (burst.x < 0.5 && glow > this.leftGlow) {
                    this.leftGlow = glow;
                    this.leftGlowColor = burst.color;
                } else if (burst.x >= 0.5 && glow > this.rightGlow) {
                    this.rightGlow = glow;
                    this.rightGlowColor = burst.color;
                }
            }
        }

        const horizon = Math.floor(height * 0.72);
        const minDim = Math.min(width, height);
        const castleWidth = Math.max(1, Math.min(width * 0.92, minDim * 0.80));
        const castleHeight = Math.max(1, Math.min(height * 0.50, minDim * 0.84));
        const baseline = Math.floor(height * 0.72);
        const castleX = Math.floor((width - castleWidth) / 2);
        const castleY = Math.floor(baseline - castleHeight);

        // Render painted world & embedded Amiga effects back-to-front
        this.drawSky(ctx, width, height, time, this.tension, beatImpulse);
        this.drawLightning(ctx, width, height);
        this.drawBats(ctx, width, height, time);
        this.drawFireworks(ctx, width, height, horizon, time);
        this.drawCastle(ctx, width, height, baseline, castleX, castleY, castleWidth, castleHeight, time, this.tension, this.beatPulse, maxGlow, glowColor);
        this.drawHills(ctx, width, height, baseline, time, this.tension);
        this.drawPath(ctx, width, height, time, this.tension, this.beatPulse);

        if (state === 'starting' || state === 'stopping') {
            const transitionTime = Number.isFinite(stateTime) ? Math.max(0, stateTime) : 0;
            const visibility = state === 'starting'
                ? clamp(transitionTime / 1.5, 0, 1)
                : clamp(1 - transitionTime / 1.5, 0, 1);
            applyOrderedDitherFade(ctx, width, height, visibility);
        }
    }
}