// === js/visuals/gimmicks/copperbars.js ===
// =========================================================
// REAL-TIME COPPERBARS (RASTERBARS) COMPONENT
// Pseudo-3D Z-Buffer Sorting (Helix Orbit) & Depth Shading
// Safe Performance Edition (Hoisted Arrays, True Math, Snappy Decay)
// =========================================================

export class Copperbars {
    constructor() {
        this.sinTimes = [0.6, 0.85, 0.7, 0.95];
        this.sinOffsets = [0.0, 2.0, 4.0, 1.5];
        
        // GFX UPGRADE: Exakt 20% dünner für eine filigranere, aufgeräumtere Optik
        // Werte auf perfekte 8-Bit-Grenzen angepasst: [128, 96, 72, 56]
        this.baseThickness = [128, 96, 72, 56]; 
        
        this.heightWeights = [0.25, 0.28, 0.20, 0.22];
        this.colorCache = {};
        this.smoothedVols = [0, 0, 0, 0];
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

    drawCopperbar(ctx, w, y, height, volume, hexStart, hexEnd, scanlineHeight, colorBitShift, z) {
        if (volume <= 0.01) return;
        
        const cS = this.hexToRgb(hexStart);
        const cE = this.hexToRgb(hexEnd);
        const cBlk = [0, 0, 0];
        const cWht = [255, 255, 255];
        
        const steps = Math.max(1, Math.floor(height / scanlineHeight));
        
        // =========================================================
        // GFX UPGRADE: 3D DEPTH SHADING
        // Je weiter der Balken im Hintergrund liegt (z < 0), 
        // desto dunkler faden wir seine RGB-Werte ab (bis zu 35% Abdunklung).
        // =========================================================
        const depthFactor = 0.82 + (z * 0.18); 

        for(let i = 0; i <= steps; i++) {
            let t = i / steps; 
            let r, g, b;
            
            if (t < 0.18) {
                let n = t / 0.18;
                r = cBlk[0] + (cS[0] - cBlk[0]) * n;
                g = cBlk[1] + (cS[1] - cBlk[1]) * n;
                b = cBlk[2] + (cBlk[2] - cBlk[2]) * n; 
            } else if (t < 0.5) {
                let n = (t - 0.18) / 0.32;
                r = cS[0] + (cWht[0] - cS[0]) * n;
                g = cS[1] + (cWht[1] - cS[1]) * n;
                b = cS[2] + (cWht[2] - cS[2]) * n;
            } else if (t < 0.82) {
                let n = (t - 0.5) / 0.32;
                r = cWht[0] + (cE[0] - cWht[0]) * n;
                g = cWht[1] + (cE[1] - cWht[1]) * n;
                b = cWht[2] + (cE[2] - cWht[2]) * n;
            } else {
                let n = (t - 0.82) / 0.18;
                r = cE[0] + (cBlk[0] - cE[0]) * n;
                g = cE[1] + (cBlk[1] - cE[1]) * n;
                b = cE[2] + (cBlk[2] - cE[2]) * n;
            }
            
            // Tiefen-Dämpfung auf die RGB-Kanäle anwenden (Z ist hier absolut sicher befüllt!)
            r *= depthFactor;
            g *= depthFactor;
            b *= depthFactor;

            // 12-Bit/9-Bit/6-Bit Hardware Quantisierung & DAC-Doubling
            let mask = (0xFF >> colorBitShift) << colorBitShift;
            let r_q = (r | 0) & mask; r_q |= (r_q >> (8 - colorBitShift));
            let g_q = (g | 0) & mask; g_q |= (g_q >> (8 - colorBitShift));
            let b_q = (b | 0) & mask; b_q |= (b_q >> (8 - colorBitShift));
            
            ctx.fillStyle = `rgb(${r_q}, ${g_q}, ${b_q})`;
            
            let drawY = Math.floor(y + i * scanlineHeight);
            ctx.fillRect(0, drawY, w, scanlineHeight);
        }
    }

    render(ctx, width, height, t, channelVolumes) {
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

        let scanlineHeight = 4;
        let colorBitShift = 4; 
        
        if (isAtari) {
            colorBitShift = 5; 
        } else if (isC64) {
            scanlineHeight = 8; 
            colorBitShift = 6;  
        }

        // =========================================================
        // CORES UPGRADE: 3D HELIX CALCULATOR WITH Z-SORTING
        // =========================================================
        const barsToDraw = [];

        for (let c = 0; c < numBars; c++) {
            const rawVol = channelVolumes[c] || 0;
            
            // Tight Asymmetric Envelope Follower (0.8 Attack, 0.16 Decay)
            if (rawVol > this.smoothedVols[c]) {
                this.smoothedVols[c] += (rawVol - this.smoothedVols[c]) * 0.8;
            } else {
                this.smoothedVols[c] += (rawVol - this.smoothedVols[c]) * 0.16;
            }
            
            const smoothVol = this.smoothedVols[c];
            const punch = smoothVol * 55; // Puls angepasst
            
            const amplitude = height * this.heightWeights[c];
            const angle = t * this.sinTimes[c] + this.sinOffsets[c];
            
            // Y-Welle (Sinus)
            let yCenter = (height / 2);
            yCenter += Math.sin(angle) * amplitude;
            yCenter += Math.cos(angle * 1.37) * (amplitude * 0.25); // Lissajous
            
            // Z-Tiefe (Cosinus)
            const zDepth = Math.cos(angle);

            barsToDraw.push({
                y: yCenter,
                h: this.baseThickness[c] + punch,
                vol: smoothVol,
                z: zDepth,
                pal: pals[c]
            });
        }

        // --- PAINTER'S ALGORITHM (1D Z-Buffer) ---
        // Sortiert nach Z-Tiefe aufsteigend
        barsToDraw.sort((a, b) => a.z - b.z);

        // Rendern im Z-Index mit korrekt übergebener Z-Koordinate!
        barsToDraw.forEach(bar => {
            this.drawCopperbar(ctx, width, bar.y - bar.h / 2, bar.h, bar.vol, bar.pal[0], bar.pal[1], scanlineHeight, colorBitShift, bar.z);
        });
    }
}