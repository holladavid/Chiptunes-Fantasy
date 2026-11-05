import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { SID_SLDB } from '../js/content/songlengths.js';
import { CPU6502 } from '../js/worklets/lib/cpu6502.js';
import { sidImage, tests } from '../tools/generate-sid-emulation-test.mjs';

const FRAME_RATE = 50;
const TOTAL_FRAMES = tests.reduce((sum, entry) => sum + entry.stepTicks * entry.stepCount, 0);
const BASE_FREQUENCY_WORD = 3746; // 220.00125 Hz at a 985248 Hz PAL SID clock.
const ADSR_START = 40;
const FILTER_START = 44;
const COUPLING_START = 56;

function executeSid() {
    let frame = 0;
    const writes = [];
    const sid = {
        regs: new Uint8Array(29),
        voices: Array.from({ length: 3 }, () => ({ waveOut8Bit: 0, env8Bit: 0 })),
        writeReg(register, value) {
            this.regs[register] = value;
            writes.push({ frame, register, value });
        }
    };
    const view = new DataView(sidImage.buffer, sidImage.byteOffset, sidImage.byteLength);
    const dataOffset = view.getUint16(6, false);
    const initAddress = view.getUint16(10, false);
    const playAddress = view.getUint16(12, false);
    const loadAddress = sidImage[dataOffset] | (sidImage[dataOffset + 1] << 8);
    const cpu = new CPU6502(sid);
    cpu.reset(loadAddress, sidImage.subarray(dataOffset + 2), initAddress, playAddress);
    writes.length = 0;

    function invoke(address) {
        cpu.pc = address;
        cpu.sp = 0xFD;
        cpu.ram[0x01FE] = 0xFE;
        cpu.ram[0x01FF] = 0xFF;
        let instructions = 0;
        while (cpu.pc !== 0xFFFF) {
            assert.ok(++instructions < 10000, `6502 routine at $${address.toString(16)} did not return`);
            let remaining = cpu.beginInstruction();
            while (remaining > 0) remaining = cpu.advanceCycle(remaining);
        }
    }

    invoke(initAddress);
    for (frame = 1; frame <= TOTAL_FRAMES; frame++) invoke(playAddress);
    return { writes, finalRam: cpu.ram.slice(0, 7) };
}

const execution = executeSid();
const startFrames = [];
let nextStart = 0;
for (const entry of tests) {
    startFrames.push(nextStart);
    nextStart += entry.stepTicks * entry.stepCount;
}
const writesAt = (frame, register) => execution.writes
    .filter(write => write.frame === frame && write.register === register)
    .map(write => write.value);
const lastWriteAt = (frame, register) => {
    const values = writesAt(frame, register);
    assert.ok(values.length > 0, `missing SID write at frame ${frame}, register ${register}`);
    return values.at(-1);
};

test('SID emulation image is reproducible and its sweep layout matches the curated duration', () => {
    const onDisk = readFileSync(new URL('../tracks/c64/SID_Emulation_Test.sid', import.meta.url));
    assert.ok(sidImage.equals(onDisk));
    assert.equal(sidImage.toString('ascii', 0, 4), 'PSID');
    assert.equal(sidImage.readUInt16BE(4), 2);
    assert.equal(sidImage.readUInt16BE(8), 0);
    assert.equal(sidImage.readUInt16BE(10), 0x1000);
    assert.equal(sidImage.readUInt16BE(14), 1);
    assert.equal(sidImage.readUInt16BE(16), 1);
    assert.equal(sidImage.toString('ascii', 22, 46).replace(/\0.*$/s, ''), 'SID EMULATION TEST SUITE');
    assert.equal(tests.length, 60);
    assert.equal(TOTAL_FRAMES, 4586);
    assert.equal(TOTAL_FRAMES / FRAME_RATE, 91.72);
    assert.equal(SID_SLDB.sidemulationtest.lengths[0], 91.72);
    assert.equal(tests.slice(ADSR_START, FILTER_START).length, 4);
    assert.equal(tests.slice(FILTER_START, COUPLING_START).length, 12);
    assert.ok(tests.slice(ADSR_START, COUPLING_START).every(entry =>
        entry.frequency === BASE_FREQUENCY_WORD && entry.control === 0x21));
});

test('6502 sequencer writes all sixteen ADSR nibble settings and retriggers every step', () => {
    const expectations = [
        { register: 5, values: step => ((15 - step) << 4) | 0x06 },
        { register: 5, values: step => 15 - step },
        { register: 6, values: step => step << 4 },
        { register: 6, values: step => 0xF0 | (15 - step) }
    ];

    expectations.forEach((expectation, offset) => {
        const index = ADSR_START + offset;
        const entry = tests[index];
        assert.equal(entry.stepCount, 16);
        assert.equal(entry.stepTicks, 20);
        assert.equal(entry.retriggerEachStep, 1);
        for (let step = 0; step < 16; step++) {
            const frame = startFrames[index] + step * entry.stepTicks;
            assert.equal(lastWriteAt(frame, expectation.register), expectation.values(step),
                `${entry.name}, step ${step}`);
            assert.deepEqual(writesAt(frame, 4), [0x20, 0x21],
                `${entry.name}: gate retrigger at step ${step}`);
        }
    });

    const releaseIndex = ADSR_START + 3;
    for (let step = 0; step < 16; step++) {
        const frame = startFrames[releaseIndex] + step * tests[releaseIndex].stepTicks;
        assert.deepEqual(writesAt(frame + 10, 4), [0x20],
            `release sweep must gate off halfway through step ${step}`);
    }
});

test('filter cutoff sweeps use sixteen 128-unit steps without envelope or gate retriggering', () => {
    for (let index = FILTER_START + 1; index <= FILTER_START + 8; index++) {
        const entry = tests[index];
        assert.equal(entry.sweepTarget, 5);
        assert.equal(entry.stepCount, 16);
        assert.equal(entry.stepTicks, 6);
        assert.equal(entry.attackDecay, 0x00);
        assert.equal(entry.sustainRelease, 0xF0);
        assert.equal(entry.retriggerEachStep, 0);
        for (let step = 0; step < 16; step++) {
            const frame = startFrames[index] + step * entry.stepTicks;
            assert.equal(lastWriteAt(frame, 0x15), 0, `${entry.name}: cutoff low, step ${step}`);
            assert.equal(lastWriteAt(frame, 0x16), step << 4, `${entry.name}: cutoff high, step ${step}`);
            if (step > 0) {
                assert.deepEqual(writesAt(frame, 4), [], `${entry.name}: gate write at step ${step}`);
                assert.deepEqual(writesAt(frame, 5), [], `${entry.name}: attack/decay write at step ${step}`);
                assert.deepEqual(writesAt(frame, 6), [], `${entry.name}: sustain/release write at step ${step}`);
            }
        }
    }
});

test('filter resonance sweeps cover 0 through 15 while preserving routing and constant full level', () => {
    for (let index = FILTER_START + 9; index < COUPLING_START; index++) {
        const entry = tests[index];
        assert.equal(entry.sweepTarget, 6);
        assert.equal(entry.resonanceRouting & 0x0F, 0x01);
        assert.equal(entry.attackDecay, 0x00);
        assert.equal(entry.sustainRelease, 0xF0);
        for (let step = 0; step < 16; step++) {
            const frame = startFrames[index] + step * entry.stepTicks;
            assert.equal(lastWriteAt(frame, 0x17), (step << 4) | 0x01,
                `${entry.name}, step ${step}`);
            if (step > 0) {
                assert.deepEqual(writesAt(frame, 4), []);
                assert.deepEqual(writesAt(frame, 5), []);
                assert.deepEqual(writesAt(frame, 6), []);
            }
        }
    }
});

test('the complete 4586-frame sequence advances and wraps without a stuck 6502 routine', () => {
    assert.equal(execution.finalRam[4], 0, 'current test wraps to zero');
    assert.equal(execution.finalRam[5], 0, 'sweep step resets on wrap');
    assert.equal(execution.finalRam[3], tests[0].stepTicks, 'next loop starts with a fresh step timer');
    assert.ok(execution.writes.every(write => write.register >= 0 && write.register < 29));
});
