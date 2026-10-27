import test from 'node:test';
import assert from 'node:assert/strict';

import { YM2149Core } from '../js/worklets/lib/ym2149-core.js';
import {
    decodeYM6Effect,
    mfpTimerFrequency,
    YM6_EFFECT,
    YM6Effects
} from '../js/worklets/lib/ym6-effects.js';

function frame() {
    const value = new Uint8Array(16);
    value[7] = 0x3F;
    return value;
}

function command(type, voice, parameter, { slot = 0, tp = 1, tc = 4 } = {}) {
    const value = frame();
    value[slot === 0 ? 1 : 3] = (type << 6) | (voice << 4);
    value[slot === 0 ? 6 : 8] |= tp << 5;
    value[slot === 0 ? 14 : 15] = tc;
    value[7 + voice] = (value[7 + voice] & 0xE0) | parameter;
    return value;
}

function levelsFor(effects, core, cycles) {
    const levels = [];
    for (let cycle = 0; cycle < cycles; cycle++) {
        levels.push(Array.from(effects.clockCycle(core)));
        core.clockCycle(-1, 0, effects.voiceLevels);
    }
    return levels;
}

test('YM6 decodes both effect slots without an R14/R15 Digidrum fallback', () => {
    const value = frame();
    value[1] = (YM6_EFFECT.SID_VOICE << 6) | (2 << 4);
    value[6] = 3 << 5;
    value[14] = 102;
    value[9] = 12;
    value[3] = (YM6_EFFECT.SYNC_BUZZER << 6) | (3 << 4);
    value[8] = 5 << 5;
    value[15] = 28;
    value[10] = 10;

    const first = decodeYM6Effect(value, 0);
    const second = decodeYM6Effect(value, 1);
    assert.deepEqual(first, {
        type: YM6_EFFECT.SID_VOICE, voice: 2, timerPredivisor: 3, timerCount: 102,
        parameter: 12, active: true
    });
    assert.deepEqual(second, {
        type: YM6_EFFECT.SYNC_BUZZER, voice: 3, timerPredivisor: 5, timerCount: 28,
        parameter: 10, active: true
    });

    const extendedDataOnly = frame();
    extendedDataOnly[14] = 1;
    extendedDataOnly[15] = 2;
    const effects = new YM6Effects();
    effects.applyFrame(extendedDataOnly, [[-1], [1]]);
    assert.equal(effects.slots[0].active, false);
    assert.equal(effects.slots[1].active, false);
});

test('MFP rates use the encoded predivisor and timer count', () => {
    assert.equal(mfpTimerFrequency(1, 28), 2457600 / 4 / 28);
    assert.ok(Math.abs(mfpTimerFrequency(1, 102) - 6023.529411764706) < 1e-9);
    assert.ok(Math.abs(mfpTimerFrequency(1, 101) - 6083.168316831683) < 1e-9);
    assert.equal(mfpTimerFrequency(0, 100), 0);
    assert.equal(mfpTimerFrequency(1, 0), 0);
});

test('Digidrums emit 4-bit samples on the exact MFP event grid and hold the final step', () => {
    const core = new YM2149Core();
    const effects = new YM6Effects();
    const samples = [new Float32Array([-1, -0.5, 0])];
    effects.applyFrame(command(YM6_EFFECT.DIGIDRUM, 1, 0), samples);
    const levels = levelsFor(effects, core, 45).map(level => level[0]);

    assert.equal(levels[0], 0);
    assert.equal(levels[14], 9);
    assert.equal(levels[27], 17);
    assert.equal(levels[39], 17, 'last sample remains for its complete timer step');
    assert.equal(levels[40], -1, 'effect ends at the following timer event');
    assert.deepEqual(effects.slots[0].samplePosition, 3);
});

test('unsigned 8-bit Digidrum data uses the upper four amplitude bits', () => {
    const core = new YM2149Core();
    const effects = new YM6Effects();
    const bytes = Array.from({ length: 16 }, (_, index) => index * 17);
    const sample = new Float32Array(bytes.map(value => (value - 128) / 128));
    effects.applyFrame(command(YM6_EFFECT.DIGIDRUM, 1, 0), [sample]);
    const sequence = [];
    let previousPosition = 0;
    for (let cycle = 0; cycle < 240 && sequence.length < 16; cycle++) {
        const level = effects.clockCycle(core)[0];
        if (effects.slots[0].samplePosition !== previousPosition) sequence.push(level);
        previousPosition = effects.slots[0].samplePosition;
    }
    assert.deepEqual(sequence, Array.from({ length: 16 }, (_, index) => index === 0 ? 0 : index * 2 + 1));
});

test('a periodic Digidrum has the MFP-derived spectral fundamental', () => {
    const core = new YM2149Core();
    const effects = new YM6Effects();
    const sample = new Float32Array(64);
    for (let index = 0; index < sample.length; index++) sample[index] = index & 1 ? 1 : -1;
    effects.applyFrame(command(YM6_EFFECT.DIGIDRUM, 1, 0), [sample]);
    const signal = new Float64Array(8192);
    let mean = 0;
    for (let cycle = 0; cycle < signal.length; cycle++) {
        signal[cycle] = effects.clockCycle(core)[0];
        mean += signal[cycle];
    }
    mean /= signal.length;

    function magnitude(frequency) {
        let real = 0;
        let imaginary = 0;
        for (let cycle = 0; cycle < signal.length; cycle++) {
            const angle = 2 * Math.PI * frequency * cycle / 2000000;
            const value = signal[cycle] - mean;
            real += value * Math.cos(angle);
            imaginary -= value * Math.sin(angle);
        }
        return Math.hypot(real, imaginary);
    }

    const fundamental = magnitude(2457600 / 4 / 4 / 2);
    assert.ok(fundamental > magnitude(50000) * 5);
    assert.ok(fundamental > magnitude(100000) * 5);
});

test('the same Digidrum command re-triggers immediately in a consecutive frame', () => {
    const core = new YM2149Core();
    const effects = new YM6Effects();
    const value = command(YM6_EFFECT.DIGIDRUM, 2, 0);
    const samples = [new Float32Array([-1, 0, 1])];
    effects.applyFrame(value, samples);
    assert.equal(effects.clockCycle(core)[1], 0);
    for (let cycle = 0; cycle < 5; cycle++) effects.clockCycle(core);

    effects.applyFrame(value, samples);
    assert.equal(effects.slots[0].samplePosition, 0);
    assert.equal(effects.clockCycle(core)[1], 0);
    assert.equal(effects.slots[0].samplePosition, 1);
});

test('effect end restores the current fixed register volume', () => {
    const core = new YM2149Core();
    core.writeRegister(7, 0x3F);
    core.writeRegister(8, 4);
    const effects = new YM6Effects();
    effects.applyFrame(command(YM6_EFFECT.DIGIDRUM, 1, 0, { tc: 1 }), [new Float32Array([-1])]);
    assert.equal(effects.clockCycle(core)[0], 0);
    assert.equal(core.clockCycle(-1, 0, effects.voiceLevels), 0);

    for (let cycle = 0; cycle < 3; cycle++) effects.clockCycle(core);
    core.clockCycle(-1, 0, effects.voiceLevels);
    assert.equal(core.volA, 0);
    effects.clockCycle(core);
    core.clockCycle(-1, 0, effects.voiceLevels);
    assert.ok(core.volA > 0);
});

test('unchanged continuous commands preserve timer phase across VBL boundaries', () => {
    const value = command(YM6_EFFECT.SID_VOICE, 1, 15);
    const periodicFrames = new YM6Effects();
    const uninterrupted = new YM6Effects();
    const coreA = new YM2149Core();
    const coreB = new YM2149Core();
    periodicFrames.applyFrame(value, []);
    uninterrupted.applyFrame(value, []);

    for (let cycle = 0; cycle < 160; cycle++) {
        if (cycle > 0 && cycle % 20 === 0) periodicFrames.applyFrame(value, []);
        assert.deepEqual(
            Array.from(periodicFrames.clockCycle(coreA)),
            Array.from(uninterrupted.clockCycle(coreB)),
            `cycle ${cycle}`
        );
    }
});

test('SID-Voice alternates between zero and VMAX on the MFP timer', () => {
    const core = new YM2149Core();
    const effects = new YM6Effects();
    effects.applyFrame(command(YM6_EFFECT.SID_VOICE, 3, 15), []);
    const levels = levelsFor(effects, core, 42).map(level => level[2]);
    assert.equal(levels[0], 31);
    assert.equal(levels[13], 31);
    assert.equal(levels[14], 0);
    assert.equal(levels[26], 0);
    assert.equal(levels[27], 31);
    assert.equal(levels[40], 0);
});

test('Sinus-SID loops its eight timer-driven volume steps', () => {
    const core = new YM2149Core();
    const effects = new YM6Effects();
    effects.applyFrame(command(YM6_EFFECT.SINUS_SID, 2, 15), []);
    const sequence = [];
    let previousPosition = 0;
    for (let cycle = 0; cycle < 120 && sequence.length < 9; cycle++) {
        const level = effects.clockCycle(core)[1];
        const position = effects.slots[0].sequencePosition;
        if (position !== previousPosition || cycle === 0) sequence.push(level);
        previousPosition = position;
    }
    assert.deepEqual(sequence, [17, 27, 31, 27, 17, 5, 0, 5, 17]);
});

test('Sync-Buzzer performs timer-driven R13 resets with the encoded shape', () => {
    const core = new YM2149Core();
    core.writeRegister(11, 1);
    core.writeRegister(12, 0);
    const effects = new YM6Effects();
    effects.applyFrame(command(YM6_EFFECT.SYNC_BUZZER, 1, 10), []);

    effects.clockCycle(core);
    assert.equal(core.envShape, 10);
    assert.equal(core.envPos, 0);
    for (let cycle = 1; cycle < 14; cycle++) {
        effects.clockCycle(core);
        core.clockCycle();
    }
    assert.ok(core.envPos > 0);
    effects.clockCycle(core);
    assert.equal(core.envPos, 0);
    assert.equal(core.envVol5Bit, 31);
});

test('two slots advance independently without overwriting each other timer state', () => {
    const value = command(YM6_EFFECT.SID_VOICE, 1, 15);
    value[3] = (YM6_EFFECT.SINUS_SID << 6) | (2 << 4);
    value[8] = (value[8] & 0x1F) | (1 << 5);
    value[15] = 8;
    value[9] = 12;

    const combined = new YM6Effects();
    const single = new YM6Effects();
    const combinedCore = new YM2149Core();
    const singleCore = new YM2149Core();
    combined.applyFrame(value, []);
    single.applyFrame(command(YM6_EFFECT.SID_VOICE, 1, 15), []);

    for (let cycle = 0; cycle < 120; cycle++) {
        const both = combined.clockCycle(combinedCore);
        const one = single.clockCycle(singleCore);
        assert.equal(both[0], one[0], `slot 1, cycle ${cycle}`);
        assert.equal(combined.slots[0].timerPhase, single.slots[0].timerPhase);
        assert.notEqual(combined.slots[1].timerThreshold, combined.slots[0].timerThreshold);
    }
    assert.equal(combined.slots[1].sequencePosition, 5);
});
