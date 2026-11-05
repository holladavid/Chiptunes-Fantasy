import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = join(ROOT, 'tracks/c64/SID_Emulation_Test.sid');
const LOAD_ADDRESS = 0x1000;
const SID_CLOCK = 985248;
const FRAME_RATE = 50;
const BASE_VOICE_HZ = 220;
const BASE_VOICE_WAVEFORM = 0x21;
const SWEEP_STEPS = 16;

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
        stepTicks: options.stepTicks ?? FRAME_RATE,
        stepCount: options.stepCount ?? 1,
        sweepTarget: options.sweepTarget ?? 0,
        sweepReverse: options.sweepReverse ? 1 : 0,
        retriggerEachStep: options.retriggerEachStep === false ? 0 : 1,
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

const adsrSweepTest = (name, sweepTarget, attackDecay, sustainRelease, sweepReverse = false) =>
    makeTest(`ADSR ${name}`, {
        hz: BASE_VOICE_HZ,
        waveform: BASE_VOICE_WAVEFORM,
        attackDecay,
        sustainRelease,
        releaseTicks: sweepTarget === 4 ? 10 : 0,
        stepTicks: 20,
        stepCount: SWEEP_STEPS,
        sweepTarget,
        sweepReverse
    });

// Jede Stufe wird neu angeschlagen. Slow-to-fast bei Attack/Decay/Release
// beginnt hoerbar im langsamsten Bereich und endet mit dem kuerzesten Impuls.
tests.push(adsrSweepTest('attack sweep slow to fast', 1, 0x06, 0x80, true));
tests.push(adsrSweepTest('decay sweep slow to fast', 2, 0x00, 0x00, true));
tests.push(adsrSweepTest('sustain sweep low to high', 3, 0x06, 0x00));
tests.push(adsrSweepTest('release sweep slow to fast', 4, 0x00, 0xF0, true));

const filterTest = (name, cutoff, resonance, mode, sweepTarget = 0) => makeTest(`Filter ${name}`, {
    hz: BASE_VOICE_HZ,
    waveform: BASE_VOICE_WAVEFORM,
    // Die Hüllkurve bleibt waehrend aller Filter-Sweeps statisch auf Vollpegel.
    attackDecay: 0x00,
    sustainRelease: 0xF0,
    cutoff,
    resonanceRouting: (resonance << 4) | 0x01,
    modeVolume: mode | 0x0F,
    stepTicks: sweepTarget ? 6 : FRAME_RATE,
    stepCount: sweepTarget ? SWEEP_STEPS : 1,
    sweepTarget,
    retriggerEachStep: false
});

tests.push(makeTest('Filter dry reference', {
    hz: BASE_VOICE_HZ,
    waveform: BASE_VOICE_WAVEFORM,
    attackDecay: 0x00,
    sustainRelease: 0xF0
}));
tests.push(filterTest('low-pass cutoff sweep / low resonance', 0, 2, 0x10, 5));
tests.push(filterTest('low-pass cutoff sweep / high resonance', 0, 12, 0x10, 5));
tests.push(filterTest('band-pass cutoff sweep', 0, 8, 0x20, 5));
tests.push(filterTest('high-pass cutoff sweep', 0, 8, 0x40, 5));
tests.push(filterTest('low + band-pass cutoff sweep', 0, 8, 0x30, 5));
tests.push(filterTest('low + high-pass cutoff sweep', 0, 8, 0x50, 5));
tests.push(filterTest('band + high-pass cutoff sweep', 0, 8, 0x60, 5));
tests.push(filterTest('all modes cutoff sweep', 0, 8, 0x70, 5));
tests.push(filterTest('low-pass resonance sweep', 0x300, 0, 0x10, 6));
tests.push(filterTest('band-pass resonance sweep', 0x300, 0, 0x20, 6));
tests.push(filterTest('high-pass resonance sweep', 0x300, 0, 0x40, 6));

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

if (tests.length !== 60) throw new Error(`Expected 60 tests, got ${tests.length}`);

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
assembler.emit(0xC6, 0x03); // DEC step timer
assembler.branch(0xD0, 'playDone');
assembler.emit(0xA6, 0x04); // LDX current test
assembler.emit(0xE6, 0x05); // INC sweep step
assembler.emit(0xA5, 0x05); // LDA sweep step
assembler.absolute(0xDD, 'stepCount'); // CMP stepCount,X
assembler.branch(0xB0, 'nextTest');
assembler.absolute(0x20, 'applyStep'); // Next sweep step of the same test
assembler.emit(0x60); // RTS

assembler.label('nextTest');
assembler.emit(0xA9, 0x00, 0x85, 0x05); // Reset sweep step
assembler.emit(0xE6, 0x04); // INC current test
assembler.emit(0xA5, 0x04, 0xC9, tests.length); // LDA current test / CMP test count
assembler.branch(0x90, 'applyCurrentTest');
assembler.emit(0xA9, 0x00, 0x85, 0x04); // Wrap to test zero

assembler.label('applyCurrentTest');
assembler.emit(0xA6, 0x04); // LDX current test
assembler.absolute(0x20, 'applyTest'); // JSR applyTest

assembler.label('playDone');
assembler.emit(0x60); // RTS

assembler.label('applyTest');
assembler.emit(0xA9, 0x00, 0x85, 0x05); // Start at sweep step zero
assembler.emit(0xA6, 0x04); // LDX current test
assembler.absolute(0xBD, 'stepTicks');
assembler.emit(0x85, 0x03); // STA step timer

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
assembler.absolute(0x20, 'applyStep');
assembler.emit(0x60); // RTS

// Ein Sweep besteht aus 16 gleich langen Stufen. Y enthaelt den aktuellen
// Nibble-Wert, X weiterhin den Testindex. Filter-Sweeps retrigger'n das Gate
// nicht; die ADSR-Sweeps tun dies bewusst bei jeder neuen Einstellung.
assembler.label('applyStep');
assembler.emit(0xA6, 0x04); // LDX current test
assembler.absolute(0xBD, 'stepTicks');
assembler.emit(0x85, 0x03); // Reset step timer
assembler.absolute(0xBD, 'releaseTicks');
assembler.emit(0x85, 0x02); // STA release timer
assembler.absolute(0xBD, 'sweepTarget');
assembler.branch(0xF0, 'noSweep'); // Kein Sweep in diesem Test
assembler.emit(0xA5, 0x05); // LDA sweep step
assembler.absolute(0xBC, 'sweepReverse'); // LDY sweepReverse,X
assembler.branch(0xF0, 'sweepValueReady');
assembler.emit(0x49, 0x0F); // EOR #15: reverse sweep
assembler.label('sweepValueReady');
assembler.emit(0xA8); // TAY
assembler.absolute(0xBD, 'sweepTarget');
assembler.emit(0xC9, 0x01); // Attack?
assembler.branch(0xF0, 'sweepAttack');
assembler.emit(0xC9, 0x02); // Decay?
assembler.branch(0xF0, 'sweepDecay');
assembler.emit(0xC9, 0x03); // Sustain?
assembler.branch(0xF0, 'sweepSustain');
assembler.emit(0xC9, 0x04); // Release?
assembler.branch(0xF0, 'sweepRelease');
assembler.emit(0xC9, 0x05); // Cutoff?
assembler.branch(0xF0, 'sweepCutoff');
assembler.emit(0xC9, 0x06); // Resonance?
assembler.branch(0xF0, 'sweepResonance');
assembler.absolute(0x4C, 'triggerVoice');
assembler.label('noSweep');
assembler.absolute(0x4C, 'triggerVoice');

assembler.label('sweepAttack');
assembler.emit(0x98, 0x0A, 0x0A, 0x0A, 0x0A, 0x85, 0x06); // Step << 4
assembler.absolute(0xBD, 'attackDecay');
assembler.emit(0x29, 0x0F, 0x05, 0x06, 0x8D, 0x05, 0xD4);
assembler.absolute(0x4C, 'triggerVoice');

assembler.label('sweepDecay');
assembler.absolute(0xBD, 'attackDecay');
assembler.emit(0x29, 0xF0, 0x85, 0x06); // Preserve attack nibble
assembler.emit(0x98, 0x05, 0x06, 0x8D, 0x05, 0xD4);
assembler.absolute(0x4C, 'triggerVoice');

assembler.label('sweepSustain');
assembler.emit(0x98, 0x0A, 0x0A, 0x0A, 0x0A, 0x85, 0x06); // Step << 4
assembler.absolute(0xBD, 'sustainRelease');
assembler.emit(0x29, 0x0F, 0x05, 0x06, 0x8D, 0x06, 0xD4);
assembler.absolute(0x4C, 'triggerVoice');

assembler.label('sweepRelease');
assembler.absolute(0xBD, 'sustainRelease');
assembler.emit(0x29, 0xF0, 0x85, 0x06); // Preserve sustain nibble
assembler.emit(0x98, 0x05, 0x06, 0x8D, 0x06, 0xD4);
assembler.absolute(0x4C, 'triggerVoice');

assembler.label('sweepCutoff');
assembler.emit(0xA9, 0x00, 0x8D, 0x15, 0xD4); // Cutoff low = 0
assembler.emit(0x98, 0x0A, 0x0A, 0x0A, 0x0A); // 16 steps x 128 cutoff units
assembler.emit(0x8D, 0x16, 0xD4);
assembler.absolute(0x4C, 'triggerVoice');

assembler.label('sweepResonance');
assembler.emit(0x98, 0x0A, 0x0A, 0x0A, 0x0A, 0x85, 0x06); // Step << 4
assembler.absolute(0xBD, 'resonanceRouting');
assembler.emit(0x29, 0x0F, 0x05, 0x06, 0x8D, 0x17, 0xD4);
assembler.absolute(0x4C, 'triggerVoice');

assembler.label('triggerVoice');
assembler.absolute(0xBD, 'retriggerEachStep');
assembler.branch(0xF0, 'stepDone');
assembler.absolute(0xBD, 'voice1Control');
assembler.emit(0x29, 0xFE, 0x8D, 0x04, 0xD4); // Gate off
assembler.absolute(0xBD, 'voice1Control');
assembler.emit(0x8D, 0x04, 0xD4); // Gate on
assembler.label('stepDone');
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
    releaseTicks: tests.map(test => test.releaseTicks),
    stepTicks: tests.map(test => test.stepTicks),
    stepCount: tests.map(test => test.stepCount),
    sweepTarget: tests.map(test => test.sweepTarget),
    sweepReverse: tests.map(test => test.sweepReverse),
    retriggerEachStep: tests.map(test => test.retriggerEachStep)
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
const sidImage = Buffer.concat([header, payload]);
const totalFrames = tests.reduce((sum, test) => sum + test.stepTicks * test.stepCount, 0);

export { tests, sidImage };

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
    writeFileSync(OUTPUT, sidImage);
    console.log(`Generated ${OUTPUT}`);
    console.log(`${tests.length} tests, ${totalFrames} PAL frames = ${(totalFrames / FRAME_RATE).toFixed(2)}s`);
    console.log(`PSID v2, init $${assembler.labels.get('init').toString(16)}, play $${assembler.labels.get('play').toString(16)}, ${code.length} code/data bytes`);
}
