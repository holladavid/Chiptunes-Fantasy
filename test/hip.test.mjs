// === test/hip.test.mjs ===
// Unkomprimierte Hippel-Dateien (68k-Player vor den Daten): Parser, Original-Code-VM, Register-Übersetzung, Spulen, Loop.
//   HIPC_FIXTURES=/pfad   (Standard: <repo>/tracks/amiga)    PAULA_EXACT / PAULA_FANTASY wie in den anderen Tests

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { parseHip, HipFormatError } from '../js/parsers/hip-parser.js';
import { parseCoso } from '../js/parsers/hipc-parser.js';
import { HipVirtualMachine, hipLayout, hipEntryPoints, HIP_BASE } from '../js/worklets/lib/hip-vm.js';
import { CosoVirtualMachine } from '../js/worklets/lib/coso-vm.js';
import { createRunner } from '../tools/m68k/hip-oracle.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = process.env.HIPC_FIXTURES || path.join(here, '..', 'tracks', 'amiga');
const amiga = (n) => path.join(here, '..', 'js', 'worklets', 'amiga', n);
const TITLE = path.join(fixtures, 'Wings_Of_Death-Title.hip');
const have = existsSync(TITLE);
const skip = !have;
const bytes = () => new Uint8Array(readFileSync(TITLE));

class Fake {
    constructor() { this.calls = []; this.chipRam = null; this.dmaEnabled = false; this.audLc = 0; this.audLen = 0; this.audPer = 0; this.audVol = 0; }
    hwAttach(r) { this.chipRam = r; }
    hwWriteLC(a) { this.audLc = a & ~1; this.calls.push(['LC', a]); }
    hwWriteLEN(w) { this.audLen = w === 0 ? 0x10000 : w; this.calls.push(['LEN', w]); }
    hwStartDMA() { this.dmaEnabled = true; this.calls.push(['START']); }
    hwStopDMA() { this.dmaEnabled = false; this.calls.push(['STOP']); }
    writeAUDxPER(p) { this.audPer = Math.max(113, p); this.calls.push(['PER', p]); }
    writeAUDxVOL(v) { this.audVol = v; this.calls.push(['VOL', v]); }
}
const fakes = () => [new Fake(), new Fake(), new Fake(), new Fake()];

function loadClass(file, cls, proc) {
    const src = readFileSync(file, 'utf8');
    const a = src.indexOf(`class ${cls} {`), b = src.indexOf(proc);
    return new Function(src.slice(a, b) + `\nreturn ${cls};`)();
}
const realKinds = [
    { name: 'exact', file: process.env.PAULA_EXACT || amiga('paula-exact.js'), cls: 'PaulaChannel', proc: 'class PaulaProcessor' },
    { name: 'fantasy', file: process.env.PAULA_FANTASY || amiga('paula-fantasy.js'), cls: 'PaulaFantasyChannel', proc: 'class PaulaFantasyProcessor' }
];

// ----------------------------------------------------------------- Layout und Parser
test('Einsprungpunkte und Layout: wie im init-Code des Players berechnet', { skip }, () => {
    const b = bytes();
    assert.deepEqual(hipEntryPoints(b), { init: 0x08, play: 0xDC });
    const L = hipLayout(b);
    assert.deepEqual([L.header, L.nI, L.nT, L.nP, L.nD, L.patBytes, L.nSongs, L.nSamples],
                     [0xA94, 39, 48, 153, 132, 64, 3, 21]);
    assert.deepEqual([L.instB, L.timB, L.patB, L.divB, L.songB, L.namB, L.pcmB], [0xAB4, 0x1474, 0x2074, 0x46B4, 0x4CE4, 0x4CFC, 0x4F72]);
});

test('parseHip: Original-Laufzeit aus dem Loop-Punkt des Players, strukturell konsistent', { skip }, () => {
    const m = parseHip(bytes(), { name: 'Title.hip' });
    assert.equal(m.format, 'HIP68K'); assert.equal(m.numChannels, 4); assert.equal(m.samples, undefined);
    assert.equal(m.length, 16896);                                       // 132 Divisions x 128 Ticks (32 Einheiten x Speed 4)
    assert.equal(m.length, m.layout.nD * 32 * m.song.speed);
    assert.equal(m.lengthIsEstimate, false);
    assert.equal(m.song.ticks, 16896);
    assert.deepEqual(m.warnings, []);
    assert.equal(m.metadata.patternCount, 153); assert.equal(m.metadata.instrumentCount, 21);
    const clone = structuredClone(m);                                    // wie postMessage an den Worklet
    assert.deepEqual(Buffer.from(clone.memory), Buffer.from(m.memory));
});

test('parseHip: Ablehnung und Fehlercodes', () => {
    assert.throws(() => parseHip(new Uint8Array(4)), (e) => e instanceof HipFormatError && e.code === 'NO_ENTRY');
    const noTfmx = new Uint8Array(0x400); noTfmx.set([0x60, 0x00, 0x00, 0x06, 0x60, 0x00, 0x00, 0x20]);
    assert.throws(() => parseHip(noTfmx), (e) => e.code === 'NO_LAYOUT');
    assert.throws(() => parseCoso(noTfmx), (e) => e.code === 'NO_LAYOUT');           // parseCoso delegiert bei BRA.W
});

test('Song-Auswahl: ungültiger Song wirft RangeError', { skip }, () => {
    assert.throws(() => parseHip(bytes(), { name: 'x', song: 9 }), RangeError);
});

test('CosoVirtualMachine liefert für HIP-Module die 68k-VM (Worklets bleiben unverändert)', { skip }, () => {
    const vm = new CosoVirtualMachine(parseHip(bytes(), { name: 'x' }), {});
    assert.equal(vm instanceof HipVirtualMachine, true);
});

// ----------------------------------------------------------------- Übersetzung Register -> Kanal-API
test('Register-Übersetzung: LC (Lang/Wort-Paar), LEN, PER+VOL (Lang), Lautstärke-Klemme, DMACON mit DMAEN', { skip }, () => {
    const vm = new HipVirtualMachine(parseHip(bytes(), { name: 'x' }), {});
    const ch = fakes(); vm.channels = ch; vm.muted = false;
    vm.lc[0] = 0;                                                         // Schattenwert aus dem init (zeigt zunächst auf $DFF0A0) zurücksetzen
    vm.customWrite(0xDFF0A0, 2, 0x00031234);                              // AUD0LCH + AUD0LCL als Langwort
    assert.deepEqual(ch[0].calls, [['LC', 0x30000], ['LC', 0x31234]]);
    vm.customWrite(0xDFF0A0, 1, 0x0004);                                  // nur AUD0LCH: das Low-Wort bleibt erhalten
    assert.deepEqual(ch[0].calls[2], ['LC', 0x41234]);
    ch[0].calls.length = 0;
    vm.customWrite(0xDFF0B4, 1, 0x0020);                                  // AUD1LEN
    assert.deepEqual(ch[1].calls, [['LEN', 0x20]]);
    vm.customWrite(0xDFF0C6, 2, (214 << 16) | 0x7F);                      // AUD2PER + AUD2VOL, Volume 127 -> 64
    assert.deepEqual(ch[2].calls, [['PER', 214], ['VOL', 64]]);
    vm.customWrite(0xDFF0DA, 1, 0x1234);                                  // AUD3DAT: ohne Wirkung
    assert.deepEqual(ch[3].calls, []);
    vm.customWrite(0xDFF096, 1, 0x800D);                                  // SET Kanal 0,2,3
    assert.deepEqual(ch.map(c => c.calls.filter(x => x[0] === 'START').length), [1, 0, 1, 1]);
    vm.customWrite(0xDFF096, 1, 0x0001);                                  // CLR Kanal 0
    assert.equal(ch[0].dmaEnabled, false);
    vm.customWrite(0xDFF096, 1, 0x800D);                                  // erneutes SET: Kanal 0 startet wieder, 2/3 laufen schon
    assert.deepEqual(ch.map(c => c.calls.filter(x => x[0] === 'START').length), [2, 0, 1, 1]);
    vm.customWrite(0xDFF096, 1, 0x0200);                                  // DMAEN (Master) löschen: alles aus
    assert.deepEqual(ch.map(c => c.dmaEnabled), [false, false, false, false]);
    vm.customWrite(0xDFF09A, 1, 0x0780); vm.customWrite(0xDFF09C, 1, 0x0780);   // INTENA/INTREQ: ohne Wirkung
});

test('Gegenprobe gegen die unabhängige Register-Dekodierung des Orakels: 600 Ticks Periode, Lautstärke, LC/LEN, DMA je Kanal', { skip }, () => {
    const track = parseHip(bytes(), { name: 'x' });
    const vm = new HipVirtualMachine(track, {});
    const ch = fakes();
    const oracle = createRunner(bytes()); oracle.init(1);
    let checkedDma = 0;
    for (let t = 0; t < 600; t++) {
        vm.processTick(ch); oracle.play();
        for (let c = 0; c < 4; c++) {
            const st = oracle.st;
            assert.equal(ch[c].audPer, Math.max(113, st.per[c]), `Tick ${t} Kanal ${c} PER`);
            assert.equal(ch[c].audVol, Math.min(64, st.vol[c]), `Tick ${t} Kanal ${c} VOL`);
            assert.equal(ch[c].audLc, st.lc[c] & ~1, `Tick ${t} Kanal ${c} LC`);
            assert.equal(ch[c].audLen, st.len[c] === 0 ? 0x10000 : st.len[c], `Tick ${t} Kanal ${c} LEN`);
            const on = (st.dmacon & (1 << c)) !== 0;
            assert.equal(ch[c].dmaEnabled, on, `Tick ${t} Kanal ${c} DMA`);
            if (on) checkedDma++;
        }
    }
    assert.ok(checkedDma > 400, 'DMA war kaum aktiv: Test wäre wirkungslos');
});

// ----------------------------------------------------------------- Loop, Position, Spulen
test('Position: 1..N im Durchlauf, springt bei 16896 und 33792 Ticks auf 1; tickCounter bleibt monoton', { skip }, () => {
    const vm = new CosoVirtualMachine(parseHip(bytes(), { name: 'x' }), {});
    const ch = fakes(), wraps = []; let prev = 0;
    for (let t = 0; t < 16896 * 2 + 5; t++) { vm.processTick(ch); if (vm.position < prev) wraps.push([t, prev, vm.position]); prev = vm.position; }
    assert.deepEqual(wraps, [[16896, 16896, 1], [33792, 16896, 1]]);
    assert.equal(vm.tickCounter, 16896 * 2 + 5);
});

test('Spulen: Zustand nach seekToTick ist bitgleich zu einem durchgehenden Lauf (Speicher, Register, Position)', { skip }, () => {
    const track = parseHip(bytes(), { name: 'x' });
    for (const target of [0, 1, 137, 5000, 16895]) {
        const a = new HipVirtualMachine(track, {}), b = new HipVirtualMachine(track, {});
        const ca = fakes(), cb = fakes();
        for (let i = 0; i < target; i++) a.processTick(ca);
        for (let i = 0; i < 1234; i++) b.processTick(cb);                // b spult MITTEN im laufenden Stück (nicht aus dem Startzustand)
        b.seekToTick(target);
        assert.equal(b.position, a.position, `Position bei ${target}`);
        assert.equal(b.tickCount, a.tickCount);
        for (let k = 0; k < 20; k++) {
            a.processTick(ca); b.processTick(cb);
            for (let c = 0; c < 4; c++) assert.deepEqual([b.lc[c], b.len[c], b.per[c], b.vol[c], b.en[c]], [a.lc[c], a.len[c], a.per[c], a.vol[c], a.en[c]], `Ziel ${target}+${k} Kanal ${c}`);
        }
        assert.deepEqual(Buffer.from(b.cpu.mem.subarray(HIP_BASE, HIP_BASE + track.memory.length)), Buffer.from(a.cpu.mem.subarray(HIP_BASE, HIP_BASE + track.memory.length)), `Speicherabbild bei ${target}`);
    }
});

test('Spulen: Klemmung auf [0, Länge-1]; tickCounter = 0 (alter SEEK-Aufruf) startet neu', { skip }, () => {
    const vm = new CosoVirtualMachine(parseHip(bytes(), { name: 'x' }), {});
    const ch = fakes();
    vm.seekToTick(10_000_000); assert.equal(vm.position, 16895);
    vm.seekToTick(-5); assert.equal(vm.position, 0);
    for (let i = 0; i < 30; i++) vm.processTick(ch);
    vm.tickCounter = 0; assert.equal(vm.position, 0); assert.equal(vm.tickCounter, 0);
});

test('Nach dem Spulen werden die Kanäle aus den Schattenregistern neu aufgebaut (Stopp, LC/LEN/PER/VOL, dann Start)', { skip }, () => {
    const vm = new HipVirtualMachine(parseHip(bytes(), { name: 'x' }), {});
    const ch = fakes();
    for (let i = 0; i < 100; i++) vm.processTick(ch);
    for (const c of ch) c.calls.length = 0;
    vm.seekToTick(5000);
    vm.processTick(ch);
    for (let c = 0; c < 4; c++) assert.deepEqual(ch[c].calls.slice(0, 5).map(x => x[0]), ['STOP', 'LC', 'LEN', 'PER', 'VOL'], `Kanal ${c}`);
});

// ----------------------------------------------------------------- Echte Kanal-Klassen
for (const k of realKinds) {
    const ok = have && existsSync(k.file);
    const Ch = ok ? loadClass(k.file, k.cls, k.proc) : null;
    const patched = ok && typeof Ch.prototype.hwStartDMA === 'function';
    const render = (vm, ch, ticks) => {
        let e = 0, n = 0, nan = 0;
        for (let t = 0; t < ticks; t++) { vm.processTick(ch); for (let s = 0; s < 882; s++) { let a = 0; for (const c of ch) a += c.step(3546895 / 44100); if (Number.isNaN(a)) nan++; e += a * a; n++; } }
        return { rms: Math.sqrt(e / n), nan };
    };

    test(`[${k.name}] 30 s über die echte Kanal-Klasse: hörbar, keine NaN`, { skip: !patched }, () => {
        const vm = new CosoVirtualMachine(structuredClone(parseHip(bytes(), { name: 'x' })), {});
        const r = render(vm, [0, 1, 2, 3].map(i => new Ch(i)), 1500);
        assert.equal(r.nan, 0); assert.ok(r.rms > 0.2 && r.rms < 1.5, `RMS ${r.rms}`);
        assert.equal(vm.failed, false);
    });

    test(`[${k.name}] Spulen mitten ins Stück: Ton ist sofort da, Pegel wie im durchgehenden Lauf`, { skip: !patched }, () => {
        const track = structuredClone(parseHip(bytes(), { name: 'x' }));
        const a = new CosoVirtualMachine(track, {}), cha = [0, 1, 2, 3].map(i => new Ch(i));
        for (let i = 0; i < 5000; i++) a.processTick(cha);
        const ref = render(a, cha, 6).rms;
        const b = new CosoVirtualMachine(track, {}), chb = [0, 1, 2, 3].map(i => new Ch(i));
        b.seekToTick(5000);
        const got = render(b, chb, 6).rms;
        assert.ok(got > 0.05, `nach dem Spulen fast stumm (${got})`);
        assert.ok(Math.abs(got / ref - 1) < 0.35, `Pegel ${got} gegen ${ref}`);          // Wellenphase ist neu, ausklingende One-Shots fehlen
    });
}

// ----------------------------------------------------------------- Robustheit
test('Endlosschleife im Player: Instruktionslimit meldet den Fehler, die VM wird stumm und blockiert nicht', { skip }, () => {
    const track = structuredClone(parseHip(bytes(), { name: 'x' }));
    track.memory[track.playOffset] = 0x60; track.memory[track.playOffset + 1] = 0xFE;      // BRA.S *  (springt auf sich selbst)
    const msgs = [];
    const vm = new HipVirtualMachine(track, {}, (m) => msgs.push(m));
    const ch = fakes();
    vm.processTick(ch);
    assert.equal(vm.failed, true);
    assert.deepEqual(ch.map(c => c.audVol), [0, 0, 0, 0]);
    assert.ok(msgs.some(m => /Player-Fehler/.test(m)));
    const calls = ch.map(c => c.calls.length); vm.processTick(ch);
    assert.deepEqual(ch.map(c => c.calls.length), calls);                                  // weitere Ticks sind wirkungslos
});

test('Kanäle ohne Hardware-DMA-API: klarer Fehler statt stiller Fehlfunktion', { skip }, () => {
    const vm = new HipVirtualMachine(parseHip(bytes(), { name: 'x' }), {});
    assert.throws(() => vm.processTick([{}, {}, {}, {}]), /Hardware-DMA-API/);
});

test('ZERO-ALLOCATION: processTick() allokiert im Dauerbetrieb nichts (braucht --expose-gc)', { skip: skip || typeof globalThis.gc !== 'function' }, () => {
    const vm = new HipVirtualMachine(parseHip(bytes(), { name: 'x' }), {});
    const ch = fakes();
    const noop = () => {};
    for (const c of ch) { c.calls = { push: noop, length: 0 }; }                                  // Aufrufprotokoll der Attrappen ausschalten
    for (let i = 0; i < 3000; i++) vm.processTick(ch);
    globalThis.gc();
    const before = process.memoryUsage().heapUsed;
    for (let i = 0; i < 60000; i++) vm.processTick(ch);
    globalThis.gc();
    const delta = process.memoryUsage().heapUsed - before;
    assert.ok(delta < 512 * 1024, `Heap-Zuwachs ${delta} Byte`);
});
