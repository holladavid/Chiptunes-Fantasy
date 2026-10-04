// === tools/coso-render.mjs ===
// Offline-Renderer für die Verifikation des CosoReplayer gegen Referenz-Audio.
// KEIN Teil der Laufzeit: vereinfachtes Paula-Modell (ZOH + Boxfilter), Mono-Mix.
//
//   node tools/coso-render.mjs --in track.hipc --song 0 --seconds 60 --out out.wav
//        [--tickhz 50] [--clock 3546895] [--loopconv full|mod] [--rate 44100] [--trace trace.txt]

import { readFileSync, writeFileSync } from 'node:fs';
import { parseCoso } from '../js/parsers/hipc-parser.js';
import { CosoReplayer, REG } from '../js/worklets/lib/coso-replayer.js';

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];

const inFile = args.in;
const song = +(args.song ?? 0);
const seconds = +(args.seconds ?? 30);
const tickHz = +(args.tickhz ?? 50);
const rate = +(args.rate ?? 44100);
const loopConv = args.loopconv ?? 'full';
const outFile = args.out ?? 'out.wav';
const CLOCK = +(args.clock ?? 3546895);          // PAL-Paula; --clock zum Testen von Abweichungen
const SUB = 4;                                   // Sub-Samples pro Ausgabesample (Boxfilter)

const mod = parseCoso(new Uint8Array(readFileSync(inFile)), { name: inFile, song });
const rp = new CosoReplayer(mod, { song, loop: true });
const pcm = mod.pcm;

// ---------- Paula-lite ----------
const ch = [];
for (let i = 0; i < 4; i++) ch.push({ pos: 0, mode: 0, start: 0, len: 0, lstart: 0, llen: 0, on: false, per: 0, vol: 0 });

function applyRegs() {
    for (let i = 0; i < 4; i++) {
        const o = i * REG.STRIDE, c = ch[i], r = rp.regs;
        const f = r[o + REG.FLAGS];
        c.per = r[o + REG.PERIOD]; c.vol = r[o + REG.VOLUME];
        c.lstart = r[o + REG.LOOP_START]; c.llen = r[o + REG.LOOP_LEN];
        if (r[o + REG.SAMPLE] < 0) { c.on = false; continue; }
        if (f & 1) {                                           // RETRIGGER
            c.start = r[o + REG.DMA_START];
            c.len = (loopConv === 'mod' && c.llen > 2) ? (c.lstart + c.llen - c.start) : r[o + REG.DMA_LEN];
            c.pos = c.start; c.mode = 0; c.on = true;
        } else if (f & 4) {                                    // WAVE_CHANGED: greift beim nächsten Wrap
            c.start = r[o + REG.DMA_START];
            c.len = (loopConv === 'mod' && c.llen > 2) ? (c.lstart + c.llen - c.start) : r[o + REG.DMA_LEN];
            if (c.mode === 0) { /* erster Durchlauf: Position bleibt */ }
        }
    }
}

function nextByte(c, step) {
    // liefert Sample (-128..127) und rückt vor
    let v = 0;
    if (c.on) {
        v = pcm[c.pos | 0];
        c.pos += step;
        if (c.mode === 0) {
            if (c.pos >= c.start + c.len) {
                if (c.llen > 2) { c.mode = 1; c.pos = c.lstart + (c.pos - (c.start + c.len)) % c.llen; }
                else c.on = false;
            }
        } else if (c.pos >= c.lstart + c.llen) {
            c.pos = c.lstart + (c.pos - c.lstart) % c.llen;
        }
    }
    return v;
}

const total = Math.floor(seconds * rate);
const out = new Int16Array(total);
const trace = args.trace ? [] : null;
let tickAcc = 0;
const samplesPerTick = rate / tickHz;
let tickNo = 0;

for (let n = 0; n < total; n++) {
    if (tickAcc <= 0) {
        rp.tick(); applyRegs(); tickAcc += samplesPerTick; tickNo++;
        if (trace && tickNo <= 2000) {
            const r = rp.regs; let line = String(tickNo - 1);
            for (let i = 0; i < 4; i++) { const o = i * REG.STRIDE; line += ` | P${r[o + REG.PERIOD]} V${r[o + REG.VOLUME]} S${r[o + REG.SAMPLE]} F${r[o + REG.FLAGS]}`; }
            trace.push(line);
        }
    }
    tickAcc--;
    let acc = 0;
    for (let i = 0; i < 4; i++) {
        const c = ch[i];
        if (!c.on || c.per === 0 || c.vol === 0) continue;
        const step = (CLOCK / c.per) / rate / SUB;
        let s = 0;
        for (let k = 0; k < SUB; k++) s += nextByte(c, step);
        acc += (s / SUB) * (c.vol / 64) / 128;
    }
    let y = acc * 0.3;
    out[n] = Math.max(-32768, Math.min(32767, Math.round(y * 32767)));
}

// ---------- WAV schreiben ----------
const hdr = Buffer.alloc(44);
hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + out.length * 2, 4); hdr.write('WAVE', 8); hdr.write('fmt ', 12);
hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(1, 22); hdr.writeUInt32LE(rate, 24);
hdr.writeUInt32LE(rate * 2, 28); hdr.writeUInt16LE(2, 32); hdr.writeUInt16LE(16, 34); hdr.write('data', 36);
hdr.writeUInt32LE(out.length * 2, 40);
writeFileSync(outFile, Buffer.concat([hdr, Buffer.from(out.buffer)]));
if (trace) writeFileSync(args.trace, trace.join('\n'));
console.log(`rendered ${seconds}s, ${tickNo} ticks, loops=${rp.loopCount}, stats=${JSON.stringify(rp.stats)} -> ${outFile}`);
