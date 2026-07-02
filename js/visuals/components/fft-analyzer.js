// === js/visuals/components/fft-analyzer.js ===
// =========================================================
// REAL-TIME FFT SPECTRUM ANALYZER COMPONENT
// Encapsulates bin frequency mapping and gravity peak-fall tracking
// =========================================================

export class FftAnalyzer {
    constructor() {
        this.barCount = 48;
        this.peaks = new Array(this.barCount).fill(0);
    }

    render(ctx, width, height, stateGetters, lineColor) {
        const activeAnalyser = stateGetters.getAnalyserNode();
        const isPlaying = stateGetters.getIsPlaying();
        const audioCtx = stateGetters.getAudioContext();

        if (activeAnalyser && isPlaying && audioCtx) {
            const bufferLength = activeAnalyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            activeAnalyser.getByteFrequencyData(dataArray);

            const barWidth = (width / this.barCount) - 2;
            let x = 0;

            const hzPerBin = audioCtx.sampleRate / activeAnalyser.fftSize;
            const minBin = Math.max(1, Math.floor(50 / hzPerBin));
            const maxBin = Math.floor(12000 / hzPerBin);
            let lastEndBin = minBin;

            for (let i = 0; i < this.barCount; i++) {
                const startBin = lastEndBin;
                let endBin = Math.floor(minBin * Math.pow(maxBin / minBin, (i + 1) / this.barCount));
                if (endBin <= startBin) endBin = startBin + 1;
                lastEndBin = endBin;

                let sum = 0;
                for (let b = startBin; b < endBin; b++) sum += dataArray[b];
                const avg = sum / (endBin - startBin);

                const heightBoost = 1.0 + (i / this.barCount) * 0.6;
                const barHeight = ((avg * heightBoost) / 255.0) * (height * 0.38);

                if (barHeight > this.peaks[i]) this.peaks[i] = barHeight;
                else {
                    this.peaks[i] -= 1.2;
                    if (this.peaks[i] < 0) this.peaks[i] = 0;
                }

                ctx.fillStyle = lineColor;
                ctx.globalAlpha = 0.6;
                ctx.fillRect(x, height - barHeight, barWidth, barHeight);

                // Die fallenden weißen Peak-Punkte zeichnen
                if (this.peaks[i] > 2) {
                    ctx.globalAlpha = 1.0;
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(x, height - this.peaks[i] - 3, barWidth, 2);
                }
                x += barWidth + 2;
            }
            ctx.globalAlpha = 1.0;
        }
    }
}