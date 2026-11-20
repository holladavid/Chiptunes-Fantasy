// === js/visuals/components/oscilloscope.js ===
// =========================================================
// REAL-TIME PCM CRT PHOSPHOR SWEEP OSCILLOSCOPE
// True Z-axis velocity modulation (dwell-time intensity),
// dual-stage P31/P11 phosphor persistence, optical glass
// halation, HF-rejected MSE correlation trigger & cathode beam.
// =========================================================
//
// Hinweise zur Überarbeitung (API unverändert: new Oscilloscope(w, h), render(...), resize, clear):
// - Die Simulation läuft höchstens mit ~100 Hz (MIN_STEP_SECONDS): Nachleuchten und Memory-Helligkeit
//   sind bildratenunabhängig, 120/144/240-Hz-Displays kosten nicht mehr als 60 Hz.
// - Trigger: relative Hysterese-Untergrenze und pegelnormierte Korrelation (leise und mittellaute
//   Signale locken jetzt). Töne unter ~95 Hz brauchen analyser.fftSize >= 4096, sonst ist der
//   Suchbereich (fftSize - Fenster = 510 Samples) kürzer als die Periode.
// - Spur wird lagenweise statt spaltenweise gezeichnet (halb so viele Stilwechsel, pixelgleich).
// - Bloom sitzt mittig auf dem Spurabschnitt (vorher bei fallenden Flanken unterhalb davon).
// - Farben: auch rgb()/rgba()/benannte CSS-Farben (vorher nur #hex, sonst stilles Grün).

const DEFAULT_FRAME_INTERVAL = 1 / 60;
const TIME_WINDOW_SECONDS = 0.032;
const TRIGGER_HYSTERESIS = 0.0008;   // absolute Untergrenze; darüber gelten 8 % des Spitzenpegels
const AMPLITUDE_GAIN = 1.24;
const BLOOM_SCALE = 0.25;
const COLOR_LUT_SIZE = 32;
const MAX_SPARKS = 64;
const CORR_POINTS = 64;
const IDLE_CLEAR_SECONDS = 1.25;
const EPSILON = 1e-7;
const NO_LAYER = 255;

// Ab ~10 ms Schrittweite greifen die Untergrenzen der Fade-Raten nie (sie sollen nur 8-Bit-Alpha-
// Reste verhindern): das Nachleuchten bleibt bildratenunabhängig.
const MIN_STEP_SECONDS = 0.01;
// Einlagerung in die Memory-Schicht: bei 60 Hz 0.26, sonst proportional zur Fade-Rate des Schritts.
const MEMORY_DEPOSIT_AT_60HZ = 0.26;
const MEMORY_FADE_AT_60HZ = 1 - Math.exp(-8.0 / 60);

const DEFAULT_RGB = [85, 255, 85];

function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
}

function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

let colorProbeCtx = null;

// #rgb / #rgba / #rrggbb / #rrggbbaa, rgb()/rgba(); alles andere (benannte Farben, hsl(), ...)
// löst der Browser auf. Ungültige Werte ergeben das Standard-Phosphorgrün.
function parseColor(color, depth = 0) {
    if (typeof color !== 'string') return DEFAULT_RGB;
    const text = color.trim();

    const hexMatch = /^#([0-9a-f]+)$/i.exec(text);
    if (hexMatch) {
        let hex = hexMatch[1];
        if (hex.length === 3 || hex.length === 4) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        if (hex.length < 6) return DEFAULT_RGB;
        return [
            parseInt(hex.slice(0, 2), 16) || 0,
            parseInt(hex.slice(2, 4), 16) || 0,
            parseInt(hex.slice(4, 6), 16) || 0
        ];
    }

    const rgbMatch = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(text);
    if (rgbMatch) {
        return [1, 2, 3].map(i => clamp(Math.round(parseFloat(rgbMatch[i])) || 0, 0, 255));
    }

    if (depth === 0 && typeof document !== 'undefined') {
        if (!colorProbeCtx) colorProbeCtx = document.createElement('canvas').getContext('2d');
        colorProbeCtx.fillStyle = '#55ff55';
        colorProbeCtx.fillStyle = text;   // ungültige Werte werden ignoriert
        return parseColor(colorProbeCtx.fillStyle, 1);
    }
    return DEFAULT_RGB;
}

// Quantisierte Fade-Strings vermeiden Template-String-Allokationen pro Frame
const FADE_STRING_CACHE = new Array(101);
function getFadeStyle(alpha) {
    const step = clamp(Math.round(alpha * 100), 1, 100);
    return FADE_STRING_CACHE[step] || (FADE_STRING_CACHE[step] = `rgba(0, 0, 0, ${(step / 100).toFixed(2)})`);
}

function applyDrawStyle(ctx, state, color, alpha) {
    const qAlpha = Math.round(clamp01(alpha) * 32) / 32;
    if (state.color !== color) {
        state.color = color;
        ctx.fillStyle = color;
    }
    if (state.alpha !== qAlpha) {
        state.alpha = qAlpha;
        ctx.globalAlpha = qAlpha;
    }
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
        this.configuredFftSize = 0;
        this.configuredSampleRate = 0;
        this.timeDomainData = null;
        this.triggerFilterBuf = null;
        this.prevTriggerWave = new Float32Array(CORR_POINTS);
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
        this.colColor = new Uint8Array(0);
        this.colAlphaHalo = new Uint8Array(0);
        this.colAlphaCore = new Uint8Array(0);
        this.colAlphaTurn = new Uint8Array(0);
        this.colAlphaPlateau = new Uint8Array(0);
        this.colSegTop = new Int16Array(0);
        this.colSpan = new Int16Array(0);
        this.dwellLut = new Float64Array(0);
        this.yMargin = 0;
        this.yUsable = 1;

        this.stepAccumulator = 0;
        this.forceStep = true;
        this.sweepActive = false;
        this.sweepPhase = 0;
        this.beamX = 0;
        this.beamY = 0;
        this.hasCurrentTrace = false;
        this.hasMemory = false;
        this.activeIdleFade = 0;
        this.idleElapsed = 0;

        this.colorKey = '';
        this.baseRgb = [85, 255, 85];
        this.coreColors = new Array(COLOR_LUT_SIZE);
        this.haloColors = new Array(COLOR_LUT_SIZE);
        this.offscreenStyle = { color: '', alpha: -1 };
        this.bloomStyle = { color: '', alpha: -1 };
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
        this.hasActiveSparks = false;

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
        this.colColor = new Uint8Array(width);
        this.colAlphaHalo = new Uint8Array(width);
        this.colAlphaCore = new Uint8Array(width);
        this.colAlphaTurn = new Uint8Array(width);
        this.colAlphaPlateau = new Uint8Array(width);
        this.colSegTop = new Int16Array(width);
        this.colSpan = new Int16Array(width);
    }

    // Höhenabhängige Tabellen: Wertebereich der Spur und Verweildauer-Energie (pow() je Spalte -> Lookup)
    buildHeightTables(height) {
        const margin = Math.min(6, Math.floor(height * 0.04));
        this.yMargin = margin;
        this.yUsable = Math.max(1, height - margin * 2);
        const size = Math.max(0, height) + 2;
        if (this.dwellLut.length !== size) {
            this.dwellLut = new Float64Array(size);
            for (let d = 0; d < size; d++) this.dwellLut[d] = Math.pow(1 / (1 + d * 0.22), 0.62);
        }
    }

    resize(newWidth, newHeight) {
        const width = Math.max(0, Math.floor(newWidth));
        const height = Math.max(0, Math.floor(newHeight));
        if (width === this.width && height === this.height) return;

        const oldWidth = this.offscreen.width;
        const prevTrace = (this.hasCurrentTrace && this.width > 0 && this.height > 0)
            ? this.copySurface(this.offscreen)
            : null;
        const prevMemory = (this.hasMemory && this.width > 0 && this.height > 0)
            ? this.copySurface(this.memory)
            : null;

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
        this.buildHeightTables(height);

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
        this.hasActiveSparks = false;
        this.forceStep = true;
    }

    clear() {
        this.triggerPosition = 0;
        this.triggered = false;
        this.captureCount = 0;
        this.signalRms = 0;
        if (this.timeDomainData) this.timeDomainData.fill(0);
        this.prevTriggerWave.fill(0);
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
        this.idleElapsed = 0;
        this.stepAccumulator = 0;
        this.forceStep = true;
        for (const spark of this.sparks) spark.life = 0;
        this.hasActiveSparks = false;
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

        const [rBase, gBase, bBase] = parseColor(lineColor);
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
        if (fftSize === this.configuredFftSize && sampleRate === this.configuredSampleRate) return true;

        this.configuredFftSize = fftSize;
        this.configuredSampleRate = sampleRate;
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
        let trigPeak = 0;
        let trigPower = 0;
        for (let i = 0; i < data.length; i++) {
            lp += (data[i] - lp) * alpha;
            trigBuf[i] = lp;
            const absLp = Math.abs(lp);
            if (absLp > trigPeak) trigPeak = absLp;
            trigPower += lp * lp;
        }
        // Flankensteilheit und Korrelationsfehler pegelnormiert: gleiches Verhalten bei laut und leise
        const invPower = 1 / Math.max(trigPower / data.length, 1e-10);
        const invPeak = 1 / Math.max(trigPeak, 1e-6);

        // 3. Schmitt-Trigger mit adaptiver Hysterese & auflösungsunabhängigem MSE-Korrelations-Lock
        const dynamicHysteresis = Math.max(TRIGGER_HYSTERESIS, peak * 0.08);
        const maximumStart = Math.max(1, data.length - this.windowSampleCount - 2);
        let armed = false;
        let bestPos = 0;
        let bestScore = -Infinity;
        let foundAny = false;

        const corrStride = Math.max(1, Math.floor(this.windowSampleCount / CORR_POINTS));
        const invCorrPoints = 1 / CORR_POINTS;

        for (let i = 2; i <= maximumStart; i++) {
            const prev = trigBuf[i - 1];
            const curr = trigBuf[i];
            if (prev < -dynamicHysteresis) armed = true;
            if (!armed || prev > 0 || curr <= 0) continue;

            const fraction = clamp(-prev / Math.max(EPSILON, curr - prev), 0, 1);
            const candidatePos = i - 1 + fraction;
            const slope = (curr - trigBuf[i - 2]) * invPeak;

            // Auflösungs- und pegelunabhängiger Mean Squared Error (-MSE) gegen die Vorperiode
            let mseNeg = 0;
            if (this.captureCount > 0) {
                for (let k = 0; k < CORR_POINTS; k++) {
                    const idx = Math.min(data.length - 1, i + k * corrStride);
                    const diff = trigBuf[idx] - this.prevTriggerWave[k];
                    mseNeg -= diff * diff;
                }
                mseNeg *= invCorrPoints * invPower;
            }

            // Bevorzuge frühe stabile Triggerpunkte mit steiler Flanke und hoher Periodenähnlichkeit
            const positionPenalty = (i / maximumStart) * 0.06;
            const score = mseNeg * 0.25 + slope * 0.225 - positionPenalty;

            if (score > bestScore) {
                bestScore = score;
                bestPos = candidatePos;
                foundAny = true;
                if (this.captureCount > 0 && mseNeg > -0.016 && i > 8) break;
            }
            armed = false;
        }

        this.triggerPosition = foundAny ? bestPos : 0;
        this.triggered = foundAny;

        // Referenz-Hüllkurve für den nächsten Frame mit leichtem Leaky-Integrator speichern
        const baseIdx = Math.floor(this.triggerPosition);
        for (let k = 0; k < CORR_POINTS; k++) {
            const idx = Math.min(data.length - 1, baseIdx + k * corrStride);
            this.prevTriggerWave[k] = this.prevTriggerWave[k] * 0.65 + trigBuf[idx] * 0.35;
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
        if (this.offscreen.height <= 2) return 0;
        // Authentisches thermisches Vorverstärker-Rauschen (~0.25 px), damit die 0V-Linie analog lebt
        const thermalNoise = (this.nextRandom() - 0.5) * 0.0018;
        const normalized = clamp01(0.5 - (value + thermalNoise) * AMPLITUDE_GAIN * 0.42);
        return this.yMargin + Math.round(normalized * this.yUsable);
    }

    buildSweepRaster() {
        const width = this.offscreen.width;
        const data = this.timeDomainData;
        if (!data || width <= 0 || this.windowSampleCount <= 0) return;

        const start = this.triggerPosition;
        const samplesPerCol = this.windowSampleCount / width;
        let vStart = this.sampleInterpolated(start);

        for (let x = 0; x < width; x++) {
            const posStart = start + x * samplesPerCol;
            const posEnd = posStart + samplesPerCol;

            const firstIdx = clamp(Math.ceil(posStart), 0, data.length - 1);
            const lastIdx = clamp(Math.floor(posEnd), 0, data.length - 1);

            const vMid = this.sampleInterpolated(posStart + samplesPerCol * 0.5);
            const vEnd = this.sampleInterpolated(posEnd);

            let minimum = Math.min(vStart, vMid, vEnd);
            let maximum = Math.max(vStart, vMid, vEnd);

            for (let i = firstIdx; i <= lastIdx; i++) {
                const v = data[i];
                if (v < minimum) minimum = v;
                if (v > maximum) maximum = v;
            }

            vStart = vEnd;

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
        if (!this.hasCurrentTrace && !this.hasMemory) return;

        if (!isActive) {
            this.idleElapsed += dt;
            // Verhindert dauerhafte 8-Bit-Alpha-Geisterreste durch destination-out-Rundung
            if (this.idleElapsed >= IDLE_CLEAR_SECONDS && this.activeIdleFade <= 0) {
                this.hasCurrentTrace = false;
                this.hasMemory = false;
                this.clearSurface(this.offscreenCtx, this.offscreen);
                this.clearSurface(this.memoryCtx, this.memory);
                this.clearSurface(this.bloomCtx, this.bloom);
                return;
            }
        } else {
            this.idleElapsed = 0;
        }

        // Zweistufiges P31/P11-Phosphor-Abklingen:
        const fastFade = isActive
            ? clamp(1 - Math.exp(-16.5 * dt), 0.14, 0.48)
            : clamp(1 - Math.exp(-8.5 * dt), 0.08, 0.35);

        const slowFade = isActive
            ? clamp(1 - Math.exp(-8.0 * dt), 0.05, 0.22)
            : clamp(1 - Math.exp(-10.0 * dt), 0.06, 0.25);

        const bloomFade = clamp(1 - Math.exp(-18.0 * dt), 0.15, 0.55);

        if (this.offscreen.width > 0 && this.offscreen.height > 0) {
            this.offscreenCtx.save();
            this.offscreenCtx.globalCompositeOperation = 'destination-out';
            this.offscreenCtx.fillStyle = getFadeStyle(fastFade);
            this.offscreenCtx.fillRect(0, 0, this.offscreen.width, this.offscreen.height);
            this.offscreenCtx.restore();

            this.memoryCtx.save();
            this.memoryCtx.globalCompositeOperation = 'destination-out';
            this.memoryCtx.fillStyle = getFadeStyle(slowFade);
            this.memoryCtx.fillRect(0, 0, this.memory.width, this.memory.height);
            this.memoryCtx.restore();

            this.bloomCtx.save();
            this.bloomCtx.globalCompositeOperation = 'destination-out';
            this.bloomCtx.fillStyle = getFadeStyle(bloomFade);
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
        const oState = this.offscreenStyle;
        const bState = this.bloomStyle;

        // Stroboskopischer Kathoden-Fokusstrahl wandert sichtbar über die Welle (~2.1 Sweeps/Sek),
        // während die gesamte getriggerte Welle mit echter Verweildauer-Physik den Phosphor anregt.
        const prevBeamX = this.beamX;
        const sweepRate = 2.15 + clamp01(this.signalRms * 1.8) * 0.85;
        this.sweepPhase = (this.sweepPhase + dt * sweepRate) % 1;
        this.beamX = this.sweepPhase * (width - 1);
        this.beamY = this.getSweepY(this.beamX);

        const beamCol = Math.round(this.beamX);
        const cometLength = Math.max(18, Math.round(width * 0.14));
        const sparkWindow = Math.max(2, Math.ceil(width * dt * 2.5));

        const columnTop = this.columnTop;
        const columnBottom = this.columnBottom;
        const columnMid = this.columnMid;
        const columnEnergy = this.columnEnergy;
        const dwellLut = this.dwellLut;
        const colColor = this.colColor;
        const aHalo = this.colAlphaHalo;
        const aCore = this.colAlphaCore;
        const aTurn = this.colAlphaTurn;
        const aPlateau = this.colAlphaPlateau;
        const colSegTop = this.colSegTop;
        const colSpan = this.colSpan;

        bCtx.save();
        bCtx.globalCompositeOperation = 'source-over';
        bState.color = '';
        bState.alpha = -1;

        // Durchlauf 1: Parameter je Spalte bestimmen, Bloom einspeisen, Funken auslösen
        for (let x = 0; x < width; x++) {
            const top = columnTop[x];
            const bottom = columnBottom[x];
            const mid = columnMid[x];

            const prevTop = x > 0 ? columnTop[x - 1] : top;
            const prevBottom = x > 0 ? columnBottom[x - 1] : bottom;
            const prevMid = x > 0 ? columnMid[x - 1] : mid;

            // Lückenlose vertikale Verbindung zwischen Spalte x-1 und x
            const segTop = Math.min(top, prevBottom);
            const segBottom = Math.max(bottom, prevTop);
            const span = Math.max(1, segBottom - segTop + 1);
            const deltaY = Math.max(bottom - top, Math.abs(mid - prevMid), span - 1);

            // ECHTE CRT-PHYSIK (Z-Modulation / Dwell-Time):
            const dwellEnergy = deltaY < dwellLut.length
                ? dwellLut[deltaY]
                : Math.pow(1 / (1 + deltaY * 0.22), 0.62);

            const distBehindBeam = (beamCol - x + width) % width;
            const cometBoost = distBehindBeam < cometLength
                ? Math.pow(1 - distBehindBeam / cometLength, 2.2) * 0.38
                : 0;

            const totalEnergy = clamp01(dwellEnergy * 0.86 + cometBoost);
            columnEnergy[x] = totalEnergy;

            const colorIdx = clamp(Math.round(totalEnergy * (COLOR_LUT_SIZE - 1)), 0, COLOR_LUT_SIZE - 1);
            colColor[x] = colorIdx;
            colSegTop[x] = segTop;
            colSpan[x] = span;

            // Lagenmerkmale: Alpha als Index in 1/32-Schritten (so quantisiert auch applyDrawStyle)
            aHalo[x] = totalEnergy > 0.28 ? Math.round(clamp01((totalEnergy - 0.22) * 0.42) * 32) : NO_LAYER;
            if (span > 2) {
                const edgeAlpha = clamp(0.11 + Math.pow(totalEnergy, 1.15) * 0.89, 0.11, 1.0);
                aCore[x] = Math.round(clamp01(edgeAlpha) * 32);
                aTurn[x] = Math.round(clamp01(clamp(edgeAlpha * 1.45, 0.28, 0.96)) * 32);
                aPlateau[x] = NO_LAYER;
            } else {
                aCore[x] = NO_LAYER;
                aTurn[x] = NO_LAYER;
                aPlateau[x] = Math.round(clamp01(totalEnergy * 0.95) * 32);
            }

            // Optisches Halation-Blooming ins Viertel-Auflösungs-Canvas einspeisen, mittig auf dem
            // Spurabschnitt (Spalte x-1 -> x), nicht ab seinem Mittelpunkt nach unten
            if ((x & 1) === 0 && totalEnergy > 0.24) {
                const bloomHeight = Math.max(2, Math.ceil(span * bScaleY));
                const bloomX = Math.floor(x * bScaleX) - 1;
                const bloomY = Math.round((segTop + (span - 1) * 0.5) * bScaleY - bloomHeight * 0.5);
                applyDrawStyle(bCtx, bState, this.coreColors[colorIdx], totalEnergy * 0.55);
                bCtx.fillRect(bloomX, bloomY, 2, bloomHeight);
            }

            // Kathoden-Funken an extrem steilen Flanken auslösen, wenn der Fokusstrahl passiert
            if (deltaY > 14 && distBehindBeam <= sparkWindow) {
                if (this.nextRandom() < 0.45) {
                    this.spawnSparks(x, mid, deltaY);
                }
            }
        }

        bCtx.restore();

        // Durchlauf 2: Spur lagenweise zeichnen (Korona -> Kern -> Umkehrpunkte -> Plateau). Spalten
        // überlappen sich nicht, nur die Reihenfolge innerhalb einer Spalte zählt: das Ergebnis ist
        // pixelgleich zum spaltenweisen Zeichnen, aber Stilwechsel gibt es nur noch an Farb-/Alpha-
        // Übergängen entlang x.
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        oState.color = '';
        oState.alpha = -1;

        const halo = this.haloColors;
        const core = this.coreColors;

        for (let x = 0; x < width; x++) {
            const a = aHalo[x];
            if (a === NO_LAYER) continue;
            const color = halo[colColor[x]];
            if (oState.color !== color) { oState.color = color; ctx.fillStyle = color; }
            if (oState.alpha !== a) { oState.alpha = a; ctx.globalAlpha = a / 32; }
            ctx.fillRect(x, colSegTop[x] - 1, 1, colSpan[x] + 2);
        }

        for (let x = 0; x < width; x++) {
            const a = aCore[x];
            if (a === NO_LAYER) continue;
            const color = core[colColor[x]];
            if (oState.color !== color) { oState.color = color; ctx.fillStyle = color; }
            if (oState.alpha !== a) { oState.alpha = a; ctx.globalAlpha = a / 32; }
            ctx.fillRect(x, colSegTop[x], 1, colSpan[x]);
        }

        // Umkehrpunkt-Aufhellung an lokalen Extrema
        for (let x = 0; x < width; x++) {
            const a = aTurn[x];
            if (a === NO_LAYER) continue;
            const color = core[clamp(colColor[x] + 7, 0, COLOR_LUT_SIZE - 1)];
            if (oState.color !== color) { oState.color = color; ctx.fillStyle = color; }
            if (oState.alpha !== a) { oState.alpha = a; ctx.globalAlpha = a / 32; }
            const top = columnTop[x];
            ctx.fillRect(x, top, 1, 2);
            ctx.fillRect(x, Math.max(top, columnBottom[x] - 1), 1, 2);
        }

        // Flache Plateaus (vermeidet Doppel-Draws)
        for (let x = 0; x < width; x++) {
            const a = aPlateau[x];
            if (a === NO_LAYER) continue;
            const color = core[Math.min(COLOR_LUT_SIZE - 1, colColor[x] + 5)];
            if (oState.color !== color) { oState.color = color; ctx.fillStyle = color; }
            if (oState.alpha !== a) { oState.alpha = a; ctx.globalAlpha = a / 32; }
            ctx.fillRect(x, columnMid[x], 1, 2);
        }

        ctx.restore();

        // Aktuelle Fluoreszenz-Spur in die langsamer abklingende Phosphoreszenz-Schicht übertragen.
        // Die Einlagerung folgt der Fade-Rate des Schritts: gleiche Helligkeit bei jeder Bildrate.
        const slowFade = clamp(1 - Math.exp(-8.0 * dt), 0.05, 0.22);
        this.memoryCtx.save();
        this.memoryCtx.globalCompositeOperation = 'lighter';
        this.memoryCtx.globalAlpha = clamp01(MEMORY_DEPOSIT_AT_60HZ * slowFade / MEMORY_FADE_AT_60HZ);
        this.memoryCtx.drawImage(this.offscreen, 0, 0);
        this.memoryCtx.restore();

        this.hasCurrentTrace = true;
        this.hasMemory = true;
        this.activeIdleFade = 1;
        this.idleElapsed = 0;

        // Falls der Fokusstrahl beim Wrap-Around über eine Flanke lief
        if (prevBeamX > this.beamX && this.signalRms > 0.05) {
            const dy0 = Math.abs(columnBottom[0] - columnTop[0]);
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
        this.hasActiveSparks = true;
    }

    updateSparks(deltaTime) {
        if (!this.hasActiveSparks) return;
        const drag = Math.exp(-3.2 * deltaTime);
        const gravity = 140 * deltaTime;
        let anyAlive = false;

        for (const spark of this.sparks) {
            if (spark.life <= 0) continue;
            spark.px = spark.x;
            spark.py = spark.y;
            spark.vx *= drag;
            spark.vy = spark.vy * drag + gravity;
            spark.x += spark.vx * deltaTime;
            spark.y += spark.vy * deltaTime;
            spark.life -= spark.decay * deltaTime;

            if (spark.life <= 0 || spark.x < -4 || spark.y < -4 || spark.y > this.offscreen.height + 4) {
                spark.life = 0;
            } else {
                anyAlive = true;
            }
        }
        this.hasActiveSparks = anyAlive;
    }

    drawBeamAndSparks(ctx, lineColor) {
        if (!this.sweepActive && !this.hasActiveSparks) return;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // Ballistische Funken als kurze Bewegungs-Vektoren (Shutter-Streak) zeichnen
        if (this.hasActiveSparks) {
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
            ctx.fillStyle = this.coreColors[Math.max(0, COLOR_LUT_SIZE - 6)];
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

    // Ein Simulationsschritt: Welle erfassen, Phosphor abklingen lassen, Spur einbrennen, Funken bewegen.
    // Capture läuft vor dem Fade, damit auch ein fehlschlagender Capture den Idle-Pfad (mit Löschen) nimmt.
    simulate(dt, mayCapture, analyser) {
        const captured = mayCapture && this.captureWaveform(analyser);
        this.fadePhosphorSurfaces(dt, captured);

        if (captured) {
            this.sweepActive = true;
            this.burnPhosphorTrace(dt);
        } else {
            this.sweepActive = false;
            this.activeIdleFade = Math.max(0, this.activeIdleFade - dt * 2.4);
        }

        this.updateSparks(dt);
    }

    render(ctx, width, height, stateGetters, lineColor, deltaTime = DEFAULT_FRAME_INTERVAL) {
        width = Math.floor(width);
        height = Math.floor(height);
        if (!(width > 0) || !(height > 0)) return;
        if (this.width !== width || this.height !== height) {
            this.resize(width, height);
        }
        if (this.offscreen.width <= 0 || this.offscreen.height <= 0) return;

        this.prepareColors(lineColor);

        const getters = stateGetters || {};
        const trackData = getters.getTrackData ? getters.getTrackData() : null;
        const hasTrack = !!trackData && (trackData.length || 0) > 0;
        const isPlaying = getters.getIsPlaying ? getters.getIsPlaying() : hasTrack;
        const analyser = getters.getAnalyserNode ? getters.getAnalyserNode() : null;
        const audioCtx = getters.getAudioContext ? getters.getAudioContext() : null;
        const mayCapture = hasTrack && isPlaying && this.configureAnalyser(analyser, audioCtx);
        const dt = Number.isFinite(deltaTime) ? clamp(deltaTime, 0.001, 0.1) : DEFAULT_FRAME_INTERVAL;

        // Auf schnellen Displays Schritte bündeln (>= MIN_STEP_SECONDS), Komposition läuft jeden Frame
        this.stepAccumulator += dt;
        if (this.forceStep || this.stepAccumulator >= MIN_STEP_SECONDS) {
            const stepDt = Math.min(this.stepAccumulator, 0.1);
            this.stepAccumulator = 0;
            this.forceStep = false;
            this.simulate(stepDt, mayCapture, analyser);
        }

        this.compose(ctx, width, height, lineColor);
    }

    compose(ctx, width, height, lineColor) {
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
