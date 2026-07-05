// === js/visuals/dse/atari/lissajous-bobs.js ===

export class AtariBobs {
    constructor() {
        this.numBobs = 45;
        this.bobSize = 32; 
        
        this.bobCanvas = document.createElement('canvas');
        this.bobCanvas.width = this.bobSize;
        this.bobCanvas.height = this.bobSize;
        const bCtx = this.bobCanvas.getContext('2d');
        
        const cx = this.bobSize / 2;
        const cy = this.bobSize / 2;
        const grad = bCtx.createRadialGradient(cx - 5, cy - 5, 1, cx, cy, this.bobSize / 2);
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

        if (state === 'starting') {
            globalAlpha = Math.min(1.0, stateTime / 1.5);
            scaleMultiplier = globalAlpha;
        } else if (state === 'stopping') {
            globalAlpha = Math.max(0.0, 1.0 - (stateTime / 1.5));
            scaleMultiplier = globalAlpha;
        } else if (state === 'buildup') {
            targetSpeed = 1.5;
        } else if (state === 'climax') {
            targetSpeed = 2.0;
            globalAlpha = 0.8 + (metrics.pulse[0] * 0.2);
            scaleMultiplier = 1.0 + (metrics.pulse[0] * 0.5); 
        }

        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * 0.05;
        this.internalT += dt * this.smoothedSpeed;

        ctx.globalAlpha = globalAlpha;

        const cx = width / 2;
        const cy = height / 2;
        
        const radiusX = (width * 0.25) * (1.0 + Math.sin(this.internalT * 0.4) * 0.25) * scaleMultiplier;
        const radiusY = (height * 0.3) * (1.0 + Math.cos(this.internalT * 0.5) * 0.2) * scaleMultiplier;
        
        const phaseStep = (Math.PI * 2) / this.numBobs;
        
        for (let i = 0; i < this.numBobs; i++) {
            const phase = i * phaseStep;
            const x = cx + Math.sin(this.internalT * 1.4 + phase) * radiusX;
            const y = cy + Math.sin(this.internalT * 2.1 + phase) * Math.cos(this.internalT * 1.1 + phase) * radiusY;
            const size = (16 + Math.sin(this.internalT * 3.5 + phase) * 8) * scaleMultiplier;
            
            ctx.drawImage(this.bobCanvas, x - size / 2, y - size / 2, size, size);
        }

        ctx.globalAlpha = 1.0;
    }
}