// === js/visuals/dse/universal/track-presenter.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: TRACK PRESENTER (PLATFORM-SPECIFIC)
// v2.2.1 - Redesigned with distinct C64 Rasterbars, Amiga Copper,
// and Atari GEM Frames. Fully optimized with dynamic C64 subtracks,
// and safe, non-overflowing Atari ST truncation.
// =========================================================

import { C64_PALETTE, rgbToHex, quantizeAmiga12Bit, quantizeAtari9Bit, drawAliasedLine } from '../../utils/hardware-constraints.js';

function truncateToFit(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    
    let truncated = text;
    while (truncated.length > 1) {
        truncated = truncated.substring(0, truncated.length - 1);
        if (ctx.measureText(truncated + '...').width <= maxWidth) {
            return truncated + '...';
        }
    }
    return '...';
}

export class TrackPresenter {
    constructor() {
        this.name = 'Universal Track Presenter';
        this.trackInfo = null; 
        this.wasBeat = false;
        this.beatCounter = 0;
    }

    setTrackInfo(info) {
        this.trackInfo = info;
    }

    resize(width, height) {}

    render(ctx, width, height, t, state, stateTime, metrics) {
        if (!this.trackInfo) return;

        const displayTime = this.metadata ? this.metadata.duration : 5.0;
        
        if (state !== 'starting' && state !== 'stopping' && stateTime > displayTime && !this._markedForRemoval) {
            this._markedForRemoval = true;
        }

        const isC64 = metrics.system === 'c64';
        const isAmiga = metrics.system === 'amiga';
        const isAtari = metrics.system === 'atari';

        // Beat-Trigger abgreifen
        const beat = metrics.beat[0];
        const isBeat = beat > 0.75 && !this.wasBeat;
        this.wasBeat = (beat > 0.75);
        if (isBeat) this.beatCounter++;

        // =========================================================
        // 1. DISKRETES 15HZ "TICK" EASING
        // =========================================================
        const tQuant = Math.floor(stateTime * 15); 
        const progress = Math.min(1.0, tQuant / 15); // Von 20 auf 15 reduziert für eine knackige 1.0s Transition!
        const ease = (1.0 - Math.cos(progress * Math.PI)) * 0.5;

        // Horizont & Orientierung
        const horizon = Math.floor(height * 0.55);
        const cx = Math.floor(width / 2);
        const isPortrait = width < height; // KORREKTUR: Wieder deklariert!

        // Metadata Textaufbereitung
        const titleText = (this.trackInfo.name || 'UNKNOWN').toUpperCase();
        const authorText = ("BY " + (this.trackInfo.author || 'UNKNOWN')).toUpperCase();
        const typeText = (this.trackInfo.type || 'RAW DATA').toUpperCase();

        const isUltraNarrow = width < 160; // Wahr bei mobilem Hochkant-Modus

        // =========================================================
        // PLATTLFORM-EXKLUSIVER RENDERER: C64 (RASTERBAR SLIDE & DUAL-LINE)
        // =========================================================
        if (isC64) {
            const barH = 55; // 11 Bänder à 5 Pixel
            const targetY = Math.floor(horizon * 0.28);
            
            // HIER ANPASSEN: Ein fester Randabstand (z.B. 16px auf Desktop, schrumpft dynamisch auf Mobile)
            const marginX = Math.max(12, Math.floor(width * 0.08)); 
            const boxW = width - (marginX * 2);

            let currentY = -barH - 10;
            if (state === 'starting') {
                currentY = Math.floor((-barH - 10) + (targetY - (-barH - 10)) * ease);
            } else if (state === 'stopping') {
                currentY = Math.floor(targetY + ((-barH - 10) - targetY) * ease);
            } else {
                currentY = targetY;
            }

            const rasterColors = [6, 6, 14, 14, 12, 1, 12, 14, 14, 6, 6].map(idx => rgbToHex(...C64_PALETTE[idx]));
            const bandH = 5;
            
            // Raster-Interrupt-Split mit dynamischem X-Offset zeichnen
            for (let i = 0; i < rasterColors.length; i++) {
                let rY = currentY + i * bandH;
                let wobbleX = Math.floor(Math.sin(rY * 0.08 + t * 4.0) * 3);
                ctx.fillStyle = rasterColors[i];
                // Zeichnet die Rasterbar jetzt zentriert mit sauberem Randabstand!
                ctx.fillRect(marginX + wobbleX, rY, boxW, bandH);
            }

            const fontTitle = isUltraNarrow ? "6px 'Press Start 2P', monospace" : "8px 'Press Start 2P', monospace";
            const fontSub = isUltraNarrow ? "5px 'Press Start 2P', monospace" : "8px 'Press Start 2P', monospace";

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            let textY1 = Math.floor(currentY + 18);
            let textY2 = Math.floor(currentY + 36);

            let maxTextW = boxW - 16;
            ctx.font = fontTitle;
            let textW = ctx.measureText(titleText).width;

            if (textW > maxTextW) {
                ctx.save();
                ctx.beginPath();
                // Clip-Bereich an die neue Box-Breite angepasst
                ctx.rect(marginX + 8, currentY + 4, maxTextW, barH - 8);
                ctx.clip();

                let scrollX = (t * 45) % (textW + maxTextW + 30);
                let tx = Math.floor(width - (marginX + 8) - scrollX);
                ctx.fillStyle = rgbToHex(...C64_PALETTE[0]); 
                ctx.fillText(titleText, tx, textY1);
                ctx.restore();
            } else {
                ctx.fillStyle = (beat > 0.6) ? rgbToHex(...C64_PALETTE[7]) : rgbToHex(...C64_PALETTE[0]);
                ctx.fillText(titleText, cx, textY1);
            }

            ctx.font = fontSub;
            let curSub = this.trackInfo.currentSubsong || this.trackInfo.startSong || 1;
            let subtracksText = this.trackInfo.songs ? ` • SUB ${curSub}/${this.trackInfo.songs}` : "";
            let displaySub = authorText + subtracksText;
            let displaySubTruncated = truncateToFit(ctx, displaySub, maxTextW);

            ctx.fillStyle = rgbToHex(...C64_PALETTE[6]); 
            ctx.fillText(displaySubTruncated, cx, textY2);
        }

// =========================================================
        // PLATTLFORM-EXKLUSIVER RENDERER: AMIGA (COPPERLIST CURTAINS)
        // =========================================================
        if (isAmiga) {
            const paneH = 44; // Schlankeres Lesefeld (von 64 auf 44 reduziert)
            const targetY = Math.floor(horizon * 0.38); // Leicht nach unten versetzt für perfekte Zentrierung
            
            // Ein OCS-Verlauf besteht aus 6 Zeilen à 4 Pixel = exakt 24px Höhe!
            const copLineH = 4; 
            const curtainH = 24; 

            let topY = -curtainH;
            let botY = height;
            
            if (state === 'starting') {
                topY = Math.floor(-curtainH + (targetY + curtainH) * ease);
                botY = Math.floor(height - (height - (targetY + paneH)) * ease);
            } else if (state === 'stopping') {
                topY = Math.floor(targetY + (-curtainH - targetY) * ease);
                botY = Math.floor((targetY + paneH) + (height - (targetY + paneH)) * ease);
            } else {
                topY = targetY;
                botY = targetY + paneH;
            }

            const copColors = [
                [0,0,34], [0,0,68], [85,0,85], [170,0,85], [255,102,0], [255,255,255]
            ].map(c => rgbToHex(...quantizeAmiga12Bit(c[0], c[1], c[2])));

            // Top Curtain (Bündig nach oben gezeichnet)
            for (let i = 0; i < copColors.length; i++) {
                ctx.fillStyle = copColors[i];
                ctx.fillRect(0, Math.floor(topY - curtainH + i * copLineH), width, copLineH);
            }

            // Bottom Curtain (Bündig nach unten gezeichnet)
            for (let i = 0; i < copColors.length; i++) {
                ctx.fillStyle = copColors[copColors.length - 1 - i];
                ctx.fillRect(0, Math.floor(botY + i * copLineH), width, copLineH);
            }

            // Lesefeld füllen
            ctx.fillStyle = rgbToHex(...quantizeAmiga12Bit(17, 0, 34));
            ctx.fillRect(0, Math.floor(topY), width, Math.floor(botY - topY));

            // Text zeichnen (Perfekt mittig zentriert)
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            const fontTitle = isUltraNarrow ? "14px 'VT323', monospace" : "18px 'VT323', monospace";
            const fontSub = isUltraNarrow ? "11px 'VT323', monospace" : "13px 'VT323', monospace";
            ctx.font = fontTitle;

            let textY1 = Math.floor(topY + (botY - topY) * 0.32);
            let textY2 = Math.floor(topY + (botY - topY) * 0.68);

            let maxTextW = width - 20;
            let textW = ctx.measureText(titleText).width;

            if (textW > maxTextW) {
                ctx.save();
                ctx.beginPath();
                ctx.rect(10, topY, maxTextW, botY - topY);
                ctx.clip();

                let scrollX = (t * 50) % (textW + maxTextW + 30);
                let tx = Math.floor(width - 10 - scrollX);
                ctx.fillStyle = rgbToHex(...quantizeAmiga12Bit(255, 119, 0)); 
                ctx.fillText(titleText, tx, textY1);
                ctx.restore();
            } else {
                ctx.fillStyle = rgbToHex(...quantizeAmiga12Bit(255, 119, 0));
                ctx.fillText(titleText, cx, textY1);
            }

            ctx.font = fontSub;
            ctx.fillStyle = rgbToHex(...quantizeAmiga12Bit(255, 255, 255)); 
            ctx.fillText(authorText + " • " + typeText, cx, textY2);
        }
        
        // =========================================================
        // PLATTLFORM-EXKLUSIVER RENDERER: ATARI ST (GEM DIALOG TRUNCATION)
        // =========================================================
        if (isAtari) {
            const boxW = Math.min(Math.floor(width * (isPortrait ? 0.94 : 0.85)), 280); 
            const boxH = 50;
            const boxX = Math.floor((width - boxW) / 2);
            
            const targetY = Math.floor(horizon * 0.25);
            let currentY = -boxH - 10;
            
            if (state === 'starting') {
                currentY = Math.floor((-boxH - 10) + (targetY - (-boxH - 10)) * ease);
            } else if (state === 'stopping') {
                currentY = Math.floor(targetY + ((-boxH - 10) - targetY) * ease);
            } else {
                currentY = targetY;
            }

            const bgHex = rgbToHex(...quantizeAtari9Bit(17, 34, 17));       
            const borderHex = rgbToHex(...quantizeAtari9Bit(0, 170, 0));    
            const textHex = rgbToHex(...quantizeAtari9Bit(255, 255, 255));  
            const accentHex = rgbToHex(...quantizeAtari9Bit(255, 136, 0));  

            // Fenster füllen
            ctx.fillStyle = bgHex;
            ctx.fillRect(boxX, currentY, boxW, boxH);

            // Outlines (Bresenham)
            drawAliasedLine(ctx, boxX, currentY, boxX + boxW, currentY, borderHex);
            drawAliasedLine(ctx, boxX, currentY + boxH, boxX + boxW, currentY + boxH, borderHex);
            drawAliasedLine(ctx, boxX, currentY, boxX, currentY + boxH, borderHex);
            drawAliasedLine(ctx, boxX + boxW, currentY, boxX + boxW, currentY + boxH, borderHex);

            // GEM Eck-Kreuze
            drawAliasedLine(ctx, boxX - 2, currentY - 2, boxX + 2, currentY + 2, borderHex);
            drawAliasedLine(ctx, boxX + boxW - 2, currentY - 2, boxX + boxW + 2, currentY + 2, borderHex);
            drawAliasedLine(ctx, boxX - 2, currentY + boxH - 2, boxX + 2, currentY + boxH + 2, borderHex);
            drawAliasedLine(ctx, boxX + boxW - 2, currentY + boxH - 2, boxX + boxW + 2, currentY + boxH + 2, borderHex);

            const fontTitle = isUltraNarrow ? "14px 'VT323', monospace" : "18px 'VT323', monospace";
            const fontSub = isUltraNarrow ? "11px 'VT323', monospace" : "14px 'VT323', monospace";

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            let textY1 = Math.floor(currentY + 16);
            let textY2 = Math.floor(currentY + 36);

            const maxTextW = boxW - 16;
            ctx.font = fontTitle;

            // --- ZEILE 1: TRUNCATION TITLE ON ATARI ---
            let displayTitle = truncateToFit(ctx, titleText, maxTextW);

            ctx.fillStyle = accentHex;
            ctx.fillText(displayTitle, cx, textY1);

            // --- ZEILE 2: TRUNCATION SUBTEXT ON ATARI (KORREKTUR!) ---
            // Setzt zuerst die kleinere Subtext-Schrift für die Breitenmessung
            ctx.font = fontSub;
            let subtext = authorText + " • " + typeText;
            let displaySub = truncateToFit(ctx, subtext, maxTextW);

            ctx.fillStyle = textHex;
            ctx.fillText(displaySub, cx, textY2);
        }

        ctx.globalAlpha = 1.0;
    }
}