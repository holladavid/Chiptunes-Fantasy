// === js/visuals/dse/universal/copperbars.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: REAL-TIME COPPERBARS (RASTERBARS)
// Pseudo-3D Z-Buffer Sorting (Helix Orbit) & Depth Shading
// Refactored for True Metallic Cylinder Shading (No Black Edges)
// =========================================================

export class Copperbars {
    constructor() {
        this.name = '3D Helix Copperbars';
        this.computerType = ['all']; 
        this.placementType = 'floor';
        
        this.baseThickness = [65, 50, 38, 28]; 
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
        this.smoothedPunch = 25.0;
        this.smoothedTwist = 0.0;
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

    drawCopperbar(ctx, w, y, height, volume, hexStart, hexEnd, scanlineHeight, colorBitShift, z, globalAlpha) {
        if (volume <= 0.01 || height <= 0 || globalAlpha <= 0.01) return;
        
        const cS = this.hexToRgb(hexStart); // Dark Base Color
        const cE = this.hexToRgb(hexEnd);   // Light Base Color
        const cWht = [255, 255, 255];       // Specular Highlight
        
        const steps = Math.max(1, Math.floor(height / scanlineHeight));
        const depthFactor = 0.82 + (z * 0.18); 

        ctx.globalAlpha = globalAlpha;

        // =========================================================
        // TRUE METALLIC CYLINDER SHADING (No Black Edges)
        // Die Ränder enden hart auf der dunklen Grundfarbe (cS). 
        // Das Specular Highlight (Weiß) liegt leicht asymmetrisch bei 40%.
        // =========================================================
        for(let i = 0; i <= steps; i++) {
            let t = i / steps; 
            let r, g, b;
            
            if (t < 0.2) {
                let n = t / 0.2;
                r = cS[0] + (cE[0] - cS[0]) * n;
                g = cS[1] + (cE[1] - cS[1]) * n;
                b = cS[2] + (cE[2] - cS[2]) * n; 
            } else if (t < 0.4) {
                let n = (t - 0.2) / 0.2;
                r = cE[0] + (cWht[0] - cE[0]) * n;
                g = cE[1] + (cWht[1] - cE[1]) * n;
                b = cE[2] + (cWht[2] - cE[2]) * n;
            } else if (t < 0.6) {
                let n = (t - 0.4) / 0.2;
                r = cWht[0] + (cE[0] - cWht[0]) * n;
                g = cWht[1] + (cE[1] - cWht[1]) * n;
                b = cWht[2] + (cE[2] - cWht[2]) * n;
            } else {
                let n = (t - 0.6) / 0.4;
                r = cE[0] + (cS[0] - cE[0]) * n;
                g = cE[1] + (cS[1] - cE[1]) * n;
                b = cE[2] + (cS[2] - cE[2]) * n;
            }
            
            r *= depthFactor;
            g *= depthFactor;
            b *= depthFactor;

            let mask = (0xFF >> colorBitShift) << colorBitShift;
            let r_q = (r | 0) & mask; r_q |= (r_q >> (8 - colorBitShift));
            let g_q = (g | 0) & mask; g_q |= (g_q >> (8 - colorBitShift));
            let b_q = (b | 0) & mask; b_q |= (b_q >> (8 - colorBitShift));
            
            ctx.fillStyle = `rgb(${r_q}, ${g_q}, ${b_q})`;
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

        const isAmiga = document.body.classList.contains('theme-amiga');
        const isAtari = document.body.classList.contains('theme-atari');
        const isC64 = document.body.classList.contains('theme-c64');
        
        const numBars = isAmiga ? 4 : 3;
        const pals = [
            isAtari ? ['#003300', '#00aa00'] : isAmiga ? ['#000066', '#0055ff'] : ['#201a60', '#6c5eb5'],
            isAtari ? ['#333300', '#aaaa00'] : isAmiga ? ['#663300', '#ff8800'] : ['#660033', '#ff00aa'],
            isAtari ? ['#003333', '#00aaaa'] : isAmiga ? ['#330066', '#aa00ff'] : ['#333333', '#aaaaaa'],
            // Grau auf #222 angehoben, damit auch diese Spur kein absolutes Schwarz an der Kante erzeugt
            isAmiga ? ['#222222', '#999999'] : [] 
        ];

        let scanlineHeight = isC64 ? 8 : 4;
        let colorBitShift = isAtari ? 5 : (isC64 ? 6 : 4);

        let globalAlpha = 1.0;
        let targetSpeed = 1.0;
        let targetAmplitude = 0.85; 
        let targetPunch = 25.0;    
        let targetTwist = 0.0;       

        if (state === 'starting') {
            globalAlpha = Math.min(1.0, stateTime / 1.5);
            targetAmplitude = globalAlpha * 0.85;
        } else if (state === 'stopping') {
            globalAlpha = Math.max(0.0, 1.0 - (stateTime / 1.5));
            targetAmplitude = globalAlpha * 0.85;
        } else if (state === 'buildup') {
            targetSpeed = 1.4;
            targetAmplitude = 1.0;   
            targetPunch = 35.0;      
        } else if (state === 'climax') {
            targetSpeed = 1.8;           
            targetAmplitude = 1.1;   
            targetPunch = 45.0;      
            globalAlpha = 0.85 + (metrics.pulse[0] * 0.15); 
            targetTwist = 15.0 * metrics.pulse[0]; 
        }

        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * 0.05;
        this.smoothedAmplitude += (targetAmplitude - this.smoothedAmplitude) * 0.05;
        this.smoothedPunch += (targetPunch - this.smoothedPunch) * 0.1;
        this.smoothedTwist += (targetTwist - this.smoothedTwist) * 0.15;

        this.internalT += dt * this.smoothedSpeed;

        const baseSpeed = 0.55; 
        const phaseStep = (Math.PI * 2) / numBars; 

        for (let c = 0; c < numBars; c++) {
            const smoothVol = metrics.smooth[c]; 
            const punch = smoothVol * this.smoothedPunch; 
            const amplitude = (height * this.heightWeights[c]) * this.smoothedAmplitude;
            const angle = (this.internalT * baseSpeed) + (c * phaseStep);
            
            let yCenter = (height / 2);
            yCenter += Math.sin(angle) * amplitude;
            
            yCenter += Math.cos(angle * 1.5) * (amplitude * 0.12);
            yCenter += Math.sin(t * 6.0 + c * 2.0) * this.smoothedTwist;
            
            let bar = this.barsToDraw[c];
            bar.y = yCenter;
            bar.h = this.baseThickness[c] + punch;
            bar.vol = smoothVol;
            bar.z = Math.cos(angle);
            bar.pal = pals[c];
        }

        for (let i = 0; i < numBars; i++) {
            this.sortedBars[i] = this.barsToDraw[i];
        }

        for (let i = 0; i < numBars - 1; i++) {
            for (let j = 0; j < numBars - i - 1; j++) {
                if (this.sortedBars[j].z > this.sortedBars[j + 1].z) {
                    let temp = this.sortedBars[j];
                    this.sortedBars[j] = this.sortedBars[j + 1];
                    this.sortedBars[j + 1] = temp;
                }
            }
        }

        for (let i = 0; i < numBars; i++) {
            let bar = this.sortedBars[i];
            this.drawCopperbar(ctx, width, bar.y - bar.h / 2, bar.h, bar.vol, bar.pal[0], bar.pal[1], scanlineHeight, colorBitShift, bar.z, globalAlpha);
        }
    }
}