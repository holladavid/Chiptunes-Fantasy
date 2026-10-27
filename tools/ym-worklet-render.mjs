// Render a local YM file through the production Exact AudioWorklet processor.
//   node tools/ym-worklet-render.mjs --input tracks/atari/Giana_Title.YM \
//     --seconds 60 --sample-rate 48000 --repeat 2 --report /tmp/giana.json

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

const args = new Map();
for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (!arg.startsWith('--')) throw new Error(`Unexpected argument: ${arg}`);
    args.set(arg.slice(2), process.argv[++i]);
}

const input = args.get('input');
if (!input) throw new Error('--input is required');
const seconds = Number(args.get('seconds') || 60);
const outputRate = Number(args.get('sample-rate') || 48000);
const repeat = Number(args.get('repeat') || 1);
const blockSize = Number(args.get('block-size') || 128);
if (!(seconds > 0) || !Number.isFinite(seconds)) throw new RangeError('--seconds must be positive');
if (![44100, 48000, 96000].includes(outputRate)) throw new RangeError('--sample-rate must be 44100, 48000 or 96000');
if (!Number.isInteger(repeat) || repeat < 1) throw new RangeError('--repeat must be a positive integer');
if (!Number.isInteger(blockSize) || blockSize < 1) throw new RangeError('--block-size must be a positive integer');

const processors = new Map();
globalThis.sampleRate = outputRate;
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

const inputPath = resolve(input);
const { loadYmFile } = await import('../js/parsers/ym-parser.js');
await import('../js/worklets/atari/ym-exact.js');
const Processor = processors.get('ym-exact-processor');
const track = await loadYmFile(inputPath);
const frames = Math.round(seconds * outputRate);
const fullBlocks = Math.floor(frames / blockSize);
const finalBlockSize = frames % blockSize;

function createProcessor() {
    const processor = new Processor();
    processor.port.onmessage({
        data: {
            type: 'PLAY_TRACK',
            track: track.frames,
            digidrums: track.digidrums,
            masterClock: track.metadata?.masterClock,
            playerRate: track.metadata?.playerRate,
            loopFrame: track.metadata?.loopFrame
        }
    });
    // Match the reviewed production regression harness: isolate DSP/transport
    // timing from the intentional 500-block fade-in.
    processor.fadeVol = 1;
    return processor;
}

function render(processor) {
    const hash = createHash('sha256');
    const left = new Float32Array(blockSize);
    const right = new Float32Array(blockSize);
    const blockTimes = new Float64Array(fullBlocks + (finalBlockSize ? 1 : 0));
    let nonFiniteSamples = 0;
    let peak = 0;
    let rendered = 0;
    let block = 0;
    const started = performance.now();

    while (rendered < frames) {
        const size = Math.min(blockSize, frames - rendered);
        const activeLeft = size === blockSize ? left : left.subarray(0, size);
        const activeRight = size === blockSize ? right : right.subarray(0, size);
        const blockStarted = performance.now();
        if (!processor.process([], [[activeLeft, activeRight]])) throw new Error('Processor stopped unexpectedly');
        blockTimes[block++] = performance.now() - blockStarted;
        for (let i = 0; i < size; i++) {
            const l = activeLeft[i];
            const r = activeRight[i];
            if (!Number.isFinite(l) || !Number.isFinite(r)) nonFiniteSamples += 2;
            peak = Math.max(peak, Math.abs(l), Math.abs(r));
        }
        hash.update(Buffer.from(activeLeft.buffer, activeLeft.byteOffset, activeLeft.byteLength));
        hash.update(Buffer.from(activeRight.buffer, activeRight.byteOffset, activeRight.byteLength));
        rendered += size;
    }

    const elapsedMs = performance.now() - started;
    const sortedTimes = blockTimes.slice().sort();
    const durationSeconds = frames / outputRate;
    return {
        sha256: hash.digest('hex'),
        frames,
        durationSeconds,
        elapsedMs,
        realTimeBudgetPercent: elapsedMs / (durationSeconds * 1000) * 100,
        realTimeFactor: durationSeconds * 1000 / elapsedMs,
        meanBlockMs: blockTimes.reduce((sum, value) => sum + value, 0) / blockTimes.length,
        p95BlockMs: sortedTimes[Math.min(sortedTimes.length - 1, Math.floor(sortedTimes.length * 0.95))],
        maxBlockMs: sortedTimes[sortedTimes.length - 1],
        nonFiniteSamples,
        peak,
        finalFrame: processor.currentFrame
    };
}

const runs = [];
for (let run = 0; run < repeat; run++) runs.push(render(createProcessor()));
const deterministic = runs.every(run => run.sha256 === runs[0].sha256);
const report = {
    format: 'chiptunes-fantasy-ym-production-phase5-v1',
    input: inputPath,
    sampleRate: outputRate,
    blockSize,
    repeat,
    deterministic,
    stageTaps: createProcessor().resampler.stages.map(stage => stage.taps),
    runs
};
const json = JSON.stringify(report, null, 2) + '\n';
if (args.get('report')) await writeFile(resolve(args.get('report')), json);
console.log(json);
if (!deterministic || runs.some(run => run.nonFiniteSamples !== 0)) process.exitCode = 1;
