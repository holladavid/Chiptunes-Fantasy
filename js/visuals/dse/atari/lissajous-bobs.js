// === js/visuals/dse/atari/lissajous-bobs.js ===

export class AtariBobs {
    constructor() {
        this.name = 'Atari Lissajous Bobs';
        this.computerType = ['atari'];
        this.placementType = 'foreground';

        this.numBobs = 45;
        this.bobSize = 32; 
        
        // Pre-Rendered Sprite (Zero-Allocation on execution)
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
    }

    resize(width, height) {}

    render(ctx, width, height, t, state, stateTime, metrics) {
        if (state === 'Idle') return;

        let globalAlpha = 1.0;
        let speedMultiplier = 1.0;
        let scaleMultiplier = 1.0;

        if (state === 'Starting') {
            globalAlpha = Math.min(1.0, stateTime / 1.5);
            scaleMultiplier = globalAlpha;
        } else if (state === 'Stopping') {
            globalAlpha = Math.max(0.0, 1.0 - (stateTime / 1.5));
            scaleMultiplier = globalAlpha;
        } else if (state === 'Buildup') {
            speedMultiplier = 1.5;
        } else if (state === 'Climax') {
            speedMultiplier = 2.0;
            globalAlpha = 0.8 + (metrics.pulse[0] * 0.2);
            scaleMultiplier = 1.0 + (metrics.pulse[0] * 0.5); // Die Bobs werden dicker beim Beat
        }

        ctx.globalAlpha = globalAlpha;

        const cx = width / 2;
        const cy = height / 2;
        
        const radiusX = (width * 0.25) * (1.0 + Math.sin(t * 0.4) * 0.25) * scaleMultiplier;
        const radiusY = (height * 0.3) * (1.0 + Math.cos(t * 0.5) * 0.2) * scaleMultiplier;
        
        const phaseStep = (Math.PI * 2) / this.numBobs;
        
        for (let i = 0; i < this.numBobs; i++) {
            const phase = i * phaseStep;
            
            const x = cx + Math.sin(t * 1.4 * speedMultiplier + phase) * radiusX;
            const y = cy + Math.sin(t * 2.1 * speedMultiplier + phase) * Math.cos(t * 1.1 * speedMultiplier + phase) * radiusY;
            
            const size = (16 + Math.sin(t * 3.5 + phase) * 8) * scaleMultiplier;
            
            ctx.drawImage(this.bobCanvas, x - size / 2, y - size / 2, size, size);
        }

        ctx.globalAlpha = 1.0;
    }
}