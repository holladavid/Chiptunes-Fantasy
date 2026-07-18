// === js/visuals/dse/c64/retro-sunset.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: C64 RETRO SUNSET (v5.0.0 - Background Edition)
// 100% Anti-Aliasing free. Pure fillRect() integer rendering.
// Stripped down to pure background aesthetics: No competing raster 
// bars. Uses inner-edge sun dithering, 1px horizon heat-haze, 
// subtle sky band breathing and beat-reactive water cone reflections.
// =========================================================

import { C64_PALETTE, rgbToHex } from '../../utils/hardware-constraints.js';

export class C64RetroSunset {
    constructor() {
        this.name = 'C64 Retro Sunset';
        this.computerType = ['c64'];
        this.placementType = 'background';
        
        this.internalT = 0;
        this.waterT = 0;
        this.smoothedSpeed = 1.0;
        this.smoothedWaveSpeed = 1.0;
        this.lastT = 0;
        this.frameCounter = 0;

        // Statischer Farb-Cache zur Vermeidung von CPU-Lookups im Renderloop
        this.colDarkBlue  = rgbToHex(...C64_PALETTE[6]);
        this.colRed       = rgbToHex(...C64_PALETTE[2]);
        this.colLightRed  = rgbToHex(...C64_PALETTE[10]);
        this.colYellow    = rgbToHex(...C64_PALETTE[7]);
        this.colWhite     = rgbToHex(...C64_PALETTE[1]);
        this.colLightBlue = rgbToHex(...C64_PALETTE[14]);
        
    this.waterPattern = [1,0,1,1, 0,0,1,0, 1,0,0,0, 1,1,1,0, 0,1,0,0, 1,0,1,1, 0,1,0,0, 0,0,1,0];
        this.patternLen = 32;

        // NEU: Pre-allozierte, echte Zufalls-Offsets für jede Zeile bei der Initialisierung!
        this.waterOffsets = new Float32Array(200); // 200p Maximalhöhe abgesichert
        for (let i = 0; i < 200; i++) {
            this.waterOffsets[i] = Math.floor(Math.random() * 256); // Verschiebt jede Zeile um bis zu 256px
        }
    }

    resize(width, height) {}

    render(ctx, width, height, t, state, stateTime, metrics) {
        if (state === 'idle') { this.lastT = t; return; }
        let dt = this.lastT === 0 ? 0.016 : t - this.lastT;
        this.lastT = t;

        this.frameCounter++;

        let globalAlpha = 1.0;
        let targetSpeed = 1.0;
        let targetWaveSpeed = 1.0;

        if (state === 'starting') {
            globalAlpha = Math.min(1.0, stateTime / 1.5);
        } else if (state === 'stopping') {
            globalAlpha = Math.max(0.0, 1.0 - (stateTime / 1.5));
        } else if (state === 'buildup') {
            targetSpeed = 1.2;             
            targetWaveSpeed = 2.0;         
        } else if (state === 'climax') {
            targetSpeed = 2.2;
            targetWaveSpeed = 6.0; // Purer Geschwindigkeits-Boost     
        }

        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * 0.05;
        this.smoothedWaveSpeed += (targetWaveSpeed - this.smoothedWaveSpeed) * 0.05;
        
        this.internalT += dt * this.smoothedSpeed;
        
        // Beat pusht die Scrolling-Geschwindigkeit direkt an
        let activeWaveSpeed = this.smoothedWaveSpeed + (metrics.beat[0] * 8.0);
        this.waterT += dt * activeWaveSpeed;

        ctx.globalAlpha = globalAlpha;
        
        const horizon = Math.floor(height * 0.55); 
        const minDim = Math.min(width, height); 
        const cx = Math.floor(width / 2);

        // =========================================================
        // 1. DER HIMMEL (Subtiles VIC-II Breathing)
        // =========================================================
        const y1 = Math.floor(horizon * 0.28);
        const y2 = Math.floor(horizon * 0.58);
        const y3 = Math.floor(horizon * 0.85);

        // Subtiles Farb-Atmen: Bänder ändern alle paar Sekunden für 3 Frames die Farbe
        let cSky1 = this.colDarkBlue;
        if (this.frameCounter % 180 < 3) cSky1 = this.colLightBlue;

        let cSky3 = this.colLightRed;
        if ((this.frameCounter + 90) % 180 < 3) cSky3 = this.colRed;

        ctx.fillStyle = cSky1;             ctx.fillRect(0, 0, width, y1); 
        ctx.fillStyle = this.colRed;       ctx.fillRect(0, y1, width, y2 - y1); 
        ctx.fillStyle = cSky3;             ctx.fillRect(0, y2, width, y3 - y2); 
        ctx.fillStyle = this.colYellow;    ctx.fillRect(0, y3, width, horizon - y3);

        // =========================================================
        // 2. HORIZON HEAT HAZE (1-Pixel Flimmern)
        // =========================================================
        // Simuliert flimmernde Hitze über dem Wasser - 1 Pixel stark, extrem effektiv!
        ctx.fillStyle = (this.frameCounter % 6 < 3) ? this.colWhite : this.colYellow;
        ctx.fillRect(0, horizon - 1, width, 1);

        // =========================================================
        // 3. DIE SONNE (Inner-Edge Dithering, keine Corona)
        // =========================================================
        let sunR = Math.floor(minDim * 0.16); 
        // Sonne taucht tief in den Horizont ein
        let sy = Math.floor(horizon + 12); 
        const blockSize = 4; 
        const blockR = Math.floor(sunR / blockSize);
        
        for (let by = -blockR; by <= 0; by++) {
            let drawY = sy + by * blockSize;
            if (drawY >= horizon) continue; 

            let dx = Math.round(Math.sqrt(blockR * blockR - by * by));
            if (isNaN(dx)) dx = 0;

            let startX = cx - dx * blockSize;
            let endX = cx + dx * blockSize;

            // Core (Weiß)
            ctx.fillStyle = this.colWhite;
            ctx.fillRect(startX, drawY, dx * 2 * blockSize, blockSize);

            // Inner-Edge Dithering: Der Rand flirrt zwischen Gelb und Weiß
            if (dx > 0) {
                // Das Schachbrett-Muster verschiebt sich im Takt der Frames
                let isYellowEdge = ((Math.abs(by) + Math.floor(this.frameCounter / 6)) % 2 === 0);
                if (isYellowEdge) {
                    ctx.fillStyle = this.colYellow;
                    ctx.fillRect(startX, drawY, blockSize, blockSize);
                    ctx.fillRect(endX - blockSize, drawY, blockSize, blockSize);
                }
            }
        }

        // =========================================================
        // 4. DAS WASSER (Deterministisches horizontales Parallax-Scrolling)
        // =========================================================
        ctx.fillStyle = this.colDarkBlue; 
        ctx.fillRect(0, horizon, width, height - horizon);

        const blockW = 8; // Pixelbreite eines "Wasser-Sprites"

        for (let y = horizon; y < height; y += 4) {
            let dy = y - horizon;
            
            // Holt das bei Systemstart einmalig zufällig erzeugte Start-Offset für diese Zeile (Kein Moiré!)
            let initOffset = this.waterOffsets[y % 200];
            let pixelOffset = Math.floor(initOffset + this.waterT * (12 + dy * 0.35)); 
            
            // Der Spiegelungs-Kegel pulsiert dezent mit dem Beat!
            let coneBeatExpand = metrics.beat[0] * 12.0;
            let coneW = Math.floor((minDim * 0.08) + dy * 1.25 + coneBeatExpand);

            // Wir iterieren über das Raster
            for (let px = -(pixelOffset % blockW); px < width; px += blockW) {
                
                // Muster-Index berechnen (Ringt sich durch die 32 Bits)
                let i = Math.floor((px + pixelOffset) / blockW);
                let bitIdx = ((i % this.patternLen) + this.patternLen) % this.patternLen;

                let isSolid = this.waterPattern[bitIdx] === 1;

                if (isSolid) {
                    let distToCenter = Math.abs(px - cx);

                    if (distToCenter < coneW) {
                        // Reflektion (Innerhalb des Kegels)
                        // Bei Beat breitet sich der grell-weiße Glanzpunkt ein paar Zeilen weiter nach unten aus!
                        let whiteDepth = 8 + metrics.beat[0] * 12;
                        
                        if (dy < whiteDepth && bitIdx % 3 === 0) {
                            ctx.fillStyle = this.colWhite; 
                        } else {
                            ctx.fillStyle = (dy % 8 < 4) ? this.colYellow : this.colLightRed;
                        }
                    } else {
                        // Normales Wasser
                        ctx.fillStyle = this.colLightBlue;
                    }
                    
                    ctx.fillRect(px, y, blockW, 2);
                }
            }
        }

        ctx.globalAlpha = 1.0;
    }
}