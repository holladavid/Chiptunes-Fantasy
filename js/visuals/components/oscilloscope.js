// === js/visuals/components/oscilloscope.js ===
// =========================================================
// REAL-TIME CRT VECTOR OSCILLOSCOPE COMPONENT
// Encapsulates history buffers, index-shift resizing, and rendering
// =========================================================

export class Oscilloscope {
    constructor(width) {
        this.oscHistory = new Float32Array(width).fill(NaN);
        this.oscIndex = 0;
    }

    // Verschiebt den Index bei Fenstergrößen-Änderung, um Zeichen-Sprünge zu verhindern
    resize(newWidth) {
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
    }

    clear() {
        this.oscHistory.fill(NaN);
    }

    render(ctx, width, height, stateGetters, lineColor) {
        const currentOscValue = stateGetters.getCurrentOscValue();
        const trackData = stateGetters.getTrackData();
        const trackLength = trackData ? (trackData.length || 0) : 0;

        // Neuen Wert in den Ringpuffer schreiben
        this.oscHistory[this.oscIndex] = (trackLength === 0) ? 0 : currentOscValue;
        this.oscIndex = (this.oscIndex + 1) % width;

        ctx.beginPath();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = lineColor;
        
        ctx.shadowColor = lineColor;
        ctx.shadowBlur = 10;

        let isFirstPoint = true;
        for (let x = 0; x < width; x++) {
            const actualIndex = (this.oscIndex + x) % width;
            const val = this.oscHistory[actualIndex];

            if (!isNaN(val)) {
                const y = (height / 2) - (val * (height * 0.42));
                if (isFirstPoint) {
                    ctx.moveTo(x, y);
                    isFirstPoint = false;
                } else {
                    ctx.lineTo(x, y);
                }
            }
        }

        if (!isFirstPoint) {
            ctx.stroke();
        }
        ctx.shadowBlur = 0;
    }
}