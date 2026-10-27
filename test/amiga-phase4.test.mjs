import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
    AMIGA_HARNESS_ROOT, loadAmigaTrack, createExactProcessor, renderExact,
    tapHashes, digitalTapHashes, nonFiniteSamples, sha256
} from '../tools/lib/amiga-exact-harness.mjs';

const WORKLET_PATH = path.join(AMIGA_HARNESS_ROOT, 'js/worklets/amiga/paula-exact.js');
const STATIC_CUTOFF = 4421;
const LED_CUTOFF = 3090;
const SAMPLE_RATES = [44100, 48000, 96000];

function loadA500Classes() {
    const source = readFileSync(WORKLET_PATH, 'utf8');
    const start = source.indexOf('class StaticRCFilter {');
    const end = source.indexOf('class PaulaChannel {');
    assert.ok(start >= 0 && end > start, 'A500-Klassen müssen aus dem Produktions-Worklet stammen');
    return new Function(`${source.slice(start, end)}\nreturn {
        StaticRCFilter,
        AmigaLEDFilter,
        A500ChannelFilter: typeof A500ChannelFilter === 'undefined' ? null : A500ChannelFilter
    };`)();
}

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

function makePcmTrack(pcm) {
    const data = new Uint8Array(4 * 6);
    data[3] = 0xFF;
    data[0] = 428 & 0xFF;
    data[1] = 428 >> 8;
    data[2] = 1;
    for (let offset = 6; offset < data.length; offset += 6) data[offset + 3] = 0xFF;
    return {
        isSequenced: true,
        type: 'MOD',
        linearFreq: false,
        songLength: 1,
        orderTable: new Uint8Array([0]),
        patterns: [{ numRows: 1, data }],
        bpm: 125,
        speed: 6,
        numChannels: 4,
        length: 6,
        samples: {
            mod_sample_1: {
                data: Int8Array.from(pcm), loopStart: 0, loopLen: pcm.length,
                baseVolume: 48, relNote: 0, finetune: 0, pan: 128
            }
        }
    };
}

function renderPcm(pcm, seconds = 0.05) {
    return renderExact(createExactProcessor(makePcmTrack(pcm)), {
        seconds, outputRate: 48000, blockSize: 128, keepPcm: true
    });
}

function maximumSuperpositionError(runs, tap) {
    let maximum = 0;
    const [a, b, sum] = runs.map(run => run.pcm[tap].samples);
    for (let index = 0; index < sum.length; index++) {
        maximum = Math.max(maximum, Math.abs(sum[index] - a[index] - b[index]));
    }
    return maximum;
}

for (const sampleRate of SAMPLE_RATES) {
    test(`A500 RC ${sampleRate} Hz: DC-Verstärkung 1 und etwa -3 dB bei 4421 Hz`, () => {
        const { StaticRCFilter } = loadA500Classes();
        const filter = new StaticRCFilter(sampleRate);
        assert.ok(Math.abs(rcResponse(filter, 0, sampleRate) - 1) < 1e-12);
        assert.ok(Math.abs(rcResponse(filter, STATIC_CUTOFF, sampleRate) - Math.SQRT1_2) < 0.015);
        assert.ok(rcResponse(filter, 10000, sampleRate) < rcResponse(filter, 1000, sampleRate));
    });

    test(`A500 LED ${sampleRate} Hz: DC-Verstärkung 1 und Butterworth-Knickfrequenz bei 3090 Hz`, () => {
        const { AmigaLEDFilter } = loadA500Classes();
        const filter = new AmigaLEDFilter(sampleRate);
        assert.ok(Math.abs(biquadResponse(filter, 0, sampleRate) - 1) < 1e-12);
        assert.ok(Math.abs(biquadResponse(filter, LED_CUTOFF, sampleRate) - Math.SQRT1_2) < 0.002);
        assert.ok(biquadResponse(filter, 10000, sampleRate) < biquadResponse(filter, 1000, sampleRate));
    });
}

test('A500 LED-Bypass: ausgeschaltetes Filter läuft zeitlich weiter und schaltet ohne alte History zurück', () => {
    const { A500ChannelFilter } = loadA500Classes();
    assert.equal(typeof A500ChannelFilter, 'function');
    const reference = new A500ChannelFilter(48000);
    const toggled = new A500ChannelFilter(48000);
    for (let index = 0; index < 8192; index++) {
        const input = Math.sin(index * 0.071) * 0.4 + Math.sin(index * 0.013) * 0.2;
        const expected = reference.process(input, true);
        const enabled = index < 2048 || index >= 4096;
        const actual = toggled.process(input, enabled);
        if (enabled) assert.equal(actual, expected, `Sample ${index}`);
    }
});

test('A500 Worklet: LED-Bypasswechsel entspricht nach dem Wiedereinschalten dem Dauerbetrieb', () => {
    const pcm = Int8Array.from({ length: 4096 }, (_, index) => (index * 19) % 121 - 60);
    const reference = createExactProcessor(makePcmTrack(pcm));
    const toggled = createExactProcessor(makePcmTrack(pcm));
    const blockSize = 128;
    for (let block = 0; block < 32; block++) {
        const enabled = block < 8 || block >= 16;
        toggled.ledFilterOn = enabled;
        const expected = [new Float32Array(blockSize), new Float32Array(blockSize)];
        const actual = [new Float32Array(blockSize), new Float32Array(blockSize)];
        reference.process([], [[expected[0], expected[1]]]);
        toggled.process([], [[actual[0], actual[1]]]);
        if (enabled) {
            // Der LED-Zustand ist sofort konsistent. Der 255-Tap-FIR enthält
            // dagegen erwartbar noch 64 Ausgabe-Frames aus der Bypass-Zeit.
            const start = block === 16 ? 64 : 0;
            assert.deepEqual(actual[0].slice(start), expected[0].slice(start), `linker Kanal, Block ${block}`);
            assert.deepEqual(actual[1].slice(start), expected[1].slice(start), `rechter Kanal, Block ${block}`);
        }
    }
});

test('A500 Kanalfilter: Superposition und Reset sind deterministisch', () => {
    const { A500ChannelFilter } = loadA500Classes();
    assert.equal(typeof A500ChannelFilter, 'function');
    for (const led of [false, true]) {
        const a = new A500ChannelFilter(48000);
        const b = new A500ChannelFilter(48000);
        const sum = new A500ChannelFilter(48000);
        for (let index = 0; index < 4096; index++) {
            const left = Math.sin(index * 0.037) * 0.2;
            const right = Math.cos(index * 0.113) * 0.1;
            const expected = a.process(left, led) + b.process(right, led);
            assert.ok(Math.abs(sum.process(left + right, led) - expected) < 1e-12);
        }
        sum.reset();
        const fresh = new A500ChannelFilter(48000);
        for (let index = 0; index < 128; index++) {
            const input = Math.sin(index * 0.17) * 0.3;
            assert.equal(sum.process(input, led), fresh.process(input, led));
        }
    }
});

test('A500 Gesamtkette: die reale Worklet-Ausgabe ist ohne willkürliche Sättigung überlagerungstreu', () => {
    const pcmA = Int8Array.from({ length: 4096 }, (_, index) => (index * 17) % 41 - 20);
    const pcmB = Int8Array.from({ length: 4096 }, (_, index) => (index * 29) % 31 - 15);
    const pcmSum = Int8Array.from({ length: 4096 }, (_, index) => pcmA[index] + pcmB[index]);
    const runs = [renderPcm(pcmA), renderPcm(pcmB), renderPcm(pcmSum)];
    for (const tap of ['paula', 'zoh', 'a500']) {
        const error = maximumSuperpositionError(runs, tap);
        assert.ok(error < 1e-6, `${tap} muss bis auf Float32-Quantisierung linear bleiben; maximaler Fehler ${error}`);
    }
});

test('A500 Crosstalk: 3,5 % erscheinen erst am ZOH-Abgriff, nicht in der digitalen Paula-Summe', () => {
    const pcm = Int8Array.from({ length: 4096 }, (_, index) => (index * 11) % 101 - 50);
    const run = renderPcm(pcm);
    const paula = run.pcm.paula.samples;
    const zoh = run.pcm.zoh.samples;
    for (let frame = 0; frame < run.frames * 4; frame++) {
        const left = paula[frame * 2];
        const right = paula[frame * 2 + 1];
        assert.equal(right, 0);
        assert.ok(Math.abs(zoh[frame * 2] - left * 0.965) < 1e-7);
        assert.ok(Math.abs(zoh[frame * 2 + 1] - left * 0.035) < 1e-7);
    }
});

for (const name of ['level1', 'hip68k', 'mod', 'xm']) {
    test(`Phase-4-Exact ${name}: A500-Regressionsanker und bitgleiche digitale Phase-3-Eingänge`, async () => {
        const report = JSON.parse(readFileSync(path.join(
            AMIGA_HARNESS_ROOT, `doc/verification/amiga/phase4-exact-${name}.json`
        ), 'utf8'));
        const previous = JSON.parse(readFileSync(path.join(
            AMIGA_HARNESS_ROOT, `doc/verification/amiga/phase3-exact-${name}.json`
        ), 'utf8'));
        const loaded = await loadAmigaTrack(report.input);
        assert.equal(sha256(loaded.bytes), report.tuneSha256);
        assert.equal(report.workletSha256, sha256(readFileSync(WORKLET_PATH)));
        const run = renderExact(createExactProcessor(loaded.track), {
            seconds: report.seconds, outputRate: report.sampleRate, blockSize: report.blockSize
        });
        assert.equal(nonFiniteSamples(run), 0);
        assert.deepEqual(tapHashes(run), tapHashes(report.runs[0]));
        assert.deepEqual(digitalTapHashes(run), digitalTapHashes(previous.runs[0]));
        assert.equal(report.deterministic, true);
        assert.equal(report.finite, true);
        assert.equal(report.blockComparison.bitIdentical, true);
        assert.equal(report.restartComparison.bitIdenticalToFreshWorklet, true);
    });
}

test('Phase-4-Charakterisierung: Filter, LED-Bypass und Superposition sind reproduzierbar', () => {
    const report = JSON.parse(readFileSync(path.join(
        AMIGA_HARNESS_ROOT, 'doc/verification/amiga/phase4-a500-characterization.json'
    ), 'utf8'));
    assert.equal(report.workletSha256, sha256(readFileSync(WORKLET_PATH)));
    assert.deepEqual(report.filters.map(filter => filter.sampleRate), SAMPLE_RATES);
    assert.equal(report.ledBypass.bitIdenticalToContinuousLed, true);
    assert.equal(report.ledBypass.maximumAbsoluteError, 0);
    assert.equal(report.superposition.passed, true);
    assert.equal(report.passed, true);
});

test('Phase-4-MOD/XM-Korpus: alle digitalen Phase-3-Hashes bleiben unverändert', () => {
    const report = JSON.parse(readFileSync(path.join(
        AMIGA_HARNESS_ROOT, 'doc/verification/amiga/phase4-modxm-corpus.json'
    ), 'utf8'));
    const previous = JSON.parse(readFileSync(path.join(
        AMIGA_HARNESS_ROOT, 'doc/verification/amiga/phase3-modxm-corpus.json'
    ), 'utf8'));
    assert.equal(report.workletSha256, sha256(readFileSync(WORKLET_PATH)));
    assert.equal(report.trackCount, 10);
    assert.equal(report.finite, true);
    for (let index = 0; index < report.tracks.length; index++) {
        assert.equal(report.tracks[index].path, previous.tracks[index].path);
        assert.equal(report.tracks[index].tuneSha256, previous.tracks[index].tuneSha256);
        assert.deepEqual(
            report.tracks[index].taps.filter(tap => tap.id !== 'a500').map(tap => [tap.id, tap.sha256]),
            previous.tracks[index].taps.filter(tap => tap.id !== 'a500').map(tap => [tap.id, tap.sha256])
        );
    }
});
