// === js/visuals/dse/amiga/kefrens-checkerboard.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: KEFRENS 3D CHECKERBOARD FLOOR
// Classic Amiga infinite zooming plane.
// Utilizes scanline-based perspective math and strict 
// 12-Bit OCS Copper Z-Depth shading.
// =========================================================

import { quantizeAmiga12Bit, rgbToHex } from '../../utils/hardware-constraints.js';

export class KefrensCheckerboard {
    constructor() {
        this.name = 'Kefrens Checkerboard';
        
        this.internalT = 0;
        this.smoothedSpeed = 1.0;
        this.smoothedSway = 0.0;
        this.lastT = 0;
        
        // Caching der Durchschnittsfarbe für den Horizont-Matsch (Anti-Aliasing)
        this.horizonBlendCache = {};
    }

    resize(width, height) {}

    render(ctx, width, height, t, state, stateTime, metrics) {
        if (state === 'idle') { this.lastT = t; return; }
        
        let dt = this.lastT === 0 ? 0.016 : t - this.lastT;
        this.lastT = t;

        let globalAlpha = 1.0;
        let targetSpeed = 1.0;
        let targetSway = 0.0;
        let beatBump = 0.0;

        // --- State-Machine Steuerung (Makro-Dynamik) ---
        if (state === 'starting') {
            globalAlpha = Math.min(1.0, stateTime / 1.5);
        } else if (state === 'stopping') {
            globalAlpha = Math.max(0.0, 1.0 - (stateTime / 1.5));
        } else if (state === 'buildup') {
            targetSpeed = 1.8;             
            targetSway = 1.0;     
        } else if (state === 'climax') {
            targetSpeed = 3.5; 
            targetSway = 2.5; 
            // Die Kamera wird beim Kickdrum-Einschlag massiv nach unten gedrückt!
            beatBump = metrics.beat[0] * 25.0; 
        }

        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * Math.min(1.0, dt * 5.0);
        this.smoothedSway += (targetSway - this.smoothedSway) * Math.min(1.0, dt * 3.0);
        this.internalT += dt * this.smoothedSpeed;

        ctx.globalAlpha = globalAlpha;

        const horizon = Math.floor(height * 0.55);
        const scanH = 4; // Typische Amiga 200p Scanline-Dicke
        
        // Kamera-Setup
        const fov = 160;
        const tileW = 60;
        const tileH = 60;
        
        // Kamera-Höhe (Y) mit Beat-Erschütterung
        const camH = 50.0 - beatBump; 
        
        // Seitliches Wanken (Sway)
        const swayOffset = Math.sin(this.internalT * 0.8) * 150 * this.smoothedSway;

        // Farbbasis: Typisches Sanity/Kefrens Blau
        const color1 = [0, 85, 255];  // Hellblau
        const color2 = [0, 0, 68];    // Dunkelblau

        // Z-Depth Shading Loop (Zeilenweises Rendern wie ein Amiga Copper)
        for (let y = horizon + scanH; y < height; y += scanH) {
            let dy = y - horizon;
            let z = (camH * fov) / dy;
            
            // Berechnung der Bildschirm-Breite eines Tiles auf dieser Z-Ebene
            let deltaScreenX = (tileW * fov) / z;
            
            // Depth-Shading: Je weiter weg, desto dunkler (Pow(0.6) macht den Vordergrund heller)
            let depth = Math.pow(Math.min(1.0, dy / (height - horizon)), 0.6);
            
            // --- STRICT AMIGA 12-BIT QUANTIZATION FOR COPPER SHADING ---
            let c1 = quantizeAmiga12Bit(color1[0] * depth, color1[1] * depth, color1[2] * depth);
            let c2 = quantizeAmiga12Bit(color2[0] * depth, color2[1] * depth, color2[2] * depth);
            let hex1 = rgbToHex(c1[0], c1[1], c1[2]);
            let hex2 = rgbToHex(c2[0], c2[1], c2[2]);

            // Moiré-Prävention: Am Horizont werden die Tiles zu klein zum Rendern.
            // Der Amiga löste das durch schlichtes "Verwaschen" in eine Durchschnittsfarbe.
            if (deltaScreenX < 3.0) {
                let blendR = Math.floor((c1[0] + c2[0]) / 2);
                let blendG = Math.floor((c1[1] + c2[1]) / 2);
                let blendB = Math.floor((c1[2] + c2[2]) / 2);
                ctx.fillStyle = rgbToHex(...quantizeAmiga12Bit(blendR, blendG, blendB));
                ctx.fillRect(0, y, width, scanH);
                continue;
            }

            // Vorwärtsbewegung (Z-Achse)
            let vPhase = Math.floor((z - this.internalT * 200) / tileH);
            
            let cx = (width / 2) + swayOffset * (1.0 - depth * 0.5); // Perspektivisches Sway
            let invZ = 1.0 / z;

            // Finde die exakte Start-Phase am linken Bildschirmrand (X = 0)
            let worldX_at_0 = (0 - cx) * z / fov;
            let uPhase = Math.floor(worldX_at_0 / tileW);
            
            // Finde den exakten X-Pixelwert, an dem die nächste Phase (Farbwechsel) beginnt
            let nextX = cx + (uPhase + 1) * tileW * fov / z;
            
            let screenX = 0;

            // Zeichne diese Scanline blockweise (vermeidet tausende draw-calls!)
            while (screenX < width) {
                let drawW = Math.ceil(nextX - screenX);
                
                // Safety Catch gegen Floating-Point-Hänger
                if (drawW <= 0) { drawW = 1; nextX = screenX + 1; }
                if (screenX + drawW > width) drawW = width - screenX;
                
                // Bitweiser Checkerboard XOR Check
                let colorXor = (uPhase + vPhase) & 1;
                
                ctx.fillStyle = colorXor === 0 ? hex1 : hex2;
                ctx.fillRect(screenX, y, drawW, scanH);
                
                screenX += drawW;
                nextX += deltaScreenX;
                uPhase++;
            }
        }
        
        ctx.globalAlpha = 1.0;
    }
}