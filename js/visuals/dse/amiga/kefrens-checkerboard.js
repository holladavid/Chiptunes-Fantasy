// === js/visuals/dse/amiga/kefrens-checkerboard.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: KEFRENS 3D CHECKERBOARD FLOOR
// Classic Amiga infinite zooming plane.
// Utilizes scanline-based perspective math and strict 
// 12-Bit OCS Copper Z-Depth shading.
// Horizon aligned with RetroSunset via a 1-pixel projection shift.
// =========================================================

import { quantizeAmiga12Bit, rgbToHex } from '../../utils/hardware-constraints.js';

export class KefrensCheckerboard {
    constructor() {
        this.name = 'Kefrens Checkerboard';
        this.computerType = ['amiga'];
        this.placementType = 'floor';
        
        this.internalT = 0;
        this.smoothedSpeed = 1.0;
        this.smoothedSway = 0.0;
        this.lastT = 0;
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
            beatBump = metrics.beat[0] * 12.0; 
        }

        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * Math.min(1.0, dt * 5.0);
        this.smoothedSway += (targetSway - this.smoothedSway) * Math.min(1.0, dt * 3.0);
        this.internalT += dt * this.smoothedSpeed;

        ctx.globalAlpha = globalAlpha;

        const horizon = Math.floor(height * 0.55);
        const scanH = 1; 
        
        const fov = 120;
        const tileW = 60;
        const tileH = 60;
        const camH = 30.0 - beatBump * 0.5; 
        
        const swayOffset = Math.sin(this.internalT * 0.8) * 150 * this.smoothedSway;

        const color1 = [0, 85, 255];  
        const color2 = [0, 0, 68];    

        // --- UPGRADE: SCHLEIFE LÄUFT BIS <= height WEGEN DES SHIFTS ---
        for (let y = horizon + scanH; y <= height; y += scanH) {
            let dy = y - horizon;
            let z = (camH * fov) / dy;
            
            let deltaScreenX = (tileW * fov) / z;
            let depth = Math.pow(Math.min(1.0, dy / (height - horizon)), 0.6);
            
            let c1 = quantizeAmiga12Bit(color1[0] * depth, color1[1] * depth, color1[2] * depth);
            let c2 = quantizeAmiga12Bit(color2[0] * depth, color2[1] * depth, color2[2] * depth);
            let hex1 = rgbToHex(c1[0], c1[1], c1[2]);
            let hex2 = rgbToHex(c2[0], c2[1], c2[2]);

            if (deltaScreenX < 3.0) {
                let blendR = Math.floor((c1[0] + c2[0]) / 2);
                let blendG = Math.floor((c1[1] + c2[1]) / 2);
                let blendB = Math.floor((c1[2] + c2[2]) / 2);
                ctx.fillStyle = rgbToHex(...quantizeAmiga12Bit(blendR, blendG, blendB));
                
                // --- SHIFT: Zeichnet die Moiré-Zeile 1 Amiga-Pixel höher (y - 1) ---
                ctx.fillRect(0, Math.floor(y - 1), width, Math.floor(scanH));
                continue;
            }

            let vPhase = Math.floor((z - this.internalT * 200) / tileH);
            let cx = (width / 2) + swayOffset * (1.0 - depth * 0.5); 
            let invZ = 1.0 / z;

            let worldX_at_0 = (0 - cx) * z / fov;
            let uPhase = Math.floor(worldX_at_0 / tileW);
            let nextX = cx + (uPhase + 1) * tileW * fov / z;
            
            let screenX = 0;

            while (screenX < width) {
                let drawW = Math.ceil(nextX - screenX);
                
                if (drawW <= 0) { drawW = 1; nextX = screenX + 1; }
                if (screenX + drawW > width) drawW = width - screenX;
                
                let colorXor = (uPhase + vPhase) & 1;
                ctx.fillStyle = colorXor === 0 ? hex1 : hex2;
                
                // --- SHIFT: Zeichnet das Schachbrett-Segment 1 Amiga-Pixel höher (y - 1) ---
                ctx.fillRect(Math.floor(screenX), Math.floor(y - 1), Math.floor(drawW), Math.floor(scanH));
                
                screenX += drawW;
                nextX += deltaScreenX;
                uPhase++;
            }
        }
        
        ctx.globalAlpha = 1.0;
    }
}