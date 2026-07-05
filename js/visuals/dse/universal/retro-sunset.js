// === js/visuals/dse/universal/retro-sunset.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: IK+ RETRO SUNSET
// System-Themed Background Scenario (C64 Chunky, Amiga Copper, Atari Raster)
// Features distinct audio-reactive water & sun animations for all DJ states.
// =========================================================

export class RetroSunset {
    constructor() {
        this.internalT = 0;
        this.waterT = 0; // Unabhängiger Wasser-Akkumulator für saubere Geschwindigkeitswechsel
        
        // Glättungs-Akkumulatoren
        this.smoothedSpeed = 1.0;
        this.smoothedWaveSpeed = 1.0;
        this.smoothedDistortion = 1.0;
        this.sunPulse = 0.0;
        this.lastT = 0;
    }

    resize(width, height) {}

    render(ctx, width, height, t, state, stateTime, metrics) {
        if (state === 'idle') { this.lastT = t; return; }

        let dt = this.lastT === 0 ? 0.016 : t - this.lastT;
        this.lastT = t;

        let globalAlpha = 1.0;
        let targetSpeed = 1.0;
        let targetWaveSpeed = 1.0;
        let targetDistortion = 1.0;
        let targetSunPulse = 0.0;

        // =========================================================
        // STATE-ABHÄNGIGES ANIMATIONS-TUNING
        // =========================================================
        if (state === 'starting') {
            globalAlpha = Math.min(1.0, stateTime / 1.5);
        } else if (state === 'stopping') {
            globalAlpha = Math.max(0.0, 1.0 - (stateTime / 1.5));
        } else if (state === 'buildup') {
            targetSpeed = 1.5;
            targetWaveSpeed = 2.5;         // Wasser wird unruhiger
            targetDistortion = 2.0;        // Leicht stärkere Wellenverzerrung
            targetSunPulse = 0.15;         // Sonne atmet leicht (Vorahnung)
        } else if (state === 'climax') {
            targetSpeed = 2.0;
            targetWaveSpeed = 5.0;         // Wasser peitscht richtig
            targetDistortion = 5.0 + (metrics.pulse[0] * 3.0); // Heftige Verzerrung bei Beats
            targetSunPulse = 0.4 + (metrics.pulse[0] * 1.5);   // Sonne eskaliert zu Kickdrums
        }

        // =========================================================
        // SMOOTH INTERPOLATORS
        // =========================================================
        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * 0.05;
        this.smoothedWaveSpeed += (targetWaveSpeed - this.smoothedWaveSpeed) * 0.05;
        this.smoothedDistortion += (targetDistortion - this.smoothedDistortion) * 0.1;
        this.sunPulse += (targetSunPulse - this.sunPulse) * 0.15; 
        
        this.internalT += dt * this.smoothedSpeed;
        this.waterT += dt * this.smoothedWaveSpeed;

        ctx.globalAlpha = globalAlpha;
        const horizon = height * 0.55; 

        if (metrics.system === 'c64') {
            this.drawC64(ctx, width, height, horizon);
        } else if (metrics.system === 'amiga') {
            this.drawAmiga(ctx, width, height, horizon);
        } else {
            this.drawAtari(ctx, width, height, horizon);
        }

        ctx.globalAlpha = 1.0;
    }

    // =========================================================
    // C64: CHUNKY PIXELS & VIC-II PALETTE
    // =========================================================
    drawC64(ctx, w, h, horizon) {
        ctx.fillStyle = '#352879'; ctx.fillRect(0, 0, w, horizon * 0.3); 
        ctx.fillStyle = '#8b4943'; ctx.fillRect(0, horizon * 0.3, w, horizon * 0.3); 
        ctx.fillStyle = '#ff8a8a'; ctx.fillRect(0, horizon * 0.6, w, horizon * 0.25); 
        ctx.fillStyle = '#ffff33'; ctx.fillRect(0, horizon * 0.85, w, horizon * 0.15); 

        // Chunky Sun (Pumpt zum Beat)
        ctx.fillStyle = '#ffffff';
        let sunR = 40 + (this.sunPulse * 20);
        let sx = w / 2, sy = horizon - 20;
        for (let y = -sunR; y < sunR; y += 8) {
            for (let x = -sunR; x < sunR; x += 8) {
                if (x*x + y*y < sunR*sunR) {
                    ctx.fillRect(sx + x, sy + y, 8, 8);
                }
            }
        }

        ctx.fillStyle = '#352879'; 
        ctx.fillRect(0, horizon, w, h - horizon);

        // Chunky Water Reflections
        let waveSpeed = this.waterT * 25; // Reagiert auf die neue Wasser-Geschwindigkeit
        for (let y = horizon; y < h; y += 8) {
            let offset = (waveSpeed + y * 2) % 40;
            for (let x = 0; x < w; x += 40) {
                if (Math.abs((x - offset) - w / 2) < sunR * 0.8 && y > horizon + 16) {
                    // Im Climax flackern die Spiegelungen chaotischer
                    let isBright = (this.smoothedDistortion > 2.0) ? (Math.random() > 0.4) : (Math.random() > 0.2);
                    ctx.fillStyle = isBright ? '#ffff33' : '#ff8a8a';
                } else {
                    ctx.fillStyle = '#6c5eb5'; 
                }
                ctx.fillRect(x - offset, y + 2, 20, 4);
            }
        }
    }

    // =========================================================
    // AMIGA: COPPER GRADIENTS & SINE WAVES
    // =========================================================
    drawAmiga(ctx, w, h, horizon) {
        let skyGrad = ctx.createLinearGradient(0, 0, 0, horizon);
        skyGrad.addColorStop(0.0, '#000044');
        skyGrad.addColorStop(0.4, '#aa0044');
        skyGrad.addColorStop(0.8, '#ff4400');
        skyGrad.addColorStop(1.0, '#ffff00');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, horizon);

        // Sun Radius explodiert beim Climax leicht
        let sunR = 50 + (this.sunPulse * 30);
        let sx = w / 2, sy = horizon - 10;
        
        ctx.beginPath();
        ctx.arc(sx, sy, sunR + 15 + (this.sunPulse * 10), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 0, ${0.3 + this.sunPulse * 0.2})`; // Glow leuchtet stärker
        ctx.fill();

        ctx.beginPath();
        ctx.arc(sx, sy, sunR, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        ctx.fillStyle = '#000022'; 
        ctx.fillRect(0, horizon, w, h - horizon);

        ctx.fillStyle = '#ff8800';
        let distortion = 3 + (this.smoothedDistortion * 4); // Basis 3, steigert sich massiv im Climax
        for (let y = horizon; y < h; y += 3) {
            let depth = (y - horizon) / (h - horizon); 
            let waveWidth = 40 + (depth * 100);
            
            // Wasser zuckt bei hoher Tension wilder
            let xOffset = Math.sin((y * 0.1) + (this.waterT * 3.0)) * distortion;
            
            ctx.globalAlpha = Math.max(0, 1.0 - (depth * 1.5));
            ctx.fillRect(sx - (waveWidth / 2) + xOffset, y, waveWidth, 2);
        }
        ctx.globalAlpha = 1.0;
    }

    // =========================================================
    // ATARI ST: HIGH-RES 16-COLOR RASTER TRICKS & DITHERING
    // =========================================================
    drawAtari(ctx, w, h, horizon) {
        // 1. Sky: Raster Interrupt Bands (Klassische 16-Farben Limitierung)
        const skyColors = ['#000022', '#110033', '#220044', '#440022', '#660000', '#882200', '#aa4400', '#cc6600'];
        let bandH = horizon / skyColors.length;
        for (let i = 0; i < skyColors.length; i++) {
            ctx.fillStyle = skyColors[i];
            ctx.fillRect(0, Math.floor(i * bandH), w, Math.ceil(bandH));
        }

        let sx = w / 2, sy = horizon - 25;
        let sunR = 45 + (this.sunPulse * 15);

        // 2. High-Res Sun
        ctx.fillStyle = '#ffaa00'; 
        ctx.beginPath(); ctx.arc(sx, sy, sunR, 0, Math.PI * 2); ctx.fill();
        
        ctx.fillStyle = '#ffff55'; 
        ctx.beginPath(); ctx.arc(sx, sy, sunR * 0.7, 0, Math.PI * 2); ctx.fill();
        
        // 3. Fake Transparenz: Klassisches horizontales Linien-Dithering
        ctx.fillStyle = '#cc6600'; 
        for (let y = sy - sunR; y < sy + sunR; y += 4) {
            ctx.fillRect(sx - sunR, Math.floor(y), sunR * 2, 2);
        }

        // 4. Water Base
        ctx.fillStyle = '#000022';
        ctx.fillRect(0, horizon, w, h - horizon);

        // 5. Water Reflections: High-Res Horizontal Sine Displacement
        let waterSpeed = this.waterT * 5;
        let distortion = 2 + this.smoothedDistortion * 8; // Heftige Verzerrung bei Beats

        for (let y = horizon + 2; y < h; y += 4) {
            let depth = (y - horizon) / (h - horizon);
            
            // X-Offset Berechnung für die horizontale Wellenbrechung
            let xOffset = Math.sin(y * 0.2 + waterSpeed) * distortion;
            xOffset += Math.cos(y * 0.05 - waterSpeed * 0.5) * (distortion * 2.0 * depth);
            
            // Raster-Wellen in ST Cyan / Blau
            ctx.fillStyle = (Math.floor(y) % 8 === 0) ? '#0033aa' : '#0055ff';
            ctx.fillRect(0, Math.floor(y), w, 2);

            // Sonnen-Reflexion auf dem Wasser (zerbricht an den Wellen)
            let reflectW = sunR * (1.0 - depth * 0.5);
            if (y < horizon + 100) {
                ctx.fillStyle = '#ffff55';
                if (Math.sin(y * 0.5 + waterSpeed * 2) > -0.2) {
                    ctx.fillRect(sx - reflectW/2 + xOffset, Math.floor(y), reflectW, 2);
                }
            }

            // 6. CPU Overload Raster-Glitches (Exklusiv im Climax!)
            if (this.smoothedDistortion > 4.0 && Math.random() > 0.88) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, Math.floor(y), w, 1); // Gestochen scharfe, 1px weiße Blitze
            }
        }
    }
}