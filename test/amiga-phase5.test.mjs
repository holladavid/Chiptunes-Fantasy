import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
    AMIGA_HARNESS_ROOT, loadAmigaTrack, createExactProcessor, renderExact,
    sameTaps, sha256
} from '../tools/lib/amiga-exact-harness.mjs';

const source = relative => readFileSync(path.join(AMIGA_HARNESS_ROOT, relative));
const sourceHash = relative => sha256(source(relative));
const report = relative => JSON.parse(source(relative));
const send = (processor, type) => processor.port.onmessage({ data: { type } });

const representatives = [
    ['COSO/HIPC', 'wings-of-death/Wings_Of_Death-Level_1.hipc'],
    ['HIP68K', 'wings-of-death/Wings_Of_Death-Title.hip'],
    ['MOD', 'ELYSIUM.MOD'],
    ['XM', 'space_debris.xm']
];

function transportState(processor) {
    return {
        isPlaying: processor.isPlaying,
        currentOrder: processor.currentOrder,
        currentRow: processor.currentRow,
        currentTick: processor.currentTick,
        samplesUntilNextTick: processor.samplesUntilNextTick,
        sampleCounter: processor.sampleCounter,
        currentFrame: processor.currentFrame,
        cosoPosition: processor.cosoVM?.position ?? null,
        ringIndex: processor.ringIndex,
        channels: processor.channels.slice(0, processor.numChannels).map(channel => ({
            audLc: channel.audLc,
            audLen: channel.audLen,
            audPer: channel.audPer,
            audVol: channel.audVol,
            audDat: channel.audDat,
            dmaEnabled: channel.dmaEnabled,
            curPtr: channel.curPtr,
            curLen: channel.curLen,
            loopPtr: channel.loopPtr,
            loopLen: channel.loopLen,
            isLooping: channel.isLooping,
            periodCounter: channel.periodCounter,
            bytePhase: channel.bytePhase,
            nextWord: channel.nextWord,
            heldValue: channel.heldValue
        }))
    };
}

for (const [name, input] of representatives) {
    test(`Phase-5-Transport ${name}: Pause ist stumm, friert den Zustand ein und setzt bitgleich fort`, async () => {
        const { track } = await loadAmigaTrack(input);
        const reference = createExactProcessor(track);
        const paused = createExactProcessor(track);

        const referenceBefore = renderExact(reference, { seconds: 0.3 });
        const pausedBefore = renderExact(paused, { seconds: 0.3 });
        assert.ok(sameTaps(referenceBefore, pausedBefore), 'Vor der Pause müssen beide Läufe übereinstimmen');

        const beforeStop = transportState(paused);
        send(paused, 'STOP_TRACK');
        assert.deepEqual(transportState(paused), { ...beforeStop, isPlaying: false },
            'STOP_TRACK darf DMA, Lautstärke oder Sequencerzustand nicht verändern');

        const silence = renderExact(paused, { seconds: 0.2, keepPcm: true });
        assert.deepEqual(transportState(paused), { ...beforeStop, isPlaying: false },
            'Während der Pause darf kein Emulationszustand fortschreiten');
        assert.ok(silence.pcm.a500.samples.every(sample => sample === 0),
            'Die komplette A500-Ausgabe muss während der Pause null sein');

        send(paused, 'RESUME_TRACK');
        const referenceAfter = renderExact(reference, { seconds: 0.5 });
        const pausedAfter = renderExact(paused, { seconds: 0.5 });
        assert.ok(sameTaps(referenceAfter, pausedAfter),
            'Resume muss exakt beim ununterbrochenen Referenzlauf fortsetzen');
    });
}

test('Phase-5-Filterzyklus: MOD E01 bleibt im Track-Modus erhalten', async () => {
    const { track } = await loadAmigaTrack('ELYSIUM.MOD');
    const processor = createExactProcessor(track);
    renderExact(processor, { seconds: 0.05 });
    assert.equal(processor.filterModeState, 0);
    assert.equal(processor.trackLedFilterOn, false, 'ELYSIUM.MOD beginnt mit ProTracker E01');
    assert.equal(processor.ledFilterOn, false);

    for (const expected of [
        { mode: 1, led: true },
        { mode: 2, led: false },
        { mode: 0, led: false }
    ]) {
        send(processor, 'CYCLE_FILTER');
        assert.equal(processor.filterModeState, expected.mode);
        assert.equal(processor.ledFilterOn, expected.led);
    }
});

test('Phase-5-Filterzyklus: XM-Standard und HIP68K-Bypass bleiben zustandssicher', async () => {
    const xm = createExactProcessor((await loadAmigaTrack('space_debris.xm')).track);
    assert.equal(xm.filterModeState, 0);
    assert.equal(xm.ledFilterOn, true);
    send(xm, 'CYCLE_FILTER');
    assert.equal(xm.filterModeState, 1);
    assert.equal(xm.ledFilterOn, true);
    send(xm, 'CYCLE_FILTER');
    assert.equal(xm.filterModeState, 2);
    assert.equal(xm.ledFilterOn, false);
    send(xm, 'CYCLE_FILTER');
    assert.equal(xm.filterModeState, 0);
    assert.equal(xm.ledFilterOn, true);

    const hip = createExactProcessor((await loadAmigaTrack('wings-of-death/Wings_Of_Death-Title.hip')).track);
    assert.equal(hip.filterModeState, 2);
    assert.equal(hip.ledFilterOn, false);
    for (const expected of [
        { mode: 0, led: false },
        { mode: 1, led: true },
        { mode: 2, led: false }
    ]) {
        send(hip, 'CYCLE_FILTER');
        assert.equal(hip.filterModeState, expected.mode);
        assert.equal(hip.ledFilterOn, expected.led);
    }
});

test('Phase-5-Produktionskorpus: vollständige Abnahme und aktuelle Provenienz', () => {
    const result = report('doc/verification/amiga/phase5-production-corpus.json');
    assert.equal(result.format, 'chiptunes-fantasy-amiga-phase5-production-v1');
    assert.equal(result.passed, true);
    assert.equal(result.workletSha256, sourceHash('js/worklets/amiga/paula-exact.js'));
    assert.equal(result.audioControllerSha256, sourceHash('js/audio/audio-controller.js'));
    assert.equal(result.registrySha256, sourceHash('js/worklets/registry.js'));
    assert.equal(result.corpus.trackCount, 45);
    assert.deepEqual(result.corpus.formatCounts, { HIPC: 35, MOD: 7, XM: 3 });
    assert.equal(result.corpus.tracks.length, 45);
    assert.ok(result.corpus.tracks.every(track => track.passed && track.finite &&
        track.deterministic && track.blockIndependent && track.restartIdentical));
    assert.deepEqual(result.corpus.silentA500Tracks, []);
    assert.equal(result.sampleRates.length, 12);
    assert.deepEqual([...new Set(result.sampleRates.map(run => run.sampleRate))].sort(), [44100, 48000, 96000]);
    assert.ok(result.sampleRates.every(run => run.passed && run.finite && run.deterministic));
    assert.equal(result.longRuns.length, 4);
    assert.ok(result.longRuns.every(run => run.passed && run.seconds === 60 && run.finite && run.deterministic));
    assert.equal(result.performance.withinOfflineRealTimeBudget, true);
    assert.ok(result.corpus.maximumOfflineRealTimeRatio < 1);
});

test('Phase-5-Browserabnahme: Desktop, Mobile, Master-DSP und UI sind bestanden', () => {
    const result = report('doc/verification/amiga/phase5-browser.json');
    assert.equal(result.format, 'chiptunes-fantasy-amiga-phase5-browser-v1');
    assert.equal(result.passed, true);
    assert.equal(result.workletSha256, sourceHash('js/worklets/amiga/paula-exact.js'));
    assert.equal(result.audioControllerSha256, sourceHash('js/audio/audio-controller.js'));
    assert.equal(result.registrySha256, sourceHash('js/worklets/registry.js'));
    assert.equal(result.engineRuns.length, 4);
    assert.deepEqual(result.engineRuns.map(run => [run.device, run.sampleRate]), [
        ['desktop', 44100], ['desktop', 48000], ['mobile', 44100], ['mobile', 48000]
    ]);
    assert.ok(result.engineRuns.every(run => run.passed && run.errors.length === 0 && run.tracks.length === 4));
    assert.ok(result.engineRuns.flatMap(run => run.tracks).every(track => track.passed &&
        track.finiteOutput && track.audible && track.masterPeakWithinCeiling &&
        track.rateMatches && track.contextRunning && track.filterCycleMatches));
    for (const run of result.engineRuns) {
        const elysium = run.tracks.find(track => track.path === 'ELYSIUM.MOD');
        assert.equal(elysium.initial.led, 0, 'Der titelseitige E01-Bypass muss im Browser sichtbar sein');
        assert.deepEqual(elysium.cycles.map(state => state.led), [1, 0, 0]);
    }
    assert.equal(result.uiRuns.length, 2);
    assert.ok(result.uiRuns.every(run => run.passed && run.errors.length === 0 &&
        run.filterCycleMatches && run.output.nonFinite === 0 && run.output.rms > 1e-5 &&
        run.output.peak <= 1.001));
});

test('Phase-5-Kommunikation: Exact und A500 werden ohne unkalibrierte Analogbehauptungen beschrieben', () => {
    const registry = source('js/worklets/registry.js').toString('utf8');
    assert.match(registry, /name: 'Paula 8364 \(Exact \/ A500\)'/);
    assert.doesNotMatch(registry, /192kHz True Analog/);

    const visualizer = source('js/ui/silicon/paula-8364.js').toString('utf8');
    const playlist = source('tracks/amiga/playlist.js').toString('utf8');
    for (const text of [visualizer, playlist]) {
        assert.doesNotMatch(text, /LF347|192\s*kHz|192k/i);
    }
    assert.match(visualizer, /LINEAR A500 · STATIC RC/);
    assert.match(visualizer, /4x HOST RATE/);

    const readme = source('README.md').toString('utf8');
    assert.match(readme, /four-times-host-rate Zero-Order Hold/);
    assert.match(readme, /linear A500 approximation/);
    assert.match(readme, /not a measured Amiga-mainboard calibration/);

    const controller = source('js/audio/audio-controller.js').toString('utf8');
    assert.match(controller, /export async function initAudioEngine\(sampleRate\)/);
    assert.match(controller, /sampleRate === undefined/);
});

test('Phase-5-Hot-Path: HIP68K und A500-Ausgabe bleiben im Dauerbetrieb heap-stabil', {
    skip: typeof globalThis.gc !== 'function' ? 'benötigt --expose-gc' : false
}, async () => {
    const { track } = await loadAmigaTrack('wings-of-death/Wings_Of_Death-Title.hip');
    const processor = createExactProcessor(track);
    const left = new Float32Array(128);
    const right = new Float32Array(128);
    const outputs = [[left, right]];
    const runBlocks = count => {
        for (let block = 0; block < count; block++) {
            if (!processor.process([], outputs)) throw new Error('Worklet stopped unexpectedly');
        }
    };

    runBlocks(4096);
    globalThis.gc();
    const before = process.memoryUsage().heapUsed;
    runBlocks(3750);
    globalThis.gc();
    const delta = process.memoryUsage().heapUsed - before;
    assert.ok(delta < 512 * 1024, `Heap-Zuwachs ${delta} Byte`);
});
