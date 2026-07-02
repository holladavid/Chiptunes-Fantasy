// === js/visuals/components/oscilloscope.js ===
// =========================================================
// REAL-TIME CRT VECTOR OSCILLOSCOPE COMPONENT
// Physical Modeling: Offscreen Phosphor Accumulation Buffer,
// Multi-Pass Tube Blooming, Thermal Jitter, and Exponential Decay Trails
// =========================================================

export class Oscilloscope {
    constructor(width, height) {
        // Dedizierter Offscreen-Puffer, um das Phosphor-Nachleuchten zu akkumulieren
        this.offscreen = document.createElement('canvas');
        this.offscreenCtx = this.offscreen.getContext('2d');
        
        this.oscHistory = null;
        this.oscIndex = 0;
        
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

        // Offscreen-Puffer anpassen
        this.offscreen.width = newWidth;
        this.offscreen.height = newHeight;
        
        // Initial schwarz fluten
        this.offscreenCtx.fillStyle = '#000000';
        this.offscreenCtx.fillRect(0, 0, newWidth, newHeight);
    }

    clear() {
        if (this.oscHistory) this.oscHistory.fill(NaN);
        this.offscreenCtx.fillStyle = '#000000';
        this.offscreenCtx.fillRect(0, 0, this.offscreen.width, this.offscreen.height);
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

        // =========================================================
        // --- 1. PHOSPHOR DECAY (Das Trägheits-Nachleuchten) ---
        // Wir faden den alten Puffer nur um 16% ab. Ältere Wellenzüge 
        // bleiben als zarter, abklingender Schweif auf dem Schirm kleben.
        // =========================================================
        offCtx.fillStyle = 'rgba(0, 0, 0, 0.16)'; 
        offCtx.fillRect(0, 0, offW, offH);

        // --- 2. VECTOR PATH BERECHNEN ---
        offCtx.beginPath();
        let isFirst = true;
        for (let x = 0; x < width; x++) {
            const actualIndex = (this.oscIndex + x) % width;
            const val = this.oscHistory[actualIndex];
            
            if (!isNaN(val)) {
                const y = (offH / 2) - (val * (offH * 0.42));
                
                // Thermisches Rauschen (Deflection Jitter) der analogen Platten simulieren
                const jitter = (Math.random() - 0.5) * 0.6;
                
                if (isFirst) {
                    offCtx.moveTo(x, y + jitter);
                    isFirst = false;
                } else {
                    offCtx.lineTo(x, y + jitter);
                }
            }
        }

        // =========================================================
        // --- 3. MULTI-PASS CRT GLOW & CHROMATIC BLOOMING ---
        // =========================================================
        if (!isFirst) {
            // Pass 1: Breites, zartes Lichtbluten auf dem Phosphor (Glow)
            offCtx.lineWidth = 6.0;
            offCtx.strokeStyle = lineColor;
            offCtx.globalAlpha = 0.28;
            offCtx.shadowColor = lineColor;
            offCtx.shadowBlur = 8;
            offCtx.stroke();

            // Pass 2: Mittlerer, farbintensiver Strahlkern
            offCtx.lineWidth = 3.0;
            offCtx.strokeStyle = lineColor;
            offCtx.globalAlpha = 0.65;
            offCtx.shadowBlur = 0; // Schatten für Performance ausschalten
            offCtx.stroke();

            // Pass 3: Hauchdünner, gleißend weißer Heißpunkt (Sättigung)
            offCtx.lineWidth = 1.2;
            offCtx.strokeStyle = '#ffffff';
            offCtx.globalAlpha = 0.95;
            offCtx.stroke();

            offCtx.globalAlpha = 1.0;
        }

        // =========================================================
        // --- 4. HARDWARE COMPOSITE BLITTING ---
        // Wir kopieren den High-Res-Puffer im "screen" Modus auf das Hauptcanvas.
        // Dadurch verschmelzen die glühenden Schweife wunderschön mit den Copperbars!
        // =========================================================
        ctx.globalCompositeOperation = "screen";
        ctx.drawImage(this.offscreen, 0, 0, width, height);
        ctx.globalCompositeOperation = "source-over";
    }
}