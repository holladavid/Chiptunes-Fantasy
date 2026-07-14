// === js/visuals/dse/atari/dot-torus.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: ATARI ST 3D DOT TORUS
// A tribute to "The Lost Boys" and "Delta Force" 68000 CPU math.
// Fast point-plotting 3D object with strict 9-bit depth shading.
// Fixed: Linear FOV projection and responsive dot-sizing!
// =========================================================

import { quantizeAtari9Bit, rgbToHex } from '../../../visuals/utils/hardware-constraints.js';

export class AtariDotTorus {
    constructor() {
        this.name = 'Atari Dot Torus';
        this.computerType = ['atari'];
        this.placementType = 'foreground';
        
        // Etwas höhere Dichte für bildschirmfüllende Displays
        this.uSteps = 42; 
        this.vSteps = 16; 
        this.numDots = this.uSteps * this.vSteps;
        
        // Konstante Parameter der Form
        this.radiusMain = 1.0; 
        
        // Base Arrays (Zero Allocation)
        this.dots = Array(this.numDots).fill(null).map(() => ({ u: 0, v: 0, x: 0, y: 0, z: 0, colorPhase: 0 }));
        this.projected = Array(this.numDots).fill(null).map(() => ({ x: 0, y: 0, z: 0, colorPhase: 0 }));

        let idx = 0;
        for (let i = 0; i < this.uSteps; i++) {
            let u = (i / this.uSteps) * Math.PI * 2;
            for (let j = 0; j < this.vSteps; j++) {
                let v = (j / this.vSteps) * Math.PI * 2;
                this.dots[idx].u = u;
                this.dots[idx].v = v;
                // colorPhase ist ein Wert von 0.0 bis 1.0 entlang des Rings
                this.dots[idx].colorPhase = i / this.uSteps;
                idx++;
            }
        }

        this.internalT = 0;
        this.smoothedSpeed = 1.0;
        this.smoothedTubeRadius = 0.35; // Röhrendicke
        this.lastT = 0;
    }

    resize(width, height) {}

    render(ctx, width, height, t, state, stateTime, metrics) {
        if (state === 'idle') { this.lastT = t; return; }
        
        let dt = this.lastT === 0 ? 0.016 : t - this.lastT;
        this.lastT = t;

        let globalAlpha = 1.0;
        let targetSpeed = 1.0;
        let targetTubeRadius = 0.35; 

        // --- MAKRO-DYNAMIK (Tension States) ---
        if (state === 'starting') {
            globalAlpha = Math.min(1.0, stateTime / 1.5);
        } else if (state === 'stopping') {
            globalAlpha = Math.max(0.0, 1.0 - (stateTime / 1.5));
        } else if (state === 'buildup') {
            targetSpeed = 1.8;
            targetTubeRadius = 0.55; // Röhre wird fetter
        } else if (state === 'climax') {
            targetSpeed = 3.2; 
            // Der Donut pumpt wild zwischen dünn und fett hin und her!
            targetTubeRadius = 0.45 + Math.sin(this.internalT * 5.0) * 0.25; 
        }

        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * Math.min(1.0, dt * 4.0);
        this.smoothedTubeRadius += (targetTubeRadius - this.smoothedTubeRadius) * Math.min(1.0, dt * 6.0);
        this.internalT += dt * this.smoothedSpeed;

        const beat = metrics.beat[0];
        
        // --- MICRO-DYNAMIK (Beat) ---
        // Leichte, federnde Vergrößerung beim Takt & Illumination
        const beatScale = 1.0 + (beat * 0.12);
        const illumination = beat * 0.45; 

        // --- BERECHNUNG & PROJEKTION ---
        const minDim = Math.min(width, height);
        const cx = Math.floor(width / 2);
        const cy = Math.floor(height / 2);
        
        // GFX FIX: Saubere, lineare Skalierung!
        const fov = minDim * 1.2 * beatScale;

        const rotX = this.internalT * 1.1;
        const rotY = this.internalT * 1.5;
        const rotZ = this.internalT * 0.4;

        const sinX = Math.sin(rotX), cosX = Math.cos(rotX);
        const sinY = Math.sin(rotY), cosY = Math.cos(rotY);
        const sinZ = Math.sin(rotZ), cosZ = Math.cos(rotZ);

        // GFX FIX: Dynamische Punktgröße je nach Retina/Bildschirm-Auflösung
        const baseDotSize = Math.max(2, Math.floor(minDim * 0.005));

        for (let i = 0; i < this.numDots; i++) {
            let dot = this.dots[i];
            
            // 1. Torus-Gleichung (Lokaler 3D-Raum)
            let baseR = this.radiusMain + this.smoothedTubeRadius * Math.cos(dot.v);
            let lx = baseR * Math.cos(dot.u);
            let ly = baseR * Math.sin(dot.u);
            let lz = this.smoothedTubeRadius * Math.sin(dot.v);

            // 2. 3D-Matrix Rotation
            let y1 = ly * cosX - lz * sinX;
            let z1 = ly * sinX + lz * cosX;
            
            let x2 = lx * cosY + z1 * sinY;
            let z2 = -lx * sinY + z1 * cosY;
            
            let x3 = x2 * cosZ - y1 * sinZ;
            let y3 = x2 * sinZ + y1 * cosZ;

            // Tiefe hinzufügen
            let zOff = z2 + 3.5;

            // 3. Projektion (Der fehlerhafte double-scale Multiplikator wurde entfernt!)
            let p = this.projected[i];
            p.x = Math.floor(cx + (x3 * fov) / zOff);
            p.y = Math.floor(cy + (y3 * fov) / zOff);
            p.z = zOff;
            p.colorPhase = dot.colorPhase;
        }

        // Z-Sorting (Depth-Shading)
        this.projected.sort((a, b) => b.z - a.z);

        ctx.globalAlpha = globalAlpha;

        // RENDERING
        for (let i = 0; i < this.numDots; i++) {
            let p = this.projected[i];

            let depthNorm = 0.30 + 0.70 * Math.max(0.0, Math.min(1.0, (5.0 - p.z) / 3.0));
            let brightness = depthNorm + illumination;

            // Color-Cycling
            let cycle = (p.colorPhase + this.internalT * 0.2) % 1.0;
            
            let baseR = Math.sin(cycle * Math.PI * 2) * 80 + 175;
            let baseG = 140;
            let baseB = Math.cos(cycle * Math.PI * 2) * 80 + 175;

            // Helligkeit anwenden
            let r = Math.min(255, Math.floor(baseR * brightness));
            let g = Math.min(255, Math.floor(baseG * brightness));
            let b = Math.min(255, Math.floor(baseB * brightness));

            // STRICT 9-BIT ATARI QUANTIZATION
            let qColor = quantizeAtari9Bit(r, g, b);
            
            ctx.fillStyle = rgbToHex(qColor[0], qColor[1], qColor[2]);
            
            // Viskose Pixelgröße (Vordere Punkte werfen sich etwas dicker auf)
            let dotSize = p.z < 3.2 ? baseDotSize + 1 : baseDotSize; 
            
            ctx.fillRect(p.x, p.y, dotSize, dotSize);
        }

        ctx.globalAlpha = 1.0;
    }
}