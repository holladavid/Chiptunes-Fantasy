// === js/visuals/dse/universal/limit-bar.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: LIMIT BAR (v4.0.0 - Demoscene Hardware Edition)
// 100% Alpha-free, Zero per-frame allocations, strict palette & bounds compliance.
// C64:   VIC-II $D020/$D021 scanline rasterbars, beveled fat-pixel segments & 3 SID LEDs.
// Amiga: Precomputed 12-bit OCS copperlist + EHB shading, blitter sweep & L-R-R-L DMA pips.
// Atari: 9-bit Shifter bezel, Timer-B split pulse, YM2149 pips & clipped Bresenham sparks.
// =========================================================

import {
    C64_PALETTE,
    rgbToHex,
    quantizeAmiga12Bit,
    quantizeAtari9Bit,
    drawAliasedLineClipped
} from '../../utils/hardware-constraints.js';

function clamp01(value) {
    return Number.isFinite(value) ? Math.max(0.0, Math.min(1.0, value)) : 0.0;
}

function hashU32(seed) {
    let x = (seed | 0) || 1;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296.0;
}

function fillClampedRect(ctx, rx, ry, rw, rh, maxW, maxH) {
    const x0 = Math.max(0, Math.floor(rx));
    const y0 = Math.max(0, Math.floor(ry));
    const x1 = Math.min(maxW, Math.floor(rx) + Math.floor(rw));
    const y1 = Math.min(maxH, Math.floor(ry) + Math.floor(rh));
    if (x1 > x0 && y1 > y0) {
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
}

function makeAmigaCopperRamp(stops) {
    const lut = new Array(64);
    const lastIdx = stops.length - 1;
    for (let i = 0; i < 64; i++) {
        const scaled = (i / 63) * lastIdx;
        const idx = Math.min(lastIdx - 1, Math.floor(scaled));
        const frac = scaled - idx;
        const a = stops[idx];
        const b = stops[idx + 1];

        const r = Math.round(a[0] + (b[0] - a[0]) * frac);
        const g = Math.round(a[1] + (b[1] - a[1]) * frac);
        const bl = Math.round(a[2] + (b[2] - a[2]) * frac);

        const qMid = quantizeAmiga12Bit(r, g, bl);
        const qTop = quantizeAmiga12Bit(Math.min(255, r + 52), Math.min(255, g + 52), Math.min(255, bl + 52));
        // EHB (Extra Half-Brite): authentische 50%-Bitplane-Abdunklung fuer die Unterkante
        const qLow = quantizeAmiga12Bit(qMid[0] >> 1, qMid[1] >> 1, qMid[2] >> 1);

        lut[i] = {
            top: rgbToHex(qTop[0], qTop[1], qTop[2]),
            mid: rgbToHex(qMid[0], qMid[1], qMid[2]),
            low: rgbToHex(qLow[0], qLow[1], qLow[2])
        };
    }
    return lut;
}

export class LimitBar {
    constructor() {
        this.slideLevel = 0.0;
        this.lastT = null;
        this.lastBeatCount = -1;
        this.palettePhase = 0;
        this.beatFlip = 0;

        this.clipRect = { x: 0, y: 0, width: 0, height: 0 };

        // Vorberechnete Sinus-LUT fuer Copper-Sweeps & deterministische Bahnen
        this.sinLUT = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
            this.sinLUT[i] = Math.sin((i / 256) * Math.PI * 2);
        }

        // --- C64: 16 feste Colodore-Hex-Farben & Rasterbar-Tabellen (0 Allokationen im Loop) ---
        this.c64Hex = C64_PALETTE.map(c => rgbToHex(c[0], c[1], c[2]));
        this.c64RasterNormal = [6, 4, 14, 3, 15, 1, 15, 3, 14, 4].map(idx => this.c64Hex[idx]);
        this.c64RasterClimax = [2, 8, 10, 7, 1, 7, 10, 8].map(idx => this.c64Hex[idx]);
        this.c64RasterAfterglow = [6, 11, 14, 12, 3, 12, 14, 11].map(idx => this.c64Hex[idx]);
        this.c64VoiceColors = [14, 3, 7].map(idx => this.c64Hex[idx]);

        // --- AMIGA: 12-Bit OCS Copperlist LUTs + EHB ---
        this.amigaCopperNormal = makeAmigaCopperRamp([
            [0, 34, 153],
            [0, 187, 255],
            [255, 136, 0],
            [255, 17, 34]
        ]);
        this.amigaCopperClimax = makeAmigaCopperRamp([
            [102, 0, 170],
            [255, 0, 136],
            [255, 204, 0],
            [255, 255, 255]
        ]);
        this.amigaCopperAfterglow = makeAmigaCopperRamp([
            [0, 17, 85],
            [0, 102, 136],
            [102, 204, 255],
            [204, 238, 255]
        ]);

        const aBezelHi = quantizeAmiga12Bit(102, 136, 170);
        const aBezelLo = quantizeAmiga12Bit(17, 34, 68);
        const aSweepShoulder = quantizeAmiga12Bit(170, 238, 255);
        const aSweepCore = quantizeAmiga12Bit(255, 255, 255);
        const aPipCool = quantizeAmiga12Bit(0, 204, 255);
        const aPipHot = quantizeAmiga12Bit(255, 170, 0);

        this.amigaHex = {
            black: '#000000',
            bezelHi: rgbToHex(aBezelHi[0], aBezelHi[1], aBezelHi[2]),
            bezelLo: rgbToHex(aBezelLo[0], aBezelLo[1], aBezelLo[2]),
            sweepShoulder: rgbToHex(aSweepShoulder[0], aSweepShoulder[1], aSweepShoulder[2]),
            sweepCore: rgbToHex(aSweepCore[0], aSweepCore[1], aSweepCore[2]),
            pipCool: rgbToHex(aPipCool[0], aPipCool[1], aPipCool[2]),
            pipHot: rgbToHex(aPipHot[0], aPipHot[1], aPipHot[2])
        };

        // --- ATARI ST: 9-Bit Shifter-Farbtabelle (max #fcfcfc = 7*36) ---
        const qAtari = (r, g, b) => {
            const c = quantizeAtari9Bit(r, g, b);
            return rgbToHex(c[0], c[1], c[2]);
        };
        this.atariHex = {
            black: '#000000',
            bezelDark: qAtari(36, 36, 36),
            bezelHi: qAtari(108, 108, 108),
            green: qAtari(72, 252, 72),
            lime: qAtari(180, 252, 0),
            yellow: qAtari(252, 252, 36),
            amber: qAtari(252, 144, 0),
            red: qAtari(252, 36, 36),
            cyan: qAtari(0, 252, 252),
            blue: qAtari(36, 144, 252),
            white: qAtari(252, 252, 252)
        };
        this.atariTimerBColors = [
            this.atariHex.cyan,
            this.atariHex.lime,
            this.atariHex.yellow,
            this.atariHex.white
        ];
    }

    resize(width, height) {}

    render(ctx, width, height, t, state, stateTime, metrics) {
        if (width <= 0 || height <= 0 || !Number.isFinite(width / height)) {
            this.lastT = Number.isFinite(t) ? t : this.lastT;
            return;
        }
        if (state === 'idle') {
            this.lastT = Number.isFinite(t) ? t : this.lastT;
            return;
        }

        const isFirstFrame = this.lastT === null;
        let dt = 0.02;
        if (!isFirstFrame && Number.isFinite(t)) {
            const rawDt = t - this.lastT;
            if (Number.isFinite(rawDt) && rawDt > 0) {
                dt = Math.min(rawDt, 0.1);
            } else if (rawDt === 0) {
                dt = 0;
            }
        }
        this.lastT = Number.isFinite(t) ? t : this.lastT;

        const safeMetrics = metrics || {};
        const safeTime = Number.isFinite(t) ? t : 0;
        const safeStateTime = Number.isFinite(stateTime) ? Math.max(0, stateTime) : 0;

        // Diskrete Beat-Phase ausschliesslich ueber beatStarted fortschalten (kein Retrigger durch beat[0])
        if (safeMetrics.beatStarted) {
            const count = Number.isFinite(safeMetrics.beatCount)
                ? safeMetrics.beatCount
                : (this.lastBeatCount + 1);
            if (count !== this.lastBeatCount) {
                this.lastBeatCount = count;
                this.palettePhase = (this.palettePhase + 1) & 255;
                this.beatFlip = count & 1;
            }
        }

        const beat = clamp01(safeMetrics.beat?.[0]);
        const rawImpulse = safeMetrics.beatImpulse?.[0];
        const beatImpulse = Number.isFinite(rawImpulse) ? clamp01(rawImpulse) : beat;
        const beatPunch = Math.ceil(beatImpulse * 3);

        const isClimax = state === 'climax';
        const isAfterglow = state === 'afterglow';
        const isBuildup = state === 'buildup';

        let pct = clamp01(safeMetrics.tensionPct);
        let animIntensity = isClimax ? 1.0 : (isAfterglow ? Math.max(0.05, pct * 0.45) : pct);

        if (isClimax) {
            if (safeMetrics.rawEnergyState === 'climax') {
                pct = 1.0;
            } else if (safeMetrics.isClimaxLocked) {
                const holdTime = (Number.isFinite(safeMetrics.climaxHoldTime) && safeMetrics.climaxHoldTime > 0)
                    ? safeMetrics.climaxHoldTime
                    : 10.0;
                const climaxTimer = Number.isFinite(safeMetrics.climaxTimer) ? safeMetrics.climaxTimer : 0;
                pct = clamp01(1.0 - (climaxTimer / holdTime));
            }
        }

        const isFlashing = isClimax && beatImpulse > 0.5;
        const isActive = (pct > 0.001 || isClimax || Boolean(safeMetrics.isClimaxLocked));
        const targetSlide = isActive ? 1.0 : 0.0;

        // Bei direktem Einstieg in einen aktiven Zustand (z. B. Tests mit warmup: 0) sofort zeigen,
        // ansonsten weicher Schlitteneinzug ueber dt (refreshraten-unabhaengig).
        if (isFirstFrame && state !== 'starting' && state !== 'stopping' && isActive) {
            this.slideLevel = 1.0;
        } else {
            const slideStep = dt > 0 ? (1.0 - Math.exp(-8.0 * dt)) : 0.0;
            this.slideLevel += (targetSlide - this.slideLevel) * slideStep;
        }

        let transitionFactor = 1.0;
        if (state === 'starting') transitionFactor = Math.min(1.0, safeStateTime / 1.5);
        else if (state === 'stopping') transitionFactor = Math.max(0.0, 1.0 - (safeStateTime / 1.5));

        const visibleAmount = transitionFactor * this.slideLevel;
        if (visibleAmount <= 0.001) return;

        // Responsive Geometrie fuer Portrait, Landscape, Desktop & Ultrawide
        const minDim = Math.min(width, height);
        const w = Math.max(20, Math.min(width - 4, Math.floor(width * 0.76)));
        const h = Math.max(4, Math.min(10, Math.floor(minDim * 0.032))) | 0;
        const x = Math.max(0, Math.floor((width - w) / 2));
        const bottomMargin = Math.max(4, Math.floor(height * 0.055));
        const targetY = Math.max(0, height - h - bottomMargin);

        const currentY = Math.floor(height - (height - targetY) * visibleAmount);
        if (currentY >= height) return;

        this.clipRect.width = width;
        this.clipRect.height = height;

        const smooth = safeMetrics.smooth;
        const sys = safeMetrics.system;

        if (sys === 'c64') {
            this.renderC64(ctx, width, height, x, currentY, w, h, pct, animIntensity, beatImpulse, beatPunch, isClimax, isAfterglow, isBuildup, isFlashing, safeTime, smooth);
        } else if (sys === 'amiga') {
            this.renderAmiga(ctx, width, height, x, currentY, w, h, pct, animIntensity, beatImpulse, beatPunch, isClimax, isAfterglow, isBuildup, safeTime, smooth);
        } else {
            this.renderAtari(ctx, width, height, x, currentY, w, h, pct, animIntensity, beatImpulse, beatPunch, isClimax, isAfterglow, isBuildup, isFlashing, safeTime, smooth);
        }
    }

    renderC64(ctx, width, height, x, currentY, w, h, pct, animIntensity, beatImpulse, beatPunch, isClimax, isAfterglow, isBuildup, isFlashing, t, smooth) {
        const c64 = this.c64Hex;
        const showChannelLeds = w >= 72 && h >= 5;
        const ledWingW = showChannelLeds ? 8 : 0;
        const barX = x + ledWingW;
        const barW = Math.max(16, w - ledWingW);

        const segCount = Math.max(8, Math.min(24, Math.floor(barW / 9)));
        const gap = barW >= segCount * 4 ? 2 : 1;
        const segW = Math.max(1, Math.floor((barW + gap) / segCount) - gap);
        const activeSegs = Math.floor(pct * segCount + (pct > 0.01 ? 0.25 : 0));
        const activeW = activeSegs > 0 ? Math.min(barW, activeSegs * (segW + gap) - gap) : 0;

        // 1. VIC-II $D020/$D021 Raster-Splits hinter der aktiven Bar (Reaktion auf beatImpulse & beatStarted)
        if (animIntensity > 0.04 && activeW > 0) {
            const borderThick = Math.floor(1 + animIntensity * 2) + beatPunch;
            const rasterList = isClimax
                ? this.c64RasterClimax
                : (isAfterglow ? this.c64RasterAfterglow : this.c64RasterNormal);
            const rasterLen = rasterList.length;
            const rasterSpeed = isClimax ? 20 : (isBuildup ? 13 : (isAfterglow ? 4 : 8));
            const scrollBase = Math.floor(t * rasterSpeed) + this.palettePhase * 2;
            const totalRasterH = h + borderThick * 2;
            const stripeCount = Math.min(8, Math.max(4, totalRasterH));
            const stripeH = Math.max(1, Math.ceil(totalRasterH / stripeCount));

            for (let i = 0; i < stripeCount; i++) {
                let colIdx = (scrollBase + i) % rasterLen;
                if (isClimax && beatImpulse > 0.35 && ((i + this.beatFlip) & 1) === 0) {
                    colIdx = 4; // VIC-II Weiss/Gelb-Akzent im Climax-Beat
                }
                ctx.fillStyle = rasterList[colIdx];
                fillClampedRect(
                    ctx,
                    x - borderThick,
                    currentY - borderThick + i * stripeH,
                    (barX - x) + activeW + borderThick * 2,
                    stripeH,
                    width,
                    height
                );
            }
        }

        // 2. Schwarzes VIC-II Kontrast-Chassis mit 1px Bevel-Kante (Lesbarkeit vor Plasma/Sunset)
        ctx.fillStyle = c64[0];
        fillClampedRect(ctx, x - 2, currentY - 2, w + 4, h + 4, width, height);
        ctx.fillStyle = isClimax && beatImpulse > 0.4 ? c64[7] : c64[12];
        fillClampedRect(ctx, x - 1, currentY - 1, w + 2, 1, width, height);
        ctx.fillStyle = c64[11];
        fillClampedRect(ctx, x - 1, currentY + h, w + 2, 1, width, height);

        // 3. 3 physische SID-Stimmen-LEDs (2x1 Multicolor-Feeling im linken Gehaeuse)
        if (showChannelLeds) {
            const pipH = Math.max(1, Math.floor((h - 2) / 3));
            for (let v = 0; v < 3; v++) {
                const lvl = clamp01(smooth?.[v]);
                const py = currentY + v * (pipH + 1);
                if (py + pipH <= currentY + h) {
                    ctx.fillStyle = lvl > 0.55 ? c64[1] : (lvl > 0.14 ? this.c64VoiceColors[v] : c64[11]);
                    fillClampedRect(ctx, x + 1, py, lvl > 0.2 ? 5 : 3, pipH, width, height);
                }
            }
        }

        // 4. Stepped Colodore-Segmente mit oberer Highlight-Kante & Schattenfuss
        for (let i = 0; i < activeSegs; i++) {
            const ratio = i / Math.max(1, segCount - 1);
            let bodyColor;
            let hiColor;
            if (isAfterglow) {
                bodyColor = ratio > 0.65 ? c64[3] : c64[14];
                hiColor = c64[1];
            } else if (ratio >= 0.85) {
                bodyColor = c64[10]; // LtRed Peak
                hiColor = c64[7];    // Yellow Edge
            } else if (ratio >= 0.52) {
                bodyColor = c64[7];  // Yellow Mid-High
                hiColor = c64[1];    // White Edge
            } else {
                bodyColor = c64[14]; // LtBlue Base
                hiColor = c64[3];    // Cyan Edge
            }

            if (isFlashing || (i === activeSegs - 1 && beatImpulse > 0.65)) {
                bodyColor = c64[1];
                hiColor = c64[1];
            }

            const sx = barX + i * (segW + gap);
            ctx.fillStyle = bodyColor;
            fillClampedRect(ctx, sx, currentY, segW, h, width, height);
            if (h >= 5) {
                ctx.fillStyle = hiColor;
                fillClampedRect(ctx, sx, currentY, segW, 1, width, height);
                ctx.fillStyle = c64[6];
                fillClampedRect(ctx, sx, currentY + h - 1, segW, 1, width, height);
            }
        }
    }

    renderAmiga(ctx, width, height, x, currentY, w, h, pct, animIntensity, beatImpulse, beatPunch, isClimax, isAfterglow, isBuildup, t, smooth) {
        const ax = this.amigaHex;
        const showDmaPips = w >= 88 && h >= 5;
        const wingW = showDmaPips ? 8 : 0;
        const barX = x + wingW;
        const barW = Math.max(16, w - wingW * 2);
        const activeW = Math.floor(barW * pct);

        // 1. OCS Metall-Gehaeuse & Copper-Schattenrahmen
        ctx.fillStyle = ax.black;
        fillClampedRect(ctx, x - 2, currentY - 2, w + 4, h + 4, width, height);
        ctx.fillStyle = ax.bezelHi;
        fillClampedRect(ctx, x - 1, currentY - 1, w + 2, 1, width, height);
        ctx.fillStyle = ax.bezelLo;
        fillClampedRect(ctx, x - 1, currentY + h, w + 2, 1, width, height);

        // 2. 4 Paula DMA-Kanaele im authentischen L-R-R-L-Layout (links: CH1+CH4, rechts: CH2+CH3)
        if (showDmaPips) {
            const pipH = Math.max(1, Math.floor((h - 1) / 2));
            const leftIdx = [0, 3];
            const rightIdx = [1, 2];
            for (let row = 0; row < 2; row++) {
                const py = currentY + row * (pipH + 1);
                if (py + pipH > currentY + h) continue;
                const lLvl = clamp01(smooth?.[leftIdx[row]]);
                const rLvl = clamp01(smooth?.[rightIdx[row]]);

                ctx.fillStyle = lLvl > 0.65 ? ax.sweepCore : (lLvl > 0.15 ? ax.pipCool : ax.bezelLo);
                fillClampedRect(ctx, x + 1, py, lLvl > 0.25 ? 5 : 3, pipH, width, height);

                ctx.fillStyle = rLvl > 0.65 ? ax.sweepCore : (rLvl > 0.15 ? ax.pipHot : ax.bezelLo);
                const rw = rLvl > 0.25 ? 5 : 3;
                fillClampedRect(ctx, x + w - 1 - rw, py, rw, pipH, width, height);
            }
        }

        // 3. 12-Bit OCS Copperlist + Extra-Half-Brite (EHB) Unterkante
        if (activeW > 0) {
            const lut = isClimax
                ? this.amigaCopperClimax
                : (isAfterglow ? this.amigaCopperAfterglow : this.amigaCopperNormal);
            const stepSize = 4;
            const shimmerShift = isClimax ? (Math.floor(t * 28) + this.palettePhase * 3) : 0;

            for (let px = 0; px < activeW; px += stepSize) {
                const lutIdx = Math.min(63, Math.floor(((px / barW) * 63 + shimmerShift) % 64));
                const entry = lut[lutIdx];
                const drawW = Math.min(stepSize, activeW - px);
                const sx = barX + px;

                ctx.fillStyle = entry.mid;
                fillClampedRect(ctx, sx, currentY, drawW, h, width, height);

                if (h >= 5) {
                    ctx.fillStyle = entry.top;
                    fillClampedRect(ctx, sx, currentY, drawW, 1, width, height);
                    ctx.fillStyle = entry.low;
                    fillClampedRect(ctx, sx, currentY + h - 1, drawW, 1, width, height);
                }
            }
        }

        // 4. Opaquer Blitter-Sweep (Stufenprofil: Glow-Schulter + weissgluehender Kern)
        if (animIntensity > 0.04 && activeW > 0) {
            const speed = isClimax ? 10 : (isBuildup ? 6 : (isAfterglow ? 1.8 : 3.2));
            const phaseIdx = Math.floor(((t * speed) % (Math.PI * 2)) / (Math.PI * 2) * 256) & 255;
            const sweepPos = Math.floor((this.sinLUT[phaseIdx] * 0.5 + 0.5) * activeW);

            const sweepPunch = Math.ceil(beatImpulse * 4);
            const sweepWidth = 8 + sweepPunch * 2;
            const coreW = Math.max(2, Math.floor(sweepWidth * 0.5));
            const sx = barX + sweepPos - Math.floor(sweepWidth / 2);
            const cx = barX + sweepPos - Math.floor(coreW / 2);

            ctx.fillStyle = ax.sweepShoulder;
            fillClampedRect(ctx, sx, currentY - 1 - Math.floor(sweepPunch * 0.5), sweepWidth, h + 2 + sweepPunch, width, height);
            ctx.fillStyle = ax.sweepCore;
            fillClampedRect(ctx, cx, currentY - 2 - sweepPunch, coreW, h + 4 + sweepPunch * 2, width, height);

            // Climax-Copper-Orbiter an beiden Enden des Balkens
            if (isClimax) {
                const orbIdxL = Math.floor(((t * 14) % (Math.PI * 2)) / (Math.PI * 2) * 256) & 255;
                const orbIdxR = (orbIdxL + 128) & 255;
                const bYL = Math.floor(currentY + h / 2 + this.sinLUT[orbIdxL] * (3 + beatPunch));
                const bYR = Math.floor(currentY + h / 2 + this.sinLUT[orbIdxR] * (3 + beatPunch));
                ctx.fillStyle = ax.sweepCore;
                fillClampedRect(ctx, x - 5, bYL - 1, 3, 2, width, height);
                fillClampedRect(ctx, x + w + 2, bYR - 1, 3, 2, width, height);
            }
        }
    }

    renderAtari(ctx, width, height, x, currentY, w, h, pct, animIntensity, beatImpulse, beatPunch, isClimax, isAfterglow, isBuildup, isFlashing, t, smooth) {
        const at = this.atariHex;
        const showYmPips = w >= 72 && h >= 5;
        const wingW = showYmPips ? 8 : 0;
        const barX = x + wingW;
        const barW = Math.max(16, w - wingW);

        const segCount = Math.max(8, Math.min(28, Math.floor(barW / 8)));
        const gap = barW >= segCount * 4 ? 2 : 1;
        const segW = Math.max(1, Math.floor((barW + gap) / segCount) - gap);
        const activeSegs = Math.floor(pct * segCount + (pct > 0.01 ? 0.25 : 0));
        const activeW = activeSegs > 0 ? Math.min(barW, activeSegs * (segW + gap) - gap) : 0;

        // 1. Bresenham-Vektorfunken (<= 28 geclippte Vektoren, zeitbasiert & deterministisch)
        if (animIntensity > 0.04 && activeW > 0) {
            let numSparks = Math.min(28, Math.floor(animIntensity * 12) + Math.ceil(beatImpulse * 10));
            if (isClimax) numSparks = 28;
            else if (isAfterglow) numSparks = Math.min(10, Math.max(2, Math.floor(numSparks * 0.45)));

            const timeStep = Math.floor(t * (isClimax ? 28 : (isBuildup ? 20 : 14)));
            const baseSeed = timeStep * 73 + this.palettePhase * 197;

            for (let i = 0; i < numSparks; i++) {
                const s1 = hashU32(baseSeed + i * 37);
                const s2 = hashU32(baseSeed + i * 89 + 11);
                const s3 = hashU32(baseSeed + i * 149 + 29);

                const edge = Math.floor(s1 * 5); // 0..3 Umfang, 4 = wandernde Spitze
                let sx, sy, dx, dy;
                const offset = (s2 - 0.5) * (4 + animIntensity * 6 + beatImpulse * 5);
                const sparkLen = s3 * (4 * animIntensity + beatImpulse * 12) + (isClimax ? 2 : 0);

                if (edge === 0) {
                    sx = barX + s1 * activeW; sy = currentY - 3;
                    dx = sx + offset; dy = sy - sparkLen;
                } else if (edge === 1) {
                    sx = barX + s1 * activeW; sy = currentY + h + 3;
                    dx = sx + offset; dy = sy + sparkLen;
                } else if (edge === 2) {
                    sx = x - 3; sy = currentY + s1 * h;
                    dx = sx - sparkLen; dy = sy + offset;
                } else if (edge === 4) {
                    // Spitzenfunken am aktiven Balkenende
                    sx = barX + activeW + 1; sy = currentY + s2 * h;
                    dx = sx + sparkLen * 1.25; dy = sy + (s1 - 0.5) * (8 + beatImpulse * 6);
                } else {
                    sx = barX + activeW + 3; sy = currentY + s1 * h;
                    dx = sx + sparkLen; dy = sy + offset;
                }

                const sparkColor = isAfterglow
                    ? at.cyan
                    : ((isClimax || (beatImpulse > 0.55 && (i & 1) === 0)) ? at.white : (s3 > 0.7 ? at.lime : at.green));

                drawAliasedLineClipped(
                    ctx,
                    Math.round(sx),
                    Math.round(sy),
                    Math.round(dx),
                    Math.round(dy),
                    sparkColor,
                    this.clipRect
                );
            }
        }

        // 2. 9-Bit Shifter Chassis & Timer-B Raster-Split-Kante
        ctx.fillStyle = at.black;
        fillClampedRect(ctx, x - 2, currentY - 2, w + 4, h + 4, width, height);
        ctx.fillStyle = at.bezelHi;
        fillClampedRect(ctx, x - 1, currentY - 1, w + 2, 1, width, height);
        ctx.fillStyle = at.bezelDark;
        fillClampedRect(ctx, x - 1, currentY + h, w + 2, 1, width, height);

        if (activeW > 0 && animIntensity > 0.05) {
            const tbSpeed = isClimax ? 2.4 : (isBuildup ? 1.5 : 0.8);
            const tbPos = Math.floor(((t * tbSpeed) % 1.0) * Math.max(1, w - 10));
            const tbLen = Math.min(w, 10 + beatPunch * 4);
            ctx.fillStyle = isAfterglow
                ? at.cyan
                : this.atariTimerBColors[this.palettePhase % this.atariTimerBColors.length];
            fillClampedRect(ctx, x + tbPos, currentY - 1, tbLen, 1, width, height);
            fillClampedRect(ctx, x + Math.max(0, w - tbPos - tbLen), currentY + h, tbLen, 1, width, height);
        }

        // 3. 3 YM2149 Pips (CH A / CH B / CH C)
        if (showYmPips) {
            const pipH = Math.max(1, Math.floor((h - 2) / 3));
            for (let v = 0; v < 3; v++) {
                const lvl = clamp01(smooth?.[v]);
                const py = currentY + v * (pipH + 1);
                if (py + pipH <= currentY + h) {
                    ctx.fillStyle = lvl > 0.6
                        ? at.white
                        : (lvl > 0.14 ? (isAfterglow ? at.cyan : at.green) : at.bezelDark);
                    fillClampedRect(ctx, x + 1, py, lvl > 0.2 ? 5 : 3, pipH, width, height);
                }
            }
        }

        // 4. Gestufte 9-Bit Shifter-Segmente (max <= 8 Farben/Scanline, keine #ffffff-Verletzung)
        for (let i = 0; i < activeSegs; i++) {
            const ratio = i / Math.max(1, segCount - 1);
            let bodyColor;
            if (isAfterglow) {
                bodyColor = ratio > 0.6 ? at.cyan : at.blue;
            } else if (ratio >= 0.90) {
                bodyColor = at.red;
            } else if (ratio >= 0.68) {
                bodyColor = at.amber;
            } else if (ratio >= 0.45) {
                bodyColor = at.yellow;
            } else {
                bodyColor = at.green;
            }

            if (isFlashing || (i === activeSegs - 1 && beatImpulse > 0.65)) {
                bodyColor = at.white;
            }

            const sx = barX + i * (segW + gap);
            ctx.fillStyle = bodyColor;
            fillClampedRect(ctx, sx, currentY, segW, h, width, height);
            if (h >= 5 && !isFlashing) {
                ctx.fillStyle = isAfterglow ? at.white : at.lime;
                fillClampedRect(ctx, sx, currentY, Math.min(segW, 2), 1, width, height);
            }
        }
    }
}