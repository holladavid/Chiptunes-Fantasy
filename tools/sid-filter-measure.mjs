// Measure the production R3 analog entry point against archived external
// black-box EXT IN responses. No reSIDfp code runs in this repository tool.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { SIDChip } from '../js/worklets/lib/sid-chip.js';

const reference = JSON.parse(readFileSync(
    new URL('../test/fixtures/sid-r3-filter-reference.json', import.meta.url), 'utf8'
));
const SR = 985248;
const INPUT_AMPLITUDE = 8192 / 32768;
const SETTLE = reference.method.settleCycles;
const MEASURE = reference.method.measureCycles;
const modeBits = { LP: 16, BP: 32, HP: 64 };

function measure(fc, resonance, mode, frequency) {
    const chip = new SIDChip(0);
    chip.writeReg(21, fc & 7);
    chip.writeReg(22, fc >> 3);
    chip.writeReg(23, (resonance << 4) | 8);
    chip.writeReg(24, modeBits[mode] | 15);

    const output = new Float32Array(MEASURE);
    const step = 2 * Math.PI * frequency / SR;
    let phase = 0;
    for (let cycle = 0; cycle < SETTLE + MEASURE; cycle += 8) {
        phase += step * 8;
        if (phase >= 2 * Math.PI) phase %= 2 * Math.PI;
        const input = Math.sin(phase) * INPUT_AMPLITUDE;
        for (let block = 0; block < 8; block++) {
            const sample = chip.processFilterMixer(input, 0);
            if (cycle >= SETTLE) output[cycle + block - SETTLE] = sample;
        }
    }

    let mean = 0;
    for (let i = 0; i < MEASURE; i++) mean += output[i];
    mean /= MEASURE;
    let cosine = 0;
    let sine = 0;
    for (let i = 0; i < MEASURE; i++) {
        const angle = step * i;
        const sample = output[i] - mean;
        cosine += sample * Math.cos(angle);
        sine += sample * Math.sin(angle);
    }
    return 2 * Math.hypot(cosine, sine) / MEASURE / INPUT_AMPLITUDE;
}

const rows = [];
for (const high of [false, true]) {
    const cases = high ? reference.highFrequencyCases : reference.cases;
    const frequencies = high ? reference.highFrequencies : reference.frequencies;
    for (const testCase of cases) {
        for (let i = 0; i < frequencies.length; i++) {
            const modelGain = measure(testCase.fc, testCase.res, testCase.mode, frequencies[i]);
            rows.push({
                fc: testCase.fc,
                resonance: testCase.res,
                mode: testCase.mode,
                frequency: frequencies[i],
                modelGain,
                // The reference API includes its external output filter; our raw
                // chip tap deliberately does not. Compensate its documented
                // approximately 16 kHz low-pass for comparison only.
                referenceGain: testCase.gains[i] / 8192 *
                    Math.sqrt(1 + (frequencies[i] / 16000) ** 2)
            });
        }
    }
}

// Absolute output scaling differs between the APIs. Estimate one global scalar,
// then expose all remaining response/mixer errors in dB.
const ratios = rows.filter(row => row.modelGain > 1e-5 && row.referenceGain > 0.002)
    .map(row => row.referenceGain / row.modelGain).sort((a, b) => a - b);
const referenceScale = ratios[Math.floor(ratios.length / 2)];
const errors = [];
for (const row of rows) {
    row.scaledModelGain = row.modelGain * referenceScale;
    row.errorDb = 20 * Math.log10(Math.max(row.scaledModelGain, 1e-9) /
        Math.max(row.referenceGain, 1e-9));
    if (row.referenceGain > 0.002) errors.push(Math.abs(row.errorDb));
}
errors.sort((a, b) => a - b);
const summary = {
    referenceRevision: reference.source.revision,
    measuredResponses: rows.length,
    referenceScale,
    medianAbsoluteErrorDb: errors[Math.floor(errors.length * 0.5)],
    p95AbsoluteErrorDb: errors[Math.floor(errors.length * 0.95)],
    rmsErrorDb: Math.sqrt(errors.reduce((sum, error) => sum + error * error, 0) / errors.length)
};
const report = { summary, rows };
const outIndex = process.argv.indexOf('--out');
if (outIndex >= 0) {
    const path = process.argv[outIndex + 1];
    if (!path) throw new Error('--out requires a JSON path');
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify(summary, null, 2));
if (process.argv.includes('--check')) {
    if (summary.medianAbsoluteErrorDb > 2.5 || summary.p95AbsoluteErrorDb > 8) {
        throw new Error('R3 filter response exceeds the reviewed calibration tolerance');
    }
    console.log('SID R3 filter calibration OK');
}
