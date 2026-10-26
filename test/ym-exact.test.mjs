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

test('ym-exact production output remains bit-identical to the pre-refactor Phase 0 baseline', async () => {
    const Processor = processors.get('ym-exact-processor');
    for (const testCase of Object.values(baseline.cases)) {
        const track = await loadYmFile(testCase.path);
        const processor = new Processor();
        processor.port.onmessage({
            data: { type: 'PLAY_TRACK', track: track.frames, digidrums: track.digidrums }
        });
        processor.fadeVol = 1;

        const chunks = [];
        for (let block = 0; block < 375; block++) {
            const left = new Float32Array(128);
            const right = new Float32Array(128);
            assert.equal(processor.process([], [[left, right]]), true);
            for (let i = 0; i < left.length; i++) {
                assert.ok(Number.isFinite(left[i]));
                assert.ok(Number.isFinite(right[i]));
            }
            chunks.push(Buffer.from(left.buffer), Buffer.from(right.buffer));
        }
        const hash = createHash('sha256').update(Buffer.concat(chunks)).digest('hex');
        assert.equal(hash, testCase.sha256, testCase.path);
        assert.ok(processor.core instanceof Object);
    }
});
