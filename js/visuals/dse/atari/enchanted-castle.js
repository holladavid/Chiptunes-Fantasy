// === js/visuals/dse/atari/enchanted-castle.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: ATARI ENCHANTED CASTLE (Background DSE)
// Roman Polanski's "Tanz der Vampire" × Caspar David Friedrich
// Dense Atari ST 16-Color 9-Bit Shifter Pixel-Art Masterpiece:
// - Authentic 9-bit Winter Gothic Palette (16 quantized Shifter colors:
//   Prussian night blues, glacial snow shadows, crisp moonlit snows, dark
//   alpine spruce, weathered granite, warm candle gold, vampiric crimson,
//   spectral frost cyan & occult amethyst).
// - True Film Proportions & Pixel-Art Detail Density:
//   * High-perched multi-volume Vampire Fortress on a sculpted 3D snow knoll
//     (corbelled west bartizan, needle stair-turret, weathered ashlar gatehouse
//     with corner quoins, postern door, gothic portcullis, icicles & dormer,
//     Bayer-shaded cylindrical bastion tower with roof-dormer & lone candle,
//     soaring keep with smoking chimney, and stepped east watchtower).
//   * Asymmetric Dolomite rock needles with snow couloirs (left) & glaciated
//     Carpathian massifs (right), valley mist & alpine pine groves.
//   * Steep snow hill with rustic timber snow-fence, sunken ravine footbridge,
//     two tiny vampire-hunter silhouettes with lantern & footprints in snow,
//     and tufted snow-laden foreground spruces (strictly honoring y = 0.55*h).
// - Full Musical DSE Choreography & Hardware Compliance:
//   * Zero-GC, deterministic LUTs/PRNG, DOM-free native Bayer 4x4 fades,
//     no globalAlpha, no strobe wipes, integer-clipped fillRect only.
//   * Graded beats: 1=Frost Wisps, 2=Rocket Fireworks + Bat Surge,
//     3=Double-Ring Supernova Firework + Forked Lightning Strike on Spires.
// =========================================================

import {
    quantizeAtari9Bit,
    rgbToHex
} from '../../utils/hardware-constraints.js';

// --- STRICT 16-COLOR ATARI ST 9-BIT WINTER GOTHIC SHIFTER PALETTE ---
// Every channel uses exact 3-bit Shifter steps (0, 36, 72, 108, 144, 180, 216, 252),
// bit-identically preserved under quantizeAtari9Bit(r, g, b).
export const ATARI_ENCHANTED_CASTLE_PALETTE = Object.freeze([
    rgbToHex(...quantizeAtari9Bit(0, 0, 0)),        // 0: Pitch Black (Void, Portcullis, Coats, Spruce Core)
    rgbToHex(...quantizeAtari9Bit(0, 0, 36)),       // 1: Prussian Night Zenith (Upper Winter Sky / Trench)
    rgbToHex(...quantizeAtari9Bit(0, 36, 72)),      // 2: Deep Carpathian Cobalt (Mid Sky / Dolomite Rock)
    rgbToHex(...quantizeAtari9Bit(36, 72, 108)),    // 3: Twilight Horizon Slate (Low Sky / Deep Snow Shade)
    rgbToHex(...quantizeAtari9Bit(72, 108, 144)),   // 4: Glacial Shadow Blue (Cast Shadows / Shaded Slopes)
    rgbToHex(...quantizeAtari9Bit(108, 144, 180)),  // 5: Shaded Snow Drift (Valley Mist / Midtone Snow)
    rgbToHex(...quantizeAtari9Bit(36, 36, 36)),     // 6: Charcoal Basalt (Dark Stonework / Timber Beams)
    rgbToHex(...quantizeAtari9Bit(72, 72, 72)),     // 7: Weathered Ashlar Masonry (Granite Blocks & Plaster)
    rgbToHex(...quantizeAtari9Bit(108, 108, 144)),  // 8: Moonlit Stone Quoin (Cold Rim / Castle Mortar)
    rgbToHex(...quantizeAtari9Bit(0, 36, 36)),      // 9: Dark Alpine Spruce (Deep Cold Evergreen Needles)
    rgbToHex(...quantizeAtari9Bit(180, 216, 252)),  // 10: Crisp Moonlit Snow (Snowfields, Moon Disc, Icicles)
    rgbToHex(...quantizeAtari9Bit(252, 252, 252)),  // 11: Fresh Snowcrest White (Moon Limb, Lightning, Snow)
    rgbToHex(...quantizeAtari9Bit(252, 180, 36)),   // 12: Warm Tallow Candle Gold (Windows, Lantern, Sparks)
    rgbToHex(...quantizeAtari9Bit(216, 0, 36)),     // 13: Vampiric Blood Crimson (Blood Moon, Rose Glass, Red)
    rgbToHex(...quantizeAtari9Bit(72, 216, 216)),   // 14: Spectral Frost Cyan (Aurora, Wisps, Lightning Glow)
    rgbToHex(...quantizeAtari9Bit(144, 0, 108))     // 15: Dark Eldritch Amethyst (Occult Glow, Violet Bursts)
]);

// API-compatible PAL keys mapped to our 16 Atari ST Shifter indices
export const PAL = Object.freeze({
    black: 0,
    midnightViolet: 1,
    deepBlue: 2,
    horizonBlue: 3,
    farMountain: 4,
    midMountain: 5,
    castleShadow: 6,
    castleStone: 7,
    castleLight: 8,
    foregroundDark: 9,
    moonSilver: 10,
    white: 11,
    magicGold: 12,
    emberOrange: 13,
    mysticCyan: 14,
    sorceryMagenta: 15
});

export const MAX_MAGIC_BURSTS = 6;
export const MAX_PARTICLES_PER_BURST = 32;
const MAX_SNOWFLAKES = 80;

// Floor-DSE Horizon Contract (0.55) & Castle Summit Proportion
const FLOOR_HORIZON_RATIO = 0.55;
const CASTLE_SUMMIT_RATIO = 0.47;
const MOUNTAIN_BASE_RATIO = 0.52;

// Native 4x4 Ordered Bayer Dither Matrix (DOM-free)
const BAYER_4X4 = Object.freeze([
     0,  8,  2, 10,
    12,  4, 14,  6,
     3, 11,  1,  9,
    15,  7, 13,  5
]);

// High-resolution 512-entry Ridge & Masonry LUTs (Zero per-frame trig!)
const RIDGE_LUT_SIZE = 512;
const MASONRY_LUT_DIM = 64;

// Left: Jagged South-Tyrolean Dolomite spires (Langkofel/Geisler); Right: Broad snow-mantled Carpathians
const FAR_PEAKS = Object.freeze([
    Object.freeze({ pos: 0.03, height: 0.76, leftSlope: 9.5, rightSlope: 7.5, dolomite: true }),
    Object.freeze({ pos: 0.09, height: 0.96, leftSlope: 8.8, rightSlope: 7.2, dolomite: true }),
    Object.freeze({ pos: 0.15, height: 1.00, leftSlope: 9.2, rightSlope: 6.4, dolomite: true }),
    Object.freeze({ pos: 0.22, height: 0.84, leftSlope: 8.4, rightSlope: 6.8, dolomite: true }),
    Object.freeze({ pos: 0.28, height: 0.54, leftSlope: 7.5, rightSlope: 6.8, dolomite: true }),
    Object.freeze({ pos: 0.73, height: 0.56, leftSlope: 4.2, rightSlope: 3.8, dolomite: false }),
    Object.freeze({ pos: 0.84, height: 0.74, leftSlope: 3.8, rightSlope: 3.6, dolomite: false }),
    Object.freeze({ pos: 0.95, height: 0.68, leftSlope: 4.0, rightSlope: 4.6, dolomite: false })
]);

// Sweeping alpine snow aprons & foothills flanking the valley
const MID_PEAKS = Object.freeze([
    Object.freeze({ pos: 0.05, height: 0.74, leftSlope: 3.8, rightSlope: 3.1 }),
    Object.freeze({ pos: 0.19, height: 0.88, leftSlope: 3.5, rightSlope: 3.0 }),
    Object.freeze({ pos: 0.31, height: 0.54, leftSlope: 4.2, rightSlope: 4.4 }),
    Object.freeze({ pos: 0.71, height: 0.62, leftSlope: 3.8, rightSlope: 3.2 }),
    Object.freeze({ pos: 0.86, height: 0.84, leftSlope: 3.2, rightSlope: 3.0 }),
    Object.freeze({ pos: 0.97, height: 0.70, leftSlope: 3.6, rightSlope: 4.0 })
]);

// Mid-valley pine grove placements (normalized xRatio, yOffset below mountain base, scale)
const VALLEY_PINE_GROVES = Object.freeze([
    // Left alpine meadow pine clusters (like left midground in the film!)
    Object.freeze({ x: 0.03, yFrac: 0.20, scale: 0.85 }),
    Object.freeze({ x: 0.06, yFrac: 0.25, scale: 1.05 }),
    Object.freeze({ x: 0.09, yFrac: 0.22, scale: 0.78 }),
    Object.freeze({ x: 0.13, yFrac: 0.14, scale: 0.70 }),
    Object.freeze({ x: 0.16, yFrac: 0.17, scale: 0.82 }),
    Object.freeze({ x: 0.18, yFrac: 0.28, scale: 0.95 }),
    Object.freeze({ x: 0.22, yFrac: 0.24, scale: 0.75 }),
    Object.freeze({ x: 0.04, yFrac: 0.42, scale: 1.30 }),
    Object.freeze({ x: 0.08, yFrac: 0.46, scale: 1.45 }),
    Object.freeze({ x: 0.12, yFrac: 0.40, scale: 1.15 }),
    // Right valley distant spruce clusters
    Object.freeze({ x: 0.75, yFrac: 0.16, scale: 0.72 }),
    Object.freeze({ x: 0.79, yFrac: 0.21, scale: 0.88 }),
    Object.freeze({ x: 0.85, yFrac: 0.18, scale: 0.76 }),
    Object.freeze({ x: 0.89, yFrac: 0.26, scale: 1.00 }),
    Object.freeze({ x: 0.93, yFrac: 0.23, scale: 0.90 }),
    Object.freeze({ x: 0.96, yFrac: 0.32, scale: 1.15 })
]);

// Deterministic bat swarm flight seeds (Zero-GC)
const BAT_SEEDS = Object.freeze([
    Object.freeze({ phase: 0.0, speed: 0.11, yBase: 0.34, amp: 0.05 }),
    Object.freeze({ phase: 1.3, speed: 0.14, yBase: 0.26, amp: 0.06 }),
    Object.freeze({ phase: 2.7, speed: 0.09, yBase: 0.19, amp: 0.04 }),
    Object.freeze({ phase: 4.1, speed: 0.13, yBase: 0.29, amp: 0.07 }),
    Object.freeze({ phase: 5.2, speed: 0.16, yBase: 0.16, amp: 0.05 }),
    Object.freeze({ phase: 3.4, speed: 0.12, yBase: 0.23, amp: 0.06 })
]);

export class AtariEnchantedCastle {
    constructor() {
        this.name = 'Atari Enchanted Castle';
        this.lastT = 0;
        this.internalT = 0;
        this.lastBeatCount = -1;
        this.burstCursor = 0;
        this.lastState = 'idle';
        this.stateAge = 0;

        // Smooth internal DSE envelopes
        this.beatEnv = 0;
        this.hardBeatEnv = 0;
        this.lightningEnv = 0;
        this.batSwarmEnv = 0;
        this.lightningSlot = 0;

        // Deterministic PRNG state (Xorshift32)
        this.rngSeed = 0x5A17C93B;

        // Pre-allocated bounded burst pool (Zero-GC)
        this.bursts = Array.from({ length: MAX_MAGIC_BURSTS }, () => ({
            active: false,
            xRatio: 0.5,
            yRatio: 0.20,
            originSlot: 0,
            startTime: -100,
            duration: 0.9,
            radiusFactor: 1.0,
            strength: 0,
            beatLevel: 1,
            particleCount: 16,
            pattern: 0,
            color: PAL.mysticCyan,
            secondaryColor: PAL.sorceryMagenta,
            particles: Array.from({ length: MAX_PARTICLES_PER_BURST }, () => ({
                dx: 0,
                dy: 0,
                ring: 1,
                size: 1
            }))
        }));

        // Pre-allocated normalized winter snowfall pool (Zero-GC, rotation-safe)
        this.snowflakes = Array.from({ length: MAX_SNOWFLAKES }, () => ({
            xRatio: 0,
            yRatio: 0,
            speed: 0.05,
            driftFreq: 1.5,
            phase: 0,
            layer: 0
        }));
        this.initSnowflakes();

        // Crisp cold winter stars
        this.stars = [
            { x: 0.04, y: 0.06, phase: 0.2, mag: 1 },
            { x: 0.11, y: 0.13, phase: 1.7, mag: 1 },
            { x: 0.23, y: 0.05, phase: 2.9, mag: 2 },
            { x: 0.32, y: 0.11, phase: 4.1, mag: 1 },
            { x: 0.40, y: 0.16, phase: 0.8, mag: 1 },
            { x: 0.59, y: 0.07, phase: 3.3, mag: 2 },
            { x: 0.66, y: 0.15, phase: 1.9, mag: 1 },
            { x: 0.74, y: 0.08, phase: 5.2, mag: 1 },
            { x: 0.83, y: 0.05, phase: 2.4, mag: 2 },
            { x: 0.90, y: 0.19, phase: 0.5, mag: 1 },
            { x: 0.96, y: 0.11, phase: 3.9, mag: 1 },
            { x: 0.79, y: 0.25, phase: 2.6, mag: 1 },
            { x: 0.36, y: 0.04, phase: 4.8, mag: 1 },
            { x: 0.69, y: 0.24, phase: 1.1, mag: 1 }
        ];

        // Sculpted nocturnal winter clouds
        this.clouds = [
            { yRatio: 0.17, speed: 0.009, spanRatio: 0.26, initX: 0.08 },
            { yRatio: 0.28, speed: -0.007, spanRatio: 0.30, initX: 0.66 },
            { yRatio: 0.38, speed: 0.006, spanRatio: 0.22, initX: 0.28 }
        ];

        // Pre-baked 68000-style Ridge, Couloir, Masonry & Spruce Tuft LUTs
        this.farElevLUT = new Float32Array(RIDGE_LUT_SIZE);
        this.farRimLUT = new Float32Array(RIDGE_LUT_SIZE);
        this.farFaceLUT = new Uint8Array(RIDGE_LUT_SIZE);
        this.farDolomiteLUT = new Uint8Array(RIDGE_LUT_SIZE);

        this.midElevLUT = new Float32Array(RIDGE_LUT_SIZE);
        this.midRimLUT = new Float32Array(RIDGE_LUT_SIZE);
        this.midFaceLUT = new Uint8Array(RIDGE_LUT_SIZE);

        this.masonryLUT = new Uint8Array(MASONRY_LUT_DIM * MASONRY_LUT_DIM);
        this.spruceTuftLUT = new Uint8Array(64);

        this.bakeFarRidgeLUT();
        this.bakeMidRidgeLUT();
        this.bakeMasonryAndTuftLUTs();
    }

    nextRandom() {
        let x = this.rngSeed | 0;
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        this.rngSeed = x >>> 0;
        return this.rngSeed / 4294967296;
    }

    initSnowflakes() {
        this.rngSeed = 0x5A17C93B;
        for (let i = 0; i < MAX_SNOWFLAKES; i++) {
            const sf = this.snowflakes[i];
            sf.xRatio = this.nextRandom();
            sf.yRatio = this.nextRandom();
            sf.layer = i % 3;
            sf.speed = 0.032 + sf.layer * 0.024 + this.nextRandom() * 0.022;
            sf.driftFreq = 1.1 + this.nextRandom() * 1.8;
            sf.phase = this.nextRandom() * Math.PI * 2;
        }
    }

    bakeFarRidgeLUT() {
        for (let idx = 0; idx < RIDGE_LUT_SIZE; idx++) {
            const nx = idx / (RIDGE_LUT_SIZE - 1);
            let bestElevation = 0;
            let isMoonlitFace = false;
            let ridgeProximity = 1.0;
            let isDolomite = false;

            for (let i = 0; i < FAR_PEAKS.length; i++) {
                const p = FAR_PEAKS[i];
                const diff = nx - p.pos;
                const slope = diff < 0 ? p.leftSlope : p.rightSlope;
                const crag = p.dolomite
                    ? (Math.sin(nx * 97.0 + i * 2.1) * 0.055
                        + Math.cos(nx * 47.0 - i * 1.7) * 0.035
                        + Math.sin(nx * 173.0 + i) * 0.022)
                    : (Math.sin(nx * 37.0 + i * 1.5) * 0.028
                        + Math.cos(nx * 19.0 - i * 1.1) * 0.020);
                const elev = Math.max(0, p.height - Math.abs(diff) * slope + crag);

                if (elev > bestElevation) {
                    bestElevation = elev;
                    isMoonlitFace = diff < 0;
                    ridgeProximity = Math.abs(diff) * slope;
                    isDolomite = p.dolomite;
                }
            }

            this.farElevLUT[idx] = Math.min(1.0, bestElevation);
            this.farRimLUT[idx] = isDolomite
                ? Math.max(0.06, 0.22 - ridgeProximity * 0.14)
                : Math.max(0.22, 0.58 - ridgeProximity * 0.22);
            this.farFaceLUT[idx] = isMoonlitFace ? 2 : (ridgeProximity < 0.07 ? 1 : 0);
            this.farDolomiteLUT[idx] = isDolomite ? 1 : 0;
        }
    }

    bakeMidRidgeLUT() {
        for (let idx = 0; idx < RIDGE_LUT_SIZE; idx++) {
            const nx = idx / (RIDGE_LUT_SIZE - 1);
            let bestElevation = 0;
            let isMoonlitFace = false;
            let ridgeProximity = 1.0;

            for (let i = 0; i < MID_PEAKS.length; i++) {
                const p = MID_PEAKS[i];
                const diff = nx - p.pos;
                const slope = diff < 0 ? p.leftSlope : p.rightSlope;
                const crag = Math.sin(nx * 21.0 + i * 1.9) * 0.022
                    + Math.cos(nx * 11.0 - i * 0.8) * 0.015;
                const elev = Math.max(0, p.height - Math.abs(diff) * slope + crag);

                if (elev > bestElevation) {
                    bestElevation = elev;
                    isMoonlitFace = diff < 0;
                    ridgeProximity = Math.abs(diff) * slope;
                }
            }

            this.midElevLUT[idx] = Math.min(1.0, bestElevation);
            this.midRimLUT[idx] = Math.max(0.18, 0.52 - ridgeProximity * 0.18);
            this.midFaceLUT[idx] = isMoonlitFace ? 2 : (ridgeProximity < 0.06 ? 1 : 0);
        }
    }

    // Pre-bakes weathered medieval stone blocks, mortar joints & plaster damage (0..3)
    bakeMasonryAndTuftLUTs() {
        for (let y = 0; y < MASONRY_LUT_DIM; y++) {
            const course = (y >> 2);
            const isHorizMortar = (y & 3) === 0;
            const stagger = (course & 1) * 4;

            for (let x = 0; x < MASONRY_LUT_DIM; x++) {
                const hash = (((x + 11) * 73856093) ^ ((y + 7) * 19349663) ^ (course * 83492791)) >>> 0;
                const patchHash = ((((x >> 2) + 3) * 374761393) ^ (((y >> 2) + 5) * 668265263)) >>> 0;
                const isVertMortar = ((x + stagger) & 7) === 0;

                let val = 1; // 1 = base castleShadow
                if (isHorizMortar || isVertMortar) {
                    // Mortar crevices & occasional frost-rimmed upper stone lips
                    val = (isHorizMortar && ((hash & 7) === 0)) ? 3 : 0;
                } else if ((patchHash % 11) < 4) {
                    // Weathered exposed lighter granite & crumbling plaster patches (like Gatehouse in photo!)
                    val = ((hash & 3) === 0) ? 3 : 2;
                } else if ((hash % 9) === 0) {
                    val = 2;
                } else if ((hash % 13) === 0) {
                    val = 0;
                }
                this.masonryLUT[y * MASONRY_LUT_DIM + x] = val;
            }
        }

        for (let i = 0; i < 64; i++) {
            const h = ((i * 2654435761) >>> 0) % 5;
            this.spruceTuftLUT[i] = h;
        }
    }

    resize(width, height) {}

    // Safe bounded integer rect drawer — guarantees all pixels stay strictly inside [0..width, 0..height]
    rect(ctx, width, height, x, y, rectWidth, rectHeight, colorIndex) {
        if (!Number.isFinite(x) || !Number.isFinite(y) ||
            !Number.isFinite(rectWidth) || !Number.isFinite(rectHeight) ||
            rectWidth <= 0 || rectHeight <= 0) return;

        const left = Math.max(0, Math.floor(x));
        const top = Math.max(0, Math.floor(y));
        const right = Math.min(width, Math.floor(x + rectWidth));
        const bottom = Math.min(height, Math.floor(y + rectHeight));
        if (right <= left || bottom <= top) return;

        ctx.fillStyle = ATARI_ENCHANTED_CASTLE_PALETTE[colorIndex];
        ctx.fillRect(left, top, right - left, bottom - top);
    }

    // Integer-clipped Bresenham span helper routed through rect()
    drawPixelLine(ctx, width, height, x0, y0, x1, y1, thickness, colorIndex) {
        if (!Number.isFinite(x0 + y0 + x1 + y1)) return;
        let ix0 = Math.floor(x0);
        let iy0 = Math.floor(y0);
        const ix1 = Math.floor(x1);
        const iy1 = Math.floor(y1);
        const t = Math.max(1, Math.floor(thickness));

        const dx = Math.abs(ix1 - ix0);
        const dy = Math.abs(iy1 - iy0);
        const sx = ix0 < ix1 ? 1 : -1;
        const sy = iy0 < iy1 ? 1 : -1;
        let err = dx - dy;

        for (let guard = 0; guard < 1024; guard++) {
            this.rect(ctx, width, height, ix0, iy0, t, t, colorIndex);
            if (ix0 === ix1 && iy0 === iy1) break;
            const e2 = err * 2;
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

    // Draws richly textured medieval stonework with span-merging, shadow side & stone corner quoins
    drawTexturedStoneWall(ctx, width, height, wx, wy, ww, wh, leftQuoins, rightQuoins, shadowFrac, seedOffset, px) {
        const x0 = Math.floor(wx);
        const y0 = Math.floor(wy);
        const w = Math.floor(ww);
        const h = Math.floor(wh);
        if (w <= 0 || h <= 0) return;

        const step = Math.max(1, px);
        const litW = Math.max(step, Math.floor(w * (1.0 - shadowFrac)));

        // Base stone & right-hand deep shadow block
        this.rect(ctx, width, height, x0, y0, w, h, PAL.black);
        this.rect(ctx, width, height, x0, y0, litW, h, PAL.castleShadow);

        // Pixel-art ashlar masonry & crumbling plaster texture (merged horizontal runs!)
        if (w >= step * 5 && h >= step * 4) {
            const paletteMap = [PAL.black, PAL.castleShadow, PAL.castleStone, PAL.castleLight];
            for (let dy = 0, ty = seedOffset & 63; dy < h; dy += step, ty = (ty + 1) & 63) {
                const rowY = y0 + dy;
                const rowH = Math.min(step, h - dy);
                const lutRow = ty * MASONRY_LUT_DIM;

                let runColor = -1;
                let runStart = 0;

                for (let dx = 0, tx = (seedOffset * 3) & 63; dx < litW; dx += step, tx = (tx + 1) & 63) {
                    let code = this.masonryLUT[lutRow + tx];
                    // Fade lighter plaster patches near the right shadow terminator
                    if (dx > litW * 0.78 && code >= 2) {
                        code -= 1;
                    }
                    const colIdx = paletteMap[code];

                    if (colIdx === PAL.castleShadow) {
                        if (runColor !== -1) {
                            this.rect(ctx, width, height, x0 + runStart, rowY, dx - runStart, rowH, runColor);
                            runColor = -1;
                        }
                    } else if (colIdx !== runColor) {
                        if (runColor !== -1) {
                            this.rect(ctx, width, height, x0 + runStart, rowY, dx - runStart, rowH, runColor);
                        }
                        runColor = colIdx;
                        runStart = dx;
                    }
                }
                if (runColor !== -1) {
                    this.rect(ctx, width, height, x0 + runStart, rowY, litW - runStart, rowH, runColor);
                }
            }
        }

        // Prominent alternating stone corner quoins (Eckquaderung — signature detail in photo!)
        if (leftQuoins && h >= step * 4) {
            for (let qy = 0, qi = 0; qy < h - step; qy += step * 3, qi++) {
                const qw = (qi & 1) ? step * 3 : step * 2;
                this.rect(ctx, width, height, x0, y0 + qy, Math.min(w, qw), step * 2, PAL.castleLight);
                this.rect(ctx, width, height, x0, y0 + qy, step, step, (qi & 1) ? PAL.moonSilver : PAL.castleLight);
            }
        }
        if (rightQuoins && w >= step * 8 && h >= step * 4) {
            for (let qy = step, qi = 0; qy < h - step; qy += step * 3, qi++) {
                const qw = (qi & 1) ? step * 2 : step * 3;
                this.rect(ctx, width, height, x0 + w - qw, y0 + qy, qw, step * 2, PAL.castleStone);
                this.rect(ctx, width, height, x0 + w - qw, y0 + qy, step, step * 2, PAL.castleShadow);
            }
        }
    }

    // Bayer-dithered cylindrical stone bastion tower with curved mortar joints (for the Round Tower!)
    drawCylindricalTower(ctx, width, height, tx, ty, tw, th, px) {
        const x0 = Math.floor(tx);
        const y0 = Math.floor(ty);
        const w = Math.floor(tw);
        const h = Math.floor(th);
        if (w <= 0 || h <= 0) return;

        const step = Math.max(1, px);
        this.rect(ctx, width, height, x0, y0, w, h, PAL.black);

        const stoneRamp = [PAL.black, PAL.castleShadow, PAL.castleStone, PAL.castleLight, PAL.moonSilver];

        for (let dy = 0, gy = 0; dy < h; dy += step, gy++) {
            const rowY = y0 + dy;
            const rowH = Math.min(step, h - dy);
            const isMortarRow = (gy & 3) === 0;
            const stagger = ((gy >> 2) & 1) * 3;
            const bayerRow = (gy & 3) * 4;

            let runCol = -1;
            let runStart = 0;

            for (let dx = 0, gx = 0; dx < w; dx += step, gx++) {
                const u = dx / Math.max(1, w - 1);
                // Specular moon-highlight near u=0.14, smooth cylindrical roll-off into deep black terminator on right
                const angle = Math.min(Math.PI, Math.max(0, (u - 0.08) * 2.55));
                let light = Math.max(0, Math.cos(angle * 0.55));
                if (u < 0.08) light = 0.78 + u * 2.2;

                let scaled = light * 3.15;
                if (isMortarRow || ((gx + stagger) % 6 === 0 && u < 0.75)) {
                    scaled -= 0.75;
                }
                scaled = Math.max(0, Math.min(3.6, scaled));

                const baseIdx = Math.floor(scaled);
                const frac = scaled - baseIdx;
                const ditherBump = (BAYER_4X4[bayerRow + (gx & 3)] < Math.floor(frac * 16)) ? 1 : 0;
                const colIdx = stoneRamp[Math.min(4, baseIdx + ditherBump)];

                if (colIdx !== runCol) {
                    if (runCol !== -1 && runCol !== PAL.black) {
                        this.rect(ctx, width, height, x0 + runStart, rowY, dx - runStart, rowH, runCol);
                    }
                    runCol = colIdx;
                    runStart = dx;
                }
            }
            if (runCol !== -1 && runCol !== PAL.black) {
                this.rect(ctx, width, height, x0 + runStart, rowY, w - runStart, rowH, runCol);
            }
        }
    }

    triggerMagic(beatCount, strength, level, tension, state, time) {
        if (state === 'afterglow' || state === 'stopping') return;

        const effectiveLevel = level > 0 ? level : (strength >= 2 / 3 ? 3 : strength >= 1 / 3 ? 2 : 1);
        const slot = (beatCount > 0 ? beatCount : this.burstCursor) % 3;

        this.beatEnv = Math.max(this.beatEnv, strength);
        if (effectiveLevel >= 2) {
            this.batSwarmEnv = Math.min(1.0, Math.max(this.batSwarmEnv, 0.55 + strength * 0.45));
        }
        if (effectiveLevel === 3 || (state === 'climax' && effectiveLevel >= 2)) {
            this.hardBeatEnv = 1.0;
            this.lightningEnv = 1.0;
            this.lightningSlot = slot;
        }

        if (state === 'playing' && strength < 0.15) {
            return;
        }

        const burst = this.bursts[this.burstCursor];
        this.burstCursor = (this.burstCursor + 1) % MAX_MAGIC_BURSTS;

        burst.active = true;
        burst.startTime = time;
        burst.strength = strength;
        burst.beatLevel = effectiveLevel;
        burst.originSlot = slot;

        if (effectiveLevel === 1) {
            burst.radiusFactor = 0.46 + strength * 0.16;
            burst.particleCount = 12;
            burst.duration = 0.68;
            burst.pattern = 0;
            burst.color = PAL.mysticCyan;
            burst.secondaryColor = PAL.moonSilver;
        } else if (effectiveLevel === 2) {
            burst.radiusFactor = 0.80 + strength * 0.22;
            burst.particleCount = 22;
            burst.duration = 0.92;
            burst.pattern = (state === 'climax') ? 2 : 1;
            const paletteCycle = beatCount % 3;
            burst.color = paletteCycle === 0 ? PAL.magicGold : (paletteCycle === 1 ? PAL.emberOrange : PAL.mysticCyan);
            burst.secondaryColor = paletteCycle === 1 ? PAL.sorceryMagenta : PAL.magicGold;
        } else {
            burst.radiusFactor = 1.18 + strength * 0.28;
            burst.particleCount = 32;
            burst.duration = 1.16;
            burst.pattern = 2;
            burst.color = (state === 'climax' || (beatCount & 1)) ? PAL.emberOrange : PAL.magicGold;
            burst.secondaryColor = (beatCount & 1) ? PAL.sorceryMagenta : PAL.mysticCyan;
        }

        if (state === 'climax' || tension > 0.8) {
            burst.radiusFactor += 0.16;
        }

        if (slot === 0) {
            burst.xRatio = 0.50;
            burst.yRatio = 0.12;
        } else if (slot === 1) {
            burst.xRatio = 0.33;
            burst.yRatio = 0.18;
        } else {
            burst.xRatio = 0.69;
            burst.yRatio = 0.16;
        }

        for (let i = 0; i < MAX_PARTICLES_PER_BURST; i++) {
            const isInner = effectiveLevel === 3 && (i & 1) === 1;
            const ringScale = isInner ? 0.56 : 1.0;
            const angle = (i / burst.particleCount) * Math.PI * 2 + (beatCount * 0.42);
            const speed = (0.76 + (((i * 7 + (beatCount > 0 ? beatCount : 1)) % 5) / 5) * 0.48) * ringScale;
            burst.particles[i].dx = Math.cos(angle) * speed;
            burst.particles[i].dy = Math.sin(angle) * speed;
            burst.particles[i].ring = isInner ? 0 : 1;
            burst.particles[i].size = (effectiveLevel === 3 && (i % 4 === 0)) ? 2 : 1;
        }
    }

    // Native DOM-Free Bayer 4x4 Ordered Dither Curtain (starting/stopping)
    drawBayerFadeCurtain(ctx, width, height, alpha, px) {
        if (alpha >= 1.0) return;
        if (alpha <= 0.0) {
            this.rect(ctx, width, height, 0, 0, width, height, PAL.black);
            return;
        }

        const threshold = Math.floor(alpha * 16);
        const step = Math.max(1, px);
        ctx.fillStyle = ATARI_ENCHANTED_CASTLE_PALETTE[PAL.black];

        for (let y = 0, gy = 0; y < height; y += step, gy++) {
            const rowH = Math.min(step, height - y);
            const rowOffset = (gy & 3) * 4;
            for (let x = 0, gx = 0; x < width; x += step, gx++) {
                if (BAYER_4X4[rowOffset + (gx & 3)] >= threshold) {
                    ctx.fillRect(x, y, Math.min(step, width - x), rowH);
                }
            }
        }
    }

    // 4x4 Bayer Atari ST Shifter Sky Gradient Seam
    drawShifterSkyDither(ctx, width, height, centerY, halfSpan, topCol, botCol, px) {
        const step = Math.max(1, px);
        const h = Math.max(step, Math.floor(halfSpan));
        const span = h * 2;
        const stepX4 = step * 4;

        for (let dy = -h; dy < h; dy += step) {
            const y = centerY + dy;
            if (y < 0 || y >= height) continue;

            const frac = (dy + h) / span;
            const threshold = Math.floor(frac * 16);
            const gy = Math.floor(y / step) & 3;
            const rowBase = gy * 4;

            if (dy < 0) {
                for (let c = 0; c < 4; c++) {
                    if (BAYER_4X4[rowBase + c] < threshold) {
                        for (let x = c * step; x < width; x += stepX4) {
                            this.rect(ctx, width, height, x, y, step, step, botCol);
                        }
                    }
                }
            } else {
                for (let c = 0; c < 4; c++) {
                    if (BAYER_4X4[rowBase + c] >= threshold) {
                        for (let x = c * step; x < width; x += stepX4) {
                            this.rect(ctx, width, height, x, y, step, step, topCol);
                        }
                    }
                }
            }
        }
    }

    // Boreal / Vampiric Winter Horizon Aurora Curtain
    drawWinterAurora(ctx, width, height, horizonY, tension, pulse, bloodFactor, px) {
        const step = Math.max(2, px * 2);
        const baseColor = bloodFactor > 0.55 ? PAL.sorceryMagenta : PAL.horizonBlue;
        const crestColor = bloodFactor > 0.55 ? PAL.emberOrange : PAL.mysticCyan;

        for (let x = 0; x < width; x += step * 2) {
            const wave = Math.sin(x * 0.045 + this.internalT * 0.9) * 0.5
                + Math.cos(x * 0.022 - this.internalT * 0.55) * 0.5;
            if (wave < -0.05) continue;

            const curtainH = Math.max(px * 3, Math.floor(horizonY * (0.12 + tension * 0.16 + pulse * 0.06) * (0.5 + wave * 0.5)));
            const topY = Math.max(px * 2, Math.floor(horizonY * 0.30 - curtainH * 0.4 + Math.sin(x * 0.03 + this.internalT) * px * 3));

            this.rect(ctx, width, height, x, topY, px, curtainH, baseColor);
            this.rect(ctx, width, height, x, topY + Math.floor(curtainH * 0.65), px, Math.max(px, Math.floor(curtainH * 0.30)), crestColor);
        }
    }

    // Sculpted Nocturnal Storm Cloud with Terraced Tops & Moonlit Lining
    drawStormWrackCloud(ctx, width, height, cX, cY, cWidth, cHeight, moonX, moonY, bloodFactor, lightningActive, px) {
        const distToMoon = Math.hypot((cX + cWidth * 0.5) - moonX, cY - moonY);
        const nearMoon = distToMoon < cWidth * 0.85;

        const coreH = Math.max(px, Math.floor(cHeight * 0.65));
        const bodyCol = lightningActive ? PAL.horizonBlue : PAL.midnightViolet;

        // Terraced billowy cloud upper silhouette + flat nocturnal base
        this.rect(ctx, width, height, cX, cY, cWidth, coreH, bodyCol);
        this.rect(ctx, width, height, cX + Math.floor(cWidth * 0.15), cY - px, Math.floor(cWidth * 0.55), px, bodyCol);
        this.rect(ctx, width, height, cX - px * 4, cY + px, px * 4, px, PAL.deepBlue);
        this.rect(ctx, width, height, cX + cWidth, cY + px, px * 5, px, PAL.deepBlue);
        this.rect(ctx, width, height, cX + Math.floor(cWidth * 0.12), cY + coreH, Math.floor(cWidth * 0.68), px, PAL.deepBlue);

        const rimCol = bloodFactor > 0.55
            ? PAL.emberOrange
            : (nearMoon ? PAL.moonSilver : PAL.farMountain);
        this.rect(ctx, width, height, cX + Math.floor(cWidth * 0.14), cY - px * 2, Math.floor(cWidth * 0.56), px, rimCol);
        if (nearMoon) {
            this.rect(ctx, width, height, cX + Math.floor(cWidth * 0.24), cY - px * 2, Math.floor(cWidth * 0.32), px, bloodFactor > 0.65 ? PAL.magicGold : PAL.white);
        }
    }

    // Jagged Forked Winter Thunderstorm Lightning striking Castle Spires (Localized Glow, No Strobe!)
    drawForkedLightning(ctx, width, height, targetX, targetY, intensity, isCrimson, px) {
        const segments = 10;
        const startX = targetX + (((Math.floor(this.internalT * 7)) & 1) ? -px * 10 : px * 10);
        let prevX = startX;
        let prevY = 0;

        const glowCol = isCrimson ? PAL.emberOrange : PAL.mysticCyan;

        if (intensity > 0.45) {
            this.rect(ctx, width, height, startX - px * 11, 0, px * 22, px * 3, PAL.horizonBlue);
            this.rect(ctx, width, height, startX - px * 6, 0, px * 12, px * 2, glowCol);
        }

        for (let s = 1; s <= segments; s++) {
            const frac = s / segments;
            const jag = (s < segments)
                ? Math.round(Math.sin(s * 2.7 + this.internalT * 19.0) * px * 5)
                : 0;
            const curX = Math.floor(startX + (targetX - startX) * frac) + jag;
            const curY = Math.floor(targetY * frac);
            const segH = Math.max(px, curY - prevY + px);
            const drawX = Math.floor((prevX + curX) * 0.5);

            if (intensity > 0.42) {
                this.rect(ctx, width, height, drawX - px, prevY, px * 3, segH, glowCol);
            }
            this.rect(ctx, width, height, drawX, prevY, px, segH, PAL.white);

            if ((s === 3 || s === 6) && intensity > 0.35) {
                const branchDir = (s === 3) ? -1 : 1;
                for (let b = 1; b <= 4; b++) {
                    this.rect(
                        ctx, width, height,
                        drawX + branchDir * b * px * 2,
                        prevY + b * px * 2,
                        px, px * 2,
                        b < 3 ? PAL.white : glowCol
                    );
                }
            }

            prevX = curX;
            prevY = curY;
        }
    }

    // Flapping Vampire Bat Silhouettes spiraling out of the Belfry
    drawBatSwarm(ctx, width, height, horizonY, moonX, moonY, tension, px) {
        const activeBats = tension > 0.65 ? BAT_SEEDS.length : (this.batSwarmEnv > 0.2 ? 5 : 3);

        for (let i = 0; i < activeBats; i++) {
            const b = BAT_SEEDS[i];
            const speedMult = 1.0 + tension * 0.8 + this.batSwarmEnv * 0.6;
            const cycle = (this.internalT * b.speed * speedMult + b.phase) % 1.0;

            const bx = Math.floor(width * (0.68 - cycle * 0.62));
            const by = Math.floor(horizonY * (b.yBase + Math.sin(cycle * Math.PI * 4 + b.phase) * b.amp));

            const wingUp = ((Math.floor(this.internalT * 13 + i * 3)) & 1) === 0;
            const nearBrightMoon = Math.hypot(bx - moonX, by - moonY) < width * 0.14;

            this.rect(ctx, width, height, bx, by, px, px, PAL.black);
            const wingY = wingUp ? by - px : by + px;
            this.rect(ctx, width, height, bx - px * 2, wingY, px * 2, px, PAL.black);
            this.rect(ctx, width, height, bx + px, wingY, px * 2, px, PAL.black);

            if (!nearBrightMoon && (tension > 0.7 || this.batSwarmEnv > 0.5)) {
                this.rect(ctx, width, height, bx, by, px, px, PAL.emberOrange);
            }
        }
    }

    // Dolomite Spires with Diagonal Snow Couloirs (left) & Glaciated Carpathians (right)
    drawFarDolomiteAndAlpineRange(ctx, width, height, baseLineY, maxPeakHeight, px) {
        const step = Math.max(1, px);
        const invWidth = (RIDGE_LUT_SIZE - 1) / Math.max(1, width - 1);

        for (let x = 0; x < width; x += step) {
            const idx = Math.min(RIDGE_LUT_SIZE - 1, (x * invWidth) | 0);
            const mHeight = Math.floor(maxPeakHeight * this.farElevLUT[idx]);
            if (mHeight <= 0) continue;

            const topY = baseLineY - mHeight;
            const face = this.farFaceLUT[idx];
            const isDolomite = this.farDolomiteLUT[idx] === 1;

            if (isDolomite) {
                // Sheer jagged South-Tyrolean Dolomite rock faces with vertical fissures & diagonal snow chutes!
                const rockCol = face === 2 ? PAL.horizonBlue : PAL.deepBlue;
                this.rect(ctx, width, height, x, topY, step, mHeight, rockCol);

                // Vertical dark granite rock clefts
                if (((idx * 5) % 11) === 0 && mHeight > px * 8) {
                    this.rect(ctx, width, height, x, topY + px * 3, step, Math.floor(mHeight * 0.65), PAL.midnightViolet);
                }

                // Moonlit snow crest + steep diagonal snow couloirs (Schneerinnen, iconic in photo!)
                const rimH = Math.max(px, Math.floor(mHeight * this.farRimLUT[idx]));
                if (face === 2) {
                    this.rect(ctx, width, height, x, topY, step, rimH, PAL.moonSilver);
                    this.rect(ctx, width, height, x, topY, step, px, PAL.white);
                } else if (face === 1) {
                    this.rect(ctx, width, height, x, topY, step, px * 2, PAL.midMountain);
                }

                // Diagonal snow gully streaking down the rock wall
                const couloirBand = ((idx + Math.floor(mHeight * 0.25)) % 9);
                if (couloirBand <= 1 && mHeight > px * 6) {
                    const chuteY = topY + Math.floor(mHeight * 0.22);
                    const chuteH = Math.floor(mHeight * 0.58);
                    this.rect(ctx, width, height, x, chuteY, step, chuteH, face === 2 ? PAL.moonSilver : PAL.midMountain);
                }
            } else {
                // Right side: Broad snow-mantled glaciated Carpathian massif
                const bodyCol = face === 2 ? PAL.midMountain : PAL.farMountain;
                this.rect(ctx, width, height, x, topY, step, mHeight, bodyCol);
                if (face >= 1) {
                    const snowH = Math.max(px * 2, Math.floor(mHeight * this.farRimLUT[idx]));
                    this.rect(ctx, width, height, x, topY, step, snowH, PAL.moonSilver);
                    this.rect(ctx, width, height, x, topY, step, px * 2, PAL.white);
                }
            }
        }
    }

    // Sweeping Snow Aprons, Foothill Treelines & Valley Mist
    drawMidSnowFoothills(ctx, width, height, baseLineY, maxPeakHeight, px) {
        const step = Math.max(1, px);
        const invWidth = (RIDGE_LUT_SIZE - 1) / Math.max(1, width - 1);
        const mistDrift = Math.floor(this.internalT * 5);
        const mistH = Math.max(px * 2, Math.floor(maxPeakHeight * 0.22));

        for (let x = 0; x < width; x += step) {
            const idx = Math.min(RIDGE_LUT_SIZE - 1, (x * invWidth) | 0);
            const mHeight = Math.floor(maxPeakHeight * this.midElevLUT[idx]);
            if (mHeight <= 0) continue;

            const topY = baseLineY - mHeight;
            const face = this.midFaceLUT[idx];

            this.rect(ctx, width, height, x, topY, step, mHeight, face === 2 ? PAL.midMountain : PAL.farMountain);
            if (face >= 1) {
                const snowH = Math.max(px, Math.floor(mHeight * this.midRimLUT[idx]));
                this.rect(ctx, width, height, x, topY, step, snowH, PAL.moonSilver);
                if (face === 2) {
                    this.rect(ctx, width, height, x, topY, step, px, PAL.white);
                }
            }

            // Dark serrated distant forest treeline tucked into the lower foothill folds (like left & right in photo!)
            if (mHeight > px * 4 && (idx < 145 || idx > 370)) {
                const treeWave = ((idx * 17) % 5) + ((idx & 1) ? 2 : 0);
                const treeH = Math.max(px, Math.min(mHeight - px, px * (2 + (treeWave % 3))));
                const treeBaseY = baseLineY - Math.floor(mHeight * 0.16);
                if (((idx + treeWave) % 3) !== 0 && treeBaseY - treeH > topY + px) {
                    this.rect(ctx, width, height, x, treeBaseY - treeH, step, treeH, PAL.foregroundDark);
                }
            }

            // Soft Bayer-stippled valley mist ribbon
            if (((((x / step) | 0) + mistDrift) & 1) === 0) {
                const mistStart = Math.max(topY + px, baseLineY - mistH);
                if (baseLineY > mistStart) {
                    this.rect(ctx, width, height, x, mistStart, step, baseLineY - mistStart, PAL.moonSilver);
                }
            }
        }
    }

    // Pixel-Detailed Tufted Snow-Laden Alpine Spruce (Drooping Snow Pillows + Dark Needle Clusters)
    drawDetailedSnowSpruce(ctx, width, height, baseX, baseY, treeH, leanDir, windSway, pulse, px) {
        const h = Math.max(8, Math.floor(treeH));
        const step = Math.max(1, px);
        const trunkW = Math.max(step, Math.floor(h * 0.07));
        const trunkH = Math.max(step * 2, Math.floor(h * 0.18));

        // Cast shadow on snow to the right of the spruce base
        this.rect(ctx, width, height, baseX, baseY - step * 2, Math.floor(h * 0.34), step * 2, PAL.farMountain);

        // Dark spruce trunk
        this.rect(ctx, width, height, baseX - Math.floor(trunkW / 2), baseY - trunkH, trunkW, trunkH, PAL.black);

        const tiers = h >= 52 ? 10 : (h >= 30 ? 7 : 5);
        for (let ti = 0; ti < tiers; ti++) {
            const tFrac = ti / Math.max(1, tiers - 1);
            const tierBotY = baseY - Math.floor(h * (0.10 + tFrac * 0.78));
            const tierH = Math.max(step * 3, Math.floor(h * (0.24 - tFrac * 0.11)));
            const halfSpan = Math.max(step * 2, Math.floor(h * (0.33 * (1.0 - tFrac * 0.80))));
            const sway = Math.round(windSway * (0.25 + tFrac * 0.75) * step);
            const cxTier = baseX + sway + leanDir * Math.round(tFrac * step);

            // 1. Dark drooping evergreen needle skirt underneath each bough tier
            for (let row = 0; row < tierH; row += step) {
                const rFrac = row / Math.max(1, tierH - 1);
                const fullW = Math.max(step, Math.floor(halfSpan * 2 * Math.pow(rFrac, 0.82)));
                const jag = (this.spruceTuftLUT[(ti * 7 + ((row / step) | 0)) & 63] & 1) * step;
                const rowX = cxTier - Math.floor(fullW / 2) - jag;
                const rowY = tierBotY - tierH + row;
                const rowH = Math.min(step, tierH - row);

                this.rect(ctx, width, height, rowX, rowY, fullW + jag, rowH, PAL.black);
                this.rect(ctx, width, height, rowX, rowY, Math.max(step, Math.floor(fullW * 0.56)), rowH, PAL.foregroundDark);
            }

            // 2. Tufted snow-clumped pillows resting across the drooping bough fingers!
            const tufts = Math.max(2, Math.min(5, Math.floor(halfSpan / (step * 3)) + 2));
            for (let tf = 0; tf < tufts; tf++) {
                const tfNorm = tufts === 1 ? 0.5 : tf / (tufts - 1); // 0 = left moonlit tip, 1 = right shaded tip
                const spreadW = Math.max(step * 2, Math.floor((halfSpan * 1.65) / tufts));
                const tuftX = cxTier - Math.floor(halfSpan * 0.88) + Math.floor(tfNorm * halfSpan * 1.45);
                const droopY = Math.round(Math.abs(tfNorm - 0.42) * tierH * 0.42)
                    + (this.spruceTuftLUT[(ti * 5 + tf) & 63] % 2) * step;
                const tuftY = tierBotY - Math.floor(tierH * 0.72) + droopY;
                const tuftH = Math.max(step * 2, Math.floor(tierH * 0.42));

                // Right-side tufts sit in cool blue snow shadow; left/center tufts gleam moon-white!
                const underSnowCol = tfNorm > 0.62 ? PAL.farMountain : PAL.midMountain;
                const mainSnowCol = tfNorm > 0.68 ? PAL.midMountain : PAL.moonSilver;

                this.rect(ctx, width, height, tuftX, tuftY, spreadW, tuftH, underSnowCol);
                this.rect(ctx, width, height, tuftX, tuftY, Math.max(step, Math.floor(spreadW * 0.82)), Math.max(step, tuftH - step), mainSnowCol);
                if (tfNorm <= 0.58) {
                    this.rect(ctx, width, height, tuftX, tuftY, Math.max(step, Math.floor(spreadW * 0.60)), step, PAL.white);
                }
                // Ragged dark pine needle tips poking through between snow clumps
                this.rect(ctx, width, height, tuftX + spreadW - step, tuftY + tuftH - step, step, step * 2, PAL.black);
            }

            if (pulse > 0.72 && ti >= 1 && ti <= tiers - 2 && (ti & 1)) {
                this.rect(ctx, width, height, cxTier - halfSpan, tierBotY + step, step, step, PAL.white);
            }
        }

        // Frosted spruce leader tip
        const apexY = baseY - h;
        const apexX = baseX + Math.round(windSway * step) + leanDir * step;
        this.rect(ctx, width, height, apexX, apexY, step, step * 3, PAL.moonSilver);
        this.rect(ctx, width, height, apexX, apexY, step, step * 2, PAL.white);
    }

    // Small Snow-Frosted Alpine Spruce for Mid-Valley Pine Groves
    drawDistantSpruce(ctx, width, height, baseX, baseY, treeH, px) {
        const h = Math.max(4, Math.floor(treeH));
        const step = Math.max(1, px);
        // Tiny blue cast shadow on snow
        this.rect(ctx, width, height, baseX, baseY - step, Math.max(step * 2, Math.floor(h * 0.45)), step, PAL.farMountain);

        for (let r = 0; r < h; r += step) {
            const frac = r / Math.max(1, h - 1);
            const notch = (((r / step) | 0) & 1) ? step : 0;
            const w = Math.max(step, Math.floor(h * 0.62 * frac) + notch);
            const rx = baseX - Math.floor(w / 2);
            const ry = baseY - h + r;
            const rh = Math.min(step, h - r);

            this.rect(ctx, width, height, rx, ry, w, rh, PAL.black);
            this.rect(ctx, width, height, rx, ry, Math.max(step, Math.floor(w * 0.6)), rh, PAL.foregroundDark);
            if (((r / step) | 0) % 2 === 0 && r < h - step) {
                this.rect(ctx, width, height, rx, ry, Math.max(step, Math.floor(w * 0.48)), rh, r < h * 0.4 ? PAL.white : PAL.moonSilver);
            }
        }
    }

    // Deep-Set Gothic Window with Stone Surround, Iron Mullions & Snow Sill
    drawGothicWindow(ctx, width, height, wx, wy, ww, wh, glowCol, px) {
        const w = Math.max(2, Math.floor(ww));
        const h = Math.max(3, Math.floor(wh));
        const x = Math.floor(wx);
        const y = Math.floor(wy);

        this.rect(ctx, width, height, x - px, y - px, w + px * 2, h + px * 2, PAL.black);
        this.rect(ctx, width, height, x - px, y, px, h, PAL.castleStone);
        if (w >= 3) {
            this.rect(ctx, width, height, x + 1, y - px, Math.max(1, w - 2), px, glowCol);
        }
        this.rect(ctx, width, height, x, y, w, h, glowCol);
        // Wrought-iron gothic lead-light crossbar
        if (w >= 3 && h >= 5) {
            this.rect(ctx, width, height, x, y + Math.floor(h * 0.45), w, 1, PAL.black);
            if (w >= 5) {
                this.rect(ctx, width, height, x + Math.floor(w / 2), y, 1, h, PAL.black);
            }
        }
        // Pillowy white snow sill
        this.rect(ctx, width, height, x - px, y + h, w + px * 2, px, PAL.moonSilver);
        this.rect(ctx, width, height, x - px, y + h, Math.max(px, Math.floor((w + px * 2) * 0.6)), px, PAL.white);
    }

    // Half-Pass of 3D Z-Occluded Orbiting Soul-Flames / Frost-Orbs around Central Spire
    drawSpireSoulOrbit(ctx, width, height, centerX, centerY, rx, ry, tension, pulse, frontPass, px) {
        const orbs = 6;
        const baseAngle = this.internalT * (2.2 + tension * 2.5);
        for (let i = 0; i < orbs; i++) {
            const a = baseAngle + (i * Math.PI * 2) / orbs;
            const z = Math.sin(a);
            if ((frontPass && z < 0) || (!frontPass && z >= 0)) continue;

            const dx = Math.round(Math.cos(a) * rx);
            const dy = Math.round(z * ry);
            const col = (i & 1)
                ? (tension > 0.72 ? PAL.emberOrange : PAL.mysticCyan)
                : (pulse > 0.5 ? PAL.white : PAL.magicGold);
            this.rect(ctx, width, height, centerX + dx, centerY + dy, px, px * 2, col);
            if (frontPass) {
                this.rect(ctx, width, height, centerX + dx, centerY + dy - px, px, px, PAL.white);
            }
        }
    }

    // Snow-Capped Conical or Pyramidal Roof with Overhanging Eave & Glittering Icicles
    drawSnowConicalRoof(ctx, width, height, towX, towY, towW, roofH, withIcicles, px) {
        const overhang = px * 2;
        const baseW = towW + overhang * 2;
        for (let ry = 0; ry < roofH; ry++) {
            const frac = ry / Math.max(1, roofH);
            const rw = Math.max(1, Math.floor(baseW * Math.pow(1.0 - frac, 1.08)));
            const rx = towX - overhang + Math.floor((baseW - rw) / 2);
            const y = towY - ry;

            if (ry === 0) {
                this.rect(ctx, width, height, rx, y, rw, 1, PAL.black);
            } else {
                this.rect(ctx, width, height, rx, y, rw, 1, PAL.farMountain);
                const midW = Math.max(1, Math.floor(rw * 0.74));
                this.rect(ctx, width, height, rx, y, midW, 1, PAL.midMountain);
                const silverW = Math.max(1, Math.floor(rw * 0.56));
                this.rect(ctx, width, height, rx, y, silverW, 1, PAL.moonSilver);
                const brightW = Math.max(1, Math.floor(rw * 0.30));
                this.rect(ctx, width, height, rx, y, brightW, 1, PAL.white);
            }
        }

        if (withIcicles && baseW >= px * 10) {
            for (let ix = towX - px; ix < towX + towW; ix += px * 3) {
                const icicleLen = (((ix * 7) % 3) + 1) * px;
                this.rect(ctx, width, height, ix, towY + 1, px, icicleLen, ix < towX + towW * 0.5 ? PAL.moonSilver : PAL.midMountain);
            }
        }
    }

    // Snow-Blanketed Hipped Roof (Walmdach) for Keep & Gatehouse
    drawSnowHippedRoof(ctx, width, height, wx, wy, ww, roofH, topRidgeFrac, withIcicles, px) {
        const overhang = px * 2;
        const baseW = ww + overhang * 2;
        for (let ry = 0; ry < roofH; ry++) {
            const frac = ry / Math.max(1, roofH);
            const rw = Math.max(3, Math.floor(baseW * (1.0 - frac * (1.0 - topRidgeFrac))));
            const rx = wx - overhang + Math.floor((baseW - rw) / 2);
            const y = wy - ry;

            if (ry === 0) {
                this.rect(ctx, width, height, rx, y, rw, 1, PAL.black);
            } else {
                this.rect(ctx, width, height, rx, y, rw, 1, PAL.farMountain);
                this.rect(ctx, width, height, rx, y, Math.max(2, Math.floor(rw * 0.80)), 1, PAL.midMountain);
                this.rect(ctx, width, height, rx, y, Math.max(2, Math.floor(rw * 0.62)), 1, PAL.moonSilver);
                this.rect(ctx, width, height, rx, y, Math.max(1, Math.floor(rw * 0.34)), 1, PAL.white);
            }
        }
        const ridgeW = Math.max(3, Math.floor(baseW * topRidgeFrac));
        const ridgeX = wx - overhang + Math.floor((baseW - ridgeW) / 2);
        this.rect(ctx, width, height, ridgeX, wy - roofH, ridgeW, px, PAL.white);

        if (withIcicles && baseW >= px * 12) {
            for (let ix = wx - px; ix < wx + ww; ix += px * 3) {
                const icicleLen = (((ix * 11) % 3) + 1) * px;
                this.rect(ctx, width, height, ix, wy + 1, px, icicleLen, ix < wx + ww * 0.6 ? PAL.moonSilver : PAL.midMountain);
            }
        }
    }

    render(ctx, width, height, t, state = 'playing', stateTime = 0, metrics = {}) {
        if (width <= 0 || height <= 0 || !Number.isFinite(width / height)) {
            this.lastT = t;
            return;
        }

        if (state === 'idle') {
            this.lastT = t;
            return;
        }

        let dt = this.lastT === 0 ? 0.02 : t - this.lastT;
        if (dt < 0) {
            this.lastBeatCount = -1;
            this.beatEnv = 0;
            this.hardBeatEnv = 0;
            this.lightningEnv = 0;
            this.batSwarmEnv = 0;
            this.internalT = 0;
            this.burstCursor = 0;
            for (let i = 0; i < MAX_MAGIC_BURSTS; i++) {
                this.bursts[i].active = false;
            }
            this.initSnowflakes();
            dt = 0.02;
        } else if (dt > 0.1) {
            dt = 0.02;
        }
        this.lastT = t;

        if (this.lastState !== state) {
            this.lastState = state;
            this.stateAge = 0;
        } else {
            this.stateAge += dt;
        }

        this.internalT += dt;

        // Exponential decay of transient envelopes
        this.beatEnv = Math.max(0, this.beatEnv - dt * 2.5);
        this.hardBeatEnv = Math.max(0, this.hardBeatEnv - dt * 2.0);
        this.lightningEnv = Math.max(0, this.lightningEnv - dt * 4.2);
        this.batSwarmEnv = Math.max(0, this.batSwarmEnv - dt * 0.9);

        // Defensive metrics reading
        const safeMetrics = metrics || {};
        const tension = Number.isFinite(safeMetrics.tensionPct)
            ? Math.max(0, Math.min(1, safeMetrics.tensionPct))
            : (state === 'climax' ? 0.92 : state === 'buildup' ? 0.68 : state === 'afterglow' ? 0.12 : 0.35);

        const energy = Number.isFinite(safeMetrics.energy)
            ? Math.max(0, Math.min(1, safeMetrics.energy))
            : tension * 0.85;

        const rawImpulse0 = (safeMetrics.beatImpulse && Number.isFinite(safeMetrics.beatImpulse[0]))
            ? Math.max(0, Math.min(1, safeMetrics.beatImpulse[0]))
            : (safeMetrics.beat && Number.isFinite(safeMetrics.beat[0]) ? Math.max(0, Math.min(1, safeMetrics.beat[0])) : 0);

        const beatStrength = Number.isFinite(safeMetrics.beatStrength)
            ? Math.max(0, Math.min(1, safeMetrics.beatStrength))
            : (rawImpulse0 > 0 ? rawImpulse0 : (safeMetrics.beatStarted ? 0.5 : 0));

        const beatLevel = Number.isInteger(safeMetrics.beatLevel) && safeMetrics.beatLevel >= 0 && safeMetrics.beatLevel <= 3
            ? safeMetrics.beatLevel
            : (beatStrength >= 2 / 3 ? 3 : beatStrength >= 1 / 3 ? 2 : (beatStrength > 0 ? 1 : 0));

        // Exact Beat Onset Trigger (never retriggered by decaying envelope!)
        if (safeMetrics.beatStarted) {
            const beatCount = Number.isFinite(safeMetrics.beatCount)
                ? safeMetrics.beatCount
                : this.lastBeatCount + 1;

            if (beatCount !== this.lastBeatCount) {
                this.lastBeatCount = beatCount;
                this.triggerMagic(beatCount, beatStrength, beatLevel, tension, state, t);
            }
        }

        const activePulse = state === 'afterglow'
            ? Math.min(0.20, rawImpulse0 * 0.35)
            : Math.max(rawImpulse0, this.beatEnv);

        const bassEnergy = Number.isFinite(safeMetrics.bass)
            ? Math.max(activePulse, Math.max(0, Math.min(1, safeMetrics.bass)))
            : activePulse;

        // Atari YM2149 3-channel mapping (smooth[0..2]) with safe fallbacks
        const smoothArr = (Array.isArray(safeMetrics.smooth) || ArrayBuffer.isView(safeMetrics.smooth))
            ? safeMetrics.smooth
            : null;
        const ch0 = smoothArr && Number.isFinite(smoothArr[0]) ? Math.max(0, Math.min(1, smoothArr[0])) : bassEnergy;
        const ch1 = smoothArr && Number.isFinite(smoothArr[1]) ? Math.max(0, Math.min(1, smoothArr[1])) : tension;
        const ch2 = smoothArr && Number.isFinite(smoothArr[2]) ? Math.max(0, Math.min(1, smoothArr[2])) : energy;

        // Blood-Moon Eclipse deepens toward climax & cools smoothly in afterglow
        let bloodFactor;
        if (state === 'climax') {
            bloodFactor = 1.0;
        } else if (state === 'afterglow') {
            const afterglowCool = Math.max(0, 1.0 - this.stateAge / 2.5);
            bloodFactor = Math.max(0, Math.min(1, afterglowCool * 0.85));
        } else {
            bloodFactor = Math.max(0, Math.min(1, (tension - 0.52) / 0.38));
        }

        // Advance continuous 3-layer winter snowfall (Zero-GC, normalized [0..1] domain)
        const snowWindMult = state === 'afterglow'
            ? 0.35
            : (state === 'climax' ? 2.15 : (0.72 + tension * 1.1 + ch2 * 0.4));
        const snowWindX = state === 'afterglow' ? 0.015 : (0.042 + tension * 0.09 + activePulse * 0.03);
        for (let i = 0; i < MAX_SNOWFLAKES; i++) {
            const sf = this.snowflakes[i];
            sf.yRatio += sf.speed * snowWindMult * dt;
            sf.xRatio += (snowWindX * (0.6 + sf.layer * 0.35) + Math.sin(this.internalT * sf.driftFreq + sf.phase) * 0.018) * dt;
            if (sf.yRatio >= 1.0) sf.yRatio -= 1.0;
            if (sf.xRatio >= 1.0) sf.xRatio -= 1.0;
            if (sf.xRatio < 0) sf.xRatio += 1.0;
        }

        // =========================================================
        // POLANSKI FILM PROPORTIONS & FLOOR-HORIZON CONTRACT (0.55*h)
        // =========================================================
        const minDim = Math.min(width, height);
        const px = Math.max(1, Math.floor(minDim / 220));
        const cx = Math.floor(width / 2);
        const isPortrait = width < height * 0.85;
        const isUltrawide = width > height * 1.75;

        const floorHorizonY = Math.max(2, Math.floor(height * FLOOR_HORIZON_RATIO));
        const mountainBaseY = Math.max(2, Math.min(floorHorizonY - px * 2, Math.floor(height * MOUNTAIN_BASE_RATIO)));
        const castleBaseY = Math.max(4, Math.min(floorHorizonY - px * 5, Math.floor(height * CASTLE_SUMMIT_RATIO)));

        // Monumental Castle Width & Multi-Tiered Vertical Proportions
        const maxWidthRatio = isPortrait ? 0.84 : 0.56;
        const castleW = Math.max(24, Math.min(Math.floor(width * maxWidthRatio), Math.floor(minDim * 0.95)));
        const castleLeft = Math.floor(cx - castleW * 0.50);
        const castleRight = castleLeft + castleW;
        const maxCastleTopHeadroom = Math.max(12, castleBaseY - px * 6);

        // 1. High Recessed Central Keep (Bergfried) + Slender Belfry Spire
        const keepW = Math.max(8, Math.floor(castleW * 0.21));
        const keepH = Math.min(Math.floor(castleW * 0.34), Math.floor(maxCastleTopHeadroom * 0.72));
        const keepX = castleLeft + Math.floor(castleW * 0.38);
        const keepY = castleBaseY - keepH;
        const keepRoofH = Math.max(4, Math.floor(keepH * 0.24));
        const belfryPinH = Math.max(px * 4, Math.floor(keepH * 0.14));
        const spireTipY = Math.max(px * 2, keepY - keepRoofH - belfryPinH);

        // 2. Tall Needle Stair-Turret (Treppenturm, tucked left of Keep)
        const stairW = Math.max(4, Math.floor(castleW * 0.068));
        const stairH = Math.floor(keepH * 0.76);
        const stairX = keepX - Math.floor(stairW * 0.85);
        const stairY = castleBaseY - stairH;
        const stairRoofH = Math.max(5, Math.floor(stairW * 1.35));

        // 3. West Square Watchtower, Corbelled Corner Bartizan (Erker) & West Curtain Wall
        const lTowW = Math.max(6, Math.floor(castleW * 0.13));
        const lTowH = Math.floor(keepH * 0.62);
        const lTowX = castleLeft + Math.floor(castleW * 0.03);
        const lTowY = castleBaseY - lTowH + px;
        const lTowRoofH = Math.max(4, Math.floor(lTowW * 0.55));

        const bartW = Math.max(3, Math.floor(castleW * 0.052));
        const bartH = Math.max(5, Math.floor(lTowH * 0.50));
        const bartX = castleLeft - px;
        const bartY = lTowY - px * 2;
        const bartRoofH = Math.max(4, Math.floor(bartW * 1.35));

        // 4. Broad Hero Gatehouse Bastion (Torbau, front center-left)
        const gateWallW = Math.max(12, Math.floor(castleW * 0.38));
        const gateWallH = Math.max(8, Math.floor(keepH * 0.52));
        const gateWallX = castleLeft + Math.floor(castleW * 0.20);
        const gateWallY = castleBaseY - gateWallH;
        const gateRoofH = Math.max(4, Math.floor(gateWallH * 0.42));

        // 5. Projecting Cylindrical Bastion Tower (Großer Rundturm, center-right)
        const rRoundW = Math.max(7, Math.floor(castleW * 0.195));
        const rRoundBaseY = Math.min(floorHorizonY - px * 2, castleBaseY + px * 2);
        const rRoundH = Math.floor(keepH * 0.68);
        const rRoundX = gateWallX + gateWallW - Math.max(px * 2, Math.floor(rRoundW * 0.26));
        const rRoundY = rRoundBaseY - rRoundH;
        const rRoundRoofH = Math.max(6, Math.floor(rRoundW * 0.68));

        // 6. Stepped East Curtain Wall & Square Outpost Watchtower
        const rOutpostW = Math.max(6, Math.floor(castleW * 0.13));
        const rOutpostBaseY = Math.min(floorHorizonY - px * 2, castleBaseY + px);
        const rOutpostH = Math.floor(keepH * 0.46);
        const rOutpostX = castleRight - rOutpostW;
        const rOutpostY = rOutpostBaseY - rOutpostH;
        const rOutpostRoofH = Math.max(3, Math.floor(rOutpostW * 0.52));

        const rWallX = rRoundX + rRoundW - px;
        const rWallW = Math.max(2, rOutpostX - rWallX + px);
        const rWallH = Math.floor(keepH * 0.34);
        const rWallY = rOutpostBaseY - rWallH;

        // --- LAYER 1: PRUSSIAN WINTER NIGHT SKY & BLOOD-MOON ECLIPSE ---
        const topSkyCol = PAL.midnightViolet;
        const midSkyCol = PAL.deepBlue;
        const lowSkyCol = PAL.horizonBlue;
        const hazeCol = bloodFactor > 0.72 ? PAL.sorceryMagenta : PAL.farMountain;

        this.rect(ctx, width, height, 0, 0, width, height, topSkyCol);

        if (floorHorizonY > 4) {
            const h1 = Math.floor(floorHorizonY * 0.34);
            const h2 = Math.floor(floorHorizonY * 0.68);
            const h3 = Math.max(h2 + 1, mountainBaseY - Math.max(px * 3, Math.floor(floorHorizonY * 0.14)));

            this.rect(ctx, width, height, 0, 0, width, h1, topSkyCol);
            if (h2 > h1) {
                this.rect(ctx, width, height, 0, h1, width, h2 - h1, midSkyCol);
            }
            if (h3 > h2) {
                this.rect(ctx, width, height, 0, h2, width, h3 - h2, lowSkyCol);
            }
            if (floorHorizonY > h3) {
                this.rect(ctx, width, height, 0, h3, width, floorHorizonY - h3, hazeCol);
            }

            const ditherSpan = Math.max(px * 2, Math.min(px * 6, Math.floor(floorHorizonY * 0.07)));
            this.drawShifterSkyDither(ctx, width, height, h1, ditherSpan, topSkyCol, midSkyCol, px);
            this.drawShifterSkyDither(ctx, width, height, h2, ditherSpan, midSkyCol, lowSkyCol, px);
            this.drawShifterSkyDither(ctx, width, height, h3, Math.max(px * 2, Math.floor(ditherSpan * 0.75)), lowSkyCol, hazeCol, px);
        }

        if (minDim >= 8) {
            // 1a. Cold Winter Stars (modulated by YM channel 2)
            for (let i = 0; i < this.stars.length; i++) {
                const s = this.stars[i];
                const sx = Math.floor(s.x * width);
                const sy = Math.floor(s.y * floorHorizonY);
                if (sx < 0 || sx >= width || sy < 0 || sy >= mountainBaseY) continue;

                const twinkle = Math.sin(this.internalT * 2.6 + s.phase) + ch2 * 0.35;
                if (twinkle > 0.76) {
                    this.rect(ctx, width, height, sx, sy, px, px, PAL.moonSilver);
                    if (s.mag === 2 && twinkle > 0.96 && minDim >= 48) {
                        this.rect(ctx, width, height, sx, sy, px, px, PAL.white);
                    }
                } else if (twinkle > 0.18) {
                    this.rect(ctx, width, height, sx, sy, px, px, PAL.farMountain);
                }
            }

            // 1b. Winter Boreal / Vampiric Horizon Aurora (buildup & climax)
            if (state !== 'afterglow' && (tension > 0.45 || state === 'buildup' || state === 'climax') && minDim >= 32) {
                this.drawWinterAurora(ctx, width, height, mountainBaseY, tension, activePulse, bloodFactor, px);
            }

            // 1c. Cratered Winter Full Moon -> Creeping Crimson Blood-Moon Eclipse
            const moonR = Math.max(4, Math.min(Math.floor(px * 16), Math.floor(minDim * 0.078)));
            const moonX = Math.floor(width * (isPortrait ? 0.18 : 0.14));
            const moonY = Math.max(moonR + px * 2, Math.floor(floorHorizonY * (isPortrait ? 0.17 : 0.23)));

            if (minDim >= 32) {
                const haloR = moonR + px * 3 + (activePulse > 0.45 ? px * 2 : 0);
                const haloCol = bloodFactor > 0.48 ? PAL.sorceryMagenta : PAL.horizonBlue;
                for (let hy = -haloR; hy <= haloR; hy += px * 2) {
                    const hdx = Math.round(Math.sqrt(Math.max(0, haloR * haloR - hy * hy)));
                    if (hdx > 0) {
                        this.rect(ctx, width, height, moonX - hdx, moonY + hy, hdx * 2, px, haloCol);
                    }
                }
            }

            const eclipseThresholdY = moonR * (1.0 - bloodFactor * 1.82);
            for (let my = -moonR; my <= moonR; my++) {
                const dx = Math.round(Math.sqrt(Math.max(0, moonR * moonR - my * my)));
                if (dx <= 0) continue;

                const inBloodZone = bloodFactor > 0.05 && my >= eclipseThresholdY;
                const baseDiscCol = inBloodZone ? PAL.emberOrange : PAL.moonSilver;
                const limbDiscCol = inBloodZone ? PAL.sorceryMagenta : PAL.white;
                const craterCol = inBloodZone ? PAL.black : PAL.midMountain;

                this.rect(ctx, width, height, moonX - dx, moonY + my, dx * 2, 1, baseDiscCol);
                if (dx > 2) {
                    this.rect(ctx, width, height, moonX - dx + 1, moonY + my, Math.max(1, Math.floor(dx * 1.15)), 1, limbDiscCol);
                }
                // Organic Mare Imbrium & Tycho pixel crater clusters
                if (dx > 4) {
                    const ny = my / moonR;
                    if (ny > -0.52 && ny < -0.08) {
                        const cW = Math.max(1, Math.floor(dx * (0.48 - Math.abs(ny + 0.30))));
                        this.rect(ctx, width, height, moonX + Math.floor(dx * 0.05), moonY + my, cW, 1, craterCol);
                    } else if (ny > 0.14 && ny < 0.58) {
                        const cW = Math.max(1, Math.floor(dx * (0.42 - Math.abs(ny - 0.36))));
                        this.rect(ctx, width, height, moonX + Math.floor(dx * 0.22), moonY + my, cW, 1, craterCol);
                    }
                }
            }

            // 1d. Sculpted Nocturnal Storm-Wrack Clouds
            for (let ci = 0; ci < this.clouds.length; ci++) {
                const cloud = this.clouds[ci];
                const cWidth = Math.max(14, Math.floor(width * cloud.spanRatio));
                const cHeight = Math.max(3, Math.floor(minDim * 0.025));
                const cY = Math.floor(floorHorizonY * cloud.yRatio);
                const drift = Math.floor(this.internalT * width * cloud.speed);
                const span = width + cWidth * 2;
                let cX = ((Math.floor(width * cloud.initX) + drift + cWidth) % span);
                if (cX < 0) cX += span;
                cX -= cWidth;

                this.drawStormWrackCloud(ctx, width, height, cX, cY, cWidth, cHeight, moonX, moonY, bloodFactor, this.lightningEnv > 0.45, px);
            }

            // 1e. Vampire Bat Swarm spiraling across Sky & Moon
            if (minDim >= 32) {
                this.drawBatSwarm(ctx, width, height, floorHorizonY, moonX, moonY, tension, px);
            }

            // --- LAYER 2: SPIRE BEACON, FORKED LIGHTNING & GRADED FIREWORKS ---
            const keepCenterX = keepX + Math.floor(keepW / 2);

            if (state !== 'afterglow' && (tension > 0.48 || state === 'climax' || state === 'buildup')) {
                const rayW = Math.max(px * 2, Math.floor(minDim * (0.014 + activePulse * 0.012)));
                const rayH = Math.floor(floorHorizonY * (0.34 + tension * 0.32 + activePulse * 0.14));
                const rayX = Math.floor(keepCenterX - rayW / 2);
                const rayTop = Math.max(0, spireTipY - rayH);
                const outerCol = bloodFactor > 0.5 ? PAL.sorceryMagenta : PAL.horizonBlue;
                const innerCol = bloodFactor > 0.5 ? PAL.emberOrange : PAL.mysticCyan;

                if (spireTipY > rayTop) {
                    this.rect(ctx, width, height, rayX - px, rayTop + px * 2, rayW + px * 2, Math.max(1, spireTipY - rayTop), outerCol);
                    this.rect(ctx, width, height, rayX, rayTop, rayW, Math.max(1, spireTipY - rayTop), innerCol);
                    if (activePulse > 0.35 || state === 'climax') {
                        this.rect(ctx, width, height, keepCenterX, rayTop + px, px, Math.max(1, spireTipY - rayTop), PAL.white);
                    }
                }
            }

            if (this.lightningEnv > 0.15 && minDim >= 24) {
                const strikeX = this.lightningSlot === 0
                    ? keepCenterX
                    : (this.lightningSlot === 1
                        ? stairX + Math.floor(stairW / 2)
                        : rRoundX + Math.floor(rRoundW / 2));
                const strikeY = this.lightningSlot === 0
                    ? spireTipY
                    : (this.lightningSlot === 1
                        ? stairY - stairRoofH
                        : rRoundY - rRoundRoofH);

                this.drawForkedLightning(ctx, width, height, strikeX, Math.max(px * 3, strikeY), this.lightningEnv, bloodFactor > 0.55, px);
            }

            for (let bi = 0; bi < this.bursts.length; bi++) {
                const burst = this.bursts[bi];
                if (!burst.active) continue;

                const progress = (t - burst.startTime) / burst.duration;
                if (progress < 0 || progress >= 1.0) {
                    burst.active = false;
                    continue;
                }

                const burstCX = Math.floor(burst.xRatio * width);
                const burstCY = Math.floor(burst.yRatio * height);
                const srcX = burst.originSlot === 0
                    ? keepCenterX
                    : (burst.originSlot === 1 ? stairX + Math.floor(stairW / 2) : rRoundX + Math.floor(rRoundW / 2));
                const srcY = burst.originSlot === 0
                    ? spireTipY
                    : (burst.originSlot === 1 ? stairY - stairRoofH : rRoundY - rRoundRoofH);

                if (burst.beatLevel >= 2 && progress < 0.20 && minDim >= 24) {
                    const trailT = progress / 0.20;
                    const tipX = Math.floor(srcX + (burstCX - srcX) * trailT);
                    const tipY = Math.floor(srcY + (burstCY - srcY) * trailT);
                    this.drawPixelLine(ctx, width, height, srcX, srcY, tipX, tipY, px, burst.color);
                    this.rect(ctx, width, height, tipX - px, tipY - px, px * 2, px * 2, PAL.white);
                    continue;
                }

                const burstProg = burst.beatLevel >= 2 ? (progress - 0.16) / 0.84 : progress;
                const safeProg = Math.max(0, Math.min(1, burstProg));
                const curRadius = burst.radiusFactor * minDim * 0.22 * Math.sin(safeProg * Math.PI * 0.52);
                const gravityDrop = safeProg * safeProg * (burst.beatLevel >= 2 ? 15 : 8) * px;

                if (burst.pattern === 2 && safeProg < 0.34 && minDim >= 24) {
                    const flareR = Math.max(px * 2, Math.floor(curRadius * 0.42 * (1.0 - safeProg / 0.34)));
                    this.rect(ctx, width, height, burstCX - flareR, burstCY, flareR * 2 + px, px, PAL.white);
                    this.rect(ctx, width, height, burstCX, burstCY - flareR, px, flareR * 2 + px, PAL.magicGold);
                } else if (burst.pattern === 1 && safeProg < 0.28) {
                    const coreR = Math.max(px, Math.floor(minDim * 0.025 * (1.0 - safeProg / 0.28)));
                    this.rect(ctx, width, height, burstCX - coreR, burstCY, coreR * 2 + px, px, PAL.white);
                    this.rect(ctx, width, height, burstCX, burstCY - coreR, px, coreR * 2 + px, burst.color);
                }

                for (let pi = 0; pi < burst.particleCount; pi++) {
                    const p = burst.particles[pi];
                    const pxPos = Math.floor(burstCX + p.dx * curRadius);
                    const pyPos = Math.floor(burstCY + p.dy * curRadius + gravityDrop);
                    const pSize = p.size * px;

                    if (pxPos >= 0 && pxPos < width && pyPos >= 0 && pyPos < height) {
                        const pColor = safeProg < 0.22
                            ? PAL.white
                            : (safeProg > 0.62 ? burst.secondaryColor : (p.ring === 0 ? PAL.magicGold : burst.color));
                        this.rect(ctx, width, height, pxPos, pyPos, pSize, pSize, pColor);

                        if (burst.beatLevel >= 2 && safeProg > 0.14 && safeProg < 0.85) {
                            const tailX = Math.floor(burstCX + p.dx * curRadius * 0.82);
                            const tailY = Math.floor(burstCY + p.dy * curRadius * 0.82 + gravityDrop * 0.72);
                            this.rect(ctx, width, height, tailX, tailY, px, px, burst.secondaryColor);
                        }
                    }
                }
            }

            // --- LAYER 3: SOUTH-TYROLEAN DOLOMITES, CARPATHIANS & SNOW VALLEYS ---
            if (floorHorizonY > mountainBaseY) {
                this.rect(ctx, width, height, 0, mountainBaseY, width, floorHorizonY - mountainBaseY, PAL.midMountain);
                this.rect(ctx, width, height, 0, mountainBaseY, Math.floor(width * 0.45), floorHorizonY - mountainBaseY, PAL.moonSilver);
            }

            const farMaxH = Math.floor(mountainBaseY * 0.56);
            this.drawFarDolomiteAndAlpineRange(ctx, width, height, mountainBaseY, farMaxH, px);

            const midMaxH = Math.floor(mountainBaseY * 0.26);
            this.drawMidSnowFoothills(ctx, width, height, mountainBaseY, midMaxH, px);

            // --- LAYER 4: SCULPTED SUMMIT KNOLL & GRAF VON KROLOCK'S WINTER FORTRESS ---
            // Helper closuresless continuous hill geometry (shared by Summit Crown < 0.55*h & Lower Hill >= 0.55*h!)
            const hillTotalSpan = Math.max(1, height - castleBaseY);

            // 4.0 Upper Summit Snow Crown (castleBaseY .. floorHorizonY - 1) so Castle sits on 3D snow knoll!
            for (let y = castleBaseY - px * 2; y < floorHorizonY; y++) {
                if (y < 0) continue;
                const hProg = Math.max(0, (y - (castleBaseY - px * 2)) / hillTotalSpan);
                const expand = Math.pow(hProg, 0.72) * width * 0.62;
                const hLeft = Math.max(0, Math.floor(castleLeft - px * 4 - expand * 0.92));
                const hRight = Math.min(width, Math.ceil(castleRight + px * 4 + expand * 0.88));
                const hillW = hRight - hLeft;
                if (hillW <= 0) continue;

                const shadeSplit = hLeft + Math.floor(hillW * (0.58 - hProg * 0.06));
                this.rect(ctx, width, height, hLeft, y, hillW, 1, PAL.moonSilver);
                this.rect(ctx, width, height, hLeft, y, Math.max(px * 2, Math.floor((shadeSplit - hLeft) * 0.55)), 1, PAL.white);
                if (hRight > shadeSplit) {
                    this.rect(ctx, width, height, shadeSplit, y, hRight - shadeSplit, 1, PAL.midMountain);
                    const deepSplit = shadeSplit + Math.floor((hRight - shadeSplit) * 0.52);
                    if (hRight > deepSplit) {
                        this.rect(ctx, width, height, deepSplit, y, hRight - deepSplit, 1, PAL.farMountain);
                    }
                }
            }

            const candleFlicker = Math.sin(this.internalT * 16.0) * 0.5 + Math.cos(this.internalT * 7.3) * 0.5;
            const candleCol = (activePulse > 0.58 || bloodFactor > 0.75)
                ? PAL.emberOrange
                : (candleFlicker > -0.55 ? PAL.magicGold : PAL.emberOrange);

            // 4a. Recessed High Central Keep (Bergfried) + Chimney + Spire Orbs
            this.drawTexturedStoneWall(ctx, width, height, keepX, keepY, keepW, keepH, true, false, 0.34, 11, px);

            if (minDim >= 36) {
                const chimX = keepX + Math.floor(keepW * 0.76);
                const chimH = Math.max(px * 3, Math.floor(keepRoofH * 0.65));
                const chimY = keepY - chimH;
                this.rect(ctx, width, height, chimX, chimY, px * 2, chimH, PAL.castleShadow);
                this.rect(ctx, width, height, chimX - px, chimY, px * 3, px, PAL.moonSilver);
                for (let sm = 0; sm < 5; sm++) {
                    const smPhase = ((this.internalT * 0.42 + sm * 0.20) % 1.0);
                    const smX = chimX + Math.floor(smPhase * px * 11 + Math.sin(smPhase * 6 + this.internalT) * px * 2);
                    const smY = chimY - px * 2 - Math.floor(smPhase * px * 11);
                    this.rect(ctx, width, height, smX, smY, px * (smPhase > 0.5 ? 2 : 1), px, smPhase > 0.55 ? PAL.farMountain : PAL.midMountain);
                }
            }

            const showSoulOrbit = state !== 'afterglow' && (tension > 0.45 || state === 'buildup' || state === 'climax') && minDim >= 36;
            const ringRX = Math.max(px * 5, Math.floor(keepW * 0.68));
            const ringRY = Math.max(px * 2, Math.floor(ringRX * 0.28));
            const ringCenterY = keepY - Math.floor(keepRoofH * 0.75);
            if (showSoulOrbit) {
                this.drawSpireSoulOrbit(ctx, width, height, keepCenterX, ringCenterY, ringRX, ringRY, tension, activePulse, false, px);
            }

            // Steep Hipped Keep Roof (Walmdach) + Wrought-Iron Lightning Rod Cross
            this.drawSnowHippedRoof(ctx, width, height, keepX, keepY, keepW, keepRoofH, 0.38, false, px);
            this.rect(ctx, width, height, keepCenterX, spireTipY, px, keepY - keepRoofH - spireTipY, this.lightningEnv > 0.3 ? PAL.white : PAL.moonSilver);
            this.rect(ctx, width, height, keepCenterX - px * 2, spireTipY + px * 2, px * 5, px, PAL.castleLight);
            if (activePulse > 0.4 || state === 'climax') {
                this.rect(ctx, width, height, keepCenterX - px, spireTipY - px, px * 3, px * 2, bloodFactor > 0.5 ? PAL.emberOrange : PAL.mysticCyan);
            }

            if (showSoulOrbit) {
                this.drawSpireSoulOrbit(ctx, width, height, keepCenterX, ringCenterY, ringRX, ringRY, tension, activePulse, true, px);
            }

            // Upper Keep Casement / Cursed Rose Windows (Ballroom lights flare in Climax!)
            const kWinW = Math.max(2, Math.floor(keepW * 0.18));
            const kWinH = Math.max(3, Math.floor(keepH * 0.15));
            const kWinY = keepY + Math.floor(keepH * 0.12);
            const keepWinCol = state === 'afterglow'
                ? PAL.deepBlue
                : ((ch1 > 0.55 || activePulse > 0.45 || state === 'climax') ? PAL.emberOrange : PAL.magicGold);
            this.drawGothicWindow(ctx, width, height, keepX + Math.floor(keepW * 0.28), kWinY, kWinW, kWinH, keepWinCol, px);
            if (keepW >= 18) {
                const secondKeepCol = state === 'climax' ? PAL.magicGold : PAL.black;
                this.drawGothicWindow(ctx, width, height, keepX + Math.floor(keepW * 0.60), kWinY, kWinW, kWinH, secondKeepCol, px);
            }

            // 4b. Tall Needle Stair-Turret (Treppenturm left of Keep)
            this.drawCylindricalTower(ctx, width, height, stairX, stairY, stairW, stairH, px);
            this.drawSnowConicalRoof(ctx, width, height, stairX, stairY, stairW, stairRoofH, false, px);
            this.rect(ctx, width, height, stairX + Math.floor(stairW / 2), stairY - stairRoofH - px * 2, px, px * 2, PAL.moonSilver);

            // 4c. West Curtain Wall, Square Watchtower & Corbelled Corner Bartizan (Erker)
            const wCurtainX = lTowX + lTowW - px;
            const wCurtainW = Math.max(2, gateWallX - wCurtainX + px * 2);
            const wCurtainH = Math.floor(keepH * 0.44);
            const wCurtainY = castleBaseY - wCurtainH;
            this.drawTexturedStoneWall(ctx, width, height, wCurtainX, wCurtainY, wCurtainW, wCurtainH, false, false, 0.25, 27, px);
            // Snow-capped crenellations on West Curtain Wall
            for (let mx = wCurtainX; mx < wCurtainX + wCurtainW - px * 2; mx += px * 4) {
                this.rect(ctx, width, height, mx, wCurtainY - px * 2, px * 2, px * 2, PAL.castleShadow);
                this.rect(ctx, width, height, mx, wCurtainY - px * 3, px * 2, px, PAL.moonSilver);
            }

            // West Square Watchtower
            this.drawTexturedStoneWall(ctx, width, height, lTowX, lTowY, lTowW, lTowH, true, false, 0.38, 5, px);
            this.drawSnowConicalRoof(ctx, width, height, lTowX, lTowY, lTowW, lTowRoofH, true, px);
            if (lTowW >= 8) {
                const lWinCol = (state !== 'afterglow' && (activePulse > 0.45 || tension > 0.68)) ? PAL.mysticCyan : PAL.black;
                this.drawGothicWindow(ctx, width, height, lTowX + Math.floor(lTowW * 0.38), lTowY + Math.floor(lTowH * 0.24), Math.max(2, px * 2), Math.max(3, px * 4), lWinCol, px);
            }

            // Overhanging Corbelled Corner Bartizan (Erkertürmchen — signature far-left detail in photo!)
            if (minDim >= 32) {
                this.drawCylindricalTower(ctx, width, height, bartX, bartY, bartW, bartH, px);
                // Stepped stone corbels underneath bartizan
                for (let ci = 0; ci < 3; ci++) {
                    const cw = Math.max(px, bartW - ci * px * 2);
                    this.rect(ctx, width, height, bartX + ci * px, bartY + bartH + ci * px, cw, px, ci === 0 ? PAL.castleStone : PAL.black);
                }
                this.drawSnowConicalRoof(ctx, width, height, bartX, bartY, bartW, bartRoofH, false, px);
            }

            // 4d. Broad Hero Gatehouse Bastion (Torbau with Ashlar, Quoins, Heraldic Relief & Portal)
            this.drawTexturedStoneWall(ctx, width, height, gateWallX, gateWallY, gateWallW, gateWallH, true, true, 0.18, 42, px);

            // Machicolation frieze / weathered stone cornice below Gatehouse eaves
            if (gateWallH >= 14) {
                this.rect(ctx, width, height, gateWallX, gateWallY + px, gateWallW, px, PAL.black);
                for (let fx = gateWallX + px * 2; fx < gateWallX + gateWallW - px * 2; fx += px * 3) {
                    this.rect(ctx, width, height, fx, gateWallY + px * 2, px, px * 2, PAL.black);
                }
            }

            // Snow-Blanketed Hipped Gatehouse Roof + Icicles + Central Attic Dormer
            this.drawSnowHippedRoof(ctx, width, height, gateWallX, gateWallY, gateWallW, gateRoofH, 0.58, true, px);
            if (gateRoofH >= 6 && gateWallW >= 24) {
                const dormW = Math.max(4, px * 5);
                const dormH = Math.max(3, Math.floor(gateRoofH * 0.55));
                const dormX = gateWallX + Math.floor(gateWallW * 0.43);
                const dormY = gateWallY - dormH - px;
                this.rect(ctx, width, height, dormX, dormY, dormW, dormH, PAL.black);
                this.rect(ctx, width, height, dormX, dormY, px, dormH, PAL.castleStone);
                this.drawSnowConicalRoof(ctx, width, height, dormX, dormY, dormW, Math.max(2, px * 3), false, px);
                this.rect(ctx, width, height, dormX + px, dormY + px, Math.max(1, dormW - px * 2), Math.max(1, dormH - px * 2), state === 'afterglow' ? PAL.deepBlue : candleCol);
            }

            // Moulded Rectangular Stone Portal Frame + Pointed Gothic Archway + Postern Door
            const gateW = Math.max(5, Math.floor(gateWallW * 0.24));
            const gateH = Math.max(6, Math.floor(gateWallH * 0.56));
            const gateX = gateWallX + Math.floor(gateWallW * 0.48) - Math.floor(gateW / 2);
            const gateY = castleBaseY - gateH;
            const archApexH = Math.max(2, Math.floor(gateH * 0.38));

            // Recessed outer rectangular stone Torblende + carved coat-of-arms above arch
            if (gateWallW >= 28) {
                this.rect(ctx, width, height, gateX - px * 2, gateY - px * 3, gateW + px * 4, gateH + px * 3, PAL.castleShadow);
                this.rect(ctx, width, height, gateX - px * 2, gateY - px * 3, gateW + px * 4, px, PAL.moonSilver);
                // Tiny heraldic shield relief above portal
                this.rect(ctx, width, height, gateX + Math.floor(gateW / 2) - px, gateY - px * 6, px * 3, px * 2, PAL.castleLight);
            }

            for (let gy = 0; gy < gateH; gy++) {
                const archFrac = gy < archApexH ? Math.sqrt((gy + 1) / archApexH) : 1.0;
                const curGW = Math.max(px * 2, Math.floor(gateW * archFrac));
                const curGX = gateX + Math.floor((gateW - curGW) / 2);
                const drawY = gateY + gy;

                this.rect(ctx, width, height, curGX - px, drawY, curGW + px * 2, 1, PAL.castleStone);
                this.rect(ctx, width, height, curGX, drawY, curGW, 1, PAL.black);
                if (gy < archApexH) {
                    this.rect(ctx, width, height, curGX - px, drawY, px, 1, PAL.castleLight);
                }
            }
            // Iron portcullis teeth & studded timber door verticals
            if (gateW >= 6) {
                for (let gx = gateX + px; gx < gateX + gateW - px; gx += px * 2) {
                    this.rect(ctx, width, height, gx, gateY + archApexH, px, Math.floor(gateH * 0.32), PAL.castleStone);
                }
            }
            // Hanging wrought-iron gatehouse lantern & warm hearth spill (YM channel 0!)
            const gateTorchCol = (ch0 > 0.55 || state === 'climax') ? PAL.emberOrange : PAL.magicGold;
            this.rect(ctx, width, height, gateX - px * 2, gateY + Math.floor(gateH * 0.36), px, px * 2, gateTorchCol);
            if (state !== 'afterglow' && (ch0 > 0.45 || state === 'climax')) {
                this.rect(ctx, width, height, gateX + px, castleBaseY - px * 2, Math.max(px, gateW - px * 2), px * 2, PAL.emberOrange);
            }

            // Smaller Arched Pedestrian Postern Door (Schlupfpforte to left of main gate, from photo!)
            if (gateWallW >= 24) {
                const postW = Math.max(2, Math.floor(gateW * 0.42));
                const postH = Math.max(4, Math.floor(gateH * 0.58));
                const postX = gateX - postW - px * 4;
                const postY = castleBaseY - postH;
                this.rect(ctx, width, height, postX - px, postY - px, postW + px * 2, postH + px, PAL.castleStone);
                this.rect(ctx, width, height, postX, postY, postW, postH, PAL.black);
                // Small upper guard slit above postern door
                this.rect(ctx, width, height, postX + Math.floor(postW / 2), gateWallY + Math.floor(gateWallH * 0.28), px, px * 3, PAL.black);
            }

            // 4e. Massive Projecting Cylindrical Bastion Tower (Großer Rundturm)
            this.drawCylindricalTower(ctx, width, height, rRoundX, rRoundY, rRoundW, rRoundH, px);
            // Corbelled stone cornice ring under conical roof
            this.rect(ctx, width, height, rRoundX - px, rRoundY, rRoundW + px * 2, px * 2, PAL.black);
            this.rect(ctx, width, height, rRoundX - px, rRoundY, Math.floor(rRoundW * 0.55), px, PAL.castleLight);

            this.drawSnowConicalRoof(ctx, width, height, rRoundX, rRoundY, rRoundW, rRoundRoofH, true, px);

            // Signature Protruding Right Roof-Dormer / Lookout Bartizan (Dacherkerchen on Round Tower cone!)
            if (rRoundW >= 12 && rRoundRoofH >= 8) {
                const rDormW = Math.max(3, Math.floor(rRoundW * 0.28));
                const rDormH = Math.max(3, Math.floor(rRoundRoofH * 0.34));
                const rDormX = rRoundX + Math.floor(rRoundW * 0.62);
                const rDormY = rRoundY - Math.floor(rRoundRoofH * 0.28);
                this.rect(ctx, width, height, rDormX, rDormY - rDormH, rDormW, rDormH, PAL.black);
                this.rect(ctx, width, height, rDormX, rDormY - rDormH, px, rDormH, PAL.castleStone);
                this.rect(ctx, width, height, rDormX - px, rDormY - rDormH - px, rDormW + px * 2, px, PAL.moonSilver);
            }

            // Lone Flickering Tallow Candle Chamber Window on the Round Tower
            if (rRoundW >= 7) {
                this.drawGothicWindow(
                    ctx, width, height,
                    rRoundX + Math.floor(rRoundW * 0.26), rRoundY + Math.floor(rRoundH * 0.28),
                    Math.max(2, Math.floor(rRoundW * 0.20)), Math.max(3, Math.floor(rRoundH * 0.20)),
                    candleCol, px
                );
            }

            // 4f. Stepped East Curtain Wall & Square East Watchtower
            if (rWallW >= 3) {
                this.drawTexturedStoneWall(ctx, width, height, rWallX, rWallY, rWallW, rWallH, false, false, 0.45, 19, px);
                this.rect(ctx, width, height, rWallX, rWallY - px, rWallW, px, PAL.moonSilver);
                this.rect(ctx, width, height, rWallX, rWallY - px, Math.floor(rWallW * 0.5), px, PAL.white);
            }
            this.drawTexturedStoneWall(ctx, width, height, rOutpostX, rOutpostY, rOutpostW, rOutpostH, true, false, 0.52, 31, px);
            this.drawSnowConicalRoof(ctx, width, height, rOutpostX, rOutpostY, rOutpostW, rOutpostRoofH, false, px);
            if (rOutpostW >= 8) {
                this.drawGothicWindow(
                    ctx, width, height,
                    rOutpostX + Math.floor(rOutpostW * 0.28), rOutpostY + Math.floor(rOutpostH * 0.25),
                    Math.max(2, px * 2), Math.max(3, px * 3),
                    state === 'climax' ? PAL.emberOrange : PAL.black, px
                );
            }

            // 4g. Organic Curved Snowdrifts Embracing the Castle Foundations (softens wall bases!)
            for (let sx = castleLeft - px * 2; sx <= castleRight + px * 2; sx += px * 2) {
                const nX = (sx - castleLeft) / Math.max(1, castleW);
                const baseRefY = nX > 0.56 ? rRoundBaseY : castleBaseY;
                const driftH = Math.max(px, Math.round((Math.sin(nX * 14.0) * 0.5 + 0.8) * px * 2));
                const driftCol = nX < 0.54 ? PAL.white : (nX < 0.76 ? PAL.moonSilver : PAL.midMountain);
                this.rect(ctx, width, height, sx, baseRefY - driftH, px * 2, driftH + px, driftCol);
            }

            // --- LAYER 5: DENSE SNOW HILLSIDE, PINE GROVES, FENCE, BRIDGE & VAMPIRE HUNTERS ---
            if (floorHorizonY < height) {
                const fgHeight = height - floorHorizonY;

                // 5a. Flanking Alpine Valley Snow Meadows (behind the central steep Castle Hill)
                this.rect(ctx, width, height, 0, floorHorizonY, width, fgHeight, PAL.midMountain);
                for (let vy = floorHorizonY; vy < height; vy += Math.max(1, px)) {
                    const vNorm = (vy - floorHorizonY) / Math.max(1, fgHeight);
                    // Left sunlit valley meadow
                    const leftValleyW = Math.floor(width * (0.42 - vNorm * 0.10));
                    this.rect(ctx, width, height, 0, vy, leftValleyW, Math.max(1, px), vNorm < 0.45 ? PAL.moonSilver : PAL.midMountain);
                    // Subtle valley snow fold shadows on left & right
                    const foldW = Math.floor(width * (0.16 + Math.sin(vNorm * 5.0) * 0.06));
                    this.rect(ctx, width, height, 0, vy, foldW, Math.max(1, px), PAL.midMountain);
                    this.rect(ctx, width, height, width - Math.floor(width * (0.28 - vNorm * 0.08)), vy, Math.floor(width * 0.28), Math.max(1, px), PAL.farMountain);
                }

                // 5b. Mid-Valley Clustered Spruce Groves (Tannengruppen left & right, like in photo!)
                if (minDim >= 36 && fgHeight >= 18) {
                    const baseGroveH = Math.max(4, Math.floor(fgHeight * 0.11));
                    for (let gi = 0; gi < VALLEY_PINE_GROVES.length; gi++) {
                        const g = VALLEY_PINE_GROVES[gi];
                        const gx = Math.floor(g.x * width);
                        const gy = floorHorizonY + Math.floor(g.yFrac * fgHeight);
                        const gh = Math.max(4, Math.floor(baseGroveH * g.scale));
                        if (gy - gh >= floorHorizonY) {
                            this.drawDistantSpruce(ctx, width, height, gx, gy, gh, px);
                        }
                    }
                }

                // 5c. Central Steep 3D Sculpted Castle Snow Hill (seamless continuation from Layer 4.0!)
                for (let y = floorHorizonY; y < height; y++) {
                    const hProg = (y - (castleBaseY - px * 2)) / hillTotalSpan;
                    const expand = Math.pow(hProg, 0.72) * width * 0.62;
                    const hLeft = Math.max(0, Math.floor(castleLeft - px * 4 - expand * 0.92));
                    const hRight = Math.min(width, Math.ceil(castleRight + px * 4 + expand * 0.88));
                    const hillW = hRight - hLeft;
                    if (hillW <= 0) continue;

                    const shadeSplit = hLeft + Math.floor(hillW * (0.58 - hProg * 0.06 + Math.sin(hProg * 4.2) * 0.03));
                    const brightEnd = hLeft + Math.max(px * 2, Math.floor((shadeSplit - hLeft) * 0.56));
                    const deepSplit = shadeSplit + Math.floor((hRight - shadeSplit) * 0.52);

                    // Crisp 4-tone snow hill shading
                    this.rect(ctx, width, height, hLeft, y, hillW, 1, PAL.moonSilver);
                    this.rect(ctx, width, height, hLeft, y, Math.min(hillW, brightEnd - hLeft), 1, PAL.white);
                    if (hRight > shadeSplit) {
                        this.rect(ctx, width, height, shadeSplit, y, hRight - shadeSplit, 1, PAL.midMountain);
                    }
                    if (hRight > deepSplit) {
                        this.rect(ctx, width, height, deepSplit, y, hRight - deepSplit, 1, PAL.farMountain);
                    }

                    // Atari ST Bayer contour stippling along snow-hill light transitions + wind-drift ripples
                    const gy = (y / Math.max(1, px)) | 0;
                    if ((gy & 1) === 0) {
                        this.rect(ctx, width, height, brightEnd, y, px * 3, 1, PAL.white);
                        this.rect(ctx, width, height, shadeSplit - px * 3, y, px * 3, 1, PAL.midMountain);
                        if (hRight > deepSplit) {
                            this.rect(ctx, width, height, deepSplit - px * 2, y, px * 2, 1, PAL.farMountain);
                        }
                    }
                    // Subtle wind-sculpted horizontal snow-wave shadows
                    if ((gy % 7) === 0 && hillW > px * 16) {
                        const waveX = hLeft + Math.floor(hillW * (0.22 + ((gy * 13) % 29) * 0.015));
                        this.rect(ctx, width, height, waveX, y, px * 6, 1, y < floorHorizonY + fgHeight * 0.5 ? PAL.midMountain : PAL.moonSilver);
                    }
                }

                // 5d. Frozen Moonlit Brook in Right Valley (reflecting moon & crimson rose window)
                if (minDim >= 36 && fgHeight >= 18) {
                    const creekTopY = floorHorizonY + Math.floor(fgHeight * 0.42);
                    const creekBotY = floorHorizonY + Math.floor(fgHeight * 0.66);
                    for (let cy = creekTopY; cy < creekBotY; cy += Math.max(1, px)) {
                        const cProg = (cy - creekTopY) / Math.max(1, creekBotY - creekTopY);
                        const creekX = Math.floor(width * (0.76 + Math.sin(cProg * 2.8) * 0.05));
                        const creekW = Math.max(px * 3, Math.floor(width * (0.06 + cProg * 0.07)));
                        this.rect(ctx, width, height, creekX, cy, creekW, Math.max(1, px), PAL.horizonBlue);

                        const ripple = Math.round(Math.sin(cy * 0.6 + this.internalT * 2.2) * px);
                        const glintCol = (bloodFactor > 0.55 || activePulse > 0.6) ? PAL.emberOrange : PAL.moonSilver;
                        this.rect(ctx, width, height, creekX + Math.floor(creekW * 0.3) + ripple, cy, Math.max(px, Math.floor(creekW * 0.28)), Math.max(1, px), glintCol);
                    }
                }

                // 5e. Rustic Two-Rail Wooden Snow-Fence, Deep Hollow-Way Trench & Sloped Timber Bridge
                const bridgeStartX = Math.floor(width * (isPortrait ? 0.28 : 0.37));
                const bridgeEndX = gateX + Math.floor(gateW * 0.35);
                const bridgeStartY = floorHorizonY + Math.floor(fgHeight * 0.46);
                const bridgeEndY = floorHorizonY + Math.floor(fgHeight * 0.08);

                if (minDim >= 32 && fgHeight >= 16) {
                    // Left Two-Rail Wooden Snow-Fence (Holzzaun running from left slope to bridge!)
                    const fenceLeftX = Math.floor(width * (isPortrait ? 0.10 : 0.22));
                    const fenceLeftY = bridgeStartY - Math.floor(fgHeight * 0.05);
                    const fenceRightX = bridgeStartX + px;
                    const fenceRightY = bridgeEndY + Math.floor((bridgeStartY - bridgeEndY) * 0.35);
                    const fenceH = Math.max(px * 4, Math.floor(fgHeight * 0.08));

                    // Cast shadow of fence rails on snow
                    this.drawPixelLine(ctx, width, height, fenceLeftX + px * 2, fenceLeftY + px * 2, fenceRightX + px * 2, fenceRightY + px * 2, px, PAL.farMountain);

                    const fencePosts = 4;
                    for (let fp = 0; fp < fencePosts; fp++) {
                        const fFrac = fp / (fencePosts - 1);
                        const fpx = Math.floor(fenceLeftX + (fenceRightX - fenceLeftX) * fFrac);
                        const fpy = Math.floor(fenceLeftY + (fenceRightY - fenceLeftY) * fFrac);
                        this.rect(ctx, width, height, fpx, fpy - fenceH, px, fenceH + px, PAL.black);
                        this.rect(ctx, width, height, fpx, fpy - fenceH - px, px, px, PAL.white);
                    }
                    // Upper & lower timber fence rails + snow crust on top rail
                    this.drawPixelLine(ctx, width, height, fenceLeftX, fenceLeftY - fenceH, fenceRightX, fenceRightY - fenceH, px, PAL.black);
                    this.drawPixelLine(ctx, width, height, fenceLeftX, fenceLeftY - fenceH - px, fenceRightX, fenceRightY - fenceH - px, px, PAL.moonSilver);
                    this.drawPixelLine(ctx, width, height, fenceLeftX, fenceLeftY - Math.floor(fenceH * 0.5), fenceRightX, fenceRightY - Math.floor(fenceH * 0.5), px, PAL.black);

                    // Sunken Dark Hollow-Way Snow Trench (Hohlweg / Graben under the bridge!)
                    const trenchTopY = bridgeEndY + px * 2;
                    const trenchBotY = Math.min(height - 1, bridgeStartY + Math.floor(fgHeight * 0.14));
                    for (let ty = trenchTopY; ty < trenchBotY; ty++) {
                        const tFrac = (ty - trenchTopY) / Math.max(1, trenchBotY - trenchTopY);
                        const cutCenterX = Math.floor(bridgeEndX + (bridgeStartX - bridgeEndX) * tFrac);
                        const cutLeftW = Math.max(px * 2, Math.floor(Math.sin(tFrac * Math.PI) * width * 0.045));
                        const cutRightW = Math.max(px * 3, Math.floor(Math.sin(tFrac * Math.PI) * width * 0.075));

                        // Dark chasm directly under bridge planks + cool blue shaded snow cut-bank on right!
                        this.rect(ctx, width, height, cutCenterX - cutLeftW, ty, cutLeftW + Math.floor(cutRightW * 0.45), 1, tFrac > 0.35 ? PAL.black : PAL.midnightViolet);
                        this.rect(ctx, width, height, cutCenterX + Math.floor(cutRightW * 0.45), ty, Math.ceil(cutRightW * 0.55), 1, PAL.farMountain);
                        this.rect(ctx, width, height, cutCenterX + Math.floor(cutRightW * 0.45), ty, px * 2, 1, PAL.horizonBlue);
                    }

                    // Sloped Timber Bridge Deck + Double Handrails
                    const deckW = Math.max(px * 3, Math.floor(minDim * 0.028));
                    this.drawPixelLine(ctx, width, height, bridgeStartX, bridgeStartY, bridgeEndX, bridgeEndY, deckW, PAL.black);
                    this.drawPixelLine(ctx, width, height, bridgeStartX + px, bridgeStartY, bridgeEndX + px, bridgeEndY, Math.max(1, deckW - px * 2), PAL.castleShadow);
                    this.drawPixelLine(ctx, width, height, bridgeStartX + px, bridgeStartY - px, bridgeEndX + px, bridgeEndY - px, px, PAL.midMountain);

                    const railH = Math.max(px * 3, Math.floor(fgHeight * 0.07));
                    for (let p = 0; p < 5; p++) {
                        const frac = p / 4;
                        const postX = Math.floor(bridgeStartX + (bridgeEndX - bridgeStartX) * frac);
                        const postY = Math.floor(bridgeStartY + (bridgeEndY - bridgeStartY) * frac);
                        // Left handrail post & right handrail post
                        this.rect(ctx, width, height, postX, postY - railH, px, railH + px, PAL.black);
                        this.rect(ctx, width, height, postX, postY - railH - px, px, px, PAL.white);
                        this.rect(ctx, width, height, postX + deckW, postY - railH + px, px, railH, PAL.black);
                    }
                    this.drawPixelLine(ctx, width, height, bridgeStartX, bridgeStartY - railH, bridgeEndX, bridgeEndY - railH, px, PAL.black);
                    this.drawPixelLine(ctx, width, height, bridgeStartX, bridgeStartY - railH - px, bridgeEndX, bridgeEndY - railH - px, px, PAL.white);
                    this.drawPixelLine(ctx, width, height, bridgeStartX + deckW, bridgeStartY - railH + px, bridgeEndX + deckW, bridgeEndY - railH + px, px, PAL.castleShadow);
                }

                // 5f. Professor Abronsius & Alfred + Sunken Footsteps in the Snow (Polanski Homage!)
                if (minDim >= 48 && fgHeight >= 24) {
                    // Figure 1: Professor Abronsius in top-hat & coat climbing beside the bridge rail
                    const abX = Math.floor(bridgeStartX + (bridgeEndX - bridgeStartX) * 0.25) - px * 2;
                    const abY = Math.floor(bridgeStartY + (bridgeEndY - bridgeStartY) * 0.25);
                    const abH = Math.max(px * 5, Math.floor(fgHeight * 0.11));
                    this.drawPixelLine(ctx, width, height, abX, abY, abX + abH, abY + px, px, PAL.farMountain);
                    this.rect(ctx, width, height, abX, abY - abH, px * 2, abH, PAL.black);
                    this.rect(ctx, width, height, abX - px, abY - abH, px * 3, px, PAL.black); // Top-hat brim

                    // Figure 2: Alfred striding up the steep snow slope below in flared coat + lantern + footprints!
                    const alfX = Math.floor(width * 0.51);
                    const alfY = Math.min(height - px * 6, floorHorizonY + Math.floor(fgHeight * 0.64));
                    const alfH = Math.max(px * 7, Math.min(px * 12, Math.floor(fgHeight * 0.17)));

                    // Sunken blue-shadowed footprints trailing down-right in the snow behind Alfred
                    for (let st = 1; st <= 6; st++) {
                        const fpX = alfX + st * px * 2 + ((st & 1) ? px : 0);
                        const fpY = alfY + st * px * 3;
                        if (fpY < height - px) {
                            this.rect(ctx, width, height, fpX, fpY, px * 2, px, PAL.farMountain);
                        }
                    }

                    // Long cold moonlit shadow stretched diagonally onto the snow
                    this.drawPixelLine(ctx, width, height, alfX, alfY, alfX + Math.floor(alfH * 1.4), alfY + px * 3, px * 2, PAL.farMountain);

                    // Boots/trousers (`castleLight` slate-blue leggings like in the photo!), flared black coat & hat
                    const legH = Math.max(px * 2, Math.floor(alfH * 0.34));
                    this.rect(ctx, width, height, alfX, alfY - legH, px, legH, PAL.horizonBlue);
                    this.rect(ctx, width, height, alfX + px, alfY - legH + px, px, legH, PAL.black);
                    // Flared dark winter coat & outstretched arm
                    const coatH = alfH - legH;
                    this.rect(ctx, width, height, alfX - px, alfY - alfH + px * 2, px * 4, coatH - px, PAL.black);
                    this.rect(ctx, width, height, alfX - px * 2, alfY - Math.floor(alfH * 0.55), px * 2, px * 2, PAL.black);
                    this.rect(ctx, width, height, alfX - px, alfY - alfH + px * 2, px, Math.floor(coatH * 0.6), PAL.castleLight);
                    // Hat & head
                    this.rect(ctx, width, height, alfX, alfY - alfH, px * 2, px * 2, PAL.black);

                    // Warm glowing hand-lantern & snow reflection
                    const lanternCol = activePulse > 0.5 ? PAL.white : PAL.magicGold;
                    this.rect(ctx, width, height, alfX - px * 3, alfY - Math.floor(alfH * 0.50), px, px, lanternCol);
                    this.rect(ctx, width, height, alfX - px * 3, alfY, px, px, PAL.emberOrange);
                }

                // 5g. Tufted Snow-Laden Foreground Alpine Spruces (strictly >= floorHorizonY!)
                const maxFgTreeH = Math.max(8, fgHeight - px * 2);
                const windSway = Math.sin(this.internalT * 1.4) * (0.45 + tension * 0.65 + ch1 * 0.35);

                const leftHeroH = Math.min(maxFgTreeH, Math.floor(fgHeight * 0.90));
                const rightHeroH = Math.min(maxFgTreeH, Math.floor(fgHeight * 0.96));
                const cornerPineH = Math.min(maxFgTreeH, Math.floor(fgHeight * 0.54));

                // Far-left corner lower spruce + Left & Right Hero Framing Spruces (exact match to photo!)
                if (!isPortrait && minDim >= 40) {
                    this.drawDetailedSnowSpruce(
                        ctx, width, height,
                        Math.floor(width * 0.05),
                        height - 1, cornerPineH, 1, windSway * 0.7, activePulse, px
                    );
                }

                this.drawDetailedSnowSpruce(
                    ctx, width, height,
                    Math.floor(width * (isPortrait ? 0.11 : 0.22)),
                    height - 1, leftHeroH, 1, windSway, activePulse, px
                );
                this.drawDetailedSnowSpruce(
                    ctx, width, height,
                    Math.floor(width * (isPortrait ? 0.89 : 0.80)),
                    height - 1, rightHeroH, -1, -windSway, activePulse, px
                );

                if (isUltrawide && minDim >= 40) {
                    this.drawDetailedSnowSpruce(
                        ctx, width, height,
                        Math.floor(width * 0.94),
                        height - 1, Math.floor(rightHeroH * 0.64), -1, -windSway * 0.7, activePulse, px
                    );
                }
            }

            // --- LAYER 6: DRIFTING 3-LAYER WINTER SNOWFALL ---
            const activeFlakes = state === 'afterglow'
                ? Math.floor(MAX_SNOWFLAKES * 0.45)
                : (state === 'climax' ? MAX_SNOWFLAKES : Math.floor(MAX_SNOWFLAKES * (0.62 + tension * 0.38)));
            for (let i = 0; i < activeFlakes; i++) {
                const sf = this.snowflakes[i];
                const sx = Math.floor(sf.xRatio * width);
                const sy = Math.floor(sf.yRatio * height);
                const flakeCol = sf.layer === 2 ? PAL.white : (sf.layer === 1 ? PAL.moonSilver : PAL.midMountain);
                const flakeW = (sf.layer === 2 && minDim >= 100 && (state === 'climax' || state === 'buildup')) ? px * 2 : px;
                this.rect(ctx, width, height, sx, sy, flakeW, px, flakeCol);
            }
        }

        // State Machine Transition Fade (Native DOM-Free Bayer 4x4 Ordered Dither)
        const safeStateTime = Number.isFinite(stateTime) && stateTime > 0 ? stateTime : 0;
        let fadeAlpha = 1.0;
        if (state === 'starting') {
            fadeAlpha = Math.min(1.0, safeStateTime / 1.5);
        } else if (state === 'stopping') {
            fadeAlpha = Math.max(0.0, 1.0 - (safeStateTime / 1.5));
        }

        this.drawBayerFadeCurtain(ctx, width, height, fadeAlpha, px);
    }
}