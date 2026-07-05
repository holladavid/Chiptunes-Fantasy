// === js/visuals/dse/universal/limit-bar.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: TENSION LIMIT BAR
// System-Themed reactive tension visualization (Borderless, No-Text)
// Includes zero-tension auto-fade mechanism
// =========================================================

const C64_COLS = ['#352879', '#6c5eb5', '#b5b5b5', '#ffffff', '#ff8a8a', '#ffff33'];

export class LimitBar {
    constructor() {
        this.displayAlpha = 0.0; // NEU: Steuert das Ein/Ausblenden bei leerem Barometer
    }

    resize(width, height) {}

    render(ctx, width, height, t, state, stateTime, metrics) {
        if (state === 'idle') return;

        let pct = metrics.tensionPct;
        let isFlashing = false;

        let animIntensity = (state === 'climax') ? 1.0 : pct;

        if (state === 'climax') {
            if (metrics.rawEnergyState === 'climax') {
                pct = 1.0;
                isFlashing = (performance.now() % 150 < 75); 
            } else if (metrics.isClimaxLocked) {
                pct = Math.max(0.0, 1.0 - (metrics.climaxTimer / metrics.climaxHoldTime));
                isFlashing = (pct > 0.85) && (performance.now() % 300 < 150); 
            }
        }
        pct = Math.max(0, Math.min(1.0, pct));

        // =========================================================
        // ZERO-TENSION FADE OUT
        // Ist das Fass leer, wird der Balken sanft ausgeblendet!
        // =========================================================
        let isActive = (pct > 0.001 || state === 'climax' || metrics.isClimaxLocked);
        let targetAlpha = isActive ? 1.0 : 0.0;
        
        this.displayAlpha += (targetAlpha - this.displayAlpha) * 0.1;

        let globalAlpha = 1.0;
        if (state === 'starting') {
            globalAlpha = Math.min(1.0, stateTime / 1.5);
        } else if (state === 'stopping') {
            globalAlpha = Math.max(0.0, 1.0 - (stateTime / 1.5));
        }
        
        // Multipliziere den Fade mit dem Start/Stop-State
        globalAlpha *= this.displayAlpha;

        // Wenn der Balken unsichtbar ist, brechen wir den teuren Render-Code ab!
        if (globalAlpha <= 0.01) return;

        ctx.globalAlpha = globalAlpha;

        const w = 240;
        const h = 18;
        const x = 20;
        const y = height - h - 20;

        if (metrics.system === 'c64') {
            if (animIntensity > 0.05) {
                let borderThick = Math.floor(2 + animIntensity * 6);
                let numStripes = 6;
                let stripeH = (h + borderThick * 2) / numStripes;
                for (let i = 0; i < numStripes; i++) {
                    let colIdx = Math.floor((t * (5 + animIntensity * 15) + i) % 4);
                    if (animIntensity >= 1.0 && Math.random() > 0.5) colIdx = 3 + Math.floor(Math.random() * 3); 
                    
                    ctx.fillStyle = C64_COLS[colIdx];
                    ctx.fillRect(x - borderThick, Math.floor(y - borderThick + i * stripeH), w + borderThick * 2, Math.ceil(stripeH));
                }
            }

            ctx.fillStyle = '#000000'; 
            ctx.fillRect(x, y, w, h);

            let segCount = 20;
            let gap = 2;
            let segW = (w / segCount) - gap;
            let activeSegs = Math.floor(pct * segCount);

            for (let i = 0; i < activeSegs; i++) {
                ctx.fillStyle = i > 15 ? '#ff8a8a' : (i > 10 ? '#ffffff' : '#6c5eb5');
                if (isFlashing) ctx.fillStyle = '#ffffff';
                ctx.fillRect(x + i * (segW + gap), y, segW, h); 
            }

        } else if (metrics.system === 'amiga') {
            if (animIntensity > 0.05) {
                let sweepSpeed = t * (2 + animIntensity * 8);
                let sweepPos = (Math.sin(sweepSpeed) * 0.5 + 0.5) * w;
                let glowAlpha = 0.2 + animIntensity * 0.5;
                
                ctx.globalCompositeOperation = 'screen';
                ctx.fillStyle = `rgba(255, 255, 255, ${glowAlpha})`;
                ctx.fillRect(x + sweepPos - 15, y - 4, 30, h + 8);
                ctx.fillStyle = `rgba(255, 255, 255, ${glowAlpha * 1.5})`;
                ctx.fillRect(x + sweepPos - 5, y - 4, 10, h + 8);
                ctx.globalCompositeOperation = 'source-over';
                
                if (animIntensity >= 1.0) {
                    let bY = y + h/2 + Math.sin(t * 20) * 8;
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(x - 8, Math.floor(bY) - 3, 6, 6);
                    ctx.fillRect(x + w + 2, Math.floor(bY) - 3, 6, 6);
                }
            }

            ctx.fillStyle = '#000000'; 
            ctx.fillRect(x, y, w, h);

            if (pct > 0) {
                let grad = ctx.createLinearGradient(x, y, x + w, y);
                grad.addColorStop(0.0, '#002288');
                grad.addColorStop(0.5, '#ff8800'); 
                grad.addColorStop(1.0, '#ff0000');
                
                ctx.fillStyle = isFlashing ? '#ffffff' : grad;
                ctx.fillRect(x, y, w * pct, h); 
            }

        } else {
            if (animIntensity > 0.05) {
                ctx.strokeStyle = animIntensity >= 1.0 ? '#ffffff' : '#55ff55';
                ctx.lineWidth = 1.5;
                
                let numSparks = Math.floor(animIntensity * 12);
                if (animIntensity >= 1.0) numSparks = 25; 
                
                ctx.beginPath();
                for(let i=0; i < numSparks; i++) {
                    let edge = Math.floor(Math.random() * 4);
                    let sx, sy, dx, dy;
                    let offset = (Math.random() - 0.5) * (10 + animIntensity * 15);
                    let sparkLen = Math.random() * 10 * animIntensity;
                    
                    if (edge === 0) { sx = x + Math.random() * w; sy = y - 4; dx = sx + offset; dy = sy - sparkLen; } 
                    else if (edge === 1) { sx = x + Math.random() * w; sy = y + h + 4; dx = sx + offset; dy = sy + sparkLen; } 
                    else if (edge === 2) { sx = x - 4; sy = y + Math.random() * h; dx = sx - sparkLen; dy = sy + offset; } 
                    else { sx = x + w + 4; sy = y + Math.random() * h; dx = sx + sparkLen; dy = sy + offset; } 
                    
                    ctx.moveTo(sx, sy);
                    ctx.lineTo(dx, dy);
                }
                ctx.stroke();
            }

            ctx.fillStyle = '#000000';
            ctx.fillRect(x, y, w, h);

            if (pct > 0) {
                let segCount = 24;
                let gap = 2;
                let segW = (w / segCount) - gap;
                let activeSegs = Math.floor(pct * segCount);

                for (let i = 0; i < activeSegs; i++) {
                    let color = '#55ff55'; 
                    if (i > 18) color = '#ff3333'; 
                    else if (i > 13) color = '#ffff33'; 
                    
                    if (isFlashing) color = '#ffffff'; 
                    
                    ctx.fillStyle = color;
                    ctx.fillRect(x + i * (segW + gap), y, segW, h); 
                }
            }
        }
        ctx.globalAlpha = 1.0;
    }
}