import test from 'node:test';
import assert from 'node:assert/strict';

const processors = new Map();

globalThis.sampleRate = 48000;
globalThis.AudioWorkletProcessor = class {
    constructor() {
        this.port = { onmessage: null, postMessage() {} };
    }
};
globalThis.registerProcessor = (name, processor) => processors.set(name, processor);

await import('../js/worklets/c64/sid-exact.js');
await import('../js/worklets/c64/sid-fantasy.js');

function exercise(name, channels) {
    const Processor = processors.get(name);
    const processor = new Processor();
    processor.prgCode = new Uint8Array([0x60]); // RTS from init into the idle stub
    processor.loadAddr = 0x2000;
    processor.initAddress = 0x2000;
    processor.playAddress = 0;
    processor.songSpeedFlags = 0;
    processor.runSubsongInit(0, 100);
    processor.isPlaying = true;
    processor.fadeVol = 1.0;

    const output = [new Float32Array(128), new Float32Array(128)];
    assert.equal(processor.process([], [output]), true);
    assert.equal(processor.resampler.outputRate, 48000);
    assert.equal(processor.resampler.channels, channels);
    assert.equal(processor.resampler.taps, 1511);
    assert.ok(processor.resampler.ringIndex > 0);
    for (const channel of output) {
        for (const sample of channel) assert.ok(Number.isFinite(sample));
    }
    return { processor, output };
}

test('sid-exact worklet runs a complete 128-frame process block with the shared resampler', () => {
    const { processor } = exercise('sid-exact-processor', 1);
    assert.equal(processor.c64Output.cComp, 0.0);
});

test('sid-fantasy worklet runs stereo blocks with the shared coefficient path', () => {
    const { processor } = exercise('sid-fantasy-processor', 2);
    assert.ok(processor.resampler.ringR instanceof Float32Array);
});
