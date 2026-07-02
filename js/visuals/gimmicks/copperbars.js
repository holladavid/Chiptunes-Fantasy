// === js/visuals/gimmicks/copperbars.js ===
// =========================================================
// REAL-TIME COPPERBARS (RASTERBARS) COMPONENT
// Encapsulates sinusoidal math, color palettes, and rendering
// =========================================================

export class Copperbars {
    constructor() {
        this.sinTimes = [1.3, 1.9, 1.6, 2.2];
        this.sinOffsets = [0.0, 2.0, 4.0, 1.5];
        this.baseThickness = [18, 14, 12, 10]; 
        this.heightWeights = [0.28, 0.33, 0.22, 0.25];
    }

    drawCopperbar(ctx, w, y, height, volume, colorStart, colorEnd) {
        if (volume <= 0.01) return;
        const grad = ctx.createLinearGradient(0, y, 0, y + height);
        grad.addColorStop(0.0, '#000000');
        grad.addColorStop(0.18, colorStart);
        grad.addColorStop(0.5, '#ffffff'); 
        grad.addColorStop(0.82, colorEnd);
        grad.addColorStop(1.0, '#000000');
        
        ctx.fillStyle = grad;
        ctx.fillRect(0, y, w, height);
    }

    render(ctx, width, height, t, channelVolumes) {
        const isAmiga = document.body.classList.contains('theme-amiga');
        const isAtari = document.body.classList.contains('theme-atari');
        
        const numBars = isAmiga ? 4 : 3;
        const pals = [
            isAtari ? ['#003300', '#00aa00'] : isAmiga ? ['#000066', '#0055ff'] : ['#201a60', '#6c5eb5'],
            isAtari ? ['#333300', '#aaaa00'] : isAmiga ? ['#663300', '#ff8800'] : ['#660033', '#ff00aa'],
            isAtari ? ['#003333', '#00aaaa'] : isAmiga ? ['#330066', '#aa00ff'] : ['#333333', '#aaaaaa'],
            isAmiga ? ['#111111', '#888888'] : []
        ];

        // Screen-Blending für analogen Farb-Overlap aktivieren
        ctx.globalCompositeOperation = "screen"; 
        for (let c = 0; c < numBars; c++) {
            const vol = channelVolumes[c] || 0;
            const punch = vol * 28; 
            
            const yCenter = (height / 2) + Math.sin(t * this.sinTimes[c] + this.sinOffsets[c]) * (height * this.heightWeights[c]);
            this.drawCopperbar(ctx, width, yCenter - (this.baseThickness[c] + punch) / 2, this.baseThickness[c] + punch, vol, pals[c][0], pals[c][1]);
        }
        ctx.globalCompositeOperation = "source-over";
    }
}