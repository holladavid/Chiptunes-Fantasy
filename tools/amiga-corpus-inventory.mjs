// Build a deterministic format/feature/diagnostic inventory of the actual
// Amiga playlist. This is analysis code only; it does not change emulation.
//   node tools/amiga-corpus-inventory.mjs \
//     --out doc/verification/amiga/phase0-corpus.json \
//     --markdown doc/verification/amiga/phase0-corpus.md
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { amigaPlaylist } from '../tracks/amiga/playlist.js';
import { CosoVirtualMachine } from '../js/worklets/lib/coso-vm.js';
import { disassembleInstrument, disassembleTimbre } from '../js/parsers/hipc-parser.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i];
    if (!key?.startsWith('--') || i + 1 >= process.argv.length) throw new Error(`Ungültiges Argument: ${key}`);
    args.set(key.slice(2), process.argv[i + 1]);
}

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const hex = value => value.toString(16).toUpperCase().padStart(2, '0');
const count = (object, key, amount = 1) => { object[key] = (object[key] || 0) + amount; };
const sortedObject = object => Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)));

globalThis.fetch = async url => {
    const filename = path.resolve(root, String(url));
    if (!filename.startsWith(root + path.sep)) throw new Error(`Pfad ausserhalb des Projekts: ${url}`);
    const bytes = readFileSync(filename);
    return {
        ok: true,
        arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    };
};

class InventoryChannel {
    hwAttach() {}
    hwWriteLC() {}
    hwWriteLEN() {}
    hwStartDMA() {}
    hwStopDMA() {}
    writeAUDxPER() {}
    writeAUDxVOL() {}
}
const channels = () => Array.from({ length: 4 }, () => new InventoryChannel());

function trackerFeatures(track, trackPath) {
    const effects = {};
    const volumeColumns = {};
    const patternRows = {};
    let eventCells = 0;
    for (const pattern of track.patterns) {
        count(patternRows, pattern.numRows);
        for (let offset = 0; offset < pattern.data.length; offset += 6) {
            const effect = pattern.data[offset + 4];
            const param = pattern.data[offset + 5];
            const volume = pattern.data[offset + 3];
            if (effect !== 0 || param !== 0) {
                count(effects, hex(effect));
                eventCells++;
            }
            if (volume !== 0xFF) count(volumeColumns, hex(volume));
        }
    }
    const samplePanning = {};
    const relativeNotes = {};
    const finetunes = {};
    let loopedSamples = 0;
    for (const sample of Object.values(track.samples || {})) {
        if (sample.pan !== undefined) count(samplePanning, sample.pan);
        if (sample.relNote) count(relativeNotes, sample.relNote);
        if (sample.finetune) count(finetunes, sample.finetune);
        if (sample.loopLen > 2) loopedSamples++;
    }
    const review = [];
    if (track.type === 'XM') {
        const bytes = readFileSync(path.join(root, 'tracks', 'amiga', trackPath));
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        review.push(`declaredInstruments:${view.getUint16(72, true)}`);
        if (track.linearFreq) review.push('linear-frequency-table-not-used-by-exact-worklet');
        if ([...Object.values(track.samples || {})].some(sample => sample.pan !== undefined && sample.pan !== 128)) {
            review.push('non-default-sample-panning-present');
        }
    }
    if (track.numChannels > 4) review.push('more-than-four-logical-channels');
    if (Object.keys(patternRows).some(rows => Number(rows) !== 64)) review.push('variable-pattern-lengths');
    return {
        orders: track.songLength,
        patterns: track.patterns.length,
        patternRows: sortedObject(patternRows),
        samples: Object.keys(track.samples || {}).length,
        loopedSamples,
        defaultSpeed: track.speed,
        defaultBpm: track.bpm,
        linearFrequency: Boolean(track.linearFreq),
        effectCells: eventCells,
        effects: sortedObject(effects),
        volumeColumns: sortedObject(volumeColumns),
        samplePanning: sortedObject(samplePanning),
        relativeNotes: sortedObject(relativeNotes),
        finetunes: sortedObject(finetunes),
        review
    };
}

function cosoFeatures(track) {
    const instrumentOpcodes = {};
    const envelopeOpcodes = {};
    const divisionEffects = {};
    for (let i = 0; i < track.header.counts.instruments; i++) {
        for (const op of disassembleInstrument(track.data, track.instrumentOffsets[i], track.instrumentEnds[i])) {
            count(instrumentOpcodes, hex(op.op));
        }
    }
    for (let i = 0; i < track.header.counts.timbres; i++) {
        const timbre = disassembleTimbre(track.data, track.timbreOffsets[i], track.timbreEnds[i]);
        for (const op of timbre.ops) count(envelopeOpcodes, hex(op.op));
    }
    for (const effect of track.divisions.effect) if (effect !== 0) count(divisionEffects, hex(effect));
    return {
        counts: { ...track.header.counts },
        songs: track.songs.map(song => ({ start: song.start, end: song.end, speed: song.speed, ticks: song.ticks })),
        pcmBytes: track.pcm.length,
        loopedSamples: track.sampleTable.filter(sample => sample.looped).length,
        instrumentOpcodes: sortedObject(instrumentOpcodes),
        envelopeOpcodes: sortedObject(envelopeOpcodes),
        divisionEffects: sortedObject(divisionEffects),
        aliasedTimbres: [...track.stats.aliasedTimbres],
        unterminatedInstruments: [...track.stats.unterminatedInstruments],
        replayerOptions: track.replayerOptions || {}
    };
}

function hipFeatures(track) {
    return {
        songs: track.songs.map(song => ({ start: song.start, end: song.end, speed: song.speed, ticks: song.ticks })),
        instruments: track.layout.nI,
        timbres: track.layout.nT,
        monopatterns: track.layout.nP,
        divisions: track.layout.nD,
        samples: track.layout.nSamples,
        pcmBytes: track.memory.length - track.layout.pcmB,
        originalM68000Replay: true
    };
}

function classifyWarning(trackPath, warning) {
    if (/abgeschnitten|TRUNCATED|PCM-Bank.*aufgefüllt/i.test(warning)) {
        return ['defect', 'Struktur- oder Integritätswarnung; vor einer Referenzbewertung beheben.'];
    }
    const verifiedWings = /Wings_Of_Death-Level_[12]\.hipc$/i.test(trackPath);
    if (verifiedWings && /Instrument.*ohne Terminator/i.test(warning)) {
        return ['confirmed-benign', 'Für Level 1/2 ist das Weiterlaufen dieser 64-Byte-Wellenprogramme bereits gegen UADE belegt.'];
    }
    return ['reference-required', 'Keine ausreichende externe Referenz für eine harmlos/Fehler-Entscheidung.'];
}

function replayDiagnostics(track, trackPath) {
    if (track.format !== 'HIP68K' && track.type !== 'HIPC' && track.type !== 'COSO') return { replay: null, diagnostics: [] };
    const vm = new CosoVirtualMachine(structuredClone(track), {});
    const fake = channels();
    const ticks = Math.max(0, Math.min(track.length || 0, 50 * 60 * 30));
    for (let tick = 0; tick < ticks; tick++) vm.processTick(fake);
    const stats = vm.replayer ? { ...vm.replayer.stats } : null;
    const replay = {
        ticksExecuted: ticks,
        position: vm.position,
        failed: Boolean(vm.failed),
        stats
    };
    const diagnostics = [];
    if (vm.failed) diagnostics.push({ kind: 'replay', classification: 'defect', message: String(vm.failure || 'HIP-Replay fehlgeschlagen'), rationale: 'Originalplayer konnte nicht vollständig ausgeführt werden.' });
    if (stats) {
        for (const key of ['badTimbre', 'badInstrument', 'badPattern', 'badSample', 'guardHits']) {
            if (stats[key]) diagnostics.push({ kind: key, classification: 'defect', message: `${key}=${stats[key]}`, rationale: 'Ungültige Referenz oder Sicherheitsgrenze im Replay.' });
        }
        if (stats.silentNotes) diagnostics.push({ kind: 'silentNotes', classification: 'reference-required', message: `silentNotes=${stats.silentNotes}`, rationale: 'Kann beabsichtigte Note-aus-Semantik oder einen Replay-Fehler bedeuten; UADE-/Originalvergleich nötig.' });
    }
    return { replay, diagnostics };
}

const provenanceFiles = [
    'tracks/amiga/playlist.js',
    'js/parsers/hipc-parser.js',
    'js/parsers/hip-parser.js',
    'js/parsers/mod-parser.js',
    'js/parsers/xm-parser.js',
    'js/worklets/amiga/paula-exact.js',
    'js/worklets/lib/coso-replayer.js',
    'js/worklets/lib/coso-vm.js',
    'js/worklets/lib/hip-vm.js',
    'js/worklets/lib/m68k.js'
];
const provenance = Object.fromEntries(provenanceFiles.map(file => [file, sha256(readFileSync(path.join(root, file))) ]));
const tracks = [];
for (let index = 0; index < amigaPlaylist.length; index++) {
    const entry = amigaPlaylist[index];
    const absolute = path.join(root, 'tracks', 'amiga', entry.path);
    const bytes = readFileSync(absolute);
    let track;
    try {
        track = await entry.loadAsync();
    } catch (error) {
        tracks.push({
            index: index + 1,
            path: entry.path,
            bytes: bytes.length,
            sha256: sha256(bytes),
            loadError: String(error?.stack || error),
            diagnostics: [{ kind: 'load', classification: 'defect', message: String(error), rationale: 'Playlist-Datei konnte nicht geladen werden.' }]
        });
        continue;
    }
    const format = track.format || track.type;
    const diagnostics = (track.warnings || []).map(warning => {
        const [classification, rationale] = classifyWarning(entry.path, warning);
        return { kind: 'parser-warning', classification, message: warning, rationale };
    });
    const replay = replayDiagnostics(track, entry.path);
    diagnostics.push(...replay.diagnostics);
    const record = {
        index: index + 1,
        path: entry.path,
        bytes: bytes.length,
        sha256: sha256(bytes),
        format,
        channels: track.numChannels,
        ticks: track.length,
        secondsAt50Hz: track.length / 50,
        lengthIsEstimate: Boolean(track.lengthIsEstimate),
        name: track.metadata?.name || null,
        warnings: [...(track.warnings || [])],
        replay: replay.replay,
        diagnostics
    };
    if (format === 'HIP68K') record.features = hipFeatures(track);
    else if (track.type === 'HIPC' || track.type === 'COSO') record.features = cosoFeatures(track);
    else record.features = trackerFeatures(track, entry.path);
    tracks.push(record);
}

const formats = {};
const classifications = { 'confirmed-benign': 0, 'reference-required': 0, defect: 0 };
let parserWarnings = 0;
let silentNotes = 0;
for (const track of tracks) {
    count(formats, track.format || 'LOAD_ERROR');
    parserWarnings += track.warnings?.length || 0;
    silentNotes += track.replay?.stats?.silentNotes || 0;
    for (const diagnostic of track.diagnostics) classifications[diagnostic.classification]++;
}
const report = {
    format: 'chiptunes-fantasy-amiga-phase0-corpus-v1',
    scope: 'All entries of tracks/amiga/playlist.js; one replay pass per Hippel track; no audio rendering.',
    trackCount: tracks.length,
    summary: {
        formats: sortedObject(formats),
        parserWarnings,
        silentNotes,
        tracksWithDiagnostics: tracks.filter(track => track.diagnostics.length).length,
        diagnosticClassifications: classifications
    },
    classification: {
        'confirmed-benign': 'Durch vorhandene externe Referenz oder Spezifikation gedeckt; kein Phase-1-Fehler allein aufgrund dieser Meldung.',
        'reference-required': 'Nicht automatisch ein Fehler; erst mit UADE/Originalquelle entscheiden.',
        defect: 'Struktur-, Lade- oder Replayfehler beziehungsweise Integritätswarnung.'
    },
    provenanceSha256: provenance,
    tracks
};

const json = JSON.stringify(report, null, 2) + '\n';
const markdown = [];
markdown.push('# Amiga Phase 0 — Korpus- und Diagnoseinventar', '');
markdown.push(`Umfang: **${report.trackCount} Playlist-Titel**. Erzeugt mit \`tools/amiga-corpus-inventory.mjs\`; Datei- und Quell-Hashes stehen im JSON-Bericht.`, '');
markdown.push('Die Klassifikation ist eine Untersuchungsentscheidung, kein Hardwarebeweis. `reference-required` bedeutet ausdrücklich nicht, dass ein Fehler bestätigt ist.', '');
markdown.push('## Zusammenfassung', '');
markdown.push('| Merkmal | Wert |', '|---|---:|');
for (const [format, amount] of Object.entries(report.summary.formats)) markdown.push(`| Format ${format} | ${amount} |`);
markdown.push(`| Parserwarnungen | ${parserWarnings} |`, `| silentNotes | ${silentNotes} |`, `| Titel mit Diagnosen | ${report.summary.tracksWithDiagnostics} |`);
for (const [name, amount] of Object.entries(classifications)) markdown.push(`| Diagnosen: ${name} | ${amount} |`);
markdown.push('', '## Titelmatrix', '');
markdown.push('| # | Titel | Format | Kanäle | Ticks | Effekte / wesentliche Merkmale | Diagnosen |', '|---:|---|---|---:|---:|---|---|');
for (const track of tracks) {
    let features = '';
    if (track.features?.effects) {
        features = Object.entries(track.features.effects).map(([effect, amount]) => `${effect}:${amount}`).join(', ') || 'keine';
        if (track.features.linearFrequency) features += '; linearFreq';
        if (track.features.patternRows && Object.keys(track.features.patternRows).some(rows => Number(rows) !== 64)) features += '; variable Zeilen';
    } else if (track.features?.instrumentOpcodes) {
        features = `Opcodes ${Object.keys(track.features.instrumentOpcodes).join('/')}; PCM ${track.features.pcmBytes} B`;
    } else if (track.features?.originalM68000Replay) {
        features = `Original-68k; ${track.features.instruments} Instrumente; PCM ${track.features.pcmBytes} B`;
    }
    const diagnostics = track.diagnostics.length
        ? track.diagnostics.map(item => `${item.classification}: ${item.message}`).join('<br>')
        : 'keine';
    markdown.push(`| ${track.index} | \`${track.path}\` | ${track.format || 'FEHLER'} | ${track.channels ?? '—'} | ${track.ticks ?? '—'} | ${features.replaceAll('|', '\\|')} | ${diagnostics.replaceAll('|', '\\|')} |`);
}
markdown.push('', '## Diagnoselegende', '');
for (const [name, explanation] of Object.entries(report.classification)) markdown.push(`- **${name}:** ${explanation}`);
const markdownText = markdown.join('\n') + '\n';

const write = (filename, content) => {
    const absolute = path.resolve(root, filename);
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, content);
};
if (args.get('out')) write(args.get('out'), json);
if (args.get('markdown')) write(args.get('markdown'), markdownText);
if (!args.get('out') && !args.get('markdown')) console.log(json);
else console.log(JSON.stringify({ trackCount: report.trackCount, summary: report.summary }, null, 2));
if (tracks.some(track => track.loadError || track.replay?.failed)) process.exitCode = 1;
