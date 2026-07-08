// === js/visuals/dse/universal/copperbars.js ===
import { getNearestC64Color, quantizeAmiga12Bit, quantizeAtari9Bit, rgbToHex } from '../../utils/hardware-constraints.js';

export class Copperbars {
    constructor() {
        this.baseThickness = [52, 40, 30, 22]; 
        this.heightWeights = [0.24, 0.24, 0.24, 0.24];
        this.colorCache = {};
        
        this.barsToDraw = [
            { y: 0, h: 0, vol: 0, z: 0, pal: null },
            { y: 0, h: 0, vol: 0, z: 0, pal: null },
            { y: 0, h: 0, vol: 0, z: 0, pal: null },
            { y: 0, h: 0, vol: 0, z: 0, pal: null }
        ];

        this.sortedBars = Array(4).fill(null);
        
        this.lastT = 0;
        this.internalT = 0;
        this.smoothedSpeed = 1.0;
        this.smoothedAmplitude = 0.85;
        this.smoothedTwist = 0.0;
        this.smoothedBeatPunch = 0.0;
    }

    hexToRgb(hex) {
        if (this.colorCache[hex]) return this.colorCache[hex];
        const r = parseInt(hex.substring(1, 3), 16);
        const g = parseInt(hex.substring(3, 5), 16);
        const b = parseInt(hex.substring(5, 7), 16);
        const rgb = [r, g, b];
        this.colorCache[hex] = rgb;
        return rgb;
    }

    drawCopperbar(ctx, w, y, height, volume, hexStart, hexEnd, scanlineHeight, system, z, globalAlpha) {
        if (volume <= 0.01 || height <= 0 || globalAlpha <= 0.01) return;
        
        const cS = this.hexToRgb(hexStart);
        const cE = this.hexToRgb(hexEnd);
        const cWht = [255, 255, 255]; // Peak Highlight
        
        const steps = Math.max(1, Math.floor(height / scanlineHeight));
        const depthFactor = 0.82 + (z * 0.18); 

        ctx.globalAlpha = globalAlpha;

        for(let i = 0; i <= steps; i++) {
            let t = i / steps; 
            let r, g, b;
            
            if (t < 0.2) {
                let n = t / 0.2;
                r = cS[0] + (cE[0] - cS[0]) * n; g = cS[1] + (cE[1] - cS[1]) * n; b = cS[2] + (cE[2] - cS[2]) * n; 
            } else if (t < 0.4) {
                let n = (t - 0.2) / 0.2;
                r = cE[0] + (cWht[0] - cE[0]) * n; g = cE[1] + (cWht[1] - cE[1]) * n; b = cE[2] + (cWht[2] - cE[2]) * n;
            } else if (t < 0.6) {
                let n = (t - 0.4) / 0.2;
                r = cWht[0] + (cE[0] - cWht[0]) * n; g = cWht[1] + (cE[1] - cWht[1]) * n; b = cWht[2] + (cE[2] - cWht[2]) * n;
            } else {
                let n = (t - 0.6) / 0.4;
                r = cE[0] + (cS[0] - cE[0]) * n; g = cE[1] + (cS[1] - cE[1]) * n; b = cE[2] + (cS[2] - cE[2]) * n;
            }
            
            r *= depthFactor; g *= depthFactor; b *= depthFactor;

            // --- NEU: STRICT HARDWARE QUANTIZATION ---
            let finalColor;
            if (system === 'c64') {
                finalColor = getNearestC64Color(r, g, b); // Automatisches C64-Banding!
            } else if (system === 'amiga') {
                finalColor = quantizeAmiga12Bit(r, g, b); // 12-Bit Copper Stepping
            } else {
                finalColor = quantizeAtari9Bit(r, g, b);  // 9-Bit Shifter Stepping
            }
            
            ctx.fillStyle = rgbToHex(finalColor[0], finalColor[1], finalColor[2]);
            let drawY = Math.floor(y + i * scanlineHeight);
            ctx.fillRect(0, drawY, w, scanlineHeight);
        }
        ctx.globalAlpha = 1.0; 
    }

    resize(width, height) {}

    render(ctx, width, height, t, state, stateTime, metrics) {
        if (state === 'idle') { this.lastT = t; return; }

        let dt = this.lastT === 0 ? 0.016 : t - this.lastT;
        this.lastT = t;

        const system = metrics.system;
        const numBars = system === 'amiga' ? 4 : 3;
        
        // Definition der Paletten (wird intern quantisiert)
        const pals = [
            system === 'atari' ? ['#003300', '#00aa00'] : system === 'amiga' ? ['#000066', '#0055ff'] : ['#201a60', '#6c5eb5'],
            system === 'atari' ? ['#333300', '#aaaa00'] : system === 'amiga' ? ['#663300', '#ff8800'] : ['#660033', '#ff00aa'],
            system === 'atari' ? ['#003333', '#00aaaa'] : system === 'amiga' ? ['#330066', '#aa00ff'] : ['#333333', '#aaaaaa'],
            system === 'amiga' ? ['#222222', '#999999'] : [] 
        ];

        let scanlineHeight = system === 'c64' ? 8 : 4;

        let globalAlpha = 1.0;
        let targetSpeed = 1.0;
        let targetAmplitude = 0.85; 

        let punchBase = 15.0; 
        let targetBeatPunch = 0.0;
        let targetTwist = 0.0;

        if (state === 'starting') {
            globalAlpha = Math.min(1.0, stateTime / 1.5);
            targetAmplitude = globalAlpha * 0.85;
        } else if (state === 'stopping') {
            globalAlpha = Math.max(0.0, 1.0 - (stateTime / 1.5));
            targetAmplitude = globalAlpha * 0.85;
        } else if (state === 'buildup') {
            targetSpeed = 1.2; targetAmplitude = 0.95; targetBeatPunch = 8.0;             
        } else if (state === 'climax') {
            targetSpeed = 1.8; targetAmplitude = 1.1; targetBeatPunch = 35.0;            
            globalAlpha = 0.85 + (metrics.beat[0] * 0.15); 
            targetTwist = 18.0; 
        }

        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * Math.min(1.0, dt * 5.0);
        this.smoothedAmplitude += (targetAmplitude - this.smoothedAmplitude) * Math.min(1.0, dt * 5.0);
        this.smoothedBeatPunch += (targetBeatPunch - this.smoothedBeatPunch) * Math.min(1.0, dt * 10.0);
        this.smoothedTwist += (targetTwist - this.smoothedTwist) * Math.min(1.0, dt * 8.0);

        this.internalT += dt * this.smoothedSpeed;

        const baseSpeed = 0.55; 
        const phaseStep = (Math.PI * 2) / numBars; 

        for (let c = 0; c < numBars; c++) {
            const smoothVol = metrics.smooth[c]; 
            const punch = (smoothVol * punchBase) + (metrics.beat[0] * this.smoothedBeatPunch); 
            const amplitude = (height * this.heightWeights[c]) * this.smoothedAmplitude;
            const angle = (this.internalT * baseSpeed) + (c * phaseStep);
            
            let yCenter = (height / 2);
            yCenter += Math.sin(angle) * amplitude;
            yCenter += Math.cos(angle * 1.5) * (amplitude * 0.12);
            
            if (this.smoothedTwist > 0.01) {
                yCenter += Math.sin(this.internalT * 6.0 + c * 2.0) * (this.smoothedTwist * metrics.beat[0]);
            }
            
            let bar = this.barsToDraw[c];
            bar.y = yCenter; bar.h = this.baseThickness[c] + punch; bar.vol = smoothVol; bar.z = Math.cos(angle); bar.pal = pals[c];
        }

        for (let i = 0; i < numBars; i++) this.sortedBars[i] = this.barsToDraw[i];
        for (let i = 0; i < numBars - 1; i++) {
            for (let j = 0; j < numBars - i - 1; j++) {
                if (this.sortedBars[j].z > this.sortedBars[j + 1].z) {
                    let temp = this.sortedBars[j]; this.sortedBars[j] = this.sortedBars[j + 1]; this.sortedBars[j + 1] = temp;
                }
            }
        }
        for (let i = 0; i < numBars; i++) {
            let bar = this.sortedBars[i];
            // Übergebe das System statt des ColorBitShifts
            this.drawCopperbar(ctx, width, bar.y - bar.h / 2, bar.h, bar.vol, bar.pal[0], bar.pal[1], scanlineHeight, system, bar.z, globalAlpha);
        }
    }
}