// === js/visuals/dse/atari/lissajous-bobs.js ===
// =========================================================
// CLASSIC ATARI ST METAL-BOB CHAIN (v4.0.0 - 100% Bare-Metal)
// No Alpha. No modern Trails. Pure masked software sprites
// rendered directly on top of the redrawn 16-bit background.
// =========================================================

import { quantizeAtari9Bit, rgbToHex } from '../../utils/hardware-constraints.js';

export class AtariBobs {
    constructor() {
        this.name = 'Atari Lissajous Bobs'; 
        this.computerType = ['atari']; 
        this.placementType = 'foreground';
        
        this.numBobs = 48; // Klassische Atari-Größe
        this.bobSize = 16; 

        // Sprite-Buffer für die Onion-Layers (Maskiertes Software-Sprite)
        this.bobCanvas = document.createElement('canvas'); 
        this.bobCanvas.width = this.bobSize; 
        this.bobCanvas.height = this.bobSize;

        // Choreographie-States (Snappy "Klick" Jumps)
        this.states = [
            { ratioX: 2, ratioY: 3, scale: 0.9,  mirror: 0, palette: 'green' },   // 2:3 Classic Star
            { ratioX: 1, ratioY: 1, scale: 1.1,  mirror: 0, palette: 'cyan' },    // 1:1 Circle
            { ratioX: 1, ratioY: 2, scale: 0.9,  mirror: 1, palette: 'magenta' }, // 1:2 DNA Helix (Mirror X)
            { ratioX: 5, ratioY: 4, scale: 0.7,  mirror: 0, palette: 'gold' },    // 5:4 Compact Knot
            { ratioX: 3, ratioY: 4, scale: 1.0,  mirror: 2, palette: 'green' },   // 3:4 Mirror Y
            { ratioX: 0, ratioY: 0, scale: 0.85, mirror: 3, palette: 'magenta' }  // Dispersal/Explosion (Mirror XY)
        ];

        this.stateIndex = 0;
        this.beatCounter = 0;
        this.wasBeat = false;
        this.rotDirection = 1;
        this.angleZ = 0.0;
        this.lastT = 0;
        
        // Kinetik-Akkumulatoren
        this.internalT = 0.0;
        this.waterT = 0.0;
        this.smoothedSpeed = 1.0;

        // Diskrete Phasen-Tabelle (LUT) für stufiges, mechanisches Ruckeln
        this.phaseLUT = new Float32Array(this.numBobs);
        for (let i = 0; i < this.numBobs; i++) {
            this.phaseLUT[i] = Math.round(Math.sin((i / this.numBobs) * Math.PI * 2) * 4) * 0.25;
        }

        this.initialized = false;
        this.ensureInitialized();
    }

    ensureInitialized() {
        if (this.initialized) return;

        // --- STRICT ATARI ST 9-BIT PALETTEN (Concentric Ring Shading) ---
        this.palettes = {
            green: [
                rgbToHex(...quantizeAtari9Bit(0, 51, 0)),     // Dunkelgrün
                rgbToHex(...quantizeAtari9Bit(0, 136, 0)),    // Mittelgrün
                rgbToHex(...quantizeAtari9Bit(102, 255, 102)),// Hellgrün
                rgbToHex(...quantizeAtari9Bit(255, 255, 255)) // Weiß
            ],
            cyan: [
                rgbToHex(...quantizeAtari9Bit(0, 51, 102)),
                rgbToHex(...quantizeAtari9Bit(0, 136, 170)),
                rgbToHex(...quantizeAtari9Bit(102, 219, 255)),
                rgbToHex(...quantizeAtari9Bit(255, 255, 255))
            ],
            magenta: [
                rgbToHex(...quantizeAtari9Bit(51, 0, 51)),
                rgbToHex(...quantizeAtari9Bit(136, 0, 136)),
                rgbToHex(...quantizeAtari9Bit(255, 102, 255)),
                rgbToHex(...quantizeAtari9Bit(255, 255, 255))
            ],
            gold: [
                rgbToHex(...quantizeAtari9Bit(68, 17, 0)),
                rgbToHex(...quantizeAtari9Bit(170, 85, 0)),
                rgbToHex(...quantizeAtari9Bit(255, 187, 0)),
                rgbToHex(...quantizeAtari9Bit(255, 255, 255))
            ]
        };

        this.rebuildBobSprite();
        this.initialized = true;
    }

    // Zeichnet das knallharte Zwiebel-Bob-Sprite mit konzentrischen Ringen
    rebuildBobSprite() {
        const bCtx = this.bobCanvas.getContext('2d');
        bCtx.clearRect(0, 0, this.bobSize, this.bobSize);
        const cx = this.bobSize / 2;
        const cy = this.bobSize / 2;

        const activePalette = this.palettes[this.states[this.stateIndex].palette];
        const radii = [8, 6, 4, 2];

        // Harte onion layers zeichnen
        for (let i = 0; i < 4; i++) {
            bCtx.fillStyle = activePalette[i];
            bCtx.beginPath();
            bCtx.arc(cx, cy, radii[i], 0, Math.PI * 2);
            bCtx.fill();
        }

        // Glanzpunkt (Specular highlight dot)
        bCtx.fillStyle = '#ffffff';
        bCtx.fillRect(cx - 2, cy - 2, 1, 1);
    }

    resize(width, height) {}

    render(ctx, width, height, t, state, stateTime, metrics) {
        if (state === 'idle') { this.lastT = t; return; }
        let dt = this.lastT === 0 ? 0.016 : t - this.lastT;
        this.lastT = t;

        // =========================================================
        // TENSION & BEAT-KINETIK (Integrierter Spannungsaufbau)
        // =========================================================
        const beat = metrics.beat[0];
        const tension = metrics.tensionPct || 0.0; 
        const isBeat = beat > 0.8 && !this.wasBeat;
        this.wasBeat = (beat > 0.8);

        if (isBeat) {
            this.beatCounter++;
            
            // Alle 8 Beats: Musterhart tauschen!
            if (this.beatCounter % 8 === 0) {
                this.stateIndex = (this.stateIndex + 1) % this.states.length;
                this.rebuildBobSprite();
            }

            // Alle 4 Beats: Richtung der Z-Rotation umdrehen!
            if (this.beatCounter % 4 === 0) {
                this.rotDirection *= -1;
            }
        }

        const activeState = this.states[this.stateIndex];

        // Z-Rotation akkumulieren
        // CLIMAX EVENT: Die Rotationsgeschwindigkeit verfünffacht sich schlagartig im Drop!
        const rotBaseSpeed = (state === 'climax') ? 0.95 : 0.18;
        this.angleZ += dt * rotBaseSpeed * this.rotDirection;

        // Kinetik-Akkumulator: Das Tension-Level treibt das Morphing-Tempo bei Drops an!
        const tensionSpeedMultiplier = 1.0 + (tension * 1.2); 
        this.internalT += dt * this.smoothedSpeed * tensionSpeedMultiplier;
        this.waterT += dt * this.smoothedSpeed;

        // Koordinatenmitte
        const cx = width / 2;
        const cy = height / 2;
        const minDim = Math.min(width, height);

        // Mathematisch festgezurrte Skalierungen
        const radiusX = (minDim * 0.38) * activeState.scale;
        const radiusY = (minDim * 0.28) * activeState.scale;

        const phaseStep = (Math.PI * 2) / this.numBobs;

        // --- COORDINATE TRANSFORMATION & RENDER ---
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(this.angleZ);

        for (let i = 0; i < this.numBobs; i++) {
            // LUT-basierter Phasen-Warp
            const phase = i * phaseStep + this.phaseLUT[i] * (1.0 + beat * 2.0);

            let x = 0;
            let y = 0;

            if (activeState.ratioX === 0) {
                // EXPLOSION STATE (Bobs stieben radial auseinander)
                let explodeOffset = 25 + Math.sin(t * 12.0) * (minDim * 0.3);
                x = Math.sin(phase) * explodeOffset;
                y = Math.cos(phase) * explodeOffset;
            } else {
                // DETERMINISTIC INTEGER LISSAJOUS
                x = Math.sin(this.internalT * activeState.ratioX + phase) * radiusX;
                y = Math.sin(this.internalT * activeState.ratioY + phase) * Math.cos(this.internalT * 0.5 + phase) * radiusY;
            }

            // CLIMAX EVENT: Spiegelungs-Mayhem zuckt wild bei jedem Beat!
            let activeMirror = activeState.mirror;
            if (state === 'climax') {
                activeMirror = this.beatCounter % 4; // Toggles on every beat!
            }

            if (activeMirror === 1) x = -Math.abs(x);       // Mirror X
            if (activeMirror === 2) y = -Math.abs(y);       // Mirror Y
            if (activeMirror === 3) { x = -Math.abs(x); y = -Math.abs(y); } // Mirror XY

            // Direkt auf das Haupt-Canvas blitten (Maskiertes Software-Sprite)
            ctx.drawImage(
                this.bobCanvas, 
                Math.floor(x - this.bobSize / 2), 
                Math.floor(y - this.bobSize / 2), 
                this.bobSize, 
                this.bobSize
            );
        }
        ctx.restore();
    }
}