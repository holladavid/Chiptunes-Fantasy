import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import {
    encodeYMWav,
    renderYMOffline,
    YMOfflineHarness,
    ymTraceToCsv
} from '../js/worklets/lib/ym-offline.js';
import { YM2149Core } from '../js/worklets/lib/ym2149-core.js';
import { YM_SYNTHETIC_CORPUS } from './helpers/ym-corpus.mjs';

const baseline = JSON.parse(readFileSync(new URL('./fixtures/ym-baseline.json', import.meta.url), 'utf8'));

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
        'cycle', 'output', 'registers', 'toneDivider', 'toneOutput', 'noiseDivider',
        'noiseLfsr', 'noiseOutput', 'envelopeDivider', 'envelopePosition',
        'envelopeShape', 'envelopeLevel', 'volume'
    ]) updateHash(hash, trace[key]);
    return hash.digest('hex');
}

function render(testCase) {
    return renderYMOffline({ cycles: testCase.cycles, events: testCase.events, traceStride: 64 });
}

test('YM synthetic corpus matches the reviewed Phase 0 raw/trace/WAV hashes', () => {
    for (const testCase of YM_SYNTHETIC_CORPUS) {
        const harness = render(testCase);
        const expected = baseline.cases[testCase.name];
        assert.ok(expected, `missing baseline for ${testCase.name}`);
        assert.equal(sha256(harness.raw), expected.rawSha256, `${testCase.name}: raw output`);
        assert.equal(hashTrace(harness.trace), expected.traceSha256, `${testCase.name}: state trace`);
        assert.equal(sha256(encodeYMWav(harness.raw, harness.clock)), expected.wavSha256, `${testCase.name}: WAV`);
    }
});

test('two offline runs are bit-identical', () => {
    const testCase = YM_SYNTHETIC_CORPUS.find(entry => entry.name === 'period-zero-mixer');
    const first = render(testCase);
    const second = render(testCase);
    assert.deepEqual(second.raw, first.raw);
    assert.deepEqual(second.trace.toneOutput, first.trace.toneOutput);
    assert.deepEqual(second.trace.noiseLfsr, first.trace.noiseLfsr);
    assert.deepEqual(second.trace.envelopeLevel, first.trace.envelopeLevel);
});

test('events are applied at cycle start in stable input order', () => {
    const harness = renderYMOffline({
        cycles: 4,
        events: [
            { cycle: 2, register: 0, value: 0xAA },
            { cycle: 0, register: 0, value: 0x34 },
            { cycle: 2, register: 0, value: 0x56 },
            { cycle: 0, register: 13, value: 0x0A },
            { cycle: 2, register: 13, value: 0xFF }
        ],
        traceStride: 1
    });
    assert.equal(harness.ym.regs[0], 0x56);
    assert.equal(harness.ym.regs[13], 0x0A);
    assert.deepEqual([...harness.trace.registers.slice(0, 4)], [0x34, 0, 0, 0]);
    assert.deepEqual([...harness.trace.cycle], [0, 1, 2, 3]);
});

test('trace captures registers, oscillators, noise, envelope and volumes on the requested grid', () => {
    const harness = renderYMOffline({
        cycles: 8,
        events: [{ cycle: 0, register: 8, value: 0x0F }],
        traceStride: 3
    });
    assert.equal(harness.raw.length, 8);
    assert.deepEqual([...harness.trace.cycle], [0, 3, 6]);
    assert.equal(harness.trace.registers.length, 3 * 16);
    assert.equal(harness.trace.toneDivider.length, 3 * 3);
    assert.equal(harness.trace.volume.length, 3 * 3);
    assert.equal(harness.trace.registers[8], 0x0F);
    assert.equal(harness.trace.output[0], harness.raw[0]);
    const csv = ymTraceToCsv(harness).trim().split('\n');
    assert.equal(csv.length, 4);
    assert.match(csv[0], /^cycle,output,registers_hex/);
    assert.match(csv[1], /^0,/);
});

test('WAV is deterministic mono IEEE-float32 and preserves every raw sample', () => {
    const samples = new Float32Array([0, 0.25, -0.5, 1.25]);
    const wav = encodeYMWav(samples, 2000000);
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
    assert.equal(view.getUint32(0, false), 0x46464952);
    assert.equal(view.getUint32(8, false), 0x45564157);
    assert.equal(view.getUint32(4, true), wav.length - 8);
    assert.equal(view.getUint16(20, true), 3);
    assert.equal(view.getUint16(22, true), 1);
    assert.equal(view.getUint32(24, true), 2000000);
    assert.equal(view.getUint32(40, true), samples.length * 4);
    for (let i = 0; i < samples.length; i++) {
        assert.equal(view.getFloat32(44 + i * 4, true), samples[i]);
    }
    assert.equal(sha256(wav), sha256(encodeYMWav(samples, 2000000)));
});

test('invalid event grids fail before emulation starts', () => {
    const invalidEvents = [
        { cycle: -1, register: 0, value: 0 },
        { cycle: 4, register: 0, value: 0 },
        { cycle: 0, register: 16, value: 0 },
        { cycle: 0, register: 0, value: 256 },
        { cycle: 0.5, register: 0, value: 0 }
    ];
    for (const event of invalidEvents) {
        assert.throws(() => new YMOfflineHarness({ cycles: 4, events: [event] }), RangeError);
    }
    assert.throws(() => new YMOfflineHarness({ cycles: 4, traceStride: 0 }), RangeError);
    assert.throws(() => new YMOfflineHarness({ cycles: 4, clock: NaN }), RangeError);
});

test('tone divider produces the documented full-period transition count', () => {
    const ym = new YM2149Core();
    ym.writeRegister(0, 2);
    ym.writeRegister(1, 0);
    let transitions = 0;
    let previous = ym.toneOutA;
    for (let cycle = 0; cycle < 1600; cycle++) {
        ym.clockCycle();
        if (ym.toneOutA !== previous) transitions++;
        previous = ym.toneOutA;
    }
    assert.equal(transitions, 100);
});

test('noise divider exposes the expected initial 17-bit LFSR sequence', () => {
    const ym = new YM2149Core();
    ym.writeRegister(6, 1);
    const states = [];
    for (let step = 0; step < 4; step++) {
        for (let cycle = 0; cycle < 16; cycle++) ym.clockCycle();
        states.push(ym.noiseLfsr);
    }
    assert.deepEqual(states, [0x10000, 0x08000, 0x04000, 0x02000]);
});

test('all envelope shapes produce their defined second 32-step segment', () => {
    for (let shape = 0; shape < 16; shape++) {
        const ym = new YM2149Core();
        ym.writeRegister(11, 1);
        ym.writeRegister(12, 0);
        ym.writeRegister(13, shape);
        ym.envPos = 31;
        ym.envDiv = 0;
        const levels = [];
        for (let step = 0; step < 32; step++) {
            for (let cycle = 0; cycle < 8; cycle++) ym.clockCycle();
            levels.push(ym.envVol5Bit);
        }

        let expected;
        if (shape < 8 || shape === 9 || shape === 15) expected = new Array(32).fill(0);
        else if (shape === 11 || shape === 13) expected = new Array(32).fill(31);
        else if (shape === 8 || shape === 14) expected = Array.from({ length: 32 }, (_, i) => 31 - i);
        else expected = Array.from({ length: 32 }, (_, i) => i);
        assert.deepEqual(levels, expected, `shape ${shape}`);
    }
});

test('raw harness output matches direct core clocks without hidden processing', () => {
    const events = [
        { cycle: 0, register: 0, value: 20 },
        { cycle: 0, register: 7, value: 0x3E },
        { cycle: 0, register: 8, value: 0x0F }
    ];
    const harness = renderYMOffline({ cycles: 256, events });
    const ym = new YM2149Core();
    for (const event of events) ym.writeRegister(event.register, event.value);
    for (let cycle = 0; cycle < harness.raw.length; cycle++) {
        assert.equal(harness.raw[cycle], Math.fround(ym.clockCycle()));
    }
});
