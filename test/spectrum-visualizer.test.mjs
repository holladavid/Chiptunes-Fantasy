import test from 'node:test';
import assert from 'node:assert/strict';

import { FftAnalyzer } from '../js/visuals/components/fft-analyzer.js';
import { Oscilloscope } from '../js/visuals/components/oscilloscope.js';

class FakeContext {
    constructor(canvas) {
        this.canvas = canvas;
        this.fillRectCalls = 0;
        this.drawImageCalls = 0;
        this.selfDrawImageCalls = 0;
        this.strokeCalls = 0;
        this.imageSmoothingEnabled = true;
        this.globalAlpha = 1;
        this.globalCompositeOperation = 'source-over';
    }

    fillRect(...args) {
        assertNumeric(args);
        assert.ok(args[2] >= 0 && args[3] >= 0, 'negative fillRect size');
        this.fillRectCalls++;
    }

    drawImage(source, ...args) {
        assert.ok(source.width > 0 && source.height > 0, 'zero-sized drawImage source');
        assertNumeric(args);
        this.drawImageCalls++;
        if (source === this.canvas) this.selfDrawImageCalls++;
    }

    beginPath() {}
    moveTo(...args) { assertNumeric(args); }
    lineTo(...args) { assertNumeric(args); }
    stroke() { this.strokeCalls++; }
    arc(...args) { assertNumeric(args); }
    fill() {}
    fillText() {}
    clearRect(...args) { assertNumeric(args); }
}

class FakeCanvas {
    constructor() {
        this.width = 300;
        this.height = 150;
        this.context = new FakeContext(this);
    }

    getContext() {
        return this.context;
    }
}

function assertNumeric(values) {
    for (const value of values) {
        assert.ok(Number.isFinite(value), `non-finite canvas argument: ${value}`);
    }
}

globalThis.document = {
    createElement(name) {
        assert.equal(name, 'canvas');
        return new FakeCanvas();
    }
};

function createFixture() {
    let amplitude = 180;
    const buffers = [];
    let readCount = 0;
    const analyser = {
        frequencyBinCount: 2048,
        fftSize: 4096,
        getByteFrequencyData(array) {
            readCount++;
            buffers.push(array);
            for (let i = 0; i < array.length; i++) {
                array[i] = Math.max(0, Math.min(255, amplitude - (i % 97)));
            }
        }
    };
    let oscValue = 0;
    const getters = {
        getAnalyserNode: () => analyser,
        getAudioContext: () => ({ sampleRate: 48000 }),
        getIsPlaying: () => true,
        getTrackData: () => ({ length: 180 }),
        getCurrentOscValue: () => oscValue
    };
    return {
        getters,
        buffers,
        setAmplitude(value) { amplitude = value; },
        setOscValue(value) { oscValue = value; },
        get readCount() { return readCount; }
    };
}

function renderFftAtRate(fft, fixture, width, height, frames, dt) {
    const ctx = new FakeCanvas().getContext('2d');
    for (let i = 0; i < frames; i++) {
        fft.render(ctx, width, height, fixture.getters, '#6c5eb5', dt, 'c64');
    }
}

test('FFT reuses its analyser buffer and samples at 30 Hz', () => {
    const fixture = createFixture();
    const fft = new FftAnalyzer();
    renderFftAtRate(fft, fixture, 1280, 480, 120, 1 / 60);

    assert.ok(fixture.readCount >= 59 && fixture.readCount <= 60);
    assert.equal(new Set(fixture.buffers).size, 1);
    assert.equal(fft.dataArray.length, 2048);
});

test('FFT logarithmic bin ranges stay ordered and inside the analyser buffer', () => {
    const fixture = createFixture();
    const fft = new FftAnalyzer();
    renderFftAtRate(fft, fixture, 1280, 480, 2, 1 / 60);

    for (let i = 0; i < fft.barCount; i++) {
        assert.ok(fft.binRanges[i] >= 1);
        assert.ok(fft.binRanges[i] < fft.binRanges[i + 1]);
        assert.ok(fft.binRanges[i + 1] <= fixture.getters.getAnalyserNode().frequencyBinCount);
    }
});

test('FFT peak hold and gravity are independent of display refresh rate', () => {
    const fastFixture = createFixture();
    const slowFixture = createFixture();
    const fast = new FftAnalyzer();
    const slow = new FftAnalyzer();

    renderFftAtRate(fast, fastFixture, 1280, 480, 60, 1 / 120);
    renderFftAtRate(slow, slowFixture, 1280, 480, 15, 1 / 30);
    fastFixture.setAmplitude(0);
    slowFixture.setAmplitude(0);
    renderFftAtRate(fast, fastFixture, 1280, 480, 60, 1 / 120);
    renderFftAtRate(slow, slowFixture, 1280, 480, 15, 1 / 30);

    for (let i = 0; i < fast.barCount; i++) {
        assert.ok(Math.abs(fast.peaks[i] - slow.peaks[i]) <= fast.segmentStep * 2);
        assert.ok(Math.abs(fast.levels[i] - slow.levels[i]) < 0.08);
    }
});

test('FFT keeps its cached grid instance and handles zero-sized frames', () => {
    const fixture = createFixture();
    const fft = new FftAnalyzer();
    const ctx = new FakeCanvas().getContext('2d');
    fft.render(ctx, 800, 400, fixture.getters, '#6c5eb5', 1 / 60, 'c64');
    const grid = fft.staticGrid;
    const key = fft.layoutKey;

    fft.render(ctx, 800, 400, fixture.getters, '#6c5eb5', 1 / 60, 'c64');
    assert.equal(fft.staticGrid, grid);
    assert.equal(fft.layoutKey, key);
    fft.render(ctx, 0, 0, fixture.getters, '#6c5eb5', 1 / 60, 'c64');
    fft.render(ctx, 390, 296, fixture.getters, '#6c5eb5', 1 / 60, 'c64');
    assert.equal(fft.staticGrid, grid);
    assert.equal(fft.width, 390);
    assert.equal(fft.height, 296);
});

test('Oscilloscope burns only new segments and never self-copies the tape', () => {
    const fixture = createFixture();
    const osc = new Oscilloscope(1280, 480);
    const ctx = new FakeCanvas().getContext('2d');
    for (let i = 0; i < 120; i++) {
        fixture.setOscValue(Math.sin(i * 0.17));
        osc.render(ctx, 1280, 480, fixture.getters, '#6c5eb5', 1 / 60);
    }

    assert.equal(osc.offscreenCtx.selfDrawImageCalls, 0);
    assert.ok(osc.offscreenCtx.strokeCalls >= 238 && osc.offscreenCtx.strokeCalls <= 242);
    assert.ok(osc.offscreenCtx.strokeCalls < 1280);
});

test('Oscilloscope tape sampling is independent of display refresh rate', () => {
    function countBurns(frames, dt) {
        const fixture = createFixture();
        const osc = new Oscilloscope(640, 320);
        const ctx = new FakeCanvas().getContext('2d');
        let burns = 0;
        const burn = osc.burnSample.bind(osc);
        osc.burnSample = (...args) => {
            burns++;
            burn(...args);
        };
        for (let i = 0; i < frames; i++) {
            fixture.setOscValue(Math.sin(i * dt * 8));
            osc.render(ctx, 640, 320, fixture.getters, '#6c5eb5', dt);
        }
        return burns;
    }

    assert.equal(countBurns(120, 1 / 120), 60);
    assert.equal(countBurns(60, 1 / 60), 60);
    assert.equal(countBurns(30, 1 / 30), 60);
});

test('Oscilloscope uses a bounded spark pool and survives clear and resize', () => {
    const fixture = createFixture();
    const osc = new Oscilloscope(640, 320);
    const ctx = new FakeCanvas().getContext('2d');
    for (let i = 0; i < 300; i++) {
        fixture.setOscValue(i % 2 ? 1 : -1);
        osc.render(ctx, 640, 320, fixture.getters, '#6c5eb5', 1 / 60);
    }
    assert.equal(osc.sparks.length, 64);
    assert.ok(osc.sparks.every(spark => Number.isFinite(spark.x) && Number.isFinite(spark.y)));

    osc.resize(390, 296);
    osc.render(ctx, 390, 296, fixture.getters, '#6c5eb5', 1 / 60);
    assert.equal(osc.width, 390);
    assert.equal(osc.height, 296);
    assert.equal(osc.offscreen.width, 195);
    assert.equal(osc.offscreen.height, 148);

    osc.clear();
    assert.equal(osc.hasLastValue, false);
    assert.ok(osc.sparks.every(spark => spark.life === 0));
    osc.render(ctx, 0, 0, fixture.getters, '#6c5eb5', 1 / 60);
    osc.resize(0, 0);
});
