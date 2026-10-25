import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { SIDChip } from '../js/worklets/lib/sid-chip.js';
import {
    CUTOFF_HZ_6581_R3,
    FILTER_DAMPING_6581_R3,
    HP_GAIN_6581_R3
} from '../js/worklets/lib/sid-filter-6581.js';

const reference = JSON.parse(readFileSync(
    new URL('./fixtures/sid-r3-filter-reference.json', import.meta.url), 'utf8'
));

function closeTo(actual, expected, tolerance, message) {
    assert.ok(Math.abs(actual - expected) <= tolerance,
        `${message}: expected ${expected} ± ${tolerance}, got ${actual}`);
}

test('R3 cutoff and damping calibration is monotonic and covers every register', () => {
    assert.equal(CUTOFF_HZ_6581_R3.length, 2048);
    assert.equal(FILTER_DAMPING_6581_R3.length, 2048 * 16);
    const anchors = [
        [0, 240.00], [256, 250.96], [512, 1768.67], [768, 4926.26],
        [1024, 7859.61], [1280, 9242.60], [1536, 11041.01],
        [1792, 12693.17], [2047, 14123.64]
    ];
    for (const [register, expected] of anchors) {
        closeTo(CUTOFF_HZ_6581_R3[register], expected, 0.011, `FC ${register}`);
    }
    for (let register = 1; register < 2048; register++) {
        assert.ok(CUTOFF_HZ_6581_R3[register] >= CUTOFF_HZ_6581_R3[register - 1]);
    }
    for (let register = 0; register < 2048; register++) {
        for (let resonance = 1; resonance < 16; resonance++) {
            assert.ok(FILTER_DAMPING_6581_R3[register * 16 + resonance] <=
                FILTER_DAMPING_6581_R3[register * 16 + resonance - 1]);
        }
    }
});

test('R3 resonance fit preserves measured anchor behavior', () => {
    closeTo(FILTER_DAMPING_6581_R3[512 * 16], 1.47, 0.0001, 'FC512 RES0');
    closeTo(FILTER_DAMPING_6581_R3[512 * 16 + 15], 0.66, 0.0001, 'FC512 RES15');
    closeTo(FILTER_DAMPING_6581_R3[1024 * 16], 1.78, 0.0001, 'FC1024 RES0');
    closeTo(FILTER_DAMPING_6581_R3[1024 * 16 + 15], 0.79, 0.0001, 'FC1024 RES15');
    closeTo(HP_GAIN_6581_R3, Math.SQRT1_2, 0, 'high-pass mixer gain');
});

test('register writes use the calibrated g/k values without temperature detuning', () => {
    const chip = new SIDChip(0);
    chip.writeReg(22, 64); // FC 512
    chip.writeReg(23, 0xF0);
    const cutoff = chip.activeCutoff;
    const g = chip.g;
    const q = chip.q;
    closeTo(cutoff, CUTOFF_HZ_6581_R3[512], 0, 'active cutoff');
    closeTo(q, FILTER_DAMPING_6581_R3[512 * 16 + 15], 0, 'active damping');
    chip.temperature = 75;
    assert.equal(chip.activeCutoff, cutoff);
    assert.equal(chip.g, g);
    assert.equal(chip.q, q);
});

test('master volume is linear and silence retains only the scaled R3 DC bias', () => {
    const chip = new SIDChip(0);
    chip.useJfetSaturation = false;
    chip.synthesizeVoiceOneCycle = () => 0;
    for (let volume = 0; volume < 16; volume++) {
        chip.writeReg(24, volume);
        chip.clock();
        closeTo(chip.outputSample, 0.9 * volume / 15, 1e-7, `volume ${volume}`);
    }
});

test('voice 3 OFF mutes only the direct path and never reads a legacy DAC', () => {
    const chip = new SIDChip(0);
    chip.useJfetSaturation = false;
    chip.synthesizeVoiceOneCycle = voice => voice === 2 ? 1 : 0;

    chip.writeReg(23, 0);
    chip.writeReg(24, 0x0F);
    chip.clock();
    closeTo(chip.outputSample, 0.9 + 0.35 * 1.65, 1e-12, 'direct voice 3');

    chip.writeReg(24, 0x8F);
    chip.clock();
    closeTo(chip.outputSample, 0.9, 1e-12, 'muted direct voice 3');

    chip.writeReg(23, 4);
    chip.writeReg(24, 0x9F);
    for (let i = 0; i < 20000; i++) chip.clock();
    closeTo(chip.outputSample, 0.9 + 0.35 * 1.65, 1e-7, 'filtered voice 3');
});

test('external R3 fixture records provenance and the measured frequency grid', () => {
    assert.equal(reference.source.revision, 'c1791383ca843a855e5d4366da6a7277e34e801d');
    assert.match(reference.source.usage, /black box/);
    assert.equal(reference.method.settleCycles, 49264);
    assert.equal(reference.method.measureCycles, 98520);
    assert.equal(reference.frequencies.length, 9);
    assert.equal(reference.highFrequencies.length, 3);
    assert.equal(reference.cases.length, 63);
    assert.equal(reference.highFrequencyCases.length, 24);
});
