// === js/visuals/dse/amiga/paula-silicon-bg.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: PAULA 8364 MICROVERSE (BACKGROUND)
// Authentic 320x256 PAL resolution. 100% 12-Bit OCS Colors.
// Features a 3D perspective floor, Moiré magnetic fields,
// and 4x DMA data-fetch monoliths simulating the hard-wired
// L-R-R-L panning layout. Dramaturgy reacts heavily to tension!
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
        // 1. SKY GRADIENT (12-Bit Quantized)
        // =========================================================
        const horizon = 110;
        // Farbe ändert sich von kühlem Blau zu brennendem Orange/Rot bei hoher Tension
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
            // Strict OCS 12-Bit Quantization!
            let hex = rgbToHex(...quantizeAmiga12Bit(r, g, b));
            ctx.fillStyle = hex;
            ctx.fillRect(0, y, 320, 4);
        }

        // =========================================================
        // 2. MAGNETIC MOIRÉ INTERFERENCE (The Paula Field)
        // =========================================================
        if (tension > 0.2) {
            const intensity = (tension - 0.2) / 0.8; 
            const cx1 = 160 + Math.sin(time) * (40 + intensity * 40);
            const cy1 = 60 + Math.cos(time * 1.3) * 30;
            const cx2 = 160 + Math.sin(time * 1.1 + Math.PI) * (40 + intensity * 40);
            const cy2 = 60 + Math.cos(time * 0.9 + Math.PI) * 30;
            
            ctx.lineWidth = 1;
            const rStep = 8 + intensity * 6;
            
            let mColor = quantizeAmiga12Bit(100 * intensity, 50 + 100 * intensity, 255);
            if (state === 'climax') mColor = quantizeAmiga12Bit(255, 100, 0); // Brennend im Climax
            
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
        // 3. 3D DATA BUS FLOOR (Perspective Projection)
        // =========================================================
        // Die Kamera drückt sich beim Kickdrum-Beat nach unten
        const fov = 100 + tension * 40; 
        const camY = 40 + beat * 15; 
        
        ctx.fillStyle = rgbToHex(...quantizeAmiga12Bit(10, 5, 20));
        ctx.fillRect(0, horizon, 320, 256 - horizon);

        let gridColor = quantizeAmiga12Bit(0, 100 + tension * 155, 255 - tension * 100);
        if (state === 'climax') gridColor = quantizeAmiga12Bit(255, 255, 255);
        ctx.strokeStyle = rgbToHex(...gridColor);
        ctx.lineWidth = 1;
        
        const scrollZ = (time * 120) % 20;
        
        ctx.beginPath();
        // Horizontale Linien
        for (let z = 10; z < 200; z += 20) {
            let pZ = z - scrollZ;
            if (pZ < 1) continue;
            let py = horizon + (camY * fov) / pZ;
            if (py < 256) {
                ctx.moveTo(0, py); ctx.lineTo(320, py);
            }
        }
        // Vertikale Linien (Fluchtpunkt)
        for (let x = -200; x <= 200; x += 40) {
            for (let z = 10; z < 200; z += 20) {
                let pZ = z - scrollZ;
                if (pZ < 1) continue;
                let px = 160 + (x * fov) / pZ;
                let py = horizon + (camY * fov) / pZ;
                if (z === 10) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
        }
        ctx.stroke();

        // =========================================================
        // 4. THE 4 DMA MONOLITHS (L-R-R-L Mapping)
        // =========================================================
        // Kanal 0 & 3 = Links, Kanal 1 & 2 = Rechts
        const dmaX = [40, 210, 270, 100]; 
        
        for (let i = 0; i < 4; i++) {
            let x = dmaX[i];
            let vol = vols[i];
            let isLeft = (i === 0 || i === 3);

            // Sockel des Monolithen
            ctx.fillStyle = rgbToHex(...quantizeAmiga12Bit(40, 40, 50));
            ctx.fillRect(x - 20, 220, 40, 36);
            
            // Leuchtender Kern (Amiga Blue vs. Amiga Orange)
            let coreColor = isLeft ? [0, 50 + vol*200, 255] : [255, 50 + vol*200, 0];
            if (tension > 0.8) coreColor = [255, 255, 255]; // Overheat!
            
            ctx.fillStyle = rgbToHex(...quantizeAmiga12Bit(...coreColor));
            ctx.fillRect(x - 12, 226, 24, 24);

            // Aufsteigende Datenpakete (Data Fetching)
            let fetchSpeed = 60 + vol * 250 + tension * 150;
            let numBlocks = Math.floor(vol * 10) + (tension > 0.5 ? 4 : 2);
            
            for (let b = 0; b < numBlocks; b++) {
                let yOffset = (time * fetchSpeed + b * 30) % 180;
                let blockY = 220 - yOffset;
                
                if (blockY < horizon) continue; 
                
                // Hardware Strain: Wenn der Chip schwitzt, fangen die Daten an zu zittern
                let jitterX = 0;
                if (tension > 0.7 && vol > 0.4) {
                    jitterX = (Math.random() - 0.5) * 8 * tension;
                }

                ctx.fillStyle = rgbToHex(...quantizeAmiga12Bit(...coreColor));
                ctx.fillRect(x - 8 + jitterX, blockY, 16, Math.max(4, vol * 16));
            }

            // Climax Laser Beams (Hard Sync zum Beat)
            if (state === 'climax' && beat > 0.3 && vol > 0.3) {
                ctx.fillStyle = rgbToHex(...quantizeAmiga12Bit(255, 255, 255));
                ctx.fillRect(x - 6, 0, 12, 220); // Schießt durch den Himmel
            }
        }

        // =========================================================
        // 5. STROBE FLASH (Pure 12-Bit Whiteout)
        // =========================================================
        if (state === 'climax' && beat > 0.8) {
            ctx.fillStyle = rgbToHex(...quantizeAmiga12Bit(255, 255, 255));
            ctx.fillRect(0, 0, 320, 256);
        }

        // =========================================================
        // BLIT TO MAIN CANVAS (Nearest-Neighbor Upscaling)
        // =========================================================
        mainCtx.globalAlpha = globalAlpha;
        mainCtx.imageSmoothingEnabled = false; 
        
        // Bewahrt die 320x256 PAL Proportionen beim harten Skalieren
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