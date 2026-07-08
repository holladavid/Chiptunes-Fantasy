// === js/visuals/dse/c64/chunky-plasma.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: C64 CHUNKY PETSCII PLASMA
// Authentic 16-Color VIC-II hardware palette indexing,
// chunky block rendering, and Beat-reactive Color-Cycling.
// =========================================================

import { C64_PALETTE, rgbToHex } from '../../utils/hardware-constraints.js';

export class ChunkyPlasma {
    constructor() {
        this.name = 'C64 Chunky Plasma';
        
        // Die Blockgröße simuliert die grobe Multicolor-Auflösung des C64
        this.blockSize = 8; 
        
        // Wir definieren einen "Hot"-Farbverlauf als geschlossenen Ring (Color Cycling)
        // 6: Dunkelblau, 4: Lila, 2: Rot, 10: Hellrot, 8: Orange, 7: Gelb, 1: Weiß
        const colorIndices = [6, 4, 2, 10, 8, 7, 1, 7, 8, 10, 2, 4];
        
        // Caching der vorberechneten Hex-Werte (Vermeidet Alloziierungen im Hot-Path)
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

        let globalAlpha = 1.0;
        let targetSpeed = 1.0;
        let beatShiftMultiplier = 0.0;

        // --- State-Machine Steuerung (Makro-Dynamik) ---
        if (state === 'starting') {
            globalAlpha = Math.min(1.0, stateTime / 1.5);
        } else if (state === 'stopping') {
            globalAlpha = Math.max(0.0, 1.0 - (stateTime / 1.5));
        } else if (state === 'buildup') {
            targetSpeed = 1.5;             
            beatShiftMultiplier = 1.0;     
        } else if (state === 'climax') {
            targetSpeed = 3.5; // Die Formel kocht regelrecht
            beatShiftMultiplier = 6.0; // Hartes Color-Cycling auf der Kick-Drum
        }

        // Kontinuierliche Glättung der Geschwindigkeit
        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * Math.min(1.0, dt * 4.0);
        this.internalT += dt * this.smoothedSpeed;

        // --- Micro-Dynamik: Paletten-Rotation ---
        // Wenn die Kickdrum schlägt (beat > 0), verschieben wir den Start-Index der Palette.
        // Das ergibt den klassischen Demoscene Color-Cycling Effekt (Strobe).
        const beatOffset = Math.floor(metrics.beat[0] * beatShiftMultiplier);

        ctx.globalAlpha = globalAlpha;

        const cols = Math.ceil(width / this.blockSize);
        const rows = Math.ceil(height / this.blockSize);

        // Vorberechnung der Sinus-Wellen für die X-Achse (Optimierung)
        const sinX1 = new Float32Array(cols);
        const sinX2 = new Float32Array(cols);
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
                // Kombinierte Plasma-Gleichung (Summe von Sinus-Wellen)
                // Range liegt ungefähr zwischen -4.0 und +4.0
                let v = sinX1[x] + sinY1 + Math.sin(sinX2[x] + sinY2);
                
                // Einen kreisförmigen Interference-Ring hinzufügen
                let dist = Math.sqrt((x - cols / 2) ** 2 + (y - rows / 2) ** 2);
                v += Math.sin(dist * 0.15 - this.internalT * 2.0);

                // Mapping auf die zyklische Palette [0 bis numColors-1]
                let colorIdx = Math.floor((v + 4.0) * 1.5) + beatOffset;
                
                // Wrap-around modulo (JavaScript % kann negativ sein, daher extra Absicherung)
                colorIdx = ((colorIdx % this.numColors) + this.numColors) % this.numColors;

                ctx.fillStyle = this.hexCache[colorIdx];
                ctx.fillRect(x * this.blockSize, y * this.blockSize, this.blockSize, this.blockSize);
            }
        }
        
        ctx.globalAlpha = 1.0;
    }
}