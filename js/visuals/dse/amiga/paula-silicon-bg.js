// === js/visuals/dse/amiga/paula-silicon-bg.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: PAULA 8364 MICROVERSE (BACKGROUND)
// Authentic 256 PAL vertical resolution with dynamic 
// responsive aspect-ratio width. 100% 12-Bit OCS Colors.
// Features a depth-faded 3D perspective floor, Moiré magnetic
// fields, and horizon-anchored L-R-R-L DMA monoliths.
// =========================================================

import { quantizeAmiga12Bit, rgbToHex } from '../../../visuals/utils/hardware-constraints.js';

export class PaulaSiliconBg {
    constructor() {
        this.name = 'Paula 8364 Microverse';
        this.computerType = ['amiga'];
        this.placementType = 'background';
        
        // Canvas wird dynamisch im Render-Loop auf das Seitenverhältnis genormt
        this.offscreen = document.createElement('canvas');
        this.ctx = this.offscreen.getContext('2d', { alpha: false });
        
        this.lastT = 0;
        this.internalT = 0;
    }

    resize(width, height) {}

    render(mainCtx, width, height, t, state, stateTime, metrics) {
        if (state === 'idle') { this.lastT = t; return; }
        let dt = this.lastT === 0 ? 0.016 : t - this.lastT;
        this.lastT = t;

        const TARGET_HEIGHT = 256;
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
        else if (state === 'buildup') { speedMult = 1.8; } 
        else if (state === 'climax') { speedMult = 3.0; }

        this.internalT += dt * speedMult;
        const time = this.internalT;

        const ctx = this.ctx;
        ctx.imageSmoothingEnabled = false;

        const horizon = 128; // Immer exakt bei 50% der 256px Höhe
        const cx = offW / 2; // Dynamische horizontale Mitte

        // =========================================================
        // 1. SKY GRADIENT
        // =========================================================
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
            ctx.fillRect(0, y, offW, 4);
        }

        // =========================================================
        // 2. MAGNETIC MOIRÉ INTERFERENCE
        // =========================================================
        if (tension > 0.2) {
            const intensity = (tension - 0.2) / 0.8; 
            const cx1 = cx + Math.sin(time) * (40 + intensity * 40);
            const cy1 = 64 + Math.cos(time * 1.3) * 30;
            const cx2 = cx + Math.sin(time * 1.1 + Math.PI) * (40 + intensity * 40);
            const cy2 = 64 + Math.cos(time * 0.9 + Math.PI) * 30;
            
            ctx.lineWidth = 1;
            const rStep = 8 + intensity * 6;
            
            let mColor = quantizeAmiga12Bit(100 * intensity, 50 + 100 * intensity, 255);
            if (state === 'climax') mColor = quantizeAmiga12Bit(255, 100, 0); 
            
            ctx.strokeStyle = rgbToHex(...mColor);
            
            ctx.beginPath();
            for (let r = 10; r < Math.max(200, offW/2); r += rStep) {
                ctx.moveTo(cx1 + r, cy1);
                ctx.arc(cx1, cy1, r, 0, Math.PI * 2);
                ctx.moveTo(cx2 + r, cy2);
                ctx.arc(cx2, cy2, r, 0, Math.PI * 2);
            }
            ctx.stroke();
        }

        // =========================================================
        // 3. 3D DATA BUS FLOOR
        // =========================================================
        const fov = 120 + tension * 50; 
        const camY = 30 + beat * 15; 
        
        ctx.fillStyle = rgbToHex(...quantizeAmiga12Bit(10, 5, 20));
        ctx.fillRect(0, horizon, offW, offH - horizon);

        let gridColor = quantizeAmiga12Bit(0, 100 + tension * 155, 255 - tension * 100);
        if (state === 'climax') gridColor = quantizeAmiga12Bit(255, 255, 255);
        ctx.strokeStyle = rgbToHex(...gridColor);
        ctx.lineWidth = 1;
        
        const zMax = 400;
        const zStep = 16; 
        const speed = 150;
        const scrollZ = (time * speed) % zStep;
        
        // Horizontale Querlinien
        for (let z = zMax; z >= zStep; z -= zStep) {
            let pZ = z - scrollZ;
            if (pZ < 2.5) continue; 
            
            let py = horizon + (camY * fov) / pZ;
            if (py > offH) continue;

            let alpha = Math.max(0, 1.0 - (pZ / zMax));
            ctx.globalAlpha = alpha;
            
            ctx.beginPath();
            ctx.moveTo(0, py | 0);
            ctx.lineTo(offW, py | 0);
            ctx.stroke();
        }

        // Vertikale Fluchtpunkt-Linien
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        const xRange = Math.max(400, offW * 1.5); 
        for (let x = -xRange; x <= xRange; x += 32) {
            let startZ = zStep - scrollZ;
            if (startZ < 2.5) startZ = 2.5; 
            
            let pxStart = cx + (x * fov) / startZ;
            let pyStart = horizon + (camY * fov) / startZ;
            
            let pxEnd = cx + (x * fov) / zMax;
            let pyEnd = horizon + (camY * fov) / zMax;
            
            ctx.moveTo(pxStart | 0, pyStart | 0);
            ctx.lineTo(pxEnd | 0, pyEnd | 0);
        }
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        // =========================================================
        // 4. THE 4 DMA MONOLITHS (Horizon-Anchored)
        // =========================================================
        // Perspektivisch näher zusammen (am Fluchtpunkt)
        const span = Math.min(100, offW * 0.25); 
        const dmaX = [
            cx - span,        // DMA 0 (Left)
            cx + span * 0.35, // DMA 1 (Right)
            cx + span,        // DMA 2 (Right)
            cx - span * 0.35  // DMA 3 (Left)
        ];
        
        for (let i = 0; i < 4; i++) {
            let x = dmaX[i];
            let vol = vols[i];
            let isLeft = (i === 0 || i === 3);

            // Sockel stehen jetzt auf der Horizontlinie!
            const baseW = 28;
            const baseH = 20;
            const baseY = horizon - baseH;

            ctx.fillStyle = rgbToHex(...quantizeAmiga12Bit(30, 30, 40));
            ctx.fillRect(x - baseW/2, baseY, baseW, baseH);
            
            // Leuchtender Kern (Perspektivisch verkleinert)
            let coreColor = isLeft ? [0, 50 + vol*200, 255] : [255, 50 + vol*200, 0];
            if (tension > 0.8) coreColor = [255, 255, 255]; 
            
            ctx.fillStyle = rgbToHex(...quantizeAmiga12Bit(...coreColor));
            ctx.fillRect(x - 8, baseY + 4, 16, 16);

            let fetchSpeed = 40 + vol * 150 + tension * 100;
            let numBlocks = Math.floor(vol * 8) + (tension > 0.5 ? 3 : 1);
            
            // Datenpakete schießen nach OBEN in den Himmel
            for (let b = 0; b < numBlocks; b++) {
                let yOffset = (time * fetchSpeed + b * 25) % horizon;
                let blockY = baseY - yOffset;
                
                if (blockY < 0) continue; 
                
                let jitterX = 0;
                if (tension > 0.7 && vol > 0.4) {
                    jitterX = (Math.random() - 0.5) * 6 * tension;
                }

                // Weiches Fade-Out, wenn sie die Decke erreichen
                let bAlpha = 1.0;
                if (blockY < 40) bAlpha = Math.max(0, blockY / 40);
                
                ctx.globalAlpha = bAlpha;
                ctx.fillStyle = rgbToHex(...quantizeAmiga12Bit(...coreColor));
                ctx.fillRect(x - 5 + jitterX, blockY, 10, Math.max(3, vol * 12));
            }
            ctx.globalAlpha = 1.0;

            // Climax Laser schießen von der Basis zum Himmel
            if (state === 'climax' && beat > 0.3 && vol > 0.3) {
                ctx.fillStyle = rgbToHex(...quantizeAmiga12Bit(255, 255, 255));
                ctx.fillRect(x - 4, 0, 8, horizon); 
            }
        }

        // =========================================================
        // 5. STROBE FLASH
        // =========================================================
        if (state === 'climax' && beat > 0.8) {
            ctx.fillStyle = rgbToHex(...quantizeAmiga12Bit(255, 255, 255));
            ctx.fillRect(0, 0, offW, offH);
        }

        // =========================================================
        // BLIT TO MAIN CANVAS
        // =========================================================
        mainCtx.globalAlpha = globalAlpha;
        mainCtx.imageSmoothingEnabled = false; 
        
        mainCtx.drawImage(this.offscreen, 0, 0, width, height);
        
        mainCtx.imageSmoothingEnabled = true; 
        mainCtx.globalAlpha = 1.0;
    }
}