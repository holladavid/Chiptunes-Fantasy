// === js/visuals/dse/universal/starfield.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: UNIVERSAL 3D WARP STARFIELD
// Strict Aliased Rendering & Depth-Palettes (Zero Canvas-AA)
// =========================================================

import { C64_PALETTE, rgbToHex, quantizeAmiga12Bit, quantizeAtari9Bit, drawAliasedLine } from '../../utils/hardware-constraints.js';

export class Starfield {
    constructor() {
        this.name = 'Universal 3D Starfield';
        this.computerType = ['all'];
        this.placementType = 'background';
        
        this.numStars = 200; 
        this.stars = Array.from({ length: this.numStars }, () => ({
            x: (Math.random() - 0.5) * 2500,
            y: (Math.random() - 0.5) * 2500,
            z: Math.random() * 1000 + 10
        }));

        this.smoothedWarp = 2.0;
        this.lastT = 0;
    }

    resize(width, height) {}

    render(ctx, width, height, t, state, stateTime, metrics) {
        if (state === 'idle') { this.lastT = t; return; }

        let dt = this.lastT === 0 ? 0.016 : t - this.lastT;
        this.lastT = t;

        let globalAlpha = 1.0;
        let targetWarp = 2.0; 
        let beatWarp = 0.0;

        // --- TRACK-REAKTION (Makro & Mikro) ---
        if (state === 'starting') {
            globalAlpha = Math.min(1.0, stateTime / 1.5);
            targetWarp *= globalAlpha;
        } else if (state === 'stopping') {
            globalAlpha = Math.max(0.0, 1.0 - (stateTime / 1.5));
            targetWarp *= globalAlpha;
        } else if (state === 'buildup') {
            targetWarp = 2.8;              
            beatWarp = 0.4;                
        } else if (state === 'climax') {
            targetWarp = 5.5; 
            globalAlpha = 0.8 + (metrics.beat[0] * 0.2); // Pulsiert die Sichtbarkeit
            beatWarp = 6.0; // Hyperspeed Einspritzung zum Beat!           
        }
        
        this.smoothedWarp += (targetWarp - this.smoothedWarp) * 0.1;
        let activeWarp = this.smoothedWarp + (metrics.beat[0] * beatWarp);

        ctx.globalAlpha = globalAlpha;

        if (metrics.system === 'c64') this.drawC64(ctx, width, height, activeWarp);
        else if (metrics.system === 'amiga') this.drawAmiga(ctx, width, height, activeWarp);
        else this.drawAtari(ctx, width, height, activeWarp);

        ctx.globalAlpha = 1.0;
    }

    drawC64(ctx, w, h, activeWarp) {
        const cx = Math.floor(w / 2); 
        const cy = Math.floor(h / 2); 
        const fov = 400; 

        for (let i = 0; i < this.numStars; i++) {
            let star = this.stars[i];
            const prevZ = star.z;
            star.z -= activeWarp;
            if (star.z <= 6) {
                star.z = 1000; star.x = (Math.random() - 0.5) * 2500; star.y = (Math.random() - 0.5) * 2500;
                continue; 
            }

            const curZ = star.z;
            const px = Math.floor(cx + (star.x / curZ) * fov);
            const py = Math.floor(cy + (star.y / curZ) * fov);
            const prevPx = Math.floor(cx + (star.x / prevZ) * fov);
            const prevPy = Math.floor(cy + (star.y / prevZ) * fov);

            // STRICT C64 PALETTE (Tiefen-Shading per fester Farbe)
            let starColor;
            if (curZ < 250) starColor = rgbToHex(...C64_PALETTE[1]);      // White
            else if (curZ < 500) starColor = rgbToHex(...C64_PALETTE[15]);// Light Grey
            else if (curZ < 750) starColor = rgbToHex(...C64_PALETTE[14]);// Light Blue
            else if (curZ < 900) starColor = rgbToHex(...C64_PALETTE[12]);// Grey
            else starColor = rgbToHex(...C64_PALETTE[11]);                // Dark Grey

            const distSq = (px-prevPx)**2 + (py-prevPy)**2;

            if (distSq > 9.0) {
                // SUB-PIXEL-KILLER: Streaks via Bresenham Line!
                drawAliasedLine(ctx, prevPx, prevPy, px, py, starColor);
            } else {
                // 1 oder 2 Pixel große Blöcke
                const size = Math.max(1, Math.floor((1000 - curZ) / 300));
                ctx.fillStyle = starColor;
                ctx.fillRect(Math.floor(px - size/2), Math.floor(py - size/2), size, size);
            }
        }
    }

    drawAmiga(ctx, w, h, activeWarp) {
        const cx = Math.floor(w / 2); 
        const cy = Math.floor(h / 2); 
        const fov = 400; 

        for (let i = 0; i < this.numStars; i++) {
            let star = this.stars[i];
            const prevZ = star.z;
            star.z -= activeWarp;
            if (star.z <= 6) {
                star.z = 1000; star.x = (Math.random() - 0.5) * 2500; star.y = (Math.random() - 0.5) * 2500;
                continue; 
            }

            const curZ = star.z;
            const px = Math.floor(cx + (star.x / curZ) * fov);
            const py = Math.floor(cy + (star.y / curZ) * fov);
            const prevPx = Math.floor(cx + (star.x / prevZ) * fov);
            const prevPy = Math.floor(cy + (star.y / prevZ) * fov);

            // STRICT AMIGA 12-BIT QUANTIZATION (Ohne echtes RGBA-Alpha!)
            let brightness = Math.max(0.0, 1.0 - (curZ / 1000));
            let rawR = 150 + brightness * 105;
            let rawG = 200 + brightness * 55;
            let q = quantizeAmiga12Bit(rawR, rawG, 255);
            let starColor = rgbToHex(q[0], q[1], q[2]); 

            const distSq = (px-prevPx)**2 + (py-prevPy)**2;

            if (distSq > 4.0) {
                // SUB-PIXEL-KILLER: Harte Bresenham-Linie für den Amiga Hyperspace!
                drawAliasedLine(ctx, prevPx, prevPy, px, py, starColor);
            } else {
                // Keine weichen Kreise mehr, nur harte kleine Blöcke!
                const size = Math.floor(1.0 + brightness * 2.0);
                ctx.fillStyle = starColor;
                ctx.fillRect(Math.floor(px - size/2), Math.floor(py - size/2), size, size);
            }
        }
    }

    drawAtari(ctx, w, h, activeWarp) {
        const cx = Math.floor(w / 2); 
        const cy = Math.floor(h / 2); 
        const fov = 400; 

        for (let i = 0; i < this.numStars; i++) {
            let star = this.stars[i];
            const prevZ = star.z;
            star.z -= activeWarp;
            if (star.z <= 6) {
                star.z = 1000; star.x = (Math.random() - 0.5) * 2500; star.y = (Math.random() - 0.5) * 2500;
                continue; 
            }

            const curZ = star.z;
            const px = Math.floor(cx + (star.x / curZ) * fov); 
            const py = Math.floor(cy + (star.y / curZ) * fov);
            const prevPx = Math.floor(cx + (star.x / prevZ) * fov); 
            const prevPy = Math.floor(cy + (star.y / prevZ) * fov);

            // STRICT 9-BIT ATARI QUANTIZATION
            let starColor;
            if (curZ < 250) starColor = rgbToHex(...quantizeAtari9Bit(255, 255, 255)); 
            else if (curZ < 500) starColor = rgbToHex(...quantizeAtari9Bit(85, 255, 255)); 
            else if (curZ < 750) starColor = rgbToHex(...quantizeAtari9Bit(0, 85, 170)); 
            else starColor = rgbToHex(...quantizeAtari9Bit(0, 34, 68));

            const distSq = (px-prevPx)**2 + (py-prevPy)**2;

            if (distSq > 9.0) {
                // SUB-PIXEL-KILLER
                drawAliasedLine(ctx, prevPx, prevPy, px, py, starColor);
            } else {
                const size = curZ < 400 ? 2 : 1;
                ctx.fillStyle = starColor;
                ctx.fillRect(px, py, size, size);
            }
        }
    }
}