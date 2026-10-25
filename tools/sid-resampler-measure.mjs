// Reproducible Phase 1 measurements; no emulator or reference code required.
//   node tools/sid-resampler-measure.mjs [--out artifacts/sid-resampler-report.json]

import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { SidResampler } from '../js/worklets/lib/sid-resampler.js';

const INPUT_RATE = 985248;
const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].slice(2), process.argv[i + 1]);

function responseDb(resampler, phase, frequency) {
    let real = 0.0, imaginary = 0.0;
    const base = phase * resampler.taps;
    for (let k = 0; k < resampler.taps; k++) {
        const angle = -2.0 * Math.PI * frequency / INPUT_RATE * k;
        const coefficient = resampler.polyphaseTable[base + k];
        real += coefficient * Math.cos(angle);
        imaginary += coefficient * Math.sin(angle);
    }
    return 20.0 * Math.log10(Math.hypot(real, imaginary) + 1e-300);
}

function worstResponse(resampler, frequency, wantMaximum) {
    let value = wantMaximum ? -Infinity : Infinity;
    for (let phase = 0; phase < resampler.phases; phase++) {
        const db = responseDb(resampler, phase, frequency);
        value = wantMaximum ? Math.max(value, db) : Math.min(value, db);
    }
    return value;
}

function legacyResponseDb(frequency) {
    const taps = 255, half = 127, cutoff = 20000.0 / INPUT_RATE;
    let real = 0.0, imaginary = 0.0, sum = 0.0;
    const coefficients = new Float64Array(taps);
    for (let i = 0; i < taps; i++) {
        const x = i - half;
        const sinc = Math.abs(x) < 1e-7 ? 2 * Math.PI * cutoff : Math.sin(2 * Math.PI * cutoff * x) / x;
        const position = i / (taps - 1);
        const window = 0.42 - 0.5 * Math.cos(2 * Math.PI * position) + 0.08 * Math.cos(4 * Math.PI * position);
        coefficients[i] = sinc * window;
        sum += coefficients[i];
    }
    for (let i = 0; i < taps; i++) {
        const coefficient = coefficients[i] / sum;
        const angle = -2 * Math.PI * frequency / INPUT_RATE * i;
        real += coefficient * Math.cos(angle);
        imaginary += coefficient * Math.sin(angle);
    }
    return 20 * Math.log10(Math.hypot(real, imaginary) + 1e-300);
}

function benchmark(outputRate, channels) {
    const resampler = new SidResampler(INPUT_RATE, outputRate, { channels });
    const frames = outputRate / 2;
    const run = () => {
        let checksum = 0.0;
        for (let frame = 0; frame < frames; frame++) {
            const cycles = resampler.beginSample();
            for (let cycle = 0; cycle < cycles; cycle++) resampler.write(0.25, -0.125);
            if (channels === 2) {
                resampler.processStereo();
                checksum += resampler.outputL + resampler.outputR;
            } else {
                checksum += resampler.process(0);
            }
        }
        return checksum;
    };
    run();
    const start = performance.now();
    const checksum = run();
    const elapsedSeconds = (performance.now() - start) / 1000;
    if (!Number.isFinite(checksum)) throw new Error('non-finite benchmark result');
    return { channels, frames, elapsedSeconds, realtimeFactor: 0.5 / elapsedSeconds };
}

const report = {
    format: 'chiptunes-fantasy-sid-phase1-v1',
    design: 'causal linear-phase Kaiser sinc, 256 phases with coefficient interpolation',
    inputRate: INPUT_RATE,
    passbandHz: 20000,
    designAttenuationDb: 96,
    legacyPhase0ResponseDb: Object.fromEntries(
        [16000, 18000, 20000, 22050, 24000].map(f => [f, legacyResponseDb(f)])
    ),
    rates: {},
    benchmark48kHz: [benchmark(48000, 1), benchmark(48000, 2)]
};

for (const outputRate of [44100, 48000, 96000]) {
    const resampler = new SidResampler(INPUT_RATE, outputRate);
    report.rates[outputRate] = {
        taps: resampler.taps,
        phases: resampler.phases,
        groupDelayMs: resampler.groupDelaySeconds * 1000,
        passbandHz: resampler.passbandHz,
        stopbandHz: resampler.stopbandHz,
        response20kHzWorstDb: worstResponse(resampler, 20000, true),
        stopbandStartWorstDb: worstResponse(resampler, resampler.stopbandHz, false)
    };
}

const text = JSON.stringify(report, null, 2) + '\n';
if (args.has('out')) writeFileSync(args.get('out'), text);
console.log(text);
