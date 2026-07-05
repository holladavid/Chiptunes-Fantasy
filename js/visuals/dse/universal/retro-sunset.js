// === js/visuals/dse/universal/retro-sunset.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: IK+ RETRO SUNSET
// System-Themed Background Scenario (C64 Chunky, Amiga Copper, Atari Raster)
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
            this.sunPulse = metrics.pulse[0]; 
        }

        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * 0.05;
        this.waterTension += (targetWaterTension - this.waterTension) * 0.1;
        this.sunPulse += (0.0 - this.sunPulse) * 0.1; 
        this.internalT += dt * this.smoothedSpeed;

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

        let waveSpeed = this.internalT * 30;
        for (let y = horizon; y < h; y += 8) {
            let offset = (waveSpeed + y * 2) % 40;
            for (let x = 0; x < w; x += 40) {
                if (Math.abs((x - offset) - w / 2) < sunR * 0.8 && y > horizon + 16) {
                    ctx.fillStyle = (Math.random() > 0.2) ? '#ffff33' : '#ff8a8a';
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

        ctx.fillStyle = '#000022'; 
        ctx.fillRect(0, horizon, w, h - horizon);

        ctx.fillStyle = '#ff8800';
        let distortion = 5 + (this.waterTension * 15); 
        for (let y = horizon; y < h; y += 3) {
            let depth = (y - horizon) / (h - horizon); 
            let waveWidth = 40 + (depth * 100);
            let xOffset = Math.sin((y * 0.1) + (this.internalT * 2.0)) * distortion;
            
            ctx.globalAlpha = Math.max(0, 1.0 - (depth * 1.5));
            ctx.fillRect(sx - (waveWidth / 2) + xOffset, y, waveWidth, 2);
        }
        ctx.globalAlpha = 1.0;
    }

    // =========================================================
    // ATARI ST: HORIZONTAL RASTER LINES & 16-COLOR PALETTE
    // =========================================================
    drawAtari(ctx, w, h, horizon) {
        // Sky: Purple to Orange sunset raster bands
        const skyColors = ['#000033', '#220033', '#440022', '#660011', '#880000', '#aa2200', '#cc4400', '#ff6600'];
        let skyBands = skyColors.length;
        let bandH = horizon / skyBands;
        for (let i = 0; i < skyBands; i++) {
            ctx.fillStyle = skyColors[i];
            ctx.fillRect(0, Math.floor(i * bandH), w, Math.ceil(bandH));
        }

        // Sun: Blocky without anti-aliasing
        let sx = w / 2, sy = horizon - 25;
        let sunR = 40 + (this.sunPulse * 15);
        ctx.fillStyle = '#ffff55';
        ctx.fillRect(sx - sunR, sy - sunR*0.4, sunR*2, sunR*0.8);
        ctx.fillRect(sx - sunR*0.8, sy - sunR*0.8, sunR*1.6, sunR*1.6);
        ctx.fillRect(sx - sunR*0.4, sy - sunR, sunR*0.8, sunR*2);

        // Water: Deep blue base
        ctx.fillStyle = '#000022';
        ctx.fillRect(0, horizon, w, h - horizon);

        // Water Reflections: Perspective Cyan/Blue raster lines
        let waterSpeed = this.internalT * (20 + this.waterTension * 30);
        
        // Pseudo-3D Z-Schleife: Linienabstand und Dicke wachsen nach unten
        for (let y = horizon + 2; y < h; y += (y - horizon) * 0.15 + 4) {
            let depth = (y - horizon) / (h - horizon);
            let thickness = Math.max(1, Math.floor(depth * 5));
            
            let speed = waterSpeed * (0.5 + depth * 1.5);
            let offset = speed % 40;

            for (let x = -40; x < w; x += 40) {
                // Sonnenreflexion im Zentrum
                if (Math.abs(x + offset - sx) < sunR * (1.0 - depth*0.5) && y < horizon + 80) {
                    ctx.fillStyle = '#ffff55'; 
                } else {
                    // Wasserwellen in klassischem ST-Cyan und Hellblau
                    ctx.fillStyle = (Math.floor(y) % 3 === 0) ? '#0044aa' : '#0077ff'; 
                }
                
                let dashWidth = 20 + depth * 20;
                ctx.fillRect(x + offset, Math.floor(y), dashWidth, thickness);
            }
        }
    }
}