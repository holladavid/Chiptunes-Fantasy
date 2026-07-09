// === js/visuals/dse/universal/starfield.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: UNIVERSAL 3D WARP STARFIELD (SCENE EDITION)
// Strict Aliased Rendering & Depth-Palettes (Zero Canvas-AA).
// C64: Sine-wave column wobbling (Raster split emulation).
// Amiga: Multi-colored parallax stars & reactive background Copper-Nebula.
// Atari: Pure CPU Z-Axis Roll rotation pacing with track tension.
// Optimized with Dynamic Frustum Recycling for 400% perceived density.
// =========================================================

import { C64_PALETTE, rgbToHex, quantizeAmiga12Bit, quantizeAtari9Bit, drawAliasedLine } from '../../utils/hardware-constraints.js';

export class Starfield {
    constructor() {
        this.name = 'Universal 3D Starfield';
        this.computerType = ['all'];
        this.placementType = 'background';
        
        this.numStars = 200; 
        this.stars = Array.from({ length: this.numStars }, (v, i) => ({
            x: (Math.random() - 0.5) * 1200,
            y: (Math.random() - 0.5) * 800,
            z: Math.random() * 1000 + 10,
            type: i % 3 
        }));

        this.smoothedWarp = 2.0;
        this.angleZ = 0.0; 
        this.internalT = 0;
        this.smoothedSpeed = 1.0;
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
        let spinSpeed = 0.15; 

        if (state === 'starting') {
            globalAlpha = Math.min(1.0, stateTime / 1.5);
            targetWarp *= globalAlpha;
        } else if (state === 'stopping') {
            globalAlpha = Math.max(0.0, 1.0 - (stateTime / 1.5));
            targetWarp *= globalAlpha;
        } else if (state === 'buildup') {
            targetWarp = 3.2;              
            beatWarp = 0.5;
            spinSpeed = 0.6;
        } else if (state === 'climax') {
            targetWarp = 5.5; 
            beatWarp = 7.0; 
            spinSpeed = 1.8; 
            globalAlpha = 0.85 + (metrics.beat[0] * 0.15); 
        }
        
        this.smoothedWarp += (targetWarp - this.smoothedWarp) * 0.1;
        this.smoothedSpeed += (spinSpeed - this.smoothedSpeed) * Math.min(1.0, dt * 5.0);
        
        let activeWarp = this.smoothedWarp + (metrics.beat[0] * beatWarp);
        
        this.angleZ += dt * (this.smoothedSpeed + metrics.beat[0] * this.smoothedSpeed * 2.5);
        this.internalT += dt * this.smoothedSpeed;

        ctx.globalAlpha = globalAlpha;

        if (metrics.system === 'c64') this.drawC64(ctx, width, height, activeWarp, metrics);
        else if (metrics.system === 'amiga') this.drawAmiga(ctx, width, height, activeWarp, metrics);
        else this.drawAtari(ctx, width, height, activeWarp, metrics);

        ctx.globalAlpha = 1.0;
    }

    drawC64(ctx, w, h, activeWarp, metrics) {
        const cx = Math.floor(w / 2); 
        const cy = Math.floor(h / 2); 
        const fov = 250; // Weicheres Sichtfeld für harmonischere Tiefenwirkung

        let waveAmp = 2.0;
        if (metrics.rawEnergyState === 'buildup') waveAmp = 5.0;
        else if (metrics.rawEnergyState === 'climax') waveAmp = 9.0;
        const activeWobbleAmp = waveAmp + (metrics.beat[0] * 12.0);

        for (let i = 0; i < this.numStars; i++) {
            let star = this.stars[i];
            star.z -= activeWarp;

            // 1. Projektion berechnen
            let px = Math.floor(cx + (star.x / star.z) * fov);
            let py = Math.floor(cy + (star.y / star.z) * fov);

            // Raster Wobble dazurechnen
            let wobble = Math.floor(Math.sin(py * 0.06 + this.internalT * 5.0) * activeWobbleAmp);
            px += wobble;

            // --- OPTIMIERUNG: DYNAMIC FRUSTUM RECYCLING ---
            // Sobald ein Stern aus dem sichtbaren Bereich fliegt, wird er sofort reinkarniert!
            if (star.z <= 6 || px < -5 || px > w + 5 || py < -5 || py > h + 5) {
                star.z = 1000;
                star.x = (Math.random() - 0.5) * (w * 4.0); // Spawnt im perfekten Verhältnis der Breite
                star.y = (Math.random() - 0.5) * (h * 4.0);
                continue; 
            }

            const prevZ = star.z + activeWarp;
            let prevPx = Math.floor(cx + (star.x / prevZ) * fov) + wobble;
            let prevPy = Math.floor(cy + (star.y / prevZ) * fov);

            let starColor;
            if (star.z < 250) starColor = rgbToHex(...C64_PALETTE[1]);      
            else if (star.z < 500) starColor = rgbToHex(...C64_PALETTE[15]);
            else if (star.z < 750) starColor = rgbToHex(...C64_PALETTE[14]);
            else if (star.z < 900) starColor = rgbToHex(...C64_PALETTE[12]);
            else starColor = rgbToHex(...C64_PALETTE[11]);                

            const distSq = (px-prevPx)**2 + (py-prevPy)**2;

            if (distSq > 9.0) {
                drawAliasedLine(ctx, prevPx, prevPy, px, py, starColor);
            } else {
                const size = Math.max(1, Math.floor((1000 - star.z) / 300));
                ctx.fillStyle = starColor;
                ctx.fillRect(Math.floor(px - size/2), Math.floor(py - size/2), size, size);
            }
        }
    }

    drawAmiga(ctx, w, h, activeWarp, metrics) {
        const cx = Math.floor(w / 2); 
        const cy = Math.floor(h / 2); 
        const fov = 250; 

        // Background Copper bar
        const copperY = Math.floor(cy + Math.sin(this.internalT * 1.5) * (h * 0.22));
        const copperH = Math.floor(h * 0.18);
        const beatIntensity = metrics.beat[0];

        let copGrad = ctx.createLinearGradient(0, copperY - copperH/2, 0, copperY + copperH/2);
        copGrad.addColorStop(0.0, rgbToHex(...quantizeAmiga12Bit(0, 0, 0)));
        copGrad.addColorStop(0.5, rgbToHex(...quantizeAmiga12Bit(20 * beatIntensity, 10, 50 + beatIntensity * 70)));
        copGrad.addColorStop(1.0, rgbToHex(...quantizeAmiga12Bit(0, 0, 0)));
        
        ctx.fillStyle = copGrad;
        ctx.fillRect(0, copperY - copperH/2, w, copperH);

        for (let i = 0; i < this.numStars; i++) {
            let star = this.stars[i];
            star.z -= activeWarp;

            let px = Math.floor(cx + (star.x / star.z) * fov);
            let py = Math.floor(cy + (star.y / star.z) * fov);

            // --- OPTIMIERUNG: DYNAMIC FRUSTUM RECYCLING ---
            if (star.z <= 6 || px < -5 || px > w + 5 || py < -5 || py > h + 5) {
                star.z = 1000;
                star.x = (Math.random() - 0.5) * (w * 4.0);
                star.y = (Math.random() - 0.5) * (h * 4.0);
                continue; 
            }

            const prevZ = star.z + activeWarp;
            let prevPx = Math.floor(cx + (star.x / prevZ) * fov);
            let prevPy = Math.floor(cy + (star.y / prevZ) * fov);

            let brightness = Math.max(0.0, 1.0 - (star.z / 1000));
            let starColor;

            if (star.type === 0) {
                starColor = rgbToHex(...quantizeAmiga12Bit(0, 85 + brightness * 170, 255));
            } else if (star.type === 1) {
                starColor = rgbToHex(...quantizeAmiga12Bit(136 + brightness * 119, 68 + brightness * 68, 0));
            } else {
                starColor = rgbToHex(...quantizeAmiga12Bit(100 + brightness * 155, 100 + brightness * 155, 100 + brightness * 155));
            }

            const distSq = (px-prevPx)**2 + (py-prevPy)**2;

            if (distSq > 4.0) {
                drawAliasedLine(ctx, prevPx, prevPy, px, py, starColor);
            } else {
                const size = Math.floor(1.0 + brightness * 2.0);
                ctx.fillStyle = starColor;
                ctx.fillRect(Math.floor(px - size/2), Math.floor(py - size/2), size, size);
            }
        }
    }

    drawAtari(ctx, w, h, activeWarp, metrics) {
        const cx = Math.floor(w / 2); 
        const cy = Math.floor(h / 2); 
        const fov = 250; 

        const cosR = Math.cos(this.angleZ);
        const sinR = Math.sin(this.angleZ);

        for (let i = 0; i < this.numStars; i++) {
            let star = this.stars[i];
            star.z -= activeWarp;

            const rx = star.x;
            const ry = star.y;

            // 3D-Matrix Drehung
            const rxRot = rx * cosR - ry * sinR;
            const ryRot = rx * sinR + ry * cosR;

            let px = Math.floor(cx + (rxRot / star.z) * fov);
            let py = Math.floor(cy + (ryRot / star.z) * fov);

            // --- OPTIMIERUNG: DYNAMIC FRUSTUM RECYCLING ---
            if (star.z <= 6 || px < -5 || px > w + 5 || py < -5 || py > h + 5) {
                star.z = 1000;
                star.x = (Math.random() - 0.5) * (w * 4.0);
                star.y = (Math.random() - 0.5) * (h * 4.0);
                continue; 
            }

            const prevZ = star.z + activeWarp;
            let prevPx = Math.floor(cx + (rxRot / prevZ) * fov);
            let prevPy = Math.floor(cy + (ryRot / prevZ) * fov);

            let brightness = Math.max(0.0, 1.0 - (star.z / 1000));
            let starColor;

            if (star.type === 0) {
                starColor = rgbToHex(...quantizeAtari9Bit(0, 136 + brightness * 119, 0));
            } else if (star.type === 1) {
                starColor = rgbToHex(...quantizeAtari9Bit(136 + brightness * 119, 136 + brightness * 119, 0));
            } else {
                starColor = rgbToHex(...quantizeAtari9Bit(0, 136 + brightness * 119, 136 + brightness * 119));
            }

            const distSq = (px-prevPx)**2 + (py-prevPy)**2;

            if (distSq > 9.0) {
                drawAliasedLine(ctx, prevPx, prevPy, px, py, starColor);
            } else {
                const size = star.z < 300 ? 2 : 1;
                ctx.fillStyle = starColor;
                ctx.fillRect(px, py, size, size);
            }
        }
    }
}