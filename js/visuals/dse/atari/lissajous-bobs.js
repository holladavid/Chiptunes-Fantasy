// === js/visuals/dse/atari/lissajous-bobs.js ===
// =========================================================
// CLASSIC LISSAJOUS METAL-BOB CHAIN (ATARI ST GIMMICK)
// Refactored with strict Aspect-Ratio path safety (v1.3.0)
// and kinetic "Snake-Warp" beat-reactivity.
// =========================================================

import { quantizeAtari9Bit, rgbToHex } from '../../utils/hardware-constraints.js';

export class AtariBobs {
    constructor() {
        this.name = 'Atari Lissajous Bobs'; 
        this.computerType = ['atari']; 
        this.placementType = 'foreground';
        
        this.numBobs = 45; 
        this.bobSize = 16; 
        this.bobCanvas = document.createElement('canvas'); 
        this.bobCanvas.width = this.bobSize; 
        this.bobCanvas.height = this.bobSize;
        const bCtx = this.bobCanvas.getContext('2d');
        
        const cx = this.bobSize / 2; const cy = this.bobSize / 2;
        const grad = bCtx.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, this.bobSize / 2);
        
        const c1 = rgbToHex(...quantizeAtari9Bit(255, 255, 255));
        const c2 = rgbToHex(...quantizeAtari9Bit(153, 255, 153));
        const c3 = rgbToHex(...quantizeAtari9Bit(51, 255, 51));
        const c4 = rgbToHex(...quantizeAtari9Bit(0, 85, 0));
        const c5 = `rgba(${quantizeAtari9Bit(0, 10, 0).join(',')}, 0)`;
        
        grad.addColorStop(0.0, c1); 
        grad.addColorStop(0.2, c2); 
        grad.addColorStop(0.55, c3); 
        grad.addColorStop(0.85, c4); 
        grad.addColorStop(1.0, c5); 
        
        bCtx.fillStyle = grad; 
        bCtx.beginPath(); 
        bCtx.arc(cx, cy, this.bobSize / 2, 0, Math.PI * 2); 
        bCtx.fill();
        
        this.lastT = 0; this.internalT = 0; this.smoothedSpeed = 1.0;
    }

    resize(width, height) {}

    render(ctx, width, height, t, state, stateTime, metrics) {
        if (state === 'idle') { this.lastT = t; return; }
        let dt = this.lastT === 0 ? 0.016 : t - this.lastT;
        this.lastT = t;

        let globalAlpha = 1.0;
        let targetSpeed = 1.0;
        let scaleMultiplier = 1.0;
        let beatScale = 0.0;
        let beatWarp = 0.0; // Krümmungs-Ausschlag der Schlange

        if (state === 'starting') {
            globalAlpha = Math.min(1.0, stateTime / 1.5);
            scaleMultiplier = globalAlpha;
        } else if (state === 'stopping') {
            globalAlpha = Math.max(0.0, 1.0 - (stateTime / 1.5));
            scaleMultiplier = globalAlpha;
        } else if (state === 'buildup') {
            targetSpeed = 1.3; 
            beatScale = 0.04; // Proportionales Aufblasen
            beatWarp = 0.15;
        } else if (state === 'climax') {
            targetSpeed = 2.0; 
            globalAlpha = 0.85 + (metrics.beat[0] * 0.15); 
            beatScale = 0.09;  // Proportionales Aufblasen
            beatWarp = 0.45;   // Schlange krümmt sich elastisch
        }

        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * Math.min(1.0, dt * 5.0);
        
        // --- 1. THE SPEED SURGE (Schlange peitscht zum Takt nach vorne) ---
        const activeSpeed = this.smoothedSpeed + (metrics.beat[0] * this.smoothedSpeed * 0.8);
        this.internalT += dt * activeSpeed;

        ctx.globalAlpha = globalAlpha;
        const cx = width / 2; const cy = height / 2;
        
        const minDim = Math.min(width, height);
        const isPortrait = width < height;

        // --- 2. ASPECT-RATIO SAFE PATHING (Schrumpft im Hochkantmodus) ---
        // Verhindert, dass die Bobs links und rechts an die Gehäusewand stoßen
        const aspectScaleX = isPortrait ? 0.32 : 0.38;
        
        const radiusX = (minDim * aspectScaleX) * (1.0 + Math.sin(this.internalT * 0.4) * 0.25) * scaleMultiplier;
        const radiusY = (minDim * 0.28) * (1.0 + Math.cos(this.internalT * 0.5) * 0.2) * scaleMultiplier;
        
        const baseBobSize = 3.0 + minDim * 0.03; 
        const phaseStep = (Math.PI * 2) / this.numBobs;
        
        for (let i = 0; i < this.numBobs; i++) {
            // --- 3. THE SNAKE-WARP (Wirbelsäulen-Krümmung zum Beat) ---
            const phase = i * phaseStep + (metrics.beat[0] * beatWarp * Math.sin(i * 0.2));
            
            const x = cx + Math.sin(this.internalT * 1.4 + phase) * radiusX;
            const y = cy + Math.sin(this.internalT * 2.1 + phase) * Math.cos(this.internalT * 1.1 + phase) * radiusY;
            
            // Proportionaler Beat-Glow
            const size = (baseBobSize + Math.sin(this.internalT * 3.5 + phase) * (baseBobSize * 0.4)) * scaleMultiplier + (metrics.beat[0] * minDim * beatScale);
            
            ctx.drawImage(this.bobCanvas, Math.floor(x - size / 2), Math.floor(y - size / 2), Math.floor(size), Math.floor(size));
        }
        ctx.globalAlpha = 1.0;
    }
}