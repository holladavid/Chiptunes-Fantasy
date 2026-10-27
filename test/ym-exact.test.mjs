import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { readdirSync } from 'node:fs';

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

function startTrack(processor, track, overrides = {}) {
    processor.port.onmessage({
        data: {
            type: 'PLAY_TRACK', track: track.frames, digidrums: track.digidrums,
            masterClock: track.metadata?.masterClock, playerRate: track.metadata?.playerRate,
            loopFrame: track.metadata?.loopFrame, ...overrides
        }
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

function renderVariableBlocks(processor, pattern, totalSamples = 4096) {
    const hash = createHash('sha256');
    let rendered = 0;
    let block = 0;
    while (rendered < totalSamples) {
        const size = Math.min(pattern[block++ % pattern.length], totalSamples - rendered);
        const left = new Float32Array(size);
        const right = new Float32Array(size);
        assert.equal(processor.process([], [[left, right]]), true);
        for (let i = 0; i < size; i++) {
            assert.ok(Number.isFinite(left[i]));
            assert.ok(Number.isFinite(right[i]));
        }
        hash.update(Buffer.from(left.buffer)).update(Buffer.from(right.buffer));
        rendered += size;
    }
    return hash.digest('hex');
}

test('ym-exact production output matches the reviewed Phase 5 baseline', async () => {
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
        data: {
            type: 'PLAY_TRACK', track: track.frames, digidrums: track.digidrums,
            masterClock: track.metadata.masterClock, playerRate: track.metadata.playerRate,
            loopFrame: track.metadata.loopFrame
        }
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

test('44.1/48/96kHz output is deterministic and independent of audio block size', async () => {
    const track = await loadYmFile(baseline.cases.Giana_Title.path);
    const previousRate = globalThis.sampleRate;
    try {
        for (const outputRate of [44100, 48000, 96000]) {
            globalThis.sampleRate = outputRate;
            const regular = new Processor();
            const irregular = new Processor();
            startTrack(regular, track);
            startTrack(irregular, track);
            const expected = renderVariableBlocks(regular, [128]);
            const actual = renderVariableBlocks(irregular, [1, 17, 64, 255, 3, 128]);
            assert.equal(actual, expected, `${outputRate}Hz block-size dependence`);
            assert.equal(regular.resampler.outputRate, outputRate);
            assert.equal('outLp' in regular, false);
        }
    } finally {
        globalThis.sampleRate = previousRate;
    }
});

test('stop and resume preserve transport and digital core state', async () => {
    const track = await loadYmFile(baseline.cases.Giana_Title.path);
    const processor = new Processor();
    startTrack(processor, track);
    renderBlocks(processor, 8);

    const coreState = structuredClone(processor.core);
    const effectState = structuredClone(processor.effects);
    const transportState = {
        currentFrame: processor.currentFrame,
        sampleCounter: processor.sampleCounter,
        resamplerAccumulator: processor.resampler.cycleAccumulator,
        playerRate: processor.playerRate,
        loopFrame: processor.loopFrame
    };
    processor.port.onmessage({ data: { type: 'STOP_TRACK' } });
    renderBlocks(processor, 8);
    assert.deepEqual({ ...processor.core }, coreState);
    assert.deepEqual(structuredClone(processor.effects), effectState);
    assert.deepEqual({
        currentFrame: processor.currentFrame,
        sampleCounter: processor.sampleCounter,
        resamplerAccumulator: processor.resampler.cycleAccumulator,
        playerRate: processor.playerRate,
        loopFrame: processor.loopFrame
    }, transportState);

    processor.port.onmessage({ data: { type: 'RESUME_TRACK' } });
    assert.equal(processor.isPlaying, true);
    assert.deepEqual({ ...processor.core }, coreState);
    assert.deepEqual(structuredClone(processor.effects), effectState);
    renderBlocks(processor, 8);
});

test('playerRate controls production frame advancement', () => {
    const track = {
        frames: Array.from({ length: 200 }, () => new Uint8Array(16)),
        digidrums: [], metadata: { playerRate: 50, loopFrame: 0 }
    };
    const at50 = new Processor();
    const at100 = new Processor();
    startTrack(at50, track);
    startTrack(at100, track, { playerRate: 100 });
    renderBlocks(at50, 100);
    renderBlocks(at100, 100);
    assert.equal(at50.currentFrame, 14);
    assert.equal(at100.currentFrame, 27);
});

test('track end jumps to the stored loop frame instead of frame zero', () => {
    const track = {
        frames: [1, 2, 3].map(value => {
            const frame = new Uint8Array(16);
            frame[0] = value;
            return frame;
        }),
        digidrums: [], metadata: { playerRate: 1000, loopFrame: 1 }
    };
    const processor = new Processor();
    startTrack(processor, track);
    renderBlocks(processor, 1);
    assert.equal(processor.core.regs[0], 3);
    assert.equal(processor.currentFrame, 1);
    assert.equal(processor.loopFrame, 1);
});


test('all ten corpus tracks with stored loop points return to their own loop frame', async () => {
    const root = 'tracks/atari';
    const names = readdirSync(root, { recursive: true }).filter(name => /\.ym$/i.test(name));
    let checked = 0;
    for (const name of names) {
        const track = await loadYmFile(`${root}/${name}`);
        if (track.metadata.loopFrame === 0) continue;
        const processor = new Processor();
        startTrack(processor, track);
        processor.port.onmessage({ data: { type: 'SEEK_TRACK', frame: track.frames.length - 1 } });
        renderBlocks(processor, 1);
        assert.equal(processor.currentFrame, track.metadata.loopFrame, name);
        checked++;
    }
    assert.equal(checked, 10);
});
