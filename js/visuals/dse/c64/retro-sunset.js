// === js/visuals/dse/c64/retro-sunset.js ===
import { C64_PALETTE, rgbToHex } from '../../utils/hardware-constraints.js';

export class C64RetroSunset {
    constructor() {
        this.internalT = 0;
        this.waterT = 0;
        this.smoothedSpeed = 1.0;
        this.smoothedWaveSpeed = 1.0;
        this.lastT = 0;

        // Statischer Farb-Cache zur Vermeidung von CPU-Lookups im Renderloop
        this.colDarkBlue  = rgbToHex(...C64_PALETTE[6]);
        this.colRed       = rgbToHex(...C64_PALETTE[2]);
        this.colLightRed  = rgbToHex(...C64_PALETTE[10]);
        this.colYellow    = rgbToHex(...C64_PALETTE[7]);
        this.colWhite     = rgbToHex(...C64_PALETTE[1]);
        this.colLightBlue = rgbToHex(...C64_PALETTE[14]);
    }

    resize(width, height) {}

    render(ctx, width, height, t, state, stateTime, metrics) {
        if (state === 'idle') { this.lastT = t; return; }
        let dt = this.lastT === 0 ? 0.016 : t - this.lastT;
        this.lastT = t;

        let globalAlpha = 1.0;
        let targetSpeed = 1.0;
        let targetWaveSpeed = 1.0;
        let beatIntensity = 0.0;

        if (state === 'starting') {
            globalAlpha = Math.min(1.0, stateTime / 1.5);
        } else if (state === 'stopping') {
            globalAlpha = Math.max(0.0, 1.0 - (stateTime / 1.5));
        } else if (state === 'buildup') {
            targetSpeed = 1.2;             
            targetWaveSpeed = 1.5;         
            beatIntensity = 0.25;           
        } else if (state === 'climax') {
            targetSpeed = 2.2;
            targetWaveSpeed = 5.0;         
            beatIntensity = 1.0;           
        }

        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * 0.05;
        this.smoothedWaveSpeed += (targetWaveSpeed - this.smoothedWaveSpeed) * 0.05;
        
        this.internalT += dt * this.smoothedSpeed;
        this.waterT += dt * this.smoothedWaveSpeed;

        const activeSunPulse = metrics.beat[0] * beatIntensity;
        const activeBeatDistortion = metrics.beat[0] * beatIntensity * 4.0;

        ctx.globalAlpha = globalAlpha;
        
        const horizon = Math.floor(height * 0.55); 
        const minDim = Math.min(width, height); 

        // Symmetrisch lückenlose Himmelbänder
        const y1 = Math.floor(horizon * 0.3);
        const y2 = Math.floor(horizon * 0.6);
        const y3 = Math.floor(horizon * 0.85);

        ctx.fillStyle = this.colDarkBlue;  ctx.fillRect(0, 0, width, y1); 
        ctx.fillStyle = this.colRed;       ctx.fillRect(0, y1, width, y2 - y1); 
        ctx.fillStyle = this.colLightRed;  ctx.fillRect(0, y2, width, y3 - y2); 
        ctx.fillStyle = this.colYellow;    ctx.fillRect(0, y3, width, horizon - y3);
        
        let sunR = Math.floor((minDim * 0.125) + (activeSunPulse * (minDim * 0.045))); 
        let sx = Math.floor(width / 2); 
        let sy = Math.floor(horizon - 12);

        const blockSize = 4; 
        const centerBlockX = Math.floor(sx / blockSize);
        const centerBlockY = Math.floor(sy / blockSize);

        // 1. Phosphor-Corona
        if (activeSunPulse > 0.05) {
            let coronaR = Math.floor(sunR + (minDim * 0.035 * activeSunPulse));
            const coronaBlockR = Math.round(coronaR / blockSize);
            ctx.fillStyle = this.colLightRed; 
            for (let by = -coronaBlockR; by <= coronaBlockR; by++) {
                let dx = Math.round(Math.sqrt(coronaBlockR * coronaBlockR - by * by));
                let screenY = (centerBlockY + by) * blockSize;
                let startX = (centerBlockX - dx) * blockSize;
                let endX = (centerBlockX + dx) * blockSize;
                ctx.fillRect(startX, screenY, endX - startX, blockSize);
            }
        }

        // 2. Sonnenkern (Integer Blocks)
        const blockR = Math.round(sunR / blockSize);
        ctx.fillStyle = this.colWhite;
        for (let by = -blockR; by <= blockR; by++) {
            let dx = Math.round(Math.sqrt(blockR * blockR - by * by));
            let screenY = (centerBlockY + by) * blockSize;
            let startX = (centerBlockX - dx) * blockSize;
            let endX = (centerBlockX + dx) * blockSize;
            ctx.fillRect(startX, screenY, endX - startX, blockSize);
        }

        // Wasserhintergrund
        ctx.fillStyle = this.colDarkBlue; ctx.fillRect(0, horizon, width, height - horizon);

        let waveSpeed = this.waterT * 10; 
        const waveDisplacementAmp = metrics.tensionPct * 6.0;

        for (let y = Math.floor(horizon); y < height; y += 4) {
            let xDistort = Math.sin((y * 0.15) + (this.waterT * 0.8)) * waveDisplacementAmp;
            let offset = Math.floor((waveSpeed + y * 2) % 40);
            
            for (let x = -40; x < width + 40; x += 40) {
                let drawX = Math.floor(x - offset + xDistort);
                
                if (Math.abs(drawX - sx) < sunR * 0.9 && y > horizon + 8) {
                    let isBright = (activeBeatDistortion > 1.5) ? (Math.random() > 0.4) : (Math.random() > 0.15);
                    ctx.fillStyle = isBright ? this.colYellow : this.colLightRed;
                } else {
                    ctx.fillStyle = this.colLightBlue; 
                }
                ctx.fillRect(drawX, Math.floor(y + 1), 10, 2); 
            }
        }

        ctx.globalAlpha = 1.0;
    }
}