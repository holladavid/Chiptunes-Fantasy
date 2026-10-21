// === test/m68k.test.mjs ===
// Prüft den M68000-Interpreter (js/worklets/lib/m68k.js) mit handassembliertem Maschinencode.
// Die Erwartungswerte folgen der 68000-Spezifikation (Flags, Randfälle, Adressierungsarten).

import test from 'node:test';
import assert from 'node:assert/strict';
import { M68000 } from '../js/worklets/lib/m68k.js';

const BASE = 0x1000;
function run(words, setup) {
    const c = new M68000(0x10000);
    c.a[7] = 0x8000;
    words.forEach((w, i) => { c.mem[BASE + 2 * i] = w >> 8; c.mem[BASE + 2 * i + 1] = w & 255; });
    if (setup) setup(c);
    c.call(BASE);
    return c;
}
const u = (x) => x >>> 0;
const flags = (c) => `X${c.x}N${c.n}Z${c.z}V${c.v}C${c.c}`;

test('MOVEQ / MOVE.B/W/L: Größen, Vorzeichen, obere Registerhälften bleiben erhalten', () => {
    let c = run([0x7005, 0x72FF, 0x4E75]);
    assert.equal(c.d[0], 5); assert.equal(c.d[1], -1); assert.equal(c.n, 1);
    c = run([0x263C, 0x1234, 0x5678, 0x4E75]); assert.equal(u(c.d[3]), 0x12345678);
    c = run([0x343C, 0x1234, 0x4E75], (m) => { m.d[2] = 0xAAAA0000 | 0; }); assert.equal(u(c.d[2]), 0xAAAA1234);
    c = run([0x143C, 0x0012, 0x4E75], (m) => { m.d[2] = 0x11223300; }); assert.equal(u(c.d[2]), 0x11223312);
});

test('ADD: Überlauf (V), Übertrag (C/X), Null (Z), negativ (N) für Byte und Long', () => {
    let c = run([0xD001, 0x4E75], (m) => { m.d[0] = 0x7F; m.d[1] = 1; });
    assert.equal(c.d[0] & 0xFF, 0x80); assert.equal(flags(c), 'X0N1Z0V1C0');
    c = run([0xD001, 0x4E75], (m) => { m.d[0] = 0xFF; m.d[1] = 1; });
    assert.equal(c.d[0] & 0xFF, 0); assert.equal(flags(c), 'X1N0Z1V0C1');
    c = run([0xD081, 0x4E75], (m) => { m.d[0] = -1; m.d[1] = 1; });
    assert.equal(c.d[0], 0); assert.equal(flags(c), 'X1N0Z1V0C1');
    c = run([0xD081, 0x4E75], (m) => { m.d[0] = 0x7FFFFFFF; m.d[1] = 1; });
    assert.equal(u(c.d[0]), 0x80000000); assert.equal(flags(c), 'X0N1Z0V1C0');
});

test('SUB / CMP: Borgen (C), Überlauf, CMP verändert das Ziel nicht', () => {
    let c = run([0x9041, 0x4E75], (m) => { m.d[0] = 0; m.d[1] = 1; });
    assert.equal(c.d[0] & 0xFFFF, 0xFFFF); assert.equal(flags(c), 'X1N1Z0V0C1');
    c = run([0x9081, 0x4E75], (m) => { m.d[0] = 0x80000000 | 0; m.d[1] = 1; });
    assert.equal(u(c.d[0]), 0x7FFFFFFF); assert.equal(c.v, 1);
    c = run([0xB041, 0x4E75], (m) => { m.d[0] = 5; m.d[1] = 5; });
    assert.equal(c.d[0], 5); assert.equal(flags(c), 'X0N0Z1V0C0');
    c = run([0xB041, 0x4E75], (m) => { m.d[0] = 3; m.d[1] = 5; });
    assert.equal(flags(c), 'X0N1Z0V0C1');
});

test('Bedingte Sprünge: BLT (signed), BHI (unsigned), BGT', () => {
    let c = run([0x7003, 0x0C40, 0x0005, 0x6D02, 0x7201, 0x7402, 0x4E75]);       // 3 < 5: BLT genommen
    assert.deepEqual([c.d[1], c.d[2]], [0, 2]);
    c = run([0x0C40, 0x0001, 0x6202, 0x7201, 0x7402, 0x4E75], (m) => { m.d[0] = 0xFFFF; });   // 0xFFFF > 1 unsigned: BHI genommen
    assert.deepEqual([c.d[1], c.d[2]], [0, 2]);
    c = run([0x0C40, 0x0001, 0x6E02, 0x7201, 0x7402, 0x4E75], (m) => { m.d[0] = 0xFFFF; });   // -1 > 1 signed: nein
    assert.deepEqual([c.d[1], c.d[2]], [1, 2]);
});

test('DBF-Schleife: 5 Durchläufe bei Zähler 4', () => {
    const c = run([0x7200, 0x7004, 0x5481, 0x51C8, 0xFFFC, 0x4E75]);
    assert.equal(c.d[1], 10); assert.equal(c.d[0] & 0xFFFF, 0xFFFF);
});

test('Adressierungsarten: (An)+, -(An), d16(An), d8(An,Xn), abs.L, d16(PC), LEA', () => {
    let c = run([0x1018, 0x1218, 0x4E75], (m) => { m.a[0] = 0x2000; m.mem[0x2000] = 0x11; m.mem[0x2001] = 0x22; });
    assert.deepEqual([c.d[0] & 0xFF, c.d[1] & 0xFF, c.a[0]], [0x11, 0x22, 0x2002]);
    c = run([0x3300, 0x4E75], (m) => { m.a[1] = 0x3000; m.d[0] = 0x1234; });
    assert.deepEqual([c.a[1], c.mem[0x2FFE], c.mem[0x2FFF]], [0x2FFE, 0x12, 0x34]);
    c = run([0x3028, 0x0004, 0x4E75], (m) => { m.a[0] = 0x2000; m.mem[0x2004] = 0xBE; m.mem[0x2005] = 0xEF; });
    assert.equal(c.d[0] & 0xFFFF, 0xBEEF);
    c = run([0x3030, 0x1002, 0x4E75], (m) => { m.a[0] = 0x2000; m.d[1] = 4; m.mem[0x2006] = 0xCA; m.mem[0x2007] = 0xFE; });
    assert.equal(c.d[0] & 0xFFFF, 0xCAFE);
    c = run([0x1039, 0x0000, 0x2005, 0x4E75], (m) => { m.mem[0x2005] = 0x7E; });
    assert.equal(c.d[0] & 0xFF, 0x7E);
    c = run([0x303A, 0x0004, 0x4E75, 0xBEEF]); assert.equal(c.d[0] & 0xFFFF, 0xBEEF);
    c = run([0x41FA, 0x0004, 0x4E75, 0x0000]); assert.equal(c.a[0], BASE + 6);
    c = run([0x43E8, 0x0004, 0x4E75], (m) => { m.a[0] = 0x2000; }); assert.equal(c.a[1], 0x2004);
});

test('d8(PC,Xn): PC-Basis ist die Adresse des Erweiterungsworts', () => {
    // MOVE.W d8(PC,D1.W),D0 = 0x303B, ext = D1.W, disp 6 -> Ziel = (BASE+2) + 6 + d1
    const c = run([0x303B, 0x1004, 0x4E75, 0x0000, 0x0000, 0xD00D], (m) => { m.d[1] = 2; });   // BASE+2+4+2 = BASE+8 = Wort 4
    assert.equal(c.d[0] & 0xFFFF, 0x0000 | 0);
    const c2 = run([0x303B, 0x1004, 0x4E75, 0x0000, 0xD00D, 0x0000], (m) => { m.d[1] = 2; });
    assert.equal(c2.d[0] & 0xFFFF, 0xD00D);
});

test('MOVEM: Rundlauf über den Stack, Predecrement-Reihenfolge, Wortgröße mit Vorzeichen', () => {
    let c = run([0x48E7, 0xC080, 0x4280, 0x4281, 0x91C8, 0x4CDF, 0x0103, 0x4E75], (m) => { m.d[0] = 1; m.d[1] = 2; m.a[0] = 3; });
    assert.deepEqual([c.d[0], c.d[1], c.a[0], c.a[7]], [1, 2, 3, 0x8000]);
    c = run([0x4C98, 0x0001, 0x4E75], (m) => { m.a[0] = 0x2000; m.mem[0x2000] = 0x80; m.mem[0x2001] = 0x01; });   // MOVEM.W (A0)+,D0
    assert.equal(c.d[0], (0x8001 << 16) >> 16);
});

test('BSR / JSR / RTS und LINK-freie Unterprogramme', () => {
    let c = run([0x6100, 0x0006, 0x7202, 0x4E75, 0x7001, 0x4E75]);
    assert.deepEqual([c.d[0], c.d[1]], [1, 2]);
    c = run([0x4E90, 0x4E75, 0x4E71, 0x4E71, 0x7005, 0x4E75], (m) => { m.a[0] = BASE + 8; });
    assert.equal(c.d[0], 5);
});

test('Schieben und Rotieren: LSL/LSR/ASR/ASL/ROL/ROXL, Registerzähler', () => {
    let c = run([0xE548, 0x4E75], (m) => { m.d[0] = 0x4001; });                         // LSL.W #2
    assert.equal(c.d[0] & 0xFFFF, 0x0004); assert.equal(flags(c), 'X1N0Z0V0C1');
    c = run([0xE248, 0x4E75], (m) => { m.d[0] = 3; });                                  // LSR.W #1
    assert.equal(c.d[0] & 0xFFFF, 1); assert.equal(flags(c), 'X1N0Z0V0C1');
    c = run([0xE240, 0x4E75], (m) => { m.d[0] = 0x8000; });                             // ASR.W #1
    assert.equal(c.d[0] & 0xFFFF, 0xC000); assert.equal(flags(c), 'X0N1Z0V0C0');
    c = run([0xE340, 0x4E75], (m) => { m.d[0] = 0x4000; });                             // ASL.W #1: MSB wechselt -> V
    assert.equal(c.d[0] & 0xFFFF, 0x8000); assert.equal(flags(c), 'X0N1Z0V1C0');
    c = run([0xE318, 0x4E75], (m) => { m.d[0] = 0x81; m.x = 0; });                      // ROL.B #1: X bleibt
    assert.equal(c.d[0] & 0xFF, 0x03); assert.equal(c.c, 1); assert.equal(c.x, 0);
    c = run([0xE310, 0x4E75], (m) => { m.d[0] = 0; m.x = 1; });                         // ROXL.B #1 mit X=1
    assert.equal(c.d[0] & 0xFF, 1); assert.equal(c.c, 0); assert.equal(c.x, 0);
    c = run([0xE368, 0x4E75], (m) => { m.d[0] = 1; m.d[1] = 3; });                      // LSL.W D1,D0
    assert.equal(c.d[0] & 0xFFFF, 8);
});

test('MULU / MULS / DIVU / DIVS', () => {
    let c = run([0xC0C1, 0x4E75], (m) => { m.d[0] = 0xFFFF; m.d[1] = 0xFFFF; }); assert.equal(u(c.d[0]), 0xFFFE0001);
    c = run([0xC1C1, 0x4E75], (m) => { m.d[0] = 0xFFFE; m.d[1] = 3; }); assert.equal(c.d[0], -6); assert.equal(c.n, 1);
    c = run([0x80C1, 0x4E75], (m) => { m.d[0] = 100000; m.d[1] = 7; }); assert.equal(u(c.d[0]), (5 << 16) | 14285);
    c = run([0x81C1, 0x4E75], (m) => { m.d[0] = -100000; m.d[1] = 7; }); assert.equal(u(c.d[0]), 0xFFFBC833);
    c = run([0x80C1, 0x4E75], (m) => { m.d[0] = 0x7FFFFFFF; m.d[1] = 1; }); assert.equal(c.v, 1);            // Quotient > 16 Bit: V, Ziel unverändert
    assert.equal(c.d[0], 0x7FFFFFFF);
});

test('EXT / SWAP / CLR / NEG / NOT / TST', () => {
    let c = run([0x4880, 0x4E75], (m) => { m.d[0] = 0x12340080; }); assert.equal(u(c.d[0]), 0x1234FF80);
    c = run([0x48C0, 0x4E75], (m) => { m.d[0] = 0x00008000; }); assert.equal(u(c.d[0]), 0xFFFF8000);
    c = run([0x4840, 0x4E75], (m) => { m.d[0] = 0x12345678; }); assert.equal(u(c.d[0]), 0x56781234);
    c = run([0x4240, 0x4E75], (m) => { m.d[0] = -1; }); assert.equal(u(c.d[0]), 0xFFFF0000); assert.equal(c.z, 1);
    c = run([0x4440, 0x4E75], (m) => { m.d[0] = 1; }); assert.equal(c.d[0] & 0xFFFF, 0xFFFF); assert.equal(flags(c), 'X1N1Z0V0C1');
    c = run([0x4600, 0x4E75], (m) => { m.d[0] = 0x0F; }); assert.equal(c.d[0] & 0xFF, 0xF0);
    c = run([0x4A40, 0x4E75], (m) => { m.d[0] = 0x8000; }); assert.equal(c.n, 1); assert.equal(c.z, 0);
});

test('AND / OR / EOR und die Immediate-Formen', () => {
    let c = run([0xC041, 0x4E75], (m) => { m.d[0] = 0xFF0F; m.d[1] = 0x0FF0; }); assert.equal(c.d[0] & 0xFFFF, 0x0F00);
    c = run([0x8041, 0x4E75], (m) => { m.d[0] = 0xFF0F; m.d[1] = 0x0FF0; }); assert.equal(c.d[0] & 0xFFFF, 0xFFFF);
    c = run([0xB340, 0x4E75], (m) => { m.d[0] = 0xFF0F; m.d[1] = 0x0FF0; }); assert.equal(c.d[0] & 0xFFFF, 0xF0FF);
    c = run([0x0240, 0x00FF, 0x4E75], (m) => { m.d[0] = 0x1234; }); assert.equal(c.d[0] & 0xFFFF, 0x0034);
    c = run([0x0040, 0x8000, 0x4E75], (m) => { m.d[0] = 0x0001; }); assert.equal(c.d[0] & 0xFFFF, 0x8001);
    c = run([0x0A40, 0xFFFF, 0x4E75], (m) => { m.d[0] = 0x00FF; }); assert.equal(c.d[0] & 0xFFFF, 0xFF00);
    c = run([0x0640, 0x0001, 0x4E75], (m) => { m.d[0] = 0xFFFF; }); assert.equal(c.d[0] & 0xFFFF, 0); assert.equal(c.c, 1);   // ADDI
    c = run([0x0480, 0x0000, 0x0001, 0x4E75], (m) => { m.d[0] = 0; }); assert.equal(u(c.d[0]), 0xFFFFFFFF);                  // SUBI.L
});

test('Bit-Befehle: BTST/BSET/BCLR/BCHG für Register und Speicher', () => {
    let c = run([0x0800, 0x0003, 0x4E75], (m) => { m.d[0] = 8; }); assert.equal(c.z, 0);
    c = run([0x0800, 0x0003, 0x4E75], (m) => { m.d[0] = 0; }); assert.equal(c.z, 1);
    c = run([0x03C0, 0x4E75], (m) => { m.d[0] = 0; m.d[1] = 4; }); assert.equal(c.d[0], 0x10); assert.equal(c.z, 1);
    c = run([0x0380, 0x4E75], (m) => { m.d[0] = 0x10; m.d[1] = 4; }); assert.equal(c.d[0], 0); assert.equal(c.z, 0);
    c = run([0x0340, 0x4E75], (m) => { m.d[0] = 0x10; m.d[1] = 4; }); assert.equal(c.d[0], 0);
    c = run([0x0890, 0x0000, 0x4E75], (m) => { m.a[0] = 0x2000; m.mem[0x2000] = 1; }); assert.equal(c.mem[0x2000], 0); assert.equal(c.z, 0);
    c = run([0x08D0, 0x0007, 0x4E75], (m) => { m.a[0] = 0x2000; m.mem[0x2000] = 0; }); assert.equal(c.mem[0x2000], 0x80);
    c = run([0x0300, 0x4E75], (m) => { m.d[0] = 1 << 31; m.d[1] = 31; }); assert.equal(c.z, 0);                   // BTST D1,D0 mod 32
});

test('Adressregister: MOVEA.W/ADDA/SUBA/CMPA mit Vorzeichen, ADDQ/SUBQ ohne Flags, EXG', () => {
    let c = run([0x3040, 0x4E75], (m) => { m.d[0] = 0xFFFF; }); assert.equal(c.a[0], -1);
    c = run([0xD0C0, 0x4E75], (m) => { m.a[0] = 0x1000; m.d[0] = 0xFFFF; }); assert.equal(c.a[0], 0x0FFF);
    c = run([0xD1C0, 0x4E75], (m) => { m.a[0] = 0x1000; m.d[0] = 0x10; }); assert.equal(c.a[0], 0x1010);
    c = run([0x91C0, 0x4E75], (m) => { m.a[0] = 0x1000; m.d[0] = 0x10; }); assert.equal(c.a[0], 0x0FF0);
    c = run([0xB1C0, 0x4E75], (m) => { m.a[0] = 5; m.d[0] = 5; }); assert.equal(c.z, 1);
    c = run([0x5248, 0x4E75], (m) => { m.a[0] = 0x1000; m.z = 1; }); assert.equal(c.a[0], 0x1001); assert.equal(c.z, 1);
    c = run([0xC141, 0x4E75], (m) => { m.d[0] = 1; m.d[1] = 2; }); assert.deepEqual([c.d[0], c.d[1]], [2, 1]);
});

test('Scc, ADDX/SUBX, CMPM, MOVE von/zu SR/CCR', () => {
    let c = run([0x57C0, 0x4E75], (m) => { m.z = 1; }); assert.equal(c.d[0] & 0xFF, 0xFF);
    c = run([0x56C0, 0x4E75], (m) => { m.z = 1; }); assert.equal(c.d[0] & 0xFF, 0);
    c = run([0xD101, 0x4E75], (m) => { m.d[0] = 1; m.d[1] = 1; m.x = 1; }); assert.equal(c.d[0] & 0xFF, 3);
    c = run([0x9101, 0x4E75], (m) => { m.d[0] = 5; m.d[1] = 1; m.x = 1; }); assert.equal(c.d[0] & 0xFF, 3);
    c = run([0xB348, 0x4E75], (m) => { m.a[0] = 0x2000; m.a[1] = 0x2002; m.mem[0x2001] = 7; m.mem[0x2003] = 7; }); assert.equal(c.z, 1); assert.equal(c.a[0], 0x2002);
    c = run([0x44C0, 0x4E75], (m) => { m.d[0] = 0x1F; }); assert.equal(flags(c), 'X1N1Z1V1C1');
    c = run([0x40C0, 0x4E75], (m) => { m.c = 1; m.n = 1; }); assert.equal(c.d[0] & 0x1F, 0b01001);
});

test('Custom-Chip-Zugriffe: Schreibzugriffe landen im Callback, Lesezugriffe liefern den Hook-Wert', () => {
    const writes = [];
    const c = run([0x33FC, 0x8001, 0x00DF, 0xF096, 0x23FC, 0x0001, 0x2000, 0x00DF, 0xF0A0, 0x3039, 0x00DF, 0xF006, 0x4E75], (m) => {
        m.onCustomWrite = (a, s, v) => writes.push([a.toString(16), s, v.toString(16)]);
        m.onCustomRead = (a) => (a === 0xDFF006 ? 0x4321 : 0);
    });
    assert.deepEqual(writes, [['dff096', 1, '8001'], ['dff0a0', 2, '12000']]);
    assert.equal(c.d[0] & 0xFFFF, 0x4321);
});

test('A7 und Bytezugriff: (A7)+ zählt um 2; unbekannte Opcodes werfen mit PC', () => {
    // MOVE.L A7,A1 ; MOVE.B (A7)+,D0 ; MOVE.L A7,D2 ; SUBQ.W #2,A7 (Stack wiederherstellen) ; RTS
    const c = run([0x224F, 0x101F, 0x240F, 0x554F, 0x4E75]);
    assert.equal(c.d[2] - c.a[1], 2);
    assert.throws(() => run([0xA000]), /Line-A\/F/);
    assert.throws(() => run([0x4E41]), /nicht implementiert/);
});

test('Schreib-Watch: meldet Schreibzugriffe auf genau eine Adresse (für die Loop-Erkennung)', () => {
    const hits = [];
    // MOVE.W #$0000,$2000.L ; MOVE.W #$0007,$2002.L ; MOVE.W #$0005,$2000.L ; RTS
    run([0x33FC, 0x0000, 0x0000, 0x2000, 0x33FC, 0x0007, 0x0000, 0x2002, 0x33FC, 0x0005, 0x0000, 0x2000, 0x4E75], (m) => {
        m.watchAddr = 0x2000; m.onWatch = (size, val) => hits.push([size, val]);
    });
    assert.deepEqual(hits, [[1, 0], [1, 5]]);
});
