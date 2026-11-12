// === js/visuals/dse/c64/castle-fireworks.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: C64 CASTLE FIREWORKS (Background DSE)
// Masterpiece Edition v2: Pixel-perfect Gothic contours,
// Golden Ratio composition & Bob Ross landscape layering.
// - Exact integer-grid towers & concave Gothic spires with
//   unbroken 1-pixel silhouettes and corbelled parapets
// - Distant Carpathian mountains with unified ridge contours
// - Viaduct waterfall & stream reflecting moonlight & fireworks
// - Aspect-ratio-locked cobblestone road & chaser torches
// - Physically accurate directional moonlight from upper-left
// - 3-tier beat-synced fireworks, 8-sprite bats & lightning
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
    [0.05, 0.08], [0.11, 0.24], [0.25, 0.06], [0.32, 0.17],
    [0.39, 0.07], [0.46, 0.21], [0.53, 0.05], [0.64, 0.13],
    [0.72, 0.07], [0.80, 0.20], [0.88, 0.09], [0.95, 0.24],
    [0.09, 0.37], [0.22, 0.33], [0.36, 0.30], [0.69, 0.31],
    [0.85, 0.34], [0.93, 0.40], [0.14, 0.44], [0.90, 0.47]
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

// Distant Carpathian peaks: [peakXRatio, heightRatioOfHorizon, halfSpanRatio]
const MOUNTAIN_PEAKS = [
    [0.10, 0.28, 0.14],
    [0.25, 0.47, 0.18],
    [0.43, 0.33, 0.15],
    [0.77, 0.43, 0.18],
    [0.91, 0.29, 0.14]
];

// 4 Clock hand offsets [dx, dy] around center
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
        this.horizonRow = 55;
        this.totalCols = 160;
        this.gateCol = 75;
        this.viaductArchCol = 45;

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

    // Exact integer-grid rectangle filler (Zero sub-pixel rounding artifacts!)
    gridRect(ctx, col, row, wCols, hRows, color) {
        if (wCols <= 0 || hRows <= 0) return;
        const u = this.pixelSize;
        const x = col * u;
        const y = row * u;
        const right = Math.min(this.width, x + wCols * u);
        const bottom = Math.min(this.height, y + hRows * u);
        const cx = Math.max(0, x);
        const cy = Math.max(0, y);
        if (right <= cx || bottom <= cy) return;
        ctx.fillStyle = color;
        ctx.fillRect(cx, cy, right - cx, bottom - cy);
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

    // Subtle 2-scanline C64 VIC-II raster split
    drawSubtleRasterSplit(ctx, splitRow, colorTop, colorBottom) {
        this.gridRect(ctx, 0, splitRow - 1, this.totalCols + 1, 1, colorBottom);
        this.gridRect(ctx, 0, splitRow, this.totalCols + 1, 1, colorTop);
    }

    // =========================================================
    // PIXEL-PERFECT CONCAVE GOTHIC SPIRE BUILDER
    // Guarantees 100% left-right symmetry, overhanging eaves,
    // unbroken 8-connected 1-pixel contours on both slopes,
    // slate sheen, and a razor-sharp 1-pixel needle apex.
    // =========================================================
    drawCleanSpire(ctx, cxCol, baseRow, eavesHalfW, spireH, leftRimCol, rightRimCol) {
        if (spireH <= 0) return;

        // 1. Overhanging Eaves Cornice Molding at baseRow
        this.gridRect(ctx, cxCol - eavesHalfW, baseRow, eavesHalfW * 2 + 1, 1, COLORS.darkGrey);
        this.gridRect(ctx, cxCol - eavesHalfW, baseRow, eavesHalfW, 1, COLORS.grey);
        this.gridRect(ctx, cxCol - eavesHalfW, baseRow, 1, 1, leftRimCol);
        // Eaves cast shadow immediately below
        this.gridRect(ctx, cxCol - eavesHalfW + 1, baseRow + 1, eavesHalfW * 2 - 1, 1, COLORS.black);

        let prevHalfW = eavesHalfW;
        for (let r = 1; r <= spireH; r++) {
            const row = baseRow - r;
            const t = r / spireH;
            // Concave witch-hat curve tapering to exact 0 half-width (1-pixel needle)
            const curHalfW = r === spireH ? 0 : Math.floor(eavesHalfW * Math.pow(1 - t, 1.32));

            // Connect any multi-column horizontal step on previous row so the 1px outline never breaks!
            const stepDiff = prevHalfW - curHalfW;
            if (stepDiff > 1 && r > 1) {
                const prevRow = row + 1;
                this.gridRect(ctx, cxCol - prevHalfW, prevRow, stepDiff, 1, leftRimCol);
                this.gridRect(ctx, cxCol + curHalfW + 1, prevRow, stepDiff, 1, rightRimCol);
            }

            if (curHalfW === 0) {
                // Exact 1-pixel spire needle apex
                this.gridRect(ctx, cxCol, row, 1, 1, leftRimCol);
            } else {
                // Dark slate core
                this.gridRect(ctx, cxCol - curHalfW, row, curHalfW * 2 + 1, 1, COLORS.black);

                // Subtle moonlit slate sheen just inside the left contour
                if (curHalfW >= 2) {
                    const sheenCol = (r & 1) === 0 ? COLORS.darkBlue : COLORS.purple;
                    this.gridRect(ctx, cxCol - curHalfW + 1, row, Math.max(1, curHalfW - 1), 1, sheenCol);
                }

                // Crisp 1-pixel outer contours (never blends into purple/blue/black sky!)
                this.gridRect(ctx, cxCol - curHalfW, row, 1, 1, leftRimCol);
                this.gridRect(ctx, cxCol + curHalfW, row, 1, 1, rightRimCol);
            }

            prevHalfW = curHalfW;
        }
    }

    // Pixel-perfect pitched cathedral gable roof with unbroken bargeboard contours
    drawCleanGable(ctx, cxCol, baseRow, eavesHalfW, gableH, leftRimCol, rightRimCol) {
        if (gableH <= 0) return;
        this.gridRect(ctx, cxCol - eavesHalfW, baseRow, eavesHalfW * 2 + 1, 1, COLORS.grey);
        this.gridRect(ctx, cxCol - eavesHalfW, baseRow, 1, 1, leftRimCol);
        this.gridRect(ctx, cxCol + eavesHalfW, baseRow, 1, 1, rightRimCol);

        let prevHalfW = eavesHalfW;
        for (let r = 1; r <= gableH; r++) {
            const row = baseRow - r;
            const curHalfW = r === gableH ? 0 : Math.round(eavesHalfW * (1 - r / gableH));
            const stepDiff = prevHalfW - curHalfW;
            if (stepDiff > 1 && r > 1) {
                this.gridRect(ctx, cxCol - prevHalfW, row + 1, stepDiff, 1, leftRimCol);
                this.gridRect(ctx, cxCol + curHalfW + 1, row + 1, stepDiff, 1, rightRimCol);
            }

            if (curHalfW === 0) {
                this.gridRect(ctx, cxCol, row, 1, 1, leftRimCol);
            } else {
                // Stone gable face with dark timber/slate inlay
                this.gridRect(ctx, cxCol - curHalfW, row, curHalfW * 2 + 1, 1, COLORS.black);
                if (curHalfW >= 2) {
                    this.gridRect(ctx, cxCol - curHalfW + 1, row, curHalfW - 1, 1, COLORS.darkGrey);
                }
                this.gridRect(ctx, cxCol - curHalfW, row, 1, 1, leftRimCol);
                this.gridRect(ctx, cxCol + curHalfW, row, 1, 1, rightRimCol);
            }
            prevHalfW = curHalfW;
        }
    }

    // Symmetric tower wall with directional moonlit left rim, ashlar masonry & right contour
    drawTowerWall(ctx, cxCol, topRow, bottomRow, halfW, litStone, rightEdgeStone) {
        const h = bottomRow - topRow;
        if (h <= 0) return;
        const totalW = halfW * 2 + 1;
        const leftCol = cxCol - halfW;

        // Shadowed core
        this.gridRect(ctx, leftCol, topRow, totalW, h, COLORS.black);
        // Mid-lit left & center masonry
        this.gridRect(ctx, leftCol, topRow, halfW + 1, h, COLORS.darkGrey);
        // Strong moonlit left edge (2 cols on wide towers, 1 col on narrow)
        const rimW = halfW >= 6 ? 2 : 1;
        this.gridRect(ctx, leftCol, topRow, rimW, h, litStone);
        // Subtle right-side contour edge so shadowed wall never vanishes into black sky/mountains
        this.gridRect(ctx, cxCol + halfW, topRow, 1, h, rightEdgeStone);

        // Subtle horizontal ashlar stone course highlights every 4 rows
        for (let r = topRow + 3; r < bottomRow - 2; r += 4) {
            this.gridRect(ctx, leftCol + rimW, r, Math.max(1, halfW - rimW), 1, COLORS.grey);
        }
    }

    // Corbelled parapet & symmetric battlements (Machikolationen & Zinnen)
    drawParapet(ctx, cxCol, wallTopRow, towerHalfW, rimCol, drawMerlons) {
        const pHalfW = towerHalfW + 1;
        const leftCol = cxCol - pHalfW;
        const totalW = pHalfW * 2 + 1;

        // Corbel teeth underneath overhanging parapet
        for (let c = leftCol + 1; c <= cxCol + pHalfW - 1; c += 2) {
            this.gridRect(ctx, c, wallTopRow + 1, 1, 1, c <= cxCol ? COLORS.grey : COLORS.darkGrey);
        }

        // Solid parapet cornice band
        this.gridRect(ctx, leftCol, wallTopRow - 1, totalW, 2, COLORS.darkGrey);
        this.gridRect(ctx, leftCol, wallTopRow - 1, pHalfW + 1, 1, rimCol);
        this.gridRect(ctx, leftCol, wallTopRow, 1, 1, rimCol);

        // Symmetric 2u merlons along top
        if (drawMerlons) {
            for (let offset = -pHalfW; offset <= pHalfW - 1; offset += 4) {
                const mCol = cxCol + offset;
                this.gridRect(ctx, mCol, wallTopRow - 3, 2, 2, offset <= 0 ? COLORS.grey : COLORS.darkGrey);
                this.gridRect(ctx, mCol, wallTopRow - 3, 1, 2, rimCol);
            }
        }
    }

    // Symmetric pointed Gothic arch window centered on cxCol
    drawGothicWindow(ctx, cxCol, topRow, halfW, hRows, rimColor, coreColor, hasMullion) {
        // Pointed arch crown
        this.gridRect(ctx, cxCol, topRow, 1, 1, coreColor);
        if (halfW >= 1 && hRows >= 3) {
            this.gridRect(ctx, cxCol - halfW, topRow + 1, halfW * 2 + 1, hRows - 1, rimColor);
            if (halfW >= 2) {
                this.gridRect(ctx, cxCol - halfW + 1, topRow + 1, (halfW - 1) * 2 + 1, hRows - 2, coreColor);
            } else {
                this.gridRect(ctx, cxCol, topRow + 1, 1, hRows - 2, coreColor);
            }
        }
        // Crisp centered stone tracery cross
        if (hasMullion && halfW >= 2) {
            this.gridRect(ctx, cxCol, topRow + 1, 1, hRows - 1, COLORS.black);
            const transomRow = topRow + Math.floor(hRows * 0.45);
            this.gridRect(ctx, cxCol - halfW, transomRow, halfW * 2 + 1, 1, COLORS.black);
        }
        // Moonlit stone sill
        this.gridRect(ctx, cxCol - halfW, topRow + hRows, halfW * 2 + 1, 1, COLORS.grey);
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
        this.waterPhase = (this.waterPhase + dt * (4.5 + this.tension * 5.0 + this.beatPulse * 4.0)) % 628.318;
        this.cloudOffset = (this.cloudOffset + dt * Math.min(this.width, this.height) * (0.016 + this.tension * 0.018)) % Math.max(1, this.width);

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
                    this.lightningX = (beatCount & 1) === 0 ? this.width * 0.26 : this.width * 0.80;
                }

                // Spawn vampire bats from the Keep & Clock Tower
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
        ctx.fillStyle = COLORS.black;
        ctx.fillRect(0, 0, width, height);

        const hRow = this.horizonRow;
        const band0 = Math.floor(hRow * 0.22);
        const band1 = Math.floor(hRow * 0.54);
        const crimsonRows = this.tension > 0.35 ? Math.floor(hRow * (this.tension - 0.35) * 0.36) : 0;
        const band2 = Math.max(band1 + 4, hRow - crimsonRows);

        if (band1 > band0) {
            this.gridRect(ctx, 0, band0, this.totalCols + 1, band1 - band0, COLORS.darkBlue);
            this.drawSubtleRasterSplit(ctx, band0, COLORS.black, COLORS.darkBlue);
        }

        if (band2 > band1) {
            this.gridRect(ctx, 0, band1, this.totalCols + 1, band2 - band1, COLORS.purple);
            this.drawSubtleRasterSplit(ctx, band1, COLORS.darkBlue, COLORS.purple);
        }

        if (hRow > band2) {
            const horizonGlow = this.tension > 0.72 && this.heavyPulse > 0.3 ? COLORS.red : COLORS.brown;
            this.gridRect(ctx, 0, band2, this.totalCols + 1, hRow - band2, horizonGlow);
            this.drawSubtleRasterSplit(ctx, band2, COLORS.purple, horizonGlow);
        }

        // Lightning Flash & Forked Bolt
        if (this.lightningTimer > 0) {
            if ((Math.floor(this.lightningTimer * 36) & 1) === 0) {
                this.gridRect(ctx, 0, 2, this.totalCols + 1, 1, COLORS.lightBlue);
                this.gridRect(ctx, 0, band0, this.totalCols + 1, 1, COLORS.white);
            }
            this.drawLightningBolt(ctx, this.lightningX, this.floorY);
        }

        // Twinkling Stars
        const twinkle = Math.floor(t * (3 + this.tension * 3));
        const starBoost = this.beatPulse > 0.55;
        for (let i = 0; i < STAR_POSITIONS.length; i++) {
            const col = Math.floor(STAR_POSITIONS[i][0] * this.totalCols);
            const row = Math.floor(STAR_POSITIONS[i][1] * hRow);
            if (row >= hRow - 4) continue;

            const isSparkle = (i + twinkle) % 6 === 0 || (starBoost && i % 3 === 0);
            const color = isSparkle
                ? COLORS.white
                : (i % 3 === 0 ? COLORS.lightBlue : COLORS.lightGrey);
            this.gridRect(ctx, col, row, 1, 1, color);

            if (isSparkle && (i % 5 === 0 || starBoost)) {
                this.gridRect(ctx, col - 1, row, 1, 1, COLORS.lightBlue);
                this.gridRect(ctx, col + 1, row, 1, 1, COLORS.lightBlue);
            }
        }

        // True Unmasked Crescent Moon in Upper-Left Golden Zone (x ≈ 0.17)
        this.drawMoon(ctx);

        // High Drifting Gothic Clouds (kept high so they frame spires cleanly)
        this.drawCloud(ctx, width, 0.35, 0.12, 22, 0.12);
        this.drawCloud(ctx, width, 0.78, 0.19, 18, -0.09);
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

    drawMoon(ctx) {
        const mCol = Math.floor(this.totalCols * 0.16);
        const mRow = Math.max(2, Math.floor(this.horizonRow * 0.12));

        const isBloodMoon = this.tension > 0.74;
        const bodyColor = isBloodMoon && this.heavyPulse > 0.25 ? COLORS.orange : COLORS.yellow;
        const rimColor = isBloodMoon ? COLORS.yellow : COLORS.white;

        for (let r = 0; r < CRESCENT_ROWS.length; r++) {
            const offsetX = CRESCENT_ROWS[r][0];
            const totalW = CRESCENT_ROWS[r][1];
            const hiW = CRESCENT_ROWS[r][2];

            this.gridRect(ctx, mCol + offsetX, mRow + r, totalW, 1, bodyColor);
            this.gridRect(ctx, mCol + offsetX, mRow + r, hiW, 1, rimColor);
        }

        // Sharp upper and lower crescent horn tips
        this.gridRect(ctx, mCol + 6, mRow, 1, 1, bodyColor);
        this.gridRect(ctx, mCol + 6, mRow + 8, 1, 1, bodyColor);

        // Subtle outer lunar aura on strong beats
        if (this.beatPulse > 0.45 || this.tension > 0.60) {
            const auraCol = isBloodMoon ? COLORS.lightRed : COLORS.lightBlue;
            this.gridRect(ctx, mCol - 1, mRow + 3, 1, 3, auraCol);
            this.gridRect(ctx, mCol + 1, mRow - 1, 2, 1, auraCol);
            this.gridRect(ctx, mCol + 1, mRow + 9, 2, 1, auraCol);
        }
    }

    drawCloud(ctx, width, baseX, baseY, wCols, speed) {
        const u = this.pixelSize;
        const cloudPxW = wCols * u;
        const travel = width + cloudPxW;
        const px = ((baseX * width + this.cloudOffset * speed) % travel + travel) % travel - cloudPxW * 0.5;
        const col = Math.floor(px / u);
        const row = Math.floor(baseY * this.horizonRow);

        const topRim = this.lightningTimer > 0 ? COLORS.white : COLORS.lightBlue;
        // Soft stepped C64 cloud with moonlit upper-left edge & dithered base
        this.gridRect(ctx, col + 4, row, Math.floor(wCols * 0.45), 1, topRim);
        this.gridRect(ctx, col + 2, row + 1, Math.floor(wCols * 0.75), 1, COLORS.grey);
        this.gridRect(ctx, col, row + 2, wCols, 1, COLORS.darkGrey);
        this.gridRect(ctx, col + 2, row + 3, wCols - 3, 1, COLORS.darkBlue);
    }

    // Helper to evaluate peak height & lit-side status at a given column (Zero-GC)
    drawMountains(ctx) {
        const hRow = this.horizonRow;
        const cols = this.totalCols;
        const moonCol = Math.floor(cols * 0.16);

        let prevH = 0;
        for (let c = 0; c <= cols; c++) {
            let bestH = 0;
            let bestPeakCol = 0;
            let bestPeakIdx = 0;

            for (let p = 0; p < MOUNTAIN_PEAKS.length; p++) {
                const pCol = MOUNTAIN_PEAKS[p][0] * cols;
                const pMaxH = MOUNTAIN_PEAKS[p][1] * hRow;
                const halfSpan = MOUNTAIN_PEAKS[p][2] * cols;
                const dist = Math.abs(c - pCol);
                if (dist >= halfSpan) continue;

                const norm = dist / halfSpan;
                const crag = Math.sin(norm * Math.PI * 3.0) * 1.2;
                const h = Math.floor(pMaxH * (1 - Math.pow(norm, 0.85)) + crag);
                if (h >= bestH) {
                    bestH = h;
                    bestPeakCol = pCol;
                    bestPeakIdx = p;
                }
            }

            if (bestH > 0) {
                const topRow = hRow - bestH;
                // Slope faces the moon if it's on the moonward side of its peak!
                const facesMoon = bestPeakCol >= moonCol ? (c <= bestPeakCol) : (c >= bestPeakCol);
                const stepSpan = Math.max(1, Math.abs(bestH - prevH));

                if (facesMoon) {
                    const bodyCol = (bestPeakIdx & 1) === 0 ? COLORS.darkBlue : COLORS.black;
                    const ridgeCol = this.lightningTimer > 0 ? COLORS.white : COLORS.lightBlue;
                    this.gridRect(ctx, c, topRow, 1, bestH, bodyCol);
                    if (bestH > 4) {
                        this.gridRect(ctx, c, topRow + 1, 1, Math.min(3, bestH - 2), COLORS.purple);
                    }
                    // Unbroken 1px ridge highlight
                    this.gridRect(ctx, c, topRow, 1, Math.min(bestH, stepSpan), ridgeCol);
                } else {
                    this.gridRect(ctx, c, topRow, 1, bestH, COLORS.black);
                    if (bestH > 5 && (c & 1) === 0) {
                        this.gridRect(ctx, c, topRow + 2, 1, 2, COLORS.darkGrey);
                    }
                    // Clean shadow-side ridge contour
                    this.gridRect(ctx, c, topRow, 1, Math.min(bestH, stepSpan), COLORS.darkBlue);
                }
            }
            prevH = bestH;
        }
    }

    spawnBat(seed, strength) {
        const bat = this.bats[this.batCursor];
        this.batCursor = (this.batCursor + 1) % MAX_BATS;

        const dir = (seed & 1) === 0 ? -1 : 1;
        bat.active = true;
        bat.x = this.width * (0.56 + dir * 0.04);
        bat.y = this.floorY * (0.26 + ((seed * 3) % 5) * 0.06);
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

    drawGridTorch(ctx, col, row, phaseOffset) {
        const flicker = Math.sin(this.torchPhase + phaseOffset);
        const beatBoost = this.beatPulse > 0.45 ? 1 : 0;

        this.gridRect(ctx, col, row + 1, 1, 2, COLORS.brown);
        this.gridRect(ctx, col, row, 1, 1, COLORS.red);
        this.gridRect(ctx, col + (flicker > 0.45 ? 1 : 0), row - 1, 1, 1, COLORS.orange);
        this.gridRect(ctx, col, row - 2 - beatBoost, 1, 1 + beatBoost, this.beatPulse > 0.5 ? COLORS.white : COLORS.yellow);
    }

    drawCastle(ctx) {
        // =========================================================
        // PIXEL-PERFECT INTEGER-GRID CASTLEVANIA CITADEL
        // Every spire, gable, battlement, arch and window is built
        // symmetrically around integer columns for razor-sharp
        // contours with zero sub-pixel quantization artifacts.
        // =========================================================
        const hRow = this.horizonRow;
        const hScale = Math.min(1, hRow / 55);
        const sc = val => Math.max(1, Math.round(val * hScale));

        // Golden-Ratio anchor column for the soaring Dracula Keep
        const keepCol = Math.floor(this.totalCols * 0.56);
        const bastionCol = keepCol - sc(25);
        const gateCol = keepCol - sc(13);
        const clockCol = keepCol + sc(18);
        const viaductStartCol = bastionCol - sc(20);

        // Save exact grid anchors so the foreground road & waterfall lock 100% flush!
        this.gateCol = gateCol;
        this.viaductArchCol = viaductStartCol + sc(6);

        const litStone = this.lightningTimer > 0 ? COLORS.white : COLORS.lightGrey;
        const leftRoofRim = this.lightningTimer > 0
            ? COLORS.white
            : (this.activeRimColor !== null && this.beatPulse > 0.38 ? this.activeRimColor : COLORS.lightGrey);
        // Right roof contour uses grey/darkGrey so it NEVER vanishes into black, darkBlue, or purple sky!
        const rightRoofRim = this.activeRimColor !== null && this.beatPulse > 0.55
            ? this.activeRimColor
            : COLORS.darkGrey;

        const isHighTension = this.tension > 0.58;
        const winRim = isHighTension ? COLORS.red : COLORS.orange;
        const winCore = this.heavyPulse > 0.45
            ? COLORS.white
            : (this.beatPulse > 0.35 ? COLORS.yellow : (isHighTension ? COLORS.lightRed : COLORS.yellow));
        const beatAlt = (this.lastBeatCount & 1) === 0;
        const bannerShift = Math.sin(this.windPhase * 2.5) > 0 ? 0 : 1;
        const bannerColor = this.beatPulse > 0.60 ? COLORS.lightRed : COLORS.red;

        // ---------------------------------------------------------
        // 1. LEFT GOTHIC VIADUCT BRIDGE (with true semicircular arches)
        // ---------------------------------------------------------
        const viaTop = hRow - sc(13);
        const viaW = (bastionCol - sc(5)) - viaductStartCol;
        if (viaW > 6) {
            this.gridRect(ctx, viaductStartCol, viaTop, viaW, sc(13), COLORS.darkGrey);
            this.gridRect(ctx, viaductStartCol, viaTop, viaW, 1, leftRoofRim);
            this.gridRect(ctx, viaductStartCol, viaTop + 1, viaW, 1, COLORS.grey);

            // Carve two clean Gothic arches into the viaduct (waterfall flows through arch 1!)
            for (let a = 0; a < 2; a++) {
                const aCenter = viaductStartCol + sc(6 + a * 9);
                const archH = sc(8);
                this.gridRect(ctx, aCenter - 2, hRow - archH + 1, 5, archH - 1, COLORS.black);
                this.gridRect(ctx, aCenter - 1, hRow - archH, 3, 1, COLORS.black);
                // Moonlit inner right arch intrados
                this.gridRect(ctx, aCenter + 2, hRow - archH + 1, 1, archH - 1, COLORS.grey);
            }
        }

        // ---------------------------------------------------------
        // 2. LEFT FLANKING BASTION TOWER
        // ---------------------------------------------------------
        const bastTop = hRow - sc(24);
        const bastHalfW = sc(5);
        this.drawTowerWall(ctx, bastionCol, bastTop, hRow, bastHalfW, litStone, COLORS.darkGrey);
        this.drawParapet(ctx, bastionCol, bastTop, bastHalfW, leftRoofRim, false);
        this.drawCleanSpire(ctx, bastionCol, bastTop - 2, bastHalfW + 1, sc(12), leftRoofRim, rightRoofRim);
        // Spire Finial & Waving Pennant
        const bastApex = bastTop - 2 - sc(12);
        this.gridRect(ctx, bastionCol, bastApex - 2, 1, 2, COLORS.lightGrey);
        this.gridRect(ctx, bastionCol + 1, bastApex - 1, 2, 1, bannerColor);
        this.gridRect(ctx, bastionCol + 3, bastApex - 1 + bannerShift, 2, 1, bannerColor);
        // Lancet window
        this.drawGothicWindow(ctx, bastionCol, bastTop + sc(5), 1, sc(5), winRim, beatAlt ? winCore : winRim, false);

        // ---------------------------------------------------------
        // 3. CENTRAL CATHEDRAL HALL & PORTCULLIS GATEHOUSE
        // ---------------------------------------------------------
        const hallTop = hRow - sc(21);
        const hallHalfW = sc(8);
        this.drawTowerWall(ctx, gateCol, hallTop, hRow, hallHalfW, litStone, COLORS.darkGrey);
        this.drawCleanGable(ctx, gateCol, hallTop, hallHalfW + 1, sc(9), leftRoofRim, rightRoofRim);
        this.gridRect(ctx, gateCol, hallTop - sc(9) - 2, 1, 2, COLORS.lightGrey);

        // Cathedral Twin Window above Portcullis
        this.drawGothicWindow(ctx, gateCol, hallTop + sc(2), 2, sc(5), winRim, beatAlt ? winRim : winCore, true);

        // ---------------------------------------------------------
        // 4. HIGH FLYING SKYBRIDGE & RIGHT CLOCK TOWER
        // ---------------------------------------------------------
        const skyTop = hRow - sc(23);
        const bridgeLeft = keepCol + sc(7);
        const bridgeRight = clockCol - sc(5);
        if (bridgeRight > bridgeLeft) {
            const bw = bridgeRight - bridgeLeft;
            this.gridRect(ctx, bridgeLeft, skyTop, bw, sc(4), COLORS.darkGrey);
            this.gridRect(ctx, bridgeLeft, skyTop, bw, 1, leftRoofRim);
            // Vaulted sky-arch cutout underneath
            if (bw >= 4) {
                this.gridRect(ctx, bridgeLeft + 1, skyTop + 2, bw - 2, 2, COLORS.black);
            }
        }

        const clockTop = hRow - sc(29);
        const clockHalfW = sc(5);
        this.drawTowerWall(ctx, clockCol, clockTop, hRow, clockHalfW, litStone, COLORS.darkGrey);
        this.drawParapet(ctx, clockCol, clockTop, clockHalfW, leftRoofRim, true);
        this.drawCleanSpire(ctx, clockCol, clockTop - 3, clockHalfW + 1, sc(13), leftRoofRim, rightRoofRim);

        const clockApex = clockTop - 3 - sc(13);
        this.gridRect(ctx, clockCol, clockApex - 2, 1, 2, COLORS.white);
        this.gridRect(ctx, clockCol + 1, clockApex - 1, 2, 1, bannerColor);
        this.gridRect(ctx, clockCol + 3, clockApex - bannerShift, 2, 1, bannerColor);

        // Beat-Ticking Illuminated Clock Face (5x5 symmetric around clockCol!)
        const cfRow = clockTop + sc(3);
        this.gridRect(ctx, clockCol - 2, cfRow, 5, 5, COLORS.orange);
        this.gridRect(ctx, clockCol - 1, cfRow, 3, 5, this.beatPulse > 0.4 ? COLORS.white : COLORS.yellow);
        this.gridRect(ctx, clockCol - 2, cfRow + 1, 5, 3, this.beatPulse > 0.4 ? COLORS.white : COLORS.yellow);
        const handIdx = Math.max(0, this.lastBeatCount) & 3;
        this.gridRect(ctx, clockCol, cfRow + 2, 1, 1, COLORS.black);
        this.gridRect(ctx, clockCol + CLOCK_HANDS[handIdx][0], cfRow + 2 + CLOCK_HANDS[handIdx][1], 1, 1, COLORS.red);

        // Lower Clock Tower Window
        this.drawGothicWindow(ctx, clockCol, clockTop + sc(12), 1, sc(5), winRim, beatAlt ? winCore : COLORS.orange, false);

        // ---------------------------------------------------------
        // 5. SOARING DRACULA GREAT KEEP (Golden Ratio Focal Point!)
        // Drawn in front of flanking wings for crisp architectural depth
        // ---------------------------------------------------------
        const keepTop = hRow - sc(33);
        const keepHalfW = sc(7);
        this.drawTowerWall(ctx, keepCol, keepTop, hRow, keepHalfW, litStone, COLORS.darkGrey);
        this.drawParapet(ctx, keepCol, keepTop, keepHalfW, leftRoofRim, true);

        // Upper Dracula Belfry Lantern
        const belfryTop = keepTop - sc(8);
        const belfryHalfW = sc(4);
        this.drawTowerWall(ctx, keepCol, belfryTop, keepTop - 2, belfryHalfW, litStone, COLORS.darkGrey);

        // Soaring Needle Spire & Symmetric Cross Finial
        const mainSpireH = sc(11);
        this.drawCleanSpire(ctx, keepCol, belfryTop, belfryHalfW + 1, mainSpireH, leftRoofRim, rightRoofRim);
        const keepApex = Math.max(3, belfryTop - mainSpireH);
        this.gridRect(ctx, keepCol, keepApex - 3, 1, 3, COLORS.white);
        this.gridRect(ctx, keepCol - 1, keepApex - 2, 3, 1, COLORS.white);

        // Dracula's Upper Chamber Window (with dark Count silhouette)
        this.gridRect(ctx, keepCol - 1, belfryTop + 2, 3, sc(4), this.heavyPulse > 0.3 ? COLORS.lightRed : COLORS.yellow);
        this.gridRect(ctx, keepCol, belfryTop + 3, 1, sc(3), COLORS.black);

        // Grand Cathedral Stained-Glass Window in Great Keep
        this.drawGothicWindow(ctx, keepCol, keepTop + sc(5), 3, sc(10), winRim, winCore, true);

        // Gargoyle Eyes Glinting on Keep Parapet Corners
        if (this.tension > 0.50 || this.heavyPulse > 0.2) {
            const eyeCol = this.heavyPulse > 0.4 ? COLORS.yellow : COLORS.lightRed;
            this.gridRect(ctx, keepCol - keepHalfW - 2, keepTop - 1, 1, 1, eyeCol);
            this.gridRect(ctx, keepCol + keepHalfW + 2, keepTop - 1, 1, 1, eyeCol);
        }

        // ---------------------------------------------------------
        // 6. CRAGGY ROCK FOUNDATION & MAIN PORTCULLIS GATE (Flush on hRow)
        // ---------------------------------------------------------
        // Stepped cliff outcrops anchoring the right & center walls
        this.gridRect(ctx, clockCol + clockHalfW, hRow - sc(7), sc(5), sc(7), COLORS.black);
        this.gridRect(ctx, clockCol + clockHalfW, hRow - sc(7), 2, sc(7), COLORS.darkGrey);
        this.gridRect(ctx, bastionCol - bastHalfW - 2, hRow - sc(5), 4, sc(5), COLORS.grey);

        // Portcullis Archway centered on gateCol
        const gateH = sc(10);
        const gateHalfW = 4;
        const gateGlow = this.heavyPulse > 0.4 ? COLORS.orange : (this.beatPulse > 0.25 ? COLORS.brown : COLORS.black);

        // Stone arch surround
        this.gridRect(ctx, gateCol - gateHalfW - 1, hRow - gateH, (gateHalfW + 1) * 2 + 1, gateH, COLORS.grey);
        this.gridRect(ctx, gateCol - gateHalfW + 1, hRow - gateH - 1, (gateHalfW - 1) * 2 + 1, 1, COLORS.lightGrey);
        // Dark archway opening
        this.gridRect(ctx, gateCol - gateHalfW, hRow - gateH + 1, gateHalfW * 2 + 1, gateH - 1, COLORS.black);
        this.gridRect(ctx, gateCol - gateHalfW + 1, hRow - gateH, (gateHalfW - 1) * 2 + 1, 1, COLORS.black);
        // Warm firelight on threshold floor
        this.gridRect(ctx, gateCol - gateHalfW + 1, hRow - 2, (gateHalfW - 1) * 2 + 1, 2, gateGlow);

        // Crisp symmetric iron portcullis grate
        for (let bar = -2; bar <= 2; bar += 2) {
            this.gridRect(ctx, gateCol + bar, hRow - gateH + 1, 1, gateH - 1, COLORS.darkGrey);
        }
        this.gridRect(ctx, gateCol - gateHalfW, hRow - sc(6), gateHalfW * 2 + 1, 1, COLORS.darkGrey);
        this.gridRect(ctx, gateCol - gateHalfW, hRow - sc(3), gateHalfW * 2 + 1, 1, COLORS.darkGrey);

        // Animated Torches flanking Portcullis & Keep Battlements
        this.drawGridTorch(ctx, gateCol - gateHalfW - 2, hRow - sc(6), 0.0);
        this.drawGridTorch(ctx, gateCol + gateHalfW + 2, hRow - sc(6), 1.7);
        this.drawGridTorch(ctx, keepCol - keepHalfW + 1, keepTop + sc(18), 3.1);
        this.drawGridTorch(ctx, keepCol + keepHalfW - 1, keepTop + sc(18), 4.6);
    }

    drawBobRossEvergreen(ctx, baseCol, baseRow, treeHRows) {
        const sway = Math.round(Math.sin(this.windPhase + baseCol * 0.2));
        const topRow = baseRow - treeHRows;

        // Trunk base
        this.gridRect(ctx, baseCol, baseRow - 3, 2, 3, COLORS.brown);

        for (let r = 0; r < treeHRows - 2; r++) {
            const row = topRow + r;
            const progress = r / Math.max(1, treeHRows - 2);
            const tierFlare = (r % 2 === 0) ? 1 : 0;
            const halfW = Math.floor(progress * 5.5) + tierFlare;
            const cx = baseCol + (progress < 0.35 ? sway : 0);

            this.gridRect(ctx, cx - halfW, row, halfW * 2 + 1, 1, COLORS.black);
            this.gridRect(ctx, cx, row, halfW + 1, 1, COLORS.darkBlue);

            // Moonlit left foliage boughs (Moon is upper-left of right-side evergreens)
            const litW = Math.max(1, Math.floor(halfW * 0.65));
            this.gridRect(ctx, cx - halfW, row, litW, 1, COLORS.green);

            if (r % 2 === 0) {
                const tipCol = this.lightningTimer > 0
                    ? COLORS.white
                    : (progress < 0.38 ? COLORS.lightBlue : COLORS.lightGreen);
                this.gridRect(ctx, cx - halfW, row, 1, 1, tipCol);
            }
        }
    }

    drawRepoussoirOak(ctx, baseCol, baseRow, treeHRows) {
        // =========================================================
        // FOREGROUND REPOUSSOIR GNARLED OAK (Far Left, x ≈ 0.06)
        // Physically accurate directional lighting: because this
        // oak stands to the LEFT of the Moon (x ≈ 0.16), its RIGHT
        // bark edge and upper-right boughs catch the moonlight!
        // =========================================================
        const trunkH = Math.floor(treeHRows * 0.56);
        const sway = Math.round(Math.sin(this.windPhase));

        // Buttress roots gripping foreground knoll
        this.gridRect(ctx, baseCol - 4, baseRow, 9, 2, COLORS.black);
        this.gridRect(ctx, baseCol + 1, baseRow, 4, 1, COLORS.brown);
        this.gridRect(ctx, baseCol - 1, baseRow - 1, 5, 1, COLORS.brown);
        this.gridRect(ctx, baseCol + 3, baseRow - 1, 1, 1, COLORS.grey);

        for (let r = 1; r <= trunkH; r++) {
            const row = baseRow - r;
            const p = r / trunkH;
            const curve = Math.round(Math.sin(p * Math.PI * 1.25) * 2.5);
            const tCol = baseCol + curve;
            const tw = p < 0.42 ? 4 : (p < 0.80 ? 3 : 2);

            this.gridRect(ctx, tCol, row, tw, 1, COLORS.black);
            if (tw >= 3) {
                this.gridRect(ctx, tCol + tw - 2, row, 1, 1, COLORS.brown);
            }
            // Rightmost edge faces the Moon at x ≈ 0.16!
            this.gridRect(ctx, tCol + tw - 1, row, 1, 1, this.lightningTimer > 0 ? COLORS.white : COLORS.grey);
        }

        const crownRow = baseRow - trunkH;
        const crownCol = baseCol + 1;

        // Blinking Owl Eyes in trunk hollow
        if (this.beatPulse > 0.2 || (Math.floor(this.windPhase * 2) % 5 !== 0)) {
            const eyeCol = this.tension > 0.65 ? COLORS.lightRed : COLORS.yellow;
            this.gridRect(ctx, crownCol, crownRow + 3, 1, 1, eyeCol);
            this.gridRect(ctx, crownCol + 2, crownRow + 3, 1, 1, eyeCol);
        }

        // Sweeping crooked Gothic boughs
        const boughSteps = Math.floor(treeHRows * 0.44);
        for (let i = 0; i < boughSteps; i++) {
            const bp = i / Math.max(1, boughSteps);
            const tipSway = bp > 0.55 ? sway : 0;

            // Dramatic bough reaching right toward the Moon
            const rCol = crownCol + i + tipSway;
            const rRow = crownRow - Math.floor(i * 0.72) + Math.round(Math.sin(bp * Math.PI * 2) * 1.2);
            this.gridRect(ctx, rCol, rRow, 2, 1, COLORS.black);
            this.gridRect(ctx, rCol + 1, rRow - 1, 1, 1, COLORS.lightGrey);

            // Secondary forked twig
            if (i === Math.floor(boughSteps * 0.55)) {
                for (let f = 1; f <= 4; f++) {
                    this.gridRect(ctx, rCol + f, rRow + Math.floor(f * 0.5), 1, 1, COLORS.black);
                }
            }

            // Left-reaching high bough
            if (i < boughSteps * 0.8) {
                const lCol = crownCol - Math.floor(i * 0.75) + tipSway;
                const lRow = crownRow - Math.floor(i * 0.85);
                this.gridRect(ctx, lCol, lRow, 2, 1, COLORS.black);
                this.gridRect(ctx, lCol + 1, lRow - 1, 1, 1, COLORS.darkGrey);
            }
        }

        // Dark twilight foliage & hanging moss clusters
        const topMossCol = crownCol + Math.floor(boughSteps * 0.65) + sway;
        const topMossRow = crownRow - Math.floor(boughSteps * 0.52);
        this.gridRect(ctx, topMossCol, topMossRow, 6, 2, COLORS.black);
        this.gridRect(ctx, topMossCol + 2, topMossRow - 1, 4, 1, COLORS.darkBlue);
        this.gridRect(ctx, topMossCol + 5, topMossRow - 1, 1, 1, COLORS.lightBlue);
    }

    drawForeground(ctx) {
        const hRow = this.horizonRow;
        const totalRows = Math.ceil(this.height / this.pixelSize);
        const fgRows = totalRows - hRow;
        if (fgRows <= 0) return;

        const cols = this.totalCols;

        // 1. Deep Night Ground Base
        this.gridRect(ctx, 0, hRow, cols + 1, fgRows + 1, COLORS.black);

        // 2. Flanking Foothills Rising Organically Above Horizon (No hard ruler line!)
        const leftSpan = Math.floor(cols * 0.22);
        for (let c = 0; c < leftSpan; c++) {
            const p = c / Math.max(1, leftSpan);
            const hillH = Math.floor(fgRows * 0.13 * Math.sin(p * Math.PI));
            if (hillH > 0) {
                this.gridRect(ctx, c, hRow - hillH, 1, hillH, COLORS.black);
                this.gridRect(ctx, c, hRow - hillH, 1, 1, COLORS.darkBlue);
            }
        }

        const rightStart = Math.floor(cols * 0.75);
        for (let c = rightStart; c <= cols; c++) {
            const p = (c - rightStart) / Math.max(1, cols - rightStart);
            const hillH = Math.floor(fgRows * 0.19 * Math.sin(p * Math.PI * 0.85));
            if (hillH > 0) {
                this.gridRect(ctx, c, hRow - hillH, 1, hillH, COLORS.black);
                this.gridRect(ctx, c, hRow - hillH, 1, 1, COLORS.green);
                this.gridRect(ctx, c, hRow - hillH + 1, 1, 1, COLORS.darkBlue);
            }
        }

        // 3. Organic Rolling Meadow Ridges & Dithered Terraces
        for (let r = 1; r < fgRows; r += 2) {
            const depth = r / Math.max(1, fgRows);
            const row = hRow + r;
            const curveShift = Math.round(Math.sin(depth * 9.0) * 6);

            // Left rolling grassy knolls
            const leftKnollCol = Math.floor(cols * 0.08) + curveShift;
            const leftKnollW = Math.floor(cols * (0.14 + depth * 0.06));
            this.gridRect(ctx, leftKnollCol, row, leftKnollW, 1, (r % 4 === 1) ? COLORS.darkBlue : COLORS.green);

            // Right terraced woodland slopes
            const rightSlopeCol = Math.floor(this.gateCol + cols * (0.10 + depth * 0.18)) - curveShift;
            if (rightSlopeCol < cols) {
                const rw = Math.min(cols - rightSlopeCol, Math.floor(cols * 0.24));
                this.gridRect(ctx, rightSlopeCol, row, rw, 1, COLORS.darkBlue);
                if (r % 4 === 1 && rw > 4) {
                    this.gridRect(ctx, rightSlopeCol + 2, row, Math.floor(rw * 0.55), 1, COLORS.green);
                } else if (rw > 6) {
                    this.gridRect(ctx, rightSlopeCol + 4, row, Math.floor(rw * 0.35), 1, COLORS.brown);
                }
            }
        }

        // 4. Bob Ross Waterfall (under Viaduct Arch) & Shimmering Mountain Stream
        const archCol = this.viaductArchCol;
        // Vertical Waterfall Cascade plunging out of the open Viaduct Arch!
        const fallH = Math.max(3, Math.floor(fgRows * 0.10));
        this.gridRect(ctx, archCol - 1, hRow - 2, 3, fallH + 2, COLORS.darkBlue);
        const foamShift = Math.floor(this.waterPhase * 2) & 1;
        this.gridRect(ctx, archCol - 1 + foamShift, hRow - 2, 1, fallH + 1, COLORS.cyan);
        this.gridRect(ctx, archCol, hRow - 1 + foamShift, 1, fallH, COLORS.white);
        // Plunge-pool mist & white foam
        this.gridRect(ctx, archCol - 2, hRow + fallH - 1, 5, 1, this.beatPulse > 0.35 ? COLORS.white : COLORS.lightBlue);

        // Meandering Stream reflecting Moonlight & Active Fireworks!
        for (let r = fallH; r < fgRows; r++) {
            const depth = r / Math.max(1, fgRows);
            const row = hRow + r;
            const sCol = Math.round(
                archCol - ( depth - 0.10 ) * (cols * 0.14) + Math.sin(depth * Math.PI * 2.5) * (cols * 0.025)
            );
            const sW = 2 + Math.floor(depth * 7);
            const leftBank = sCol - Math.floor(sW * 0.5);

            // Mossy & moonlit rocky banks
            this.gridRect(ctx, leftBank - 2, row, 2, 1, COLORS.darkGrey);
            this.gridRect(ctx, leftBank + sW, row, 1, 1, COLORS.grey);

            // Deep stream water
            this.gridRect(ctx, leftBank, row, sW, 1, COLORS.darkBlue);

            // Horizontal C64 water-shimmer reflections (reflects firework rim color when bursting!)
            const ripple = Math.sin(depth * 22.0 - this.waterPhase);
            if (ripple > -0.2) {
                const shimW = Math.max(1, Math.floor(sW * 0.55));
                const shimCol = this.activeRimColor !== null && ripple > 0.45
                    ? this.activeRimColor
                    : ((ripple > 0.65 || this.beatPulse > 0.55)
                        ? COLORS.white
                        : (ripple > 0.25 ? COLORS.cyan : COLORS.lightBlue));
                this.gridRect(ctx, sCol - Math.floor(shimW * 0.5), row, shimW, 1, shimCol);
            }
        }

        // 5. Aspect-Ratio-Locked Winding Cobblestone Road
        // Starts flush at this.gateCol and sweeps gracefully to Golden Ratio (0.62 * cols)
        const targetEndCol = cols * 0.62;
        const deltaCols = targetEndCol - this.gateCol;

        for (let r = 0; r < fgRows; r++) {
            const depth = r / Math.max(1, fgRows);
            const row = hRow + r;
            const pCol = Math.round(
                this.gateCol + Math.pow(depth, 0.92) * deltaCols + Math.sin(depth * Math.PI * 2.0) * (cols * 0.05)
            );
            const pW = 3 + Math.floor(depth * Math.min(18, cols * 0.09));
            const leftRoad = pCol - Math.floor(pW * 0.5);

            const isThreshold = depth < 0.10 && this.beatPulse > 0.25;
            const isCobbleBand = (r % 2) === 0;
            const roadCol = isThreshold
                ? COLORS.yellow
                : (depth < 0.20
                    ? (isCobbleBand ? COLORS.orange : COLORS.brown)
                    : (depth < 0.58
                        ? (isCobbleBand ? COLORS.brown : COLORS.darkGrey)
                        : (isCobbleBand ? COLORS.darkGrey : COLORS.grey)));

            this.gridRect(ctx, leftRoad, row, pW, 1, roadCol);
            // Crisp moonlit left curbstone & shadowed right curbstone
            this.gridRect(ctx, leftRoad - 1, row, 1, 1, COLORS.lightGrey);
            this.gridRect(ctx, leftRoad + pW, row, 1, 1, COLORS.darkGrey);
        }

        // 6. Beat-Chasing Medieval Torch-Posts along the Cobblestone Road
        const activeChaserIdx = ((3 - (this.lastBeatCount % 4)) + 4) % 4;
        for (let tIdx = 0; tIdx < PATH_TORCH_DEPTHS.length; tIdx++) {
            const depth = PATH_TORCH_DEPTHS[tIdx];
            const tRow = hRow + Math.floor(depth * fgRows);
            const pCol = Math.round(
                this.gateCol + Math.pow(depth, 0.92) * deltaCols + Math.sin(depth * Math.PI * 2.0) * (cols * 0.05)
            );
            const pW = 3 + Math.floor(depth * Math.min(18, cols * 0.09));
            const side = (tIdx & 1) === 0 ? -1 : 1;
            const postCol = pCol + side * (Math.floor(pW * 0.5) + 2);
            const postH = 3 + tIdx;

            const isChaserLit = tIdx === activeChaserIdx && this.beatPulse > 0.15;
            const poolW = Math.max(2, Math.floor(pW * 0.65));
            this.gridRect(ctx, pCol - Math.floor(poolW * 0.5), tRow, poolW, 1, isChaserLit ? COLORS.yellow : COLORS.orange);

            this.gridRect(ctx, postCol, tRow - postH, 1, postH, COLORS.brown);
            this.drawGridTorch(ctx, postCol, tRow - postH, tIdx * 1.6);
        }

        // 7. Cluster of Bob Ross "Happy Little Evergreens" Framing Right & Left Banks
        this.drawBobRossEvergreen(ctx, Math.floor(cols * 0.79), hRow + 3, Math.floor(fgRows * 0.34));
        this.drawBobRossEvergreen(ctx, Math.floor(cols * 0.85), hRow + 2, Math.floor(fgRows * 0.45));
        this.drawBobRossEvergreen(ctx, Math.floor(cols * 0.91), hRow + 5, Math.floor(fgRows * 0.38));
        this.drawBobRossEvergreen(ctx, Math.floor(cols * 0.96), hRow + 8, Math.floor(fgRows * 0.28));
        this.drawBobRossEvergreen(ctx, Math.max(14, archCol - 9), hRow + 4, Math.floor(fgRows * 0.30));

        // 8. Grand Foreground Repoussoir Gnarled Oak on the Far Left
        this.drawRepoussoirOak(
            ctx,
            Math.floor(cols * 0.06),
            hRow + Math.floor(fgRows * 0.56),
            Math.floor(fgRows * 0.96)
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

        // C64 integer pixel quantization & unified column/row grid
        this.pixelSize = Math.max(1, Math.floor(Math.min(width, height) / 100));
        this.totalCols = Math.ceil(width / this.pixelSize);
        this.horizonRow = Math.floor((height * this.floorHorizon) / this.pixelSize);
        this.floorY = this.horizonRow * this.pixelSize;

        // Update musical beat, tension & atmospheric timers
        this.updateAudioState(dt, t, state, metrics);

        // LAYER 1: Night Sky, Unmasked Crescent Moon, Lightning, Stars & Clouds
        this.drawSky(ctx, width, height, t);

        // LAYER 2: Multi-Tier Fireworks in the Sky (Behind Mountains & Castle)
        this.updateFireworks(ctx, width, height, t);

        // LAYER 3: Unified Carpathian Mountains with Clean 1px Ridge Contours
        this.drawMountains(ctx);

        // LAYER 4: C64 Hardware-Sprite Vampire Bats
        this.updateAndDrawBats(ctx, dt, t);

        // LAYER 5: Integer-Grid Castlevania Citadel with Concave Spire Contours
        this.drawCastle(ctx);

        // LAYER 6: Waterfall, Stream, Locked Cobblestone Road & Framed Trees
        this.drawForeground(ctx);

        // DSE Lifecycle Transitions (Ordered Dither Crossfade)
        let visibility = 1;
        if (state === 'starting') visibility = clamp(stateTime / 1.5, 0, 1);
        else if (state === 'stopping') visibility = clamp(1 - stateTime / 1.5, 0, 1);
        applyOrderedDitherFade(ctx, width, height, visibility);
    }
}