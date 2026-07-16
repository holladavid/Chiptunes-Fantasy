// === js/visuals/dse/atari/dot-torus.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: ATARI ST 3D DOT TORUS (v2.0.1 - Bugfree)
// 100% Sinus-LUT-driven, zero floating-point trig inside render.
// Strictly unsorted pixel chaos with mechanical Shifter Palette Cycling.
// =========================================================

import { quantizeAtari9Bit, rgbToHex } from '../../utils/hardware-constraints.js';

export class AtariDotTorus {
    constructor() {
        this.name = 'Atari Dot Torus';
        this.computerType = ['atari'];
        this.placementType = 'foreground';
        
        // --- 1. RESOLUTIONS & DENSITY REDUCTION ---
        // Reduziert von 672 auf exakt 320 Punkte für mehr Transparenz (ST-typisch)
        this.uSteps = 32; 
        this.vSteps = 10; 
        this.numDots = this.uSteps * this.vSteps;
        
        // Feste Geometrie (Kein unruhiges Pumping)
        this.radiusMain = 1.0; 
        this.tubeRadius = 0.38; 

        // State-Maschine & Choreographie (Deterministisch, no Math.random)
        this.beatIndex = 0;
        this.wasBeat = false;
        
        this.currentScale = 1.0;
        this.targetScale = 1.0;
        this.beatZooms = [1.0, 1.35, 0.75, 1.0, 1.25, 0.85]; // Harte Zoom-Patterns

        this.speedX = 1.0;
        this.speedY = 1.4;
        this.speedZ = 0.6;

        // Ganzzahlige LUT-Akkumulatoren (Keine float-basierten Bogenmaße!)
        this.rotX = 0;
        this.rotY = 0;
        this.rotZ = 0;

        this.colorCycleTimer = 0; // Gekapselter Animationstimer (Zero Allocation)
        this.lastT = 0;
        this.initialized = false;
        
        // Pre-allocated Arrays
        this.dots = [];
        this.projected = Array(this.numDots).fill(null).map(() => ({ x: 0, y: 0, colorIdx: 0 }));

        this.ensureInitialized();
    }

    ensureInitialized() {
        if (this.initialized) return;

        // --- 2. 256-ENTRY SINE LOOKUP TABLE (LUT) ---
        // Generiert die unbestechliche Integer-Sinuswelle für echte Fixed-Point-Ungenauigkeiten
        this.sinLUT = new Float32Array(256);
        this.cosLUT = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
            let angle = (i / 256) * Math.PI * 2;
            this.sinLUT[i] = Math.sin(angle);
            this.cosLUT[i] = Math.cos(angle);
        }

        // --- 3. ATARI SHIFTER CYCLING PALETTE ---
        this.palette = [
            [0, 0, 68],      // 0: Tiefblau (Dunkelster Rand)
            [0, 0, 136],     // 1: Royal-Blau
            [68, 0, 136],    // 2: Indigo
            [136, 0, 136],   // 3: Magenta
            [204, 0, 136],   // 4: Hell-Magenta
            [255, 0, 102],   // 5: Hot Pink
            [255, 68, 0],    // 6: Deep Orange
            [255, 136, 0],   // 7: Gold/Orange
            [255, 204, 0],   // 8: Gelb-Orange
            [255, 255, 102], // 9: Hellgelb
            [255, 255, 255], // 10: Weiß (Core-Hotspot)
            [255, 255, 102], // 11: Hellgelb
            [255, 170, 0],   // 12: Orange
            [204, 34, 102],  // 13: Pink
            [102, 0, 102],   // 14: Dunkelviolett
            [0, 0, 102]      // 15: Tiefblau
        ].map(c => rgbToHex(...quantizeAtari9Bit(c[0], c[1], c[2])));

        this.paletteOffset = 0;

        // 4. Dot-Setup auf Basis von LUT-Indizes (0-255)
        for (let i = 0; i < this.uSteps; i++) {
            let uIdx = Math.floor((i / this.uSteps) * 256);
            for (let j = 0; j < this.vSteps; j++) {
                let vIdx = Math.floor((j / this.vSteps) * 256);
                
                this.dots.push({
                    u: uIdx,
                    v: vIdx,
                    colorIdx: Math.floor((i / this.uSteps) * 16) // Mappt die Farbringe auf die Palette
                });
            }
        }

        this.initialized = true;
    }

    resize(width, height) {}

    render(ctx, width, height, t, state, stateTime, metrics) {
        if (state === 'idle') { this.lastT = t; return; }
        let dt = this.lastT === 0 ? 0.016 : t - this.lastT;
        this.lastT = t;

        this.resize(width, height);

        // Transition Fades sicher berechnen
        let globalAlpha = 1.0;
        if (state === 'starting') {
            globalAlpha = Math.min(1.0, stateTime / 1.5);
        } else if (state === 'stopping') {
            globalAlpha = Math.max(0.0, 1.0 - (stateTime / 1.5));
        }

        // =========================================================
        // 5. BEAT CHOREOGRAPHY (Snappy state-jumps)
        // =========================================================
        const beat = metrics.beat[0];
        const isBeat = beat > 0.8 && !this.wasBeat;
        this.wasBeat = (beat > 0.8);

        if (isBeat) {
            this.beatIndex++;
            
            // Zoom Pattern sprunghaft wechseln
            let zoomIdx = this.beatIndex % this.beatZooms.length;
            this.targetScale = this.beatZooms[zoomIdx];

            // Frequenz-Inversionen (Snappy Invertierung der Rotation)
            if (this.beatIndex % 2 === 0) this.speedX *= -1;
            else this.speedY *= -1;

            // Palette rasant um +4 Shifter-Indizes verschieben
            this.paletteOffset = (this.paletteOffset + 4) % 16;
        }

        // Weicher mechanischer Zoom-Glide
        this.currentScale += (this.targetScale - this.currentScale) * 0.12;

        // Kontinuierliches Palette-Cycling im Hintergrund (verlangsamt auf jeden 6. Frame)
        this.colorCycleTimer++;
        if (this.colorCycleTimer % 6 === 0) {
            this.paletteOffset = (this.paletteOffset + 1) % 16;
        }

        // Accumulate integer indices (0-255) based on 60Hz delta time
        this.rotX = (this.rotX + Math.floor(dt * 60 * this.speedX)) & 255;
        this.rotY = (this.rotY + Math.floor(dt * 60 * this.speedY)) & 255;
        this.rotZ = (this.rotZ + Math.floor(dt * 60 * this.speedZ)) & 255;

        // LUT-Trig abgreifen
        const sinX = this.sinLUT[this.rotX], cosX = this.cosLUT[this.rotX];
        const sinY = this.sinLUT[this.rotY], cosY = this.cosLUT[this.rotY];
        const sinZ = this.sinLUT[this.rotZ], cosZ = this.cosLUT[this.rotZ];

        const cx = Math.floor(width / 2);
        const cy = Math.floor(height / 2);
        const minDim = Math.min(width, height);
        
        // Symmetrisch skaliertes FOV
        const fov = minDim * 0.95;

        // =========================================================
        // 6. GEOMETRY LOOP WITH SINE-LUT (No floating-point sin/cos!)
        // =========================================================
        for (let i = 0; i < this.numDots; i++) {
            let dot = this.dots[i];
            
            // 6a. Torus-Trig via LUT
            let cosV = this.cosLUT[dot.v];
            let sinV = this.sinLUT[dot.v];
            let cosU = this.cosLUT[dot.u];
            let sinU = this.sinLUT[dot.u];

            let baseR = this.radiusMain + this.tubeRadius * cosV;
            let lx = baseR * cosU;
            let ly = baseR * sinU;
            let lz = this.tubeRadius * sinV;

            // 6b. 3D-Rotation Matrix
            let y1 = ly * cosX - lz * sinX;
            let z1 = ly * sinX + lz * cosX;
            
            let x2 = lx * cosY + z1 * sinY;
            let z2 = -lx * sinY + z1 * cosY;
            
            let x3 = x2 * cosZ - y1 * sinZ;
            let y3 = x2 * sinZ + y1 * cosZ;

            let zOff = z2 + 3.5;

            // 6c. Lineare Projektion (Math.floor eliminiert AA)
            let p = this.projected[i];
            p.x = Math.floor(cx + (x3 * fov) / zOff * this.currentScale);
            p.y = Math.floor(cy + (y3 * fov) / zOff * this.currentScale);
            p.colorIdx = dot.colorIdx;
        }

        // =========================================================
        // 7. RENDER (No sorting! Pure raw pixel chaos)
        // =========================================================
        ctx.globalAlpha = globalAlpha;

        for (let i = 0; i < this.numDots; i++) {
            let p = this.projected[i];

            // Shifter-Index mit Offset verknüpfen
            let colorIdx = (p.colorIdx + this.paletteOffset) % 16;
            ctx.fillStyle = this.palette[colorIdx];
            
            // Feste ST-Punktgröße: messerscharfe 2x2 Blöcke!
            ctx.fillRect(p.x, p.y, 2, 2);
        }

        ctx.globalAlpha = 1.0;
    }
}