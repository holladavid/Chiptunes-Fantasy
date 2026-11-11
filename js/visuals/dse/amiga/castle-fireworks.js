// === js/visuals/dse/amiga/castle-fireworks.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: AMIGA CASTLE FIREWORKS (Background DSE)
// Romantic Masterpiece & "Defender of the Crown" (Jim Sachs / Schinkel)
// inspired castle landscape composed along the Golden Ratio (Phi = 0.618):
// - Asymmetrical Grand Citadel on a craggy rock promontory with soaring
//   east Donjon, west watchtower, and high stone viaduct arch over a gorge.
// - Organic, winding Highland Loch (lake) with natural bays, rocky headlands,
//   pine-clad peninsulas, and real-time BPLCON1 water reflections.
// - Multi-arch stone causeway & S-curve cobblestone road in the foreground.
// - Full musical synchronization: beatLevel (1=soft, 2=medium, 3=hard),
//   beatStrength, and tensionPct drive Blitter fireworks, directional
//   tower rim-lighting, battlement spark fountains, stained-glass rose
//   windows, horizon aurora waves, swooping bats, and forked lightning.
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
    [0.04, 0.09], [0.11, 0.28], [0.18, 0.07], [0.27, 0.14],
    [0.33, 0.26], [0.41, 0.08], [0.47, 0.21], [0.53, 0.06],
    [0.61, 0.15], [0.68, 0.09], [0.74, 0.24], [0.81, 0.11],
    [0.87, 0.29], [0.93, 0.14], [0.97, 0.25], [0.07, 0.41],
    [0.15, 0.36], [0.38, 0.35], [0.66, 0.33], [0.79, 0.38],
    [0.89, 0.42], [0.95, 0.36]
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

// Clean circular 16-row Moon disc [startX, endX] (Symmetric circle, no jagged teeth!)
const MOON_DISC_16 = [
    [5, 10],
    [3, 12],
    [2, 13],
    [1, 14],
    [1, 14],
    [0, 15],
    [0, 15],
    [0, 15],
    [0, 15],
    [0, 15],
    [0, 15],
    [1, 14],
    [1, 14],
    [2, 13],
    [3, 12],
    [5, 10]
];

const SKY_BAND_EDGES = [0, 0.13, 0.28, 0.43, 0.56, 0.67, 0.77, 1];
const SKY_BAND_COLORS = [
    COLOR.black, COLOR.deepSky, COLOR.blueSky, COLOR.indigo,
    COLOR.purple, COLOR.horizon, COLOR.wine
];

// Battlement fountain launch positions matching the asymmetrical Golden Ratio towers
const FOUNTAIN_X_OFFSETS = [0.24, 0.44, 0.58, 0.75];
const TORCH_DEPTHS = [0.18, 0.44, 0.72, 0.92];

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
        const ditherSpan = clamp(Math.floor(height / 42), 1, 9);
        for (let i = 0; i < SKY_BAND_COLORS.length; i++) {
            const edgeOffset = i >= 4 ? tension * 0.035 : 0;
            const top = Math.floor(height * Math.min(1, SKY_BAND_EDGES[i] + edgeOffset));
            const nextEdge = i === SKY_BAND_COLORS.length - 1
                ? 1
                : Math.min(1, SKY_BAND_EDGES[i + 1] + (i + 1 >= 4 ? tension * 0.035 : 0));
            const bottom = Math.floor(height * nextEdge);
            if (bottom > top) {
                this.rect(ctx, width, height, 0, top, width, bottom - top, SKY_BAND_COLORS[i]);

                if (i < SKY_BAND_COLORS.length - 1 && height >= 48) {
                    const nextColor = SKY_BAND_COLORS[i + 1];
                    const seamStart = Math.max(top, bottom - ditherSpan);
                    for (let sy = seamStart; sy < bottom; sy++) {
                        if ((sy & 1) === 1) {
                            this.rect(ctx, width, height, 0, sy, width, 1, nextColor);
                        }
                    }
                }
            }
        }

        // 2. Organic Undulating Horizon Aurora / Twilight Glow (replaces harsh straight ruler lines!)
        const auroraBaseY = Math.floor(height * (0.54 + tension * 0.03));
        const phase = this.copperPhase || (time * 2.5);
        const colOuter = tension > 0.68 ? COLOR.blood : COLOR.purple;
        const colMid = this.heavyPulse > 0.4
            ? COLOR.gold
            : (tension > 0.65 ? COLOR.rust : COLOR.horizon);
        const colCore = this.heavyPulse > 0.4
            ? COLOR.white
            : (beatImpulse > 0.42 ? (tension > 0.65 ? COLOR.orange : COLOR.cyan) : COLOR.wine);

        if (width < 48 || height < 48) {
            this.rect(ctx, width, height, 0, auroraBaseY, width, 1, colCore);
        } else {
            const segW = Math.max(4, Math.ceil(width / 48));
            const waveScale = Math.max(2, Math.floor(height * (0.014 + beatImpulse * 0.012)));
            for (let ax = 0; ax < width; ax += segW) {
                const nx = ax / width;
                const yOff = Math.floor(
                    Math.sin(nx * Math.PI * 3.5 + phase) * waveScale +
                    Math.cos(nx * Math.PI * 6.0 - phase * 0.7) * (waveScale * 0.45)
                );
                const ay = auroraBaseY + yOff;
                this.rect(ctx, width, height, ax, ay - 2, segW, 5, colOuter);
                this.rect(ctx, width, height, ax, ay - 1, segW, 3, colMid);
                if (beatImpulse > 0.25 || tension > 0.55 || (Math.floor(ax / segW) & 1) === 0) {
                    this.rect(ctx, width, height, ax, ay, segW, 1, colCore);
                }
            }
        }

        // 3. Twinkling stars with beat-level cross-glints
        const twinkle = Math.floor(time * (1.8 + tension * 2.2));
        for (let i = 0; i < STAR_POSITIONS.length; i++) {
            const x = Math.floor(STAR_POSITIONS[i][0] * width);
            const y = Math.floor(STAR_POSITIONS[i][1] * height * 0.60);
            const isGlintStar = (i + twinkle) % 5 === 0;

            if (isGlintStar && (beatImpulse > 0.22 || this.softPulse > 0.30)) {
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
        // Sweeping nocturnal stratus & cumulus cloud banks
        this.drawCloud(ctx, width, height, time, 0.14, 0.22, 0.007 + tension * 0.004, COLOR.cloud);
        this.drawCloud(ctx, width, height, time, 0.48, 0.15, 0.011 + tension * 0.006, COLOR.cloud);
        this.drawCloud(ctx, width, height, time, 0.78, 0.28, -0.009 - tension * 0.005, COLOR.cloudLight);
    }

    drawMoon(ctx, width, height, tension) {
        const minDim = Math.min(width, height);
        if (minDim < 8) return;

        // Fallback for very small test canvases
        if (minDim < 64) {
            const unit = clamp(Math.floor(minDim / 55), 1, 7);
            if (width < unit * 8 || height < unit * 8) return;
            const x = clamp(Math.floor(width * 0.16), 0, width - unit * 8);
            const y = clamp(Math.floor(height * 0.12), 0, height - unit * 8);
            const moonColor = tension > 0.72 ? COLOR.orange : COLOR.moon;
            for (let row = 0; row < MOON_ROWS.length; row++) {
                const [start, end] = MOON_ROWS[row];
                this.rect(ctx, width, height, x + start * unit, y + row * unit, (end - start + 1) * unit, unit, moonColor);
            }
            return;
        }

        // Clean, Luminous Spherical Moon positioned near the Left Golden Section (x ~ 0.18)
        const unit = clamp(Math.floor(minDim / 100), 1, 4);
        const moonSize = unit * 16;
        if (width < moonSize || height < moonSize) return;
        const x = clamp(Math.floor(width * 0.17), 0, width - moonSize);
        const y = clamp(Math.floor(height * 0.10), 0, height - moonSize);

        const isBloodMoon = tension > 0.74;
        const litCrescentCol = isBloodMoon ? COLOR.gold : COLOR.white;
        const mainOrbCol = isBloodMoon ? COLOR.orange : COLOR.moon;
        const midShadeCol = isBloodMoon ? COLOR.rust : COLOR.silver;
        const mariaSeaCol = isBloodMoon ? COLOR.blood : COLOR.cloudLight;

        // Smooth circular moon disc without spiky outer halo teeth
        for (let r = 0; r < MOON_DISC_16.length; r++) {
            const [start, end] = MOON_DISC_16[r];
            const span = end - start + 1;
            const rowY = y + r * unit;

            // 1. Main warm lunar disc
            this.rect(ctx, width, height, x + start * unit, rowY, span * unit, unit, mainOrbCol);

            // 2. Bright left crescent edge
            const crescentW = Math.max(1, Math.floor(span * 0.24));
            this.rect(ctx, width, height, x + start * unit, rowY, crescentW * unit, unit, litCrescentCol);

            // 3. Soft spherical shading on right limb
            const rightShadeW = Math.max(1, Math.floor(span * 0.25));
            this.rect(ctx, width, height, x + (end - rightShadeW + 1) * unit, rowY, rightShadeW * unit, unit, midShadeCol);

            // 4. Subtle, natural Lunar Maria (sea patches) on upper-right and mid-left
            if (r >= 3 && r <= 6) {
                this.rect(ctx, width, height, x + (start + Math.floor(span * 0.45)) * unit, rowY, Math.max(1, Math.floor(span * 0.28)) * unit, unit, mariaSeaCol);
            } else if (r >= 8 && r <= 11) {
                this.rect(ctx, width, height, x + (start + Math.floor(span * 0.30)) * unit, rowY, Math.max(1, Math.floor(span * 0.22)) * unit, unit, mariaSeaCol);
            }
        }
    }

    drawCloud(ctx, width, height, time, baseX, baseY, speed, color) {
        const minDim = Math.min(width, height);
        if (minDim < 12) return;
        const unit = clamp(Math.floor(minDim / 130), 1, 4);
        const cloudWidth = unit * 28;
        if (cloudWidth >= width) return;

        const travel = width + cloudWidth;
        const offset = time * minDim * speed;
        const x = ((baseX * width + offset + cloudWidth) % travel + travel) % travel - cloudWidth;
        const y = Math.floor(baseY * height);

        let rimColor = COLOR.silver;
        let midCol = COLOR.cloudLight;
        if (this.lightningTimer > 0.08) {
            rimColor = COLOR.white;
            midCol = COLOR.cyan;
        } else if (baseX < 0.5 && this.leftGlow > 0.22) {
            rimColor = this.leftGlowColor;
        } else if (baseX >= 0.5 && this.rightGlow > 0.22) {
            rimColor = this.rightGlowColor;
        }

        // Sleek, tapered Romantic night-sky cloud bank with trailing wisps (no blocky pyramid steps!)
        this.rect(ctx, width, height, x + unit * 9, y - unit * 3, unit * 8, unit, rimColor);
        this.rect(ctx, width, height, x + unit * 6, y - unit * 2, unit * 14, unit, midCol);
        this.rect(ctx, width, height, x + unit * 3, y - unit, unit * 20, unit, color);
        this.rect(ctx, width, height, x, y, unit * 26, unit, color);
        this.rect(ctx, width, height, x + unit * 2, y + unit, unit * 23, unit, COLOR.indigo);
        // Delicate trailing wind-blown wisps on left and right
        this.rect(ctx, width, height, x - unit * 2, y, unit * 3, Math.max(1, Math.floor(unit * 0.6)), COLOR.cloud);
        this.rect(ctx, width, height, x + unit * 25, y - unit, unit * 4, Math.max(1, Math.floor(unit * 0.6)), midCol);
    }

    drawLightning(ctx, width, height) {
        if (this.lightningTimer <= 0) return;
        const flashIntensity = this.lightningTimer / 0.22;

        const cloudY = Math.floor(height * 0.18);
        this.rect(ctx, width, height, 0, cloudY, width, 2, flashIntensity > 0.5 ? COLOR.white : COLOR.silver);

        const startX = Math.floor(this.lightningX * width);
        const startY = Math.floor(height * 0.09);
        const endY = Math.floor(height * 0.52);
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
        comet.startY = 0.05 + ((index * 5) % 16) / 100;
        comet.dx = fromLeft ? 0.22 : -0.22;
        comet.dy = 0.09 + ((index % 3) * 0.03);
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
        burst.x = leftSide ? 0.14 + variation * 0.03 : 0.86 - variation * 0.03;
        burst.y = 0.16 + ((index * 3) % 5) * 0.052;
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
            bat.startY = 0.38 + ((index % 3) * 0.04);
            bat.targetX = spawnLeft ? -0.08 : 1.08;
            bat.targetY = 0.09 + ((index * 5) % 5) * 0.05;
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
                const launchBaseline = Math.floor(horizon * 0.90);
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
            const baseY = Math.floor(horizon * 0.62);
            const maxRise = Math.max(2, Math.floor(horizon * (0.08 + fountain.level * 0.04)));
            const spread = Math.max(1, Math.floor(width * 0.028));

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

    // Helper: Fine Deluxe Paint 3D Cylindrical Tower with Subtle Masonry, Corbels & Steep Conical Spire
    drawCylinderTower(ctx, width, height, castleX, castleY, castleWidth, castleHeight, tx, ty, tw, th, roofH, merlonCount, leftRim, rightRim) {
        // 1. Smooth 5-zone cylindrical shading (no giant white Lego bricks!)
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, tx, ty, tw * 0.09, th, leftRim);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, tx + tw * 0.09, ty, tw * 0.24, th, COLOR.stoneLight);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, tx + tw * 0.33, ty, tw * 0.31, th, COLOR.stone);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, tx + tw * 0.64, ty, tw * 0.22, th, COLOR.castle);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, tx + tw * 0.86, ty, tw * 0.14, th, rightRim);

        // 2. Fine, subtle masonry texture lines (gives monumental scale!)
        const courseStep = 0.055;
        for (let cy = ty + 0.04; cy < ty + th - 0.02; cy += courseStep) {
            this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, tx + tw * 0.10, cy, tw * 0.76, 0.005, COLOR.castle);
            const stagger = ((Math.floor((cy - ty) * 100)) & 1) === 0 ? 0.18 : 0.42;
            this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, tx + tw * stagger, cy - 0.015, tw * 0.12, 0.006, COLOR.stoneLight);
        }

        // 3. Overhanging Corbelled Parapet Collar
        const overhang = tw * 0.05;
        const pLeft = tx - overhang;
        const pWidth = tw + overhang * 2;
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, pLeft, ty + 0.014, pWidth, 0.014, COLOR.black);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, pLeft, ty, pWidth * 0.38, 0.015, leftRim);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, pLeft + pWidth * 0.38, ty, pWidth * 0.40, 0.015, COLOR.stone);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, pLeft + pWidth * 0.78, ty, pWidth * 0.22, 0.015, rightRim);

        // 4. Fine Crenellations (Merlons)
        if (merlonCount > 0) {
            const mSpan = pWidth / merlonCount;
            const mWidth = mSpan * 0.58;
            const mHeight = 0.024;
            for (let m = 0; m < merlonCount; m++) {
                const mx = pLeft + m * mSpan + mSpan * 0.12;
                const mCol = m < merlonCount * 0.45 ? COLOR.stoneLight : (m < merlonCount * 0.75 ? COLOR.stone : COLOR.castle);
                this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, mx, ty - mHeight, mWidth, mHeight, mCol);
                this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, mx, ty - mHeight, mWidth * 0.30, mHeight, leftRim);
            }
        }

        // 5. Steep Conical Gothic Slate Spire (12-step tapered cone)
        if (roofH > 0) {
            const steps = 12;
            const roofBaseY = ty - (merlonCount > 0 ? 0.016 : 0);
            const roofLeftCol = this.lightningTimer > 0 ? COLOR.white : COLOR.blue;
            const roofMidCol = COLOR.copperBlue;
            const roofRightCol = this.rightGlow > 0.22 ? this.rightGlowColor : COLOR.deepSky;

            for (let s = 0; s < steps; s++) {
                const t0 = s / steps;
                const t1 = (s + 1) / steps;
                const sliceW = pWidth * Math.pow(1 - t0, 0.88);
                const sliceX = pLeft + (pWidth - sliceW) * 0.5;
                const sliceY = roofBaseY - t1 * roofH;
                const sliceH = (roofH / steps) + 0.004;

                this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, sliceX, sliceY, sliceW * 0.26, sliceH, roofLeftCol);
                this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, sliceX + sliceW * 0.26, sliceY, sliceW * 0.34, sliceH, roofMidCol);
                this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, sliceX + sliceW * 0.60, sliceY, sliceW * 0.40, sliceH, roofRightCol);
            }
            // Delicate tall finial needle
            this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, tx + tw * 0.48, roofBaseY - roofH - 0.055, tw * 0.04, 0.058, COLOR.silver);
        }
    }

    // Helper: Slender Monumental Lancet Window (makes the castle look colossal!)
    drawSlenderWindow(ctx, width, height, castleX, castleY, castleWidth, castleHeight, wx, wy, ww, wh, outerGlow, coreGlow) {
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, wx - 0.003, wy - 0.006, ww + 0.006, wh + 0.010, COLOR.black);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, wx + ww, wy, 0.004, wh, COLOR.stoneLight);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, wx + ww * 0.2, wy - 0.008, ww * 0.6, 0.010, outerGlow);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, wx, wy, ww, wh, outerGlow);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, wx + ww * 0.25, wy + wh * 0.15, ww * 0.5, wh * 0.70, coreGlow);
    }

    drawCastle(ctx, width, height, baseline, castleX, castleY, castleWidth, castleHeight, time, tension, beatPulse, glowIntensity, glowColor) {
        // 0. Distant Misty Mountain Range drawn BEHIND the castle (so hills never bury the castle!)
        const mtnStep = Math.max(2, Math.ceil(width / 220));
        for (let x = 0; x < width; x += mtnStep) {
            const nx = x / Math.max(1, width);
            const farWave = Math.sin(nx * Math.PI * 3.2 + 0.4) * height * 0.055
                + Math.cos(nx * Math.PI * 7.5 + 1.1) * height * 0.022;
            const farSlope = Math.cos(nx * Math.PI * 3.2 + 0.4);
            const farY = Math.floor(baseline - height * 0.11 + farWave);
            const mtnCol = farSlope > 0.1 ? COLOR.midHill : COLOR.farHill;
            const ridgeCol = this.lightningTimer > 0 ? COLOR.white : (farSlope > 0 ? COLOR.stone : COLOR.castle);
            this.rect(ctx, width, height, x, farY, mtnStep, baseline - farY + 4, mtnCol);
            this.rect(ctx, width, height, x, farY, mtnStep, 2, ridgeCol);
        }

        const leftRim = this.lightningTimer > 0
            ? COLOR.white
            : (this.leftGlow > 0.20 ? this.leftGlowColor : COLOR.silver);
        const rightRim = this.lightningTimer > 0
            ? COLOR.silver
            : (this.rightGlow > 0.20 ? this.rightGlowColor : COLOR.farHill);

        // =========================================================================
        // 1. DRAMATIC ROCKY CLIFF PROMONTORY (Castle sits HIGH atop this rock crag!)
        // =========================================================================
        const cliffTopY = 0.72;
        const cliffH = 0.30;
        // Sculpted multi-faceted cliff face with moonlit western crags and shadowed eastern fissures
        const cragFacets = [
            [0.08, 0.78, 0.12, 0.22],
            [0.16, 0.72, 0.16, 0.28],
            [0.29, 0.74, 0.14, 0.26],
            [0.40, 0.75, 0.18, 0.25],
            [0.54, 0.68, 0.20, 0.32],
            [0.71, 0.73, 0.15, 0.27],
            [0.82, 0.79, 0.11, 0.21]
        ];
        for (let f = 0; f < cragFacets.length; f++) {
            const [cx, cy, cw, ch] = cragFacets[f];
            // Deep cliff shadow core
            this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, cx, cy, cw, ch, COLOR.black);
            // Lit left rock ledge
            this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, cx, cy, cw * 0.28, ch * 0.85, COLOR.stoneLight);
            // Mid-tone rock face
            this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, cx + cw * 0.28, cy + 0.01, cw * 0.38, ch * 0.85, COLOR.stone);
            // Dark rock strata & crevices
            this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, cx + cw * 0.66, cy + 0.02, cw * 0.24, ch * 0.85, COLOR.castle);
            // Craggy diagonal ledge highlights
            this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, cx + 0.01, cy, cw * 0.65, 0.015, leftRim);
            this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, cx + 0.02, cy + ch * 0.42, cw * 0.55, 0.012, COLOR.stoneLight);
        }

        // =========================================================================
        // 2. GOLDEN RATIO ASYMMETRICAL CASTLE SILHOUETTE (Schinkel / Neuschwanstein)
        // =========================================================================

        // A. High Gothic Flying Viaduct Arch spanning the chasm between West Watchtower & Central Palas
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.26, 0.50, 0.14, 0.09, COLOR.stone);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.26, 0.49, 0.14, 0.014, leftRim);
        // Open Gothic chasm arch under the viaduct bridge (shows night sky / mountain behind!)
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.285, 0.535, 0.085, 0.19, COLOR.indigo);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.295, 0.525, 0.065, 0.02, COLOR.indigo);

        // B. Western Wizard Watchtower (Golden Ratio Left Axis: x ~ 0.17..0.28)
        this.drawCylinderTower(
            ctx, width, height, castleX, castleY, castleWidth, castleHeight,
            0.17, 0.34, 0.11, 0.39, 0.15, 4, leftRim, rightRim
        );
        // Outer Western Cliff Bastion
        this.drawCylinderTower(
            ctx, width, height, castleX, castleY, castleWidth, castleHeight,
            0.10, 0.52, 0.08, 0.27, 0.08, 3, leftRim, rightRim
        );

        // C. Central Great Hall / Palas & Cathedral Nave (x: 0.36..0.58)
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.36, 0.38, 0.22, 0.36, COLOR.stone);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.36, 0.38, 0.07, 0.36, COLOR.stoneLight);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.51, 0.38, 0.07, 0.36, COLOR.castle);
        // Steep Palas Pitched Slate Roof
        for (let r = 0; r < 8; r++) {
            const ry = 0.38 - (r + 1) * 0.012;
            const rw = 0.22 - r * 0.012;
            this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.36 + r * 0.006, ry, rw * 0.6, 0.014, COLOR.copperBlue);
            this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.36 + r * 0.006 + rw * 0.6, ry, rw * 0.4, 0.014, COLOR.deepSky);
        }
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.37, 0.282, 0.18, 0.008, COLOR.silver);

        // D. SOARING GRAND DONJON / KEEP on the Right Golden Ratio Axis (x ~ 0.55..0.73)
        this.drawCylinderTower(
            ctx, width, height, castleX, castleY, castleWidth, castleHeight,
            0.54, 0.20, 0.19, 0.52, 0.14, 6, leftRim, rightRim
        );
        // Upper Crown Spire of the Grand Donjon (soaring to y = 0.02!)
        this.drawCylinderTower(
            ctx, width, height, castleX, castleY, castleWidth, castleHeight,
            0.585, 0.09, 0.10, 0.12, 0.11, 4, leftRim, rightRim
        );
        // Slender overhanging Bartizan (corner turret) on the Grand Donjon
        this.drawCylinderTower(
            ctx, width, height, castleX, castleY, castleWidth, castleHeight,
            0.515, 0.25, 0.05, 0.20, 0.07, 2, leftRim, rightRim
        );

        // Delicate swallowtail royal pennant on the highest spire
        const flagWave = Math.sin(time * (6 + tension * 10)) * 0.006;
        const flagCol = tension > 0.68 ? COLOR.red : (this.currentBeatLevel === 3 ? COLOR.gold : COLOR.cyan);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.638, 0.002, 0.032, 0.012, flagCol);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.670, 0.004 + flagWave, 0.022, 0.008, COLOR.gold);

        // E. Eastern Flanking Watchtower & Curtain Wall (x: 0.72..0.88)
        this.drawCylinderTower(
            ctx, width, height, castleX, castleY, castleWidth, castleHeight,
            0.72, 0.39, 0.11, 0.35, 0.12, 4, leftRim, rightRim
        );
        this.drawCylinderTower(
            ctx, width, height, castleX, castleY, castleWidth, castleHeight,
            0.81, 0.53, 0.08, 0.26, 0.08, 3, leftRim, rightRim
        );

        // =========================================================================
        // 3. MONUMENTAL WINDOWS, CATHEDRAL ROSE & FOREGROUND BARBICAN GATEHOUSE
        // =========================================================================
        const roseOuter = beatPulse > 0.45
            ? (tension > 0.65 ? COLOR.gold : COLOR.cyan)
            : (tension > 0.65 ? COLOR.magenta : COLOR.blue);
        const roseCore = this.heavyPulse > 0.35
            ? COLOR.white
            : (this.medPulse > 0.3 ? COLOR.gold : COLOR.cyan);

        // Grand Donjon Cathedral Rose Window & Tall Gothic Tracery Lancets
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.605, 0.24, 0.06, 0.06, COLOR.black);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.612, 0.247, 0.046, 0.046, roseOuter);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.623, 0.258, 0.024, 0.024, roseCore);
        // Three slender Cathedral Lancets below the Rose Window
        this.drawSlenderWindow(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.585, 0.34, 0.018, 0.085, roseOuter, roseCore);
        this.drawSlenderWindow(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.625, 0.33, 0.020, 0.095, roseOuter, roseCore);
        this.drawSlenderWindow(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.668, 0.34, 0.018, 0.085, roseOuter, roseCore);

        // Great Hall Arcade of Warm Candlelit Windows (5 slender arched windows)
        for (let w = 0; w < 4; w++) {
            const wx = 0.385 + w * 0.036;
            const flicker = Math.sin(time * 8 + w * 1.7) > 0.05;
            const wOuter = flicker ? COLOR.orange : COLOR.rust;
            const wCore = beatPulse > 0.5 ? COLOR.white : (flicker ? COLOR.gold : COLOR.orange);
            this.drawSlenderWindow(ctx, width, height, castleX, castleY, castleWidth, castleHeight, wx, 0.43, 0.016, 0.065, wOuter, wCore);
        }

        // West & East Watchtower vertical tiers of slender windows
        for (let tier = 0; tier < 3; tier++) {
            const wy = 0.40 + tier * 0.095;
            const flicker = Math.sin(time * 9 + tier * 2.3) > 0.1;
            const wOuter = flicker ? COLOR.orange : COLOR.rust;
            const wCore = beatPulse > 0.5 ? COLOR.white : COLOR.gold;
            this.drawSlenderWindow(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.215, wy, 0.016, 0.055, wOuter, wCore);
            this.drawSlenderWindow(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.765, wy + 0.04, 0.016, 0.055, wOuter, wCore);
        }
        // Bastion arrow slits
        this.drawSlenderWindow(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.132, 0.58, 0.012, 0.045, COLOR.rust, COLOR.gold);
        this.drawSlenderWindow(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.842, 0.59, 0.012, 0.045, COLOR.rust, COLOR.gold);

        // Foreground Twin-Drum Gatehouse Barbican (positioned at x: 0.39..0.55 above the viaduct bridge)
        this.drawCylinderTower(
            ctx, width, height, castleX, castleY, castleWidth, castleHeight,
            0.39, 0.55, 0.065, 0.22, 0, 3, leftRim, rightRim
        );
        this.drawCylinderTower(
            ctx, width, height, castleX, castleY, castleWidth, castleHeight,
            0.505, 0.55, 0.065, 0.22, 0, 3, leftRim, rightRim
        );
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.445, 0.56, 0.07, 0.21, COLOR.stone);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.445, 0.55, 0.07, 0.014, leftRim);

        // Recessed Gothic Gatehouse Archway & Warm Courtyard Firelight
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.455, 0.64, 0.050, 0.13, COLOR.black);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.460, 0.65, 0.040, 0.12, COLOR.rust);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.466, 0.66, 0.028, 0.11, beatPulse > 0.4 ? COLOR.gold : COLOR.orange);
        // Fine iron portcullis grate
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.474, 0.65, 0.004, 0.09, COLOR.castle);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.484, 0.65, 0.004, 0.09, COLOR.castle);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.460, 0.68, 0.040, 0.008, COLOR.castle);

        // Delicate Tapered Beacon Flames on the Barbican & Watchtowers
        const flameBoost = beatPulse * 0.016;
        const flameH = 0.022 + flameBoost + Math.sin(time * 13) * 0.004;
        const tipCol = this.heavyPulse > 0.35 ? COLOR.cyan : COLOR.white;
        const midFlameCol = beatPulse > 0.45 ? COLOR.gold : COLOR.orange;
        const beacons = [
            [0.218, 0.33],
            [0.415, 0.54],
            [0.530, 0.54],
            [0.768, 0.38]
        ];
        for (let b = 0; b < beacons.length; b++) {
            const [bx, by] = beacons[b];
            this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, bx - 0.004, by - flameH * 0.5, 0.014, flameH * 0.5, COLOR.rust);
            this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, bx - 0.002, by - flameH * 0.85, 0.010, flameH * 0.6, midFlameCol);
            this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, bx, by - flameH, 0.006, flameH * 0.4, tipCol);
        }
    }

    drawHills(ctx, width, height, baseline, time, tension) {
        const step = Math.max(1, Math.ceil(width / 360));
        const lakeTop = Math.floor(baseline - height * 0.005);
        const lakeBottom = Math.min(height, Math.floor(baseline + height * 0.145));

        // 1. Flanking Forested Valley Slopes (Left & Right Coulisse Hills framing the Castle Cliff)
        for (let x = 0; x < width; x += step) {
            const nx = x / Math.max(1, width);

            // Valley slopes dip low in the center (0.28..0.74) so the castle cliff & lake stand proud!
            const valleyMask = nx < 0.32
                ? Math.cos((nx / 0.32) * (Math.PI * 0.5))
                : (nx > 0.70 ? Math.sin(((nx - 0.70) / 0.30) * (Math.PI * 0.5)) : 0);

            const hillUndulation = Math.sin(nx * Math.PI * 5 + 1.2) * height * 0.018;
            const slopeY = Math.floor(baseline + height * 0.01 - valleyMask * height * 0.105 + hillUndulation);

            this.rect(ctx, width, height, x, slopeY, step, height - slopeY, COLOR.farHill);
            this.rect(ctx, width, height, x, slopeY + 3, step, height - slopeY, COLOR.midHill);

            // Pine & Deciduous Forest Treeline along the flanking valley ridges
            if (valleyMask > 0.08) {
                const treeWave = Math.abs(Math.sin(nx * 55) * Math.cos(nx * 23));
                const treeH = Math.max(2, Math.floor(height * (0.015 + treeWave * 0.032) * valleyMask));
                const treeTop = slopeY - treeH;
                this.rect(ctx, width, height, x, treeTop + 2, step, treeH, COLOR.black);
                this.rect(ctx, width, height, x, treeTop + 1, step, Math.max(1, Math.floor(treeH * 0.55)), COLOR.castle);
                if ((Math.floor(x / step) & 1) === 0) {
                    this.rect(ctx, width, height, x, treeTop, step, 2, COLOR.copperBlue);
                }
            }
        }

        // 2. ORGANIC WINDING HIGHLAND LOCH / MOUNTAIN LAKE (Zero rectangular edges!)
        if (lakeBottom > lakeTop + 2) {
            for (let wy = lakeTop; wy < lakeBottom; wy++) {
                const depth = (wy - lakeTop) / Math.max(1, lakeBottom - lakeTop);

                // Natural, asymmetrical curving left & right shorelines (bays, headlands, coves)
                let leftShoreRatio = 0.10
                    - Math.sin(depth * Math.PI * 1.35) * 0.065
                    + Math.sin(depth * Math.PI * 3.8 + 0.6) * 0.045;
                let rightShoreRatio = 0.86
                    - depth * 0.07
                    - Math.sin(depth * Math.PI * 2.6 + 0.4) * 0.065
                    + Math.cos(depth * Math.PI * 4.2) * 0.030;

                // Smoothly round off the foreground cove shore at the bottom of the lake
                if (depth > 0.82) {
                    const closeT = (depth - 0.82) / 0.18;
                    const curve = closeT * closeT;
                    leftShoreRatio += curve * 0.24;
                    rightShoreRatio -= curve * 0.26;
                }

                const lakeLeft = Math.floor(clamp(leftShoreRatio, 0.03, 0.45) * width);
                const lakeRight = Math.floor(clamp(rightShoreRatio, 0.52, 0.96) * width);
                const spanW = lakeRight - lakeLeft;
                if (spanW <= 4) continue;

                const bplShift = Math.floor(Math.sin(wy * 0.75 + time * 6.5) * (1.5 + depth * 3.0));

                // Deep nocturnal water base + Copper scanline shimmer
                this.rect(ctx, width, height, lakeLeft, wy, spanW, 1, COLOR.black);
                if ((wy & 1) === 0) {
                    const waterTone = depth < 0.35 ? COLOR.deepSky : (depth < 0.72 ? COLOR.blueSky : COLOR.indigo);
                    this.rect(ctx, width, height, lakeLeft + 4, wy, Math.max(2, spanW - 8), 1, waterTone);
                }

                // A. Shimmering Moon Reflection Path in the Western Bay (x ~ 0.17..0.24)
                const moonCenterX = Math.floor(width * 0.205 + bplShift * 1.3);
                const moonRippleW = Math.max(2, Math.floor(width * (0.025 + depth * 0.035) * (0.7 + 0.3 * Math.sin(wy * 1.3 + time * 4))));
                if (moonCenterX > lakeLeft + 4 && moonCenterX + moonRippleW < lakeRight - 4) {
                    const mCol = tension > 0.74
                        ? ((wy & 1) ? COLOR.orange : COLOR.rust)
                        : ((wy & 1) ? COLOR.moon : COLOR.silver);
                    this.rect(ctx, width, height, moonCenterX - Math.floor(moonRippleW * 0.5), wy, moonRippleW, 1, mCol);
                }

                // B. Reflected Castle Promontory & Golden Window Shimmers (following the asymmetric towers!)
                if (depth < 0.78) {
                    const donjonRefX = Math.floor(width * 0.61 + bplShift);
                    const palasRefX = Math.floor(width * 0.46 - bplShift * 0.8);
                    const westRefX = Math.floor(width * 0.27 + bplShift * 0.6);

                    if ((wy & 1) === 1) {
                        this.rect(ctx, width, height, donjonRefX, wy, Math.floor(width * 0.08), 1, COLOR.castle);
                        this.rect(ctx, width, height, palasRefX, wy, Math.floor(width * 0.07), 1, COLOR.castle);
                    }
                    // Warm flickering window & gatehouse reflections on the water ripples
                    if ((wy % 3) === 0) {
                        const winRefCol = this.heavyPulse > 0.35 ? COLOR.cyan : COLOR.orange;
                        this.rect(ctx, width, height, donjonRefX + Math.floor(width * 0.025), wy, Math.max(2, Math.floor(width * 0.022)), 1, winRefCol);
                        this.rect(ctx, width, height, palasRefX + Math.floor(width * 0.02), wy, Math.max(2, Math.floor(width * 0.025)), 1, COLOR.gold);
                        if (westRefX > lakeLeft + 6) {
                            this.rect(ctx, width, height, westRefX, wy, Math.max(2, Math.floor(width * 0.015)), 1, COLOR.orange);
                        }
                    }
                }

                // C. Active Firework Reflection Ripples directly beneath each exploding burst!
                for (let b = 0; b < this.bursts.length; b++) {
                    const burst = this.bursts[b];
                    if (!burst.active) continue;
                    const age = time - burst.startTime;
                    if (age >= 0.15 && age < burst.duration * 0.85 && ((wy + b) & 1) === 0) {
                        const fx = Math.floor(burst.x * width + bplShift * 1.8);
                        const fw = Math.max(2, Math.floor(width * 0.035 * (1 - age / burst.duration)));
                        if (fx > lakeLeft + 3 && fx + fw < lakeRight - 3) {
                            this.rect(ctx, width, height, fx - Math.floor(fw * 0.5), wy, fw, 1, burst.color);
                        }
                    }
                }

                // D. Natural Organic Shoreline Banks (Rock ledges, reeds & water-edge foam)
                const bankW = Math.max(3, Math.floor(width * (0.022 + depth * 0.025)));
                this.rect(ctx, width, height, lakeLeft - bankW, wy, bankW, 1, (wy & 1) ? COLOR.stone : COLOR.castle);
                this.rect(ctx, width, height, lakeLeft, wy, Math.max(2, Math.floor(bankW * 0.35)), 1, COLOR.copperBlue);
                this.rect(ctx, width, height, lakeRight - Math.max(2, Math.floor(bankW * 0.35)), wy, Math.max(2, Math.floor(bankW * 0.35)), 1, COLOR.indigo);
                this.rect(ctx, width, height, lakeRight, wy, bankW, 1, (wy & 1) ? COLOR.castle : COLOR.black);
            }
        }

        // 3. Mid-Ground Headland Silhouettes & Pine Promontories jutting into the Loch
        const leftHeadlandY = Math.floor(lakeTop + (lakeBottom - lakeTop) * 0.46);
        const rightHeadlandY = Math.floor(lakeTop + (lakeBottom - lakeTop) * 0.34);
        this.rect(ctx, width, height, 0, leftHeadlandY, Math.floor(width * 0.16), 5, COLOR.black);
        this.rect(ctx, width, height, Math.floor(width * 0.04), leftHeadlandY - 2, Math.floor(width * 0.11), 2, COLOR.stone);
        this.rect(ctx, width, height, Math.floor(width * 0.81), rightHeadlandY, Math.floor(width * 0.19), 5, COLOR.black);
        this.rect(ctx, width, height, Math.floor(width * 0.82), rightHeadlandY - 2, Math.floor(width * 0.12), 2, COLOR.castle);

        // 4. Foreground Repoussoir Framing Slopes (Organic sloping meadows & rocky bluffs, NO rectangular stairs!)
        for (let x = 0; x < width; x += step) {
            const nx = x / Math.max(1, width);
            const leftBluff = nx < 0.36 ? Math.pow(1 - nx / 0.36, 1.5) * height * 0.12 : 0;
            const rightBluff = nx > 0.62 ? Math.pow((nx - 0.62) / 0.38, 1.4) * height * 0.14 : 0;
            const fgWave = Math.sin(nx * Math.PI * 6 + 0.8) * height * 0.008;
            const fgTopY = Math.floor(lakeBottom - leftBluff - rightBluff + fgWave);

            this.rect(ctx, width, height, x, fgTopY, step, height - fgTopY, COLOR.black);
            this.rect(ctx, width, height, x, fgTopY, step, 3, (nx < 0.45) ? COLOR.stone : COLOR.castle);
            this.rect(ctx, width, height, x, fgTopY + 3, step, Math.max(2, Math.floor((height - fgTopY) * 0.35)), COLOR.farHill);
        }

        // 5. Soft Drifting Highland Mist Wisps over the Loch
        for (let m = 0; m < 2; m++) {
            const mistSpeed = m === 0 ? 0.018 : -0.014;
            const mistY = Math.floor(lakeTop + (lakeBottom - lakeTop) * (0.22 + m * 0.35));
            const mistOffset = Math.floor(time * width * mistSpeed);
            for (let mx = Math.floor(width * 0.14); mx < Math.floor(width * 0.84); mx += 12) {
                const px = ((mx + mistOffset) % width + width) % width;
                if (px > width * 0.14 && px < width * 0.82) {
                    const wave = Math.sin(mx * 0.05 + time * 2.0 + m) * 2;
                    this.rect(ctx, width, height, px, Math.floor(mistY + wave), 7, 1, COLOR.copperBlue);
                }
            }
        }
    }

    drawPath(ctx, width, height, time, tension, beatPulse) {
        const startY = Math.floor(height * 0.72);
        const lakeEndY = Math.floor(height * 0.855);
        const maxWidth = Math.max(2, Math.floor(Math.min(width * 0.24, height * 0.20)));
        const rowStep = Math.max(1, Math.ceil(height / 240));

        // 1. MULTI-ARCH STONE VIADUCT BRIDGE spanning across the Highland Loch
        if (lakeEndY > startY + 4) {
            const bridgeSpanH = lakeEndY - startY;
            const archCount = 3;
            for (let a = 0; a < archCount; a++) {
                const t0 = a / archCount;
                const t1 = (a + 0.65) / archCount;
                const ay = Math.floor(startY + t0 * bridgeSpanH);
                const ah = Math.max(2, Math.floor((t1 - t0) * bridgeSpanH));
                const depth = (ay - startY) / Math.max(1, height - startY);

                // Follow the S-curve causeway trajectory
                const sCurve = Math.sin(depth * Math.PI * 1.85 - 0.35) * maxWidth * 0.38;
                const bWidth = Math.max(4, Math.floor(maxWidth * (0.20 + depth * 0.72)));
                const center = Math.floor(width * 0.48 + sCurve);
                const pierLeft = Math.floor(center - bWidth * 0.58);
                const pierTotalW = Math.floor(bWidth * 1.16);

                // Sun/Moonlit Stone Bridge Piers & Spandrel Wall dipping into the water
                this.rect(ctx, width, height, pierLeft, ay, pierTotalW, ah + 3, COLOR.stone);
                this.rect(ctx, width, height, pierLeft, ay, Math.max(2, Math.floor(pierTotalW * 0.24)), ah + 3, COLOR.stoneLight);
                this.rect(ctx, width, height, pierLeft + Math.floor(pierTotalW * 0.76), ay, Math.max(2, Math.floor(pierTotalW * 0.24)), ah + 3, COLOR.castle);

                // Dark Open Viaduct Archway (shows the dark lake water & shimmer underneath!)
                const archOpenW = Math.max(2, Math.floor(pierTotalW * 0.44));
                const archOpenX = pierLeft + Math.floor((pierTotalW - archOpenW) * 0.5);
                this.rect(ctx, width, height, archOpenX, ay + 2, archOpenW, Math.max(1, ah), COLOR.black);
                this.rect(ctx, width, height, archOpenX + 1, ay + Math.max(2, ah), Math.max(1, archOpenW - 2), 1, COLOR.copperBlue);
            }
        }

        // 2. GRACEFUL S-CURVE COBBLESTONE CAUSEWAY & PARAPET WALLS
        for (let y = Math.max(0, startY); y < height; y += rowStep) {
            const depth = (y - startY) / Math.max(1, height - startY);
            const sCurve = Math.sin(depth * Math.PI * 1.85 - 0.35) * maxWidth * 0.38;
            const pathWidth = Math.max(2, Math.floor(maxWidth * (0.18 + Math.pow(depth, 1.1) * 0.82)));
            const center = Math.floor(width * 0.48 + sCurve);
            const leftEdge = Math.floor(center - pathWidth / 2);
            const curbW = Math.max(1, Math.floor(pathWidth * 0.10));

            // Crenellated Stone Bridge Parapet Walls (lit left wall, shadowed right wall)
            const isMerlon = (Math.floor((y - startY) / (rowStep * 2)) & 1) === 0;
            this.rect(ctx, width, height, leftEdge - curbW, y, curbW, rowStep, isMerlon ? COLOR.silver : COLOR.stoneLight);
            this.rect(ctx, width, height, leftEdge + pathWidth, y, curbW, rowStep, isMerlon ? COLOR.stone : COLOR.castle);

            // Base Cobblestone Roadbed
            const courseIdx = Math.floor((y - startY) / (rowStep * 2));
            const baseStoneCol = (courseIdx & 1) === 0 ? COLOR.stone : COLOR.castle;
            this.rect(ctx, width, height, leftEdge, y, pathWidth, rowStep, baseStoneCol);

            // Subtle Perspective Cobblestone Courses (natural stone shades, no neon yellow road stripes!)
            if (pathWidth >= 8) {
                const stones = 4;
                const stoneW = Math.floor(pathWidth / stones);
                const stagger = (courseIdx & 1) === 0 ? 0 : Math.floor(stoneW * 0.45);
                for (let s = 0; s < stones; s++) {
                    const sx = leftEdge + s * stoneW + stagger;
                    if (sx + stoneW * 0.72 < leftEdge + pathWidth) {
                        const cobbleCol = s === 0 ? COLOR.stoneLight : (s === stones - 1 ? COLOR.midHill : COLOR.stone);
                        this.rect(ctx, width, height, sx, y, Math.max(1, Math.floor(stoneW * 0.70)), rowStep, cobbleCol);
                    }
                }
            }

            // Wooden Drawbridge Planks at the Gatehouse entrance
            if (depth < 0.11) {
                const plankCol = (courseIdx & 1) === 0 ? COLOR.rust : COLOR.blood;
                this.rect(ctx, width, height, leftEdge + 1, y, Math.max(1, pathWidth - 2), rowStep, plankCol);
            }
        }

        // 3. Wrought-Iron Bridge Lanterns & Cobblestone Torchlight Pools
        for (let t = 0; t < TORCH_DEPTHS.length; t++) {
            const depth = TORCH_DEPTHS[t];
            const y = Math.floor(startY + depth * (height - startY));
            const sCurve = Math.sin(depth * Math.PI * 1.85 - 0.35) * maxWidth * 0.38;
            const pathWidth = Math.max(2, Math.floor(maxWidth * (0.18 + Math.pow(depth, 1.1) * 0.82)));
            const center = Math.floor(width * 0.48 + sCurve);
            const primarySide = (t & 1) === 0 ? -1 : 1;

            const sides = tension > 0.55 ? 2 : 1;
            for (let s = 0; s < sides; s++) {
                const side = s === 0 ? primarySide : -primarySide;
                const torchX = Math.floor(center + side * (pathWidth / 2 + 2));
                const postH = Math.max(4, Math.floor(4 + depth * 5));

                // Soft warm torchlight pool on the cobblestones inside the bridge
                const poolW = Math.max(2, Math.floor(3 + depth * 4 + beatPulse * 2));
                const poolX = side < 0 ? torchX + 2 : torchX - poolW - 1;
                this.rect(ctx, width, height, poolX, y, poolW, Math.max(1, rowStep), COLOR.rust);
                if (beatPulse > 0.35) {
                    this.rect(ctx, width, height, poolX + 1, y, Math.max(1, poolW - 2), 1, COLOR.orange);
                }

                // Wrought-iron lantern post
                this.rect(ctx, width, height, torchX, y - postH, 2, postH + 1, COLOR.black);
                this.rect(ctx, width, height, torchX - 1, y - postH - 1, 4, 1, COLOR.stoneLight);

                // Tapered pixel flame reactive to beatLevel & beatPulse
                const flamePulse = beatPulse * 3.0 + this.heavyPulse * 2.0;
                const flameFlicker = Math.sin(time * 13 + t * 3.5 + s * 2) * 1.2;
                const flameH = Math.max(2, Math.floor(3 + depth * 2 + flamePulse + flameFlicker));
                const outerFlame = this.heavyPulse > 0.4 ? COLOR.magenta : COLOR.orange;
                const innerFlame = this.heavyPulse > 0.4
                    ? COLOR.cyan
                    : (beatPulse > 0.5 ? COLOR.white : COLOR.gold);

                this.rect(ctx, width, height, torchX - 1, y - postH - 1 - Math.floor(flameH * 0.7), 3, Math.max(1, Math.floor(flameH * 0.7)), outerFlame);
                this.rect(ctx, width, height, torchX, y - postH - 1 - flameH, 1, flameH, innerFlame);
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
        this.copperPhase += dt * (2.2 + this.tension * 3.4 + this.beatPulse * 2.0);

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

        // Compute directional firework illumination for 3D cylindrical tower & lake reflections
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
        const castleWidth = Math.max(1, Math.min(width * 0.92, minDim * 0.82));
        const castleHeight = Math.max(1, Math.min(height * 0.52, minDim * 0.86));
        const baseline = Math.floor(height * 0.72);
        const castleX = Math.floor((width - castleWidth) / 2);
        const castleY = Math.floor(baseline - castleHeight);

        // Render Romantic painted world & embedded Amiga effects back-to-front
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