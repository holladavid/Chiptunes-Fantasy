// === test/hipc-parser.test.mjs ===
// Läuft ohne Abhängigkeiten:  node --test "test/*.test.mjs"        (Node >= 22.7)
// Fixture-Verzeichnis:        HIPC_FIXTURES=/pfad node --test "test/*.test.mjs"
// Standard:                   <repo>/tracks/amiga/

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { buildCoso } from './helpers/coso-builder.mjs';
import {
    parseCoso, CosoFormatError,
    disassembleInstrument, disassembleMonopattern
} from '../js/parsers/hipc-parser.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = process.env.HIPC_FIXTURES || path.join(here, '..', 'tracks', 'amiga');
const fx = (n) => path.join(fixtures, n);
const has = (n) => existsSync(fx(n));
const load = (n) => new Uint8Array(readFileSync(fx(n)));

const L1 = 'Wings_Of_Death-Level_1.hipc';
const L2 = 'Wings_Of_Death-Level_2.hipc';
const TITLE = 'Wings_Of_Death-Title.hip';

test('Level 1: Header, Counts und Sektionen', { skip: !has(L1) }, () => {
    const m = parseCoso(load(L1), { name: L1 });
    assert.equal(m.type, 'HIPC');
    assert.equal(m.numChannels, 4);
    assert.deepEqual(m.header.pos, {
        instruments: 0x40, timbres: 0x2E4, monopatterns: 0x3E4, divisions: 0x9EE,
        songs: 0x11FE, samples: 0x1210, total: 0x136E
    });
    assert.deepEqual(m.header.counts, {
        instruments: 22, timbres: 12, monopatterns: 89, divisions: 172, songs: 2, samples: 34
    });
    assert.equal(m.instrumentOffsets.length, 23);
    assert.equal(m.instrumentOffsets[0], 0x6C);
    assert.equal(m.instrumentOffsets[1], 0x74);
    assert.equal(m.monopatternOffsets[89], 0x9EE);
});

test('Level 2: Header, Counts und Sektionen', { skip: !has(L2) }, () => {
    const m = parseCoso(load(L2), { name: L2 });
    assert.deepEqual(m.header.counts, {
        instruments: 15, timbres: 16, monopatterns: 57, divisions: 125, songs: 1, samples: 34
    });
    assert.equal(m.header.pos.total, 0x0EDC);
});

test('Songs partitionieren die Divisions lückenlos (end ist inklusiv)', { skip: !has(L1) || !has(L2) }, () => {
    const m1 = parseCoso(load(L1), { name: L1 });
    assert.deepEqual(m1.songs.map(s => [s.start, s.end, s.speed, s.divisionCount]),
                     [[0, 167, 2, 168], [168, 171, 3, 4]]);
    assert.equal(m1.songs[1].end + 1, m1.divisions.count);

    const m2 = parseCoso(load(L2), { name: L2 });
    assert.deepEqual(m2.songs.map(s => [s.start, s.end, s.speed]), [[0, 124, 2]]);
    assert.equal(m2.songs[0].end + 1, m2.divisions.count);
});

test('Divisions: erste Zeile Level 1', { skip: !has(L1) }, () => {
    const m = parseCoso(load(L1), { name: L1 });
    assert.deepEqual(Array.from(m.divisions.pattern.subarray(0, 4)), [0x43, 0x4A, 0x50, 0x00]);
    assert.deepEqual(Array.from(m.divisions.transpose.subarray(0, 4)), [0, 0, -12, 0]);
    assert.deepEqual(Array.from(m.divisions.effect.subarray(0, 4)), [5, 5, 5, 0]);
});

test('PCM-Bank: Positionen PCM-relativ, Ende == Bankgröße, identisch in L1/L2', { skip: !has(L1) || !has(L2) }, () => {
    const m1 = parseCoso(load(L1), { name: L1 });
    const m2 = parseCoso(load(L2), { name: L2 });
    assert.equal(m1.pcm.length, 13308);
    const last = m1.sampleTable[m1.sampleTable.length - 1];
    assert.equal(last.start + last.length, m1.pcm.length);
    assert.deepEqual(Buffer.from(m1.pcm), Buffer.from(m2.pcm));
    assert.equal(m1.pcm instanceof Int8Array, true);
    // Wave 0: erste Bytes c0 c0 d0 d8 (vorzeichenbehaftet)
    assert.deepEqual(Array.from(m1.pcm.subarray(0, 4)), [-64, -64, -48, -40]);
});

test('Sample-Tabelle: 16 Synth-Wellen, Sample 18 mit Loop, Rest ohne', { skip: !has(L1) }, () => {
    const m = parseCoso(load(L1), { name: L1 });
    for (let i = 0; i < 16; i++) {
        assert.equal(m.sampleTable[i].length, 32);
        assert.equal(m.sampleTable[i].looped, true);
        assert.equal(m.sampleTable[i].loopStart, 0);
        assert.equal(m.sampleTable[i].loopLength, 32);
    }
    const s18 = m.sampleTable[18];
    assert.deepEqual([s18.start, s18.length, s18.looped, s18.loopStart, s18.loopLength],
                     [0x3F2, 6552, true, 0x1028, 1208]);
    assert.equal(m.sampleTable[17].looped, false);   // repeat = 1 Word -> kein Loop
});

test('Grammatik: alle Monopatterns terminieren, keine Warnungen', { skip: !has(L1) || !has(L2) }, () => {
    for (const n of [L1, L2]) {
        const m = parseCoso(load(n), { name: n });
        assert.deepEqual(m.warnings, [], `${n}: ${m.warnings.join(' | ')}`);
        for (let p = 0; p < m.header.counts.monopatterns; p++) {
            const mp = disassembleMonopattern(m.data, m.monopatternOffsets[p], m.monopatternOffsets[p + 1]);
            assert.equal(mp.terminated, true, `${n}: Monopattern ${p}`);
        }
    }
});

test('Unterminierte Instrumente (64-Byte-Wave-Animationen) werden gemeldet', { skip: !has(L1) || !has(L2) }, () => {
    const m1 = parseCoso(load(L1), { name: L1 });
    const m2 = parseCoso(load(L2), { name: L2 });
    assert.deepEqual(m1.stats.unterminatedInstruments, [9, 11, 12, 13, 15]);
    assert.deepEqual(m2.stats.unterminatedInstruments, [9, 11]);
    for (const [m, i] of [[m1, 9], [m1, 15], [m2, 9]]) {
        assert.equal(m.instrumentOffsets[i + 1] - m.instrumentOffsets[i], 64);
        assert.equal(m.instrumentFlags[i] & 1, 1);
    }
    // Instrument 0 (L1): e2 13 98 98 e2 12 11 e1
    const ops = disassembleInstrument(m1.data, m1.instrumentOffsets[0], m1.instrumentOffsets[1]);
    assert.deepEqual(ops.map(o => o.name),
        ['SAMPLE', 'PITCH_ABS', 'PITCH_ABS', 'SAMPLE', 'PITCH_REL', 'END']);
});

test('2-Byte-Defizit: zu kurze Bank wird aufgefüllt (mit Warnung)', { skip: !has(L1) }, () => {
    const full = load(L1);
    const cut = full.subarray(0, full.length - 2);
    const m = parseCoso(cut, { name: L1 });
    assert.equal(m.stats.padBytes, 2);
    assert.equal(m.pcm.length, 13308);
    assert.equal(m.warnings.length, 1);
    assert.equal(m.pcm[13307], 0);
});

test('Zu stark verstümmelte Datei wird abgelehnt', { skip: !has(L1) }, () => {
    const full = load(L1);
    assert.throws(() => parseCoso(full.subarray(0, full.length - 100), { name: L1 }),
        (e) => e instanceof CosoFormatError && e.code === 'TRUNCATED');
});

test('Title.hip (68k-Replayer-Format) wird mit eindeutigem Code abgelehnt', { skip: !has(TITLE) }, () => {
    assert.throws(() => parseCoso(load(TITLE), { name: TITLE }),
        (e) => e instanceof CosoFormatError && e.code === 'UNSUPPORTED_HIPPEL_68K');
});

test('Müll und falsche Signaturen', () => {
    assert.throws(() => parseCoso(new Uint8Array(10)), (e) => e.code === 'TOO_SHORT');
    const junk = new Uint8Array(256); junk[0] = 0x58;
    assert.throws(() => parseCoso(junk), (e) => e.code === 'BAD_MAGIC');
    const noTfmx = new Uint8Array(256); noTfmx.set([0x43, 0x4F, 0x53, 0x4F], 0);
    assert.throws(() => parseCoso(noTfmx), (e) => e.code === 'BAD_TFMX');
});

test('Song-Auswahl: gültig und ausserhalb', { skip: !has(L1) }, () => {
    const m = parseCoso(load(L1), { name: L1, song: 1 });
    assert.equal(m.selectedSong, 1);
    assert.equal(m.song.start, 168);
    assert.throws(() => parseCoso(load(L1), { name: L1, song: 2 }), RangeError);
});

test('Ausgabe ist structured-clone-tauglich (postMessage an den Worklet)', { skip: !has(L1) }, () => {
    const m = parseCoso(load(L1), { name: L1 });
    const clone = structuredClone(m);
    assert.deepEqual(Buffer.from(clone.pcm), Buffer.from(m.pcm));
    assert.equal(clone.songs.length, 2);
    assert.equal(clone.samples, undefined);          // darf nicht als UPLOAD_SAMPLE-Dictionary erscheinen
});

test('Alias-Einträge der Indextabellen: Elementende ist der nächste größere Offset', () => {
    const bytes = buildCoso({
        instruments: [[0xE2, 0, 0, 0xE1]], timbres: [[1, 0, 0, 0, 0, 0x3F, 0xE1], null, [2, 0, 0, 0, 0, 0x20, 0xE1]],
        monos: [[0xFE, 0, 24, 0, 0xFF]], divisions: [[[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]],
        songs: [{ start: 0, end: 0, speed: 1 }], samples: [{ pos: 0, len: 32, loop: 0, rep: 32 }], pcm: new Array(32).fill(1)
    });
    const m = parseCoso(bytes, { name: 'alias' });
    assert.deepEqual(m.warnings, []);
    assert.deepEqual(m.stats.aliasedTimbres, [1]);
    assert.equal(m.timbreOffsets[1], m.timbreOffsets[2]);
    assert.equal(m.timbreEnds[1], m.timbreEnds[2]);
    assert.ok(m.timbreEnds[1] - m.timbreOffsets[1] >= 5, 'Alias-Element darf nicht leer sein');
    assert.equal(m.timbreEnds[0], m.timbreOffsets[1]);
});

test('length ist die echte Originallaufzeit in Ticks, kein 3-Minuten-Platzhalter', { skip: !has(L1) || !has(L2) }, () => {
    const m1 = parseCoso(load(L1), { name: L1 });
    assert.equal(m1.length, 10752);
    assert.equal(m1.lengthIsEstimate, false);
    assert.deepEqual(m1.songs.map(x => x.ticks), [10752, 384]);
    assert.equal(parseCoso(load(L1), { name: L1, song: 1 }).length, 384);       // Länge folgt dem gewählten Song
    const m2 = parseCoso(load(L2), { name: L2 });
    assert.equal(m2.length, 8000);
    assert.notEqual(m2.length, 50 * 180);
});

test('length: synthetischer Song, FULL-STOP-Song und Song ohne Ende (Schätzung)', () => {
    const mk = (eff1) => buildCoso({
        instruments: [[0xE2, 0, 0, 0xE1]], timbres: [[1, 0, 0, 0, 0, 0x3F, 0xE1]], monos: [[0xFE, 3, 24, 0, 0xFF]],
        divisions: [[[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], [[0, 0, eff1], [0, 0, 0], [0, 0, 0], [0, 0, 0]]],
        songs: [{ start: 0, end: 1, speed: 1 }], samples: [{ pos: 0, len: 32, loop: 0, rep: 32 }], pcm: new Array(32).fill(1)
    });
    assert.equal(parseCoso(mk(0), { name: 'a' }).length, 8);
    assert.equal(parseCoso(mk(0x80), { name: 'b' }).length, 4);
    const est = parseCoso(mk(0), { name: 'c', maxTicks: 3 });
    assert.equal(est.length, 50 * 180);                                          // Grenze erreicht -> alter Platzhalter
    assert.equal(est.lengthIsEstimate, true);
});
