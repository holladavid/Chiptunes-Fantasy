// === js/visuals/dse/universal/copperbars.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: COVERS / RASTERBARS (v2.0.0 - OCS Edition)
// 100% Alpha-free. Pure hardware overdraw, no transparency blending.
// C64: Strict 16 VIC-II colors, 1px steps, mechanical Sine LUT.
// Amiga: 12-Bit OCS hex tables with dynamic expanding white cores.
// Atari ST: Hard 9-Bit step-shading. Proportional 3/4 layout preserved.
// =========================================================

import { C64_PALETTE, getNearestC64Color, quantizeAmiga12Bit, quantizeAtari9Bit, rgbToHex } from '../../utils/hardware-constraints.js';

export class Copperbars {
    constructor() {
        // Vorberechnete 256-Byte Sinus-Tabelle für den mechanischen Raster-Lauf
        this.sinLUT = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
            this.sinLUT[i] = Math.sin((i / 256) * Math.PI * 2);
        }

        // Relative Höhengewichtung zur Zentrierung
        this.heightWeights = [0.24, 0.24, 0.24, 0.24];
        
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

        this.initialized = false;
        this.ensureInitialized();
    }

    ensureInitialized() {
        if (this.initialized) return;

        // OCS & 9-Bit Farb-Parser
        const parseOcs = (val) => {
            let r = ((val >> 8) & 15) * 17;
            let g = ((val >> 4) & 15) * 17;
            let b = (val & 15) * 17;
            return rgbToHex(r, g, b);
        };

        const parse9Bit = (val) => {
            let r = ((val >> 8) & 7) * 36;
            let g = ((val >> 4) & 7) * 36;
            let b = (val & 7) * 36;
            return rgbToHex(r, g, b);
        };

        const parseC64 = (idx) => {
            let c = C64_PALETTE[idx];
            return rgbToHex(c[0], c[1], c[2]);
        };

        // --- C64 RASTERBAR SHADING TABLES (Strict VIC-II Palette) ---
        this.c64Palettes = [
            [6, 6, 11, 14, 14, 15, 1].map(parseC64),  // Blue Theme
            [9, 2, 2, 8, 10, 10, 1].map(parseC64),    // Red Theme
            [5, 5, 12, 13, 13, 15, 1].map(parseC64)   // Green Theme
        ];

        // --- AMIGA OCS COPPERLISTS (Concentric 12-Bit Shading) ---
        this.amigaPalettes = [
            [0x002, 0x003, 0x004, 0x006, 0x008, 0x00a, 0x00c, 0x00f, 0x25f, 0x6af, 0xfff].map(parseOcs), // Blue
            [0x200, 0x300, 0x500, 0x700, 0x900, 0xb00, 0xd00, 0xf00, 0xf40, 0xf80, 0xfff].map(parseOcs), // Red/Orange
            [0x101, 0x202, 0x404, 0x606, 0x808, 0xa0a, 0xc0c, 0xf0f, 0xf4f, 0xf8f, 0xfff].map(parseOcs), // Purple/Pink
            [0x010, 0x020, 0x040, 0x060, 0x080, 0x0a0, 0x0c0, 0x0f0, 0x4f4, 0x8f8, 0xfff].map(parseOcs)  // Green
        ];

        // --- ATARI ST HARD SHIFTER SHADING (Rigid 9-Bit Steps) ---
        this.atariPalettes = [
            [0x001, 0x002, 0x003, 0x004, 0x005, 0x006, 0x007, 0x337, 0x777].map(parse9Bit), // Blue
            [0x100, 0x200, 0x300, 0x410, 0x520, 0x630, 0x740, 0x760, 0x777].map(parse9Bit), // Orange/Gold
            [0x010, 0x020, 0x030, 0x040, 0x050, 0x060, 0x070, 0x373, 0x777].map(parse9Bit)  // Green
        ];

        this.initialized = true;
    }

    // Zeichnet eine rastergetreue, palettenbasierte Copperbar (Absolut Opak / Keine CPU-Garbages!)
    drawPalettedBar(ctx, w, yCenter, shadingTable, smoothVol, scanlineHeight) {
        let maxIdx = shadingTable.length - 1;
        
        // Dynamische Highlight-Modulation: 
        // Wenn die Musik leise ist, begrenzen wir den Index, sodass der weiße Kern schrumpft/verschwindet.
        let volumeScale = 0.5 + smoothVol * 0.5; 
        let activeMax = Math.floor(maxIdx * volumeScale);

        let halfHeight = maxIdx; // Ecken-Anzahl auf jeder Seite des Zentrums

        for (let dy = -halfHeight; dy <= halfHeight; dy++) {
            let dist = Math.abs(dy);
            
            // Ermittelt den Abstand vom Zentrum (0 ist Kante, maxIdx is Mitte)
            let lookup = maxIdx - dist;
            
            // Skaliert die Farbe dynamisch nach dem Lautstärke-Pegel
            let activeIdx = Math.floor(lookup * volumeScale);
            if (activeIdx > activeMax) activeIdx = activeMax;
            if (activeIdx < 0) activeIdx = 0;

            ctx.fillStyle = shadingTable[activeIdx];
            
            let drawY = Math.floor(yCenter + dy * scanlineHeight);
            ctx.fillRect(0, drawY, w, scanlineHeight);
        }
    }

    resize(width, height) {}

    render(ctx, width, height, t, state, stateTime, metrics) {
        this.ensureInitialized();

        if (state === 'idle') { this.lastT = t; return; }
        let dt = this.lastT === 0 ? 0.016 : t - this.lastT;
        this.lastT = t;

        const system = metrics.system;
        const numBars = system === 'amiga' ? 4 : 3; // Festgenagelt auf 3/4 pro HW-Kanal!
        
        let scanlineHeight = 1; // Unbestechlich scharfe 1-Pixel Rasterlines!

        let globalAlpha = 1.0;
        let targetSpeed = 1.0;
        let targetAmplitude = 0.85; 

        if (state === 'starting') {
            globalAlpha = Math.min(1.0, stateTime / 1.5);
            targetAmplitude = globalAlpha * 0.85; // Mechanischer Einblend-Kollaps
        } else if (state === 'stopping') {
            globalAlpha = Math.max(0.0, 1.0 - (stateTime / 1.5));
            targetAmplitude = globalAlpha * 0.85; // Mechanischer Ausblend-Kollaps
        } else if (state === 'buildup') {
            targetSpeed = 1.2; targetAmplitude = 0.95;            
        } else if (state === 'climax') {
            targetSpeed = 1.8; targetAmplitude = 1.1;           
        }

        // Schnelle Deaktivierung während des Ausblend-Kollapses
        if (globalAlpha <= 0.05) return;

        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * Math.min(1.0, dt * 5.0);
        this.smoothedAmplitude += (targetAmplitude - this.smoothedAmplitude) * Math.min(1.0, dt * 5.0);

        this.internalT += dt * this.smoothedSpeed;

        const baseSpeed = 0.55; 
        const phaseStep = (Math.PI * 2) / numBars; 

        // Aspect-ratio-sichere Schwingungsamplitude
        const amplitude = (height * 0.24) * this.smoothedAmplitude;

        for (let c = 0; c < numBars; c++) {
            const smoothVol = metrics.smooth[c]; 
            const angle = (this.internalT * baseSpeed) + (c * phaseStep);
            
            // --- 256-ENTRY SINE LUT LOOKUP ---
            // Gibt der Schwingung das leicht ruckelige, mechatronische Lauf-Gefühl
            let lutIdx = Math.floor((angle / (Math.PI * 2)) * 256) % 256;
            if (lutIdx < 0) lutIdx += 256;
            let sineVal = this.sinLUT[lutIdx];

            let yCenter = (height / 2);
            yCenter += sineVal * amplitude;
            
            // Beat-Glitched Twist im Climax
            if (state === 'climax') {
                let twistAngle = this.internalT * 6.0 + c * 2.0;
                let twistLutIdx = Math.floor((twistAngle / (Math.PI * 2)) * 256) % 256;
                if (twistLutIdx < 0) twistLutIdx += 256;
                yCenter += this.sinLUT[twistLutIdx] * (8.0 * metrics.beat[0]);
            }
            
            let bar = this.barsToDraw[c];
            bar.y = yCenter; 
            bar.vol = smoothVol; 
            
            // Z-Sortierung im LUT nachschlagen
            let cosAngle = angle + Math.PI * 0.5;
            let cosLutIdx = Math.floor((cosAngle / (Math.PI * 2)) * 256) % 256;
            if (cosLutIdx < 0) cosLutIdx += 256;
            bar.z = this.sinLUT[cosLutIdx]; 

            // Palette zuweisen
            if (system === 'c64') {
                bar.pal = this.c64Palettes[c % 3];
            } else if (system === 'amiga') {
                bar.pal = this.amigaPalettes[c % 4];
            } else {
                bar.pal = this.atariPalettes[c % 3];
            }
        }

        // Z-Buffer sortieren (Painter's Algorithm)
        for (let i = 0; i < numBars; i++) this.sortedBars[i] = this.barsToDraw[i];
        for (let i = 0; i < numBars - 1; i++) {
            for (let j = 0; j < numBars - i - 1; j++) {
                if (this.sortedBars[j].z > this.sortedBars[j + 1].z) {
                    let temp = this.sortedBars[j]; 
                    this.sortedBars[j] = this.sortedBars[j + 1]; 
                    this.sortedBars[j + 1] = temp;
                }
            }
        }

        // Zeichnen der sortierten, hardware-getreuen Rasterbars
        for (let i = 0; i < numBars; i++) {
            let bar = this.sortedBars[i];
            
            // --- 100% HARDWARE-GETREUES RASTER-GATE ---
            // Ist ein Soundkanal stumm, wird die zugehörige Bar einfach hart abgeschaltet (nicht gezeichnet).
            // Das spart massig CPU/GPU-Zyklen und ist zu 100% geschichtstreu!
            if (bar.vol < 0.04) continue; 
            
            this.drawPalettedBar(ctx, width, bar.y, bar.pal, bar.vol, scanlineHeight);
        }
    }
}