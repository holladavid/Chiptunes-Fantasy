// === js/visuals/dse/atari/lissajous-bobs.js ===
// =========================================================
// CLASSIC LISSAJOUS METAL-BOB CHAIN (ATARI ST GIMMICK)
// Refactored with strict Aspect-Ratio & High-DPI Scaling (v1.2.0)
// =========================================================

export class AtariBobs {
    constructor() {
        this.name = 'Atari Lissajous Bobs'; 
        this.computerType = ['atari']; 
        this.placementType = 'foreground';
        
        this.numBobs = 45; 
        
        // Vergrößert auf 48px für knackscharfe Texturen auf 4K/Retina-Displays
        this.bobSize = 48; 
        this.bobCanvas = document.createElement('canvas'); 
        this.bobCanvas.width = this.bobSize; 
        this.bobCanvas.height = this.bobSize;
        const bCtx = this.bobCanvas.getContext('2d');
        
        const cx = this.bobSize / 2; 
        const cy = this.bobSize / 2;
        
        // Radial-Gradient auf die neue Texturgröße angepasst
        const grad = bCtx.createRadialGradient(cx - 7, cy - 7, 1, cx, cy, this.bobSize / 2);
        grad.addColorStop(0.0, '#ffffff'); 
        grad.addColorStop(0.2, '#99ff99'); 
        grad.addColorStop(0.55, '#33ff33'); 
        grad.addColorStop(0.85, '#005500'); 
        grad.addColorStop(1.0, 'rgba(0, 10, 0, 0)'); 
        
        bCtx.fillStyle = grad; 
        bCtx.beginPath(); 
        bCtx.arc(cx, cy, this.bobSize / 2, 0, Math.PI * 2); 
        bCtx.fill();
        
        this.lastT = 0; 
        this.internalT = 0; 
        this.smoothedSpeed = 1.0;
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
            targetSpeed = 1.2; 
            beatScale = 2.0;   
        } else if (state === 'climax') {
            targetSpeed = 2.0;
            globalAlpha = 0.8 + (metrics.beat[0] * 0.2); 
            beatScale = 12.0;  
        }

        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * 0.05;
        this.internalT += dt * this.smoothedSpeed;

        ctx.globalAlpha = globalAlpha;
        const cx = width / 2; 
        const cy = height / 2;
        
        // =========================================================
        // MATHEMATISCHER FIX: Aspect-Ratio Preservation
        // Berechnet beide Radien relativ zur KLEINSTEN Bildschirmseite (minDim).
        // Verhindert das Zerquetschen auf Handys und das Strecken im Widescreen!
        // =========================================================
        const minDim = Math.min(width, height);
        
        // Perfekt austarierte, proportionale Orbits (kein Herausrutschen aus dem Screen)
        const radiusX = (minDim * 0.38) * (1.0 + Math.sin(this.internalT * 0.4) * 0.25) * scaleMultiplier;
        const radiusY = (minDim * 0.28) * (1.0 + Math.cos(this.internalT * 0.5) * 0.2) * scaleMultiplier;
        
        // Proportionale Skalierung der Sprite-Größe an die Bildschirmauflösung
        const baseBobSize = 6.0 + minDim * 0.022; 
        const phaseStep = (Math.PI * 2) / this.numBobs;
        
        for (let i = 0; i < this.numBobs; i++) {
            const phase = i * phaseStep;
            const x = cx + Math.sin(this.internalT * 1.4 + phase) * radiusX;
            const y = cy + Math.sin(this.internalT * 2.1 + phase) * Math.cos(this.internalT * 1.1 + phase) * radiusY;
            
            const size = (baseBobSize + Math.sin(this.internalT * 3.5 + phase) * (baseBobSize * 0.4)) * scaleMultiplier + (metrics.beat[0] * beatScale);
            
            ctx.drawImage(this.bobCanvas, x - size / 2, y - size / 2, size, size);
        }
        ctx.globalAlpha = 1.0;
    }
}