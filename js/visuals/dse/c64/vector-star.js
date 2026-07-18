// === js/visuals/dse/c64/vector-star.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: 3D ROTATING VECTOR STAR (v2.0.0)
// 100% 6510 Assembly Aesthetics. LUT-driven Lissajous paths,
// mechanical 3-frame rotation stutter, fake 2-pass Z-buffer,
// and horizontal Y-coordinate Raster-Interrupt color splits.
// =========================================================

import { C64_PALETTE, rgbToHex, drawAliasedLine } from '../../utils/hardware-constraints.js';

export class C64VectorStar {
    constructor() {
        this.name = 'C64 Vector Star';
        this.computerType = ['c64'];
        this.placementType = 'foreground';

        // 3D-Geometrie: 8-zackiger Stern (14 Vertices, 36 Kanten)
        this.vertices = [
            // Innerer Kontroll-Würfel (8 Vertices)
            {x: -0.3, y: -0.3, z: -0.3}, {x:  0.3, y: -0.3, z: -0.3},
            {x:  0.3, y:  0.3, z: -0.3}, {x: -0.3, y:  0.3, z: -0.3},
            {x: -0.3, y: -0.3, z:  0.3}, {x:  0.3, y: -0.3, z:  0.3},
            {x:  0.3, y:  0.3, z:  0.3}, {x: -0.3, y:  0.3, z:  0.3},
            // 6 Äußere Pyramiden-Spitzen (Zacken)
            {x:  1.3, y:   0, z:   0}, {x: -1.3, y:   0, z:   0},
            {x:   0, y:  1.3, z:   0}, {x:   0, y: -1.3, z:   0},
            {x:   0, y:   0, z:  1.3}, {x:   0, y:   0, z: -1.3}
        ];

        this.edges = [
            // Würfel-Kanten
            [0, 1], [1, 2], [2, 3], [3, 0], 
            [4, 5], [5, 6], [6, 7], [7, 4], 
            [0, 4], [1, 5], [2, 6], [3, 7], 
            // Spitzen-Verbindungen
            [8, 1], [8, 2], [8, 5], [8, 6],   
            [9, 0], [9, 3], [9, 4], [9, 7],   
            [10, 2], [10, 3], [10, 6], [10, 7], 
            [11, 0], [11, 1], [11, 4], [11, 5], 
            [12, 4], [12, 5], [12, 6], [12, 7], 
            [13, 0], [13, 1], [13, 2], [13, 3]  
        ];

        // Pre-Allocated Arrays (Zero Allocation)
        this.rotated = Array(this.vertices.length).fill(null).map(() => ({ x: 0, y: 0, z: 0 }));
        this.projected = Array(this.vertices.length).fill(null).map(() => ({ x: 0, y: 0 }));

        // C64 State Variables
        this.frameCounter = 0;
        this.rotX = 0;
        this.rotY = 0;
        this.rotZ = 0;
        this.pathT = 0.0;
        
        this.smoothedSpeed = 1.0;
        this.lastT = 0;

        this.initialized = false;
        this.ensureInitialized();
    }

    ensureInitialized() {
        if (this.initialized) return;

        // --- 1. 256-BYTE SINE LUT ---
        this.sinLUT = new Float32Array(256);
        this.cosLUT = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
            let angle = (i / 256) * Math.PI * 2;
            this.sinLUT[i] = Math.sin(angle);
            this.cosLUT[i] = Math.cos(angle);
        }

        // --- 2. C64 HARDWARE PALETTE ---
        // Fake Z-Buffer Colors
        this.cBackLine = rgbToHex(...C64_PALETTE[11]); // Dark Grey (hinten)
        
        // Raster-Interrupt Split Palette (Y-Achsen basiert)
        this.rasterPal = [
            rgbToHex(...C64_PALETTE[6]),  // Dark Blue
            rgbToHex(...C64_PALETTE[14]), // Light Blue
            rgbToHex(...C64_PALETTE[3]),  // Cyan
            rgbToHex(...C64_PALETTE[1]),  // White
            rgbToHex(...C64_PALETTE[3]),  // Cyan
            rgbToHex(...C64_PALETTE[14])  // Light Blue
        ];

        this.cBeatFlash = rgbToHex(...C64_PALETTE[1]);  // White
        this.cBeatBack = rgbToHex(...C64_PALETTE[15]);  // Light Grey

        this.initialized = true;
    }

    resize(width, height) {}

    render(ctx, width, height, t, state, stateTime, metrics) {
        this.ensureInitialized();

        if (state === 'idle') { this.lastT = t; return; }
        let dt = this.lastT === 0 ? 0.016 : t - this.lastT;
        this.lastT = t;

        this.frameCounter++;

        let targetSpeed = 1.0;
        if (state === 'buildup') targetSpeed = 1.6; 
        else if (state === 'climax') targetSpeed = 2.4; 

        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * Math.min(1.0, dt * 5.0);
        const beat = metrics.beat[0];
        const isBeat = beat > 0.7;

        // =========================================================
        // 1. MECHANISCHE 6510-ROTATION (Nur alle 3 Frames updaten!)
        // Erzeugt das klassische "Tick-Tick-Tick" der Integer-Math
        // =========================================================
        if (this.frameCounter % 3 === 0) {
            // Speed wird durch die Tension (Makro-Spannung) angehoben
            let rStepX = Math.floor(2 * this.smoothedSpeed);
            let rStepY = Math.floor(3 * this.smoothedSpeed);
            let rStepZ = Math.floor(1 * this.smoothedSpeed);

            this.rotX = (this.rotX + rStepX) & 255;
            this.rotY = (this.rotY + rStepY) & 255;
            this.rotZ = (this.rotZ + rStepZ) & 255;
        }

        // =========================================================
        // 2. LISSAJOUS FLUGBAHN (Ersatz für den "Unity-Bounce")
        // =========================================================
        this.pathT += dt * 30 * this.smoothedSpeed;
        
        let pXIdx = Math.floor(this.pathT) & 255;
        // Y schwingt leicht asynchron (0.7x) für das klassische Demo-Achten-Muster
        let pYIdx = Math.floor(this.pathT * 0.7) & 255; 

        const cx = Math.floor(width / 2);
        const cy = Math.floor(height / 2);

        // Kugel fliegt über 35% der Bildschirmbreite/höhe
        let moveX = Math.floor(this.sinLUT[pXIdx] * (width * 0.35));
        let moveY = Math.floor(this.cosLUT[pYIdx] * (height * 0.35));

        const targetX = cx + moveX;
        const targetY = cy + moveY;

        // =========================================================
        // 3. 3D-ROTATION MATRIX (100% LUT)
        // =========================================================
        const sinX = this.sinLUT[this.rotX], cosX = this.cosLUT[this.rotX];
        const sinY = this.sinLUT[this.rotY], cosY = this.cosLUT[this.rotY];
        const sinZ = this.sinLUT[this.rotZ], cosZ = this.cosLUT[this.rotZ];

        const minDim = Math.min(width, height);
        
        // Fov-Pulse: Der Stern wächst beim Kickdrum-Einschlag mechanisch um 8%
        const fovPulse = isBeat ? 1.08 : 1.0;
        const fov = Math.floor(minDim * 1.35 * fovPulse);

        for (let i = 0; i < this.vertices.length; i++) {
            let v = this.vertices[i];

            let ry = v.y * cosX - v.z * sinX;
            let rz = v.y * sinX + v.z * cosX;

            let rx = v.x * cosY + rz * sinY;
            let rz2 = -v.x * sinY + rz * cosY;

            let rx2 = rx * cosZ - ry * sinZ;
            let ry2 = rx * sinZ + ry * cosZ;

            this.rotated[i].x = rx2;
            this.rotated[i].y = ry2;
            this.rotated[i].z = rz2;

            let zOff = rz2 + 3.5;

            // Integer Projektion eliminiert Subpixel-Glitches
            this.projected[i].x = Math.floor(targetX + (rx2 * fov) / zOff);
            this.projected[i].y = Math.floor(targetY + (ry2 * fov) / zOff);
        }

        // =========================================================
        // 4. FAKE Z-BUFFER & RASTER-INTERRUPT RENDERING
        // 1987 Scene-Magic: Hinten = Grau, Vorne = Y-Raster-Farbe
        // =========================================================
        
        // PASS 1: HINTERE KANTEN (Z > 0)
        for (let i = 0; i < this.edges.length; i++) {
            let edge = this.edges[i];
            let avgZ = (this.rotated[edge[0]].z + this.rotated[edge[1]].z) * 0.5;
            
            if (avgZ > 0) {
                let p0 = this.projected[edge[0]];
                let p1 = this.projected[edge[1]];
                let color = isBeat ? this.cBeatBack : this.cBackLine;
                drawAliasedLine(ctx, p0.x, p0.y, p1.x, p1.y, color);
            }
        }

        // Raster-Scroll-Offset für die statischen Horizontalbänder
        const rasterScroll = Math.floor(this.pathT * 0.5);

        // PASS 2: VORDERE KANTEN (Z <= 0)
        for (let i = 0; i < this.edges.length; i++) {
            let edge = this.edges[i];
            let avgZ = (this.rotated[edge[0]].z + this.rotated[edge[1]].z) * 0.5;
            
            if (avgZ <= 0) {
                let p0 = this.projected[edge[0]];
                let p1 = this.projected[edge[1]];
                
                let color;
                if (isBeat) {
                    color = this.cBeatFlash; // Whiteout on Kick
                } else {
                    // Y-Coordinate Raster Split (Mitte der Kante ermitteln)
                    let midY = Math.floor((p0.y + p1.y) * 0.5);
                    
                    // Zeilenhöhe eines Raster-Balkens (12 Pixel)
                    let rIdx = Math.floor((midY + rasterScroll) / 12) % this.rasterPal.length;
                    if (rIdx < 0) rIdx += this.rasterPal.length; // JS negative modulo fix
                    
                    color = this.rasterPal[rIdx];
                }
                
                drawAliasedLine(ctx, p0.x, p0.y, p1.x, p1.y, color);
            }
        }
    }
}