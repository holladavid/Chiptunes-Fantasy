// === js/visuals/dse/atari/enchanted-castle.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: ATARI ENCHANTED CASTLE (Background DSE)
// Authentic Atari ST 16-Color Shifter Night Fantasy Masterpiece:
// - Composed via Golden Ratio (Phi = 0.618 / 0.382) & Chiaroscuro lighting
//   from a crescent-shadowed full moon at the upper-left Golden Intersection.
// - Bob Ross Landscape Techniques in 9-bit Pixel Art:
//   * Palette-knife craggy alpine peaks with moonlit ridge-breaks & leeward shadows.
//   * Dithered valley mist separating mountain planes (atmospheric perspective).
//   * Cascading waterfall & dark alpine lake with live horizontal water reflections
//     mirroring moonlight, glowing castle windows, and sky firework bursts.
//   * Repoussoir evergreen pine clusters with asymmetrical fan-brush boughs.
// - Gothic Citadel on a faceted promontory cliff with Keep, Sorcerer Spire,
//   Flying Buttresses, Watchtower Bastion, Astral Observatory & S-curve Viaduct.
// - Full musical synchronization: beatLevel (1=soft, 2=medium, 3=hard),
//   beatStrength, beatImpulse, tensionPct, and macro states drive
//   auroras, spire convergence beams, rune sigils, window pulsations & reflections.
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
const FAR_PEAKS = Object.freeze([
    Object.freeze({ pos: 0.08, height: 0.72, leftSlope: 5.5, rightSlope: 4.2 }),
    Object.freeze({ pos: 0.23, height: 0.92, leftSlope: 4.8, rightSlope: 3.6 }),
    Object.freeze({ pos: 0.38, height: 0.68, leftSlope: 5.2, rightSlope: 4.8 }),
    Object.freeze({ pos: 0.54, height: 0.85, leftSlope: 4.5, rightSlope: 4.0 }),
    Object.freeze({ pos: 0.74, height: 0.98, leftSlope: 3.8, rightSlope: 3.4 }),
    Object.freeze({ pos: 0.91, height: 0.76, leftSlope: 4.6, rightSlope: 5.0 })
]);

const MID_PEAKS = Object.freeze([
    Object.freeze({ pos: 0.04, height: 0.65, leftSlope: 4.8, rightSlope: 3.8 }),
    Object.freeze({ pos: 0.17, height: 0.88, leftSlope: 4.2, rightSlope: 3.2 }),
    Object.freeze({ pos: 0.33, height: 0.74, leftSlope: 4.6, rightSlope: 4.0 }),
    Object.freeze({ pos: 0.67, height: 0.82, leftSlope: 4.0, rightSlope: 3.5 }),
    Object.freeze({ pos: 0.83, height: 0.94, leftSlope: 3.6, rightSlope: 3.2 }),
    Object.freeze({ pos: 0.96, height: 0.62, leftSlope: 4.5, rightSlope: 4.8 })
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

        // Pre-allocated bounded burst pool (Zero-GC)
        this.bursts = Array.from({ length: MAX_MAGIC_BURSTS }, () => ({
            active: false,
            xRatio: 0.5,
            yRatio: 0.25,
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

        // Exactly two slowly drifting nocturnal clouds
        this.clouds = [
            { yRatio: 0.16, speed: 0.016, spanRatio: 0.22 },
            { yRatio: 0.33, speed: -0.011, spanRatio: 0.26 }
        ];
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

        // In playing, keep effects spare and controlled on very low strength
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
            burst.pattern = 2; // Arcane rune pattern in climax
        }

        // Alternating positions behind central keep, left watchtower, or right observatory
        const slot = (beatCount > 0 ? beatCount : this.burstCursor) % 3;
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

    // Bob Ross Palette-Knife Mountain Range Drawer (Zero-GC)
    drawAlpineRange(ctx, width, height, horizonY, maxPeakHeight, peaks, shadowCol, midCol, lightCol, mistCol) {
        const step = width > 240 ? 2 : 1;

        for (let x = 0; x < width; x += step) {
            const nx = x / Math.max(1, width);
            let bestElevation = 0;
            let isMoonlitFace = false;
            let ridgeProximity = 1.0;

            for (let i = 0; i < peaks.length; i++) {
                const p = peaks[i];
                const diff = nx - p.pos;
                const slope = diff < 0 ? p.leftSlope : p.rightSlope;
                // Craggy palette-knife rock micro-serrations
                const crag = Math.sin(nx * 47.0 + i * 2.1) * 0.04 + Math.cos(nx * 23.0 - i) * 0.03;
                const elev = Math.max(0, p.height - Math.abs(diff) * slope + crag);

                if (elev > bestElevation) {
                    bestElevation = elev;
                    // Moon is at upper-left (0.236), so left slopes (diff < 0) catch moonlight!
                    isMoonlitFace = diff < 0;
                    ridgeProximity = Math.abs(diff) * slope;
                }
            }

            const mHeight = Math.floor(maxPeakHeight * Math.min(1.0, bestElevation));
            if (mHeight <= 0) continue;

            const topY = horizonY - mHeight;

            // 1. Base Mountain Mass (Leeward Shadow or Mid Slate)
            const bodyCol = isMoonlitFace ? midCol : shadowCol;
            this.rect(ctx, width, height, x, topY, step, mHeight, bodyCol);

            // 2. Bob Ross "Breaking the Light on the Ridge" (Moonlit knife strokes)
            if (isMoonlitFace) {
                const snowCapH = Math.max(1, Math.floor(mHeight * (0.28 - ridgeProximity * 0.18)));
                this.rect(ctx, width, height, x, topY, step, snowCapH, lightCol);

                // Textured rock strata descending down the sunlit/moonlit face
                if (((x + topY) & 3) === 0 && mHeight > 6) {
                    const streakY = topY + snowCapH + ((x * 3) % Math.max(1, Math.floor(mHeight * 0.45)));
                    this.rect(ctx, width, height, x, streakY, step, 2, lightCol);
                }
            } else if (ridgeProximity < 0.06) {
                // Crisp 1px rim-light right at the mountain crest
                this.rect(ctx, width, height, x, topY, step, 1, midCol);
            }

            // 3. Bob Ross "Tapping Mist at the Base" (Atmospheric Perspective)
            const mistH = Math.max(2, Math.floor(maxPeakHeight * 0.16));
            const mistStart = Math.max(topY, horizonY - mistH);
            if ((x >> 1) & 1) {
                this.rect(ctx, width, height, x, mistStart, step, horizonY - mistStart, mistCol);
            }
        }
    }

    // Bob Ross "Happy Little Evergreen" Drawer with Moonlit Boughs (Zero-GC)
    drawEvergreen(ctx, width, height, pineX, pineBaseY, pineHeight, isForeground) {
        const pH = Math.max(6, Math.floor(pineHeight));
        const pW = Math.max(4, Math.floor(pH * 0.62));
        const trunkW = Math.max(1, Math.floor(pW * 0.22));
        const trunkH = Math.max(2, Math.floor(pH * 0.20));

        // Trunk with warm/shadowed bark
        this.rect(ctx, width, height, pineX - Math.floor(trunkW / 2), pineBaseY - trunkH, trunkW, trunkH, PAL.castleShadow);

        // Leader tip pointing into the night sky
        this.rect(ctx, width, height, pineX, pineBaseY - pH - 1, 1, 2, PAL.moonSilver);

        const foliageH = pH - trunkH;
        const tiers = 4;
        const tierH = Math.max(2, Math.floor(foliageH / tiers));

        for (let t = 0; t < tiers; t++) {
            // Tier 0 is bottom (widest), Tier 3 is top (narrowest)
            const tTop = pineBaseY - trunkH - (t + 1) * tierH;
            const maxTierW = Math.max(2, Math.floor(pW * (1.0 - t * 0.21)));

            for (let row = 0; row < tierH; row++) {
                const progress = (row + 1) / tierH;
                // Fan-brush jagged bough flare at bottom of each tier
                const flare = (row === tierH - 1) ? 2 : 0;
                const rw = Math.max(1, Math.floor(maxTierW * progress) + flare);
                const rx = pineX - Math.floor(rw / 2);
                const ry = tTop + row;

                // Deep shadow boughs on the right (leeward from moon)
                this.rect(ctx, width, height, rx, ry, rw, 1, isForeground ? PAL.black : PAL.foregroundDark);
                // Core evergreen foliage
                this.rect(ctx, width, height, rx, ry, Math.max(1, Math.floor(rw * 0.72)), 1, PAL.foregroundDark);
                // Moonlit silver/slate highlight on the left bough tips
                const highlightW = Math.max(1, Math.floor(rw * 0.28));
                const hiCol = (row === tierH - 1 && t >= 1) ? PAL.moonSilver : PAL.midMountain;
                this.rect(ctx, width, height, rx, ry, highlightW, 1, hiCol);
            }
        }
    }

    // Gothic Pointed-Arch Window with Mullions & Sill (Zero-GC)
    drawGothicWindow(ctx, width, height, wx, wy, ww, wh, glowCol) {
        const w = Math.max(2, Math.floor(ww));
        const h = Math.max(3, Math.floor(wh));
        const x = Math.floor(wx);
        const y = Math.floor(wy);

        // Deep stone recess
        this.rect(ctx, width, height, x - 1, y, w + 2, h + 1, PAL.castleShadow);
        // Pointed gothic arch crown
        if (w >= 3) {
            this.rect(ctx, width, height, x + 1, y - 1, w - 2, 1, glowCol);
        }
        // Main stained-glass / illuminated pane
        this.rect(ctx, width, height, x, y, w, h, glowCol);
        // Hot inner core highlight
        if (w >= 2 && h >= 3) {
            const coreCol = glowCol === PAL.mysticCyan ? PAL.white : (glowCol === PAL.magicGold ? PAL.white : PAL.magicGold);
            this.rect(ctx, width, height, x, y + 1, 1, Math.max(1, h - 2), coreCol);
        }
        // Moonlit stone sill at bottom
        this.rect(ctx, width, height, x - 1, y + h, w + 2, 1, PAL.castleLight);
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
        if (dt < 0 || dt > 0.1) dt = 0.02;
        this.lastT = t;

        if (this.lastState !== state) {
            this.lastState = state;
            this.stateAge = 0;
        } else {
            this.stateAge += dt;
        }

        this.internalT += dt;

        // Defensive metrics reading
        const safeMetrics = metrics || {};
        const tension = Number.isFinite(safeMetrics.tensionPct)
            ? Math.max(0, Math.min(1, safeMetrics.tensionPct))
            : (state === 'climax' ? 0.9 : state === 'buildup' ? 0.65 : 0.35);

        const beatImpulse = (safeMetrics.beatImpulse && Number.isFinite(safeMetrics.beatImpulse[0]))
            ? Math.max(0, Math.min(1, safeMetrics.beatImpulse[0]))
            : (safeMetrics.beat && Number.isFinite(safeMetrics.beat[0]) ? Math.max(0, Math.min(1, safeMetrics.beat[0])) : 0);

        const beatStrength = Number.isFinite(safeMetrics.beatStrength)
            ? Math.max(0, Math.min(1, safeMetrics.beatStrength))
            : (beatImpulse > 0 ? beatImpulse : (safeMetrics.beatStarted ? 0.5 : 0));

        let beatLevel = Number.isInteger(safeMetrics.beatLevel) && safeMetrics.beatLevel >= 0 && safeMetrics.beatLevel <= 3
            ? safeMetrics.beatLevel
            : (beatStrength >= 2 / 3 ? 3 : beatStrength >= 1 / 3 ? 2 : (beatStrength > 0 ? 1 : 0));

        // Beat onset trigger
        if (safeMetrics.beatStarted) {
            const beatCount = Number.isFinite(safeMetrics.beatCount)
                ? safeMetrics.beatCount
                : this.lastBeatCount + 1;

            if (beatCount !== this.lastBeatCount) {
                this.lastBeatCount = beatCount;
                this.triggerMagic(beatCount, beatStrength, beatLevel, tension, state, t);
            }
        }

        // =========================================================
        // MASTER GOLDEN RATIO (PHI) SCENE GEOMETRY
        // 1. Sky & Astronomy (Shifter Dither Sky, Aurora, Stars, Moon, 2 Clouds)
        // 2. Distant Magic & Fireworks (Spire Convergence, Graded Bursts)
        // 3. Distant Mountains (Bob Ross Faceted Peaks & Valley Mist)
        // 4. Promontory Cliff, Enchanted Citadel & Gothic Windows
        // 5. Alpine Gorge Lake, Waterfall, Golden Spiral Path & Evergreens
        // =========================================================

        const minDim = Math.min(width, height);
        const cx = Math.floor(width / 2);
        // Horizon sits at the exact Golden Ratio cut (0.618 of height)
        const horizonY = Math.max(1, Math.floor(height * PHI_MAJOR));

        // --- LAYER 1: SKY & ASTRONOMY ---
        // 1a. Base Sky fill
        this.rect(ctx, width, height, 0, 0, width, height, PAL.midnightViolet);

        if (horizonY > 3) {
            // Sky band cuts follow Golden Ratio subdivisions of the sky
            const h1 = Math.floor(horizonY * PHI_MINOR);
            const h2 = Math.floor(horizonY * (1.0 - PHI_QUAD));

            // Band 1: Midnight Violet
            this.rect(ctx, width, height, 0, 0, width, h1, PAL.midnightViolet);

            // Band 2: Deep Night Blue
            if (h2 > h1) {
                this.rect(ctx, width, height, 0, h1, width, h2 - h1, PAL.deepBlue);
            }

            // Band 3: Royal Horizon Blue
            if (horizonY > h2) {
                this.rect(ctx, width, height, 0, h2, width, horizonY - h2, PAL.horizonBlue);
            }

            // Authentic Atari ST Shifter Raster & Checkerboard Dither Transitions
            const ditherSpan = Math.max(2, Math.min(6, Math.floor(horizonY * 0.045)));
            const dStep = width > 200 ? 4 : 2;
            for (let dy = -ditherSpan; dy < ditherSpan; dy++) {
                const y1 = h1 + dy;
                if (y1 >= 0 && y1 < horizonY) {
                    if (dy < 0 && (dy & 1) === 0) {
                        for (let x = (dy & 2); x < width; x += dStep) {
                            this.rect(ctx, width, height, x, y1, 2, 1, PAL.deepBlue);
                        }
                    } else if (dy >= 0 && (dy & 1) === 0) {
                        this.rect(ctx, width, height, 0, y1, width, 1, PAL.midnightViolet);
                    }
                }

                const y2 = h2 + dy;
                if (y2 >= 0 && y2 < horizonY) {
                    if (dy < 0 && (dy & 1) === 0) {
                        for (let x = (dy & 2); x < width; x += dStep) {
                            this.rect(ctx, width, height, x, y2, 2, 1, PAL.horizonBlue);
                        }
                    } else if (dy >= 0 && (dy & 1) === 0) {
                        this.rect(ctx, width, height, 0, y2, width, 1, PAL.deepBlue);
                    }
                }
            }

            // 1b. Arcane Borealis / Mana Ribbons during high musical tension or climax
            if ((tension > 0.55 || state === 'climax') && minDim >= 24) {
                const auroraCols = Math.min(36, Math.max(8, Math.floor(width / 8)));
                const colW = Math.max(2, Math.floor(width / auroraCols));
                const baseAuroraY = Math.floor(horizonY * 0.26);
                for (let i = 0; i < auroraCols; i++) {
                    const wave = Math.sin(i * 0.45 + this.internalT * 2.2) + Math.cos(i * 0.25 - this.internalT * 1.4);
                    if (wave > 0.35) {
                        const ax = i * colW;
                        const ay = baseAuroraY + Math.floor(wave * (horizonY * 0.08));
                        const ah = Math.max(2, Math.floor((wave - 0.35) * (horizonY * 0.14) * (0.6 + beatImpulse * 0.6)));
                        const aCol = ((i + Math.floor(this.internalT * 4)) & 1) ? PAL.mysticCyan : PAL.sorceryMagenta;
                        this.rect(ctx, width, height, ax, ay, Math.max(1, colW - 1), ah, aCol);
                    }
                }
            }

            // Horizon Mana Pulse on strong beats
            if (beatImpulse > 0.40 && horizonY >= 2) {
                const pulseH = beatLevel === 3 ? 3 : 2;
                this.rect(ctx, width, height, 0, horizonY - pulseH, width, pulseH, PAL.mysticCyan);
                if (beatLevel === 3) {
                    this.rect(ctx, width, height, 0, horizonY - 1, width, 1, PAL.white);
                }
            }
        }

        // If viewport is too tiny for detailed landscape geometry, sky fill suffices
        if (minDim >= 8) {
            // 1c. Twinkling Stars & Climax Shooting Star
            for (let i = 0; i < this.stars.length; i++) {
                const s = this.stars[i];
                const sx = Math.floor(s.x * width);
                const sy = Math.floor(s.y * horizonY);
                if (sx < 0 || sx >= width || sy < 0 || sy >= horizonY) continue;

                const twinkle = Math.sin(this.internalT * 3.5 + s.phase);
                if (twinkle > 0.60) {
                    this.rect(ctx, width, height, sx, sy, 1, 1, PAL.white);
                    // 4-point diamond star glint on bright magnitude stars or strong beats
                    if ((twinkle > 0.88 || (s.mag === 2 && beatImpulse > 0.55)) && minDim >= 48) {
                        this.rect(ctx, width, height, sx - 1, sy, 3, 1, PAL.moonSilver);
                        this.rect(ctx, width, height, sx, sy - 1, 1, 3, PAL.moonSilver);
                        this.rect(ctx, width, height, sx, sy, 1, 1, PAL.white);
                    }
                } else if (twinkle > 0.05) {
                    this.rect(ctx, width, height, sx, sy, 1, 1, PAL.moonSilver);
                } else {
                    this.rect(ctx, width, height, sx, sy, 1, 1, PAL.horizonBlue);
                }
            }

            // Deterministic Shooting Star on high tension / climax
            if ((state === 'climax' || tension > 0.72) && minDim >= 40) {
                const meteorPhase = (this.internalT * 0.85) % 3.0;
                if (meteorPhase < 0.45) {
                    const mp = meteorPhase / 0.45;
                    const mx = Math.floor(width * (0.78 - mp * 0.28));
                    const my = Math.floor(horizonY * (0.08 + mp * 0.22));
                    this.rect(ctx, width, height, mx, my, 2, 1, PAL.white);
                    this.rect(ctx, width, height, mx + 2, my - 1, 3, 1, PAL.mysticCyan);
                    this.rect(ctx, width, height, mx + 5, my - 2, 3, 1, PAL.horizonBlue);
                }
            }

            // 1d. Luminous Moon at Upper-Left Golden Ratio Intersection (0.236, 0.236)
            const moonR = Math.max(3, Math.min(11, Math.floor(minDim * 0.052)));
            const moonX = Math.floor(width * (width < height ? 0.22 : PHI_QUAD));
            const moonY = Math.max(moonR + 2, Math.floor(horizonY * PHI_QUAD));

            // Dithered Moon Corona / Halo (expands with tension and beatImpulse)
            if (minDim >= 36) {
                const haloR = moonR + 2 + (beatImpulse > 0.4 ? 2 : 0) + (tension > 0.65 ? 1 : 0);
                for (let hy = -haloR; hy <= haloR; hy += 2) {
                    const hdx = Math.round(Math.sqrt(Math.max(0, haloR * haloR - hy * hy)));
                    if (hdx > 0) {
                        this.rect(ctx, width, height, moonX - hdx, moonY + hy, hdx * 2, 1, PAL.horizonBlue);
                    }
                }
            }

            // Sculpted Moon Disc with Chiaroscuro Crescent Core & Maria Craters
            for (let my = -moonR; my <= moonR; my++) {
                const dx = Math.round(Math.sqrt(Math.max(0, moonR * moonR - my * my)));
                if (dx > 0) {
                    // Base moon disc in Moon Silver
                    this.rect(ctx, width, height, moonX - dx, moonY + my, dx * 2, 1, PAL.moonSilver);
                    // Luminous bright inner crescent core in Pure White
                    if (dx > 1) {
                        this.rect(ctx, width, height, moonX - dx + 1, moonY + my, Math.max(1, Math.floor(dx * 1.35)), 1, PAL.white);
                    }
                    // Crater / Earthshine shadow on the right limb
                    if (dx > 2 && my > -moonR * 0.55 && my < moonR * 0.65) {
                        this.rect(ctx, width, height, moonX + Math.floor(dx * 0.28), moonY + my, Math.max(1, Math.floor(dx * 0.58)), 1, PAL.horizonBlue);
                    }
                }
            }

            // 1e. Exactly two slowly drifting nocturnal clouds with silver-lined rims
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

                // Under-cloud shadow belly
                this.rect(ctx, width, height, cX + 2, cY + 1, cWidth, cHeight, PAL.deepBlue);
                // Main cloud body
                this.rect(ctx, width, height, cX, cY, cWidth, Math.max(2, cHeight - 1), PAL.horizonBlue);
                // Moonlit silver upper billow
                this.rect(ctx, width, height, cX + Math.floor(cWidth * 0.12), cY - 1, Math.floor(cWidth * 0.72), 2, PAL.moonSilver);
                // Crisp white crest facing the moon
                this.rect(ctx, width, height, cX + Math.floor(cWidth * 0.20), cY - 2, Math.floor(cWidth * 0.38), 1, PAL.white);
            }

            // --- LAYER 2: DISTANT MAGIC & FIREWORKS (Behind Mountains & Castle) ---
            // 2a. Sculpted Spire Convergence Ray & Arcane Halo behind Keep
            if (tension > 0.45 || state === 'climax' || state === 'buildup') {
                const rayW = Math.max(2, Math.floor(minDim * (0.022 + beatImpulse * 0.015)));
                const rayH = Math.floor(horizonY * (0.38 + tension * 0.35 + beatImpulse * 0.18));
                const rayX = Math.floor(cx - rayW / 2);
                const rayTop = Math.max(0, horizonY - rayH);
                const primaryRayCol = (state === 'climax') ? PAL.magicGold : PAL.mysticCyan;
                const outerRayCol = (state === 'climax') ? PAL.emberOrange : PAL.sorceryMagenta;

                // Outer aura sheath
                this.rect(ctx, width, height, rayX - 1, rayTop + 4, rayW + 2, Math.max(1, rayH - 4), outerRayCol);
                // Main mana beam
                this.rect(ctx, width, height, rayX, rayTop, rayW, rayH, primaryRayCol);
                // Incandescent white core
                this.rect(ctx, width, height, cx, rayTop + 2, 1, Math.max(1, rayH - 2), PAL.white);

                // Ascending mana motes along the beam
                if (minDim >= 32) {
                    for (let m = 0; m < 4; m++) {
                        const moteProgress = ((this.internalT * 1.8 + m * 0.25) % 1.0);
                        const my = horizonY - Math.floor(moteProgress * rayH);
                        const mx = cx + ((m & 1) ? -rayW - 2 : rayW + 1);
                        this.rect(ctx, width, height, mx, my, 1, 2, PAL.white);
                    }
                }
            }

            // 2b. Fireworks & Graded Arcane Bursts (Patterns 0, 1, and 2)
            for (let bi = 0; bi < this.bursts.length; bi++) {
                const burst = this.bursts[bi];
                if (!burst.active) continue;

                const progress = (t - burst.startTime) / burst.duration;
                if (progress < 0 || progress >= 1.0) {
                    if (progress >= 1.0) burst.active = false;
                    continue;
                }

                const burstCX = Math.floor(burst.xRatio * width);
                const burstCY = Math.floor(burst.yRatio * height);
                const curRadius = burst.radiusFactor * minDim * 0.24 * Math.sin(progress * Math.PI * 0.5);
                const gravityDrop = progress * progress * 8;

                // Pattern 2: Climax / High-Tension Arcane Octagram Sigil & Inner Ring
                if (burst.pattern === 2 && progress < 0.75 && minDim >= 24) {
                    const runeR = Math.max(2, Math.floor(curRadius * 0.55));
                    const runeCol = progress < 0.4 ? PAL.white : burst.secondaryColor;
                    // Cardinal diamond vertices & bars
                    this.rect(ctx, width, height, burstCX - runeR, burstCY, runeR * 2 + 1, 1, runeCol);
                    this.rect(ctx, width, height, burstCX, burstCY - runeR, 1, runeR * 2 + 1, runeCol);
                    // Inner arcane square frame
                    const boxR = Math.max(1, Math.floor(runeR * 0.65));
                    this.rect(ctx, width, height, burstCX - boxR, burstCY - boxR, boxR * 2 + 1, 1, burst.color);
                    this.rect(ctx, width, height, burstCX - boxR, burstCY + boxR, boxR * 2 + 1, 1, burst.color);
                    this.rect(ctx, width, height, burstCX - boxR, burstCY - boxR, 1, boxR * 2 + 1, burst.color);
                    this.rect(ctx, width, height, burstCX + boxR, burstCY - boxR, 1, boxR * 2 + 1, burst.color);
                }

                // Pattern 1: Star-Cross Core Flare
                if (burst.pattern === 1 && progress < 0.45) {
                    const sparkR = Math.max(1, Math.floor(minDim * 0.028 * (1.0 - progress / 0.45)));
                    this.rect(ctx, width, height, burstCX - sparkR, burstCY, sparkR * 2 + 1, 1, PAL.white);
                    this.rect(ctx, width, height, burstCX, burstCY - sparkR, 1, sparkR * 2 + 1, PAL.white);
                }

                // Expanding Particle Ring & Ember Trails
                for (let pi = 0; pi < burst.particleCount; pi++) {
                    const p = burst.particles[pi];
                    const px = Math.floor(burstCX + p.dx * curRadius);
                    const py = Math.floor(burstCY + p.dy * curRadius + gravityDrop);

                    if (px >= 0 && px < width && py >= 0 && py < height) {
                        const pColor = (progress > 0.62) ? burst.secondaryColor : burst.color;
                        this.rect(ctx, width, height, px, py, p.size, p.size, pColor);

                        // Subtle comet tail on medium/hard beats
                        if (burst.beatLevel >= 2 && progress > 0.15 && progress < 0.75) {
                            const tx = Math.floor(burstCX + p.dx * (curRadius * 0.82));
                            const ty = Math.floor(burstCY + p.dy * (curRadius * 0.82) + gravityDrop * 0.75);
                            this.rect(ctx, width, height, tx, ty, 1, 1, burst.secondaryColor);
                        }
                    }
                }
            }

            // --- LAYER 3: DISTANT MOUNTAINS (Bob Ross Palette-Knife Ridges & Mist) ---
            // 3a. Far Alpine Range (High craggy peaks with moonlit snow-breaks)
            const farMaxH = Math.floor(horizonY * 0.42);
            this.drawAlpineRange(
                ctx, width, height, horizonY, farMaxH, FAR_PEAKS,
                PAL.farMountain, PAL.midMountain, PAL.moonSilver, PAL.horizonBlue
            );

            // 3b. Mid Slate Ridge (Closer foothills with mist at horizonY)
            const midMaxH = Math.floor(horizonY * 0.25);
            this.drawAlpineRange(
                ctx, width, height, horizonY, midMaxH, MID_PEAKS,
                PAL.castleShadow, PAL.farMountain, PAL.castleLight, PAL.deepBlue
            );

            // --- LAYER 4: PROMONTORY CLIFF & THE ENCHANTED CITADEL ---
            const castleW = Math.max(24, Math.min(Math.floor(width * 0.85), Math.floor(minDim * 0.72)));
            const castleH = Math.max(16, Math.floor(castleW * 0.60));
            const castleBaseY = Math.min(height - 4, horizonY + Math.max(2, Math.floor(height * 0.06)));
            const castleLeft = Math.floor(cx - castleW / 2);

            // 4a. Craggy Promontory Cliff below Castle (Bob Ross Faceted Rock)
            const cliffH = Math.max(4, Math.floor((height - castleBaseY) * 0.52));
            const cliffTopW = Math.floor(castleW * 0.92);
            for (let cy = 0; cy < cliffH; cy++) {
                const ratio = cy / Math.max(1, cliffH);
                const rowW = Math.floor(cliffTopW * (1.0 - ratio * 0.25));
                const rowX = Math.floor(cx - rowW / 2);
                const drawY = castleBaseY + cy;
                // Shadowed cliff mass
                this.rect(ctx, width, height, rowX, drawY, rowW, 1, PAL.castleShadow);
                // Moonlit left rock strata
                const litW = Math.max(2, Math.floor(rowW * (0.38 - ratio * 0.15)));
                this.rect(ctx, width, height, rowX, drawY, litW, 1, (cy & 1) ? PAL.castleStone : PAL.midMountain);
                // Extreme left moonlight rim
                this.rect(ctx, width, height, rowX, drawY, 2, 1, PAL.castleLight);
            }

            // 4b. Castle Main Curtain Wall & Flying Buttresses
            const wallW = Math.floor(castleW * 0.68);
            const wallH = Math.floor(castleH * 0.48);
            const wallX = Math.floor(cx - wallW / 2);
            const wallY = castleBaseY - wallH;

            // Wall Shadow Backing
            this.rect(ctx, width, height, wallX - 1, wallY - 1, wallW + 2, wallH + 1, PAL.castleShadow);
            // Wall Stone Body (Moonlit left half, shadowed right half)
            this.rect(ctx, width, height, wallX, wallY, wallW, wallH, PAL.castleStone);
            this.rect(ctx, width, height, cx, wallY, Math.floor(wallW / 2), wallH, PAL.castleShadow);
            // Horizontal ashlar masonry courses
            for (let my = wallY + 4; my < castleBaseY - 2; my += 4) {
                this.rect(ctx, width, height, wallX + 1, my, Math.floor(wallW * 0.48), 1, PAL.castleShadow);
            }

            // Wall Crenellations (Merlons with moonlit caps)
            const numMerlons = Math.max(3, Math.floor(wallW / 5));
            const merlonStep = wallW / numMerlons;
            for (let m = 0; m < numMerlons; m++) {
                if ((m & 1) === 0) {
                    const mx = wallX + Math.floor(m * merlonStep);
                    const mw = Math.max(2, Math.floor(merlonStep * 0.75));
                    this.rect(ctx, width, height, mx, wallY - 3, mw, 3, PAL.castleStone);
                    this.rect(ctx, width, height, mx, wallY - 3, mw, 1, PAL.castleLight);
                }
            }

            // 4c. Left Bastion Watchtower (Slot 1: xRatio ~ 0.36)
            const lTowW = Math.max(6, Math.floor(castleW * 0.22));
            const lTowH = Math.floor(castleH * 0.78);
            const lTowX = castleLeft;
            const lTowY = castleBaseY - lTowH;

            this.rect(ctx, width, height, lTowX - 1, lTowY - 1, lTowW + 2, lTowH + 1, PAL.castleShadow);
            this.rect(ctx, width, height, lTowX, lTowY, lTowW, lTowH, PAL.castleStone);
            // Chiaroscuro shading: bright left edge, dark right edge
            this.rect(ctx, width, height, lTowX, lTowY, Math.max(1, Math.floor(lTowW * 0.3)), lTowH, PAL.castleLight);
            this.rect(ctx, width, height, lTowX + Math.floor(lTowW * 0.7), lTowY, Math.max(1, Math.ceil(lTowW * 0.3)), lTowH, PAL.castleShadow);
            // Flared Corbel Battlement Collar
            this.rect(ctx, width, height, lTowX - 1, lTowY, lTowW + 2, 2, PAL.castleLight);

            // Left Tower Steep Witches'-Hat Spire
            const lRoofH = Math.max(4, Math.floor(lTowW * 1.25));
            for (let ry = 0; ry < lRoofH; ry++) {
                const rw = Math.max(1, Math.floor((lTowW + 2) * (1.0 - ry / lRoofH)));
                const rx = lTowX - 1 + Math.floor((lTowW + 2 - rw) / 2);
                this.rect(ctx, width, height, rx, lTowY - ry, rw, 1, PAL.farMountain);
                this.rect(ctx, width, height, rx, lTowY - ry, Math.max(1, Math.floor(rw * 0.35)), 1, PAL.moonSilver);
            }
            this.rect(ctx, width, height, lTowX + Math.floor(lTowW / 2), lTowY - lRoofH - 2, 1, 2, PAL.moonSilver);

            // 4d. Right Astral Observatory Tower (Slot 2: xRatio ~ 0.64, Asymmetric Golden Balance)
            const rTowW = Math.max(6, Math.floor(castleW * 0.24));
            const rTowH = Math.floor(castleH * 0.88);
            const rTowX = castleLeft + castleW - rTowW;
            const rTowY = castleBaseY - rTowH;

            this.rect(ctx, width, height, rTowX - 1, rTowY - 1, rTowW + 2, rTowH + 1, PAL.castleShadow);
            this.rect(ctx, width, height, rTowX, rTowY, rTowW, rTowH, PAL.castleStone);
            this.rect(ctx, width, height, rTowX, rTowY, Math.max(1, Math.floor(rTowW * 0.25)), rTowH, PAL.castleLight);
            this.rect(ctx, width, height, rTowX + Math.floor(rTowW * 0.6), rTowY, Math.max(1, Math.ceil(rTowW * 0.4)), rTowH, PAL.castleShadow);
            // Observatory Balcony Cornice
            this.rect(ctx, width, height, rTowX - 1, rTowY, rTowW + 2, 2, PAL.castleLight);

            // Right Tower Spire
            const rRoofH = Math.max(4, Math.floor(rTowW * 1.35));
            for (let ry = 0; ry < rRoofH; ry++) {
                const rw = Math.max(1, Math.floor((rTowW + 2) * (1.0 - ry / rRoofH)));
                const rx = rTowX - 1 + Math.floor((rTowW + 2 - rw) / 2);
                this.rect(ctx, width, height, rx, rTowY - ry, rw, 1, PAL.farMountain);
                this.rect(ctx, width, height, rx, rTowY - ry, Math.max(1, Math.floor(rw * 0.35)), 1, PAL.moonSilver);
            }
            this.rect(ctx, width, height, rTowX + Math.floor(rTowW / 2), rTowY - rRoofH - 2, 1, 2, PAL.mysticCyan);

            // 4e. Central Grand Keep & Soaring Sorcerer's Spire (Slot 0: xRatio = 0.50)
            const keepW = Math.max(8, Math.floor(castleW * 0.32));
            const keepH = castleH;
            const keepX = Math.floor(cx - keepW / 2);
            const keepY = castleBaseY - keepH;

            // Flying Buttresses connecting Curtain Wall to Central Keep
            if (keepW >= 10) {
                const buttW = Math.max(2, Math.floor(keepW * 0.22));
                const buttH = Math.floor(keepH * 0.65);
                this.rect(ctx, width, height, keepX - buttW, castleBaseY - buttH, buttW, buttH, PAL.castleLight);
                this.rect(ctx, width, height, keepX + keepW, castleBaseY - buttH, buttW, buttH, PAL.castleShadow);
            }

            // Main Keep Tower Body
            this.rect(ctx, width, height, keepX - 1, keepY - 1, keepW + 2, keepH + 1, PAL.castleShadow);
            this.rect(ctx, width, height, keepX, keepY, keepW, keepH, PAL.castleStone);
            // Chiaroscuro left moonlit face & right shadow face
            this.rect(ctx, width, height, keepX, keepY, Math.max(1, Math.floor(keepW * 0.28)), keepH, PAL.castleLight);
            this.rect(ctx, width, height, keepX + Math.floor(keepW * 0.68), keepY, Math.max(1, Math.ceil(keepW * 0.32)), keepH, PAL.castleShadow);
            // Keep Crown Parapet
            this.rect(ctx, width, height, keepX - 1, keepY, keepW + 2, 2, PAL.moonSilver);

            // Upper Stepped Belfry & Grand Sorcerer Spire
            const spireH = Math.max(6, Math.floor(keepW * 1.55));
            for (let sy = 0; sy < spireH; sy++) {
                const sw = Math.max(1, Math.floor((keepW + 2) * (1.0 - sy / spireH)));
                const sx = keepX - 1 + Math.floor((keepW + 2 - sw) / 2);
                this.rect(ctx, width, height, sx, keepY - sy, sw, 1, PAL.farMountain);
                this.rect(ctx, width, height, sx, keepY - sy, Math.max(1, Math.floor(sw * 0.38)), 1, PAL.moonSilver);
                if (sy === Math.floor(spireH * 0.5)) {
                    // Gilded arcane ring halfway up the spire
                    this.rect(ctx, width, height, sx, keepY - sy, sw, 1, PAL.magicGold);
                }
            }

            // Spire Peak Astral Crystal & Orbiting Mana Shards
            const crystalY = keepY - spireH - 2;
            const crystalCol = (beatImpulse > 0.35 || state === 'climax') ? PAL.white : PAL.mysticCyan;
            this.rect(ctx, width, height, cx - 1, crystalY, 2, 3, crystalCol);
            if (tension > 0.5 || beatImpulse > 0.4) {
                const orbitOffset = Math.round(Math.sin(this.internalT * 6.0) * 3);
                this.rect(ctx, width, height, cx + orbitOffset - 2, crystalY + 1, 1, 1, PAL.magicGold);
                this.rect(ctx, width, height, cx - orbitOffset + 2, crystalY, 1, 1, PAL.sorceryMagenta);
            }

            // 4f. Gothic Windows & Beat-Driven Magical Illumination
            const winColor = (beatImpulse > 0.5)
                ? (tension > 0.7 ? PAL.sorceryMagenta : PAL.emberOrange)
                : PAL.magicGold;

            // Keep Grand Lancet Window
            const kWinW = Math.max(2, Math.floor(keepW * 0.32));
            const kWinH = Math.max(3, Math.floor(keepH * 0.24));
            this.drawGothicWindow(
                ctx, width, height,
                cx - Math.floor(kWinW / 2), keepY + Math.floor(keepH * 0.22),
                kWinW, kWinH, winColor
            );

            // Left Bastion Slit Window
            const lWinW = Math.max(1, Math.floor(lTowW * 0.26));
            const lWinH = Math.max(2, Math.floor(lTowH * 0.22));
            this.drawGothicWindow(
                ctx, width, height,
                lTowX + Math.floor(lTowW * 0.36), lTowY + Math.floor(lTowH * 0.32),
                lWinW, lWinH, winColor
            );

            // Right Observatory Astral Rose/Lancet Window (Mystic Cyan / White on beat)
            const rWinW = Math.max(2, Math.floor(rTowW * 0.36));
            const rWinH = Math.max(2, Math.floor(rTowH * 0.20));
            this.drawGothicWindow(
                ctx, width, height,
                rTowX + Math.floor(rTowW * 0.30), rTowY + Math.floor(rTowH * 0.26),
                rWinW, rWinH, beatImpulse > 0.6 ? PAL.white : PAL.mysticCyan
            );

            // Curtain Wall Secondary Gallery Windows
            if (wallW >= 24) {
                this.rect(ctx, width, height, wallX + Math.floor(wallW * 0.20), wallY + Math.floor(wallH * 0.35), 2, 3, PAL.magicGold);
                this.rect(ctx, width, height, wallX + Math.floor(wallW * 0.76), wallY + Math.floor(wallH * 0.35), 2, 3, PAL.magicGold);
            }

            // 4g. Castle Gatehouse, Iron Portcullis & Flickering Torches
            const gateW = Math.max(4, Math.floor(wallW * 0.24));
            const gateH = Math.max(4, Math.floor(wallH * 0.50));
            const gateX = Math.floor(cx - gateW / 2);
            const gateY = castleBaseY - gateH;

            // Stone Archway Surround
            this.rect(ctx, width, height, gateX - 2, gateY - 2, gateW + 4, gateH + 2, PAL.castleLight);
            this.rect(ctx, width, height, gateX - 1, gateY - 1, gateW + 2, gateH + 1, PAL.castleShadow);
            this.rect(ctx, width, height, gateX, gateY, gateW, gateH, PAL.black);

            // Iron Portcullis Grate Bars
            if (gateW >= 6) {
                for (let gx = gateX + 2; gx < gateX + gateW - 1; gx += 2) {
                    this.rect(ctx, width, height, gx, gateY, 1, Math.floor(gateH * 0.65), PAL.castleStone);
                }
            }

            // Flickering Wall Torches flanking the Gate
            const torchFlicker = ((Math.floor(this.internalT * 10) & 1) === 0);
            const torchTipCol = (beatImpulse > 0.4 || torchFlicker) ? PAL.magicGold : PAL.emberOrange;
            this.rect(ctx, width, height, gateX - 3, gateY + Math.floor(gateH * 0.25), 1, 2, PAL.emberOrange);
            this.rect(ctx, width, height, gateX - 3, gateY + Math.floor(gateH * 0.25) - 1, 1, 1, torchTipCol);
            this.rect(ctx, width, height, gateX + gateW + 2, gateY + Math.floor(gateH * 0.25), 1, 2, PAL.emberOrange);
            this.rect(ctx, width, height, gateX + gateW + 2, gateY + Math.floor(gateH * 0.25) - 1, 1, 1, torchTipCol);

            // --- LAYER 5: FOREGROUND (Alpine Lake, Waterfall, Golden Spiral Path & Evergreens) ---
            if (castleBaseY < height) {
                const fgHeight = height - castleBaseY;
                const lakeTopY = castleBaseY + Math.max(2, Math.floor(fgHeight * 0.22));
                const lakeBottomY = castleBaseY + Math.max(4, Math.floor(fgHeight * 0.64));

                // 5a. Base Foreground Turf & Gorge Shadow
                this.rect(ctx, width, height, 0, castleBaseY, width, fgHeight, PAL.foregroundDark);

                // 5b. Bob Ross Alpine Gorge Lake & Shimmering Water Reflections
                if (lakeBottomY > lakeTopY && minDim >= 24) {
                    this.rect(ctx, width, height, 0, lakeTopY, width, lakeBottomY - lakeTopY, PAL.black);
                    this.rect(ctx, width, height, 0, lakeTopY, width, Math.max(1, Math.floor((lakeBottomY - lakeTopY) * 0.5)), PAL.deepBlue);

                    // Cascading Waterfall from the West Cliff into the Lake
                    const wfX = castleLeft + Math.floor(lTowW * 0.5);
                    const wfW = Math.max(2, Math.floor(minDim * 0.018));
                    for (let wy = castleBaseY; wy <= lakeTopY; wy++) {
                        const foamCol = ((wy + Math.floor(this.internalT * 15)) & 1) ? PAL.moonSilver : PAL.mysticCyan;
                        this.rect(ctx, width, height, wfX, wy, wfW, 1, foamCol);
                    }
                    // Waterfall splash mist on the water surface
                    this.rect(ctx, width, height, wfX - 2, lakeTopY, wfW + 4, 1, PAL.white);

                    // Horizontal Bob Ross Water Reflections (Moon, Castle Windows & Sky Bursts)
                    for (let ly = lakeTopY + 1; ly < lakeBottomY; ly += 2) {
                        const depthRatio = (ly - lakeTopY) / Math.max(1, lakeBottomY - lakeTopY);
                        const shimmerShift = Math.round(Math.sin(ly * 0.9 + this.internalT * 4.0) * 2);

                        // Moon reflection column on the left water
                        const mRefW = Math.max(3, Math.floor(moonR * (1.6 - depthRatio * 0.6)));
                        this.rect(ctx, width, height, moonX - Math.floor(mRefW / 2) + shimmerShift, ly, mRefW, 1, PAL.moonSilver);
                        if ((ly & 2) === 0) {
                            this.rect(ctx, width, height, moonX + shimmerShift, ly, Math.max(1, Math.floor(mRefW * 0.4)), 1, PAL.white);
                        }

                        // Golden castle window reflection beneath the keep
                        const wRefW = Math.max(2, Math.floor(kWinW * (1.4 + beatImpulse * 0.8)));
                        this.rect(ctx, width, height, cx - Math.floor(wRefW / 2) - shimmerShift, ly, wRefW, 1, winColor);
                    }

                    // Active Firework Burst reflections shimmering on the lake
                    for (let bi = 0; bi < this.bursts.length; bi++) {
                        const b = this.bursts[bi];
                        if (b.active && (t - b.startTime) < b.duration * 0.75) {
                            const bx = Math.floor(b.xRatio * width);
                            const refY = lakeTopY + ((bi * 3 + 1) % Math.max(1, lakeBottomY - lakeTopY - 1));
                            this.rect(ctx, width, height, bx - 4, refY, 8, 1, b.color);
                        }
                    }

                    // Bob Ross Crisp Shoreline Water Edge ("Cutting across with the knife")
                    this.rect(ctx, width, height, 0, lakeTopY, width, 1, PAL.horizonBlue);
                    this.rect(ctx, width, height, Math.floor(width * 0.15), lakeBottomY - 1, Math.floor(width * 0.70), 1, PAL.moonSilver);
                }

                // 5c. Golden Spiral S-Curve Cobblestone Viaduct & Path to the Gate
                const pathStartW = Math.max(3, Math.floor(gateW * 0.95));
                const pathEndW = Math.max(6, Math.floor(minDim * 0.25));
                const pathStartY = castleBaseY;
                const pathEndY = height;

                if (pathEndY > pathStartY) {
                    for (let py = pathStartY; py < pathEndY; py++) {
                        const normY = (py - pathStartY) / Math.max(1, pathEndY - pathStartY);
                        const curW = Math.floor(pathStartW + (pathEndW - pathStartW) * (normY * normY * 0.6 + normY * 0.4));
                        // Graceful S-curve sweeping toward the lower-right Golden Ratio point
                        const curveX = cx + Math.floor(Math.sin(normY * Math.PI * 1.05) * (width * 0.14));
                        const px = Math.floor(curveX - curW / 2);

                        // Viaduct stone bridge piers where the path crosses the alpine lake
                        if (py >= lakeTopY && py <= lakeBottomY) {
                            this.rect(ctx, width, height, px - 1, py, curW + 2, 1, PAL.castleShadow);
                        }

                        // Cobblestone roadbed
                        const stoneCol = ((py >> 1) & 1) ? PAL.castleStone : PAL.castleShadow;
                        this.rect(ctx, width, height, px, py, curW, 1, stoneCol);

                        // Moonlit left parapet / curb & shadowed right curb
                        this.rect(ctx, width, height, px, py, Math.max(1, Math.floor(curW * 0.18)), 1, PAL.castleLight);
                        this.rect(ctx, width, height, px + curW - 1, py, 1, 1, PAL.midMountain);

                        // Ascending Arcane Wayfarer Wisps / Path Runes synced to music
                        if ((tension > 0.45 || beatImpulse > 0.35) && ((py + Math.floor(this.internalT * 14)) % 7 === 0)) {
                            const wispCol = (state === 'climax' || beatLevel === 3) ? PAL.magicGold : PAL.mysticCyan;
                            this.rect(ctx, width, height, px + Math.floor(curW * 0.5), py, 2, 1, wispCol);
                        }
                    }
                }

                // 5d. Repoussoir Framing Bluffs / Hills on Left and Right
                const hillH = Math.max(4, Math.floor(fgHeight + 12));
                // Left Bluff (Sloping down from left edge)
                for (let y = 0; y < hillH; y++) {
                    const drawY = height - 1 - y;
                    const progress = y / hillH;
                    const hw = Math.floor(width * 0.30 * (1.0 - progress * 0.85));
                    if (hw > 0) {
                        this.rect(ctx, width, height, 0, drawY, hw, 1, PAL.foregroundDark);
                        // Rim-lit foliage crest
                        this.rect(ctx, width, height, hw - 2, drawY, 2, 1, PAL.midMountain);
                    }
                }
                // Right Bluff (Asymmetric Golden Ratio framing)
                for (let y = 0; y < hillH; y++) {
                    const drawY = height - 1 - y;
                    const progress = y / hillH;
                    const hw = Math.floor(width * 0.26 * (1.0 - progress * 0.90));
                    if (hw > 0) {
                        this.rect(ctx, width, height, width - hw, drawY, hw, 1, PAL.black);
                        this.rect(ctx, width, height, width - hw + 2, drawY, Math.max(1, hw - 2), 1, PAL.foregroundDark);
                        // Moonlit left-facing slope edge of the right hill!
                        this.rect(ctx, width, height, width - hw, drawY, 2, 1, PAL.midMountain);
                    }
                }

                // 5e. Bob Ross Clustered Evergreen Families (Tall Lead Tree + Companion Tree)
                const leftBaseY = Math.min(height - 1, castleBaseY + Math.floor(minDim * 0.14));
                const rightBaseY = Math.min(height - 1, castleBaseY + Math.floor(minDim * 0.16));

                // Background companion evergreens (pushed slightly inward & higher for depth)
                if (minDim >= 36) {
                    this.drawEvergreen(ctx, width, height, Math.floor(width * 0.17), leftBaseY - 3, Math.floor(minDim * 0.12), false);
                    this.drawEvergreen(ctx, width, height, Math.floor(width * 0.82), rightBaseY - 4, Math.floor(minDim * 0.13), false);
                }

                // Tall foreground Repoussoir evergreens
                this.drawEvergreen(ctx, width, height, Math.floor(width * 0.09), leftBaseY, Math.floor(minDim * 0.20), true);
                this.drawEvergreen(ctx, width, height, Math.floor(width * 0.90), rightBaseY, Math.floor(minDim * 0.22), true);
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