// node tools/ym-render.mjs --case tone-a --out artifacts/ym --trace --raw
// node tools/ym-render.mjs --case all --check
// node tools/ym-render.mjs --case all --update-baseline

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeYMWav, renderYMOffline, ymTraceToCsv } from '../js/worklets/lib/ym-offline.js';
import { YM_SYNTHETIC_CORPUS } from '../test/helpers/ym-corpus.mjs';

const args = new Map();
for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (!arg.startsWith('--')) throw new Error(`Unexpected argument: ${arg}`);
    const key = arg.slice(2);
    if (['trace', 'raw', 'check', 'update-baseline'].includes(key)) args.set(key, true);
    else args.set(key, process.argv[++i]);
}

const selected = args.get('case') || 'tone-a';
const stride = Number(args.get('stride') || 64);
const cases = selected === 'all'
    ? YM_SYNTHETIC_CORPUS
    : YM_SYNTHETIC_CORPUS.filter(testCase => testCase.name === selected);
if (cases.length === 0) throw new Error(`Unknown YM corpus case: ${selected}`);

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = join(root, 'test/fixtures/ym-baseline.json');
const outputDirectory = args.has('out') ? resolve(args.get('out')) : null;
if (outputDirectory) mkdirSync(outputDirectory, { recursive: true });

function updateHash(hash, array) {
    hash.update(Buffer.from(array.buffer, array.byteOffset, array.byteLength));
}

function hashBytes(bytes) {
    return createHash('sha256').update(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)).digest('hex');
}

function hashTrace(trace) {
    const hash = createHash('sha256');
    for (const key of [
        'cycle', 'output', 'registers', 'toneDivider', 'toneOutput', 'noiseDivider',
        'noiseLfsr', 'noiseOutput', 'envelopeDivider', 'envelopePosition',
        'envelopeShape', 'envelopeLevel', 'volume'
    ]) updateHash(hash, trace[key]);
    return hash.digest('hex');
}

const results = [];
for (const testCase of cases) {
    const harness = renderYMOffline({
        cycles: testCase.cycles,
        events: testCase.events,
        traceStride: stride
    });
    const wav = encodeYMWav(harness.raw, harness.clock);
    const result = {
        cycles: testCase.cycles,
        traceStride: stride,
        clock: harness.clock,
        rawSha256: hashBytes(harness.raw),
        traceSha256: hashTrace(harness.trace),
        wavSha256: hashBytes(wav)
    };
    results.push({ name: testCase.name, ...result });

    if (outputDirectory) {
        writeFileSync(join(outputDirectory, `${testCase.name}.wav`), wav);
        if (args.has('raw')) writeFileSync(join(outputDirectory, `${testCase.name}.raw.f32`), harness.raw);
        if (args.has('trace')) writeFileSync(join(outputDirectory, `${testCase.name}.trace.csv`), ymTraceToCsv(harness));
        writeFileSync(join(outputDirectory, `${testCase.name}.json`), JSON.stringify({
            format: 'chiptunes-fantasy-ym-phase4-v1',
            eventSemantics: 'write at cycle start, then one YM2149 clock',
            signalTap: 'raw digital core and current summing model before FIR, analog output and master DSP; no YM6 effects',
            sampleFormat: 'mono IEEE-float32 WAV at native YM clock',
            name: testCase.name,
            ...result
        }, null, 2) + '\n');
    }
    console.log(`${testCase.name}: raw=${result.rawSha256} trace=${result.traceSha256}`);
}

if (args.has('update-baseline')) {
    const baseline = {
        format: 'chiptunes-fantasy-ym-phase4-v1',
        purpose: 'self-generated regression pin; not a hardware accuracy reference',
        eventSemantics: 'write at cycle start, then one YM2149 clock',
        signalTap: 'raw digital core and current summing model before FIR, analog output and master DSP; no YM6 effects',
        cases: Object.fromEntries(results.map(({ name, ...result }) => [name, result]))
    };
    mkdirSync(dirname(baselinePath), { recursive: true });
    writeFileSync(baselinePath, JSON.stringify(baseline, null, 2) + '\n');
    console.log(`Updated ${baselinePath}`);
}

if (args.has('check')) {
    const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
    let failed = false;
    for (const result of results) {
        const expected = baseline.cases[result.name];
        for (const key of ['rawSha256', 'traceSha256', 'wavSha256']) {
            if (!expected || expected[key] !== result[key]) {
                console.error(`FAIL ${result.name} ${key}: expected ${expected?.[key]}, got ${result[key]}`);
                failed = true;
            }
        }
    }
    if (failed) process.exitCode = 1;
    else console.log(`YM baseline OK: ${results.length} case(s)`);
}
