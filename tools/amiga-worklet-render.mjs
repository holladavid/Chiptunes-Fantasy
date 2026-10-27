// Render and verify the real Paula Exact production worklet offline.
//   node tools/amiga-worklet-render.mjs --input wings-of-death/Wings_Of_Death-Level_1.hipc \
//     --seconds 5 --sample-rate 48000 --repeat 2 \
//     --report doc/verification/amiga/phase0-exact-level1.json
// Optional: --out-prefix /tmp/level1 writes level1.paula.wav, level1.zoh.wav
// and level1.a500.wav. No master gain/crossfeed/limiter is involved.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
    AMIGA_HARNESS_ROOT, TAP_DEFINITIONS, loadAmigaTrack, createExactProcessor,
    startExactTrack, renderExact, sameTaps, nonFiniteSamples, sha256, encodeWav16
} from './lib/amiga-exact-harness.mjs';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i];
    if (!key?.startsWith('--') || i + 1 >= process.argv.length) throw new Error(`Ungültiges Argument: ${key}`);
    args.set(key.slice(2), process.argv[i + 1]);
}
const input = args.get('input');
if (!input) throw new Error('--input is required');
const seconds = Number(args.get('seconds') || 5);
const outputRate = Number(args.get('sample-rate') || 48000);
const blockSize = Number(args.get('block-size') || 128);
const repeat = Number(args.get('repeat') || 2);
const checkBlocks = args.get('check-blocks') !== '0';
const checkRestart = args.get('check-restart') !== '0';
if (!(seconds > 0) || !Number.isFinite(seconds)) throw new RangeError('--seconds must be positive');
if (![44100, 48000, 96000].includes(outputRate)) throw new RangeError('--sample-rate must be 44100, 48000 or 96000');
if (!Number.isInteger(blockSize) || blockSize < 1) throw new RangeError('--block-size must be a positive integer');
if (!Number.isInteger(repeat) || repeat < 1) throw new RangeError('--repeat must be a positive integer');

const song = args.has('song') ? Number(args.get('song')) : null;
if (song !== null && (!Number.isInteger(song) || song < 0)) throw new RangeError('--song must be a non-negative integer');
const loaded = await loadAmigaTrack(input, song);
const renderFresh = options => renderExact(createExactProcessor(loaded.track, outputRate), {
    seconds, outputRate, blockSize, ...options
});
const runs = [];
for (let run = 0; run < repeat; run++) runs.push(renderFresh({ keepPcm: run === 0 && Boolean(args.get('out-prefix')) }));
const deterministic = runs.every(run => sameTaps(run, runs[0]));

let blockComparison = null;
if (checkBlocks) {
    const irregular = renderFresh({ blockPattern: [1, 17, 64, 255, 3, 128] });
    blockComparison = {
        pattern: [1, 17, 64, 255, 3, 128],
        bitIdentical: sameTaps(irregular, runs[0]),
        run: irregular
    };
}

let restartComparison = null;
if (checkRestart) {
    const restarted = createExactProcessor(loaded.track, outputRate);
    // Warm up all digital and analog histories without retaining measurement data.
    renderExact(restarted, { seconds: Math.min(0.25, seconds), outputRate, blockSize });
    startExactTrack(restarted, loaded.track);
    const restartedRun = renderExact(restarted, { seconds, outputRate, blockSize });
    restartComparison = {
        warmupSeconds: Math.min(0.25, seconds),
        bitIdenticalToFreshWorklet: sameTaps(restartedRun, runs[0]),
        note: 'Ein false-Wert ist ein Messbefund für Phase 1, kein Harness- oder Deterministikfehler.',
        run: restartedRun
    };
}

const report = {
    format: 'chiptunes-fantasy-amiga-exact-phase0-v1',
    input: loaded.path,
    tuneSha256: sha256(loaded.bytes),
    workletSha256: sha256(await (await import('node:fs/promises')).readFile(path.join(AMIGA_HARNESS_ROOT, 'js/worklets/amiga/paula-exact.js'))),
    processor: 'paula-exact-processor',
    masterProcessing: 'excluded: no audio-controller/master-processor, gain, master crossfeed or limiter',
    taps: TAP_DEFINITIONS,
    sampleRate: outputRate,
    oversampling: 4,
    seconds,
    blockSize,
    repeat,
    deterministic,
    finite: runs.every(run => nonFiniteSamples(run) === 0),
    runs,
    blockComparison,
    restartComparison
};

if (args.get('out-prefix')) {
    const prefix = path.resolve(args.get('out-prefix'));
    mkdirSync(path.dirname(prefix), { recursive: true });
    for (const definition of TAP_DEFINITIONS) {
        const pcm = runs[0].pcm[definition.id];
        writeFileSync(`${prefix}.${definition.id}.wav`, encodeWav16(pcm.samples, pcm.sampleRate));
    }
}
for (const run of [...runs, blockComparison?.run, restartComparison?.run].filter(Boolean)) delete run.pcm;
const json = JSON.stringify(report, null, 2) + '\n';
if (args.get('report')) {
    const filename = path.resolve(args.get('report'));
    mkdirSync(path.dirname(filename), { recursive: true });
    writeFileSync(filename, json);
}
console.log(json);
if (!deterministic || !report.finite || (blockComparison && !blockComparison.bitIdentical)) process.exitCode = 1;
