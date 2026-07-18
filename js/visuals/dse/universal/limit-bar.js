// === js/visuals/dse/universal/limit-bar.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: LIMIT BAR (v3.0.0 - Alpha-Free Edition)
// 100% Alpha-free. No modern composite operations.
// C64: Chunk-raster blocks with VIC-II palette bindings.
// Amiga: 12-Bit OCS stepped copperlists & opaque white-hot sweeps.
// Atari: Deterministic vector sparks drawn via Bresenham drawAliasedLine.
// Features structural vertical slide-out transition instead of transparency fade.
// =========================================================

import { C64_PALETTE, rgbToHex, quantizeAmiga12Bit, quantizeAtari9Bit, drawAliasedLine } from '../../utils/hardware-constraints.js';

export class LimitBar {
    constructor() {
        this.displayAlpha = 0.0; 
        this.frameCounter = 0;

        // Vorberechnete Sinus-Tabelle für deterministischen ST-Funkenflug
        this.sinLUT = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
            this.sinLUT[i] = Math.sin((i / 256) * Math.PI * 2);
        }
    }

    resize(width, height) {}

    render(ctx, width, height, t, state, stateTime, metrics) {
        if (state === 'idle') return;

        this.frameCounter++;

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

        // Bounding Box (Kompakt und ganzzahlig!)
        const w = Math.floor(width * 0.75);
        const h = Math.max(4, Math.floor(height * 0.025)) | 0;
        const x = Math.floor((width - w) / 2);
        const y = height - h - Math.floor(height * 0.06);

        // --- RETRO-UPGRADE: DER MECHANISCHE SCHLITTEN-EINZUG ---
        // Statt transparent zu faden, rutscht der Balken am unteren Rand komplett raus!
        let currentY = Math.floor(height - (height - y) * globalAlpha);
        if (currentY >= height - 1) return; // Beendet Render-Prozess, wenn unsichtbar (CPU Boost!)

        if (metrics.system === 'c64') {
            // --- STRICT C64 PALETTE BINDING ---
            let segCount = 20; let gap = 2;
            let segW = (w / segCount) - gap;
            let activeSegs = Math.floor(pct * segCount);
            let activeW = activeSegs > 0 ? (activeSegs * (segW + gap) - gap) : 0;

            if (animIntensity > 0.05 && activeW > 0) {
                let borderThick = Math.floor(1 + animIntensity * 2); 
                let numStripes = 6;
                let stripeH = (h + borderThick * 2) / numStripes;
                
                const c64Colors = [6, 14, 15, 1, 10, 7].map(idx => rgbToHex(...C64_PALETTE[idx]));
                
                for (let i = 0; i < numStripes; i++) {
                    let colIdx = Math.floor((t * (5 + animIntensity * 15) + i) % 4);
                    // Deterministisches Flimmern statt Math.random()
                    if (animIntensity >= 1.0 && metrics.beat[0] > 0.3) {
                        colIdx = 4 + ((this.frameCounter + i) % 2); 
                    }
                    
                    ctx.fillStyle = c64Colors[colIdx];
                    ctx.fillRect(x - borderThick, Math.floor(currentY - borderThick + i * stripeH), activeW + borderThick * 2, Math.ceil(stripeH));
                }
            }

            for (let i = 0; i < activeSegs; i++) {
                let color = rgbToHex(...C64_PALETTE[14]); 
                if (i >= 19) color = rgbToHex(...C64_PALETTE[10]);      
                else if (i >= 10) color = rgbToHex(...C64_PALETTE[1]);  
                
                if (isFlashing) color = rgbToHex(...C64_PALETTE[1]);
                
                ctx.fillStyle = color;
                ctx.fillRect(Math.floor(x + i * (segW + gap)), currentY, Math.floor(segW), h); 
            }

        } else if (metrics.system === 'amiga') {
            // --- 12-BIT AMIGA COPPERLIST STEPS (Absolut OCS-Banding!) ---
            let activeW = w * pct;

            if (pct > 0) {
                const cBlue = [0, 85, 255];
                const cOrange = [255, 136, 0];
                const cRed = [255, 0, 0];
                
                let stepSize = 4; // 4-Pixel breite Copperlist Segmente (strikter OCS Look)
                for (let px = 0; px < activeW; px += stepSize) {
                    let pctColor = px / w; // Farbe verankert sich fest an der Balken-Gesamtbreite
                    let r = 0, g = 0, b = 0;
                    
                    if (pctColor < 0.5) {
                        let stepT = pctColor / 0.5;
                        r = Math.floor(cBlue[0] + (cOrange[0] - cBlue[0]) * stepT);
                        g = Math.floor(cBlue[1] + (cOrange[1] - cBlue[1]) * stepT);
                        b = Math.floor(cBlue[2] + (cOrange[2] - cBlue[2]) * stepT);
                    } else {
                        let stepT = (pctColor - 0.5) / 0.5;
                        r = Math.floor(cOrange[0] + (cRed[0] - cOrange[0]) * stepT);
                        g = Math.floor(cOrange[1] + (cRed[1] - cOrange[1]) * stepT);
                        b = Math.floor(cOrange[2] + (cRed[2] - cOrange[2]) * stepT);
                    }
                    
                    let qColor = quantizeAmiga12Bit(r, g, b);
                    ctx.fillStyle = rgbToHex(qColor[0], qColor[1], qColor[2]);
                    
                    let drawW = Math.min(stepSize, activeW - px);
                    ctx.fillRect(x + px, currentY, drawW, h);
                }
            }

            // Opaque Sweep Highlight (Absolut 100% Alpha-frei!)
            if (animIntensity > 0.05 && activeW > 0) {
                let sweepSpeed = t * (2 + animIntensity * 8);
                let sweepPos = Math.floor((Math.sin(sweepSpeed) * 0.5 + 0.5) * activeW);
                
                // Draw pure, deckende weiße Blöcke (Wertüberschreibung im Farb-Register)
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(x + sweepPos - 4, currentY - 2, 8, h + 4);
                
                if (animIntensity >= 1.0) {
                    let bY = currentY + h/2 + Math.floor(Math.sin(t * 20) * 4);
                    ctx.fillRect(x - 4, bY - 1, 2, 2);
                    ctx.fillRect(x + activeW + 2, bY - 1, 2, 2);
                }
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

            // Vektor-Sparks shooting out
            if (animIntensity > 0.05 && activeW > 0) {
                let numSparks = Math.floor(animIntensity * 12);
                if (animIntensity >= 1.0) numSparks = 25; 
                
                for(let i=0; i < numSparks; i++) {
                    // Deterministischer Pseudo-Zufalls-Lookup über unsere Sinus-LUT
                    let seed = (this.frameCounter * 37 + i * 59) & 255;
                    let rVal1 = Math.abs(this.sinLUT[seed]);
                    let rVal2 = Math.abs(this.sinLUT[(seed + 80) & 255]);
                    let rVal3 = Math.abs(this.sinLUT[(seed + 160) & 255]);

                    let edge = Math.floor(rVal1 * 4);
                    let sx, sy, dx, dy;
                    
                    let offset = (rVal2 - 0.5) * (4 + animIntensity * 5);
                    let sparkLen = rVal3 * 4 * animIntensity;
                    
                    if (edge === 0) { sx = x + rVal1 * activeW; sy = currentY - 4; dx = sx + offset; dy = sy - sparkLen; } 
                    else if (edge === 1) { sx = x + rVal1 * activeW; sy = currentY + h + 4; dx = sx + offset; dy = sy + sparkLen; } 
                    else if (edge === 2) { sx = x - 4; sy = currentY + rVal1 * h; dx = sx - sparkLen; dy = sy + offset; } 
                    else { sx = x + activeW + 4; sy = currentY + rVal1 * h; dx = sx + sparkLen; dy = sy + offset; } 
                    
                    let sparkColor = animIntensity >= 1.0 ? '#ffffff' : cGreen;
                    
                    // --- STRENGES ATARI-RESTRIKTION UPGRADE ---
                    // Keine Kantenglättung über ctx.lineTo()! Wir zeichnen die Vektoren
                    // über die pixelgenaue Bresenham-Routine (drawAliasedLine).
                    drawAliasedLine(ctx, sx, sy, dx, dy, sparkColor);
                }
            }

            if (activeSegs > 0) {
                for (let i = 0; i < activeSegs; i++) {
                    let color = cGreen;
                    if (i >= 23) color = cRed;      
                    else if (i >= 12) color = cYellow; 
                    
                    if (isFlashing) color = '#ffffff'; 
                    
                    ctx.fillStyle = color;
                    ctx.fillRect(x + i * (segW + gap), currentY, segW, h); 
                }
            }
        }
    }
}