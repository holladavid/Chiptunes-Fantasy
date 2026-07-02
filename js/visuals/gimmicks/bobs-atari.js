// === js/visuals/gimmicks/bobs-atari.js ===
// =========================================================
// LISSAJOUS PIXEL-BOB SWARM (ATARI ST BLITTER GIMMICK)
// =========================================================

export class AtariBobs {
    constructor() {
        this.numBobs = 40;
    }

    render(ctx, width, height, t, volume) {
        const cx = width / 2;
        const cy = height / 2;
        
        // Der Bewegungsknoten dehnt sich bei lauten Frequenzen aus
        const radius = (height * 0.25) + (volume * 100);
        
        ctx.fillStyle = '#55ff55'; // Atari ST Giftgrün
        
        for (let i = 0; i < this.numBobs; i++) {
            // Klassische trigonometrische Lissajous-Kurve (Phasenverschoben)
            const phase = i * 0.15;
            const x = cx + Math.sin(t * 1.5 + phase) * radius * 1.5;
            const y = cy + Math.sin(t * 2.3 + phase) * Math.cos(t * 1.1 + phase) * radius;
            
            // Dicker Blitter-Objekt-Pixel
            const size = 8 + Math.sin(t * 3 + phase) * 4;
            ctx.fillRect(x - size/2, y - size/2, size, size);
        }
    }
}