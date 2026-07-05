// === js/visuals/dse/universal/copperbars.js ===

export class Copperbars {
    constructor() {        
        this.baseThickness = [90, 68, 50, 40]; 
        this.heightWeights = [0.24, 0.24, 0.24, 0.24];
        this.colorCache = {};
        
        this.barsToDraw = [
            { y: 0, h: 0, vol: 0, z: 0, pal: null },
            { y: 0, h: 0, vol: 0, z: 0, pal: null },
            { y: 0, h: 0, vol: 0, z: 0, pal: null },
            { y: 0, h: 0, vol: 0, z: 0, pal: null }
        ];

        // NEU: Für flüssige State-Übergänge
        this.lastT = 0;
        this.internalT = 0;
        this.smoothedSpeed = 1.0;
    }

    hexToRgb(hex) { /* ... bleibt identisch ... */ 
        if (this.colorCache[hex]) return this.colorCache[hex];
        const r = parseInt(hex.substring(1, 3), 16);
        const g = parseInt(hex.substring(3, 5), 16);
        const b = parseInt(hex.substring(5, 7), 16);
        const rgb = [r, g, b];
        this.colorCache[hex] = rgb;
        return rgb;
    }

    drawCopperbar(ctx, w, y, height, volume, hexStart, hexEnd, scanlineHeight, colorBitShift, z, globalAlpha) {
        /* ... bleibt komplett identisch ... */
        if (volume <= 0.01 || height <= 0 || globalAlpha <= 0.01) return;
        const cS = this.hexToRgb(hexStart), cE = this.hexToRgb(hexEnd), cBlk = [0, 0, 0], cWht = [255, 255, 255];
        const steps = Math.max(1, Math.floor(height / scanlineHeight));
        const depthFactor = 0.82 + (z * 0.18); 
        ctx.globalAlpha = globalAlpha;

        for(let i = 0; i <= steps; i++) {
            let t = i / steps; let r, g, b;
            if (t < 0.18) { let n = t / 0.18; r = cBlk[0] + (cS[0] - cBlk[0]) * n; g = cBlk[1] + (cS[1] - cBlk[1]) * n; b = cBlk[2] + (cBlk[2] - cBlk[2]) * n; } 
            else if (t < 0.5) { let n = (t - 0.18) / 0.32; r = cS[0] + (cWht[0] - cS[0]) * n; g = cS[1] + (cWht[1] - cS[1]) * n; b = cS[2] + (cWht[2] - cS[2]) * n; } 
            else if (t < 0.82) { let n = (t - 0.5) / 0.32; r = cWht[0] + (cE[0] - cWht[0]) * n; g = cWht[1] + (cE[1] - cWht[1]) * n; b = cWht[2] + (cE[2] - cWht[2]) * n; } 
            else { let n = (t - 0.82) / 0.18; r = cE[0] + (cBlk[0] - cE[0]) * n; g = cE[1] + (cBlk[1] - cE[1]) * n; b = cE[2] + (cBlk[2] - cE[2]) * n; }
            r *= depthFactor; g *= depthFactor; b *= depthFactor;

            let mask = (0xFF >> colorBitShift) << colorBitShift;
            let r_q = (r | 0) & mask; r_q |= (r_q >> (8 - colorBitShift));
            let g_q = (g | 0) & mask; g_q |= (g_q >> (8 - colorBitShift));
            let b_q = (b | 0) & mask; b_q |= (b_q >> (8 - colorBitShift));
            
            ctx.fillStyle = `rgb(${r_q}, ${g_q}, ${b_q})`;
            ctx.fillRect(0, Math.floor(y + i * scanlineHeight), w, scanlineHeight);
        }
        ctx.globalAlpha = 1.0; 
    }

    resize(width, height) {}

render(ctx, width, height, t, state, stateTime, metrics) {
        if (state === 'idle') { this.lastT = t; return; }

        let dt = this.lastT === 0 ? 0.016 : t - this.lastT;
        this.lastT = t;

        const isAmiga = document.body.classList.contains('theme-amiga');
        const isAtari = document.body.classList.contains('theme-atari');
        const isC64 = document.body.classList.contains('theme-c64');
        
        const numBars = isAmiga ? 4 : 3;
        const pals = [
            isAtari ? ['#003300', '#00aa00'] : isAmiga ? ['#000066', '#0055ff'] : ['#201a60', '#6c5eb5'],
            isAtari ? ['#333300', '#aaaa00'] : isAmiga ? ['#663300', '#ff8800'] : ['#660033', '#ff00aa'],
            isAtari ? ['#003333', '#00aaaa'] : isAmiga ? ['#330066', '#aa00ff'] : ['#333333', '#aaaaaa'],
            isAmiga ? ['#111111', '#888888'] : []
        ];

        let scanlineHeight = isC64 ? 8 : 4;
        let colorBitShift = isAtari ? 5 : (isC64 ? 6 : 4);

        let globalAlpha = 1.0;
        let targetSpeed = 1.0;
        let amplitudeMultiplier = 1.0;

        if (state === 'starting') {
            globalAlpha = Math.min(1.0, stateTime / 1.5);
            amplitudeMultiplier = globalAlpha;
        } else if (state === 'stopping') {
            globalAlpha = Math.max(0.0, 1.0 - (stateTime / 1.5));
            amplitudeMultiplier = globalAlpha;
        } else if (state === 'buildup') {
            targetSpeed = 1.5;
        } else if (state === 'climax') {
            targetSpeed = 2.0; 
            globalAlpha = 0.8 + (metrics.pulse[0] * 0.2); 
        }

        // =========================================================
        // MATHEMATISCHER FIX: Smooth Integration
        // Verhindert Phasen-Sprüngen bei schnellen State-Wechseln
        // =========================================================
        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * 0.05;
        this.internalT += dt * this.smoothedSpeed;

        const baseSpeed = 0.55; 
        const phaseStep = (Math.PI * 2) / numBars; 

        for (let c = 0; c < numBars; c++) {
            const smoothVol = metrics.smooth[c]; 
            const punch = smoothVol * 40; 
            const amplitude = (height * this.heightWeights[c]) * amplitudeMultiplier;
            const angle = (this.internalT * baseSpeed) + (c * phaseStep);
            
            let yCenter = (height / 2);
            yCenter += Math.sin(angle) * amplitude;
            yCenter += Math.cos(angle * 1.5) * (amplitude * 0.12);
            
            let bar = this.barsToDraw[c];
            bar.y = yCenter;
            bar.h = this.baseThickness[c] + punch;
            bar.vol = smoothVol;
            bar.z = Math.cos(angle);
            bar.pal = pals[c];
        }

        let activeSlice = this.barsToDraw.slice(0, numBars);
        activeSlice.sort((a, b) => a.z - b.z);

        for (let i = 0; i < numBars; i++) {
            let bar = activeSlice[i];
            this.drawCopperbar(ctx, width, bar.y - bar.h / 2, bar.h, bar.vol, bar.pal[0], bar.pal[1], scanlineHeight, colorBitShift, bar.z, globalAlpha);
        }
    }
}