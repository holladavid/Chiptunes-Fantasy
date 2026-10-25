import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import {
    encodeSidWav,
    renderSidOffline,
    SidOfflineHarness,
    sidTraceToCsv
} from '../js/worklets/lib/sid-offline.js';
import { SIDChip } from '../js/worklets/lib/sid-chip.js';
import { SID_SYNTHETIC_CORPUS } from './helpers/sid-corpus.mjs';

const baseline = JSON.parse(readFileSync(new URL('./fixtures/sid-baseline.json', import.meta.url), 'utf8'));

function updateHash(hash, array) {
    hash.update(Buffer.from(array.buffer, array.byteOffset, array.byteLength));
}

function sha256(array) {
    return createHash('sha256')
        .update(Buffer.from(array.buffer, array.byteOffset, array.byteLength))
        .digest('hex');
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

function render(testCase) {
    return renderSidOffline({
        cycles: testCase.cycles,
        events: testCase.events,
        traceStride: 64,
        vcfOffset: 0,
        temperature: 55
    });
}

test('SID synthetic corpus matches the reviewed Phase 3 raw/trace/WAV hashes', () => {
    for (const testCase of SID_SYNTHETIC_CORPUS) {
        const harness = render(testCase);
        const expected = baseline.cases[testCase.name];
        assert.ok(expected, `missing baseline for ${testCase.name}`);
        assert.equal(sha256(harness.raw), expected.rawSha256, `${testCase.name}: raw output`);
        assert.equal(hashTrace(harness.trace), expected.traceSha256, `${testCase.name}: state trace`);
        assert.equal(sha256(encodeSidWav(harness.raw, harness.clock)), expected.wavSha256, `${testCase.name}: WAV`);
    }
});

test('two offline runs are bit-identical and independent of playback randomness', () => {
    const testCase = SID_SYNTHETIC_CORPUS.find(entry => entry.name === 'noise-adsr');
    const first = render(testCase);
    const originalRandom = Math.random;
    Math.random = () => 0.999999;
    try {
        const second = render(testCase);
        assert.deepEqual(second.raw, first.raw);
        assert.deepEqual(second.trace.phase, first.trace.phase);
        assert.deepEqual(second.trace.lfsr, first.trace.lfsr);
        assert.deepEqual(second.trace.registers, first.trace.registers);
    } finally {
        Math.random = originalRandom;
    }
    assert.equal(new SIDChip(0).vcfOffset, 0);
});

test('events are applied at cycle start in stable input order', () => {
    const harness = renderSidOffline({
        cycles: 4,
        events: [
            { cycle: 2, register: 0, value: 0xAA },
            { cycle: 0, register: 0, value: 0x34 },
            { cycle: 2, register: 0, value: 0x56 }
        ],
        traceStride: 1
    });
    const voiceZeroPhase = [...harness.trace.phase].filter((_, index) => index % 3 === 0);
    assert.deepEqual(voiceZeroPhase, [0x34, 0x68, 0xBE, 0x114]);
    assert.equal(harness.sid.regs[0], 0x56);
    assert.deepEqual([...harness.trace.cycle], [0, 1, 2, 3]);
});

test('trace captures registers, oscillator, envelope and filter state on the requested grid', () => {
    const harness = renderSidOffline({
        cycles: 8,
        events: [{ cycle: 0, register: 24, value: 0x1F }],
        traceStride: 3
    });
    assert.equal(harness.raw.length, 8);
    assert.equal(harness.trace.cycle.length, 3);
    assert.deepEqual([...harness.trace.cycle], [0, 3, 6]);
    assert.equal(harness.trace.registers.length, 3 * 29);
    assert.equal(harness.trace.phase.length, 3 * 3);
    assert.equal(harness.trace.registers[24], 0x1F);
    assert.equal(harness.trace.output[0], harness.raw[0]);
    const csv = sidTraceToCsv(harness).trim().split('\n');
    assert.equal(csv.length, 4);
    assert.match(csv[0], /^cycle,output,filter_low/);
    assert.match(csv[1], /^0,/);
});

test('WAV is deterministic mono IEEE-float32 and preserves every raw sample', () => {
    const samples = new Float32Array([0, 0.25, -0.5, 1.25]);
    const wav = encodeSidWav(samples, 985248);
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
    assert.equal(view.getUint32(0, false), 0x46464952);
    assert.equal(view.getUint32(8, false), 0x45564157);
    assert.equal(view.getUint32(4, true), wav.length - 8);
    assert.equal(view.getUint16(20, true), 3);
    assert.equal(view.getUint16(22, true), 1);
    assert.equal(view.getUint32(24, true), 985248);
    assert.equal(view.getUint32(40, true), samples.length * 4);
    for (let i = 0; i < samples.length; i++) {
        assert.equal(view.getFloat32(44 + i * 4, true), samples[i]);
    }
    assert.equal(sha256(wav), sha256(encodeSidWav(samples, 985248)));
});

test('invalid event grids fail before emulation starts', () => {
    const invalidEvents = [
        { cycle: -1, register: 0, value: 0 },
        { cycle: 4, register: 0, value: 0 },
        { cycle: 0, register: 29, value: 0 },
        { cycle: 0, register: 0, value: 256 },
        { cycle: 0.5, register: 0, value: 0 }
    ];
    for (const event of invalidEvents) {
        assert.throws(() => new SidOfflineHarness({ cycles: 4, events: [event] }), RangeError);
    }
    assert.throws(() => new SidOfflineHarness({ cycles: 4, traceStride: 0 }), RangeError);
    assert.throws(() => new SidOfflineHarness({ cycles: 4, vcfOffset: NaN }), TypeError);
});
