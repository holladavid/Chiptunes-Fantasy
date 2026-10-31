// === js/visuals/components/oscilloscope.js ===
// =========================================================
// REAL-TIME PCM CRT PHOSPHOR SWEEP OSCILLOSCOPE
// Triggered 32 ms time-domain window, per-column min/max raster,
// fast left-to-right beam and independent short persistence.
// =========================================================

const DEFAULT_FRAME_INTERVAL = 1 / 60;
const TIME_WINDOW_SECONDS = 0.032;
const SWEEP_DURATION = 0.032;
const PERSISTENCE_SECONDS = 0.42;
const PERSISTENCE_HOLD = 0.04;
const PERSISTENCE_DECAY = 0.14;
const MEMORY_ALPHA = 0.30;
const INTERNAL_SCALE = 0.5;
const AMPLITUDE_LEVELS = 160;
const AMPLITUDE_GAIN = 1.25;
const TRIGGER_HYSTERESIS = 0.012;
const MAX_SPARKS = 64;
const EPSILON = 1e-7;

function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
}

export class Oscilloscope {
    constructor(width, height) {
        // Die aktuelle Sweep-Spur und die abgeschlossene Referenzspur bleiben
        // getrennt. Dadurch kann die alte Linie dimmen, ohne den Schreibstrahl
        // oder dessen helle Kernfarbe mit abzudunkeln.
        this.offscreen = document.createElement('canvas');
        this.offscreenCtx = this.offscreen.getContext('2d');
        this.memory = document.createElement('canvas');
        this.memoryCtx = this.memory.getContext('2d');
        this.offscreenCtx.imageSmoothingEnabled = false;
        this.memoryCtx.imageSmoothingEnabled = false;

        this.width = 0;
        this.height = 0;
        this.analyserKey = '';
        this.timeDomainData = null;
        this.timeDomainBytes = null;
        this.audioSampleRate = 48000;
        this.windowSampleCount = 0;
        this.captureCount = 0;
        this.triggerPosition = 0;
        this.triggered = false;

        this.columnMin = new Float32Array(0);
        this.columnMax = new Float32Array(0);
        this.columnTop = new Int16Array(0);
        this.columnBottom = new Int16Array(0);
        this.columnMid = new Int16Array(0);

        this.sweepActive = false;
        this.sweepElapsed = 0;
        this.sweepCursor = 0;
        this.beamX = 0;
        this.beamY = 0;
        this.hasCurrentTrace = false;
        this.hasMemory = false;
        this.memoryAge = PERSISTENCE_SECONDS;

        this.colorKey = '';
        this.coreColors = [];
        this.randomState = 0x6d2b79f5;

        // Fester Pool: keine Objekt- oder Splice-Flut im Renderloop.
        this.sparks = Array.from({ length: MAX_SPARKS }, () => ({
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            life: 0,
            decay: 0
        }));
        this.sparkCursor = 0;

        this.resize(width, height);
    }

    copySurface(source) {
        if (source.width <= 0 || source.height <= 0) return null;
        const copy = document.createElement('canvas');
        copy.width = source.width;
        copy.height = source.height;
        copy.getContext('2d').drawImage(source, 0, 0);
        return copy;
    }

    clearSurface(ctx, surface) {
        if (surface.width <= 0 || surface.height <= 0) return;
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
    }

    resize(newWidth, newHeight) {
        const width = Math.max(0, Math.floor(newWidth));
        const height = Math.max(0, Math.floor(newHeight));
        if (width === this.width && height === this.height) return;

        const oldBufferWidth = this.offscreen.width;
        const previousTrace = this.width > 0 && this.height > 0 ? this.copySurface(this.offscreen) : null;
        const previousMemory = this.width > 0 && this.height > 0 ? this.copySurface(this.memory) : null;

        this.width = width;
        this.height = height;
        this.offscreen.width = Math.ceil(width * INTERNAL_SCALE);
        this.offscreen.height = Math.ceil(height * INTERNAL_SCALE);
        this.memory.width = this.offscreen.width;
        this.memory.height = this.offscreen.height;
        this.offscreenCtx.imageSmoothingEnabled = false;
        this.memoryCtx.imageSmoothingEnabled = false;
        this.allocateRaster(this.offscreen.width);

        if (this.offscreen.width > 0 && this.offscreen.height > 0) {
            if (previousTrace) {
                this.offscreenCtx.drawImage(previousTrace,
                    0, 0, previousTrace.width, previousTrace.height,
                    0, 0, this.offscreen.width, this.offscreen.height);
            }
            if (previousMemory) {
                this.memoryCtx.drawImage(previousMemory,
                    0, 0, previousMemory.width, previousMemory.height,
                    0, 0, this.memory.width, this.memory.height);
            }
        }

        if (oldBufferWidth > 0 && this.offscreen.width > 0) {
            const scaleX = this.offscreen.width / oldBufferWidth;
            this.sweepCursor = clamp(Math.round(this.sweepCursor * scaleX), 0, this.offscreen.width - 1);
            this.beamX = clamp(this.beamX * scaleX, 0, this.offscreen.width - 1);
        } else {
            this.sweepCursor = 0;
            this.beamX = 0;
        }
        if (this.sweepActive && this.timeDomainData) this.buildSweepRaster();
        this.beamY = this.sweepActive ? this.getSweepY(this.beamX) : 0;
        for (const spark of this.sparks) spark.life = 0;
    }

    clear() {
        this.triggerPosition = 0;
        this.triggered = false;
        this.captureCount = 0;
        if (this.timeDomainData) this.timeDomainData.fill(0);
        this.columnMin.fill(0);
        this.columnMax.fill(0);
        this.columnTop.fill(0);
        this.columnBottom.fill(0);
        this.columnMid.fill(0);
        this.sweepActive = false;
        this.sweepElapsed = 0;
        this.sweepCursor = 0;
        this.beamX = 0;
        this.beamY = 0;
        this.hasCurrentTrace = false;
        this.hasMemory = false;
        this.memoryAge = PERSISTENCE_SECONDS;
        for (const spark of this.sparks) spark.life = 0;
        this.clearSurface(this.offscreenCtx, this.offscreen);
        this.clearSurface(this.memoryCtx, this.memory);
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
        if (lineColor === this.colorKey) return;
        this.colorKey = lineColor;
        const red = parseInt(lineColor.slice(1, 3), 16);
        const green = parseInt(lineColor.slice(3, 5), 16);
        const blue = parseInt(lineColor.slice(5, 7), 16);
        this.coreColors.length = 16;
        for (let i = 0; i < 16; i++) {
            const blend = i / 15 * 0.85;
            const r = Math.round(red + (255 - red) * blend);
            const g = Math.round(green + (255 - green) * blend);
            const b = Math.round(blue + (255 - blue) * blend);
            this.coreColors[i] = `rgb(${r}, ${g}, ${b})`;
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
            this.timeDomainBytes = null;
        }
        this.windowSampleCount = Math.min(
            fftSize - 2,
            Math.max(32, Math.round(sampleRate * TIME_WINDOW_SECONDS))
        );
        return true;
    }

    captureWaveform(analyser) {
        const data = this.timeDomainData;
        if (!analyser || !data) return false;
        if (typeof analyser.getFloatTimeDomainData === 'function') {
            analyser.getFloatTimeDomainData(data);
        } else if (typeof analyser.getByteTimeDomainData === 'function') {
            if (!this.timeDomainBytes) this.timeDomainBytes = new Uint8Array(data.length);
            analyser.getByteTimeDomainData(this.timeDomainBytes);
            for (let i = 0; i < data.length; i++) data[i] = (this.timeDomainBytes[i] - 128) / 128;
        } else {
            return false;
        }

        // DC entfernen, damit der Nulldurchgangstrigger unabhängig vom
        // Mittelwert des gerade aktiven Chip-Signals arbeitet.
        let mean = 0;
        for (let i = 0; i < data.length; i++) mean += data[i];
        mean /= data.length;
        for (let i = 0; i < data.length; i++) data[i] -= mean;

        const maximumStart = data.length - this.windowSampleCount - 1;
        let armed = false;
        this.triggerPosition = 0;
        this.triggered = false;
        for (let i = 1; i <= maximumStart; i++) {
            const previous = data[i - 1];
            const current = data[i];
            if (previous < -TRIGGER_HYSTERESIS) armed = true;
            if (!armed || previous > 0 || current <= 0) continue;
            const fraction = clamp(-previous / Math.max(EPSILON, current - previous), 0, 1);
            this.triggerPosition = i - 1 + fraction;
            this.triggered = true;
            break;
        }

        this.captureCount++;
        this.buildSweepRaster();
        return true;
    }

    valueToY(value) {
        const height = this.offscreen.height;
        const normalized = clamp(0.5 - value * AMPLITUDE_GAIN * 0.42, 0, 1);
        if (height <= 8) return clamp(Math.round(normalized * (height - 1)), 0, Math.max(0, height - 1));
        const usable = height - 8;
        const levels = Math.min(AMPLITUDE_LEVELS, usable + 1);
        const level = Math.round(normalized * (levels - 1));
        return 4 + Math.round(level / (levels - 1) * usable);
    }

    buildSweepRaster() {
        const width = this.offscreen.width;
        const data = this.timeDomainData;
        if (!data || width <= 0 || this.windowSampleCount <= 0) return;
        const start = this.triggerPosition;
        for (let x = 0; x < width; x++) {
            const first = clamp(Math.floor(start + x * this.windowSampleCount / width), 0, data.length - 1);
            const last = clamp(Math.floor(start + (x + 1) * this.windowSampleCount / width), first, data.length - 1);
            let minimum = Infinity;
            let maximum = -Infinity;
            for (let i = first; i <= last; i++) {
                const value = data[i];
                if (value < minimum) minimum = value;
                if (value > maximum) maximum = value;
            }
            this.columnMin[x] = minimum;
            this.columnMax[x] = maximum;
            this.columnTop[x] = this.valueToY(maximum);
            this.columnBottom[x] = this.valueToY(minimum);
            this.columnMid[x] = this.valueToY((minimum + maximum) * 0.5);
        }
    }

    getSweepY(x) {
        if (this.columnMid.length === 0) return 0;
        return this.columnMid[clamp(Math.round(x), 0, this.columnMid.length - 1)];
    }

    startSweep(analyser) {
        if (!this.captureWaveform(analyser)) {
            this.sweepActive = false;
            return false;
        }
        this.clearSurface(this.offscreenCtx, this.offscreen);
        this.sweepActive = true;
        this.sweepElapsed = 0;
        this.sweepCursor = 0;
        this.beamX = 0;
        this.beamY = this.getSweepY(0);
        this.hasCurrentTrace = false;
        return true;
    }

    completeSweep() {
        this.clearSurface(this.memoryCtx, this.memory);
        if (this.hasCurrentTrace && this.offscreen.width > 0 && this.offscreen.height > 0) {
            this.memoryCtx.drawImage(this.offscreen, 0, 0);
            this.hasMemory = true;
            this.memoryAge = 0;
        }
        this.sweepActive = false;
        this.hasCurrentTrace = false;
        this.clearSurface(this.offscreenCtx, this.offscreen);
    }

    burnSweepTo(targetX, lineColor) {
        const ctx = this.offscreenCtx;
        const startX = this.sweepCursor;
        const endX = clamp(targetX, startX, this.offscreen.width - 1);
        this.beamX = endX;
        this.beamY = this.getSweepY(endX);
        if (endX === startX && this.hasCurrentTrace) return;

        let maximumDelta = 0;
        ctx.beginPath();
        if (!this.hasCurrentTrace) {
            ctx.moveTo(startX + 0.5, this.columnTop[startX] + 0.5);
            ctx.lineTo(startX + 0.5, this.columnBottom[startX] + 0.5);
            maximumDelta = this.columnBottom[startX] - this.columnTop[startX];
        }

        let previousY = this.getSweepY(startX);
        for (let x = startX + 1; x <= endX; x++) {
            const top = this.columnTop[x];
            const bottom = this.columnBottom[x];
            const middle = this.columnMid[x];
            ctx.moveTo(x + 0.5, top + 0.5);
            ctx.lineTo(x + 0.5, bottom + 0.5);
            ctx.moveTo(x - 0.5, previousY + 0.5);
            ctx.lineTo(x + 0.5, middle + 0.5);
            maximumDelta = Math.max(maximumDelta, bottom - top, Math.abs(middle - previousY));
            previousY = middle;
        }

        ctx.globalCompositeOperation = 'source-over';
        ctx.lineCap = 'butt';
        ctx.lineJoin = 'miter';

        // Min/Max-Balken erhalten auch kurze Impulse, während die Mittellinie
        // bei langsamen Schwingungen als harte Pixelkontur lesbar bleibt.
        ctx.lineWidth = 3;
        ctx.strokeStyle = lineColor;
        ctx.globalAlpha = 0.20;
        ctx.shadowBlur = 0;
        ctx.stroke();

        const speedFactor = clamp(maximumDelta / 32, 0, 1);
        const colorIndex = Math.round(clamp((0.35 - speedFactor) / 0.35, 0, 1) * 15);
        ctx.lineWidth = 1;
        ctx.strokeStyle = this.coreColors[colorIndex];
        ctx.globalAlpha = 1 - speedFactor * 0.30;
        ctx.shadowBlur = 0;
        ctx.stroke();
        ctx.globalAlpha = 1;
        this.sweepCursor = endX;
        this.hasCurrentTrace = true;

        if (maximumDelta > 10) this.spawnSparks(endX, this.beamY, maximumDelta);
    }

    advanceSweeps(deltaTime, mayStart, analyser) {
        let remaining = deltaTime;
        let guard = 0;
        while (guard++ < 8) {
            if (!this.sweepActive) {
                if (!mayStart || !this.startSweep(analyser)) break;
            }

            const step = Math.min(remaining, Math.max(0, SWEEP_DURATION - this.sweepElapsed));
            this.sweepElapsed += step;
            const progress = clamp(this.sweepElapsed / SWEEP_DURATION, 0, 1);
            const targetX = Math.floor(progress * (this.offscreen.width - 1) + EPSILON);
            this.burnSweepTo(targetX, this.colorKey);
            remaining -= step;

            if (this.sweepElapsed + EPSILON < SWEEP_DURATION) break;
            this.completeSweep(); // Retrace bleibt leer: kein Strich von rechts nach links.
            if (remaining <= EPSILON) break;
        }
    }

    spawnSparks(x, y, speed) {
        const count = Math.min(4, Math.floor(speed / 24) + 1);
        for (let i = 0; i < count; i++) {
            const spark = this.sparks[this.sparkCursor];
            this.sparkCursor = (this.sparkCursor + 1) % MAX_SPARKS;
            spark.x = x;
            spark.y = y;
            spark.vx = -(45 + this.nextRandom() * 110);
            spark.vy = (this.nextRandom() - 0.5) * speed * 5;
            spark.life = 1;
            spark.decay = 1.4 + this.nextRandom() * 1.8;
        }
    }

    updateSparks(deltaTime) {
        for (const spark of this.sparks) {
            if (spark.life <= 0) continue;
            spark.x += spark.vx * deltaTime;
            spark.y += spark.vy * deltaTime;
            spark.life -= spark.decay * deltaTime;
            if (spark.x < -3 || spark.y < -3 || spark.y > this.offscreen.height + 3) spark.life = 0;
        }
    }

    drawBeamAndSparks(ctx, lineColor) {
        const scaleX = this.width / this.offscreen.width;
        const scaleY = this.height / this.offscreen.height;
        ctx.save();
        ctx.scale(scaleX, scaleY);

        for (const spark of this.sparks) {
            if (spark.life <= 0) continue;
            ctx.fillStyle = spark.life > 0.6 ? '#ffffff' : lineColor;
            ctx.globalAlpha = spark.life;
            ctx.fillRect(Math.round(spark.x), Math.round(spark.y), 2, 2);
        }

        if (this.sweepActive) {
            ctx.globalAlpha = 0.30;
            ctx.fillStyle = lineColor;
            ctx.beginPath();
            ctx.arc(this.beamX, this.beamY, 5, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalAlpha = 1;
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = lineColor;
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(this.beamX, this.beamY, 1.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            const speed = Math.abs(this.getSweepY(this.beamX) - this.getSweepY(Math.max(0, this.beamX - 2)));
            const flareHeight = Math.min(this.offscreen.height * 0.5, 6 + speed * 1.8);
            ctx.globalAlpha = 0.78;
            ctx.fillRect(this.beamX - 13, this.beamY, 25, 1);
            ctx.fillRect(this.beamX, Math.round(this.beamY - flareHeight / 2), 1, Math.max(1, Math.round(flareHeight)));
        }
        ctx.restore();
    }

    getMemoryAlpha() {
        if (!this.hasMemory || this.memoryAge >= PERSISTENCE_SECONDS) return 0;
        const ageAfterHold = Math.max(0, this.memoryAge - PERSISTENCE_HOLD);
        return MEMORY_ALPHA * Math.exp(-ageAfterHold / PERSISTENCE_DECAY);
    }

    render(ctx, width, height, stateGetters, lineColor, deltaTime = DEFAULT_FRAME_INTERVAL) {
        if (width <= 0 || height <= 0) return;
        if (this.width !== width || this.height !== height) {
            this.resize(width, height);
        }
        if (this.offscreen.width <= 0 || this.offscreen.height <= 0) return;

        this.prepareColors(lineColor);
        const trackData = stateGetters.getTrackData();
        const hasTrack = !!trackData && (trackData.length || 0) > 0;
        const isPlaying = stateGetters.getIsPlaying ? stateGetters.getIsPlaying() : hasTrack;
        const analyser = stateGetters.getAnalyserNode ? stateGetters.getAnalyserNode() : null;
        const audioCtx = stateGetters.getAudioContext ? stateGetters.getAudioContext() : null;
        const mayCapture = hasTrack && isPlaying && this.configureAnalyser(analyser, audioCtx);
        const dt = Number.isFinite(deltaTime) ? clamp(deltaTime, 0, 0.1) : DEFAULT_FRAME_INTERVAL;

        if (this.hasMemory) this.memoryAge += dt;
        this.advanceSweeps(dt, mayCapture, analyser);
        this.updateSparks(dt);

        const memoryAlpha = this.getMemoryAlpha();
        ctx.globalCompositeOperation = 'screen';
        if (memoryAlpha > 0.002) {
            ctx.globalAlpha = memoryAlpha;
            ctx.drawImage(this.memory, 0, 0, this.memory.width, this.memory.height, 0, 0, width, height);
        }
        if (this.hasCurrentTrace) {
            ctx.globalAlpha = 1;
            ctx.drawImage(this.offscreen, 0, 0, this.offscreen.width, this.offscreen.height, 0, 0, width, height);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        this.drawBeamAndSparks(ctx, lineColor);
    }
}
