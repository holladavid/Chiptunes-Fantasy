// === js/worklets/lib/hip-vm.js ===
// =========================================================
// HIPPEL "HIP" (UNKOMPRIMIERT, 68k-PLAYER VOR DEN DATEN)  —  v1.5.0
// ---------------------------------------------------------
// Statt das Verhalten nachzubauen, wird der ORIGINAL-Replay-Code der Datei im M68000-Interpreter ausgeführt
// (wie UADE es tut). Jeder Schreibzugriff auf die Paula-Register wird in die Hardware-API der Kanäle übersetzt.
// Der Chip-RAM der Kanäle ist derselbe Speicher, in dem der 68k-Code läuft: absolute Sample-Adressen stimmen automatisch.
//
// Begründung: Dieser Player ist eine andere Version als der COSO-Player (Portamento und Vibrato sind additiv in rohen
// Periodeneinheiten, nicht proportional), eine Nachbildung wäre also nicht klanggleich.
//
// Schnittstelle identisch zu CosoVirtualMachine: processTick(channels), tickCounter, position, seekToTick(frame), voices.
// =========================================================

import { M68000 } from './m68k.js';
import {
    COSO_TICK_HZ, HIP_RASTER_LINE_CLOCKS, HIP_VHPOS_READS_PER_LINE
} from './amiga-timing.js';

export const HIP_BASE = 0x20000;                  // Ladeadresse der Datei im emulierten Speicher
const STRUCT_SIZE = 0x52;                         // Größe einer Stimmen-Struktur im Zustandsbereich des Players
const DIVISION_OFFSET_FIELD = 58;                 // Wort in der Stimmen-Struktur: Offset in der Division-Tabelle, Rücksetzen auf 0 = Loop
const MAX_INSTR_PER_TICK = 400000;
const NUM_VOICES = 4;
const MAX_SCHEDULED_WRITES = 1024;
const EVENT_LC = 0;
const EVENT_LEN = 1;
const EVENT_PER = 2;
const EVENT_VOL = 3;
const EVENT_START = 4;
const EVENT_STOP = 5;

const be16 = (b, o) => (b[o] << 8) | b[o + 1];
const s16 = (b, o) => (((b[o] << 8) | b[o + 1]) << 16) >> 16;

/** Einsprungpunkte: Datei+0 = BRA.W init, Datei+4 = BRA.W play (Offsets relativ zum Dateianfang). */
export function hipEntryPoints(bytes) {
    if (bytes.length < 8 || bytes[0] !== 0x60 || bytes[1] !== 0x00 || bytes[4] !== 0x60 || bytes[5] !== 0x00) return null;
    return { init: 2 + s16(bytes, 2), play: 6 + s16(bytes, 6) };
}

/** Layout der Daten hinter der Signatur "TFMX": identisch zur Rechnung im init-Code des Players. */
export function hipLayout(bytes) {
    let h = -1;
    const limit = Math.min(bytes.length - 24, 0x20000);
    for (let i = 8; i < limit; i += 2) {
        if (bytes[i] === 0x54 && bytes[i + 1] === 0x46 && bytes[i + 2] === 0x4D && bytes[i + 3] === 0x58) { h = i; break; }
    }
    if (h < 0) return null;
    const w = (o) => be16(bytes, h + o);
    const nI = w(4) + 1, nT = w(6) + 1, nP = w(8) + 1, nD = w(10) + 1, patBytes = w(12), nSongs = w(16), nSamples = w(18);
    if (patBytes === 0 || patBytes > 0x400) return null;
    const instB = h + 32, timB = instB + nI * 64, patB = timB + nT * 64, divB = patB + nP * patBytes;
    const songB = divB + nD * 12, namB = songB + (nSongs + 1) * 6, pcmB = namB + nSamples * 30;
    if (pcmB > bytes.length) return null;
    return { header: h, nI, nT, nP, nD, patBytes, nSongs, nSamples, instB, timB, patB, divB, songB, namB, pcmB };
}

export class HipVirtualMachine {
    /**
     * @param {object} track  Ergebnis von parseHip()
     */
    constructor(track, samplesDict, traceCallback = null, options = {}) {
        if (!track || !(track.memory instanceof Uint8Array) || !track.layout) throw new Error('HipVirtualMachine: Track ist kein HIP-Modul (parseHip() erwartet).');
        this.track = track;
        this.base = track.base || HIP_BASE;
        this.cpu = new M68000(track.memSize || 0x80000);
        this.chipRam = new Int8Array(this.cpu.mem.buffer);
        this.image = track.memory;
        this.initAddr = this.base + track.initOffset;
        this.playAddr = this.base + track.playOffset;
        this.subsong = (track.selectedSong | 0) + 1;                      // der Player zählt Subsongs ab 1 (0 = Stopp)
        this.tickHz = options.tickHz || COSO_TICK_HZ;
        this.traceCallback = traceCallback;
        this.rasterTiming = options.rasterTiming === true;

        // Schattenregister der vier Audiokanäle
        this.lc = new Int32Array(NUM_VOICES);
        this.len = new Int32Array(NUM_VOICES);
        this.per = new Int32Array(NUM_VOICES);
        this.vol = new Int32Array(NUM_VOICES);
        this.en = new Uint8Array(NUM_VOICES);
        this.dmacon = 0;
        this.vh = 0;

        this.channels = null;
        this.muted = true;
        this.needResync = true;
        this.failed = false;
        this.tickCount = 0;
        this.passTick = 0;
        this.loopCount = 0;
        this.wrapped = false;
        this.lastTickWrapped = false;
        this.voiceBase = -1;
        this.songTicks = (track.song && track.song.ticks) || track.length || 0;
        this.legacyVoices = [{}, {}, {}, {}];

        // Vorallokierte, chronologische Registerwarteschlange. Sie wird nur im
        // Produktions-/Audio Renderer mit rasterTiming verwendet; die synchrone
        // Registerprüfung und das stille Vorspulen bleiben davon unberührt.
        this.scheduleDelay = new Float64Array(MAX_SCHEDULED_WRITES);
        this.scheduleChannel = new Uint8Array(MAX_SCHEDULED_WRITES);
        this.scheduleType = new Uint8Array(MAX_SCHEDULED_WRITES);
        this.scheduleValue = new Int32Array(MAX_SCHEDULED_WRITES);
        this.scheduleCount = 0;
        this.scheduleIndex = 0;
        this.scheduleClock = 0;
        this.rasterReads = 0;

        this.cpu.onCustomWrite = (a, s, v) => this.customWrite(a, s, v);
        this.cpu.onCustomRead = (a, s) => this.customRead(a, s);
        this.cpu.onWatch = (size, val) => { if (size === 1 && val === 0) this.wrapped = true; };

        this.hardReset();
        this.detectVoiceBase();
        if (traceCallback) {
            traceCallback(`[HIP] ${track.metadata.name}: Subsong ${this.subsong}, ${track.layout.nP} Patterns, ` +
                          `${track.layout.nSamples} Samples, Original-68k-Code @$${this.base.toString(16)}`);
        }
    }

    resetSchedule() {
        this.scheduleCount = 0;
        this.scheduleIndex = 0;
        this.scheduleClock = 0;
        this.rasterReads = 0;
    }

    scheduledDelay() {
        return Math.floor(this.rasterReads / HIP_VHPOS_READS_PER_LINE) * HIP_RASTER_LINE_CLOCKS;
    }

    applyChannelEvent(channel, type, value) {
        const ch = this.channels[channel];
        switch (type) {
            case EVENT_LC: ch.hwWriteLC(value); break;
            case EVENT_LEN: ch.hwWriteLEN(value); break;
            case EVENT_PER: ch.writeAUDxPER(value); break;
            case EVENT_VOL: ch.writeAUDxVOL(value); break;
            case EVENT_START: ch.hwStartDMA(); break;
            case EVENT_STOP: ch.hwStopDMA(); break;
        }
    }

    writeChannelEvent(channel, type, value) {
        if (!this.rasterTiming) {
            this.applyChannelEvent(channel, type, value);
            return;
        }
        if (this.scheduleCount >= MAX_SCHEDULED_WRITES) {
            throw new Error('HipVirtualMachine: Registerwarteschlange überschreitet 1024 Einträge');
        }
        const index = this.scheduleCount++;
        this.scheduleDelay[index] = this.scheduledDelay();
        this.scheduleChannel[index] = channel;
        this.scheduleType[index] = type;
        this.scheduleValue[index] = value;
    }

    /** Paula-Takte seit dem aktuellen Replay-Tick; keine Allokation im Audiokern. */
    advance(clockTicks) {
        if (!this.rasterTiming) return;
        this.scheduleClock += clockTicks;
        while (this.scheduleIndex < this.scheduleCount &&
               this.scheduleDelay[this.scheduleIndex] <= this.scheduleClock) {
            const index = this.scheduleIndex++;
            this.applyChannelEvent(this.scheduleChannel[index], this.scheduleType[index], this.scheduleValue[index]);
        }
    }

    flushScheduled() {
        if (!this.rasterTiming) return;
        this.scheduleClock = Number.POSITIVE_INFINITY;
        this.advance(0);
    }

    // ------------------------------------------------------------------ Zustand
    hardReset() {
        this.resetSchedule();
        const cpu = this.cpu;
        cpu.mem.fill(0);
        cpu.mem.set(this.image, this.base);
        cpu.d.fill(0); cpu.a.fill(0);
        cpu.a[7] = this.base - 0x100;
        cpu.x = cpu.n = cpu.z = cpu.v = cpu.c = 0;
        cpu.watchAddr = -1;
        this.lc.fill(0); this.len.fill(0); this.per.fill(0); this.vol.fill(0); this.en.fill(0);
        this.dmacon = 0x0200;                                               // DMAEN (Master) ist vom System gesetzt
        this.vh = 0;
        this.muted = true;
        this.tickCount = 0; this.passTick = 0; this.loopCount = 0; this.wrapped = false; this.lastTickWrapped = false;
        cpu.d[0] = this.subsong;
        cpu.call(this.initAddr, MAX_INSTR_PER_TICK);
        this.needResync = true;
        if (this.voiceBase >= 0) cpu.watchAddr = this.base + this.voiceBase + DIVISION_OFFSET_FIELD;
    }

    /** Stimmen-Struktur im Zustandsbereich finden: vier Zeiger auf die Division-Einträge im Abstand STRUCT_SIZE. */
    detectVoiceBase() {
        const L = this.track.layout, cpu = this.cpu, b = this.base;
        const songOff = L.songB + (this.subsong - 1) * 6;
        const start = be16(this.image, songOff);
        const expect0 = b + L.divB + 12 * start;
        for (let o = 0; o < L.header; o += 2) {
            if (cpu.read(b + o, 2) !== expect0) continue;
            let ok = true;
            for (let v = 1; v < NUM_VOICES; v++) if (cpu.read(b + o + v * STRUCT_SIZE, 2) !== expect0 + 3 * v) { ok = false; break; }
            if (ok) {
                this.voiceBase = o - 4;                                   // Division-Zeiger liegt bei struct+4
                cpu.watchAddr = b + this.voiceBase + DIVISION_OFFSET_FIELD;
                return true;
            }
        }
        return false;
    }

    // ------------------------------------------------------------------ Hardware-Zugriffe des Players
    customWrite(addr, size, val) {
        if (size === 2) { this.wordWrite(addr, val >>> 16); this.wordWrite(addr + 2, val & 0xFFFF); }
        else if (size === 1) this.wordWrite(addr, val);
        else this.wordWrite(addr & ~1, val & 0xFF);
    }

    wordWrite(a, v) {
        const ch = (this.muted || this.channels === null) ? null : this.channels;
        if (a >= 0xDFF0A0 && a < 0xDFF0E0) {
            const c = (a - 0xDFF0A0) >> 4;
            switch (a & 0xF) {
                case 0: this.lc[c] = ((v & 0x1F) << 16) | (this.lc[c] & 0xFFFF); if (ch) this.writeChannelEvent(c, EVENT_LC, this.lc[c]); break;
                case 2: this.lc[c] = (this.lc[c] & 0x1F0000) | (v & 0xFFFE); if (ch) this.writeChannelEvent(c, EVENT_LC, this.lc[c]); break;
                case 4: this.len[c] = v; if (ch) this.writeChannelEvent(c, EVENT_LEN, v); break;
                case 6: this.per[c] = v; if (ch) this.writeChannelEvent(c, EVENT_PER, v); break;
                case 8: { const vol = (v & 0x7F) > 64 ? 64 : (v & 0x7F); this.vol[c] = vol; if (ch) this.writeChannelEvent(c, EVENT_VOL, vol); break; }
                default: break;                                              // AUDxDAT: ungenutzt
            }
            return;
        }
        if (a === 0xDFF096) {                                               // DMACON: Bit 15 = SET/CLR
            this.dmacon = (v & 0x8000) ? (this.dmacon | (v & 0x7FFF)) : (this.dmacon & ~(v & 0x7FFF));
            for (let c = 0; c < NUM_VOICES; c++) {
                const on = ((this.dmacon & 0x200) !== 0 && (this.dmacon & (1 << c)) !== 0) ? 1 : 0;
                if (on !== this.en[c]) {
                    this.en[c] = on;
                    if (ch) this.writeChannelEvent(c, on ? EVENT_START : EVENT_STOP, 0);
                }
            }
        }
        // INTENA/INTREQ/ADKCON und CIA-Schreibzugriffe (Audiofilter-LED) sind für die Wiedergabe ohne Wirkung
    }

    readWord(a) {
        if (a === 0xDFF006 || a === 0xDFF004) {
            if (this.rasterTiming) this.rasterReads++;
            this.vh = (this.vh + 0x100) & 0xFFFF;
            return this.vh;
        }
        if (a === 0xDFF01E) return 0xFFFF;                                                                 // INTREQR: Warteschleifen enden
        if (a === 0xDFF002) return this.dmacon;
        return 0;
    }

    customRead(addr, size) {
        if (size === 0) { const w = this.readWord(addr & ~1); return (addr & 1) ? (w & 0xFF) : (w >> 8); }
        return this.readWord(addr & ~1);
    }

    // ------------------------------------------------------------------ Wiedergabe
    /** Schattenregister in die Kanäle übertragen (nach Start und nach dem Spulen). */
    syncChannels(ch) {
        for (let c = 0; c < NUM_VOICES; c++) {
            if (ch[c].chipRam !== this.chipRam) ch[c].hwAttach(this.chipRam);
            ch[c].hwStopDMA();
            ch[c].hwWriteLC(this.lc[c]);
            ch[c].hwWriteLEN(this.len[c]);
            ch[c].writeAUDxPER(this.per[c]);
            ch[c].writeAUDxVOL(this.vol[c]);
            if (this.en[c]) ch[c].hwStartDMA();
        }
    }

    runPlay() {
        this.wrapped = false;
        this.cpu.call(this.playAddr, MAX_INSTR_PER_TICK);
        this.lastTickWrapped = this.wrapped;
        this.tickCount++;
        if (this.wrapped) { this.passTick = 1; this.loopCount++; } else this.passTick++;
    }

    processTick(channels) {
        if (this.failed) return;
        if (typeof channels[0].hwStartDMA !== 'function') throw new Error('HipVirtualMachine: Kanäle ohne Hardware-DMA-API (patches/paula-hw-dma.patch fehlt).');
        this.channels = channels;
        // Falls ein Headless-Aufrufer advance() nicht verwendet, werden alte
        // Ereignisse spätestens vor dem nächsten Tick in ihrer Reihenfolge
        // ausgeführt. Der Audiokern ruft advance() dagegen pro Oversample auf.
        this.flushScheduled();
        this.resetSchedule();
        if (this.needResync) { this.syncChannels(channels); this.needResync = false; }
        this.muted = false;
        try {
            this.runPlay();
            this.advance(0); // alle Schreibzugriffe am Tickanfang sofort anwenden
        } catch (e) {
            this.failed = true;
            this.resetSchedule();
            for (let c = 0; c < NUM_VOICES; c++) { channels[c].writeAUDxVOL(0); }
            if (this.traceCallback) this.traceCallback(`[HIP] Player-Fehler: ${e.message}`);
        }
    }

    get tickCounter() { return this.tickCount; }
    set tickCounter(value) { if (value === 0) { this.hardReset(); this.failed = false; } }
    get position() { return this.passTick; }
    get voices() { return this.legacyVoices; }

    /**
     * Spulen: Neustart des Players und ohne Ausgabe bis zum Zielpunkt vorlaufen lassen. Danach werden die Kanäle aus den
     * Schattenregistern neu aufgebaut; eine laufende Welle klingt sofort weiter (Wellenphase neu).
     */
    seekToTick(frame) {
        let f = frame | 0;
        if (f < 0) f = 0;
        if (this.songTicks > 0 && f >= this.songTicks) f = this.songTicks - 1;
        this.failed = false;
        this.hardReset();
        this.muted = true;
        try { for (let i = 0; i < f; i++) this.runPlay(); }
        catch (e) { this.failed = true; if (this.traceCallback) this.traceCallback(`[HIP] Player-Fehler beim Spulen: ${e.message}`); }
        this.needResync = true;
    }
}

/**
 * Original-Laufzeit eines Subsongs: Ticks bis zum ersten Loop-Wrap der Stimme 0 (headless, ohne Kanäle).
 * @returns {{ticks:number, complete:boolean}}
 */
export function hipSongTicks(track, songIndex, maxTicks = 90000) {
    const vm = new HipVirtualMachine({ ...track, selectedSong: songIndex, song: null, length: 0 }, null, null, {});
    if (vm.voiceBase < 0) return { ticks: 0, complete: false };
    vm.muted = true;
    try {
        while (vm.tickCount < maxTicks) {
            const before = vm.tickCount;
            vm.runPlay();
            if (vm.lastTickWrapped) return { ticks: before, complete: true };
        }
    } catch (e) { return { ticks: 0, complete: false }; }
    return { ticks: 0, complete: false };
}
