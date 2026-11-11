// === js/visuals/dse/c64/castle-fireworks.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: C64 CASTLE FIREWORKS (Background DSE)
// Masterpiece Edition: Golden Ratio composition & Bob Ross
// landscape layering meets Castlevania C64 pixel art.
// - Distant Carpathian mountains with directional moonlight
// - Asymmetric Dracula Citadel + Clock Tower + Viaduct flush
//   on the horizon (floorHorizon = 0.55, no hard horizon line)
// - Shimmering moonlit mountain stream & waterfall on the left
// - Winding cobblestone road with beat-chasing torch posts
// - Repoussoir gnarled foreground oak & layered evergreens
// - 3-tier beat-synced fireworks, vampire bats & lightning
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
    [0.05, 0.08], [0.11, 0.26], [0.24, 0.06], [0.31, 0.18],
    [0.38, 0.07], [0.46, 0.22], [0.53, 0.06], [0.64, 0.14],
    [0.71, 0.08], [0.79, 0.22], [0.88, 0.09], [0.95, 0.25],
    [0.08, 0.39], [0.21, 0.34], [0.36, 0.31], [0.68, 0.33],
    [0.84, 0.35], [0.93, 0.41], [0.14, 0.46], [0.89, 0.48]
];

// True unmasked crescent moon pixel rows: [offsetX, totalWidth, highlightWidth]
const CRESCENT_ROWS = [
    [3, 3, 1],
    [2, 3, 1],
    [1, 3, 1],
    [0, 3, 1],
    [0, 3, 1],
    [0, 3, 1],
    [1, 3, 1],
    [2, 3, 1],
    [3, 3, 1]
];

// Bob Ross distant Carpathian peaks: [peakXRatio, heightRatioOfHorizon, halfSpanRatio]
const MOUNTAIN_PEAKS = [
    [0.10, 0.30, 0.14],
    [0.26, 0.48, 0.19],
    [0.44, 0.34, 0.16],
    [0.76, 0.42, 0.18],
    [0.91, 0.28, 0.14]
];

// 4 Clock hand offsets [dx, dy] in clock-radius units
const CLOCK_HANDS = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0]
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

const PATH_TORCH_DEPTHS = [0.16, 0.36, 0.60, 0.84];

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
        this.windPhase = 0;
        this.torchPhase = 0;
        this.waterPhase = 0;
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
        this.lightningX = 0.3;

        // Pre-allocated firework burst pool (Zero-GC)
        this.bursts = Array.from({ length: MAX_BURSTS }, () => ({
            x: 0,
            y: 0,
            launchY: 0,
            startTime: -Infinity,
            color: COLORS.yellow,
            secondaryColor: COLORS.orange,
            strength: 0,
            tier: 0,
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

    castleRect(ctx, left, top, cw, ch, x1, y1, w, h, color) {
        this.rect(ctx, left + cw * x1, top + ch * y1, cw * w, ch * h, color);
    }

    // Subtle 2-line C64 VIC-II raster split (avoids thick zebra striping)
    drawSubtleRasterSplit(ctx, width, splitY, colorTop, colorBottom) {
        const u = this.pixelSize;
        const sy = this.snap(splitY);
        this.rect(ctx, 0, sy - u, width, u, colorBottom);
        this.rect(ctx, 0, sy, width, u, colorTop);
    }

    // Draws a gothic spire roof with Bob Ross directional moon-lighting on the left edge
    drawGothicSpire(ctx, left, top, cw, ch, centerXRatio, baseYRatio, baseWidthRatio, spireHeightRatio, rimColor) {
        const steps = 6;
        const stepH = spireHeightRatio / steps;
        for (let s = 0; s < steps; s++) {
            const progress = s / steps;
            const currentW = baseWidthRatio * (1 - progress * 0.82);
            const rx = centerXRatio - currentW * 0.5;
            const ry = baseYRatio - (s + 1) * stepH;

            // Core slate roof in black/darkBlue so it pops against any purple/blue sky
            this.castleRect(ctx, left, top, cw, ch, rx, ry, currentW, stepH + 0.005, COLORS.black);
            // Right shadow side
            this.castleRect(ctx, left, top, cw, ch, centerXRatio, ry, currentW * 0.5, stepH, COLORS.darkBlue);
            // Left moonlit edge
            this.castleRect(ctx, left, top, cw, ch, rx, ry, Math.max(0.012, currentW * 0.22), stepH, rimColor);
        }
    }

    updateAudioState(dt, t, state, metrics) {
        const rawTension = Number.isFinite(metrics?.tension)
            ? metrics.tension
            : (Number.isFinite(metrics?.energy)
                ? metrics.energy
                : (state === 'climax' ? 0.88 : state === 'afterglow' ? 0.20 : 0.40));
        const targetTension = clamp(rawTension, 0, 1);
        this.tension += (targetTension - this.tension) * clamp(dt * 3.5, 0, 1);

        this.beatPulse = Math.max(0, this.beatPulse - dt * 2.8);
        this.heavyPulse = Math.max(0, this.heavyPulse - dt * 3.2);
        this.lightningTimer = Math.max(0, this.lightningTimer - dt);

        this.windPhase = (this.windPhase + dt * (1.2 + this.tension * 3.0)) % 628.318;
        this.torchPhase = (this.torchPhase + dt * (9.0 + this.tension * 7.0 + this.beatPulse * 8.0)) % 628.318;
        this.waterPhase = (this.waterPhase + dt * (4.0 + this.tension * 5.0 + this.beatPulse * 4.0)) % 628.318;
        this.cloudOffset = (this.cloudOffset + dt * Math.min(this.width, this.height) * (0.018 + this.tension * 0.02)) % Math.max(1, this.width);

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

                // Trigger Carpathian Lightning on heavy beats + high tension
                if ((strength >= 0.76 && this.tension >= 0.50) || (state === 'climax' && beatCount % 4 === 0 && strength >= 0.58)) {
                    this.lightningTimer = 0.24;
                    this.lightningX = (beatCount & 1) === 0 ? this.width * 0.27 : this.width * 0.78;
                }

                // Spawn vampire bats from the Clock Tower & Keep
                const batCountToSpawn = strength >= 0.70 ? 2 : (strength >= 0.35 || this.tension >= 0.52 ? 1 : 0);
                for (let s = 0; s < batCountToSpawn; s++) {
                    this.spawnBat(beatCount + s, strength);
                }

                // Firework cadence
                const cadence = (state === 'climax' || this.tension >= 0.65 || strength >= 0.72)
                    ? 1
                    : (state === 'afterglow' ? 4 : 2);

                if (beatCount % cadence === 0 && strength >= 0.15) {
                    this.addBurst(this.width, this.height, t, beatCount, strength, 0);

                    if ((strength >= 0.76 && this.tension >= 0.42) || (state === 'climax' && strength >= 0.60 && beatCount % 2 === 0)) {
                        this.addBurst(this.width, this.height, t, beatCount + 3, strength * 0.92, 1);
                    }
                }
            }
        }
    }

    drawSky(ctx, width, height, t) {
        // 1. Deep night sky base
        ctx.fillStyle = COLORS.black;
        ctx.fillRect(0, 0, width, height);

        const horizon = this.floorY;
        const u = this.pixelSize;

        // Calm, atmospheric C64 sky zones (avoids noisy zebra bars across the moon)
        const band0 = Math.floor(horizon * 0.22);
        const band1 = Math.floor(horizon * 0.54);
        const crimsonH = this.tension > 0.35 ? Math.floor(horizon * (this.tension - 0.35) * 0.36) : 0;
        const band2 = Math.max(band1 + u * 4, horizon - crimsonH);

        if (band1 > band0) {
            ctx.fillStyle = COLORS.darkBlue;
            ctx.fillRect(0, band0, width, band1 - band0);
            this.drawSubtleRasterSplit(ctx, width, band0, COLORS.black, COLORS.darkBlue);
        }

        if (band2 > band1) {
            ctx.fillStyle = COLORS.purple;
            ctx.fillRect(0, band1, width, band2 - band1);
            this.drawSubtleRasterSplit(ctx, width, band1, COLORS.darkBlue, COLORS.purple);
        }

        if (horizon > band2) {
            const horizonGlow = this.tension > 0.72 && this.heavyPulse > 0.3 ? COLORS.red : COLORS.brown;
            ctx.fillStyle = horizonGlow;
            ctx.fillRect(0, band2, width, horizon - band2);
            this.drawSubtleRasterSplit(ctx, width, band2, COLORS.purple, horizonGlow);
        }

        // 2. Lightning Flash & Forked Bolt
        if (this.lightningTimer > 0) {
            if ((Math.floor(this.lightningTimer * 36) & 1) === 0) {
                this.rect(ctx, 0, u * 2, width, u, COLORS.lightBlue);
                this.rect(ctx, 0, band0, width, u, COLORS.white);
            }
            this.drawLightningBolt(ctx, this.lightningX, horizon);
        }

        // 3. Twinkling Stars
        const twinkle = Math.floor(t * (3 + this.tension * 3));
        const starBoost = this.beatPulse > 0.55;
        for (let i = 0; i < STAR_POSITIONS.length; i++) {
            const nx = STAR_POSITIONS[i][0];
            const ny = STAR_POSITIONS[i][1];
            const x = this.snap(nx * width);
            const y = this.snap(ny * horizon);
            if (y >= horizon - u * 4) continue;

            const isSparkle = (i + twinkle) % 6 === 0 || (starBoost && i % 3 === 0);
            const color = isSparkle
                ? COLORS.white
                : (i % 3 === 0 ? COLORS.lightBlue : COLORS.lightGrey);
            this.rect(ctx, x, y, u, u, color);

            if (isSparkle && (i % 5 === 0 || starBoost)) {
                this.rect(ctx, x - u, y, u, u, COLORS.lightBlue);
                this.rect(ctx, x + u, y, u, u, COLORS.lightBlue);
            }
        }

        // 4. True Unmasked Crescent Moon in Upper-Left Golden Zone
        this.drawMoon(ctx, width, height);

        // 5. Drifting Night Clouds
        this.drawCloud(ctx, width, height, 0.34, 0.14, 34, 0.12);
        this.drawCloud(ctx, width, height, 0.76, 0.24, 26, -0.09);
    }

    drawLightningBolt(ctx, startX, horizon) {
        const u = this.pixelSize;
        let cx = this.snap(startX);
        const maxY = horizon * 0.68;
        let step = 0;

        for (let y = 0; y < maxY; y += u * 2) {
            const zig = ((step * 5 + 3) % 7) - 3;
            cx += zig * u;
            this.rect(ctx, cx, y, u, u * 2, COLORS.white);
            this.rect(ctx, cx + u, y, u, u * 2, COLORS.lightBlue);

            if (step === 3 || step === 7) {
                const dir = step === 3 ? -1 : 1;
                for (let b = 1; b <= 3; b++) {
                    this.rect(ctx, cx + dir * b * u * 2, y + b * u * 2, u, u * 2, COLORS.lightBlue);
                }
            }
            step++;
        }
    }

    drawMoon(ctx, width, height) {
        const u = Math.max(this.pixelSize, Math.floor(Math.min(width, height) / 100));
        // Positioned in the upper-left Golden Ratio zone
        const mx = Math.floor((width * 0.16) / u) * u;
        const my = Math.floor((this.floorY * 0.13) / u) * u;

        const isBloodMoon = this.tension > 0.74;
        const bodyColor = isBloodMoon && this.heavyPulse > 0.25 ? COLORS.orange : COLORS.yellow;
        const rimColor = isBloodMoon ? COLORS.yellow : COLORS.white;

        // Draw only the true crescent pixels (no fake sky-mask rectangles!)
        for (let row = 0; row < CRESCENT_ROWS.length; row++) {
            const offsetX = CRESCENT_ROWS[row][0];
            const totalW = CRESCENT_ROWS[row][1];
            const hiW = CRESCENT_ROWS[row][2];

            this.rect(ctx, mx + offsetX * u, my + row * u, totalW * u, u, bodyColor);
            this.rect(ctx, mx + offsetX * u, my + row * u, hiW * u, u, rimColor);
        }

        // Sharp upper and lower crescent horn tips
        this.rect(ctx, mx + 6 * u, my, u, u, bodyColor);
        this.rect(ctx, mx + 6 * u, my + 8 * u, u, u, bodyColor);

        // Subtle outer lunar aura on strong beats
        if (this.beatPulse > 0.45 || this.tension > 0.60) {
            const auraCol = isBloodMoon ? COLORS.lightRed : COLORS.lightBlue;
            this.rect(ctx, mx - u, my + 3 * u, u, 3 * u, auraCol);
            this.rect(ctx, mx + u, my - u, 2 * u, u, auraCol);
            this.rect(ctx, mx + u, my + 9 * u, 2 * u, u, auraCol);
        }
    }

    drawCloud(ctx, width, height, baseX, baseY, logicalWidth, speed) {
        const scale = Math.max(this.pixelSize, Math.floor(Math.min(width / 320, height / 200) * 2));
        const cloudWidth = logicalWidth * scale;
        const travel = width + cloudWidth;
        const x = ((baseX * width + this.cloudOffset * speed) % travel + travel) % travel - cloudWidth / 2;
        const y = baseY * this.floorY;

        const topRim = this.lightningTimer > 0 ? COLORS.lightBlue : COLORS.grey;
        this.rect(ctx, x + cloudWidth * 0.18, y, cloudWidth * 0.36, scale, topRim);
        this.rect(ctx, x + cloudWidth * 0.08, y + scale, cloudWidth * 0.76, scale * 2, COLORS.darkGrey);
        this.rect(ctx, x, y + scale * 3, cloudWidth, scale, COLORS.black);
    }

    drawMountains(ctx, width) {
        // =========================================================
        // BOB ROSS PALETTE-KNIFE CARPATHIAN MOUNTAINS
        // Left slopes catch cold moonlight (lightBlue/grey/purple),
        // right slopes fall into deep shadow (darkBlue/black).
        // =========================================================
        const horizon = this.floorY;
        const u = this.pixelSize;

        for (let p = 0; p < MOUNTAIN_PEAKS.length; p++) {
            const peakX = MOUNTAIN_PEAKS[p][0] * width;
            const peakH = MOUNTAIN_PEAKS[p][1] * horizon;
            const halfSpan = MOUNTAIN_PEAKS[p][2] * width;
            const startX = Math.max(0, this.snap(peakX - halfSpan));
            const endX = Math.min(width, this.snap(peakX + halfSpan));

            for (let x = startX; x < endX; x += u) {
                const dist = x - peakX;
                const normDist = Math.abs(dist) / halfSpan;
                if (normDist >= 1) continue;

                // Jagged ridge profile
                const ridgeJag = Math.sin(normDist * Math.PI * 3.0) * (u * 1.5);
                const colH = Math.max(u, Math.floor(peakH * (1 - Math.pow(normDist, 0.82)) + ridgeJag));
                const colTop = horizon - colH;

                if (dist < 0) {
                    // LEFT SLOPE: Illuminated by the Moon!
                    const bodyCol = (p & 1) === 0 ? COLORS.darkBlue : COLORS.black;
                    const ridgeCol = this.lightningTimer > 0
                        ? COLORS.white
                        : (normDist < 0.35 ? COLORS.lightGrey : COLORS.lightBlue);
                    const subRidgeCol = normDist < 0.55 ? COLORS.grey : COLORS.purple;

                    this.rect(ctx, x, colTop, u, colH, bodyCol);
                    this.rect(ctx, x, colTop, u, u, ridgeCol);
                    if (colH > u * 3) {
                        this.rect(ctx, x, colTop + u, u, u * 2, subRidgeCol);
                    }
                    // Bob Ross diagonal snow/rock striation
                    if (colH > u * 7 && ((Math.floor(x / u) + p) % 3 === 0)) {
                        this.rect(ctx, x, colTop + u * 4, u, u * 2, COLORS.purple);
                    }
                } else {
                    // RIGHT SLOPE: Deep Mountain Shadow
                    this.rect(ctx, x, colTop, u, colH, COLORS.black);
                    this.rect(ctx, x, colTop, u, u, COLORS.darkBlue);
                    if (colH > u * 5 && (Math.floor(x / u) & 1) === 0) {
                        this.rect(ctx, x, colTop + u * 2, u, u * 2, COLORS.darkGrey);
                    }
                }
            }
        }
    }

    spawnBat(seed, strength) {
        const bat = this.bats[this.batCursor];
        this.batCursor = (this.batCursor + 1) % MAX_BATS;

        const dir = (seed & 1) === 0 ? -1 : 1;
        bat.active = true;
        // Fly out from the Golden-Ratio Keep & Clock Tower
        bat.x = this.width * (0.58 + dir * 0.04);
        bat.y = this.floorY * (0.28 + ((seed * 3) % 5) * 0.06);
        const speed = Math.min(this.width, this.height) * (0.09 + strength * 0.08 + this.tension * 0.05);
        bat.vx = dir * speed;
        bat.vy = -speed * (0.16 + (seed % 3) * 0.07);
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

            this.rect(ctx, bat.x, bobY, u, u, COLORS.black);
            if (wingState === 0) {
                this.rect(ctx, bat.x - u, bobY - u, u, u, COLORS.black);
                this.rect(ctx, bat.x + u, bobY - u, u, u, COLORS.black);
                this.rect(ctx, bat.x - u * 2, bobY - u * 2, u, u, COLORS.lightGrey);
                this.rect(ctx, bat.x + u * 2, bobY - u * 2, u, u, COLORS.darkGrey);
            } else {
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

        const effectiveStrength = clamp(strength + this.tension * 0.15, 0, 1);
        const tier = effectiveStrength >= 0.72 ? 2 : (effectiveStrength >= 0.40 ? 1 : 0);

        burst.x = width * (0.20 + lane * 0.082);
        burst.y = this.floorY * (0.14 + verticalBand * 0.14);
        burst.launchY = this.floorY * 0.70;
        burst.startTime = t;
        burst.color = BURST_COLORS[colorIndex];
        burst.secondaryColor = SECONDARY_COLORS[colorIndex];
        burst.strength = strength;
        burst.tier = tier;
        burst.duration = 0.72 + strength * 0.45 + (tier === 2 ? 0.20 : 0);
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

            if (progress < 0.65 && age < freshestAge) {
                freshestAge = age;
                this.activeRimColor = progress < 0.15 ? COLORS.white : burst.color;
            }

            // Ascending mortar rocket trail
            if (progress < 0.18) {
                const trailProgress = progress / 0.18;
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

            if (progress < 0.22) {
                const flashSpan = burst.tier === 2 ? 3 : 2;
                this.rect(ctx, burst.x - u * flashSpan, burst.y, u * (flashSpan * 2 + 1), u, COLORS.white);
                this.rect(ctx, burst.x, burst.y - u * flashSpan, u, u * (flashSpan * 2 + 1), COLORS.white);
                if (burst.tier >= 1) {
                    this.rect(ctx, burst.x - u, burst.y - u, u * 3, u * 3, burst.color);
                }
            }

            const step = burst.particleCount === 8 ? 2 : 1;
            for (let i = 0; i < activeCount; i++) {
                const dirIdx = (i * step) % DIRECTIONS.length;
                const dx = DIRECTIONS[dirIdx][0];
                const dy = DIRECTIONS[dirIdx][1];

                const px = burst.x + (dx * radius) / 100;
                const py = burst.y + (dy * radius) / 100 + gravity;

                const isCrackle = burst.tier === 2 && progress > 0.58 && ((i + Math.floor(t * 24)) % 3 === 0);
                const headColor = isCrackle
                    ? COLORS.white
                    : ((progress < 0.30 && i % 4 === 0)
                        ? COLORS.white
                        : (progress > 0.68 ? burst.secondaryColor : burst.color));

                if (progress < 0.72) {
                    const tailDist = Math.max(0, radius - u * 2.5);
                    const tailX = burst.x + (dx * tailDist) / 100;
                    const tailY = burst.y + (dy * tailDist) / 100 + gravity * 0.84;
                    this.rect(ctx, tailX, tailY, u, u, burst.secondaryColor);

                    if (burst.tier === 2 && radius > u * 5) {
                        const deepDist = Math.max(0, radius - u * 5.0);
                        const deepX = burst.x + (dx * deepDist) / 100;
                        const deepY = burst.y + (dy * deepDist) / 100 + gravity * 0.68;
                        this.rect(ctx, deepX, deepY, u, u, COLORS.brown);
                    }
                }

                this.rect(ctx, px, py, u, u, headColor);

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

        this.rect(ctx, tx, ty + u, u, u * 2, COLORS.brown);
        this.rect(ctx, tx, ty, u * flameScale, u, COLORS.red);
        this.rect(ctx, tx + (flicker > 0.3 ? u * 0.5 : 0), ty - u, u * flameScale, u, COLORS.orange);
        this.rect(ctx, tx, ty - u * 2 - beatBoost, u, u + beatBoost, this.beatPulse > 0.5 ? COLORS.white : COLORS.yellow);
    }

    drawCastle(ctx, width) {
        // =========================================================
        // GOLDEN RATIO CASTLEVANIA CITADEL (Flush on this.floorY)
        // - Asymmetric silhouette with soaring Keep at x ≈ 0.58 (Phi)
        // - Left Viaduct arches over the mountain stream
        // - Right Clock Tower connected via high Gothic Skybridge
        // - Directional moonlight on left edges, deep shadow on right
        // =========================================================
        const horizon = this.floorY;
        const u = this.pixelSize;

        const cw = Math.min(Math.floor(width * 0.72), Math.floor(horizon * 1.75));
        const ch = Math.min(Math.floor(horizon * 0.88), Math.floor(cw * 0.82));
        const left = Math.floor(width * 0.52 - cw * 0.5);
        const top = horizon - ch;

        const stone = COLORS.darkGrey;
        const litStone = this.lightningTimer > 0 ? COLORS.white : COLORS.grey;
        const moonRim = this.lightningTimer > 0
            ? COLORS.white
            : (this.activeRimColor !== null && this.beatPulse > 0.40 ? this.activeRimColor : COLORS.lightGrey);
        const shade = COLORS.black;

        // 1. Left Gothic Viaduct & Ruined Watchtower (x: 0.02 .. 0.30)
        this.castleRect(ctx, left, top, cw, ch, 0.04, 0.72, 0.26, 0.06, stone);
        this.castleRect(ctx, left, top, cw, ch, 0.04, 0.70, 0.26, 0.02, moonRim);
        // Viaduct Pillars standing flush on horizon (leaving open arches for the stream!)
        this.castleRect(ctx, left, top, cw, ch, 0.04, 0.78, 0.04, 0.22, stone);
        this.castleRect(ctx, left, top, cw, ch, 0.12, 0.78, 0.04, 0.22, stone);
        this.castleRect(ctx, left, top, cw, ch, 0.20, 0.78, 0.05, 0.22, shade);

        // Left Flanking Bastion Tower (x: 0.18 .. 0.32)
        this.castleRect(ctx, left, top, cw, ch, 0.18, 0.44, 0.14, 0.56, shade);
        this.castleRect(ctx, left, top, cw, ch, 0.18, 0.44, 0.09, 0.56, stone);
        this.castleRect(ctx, left, top, cw, ch, 0.18, 0.44, 0.03, 0.56, litStone); // Moonlit left wall
        this.castleRect(ctx, left, top, cw, ch, 0.16, 0.41, 0.18, 0.03, moonRim);
        this.drawGothicSpire(ctx, left, top, cw, ch, 0.25, 0.41, 0.15, 0.22, moonRim);

        // 2. Central Great Hall & Portcullis Gatehouse (x: 0.28 .. 0.54)
        this.castleRect(ctx, left, top, cw, ch, 0.28, 0.50, 0.26, 0.50, shade);
        this.castleRect(ctx, left, top, cw, ch, 0.29, 0.50, 0.20, 0.50, stone);
        this.castleRect(ctx, left, top, cw, ch, 0.29, 0.50, 0.03, 0.50, litStone);
        // Stepped Cathedral Gable Roof
        this.drawGothicSpire(ctx, left, top, cw, ch, 0.41, 0.50, 0.24, 0.18, moonRim);

        // 3. The Soaring Dracula Keep (Golden Ratio Focal Point, x: 0.48 .. 0.68)
        this.castleRect(ctx, left, top, cw, ch, 0.48, 0.22, 0.20, 0.78, shade);
        this.castleRect(ctx, left, top, cw, ch, 0.48, 0.22, 0.14, 0.78, stone);
        this.castleRect(ctx, left, top, cw, ch, 0.48, 0.22, 0.04, 0.78, litStone); // Strong moonlit edge

        // Keep Cantilevered Machicolations & Battlements
        this.castleRect(ctx, left, top, cw, ch, 0.46, 0.19, 0.24, 0.04, moonRim);
        for (let i = 0; i < 4; i++) {
            this.castleRect(ctx, left, top, cw, ch, 0.47 + i * 0.06, 0.15, 0.035, 0.04, moonRim);
        }

        // Upper Dracula Belfry & Needle Spire (reaches y = 0.00)
        this.castleRect(ctx, left, top, cw, ch, 0.51, 0.10, 0.14, 0.09, stone);
        this.castleRect(ctx, left, top, cw, ch, 0.51, 0.10, 0.03, 0.09, litStone);
        this.drawGothicSpire(ctx, left, top, cw, ch, 0.58, 0.10, 0.15, 0.12, moonRim);
        // High Cross Finial
        this.castleRect(ctx, left, top, cw, ch, 0.575, -0.05, 0.015, 0.04, COLORS.white);
        this.castleRect(ctx, left, top, cw, ch, 0.56, -0.04, 0.045, 0.015, COLORS.white);

        // 4. High Gothic Skybridge & Right Clock Tower (x: 0.68 .. 0.90)
        // Skybridge arch connecting Keep to Clock Tower
        this.castleRect(ctx, left, top, cw, ch, 0.67, 0.44, 0.10, 0.05, stone);
        this.castleRect(ctx, left, top, cw, ch, 0.67, 0.43, 0.10, 0.015, moonRim);

        // Slender Clock Tower (x: 0.75 .. 0.90)
        this.castleRect(ctx, left, top, cw, ch, 0.75, 0.30, 0.15, 0.70, shade);
        this.castleRect(ctx, left, top, cw, ch, 0.75, 0.30, 0.10, 0.70, stone);
        this.castleRect(ctx, left, top, cw, ch, 0.75, 0.30, 0.03, 0.70, litStone);
        this.castleRect(ctx, left, top, cw, ch, 0.73, 0.27, 0.19, 0.03, moonRim);
        this.drawGothicSpire(ctx, left, top, cw, ch, 0.825, 0.27, 0.17, 0.19, moonRim);

        // Waving Crimson Pennants on Spires (synced to windPhase)
        const bannerWave = Math.sin(this.windPhase * 2.5) > 0 ? 0.012 : -0.012;
        const bannerColor = this.beatPulse > 0.60 ? COLORS.lightRed : COLORS.red;
        this.castleRect(ctx, left, top, cw, ch, 0.25, 0.18, 0.035, 0.02, bannerColor);
        this.castleRect(ctx, left, top, cw, ch, 0.285, 0.18 + bannerWave, 0.03, 0.02, bannerColor);
        this.castleRect(ctx, left, top, cw, ch, 0.825, 0.07, 0.035, 0.02, bannerColor);
        this.castleRect(ctx, left, top, cw, ch, 0.86, 0.07 - bannerWave, 0.03, 0.02, bannerColor);

        // 5. Beat-Ticking Clock Face on the Right Clock Tower
        const clockX = left + cw * 0.80;
        const clockY = top + ch * 0.35;
        this.rect(ctx, clockX, clockY, u * 5, u * 5, COLORS.orange);
        this.rect(ctx, clockX + u, clockY + u, u * 3, u * 3, this.beatPulse > 0.4 ? COLORS.white : COLORS.yellow);
        const handIdx = Math.max(0, this.lastBeatCount) & 3;
        const hdx = CLOCK_HANDS[handIdx][0];
        const hdy = CLOCK_HANDS[handIdx][1];
        this.rect(ctx, clockX + u * 2, clockY + u * 2, u, u, COLORS.black);
        this.rect(ctx, clockX + u * (2 + hdx), clockY + u * (2 + hdy), u, u, COLORS.red);

        // 6. Gothic Windows & Dracula's Chamber
        const isHighTension = this.tension > 0.58;
        const winRim = isHighTension ? COLORS.red : COLORS.orange;
        const winCore = this.heavyPulse > 0.45
            ? COLORS.white
            : (this.beatPulse > 0.35 ? COLORS.yellow : (isHighTension ? COLORS.lightRed : COLORS.yellow));

        // Keep Grand Stained Glass Window
        this.castleRect(ctx, left, top, cw, ch, 0.53, 0.32, 0.09, 0.18, winRim);
        this.castleRect(ctx, left, top, cw, ch, 0.54, 0.34, 0.07, 0.14, winCore);
        this.castleRect(ctx, left, top, cw, ch, 0.555, 0.30, 0.04, 0.03, winCore);
        this.castleRect(ctx, left, top, cw, ch, 0.57, 0.32, 0.015, 0.18, shade);
        this.castleRect(ctx, left, top, cw, ch, 0.53, 0.39, 0.09, 0.02, shade);

        // Dracula's Upper Chamber Window (with dark Count silhouette)
        this.castleRect(ctx, left, top, cw, ch, 0.55, 0.12, 0.05, 0.05, this.heavyPulse > 0.3 ? COLORS.lightRed : COLORS.yellow);
        this.castleRect(ctx, left, top, cw, ch, 0.57, 0.13, 0.015, 0.04, shade);

        // Left & Cathedral Lancet Windows
        const beatAlt = (this.lastBeatCount & 1) === 0;
        this.castleRect(ctx, left, top, cw, ch, 0.22, 0.52, 0.04, 0.09, beatAlt ? winCore : winRim);
        this.castleRect(ctx, left, top, cw, ch, 0.38, 0.56, 0.06, 0.10, beatAlt ? winRim : winCore);
        this.castleRect(ctx, left, top, cw, ch, 0.405, 0.56, 0.012, 0.10, shade);
        this.castleRect(ctx, left, top, cw, ch, 0.80, 0.54, 0.04, 0.09, beatAlt ? winCore : COLORS.orange);

        // 7. Rocky Crags Base & Main Portcullis Gate (x: 0.35 .. 0.47, Flush on floorY)
        this.castleRect(ctx, left, top, cw, ch, 0.16, 0.86, 0.76, 0.14, shade);
        this.castleRect(ctx, left, top, cw, ch, 0.14, 0.88, 0.12, 0.12, stone);
        this.castleRect(ctx, left, top, cw, ch, 0.14, 0.88, 0.04, 0.12, litStone);
        this.castleRect(ctx, left, top, cw, ch, 0.84, 0.88, 0.10, 0.12, stone);

        // Portcullis Archway
        const gateGlow = this.heavyPulse > 0.4 ? COLORS.orange : (this.beatPulse > 0.25 ? COLORS.brown : shade);
        this.castleRect(ctx, left, top, cw, ch, 0.35, 0.74, 0.12, 0.26, shade);
        this.castleRect(ctx, left, top, cw, ch, 0.37, 0.70, 0.08, 0.05, shade);
        this.castleRect(ctx, left, top, cw, ch, 0.36, 0.90, 0.10, 0.10, gateGlow);

        // Iron Portcullis Bars
        this.castleRect(ctx, left, top, cw, ch, 0.38, 0.74, 0.015, 0.26, COLORS.darkGrey);
        this.castleRect(ctx, left, top, cw, ch, 0.425, 0.74, 0.015, 0.26, COLORS.darkGrey);
        this.castleRect(ctx, left, top, cw, ch, 0.35, 0.82, 0.12, 0.02, COLORS.darkGrey);
        this.castleRect(ctx, left, top, cw, ch, 0.35, 0.90, 0.12, 0.02, COLORS.darkGrey);

        // Gate & Battlement Torches
        this.drawTorchFlame(ctx, left + cw * 0.33, top + ch * 0.80, 1, 0.0);
        this.drawTorchFlame(ctx, left + cw * 0.48, top + ch * 0.80, 1, 1.7);
        this.drawTorchFlame(ctx, left + cw * 0.50, top + ch * 0.45, 1, 3.2);
        this.drawTorchFlame(ctx, left + cw * 0.72, top + ch * 0.42, 1, 4.8);
    }

    drawBobRossEvergreen(ctx, baseX, baseY, treeH) {
        // =========================================================
        // BOB ROSS FAN-BRUSH EVERGREEN TREE
        // Dense triangular pixel foliage with darkBlue/black shadow
        // on the right and moonlit green/lightGreen/lightBlue tips on left.
        // =========================================================
        const u = this.pixelSize;
        const topY = baseY - treeH;
        const sway = Math.round(Math.sin(this.windPhase + baseX * 0.03)) * u;

        // Trunk base
        this.rect(ctx, baseX, baseY - u * 3, u * 2, u * 3, COLORS.brown);

        for (let y = topY; y < baseY - u * 2; y += u) {
            const progress = (y - topY) / Math.max(1, treeH - u * 2);
            const rowIndex = Math.floor((y - topY) / u);
            // Tiered branch flare every 2 rows
            const tierFlare = (rowIndex % 2 === 0) ? u : 0;
            const halfW = Math.floor(progress * u * 5.5) + tierFlare;
            const rowSway = progress < 0.35 ? sway : 0;
            const cx = baseX + rowSway;

            // Shadowed core and right side
            this.rect(ctx, cx - halfW, y, halfW * 2 + u, u, COLORS.black);
            this.rect(ctx, cx, y, halfW + u, u, COLORS.darkBlue);

            // Moonlit left foliage boughs
            const litW = Math.max(u, Math.floor(halfW * 0.65));
            this.rect(ctx, cx - halfW, y, litW, u, COLORS.green);

            // Brightest moonlit needle tips on left outer edge
            if (rowIndex % 2 === 0) {
                const tipCol = this.lightningTimer > 0
                    ? COLORS.white
                    : (progress < 0.4 ? COLORS.lightBlue : COLORS.lightGreen);
                this.rect(ctx, cx - halfW, y, u, u, tipCol);
            }
        }
    }

    drawRepoussoirOak(ctx, baseX, baseY, treeH) {
        // =========================================================
        // FOREGROUND REPOUSSOIR GNARLED OAK TREE (Left Frame)
        // Thick 3-pixel trunk with brown/grey moonlit bark on the
        // left, black shadow on the right, and organic boughs
        // reaching high into the night sky.
        // =========================================================
        const u = this.pixelSize;
        const trunkH = Math.floor(treeH * 0.56);
        const sway = Math.round(Math.sin(this.windPhase)) * u;

        // 1. Thick organic roots gripping the foreground knoll
        this.rect(ctx, baseX - u * 4, baseY, u * 8, u * 2, COLORS.black);
        this.rect(ctx, baseX - u * 4, baseY, u * 3, u, COLORS.brown);
        this.rect(ctx, baseX - u * 2, baseY - u, u * 5, u, COLORS.brown);

        // 2. Gnarled twisting trunk
        for (let y = baseY - u; y > baseY - trunkH; y -= u) {
            const p = (baseY - y) / trunkH;
            const curve = Math.floor(Math.sin(p * Math.PI * 1.3) * u * 2.5);
            const tx = baseX + curve;
            const tw = p < 0.45 ? u * 3 : u * 2;

            this.rect(ctx, tx, y, tw, u, COLORS.black);
            this.rect(ctx, tx, y, u, u, COLORS.grey); // Moonlit bark edge
            if (tw >= u * 3) {
                this.rect(ctx, tx + u, y, u, u, COLORS.brown);
            }
        }

        const crownY = baseY - trunkH;
        const crownX = baseX + u;

        // Glowing Owl Eyes in the trunk hollow
        if (this.beatPulse > 0.2 || (Math.floor(this.windPhase * 2) % 5 !== 0)) {
            const eyeCol = this.tension > 0.65 ? COLORS.lightRed : COLORS.yellow;
            this.rect(ctx, crownX, crownY + u * 3, u, u, eyeCol);
            this.rect(ctx, crownX + u * 2, crownY + u * 3, u, u, eyeCol);
        }

        // 3. Sweeping Main Boughs reaching toward the Moon & Castle
        const boughLen = Math.floor(treeH * 0.46);
        for (let i = 0; i < boughLen; i += u) {
            const bp = i / boughLen;
            const tipSway = bp > 0.6 ? sway : 0;

            // Right-reaching dramatic bough
            const rx = crownX + i + tipSway;
            const ry = crownY - Math.floor(i * 0.72) + Math.floor(Math.sin(bp * Math.PI * 2) * u * 1.5);
            this.rect(ctx, rx, ry, u * 2, u, COLORS.black);
            this.rect(ctx, rx, ry - u, u, u, COLORS.darkGrey);

            // Left-reaching high bough
            if (i < boughLen * 0.8) {
                const lx = crownX - Math.floor(i * 0.75) + tipSway;
                const ly = crownY - Math.floor(i * 0.85);
                this.rect(ctx, lx, ly, u * 2, u, COLORS.black);
                this.rect(ctx, lx, ly - u, u, u, COLORS.grey);
            }
        }

        // 4. Dark twilight moss/foliage clusters on the boughs
        this.rect(ctx, crownX - u * 6 + sway, crownY - Math.floor(boughLen * 0.75), u * 5, u * 2, COLORS.black);
        this.rect(ctx, crownX - u * 6 + sway, crownY - Math.floor(boughLen * 0.75) - u, u * 3, u, COLORS.darkBlue);
        this.rect(ctx, crownX + Math.floor(boughLen * 0.65) + sway, crownY - Math.floor(boughLen * 0.55), u * 6, u * 2, COLORS.black);
        this.rect(ctx, crownX + Math.floor(boughLen * 0.65) + sway, crownY - Math.floor(boughLen * 0.55) - u, u * 3, u, COLORS.darkBlue);
    }

    drawForeground(ctx, width, height) {
        // =========================================================
        // BOB ROSS FOREGROUND COMPOSITION
        // 1. Organic layered hillside contours (no polka-dot grid!)
        // 2. Shimmering moonlit mountain stream & waterfall on left
        // 3. Golden-Ratio winding cobblestone road & stone bridge
        // 4. Beat-chasing medieval torch posts
        // 5. Layered evergreens on right & Repoussoir oak on left
        // =========================================================
        const horizon = this.floorY;
        const fgHeight = height - horizon;
        if (fgHeight <= 0) return;

        const u = this.pixelSize;

        // 1. Deep Night Ground Base
        ctx.fillStyle = COLORS.black;
        ctx.fillRect(0, horizon, width, fgHeight);

        // 2. Asymmetric Flanking Foothills rising slightly above horizon
        const leftHillSpan = Math.floor(width * 0.25);
        for (let x = 0; x < leftHillSpan; x += u) {
            const p = x / Math.max(1, leftHillSpan);
            const hillH = Math.floor(fgHeight * (0.14 * Math.sin(p * Math.PI)));
            if (hillH > 0) {
                this.rect(ctx, x, horizon - hillH, u, hillH, COLORS.black);
                this.rect(ctx, x, horizon - hillH, u, u, COLORS.darkBlue);
            }
        }

        const rightHillStart = Math.floor(width * 0.74);
        for (let x = rightHillStart; x < width; x += u) {
            const p = (x - rightHillStart) / Math.max(1, width - rightHillStart);
            const hillH = Math.floor(fgHeight * (0.20 * Math.sin(p * Math.PI * 0.85)));
            if (hillH > 0) {
                this.rect(ctx, x, horizon - hillH, u, hillH, COLORS.black);
                this.rect(ctx, x, horizon - hillH, u, u, COLORS.green);
                this.rect(ctx, x, horizon - hillH + u, u, u, COLORS.darkBlue);
            }
        }

        // 3. Organic Layered Hillside Terraces (Replaces the artificial dot matrix)
        for (let y = horizon; y < height; y += u) {
            const depth = (y - horizon) / Math.max(1, fgHeight);
            const rowIdx = Math.floor((y - horizon) / u);

            // Sweeping organic contour wave
            const wavePhase = Math.sin(depth * 14.0) * 0.04;
            if ((rowIdx % 3) === 0) {
                // Left mossy meadow terrace contour
                const leftSegW = width * (0.28 + wavePhase - depth * 0.08);
                const leftColor = depth < 0.45 ? COLORS.darkBlue : COLORS.green;
                this.rect(ctx, width * 0.03, y, leftSegW * 0.35, u, leftColor);
                this.rect(ctx, width * 0.24, y, leftSegW * 0.40, u, COLORS.darkGrey);

                // Right hillside foliage & warm earth contour
                const rightStart = width * (0.56 + depth * 0.14 + wavePhase);
                const rightColor = (rowIdx % 6 === 0) ? COLORS.green : COLORS.brown;
                this.rect(ctx, rightStart, y, width - rightStart - u * 2, u, COLORS.darkBlue);
                this.rect(ctx, rightStart + u * 3, y, (width - rightStart) * 0.45, u, rightColor);
            }
        }

        // 4. Bob Ross Shimmering Moonlit Mountain Stream (Left Valley)
        // Cascades from under the Castle Viaduct (x ≈ 0.23) down into the foreground
        for (let y = horizon; y < height; y += u) {
            const depth = (y - horizon) / Math.max(1, fgHeight);
            const streamX = width * (0.23 - depth * 0.09 + Math.sin(depth * Math.PI * 2.6) * 0.028);
            const streamW = u * (2 + Math.floor(depth * 7));

            // Rocky banks with moonlit highlights
            this.rect(ctx, streamX - streamW * 0.5 - u * 2, y, u * 2, u, COLORS.darkGrey);
            this.rect(ctx, streamX + streamW * 0.5, y, u, u, COLORS.grey);

            // Deep water base
            this.rect(ctx, streamX - streamW * 0.5, y, streamW, u, COLORS.darkBlue);

            // Animated horizontal C64 water-shimmer reflections
            const ripple = Math.sin(depth * 22.0 - this.waterPhase);
            if (ripple > -0.2) {
                const shimmerW = Math.max(u, Math.floor(streamW * 0.55));
                const shimmerCol = (ripple > 0.65 || this.beatPulse > 0.55)
                    ? COLORS.white
                    : (ripple > 0.25 ? COLORS.cyan : COLORS.lightBlue);
                this.rect(ctx, streamX - shimmerW * 0.5, y, shimmerW, u, shimmerCol);
            }
        }

        // 5. Golden-Ratio Winding Cobblestone Road (sweeps from Portcullis to x ≈ 0.62)
        const gateCenterX = width * 0.43;
        for (let y = horizon; y < height; y += u) {
            const depth = (y - horizon) / Math.max(1, fgHeight);
            const rowIdx = Math.floor((y - horizon) / u);

            // Smooth S-curve sweeping toward the lower-right Golden Ratio (0.62)
            const pathX = gateCenterX
                + Math.pow(depth, 0.9) * (width * 0.19)
                + Math.sin(depth * Math.PI * 2.0) * (width * 0.055);
            const pathWidth = u * (3 + Math.floor(depth * Math.min(18, (width / u) * 0.085)));

            const isThreshold = depth < 0.10 && this.beatPulse > 0.25;
            const isCobbleBand = (rowIdx % 2) === 0;
            const baseRoadCol = isThreshold
                ? COLORS.yellow
                : (depth < 0.22
                    ? (isCobbleBand ? COLORS.orange : COLORS.brown)
                    : (depth < 0.60
                        ? (isCobbleBand ? COLORS.brown : COLORS.darkGrey)
                        : (isCobbleBand ? COLORS.darkGrey : COLORS.grey)));

            this.rect(ctx, pathX - pathWidth * 0.5, y, pathWidth, u, baseRoadCol);

            // Moonlit left curb & shadowed right curb
            this.rect(ctx, pathX - pathWidth * 0.5 - u, y, u, u, COLORS.lightGrey);
            this.rect(ctx, pathX + pathWidth * 0.5, y, u, u, COLORS.darkGrey);
        }

        // 6. Beat-Synchronized Medieval Torch-Posts along the Road
        const activeChaserIdx = ((3 - (this.lastBeatCount % 4)) + 4) % 4;
        for (let tIdx = 0; tIdx < PATH_TORCH_DEPTHS.length; tIdx++) {
            const depth = PATH_TORCH_DEPTHS[tIdx];
            const ty = horizon + Math.floor(depth * fgHeight);
            const pathX = gateCenterX
                + Math.pow(depth, 0.9) * (width * 0.19)
                + Math.sin(depth * Math.PI * 2.0) * (width * 0.055);
            const pathWidth = u * (3 + Math.floor(depth * Math.min(18, (width / u) * 0.085)));

            const side = (tIdx & 1) === 0 ? -1 : 1;
            const postX = pathX + side * (pathWidth * 0.5 + u * 2);
            const postH = u * (3 + tIdx);

            // Warm torchlight pool cast across the cobblestones
            const isChaserLit = tIdx === activeChaserIdx && this.beatPulse > 0.15;
            this.rect(ctx, pathX - pathWidth * 0.35, ty, pathWidth * 0.7, u, isChaserLit ? COLORS.yellow : COLORS.orange);

            // Wooden post & animated flame
            this.rect(ctx, postX, ty - postH, u, postH, COLORS.brown);
            this.drawTorchFlame(ctx, postX, ty - postH, 1, tIdx * 1.6);
        }

        // 7. Cluster of Bob Ross "Happy Little Evergreens" on the Right Ridge
        this.drawBobRossEvergreen(ctx, Math.floor(width * 0.79), horizon + u * 3, Math.floor(fgHeight * 0.34));
        this.drawBobRossEvergreen(ctx, Math.floor(width * 0.85), horizon + u * 2, Math.floor(fgHeight * 0.44));
        this.drawBobRossEvergreen(ctx, Math.floor(width * 0.91), horizon + u * 5, Math.floor(fgHeight * 0.38));
        this.drawBobRossEvergreen(ctx, Math.floor(width * 0.96), horizon + u * 8, Math.floor(fgHeight * 0.28));

        // Midground evergreen on the left bank near the waterfall
        this.drawBobRossEvergreen(ctx, Math.floor(width * 0.16), horizon + u * 4, Math.floor(fgHeight * 0.32));

        // 8. Grand Foreground Repoussoir Gnarled Oak Tree on the Left
        this.drawRepoussoirOak(
            ctx,
            Math.floor(width * 0.07),
            horizon + Math.floor(fgHeight * 0.56),
            Math.floor(fgHeight * 0.96)
        );
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

        // LAYER 1: Night Sky, Unmasked Crescent Moon, Lightning, Stars & Clouds
        this.drawSky(ctx, width, height, t);

        // LAYER 2: Multi-Tier Fireworks in the Sky (Behind Mountains & Castle)
        this.updateFireworks(ctx, width, height, t);

        // LAYER 3: Bob Ross Distant Carpathian Mountains (Directional Moonlight)
        this.drawMountains(ctx, width);

        // LAYER 4: C64 Hardware-Sprite Vampire Bats
        this.updateAndDrawBats(ctx, dt, t);

        // LAYER 5: Golden-Ratio Castlevania Citadel & Clock Tower (Flush on Horizon)
        this.drawCastle(ctx, width);

        // LAYER 6: Foreground Terraces, Moonlit Stream, Cobblestone Road & Trees
        this.drawForeground(ctx, width, height);

        // DSE Lifecycle Transitions (Ordered Dither Crossfade)
        let visibility = 1;
        if (state === 'starting') visibility = clamp(stateTime / 1.5, 0, 1);
        else if (state === 'stopping') visibility = clamp(1 - stateTime / 1.5, 0, 1);
        applyOrderedDitherFade(ctx, width, height, visibility);
    }
}