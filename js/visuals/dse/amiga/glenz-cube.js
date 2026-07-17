// === js/visuals/dse/amiga/glenz-cube.js ===
// =========================================================
// AMIGA OCS GLENZ-CUBE DSE (v2.1.1 - Stable Math)
// 100% Alpha-free. Transparent checkerboard dither patterns,
// 1024-step mechanical rotation LUT, and beat-reactive vertex explosion.
// =========================================================

import { quantizeAmiga12Bit, rgbToHex, drawAliasedLine } from '../../utils/hardware-constraints.js';

export class AmigaCube {
    constructor() {
        this.name = 'Amiga Glenz Cube';
        this.computerType = ['amiga'];
        this.placementType = 'foreground';

        // Starre 8 Vertices im stabilen Einheitsraum
        this.cubeVertices = [
            [-1, -1, -1], [ 1, -1, -1], [ 1,  1, -1], [-1,  1, -1], 
            [-1, -1,  1], [ 1, -1,  1], [ 1,  1,  1], [-1,  1,  1]
        ];

        this.cubeFacesDef = [
            { idxs: [4, 5, 6, 7], baseColorIdx: 0 }, // Front (Orange)
            { idxs: [1, 0, 3, 2], baseColorIdx: 1 }, // Back (Gold)
            { idxs: [3, 2, 6, 7], baseColorIdx: 2 }, // Top (Blue)
            { idxs: [1, 5, 4, 0], baseColorIdx: 3 }, // Bottom (Cyan)
            { idxs: [0, 4, 7, 3], baseColorIdx: 4 }, // Left (Purple)
            { idxs: [5, 1, 2, 6], baseColorIdx: 5 }  // Right (Pink)
        ];

        this.rotated = Array(8).fill(null).map(() => ({ x: 0, y: 0, z: 0 }));
        this.projected = Array(8).fill(null).map(() => ({ x: 0, y: 0 }));
        this.facesToDraw = Array(6).fill(null).map(() => ({ idxs: null, z: 0, isBackface: false, colorIdx: 0 }));

        // Akkumulatoren für diskrete LUT-Indizes (0-1023)
        this.rotX = 0;
        this.rotY = 0;
        this.rotZ = 0;

        this.speedX = 1.0;
        this.speedY = 1.3;
        this.speedZ = 0.7;

        this.lastT = 0;
        this.internalT = 0;
        this.smoothedSpeed = 1.0;

        // Dynamic State-Variables
        this.vertexExpand = 1.0; 
        this.paletteOffset = 0;
        this.wasBeat = false;

        this.initialized = false;
        this.ensureInitialized();
    }

    ensureInitialized() {
        if (this.initialized) return;

        // --- 1. 1024-ENTRY SINE LOOKUP TABLE (LUT) ---
        // Eliminiert Math.sin/cos im Renderloop und sorgt für den mechanischen A500-Schliff
        this.sinLUT = new Float32Array(1024);
        this.cosLUT = new Float32Array(1024);
        for (let i = 0; i < 1024; i++) {
            let angle = (i / 1024) * Math.PI * 2;
            this.sinLUT[i] = Math.sin(angle);
            this.cosLUT[i] = Math.cos(angle);
        }

        // --- 2. THE STRICT 12-BIT COLOR PALETTE ---
        const baseColors = [
            [255, 102, 0],   // 0: Orange
            [255, 170, 0],   // 1: Gold
            [0, 85, 255],    // 2: Blue
            [0, 204, 255],   // 3: Cyan
            [170, 0, 136],   // 4: Purple
            [255, 68, 119]   // 5: Pink
        ];

        // --- 3. TRANSPARENT CHECKERBOARD PATTERNS (The Ultimate Hack) ---
        // Wir erzeugen pro Gesicht zwei Muster: Ein helles (Front) und ein dunkles (Back)
        this.frontPatterns = baseColors.map(c => this.createTransparentDitherPattern(c[0], c[1], c[2]));
        this.backPatterns = baseColors.map(c => this.createTransparentDitherPattern(c[0] * 0.4, c[1] * 0.4, c[2] * 0.4));

        this.colorFrontLine = rgbToHex(...quantizeAmiga12Bit(255, 255, 255)); // Strahlendes Weiß
        this.colorBackLine = rgbToHex(...quantizeAmiga12Bit(85, 85, 85));     // Dumpfer Kupferdraht

        this.initialized = true;
    }

    // Erzeugt ein echtes OCS-Dither-Pattern (Wechselseitig transparent!)
    createTransparentDitherPattern(r, g, b) {
        const pCanvas = document.createElement('canvas');
        pCanvas.width = 2;
        pCanvas.height = 2;
        const pCtx = pCanvas.getContext('2d');

        // Transparent clearen
        pCtx.clearRect(0, 0, 2, 2);

        // 50% Pixel-Schachbrett zeichnen
        pCtx.fillStyle = rgbToHex(...quantizeAmiga12Bit(r, g, b));
        pCtx.fillRect(0, 0, 1, 1);
        pCtx.fillRect(1, 1, 1, 1);

        return pCtx.createPattern(pCanvas, 'repeat');
    }

    resize(width, height) {}

    render(ctx, width, height, t, state, stateTime, metrics) {
        this.ensureInitialized();

        if (state === 'idle') { this.lastT = t; return; }
        let dt = this.lastT === 0 ? 0.016 : t - this.lastT;
        this.lastT = t;

        let globalAlpha = 1.0;
        let targetSpeed = 1.0;

        // =========================================================
        // 4. BEAT EVENT TRIGGER (Diskrete "Klick"-Wechsel)
        // =========================================================
        const beat = metrics.beat[0];
        const tension = metrics.tensionPct || 0.0;
        const isBeat = beat > 0.8 && !this.wasBeat;
        this.wasBeat = (beat > 0.8);

        if (isBeat) {
            // Vertex Explosion zünden! Ecken stieben rasant auseinander
            this.vertexExpand = 1.35;
            
            // Palette Rotation: Farbringe auf dem Takt weiterschieben
            this.paletteOffset = (this.paletteOffset + 1) % 6;
            
            // Snappy Richtungswechsel
            if (Math.random() < 0.3) {
                this.speedX *= -1;
                this.speedY *= -1;
            }
        }

        // Federndes LERP fängt die Vertex-Spreizung weich ab (Amiga Springen!)
        this.vertexExpand += (1.0 - this.vertexExpand) * 0.12;

        if (state === 'starting') {
            globalAlpha = Math.min(1.0, stateTime / 1.5);
        } else if (state === 'stopping') {
            globalAlpha = Math.max(0.0, 1.0 - (stateTime / 1.5));
        } else if (state === 'buildup') {
            targetSpeed = 1.35; 
        } else if (state === 'climax') {
            targetSpeed = 2.4; 
        }

        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * 0.05;
        
        // Tension erhöht das Rotationstempo signifikant
        const tensionSpeedMult = 1.0 + (tension * 1.5);
        
        // LUT-Winkel inkrementieren (Ganzzahlig modulo 1024)
        this.rotX = (this.rotX + Math.floor(dt * 150 * this.smoothedSpeed * tensionSpeedMult)) & 1023;
        this.rotY = (this.rotY + Math.floor(dt * 220 * this.smoothedSpeed * tensionSpeedMult)) & 1023;
        this.rotZ = (this.rotZ + Math.floor(dt * 110 * this.smoothedSpeed * tensionSpeedMult)) & 1023;

        ctx.globalAlpha = globalAlpha;

        const cx = Math.floor(width / 2); 
        const cy = Math.floor(height / 2);
        const minDim = Math.min(width, height);
        
        // Winkel-Trig via LUT abgreifen
        const sinX = this.sinLUT[this.rotX], cosX = this.cosLUT[this.rotX];
        const sinY = this.sinLUT[this.rotY], cosY = this.cosLUT[this.rotY];
        const sinZ = this.sinLUT[this.rotZ], cosZ = this.cosLUT[this.rotZ];

        // --- 5. 3D-ROTATION MATRIX ---
        // Die Ecken werden stabil im Einheitsraum um den expand-Faktor gestreckt
        const baseSize = 1.0 * this.vertexExpand;

        for (let i = 0; i < 8; i++) {
            let x = this.cubeVertices[i][0] * baseSize;
            let y = this.cubeVertices[i][1] * baseSize;
            let z = this.cubeVertices[i][2] * baseSize;

            // X-Rotation
            let y1 = y * cosX - z * sinX; 
            let z1 = y * sinX + z * cosX;
            // Y-Rotation
            let x2 = x * cosY + z1 * sinY; 
            let z2 = -x * sinY + z1 * cosY;
            // Z-Rotation
            let x3 = x2 * cosZ - y1 * sinZ; 
            let y3 = x2 * sinZ + y1 * cosZ;

            this.rotated[i].x = x3; 
            this.rotated[i].y = y3; 
            this.rotated[i].z = z2;
        }

        // --- 6. INTEGER DIVISION PERSPECTIVE PROJECTION ---
        // Dynamische Basis-Skalierung inklusive Sinus-Wobble
        const screenScale = (55 + Math.sin(t * 0.75) * 8); 
        const fov = Math.min(width, height) * 1.5 * (screenScale / 100);

        for (let i = 0; i < 8; i++) {
            // Der Kamera-Z-Abstand (4.0) ist nun mathematisch absolut sicher,
            // da rotated.z garantiert im Bereich [-1.5, 1.5] schwingt!
            const zOff = this.rotated[i].z + 4.0; 
            
            this.projected[i].x = Math.floor(cx + (this.rotated[i].x * fov) / zOff);
            this.projected[i].y = Math.floor(cy + (this.rotated[i].y * fov) / zOff);
        }

        // --- 7. BACKFACE CULLING & COMPOSITING ---
        const lx = 0.5, ly = -0.5, lz = -0.7;
        const lLen = Math.sqrt(lx*lx + ly*ly + lz*lz); 
        const nlx = lx / lLen, nly = ly / lLen, nlz = lz / lLen;

        for (let i = 0; i < 6; i++) {
            const faceDef = this.cubeFacesDef[i]; 
            const idxs = faceDef.idxs;
            const p0 = this.rotated[idxs[0]], p1 = this.rotated[idxs[1]], p2 = this.rotated[idxs[2]];
            const zCentroid = (p0.z + p1.z + p2.z + this.rotated[idxs[3]].z) / 4.0;
            
            const abX = p1.x - p0.x, abY = p1.y - p0.y, abZ = p1.z - p0.z;
            const acX = p2.x - p0.x, acY = p2.y - p0.y, acZ = p2.z - p0.z;

            let nx = abY * acZ - abZ * acY; 
            let ny = abZ * acX - abX * acZ; 
            let nz = abX * acY - abY * acX;
            const len = Math.sqrt(nx*nx + ny*ny + nz*nz); 
            if (len > 0) { nx /= len; ny /= len; nz /= len; }

            const vLen = Math.sqrt(p0.x*p0.x + p0.y*p0.y + (p0.z + 4.0)*(p0.z + 4.0));
            const nvx = p0.x / vLen, nvy = p0.y / vLen, nvz = (p0.z + 4.0) / vLen;

            let f = this.facesToDraw[i];
            f.idxs = idxs; 
            f.z = zCentroid;
            f.colorIdx = (faceDef.baseColorIdx + this.paletteOffset) % 6; // Palette-Cycling!
            f.isBackface = (nx * nvx + ny * nvy + nz * nvz >= 0);
        }

        // Sortieren für Painter's Algorithm (Back-to-front rendering)
        this.facesToDraw.sort((a, b) => b.z - a.z);

        // --- 8. THE BOLD CHUNKY GLENZ RENDERING ---
        for (let i = 0; i < 6; i++) {
            let face = this.facesToDraw[i]; 
            let idxs = face.idxs;
            
            // Pixelgenaue Füll-Pfade vorbereiten
            ctx.beginPath(); 
            ctx.moveTo(this.projected[idxs[0]].x, this.projected[idxs[0]].y); 
            ctx.lineTo(this.projected[idxs[1]].x, this.projected[idxs[1]].y); 
            ctx.lineTo(this.projected[idxs[2]].x, this.projected[idxs[2]].y); 
            ctx.lineTo(this.projected[idxs[3]].x, this.projected[idxs[3]].y); 
            ctx.closePath();

            // 100% Alpha-freies OCS-Dithering
            ctx.fillStyle = face.isBackface 
                ? this.backPatterns[face.colorIdx]  // Dunkles Schachbrett für Rückseite
                : this.frontPatterns[face.colorIdx]; // Helles Schachbrett für Vorderseite
            ctx.fill();

            // --- 1-PIXEL COOPER WIREFRAME OUTLINES ---
            // Flackert unruhig im Takt des Beats für echten Röhren-Klang-Charakter
            let beatFlicker = beat > 0.75 && (i % 2 === 0);
            let lineColor = face.isBackface 
                ? this.colorBackLine 
                : (beatFlicker ? this.colorBackLine : this.colorFrontLine);
            
            let p0 = this.projected[idxs[0]]; let p1 = this.projected[idxs[1]];
            let p2 = this.projected[idxs[2]]; let p3 = this.projected[idxs[3]];

            drawAliasedLine(ctx, p0.x, p0.y, p1.x, p1.y, lineColor);
            drawAliasedLine(ctx, p1.x, p1.y, p2.x, p2.y, lineColor);
            drawAliasedLine(ctx, p2.x, p2.y, p3.x, p3.y, lineColor);
            drawAliasedLine(ctx, p3.x, p3.y, p0.x, p0.y, lineColor);
        }

        ctx.globalAlpha = 1.0;
    }
}