// === js/visuals/dse/universal/track-presenter.js ===
import { C64_PALETTE, rgbToHex, quantizeAmiga12Bit, quantizeAtari9Bit } from '../../utils/hardware-constraints.js';

export class TrackPresenter {
    constructor() {
        this.name = 'Universal Track Presenter';
        this.trackInfo = null; 
    }

    resize(width, height) {}

    render(ctx, width, height, t, state, stateTime, metrics) {
        if (!this.trackInfo) return;

        // 1. LIFECYCLE MANAGEMENT (Dynamisch via metadata.minPlayTime)
        // Fallback auf 8.0, falls metadata noch nicht geladen wurde
        const displayTime = this.metadata ? this.metadata.minPlayTime : 8.0;
        
        if (state !== 'starting' && state !== 'stopping' && stateTime > displayTime && !this._markedForRemoval) {
            this._markedForRemoval = true;
        }

        // 2. KINEMATIK (Slide In / Slide Out)
        const boxH = Math.floor(height * 0.35); 
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
        const boxW = Math.floor(width * 0.8);
        const boxX = Math.floor((width - boxW) / 2);

        ctx.fillStyle = borderHex;
        ctx.fillRect(boxX, currentY, boxW, boxH);
        ctx.fillStyle = bgHex;
        ctx.fillRect(boxX + 2, currentY + 2, boxW - 4, boxH - 4);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const isAmigaOrAtari = metrics.system === 'amiga' || metrics.system === 'atari';
        // Schrift leicht vergrößert für bessere Lesbarkeit auf 16-Bit Systemen!
        ctx.font = isAmigaOrAtari ? "16px 'VT323', monospace" : "8px 'Press Start 2P', monospace";

        let displayTitle = this.trackInfo.name || 'UNKNOWN';
        if (displayTitle.length > 25) displayTitle = displayTitle.substring(0, 22) + '...';

        ctx.fillStyle = accentHex;
        ctx.fillText(displayTitle, Math.floor(width / 2), Math.floor(currentY + boxH * 0.3));

        ctx.fillStyle = textHex;
        ctx.fillText("BY " + (this.trackInfo.author || 'UNKNOWN'), Math.floor(width / 2), Math.floor(currentY + boxH * 0.6));

        ctx.fillStyle = borderHex;
        ctx.font = isAmigaOrAtari ? "12px 'VT323', monospace" : "6px 'Press Start 2P', monospace";
        ctx.fillText(this.trackInfo.type || 'RAW DATA', Math.floor(width / 2), Math.floor(currentY + boxH * 0.85));
    }
}