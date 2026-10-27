// Characterize the real A500 output-stage classes and production worklet.
//   node tools/amiga-a500-characterize.mjs \
//     --report doc/verification/amiga/phase4-a500-characterization.json
// These are model/regression measurements, not hardware or UADE truth proofs.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
    AMIGA_HARNESS_ROOT, createExactProcessor, renderExact, sha256
} from './lib/amiga-exact-harness.mjs';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
    const key = process.argv[index];
    if (!key?.startsWith('--') || index + 1 >= process.argv.length) throw new Error(`Ungültiges Argument: ${key}`);
    args.set(key.slice(2), process.argv[index + 1]);
}

const workletPath = path.join(AMIGA_HARNESS_ROOT, 'js/worklets/amiga/paula-exact.js');
const source = readFileSync(workletPath, 'utf8');
const start = source.indexOf('class StaticRCFilter {');
const end = source.indexOf('class PaulaChannel {');
if (start < 0 || end <= start) throw new Error('A500-Klassen wurden im Produktions-Worklet nicht gefunden');
const { StaticRCFilter, AmigaLEDFilter, A500ChannelFilter } = new Function(`${source.slice(start, end)}
return { StaticRCFilter, AmigaLEDFilter, A500ChannelFilter };`)();

function biquadResponse(filter, frequency, sampleRate) {
    const omega = 2 * Math.PI * frequency / sampleRate;
    const cos1 = Math.cos(omega);
    const sin1 = Math.sin(omega);
    const cos2 = Math.cos(2 * omega);
    const sin2 = Math.sin(2 * omega);
    const numeratorReal = filter.b0 + filter.b1 * cos1 + filter.b2 * cos2;
    const numeratorImag = -filter.b1 * sin1 - filter.b2 * sin2;
    const denominatorReal = 1 + filter.a1 * cos1 + filter.a2 * cos2;
    const denominatorImag = -filter.a1 * sin1 - filter.a2 * sin2;
    return Math.hypot(numeratorReal, numeratorImag) / Math.hypot(denominatorReal, denominatorImag);
}

function rcResponse(filter, frequency, sampleRate) {
    const omega = 2 * Math.PI * frequency / sampleRate;
    const denominatorReal = 1 - filter.alpha * Math.cos(omega);
    const denominatorImag = filter.alpha * Math.sin(omega);
    return (1 - filter.alpha) / Math.hypot(denominatorReal, denominatorImag);
}

const decibels = value => 20 * Math.log10(value);
const responseRecord = (magnitudeAtDc, magnitudeAtCutoff, magnitudeAt10Khz) => ({
    dcMagnitude: magnitudeAtDc,
    cutoffMagnitude: magnitudeAtCutoff,
    cutoffDb: decibels(magnitudeAtCutoff),
    tenKhzMagnitude: magnitudeAt10Khz,
    tenKhzDb: decibels(magnitudeAt10Khz)
});

const filters = [44100, 48000, 96000].map(sampleRate => {
    const rc = new StaticRCFilter(sampleRate);
    const led = new AmigaLEDFilter(sampleRate);
    return {
        sampleRate,
        rc: responseRecord(
            rcResponse(rc, 0, sampleRate),
            rcResponse(rc, 4421, sampleRate),
            rcResponse(rc, 10000, sampleRate)
        ),
        led: responseRecord(
            biquadResponse(led, 0, sampleRate),
            biquadResponse(led, 3090, sampleRate),
            biquadResponse(led, 10000, sampleRate)
        )
    };
});

const reference = new A500ChannelFilter(48000);
const toggled = new A500ChannelFilter(48000);
let ledBypassMaximumError = 0;
let ledBypassComparedFrames = 0;
for (let index = 0; index < 8192; index++) {
    const input = Math.sin(index * 0.071) * 0.4 + Math.sin(index * 0.013) * 0.2;
    const expected = reference.process(input, true);
    const enabled = index < 2048 || index >= 4096;
    const actual = toggled.process(input, enabled);
    if (enabled) {
        ledBypassMaximumError = Math.max(ledBypassMaximumError, Math.abs(actual - expected));
        ledBypassComparedFrames++;
    }
}

function makePcmTrack(pcm) {
    const data = new Uint8Array(4 * 6);
    data[0] = 428 & 0xFF;
    data[1] = 428 >> 8;
    data[2] = 1;
    data[3] = 0xFF;
    for (let offset = 6; offset < data.length; offset += 6) data[offset + 3] = 0xFF;
    return {
        isSequenced: true, type: 'MOD', linearFreq: false,
        songLength: 1, orderTable: new Uint8Array([0]),
        patterns: [{ numRows: 1, data }], bpm: 125, speed: 6,
        numChannels: 4, length: 6,
        samples: {
            mod_sample_1: {
                data: Int8Array.from(pcm), loopStart: 0, loopLen: pcm.length,
                baseVolume: 48, relNote: 0, finetune: 0, pan: 128
            }
        }
    };
}

function renderPcm(pcm) {
    return renderExact(createExactProcessor(makePcmTrack(pcm)), {
        seconds: 0.05, outputRate: 48000, blockSize: 128, keepPcm: true
    });
}

const pcmA = Int8Array.from({ length: 4096 }, (_, index) => (index * 17) % 41 - 20);
const pcmB = Int8Array.from({ length: 4096 }, (_, index) => (index * 29) % 31 - 15);
const pcmSum = Int8Array.from({ length: 4096 }, (_, index) => pcmA[index] + pcmB[index]);
const runs = [renderPcm(pcmA), renderPcm(pcmB), renderPcm(pcmSum)];
const superpositionTaps = {};
for (const tap of ['paula', 'zoh', 'a500']) {
    const [a, b, sum] = runs.map(run => run.pcm[tap].samples);
    let maximumAbsoluteError = 0;
    for (let index = 0; index < sum.length; index++) {
        maximumAbsoluteError = Math.max(maximumAbsoluteError, Math.abs(sum[index] - a[index] - b[index]));
    }
    superpositionTaps[tap] = { maximumAbsoluteError };
}

const tolerance = 1e-6;
const report = {
    format: 'chiptunes-fantasy-amiga-phase4-a500-characterization-v1',
    workletSha256: sha256(readFileSync(workletPath)),
    referenceStatus: 'Self-measured linear model characterization only; no hardware or UADE truth claim.',
    model: {
        staticRc: { cutoffHz: 4421, topology: 'one-pole exponential RC approximation' },
        led: { cutoffHz: 3090, q: 0.707, topology: 'RBJ biquad low-pass approximation', continuousWhileBypassed: true },
        crosstalk: 0.035,
        firTaps: 255,
        outputGain: 0.7,
        removedUncalibratedNonlinearities: ['LF347OpAmpStage tanh slew limiter', 'final tanh saturation']
    },
    filters,
    ledBypass: {
        frames: 8192,
        comparedEnabledFrames: ledBypassComparedFrames,
        disabledRange: [2048, 4096],
        maximumAbsoluteError: ledBypassMaximumError,
        bitIdenticalToContinuousLed: ledBypassMaximumError === 0
    },
    superposition: {
        seconds: 0.05,
        sampleRate: 48000,
        pcmStorage: 'Float32',
        tolerance,
        taps: superpositionTaps,
        passed: Object.values(superpositionTaps).every(tap => tap.maximumAbsoluteError < tolerance)
    }
};
report.passed = report.superposition.passed && report.ledBypass.bitIdenticalToContinuousLed;

const filename = path.resolve(AMIGA_HARNESS_ROOT, args.get('report') || 'doc/verification/amiga/phase4-a500-characterization.json');
mkdirSync(path.dirname(filename), { recursive: true });
writeFileSync(filename, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
