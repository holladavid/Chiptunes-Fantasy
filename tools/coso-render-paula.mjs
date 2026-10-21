// === tools/coso-render-paula.mjs ===
// Rendert über den ECHTEN Laufzeitpfad: CosoVirtualMachine + PaulaChannel aus paula-exact.js
// (ohne Analogfilter/Oversampling-Kette des Worklets). Zum Vergleich mit Referenz-Audio.
//   node tools/coso-render-paula.mjs --in track.hipc --seconds 200 --out out.wav
//        [--song 0] [--tickhz 50] [--stereo 0|1|2]   (1 = L-R-R-L Stereo, 2 = vier getrennte Stimmen) [--wave restart|latch|hybrid] [--class exact|fantasy]
//        [--opt runoff=restart,loopConv=toLoopEnd,portShift=9,vibShift=0] [--paula js/worklets/amiga/paula-exact.js]

import { readFileSync, writeFileSync } from 'node:fs';
import { parseCoso } from '../js/parsers/hipc-parser.js';
import { CosoVirtualMachine } from '../js/worklets/lib/coso-vm.js';

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const seconds = +(args.seconds ?? 30), tickHz = +(args.tickhz ?? 50), rate = 44100, SUB = 4;
const cls = args.class ?? 'exact';
const paulaPath = args.paula ?? new URL(`../js/worklets/amiga/paula-${cls}.js`, import.meta.url).pathname;

const src = readFileSync(paulaPath, 'utf8');
const clsName = cls === 'fantasy' ? 'PaulaFantasyChannel' : 'PaulaChannel';
const procName = cls === 'fantasy' ? 'class PaulaFantasyProcessor' : 'class PaulaProcessor';
const a = src.indexOf(`class ${clsName} {`), b = src.indexOf(procName);
const Paula = new Function(src.slice(a, b) + `\nreturn ${clsName};`)();

const mod = parseCoso(new Uint8Array(readFileSync(args.in)), { name: args.in, song: +(args.song ?? 0) });
// --opt runoff=restart,loopConv=toLoopEnd,portShift=9,vibShift=0   (Messhaken des Replayers)
const replayer = {};
for (const kv of (args.opt ?? '').split(',').filter(Boolean)) { const [k, v] = kv.split('='); replayer[k] = /^-?\d+$/.test(v) ? +v : v; }
const vm = new CosoVirtualMachine(structuredClone(mod), {}, null, { waveChange: args.wave ?? undefined, replayer });
const ch = [0, 1, 2, 3].map(i => new Paula(i));
const clkPerSample = 3546895 / (rate * SUB);

const mode = +(args.stereo ?? 0);                       // 1: Amiga Stimmen 0+3 links, 1+2 rechts; 2: vier Kanäle
const stereo = mode === 1, quad = mode === 2;
const NCH = quad ? 4 : stereo ? 2 : 1;
const total = Math.floor(seconds * rate), out = new Int16Array(total * NCH);
const spt = rate / tickHz, clk = 3546895 / (rate * SUB);
let acc = 0;
for (let n = 0; n < total; n++) {
    if (acc <= 0) { vm.processTick(ch); acc += spt; }
    acc--;
    let s = 0, sl = 0, sr = 0;
    const sv = [0, 0, 0, 0];
    for (let k = 0; k < SUB; k++) for (let c = 0; c < 4; c++) { const v = ch[c].step(clk); s += v; sv[c] += v; if (c === 0 || c === 3) sl += v; else sr += v; }
    const q = (x) => Math.max(-32768, Math.min(32767, Math.round((x / SUB) * 0.3 * 32767)));
    if (quad) { for (let c = 0; c < 4; c++) out[4 * n + c] = q(sv[c]); }
    else if (stereo) { out[2 * n] = q(sl); out[2 * n + 1] = q(sr); } else out[n] = q(s);
}
const h = Buffer.alloc(44);
h.write('RIFF', 0); h.writeUInt32LE(36 + total * 2 * NCH, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16);
const nch = NCH;
h.writeUInt16LE(1, 20); h.writeUInt16LE(nch, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2 * nch, 28);
h.writeUInt16LE(2 * nch, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(total * 2 * nch, 40);
writeFileSync(args.out ?? 'out.wav', Buffer.concat([h, Buffer.from(out.buffer)]));
console.log(`rendered ${seconds}s via PaulaChannel, ${vm.tickCounter} ticks -> ${args.out}`);
