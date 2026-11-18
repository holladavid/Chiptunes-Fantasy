// === js/visuals/components/fft-analyzer.js ===
// =========================================================
// REAL-TIME FFT SPECTRUM ANALYZER COMPONENT
// Exact sub-bin logarithmic interpolation, row-batched VFD/CRT
// phosphor anode segments, decaying phosphor trails & peak reticles.
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

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

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

function mixHexWhite(hex, amount) {
    const [r, g, b] = hexToRgb(hex);
    const rw = Math.round(r + (255 - r) * amount);
    const gw = Math.round(g + (255 - g) * amount);
    const bw = Math.round(b + (255 - b) * amount);
    return `rgb(${rw}, ${gw}, ${bw})`;
}

export class FftAnalyzer {
    constructor() {
        this.barCount = 48;
        this.levels = new Float32Array(this.barCount);
        this.targets = new Float32Array(this.barCount);
        this.trails = new Float32Array(this.barCount);
        this.peaks = new Float32Array(this.barCount);
        this.peakHoldSeconds = new Float32Array(this.barCount);
        this.activeSegs = new Uint8Array(this.barCount);
        this.trailSegs = new Uint8Array(this.barCount);
        this.barX = new Int32Array(this.barCount);
        this.barWidths = new Int32Array(this.barCount);
        this.exactBinRanges = new Float32Array(this.barCount + 1);

        this.dataArray = null;
        this.analyserKey = '';
        this.layoutKey = '';
        this.staticGrid = null;
        this.staticGridCtx = null;
        this.segmentColors = [];
        this.segmentCoreColors = [];
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
        const maxFreq = Math.min(MAX_FREQUENCY, audioCtx.sampleRate * 0.48);
        const ratio = maxFreq / MIN_FREQUENCY;
        const maxBinIndex = analyser.frequencyBinCount - 1;

        // Exakte gebrochene Bin-Grenzen (ab Bin 1, damit DC-Offset in Bin 0 außen vor bleibt)
        for (let i = 0; i <= this.barCount; i++) {
            const freq = MIN_FREQUENCY * Math.pow(ratio, i / this.barCount);
            this.exactBinRanges[i] = clamp(freq / hzPerBin, 1.0, maxBinIndex);
        }
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
            const left = Math.floor((i * width) / this.barCount);
            const right = Math.floor(((i + 1) * width) / this.barCount);
            this.barX[i] = left + Math.floor(barGap / 2);
            this.barWidths[i] = Math.max(1, right - left - barGap);
        }

        this.segmentColors.length = this.maxSegments;
        this.segmentCoreColors.length = this.maxSegments;
        for (let segment = 0; segment < this.maxSegments; segment++) {
            const level = segment / Math.max(1, this.maxSegments - 1);
            const baseHex = level > 0.82
                ? this.palette.high
                : level > 0.55 ? this.palette.mid : this.palette.low;
            this.segmentColors[segment] = baseHex;
            // Heißer VFD-Filament-Kern in der Mitte jedes aktiven Segments
            this.segmentCoreColors[segment] = mixHexWhite(baseHex, level > 0.82 ? 0.65 : 0.42);
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
        const topY = Math.max(0, this.baseY - this.maxBarHeight);
        ctx.clearRect(0, 0, width, height);

        // Unbeleuchtete VFD-Anoden-Matrix mit feinem Kathoden-Innenpunkt
        const unlitBody = rgba(this.palette.grid, 0.065);
        const unlitCore = rgba(this.palette.grid, 0.11);
        for (let i = 0; i < this.barCount; i++) {
            const bx = this.barX[i];
            const bw = this.barWidths[i];
            for (let segment = 0; segment < this.maxSegments; segment++) {
                const y = this.baseY - (segment + 1) * this.segmentHeight - segment * this.segmentGap;
                ctx.fillStyle = unlitBody;
                ctx.fillRect(bx, y, bw, this.segmentHeight);
                if (bw >= 3 && this.segmentHeight >= 3) {
                    ctx.fillStyle = unlitCore;
                    ctx.fillRect(bx + 1, y + 1, bw - 2, 1);
                }
            }
        }

        // Kalibrierte dB-Messlinien (25%, 50%, 75%, 100%)
        for (let quarter = 1; quarter <= 4; quarter++) {
            const y = Math.round(this.baseY - (this.maxBarHeight * quarter) / 4);
            ctx.fillStyle = rgba(this.palette.grid, quarter === 4 ? 0.18 : 0.11);
            ctx.fillRect(0, y, width, 1);
        }

        // Doppelt abgesetzte Instrumenten-Basislinie
        ctx.fillStyle = rgba(this.palette.grid, 0.52);
        ctx.fillRect(0, this.baseY + 1, width, 1);
        ctx.fillStyle = rgba(this.palette.grid, 0.22);
        ctx.fillRect(0, this.baseY + 2, width, 1);

        const logRange = Math.log(MAX_FREQUENCY / MIN_FREQUENCY);

        // Feine logarithmische Zwischen-Ticks wie auf einem HP-Audio-Analysator
        const minorFrequencies = [
            60, 70, 80, 90, 200, 300, 400, 600, 700, 800, 900,
            2000, 3000, 5000, 6000, 8000, 10000
        ];
        ctx.fillStyle = rgba(this.palette.grid, 0.22);
        for (const freq of minorFrequencies) {
            const ratio = Math.log(freq / MIN_FREQUENCY) / logRange;
            const x = Math.round(ratio * width);
            if (x > 4 && x < width - 4) {
                ctx.fillRect(x, this.baseY + 2, 1, 2);
            }
        }

        const majorFrequencies = width < 600
            ? [50, 500, 4000, 12000]
            : [50, 100, 500, 1000, 4000, 12000];

        ctx.font = `${width < 600 ? 9 : 11}px "VT323", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        for (const frequency of majorFrequencies) {
            const ratio = Math.log(frequency / MIN_FREQUENCY) / logRange;
            const x = Math.max(12, Math.min(width - 12, Math.round(ratio * width)));
            ctx.fillStyle = rgba(this.palette.grid, 0.65);
            ctx.fillRect(x, this.baseY + 2, 1, 5);
            ctx.fillStyle = rgba(this.palette.grid, 0.88);
            const label = frequency >= 1000 ? `${frequency / 1000}K` : String(frequency);
            ctx.fillText(label, x, height - 2);
        }

        // Seitliche Messgeräte-Einfassung
        ctx.fillStyle = rgba(this.palette.grid, 0.45);
        ctx.fillRect(0, topY, 1, this.maxBarHeight);
        ctx.fillRect(width - 1, topY, 1, this.maxBarHeight);

        // Sauber über dem Spektrum ohne Kollision mit den Frequenz-Labels
        if (system === 'amiga' && topY >= 4) {
            ctx.fillStyle = rgba(this.palette.mid, 0.42);
            for (let x = 0; x < width; x += 16) {
                ctx.fillRect(x, topY - 3, 8, 1);
            }
        }
    }

    // Kubische Catmull-Rom-Abtastung zwischen benachbarten FFT-Bins (ab Bin 1)
    sampleSubBin(binPos) {
        const data = this.dataArray;
        const maxIdx = data.length - 1;
        const i1 = clamp(Math.floor(binPos), 1, maxIdx);
        const frac = binPos - i1;

        const i0 = Math.max(1, i1 - 1);
        const i2 = Math.min(maxIdx, i1 + 1);
        const i3 = Math.min(maxIdx, i1 + 2);

        const y0 = data[i0];
        const y1 = data[i1];
        const y2 = data[i2];
        const y3 = data[i3];

        const c0 = y1;
        const c1 = 0.5 * (y2 - y0);
        const c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3;
        const c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);

        const val = ((c3 * frac + c2) * frac + c1) * frac + c0;
        return clamp(val, 0, 255);
    }

    sampleSpectrum(analyser, isPlaying) {
        if (!analyser || !this.dataArray || !isPlaying) {
            this.targets.fill(0);
            return;
        }

        analyser.getByteFrequencyData(this.dataArray);

        for (let i = 0; i < this.barCount; i++) {
            const startBin = this.exactBinRanges[i];
            const endBin = Math.max(startBin + 0.15, this.exactBinRanges[i + 1]);
            const span = endBin - startBin;

            let sum = 0;
            let maximum = 0;
            const steps = Math.min(24, Math.max(3, Math.ceil(span * 1.5)));

            for (let s = 0; s <= steps; s++) {
                const pos = startBin + (span * s) / steps;
                const value = this.sampleSubBin(pos);
                sum += value;
                if (value > maximum) maximum = value;
            }

            const average = sum / (steps + 1);
            // Psychoakustische Höhenanhebung (+4.5 dB/Oktave Tilt), ideal für Chiptune-Oberwellen
            const highFrequencyBoost = 1 + Math.pow(i / (this.barCount - 1), 0.85) * 0.62;
            const mixedLevel = (average * 0.65 + maximum * 0.35) / 255;
            // Leichte Röhren-/VFD-Kompression für lebendigere Mitten
            const shaped = Math.pow(clamp01(mixedLevel * highFrequencyBoost), 0.92);
            this.targets[i] = clamp01(shaped);
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
        if (!isPlaying) {
            this.targets.fill(0);
            this.sampleAccumulator = 0;
        } else {
            this.sampleAccumulator += dt;
            if (this.sampleAccumulator >= SAMPLE_INTERVAL) {
                this.sampleAccumulator %= SAMPLE_INTERVAL;
                this.sampleSpectrum(analyser, true);
            }
        }

        const attackBlend = 1 - Math.exp(-30 * dt);
        const releaseBlend = 1 - Math.exp(-11.5 * dt);
        const trailDecayBlend = 1 - Math.exp(-4.2 * dt);
        const peakFallSpeed = this.maxBarHeight * 0.55;

        const gridTop = Math.max(0, this.baseY - this.maxBarHeight - (resolvedSystem === 'amiga' ? 4 : 0));
        const gridHeight = height - gridTop;

        ctx.save();
        ctx.drawImage(
            this.staticGrid,
            0, gridTop, width, gridHeight,
            0, gridTop, width, gridHeight
        );

        let maxActiveSeg = 0;
        const peakThreshold = this.segmentStep * 0.5;
        let hasAnyPeak = false;

        // 1. Pegel, Afterglow-Spuren & Peak-Hold pro Balken aktualisieren
        for (let i = 0; i < this.barCount; i++) {
            const target = this.targets[i];
            const blend = target > this.levels[i] ? attackBlend : releaseBlend;
            this.levels[i] += (target - this.levels[i]) * blend;

            if (this.levels[i] >= this.trails[i]) {
                this.trails[i] = this.levels[i];
            } else {
                this.trails[i] += (this.levels[i] - this.trails[i]) * trailDecayBlend;
            }

            const barHeight = this.levels[i] * this.maxBarHeight;
            const trailHeight = this.trails[i] * this.maxBarHeight;

            if (barHeight >= this.peaks[i]) {
                this.peaks[i] = barHeight;
                this.peakHoldSeconds[i] = 0.44;
            } else if (this.peakHoldSeconds[i] > 0) {
                this.peakHoldSeconds[i] = Math.max(0, this.peakHoldSeconds[i] - dt);
            } else {
                this.peaks[i] = Math.max(barHeight, this.peaks[i] - peakFallSpeed * dt);
            }

            if (this.peaks[i] > peakThreshold) hasAnyPeak = true;

            const aSeg = Math.min(this.maxSegments, Math.round(barHeight / this.segmentStep));
            const tSeg = Math.min(this.maxSegments, Math.round(trailHeight / this.segmentStep));
            this.activeSegs[i] = aSeg;
            this.trailSegs[i] = tSeg;
            if (aSeg > maxActiveSeg) maxActiveSeg = aSeg;
        }

        // 2. Abklingende Phosphor-Geistersegmente & vertikaler Balken-Halo
        for (let i = 0; i < this.barCount; i++) {
            const aSeg = this.activeSegs[i];
            const tSeg = this.trailSegs[i];
            const x = this.barX[i];
            const barWidth = this.barWidths[i];

            if (tSeg > aSeg) {
                const span = Math.max(1, tSeg - aSeg);
                for (let segment = aSeg; segment < tSeg; segment++) {
                    const fade = 1 - (segment - aSeg) / span;
                    const y = this.baseY - (segment + 1) * this.segmentHeight - segment * this.segmentGap;
                    ctx.fillStyle = this.segmentColors[segment];
                    ctx.globalAlpha = fade * 0.28;
                    ctx.fillRect(x, y, barWidth, this.segmentHeight);
                }
            }

            if (aSeg > 1) {
                const topSegY = this.baseY - aSeg * this.segmentStep + this.segmentGap;
                const litHeight = this.baseY - topSegY;
                ctx.fillStyle = this.segmentColors[aSeg - 1];
                ctx.globalAlpha = 0.12;
                ctx.fillRect(x - 1, topSegY - 1, barWidth + 2, litHeight + 2);
            }
        }

        // 3. Aktive VFD-Segmente & heiße Innen-Filamente (zeilenweise gebatcht)
        const drawCores = this.segmentHeight >= 3;
        const coreH = Math.max(1, this.segmentHeight - 2);
        ctx.globalAlpha = 1;

        for (let segment = 0; segment < maxActiveSeg; segment++) {
            const y = this.baseY - (segment + 1) * this.segmentHeight - segment * this.segmentGap;

            ctx.fillStyle = this.segmentColors[segment];
            for (let i = 0; i < this.barCount; i++) {
                if (this.activeSegs[i] > segment) {
                    ctx.fillRect(this.barX[i], y, this.barWidths[i], this.segmentHeight);
                }
            }

            if (drawCores) {
                ctx.fillStyle = this.segmentCoreColors[segment];
                for (let i = 0; i < this.barCount; i++) {
                    if (this.activeSegs[i] > segment && this.barWidths[i] >= 3) {
                        ctx.fillRect(this.barX[i] + 1, y + 1, this.barWidths[i] - 2, coreH);
                    }
                }
            }
        }

        // 4. Weißglühende Oberkante auf dem obersten aktiven Segment
        ctx.globalAlpha = 0.92;
        for (let i = 0; i < this.barCount; i++) {
            const aSeg = this.activeSegs[i];
            if (aSeg === 0) continue;
            const capY = this.baseY - aSeg * this.segmentStep + this.segmentGap;
            ctx.fillStyle = this.segmentCoreColors[aSeg - 1];
            ctx.fillRect(this.barX[i], capY, this.barWidths[i], 1);
        }

        // 5. Peak-Hold-Indikatoren mit Phosphor-Korona (in 2 globalen Batches)
        if (hasAnyPeak) {
            ctx.globalAlpha = 0.28;
            ctx.fillStyle = this.palette.high;
            for (let i = 0; i < this.barCount; i++) {
                if (this.peaks[i] <= peakThreshold) continue;
                const snappedPeak = Math.round(this.peaks[i] / this.segmentStep) * this.segmentStep;
                const peakY = this.baseY - snappedPeak - 1;
                ctx.fillRect(this.barX[i] - 1, peakY - 1, this.barWidths[i] + 2, 4);
            }

            ctx.globalAlpha = 1;
            ctx.fillStyle = this.palette.peak;
            for (let i = 0; i < this.barCount; i++) {
                if (this.peaks[i] <= peakThreshold) continue;
                const snappedPeak = Math.round(this.peaks[i] / this.segmentStep) * this.segmentStep;
                const peakY = this.baseY - snappedPeak - 1;
                const bw = this.barWidths[i];
                const x = this.barX[i];
                ctx.fillRect(x, peakY, bw, 2);
                if (bw >= 5) {
                    ctx.fillRect(x + 1, peakY - 1, bw - 2, 1);
                }
            }
        }

        ctx.restore();
    }
}