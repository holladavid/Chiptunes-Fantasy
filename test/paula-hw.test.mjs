// === test/paula-hw.test.mjs ===
// Prüft die Hardware-DMA-API (hwAttach/hwWriteLC/hwWriteLEN/hwStartDMA) beider Kanal-Klassen
// gegen die ECHTEN Klassen aus den Worklets (Patch patches/paula-hw-dma.patch muss angewendet sein).
//   PAULA_EXACT=/pfad/paula-exact.js  PAULA_FANTASY=/pfad/paula-fantasy.js

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const amiga = (n) => path.join(here, '..', 'js', 'worklets', 'amiga', n);
const KINDS = [
    { name: 'exact',   file: process.env.PAULA_EXACT   || amiga('paula-exact.js'),   cls: 'PaulaChannel',        proc: 'class PaulaProcessor' },
    { name: 'fantasy', file: process.env.PAULA_FANTASY || amiga('paula-fantasy.js'), cls: 'PaulaFantasyChannel', proc: 'class PaulaFantasyProcessor' }
];

function load(kind) {
    const src = readFileSync(kind.file, 'utf8');
    const a = src.indexOf(`class ${kind.cls} {`), b = src.indexOf(kind.proc);
    return new Function(src.slice(a, b) + `\nreturn ${kind.cls};`)();
}

const A = [10, 20, 30, 40, 50, 60, 70, 80];             // 8 Byte bei $10
const B = [-10, -20, -30, -40];                         // 4 Byte bei $20
function makeRam() {
    const ram = new Int8Array(0x80);
    A.forEach((v, i) => { ram[0x10 + i] = v; });
    B.forEach((v, i) => { ram[0x20 + i] = v; });
    return ram;
}

// Liest n Ausgabe-Bytes, indem der Kanal in ganzen Perioden getaktet wird (liefert Byte 1, 2, ...).
function stream(kind, ch, n) {
    const out = [];
    for (let i = 0; i < n; i++) {
        const v = ch.step(ch.audPer);
        out.push(kind.name === 'exact' ? ch.heldValue : Math.round(v * 8128 / ch.vol));
    }
    return out;
}

function fresh(Ch, kind) {
    const ch = new Ch(0);
    ch.hwAttach(makeRam());
    ch.writeAUDxPER(200);
    ch.writeAUDxVOL(64);
    return ch;
}

for (const kind of KINDS) {
    const ok = existsSync(kind.file);
    const Ch = ok ? load(kind) : null;
    const patched = ok && typeof Ch.prototype.hwStartDMA === 'function';
    const opts = { skip: !ok ? `${kind.file} fehlt` : (!patched ? 'Patch paula-hw-dma.patch nicht angewendet' : false) };

    test(`[${kind.name}] hwStartDMA lädt LC/LEN; nach dem ersten Durchlauf Reload aus den gelatchten Registern`, opts, () => {
        const ch = fresh(Ch, kind);
        ch.hwWriteLC(0x10); ch.hwWriteLEN(4);            // erster Durchlauf: 8 Byte A
        ch.hwStartDMA();
        ch.hwWriteLC(0x20); ch.hwWriteLEN(2);            // danach: 4 Byte B als Loop
        assert.deepEqual(stream(kind, ch, 15), [20, 30, 40, 50, 60, 70, 80, -10, -20, -30, -40, -10, -20, -30, -40]);
    });

    test(`[${kind.name}] LC/LEN-Schreibzugriff mitten im Durchlauf greift erst am Wrap`, opts, () => {
        const ch = fresh(Ch, kind);
        ch.hwWriteLC(0x10); ch.hwWriteLEN(4);
        ch.hwStartDMA();
        ch.hwWriteLC(0x10); ch.hwWriteLEN(4);            // Loop auf A
        assert.deepEqual(stream(kind, ch, 3), [20, 30, 40]);
        ch.hwWriteLC(0x20); ch.hwWriteLEN(2);            // jetzt auf B umlatchen
        assert.deepEqual(stream(kind, ch, 9), [50, 60, 70, 80, -10, -20, -30, -40, -10]);
    });

    test(`[${kind.name}] erneutes hwStartDMA startet bei LC neu`, opts, () => {
        const ch = fresh(Ch, kind);
        ch.hwWriteLC(0x10); ch.hwWriteLEN(4); ch.hwStartDMA(); ch.hwWriteLC(0x10); ch.hwWriteLEN(4);
        stream(kind, ch, 5);
        ch.hwWriteLC(0x10); ch.hwWriteLEN(4); ch.hwStartDMA();
        assert.deepEqual(stream(kind, ch, 3), [20, 30, 40]);
    });

    test(`[${kind.name}] Stille-Wort als Loop-Ziel: nach dem One-Shot kommt Null`, opts, () => {
        const ch = fresh(Ch, kind);
        ch.hwWriteLC(0x10); ch.hwWriteLEN(4); ch.hwStartDMA();
        ch.hwWriteLC(0); ch.hwWriteLEN(1);               // Stille-Wort bei Adresse 0
        const s = stream(kind, ch, 12);
        assert.deepEqual(s.slice(0, 7), [20, 30, 40, 50, 60, 70, 80]);
        assert.deepEqual(s.slice(7), [0, 0, 0, 0, 0]);
    });

    test(`[${kind.name}] AUDxLEN 0 bedeutet 65536 Words (Hardware)`, opts, () => {
        const ch = fresh(Ch, kind);
        ch.hwWriteLEN(0);
        assert.equal(ch.audLen, 0x10000);
    });

    test(`[${kind.name}] Legacy-API (MOD/XM-Pfad) schaltet den Hardware-Modus ab`, opts, () => {
        // Hinweis: Das Stream-Verhalten des Legacy-Pfads wird hier bewusst NICHT geprüft
        // (bekannter Altfehler im PaulaChannel: Word 1 geht nach enableDMA verloren).
        const ch = fresh(Ch, kind);
        ch.hwWriteLC(0x10); ch.hwWriteLEN(4); ch.hwStartDMA();
        assert.equal(ch.hw, true);
        const buf = new Int8Array([11, 22, 33, 44]);
        ch.writeAUDxLC(0, buf, 0, 0); ch.writeAUDxLEN(2); ch.enableDMA(buf, 0, 0);
        assert.equal(ch.hw, false);
        assert.notEqual(ch.step(ch.audPer), 0);
    });

    test(`[${kind.name}] hwStopDMA stoppt die Ausgabe`, opts, () => {
        const ch = fresh(Ch, kind);
        ch.hwWriteLC(0x10); ch.hwWriteLEN(4); ch.hwStartDMA();
        stream(kind, ch, 2);
        ch.hwStopDMA();
        assert.equal(ch.step(ch.audPer), 0);
    });
}

// Nur Fantasy: Hermite-Nachbarn folgen dem Stream, nicht der angrenzenden Bank
{
    const kind = KINDS[1];
    const ok = existsSync(kind.file);
    const Ch = ok ? load(kind) : null;
    const patched = ok && typeof Ch.prototype.hwStartDMA === 'function';
    test('[fantasy] Interpolation an der Loop-Naht liest nicht in Nachbar-Samples', { skip: !patched }, () => {
        const ram = new Int8Array(0x80);
        ram.fill(127, 0x24, 0x30);                         // laute Nachbarn HINTER dem Loop
        ram.fill(-128, 0x10, 0x20);                        // laute Nachbarn DAVOR
        ram.fill(50, 0x20, 0x24);                          // Loop = konstant 50
        const ch = new Ch(0);
        ch.hwAttach(ram); ch.writeAUDxPER(200); ch.writeAUDxVOL(64);
        ch.hwWriteLC(0x20); ch.hwWriteLEN(2); ch.hwStartDMA();
        let maxDev = 0;
        for (let i = 0; i < 400; i++) {
            const y = ch.step(200 / 7) * 8128 / 64;
            if (i > 40) maxDev = Math.max(maxDev, Math.abs(y - 50));   // Einschwingen ignorieren (prevByte startet bei 0)
        }
        assert.ok(maxDev < 1e-6, `Abweichung ${maxDev}`);
    });
}
