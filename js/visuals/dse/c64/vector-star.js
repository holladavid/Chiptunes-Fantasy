// === js/visuals/dse/c64/vector-star.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: 3D ROTATING VECTOR STAR (C64 FOREGROUND)
// Tribute to Delta and Wizball loading screens. 
// Renders a 3D 8-pointed star using strict Bresenham lines,
// C64 color quantization, and voice-reactive color-cycling.
// =========================================================

import { C64_PALETTE, rgbToHex, drawAliasedLine } from '../../../visuals/utils/hardware-constraints.js';

const PAL = C64_PALETTE.map(c => rgbToHex(c[0], c[1], c[2]));

export class C64VectorStar {
    constructor() {
        this.name = 'C64 Vector Star';
        this.computerType = ['c64'];
        this.placementType = 'foreground';

        // 3D-Geometrie: 8-zackiger Stern (14 Vertices, 36 Kanten)
        this.vertices = [
            // Innerer Kontroll-Würfel (8 Vertices)
            {x: -0.3, y: -0.3, z: -0.3}, // 0
            {x:  0.3, y: -0.3, z: -0.3}, // 1
            {x:  0.3, y:  0.3, z: -0.3}, // 2
            {x: -0.3, y:  0.3, z: -0.3}, // 3
            {x: -0.3, y: -0.3, z:  0.3}, // 4
            {x:  0.3, y: -0.3, z:  0.3}, // 5
            {x:  0.3, y:  0.3, z:  0.3}, // 6
            {x: -0.3, y:  0.3, z:  0.3}, // 7
            // 6 Äußere Pyramiden-Spitzen (Zacken)
            {x:  1.3, y:   0, z:   0}, // 8: Rechts
            {x: -1.3, y:   0, z:   0}, // 9: Links
            {x:   0, y:  1.3, z:   0}, // 10: Unten
            {x:   0, y: -1.3, z:   0}, // 11: Oben
            {x:   0, y:   0, z:  1.3}, // 12: Vorne
            {x:   0, y:   0, z: -1.3}  // 13: Hinten
        ];

        this.edges = [
            // Würfel-Kanten (12 Kanten)
            [0, 1], [1, 2], [2, 3], [3, 0], // Hinten
            [4, 5], [5, 6], [6, 7], [7, 4], // Vorne
            [0, 4], [1, 5], [2, 6], [3, 7], // Verbindungen
            
            // Spitzen-Verbindungen (24 Kanten)
            [8, 1], [8, 2], [8, 5], [8, 6],   // Rechts
            [9, 0], [9, 3], [9, 4], [9, 7],   // Links
            [10, 2], [10, 3], [10, 6], [10, 7], // Unten
            [11, 0], [11, 1], [11, 4], [11, 5], // Oben
            [12, 4], [12, 5], [12, 6], [12, 7], // Vorne
            [13, 0], [13, 1], [13, 2], [13, 3]  // Hinten
        ];

        this.projected = Array(this.vertices.length).fill(null).map(() => ({ x: 0, y: 0 }));

        this.moveXPhase = 0.0;
        this.moveYPhase = 0.0;
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

        if (state === 'starting') { globalAlpha = Math.min(1.0, stateTime / 1.5); } 
        else if (state === 'stopping') { globalAlpha = Math.max(0.0, 1.0 - (stateTime / 1.5)); } 
        else if (state === 'buildup') { targetSpeed = 1.6; } 
        else if (state === 'climax') { targetSpeed = 2.4; }

        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * Math.min(1.0, dt * 5.0);
        this.internalT += dt * this.smoothedSpeed;
        const time = this.internalT;

        const beat = metrics.beat[0];
        const vols = metrics.smooth;

        // --- 1. KINEMATIK (Lineares X-Sway & Parabolisches Y-Bouncen) ---
        const minDim = Math.min(width, height);
        const cx = width / 2;

        const speedX = 0.20 * this.smoothedSpeed;
        this.moveXPhase = (this.moveXPhase + dt * speedX) % 2.0;
        const isMovingRight = this.moveXPhase < 1.0;
        const xNorm = isMovingRight ? (this.moveXPhase * 2.0 - 1.0) : (1.0 - (this.moveXPhase - 1.0) * 2.0);
        const moveX = xNorm * (width * 0.32);

        const bounceFreq = 0.85 * this.smoothedSpeed;
        this.moveYPhase = (this.moveYPhase + dt * bounceFreq) % 1.0;
        const u = 2.0 * this.moveYPhase - 1.0;
        const parabolicArc = 1.0 - (u * u);

        // Skaliert proportional mit dem Beat
        const beatScale = 1.0 + beat * 0.12;
        const fov = minDim * 1.35 * beatScale;
        
        // Verhindert das Aufprallen außerhalb des Canvas
        const starRadiusOnScreen = (fov * 1.3) / 3.5;
        const floorY = height * 0.88 - starRadiusOnScreen;
        const bounceY = parabolicArc * (floorY - starRadiusOnScreen - 10);

        const targetX = cx + moveX;
        const targetY = floorY - bounceY;

        // --- 2. 3D PROJEKTION ---
        const rotX = time * 0.9;
        const rotY = time * 1.3;
        const rotZ = time * 0.5;

        const sinX = Math.sin(rotX), cosX = Math.cos(rotX);
        const sinY = Math.sin(rotY), cosY = Math.cos(rotY);
        const sinZ = Math.sin(rotZ), cosZ = Math.cos(rotZ);

        for (let i = 0; i < this.vertices.length; i++) {
            let v = this.vertices[i];

            // Y-Rotation
            let rx = v.x * cosY - v.z * sinY;
            let rz = v.x * sinY + v.z * cosY;
            let ry = v.y;

            // X-Rotation
            let ry1 = ry * cosX - rz * sinX;
            let rz1 = ry * sinX + rz * cosX;

            // Z-Rotation
            let tx = rx * cosZ - ry1 * sinZ;
            let ty = rx * sinZ + ry1 * cosZ;
            let tz = rz1;

            let zOff = tz + 3.5;

            // 100% Antialiasing-freie Projektion (Math.floor)
            this.projected[i].x = Math.floor(targetX + (tx * fov) / zOff);
            this.projected[i].y = Math.floor(targetY + (ty * fov) / zOff);
        }

        // --- 3. RENDERING (Bresenham Wireframe mit Voice-Reactivity) ---
        ctx.globalAlpha = globalAlpha;

        for (let i = 0; i < this.edges.length; i++) {
            let edge = this.edges[i];
            let p0 = this.projected[edge[0]];
            let p1 = this.projected[edge[1]];

            let colIdx = 12; // Grey Base-Farbe

            if (i < 12) {
                // Der innere Kontroll-Würfel flackert im Takt der Kickdrum
                colIdx = beat > 0.5 ? 1 : 14; // White oder Light Blue
            } else {
                // Die 6 Zacken-Gruppen reagieren direkt auf die 3 SID-Registerlautstärken!
                let group = Math.floor((i - 12) / 4); // 0 bis 5
                let vol = vols[group % 3]; // Mappt 6 Zacken auf 3 Volume-Spuren
                
                colIdx = vol > 0.65 ? 1 : (vol > 0.2 ? 3 : 6); // White -> Cyan -> Dark Blue
            }

            // Exakt harter Linienzeichner (kein ctx.lineTo!)
            drawAliasedLine(ctx, p0.x, p0.y, p1.x, p1.y, PAL[colIdx]);
        }

        ctx.globalAlpha = 1.0;
    }
}