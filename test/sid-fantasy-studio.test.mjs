import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { DCBlocker } from '../js/worklets/lib/dsp-utils.js';

function measureResponse(sampleRate, frequency) {
    const filter = new DCBlocker(sampleRate, 16.0);
    const settle = sampleRate * 4;
    const measure = sampleRate * 2;
    const step = 2 * Math.PI * frequency / sampleRate;
    let cosine = 0;
    let sine = 0;
    for (let i = 0; i < settle + measure; i++) {
        const output = filter.process(Math.sin(step * i));
        if (i >= settle) {
            const angle = step * (i - settle);
            cosine += output * Math.cos(angle);
            sine += output * Math.sin(angle);
        }
    }
    return 2 * Math.hypot(cosine, sine) / measure;
}

for (const sampleRate of [44100, 48000]) {
    test(`Fantasy output coupling has a 16 Hz corner at ${sampleRate} Hz`, () => {
        const atCorner = 20 * Math.log10(measureResponse(sampleRate, 16));
        const atExciter = 20 * Math.log10(measureResponse(sampleRate, 48));
        assert.ok(Math.abs(atCorner + 3.0) < 0.02, `16 Hz: ${atCorner} dB`);
        assert.ok(atExciter > -0.46 && atExciter < -0.44,
            `48 Hz response: ${atExciter} dB`);
    });
}

test('Legacy DCBlocker callers retain their exact historical coefficient', () => {
    const filter = new DCBlocker();
    assert.equal(filter.coefficient, 0.995);
    assert.equal(filter.process(1), 1);
    assert.ok(Math.abs(filter.process(0) + 0.005) < 1e-15);
});

const processors = new Map();
globalThis.sampleRate = 48000;
globalThis.AudioWorkletProcessor = class {
    constructor() {
        this.port = { onmessage: null, postMessage() {} };
    }
};
globalThis.registerProcessor = (name, processor) => processors.set(name, processor);
await import('../js/worklets/c64/sid-fantasy.js');

test('Fantasy worklet binds both output channels to the measured 16 Hz coupling', () => {
    const Processor = processors.get('sid-fantasy-processor');
    const processor = new Processor();
    const expected = Math.exp(-2 * Math.PI * 16 / 48000);
    assert.equal(processor.dcBlockL.coefficient, expected);
    assert.equal(processor.dcBlockR.coefficient, expected);
    assert.ok(Math.abs(processor.sid.panL0 ** 2 + processor.sid.panR0 ** 2 - 1) < 0.01);
    assert.ok(Math.abs(processor.sid.panL1 ** 2 + processor.sid.panR1 ** 2 - 1) < 0.01);
});

test('Phase 5 archive separates unchanged Exact output from finite Fantasy tuning evidence', () => {
    const fixture = JSON.parse(readFileSync(
        new URL('./fixtures/sid-phase5-studio-reference.json', import.meta.url), 'utf8'));
    for (const tune of Object.values(fixture.cases)) {
        assert.equal(tune.exact.byteIdenticalBeforeAfter, true);
        assert.equal(tune.exact.beforeWavSha256, tune.exact.afterWavSha256);
        assert.equal(tune.fantasy.before.nonFinite, 0);
        assert.equal(tune.fantasy.after.nonFinite, 0);
        assert.ok(tune.fantasy.after.peak < 1.0);
        assert.ok(tune.fantasy.tuning.bandPowerChange['40-56Hz'].changeDb > 1.0);
    }
});
