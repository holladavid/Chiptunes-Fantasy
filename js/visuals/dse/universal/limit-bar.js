// === js/visuals/dse/universal/limit-bar.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: TENSION LIMIT BAR
// System-Themed reactive tension visualization (Borderless, No-Text)
// Includes precision color mapping for Tension state milestones.
// =========================================================

const C64_COLS = ['#352879', '#6c5eb5', '#b5b5b5', '#ffffff', '#ff8a8a', '#ffff33'];

export class LimitBar {
    constructor() {
        this.displayAlpha = 0.0; 
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
            } else if (metrics.isClimaxLocked) {
                pct = Math.max(0.0, 1.0 - (metrics.climaxTimer / metrics.climaxHoldTime));
            }
            // Micro-Dynamics: Strobe-Flashing ist 100% synchron zur Kick-Drum
            isFlashing = (metrics.beat[0] > 0.5);
        }
        pct = Math.max(0, Math.min(1.0, pct));

        let isActive = (pct > 0.001 || state === 'climax' || metrics.isClimaxLocked);
        let targetAlpha = isActive ? 1.0 : 0.0;
        
        this.displayAlpha += (targetAlpha - this.displayAlpha) * 0.1;

        let globalAlpha = 1.0;
        if (state === 'starting') {
            globalAlpha = Math.min(1.0, stateTime / 1.5);
        } else if (state === 'stopping') {
            globalAlpha = Math.max(0.0, 1.0 - (stateTime / 1.5));
        }
        
        globalAlpha *= this.displayAlpha;
        if (globalAlpha <= 0.01) return;
        ctx.globalAlpha = globalAlpha;

        const w = 240;
        const h = 18;
        const x = 20;
        const y = height - h - 20;

        if (metrics.system === 'c64') {
            // --- C64 STYLE ---
            let segCount = 20;
            let gap = 2;
            let segW = (w / segCount) - gap;
            let activeSegs = Math.floor(pct * segCount);
            let activeW = activeSegs > 0 ? (activeSegs * (segW + gap) - gap) : 0;

            if (animIntensity > 0.05 && activeW > 0) {
                let borderThick = Math.floor(2 + animIntensity * 6);
                let numStripes = 6;
                let stripeH = (h + borderThick * 2) / numStripes;
                for (let i = 0; i < numStripes; i++) {
                    let colIdx = Math.floor((t * (5 + animIntensity * 15) + i) % 4);
                    // Flackert rot/gelb bei extremem Beat!
                    if (animIntensity >= 1.0 && metrics.beat[0] > 0.3) colIdx = 4 + Math.floor(Math.random() * 2); 
                    
                    ctx.fillStyle = C64_COLS[colIdx];
                    ctx.fillRect(x - borderThick, Math.floor(y - borderThick + i * stripeH), activeW + borderThick * 2, Math.ceil(stripeH));
                }
            }

            for (let i = 0; i < activeSegs; i++) {
                // Präzise Zuweisung anhand des Fortschritts:
                // 0-45% = Blau, 50-90% = Weiß, 95-100% = Rot
                let color = '#6c5eb5'; 
                if (i >= 19) color = '#ff8a8a';      // Das absolute Climax-Segment (100%)
                else if (i >= 10) color = '#ffffff'; // Die Tension Build-Up Phase (ab 50%)
                
                if (isFlashing) color = '#ffffff';
                
                ctx.fillStyle = color;
                ctx.fillRect(x + i * (segW + gap), y, segW, h); 
            }

        } else if (metrics.system === 'amiga') {
            // --- AMIGA STYLE ---
            let activeW = w * pct;

            if (animIntensity > 0.05 && activeW > 0) {
                let sweepSpeed = t * (2 + animIntensity * 8);
                let sweepPos = (Math.sin(sweepSpeed) * 0.5 + 0.5) * activeW;
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
                    ctx.fillRect(x + activeW + 2, Math.floor(bY) - 3, 6, 6);
                }
            }

            if (pct > 0) {
                // Harte Color-Stops für präzise Meilensteine
                let grad = ctx.createLinearGradient(x, y, x + activeW, y);
                grad.addColorStop(0.0, '#0055ff'); // Blau
                grad.addColorStop(0.5, '#ff8800'); // Orange (50%)
                grad.addColorStop(0.95, '#ff8800'); // Hält Orange bis kurz vor Schluss
                grad.addColorStop(1.0, '#ff0000'); // Rot beim Climax-Hit
                
                ctx.fillStyle = isFlashing ? '#ffffff' : grad;
                ctx.fillRect(x, y, activeW, h); 
            }

        } else {
            // --- ATARI ST STYLE ---
            let segCount = 24;
            let gap = 2;
            let segW = (w / segCount) - gap;
            let activeSegs = Math.floor(pct * segCount);
            let activeW = activeSegs > 0 ? (activeSegs * (segW + gap) - gap) : 0;

            if (animIntensity > 0.05 && activeW > 0) {
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
                    
                    if (edge === 0) { sx = x + Math.random() * activeW; sy = y - 4; dx = sx + offset; dy = sy - sparkLen; } 
                    else if (edge === 1) { sx = x + Math.random() * activeW; sy = y + h + 4; dx = sx + offset; dy = sy + sparkLen; } 
                    else if (edge === 2) { sx = x - 4; sy = y + Math.random() * h; dx = sx - sparkLen; dy = sy + offset; } 
                    else { sx = x + activeW + 4; sy = y + Math.random() * h; dx = sx + sparkLen; dy = sy + offset; } 
                    
                    ctx.moveTo(sx, sy);
                    ctx.lineTo(dx, dy);
                }
                ctx.stroke();
            }

            if (activeSegs > 0) {
                for (let i = 0; i < activeSegs; i++) {
                    // Präzise Zuweisung anhand des Fortschritts:
                    let color = '#55ff55'; // 0-50% = Grün
                    if (i >= 23) color = '#ff3333';      // Das absolute Climax-Segment (100%)
                    else if (i >= 12) color = '#ffff33'; // Die Tension Build-Up Phase (ab 50%)
                    
                    if (isFlashing) color = '#ffffff'; 
                    
                    ctx.fillStyle = color;
                    ctx.fillRect(x + i * (segW + gap), y, segW, h); 
                }
            }
        }
        ctx.globalAlpha = 1.0;
    }
}