// === js/visuals/dse/atari/wireframe-morph.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: ATARI 3D WIREFRAME MORPH
// CPU-Math Tribute. Morphs a Box into a 3D Star.
// Strict 9-Bit Shifter Colors, no Anti-Aliasing/Glow hacks.
// =========================================================

import { quantizeAtari9Bit, rgbToHex, drawAliasedLine } from '../../utils/hardware-constraints.js';

export class WireframeMorph {
    constructor() {
        this.name = 'Atari Wireframe Morph';
        
        // 14 Vertices: 8 Würfel-Ecken (0-7) + 6 Flächen-Zentren / Stern-Spitzen (8-13)
        this.baseCorners = [
            [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1],
            [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1]
        ];
        this.baseTips = [
            [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]
        ];
        
        // 24 Kanten: Verbinden die Spitzen mit den Ecken der jeweiligen Achse
        this.edges = [
            [8,0], [8,1], [8,2], [8,3],       // +X Spitze
            [9,4], [9,5], [9,6], [9,7],       // -X Spitze
            [10,0], [10,1], [10,4], [10,5],   // +Y Spitze
            [11,2], [11,3], [11,6], [11,7],   // -Y Spitze
            [12,0], [12,2], [12,4], [12,6],   // +Z Spitze
            [13,1], [13,3], [13,5], [13,7]    // -Z Spitze
        ];

        // Pre-allocated Arrays für kontinuierliche Berechnungen (Zero Allocation)
        this.vertices = Array(14).fill(null).map(() => ({x: 0, y: 0, z: 0}));
        this.projected = Array(14).fill(null).map(() => ({x: 0, y: 0}));

        this.internalT = 0;
        this.smoothedSpeed = 1.0;
        this.smoothedMorph = 0.0;
        this.lastT = 0;
    }

    resize(width, height) {}

    render(ctx, width, height, t, state, stateTime, metrics) {
        if (state === 'idle') { this.lastT = t; return; }
        
        let dt = this.lastT === 0 ? 0.016 : t - this.lastT;
        this.lastT = t;

        let globalAlpha = 1.0;
        let targetSpeed = 1.0;
        let targetMorph = 0.0; // 0.0 = Würfel, 1.0 = Stern
        let beatScale = 0.0;

        // --- State-Machine Steuerung (Makro-Dynamik) ---
        if (state === 'starting') {
            globalAlpha = Math.min(1.0, stateTime / 1.5);
        } else if (state === 'stopping') {
            globalAlpha = Math.max(0.0, 1.0 - (stateTime / 1.5));
        } else if (state === 'buildup') {
            targetSpeed = 1.8;
            // Morph pendelt wild zwischen Würfel und Stern!
            targetMorph = (Math.sin(this.internalT * 3.0) * 0.5) + 0.5; 
            beatScale = 0.1;
        } else if (state === 'climax') {
            targetSpeed = 3.5;
            targetMorph = 1.0; // Hart in der Stern-Form eingerastet
            beatScale = 0.35;  // Massives Pumpen zur Kickdrum!
        }

        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * Math.min(1.0, dt * 5.0);
        this.smoothedMorph += (targetMorph - this.smoothedMorph) * Math.min(1.0, dt * 4.0);
        this.internalT += dt * this.smoothedSpeed;

// === js/visuals/dse/atari/wireframe-morph.js (Auszug) ===
        
        ctx.globalAlpha = globalAlpha;

        const cx = width / 2;
        const cy = height / 2;
        const minDim = Math.min(width, height);
        
        // Base Scale des Objekts, pulsiert mit dem Beat
        const scale = (minDim * 0.25) * (1.0 + metrics.beat[0] * beatScale);
        
        // Euler-Winkel für die Rotation
        const rx = this.internalT * 0.9;
        const ry = this.internalT * 1.3;
        const rz = this.internalT * 0.6;

        // 1. Morph-Logik anwenden: Ecke schrumpft, Spitzen schießen heraus
        const cornerScale = 1.0 - (this.smoothedMorph * 0.65); 
        const tipScale = 1.0 + (this.smoothedMorph * 1.5);     

        for (let i = 0; i < 8; i++) {
            this.vertices[i].x = this.baseCorners[i][0] * cornerScale;
            this.vertices[i].y = this.baseCorners[i][1] * cornerScale;
            this.vertices[i].z = this.baseCorners[i][2] * cornerScale;
        }
        for (let i = 0; i < 6; i++) {
            this.vertices[8 + i].x = this.baseTips[i][0] * tipScale;
            this.vertices[8 + i].y = this.baseTips[i][1] * tipScale;
            this.vertices[8 + i].z = this.baseTips[i][2] * tipScale;
        }

        // =========================================================
        // FIX: Konstantes Kamera-Sichtfeld verhindert exponentielles 
        // Schrumpfen (Quadratic Scaling Bug) auf Portrait-Bildschirmen!
        // =========================================================
        const fov = 250; 
        
        const sinX = Math.sin(rx), cosX = Math.cos(rx);
        const sinY = Math.sin(ry), cosY = Math.cos(ry);
        const sinZ = Math.sin(rz), cosZ = Math.cos(rz);

        for (let i = 0; i < 14; i++) {
            let x = this.vertices[i].x;
            let y = this.vertices[i].y;
            let z = this.vertices[i].z;

            // X-Achse
            let y1 = y * cosX - z * sinX;
            let z1 = y * sinX + z * cosX;
            // Y-Achse
            let x2 = x * cosY + z1 * sinY;
            let z2 = -x * sinY + z1 * cosY;
            // Z-Achse
            let x3 = x2 * cosZ - y1 * sinZ;
            let y3 = x2 * sinZ + y1 * cosZ;

            // Z-Tiefe addieren, damit es vor der Kamera liegt
            let zOff = z2 + 4.5;
            
            // SUB-PIXEL-KILLER: Strikte Integer-Werte für Atari!
            this.projected[i].x = Math.floor(cx + (x3 * fov) / zOff * (scale / 100));
            this.projected[i].y = Math.floor(cy + (y3 * fov) / zOff * (scale / 100));
        }

        // --- STRICT ATARI 9-BIT QUANTIZATION FOR WIREFRAME COLORS ---
        let beat = metrics.beat[0];
        let r = 0 + beat * 255;
        let g = 153 + beat * 102;
        let b = 0 + beat * 255;
        let qColor = quantizeAtari9Bit(r, g, b);
        let hexColor = rgbToHex(qColor[0], qColor[1], qColor[2]);
        
        // 3. Drahtgitter (Wireframe) per Software-Bresenham zeichnen
        // Kein ctx.lineWidth oder ctx.stroke() mehr!
        for (let i = 0; i < 24; i++) {
            let p1 = this.projected[this.edges[i][0]];
            let p2 = this.projected[this.edges[i][1]];
            
            drawAliasedLine(ctx, p1.x, p1.y, p2.x, p2.y, hexColor);
        }

        ctx.globalAlpha = 1.0;
    }
}