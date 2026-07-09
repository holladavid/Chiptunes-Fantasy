// === js/visuals/dse/universal/retro-sunset.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: RETRO SUNSET (CLEAN CLASSIC EDITION)
// Multi-system landscape with strict hardware quantization.
// Restored to the timeless classic design with zero anti-aliasing.
// =========================================================

import { C64_PALETTE, rgbToHex, quantizeAmiga12Bit, quantizeAtari9Bit, fillAliasedCircle } from '../../utils/hardware-constraints.js';

export class RetroSunset {
    constructor() {
        this.internalT = 0; this.waterT = 0; 
        this.smoothedSpeed = 1.0; this.smoothedWaveSpeed = 1.0; this.lastT = 0;
    }
    
    resize(width, height) {}
    
    render(ctx, width, height, t, state, stateTime, metrics) {
        if (state === 'idle') { this.lastT = t; return; }
        let dt = this.lastT === 0 ? 0.016 : t - this.lastT;
        this.lastT = t;

        let globalAlpha = 1.0;
        let targetSpeed = 1.0;
        let targetWaveSpeed = 1.0;
        let beatIntensity = 0.0;

        if (state === 'starting') {
            globalAlpha = Math.min(1.0, stateTime / 1.5);
        } else if (state === 'stopping') {
            globalAlpha = Math.max(0.0, 1.0 - (stateTime / 1.5));
        } else if (state === 'buildup') {
            targetSpeed = 1.2;             
            targetWaveSpeed = 1.5;         
            beatIntensity = 0.2;           
        } else if (state === 'climax') {
            targetSpeed = 2.2;
            targetWaveSpeed = 5.0;         
            beatIntensity = 1.0;           
        }

        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * 0.05;
        this.smoothedWaveSpeed += (targetWaveSpeed - this.smoothedWaveSpeed) * 0.05;
        
        this.internalT += dt * this.smoothedSpeed;
        this.waterT += dt * this.smoothedWaveSpeed;

        let activeSunPulse = metrics.beat[0] * beatIntensity;
        let activeBeatDistortion = metrics.beat[0] * beatIntensity * 4.0;

        ctx.globalAlpha = globalAlpha;
        const horizon = height * 0.55; 

        if (metrics.system === 'c64') this.drawC64(ctx, width, height, horizon, activeSunPulse, activeBeatDistortion, metrics);
        else if (metrics.system === 'amiga') this.drawAmiga(ctx, width, height, horizon, activeSunPulse, activeBeatDistortion);
        else this.drawAtari(ctx, width, height, horizon, activeSunPulse, activeBeatDistortion);

        ctx.globalAlpha = 1.0;
    }

    drawC64(ctx, w, h, horizon, sunPulse, beatDistortion, metrics) {
        const colDarkBlue  = rgbToHex(...C64_PALETTE[6]);
        const colRed       = rgbToHex(...C64_PALETTE[2]);
        const colLightRed  = rgbToHex(...C64_PALETTE[10]);
        const colYellow    = rgbToHex(...C64_PALETTE[7]);
        const colWhite     = rgbToHex(...C64_PALETTE[1]);
        const colLightBlue = rgbToHex(...C64_PALETTE[14]);

        // Sky Bands
        ctx.fillStyle = colDarkBlue; ctx.fillRect(0, 0, w, horizon * 0.3); 
        ctx.fillStyle = colRed; ctx.fillRect(0, horizon * 0.3, w, horizon * 0.3); 
        ctx.fillStyle = colLightRed; ctx.fillRect(0, horizon * 0.6, w, horizon * 0.25); 
        ctx.fillStyle = colYellow; ctx.fillRect(0, horizon * 0.85, w, horizon * 0.15); 

        // Mathematisch perfekte, symmetrische C64 Sonne
        let sunR = Math.floor(25 + (sunPulse * 8.0)); 
        let sx = Math.floor(w / 2); 
        let sy = Math.floor(horizon - 12);

        const blockSize = 4; 
        const blockR = Math.round(sunR / blockSize);
        const centerBlockX = Math.floor(sx / blockSize);
        const centerBlockY = Math.floor(sy / blockSize);

        ctx.fillStyle = colWhite;
        for (let by = -blockR; by <= blockR; by++) {
            let dx = Math.round(Math.sqrt(blockR * blockR - by * by));
            let screenY = (centerBlockY + by) * blockSize;
            let startX = (centerBlockX - dx) * blockSize;
            let endX = (centerBlockX + dx) * blockSize;
            ctx.fillRect(startX, screenY, endX - startX, blockSize);
        }

        // Water
        ctx.fillStyle = colDarkBlue; ctx.fillRect(0, horizon, w, h - horizon);

        let waveSpeed = this.waterT * 10; 
        for (let y = Math.floor(horizon); y < h; y += 4) {
            let offset = Math.floor((waveSpeed + y * 2) % 40);
            
            for (let x = -40; x < w + 40; x += 40) {
                let drawX = Math.floor(x - offset);
                
                if (Math.abs(drawX - sx) < sunR * 0.8 && y > horizon + 8) {
                    let isBright = (beatDistortion > 2.0) ? (Math.random() > 0.4) : (Math.random() > 0.2);
                    ctx.fillStyle = isBright ? colYellow : colLightRed;
                } else {
                    ctx.fillStyle = colLightBlue; 
                }
                ctx.fillRect(drawX, Math.floor(y + 1), 10, 2); 
            }
        }
    }

    drawAmiga(ctx, w, h, horizon, sunPulse, beatDistortion) {
        // Amiga Sky Gradient (Quantized 12-Bit)
        let skyGrad = ctx.createLinearGradient(0, 0, 0, horizon);
        skyGrad.addColorStop(0.0, rgbToHex(...quantizeAmiga12Bit(0, 0, 68))); 
        skyGrad.addColorStop(0.4, rgbToHex(...quantizeAmiga12Bit(170, 0, 68))); 
        skyGrad.addColorStop(0.8, rgbToHex(...quantizeAmiga12Bit(255, 68, 0))); 
        skyGrad.addColorStop(1.0, rgbToHex(...quantizeAmiga12Bit(255, 255, 0)));
        ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, w, horizon);

        let sunR = Math.floor(30 + (sunPulse * 15));
        let sx = Math.floor(w / 2);
        let sy = Math.floor(horizon - 10);
        
        let glowColor = rgbToHex(...quantizeAmiga12Bit(255, 170, 0)); 
        let coreColor = rgbToHex(...quantizeAmiga12Bit(255, 255, 255)); 
        let glowR = Math.floor(sunR + 10 + (sunPulse * 5));
        
        fillAliasedCircle(ctx, sx, sy, glowR, glowColor);
        fillAliasedCircle(ctx, sx, sy, sunR, coreColor);

        // Water
        ctx.fillStyle = rgbToHex(...quantizeAmiga12Bit(0, 0, 34)); ctx.fillRect(0, horizon, w, h - horizon);

        ctx.fillStyle = rgbToHex(...quantizeAmiga12Bit(255, 136, 0));
        let distortion = 1 + (beatDistortion * 1.5); 
        for (let y = horizon; y < h; y += 1) {
            let depth = (y - horizon) / (h - horizon); 
            let waveWidth = 15 + (depth * 50); 
            let xOffset = Math.sin((y * 0.1) + (this.waterT * 3.0)) * distortion;
            
            if (depth > 0.6 && y % 2 === 0) continue; 
            
            ctx.fillRect(Math.floor(sx - (waveWidth / 2) + xOffset), Math.floor(y), Math.floor(waveWidth), 1);
        }
    }

    drawAtari(ctx, w, h, horizon, sunPulse, beatDistortion) {
        // Atari Sky Bands (Quantized 9-Bit)
        const rawSkyColors = [
            [0, 0, 51], [34, 0, 51], [68, 0, 34], [102, 0, 17], 
            [136, 0, 0], [170, 34, 0], [204, 68, 0], [255, 102, 0]
        ];
        let bandH = horizon / rawSkyColors.length;
        for (let i = 0; i < rawSkyColors.length; i++) { 
            ctx.fillStyle = rgbToHex(...quantizeAtari9Bit(...rawSkyColors[i])); 
            ctx.fillRect(0, Math.floor(i * bandH), w, Math.ceil(bandH)); 
        }

        let sx = Math.floor(w / 2);
        let sy = Math.floor(horizon - 25);
        let sunR = Math.floor(25 + (sunPulse * 10));
        
        let outerColor = rgbToHex(...quantizeAtari9Bit(255, 170, 0));
        let innerColor = rgbToHex(...quantizeAtari9Bit(255, 255, 85));
        
        fillAliasedCircle(ctx, sx, sy, sunR, outerColor);
        fillAliasedCircle(ctx, sx, sy, Math.floor(sunR * 0.7), innerColor);

        // Water
        ctx.fillStyle = rgbToHex(...quantizeAtari9Bit(0, 0, 34)); ctx.fillRect(0, horizon, w, h - horizon);

        let waterSpeed = this.waterT * 25;
        let distortion = 2 + (beatDistortion * 2.0); 

        const cWater1 = rgbToHex(...quantizeAtari9Bit(0, 68, 170));
        const cWater2 = rgbToHex(...quantizeAtari9Bit(0, 119, 255));
        const cGlitch = rgbToHex(...quantizeAtari9Bit(255, 255, 255));
        const cSunRef = rgbToHex(...quantizeAtari9Bit(255, 255, 85));

        for (let y = horizon + 2; y < h; y += (y - horizon) * 0.15 + 2) {
            let depth = (y - horizon) / (h - horizon);
            let thickness = Math.max(1, Math.floor(depth * 2));
            let speed = waterSpeed * (0.5 + depth * 1.5);
            let offset = speed % 40;

            for (let x = -40; x < w; x += 40) {
                if (Math.abs(x + offset - sx) < sunR * (1.0 - depth*0.5) && y < horizon + 40) ctx.fillStyle = cSunRef; 
                else ctx.fillStyle = (Math.floor(y) % 3 === 0) ? cWater1 : cWater2; 
                
                let dashWidth = 8 + depth * 15;
                let xDistort = Math.sin(y * 0.2 + waterSpeed) * distortion;
                
                if (beatDistortion > 2.0 && Math.random() > 0.7) {
                    ctx.fillStyle = cGlitch; ctx.fillRect(0, Math.floor(y), w, 1); 
                } else {
                    ctx.fillRect(Math.floor(x + offset + xDistort), Math.floor(y), Math.floor(dashWidth), Math.floor(thickness));
                }
            }
        }
    }
}