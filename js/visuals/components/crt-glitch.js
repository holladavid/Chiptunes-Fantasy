// === js/visuals/components/crt-glitch.js ===
// =========================================================
// CRT DEGAUSS & POWER-CYCLE GLITCH EFFECT
// Zero-allocation post-processing effect triggered via events.
// =========================================================

export class CrtGlitch {
    constructor() {
        this.timer = 0;
        this.duration = 0.6; // 600ms Glitch Dauer
        
        // Lauscht auf den Hardware-Bus, ohne enge Kopplung an die UI
        window.addEventListener('trigger-glitch', () => {
            this.timer = this.duration;
        });
    }

    render(ctx, width, height, dt) {
        if (this.timer <= 0) return;
        
        this.timer -= dt;
        let p = Math.max(0, this.timer / this.duration); 
        
        // Hüllkurve: Beginnt schwach, peakt bei 50% (0.5), endet schwach
        let env = Math.sin(p * Math.PI);
        
        ctx.save();
        
        // 1. Degauss-Tearing (Statische Noise-Balken, die das Bild zerreißen)
        const numBands = Math.floor(Math.random() * 8 * env);
        for (let i = 0; i < numBands; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#000000';
            ctx.globalAlpha = Math.random() * env * 0.9;
            let by = Math.random() * height;
            let bh = Math.random() * 25 * env + 2;
            ctx.fillRect(0, by, width, bh);
        }

        // 2. Phosphor Misalignment (Scharfer RGB-Split)
        if (env > 0.4 && Math.random() > 0.3) {
            ctx.globalCompositeOperation = 'screen';
            ctx.globalAlpha = env * 0.6;
            
            let offset = (Math.random() - 0.5) * 30 * env;
            
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(offset, 0, width, height);
            
            ctx.fillStyle = '#0000ff';
            ctx.fillRect(-offset, 0, width, height);
        }
        
        ctx.restore();
    }
}