import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const processors = new Map();
globalThis.sampleRate = 48000;
globalThis.AudioWorkletProcessor = class {
    constructor() {
        this.port = { onmessage: null, postMessage() {} };
    }
};
globalThis.registerProcessor = (name, processor) => processors.set(name, processor);
globalThis.fetch = async url => ({
    ok: true,
    arrayBuffer: async () => {
        const bytes = await readFile(url);
        return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    }
});

const { loadYmFile } = await import('../js/parsers/ym-parser.js');
await import('../js/worklets/atari/ym-exact.js');
const baseline = JSON.parse(await readFile(new URL('./fixtures/ym-production-baseline.json', import.meta.url), 'utf8'));
const Processor = processors.get('ym-exact-processor');

function startTrack(processor, track) {
    processor.port.onmessage({
        data: { type: 'PLAY_TRACK', track: track.frames, digidrums: track.digidrums }
    });
    processor.fadeVol = 1;
}

function renderBlocks(processor, count = 375) {
    const chunks = [];
    for (let block = 0; block < count; block++) {
        const left = new Float32Array(128);
        const right = new Float32Array(128);
        assert.equal(processor.process([], [[left, right]]), true);
        for (let i = 0; i < left.length; i++) {
            assert.ok(Number.isFinite(left[i]));
            assert.ok(Number.isFinite(right[i]));
        }
        chunks.push(Buffer.from(left.buffer), Buffer.from(right.buffer));
    }
    return createHash('sha256').update(Buffer.concat(chunks)).digest('hex');
}

test('ym-exact production output matches the reviewed Phase 1 baseline', async () => {
    for (const testCase of Object.values(baseline.cases)) {
        const track = await loadYmFile(testCase.path);
        const processor = new Processor();
        startTrack(processor, track);
        assert.equal(renderBlocks(processor), testCase.sha256, testCase.path);
        assert.ok(processor.core instanceof Object);
    }
});

test('restarting a track is bit-identical to a fresh worklet', async () => {
    const testCase = baseline.cases.Giana_Title;
    const track = await loadYmFile(testCase.path);
    const restarted = new Processor();
    startTrack(restarted, track);
    renderBlocks(restarted, 37);
    restarted.port.onmessage({
        data: { type: 'PLAY_TRACK', track: track.frames, digidrums: track.digidrums }
    });
    assert.equal(restarted.fadeVol, 0);
    restarted.fadeVol = 1;
    const restartedHash = renderBlocks(restarted);

    const fresh = new Processor();
    startTrack(fresh, track);
    assert.equal(restartedHash, renderBlocks(fresh));
});

test('changing tracks clears digital, effect, resampler and output state', async () => {
    const firstTrack = await loadYmFile(baseline.cases.Giana_Title.path);
    const secondTrack = await loadYmFile(baseline.cases.WINGLEV1.path);
    const changed = new Processor();
    startTrack(changed, firstTrack);
    renderBlocks(changed, 37);
    startTrack(changed, secondTrack);
    const changedHash = renderBlocks(changed);

    const fresh = new Processor();
    startTrack(fresh, secondTrack);
    assert.equal(changedHash, renderBlocks(fresh));
});

test('stop and resume preserve transport and digital core state', async () => {
    const track = await loadYmFile(baseline.cases.Giana_Title.path);
    const processor = new Processor();
    startTrack(processor, track);
    renderBlocks(processor, 8);

    const coreState = structuredClone(processor.core);
    const transportState = {
        currentFrame: processor.currentFrame,
        sampleCounter: processor.sampleCounter,
        cycleAccumulator: processor.cycleAccumulator,
        digiPos: processor.digiPos,
        lastDigiTrigger: processor.lastDigiTrigger,
        hijackedVoice: processor.hijackedVoice
    };
    processor.port.onmessage({ data: { type: 'STOP_TRACK' } });
    renderBlocks(processor, 8);
    assert.deepEqual({ ...processor.core }, coreState);
    assert.deepEqual({
        currentFrame: processor.currentFrame,
        sampleCounter: processor.sampleCounter,
        cycleAccumulator: processor.cycleAccumulator,
        digiPos: processor.digiPos,
        lastDigiTrigger: processor.lastDigiTrigger,
        hijackedVoice: processor.hijackedVoice
    }, transportState);

    processor.port.onmessage({ data: { type: 'RESUME_TRACK' } });
    assert.equal(processor.isPlaying, true);
    assert.deepEqual({ ...processor.core }, coreState);
    renderBlocks(processor, 8);
});
