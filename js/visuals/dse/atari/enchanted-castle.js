// === js/visuals/dse/atari/enchanted-castle.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: ATARI ENCHANTED CASTLE (Background DSE)
// Authentic Atari ST 16-Color Shifter Night Fantasy Demo Scene:
// - Soaring Enchanted Castle Citadel on craggy promontory with Keep,
//   Sorcerer Spire, Watchtowers, Arched Gate, and glowing windows.
// - Tiered silhouette of distant midnight mountains behind the castle.
// - Full musical synchronization: beatLevel (1=soft, 2=medium, 3=hard),
//   beatStrength, beatImpulse, tensionPct, and macro states drive
//   arcane energy bursts, spire rays, window pulsations, and particle fireworks.
// - Layering: Sky & Astronomy -> Distant Magic/Fireworks -> Distant Mountains
//             -> Castle & Windows -> Foreground framing hills, pines & winding path.
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
    rgbToHex(...quantizeAtari9Bit(0, 0, 0)),        // 0: Black (Void / Deep Shadow)
    rgbToHex(...quantizeAtari9Bit(36, 0, 72)),      // 1: Midnight Violet (Upper Sky)
    rgbToHex(...quantizeAtari9Bit(0, 36, 108)),     // 2: Deep Night Blue (Mid Sky)
    rgbToHex(...quantizeAtari9Bit(36, 72, 144)),    // 3: Royal Horizon Blue (Low Sky)
    rgbToHex(...quantizeAtari9Bit(0, 36, 72)),      // 4: Distant Mountain Dark
    rgbToHex(...quantizeAtari9Bit(36, 72, 108)),    // 5: Distant Mountain Mid
    rgbToHex(...quantizeAtari9Bit(36, 36, 36)),     // 6: Castle Shadow / Stonework
    rgbToHex(...quantizeAtari9Bit(72, 72, 108)),    // 7: Castle Stone Mid
    rgbToHex(...quantizeAtari9Bit(108, 108, 144)),  // 8: Castle Stone Light
    rgbToHex(...quantizeAtari9Bit(0, 36, 36)),      // 9: Foreground Pine / Hill Dark
    rgbToHex(...quantizeAtari9Bit(180, 216, 252)),  // 10: Moon Silver-Blue / Cloud
    rgbToHex(...quantizeAtari9Bit(252, 252, 252)),  // 11: Pure White (Stars / Spire Peak)
    rgbToHex(...quantizeAtari9Bit(252, 216, 36)),   // 12: Magic Gold (Window / Spark)
    rgbToHex(...quantizeAtari9Bit(252, 72, 0)),     // 13: Ember Orange (Torch / Firework)
    rgbToHex(...quantizeAtari9Bit(0, 216, 216)),    // 14: Mystic Cyan (Runes / Energy)
    rgbToHex(...quantizeAtari9Bit(216, 0, 144))     // 15: Sorcery Magenta (Arcane Bursts)
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

        // Fixed stars (deterministic, no Math.random in render)
        this.stars = [
            { x: 0.05, y: 0.08, phase: 0.1 },
            { x: 0.12, y: 0.22, phase: 1.5 },
            { x: 0.19, y: 0.06, phase: 2.8 },
            { x: 0.28, y: 0.18, phase: 4.1 },
            { x: 0.35, y: 0.11, phase: 0.7 },
            { x: 0.42, y: 0.25, phase: 3.3 },
            { x: 0.58, y: 0.07, phase: 1.9 },
            { x: 0.65, y: 0.20, phase: 5.2 },
            { x: 0.72, y: 0.13, phase: 2.4 },
            { x: 0.81, y: 0.09, phase: 0.4 },
            { x: 0.88, y: 0.24, phase: 3.7 },
            { x: 0.95, y: 0.15, phase: 4.9 },
            { x: 0.22, y: 0.32, phase: 1.2 },
            { x: 0.78, y: 0.30, phase: 2.6 }
        ];

        // Exactly two slowly drifting clouds
        this.clouds = [
            { yRatio: 0.15, speed: 0.018, spanRatio: 0.22 },
            { yRatio: 0.32, speed: -0.012, spanRatio: 0.26 }
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

        // Alternating positions behind left tower, right tower, or high center
        const slot = (beatCount > 0 ? beatCount : this.burstCursor) % 3;
        if (slot === 0) {
            burst.xRatio = 0.50; // Central keep
            burst.yRatio = 0.20;
        } else if (slot === 1) {
            burst.xRatio = 0.36; // Left watchtower
            burst.yRatio = 0.25;
        } else {
            burst.xRatio = 0.64; // Right tower
            burst.yRatio = 0.24;
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
        // SCENE RENDERING PIPELINE (Layer Order)
        // 1. Sky & Astronomy (Stars, Moon, 2 Clouds)
        // 2. Distant Magic & Fireworks (Behind Mountains & Castle)
        // 3. Distant Mountains (Far & Mid)
        // 4. Castle & Windows (Keep, Towers, Spire, Gate, Windows)
        // 5. Foreground (Framing Hills, Pines, Winding Path)
        // =========================================================

        const minDim = Math.min(width, height);
        const cx = Math.floor(width / 2);
        const horizonY = Math.max(1, Math.floor(height * 0.62));

        // --- LAYER 1: SKY & ASTRONOMY ---
        // 1a. Base Sky fill
        this.rect(ctx, width, height, 0, 0, width, height, PAL.midnightViolet);

        if (horizonY > 3) {
            const h1 = Math.floor(horizonY * 0.30);
            const h2 = Math.floor(horizonY * 0.65);

            // Band 1: Midnight Violet
            this.rect(ctx, width, height, 0, 0, width, h1, PAL.midnightViolet);

            // Shifter Dither Band 1-2
            for (let y = Math.max(0, h1 - 2); y < Math.min(height, h1 + 2); y++) {
                if (y % 2 === 0) {
                    this.rect(ctx, width, height, 0, y, width, 1, PAL.deepBlue);
                }
            }

            // Band 2: Deep Blue
            if (h2 > h1) {
                this.rect(ctx, width, height, 0, h1 + 2, width, h2 - (h1 + 2), PAL.deepBlue);
            }

            // Shifter Dither Band 2-3
            for (let y = Math.max(0, h2 - 2); y < Math.min(height, h2 + 2); y++) {
                if (y % 2 === 0) {
                    this.rect(ctx, width, height, 0, y, width, 1, PAL.horizonBlue);
                }
            }

            // Band 3: Royal Horizon Blue
            if (horizonY > h2) {
                this.rect(ctx, width, height, 0, h2 + 2, width, horizonY - (h2 + 2), PAL.horizonBlue);
            }

            // Horizon Pulse
            if (beatImpulse > 0.45 && horizonY >= 2) {
                this.rect(ctx, width, height, 0, horizonY - 2, width, 2, PAL.mysticCyan);
            }
        }

        // If viewport is too tiny for landscape geometry, sky fill suffices
        if (minDim >= 8) {
            // 1b. Twinkling Stars
            for (let i = 0; i < this.stars.length; i++) {
                const s = this.stars[i];
                const sx = Math.floor(s.x * width);
                const sy = Math.floor(s.y * horizonY);
                if (sx < 0 || sx >= width || sy < 0 || sy >= horizonY) continue;

                const twinkle = Math.sin(this.internalT * 3.5 + s.phase);
                if (twinkle > 0.65) {
                    this.rect(ctx, width, height, sx, sy, 1, 1, PAL.white);
                    if (twinkle > 0.92 && minDim >= 50) {
                        this.rect(ctx, width, height, sx - 1, sy, 3, 1, PAL.white);
                        this.rect(ctx, width, height, sx, sy - 1, 1, 3, PAL.white);
                    }
                } else if (twinkle > 0.1) {
                    this.rect(ctx, width, height, sx, sy, 1, 1, PAL.moonSilver);
                }
            }

            // 1c. Moon
            const moonR = Math.max(3, Math.min(9, Math.floor(minDim * 0.048)));
            const moonX = Math.floor(width * (width < height ? 0.22 : 0.18));
            const moonY = Math.max(moonR + 2, Math.floor(horizonY * 0.22));

            for (let my = -moonR; my <= moonR; my++) {
                const dx = Math.round(Math.sqrt(Math.max(0, moonR * moonR - my * my)));
                if (dx > 0) {
                    // Base moon disc in Moon Silver
                    this.rect(ctx, width, height, moonX - dx, moonY + my, dx * 2, 1, PAL.moonSilver);
                    // Luminous bright inner core in White
                    if (dx > 1) {
                        this.rect(ctx, width, height, moonX - dx + 1, moonY + my, Math.floor(dx * 1.4), 1, PAL.white);
                    }
                    // Crater / shadow crescent in Deep Blue
                    if (dx > 2 && my > -moonR * 0.5 && my < moonR * 0.7) {
                        this.rect(ctx, width, height, moonX + Math.floor(dx * 0.3), moonY + my, Math.floor(dx * 0.6), 1, PAL.deepBlue);
                    }
                }
            }

            // 1d. Exactly two slowly drifting clouds
            for (let ci = 0; ci < this.clouds.length; ci++) {
                const cloud = this.clouds[ci];
                const cWidth = Math.max(12, Math.floor(width * cloud.spanRatio));
                const cHeight = Math.max(3, Math.floor(minDim * 0.035));
                const cY = Math.floor(horizonY * cloud.yRatio);
                const drift = Math.floor(this.internalT * width * cloud.speed);
                const span = width + cWidth * 2;
                let cX = ((Math.floor(width * (ci === 0 ? 0.15 : 0.65)) + drift + cWidth) % span);
                if (cX < 0) cX += span;
                cX -= cWidth;

                // Cloud shadow layer
                this.rect(ctx, width, height, cX + 2, cY + 1, cWidth, cHeight, PAL.deepBlue);
                // Cloud main highlight
                this.rect(ctx, width, height, cX, cY, cWidth, cHeight, PAL.moonSilver);
                // Fluffy top tier
                this.rect(ctx, width, height, cX + Math.floor(cWidth * 0.25), cY - 1, Math.floor(cWidth * 0.5), 1, PAL.white);
            }

            // --- LAYER 2: DISTANT MAGIC & FIREWORKS (Behind Castle & Mountains) ---
            // 2a. Spire Energy Rays behind keep
            if (tension > 0.45 || state === 'climax' || state === 'buildup') {
                const rayW = Math.max(2, Math.floor(minDim * 0.025));
                const rayH = Math.floor(minDim * (0.15 + tension * 0.20 + beatImpulse * 0.15));
                const rayX = Math.floor(cx - rayW / 2);
                const rayTop = Math.max(0, horizonY - rayH);
                this.rect(ctx, width, height, rayX, rayTop, rayW, rayH, (state === 'climax' ? PAL.magicGold : PAL.mysticCyan));
                this.rect(ctx, width, height, rayX + 1, rayTop + 2, Math.max(1, rayW - 2), Math.max(1, rayH - 2), PAL.white);
            }

            // 2b. Fireworks & Magic Bursts
            for (let bi = 0; bi < this.bursts.length; bi++) {
                const burst = this.bursts[bi];
                if (!burst.active) continue;

                const progress = (t - burst.startTime) / burst.duration;
                if (progress >= 1.0) {
                    burst.active = false;
                    continue;
                }

                const burstCX = Math.floor(burst.xRatio * width);
                const burstCY = Math.floor(burst.yRatio * height);
                const curRadius = burst.radiusFactor * minDim * 0.24 * Math.sin(progress * Math.PI * 0.5);

                for (let pi = 0; pi < burst.particleCount; pi++) {
                    const p = burst.particles[pi];
                    const px = Math.floor(burstCX + p.dx * curRadius);
                    const py = Math.floor(burstCY + p.dy * curRadius + progress * progress * 8);

                    if (px >= 0 && px < width && py >= 0 && py < height) {
                        const pColor = (progress > 0.6) ? burst.secondaryColor : burst.color;
                        this.rect(ctx, width, height, px, py, p.size, p.size, pColor);
                    }
                }

                // Arcane star center flash during early expansion
                if (burst.pattern === 1 && progress < 0.35) {
                    const sparkR = Math.max(1, Math.floor(minDim * 0.02 * (1.0 - progress / 0.35)));
                    this.rect(ctx, width, height, burstCX - sparkR, burstCY, sparkR * 2 + 1, 1, PAL.white);
                    this.rect(ctx, width, height, burstCX, burstCY - sparkR, 1, sparkR * 2 + 1, PAL.white);
                }
            }

            // --- LAYER 3: DISTANT MOUNTAINS ---
            // 3a. Far Mountains (Dark Silhouette)
            const farPeakY = Math.floor(horizonY * 0.60);
            for (let x = 0; x < width; x++) {
                const nx = x / Math.max(1, width);
                const wave = Math.sin(nx * Math.PI * 3.5) * 0.5 + Math.sin(nx * Math.PI * 7.0) * 0.25;
                const mHeight = Math.floor((horizonY - farPeakY) * Math.max(0, 0.4 + wave * 0.6));
                if (mHeight > 0) {
                    this.rect(ctx, width, height, x, horizonY - mHeight, 1, mHeight, PAL.farMountain);
                }
            }

            // 3b. Mid Mountains (Slate Blue Ridge)
            const midPeakY = Math.floor(horizonY * 0.76);
            for (let x = 0; x < width; x++) {
                const nx = (x + width * 0.3) / Math.max(1, width);
                const wave = Math.sin(nx * Math.PI * 2.8) * 0.6 + Math.sin(nx * Math.PI * 5.2) * 0.3;
                const mHeight = Math.floor((horizonY - midPeakY) * Math.max(0, 0.35 + wave * 0.65));
                if (mHeight > 0) {
                    this.rect(ctx, width, height, x, horizonY - mHeight, 1, mHeight, PAL.midMountain);
                }
            }

            // --- LAYER 4: THE ENCHANTED CASTLE & WINDOWS ---
            const castleW = Math.max(24, Math.min(Math.floor(width * 0.85), Math.floor(minDim * 0.72)));
            const castleH = Math.max(16, Math.floor(castleW * 0.58));
            const castleBaseY = Math.min(height - 4, horizonY + Math.max(2, Math.floor(height * 0.06)));
            const castleLeft = Math.floor(cx - castleW / 2);

            // Castle Main Wall / Curtain Wall
            const wallW = Math.floor(castleW * 0.68);
            const wallH = Math.floor(castleH * 0.48);
            const wallX = Math.floor(cx - wallW / 2);
            const wallY = castleBaseY - wallH;

            // Wall Shadow outline
            this.rect(ctx, width, height, wallX - 1, wallY - 1, wallW + 2, wallH + 1, PAL.castleShadow);
            // Wall Stone
            this.rect(ctx, width, height, wallX, wallY, wallW, wallH, PAL.castleStone);

            // Wall Crenellations (Merlons)
            const numMerlons = Math.max(3, Math.floor(wallW / 6));
            for (let m = 0; m < numMerlons; m++) {
                if (m % 2 === 0) {
                    const mx = wallX + Math.floor(m * (wallW / numMerlons));
                    const mw = Math.max(2, Math.floor(wallW / numMerlons * 0.8));
                    this.rect(ctx, width, height, mx, wallY - 3, mw, 3, PAL.castleStone);
                    this.rect(ctx, width, height, mx, wallY - 3, mw, 1, PAL.castleLight);
                }
            }

            // Left Watchtower
            const lTowW = Math.max(6, Math.floor(castleW * 0.22));
            const lTowH = Math.floor(castleH * 0.80);
            const lTowX = castleLeft;
            const lTowY = castleBaseY - lTowH;
            this.rect(ctx, width, height, lTowX - 1, lTowY - 1, lTowW + 2, lTowH + 1, PAL.castleShadow);
            this.rect(ctx, width, height, lTowX, lTowY, lTowW, lTowH, PAL.castleStone);
            this.rect(ctx, width, height, lTowX, lTowY, 1, lTowH, PAL.castleLight);

            // Left Tower Roof (Steep Cone)
            const lRoofH = Math.floor(lTowW * 1.1);
            for (let ry = 0; ry < lRoofH; ry++) {
                const rw = Math.max(1, Math.floor(lTowW * (1.0 - ry / lRoofH)));
                const rx = lTowX + Math.floor((lTowW - rw) / 2);
                this.rect(ctx, width, height, rx, lTowY - ry, rw, 1, PAL.castleShadow);
                this.rect(ctx, width, height, rx, lTowY - ry, 1, 1, PAL.castleLight);
            }

            // Right Observatory Tower
            const rTowW = Math.max(6, Math.floor(castleW * 0.24));
            const rTowH = Math.floor(castleH * 0.84);
            const rTowX = castleLeft + castleW - rTowW;
            const rTowY = castleBaseY - rTowH;
            this.rect(ctx, width, height, rTowX - 1, rTowY - 1, rTowW + 2, rTowH + 1, PAL.castleShadow);
            this.rect(ctx, width, height, rTowX, rTowY, rTowW, rTowH, PAL.castleStone);
            this.rect(ctx, width, height, rTowX + rTowW - 1, rTowY, 1, rTowH, PAL.castleLight);

            // Right Tower Roof
            const rRoofH = Math.floor(rTowW * 1.1);
            for (let ry = 0; ry < rRoofH; ry++) {
                const rw = Math.max(1, Math.floor(rTowW * (1.0 - ry / rRoofH)));
                const rx = rTowX + Math.floor((rTowW - rw) / 2);
                this.rect(ctx, width, height, rx, rTowY - ry, rw, 1, PAL.castleShadow);
                this.rect(ctx, width, height, rx + rw - 1, rTowY - ry, 1, 1, PAL.castleLight);
            }

            // Central Great Keep (Highest Tower & Spire)
            const keepW = Math.max(8, Math.floor(castleW * 0.32));
            const keepH = castleH;
            const keepX = Math.floor(cx - keepW / 2);
            const keepY = castleBaseY - keepH;
            this.rect(ctx, width, height, keepX - 1, keepY - 1, keepW + 2, keepH + 1, PAL.castleShadow);
            this.rect(ctx, width, height, keepX, keepY, keepW, keepH, PAL.castleStone);
            this.rect(ctx, width, height, keepX, keepY, 1, keepH, PAL.castleLight);
            this.rect(ctx, width, height, keepX + keepW - 1, keepY, 1, keepH, PAL.castleShadow);

            // Sorcerer Spire on Keep
            const spireH = Math.floor(keepW * 1.5);
            for (let sy = 0; sy < spireH; sy++) {
                const sw = Math.max(1, Math.floor(keepW * (1.0 - sy / spireH)));
                const sx = keepX + Math.floor((keepW - sw) / 2);
                this.rect(ctx, width, height, sx, keepY - sy, sw, 1, PAL.castleShadow);
                this.rect(ctx, width, height, sx, keepY - sy, 1, 1, PAL.castleLight);
            }
            // Spire Peak Crystal (White / Cyan)
            this.rect(ctx, width, height, cx - 1, keepY - spireH - 2, 2, 2, (beatImpulse > 0.4 ? PAL.white : PAL.mysticCyan));

            // Windows & Magical Illumination
            const winColor = (beatImpulse > 0.5)
                ? (tension > 0.7 ? PAL.sorceryMagenta : PAL.emberOrange)
                : PAL.magicGold;

            // Keep Arched Window
            const kWinW = Math.max(2, Math.floor(keepW * 0.3));
            const kWinH = Math.max(3, Math.floor(keepH * 0.22));
            const kWinX = Math.floor(cx - kWinW / 2);
            const kWinY = keepY + Math.floor(keepH * 0.25);
            this.rect(ctx, width, height, kWinX - 1, kWinY - 1, kWinW + 2, kWinH + 2, PAL.castleShadow);
            this.rect(ctx, width, height, kWinX, kWinY, kWinW, kWinH, winColor);

            // Left Tower Slit Window
            const lWinW = Math.max(1, Math.floor(lTowW * 0.25));
            const lWinH = Math.max(2, Math.floor(lTowH * 0.20));
            this.rect(ctx, width, height, lTowX + Math.floor(lTowW * 0.35), lTowY + Math.floor(lTowH * 0.35), lWinW, lWinH, winColor);

            // Right Tower Rose Window
            const rWinW = Math.max(2, Math.floor(rTowW * 0.35));
            const rWinH = Math.max(2, Math.floor(rTowH * 0.18));
            this.rect(ctx, width, height, rTowX + Math.floor(rTowW * 0.30), rTowY + Math.floor(rTowH * 0.30), rWinW, rWinH, PAL.mysticCyan);

            // Castle Gate & Portcullis
            const gateW = Math.max(4, Math.floor(wallW * 0.24));
            const gateH = Math.max(4, Math.floor(wallH * 0.50));
            const gateX = Math.floor(cx - gateW / 2);
            const gateY = castleBaseY - gateH;
            this.rect(ctx, width, height, gateX - 1, gateY - 1, gateW + 2, gateH + 1, PAL.castleLight);
            this.rect(ctx, width, height, gateX, gateY, gateW, gateH, PAL.black);
            // Gate Torch Accents
            this.rect(ctx, width, height, gateX - 2, gateY + Math.floor(gateH * 0.3), 1, 2, PAL.emberOrange);
            this.rect(ctx, width, height, gateX + gateW + 1, gateY + Math.floor(gateH * 0.3), 1, 2, PAL.emberOrange);

            // --- LAYER 5: FOREGROUND (Framing Hills, Pines & Winding Path) ---
            // 5a. Base Foreground Ground
            if (castleBaseY < height) {
                this.rect(ctx, width, height, 0, castleBaseY, width, height - castleBaseY, PAL.foregroundDark);
            }

            // 5b. Winding Cobblestone Path to the Gate
            const pathStartW = Math.max(3, Math.floor(gateW * 0.9));
            const pathEndW = Math.max(6, Math.floor(minDim * 0.24));
            const pathStartY = castleBaseY;
            const pathEndY = height;

            if (pathEndY > pathStartY) {
                for (let py = pathStartY; py < pathEndY; py++) {
                    const normY = (py - pathStartY) / Math.max(1, pathEndY - pathStartY);
                    const curW = Math.floor(pathStartW + (pathEndW - pathStartW) * normY);
                    const curveX = cx + Math.floor(Math.sin(normY * Math.PI * 0.9) * (width * 0.16));
                    const px = Math.floor(curveX - curW / 2);

                    // Path stone body
                    this.rect(ctx, width, height, px, py, curW, 1, PAL.castleStone);
                    // Path edge cobblestones
                    this.rect(ctx, width, height, px, py, 1, 1, PAL.castleLight);
                    this.rect(ctx, width, height, px + curW - 1, py, 1, 1, PAL.castleLight);

                    // Magic trail flecks when tension is high
                    if (tension > 0.6 && (py + Math.floor(this.internalT * 12)) % 7 === 0) {
                        this.rect(ctx, width, height, px + Math.floor(curW / 2), py, 1, 1, PAL.mysticCyan);
                    }
                }
            }

            // 5c. Framing Left and Right Hills / Bluffs
            const hillH = Math.max(4, Math.floor((height - castleBaseY + 12)));
            // Left Hill
            for (let y = 0; y < hillH; y++) {
                const drawY = height - 1 - y;
                const hw = Math.floor(width * 0.28 * (1.0 - y / hillH));
                if (hw > 0) {
                    this.rect(ctx, width, height, 0, drawY, hw, 1, PAL.foregroundDark);
                    this.rect(ctx, width, height, hw - 1, drawY, 1, 1, PAL.castleShadow);
                }
            }
            // Right Hill
            for (let y = 0; y < hillH; y++) {
                const drawY = height - 1 - y;
                const hw = Math.floor(width * 0.25 * (1.0 - y / hillH));
                if (hw > 0) {
                    this.rect(ctx, width, height, width - hw, drawY, hw, 1, PAL.foregroundDark);
                    this.rect(ctx, width, height, width - hw, drawY, 1, 1, PAL.castleShadow);
                }
            }

            // 5d. Stylized Pixel Pine Trees
            const drawPine = (pineX, pineBaseY, pineHeight) => {
                const pH = Math.max(6, pineHeight);
                const pW = Math.max(4, Math.floor(pH * 0.65));
                const trunkW = Math.max(1, Math.floor(pW * 0.25));
                const trunkH = Math.max(2, Math.floor(pH * 0.25));

                // Trunk
                this.rect(ctx, width, height, pineX - Math.floor(trunkW / 2), pineBaseY - trunkH, trunkW, trunkH, PAL.castleShadow);

                // Tiered needles
                const foliageH = pH - trunkH;
                const tiers = 3;
                const tierH = Math.floor(foliageH / tiers);
                for (let t = 0; t < tiers; t++) {
                    const tTop = pineBaseY - trunkH - (t + 1) * tierH;
                    const maxTierW = Math.floor(pW * (1.0 - t * 0.22));
                    for (let row = 0; row < tierH; row++) {
                        const rw = Math.max(1, Math.floor(maxTierW * (row / tierH)));
                        const rx = pineX - Math.floor(rw / 2);
                        this.rect(ctx, width, height, rx, tTop + row, rw, 1, PAL.foregroundDark);
                        this.rect(ctx, width, height, rx, tTop + row, 1, 1, PAL.midMountain);
                    }
                }
            };

            const leftPineX = Math.floor(width * 0.12);
            const rightPineX = Math.floor(width * 0.88);
            drawPine(leftPineX, Math.min(height - 1, castleBaseY + Math.floor(minDim * 0.12)), Math.floor(minDim * 0.16));
            drawPine(rightPineX, Math.min(height - 1, castleBaseY + Math.floor(minDim * 0.14)), Math.floor(minDim * 0.18));
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
