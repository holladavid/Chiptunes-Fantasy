// === js/visuals/dse/universal/limit-bar.js ===
import { C64_PALETTE, rgbToHex, quantizeAmiga12Bit, quantizeAtari9Bit } from '../../utils/hardware-constraints.js';

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
            isFlashing = (metrics.beat[0] > 0.5);
        }
        pct = Math.max(0, Math.min(1.0, pct));

        let isActive = (pct > 0.001 || state === 'climax' || metrics.isClimaxLocked);
        let targetAlpha = isActive ? 1.0 : 0.0;
        
        this.displayAlpha += (targetAlpha - this.displayAlpha) * 0.1;

        let globalAlpha = 1.0;
        if (state === 'starting') globalAlpha = Math.min(1.0, stateTime / 1.5);
        else if (state === 'stopping') globalAlpha = Math.max(0.0, 1.0 - (stateTime / 1.5));
        
        globalAlpha *= this.displayAlpha;
        if (globalAlpha <= 0.01) return;
        ctx.globalAlpha = globalAlpha;

        // PROPORTIONS-FIX: Viel eleganterer, schmalerer Hardware-Balken!
        const w = Math.floor(width * 0.75);
        const h = Math.max(4, Math.floor(height * 0.025)); // Nur noch ca. 4-6 Pixel hoch
        const x = Math.floor((width - w) / 2);
        const y = height - h - Math.floor(height * 0.06);  // Etwas mehr Luft nach unten

        if (metrics.system === 'c64') {
            // --- STRICT C64 PALETTE BINDING ---
            let segCount = 20; let gap = 2;
            let segW = (w / segCount) - gap;
            let activeSegs = Math.floor(pct * segCount);
            let activeW = activeSegs > 0 ? (activeSegs * (segW + gap) - gap) : 0;

            if (animIntensity > 0.05 && activeW > 0) {
                // PROPORTIONS-FIX: Dünnere Rahmen für 200p
                let borderThick = Math.floor(1 + animIntensity * 2); 
                let numStripes = 6;
                let stripeH = (h + borderThick * 2) / numStripes;
                
                // Hardware Farben: [6: DarkBlue, 14: LightBlue, 15: LightGrey, 1: White, 10: LightRed, 7: Yellow]
                const c64Colors = [6, 14, 15, 1, 10, 7].map(i => rgbToHex(...C64_PALETTE[i]));
                
                for (let i = 0; i < numStripes; i++) {
                    let colIdx = Math.floor((t * (5 + animIntensity * 15) + i) % 4);
                    if (animIntensity >= 1.0 && metrics.beat[0] > 0.3) colIdx = 4 + Math.floor(Math.random() * 2); 
                    
                    ctx.fillStyle = c64Colors[colIdx];
                    ctx.fillRect(x - borderThick, Math.floor(y - borderThick + i * stripeH), activeW + borderThick * 2, Math.ceil(stripeH));
                }
            }

            for (let i = 0; i < activeSegs; i++) {
                let color = rgbToHex(...C64_PALETTE[14]); // 14: Light Blue
                if (i >= 19) color = rgbToHex(...C64_PALETTE[10]);      // 10: Light Red (100%)
                else if (i >= 10) color = rgbToHex(...C64_PALETTE[1]);  // 1: White (50%)
                
                if (isFlashing) color = rgbToHex(...C64_PALETTE[1]);
                
                ctx.fillStyle = color;
                // Math.floor erzwingt kantenscharfes Rendering der Segmente
                ctx.fillRect(Math.floor(x + i * (segW + gap)), Math.floor(y), Math.floor(segW), Math.floor(h)); 
            }

        } else if (metrics.system === 'amiga') {
            // --- 12-BIT AMIGA COPPER GRADIENT ---
            let activeW = w * pct;

            if (animIntensity > 0.05 && activeW > 0) {
                let sweepSpeed = t * (2 + animIntensity * 8);
                let sweepPos = (Math.sin(sweepSpeed) * 0.5 + 0.5) * activeW;
                let glowAlpha = 0.2 + animIntensity * 0.5;
                
                ctx.globalCompositeOperation = 'screen';
                ctx.fillStyle = `rgba(255, 255, 255, ${glowAlpha})`;
                // PROPORTIONS-FIX: Schmalerer Glow
                ctx.fillRect(x + sweepPos - 5, y - 2, 10, h + 4);
                ctx.globalCompositeOperation = 'source-over';
                
                if (animIntensity >= 1.0) {
                    let bY = y + h/2 + Math.sin(t * 20) * 4;
                    ctx.fillStyle = '#ffffff';
                    // PROPORTIONS-FIX: Kleinere Peak-Sparks
                    ctx.fillRect(x - 4, Math.floor(bY) - 1, 2, 2);
                    ctx.fillRect(x + activeW + 2, Math.floor(bY) - 1, 2, 2);
                }
            }

            if (pct > 0) {
                // 12-Bit Quantisierte Color Stops
                const cBlue = rgbToHex(...quantizeAmiga12Bit(0, 85, 255));
                const cOrange = rgbToHex(...quantizeAmiga12Bit(255, 136, 0));
                const cRed = rgbToHex(...quantizeAmiga12Bit(255, 0, 0));
                
                let grad = ctx.createLinearGradient(x, y, x + activeW, y);
                grad.addColorStop(0.0, cBlue);
                grad.addColorStop(0.5, cOrange); 
                grad.addColorStop(0.95, cOrange); 
                grad.addColorStop(1.0, cRed); 
                
                ctx.fillStyle = isFlashing ? '#ffffff' : grad;
                ctx.fillRect(x, y, activeW, h); 
            }

        } else {
            // --- 9-BIT ATARI ST STYLE ---
            let segCount = 24; let gap = 2;
            let segW = (w / segCount) - gap;
            let activeSegs = Math.floor(pct * segCount);
            let activeW = activeSegs > 0 ? (activeSegs * (segW + gap) - gap) : 0;

            const cGreen = rgbToHex(...quantizeAtari9Bit(85, 255, 85));
            const cYellow = rgbToHex(...quantizeAtari9Bit(255, 255, 51));
            const cRed = rgbToHex(...quantizeAtari9Bit(255, 51, 51));

            if (animIntensity > 0.05 && activeW > 0) {
                ctx.strokeStyle = animIntensity >= 1.0 ? '#ffffff' : cGreen;
                ctx.lineWidth = 1; // PROPORTIONS-FIX: 1 Pixel für harte Atari-Linien
                
                let numSparks = Math.floor(animIntensity * 12);
                if (animIntensity >= 1.0) numSparks = 25; 
                
                ctx.beginPath();
                for(let i=0; i < numSparks; i++) {
                    let edge = Math.floor(Math.random() * 4);
                    let sx, sy, dx, dy;
                    // PROPORTIONS-FIX: Kürzere Funken
                    let offset = (Math.random() - 0.5) * (4 + animIntensity * 5);
                    let sparkLen = Math.random() * 4 * animIntensity;
                    
                    if (edge === 0) { sx = x + Math.random() * activeW; sy = y - 4; dx = sx + offset; dy = sy - sparkLen; } 
                    else if (edge === 1) { sx = x + Math.random() * activeW; sy = y + h + 4; dx = sx + offset; dy = sy + sparkLen; } 
                    else if (edge === 2) { sx = x - 4; sy = y + Math.random() * h; dx = sx - sparkLen; dy = sy + offset; } 
                    else { sx = x + activeW + 4; sy = y + Math.random() * h; dx = sx + sparkLen; dy = sy + offset; } 
                    
                    ctx.moveTo(sx, sy); ctx.lineTo(dx, dy);
                }
                ctx.stroke();
            }

            if (activeSegs > 0) {
                for (let i = 0; i < activeSegs; i++) {
                    let color = cGreen;
                    if (i >= 23) color = cRed;      
                    else if (i >= 12) color = cYellow; 
                    
                    if (isFlashing) color = '#ffffff'; 
                    
                    ctx.fillStyle = color;
                    ctx.fillRect(x + i * (segW + gap), y, segW, h); 
                }
            }
        }
        ctx.globalAlpha = 1.0;
    }
}