// === js/visuals/dse/atari/retro-sunset.js ===
import { quantizeAtari9Bit, rgbToHex, fillAliasedCircle } from '../../utils/hardware-constraints.js';

export class AtariRetroSunset {
    constructor() {
        this.internalT = 0;
        this.waterT = 0;
        this.smoothedSpeed = 1.0;
        this.smoothedWaveSpeed = 1.0;
        this.lastT = 0;

        // Fest berechneter Farbsatz der 9-Bit-Himmelbänder zur Vermeidung zyklischer Quantisierungen
        const rawSkyColors = [
            [0, 0, 51], [34, 0, 51], [68, 0, 34], [102, 0, 17], 
            [136, 0, 0], [170, 34, 0], [204, 68, 0], [255, 102, 0]
        ];
        this.skyColors = rawSkyColors.map(c => rgbToHex(...quantizeAtari9Bit(...c)));

        this.outerSunColor = rgbToHex(...quantizeAtari9Bit(255, 170, 0));
        this.innerSunColor = rgbToHex(...quantizeAtari9Bit(255, 255, 85));
        this.waterBgColor = rgbToHex(...quantizeAtari9Bit(0, 0, 34));
        this.waterColor1 = rgbToHex(...quantizeAtari9Bit(0, 68, 170));
        this.waterColor2 = rgbToHex(...quantizeAtari9Bit(0, 119, 255));
        this.glitchColor = rgbToHex(...quantizeAtari9Bit(255, 255, 255));
        this.sunRefColor = rgbToHex(...quantizeAtari9Bit(255, 255, 85));
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

        // Atari Himmelbänder (9-Bit raster bands)
        let bandH = horizon / this.skyColors.length;
        for (let i = 0; i < this.skyColors.length; i++) { 
            ctx.fillStyle = this.skyColors[i]; 
            ctx.fillRect(0, Math.floor(i * bandH), width, Math.ceil(bandH)); 
        }

        let sx = Math.floor(width / 2);
        let sy = Math.floor(horizon - 25);
        
        // Atari SSG-Sonne (quantisiertes 3-Bit Pro Channel Mapping)
        let sunR = Math.floor((minDim * 0.125) + (activeSunPulse * (minDim * 0.05)));
        
        fillAliasedCircle(ctx, sx, sy, sunR, this.outerSunColor);
        fillAliasedCircle(ctx, sx, sy, Math.floor(sunR * 0.7), this.innerSunColor);

        // Wasser
        ctx.fillStyle = this.waterBgColor; 
        ctx.fillRect(0, horizon, width, height - horizon);

        let waterSpeed = this.waterT * 25;
        let distortion = 2 + (activeBeatDistortion * 2.0); 

        for (let y = horizon + 2; y < height; y += (y - horizon) * 0.15 + 2) {
            let depth = (y - horizon) / (height - horizon);
            let thickness = Math.max(1, Math.floor(depth * 2));
            let speed = waterSpeed * (0.5 + depth * 1.5);
            let offset = speed % 40;

            for (let x = -40; x < width; x += 40) {
                if (Math.abs(x + offset - sx) < sunR * (1.0 - depth * 0.5) && y < horizon + 40) {
                    ctx.fillStyle = this.sunRefColor; 
                } else {
                    ctx.fillStyle = (Math.floor(y) % 3 === 0) ? this.waterColor1 : this.waterColor2; 
                }
                
                let dashWidth = (minDim * 0.04) + (depth * (minDim * 0.075));
                let xDistort = Math.sin(y * 0.2 + waterSpeed) * distortion;
                
                if (activeBeatDistortion > 2.0 && Math.random() > 0.7) {
                    ctx.fillStyle = this.glitchColor; 
                    ctx.fillRect(0, Math.floor(y), width, 1); 
                } else {
                    ctx.fillRect(Math.floor(x + offset + xDistort), Math.floor(y), Math.floor(dashWidth), Math.floor(thickness));
                }
            }
        }

        ctx.globalAlpha = 1.0;
    }
}