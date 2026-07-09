// === js/visuals/dse/c64/chunky-plasma.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: C64 CHUNKY PETSCII PLASMA
// Authentic 16-Color VIC-II hardware palette indexing,
// chunky block rendering, and fluid Beat-reactive Color-Cycling.
// =========================================================

import { C64_PALETTE, rgbToHex } from '../../utils/hardware-constraints.js';

export class ChunkyPlasma {
    constructor() {
        this.name = 'C64 Chunky Plasma';
        this.blockSize = 8; 
        
        // Sanfter, authentischer Hitze-Verlauf der C64 Palette
        const colorIndices = [6, 4, 2, 10, 8, 7, 1, 7, 8, 10, 2, 4];
        this.hexCache = colorIndices.map(idx => rgbToHex(...C64_PALETTE[idx]));
        this.numColors = this.hexCache.length;

        this.internalT = 0;
        this.smoothedSpeed = 1.0;
        this.colorCyclePhase = 0.0; // NEU: Kontinuierlicher Paletten-Schub
        this.lastT = 0;
    }

    resize(width, height) {}

    render(ctx, width, height, t, state, stateTime, metrics) {
        if (state === 'idle') { this.lastT = t; return; }
        
        let dt = this.lastT === 0 ? 0.016 : t - this.lastT;
        this.lastT = t;

        let globalAlpha = 1.0;
        let targetSpeed = 1.0;
        let cycleSpeed = 2.0;    // Basisgeschwindigkeit des Color-Cyclings
        let beatPulse = 0.0;     // Geometrisches "Atmen" der Wellen

        // --- State-Machine Steuerung ---
        if (state === 'starting') {
            globalAlpha = Math.min(1.0, stateTime / 1.5);
        } else if (state === 'stopping') {
            globalAlpha = Math.max(0.0, 1.0 - (stateTime / 1.5));
        } else if (state === 'buildup') {
            targetSpeed = 1.5;             
            cycleSpeed = 6.0;     
            beatPulse = 0.15;
        } else if (state === 'climax') {
            targetSpeed = 2.5; 
            cycleSpeed = 15.0; 
            beatPulse = 0.45; // Stärkeres Pumpen beim Drop
        }

        // Glättung der Bewegungsgeschwindigkeit
        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * Math.min(1.0, dt * 4.0);
        this.internalT += dt * this.smoothedSpeed;
        
        // --- FIX: KONTROLLIERTES COLOR-CYCLING ---
        // Statt hart zu flackern, schiebt der Beat die Farbpalette flüssig nach vorne
        this.colorCyclePhase += (cycleSpeed + metrics.beat[0] * cycleSpeed * 2.0) * dt;

        ctx.globalAlpha = globalAlpha;

        const cols = Math.ceil(width / this.blockSize);
        const rows = Math.ceil(height / this.blockSize);

        // --- FIX: MOBILE VIEW CROP PREVENTION ---
        // Ist die Breite kleiner als 280px (Mobile), stauchen wir die mathematischen Koordinaten.
        // Das Plasma "zoomt" heraus, sodass man immer die volle Pracht der Wellen sieht!
        const aspectZoom = Math.max(1.0, 280 / width); 
        const coordScale = 0.15 * aspectZoom;

        // --- FIX: GEOMETRY PUMP ---
        // Die Wellen ziehen sich beim Beat minimal zusammen (Zoom-Bounce)
        const activePulse = 1.0 - (metrics.beat[0] * beatPulse);

        // Vorberechnung der X-Wellen
        const sinX1 = new Float32Array(cols);
        const sinX2 = new Float32Array(cols);
        for (let x = 0; x < cols; x++) {
            let realX = x * coordScale * activePulse;
            sinX1[x] = Math.sin(realX + this.internalT * 0.8);
            sinX2[x] = Math.sin(realX * 0.5 + this.internalT * 1.5);
        }

        const timeY = this.internalT * 1.2;
        const cycleOffset = Math.floor(this.colorCyclePhase);

        for (let y = 0; y < rows; y++) {
            let realY = y * coordScale * activePulse;
            let sinY1 = Math.sin(realY + timeY);
            let sinY2 = Math.sin(realY * 0.8 - timeY * 0.5);

            for (let x = 0; x < cols; x++) {
                let v = sinX1[x] + sinY1 + Math.sin(sinX2[x] + sinY2);
                
                // Ring-Interferenz
                let dist = Math.sqrt((x - cols / 2) ** 2 + (y - rows / 2) ** 2) * coordScale;
                v += Math.sin(dist * 1.5 - this.internalT * 2.0);

                // Mapping auf die Palette (0 bis numColors) + flüssiger Shift
                let colorIdx = Math.floor((v + 4.0) * 1.5) + cycleOffset;
                colorIdx = ((colorIdx % this.numColors) + this.numColors) % this.numColors;

                ctx.fillStyle = this.hexCache[colorIdx];
                ctx.fillRect(x * this.blockSize, y * this.blockSize, this.blockSize, this.blockSize);
            }
        }
        
        ctx.globalAlpha = 1.0;
    }
}