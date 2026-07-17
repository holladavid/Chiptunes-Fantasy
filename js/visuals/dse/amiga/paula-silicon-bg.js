// === js/visuals/dse/amiga/paula-silicon-bg.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: PAULA 8364 MICROVERSE (1989 EDITION)
// 100% Alpha-free! Features 16-Color Copper skies, pseudo-3D
// monoliths, vector-LUT Moiré rings, bitplane noise, 
// and dynamic horizon rasterlines. (Tribute to Scoopex & Phenomena)
// =========================================================

import { quantizeAmiga12Bit, rgbToHex, drawAliasedLine } from '../../utils/hardware-constraints.js';

export class PaulaSiliconBg {
    constructor() {
        this.name = 'Paula 8364 Microverse';
        this.computerType = ['amiga'];
        this.placementType = 'background';
        
        this.offscreen = document.createElement('canvas');
        this.ctx = this.offscreen.getContext('2d', { alpha: false });
        
        this.lastT = 0;
        this.internalT = 0;

        // Zero-Allocation Arrays & LUTs
        this.skyPalettes = [];
        this.stars = [];
        this.sin32 = new Float32Array(32);
        this.cos32 = new Float32Array(32);

        this.initialized = false;
        this.ensureInitialized();
    }

    ensureInitialized() {
        if (this.initialized) return;

        // --- 1. 32-POINT VECTOR CIRCLE LUT ---
        for (let i = 0; i < 32; i++) {
            let angle = (i / 32) * Math.PI * 2;
            this.sin32[i] = Math.sin(angle);
            this.cos32[i] = Math.cos(angle);
        }

        // --- 2. 20 STATIC CYCLING STARS ---
        for (let i = 0; i < 20; i++) {
            this.stars.push({
                x: Math.random(),
                y: Math.random() * 0.5, // Nur im oberen Himmel
                phase: Math.random() * 10
            });
        }

        // --- 3. PRE-CALCULATED COPPER SKY PALETTES (Tension 0.0 to 1.0) ---
        // 11 Paletten (für 0% bis 100% Tension) à 16 harte OCS Farben
        for (let t = 0; t <= 10; t++) {
            let tension = t / 10.0;
            let pal = [];
            for (let i = 0; i < 16; i++) {
                let r, g, b;
                // Index 0 ist ganz oben (dunkel), Index 15 ist am Horizont (hell)
                let pct = i / 15.0; 
                
                if (tension < 0.5) {
                    // Deep Blue to Purple/Indigo (Idle/Playing)
                    r = Math.floor(pct * 80 + tension * 100);
                    g = Math.floor(pct * 20);
                    b = Math.floor(50 + pct * 150);
                } else {
                    // Deep Purple to Fiery Orange/Red (Buildup/Climax)
                    r = Math.floor(pct * 150 + tension * 105);
                    g = Math.floor(pct * 120 * tension);
                    b = Math.floor(50 + (1.0 - pct) * 80);
                }
                pal.push(rgbToHex(...quantizeAmiga12Bit(r, g, b)));
            }
            this.skyPalettes.push(pal);
        }

        this.floorColor = rgbToHex(...quantizeAmiga12Bit(5, 5, 17));
        this.horizonLineColor = rgbToHex(...quantizeAmiga12Bit(255, 187, 0));
        this.horizonBeatColor = rgbToHex(...quantizeAmiga12Bit(255, 255, 255));

        this.initialized = true;
    }

    resize(width, height) {}

    // Echter Amiga Vector-Kreis über Bresenham-Linien und LUT
    drawVectorCircle(ctx, cx, cy, r, color) {
        let px = Math.floor(cx + r * this.cos32[0]);
        let py = Math.floor(cy + r * this.sin32[0]);
        for (let i = 1; i <= 32; i++) {
            let nx = Math.floor(cx + r * this.cos32[i % 32]);
            let ny = Math.floor(cy + r * this.sin32[i % 32]);
            drawAliasedLine(ctx, px, py, nx, ny, color);
            px = nx; 
            py = ny;
        }
    }

    // Isometrischer, handgepixelter A500 Pseudo-3D Block (Kein Alpha!)
    drawPseudo3DBlock(ctx, x, y, w, h, depth, colFront, colSide, colTop) {
        // Front
        ctx.fillStyle = colFront;
        ctx.fillRect(Math.floor(x - w / 2), Math.floor(y), Math.floor(w), Math.floor(h));
        
        // Right Side (Row by Row fillRect for perfect aliased diagonal)
        ctx.fillStyle = colSide;
        for (let d = 1; d <= depth; d++) {
            ctx.fillRect(Math.floor(x + w / 2 + d - 1), Math.floor(y - d), 1, Math.floor(h));
        }
        
        // Top (Row by Row)
        ctx.fillStyle = colTop;
        for (let d = 1; d <= depth; d++) {
            ctx.fillRect(Math.floor(x - w / 2 + d), Math.floor(y - d), Math.floor(w), 1);
        }
    }

    render(mainCtx, width, height, t, state, stateTime, metrics) {
        this.ensureInitialized();

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

        // Transition Fades
        let globalAlpha = 1.0;
        let speedMult = 1.0;

        if (state === 'starting') { globalAlpha = Math.min(1.0, stateTime / 1.5); } 
        else if (state === 'stopping') { globalAlpha = Math.max(0.0, 1.0 - (stateTime / 1.5)); } 
        else if (state === 'buildup') { speedMult = 1.8; } 
        else if (state === 'climax') { speedMult = 3.0; }

        this.internalT += dt * speedMult;
        const time = this.internalT;

        const ctx = this.ctx;
        
        const horizon = Math.floor(offH * 0.55); 
        const cx = Math.floor(offW / 2); 

        // =========================================================
        // 1. 16-COLOR COPPER SKY
        // =========================================================
        // Ermittle die vorab quantisierte Palette basierend auf Tension (0-10)
        let palIdx = Math.floor(tension * 10);
        if (palIdx > 10) palIdx = 10;
        const activeSkyPalette = this.skyPalettes[palIdx];

        const bandH = Math.ceil(horizon / 16);
        for (let i = 0; i < 16; i++) {
            ctx.fillStyle = activeSkyPalette[i];
            let y = Math.floor(i * bandH);
            ctx.fillRect(0, y, offW, bandH);
        }

        // =========================================================
        // 2. CYCLING STARS (20 Static Dots)
        // =========================================================
        const starColors = ['#ffffff', '#ffff00', '#ff8800', '#0055ff'];
        for (let i = 0; i < this.stars.length; i++) {
            let s = this.stars[i];
            let sx = Math.floor(s.x * offW);
            let sy = Math.floor(s.y * horizon);
            
            // Color Cycling basierend auf Zeit und Phase
            let cIdx = Math.floor(time * 5.0 + s.phase) % starColors.length;
            ctx.fillStyle = starColors[cIdx];
            ctx.fillRect(sx, sy, 1, 1);
        }

        // =========================================================
        // 3. MAGNETIC MOIRÉ INTERFERENCE (Vector Circles)
        // =========================================================
        if (tension > 0.2) {
            const intensity = (tension - 0.2) / 0.8; 
            const cx1 = cx + Math.sin(time) * (40 + intensity * 40);
            const cy1 = 70 + Math.cos(time * 1.3) * 30;
            const cx2 = cx + Math.sin(time * 1.1 + Math.PI) * (40 + intensity * 40);
            const cy2 = 70 + Math.cos(time * 0.9 + Math.PI) * 30;
            
            const rStep = 10 + intensity * 8;
            
            let mColor = quantizeAmiga12Bit(100 * intensity, 50 + 100 * intensity, 255);
            if (state === 'climax') mColor = quantizeAmiga12Bit(255, 100, 0); 
            const hexColor = rgbToHex(...mColor);
            
            for (let r = 10; r < Math.max(200, offW/2); r += rStep) {
                this.drawVectorCircle(ctx, cx1, cy1, r, hexColor);
                this.drawVectorCircle(ctx, cx2, cy2, r, hexColor);
            }
        }

        // =========================================================
        // 4. THE HORIZON RASTERLINE
        // =========================================================
        ctx.fillStyle = (beat > 0.6) ? this.horizonBeatColor : this.horizonLineColor;
        ctx.fillRect(0, horizon, offW, 1);

        // =========================================================
        // 5. WOBBLING 3D DATA BUS FLOOR
        // =========================================================
        ctx.fillStyle = this.floorColor;
        ctx.fillRect(0, horizon + 1, offW, offH - horizon);

        let gridR = Math.floor(0 + (100 + tension * 155));
        let gridB = Math.floor(255 - tension * 100);
        let gridHex = (state === 'climax') 
            ? rgbToHex(...quantizeAmiga12Bit(255, 255, 255)) 
            : rgbToHex(...quantizeAmiga12Bit(0, gridR, gridB));

        ctx.fillStyle = gridHex;
        
        const fov = 120 + tension * 50; 
        const camY = 30 + beat * 15; 
        const zMax = 400;
        const zStep = 16; 
        const scrollZ = (time * 150) % zStep;
        
        // Z-Linien (Horizontal)
        for (let z = zMax; z >= zStep; z -= zStep) {
            let pZ = z - scrollZ;
            if (pZ < 2.5) continue; 
            
            let py = horizon + (camY * fov) / pZ;
            if (py > offH) continue;
            
            // Unperfekter Wobble-Effekt (Sinus der Z-Tiefe)
            let wobbleY = Math.floor(Math.sin(pZ * 0.05 + time * 2) * 2);
            
            ctx.fillRect(0, Math.floor(py + wobbleY), offW, 1);
        }

        // X-Fluchtlinien
        const xRange = Math.max(400, offW * 1.5); 
        for (let x = -xRange; x <= xRange; x += 32) {
            let startZ = zStep - scrollZ;
            if (startZ < 2.5) startZ = 2.5; 
            
            let pxStart = cx + (x * fov) / startZ;
            let pyStart = horizon + (camY * fov) / startZ;
            
            let pxEnd = cx + (x * fov) / zMax;
            let pyEnd = horizon + (camY * fov) / zMax;
            
            drawAliasedLine(ctx, pxStart, pyStart, pxEnd, pyEnd, gridHex);
        }

        // --- 5b. BITPLANE NOISE (RAM-Flimmern auf dem Boden) ---
        if (Math.random() < 0.35) {
            let nx = Math.floor(Math.random() * offW);
            let ny = horizon + 2 + Math.floor(Math.random() * (offH - horizon - 2));
            ctx.fillStyle = (Math.random() > 0.5) ? '#ffffff' : this.horizonLineColor;
            ctx.fillRect(nx, ny, 2, 1);
        }

        // =========================================================
        // 6. THE 4 DMA MONOLITHS (Pseudo-3D & Hardware Shading)
        // =========================================================
        const span = Math.min(100, offW * 0.25); 
        const dmaX = [
            cx - span,        // DMA 0 (Left)
            cx + span * 0.35, // DMA 1 (Right)
            cx + span,        // DMA 2 (Right)
            cx - span * 0.35  // DMA 3 (Left)
        ];
        
        // Farben für die 3D Monolithen (Dunkelblau bis Violett)
        const mFront = rgbToHex(...quantizeAmiga12Bit(17, 17, 34));
        const mSide  = rgbToHex(...quantizeAmiga12Bit(51, 51, 85));
        const mTop   = rgbToHex(...quantizeAmiga12Bit(85, 85, 119));

        for (let i = 0; i < 4; i++) {
            let x = Math.floor(dmaX[i]);
            let vol = vols[i];
            let isLeft = (i === 0 || i === 3);

            const baseW = 28;
            const baseH = 24 + Math.floor(vol * 12); // Reagiert leicht
            const depth3D = 8;
            const baseY = horizon - baseH;

            // Pseudo-3D Monolith zeichnen
            this.drawPseudo3DBlock(ctx, x, baseY, baseW, baseH, depth3D, mFront, mSide, mTop);

            // Leuchtender Daten-Kern (Color Cycling basierend auf Volume)
            let coreColor = isLeft ? [0, 50 + vol*200, 255] : [255, 50 + vol*200, 0];
            if (tension > 0.8 && beat > 0.5) coreColor = [255, 255, 255]; 
            
            ctx.fillStyle = rgbToHex(...quantizeAmiga12Bit(...coreColor));
            ctx.fillRect(x - 8, baseY + 4, 16, 16);

            // Aufsteigende Datenpakete (Kein Alpha! Blenden in die Himmelsfarbe)
            let fetchSpeed = 40 + vol * 150 + tension * 100;
            let numBlocks = Math.floor(vol * 8) + (tension > 0.5 ? 3 : 1);
            
            for (let b = 0; b < numBlocks; b++) {
                let yOffset = (time * fetchSpeed + b * 25) % horizon;
                let blockY = baseY - yOffset;
                
                if (blockY < 0) continue; 
                
                let jitterX = 0;
                if (tension > 0.7 && vol > 0.4) {
                    jitterX = Math.floor((Math.random() - 0.5) * 6 * tension);
                }

                // Shading-Trick statt Alpha: Je höher das Paket, desto blasser
                let hPct = blockY / horizon; // 0.0 (Top) to 1.0 (Bottom)
                let br = Math.floor(coreColor[0] * hPct);
                let bg = Math.floor(coreColor[1] * hPct);
                let bb = Math.floor(coreColor[2] * hPct);

                ctx.fillStyle = rgbToHex(...quantizeAmiga12Bit(br, bg, bb));
                ctx.fillRect(x - 5 + jitterX, Math.floor(blockY), 10, Math.max(3, Math.floor(vol * 12)));
            }

            // =========================================================
            // 7. CLIMAX COPPER BEAMS (Statt modernem weißen Laser)
            // =========================================================
            if (state === 'climax' && beat > 0.3 && vol > 0.3) {
                // Ein vertikaler Strahl, der aus dem Kern nach oben schießt
                // Er dithered (Rastert) mit der Himmelsfarbe
                for (let beamY = 0; beamY < baseY; beamY += 2) {
                    if ((beamY + Math.floor(time * 50)) % 4 < 2) {
                        ctx.fillStyle = rgbToHex(...quantizeAmiga12Bit(255, 255, 255));
                        ctx.fillRect(x - 4, beamY, 8, 2);
                    } else {
                        ctx.fillStyle = rgbToHex(...quantizeAmiga12Bit(255, 119, 0));
                        ctx.fillRect(x - 4, beamY, 8, 2);
                    }
                }
            }
        }

        // =========================================================
        // 8. BLITTER GARBAGE (The Ultimate Retro Easter Egg)
        // =========================================================
        if (state !== 'idle' && Math.random() < 0.03) {
            // Generiert einen bunten, 1-Frame Glitch-Block
            let gx = Math.floor(Math.random() * offW);
            let gy = Math.floor(Math.random() * offH);
            ctx.fillStyle = rgbToHex(...quantizeAmiga12Bit(255, 0, 255)); // Magenta Error
            ctx.fillRect(gx, gy, 16, 2);
            ctx.fillStyle = rgbToHex(...quantizeAmiga12Bit(0, 255, 0)); // Green Error
            ctx.fillRect(gx + 4, gy + 2, 8, 2);
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