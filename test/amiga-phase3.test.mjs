import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
    AMIGA_HARNESS_ROOT, loadAmigaTrack, createExactProcessor, renderExact,
    tapHashes, nonFiniteSamples
} from '../tools/lib/amiga-exact-harness.mjs';

function makeTrack(type = 'MOD', numChannels = 4, numRows = 4) {
    const data = new Uint8Array(numRows * numChannels * 6);
    data.fill(0);
    for (let offset = 0; offset < data.length; offset += 6) data[offset + 3] = 0xFF;
    const pcm = Int8Array.from({ length: 16384 }, (_, index) => (index * 7) % 200 - 100);
    const sample = {
        data: pcm,
        loopStart: 0,
        loopLen: pcm.length,
        baseVolume: 32,
        relNote: 0,
        finetune: 0,
        pan: 128
    };
    return {
        isSequenced: true,
        type,
        linearFreq: type === 'XM',
        songLength: 1,
        orderTable: new Uint8Array([0]),
        patterns: [{ numRows, data }],
        bpm: 125,
        speed: 4,
        numChannels,
        length: numRows * 4,
        samples: { [`${type.toLowerCase()}_sample_1`]: sample }
    };
}

function setCell(track, row, channel, {
    note = 0, sample = 0, volume = 0xFF, effect = 0, param = 0
} = {}) {
    const offset = (row * track.numChannels + channel) * 6;
    const data = track.patterns[0].data;
    data[offset] = note & 0xFF;
    data[offset + 1] = (note >> 8) & 0xFF;
    data[offset + 2] = sample;
    data[offset + 3] = volume;
    data[offset + 4] = effect;
    data[offset + 5] = param;
}

function tick(processor, count = 1) {
    for (let index = 0; index < count; index++) processor.processTrackerTick(0);
}

function digitalFrame(track) {
    const processor = createExactProcessor(track);
    const run = renderExact(processor, {
        seconds: 1 / 48000, outputRate: 48000, blockSize: 1, keepPcm: true
    });
    return {
        processor,
        left: run.pcm.paula.samples[0],
        right: run.pcm.paula.samples[1]
    };
}

test('MOD: Arpeggio läuft auf den Folgeticks und kehrt im Zyklus zur Basisperiode zurück', () => {
    const track = makeTrack();
    setCell(track, 0, 0, { note: 428, sample: 1, effect: 0x00, param: 0x47 });
    const processor = createExactProcessor(track);
    const channel = processor.channels[0];
    tick(processor);
    assert.equal(channel.audPer, 428);
    tick(processor);
    assert.equal(channel.audPer, Math.round(428 * Math.pow(2, -4 / 12)));
    tick(processor);
    assert.equal(channel.audPer, Math.round(428 * Math.pow(2, -7 / 12)));
    tick(processor);
    assert.equal(channel.audPer, 428);
});

test('MOD: Portamento up/down und Tone-Portamento werden auf Folgeticks ausgeführt', () => {
    const up = makeTrack();
    setCell(up, 0, 0, { note: 428, sample: 1, effect: 0x01, param: 4 });
    const upProcessor = createExactProcessor(up);
    tick(upProcessor, 2);
    assert.equal(upProcessor.channels[0].audPer, 424);
    tick(upProcessor);
    assert.equal(upProcessor.channels[0].audPer, 420);

    const tone = makeTrack();
    setCell(tone, 0, 0, { note: 428, sample: 1 });
    setCell(tone, 1, 0, { note: 214, effect: 0x03, param: 8 });
    const toneProcessor = createExactProcessor(tone);
    tick(toneProcessor, 5);
    assert.equal(toneProcessor.channels[0].targetPeriod, 214);
    assert.equal(toneProcessor.channels[0].audPer, 428);
    tick(toneProcessor);
    assert.equal(toneProcessor.channels[0].audPer, 420);
});

test('MOD/XM: Volume-Slide besitzt Effektspeicher und verändert die logische Lautstärke', () => {
    for (const type of ['MOD', 'XM']) {
        const track = makeTrack(type);
        setCell(track, 0, 0, { note: type === 'XM' ? 49 : 428, sample: 1, effect: 0x0A, param: 0x02 });
        const processor = createExactProcessor(track);
        tick(processor);
        assert.equal(processor.channels[0].audVol, 32);
        tick(processor);
        assert.equal(processor.channels[0].audVol, 30);
        tick(processor);
        assert.equal(processor.channels[0].audVol, 28);
        assert.equal(processor.channels[0].trackVolume, 28);
    }
});

test('MOD: Vibrato verwendet die Sinusphase auf Folgeticks, ohne die Basisperiode zu verändern', () => {
    const track = makeTrack();
    setCell(track, 0, 0, { note: 428, sample: 1, effect: 0x04, param: 0x42 });
    const processor = createExactProcessor(track);
    const channel = processor.channels[0];
    tick(processor);
    assert.equal(channel.audPer, 428);
    tick(processor);
    assert.equal(channel.vibratoPhase, 4);
    assert.equal(channel.audPer, Math.round(428 + Math.sin(4 * Math.PI / 32) * 4));
    assert.equal(channel.basePeriod, 428);
});

test('MOD: Kombinierte Effekte 5 und 6 führen Pitch- und Volume-Anteil gemeinsam aus', () => {
    const tone = makeTrack();
    setCell(tone, 0, 0, { note: 428, sample: 1, effect: 0x03, param: 8 });
    setCell(tone, 1, 0, { note: 214, effect: 0x05, param: 0x02 });
    const toneProcessor = createExactProcessor(tone);
    tick(toneProcessor, 6);
    assert.equal(toneProcessor.channels[0].audPer, 420);
    assert.equal(toneProcessor.channels[0].audVol, 30);

    const vibrato = makeTrack();
    setCell(vibrato, 0, 0, { note: 428, sample: 1, effect: 0x04, param: 0x42 });
    setCell(vibrato, 1, 0, { effect: 0x06, param: 0x02 });
    const vibratoProcessor = createExactProcessor(vibrato);
    tick(vibratoProcessor, 6);
    assert.equal(vibratoProcessor.channels[0].vibratoPhase, 16);
    assert.equal(vibratoProcessor.channels[0].audVol, 30);
    assert.equal(vibratoProcessor.channels[0].basePeriod, 428);
});

test('MOD: Tremolo verändert nur die momentane Ausgabelautstärke', () => {
    const track = makeTrack();
    setCell(track, 0, 0, { note: 428, sample: 1, effect: 0x07, param: 0x42 });
    const processor = createExactProcessor(track);
    const channel = processor.channels[0];
    tick(processor);
    assert.equal(channel.audVol, 32);
    tick(processor);
    assert.equal(channel.tremoloPhase, 4);
    assert.equal(channel.audVol, Math.round(32 + Math.sin(4 * Math.PI / 32) * 8));
    assert.equal(channel.trackVolume, 32);
});

test('XM: lineare Frequenzen bestimmen Noten und kontinuierliche Pitch-Slides', () => {
    const track = makeTrack('XM');
    setCell(track, 0, 0, { note: 49, sample: 1, effect: 0x01, param: 1 });
    const processor = createExactProcessor(track);
    const channel = processor.channels[0];
    tick(processor);
    assert.equal(channel.audPer, 424, 'C-4: 8363 Hz bei PAL 3546895 Hz');
    tick(processor);
    assert.equal(channel.currentNote, 49 + 1 / 16);
    assert.equal(channel.audPer, 423);

    const low = makeTrack('XM');
    setCell(low, 0, 0, { note: 1, sample: 1 });
    const lowProcessor = createExactProcessor(low);
    tick(lowProcessor);
    assert.equal(lowProcessor.channels[0].audPer, 6786, 'tiefe lineare XM-Noten dürfen nicht auf 856 begrenzt werden');
});

test('MOD/XM: Sample-Offset startet beim adressierten DMA-Wort und besitzt Effektspeicher', () => {
    for (const type of ['MOD', 'XM']) {
        const track = makeTrack(type);
        setCell(track, 0, 0, { note: type === 'XM' ? 49 : 428, sample: 1, effect: 0x09, param: 2 });
        const processor = createExactProcessor(track);
        const channel = processor.channels[0];
        tick(processor);
        assert.equal(channel.sampleOffset, 512);
        assert.equal(channel.curPtr, 514);
        assert.equal(channel.heldValue, channel.dataBuffer[512]);
    }
});

test('XM: Sample-, Effekt- und Volume-Column-Panning steuern die Stereomischung', () => {
    const right = makeTrack('XM');
    right.samples.xm_sample_1.pan = 255;
    setCell(right, 0, 0, { note: 49, sample: 1 });
    const rightFrame = digitalFrame(right);
    assert.equal(rightFrame.processor.channels[0].pan, 1);
    assert.ok(Math.abs(rightFrame.left) < 1e-12);
    assert.ok(Math.abs(rightFrame.right) > 0);

    const center = makeTrack('XM');
    setCell(center, 0, 0, { note: 49, sample: 1 });
    const centerFrame = digitalFrame(center);
    assert.ok(Math.abs(centerFrame.left / centerFrame.right - 127 / 128) < 1e-6);
    assert.ok(Math.abs(centerFrame.right / rightFrame.right - 128 / 255) < 1e-6);

    const effect = makeTrack('XM');
    setCell(effect, 0, 0, { note: 49, sample: 1, effect: 0x08, param: 0 });
    const effectFrame = digitalFrame(effect);
    assert.ok(Math.abs(effectFrame.left) > 0);
    assert.ok(Math.abs(effectFrame.right) < 1e-12);

    const column = makeTrack('XM');
    setCell(column, 0, 0, { note: 49, sample: 1, volume: 0xCF });
    const columnFrame = digitalFrame(column);
    assert.ok(Math.abs(columnFrame.left) < 1e-12);
    assert.ok(Math.abs(columnFrame.right) > 0);
});

test('MOD: ohne XM-Panning bleibt das physische L-R-R-L-Panning erhalten', () => {
    const track = makeTrack('MOD');
    setCell(track, 0, 0, { note: 428, sample: 1 });
    const frame = digitalFrame(track);
    assert.ok(Math.abs(frame.left) > 0);
    assert.equal(frame.right, 0);
    assert.equal(frame.processor.channels[0].pan, -1);
});

test('XM: Globalvolume skaliert die digitale Summe und wird auf 64 initialisiert', () => {
    const full = makeTrack('XM');
    setCell(full, 0, 0, { note: 49, sample: 1 });
    const half = makeTrack('XM');
    setCell(half, 0, 0, { note: 49, sample: 1, effect: 0x10, param: 32 });
    const fullFrame = digitalFrame(full);
    const halfFrame = digitalFrame(half);
    assert.equal(fullFrame.processor.globalVolume, 64);
    assert.equal(halfFrame.processor.globalVolume, 32);
    assert.ok(Math.abs(halfFrame.right / fullFrame.right - 0.5) < 1e-6);
});

test('XM: 16/24/32 Kanäle behalten die bestehende sqrt(4/N)-Mischdämpfung', () => {
    const reference = makeTrack('XM', 4, 1);
    setCell(reference, 0, 0, { note: 49, sample: 1 });
    const base = digitalFrame(reference).right;
    for (const channels of [16, 24, 32]) {
        const track = makeTrack('XM', channels, 1);
        setCell(track, 0, 0, { note: 49, sample: 1 });
        const frame = digitalFrame(track);
        assert.ok(Math.abs(frame.right / base - Math.sqrt(4 / channels)) < 1e-6);
        assert.ok(Number.isFinite(frame.left) && Number.isFinite(frame.right));
    }
});

test('XM: variable Patternlängen steuern den Zeilen- und Orderwechsel', () => {
    const track = makeTrack('XM', 16, 2);
    track.speed = 1;
    const processor = createExactProcessor(track);
    tick(processor, 2);
    assert.equal(processor.currentOrder, 1);
    assert.equal(processor.currentRow, 0);
    tick(processor);
    assert.equal(processor.currentOrder, 0, 'Order-Wrap am Songanfang');
    assert.equal(processor.currentRow, 1);
});

for (const item of [
    { name: 'level1', input: 'wings-of-death/Wings_Of_Death-Level_1.hipc', phase2: true, seconds: 1 },
    { name: 'hip68k', input: 'wings-of-death/Wings_Of_Death-Title.hip', phase2: true, seconds: 1 },
    { name: 'mod', input: 'GSLINGER.MOD', phase2: false, seconds: 5 },
    { name: 'xm', input: 'space_debris.xm', phase2: false, seconds: 1 }
]) {
    test(`Phase-3-Exact ${item.name}: Regression, Neustart und Provenienz`, async () => {
        const report = JSON.parse(readFileSync(path.join(
            AMIGA_HARNESS_ROOT, `doc/verification/amiga/phase3-exact-${item.name}.json`
        ), 'utf8'));
        const loaded = await loadAmigaTrack(report.input);
        const worklet = readFileSync(path.join(AMIGA_HARNESS_ROOT, 'js/worklets/amiga/paula-exact.js'));
        const { sha256 } = await import('../tools/lib/amiga-exact-harness.mjs');
        assert.equal(sha256(loaded.bytes), report.tuneSha256);
        assert.equal(sha256(worklet), report.workletSha256);
        const run = renderExact(createExactProcessor(loaded.track), {
            seconds: report.seconds, outputRate: report.sampleRate, blockSize: report.blockSize
        });
        assert.equal(nonFiniteSamples(run), 0);
        assert.deepEqual(tapHashes(run), tapHashes(report.runs[0]));
        assert.equal(report.deterministic, true);
        assert.equal(report.blockComparison.bitIdentical, true);
        assert.equal(report.restartComparison.bitIdenticalToFreshWorklet, true);
        if (item.phase2) {
            const previous = JSON.parse(readFileSync(path.join(
                AMIGA_HARNESS_ROOT, `doc/verification/amiga/phase2-exact-${item.name}.json`
            ), 'utf8'));
            assert.deepEqual(tapHashes(run), tapHashes(previous.runs[0]), 'COSO/HIP68K darf sich in Phase 3 nicht ändern');
        }
    });
}

test('Phase-3-Korpus: alle zehn realen MOD/XM-Titel sind endlich und vollständig erfasst', () => {
    const report = JSON.parse(readFileSync(path.join(
        AMIGA_HARNESS_ROOT, 'doc/verification/amiga/phase3-modxm-corpus.json'
    ), 'utf8'));
    const worklet = readFileSync(path.join(AMIGA_HARNESS_ROOT, 'js/worklets/amiga/paula-exact.js'));
    assert.equal(report.trackCount, 10);
    assert.equal(report.finite, true);
    assert.equal(report.tracks.filter(track => track.type === 'MOD').length, 7);
    assert.equal(report.tracks.filter(track => track.type === 'XM').length, 3);
    assert.deepEqual(report.tracks.filter(track => track.type === 'XM').map(track => track.channels).sort((a, b) => a - b), [16, 24, 32]);
    assert.equal(report.tracks.every(track => track.nonFiniteSamples === 0), true);
    return import('../tools/lib/amiga-exact-harness.mjs').then(({ sha256 }) => {
        assert.equal(sha256(worklet), report.workletSha256);
    });
});
