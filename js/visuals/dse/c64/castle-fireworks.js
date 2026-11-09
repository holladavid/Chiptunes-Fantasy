// === js/visuals/dse/c64/castle-fireworks.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: C64 CASTLE FIREWORKS (Background DSE)
// Castlevania-style gothic castle standing flush on the horizon
// (floorHorizon = 0.55). Asymmetric mountains and hills rise
// above the horizon, with dark gothic Dracula-style silhouetted
// trees framing the scene. No hard horizon line drawn.
// Authentic C64 raster-bar night sky with crescent moon,
// drifting clouds, twinkling stars, vampire bats, and lightning.
// Musical beat-strength & tension synchronized fireworks and
// gothic animations. Foreground features misty meadows, plowed
// fields and a torch-lit winding path to the castle portcullis.
// Strict C64 VIC-II 16-color palette, 100% zero-GC render loop.
// =========================================================

import { C64_PALETTE, rgbToHex, applyOrderedDitherFade } from '../../utils/hardware-constraints.js';

const COLORS = {
    black: rgbToHex(...C64_PALETTE[0]),
    white: rgbToHex(...C64_PALETTE[1]),
    red: rgbToHex(...C64_PALETTE[2]),
    cyan: rgbToHex(...C64_PALETTE[3]),
    purple: rgbToHex(...C64_PALETTE[4]),
    green: rgbToHex(...C64_PALETTE[5]),
    darkBlue: rgbToHex(...C64_PALETTE[6]),
    yellow: rgbToHex(...C64_PALETTE[7]),
    orange: rgbToHex(...C64_PALETTE[8]),
    brown: rgbToHex(...C64_PALETTE[9]),
    lightRed: rgbToHex(...C64_PALETTE[10]),
    darkGrey: rgbToHex(...C64_PALETTE[11]),
    grey: rgbToHex(...C64_PALETTE[12]),
    lightGreen: rgbToHex(...C64_PALETTE[13]),
    lightBlue: rgbToHex(...C64_PALETTE[14]),
    lightGrey: rgbToHex(...C64_PALETTE[15])
};

const STAR_POSITIONS = [
    [0.04, 0.10], [0.11, 0.28], [0.19, 0.07], [0.26, 0.20],
    [0.33, 0.09], [0.42, 0.26], [0.51, 0.07], [0.60, 0.18],
    [0.69, 0.09], [0.77, 0.25], [0.87, 0.11], [0.95, 0.28],
    [0.07, 0.42], [0.23, 0.38], [0.38, 0.36], [0.66, 0.40],
    [0.82, 0.37], [0.92, 0.44], [0.15, 0.48], [0.75, 0.49]
];

const BURST_COLORS = [
    COLORS.yellow, COLORS.cyan, COLORS.lightRed, COLORS.lightGreen,
    COLORS.orange, COLORS.lightBlue, COLORS.purple, COLORS.white
];

const SECONDARY_COLORS = [
    COLORS.orange, COLORS.lightBlue, COLORS.red, COLORS.green,
    COLORS.red, COLORS.cyan, COLORS.lightRed, COLORS.yellow
];

// 16 radial unit directions (percentage steps -100..100)
const DIRECTIONS = [
    [100, 0], [92, 38], [71, 71], [38, 92],
    [0, 100], [-38, 92], [-71, 71], [-92, 38],
    [-100, 0], [-92, -38], [-71, -71], [-38, -92],
    [0, -100], [38, -92], [71, -71], [92, -38]
];

// Torch post normalized depths along the winding foreground path
const PATH_TORCH_DEPTHS = [0.18, 0.38, 0.62, 0.85];

const MAX_BURSTS = 10;
const MAX_BATS = 8; // Matches 8 C64 VIC-II hardware sprites

function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
}

export class C64CastleFireworks {
    constructor() {
        this.name = 'C64 Castle Fireworks';
        this.computerType = ['c64'];
        this.placementType = 'background';
        this.floorHorizon = 0.55; // Horizont exakt auf Floor-DSE-Ebene (55%)
        this.floorY = 0;
        this.lastT = 0;
        this.lastBeatCount = -1;
        this.cloudOffset = 0;
        this.mistOffset = 0;
        this.windPhase = 0;
        this.torchPhase = 0;
        this.burstCursor = 0;
        this.batCursor = 0;
        this.width = 0;
        this.height = 0;
        this.pixelSize = 1;

        // Reactive audio & tension state
        this.tension = 0.25;
        this.beatPulse = 0;
        this.heavyPulse = 0;
        this.lastBeatStrength = 0.5;
        this.activeRimColor = null;
        this.lightningTimer = 0;
        this.lightningX = 0.5;

        // Pre-allocated firework burst pool (Zero-GC)
        this.bursts = Array.from({ length: MAX_BURSTS }, () => ({
            x: 0,
            y: 0,
            launchY: 0,
            startTime: -Infinity,
            color: COLORS.yellow,
            secondaryColor: COLORS.orange,
            strength: 0,
            tier: 0, // 0 = light star, 1 = double-ring, 2 = willow finale
            duration: 0,
            maxRadius: 0,
            particleCount: 0
        }));

        // Pre-allocated C64 hardware sprite bat pool (Zero-GC)
        this.bats = Array.from({ length: MAX_BATS }, () => ({
            active: false,
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            flapPhase: 0,
            waveAmp: 0
        }));
    }

    resize() {}

    snap(value) {
        return Math.floor(value / this.pixelSize + 0.5) * this.pixelSize;
    }

    rect(ctx, x, y, width, height, color) {
        const px = this.snap(x);
        const py = this.snap(y);
        const right = this.snap(x + width);
        const bottom = this.snap(y + height);
        const clippedX = Math.max(0, px);
        const clippedY = Math.max(0, py);
        const clippedRight = Math.min(this.width, Math.max(right, px + this.pixelSize));
        const clippedBottom = Math.min(this.height, Math.max(bottom, py + this.pixelSize));
        const pw = clippedRight - clippedX;
        const ph = clippedBottom - clippedY;
        if (pw <= 0 || ph <= 0) return;
        ctx.fillStyle = color;
        ctx.fillRect(clippedX, clippedY, pw, ph);
    }

    // Zero-GC helper for castle proportional rectangles
    castleRect(ctx, left, top, cw, ch, x1, y1, w, h, color) {
        this.rect(ctx, left + cw * x1, top + ch * y1, cw * w, ch * h, color);
    }

    // Authentic C64 VIC-II scanline raster transition split
    drawRasterTransition(ctx, width, splitY, colorTop, colorBottom) {
        const u = this.pixelSize;
        const sy = this.snap(splitY);
        this.rect(ctx, 0, sy - u * 3, width, u, colorBottom);
        this.rect(ctx, 0, sy - u * 2, width, u, colorTop);
        this.rect(ctx, 0, sy - u, width, u, colorBottom);
        this.rect(ctx, 0, sy, width, u, colorTop);
        this.rect(ctx, 0, sy + u, width, u, colorBottom);
        this.rect(ctx, 0, sy + u * 2, width, u, colorTop);
    }

    updateAudioState(dt, t, state, metrics) {
        // Extract target tension (0..1) from metrics or state
        const rawTension = Number.isFinite(metrics?.tension)
            ? metrics.tension
            : (Number.isFinite(metrics?.energy)
                ? metrics.energy
                : (state === 'climax' ? 0.88 : state === 'afterglow' ? 0.20 : 0.40));
        const targetTension = clamp(rawTension, 0, 1);
        this.tension += (targetTension - this.tension) * clamp(dt * 3.5, 0, 1);

        // Exponential decay of beat pulses
        this.beatPulse = Math.max(0, this.beatPulse - dt * 2.8);
        this.heavyPulse = Math.max(0, this.heavyPulse - dt * 3.2);
        this.lightningTimer = Math.max(0, this.lightningTimer - dt);

        // Advance continuous atmospheric phases synced to tension & beat
        this.windPhase = (this.windPhase + dt * (1.4 + this.tension * 3.2)) % 628.318;
        this.torchPhase = (this.torchPhase + dt * (9.0 + this.tension * 7.0 + this.beatPulse * 8.0)) % 628.318;
        this.cloudOffset = (this.cloudOffset + dt * Math.min(this.width, this.height) * (0.022 + this.tension * 0.025)) % Math.max(1, this.width);
        this.mistOffset = (this.mistOffset + dt * Math.min(this.width, this.height) * (0.015 + this.tension * 0.018)) % Math.max(1, this.width);

        // Check beat triggers
        const event = metrics?.beatStarted === true;
        if (event) {
            const beatCount = Number.isFinite(metrics.beatCount)
                ? Math.max(0, Math.floor(metrics.beatCount))
                : this.lastBeatCount + 1;

            if (beatCount !== this.lastBeatCount) {
                this.lastBeatCount = beatCount;
                const rawStrength = Number.isFinite(metrics.beatStrength)
                    ? metrics.beatStrength
                    : metrics.beatImpulse?.[0] ?? metrics.beat?.[0] ?? 0.5;
                const strength = clamp(Number.isFinite(rawStrength) ? rawStrength : 0.5, 0, 1);

                this.lastBeatStrength = strength;
                this.beatPulse = Math.max(this.beatPulse, strength);

                if (strength >= 0.70 || (state === 'climax' && strength >= 0.50)) {
                    this.heavyPulse = 1.0;
                }

                // Trigger Gothic Lightning on heavy beats under high tension
                if ((strength >= 0.76 && this.tension >= 0.52) || (state === 'climax' && beatCount % 4 === 0 && strength >= 0.60)) {
                    this.lightningTimer = 0.26;
                    const boltLane = (beatCount * 3 + 1) % 4;
                    this.lightningX = boltLane < 2
                        ? this.width * (0.18 + boltLane * 0.12)
                        : this.width * (0.70 + (boltLane - 2) * 0.12);
                }

                // Spawn C64 vampire bats from the castle belfry on beats
                const batCountToSpawn = strength >= 0.72 ? 2 : (strength >= 0.35 || this.tension >= 0.55 ? 1 : 0);
                for (let s = 0; s < batCountToSpawn; s++) {
                    this.spawnBat(beatCount + s, strength);
                }

                // Firework cadence adapts to state, tension & beat strength
                const cadence = (state === 'climax' || this.tension >= 0.68 || strength >= 0.75)
                    ? 1
                    : (state === 'afterglow' ? 4 : 2);

                if (beatCount % cadence === 0 && strength >= 0.15) {
                    this.addBurst(this.width, this.height, t, beatCount, strength, 0);

                    // Grand Finale Twin Salvo on very strong beats or climax accents
                    if ((strength >= 0.78 && this.tension >= 0.45) || (state === 'climax' && strength >= 0.62 && beatCount % 2 === 0)) {
                        this.addBurst(this.width, this.height, t, beatCount + 4, strength * 0.92, 1);
                    }
                }
            }
        }
    }

    drawSky(ctx, width, height, t) {
        // Full viewport black baseline
        ctx.fillStyle = COLORS.black;
        ctx.fillRect(0, 0, width, height);

        const horizon = this.floorY;
        if (horizon <= 0 || width < 4 || height < 4) {
            return;
        }

        const u = this.pixelSize;

        // Tension dynamically shifts the raster sky bands
        const topBlackEnd = Math.floor(horizon * (0.14 - this.tension * 0.05));
        const band1 = Math.floor(horizon * (0.36 - this.tension * 0.06));
        const band2 = Math.floor(horizon * (0.70 - this.tension * 0.08));
        const crimsonHeight = this.tension > 0.38
            ? Math.floor(horizon * (this.tension - 0.38) * 0.34)
            : 0;
        const band3 = Math.min(horizon, Math.max(band2 + u * 4, horizon - crimsonHeight));

        // 1. Upper Deep Night Band
        if (band1 > topBlackEnd) {
            this.rect(ctx, 0, topBlackEnd, width, band1 - topBlackEnd, COLORS.darkBlue);
            if (topBlackEnd > u * 3) {
                this.drawRasterTransition(ctx, width, topBlackEnd, COLORS.black, COLORS.darkBlue);
            }
        }

        // 2. Mid Gothic Purple Band
        if (band2 > band1) {
            this.rect(ctx, 0, band1, width, band2 - band1, COLORS.purple);
            this.drawRasterTransition(ctx, width, band1, COLORS.darkBlue, COLORS.purple);
        }

        // 3. Lower Horizon Twilight Band (no hard horizon line!)
        if (band3 > band2) {
            this.rect(ctx, 0, band2, width, band3 - band2, COLORS.darkBlue);
            this.drawRasterTransition(ctx, width, band2, COLORS.purple, COLORS.darkBlue);
        }

        // 4. High-Tension Crimson Undertow (Dracula Blood-Sky Raster near Horizon)
        if (horizon > band3) {
            const glowColor = this.tension > 0.72 && this.heavyPulse > 0.3 ? COLORS.red : COLORS.brown;
            this.rect(ctx, 0, band3, width, horizon - band3, glowColor);
            this.drawRasterTransition(ctx, width, band3, COLORS.darkBlue, glowColor);
        }

        // 5. C64 Raster Lightning Flash & Forked Bolt on Heavy Beat + Tension
        if (this.lightningTimer > 0) {
            const flashPhase = Math.floor(this.lightningTimer * 35) & 1;
            if (flashPhase === 0) {
                // VIC-II raster interrupt flash bars in upper sky
                this.rect(ctx, 0, u * 2, width, u * 2, COLORS.lightBlue);
                this.rect(ctx, 0, band1 - u, width, u, COLORS.white);
            }
            this.drawLightningBolt(ctx, this.lightningX, horizon);
        }

        // 6. Twinkling Night Stars (react to beatPulse)
        const twinkle = Math.floor(t * (3 + this.tension * 3));
        const starBoost = this.beatPulse > 0.55;
        for (let i = 0; i < STAR_POSITIONS.length; i++) {
            const nx = STAR_POSITIONS[i][0];
            const ny = STAR_POSITIONS[i][1];
            const x = this.snap(nx * width);
            const y = this.snap(ny * horizon);
            if (y >= horizon - u * 3) continue;

            const isSparkle = (i + twinkle) % 6 === 0 || (starBoost && i % 3 === 0);
            const color = isSparkle
                ? COLORS.white
                : (i % 3 === 0 ? COLORS.lightBlue : COLORS.lightGrey);
            this.rect(ctx, x, y, u, u, color);

            // Cross-sparkle on bright stars during beats
            if (isSparkle && (i % 4 === 0 || starBoost)) {
                this.rect(ctx, x - u, y, u, u, COLORS.lightBlue);
                this.rect(ctx, x + u, y, u, u, COLORS.lightBlue);
                this.rect(ctx, x, y - u, u, u, COLORS.cyan);
                this.rect(ctx, x, y + u, u, u, COLORS.cyan);
            }
        }

        // 7. Crescent Moon in Upper Sky
        this.drawMoon(ctx, width, height);

        // 8. Drifting Gothic Night Clouds
        this.drawCloud(ctx, width, height, 0.30, 0.18, 38, 0.14);
        this.drawCloud(ctx, width, height, 0.72, 0.36, 28, -0.10);
        this.drawCloud(ctx, width, height, 0.88, 0.14, 20, 0.08);
    }

    drawLightningBolt(ctx, startX, horizon) {
        const u = this.pixelSize;
        let cx = this.snap(startX);
        const maxY = horizon * 0.78;
        let step = 0;

        for (let y = 0; y < maxY; y += u * 2) {
            const zig = ((step * 5 + 3) % 7) - 3;
            cx += zig * u;
            this.rect(ctx, cx, y, u, u * 2, COLORS.white);
            this.rect(ctx, cx + u, y, u, u * 2, COLORS.lightBlue);

            // Secondary forked branch
            if (step === 4 || step === 8) {
                const dir = step === 4 ? -1 : 1;
                for (let b = 1; b <= 4; b++) {
                    this.rect(ctx, cx + dir * b * u * 2, y + b * u * 2, u, u * 2, COLORS.lightBlue);
                }
            }
            step++;
        }
    }

    drawMoon(ctx, width, height) {
        const u = Math.max(this.pixelSize, Math.floor(Math.min(width, height) / 100));
        const mx = Math.floor((width * 0.14) / u) * u;
        const my = Math.floor((this.floorY * 0.16) / u) * u;

        // Tension-reactive Blood-Moon / Halo aura
        const isBloodMoon = this.tension > 0.72;
        const bodyColor = isBloodMoon && this.heavyPulse > 0.25 ? COLORS.orange : COLORS.yellow;
        const rimColor = isBloodMoon ? COLORS.yellow : COLORS.white;

        // Dithered outer lunar halo on beats or high tension
        if (this.beatPulse > 0.35 || this.tension > 0.50) {
            const haloColor = isBloodMoon ? COLORS.red : COLORS.lightBlue;
            this.rect(ctx, mx - u, my + 2 * u, u, u, haloColor);
            this.rect(ctx, mx - u, my + 5 * u, u, u, haloColor);
            this.rect(ctx, mx + u, my - u, u, u, haloColor);
            this.rect(ctx, mx + 4 * u, my - u, u, u, haloColor);
            this.rect(ctx, mx + u, my + 8 * u, u, u, haloColor);
        }

        // Crescent moon row spans [startCol, endCol]
        this.rect(ctx, mx + 3 * u, my + 0 * u, 4 * u, u, bodyColor);
        this.rect(ctx, mx + 2 * u, my + 1 * u, 6 * u, u, bodyColor);
        this.rect(ctx, mx + 1 * u, my + 2 * u, 7 * u, u, bodyColor);
        this.rect(ctx, mx + 0 * u, my + 3 * u, 7 * u, u, bodyColor);
        this.rect(ctx, mx + 0 * u, my + 4 * u, 6 * u, u, bodyColor);
        this.rect(ctx, mx + 1 * u, my + 5 * u, 4 * u, u, bodyColor);
        this.rect(ctx, mx + 2 * u, my + 6 * u, 3 * u, u, bodyColor);
        this.rect(ctx, mx + 3 * u, my + 7 * u, 2 * u, u, bodyColor);

        // Inner crescent dark mask (creates crisp crescent horn profile)
        this.rect(ctx, mx + 5 * u, my + u, 3 * u, 2 * u, COLORS.darkBlue);
        this.rect(ctx, mx + 4 * u, my + 3 * u, 3 * u, 2 * u, COLORS.purple);
        this.rect(ctx, mx + 3 * u, my + 5 * u, 2 * u, u, COLORS.purple);

        // Lunar highlight on outer rim
        this.rect(ctx, mx + 2 * u, my, 2 * u, u, rimColor);
        this.rect(ctx, mx + u, my + u, u, 2 * u, rimColor);
        this.rect(ctx, mx, my + 3 * u, u, 2 * u, rimColor);
    }

    drawCloud(ctx, width, height, baseX, baseY, logicalWidth, speed) {
        const scale = Math.max(this.pixelSize, Math.floor(Math.min(width / 320, height / 200) * 2));
        const cloudWidth = logicalWidth * scale;
        const travel = width + cloudWidth;
        const x = ((baseX * width + this.cloudOffset * speed) % travel + travel) % travel - cloudWidth / 2;
        const y = baseY * this.floorY;

        const topRim = this.lightningTimer > 0
            ? COLORS.lightBlue
            : (this.beatPulse > 0.6 ? COLORS.grey : COLORS.darkGrey);
        const underbelly = this.tension > 0.68 ? COLORS.brown : COLORS.purple;

        // Stepped gothic night cloud with silver lining
        this.rect(ctx, x + cloudWidth * 0.24, y - scale, cloudWidth * 0.30, scale, topRim);
        this.rect(ctx, x + cloudWidth * 0.22, y, cloudWidth * 0.35, scale * 2, COLORS.darkGrey);
        this.rect(ctx, x + cloudWidth * 0.08, y + scale * 2, cloudWidth * 0.82, scale * 2, COLORS.darkGrey);
        this.rect(ctx, x, y + scale * 4, cloudWidth, scale * 2, underbelly);
    }

    spawnBat(seed, strength) {
        const bat = this.bats[this.batCursor];
        this.batCursor = (this.batCursor + 1) % MAX_BATS;

        const dir = (seed & 1) === 0 ? -1 : 1;
        bat.active = true;
        // Emerge from central castle keep spire
        bat.x = this.width * (0.50 + dir * 0.03);
        bat.y = this.floorY * (0.36 + ((seed * 3) % 5) * 0.06);
        const speed = Math.min(this.width, this.height) * (0.09 + strength * 0.08 + this.tension * 0.05);
        bat.vx = dir * speed;
        bat.vy = -speed * (0.18 + (seed % 3) * 0.08);
        bat.flapPhase = seed * 1.7;
        bat.waveAmp = this.pixelSize * (2 + (seed % 3));
    }

    updateAndDrawBats(ctx, dt, t) {
        const u = this.pixelSize;
        const flapSpeed = 12.0 + this.tension * 8.0 + this.beatPulse * 6.0;

        for (let i = 0; i < MAX_BATS; i++) {
            const bat = this.bats[i];
            if (!bat.active) continue;

            bat.x += bat.vx * dt;
            bat.y += bat.vy * dt;

            if (bat.x < -u * 6 || bat.x > this.width + u * 6 || bat.y < -u * 6 || bat.y >= this.floorY) {
                bat.active = false;
                continue;
            }

            const bobY = bat.y + Math.sin(t * 6.0 + bat.flapPhase) * bat.waveAmp;
            const wingState = Math.floor(t * flapSpeed + bat.flapPhase) & 1;

            // Classic C64 2-frame pixel bat sprite
            this.rect(ctx, bat.x, bobY, u, u, COLORS.black);
            if (wingState === 0) {
                // Wings arched up (V-shape)
                this.rect(ctx, bat.x - u, bobY - u, u, u, COLORS.black);
                this.rect(ctx, bat.x + u, bobY - u, u, u, COLORS.black);
                this.rect(ctx, bat.x - u * 2, bobY - u * 2, u, u, COLORS.darkGrey);
                this.rect(ctx, bat.x + u * 2, bobY - u * 2, u, u, COLORS.darkGrey);
            } else {
                // Wings swept down (M-shape)
                this.rect(ctx, bat.x - u, bobY, u, u, COLORS.black);
                this.rect(ctx, bat.x + u, bobY, u, u, COLORS.black);
                this.rect(ctx, bat.x - u * 2, bobY + u, u, u, COLORS.darkGrey);
                this.rect(ctx, bat.x + u * 2, bobY + u, u, u, COLORS.darkGrey);
            }
        }
    }

    addBurst(width, height, t, beatCount, strength, salvoIndex) {
        const burst = this.bursts[this.burstCursor];
        this.burstCursor = (this.burstCursor + 1) % this.bursts.length;

        const colorIndex = ((beatCount + salvoIndex * 3) % BURST_COLORS.length + BURST_COLORS.length) % BURST_COLORS.length;
        const lane = (beatCount * 5 + 2 + salvoIndex * 4) % 9;
        const verticalBand = (beatCount * 3 + 1 + salvoIndex) % 3;

        // Tiered burst complexity by beat strength & tension
        const effectiveStrength = clamp(strength + this.tension * 0.15, 0, 1);
        const tier = effectiveStrength >= 0.74 ? 2 : (effectiveStrength >= 0.42 ? 1 : 0);

        burst.x = width * (0.14 + lane * 0.088);
        burst.y = this.floorY * (0.15 + verticalBand * 0.15);
        burst.launchY = this.floorY * 0.72;
        burst.startTime = t;
        burst.color = BURST_COLORS[colorIndex];
        burst.secondaryColor = SECONDARY_COLORS[colorIndex];
        burst.strength = strength;
        burst.tier = tier;
        burst.duration = 0.70 + strength * 0.45 + (tier === 2 ? 0.20 : 0);
        burst.maxRadius = Math.min(width, height) * (0.065 + strength * 0.105 + tier * 0.015);
        burst.particleCount = tier >= 1 ? 16 : 8;
    }

    updateFireworks(ctx, width, height, t) {
        const u = this.pixelSize;
        this.activeRimColor = null;
        let freshestAge = Infinity;

        for (let b = 0; b < this.bursts.length; b++) {
            const burst = this.bursts[b];
            const age = t - burst.startTime;
            if (age < 0 || age >= burst.duration) continue;

            const progress = age / burst.duration;

            // Track brightest active burst color for castle rim lighting
            if (progress < 0.65 && age < freshestAge) {
                freshestAge = age;
                this.activeRimColor = progress < 0.15 ? COLORS.white : burst.color;
            }

            // 1. Ascending Mortar Trail from behind the castle during initial ignition
            if (progress < 0.20) {
                const trailProgress = progress / 0.20;
                const trailHeadY = burst.launchY - (burst.launchY - burst.y) * trailProgress;
                this.rect(ctx, burst.x, trailHeadY, u, u * 2, COLORS.white);
                this.rect(ctx, burst.x, trailHeadY + u * 2, u, u * 2, COLORS.yellow);
                this.rect(ctx, burst.x, trailHeadY + u * 4, u, u * 2, COLORS.orange);
            }

            const radius = burst.maxRadius * Math.pow(progress, 0.72);
            const gravity = progress * progress * height * (burst.tier === 2 ? 0.052 : 0.038);

            const activeCount = progress > 0.75
                ? Math.max(4, Math.floor(burst.particleCount * (1 - (progress - 0.75) * 3.5)))
                : burst.particleCount;

            // 2. Detonation Core Flash
            if (progress < 0.22) {
                const flashSpan = burst.tier === 2 ? 3 : 2;
                this.rect(ctx, burst.x - u * flashSpan, burst.y, u * (flashSpan * 2 + 1), u, COLORS.white);
                this.rect(ctx, burst.x, burst.y - u * flashSpan, u, u * (flashSpan * 2 + 1), COLORS.white);
                if (burst.tier >= 1) {
                    this.rect(ctx, burst.x - u, burst.y - u, u * 3, u * 3, burst.color);
                }
            }

            // 3. Expanding Radial Sparks & Multi-Ring Geometry
            const step = burst.particleCount === 8 ? 2 : 1;
            for (let i = 0; i < activeCount; i++) {
                const dirIdx = (i * step) % DIRECTIONS.length;
                const dx = DIRECTIONS[dirIdx][0];
                const dy = DIRECTIONS[dirIdx][1];

                const px = burst.x + (dx * radius) / 100;
                const py = burst.y + (dy * radius) / 100 + gravity;

                // Strobe crackle on Tier 2 Finale bursts
                const isCrackle = burst.tier === 2 && progress > 0.58 && ((i + Math.floor(t * 24)) % 3 === 0);
                const headColor = isCrackle
                    ? COLORS.white
                    : ((progress < 0.30 && i % 4 === 0)
                        ? COLORS.white
                        : (progress > 0.68 ? burst.secondaryColor : burst.color));

                // Primary Trail Segment
                if (progress < 0.72) {
                    const tailDist = Math.max(0, radius - u * 2.5);
                    const tailX = burst.x + (dx * tailDist) / 100;
                    const tailY = burst.y + (dy * tailDist) / 100 + gravity * 0.84;
                    this.rect(ctx, tailX, tailY, u, u, burst.secondaryColor);

                    // Extended Weeping-Willow Trail for Tier 2 Heavy Beats
                    if (burst.tier === 2 && radius > u * 5) {
                        const deepDist = Math.max(0, radius - u * 5.0);
                        const deepX = burst.x + (dx * deepDist) / 100;
                        const deepY = burst.y + (dy * deepDist) / 100 + gravity * 0.68;
                        this.rect(ctx, deepX, deepY, u, u, COLORS.brown);
                    }
                }

                // Outer Ring Spark Head
                this.rect(ctx, px, py, u, u, headColor);

                // Inner Second Ring for Tier 1 (Medium) & Tier 2 (Heavy) Beats
                if (burst.tier >= 1 && (i & 1) === 0 && progress > 0.12 && progress < 0.82) {
                    const innerRadius = radius * 0.52;
                    const ix = burst.x + (dx * innerRadius) / 100;
                    const iy = burst.y + (dy * innerRadius) / 100 + gravity * 0.55;
                    this.rect(ctx, ix, iy, u, u, burst.secondaryColor);
                }
            }
        }
    }

    drawTorchFlame(ctx, tx, ty, flameScale, phaseOffset) {
        const u = this.pixelSize;
        const flicker = Math.sin(this.torchPhase + phaseOffset);
        const beatBoost = this.beatPulse > 0.45 ? u : 0;

        // Sconce bracket
        this.rect(ctx, tx, ty + u, u, u * 2, COLORS.brown);
        // Flame base
        this.rect(ctx, tx, ty, u * flameScale, u, COLORS.red);
        // Dancing middle flame
        this.rect(ctx, tx + (flicker > 0.3 ? u * 0.5 : 0), ty - u, u * flameScale, u, COLORS.orange);
        // Bright tip flaring up on the beat
        this.rect(ctx, tx, ty - u * 2 - beatBoost, u, u + beatBoost, this.beatPulse > 0.5 ? COLORS.white : COLORS.yellow);
    }

    drawCastle(ctx, width, height) {
        // =========================================================
        // CASTLEVANIA-STYLE GOTHIC CASTLE SILHOUETTE
        // Standing FLUSH on the horizon (this.floorY).
        // Zero-GC rendering with beat/tension reactive windows,
        // torches, waving banners, and firework rim-lighting.
        // =========================================================
        const centerX = width * 0.5;
        const horizon = this.floorY;

        const cw = Math.min(Math.floor(width * 0.64), Math.floor(horizon * 1.55));
        const ch = Math.min(Math.floor(horizon * 0.82), Math.floor(cw * 0.85));
        const left = Math.floor(centerX - cw * 0.5);
        const top = horizon - ch;

        const stone = COLORS.darkGrey;
        const litStone = this.lightningTimer > 0 ? COLORS.lightGrey : COLORS.grey;
        const hiStone = this.lightningTimer > 0
            ? COLORS.white
            : (this.activeRimColor !== null && this.beatPulse > 0.45 ? this.activeRimColor : COLORS.lightGrey);
        const shade = COLORS.black;
        const roof = COLORS.purple;
        const roofTrim = this.activeRimColor !== null ? this.activeRimColor : COLORS.darkBlue;

        // 1. Rocky Crags Foundation (Schlossfelsen am Horizont)
        this.castleRect(ctx, left, top, cw, ch, 0.00, 0.88, 0.16, 0.12, shade);
        this.castleRect(ctx, left, top, cw, ch, 0.04, 0.84, 0.12, 0.16, stone);
        this.castleRect(ctx, left, top, cw, ch, 0.12, 0.80, 0.76, 0.20, shade);
        this.castleRect(ctx, left, top, cw, ch, 0.84, 0.84, 0.14, 0.16, stone);
        this.castleRect(ctx, left, top, cw, ch, 0.88, 0.88, 0.12, 0.12, shade);

        // 2. Central Great Keep (Bergfried)
        this.castleRect(ctx, left, top, cw, ch, 0.34, 0.34, 0.32, 0.66, stone);
        this.castleRect(ctx, left, top, cw, ch, 0.38, 0.28, 0.24, 0.72, litStone);
        this.castleRect(ctx, left, top, cw, ch, 0.42, 0.32, 0.16, 0.68, stone);

        // Central Keep Battlements (Zinnen)
        this.castleRect(ctx, left, top, cw, ch, 0.32, 0.26, 0.36, 0.05, hiStone);
        for (let i = 0; i < 5; i++) {
            this.castleRect(ctx, left, top, cw, ch, 0.33 + i * 0.07, 0.22, 0.04, 0.04, hiStone);
            this.castleRect(ctx, left, top, cw, ch, 0.33 + i * 0.07, 0.23, 0.02, 0.03, litStone);
        }

        // Gargoyle Eyes on Keep Corners (glint red/yellow on high tension or heavy beats)
        if (this.tension > 0.50 || this.heavyPulse > 0.2) {
            const eyeColor = this.heavyPulse > 0.4 ? COLORS.yellow : COLORS.lightRed;
            this.castleRect(ctx, left, top, cw, ch, 0.31, 0.26, 0.015, 0.015, eyeColor);
            this.castleRect(ctx, left, top, cw, ch, 0.675, 0.26, 0.015, 0.015, eyeColor);
        }

        // Central Tower Upper Spire (Hoher Spitzhelm)
        this.castleRect(ctx, left, top, cw, ch, 0.42, 0.14, 0.16, 0.12, litStone);
        this.castleRect(ctx, left, top, cw, ch, 0.44, 0.08, 0.12, 0.06, roof);
        this.castleRect(ctx, left, top, cw, ch, 0.46, 0.03, 0.08, 0.05, roof);
        this.castleRect(ctx, left, top, cw, ch, 0.48, 0.00, 0.04, 0.03, roofTrim);
        // Gothic Cross Finial at Spire Peak
        this.castleRect(ctx, left, top, cw, ch, 0.49, -0.02, 0.02, 0.05, COLORS.white);
        this.castleRect(ctx, left, top, cw, ch, 0.475, -0.01, 0.05, 0.015, COLORS.white);

        // 3. Left Gothic Tower (Flankenturm Links mit Erkerturm)
        this.castleRect(ctx, left, top, cw, ch, 0.08, 0.44, 0.20, 0.56, stone);
        this.castleRect(ctx, left, top, cw, ch, 0.11, 0.36, 0.15, 0.64, litStone);
        this.castleRect(ctx, left, top, cw, ch, 0.13, 0.40, 0.11, 0.60, stone);

        // Left Tower Battlements & Spire Roof
        this.castleRect(ctx, left, top, cw, ch, 0.09, 0.34, 0.19, 0.04, hiStone);
        for (let i = 0; i < 3; i++) {
            this.castleRect(ctx, left, top, cw, ch, 0.10 + i * 0.06, 0.30, 0.035, 0.04, hiStone);
        }
        this.castleRect(ctx, left, top, cw, ch, 0.12, 0.22, 0.13, 0.08, roof);
        this.castleRect(ctx, left, top, cw, ch, 0.14, 0.15, 0.09, 0.07, roof);
        this.castleRect(ctx, left, top, cw, ch, 0.16, 0.09, 0.05, 0.06, roofTrim);

        // Animated Waving Banner on Left Spire (synced to windPhase & tension)
        const bannerWave = Math.sin(this.windPhase * 2.5) > 0 ? 0.012 : -0.012;
        const bannerColor = this.beatPulse > 0.65 ? COLORS.lightRed : COLORS.red;
        this.castleRect(ctx, left, top, cw, ch, 0.175, 0.06, 0.03, 0.02, bannerColor);
        this.castleRect(ctx, left, top, cw, ch, 0.205, 0.06 + bannerWave, 0.03, 0.02, bannerColor);

        // Left Bartizan (Erkertürmchen an der Außenmauer)
        this.castleRect(ctx, left, top, cw, ch, 0.05, 0.50, 0.06, 0.16, litStone);
        this.castleRect(ctx, left, top, cw, ch, 0.05, 0.46, 0.06, 0.04, roof);

        // Left Curtain Wall (Verbindungsmauer)
        this.castleRect(ctx, left, top, cw, ch, 0.24, 0.54, 0.12, 0.46, stone);
        this.castleRect(ctx, left, top, cw, ch, 0.24, 0.50, 0.12, 0.04, hiStone);
        this.castleRect(ctx, left, top, cw, ch, 0.25, 0.47, 0.03, 0.03, hiStone);
        this.castleRect(ctx, left, top, cw, ch, 0.31, 0.47, 0.03, 0.03, hiStone);

        // 4. Right Tower & Cathedral Wing (Rechter Flügel & Asymmetrischer Turm)
        this.castleRect(ctx, left, top, cw, ch, 0.72, 0.40, 0.20, 0.60, stone);
        this.castleRect(ctx, left, top, cw, ch, 0.75, 0.32, 0.15, 0.68, litStone);
        this.castleRect(ctx, left, top, cw, ch, 0.77, 0.36, 0.11, 0.64, stone);

        // Right Tower Battlements & Spire
        this.castleRect(ctx, left, top, cw, ch, 0.73, 0.30, 0.19, 0.04, hiStone);
        for (let i = 0; i < 3; i++) {
            this.castleRect(ctx, left, top, cw, ch, 0.74 + i * 0.06, 0.26, 0.035, 0.04, hiStone);
        }
        this.castleRect(ctx, left, top, cw, ch, 0.76, 0.19, 0.13, 0.07, roof);
        this.castleRect(ctx, left, top, cw, ch, 0.78, 0.13, 0.09, 0.06, roof);
        this.castleRect(ctx, left, top, cw, ch, 0.80, 0.08, 0.05, 0.05, roofTrim);

        // Animated Waving Banner on Right Spire
        this.castleRect(ctx, left, top, cw, ch, 0.82, 0.05, 0.03, 0.02, bannerColor);
        this.castleRect(ctx, left, top, cw, ch, 0.85, 0.05 - bannerWave, 0.025, 0.02, bannerColor);

        // Right Sloping Cathedral Roof
        this.castleRect(ctx, left, top, cw, ch, 0.64, 0.56, 0.10, 0.44, stone);
        this.castleRect(ctx, left, top, cw, ch, 0.64, 0.48, 0.10, 0.08, roof);
        this.castleRect(ctx, left, top, cw, ch, 0.64, 0.46, 0.10, 0.02, hiStone);

        // 5. Beat- & Tension-Synchronized Gothic Windows
        const isHighTension = this.tension > 0.58;
        const windowRim = isHighTension ? COLORS.red : COLORS.orange;
        const windowCore = this.heavyPulse > 0.45
            ? COLORS.white
            : (this.beatPulse > 0.35 ? COLORS.yellow : (isHighTension ? COLORS.lightRed : COLORS.yellow));

        // Central Keep High Stained Glass Window
        this.castleRect(ctx, left, top, cw, ch, 0.46, 0.40, 0.08, 0.16, windowRim);
        this.castleRect(ctx, left, top, cw, ch, 0.47, 0.42, 0.06, 0.12, windowCore);
        this.castleRect(ctx, left, top, cw, ch, 0.48, 0.38, 0.04, 0.03, windowCore); // Gothic pointed arch
        this.castleRect(ctx, left, top, cw, ch, 0.49, 0.40, 0.02, 0.16, shade);      // Vertical mullion
        this.castleRect(ctx, left, top, cw, ch, 0.46, 0.46, 0.08, 0.02, shade);      // Horizontal transom

        // Dracula / Belfry Chamber Window (Upper Spire)
        const belfryColor = this.heavyPulse > 0.3 ? COLORS.lightRed : COLORS.yellow;
        this.castleRect(ctx, left, top, cw, ch, 0.47, 0.16, 0.06, 0.07, belfryColor);
        if (this.tension > 0.45) {
            // Silhouette of Count Dracula standing in the upper keep window
            this.castleRect(ctx, left, top, cw, ch, 0.49, 0.175, 0.02, 0.055, shade);
        }

        // Left & Right Tower Lancet Windows (alternate glow on beats)
        const beatAlt = (this.lastBeatCount & 1) === 0;
        const activeWin = this.beatPulse > 0.3 ? COLORS.white : COLORS.yellow;
        const dimWin = isHighTension ? COLORS.red : COLORS.orange;

        this.castleRect(ctx, left, top, cw, ch, 0.16, 0.42, 0.04, 0.08, beatAlt ? activeWin : COLORS.darkBlue);
        this.castleRect(ctx, left, top, cw, ch, 0.16, 0.56, 0.04, 0.09, beatAlt ? dimWin : activeWin);

        this.castleRect(ctx, left, top, cw, ch, 0.80, 0.38, 0.04, 0.08, beatAlt ? dimWin : activeWin);
        this.castleRect(ctx, left, top, cw, ch, 0.80, 0.52, 0.04, 0.09, beatAlt ? activeWin : COLORS.darkBlue);

        // Wall Slit Arrow Loops (glow faintly red under high tension)
        const slitColor = isHighTension && this.beatPulse > 0.4 ? COLORS.red : shade;
        this.castleRect(ctx, left, top, cw, ch, 0.28, 0.62, 0.02, 0.06, slitColor);
        this.castleRect(ctx, left, top, cw, ch, 0.68, 0.62, 0.02, 0.06, slitColor);

        // 6. Arched Main Portcullis Gate (Burgtor mit Fallgatter)
        // Base rests flush on the horizon (y = 1.00)
        const gateGlow = this.heavyPulse > 0.4
            ? COLORS.orange
            : (this.beatPulse > 0.3 || isHighTension ? COLORS.brown : shade);
        this.castleRect(ctx, left, top, cw, ch, 0.44, 0.76, 0.12, 0.24, shade);
        this.castleRect(ctx, left, top, cw, ch, 0.46, 0.72, 0.08, 0.05, shade);
        // Inner courtyard firelight on portcullis floor
        this.castleRect(ctx, left, top, cw, ch, 0.45, 0.90, 0.10, 0.08, gateGlow);

        // Iron gate bars (Fallgitter)
        this.castleRect(ctx, left, top, cw, ch, 0.47, 0.77, 0.015, 0.23, COLORS.darkGrey);
        this.castleRect(ctx, left, top, cw, ch, 0.515, 0.77, 0.015, 0.23, COLORS.darkGrey);
        this.castleRect(ctx, left, top, cw, ch, 0.44, 0.84, 0.12, 0.02, COLORS.darkGrey);
        this.castleRect(ctx, left, top, cw, ch, 0.44, 0.92, 0.12, 0.02, COLORS.darkGrey);

        // Animated Gate Torches & Curtain-Wall Braziers
        this.drawTorchFlame(ctx, left + cw * 0.415, top + ch * 0.82, 1, 0.0);
        this.drawTorchFlame(ctx, left + cw * 0.565, top + ch * 0.82, 1, 1.8);
        this.drawTorchFlame(ctx, left + cw * 0.28, top + ch * 0.47, 1, 3.1);
        this.drawTorchFlame(ctx, left + cw * 0.68, top + ch * 0.45, 1, 4.7);

        // 7. Base Horizon Anchor Line (100% flush grounding on floorY)
        this.castleRect(ctx, left, top, cw, ch, 0.04, 0.98, 0.92, 0.02, shade);
    }

    drawGnarledTree(ctx, baseX, baseY, treeH, lean, hasOwlEyes) {
        const u = this.pixelSize;
        const trunkW = u * 2;
        const trunkH = Math.max(u * 4, Math.floor(treeH * 0.60));
        const windSway = Math.round(Math.sin(this.windPhase + baseX * 0.02)) * u;

        // 1. Root flare
        this.rect(ctx, baseX - u * 2, baseY - u, u * 4, u, COLORS.black);
        this.rect(ctx, baseX - u * 3, baseY, u, u, COLORS.black);
        this.rect(ctx, baseX + u * 2, baseY, u, u, COLORS.black);

        // 2. Twisted Trunk
        const highlightColor = this.lightningTimer > 0 ? COLORS.lightBlue : COLORS.darkGrey;
        for (let y = baseY; y > baseY - trunkH; y -= u) {
            const progress = (baseY - y) / trunkH;
            const tx = baseX + Math.floor(progress * progress * lean * u * 4);
            const w = progress > 0.55 ? u : trunkW;
            this.rect(ctx, tx - Math.floor(w / 2), y - u, w, u, COLORS.black);
            if (progress > 0.2 && progress < 0.75) {
                this.rect(ctx, tx + (lean < 0 ? 0 : -Math.floor(w / 2)), y - u, u, u, highlightColor);
            }
        }

        const forkY = baseY - trunkH;
        const forkX = baseX + Math.floor(lean * u * 4);

        // Optional perched owl/raven eyes in the hollow of the foreground tree
        if (hasOwlEyes && (this.beatPulse > 0.2 || (Math.floor(this.windPhase * 2) % 5 !== 0))) {
            const eyeCol = this.tension > 0.65 ? COLORS.lightRed : COLORS.yellow;
            this.rect(ctx, forkX - u, forkY + u, u, u, eyeCol);
            this.rect(ctx, forkX + u, forkY + u, u, u, eyeCol);
        }

        // 3. Lower crooked branch spreading outward (sways at tip with wind)
        const b1Len = Math.max(u * 3, Math.floor(treeH * 0.42));
        for (let i = 0; i < b1Len; i += u) {
            const sway = i > b1Len * 0.6 ? windSway : 0;
            const bx = forkX - lean * i + sway;
            const by = forkY + Math.floor(i * 0.35) - Math.floor(Math.sin((i / b1Len) * Math.PI) * u * 2);
            this.rect(ctx, bx, by, u, u, COLORS.black);
            if (i > b1Len * 0.45) {
                this.rect(ctx, bx, by - u, u, u, COLORS.black);
                this.rect(ctx, bx - lean * u, by - u * 2, u, u, COLORS.black);
            }
        }

        // 4. Upper main crooked bough reaching upward
        const b2Len = Math.max(u * 4, Math.floor(treeH * 0.52));
        for (let i = 0; i < b2Len; i += u) {
            const sway = i > b2Len * 0.5 ? windSway : 0;
            const bx = forkX + lean * Math.floor(i * 0.65) + sway;
            const by = forkY - i;
            this.rect(ctx, bx, by, u, u, COLORS.black);
            if (i > b2Len * 0.35 && (Math.floor(i / u) % 2 === 0)) {
                this.rect(ctx, bx + lean * u, by - u, u, u, COLORS.black);
                this.rect(ctx, bx + lean * u * 2, by - u * 2, u, u, COLORS.black);
            }
        }
    }

    drawGothicPine(ctx, baseX, baseY, treeH) {
        const u = this.pixelSize;
        const topY = baseY - treeH;
        const sway = Math.round(Math.sin(this.windPhase + baseX * 0.03)) * u;

        // Trunk & swaying spire tip
        this.rect(ctx, baseX + sway, topY, u, u * 2, COLORS.black);
        this.rect(ctx, baseX, topY + u * 2, u, treeH - u * 2, COLORS.black);

        const tiers = 5;
        for (let t = 0; t < tiers; t++) {
            const progress = (t + 1) / tiers;
            const tierY = topY + Math.floor(progress * treeH * 0.82);
            const spanW = Math.max(u * 2, Math.floor(progress * u * 7));
            const tierSway = t < 2 ? sway : 0;

            this.rect(ctx, baseX - spanW + tierSway, tierY, spanW * 2 + u, u, COLORS.black);
            this.rect(ctx, baseX - spanW + tierSway, tierY + u, u, u, COLORS.darkGrey);
            this.rect(ctx, baseX + spanW + tierSway, tierY + u, u, u, COLORS.darkGrey);
            if (spanW > u * 3) {
                this.rect(ctx, baseX - spanW + u * 2, tierY + u, u, u, COLORS.darkBlue);
                this.rect(ctx, baseX + spanW - u * 2, tierY + u, u, u, COLORS.darkBlue);
            }
        }
    }

    drawGroundMist(ctx, width, horizon, fgHeight) {
        const u = this.pixelSize;
        const mistRows = this.tension > 0.55 ? 4 : 3;

        for (let m = 0; m < mistRows; m++) {
            const bandY = horizon + Math.floor(fgHeight * (0.08 + m * 0.16));
            const dir = (m & 1) === 0 ? 1 : -1;
            const wispW = u * (14 + m * 4);
            const spacing = wispW * 2.2;
            const scroll = this.mistOffset * dir * (0.6 + m * 0.25);

            for (let base = -wispW; base < width + wispW; base += spacing) {
                const wx = ((base + scroll) % (width + wispW * 2) + (width + wispW * 2)) % (width + wispW * 2) - wispW;
                const mistCol = (m & 1) === 0 ? COLORS.darkBlue : COLORS.purple;

                // Dithered C64 horizontal mist ribbon
                for (let dx = 0; dx < wispW; dx += u * 2) {
                    this.rect(ctx, wx + dx, bandY, u, u, mistCol);
                    if (dx > u * 2 && dx < wispW - u * 2) {
                        this.rect(ctx, wx + dx + u, bandY + u, u, u, COLORS.darkGrey);
                    }
                }
            }
        }
    }

    drawForeground(ctx, width, height) {
        const horizon = this.floorY;
        const fgHeight = height - horizon;
        if (fgHeight <= 0) return;

        const u = this.pixelSize;
        const centerX = width * 0.5;
        const castleWidth = Math.min(Math.floor(width * 0.64), Math.floor(horizon * 1.55));
        const castleLeft = Math.floor(centerX - castleWidth * 0.5);
        const castleRight = castleLeft + castleWidth;

        // 1. Dark Ground Base below horizon
        ctx.fillStyle = COLORS.black;
        ctx.fillRect(0, horizon, width, fgHeight);

        // 2. Asymmetric Hills Rising ABOVE the Horizon (No hard horizon line!)
        const crestRim = this.lightningTimer > 0
            ? COLORS.lightBlue
            : (this.activeRimColor !== null && this.beatPulse > 0.5 ? COLORS.purple : COLORS.darkBlue);

        // LEFT CRAGGY MOUNTAIN RIDGE
        const leftBoundary = Math.floor(castleLeft + castleWidth * 0.04);
        for (let x = 0; x < leftBoundary; x += u) {
            const p = x / Math.max(1, leftBoundary);
            const mainCurve = Math.sin(Math.pow(p, 0.65) * Math.PI);
            const cragDetail = Math.sin(p * Math.PI * 4.5) * 0.06;
            const hillH = Math.floor(fgHeight * (0.16 + 0.28 * mainCurve + cragDetail));
            const hillTop = horizon - hillH;

            this.rect(ctx, x, hillTop, u, hillH, COLORS.black);
            this.rect(ctx, x, hillTop, u, u * 2, crestRim);
            if (hillH > Math.floor(fgHeight * 0.24)) {
                this.rect(ctx, x, hillTop + u * 2, u, u, COLORS.darkGrey);
            }
        }

        // RIGHT ROLLING GOTHIC HILL
        const rightBoundary = Math.floor(castleRight - castleWidth * 0.04);
        for (let x = rightBoundary; x < width; x += u) {
            const p = (x - rightBoundary) / Math.max(1, width - rightBoundary);
            const mainCurve = Math.sin(p * Math.PI);
            const terrace = Math.cos(p * Math.PI * 3.0) * 0.04;
            const hillH = Math.floor(fgHeight * (0.04 + 0.24 * mainCurve + terrace));
            const hillTop = horizon - hillH;

            this.rect(ctx, x, hillTop, u, hillH, COLORS.black);
            this.rect(ctx, x, hillTop, u, u * 2, crestRim);
            if (((Math.floor(x / u)) & 1) === 0) {
                this.rect(ctx, x, hillTop + u * 2, u, u, COLORS.green);
            }
        }

        // 3. Plowed Fields & Night Meadows (Felder & Wiesen)
        for (let f = 1; f <= 5; f++) {
            const startX = width * (0.68 + f * 0.05);
            const startY = horizon + Math.floor(fgHeight * 0.12);
            const endX = width * (0.75 + f * 0.06);
            const endY = height;
            for (let y = startY; y < endY; y += u * 2) {
                const depth = (y - startY) / (endY - startY);
                const fx = startX + (endX - startX) * depth;
                this.rect(ctx, fx, y, u, u, COLORS.brown);
            }
        }

        // Meadow Dither Patches
        for (let row = 0; row < 6; row++) {
            const y = horizon + Math.floor(fgHeight * (0.16 + row * 0.14));
            const step = u * 3;
            for (let x = 0; x < width * 0.42; x += step) {
                if (((Math.floor(x / u) + row) & 1) === 0) {
                    this.rect(ctx, x, y, u, u, COLORS.green);
                }
            }
        }

        // Wild grass tufts along the slopes
        for (let i = 0; i < 9; i++) {
            const gx = (i * 37 + Math.floor(width * 0.05)) % Math.max(1, Math.floor(width));
            const gy = horizon + u * (4 + (i % 4) * 3);
            this.rect(ctx, gx, gy, u * 2, u, i % 2 ? COLORS.lightGreen : COLORS.green);
            this.rect(ctx, gx + u, gy - u, u, u, COLORS.green);
        }

        // 4. Drifting Graveyard / Meadow Ground Mist
        this.drawGroundMist(ctx, width, horizon, fgHeight);

        // 5. Winding Path Leading to Castle Portcullis (Gewundener Weg)
        for (let y = horizon; y < height; y += u) {
            const depth = (y - horizon) / Math.max(1, fgHeight);
            const winding = Math.sin(depth * Math.PI * 2.2) * (width * 0.08)
                - Math.cos(depth * Math.PI * 1.1) * (width * 0.03);
            const pathX = centerX + winding;
            const pathWidth = u * (2 + Math.floor(depth * Math.min(16, (width / u) * 0.07)));

            // Warm threshold torch glow right in front of the portcullis gate
            const isGateThreshold = depth < 0.12 && this.beatPulse > 0.25;
            const pathColor = isGateThreshold
                ? COLORS.yellow
                : (depth < 0.25 ? COLORS.orange : (depth < 0.65 ? COLORS.brown : COLORS.darkGrey));

            this.rect(ctx, pathX - pathWidth / 2, y, pathWidth, u, pathColor);

            // Cobblestone border flecks along path
            if (depth < 0.65) {
                const borderCol = depth < 0.25 ? COLORS.lightGrey : COLORS.grey;
                this.rect(ctx, pathX - pathWidth / 2 - u, y, u, u, borderCol);
                this.rect(ctx, pathX + pathWidth / 2, y, u, u, borderCol);
            }
        }

        // 6. Beat-Synchronized Pilgrim Torch-Posts along the Winding Path
        // Pulses travel sequentially from foreground toward the castle gate on each beat!
        const activeChaserIdx = ((3 - (this.lastBeatCount % 4)) + 4) % 4;
        for (let tIdx = 0; tIdx < PATH_TORCH_DEPTHS.length; tIdx++) {
            const depth = PATH_TORCH_DEPTHS[tIdx];
            const ty = horizon + Math.floor(depth * fgHeight);
            const winding = Math.sin(depth * Math.PI * 2.2) * (width * 0.08)
                - Math.cos(depth * Math.PI * 1.1) * (width * 0.03);
            const pathX = centerX + winding;
            const pathWidth = u * (2 + Math.floor(depth * Math.min(16, (width / u) * 0.07)));

            const side = (tIdx & 1) === 0 ? -1 : 1;
            const postX = pathX + side * (pathWidth * 0.5 + u * 2);
            const postH = u * (3 + tIdx);

            // Ground light pool on path
            const isChaserLit = tIdx === activeChaserIdx && this.beatPulse > 0.15;
            this.rect(ctx, pathX + side * pathWidth * 0.2, ty, u * 2, u, isChaserLit ? COLORS.yellow : COLORS.orange);

            // Wooden torch post
            this.rect(ctx, postX, ty - postH, u, postH, COLORS.brown);

            // Flickering torch flame
            this.drawTorchFlame(ctx, postX, ty - postH, 1, tIdx * 1.6);
        }

        // 7. Dark Gothic Silhouetted Trees (Castlevania Dracula Style)
        const leftPeakX = Math.floor(width * 0.08);
        const leftPeakY = horizon - Math.floor(fgHeight * 0.38);
        this.drawGnarledTree(ctx, leftPeakX, leftPeakY + u * 2, Math.floor(fgHeight * 0.38), -1, false);

        const leftSlopeX = Math.floor(width * 0.17);
        const leftSlopeY = horizon - Math.floor(fgHeight * 0.18);
        this.drawGnarledTree(ctx, leftSlopeX, leftSlopeY + u * 2, Math.floor(fgHeight * 0.26), 1, false);

        const pineX1 = Math.floor(width * 0.86);
        const pineY1 = horizon - Math.floor(fgHeight * 0.23);
        this.drawGothicPine(ctx, pineX1, pineY1 + u * 2, Math.floor(fgHeight * 0.30));

        const pineX2 = Math.floor(width * 0.92);
        const pineY2 = horizon - Math.floor(fgHeight * 0.18);
        this.drawGothicPine(ctx, pineX2, pineY2 + u * 2, Math.floor(fgHeight * 0.24));

        // Spooky gnarled tree in foreground meadow (with blinking owl/raven eyes)
        const fgTreeX1 = Math.floor(width * 0.23);
        const fgTreeY1 = horizon + Math.floor(fgHeight * 0.46);
        this.drawGnarledTree(ctx, fgTreeX1, fgTreeY1, Math.floor(fgHeight * 0.36), 1, true);

        const fgTreeX2 = Math.floor(width * 0.77);
        const fgTreeY2 = horizon + Math.floor(fgHeight * 0.58);
        this.drawGnarledTree(ctx, fgTreeX2, fgTreeY2, Math.floor(fgHeight * 0.32), -1, false);
    }

    render(ctx, width, height, t, state, stateTime, metrics = {}) {
        if (width <= 0 || height <= 0 || !Number.isFinite(width / height)) {
            this.lastT = t;
            return;
        }
        if (state === 'idle') {
            this.lastT = t;
            return;
        }

        const dt = this.lastT === 0 || !Number.isFinite(t - this.lastT)
            ? 0.02
            : clamp(t - this.lastT, 0, 0.1);
        this.lastT = t;
        this.width = width;
        this.height = height;

        // C64 integer pixel quantization
        this.pixelSize = Math.max(1, Math.floor(Math.min(width, height) / 100));

        // Exact horizon position matching Floor DSEs (0.55)
        this.floorY = Math.floor((height * this.floorHorizon) / this.pixelSize) * this.pixelSize;

        // Update musical beat, tension & atmospheric timers
        this.updateAudioState(dt, t, state, metrics);

        // 1. C64 Raster Night Sky, Moon, Lightning, Stars & Clouds
        this.drawSky(ctx, width, height, t);

        if (this.floorY <= 0 || width < 4 || height < 4) {
            return;
        }

        // 2. Fireworks in the Sky (BEHIND the Castle!)
        this.updateFireworks(ctx, width, height, t);

        // 3. C64 Hardware-Sprite Vampire Bats flying across Sky & Moon
        this.updateAndDrawBats(ctx, dt, t);

        // 4. Castlevania Gothic Castle (Flush on Horizon)
        this.drawCastle(ctx, width, height);

        // 5. Foreground: Asymmetric Hills, Gothic Trees, Mist, Meadows & Torch-Lit Winding Path
        this.drawForeground(ctx, width, height);

        // DSE Lifecycle Transitions (Ordered Dither Crossfade)
        let visibility = 1;
        if (state === 'starting') visibility = clamp(stateTime / 1.5, 0, 1);
        else if (state === 'stopping') visibility = clamp(1 - stateTime / 1.5, 0, 1);
        applyOrderedDitherFade(ctx, width, height, visibility);
    }
}