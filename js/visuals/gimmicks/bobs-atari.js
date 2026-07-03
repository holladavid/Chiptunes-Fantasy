// === js/visuals/gimmicks/bobs-atari.js ===
// =========================================================
// CLASSIC LISSAJOUS METAL-BOB CHAIN (ATARI ST BLITTER GIMMICK)
// Features: Pure mathematical choreography (music-independent),
// pre-rendered 3D sphere sprites, and dynamically morphing orbits.
// =========================================================

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
        const hx = cx - 5;
        const hy = cy - 5;
        
        const grad = bCtx.createRadialGradient(hx, hy, 1, cx, cy, this.bobSize / 2);
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

    render(ctx, width, height, t) {
        const cx = width / 2;
        const cy = height / 2;
        
        // CHOREOGRAPHIE UPGRADE: Morphing Lissajous
        // Radien für X und Y atmen unabhängig voneinander über die Zeit (t)
        // Dadurch verändert der Schwarm laufend fließend seine Form!
        const radiusX = (width * 0.25) * (1.0 + Math.sin(t * 0.4) * 0.25);
        const radiusY = (height * 0.3) * (1.0 + Math.cos(t * 0.5) * 0.2);
        
        const phaseStep = (Math.PI * 2) / this.numBobs;
        
        for (let i = 0; i < this.numBobs; i++) {
            const phase = i * phaseStep;
            
            const x = cx + Math.sin(t * 1.4 + phase) * radiusX;
            const y = cy + Math.sin(t * 2.1 + phase) * Math.cos(t * 1.1 + phase) * radiusY;
            
            // Pulsierende Größe auf Basis der eigenen Position in der Welle
            const size = 16 + Math.sin(t * 3.5 + phase) * 8;
            
            ctx.drawImage(this.bobCanvas, x - size / 2, y - size / 2, size, size);
        }
    }
}