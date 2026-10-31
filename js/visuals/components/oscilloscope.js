// === js/visuals/components/oscilloscope.js ===
// =========================================================
// REAL-TIME CRT PHOSPHOR TAPE OSCILLOSCOPE
// Incremental right-to-left beam burning with persistent glow,
// bounded spark pool and refresh-rate-independent 60 Hz sampling.
// =========================================================

const SAMPLE_RATE = 60;
const SAMPLE_INTERVAL = 1 / SAMPLE_RATE;
const SCROLL_STEP = 1;
const INTERNAL_SCALE = 0.5;
const MAX_SPARKS = 64;

function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
}

export class Oscilloscope {
    constructor(width, height) {
        this.offscreen = document.createElement('canvas');
        this.offscreenCtx = this.offscreen.getContext('2d');
        this.offscreenCtx.imageSmoothingEnabled = false;

        this.width = 0;
        this.height = 0;
        this.writeX = 0;
        this.sampleAccumulator = 0;
        this.lastSample = 0;
        this.lastY = 0;
        this.hasLastValue = false;
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

    resize(newWidth, newHeight) {
        const width = Math.max(0, Math.floor(newWidth));
        const height = Math.max(0, Math.floor(newHeight));
        if (width === this.width && height === this.height) return;

        let previousFrame = null;
        if (this.offscreen.width > 0 && this.offscreen.height > 0 && width > 0 && height > 0) {
            previousFrame = document.createElement('canvas');
            previousFrame.width = this.offscreen.width;
            previousFrame.height = this.offscreen.height;
            previousFrame.getContext('2d').drawImage(this.offscreen, 0, 0);
        }

        this.width = width;
        this.height = height;
        this.offscreen.width = Math.ceil(width * INTERNAL_SCALE);
        this.offscreen.height = Math.ceil(height * INTERNAL_SCALE);
        this.writeX = Math.max(0, this.offscreen.width - 1);
        this.offscreenCtx.imageSmoothingEnabled = false;
        this.offscreenCtx.fillStyle = '#000000';
        if (this.offscreen.width > 0 && this.offscreen.height > 0) {
            this.offscreenCtx.fillRect(0, 0, this.offscreen.width, this.offscreen.height);
            if (previousFrame) {
                this.offscreenCtx.drawImage(previousFrame, 0, 0, previousFrame.width, previousFrame.height,
                    0, 0, this.offscreen.width, this.offscreen.height);
            }
        }

        this.hasLastValue = false;
        this.sampleAccumulator = 0;
        for (const spark of this.sparks) spark.life = 0;
    }

    clear() {
        this.hasLastValue = false;
        this.lastSample = 0;
        this.sampleAccumulator = 0;
        this.writeX = Math.max(0, this.offscreen.width - 1);
        for (const spark of this.sparks) spark.life = 0;
        if (this.offscreen.width <= 0 || this.offscreen.height <= 0) return;
        this.offscreenCtx.fillStyle = '#000000';
        this.offscreenCtx.fillRect(0, 0, this.offscreen.width, this.offscreen.height);
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

    spawnSparks(x, y, speed) {
        const count = Math.min(4, Math.floor(speed / 12) + 1);
        for (let i = 0; i < count; i++) {
            const spark = this.sparks[this.sparkCursor];
            this.sparkCursor = (this.sparkCursor + 1) % MAX_SPARKS;
            spark.x = x;
            spark.y = y;
            spark.vx = -(60 + this.nextRandom() * 120);
            spark.vy = (this.nextRandom() - 0.5) * speed * 10;
            spark.life = 1;
            spark.decay = 1.4 + this.nextRandom() * 1.8;
        }
    }

    drawSparks(ctx, lineColor) {
        for (const spark of this.sparks) {
            if (spark.life <= 0) continue;
            spark.x += spark.vx * SAMPLE_INTERVAL - SCROLL_STEP;
            spark.y += spark.vy * SAMPLE_INTERVAL;
            spark.x = (spark.x + this.offscreen.width) % this.offscreen.width;
            spark.life -= spark.decay * SAMPLE_INTERVAL;
            if (spark.life <= 0) continue;

            ctx.fillStyle = spark.life > 0.6 ? '#ffffff' : lineColor;
            ctx.globalAlpha = spark.life;
            ctx.fillRect(Math.round(spark.x), Math.round(spark.y), 2, 2);
        }
        ctx.globalAlpha = 1;
    }

    burnSample(value, lineColor) {
        const ctx = this.offscreenCtx;
        const width = this.offscreen.width;
        const height = this.offscreen.height;
        this.writeX = (this.writeX + SCROLL_STEP) % width;
        const beamX = this.writeX;
        const beamY = clamp(
            Math.round(height / 2 - value * height * 0.40),
            4,
            height - 5
        );

        // Der Ringpuffer wird global abgedunkelt, aber nicht mehr in sich
        // selbst kopiert. Nur das neue Segment wird an writeX eingebrannt.
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.055)';
        ctx.fillRect(0, 0, width, height);

        const wrapped = this.writeX === 0;
        const previousY = this.hasLastValue && !wrapped ? this.lastY : beamY;
        const speed = Math.abs(beamY - previousY);
        const speedFactor = clamp(speed / 24, 0, 1);
        const previousX = wrapped ? beamX : beamX - SCROLL_STEP;

        // Kurzer, heller Glow nur um das neue Segment statt Vollbild-Bloom.
        ctx.beginPath();
        ctx.moveTo(previousX, previousY);
        ctx.lineTo(beamX, beamY);
        ctx.lineWidth = 3.2;
        ctx.strokeStyle = lineColor;
        ctx.globalAlpha = 0.22;
        ctx.shadowColor = lineColor;
        ctx.shadowBlur = 5;
        ctx.stroke();

        // Harter Strahlkern: ruhige Abschnitte werden heiß und weiß.
        const colorIndex = Math.round(clamp((0.35 - speedFactor) / 0.35, 0, 1) * 15);
        ctx.beginPath();
        ctx.moveTo(previousX, previousY);
        ctx.lineTo(beamX, beamY);
        ctx.lineWidth = 1.5 - speedFactor * 0.8;
        ctx.strokeStyle = this.coreColors[colorIndex];
        ctx.globalAlpha = 1 - speedFactor * 0.5;
        ctx.shadowBlur = 0;
        ctx.stroke();
        ctx.globalAlpha = 1;

        if (speed > 4) this.spawnSparks(beamX, beamY, speed);
        this.drawSparks(ctx, lineColor);

        // Kathodenbrenner und elektromagnetisches Fadenkreuz.
        ctx.fillStyle = lineColor;
        ctx.globalAlpha = 0.32;
        ctx.beginPath();
        ctx.arc(beamX, beamY, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = lineColor;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(beamX, beamY, 1.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        const flareHeight = Math.min(height * 0.5, 6 + speed * 0.65);
        ctx.globalAlpha = 0.82;
        ctx.fillRect(beamX - 13, beamY, 25, 1);
        ctx.fillRect(beamX, Math.round(beamY - flareHeight / 2), 1, Math.round(flareHeight));
        ctx.globalAlpha = 1;

        this.lastY = beamY;
        this.hasLastValue = true;
    }

    render(ctx, width, height, stateGetters, lineColor, deltaTime = 1 / 60) {
        if (width <= 0 || height <= 0) return;
        if (this.width !== width || this.height !== height) {
            this.resize(width, height);
        }

        this.prepareColors(lineColor);
        const trackData = stateGetters.getTrackData();
        const hasTrack = !!trackData && (trackData.length || 0) > 0;
        const rawValue = stateGetters.getCurrentOscValue();
        const targetValue = hasTrack && Number.isFinite(rawValue) ? clamp(rawValue, -1, 1) : 0;
        const dt = Number.isFinite(deltaTime) ? clamp(deltaTime, 0, 0.1) : SAMPLE_INTERVAL;
        this.sampleAccumulator += dt;

        const steps = Math.min(4, Math.floor(this.sampleAccumulator * SAMPLE_RATE + 1e-7));
        if (steps > 0) {
            this.sampleAccumulator -= steps * SAMPLE_INTERVAL;
            const startValue = this.lastSample;
            for (let step = 0; step < steps; step++) {
                const blend = (step + 1) / steps;
                const value = startValue + (targetValue - startValue) * blend;
                this.burnSample(value, lineColor);
            }
            this.lastSample = targetValue;
        }

        // Älteste bis neueste Tape-Position ohne Vollbild-Verschiebung ausgeben.
        const bufferWidth = this.offscreen.width;
        const bufferHeight = this.offscreen.height;
        const oldestX = (this.writeX + SCROLL_STEP) % bufferWidth;
        const firstWidth = bufferWidth - oldestX;
        const firstOutputWidth = Math.round(firstWidth * width / bufferWidth);

        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 1;
        ctx.drawImage(this.offscreen,
            oldestX, 0, firstWidth, bufferHeight,
            0, 0, firstOutputWidth, height);
        if (oldestX > 0) {
            ctx.drawImage(this.offscreen,
                0, 0, oldestX, bufferHeight,
                firstOutputWidth, 0, width - firstOutputWidth, height);
        }
        ctx.globalCompositeOperation = 'source-over';
    }
}
