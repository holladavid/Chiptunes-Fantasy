// === js/visuals/dse/universal/limit-bar.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: LIMIT BAR (v3.0.0 - Alpha-Free Edition)
// 100% Alpha-free. No modern composite operations.
// C64: Chunk-raster blocks with VIC-II palette bindings.
// Amiga: 12-Bit OCS stepped copperlists & opaque white-hot sweeps.
// Atari: Deterministic vector sparks drawn via Bresenham drawAliasedLine.
// Features structural vertical slide-out transition instead of transparency fade.
// =========================================================

import { C64_PALETTE, rgbToHex, quantizeAmiga12Bit, quantizeAtari9Bit, drawAliasedLineClipped } from '../../utils/hardware-constraints.js';

function fillClampedRect(ctx, rx, ry, rw, rh, maxW, maxH) {
    const x0 = Math.max(0, Math.floor(rx));
    const y0 = Math.max(0, Math.floor(ry));
    const x1 = Math.min(maxW, Math.floor(rx) + Math.floor(rw));
    const y1 = Math.min(maxH, Math.floor(ry) + Math.floor(rh));
    if (x1 > x0 && y1 > y0) {
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
}

export class LimitBar {
    constructor() {
        this.displayAlpha = 0.0;
        this.frameCounter = 0;
        this.lastT = null;

        // Vorberechnete Sinus-Tabelle für deterministischen ST-Funkenflug
        this.sinLUT = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
            this.sinLUT[i] = Math.sin((i / 256) * Math.PI * 2);
        }
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

        let dt = 0.02;
        if (Number.isFinite(this.lastT) && Number.isFinite(t)) {
            const rawDt = t - this.lastT;
            if (Number.isFinite(rawDt) && rawDt > 0) {
                dt = Math.min(rawDt, 0.1);
            } else if (rawDt === 0) {
                dt = 0;
            }
        }
        this.lastT = Number.isFinite(t) ? t : this.lastT;

        this.frameCounter++;
        const safeMetrics = metrics || {};
        const safeTime = Number.isFinite(t) ? t : 0;
        const safeStateTime = Number.isFinite(stateTime) ? Math.max(0, stateTime) : 0;

        const rawBeat = safeMetrics.beat?.[0];
        const beat = Number.isFinite(rawBeat)
            ? Math.max(0, Math.min(1, rawBeat))
            : 0;
        const rawImpulse = safeMetrics.beatImpulse?.[0];
        // Alte Metriken ohne beatImpulse verwenden weiterhin die Beat-Huelle.
        const beatImpulse = Number.isFinite(rawImpulse)
            ? Math.max(0, Math.min(1, rawImpulse))
            : beat;
        const beatPunch = Math.ceil(beatImpulse * 3);

        let pct = Number.isFinite(safeMetrics.tensionPct) ? safeMetrics.tensionPct : 0;
        let isFlashing = false;
        let animIntensity = (state === 'climax') ? 1.0 : Math.max(0, Math.min(1.0, pct));

        if (state === 'climax') {
            if (safeMetrics.rawEnergyState === 'climax') {
                pct = 1.0;
            } else if (safeMetrics.isClimaxLocked) {
                const holdTime = (Number.isFinite(safeMetrics.climaxHoldTime) && safeMetrics.climaxHoldTime > 0)
                    ? safeMetrics.climaxHoldTime
                    : 10.0;
                const climaxTimer = Number.isFinite(safeMetrics.climaxTimer) ? safeMetrics.climaxTimer : 0;
                pct = Math.max(0.0, 1.0 - (climaxTimer / holdTime));
            }
            isFlashing = beatImpulse > 0.5;
        }
        pct = Math.max(0, Math.min(1.0, pct));

        const isActive = (pct > 0.001 || state === 'climax' || Boolean(safeMetrics.isClimaxLocked));
        const targetAlpha = isActive ? 1.0 : 0.0;
        const alphaStep = dt > 0 ? (1.0 - Math.exp(-6.0 * dt)) : 0.0;
        this.displayAlpha += (targetAlpha - this.displayAlpha) * alphaStep;

        let globalAlpha = 1.0;
        if (state === 'starting') globalAlpha = Math.min(1.0, safeStateTime / 1.5);
        else if (state === 'stopping') globalAlpha = Math.max(0.0, 1.0 - (safeStateTime / 1.5));

        globalAlpha *= this.displayAlpha;

        // Bounding Box (Kompakt und ganzzahlig!)
        const w = Math.max(24, Math.floor(width * 0.75));
        const h = Math.max(4, Math.floor(height * 0.025)) | 0;
        const x = Math.max(0, Math.floor((width - w) / 2));
        const y = Math.max(0, height - h - Math.floor(height * 0.06));
        const clipRect = { x: 0, y: 0, width, height };

        // --- RETRO-UPGRADE: DER MECHANISCHE SCHLITTEN-EINZUG ---
        // Statt transparent zu faden, rutscht der Balken am unteren Rand komplett raus!
        const currentY = Math.floor(height - (height - y) * globalAlpha);
        if (currentY >= height - 1) return; // Beendet Render-Prozess, wenn unsichtbar (CPU Boost!)

        if (safeMetrics.system === 'c64') {
            // --- STRICT C64 PALETTE BINDING ---
            const segCount = 20;
            const gap = w >= segCount * 3 ? 2 : 1;
            const segW = Math.max(1, Math.floor(w / segCount) - gap);
            const activeSegs = Math.floor(pct * segCount);
            const activeW = activeSegs > 0 ? (activeSegs * (segW + gap) - gap) : 0;

            if (animIntensity > 0.05 && activeW > 0) {
                const borderThick = Math.floor(1 + animIntensity * 2) + beatPunch;
                const numStripes = 6;
                const stripeH = (h + borderThick * 2) / numStripes;

                const c64Colors = [6, 14, 15, 1, 10, 7].map(idx => rgbToHex(...C64_PALETTE[idx]));

                for (let i = 0; i < numStripes; i++) {
                    let colIdx = Math.floor((safeTime * (5 + animIntensity * 15) + i) % 4);
                    // Deterministisches Flimmern statt Math.random()
                    if (animIntensity >= 1.0 && beatImpulse > 0.3) {
                        colIdx = 4 + ((this.frameCounter + i) % 2);
                    }

                    ctx.fillStyle = c64Colors[colIdx];
                    fillClampedRect(
                        ctx,
                        x - borderThick,
                        Math.floor(currentY - borderThick + i * stripeH),
                        activeW + borderThick * 2,
                        Math.ceil(stripeH),
                        width,
                        height
                    );
                }
            }

            for (let i = 0; i < activeSegs; i++) {
                let color = rgbToHex(...C64_PALETTE[14]);
                if (i >= 19) color = rgbToHex(...C64_PALETTE[10]);
                else if (i >= 10) color = rgbToHex(...C64_PALETTE[1]);

                if (isFlashing) color = rgbToHex(...C64_PALETTE[1]);

                ctx.fillStyle = color;
                fillClampedRect(ctx, x + i * (segW + gap), currentY, segW, h, width, height);
            }

        } else if (safeMetrics.system === 'amiga') {
            // --- 12-BIT AMIGA COPPERLIST STEPS (Absolut OCS-Banding!) ---
            const activeW = Math.floor(w * pct);

            if (pct > 0) {
                const cBlue = [0, 85, 255];
                const cOrange = [255, 136, 0];
                const cRed = [255, 0, 0];

                const stepSize = 4; // 4-Pixel breite Copperlist Segmente (strikter OCS Look)
                for (let px = 0; px < activeW; px += stepSize) {
                    const pctColor = px / w; // Farbe verankert sich fest an der Balken-Gesamtbreite
                    let r = 0, g = 0, b = 0;

                    if (pctColor < 0.5) {
                        const stepT = pctColor / 0.5;
                        r = Math.floor(cBlue[0] + (cOrange[0] - cBlue[0]) * stepT);
                        g = Math.floor(cBlue[1] + (cOrange[1] - cBlue[1]) * stepT);
                        b = Math.floor(cBlue[2] + (cOrange[2] - cBlue[2]) * stepT);
                    } else {
                        const stepT = (pctColor - 0.5) / 0.5;
                        r = Math.floor(cOrange[0] + (cRed[0] - cOrange[0]) * stepT);
                        g = Math.floor(cOrange[1] + (cRed[1] - cOrange[1]) * stepT);
                        b = Math.floor(cOrange[2] + (cRed[2] - cOrange[2]) * stepT);
                    }

                    const qColor = quantizeAmiga12Bit(r, g, b);
                    ctx.fillStyle = rgbToHex(qColor[0], qColor[1], qColor[2]);

                    const drawW = Math.min(stepSize, activeW - px);
                    fillClampedRect(ctx, x + px, currentY, drawW, h, width, height);
                }
            }

            // Opaque Sweep Highlight (Absolut 100% Alpha-frei!)
            if (animIntensity > 0.05 && activeW > 0) {
                const sweepSpeed = safeTime * (2 + animIntensity * 8);
                const sweepPos = Math.floor((Math.sin(sweepSpeed) * 0.5 + 0.5) * activeW);

                const sweepPunch = Math.ceil(beatImpulse * 4);
                const sweepWidth = 8 + sweepPunch * 2;
                ctx.fillStyle = rgbToHex(...quantizeAmiga12Bit(255, 255, 255));
                fillClampedRect(
                    ctx,
                    x + sweepPos - Math.floor(sweepWidth / 2),
                    currentY - 2 - sweepPunch,
                    sweepWidth,
                    h + 4 + sweepPunch * 2,
                    width,
                    height
                );

                if (animIntensity >= 1.0) {
                    const bY = Math.floor(currentY + h / 2) + Math.floor(Math.sin(safeTime * 20) * 4);
                    fillClampedRect(ctx, x - 4, bY - 1, 2, 2, width, height);
                    fillClampedRect(ctx, x + activeW + 2, bY - 1, 2, 2, width, height);
                }
            }

        } else {
            // --- 9-BIT ATARI ST STYLE ---
            const segCount = 24;
            const gap = w >= segCount * 3 ? 2 : 1;
            const segW = Math.max(1, Math.floor(w / segCount) - gap);
            const activeSegs = Math.floor(pct * segCount);
            const activeW = activeSegs > 0 ? (activeSegs * (segW + gap) - gap) : 0;

            const cGreen = rgbToHex(...quantizeAtari9Bit(85, 255, 85));
            const cYellow = rgbToHex(...quantizeAtari9Bit(255, 255, 51));
            const cRed = rgbToHex(...quantizeAtari9Bit(255, 51, 51));
            const cWhite = rgbToHex(...quantizeAtari9Bit(255, 255, 255));

            // Vektor-Sparks shooting out
            if (animIntensity > 0.05 && activeW > 0) {
                let numSparks = Math.min(25,
                    Math.floor(animIntensity * 12) + Math.ceil(beatImpulse * 8));
                if (animIntensity >= 1.0) numSparks = 25;

                for (let i = 0; i < numSparks; i++) {
                    // Deterministischer Pseudo-Zufalls-Lookup über unsere Sinus-LUT
                    const seed = (this.frameCounter * 37 + i * 59) & 255;
                    const rVal1 = Math.abs(this.sinLUT[seed]);
                    const rVal2 = Math.abs(this.sinLUT[(seed + 80) & 255]);
                    const rVal3 = Math.abs(this.sinLUT[(seed + 160) & 255]);

                    const edge = Math.floor(rVal1 * 4);
                    let sx, sy, dx, dy;

                    const offset = (rVal2 - 0.5) * (4 + animIntensity * 5 + beatImpulse * 4);
                    const sparkLen = rVal3 * (4 * animIntensity + beatImpulse * 12);

                    if (edge === 0) { sx = x + rVal1 * activeW; sy = currentY - 4; dx = sx + offset; dy = sy - sparkLen; }
                    else if (edge === 1) { sx = x + rVal1 * activeW; sy = currentY + h + 4; dx = sx + offset; dy = sy + sparkLen; }
                    else if (edge === 2) { sx = x - 4; sy = currentY + rVal1 * h; dx = sx - sparkLen; dy = sy + offset; }
                    else { sx = x + activeW + 4; sy = currentY + rVal1 * h; dx = sx + sparkLen; dy = sy + offset; }

                    const sparkColor = animIntensity >= 1.0 ? cWhite : cGreen;

                    drawAliasedLineClipped(
                        ctx,
                        Math.round(sx),
                        Math.round(sy),
                        Math.round(dx),
                        Math.round(dy),
                        sparkColor,
                        clipRect
                    );
                }
            }

            if (activeSegs > 0) {
                for (let i = 0; i < activeSegs; i++) {
                    let color = cGreen;
                    if (i >= 23) color = cRed;
                    else if (i >= 12) color = cYellow;

                    if (isFlashing) color = cWhite;

                    ctx.fillStyle = color;
                    fillClampedRect(ctx, x + i * (segW + gap), currentY, segW, h, width, height);
                }
            }
        }
    }
}