import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
    AMIGA_HARNESS_ROOT, loadAmigaTrack, createExactProcessor, startExactTrack,
    renderExact, tapHashes, nonFiniteSamples, sha256
} from '../tools/lib/amiga-exact-harness.mjs';

const CASES = [
    { name: 'level1', input: 'wings-of-death/Wings_Of_Death-Level_1.hipc', seconds: 1 },
    { name: 'hip68k', input: 'wings-of-death/Wings_Of_Death-Title.hip', seconds: 1 },
    { name: 'mod', input: 'GSLINGER.MOD', seconds: 5 },
    { name: 'xm', input: 'space_debris.xm', seconds: 1 }
];

function loadPaulaChannel() {
    const filename = path.join(AMIGA_HARNESS_ROOT, 'js/worklets/amiga/paula-exact.js');
    const source = readFileSync(filename, 'utf8');
    const start = source.indexOf('class PaulaChannel {');
    const end = source.indexOf('class PaulaProcessor');
    assert.ok(start >= 0 && end > start, 'PaulaChannel muss aus dem Produktions-Worklet stammen');
    return new Function(`${source.slice(start, end)}\nreturn PaulaChannel;`)();
}

function digitalState(channel) {
    return {
        dmaEnabled: channel.dmaEnabled,
        audLc: channel.audLc,
        audLen: channel.audLen,
        audPer: channel.audPer,
        curPtr: channel.curPtr,
        curLen: channel.curLen,
        loopPtr: channel.loopPtr,
        loopLen: channel.loopLen,
        isLooping: channel.isLooping,
        periodCounter: channel.periodCounter,
        bytePhase: channel.bytePhase,
        nextWord: channel.nextWord,
        audDat: channel.audDat,
        heldValue: channel.heldValue
    };
}

const readJson = relative => JSON.parse(readFileSync(path.join(AMIGA_HARNESS_ROOT, relative), 'utf8'));

test('Paula Exact: AUDxVOL 0 stummt nur den DAC, DMA und Periodenzähler laufen weiter', () => {
    const PaulaChannel = loadPaulaChannel();
    const data = Int8Array.from([10, 20, 30, 40, 50, 60, 70, 80]);
    const audible = new PaulaChannel(0);
    const muted = new PaulaChannel(0);
    for (const channel of [audible, muted]) {
        channel.writeAUDxPER(200);
        channel.writeAUDxVOL(64);
        channel.trigger(data, 0, data.length);
    }
    muted.writeAUDxVOL(0);

    for (let index = 0; index < 24; index++) {
        const clockTicks = index % 2 === 0 ? 200 : 37.5;
        assert.equal(muted.step(clockTicks), 0);
        audible.step(clockTicks);
        assert.deepEqual(digitalState(muted), digitalState(audible), `Schritt ${index}`);
    }
    assert.equal(muted.dmaEnabled, true);
    muted.writeAUDxVOL(64);
    assert.equal(muted.step(0), audible.step(0));
});

for (const item of CASES) {
    test(`Exact ${item.name}: erneutes PLAY_TRACK ist auf allen drei Abgriffen bitgleich zu einem frischen Worklet`, async () => {
        const loaded = await loadAmigaTrack(item.input);
        const freshRun = renderExact(createExactProcessor(loaded.track), {
            seconds: item.seconds,
            outputRate: 48000,
            blockSize: 128
        });
        const restarted = createExactProcessor(loaded.track);
        renderExact(restarted, { seconds: 0.25, outputRate: 48000, blockSize: 128 });
        startExactTrack(restarted, loaded.track);
        const restartedRun = renderExact(restarted, {
            seconds: item.seconds,
            outputRate: 48000,
            blockSize: 128
        });
        assert.equal(nonFiniteSamples(freshRun), 0);
        assert.equal(nonFiniteSamples(restartedRun), 0);
        assert.deepEqual(tapHashes(restartedRun), tapHashes(freshRun));
    });
}

test('Exact: PLAY_TRACK nach einem anderen Format verwirft Kanal-, Effekt- und Analoghistorie', async () => {
    const warm = await loadAmigaTrack(CASES[0].input);
    const target = await loadAmigaTrack(CASES[3].input);
    const freshRun = renderExact(createExactProcessor(target.track), {
        seconds: 1,
        outputRate: 48000,
        blockSize: 128
    });
    const switched = createExactProcessor(warm.track);
    renderExact(switched, { seconds: 0.25, outputRate: 48000, blockSize: 128 });
    startExactTrack(switched, target.track);
    const switchedRun = renderExact(switched, {
        seconds: 1,
        outputRate: 48000,
        blockSize: 128
    });
    assert.deepEqual(tapHashes(switchedRun), tapHashes(freshRun));
});

test('Phase-1-Regressionsanker: COSO-Ausgabe und Worklet-Provenienz sind reproduzierbar', async () => {
    const report = readJson('doc/verification/amiga/phase1-exact-level1.json');
    const loaded = await loadAmigaTrack(report.input);
    assert.equal(sha256(loaded.bytes), report.tuneSha256);
    const worklet = readFileSync(path.join(AMIGA_HARNESS_ROOT, 'js/worklets/amiga/paula-exact.js'));
    assert.equal(sha256(worklet), report.workletSha256);
    const run = renderExact(createExactProcessor(loaded.track), {
        seconds: report.seconds,
        outputRate: report.sampleRate,
        blockSize: report.blockSize
    });
    assert.deepEqual(tapHashes(run), tapHashes(report.runs[0]));
    assert.equal(report.deterministic, true);
    assert.equal(report.finite, true);
    assert.equal(report.blockComparison.bitIdentical, true);
    assert.equal(report.restartComparison.bitIdenticalToFreshWorklet, true);
});
