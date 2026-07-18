// === js/visuals/dse/universal/starfield.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: UNIVERSAL 3D WARP STARFIELD (SCENE EDITION)
// Strict Aliased Rendering & Depth-Palettes (Zero Canvas-AA).
// C64: VIC-II 1x1 pixels, 72 stars, 8-line Rasterwobble, Voice 1/2 register sync.
// Amiga: OCS 180 stars, discrete Copper-nebula bands, Parallax Voice volume triggers.
// Atari: Shifter 120 stars, pure CPU Math, YM2149 Vol register rotation speed.
// Optimized with Dynamic Frustum recycling and cubic horizon Z-clustering.
// =========================================================

import { C64_PALETTE, rgbToHex, quantizeAmiga12Bit, quantizeAtari9Bit, drawAliasedLine } from '../../utils/hardware-constraints.js';

export class Starfield {
    constructor() {
        this.name = 'Universal 3D Starfield';
        this.computerType = ['all'];
        this.placementType = 'background';
        
        // 256-Byte Sinus-Tabelle für mechatronische Raster-Interrupts
        this.sinLUT = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
            this.sinLUT[i] = Math.sin((i / 256) * Math.PI * 2);
        }

        this.numStars = 180; // Maximaler Pool für Amiga
        this.stars = Array.from({ length: this.numStars }, (v, i) => ({
            x: (Math.random() - 0.5) * 2000,
            y: (Math.random() - 0.5) * 2000,
            z: Math.random() * 990 + 10,
            type: i % 3, // Layer/Parallax (0, 1, 2)
            age: Math.random()
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
        this.internalT += dt * this.smoothedSpeed;

        ctx.globalAlpha = globalAlpha;

        // Routing an die hochspezifischen, hardware-konformen Renderer
        if (metrics.system === 'c64') this.drawC64(ctx, width, height, activeWarp, metrics);
        else if (metrics.system === 'amiga') this.drawAmiga(ctx, width, height, activeWarp, metrics);
        else this.drawAtari(ctx, width, height, activeWarp, metrics, dt, state);

        ctx.globalAlpha = 1.0;
    }

    // =========================================================
    // RENDERER 1: COMMODORE 64 (VIC-II)
    // =========================================================
    drawC64(ctx, w, h, activeWarp, metrics) {
        const cx = Math.floor(w / 2); 
        const cy = Math.floor(h / 2); 
        const fov = 250; 
        const N = 72; // Strikt 72 Sterne für den C64

        // SID Register Trigger: Voice 1 Gate-On -> Warp-Boost!
        let v1Gate = metrics.regs ? (metrics.regs[4] & 1) : 0;
        let warp = activeWarp * (1.0 + v1Gate * 1.5);

        let waveAmp = 2.0;
        if (metrics.rawEnergyState === 'buildup') waveAmp = 5.0;
        else if (metrics.rawEnergyState === 'climax') waveAmp = 9.0;
        
        // Voice 2 Gate-On -> Wobble invertieren!
        let v2Gate = metrics.regs ? (metrics.regs[11] & 1) : 0;
        let wobbleAmp = (waveAmp + (metrics.beat[0] * 12.0)) * (v2Gate ? -1.5 : 1.0);

        for (let i = 0; i < N; i++) {
            let star = this.stars[i];
            star.z -= warp;

            let px = Math.floor(cx + (star.x / star.z) * fov);
            let py = Math.floor(cy + (star.y / star.z) * fov);

            // Raster-Wobble in 8-Rasterzeilen-Schritten (VIC-II Interrupt Stil)
            let row = py >> 3; 
            let wobble = Math.floor(this.sinLUT[(row + Math.floor(this.internalT * 15)) & 255] * wobbleAmp);
            px += wobble;

            // Frustum Recycling (Cubic Z-Cluster: 70% spawnen weit hinten!)
            if (star.z <= 6 || px < -5 || px > w + 5 || py < -5 || py > h + 5) {
                let randZ = Math.pow(Math.random(), 2.0); // Cluster am Horizont
                star.z = 1000 - (randZ * 900);
                star.x = (Math.random() - 0.5) * (w * 4.0);
                star.y = (Math.random() - 0.5) * (h * 4.0);
                continue; 
            }

            // Sterngeburt (Fade-In over 100px)
            let birthFactor = 1.0;
            if (star.z > 900) birthFactor = (1000 - star.z) / 100;

            // Monochrom-Graue VIC-II Palette
            let colIdx = 11; // Dark Grey (VIC Index 11)
            let zLimit = star.z / birthFactor;
            if (zLimit < 250) colIdx = 1;        // White (VIC Index 1)
            else if (zLimit < 500) colIdx = 15;  // Light Grey (VIC Index 15)
            else if (zLimit < 750) colIdx = 12;  // Grey (VIC Index 12)

            ctx.fillStyle = rgbToHex(...C64_PALETTE[colIdx]);
            // Strikt 1x1 Pixel auf dem C64!
            ctx.fillRect(px, py, 1, 1);
        }
    }

    // =========================================================
    // RENDERER 2: AMIGA 500 (OCS)
    // =========================================================
    drawAmiga(ctx, w, h, activeWarp, metrics) {
        const cx = Math.floor(w / 2); 
        const cy = Math.floor(h / 2); 
        const fov = 250; 
        const N = 180; // Volle 180 Sterne auf dem Amiga

        // Background Copper-Nebula aus echten, diskreten Farbbändern!
        const copperY = Math.floor(cy + Math.sin(this.internalT * 1.5) * (h * 0.22));
        const copperH = Math.floor(h * 0.18);
        const bandCount = 12;
        const bandHeight = Math.ceil(copperH / bandCount);
        const beatIntensity = metrics.beat[0];

        // Diskreter Farbstreifen-Verlauf (OCS Look)
        for (let b = 0; b < bandCount; b++) {
            let pct = Math.abs(b - bandCount/2) / (bandCount/2); 
            let r = Math.floor(20 * beatIntensity * (1.0 - pct));
            let g = Math.floor(10 * (1.0 - pct));
            let bVal = Math.floor((50 + beatIntensity * 70) * (1.0 - pct));
            ctx.fillStyle = rgbToHex(...quantizeAmiga12Bit(r, g, bVal));
            ctx.fillRect(0, Math.floor(copperY - copperH/2 + b * bandHeight), w, bandHeight);
        }

        for (let i = 0; i < N; i++) {
            let star = this.stars[i];
            
            // Paula Register Trigger: Jede Parallax-Ebene beschleunigt mit ihrem eigenen Spuren-Volumen!
            let volMod = metrics.smooth[star.type] || 0.0;
            let speed = activeWarp * (1.0 + star.type * 0.45 + volMod * 3.5);
            
            star.z -= speed;

            let px = Math.floor(cx + (star.x / star.z) * fov);
            let py = Math.floor(cy + (star.y / star.z) * fov);

            // Frustum Recycling (Cubic Z-Cluster)
            if (star.z <= 6 || px < -5 || px > w + 5 || py < -5 || py > h + 5) {
                let randZ = Math.pow(Math.random(), 2.0);
                star.z = 1000 - (randZ * 900);
                star.x = (Math.random() - 0.5) * (w * 4.0);
                star.y = (Math.random() - 0.5) * (h * 4.0);
                continue; 
            }

            // Sterngeburt (Fade-In)
            let birthFactor = 1.0;
            if (star.z > 900) birthFactor = (1000 - star.z) / 100;

            let brightness = Math.max(0.0, 1.0 - (star.z / 1000)) * birthFactor;
            let starColor;

            // Klassische, weiße bis cyanblaue Sterne
            if (star.type === 0) {
                starColor = rgbToHex(...quantizeAmiga12Bit(100 * brightness, 150 * brightness, 255 * brightness)); // Light Blue
            } else if (star.type === 1) {
                starColor = rgbToHex(...quantizeAmiga12Bit(100 * brightness, 220 * brightness, 255 * brightness)); // Cyan
            } else {
                starColor = rgbToHex(...quantizeAmiga12Bit(255 * brightness, 255 * brightness, 255 * brightness)); // Pure White
            }

            const size = Math.max(1, Math.floor(1.0 + brightness * 1.5));
            ctx.fillStyle = starColor;
            ctx.fillRect(Math.floor(px - size/2), Math.floor(py - size/2), size, size);
        }
    }

    // =========================================================
    // RENDERER 3: ATARI ST (SHIFTER)
    // =========================================================
    drawAtari(ctx, w, h, activeWarp, metrics, dt, state) {
        const cx = Math.floor(w / 2); 
        const cy = Math.floor(h / 2); 
        const fov = 250; 
        const N = 120; // Strikt 120 Sterne für den Atari ST

        // Atari ST Volume Register Trigger: Acceleration gesteuert von YM2149 R8, R9, R10!
        let volA = metrics.regs ? (metrics.regs[8] & 15) : 0;
        let volB = metrics.regs ? (metrics.regs[9] & 15) : 0;
        let volC = metrics.regs ? (metrics.regs[10] & 15) : 0;
        let totalVol = (volA + volB + volC) / 45.0; // 0.0 to 1.0

        // Atari ST Trick: Rotation beschleunigt bei lauten Parts, bremst sachte bei Ruhe (68000er Trägheit)
        let targetRot = 0.05 + totalVol * 0.8;
        this.smoothedSpeed += (targetRot - this.smoothedSpeed) * 0.12;
        
        let spinSpeed = this.smoothedSpeed * (state === 'climax' ? 2.5 : 1.0);
        this.angleZ += dt * spinSpeed;

        const cosR = Math.cos(this.angleZ);
        const sinR = Math.sin(this.angleZ);

        const diag = Math.sqrt(w * w + h * h) / 2;
        const cullDistSq = (diag + 5) * (diag + 5); 
        const spawnRange = diag * 8.0; 

        for (let i = 0; i < N; i++) {
            let star = this.stars[i];
            star.z -= activeWarp;

            const rx = star.x;
            const ry = star.y;

            // Pure, CPU-basierte ST-Mathematik (Z-Rotation)
            const rxRot = rx * cosR - ry * sinR;
            const ryRot = rx * sinR + ry * cosR;

            let px = Math.floor(cx + (rxRot / star.z) * fov);
            let py = Math.floor(cy + (ryRot / star.z) * fov);

            let distFromCenterSq = (px - cx) * (px - cx) + (py - cy) * (py - cy);

            // Frustum Recycling (Cubic Z-Cluster)
            if (star.z <= 6 || distFromCenterSq > cullDistSq) {
                let randZ = Math.pow(Math.random(), 2.0);
                star.z = 1000 - (randZ * 900);
                star.x = (Math.random() - 0.5) * spawnRange;
                star.y = (Math.random() - 0.5) * spawnRange;
                continue; 
            }

            // Sterngeburt
            let birthFactor = 1.0;
            if (star.z > 900) birthFactor = (1000 - star.z) / 100;

            let brightness = Math.max(0.0, 1.0 - (star.z / 1000)) * birthFactor;
            let starColor;

            // Strikt quantisierte 9-Bit Shifter-Farben
            let zLimit = star.z / birthFactor;
            if (zLimit < 250) {
                starColor = rgbToHex(...quantizeAtari9Bit(255, 255, 255)); // White (777)
            } else if (zLimit < 500) {
                starColor = rgbToHex(...quantizeAtari9Bit(0, 255, 255));   // Cyan (077)
            } else if (zLimit < 750) {
                starColor = rgbToHex(...quantizeAtari9Bit(136, 136, 136)); // Grey (444)
            } else {
                starColor = rgbToHex(...quantizeAtari9Bit(0, 0, 136));     // Dark Blue (004)
            }

            const size = star.z < 300 ? 2 : 1;
            ctx.fillStyle = starColor;
            ctx.fillRect(px, py, size, size);
        }
    }
}