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
import { CosoVirtualMachine } from '../js/worklets/lib/coso-vm.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = process.env.HIPC_FIXTURES || path.join(here, '..', 'tracks', 'amiga');
const paulaPath = process.env.PAULA_EXACT || path.join(here, '..', 'js', 'worklets', 'amiga', 'paula-exact.js');
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
