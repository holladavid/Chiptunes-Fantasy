// === js/visuals/components/oscilloscope.js ===
// =========================================================
// REAL-TIME CRT VECTOR OSCILLOSCOPE COMPONENT
// Physical Modeling: Offscreen Phosphor Accumulation Buffer,
// Cathode Ray Emitter (Welding Torch), EM Flares & Spark Particles
// =========================================================

export class Oscilloscope {
    constructor(width, height) {
        this.offscreen = document.createElement('canvas');
        this.offscreenCtx = this.offscreen.getContext('2d');
        
        this.oscHistory = null;
        this.oscIndex = 0;
        
        // --- NEU: Partikelsystem für glühende Phosphor-Funken ---
        this.sparks = [];
        
        this.resize(width, height);
    }

    resize(newWidth, newHeight) {
        const oldHistory = this.oscHistory;
        const oldLen = oldHistory ? oldHistory.length : 0;
        this.oscHistory = new Float32Array(newWidth).fill(NaN);
        const oldIndex = this.oscIndex;
        this.oscIndex = 0;

        if (oldLen > 0) {
            const copyLen = Math.min(oldLen, newWidth);
            for (let i = 0; i < copyLen; i++) {
                const oldVal = oldHistory[(oldIndex - copyLen + i + oldLen) % oldLen];
                this.oscHistory[i] = oldVal;
            }
            this.oscIndex = copyLen % newWidth;
        }

        this.offscreen.width = newWidth;
        this.offscreen.height = newHeight;
        
        this.offscreenCtx.fillStyle = '#000000';
        this.offscreenCtx.fillRect(0, 0, newWidth, newHeight);
        
        this.sparks = []; // Funken bei Resize leeren
    }

    clear() {
        if (this.oscHistory) this.oscHistory.fill(NaN);
        this.offscreenCtx.fillStyle = '#000000';
        this.offscreenCtx.fillRect(0, 0, this.offscreen.width, this.offscreen.height);
        this.sparks = [];
    }

    render(ctx, width, height, stateGetters, lineColor) {
        const currentOscValue = stateGetters.getCurrentOscValue();
        const trackData = stateGetters.getTrackData();
        const trackLength = trackData ? (trackData.length || 0) : 0;

        this.oscHistory[this.oscIndex] = (trackLength === 0) ? 0 : currentOscValue;
        this.oscIndex = (this.oscIndex + 1) % width;

        const offCtx = this.offscreenCtx;
        const offW = this.offscreen.width;
        const offH = this.offscreen.height;

        // Koordinaten vorberechnen
        const yCoords = new Float32Array(width);
        for (let x = 0; x < width; x++) {
            const actualIndex = (this.oscIndex + x) % width;
            const val = this.oscHistory[actualIndex];
            yCoords[x] = isNaN(val) ? NaN : (offH / 2) - (val * (offH * 0.42));
        }

        // --- 1. PHOSPHOR DECAY (Nachleuchten) ---
        offCtx.fillStyle = 'rgba(0, 0, 0, 0.28)'; 
        offCtx.fillRect(0, 0, offW, offH);

        // --- 2. LAYER 1: DER GLOW ---
        offCtx.beginPath();
        offCtx.lineWidth = 4.0;
        offCtx.strokeStyle = lineColor;
        offCtx.globalAlpha = 0.18; 
        offCtx.shadowColor = lineColor;
        offCtx.shadowBlur = 8;    
        
        let isFirst = true;
        for (let x = 0; x < width; x++) {
            const y = yCoords[x];
            if (!isNaN(y)) {
                if (isFirst) { offCtx.moveTo(x, y); isFirst = false; } 
                else { offCtx.lineTo(x, y); }
            }
        }
        if (!isFirst) offCtx.stroke();
        
        offCtx.shadowBlur = 0;
        offCtx.globalAlpha = 1.0;

        // --- 3. LAYER 2: DER ANALOGE STRAHLKERN ---
        const rBase = parseInt(lineColor.substring(1, 3), 16);
        const gBase = parseInt(lineColor.substring(3, 5), 16);
        const bBase = parseInt(lineColor.substring(5, 7), 16);

        let lastX = -1;
        let lastY = NaN;

        for (let x = 0; x < width; x++) {
            const y = yCoords[x];
            if (isNaN(y)) { lastX = -1; lastY = NaN; continue; }

            if (lastX !== -1 && !isNaN(lastY)) {
                const dy = Math.abs(y - lastY);
                const speedFactor = Math.min(1.0, dy / 45.0);
                
                offCtx.lineWidth = 2.8 - (speedFactor * 1.8); 
                offCtx.globalAlpha = 1.0 - (speedFactor * 0.65);
                
                let blendFactor = 0.0;
                if (speedFactor < 0.35) {
                    blendFactor = (0.35 - speedFactor) / 0.35; 
                }
                
                const r = (rBase + (255 - rBase) * blendFactor) | 0;
                const g = (gBase + (255 - gBase) * blendFactor) | 0;
                const b = (bBase + (255 - bBase) * blendFactor) | 0;
                
                offCtx.strokeStyle = `rgb(${r}, ${g}, ${b})`;

                offCtx.beginPath();
                offCtx.moveTo(lastX, lastY);
                offCtx.lineTo(x, y);
                offCtx.stroke();
            }
            lastX = x;
            lastY = y;
        }
        offCtx.globalAlpha = 1.0;

        // =========================================================
        // --- 4. THE CATHODE ARC EMITTER (Der Schweißbrenner) ---
        // =========================================================
        const beamX = width - 2; // Position am rechten Rand
        const beamY = yCoords[beamX];
        const prevBeamY = yCoords[beamX - 1];

        if (!isNaN(beamY)) {
            const beamSpeed = isNaN(prevBeamY) ? 0 : Math.abs(beamY - prevBeamY);
            
            // --- Partikel-System: Funkenflug bei extremen Sprüngen ---
            // Wenn die Steigung heftig ist (Beat / Transient), sprühen Funken nach links!
            if (beamSpeed > 8 && this.sparks.length < 80) {
                const numSparks = Math.min(5, Math.floor(beamSpeed / 10));
                for(let s = 0; s < numSparks; s++) {
                    this.sparks.push({
                        x: beamX,
                        y: beamY,
                        vx: -(Math.random() * 6 + 3), // Fluggeschwindigkeit nach links
                        vy: (Math.random() - 0.5) * (beamSpeed * 0.15), // Streuung
                        life: 1.0,
                        decay: 0.04 + Math.random() * 0.06
                    });
                }
            }

            // Funken rendern und updaten
            for (let i = this.sparks.length - 1; i >= 0; i--) {
                let p = this.sparks[i];
                p.x += p.vx;
                p.y += p.vy;
                p.life -= p.decay;

                if (p.life <= 0) {
                    this.sparks.splice(i, 1);
                } else {
                    // Heiße Funken sind weiß, abkühlende Funken nehmen Systemfarbe an
                    offCtx.fillStyle = p.life > 0.6 ? '#ffffff' : lineColor;
                    offCtx.globalAlpha = p.life;
                    offCtx.fillRect(p.x, p.y, 2, 2);
                }
            }
            offCtx.globalAlpha = 1.0;

            // --- Der Brennpunkt (Emitter Core) ---
            offCtx.beginPath();
            offCtx.arc(beamX, beamY, 2.5, 0, Math.PI * 2);
            offCtx.fillStyle = '#ffffff';
            offCtx.shadowBlur = 12;
            offCtx.shadowColor = lineColor;
            offCtx.fill();

            // --- Der Plasma-Halo ---
            offCtx.beginPath();
            offCtx.arc(beamX, beamY, 9, 0, Math.PI * 2);
            offCtx.fillStyle = lineColor;
            offCtx.globalAlpha = 0.4;
            offCtx.fill();

            // --- Elektromagnetische Flares (Streaks) ---
            offCtx.globalAlpha = 0.8;
            offCtx.fillStyle = '#ffffff';
            
            // Horizontaler Laser-Streak (nach links ziehend)
            offCtx.fillRect(beamX - 12, beamY - 0.5, 24, 1);
            
            // Vertikaler Hochspannungs-Streak (dehnt sich bei Geschwindigkeit extrem aus)
            const flareH = 10 + (beamSpeed * 0.6);
            offCtx.fillRect(beamX - 0.5, beamY - flareH / 2, 1, flareH);

            offCtx.globalAlpha = 1.0;
            offCtx.shadowBlur = 0;
        }

        // --- 5. HARDWARE COMPOSITE BLITTING ---
        ctx.globalCompositeOperation = "screen";
        ctx.drawImage(this.offscreen, 0, 0, width, height);
        ctx.globalCompositeOperation = "source-over";
    }
}