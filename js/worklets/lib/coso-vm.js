// === js/worklets/lib/coso-vm.js ===
// =========================================================
// COSO -> PAULA ADAPTER  —  v1.5.0  (Phase 4, interim)
// ---------------------------------------------------------
// Dünne Schicht zwischen CosoReplayer (reine Zustandsmaschine) und der
// bestehenden PaulaChannel-API. Abwärtskompatibel zu paula-exact.js und
// paula-fantasy.js:
//
//   new CosoVirtualMachine(track, samplesDict, traceCb)
//   vm.processTick(channels)          // 50x pro Sekunde
//   vm.tickCounter                    // lesen: Fortschritt; schreiben (0): Neustart (SEEK)
//   vm.voices                         // Legacy-Attrappe, damit der alte SEEK-Block nichts zerstört
//
// BEKANNTE EINSCHRÄNKUNG (Phase 5): PaulaChannel hat kein Chip-RAM. Jedes
// Sample wird als subarray-Sicht übergeben (curPtr startet bei 0), und ein
// Wellenwechsel ohne Neustart (FLAG.WAVE_CHANGED) wird wie ein Retrigger
// behandelt statt erst am nächsten Loop-Wrap zu greifen.
//
// ZERO-ALLOCATION: Alle Sichten werden im Konstruktor erzeugt.
// =========================================================

import { CosoReplayer, REG } from './coso-replayer.js';

// Standard-Tickrate (PAL-Vblank/CIA). Eine Referenzaufnahme von Wings of Death
// Level 1 lief mit ~49.707 Hz (siehe doc/specs/hipc-coso-verified-spec.md, Abschnitt 10).
// Die Worklets teilen aktuell fest durch 50.0; ein anderer Wert erfordert dort eine Anpassung.
export const COSO_TICK_HZ = 50;

const NUM_VOICES = 4;

export class CosoVirtualMachine {
    constructor(trackModule, samplesDict, traceCallback = null) {
        if (!trackModule || !(trackModule.pcm instanceof Int8Array) || !trackModule.data || !trackModule.sampleTable) {
            throw new Error('CosoVirtualMachine: Track ist kein v1.5-COSO-Modul (parseCoso() erwartet).');
        }
        this.mod = trackModule;
        this.tickHz = COSO_TICK_HZ;
        this.replayer = new CosoReplayer(trackModule, { song: trackModule.selectedSong, loop: true });

        const n = trackModule.sampleTable.length;
        this.views = new Array(n);
        for (let i = 0; i < n; i++) {
            const s = trackModule.sampleTable[i];
            this.views[i] = trackModule.pcm.subarray(s.start, s.start + s.length);
        }

        this.lastLoopStart = new Int32Array(NUM_VOICES);
        this.lastLoopLen = new Int32Array(NUM_VOICES);
        this.legacyVoices = [{}, {}, {}, {}];

        if (traceCallback) {
            const song = trackModule.song;
            traceCallback(`[COSO] ${trackModule.metadata.name}: song ${trackModule.selectedSong} ` +
                          `(${song.divisionCount} divisions, speed ${song.speed}), ${n} samples, tick ${this.tickHz} Hz`);
        }
    }

    get tickCounter() { return this.replayer.tickCount; }

    set tickCounter(value) {
        if (value === 0) {
            this.replayer.reset();
            this.lastLoopStart.fill(0);
            this.lastLoopLen.fill(0);
        }
    }

    get voices() { return this.legacyVoices; }

    /**
     * Ein 50-Hz-Tick: Replayer vorwärts, Register in die PaulaChannels schreiben.
     * @param {PaulaChannel[]} channels
     */
    processTick(channels) {
        const rp = this.replayer;
        rp.tick();
        const r = rp.regs;

        for (let c = 0; c < NUM_VOICES; c++) {
            const o = c * REG.STRIDE;
            const ch = channels[c];
            const sample = r[o + REG.SAMPLE];
            const flags = r[o + REG.FLAGS];
            const period = r[o + REG.PERIOD];
            const vol = (sample < 0 || period === 0) ? 0 : r[o + REG.VOLUME];

            if (sample < 0) {
                ch.writeAUDxVOL(0);
                continue;
            }

            const view = this.views[sample];
            const loopLen = r[o + REG.LOOP_LEN];
            const loopStart = r[o + REG.LOOP_START];

            if (flags & 5) {                                         // RETRIGGER | WAVE_CHANGED
                const loopStartW = (loopLen > 2) ? ((loopStart - r[o + REG.DMA_START]) >> 1) : 0;
                const loopLenW = (loopLen > 2) ? (loopLen >> 1) : 0;
                ch.writeAUDxLC(0, view, loopStartW, loopLenW);       // Adresse ungenutzt: kein Chip-RAM bis Phase 5
                ch.writeAUDxLEN(view.length >> 1);
                ch.writeAUDxPER(period);
                ch.writeAUDxVOL(vol);
                ch.enableDMA(view, loopStartW, loopLenW);
                this.lastLoopStart[c] = loopStart;
                this.lastLoopLen[c] = loopLen;
            } else {
                ch.writeAUDxPER(period);
                ch.writeAUDxVOL(vol);
                if (loopStart !== this.lastLoopStart[c] || loopLen !== this.lastLoopLen[c]) {   // SLIDE-Fenster wandert
                    const loopStartW = (loopLen > 2) ? ((loopStart - r[o + REG.DMA_START]) >> 1) : 0;
                    const loopLenW = (loopLen > 2) ? (loopLen >> 1) : 0;
                    ch.writeAUDxLC(0, view, loopStartW, loopLenW);
                    this.lastLoopStart[c] = loopStart;
                    this.lastLoopLen[c] = loopLen;
                }
            }
        }
    }
}
