// === js/visuals/dse/atari/enchanted-castle.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: ATARI ENCHANTED CASTLE (Background DSE)
// Authentic Atari ST 16-Color Shifter Night Fantasy Masterpiece (Wizard Edition):
// - Golden Ratio (Phi = 0.618 / 0.382 / 0.236) composition & Chiaroscuro lighting
//   cast from a crescent-shadowed full moon at the upper-left Golden Intersection.
// - 68000 Demo-Coder Architecture:
//   * Pre-baked 256-entry ridge LUTs (O(1) mountain rendering, zero per-frame trig).
//   * Adaptive Shifter Low-Res pixel scale (`px`) & 3-stage Bayer/checkerboard sky dither.
//   * True Z-occluded 3D orbiting mana ring around the Grand Sorcerer's Spire.
// - Bob Ross & Thalion Pixel-Art Craftsmanship:
//   * Faceted alpine ridges with moonlit snow-breaks & dithered valley mist.
//   * Sculpted multi-lobe cumulus clouds with moon-proximity transillumination.
//   * Cascading waterfall, arched stone viaduct bridge & dark alpine lake with
//     live horizontal water reflections (moon, windows, bridge arches & sky bursts).
//   * Repoussoir evergreen pine clusters with subtle wind-swaying crowns,
//     fluttering tower pennants, corbel machicolations & glowing cliff mana veins.
// - Musical DSE Choreography 2.0:
//   * Smooth internal decay envelopes (`beatEnv`, `hardBeatEnv`) + multi-band awareness.
//   * Jagged tower-to-sky arcane lightning conduits igniting graded magic bursts
//     (0 = Ring, 1 = Star-Cross, 2 = Climax Octagram Sigil).
// - 100% Atari ST 9-bit quantized 16-color palette (Zero-GC, deterministic).
// =========================================================

import {
    quantizeAtari9Bit,
    rgbToHex,
    applyOrderedDitherFade
} from '../../utils/hardware-constraints.js';

// --- STRICT 16-COLOR ATARI ST 9-BIT SHIFTER PALETTE ---
// Every color is bit-identically preserved under quantizeAtari9Bit(r, g, b).
export const ATARI_ENCHANTED_CASTLE_PALETTE = Object.freeze([
    rgbToHex(...quantizeAtari9Bit(0, 0, 0)),        // 0: Black (Void / Deep Shadow / Lake Abyss)
    rgbToHex(...quantizeAtari9Bit(36, 0, 72)),      // 1: Midnight Violet (Upper Sky)
    rgbToHex(...quantizeAtari9Bit(0, 36, 108)),     // 2: Deep Night Blue (Mid Sky / Lake Deep)
    rgbToHex(...quantizeAtari9Bit(36, 72, 144)),    // 3: Royal Horizon Blue (Low Sky / Mist)
    rgbToHex(...quantizeAtari9Bit(0, 36, 72)),      // 4: Distant Mountain Dark (Shadow Face)
    rgbToHex(...quantizeAtari9Bit(36, 72, 108)),    // 5: Distant Mountain Mid (Ridge / Slate)
    rgbToHex(...quantizeAtari9Bit(36, 36, 36)),     // 6: Castle Shadow / Dark Stonework
    rgbToHex(...quantizeAtari9Bit(72, 72, 108)),    // 7: Castle Stone Mid
    rgbToHex(...quantizeAtari9Bit(108, 108, 144)),  // 8: Castle Stone Light (Moonlit Edge)
    rgbToHex(...quantizeAtari9Bit(0, 36, 36)),      // 9: Foreground Pine / Hill Dark
    rgbToHex(...quantizeAtari9Bit(180, 216, 252)),  // 10: Moon Silver-Blue / Cloud / Snow Break
    rgbToHex(...quantizeAtari9Bit(252, 252, 252)),  // 11: Pure White (Stars / Spire Peak / Glint)
    rgbToHex(...quantizeAtari9Bit(252, 216, 36)),   // 12: Magic Gold (Window / Spark / Reflection)
    rgbToHex(...quantizeAtari9Bit(252, 72, 0)),     // 13: Ember Orange (Torch / Firework)
    rgbToHex(...quantizeAtari9Bit(0, 216, 216)),    // 14: Mystic Cyan (Runes / Energy / Waterfall)
    rgbToHex(...quantizeAtari9Bit(216, 0, 144))     // 15: Sorcery Magenta (Arcane Bursts / Aurora)
]);

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

// Golden Ratio Constants (Phi)
const PHI_MAJOR = 0.618034;
const PHI_MINOR = 0.381966;
const PHI_QUAD = 0.236068;

// Pre-computed craggy alpine peak definitions (Bob Ross palette-knife ridges)
const RIDGE_LUT_SIZE = 256;

const FAR_PEAKS = Object.freeze([
    Object.freeze({ pos: 0.08, height: 0.74, leftSlope: 5.4, rightSlope: 4.1 }),
    Object.freeze({ pos: 0.23, height: 0.94, leftSlope: 4.7, rightSlope: 3.5 }),
    Object.freeze({ pos: 0.38, height: 0.68, leftSlope: 5.2, rightSlope: 4.8 }),
    Object.freeze({ pos: 0.54, height: 0.86, leftSlope: 4.4, rightSlope: 3.9 }),
    Object.freeze({ pos: 0.74, height: 0.99, leftSlope: 3.7, rightSlope: 3.3 }),
    Object.freeze({ pos: 0.91, height: 0.77, leftSlope: 4.5, rightSlope: 4.9 })
]);

const MID_PEAKS = Object.freeze([
    Object.freeze({ pos: 0.04, height: 0.66, leftSlope: 4.8, rightSlope: 3.8 }),
    Object.freeze({ pos: 0.17, height: 0.89, leftSlope: 4.1, rightSlope: 3.2 }),
    Object.freeze({ pos: 0.33, height: 0.75, leftSlope: 4.6, rightSlope: 4.0 }),
    Object.freeze({ pos: 0.67, height: 0.83, leftSlope: 4.0, rightSlope: 3.5 }),
    Object.freeze({ pos: 0.83, height: 0.95, leftSlope: 3.5, rightSlope: 3.1 }),
    Object.freeze({ pos: 0.96, height: 0.63, leftSlope: 4.5, rightSlope: 4.8 })
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

        // Smooth internal DSE light/energy decay envelopes (Zero-GC scalar state)
        this.beatEnv = 0;
        this.hardBeatEnv = 0;

        // Pre-allocated bounded burst pool (Zero-GC)
        this.bursts = Array.from({ length: MAX_MAGIC_BURSTS }, () => ({
            active: false,
            xRatio: 0.5,
            yRatio: 0.25,
            originSlot: 0,
            startTime: -100,
            duration: 0.8,
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
                size: 1
            }))
        }));

        // Fixed stars arranged around Golden Ratio sky sectors (deterministic, Zero-GC)
        this.stars = [
            { x: 0.04, y: 0.07, phase: 0.1, mag: 2 },
            { x: 0.11, y: 0.18, phase: 1.5, mag: 1 },
            { x: 0.18, y: 0.05, phase: 2.8, mag: 2 },
            { x: 0.29, y: 0.14, phase: 4.1, mag: 1 },
            { x: 0.36, y: 0.09, phase: 0.7, mag: 2 },
            { x: 0.43, y: 0.24, phase: 3.3, mag: 1 },
            { x: 0.57, y: 0.06, phase: 1.9, mag: 2 },
            { x: 0.64, y: 0.19, phase: 5.2, mag: 1 },
            { x: 0.73, y: 0.11, phase: 2.4, mag: 2 },
            { x: 0.82, y: 0.08, phase: 0.4, mag: 2 },
            { x: 0.89, y: 0.22, phase: 3.7, mag: 1 },
            { x: 0.95, y: 0.14, phase: 4.9, mag: 1 },
            { x: 0.14, y: 0.34, phase: 1.2, mag: 1 },
            { x: 0.79, y: 0.31, phase: 2.6, mag: 1 }
        ];

        // Exactly two slowly drifting nocturnal cumulus clouds
        this.clouds = [
            { yRatio: 0.16, speed: 0.015, spanRatio: 0.22 },
            { yRatio: 0.33, speed: -0.011, spanRatio: 0.26 }
        ];

        // Pre-baked 68000-style Ridge Lookup Tables (Zero trig inside render!)
        this.farElevLUT = new Float32Array(RIDGE_LUT_SIZE);
        this.farSnowLUT = new Float32Array(RIDGE_LUT_SIZE);
        this.farFaceLUT = new Uint8Array(RIDGE_LUT_SIZE); // 2: moonlit, 1: crest rim, 0: shadow

        this.midElevLUT = new Float32Array(RIDGE_LUT_SIZE);
        this.midSnowLUT = new Float32Array(RIDGE_LUT_SIZE);
        this.midFaceLUT = new Uint8Array(RIDGE_LUT_SIZE);

        this.bakeRidgeLUT(FAR_PEAKS, this.farElevLUT, this.farSnowLUT, this.farFaceLUT);
        this.bakeRidgeLUT(MID_PEAKS, this.midElevLUT, this.midSnowLUT, this.midFaceLUT);
    }

    bakeRidgeLUT(peaks, elevOut, snowOut, faceOut) {
        for (let idx = 0; idx < RIDGE_LUT_SIZE; idx++) {
            const nx = idx / (RIDGE_LUT_SIZE - 1);
            let bestElevation = 0;
            let isMoonlitFace = false;
            let ridgeProximity = 1.0;

            for (let i = 0; i < peaks.length; i++) {
                const p = peaks[i];
                const diff = nx - p.pos;
                const slope = diff < 0 ? p.leftSlope : p.rightSlope;
                // Multi-octave palette-knife rock fractures
                const crag = Math.sin(nx * 47.0 + i * 2.1) * 0.038
                    + Math.cos(nx * 23.0 - i) * 0.026
                    + Math.sin(nx * 97.0 + i * 0.7) * 0.012;
                const elev = Math.max(0, p.height - Math.abs(diff) * slope + crag);

                if (elev > bestElevation) {
                    bestElevation = elev;
                    isMoonlitFace = diff < 0;
                    ridgeProximity = Math.abs(diff) * slope;
                }
            }

            elevOut[idx] = Math.min(1.0, bestElevation);
            snowOut[idx] = Math.max(0.06, 0.30 - ridgeProximity * 0.20);
            faceOut[idx] = isMoonlitFace ? 2 : (ridgeProximity < 0.06 ? 1 : 0);
        }
    }

    resize(width, height) {}

    // Safe bounded integer rect drawer
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

    triggerMagic(beatCount, strength, level, tension, state, time) {
        if (state === 'afterglow') return;

        // Smooth envelope boost even on subtle beats
        this.beatEnv = Math.max(this.beatEnv, strength);
        if (level >= 3 || strength >= 0.66) {
            this.hardBeatEnv = 1.0;
        }

        // In playing, keep sky bursts spare and controlled on very low strength
        if (state === 'playing' && strength < 0.15) {
            return;
        }

        const effectiveLevel = level > 0 ? level : (strength >= 2 / 3 ? 3 : strength >= 1 / 3 ? 2 : 1);
        const burst = this.bursts[this.burstCursor];
        this.burstCursor = (this.burstCursor + 1) % MAX_MAGIC_BURSTS;

        burst.active = true;
        burst.startTime = time;
        burst.strength = strength;
        burst.beatLevel = effectiveLevel;

        // Strictly graded: soft < medium < hard
        if (effectiveLevel === 1) {
            burst.radiusFactor = 0.50 + strength * 0.15;
            burst.particleCount = 12;
            burst.duration = 0.65;
            burst.pattern = 0; // Ring
            burst.color = PAL.mysticCyan;
            burst.secondaryColor = PAL.moonSilver;
        } else if (effectiveLevel === 2) {
            burst.radiusFactor = 0.80 + strength * 0.20;
            burst.particleCount = 20;
            burst.duration = 0.85;
            burst.pattern = (state === 'climax') ? 2 : 1;
            burst.color = (beatCount & 1) ? PAL.sorceryMagenta : PAL.magicGold;
            burst.secondaryColor = PAL.mysticCyan;
        } else {
            burst.radiusFactor = 1.15 + strength * 0.30;
            burst.particleCount = 32;
            burst.duration = 1.10;
            burst.pattern = (state === 'climax') ? 2 : 0;
            burst.color = (state === 'climax') ? PAL.magicGold : PAL.emberOrange;
            burst.secondaryColor = PAL.white;
        }

        // Tension & Climax choreography adjustments
        if (state === 'climax' || tension > 0.8) {
            burst.radiusFactor += 0.20;
            burst.pattern = 2; // Arcane octagram rune pattern in climax
        }

        // Alternating positions behind central keep, left watchtower, or right observatory
        const slot = (beatCount > 0 ? beatCount : this.burstCursor) % 3;
        burst.originSlot = slot;
        if (slot === 0) {
            burst.xRatio = 0.50; // Central keep
            burst.yRatio = 0.19;
        } else if (slot === 1) {
            burst.xRatio = 0.36; // Left watchtower
            burst.yRatio = 0.25;
        } else {
            burst.xRatio = 0.64; // Right observatory tower
            burst.yRatio = 0.23;
        }

        // Deterministic particle velocity vectors
        for (let i = 0; i < MAX_PARTICLES_PER_BURST; i++) {
            const angle = (i / burst.particleCount) * Math.PI * 2 + (beatCount * 0.42);
            const speed = 0.75 + (((i * 7 + (beatCount > 0 ? beatCount : 1)) % 5) / 5) * 0.55;
            burst.particles[i].dx = Math.cos(angle) * speed;
            burst.particles[i].dy = Math.sin(angle) * speed;
            burst.particles[i].size = (effectiveLevel === 3 && (i % 3 === 0)) ? 2 : 1;
        }
    }

    // 3-Stage Atari ST Shifter Ordered Checkerboard Sky Transition (25% -> 50% -> 75%)
    drawShifterDitherBand(ctx, width, height, centerY, span, topCol, botCol, px) {
        const stepX = px * 4;
        const halfSpan = Math.max(px, span);
        const third = Math.max(px, Math.floor(halfSpan / 1.5));

        for (let dy = -halfSpan; dy < halfSpan; dy += px) {
            const y = centerY + dy;
            if (y < 0 || y >= height) continue;
            const rowParity = Math.floor((y / px)) & 1;

            if (dy < -third) {
                // 25% density of botCol over topCol
                if (rowParity === 0) {
                    for (let x = 0; x < width; x += stepX) {
                        this.rect(ctx, width, height, x, y, px, px, botCol);
                    }
                }
            } else if (dy < third) {
                // 50% Atari ST checkerboard blend
                const xOffset = rowParity * (px * 2);
                for (let x = xOffset; x < width; x += stepX) {
                    this.rect(ctx, width, height, x, y, px * 2, px, dy < 0 ? botCol : topCol);
                }
            } else {
                // 75% density (sparse 25% flecks of topCol over botCol)
                if (rowParity === 1) {
                    for (let x = px * 2; x < width; x += stepX) {
                        this.rect(ctx, width, height, x, y, px, px, topCol);
                    }
                }
            }
        }
    }

    // Sculpted Thalion-Style Multi-Lobe Cumulus Cloud with Moon Transillumination
    drawCumulusCloud(ctx, width, height, cX, cY, cWidth, cHeight, moonX, moonY, px) {
        const distToMoon = Math.hypot((cX + cWidth * 0.5) - moonX, cY - moonY);
        const nearMoon = distToMoon < cWidth * 0.95;

        // Flat nocturnal shadow base + trailing raster wisps
        this.rect(ctx, width, height, cX + px * 2, cY + cHeight - px, cWidth - px * 2, px, PAL.deepBlue);
        this.rect(ctx, width, height, cX - px * 3, cY + cHeight - px, px * 2, px, PAL.horizonBlue);
        this.rect(ctx, width, height, cX + cWidth + px, cY + cHeight - px, px * 2, px, PAL.deepBlue);

        // Main cloud body
        this.rect(ctx, width, height, cX, cY, cWidth, Math.max(px, cHeight - px), PAL.horizonBlue);

        // Asymmetric billowing cumulus domes (Golden Ratio lobe proportions)
        const lobe1W = Math.floor(cWidth * 0.42);
        const lobe2W = Math.floor(cWidth * 0.34);
        const lobe1X = cX + Math.floor(cWidth * 0.12);
        const lobe2X = cX + Math.floor(cWidth * 0.48);

        this.rect(ctx, width, height, lobe1X, cY - px * 2, lobe1W, px * 2 + px, PAL.moonSilver);
        this.rect(ctx, width, height, lobe2X, cY - px, lobe2W, px * 2, PAL.moonSilver);

        // Crisp chiaroscuro rim facing the moon (glows brighter when passing near moon!)
        const rimCol = nearMoon ? PAL.white : PAL.moonSilver;
        this.rect(ctx, width, height, lobe1X + px, cY - px * 3, Math.max(px, Math.floor(lobe1W * 0.65)), px, PAL.white);
        this.rect(ctx, width, height, cX, cY, Math.max(px, Math.floor(cWidth * 0.22)), px, rimCol);
        if (nearMoon) {
            this.rect(ctx, width, height, lobe2X + px, cY - px * 2, Math.max(px, Math.floor(lobe2W * 0.6)), px, PAL.white);
        }
    }

    // O(1) Pre-Baked Bob Ross Palette-Knife Mountain Range Drawer (Zero per-frame trig!)
    drawAlpineRange(ctx, width, height, horizonY, maxPeakHeight, elevLUT, snowLUT, faceLUT, shadowCol, midCol, lightCol, mistCol, px) {
        const step = Math.max(1, px);
        const invWidth = (RIDGE_LUT_SIZE - 1) / Math.max(1, width - 1);
        const mistH = Math.max(px * 2, Math.floor(maxPeakHeight * 0.18));

        for (let x = 0; x < width; x += step) {
            const idx = Math.min(RIDGE_LUT_SIZE - 1, (x * invWidth) | 0);
            const mHeight = Math.floor(maxPeakHeight * elevLUT[idx]);
            if (mHeight <= 0) continue;

            const topY = horizonY - mHeight;
            const face = faceLUT[idx];

            // 1. Base Mountain Mass
            const bodyCol = face === 2 ? midCol : shadowCol;
            this.rect(ctx, width, height, x, topY, step, mHeight, bodyCol);

            // 2. Bob Ross "Breaking the Snow/Moonlight on the Ridge"
            if (face === 2) {
                const snowCapH = Math.max(px, Math.floor(mHeight * snowLUT[idx]));
                this.rect(ctx, width, height, x, topY, step, snowCapH, lightCol);

                // Diagonal palette-knife rock strata strokes descending down the moonlit slope
                const colIdx = (x / step) | 0;
                if (((colIdx + (topY >> 1)) & 3) === 0 && mHeight > px * 5) {
                    const streakOffset = ((colIdx * 5) % Math.max(1, Math.floor(mHeight * 0.48)));
                    this.rect(ctx, width, height, x, topY + snowCapH + streakOffset, step, px * 2, lightCol);
                }
            } else if (face === 1) {
                // Crisp rim-light right along the knife-edge ridge crest
                this.rect(ctx, width, height, x, topY, step, px, midCol);
            }

            // 3. Bob Ross "Tap the Mist at the Base" (2-tier raster valley fog)
            const colParity = ((x / step) | 0) & 1;
            const mistStart = Math.max(topY, horizonY - mistH);
            const lowerMistStart = Math.max(topY, horizonY - Math.floor(mistH * 0.5));
            if (colParity === 0) {
                this.rect(ctx, width, height, x, mistStart, step, horizonY - mistStart, mistCol);
            } else if (horizonY > lowerMistStart) {
                this.rect(ctx, width, height, x, lowerMistStart, step, horizonY - lowerMistStart, mistCol);
            }
        }
    }

    // Bob Ross "Happy Little Evergreen" with Moonlit Boughs & Subtle Wind Sway (Zero-GC)
    drawEvergreen(ctx, width, height, pineX, pineBaseY, pineHeight, isForeground, windSway, px) {
        const pH = Math.max(6, Math.floor(pineHeight));
        const pW = Math.max(4, Math.floor(pH * 0.62));
        const trunkW = Math.max(px, Math.floor(pW * 0.22));
        const trunkH = Math.max(px * 2, Math.floor(pH * 0.20));

        // Trunk
        this.rect(ctx, width, height, pineX - Math.floor(trunkW / 2), pineBaseY - trunkH, trunkW, trunkH, PAL.castleShadow);

        // Wind-swaying leader tip pointing into the night sky
        const topSway = Math.round(windSway * px);
        this.rect(ctx, width, height, pineX + topSway, pineBaseY - pH - px, px, px * 2, PAL.moonSilver);

        const foliageH = pH - trunkH;
        const tiers = 4;
        const tierH = Math.max(2, Math.floor(foliageH / tiers));

        for (let t = 0; t < tiers; t++) {
            const tTop = pineBaseY - trunkH - (t + 1) * tierH;
            const maxTierW = Math.max(2, Math.floor(pW * (1.0 - t * 0.21)));
            // Upper tiers gently sway in the nocturnal breeze, base stays rooted
            const tierShift = t >= 2 ? topSway : 0;

            for (let row = 0; row < tierH; row += px) {
                const progress = (row + px) / tierH;
                const flare = (row + px >= tierH) ? px * 2 : 0;
                const rw = Math.max(px, Math.floor(maxTierW * progress) + flare);
                const rx = pineX + tierShift - Math.floor(rw / 2);
                const ry = tTop + row;

                // Deep shadow boughs on the right (away from moon)
                this.rect(ctx, width, height, rx, ry, rw, px, isForeground ? PAL.black : PAL.foregroundDark);
                // Core evergreen foliage
                this.rect(ctx, width, height, rx, ry, Math.max(px, Math.floor(rw * 0.72)), px, PAL.foregroundDark);
                // Moonlit silver/slate highlight on the left bough tips
                const highlightW = Math.max(px, Math.floor(rw * 0.28));
                const hiCol = (row + px >= tierH && t >= 1) ? PAL.moonSilver : PAL.midMountain;
                this.rect(ctx, width, height, rx, ry, highlightW, px, hiCol);
            }
        }
    }

    // Gothic Pointed-Arch Window with Mullions & Moonlit Sill (Zero-GC)
    drawGothicWindow(ctx, width, height, wx, wy, ww, wh, glowCol, px) {
        const w = Math.max(2, Math.floor(ww));
        const h = Math.max(3, Math.floor(wh));
        const x = Math.floor(wx);
        const y = Math.floor(wy);

        // Deep stone recess
        this.rect(ctx, width, height, x - px, y, w + px * 2, h + px, PAL.castleShadow);
        // Pointed gothic arch crown
        if (w >= 3) {
            this.rect(ctx, width, height, x + 1, y - px, Math.max(1, w - 2), px, glowCol);
        }
        // Main stained-glass / illuminated pane
        this.rect(ctx, width, height, x, y, w, h, glowCol);
        // Hot inner core highlight
        if (w >= 2 && h >= 3) {
            const coreCol = (glowCol === PAL.mysticCyan || glowCol === PAL.magicGold) ? PAL.white : PAL.magicGold;
            this.rect(ctx, width, height, x, y + 1, px, Math.max(1, h - 2), coreCol);
        }
        // Moonlit stone sill at bottom
        this.rect(ctx, width, height, x - px, y + h, w + px * 2, px, PAL.castleLight);
    }

    // Fluttering Medieval Tower Pennant / Banner (Zero-GC)
    drawBanner(ctx, width, height, poleX, topY, bannerLen, mainCol, tipCol, tension, px) {
        // Iron finial pole
        this.rect(ctx, width, height, poleX, topY - px * 3, px, px * 3, PAL.moonSilver);
        const speed = 5.0 + tension * 6.0;
        const segments = Math.max(2, Math.min(5, Math.floor(bannerLen / px)));
        for (let s = 0; s < segments; s++) {
            const waveY = Math.round(Math.sin(this.internalT * speed - s * 1.1) * px);
            const segH = s < segments - 1 ? px * 2 : px;
            const col = s === segments - 1 ? tipCol : mainCol;
            this.rect(ctx, width, height, poleX + px + s * px, topY - px * 3 + waveY, px, segH, col);
        }
    }

    // Half-Pass of 3D Z-Occluded Atari ST Orbiting Mana Ring (frontPass = false -> behind spire, true -> in front)
    drawSpireAstralRing(ctx, width, height, centerX, centerY, rx, ry, tension, pulse, frontPass, px) {
        const dots = 8;
        const baseAngle = this.internalT * (2.6 + tension * 2.4);
        for (let i = 0; i < dots; i++) {
            const a = baseAngle + (i * Math.PI * 2) / dots;
            const z = Math.sin(a);
            if ((frontPass && z < 0) || (!frontPass && z >= 0)) continue;

            const dx = Math.round(Math.cos(a) * rx);
            const dy = Math.round(z * ry);
            const size = (frontPass && pulse > 0.45) ? px * 2 : px;
            const col = (i & 1)
                ? (frontPass ? PAL.white : PAL.mysticCyan)
                : (pulse > 0.5 ? PAL.magicGold : PAL.sorceryMagenta);
            this.rect(ctx, width, height, centerX + dx, centerY + dy, size, size, col);
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
            // Timeline scrubbed backward: cleanly reset transient beat state
            this.lastBeatCount = -1;
            this.beatEnv = 0;
            this.hardBeatEnv = 0;
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

        // Exponential decay of internal light/palette envelopes (Zero-GC)
        this.beatEnv = Math.max(0, this.beatEnv - dt * 2.6);
        this.hardBeatEnv = Math.max(0, this.hardBeatEnv - dt * 1.9);

        // Defensive metrics & optional multi-band reading
        const safeMetrics = metrics || {};
        const tension = Number.isFinite(safeMetrics.tensionPct)
            ? Math.max(0, Math.min(1, safeMetrics.tensionPct))
            : (state === 'climax' ? 0.9 : state === 'buildup' ? 0.65 : state === 'afterglow' ? 0.15 : 0.35);

        const rawImpulse0 = (safeMetrics.beatImpulse && Number.isFinite(safeMetrics.beatImpulse[0]))
            ? Math.max(0, Math.min(1, safeMetrics.beatImpulse[0]))
            : (safeMetrics.beat && Number.isFinite(safeMetrics.beat[0]) ? Math.max(0, Math.min(1, safeMetrics.beat[0])) : 0);

        const beatStrength = Number.isFinite(safeMetrics.beatStrength)
            ? Math.max(0, Math.min(1, safeMetrics.beatStrength))
            : (rawImpulse0 > 0 ? rawImpulse0 : (safeMetrics.beatStarted ? 0.5 : 0));

        let beatLevel = Number.isInteger(safeMetrics.beatLevel) && safeMetrics.beatLevel >= 0 && safeMetrics.beatLevel <= 3
            ? safeMetrics.beatLevel
            : (beatStrength >= 2 / 3 ? 3 : beatStrength >= 1 / 3 ? 2 : (beatStrength > 0 ? 1 : 0));

        // Beat onset trigger (updates beatEnv & spawns graded bursts)
        if (safeMetrics.beatStarted) {
            const beatCount = Number.isFinite(safeMetrics.beatCount)
                ? safeMetrics.beatCount
                : this.lastBeatCount + 1;

            if (beatCount !== this.lastBeatCount) {
                this.lastBeatCount = beatCount;
                this.triggerMagic(beatCount, beatStrength, beatLevel, tension, state, t);
            }
        }

        // Unified musical pulse & optional spectral band followers
        const activePulse = state === 'afterglow'
            ? Math.min(0.25, rawImpulse0 * 0.4)
            : Math.max(rawImpulse0, this.beatEnv);

        const bassEnergy = Number.isFinite(safeMetrics.bass)
            ? Math.max(activePulse, Math.max(0, Math.min(1, safeMetrics.bass)))
            : activePulse;

        const highEnergy = (safeMetrics.beatImpulse && Number.isFinite(safeMetrics.beatImpulse[2]))
            ? Math.max(0, Math.min(1, safeMetrics.beatImpulse[2]))
            : (Number.isFinite(safeMetrics.high) ? Math.max(0, Math.min(1, safeMetrics.high)) : activePulse * 0.8);

        // =========================================================
        // MASTER GOLDEN RATIO (PHI) & SHIFTER PIXEL GEOMETRY
        // =========================================================
        const minDim = Math.min(width, height);
        // Virtual Atari ST Low-Res pixel unit: crisp chunky pixels on HD, 1px on small canvases
        const px = Math.max(1, Math.floor(minDim / 220));
        const cx = Math.floor(width / 2);
        const horizonY = Math.max(1, Math.floor(height * PHI_MAJOR));

        // Pre-calculate key citadel coordinates so Layer 2 spell conduits connect to exact spire tips!
        const castleW = Math.max(24, Math.min(Math.floor(width * 0.85), Math.floor(minDim * 0.72)));
        const castleH = Math.max(16, Math.floor(castleW * 0.60));
        const castleBaseY = Math.min(height - 4, horizonY + Math.max(2, Math.floor(height * 0.06)));
        const castleLeft = Math.floor(cx - castleW / 2);

        const lTowW = Math.max(6, Math.floor(castleW * 0.22));
        const lTowH = Math.floor(castleH * 0.78);
        const lTowX = castleLeft;
        const lTowY = castleBaseY - lTowH;
        const lRoofH = Math.max(4, Math.floor(lTowW * 1.25));

        const rTowW = Math.max(6, Math.floor(castleW * 0.24));
        const rTowH = Math.floor(castleH * 0.88);
        const rTowX = castleLeft + castleW - rTowW;
        const rTowY = castleBaseY - rTowH;
        const rRoofH = Math.max(4, Math.floor(rTowW * 1.35));

        const keepW = Math.max(8, Math.floor(castleW * 0.32));
        const keepH = castleH;
        const keepX = Math.floor(cx - keepW / 2);
        const keepY = castleBaseY - keepH;
        const spireH = Math.max(6, Math.floor(keepW * 1.55));
        const crystalY = keepY - spireH - px * 2;

        // --- LAYER 1: SKY & ASTRONOMY ---
        this.rect(ctx, width, height, 0, 0, width, height, PAL.midnightViolet);

        if (horizonY > 3) {
            const h1 = Math.floor(horizonY * PHI_MINOR);
            const h2 = Math.floor(horizonY * (1.0 - PHI_QUAD));

            this.rect(ctx, width, height, 0, 0, width, h1, PAL.midnightViolet);
            if (h2 > h1) {
                this.rect(ctx, width, height, 0, h1, width, h2 - h1, PAL.deepBlue);
            }
            if (horizonY > h2) {
                this.rect(ctx, width, height, 0, h2, width, horizonY - h2, PAL.horizonBlue);
            }

            // 3-Stage Atari ST Shifter Checkerboard Dither Bands
            const ditherSpan = Math.max(px * 2, Math.min(px * 7, Math.floor(horizonY * 0.055)));
            this.drawShifterDitherBand(ctx, width, height, h1, ditherSpan, PAL.midnightViolet, PAL.deepBlue, px);
            this.drawShifterDitherBand(ctx, width, height, h2, ditherSpan, PAL.deepBlue, PAL.horizonBlue, px);

            // Arcane Borealis / Mana Curtains during high musical tension or climax
            if ((tension > 0.52 || state === 'climax') && minDim >= 24) {
                const auroraCols = Math.min(40, Math.max(8, Math.floor(width / (px * 8))));
                const colW = Math.max(px * 2, Math.floor(width / auroraCols));
                const baseAuroraY = Math.floor(horizonY * 0.25);
                for (let i = 0; i < auroraCols; i++) {
                    const wave = Math.sin(i * 0.42 + this.internalT * 2.1) + Math.cos(i * 0.27 - this.internalT * 1.3);
                    if (wave > 0.32) {
                        const ax = i * colW;
                        const ay = baseAuroraY + Math.floor(wave * (horizonY * 0.075));
                        const ah = Math.max(px * 2, Math.floor((wave - 0.32) * (horizonY * 0.15) * (0.55 + activePulse * 0.65)));
                        const aCol = ((i + Math.floor(this.internalT * 3)) & 1) ? PAL.mysticCyan : PAL.sorceryMagenta;
                        this.rect(ctx, width, height, ax, ay, Math.max(px, colW - px), ah, aCol);
                        // Bright lower aurora fringe
                        this.rect(ctx, width, height, ax, ay + ah - px, Math.max(px, colW - px), px, PAL.moonSilver);
                    }
                }
            }

            // Thalion-style Horizon Shifter Raster Bars synced to bass/beat
            if ((bassEnergy > 0.32 || state === 'climax') && horizonY >= px * 4) {
                const barH = (this.hardBeatEnv > 0.4 || beatLevel === 3) ? px * 3 : px * 2;
                this.rect(ctx, width, height, 0, horizonY - barH, width, barH, PAL.mysticCyan);
                this.rect(ctx, width, height, 0, horizonY - barH - px * 2, width, px, PAL.sorceryMagenta);
                if (this.hardBeatEnv > 0.5) {
                    this.rect(ctx, width, height, 0, horizonY - px, width, px, PAL.white);
                }
            }
        }

        if (minDim >= 8) {
            // 1b. Twinkling Stars (High-frequency shimmer responsive)
            for (let i = 0; i < this.stars.length; i++) {
                const s = this.stars[i];
                const sx = Math.floor(s.x * width);
                const sy = Math.floor(s.y * horizonY);
                if (sx < 0 || sx >= width || sy < 0 || sy >= horizonY) continue;

                const twinkle = Math.sin(this.internalT * 3.6 + s.phase) + highEnergy * 0.35;
                if (twinkle > 0.62) {
                    this.rect(ctx, width, height, sx, sy, px, px, PAL.white);
                    if ((twinkle > 0.95 || (s.mag === 2 && activePulse > 0.5)) && minDim >= 48) {
                        this.rect(ctx, width, height, sx - px, sy, px * 3, px, PAL.moonSilver);
                        this.rect(ctx, width, height, sx, sy - px, px, px * 3, PAL.moonSilver);
                        this.rect(ctx, width, height, sx, sy, px, px, PAL.white);
                    }
                } else if (twinkle > 0.05) {
                    this.rect(ctx, width, height, sx, sy, px, px, PAL.moonSilver);
                } else {
                    this.rect(ctx, width, height, sx, sy, px, px, PAL.horizonBlue);
                }
            }

            // Deterministic Shooting Star on high tension / climax
            if ((state === 'climax' || tension > 0.70) && minDim >= 40) {
                const meteorPhase = (this.internalT * 0.85) % 3.0;
                if (meteorPhase < 0.45) {
                    const mp = meteorPhase / 0.45;
                    const mx = Math.floor(width * (0.78 - mp * 0.28));
                    const my = Math.floor(horizonY * (0.08 + mp * 0.22));
                    this.rect(ctx, width, height, mx, my, px * 2, px, PAL.white);
                    this.rect(ctx, width, height, mx + px * 2, my - px, px * 3, px, PAL.mysticCyan);
                    this.rect(ctx, width, height, mx + px * 5, my - px * 2, px * 3, px, PAL.horizonBlue);
                }
            }

            // 1c. Luminous Moon at Upper-Left Golden Ratio Intersection (0.236, 0.236)
            const moonR = Math.max(3, Math.min(Math.floor(px * 11), Math.floor(minDim * 0.054)));
            const moonX = Math.floor(width * (width < height ? 0.22 : PHI_QUAD));
            const moonY = Math.max(moonR + px * 2, Math.floor(horizonY * PHI_QUAD));

            // Dithered Moon Corona / Halo
            if (minDim >= 36) {
                const haloR = moonR + px * 2 + (activePulse > 0.4 ? px * 2 : 0) + (tension > 0.65 ? px : 0);
                for (let hy = -haloR; hy <= haloR; hy += px * 2) {
                    const hdx = Math.round(Math.sqrt(Math.max(0, haloR * haloR - hy * hy)));
                    if (hdx > 0) {
                        this.rect(ctx, width, height, moonX - hdx, moonY + hy, hdx * 2, px, PAL.horizonBlue);
                    }
                }
            }

            // Sculpted Moon Disc with Chiaroscuro Crescent Core & Maria Craters
            for (let my = -moonR; my <= moonR; my++) {
                const dx = Math.round(Math.sqrt(Math.max(0, moonR * moonR - my * my)));
                if (dx > 0) {
                    this.rect(ctx, width, height, moonX - dx, moonY + my, dx * 2, 1, PAL.moonSilver);
                    if (dx > 1) {
                        this.rect(ctx, width, height, moonX - dx + 1, moonY + my, Math.max(1, Math.floor(dx * 1.35)), 1, PAL.white);
                    }
                    if (dx > 2 && my > -moonR * 0.55 && my < moonR * 0.65) {
                        this.rect(ctx, width, height, moonX + Math.floor(dx * 0.28), moonY + my, Math.max(1, Math.floor(dx * 0.58)), 1, PAL.horizonBlue);
                    }
                }
            }

            // 1d. Exactly two sculpted nocturnal cumulus clouds with moon transillumination
            for (let ci = 0; ci < this.clouds.length; ci++) {
                const cloud = this.clouds[ci];
                const cWidth = Math.max(12, Math.floor(width * cloud.spanRatio));
                const cHeight = Math.max(3, Math.floor(minDim * 0.032));
                const cY = Math.floor(horizonY * cloud.yRatio);
                const drift = Math.floor(this.internalT * width * cloud.speed);
                const span = width + cWidth * 2;
                let cX = ((Math.floor(width * (ci === 0 ? 0.15 : 0.65)) + drift + cWidth) % span);
                if (cX < 0) cX += span;
                cX -= cWidth;

                this.drawCumulusCloud(ctx, width, height, cX, cY, cWidth, cHeight, moonX, moonY, px);
            }

            // --- LAYER 2: DISTANT MAGIC, SPIRE CONVERGENCE & SPELL CONDUITS ---
            // 2a. Sculpted Spire Convergence Ray behind Keep
            if (tension > 0.45 || state === 'climax' || state === 'buildup') {
                const rayW = Math.max(px * 2, Math.floor(minDim * (0.020 + activePulse * 0.016)));
                const rayH = Math.floor(horizonY * (0.38 + tension * 0.36 + activePulse * 0.18));
                const rayX = Math.floor(cx - rayW / 2);
                const rayTop = Math.max(0, horizonY - rayH);
                const primaryRayCol = (state === 'climax') ? PAL.magicGold : PAL.mysticCyan;
                const outerRayCol = (state === 'climax') ? PAL.emberOrange : PAL.sorceryMagenta;

                this.rect(ctx, width, height, rayX - px, rayTop + px * 3, rayW + px * 2, Math.max(1, rayH - px * 3), outerRayCol);
                this.rect(ctx, width, height, rayX, rayTop, rayW, rayH, primaryRayCol);
                this.rect(ctx, width, height, cx - Math.floor(px / 2), rayTop + px * 2, px, Math.max(1, rayH - px * 2), PAL.white);

                // Ascending mana motes along the convergence pillar
                if (minDim >= 32) {
                    for (let m = 0; m < 4; m++) {
                        const moteProgress = ((this.internalT * 1.9 + m * 0.25) % 1.0);
                        const my = horizonY - Math.floor(moteProgress * rayH);
                        const mx = cx + ((m & 1) ? -rayW - px * 2 : rayW + px);
                        this.rect(ctx, width, height, mx, my, px, px * 2, PAL.white);
                    }
                }
            }

            // 2b. Tower-Launched Spell Conduits & Graded Arcane Bursts (Patterns 0, 1, and 2)
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

                // Arcane Lightning Conduit shooting from the casting tower spire into the burst core!
                if (progress < 0.24 && minDim >= 24) {
                    const srcX = burst.originSlot === 0
                        ? cx
                        : (burst.originSlot === 1 ? lTowX + Math.floor(lTowW / 2) : rTowX + Math.floor(rTowW / 2));
                    const srcY = burst.originSlot === 0
                        ? crystalY
                        : (burst.originSlot === 1 ? lTowY - lRoofH : rTowY - rRoofH);

                    const boltSteps = 6;
                    for (let s = 0; s < boltSteps; s++) {
                        const frac = (s + 0.5) / boltSteps;
                        const jag = (s > 0 && s < boltSteps - 1)
                            ? (((s + bi) & 1) ? px * 2 : -px * 2)
                            : 0;
                        const bx = Math.floor(srcX + (burstCX - srcX) * frac) + jag;
                        const by = Math.floor(srcY + (burstCY - srcY) * frac);
                        const segH = Math.max(px, Math.ceil(Math.abs(burstCY - srcY) / boltSteps));
                        this.rect(ctx, width, height, bx, by, px, segH, progress < 0.12 ? PAL.white : burst.color);
                    }
                }

                const curRadius = burst.radiusFactor * minDim * 0.24 * Math.sin(progress * Math.PI * 0.5);
                const gravityDrop = progress * progress * 8 * px;

                // Pattern 2: Climax / High-Tension Arcane Octagram Sigil
                if (burst.pattern === 2 && progress < 0.78 && minDim >= 24) {
                    const runeR = Math.max(px * 2, Math.floor(curRadius * 0.56));
                    const runeCol = progress < 0.38 ? PAL.white : burst.secondaryColor;
                    this.rect(ctx, width, height, burstCX - runeR, burstCY, runeR * 2 + px, px, runeCol);
                    this.rect(ctx, width, height, burstCX, burstCY - runeR, px, runeR * 2 + px, runeCol);

                    const boxR = Math.max(px, Math.floor(runeR * 0.66));
                    this.rect(ctx, width, height, burstCX - boxR, burstCY - boxR, boxR * 2 + px, px, burst.color);
                    this.rect(ctx, width, height, burstCX - boxR, burstCY + boxR, boxR * 2 + px, px, burst.color);
                    this.rect(ctx, width, height, burstCX - boxR, burstCY - boxR, px, boxR * 2 + px, burst.color);
                    this.rect(ctx, width, height, burstCX + boxR, burstCY - boxR, px, boxR * 2 + px, burst.color);
                }

                // Pattern 1: Star-Cross Core Flare
                if (burst.pattern === 1 && progress < 0.45) {
                    const sparkR = Math.max(px, Math.floor(minDim * 0.028 * (1.0 - progress / 0.45)));
                    this.rect(ctx, width, height, burstCX - sparkR, burstCY, sparkR * 2 + px, px, PAL.white);
                    this.rect(ctx, width, height, burstCX, burstCY - sparkR, px, sparkR * 2 + px, PAL.white);
                }

                // Expanding Particle Ring & Comet Trails
                for (let pi = 0; pi < burst.particleCount; pi++) {
                    const p = burst.particles[pi];
                    const pxPos = Math.floor(burstCX + p.dx * curRadius);
                    const pyPos = Math.floor(burstCY + p.dy * curRadius + gravityDrop);
                    const pSize = p.size * px;

                    if (pxPos >= 0 && pxPos < width && pyPos >= 0 && pyPos < height) {
                        const pColor = (progress > 0.62) ? burst.secondaryColor : burst.color;
                        this.rect(ctx, width, height, pxPos, pyPos, pSize, pSize, pColor);

                        if (burst.beatLevel >= 2 && progress > 0.15 && progress < 0.78) {
                            const tx = Math.floor(burstCX + p.dx * (curRadius * 0.82));
                            const ty = Math.floor(burstCY + p.dy * (curRadius * 0.82) + gravityDrop * 0.75);
                            this.rect(ctx, width, height, tx, ty, px, px, burst.secondaryColor);
                        }
                    }
                }
            }

            // --- LAYER 3: DISTANT MOUNTAINS (O(1) Pre-Baked Ridges & Valley Mist) ---
            const farMaxH = Math.floor(horizonY * 0.42);
            this.drawAlpineRange(
                ctx, width, height, horizonY, farMaxH,
                this.farElevLUT, this.farSnowLUT, this.farFaceLUT,
                PAL.farMountain, PAL.midMountain, PAL.moonSilver, PAL.horizonBlue, px
            );

            const midMaxH = Math.floor(horizonY * 0.25);
            this.drawAlpineRange(
                ctx, width, height, horizonY, midMaxH,
                this.midElevLUT, this.midSnowLUT, this.midFaceLUT,
                PAL.castleShadow, PAL.farMountain, PAL.castleLight, PAL.deepBlue, px
            );

            // --- LAYER 4: PROMONTORY CLIFF & THE ENCHANTED CITADEL ---
            // 4a. Craggy Promontory Cliff with Bass-Driven Glowing Mana Veins
            const cliffH = Math.max(4, Math.floor((height - castleBaseY) * 0.52));
            const cliffTopW = Math.floor(castleW * 0.92);
            const showCliffRunes = (this.hardBeatEnv > 0.25 || state === 'climax' || (tension > 0.68 && bassEnergy > 0.45));

            for (let cy = 0; cy < cliffH; cy++) {
                const ratio = cy / Math.max(1, cliffH);
                const rowW = Math.floor(cliffTopW * (1.0 - ratio * 0.25));
                const rowX = Math.floor(cx - rowW / 2);
                const drawY = castleBaseY + cy;

                this.rect(ctx, width, height, rowX, drawY, rowW, 1, PAL.castleShadow);
                const litW = Math.max(px * 2, Math.floor(rowW * (0.38 - ratio * 0.15)));
                this.rect(ctx, width, height, rowX, drawY, litW, 1, (cy & 1) ? PAL.castleStone : PAL.midMountain);
                this.rect(ctx, width, height, rowX, drawY, px * 2, 1, PAL.castleLight);

                // Glowing arcane ley-line veins pulsing up the cliff rock into the castle gate!
                if (showCliffRunes && (cy % (px * 2) === 0)) {
                    const veinOffset = Math.round(Math.sin(ratio * 6.0 + this.internalT * 4.0) * px * 2);
                    const veinCol = this.hardBeatEnv > 0.5 ? PAL.magicGold : PAL.mysticCyan;
                    this.rect(ctx, width, height, cx + veinOffset, drawY, px, px, veinCol);
                }
            }

            // 4b. Castle Main Curtain Wall & Masonry
            const wallW = Math.floor(castleW * 0.68);
            const wallH = Math.floor(castleH * 0.48);
            const wallX = Math.floor(cx - wallW / 2);
            const wallY = castleBaseY - wallH;

            this.rect(ctx, width, height, wallX - px, wallY - px, wallW + px * 2, wallH + px, PAL.castleShadow);
            this.rect(ctx, width, height, wallX, wallY, wallW, wallH, PAL.castleStone);
            this.rect(ctx, width, height, cx, wallY, Math.floor(wallW / 2), wallH, PAL.castleShadow);

            for (let my = wallY + px * 4; my < castleBaseY - px * 2; my += px * 4) {
                this.rect(ctx, width, height, wallX + px, my, Math.floor(wallW * 0.48), px, PAL.castleShadow);
            }

            // Curtain Wall Crenellations (Merlons)
            const numMerlons = Math.max(3, Math.floor(wallW / (px * 5)));
            const merlonStep = wallW / numMerlons;
            for (let m = 0; m < numMerlons; m++) {
                if ((m & 1) === 0) {
                    const mx = wallX + Math.floor(m * merlonStep);
                    const mw = Math.max(px * 2, Math.floor(merlonStep * 0.75));
                    this.rect(ctx, width, height, mx, wallY - px * 3, mw, px * 3, PAL.castleStone);
                    this.rect(ctx, width, height, mx, wallY - px * 3, mw, px, PAL.castleLight);
                }
            }

            // 4c. Left Bastion Watchtower & Fluttering Pennant
            this.rect(ctx, width, height, lTowX - px, lTowY - px, lTowW + px * 2, lTowH + px, PAL.castleShadow);
            this.rect(ctx, width, height, lTowX, lTowY, lTowW, lTowH, PAL.castleStone);
            this.rect(ctx, width, height, lTowX, lTowY, Math.max(px, Math.floor(lTowW * 0.3)), lTowH, PAL.castleLight);
            this.rect(ctx, width, height, lTowX + Math.floor(lTowW * 0.7), lTowY, Math.max(px, Math.ceil(lTowW * 0.3)), lTowH, PAL.castleShadow);

            // Corbel Machicolations & Battlement Collar
            this.rect(ctx, width, height, lTowX - px, lTowY, lTowW + px * 2, px * 2, PAL.castleLight);
            this.rect(ctx, width, height, lTowX - px, lTowY + px * 2, lTowW + px * 2, px, PAL.black);

            for (let ry = 0; ry < lRoofH; ry++) {
                const rw = Math.max(1, Math.floor((lTowW + px * 2) * (1.0 - ry / lRoofH)));
                const rx = lTowX - px + Math.floor((lTowW + px * 2 - rw) / 2);
                this.rect(ctx, width, height, rx, lTowY - ry, rw, 1, PAL.farMountain);
                this.rect(ctx, width, height, rx, lTowY - ry, Math.max(1, Math.floor(rw * 0.35)), 1, PAL.moonSilver);
            }
            if (minDim >= 40) {
                this.drawBanner(
                    ctx, width, height,
                    lTowX + Math.floor(lTowW / 2), lTowY - lRoofH,
                    Math.floor(lTowW * 0.45), PAL.sorceryMagenta, PAL.magicGold, tension, px
                );
            } else {
                this.rect(ctx, width, height, lTowX + Math.floor(lTowW / 2), lTowY - lRoofH - 2, 1, 2, PAL.moonSilver);
            }

            // 4d. Right Astral Observatory Tower & Pennant
            this.rect(ctx, width, height, rTowX - px, rTowY - px, rTowW + px * 2, rTowH + px, PAL.castleShadow);
            this.rect(ctx, width, height, rTowX, rTowY, rTowW, rTowH, PAL.castleStone);
            this.rect(ctx, width, height, rTowX, rTowY, Math.max(px, Math.floor(rTowW * 0.25)), rTowH, PAL.castleLight);
            this.rect(ctx, width, height, rTowX + Math.floor(rTowW * 0.6), rTowY, Math.max(px, Math.ceil(rTowW * 0.4)), rTowH, PAL.castleShadow);

            this.rect(ctx, width, height, rTowX - px, rTowY, rTowW + px * 2, px * 2, PAL.castleLight);
            this.rect(ctx, width, height, rTowX - px, rTowY + px * 2, rTowW + px * 2, px, PAL.black);

            for (let ry = 0; ry < rRoofH; ry++) {
                const rw = Math.max(1, Math.floor((rTowW + px * 2) * (1.0 - ry / rRoofH)));
                const rx = rTowX - px + Math.floor((rTowW + px * 2 - rw) / 2);
                this.rect(ctx, width, height, rx, rTowY - ry, rw, 1, PAL.farMountain);
                this.rect(ctx, width, height, rx, rTowY - ry, Math.max(1, Math.floor(rw * 0.35)), 1, PAL.moonSilver);
            }
            if (minDim >= 40) {
                this.drawBanner(
                    ctx, width, height,
                    rTowX + Math.floor(rTowW / 2), rTowY - rRoofH,
                    Math.floor(rTowW * 0.45), PAL.mysticCyan, PAL.white, tension, px
                );
            } else {
                this.rect(ctx, width, height, rTowX + Math.floor(rTowW / 2), rTowY - rRoofH - 2, 1, 2, PAL.mysticCyan);
            }

            // 4e. Central Grand Keep, Flying Buttresses & Z-Occluded 3D Orbiting Astral Ring
            if (keepW >= 10) {
                const buttW = Math.max(px * 2, Math.floor(keepW * 0.22));
                const buttH = Math.floor(keepH * 0.65);
                this.rect(ctx, width, height, keepX - buttW, castleBaseY - buttH, buttW, buttH, PAL.castleLight);
                this.rect(ctx, width, height, keepX + keepW, castleBaseY - buttH, buttW, buttH, PAL.castleShadow);
                if (this.hardBeatEnv > 0.35 || state === 'climax') {
                    this.rect(ctx, width, height, keepX - buttW, castleBaseY - buttH, px, buttH, PAL.magicGold);
                }
            }

            this.rect(ctx, width, height, keepX - px, keepY - px, keepW + px * 2, keepH + px, PAL.castleShadow);
            this.rect(ctx, width, height, keepX, keepY, keepW, keepH, PAL.castleStone);
            this.rect(ctx, width, height, keepX, keepY, Math.max(px, Math.floor(keepW * 0.28)), keepH, PAL.castleLight);
            this.rect(ctx, width, height, keepX + Math.floor(keepW * 0.68), keepY, Math.max(px, Math.ceil(keepW * 0.32)), keepH, PAL.castleShadow);
            this.rect(ctx, width, height, keepX - px, keepY, keepW + px * 2, px * 2, PAL.moonSilver);
            this.rect(ctx, width, height, keepX - px, keepY + px * 2, keepW + px * 2, px, PAL.black);

            // Back-Pass of 3D Astral Ring (drawn BEHIND the Sorcerer's Spire!)
            const showAstralRing = (tension > 0.42 || state === 'buildup' || state === 'climax') && minDim >= 36;
            const ringRX = Math.max(px * 4, Math.floor(keepW * 0.72));
            const ringRY = Math.max(px * 2, Math.floor(ringRX * 0.30));
            const ringCenterY = keepY - Math.floor(spireH * 0.72);
            if (showAstralRing) {
                this.drawSpireAstralRing(ctx, width, height, cx, ringCenterY, ringRX, ringRY, tension, activePulse, false, px);
            }

            // Grand Sorcerer's Spire Cone
            for (let sy = 0; sy < spireH; sy++) {
                const sw = Math.max(1, Math.floor((keepW + px * 2) * (1.0 - sy / spireH)));
                const sx = keepX - px + Math.floor((keepW + px * 2 - sw) / 2);
                this.rect(ctx, width, height, sx, keepY - sy, sw, 1, PAL.farMountain);
                this.rect(ctx, width, height, sx, keepY - sy, Math.max(1, Math.floor(sw * 0.38)), 1, PAL.moonSilver);
                if (sy === Math.floor(spireH * 0.5)) {
                    this.rect(ctx, width, height, sx, keepY - sy, sw, px, PAL.magicGold);
                }
            }

            // Spire Peak Astral Crystal
            const crystalCol = (activePulse > 0.35 || state === 'climax') ? PAL.white : PAL.mysticCyan;
            this.rect(ctx, width, height, cx - px, crystalY, px * 2, px * 3, crystalCol);

            // Front-Pass of 3D Astral Ring (drawn IN FRONT OF the Sorcerer's Spire!)
            if (showAstralRing) {
                this.drawSpireAstralRing(ctx, width, height, cx, ringCenterY, ringRX, ringRY, tension, activePulse, true, px);
            }

            // 4f. Gothic Windows & Smooth Envelope Illumination
            const winColor = (activePulse > 0.52)
                ? (tension > 0.68 ? PAL.sorceryMagenta : PAL.emberOrange)
                : PAL.magicGold;

            const kWinW = Math.max(2, Math.floor(keepW * 0.32));
            const kWinH = Math.max(3, Math.floor(keepH * 0.24));
            this.drawGothicWindow(
                ctx, width, height,
                cx - Math.floor(kWinW / 2), keepY + Math.floor(keepH * 0.22),
                kWinW, kWinH, winColor, px
            );

            const lWinW = Math.max(2, Math.floor(lTowW * 0.26));
            const lWinH = Math.max(2, Math.floor(lTowH * 0.22));
            this.drawGothicWindow(
                ctx, width, height,
                lTowX + Math.floor(lTowW * 0.36), lTowY + Math.floor(lTowH * 0.32),
                lWinW, lWinH, winColor, px
            );

            const rWinW = Math.max(2, Math.floor(rTowW * 0.36));
            const rWinH = Math.max(2, Math.floor(rTowH * 0.20));
            this.drawGothicWindow(
                ctx, width, height,
                rTowX + Math.floor(rTowW * 0.30), rTowY + Math.floor(rTowH * 0.26),
                rWinW, rWinH, activePulse > 0.55 ? PAL.white : PAL.mysticCyan, px
            );

            if (wallW >= 24) {
                const galCol = activePulse > 0.65 ? PAL.white : PAL.magicGold;
                this.rect(ctx, width, height, wallX + Math.floor(wallW * 0.20), wallY + Math.floor(wallH * 0.35), px * 2, px * 3, galCol);
                this.rect(ctx, width, height, wallX + Math.floor(wallW * 0.76), wallY + Math.floor(wallH * 0.35), px * 2, px * 3, galCol);
            }

            // 4g. Castle Gatehouse, Iron Portcullis & Flickering Torches
            const gateW = Math.max(4, Math.floor(wallW * 0.24));
            const gateH = Math.max(4, Math.floor(wallH * 0.50));
            const gateX = Math.floor(cx - gateW / 2);
            const gateY = castleBaseY - gateH;

            this.rect(ctx, width, height, gateX - px * 2, gateY - px * 2, gateW + px * 4, gateH + px * 2, PAL.castleLight);
            this.rect(ctx, width, height, gateX - px, gateY - px, gateW + px * 2, gateH + px, PAL.castleShadow);
            this.rect(ctx, width, height, gateX, gateY, gateW, gateH, PAL.black);

            if (gateW >= 6) {
                for (let gx = gateX + px * 2; gx < gateX + gateW - px; gx += px * 2) {
                    this.rect(ctx, width, height, gx, gateY, px, Math.floor(gateH * 0.65), PAL.castleStone);
                }
            }

            const torchFlicker = ((Math.floor(this.internalT * 11) & 1) === 0);
            const torchTipCol = (activePulse > 0.38 || torchFlicker) ? PAL.magicGold : PAL.emberOrange;
            const torchY = gateY + Math.floor(gateH * 0.25);
            this.rect(ctx, width, height, gateX - px * 3, torchY, px, px * 2, PAL.emberOrange);
            this.rect(ctx, width, height, gateX - px * 3, torchY - px, px, px, torchTipCol);
            this.rect(ctx, width, height, gateX + gateW + px * 2, torchY, px, px * 2, PAL.emberOrange);
            this.rect(ctx, width, height, gateX + gateW + px * 2, torchY - px, px, px, torchTipCol);

            // --- LAYER 5: FOREGROUND (Alpine Lake, Waterfall, Arched Viaduct & Evergreens) ---
            if (castleBaseY < height) {
                const fgHeight = height - castleBaseY;
                const lakeTopY = castleBaseY + Math.max(2, Math.floor(fgHeight * 0.22));
                const lakeBottomY = castleBaseY + Math.max(4, Math.floor(fgHeight * 0.64));

                // 5a. Base Foreground Turf
                this.rect(ctx, width, height, 0, castleBaseY, width, fgHeight, PAL.foregroundDark);

                // 5b. Bob Ross Alpine Gorge Lake, Waterfall & Shimmering Reflections
                if (lakeBottomY > lakeTopY && minDim >= 24) {
                    this.rect(ctx, width, height, 0, lakeTopY, width, lakeBottomY - lakeTopY, PAL.black);
                    this.rect(ctx, width, height, 0, lakeTopY, width, Math.max(1, Math.floor((lakeBottomY - lakeTopY) * 0.48)), PAL.deepBlue);

                    // Cascading Waterfall from the West Cliff
                    const wfX = castleLeft + Math.floor(lTowW * 0.5);
                    const wfW = Math.max(px * 2, Math.floor(minDim * 0.018));
                    for (let wy = castleBaseY; wy <= lakeTopY; wy += px) {
                        const rowStep = (wy / px) | 0;
                        const foamCol = ((rowStep + Math.floor(this.internalT * 16)) & 1)
                            ? (highEnergy > 0.5 ? PAL.white : PAL.moonSilver)
                            : PAL.mysticCyan;
                        this.rect(ctx, width, height, wfX, wy, wfW, px, foamCol);
                    }
                    // Waterfall splash foam & expanding bass ripple on water surface
                    const splashSpread = px * 2 + Math.floor(bassEnergy * px * 3);
                    this.rect(ctx, width, height, wfX - splashSpread, lakeTopY, wfW + splashSpread * 2, px, PAL.white);

                    // Horizontal Bob Ross Water Reflections (Moon, Castle Windows & Sky Bursts)
                    for (let ly = lakeTopY + px; ly < lakeBottomY; ly += px * 2) {
                        const depthRatio = (ly - lakeTopY) / Math.max(1, lakeBottomY - lakeTopY);
                        const shimmerShift = Math.round(Math.sin(ly * 0.8 + this.internalT * 4.2) * px * 2);

                        // Moon reflection column
                        const mRefW = Math.max(px * 3, Math.floor(moonR * (1.6 - depthRatio * 0.55)));
                        this.rect(ctx, width, height, moonX - Math.floor(mRefW / 2) + shimmerShift, ly, mRefW, px, PAL.moonSilver);
                        if (((ly / px) & 2) === 0) {
                            this.rect(ctx, width, height, moonX + shimmerShift, ly, Math.max(px, Math.floor(mRefW * 0.42)), px, PAL.white);
                        }

                        // Golden castle window reflection beneath the keep
                        const wRefW = Math.max(px * 2, Math.floor(kWinW * (1.4 + activePulse * 0.9)));
                        this.rect(ctx, width, height, cx - Math.floor(wRefW / 2) - shimmerShift, ly, wRefW, px, winColor);
                    }

                    // Active Firework Burst reflections shimmering on the lake
                    for (let bi = 0; bi < this.bursts.length; bi++) {
                        const b = this.bursts[bi];
                        if (b.active && (t - b.startTime) >= 0 && (t - b.startTime) < b.duration * 0.78) {
                            const bx = Math.floor(b.xRatio * width);
                            const refY = lakeTopY + (((bi * 3 + 1) * px) % Math.max(1, lakeBottomY - lakeTopY - px));
                            this.rect(ctx, width, height, bx - px * 4, refY, px * 8, px, b.color);
                        }
                    }

                    // Crisp Bob Ross Shoreline Water Cuts
                    this.rect(ctx, width, height, 0, lakeTopY, width, px, PAL.horizonBlue);
                    this.rect(ctx, width, height, Math.floor(width * 0.14), lakeBottomY - px, Math.floor(width * 0.72), px, PAL.moonSilver);
                }

                // 5c. Golden Spiral S-Curve Cobblestone Viaduct Bridge & Path to the Gate
                const pathStartW = Math.max(3, Math.floor(gateW * 0.95));
                const pathEndW = Math.max(6, Math.floor(minDim * 0.25));
                const pathStartY = castleBaseY;
                const pathEndY = height;

                if (pathEndY > pathStartY) {
                    const bridgeSpanH = Math.max(1, lakeBottomY - lakeTopY);

                    for (let py = pathStartY; py < pathEndY; py++) {
                        const normY = (py - pathStartY) / Math.max(1, pathEndY - pathStartY);
                        const curW = Math.floor(pathStartW + (pathEndW - pathStartW) * (normY * normY * 0.6 + normY * 0.4));
                        const curveX = cx + Math.floor(Math.sin(normY * Math.PI * 1.05) * (width * 0.14));
                        const pathX = Math.floor(curveX - curW / 2);

                        // Medieval Arched Stone Viaduct where the path crosses the lake!
                        if (py >= lakeTopY && py < lakeBottomY && minDim >= 28) {
                            const bridgeProg = (py - lakeTopY) / bridgeSpanH;
                            // Stone bridge sidewall masonry dropping to water
                            this.rect(ctx, width, height, pathX - px * 2, py, curW + px * 4, 1, PAL.castleShadow);
                            this.rect(ctx, width, height, pathX - px * 2, py, px * 2, 1, PAL.castleStone);
                            // Dark arch opening in the middle of the lake crossing + silver water glint inside arch
                            if (bridgeProg > 0.25 && bridgeProg < 0.78) {
                                this.rect(ctx, width, height, pathX - px * 2, py, px, 1, PAL.black);
                                if (bridgeProg > 0.65) {
                                    this.rect(ctx, width, height, pathX - px * 3, py, px * 2, 1, PAL.moonSilver);
                                }
                            }
                        }

                        // Cobblestone roadbed
                        const stoneCol = (((py / px) | 0) & 1) ? PAL.castleStone : PAL.castleShadow;
                        this.rect(ctx, width, height, pathX, py, curW, 1, stoneCol);

                        // Moonlit left parapet & shadowed right curb
                        this.rect(ctx, width, height, pathX, py, Math.max(1, Math.floor(curW * 0.18)), 1, PAL.castleLight);
                        this.rect(ctx, width, height, pathX + curW - px, py, px, 1, PAL.midMountain);

                        // Ascending Arcane Wayfarer Wisps synced to music
                        if ((tension > 0.42 || activePulse > 0.35) && (((py + Math.floor(this.internalT * 14 * px)) % (px * 7)) < px)) {
                            const wispCol = (state === 'climax' || this.hardBeatEnv > 0.4) ? PAL.magicGold : PAL.mysticCyan;
                            this.rect(ctx, width, height, pathX + Math.floor(curW * 0.5), py, px * 2, px, wispCol);
                        }
                    }
                }

                // 5d. Repoussoir Framing Bluffs on Left and Right
                const hillH = Math.max(4, Math.floor(fgHeight + 12));
                for (let y = 0; y < hillH; y++) {
                    const drawY = height - 1 - y;
                    const progress = y / hillH;
                    const hwL = Math.floor(width * 0.30 * (1.0 - progress * 0.85));
                    if (hwL > 0) {
                        this.rect(ctx, width, height, 0, drawY, hwL, 1, PAL.foregroundDark);
                        this.rect(ctx, width, height, hwL - px * 2, drawY, px * 2, 1, PAL.midMountain);
                    }

                    const hwR = Math.floor(width * 0.26 * (1.0 - progress * 0.90));
                    if (hwR > 0) {
                        this.rect(ctx, width, height, width - hwR, drawY, hwR, 1, PAL.black);
                        this.rect(ctx, width, height, width - hwR + px * 2, drawY, Math.max(1, hwR - px * 2), 1, PAL.foregroundDark);
                        this.rect(ctx, width, height, width - hwR, drawY, px * 2, 1, PAL.midMountain);
                    }
                }

                // 5e. Bob Ross Clustered Evergreen Families with Subtle Wind Sway
                const leftBaseY = Math.min(height - 1, castleBaseY + Math.floor(minDim * 0.14));
                const rightBaseY = Math.min(height - 1, castleBaseY + Math.floor(minDim * 0.16));
                const breezeL = Math.sin(this.internalT * 1.7);
                const breezeR = Math.sin(this.internalT * 1.7 + 1.4);

                if (minDim >= 36) {
                    this.drawEvergreen(ctx, width, height, Math.floor(width * 0.17), leftBaseY - px * 3, Math.floor(minDim * 0.12), false, breezeL * 0.6, px);
                    this.drawEvergreen(ctx, width, height, Math.floor(width * 0.82), rightBaseY - px * 4, Math.floor(minDim * 0.13), false, breezeR * 0.6, px);
                }

                this.drawEvergreen(ctx, width, height, Math.floor(width * 0.09), leftBaseY, Math.floor(minDim * 0.20), true, breezeL, px);
                this.drawEvergreen(ctx, width, height, Math.floor(width * 0.90), rightBaseY, Math.floor(minDim * 0.22), true, breezeR, px);
            }
        }

        // State Machine Transition Fade (Ordered Dither)
        let globalAlpha = 1.0;
        if (state === 'starting') {
            globalAlpha = Math.min(1.0, stateTime / 1.5);
        } else if (state === 'stopping') {
            globalAlpha = Math.max(0.0, 1.0 - (stateTime / 1.5));
        }

        applyOrderedDitherFade(ctx, width, height, globalAlpha);
        ctx.globalAlpha = 1.0;
    }
}