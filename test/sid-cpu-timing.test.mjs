import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { CPU6502 } from '../js/worklets/lib/cpu6502.js';
import {
    CIA_IRQ_PROGRAM_SHA256,
    createCiaIrqProgram
} from './helpers/sid-timing-corpus.mjs';

const timingFixture = JSON.parse(readFileSync(
    new URL('./fixtures/sid-phase4-timing-reference.json', import.meta.url), 'utf8'
));

function createCpu(program = [0xEA]) {
    const writes = [];
    const sid = {
        regs: new Uint8Array(29),
        voices: [
            { waveOut8Bit: 0, env8Bit: 0 },
            { waveOut8Bit: 0, env8Bit: 0 },
            { waveOut8Bit: 0, env8Bit: 0 }
        ],
        writeReg(reg, value) {
            this.regs[reg] = value;
            writes.push(value);
        }
    };
    const cpu = new CPU6502(sid);
    cpu.reset(0x1000, Uint8Array.from(program), 0x1000, 0);
    cpu.pc = 0x1000;
    cpu.cia1CtrlA = 0;
    cpu.cia1CtrlB = 0;
    cpu.cia2CtrlA = 0;
    cpu.cia2CtrlB = 0;
    writes.length = 0;
    return { cpu, writes };
}

function setIrqVector(cpu, address) {
    cpu.kernalRom[0x1FFE] = address & 0xFF;
    cpu.kernalRom[0x1FFF] = address >> 8;
}

function clockScheduler(cpu, state, instructions) {
    if (state.remaining === 2) cpu.pollInterrupts();

    if (state.remaining <= 0) {
        if (!cpu.rdy) return;
        if (cpu.nmiAccepted) {
            cpu.nmiAccepted = false;
            cpu.triggerHardwareNmi();
            state.remaining = 6;
        } else if (cpu.irqAccepted) {
            cpu.irqAccepted = false;
            cpu.triggerHardwareIrq();
            state.remaining = 6;
        } else {
            const opcode = cpu.read(cpu.pc);
            state.remaining = cpu.beginInstruction();
            if (instructions) instructions.push(opcode);
        }
    } else if (cpu.canAdvanceCycle(state.remaining)) {
        state.remaining = cpu.advanceCycle(state.remaining);
    }
}

function runUntil(cpu, state, predicate, instructions, limit = 100) {
    for (let cycle = 0; cycle < limit; cycle++) {
        if (predicate()) return cycle;
        clockScheduler(cpu, state, instructions);
    }
    assert.fail('scheduler did not reach the expected state');
}

test('CIA timer A implements start delay, force load and reload skip for latch 2', () => {
    const { cpu } = createCpu();
    cpu.writeHardware(0xDC04, 2);
    cpu.writeHardware(0xDC05, 0);
    cpu.writeHardware(0xDC0E, 0x11);

    const observed = [];
    for (let cycle = 0; cycle < 7; cycle++) {
        cpu.clockHardware(1);
        observed.push(cpu.cia1TimerA);
    }
    assert.deepEqual(observed, [2, 2, 1, 2, 2, 1, 2]);
});

test('CIA timer A one-shot stops on underflow after reloading', () => {
    const { cpu } = createCpu();
    cpu.writeHardware(0xDC04, 2);
    cpu.writeHardware(0xDC05, 0);
    cpu.writeHardware(0xDC0E, 0x19);

    const observed = [];
    for (let cycle = 0; cycle < 6; cycle++) {
        cpu.clockHardware(1);
        observed.push(cpu.cia1TimerA);
    }
    assert.deepEqual(observed, [2, 2, 1, 2, 2, 2]);
    assert.equal(cpu.cia1CtrlA & 0x01, 0);
    assert.equal(cpu.cia1Icr & 0x01, 0x01);
});

test('CIA timer B cascade exposes zero and skips one input after reload', () => {
    const { cpu } = createCpu();
    cpu.cia1TimerB = 2;
    cpu.cia1TimerBLatch = 2;
    cpu.cia1CtrlB = 0x41;

    const observed = [];
    for (let cycle = 0; cycle < 6; cycle++) {
        cpu.cia1TimerAPulse = true;
        cpu.clockHardware(1);
        observed.push(cpu.cia1TimerB);
    }
    assert.deepEqual(observed, [1, 0, 2, 2, 1, 0]);
});

test('CIA1 interrupt flip-flop survives IMR clearing and only ICR read clears it', () => {
    const { cpu } = createCpu();
    cpu.cia1Icr = 0x01;
    cpu.writeHardware(0xDC0D, 0x81);
    assert.equal(cpu.irqPending, false, '6526 interrupt output is delayed by one clock');

    cpu.clockHardware(1);
    assert.equal(cpu.irqPending, true);
    cpu.writeHardware(0xDC0D, 0x01);
    assert.equal(cpu.irqPending, true, 'clearing IMR cannot clear an active interrupt');
    assert.equal(cpu.read(0xDC0D), 0x81);
    assert.equal(cpu.irqPending, true, 'acknowledge waits for the final read cycle');
    cpu.commitPendingIcrRead();
    assert.equal(cpu.irqPending, false);
    assert.equal(cpu.cia1Icr, 0);
});

test('CIA2 NMI line is latched until ICR read and can be retriggered afterwards', () => {
    const { cpu } = createCpu();
    cpu.cia2Icr = 0x01;
    cpu.writeHardware(0xDD0D, 0x81);
    cpu.clockHardware(1);
    assert.equal(cpu.nmiPending, true);
    assert.equal(cpu.nmiLineState, true);

    cpu.writeHardware(0xDD0D, 0x01);
    assert.equal(cpu.nmiLineState, true);
    assert.equal(cpu.read(0xDD0D), 0x81);
    cpu.commitPendingIcrRead();
    assert.equal(cpu.nmiLineState, false);

    cpu.nmiPending = false;
    cpu.cia2Icr = 0x01;
    cpu.writeHardware(0xDD0D, 0x81);
    cpu.clockHardware(1);
    assert.equal(cpu.nmiPending, true);
});

test('CLI delays IRQ recognition by one following instruction', () => {
    const { cpu } = createCpu([0x58, 0xEA, 0xEA]);
    setIrqVector(cpu, 0x2000);
    cpu.p |= 0x04;
    cpu.irqPending = true;
    const state = { remaining: 0 };
    const instructions = [];

    runUntil(cpu, state, () => cpu.pc === 0x2000, instructions);
    assert.deepEqual(instructions, [0x58, 0xEA]);
});

test('SEI does not cancel an IRQ already polled with I clear', () => {
    const { cpu } = createCpu([0x78, 0xEA]);
    setIrqVector(cpu, 0x2000);
    cpu.p &= ~0x04;
    cpu.irqPending = true;
    const state = { remaining: 0 };
    const instructions = [];

    runUntil(cpu, state, () => cpu.pc === 0x2000, instructions);
    assert.deepEqual(instructions, [0x78]);
});

test('IRQ asserted after the penultimate cycle waits through the next instruction', () => {
    const { cpu } = createCpu([0xAD, 0x00, 0xC0, 0xEA, 0xEA]);
    setIrqVector(cpu, 0x2000);
    cpu.p &= ~0x04;
    const state = { remaining: 0 };
    const instructions = [];

    clockScheduler(cpu, state, instructions); // LDA cycle 1
    clockScheduler(cpu, state, instructions); // LDA cycle 2
    clockScheduler(cpu, state, instructions); // LDA cycle 3: poll with IRQ low
    cpu.irqPending = true;
    clockScheduler(cpu, state, instructions); // LDA cycle 4: too late
    runUntil(cpu, state, () => cpu.pc === 0x2000, instructions);

    assert.deepEqual(instructions, [0xAD, 0xEA]);
});

test('RDY stalls store read cycles but not the final write cycle', () => {
    const { cpu, writes } = createCpu([0xA9, 0x55, 0x8D, 0x18, 0xD4, 0xEA]);
    const state = { remaining: 0 };

    clockScheduler(cpu, state); // LDA cycle 1
    clockScheduler(cpu, state); // LDA cycle 2
    clockScheduler(cpu, state); // STA cycle 1
    assert.equal(state.remaining, 3);
    cpu.rdy = false;

    clockScheduler(cpu, state);
    clockScheduler(cpu, state);
    assert.equal(state.remaining, 3);
    assert.deepEqual(writes, []);

    state.remaining = 1;
    clockScheduler(cpu, state);
    assert.equal(state.remaining, 0);
    assert.deepEqual(writes, [0x55]);
});

test('RDY does not stop NMOS RMW dummy and final writes', () => {
    const { cpu, writes } = createCpu([
        0xA9, 0x0F, 0x8D, 0x18, 0xD4,
        0xEE, 0x18, 0xD4, 0xEA
    ]);
    const state = { remaining: 0 };

    runUntil(cpu, state, () => writes.length === 1, null);
    runUntil(cpu, state, () => state.remaining === 0, null);
    clockScheduler(cpu, state); // INC $D418 cycle 1
    assert.equal(state.remaining, 5);
    cpu.rdy = false;

    clockScheduler(cpu, state);
    clockScheduler(cpu, state);
    assert.equal(state.remaining, 5);
    assert.deepEqual(writes, [0x0F]);

    state.remaining = 2;
    clockScheduler(cpu, state);
    assert.deepEqual(writes, [0x0F, 0x0F]);
    clockScheduler(cpu, state);
    assert.deepEqual(writes, [0x0F, 0x0F, 0x10]);
    assert.equal(state.remaining, 0);
});

test('LDA $DC0D samples and acknowledges the final read-cycle value', () => {
    const { cpu } = createCpu([0xAD, 0x0D, 0xDC, 0xEA]);
    const state = { remaining: 0 };
    clockScheduler(cpu, state);
    assert.equal(cpu.a, 0);
    assert.equal(cpu.pendingIcrReadTarget, 1);

    cpu.cia1Icr = 0x01;
    while (state.remaining > 0) clockScheduler(cpu, state);
    assert.equal(cpu.a, 0x01);
    assert.equal(cpu.cia1Icr, 0);
    assert.equal(cpu.hasPendingIcrRead, false);
});

function runCiaIrqProgram(latch) {
    const code = createCiaIrqProgram(latch);
    const writes = [];
    let cycle = -1;
    const sid = {
        regs: new Uint8Array(29),
        voices: [
            { waveOut8Bit: 0, env8Bit: 0 },
            { waveOut8Bit: 0, env8Bit: 0 },
            { waveOut8Bit: 0, env8Bit: 0 }
        ],
        writeReg(reg, value) {
            this.regs[reg] = value;
            if (reg === 24) writes.push({ cycle, value });
        },
        clock() {}
    };
    const cpu = new CPU6502(sid);
    cpu.reset(0x1000, code, 0x1000, 0x1200);
    cpu.push(0xFF);
    cpu.push(0xDF);
    cpu.pc = 0x1000;
    writes.length = 0;

    const state = { remaining: 0 };
    for (cycle = 0; cycle < 6000; cycle++) {
        cpu.clockHardware(1);
        clockScheduler(cpu, state);
    }
    const handlerWrites = writes.filter(event => event.value > 0).slice(0, 8);
    const periods = [];
    for (let i = 1; i < handlerWrites.length; i++) {
        periods.push(handlerWrites[i].cycle - handlerWrites[i - 1].cycle);
    }
    return periods;
}

function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
}

test('synthetic CIA IRQ program is pinned by content hash', () => {
    const digest = createHash('sha256').update(createCiaIrqProgram(2)).digest('hex');
    assert.equal(digest, CIA_IRQ_PROGRAM_SHA256);
    assert.equal(digest, timingFixture.externalReference.programSha256);
});

test('Phase 4 CPU/CIA program periods match the archived engine regression', () => {
    for (const key of Object.keys(timingFixture.engineRegression.periods)) {
        assert.deepEqual(
            runCiaIrqProgram(Number(key)),
            timingFixture.engineRegression.periods[key],
            `engine regression, latch ${key}`
        );
    }
});

test('long-latch engine periods stay within three cycles of external observations', () => {
    for (const latch of [100, 244]) {
        const enginePeriods = runCiaIrqProgram(latch);
        const reference = timingFixture.externalReference.observations[latch].periods;
        for (const period of enginePeriods) {
            const nearestError = Math.min(...reference.map(value => Math.abs(value - period)));
            assert.ok(nearestError <= 3, `latch ${latch}: ${period} vs ${reference}`);
        }
        assert.ok(
            Math.abs(median(enginePeriods) - median(reference)) <= 2,
            `latch ${latch}: median period drift`
        );
    }
});
