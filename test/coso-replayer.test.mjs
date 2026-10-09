// === test/coso-replayer.test.mjs ===
// node --test "test/*.test.mjs"          (Node >= 22.7)
// Zero-Allocation-Test: node --expose-gc --test "test/*.test.mjs"
// HIPC_FIXTURES=/pfad  -> Verzeichnis mit den Wings-of-Death-Dateien (Standard: <repo>/tracks/amiga)
//
// WICHTIG: Die synthetischen Tests pinnen die IMPLEMENTIERTE Semantik (Amberstar-Spec),
// sie beweisen nicht, dass der Original-Replayer exakt so arbeitet. Belegt ist die
// Semantik nur dort, wo sie in der Spec als verifiziert markiert ist (Abschnitt 10).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { parseCoso } from '../js/parsers/hipc-parser.js';
import { CosoReplayer, REG, COSO_PERIODS, cosoSongTicks } from '../js/worklets/lib/coso-replayer.js';
import { buildCoso, WAVE32, SMP0, IDLE_PATTERN } from './helpers/coso-builder.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = process.env.HIPC_FIXTURES || path.join(here, '..', 'tracks', 'amiga');
const fx = (n) => path.join(fixtures, n);
const has = (n) => existsSync(fx(n));
const L1 = 'Wings_Of_Death-Level_1.hipc';
const L2 = 'Wings_Of_Death-Level_2.hipc';

// ---------- Synthetik-Helfer ----------
const INST0 = [0xE2, 0x00, 0x00, 0xE1];                  // Welle 0, Pitch REL 0, Ende
const INST1 = [0xE2, 0x01, 0x00, 0xE1];                  // Welle 1
const T = (instr, env = [0x3F, 0xE1], speed = 1, vib = [0, 0, 0]) => [speed, instr, ...vib, ...env];
const N = (note, info = 0, extra) => (extra === undefined ? [note, info] : [note, info, extra]);

function synth({ instruments = [INST0, INST1], timbres = [T(0), T(1)], monos, divisions, songs, ...rest }) {
    const bytes = buildCoso({
        instruments, timbres, monos, divisions,
        songs: songs || [{ start: 0, end: divisions.length - 1, speed: 1 }],
        samples: [SMP0, { ...SMP0, pos: 32 }],
        pcm: [...WAVE32, ...WAVE32], ...rest
    });
    const mod = parseCoso(bytes, { name: 'synthetic' });
    return { mod, rp: new CosoReplayer(mod) };
}
const reg = (rp, v, k) => rp.regs[v * REG.STRIDE + k];
const idle = (n) => [0, 0, 0].map(() => [n, 0, 0]);       // 3 stille Stimmen auf Pattern n

// =========================================================
test('Periodentabelle: 84 Einträge, Clamp-Oktave, Sub-Oktaven', () => {
    assert.equal(COSO_PERIODS.length, 84);
    assert.equal(COSO_PERIODS[0], 1712);
    assert.equal(COSO_PERIODS[24], 428);
    assert.equal(COSO_PERIODS[47], 113);
    for (let i = 48; i < 60; i++) assert.equal(COSO_PERIODS[i], 113);
    assert.equal(COSO_PERIODS[60], 3424);
    assert.equal(COSO_PERIODS[72], 6848);
});

test('Trigger: Periode, Volume, Sample, Flags im ersten Tick', () => {
    const { rp } = synth({ monos: [[0xFE, 0, ...N(24), 0xFF], IDLE_PATTERN], divisions: [[[0, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0]]] });
    rp.tick();
    assert.equal(reg(rp, 0, REG.PERIOD), 428);
    assert.equal(reg(rp, 0, REG.VOLUME), 63);
    assert.equal(reg(rp, 0, REG.SAMPLE), 0);
    assert.equal(reg(rp, 0, REG.FLAGS) & 3, 3);                 // RETRIGGER|ACTIVE
    assert.equal(reg(rp, 1, REG.VOLUME), 0);                    // stille Stimme
    assert.equal(reg(rp, 1, REG.SAMPLE), -1);
});

test('Division-Transpose verschiebt die Note (REL-Pitch)', () => {
    const { rp } = synth({ monos: [[0xFE, 0, ...N(24), 0xFF], IDLE_PATTERN], divisions: [[[0, 12, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0]]] });
    rp.tick();
    assert.equal(reg(rp, 0, REG.PERIOD), COSO_PERIODS[36]);
});

test('ABS-Pitch im Instrument überschreibt Note und Transpose', () => {
    const { rp } = synth({
        instruments: [[0xE2, 0x00, 0x98, 0xE1], INST1],             // 0x98 = ABS 24
        monos: [[0xFE, 0, ...N(30), 0xFF], IDLE_PATTERN], divisions: [[[0, 5, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0]]]
    });
    rp.tick();
    assert.equal(reg(rp, 0, REG.PERIOD), 428);
});

test('Instrument-Programm: Arpeggio-Loop (E0) im Tick-Raster', () => {
    const arp = [0xE2, 0x00, 0x00, 0x04, 0x07, 0xE0, 0x02];       // Pitch 0,4,7, Sprung auf Byte 2
    const { rp } = synth({ instruments: [arp, INST1], monos: [[0xFE, 7, ...N(24), 0xFF], IDLE_PATTERN], divisions: [[[0, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0]]] });
    const got = [];
    for (let i = 0; i < 6; i++) { rp.tick(); got.push(reg(rp, 0, REG.PERIOD)); }
    assert.deepEqual(got, [428, 339, 285, 428, 339, 285]);
});

test('timbre_adjust (Division-Effekt 0..$7F) verschiebt den Timbre-Index', () => {
    const { rp } = synth({ monos: [[0xFE, 0, ...N(24, 0), 0xFF], IDLE_PATTERN], divisions: [[[0, 0, 1], [1, 0, 0], [1, 0, 0], [1, 0, 0]]] });
    rp.tick();
    assert.equal(reg(rp, 0, REG.SAMPLE), 1);                    // Timbre 1 -> Instrument 1 -> Welle 1
});

test('Instrument-Override ($40) greift nur, wenn der Timbre-Header nicht $80 ist', () => {
    const a = synth({ monos: [[0xFE, 0, ...N(24, 0x40, 1), 0xFF], IDLE_PATTERN], divisions: [[[0, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0]]] });
    a.rp.tick();
    assert.equal(reg(a.rp, 0, REG.SAMPLE), 1);                  // Override: Instrument 1
    const b = synth({ timbres: [T(0x80), T(1)], monos: [[0xFE, 0, ...N(24, 0x40, 1), 0xFF], IDLE_PATTERN], divisions: [[[0, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0]]] });
    b.rp.tick();
    assert.equal(reg(b.rp, 0, REG.SAMPLE), 0);                  // $80: Override ignoriert, bleibt Instrument 0
});

test('Legato (Note mit Bit 7): neue Tonhöhe OHNE Retrigger', () => {
    const { rp } = synth({ monos: [[0xFE, 0, ...N(24), ...N(0x9F), 0xFF], IDLE_PATTERN], divisions: [[[0, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0]]] });
    rp.tick();
    assert.equal(reg(rp, 0, REG.FLAGS) & 1, 1);
    rp.tick();
    assert.equal(reg(rp, 0, REG.FLAGS) & 1, 0);                 // kein Retrigger
    assert.equal(reg(rp, 0, REG.PERIOD), COSO_PERIODS[31]);      // 0x9F & 0x7F = 31
});

test('Volume-Envelope: Schritte und Hold ($E1)', () => {
    const a = synth({ timbres: [T(0, [0x3F, 0x20, 0x10, 0xE1]), T(1)], monos: [[0xFE, 7, ...N(24), 0xFF], IDLE_PATTERN], divisions: [[[0, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0]]] });
    const va = []; for (let i = 0; i < 6; i++) { a.rp.tick(); va.push(reg(a.rp, 0, REG.VOLUME)); }
    assert.deepEqual(va, [63, 32, 16, 16, 16, 16]);
});

test('Volume-Envelope: $E8 = SUSTAIN(ticks) hält die Lautstärke (an Dragonflight belegt)', () => {
    const a = synth({ timbres: [T(0, [0x20, 0xE8, 0x03, 0x10, 0xE1]), T(1)], monos: [[0xFE, 15, ...N(24), 0xFF], IDLE_PATTERN], divisions: [[[0, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0]]] });
    const v = []; for (let i = 0; i < 8; i++) { a.rp.tick(); v.push(reg(a.rp, 0, REG.VOLUME)); }
    assert.deepEqual(v, [32, 32, 32, 32, 16, 16, 16, 16]);     // Wert 32 in Tick 0, Sustain 3 Ticks (1-3), dann 16
});

test('Volume-Envelope: $E0 = LOOP(pos), element-relativ (UNVERIFIED, Symmetrie zur Instrument-Tabelle)', () => {
    const b = synth({ timbres: [T(0, [0x20, 0x10, 0xE0, 0x05]), T(1)], monos: [[0xFE, 7, ...N(24), 0xFF], IDLE_PATTERN], divisions: [[[0, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0]]] });
    const vb = []; for (let i = 0; i < 6; i++) { b.rp.tick(); vb.push(reg(b.rp, 0, REG.VOLUME)); }
    assert.deepEqual(vb, [32, 16, 32, 16, 32, 16]);
});

test('Alias-Timbre (zwei Indexeinträge, ein Offset): Timbre 1 verhält sich wie Timbre 2', () => {
    // Timbres: [0] eigenes, [1] = Alias von [2], [2] -> Instrument 1 (Welle 1)
    const { mod, rp } = synth({ timbres: [T(0), null, T(1)], monos: [[0xFE, 0, ...N(24, 1), 0xFF], IDLE_PATTERN], divisions: [[[0, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0]]] });
    assert.deepEqual(mod.stats.aliasedTimbres, [1]);
    assert.equal(mod.timbreOffsets[1], mod.timbreOffsets[2]);
    assert.equal(mod.timbreEnds[1], mod.timbreEnds[2]);
    rp.tick();
    assert.equal(reg(rp, 0, REG.SAMPLE), 1);                    // Instrument 1 -> Welle 1
    assert.equal(reg(rp, 0, REG.VOLUME), 63);                   // Envelope des Alias ist nicht leer
});

test('Envelope-Speed: jeder Wert hält "speed" Ticks', () => {
    const { rp } = synth({ timbres: [T(0, [0x30, 0x10, 0xE1], 3), T(1)], monos: [[0xFE, 15, ...N(24), 0xFF], IDLE_PATTERN], divisions: [[[0, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0]]] });
    const v = []; for (let i = 0; i < 7; i++) { rp.tick(); v.push(reg(rp, 0, REG.VOLUME)); }
    assert.deepEqual(v, [48, 48, 48, 16, 16, 16, 16]);
});

test('Portamento ($20, Standard): proportional period*t*slope>>10, t = 1 im ersten Tick (gegen UADE belegt)', () => {
    const { rp } = synth({ monos: [[0xFE, 5, ...N(24, 0x20, 16), ...N(0x98), 0xFF], IDLE_PATTERN], divisions: [[[0, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0]]] });
    const p = []; for (let i = 0; i < 6; i++) { rp.tick(); p.push(reg(rp, 0, REG.PERIOD)); }
    for (let t = 1; t <= 6; t++) assert.equal(p[t - 1], 428 - ((428 * t * 16) >> 10), `Tick ${t}`);
    for (let i = 1; i < 6; i++) assert.ok(p[i] < p[i - 1]);
    for (let i = 0; i < 6; i++) rp.tick();                       // zweite Note (Legato) = Note 24 ohne Portamento
    assert.equal(reg(rp, 0, REG.PERIOD), 428);
});

test('Portamento, Modus "add" (früherer YouTube-Fit, verworfen): additiv (t*slope)>>5', () => {
    const bytes = buildCoso({ instruments: [INST0, INST1], timbres: [T(0), T(1)], monos: [[0xFE, 5, ...N(24, 0x20, 127), 0xFF], IDLE_PATTERN],
        divisions: [[[0, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0]]], songs: [{ start: 0, end: 0, speed: 1 }], samples: [SMP0, { ...SMP0, pos: 32 }], pcm: [...WAVE32, ...WAVE32] });
    const rp = new CosoReplayer(parseCoso(bytes, { name: 'add' }), { portMode: 'add' });
    rp.tick();
    assert.equal(reg(rp, 0, REG.PERIOD), 428 - ((1 * 127) >> 5));
});

test('Portamento: portOrder 1 zählt erst nach der Anwendung (t = 0 im ersten Tick)', () => {
    const bytes = buildCoso({ instruments: [INST0, INST1], timbres: [T(0), T(1)], monos: [[0xFE, 5, ...N(24, 0x20, 16), 0xFF], IDLE_PATTERN],
        divisions: [[[0, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0]]], songs: [{ start: 0, end: 0, speed: 1 }], samples: [SMP0, { ...SMP0, pos: 32 }], pcm: [...WAVE32, ...WAVE32] });
    const rp = new CosoReplayer(parseCoso(bytes, { name: 'ord' }), { portOrder: 1 });
    rp.tick(); assert.equal(reg(rp, 0, REG.PERIOD), 428);
    rp.tick(); assert.equal(reg(rp, 0, REG.PERIOD), 428 - ((428 * 16) >> 10));
});

test('Portamento "off" (portMode mul, portShift 0) lässt die Periode unverändert', () => {
    const bytes = buildCoso({ instruments: [INST0, INST1], timbres: [T(0), T(1)], monos: [[0xFE, 5, ...N(24, 0x20, 127), 0xFF], IDLE_PATTERN],
        divisions: [[[0, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0]]], songs: [{ start: 0, end: 0, speed: 1 }], samples: [SMP0, { ...SMP0, pos: 32 }], pcm: [...WAVE32, ...WAVE32] });
    const rp = new CosoReplayer(parseCoso(bytes, { name: 'off' }), { portMode: 'mul', portShift: 0 });
    for (let i = 0; i < 4; i++) { rp.tick(); assert.equal(reg(rp, 0, REG.PERIOD), 428); }
});

test('Tempo: duration = pattern_speed * channel_speed; Effekt $Ey setzt channel_speed', () => {
    const { rp } = synth({ monos: [[0xFE, 0, ...N(24), ...N(26), 0xFF], IDLE_PATTERN], divisions: [[[0, 0, 0xE3], [1, 0, 0], [1, 0, 0], [1, 0, 0]]] });
    const flags = []; for (let i = 0; i < 9; i++) { rp.tick(); flags.push(reg(rp, 0, REG.FLAGS) & 1); }
    assert.deepEqual(flags, [1, 0, 0, 0, 1, 0, 0, 0, 1]);       // channel_speed = 1 + 3 = 4: zweite Note bei Tick 4, Songwrap + Neustart bei Tick 8
});

test('Songende: Loop-Wrap exakt nach der Summe der Division-Längen', () => {
    const { rp } = synth({ monos: [[0xFE, 3, ...N(24), 0xFF], IDLE_PATTERN], divisions: [[[0, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0]], [[0, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0]]] });
    for (let i = 0; i < 8; i++) rp.tick();
    assert.equal(rp.loopCount, 0);
    rp.tick();
    assert.equal(rp.loopCount, 1);
});

test('FULL-STOP ($8y) beendet den Song', () => {
    const { rp } = synth({ monos: [[0xFE, 0, ...N(24), 0xFF], IDLE_PATTERN], divisions: [[[0, 0, 0x80], [1, 0, 0], [1, 0, 0], [1, 0, 0]]] });
    rp.tick();
    assert.equal(rp.finished, true);
    rp.tick();
    assert.equal(reg(rp, 0, REG.VOLUME), 0);
});

test('Letztes Instrument ohne Terminator: Zeiger erreicht das Sektionsende, Runoff wird gezählt, Sample bleibt', () => {
    const { rp } = synth({ instruments: [INST0, [0xE2, 0x01, 0x00]], timbres: [T(1), T(0)], monos: [[0xFE, 7, ...N(24), 0xFF], IDLE_PATTERN], divisions: [[[0, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0]]] });
    for (let i = 0; i < 5; i++) rp.tick();
    assert.ok(rp.stats.instRunoff >= 1);
    assert.equal(reg(rp, 0, REG.SAMPLE), 1);
});

test('reset(): identische Register-Folge nach Neustart', () => {
    const { rp } = synth({ monos: [[0xFE, 1, ...N(24), ...N(26), 0xFF], IDLE_PATTERN], divisions: [[[0, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0]]] });
    const run = () => { const o = []; for (let i = 0; i < 12; i++) { rp.tick(); o.push(Array.from(rp.regs).join(',')); } return o.join('|'); };
    const a = run(); rp.reset(); const b = run();
    assert.equal(a, b);
});

// =========================================================
// Wings of Death (Fixtures)
// =========================================================
const loadMod = (n, song = 0) => parseCoso(new Uint8Array(readFileSync(fx(n))), { name: n, song });

test('Level 1 Song 0: Loop-Länge 10752 Ticks, alle Stimmen synchron, keine ungültigen Referenzen', { skip: !has(L1) }, () => {
    const rp = new CosoReplayer(loadMod(L1));
    for (let i = 0; i < 10752; i++) rp.tick();
    assert.equal(rp.loopCount, 0);
    rp.tick();
    assert.equal(rp.loopCount, 1);
    for (let v = 1; v < 4; v++) assert.equal(rp.voices[v].loops, 1);
    for (let i = 0; i < 12000; i++) rp.tick();
    const s = rp.stats;
    assert.deepEqual([s.badTimbre, s.badInstrument, s.badPattern, s.badSample, s.guardHits, s.silentNotes], [0, 0, 0, 0, 0, 0]);
});

test('Level 2 Song 0: Loop-Länge 8000 Ticks; Level 1 Song 1 (speed 3): 384 Ticks', { skip: !has(L1) || !has(L2) }, () => {
    const a = new CosoReplayer(loadMod(L2));
    for (let i = 0; i < 8000; i++) a.tick();
    assert.equal(a.loopCount, 0); a.tick(); assert.equal(a.loopCount, 1);
    const b = new CosoReplayer(loadMod(L1, 1), { song: 1 });
    for (let i = 0; i < 384; i++) b.tick();                     // 4 Divisions x 96 Ticks (speed 3 statt 2)
    assert.equal(b.loopCount, 0); b.tick(); assert.equal(b.loopCount, 1);
});

test('Level 1: Perioden im gültigen Bereich, Volume 0..64', { skip: !has(L1) }, () => {
    const rp = new CosoReplayer(loadMod(L1));
    for (let i = 0; i < 11000; i++) {
        rp.tick();
        for (let v = 0; v < 4; v++) {
            const p = reg(rp, v, REG.PERIOD), vol = reg(rp, v, REG.VOLUME);
            assert.ok(p === 0 || (p >= 113 && p <= 6848 + 6848 * 0.01), `tick ${i} v${v} period ${p}`);
            assert.ok(vol >= 0 && vol <= 64);
        }
    }
});

test('Level 1: Regressions-Pin der ersten 4 Ticks (selbst erzeugt, KEIN Wahrheitsbeweis)', { skip: !has(L1) }, () => {
    const rp = new CosoReplayer(loadMod(L1));
    const rows = [];
    for (let i = 0; i < 4; i++) {
        rp.tick();
        let line = '';
        for (let v = 0; v < 4; v++) line += `P${reg(rp, v, REG.PERIOD)} V${reg(rp, v, REG.VOLUME)} S${reg(rp, v, REG.SAMPLE)} F${reg(rp, v, REG.FLAGS)}|`;
        rows.push(line);
    }
    assert.deepEqual(rows, [
        'P428 V38 S8 F3|P339 V38 S8 F3|P856 V38 S8 F3|P1712 V0 S-1 F0|',
        'P428 V31 S8 F2|P339 V31 S8 F2|P856 V31 S8 F2|P1712 V0 S-1 F0|',
        'P428 V31 S9 F3|P339 V31 S9 F3|P856 V31 S9 F3|P1712 V0 S-1 F0|',
        'P428 V31 S9 F2|P339 V31 S9 F2|P856 V31 S9 F2|P1712 V0 S-1 F0|'
    ]);
});

test('ZERO-ALLOCATION: tick() allokiert im Dauerbetrieb nichts (braucht --expose-gc)', { skip: !has(L1) || typeof globalThis.gc !== 'function' }, () => {
    const rp = new CosoReplayer(loadMod(L1));
    for (let i = 0; i < 3000; i++) rp.tick();                   // Aufwärmen (JIT)
    globalThis.gc();
    const before = process.memoryUsage().heapUsed;
    for (let i = 0; i < 300000; i++) rp.tick();                 // 100 Minuten Musik
    globalThis.gc();
    const delta = process.memoryUsage().heapUsed - before;
    assert.ok(delta < 256 * 1024, `Heap-Zuwachs ${delta} Byte`);
});

// =========================================================
// Phase 5: waveChange-Modi (Wellenwechsel MITTEN in einer Note)
// =========================================================
function waveSynth(instr, waveChange, extra = {}) {
    const bytes = buildCoso({
        instruments: [instr, INST1], timbres: [T(0), T(1)],
        monos: [[0xFE, 7, ...N(24), 0xFF], IDLE_PATTERN], divisions: [[[0, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0]]],
        songs: [{ start: 0, end: 0, speed: 1 }], samples: [SMP0, { ...SMP0, pos: 32 }], pcm: [...WAVE32, ...WAVE32]
    });
    return new CosoReplayer(parseCoso(bytes, { name: 'w' }), { waveChange, ...extra });
}
const flagsOf = (rp, n) => { const o = []; for (let i = 0; i < n; i++) { rp.tick(); o.push(reg(rp, 0, REG.FLAGS) & 5); } return o; };

const TR = { triggerRestart: true };                          // alte Annahme: jeder Note-Trigger startet die DMA neu

test('waveChange: anderes Sample mitten in der Note -> restart: Neustart, latch/hybrid: nur Latch', () => {
    const instr = [0xE2, 0x00, 0x00, 0xE2, 0x01, 0x00, 0xE1];         // Welle 0, 1 Tick, dann Welle 1
    assert.deepEqual(flagsOf(waveSynth(instr, 'restart', TR), 3), [1, 1, 0]);
    assert.deepEqual(flagsOf(waveSynth(instr, 'latch', TR), 3), [1, 4, 0]);
    assert.deepEqual(flagsOf(waveSynth(instr, 'hybrid', TR), 3), [1, 4, 0]);
});

test('waveChange "split": $E4 latcht, $E2 startet neu (Wellenwechsel mitten in der Note)', () => {
    const viaE4 = [0xE2, 0x00, 0x00, 0xE4, 0x01, 0x00, 0xE1];
    const viaE2 = [0xE2, 0x00, 0x00, 0xE2, 0x01, 0x00, 0xE1];
    assert.deepEqual(flagsOf(waveSynth(viaE4, 'split'), 3), [1, 4, 0]);
    assert.deepEqual(flagsOf(waveSynth(viaE2, 'split'), 3), [1, 1, 0]);
    assert.deepEqual(flagsOf(waveSynth(viaE4, 'restart'), 3), [1, 1, 0]);   // zur Gegenprobe: restart behandelt beide gleich
});

test('waveChange mit triggerRestart:true: gleiches Sample mit reset=1 -> restart/hybrid: Neustart, latch: Latch', () => {
    const instr = [0xE2, 0x00, 0x00, 0xE2, 0x00, 0x00, 0xE1];
    assert.deepEqual(flagsOf(waveSynth(instr, 'restart', TR), 3), [1, 1, 0]);
    assert.deepEqual(flagsOf(waveSynth(instr, 'hybrid', TR), 3), [1, 1, 0]);
    assert.deepEqual(flagsOf(waveSynth(instr, 'latch', TR), 3), [1, 4, 0]);
});

test('waveChange mit triggerRestart:true: Note-Trigger startet die DMA in jedem Modus neu', () => {
    const instr = [0xE2, 0x00, 0x00, 0xE1];
    for (const m of ['restart', 'latch', 'hybrid']) assert.equal(flagsOf(waveSynth(instr, m, TR), 1)[0] & 1, 1, m);
});

// =========================================================
// Dragonflight Title Tune (zweites COSO-Modul, andere Opcodes)
// =========================================================
const DF = 'dragonflight_titletune.HIPC';
test('Dragonflight: Parser ohne Warnungen, Alias-Timbre 3 erkannt, Songlänge 22880 Ticks (Speed 5)', { skip: !has(DF) }, () => {
    const mod = loadMod(DF);
    assert.deepEqual(mod.warnings, []);
    assert.deepEqual(mod.stats.aliasedTimbres, [3]);
    assert.deepEqual(mod.header.counts, { instruments: 13, timbres: 23, monopatterns: 94, divisions: 170, songs: 1, samples: 10 });
    assert.equal(mod.song.speed, 5);
    const rp = new CosoReplayer(mod);
    for (let i = 0; i < 22880; i++) rp.tick();
    assert.equal(rp.loopCount, 0);
    rp.tick();
    assert.equal(rp.loopCount, 1);
    for (let i = 0; i < 25000; i++) rp.tick();
    const s = rp.stats;
    assert.deepEqual([s.badTimbre, s.badInstrument, s.badPattern, s.badSample, s.guardHits, s.silentNotes, s.instRunoff], [0, 0, 0, 0, 0, 0, 0]);
});

test('Dragonflight: Timbre 3 (Alias von Timbre 4) wird getriggert und ist stumm (Note-aus)', { skip: !has(DF) }, () => {
    const mod = loadMod(DF), rp = new CosoReplayer(mod);
    let triggers = 0, audible = 0;
    for (let i = 0; i < 22880; i++) {
        rp.tick();
        for (let v = 0; v < 4; v++) {
            const vo = rp.voices[v];
            if (vo.timbre === 3 && vo.active) {
                if (reg(rp, v, REG.FLAGS) & 1) triggers++;
                if (reg(rp, v, REG.VOLUME) > 0) audible++;
            }
        }
    }
    assert.ok(triggers >= 90, `Trigger ${triggers}`);
    assert.equal(audible, 0);                                   // Envelope "00 00 E1": Lautstärke 0 statt Reststand der Vornote
});

// =========================================================
// Phase 8: Messungen gegen UADE (Abschnitt 15 der Spec)
// =========================================================
test('Standard: Note-Trigger allein startet die DMA nicht neu, $E2 tut es, $E4 nicht', () => {
    const viaE2 = [0xE2, 0x01, 0x00, 0xE1];
    const viaE4 = [0xE4, 0x01, 0x00, 0xE1];
    assert.deepEqual(flagsOf(waveSynth(viaE2, 'split'), 2), [1, 0]);   // $E2: Neustart
    assert.deepEqual(flagsOf(waveSynth(viaE4, 'split'), 2), [4, 0]);   // $E4: nur Latch, die Welle läuft phasenstetig weiter
    assert.deepEqual(flagsOf(waveSynth(viaE4, 'split', TR), 2), [1, 0]);
});

function vibSynth(vib, extra = {}) {
    const bytes = buildCoso({
        instruments: [INST0, INST1], timbres: [T(0, [0x3F, 0xE1], 1, vib), T(1)],
        monos: [[0xFE, 15, ...N(24), 0xFF], IDLE_PATTERN], divisions: [[[0, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0]]],
        songs: [{ start: 0, end: 0, speed: 1 }], samples: [SMP0, { ...SMP0, pos: 32 }], pcm: [...WAVE32, ...WAVE32]
    });
    return new CosoReplayer(parseCoso(bytes, { name: 'vib' }), extra);
}
const periods = (rp, n) => { const o = []; for (let i = 0; i < n; i++) { rp.tick(); o.push(reg(rp, 0, REG.PERIOD)); } return o; };

test('Vibrato slope 0: konstanter Offset +depth/2 (an Dragonflight Instrument 5 belegt, R2 0.98)', () => {
    const p = periods(vibSynth([0, 48, 0]), 4);
    assert.deepEqual(p, [428 + ((428 * 24) >> 10), 428 + ((428 * 24) >> 10), 428 + ((428 * 24) >> 10), 428 + ((428 * 24) >> 10)]);
});

test('Vibrato: erste Anwendung nutzt den Startwert, erst danach wird weitergeschaltet (vibOrder 1)', () => {
    const p = periods(vibSynth([4, 20, 0]), 5);                     // pos: +10 -> +6 -> +2 -> -2 -> -6
    const exp = [10, 6, 2, -2, -6].map(v => 428 + (v < 0 ? -((428 * -v) >> 10) : (428 * v) >> 10));
    assert.deepEqual(p, exp);
});

test('Vibrato: während der Verzögerung gilt KEIN Offset (belegt: vibDelayStatic wäre schlechter)', () => {
    const p = periods(vibSynth([0, 48, 3]), 5);
    assert.deepEqual(p.slice(0, 3), [428, 428, 428]);
    assert.equal(p[3], 428 + ((428 * 24) >> 10));
});

test('Vibrato: negative Werte runden Richtung Null (vibRound 1), vibRound 0 rundet ab', () => {
    const neg = [0, 8, 0];                                          // slope 0 hält +4; mit Startwert unten -4
    const trunc = periods(vibSynth(neg, { vibStart: 2 }), 1)[0];
    const floor = periods(vibSynth(neg, { vibStart: 2, vibRound: 0 }), 1)[0];
    assert.equal(trunc, 428 - ((428 * 4) >> 10));
    assert.equal(floor, 428 + ((428 * -4) >> 10));
    assert.ok(trunc > floor);
});

test('Instrument ohne Terminator läuft in die Bytes des Folge-Instruments weiter (Standard "continue", gegen UADE belegt)', () => {
    // I0 = [E2 00, 00] ohne Terminator, direkt dahinter I1 = [E2 01, 00, E1]
    const { rp } = synth({ instruments: [[0xE2, 0x00, 0x00], [0xE2, 0x01, 0x00, 0xE1]], monos: [[0xFE, 15, ...N(24), 0xFF], IDLE_PATTERN],
        divisions: [[[0, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0]]] });
    const smp = []; for (let i = 0; i < 4; i++) { rp.tick(); smp.push(reg(rp, 0, REG.SAMPLE)); }
    assert.deepEqual(smp, [0, 1, 1, 1]);                         // Tick 1: der Zeiger erreicht das Folge-Instrument
});

test('runoff "hold": Instrument ohne Terminator bleibt am Elementende stehen (Messhaken)', () => {
    const bytes = buildCoso({ instruments: [[0xE2, 0x00, 0x00], [0xE2, 0x01, 0x00, 0xE1]], timbres: [T(0), T(1)], monos: [[0xFE, 15, ...N(24), 0xFF], IDLE_PATTERN],
        divisions: [[[0, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0]]], songs: [{ start: 0, end: 0, speed: 1 }], samples: [SMP0, { ...SMP0, pos: 32 }], pcm: [...WAVE32, ...WAVE32] });
    const rp = new CosoReplayer(parseCoso(bytes, { name: 'hold' }), { runoff: 'hold' });
    const smp = []; for (let i = 0; i < 4; i++) { rp.tick(); smp.push(reg(rp, 0, REG.SAMPLE)); }
    assert.deepEqual(smp, [0, 0, 0, 0]);
});

test('envSpec: Envelope-Opcodes wie in der Amberstar-Spec ($E0 SUSTAIN, $E8 LOOP) sind als Messhaken verfügbar', () => {
    const bytes = buildCoso({ instruments: [INST0, INST1], timbres: [T(0, [0x20, 0xE0, 0x03, 0x10, 0xE1]), T(1)], monos: [[0xFE, 15, ...N(24), 0xFF], IDLE_PATTERN],
        divisions: [[[0, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0]]], songs: [{ start: 0, end: 0, speed: 1 }], samples: [SMP0, { ...SMP0, pos: 32 }], pcm: [...WAVE32, ...WAVE32] });
    const rp = new CosoReplayer(parseCoso(bytes, { name: 'spec' }), { envSpec: true });
    const v = []; for (let i = 0; i < 6; i++) { rp.tick(); v.push(reg(rp, 0, REG.VOLUME)); }
    assert.deepEqual(v, [32, 32, 32, 32, 16, 16]);
});

// =========================================================
// Laufzeit, Position im Durchlauf, Seek
// =========================================================
const twoDivSong = (effect1 = 0) => synth({ monos: [[0xFE, 3, ...N(24), 0xFF], IDLE_PATTERN],
    divisions: [[[0, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0]], [[0, 0, effect1], [1, 0, 0], [1, 0, 0], [1, 0, 0]]] });

test('cosoSongTicks: synthetischer Song aus 2 Divisions à 4 Ticks = 8 Ticks', () => {
    const { mod } = twoDivSong();
    assert.deepEqual(cosoSongTicks(mod, 0), { ticks: 8, complete: true });
});

test('cosoSongTicks: FULL-STOP ($8y) beendet den Song vor dem Loop-Punkt', () => {
    const { mod } = twoDivSong(0x80);
    assert.deepEqual(cosoSongTicks(mod, 0), { ticks: 4, complete: true });
});

test('cosoSongTicks: Sicherheitsgrenze meldet complete:false statt zu hängen', () => {
    const { mod } = twoDivSong();
    assert.deepEqual(cosoSongTicks(mod, 0, 5), { ticks: 5, complete: false });
});

test('passTick: zählt 1..N im Durchlauf und springt beim Loop-Wrap auf 1', () => {
    const { rp } = twoDivSong();
    const seen = []; for (let i = 0; i < 18; i++) { rp.tick(); seen.push(rp.passTick); }
    assert.deepEqual(seen, [1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4, 5, 6, 7, 8, 1, 2]);
    assert.equal(rp.tickCount, 18);                              // tickCount bleibt monoton
});

test('seek(): Zustand nach dem Spulen ist bitgleich zu einem durchgehenden Lauf (synthetisch)', () => {
    const a = twoDivSong().rp, b = twoDivSong().rp;
    for (const target of [0, 1, 3, 4, 7, 8, 9, 13]) {
        b.seek(target);
        a.reset(); for (let i = 0; i < target; i++) a.tick();
        for (let k = 0; k < 12; k++) {
            a.tick(); b.tick();
            assert.deepEqual(Array.from(b.regs), Array.from(a.regs), `Ziel ${target}, Folgetick ${k}`);
        }
        assert.equal(b.passTick, a.passTick); assert.equal(b.tickCount, a.tickCount);
    }
});

for (const [file, song, ticks] of [[L1, 0, 10752], [L1, 1, 384], [L2, 0, 8000], ['dragonflight_titletune.HIPC', 0, 22880]]) {
    test(`Original-Laufzeit ${file} Song ${song} = ${ticks} Ticks (${(ticks / 50).toFixed(2)} s)`, { skip: !has(file) }, () => {
        assert.deepEqual(cosoSongTicks(loadMod(file, song), song), { ticks, complete: true });
    });
}

test('seek(): auf echten Daten bitgleich zu einem durchgehenden Lauf (Dragonflight, 5 Ziele)', { skip: !has('dragonflight_titletune.HIPC') }, () => {
    const mod = loadMod('dragonflight_titletune.HIPC');
    const a = new CosoReplayer(mod), b = new CosoReplayer(mod);
    for (const target of [1, 777, 5000, 12345, 22879]) {
        b.seek(target); a.reset(); for (let i = 0; i < target; i++) a.tick();
        for (let k = 0; k < 40; k++) { a.tick(); b.tick(); assert.deepEqual(Array.from(b.regs), Array.from(a.regs), `Ziel ${target}+${k}`); }
    }
});
