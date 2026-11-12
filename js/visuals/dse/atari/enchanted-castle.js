// === js/visuals/dse/atari/enchanted-castle.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: ATARI ENCHANTED CASTLE (Background DSE)
// Dark Gothic / Schwarze Romantik Atari ST 16-Color Shifter Masterpiece:
// - Authentic 9-bit Gothic Horror Palette (Tenebrism pitch black, bruised plum,
//   storm slate, dead moor, tombstone grey, tallow candle, vampiric crimson,
//   spectral ectoplasm green & eldritch wine).
// - Golden Ratio (Phi = 0.618 / 0.382 / 0.236) composition & stark Chiaroscuro:
//   * Giant cratered Full Moon shifting into a creeping Blood-Moon Eclipse
//     under high musical tension, sliced by razor-thin storm-wrack clouds.
//   * Jagged Carpathian fangs (O(1) pre-baked 68000 ridge LUTs, zero render trig).
//   * Needle-spired Gothic Ruin-Citadel with iron crosses, gargoyles, broken
//     battlements, cursed crimson rose-window & Z-occluded 3D orbiting soul-orbs.
//   * Stagnant black mire veiled in creeping graveyard mist, ruined crypt viaduct,
//     tilted tombstones, gothic crosses & claw-branched gnarled dead oaks.
// - Full Musical DSE Choreography:
//   * Smooth decay envelopes (`beatEnv`, `hardBeatEnv`, `lightningEnv`).
//   * Graded beat bursts (1=Ectoplasm Mist, 2=Crimson Occult Scar + Bat Swarm,
//     3=Forked Thunderstorm Lightning striking the castle spires + Sheet Flash).
// - 100% Atari ST 9-bit quantized 16-color palette (Zero-GC, deterministic).
// =========================================================

import {
    quantizeAtari9Bit,
    rgbToHex,
    applyOrderedDitherFade
} from '../../utils/hardware-constraints.js';

// --- STRICT 16-COLOR ATARI ST 9-BIT GOTHIC HORROR SHIFTER PALETTE ---
// Every channel uses exact 3-bit Shifter steps (0, 36, 72, 108, 144, 180, 216, 252),
// bit-identically preserved under quantizeAtari9Bit(r, g, b).
export const ATARI_ENCHANTED_CASTLE_PALETTE = Object.freeze([
    rgbToHex(...quantizeAtari9Bit(0, 0, 0)),        // 0: Pitch Black (Tenebrism Void / Dead Silhouettes)
    rgbToHex(...quantizeAtari9Bit(36, 0, 36)),      // 1: Necrotic Plum (Oppressive Upper Night Sky)
    rgbToHex(...quantizeAtari9Bit(36, 36, 72)),     // 2: Stormy Carpathian Slate (Mid Storm Sky)
    rgbToHex(...quantizeAtari9Bit(72, 72, 108)),    // 3: Ashen Mist Slate (Low Horizon / Storm Sheet)
    rgbToHex(...quantizeAtari9Bit(0, 36, 36)),      // 4: Dead Moor Abyssal Teal (Far Crags / Mire Deep)
    rgbToHex(...quantizeAtari9Bit(36, 72, 72)),     // 5: Crypt Moss / Graveyard Fog (Valley Mist)
    rgbToHex(...quantizeAtari9Bit(36, 36, 36)),     // 6: Charcoal Basalt (Dark Castle Stonework)
    rgbToHex(...quantizeAtari9Bit(72, 72, 72)),     // 7: Tombstone Grey (Weathered Masonry / Crag)
    rgbToHex(...quantizeAtari9Bit(108, 108, 144)),  // 8: Cold Bone Slate (Razor Moonlight Rim)
    rgbToHex(...quantizeAtari9Bit(36, 0, 0)),       // 9: Dried Blood Bark (Foreground Earth / Dead Oak)
    rgbToHex(...quantizeAtari9Bit(180, 180, 216)),  // 10: Cadaverous Moon Silver (Pale Moon / Mist Rim)
    rgbToHex(...quantizeAtari9Bit(252, 252, 252)),  // 11: Forked Lightning White (Storm Bolt / Moon Core)
    rgbToHex(...quantizeAtari9Bit(216, 180, 72)),   // 12: Sickly Tallow Candle (Lone Haunted Windows)
    rgbToHex(...quantizeAtari9Bit(180, 0, 36)),     // 13: Vampiric Blood Crimson (Blood Moon / Rose Glass)
    rgbToHex(...quantizeAtari9Bit(72, 216, 144)),   // 14: Spectral Ectoplasm Green (Wisps / Necromancy)
    rgbToHex(...quantizeAtari9Bit(108, 0, 72))      // 15: Dark Eldritch Wine (Blood Aura / Occult Sigils)
]);

// API-compatible PAL keys mapped to our Gothic Horror Shifter indices
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

// Pre-computed razor-sharp Carpathian crag definitions
const RIDGE_LUT_SIZE = 256;

const FAR_PEAKS = Object.freeze([
    Object.freeze({ pos: 0.07, height: 0.78, leftSlope: 6.8, rightSlope: 5.2 }),
    Object.freeze({ pos: 0.21, height: 0.96, leftSlope: 5.8, rightSlope: 4.5 }),
    Object.freeze({ pos: 0.37, height: 0.72, leftSlope: 6.4, rightSlope: 5.8 }),
    Object.freeze({ pos: 0.55, height: 0.88, leftSlope: 5.6, rightSlope: 4.9 }),
    Object.freeze({ pos: 0.75, height: 1.00, leftSlope: 4.9, rightSlope: 4.4 }),
    Object.freeze({ pos: 0.92, height: 0.82, leftSlope: 5.8, rightSlope: 6.0 })
]);

const MID_PEAKS = Object.freeze([
    Object.freeze({ pos: 0.05, height: 0.70, leftSlope: 5.8, rightSlope: 4.6 }),
    Object.freeze({ pos: 0.16, height: 0.92, leftSlope: 5.2, rightSlope: 4.0 }),
    Object.freeze({ pos: 0.32, height: 0.76, leftSlope: 5.6, rightSlope: 4.8 }),
    Object.freeze({ pos: 0.68, height: 0.85, leftSlope: 5.0, rightSlope: 4.3 }),
    Object.freeze({ pos: 0.84, height: 0.96, leftSlope: 4.6, rightSlope: 4.0 }),
    Object.freeze({ pos: 0.96, height: 0.68, leftSlope: 5.5, rightSlope: 5.8 })
]);

// Deterministic bat swarm flight seeds (Zero-GC)
const BAT_SEEDS = Object.freeze([
    Object.freeze({ phase: 0.0, speed: 0.11, yBase: 0.34, amp: 0.05 }),
    Object.freeze({ phase: 1.3, speed: 0.14, yBase: 0.27, amp: 0.06 }),
    Object.freeze({ phase: 2.7, speed: 0.09, yBase: 0.22, amp: 0.04 }),
    Object.freeze({ phase: 4.1, speed: 0.13, yBase: 0.30, amp: 0.07 }),
    Object.freeze({ phase: 5.2, speed: 0.16, yBase: 0.19, amp: 0.05 }),
    Object.freeze({ phase: 3.4, speed: 0.12, yBase: 0.25, amp: 0.06 })
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

        // Smooth internal DSE envelopes for ghostly light decay & thunderstorm flashes
        this.beatEnv = 0;
        this.hardBeatEnv = 0;
        this.lightningEnv = 0;
        this.batSwarmEnv = 0;
        this.lightningSlot = 0;

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

        // Sparse, cold distant stars (fewer & dimmer so darkness dominates)
        this.stars = [
            { x: 0.05, y: 0.08, phase: 0.2, mag: 1 },
            { x: 0.13, y: 0.16, phase: 1.7, mag: 1 },
            { x: 0.19, y: 0.06, phase: 2.9, mag: 2 },
            { x: 0.34, y: 0.11, phase: 4.1, mag: 1 },
            { x: 0.44, y: 0.21, phase: 0.8, mag: 1 },
            { x: 0.56, y: 0.07, phase: 3.3, mag: 2 },
            { x: 0.63, y: 0.18, phase: 1.9, mag: 1 },
            { x: 0.72, y: 0.10, phase: 5.2, mag: 1 },
            { x: 0.81, y: 0.06, phase: 2.4, mag: 2 },
            { x: 0.88, y: 0.20, phase: 0.5, mag: 1 },
            { x: 0.94, y: 0.13, phase: 3.9, mag: 1 },
            { x: 0.77, y: 0.29, phase: 2.6, mag: 1 }
        ];

        // Two skeletal, knife-edged storm-wrack ribbons slicing across the moon
        this.clouds = [
            { yRatio: 0.24, speed: 0.014, spanRatio: 0.30 },
            { yRatio: 0.35, speed: -0.010, spanRatio: 0.34 }
        ];

        // Pre-baked 68000-style Carpathian Ridge Lookup Tables (Zero trig in render!)
        this.farElevLUT = new Float32Array(RIDGE_LUT_SIZE);
        this.farRimLUT = new Float32Array(RIDGE_LUT_SIZE);
        this.farFaceLUT = new Uint8Array(RIDGE_LUT_SIZE);

        this.midElevLUT = new Float32Array(RIDGE_LUT_SIZE);
        this.midRimLUT = new Float32Array(RIDGE_LUT_SIZE);
        this.midFaceLUT = new Uint8Array(RIDGE_LUT_SIZE);

        this.bakeRidgeLUT(FAR_PEAKS, this.farElevLUT, this.farRimLUT, this.farFaceLUT);
        this.bakeRidgeLUT(MID_PEAKS, this.midElevLUT, this.midRimLUT, this.midFaceLUT);
    }

    bakeRidgeLUT(peaks, elevOut, rimOut, faceOut) {
        for (let idx = 0; idx < RIDGE_LUT_SIZE; idx++) {
            const nx = idx / (RIDGE_LUT_SIZE - 1);
            let bestElevation = 0;
            let isMoonlitFace = false;
            let ridgeProximity = 1.0;

            for (let i = 0; i < peaks.length; i++) {
                const p = peaks[i];
                const diff = nx - p.pos;
                const slope = diff < 0 ? p.leftSlope : p.rightSlope;
                // Jagged gothic rock teeth
                const crag = Math.sin(nx * 59.0 + i * 2.3) * 0.042
                    + Math.cos(nx * 29.0 - i * 1.4) * 0.028
                    + Math.sin(nx * 113.0 + i) * 0.015;
                const elev = Math.max(0, p.height - Math.abs(diff) * slope + crag);

                if (elev > bestElevation) {
                    bestElevation = elev;
                    isMoonlitFace = diff < 0;
                    ridgeProximity = Math.abs(diff) * slope;
                }
            }

            elevOut[idx] = Math.min(1.0, bestElevation);
            // Thin, stark chiaroscuro rim rather than thick bright snowcaps
            rimOut[idx] = Math.max(0.03, 0.14 - ridgeProximity * 0.12);
            faceOut[idx] = isMoonlitFace ? 2 : (ridgeProximity < 0.045 ? 1 : 0);
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

        const effectiveLevel = level > 0 ? level : (strength >= 2 / 3 ? 3 : strength >= 1 / 3 ? 2 : 1);
        const slot = (beatCount > 0 ? beatCount : this.burstCursor) % 3;

        // Drive gothic light, bat swarm & storm-lightning envelopes
        this.beatEnv = Math.max(this.beatEnv, strength);
        if (effectiveLevel >= 2) {
            this.batSwarmEnv = Math.min(1.0, Math.max(this.batSwarmEnv, 0.55 + strength * 0.45));
        }
        if (effectiveLevel === 3 || (state === 'climax' && effectiveLevel >= 2)) {
            this.hardBeatEnv = 1.0;
            this.lightningEnv = 1.0;
            this.lightningSlot = slot;
        }

        // In playing, keep sky manifestations spare and eerie on very low strength
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

        // Strictly graded Gothic manifestations: soft < medium < hard
        if (effectiveLevel === 1) {
            // Spectral Ectoplasm Soul-Wisps
            burst.radiusFactor = 0.50 + strength * 0.15;
            burst.particleCount = 12;
            burst.duration = 0.65;
            burst.pattern = 0;
            burst.color = PAL.mysticCyan;
            burst.secondaryColor = PAL.midMountain;
        } else if (effectiveLevel === 2) {
            // Occult Crimson / Dark Wine Cross-Scar
            burst.radiusFactor = 0.80 + strength * 0.20;
            burst.particleCount = 20;
            burst.duration = 0.85;
            burst.pattern = (state === 'climax') ? 2 : 1;
            burst.color = (beatCount & 1) ? PAL.emberOrange : PAL.sorceryMagenta;
            burst.secondaryColor = PAL.mysticCyan;
        } else {
            // Vampiric / Thunderstorm Supernova + Forked Lightning Strike
            burst.radiusFactor = 1.15 + strength * 0.30;
            burst.particleCount = 32;
            burst.duration = 1.10;
            burst.pattern = (state === 'climax') ? 2 : 0;
            burst.color = (state === 'climax') ? PAL.emberOrange : PAL.white;
            burst.secondaryColor = PAL.sorceryMagenta;
        }

        // High-tension & Climax necromantic sigil escalation
        if (state === 'climax' || tension > 0.8) {
            burst.radiusFactor += 0.20;
            burst.pattern = 2; // Dark Occult Octagram Sigil
        }

        if (slot === 0) {
            burst.xRatio = 0.50; // Central Needle Belfry
            burst.yRatio = 0.18;
        } else if (slot === 1) {
            burst.xRatio = 0.36; // West Ruined Watchtower
            burst.yRatio = 0.25;
        } else {
            burst.xRatio = 0.64; // East Vampire Spire
            burst.yRatio = 0.22;
        }

        // Deterministic particle trajectories
        for (let i = 0; i < MAX_PARTICLES_PER_BURST; i++) {
            const angle = (i / burst.particleCount) * Math.PI * 2 + (beatCount * 0.42);
            const speed = 0.75 + (((i * 7 + (beatCount > 0 ? beatCount : 1)) % 5) / 5) * 0.55;
            burst.particles[i].dx = Math.cos(angle) * speed;
            burst.particles[i].dy = Math.sin(angle) * speed;
            burst.particles[i].size = (effectiveLevel === 3 && (i % 3 === 0)) ? 2 : 1;
        }
    }

    // 3-Stage Atari ST Shifter Checkerboard Sky Dither (Tenebrism Storm Gradient)
    drawShifterDitherBand(ctx, width, height, centerY, span, topCol, botCol, px) {
        const stepX = px * 4;
        const halfSpan = Math.max(px, span);
        const third = Math.max(px, Math.floor(halfSpan / 1.5));

        for (let dy = -halfSpan; dy < halfSpan; dy += px) {
            const y = centerY + dy;
            if (y < 0 || y >= height) continue;
            const rowParity = Math.floor(y / px) & 1;

            if (dy < -third) {
                if (rowParity === 0) {
                    for (let x = 0; x < width; x += stepX) {
                        this.rect(ctx, width, height, x, y, px, px, botCol);
                    }
                }
            } else if (dy < third) {
                const xOffset = rowParity * (px * 2);
                for (let x = xOffset; x < width; x += stepX) {
                    this.rect(ctx, width, height, x, y, px * 2, px, dy < 0 ? botCol : topCol);
                }
            } else {
                if (rowParity === 1) {
                    for (let x = px * 2; x < width; x += stepX) {
                        this.rect(ctx, width, height, x, y, px, px, topCol);
                    }
                }
            }
        }
    }

    // Razor-Thin Nosferatu Storm-Wrack Cloud Slicing Across the Giant Moon (Zero-GC)
    drawStormWrackCloud(ctx, width, height, cX, cY, cWidth, cHeight, moonX, moonY, bloodFactor, px) {
        const distToMoon = Math.hypot((cX + cWidth * 0.5) - moonX, cY - moonY);
        const slicingMoon = distToMoon < cWidth * 0.85;

        // Skeletal knife-edged dark storm core (casts stark silhouette across the moon!)
        const coreH = Math.max(px, Math.floor(cHeight * 0.65));
        this.rect(ctx, width, height, cX, cY, cWidth, coreH, PAL.black);
        this.rect(ctx, width, height, cX - px * 4, cY + px, px * 4, px, PAL.midnightViolet);
        this.rect(ctx, width, height, cX + cWidth, cY + px, px * 5, px, PAL.midnightViolet);

        // Shredded lower tendrils
        this.rect(ctx, width, height, cX + Math.floor(cWidth * 0.18), cY + coreH, Math.floor(cWidth * 0.58), px, PAL.midnightViolet);
        this.rect(ctx, width, height, cX + Math.floor(cWidth * 0.30), cY + coreH + px, Math.floor(cWidth * 0.32), px, PAL.deepBlue);

        // Eerie rim-light along the upper razor edge (silver or blood-crimson during eclipse!)
        const rimCol = bloodFactor > 0.55
            ? PAL.emberOrange
            : (slicingMoon ? PAL.moonSilver : PAL.castleLight);
        this.rect(ctx, width, height, cX + Math.floor(cWidth * 0.08), cY - px, Math.floor(cWidth * 0.76), px, rimCol);
        if (slicingMoon) {
            this.rect(ctx, width, height, cX + Math.floor(cWidth * 0.25), cY - px, Math.floor(cWidth * 0.35), px, bloodFactor > 0.7 ? PAL.magicGold : PAL.white);
        }
    }

    // Jagged Forked Gothic Thunderstorm Lightning striking from Sky Top into a Castle Lightning Rod
    drawForkedLightning(ctx, width, height, targetX, targetY, intensity, isCrimson, px) {
        const segments = 10;
        const startX = targetX + (((Math.floor(this.internalT * 7)) & 1) ? -px * 12 : px * 12);
        let prevX = startX;
        let prevY = 0;

        const glowCol = isCrimson ? PAL.emberOrange : PAL.mysticCyan;

        for (let s = 1; s <= segments; s++) {
            const frac = s / segments;
            const jag = (s < segments)
                ? Math.round(Math.sin(s * 2.7 + this.internalT * 19.0) * px * 5)
                : 0;
            const curX = Math.floor(startX + (targetX - startX) * frac) + jag;
            const curY = Math.floor(targetY * frac);
            const segH = Math.max(px, curY - prevY + px);
            const drawX = Math.floor((prevX + curX) * 0.5);

            // Outer ectoplasm / blood-crimson plasma sheath
            if (intensity > 0.45) {
                this.rect(ctx, width, height, drawX - px, prevY, px * 3, segH, glowCol);
            }
            // Blinding white lightning core
            this.rect(ctx, width, height, drawX, prevY, px, segH, PAL.white);

            // Secondary forked side-branches tearing into the storm sky
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

    // Flapping Vampire Bat Silhouettes spiraling out of the Belfry across the Moon (Zero-GC)
    drawBatSwarm(ctx, width, height, cx, horizonY, moonX, moonY, tension, px) {
        const activeBats = tension > 0.65 ? BAT_SEEDS.length : (this.batSwarmEnv > 0.2 ? 5 : 3);

        for (let i = 0; i < activeBats; i++) {
            const b = BAT_SEEDS[i];
            const speedMult = 1.0 + tension * 0.8 + this.batSwarmEnv * 0.6;
            const cycle = (this.internalT * b.speed * speedMult + b.phase) % 1.0;

            // Bats spiral from central belfry toward the upper-left giant moon and across the sky
            const bx = Math.floor(width * (0.68 - cycle * 0.62));
            const by = Math.floor(horizonY * (b.yBase + Math.sin(cycle * Math.PI * 4 + b.phase) * b.amp));

            // 2-state wing flap synced to time
            const wingUp = ((Math.floor(this.internalT * 13 + i * 3)) & 1) === 0;
            // Against very dark sky far from moon, give bats a 1px dark-slate rim so they stay readable
            const nearBrightMoon = Math.hypot(bx - moonX, by - moonY) < width * 0.14;
            const batCol = nearBrightMoon ? PAL.black : PAL.black;

            // Body
            this.rect(ctx, width, height, bx, by, px, px, batCol);
            // Left & right hooked bat wings
            const wingY = wingUp ? by - px : by + px;
            this.rect(ctx, width, height, bx - px * 2, wingY, px * 2, px, batCol);
            this.rect(ctx, width, height, bx + px, wingY, px * 2, px, batCol);

            // Tiny red vampire eye glint when agitated in climax / high tension!
            if (!nearBrightMoon && (tension > 0.7 || this.batSwarmEnv > 0.5)) {
                this.rect(ctx, width, height, bx, by, px, px, PAL.emberOrange);
            }
        }
    }

    // O(1) Pre-Baked Carpathian Crags & Creeping Graveyard Valley Fog (Zero per-frame trig!)
    drawCarpathianRange(ctx, width, height, horizonY, maxPeakHeight, elevLUT, rimLUT, faceLUT, shadowCol, midCol, rimCol, fogCol, px) {
        const step = Math.max(1, px);
        const invWidth = (RIDGE_LUT_SIZE - 1) / Math.max(1, width - 1);
        const fogH = Math.max(px * 2, Math.floor(maxPeakHeight * 0.22));
        const fogDrift = Math.floor(this.internalT * 8);

        for (let x = 0; x < width; x += step) {
            const idx = Math.min(RIDGE_LUT_SIZE - 1, (x * invWidth) | 0);
            const mHeight = Math.floor(maxPeakHeight * elevLUT[idx]);
            if (mHeight <= 0) continue;

            const topY = horizonY - mHeight;
            const face = faceLUT[idx];

            // Oppressive dark mountain silhouette (Tenebrism)
            const bodyCol = face === 2 ? midCol : shadowCol;
            this.rect(ctx, width, height, x, topY, step, mHeight, bodyCol);

            // Stark, cold moonlight razor-edge on left-facing crags (no cheerful snowcaps!)
            if (face === 2) {
                const rimH = Math.max(px, Math.floor(mHeight * rimLUT[idx]));
                this.rect(ctx, width, height, x, topY, step, rimH, rimCol);
            } else if (face === 1) {
                this.rect(ctx, width, height, x, topY, step, px, midCol);
            }

            // Drifting Ground Fog pooling in the dark Carpathian valleys
            const colStep = ((x / step) | 0) + fogDrift;
            if ((colStep & 1) === 0) {
                const mistStart = Math.max(topY, horizonY - fogH);
                this.rect(ctx, width, height, x, mistStart, step, horizonY - mistStart, fogCol);
            }
        }
    }

    // Caspar David Friedrich Gnarled Dead Gothic Oak with Claw Branches (Zero-GC)
    drawGnarledDeadTree(ctx, width, height, baseX, baseY, treeH, leanDir, windSway, px) {
        const h = Math.max(10, Math.floor(treeH));
        const trunkBaseW = Math.max(px * 2, Math.floor(h * 0.14));

        // Twisted, gnarled trunk leaning ominously inward
        const segments = 7;
        let curX = baseX;
        let curY = baseY;
        const segH = Math.max(1, Math.ceil(h / segments));

        for (let s = 0; s < segments; s++) {
            const ratio = s / segments;
            const w = Math.max(px, Math.floor(trunkBaseW * (1.0 - ratio * 0.68)));
            const crook = Math.round(Math.sin(s * 1.6 + leanDir) * px * 1.5) + leanDir * Math.floor(ratio * px * 2);
            const nextX = baseX + crook + (s >= 5 ? Math.round(windSway * px) : 0);
            const drawY = curY - segH;

            // Pitch-black silhouette + dried-blood bark core + 1px cold moonlit left edge
            this.rect(ctx, width, height, nextX - Math.floor(w / 2), drawY, w, segH + 1, PAL.black);
            if (w >= px * 2) {
                this.rect(ctx, width, height, nextX - Math.floor(w / 2), drawY, px, segH, s < 4 ? PAL.castleShadow : PAL.castleStone);
            }

            // Forked skeletal claw-branches reaching into the night sky
            if (s === 3 || s === 4 || s === 6) {
                const bDir = (s === 4) ? -leanDir : leanDir;
                const bLen = Math.max(3, Math.floor(h * (0.34 - s * 0.03)));
                let bx = nextX;
                let by = drawY + Math.floor(segH * 0.4);
                for (let b = 0; b < 4; b++) {
                    const stepLen = Math.max(px, Math.floor(bLen / 4));
                    bx += bDir * stepLen;
                    by -= Math.max(px, Math.floor(stepLen * (b >= 2 ? 0.9 : 0.45))) + (b === 3 ? Math.round(windSway * px) : 0);
                    this.rect(ctx, width, height, bx, by, stepLen, px, PAL.black);
                    // Upward skeletal twig talon
                    if (b === 2 || b === 3) {
                        this.rect(ctx, width, height, bx + Math.floor(stepLen / 2), by - px * 2, px, px * 2, PAL.black);
                    }
                }
            }

            curX = nextX;
            curY = drawY;
        }
    }

    // Tilted Gothic Tombstone & Crooked Iron/Stone Cross Silhouette (Zero-GC)
    drawTombstones(ctx, width, height, leftBluffX, leftY, rightBluffX, rightY, px) {
        // Left crooked Gothic cross on graveyard hill
        const crossH = px * 8;
        const crossArmW = px * 5;
        this.rect(ctx, width, height, leftBluffX, leftY - crossH, px * 2, crossH, PAL.black);
        this.rect(ctx, width, height, leftBluffX - px * 2, leftY - crossH + px * 2, crossArmW + px, px * 2, PAL.black);
        // Cold 1px moonlight rim on the cross's moonward edge
        this.rect(ctx, width, height, leftBluffX, leftY - crossH, px, crossH - px * 2, PAL.castleStone);
        this.rect(ctx, width, height, leftBluffX - px * 2, leftY - crossH + px * 2, px * 2, px, PAL.castleLight);

        // Adjacent sunken headstone slab
        const slabX = leftBluffX + px * 5;
        this.rect(ctx, width, height, slabX, leftY - px * 4, px * 3, px * 4, PAL.black);
        this.rect(ctx, width, height, slabX, leftY - px * 5, px * 2, px, PAL.castleStone);

        // Right weathered crypt obelisk / headstone
        this.rect(ctx, width, height, rightBluffX, rightY - px * 6, px * 3, px * 6, PAL.black);
        this.rect(ctx, width, height, rightBluffX + px, rightY - px * 7, px, px, PAL.black);
        this.rect(ctx, width, height, rightBluffX, rightY - px * 6, px, px * 5, PAL.castleStone);
    }

    // Narrow Haunted Gothic Lancet Window (Zero-GC)
    drawGothicWindow(ctx, width, height, wx, wy, ww, wh, glowCol, px) {
        const w = Math.max(2, Math.floor(ww));
        const h = Math.max(3, Math.floor(wh));
        const x = Math.floor(wx);
        const y = Math.floor(wy);

        this.rect(ctx, width, height, x - px, y, w + px * 2, h + px, PAL.black);
        if (w >= 3) {
            this.rect(ctx, width, height, x + 1, y - px, Math.max(1, w - 2), px, glowCol);
        }
        this.rect(ctx, width, height, x, y, w, h, glowCol);
        // Dark gothic iron mullion cross-bar inside tall windows
        if (w >= 3 && h >= 5) {
            this.rect(ctx, width, height, x, y + Math.floor(h * 0.42), w, 1, PAL.black);
        }
        this.rect(ctx, width, height, x - px, y + h, w + px * 2, px, PAL.castleStone);
    }

    // Half-Pass of 3D Z-Occluded Orbiting Soul-Flames / Blood-Orbs around the Needle Spire
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
                : (pulse > 0.5 ? PAL.white : PAL.sorceryMagenta);
            this.rect(ctx, width, height, centerX + dx, centerY + dy, px, px * 2, col);
            if (frontPass) {
                // Rising ghostly flame wisp tail
                this.rect(ctx, width, height, centerX + dx, centerY + dy - px, px, px, PAL.moonSilver);
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

        // Exponential decay of gothic light, thunderstorm flash & bat agitation envelopes
        this.beatEnv = Math.max(0, this.beatEnv - dt * 2.5);
        this.hardBeatEnv = Math.max(0, this.hardBeatEnv - dt * 2.0);
        this.lightningEnv = Math.max(0, this.lightningEnv - dt * 4.2);
        this.batSwarmEnv = Math.max(0, this.batSwarmEnv - dt * 0.9);

        // Defensive metrics reading
        const safeMetrics = metrics || {};
        const tension = Number.isFinite(safeMetrics.tensionPct)
            ? Math.max(0, Math.min(1, safeMetrics.tensionPct))
            : (state === 'climax' ? 0.92 : state === 'buildup' ? 0.68 : state === 'afterglow' ? 0.12 : 0.35);

        const rawImpulse0 = (safeMetrics.beatImpulse && Number.isFinite(safeMetrics.beatImpulse[0]))
            ? Math.max(0, Math.min(1, safeMetrics.beatImpulse[0]))
            : (safeMetrics.beat && Number.isFinite(safeMetrics.beat[0]) ? Math.max(0, Math.min(1, safeMetrics.beat[0])) : 0);

        const beatStrength = Number.isFinite(safeMetrics.beatStrength)
            ? Math.max(0, Math.min(1, safeMetrics.beatStrength))
            : (rawImpulse0 > 0 ? rawImpulse0 : (safeMetrics.beatStarted ? 0.5 : 0));

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

        const activePulse = state === 'afterglow'
            ? Math.min(0.20, rawImpulse0 * 0.35)
            : Math.max(rawImpulse0, this.beatEnv);

        const bassEnergy = Number.isFinite(safeMetrics.bass)
            ? Math.max(activePulse, Math.max(0, Math.min(1, safeMetrics.bass)))
            : activePulse;

        // Blood-Moon factor creeps in seamlessly as musical tension approaches climax!
        const bloodFactor = state === 'climax'
            ? 1.0
            : Math.max(0, Math.min(1, (tension - 0.52) / 0.38));

        // =========================================================
        // MASTER DARK GOTHIC & GOLDEN RATIO (PHI) SCENE GEOMETRY
        // =========================================================
        const minDim = Math.min(width, height);
        const px = Math.max(1, Math.floor(minDim / 220));
        const cx = Math.floor(width / 2);
        const horizonY = Math.max(1, Math.floor(height * PHI_MAJOR));

        // Soaring, slender Castlevania / Dracula vertical castle proportions!
        const castleW = Math.max(22, Math.min(Math.floor(width * 0.80), Math.floor(minDim * 0.64)));
        const castleH = Math.max(18, Math.floor(castleW * 0.68));
        const castleBaseY = Math.min(height - 4, horizonY + Math.max(2, Math.floor(height * 0.05)));
        const castleLeft = Math.floor(cx - castleW / 2);

        // West Ruined Bastion Tower
        const lTowW = Math.max(6, Math.floor(castleW * 0.20));
        const lTowH = Math.floor(castleH * 0.74);
        const lTowX = castleLeft;
        const lTowY = castleBaseY - lTowH;
        const lRoofH = Math.max(5, Math.floor(lTowW * 1.65));

        // East Vampire Belfry Spire (Taller, needle-slender asymmetry)
        const rTowW = Math.max(6, Math.floor(castleW * 0.21));
        const rTowH = Math.floor(castleH * 0.90);
        const rTowX = castleLeft + castleW - rTowW;
        const rTowY = castleBaseY - rTowH;
        const rRoofH = Math.max(6, Math.floor(rTowW * 1.85));

        // Central Grand Dracula Keep & Needle Spire
        const keepW = Math.max(8, Math.floor(castleW * 0.30));
        const keepH = castleH;
        const keepX = Math.floor(cx - keepW / 2);
        const keepY = castleBaseY - keepH;
        const spireH = Math.max(8, Math.floor(keepW * 1.90));
        const spireTipY = keepY - spireH - px * 4;

        // --- LAYER 1: OPPRESSIVE GOTHIC NIGHT SKY & BLOOD-ECLIPSE MOON ---
        // Sheet-lightning storm sky flash on hard beats!
        const sheetFlash = this.lightningEnv > 0.68;
        const topSkyCol = sheetFlash ? PAL.deepBlue : PAL.black;
        const midSkyCol = sheetFlash ? PAL.horizonBlue : PAL.midnightViolet;
        const lowSkyCol = sheetFlash ? PAL.castleLight : (bloodFactor > 0.6 ? PAL.sorceryMagenta : PAL.deepBlue);

        this.rect(ctx, width, height, 0, 0, width, height, topSkyCol);

        if (horizonY > 3) {
            const h1 = Math.floor(horizonY * PHI_MINOR);
            const h2 = Math.floor(horizonY * (1.0 - PHI_QUAD));

            this.rect(ctx, width, height, 0, 0, width, h1, topSkyCol);
            if (h2 > h1) {
                this.rect(ctx, width, height, 0, h1, width, h2 - h1, midSkyCol);
            }
            if (horizonY > h2) {
                this.rect(ctx, width, height, 0, h2, width, horizonY - h2, lowSkyCol);
            }

            const ditherSpan = Math.max(px * 2, Math.min(px * 7, Math.floor(horizonY * 0.06)));
            this.drawShifterDitherBand(ctx, width, height, h1, ditherSpan, topSkyCol, midSkyCol, px);
            this.drawShifterDitherBand(ctx, width, height, h2, ditherSpan, midSkyCol, lowSkyCol, px);

            // Eerie Ectoplasm / Blood-Mist Horizon Scar on beats
            if ((bassEnergy > 0.38 || state === 'climax') && horizonY >= px * 3) {
                const scarCol = bloodFactor > 0.5 ? PAL.emberOrange : PAL.mysticCyan;
                this.rect(ctx, width, height, 0, horizonY - px * 2, width, px * 2, scarCol);
            }
        }

        if (minDim >= 8) {
            // 1b. Sparse Cold Stars
            for (let i = 0; i < this.stars.length; i++) {
                const s = this.stars[i];
                const sx = Math.floor(s.x * width);
                const sy = Math.floor(s.y * horizonY);
                if (sx < 0 || sx >= width || sy < 0 || sy >= horizonY) continue;

                const twinkle = Math.sin(this.internalT * 2.8 + s.phase);
                if (twinkle > 0.72) {
                    this.rect(ctx, width, height, sx, sy, px, px, PAL.moonSilver);
                    if (s.mag === 2 && twinkle > 0.92 && minDim >= 48) {
                        this.rect(ctx, width, height, sx, sy, px, px, PAL.white);
                    }
                } else if (twinkle > 0.15) {
                    this.rect(ctx, width, height, sx, sy, px, px, PAL.horizonBlue);
                }
            }

            // 1c. Towering Haunting Full Moon -> Creeping Blood-Moon Eclipse!
            const moonR = Math.max(4, Math.min(Math.floor(px * 18), Math.floor(minDim * 0.088)));
            const moonX = Math.floor(width * (width < height ? 0.24 : 0.25));
            const moonY = Math.max(moonR + px * 2, Math.floor(horizonY * 0.28));

            // Ominous Dithered Nocturnal / Blood Corona
            if (minDim >= 32) {
                const haloR = moonR + px * 3 + (activePulse > 0.4 ? px * 2 : 0);
                const haloCol = bloodFactor > 0.45 ? PAL.sorceryMagenta : PAL.deepBlue;
                for (let hy = -haloR; hy <= haloR; hy += px * 2) {
                    const hdx = Math.round(Math.sqrt(Math.max(0, haloR * haloR - hy * hy)));
                    if (hdx > 0) {
                        this.rect(ctx, width, height, moonX - hdx, moonY + hy, hdx * 2, px, haloCol);
                    }
                }
            }

            // Giant Cratered Moon Disc with Blood-Eclipse Transformation
            const eclipseThresholdY = moonR * (1.0 - bloodFactor * 1.85);
            for (let my = -moonR; my <= moonR; my++) {
                const dx = Math.round(Math.sqrt(Math.max(0, moonR * moonR - my * my)));
                if (dx <= 0) continue;

                const inBloodZone = bloodFactor > 0.05 && my >= eclipseThresholdY;
                const baseDiscCol = inBloodZone ? PAL.emberOrange : PAL.moonSilver;
                const coreDiscCol = inBloodZone ? PAL.sorceryMagenta : PAL.white;
                const craterCol = inBloodZone ? PAL.foregroundDark : PAL.castleLight;

                this.rect(ctx, width, height, moonX - dx, moonY + my, dx * 2, 1, baseDiscCol);
                if (dx > 2) {
                    this.rect(ctx, width, height, moonX - dx + 1, moonY + my, Math.max(1, Math.floor(dx * 1.25)), 1, coreDiscCol);
                }
                // Irregular skull-like lunar Maria craters
                if (dx > 3 && ((my > -moonR * 0.45 && my < -moonR * 0.1) || (my > moonR * 0.15 && my < moonR * 0.55))) {
                    this.rect(ctx, width, height, moonX + Math.floor(dx * 0.18), moonY + my, Math.max(1, Math.floor(dx * 0.55)), 1, craterCol);
                }
            }

            // 1d. Two Razor-Sharp Storm-Wrack Clouds Slicing Directly Across the Moon
            for (let ci = 0; ci < this.clouds.length; ci++) {
                const cloud = this.clouds[ci];
                const cWidth = Math.max(14, Math.floor(width * cloud.spanRatio));
                const cHeight = Math.max(3, Math.floor(minDim * 0.028));
                const cY = Math.floor(horizonY * cloud.yRatio);
                const drift = Math.floor(this.internalT * width * cloud.speed);
                const span = width + cWidth * 2;
                let cX = ((Math.floor(width * (ci === 0 ? 0.12 : 0.62)) + drift + cWidth) % span);
                if (cX < 0) cX += span;
                cX -= cWidth;

                this.drawStormWrackCloud(ctx, width, height, cX, cY, cWidth, cHeight, moonX, moonY, bloodFactor, px);
            }

            // 1e. Swarming Vampire Bats spiraling across Moon & Sky
            if (minDim >= 32) {
                this.drawBatSwarm(ctx, width, height, cx, horizonY, moonX, moonY, tension, px);
            }

            // --- LAYER 2: NECROMANTIC BEAMS, FORKED LIGHTNING & DARK SPELL BURSTS ---
            // 2a. Necromantic Spire Convergence Pillar in High Tension / Buildup / Climax
            if (tension > 0.48 || state === 'climax' || state === 'buildup') {
                const rayW = Math.max(px * 2, Math.floor(minDim * (0.018 + activePulse * 0.014)));
                const rayH = Math.floor(horizonY * (0.40 + tension * 0.38 + activePulse * 0.16));
                const rayX = Math.floor(cx - rayW / 2);
                const rayTop = Math.max(0, horizonY - rayH);
                const outerCol = bloodFactor > 0.5 ? PAL.sorceryMagenta : PAL.midMountain;
                const innerCol = bloodFactor > 0.5 ? PAL.emberOrange : PAL.mysticCyan;

                this.rect(ctx, width, height, rayX - px, rayTop + px * 3, rayW + px * 2, Math.max(1, rayH - px * 3), outerCol);
                this.rect(ctx, width, height, rayX, rayTop, rayW, rayH, innerCol);
                if (activePulse > 0.35 || state === 'climax') {
                    this.rect(ctx, width, height, cx, rayTop + px * 2, px, Math.max(1, rayH - px * 2), PAL.white);
                }
            }

            // 2b. Jagged Forked Thunderstorm Lightning striking the Castle Lightning Rods!
            if (this.lightningEnv > 0.15 && minDim >= 24) {
                const strikeX = this.lightningSlot === 0
                    ? cx
                    : (this.lightningSlot === 1 ? lTowX + Math.floor(lTowW / 2) : rTowX + Math.floor(rTowW / 2));
                const strikeY = this.lightningSlot === 0
                    ? spireTipY
                    : (this.lightningSlot === 1 ? lTowY - lRoofH : rTowY - rRoofH);

                this.drawForkedLightning(ctx, width, height, strikeX, Math.max(px * 4, strikeY), this.lightningEnv, bloodFactor > 0.55, px);
            }

            // 2c. Graded Gothic Sky Manifestations (Soul-Mist, Crimson Scars & Dark Octagrams)
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

                // Jagged Dark Energy Conduit from Tower Finial to Sky Manifestation
                if (progress < 0.22 && minDim >= 24) {
                    const srcX = burst.originSlot === 0
                        ? cx
                        : (burst.originSlot === 1 ? lTowX + Math.floor(lTowW / 2) : rTowX + Math.floor(rTowW / 2));
                    const srcY = burst.originSlot === 0
                        ? spireTipY
                        : (burst.originSlot === 1 ? lTowY - lRoofH : rTowY - rRoofH);

                    const boltSteps = 5;
                    for (let s = 0; s < boltSteps; s++) {
                        const frac = (s + 0.5) / boltSteps;
                        const jag = (s > 0 && s < boltSteps - 1) ? (((s + bi) & 1) ? px * 2 : -px * 2) : 0;
                        const bx = Math.floor(srcX + (burstCX - srcX) * frac) + jag;
                        const by = Math.floor(srcY + (burstCY - srcY) * frac);
                        const segH = Math.max(px, Math.ceil(Math.abs(burstCY - srcY) / boltSteps));
                        this.rect(ctx, width, height, bx, by, px, segH, burst.color);
                    }
                }

                const curRadius = burst.radiusFactor * minDim * 0.23 * Math.sin(progress * Math.PI * 0.5);
                // Weeping willow-like eerie downward drift
                const weepingDrop = progress * progress * 12 * px;

                // Pattern 2: Occult Gothic Cross & Blood-Diamond Sigil
                if (burst.pattern === 2 && progress < 0.78 && minDim >= 24) {
                    const runeR = Math.max(px * 2, Math.floor(curRadius * 0.55));
                    const sigilCol = progress < 0.35 ? PAL.emberOrange : burst.secondaryColor;
                    // Inverted / Elongated Gothic Cross Scar
                    this.rect(ctx, width, height, burstCX - runeR, burstCY - Math.floor(runeR * 0.25), runeR * 2 + px, px, sigilCol);
                    this.rect(ctx, width, height, burstCX, burstCY - runeR, px, Math.floor(runeR * 2.4), sigilCol);

                    const boxR = Math.max(px, Math.floor(runeR * 0.62));
                    this.rect(ctx, width, height, burstCX - boxR, burstCY - boxR, boxR * 2 + px, px, burst.color);
                    this.rect(ctx, width, height, burstCX - boxR, burstCY + boxR, boxR * 2 + px, px, burst.color);
                    this.rect(ctx, width, height, burstCX - boxR, burstCY - boxR, px, boxR * 2 + px, burst.color);
                    this.rect(ctx, width, height, burstCX + boxR, burstCY - boxR, px, boxR * 2 + px, burst.color);
                }

                // Pattern 1: Cursed Crimson Slash Cross
                if (burst.pattern === 1 && progress < 0.48) {
                    const scarR = Math.max(px, Math.floor(minDim * 0.03 * (1.0 - progress / 0.48)));
                    this.rect(ctx, width, height, burstCX - scarR, burstCY, scarR * 2 + px, px, PAL.emberOrange);
                    this.rect(ctx, width, height, burstCX, burstCY - scarR, px, scarR * 2 + px, PAL.white);
                }

                // Drifting Ectoplasm & Ember Soul-Motes
                for (let pi = 0; pi < burst.particleCount; pi++) {
                    const p = burst.particles[pi];
                    const pxPos = Math.floor(burstCX + p.dx * curRadius);
                    const pyPos = Math.floor(burstCY + p.dy * curRadius + weepingDrop);
                    const pSize = p.size * px;

                    if (pxPos >= 0 && pxPos < width && pyPos >= 0 && pyPos < height) {
                        const pColor = (progress > 0.58) ? burst.secondaryColor : burst.color;
                        this.rect(ctx, width, height, pxPos, pyPos, pSize, pSize, pColor);

                        // Weeping ghostly drip trail beneath particles
                        if (burst.beatLevel >= 2 && progress > 0.2 && progress < 0.8) {
                            this.rect(ctx, width, height, pxPos, pyPos - px * 2, px, px, burst.secondaryColor);
                        }
                    }
                }
            }

            // --- LAYER 3: CARPATHIAN RAZOR-CRAGS & VALLEY GRAVEYARD FOG ---
            const farMaxH = Math.floor(horizonY * 0.44);
            this.drawCarpathianRange(
                ctx, width, height, horizonY, farMaxH,
                this.farElevLUT, this.farRimLUT, this.farFaceLUT,
                PAL.black, PAL.farMountain, PAL.castleStone, PAL.midMountain, px
            );

            const midMaxH = Math.floor(horizonY * 0.27);
            this.drawCarpathianRange(
                ctx, width, height, horizonY, midMaxH,
                this.midElevLUT, this.midRimLUT, this.midFaceLUT,
                PAL.black, PAL.castleShadow, PAL.castleLight, PAL.farMountain, px
            );

            // --- LAYER 4: OVERHANGING BASALT CRAG & DRACULA'S GOTHIC RUIN-CITADEL ---
            // 4a. Sheer Black Basalt Cliff with Blood / Ectoplasm Fissures on Hard Beats
            const cliffH = Math.max(4, Math.floor((height - castleBaseY) * 0.50));
            const cliffTopW = Math.floor(castleW * 0.90);
            const showFissures = (this.hardBeatEnv > 0.25 || state === 'climax' || (tension > 0.70 && bassEnergy > 0.45));

            for (let cy = 0; cy < cliffH; cy++) {
                const ratio = cy / Math.max(1, cliffH);
                // Overhanging crag profile (undercut cavern shadow below castle!)
                const overhang = Math.sin(ratio * Math.PI) * 0.12;
                const rowW = Math.floor(cliffTopW * (1.0 - ratio * 0.30 + overhang));
                const rowX = Math.floor(cx - rowW / 2);
                const drawY = castleBaseY + cy;

                this.rect(ctx, width, height, rowX, drawY, rowW, 1, PAL.black);
                const litW = Math.max(px * 2, Math.floor(rowW * (0.26 - ratio * 0.14)));
                this.rect(ctx, width, height, rowX, drawY, litW, 1, (cy & 1) ? PAL.castleShadow : PAL.castleStone);
                this.rect(ctx, width, height, rowX, drawY, px, 1, PAL.castleLight);

                if (showFissures && (cy % (px * 2) === 0)) {
                    const veinOffset = Math.round(Math.sin(ratio * 7.0 + this.internalT * 3.5) * px * 2);
                    const veinCol = bloodFactor > 0.45 ? PAL.emberOrange : PAL.mysticCyan;
                    this.rect(ctx, width, height, cx + veinOffset, drawY, px, px, veinCol);
                }
            }

            // 4b. Weathered Gothic Curtain Wall with Broken/Ruined Merlons
            const wallW = Math.floor(castleW * 0.66);
            const wallH = Math.floor(castleH * 0.44);
            const wallX = Math.floor(cx - wallW / 2);
            const wallY = castleBaseY - wallH;

            this.rect(ctx, width, height, wallX - px, wallY, wallW + px * 2, wallH, PAL.black);
            this.rect(ctx, width, height, wallX, wallY, Math.floor(wallW * 0.46), wallH, PAL.castleShadow);
            this.rect(ctx, width, height, wallX, wallY, px * 2, wallH, PAL.castleStone);

            // Irregular, partially crumbled battlements (skip m === 4 for authentic ruin decay!)
            const numMerlons = Math.max(3, Math.floor(wallW / (px * 5)));
            const merlonStep = wallW / numMerlons;
            for (let m = 0; m < numMerlons; m++) {
                if ((m & 1) === 0 && m !== 4) {
                    const mx = wallX + Math.floor(m * merlonStep);
                    const mw = Math.max(px * 2, Math.floor(merlonStep * 0.70));
                    const mh = (m === 2) ? px * 2 : px * 3; // Chipped merlon
                    this.rect(ctx, width, height, mx, wallY - mh, mw, mh, m < numMerlons / 2 ? PAL.castleShadow : PAL.black);
                    this.rect(ctx, width, height, mx, wallY - mh, px, mh, PAL.castleLight);
                }
            }

            // 4c. West Ruined Watchtower with Gargoyle & Iron Cross Finial
            this.rect(ctx, width, height, lTowX, lTowY, lTowW, lTowH, PAL.black);
            this.rect(ctx, width, height, lTowX, lTowY, Math.floor(lTowW * 0.48), lTowH, PAL.castleShadow);
            this.rect(ctx, width, height, lTowX, lTowY, Math.max(px, Math.floor(lTowW * 0.18)), lTowH, PAL.castleLight);

            // Jutting Stone Gargoyle Silhouette on the West Eaves!
            if (minDim >= 36) {
                this.rect(ctx, width, height, lTowX - px * 3, lTowY + px, px * 3, px, PAL.castleStone);
                this.rect(ctx, width, height, lTowX - px * 4, lTowY, px * 2, px, PAL.castleLight);
            }

            for (let ry = 0; ry < lRoofH; ry++) {
                const rw = Math.max(1, Math.floor((lTowW + px * 2) * Math.pow(1.0 - ry / lRoofH, 1.15)));
                const rx = lTowX - px + Math.floor((lTowW + px * 2 - rw) / 2);
                this.rect(ctx, width, height, rx, lTowY - ry, rw, 1, PAL.black);
                this.rect(ctx, width, height, rx, lTowY - ry, Math.max(1, Math.floor(rw * 0.28)), 1, PAL.castleLight);
            }
            // Crooked Iron Cross atop West Spire
            const lCrossX = lTowX + Math.floor(lTowW / 2);
            this.rect(ctx, width, height, lCrossX, lTowY - lRoofH - px * 4, px, px * 4, PAL.castleLight);
            this.rect(ctx, width, height, lCrossX - px, lTowY - lRoofH - px * 3, px * 3, px, PAL.castleLight);

            // 4d. East Vampire Belfry Spire with Gargoyle & Iron Finial
            this.rect(ctx, width, height, rTowX, rTowY, rTowW, rTowH, PAL.black);
            this.rect(ctx, width, height, rTowX, rTowY, Math.floor(rTowW * 0.38), rTowH, PAL.castleShadow);
            this.rect(ctx, width, height, rTowX, rTowY, px, rTowH, PAL.castleStone);

            // Jutting East Gargoyle Silhouette against the storm sky!
            if (minDim >= 36) {
                this.rect(ctx, width, height, rTowX + rTowW, rTowY + px, px * 3, px, PAL.black);
                this.rect(ctx, width, height, rTowX + rTowW + px * 2, rTowY, px * 2, px, PAL.black);
            }

            for (let ry = 0; ry < rRoofH; ry++) {
                const rw = Math.max(1, Math.floor((rTowW + px * 2) * Math.pow(1.0 - ry / rRoofH, 1.18)));
                const rx = rTowX - px + Math.floor((rTowW + px * 2 - rw) / 2);
                this.rect(ctx, width, height, rx, rTowY - ry, rw, 1, PAL.black);
                this.rect(ctx, width, height, rx, rTowY - ry, Math.max(1, Math.floor(rw * 0.25)), 1, PAL.castleStone);
            }
            const rCrossX = rTowX + Math.floor(rTowW / 2);
            this.rect(ctx, width, height, rCrossX, rTowY - rRoofH - px * 4, px, px * 4, PAL.castleStone);
            this.rect(ctx, width, height, rCrossX - px, rTowY - rRoofH - px * 3, px * 3, px, PAL.castleStone);

            // 4e. Central Dracula Keep, Skeletal Flying Buttresses & Needle Spire
            if (keepW >= 10) {
                const buttW = Math.max(px * 2, Math.floor(keepW * 0.20));
                const buttH = Math.floor(keepH * 0.62);
                // Arched gothic flying buttresses with open sky/void cutouts!
                this.rect(ctx, width, height, keepX - buttW - px, castleBaseY - buttH, buttW + px, px * 2, PAL.castleStone);
                this.rect(ctx, width, height, keepX - buttW - px, castleBaseY - buttH, px * 2, buttH, PAL.castleShadow);
                this.rect(ctx, width, height, keepX + keepW, castleBaseY - buttH, buttW + px, px * 2, PAL.black);
                this.rect(ctx, width, height, keepX + keepW + buttW - px, castleBaseY - buttH, px * 2, buttH, PAL.black);
            }

            this.rect(ctx, width, height, keepX, keepY, keepW, keepH, PAL.black);
            this.rect(ctx, width, height, keepX, keepY, Math.floor(keepW * 0.45), keepH, PAL.castleShadow);
            this.rect(ctx, width, height, keepX, keepY, Math.max(px, Math.floor(keepW * 0.18)), keepH, PAL.castleLight);
            this.rect(ctx, width, height, keepX - px, keepY, keepW + px * 2, px * 2, PAL.castleStone);

            // Back-Pass of 3D Soul-Flames Ring (behind Needle Spire)
            const showSoulOrbit = (tension > 0.45 || state === 'buildup' || state === 'climax') && minDim >= 36;
            const ringRX = Math.max(px * 4, Math.floor(keepW * 0.70));
            const ringRY = Math.max(px * 2, Math.floor(ringRX * 0.28));
            const ringCenterY = keepY - Math.floor(spireH * 0.68);
            if (showSoulOrbit) {
                this.drawSpireSoulOrbit(ctx, width, height, cx, ringCenterY, ringRX, ringRY, tension, activePulse, false, px);
            }

            // Concave Gothic Needle Spire Cone
            for (let sy = 0; sy < spireH; sy++) {
                const sw = Math.max(1, Math.floor((keepW + px * 2) * Math.pow(1.0 - sy / spireH, 1.25)));
                const sx = keepX - px + Math.floor((keepW + px * 2 - sw) / 2);
                this.rect(ctx, width, height, sx, keepY - sy, sw, 1, PAL.black);
                this.rect(ctx, width, height, sx, keepY - sy, Math.max(1, Math.floor(sw * 0.30)), 1, PAL.castleLight);
            }

            // Iron Gothic Lightning Rod Cross & Pulsing Necromantic Focus
            this.rect(ctx, width, height, cx, spireTipY, px, px * 4, this.lightningEnv > 0.3 ? PAL.white : PAL.moonSilver);
            this.rect(ctx, width, height, cx - px * 2, spireTipY + px, px * 5, px, PAL.castleLight);
            if (activePulse > 0.4 || state === 'climax') {
                this.rect(ctx, width, height, cx - px, spireTipY - px, px * 3, px * 2, bloodFactor > 0.5 ? PAL.emberOrange : PAL.mysticCyan);
            }

            // Front-Pass of 3D Soul-Flames Ring (in front of Needle Spire)
            if (showSoulOrbit) {
                this.drawSpireSoulOrbit(ctx, width, height, cx, ringCenterY, ringRX, ringRY, tension, activePulse, true, px);
            }

            // 4f. Eerie Haunted Windows (Lone flickering tallow candle + Cursed Crimson Rose Window!)
            const candleFlicker = Math.sin(this.internalT * 17.0) * 0.5 + Math.cos(this.internalT * 7.3) * 0.5;
            const loneCandleCol = (activePulse > 0.55 || bloodFactor > 0.75)
                ? PAL.emberOrange
                : (candleFlicker > -0.55 ? PAL.magicGold : PAL.sorceryMagenta);

            // Central Keep Cursed Rose Window + Tall Narrow Lancet below
            const kWinW = Math.max(2, Math.floor(keepW * 0.28));
            const kWinH = Math.max(4, Math.floor(keepH * 0.24));
            const kWinY = keepY + Math.floor(keepH * 0.24);
            this.drawGothicWindow(ctx, width, height, cx - Math.floor(kWinW / 2), kWinY, kWinW, kWinH, PAL.emberOrange, px);
            if (activePulse > 0.45 && kWinW >= 3) {
                this.rect(ctx, width, height, cx, kWinY + px, px, Math.max(1, kWinH - px * 2), PAL.magicGold);
            }

            // East Vampire Spire Lone Tallow Candle Chamber (West Ruin stays dark unless a hard beat strikes!)
            const rWinW = Math.max(2, Math.floor(rTowW * 0.28));
            const rWinH = Math.max(3, Math.floor(rTowH * 0.18));
            this.drawGothicWindow(
                ctx, width, height,
                rTowX + Math.floor(rTowW * 0.34), rTowY + Math.floor(rTowH * 0.24),
                rWinW, rWinH, loneCandleCol, px
            );

            // West Ruin Phantom Window: dark & abandoned in calm passages, flashes ghostly green on beats/tension!
            const lWinW = Math.max(2, Math.floor(lTowW * 0.25));
            const lWinH = Math.max(3, Math.floor(lTowH * 0.18));
            const phantomCol = (activePulse > 0.42 || tension > 0.65) ? PAL.mysticCyan : PAL.deepBlue;
            this.drawGothicWindow(
                ctx, width, height,
                lTowX + Math.floor(lTowW * 0.36), lTowY + Math.floor(lTowH * 0.32),
                lWinW, lWinH, phantomCol, px
            );

            // 4g. Fanged Iron Portcullis Maw & Crypt Gate
            const gateW = Math.max(4, Math.floor(wallW * 0.22));
            const gateH = Math.max(4, Math.floor(wallH * 0.52));
            const gateX = Math.floor(cx - gateW / 2);
            const gateY = castleBaseY - gateH;

            this.rect(ctx, width, height, gateX - px, gateY - px, gateW + px * 2, gateH + px, PAL.castleShadow);
            this.rect(ctx, width, height, gateX, gateY, gateW, gateH, PAL.black);
            // Jagged iron portcullis teeth hanging from the top of the archway
            if (gateW >= 6) {
                for (let gx = gateX + px; gx < gateX + gateW - px; gx += px * 2) {
                    this.rect(ctx, width, height, gx, gateY, px, Math.floor(gateH * 0.45), PAL.castleStone);
                }
            }
            // Faint blood-red brazier embers beside the gate
            const brazierCol = activePulse > 0.4 ? PAL.magicGold : PAL.emberOrange;
            this.rect(ctx, width, height, gateX - px * 2, gateY + Math.floor(gateH * 0.35), px, px, brazierCol);
            this.rect(ctx, width, height, gateX + gateW + px, gateY + Math.floor(gateH * 0.35), px, px, brazierCol);

            // --- LAYER 5: STAGNANT BLACK MIRE, GRAVEYARD FOG, RUINED BRIDGE & DEAD OAKS ---
            if (castleBaseY < height) {
                const fgHeight = height - castleBaseY;
                const mireTopY = castleBaseY + Math.max(2, Math.floor(fgHeight * 0.22));
                const mireBottomY = castleBaseY + Math.max(4, Math.floor(fgHeight * 0.65));

                // 5a. Dark Dried-Blood / Dead Earth Foreground Base
                this.rect(ctx, width, height, 0, castleBaseY, width, fgHeight, PAL.black);
                this.rect(ctx, width, height, 0, mireBottomY, width, height - mireBottomY, PAL.foregroundDark);

                // 5b. Stagnant Black Mire & Creeping Graveyard Mist Ribbons
                if (mireBottomY > mireTopY && minDim >= 24) {
                    this.rect(ctx, width, height, 0, mireTopY, width, mireBottomY - mireTopY, PAL.black);

                    // Ghostly vertical reflections of the Giant Moon & Cursed Rose Window in the dead water
                    for (let ly = mireTopY + px; ly < mireBottomY; ly += px * 2) {
                        const depthRatio = (ly - mireTopY) / Math.max(1, mireBottomY - mireTopY);
                        const ripple = Math.round(Math.sin(ly * 0.7 + this.internalT * 2.4) * px * 2);

                        const mRefW = Math.max(px * 3, Math.floor(moonR * (1.2 - depthRatio * 0.5)));
                        const mRefCol = bloodFactor > 0.5 ? PAL.emberOrange : PAL.castleLight;
                        this.rect(ctx, width, height, moonX - Math.floor(mRefW / 2) + ripple, ly, mRefW, px, mRefCol);

                        // Crimson rose-window reflection bleeding into the black moat
                        const cRefW = Math.max(px * 2, Math.floor(kWinW * (1.2 + activePulse * 0.8)));
                        this.rect(ctx, width, height, cx - Math.floor(cRefW / 2) - ripple, ly, cRefW, px, PAL.emberOrange);
                    }

                    // Wabernde Friedhofs-Nebelschwaden (Creeping Ground Mist Ribbons over the Mire)
                    const mistBands = 3;
                    for (let mb = 0; mb < mistBands; mb++) {
                        const my = mireTopY + Math.floor(((mb + 0.5) / mistBands) * (mireBottomY - mireTopY));
                        const mLen = Math.floor(width * (0.36 + (mb & 1) * 0.14));
                        const mSpeed = (mb & 1) ? -0.022 : 0.018;
                        let mx = ((Math.floor(width * (0.15 + mb * 0.28) + this.internalT * width * mSpeed)) % (width + mLen));
                        if (mx < 0) mx += width + mLen;
                        mx -= Math.floor(mLen * 0.5);

                        const mistCol = (tension > 0.65 && mb === 1) ? PAL.mysticCyan : PAL.midMountain;
                        this.rect(ctx, width, height, mx, my, mLen, px, PAL.farMountain);
                        this.rect(ctx, width, height, mx + Math.floor(mLen * 0.2), my, Math.floor(mLen * 0.6), px, mistCol);
                    }
                }

                // 5c. Ruined S-Curve Crypt Causeway & Floating Corpse-Candles (Will-o'-the-Wisps)
                const pathStartW = Math.max(3, Math.floor(gateW * 0.90));
                const pathEndW = Math.max(6, Math.floor(minDim * 0.22));
                const pathStartY = castleBaseY;
                const pathEndY = height;

                if (pathEndY > pathStartY) {
                    const bridgeSpanH = Math.max(1, mireBottomY - mireTopY);

                    for (let py = pathStartY; py < pathEndY; py++) {
                        const normY = (py - pathStartY) / Math.max(1, pathEndY - pathStartY);
                        const curW = Math.floor(pathStartW + (pathEndW - pathStartW) * (normY * normY * 0.65 + normY * 0.35));
                        const curveX = cx + Math.floor(Math.sin(normY * Math.PI * 1.08) * (width * 0.14));
                        const pathX = Math.floor(curveX - curW / 2);

                        // Sunken crypt viaduct piers in the black mire
                        if (py >= mireTopY && py < mireBottomY && minDim >= 28) {
                            const bridgeProg = (py - mireTopY) / bridgeSpanH;
                            this.rect(ctx, width, height, pathX - px * 2, py, curW + px * 3, 1, PAL.black);
                            if (bridgeProg < 0.32 || bridgeProg > 0.72) {
                                this.rect(ctx, width, height, pathX - px * 2, py, px * 2, 1, PAL.castleShadow);
                            }
                        }

                        // Cracked, weathered dark cobblestones (missing eroded edges!)
                        const erode = ((py * 7) % 5 === 0) ? px : 0;
                        const stoneCol = (((py / px) | 0) & 1) ? PAL.castleShadow : PAL.black;
                        this.rect(ctx, width, height, pathX + erode, py, Math.max(1, curW - erode * 2), 1, stoneCol);
                        this.rect(ctx, width, height, pathX + erode, py, px, 1, PAL.castleStone);
                    }

                    // Hovering Spectral Corpse-Candles (Irrlichter) drifting along the Causeway!
                    if (minDim >= 28) {
                        const numWisps = 3;
                        for (let w = 0; w < numWisps; w++) {
                            const wNorm = 1.0 - (((this.internalT * 0.14 + w / numWisps) % 1.0));
                            const wy = pathStartY + Math.floor(wNorm * (pathEndY - pathStartY));
                            const wCurveX = cx + Math.floor(Math.sin(wNorm * Math.PI * 1.08) * (width * 0.14));
                            const hoverBob = Math.round(Math.sin(this.internalT * 4.5 + w * 2.1) * px * 2);
                            const wx = wCurveX + ((w & 1) ? -px * 4 : px * 4);
                            const floatY = wy - px * 3 + hoverBob;

                            this.rect(ctx, width, height, wx - px, floatY, px * 3, px * 2, PAL.mysticCyan);
                            if (activePulse > 0.35 || state === 'climax') {
                                this.rect(ctx, width, height, wx, floatY, px, px, PAL.white);
                            }
                        }
                    }
                }

                // 5d. Graveyard Framing Bluffs (*Repoussoir*), Tombstones & Gnarled Dead Oaks
                const hillH = Math.max(4, Math.floor(fgHeight + 12));
                for (let y = 0; y < hillH; y++) {
                    const drawY = height - 1 - y;
                    const progress = y / hillH;
                    const hwL = Math.floor(width * 0.31 * (1.0 - progress * 0.84));
                    if (hwL > 0) {
                        this.rect(ctx, width, height, 0, drawY, hwL, 1, PAL.black);
                        this.rect(ctx, width, height, hwL - px, drawY, px, 1, PAL.castleShadow);
                    }

                    const hwR = Math.floor(width * 0.27 * (1.0 - progress * 0.88));
                    if (hwR > 0) {
                        this.rect(ctx, width, height, width - hwR, drawY, hwR, 1, PAL.black);
                        this.rect(ctx, width, height, width - hwR, drawY, px, 1, PAL.castleStone);
                    }
                }

                const leftGraveY = Math.min(height - 1, castleBaseY + Math.floor(minDim * 0.15));
                const rightGraveY = Math.min(height - 1, castleBaseY + Math.floor(minDim * 0.17));

                // Tilted Gothic Cross & Weathered Tombstones
                if (minDim >= 36) {
                    this.drawTombstones(
                        ctx, width, height,
                        Math.floor(width * 0.17), leftGraveY - px * 2,
                        Math.floor(width * 0.82), rightGraveY - px * 2,
                        px
                    );
                }

                // Claw-Branched Gnarled Dead Gothic Oaks framing Left & Right!
                const creakSway = Math.sin(this.internalT * 1.3) * (0.6 + tension * 0.7);
                this.drawGnarledDeadTree(ctx, width, height, Math.floor(width * 0.08), leftGraveY + px * 2, Math.floor(minDim * 0.27), 1, creakSway, px);
                this.drawGnarledDeadTree(ctx, width, height, Math.floor(width * 0.92), rightGraveY + px * 2, Math.floor(minDim * 0.29), -1, -creakSway, px);
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