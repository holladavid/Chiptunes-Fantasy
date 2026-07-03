// === js/visuals/gimmicks/bobs-atari.js ===
// =========================================================
// CLASSIC LISSAJOUS METAL-BOB CHAIN (ATARI ST BLITTER GIMMICK)
// Features: Pre-rendered 3D sphere sprites (Blitter-emulation),
// multi-phase Lissajous trajectory, and audio-reactive scale pumping.
// =========================================================

export class AtariBobs {
    constructor() {
        this.numBobs = 45;
        
        // =========================================================
        // GFX UPGRADE: PRE-RENDERED 3D BOB SPRITE (Blitter Emulation)
        // Wir zeichnen die schattierte Chrom-Kugel ein einziges Mal im Speicher, 
        // um das teure Echtzeit-Gradient-Rendering in der Schleife zu umgehen!
        // =========================================================
        this.bobSize = 32; // Basis-Auflösung des Sprites
        this.bobCanvas = document.createElement('canvas');
        this.bobCanvas.width = this.bobSize;
        this.bobCanvas.height = this.bobSize;
        const bCtx = this.bobCanvas.getContext('2d');
        
        const cx = this.bobSize / 2;
        const cy = this.bobSize / 2;
        
        // Der Glanzpunkt (Highlight) wird nach oben links verschoben für echten 3D-Effekt
        const hx = cx - 5;
        const hy = cy - 5;
        
        const grad = bCtx.createRadialGradient(hx, hy, 1, cx, cy, this.bobSize / 2);
        grad.addColorStop(0.0, '#ffffff');           // Weißer Heißpunkt (Specular Highlight)
        grad.addColorStop(0.2, '#99ff99');           // Pastell-Glanz
        grad.addColorStop(0.55, '#33ff33');          // Atari ST Giftgrün (Base)
        grad.addColorStop(0.85, '#005500');          // Dunkelgrüner Schatten (Ambient)
        grad.addColorStop(1.0, 'rgba(0, 10, 0, 0)'); // Alpha-Maske (Transparenter Rand)
        
        bCtx.fillStyle = grad;
        bCtx.beginPath();
        bCtx.arc(cx, cy, this.bobSize / 2, 0, Math.PI * 2);
        bCtx.fill();
    }

render(ctx, width, height, t, volume) {
        const cx = width / 2;
        const cy = height / 2;
        
        const radius = (height * 0.24) + (volume * 80);
        
        // =========================================================
        // GFX FIX: NAHTLOSE KREIS-VERTEILUNG (360 Grad / Kugelanzahl)
        // Das garantiert, dass die letzte Kugel nahtlos an die erste anschließt.
        // =========================================================
        const phaseStep = (Math.PI * 2) / this.numBobs;
        
        for (let i = 0; i < this.numBobs; i++) {
            // Jede Kugel bekommt ihren mathematisch perfekten Platz in der Kette
            const phase = i * phaseStep;
            const x = cx + Math.sin(t * 1.4 + phase) * radius * 1.5;
            const y = cy + Math.sin(t * 2.1 + phase) * Math.cos(t * 1.1 + phase) * radius;
            
            const baseSize = 12 + Math.sin(t * 3.5 + phase) * 5;
            const size = baseSize + (volume * 15);
            
            ctx.drawImage(this.bobCanvas, x - size / 2, y - size / 2, size, size);
        }
    }
}