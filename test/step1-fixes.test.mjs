// Regression tests for "Step 1" (pulse polarity, test-bit LFSR delay, ADSR rate counter, rate table, TOD, NOP timing).
import test from 'node:test';
import assert from 'node:assert/strict';

import { CPU6502 } from '../js/worklets/lib/cpu6502.js';
import { SIDChip, SHIFT_REGISTER_RESET_CYCLES_6581 } from '../js/worklets/lib/sid-chip.js';
import { RATE_COUNTER_PERIOD } from '../js/worklets/lib/sid-luts.js';
import {
    calculateWaveform12Bit6581R3,
    pulse12Bit,
    sawtooth12Bit,
    triangle12Bit
} from '../js/worklets/lib/sid-waveforms-6581.js';

const hex = value => value.toString(16).toUpperCase().padStart(2, '0');

// ---------------------------------------------------------------- pulse polarity (reSID / reSIDfp)
test('pulse follows the reSID polarity: high for (acc >> 12) >= PW, i.e. 4096 - PW high steps', () => {
    for (const pw of [0x000, 0x001, 0x100, 0x400, 0x800, 0xC00, 0xFFF]) {
        let high = 0;
        for (let p = 0; p < 4096; p++) if (pulse12Bit(p << 12, pw, false) === 0xFFF) high++;
        assert.equal(high, 4096 - pw, `PW 0x${pw.toString(16)}`);
    }
    assert.equal(pulse12Bit(0x000000, 0x000, false), 0xFFF, 'PW 0 is a constant high level');
    assert.equal(pulse12Bit(0x555000, 0xFFF, true), 0xFFF, 'the test bit forces the pulse high');
});

test('saw+pulse and triangle+saw+pulse are muted below PW and pass the wired-AND from PW upwards', () => {
    for (const pw of [0x200, 0x800, 0xE00]) {
        for (let p12 = 0; p12 < 4096; p12 += 37) {
            const phase = p12 << 12;
            const pulseHigh = p12 >= pw;
            const saw = sawtooth12Bit(phase);
            const triangle = triangle12Bit(phase, 0);
            assert.equal(calculateWaveform12Bit6581R3(0x60, phase, pw, 0, 0), pulseHigh ? saw : 0,
                `$60 phase ${p12.toString(16)} PW ${pw.toString(16)}`);
            assert.equal(calculateWaveform12Bit6581R3(0x70, phase, pw, 0, 0), pulseHigh ? (triangle & saw) : 0,
                `$70 phase ${p12.toString(16)} PW ${pw.toString(16)}`);
        }
    }
});

test('triangle+pulse ($50) keeps its fitted transfer: plateau below PW, PW-independent phase table from PW upwards', () => {
    const PLATEAU = 1461;
    for (const pw of [0x080, 0x400, 0x800, 0xC00]) {
        for (let p12 = 0; p12 < pw; p12 += 97) {
            assert.equal(calculateWaveform12Bit6581R3(0x50, p12 << 12, pw, 0, 0), PLATEAU,
                `below PW: phase ${p12.toString(16)} PW ${pw.toString(16)}`);
        }
        for (let p12 = pw; p12 < 4096; p12 += 97) {
            assert.equal(
                calculateWaveform12Bit6581R3(0x50, p12 << 12, pw, 0, 0),
                calculateWaveform12Bit6581R3(0x50, p12 << 12, 0, 0, 0),
                `from PW: phase ${p12.toString(16)} PW ${pw.toString(16)}`);
        }
    }
    // pinned values that existed before the polarity fix (must not change)
    assert.equal(calculateWaveform12Bit6581R3(0x50, 0xA5A000, 0x800, 0, 0), 1552);
    assert.equal(calculateWaveform12Bit6581R3(0x50, 0x5A5000, 0x800, 0, 0), 1461);
    assert.equal(calculateWaveform12Bit6581R3(0x50, 0x7FF800, 0x008, 0, 0), 4095);
});

// ---------------------------------------------------------------- test bit and the noise shift register
test('test bit clears the accumulator at once but keeps the noise shift register for the reset delay', () => {
    const sid = new SIDChip(0);
    const voice = sid.voices[0];
    voice.lfsr = 0x123456;
    voice.phase = 0xABCDEF;
    sid.writeReg(4, 0x88); // noise + test
    assert.equal(voice.phase, 0);
    assert.equal(voice.lfsr, 0x123456, 'not reset immediately');
    for (let i = 0; i < SHIFT_REGISTER_RESET_CYCLES_6581 - 1; i++) sid.clockOscillatorsOneCycle();
    assert.equal(voice.lfsr, 0x123456, 'still intact one cycle before the delay expires');
    sid.clockOscillatorsOneCycle();
    assert.equal(voice.lfsr, 0x7FFFFF, 'reset when the delay expires');
});

test('a one-frame test-bit pulse (19656 cycles) leaves the noise sequence untouched and it keeps running', () => {
    const sid = new SIDChip(0);
    const voice = sid.voices[0];
    sid.writeReg(0, 0xFF);
    sid.writeReg(1, 0xFF);
    sid.writeReg(4, 0x80); // noise running
    for (let i = 0; i < 5000; i++) sid.clockOscillatorsOneCycle();
    const before = voice.lfsr;
    assert.notEqual(before, 0x7FFFFF);

    sid.writeReg(4, 0x88);
    for (let i = 0; i < 19656; i++) sid.clockOscillatorsOneCycle();
    assert.equal(voice.lfsr, before, 'frozen, not reset');
    sid.writeReg(4, 0x80); // release the test bit before the delay has elapsed
    assert.equal(voice.lfsrResetIn, 0);
    for (let i = 0; i < 40000; i++) sid.clockOscillatorsOneCycle();
    assert.notEqual(voice.lfsr, 0x7FFFFF);
    assert.notEqual(voice.lfsr, before, 'the sequence continues instead of restarting');
});

test('setting the test bit again restarts the reset countdown', () => {
    const sid = new SIDChip(0);
    const voice = sid.voices[0];
    sid.writeReg(4, 0x88);
    for (let i = 0; i < 20000; i++) sid.clockOscillatorsOneCycle();
    assert.equal(voice.lfsrResetIn, SHIFT_REGISTER_RESET_CYCLES_6581 - 20000);
    sid.writeReg(4, 0x80);
    assert.equal(voice.lfsrResetIn, 0);
    sid.writeReg(4, 0x88);
    assert.equal(voice.lfsrResetIn, SHIFT_REGISTER_RESET_CYCLES_6581);
});

// ---------------------------------------------------------------- ADSR: free-running rate counter
test('GATE does not reset the rate counter: the next attack waits for the 15-bit wraparound (ADSR delay bug)', () => {
    const sid = new SIDChip(0);
    const voice = sid.voices[0];
    sid.writeReg(5, 0x90); // attack period 977
    sid.writeReg(6, 0x0F); // release period 31251: the counter free-runs far above the attack period
    for (let i = 0; i < 5000; i++) sid.clockEnvelopeOneCycle(0);
    assert.equal(voice.rate_counter, 5000);

    sid.writeReg(4, 0x01);
    let cycles = 0;
    while (voice.envelope_counter === 0 && cycles < 40000) {
        sid.clockEnvelopeOneCycle(0);
        cycles++;
    }
    assert.equal(cycles, (0x8000 - 5000) + 977);
});

test('the two slowest ADSR periods match reSID (19532 / 31251 cycles)', () => {
    assert.equal(RATE_COUNTER_PERIOD[14], 19532);
    assert.equal(RATE_COUNTER_PERIOD[15], 31251);
});

// ---------------------------------------------------------------- CPU: NOP length and timing
function createCpu(program) {
    const sid = {
        regs: new Uint8Array(29),
        voices: [{ waveOut8Bit: 0, env8Bit: 0 }, { waveOut8Bit: 0, env8Bit: 0 }, { waveOut8Bit: 0, env8Bit: 0 }],
        writeReg(register, value) { this.regs[register] = value; }
    };
    const cpu = new CPU6502(sid);
    cpu.reset(0x1000, Uint8Array.from(program), 0x1000, 0);
    cpu.pc = 0x1000;
    return cpu;
}

const NOP_CASES = [
    ...[0xEA, 0x1A, 0x3A, 0x5A, 0x7A, 0xDA, 0xFA].map(op => [op, 1, 2, 'NOP implied']),
    ...[0x80, 0x82, 0x89, 0xC2, 0xE2].map(op => [op, 2, 2, 'NOP #imm']),
    ...[0x04, 0x44, 0x64].map(op => [op, 2, 3, 'NOP zp']),
    ...[0x14, 0x34, 0x54, 0x74, 0xD4, 0xF4].map(op => [op, 2, 4, 'NOP zp,X']),
    [0x0C, 3, 4, 'NOP abs'],
    ...[0x1C, 0x3C, 0x5C, 0x7C, 0xDC, 0xFC].map(op => [op, 3, 4, 'NOP abs,X'])
];

for (const [opcode, length, cycles, name] of NOP_CASES) {
    test(`${name} $${hex(opcode)} is ${length} byte(s) and ${cycles} cycles`, () => {
        const cpu = createCpu([opcode, 0x10, 0x20, 0xEA]);
        assert.equal(cpu.step(), cycles);
        assert.equal(cpu.pc, 0x1000 + length);
    });
}

test('NOP abs,X takes one extra cycle on a page crossing', () => {
    const cpu = createCpu([0x1C, 0xF0, 0x10, 0xEA]);
    cpu.x = 0xF0; // $10F0 + $F0 = $11E0
    assert.equal(cpu.step(), 5);
    assert.equal(cpu.pc, 0x1003);
});

// ---------------------------------------------------------------- CPU: CIA TOD tenths
function cyclesUntilTenths(cpu, target, limit = 400000) {
    for (let i = 1; i <= limit; i++) {
        cpu.clockHardware(1);
        if (cpu.todTenths === target) return i;
    }
    assert.fail(`tenths never reached ${target}`);
}

test('TOD tenths advance every 5th pulse in 50 Hz mode (0.1 s per tenth)', () => {
    const cpu = createCpu([0xEA]);
    cpu.cia1CtrlA |= 0x80;
    assert.equal(cyclesUntilTenths(cpu, 1), 5 * 19705);
    assert.equal(cyclesUntilTenths(cpu, 2), 5 * 19705);
});

test('TOD tenths advance every 6th pulse in 60 Hz mode (0.1 s per tenth)', () => {
    const cpu = createCpu([0xEA]);
    cpu.cia1CtrlA &= ~0x80;
    assert.equal(cyclesUntilTenths(cpu, 1), 19705 + 5 * 16421); // first pulse after the initial counter value
    assert.equal(cyclesUntilTenths(cpu, 2), 6 * 16421);
});
