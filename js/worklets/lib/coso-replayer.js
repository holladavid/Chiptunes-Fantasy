// === js/worklets/lib/coso-replayer.js ===
// =========================================================
// HIPPEL-COSO TICK REPLAYER  —  v1.5.0
// ---------------------------------------------------------
// Deterministische Zustandsmaschine. Kein Audio, kein Paula, kein DOM.
// Pro tick() (50 Hz) werden 4 Register-Blöcke in `regs` geschrieben,
// die Phase 5 1:1 auf AUDxLC/LEN/PER/VOL + DMA abbildet.
//
// ZERO-ALLOCATION: tick() und alle Helfer erzeugen keine Objekte/Arrays.
//
// Semantik-Quelle: Amberstar-Spec (Pyrdacor) + Forensik an Wings of Death
// L1/L2. Pfade, die in L1/L2 NICHT vorkommen, sind mit "UNVERIFIED" markiert
// (E3, E5, E6, E9, E8, SUSTAIN, FULL-STOP, channel_volume-Effekte).
// =========================================================

// Note -> Amiga-Periode (7 Oktaven). Oktave 4 = Clamp (113), Oktave 5/6 = Sub-Oktaven.
export const COSO_PERIODS = new Uint16Array([
    1712, 1616, 1524, 1440, 1356, 1280, 1208, 1140, 1076, 1016, 960, 906,
     856,  808,  762,  720,  678,  640,  604,  570,  538,  508, 480, 453,
     428,  404,  381,  360,  339,  320,  302,  285,  269,  254, 240, 226,
     214,  202,  190,  180,  170,  160,  151,  143,  135,  127, 120, 113,
     113,  113,  113,  113,  113,  113,  113,  113,  113,  113, 113, 113,
    3424, 3232, 3048, 2880, 2712, 2560, 2416, 2280, 2152, 2032, 1920, 1812,
    6848, 6464, 6096, 5760, 5424, 5120, 4832, 4560, 4304, 4064, 3840, 3624
]);

export const REG = Object.freeze({
    PERIOD: 0,        // Amiga-Periode, 0 = Kanal still
    VOLUME: 1,        // 0..64
    SAMPLE: 2,        // Sample-Index, -1 = keiner
    LOOP_START: 3,    // Byte-Offset in der PCM-Bank (absolut)
    LOOP_LEN: 4,      // Bytes, 0 = kein Loop
    FLAGS: 5,         // FLAG.*
    DMA_START: 6,     // Byte-Offset in der PCM-Bank (absolut), erster Durchlauf
    DMA_LEN: 7,       // Bytes, erster Durchlauf
    STRIDE: 8
});

export const FLAG = Object.freeze({
    RETRIGGER: 1,     // DMA neu starten (LC/LEN neu laden)
    ACTIVE: 2,        // Stimme hat eine Note
    WAVE_CHANGED: 4   // Sample gewechselt ohne Neustart (greift am nächsten Loop-Wrap)
});

const MIN_PERIOD = 113;
const GUARD = 32;                       // Schutz gegen Null-Dauer-Endlosschleifen
const NUM_VOICES = 4;

class Voice {
    constructor(index) {
        this.index = index;
        // Pattern-Ebene
        this.div = 0; this.patPtr = 0; this.patEnd = 0;
        this.patSpeed = 1; this.chanSpeed = 1; this.chanVol = 100;
        this.timbreAdjust = 0; this.transpose = 0; this.wait = 0;
        this.note = 0;
        // Timbre / Instrument
        this.timbre = 0; this.instrument = 0;
        this.instStart = 0; this.instEnd = 0; this.instPtr = 0;
        this.instWait = 0; this.instDone = true;
        this.instPitch = 0; this.instAbs = false;
        // Sample / Slide
        this.sample = -1;
        this.slideActive = false; this.slideLen = 0; this.slideStart = 0;
        this.slideDelta = 0; this.slideSpeed = 1; this.slideCount = 0;
        // Volume-Envelope
        this.envStart = 0; this.envPtr = 0; this.envEnd = 0;
        this.envWait = 0; this.envSpeed = 1; this.envVol = 0; this.envHold = true;
        // Vibrato
        this.vibDelay = 0; this.vibSlope = 0; this.vibDepth = 0; this.vibPos = 0; this.vibDir = -1;
        // Portamento
        this.portActive = false; this.portSlope = 0; this.portT = 0;
        // pro Tick
        this.flags = 0; this.active = false; this.loops = 0;
    }
}

function s8(v) { return (v << 24) >> 24; }

export class CosoReplayer {
    /**
     * @param {object} mod   Ergebnis von parseCoso()
     * @param {object} [opt] { song, loop, waveChange }
     *   waveChange: wie ein SAMPLE-Opcode MITTEN in einer Note auf die Hardware wirkt
     *     'restart' : DMA-Neustart bei reset=1 oder anderem Sample (Amberstar-Spec wörtlich)
     *     'latch'   : nur AUDxLC/LEN neu schreiben, greift am nächsten Loop-Wrap (kein Phasensprung)
     *     'hybrid'  : anderes Sample -> latch, gleiches Sample mit reset=1 -> restart
     *     'split'   : $E4/$E7 -> latch, alle anderen SAMPLE-Opcodes ($E2, $E5, $E9) -> restart
     *   Note-Trigger starten die DMA immer neu.
     * Messhaken für offene Semantikfragen (Standard = Spec-Verhalten, siehe Abschnitt 12 der Spec):
     *   triggerRestart : 0                          0 = nur $E2/$E5/$E9 (SAMPLE mit Reset) starten die DMA neu (Standard, belegt),
     *                                               1 = zusätzlich jeder Note-Trigger
     *   runoff    : 'continue' | 'hold' | 'restart' | 'silence'  Instrument ohne Terminator erreicht sein Ende
     *               ('continue', Standard = der Zeiger läuft in die Bytes des Folge-Instruments weiter, wie in einem 68k-Player;
     *               gegen UADE leicht besser als 'hold', 'silence' und 'restart' sind schlechter)
     *   loopConv  : 'full' | 'toLoopEnd'            erster Durchlauf bis Sample-Ende oder nur bis Loop-Ende
     *   portMode  : 'mul' | 'add'                   proportional wie in der Amberstar-Spec (period * t * slope >> shift, Standard,
     *                                               gegen UADE belegt) oder additiv ((t * slope * portMul) >> shift)
     *   envSpec   : 0 | 1                           1 = Envelope-Opcodes wie in der Amberstar-Spec ($E0 SUSTAIN, $E8 LOOP) statt $E8 SUSTAIN, $E0 LOOP
     *   portShift : 10 ('mul') / 5 ('add')          Portamento-Skalierung; bei 'mul' bedeutet 0 = aus
     *   portOrder : 0 | 1                           0 = t vor der Anwendung erhöhen (t = 1 im ersten Tick), 1 = danach (t = 0)
     *   portMul   : 1                               Zusatzfaktor im 'add'-Modus: (t * slope * portMul) >> portShift
     *   vibShift  : 10                              Vibrato-Skalierung (period * vib >> vibShift), 0 = aus
     *   vibOrder  : 1 | 0                           1 = erst anwenden, dann weiterschalten (Standard, belegt), 0 = umgekehrt
     *   vibSlopeX2: 2                               Schrittweite = slope * vibSlopeX2 / 2 (1 = halb, 4 = doppelt)
     *   vibRound  : 1 | 0                           1 = Richtung Null (Standard, belegt), 0 = abrunden (>>)
     *   vibStart  : 0 | 1 | 2                       Startwert +depth/2 (oben), 0 (Mitte), -depth/2 (unten)
     *   vibDelayStatic : 0 | 1                      1 = während der Verzögerung gilt bereits der Startwert (nur die Bewegung wartet)
     */
    constructor(mod, opt = {}) {
        this.data = mod.data;
        this.instOff = mod.instrumentOffsets;
        this.timbreOff = mod.timbreOffsets;
        this.monoOff = mod.monopatternOffsets;
        this.instEndOf = mod.instrumentEnds;                 // alias-feste Elementenden (nicht offsets[i+1]!)
        this.timbreEndOf = mod.timbreEnds;
        this.monoEndOf = mod.monopatternEnds;
        this.nInst = mod.header.counts.instruments;
        this.nTimbre = mod.header.counts.timbres;
        this.nMono = mod.header.counts.monopatterns;
        this.divPattern = mod.divisions.pattern;
        this.divTranspose = mod.divisions.transpose;
        this.divEffect = mod.divisions.effect;

        // Sample-Tabelle als flache Int32Arrays (kein Objektzugriff im Hot-Path)
        const n = mod.sampleTable.length;
        this.nSamples = n;
        this.smpStart = new Int32Array(n);
        this.smpLen = new Int32Array(n);
        this.smpLoopStart = new Int32Array(n);
        this.smpLoopLen = new Int32Array(n);
        for (let i = 0; i < n; i++) {
            const s = mod.sampleTable[i];
            this.smpStart[i] = s.start;
            this.smpLen[i] = s.length;
            this.smpLoopStart[i] = s.looped ? s.start + s.loopStart : 0;
            this.smpLoopLen[i] = s.looped ? s.loopLength : 0;
        }

        const songIndex = (opt.song === undefined) ? mod.selectedSong : (opt.song | 0);
        const song = mod.songs[songIndex];
        this.songStart = song.start;
        this.songEnd = song.end;
        this.songSpeed = song.speed;
        this.loop = (opt.loop === undefined) ? true : !!opt.loop;
        const wc = opt.waveChange || 'restart';
        this.triggerRestart = !!opt.triggerRestart;               // Standard: aus (Level-2-Messung, Abschnitt 15)
        this.runoffMode = (opt.runoff === 'hold') ? 0 : (opt.runoff === 'restart') ? 1 : (opt.runoff === 'silence') ? 2 : 3;   // Standard 'continue'
        this.instSectionEnd = mod.header.pos.timbres;            // Ende der Instrument-Sektion (für 'continue')
        this.loopToEnd = (opt.loopConv === 'toLoopEnd');
        // Portamento: Formel der Amberstar-Spec (proportional, >>10). Gegen die UADE-Referenz belegt (R2 0.77 gegen 0.3 bei jeder
        // Alternative); der frühere additive Fit aus den YouTube-Aufnahmen war ein Artefakt der groben Spektralmessung.
        this.portAdd = (opt.portMode === 'add');
        this.portShift = (opt.portShift === undefined) ? (this.portAdd ? 5 : 10) : (opt.portShift | 0);
        this.portOrder = (opt.portOrder | 0);
        this.envSpec = !!opt.envSpec;
        this.portMul = (opt.portMul === undefined) ? 1 : (opt.portMul | 0);
        this.vibShift = (opt.vibShift === undefined) ? 10 : (opt.vibShift | 0);
        this.vibOrder = (opt.vibOrder === undefined) ? 1 : (opt.vibOrder | 0);
        this.vibSlopeX2 = (opt.vibSlopeX2 === undefined) ? 2 : (opt.vibSlopeX2 | 0);
        this.vibRound = (opt.vibRound === undefined) ? 1 : (opt.vibRound | 0);
        this.vibStart = (opt.vibStart | 0);
        this.vibDelayStatic = (opt.vibDelayStatic | 0);
        this.waveMode = (wc === 'latch') ? 1 : (wc === 'hybrid') ? 2 : (wc === 'split') ? 3 : 0;

        this.voices = [];
        for (let i = 0; i < NUM_VOICES; i++) this.voices.push(new Voice(i));
        this.regs = new Int32Array(NUM_VOICES * REG.STRIDE);

        this.tickCount = 0;
        this.loopCount = 0;
        this.finished = false;
        // Diagnosezähler (keine Warnungen im Hot-Path, nur Zähler)
        this.stats = { badTimbre: 0, badInstrument: 0, badPattern: 0, badSample: 0, guardHits: 0, silentNotes: 0, instRunoff: 0 };
        this.reset();
    }

    reset() {
        this.tickCount = 0;
        this.loopCount = 0;
        this.finished = false;
        this.regs.fill(0);
        for (let i = 0; i < NUM_VOICES; i++) {
            const v = this.voices[i];
            v.patSpeed = 1; v.chanSpeed = this.songSpeed; v.chanVol = 100;
            v.timbreAdjust = 0; v.transpose = 0; v.wait = 0; v.note = 0;
            v.timbre = 0; v.instrument = 0; v.instDone = true; v.instWait = 0;
            v.instPitch = 0; v.instAbs = false; v.sample = -1; v.slideActive = false;
            v.envVol = 0; v.envHold = true; v.envWait = 0;
            v.vibDelay = 0; v.vibDepth = 0; v.vibSlope = 0; v.portActive = false; v.portT = 0;
            v.flags = 0; v.active = false; v.loops = 0;
            this.loadDivision(v, this.songStart);
            this.regs[i * REG.STRIDE + REG.SAMPLE] = -1;
        }
    }

    // ------------------------------------------------------------------
    // Division / Pattern
    // ------------------------------------------------------------------
    loadDivision(v, dv) {
        v.div = dv;
        const k = dv * 4 + v.index;
        let pat = this.divPattern[k];
        v.transpose = this.divTranspose[k];
        const ef = this.divEffect[k];

        if ((ef & 0x80) === 0) {
            v.timbreAdjust = ef;
        } else {
            const hi = ef & 0xF0;
            if (hi === 0x80) {
                this.finished = true;                               // FULL-STOP (UNVERIFIED)
            } else if (hi === 0xE0) {
                v.chanSpeed = 1 + (ef & 0x0F);                      // channel_speed (UNVERIFIED)
            } else if (hi === 0xF0) {
                const y = ef & 0x0F;
                v.chanVol = (y === 0) ? 100 : (16 - y) * 6;         // channel_volume (UNVERIFIED)
            }
        }
        if (pat >= this.nMono) { this.stats.badPattern++; pat = 0; }
        v.patPtr = this.monoOff[pat];
        v.patEnd = this.monoEndOf[pat];
    }

    nextDivision(v) {
        let dv = v.div + 1;
        if (dv > this.songEnd) {
            if (!this.loop) { this.finished = true; return; }
            dv = this.songStart;
            v.loops++;
            if (v.index === 0) this.loopCount++;
        }
        this.loadDivision(v, dv);
    }

    stepPattern(v) {
        if (v.wait > 0) { v.wait--; return; }
        const d = this.data;
        for (let guard = 0; guard < GUARD; guard++) {
            if (v.patPtr >= v.patEnd) { this.nextDivision(v); if (this.finished) return; continue; }
            const b = d[v.patPtr];
            if (b === 0xFF) { this.nextDivision(v); if (this.finished) return; continue; }
            if (b === 0xFE) { v.patSpeed = d[v.patPtr + 1] + 1; v.patPtr += 2; continue; }
            if (b === 0xFD) {
                v.patSpeed = d[v.patPtr + 1] + 1; v.patPtr += 2;
                v.wait = v.patSpeed * v.chanSpeed - 1;
                return;
            }
            const info = d[v.patPtr + 1];
            let extra = 0;
            let len = 2;
            if (info & 0xE0) { extra = d[v.patPtr + 2]; len = 3; }
            v.patPtr += len;
            this.noteEvent(v, b, info, extra);
            v.wait = v.patSpeed * v.chanSpeed - 1;
            return;
        }
        this.stats.guardHits++;
    }

    noteEvent(v, b, info, extra) {
        // i8 <= 0  (Bit 7 gesetzt oder 0): Tonhöhe neu setzen OHNE Retrigger, Portamento endet.
        if (b === 0 || b >= 0x80) {
            v.note = b & 0x7F;
            v.portActive = false;
            return;
        }

        let tim = (info & 0x1F) + v.timbreAdjust;
        if (tim >= this.nTimbre) { this.stats.badTimbre++; return; }

        const to = this.timbreOff[tim];
        const d = this.data;
        const hInstr = d[to + 1];
        let instr = v.instrument;
        if (hInstr !== 0x80) instr = (info & 0x40) ? extra : hInstr;
        if (instr >= this.nInst) { this.stats.badInstrument++; instr = v.instrument; }

        v.note = b;
        v.timbre = tim;
        v.instrument = instr;
        v.instStart = this.instOff[instr];
        v.instEnd = (this.runoffMode === 3) ? this.instSectionEnd : this.instEndOf[instr];
        v.instPtr = v.instStart;
        v.instWait = 0;
        v.instDone = false;
        v.instPitch = 0;
        v.instAbs = false;
        v.slideActive = false;

        v.envStart = to;
        v.envPtr = to + 5;
        v.envEnd = this.timbreEndOf[tim];
        v.envWait = 0;
        v.envSpeed = d[to] || 1;
        v.envHold = false;

        v.vibSlope = d[to + 2];
        v.vibDepth = d[to + 3];
        v.vibDelay = d[to + 4];
        v.vibPos = this.vibStartValue(v.vibDepth);
        v.vibDir = -1;

        v.portActive = (info & 0x20) !== 0;
        v.portSlope = s8(extra);
        v.portT = 0;

        v.flags |= (this.triggerRestart ? 1 : 0) | 2;               // RETRIGGER | ACTIVE
        v.active = true;
    }

    // ------------------------------------------------------------------
    // Instrument (Pitch-/Wave-Programm)
    // ------------------------------------------------------------------
    setSample(v, s, reset, soft) {
        if (s >= this.nSamples) { this.stats.badSample++; return; }
        const changed = (s !== v.sample);
        v.sample = s;
        v.slideActive = false;
        if (v.flags & 1) return;                                    // Note-Trigger-Tick: DMA startet ohnehin neu
        if (this.waveMode === 0) v.flags |= (reset || changed) ? 1 : 4;
        else if (this.waveMode === 1) { if (reset || changed) v.flags |= 4; }
        else if (this.waveMode === 2) v.flags |= changed ? 4 : (reset ? 1 : 0);
        else if (soft) { if (reset || changed) v.flags |= 4; }       // 'split': $E4/$E7 latchen ...
        else v.flags |= (reset || changed) ? 1 : 4;                  // ... $E2/$E5/$E9 starten neu
    }

    vibDelta(period, pos) {
        const x = period * pos;
        return (this.vibRound === 1 && x < 0) ? -((-x) >> this.vibShift) : (x >> this.vibShift);
    }

    vibStartValue(depth) {
        const half = depth >> 1;
        return this.vibStart === 1 ? 0 : this.vibStart === 2 ? -half : half;
    }

    resetEnvelope(v) {
        v.envPtr = v.envStart + 5;
        v.envWait = 0;
        v.envHold = false;
    }

    stepInstrument(v) {
        if (!v.instDone) {
            if (v.instWait > 0) v.instWait--;
            else this.runInstrument(v);
        }
        // SLIDE läuft unabhängig vom Instrument-Programm weiter (UNVERIFIED)
        if (v.slideActive) {
            if (--v.slideCount <= 0) {
                v.slideCount = v.slideSpeed;
                const ns = v.slideStart + v.slideDelta;
                if (v.sample >= 0 && ns >= 0 && ns + v.slideLen <= this.smpLen[v.sample]) v.slideStart = ns;
            }
        }
    }

    runInstrument(v) {
        const d = this.data;
        for (let guard = 0; guard < GUARD; guard++) {
            if (v.instPtr >= v.instEnd) {
                this.stats.instRunoff++;
                if (this.runoffMode === 1) { v.instPtr = v.instStart; continue; }
                if (this.runoffMode === 2) { v.envVol = 0; v.envHold = true; }
                v.instDone = true;
                return;
            }
            const c = d[v.instPtr];
            if (c < 0xE0) {                                         // PITCH (1 Tick)
                v.instAbs = (c & 0x80) !== 0;
                v.instPitch = c & 0x7F;
                v.instPtr++;
                return;
            }
            switch (c) {
                case 0xE0: v.instPtr = v.instStart + d[v.instPtr + 1]; break;                   // LOOP
                case 0xE1: v.instDone = true; return;                                           // COMPLETED
                case 0xE2:                                                                      // SAMPLE(s,1)
                    this.setSample(v, d[v.instPtr + 1], true, false); v.instPtr += 2; break;
                case 0xE4:                                                                      // SAMPLE(s,1); im Modus 'split' latchend
                    this.setSample(v, d[v.instPtr + 1], true, true); v.instPtr += 2; break;
                case 0xE3:                                                                      // VIBRATO (UNVERIFIED)
                    v.vibSlope = d[v.instPtr + 1]; v.vibDepth = d[v.instPtr + 2];
                    v.vibPos = this.vibStartValue(v.vibDepth); v.vibDir = -1; v.instPtr += 3; break;
                case 0xE5: {                                                                    // SAMPLE+SLIDE+RESET-VOL (UNVERIFIED)
                    const s = d[v.instPtr + 1];
                    const loop16 = (d[v.instPtr + 2] << 8) | d[v.instPtr + 3];
                    const len = ((d[v.instPtr + 4] << 8) | d[v.instPtr + 5]) * 2;
                    const delta = (((d[v.instPtr + 6] << 8) | d[v.instPtr + 7]) << 16 >> 16) * 2;
                    const speed = d[v.instPtr + 8];
                    v.instPtr += 9;
                    this.setSample(v, s, true);
                    if (s < this.nSamples) {
                        v.slideActive = true; v.slideLen = len; v.slideDelta = delta;
                        v.slideSpeed = speed || 1; v.slideCount = v.slideSpeed;
                        v.slideStart = (loop16 === 0xFFFF) ? this.smpLen[s] : loop16 * 2;
                    }
                    this.resetEnvelope(v);
                    break;
                }
                case 0xE6:                                                                      // SLIDE (UNVERIFIED)
                    v.slideLen = ((d[v.instPtr + 1] << 8) | d[v.instPtr + 2]) * 2;
                    v.slideDelta = (((d[v.instPtr + 3] << 8) | d[v.instPtr + 4]) << 16 >> 16) * 2;
                    v.slideSpeed = d[v.instPtr + 5] || 1; v.slideCount = v.slideSpeed;
                    if (v.sample >= 0) { v.slideActive = true; v.slideStart = this.smpLoopStart[v.sample] - this.smpStart[v.sample]; }
                    v.instPtr += 6; break;
                case 0xE7:                                                                      // SAMPLE(s,0)+RESET-VOL
                    this.setSample(v, d[v.instPtr + 1], false, true); this.resetEnvelope(v); v.instPtr += 2; break;
                case 0xE8:                                                                      // INSTRUMENT-DELAY (UNVERIFIED)
                    v.instWait = d[v.instPtr + 1]; v.instPtr += 2; return;
                case 0xE9:                                                                      // SAMPLE-CUSTOM (UNVERIFIED: Offset ignoriert)
                    this.setSample(v, d[v.instPtr + 1], true); v.instPtr += 3; break;
                default: v.instPtr++; break;                                                    // $EA..$FF unbekannt
            }
        }
        v.instDone = true;
        this.stats.guardHits++;
    }

    // ------------------------------------------------------------------
    // Volume-Envelope
    // ------------------------------------------------------------------
    stepEnvelope(v) {
        if (v.envHold) return;
        if (v.envWait > 0) { v.envWait--; return; }
        const d = this.data;
        for (let guard = 0; guard < GUARD; guard++) {
            if (v.envPtr >= v.envEnd) { v.envHold = true; return; }
            const c = d[v.envPtr];
            // $E8 = SUSTAIN(ticks): belegt an Dragonflight (Spec nennt $E0 SUSTAIN / $E8 LOOP; dort liegt hinter dem
            //       Operanden stets die Abklingrampe, bei Loop-Lesart unerreichbar, und Operanden zeigen hinter das Elementende).
            // $E0 = LOOP(pos), element-relativ: Symmetrie zur Instrument-Tabelle, in keiner Datei belegt (UNVERIFIED).
            if (this.envSpec) {                                                                  // Messhaken: Opcodes wie in der Amberstar-Spec
                if (c === 0xE0) { const n = d[v.envPtr + 1]; v.envWait = n > 0 ? n - 1 : 0; v.envPtr += 2; return; }
                if (c === 0xE8) { v.envPtr = v.envStart + d[v.envPtr + 1]; continue; }
            } else {
                if (c === 0xE8) { const n = d[v.envPtr + 1]; v.envWait = n > 0 ? n - 1 : 0; v.envPtr += 2; return; }
                if (c === 0xE0) { v.envPtr = v.envStart + d[v.envPtr + 1]; continue; }
            }
            if (c >= 0xE1 && c <= 0xE7) { v.envHold = true; return; }                          // HOLD
            v.envVol = c;
            v.envPtr++;
            v.envWait = v.envSpeed - 1;
            return;
        }
        v.envHold = true;
        this.stats.guardHits++;
    }

    // ------------------------------------------------------------------
    // Ausgabe-Register
    // ------------------------------------------------------------------
    writeRegs(v) {
        const r = this.regs;
        const o = v.index * REG.STRIDE;

        let nt = v.instAbs ? v.instPitch : (v.instPitch + v.note + v.transpose);
        nt &= 0x7F;
        let period = (nt < 84) ? COSO_PERIODS[nt] : 0;
        if (period === 0 && v.active) this.stats.silentNotes++;

        if (period !== 0) {
            // Vibrato (symmetrisches Dreieck, +-depth/2; UNVERIFIED im Detail, Amplituden in L1/L2 <= 0.25 %)
            if (v.vibDepth !== 0) {
                if (v.vibDelay > 0) {
                    v.vibDelay--;
                    if (this.vibDelayStatic && this.vibShift > 0) period += this.vibDelta(period, v.vibPos);
                } else {
                    const half = v.vibDepth >> 1;
                    if (this.vibOrder === 1 && this.vibShift > 0) period += this.vibDelta(period, v.vibPos);
                    v.vibPos += v.vibDir * ((v.vibSlope * this.vibSlopeX2) >> 1);
                    if (v.vibPos <= -half) { v.vibPos = -half; v.vibDir = 1; }
                    else if (v.vibPos >= half) { v.vibPos = half; v.vibDir = -1; }
                    if (this.vibOrder === 0 && this.vibShift > 0) period += this.vibDelta(period, v.vibPos);
                }
            }
            // Portamento (linear, nach Vibrato)
            if (v.portActive && (this.portAdd || this.portShift > 0)) {
                if (this.portOrder === 0 && v.portT < 1024) v.portT++;
                period -= this.portAdd ? ((v.portT * v.portSlope * this.portMul) >> this.portShift)
                                       : ((period * v.portT * v.portSlope) >> this.portShift);
                if (this.portOrder === 1 && v.portT < 1024) v.portT++;
                if (period < MIN_PERIOD) period = MIN_PERIOD;
            }
        }

        let vol = (v.envVol * v.chanVol / 100) | 0;
        if (vol > 64) vol = 64;
        if (vol < 0) vol = 0;
        if (!v.active || period === 0 || v.sample < 0) vol = 0;

        r[o + REG.PERIOD] = period;
        r[o + REG.VOLUME] = vol;
        r[o + REG.FLAGS] = v.flags | (v.active ? 2 : 0);
        r[o + REG.SAMPLE] = v.sample;
        if (v.sample >= 0) {
            const s = v.sample;
            r[o + REG.DMA_START] = this.smpStart[s];
            r[o + REG.DMA_LEN] = (this.loopToEnd && this.smpLoopLen[s] > 2)
                ? (this.smpLoopStart[s] + this.smpLoopLen[s] - this.smpStart[s]) : this.smpLen[s];
            if (v.slideActive) {
                r[o + REG.LOOP_START] = this.smpStart[s] + v.slideStart;
                r[o + REG.LOOP_LEN] = v.slideLen;
            } else {
                r[o + REG.LOOP_START] = this.smpLoopStart[s];
                r[o + REG.LOOP_LEN] = this.smpLoopLen[s];
            }
        } else {
            r[o + REG.DMA_START] = 0; r[o + REG.DMA_LEN] = 0;
            r[o + REG.LOOP_START] = 0; r[o + REG.LOOP_LEN] = 0;
        }
    }

    // ------------------------------------------------------------------
    // Ein 50-Hz-Tick
    // ------------------------------------------------------------------
    tick() {
        if (this.finished) {
            for (let i = 0; i < NUM_VOICES; i++) this.regs[i * REG.STRIDE + REG.VOLUME] = 0;
            return;
        }
        for (let i = 0; i < NUM_VOICES; i++) {
            const v = this.voices[i];
            v.flags = 0;
            this.stepPattern(v);
            if (this.finished) break;
            this.stepInstrument(v);
            this.stepEnvelope(v);
            this.writeRegs(v);
        }
        this.tickCount++;
    }
}
