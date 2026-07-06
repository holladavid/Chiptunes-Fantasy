// === js/visuals/dse/universal/retro-sunset.js ===
export class RetroSunset {
    constructor() {
        this.internalT = 0; this.waterT = 0; 
        this.smoothedSpeed = 1.0; this.smoothedWaveSpeed = 1.0; this.lastT = 0;
    }
    resize(width, height) {}
    render(ctx, width, height, t, state, stateTime, metrics) {
        if (state === 'idle') { this.lastT = t; return; }
        let dt = this.lastT === 0 ? 0.016 : t - this.lastT;
        this.lastT = t;

        let globalAlpha = 1.0;
        let targetSpeed = 1.0;
        let targetWaveSpeed = 1.0;
        
        let beatIntensity = 0.0; // Control micro-dynamics per state

        if (state === 'starting') {
            globalAlpha = Math.min(1.0, stateTime / 1.5);
        } else if (state === 'stopping') {
            globalAlpha = Math.max(0.0, 1.0 - (stateTime / 1.5));
        } else if (state === 'buildup') {
            targetSpeed = 1.5;
            targetWaveSpeed = 2.5;         
            beatIntensity = 0.3; // Sanftes Pochen der Sonne
        } else if (state === 'climax') {
            targetSpeed = 2.0;
            targetWaveSpeed = 5.0;         
            beatIntensity = 1.0; // Maximaler optischer Pump-Effekt
        }

        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * 0.05;
        this.smoothedWaveSpeed += (targetWaveSpeed - this.smoothedWaveSpeed) * 0.05;
        
        this.internalT += dt * this.smoothedSpeed;
        this.waterT += dt * this.smoothedWaveSpeed;

        // Micro-Dynamics: Sofortige Weitergabe aus dem Beat-Envelope!
        let activeSunPulse = metrics.beat[0] * beatIntensity;
        let activeBeatDistortion = metrics.beat[0] * beatIntensity * 4.0;

        ctx.globalAlpha = globalAlpha;
        const horizon = height * 0.55; 

        if (metrics.system === 'c64') this.drawC64(ctx, width, height, horizon, activeSunPulse, activeBeatDistortion);
        else if (metrics.system === 'amiga') this.drawAmiga(ctx, width, height, horizon, activeSunPulse, activeBeatDistortion);
        else this.drawAtari(ctx, width, height, horizon, activeSunPulse, activeBeatDistortion);

        ctx.globalAlpha = 1.0;
    }

    drawC64(ctx, w, h, horizon, sunPulse, beatDistortion) {
        ctx.fillStyle = '#352879'; ctx.fillRect(0, 0, w, horizon * 0.3); 
        ctx.fillStyle = '#8b4943'; ctx.fillRect(0, horizon * 0.3, w, horizon * 0.3); 
        ctx.fillStyle = '#ff8a8a'; ctx.fillRect(0, horizon * 0.6, w, horizon * 0.25); 
        ctx.fillStyle = '#ffff33'; ctx.fillRect(0, horizon * 0.85, w, horizon * 0.15); 

        ctx.fillStyle = '#ffffff';
        let sunR = 40 + (sunPulse * 20); // Syncs directly to Kick drum
        let sx = w / 2, sy = horizon - 20;
        for (let y = -sunR; y < sunR; y += 8) {
            for (let x = -sunR; x < sunR; x += 8) {
                if (x*x + y*y < sunR*sunR) ctx.fillRect(sx + x, sy + y, 8, 8);
            }
        }

        ctx.fillStyle = '#352879'; ctx.fillRect(0, horizon, w, h - horizon);

        let waveSpeed = this.waterT * 25; 
        for (let y = horizon; y < h; y += 8) {
            let offset = (waveSpeed + y * 2) % 40;
            for (let x = 0; x < w; x += 40) {
                if (Math.abs((x - offset) - w / 2) < sunR * 0.8 && y > horizon + 16) {
                    let isBright = (beatDistortion > 2.0) ? (Math.random() > 0.4) : (Math.random() > 0.2);
                    ctx.fillStyle = isBright ? '#ffff33' : '#ff8a8a';
                } else {
                    ctx.fillStyle = '#6c5eb5'; 
                }
                ctx.fillRect(x - offset, y + 2, 20, 4);
            }
        }
    }

    drawAmiga(ctx, w, h, horizon, sunPulse, beatDistortion) {
        let skyGrad = ctx.createLinearGradient(0, 0, 0, horizon);
        skyGrad.addColorStop(0.0, '#000044'); skyGrad.addColorStop(0.4, '#aa0044'); skyGrad.addColorStop(0.8, '#ff4400'); skyGrad.addColorStop(1.0, '#ffff00');
        ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, w, horizon);

        let sunR = 50 + (sunPulse * 30);
        let sx = w / 2, sy = horizon - 10;
        
        ctx.beginPath(); ctx.arc(sx, sy, sunR + 15 + (sunPulse * 10), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 0, ${0.3 + sunPulse * 0.2})`; ctx.fill();

        ctx.beginPath(); ctx.arc(sx, sy, sunR, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();

        ctx.fillStyle = '#000022'; ctx.fillRect(0, horizon, w, h - horizon);

        ctx.fillStyle = '#ff8800';
        let distortion = 3 + (beatDistortion * 2.5); // Wasser verzerrt sich synchron zum Beat!
        for (let y = horizon; y < h; y += 3) {
            let depth = (y - horizon) / (h - horizon); let waveWidth = 40 + (depth * 100);
            let xOffset = Math.sin((y * 0.1) + (this.waterT * 3.0)) * distortion;
            ctx.globalAlpha = Math.max(0, 1.0 - (depth * 1.5));
            ctx.fillRect(sx - (waveWidth / 2) + xOffset, y, waveWidth, 2);
        }
        ctx.globalAlpha = 1.0;
    }

    drawAtari(ctx, w, h, horizon, sunPulse, beatDistortion) {
        const skyColors = ['#000033', '#220033', '#440022', '#660011', '#880000', '#aa2200', '#cc4400', '#ff6600'];
        let bandH = horizon / skyColors.length;
        for (let i = 0; i < skyColors.length; i++) { ctx.fillStyle = skyColors[i]; ctx.fillRect(0, Math.floor(i * bandH), w, Math.ceil(bandH)); }

        let sx = w / 2, sy = horizon - 25;
        let sunR = 45 + (sunPulse * 15);
        ctx.fillStyle = '#ffaa00'; ctx.beginPath(); ctx.arc(sx, sy, sunR, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffff55'; ctx.beginPath(); ctx.arc(sx, sy, sunR * 0.7, 0, Math.PI * 2); ctx.fill();
        
        ctx.fillStyle = '#cc6600'; 
        for (let y = sy - sunR; y < sy + sunR; y += 4) {
            let dy = y - sy; let dx = Math.sqrt((sunR * sunR) - (dy * dy));
            if (dx > 0) ctx.fillRect(sx - dx, Math.floor(y), dx * 2, 2);
        }

        ctx.fillStyle = '#000022'; ctx.fillRect(0, horizon, w, h - horizon);

        let waterSpeed = this.waterT * 25;
        let distortion = 2 + (beatDistortion * 2.0); 

        for (let y = horizon + 2; y < h; y += (y - horizon) * 0.15 + 4) {
            let depth = (y - horizon) / (h - horizon);
            let thickness = Math.max(1, Math.floor(depth * 5));
            let speed = waterSpeed * (0.5 + depth * 1.5);
            let offset = speed % 40;

            for (let x = -40; x < w; x += 40) {
                if (Math.abs(x + offset - sx) < sunR * (1.0 - depth*0.5) && y < horizon + 80) ctx.fillStyle = '#ffff55'; 
                else ctx.fillStyle = (Math.floor(y) % 3 === 0) ? '#0044aa' : '#0077ff'; 
                
                let dashWidth = 20 + depth * 20;
                let xDistort = Math.sin(y * 0.2 + waterSpeed) * distortion;
                
                // Beat-Glitches
                if (beatDistortion > 2.0 && Math.random() > 0.7) {
                    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, y, w, 2);
                } else {
                    ctx.fillRect(x + offset + xDistort, Math.floor(y), dashWidth, thickness);
                }
            }
        }
    }
}