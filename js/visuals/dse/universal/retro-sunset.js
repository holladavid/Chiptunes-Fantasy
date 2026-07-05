// === js/visuals/dse/universal/retro-sunset.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: IK+ RETRO SUNSET
// System-Themed Background Scenario (C64 Chunky, Amiga Copper, Atari Dither)
// Reacts heavily to Tension & Climax via sun-pulses and water distortion.
// =========================================================

export class RetroSunset {
    constructor() {
        this.internalT = 0;
        this.smoothedSpeed = 1.0;
        this.sunPulse = 0.0;
        this.waterTension = 0.0;
    }

    resize(width, height) {}

    render(ctx, width, height, t, state, stateTime, metrics) {
        if (state === 'idle') { this.lastT = t; return; }

        let dt = this.lastT === 0 ? 0.016 : t - this.lastT;
        this.lastT = t;

        let globalAlpha = 1.0;
        let targetSpeed = 1.0;
        let targetWaterTension = 0.0;

        if (state === 'starting') {
            globalAlpha = Math.min(1.0, stateTime / 1.5);
        } else if (state === 'stopping') {
            globalAlpha = Math.max(0.0, 1.0 - (stateTime / 1.5));
        } else if (state === 'buildup') {
            targetSpeed = 1.8;
            targetWaterTension = 0.5;
        } else if (state === 'climax') {
            targetSpeed = 2.5;
            targetWaterTension = 1.0;
            // Die Sonne pumpt bei Kickdrums
            this.sunPulse = metrics.pulse[0]; 
        }

        // Smooth Interpolators
        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * 0.05;
        this.waterTension += (targetWaterTension - this.waterTension) * 0.1;
        this.sunPulse += (0.0 - this.sunPulse) * 0.1; // Decay
        this.internalT += dt * this.smoothedSpeed;

        ctx.globalAlpha = globalAlpha;
        const horizon = height * 0.55; // Horizont-Linie leicht unter der Mitte

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
        // Blocky Sky Bands
        ctx.fillStyle = '#352879'; ctx.fillRect(0, 0, w, horizon * 0.3); // Dunkelblau
        ctx.fillStyle = '#8b4943'; ctx.fillRect(0, horizon * 0.3, w, horizon * 0.3); // Rot/Braun
        ctx.fillStyle = '#ff8a8a'; ctx.fillRect(0, horizon * 0.6, w, horizon * 0.25); // Hellrot
        ctx.fillStyle = '#ffff33'; ctx.fillRect(0, horizon * 0.85, w, horizon * 0.15); // Gelb

        // Chunky Sun (8x8 Blocks)
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

        // Water Base
        ctx.fillStyle = '#352879'; 
        ctx.fillRect(0, horizon, w, h - horizon);

        // Chunky Water Reflections (Moving Dashes)
        let waveSpeed = this.internalT * 30;
        for (let y = horizon; y < h; y += 8) {
            let offset = (waveSpeed + y * 2) % 40;
            for (let x = 0; x < w; x += 40) {
                // Sonnen-Reflektion im Wasser in der Mitte
                if (Math.abs((x - offset) - w / 2) < sunR * 0.8 && y > horizon + 16) {
                    ctx.fillStyle = (Math.random() > 0.2) ? '#ffff33' : '#ff8a8a';
                } else {
                    ctx.fillStyle = '#6c5eb5'; // Standard Wellen
                }
                ctx.fillRect(x - offset, y + 2, 20, 4);
            }
        }
    }

    // =========================================================
    // AMIGA: COPPER GRADIENTS & SINE WAVES
    // =========================================================
    drawAmiga(ctx, w, h, horizon) {
        // Copper Sky (Smooth Gradient)
        let skyGrad = ctx.createLinearGradient(0, 0, 0, horizon);
        skyGrad.addColorStop(0.0, '#000044');
        skyGrad.addColorStop(0.4, '#aa0044');
        skyGrad.addColorStop(0.8, '#ff4400');
        skyGrad.addColorStop(1.0, '#ffff00');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, horizon);

        // Smooth Sun with Glow
        let sunR = 50 + (this.sunPulse * 25);
        let sx = w / 2, sy = horizon - 10;
        
        ctx.beginPath();
        ctx.arc(sx, sy, sunR + 15, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(sx, sy, sunR, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        // Water Base
        ctx.fillStyle = '#000022'; 
        ctx.fillRect(0, horizon, w, h - horizon);

        // Sine-Wave Copper Water Reflections
        ctx.fillStyle = '#ff8800';
        let distortion = 5 + (this.waterTension * 15); // Wasser wird wilder im Climax
        for (let y = horizon; y < h; y += 3) {
            // Tiefenwirkung: Wellen werden breiter nach unten
            let depth = (y - horizon) / (h - horizon); 
            let waveWidth = 40 + (depth * 100);
            
            let xOffset = Math.sin((y * 0.1) + (this.internalT * 2.0)) * distortion;
            
            // Reflektion verblasst nach unten
            ctx.globalAlpha = Math.max(0, 1.0 - (depth * 1.5));
            ctx.fillRect(sx - (waveWidth / 2) + xOffset, y, waveWidth, 2);
        }
        ctx.globalAlpha = 1.0;
    }

    // =========================================================
    // ATARI ST: SHARP LINES & 16-COLOR LIMITS
    // =========================================================
    drawAtari(ctx, w, h, horizon) {
        // Sharp Sky Bands (Simulating limited ST palette dithering)
        ctx.fillStyle = '#000033'; ctx.fillRect(0, 0, w, horizon * 0.33);
        ctx.fillStyle = '#550000'; ctx.fillRect(0, horizon * 0.33, w, horizon * 0.33);
        ctx.fillStyle = '#aa5500'; ctx.fillRect(0, horizon * 0.66, w, horizon * 0.34);

        // Stepped Circle Sun (No Anti-Aliasing)
        let sx = w / 2, sy = horizon - 25;
        let sunR = 45 + (this.sunPulse * 10);
        
        ctx.fillStyle = '#ffff33';
        ctx.fillRect(sx - sunR, sy - sunR*0.5, sunR*2, sunR);
        ctx.fillRect(sx - sunR*0.8, sy - sunR*0.8, sunR*1.6, sunR*1.6);
        ctx.fillRect(sx - sunR*0.5, sy - sunR, sunR, sunR*2);

        // Water Base
        ctx.fillStyle = '#000022'; 
        ctx.fillRect(0, horizon, w, h - horizon);

        // Fast vector-like sharp lines (Delta Force Style)
        ctx.fillStyle = '#55ff55';
        let lineSpeed = this.internalT * (40 + this.waterTension * 60);
        for (let y = horizon + 5; y < h; y += 12) {
            let offset = (lineSpeed * (1.0 + (y-horizon)*0.01)) % w;
            
            // Raster-Line Breakup im Climax
            if (this.waterTension > 0.5 && Math.random() > 0.5) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, y, w, 2);
            } else {
                ctx.fillStyle = '#00aa00';
                ctx.fillRect(offset, y, 60, 2);
                ctx.fillRect(offset - w, y, 60, 2);
            }
            
            // Sun Reflection Block
            if (y < horizon + 60) {
                ctx.fillStyle = '#ffff33';
                ctx.fillRect(sx - 20, y, 40, 2);
            }
        }
    }
}