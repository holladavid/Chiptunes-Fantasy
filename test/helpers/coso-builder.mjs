// === test/helpers/coso-builder.mjs ===
// Baut minimale, gültige COSO-Binärdateien für gezielte Semantik-Tests.
//   instruments / timbres / monos : Arrays von Byte-Arrays (Elemente)
//   divisions : Array von Divisions, je 4 Stimmen [pattern, transpose, effect]
//   songs     : [{start,end,speed}]     samples: [{pos,len,loop,rep}] (Bytes)
export function buildCoso({ instruments, timbres, monos, divisions, songs, samples, pcm }) {
    const out = [];
    const u16 = (v) => [(v >> 8) & 255, v & 255];
    const u32 = (v) => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];

    const indexed = (elems, base) => {
        const table = [], body = [];
        let off = base + elems.length * 2;
        for (const e of elems) { table.push(...u16(off)); body.push(...e); off += e.length; }
        return [...table, ...body];
    };

    const pos = {};
    let p = 0x40;
    const secInstr = indexed(instruments, p); pos.instruments = p; p += secInstr.length;
    const secTim = indexed(timbres, p);       pos.timbres = p;      p += secTim.length;
    const secMono = indexed(monos, p);        pos.monopatterns = p; p += secMono.length;
    const secDiv = [];
    for (const d of divisions) for (const v of d) secDiv.push(v[0] & 255, v[1] & 255, v[2] & 255);
    pos.divisions = p; p += secDiv.length;
    const secSong = [];
    for (const s of songs) secSong.push(...u16(s.start), ...u16(s.end), ...u16(s.speed));
    secSong.push(0, 0, 0, 0, 0, 0);                         // Terminator-Slot
    pos.songs = p; p += secSong.length;
    const secSmp = [];
    for (const s of samples) secSmp.push(...u32(s.pos), ...u16(s.len >> 1), ...u16(s.loop), ...u16(s.rep >> 1));
    secSmp.push(0x53, 0x50, 0x43, 0, 0, 0, 0, 0, 0, 0);     // Müll-Slot
    pos.samples = p; p += secSmp.length;
    pos.total = p;

    const hdr = new Array(0x40).fill(0);
    const put = (o, bytes) => bytes.forEach((b, i) => { hdr[o + i] = b; });
    put(0, [0x43, 0x4F, 0x53, 0x4F]);
    put(4, u32(pos.instruments)); put(8, u32(pos.timbres)); put(12, u32(pos.monopatterns));
    put(16, u32(pos.divisions)); put(20, u32(pos.songs)); put(24, u32(pos.samples)); put(28, u32(pos.total));
    put(32, [0x54, 0x46, 0x4D, 0x58]);
    put(0x24, u16(instruments.length - 1)); put(0x26, u16(timbres.length - 1));
    put(0x28, u16(monos.length - 1)); put(0x2A, u16(divisions.length - 1));
    put(0x2C, u16(0x40)); put(0x2E, u16(0));
    put(0x30, u16(songs.length)); put(0x32, u16(samples.length));

    out.push(...hdr, ...secInstr, ...secTim, ...secMono, ...secDiv, ...secSong, ...secSmp, ...(pcm || []));
    return new Uint8Array(out);
}

// Gängiger Mini-Aufbau: 1 Welle (32 B Dreieck, Loop), Instrument 0 = [E2 00, pitch, E1]
export const WAVE32 = Array.from({ length: 32 }, (_, i) => (i < 16 ? i * 8 - 64 : 64 - (i - 16) * 8) & 255);
export const SMP0 = { pos: 0, len: 32, loop: 0, rep: 32 };
export const IDLE_PATTERN = [0xFD, 0x07, 0xFF];             // stille Stimme
