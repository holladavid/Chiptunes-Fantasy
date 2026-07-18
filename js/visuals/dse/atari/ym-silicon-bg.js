// === js/visuals/dse/atari/ym-silicon-bg.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: YM2149F MICROVERSE (BACKGROUND)
// Authentic 200px ST vertical resolution with dynamic 
// responsive aspect-ratio width. Strict 9-Bit Palette.
// Features Log-DAC background stairs, live Square Wave cores,
// smooth parallax LFSR Noise rain, and Timer-B glitches.
// 100% Anti-Aliasing free (Zero Subpixel-Bleeding).
// =========================================================

import { quantizeAtari9Bit, rgbToHex } from '../../utils/hardware-constraints.js';

// Atari ST Neon Cyberpunk Palette (Strictly 9-Bit Quantized)
const PAL = [
    [0, 0, 0],       // 0: Black
    [255, 255, 255], // 1: White
    [0, 255, 0],     // 2: Neon Green
    [0, 119, 0],     // 3: Dark Green
    [255, 0, 255],   // 4: Magenta
    [119, 0, 119],   // 5: Dark Magenta
    [0, 255, 255],   // 6: Cyan
    [0, 119, 119]    // 7: Dark Cyan
].map(c => rgbToHex(...quantizeAtari9Bit(c[0], c[1], c[2])));

export class YmSiliconBg {
    constructor() {
        this.name = 'YM2149F Microverse';
        this.computerType = ['atari'];
        this.placementType = 'background';
        
        this.offscreen = document.createElement('canvas');
        this.ctx = this.offscreen.getContext('2d', { alpha: false });
        
        this.lastT = 0;
        this.internalT = 0;
    }

    resize(width, height) {}

    // Hilfsfunktion für harte Aliased-Linien
    drawHLine(ctx, x, y, len, colIdx) {
        ctx.fillStyle = PAL[colIdx];
        ctx.fillRect(x | 0, y | 0, len | 0, 1);
    }
    drawVLine(ctx, x, y, len, colIdx) {
        ctx.fillStyle = PAL[colIdx];
        ctx.fillRect(x | 0, y | 0, 1, len | 0);
    }

    // Zeichnet eine harte Rechteckwelle (Square Wave) für die Oszillatoren
    drawSquareWave(ctx, cx, cy, width, height, vol, time) {
        cx |= 0; cy |= 0; width |= 0; height |= 0; // Subpixel-Killer
        
        const amp = (vol * height) | 0;
        if (amp < 2) {
            this.drawHLine(ctx, cx - Math.floor(width/2), cy, width, 3); // Dark Green Idle Line
            return;
        }

        const period = Math.floor(20 - (vol * 10)); // Wellenlänge abhängig vom Pegel
        const offset = Math.floor(time * 50) % period;
        const leftX = (cx - Math.floor(width/2)) | 0;
        const topY = (cy - Math.floor(amp/2)) | 0;
        const bottomY = (cy + Math.floor(amp/2)) | 0;

        ctx.fillStyle = vol > 0.6 ? PAL[1] : PAL[2]; // White or Neon Green

        let isHigh = false;
        for (let x = 0; x < width; x++) {
            let localX = x + offset;
            let nextHigh = (localX % period) < (period / 2);
            
            ctx.fillRect(leftX + x, nextHigh ? topY : bottomY, 1, 2);
            
            if (x > 0 && isHigh !== nextHigh) {
                ctx.fillRect(leftX + x, topY, 2, amp);
            }
            isHigh = nextHigh;
        }
    }

    render(mainCtx, width, height, t, state, stateTime, metrics) {
        if (state === 'idle') { this.lastT = t; return; }
        let dt = this.lastT === 0 ? 0.016 : t - this.lastT;
        this.lastT = t;

        const TARGET_HEIGHT = 200;
        const aspect = width / height;
        const offW = Math.floor(TARGET_HEIGHT * aspect);
        const offH = TARGET_HEIGHT;

        if (this.offscreen.width !== offW || this.offscreen.height !== offH) {
            this.offscreen.width = offW;
            this.offscreen.height = offH;
        }

        const beat = metrics.beat[0]; 
        const tension = metrics.tensionPct; 
        const vols = metrics.smooth; 

        let globalAlpha = 1.0;
        let speedMult = 1.0;

        if (state === 'starting') { globalAlpha = Math.min(1.0, stateTime / 1.5); } 
        else if (state === 'stopping') { globalAlpha = Math.max(0.0, 1.0 - (stateTime / 1.5)); } 
        else if (state === 'buildup') { speedMult = 1.5; } 
        else if (state === 'climax') { speedMult = 2.5; }

        this.internalT += dt * speedMult;
        const time = this.internalT;

        const ctx = this.ctx;
        ctx.imageSmoothingEnabled = false;

        // Subpixel-Killer: Erzwingt unbestechliche Ganzzahlen
        const cx = Math.floor(offW / 2); 
        const span = Math.floor(Math.min(110, offW * 0.35)); 

        // =========================================================
        // 1. BACKGROUND: LOG-DAC STAIRCASE
        // =========================================================
        ctx.fillStyle = PAL[0]; // Black
        ctx.fillRect(0, 0, offW, offH);

        const scrollY = (time * 15) % 20;
        for (let i = 0; i < 10; i++) {
            let yDist = (Math.pow(1.3, i) * 5) | 0; 
            let yTop = 100 - yDist - scrollY;
            let yBot = 100 + yDist + scrollY;
            
            let col = tension > 0.5 ? 7 : 3; // Dark Cyan / Dark Green
            if (yTop > 0) this.drawHLine(ctx, 0, yTop, offW, col);
            if (yBot < 200) this.drawHLine(ctx, 0, yBot, offW, col);
        }

        // =========================================================
        // 2. THE 3 SQUARE TONE CORES (Symmetrisch & Integrierend)
        // =========================================================
        const coreWidth = Math.min(60, Math.floor(offW * 0.18));
        const coreHeight = 120;
        const coreY = 40;
        
        // Symmetrische Spreizung relativ zur Ganzzahl-Mitte (cx)
        const coreX = [
            Math.floor(cx - span), 
            cx, 
            Math.floor(cx + span)
        ]; 

        for (let i = 0; i < 3; i++) {
            const currentCx = coreX[i];
            const vol = vols[i];
            const halfCoreW = Math.floor(coreWidth / 2);
            
            ctx.fillStyle = PAL[3]; 
            ctx.fillRect(currentCx - halfCoreW - 2, coreY - 2, coreWidth + 4, coreHeight + 4);
            ctx.fillStyle = PAL[0]; 
            ctx.fillRect(currentCx - halfCoreW, coreY, coreWidth, coreHeight);

            for(let gy = coreY; gy < coreY + coreHeight; gy += 8) {
                this.drawHLine(ctx, currentCx - halfCoreW, gy, coreWidth, 3);
            }

            this.drawSquareWave(ctx, currentCx, coreY + coreHeight/2, coreWidth, coreHeight * 0.8, vol, time + i);

            if (vol > 0.1) {
                ctx.fillStyle = vol > 0.7 ? PAL[1] : PAL[2]; 
                ctx.fillRect(currentCx - 10, coreY - 8, 20, 4);
            }
        }

        // =========================================================
        // 3. LFSR NOISE RAIN (Physikalisch flüssiges Parallax-Sinken)
        // =========================================================
        const noiseVol = (vols[0] + vols[1] + vols[2]) / 3.0;
        if (noiseVol > 0.1 || tension > 0.2) {
            const rainIntensity = (noiseVol * 0.30) + (tension * 0.40);
            const dropCount = (rainIntensity * 50) | 0; 
            
            ctx.fillStyle = PAL[4]; // Magenta
            for (let i = 0; i < dropCount; i++) {
                let rx = Math.floor(((Math.sin(i * 45.12) * 0.5 + 0.5) * offW));
                let fallSpeed = 60 + (i % 5) * 15; 
                let ry = Math.floor((i * 17 + time * fallSpeed) % offH);
                let len = (Math.random() * 4 + 2) | 0;
                
                ctx.fillRect(rx, ry, 2, len);
            }
        }

        // =========================================================
        // 4. TIMER-B RASTER GLITCHES (Sync Buzzer Hack)
        // =========================================================
        if (state === 'climax' || (tension > 0.6 && beat > 0.1)) {
            const glitchSeverity = (tension * beat * 30) | 0; 
            
            if (glitchSeverity > 2) {
                const numTears = (Math.random() * 5 + 2) | 0;
                for (let i = 0; i < numTears; i++) {
                    let tearY = (Math.random() * 180) | 0;
                    let tearH = (Math.random() * 15 + 2) | 0;
                    let tearShift = ((Math.random() > 0.5 ? 1 : -1) * glitchSeverity) | 0;

                    let slice = ctx.getImageData(0, tearY, offW, tearH);
                    
                    ctx.fillStyle = PAL[0];
                    ctx.fillRect(0, tearY, offW, tearH);
                    
                    ctx.putImageData(slice, tearShift, tearY);
                }
            }
        }

        // =========================================================
        // 5. ATARI STROBE
        // =========================================================
        if (state === 'climax' && beat > 0.8) {
            ctx.fillStyle = PAL[1]; 
            ctx.fillRect(0, 0, offW, offH);
        }

        // =========================================================
        // BLIT TO MAIN CANVAS
        // Wir entfernen das imageSmoothingEnabled=true am Ende des Loops,
        // um den glättungsfreien Vektor-Staat des Blitters zu erhalten!
        // =========================================================
        mainCtx.globalAlpha = globalAlpha;
        mainCtx.imageSmoothingEnabled = false; 
        mainCtx.drawImage(this.offscreen, 0, 0, width, height);
        mainCtx.globalAlpha = 1.0;
    }
}