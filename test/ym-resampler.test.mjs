import test from 'node:test';
import assert from 'node:assert/strict';

import { PolyphaseResampler } from '../js/worklets/lib/polyphase-resampler.js';
import { AtariAnalogFilter } from '../js/worklets/lib/dsp-utils.js';

const INPUT_RATE = 2000000;
const RATES = [44100, 48000, 96000];

function createResampler(outputRate) {
    return new PolyphaseResampler(INPUT_RATE, outputRate, {
        attenuation: 96,
        passbandHz: 20000,
        maximumStopbandHz: outputRate * 0.5
    });
}

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

function render(input, outputRate) {
    const resampler = createResampler(outputRate);
    const frames = Math.ceil((input.length + 2 * resampler.taps) / resampler.step) + 8;
    const output = new Float32Array(frames);
    let inputIndex = 0;
    for (let frame = 0; frame < frames; frame++) {
        const cycles = resampler.beginSample();
        for (let cycle = 0; cycle < cycles; cycle++) {
            resampler.write(inputIndex < input.length ? input[inputIndex] : 0.0);
            inputIndex++;
        }
        output[frame] = resampler.process();
    }
    return { output, resampler };
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

test('every YM polyphase has unity DC gain and a flat measured passband', () => {
    const expectedTaps = new Map([[44100, 5561], [48000, 3067], [96000, 439]]);
    for (const outputRate of RATES) {
        const resampler = createResampler(outputRate);
        assert.equal(resampler.phases, 256);
        assert.equal(resampler.taps, expectedTaps.get(outputRate));
        assert.equal(resampler.stopbandHz, outputRate * 0.5);
        for (let phase = 0; phase < resampler.phases; phase++) {
            let sum = 0.0;
            let peak = 0.0;
            let peakIndex = 0;
            const base = phase * resampler.taps;
            for (let k = 0; k < resampler.taps; k++) {
                const coefficient = resampler.polyphaseTable[base + k];
                assert.ok(Number.isFinite(coefficient));
                sum += coefficient;
                if (Math.abs(coefficient) > peak) {
                    peak = Math.abs(coefficient);
                    peakIndex = k;
                }
            }
            assert.ok(Math.abs(sum - 1.0) < 0.00001, `DC ${outputRate}Hz phase ${phase}: ${sum}`);
            const expectedPeak = resampler.groupDelayInput - (1 + phase / resampler.phases);
            assert.ok(Math.abs(peakIndex - expectedPeak) <= 1.0, `impulse ${outputRate}Hz phase ${phase}: ${peakIndex}`);
            for (const frequency of [1000, 10000, 16000, 20000]) {
                const db = responseDb(resampler, phase, frequency);
                assert.ok(Math.abs(db) < 0.1, `${outputRate}Hz phase ${phase} at ${frequency}Hz: ${db}dB`);
            }
        }
    }
});

test('every YM polyphase reaches the 96dB stopband design target', () => {
    for (const outputRate of RATES) {
        const resampler = createResampler(outputRate);
        for (let phase = 0; phase < resampler.phases; phase++) {
            const db = responseDb(resampler, phase, resampler.stopbandHz);
            assert.ok(db < -95.9, `${outputRate}Hz phase ${phase}: ${db}dB`);
        }
    }
});

test('streamed YM passband tones remain unity and above-Nyquist tones are rejected', () => {
    const input = new Float32Array(400000);
    for (const outputRate of RATES) {
        for (let n = 0; n < input.length; n++) input[n] = Math.sin(2.0 * Math.PI * 20000 / INPUT_RATE * n);
        const passed = render(input, outputRate);
        const passAmplitude = toneAmplitude(passed.output, 20000, outputRate, 2048, 4096);
        assert.ok(Math.abs(passAmplitude - 1.0) < 0.01, `${outputRate}Hz passband amplitude ${passAmplitude}`);

        const stopbandFrequency = outputRate + 4000;
        for (let n = 0; n < input.length; n++) input[n] = Math.sin(2.0 * Math.PI * stopbandFrequency / INPUT_RATE * n);
        const rejected = render(input, outputRate);
        const aliasAmplitude = toneAmplitude(rejected.output, 4000, outputRate, 2048, 4096);
        const aliasDb = 20.0 * Math.log10(aliasAmplitude + 1e-300);
        assert.ok(aliasDb < -85, `${outputRate}Hz alias: ${aliasDb}dB`);
    }
});

test('YM impulse responses match their declared constant group delays', () => {
    const expectedDelayMs = new Map([[44100, 1.39], [48000, 0.7665], [96000, 0.1095]]);
    for (const outputRate of RATES) {
        const impulseIndex = 5000;
        const input = new Float32Array(16000);
        input[impulseIndex] = 1.0;
        const { output, resampler } = render(input, outputRate);
        let peakIndex = 0;
        let peak = -Infinity;
        for (let i = 0; i < output.length; i++) {
            if (Math.abs(output[i]) > peak) {
                peak = Math.abs(output[i]);
                peakIndex = i;
            }
        }
        const expected = (impulseIndex + resampler.groupDelayInput) / resampler.step - 1.0;
        assert.ok(Math.abs(peakIndex - expected) <= 1.0, `${outputRate}Hz peak ${peakIndex}, expected ${expected}`);
        assert.ok(Math.abs(resampler.groupDelaySeconds * 1000 - expectedDelayMs.get(outputRate)) < 1e-12);
    }
});

test('Atari analog stage is linear, resettable and matches its declared corner regions', () => {
    const small = new AtariAnalogFilter(48000);
    const large = new AtariAnalogFilter(48000);
    const smallOutput = small.process(0.75);
    const largeOutput = large.process(1.5);
    assert.ok(Math.abs(largeOutput - 2 * smallOutput) < 1e-12);
    small.process(0.25);
    small.reset();
    assert.deepEqual(new AtariAnalogFilter(48000), small);

    for (const outputRate of RATES) {
        for (const frequency of [25, 15900]) {
            const filter = new AtariAnalogFilter(outputRate);
            const samples = new Float32Array(outputRate * 3);
            for (let n = 0; n < samples.length; n++) {
                samples[n] = filter.process(Math.sin(2.0 * Math.PI * frequency / outputRate * n));
            }
            const amplitude = toneAmplitude(samples, frequency, outputRate, outputRate, outputRate * 2);
            const db = 20.0 * Math.log10(amplitude);
            assert.ok(Math.abs(db + 3.0) < 0.05, `${outputRate}Hz rate, ${frequency}Hz response: ${db}dB`);
        }
    }
});
