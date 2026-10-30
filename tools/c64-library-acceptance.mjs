// Separate acceptance for the curated 54-track C64 library.
//   node tools/c64-library-acceptance.mjs --seconds 3 \
//     --report doc/verification/c64/curation-library-corpus.json
// Production-worklet regression measurements; no hardware-reference or browser-dropout claim.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

import { SID_SLDB } from '../js/content/songlengths.js';
import { c64Playlist } from '../tracks/c64/playlist.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
    const key = process.argv[index];
    if (!key?.startsWith('--') || index + 1 >= process.argv.length) throw new Error(`Ungültiges Argument: ${key}`);
    args.set(key.slice(2), process.argv[index + 1]);
}
const seconds = Number(args.get('seconds') || 3);
if (!(seconds > 0) || !Number.isFinite(seconds)) throw new RangeError('--seconds must be positive');
const sampleRate = 48000;
const discardSeconds = 0.25;
const irregularBlockPattern = [1, 17, 64, 255, 3, 128];
const source = relative => readFileSync(path.join(root, relative));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceHash = relative => sha256(source(relative));

function parseSid(relative, filename) {
    const bytes = source(relative);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const magic = bytes.toString('ascii', 0, 4);
    if (magic !== 'PSID' && magic !== 'RSID') throw new Error(`${relative}: PSID/RSID required`);
    const dataOffset = view.getUint16(6, false);
    let loadAddress = view.getUint16(8, false);
    let initAddress = view.getUint16(10, false);
    const playAddress = view.getUint16(12, false);
    const songs = view.getUint16(14, false);
    const startSong = view.getUint16(16, false);
    const speed = view.getUint32(18, false);
    let start = dataOffset;
    const fileLoadAddress = bytes[start] | (bytes[start + 1] << 8);
    if (loadAddress === 0) {
        loadAddress = fileLoadAddress;
        start += 2;
    } else if (fileLoadAddress === loadAddress) {
        start += 2;
    }
    if (initAddress === 0) initAddress = loadAddress;
    const key = filename.split('/').pop().toLowerCase().replace('.sid', '').replace(/[\s_-]/g, '');
    // The documented 2024 rip has no HVSC #85 length yet; mirror the parser's fallback.
    const lengths = SID_SLDB[key]?.lengths ||
        (filename === 'assembly/transcend-the-game.sid' ? [180] : undefined);
    if (!lengths || lengths.length !== songs) throw new Error(`${relative}: invalid curated song lengths`);
    const selectedLength = lengths[startSong > 0 ? startSong - 1 : 0];
    return {
        bytes,
        format: `${magic} v${view.getUint16(4, false)}`,
        track: {
            isSidFile: true,
            c64Code: bytes.subarray(start),
            loadAddress,
            initAddress,
            playAddress,
            startSong,
            speed,
            lengths,
            length: Math.ceil(selectedLength * 50),
            metadata: { name: filename, songs, startSong }
        }
    };
}

const processors = new Map();
globalThis.sampleRate = sampleRate;
globalThis.AudioWorkletProcessor = class {
    constructor() {
        this.port = { onmessage: null, postMessage() {} };
    }
};
globalThis.registerProcessor = (name, processor) => processors.set(name, processor);
await import('../js/worklets/c64/sid-exact.js');
const Processor = processors.get('sid-exact-processor');
if (!Processor) throw new Error('sid-exact-processor was not registered');
// Pin the optional per-instance calibration for repeatable offline measurements.
Math.random = () => 0.5;

function createProcessor(track) {
    const processor = new Processor();
    processor.port.onmessage({ data: track });
    return processor;
}

function render(processor, duration, blockPattern = [128]) {
    const outputFrames = Math.ceil(duration * sampleRate);
    const discardFrames = Math.ceil(discardSeconds * sampleRate);
    const totalFrames = outputFrames + discardFrames;
    const pcm = new Float32Array(outputFrames * 2);
    let processedFrames = 0;
    let writtenFrames = 0;
    let blockIndex = 0;
    const started = performance.now();
    while (processedFrames < totalFrames) {
        const size = blockPattern[blockIndex++ % blockPattern.length];
        const left = new Float32Array(size);
        const right = new Float32Array(size);
        processor.process([], [[left, right]]);
        for (let index = 0; index < size && processedFrames < totalFrames; index++, processedFrames++) {
            if (processedFrames < discardFrames || writtenFrames >= outputFrames) continue;
            pcm[writtenFrames * 2] = left[index];
            pcm[writtenFrames * 2 + 1] = right[index];
            writtenFrames++;
        }
    }
    return { pcm, elapsedMs: performance.now() - started };
}

function metrics(run, duration) {
    const { pcm } = run;
    const frames = pcm.length / 2;
    let sumL = 0, sumR = 0, sumSquareL = 0, sumSquareR = 0;
    let sumLR = 0, sumSide = 0, peak = 0, nonFinite = 0;
    for (let index = 0; index < frames; index++) {
        const left = pcm[index * 2];
        const right = pcm[index * 2 + 1];
        if (!Number.isFinite(left) || !Number.isFinite(right)) nonFinite++;
        sumL += left;
        sumR += right;
        sumSquareL += left * left;
        sumSquareR += right * right;
        sumLR += left * right;
        const side = (left - right) * 0.5;
        sumSide += side * side;
        peak = Math.max(peak, Math.abs(left), Math.abs(right));
    }
    return {
        pcmSha256: sha256(Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength)),
        frames,
        rmsL: Math.sqrt(sumSquareL / frames),
        rmsR: Math.sqrt(sumSquareR / frames),
        rms: Math.sqrt((sumSquareL + sumSquareR) / (frames * 2)),
        peak,
        dcL: sumL / frames,
        dcR: sumR / frames,
        stereoCorrelation: sumLR / Math.max(1e-20, Math.sqrt(sumSquareL * sumSquareR)),
        sideRms: Math.sqrt(sumSide / frames),
        nonFinite,
        offlineRealTimeRatio: run.elapsedMs / ((duration + discardSeconds) * 1000)
    };
}

const tracks = [];
for (const [index, entry] of c64Playlist.entries()) {
    const loaded = parseSid(`tracks/c64/${entry.path}`, entry.path);
    const firstRun = render(createProcessor(loaded.track), seconds);
    const repeatedRun = render(createProcessor(loaded.track), seconds);
    const irregularRun = render(createProcessor(loaded.track), seconds, irregularBlockPattern);
    const restarted = createProcessor(loaded.track);
    render(restarted, 0.25);
    restarted.port.onmessage({ data: loaded.track });
    const restartedRun = render(restarted, seconds);
    const first = metrics(firstRun, seconds);
    const repeated = metrics(repeatedRun, seconds);
    const irregular = metrics(irregularRun, seconds);
    const restart = metrics(restartedRun, seconds);
    const record = {
        path: entry.path,
        tuneSha256: sha256(loaded.bytes),
        format: loaded.format,
        songs: loaded.track.metadata.songs,
        startSong: loaded.track.startSong,
        deterministic: first.pcmSha256 === repeated.pcmSha256,
        blockIndependent: first.pcmSha256 === irregular.pcmSha256,
        restartIdentical: first.pcmSha256 === restart.pcmSha256,
        finite: [first, repeated, irregular, restart].every(run => run.nonFinite === 0),
        audible: first.rms > 1e-5 && first.peak > 1e-4,
        maximumOfflineRealTimeRatio: Math.max(
            first.offlineRealTimeRatio, repeated.offlineRealTimeRatio,
            irregular.offlineRealTimeRatio, restart.offlineRealTimeRatio
        ),
        metrics: first
    };
    record.passed = record.deterministic && record.blockIndependent && record.restartIdentical &&
        record.finite && record.audible;
    tracks.push(record);
    console.log(`[${index + 1}/${c64Playlist.length}] ${entry.path}: ${record.passed ? 'PASS' : 'FAIL'} ` +
        `(RMS ${first.rms.toFixed(6)}, Peak ${first.peak.toFixed(6)})`);
}

const formatCounts = Object.fromEntries([...new Set(tracks.map(track => track.format))].sort().map(format => [
    format, tracks.filter(track => track.format === format).length
]));
const report = {
    format: 'chiptunes-fantasy-c64-curation-library-v1',
    referenceStatus: 'Self-generated curation regression anchors; no hardware-reference or browser-dropout claim.',
    engine: 'exact',
    processor: 'sid-exact-processor',
    workletSha256: sourceHash('js/worklets/c64/sid-exact.js'),
    playlistSha256: sourceHash('tracks/c64/playlist.js'),
    museumSha256: sourceHash('tracks/c64/museum.js'),
    provenanceSha256: sourceHash('tracks/c64/classics/provenance.json'),
    assemblyProvenanceSha256: sourceHash('tracks/c64/assembly/provenance.json'),
    songlengthsSha256: sourceHash('js/content/songlengths.js'),
    corpus: {
        seconds,
        discardSeconds,
        sampleRate,
        blockSize: 128,
        irregularBlockPattern,
        restartWarmupSeconds: 0.25,
        calibrationRandomValue: 0.5,
        audibleThresholds: { rmsExclusive: 1e-5, peakExclusive: 1e-4 },
        trackCount: tracks.length,
        formatCounts,
        finite: tracks.every(track => track.finite),
        deterministic: tracks.every(track => track.deterministic),
        blockIndependent: tracks.every(track => track.blockIndependent),
        restartIdentical: tracks.every(track => track.restartIdentical),
        audible: tracks.every(track => track.audible),
        maximumPeak: Math.max(...tracks.map(track => track.metrics.peak)),
        minimumRms: Math.min(...tracks.map(track => track.metrics.rms)),
        silentTracks: tracks.filter(track => !track.audible).map(track => track.path),
        maximumOfflineRealTimeRatio: Math.max(...tracks.map(track => track.maximumOfflineRealTimeRatio)),
        tracks
    },
    performance: {
        scope: 'Offline production worklet; four renders per track including deterministic-analysis overhead.',
        realTimeBudget: 1,
        withinOfflineRealTimeBudget: tracks.every(track => track.maximumOfflineRealTimeRatio < 1),
        note: 'This is not a browser underrun or device-specific performance proof.'
    }
};
report.passed = tracks.length === c64Playlist.length && tracks.every(track => track.passed) &&
    report.performance.withinOfflineRealTimeBudget;

const filename = path.resolve(root, args.get('report') || 'doc/verification/c64/curation-library-corpus.json');
mkdirSync(path.dirname(filename), { recursive: true });
writeFileSync(filename, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
    passed: report.passed,
    trackCount: report.corpus.trackCount,
    formatCounts: report.corpus.formatCounts,
    maximumPeak: report.corpus.maximumPeak,
    minimumRms: report.corpus.minimumRms,
    silentTracks: report.corpus.silentTracks,
    maximumOfflineRealTimeRatio: report.corpus.maximumOfflineRealTimeRatio
}, null, 2));
if (!report.passed) process.exitCode = 1;
