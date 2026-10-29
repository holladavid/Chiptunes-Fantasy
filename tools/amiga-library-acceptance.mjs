// Separate acceptance for the curated 73-track Amiga library.
//   node tools/amiga-library-acceptance.mjs --seconds 2 \
//     --report doc/verification/amiga/curation-library-corpus.json
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
const seconds = Number(args.get('seconds') || 2);
if (!(seconds > 0) || !Number.isFinite(seconds)) throw new RangeError('--seconds must be positive');

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
    const a500 = first.taps.find(tap => tap.id === 'a500');
    const record = {
        path: entry.path,
        tuneSha256: sha256(loaded.bytes),
        type: loaded.track.type,
        channels: loaded.track.numChannels,
        deterministic: sameTaps(first, repeated),
        blockIndependent: sameTaps(first, irregular),
        restartIdentical: sameTaps(first, restartedRun),
        finite: [first, repeated, irregular, restartedRun].every(run => nonFiniteSamples(run) === 0),
        audible: a500.rms > 1e-5 && a500.peak > 1e-4,
        offlineRealTimeRatio: Math.max(first.elapsedMs, repeated.elapsedMs, irregular.elapsedMs, restartedRun.elapsedMs) / (seconds * 1000),
        taps: compactTaps(first)
    };
    record.passed = record.deterministic && record.blockIndependent && record.restartIdentical &&
        record.finite && record.audible;
    tracks.push(record);
    console.log(`[${index + 1}/${amigaPlaylist.length}] ${entry.path}: ${record.passed ? 'PASS' : 'FAIL'}`);
}

const formatCounts = Object.fromEntries([...new Set(tracks.map(track => track.type))].sort().map(type => [
    type, tracks.filter(track => track.type === type).length
]));
const report = {
    format: 'chiptunes-fantasy-amiga-curation-library-v1',
    referenceStatus: 'Self-generated curation regression anchors; no hardware/UADE truth or browser-dropout claim.',
    workletSha256: sourceHash('js/worklets/amiga/paula-exact.js'),
    playlistSha256: sourceHash('tracks/amiga/playlist.js'),
    museumSha256: sourceHash('tracks/amiga/museum.js'),
    provenanceSha256: sourceHash('tracks/amiga/classics/provenance.json'),
    corpus: {
        seconds,
        sampleRate: 48000,
        blockSize: 128,
        irregularBlockPattern: [1, 17, 64, 255, 3, 128],
        restartWarmupSeconds: 0.25,
        audibleThresholds: { a500RmsExclusive: 1e-5, a500PeakExclusive: 1e-4 },
        trackCount: tracks.length,
        formatCounts,
        finite: tracks.every(track => track.finite),
        deterministic: tracks.every(track => track.deterministic),
        blockIndependent: tracks.every(track => track.blockIndependent),
        restartIdentical: tracks.every(track => track.restartIdentical),
        audible: tracks.every(track => track.audible),
        maximumA500Peak: Math.max(...tracks.map(track => track.taps.find(tap => tap.id === 'a500').peak)),
        minimumA500Rms: Math.min(...tracks.map(track => track.taps.find(tap => tap.id === 'a500').rms)),
        silentA500Tracks: tracks.filter(track => !track.audible).map(track => track.path),
        maximumOfflineRealTimeRatio: Math.max(...tracks.map(track => track.offlineRealTimeRatio)),
        tracks
    },
    performance: {
        scope: 'Offline production worklet with three diagnostic hash taps; includes measurement overhead.',
        realTimeBudget: 1,
        withinOfflineRealTimeBudget: tracks.every(track => track.offlineRealTimeRatio < 1),
        note: 'This is not a browser underrun or device-specific performance proof.'
    }
};
report.passed = tracks.length === 73 && tracks.every(track => track.passed) &&
    report.performance.withinOfflineRealTimeBudget;

const filename = path.resolve(AMIGA_HARNESS_ROOT, args.get('report') || 'doc/verification/amiga/curation-library-corpus.json');
mkdirSync(path.dirname(filename), { recursive: true });
writeFileSync(filename, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
    passed: report.passed,
    trackCount: report.corpus.trackCount,
    formatCounts: report.corpus.formatCounts,
    maximumA500Peak: report.corpus.maximumA500Peak,
    minimumA500Rms: report.corpus.minimumA500Rms,
    silentA500Tracks: report.corpus.silentA500Tracks,
    maximumOfflineRealTimeRatio: report.corpus.maximumOfflineRealTimeRatio
}, null, 2));
if (!report.passed) process.exitCode = 1;
