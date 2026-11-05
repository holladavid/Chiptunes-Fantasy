import test from 'node:test';
import assert from 'node:assert/strict';

import { BEAT_LEVEL, TrackMonitor } from '../js/visuals/dj/track-monitor.js';

const DT = 1 / 60;

function createMonitor(system) {
    const monitor = new TrackMonitor();
    monitor.info.system = system;
    monitor.info.isPlaying = true;
    return monitor;
}

function createRegs(entries = {}) {
    const regs = new Uint8Array(32);
    regs[7] = 0xFF;
    for (const [index, value] of Object.entries(entries)) {
        regs[Number(index)] = value;
    }
    return regs;
}

function update(monitor, volumes = [0, 0, 0, 0], regs = null) {
    monitor.update(Float32Array.from(volumes), DT, regs);
    return monitor.dynamics;
}

function detectHardwareBeat(system, before, after) {
    const monitor = createMonitor(system);
    update(monitor, [0, 0, 0, 0], before);
    return update(monitor, [0, 0, 0, 0], after);
}

test('analog attacks normalize to soft, medium and hard beats on every system', () => {
    const cases = {
        c64: { soft: 0.55, medium: 0.74, hard: 1.0 },
        atari: { soft: 0.34, medium: 0.65, hard: 1.0 },
        amiga: { soft: 0.40, medium: 0.67, hard: 1.0 }
    };

    for (const [system, volumes] of Object.entries(cases)) {
        for (const [expectedName, volume] of Object.entries(volumes)) {
            const monitor = createMonitor(system);
            update(monitor);
            const dynamics = update(monitor, [volume, 0, 0, 0]);

            assert.equal(dynamics.beatStarted, true, `${system} ${expectedName} must trigger a beat`);
            assert.equal(dynamics.beatLevel, BEAT_LEVEL[expectedName.toUpperCase()]);
            assert.ok(dynamics.beatStrength > 0 && dynamics.beatStrength <= 1);
            assert.ok(Math.abs(dynamics.beatImpulse[0] - dynamics.beatStrength) < 1e-6);
        }
    }
});

test('analog pulses below the existing thresholds remain silent', () => {
    const cases = { c64: 0.48, atari: 0.30, amiga: 0.34 };
    for (const [system, threshold] of Object.entries(cases)) {
        const monitor = createMonitor(system);
        update(monitor);
        const dynamics = update(monitor, [threshold - 0.01, 0, 0, 0]);
        assert.equal(dynamics.beatStarted, false);
        assert.equal(dynamics.beatStrength, 0);
        assert.equal(dynamics.beatLevel, BEAT_LEVEL.NONE);
        assert.equal(dynamics.beatImpulse[0], 0);
    }
});

test('SID gate and pitch events produce graded hardware strengths', () => {
    const snare = detectHardwareBeat('c64', createRegs(), createRegs({ 4: 0x81 }));
    assert.equal(snare.beatStarted, true);
    assert.equal(snare.beatLevel, BEAT_LEVEL.MEDIUM);

    const kick = detectHardwareBeat('c64', createRegs(), createRegs({ 0: 0xE8, 1: 0x03, 4: 0x01 }));
    assert.equal(kick.beatStarted, true);
    assert.equal(kick.beatLevel, BEAT_LEVEL.HARD);
    assert.ok(kick.beatStrength > snare.beatStrength);
});

test('YM volume jumps produce medium and hard hardware beats', () => {
    const medium = detectHardwareBeat('atari', createRegs({ 8: 4 }), createRegs({ 8: 7 }));
    assert.equal(medium.beatStarted, true);
    assert.equal(medium.beatLevel, BEAT_LEVEL.MEDIUM);

    const hard = detectHardwareBeat('atari', createRegs(), createRegs({ 8: 15 }));
    assert.equal(hard.beatStarted, true);
    assert.equal(hard.beatLevel, BEAT_LEVEL.HARD);
    assert.ok(hard.beatStrength > medium.beatStrength);
});

test('Paula volume jumps produce medium and hard hardware beats', () => {
    const medium = detectHardwareBeat('amiga', createRegs({ 6: 10 }), createRegs({ 6: 30 }));
    assert.equal(medium.beatStarted, true);
    assert.equal(medium.beatLevel, BEAT_LEVEL.MEDIUM);

    const hard = detectHardwareBeat('amiga', createRegs(), createRegs({ 6: 64 }));
    assert.equal(hard.beatStarted, true);
    assert.equal(hard.beatLevel, BEAT_LEVEL.HARD);
    assert.ok(hard.beatStrength > medium.beatStrength);
});

test('secondary hardware triggers produce bounded graded strengths', () => {
    const pitchDrop = detectHardwareBeat('c64',
        createRegs({ 0: 0xE0, 1: 0x2E, 4: 0x01 }),
        createRegs({ 0: 0xE8, 1: 0x03, 4: 0x01 }));
    assert.equal(pitchDrop.beatStarted, true);
    assert.equal(pitchDrop.beatLevel, BEAT_LEVEL.HARD);

    const envelope = detectHardwareBeat('atari', createRegs({ 13: 255 }), createRegs({ 13: 1 }));
    assert.equal(envelope.beatStarted, true);
    assert.equal(envelope.beatLevel, BEAT_LEVEL.MEDIUM);

    const digidrum = detectHardwareBeat('atari', createRegs(), createRegs({ 14: 1 }));
    assert.equal(digidrum.beatStarted, true);
    assert.equal(digidrum.beatLevel, BEAT_LEVEL.MEDIUM);

    const noise = detectHardwareBeat('atari',
        createRegs({ 7: 0xFF, 8: 6 }),
        createRegs({ 7: 0xF7, 8: 6 }));
    assert.equal(noise.beatStarted, true);
    assert.equal(noise.beatLevel, BEAT_LEVEL.MEDIUM);

    const dma = detectHardwareBeat('amiga',
        createRegs({ 0: 0x10, 1: 0x00, 4: 0x01, 5: 0x90, 6: 32 }),
        createRegs({ 0: 0x08, 1: 0x00, 4: 0x00, 5: 0xC8, 6: 64 }));
    assert.equal(dma.beatStarted, true);
    assert.equal(dma.beatLevel, BEAT_LEVEL.HARD);
});

test('simultaneous hardware events use the strongest candidate without accumulation', () => {
    const dynamics = detectHardwareBeat('c64', createRegs(), createRegs({ 4: 0x81, 11: 0x81, 18: 0x81 }));
    assert.equal(dynamics.beatStarted, true);
    assert.equal(dynamics.beatLevel, BEAT_LEVEL.MEDIUM);
    assert.ok(Math.abs(dynamics.beatStrength - 0.55) < 1e-6);
});

test('first snapshots and cooldown frames cannot create or replace beat intensity', () => {
    for (const system of ['c64', 'atari', 'amiga']) {
        const monitor = createMonitor(system);
        const dynamics = update(monitor, [0, 0, 0, 0], createRegs({
            0: 0xE8,
            1: 0x03,
            4: 0x81,
            6: 64,
            8: 15,
            13: 1,
            14: 1
        }));
        assert.equal(dynamics.beatStarted, false, `${system} baseline must not trigger`);
        assert.equal(dynamics.beatStrength, 0);
    }

    const monitor = createMonitor('c64');
    update(monitor, [0, 0, 0, 0], createRegs());
    const first = update(monitor, [0, 0, 0, 0], createRegs({ 4: 0x81 }));
    const impulseBuffer = first.beatImpulse;
    assert.equal(first.beatLevel, BEAT_LEVEL.MEDIUM);

    const second = update(monitor, [0, 0, 0, 0], createRegs({
        4: 0x81,
        7: 0xE8,
        8: 0x03,
        11: 0x01
    }));
    assert.equal(second.beatStarted, false);
    assert.equal(second.beatCount, 1);
    assert.equal(second.beatLevel, BEAT_LEVEL.MEDIUM);
    assert.ok(Math.abs(second.beatStrength - 0.55) < 1e-6);
    assert.ok(second.beatImpulse[0] > 0 && second.beatImpulse[0] < second.beatStrength);
    assert.equal(second.beatImpulse, impulseBuffer, 'The metrics buffer must be reused');
});

test('reset and pause clear graded beat state', () => {
    const monitor = createMonitor('atari');
    update(monitor);
    update(monitor, [1, 0, 0, 0]);
    assert.equal(monitor.dynamics.beatLevel, BEAT_LEVEL.HARD);

    monitor.reset();
    assert.equal(monitor.dynamics.beatStrength, 0);
    assert.equal(monitor.dynamics.beatLevel, BEAT_LEVEL.NONE);
    assert.equal(monitor.dynamics.beatImpulse[0], 0);

    update(monitor, [1, 0, 0, 0]);
    monitor.info.isPlaying = false;
    const paused = update(monitor);
    assert.equal(paused.beatStrength, 0);
    assert.equal(paused.beatLevel, BEAT_LEVEL.NONE);
    assert.equal(paused.beatImpulse[0], 0);
});
