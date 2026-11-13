// === js/visuals/dse/amiga/paula-silicon-bg.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: PAULA 8364 MICROVERSE
// Pure retro-buffer Amiga OCS Copper sky, dual-center Moire
// interference, 4 stereo DMA hardware towers (L-R-R-L) and
// 3D silicon bus floor — 100% DOM-free, zero alpha, zero AA.
// Horizon aligned with KefrensCheckerboard at floor(height * 0.55).
// =========================================================

import { quantizeAmiga12Bit, rgbToHex } from '../../utils/hardware-constraints.js';

const TWO_PI = Math.PI * 2;
const Z_MAX = 380;
const Z_STEP = 18;
const TRANSITION_DURATION = 1.15;

// 4x4 Bayer threshold matrix (0..15) for floor/sky power-on/off dither
const BAYER_4X4 = Object.freeze([
    0, 8, 2, 10,
    12, 4, 14, 6,
    3, 11, 1, 9,
    15, 7, 13, 5
]);

// Precompute all 4096 Amiga 12-bit OCS hex colors once
const AMIGA_HEX_LUT = (() => {
    const lut = new Array(4096);
    for (let r4 = 0; r4 < 16; r4++) {
        for (let g4 = 0; g4 < 16; g4++) {
            for (let b4 = 0; b4 < 16; b4++) {
                const [qr, qg, qb] = quantizeAmiga12Bit(r4 * 17, g4 * 17, b4 * 17);
                lut[(r4 << 8) | (g4 << 4) | b4] = rgbToHex(qr, qg, qb);
            }
        }
    }
    return Object.freeze(lut);
})();

// Precompute one octant (0 <= x <= y) of concentric Moire circle offsets once
const MOIRE_OCTANT_POINTS = (() => {
    const pts = [];
    for (let r = 12; r <= 124; r += 16) {
        let x = 0;
        let y = r;
        let d = 3 - 2 * r;
        while (y >= x) {
            pts.push(x, y);
            x++;
            if (d > 0) {
                y--;
                d = d + 4 * (x - y) + 10;
            } else {
                d = d + 4 * x + 6;
            }
        }
    }
    return Int16Array.from(pts);
})();

function clamp01(v) {
    if (!Number.isFinite(v)) return 0;
    return v < 0 ? 0 : (v > 1 ? 1 : v);
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function readChannel(arr, idx, fallback) {
    if (!arr || idx >= arr.length) return fallback;
    return clamp01(arr[idx]);
}

function toAmigaHex(r, g, b) {
    const r4 = r <= 0 ? 0 : (r >= 255 ? 15 : Math.round(r / 17));
    const g4 = g <= 0 ? 0 : (g >= 255 ? 15 : Math.round(g / 17));
    const b4 = b <= 0 ? 0 : (b >= 255 ? 15 : Math.round(b / 17));
    return AMIGA_HEX_LUT[(r4 << 8) | (g4 << 4) | b4];
}

function fillClippedRect(ctx, x, y, rw, rh, bufW, bufH, minY = 0, maxY = bufH) {
    let x0 = Math.floor(x);
    let y0 = Math.floor(y);
    let x1 = Math.floor(x + rw);
    let y1 = Math.floor(y + rh);
    if (x0 < 0) x0 = 0;
    if (y0 < minY) y0 = minY;
    if (x1 > bufW) x1 = bufW;
    if (y1 > maxY) y1 = maxY;
    const cw = x1 - x0;
    const ch = y1 - y0;
    if (cw > 0 && ch > 0) {
        ctx.fillRect(x0, y0, cw, ch);
    }
}

function drawClippedLine(ctx, x0, y0, x1, y1, minX, minY, maxX, maxY) {
    if (
        !Number.isFinite(x0) || !Number.isFinite(y0) ||
        !Number.isFinite(x1) || !Number.isFinite(y1) ||
        maxX < minX || maxY < minY
    ) {
        return;
    }

    let t0 = 0;
    let t1 = 1;
    const dx = x1 - x0;
    const dy = y1 - y0;

    const clipTest = (p, q) => {
        if (p === 0) return q >= 0;
        const r = q / p;
        if (p < 0) {
            if (r > t1) return false;
            if (r > t0) t0 = r;
        } else {
            if (r < t0) return false;
            if (r < t1) t1 = r;
        }
        return true;
    };

    if (
        !clipTest(-dx, x0 - minX) ||
        !clipTest(dx, maxX - x0) ||
        !clipTest(-dy, y0 - minY) ||
        !clipTest(dy, maxY - y0)
    ) {
        return;
    }

    let cx0 = Math.floor(x0 + t0 * dx);
    let cy0 = Math.floor(y0 + t0 * dy);
    let cx1 = Math.floor(x0 + t1 * dx);
    let cy1 = Math.floor(y0 + t1 * dy);

    cx0 = cx0 < minX ? minX : (cx0 > maxX ? maxX : cx0);
    cy0 = cy0 < minY ? minY : (cy0 > maxY ? maxY : cy0);
    cx1 = cx1 < minX ? minX : (cx1 > maxX ? maxX : cx1);
    cy1 = cy1 < minY ? minY : (cy1 > maxY ? maxY : cy1);

    const adx = Math.abs(cx1 - cx0);
    const ady = Math.abs(cy1 - cy0);
    const sx = cx0 < cx1 ? 1 : -1;
    const sy = cy0 < cy1 ? 1 : -1;
    let err = adx - ady;
    const maxSteps = adx + ady + 2;

    for (let step = 0; step < maxSteps; step++) {
        ctx.fillRect(cx0, cy0, 1, 1);
        if (cx0 === cx1 && cy0 === cy1) break;
        const e2 = err * 2;
        if (e2 > -ady) {
            err -= ady;
            cx0 += sx;
        }
        if (e2 < adx) {
            err += adx;
            cy0 += sy;
        }
    }
}

export class PaulaSiliconBg {
    constructor() {
        this.name = 'Paula 8364 Microverse';

        // Time & state tracking
        this.lastT = null;
        this.lastState = 'idle';
        this.stateAge = 0;

        // Continuous simulation phases (preserved across resize/rotation)
        this.scrollZ = 0;
        this.moirePhase = 0;
        this.starPhase = 0;
        this.dmaTime = 0;
        this.smoothedSpeed = 1.0;
        this.afterglowMix = 0.0;

        // Discrete beat-driven state
        this.lastBeatCount = 0;
        this.moirePaletteMode = 0;
        this.beatDirection = 1;
        this.zWaveAge = 10.0;
        this.zWavePeak = 0.0;
        this.syncGlitchAge = 10.0;

        // Instance-owned deterministic Xorshift32 PRNG (zero Math.random!)
        this.prngState = 0x5041554C; // 'PAUL'

        // Deterministic starfield seeded once per instance
        this.stars = new Array(24);
        for (let i = 0; i < this.stars.length; i++) {
            this.stars[i] = {
                x: this._nextRandom(),
                y: this._nextRandom() * 0.72,
                phase: this._nextRandom() * TWO_PI,
                speed: 2.5 + this._nextRandom() * 3.5
            };
        }
    }

    _nextRandom() {
        let x = this.prngState | 0;
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        this.prngState = x;
        return (x >>> 0) / 4294967296;
    }

    resize() {
        // Projection and DMA layout derive dynamically from width/height;
        // keep continuous simulation phases intact across rotations.
    }

    _drawMoireCenter(ctx, cx, cy, scale, w, horizon, colorHex) {
        const pts = MOIRE_OCTANT_POINTS;
        const maxR = Math.ceil(124 * scale);
        if (cx + maxR < 0 || cx - maxR >= w || cy - maxR >= horizon || cy + maxR < 0) {
            return;
        }

        ctx.fillStyle = colorHex;
        const plot = (px, py) => {
            if (px >= 0 && px < w && py >= 0 && py < horizon) {
                ctx.fillRect(px, py, 1, 1);
            }
        };

        for (let i = 0; i < pts.length; i += 2) {
            const ox = Math.round(pts[i] * scale);
            const oy = Math.round(pts[i + 1] * scale);

            plot(cx + ox, cy + oy);
            plot(cx - ox, cy + oy);
            plot(cx + ox, cy - oy);
            plot(cx - ox, cy - oy);
            if (ox !== oy) {
                plot(cx + oy, cy + ox);
                plot(cx - oy, cy + ox);
                plot(cx + oy, cy - ox);
                plot(cx - oy, cy - ox);
            }
        }
    }

    _drawPowerCurtain(ctx, w, h, horizon, revealRatio) {
        const halfSky = horizon * (1.0 - revealRatio);
        const skyActiveTop = Math.min(horizon, Math.max(0, Math.ceil(halfSky)));
        const floorHeight = Math.max(1, h - horizon);
        const floorActiveBottom = Math.min(
            h,
            Math.max(horizon, horizon + Math.floor(floorHeight * revealRatio))
        );

        ctx.fillStyle = '#000000';
        if (skyActiveTop > 0) {
            ctx.fillRect(0, 0, w, skyActiveTop);
        }
        if (floorActiveBottom < h) {
            ctx.fillRect(0, floorActiveBottom, w, h - floorActiveBottom);
        }

        // Bayer 4x4 ordered-dither frontier bands (pure fillRect, zero getImageData)
        const bandPx = Math.max(4, Math.min(18, Math.floor(h * 0.07)));
        const stepX = Math.max(2, Math.min(4, Math.floor(w * 0.02)));
        const stepY = 2;

        // Top frontier
        const topStart = skyActiveTop;
        const topEnd = Math.min(horizon, skyActiveTop + bandPx);
        for (let y = topStart; y < topEnd; y += stepY) {
            const vis = (y - topStart + 1) / bandPx;
            const bayerRow = ((y >> 1) & 3) * 4;
            for (let x = 0; x < w; x += stepX) {
                if (BAYER_4X4[bayerRow + ((x >> 2) & 3)] >= vis * 16) {
                    const bw = Math.min(stepX, w - x);
                    const bh = Math.min(stepY, topEnd - y);
                    if (bw > 0 && bh > 0) ctx.fillRect(x, y, bw, bh);
                }
            }
        }

        // Bottom frontier
        const botEnd = floorActiveBottom;
        const botStart = Math.max(horizon, floorActiveBottom - bandPx);
        for (let y = botStart; y < botEnd; y += stepY) {
            const vis = (botEnd - y) / bandPx;
            const bayerRow = ((y >> 1) & 3) * 4;
            for (let x = 0; x < w; x += stepX) {
                if (BAYER_4X4[bayerRow + ((x >> 2) & 3)] >= vis * 16) {
                    const bw = Math.min(stepX, w - x);
                    const bh = Math.min(stepY, botEnd - y);
                    if (bw > 0 && bh > 0) ctx.fillRect(x, y, bw, bh);
                }
            }
        }
    }

    render(ctx, width, height, t, state, stateTime, metrics) {
        const safeT = Number.isFinite(t) ? t : (this.lastT !== null ? this.lastT : 0);

        if (
            !ctx ||
            !Number.isFinite(width) ||
            !Number.isFinite(height) ||
            width <= 0 ||
            height <= 0 ||
            !Number.isFinite(width / height)
        ) {
            this.lastT = safeT;
            return;
        }

        const w = Math.floor(width);
        const h = Math.floor(height);
        if (w <= 0 || h <= 0) {
            this.lastT = safeT;
            return;
        }

        if (state === 'idle') {
            this.lastT = safeT;
            this.lastState = 'idle';
            this.stateAge = 0;
            return;
        }

        // Safe PAL-friendly dt clamped against tab switches
        let dt = this.lastT === null ? 0.02 : (safeT - this.lastT);
        this.lastT = safeT;
        if (!Number.isFinite(dt) || dt < 0) {
            dt = 0.02;
        } else if (dt > 0.1) {
            dt = 0.1;
        }

        if (this.lastState !== state) {
            this.lastState = state;
            this.stateAge = 0;
        } else {
            this.stateAge += dt;
        }

        // ---------------------------------------------------------
        // Defensive metric parsing
        // ---------------------------------------------------------
        const safeMetrics = metrics || {};
        const energy = clamp01(safeMetrics.energy ?? 0.35);
        const pulse = clamp01(safeMetrics.pulse ?? 0);
        const tension = clamp01(safeMetrics.tensionPct ?? 0.3);
        const isClimaxLocked = Boolean(safeMetrics.isClimaxLocked);

        const beatArr = safeMetrics.beat;
        const beatEnv = beatArr && beatArr.length > 0 ? clamp01(beatArr[0]) : 0;

        const impulseArr = safeMetrics.beatImpulse;
        const beatImpulse = impulseArr && impulseArr.length > 0
            ? clamp01(impulseArr[0])
            : beatEnv;

        const beatStarted = Boolean(safeMetrics.beatStarted);
        const beatStrength = Number.isFinite(safeMetrics.beatStrength)
            ? clamp01(safeMetrics.beatStrength)
            : beatImpulse;
        const beatLevel = Number.isFinite(safeMetrics.beatLevel) ? safeMetrics.beatLevel : 0;

        const smooth = (Array.isArray(safeMetrics.smooth) || ArrayBuffer.isView(safeMetrics.smooth))
            ? safeMetrics.smooth
            : null;
        const ch0 = readChannel(smooth, 0, energy);
        const ch1 = readChannel(smooth, 1, energy * 0.9);
        const ch2 = readChannel(smooth, 2, energy * 0.8);
        const ch3 = readChannel(smooth, 3, energy * 0.85);
        const vols = [ch0, ch1, ch2, ch3];

        // ---------------------------------------------------------
        // Discrete Beat Events (strictly gated on beatStarted)
        // ---------------------------------------------------------
        const allowDiscreteSwitches = state !== 'afterglow' && state !== 'stopping';
        if (beatStarted) {
            const incomingCount = Number.isFinite(safeMetrics.beatCount)
                ? Math.floor(safeMetrics.beatCount)
                : (this.lastBeatCount + 1);

            if (incomingCount !== this.lastBeatCount || !Number.isFinite(safeMetrics.beatCount)) {
                this.lastBeatCount = incomingCount;
                this.beatDirection = (incomingCount & 1) ? 1 : -1;

                // Trigger Silicon Bus Copper Z-wave scaled by beatLevel/beatStrength
                this.zWaveAge = 0;
                const levelWeight = beatLevel >= 3 ? 1.0 : (beatLevel === 2 ? 0.65 : (beatLevel === 1 ? 0.35 : 0.0));
                this.zWavePeak = Math.max(beatStrength, levelWeight);

                // Controlled hardware DMA sync glitch only on strong climax beats
                if (state === 'climax' && beatLevel >= 3) {
                    this.syncGlitchAge = 0;
                }

                if (allowDiscreteSwitches && incomingCount > 0 && incomingCount % 4 === 0) {
                    this.moirePaletteMode = (this.moirePaletteMode + 1) % 3;
                }
            }
        }

        this.zWaveAge = Math.min(10.0, this.zWaveAge + dt);
        this.syncGlitchAge = Math.min(10.0, this.syncGlitchAge + dt);

        // ---------------------------------------------------------
        // Macro State Dynamics & Tension Mapping
        // ---------------------------------------------------------
        let targetSpeed = 1.0 + tension * 0.4;
        let targetAfterglow = 0.0;
        let moireIntensity = Math.max(0, (tension - 0.18) / 0.82);

        if (state === 'starting') {
            targetSpeed = 0.8;
            moireIntensity *= 0.4;
        } else if (state === 'playing') {
            targetSpeed = 0.9 + tension * 0.45;
            moireIntensity *= 0.55;
        } else if (state === 'buildup') {
            targetSpeed = 1.55 + tension * 0.75;
            moireIntensity = Math.max(0.35, moireIntensity);
        } else if (state === 'climax') {
            targetSpeed = 2.5 + tension * 0.8 + (isClimaxLocked ? 0.25 : 0);
            moireIntensity = 1.0;
        } else if (state === 'afterglow') {
            targetSpeed = 0.30;
            targetAfterglow = 1.0;
            moireIntensity *= 0.45;
        } else if (state === 'stopping') {
            targetSpeed = 0.40;
            moireIntensity *= 0.35;
        }

        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * Math.min(1.0, dt * 4.0);
        this.afterglowMix += (targetAfterglow - this.afterglowMix) * Math.min(1.0, dt * 2.2);
        const ag = this.afterglowMix;

        const effectiveSpeed = Math.max(0.1, this.smoothedSpeed * (1.0 + beatImpulse * (state === 'afterglow' ? 0.12 : 0.45)));
        this.scrollZ = (this.scrollZ + dt * effectiveSpeed * 95) % Z_STEP;
        this.moirePhase = (this.moirePhase + dt * (0.75 + effectiveSpeed * 0.55)) % TWO_PI;
        this.starPhase = (this.starPhase + dt * (1.2 + effectiveSpeed * 0.8)) % TWO_PI;
        this.dmaTime = (this.dmaTime + dt * effectiveSpeed) % 1024;

        // ---------------------------------------------------------
        // Transition Progress (starting / stopping)
        // ---------------------------------------------------------
        let revealRatio = 1.0;
        if (state === 'starting') {
            revealRatio = clamp01((this.stateAge + 0.08) / TRANSITION_DURATION);
        } else if (state === 'stopping') {
            revealRatio = 1.0 - clamp01(this.stateAge / TRANSITION_DURATION);
            if (revealRatio <= 0.001) {
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, w, h);
                return;
            }
        }

        // ---------------------------------------------------------
        // Responsive Geometry (Portrait -> Ultrawide & 3:1 / 1:3)
        // ---------------------------------------------------------
        const minDim = Math.min(w, h);
        const horizon = Math.min(h - 1, Math.max(1, Math.floor(h * 0.55)));
        const floorHeight = Math.max(1, h - horizon);
        const cx = w * 0.5;

        // ---------------------------------------------------------
        // 1. 16-Band Copper Sky (tension & afterglow responsive)
        // ---------------------------------------------------------
        const bandH = Math.max(1, Math.ceil(horizon / 16));
        const skyWarmth = tension * (1.0 - 0.75 * ag);
        const skyBoost = 1.0 + beatImpulse * 0.14 * (1.0 - ag);

        for (let i = 0; i < 16; i++) {
            const bandY = i * bandH;
            if (bandY >= horizon) break;
            const drawH = Math.min(bandH, horizon - bandY);
            const pct = i / 15.0;

            let r;
            let g;
            let b;
            if (skyWarmth < 0.5) {
                r = (pct * 80 + skyWarmth * 100) * skyBoost;
                g = (pct * 22) * skyBoost;
                b = (42 + pct * 148) * skyBoost;
            } else {
                r = (pct * 150 + skyWarmth * 105) * skyBoost;
                g = (pct * 115 * skyWarmth) * skyBoost;
                b = (44 + (1.0 - pct) * 85) * skyBoost;
            }

            // Cool toward midnight silicon in afterglow
            if (ag > 0.001) {
                const coolR = 12 + pct * 34;
                const coolG = 14 + pct * 44;
                const coolB = 34 + pct * 102;
                r = lerp(r, coolR, ag);
                g = lerp(g, coolG, ag);
                b = lerp(b, coolB, ag);
            }

            ctx.fillStyle = toAmigaHex(r, g, b);
            ctx.fillRect(0, bandY, w, drawH);
        }

        // ---------------------------------------------------------
        // 2. Deterministic Starfield (distributed over full width)
        // ---------------------------------------------------------
        const starPal = ag > 0.5
            ? ['#8899cc', '#5577bb', '#4466aa', '#aabbdd']
            : ['#ffffff', '#ffff00', '#ff8800', '#0055ff'];
        for (let i = 0; i < this.stars.length; i++) {
            const s = this.stars[i];
            const sx = Math.min(w - 1, Math.max(0, Math.floor(s.x * w)));
            const sy = Math.min(horizon - 1, Math.max(0, Math.floor(s.y * horizon)));
            const cIdx = Math.floor(this.starPhase * s.speed + s.phase) & 3;
            ctx.fillStyle = starPal[cIdx];
            ctx.fillRect(sx, sy, 1, 1);
        }

        // ---------------------------------------------------------
        // 3. Dual-Center Moire Interference (strictly clipped to sky)
        // ---------------------------------------------------------
        if (moireIntensity > 0.02 && horizon >= 8 && w >= 8) {
            const mScale = Math.max(0.32, Math.min(1.15, minDim / 210));
            const orbitX = w * (0.14 + 0.16 * moireIntensity);
            const orbitY = horizon * 0.24;
            const cyBase = horizon * 0.48;

            const cx1 = Math.floor(cx + Math.sin(this.moirePhase) * orbitX);
            const cy1 = Math.floor(cyBase + Math.cos(this.moirePhase * 1.3) * orbitY);
            const cx2 = Math.floor(cx + Math.sin(this.moirePhase * 1.1 + Math.PI) * orbitX);
            const cy2 = Math.floor(cyBase + Math.cos(this.moirePhase * 0.9 + Math.PI) * orbitY);

            let cA;
            let cB;
            if (state === 'climax') {
                cA = this.moirePaletteMode === 1 ? '#ffaa00' : '#ff6600';
                cB = this.moirePaletteMode === 2 ? '#88eeff' : '#00bbff';
            } else if (ag > 0.4) {
                cA = '#4466aa';
                cB = '#335588';
            } else {
                cA = this.moirePaletteMode === 1 ? '#33bbff' : '#0088ff';
                cB = this.moirePaletteMode === 2 ? '#ff8833' : '#0055dd';
            }

            this._drawMoireCenter(ctx, cx1, cy1, mScale, w, horizon, cA);
            this._drawMoireCenter(ctx, cx2, cy2, mScale, w, horizon, cB);
        }

        // ---------------------------------------------------------
        // 4. 3D Silicon Bus Floor (zero ImageData, full width coverage)
        // ---------------------------------------------------------
        const floorBgHex = toAmigaHex(lerp(5, 8, ag), lerp(5, 10, ag), lerp(20, 26, ag));
        ctx.fillStyle = floorBgHex;
        ctx.fillRect(0, horizon, w, floorHeight);

        const fov = Math.max(16, minDim * 0.56);
        const baseCamY = Math.max(6, floorHeight * 0.30);
        const camY = Math.max(3.5, baseCamY * (1.0 - Math.min(0.40, beatImpulse * 0.34)));

        const zWaveActive = this.zWaveAge < 1.0 && this.zWavePeak > 0.01;
        const zWaveCenter = this.zWaveAge / 0.8;
        const zWaveAmp = zWaveActive ? this.zWavePeak * (1.0 - 0.55 * ag) * (1.0 - this.zWaveAge * 0.75) : 0.0;

        // Perspective longitudinal grid lines covering full width on Ultrawide & 3:1
        const worldStep = Math.max(16, fov * 0.28);
        const edgeWorldX = (w * 0.54) * (Z_MAX / fov);
        const gridSteps = Math.min(28, Math.ceil(edgeWorldX / worldStep));
        const baseGridLum = (0.45 + 0.30 * energy + 0.35 * beatImpulse) * (1.0 - 0.40 * ag);
        const radLineHex = toAmigaHex(0, 136 * baseGridLum, 255 * baseGridLum);
        ctx.fillStyle = radLineHex;

        const startZ = Math.max(2.5, Z_STEP - this.scrollZ);
        const pyStart = (camY * fov) / startZ;
        const pyEnd = (camY * fov) / Z_MAX;

        for (let k = -gridSteps; k <= gridSteps; k++) {
            const worldX = k * worldStep;
            const pxStart = cx + (worldX * fov) / startZ;
            const pxEnd = cx + (worldX * fov) / Z_MAX;
            drawClippedLine(
                ctx,
                pxStart,
                horizon + pyStart,
                pxEnd,
                horizon + pyEnd,
                0,
                horizon,
                w - 1,
                h - 1
            );
        }

        // Responsive X-positions of the 4 Paula DMA channels (Amiga Stereo L-R-R-L)
        const slotFracs = [0.14, 0.36, 0.64, 0.86];
        const dmaX = [
            Math.floor(w * slotFracs[0]),
            Math.floor(w * slotFracs[2]),
            Math.floor(w * slotFracs[3]),
            Math.floor(w * slotFracs[1])
        ];

        // Highlighted DMA bus traces running from each chip pedestal out toward foreground
        for (let i = 0; i < 4; i++) {
            const isLeft = (i === 0 || i === 3);
            const traceGlow = (0.28 + 0.72 * vols[i] + 0.45 * beatImpulse) * (1.0 - 0.50 * ag);
            if (isLeft) {
                ctx.fillStyle = toAmigaHex(0, 170 * traceGlow, 255 * traceGlow);
            } else {
                ctx.fillStyle = toAmigaHex(255 * traceGlow, 120 * traceGlow, 17 * traceGlow);
            }
            const worldChipX = (dmaX[i] - cx) * (Z_MAX / fov);
            const chipPxStart = cx + (worldChipX * fov) / startZ;
            drawClippedLine(
                ctx,
                chipPxStart,
                horizon + pyStart,
                dmaX[i],
                horizon,
                0,
                horizon,
                w - 1,
                h - 1
            );
        }

        // Horizontal Z-depth grid scanlines (with traveling Copper Z-wave)
        for (let z = Z_MAX; z >= Z_STEP; z -= Z_STEP) {
            const pZ = z - this.scrollZ;
            if (pZ < 2.2) continue;
            const py = Math.floor((camY * fov) / pZ);
            if (py < 0 || py >= floorHeight) continue;

            const depth = py / floorHeight;
            let waveBoost = 0;
            if (zWaveAmp > 0.01) {
                const dist = Math.abs(depth - zWaveCenter);
                if (dist < 0.18) {
                    waveBoost = (1.0 - dist / 0.18) * zWaveAmp;
                }
            }

            const lineLum = (0.35 + 0.55 * depth + 0.35 * beatImpulse + waveBoost * 0.75) * (1.0 - 0.42 * ag);
            ctx.fillStyle = toAmigaHex(
                34 * waveBoost * 2.5,
                145 * lineLum + 60 * waveBoost,
                255 * lineLum
            );
            ctx.fillRect(0, horizon + py, w, 1);
        }

        // Copper Horizon Bus Line (fixes undefined horizonLineColor from legacy code)
        const horizonGlow = (0.45 + 0.35 * energy + 0.55 * beatImpulse + (isClimaxLocked ? 0.2 : 0))
            * (1.0 - 0.5 * ag);
        const horizonLineHex = toAmigaHex(102 * horizonGlow, 221 * horizonGlow, 255 * horizonGlow);
        ctx.fillStyle = horizonLineHex;
        ctx.fillRect(0, horizon, w, 1);

        // Deterministic silicon bus sparks (only on floor)
        if (ag < 0.7 && this._nextRandom() < (0.25 + 0.35 * energy)) {
            const nx = Math.floor(this._nextRandom() * Math.max(1, w - 2));
            const ny = horizon + 1 + Math.floor(this._nextRandom() * Math.max(1, floorHeight - 1));
            ctx.fillStyle = this._nextRandom() > 0.5 ? '#ffffff' : horizonLineHex;
            fillClippedRect(ctx, nx, ny, 2, 1, w, h, horizon, h);
        }

        // ---------------------------------------------------------
        // 5. Four Paula 8364 Hardware DMA Towers (L-R-R-L)
        // ---------------------------------------------------------
        let colW = Math.max(4, Math.min(24, Math.floor(Math.min(w * 0.12, minDim * 0.10))));
        colW = (colW & ~1) || 4;
        const halfCol = colW >> 1;
        const maxTowerH = Math.max(8, Math.floor(horizon * 0.42));

        const mFront = toAmigaHex(lerp(34, 24, ag), lerp(34, 28, ag), lerp(68, 58, ag));
        const mHighlight = toAmigaHex(lerp(68, 48, ag), lerp(68, 56, ag), lerp(119, 98, ag));
        const mShadow = toAmigaHex(17, 17, lerp(34, 30, ag));
        const pinHex = toAmigaHex(lerp(136, 85, ag), lerp(153, 102, ag), lerp(170, 119, ag));

        for (let i = 0; i < 4; i++) {
            const x = dmaX[i];
            const vol = vols[i];
            const isLeft = (i === 0 || i === 3);

            const baseH = Math.max(
                6,
                Math.floor(maxTowerH * (0.42 + 0.48 * vol + 0.12 * beatImpulse * (1.0 - ag)))
            );
            const topY = Math.max(2, horizon - baseH);

            // Shadow plinth
            ctx.fillStyle = mShadow;
            fillClippedRect(ctx, x - halfCol - 2, horizon - 2, colW + 4, 2, w, h, 0, horizon);

            // Main beveled IC chip body
            ctx.fillStyle = mFront;
            fillClippedRect(ctx, x - halfCol, topY, colW, baseH - 2, w, h, 0, horizon);

            ctx.fillStyle = mHighlight;
            fillClippedRect(ctx, x - halfCol, topY, 1, baseH - 2, w, h, 0, horizon);
            fillClippedRect(ctx, x - halfCol, topY, colW, 1, w, h, 0, horizon);

            ctx.fillStyle = mShadow;
            fillClippedRect(ctx, x + halfCol - 1, topY, 1, baseH - 2, w, h, 0, horizon);

            // IC chip pins along base edge
            if (colW >= 8) {
                ctx.fillStyle = pinHex;
                for (let px = x - halfCol + 1; px <= x + halfCol - 2; px += 3) {
                    fillClippedRect(ctx, px, horizon - 2, 1, 2, w, h, 0, horizon);
                }
            }

            // Inner DMA channel meter core
            const meterPad = Math.max(1, Math.floor(colW * 0.22));
            const meterW = Math.max(2, colW - meterPad * 2);
            const meterMaxH = Math.max(2, baseH - 6);
            const meterH = Math.max(1, Math.floor(meterMaxH * clamp01(0.15 + vol * 0.85)));
            const meterY = horizon - 3 - meterH;
            const glowGain = (0.55 + 0.45 * vol + 0.25 * beatImpulse) * (1.0 - 0.45 * ag);

            ctx.fillStyle = isLeft
                ? toAmigaHex(0, Math.floor((85 + vol * 170) * glowGain), Math.floor(255 * glowGain))
                : toAmigaHex(Math.floor(255 * glowGain), Math.floor((51 + vol * 136) * glowGain), 0);
            fillClippedRect(ctx, x - Math.floor(meterW * 0.5), meterY, meterW, meterH, w, h, 0, horizon);

            // Ascending DMA sample fetch packets
            const blockW = Math.max(4, Math.floor(colW * 0.55));
            const blockHalf = blockW >> 1;
            const fetchSpeed = (28 + vol * 95 + tension * 65) * (1.0 - 0.65 * ag);
            const numBlocks = Math.max(1, Math.floor(vol * 6) + (tension > 0.5 ? 2 : 1));
            const blockSpacing = Math.max(12, Math.floor(horizon * 0.16));

            for (let b = 0; b < numBlocks; b++) {
                const yOffset = (this.dmaTime * fetchSpeed + b * blockSpacing) % Math.max(1, topY);
                const blockY = topY - yOffset;
                if (blockY < 0 || blockY >= topY) continue;

                let jitterX = 0;
                if (ag < 0.3 && tension > 0.68 && vol > 0.35) {
                    jitterX = Math.floor((this._nextRandom() - 0.5) * 4 * tension);
                }

                const hPct = clamp01(blockY / Math.max(1, horizon));
                const fade = (0.30 + 0.70 * hPct) * (0.55 + 0.45 * vol) * (1.0 - 0.45 * ag);
                const blockH = Math.max(2, Math.min(8, Math.floor(2 + vol * 6)));

                ctx.fillStyle = isLeft
                    ? toAmigaHex(0, 221 * fade, 255 * fade)
                    : toAmigaHex(255 * fade, 136 * fade, 17 * fade);
                fillClippedRect(ctx, x - blockHalf + jitterX, blockY, blockW, blockH, w, h, 0, topY);

                // Crisp 1px Amiga Blitter top edge
                ctx.fillStyle = isLeft
                    ? toAmigaHex(153 * fade, 255 * fade, 255 * fade)
                    : toAmigaHex(255 * fade, 221 * fade, 136 * fade);
                fillClippedRect(ctx, x - blockHalf + jitterX, blockY, blockW, 1, w, h, 0, topY);
            }

            // Climax DMA Interrupt Beams (50-Hz-stable striped Copper columns)
            if (state === 'climax' && (beatImpulse > 0.22 || isClimaxLocked) && vol > 0.28) {
                const beamW = Math.max(2, Math.floor(colW * 0.35));
                const beamHalf = beamW >> 1;
                const phaseShift = Math.floor(this.dmaTime * 16) & 7;
                for (let beamY = 0; beamY < topY; beamY += 4) {
                    const stripe = (beamY + phaseShift) & 7;
                    ctx.fillStyle = stripe < 4 ? '#ffffff' : '#ff7700';
                    fillClippedRect(ctx, x - beamHalf, beamY, beamW, 2, w, h, 0, topY);
                }
            }
        }

        // ---------------------------------------------------------
        // 6. Controlled Climax Sync Glitch (only on strong climax beats)
        // ---------------------------------------------------------
        if (state === 'climax' && this.syncGlitchAge < 0.08 && w >= 16) {
            const gx = Math.floor(this._nextRandom() * Math.max(1, w - 16));
            const gy = Math.floor(this._nextRandom() * Math.max(1, h - 4));
            ctx.fillStyle = '#ff00ff';
            fillClippedRect(ctx, gx, gy, 12, 1, w, h, 0, h);
            ctx.fillStyle = '#00ffff';
            fillClippedRect(ctx, gx + 3, gy + 1, 8, 1, w, h, 0, h);
        }

        // ---------------------------------------------------------
        // 7. Power-On / Power-Off Bayer 4x4 Curtain (no globalAlpha)
        // ---------------------------------------------------------
        if (revealRatio < 1.0) {
            this._drawPowerCurtain(ctx, w, h, horizon, revealRatio);
        }
    }
}