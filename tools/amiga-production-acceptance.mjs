// Full production acceptance for every Amiga playlist entry.
//   node tools/amiga-production-acceptance.mjs --seconds 5 --long-seconds 60 \
//     --report doc/verification/amiga/phase5-production-corpus.json
// Regression measurements only; no hardware/UADE truth or browser-dropout claim.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
    AMIGA_HARNESS_ROOT, loadAmigaTrack, createExactProcessor, startExactTrack,
    renderExact, sameTaps, nonFiniteSamples, sha256
} from './lib/amiga-exact-harness.mjs';
import { amigaPlaylist } from '../tracks/amiga/playlist.js';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
    const key = process.argv[index];
    if (!key?.startsWith('--') || index + 1 >= process.argv.length) throw new Error(`Ungültiges Argument: ${key}`);
    args.set(key.slice(2), process.argv[index + 1]);
}
const seconds = Number(args.get('seconds') || 5);
const longSeconds = Number(args.get('long-seconds') || 60);
if (!(seconds > 0) || !Number.isFinite(seconds)) throw new RangeError('--seconds must be positive');
if (!(longSeconds > 0) || !Number.isFinite(longSeconds)) throw new RangeError('--long-seconds must be positive');

const compactTaps = run => run.taps.map(tap => ({
    id: tap.id,
    sha256: tap.sha256,
    rms: tap.rms,
    peak: tap.peak,
    dc: tap.dc,
    nonFiniteSamples: tap.nonFiniteSamples
}));
const render = (track, rate, duration, options = {}) => renderExact(createExactProcessor(track, rate), {
    seconds: duration, outputRate: rate, blockSize: 128, ...options
});
const sourceHash = relative => sha256(readFileSync(path.join(AMIGA_HARNESS_ROOT, relative)));

const tracks = [];
for (const [index, entry] of amigaPlaylist.entries()) {
    const loaded = await loadAmigaTrack(entry.path);
    const first = render(loaded.track, 48000, seconds);
    const repeated = render(loaded.track, 48000, seconds);
    const irregular = render(loaded.track, 48000, seconds, { blockPattern: [1, 17, 64, 255, 3, 128] });
    const restarted = createExactProcessor(loaded.track, 48000);
    renderExact(restarted, { seconds: 0.25, outputRate: 48000, blockSize: 128 });
    startExactTrack(restarted, loaded.track);
    const restartedRun = renderExact(restarted, { seconds, outputRate: 48000, blockSize: 128 });
    const record = {
        path: entry.path,
        tuneSha256: sha256(loaded.bytes),
        type: loaded.track.type,
        channels: loaded.track.numChannels,
        deterministic: sameTaps(first, repeated),
        blockIndependent: sameTaps(first, irregular),
        restartIdentical: sameTaps(first, restartedRun),
        finite: [first, repeated, irregular, restartedRun].every(run => nonFiniteSamples(run) === 0),
        offlineRealTimeRatio: first.elapsedMs / (seconds * 1000),
        taps: compactTaps(first)
    };
    record.passed = record.deterministic && record.blockIndependent && record.restartIdentical && record.finite;
    tracks.push(record);
    console.log(`[${index + 1}/${amigaPlaylist.length}] ${entry.path}: ${record.passed ? 'PASS' : 'FAIL'}`);
}

const representatives = [
    { name: 'level1', input: 'wings-of-death/Wings_Of_Death-Level_1.hipc' },
    { name: 'hip68k', input: 'wings-of-death/Wings_Of_Death-Title.hip' },
    { name: 'mod', input: 'ELYSIUM.MOD' },
    { name: 'xm', input: 'space_debris.xm' }
];
const sampleRates = [];
for (const item of representatives) {
    const loaded = await loadAmigaTrack(item.input);
    for (const rate of [44100, 48000, 96000]) {
        const first = render(loaded.track, rate, 2);
        const repeated = render(loaded.track, rate, 2);
        const record = {
            name: item.name,
            input: item.input,
            sampleRate: rate,
            deterministic: sameTaps(first, repeated),
            finite: nonFiniteSamples(first) === 0 && nonFiniteSamples(repeated) === 0,
            taps: compactTaps(first)
        };
        record.passed = record.deterministic && record.finite;
        sampleRates.push(record);
        console.log(`RATE ${item.name} ${rate}: ${record.passed ? 'PASS' : 'FAIL'}`);
    }
}

const longRuns = [];
for (const item of representatives) {
    const loaded = await loadAmigaTrack(item.input);
    const first = render(loaded.track, 48000, longSeconds);
    const repeated = render(loaded.track, 48000, longSeconds);
    const record = {
        name: item.name,
        input: item.input,
        seconds: longSeconds,
        deterministic: sameTaps(first, repeated),
        finite: nonFiniteSamples(first) === 0 && nonFiniteSamples(repeated) === 0,
        offlineRealTimeRatio: Math.max(first.elapsedMs, repeated.elapsedMs) / (longSeconds * 1000),
        taps: compactTaps(first)
    };
    record.passed = record.deterministic && record.finite && record.offlineRealTimeRatio < 1;
    longRuns.push(record);
    console.log(`LONG ${item.name}: ${record.passed ? 'PASS' : 'FAIL'} ratio=${record.offlineRealTimeRatio}`);
}

const formatCounts = Object.fromEntries([...new Set(tracks.map(track => track.type))].sort().map(type => [
    type, tracks.filter(track => track.type === type).length
]));
const report = {
    format: 'chiptunes-fantasy-amiga-phase5-production-v1',
    referenceStatus: 'Self-generated production regression anchors; no hardware/UADE truth or browser-dropout claim.',
    workletSha256: sourceHash('js/worklets/amiga/paula-exact.js'),
    audioControllerSha256: sourceHash('js/audio/audio-controller.js'),
    registrySha256: sourceHash('js/worklets/registry.js'),
    corpus: {
        seconds,
        sampleRate: 48000,
        blockSize: 128,
        irregularBlockPattern: [1, 17, 64, 255, 3, 128],
        restartWarmupSeconds: 0.25,
        trackCount: tracks.length,
        formatCounts,
        finite: tracks.every(track => track.finite),
        deterministic: tracks.every(track => track.deterministic),
        blockIndependent: tracks.every(track => track.blockIndependent),
        restartIdentical: tracks.every(track => track.restartIdentical),
        maximumA500Peak: Math.max(...tracks.map(track => track.taps.find(tap => tap.id === 'a500').peak)),
        silentA500Tracks: tracks.filter(track => track.taps.find(tap => tap.id === 'a500').peak === 0).map(track => track.path),
        maximumOfflineRealTimeRatio: Math.max(...tracks.map(track => track.offlineRealTimeRatio)),
        tracks
    },
    sampleRates,
    longRuns,
    performance: {
        scope: 'Offline production worklet with three diagnostic hash taps; includes measurement overhead.',
        realTimeBudget: 1,
        withinOfflineRealTimeBudget: [...tracks, ...longRuns].every(track => track.offlineRealTimeRatio < 1),
        note: 'This is not a browser underrun or device-specific performance proof.'
    }
};
report.passed = tracks.length === 45 && tracks.every(track => track.passed) &&
    sampleRates.every(run => run.passed) && longRuns.every(run => run.passed) &&
    report.performance.withinOfflineRealTimeBudget;

const filename = path.resolve(AMIGA_HARNESS_ROOT, args.get('report') || 'doc/verification/amiga/phase5-production-corpus.json');
mkdirSync(path.dirname(filename), { recursive: true });
writeFileSync(filename, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
    passed: report.passed,
    trackCount: report.corpus.trackCount,
    formatCounts: report.corpus.formatCounts,
    maximumA500Peak: report.corpus.maximumA500Peak,
    silentA500Tracks: report.corpus.silentA500Tracks,
    maximumOfflineRealTimeRatio: report.corpus.maximumOfflineRealTimeRatio
}, null, 2));
if (!report.passed) process.exitCode = 1;
