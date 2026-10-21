// === test/coso-vm.test.mjs ===
// Integrationstest des Adapters gegen die ECHTE PaulaChannel-Klasse aus paula-exact.js.
// PAULA_EXACT=/pfad/paula-exact.js  (Standard: <repo>/js/worklets/amiga/paula-exact.js)
// HIPC_FIXTURES=/pfad               (Standard: <repo>/tracks/amiga)

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { parseCoso } from '../js/parsers/hipc-parser.js';
import { CosoVirtualMachine, CHIP_BASE, SILENCE_LC } from '../js/worklets/lib/coso-vm.js';
import { CosoReplayer, REG } from '../js/worklets/lib/coso-replayer.js';
import { buildCoso, WAVE32, SMP0, IDLE_PATTERN } from './helpers/coso-builder.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = process.env.HIPC_FIXTURES || path.join(here, '..', 'tracks', 'amiga');
const paulaPath = process.env.PAULA_EXACT || path.join(here, '..', 'js', 'worklets', 'amiga', 'paula-exact.js');
const fantasyPath = process.env.PAULA_FANTASY || path.join(here, '..', 'js', 'worklets', 'amiga', 'paula-fantasy.js');
const L1 = path.join(fixtures, 'Wings_Of_Death-Level_1.hipc');
const haveL1 = existsSync(L1);
const havePaula = existsSync(paulaPath);

function loadPaulaChannel() {
    const src = readFileSync(paulaPath, 'utf8');
    const a = src.indexOf('class PaulaChannel {');
    const b = src.indexOf('class PaulaProcessor');
    assert.ok(a >= 0 && b > a, 'PaulaChannel in paula-exact.js nicht gefunden');
    return new Function(src.slice(a, b) + '\nreturn PaulaChannel;')();
}
const loadMod = () => parseCoso(new Uint8Array(readFileSync(L1)), { name: 'L1' });
const skip = !haveL1;

class FakeChannel {
    constructor() { this.calls = []; }
    writeAUDxLC(a, buf, ls, ll) { this.calls.push(['LC', buf.length, ls, ll]); }
    writeAUDxLEN(w) { this.calls.push(['LEN', w]); }
    writeAUDxPER(p) { this.calls.push(['PER', p]); }
    writeAUDxVOL(v) { this.calls.push(['VOL', v]); }
    enableDMA(buf, ls, ll) { this.calls.push(['DMA', buf.constructor.name, buf.length, ls, ll]); }
    disableDMA() { this.calls.push(['OFF']); }
}

test('Adapter lehnt Tracks im alten Parser-Format ab', () => {
    assert.throws(() => new CosoVirtualMachine({ type: 'HIPC', header: {}, samples: {} }, {}), /v1\.5-COSO-Modul/);
    assert.throws(() => new CosoVirtualMachine(null, {}), /v1\.5-COSO-Modul/);
});

test('Erster Tick: DMA für Stimmen 0-2 mit Sample-Sicht, Stimme 3 bleibt stumm', { skip }, () => {
    const vm = new CosoVirtualMachine(loadMod(), {});
    const ch = [new FakeChannel(), new FakeChannel(), new FakeChannel(), new FakeChannel()];
    vm.processTick(ch);
    for (let v = 0; v < 3; v++) {
        const dma = ch[v].calls.find(c => c[0] === 'DMA');
        assert.ok(dma, `Stimme ${v}: kein enableDMA`);
        assert.deepEqual(dma.slice(1), ['Int8Array', 32, 0, 16]);           // Welle 8: 32 Byte, Loop 0..32 Byte
        assert.deepEqual(ch[v].calls.find(c => c[0] === 'LEN'), ['LEN', 16]);
        assert.ok(ch[v].calls.find(c => c[0] === 'VOL')[1] > 0);
    }
    assert.equal(ch[3].calls.some(c => c[0] === 'DMA'), false);
    assert.deepEqual(ch[3].calls, [['VOL', 0]]);
});

test('Sample-Sichten teilen sich den PCM-Puffer (kein Kopieren, keine Allokation im Tick)', { skip }, () => {
    const mod = loadMod();
    const vm = new CosoVirtualMachine(mod, {});
    for (let i = 0; i < mod.sampleTable.length; i++) {
        assert.equal(vm.views[i].length, mod.sampleTable[i].length);
        assert.equal(vm.views[i].buffer, mod.pcm.buffer);
        assert.equal(vm.views[i].byteOffset, mod.sampleTable[i].start);
    }
});

test('Echte PaulaChannel: 4 s Wiedergabe über structuredClone, hörbarer Pegel, gültige Register', { skip: skip || !havePaula }, () => {
    const Paula = loadPaulaChannel();
    const mod = structuredClone(loadMod());                                    // wie postMessage an den Worklet
    const vm = new CosoVirtualMachine(mod, {});
    const ch = [0, 1, 2, 3].map(i => new Paula(i));
    const CLOCK = 3546895, RATE = 44100;
    let energy = 0, peak = 0, nan = 0;
    for (let tick = 0; tick < 200; tick++) {
        vm.processTick(ch);
        for (const c of ch) assert.ok(c.audPer >= 113 && c.audVol >= 0 && c.audVol <= 64);
        for (let s = 0; s < RATE / 50; s++) {
            let acc = 0;
            for (const c of ch) acc += c.step(CLOCK / RATE);
            if (Number.isNaN(acc)) nan++;
            energy += acc * acc; peak = Math.max(peak, Math.abs(acc));
        }
    }
    assert.equal(nan, 0);
    assert.ok(energy > 1, `Energie ${energy}`);
    assert.ok(peak > 0.05 && peak < 4.5, `Spitzenpegel ${peak}`);
});

test('tickCounter: Lesen liefert Fortschritt, Schreiben von 0 startet neu (SEEK)', { skip }, () => {
    const vm = new CosoVirtualMachine(loadMod(), {});
    const a = [new FakeChannel(), new FakeChannel(), new FakeChannel(), new FakeChannel()];
    vm.processTick(a);
    const first = JSON.stringify(a.map(c => c.calls));
    for (let i = 0; i < 50; i++) vm.processTick([new FakeChannel(), new FakeChannel(), new FakeChannel(), new FakeChannel()]);
    assert.equal(vm.tickCounter, 51);
    vm.tickCounter = 0;
    assert.equal(vm.tickCounter, 0);
    const b = [new FakeChannel(), new FakeChannel(), new FakeChannel(), new FakeChannel()];
    vm.processTick(b);
    assert.equal(JSON.stringify(b.map(c => c.calls)), first);                 // identisch zum allerersten Tick
});

test('Alter SEEK-Block aus paula-exact.js/paula-fantasy.js läuft ohne Fehler und ohne Schaden', { skip }, () => {
    const vm = new CosoVirtualMachine(loadMod(), {});
    const chans = [new FakeChannel(), new FakeChannel(), new FakeChannel(), new FakeChannel()];
    for (let i = 0; i < 20; i++) vm.processTick(chans);
    // exakt der Code aus den Worklets:
    vm.tickCounter = 0;
    for (let v = 0; v < 4; v++) {
        vm.voices[v].trackPtr = vm.voices[v].startTrackPtr;
        vm.voices[v].patternPtr = -1;
        vm.voices[v].wait = 0;
        vm.voices[v].trackStack = [];
    }
    assert.equal(vm.tickCounter, 0);
    vm.processTick(chans);
    assert.equal(vm.tickCounter, 1);
});

// =========================================================
// Phase 5: Hardware-Pfad (Chip-RAM, LC/LEN-Latch)
// =========================================================
class HwFakeChannel {
    constructor() { this.calls = []; this.chipRam = null; }
    hwAttach(ram) { this.chipRam = ram; this.calls.push(['ATTACH']); }
    hwWriteLC(a) { this.calls.push(['LC', a]); }
    hwWriteLEN(w) { this.calls.push(['LEN', w]); }
    hwStartDMA() { this.calls.push(['START']); }
    writeAUDxPER(p) { this.calls.push(['PER', p]); }
    writeAUDxVOL(v) { this.calls.push(['VOL', v]); }
}
const hwChans = () => [new HwFakeChannel(), new HwFakeChannel(), new HwFakeChannel(), new HwFakeChannel()];

test('Chip-RAM: Bank liegt ab CHIP_BASE, Stille-Wort bei 0, wortweise gepolstert', { skip }, () => {
    const mod = loadMod();
    const vm = new CosoVirtualMachine(mod, {});
    assert.equal(vm.chipRam.length % 2, 0);
    assert.equal(vm.chipRam[0], 0); assert.equal(vm.chipRam[1], 0);
    assert.equal(SILENCE_LC, 0);
    for (let i = 0; i < mod.pcm.length; i += 97) assert.equal(vm.chipRam[CHIP_BASE + i], mod.pcm[i]);
});

test('Hardware-Pfad, erster Tick: Registerfolge LC/LEN -> START -> Loop-LC/LEN', { skip }, () => {
    const mod = loadMod();
    const vm = new CosoVirtualMachine(mod, {});
    const ch = hwChans();
    vm.processTick(ch);
    const lc = CHIP_BASE + mod.sampleTable[8].start;                  // Welle 8: 32 Byte, ganzer Loop
    const prime = [['ATTACH'], ['LC', SILENCE_LC], ['LEN', 1], ['START']];   // wie der Original-Player: DMA läuft auf dem Stille-Wort
    assert.deepEqual(ch[0].calls, [...prime, ['PER', 428], ['VOL', 38], ['LC', lc], ['LEN', 16], ['START'], ['LC', lc], ['LEN', 16]]);
    assert.deepEqual(ch[3].calls, [...prime, ['VOL', 0]]);            // Stimme 3 stumm, nur das Stille-Wort
});

function oneShotMod() {
    const bytes = buildCoso({
        instruments: [[0xE2, 0x00, 0x00, 0xE2, 0x02, 0x00, 0xE1], [0xE2, 0x01, 0x00, 0xE1]],
        timbres: [[1, 0, 0, 0, 0, 0x3F, 0xE1], [1, 1, 0, 0, 0, 0x3F, 0xE1]],
        monos: [[0xFE, 7, 24, 0, 0xFF], IDLE_PATTERN], divisions: [[[0, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0]]],
        songs: [{ start: 0, end: 0, speed: 1 }],
        samples: [SMP0, { ...SMP0, pos: 32 }, { pos: 64, len: 16, loop: 0, rep: 2 }],     // Sample 2 = One-Shot
        pcm: [...WAVE32, ...WAVE32, ...new Array(16).fill(5)]
    });
    return parseCoso(bytes, { name: 'oneshot' });
}

test('latch: One-Shot mitten in der Note -> nur LC/LEN, danach Folge-Latch auf Stille', () => {
    const mod = oneShotMod();
    const vm = new CosoVirtualMachine(mod, {}, null, { waveChange: 'latch' });
    const ch = hwChans();
    vm.processTick(ch);                                               // Tick 0: Trigger
    ch[0].calls.length = 0;
    vm.processTick(ch);                                               // Tick 1: Wechsel auf One-Shot (Sample 2)
    assert.deepEqual(ch[0].calls.filter(c => c[0] === 'START'), []);   // KEIN Neustart
    assert.deepEqual(ch[0].calls.filter(c => c[0] === 'LC' || c[0] === 'LEN'), [['LC', CHIP_BASE + 64], ['LEN', 8]]);
    ch[0].calls.length = 0;
    vm.processTick(ch);                                               // Tick 2: Folge-Latch
    assert.deepEqual(ch[0].calls.slice(0, 2), [['LC', SILENCE_LC], ['LEN', 1]]);
});

test('restart: derselbe Wechsel startet die DMA neu', () => {
    const vm = new CosoVirtualMachine(oneShotMod(), {}, null, { waveChange: 'restart' });
    const ch = hwChans();
    vm.processTick(ch); ch[0].calls.length = 0;
    vm.processTick(ch);
    assert.equal(ch[0].calls.filter(c => c[0] === 'START').length, 1);
});

test('SLIDE (E5, UNVERIFIED-Semantik): Loop-Fenster wandert per LC/LEN-Latch ohne Neustart', () => {
    const bytes = buildCoso({
        instruments: [[0xE5, 0x01, 0x00, 0x00, 0x00, 0x04, 0x00, 0x04, 0x01, 0x00, 0xE1], [0xE2, 0x00, 0x00, 0xE1]],
        timbres: [[1, 0, 0, 0, 0, 0x3F, 0xE1], [1, 1, 0, 0, 0, 0x3F, 0xE1]],
        monos: [[0xFE, 15, 24, 0, 0xFF], IDLE_PATTERN], divisions: [[[0, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0]]],
        songs: [{ start: 0, end: 0, speed: 1 }],
        samples: [SMP0, { pos: 32, len: 64, loop: 0, rep: 64 }],
        pcm: [...WAVE32, ...WAVE32, ...WAVE32]
    });
    const vm = new CosoVirtualMachine(parseCoso(bytes, { name: 'slide' }), {});
    const ch = hwChans();
    vm.processTick(ch);
    const lcs = [];
    for (let i = 0; i < 4; i++) {
        ch[0].calls.length = 0;
        vm.processTick(ch);
        assert.equal(ch[0].calls.some(c => c[0] === 'START'), false);
        lcs.push(ch[0].calls.find(c => c[0] === 'LC')[1]);
    }
    assert.deepEqual(lcs.map((v, i) => i ? v - lcs[i - 1] : 8), [8, 8, 8, 8]);   // 4 Words = 8 Byte pro Tick
});

for (const kind of [{ name: 'exact', file: paulaPath, cls: 'PaulaChannel', proc: 'class PaulaProcessor' },
                    { name: 'fantasy', file: fantasyPath, cls: 'PaulaFantasyChannel', proc: 'class PaulaFantasyProcessor' }]) {
    const have = haveL1 && existsSync(kind.file);
    const Ch = have ? (() => { const src = readFileSync(kind.file, 'utf8'); const a = src.indexOf(`class ${kind.cls} {`), b = src.indexOf(kind.proc);
        return new Function(src.slice(a, b) + `\nreturn ${kind.cls};`)(); })() : null;
    const patched = have && typeof Ch.prototype.hwStartDMA === 'function';

    test(`[${kind.name}] 4 s über den Hardware-Pfad: hörbar, keine NaN, gültige Register`, { skip: !patched }, () => {
        const vm = new CosoVirtualMachine(structuredClone(loadMod()), {});
        const ch = [0, 1, 2, 3].map(i => new Ch(i));
        let energy = 0, peak = 0, nan = 0;
        for (let tick = 0; tick < 200; tick++) {
            vm.processTick(ch);
            if (tick === 5) for (let v = 0; v < 3; v++) assert.equal(ch[v].hw, true, `Stimme ${v} nutzt den Hardware-Modus`);
            for (let s = 0; s < 882; s++) {
                let acc = 0;
                for (const c of ch) acc += c.step(3546895 / 44100);
                if (Number.isNaN(acc)) nan++;
                energy += acc * acc; peak = Math.max(peak, Math.abs(acc));
            }
        }
        assert.equal(nan, 0);
        assert.ok(energy > 1 && peak > 0.05 && peak < 4.5, `energy ${energy} peak ${peak}`);
    });

    test(`[${kind.name}] ZERO-ALLOCATION: processTick() allokiert nichts (braucht --expose-gc)`, { skip: !patched || typeof globalThis.gc !== 'function' }, () => {
        const vm = new CosoVirtualMachine(structuredClone(loadMod()), {});
        const ch = [0, 1, 2, 3].map(i => new Ch(i));
        for (let i = 0; i < 3000; i++) vm.processTick(ch);
        globalThis.gc();
        const before = process.memoryUsage().heapUsed;
        for (let i = 0; i < 200000; i++) vm.processTick(ch);
        globalThis.gc();
        const delta = process.memoryUsage().heapUsed - before;
        assert.ok(delta < 256 * 1024, `Heap-Zuwachs ${delta} Byte`);
    });
}

// =========================================================
// Spulen und Position (UI: Zeitanzeige, Slider, Titelwechsel)
// =========================================================
function eightTickMod() {
    const bytes = buildCoso({
        instruments: [[0xE2, 0, 0, 0xE1]], timbres: [[1, 0, 0, 0, 0, 0x3F, 0xE1]], monos: [[0xFE, 3, 24, 0, 0xFF], IDLE_PATTERN],
        divisions: [[[0, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0]], [[0, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0]]],
        songs: [{ start: 0, end: 1, speed: 1 }], samples: [SMP0], pcm: WAVE32
    });
    return parseCoso(bytes, { name: 'eight' });
}

test('position: 1..N im Durchlauf, springt beim Loop auf 1; tickCounter bleibt monoton', () => {
    const vm = new CosoVirtualMachine(eightTickMod(), {});
    const ch = hwChans(), pos = [], tc = [];
    for (let i = 0; i < 10; i++) { vm.processTick(ch); pos.push(vm.position); tc.push(vm.tickCounter); }
    assert.deepEqual(pos, [1, 2, 3, 4, 5, 6, 7, 8, 1, 2]);
    assert.deepEqual(tc, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('Titelwechsel-Bedingung aus app.js (previousFrame > length-20 und Frame < 10) löst pro Durchlauf genau einmal aus', { skip }, () => {
    const mod = parseCoso(new Uint8Array(readFileSync(path.join(fixtures, 'Wings_Of_Death-Level_2.hipc'))), { name: 'L2' });
    assert.equal(mod.length, 8000);
    const vm = new CosoVirtualMachine(mod, {}), ch = hwChans();
    let prev = 0, fired = 0, maxPos = 0;
    for (let i = 0; i < 8000 * 2 + 50; i++) {
        vm.processTick(ch);
        const frame = vm.position;
        maxPos = Math.max(maxPos, frame);
        if (prev > mod.length - 20 && frame < 10) fired++;
        prev = frame;
    }
    assert.equal(fired, 2);                                              // zwei Loop-Wraps in zwei Durchläufen
    assert.equal(maxPos, 8000);                                          // Position läuft nie über die Laufzeit hinaus
});

test('seekToTick: Position, Klemmung und Neustart-Verhalten', () => {
    const vm = new CosoVirtualMachine(eightTickMod(), {});
    const ch = hwChans();
    vm.seekToTick(5);
    assert.equal(vm.position, 5);
    vm.seekToTick(10_000);                                               // hinter das Ende -> letzter Tick
    assert.equal(vm.position, vm.songTicks - 1);
    vm.seekToTick(-7);
    assert.equal(vm.position, 0);
    vm.processTick(ch);
    assert.equal(vm.position, 1);
});

test('Nach dem Spulen: Kanäle werden neu geprimt, dann latcht das Loop-Fenster der klingenden Welle ein, ohne Neustart', { skip }, () => {
    const mod = loadMod();
    const vm = new CosoVirtualMachine(mod, {});
    const ref = new CosoReplayer(mod, { song: mod.selectedSong });
    ref.seek(4993); ref.tick();                                          // erwarteter Zustand im ersten Tick nach dem Spulen
    vm.seekToTick(4993);
    const ch = hwChans();
    vm.processTick(ch);
    let looped = 0, oneShot = 0;
    for (let v = 0; v < 4; v++) {
        const o = v * REG.STRIDE, calls = ch[v].calls, starts = calls.filter(c => c[0] === 'START').length;
        const retriggered = (ref.regs[o + REG.FLAGS] & 1) !== 0;
        assert.deepEqual(calls.slice(0, 4), [['ATTACH'], ['LC', SILENCE_LC], ['LEN', 1], ['START']], `Stimme ${v}: Priming fehlt`);
        if (!retriggered && ref.regs[o + REG.SAMPLE] >= 0 && ref.regs[o + REG.LOOP_LEN] <= 2 && ref.regs[o + REG.VOLUME] > 0) oneShot++;
        if (!retriggered) assert.equal(starts, 1, `Stimme ${v}: unerwarteter DMA-Neustart (spurious hit nach dem Spulen)`);
        if (ref.regs[o + REG.SAMPLE] >= 0 && ref.regs[o + REG.LOOP_LEN] > 2 && !retriggered) {
            looped++;
            assert.ok(calls.some(c => c[0] === 'LC' && c[1] === CHIP_BASE + ref.regs[o + REG.LOOP_START]), `Stimme ${v}: Loop-Fenster nicht gelatcht`);
        }
    }
    assert.ok(looped >= 1, 'an Position 4993 sollte mindestens eine Stimme eine Loop-Welle halten');
    assert.ok(oneShot >= 1, 'an Position 4993 sollte ein One-Shot laufen: er darf nicht neu angeschlagen werden');
});

test('Spulen MITTEN im laufenden Stück: alle Kanäle werden zuerst gestoppt (kein Weiterklingen von Tönen vor dem Sprung)', { skip }, () => {
    const vm = new CosoVirtualMachine(loadMod(), {});
    const ch = hwChans();
    for (let i = 0; i < 400; i++) vm.processTick(ch);                    // laufende Wiedergabe: alle Kanäle sind bereits geprimt
    for (const c of ch) c.calls.length = 0;
    vm.seekToTick(100);
    vm.processTick(ch);
    for (let v = 0; v < 4; v++) {
        assert.deepEqual(ch[v].calls.slice(0, 3), [['LC', SILENCE_LC], ['LEN', 1], ['START']], `Stimme ${v}: alter Ton läuft nach dem Spulen weiter`);
    }
});

test('tickCounter = 0 (alter SEEK-Aufruf) setzt Position und Zustand zurück', () => {
    const vm = new CosoVirtualMachine(eightTickMod(), {});
    const ch = hwChans();
    for (let i = 0; i < 5; i++) vm.processTick(ch);
    vm.tickCounter = 0;
    assert.equal(vm.position, 0);
    assert.equal(vm.tickCounter, 0);
});

for (const kind of [{ name: 'exact', file: paulaPath, cls: 'PaulaChannel', proc: 'class PaulaProcessor' },
                    { name: 'fantasy', file: fantasyPath, cls: 'PaulaFantasyChannel', proc: 'class PaulaFantasyProcessor' }]) {
    const have = haveL1 && existsSync(kind.file);
    const Ch = have ? (() => { const src = readFileSync(kind.file, 'utf8'); const a = src.indexOf(`class ${kind.cls} {`), b = src.indexOf(kind.proc);
        return new Function(src.slice(a, b) + `\nreturn ${kind.cls};`)(); })() : null;
    const patched = have && typeof Ch.prototype.hwStartDMA === 'function';

    test(`[${kind.name}] Spulen mitten ins Stück: Ton ist sofort da, Pegel entspricht einem durchgehenden Lauf`, { skip: !patched }, () => {
        const rms = (vm, ch, ticks) => {
            let e = 0, n = 0;
            for (let t = 0; t < ticks; t++) { vm.processTick(ch); for (let s = 0; s < 882; s++) { let a = 0; for (const c of ch) a += c.step(3546895 / 44100); e += a * a; n++; } }
            return Math.sqrt(e / n);
        };
        const mod = structuredClone(loadMod());
        const target = 5000;
        const seeked = new CosoVirtualMachine(mod, {}), chS = [0, 1, 2, 3].map(i => new Ch(i));
        seeked.seekToTick(target);
        const early = rms(seeked, chS, 6);                               // nur die ersten 6 Ticks (120 ms) nach dem Spulen
        assert.ok(early > 0.05, `nach dem Spulen fast stumm (RMS ${early})`);
        const cont = new CosoVirtualMachine(mod, {}), chC = [0, 1, 2, 3].map(i => new Ch(i));
        for (let i = 0; i < target; i++) cont.processTick(chC);
        const ref = rms(cont, chC, 6);
        assert.ok(Math.abs(early / ref - 1) < 0.05, `Pegel nach Spulen ${early}, durchgehend ${ref}`);
        // Gegenprobe: ohne das Priming der Kanäle bliebe die haltende Welle stumm (Pegel ~0.72 des Referenzwerts)
        const broken = new CosoVirtualMachine(mod, {}), chB = [0, 1, 2, 3].map(i => new Ch(i));
        broken.seekToTick(target); broken.dmaPrimed.fill(1);
        assert.ok(rms(broken, chB, 6) / ref < 0.9, 'Gegenprobe zeigt keinen Unterschied: Test wäre wirkungslos');
    });
}
