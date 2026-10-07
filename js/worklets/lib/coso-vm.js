// === js/worklets/lib/coso-vm.js ===
// =========================================================
// COSO -> PAULA ADAPTER  —  v1.5.0  (Phase 5)
// ---------------------------------------------------------
// Verbindet den CosoReplayer (reine Zustandsmaschine) mit den Paula-Kanälen.
//
//   HARDWARE-PFAD (Kanal hat hwStartDMA): gemeinsames Chip-RAM, echte Registerfolge
//     RETRIGGER : LC/LEN = erster Durchlauf -> DMA-Start -> LC/LEN = Loop (oder Stille-Wort)
//     LATCH     : nur LC/LEN schreiben, greift am nächsten Loop-Wrap
//     SLIDE     : Loop-Fenster wandert = LC/LEN pro Tick neu latchen
//   LEGACY-PFAD (Kanal ohne Hardware-API): Phase-4-Verhalten mit subarray-Sichten
//
// Abwärtskompatibel zu paula-exact.js und paula-fantasy.js:
//   new CosoVirtualMachine(track, samplesDict, traceCb [, options])
//   vm.processTick(channels)   // 50x pro Sekunde
//   vm.tickCounter             // lesen: Fortschritt; schreiben (0): Neustart (SEEK)
//   vm.voices                  // Legacy-Attrappe für den alten SEEK-Block
//
// ZERO-ALLOCATION: Chip-RAM und Sichten entstehen im Konstruktor, processTick() allokiert nicht.
// =========================================================

import { CosoReplayer, REG } from './coso-replayer.js';

// Tickrate des Original-Players: 50 Hz. Gegen UADE gemessen (Abschnitt 15 der Spec): der Player läuft mit dem CIA-Standardtakt
// (Timer 14188 -> 49.9985 Hz, 27-28 ppm langsamer als exakt 50 Hz). Die ~49.707 Hz der YouTube-Aufnahmen sind ein Artefakt
// jener Aufnahmekette. Die Worklets teilen fest durch 50.0.
export const COSO_TICK_HZ = 50;

// Wie SAMPLE-Opcodes mitten in einer Note auf die DMA wirken (siehe CosoReplayer):
// 'restart' | 'latch' | 'hybrid' | 'split'. 'split' = $E4/$E7 nur LC/LEN latchen, $E2/$E5/$E9 starten die DMA neu.
// Gemessen gegen beide Referenzaufnahmen (gepaarte 4-s-Segmente, feine Bänder, gegen 'restart'):
//   Level 1: split +0.020 (t = 2.7), latch +0.016 (t = 2.1)
//   Level 2: split +0.003 (t = 4.3), latch -0.006 (t = -5.6)  -> reines 'latch' ist nicht robust, 'split' schon.
// Evidenz: moderat bis gut, kein Beweis (doc/specs/hipc-coso-verified-spec.md, Abschnitte 11 und 14).
export const COSO_WAVE_CHANGE = 'split';

// Chip-RAM-Layout: [0..1] = Stille-Wort (Ziel für "kein Loop"), ab CHIP_BASE die PCM-Bank.
export const CHIP_BASE = 0x100;
export const SILENCE_LC = 0;

const NUM_VOICES = 4;

export class CosoVirtualMachine {
    constructor(trackModule, samplesDict, traceCallback = null, options = {}) {
        if (!trackModule || !(trackModule.pcm instanceof Int8Array) || !trackModule.data || !trackModule.sampleTable) {
            throw new Error('CosoVirtualMachine: Track ist kein v1.5-COSO-Modul (parseCoso() erwartet).');
        }
        this.mod = trackModule;
        this.tickHz = options.tickHz || COSO_TICK_HZ;
        this.replayer = new CosoReplayer(trackModule, {
            song: trackModule.selectedSong,
            loop: true,
            waveChange: options.waveChange || COSO_WAVE_CHANGE,
            ...(options.replayer || {})                      // Messhaken: runoff, loopConv, portShift, vibShift
        });

        // Gemeinsames Chip-RAM (Kopie der PCM-Bank, wortweise gepolstert)
        const pcm = trackModule.pcm;
        this.chipRam = new Int8Array(CHIP_BASE + ((pcm.length + 3) & ~1));
        this.chipRam.set(pcm, CHIP_BASE);

        // Sichten für den Legacy-Pfad
        const n = trackModule.sampleTable.length;
        this.views = new Array(n);
        for (let i = 0; i < n; i++) {
            const s = trackModule.sampleTable[i];
            this.views[i] = pcm.subarray(s.start, s.start + s.length);
        }

        this.curLC = new Int32Array(NUM_VOICES);          // zuletzt gelatchte Register (Hardware-Pfad)
        this.curLEN = new Int32Array(NUM_VOICES);
        this.pendingSilence = new Uint8Array(NUM_VOICES); // Folge-Latch: nach einem One-Shot-Latch auf Stille umschalten
        this.dmaPrimed = new Uint8Array(NUM_VOICES);      // 1 = Kanal läuft bereits (Stille-Wort-Loop)
        this.lastLoopStart = new Int32Array(NUM_VOICES);  // Legacy-Pfad
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
            this.curLC.fill(0);
            this.curLEN.fill(0);
            this.pendingSilence.fill(0);
            this.dmaPrimed.fill(0);
            this.lastLoopStart.fill(0);
            this.lastLoopLen.fill(0);
        }
    }

    get voices() { return this.legacyVoices; }

    /**
     * Ein 50-Hz-Tick: Replayer vorwärts, Register in die Paula-Kanäle schreiben.
     * @param {object[]} channels
     */
    processTick(channels) {
        this.replayer.tick();
        if (typeof channels[0].hwStartDMA === 'function') this.applyHardware(channels);
        else this.applyLegacy(channels);
    }

    // -----------------------------------------------------------------
    // Hardware-Pfad
    // -----------------------------------------------------------------
    applyHardware(channels) {
        const r = this.replayer.regs;
        const ram = this.chipRam;

        for (let c = 0; c < NUM_VOICES; c++) {
            const o = c * REG.STRIDE;
            const ch = channels[c];
            if (ch.chipRam !== ram) ch.hwAttach(ram);
            if (!this.dmaPrimed[c]) {                               // wie der Original-Player: DMA läuft von Anfang an auf einem Stille-Wort,
                ch.hwWriteLC(SILENCE_LC);                           // spätere LC/LEN-Latches greifen dann am nächsten Wrap
                ch.hwWriteLEN(1);
                ch.hwStartDMA();
                this.curLC[c] = SILENCE_LC;
                this.curLEN[c] = 1;
                this.dmaPrimed[c] = 1;
            }

            if (this.pendingSilence[c]) {                           // Folge-Latch aus dem Vortick
                ch.hwWriteLC(SILENCE_LC);
                ch.hwWriteLEN(1);
                this.curLC[c] = SILENCE_LC;
                this.curLEN[c] = 1;
                this.pendingSilence[c] = 0;
            }

            const sample = r[o + REG.SAMPLE];
            if (sample < 0) { ch.writeAUDxVOL(0); continue; }

            const flags = r[o + REG.FLAGS];
            const period = r[o + REG.PERIOD];
            ch.writeAUDxPER(period);
            ch.writeAUDxVOL(period === 0 ? 0 : r[o + REG.VOLUME]);

            const startLC = CHIP_BASE + r[o + REG.DMA_START];
            const startLEN = r[o + REG.DMA_LEN] >> 1;
            const looped = r[o + REG.LOOP_LEN] > 2;
            const loopLC = looped ? CHIP_BASE + r[o + REG.LOOP_START] : SILENCE_LC;
            const loopLEN = looped ? (r[o + REG.LOOP_LEN] >> 1) : 1;

            if (flags & 1) {                                        // RETRIGGER: erster Durchlauf, dann Loop-Register
                ch.hwWriteLC(startLC);
                ch.hwWriteLEN(startLEN);
                ch.hwStartDMA();
                ch.hwWriteLC(loopLC);
                ch.hwWriteLEN(loopLEN);
                this.curLC[c] = loopLC;
                this.curLEN[c] = loopLEN;
            } else if (flags & 4) {                                 // LATCH: greift am nächsten Wrap
                if (looped) {
                    ch.hwWriteLC(loopLC);
                    ch.hwWriteLEN(loopLEN);
                    this.curLC[c] = loopLC;
                    this.curLEN[c] = loopLEN;
                } else {                                            // One-Shot: Sample einmal, danach Stille
                    ch.hwWriteLC(startLC);
                    ch.hwWriteLEN(startLEN);
                    this.curLC[c] = startLC;
                    this.curLEN[c] = startLEN;
                    this.pendingSilence[c] = 1;
                }
            } else if (loopLC !== this.curLC[c] || loopLEN !== this.curLEN[c]) {   // SLIDE-Fenster wandert
                ch.hwWriteLC(loopLC);
                ch.hwWriteLEN(loopLEN);
                this.curLC[c] = loopLC;
                this.curLEN[c] = loopLEN;
            }
        }
    }

    // -----------------------------------------------------------------
    // Legacy-Pfad (Phase 4): Kanäle ohne Hardware-API
    // -----------------------------------------------------------------
    applyLegacy(channels) {
        const r = this.replayer.regs;

        for (let c = 0; c < NUM_VOICES; c++) {
            const o = c * REG.STRIDE;
            const ch = channels[c];
            const sample = r[o + REG.SAMPLE];
            const flags = r[o + REG.FLAGS];
            const period = r[o + REG.PERIOD];
            const vol = (sample < 0 || period === 0) ? 0 : r[o + REG.VOLUME];

            if (sample < 0) { ch.writeAUDxVOL(0); continue; }

            const view = this.views[sample];
            const loopLen = r[o + REG.LOOP_LEN];
            const loopStart = r[o + REG.LOOP_START];

            if (flags & 5) {                                        // RETRIGGER | WAVE_CHANGED
                const loopStartW = (loopLen > 2) ? ((loopStart - r[o + REG.DMA_START]) >> 1) : 0;
                const loopLenW = (loopLen > 2) ? (loopLen >> 1) : 0;
                ch.writeAUDxLC(0, view, loopStartW, loopLenW);
                ch.writeAUDxLEN(view.length >> 1);
                ch.writeAUDxPER(period);
                ch.writeAUDxVOL(vol);
                ch.enableDMA(view, loopStartW, loopLenW);
                this.lastLoopStart[c] = loopStart;
                this.lastLoopLen[c] = loopLen;
            } else {
                ch.writeAUDxPER(period);
                ch.writeAUDxVOL(vol);
                if (loopStart !== this.lastLoopStart[c] || loopLen !== this.lastLoopLen[c]) {
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
