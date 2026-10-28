// Render every MOD/XM playlist entry through the production Exact Worklet.
//   node tools/amiga-modxm-corpus.mjs --seconds 1 --phase 4 \
//     --report doc/verification/amiga/phase4-modxm-corpus.json
// The hashes are regression anchors, not hardware/UADE reference proofs.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
    AMIGA_HARNESS_ROOT, loadAmigaTrack, createExactProcessor, renderExact,
    nonFiniteSamples, sha256
} from './lib/amiga-exact-harness.mjs';
import { amigaPlaylist } from '../tracks/amiga/playlist.js';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
    const key = process.argv[index];
    if (!key?.startsWith('--') || index + 1 >= process.argv.length) throw new Error(`Ungültiges Argument: ${key}`);
    args.set(key.slice(2), process.argv[index + 1]);
}
const seconds = Number(args.get('seconds') || 1);
const phase = Number(args.get('phase') || 3);
if (!(seconds > 0) || !Number.isFinite(seconds)) throw new RangeError('--seconds must be positive');
if (!Number.isInteger(phase) || phase < 0) throw new RangeError('--phase must be a non-negative integer');

const entries = amigaPlaylist.filter(entry => /\.(mod|xm)$/i.test(entry.path));
const tracks = [];
for (const entry of entries) {
    const loaded = await loadAmigaTrack(entry.path);
    const track = loaded.track;
    const run = renderExact(createExactProcessor(track), {
        seconds, outputRate: 48000, blockSize: 128
    });
    const effects = {};
    const patternRows = {};
    for (const pattern of track.patterns) {
        patternRows[pattern.numRows] = (patternRows[pattern.numRows] || 0) + 1;
        for (let offset = 0; offset < pattern.data.length; offset += 6) {
            const effect = pattern.data[offset + 4];
            const param = pattern.data[offset + 5];
            if (effect !== 0 || param !== 0) {
                const key = effect.toString(16).toUpperCase().padStart(2, '0');
                effects[key] = (effects[key] || 0) + 1;
            }
        }
    }
    tracks.push({
        path: entry.path,
        tuneSha256: sha256(loaded.bytes),
        type: track.type,
        channels: track.numChannels,
        linearFrequency: Boolean(track.linearFreq),
        patternRows,
        effects,
        nonFiniteSamples: nonFiniteSamples(run),
        taps: run.taps.map(tap => ({
            id: tap.id,
            sha256: tap.sha256,
            rms: tap.rms,
            peak: tap.peak,
            nonFiniteSamples: tap.nonFiniteSamples
        }))
    });
    console.log(`${entry.path}: finite=${nonFiniteSamples(run) === 0}`);
}

const report = {
    format: `chiptunes-fantasy-amiga-phase${phase}-modxm-corpus-v1`,
    scope: 'Every MOD/XM entry in tracks/amiga/playlist.js through the production Exact Worklet; no master processing.',
    referenceStatus: 'Self-generated regression anchors only; no hardware or UADE truth claim.',
    seconds,
    sampleRate: 48000,
    blockSize: 128,
    workletSha256: sha256(readFileSync(path.join(AMIGA_HARNESS_ROOT, 'js/worklets/amiga/paula-exact.js'))),
    trackCount: tracks.length,
    finite: tracks.every(track => track.nonFiniteSamples === 0),
    tracks
};
const filename = path.resolve(AMIGA_HARNESS_ROOT, args.get('report') || `doc/verification/amiga/phase${phase}-modxm-corpus.json`);
mkdirSync(path.dirname(filename), { recursive: true });
writeFileSync(filename, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ trackCount: report.trackCount, finite: report.finite, workletSha256: report.workletSha256 }, null, 2));
if (report.trackCount !== 10 || !report.finite) process.exitCode = 1;
