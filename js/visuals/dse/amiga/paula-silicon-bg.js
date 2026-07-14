// === js/visuals/dse/amiga/paula-silicon-bg.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: PAULA 8364 MICROVERSE (BACKGROUND)
// Authentic 320x256 PAL resolution. 100% 12-Bit OCS Colors.
// Features a depth-faded 3D perspective floor (horizon 128),
// Moiré magnetic fields, and 4x DMA data-fetch monoliths.
// =========================================================

import { quantizeAmiga12Bit, rgbToHex } from '../../../visuals/utils/hardware-constraints.js';

export class PaulaSiliconBg {
    constructor() {
        this.name = 'Paula 8364 Microverse';
        this.computerType = ['amiga'];
        this.placementType = 'background';
        
        // Exakte Amiga PAL Low-Res Auflösung
        this.offscreen = document.createElement('canvas');
        this.offscreen.width = 320;
        this.offscreen.height = 256;
        this.ctx = this.offscreen.getContext('2d', { alpha: false });
        
        this.lastT = 0;
        this.internalT = 0;
    }

    resize(width, height) {}

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
        else if (state === 'buildup') { speedMult = 1.8; } 
        else if (state === 'climax') { speedMult = 3.0; }

        this.internalT += dt * speedMult;
        const time = this.internalT;

        const ctx = this.ctx;
        ctx.imageSmoothingEnabled = false;

        // =========================================================
        // 1. SKY GRADIENT (Horizon exakt bei Y=128 für Kefrens-Match)
        // =========================================================
        const horizon = 128; // Exakt mittig (50% Split)
        
        for (let y = 0; y < horizon; y += 4) {
            let r = 0, g = 0, b = 0;
            if (tension < 0.5) {
                b = 80 + y;
                r = y * 0.5 + (tension * 100);
            } else {
                r = 100 + y + (tension * 155);
                g = y * tension;
                b = 50;
            }
            let hex = rgbToHex(...quantizeAmiga12Bit(r, g, b));
            ctx.fillStyle = hex;
            ctx.fillRect(0, y, 320, 4);
        }

        // =========================================================
        // 2. MAGNETIC MOIRÉ INTERFERENCE (The Paula Field)
        // =========================================================
        if (tension > 0.2) {
            const intensity = (tension - 0.2) / 0.8; 
            // Zentrum der Kreise an den neuen Horizont (128) anpassen (Höhe 64)
            const cx1 = 160 + Math.sin(time) * (40 + intensity * 40);
            const cy1 = 64 + Math.cos(time * 1.3) * 30;
            const cx2 = 160 + Math.sin(time * 1.1 + Math.PI) * (40 + intensity * 40);
            const cy2 = 64 + Math.cos(time * 0.9 + Math.PI) * 30;
            
            ctx.lineWidth = 1;
            const rStep = 8 + intensity * 6;
            
            let mColor = quantizeAmiga12Bit(100 * intensity, 50 + 100 * intensity, 255);
            if (state === 'climax') mColor = quantizeAmiga12Bit(255, 100, 0); 
            
            ctx.strokeStyle = rgbToHex(...mColor);
            
            ctx.beginPath();
            for (let r = 10; r < 200; r += rStep) {
                ctx.moveTo(cx1 + r, cy1);
                ctx.arc(cx1, cy1, r, 0, Math.PI * 2);
                ctx.moveTo(cx2 + r, cy2);
                ctx.arc(cx2, cy2, r, 0, Math.PI * 2);
            }
            ctx.stroke();
        }

        // =========================================================
        // 3. 3D DATA BUS FLOOR (Smooth Parallax Perspective)
        // =========================================================
        const fov = 120 + tension * 50; 
        const camY = 30 + beat * 15; 
        
        ctx.fillStyle = rgbToHex(...quantizeAmiga12Bit(10, 5, 20));
        ctx.fillRect(0, horizon, 320, 256 - horizon);

        let gridColor = quantizeAmiga12Bit(0, 100 + tension * 155, 255 - tension * 100);
        if (state === 'climax') gridColor = quantizeAmiga12Bit(255, 255, 255);
        ctx.strokeStyle = rgbToHex(...gridColor);
        ctx.lineWidth = 1;
        
        const zMax = 400;
        const zStep = 16; 
        const speed = 150;
        const scrollZ = (time * speed) % zStep;
        
        // Horizontale Querlinien mit Depth-Fading und Near-Plane-Clipping
        for (let z = zMax; z >= zStep; z -= zStep) {
            let pZ = z - scrollZ;
            
            // GFX FIX: Div/0 Verhindern. Linien tauchen unter der Kamera durch.
            if (pZ < 2.5) continue; 
            
            let py = horizon + (camY * fov) / pZ;
            if (py > 256) continue;

            // Weiches Einblenden am Horizont, voll sichtbar im Vordergrund
            let alpha = Math.max(0, 1.0 - (pZ / zMax));
            ctx.globalAlpha = alpha;
            
            ctx.beginPath();
            ctx.moveTo(0, py | 0);
            ctx.lineTo(320, py | 0);
            ctx.stroke();
        }

        // Vertikale Fluchtpunkt-Linien (Konstante Deckkraft, tauchen unter der Kamera ab)
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        for (let x = -400; x <= 400; x += 32) {
            let startZ = zStep - scrollZ;
            if (startZ < 2.5) startZ = 2.5; // Near Plane Clip
            
            let pxStart = 160 + (x * fov) / startZ;
            let pyStart = horizon + (camY * fov) / startZ;
            
            let pxEnd = 160 + (x * fov) / zMax;
            let pyEnd = horizon + (camY * fov) / zMax;
            
            ctx.moveTo(pxStart | 0, pyStart | 0);
            ctx.lineTo(pxEnd | 0, pyEnd | 0);
        }
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        // =========================================================
        // 4. THE 4 DMA MONOLITHS (L-R-R-L Mapping)
        // =========================================================
        const dmaX = [40, 210, 270, 100]; 
        
        for (let i = 0; i < 4; i++) {
            let x = dmaX[i];
            let vol = vols[i];
            let isLeft = (i === 0 || i === 3);

            // Sockel
            ctx.fillStyle = rgbToHex(...quantizeAmiga12Bit(40, 40, 50));
            ctx.fillRect(x - 20, 220, 40, 36);
            
            // Leuchtender Kern
            let coreColor = isLeft ? [0, 50 + vol*200, 255] : [255, 50 + vol*200, 0];
            if (tension > 0.8) coreColor = [255, 255, 255]; 
            
            ctx.fillStyle = rgbToHex(...quantizeAmiga12Bit(...coreColor));
            ctx.fillRect(x - 12, 226, 24, 24);

            let fetchSpeed = 60 + vol * 250 + tension * 150;
            let numBlocks = Math.floor(vol * 10) + (tension > 0.5 ? 4 : 2);
            
            for (let b = 0; b < numBlocks; b++) {
                let yOffset = (time * fetchSpeed + b * 30) % 220;
                let blockY = 220 - yOffset;
                
                // Verschwinden exakt in den Wolken (am Horizont)
                if (blockY < horizon - 10) continue; 
                
                let jitterX = 0;
                if (tension > 0.7 && vol > 0.4) {
                    jitterX = (Math.random() - 0.5) * 8 * tension;
                }

                // Opacity Fade im Himmel
                let bAlpha = 1.0;
                if (blockY < horizon + 20) bAlpha = Math.max(0, (blockY - horizon) / 30);
                
                ctx.globalAlpha = bAlpha;
                ctx.fillStyle = rgbToHex(...quantizeAmiga12Bit(...coreColor));
                ctx.fillRect(x - 8 + jitterX, blockY, 16, Math.max(4, vol * 16));
            }
            ctx.globalAlpha = 1.0;

            if (state === 'climax' && beat > 0.3 && vol > 0.3) {
                ctx.fillStyle = rgbToHex(...quantizeAmiga12Bit(255, 255, 255));
                ctx.fillRect(x - 6, 0, 12, 220); 
            }
        }

        // =========================================================
        // 5. STROBE FLASH
        // =========================================================
        if (state === 'climax' && beat > 0.8) {
            ctx.fillStyle = rgbToHex(...quantizeAmiga12Bit(255, 255, 255));
            ctx.fillRect(0, 0, 320, 256);
        }

        // =========================================================
        // BLIT TO MAIN CANVAS
        // =========================================================
        mainCtx.globalAlpha = globalAlpha;
        mainCtx.imageSmoothingEnabled = false; 
        
        const scale = Math.min(width / 320, height / 256);
        const drawW = (320 * scale) | 0;
        const drawH = (256 * scale) | 0;
        const drawX = ((width - drawW) / 2) | 0;
        const drawY = ((height - drawH) / 2) | 0;

        mainCtx.drawImage(this.offscreen, drawX, drawY, drawW, drawH);
        
        mainCtx.imageSmoothingEnabled = true; 
        mainCtx.globalAlpha = 1.0;
    }
}