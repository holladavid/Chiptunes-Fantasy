// === js/visuals/dse/amiga/castle-fireworks.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: AMIGA CASTLE FIREWORKS (Background DSE)
// Romantic Masterpiece & "Defender of the Crown" (Jim Sachs / Schinkel)
// castle landscape composed along the Golden Ratio (Phi = 0.618):
// - Razor-sharp pixel-accurate Gothic conical slate roofs with swept eaves,
//   dormer lucarnes, wrought-iron finials, and crisp rim-lit sky contours.
// - Asymmetrical Grand Citadel atop a craggy cliff promontory with 3D
//   cylindrical stonework, circular Rose Window, pointed lancets, and viaduct.
// - Organic Highland Loch with pine-clad peninsulas, curved bays, and
//   real-time BPLCON1 scanline reflections for moon, windows, and fireworks.
// - Continuous multi-arch stone viaduct & S-curve cobblestone causeway.
// - Full musical synchronization: beatLevel (1=soft, 2=medium, 3=hard),
//   beatStrength, and tensionPct drive Blitter fireworks, directional
//   rim-lighting, battlement fountains, horizon aurora, bats, and lightning.
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
const LIGHTNING_DURATION = 0.22;
const MAIN_BOLT_SEGMENTS = 32;
const MAX_LIGHTNING_BRANCHES = 8;
const MAX_BRANCH_POINTS = 9;

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

// Circular chord profile for the Gothic Rose Window (9 rows, half-widths)
const ROSE_CHORDS = [1, 3, 4, 4, 4, 4, 4, 3, 1];

const SKY_BAND_EDGES = [0, 0.13, 0.28, 0.43, 0.56, 0.67, 0.77, 1];
const SKY_BAND_COLORS = [
    COLOR.black, COLOR.deepSky, COLOR.blueSky, COLOR.indigo,
    COLOR.purple, COLOR.horizon, COLOR.wine
];

const FOUNTAIN_X_OFFSETS = [0.23, 0.44, 0.59, 0.76];
const TORCH_DEPTHS = [0.18, 0.44, 0.72, 0.92];

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

function boltHash(seed, index) {
    let h = (Math.imul(seed | 0, 374761393) + Math.imul(index | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = h ^ (h >>> 16);
    return ((h & 0xffff) / 32767.5) - 1;
}

function lightningEnvelope(timer) {
    if (!Number.isFinite(timer) || timer <= 0) return 0;
    const tNorm = 1 - clamp(timer / LIGHTNING_DURATION, 0, 1);
    if (tNorm < 0.28) return 1.0 - (tNorm / 0.28) * 0.40;
    if (tNorm < 0.42) return 0.20;
    if (tNorm < 0.68) return 0.88 - ((tNorm - 0.42) / 0.26) * 0.38;
    return 0.42 * (1 - (tNorm - 0.68) / 0.32);
}

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

        this.boltX = new Float32Array(MAIN_BOLT_SEGMENTS + 1);
        this.boltY = new Float32Array(MAIN_BOLT_SEGMENTS + 1);
        this.branchX = new Float32Array(MAX_LIGHTNING_BRANCHES * MAX_BRANCH_POINTS);
        this.branchY = new Float32Array(MAX_LIGHTNING_BRANCHES * MAX_BRANCH_POINTS);
        this.branchPoints = new Uint8Array(MAX_LIGHTNING_BRANCHES);
        this.branchTier = new Uint8Array(MAX_LIGHTNING_BRANCHES);

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

        this.fountains = Array.from({ length: MAX_FOUNTAINS }, () => ({
            active: false,
            slot: 0,
            startTime: -100,
            duration: 0.55,
            level: 1,
            color: COLOR.gold,
            secondaryColor: COLOR.white
        }));

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
        // 1. Amiga Copper sky gradient with scanline interleave dithering
        const ditherSpan = clamp(Math.floor(height / 40), 1, 10);
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

        // 2. Organic Undulating Horizon Aurora / Twilight Glow behind distant mountains
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
            const segW = Math.max(3, Math.ceil(width / 64));
            const waveScale = Math.max(2, Math.floor(height * (0.013 + beatImpulse * 0.011)));
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
        this.drawCloud(ctx, width, height, time, 0.14, 0.22, 0.007 + tension * 0.004, COLOR.cloud);
        this.drawCloud(ctx, width, height, time, 0.48, 0.15, 0.011 + tension * 0.006, COLOR.cloud);
        this.drawCloud(ctx, width, height, time, 0.78, 0.28, -0.009 - tension * 0.005, COLOR.cloudLight);
    }

    drawMoon(ctx, width, height, tension) {
        const minDim = Math.min(width, height);
        if (minDim < 8) return;

        if (minDim < 56) {
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

        // Pixel-smooth Spherical Amiga Moon via exact integer circle chords
        const px = Math.max(1, Math.floor(minDim / 300));
        const radius = clamp(Math.floor(minDim * 0.072), 8, 64);
        if (width < radius * 2 + 4 || height < radius * 2 + 4) return;

        const centerX = clamp(Math.floor(width * 0.20), radius + 2, width - radius - 2);
        const centerY = clamp(Math.floor(height * 0.16), radius + 2, height - radius - 2);

        const isBloodMoon = tension > 0.74;
        const rimCol = isBloodMoon ? COLOR.gold : COLOR.white;
        const bodyCol = isBloodMoon ? COLOR.orange : COLOR.moon;
        const shadeCol = isBloodMoon ? COLOR.rust : COLOR.silver;
        const mariaCol = isBloodMoon ? COLOR.blood : COLOR.cloudLight;

        for (let dy = -radius; dy <= radius; dy += px) {
            const ny = dy / radius;
            const halfSpan = Math.floor(Math.sqrt(Math.max(0, radius * radius - dy * dy)));
            if (halfSpan < 1) continue;

            const leftX = centerX - halfSpan;
            const span = halfSpan * 2;
            const rowY = centerY + dy;

            this.rect(ctx, width, height, leftX, rowY, span, px, bodyCol);

            const rimW = Math.max(px, Math.floor(span * (0.20 - ny * 0.04)));
            this.rect(ctx, width, height, leftX, rowY, rimW, px, rimCol);

            const ditherJig = ((Math.floor(dy / px)) & 1) === 0 ? Math.floor(px * 2) : 0;
            const shadeW = Math.max(px, Math.floor(span * (0.26 + ny * 0.06)) + ditherJig);
            if (shadeW < span) {
                this.rect(ctx, width, height, leftX + span - shadeW, rowY, shadeW, px, shadeCol);
            }

            if (ny > -0.55 && ny < -0.05) {
                const mCurve = Math.sin(((ny + 0.55) / 0.50) * Math.PI);
                const mw = Math.floor(radius * 0.55 * mCurve);
                if (mw >= px) {
                    this.rect(ctx, width, height, centerX - Math.floor(radius * 0.10), rowY, mw, px, mariaCol);
                }
            } else if (ny >= 0.08 && ny < 0.48) {
                const mCurve = Math.sin(((ny - 0.08) / 0.40) * Math.PI);
                const mw = Math.floor(radius * 0.42 * mCurve);
                if (mw >= px) {
                    this.rect(ctx, width, height, centerX - Math.floor(radius * 0.38), rowY, mw, px, mariaCol);
                }
            }
        }
    }

    drawCloud(ctx, width, height, time, baseX, baseY, speed, color) {
        const minDim = Math.min(width, height);
        if (minDim < 12) return;
        const unit = clamp(Math.floor(minDim / 150), 1, 3);
        const cloudWidth = unit * 34;
        if (cloudWidth >= width) return;

        const travel = width + cloudWidth;
        const offset = time * minDim * speed;
        const x = Math.floor(((baseX * width + offset + cloudWidth) % travel + travel) % travel - cloudWidth);
        const y = Math.floor(baseY * height);

        let rimColor = color === COLOR.cloudLight ? COLOR.silver : COLOR.cloudLight;
        let midCol = color;

        const flashEnv = lightningEnvelope(this.lightningTimer);
        if (flashEnv > 0.45) {
            rimColor = COLOR.white;
            midCol = COLOR.cyan;
        } else if (flashEnv > 0.20) {
            rimColor = COLOR.silver;
            midCol = COLOR.blue;
        } else if (baseX < 0.5 && this.leftGlow > 0.22) {
            rimColor = this.leftGlowColor;
        } else if (baseX >= 0.5 && this.rightGlow > 0.22) {
            rimColor = this.rightGlowColor;
        }

        // Smoothly tapered nocturnal cloud bank with fine feathered contours
        this.rect(ctx, width, height, x + unit * 12, y - unit * 4, unit * 7, unit, rimColor);
        this.rect(ctx, width, height, x + unit * 9, y - unit * 3, unit * 13, unit, midCol);
        this.rect(ctx, width, height, x + unit * 9, y - unit * 3, unit * 4, unit, rimColor);
        this.rect(ctx, width, height, x + unit * 5, y - unit * 2, unit * 21, unit, midCol);
        this.rect(ctx, width, height, x + unit * 2, y - unit, unit * 28, unit, color);
        this.rect(ctx, width, height, x, y, unit * 33, unit, color);
        this.rect(ctx, width, height, x + unit * 3, y + unit, unit * 27, unit, COLOR.indigo);
        this.rect(ctx, width, height, x - unit * 3, y, unit * 3, 1, COLOR.cloud);
        this.rect(ctx, width, height, x + unit * 32, y - unit, unit * 4, 1, midCol);
    }

    drawBoltSegment(ctx, width, height, x0, y0, x1, y1, thickness, colorIndex) {
        if (!Number.isFinite(x0) || !Number.isFinite(y0) ||
            !Number.isFinite(x1) || !Number.isFinite(y1)) return;

        let ix0 = Math.round(x0);
        let iy0 = Math.round(y0);
        const ix1 = Math.round(x1);
        const iy1 = Math.round(y1);
        const dx = Math.abs(ix1 - ix0);
        const dy = Math.abs(iy1 - iy0);
        const sx = ix0 < ix1 ? 1 : -1;
        const sy = iy0 < iy1 ? 1 : -1;
        let err = dx - dy;
        const half = thickness >> 1;
        let guard = dx + dy + 2;

        while (guard-- > 0) {
            this.rect(ctx, width, height, ix0 - half, iy0 - half, thickness, thickness, colorIndex);
            if (ix0 === ix1 && iy0 === iy1) break;
            const e2 = err << 1;
            if (e2 > -dy) {
                err -= dy;
                ix0 += sx;
            }
            if (e2 < dx) {
                err += dx;
                iy0 += sy;
            }
        }
    }

    drawLightning(ctx, width, height) {
        if (this.lightningTimer <= 0) return;
        const minDim = Math.min(width, height);
        if (!Number.isFinite(minDim) || minDim < 4) return;

        const env = lightningEnvelope(this.lightningTimer);
        if (env <= 0.02) return;

        const px = clamp(Math.floor(minDim / 280), 1, 3);
        const seed = this.lightningSeed | 0;
        const lx = Number.isFinite(this.lightningX) ? clamp(this.lightningX, 0.05, 0.95) : 0.5;
        const maxX = Math.max(1, width - 2);
        const startX = clamp(Math.floor(lx * width), 1, maxX);
        const startY = 0;
        const endY = Math.max(startY + 2, Math.floor(height * 0.70));

        let drift = boltHash(seed, 3) * width * 0.13;
        if (lx < 0.15 && drift > 0) {
            drift = -Math.abs(drift) * 0.55;
        }
        const endX = clamp(Math.floor(startX + drift), 1, maxX);

        // Minimaler Fallback für sehr kleine Test-Canvases
        if (minDim < 24) {
            const midX = clamp(Math.floor((startX + endX) * 0.5 + boltHash(seed, 4) * width * 0.12), 0, Math.max(0, width - 1));
            const midY = Math.floor((startY + endY) * 0.5);
            const col = env > 0.5 ? COLOR.white : COLOR.cyan;
            this.drawBoltSegment(ctx, width, height, startX, startY, midX, midY, 1, col);
            this.drawBoltSegment(ctx, width, height, midX, midY, endX, endY, 1, col);
            return;
        }

        // 1. Fraktales Midpoint-Displacement für den 32-Segment-Hauptkanal
        const N = MAIN_BOLT_SEGMENTS;
        const bx = this.boltX;
        const by = this.boltY;
        bx[0] = startX;
        by[0] = startY;
        bx[N] = endX;
        by[N] = endY;

        let step = N;
        let level = 0;
        const spanX = Math.max(4, width * 0.070);
        const spanY = Math.max(1, (endY - startY) * 0.045);
        let hIdx = 10;
        while (step > 1) {
            const half = step >> 1;
            const decayX = spanX * Math.pow(0.58, level);
            const decayY = level < 3 ? spanY * Math.pow(0.45, level) : 0;
            for (let i = 0; i < N; i += step) {
                const mid = i + half;
                let rx = boltHash(seed, hIdx++);
                const ry = boltHash(seed, hIdx++);
                if (level >= 2 && Math.abs(rx) < 0.25) {
                    rx = ((mid + seed) & 1) === 0 ? 0.45 : -0.45;
                }
                bx[mid] = clamp((bx[i] + bx[i + step]) * 0.5 + rx * decayX, 1, maxX);
                by[mid] = clamp((by[i] + by[i + step]) * 0.5 + ry * decayY, startY, endY);
            }
            step = half;
            level++;
        }

        // 2. Hierarchische Äste (Wolken-Ausläufer, Hauptgabeln, Nebenäste)
        const fx = this.branchX;
        const fy = this.branchY;
        let branchCount = 0;

        for (let c = 0; c < 2 && branchCount < MAX_LIGHTNING_BRANCHES; c++) {
            const cAnchor = 1 + c * 2;
            const cax = bx[cAnchor];
            const cay = by[cAnchor];
            const cSide = c === 0 ? -1 : 1;
            const cScale = ((lx < 0.15 && cSide > 0) || (lx < 0.34 && cSide < 0)) ? 0.40 : 1.0;
            const cex = clamp(cax + cSide * width * (0.055 + Math.abs(boltHash(seed, 50 + c)) * 0.07) * cScale, 1, maxX);
            const cey = clamp(cay + height * (0.04 + Math.abs(boltHash(seed, 60 + c)) * 0.05), 1, height * 0.20);
            const off = branchCount * MAX_BRANCH_POINTS;
            fx[off] = cax;
            fy[off] = cay;
            fx[off + 4] = cex;
            fy[off + 4] = cey;
            fx[off + 2] = clamp((fx[off] + fx[off + 4]) * 0.5 + boltHash(seed, 70 + c) * width * 0.015 * cScale, 1, maxX);
            fy[off + 2] = clamp((fy[off] + fy[off + 4]) * 0.5 + boltHash(seed, 75 + c) * height * 0.020, 1, height * 0.22);
            fx[off + 1] = clamp((fx[off] + fx[off + 2]) * 0.5, 1, maxX);
            fy[off + 1] = clamp((fy[off] + fy[off + 2]) * 0.5 + boltHash(seed, 80 + c) * height * 0.012, 1, height * 0.22);
            fx[off + 3] = clamp((fx[off + 2] + fx[off + 4]) * 0.5, 1, maxX);
            fy[off + 3] = clamp((fy[off + 2] + fy[off + 4]) * 0.5 + boltHash(seed, 85 + c) * height * 0.012, 1, height * 0.22);
            this.branchPoints[branchCount] = 5;
            this.branchTier[branchCount] = 2;
            branchCount++;
        }

        const primaryTotal = 3 + (Math.abs(seed) & 1);
        for (let b = 0; b < primaryTotal && branchCount < MAX_LIGHTNING_BRANCHES; b++) {
            const anchorIdx = 5 + ((b * 5 + Math.abs(seed * 3)) % 17);
            const ax = bx[anchorIdx];
            const ay = by[anchorIdx];
            const side = ((b + seed) & 1) === 0 ? -1 : 1;
            const frac = 1.0 - (anchorIdx / N) * 0.45;
            const bDx = side * width * (0.04 + Math.abs(boltHash(seed, 100 + b * 7)) * 0.075) * frac;
            const bDy = Math.max(Math.abs(bDx) * 0.72, height * (0.11 + Math.abs(boltHash(seed, 101 + b * 7)) * 0.14) * frac);
            const ex = clamp(ax + bDx, 1, maxX);
            const ey = clamp(ay + bDy, startY, endY);

            const off = branchCount * MAX_BRANCH_POINTS;
            fx[off] = ax;
            fy[off] = ay;
            fx[off + 8] = ex;
            fy[off + 8] = ey;
            let bStep = 8;
            let bLevel = 0;
            while (bStep > 1) {
                const bHalf = bStep >> 1;
                const bDec = Math.max(2.5, width * 0.028) * Math.pow(0.56, bLevel);
                for (let i = 0; i < 8; i += bStep) {
                    const mid = i + bHalf;
                    const rx = boltHash(seed, 120 + b * 20 + mid);
                    const ry = boltHash(seed, 140 + b * 20 + mid);
                    fx[off + mid] = clamp((fx[off + i] + fx[off + i + bStep]) * 0.5 + rx * bDec, 1, maxX);
                    fy[off + mid] = clamp((fy[off + i] + fy[off + i + bStep]) * 0.5 + ry * bDec * 0.25, startY, endY);
                }
                bStep = bHalf;
                bLevel++;
            }
            this.branchPoints[branchCount] = 9;
            this.branchTier[branchCount] = 1;
            const primaryOff = off;
            branchCount++;

            if (b < 2 && branchCount < MAX_LIGHTNING_BRANCHES) {
                const tAnchor = 3 + (b & 1);
                const tax = fx[primaryOff + tAnchor];
                const tay = fy[primaryOff + tAnchor];
                const tSide = boltHash(seed, 200 + b) > -0.25 ? side : -side;
                const tDx = tSide * width * (0.022 + Math.abs(boltHash(seed, 210 + b)) * 0.035);
                const tDy = Math.max(Math.abs(tDx) * 0.75, height * (0.055 + Math.abs(boltHash(seed, 220 + b)) * 0.055));
                const tex = clamp(tax + tDx, 1, maxX);
                const tey = clamp(tay + tDy, startY, endY);

                const tOff = branchCount * MAX_BRANCH_POINTS;
                fx[tOff] = tax;
                fy[tOff] = tay;
                fx[tOff + 4] = tex;
                fy[tOff + 4] = tey;
                fx[tOff + 2] = clamp((fx[tOff] + fx[tOff + 4]) * 0.5 + boltHash(seed, 230 + b) * width * 0.012, 1, maxX);
                fy[tOff + 2] = (fy[tOff] + fy[tOff + 4]) * 0.5;
                fx[tOff + 1] = clamp((fx[tOff] + fx[tOff + 2]) * 0.5 + boltHash(seed, 235 + b) * width * 0.006, 1, maxX);
                fy[tOff + 1] = (fy[tOff] + fy[tOff + 2]) * 0.5;
                fx[tOff + 3] = clamp((fx[tOff + 2] + fx[tOff + 4]) * 0.5 + boltHash(seed, 240 + b) * width * 0.006, 1, maxX);
                fy[tOff + 3] = (fy[tOff + 2] + fy[tOff + 4]) * 0.5;
                this.branchPoints[branchCount] = 5;
                this.branchTier[branchCount] = 2;
                branchCount++;
            }
        }

        // 3. Mehrschichtiges Painter's-Order-Rendering (Corona -> Plasma -> weißer Kern)
        let outerCol = COLOR.indigo;
        let midCol = COLOR.copperBlue;
        let coreCol = COLOR.blue;
        let branchHalo = COLOR.indigo;
        let branchCore = COLOR.copperBlue;
        let twigCol = COLOR.indigo;
        let outerThick = px * 2;
        let midThick = px;
        const coreThick = px;

        if (env > 0.65) {
            outerCol = COLOR.blue;
            midCol = COLOR.cyan;
            coreCol = COLOR.white;
            branchHalo = COLOR.copperBlue;
            branchCore = COLOR.silver;
            twigCol = COLOR.cyan;
            outerThick = px * 3;
            midThick = px * 2;
        } else if (env > 0.32) {
            outerCol = COLOR.copperBlue;
            midCol = COLOR.blue;
            coreCol = COLOR.cyan;
            branchHalo = COLOR.indigo;
            branchCore = COLOR.blue;
            twigCol = COLOR.copperBlue;
            outerThick = px * 2 + 1;
            midThick = px * 2;
        }

        for (let b = 0; b < branchCount; b++) {
            if (this.branchTier[b] !== 1 || env <= 0.30) continue;
            const off = b * MAX_BRANCH_POINTS;
            const pts = this.branchPoints[b];
            for (let i = 0; i < pts - 2; i++) {
                this.drawBoltSegment(ctx, width, height, fx[off + i], fy[off + i], fx[off + i + 1], fy[off + i + 1], px * 2, branchHalo);
            }
        }
        for (let i = 0; i < N; i++) {
            const tThick = i < N * 0.72 ? outerThick : Math.max(px, outerThick - px);
            this.drawBoltSegment(ctx, width, height, bx[i], by[i], bx[i + 1], by[i + 1], tThick, outerCol);
        }

        for (let b = 0; b < branchCount; b++) {
            const off = b * MAX_BRANCH_POINTS;
            const pts = this.branchPoints[b];
            const tier = this.branchTier[b];
            const baseCol = tier === 1 ? branchCore : twigCol;
            const tipCol = env > 0.45 ? COLOR.blue : COLOR.indigo;
            for (let i = 0; i < pts - 1; i++) {
                const segCol = i < pts - 3 ? baseCol : tipCol;
                this.drawBoltSegment(ctx, width, height, fx[off + i], fy[off + i], fx[off + i + 1], fy[off + i + 1], px, segCol);
            }
            if (tier === 1 && env > 0.58) {
                this.drawBoltSegment(ctx, width, height, fx[off], fy[off], fx[off + 1], fy[off + 1], px, env < 0.8 ? COLOR.cyan : COLOR.white);
            }
        }
        for (let i = 0; i < N; i++) {
            this.drawBoltSegment(ctx, width, height, bx[i], by[i], bx[i + 1], by[i + 1], midThick, midCol);
        }

        for (let i = 0; i < N; i++) {
            const tCore = (env > 0.78 && i < N * 0.35 && px === 1) ? px + 1 : coreThick;
            const tCol = (env > 0.45 || i < N - 6) ? coreCol : midCol;
            this.drawBoltSegment(ctx, width, height, bx[i], by[i], bx[i + 1], by[i + 1], tCore, tCol);
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

    // =========================================================================
    // PIXEL-ACCURATE GOTHIC ARCHITECTURE HELPERS (Clean 1px Contours, Zero Seams)
    // =========================================================================

    drawConicalRoof(ctx, width, height, centerX, baseY, baseHalfW, roofH, px, leftRimCol, rightContourCol, hasDormer) {
        if (roofH < 2 || baseHalfW < 2) {
            this.rect(ctx, width, height, centerX - 1, baseY - 2, 2, 2, leftRimCol);
            return baseY - 2;
        }

        const topY = baseY - roofH;
        const litSlate = lightningEnvelope(this.lightningTimer) > 0.35 ? COLOR.cyan : COLOR.blue;        const midSlate = COLOR.copperBlue;
        const darkSlate = COLOR.castle;
        const deepShadow = COLOR.black;

        for (let dy = 0; dy <= roofH; dy += px) {
            const t = dy / roofH;
            const profile = t < 0.78
                ? Math.pow(t / 0.78, 0.96) * 0.80
                : 0.80 + Math.pow((t - 0.78) / 0.22, 1.35) * 0.20;

            const hw = Math.round(baseHalfW * profile);
            const rowY = topY + dy;
            const leftX = centerX - hw;
            const totalW = hw * 2 + px;

            if (totalW <= px * 2) {
                this.rect(ctx, width, height, centerX, rowY, px, px, COLOR.silver);
                continue;
            }

            const c0 = leftX;
            const c1 = leftX + px;
            const c2 = leftX + Math.max(px * 2, Math.floor(totalW * 0.30));
            const c3 = leftX + Math.max(px * 3, Math.floor(totalW * 0.56));
            const c4 = leftX + Math.max(px * 4, totalW - px * 2);
            const c5 = leftX + totalW - px;
            const cEnd = leftX + totalW;

            const isShingleLine = (Math.floor(dy / (px * 4)) & 1) === 0 && (dy % (px * 4) < px);

            this.rect(ctx, width, height, c0, rowY, c1 - c0, px, leftRimCol);
            if (c2 > c1) this.rect(ctx, width, height, c1, rowY, c2 - c1, px, litSlate);
            if (c3 > c2) this.rect(ctx, width, height, c2, rowY, c3 - c2, px, isShingleLine ? COLOR.indigo : midSlate);
            if (c4 > c3) this.rect(ctx, width, height, c3, rowY, c4 - c3, px, darkSlate);
            if (c5 > c4) this.rect(ctx, width, height, c4, rowY, c5 - c4, px, deepShadow);
            if (cEnd > c5) this.rect(ctx, width, height, c5, rowY, cEnd - c5, px, rightContourCol);
        }

        this.rect(ctx, width, height, centerX - baseHalfW, baseY, baseHalfW * 2 + px, px, COLOR.stoneLight);
        this.rect(ctx, width, height, centerX - baseHalfW + px, baseY + px, Math.max(px, baseHalfW * 2 - px), px * 2, COLOR.black);

        if (hasDormer && baseHalfW >= px * 7 && roofH >= px * 12) {
            const dormCx = centerX - Math.floor(baseHalfW * 0.25);
            const dormBaseY = topY + Math.floor(roofH * 0.72);
            const dormW = Math.max(3, px * 3);
            const dormH = Math.max(4, px * 5);
            this.rect(ctx, width, height, dormCx - Math.floor(dormW * 0.5) - px, dormBaseY - dormH, dormW + px * 2, dormH, COLOR.black);
            this.rect(ctx, width, height, dormCx - Math.floor(dormW * 0.5), dormBaseY - dormH, dormW, dormH, COLOR.stoneLight);
            this.rect(ctx, width, height, dormCx - px, dormBaseY - dormH - px, px * 2, px, COLOR.silver);
            this.rect(ctx, width, height, dormCx, dormBaseY - dormH + px * 2, px, Math.max(2, dormH - px * 2), COLOR.gold);
        }

        const finialH = Math.max(4, Math.floor(roofH * 0.24));
        const apexY = topY - finialH;
        this.rect(ctx, width, height, centerX, apexY, px, finialH, COLOR.silver);
        this.rect(ctx, width, height, centerX - px, apexY + Math.floor(finialH * 0.45), px * 3, px, COLOR.gold);
        return apexY;
    }

    drawPixelTower(ctx, width, height, castleX, castleY, castleWidth, castleHeight, tx, ty, tw, th, roofH, merlonCount, leftRim, rightRim, rightSkyContour, hasDormer = false) {
        const px = Math.max(1, Math.floor(Math.min(castleWidth, castleHeight) / 260));
        const x0 = Math.floor(castleX + tx * castleWidth);
        const xEnd = Math.floor(castleX + (tx + tw) * castleWidth);
        const totalW = Math.max(4, xEnd - x0);
        const yTop = Math.floor(castleY + ty * castleHeight);
        const yBot = Math.floor(castleY + (ty + th) * castleHeight);
        const totalH = Math.max(4, yBot - yTop);
        const centerX = x0 + Math.floor(totalW * 0.5);

        const s1 = x0 + Math.max(px, Math.floor(totalW * 0.08));
        const s2 = x0 + Math.floor(totalW * 0.32);
        const s3 = x0 + Math.floor(totalW * 0.62);
        const s4 = x0 + Math.floor(totalW * 0.86);
        const s5 = xEnd - px;

        this.rect(ctx, width, height, x0, yTop, s1 - x0, totalH, leftRim);
        this.rect(ctx, width, height, s1, yTop, s2 - s1, totalH, COLOR.stoneLight);
        this.rect(ctx, width, height, s2, yTop, s3 - s2, totalH, COLOR.stone);
        this.rect(ctx, width, height, s3, yTop, s4 - s3, totalH, COLOR.castle);
        this.rect(ctx, width, height, s4, yTop, Math.max(0, s5 - s4), totalH, rightRim);
        this.rect(ctx, width, height, s5, yTop, px, totalH, rightSkyContour);

        const coursePx = Math.max(6, Math.floor(castleHeight * 0.052));
        for (let cy = yTop + coursePx; cy < yBot - px * 2; cy += coursePx) {
            this.rect(ctx, width, height, s1, cy, s4 - s1, 1, COLOR.castle);
            const staggerX = ((Math.floor((cy - yTop) / coursePx)) & 1) === 0 ? s1 + px * 2 : s2;
            this.rect(ctx, width, height, staggerX, cy - Math.floor(coursePx * 0.45), Math.max(2, Math.floor(totalW * 0.14)), px, COLOR.silver);
        }

        const overhangPx = Math.max(px, Math.floor(totalW * 0.07));
        const pLeft = x0 - overhangPx;
        const pWidth = totalW + overhangPx * 2;
        const collarH = Math.max(2, px * 2);

        this.rect(ctx, width, height, x0 - Math.floor(overhangPx * 0.5), yTop + collarH, totalW + overhangPx, collarH, COLOR.black);
        const corbels = Math.max(3, Math.floor(pWidth / (px * 4)));
        const corbelSpan = pWidth / corbels;
        for (let c = 0; c < corbels; c++) {
            const cx = Math.floor(pLeft + c * corbelSpan + px);
            const cCol = c < corbels * 0.45 ? COLOR.stoneLight : (c < corbels * 0.78 ? COLOR.stone : COLOR.castle);
            this.rect(ctx, width, height, cx, yTop + collarH, Math.max(1, Math.floor(corbelSpan * 0.45)), collarH, cCol);
        }

        this.rect(ctx, width, height, pLeft, yTop, Math.floor(pWidth * 0.36), collarH, leftRim);
        this.rect(ctx, width, height, pLeft + Math.floor(pWidth * 0.36), yTop, Math.floor(pWidth * 0.42), collarH, COLOR.stone);
        this.rect(ctx, width, height, pLeft + Math.floor(pWidth * 0.78), yTop, pWidth - Math.floor(pWidth * 0.78) - px, collarH, rightRim);
        this.rect(ctx, width, height, pLeft + pWidth - px, yTop, px, collarH, rightSkyContour);

        let apexY = yTop;

        if (roofH > 0 && merlonCount === 0) {
            const rHeightPx = Math.max(4, Math.floor(roofH * castleHeight));
            const rHalfW = Math.floor(pWidth * 0.5) + px;
            apexY = this.drawConicalRoof(ctx, width, height, centerX, yTop, rHalfW, rHeightPx, px, leftRim, rightSkyContour, hasDormer);
        } else if (roofH > 0 && merlonCount > 0) {
            const rHeightPx = Math.max(4, Math.floor(roofH * castleHeight));
            const rHalfW = Math.max(2, Math.floor(totalW * 0.43));
            apexY = this.drawConicalRoof(ctx, width, height, centerX, yTop - px, rHalfW, rHeightPx, px, leftRim, rightSkyContour, hasDormer);
        }

        if (merlonCount > 0) {
            const mHeight = Math.max(3, Math.floor(castleHeight * 0.024));
            const mSpan = pWidth / merlonCount;
            const mWidth = Math.max(2, Math.floor(mSpan * 0.60));
            for (let m = 0; m < merlonCount; m++) {
                const mx = Math.floor(pLeft + m * mSpan + (mSpan - mWidth) * 0.5);
                const my = yTop - mHeight;
                const faceCol = m < merlonCount * 0.45 ? COLOR.stoneLight : (m < merlonCount * 0.78 ? COLOR.stone : COLOR.castle);
                this.rect(ctx, width, height, mx, my, mWidth, mHeight, faceCol);
                this.rect(ctx, width, height, mx, my, px, mHeight, leftRim);
                this.rect(ctx, width, height, mx + mWidth - px, my, px, mHeight, COLOR.black);
                this.rect(ctx, width, height, mx, my, mWidth, 1, COLOR.silver);
            }
            if (roofH <= 0) apexY = yTop - mHeight;
        }

        return apexY;
    }

    drawSlenderWindow(ctx, width, height, castleX, castleY, castleWidth, castleHeight, wx, wy, ww, wh, outerGlow, coreGlow) {
        const px = Math.max(1, Math.floor(Math.min(castleWidth, castleHeight) / 280));
        const cx = Math.floor(castleX + (wx + ww * 0.5) * castleWidth);
        const halfW = Math.max(1, Math.floor(ww * castleWidth * 0.5));
        const topY = Math.floor(castleY + wy * castleHeight);
        const winH = Math.max(3, Math.floor(wh * castleHeight));

        this.rect(ctx, width, height, cx - halfW - px, topY, (halfW + px) * 2, winH + px, COLOR.black);
        this.rect(ctx, width, height, cx - halfW - px, topY + winH, (halfW + px) * 2 + 1, px, COLOR.stoneLight);
        this.rect(ctx, width, height, cx + halfW, topY + px * 2, px, Math.max(1, winH - px * 2), COLOR.stone);

        if (halfW >= 2) {
            this.rect(ctx, width, height, cx - 1, topY - px * 2, 2, px, outerGlow);
            this.rect(ctx, width, height, cx - halfW + 1, topY - px, Math.max(2, (halfW - 1) * 2), px, outerGlow);
        } else {
            this.rect(ctx, width, height, cx, topY - px, 1, px, outerGlow);
        }

        this.rect(ctx, width, height, cx - halfW, topY, halfW * 2, winH, outerGlow);
        if (halfW >= 2 && winH >= 5) {
            this.rect(ctx, width, height, cx - halfW + 1, topY + px, Math.max(1, (halfW - 1) * 2), Math.max(2, winH - px * 2), coreGlow);
            this.rect(ctx, width, height, cx - halfW, topY + Math.floor(winH * 0.45), halfW * 2, 1, COLOR.castle);
        }
    }

    drawRoseWindow(ctx, width, height, castleX, castleY, castleWidth, castleHeight, cxNorm, cyNorm, outerColor, coreColor) {
        const unit = Math.max(1, Math.floor(Math.min(castleWidth, castleHeight) / 210));
        const cx = Math.floor(castleX + cxNorm * castleWidth);
        const cy = Math.floor(castleY + cyNorm * castleHeight);

        for (let r = 0; r < ROSE_CHORDS.length; r++) {
            const dy = r - 4;
            const hw = ROSE_CHORDS[r];
            const rowY = cy + dy * unit;
            this.rect(ctx, width, height, cx - (hw + 1) * unit, rowY, (hw * 2 + 3) * unit, unit, COLOR.black);
            this.rect(ctx, width, height, cx - hw * unit, rowY, (hw * 2 + 1) * unit, unit, outerColor);
            if (Math.abs(dy) <= 1) {
                this.rect(ctx, width, height, cx - unit, rowY, unit * 3, unit, coreColor);
            }
        }
        this.rect(ctx, width, height, cx, cy - 4 * unit, unit, 9 * unit, COLOR.castle);
        this.rect(ctx, width, height, cx - 4 * unit, cy, 9 * unit, unit, COLOR.castle);
        this.rect(ctx, width, height, cx, cy, unit, unit, COLOR.white);
    }

    drawCastle(ctx, width, height, baseline, castleX, castleY, castleWidth, castleHeight, time, tension, beatPulse, glowIntensity, glowColor) {
        const px = Math.max(1, Math.floor(Math.min(castleWidth, castleHeight) / 260));
        const flashEnv = lightningEnvelope(this.lightningTimer);

        // 0. Distant Misty Mountain Range BEHIND the castle
        const mtnStep = Math.max(2, Math.ceil(width / 240));
        for (let x = 0; x < width; x += mtnStep) {
            const nx = x / Math.max(1, width);
            const farWave = Math.sin(nx * Math.PI * 3.2 + 0.4) * height * 0.055
                + Math.cos(nx * Math.PI * 7.5 + 1.1) * height * 0.022;
            const farSlope = Math.cos(nx * Math.PI * 3.2 + 0.4);
            const farY = Math.floor(baseline - height * 0.11 + farWave);
            const mtnCol = farSlope > 0.1 ? COLOR.midHill : COLOR.farHill;
            const ridgeCol = flashEnv > 0.70
            ? COLOR.white
            : (flashEnv > 0.35 ? COLOR.silver : (farSlope > 0 ? COLOR.stone : COLOR.castle));            this.rect(ctx, width, height, x, farY, mtnStep, baseline - farY + 4, mtnCol);
            this.rect(ctx, width, height, x, farY, mtnStep, 2, ridgeCol);
        }

        const leftRim = flashEnv > 0.45
            ? COLOR.white
            : (flashEnv > 0.22 ? COLOR.silver : (this.leftGlow > 0.20 ? this.leftGlowColor : COLOR.silver));
        const rightRim = flashEnv > 0.45
            ? COLOR.stoneLight
            : (this.rightGlow > 0.20 ? this.rightGlowColor : COLOR.farHill);
        const rightSkyContour = flashEnv > 0.55
            ? COLOR.white
            : (flashEnv > 0.25 ? COLOR.cyan : (this.rightGlow > 0.18 ? this.rightGlowColor : COLOR.stone));
            
        // 1. Sculpted Craggy Cliff Promontory
        const cliffStep = Math.max(2, Math.floor(castleWidth / 90));
        const cliffLeft = Math.floor(castleX + castleWidth * 0.07);
        const cliffRight = Math.floor(castleX + castleWidth * 0.92);
        const cliffBottom = baseline + Math.floor(height * 0.02);

        for (let rx = cliffLeft; rx < cliffRight; rx += cliffStep) {
            const cnx = (rx - castleX) / Math.max(1, castleWidth);
            const eastPeak = Math.exp(-Math.pow((cnx - 0.62) / 0.18, 2)) * 0.08;
            const westPeak = Math.exp(-Math.pow((cnx - 0.22) / 0.12, 2)) * 0.05;
            const gorgeDip = Math.exp(-Math.pow((cnx - 0.33) / 0.05, 2)) * 0.06;
            const cragJagged = Math.sin(cnx * 52) * 0.010 + Math.cos(cnx * 27) * 0.008;

            const topNormY = 0.77 - eastPeak - westPeak + gorgeDip + cragJagged;
            const cragTopY = Math.floor(castleY + topNormY * castleHeight);
            const cragH = Math.max(2, cliffBottom - cragTopY);

            const localSlope = Math.cos(cnx * 52);
            const rockCol = localSlope > 0.25 ? COLOR.stoneLight : (localSlope > -0.2 ? COLOR.stone : COLOR.castle);
            this.rect(ctx, width, height, rx, cragTopY, cliffStep, cragH, COLOR.black);
            this.rect(ctx, width, height, rx, cragTopY, cliffStep, Math.floor(cragH * 0.78), rockCol);
            if (localSlope > 0) {
                this.rect(ctx, width, height, rx, cragTopY, cliffStep, px * 2, leftRim);
            }
            const strataY = cragTopY + Math.floor(((cnx * 180) % 1) * cragH * 0.55) + px * 4;
            if (strataY < cliffBottom - 4) {
                this.rect(ctx, width, height, rx, strataY, cliffStep, px, COLOR.castle);
            }
        }

        // 2. High Gothic Stone Viaduct Arch spanning the mountain gorge
        const viaLeft = Math.floor(castleX + 0.265 * castleWidth);
        const viaW = Math.floor(0.115 * castleWidth);
        const viaTop = Math.floor(castleY + 0.50 * castleHeight);
        const viaH = Math.floor(0.24 * castleHeight);
        this.rect(ctx, width, height, viaLeft, viaTop, viaW, viaH, COLOR.stone);
        this.rect(ctx, width, height, viaLeft, viaTop, viaW, px * 2, leftRim);
        const chasmCx = viaLeft + Math.floor(viaW * 0.5);
        const chasmHalfW = Math.max(2, Math.floor(viaW * 0.32));
        for (let ay = 0; ay < viaH - px * 5; ay += px) {
            const archT = ay / Math.max(1, viaH * 0.35);
            const curHW = archT < 1 ? Math.max(1, Math.floor(chasmHalfW * Math.sin(archT * Math.PI * 0.5))) : chasmHalfW;
            this.rect(ctx, width, height, chasmCx - curHW, viaTop + px * 5 + ay, curHW * 2, px, COLOR.indigo);
        }

        // 3. Western Bastion & Tall Western Wizard Watchtower
        this.drawPixelTower(
            ctx, width, height, castleX, castleY, castleWidth, castleHeight,
            0.105, 0.54, 0.075, 0.23, 0, 3, leftRim, rightRim, rightSkyContour, false
        );
        this.drawPixelTower(
            ctx, width, height, castleX, castleY, castleWidth, castleHeight,
            0.175, 0.35, 0.105, 0.39, 0.16, 0, leftRim, rightRim, rightSkyContour, true
        );

        // 4. Central Great Hall / Palas with Scanline-Crisp Pitched Slate Roof
        const hallX = Math.floor(castleX + 0.365 * castleWidth);
        const hallW = Math.floor(0.205 * castleWidth);
        const hallY = Math.floor(castleY + 0.38 * castleHeight);
        const hallH = Math.floor(0.36 * castleHeight);
        const hallRoofH = Math.floor(0.105 * castleHeight);

        this.rect(ctx, width, height, hallX, hallY, hallW, hallH, COLOR.stone);
        this.rect(ctx, width, height, hallX, hallY, Math.floor(hallW * 0.26), hallH, COLOR.stoneLight);
        this.rect(ctx, width, height, hallX + Math.floor(hallW * 0.76), hallY, hallW - Math.floor(hallW * 0.76), hallH, COLOR.castle);

        for (let ry = 0; ry <= hallRoofH; ry += px) {
            const rt = ry / Math.max(1, hallRoofH);
            const inset = Math.floor((1 - rt) * hallW * 0.14);
            const rx = hallX + inset;
            const rw = Math.max(4, hallW - inset);
            const rowY = hallY - hallRoofH + ry;
            const slateCol = ((Math.floor(ry / (px * 3)) & 1) === 0) ? COLOR.copperBlue : COLOR.blue;
            this.rect(ctx, width, height, rx, rowY, rw, px, slateCol);
            this.rect(ctx, width, height, rx, rowY, px * 2, px, leftRim);
            this.rect(ctx, width, height, rx + Math.floor(rw * 0.72), rowY, rw - Math.floor(rw * 0.72), px, COLOR.castle);
        }
        this.rect(ctx, width, height, hallX + Math.floor(hallW * 0.14), hallY - hallRoofH - px, Math.floor(hallW * 0.86), px, COLOR.silver);
        this.rect(ctx, width, height, hallX, hallY, hallW, px * 2, COLOR.black);

        // 5. Soaring Grand Donjon / Keep on the Right Golden Ratio Axis
        this.drawPixelTower(
            ctx, width, height, castleX, castleY, castleWidth, castleHeight,
            0.545, 0.22, 0.18, 0.51, 0, 6, leftRim, rightRim, rightSkyContour, false
        );
        const highestApexY = this.drawPixelTower(
            ctx, width, height, castleX, castleY, castleWidth, castleHeight,
            0.580, 0.11, 0.11, 0.11, 0.13, 0, leftRim, rightRim, rightSkyContour, true
        );
        this.drawPixelTower(
            ctx, width, height, castleX, castleY, castleWidth, castleHeight,
            0.520, 0.27, 0.048, 0.18, 0.075, 0, leftRim, rightRim, rightSkyContour, false
        );

        // Swallowtail Royal Pennant Flag attached cleanly to the finial mast apex
        const mastX = Math.floor(castleX + (0.580 + 0.055) * castleWidth) + px;
        const flagLen = Math.max(6, Math.floor(castleWidth * 0.052));
        const flagCol = tension > 0.68 ? COLOR.red : (this.currentBeatLevel === 3 ? COLOR.gold : COLOR.cyan);
        for (let fx = 0; fx < flagLen; fx += px) {
            const ft = fx / flagLen;
            const waveY = Math.round(Math.sin(ft * Math.PI * 2.2 - time * (7 + tension * 9)) * px * 1.6 * ft);
            const fh = Math.max(px, Math.round((1 - ft * 0.55) * px * 3));
            const fCol = ft > 0.62 ? COLOR.gold : flagCol;
            this.rect(ctx, width, height, mastX + fx, highestApexY + px + waveY, px, fh, fCol);
        }

        // 6. Eastern Flanking Watchtower & Outer Cliff Bastion
        this.drawPixelTower(
            ctx, width, height, castleX, castleY, castleWidth, castleHeight,
            0.720, 0.39, 0.105, 0.35, 0.14, 0, leftRim, rightRim, rightSkyContour, true
        );
        this.drawPixelTower(
            ctx, width, height, castleX, castleY, castleWidth, castleHeight,
            0.815, 0.54, 0.075, 0.23, 0, 3, leftRim, rightRim, rightSkyContour, false
        );

        // 7. Gothic Rose Mandala, Pointed Lancets & Barbican Gatehouse
        const roseOuter = beatPulse > 0.45
            ? (tension > 0.65 ? COLOR.gold : COLOR.cyan)
            : (tension > 0.65 ? COLOR.magenta : COLOR.blue);
        const roseCore = this.heavyPulse > 0.35
            ? COLOR.white
            : (this.medPulse > 0.3 ? COLOR.gold : COLOR.cyan);

        this.drawRoseWindow(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.635, 0.285, roseOuter, roseCore);
        this.drawSlenderWindow(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.585, 0.365, 0.018, 0.085, roseOuter, roseCore);
        this.drawSlenderWindow(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.626, 0.355, 0.020, 0.095, roseOuter, roseCore);
        this.drawSlenderWindow(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.668, 0.365, 0.018, 0.085, roseOuter, roseCore);

        for (let w = 0; w < 4; w++) {
            const wx = 0.390 + w * 0.036;
            const flicker = Math.sin(time * 8 + w * 1.7) > 0.05;
            const wOuter = flicker ? COLOR.orange : COLOR.rust;
            const wCore = beatPulse > 0.5 ? COLOR.white : (flicker ? COLOR.gold : COLOR.orange);
            this.drawSlenderWindow(ctx, width, height, castleX, castleY, castleWidth, castleHeight, wx, 0.435, 0.016, 0.065, wOuter, wCore);
        }

        for (let tier = 0; tier < 3; tier++) {
            const wy = 0.41 + tier * 0.095;
            const flicker = Math.sin(time * 9 + tier * 2.3) > 0.1;
            const wOuter = flicker ? COLOR.orange : COLOR.rust;
            const wCore = beatPulse > 0.5 ? COLOR.white : COLOR.gold;
            this.drawSlenderWindow(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.218, wy, 0.016, 0.052, wOuter, wCore);
            this.drawSlenderWindow(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.763, wy + 0.035, 0.016, 0.052, wOuter, wCore);
        }
        this.drawSlenderWindow(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.135, 0.59, 0.012, 0.045, COLOR.rust, COLOR.gold);
        this.drawSlenderWindow(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.845, 0.59, 0.012, 0.045, COLOR.rust, COLOR.gold);

        // Foreground Twin-Drum Gatehouse Barbican
        this.drawPixelTower(
            ctx, width, height, castleX, castleY, castleWidth, castleHeight,
            0.392, 0.56, 0.062, 0.21, 0, 3, leftRim, rightRim, rightSkyContour, false
        );
        this.drawPixelTower(
            ctx, width, height, castleX, castleY, castleWidth, castleHeight,
            0.506, 0.56, 0.062, 0.21, 0, 3, leftRim, rightRim, rightSkyContour, false
        );
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.448, 0.57, 0.064, 0.20, COLOR.stone);
        this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, 0.448, 0.56, 0.064, 0.012, leftRim);

        const gateCx = Math.floor(castleX + 0.480 * castleWidth);
        const gateHW = Math.max(3, Math.floor(0.024 * castleWidth));
        const gateTop = Math.floor(castleY + 0.645 * castleHeight);
        const gateH = Math.max(4, Math.floor(0.125 * castleHeight));
        this.rect(ctx, width, height, gateCx - gateHW - px, gateTop, (gateHW + px) * 2, gateH, COLOR.black);
        this.rect(ctx, width, height, gateCx - gateHW + px, gateTop - px * 2, (gateHW - px) * 2, px * 2, COLOR.black);
        this.rect(ctx, width, height, gateCx - gateHW + px, gateTop + px, (gateHW - px) * 2, gateH - px, COLOR.rust);
        this.rect(ctx, width, height, gateCx - Math.floor(gateHW * 0.6), gateTop + px * 2, Math.floor(gateHW * 1.2), gateH - px * 2, beatPulse > 0.4 ? COLOR.gold : COLOR.orange);
        this.rect(ctx, width, height, gateCx - Math.floor(gateHW * 0.4), gateTop + px, 1, gateH - px * 2, COLOR.castle);
        this.rect(ctx, width, height, gateCx + Math.floor(gateHW * 0.35), gateTop + px, 1, gateH - px * 2, COLOR.castle);
        this.rect(ctx, width, height, gateCx - gateHW + px, gateTop + Math.floor(gateH * 0.38), (gateHW - px) * 2, 1, COLOR.castle);

        const flameBoost = beatPulse * 0.015;
        const flameH = 0.020 + flameBoost + Math.sin(time * 13) * 0.004;
        const tipCol = this.heavyPulse > 0.35 ? COLOR.cyan : COLOR.white;
        const midFlameCol = beatPulse > 0.45 ? COLOR.gold : COLOR.orange;
        const beacons = [
            [0.140, 0.515],
            [0.420, 0.535],
            [0.534, 0.535],
            [0.850, 0.515]
        ];
        for (let b = 0; b < beacons.length; b++) {
            const [bx, by] = beacons[b];
            this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, bx - 0.004, by - flameH * 0.45, 0.012, flameH * 0.45, COLOR.rust);
            this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, bx - 0.002, by - flameH * 0.80, 0.008, flameH * 0.55, midFlameCol);
            this.scaledRect(ctx, width, height, castleX, castleY, castleWidth, castleHeight, bx, by - flameH, 0.004, flameH * 0.35, tipCol);
        }
    }

    drawHills(ctx, width, height, baseline, time, tension) {
        const step = Math.max(1, Math.ceil(width / 360));
        const lakeTop = Math.floor(baseline - height * 0.005);
        const lakeBottom = Math.min(height, Math.floor(baseline + height * 0.145));

        // 1. Flanking Forested Valley Slopes
        for (let x = 0; x < width; x += step) {
            const nx = x / Math.max(1, width);
            const valleyMask = nx < 0.32
                ? Math.cos((nx / 0.32) * (Math.PI * 0.5))
                : (nx > 0.70 ? Math.sin(((nx - 0.70) / 0.30) * (Math.PI * 0.5)) : 0);

            const hillUndulation = Math.sin(nx * Math.PI * 5 + 1.2) * height * 0.018;
            const slopeY = Math.floor(baseline + height * 0.01 - valleyMask * height * 0.105 + hillUndulation);

            this.rect(ctx, width, height, x, slopeY, step, height - slopeY, COLOR.farHill);
            this.rect(ctx, width, height, x, slopeY + 3, step, height - slopeY, COLOR.midHill);

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

        // 2. Organic Winding Highland Loch / Mountain Lake
        if (lakeBottom > lakeTop + 2) {
            for (let wy = lakeTop; wy < lakeBottom; wy++) {
                const depth = (wy - lakeTop) / Math.max(1, lakeBottom - lakeTop);

                let leftShoreRatio = 0.10
                    - Math.sin(depth * Math.PI * 1.35) * 0.065
                    + Math.sin(depth * Math.PI * 3.8 + 0.6) * 0.045;
                let rightShoreRatio = 0.86
                    - depth * 0.07
                    - Math.sin(depth * Math.PI * 2.6 + 0.4) * 0.065
                    + Math.cos(depth * Math.PI * 4.2) * 0.030;

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

                this.rect(ctx, width, height, lakeLeft, wy, spanW, 1, COLOR.black);
                if ((wy & 1) === 0) {
                    const waterTone = depth < 0.35 ? COLOR.deepSky : (depth < 0.72 ? COLOR.blueSky : COLOR.indigo);
                    this.rect(ctx, width, height, lakeLeft + 4, wy, Math.max(2, spanW - 8), 1, waterTone);
                }

                // Shimmering Moon Reflection Path
                const moonCenterX = Math.floor(width * 0.20 + bplShift * 1.3);
                const moonRippleW = Math.max(2, Math.floor(width * (0.025 + depth * 0.035) * (0.7 + 0.3 * Math.sin(wy * 1.3 + time * 4))));
                if (moonCenterX > lakeLeft + 4 && moonCenterX + moonRippleW < lakeRight - 4) {
                    const mCol = tension > 0.74
                        ? ((wy & 1) ? COLOR.orange : COLOR.rust)
                        : ((wy & 1) ? COLOR.moon : COLOR.silver);
                    this.rect(ctx, width, height, moonCenterX - Math.floor(moonRippleW * 0.5), wy, moonRippleW, 1, mCol);
                }

                // Reflected Castle Towers & Warm Window Shimmers
                if (depth < 0.78) {
                    const donjonRefX = Math.floor(width * 0.61 + bplShift);
                    const palasRefX = Math.floor(width * 0.46 - bplShift * 0.8);
                    const westRefX = Math.floor(width * 0.27 + bplShift * 0.6);

                    if ((wy & 1) === 1) {
                        this.rect(ctx, width, height, donjonRefX, wy, Math.floor(width * 0.08), 1, COLOR.castle);
                        this.rect(ctx, width, height, palasRefX, wy, Math.floor(width * 0.07), 1, COLOR.castle);
                    }
                    if ((wy % 3) === 0) {
                        const winRefCol = this.heavyPulse > 0.35 ? COLOR.cyan : COLOR.orange;
                        this.rect(ctx, width, height, donjonRefX + Math.floor(width * 0.025), wy, Math.max(2, Math.floor(width * 0.022)), 1, winRefCol);
                        this.rect(ctx, width, height, palasRefX + Math.floor(width * 0.02), wy, Math.max(2, Math.floor(width * 0.025)), 1, COLOR.gold);
                        if (westRefX > lakeLeft + 6) {
                            this.rect(ctx, width, height, westRefX, wy, Math.max(2, Math.floor(width * 0.015)), 1, COLOR.orange);
                        }
                    }
                }

                // Active Firework Reflection Ripples
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

                if (this.lightningTimer > 0) {
                    const flashEnv = lightningEnvelope(this.lightningTimer);
                    if (flashEnv > 0.28 && ((wy + (this.lightningSeed | 0)) % 3 === 0)) {
                        let boltDrift = boltHash(this.lightningSeed | 0, 3) * width * 0.13;
                        if (this.lightningX < 0.15 && boltDrift > 0) boltDrift = -Math.abs(boltDrift) * 0.55;
                        const boltRefX = Math.floor(this.lightningX * width + boltDrift * 0.7 + bplShift * 1.8);
                        const ripple = Math.sin(wy * 1.9 + this.lightningSeed);
                        if (ripple > -0.2) {
                            const refW = Math.max(1, Math.floor(width * (0.008 + depth * 0.016) * flashEnv * (0.5 + 0.5 * ripple)));
                            if (boltRefX > lakeLeft + 4 && boltRefX + refW < lakeRight - 4) {
                                const refCol = flashEnv < 0.65 ? COLOR.blue : COLOR.cyan;
                                this.rect(ctx, width, height, boltRefX - Math.floor(refW * 0.5), wy, refW, 1, refCol);
                                if (flashEnv > 0.72 && refW >= 3 && (wy & 3) === 0) {
                                    const coreW = Math.max(1, Math.floor(refW * 0.35));
                                    this.rect(ctx, width, height, boltRefX - Math.floor(coreW * 0.5), wy, coreW, 1, COLOR.silver);
                                }
                            }
                        }
                    }
                }

                // Organic Shoreline Banks & Water-Edge Ripples
                const bankW = Math.max(3, Math.floor(width * (0.022 + depth * 0.025)));
                this.rect(ctx, width, height, lakeLeft - bankW, wy, bankW, 1, (wy & 1) ? COLOR.stone : COLOR.castle);
                this.rect(ctx, width, height, lakeLeft, wy, Math.max(2, Math.floor(bankW * 0.35)), 1, COLOR.copperBlue);
                this.rect(ctx, width, height, lakeRight - Math.max(2, Math.floor(bankW * 0.35)), wy, Math.max(2, Math.floor(bankW * 0.35)), 1, COLOR.indigo);
                this.rect(ctx, width, height, lakeRight, wy, bankW, 1, (wy & 1) ? COLOR.castle : COLOR.black);
            }
        }

        // 3. Organic Tapered Pine-Clad Peninsulas jutting into the Loch
        const leftPenY = Math.floor(lakeTop + (lakeBottom - lakeTop) * 0.46);
        const leftPenW = Math.floor(width * 0.165);
        for (let x = 0; x < leftPenW; x += step) {
            const pt = 1 - x / Math.max(1, leftPenW);
            const penH = Math.max(1, Math.floor(height * 0.024 * Math.pow(pt, 0.75)));
            this.rect(ctx, width, height, x, leftPenY - penH, step, penH + 2, COLOR.black);
            this.rect(ctx, width, height, x, leftPenY - penH, step, 1, COLOR.stone);
            if (pt > 0.22 && (Math.floor(x / (step * 4)) & 1) === 0) {
                const pineH = Math.floor(height * 0.028 * pt);
                this.rect(ctx, width, height, x, leftPenY - penH - pineH, Math.max(1, step), pineH, COLOR.black);
                this.rect(ctx, width, height, x - 1, leftPenY - penH - Math.floor(pineH * 0.55), step + 2, Math.floor(pineH * 0.55), COLOR.castle);
            }
        }

        const rightPenY = Math.floor(lakeTop + (lakeBottom - lakeTop) * 0.35);
        const rightPenStart = Math.floor(width * 0.81);
        for (let x = rightPenStart; x < width; x += step) {
            const pt = (x - rightPenStart) / Math.max(1, width - rightPenStart);
            const penH = Math.max(1, Math.floor(height * 0.026 * Math.pow(pt, 0.75)));
            this.rect(ctx, width, height, x, rightPenY - penH, step, penH + 2, COLOR.black);
            this.rect(ctx, width, height, x, rightPenY - penH, step, 1, COLOR.castle);
            if (pt > 0.20 && (Math.floor(x / (step * 4)) & 1) === 1) {
                const pineH = Math.floor(height * 0.026 * pt);
                this.rect(ctx, width, height, x, rightPenY - penH - pineH, Math.max(1, step), pineH, COLOR.black);
            }
        }

        // 4. Foreground Repoussoir Framing Slopes
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

        // 1. Continuous Scanline-Sculpted Multi-Arch Stone Viaduct spanning the Loch
        if (lakeEndY > startY + 4) {
            const bridgeSpan = lakeEndY - startY;
            for (let wy = startY; wy < lakeEndY; wy += rowStep) {
                const bProg = (wy - startY) / Math.max(1, bridgeSpan);
                const depth = (wy - startY) / Math.max(1, height - startY);
                const sCurve = Math.sin(depth * Math.PI * 1.85 - 0.35) * maxWidth * 0.38;
                const roadW = Math.max(3, Math.floor(maxWidth * (0.18 + Math.pow(depth, 1.1) * 0.82)));
                const center = Math.floor(width * 0.48 + sCurve);

                // Stone viaduct substructure extending down beneath the right/outer curve into the lake
                const wallDrop = Math.max(3, Math.floor(height * 0.028 * Math.sin(bProg * Math.PI)));
                const wallLeft = Math.floor(center - roadW * 0.56);
                const wallW = Math.floor(roadW * 1.12);

                this.rect(ctx, width, height, wallLeft, wy, wallW, wallDrop, COLOR.stone);
                this.rect(ctx, width, height, wallLeft, wy, Math.max(1, Math.floor(wallW * 0.22)), wallDrop, COLOR.stoneLight);
                this.rect(ctx, width, height, wallLeft + Math.floor(wallW * 0.78), wy, Math.max(1, Math.floor(wallW * 0.22)), wallDrop, COLOR.castle);

                // Carve 4 crisp rounded arches out of the viaduct wall showing shimmering water underneath
                const archPhase = (bProg * 4) % 1;
                if (archPhase > 0.18 && archPhase < 0.82) {
                    const archNorm = (archPhase - 0.18) / 0.64;
                    const archOpenH = Math.floor(wallDrop * 0.72 * Math.sin(archNorm * Math.PI));
                    if (archOpenH >= 2) {
                        const openY = wy + wallDrop - archOpenH;
                        const openX = wallLeft + Math.floor(wallW * 0.24);
                        const openW = Math.max(2, Math.floor(wallW * 0.52));
                        this.rect(ctx, width, height, openX, openY, openW, archOpenH, COLOR.black);
                        this.rect(ctx, width, height, openX, openY + archOpenH - 1, openW, 1, COLOR.copperBlue);
                    }
                }
            }
        }

        // 2. Graceful S-Curve Cobblestone Causeway & Crenellated Parapet Curbs
        for (let y = Math.max(0, startY); y < height; y += rowStep) {
            const depth = (y - startY) / Math.max(1, height - startY);
            const sCurve = Math.sin(depth * Math.PI * 1.85 - 0.35) * maxWidth * 0.38;
            const pathWidth = Math.max(2, Math.floor(maxWidth * (0.18 + Math.pow(depth, 1.1) * 0.82)));
            const center = Math.floor(width * 0.48 + sCurve);
            const leftEdge = Math.floor(center - pathWidth / 2);
            const curbW = Math.max(1, Math.floor(pathWidth * 0.10));

            const courseIdx = Math.floor((y - startY) / (rowStep * 2));
            const isMerlon = (courseIdx & 1) === 0;
            this.rect(ctx, width, height, leftEdge - curbW, y, curbW, rowStep, isMerlon ? COLOR.silver : COLOR.stoneLight);
            this.rect(ctx, width, height, leftEdge + pathWidth, y, curbW, rowStep, isMerlon ? COLOR.stone : COLOR.castle);

            const baseStoneCol = isMerlon ? COLOR.stone : COLOR.castle;
            this.rect(ctx, width, height, leftEdge, y, pathWidth, rowStep, baseStoneCol);

            if (pathWidth >= 8) {
                const stones = 4;
                const stoneW = Math.floor(pathWidth / stones);
                const stagger = isMerlon ? 0 : Math.floor(stoneW * 0.45);
                for (let s = 0; s < stones; s++) {
                    const sx = leftEdge + s * stoneW + stagger;
                    if (sx + stoneW * 0.72 < leftEdge + pathWidth) {
                        const cobbleCol = s === 0 ? COLOR.stoneLight : (s === stones - 1 ? COLOR.midHill : COLOR.stone);
                        this.rect(ctx, width, height, sx, y, Math.max(1, Math.floor(stoneW * 0.70)), rowStep, cobbleCol);
                    }
                }
            }

            if (depth < 0.11) {
                const plankCol = isMerlon ? COLOR.rust : COLOR.blood;
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

                const poolW = Math.max(2, Math.floor(3 + depth * 4 + beatPulse * 2));
                const poolX = side < 0 ? torchX + 2 : torchX - poolW - 1;
                this.rect(ctx, width, height, poolX, y, poolW, Math.max(1, rowStep), COLOR.rust);
                if (beatPulse > 0.35) {
                    this.rect(ctx, width, height, poolX + 1, y, Math.max(1, poolW - 2), 1, COLOR.orange);
                }

                this.rect(ctx, width, height, torchX, y - postH, 2, postH + 1, COLOR.black);
                this.rect(ctx, width, height, torchX - 1, y - postH - 1, 4, 1, COLOR.stoneLight);

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
                    this.lightningTimer = LIGHTNING_DURATION;
                    const rawSlot = ((beatIndex * 73 + 19) % 76) / 100;
                    this.lightningX = rawSlot < 0.09
                        ? 0.06 + rawSlot
                        : 0.28 + ((rawSlot - 0.09) / 0.67) * 0.64;
                    this.lightningSeed = beatIndex;
                }
            }
        }
        this.lastBeatEvent = beatStarted;

        const beatImpulse = Number.isFinite(metrics?.beatImpulse?.[0])
            ? clamp(metrics.beatImpulse[0], 0, 1)
            : this.beatPulse;

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