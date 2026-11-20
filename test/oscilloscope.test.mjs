import test from 'node:test';
import assert from 'node:assert/strict';
import { Oscilloscope } from '../js/visuals/components/oscilloscope.js';

function createMockCanvas() {
    const calls = [];
    const ctx = {
        imageSmoothingEnabled: true,
        globalAlpha: 1,
        globalCompositeOperation: 'source-over',
        shadowBlur: 0,
        fillStyle: '#000000',
        strokeStyle: '#000000',
        lineWidth: 1,
        lineCap: 'butt',
        save() { calls.push(['save']); },
        restore() { calls.push(['restore']); },
        clearRect(x, y, w, h) { calls.push(['clearRect', x, y, w, h]); },
        fillRect(x, y, w, h) { calls.push(['fillRect', x, y, w, h]); },
        drawImage(img, ...args) { calls.push(['drawImage', img, ...args]); },
        beginPath() { calls.push(['beginPath']); },
        moveTo(x, y) { calls.push(['moveTo', x, y]); },
        lineTo(x, y) { calls.push(['lineTo', x, y]); },
        arc(x, y, r, s, e) { calls.push(['arc', x, y, r, s, e]); },
        fill() { calls.push(['fill']); },
        stroke() { calls.push(['stroke']); }
    };

    return {
        width: 0,
        height: 0,
        calls,
        getContext() {
            return ctx;
        }
    };
}

function createSineGetters(frequency = 220, amplitude = 0.5, sampleRate = 48000, fftSize = 2048, phaseOffset = 0.37) {
    const analyser = {
        fftSize,
        getFloatTimeDomainData(target) {
            for (let i = 0; i < target.length; i++) {
                target[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate + phaseOffset);
            }
        }
    };
    const audioCtx = { sampleRate };
    return {
        getTrackData: () => ({ length: 100 }),
        getIsPlaying: () => true,
        getAnalyserNode: () => analyser,
        getAudioContext: () => audioCtx
    };
}

function createSquareStepGetters(sampleRate = 48000, fftSize = 2048) {
    const analyser = {
        fftSize,
        getFloatTimeDomainData(target) {
            for (let i = 0; i < target.length; i++) {
                target[i] = (i % 64) < 32 ? -0.9 : 0.9;
            }
        }
    };
    const audioCtx = { sampleRate };
    return {
        getTrackData: () => ({ length: 100 }),
        getIsPlaying: () => true,
        getAnalyserNode: () => analyser,
        getAudioContext: () => audioCtx
    };
}

test('Oscilloscope initializes with exact backward-compatible defaults', () => {
    const osc = new Oscilloscope(320, 120, { createCanvas: createMockCanvas });
    assert.deepEqual(osc.getOptions(), {
        gain: 1.24,
        timeWindowMs: 32,
        persistence: 0.5,
        bloom: 0.52,
        graticule: 0.55,
        beamMode: 'sparks',
        triggerMode: 'auto',
        phosphorTint: 'system'
    });
});

test('Oscilloscope clamps numeric bounds and rejects invalid enums in setOptions', () => {
    const osc = new Oscilloscope(320, 120, { createCanvas: createMockCanvas });

    osc.setOptions({
        gain: 99,
        timeWindowMs: 2,
        persistence: -4,
        bloom: 3.5,
        graticule: NaN,
        beamMode: 'plasma-cannon',
        triggerMode: 'unknown',
        phosphorTint: 'ultraviolet'
    });

    assert.deepEqual(osc.getOptions(), {
        gain: 2.5,
        timeWindowMs: 8,
        persistence: 0,
        bloom: 1,
        graticule: 0.55,
        beamMode: 'sparks',
        triggerMode: 'auto',
        phosphorTint: 'system'
    });

    osc.setOptions({ gain: 1.8 });
    assert.equal(osc.getOptions().timeWindowMs, 8);
    assert.equal(osc.getOptions().gain, 1.8);
});

test('Oscilloscope updates timeWindowMs immediately and protects trigger headroom at high sample rates', () => {
    const outCanvas = createMockCanvas();
    const outCtx = outCanvas.getContext();
    const osc = new Oscilloscope(320, 120, { createCanvas: createMockCanvas });
    const getters = createSineGetters(220, 0.5, 48000, 2048);

    osc.render(outCtx, 320, 120, getters, '#55ff55', 0.016);
    assert.equal(osc.windowSampleCount, Math.round(48000 * 0.032));

    osc.setOptions({ timeWindowMs: 10 });
    assert.equal(osc.windowSampleCount, Math.round(48000 * 0.01));

    const highRateGetters = createSineGetters(220, 0.5, 192000, 2048);
    osc.setOptions({ timeWindowMs: 36 });
    osc.render(outCtx, 320, 120, highRateGetters, '#55ff55', 0.016);
    assert.ok(osc.windowSampleCount <= 2048 - 64);
});

test('Oscilloscope triggerMode toggles between auto correlation lock and free run', () => {
    const outCanvas = createMockCanvas();
    const outCtx = outCanvas.getContext();
    const osc = new Oscilloscope(320, 120, { createCanvas: createMockCanvas });
    const getters = createSineGetters(220, 0.6, 48000, 2048, 0.41);

    osc.render(outCtx, 320, 120, getters, '#55ff55', 0.016);
    assert.equal(osc.triggered, true);
    assert.ok(osc.triggerPosition > 0);

    osc.setOptions({ triggerMode: 'free' });
    osc.render(outCtx, 320, 120, getters, '#55ff55', 0.016);
    assert.equal(osc.triggered, false);
    assert.equal(osc.triggerPosition, 0);

    osc.setOptions({ triggerMode: 'auto' });
    assert.equal(osc.captureCount, 0);
    osc.render(outCtx, 320, 120, getters, '#55ff55', 0.016);
    assert.equal(osc.triggered, true);
});

test('Oscilloscope respects bloom, persistence, graticule, beamMode, and phosphorTint toggles', () => {
    const outCanvas = createMockCanvas();
    const outCtx = outCanvas.getContext();
    const osc = new Oscilloscope(320, 120, { createCanvas: createMockCanvas });
    const getters = createSquareStepGetters();

    // Mit Sparks-Modus mehrere Sweeps fahren, damit sicher Funken erzeugt werden
    for (let i = 0; i < 40; i++) {
        osc.render(outCtx, 320, 120, getters, '#ff8800', 0.016);
    }

    osc.setOptions({
        bloom: 0,
        persistence: 0,
        graticule: 0,
        beamMode: 'off',
        phosphorTint: 'p11'
    });
    assert.equal(osc.hasActiveSparks, false);
    assert.equal(osc.hasMemory, false);

    outCanvas.calls.length = 0;
    osc.render(outCtx, 320, 120, getters, '#ff8800', 0.016);

    assert.equal(osc.colorKey, '#4ce6ff');
    const drawImageTargets = outCanvas.calls
        .filter(([fn]) => fn === 'drawImage')
        .map(([, img]) => img);

    assert.equal(drawImageTargets.includes(osc.graticule), false);
    assert.equal(drawImageTargets.includes(osc.bloom), false);
    assert.equal(drawImageTargets.includes(osc.memory), false);
    assert.equal(drawImageTargets.includes(osc.offscreen), true);

    const arcCalls = outCanvas.calls.filter(([fn]) => fn === 'arc');
    assert.equal(arcCalls.length, 0);

    osc.setOptions({ phosphorTint: 'system' });
    osc.render(outCtx, 320, 120, getters, '#ff8800', 0.016);
    assert.equal(osc.colorKey, '#ff8800');
});

test('Oscilloscope handles zero dimensions, resizing, and gain scaling without errors', () => {
    const outCanvas = createMockCanvas();
    const outCtx = outCanvas.getContext();
    const osc = new Oscilloscope(0, 0, { createCanvas: createMockCanvas });
    const getters = createSineGetters(220, 0.25);

    osc.render(outCtx, 0, 0, getters, '#55ff55', 0.016);
    osc.resize(320, 120);
    osc.setOptions({ gain: 0.5 });
    osc.render(outCtx, 320, 120, getters, '#55ff55', 0.016);
    const lowSpan = Math.max(...osc.columnBottom.map((b, i) => b - osc.columnTop[i]));

    osc.setOptions({ gain: 2.5 });
    osc.render(outCtx, 320, 120, getters, '#55ff55', 0.016);
    const highSpan = Math.max(...osc.columnBottom.map((b, i) => b - osc.columnTop[i]));

    assert.ok(highSpan > lowSpan);
    assert.ok(Number.isFinite(osc.beamX) && Number.isFinite(osc.beamY));
    osc.clear();
});