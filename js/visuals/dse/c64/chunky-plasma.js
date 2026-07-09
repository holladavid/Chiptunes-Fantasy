// === js/visuals/dse/c64/chunky-plasma.js ===
import { C64_PALETTE, rgbToHex } from '../../utils/hardware-constraints.js';

export class ChunkyPlasma {
    constructor() {
        this.name = 'C64 Chunky Plasma';
        this.blockSize = 8; // PROPORTIONS-FIX: 8x8 Pixel für authentisches C64-Textmodus-Feeling!
        
        const colorIndices = [6, 4, 2, 10, 8, 7, 1, 7, 8, 10, 2, 4];
        this.hexCache = colorIndices.map(idx => rgbToHex(...C64_PALETTE[idx]));
        this.numColors = this.hexCache.length;

        this.internalT = 0;
        this.smoothedSpeed = 1.0;
        this.lastT = 0;
    }

    resize(width, height) {}

    render(ctx, width, height, t, state, stateTime, metrics) {
        if (state === 'idle') { this.lastT = t; return; }
        
        let dt = this.lastT === 0 ? 0.016 : t - this.lastT;
        this.lastT = t;

        let globalAlpha = 1.0; let targetSpeed = 1.0; let beatShiftMultiplier = 0.0;

        if (state === 'starting') globalAlpha = Math.min(1.0, stateTime / 1.5);
        else if (state === 'stopping') globalAlpha = Math.max(0.0, 1.0 - (stateTime / 1.5));
        else if (state === 'buildup') { targetSpeed = 1.5; beatShiftMultiplier = 1.0; } 
        else if (state === 'climax') { targetSpeed = 3.5; beatShiftMultiplier = 6.0; }

        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * Math.min(1.0, dt * 4.0);
        this.internalT += dt * this.smoothedSpeed;

        const beatOffset = Math.floor(metrics.beat[0] * beatShiftMultiplier);
        ctx.globalAlpha = globalAlpha;

        const cols = Math.ceil(width / this.blockSize);
        const rows = Math.ceil(height / this.blockSize);

        const sinX1 = new Float32Array(cols); const sinX2 = new Float32Array(cols);
        for (let x = 0; x < cols; x++) {
            let realX = x * 0.15;
            sinX1[x] = Math.sin(realX + this.internalT * 0.8);
            sinX2[x] = Math.sin(realX * 0.5 + this.internalT * 1.5);
        }
        const timeY = this.internalT * 1.2;

        for (let y = 0; y < rows; y++) {
            let realY = y * 0.15;
            let sinY1 = Math.sin(realY + timeY);
            let sinY2 = Math.sin(realY * 0.8 - timeY * 0.5);

            for (let x = 0; x < cols; x++) {
                let v = sinX1[x] + sinY1 + Math.sin(sinX2[x] + sinY2);
                let dist = Math.sqrt((x - cols / 2) ** 2 + (y - rows / 2) ** 2);
                v += Math.sin(dist * 0.15 - this.internalT * 2.0);

                let colorIdx = Math.floor((v + 4.0) * 1.5) + beatOffset;
                colorIdx = ((colorIdx % this.numColors) + this.numColors) % this.numColors;

                ctx.fillStyle = this.hexCache[colorIdx];
                ctx.fillRect(x * this.blockSize, y * this.blockSize, this.blockSize, this.blockSize);
            }
        }
        ctx.globalAlpha = 1.0;
    }
}