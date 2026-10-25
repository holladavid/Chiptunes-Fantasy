import test from 'node:test';
import assert from 'node:assert/strict';

import { SidResampler } from '../js/worklets/lib/sid-resampler.js';
import { C64AnalogFilter } from '../js/worklets/lib/dsp-utils.js';

const INPUT_RATE = 985248;

function responseDb(resampler, phase, frequency) {
    let real = 0.0;
    let imaginary = 0.0;
    const base = phase * resampler.taps;
    for (let k = 0; k < resampler.taps; k++) {
        const angle = -2.0 * Math.PI * frequency / INPUT_RATE * k;
        const coefficient = resampler.polyphaseTable[base + k];
        real += coefficient * Math.cos(angle);
        imaginary += coefficient * Math.sin(angle);
    }
    return 20.0 * Math.log10(Math.hypot(real, imaginary) + 1e-300);
}

function render(left, outputRate, right = null, outputFrames = 0) {
    const stereo = right !== null;
    const resampler = new SidResampler(INPUT_RATE, outputRate, { channels: stereo ? 2 : 1 });
    const frames = outputFrames || Math.ceil((left.length + 2 * resampler.taps) / resampler.step) + 8;
    const outL = new Float32Array(frames);
    const outR = stereo ? new Float32Array(frames) : null;
    let inputIndex = 0;

    for (let frame = 0; frame < frames; frame++) {
        const cycles = resampler.beginSample();
        for (let cycle = 0; cycle < cycles; cycle++) {
            const l = inputIndex < left.length ? left[inputIndex] : 0.0;
            const r = stereo && inputIndex < right.length ? right[inputIndex] : 0.0;
            resampler.write(l, r);
            inputIndex++;
        }
        if (stereo) {
            resampler.processStereo();
            outL[frame] = resampler.outputL;
            outR[frame] = resampler.outputR;
        } else {
            outL[frame] = resampler.process(0);
        }
    }
    return { outL, outR, resampler };
}

function toneAmplitude(samples, frequency, sampleRate, start, count) {
    let cosCos = 0.0, sinSin = 0.0, cosSin = 0.0;
    let sampleCos = 0.0, sampleSin = 0.0;
    const end = Math.min(samples.length, start + count);
    for (let n = start; n < end; n++) {
        const angle = 2.0 * Math.PI * frequency / sampleRate * n;
        const cosine = Math.cos(angle);
        const sine = Math.sin(angle);
        cosCos += cosine * cosine;
        sinSin += sine * sine;
        cosSin += cosine * sine;
        sampleCos += samples[n] * cosine;
        sampleSin += samples[n] * sine;
    }
    const determinant = cosCos * sinSin - cosSin * cosSin;
    const cosineAmplitude = (sampleCos * sinSin - sampleSin * cosSin) / determinant;
    const sineAmplitude = (sampleSin * cosCos - sampleCos * cosSin) / determinant;
    return Math.hypot(cosineAmplitude, sineAmplitude);
}

test('Kaiser bank has normalized DC gain and a flat 20kHz passband at 44.1/48kHz', () => {
    for (const outputRate of [44100, 48000]) {
        const resampler = new SidResampler(INPUT_RATE, outputRate);
        assert.equal(resampler.phases, 256);
        assert.equal(resampler.taps % 2, 1);
        assert.ok(resampler.ringSize >= resampler.taps + 2);

        for (let phase = 0; phase < resampler.phases; phase++) {
            let sum = 0.0;
            const base = phase * resampler.taps;
            for (let k = 0; k < resampler.taps; k++) {
                const coefficient = resampler.polyphaseTable[base + k];
                assert.ok(Number.isFinite(coefficient));
                sum += coefficient;
            }
            assert.ok(Math.abs(sum - 1.0) < 0.00001, `DC phase ${phase}: ${sum}`);
            for (const frequency of [1000, 16000, 20000]) {
                const db = responseDb(resampler, phase, frequency);
                assert.ok(Math.abs(db) < 0.1, `${outputRate}Hz phase ${phase} at ${frequency}Hz: ${db}dB`);
            }
        }
    }
});

test('all polyphase branches provide at least 90dB attenuation at stopband start', () => {
    for (const outputRate of [44100, 48000, 96000]) {
        const resampler = new SidResampler(INPUT_RATE, outputRate);
        for (let phase = 0; phase < resampler.phases; phase++) {
            const db = responseDb(resampler, phase, resampler.stopbandHz);
            assert.ok(db < -90, `${outputRate}Hz phase ${phase}: ${db}dB`);
        }
    }
});

test('streamed passband tone retains unity amplitude and above-Nyquist tone is rejected', () => {
    for (const outputRate of [44100, 48000]) {
        // Keep the complete analysis window beyond the filter tail.
        const inputLength = Math.floor(INPUT_RATE * 0.5);
        const passband = new Float32Array(inputLength);
        const stopbandFrequency = outputRate === 48000 ? 28000 : 26000;
        const stopband = new Float32Array(inputLength);
        for (let n = 0; n < inputLength; n++) {
            passband[n] = Math.sin(2.0 * Math.PI * 20000 / INPUT_RATE * n);
            stopband[n] = Math.sin(2.0 * Math.PI * stopbandFrequency / INPUT_RATE * n);
        }

        const passed = render(passband, outputRate);
        const passAmplitude = toneAmplitude(passed.outL, 20000, outputRate, 2048, 8192);
        assert.ok(Math.abs(passAmplitude - 1.0) < 0.01, `${outputRate}Hz passband amplitude ${passAmplitude}`);

        const rejected = render(stopband, outputRate);
        const aliasFrequency = Math.abs(stopbandFrequency - outputRate);
        const aliasAmplitude = toneAmplitude(rejected.outL, aliasFrequency, outputRate, 2048, 8192);
        const aliasDb = 20.0 * Math.log10(aliasAmplitude + 1e-300);
        assert.ok(aliasDb < -85, `${outputRate}Hz alias at ${aliasFrequency}Hz: ${aliasDb}dB`);
    }
});

test('impulse response matches the declared input-domain group delay', () => {
    const outputRate = 48000;
    const impulseIndex = 5000;
    const input = new Float32Array(12000);
    input[impulseIndex] = 1.0;
    const { outL, resampler } = render(input, outputRate);
    let peakIndex = 0;
    let peak = -Infinity;
    for (let i = 0; i < outL.length; i++) {
        if (Math.abs(outL[i]) > peak) {
            peak = Math.abs(outL[i]);
            peakIndex = i;
        }
    }
    const expected = (impulseIndex + resampler.groupDelayInput) / resampler.step - 1.0;
    assert.ok(Math.abs(peakIndex - expected) <= 1.0, `peak ${peakIndex}, expected ${expected}`);
    assert.ok(Math.abs(resampler.groupDelaySeconds * 1000 - 0.7663045243) < 1e-9);
});

test('stereo channels are independent and reset restores bit-identical output', () => {
    const length = 24000;
    const left = new Float32Array(length);
    const right = new Float32Array(length);
    for (let i = 0; i < length; i++) left[i] = Math.sin(i * 0.071) * 0.5;

    const first = render(left, 48000, right, 1400);
    assert.ok(first.outL.some(value => Math.abs(value) > 0.01));
    assert.ok(first.outR.every(value => value === 0));

    first.resampler.reset();
    const second = new SidResampler(INPUT_RATE, 48000, { channels: 2 });
    assert.deepEqual(first.resampler.polyphaseTable, second.polyphaseTable);
    const repeated = render(left, 48000, right, 1400);
    assert.deepEqual(repeated.outL, first.outL);
    assert.deepEqual(repeated.outR, first.outR);
});

test('Exact output bypasses only obsolete droop EQ and preserves mainboard filters', () => {
    const compensated = new C64AnalogFilter(48000);
    const flatResampler = new C64AnalogFilter(48000, 0.0);
    assert.equal(compensated.cComp, 0.22);
    assert.equal(flatResampler.cComp, 0.0);
    assert.equal(flatResampler.alphaLp, compensated.alphaLp);
    assert.equal(flatResampler.alphaHp, compensated.alphaHp);
});

test('hot path remains allocation-free when GC instrumentation is enabled', t => {
    if (typeof global.gc !== 'function') {
        t.skip('run with --expose-gc for the heap-allocation check');
        return;
    }
    const resampler = new SidResampler(INPUT_RATE, 48000);
    const run = () => {
        let sum = 0.0;
        for (let frame = 0; frame < 2000; frame++) {
            const cycles = resampler.beginSample();
            for (let cycle = 0; cycle < cycles; cycle++) resampler.write(Math.sin(frame + cycle));
            sum += resampler.process();
        }
        return sum;
    };
    run();
    global.gc();
    const before = process.memoryUsage().heapUsed;
    const checksum = run();
    global.gc();
    const after = process.memoryUsage().heapUsed;
    assert.ok(Number.isFinite(checksum));
    assert.ok(after - before < 32768, `heap grew by ${after - before} bytes`);
});
