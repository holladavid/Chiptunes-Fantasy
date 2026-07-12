// === js/visuals/components/fft-analyzer.js ===
// =========================================================
// REAL-TIME FFT SPECTRUM ANALYZER COMPONENT
// Segmented LED Vacuum Fluorescent Display (VFD) Simulation
// High-Res Gravity Peak-Hold & Tri-Color Theme Palettes
// =========================================================

export class FftAnalyzer {
    constructor() {
        this.barCount = 48;
        this.peaks = new Array(this.barCount).fill(0);
        
        // DSP UPGRADE: Speicher für die Peak-Freeze-Timer
        this.peakHoldTimers = new Array(this.barCount).fill(0);
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

            // Ermittlung der aktiven System-Palette für die VFD-Dioden
            const isAmiga = document.body.classList.contains('theme-amiga');
            const isAtari = document.body.classList.contains('theme-atari');
            const isC64 = document.body.classList.contains('theme-c64');
            
            // LED Segment Abmessungen (4px Diode, 1px Luft)
            const segmentHeight = 4;
            const gap = 1;
            const step = segmentHeight + gap;

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
                
                // =========================================================
                // DSP UPGRADE: PEAK HOLD & GRAVITY
                // Wenn die Frequenz steigt, schießt das Peak nach oben und friert ein.
                // Sinkt das Signal, hält das Peak für 30 Frames (0.5s), bevor es fällt.
                // =========================================================
                if (barHeight > this.peaks[i]) {
                    this.peaks[i] = barHeight;
                    this.peakHoldTimers[i] = 30; // 30 Frames halten
                } else {
                    if (this.peakHoldTimers[i] > 0) {
                        this.peakHoldTimers[i]--; // Timer läuft rückwärts ab
                    } else {
                        this.peaks[i] -= 1.6; // Kraftvolle Schwerkraft (Sinken)
                        if (this.peaks[i] < 0) this.peaks[i] = 0;
                    }
                }
                
                // =========================================================
                // GFX UPGRADE: SEGMENTED LED DRAWING
                // Wir zerschneiden den Balken in gestapelte Dioden und
                // weisen ihnen je nach Höhe (hPct) ihre charakteristische Farbe zu.
                // =========================================================
                let currentY = height;
                ctx.globalAlpha = 0.85; // Vintage Phosphor-Leucht-Effekt

                while (currentY > height - barHeight + gap) {
                    let hPct = (height - currentY) / (height * 0.38); // 0.0 bis 1.0
                    
                    let segColor = lineColor;
                    if (isAtari) {
                        if (hPct > 0.82) segColor = '#ff3333';      // Rotes Clipping ab 82%
                        else if (hPct > 0.60) segColor = '#ffff33'; // Gelbes Clipping ab 60%
                        else segColor = '#33ff33';                  // Grüner Safe-Bereich
                    } else if (isAmiga) {
                        if (hPct > 0.82) segColor = '#ffffff';      // Weißer Peak
                        else if (hPct > 0.55) segColor = '#ff8800';  // Amiga Orange
                        else segColor = '#0055ff';                  // Amiga Blau
                    } else if (isC64) {
                        if (hPct > 0.82) segColor = '#ffffff';      // Weißer Peak
                        else if (hPct > 0.55) segColor = '#6c5eb5';  // C64 Hellblau
                        else segColor = '#352879';                  // C64 Dunkelblau
                    }
                    
                    ctx.fillStyle = segColor;
                    ctx.fillRect(x, currentY - segmentHeight, barWidth, segmentHeight);
                    currentY -= step;
                }
                ctx.globalAlpha = 1.0;

                // =========================================================
                // GFX UPGRADE: GRID-SNAPPED PEAK INDICATOR
                // Die weiße Peak-Diodenkappe rastet mathematisch exakt auf dem 
                // Segment-Raster ein, damit sie nicht "unphysikalisch" dazwischenschwebt.
                // =========================================================
                if (this.peaks[i] > 2) {
                    ctx.fillStyle = '#ffffff';
                    let snappedPeak = Math.floor(this.peaks[i] / step) * step;
                    // Y-Koordinate um 'segmentHeight' nach oben versetzt
                    ctx.fillRect(x, height - snappedPeak - segmentHeight, barWidth, 2);
                }

                x += barWidth + 2;
            }
        }
    }
}