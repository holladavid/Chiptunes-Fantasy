// === js/visuals/dse/amiga/kefrens-checkerboard.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: KEFRENS 3D CHECKERBOARD FLOOR
// Amiga OCS/ECS Copper perspective plane with 12-bit Z-shading,
// specular sun-track reflection, Copper line-scroll curves,
// traveling Z-shockwaves and floor-scoped Bayer dither fades.
// Horizon aligned with RetroSunset via 1-pixel projection shift.
// =========================================================

import { quantizeAmiga12Bit, rgbToHex } from '../../utils/hardware-constraints.js';

const TWO_PI = Math.PI * 2;
const SCROLL_PERIOD_TILES = 256;
const TRANSITION_DURATION = 1.15;

// 4x4 Bayer threshold matrix (0..15) for deterministic floor-only transitions
const BAYER_4X4 = Object.freeze([
    0, 8, 2, 10,
    12, 4, 14, 6,
    3, 11, 1, 9,
    15, 7, 13, 5
]);

// Precompute all 4096 Amiga 12-bit OCS hex colors once (zero per-frame allocations)
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

// Curated Amiga OCS Copper palettes (pre-quantized 12-bit channel values)
const COPPER_PALETTES = Object.freeze([
    // 0: Kefrens Deep Cobalt (classic Amiga blue + ice-cyan horizon)
    Object.freeze({
        c1: Object.freeze([0, 102, 255]),
        c2: Object.freeze([0, 17, 85]),
        horizon: Object.freeze([102, 221, 255]),
        grid: Object.freeze([68, 187, 255])
    }),
    // 1: Desert Dream Copper (violet/magenta + warm amber horizon for RetroSunset)
    Object.freeze({
        c1: Object.freeze([204, 68, 170]),
        c2: Object.freeze([51, 17, 68]),
        horizon: Object.freeze([255, 170, 51]),
        grid: Object.freeze([255, 136, 102])
    }),
    // 2: Shadow of the Beast Emerald (slate-teal + phosphor-mint highlights)
    Object.freeze({
        c1: Object.freeze([17, 170, 136]),
        c2: Object.freeze([0, 34, 51]),
        horizon: Object.freeze([136, 255, 187]),
        grid: Object.freeze([68, 238, 170])
    }),
    // 3: Boing Copper Slate (crimson-copper tiles + charcoal slate + gold sheen)
    Object.freeze({
        c1: Object.freeze([204, 51, 68]),
        c2: Object.freeze([34, 34, 51]),
        horizon: Object.freeze([255, 204, 119]),
        grid: Object.freeze([238, 136, 85])
    })
]);

const AFTERGLOW_PALETTE = Object.freeze({
    c1: Object.freeze([51, 85, 153]),
    c2: Object.freeze([17, 17, 51]),
    horizon: Object.freeze([119, 153, 221]),
    grid: Object.freeze([85, 119, 187])
});

function clamp01(v) {
    if (!Number.isFinite(v)) return 0;
    return v < 0 ? 0 : (v > 1 ? 1 : v);
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

function lerp(a, b, t) {
    return a + (b - a) * t;
}

export class KefrensCheckerboard {
    constructor() {
        this.name = 'Kefrens Checkerboard';

        // Time & state tracking
        this.lastT = null;
        this.lastState = 'idle';
        this.stateAge = 0;

        // Continuous simulation state (preserved across resize/rotation)
        this.scrollTiles = 0;
        this.swayPhase = 0;
        this.curvePhase = 0;
        this.smoothedSpeed = 1.0;
        this.smoothedSway = 0.0;
        this.smoothedCurve = 0.0;
        this.afterglowMix = 0.0;

        // Discrete beat-driven state
        this.paletteIndex = 0;
        this.prevPaletteIndex = 0;
        this.paletteBlend = 1.0;
        this.patternIndex = 0; // 0: Classic, 1: Beveled, 2: Cyber Grid, 3: Racing Check
        this.lastBeatCount = 0;
        this.beatDirection = 1;

        // Traveling Z-shockwave triggered on beatStarted
        this.zWaveAge = 10.0;
        this.zWavePeak = 0.0;

        // Instance-owned deterministic PRNG (Xorshift32) for subtle micro-glints
        this.prngState = 0x4B454652; // 'KEFR'

        // Instance-owned geometry LUT (invalidated on height/horizon change)
        this.cachedHeight = -1;
        this.cachedFloorHeight = -1;
        this.depthCache = new Float32Array(0);
    }

    _nextRandom() {
        let x = this.prngState | 0;
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        this.prngState = x;
        return (x >>> 0) / 4294967296;
    }

    _ensureDepthCache(height, horizon, floorHeight) {
        if (
            this.cachedHeight === height &&
            this.cachedFloorHeight === floorHeight &&
            this.depthCache.length >= floorHeight
        ) {
            return;
        }
        this.cachedHeight = height;
        this.cachedFloorHeight = floorHeight;
        if (this.depthCache.length < floorHeight) {
            this.depthCache = new Float32Array(floorHeight);
        }
        const invFloor = 1.0 / Math.max(1, floorHeight);
        for (let i = 0; i < floorHeight; i++) {
            const dy = i + 1;
            this.depthCache[i] = Math.pow(Math.min(1.0, dy * invFloor), 0.6);
        }
    }

    resize(width, height) {
        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
            return;
        }
        const h = Math.floor(height);
        const horizon = Math.min(h - 1, Math.max(0, Math.floor(h * 0.55)));
        const floorHeight = Math.max(1, h - horizon);
        this._ensureDepthCache(h, horizon, floorHeight);
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

        // Safe PAL-friendly delta time clamped against tab pauses/jumps
        let dt = this.lastT === null ? 0.02 : (safeT - this.lastT);
        this.lastT = safeT;
        if (!Number.isFinite(dt) || dt < 0) {
            dt = 0.02;
        } else if (dt > 0.1) {
            dt = 0.1;
        }

        // State-local timer (does not rely on stateTime resetting between active states)
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
        const chBass = readChannel(smooth, 0, energy);
        const chMid = readChannel(smooth, 1, energy);
        const chHigh = readChannel(smooth, 2, energy * 0.75);
        const chExtra = readChannel(smooth, 3, 0);

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

                // Launch Copper Z-shockwave scaled by graded beatLevel/beatStrength
                this.zWaveAge = 0;
                const levelWeight = beatLevel >= 3 ? 1.0 : (beatLevel === 2 ? 0.65 : (beatLevel === 1 ? 0.35 : 0.0));
                this.zWavePeak = Math.max(beatStrength, levelWeight);

                if (allowDiscreteSwitches && incomingCount > 0) {
                    if (incomingCount % 4 === 0) {
                        this.prevPaletteIndex = this.paletteIndex;
                        this.paletteIndex = (this.paletteIndex + 1) % COPPER_PALETTES.length;
                        this.paletteBlend = 0.0;
                    }
                    if (incomingCount % 8 === 0) {
                        if (state === 'buildup' || state === 'climax') {
                            this.patternIndex = (this.patternIndex + 1) % 4;
                        } else if (state === 'playing') {
                            // Calm states alternate cleanly between Classic & Beveled Slabs
                            this.patternIndex = (this.patternIndex + 1) % 2;
                        }
                    }
                }
            }
        }

        // Advance palette cross-step and Z-wave travel
        if (this.paletteBlend < 1.0) {
            this.paletteBlend = Math.min(1.0, this.paletteBlend + dt * 3.5);
        }
        this.zWaveAge = Math.min(10.0, this.zWaveAge + dt);

        // ---------------------------------------------------------
        // Macro State Dynamics & Tension Mapping
        // ---------------------------------------------------------
        let targetSpeed = 1.0 + tension * 0.5;
        let targetSway = 0.15 + tension * 0.25;
        let targetCurve = tension * 0.25;
        let targetAfterglow = 0.0;
        let activePattern = this.patternIndex;
        let beatBounceGain = 0.30;

        if (state === 'starting') {
            targetSpeed = 0.85;
            targetSway = 0.1;
            targetCurve = 0.0;
            activePattern = 0;
            beatBounceGain = 0.18;
        } else if (state === 'playing') {
            targetSpeed = 0.95 + tension * 0.45;
            targetSway = 0.12 + tension * 0.22;
            targetCurve = tension * 0.18;
        } else if (state === 'buildup') {
            targetSpeed = 1.45 + tension * 0.85;
            targetSway = 0.45 + tension * 0.45;
            targetCurve = 0.35 + tension * 0.55;
            beatBounceGain = 0.36;
            if (tension > 0.55 && activePattern === 0) {
                activePattern = 1; // Promote to Beveled Slabs as buildup intensifies
            }
        } else if (state === 'climax') {
            targetSpeed = 2.35 + tension * 0.95 + (isClimaxLocked ? 0.25 : 0);
            targetSway = 0.85 + tension * 0.35;
            targetCurve = 0.85 + tension * 0.40;
            beatBounceGain = 0.44;
        } else if (state === 'afterglow') {
            // Preserve current pattern and phases; decelerate and cool down smoothly
            targetSpeed = 0.35;
            targetSway = 0.06;
            targetCurve = 0.0;
            targetAfterglow = 1.0;
            beatBounceGain = 0.12;
        } else if (state === 'stopping') {
            targetSpeed = 0.45;
            targetSway = 0.05;
            targetCurve = 0.0;
            beatBounceGain = 0.10;
        }

        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * Math.min(1.0, dt * 4.5);
        this.smoothedSway += (targetSway - this.smoothedSway) * Math.min(1.0, dt * 3.0);
        this.smoothedCurve += (targetCurve - this.smoothedCurve) * Math.min(1.0, dt * 2.5);
        this.afterglowMix += (targetAfterglow - this.afterglowMix) * Math.min(1.0, dt * 2.2);

        // Continuous speed punch from beatImpulse (clearly differentiates soft/medium/hard)
        const speedBoost = beatImpulse * (state === 'climax' ? 1.15 : (state === 'afterglow' ? 0.15 : 0.65));
        const effectiveSpeed = Math.max(0.1, this.smoothedSpeed + speedBoost);

        // Advance phases with modulo wrapping for multi-hour floating-point precision
        this.scrollTiles = (this.scrollTiles + dt * effectiveSpeed * 2.6) % SCROLL_PERIOD_TILES;
        this.swayPhase = (this.swayPhase + dt * (0.75 + 0.35 * this.smoothedSpeed)) % TWO_PI;
        this.curvePhase = (this.curvePhase + dt * (0.55 + 0.45 * this.smoothedCurve + chExtra * 0.35)) % TWO_PI;

        // ---------------------------------------------------------
        // Floor-Only Transition Progress (no alpha, no getImageData)
        // ---------------------------------------------------------
        let revealRatio = 1.0;
        if (state === 'starting') {
            revealRatio = clamp01((this.stateAge + 0.08) / TRANSITION_DURATION);
        } else if (state === 'stopping') {
            revealRatio = 1.0 - clamp01(this.stateAge / TRANSITION_DURATION);
            if (revealRatio <= 0.001) {
                return;
            }
        }

        // ---------------------------------------------------------
        // Responsive Projection Geometry (Portrait -> Ultrawide)
        // ---------------------------------------------------------
        const minDim = Math.min(w, h);
        const horizon = Math.min(h - 1, Math.max(0, Math.floor(h * 0.55)));
        const floorHeight = Math.max(1, h - horizon);
        this._ensureDepthCache(h, horizon, floorHeight);

        const fov = Math.max(16, minDim * 0.55);
        const baseCamH = Math.max(8, floorHeight * 0.26);

        // Safe bounded camera dip driven immediately by beatImpulse[0]
        const camDip = Math.min(0.42, beatImpulse * beatBounceGain);
        const camH = Math.max(4.0, baseCamH * (1.0 - camDip));

        // Tile dimensions scale with minDim so portrait doesn't blow up and ultrawide stays crisp
        const tileW = Math.max(4.0, minDim * 0.05);
        const tileH = tileW;

        const swayAmp = w * 0.15 * this.smoothedSway;
        const curveAmp = w * 0.20 * this.smoothedCurve;
        const swayBase = Math.sin(this.swayPhase) * swayAmp;
        const beatLean = this.beatDirection * beatImpulse * w * 0.025 * this.smoothedSway;

        // ---------------------------------------------------------
        // Resolve Active Copper Palette (with smooth cross-step & afterglow cooling)
        // ---------------------------------------------------------
        const pPrev = COPPER_PALETTES[this.prevPaletteIndex];
        const pCurr = COPPER_PALETTES[this.paletteIndex];
        const pb = this.paletteBlend;

        const activeC1R = lerp(pPrev.c1[0], pCurr.c1[0], pb);
        const activeC1G = lerp(pPrev.c1[1], pCurr.c1[1], pb);
        const activeC1B = lerp(pPrev.c1[2], pCurr.c1[2], pb);

        const activeC2R = lerp(pPrev.c2[0], pCurr.c2[0], pb);
        const activeC2G = lerp(pPrev.c2[1], pCurr.c2[1], pb);
        const activeC2B = lerp(pPrev.c2[2], pCurr.c2[2], pb);

        const activeHorR = lerp(pPrev.horizon[0], pCurr.horizon[0], pb);
        const activeHorG = lerp(pPrev.horizon[1], pCurr.horizon[1], pb);
        const activeHorB = lerp(pPrev.horizon[2], pCurr.horizon[2], pb);

        const activeGridR = lerp(pPrev.grid[0], pCurr.grid[0], pb);
        const activeGridG = lerp(pPrev.grid[1], pCurr.grid[1], pb);
        const activeGridB = lerp(pPrev.grid[2], pCurr.grid[2], pb);

        const ag = this.afterglowMix;
        const c1R = lerp(activeC1R, AFTERGLOW_PALETTE.c1[0], ag);
        const c1G = lerp(activeC1G, AFTERGLOW_PALETTE.c1[1], ag);
        const c1B = lerp(activeC1B, AFTERGLOW_PALETTE.c1[2], ag);

        const c2R = lerp(activeC2R, AFTERGLOW_PALETTE.c2[0], ag);
        const c2G = lerp(activeC2G, AFTERGLOW_PALETTE.c2[1], ag);
        const c2B = lerp(activeC2B, AFTERGLOW_PALETTE.c2[2], ag);

        const horR = lerp(activeHorR, AFTERGLOW_PALETTE.horizon[0], ag);
        const horG = lerp(activeHorG, AFTERGLOW_PALETTE.horizon[1], ag);
        const horB = lerp(activeHorB, AFTERGLOW_PALETTE.horizon[2], ag);

        const gridR = lerp(activeGridR, AFTERGLOW_PALETTE.grid[0], ag);
        const gridG = lerp(activeGridG, AFTERGLOW_PALETTE.grid[1], ag);
        const gridB = lerp(activeGridB, AFTERGLOW_PALETTE.grid[2], ag);

        // Specular sun-track center aligned near RetroSunset horizon center
        const sunCenterX = (w * 0.5) + swayBase * 0.25;
        const sunIntensity = (0.28 + 0.52 * chMid + 0.35 * beatImpulse) * (1.0 - 0.55 * ag);

        // Traveling Copper Z-shockwave parameters
        const zWaveActive = this.zWaveAge < 1.05 && this.zWavePeak > 0.01;
        const zWaveCenter = this.zWaveAge / 0.85;
        const zWaveAmp = zWaveActive ? this.zWavePeak * (1.0 - 0.55 * ag) * (1.0 - this.zWaveAge * 0.7) : 0.0;

        // Deterministic micro-glint trigger for high percussion channel in climax
        const glintChance = (state === 'climax' ? 0.12 : 0.04) * chHigh * (1.0 - ag);

        // ---------------------------------------------------------
        // Scanline Perspective Rendering (y = horizon .. h - 1)
        // ---------------------------------------------------------
        const invFloor = 1.0 / floorHeight;
        const maxSegments = w + 2;

        for (let rowIdx = 0; rowIdx < floorHeight; rowIdx++) {
            const drawY = horizon + rowIdx;
            const rowNorm = rowIdx * invFloor;

            // Floor-only Bayer ordered-dither curtain for starting / stopping
            let ditherStep = 0;
            if (revealRatio < 1.0) {
                const frontier = revealRatio * 1.15;
                if (rowNorm > frontier) {
                    continue;
                }
                const edgeDist = frontier - rowNorm;
                if (edgeDist < 0.14) {
                    const edgeFactor = clamp01(edgeDist / 0.14);
                    ditherStep = 1 - edgeFactor;
                }
            }

            const dy = rowIdx + 1;
            const z = Math.max(0.5, (camH * fov) / dy);
            const deltaScreenX = Math.max(0.25, (tileW * fov) / z);
            const depth = this.depthCache[rowIdx];

            // Copper Z-shockwave luminance envelope for this scanline
            let waveBoost = 0;
            if (zWaveAmp > 0.005) {
                const dist = Math.abs(depth - zWaveCenter);
                if (dist < 0.16) {
                    waveBoost = (1.0 - dist / 0.16) * zWaveAmp;
                }
            }

            // Copper Horizon Beam on the topmost floor scanline (y = horizon)
            if (rowIdx === 0 && ditherStep === 0) {
                const beamGain = (0.42 + 0.35 * energy + 0.35 * chBass + 0.55 * beatImpulse + (isClimaxLocked ? 0.18 : 0))
                    * (1.0 - 0.50 * ag);
                ctx.fillStyle = toAmigaHex(
                    horR * beamGain,
                    horG * beamGain,
                    horB * beamGain
                );
                ctx.fillRect(0, drawY, w, 1);
                continue;
            }

            // Scanline Copper depth shading + beat/bass brightness
            const shade = depth * (0.64 + 0.28 * energy + 0.20 * chBass)
                + waveBoost * 0.58
                + beatImpulse * 0.16 * depth
                + pulse * 0.08 * depth;

            const afterglowDim = 1.0 - 0.25 * ag;
            const lum = shade * afterglowDim;

            const vCoord = (z / tileH) - this.scrollTiles;
            const vPhase = Math.floor(vCoord);
            const vFrac = vCoord - vPhase;

            // Pattern modifiers per scanline
            let rowLift = 0;
            let rowScale = 1.0;
            let isGridRow = false;

            if (activePattern === 1) {
                // Beveled Marble Slabs: bright front edge + dark mortar seam
                if (vFrac < 0.11) {
                    rowLift = 26 * (0.5 + 0.5 * chHigh);
                } else if (vFrac > 0.91) {
                    rowScale = 0.52;
                }
            } else if (activePattern === 2) {
                // Amiga Cyber/Tron Grid
                if (vFrac < 0.10) {
                    isGridRow = true;
                } else {
                    rowScale = 0.85;
                }
            } else if (activePattern === 3) {
                // Racing Dual-Check: highlighted front lip + subtle row alternation
                if (vFrac < 0.08) {
                    rowLift = 20;
                } else if ((vPhase & 1) !== 0) {
                    rowScale = 0.88;
                }
            }

            // Specular Sun-Track cone half-width on this scanline
            const sunHalfW = Math.max(6, minDim * (0.10 + 0.13 * depth) * (0.75 + 0.45 * chMid + 0.30 * beatImpulse));
            const sunLeft = Math.min(w, Math.max(0, Math.floor(sunCenterX - sunHalfW)));
            const sunRight = Math.min(w, Math.max(0, Math.ceil(sunCenterX + sunHalfW)));

            // Ordered-dither frontier band for starting / stopping
            if (ditherStep > 0) {
                const bayerRow = (rowIdx & 3) * 4;
                const thresh = ditherStep * 16;
                const step = Math.max(2, Math.floor(minDim * 0.03));
                ctx.fillStyle = toAmigaHex(horR * 0.7, horG * 0.7, horB * 0.7);
                for (let bx = 0; bx < w; bx += step) {
                    if (BAYER_4X4[bayerRow + ((bx >> 2) & 3)] >= thresh) {
                        const bw = Math.min(step, w - bx);
                        if (bw > 0) {
                            ctx.fillRect(bx, drawY, bw, 1);
                        }
                    }
                }
                continue;
            }

            // Full Cyber Grid horizontal scanline
            if (isGridRow) {
                const gridBoost = (0.45 + 0.60 * chHigh + 0.45 * beatImpulse + waveBoost * 0.5) * depth * afterglowDim;
                ctx.fillStyle = toAmigaHex(gridR * gridBoost, gridG * gridBoost, gridB * gridBoost);
                ctx.fillRect(0, drawY, w, 1);
                continue;
            }

            // Horizon Moire zone: Scanline-interlaced Copper dither + centered Sun-Track glow
            if (deltaScreenX < 2.2) {
                const parity = (rowIdx + vPhase) & 1;
                const mixWeight = parity === 0 ? 0.36 : 0.64;
                const baseR = (c1R * mixWeight + c2R * (1.0 - mixWeight)) * lum;
                const baseG = (c1G * mixWeight + c2G * (1.0 - mixWeight)) * lum;
                const baseB = (c1B * mixWeight + c2B * (1.0 - mixWeight)) * lum;

                const darkHex = toAmigaHex(baseR, baseG, baseB);
                if (sunRight > sunLeft) {
                    if (sunLeft > 0) {
                        ctx.fillStyle = darkHex;
                        ctx.fillRect(0, drawY, sunLeft, 1);
                    }
                    const specBoost = 1.0 + sunIntensity * 0.85;
                    ctx.fillStyle = toAmigaHex(
                        baseR * specBoost + horR * 0.15 * sunIntensity,
                        baseG * specBoost + horG * 0.15 * sunIntensity,
                        baseB * specBoost + horB * 0.15 * sunIntensity
                    );
                    ctx.fillRect(sunLeft, drawY, sunRight - sunLeft, 1);
                    if (sunRight < w) {
                        ctx.fillStyle = darkHex;
                        ctx.fillRect(sunRight, drawY, w - sunRight, 1);
                    }
                } else {
                    ctx.fillStyle = darkHex;
                    ctx.fillRect(0, drawY, w, 1);
                }
                continue;
            }

            // Precompute the scanline's base & specular-boosted Amiga 12-bit hex colors
            const r1 = c1R * lum * rowScale + rowLift;
            const g1 = c1G * lum * rowScale + rowLift;
            const b1 = c1B * lum * rowScale + rowLift;

            const r2 = c2R * lum * rowScale + rowLift * 0.55;
            const g2 = c2G * lum * rowScale + rowLift * 0.55;
            const b2 = c2B * lum * rowScale + rowLift * 0.55;

            const hex1 = toAmigaHex(r1, g1, b1);
            const hex2 = toAmigaHex(r2, g2, b2);

            const specMul = 1.0 + sunIntensity * 0.55;
            const specAdd = 22 * sunIntensity * depth;
            const hex1Spec = toAmigaHex(r1 * specMul + specAdd, g1 * specMul + specAdd * 0.9, b1 * specMul + specAdd * 0.7);
            const hex2Spec = toAmigaHex(r2 * specMul + specAdd * 0.6, g2 * specMul + specAdd * 0.5, b2 * specMul + specAdd * 0.4);

            const vertGridHex = activePattern === 2
                ? toAmigaHex(gridR * lum * 1.15, gridG * lum * 1.15, gridB * lum * 1.15)
                : null;

            // Perspective scanline curve (Amiga Copper line-scroll curve)
            const curveFactor = Math.pow(1.0 - depth, 1.5);
            const curveX = Math.sin(this.curvePhase + (1.0 - depth) * 2.2) * curveAmp * curveFactor;
            const swayX = (swayBase + beatLean) * (1.0 - depth * 0.55);
            const cx = (w * 0.5) + swayX + curveX;

            const uAt0 = -cx / deltaScreenX;
            let uPhase = Math.floor(uAt0);
            let nextX = (uPhase + 1 - uAt0) * deltaScreenX;

            if (!Number.isFinite(uPhase) || !Number.isFinite(nextX)) {
                ctx.fillStyle = hex2;
                ctx.fillRect(0, drawY, w, 1);
                continue;
            }

            let screenX = 0;
            let segments = 0;

            while (screenX < w && segments < maxSegments) {
                let drawW = Math.ceil(nextX - screenX);
                if (!Number.isFinite(drawW) || drawW <= 0) {
                    drawW = 1;
                    nextX = screenX + 1;
                }
                if (screenX + drawW > w) {
                    drawW = w - screenX;
                }
                if (drawW <= 0) {
                    break;
                }

                const segMid = screenX + drawW * 0.5;
                const inSunCone = segMid >= sunLeft && segMid <= sunRight;
                const isTileA = activePattern === 3
                    ? (((uPhase + vPhase + ((vPhase >> 1) & 1)) & 1) === 0)
                    : (((uPhase + vPhase) & 1) === 0);

                if (isTileA) {
                    ctx.fillStyle = inSunCone ? hex1Spec : hex1;
                } else {
                    ctx.fillStyle = inSunCone ? hex2Spec : hex2;
                }
                ctx.fillRect(screenX, drawY, drawW, 1);

                // Optional deterministic percussion sparkle / vertical Cyber Grid seam
                if (vertGridHex !== null && drawW >= 5 && screenX > 0) {
                    ctx.fillStyle = vertGridHex;
                    ctx.fillRect(screenX, drawY, 1, 1);
                } else if (glintChance > 0.02 && isTileA && drawW >= 8 && this._nextRandom() < glintChance * depth) {
                    ctx.fillStyle = toAmigaHex(horR * 1.1, horG * 1.1, horB * 1.1);
                    ctx.fillRect(screenX, drawY, Math.min(2, drawW), 1);
                }

                screenX += drawW;
                nextX += deltaScreenX;
                uPhase++;
                segments++;
            }
        }
    }
}