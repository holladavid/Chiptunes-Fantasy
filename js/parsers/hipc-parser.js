// === js/parsers/hipc-parser.js ===
// =========================================================
// JOCHEN HIPPEL (MAD MAX) COSO / HIPC PARSER  —  v1.5.0
// ---------------------------------------------------------
// Reiner Daten-Parser. KEINE Heuristiken, KEINE Signatur-Scans,
// KEINE Interpretation von Opcodes zur Laufzeit (das macht die VM).
//
// Layout verifiziert an Wings_Of_Death-Level_1/2.hipc
// (siehe doc/specs/hipc-coso-verified-spec.md):
//
//   $00 "COSO" | $04..$1C 7x u32 Sektions-Positionen | $20 "TFMX"
//   $24.. u16 Counts (instr/timbre/mono/div = n-1, songs/samples direkt)
//   Sektionen: Instruments | Timbres | Monopatterns (je u16-Index)
//              Divisions (12 B) | Songs (6 B) | Sample-Header (10 B)
//   danach die PCM-Bank (Sample-Positionen sind PCM-relativ!)
//
// Ausgabe: flache TypedArrays + Plain Objects (postMessage-/Worklet-sicher,
// structured-clone-kompatibel, keine Klasseninstanzen).
// =========================================================

export class CosoFormatError extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'CosoFormatError';
        this.code = code;
    }
}

const HEADER_BYTES = 0x34;
const PAD_TOLERANCE_BYTES = 32;     // fehlende Bank-Bytes am Dateiende werden mit 0 aufgefüllt
const DIVISION_BYTES = 12;
const SONG_BYTES = 6;
const SAMPLE_HEADER_BYTES = 10;

// ---------------------------------------------------------
// Opcode-Tabellen (Längen = Grammatik; Semantik: siehe Spec)
// Verifiziert (Tiling) nur für E0,E1,E2,E4 + Pitch. E3,E5..E9
// stammen aus der Amberstar-Spec und sind in L1/L2 NICHT belegt.
// ---------------------------------------------------------
export const COSO_INSTRUMENT_OPS = Object.freeze({
    0xE0: Object.freeze({ name: 'LOOP',          args: 1 }),
    0xE1: Object.freeze({ name: 'END',           args: 0 }),
    0xE2: Object.freeze({ name: 'SAMPLE',        args: 1 }),
    0xE3: Object.freeze({ name: 'VIBRATO',       args: 2 }),
    0xE4: Object.freeze({ name: 'SAMPLE_E4',     args: 1 }),  // Reset-Semantik ggü. E2 unbestätigt
    0xE5: Object.freeze({ name: 'SAMPLE_SLIDE',  args: 8 }),  // sample,loop16,len16,delta16,speed
    0xE6: Object.freeze({ name: 'SLIDE',         args: 5 }),  // len16,delta16,speed
    0xE7: Object.freeze({ name: 'SAMPLE_KEEP',   args: 1 }),
    0xE8: Object.freeze({ name: 'DELAY',         args: 1 }),
    0xE9: Object.freeze({ name: 'SAMPLE_OFFSET', args: 2 })
});

// ---------------------------------------------------------
// Byte-Helfer (Big-Endian)
// ---------------------------------------------------------
function be16(b, o) { return (b[o] << 8) | b[o + 1]; }
function be32(b, o) { return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0; }
function s8(v) { return (v << 24) >> 24; }
function tag(b, o) { return String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]); }

// ---------------------------------------------------------
// DISASSEMBLER (Debug / HUD / Tests — darf allozieren)
// ---------------------------------------------------------
export function disassembleInstrument(data, start, end) {
    const ops = [];
    let o = start;
    while (o < end) {
        const c = data[o];
        const pc = o - start;
        if (c < 0xE0) {
            ops.push({ pc, op: c, name: (c & 0x80) ? 'PITCH_ABS' : 'PITCH_REL', args: [c & 0x7F] });
            o++;
            continue;
        }
        const def = COSO_INSTRUMENT_OPS[c];
        if (!def) {
            ops.push({ pc, op: c, name: 'UNKNOWN', args: [] });
            o++;
            continue;
        }
        if (o + 1 + def.args > end) {
            ops.push({ pc, op: c, name: def.name, args: [], truncated: true });
            o = end;
            break;
        }
        const args = [];
        for (let i = 0; i < def.args; i++) args.push(data[o + 1 + i]);
        ops.push({ pc, op: c, name: def.name, args });
        o += 1 + def.args;
    }
    return ops;
}

export function disassembleTimbre(data, start, end) {
    const header = (end - start >= 5)
        ? { speed: data[start], instrument: data[start + 1], vibSlope: data[start + 2],
            vibDepth: data[start + 3], vibDelay: data[start + 4] }
        : null;
    const ops = [];
    let o = start + 5;
    while (header && o < end) {
        const c = data[o];
        const pc = o - start;
        if (c === 0xE0 || c === 0xE8) {
            // E8 = SUSTAIN(ticks) (belegt an Dragonflight), E0 = LOOP(pos) (Symmetrie zur Instrument-Tabelle, UNVERIFIED)
            const nm = (c === 0xE8) ? 'SUSTAIN' : 'LOOP';
            if (o + 1 >= end) { ops.push({ pc, op: c, name: nm, args: [], truncated: true }); o = end; break; }
            ops.push({ pc, op: c, name: nm, args: [data[o + 1]] });
            o += 2;
        } else if (c >= 0xE1 && c <= 0xE7) {
            ops.push({ pc, op: c, name: 'HOLD', args: [] });
            o++;
        } else {
            ops.push({ pc, op: c, name: 'VOLUME', args: [c] });
            o++;
        }
    }
    return { header, ops };
}

export function disassembleMonopattern(data, start, end) {
    const events = [];
    let o = start;
    let terminated = false;
    while (o < end) {
        const c = data[o];
        const pc = o - start;
        if (c === 0xFF) { events.push({ pc, kind: 'END' }); o++; terminated = true; break; }
        if (c === 0xFE || c === 0xFD) {
            if (o + 1 >= end) { events.push({ pc, kind: 'TRUNCATED' }); o = end; break; }
            events.push({ pc, kind: c === 0xFE ? 'SPEED' : 'DELAY', ticks: data[o + 1] });
            o += 2;
            continue;
        }
        if (o + 1 >= end) { events.push({ pc, kind: 'TRUNCATED' }); o = end; break; }
        const info = data[o + 1];
        let extra = -1;
        let len = 2;
        if (info & 0xE0) {
            if (o + 2 >= end) { events.push({ pc, kind: 'TRUNCATED' }); o = end; break; }
            extra = data[o + 2];
            len = 3;
        }
        events.push({ pc, kind: 'NOTE', note: s8(c), info, extra });
        o += len;
    }
    return { events, terminated, endPc: o - start };
}

// ---------------------------------------------------------
// INDEX-TABELLE (u16 Offsets relativ zum Header, streng geprüft)
// ---------------------------------------------------------
function readIndexTable(b, label, tablePos, count, sectionEnd) {
    const tableEnd = tablePos + count * 2;
    if (tableEnd > sectionEnd) {
        throw new CosoFormatError('BAD_INDEX_TABLE', `${label}: Index-Tabelle (${count} Einträge) passt nicht in ihre Sektion.`);
    }
    const off = new Uint32Array(count + 1);
    let prev = tableEnd;
    for (let i = 0; i < count; i++) {
        const v = be16(b, tablePos + i * 2);
        if (v < prev || v > sectionEnd) {
            throw new CosoFormatError('BAD_INDEX_TABLE', `${label}[${i}]: Offset $${v.toString(16)} ausserhalb [$${prev.toString(16)}..$${sectionEnd.toString(16)}].`);
        }
        off[i] = v;
        prev = v;
    }
    off[count] = sectionEnd;

    // Elementende = nächster STRENG größerer Offset. Das Original dedupliziert identische Elemente:
    // zwei Indexeinträge zeigen dann auf denselben Offset (Alias), das Element des ersten ist NICHT leer.
    const ends = new Uint32Array(count);
    const aliased = [];
    ends[count - 1] = sectionEnd;
    for (let i = count - 2; i >= 0; i--) ends[i] = (off[i + 1] > off[i]) ? off[i + 1] : ends[i + 1];
    for (let i = 0; i + 1 < count; i++) if (off[i + 1] === off[i]) aliased.push(i);
    return { off, ends, aliased };
}

const hex = (n) => '$' + n.toString(16).toUpperCase();

// =========================================================
// PURE PARSE-FUNKTION (Node- und Browser-tauglich, kein fetch)
// =========================================================
export function parseCoso(input, options = {}) {
    const name = options.name || 'UNKNOWN.HIPC';
    const src = (input instanceof Uint8Array) ? input : new Uint8Array(input);
    const warnings = [];

    // ---------- 1. Container-Erkennung ----------
    if (src.length >= 2 && src[0] === 0x60 && src[1] === 0x00) {
        throw new CosoFormatError('UNSUPPORTED_HIPPEL_68K',
            `"${name}" ist kein COSO-Container, sondern das Hippel-Format mit 68k-Replayer am Dateianfang (BRA.W). ` +
            `Dieses Format wird von diesem Parser nicht unterstützt.`);
    }
    if (src.length < HEADER_BYTES) {
        throw new CosoFormatError('TOO_SHORT', `"${name}": Datei zu kurz für einen COSO-Header (${src.length} Byte).`);
    }
    if (tag(src, 0) !== 'COSO') {
        throw new CosoFormatError('BAD_MAGIC', `"${name}": Magic "COSO" fehlt (gefunden: "${tag(src, 0)}").`);
    }
    if (tag(src, 0x20) !== 'TFMX') {
        throw new CosoFormatError('BAD_TFMX', `"${name}": Signatur "TFMX" bei $20 fehlt (gefunden: "${tag(src, 0x20)}").`);
    }

    // ---------- 2. Header ----------
    const pos = {
        instruments:  be32(src, 0x04),
        timbres:      be32(src, 0x08),
        monopatterns: be32(src, 0x0C),
        divisions:    be32(src, 0x10),
        songs:        be32(src, 0x14),
        samples:      be32(src, 0x18),
        total:        be32(src, 0x1C)
    };
    const counts = {
        instruments:  be16(src, 0x24) + 1,
        timbres:      be16(src, 0x26) + 1,
        monopatterns: be16(src, 0x28) + 1,
        divisions:    be16(src, 0x2A) + 1,
        songs:        be16(src, 0x30),      // direkt
        samples:      be16(src, 0x32)       // direkt
    };
    const word2C = be16(src, 0x2C);
    const word2E = be16(src, 0x2E);

    const order = [pos.instruments, pos.timbres, pos.monopatterns, pos.divisions, pos.songs, pos.samples, pos.total];
    if (order[0] < HEADER_BYTES) {
        throw new CosoFormatError('BAD_HEADER', `"${name}": pos_instruments ${hex(order[0])} liegt im Header.`);
    }
    for (let i = 1; i < order.length; i++) {
        if (order[i] <= order[i - 1]) {
            throw new CosoFormatError('BAD_HEADER', `"${name}": Sektions-Positionen nicht streng aufsteigend (Index ${i}).`);
        }
    }
    if (pos.total > src.length) {
        throw new CosoFormatError('TRUNCATED', `"${name}": total_length ${hex(pos.total)} liegt hinter dem Dateiende (${hex(src.length)}).`);
    }

    // ---------- 3. Index-Sektionen ----------
    const instT = readIndexTable(src, 'Instrument',  pos.instruments,  counts.instruments,  pos.timbres);
    const timbT = readIndexTable(src, 'Timbre',      pos.timbres,      counts.timbres,      pos.monopatterns);
    const monoT = readIndexTable(src, 'Monopattern', pos.monopatterns, counts.monopatterns, pos.divisions);
    const instrumentOffsets = instT.off, timbreOffsets = timbT.off, monopatternOffsets = monoT.off;
    const instrumentEnds = instT.ends, timbreEnds = timbT.ends, monopatternEnds = monoT.ends;

    // ---------- 4. Divisions (12 B: je Stimme pattern,transpose,effect) ----------
    const divBytes = pos.songs - pos.divisions;
    if (divBytes !== counts.divisions * DIVISION_BYTES) {
        throw new CosoFormatError('BAD_DIVISIONS', `"${name}": Division-Sektion ${divBytes} B != ${counts.divisions} x ${DIVISION_BYTES} B.`);
    }
    const nDiv = counts.divisions;
    const divPattern   = new Uint8Array(nDiv * 4);
    const divTranspose = new Int8Array(nDiv * 4);
    const divEffect    = new Uint8Array(nDiv * 4);
    for (let d = 0; d < nDiv; d++) {
        for (let v = 0; v < 4; v++) {
            const o = pos.divisions + d * DIVISION_BYTES + v * 3;
            const k = d * 4 + v;
            divPattern[k]   = src[o];
            divTranspose[k] = s8(src[o + 1]);
            divEffect[k]    = src[o + 2];
            if (src[o] >= counts.monopatterns) {
                warnings.push(`Division ${d} Stimme ${v}: Monopattern ${src[o]} existiert nicht (max ${counts.monopatterns - 1}).`);
            }
        }
    }

    // ---------- 5. Songs (6 B: start,end,speed; end = INKLUSIVER Division-Index) ----------
    const songSlots = Math.floor((pos.samples - pos.songs) / SONG_BYTES);
    if (counts.songs < 1 || counts.songs > songSlots) {
        throw new CosoFormatError('BAD_SONGS', `"${name}": num_songs=${counts.songs}, Sektion fasst ${songSlots} Slots.`);
    }
    const songs = [];
    for (let s = 0; s < counts.songs; s++) {
        const o = pos.songs + s * SONG_BYTES;
        const start = be16(src, o);
        const end = be16(src, o + 2);
        const speed = be16(src, o + 4);
        const valid = start <= end && end < nDiv;
        if (!valid) warnings.push(`Song ${s}: ungültiger Division-Bereich ${start}..${end} (Divisions: ${nDiv}).`);
        if (speed === 0) warnings.push(`Song ${s}: speed = 0.`);
        songs.push({ index: s, start, end, speed, divisionCount: valid ? end - start + 1 : 0, valid });
    }

    // ---------- 6. Sample-Header (10 B) ----------
    const sampleSlots = Math.floor((pos.total - pos.samples) / SAMPLE_HEADER_BYTES);
    if (counts.samples > sampleSlots) {
        throw new CosoFormatError('BAD_SAMPLES', `"${name}": num_samples=${counts.samples}, Sektion fasst ${sampleSlots} Slots.`);
    }
    const sampleTable = [];
    let bankNeeded = 0;
    for (let i = 0; i < counts.samples; i++) {
        const o = pos.samples + i * SAMPLE_HEADER_BYTES;
        const start = be32(src, o);
        const length = be16(src, o + 4) * 2;
        const loopPos = be16(src, o + 6);
        const repeat = be16(src, o + 8) * 2;
        let looped = repeat > 2;                       // 1 Word = kein Loop (Amiga-Konvention)
        let loopStart = loopPos;
        let loopLength = looped ? repeat : 0;
        if (looped && loopStart + loopLength > length) {
            warnings.push(`Sample ${i}: Loop ${loopStart}+${loopLength} überragt Länge ${length}; Loop wird deaktiviert.`);
            looped = false; loopStart = 0; loopLength = 0;
        }
        if (start & 1) warnings.push(`Sample ${i}: Startposition ${hex(start)} ist nicht word-aligned.`);
        if (start + length > bankNeeded) bankNeeded = start + length;
        sampleTable.push({ index: i, start, length, loopStart, loopLength, looped });
    }

    // ---------- 7. PCM-Bank (+ tolerantes Auffüllen bei knapp zu kurzen Rips) ----------
    const bankAvail = src.length - pos.total;
    let padBytes = 0;
    if (bankNeeded > bankAvail) {
        const missing = bankNeeded - bankAvail;
        if (missing > PAD_TOLERANCE_BYTES) {
            throw new CosoFormatError('TRUNCATED', `"${name}": PCM-Bank um ${missing} Byte zu kurz (Toleranz ${PAD_TOLERANCE_BYTES}).`);
        }
        padBytes = missing;
        warnings.push(`PCM-Bank um ${missing} Byte zu kurz; mit Nullen aufgefüllt.`);
    }
    const bankBuf = new ArrayBuffer(bankAvail + padBytes);
    new Uint8Array(bankBuf).set(src.subarray(pos.total), 0);
    const pcm = new Int8Array(bankBuf);                // vorzeichenbehaftet, Paula-nativ

    // ---------- 8. Moduldaten (Offsets bleiben datei-absolut) ----------
    const data = new Uint8Array(pos.total);
    data.set(src.subarray(0, pos.total), 0);

    // ---------- 9. Strukturprüfung der Programme (nur Grammatik) ----------
    const instrumentFlags = new Uint8Array(counts.instruments);   // bit0: kein E0/E1 im Programm
    const unterminatedInstruments = [];
    for (let i = 0; i < counts.instruments; i++) {
        const ops = disassembleInstrument(data, instrumentOffsets[i], instrumentEnds[i]);
        let hasTerm = false;
        for (let k = 0; k < ops.length; k++) {
            if (ops[k].op === 0xE0 || ops[k].op === 0xE1) hasTerm = true;
            if (ops[k].name === 'UNKNOWN') warnings.push(`Instrument ${i}: unbekannter Opcode ${hex(ops[k].op)} bei +${ops[k].pc}.`);
            if (ops[k].truncated) warnings.push(`Instrument ${i}: Opcode ${hex(ops[k].op)} überragt das Elementende.`);
        }
        if (!hasTerm) { instrumentFlags[i] |= 1; unterminatedInstruments.push(i); }
    }

    const timbreFlags = new Uint8Array(counts.timbres);           // bit0: keine Terminierung (E0 LOOP, E1..E7 HOLD)
    const unterminatedTimbres = [];
    for (let t = 0; t < counts.timbres; t++) {
        const tim = disassembleTimbre(data, timbreOffsets[t], timbreEnds[t]);
        if (!tim.header) { warnings.push(`Timbre ${t}: Element kürzer als der 5-Byte-Header.`); timbreFlags[t] |= 1; unterminatedTimbres.push(t); continue; }
        if (tim.header.instrument !== 0x80 && tim.header.instrument >= counts.instruments) {
            warnings.push(`Timbre ${t}: Instrument ${tim.header.instrument} existiert nicht.`);
        }
        let hasTerm = false;
        for (let k = 0; k < tim.ops.length; k++) {
            const c = tim.ops[k].op;
            if (c >= 0xE0 && c <= 0xE7) hasTerm = true;
        }
        if (!hasTerm) { timbreFlags[t] |= 1; unterminatedTimbres.push(t); }
    }

    let totalNoteEvents = 0;
    for (let p = 0; p < counts.monopatterns; p++) {
        const mp = disassembleMonopattern(data, monopatternOffsets[p], monopatternEnds[p]);
        if (!mp.terminated) warnings.push(`Monopattern ${p}: kein $FF-Ende innerhalb des Elements.`);
        for (let k = 0; k < mp.events.length; k++) if (mp.events[k].kind === 'NOTE') totalNoteEvents++;
    }

    // ---------- 10. Song-Auswahl ----------
    const songIndex = (options.song === undefined) ? 0 : options.song | 0;
    if (songIndex < 0 || songIndex >= songs.length) {
        throw new RangeError(`"${name}": Song ${songIndex} existiert nicht (0..${songs.length - 1}).`);
    }

    const displayName = name.toUpperCase();
    return {
        isSequenced: true,
        type: 'HIPC',
        format: 'COSO',
        numChannels: 4,

        header: { pos, counts, word2C, word2E, songSlots, sampleSlots },

        data,                                   // Datei-Bytes [0, total_length), Offsets datei-absolut
        instrumentOffsets,                      // Uint32Array(n+1), letzter Eintrag = Sektionsende
        timbreOffsets,
        monopatternOffsets,
        instrumentEnds,                         // Uint32Array(n): Elementende, alias-fest (nächster größerer Offset)
        timbreEnds,
        monopatternEnds,
        instrumentFlags,                        // bit0 = kein Terminator (E0/E1)
        timbreFlags,                            // bit0 = keine Terminierung (E1..E8)

        divisions: { count: nDiv, pattern: divPattern, transpose: divTranspose, effect: divEffect },
        songs,
        selectedSong: songIndex,
        song: songs[songIndex],

        sampleTable,                            // bewusst NICHT "samples": app.js würde es als UPLOAD_SAMPLE-Dictionary verschicken
        pcm,                                    // Int8Array, PCM-Bank (Sample-Positionen sind relativ dazu)

        warnings,
        stats: {
            unterminatedInstruments, unterminatedTimbres, noteEvents: totalNoteEvents, padBytes,
            aliasedInstruments: instT.aliased, aliasedTimbres: timbT.aliased, aliasedMonopatterns: monoT.aliased
        },

        length: 50 * 180,                       // PLATZHALTER (Frames @50Hz) bis die VM die echte Songlänge liefert
        lengthIsEstimate: true,

        metadata: {
            name: displayName,
            author: 'JOCHEN HIPPEL (MAD MAX)',
            comment: `HIPPEL-COSO (${counts.songs} SONG${counts.songs === 1 ? '' : 'S'}, 4 VOICES)`,
            type: 'Hippel-COSO',
            instrumentCount: counts.samples,
            patternCount: counts.monopatterns,
            songs: counts.songs,
            subsongCount: counts.songs,
            fileSize: src.length
        }
    };
}

// =========================================================
// BROWSER-LOADER (bisherige API bleibt erhalten)
// =========================================================
export async function loadHipcFile(url, options = {}) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Datei nicht gefunden: ${url}`);
    const buffer = await response.arrayBuffer();
    const mod = parseCoso(buffer, { name: url.split('/').pop(), ...options });

    console.log(`[COSO] ${mod.metadata.name}: ${mod.header.counts.instruments} instr / ${mod.header.counts.timbres} timbres / ` +
                `${mod.header.counts.monopatterns} patterns / ${mod.header.counts.divisions} divisions / ` +
                `${mod.songs.length} songs / ${mod.sampleTable.length} samples (PCM ${mod.pcm.length} B)`);
    for (let i = 0; i < mod.warnings.length; i++) console.warn(`[COSO] ${mod.warnings[i]}`);
    return mod;
}
