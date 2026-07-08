// === js/visuals/dse/universal/starfield.js ===
import { C64_PALETTE, rgbToHex, quantizeAmiga12Bit, quantizeAtari9Bit } from '../../utils/hardware-constraints.js';

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
            globalAlpha = 0.8 + (metrics.beat[0] * 0.2); 
            beatWarp = 6.0;                
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
        ctx.lineCap = 'square'; 
        const cx = w / 2; const cy = h / 2; const fov = Math.min(w, h) * 1.5;

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

            // STRICT C64 PALETTE BINDING
            let starColor;
            if (curZ < 250) starColor = rgbToHex(...C64_PALETTE[1]);      // White
            else if (curZ < 500) starColor = rgbToHex(...C64_PALETTE[15]);// Light Grey
            else if (curZ < 750) starColor = rgbToHex(...C64_PALETTE[14]);// Light Blue
            else if (curZ < 900) starColor = rgbToHex(...C64_PALETTE[12]);// Grey
            else starColor = rgbToHex(...C64_PALETTE[11]);                // Dark Grey

            ctx.strokeStyle = starColor; ctx.fillStyle = starColor;
            const distSq = (px-prevPx)**2 + (py-prevPy)**2;

            if (distSq > 9.0) {
                ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(prevPx, prevPy); ctx.lineTo(px, py); ctx.stroke();
            } else {
                const size = Math.max(2, Math.floor((1000 - curZ) / 200));
                ctx.fillRect(px - size/2, py - size/2, size, size);
            }
        }
    }

    drawAmiga(ctx, w, h, activeWarp) {
        ctx.lineCap = 'round'; 
        ctx.globalCompositeOperation = 'screen'; 
        const cx = w / 2; const cy = h / 2; const fov = Math.min(w, h) * 1.5;

        for (let i = 0; i < this.numStars; i++) {
            let star = this.stars[i];
            const prevZ = star.z;
            star.z -= activeWarp;
            if (star.z <= 6) {
                star.z = 1000; star.x = (Math.random() - 0.5) * 2500; star.y = (Math.random() - 0.5) * 2500;
                continue; 
            }

            const curZ = star.z;
            const px = cx + (star.x / curZ) * fov; const py = cy + (star.y / curZ) * fov;
            const prevPx = cx + (star.x / prevZ) * fov; const prevPy = cy + (star.y / prevZ) * fov;

            let brightness = Math.max(0.1, 1.0 - (curZ / 1000));
            
            // 12-BIT AMIGA QUANTIZATION
            let rawR = 150 + brightness * 105;
            let rawG = 200 + brightness * 55;
            let q = quantizeAmiga12Bit(rawR, rawG, 255);
            let starColor = `rgba(${q[0]}, ${q[1]}, ${q[2]}, ${brightness})`; 

            ctx.strokeStyle = starColor; ctx.fillStyle = starColor;
            const distSq = (px-prevPx)**2 + (py-prevPy)**2;

            if (distSq > 4.0) {
                ctx.lineWidth = 1.0 + brightness * 2.5;
                ctx.beginPath(); ctx.moveTo(prevPx, prevPy); ctx.lineTo(px, py); ctx.stroke();
            } else {
                const size = 1.0 + brightness * 2.0;
                ctx.beginPath(); ctx.arc(px, py, size, 0, Math.PI * 2); ctx.fill();
            }
        }
        ctx.globalCompositeOperation = 'source-over';
    }

    drawAtari(ctx, w, h, activeWarp) {
        ctx.lineCap = 'butt'; 
        const cx = w / 2; const cy = h / 2; const fov = Math.min(w, h) * 1.5; 

        for (let i = 0; i < this.numStars; i++) {
            let star = this.stars[i];
            const prevZ = star.z;
            star.z -= activeWarp;
            if (star.z <= 6) {
                star.z = 1000; star.x = (Math.random() - 0.5) * 2500; star.y = (Math.random() - 0.5) * 2500;
                continue; 
            }

            const curZ = star.z;
            const px = Math.floor(cx + (star.x / curZ) * fov); const py = Math.floor(cy + (star.y / curZ) * fov);
            const prevPx = Math.floor(cx + (star.x / prevZ) * fov); const prevPy = Math.floor(cy + (star.y / prevZ) * fov);

            // 9-BIT ATARI QUANTIZATION
            let starColor;
            if (curZ < 250) starColor = rgbToHex(...quantizeAtari9Bit(255, 255, 255)); 
            else if (curZ < 500) starColor = rgbToHex(...quantizeAtari9Bit(85, 255, 255)); 
            else if (curZ < 750) starColor = rgbToHex(...quantizeAtari9Bit(0, 85, 170)); 
            else starColor = rgbToHex(...quantizeAtari9Bit(0, 34, 68));

            ctx.strokeStyle = starColor; ctx.fillStyle = starColor;
            const distSq = (px-prevPx)**2 + (py-prevPy)**2;

            if (distSq > 9.0) {
                ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(prevPx, prevPy); ctx.lineTo(px, py); ctx.stroke();
            } else {
                const size = curZ < 400 ? 2 : 1;
                ctx.fillRect(px, py, size, size);
            }
        }
    }
}