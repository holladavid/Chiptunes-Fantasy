import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = join(ROOT, 'tracks/c64/SID_Emulation_Test.sid');
const LOAD_ADDRESS = 0x1000;
const SID_CLOCK = 985248;
const TEST_SECONDS = 1;
const FRAME_RATE = 50;

class Assembler6502 {
    constructor(origin) {
        this.origin = origin;
        this.bytes = [];
        this.labels = new Map();
        this.fixups = [];
    }

    get address() {
        return this.origin + this.bytes.length;
    }

    label(name) {
        if (this.labels.has(name)) throw new Error(`Duplicate label: ${name}`);
        this.labels.set(name, this.address);
    }

    emit(...bytes) {
        this.bytes.push(...bytes);
    }

    absolute(opcode, label) {
        this.emit(opcode, 0, 0);
        this.fixups.push({ kind: 'absolute', label, offset: this.bytes.length - 2 });
    }

    branch(opcode, label) {
        this.emit(opcode, 0);
        this.fixups.push({ kind: 'relative', label, offset: this.bytes.length - 1 });
    }

    table(name, values) {
        this.label(name);
        this.emit(...values);
    }

    finish() {
        for (const fixup of this.fixups) {
            const target = this.labels.get(fixup.label);
            if (target === undefined) throw new Error(`Unknown label: ${fixup.label}`);
            if (fixup.kind === 'absolute') {
                this.bytes[fixup.offset] = target & 0xFF;
                this.bytes[fixup.offset + 1] = target >> 8;
            } else {
                const instructionEnd = this.origin + fixup.offset + 1;
                const displacement = target - instructionEnd;
                if (displacement < -128 || displacement > 127) {
                    throw new Error(`Branch to ${fixup.label} is out of range`);
                }
                this.bytes[fixup.offset] = displacement & 0xFF;
            }
        }
        return Uint8Array.from(this.bytes);
    }
}

function sidFrequency(hz) {
    return Math.round((hz * 0x1000000) / SID_CLOCK);
}

function makeTest(name, options = {}) {
    const frequency = sidFrequency(options.hz ?? 440);
    const secondFrequency = sidFrequency(options.voice2Hz ?? 660);
    return {
        name,
        frequency,
        control: options.waveform ?? 0x21,
        attackDecay: options.attackDecay ?? 0x00,
        sustainRelease: options.sustainRelease ?? 0xF0,
        pulseWidth: options.pulseWidth ?? 0x0800,
        cutoff: options.cutoff ?? 0x200,
        resonanceRouting: options.resonanceRouting ?? 0,
        modeVolume: options.modeVolume ?? 0x0F,
        releaseTicks: options.releaseTicks ?? 0,
        voice2Frequency: options.voice2Waveform === undefined ? 0 : secondFrequency,
        voice2Control: options.voice2Waveform ?? 0,
        voice2AttackDecay: options.voice2Waveform === undefined ? 0 : 0x00,
        voice2SustainRelease: options.voice2Waveform === undefined ? 0 : 0xF0,
        voice2PulseWidth: options.voice2PulseWidth ?? 0x0800
    };
}

const tests = [];
const frequencies = [110, 220, 440, 880, 1760];
const waveforms = [
    ['triangle', 0x11],
    ['sawtooth', 0x21],
    ['pulse', 0x41],
    ['noise', 0x81],
    ['triangle+sawtooth', 0x31],
    ['triangle+pulse', 0x51],
    ['sawtooth+pulse', 0x61],
    ['triangle+sawtooth+pulse', 0x71]
];

for (const [waveformName, waveform] of waveforms) {
    for (const hz of frequencies) {
        tests.push(makeTest(`${waveformName} ${hz} Hz`, { hz, waveform }));
    }
}

for (const [name, attackDecay, sustainRelease] of [
    ['fast attack / low sustain', 0x18, 0x20],
    ['medium attack / medium sustain', 0x48, 0xA6],
    ['slow attack / full sustain', 0x98, 0xF9],
    ['medium decay / medium sustain', 0x09, 0x84],
    ['instant attack / long release', 0x00, 0xF4]
]) {
    tests.push(makeTest(`ADSR ${name}`, {
        waveform: 0x41,
        attackDecay,
        sustainRelease,
        releaseTicks: 25
    }));
}

const filterTest = (name, cutoff, resonance, mode) => makeTest(`Filter ${name}`, {
    waveform: 0x21,
    cutoff,
    resonanceRouting: (resonance << 4) | 0x01,
    modeVolume: mode | 0x0F
});

tests.push(makeTest('Filter dry reference', { waveform: 0x21 }));
tests.push(filterTest('low-pass low cutoff', 0x040, 2, 0x10));
tests.push(filterTest('low-pass mid cutoff', 0x300, 2, 0x10));
tests.push(filterTest('low-pass high cutoff', 0x700, 2, 0x10));
tests.push(filterTest('band-pass', 0x300, 8, 0x20));
tests.push(filterTest('high-pass', 0x300, 8, 0x40));
tests.push(filterTest('low + band-pass', 0x300, 8, 0x30));
tests.push(filterTest('low + high-pass', 0x300, 8, 0x50));
tests.push(filterTest('band + high-pass', 0x300, 8, 0x60));
tests.push(filterTest('all modes', 0x300, 8, 0x70));
tests.push(filterTest('low-pass low resonance', 0x300, 1, 0x10));
tests.push(filterTest('low-pass high resonance', 0x300, 15, 0x10));

for (const [name, flags] of [
    ['independent voices', 0x00],
    ['hard sync', 0x02],
    ['ring modulation', 0x04],
    ['hard sync + ring modulation', 0x06]
]) {
    tests.push(makeTest(`Coupling ${name}`, {
        hz: 220,
        waveform: 0x21,
        voice2Hz: 440,
        voice2Waveform: 0x11 | flags | 0x01
    }));
}

if (tests.length !== 61) throw new Error(`Expected 61 tests, got ${tests.length}`);

const assembler = new Assembler6502(LOAD_ADDRESS);
assembler.label('init');
assembler.emit(0xA9, 0x00, 0x85, 0x04); // LDA #0 / STA step
assembler.emit(0xA9, FRAME_RATE, 0x85, 0x03); // LDA #50 / STA frame timer
assembler.emit(0xA2, 0x00); // LDX #0
assembler.absolute(0x20, 'applyTest'); // JSR applyTest
assembler.emit(0x60); // RTS

assembler.label('play');
assembler.emit(0xA5, 0x02); // LDA release timer
assembler.branch(0xF0, 'checkFrame');
assembler.emit(0xC6, 0x02); // DEC release timer
assembler.branch(0xD0, 'checkFrame');
assembler.emit(0xA6, 0x04); // LDX current test
assembler.absolute(0xBD, 'voice1Control'); // LDA voice1Control,X
assembler.emit(0x29, 0xFE, 0x8D, 0x04, 0xD4); // Clear gate / STA $D404

assembler.label('checkFrame');
assembler.emit(0xC6, 0x03); // DEC frame timer
assembler.branch(0xD0, 'playDone');
assembler.emit(0xA9, FRAME_RATE, 0x85, 0x03); // Reset frame timer
assembler.emit(0xE6, 0x04); // INC current test
assembler.emit(0xA5, 0x04, 0xC9, tests.length); // LDA step / CMP test count
assembler.branch(0x90, 'applyCurrentTest');
assembler.emit(0xA9, 0x00, 0x85, 0x04); // Wrap to test zero

assembler.label('applyCurrentTest');
assembler.emit(0xA6, 0x04); // LDX current test
assembler.absolute(0x20, 'applyTest'); // JSR applyTest

assembler.label('playDone');
assembler.emit(0x60); // RTS

assembler.label('applyTest');
assembler.absolute(0xBD, 'releaseTicks');
assembler.emit(0x85, 0x02); // STA release timer

for (const [table, register] of [
    ['frequencyLow', 0xD400],
    ['frequencyHigh', 0xD401],
    ['pulseLow', 0xD402],
    ['pulseHigh', 0xD403],
    ['attackDecay', 0xD405],
    ['sustainRelease', 0xD406]
]) {
    assembler.absolute(0xBD, table);
    assembler.emit(0x8D, register & 0xFF, register >> 8);
}

assembler.absolute(0xBD, 'voice1Control');
assembler.emit(0x29, 0xFE, 0x8D, 0x04, 0xD4); // Retrigger voice 1
assembler.absolute(0xBD, 'voice1Control');
assembler.emit(0x8D, 0x04, 0xD4);

for (const [table, register] of [
    ['voice2FrequencyLow', 0xD407],
    ['voice2FrequencyHigh', 0xD408],
    ['voice2PulseLow', 0xD409],
    ['voice2PulseHigh', 0xD40A],
    ['voice2AttackDecay', 0xD40C],
    ['voice2SustainRelease', 0xD40D]
]) {
    assembler.absolute(0xBD, table);
    assembler.emit(0x8D, register & 0xFF, register >> 8);
}

assembler.absolute(0xBD, 'voice2Control');
assembler.emit(0x29, 0xFE, 0x8D, 0x0B, 0xD4); // Retrigger voice 2
assembler.absolute(0xBD, 'voice2Control');
assembler.emit(0x8D, 0x0B, 0xD4);

assembler.absolute(0xBD, 'cutoffLow');
assembler.emit(0x8D, 0x15, 0xD4); // STA $D415
assembler.absolute(0xBD, 'cutoffHigh');
assembler.emit(0x8D, 0x16, 0xD4); // STA $D416
assembler.absolute(0xBD, 'resonanceRouting');
assembler.emit(0x8D, 0x17, 0xD4); // STA $D417
assembler.absolute(0xBD, 'modeVolume');
assembler.emit(0x8D, 0x18, 0xD4); // STA $D418
assembler.emit(0x60); // RTS

const tableValues = {
    frequencyLow: tests.map(test => test.frequency & 0xFF),
    frequencyHigh: tests.map(test => test.frequency >> 8),
    pulseLow: tests.map(test => test.pulseWidth & 0xFF),
    pulseHigh: tests.map(test => test.pulseWidth >> 8),
    attackDecay: tests.map(test => test.attackDecay),
    sustainRelease: tests.map(test => test.sustainRelease),
    voice1Control: tests.map(test => test.control),
    voice2FrequencyLow: tests.map(test => test.voice2Frequency & 0xFF),
    voice2FrequencyHigh: tests.map(test => test.voice2Frequency >> 8),
    voice2PulseLow: tests.map(test => test.voice2PulseWidth & 0xFF),
    voice2PulseHigh: tests.map(test => test.voice2PulseWidth >> 8),
    voice2AttackDecay: tests.map(test => test.voice2AttackDecay),
    voice2SustainRelease: tests.map(test => test.voice2SustainRelease),
    voice2Control: tests.map(test => test.voice2Control),
    cutoffLow: tests.map(test => test.cutoff & 0x07),
    cutoffHigh: tests.map(test => test.cutoff >> 3),
    resonanceRouting: tests.map(test => test.resonanceRouting),
    modeVolume: tests.map(test => test.modeVolume),
    releaseTicks: tests.map(test => test.releaseTicks)
};

for (const [name, values] of Object.entries(tableValues)) assembler.table(name, values);

const code = assembler.finish();
const header = Buffer.alloc(0x7C);
header.write('PSID', 0, 'ascii');
header.writeUInt16BE(2, 4);
header.writeUInt16BE(header.length, 6);
header.writeUInt16BE(0, 8);
header.writeUInt16BE(assembler.labels.get('init'), 10);
header.writeUInt16BE(assembler.labels.get('play'), 12);
header.writeUInt16BE(1, 14);
header.writeUInt16BE(1, 16);
header.writeUInt32BE(0, 18);
header.write('SID EMULATION TEST SUITE', 22, 'ascii');
header.write('Chiptunes Fantasy', 54, 'ascii');
header.write('2026', 86, 'ascii');

const payload = Buffer.concat([
    Buffer.from([LOAD_ADDRESS & 0xFF, LOAD_ADDRESS >> 8]),
    Buffer.from(code)
]);
writeFileSync(OUTPUT, Buffer.concat([header, payload]));

console.log(`Generated ${OUTPUT}`);
console.log(`${tests.length} tests x ${TEST_SECONDS}s = ${tests.length * TEST_SECONDS}s`);
console.log(`PSID v2, init $${assembler.labels.get('init').toString(16)}, play $${assembler.labels.get('play').toString(16)}, ${code.length} code/data bytes`);
