// === js/visuals/components/fft-analyzer.js ===
// =========================================================
// REAL-TIME FFT SPECTRUM ANALYZER COMPONENT
// Log-scaled segmented phosphor display with frequency ruler,
// cached unlit LED matrix and time-based peak-hold gravity.
// =========================================================

const SAMPLE_INTERVAL = 1 / 30;
const MIN_FREQUENCY = 45;
const MAX_FREQUENCY = 12000;

const PALETTES = {
    c64: {
        low: '#352879',
        mid: '#6c5eb5',
        high: '#a49dff',
        peak: '#ffffff',
        grid: '#6c5eb5'
    },
    amiga: {
        low: '#0055ff',
        mid: '#ff8800',
        high: '#ffffff',
        peak: '#ffffff',
        grid: '#ff8800'
    },
    atari: {
        low: '#33ff33',
        mid: '#ffff33',
        high: '#ff3333',
        peak: '#ffffff',
        grid: '#33ff33'
    }
};

function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

function hexToRgb(hex) {
    return [
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16)
    ];
}

function rgba(hex, alpha) {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export class FftAnalyzer {
    constructor() {
        this.barCount = 48;
        this.levels = new Float32Array(this.barCount);
        this.targets = new Float32Array(this.barCount);
        this.peaks = new Float32Array(this.barCount);
        this.peakHoldSeconds = new Float32Array(this.barCount);
        this.barX = new Int32Array(this.barCount);
        this.barWidths = new Int32Array(this.barCount);
        this.binRanges = new Int32Array(this.barCount + 1);

        this.dataArray = null;
        this.analyserKey = '';
        this.layoutKey = '';
        this.staticGrid = null;
        this.staticGridCtx = null;
        this.segmentColors = [];
        this.sampleAccumulator = 0;

        this.width = 0;
        this.height = 0;
        this.baseY = 0;
        this.maxBarHeight = 0;
        this.maxSegments = 0;
        this.segmentHeight = 4;
        this.segmentGap = 1;
        this.segmentStep = 5;
        this.palette = PALETTES.c64;
    }

    configureAnalyser(analyser, audioCtx) {
        if (!analyser || !audioCtx) return;

        const key = `${analyser.frequencyBinCount}:${analyser.fftSize}:${audioCtx.sampleRate}`;
        if (key === this.analyserKey) return;

        this.analyserKey = key;
        if (!this.dataArray || this.dataArray.length !== analyser.frequencyBinCount) {
            this.dataArray = new Uint8Array(analyser.frequencyBinCount);
        }

        const hzPerBin = audioCtx.sampleRate / analyser.fftSize;
        const minBin = Math.max(1, Math.floor(MIN_FREQUENCY / hzPerBin));
        const maxBin = Math.min(
            analyser.frequencyBinCount - 1,
            Math.floor(Math.min(MAX_FREQUENCY, audioCtx.sampleRate * 0.5) / hzPerBin)
        );
        const safeMaxBin = Math.max(minBin + 1, maxBin);
        const ratio = safeMaxBin / minBin;

        this.binRanges[0] = minBin;
        for (let i = 1; i <= this.barCount; i++) {
            this.binRanges[i] = Math.max(
                this.binRanges[i - 1] + 1,
                Math.floor(minBin * Math.pow(ratio, i / this.barCount))
            );
        }
        this.binRanges[this.barCount] = Math.min(
            analyser.frequencyBinCount,
            this.binRanges[this.barCount]
        );
    }

    buildLayout(width, height, system) {
        const key = `${width}x${height}:${system}`;
        if (key === this.layoutKey) return;
        this.layoutKey = key;

        this.width = width;
        this.height = height;
        this.palette = PALETTES[system] || PALETTES.c64;
        this.segmentHeight = height < 360 ? 3 : 4;
        this.segmentGap = 1;
        this.segmentStep = this.segmentHeight + this.segmentGap;
        this.baseY = Math.max(1, height - (width < 600 ? 17 : 21));
        this.maxSegments = Math.max(3, Math.floor((height * 0.43) / this.segmentStep));
        this.maxBarHeight = this.maxSegments * this.segmentStep;

        const barGap = width < 600 ? 1 : 2;
        for (let i = 0; i < this.barCount; i++) {
            const left = Math.floor(i * width / this.barCount);
            const right = Math.floor((i + 1) * width / this.barCount);
            this.barX[i] = left + Math.floor(barGap / 2);
            this.barWidths[i] = Math.max(1, right - left - barGap);
        }

        this.segmentColors.length = this.maxSegments;
        for (let segment = 0; segment < this.maxSegments; segment++) {
            const level = segment / Math.max(1, this.maxSegments - 1);
            this.segmentColors[segment] = level > 0.82
                ? this.palette.high
                : level > 0.55 ? this.palette.mid : this.palette.low;
        }

        if (!this.staticGrid) {
            this.staticGrid = document.createElement('canvas');
            this.staticGridCtx = this.staticGrid.getContext('2d');
        }
        this.staticGrid.width = width;
        this.staticGrid.height = height;
        this.buildStaticGrid(system);
    }

    buildStaticGrid(system) {
        const ctx = this.staticGridCtx;
        const width = this.width;
        const height = this.height;
        const topY = this.baseY - this.maxBarHeight;
        ctx.clearRect(0, 0, width, height);

        // Das unbeleuchtete LED-Muster wird nur bei Resize neu gezeichnet.
        ctx.fillStyle = rgba(this.palette.grid, 0.075);
        for (let i = 0; i < this.barCount; i++) {
            for (let segment = 0; segment < this.maxSegments; segment++) {
                const y = this.baseY - (segment + 1) * this.segmentHeight - segment * this.segmentGap;
                ctx.fillRect(this.barX[i], y, this.barWidths[i], this.segmentHeight);
            }
        }

        // Ruhige Messlinien gliedern das Spektrum, ohne mit der Welle zu konkurrieren.
        ctx.fillStyle = rgba(this.palette.grid, 0.12);
        for (let quarter = 1; quarter < 4; quarter++) {
            const y = Math.round(this.baseY - this.maxBarHeight * quarter / 4);
            ctx.fillRect(0, y, width, 1);
        }
        ctx.fillStyle = rgba(this.palette.grid, 0.38);
        ctx.fillRect(0, this.baseY + 1, width, 1);

        const frequencies = width < 600
            ? [50, 500, 4000, 12000]
            : [50, 100, 500, 1000, 4000, 12000];
        const logRange = Math.log(MAX_FREQUENCY / MIN_FREQUENCY);
        ctx.font = `${width < 600 ? 9 : 11}px "VT323", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        for (const frequency of frequencies) {
            const ratio = (Math.log(frequency / MIN_FREQUENCY)) / logRange;
            const x = Math.max(12, Math.min(width - 12, Math.round(ratio * width)));
            ctx.fillStyle = rgba(this.palette.grid, 0.45);
            ctx.fillRect(x, this.baseY + 3, 1, 4);
            ctx.fillStyle = rgba(this.palette.grid, 0.72);
            const label = frequency >= 1000 ? `${frequency / 1000}K` : String(frequency);
            ctx.fillText(label, x, height - 2);
        }

        // Kleine Endpunkte machen die Skala wie eine Messgerätefrontplatte lesbar.
        ctx.fillStyle = rgba(this.palette.grid, 0.45);
        ctx.fillRect(0, topY, 1, this.maxBarHeight);
        ctx.fillRect(width - 1, topY, 1, this.maxBarHeight);

        if (system === 'amiga') {
            ctx.fillStyle = rgba(this.palette.mid, 0.4);
            for (let x = 0; x < width; x += 16) ctx.fillRect(x, this.baseY + 8, 8, 1);
        }
    }

    sampleSpectrum(analyser, isPlaying) {
        if (!analyser || !this.dataArray || !isPlaying) {
            this.targets.fill(0);
            return;
        }

        analyser.getByteFrequencyData(this.dataArray);
        for (let i = 0; i < this.barCount; i++) {
            const startBin = this.binRanges[i];
            const endBin = Math.max(startBin + 1, this.binRanges[i + 1]);
            let sum = 0;
            let maximum = 0;
            for (let bin = startBin; bin < endBin; bin++) {
                const value = this.dataArray[bin] || 0;
                sum += value;
                if (value > maximum) maximum = value;
            }
            const average = sum / (endBin - startBin);
            const highFrequencyBoost = 1 + (i / (this.barCount - 1)) * 0.55;
            const mixedLevel = (average * 0.7 + maximum * 0.3) / 255;
            this.targets[i] = clamp01(mixedLevel * highFrequencyBoost);
        }
    }

    render(ctx, width, height, stateGetters, lineColor, deltaTime = 1 / 60, system = '') {
        if (width <= 0 || height <= 0) return;

        const resolvedSystem = system || (
            lineColor === '#ff8800' ? 'amiga' : lineColor === '#55ff55' ? 'atari' : 'c64'
        );
        this.buildLayout(width, height, resolvedSystem);

        const analyser = stateGetters.getAnalyserNode();
        const audioCtx = stateGetters.getAudioContext();
        const isPlaying = stateGetters.getIsPlaying();
        this.configureAnalyser(analyser, audioCtx);

        const dt = Number.isFinite(deltaTime) ? Math.max(0, Math.min(0.1, deltaTime)) : 1 / 60;
        this.sampleAccumulator += dt;
        if (this.sampleAccumulator >= SAMPLE_INTERVAL) {
            this.sampleAccumulator %= SAMPLE_INTERVAL;
            this.sampleSpectrum(analyser, isPlaying);
        }

        const attackBlend = 1 - Math.exp(-26 * dt);
        const releaseBlend = 1 - Math.exp(-11 * dt);
        const peakFallSpeed = this.maxBarHeight * 0.55;

        const gridTop = this.baseY - this.maxBarHeight;
        const gridHeight = height - gridTop;
        ctx.drawImage(this.staticGrid,
            0, gridTop, width, gridHeight,
            0, gridTop, width, gridHeight);
        ctx.globalAlpha = 1;

        for (let i = 0; i < this.barCount; i++) {
            const target = this.targets[i];
            const blend = target > this.levels[i] ? attackBlend : releaseBlend;
            this.levels[i] += (target - this.levels[i]) * blend;

            const barHeight = this.levels[i] * this.maxBarHeight;
            if (barHeight >= this.peaks[i]) {
                this.peaks[i] = barHeight;
                this.peakHoldSeconds[i] = 0.42;
            } else if (this.peakHoldSeconds[i] > 0) {
                this.peakHoldSeconds[i] = Math.max(0, this.peakHoldSeconds[i] - dt);
            } else {
                this.peaks[i] = Math.max(barHeight, this.peaks[i] - peakFallSpeed * dt);
            }

            const activeSegments = Math.min(
                this.maxSegments,
                Math.round(barHeight / this.segmentStep)
            );
            const x = this.barX[i];
            const barWidth = this.barWidths[i];

            for (let segment = 0; segment < activeSegments; segment++) {
                const y = this.baseY - (segment + 1) * this.segmentHeight - segment * this.segmentGap;
                ctx.fillStyle = this.segmentColors[segment];
                ctx.fillRect(x, y, barWidth, this.segmentHeight);
            }

            if (activeSegments > 0) {
                const capY = this.baseY - activeSegments * this.segmentStep + this.segmentGap;
                ctx.fillStyle = this.segmentColors[activeSegments - 1];
                ctx.fillRect(x, capY, barWidth, 1);
            }

            if (this.peaks[i] > this.segmentStep * 0.5) {
                const snappedPeak = Math.round(this.peaks[i] / this.segmentStep) * this.segmentStep;
                const peakY = this.baseY - snappedPeak - 1;
                ctx.fillStyle = this.palette.peak;
                ctx.fillRect(x, peakY, barWidth, 2);
                if (barWidth >= 5) ctx.fillRect(x + 1, peakY - 1, barWidth - 2, 1);
            }
        }
        ctx.globalAlpha = 1;
    }
}
