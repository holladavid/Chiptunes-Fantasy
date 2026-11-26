#!/usr/bin/env node
// Regenerates the "cases" of tests/fixtures/sid-baseline.json after deliberate emulation changes.
//   node tools/rebaseline-sid.mjs           dry run: lists which corpus cases change (raw / trace / wav)
//   node tools/rebaseline-sid.mjs --write   writes the new hashes (other JSON fields are preserved)
// Hashing and rendering mirror tests/<offline test> exactly (traceStride 64, vcfOffset 0, 55 degC).
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { encodeSidWav, renderSidOffline } from '../js/worklets/lib/sid-offline.js';
import { SID_SYNTHETIC_CORPUS } from '../tests/helpers/sid-corpus.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = join(root, 'tests/fixtures/sid-baseline.json');
const write = process.argv.includes('--write');

function bytes(array) {
    return Buffer.from(array.buffer, array.byteOffset, array.byteLength);
}

function sha256(array) {
    return createHash('sha256').update(bytes(array)).digest('hex');
}

function hashTrace(trace) {
    const hash = createHash('sha256');
    for (const key of [
        'cycle', 'output', 'filterLow', 'filterBand', 'activeCutoff', 'registers',
        'phase', 'waveform', 'envelope', 'envelopeState', 'rateCounter',
        'exponentialCounter', 'lfsr'
    ]) hash.update(bytes(trace[key]));
    return hash.digest('hex');
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
baseline.cases ??= {};

const summary = { unchanged: [], changed: [], added: [] };
for (const testCase of SID_SYNTHETIC_CORPUS) {
    const harness = renderSidOffline({
        cycles: testCase.cycles,
        events: testCase.events,
        traceStride: 64,
        vcfOffset: 0,
        temperature: 55
    });
    const next = {
        rawSha256: sha256(harness.raw),
        traceSha256: hashTrace(harness.trace),
        wavSha256: sha256(encodeSidWav(harness.raw, harness.clock))
    };
    const previous = baseline.cases[testCase.name];
    if (!previous) {
        summary.added.push(testCase.name);
    } else {
        const diff = ['raw', 'trace', 'wav'].filter(kind => previous[`${kind}Sha256`] !== next[`${kind}Sha256`]);
        if (diff.length) summary.changed.push(`${testCase.name}  (${diff.join('+')})`);
        else summary.unchanged.push(testCase.name);
    }
    if (write) baseline.cases[testCase.name] = Object.assign(previous ?? {}, next);
}

const names = new Set(SID_SYNTHETIC_CORPUS.map(testCase => testCase.name));
const orphans = Object.keys(baseline.cases).filter(name => !names.has(name));

console.log(`unchanged: ${summary.unchanged.length}   changed: ${summary.changed.length}   new: ${summary.added.length}`);
for (const line of summary.changed) console.log('  changed  ' + line);
for (const name of summary.added) console.log('  new      ' + name);
for (const name of orphans) console.log('  orphaned (in baseline, not in corpus): ' + name);

if (write) {
    writeFileSync(baselinePath, JSON.stringify(baseline, null, 2) + '\n');
    console.log(`\nwritten: ${baselinePath}`);
} else {
    console.log('\ndry run - add --write to store the new hashes');
}
