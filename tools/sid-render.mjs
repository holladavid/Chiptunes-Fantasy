// Offline SID register-event renderer and regression baseline tool.
//   node tools/sid-render.mjs --case pulse-adsr --out artifacts/sid --trace --raw
//   node tools/sid-render.mjs --case all --update-baseline
//   node tools/sid-render.mjs --case all --check

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeSidWav, renderSidOffline, sidTraceToCsv } from '../js/worklets/lib/sid-offline.js';
import { SID_SYNTHETIC_CORPUS } from '../test/helpers/sid-corpus.mjs';

const args = new Map();
for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (!arg.startsWith('--')) throw new Error(`Unexpected argument: ${arg}`);
    const key = arg.slice(2);
    if (['trace', 'raw', 'check', 'update-baseline'].includes(key)) args.set(key, true);
    else args.set(key, process.argv[++i]);
}

const selected = args.get('case') || 'pulse-adsr';
const stride = Number(args.get('stride') || 64);
const cases = selected === 'all'
    ? SID_SYNTHETIC_CORPUS
    : SID_SYNTHETIC_CORPUS.filter(testCase => testCase.name === selected);
if (cases.length === 0) throw new Error(`Unknown SID corpus case: ${selected}`);

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = join(root, 'test/fixtures/sid-baseline.json');
const outputDirectory = args.has('out') ? resolve(args.get('out')) : null;
if (outputDirectory) mkdirSync(outputDirectory, { recursive: true });

function updateHash(hash, array) {
    hash.update(Buffer.from(array.buffer, array.byteOffset, array.byteLength));
}

function hashTrace(trace) {
    const hash = createHash('sha256');
    for (const key of [
        'cycle', 'output', 'filterLow', 'filterBand', 'activeCutoff', 'registers',
        'phase', 'waveform', 'envelope', 'envelopeState', 'rateCounter',
        'exponentialCounter', 'lfsr'
    ]) updateHash(hash, trace[key]);
    return hash.digest('hex');
}

function hashBytes(bytes) {
    return createHash('sha256').update(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)).digest('hex');
}

const results = [];
for (const testCase of cases) {
    const harness = renderSidOffline({
        cycles: testCase.cycles,
        events: testCase.events,
        traceStride: stride,
        vcfOffset: 0,
        temperature: 55
    });
    const wav = encodeSidWav(harness.raw, harness.clock);
    const result = {
        cycles: testCase.cycles,
        traceStride: stride,
        clock: harness.clock,
        vcfOffset: 0,
        temperature: 55,
        rawSha256: hashBytes(harness.raw),
        traceSha256: hashTrace(harness.trace),
        wavSha256: hashBytes(wav)
    };
    results.push({ name: testCase.name, ...result });

    if (outputDirectory) {
        writeFileSync(join(outputDirectory, `${testCase.name}.wav`), wav);
        if (args.has('raw')) writeFileSync(join(outputDirectory, `${testCase.name}.raw.f32`), harness.raw);
        if (args.has('trace')) writeFileSync(join(outputDirectory, `${testCase.name}.trace.csv`), sidTraceToCsv(harness));
        writeFileSync(join(outputDirectory, `${testCase.name}.json`), JSON.stringify({
            format: 'chiptunes-fantasy-sid-phase3-v1',
            eventSemantics: 'write at cycle start, then one SID clock',
            signalTap: 'raw SID output before resampling, motherboard and master DSP',
            sampleFormat: 'mono IEEE-float32 WAV at native SID clock',
            name: testCase.name,
            ...result
        }, null, 2) + '\n');
    }
    console.log(`${testCase.name}: raw=${result.rawSha256} trace=${result.traceSha256}`);
}

if (args.has('update-baseline')) {
    const baseline = {
        format: 'chiptunes-fantasy-sid-phase3-v1',
        purpose: 'self-generated regression pin; not a hardware accuracy reference',
        eventSemantics: 'write at cycle start, then one SID clock',
        signalTap: 'raw SID output before resampling, motherboard and master DSP',
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
    else console.log(`SID baseline OK: ${results.length} case(s)`);
}
