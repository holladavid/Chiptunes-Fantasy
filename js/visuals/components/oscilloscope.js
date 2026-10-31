// === js/visuals/components/oscilloscope.js ===
// =========================================================
// REAL-TIME PCM CRT PHOSPHOR SWEEP OSCILLOSCOPE
// True Z-axis velocity modulation (dwell-time intensity),
// dual-stage P31/P11 phosphor persistence, optical glass
// halation, HF-rejected correlation trigger & cathode beam.
// =========================================================

const DEFAULT_FRAME_INTERVAL = 1 / 60;
const TIME_WINDOW_SECONDS = 0.032;
const TRIGGER_HYSTERESIS = 0.015;
const AMPLITUDE_GAIN = 1.24;
const BLOOM_SCALE = 0.25;
const COLOR_LUT_SIZE = 32;
const MAX_SPARKS = 64;
const EPSILON = 1e-7;

function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
}

function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

export class Oscilloscope {
    constructor(width, height) {
        // 1:1 Phosphor-Röhrenschirm für gestochen scharfe 1px-Vertikalflanken
        this.offscreen = document.createElement('canvas');
        this.offscreenCtx = this.offscreen.getContext('2d');

        // Langzeit-Phosphoreszenz-Schicht (Nachleucht-Gedächtnis der Röhre)
        this.memory = document.createElement('canvas');
        this.memoryCtx = this.memory.getContext('2d');

        // Viertel-Auflösung mit bilinearer Filterung für echtes optisches Glas-Halation/Bloom
        this.bloom = document.createElement('canvas');
        this.bloomCtx = this.bloom.getContext('2d');

        // Statisches, im Röhrenglas geätztes Mess-Graticule (wird nur bei Resize gebaut)
        this.graticule = document.createElement('canvas');
        this.graticuleCtx = this.graticule.getContext('2d');

        this.width = 0;
        this.height = 0;
        this.analyserKey = '';
        this.timeDomainData = null;
        this.triggerFilterBuf = null;
        this.prevTriggerWave = null;
        this.timeDomainBytes = null;
        this.audioSampleRate = 48000;
        this.windowSampleCount = 0;
        this.captureCount = 0;
        this.triggerPosition = 0;
        this.triggered = false;
        this.signalRms = 0;

        this.columnMin = new Float32Array(0);
        this.columnMax = new Float32Array(0);
        this.columnTop = new Int16Array(0);
        this.columnBottom = new Int16Array(0);
        this.columnMid = new Int16Array(0);
        this.columnEnergy = new Float32Array(0);

        this.sweepActive = false;
        this.sweepPhase = 0;
        this.beamX = 0;
        this.beamY = 0;
        this.hasCurrentTrace = false;
        this.hasMemory = false;
        this.activeIdleFade = 0;

        this.colorKey = '';
        this.baseRgb = [85, 255, 85];
        this.coreColors = new Array(COLOR_LUT_SIZE);
        this.haloColors = new Array(COLOR_LUT_SIZE);
        this.randomState = 0x6d2b79f5;

        // Fester Partikel-Pool für ballistische Kathoden-Funken an steilen Flanken
        this.sparks = Array.from({ length: MAX_SPARKS }, () => ({
            x: 0,
            y: 0,
            px: 0,
            py: 0,
            vx: 0,
            vy: 0,
            life: 0,
            decay: 0
        }));
        this.sparkCursor = 0;

        this.resize(width, height);
    }

    copySurface(source) {
        if (!source || source.width <= 0 || source.height <= 0) return null;
        const copy = document.createElement('canvas');
        copy.width = source.width;
        copy.height = source.height;
        copy.getContext('2d').drawImage(source, 0, 0);
        return copy;
    }

    clearSurface(ctx, surface) {
        if (!surface || surface.width <= 0 || surface.height <= 0) return;
        ctx.save();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.shadowBlur = 0;
        ctx.clearRect(0, 0, surface.width, surface.height);
        ctx.restore();
    }

    allocateRaster(width) {
        if (this.columnMid.length === width) return;
        this.columnMin = new Float32Array(width);
        this.columnMax = new Float32Array(width);
        this.columnTop = new Int16Array(width);
        this.columnBottom = new Int16Array(width);
        this.columnMid = new Int16Array(width);
        this.columnEnergy = new Float32Array(width);
        this.prevTriggerWave = new Float32Array(Math.max(32, Math.floor(width / 4)));
    }

    resize(newWidth, newHeight) {
        const width = Math.max(0, Math.floor(newWidth));
        const height = Math.max(0, Math.floor(newHeight));
        if (width === this.width && height === this.height) return;

        const oldWidth = this.offscreen.width;
        const prevTrace = this.width > 0 && this.height > 0 ? this.copySurface(this.offscreen) : null;
        const prevMemory = this.width > 0 && this.height > 0 ? this.copySurface(this.memory) : null;

        this.width = width;
        this.height = height;

        this.offscreen.width = width;
        this.offscreen.height = height;
        this.memory.width = width;
        this.memory.height = height;
        this.bloom.width = Math.max(1, Math.ceil(width * BLOOM_SCALE));
        this.bloom.height = Math.max(1, Math.ceil(height * BLOOM_SCALE));
        this.graticule.width = width;
        this.graticule.height = height;

        this.offscreenCtx.imageSmoothingEnabled = false;
        this.memoryCtx.imageSmoothingEnabled = true;
        this.bloomCtx.imageSmoothingEnabled = true;

        this.allocateRaster(width);

        if (width > 0 && height > 0) {
            if (prevTrace) {
                this.offscreenCtx.drawImage(
                    prevTrace, 0, 0, prevTrace.width, prevTrace.height,
                    0, 0, width, height
                );
            }
            if (prevMemory) {
                this.memoryCtx.drawImage(
                    prevMemory, 0, 0, prevMemory.width, prevMemory.height,
                    0, 0, width, height
                );
            }
            if (this.colorKey) {
                this.buildGraticule();
            }
        }

        if (oldWidth > 0 && width > 0) {
            this.beamX = clamp(this.beamX * (width / oldWidth), 0, width - 1);
        } else {
            this.beamX = 0;
        }

        if (this.sweepActive && this.timeDomainData) {
            this.buildSweepRaster();
        }
        this.beamY = this.sweepActive ? this.getSweepY(this.beamX) : Math.floor(height * 0.5);
        for (const spark of this.sparks) spark.life = 0;
    }

    clear() {
        this.triggerPosition = 0;
        this.triggered = false;
        this.captureCount = 0;
        this.signalRms = 0;
        if (this.timeDomainData) this.timeDomainData.fill(0);
        if (this.prevTriggerWave) this.prevTriggerWave.fill(0);
        this.columnMin.fill(0);
        this.columnMax.fill(0);
        this.columnTop.fill(0);
        this.columnBottom.fill(0);
        this.columnMid.fill(0);
        this.columnEnergy.fill(0);
        this.sweepActive = false;
        this.sweepPhase = 0;
        this.beamX = 0;
        this.beamY = Math.floor(this.height * 0.5);
        this.hasCurrentTrace = false;
        this.hasMemory = false;
        this.activeIdleFade = 0;
        for (const spark of this.sparks) spark.life = 0;
        this.clearSurface(this.offscreenCtx, this.offscreen);
        this.clearSurface(this.memoryCtx, this.memory);
        this.clearSurface(this.bloomCtx, this.bloom);
    }

    nextRandom() {
        let value = this.randomState;
        value ^= value << 13;
        value ^= value >>> 17;
        value ^= value << 5;
        this.randomState = value >>> 0;
        return this.randomState / 0x100000000;
    }

    prepareColors(lineColor) {
        if (!lineColor || lineColor === this.colorKey) return;
        this.colorKey = lineColor;

        const hex = lineColor.startsWith('#') ? lineColor.slice(1) : '55ff55';
        const rBase = parseInt(hex.slice(0, 2), 16) || 85;
        const gBase = parseInt(hex.slice(2, 4), 16) || 255;
        const bBase = parseInt(hex.slice(4, 6), 16) || 85;
        this.baseRgb = [rBase, gBase, bBase];

        // 32-stufige Phosphor-Farbtemperatur-Kurve:
        // Niedrige Energie (schnelle Flanken) -> tief gesättigtes Phosphor-Primärlicht
        // Hohe Energie (flache Verweildauer / Umkehrpunkte) -> weißglühender Kathodenkern
        for (let i = 0; i < COLOR_LUT_SIZE; i++) {
            const t = i / (COLOR_LUT_SIZE - 1);
            const hotness = Math.pow(t, 1.55) * 0.92;
            const saturationBoost = Math.sin(t * Math.PI) * 28;

            const r = clamp(Math.round(rBase + (255 - rBase) * hotness + (rBase > 180 ? saturationBoost : 0)), 0, 255);
            const g = clamp(Math.round(gBase + (255 - gBase) * hotness + (gBase > 180 ? saturationBoost : 0)), 0, 255);
            const b = clamp(Math.round(bBase + (255 - bBase) * hotness + (bBase > 180 ? saturationBoost : 0)), 0, 255);
            this.coreColors[i] = `rgb(${r}, ${g}, ${b})`;

            const hr = clamp(Math.round(rBase * (0.65 + 0.35 * t) + (255 - rBase) * (t * 0.25)), 0, 255);
            const hg = clamp(Math.round(gBase * (0.65 + 0.35 * t) + (255 - gBase) * (t * 0.25)), 0, 255);
            const hb = clamp(Math.round(bBase * (0.65 + 0.35 * t) + (255 - bBase) * (t * 0.25)), 0, 255);
            this.haloColors[i] = `rgb(${hr}, ${hg}, ${hb})`;
        }

        if (this.width > 0 && this.height > 0) {
            this.buildGraticule();
        }
    }

    buildGraticule() {
        const ctx = this.graticuleCtx;
        const w = this.width;
        const h = this.height;
        if (w <= 0 || h <= 0) return;

        ctx.clearRect(0, 0, w, h);
        const [r, g, b] = this.baseRgb;
        const midY = Math.round(h * 0.5);
        const midX = Math.round(w * 0.5);

        // Geätzte 0V-Mittellinie mit 5er-Sub-Ticks wie beim Tektronix 465
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.11)`;
        ctx.fillRect(0, midY, w, 1);

        const majorStepX = Math.max(24, Math.round(w / 10));
        const minorStepX = majorStepX / 5;

        for (let x = 0; x <= w; x += minorStepX) {
            const rx = Math.round(x);
            const isMajor = Math.abs(Math.round(x / majorStepX) * majorStepX - x) < 1.5;
            const tickHalf = isMajor ? 4 : 2;
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${isMajor ? 0.22 : 0.12})`;
            ctx.fillRect(rx, midY - tickHalf, 1, tickHalf * 2 + 1);
        }

        // Vertikale Trigger-Mittelachse (blendet nach unten sanft aus, damit der FFT-Analyzer frei bleibt)
        const maxVertY = Math.round(h * 0.62);
        const majorStepY = Math.max(18, Math.round(h / 8));
        const minorStepY = majorStepY / 5;

        for (let y = 8; y <= maxVertY; y += minorStepY) {
            const ry = Math.round(y);
            const fade = clamp01(1 - Math.max(0, (ry - h * 0.45) / (h * 0.18)));
            const isMajor = Math.abs(Math.round((y - midY) / majorStepY) * majorStepY - (y - midY)) < 1.5;
            const tickHalf = isMajor ? 4 : 2;
            const alpha = (isMajor ? 0.18 : 0.09) * fade;
            if (alpha <= 0.01) continue;
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
            ctx.fillRect(midX - tickHalf, ry, tickHalf * 2 + 1, 1);
        }
    }

    configureAnalyser(analyser, audioCtx) {
        if (!analyser || !audioCtx) return false;
        const fftSize = analyser.fftSize || 2048;
        const sampleRate = Number.isFinite(audioCtx.sampleRate) ? audioCtx.sampleRate : 48000;
        const key = `${fftSize}:${sampleRate}`;
        if (key === this.analyserKey) return true;

        this.analyserKey = key;
        this.audioSampleRate = sampleRate;
        if (!this.timeDomainData || this.timeDomainData.length !== fftSize) {
            this.timeDomainData = new Float32Array(fftSize);
            this.triggerFilterBuf = new Float32Array(fftSize);
            this.timeDomainBytes = null;
        }
        this.windowSampleCount = Math.min(
            fftSize - 4,
            Math.max(64, Math.round(sampleRate * TIME_WINDOW_SECONDS))
        );
        return true;
    }

    captureWaveform(analyser) {
        const data = this.timeDomainData;
        const trigBuf = this.triggerFilterBuf;
        if (!analyser || !data || !trigBuf) return false;

        if (typeof analyser.getFloatTimeDomainData === 'function') {
            analyser.getFloatTimeDomainData(data);
        } else if (typeof analyser.getByteTimeDomainData === 'function') {
            if (!this.timeDomainBytes) this.timeDomainBytes = new Uint8Array(data.length);
            analyser.getByteTimeDomainData(this.timeDomainBytes);
            for (let i = 0; i < data.length; i++) {
                data[i] = (this.timeDomainBytes[i] - 128) / 128;
            }
        } else {
            return false;
        }

        // 1. DC-Offset-Entfernung & RMS-Energiemessung
        let mean = 0;
        for (let i = 0; i < data.length; i++) mean += data[i];
        mean /= data.length;

        let sumSq = 0;
        let peak = 0;
        for (let i = 0; i < data.length; i++) {
            const v = data[i] - mean;
            data[i] = v;
            sumSq += v * v;
            const av = Math.abs(v);
            if (av > peak) peak = av;
        }
        this.signalRms = Math.sqrt(sumSq / data.length);

        // 2. HF-Reject Trigger-Konditionierungsfilter (einpoliger Tiefpass),
        // damit SID-Rauschen, Oberwellen oder PWM-Spitzen den Nulldurchgang nicht verwackeln.
        let lp = data[0];
        const alpha = 0.22;
        for (let i = 0; i < data.length; i++) {
            lp += (data[i] - lp) * alpha;
            trigBuf[i] = lp;
        }

        // 3. Schmitt-Trigger mit adaptiver Hysterese & Phasen-Korrelations-Lock
        const dynamicHysteresis = Math.max(TRIGGER_HYSTERESIS, peak * 0.08);
        const maximumStart = Math.max(1, data.length - this.windowSampleCount - 2);
        let armed = false;
        let bestPos = 0;
        let bestScore = -Infinity;
        let foundAny = false;

        const corrPoints = this.prevTriggerWave ? this.prevTriggerWave.length : 0;
        const corrStride = corrPoints > 0 ? Math.max(1, Math.floor(this.windowSampleCount / corrPoints)) : 8;

        for (let i = 2; i <= maximumStart; i++) {
            const prev = trigBuf[i - 1];
            const curr = trigBuf[i];
            if (prev < -dynamicHysteresis) armed = true;
            if (!armed || prev > 0 || curr <= 0) continue;

            const fraction = clamp(-prev / Math.max(EPSILON, curr - prev), 0, 1);
            const candidatePos = i - 1 + fraction;
            const slope = curr - trigBuf[i - 2];

            // Korrelation mit der vorherigen Periode verhindert Phasing-Sprünge bei C64-Arpeggios
            let corr = 0;
            if (this.captureCount > 0 && corrPoints > 0) {
                for (let k = 0; k < corrPoints; k++) {
                    const idx = Math.min(data.length - 1, i + k * corrStride);
                    const diff = trigBuf[idx] - this.prevTriggerWave[k];
                    corr -= diff * diff;
                }
            }

            // Bevorzuge frühe stabile Triggerpunkte mit steiler Flanke und hoher Ähnlichkeit
            const positionPenalty = (i / maximumStart) * 0.15;
            const score = corr + slope * 0.45 - positionPenalty;

            if (score > bestScore) {
                bestScore = score;
                bestPos = candidatePos;
                foundAny = true;
                // Wenn die Korrelation bereits sehr hoch ist, sofort einrasten
                if (corr > -0.08 && i > 8) break;
            }
            armed = false;
        }

        this.triggerPosition = foundAny ? bestPos : 0;
        this.triggered = foundAny;

        // Referenz-Hüllkurve für den nächsten Frame mit leichtem Leaky-Integrator speichern
        if (corrPoints > 0) {
            const baseIdx = Math.floor(this.triggerPosition);
            for (let k = 0; k < corrPoints; k++) {
                const idx = Math.min(data.length - 1, baseIdx + k * corrStride);
                this.prevTriggerWave[k] = this.prevTriggerWave[k] * 0.65 + trigBuf[idx] * 0.35;
            }
        }

        this.captureCount++;
        this.buildSweepRaster();
        return true;
    }

    // Kubische Catmull-Rom-Interpolation + dezenter analoger Transienten-Overshoot
    sampleInterpolated(position) {
        const data = this.timeDomainData;
        const maxIdx = data.length - 1;
        const i1 = clamp(Math.floor(position), 0, maxIdx);
        const frac = position - i1;

        const i0 = Math.max(0, i1 - 1);
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

        const cubic = ((c3 * frac + c2) * frac + c1) * frac + c0;
        // Dezentes analoges RC-Hochpass-Überschwingen an harten Rechteck-/Sägezahn-Kanten
        const stepAccent = (y2 - y1) * 0.045;
        return cubic + stepAccent;
    }

    valueToY(value) {
        const height = this.offscreen.height;
        if (height <= 2) return 0;
        // Authentisches thermisches Vorverstärker-Rauschen (~0.25 px), damit die 0V-Linie analog lebt
        const thermalNoise = (this.nextRandom() - 0.5) * 0.0018;
        const normalized = clamp01(0.5 - (value + thermalNoise) * AMPLITUDE_GAIN * 0.42);
        const margin = Math.min(6, Math.floor(height * 0.04));
        const usable = Math.max(1, height - margin * 2);
        return margin + Math.round(normalized * usable);
    }

    buildSweepRaster() {
        const width = this.offscreen.width;
        const data = this.timeDomainData;
        if (!data || width <= 0 || this.windowSampleCount <= 0) return;

        const start = this.triggerPosition;
        const samplesPerCol = this.windowSampleCount / width;

        for (let x = 0; x < width; x++) {
            const posStart = start + x * samplesPerCol;
            const posEnd = posStart + samplesPerCol;

            let minimum = Infinity;
            let maximum = -Infinity;

            // Sub-Pixel Oversampling + exakte Min/Max-Erfassung für Transienten
            const firstIdx = clamp(Math.ceil(posStart), 0, data.length - 1);
            const lastIdx = clamp(Math.floor(posEnd), 0, data.length - 1);

            const vStart = this.sampleInterpolated(posStart);
            const vMid = this.sampleInterpolated(posStart + samplesPerCol * 0.5);
            const vEnd = this.sampleInterpolated(posEnd);

            minimum = Math.min(vStart, vMid, vEnd);
            maximum = Math.max(vStart, vMid, vEnd);

            for (let i = firstIdx; i <= lastIdx; i++) {
                const v = data[i];
                if (v < minimum) minimum = v;
                if (v > maximum) maximum = v;
            }

            this.columnMin[x] = minimum;
            this.columnMax[x] = maximum;

            const topY = this.valueToY(maximum);
            const bottomY = this.valueToY(minimum);
            const midY = this.valueToY((minimum + maximum) * 0.5);

            this.columnTop[x] = Math.min(topY, bottomY);
            this.columnBottom[x] = Math.max(topY, bottomY);
            this.columnMid[x] = midY;
        }
    }

    getSweepY(x) {
        if (this.columnMid.length === 0) return Math.floor(this.height * 0.5);
        return this.columnMid[clamp(Math.round(x), 0, this.columnMid.length - 1)];
    }

    fadePhosphorSurfaces(dt, isActive) {
        // Zweistufiges P31/P11-Phosphor-Abklingen:
        // 1. offscreen: Schnelle Fluoreszenz-Entladung (hält schnelle Transienten knackig)
        // 2. memory: Langsames Phosphoreszenz-Nachglühen (charakteristischer CRT-Afterglow)
        const fastFade = isActive
            ? clamp(1 - Math.exp(-16.5 * dt), 0.14, 0.48)
            : clamp(1 - Math.exp(-8.5 * dt), 0.08, 0.35);

        const slowFade = isActive
            ? clamp(1 - Math.exp(-4.8 * dt), 0.05, 0.22)
            : clamp(1 - Math.exp(-5.5 * dt), 0.06, 0.25);

        const bloomFade = clamp(1 - Math.exp(-14.0 * dt), 0.15, 0.55);

        if (this.offscreen.width > 0 && this.offscreen.height > 0) {
            this.offscreenCtx.save();
            this.offscreenCtx.globalCompositeOperation = 'destination-out';
            this.offscreenCtx.fillStyle = `rgba(0, 0, 0, ${fastFade.toFixed(3)})`;
            this.offscreenCtx.fillRect(0, 0, this.offscreen.width, this.offscreen.height);
            this.offscreenCtx.restore();

            this.memoryCtx.save();
            this.memoryCtx.globalCompositeOperation = 'destination-out';
            this.memoryCtx.fillStyle = `rgba(0, 0, 0, ${slowFade.toFixed(3)})`;
            this.memoryCtx.fillRect(0, 0, this.memory.width, this.memory.height);
            this.memoryCtx.restore();

            this.bloomCtx.save();
            this.bloomCtx.globalCompositeOperation = 'destination-out';
            this.bloomCtx.fillStyle = `rgba(0, 0, 0, ${bloomFade.toFixed(3)})`;
            this.bloomCtx.fillRect(0, 0, this.bloom.width, this.bloom.height);
            this.bloomCtx.restore();
        }
    }

    burnPhosphorTrace(dt) {
        const width = this.offscreen.width;
        const height = this.offscreen.height;
        if (width <= 0 || height <= 0) return;

        const ctx = this.offscreenCtx;
        const bCtx = this.bloomCtx;
        const bScaleX = this.bloom.width / width;
        const bScaleY = this.bloom.height / height;

        // Stroboskopischer Kathoden-Fokusstrahl wandert sichtbar über die Welle (~2.1 Sweeps/Sek),
        // während die gesamte getriggerte Welle mit echter Verweildauer-Physik den Phosphor anregt.
        const prevBeamX = this.beamX;
        const sweepRate = 2.15 + clamp01(this.signalRms * 1.8) * 0.85;
        this.sweepPhase = (this.sweepPhase + dt * sweepRate) % 1;
        this.beamX = this.sweepPhase * (width - 1);
        this.beamY = this.getSweepY(this.beamX);

        const beamCol = Math.round(this.beamX);
        const cometLength = Math.max(18, Math.round(width * 0.14));

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        bCtx.save();
        bCtx.globalCompositeOperation = 'source-over';

        for (let x = 0; x < width; x++) {
            const top = this.columnTop[x];
            const bottom = this.columnBottom[x];
            const mid = this.columnMid[x];

            const prevTop = x > 0 ? this.columnTop[x - 1] : top;
            const prevBottom = x > 0 ? this.columnBottom[x - 1] : bottom;
            const prevMid = x > 0 ? this.columnMid[x - 1] : mid;

            // Lückenlose vertikale Verbindung zwischen Spalte x-1 und x
            const segTop = Math.min(top, prevBottom);
            const segBottom = Math.max(bottom, prevTop);
            const span = Math.max(1, segBottom - segTop + 1);
            const deltaY = Math.max(bottom - top, Math.abs(mid - prevMid), span - 1);

            // ECHTE CRT-PHYSIK (Z-Modulation / Dwell-Time):
            // Je steiler der vertikale Sprung (deltaY), desto kürzer verweilt der Elektronenstrahl
            // pro Längeneinheit auf dem Phosphor -> vertikale Flanken sind dünn & geisterhaft,
            // horizontale Plateaus (Rechteckwelle) brennen weißglühend ein!
            const dwellEnergy = Math.pow(1 / (1 + deltaY * 0.22), 0.62);

            // Zusätzlicher Glüh-Boost im Kometenschweif hinter dem wandernden Fokus-Kathodenstrahl
            const distBehindBeam = (beamCol - x + width) % width;
            const cometBoost = distBehindBeam < cometLength
                ? Math.pow(1 - distBehindBeam / cometLength, 2.2) * 0.38
                : 0;

            const totalEnergy = clamp01(dwellEnergy * 0.86 + cometBoost);
            this.columnEnergy[x] = totalEnergy;

            const colorIdx = clamp(Math.round(totalEnergy * (COLOR_LUT_SIZE - 1)), 0, COLOR_LUT_SIZE - 1);

            // 1. Äußere Korona entlang der Spur (nur merklich bei moderater bis hoher Verweildauer)
            if (totalEnergy > 0.28) {
                ctx.fillStyle = this.haloColors[colorIdx];
                ctx.globalAlpha = (totalEnergy - 0.22) * 0.42;
                ctx.fillRect(x, segTop - 1, 1, span + 2);
            }

            // 2. Vertikaler Übergangs-Strahl (1px scharf; bei großen Sprüngen dezent-transparent)
            const edgeAlpha = clamp(0.11 + Math.pow(totalEnergy, 1.15) * 0.89, 0.11, 1.0);
            ctx.fillStyle = this.coreColors[colorIdx];
            ctx.globalAlpha = edgeAlpha;
            ctx.fillRect(x, segTop, 1, span);

            // 3. Umkehrpunkt-Aufhellung (Turn-Around Peak Intensification):
            // An den lokalen Extrema (top & bottom) bremst der Strahl vertikal auf vy = 0 ab,
            // bevor er die Richtung wechselt. Dadurch leuchten die Kanten von Hüllkurven und
            // die Plateaus von Puls-Wellen auf einem echten Analog-Oszi deutlich heller!
            if (span > 2) {
                const turnAroundIdx = clamp(colorIdx + 7, 0, COLOR_LUT_SIZE - 1);
                ctx.fillStyle = this.coreColors[turnAroundIdx];
                ctx.globalAlpha = clamp(edgeAlpha * 1.45, 0.28, 0.96);
                ctx.fillRect(x, top, 1, 2);
                ctx.fillRect(x, Math.max(top, bottom - 1), 1, 2);
            } else {
                // Flaches horizontales Plateau (z. B. C64-Pulswelle): Heißer, dichter Weißglut-Kern
                ctx.fillStyle = this.coreColors[ Math.min(COLOR_LUT_SIZE - 1, colorIdx + 5) ];
                ctx.globalAlpha = clamp01(totalEnergy * 0.95);
                ctx.fillRect(x, mid, 1, 2);
            }

            // 4. Optisches Halation-Blooming ins Viertel-Auflösungs-Canvas einspeisen
            if ((x & 1) === 0 && totalEnergy > 0.24) {
                const bx = Math.floor(x * bScaleX);
                const by = Math.floor(mid * bScaleY);
                bCtx.fillStyle = this.coreColors[colorIdx];
                bCtx.globalAlpha = totalEnergy * 0.55;
                bCtx.fillRect(bx, by, 2, Math.max(2, Math.ceil(span * bScaleY)));
            }

            // 5. Kathoden-Funken an extrem steilen Flanken auslösen, wenn der Fokusstrahl passiert
            if (deltaY > 14 && distBehindBeam <= Math.max(2, Math.ceil(width * dt * 2.5))) {
                if (this.nextRandom() < 0.45) {
                    this.spawnSparks(x, mid, deltaY);
                }
            }
        }

        ctx.restore();
        bCtx.restore();

        // Aktuelle Fluoreszenz-Spur in die langsamer abklingende Phosphoreszenz-Schicht übertragen
        this.memoryCtx.save();
        this.memoryCtx.globalCompositeOperation = 'lighter';
        this.memoryCtx.globalAlpha = 0.26;
        this.memoryCtx.drawImage(this.offscreen, 0, 0);
        this.memoryCtx.restore();

        this.hasCurrentTrace = true;
        this.hasMemory = true;
        this.activeIdleFade = 1;

        // Falls der Fokusstrahl beim Wrap-Around über eine Flanke lief
        if (prevBeamX > this.beamX && this.signalRms > 0.05) {
            const dy0 = Math.abs(this.columnBottom[0] - this.columnTop[0]);
            if (dy0 > 12) this.spawnSparks(0, this.beamY, dy0);
        }
    }

    spawnSparks(x, y, speed) {
        const count = Math.min(3, Math.floor(speed / 22) + 1);
        for (let i = 0; i < count; i++) {
            const spark = this.sparks[this.sparkCursor];
            this.sparkCursor = (this.sparkCursor + 1) % MAX_SPARKS;
            spark.x = x;
            spark.y = y;
            spark.px = x;
            spark.py = y;
            spark.vx = -(38 + this.nextRandom() * 125);
            spark.vy = (this.nextRandom() - 0.5) * Math.min(speed * 4.2, 190);
            spark.life = 1;
            spark.decay = 1.6 + this.nextRandom() * 1.9;
        }
    }

    updateSparks(deltaTime) {
        const drag = Math.exp(-3.2 * deltaTime);
        const gravity = 140 * deltaTime;

        for (const spark of this.sparks) {
            if (spark.life <= 0) continue;
            spark.px = spark.x;
            spark.py = spark.y;
            spark.vx *= drag;
            spark.vy = spark.vy * drag + gravity;
            spark.x += spark.vx * deltaTime;
            spark.y += spark.vy * deltaTime;
            spark.life -= spark.decay * deltaTime;

            if (spark.x < -4 || spark.y < -4 || spark.y > this.offscreen.height + 4) {
                spark.life = 0;
            }
        }
    }

    drawBeamAndSparks(ctx, lineColor) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // Ballistische Funken als kurze Bewegungs-Vektoren (Shutter-Streak) zeichnen
        ctx.lineCap = 'round';
        for (const spark of this.sparks) {
            if (spark.life <= 0) continue;
            ctx.strokeStyle = spark.life > 0.55 ? '#ffffff' : lineColor;
            ctx.lineWidth = spark.life > 0.65 ? 1.6 : 1.0;
            ctx.globalAlpha = clamp01(spark.life * 0.9);
            ctx.beginPath();
            ctx.moveTo(spark.px, spark.py);
            ctx.lineTo(spark.x, spark.y);
            ctx.stroke();
        }

        if (this.sweepActive) {
            const bx = this.beamX;
            const by = this.beamY;
            const colIdx = clamp(Math.round(bx), 0, Math.max(0, this.width - 1));
            const localSlope = Math.abs(
                this.getSweepY(colIdx) - this.getSweepY(Math.max(0, colIdx - 3))
            );

            // 1. Weicher äußerer Elektronenlinsen-Halo
            ctx.globalAlpha = 0.24;
            ctx.fillStyle = lineColor;
            ctx.beginPath();
            ctx.arc(bx, by, 7.5, 0, Math.PI * 2);
            ctx.fill();

            // 2. Mittlere heiße Korona
            ctx.globalAlpha = 0.55;
            ctx.fillStyle = this.coreColors[COLOR_LUT_SIZE - 6];
            ctx.beginPath();
            ctx.arc(bx, by, 3.2, 0, Math.PI * 2);
            ctx.fill();

            // 3. Anamorphotischer CRT-Horizontal-Streak & vertikaler Deflektions-Blitz
            const flareHeight = Math.min(this.height * 0.42, 7 + localSlope * 1.45);
            ctx.globalAlpha = 0.68;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(Math.round(bx - 14), Math.round(by), 29, 1);
            ctx.fillRect(
                Math.round(bx),
                Math.round(by - flareHeight * 0.5),
                1,
                Math.max(1, Math.round(flareHeight))
            );

            // 4. Inkandeszenter, weißglühender Kathoden-Brennspot
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(bx, by, 1.7, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    render(ctx, width, height, stateGetters, lineColor, deltaTime = DEFAULT_FRAME_INTERVAL) {
        if (width <= 0 || height <= 0) return;
        if (this.width !== width || this.height !== height) {
            this.resize(width, height);
        }
        if (this.offscreen.width <= 0 || this.offscreen.height <= 0) return;

        this.prepareColors(lineColor);

        const trackData = stateGetters.getTrackData ? stateGetters.getTrackData() : null;
        const hasTrack = !!trackData && (trackData.length || 0) > 0;
        const isPlaying = stateGetters.getIsPlaying ? stateGetters.getIsPlaying() : hasTrack;
        const analyser = stateGetters.getAnalyserNode ? stateGetters.getAnalyserNode() : null;
        const audioCtx = stateGetters.getAudioContext ? stateGetters.getAudioContext() : null;
        const mayCapture = hasTrack && isPlaying && this.configureAnalyser(analyser, audioCtx);
        const dt = Number.isFinite(deltaTime) ? clamp(deltaTime, 0.001, 0.1) : DEFAULT_FRAME_INTERVAL;

        this.fadePhosphorSurfaces(dt, mayCapture);

        if (mayCapture && this.captureWaveform(analyser)) {
            this.sweepActive = true;
            this.burnPhosphorTrace(dt);
        } else {
            this.sweepActive = false;
            this.activeIdleFade = Math.max(0, this.activeIdleFade - dt * 2.4);
        }

        this.updateSparks(dt);

        ctx.save();
        ctx.globalCompositeOperation = 'screen';

        // 1. Subtiles geätztes Innen-Graticule (leuchtet leicht mit, wenn die Röhre aktiv ist)
        if (this.graticule.width > 0) {
            ctx.globalAlpha = 0.55 + this.activeIdleFade * 0.45;
            ctx.drawImage(this.graticule, 0, 0);
        }

        if (this.hasMemory || this.hasCurrentTrace) {
            const prevSmooth = ctx.imageSmoothingEnabled;

            // 2. Weites optisches Röhrenglas-Halation (weiches bilineares Upscaling des 0.25x Buffers)
            ctx.imageSmoothingEnabled = true;
            ctx.globalAlpha = 0.52;
            ctx.drawImage(
                this.bloom,
                0, 0, this.bloom.width, this.bloom.height,
                0, 0, width, height
            );

            // 3. Langzeit-Phosphoreszenz (Nachleucht-Schatten vergangener Perioden)
            ctx.globalAlpha = 0.44;
            ctx.drawImage(this.memory, 0, 0, width, height);

            // 4. Gestochen scharfe 1:1-Elektronenstrahl-Hauptspur
            ctx.imageSmoothingEnabled = false;
            ctx.globalAlpha = 1.0;
            ctx.drawImage(this.offscreen, 0, 0, width, height);

            ctx.imageSmoothingEnabled = prevSmooth;
        }

        ctx.restore();

        // 5. Brennspot, Lensflare & ballistische Kathoden-Funken
        this.drawBeamAndSparks(ctx, lineColor);
    }
}