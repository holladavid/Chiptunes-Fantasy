// === js/visuals/dse/universal/track-presenter.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: TRACK PRESENTER (TITLE CARD)
// Universal One-Shot Event. Slides in, shows metadata, self-destructs.
// Uses strict 200p quantized hardware colors and dynamic clamping
// for perfect Widescreen / Mobile Portrait proportions.
// =========================================================

import { C64_PALETTE, rgbToHex, quantizeAmiga12Bit, quantizeAtari9Bit } from '../../utils/hardware-constraints.js';

export class TrackPresenter {
    constructor() {
        this.name = 'Universal Track Presenter';
        this.trackInfo = null; 
    }

    resize(width, height) {}

    render(ctx, width, height, t, state, stateTime, metrics) {
        if (!this.trackInfo) return;

        // 1. LIFECYCLE MANAGEMENT
        const displayTime = this.metadata ? this.metadata.minPlayTime : 8.0;
        
        if (state !== 'starting' && state !== 'stopping' && stateTime > displayTime && !this._markedForRemoval) {
            this._markedForRemoval = true;
        }

        // =========================================================
        // 2. KINEMATIK & SKALIERUNG (Mobile vs. Fullscreen Fix)
        // =========================================================
        
        // Feste Maximalbreite für Widescreen/Desktop (260px sieht aus wie eine klassische Title-Card).
        // Fließende Anpassung für schmale Mobile-Screens (90% der Breite).
        const boxW = Math.min(Math.floor(width * 0.9), 260); 
        
        // Feste Höhe in Retro-Pixeln (reicht perfekt für 3 Zeilen Text ohne zu dominieren)
        const boxH = 56; 
        const boxX = Math.floor((width - boxW) / 2);
        
        const targetY = Math.floor(height * 0.1); 
        let currentY = -boxH - 10; 

        if (state === 'starting') {
            const ease = 1.0 - Math.pow(1.0 - Math.min(1.0, stateTime / 1.5), 3);
            currentY = Math.floor((-boxH - 10) + (targetY - (-boxH - 10)) * ease);
        } else if (state === 'stopping') {
            const ease = Math.pow(Math.min(1.0, stateTime / 1.5), 3);
            currentY = Math.floor(targetY + ((-boxH - 10) - targetY) * ease);
        } else {
            currentY = targetY; 
        }

        const bump = Math.floor(metrics.beat[0] * 3.0);
        currentY += bump;

        // 3. HARDWARE THEMES
        let bgHex, borderHex, textHex, accentHex;

        if (metrics.system === 'c64') {
            bgHex = rgbToHex(...C64_PALETTE[6]);       
            borderHex = rgbToHex(...C64_PALETTE[14]);  
            textHex = rgbToHex(...C64_PALETTE[1]);     
            accentHex = rgbToHex(...C64_PALETTE[7]);   
        } else if (metrics.system === 'amiga') {
            bgHex = rgbToHex(...quantizeAmiga12Bit(0, 0, 34));
            borderHex = rgbToHex(...quantizeAmiga12Bit(0, 85, 255));
            textHex = rgbToHex(...quantizeAmiga12Bit(255, 255, 255));
            accentHex = rgbToHex(...quantizeAmiga12Bit(255, 136, 0));
        } else {
            bgHex = rgbToHex(...quantizeAtari9Bit(0, 17, 0));
            borderHex = rgbToHex(...quantizeAtari9Bit(0, 170, 0));
            textHex = rgbToHex(...quantizeAtari9Bit(255, 255, 255));
            accentHex = rgbToHex(...quantizeAtari9Bit(85, 255, 85));
        }

        if (metrics.beat[0] > 0.6) borderHex = textHex;

        // 4. RENDERN
        ctx.fillStyle = borderHex;
        ctx.fillRect(boxX, currentY, boxW, boxH);
        ctx.fillStyle = bgHex;
        ctx.fillRect(boxX + 2, currentY + 2, boxW - 4, boxH - 4);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const isAmigaOrAtari = metrics.system === 'amiga' || metrics.system === 'atari';
        
        // STRICT ALIASING FIX: C64 Font MUSS 8px sein! 6px erzeugt browser-seitiges Matsch-Aliasing.
        ctx.font = isAmigaOrAtari ? "16px 'VT323', monospace" : "8px 'Press Start 2P', monospace";

        // Dynamisches Text-Clipping basierend auf der tatsächlichen Box-Breite (Wichtig für Mobile!)
        const charWidth = isAmigaOrAtari ? 7 : 8; 
        const maxChars = Math.max(5, Math.floor((boxW - 16) / charWidth));

        let displayTitle = this.trackInfo.name || 'UNKNOWN';
        if (displayTitle.length > maxChars) displayTitle = displayTitle.substring(0, maxChars - 3) + '...';

        let displayAuthor = "BY " + (this.trackInfo.author || 'UNKNOWN');
        if (displayAuthor.length > maxChars) displayAuthor = displayAuthor.substring(0, maxChars - 3) + '...';
        
        let displayType = this.trackInfo.type || 'RAW DATA';
        if (displayType.length > maxChars) displayType = displayType.substring(0, maxChars - 3) + '...';

        // Exakte vertikale Ausrichtung auf dem Pixel-Grid (Keine fließenden Prozentwerte mehr)
        ctx.fillStyle = accentHex;
        ctx.fillText(displayTitle, Math.floor(width / 2), Math.floor(currentY + 16));

        ctx.fillStyle = textHex;
        ctx.fillText(displayAuthor, Math.floor(width / 2), Math.floor(currentY + 28));

        ctx.fillStyle = borderHex;
        ctx.fillText(displayType, Math.floor(width / 2), Math.floor(currentY + 44));
    }
}