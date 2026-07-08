// === js/visuals/dse/atari/lissajous-bobs.js ===
import { quantizeAtari9Bit, rgbToHex } from '../../utils/hardware-constraints.js';

export class AtariBobs {
    constructor() {
        this.name = 'Atari Lissajous Bobs'; 
        this.computerType = ['atari']; 
        this.placementType = 'foreground';
        
        this.numBobs = 45; 
        this.bobSize = 16; // PROPORTIONS-FIX: Von 48 auf 16 geschrumpft!
        this.bobCanvas = document.createElement('canvas'); 
        this.bobCanvas.width = this.bobSize; 
        this.bobCanvas.height = this.bobSize;
        const bCtx = this.bobCanvas.getContext('2d');
        
        const cx = this.bobSize / 2; const cy = this.bobSize / 2;
        const grad = bCtx.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, this.bobSize / 2); // Glanzpunkt angepasst
                
        // --- STRICT ATARI 9-BIT QUANTIZATION ---
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

        if (state === 'starting') {
            globalAlpha = Math.min(1.0, stateTime / 1.5);
            scaleMultiplier = globalAlpha;
        } else if (state === 'stopping') {
            globalAlpha = Math.max(0.0, 1.0 - (stateTime / 1.5));
            scaleMultiplier = globalAlpha;
        } else if (state === 'buildup') {
            targetSpeed = 1.2; beatScale = 2.0;   
        } else if (state === 'climax') {
            targetSpeed = 2.0; globalAlpha = 0.8 + (metrics.beat[0] * 0.2); beatScale = 12.0;  
        }

        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * 0.05;
        this.internalT += dt * this.smoothedSpeed;

        ctx.globalAlpha = globalAlpha;
        const cx = width / 2; const cy = height / 2;
        
        const minDim = Math.min(width, height);
        const radiusX = (minDim * 0.38) * (1.0 + Math.sin(this.internalT * 0.4) * 0.25) * scaleMultiplier;
        const radiusY = (minDim * 0.28) * (1.0 + Math.cos(this.internalT * 0.5) * 0.2) * scaleMultiplier;
        
        const baseBobSize = 3.0 + minDim * 0.03; // PROPORTIONS-FIX
        const phaseStep = (Math.PI * 2) / this.numBobs;
        
        for (let i = 0; i < this.numBobs; i++) {
            const phase = i * phaseStep;
            const x = cx + Math.sin(this.internalT * 1.4 + phase) * radiusX;
            const y = cy + Math.sin(this.internalT * 2.1 + phase) * Math.cos(this.internalT * 1.1 + phase) * radiusY;
            const size = (baseBobSize + Math.sin(this.internalT * 3.5 + phase) * (baseBobSize * 0.4)) * scaleMultiplier + (metrics.beat[0] * beatScale);
            
            // PROPORTIONS-FIX: Math.floor verhindert weiches Sub-Pixel-Blurring!
            ctx.drawImage(this.bobCanvas, Math.floor(x - size / 2), Math.floor(y - size / 2), Math.floor(size), Math.floor(size));
        }
        
        ctx.globalAlpha = 1.0;
    }
}