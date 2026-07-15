// === js/visuals/dse/c64/sid-silicon-bg.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: SID 6581 MICROVERSE (BACKGROUND)
// 100% Anti-Aliasing free. Pure fillRect() integer rendering.
// Features responsive Parallax Tech-Grids, 8x8 Block Plasma, 
// adaptive isometric DCOs, and dynamic orthogonal routing.
// =========================================================

import { C64_PALETTE, rgbToHex } from '../../utils/hardware-constraints.js';

// Wandelt die [R,G,B] Arrays der Hardware-Constraints in Canvas-taugliche Hex-Strings um
const PAL = C64_PALETTE.map(c => rgbToHex(c[0], c[1], c[2]));

export class SidSiliconBg {
    constructor() {
        this.name = 'SID 6581 Microverse';
        this.computerType = ['c64'];
        this.placementType = 'background';
        
        // Canvas wird dynamisch im Render-Loop auf das Seitenverhältnis genormt
        this.offscreen = document.createElement('canvas');
        this.ctx = this.offscreen.getContext('2d', { alpha: false });
        
        this.lastT = 0;
        this.internalT = 0;
    }

    resize(width, height) {}

    // Hilfsfunktion für 100% harte Pixel-Linien (kein Subpixel-Bleeding!)
    drawHLine(ctx, x, y, len, colIdx) {
        ctx.fillStyle = PAL[colIdx];
        ctx.fillRect(x | 0, y | 0, len | 0, 1);
    }
    drawVLine(ctx, x, y, len, colIdx) {
        ctx.fillStyle = PAL[colIdx];
        ctx.fillRect(x | 0, y | 0, 1, len | 0);
    }

    // Isometrischer, blockiger C64-Kasten ohne weiche Ränder
    drawIsoBlock(ctx, x, y, w, h, vol, isVcf) {
        // Pumping-Effekt (Breite/Höhe in harten 2-Pixel-Schritten)
        const pump = (vol * 6) & ~1; 
        const bw = w + pump;
        const bh = h + pump;
        const bx = x - (bw >> 1);
        const by = y - (bh >> 1);

        const colMain = isVcf ? 4 : 14; // Purple oder Light Blue
        const colShadow = 0; // Black
        const colLight = 1;  // White
        
        // Schatten (Hard Drop)
        ctx.fillStyle = PAL[colShadow];
        ctx.fillRect(bx + 4, by + 4, bw, bh);

        // Basis-Farbe
        let currentMain = colMain;
        // Color Cycling bei hoher Lautstärke (Übersteuerung)
        if (vol > 0.6) currentMain = isVcf ? 10 : 3; // Light Red oder Cyan
        
        ctx.fillStyle = PAL[currentMain];
        ctx.fillRect(bx, by, bw, bh);

        // Harte Lichtkanten oben und links (1 Pixel)
        this.drawHLine(ctx, bx, by, bw, colLight);
        this.drawVLine(ctx, bx, by, bh, colLight);

        // Innerer Platinen-Kern (klickert im Takt)
        if (vol > 0.1) {
            const coreW = bw - 12;
            const coreH = bh - 12;
            const coreCol = isVcf 
                ? (vol > 0.4 ? 10 : 2) // Light Red / Red
                : (vol > 0.4 ? 7 : 13); // Yellow / Light Green
            ctx.fillStyle = PAL[coreCol];
            ctx.fillRect(bx + 6, by + 6, coreW, coreH);
        }
    }

    render(mainCtx, width, height, t, state, stateTime, metrics) {
        if (state === 'idle') { this.lastT = t; return; }
        let dt = this.lastT === 0 ? 0.016 : t - this.lastT;
        this.lastT = t;

        // =========================================================
        // GFX UPGRADE: DYNAMISCHE RETRO-AUFLÖSUNG
        // Sichert 200px vertikale C64-Auflösung, passt die Breite
        // exakt an den Monitor an, um schwarze Ränder zu eliminieren!
        // =========================================================
        const TARGET_HEIGHT = 200;
        const aspect = width / height;
        const offW = Math.floor(TARGET_HEIGHT * aspect);
        const offH = TARGET_HEIGHT;

        if (this.offscreen.width !== offW || this.offscreen.height !== TARGET_HEIGHT) {
            this.offscreen.width = offW;
            this.offscreen.height = TARGET_HEIGHT;
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

        const cx = offW / 2; // Dynamische horizontale Mitte

        // =========================================================
        // 1. BACKGROUND: PARALLAX TECH-GRID (Tension Reactive)
        // =========================================================
        ctx.fillStyle = PAL[0]; // Clear screen (Black)
        ctx.fillRect(0, 0, offW, 200);

        // --- Layer 1: Deep Substrate (Punktmuster) ---
        const speed1 = 15 + tension * 30;
        const off1X = (time * speed1) % 16;
        const off1Y = (time * speed1 * 0.5) % 16;
        
        ctx.fillStyle = PAL[11]; // Dark Grey
        for (let y = -(off1Y | 0); y < 200; y += 16) {
            for (let x = -(off1X | 0); x < offW; x += 16) {
                let gX = Math.floor(x / 16);
                let gY = Math.floor(y / 16);
                if (Math.abs(gX + gY) % 2 === 0) {
                    ctx.fillRect(x | 0, y | 0, 1, 1);
                }
            }
        }

        // --- Layer 2: Main Moving Grid ---
        const speed2 = 30 + tension * 80;
        const off2X = (time * speed2) % 32;
        const off2Y = (time * speed2 * 0.8) % 32;
        const iOx = off2X | 0;
        const iOy = off2Y | 0;
        const gridCol = tension > 0.7 ? 12 : 11; 
        
        for (let x = -iOx; x < offW; x += 32) {
            this.drawVLine(ctx, x, 0, 200, gridCol);
        }
        for (let y = -iOy; y < 200; y += 32) {
            this.drawHLine(ctx, 0, y, offW, gridCol);
        }

        // --- Layer 3: Data Nodes (Tension gesteuert) ---
        if (tension > 0.3) {
            const nodeCol = tension > 0.8 ? 1 : (tension > 0.6 ? 3 : 6); 
            for (let y = -iOy; y < 200; y += 32) {
                for (let x = -iOx; x < offW; x += 32) {
                    let gX = Math.floor(x / 32);
                    let gY = Math.floor(y / 32);
                    if (Math.abs(gX + gY) % 2 === 0) {
                        ctx.fillStyle = PAL[nodeCol];
                        ctx.fillRect(x - 1, y - 1, 3, 3);
                    }
                }
            }
        }

        // =========================================================
        // 2. MIDDLEGROUND: 8x8 CHUNKY PETSCII PLASMA
        // =========================================================
        if (tension > 0.1) {
            const pColors = [0, 6, 4, 11]; 
            const plasmaBlocksX = Math.ceil(offW / 8); // Skaliert in die Breite!
            for (let y = 0; y < 25; y++) {
                for (let x = 0; x < plasmaBlocksX; x++) {
                    let v = Math.sin(x * 0.3 + time) + Math.sin(y * 0.3 + time * 1.2) + Math.sin((x + y) * 0.2 - time);
                    let cIdx = Math.floor((v + 3) * 1.5) & 3; 
                    
                    if (cIdx > 0 && Math.random() < tension) { 
                        ctx.fillStyle = PAL[pColors[cIdx]];
                        ctx.fillRect(x * 8, y * 8, 8, 8);
                    }
                }
            }
        }

        // =========================================================
        // 3. THE ADAPTIVE CHIP BLOCKS (OSC & VCF)
        // =========================================================
        // GFX FIX: Breiten schrumpfen auf Handys sachte mit, um Überlappung zu verhindern!
        const oscWidth = Math.min(40, Math.floor(offW * 0.15));
        const vcfWidth = Math.min(56, Math.floor(offW * 0.18));

        // Symmetrische Spreizung relativ zur Mitte (cx)
        const span = Math.min(110, offW * 0.35); 
        const oscX = cx - span;
        const vcfX = cx + span * 0.63; // Perfekt ausbalanciertes C64-Routing

        // =========================================================
        // 4. SIGNAL BUSES (Dynamic Manhattan Routing)
        // =========================================================
        const drawChunkyBus = (startX, startY, endX, endY, vol) => {
            // Berechnet den Biegungspunkt der Leitungen dynamisch als Prozentwert des Abstands
            const midX = Math.floor(startX + (endX - startX) * 0.55);
            const dashLen = 8;
            const offset = (time * 60 * (1.0 + vol)) | 0;
            const colorIdx = vol > 0.5 ? 1 : (vol > 0.1 ? 3 : 6); 

            // Horizontale Linie 1
            for (let x = startX; x < midX; x++) {
                if (((x - offset) % (dashLen * 2) + (dashLen * 2)) % (dashLen * 2) < dashLen) {
                    this.drawHLine(ctx, x, startY - 1, 1, colorIdx);
                    this.drawHLine(ctx, x, startY, 1, colorIdx); 
                }
            }
            // Vertikale Linie
            const yMin = Math.min(startY, endY);
            const yMax = Math.max(startY, endY);
            for (let y = yMin; y <= yMax; y++) {
                if (((y - offset) % (dashLen * 2) + (dashLen * 2)) % (dashLen * 2) < dashLen) {
                    this.drawVLine(ctx, midX - 1, y, 1, colorIdx);
                    this.drawVLine(ctx, midX, y, 1, colorIdx);
                }
            }
            // Horizontale Linie 2
            for (let x = midX; x < endX; x++) {
                if (((x - offset) % (dashLen * 2) + (dashLen * 2)) % (dashLen * 2) < dashLen) {
                    this.drawHLine(ctx, x, endY - 1, 1, colorIdx);
                    this.drawHLine(ctx, x, endY, 1, colorIdx);
                }
            }
        };

        const oscY = [40, 100, 160];
        const vcfY = 100;

        drawChunkyBus(oscX, oscY[0], vcfX, vcfY - 20, vols[0]);
        drawChunkyBus(oscX, oscY[1], vcfX, vcfY,      vols[1]);
        drawChunkyBus(oscX, oscY[2], vcfX, vcfY + 20, vols[2]);

        const vcaVol = (vols[0] + vols[1] + vols[2]) / 3.0;
        
        // Dicker Master-Out Bus (Fließt bis an den dynamischen rechten Rand!)
        const dashLenM = 12;
        const offsetM = (time * 100) | 0;
        const mCol = vcaVol > 0.5 ? 1 : 10; 
        for (let x = vcfX; x < offW; x++) {
            if (((x - offsetM) % (dashLenM * 2) + (dashLenM * 2)) % (dashLenM * 2) < dashLenM) {
                ctx.fillStyle = PAL[mCol];
                ctx.fillRect(x, 98, 1, 4);
            }
        }

        // Die Gatterblöcke zeichnen
        this.drawIsoBlock(ctx, oscX, oscY[0], oscWidth, 32, vols[0], false);
        this.drawIsoBlock(ctx, oscX, oscY[1], oscWidth, 32, vols[1], false);
        this.drawIsoBlock(ctx, oscX, oscY[2], oscWidth, 32, vols[2], false);

        this.drawIsoBlock(ctx, vcfX, vcfY, vcfWidth, 64, vcaVol, true);

        // =========================================================
        // 5. STROBE FLASH
        // =========================================================
        if (state === 'climax' && beat > 0.7) {
            ctx.fillStyle = PAL[1]; 
            ctx.fillRect(0, 0, offW, 200);
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