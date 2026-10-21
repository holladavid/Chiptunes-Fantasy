// === js/parsers/hip-parser.js ===
// =========================================================
// HIPPEL "HIP" (UNKOMPRIMIERT, 68k-PLAYER VOR DEN DATEN) PARSER  —  v1.5.0
// ---------------------------------------------------------
// Die Datei beginnt mit BRA.W init / BRA.W play, danach folgt der Original-Replay-Code des Komponisten, hinter der
// Signatur "TFMX" die Daten (Instrumente, Timbres, Patterns, Divisions, Songs, Sample-Tabelle, PCM). Es wird NICHT
// interpretiert: der Parser prüft nur das Layout und ermittelt die Original-Laufzeit; abgespielt wird der echte
// 68k-Code (js/worklets/lib/hip-vm.js).
//
// Ausgabe: Plain Objects + TypedArrays (structured-clone-fähig, Worklet-sicher). Bewusst KEIN Feld "samples"
// (app.js würde es als UPLOAD_SAMPLE-Dictionary verschicken).
// =========================================================

import { HipVirtualMachine, hipEntryPoints, hipLayout, hipSongTicks, HIP_BASE } from '../worklets/lib/hip-vm.js';

export class HipFormatError extends Error {
    constructor(code, message) { super(message); this.name = 'HipFormatError'; this.code = code; }
}

const be16 = (b, o) => (b[o] << 8) | b[o + 1];

export function parseHip(input, options = {}) {
    const name = options.name || 'UNKNOWN.HIP';
    const src = (input instanceof Uint8Array) ? input : new Uint8Array(input);
    const warnings = [];

    const entry = hipEntryPoints(src);
    if (!entry) throw new HipFormatError('NO_ENTRY', `"${name}": kein BRA.W-Einsprung (init/play) am Dateianfang.`);
    const layout = hipLayout(src);
    if (!layout) throw new HipFormatError('NO_LAYOUT', `"${name}": Signatur "TFMX" mit gültigem Datenlayout nicht gefunden.`);
    if (entry.init >= src.length || entry.play >= src.length) throw new HipFormatError('BAD_ENTRY', `"${name}": Einsprungadressen liegen außerhalb der Datei.`);

    // Songs (6 Byte: start, end, speed; start/end = Division-Indizes). Subsongs sind für den Player 1-basiert.
    const songs = [];
    for (let s = 0; s < layout.nSongs; s++) {
        const o = layout.songB + s * 6;
        const start = be16(src, o), end = be16(src, o + 2), speed = be16(src, o + 4);
        const valid = start <= end && end < layout.nD;
        songs.push({ index: s, start, end, speed, divisionCount: valid ? end - start + 1 : 0, valid, ticks: 0 });
    }
    if (!songs.some(s => s.valid)) throw new HipFormatError('NO_SONG', `"${name}": kein gültiger Song.`);

    let songIndex = (options.song === undefined) ? songs.findIndex(s => s.valid) : (options.song | 0);
    if (songIndex < 0 || songIndex >= songs.length) throw new RangeError(`"${name}": Song ${songIndex} existiert nicht (0..${songs.length - 1}).`);

    let memSize = 0x80000;
    while (memSize < HIP_BASE + src.length + 0x10000) memSize <<= 1;

    const track = {
        isSequenced: true,
        type: 'HIPC',
        format: 'HIP68K',
        numChannels: 4,

        memory: new Uint8Array(src),            // Dateiabbild; der Player läuft auf einer Kopie im emulierten Speicher
        base: HIP_BASE,
        memSize,
        initOffset: entry.init,
        playOffset: entry.play,
        layout,

        songs,
        selectedSong: songIndex,
        song: songs[songIndex],

        warnings,
        length: 50 * 180,                       // wird unten durch die simulierte Originallänge ersetzt (Frames @50Hz)
        lengthIsEstimate: true,

        metadata: {
            name: name.toUpperCase(),
            author: 'JOCHEN HIPPEL (MAD MAX)',
            comment: `HIPPEL UNCOMPRESSED (68K PLAYER, ${songs.filter(s => s.valid).length} SUBSONGS)`,
            type: 'Hippel-HIP (68k)',
            instrumentCount: layout.nSamples,
            patternCount: layout.nP,
            songs: songs.filter(s => s.valid).length,
            subsongCount: songs.filter(s => s.valid).length,
            fileSize: src.length
        }
    };

    // Originallaufzeit: der echte Player läuft ohne Ausgabe bis zum Loop-Punkt von Stimme 0.
    for (let i = 0; i < songs.length; i++) {
        if (!songs[i].valid) continue;
        if (i !== songIndex && !options.allSongs) continue;                 // nur der gewählte Song (Standard), alle mit allSongs:true
        const d = hipSongTicks(track, i, options.maxTicks || 90000);
        songs[i].ticks = d.complete ? d.ticks : 0;
    }
    if (track.song.ticks > 0) {
        track.length = track.song.ticks;
        track.lengthIsEstimate = false;
    } else {
        warnings.push('Songlänge nicht ermittelbar (kein Loop-Punkt erkannt); Anzeige 3:00 ist eine Schätzung.');
    }
    return track;
}

// Browser-Loader (Pendant zu loadHipcFile)
export async function loadHipFile(url, options = {}) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Datei nicht gefunden: ${url}`);
    const track = parseHip(await response.arrayBuffer(), { name: url.split('/').pop(), ...options });
    console.log(`[HIP] ${track.metadata.name}: ${track.layout.nI} instr / ${track.layout.nT} timbres / ${track.layout.nP} patterns / ` +
                `${track.layout.nD} divisions / ${track.songs.length} songs / ${track.layout.nSamples} samples, ` +
                `${(track.length / 50).toFixed(1)} s${track.lengthIsEstimate ? ' (geschätzt)' : ''}`);
    for (const w of track.warnings) console.warn(`[HIP] ${w}`);
    return track;
}
