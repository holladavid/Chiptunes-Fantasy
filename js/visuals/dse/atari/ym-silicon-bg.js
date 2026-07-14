// === js/visuals/dse/atari/ym-silicon-bg.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: YM2149F MICROVERSE (BACKGROUND)
// Authentic 320x200 ST Low-Res. Strict 9-Bit Palette.
// Features Log-DAC background stairs, live Square Wave cores,
// LFSR Noise rain, and brutal Timer-B raster interrupt glitches.
// =========================================================

import { quantizeAtari9Bit, rgbToHex } from '../../../visuals/utils/hardware-constraints.js';

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
        
        // Exakte Atari ST Low-Res Auflösung
        this.offscreen = document.createElement('canvas');
        this.offscreen.width = 320;
        this.offscreen.height = 200;
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
        const amp = (vol * height) | 0;
        if (amp < 2) {
            this.drawHLine(ctx, cx - width/2, cy, width, 3); // Dark Green Idle Line
            return;
        }

        const period = 20 - (vol * 10); // Wellenlänge abhängig vom Pegel
        const offset = (time * 50) % period;
        const leftX = (cx - width/2) | 0;
        const topY = (cy - amp/2) | 0;
        const botY = (cy + amp/2) | 0;

        ctx.fillStyle = vol > 0.6 ? PAL[1] : PAL[2]; // White (Clipping) or Neon Green

        let isHigh = false;
        for (let x = 0; x < width; x++) {
            let localX = x + offset;
            let nextHigh = (localX % period) < (period / 2);
            
            // Horizontale Linie zeichnen
            ctx.fillRect(leftX + x, nextHigh ? topY : botY, 1, 2);
            
            // Vertikale Verbindungsflanke zeichnen (scharfer Sprung)
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

        // =========================================================
        // 1. BACKGROUND: LOG-DAC STAIRCASE
        // =========================================================
        ctx.fillStyle = PAL[0]; // Black
        ctx.fillRect(0, 0, 320, 200);

        // Bewegende logarithmische Treppen von der Mitte nach außen
        const scrollY = (time * 15) % 20;
        for (let i = 0; i < 10; i++) {
            let yDist = (Math.pow(1.3, i) * 5) | 0; // Exponentielles Wachstum (Logarithmisch)
            let yTop = 100 - yDist - scrollY;
            let yBot = 100 + yDist + scrollY;
            
            let col = tension > 0.5 ? 7 : 3; // Dark Cyan / Dark Green
            if (yTop > 0) this.drawHLine(ctx, 0, yTop, 320, col);
            if (yBot < 200) this.drawHLine(ctx, 0, yBot, 320, col);
        }

        // =========================================================
        // 2. THE 3 SQUARE TONE CORES
        // =========================================================
        const coreWidth = 60;
        const coreHeight = 120;
        const coreY = 40;
        const coreX = [50, 160, 270]; // Perfekte Drittel

        for (let i = 0; i < 3; i++) {
            const cx = coreX[i];
            const vol = vols[i];
            
            // Core Gehäuse (Skeuomorphic Vector)
            ctx.fillStyle = PAL[3]; // Dark Green Border
            ctx.fillRect(cx - coreWidth/2 - 2, coreY - 2, coreWidth + 4, coreHeight + 4);
            ctx.fillStyle = PAL[0]; // Black Inside
            ctx.fillRect(cx - coreWidth/2, coreY, coreWidth, coreHeight);

            // Raster-Gitter im Core
            for(let gy = coreY; gy < coreY + coreHeight; gy += 8) {
                this.drawHLine(ctx, cx - coreWidth/2, gy, coreWidth, 3);
            }

            // Die pulsierende Rechteckwelle!
            this.drawSquareWave(ctx, cx, coreY + coreHeight/2, coreWidth, coreHeight * 0.8, vol, time + i);

            // LED Status an der Spitze
            if (vol > 0.1) {
                ctx.fillStyle = vol > 0.7 ? PAL[1] : PAL[2]; // White or Neon Green
                ctx.fillRect(cx - 10, coreY - 8, 20, 4);
            }
        }

        // =========================================================
        // 3. LFSR NOISE RAIN (Middle Foreground)
        // =========================================================
        const noiseVol = (vols[0] + vols[1] + vols[2]) / 3.0;
        if (noiseVol > 0.1 || tension > 0.2) {
            const rainIntensity = noiseVol + tension;
            const dropCount = (rainIntensity * 100) | 0;
            
            ctx.fillStyle = PAL[4]; // Magenta (Klassischer Atari Kontrast-Ton)
            for (let i = 0; i < dropCount; i++) {
                // Pseudo-Random LFSR Simulation
                let rx = ((Math.sin(time * 123.456 + i) * 160) + 160) | 0;
                let ry = ((Math.cos(time * 345.678 + i) * 100) + 100) | 0;
                let len = (Math.random() * 8 + 2) | 0;
                
                // Falling Digital Rain
                ry = (ry + time * 100) % 200;
                ctx.fillRect(rx, ry, 2, len);
            }
        }

        // =========================================================
        // 4. TIMER-B RASTER GLITCHES (Sync Buzzer Hack Simulation)
        // =========================================================
        // Schneidet das Canvas in Streifen und verschiebt es zeilenweise horizontal
        if (state === 'climax' || (tension > 0.6 && beat > 0.1)) {
            const glitchSeverity = (tension * beat * 30) | 0; // Bis zu 30px Offset!
            
            if (glitchSeverity > 2) {
                const numTears = (Math.random() * 5 + 2) | 0;
                for (let i = 0; i < numTears; i++) {
                    let tearY = (Math.random() * 180) | 0;
                    let tearH = (Math.random() * 15 + 2) | 0;
                    let tearShift = ((Math.random() > 0.5 ? 1 : -1) * glitchSeverity) | 0;

                    // Holt den Bildausschnitt und zeichnet ihn verschoben neu
                    let slice = ctx.getImageData(0, tearY, 320, tearH);
                    
                    // Schwarze Lücke füllen
                    ctx.fillStyle = PAL[0];
                    ctx.fillRect(0, tearY, 320, tearH);
                    
                    // Verschoben wieder einfügen
                    ctx.putImageData(slice, tearShift, tearY);
                }
            }
        }

        // =========================================================
        // 5. ATARI STROBE (Pure Whiteout)
        // =========================================================
        if (state === 'climax' && beat > 0.8) {
            ctx.fillStyle = PAL[1]; // White
            ctx.fillRect(0, 0, 320, 200);
        }

        // =========================================================
        // BLIT TO MAIN CANVAS (Nearest-Neighbor Upscaling)
        // =========================================================
        mainCtx.globalAlpha = globalAlpha;
        mainCtx.imageSmoothingEnabled = false; 
        
        const scale = Math.min(width / 320, height / 200);
        const drawW = (320 * scale) | 0;
        const drawH = (200 * scale) | 0;
        const drawX = ((width - drawW) / 2) | 0;
        const drawY = ((height - drawH) / 2) | 0;

        mainCtx.drawImage(this.offscreen, drawX, drawY, drawW, drawH);
        
        mainCtx.imageSmoothingEnabled = true; 
        mainCtx.globalAlpha = 1.0;
    }
}