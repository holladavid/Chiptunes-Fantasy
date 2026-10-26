import test from 'node:test';
import assert from 'node:assert/strict';

import { SIDChip } from '../js/worklets/lib/sid-chip.js';
import {
    calculateWaveform12Bit6581R3,
    noise12Bit,
    pulse12Bit,
    sawtooth12Bit,
    triangle12Bit
} from '../js/worklets/lib/sid-waveforms-6581.js';
import { SID_ENV_ATTACK, SID_ENV_DECAY, SID_ENV_RELEASE } from '../js/worklets/lib/sid-envelope.js';

function clock(chip, count) {
    for (let i = 0; i < count; i++) chip.clockEnvelopeOneCycle(0);
}

test('6581 primitive waveforms preserve the documented 12-bit DAC input', () => {
    assert.equal(sawtooth12Bit(0x000000), 0x000);
    assert.equal(sawtooth12Bit(0x001000), 0x001);
    assert.equal(sawtooth12Bit(0xABC000), 0xABC);
    assert.equal(sawtooth12Bit(0xFFF000), 0xFFF);

    assert.equal(triangle12Bit(0x000000, 0), 0x000);
    assert.equal(triangle12Bit(0x400000, 0), 0x800);
    assert.equal(triangle12Bit(0x7FF800, 0), 0xFFF);
    assert.equal(triangle12Bit(0x800000, 1), 0xFFF);
    assert.equal(triangle12Bit(0xFFF800, 1), 0x000);

    assert.equal(pulse12Bit(0x000000, 0x800, false), 0xFFF);
    assert.equal(pulse12Bit(0x800000, 0x800, false), 0x000);
    assert.equal(pulse12Bit(0x001000, 0x001, false), 0x000);
    assert.equal(pulse12Bit(0x123000, 0x000, true), 0xFFF);
});

test('6581 noise taps feed eight full-scale DAC bits without gain attenuation', () => {
    assert.equal(noise12Bit(0), 0);
    assert.equal(noise12Bit(0x7FFFFF), 0xFF0);
    assert.equal(noise12Bit(0x100000), 0x800);
    assert.equal(noise12Bit(0x040000), 0x400);
    assert.equal(noise12Bit(0x004000), 0x200);
    assert.equal(noise12Bit(0x000800), 0x100);
    assert.equal(noise12Bit(0x000200), 0x080);
    assert.equal(noise12Bit(0x000020), 0x040);
    assert.equal(noise12Bit(0x000004), 0x020);
    assert.equal(noise12Bit(0x000001), 0x010);
});

test('6581 other combined selectors retain 12-bit wired-AND without heuristic bleed', () => {
    const phase = 0x5A5000;
    const triangle = triangle12Bit(phase, 0);
    const saw = sawtooth12Bit(phase);
    assert.equal(calculateWaveform12Bit6581R3(0x30, phase, 0x800, 0, 0), triangle & saw);
    assert.equal(calculateWaveform12Bit6581R3(0x70, phase, 0x800, 0, 0), triangle & saw);
});

test('6581 triangle-pulse uses independently fitted phase and pulse transfer states', () => {
    // Public-output reference fit: pulse low is audible and nonlinear, not forced to zero.
    assert.equal(calculateWaveform12Bit6581R3(0x50, 0xA5A000, 0x800, 0, 0), 1552);
    assert.equal(calculateWaveform12Bit6581R3(0x50, 0x5A5000, 0x800, 0, 0), 1461);
    assert.equal(calculateWaveform12Bit6581R3(0x50, 0x7FF800, 0x008, 0, 0), 4095);

    // Equal folded triangle values on opposite phase halves must remain distinct.
    assert.equal(triangle12Bit(0x001000, 0), triangle12Bit(0x801000, 0));
    assert.equal(calculateWaveform12Bit6581R3(0x50, 0x001000, 0, 0, 0), 1461);
    assert.equal(calculateWaveform12Bit6581R3(0x50, 0x801000, 0, 0, 0), 4095);
});

test('GATE traverses two clock stages and restarts the rate phase on attack', () => {
    const sid = new SIDChip(0);
    sid.writeReg(5, 0x00);
    clock(sid, 5);
    const voice = sid.voices[0];
    assert.equal(voice.rate_counter, 5);

    sid.writeReg(4, 0x21);
    clock(sid, 1);
    assert.equal(voice.state, SID_ENV_RELEASE);
    assert.equal(voice.rate_counter, 6);
    clock(sid, 1);
    assert.equal(voice.state, SID_ENV_ATTACK);
    assert.equal(voice.rate_counter, 1);
    clock(sid, 7);
    assert.equal(voice.envelope_counter, 0);
    assert.equal(voice.rate_counter, 8);
    clock(sid, 1);
    assert.equal(voice.envelope_counter, 1);
    assert.equal(voice.rate_counter, 0);
});

test('rate shortening below the running counter waits for 15-bit wraparound', () => {
    const sid = new SIDChip(0);
    const voice = sid.voices[0];
    voice.state = SID_ENV_ATTACK;
    voice.gate = true;
    voice.gateInput = true;
    voice.gateDelay = true;
    voice.hold_zero = false;
    voice.attack_period = 9;
    voice.rate_counter = 10;
    voice.envelope_counter = 20;

    clock(sid, 1);
    assert.equal(voice.envelope_counter, 20);
    voice.rate_counter = 0x7FFF;
    clock(sid, 10);
    assert.equal(voice.envelope_counter, 21);
});

test('attack is linear and transitions to decay exactly at envelope 255', () => {
    const sid = new SIDChip(0);
    const voice = sid.voices[0];
    sid.writeReg(5, 0x00);
    sid.writeReg(6, 0xF0);
    sid.writeReg(4, 0x21);
    clock(sid, 2 + 9 * 254);
    assert.equal(voice.envelope_counter, 254);
    assert.equal(voice.state, SID_ENV_ATTACK);
    clock(sid, 9);
    assert.equal(voice.envelope_counter, 255);
    assert.equal(voice.state, SID_ENV_DECAY);
});

test('decay and release load exponential periods at documented envelope thresholds', () => {
    const sid = new SIDChip(0);
    const voice = sid.voices[0];
    voice.state = SID_ENV_DECAY;
    voice.gate = true;
    voice.gateInput = true;
    voice.gateDelay = true;
    voice.hold_zero = false;
    voice.decay_period = 1;
    voice.release_period = 1;
    voice.sustain_level = 0;
    voice.envelope_counter = 94;
    voice.exponential_period = 1;

    clock(sid, 1);
    assert.equal(voice.envelope_counter, 93);
    assert.equal(voice.exponential_period, 2);
    clock(sid, 1);
    assert.equal(voice.envelope_counter, 93);
    clock(sid, 1);
    assert.equal(voice.envelope_counter, 92);

    voice.envelope_counter = 15;
    voice.exponential_period = 1;
    voice.state = SID_ENV_RELEASE;
    voice.gate = false;
    voice.gateInput = false;
    voice.gateDelay = false;
    clock(sid, 1);
    assert.equal(voice.envelope_counter, 14);
    assert.equal(voice.exponential_period, 16);
});

test('release preserves the running counters and zero holds until the next attack', () => {
    const sid = new SIDChip(0);
    const voice = sid.voices[0];
    sid.writeReg(5, 0x00);
    sid.writeReg(6, 0x00);
    sid.writeReg(4, 0x21);
    clock(sid, 20);
    const level = voice.envelope_counter;
    const rate = voice.rate_counter;
    assert.ok(level > 0);

    sid.writeReg(4, 0x20);
    clock(sid, 2);
    assert.equal(voice.state, SID_ENV_RELEASE);
    assert.ok(voice.envelope_counter <= level);
    assert.notEqual(voice.rate_counter, rate);

    voice.envelope_counter = 0;
    voice.hold_zero = true;
    clock(sid, 100);
    assert.equal(voice.envelope_counter, 0);
    sid.writeReg(4, 0x21);
    clock(sid, 2);
    assert.equal(voice.hold_zero, false);
});

test('a zero-level gate pulse cannot underflow the envelope into release', () => {
    const sid = new SIDChip(0);
    const voice = sid.voices[0];
    sid.writeReg(5, 0xF0); // Slowest attack; fastest release below.
    sid.writeReg(6, 0x00);

    sid.writeReg(4, 0x21);
    clock(sid, 2);
    assert.equal(voice.state, SID_ENV_ATTACK);
    assert.equal(voice.envelope_counter, 0);
    assert.equal(voice.hold_zero, false);

    sid.writeReg(4, 0x20);
    clock(sid, 2);
    assert.equal(voice.state, SID_ENV_RELEASE);
    assert.equal(voice.envelope_counter, 0);

    clock(sid, 100);
    assert.equal(voice.envelope_counter, 0);
    assert.equal(voice.hold_zero, true);
    assert.ok(Number.isFinite(sid.synthesizeVoiceOneCycle(0)));
});

test('waveform DAC latch holds its last 12-bit value when no waveform is selected', () => {
    const sid = new SIDChip(0);
    const voice = sid.voices[0];
    voice.phase = 0xABC000;
    voice.ctrl = 0x20;
    sid.synthesizeVoiceOneCycle(0);
    assert.equal(voice.waveOut12Bit, 0xABC);
    assert.equal(voice.waveOut8Bit, 0xAB);
    voice.ctrl = 0;
    voice.phase = 0x123000;
    sid.synthesizeVoiceOneCycle(0);
    assert.equal(voice.waveOut12Bit, 0xABC);
    assert.equal(sid.model, 'MOS6581_R3');
    assert.equal(sid.waveformDac.length, 4096);
});
