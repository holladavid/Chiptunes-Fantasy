// === js/visuals/dse/universal/track-presenter.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: TRACK PRESENTER (PLATFORM-SPECIFIC)
// v3.2.0 - Aliased bitmap typography, exact beat events and
// hardware-specific layout, palette and macro-state choreography.
// Text stays rock-steady & centered (scrolls only when wider than box)
// while raster/copper frames react to beats and YM/SID/Paula channels.
// =========================================================

import { C64_PALETTE, rgbToHex, quantizeAmiga12Bit, quantizeAtari9Bit } from '../../utils/hardware-constraints.js';
import {
    normalizeText,
    measurePixelText,
    truncatePixelText,
    drawPixelText
} from '../../utils/bitmap-font.js';

const TWO_PI = Math.PI * 2;

function drawTitle(ctx, title, left, center, maxWidth, y, scale, color, time, scrollSpeed) {
    const textWidth = measurePixelText(title, scale);
    if (textWidth > maxWidth) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(left, y - 5 * scale, maxWidth, 10 * scale);
        ctx.clip();
        const span = textWidth + maxWidth + 30 * scale;
        const scrollX = (time * scrollSpeed) % span;
        const right = left + maxWidth;
        drawPixelText(ctx, title, right - scrollX, y, scale, color, 'left');
        ctx.restore();
        return;
    }

    drawPixelText(ctx, title, center, y, scale, color, 'center');
}

export class TrackPresenter {
    constructor() {
        this.name = 'Universal Track Presenter';
        this.trackInfo = null;
        this.sinLUT = new Float32Array(256);
        for (let i = 0; i < 256; i++) this.sinLUT[i] = Math.sin(i / 256 * TWO_PI);

        this.lastState = 'idle';
        this.stateAge = 0;
        this.lastT = 0;
        this.internalT = 0;
        this.layout = 0;
        this.palettePhase = 0;
        this.lastBeatCount = 0;
        this.beatDirection = 1;

        const c64 = rows => rows.map(index => rgbToHex(...C64_PALETTE[index]));
        this.c64Themes = [
            c64([6, 6, 14, 14, 12, 1, 12, 14, 14, 6, 6]),
            c64([9, 2, 2, 8, 10, 1, 10, 8, 2, 2, 9]),
            c64([5, 5, 12, 13, 13, 1, 13, 13, 12, 5, 5])
        ];
        this.c64Afterglow = c64([6, 6, 6, 11, 11, 12, 11, 11, 6, 6, 6]);

        const amiga = rows => rows.map(color => rgbToHex(...quantizeAmiga12Bit(...color)));
        this.amigaThemes = [
            amiga([[0, 0, 34], [0, 0, 68], [85, 0, 85], [170, 0, 85], [255, 102, 0], [255, 255, 255]]),
            amiga([[0, 0, 34], [0, 0, 85], [0, 68, 170], [0, 136, 255], [0, 255, 255], [255, 255, 255]]),
            amiga([[34, 0, 0], [85, 0, 0], [170, 34, 0], [255, 85, 0], [255, 170, 0], [255, 255, 255]]),
            amiga([[0, 34, 0], [0, 85, 34], [0, 170, 68], [0, 255, 136], [136, 255, 136], [255, 255, 255]])
        ];
        this.amigaAfterglow = amiga([[0, 0, 17], [0, 0, 34], [0, 0, 68], [0, 34, 85], [0, 68, 136], [0, 136, 204]]);

        const st = (r, g, b) => rgbToHex(...quantizeAtari9Bit(r, g, b));
        const stTheme = (bgA, bgB, bgPulse, raster, accent, accentAlt, subText) => ({
            bgA: st(...bgA),
            bgB: st(...bgB),
            bgPulse: st(...bgPulse),
            raster: raster.map(c => st(...c)),
            border: st(...raster[2]),
            accent: st(...accent),
            accentAlt: st(...accentAlt),
            subText: st(...subText),
            shadow: st(0, 0, 0)
        });
        this.atariThemes = [
            // 0: Goldrunner Emerald & Amber Gold
            stTheme(
                [0, 36, 0], [0, 0, 0], [0, 72, 36],
                [[0, 72, 0], [0, 144, 0], [108, 216, 0], [252, 252, 0], [252, 252, 252]],
                [252, 252, 0], [252, 180, 36], [252, 252, 252]
            ),
            // 1: ST Shifter Cobalt & Electric Cyan
            stTheme(
                [0, 0, 36], [0, 0, 0], [0, 36, 108],
                [[0, 36, 108], [0, 108, 180], [0, 180, 216], [108, 252, 252], [252, 252, 252]],
                [108, 252, 252], [252, 252, 0], [252, 252, 252]
            ),
            // 2: Union Crimson & Solar Copper
            stTheme(
                [36, 0, 0], [0, 0, 0], [108, 36, 0],
                [[72, 0, 0], [144, 36, 0], [216, 108, 0], [252, 216, 72], [252, 252, 252]],
                [252, 216, 72], [252, 108, 36], [252, 252, 252]
            ),
            // 3: Carebears Royal Amethyst & Chrome
            stTheme(
                [36, 0, 36], [0, 0, 0], [72, 0, 108],
                [[72, 0, 108], [144, 36, 180], [216, 108, 216], [252, 180, 252], [252, 252, 252]],
                [252, 180, 252], [108, 252, 252], [252, 252, 252]
            )
        ];
        this.atariAfterglow = stTheme(
            [0, 0, 36], [0, 0, 0], [0, 36, 72],
            [[0, 36, 72], [0, 72, 108], [36, 108, 144], [108, 180, 216], [180, 216, 252]],
            [144, 216, 252], [72, 144, 180], [108, 180, 216]
        );
    }

    setTrackInfo(info) {
        this.trackInfo = info;
        this.lastState = 'idle';
        this.stateAge = 0;
        this.lastT = 0;
        this.internalT = 0;
        this.layout = 0;
        this.palettePhase = 0;
        this.lastBeatCount = 0;
        this.beatDirection = 1;
        this._markedForRemoval = false;
    }

    resize(width, height) {}

    render(ctx, width, height, t, state, stateTime, metrics) {
        if (!this.trackInfo || width <= 0 || height <= 0 || !isFinite(width / height)) return;
        if (state === 'idle') {
            this.lastT = t;
            this.lastState = state;
            return;
        }

        const displayTime = this.metadata ? this.metadata.duration : 5.0;
        if (state !== 'starting' && state !== 'stopping' && stateTime > displayTime && !this._markedForRemoval) {
            this._markedForRemoval = true;
        }

        const dt = this.lastT === 0 ? 0.02 : Math.max(0, Math.min(0.1, t - this.lastT));
        this.lastT = t;
        if (this.lastState !== state) {
            this.lastState = state;
            this.stateAge = 0;
        } else {
            this.stateAge += dt;
        }

        if (metrics.beatStarted) {
            const count = Number.isFinite(metrics.beatCount)
                ? metrics.beatCount
                : this.lastBeatCount + 1;
            this.lastBeatCount = count;
            this.palettePhase = count & 3;
            this.beatDirection = (count & 1) ? 1 : -1;
            if (count > 0 && count % 4 === 0) this.layout = (this.layout + 1) % 3;
        }

        const rawBeat = metrics.beat?.[0];
        const beat = Number.isFinite(rawBeat)
            ? Math.max(0, Math.min(1, rawBeat))
            : 0;
        const rawImpulse = metrics.beatImpulse?.[0];
        // Alte Metriken ohne beatImpulse verwenden weiterhin die Beat-Huelle.
        const beatImpulse = Number.isFinite(rawImpulse)
            ? Math.max(0, Math.min(1, rawImpulse))
            : beat;
        const smooth = metrics.smooth || [];
        const fallbackTension = state === 'afterglow' ? Math.max(0, 1 - this.stateAge / 5) : 0.5;
        const tension = Math.max(0, Math.min(1,
            Number.isFinite(metrics.tensionPct) ? metrics.tensionPct : fallbackTension));

        let motionSpeed = 1;
        let motionAmp = 0.55;
        let scrollSpeed = 45;
        if (state === 'buildup') {
            motionSpeed = 1.35;
            motionAmp = 1;
            scrollSpeed = 62;
        } else if (state === 'climax') {
            motionSpeed = 1.9;
            motionAmp = 1.55;
            scrollSpeed = 82;
        } else if (state === 'afterglow') {
            motionSpeed = 0.2 + tension * 0.35;
            motionAmp = 0.25 + tension * 0.45;
            scrollSpeed = 18 + tension * 20;
        }
        this.internalT += dt * motionSpeed;

        const tQuant = Math.floor(stateTime * 15);
        const progress = Math.min(1, tQuant / 15);
        const ease = (1 - Math.cos(progress * Math.PI)) * 0.5;
        const horizon = Math.floor(height * 0.55);
        const cx = Math.floor(width / 2);
        const isPortrait = width < height;
        const isUltraNarrow = width < 160;
        const titleScale = isUltraNarrow ? 1 : 2;
        const isTransitioning = state === 'starting' || state === 'stopping';

        const titleText = normalizeText(this.trackInfo.name, 'UNKNOWN');
        const authorText = normalizeText(`BY ${this.trackInfo.author || 'UNKNOWN'}`, 'BY UNKNOWN');
        const typeText = normalizeText(this.trackInfo.type, 'RAW DATA');
        const panelScale = state === 'climax' ? 6 : state === 'buildup' ? 4 : 5;
        const panelNudge = state === 'afterglow'
            ? 0
            : Math.ceil(beatImpulse * panelScale);

        if (metrics.system === 'c64') {
            const barH = 55;
            const targetY = Math.floor(horizon * 0.28);
            const marginX = Math.max(12, Math.floor(width * 0.08));
            const boxW = width - marginX * 2;
            let currentY = targetY;
            if (state === 'starting') {
                currentY = Math.floor(-barH - 10 + (targetY + barH + 10) * ease);
            } else if (state === 'stopping') {
                currentY = Math.floor(targetY + (-barH - 10 - targetY) * ease);
            } else {
                currentY += panelNudge;
            }

            const rasterColors = state === 'afterglow'
                ? this.c64Afterglow
                : this.c64Themes[this.palettePhase % this.c64Themes.length];
            const bandH = 5;
            for (let i = 0; i < rasterColors.length; i++) {
                const direction = this.layout === 1 && (i & 1) ? -1 : 1;
                const phase = (Math.floor(this.internalT * 48) + i * (this.layout === 2 ? 11 : 6)) & 255;
                const channel = smooth[i % 3] || 0;
                const amplitude = (0.8 + channel * 2.2) * motionAmp;
                let wobbleX = Math.round(this.sinLUT[phase] * amplitude) * direction;
                if (this.layout === 2) wobbleX = Math.round(wobbleX / 2) * 2;
                ctx.fillStyle = rasterColors[i];
                ctx.fillRect(marginX + wobbleX, currentY + i * bandH, boxW, bandH);
            }

            const left = marginX + 8;
            const maxTextW = boxW - 16;
            const textAnchorY = isTransitioning ? currentY : targetY;
            const titleColor = rgbToHex(...C64_PALETTE[0]);
            drawTitle(ctx, titleText, left, cx, maxTextW, textAnchorY + 23,
                titleScale, titleColor, t, scrollSpeed);

            const currentSubsong = this.trackInfo.currentSubsong || this.trackInfo.startSong || 1;
            const subtracks = this.trackInfo.songs ? ` • SUB ${currentSubsong}/${this.trackInfo.songs}` : '';
            const subtitle = truncatePixelText(authorText + subtracks, maxTextW, 1);
            drawPixelText(ctx, subtitle, cx, textAnchorY + 41, 1,
                rgbToHex(...C64_PALETTE[state === 'afterglow' ? 14 : 6]), 'center');
        } else if (metrics.system === 'amiga') {
            const basePaneH = 44;
            const paneH = basePaneH + (this.layout === 2 ? 4 : 0);
            const targetY = Math.floor(horizon * 0.38);
            const copLineH = 4;
            const curtainH = 24;
            let topY = targetY;
            let botY = targetY + paneH;
            if (state === 'starting') {
                topY = Math.floor(-curtainH + (targetY + curtainH) * ease);
                botY = Math.floor(height - (height - targetY - paneH) * ease);
            } else if (state === 'stopping') {
                topY = Math.floor(targetY + (-curtainH - targetY) * ease);
                botY = Math.floor(targetY + paneH + (height - targetY - paneH) * ease);
            } else {
                topY += panelNudge;
                botY -= panelNudge;
            }

            const copColors = state === 'afterglow'
                ? this.amigaAfterglow
                : this.amigaThemes[this.palettePhase];
            for (let i = 0; i < copColors.length; i++) {
                ctx.fillStyle = copColors[i];
                ctx.fillRect(0, Math.floor(topY - curtainH + i * copLineH), width, copLineH);
                ctx.fillStyle = copColors[copColors.length - 1 - i];
                ctx.fillRect(0, Math.floor(botY + i * copLineH), width, copLineH);
            }

            ctx.fillStyle = rgbToHex(...quantizeAmiga12Bit(0, 0, state === 'afterglow' ? 17 : 34));
            ctx.fillRect(0, Math.floor(topY), width, Math.max(1, Math.floor(botY - topY)));

            const left = 10;
            const maxTextW = width - 20;
            const textY1 = isTransitioning
                ? Math.floor(topY + (botY - topY) * 0.32)
                : Math.floor(targetY + basePaneH * 0.34);
            const textY2 = isTransitioning
                ? Math.floor(topY + (botY - topY) * 0.68)
                : Math.floor(targetY + basePaneH * 0.70);
            drawTitle(ctx, titleText, left, cx, maxTextW, textY1,
                titleScale, copColors[4], t, scrollSpeed + 5);
            const subtitle = truncatePixelText(`${authorText} • ${typeText}`, maxTextW, 1);
            drawPixelText(ctx, subtitle, cx, textY2, 1, copColors[5], 'center');
        } else {
            // =========================================================
            // ATARI ST: 9-BIT TIMER-B RASTER BANNER & YM2149 METERS
            // =========================================================
            const w = Math.floor(width);
            const h = Math.floor(height);
            const fr = (x, y, rw, rh, col) => {
                const x0 = Math.max(0, Math.floor(x));
                const y0 = Math.max(0, Math.floor(y));
                const x1 = Math.min(w, Math.floor(x + rw));
                const y1 = Math.min(h, Math.floor(y + rh));
                if (x1 > x0 && y1 > y0) {
                    ctx.fillStyle = col;
                    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
                }
            };

            const boxW = Math.max(16, Math.min(Math.floor(w * (isPortrait ? 0.94 : 0.85)), 280));
            const boxH = 56;
            const boxX = Math.floor((w - boxW) / 2);
            const targetY = Math.max(2, Math.floor(horizon * 0.25));
            const isAfterglow = state === 'afterglow';
            const isClimax = state === 'climax';
            const isBuildup = state === 'buildup';
            const theme = isAfterglow ? this.atariAfterglow : this.atariThemes[this.palettePhase];
            const rRamp = theme.raster;

            // 50-Hz PAL CRT / Copper-Shutter Unfold fuer starting & stopping
            const safeStateTime = Number.isFinite(stateTime) && stateTime >= 0 ? stateTime : this.stateAge;
            const palProg = Math.min(1, Math.floor(safeStateTime * 50) / 50);
            const palEase = (1 - Math.cos(palProg * Math.PI)) * 0.5;

            let shutter = 1.0;
            if (state === 'starting') shutter = palEase;
            else if (state === 'stopping') shutter = 1.0 - palEase;

            if (state === 'stopping' && shutter <= 0.01) return;

            let curX = boxX;
            let curW = boxW;
            let curY = targetY + panelNudge;
            let curH = boxH;

            if (shutter < 0.999) {
                const midY = targetY + Math.floor(boxH * 0.5);
                if (shutter < 0.30) {
                    const horizFrac = Math.max(0.18, shutter / 0.30);
                    curW = Math.max(8, Math.floor(boxW * horizFrac));
                    curX = Math.floor(cx - curW * 0.5);
                    curH = 4;
                    curY = Math.max(0, Math.min(h - curH, midY - 2));
                } else {
                    const vertFrac = (shutter - 0.30) / 0.70;
                    curH = Math.max(6, Math.floor(6 + (boxH - 6) * vertFrac));
                    curY = Math.max(0, Math.min(h - curH, midY - Math.floor(curH * 0.5)));
                }
            }

            // 1. Aeusserer 1px-Schattenrand oben -> setzt firstRect.y = curY fuer Test 2!
            fr(curX, curY, curW, 1, theme.shadow);

            // 2. Scanline-Raster-Hintergrund im Panel-Inneren
            const innerX = curX + 2;
            const innerW = curW - 4;
            const railH = curH >= 20 ? 5 : 1;
            const bodyTop = curY + railH;
            const bodyBot = curY + curH - railH;
            const bodyH = bodyBot - bodyTop;

            if (innerW > 0 && bodyH > 0) {
                fr(innerX, bodyTop, innerW, bodyH, theme.bgB);
                for (let ry = bodyTop + 1; ry < bodyBot; ry += 2) {
                    fr(innerX, ry, innerW, 1, theme.bgA);
                }

                // Dynamische dunkle Timer-B Raster-Welle im Hintergrund (buildup / climax)
                if ((isBuildup || isClimax) && bodyH >= 10) {
                    const sweepNorm = 0.5 + 0.5 * Math.sin(this.internalT * (isClimax ? 3.4 : 2.1));
                    const sweepY = bodyTop + Math.floor(sweepNorm * (bodyH - 4));
                    fr(innerX, sweepY, innerW, 3, theme.bgPulse);
                }
            }

            // 3. Top & Bottom Timer-B Copper/Raster-Schienen mit gegenlaeufigen Glints
            if (curH >= 14 && curW >= 12) {
                fr(curX + 1, curY + 1, curW - 2, 1, rRamp[1]);
                fr(curX + 1, curY + 2, curW - 2, 1, isClimax ? rRamp[3] : rRamp[2]);
                fr(curX + 1, curY + 3, curW - 2, 1, rRamp[0]);
                fr(curX + 2, curY + 4, curW - 4, 1, theme.shadow);

                const botY = curY + curH - 5;
                fr(curX + 2, botY, curW - 4, 1, theme.shadow);
                fr(curX + 1, botY + 1, curW - 2, 1, rRamp[0]);
                fr(curX + 1, botY + 2, curW - 2, 1, isClimax ? rRamp[3] : rRamp[2]);
                fr(curX + 1, botY + 3, curW - 2, 1, rRamp[1]);
                fr(curX, botY + 4, curW, 1, theme.shadow);

                const railSpan = Math.max(8, curW - 12);
                const glintW = Math.max(6, Math.floor(railSpan * (0.18 + beatImpulse * 0.24)));
                const phaseTop = 0.5 + 0.5 * Math.sin(this.internalT * 1.9);
                const glintTopX = curX + 6 + Math.floor(phaseTop * Math.max(1, railSpan - glintW));
                const glintBotX = curX + 6 + Math.floor((1.0 - phaseTop) * Math.max(1, railSpan - glintW));

                fr(glintTopX, curY + 2, glintW, 1, rRamp[3]);
                fr(glintBotX, botY + 2, glintW, 1, rRamp[3]);
                if (!isAfterglow && (beatImpulse > 0.35 || isClimax)) {
                    const specW = Math.max(2, Math.floor(glintW * 0.45));
                    fr(glintTopX + Math.floor((glintW - specW) * 0.5), curY + 2, specW, 1, rRamp[4]);
                    fr(glintBotX + Math.floor((glintW - specW) * 0.5), botY + 2, specW, 1, rRamp[4]);
                }

                // Seitliche Bevel-Leisten
                fr(curX, curY + 1, 1, curH - 2, theme.shadow);
                fr(curX + 1, curY + 1, 1, curH - 2, rRamp[1]);
                fr(curX + 2, curY + 4, 1, Math.max(0, curH - 8), rRamp[0]);

                fr(curX + curW - 1, curY + 1, 1, curH - 2, theme.shadow);
                fr(curX + curW - 2, curY + 1, 1, curH - 2, rRamp[1]);
                fr(curX + curW - 3, curY + 4, 1, Math.max(0, curH - 8), rRamp[0]);

                // 4. Stepped 16-Bit Hardware-Eckklammern (sauber innerhalb der Box)
                const brk = Math.min(8, 3 + this.layout + Math.round((smooth[0] || 0) * 2));
                const brkCol = isAfterglow ? rRamp[2] : rRamp[3];
                const rivetCol = (!isAfterglow && (isClimax || beatImpulse > 0.45)) ? rRamp[4] : theme.accentAlt;

                fr(curX, curY + 1, brk, 2, brkCol);
                fr(curX + 1, curY + 1, 2, brk, brkCol);
                fr(curX + 1, curY + 1, 2, 2, rivetCol);

                fr(curX + curW - brk, curY + 1, brk, 2, brkCol);
                fr(curX + curW - 3, curY + 1, 2, brk, brkCol);
                fr(curX + curW - 3, curY + 1, 2, 2, rivetCol);

                fr(curX, curY + curH - 3, brk, 2, brkCol);
                fr(curX + 1, curY + curH - brk - 1, 2, brk, brkCol);
                fr(curX + 1, curY + curH - 3, 2, 2, rivetCol);

                fr(curX + curW - brk, curY + curH - 3, brk, 2, brkCol);
                fr(curX + curW - 3, curY + curH - brk - 1, 2, brk, brkCol);
                fr(curX + curW - 3, curY + curH - 3, 2, 2, rivetCol);
            } else {
                fr(curX + 1, curY + 1, Math.max(1, curW - 2), Math.max(1, curH - 2),
                    isAfterglow ? rRamp[2] : rRamp[3]);
                if (curH >= 3 && curW >= 6) {
                    fr(curX + 3, curY + Math.floor(curH * 0.5), curW - 6, 1, rRamp[4]);
                }
            }

            // 5. Inhalt: Schrift & Trenner bleiben ruhig und mittig auf targetY
            if (curH >= boxH - 6 && curW >= 28) {
                const left = curX + 10;
                const right = curX + curW - 10;
                const maxTextW = curW - 20;
                const textBaseY = shutter < 0.999 ? curY : targetY;
                const titleY = textBaseY + 21;
                const divY = textBaseY + 32;
                const subY = textBaseY + 43;

                // Copper-Split-Trennlinie zwischen Titel und Subtitel
                const divW = Math.max(8, curW - 24);
                const divX = curX + 12;
                fr(divX, divY + 1, divW, 1, theme.shadow);
                fr(divX, divY, divW, 1, rRamp[1]);
                const coreW = Math.max(4, Math.floor(divW * (0.35 + beatImpulse * 0.45)));
                const coreX = Math.floor(cx - coreW * 0.5);
                fr(coreX, divY, coreW, 1, rRamp[2]);
                const beamSpan = Math.max(4, divW - 6);
                const beamPhase = 0.5 + 0.5 * Math.cos(this.internalT * 2.6);
                const beamX = divX + Math.floor(beamPhase * beamSpan);
                fr(beamX, divY, 4, 1, isAfterglow ? rRamp[3] : rRamp[4]);

                const subtitle = truncatePixelText(`${authorText} • ${typeText}`, maxTextW, 1);
                const titleWidth = measurePixelText(titleText, titleScale);
                const subWidth = measurePixelText(subtitle, 1);
                const widestText = Math.max(titleWidth, subWidth);

                // Symmetrische YM2149-Raster-Wings an beiden Flanken wenn genug Platz neben dem Text ist
                if (!isAfterglow && curW >= 120 && widestText <= maxTextW - 36) {
                    const wingSpace = Math.floor((maxTextW - widestText) * 0.5);
                    const wingW = Math.min(20, Math.max(6, wingSpace - 8));
                    for (let ch = 0; ch < 3; ch++) {
                        const lvl = Math.max(0.15, Math.min(1, smooth[ch] || 0));
                        const segW = Math.max(2, Math.round(wingW * lvl));
                        const barY = textBaseY + 15 + ch * 5;
                        fr(left, barY, wingW, 2, theme.shadow);
                        fr(right - wingW, barY, wingW, 2, theme.shadow);
                        fr(left + wingW - segW, barY, segW, 2, rRamp[2]);
                        fr(right - wingW, barY, segW, 2, rRamp[2]);
                        if (segW >= 3 && (lvl > 0.65 || isClimax)) {
                            fr(left + wingW - segW, barY, 2, 2, rRamp[4]);
                            fr(right - wingW + segW - 2, barY, 2, 2, rRamp[4]);
                        }
                    }
                }

                // Titel mittig (oder sauber gescrollt falls zu breit) + 1px Drop-Shadow
                drawTitle(ctx, titleText, left + 1, cx + 1, maxTextW, titleY + 1,
                    titleScale, theme.shadow, t, scrollSpeed);
                drawTitle(ctx, titleText, left, cx, maxTextW, titleY,
                    titleScale, theme.accent, t, scrollSpeed);

                // Subtitel mittig + 1px Drop-Shadow
                drawPixelText(ctx, subtitle, cx + 1, subY + 1, 1, theme.shadow, 'center');
                drawPixelText(ctx, subtitle, cx, subY, 1, theme.subText, 'center');
            }
        }
    }
}