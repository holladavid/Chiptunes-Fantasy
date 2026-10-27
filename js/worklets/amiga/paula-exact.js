// === js/worklets/amiga/paula-exact.js ===
// ==========================================
// MOS TECHNOLOGY PAULA 8364 CHIP EMULATION
// True Hardware DMA Master Edition:
// - Physical Agnus/Paula Audio DMA State Machine
// - Explicit Hardware Registers: AUDxLC, AUDxLEN, AUDxPER, AUDxVOL, AUDxDAT
// - 16-Bit Word-Fetch & 2-Phase High/Low-Byte Demultiplexing
// - Automated Loop-Reload on curLen <= 0
// - 192kHz Oversampling ZOH DAC, lineare A500-Filterapproximation mit
//   passivem 4.421kHz RC Filter und aktivem 3.09kHz Butterworth LED Filter,
//   255-Tap Sinc-FIR Decimator & L-R-R-L Physical Hard-Panning (3.5% Bleed)
// - Native Jochen Hippel (COSO / HIPC) Virtual Machine Integration
// ==========================================

import { CosoVirtualMachine, COSO_TICK_HZ } from '../lib/coso-vm.js';
import { PAL_PAULA_CLOCK } from '../lib/amiga-timing.js';

const XM_REFERENCE_RATE = 8363.0;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

// FT2 rechnet intern mit 64 Periodeneinheiten je Halbton. Note 49 (C-4)
// entspricht der XM-Referenzfrequenz 8363 Hz; Paula gibt pro AUDxPER einen
// Samplebyte aus. Die nichtlineare XM-Tabelle bleibt zur Kompatibilität erhalten.
function xmNoteToPaulaPeriod(note, linearFreq) {
    const clampedNote = clamp(note, 1, 96);
    if (!linearFreq) return Math.round(428.0 * Math.pow(2.0, (49 - clampedNote) / 12.0));
    const linearPeriod = 7744.0 - clampedNote * 64.0;
    const frequency = XM_REFERENCE_RATE * Math.pow(2.0, (4608.0 - linearPeriod) / 768.0);
    return Math.round(PAL_PAULA_CLOCK / frequency);
}

function setTrackerVolume(channel, volume) {
    channel.trackVolume = clamp(volume, 0, 64);
    channel.writeAUDxVOL(channel.trackVolume);
}

function setTrackerPeriod(channel, period, maximum = 65535) {
    channel.basePeriod = clamp(Math.round(period), 113, maximum);
    channel.writeAUDxPER(channel.basePeriod);
}

function setTrackerNote(channel, note, linearFreq) {
    channel.currentNote = clamp(note, 1, 96);
    setTrackerPeriod(channel, xmNoteToPaulaPeriod(channel.currentNote, linearFreq));
}

function slideTrackerVolume(channel, param) {
    const up = (param >> 4) & 0x0F;
    const down = param & 0x0F;
    if (up > 0) setTrackerVolume(channel, channel.trackVolume + up);
    else if (down > 0) setTrackerVolume(channel, channel.trackVolume - down);
}

class StaticRCFilter {
    constructor(sampleRate) {
        this.lastOut = 0;
        this.alpha = Math.exp(-2.0 * Math.PI * 4421.0 / sampleRate);
    }
    process(input) {
        let out = (1.0 - this.alpha) * input + this.alpha * this.lastOut;
        this.lastOut = out;
        return out;
    }

    reset() {
        this.lastOut = 0;
    }
}

class AmigaLEDFilter {
    constructor(sampleRate) {
        const fc = 3090;
        const q = 0.707;
        const w0 = 2 * Math.PI * fc / sampleRate;
        const alpha = Math.sin(w0) / (2 * q);
        const cosw0 = Math.cos(w0);

        const a0 = 1 + alpha;
        this.b0 = ((1 - cosw0) / 2) / a0;
        this.b1 = (1 - cosw0) / a0;
        this.b2 = ((1 - cosw0) / 2) / a0;
        this.a1 = (-2 * cosw0) / a0;
        this.a2 = (1 - alpha) / a0;

        this.x1 = 0; this.x2 = 0;
        this.y1 = 0; this.y2 = 0;
    }
    process(x) {
        let y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
        this.x2 = this.x1; this.x1 = x;
        this.y2 = this.y1; this.y1 = y;
        return y;
    }

    reset() {
        this.x1 = 0; this.x2 = 0;
        this.y1 = 0; this.y2 = 0;
    }
}

// Lineare, nicht als hardwarevermessen ausgegebene A500-Approximation.
// Das LED-Filter läuft auch im Bypass weiter: Beim erneuten Einschalten
// entspricht sein Zustand dadurch einem ununterbrochen aktiven Filter.
class A500ChannelFilter {
    constructor(sampleRate) {
        this.staticFilter = new StaticRCFilter(sampleRate);
        this.ledFilter = new AmigaLEDFilter(sampleRate);
    }

    process(input, ledFilterOn) {
        const fixed = this.staticFilter.process(input);
        const led = this.ledFilter.process(fixed);
        return ledFilterOn ? led : fixed;
    }

    reset() {
        this.staticFilter.reset();
        this.ledFilter.reset();
    }
}

// =========================================================
// ECHTE PAULA 8364 / AGNUS AUDIO DMA STATE MACHINE
// =========================================================
class PaulaChannel {
    constructor(channelId) {
        this.id = channelId;

        // --- PHYSISCHE PAULA-HARDWARE-REGISTER ---
        this.audLc  = 0x00020000; // AUDxLC (Location Pointer im Chip-RAM) ($DFF0A0)
        this.audLen = 16;         // AUDxLEN (Länge in 16-Bit Words) ($DFF0A4)
        this.audPer = 428;        // AUDxPER (Perioden-Zähler / PAL Clock Ticks) ($DFF0A6)
        this.audVol = 0;          // AUDxVOL (6-Bit Volume Multiplier 0..64) ($DFF0A8)
        this.audDat = 0;          // AUDxDAT (16-Bit Audio Data Buffer) ($DFF0AA)

        // --- AGNUS DMA CONTROLLER ZUSTAND ---
        this.dmaEnabled  = false;
        this.dataBuffer  = null;  // Zeiger auf das Chip-RAM Array
        this.curPtr      = 0;     // Aktueller Byte-Offset im Puffer
        this.curLen      = 0;     // Verbleibende Wörter bis zum Loop/Ende
        
        // Agnus Loop-Reload Register
        this.loopPtr     = 0;     // Loop-Neustart Byte-Offset
        this.loopLen     = 0;     // Loop-Länge in Words
        this.isLooping   = false;

        // Takt- und Demultiplexer-Zustand
        this.periodCounter = 428.0; // Zählt PAL-Takte herunter
        this.bytePhase     = 0;     // 0 = High-Byte aktiv, 1 = Low-Byte aktiv
        this.nextWord      = 0;     // Vor-geholtes 16-Bit DMA-Wort
        this.heldValue     = 0;     // 8-Bit DAC Latch (-128..+127)

        // Tracker Kompatibilitäts-Felder
        this.activeSample = 1;
        this.targetPeriod = 0;
        this.basePeriod = 428;
        this.currentNote = 0;
        this.targetNote = 0;
        this.portamentoSpeed = 0;
        this.portamentoUpSpeed = 0;
        this.portamentoDownSpeed = 0;
        this.volSlideSpeed = 0;
        this.sampleOffset = 0;
        this.trackVolume = 0;
        this.pan = -1; // -1 = physisches L-R-R-L; 0..1 = XM-Panning
        this.vibratoSpeed = 0;
        this.vibratoDepth = 0;
        this.vibratoPhase = 0;
        this.hasVibrato = false;
        this.tremoloSpeed = 0;
        this.tremoloDepth = 0;
        this.tremoloPhase = 0;
        this.hasTremolo = false;
        this.lastPlayedSample = 0;
        this.patternLoopRow = 0;
        this.patternLoopCount = 0;

        // Hardware-DMA-Modus (COSO-VM): gemeinsames Chip-RAM + Reload aus AUDxLC/AUDxLEN
        this.hw = false;
        this.chipRam = null;
    }

    // Vollständiger Track-Reset auf denselben Zustand wie ein neu erzeugter Kanal.
    // STOP_TRACK verwendet absichtlich weiterhin disableDMA(), damit Pause/Resume
    // weder Sampleposition noch Effekt- oder Filterhistorie verändert.
    reset() {
        this.audLc = 0x00020000;
        this.audLen = 16;
        this.audPer = 428;
        this.audVol = 0;
        this.audDat = 0;

        this.dmaEnabled = false;
        this.dataBuffer = null;
        this.curPtr = 0;
        this.curLen = 0;
        this.loopPtr = 0;
        this.loopLen = 0;
        this.isLooping = false;

        this.periodCounter = 428.0;
        this.bytePhase = 0;
        this.nextWord = 0;
        this.heldValue = 0;

        this.activeSample = 1;
        this.targetPeriod = 0;
        this.basePeriod = 428;
        this.currentNote = 0;
        this.targetNote = 0;
        this.portamentoSpeed = 0;
        this.portamentoUpSpeed = 0;
        this.portamentoDownSpeed = 0;
        this.volSlideSpeed = 0;
        this.sampleOffset = 0;
        this.trackVolume = 0;
        this.pan = -1; // -1 = physisches L-R-R-L; 0..1 = XM-Panning
        this.vibratoSpeed = 0;
        this.vibratoDepth = 0;
        this.vibratoPhase = 0;
        this.hasVibrato = false;
        this.tremoloSpeed = 0;
        this.tremoloDepth = 0;
        this.tremoloPhase = 0;
        this.hasTremolo = false;
        this.lastPlayedSample = 0;
        this.patternLoopRow = 0;
        this.patternLoopCount = 0;

        this.hw = false;
        this.chipRam = null;
    }

    writeAUDxLC(address, dataBuffer, loopStartWords = 0, loopLengthWords = 0) {
        this.audLc = address & ~1;
        this.dataBuffer = dataBuffer;
        this.loopPtr = (loopStartWords * 2) & ~1;
        this.loopLen = loopLengthWords;
        this.isLooping = loopLengthWords > 1;
    }

    writeAUDxLEN(lengthWords) {
        this.audLen = lengthWords;
    }

    writeAUDxPER(period) {
        this.audPer = Math.max(113, period);
    }

    writeAUDxVOL(volume) {
        this.audVol = Math.max(0, Math.min(64, volume));
    }

    enableDMA(dataBuffer = null, loopStartWords = 0, loopLengthWords = 0, startOffset = 0) {
        this.hw = false;
        this.dmaEnabled = true;
        if (dataBuffer) this.dataBuffer = dataBuffer;

        const requestedOffset = Math.max(0, startOffset) & ~1;
        if (this.dataBuffer && requestedOffset >= this.dataBuffer.length) {
            // Definierte Begrenzung für ungültige Tracker-Offsets: kein Zugriff
            // ausserhalb des Samples und kein abschliessender Datenwort-Klick.
            this.dmaEnabled = false;
            this.curPtr = requestedOffset;
            this.curLen = 0;
            this.audDat = 0;
            this.nextWord = 0;
            this.heldValue = 0;
            return;
        }

        this.curPtr = requestedOffset;
        this.curLen = Math.max(1, this.audLen - (requestedOffset >> 1));
        this.periodCounter = this.audPer;
        this.bytePhase = 0;
        
        if (loopLengthWords > 1) {
            this.loopPtr = (loopStartWords * 2) & ~1;
            this.loopLen = loopLengthWords;
            this.isLooping = true;
        } else {
            this.isLooping = false;
            this.loopLen = 0;
        }

        this.fetchDMAWord();
        // Kein Vorab-Fetch: Die erste Ausgabe (bytePhase 0) lädt nextWord ohnehin nach und würde ein hier
        // geladenes Word 1 überschreiben (ging verloren). Bei einem 1-Word-Sample schaltete der Vorab-Fetch
        // die DMA sogar sofort ab (Sample blieb stumm).
        this.nextWord = 0;

        if (this.dataBuffer && this.dataBuffer.length > 0) {
            this.heldValue = (this.audDat >> 8) & 0xFF;
            if (this.heldValue > 127) this.heldValue -= 256;
        } else {
            this.heldValue = 0;
        }
    }

    disableDMA() {
        this.dmaEnabled = false;
        this.heldValue = 0;
        this.curLen = 0;
    }

    // ---------------------------------------------------------------
    // HARDWARE-DMA-API (v1.5.0, für COSO-VM)
    // Gemeinsames Chip-RAM + echte AUDxLC/AUDxLEN-Latch-Semantik:
    // Schreibzugriffe auf LC/LEN greifen erst beim nächsten Reload (Loop-Wrap),
    // hwStartDMA() lädt LC/LEN sofort in die internen Zähler.
    // Der MOD/XM-Pfad (writeAUDxLC/enableDMA/trigger) bleibt unverändert.
    // ---------------------------------------------------------------
    hwAttach(chipRam) {
        this.chipRam = chipRam;
    }

    hwWriteLC(address) {
        this.audLc = address & ~1;
    }

    hwWriteLEN(words) {
        this.audLen = (words === 0) ? 0x10000 : words;      // Hardware: LEN 0 = 65536 Words
    }

    hwStartDMA() {
        this.hw = true;
        this.dmaEnabled = true;
        this.dataBuffer = this.chipRam;
        this.isLooping = false;
        this.curPtr = this.audLc;
        this.curLen = this.audLen;
        this.periodCounter = this.audPer;
        this.bytePhase = 0;

        this.fetchDMAWord();                                // AUDxDAT = erstes Word
        this.nextWord = 0;                                  // wird erst bei der ersten Ausgabe nachgeladen:
                                                            // ein Vorab-Fetch würde dort überschrieben (Word 1 ginge verloren)
        const hi = (this.audDat >> 8) & 0xFF;
        this.heldValue = hi > 127 ? hi - 256 : hi;
    }

    hwStopDMA() {
        this.dmaEnabled = false;
        this.heldValue = 0;
        this.curLen = 0;
    }

    fetchDMAWord() {
        if (!this.dataBuffer || this.curPtr >= this.dataBuffer.length) {
            this.audDat = 0;
            return;
        }
        const b0 = this.dataBuffer[this.curPtr] & 0xFF;
        const b1 = (this.curPtr + 1 < this.dataBuffer.length) ? (this.dataBuffer[this.curPtr + 1] & 0xFF) : 0;
        this.audDat = (b0 << 8) | b1;
        this.curPtr += 2;
        this.curLen--;
    }

    fetchNextWordBuffer() {
        if (!this.dmaEnabled) {
            this.nextWord = 0;
            return;
        }

        if (this.curLen <= 0) {
            if (this.hw) {
                // Hardware-Reload aus den aktuell gelatchten Registern
                this.curPtr = this.audLc;
                this.curLen = this.audLen;
            } else if (this.isLooping && this.dataBuffer) {
                this.curPtr = this.loopPtr;
                this.curLen = this.loopLen;
            } else {
                this.dmaEnabled = false;
                this.nextWord = 0;
                return;
            }
        }

        if (this.dataBuffer && this.curPtr < this.dataBuffer.length) {
            const b0 = this.dataBuffer[this.curPtr] & 0xFF;
            const b1 = (this.curPtr + 1 < this.dataBuffer.length) ? (this.dataBuffer[this.curPtr + 1] & 0xFF) : 0;
            this.nextWord = (b0 << 8) | b1;
            this.curPtr += 2;
            this.curLen--;
        } else {
            this.nextWord = 0;
        }
    }

    trigger(data, loopStart, loopLen, audLc = 0x00020000, audLenWords = 0, startOffset = 0) {
        this.audLc = audLc & ~1;
        this.audLen = audLenWords > 0 ? audLenWords : Math.floor(data.length / 2);
        this.enableDMA(data, Math.floor(loopStart / 2), Math.floor(loopLen / 2), startOffset);
    }

    step(clockTicks) {
        // AUDxVOL wirkt ausschließlich auf den DAC-Multiplikator. Auch ein
        // stummgeschalteter Kanal führt DMA, Periodenzähler und Loop-Reloads fort.
        if (!this.dmaEnabled || this.audPer === 0) return 0;

        this.periodCounter -= clockTicks;

        while (this.periodCounter <= 0) {
            this.periodCounter += this.audPer;

            if (this.bytePhase === 0) {
                this.bytePhase = 1;
                let rawLow = this.audDat & 0xFF;
                this.heldValue = rawLow > 127 ? rawLow - 256 : rawLow;
                this.fetchNextWordBuffer();
            } else {
                this.bytePhase = 0;
                this.audDat = this.nextWord;
                let rawHigh = (this.audDat >> 8) & 0xFF;
                this.heldValue = rawHigh > 127 ? rawHigh - 256 : rawHigh;
            }
        }

        return (this.heldValue * this.audVol) / 8128.0;
    }
}

class PaulaProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.clock = 3546895; // PAL Master Clock (Hz)
        
        this.OVERSAMPLING = 4;
        this.internalRate = sampleRate * this.OVERSAMPLING; // 192 kHz
        
        this.channels = [];
        for (let i = 0; i < 64; i++) {
            this.channels.push(new PaulaChannel(i));
        }
        
        this.samples = {}; 
        this.isPlaying = false;
        this.visualView = new Float32Array(40);
        // Optionaler, standardmäßig inaktiver Messabgriff für den Offline-Harness.
        // Stufen: 0 = Paula-Summe, 1 = ZOH/vor Analog, 2 = A500-Ausgang.
        this.diagnosticTap = null;

        this.isSequenced = false;
        this.seqType = 'MOD';
        this.linearFreq = false;
        
        this.songLength = 0;
        this.orderTable = null;
        this.patterns = null;
        this.bpm = 125;
        this.speed = 6;
        this.globalVolume = 64;
        this.numChannels = 4; 
        
        this.currentOrder = 0;
        this.currentRow = 0;
        this.currentTick = 0;
        this.samplesUntilNextTick = 0;
        this.sampleCounter = 0;
        
        this.patternDelay = 0;
        this.breakPending = false;
        this.breakOrder = 0;
        this.breakRow = 0;

        this.cosoVM = null;

        // Lineare A500-Filterapproximation (192 kHz Domain)
        this.a500L = new A500ChannelFilter(this.internalRate);
        this.a500R = new A500ChannelFilter(this.internalRate);
        
        this.trackLedFilterOn = true;
        this.ledFilterOn = true; 
        this.filterModeState = 0; 
        
        // 255-Tap Sinc-FIR Decimator
        this.FIR_TAPS = 255;
        this.firKernel = new Float32Array(this.FIR_TAPS);
        this.ringBufferL = new Float32Array(512); 
        this.ringBufferR = new Float32Array(512); 
        this.ringIndex = 0;
        
        let fc = 22000.0 / this.internalRate; 
        let sum = 0;
        for (let i = 0; i < this.FIR_TAPS; i++) {
            let x = i - (this.FIR_TAPS - 1) / 2;
            let sinc = (x === 0) ? (2 * Math.PI * fc) : Math.sin(2 * Math.PI * fc * x) / x;
            let window = 0.42 - 0.5 * Math.cos(2 * Math.PI * i / (this.FIR_TAPS - 1)) + 0.08 * Math.cos(4 * Math.PI * i / (this.FIR_TAPS - 1));
            this.firKernel[i] = sinc * window;
            sum += this.firKernel[i];
        }
        for (let i = 0; i < this.FIR_TAPS; i++) this.firKernel[i] /= sum; 

        this.port.onmessage = (e) => {
            const msg = e.data;
            if (msg.type === 'UPLOAD_SAMPLE') {
                if (msg.data && msg.data.data instanceof Int8Array) {
                    this.samples[msg.name] = msg.data;
                }
            } else if (msg.type === 'PLAY_TRACK') {
                const isHipc = msg.track && (msg.track.type === 'HIPC' || msg.track.type === 'COSO');
                this.linearFreq = msg.track ? (msg.track.linearFreq || false) : false;
                
                this.filterModeState = isHipc ? 2 : 0;
                this.trackLedFilterOn = !isHipc; 
                this.ledFilterOn = !isHipc;      

                // Ein neuer Titel beginnt mit demselben digitalen und analogen
                // Zustand wie ein frisch instanziiertes Worklet. Koeffizienten,
                // Filtermodus und die eigentliche DSP-Kette bleiben unverändert.
                this.isPlaying = false;
                this.a500L.reset();
                this.a500R.reset();
                this.ringBufferL.fill(0);
                this.ringBufferR.fill(0);
                this.ringIndex = 0;

                this.visualView.fill(0);
                this.visCounter = 0;
                this.wasAudible = false;
                this.isSequenced = false;
                this.seqType = 'MOD';
                this.songLength = 0;
                this.orderTable = null;
                this.patterns = null;
                this.bpm = 125;
                this.speed = 6;
                this.globalVolume = 64;
                this.numChannels = 4;
                this.currentOrder = 0;
                this.currentRow = 0;
                this.currentTick = 0;
                this.samplesUntilNextTick = 0;
                this.sampleCounter = 0;
                this.patternDelay = 0;
                this.breakPending = false;
                this.breakOrder = 0;
                this.breakRow = 0;
                this.cosoVM = null;
                this.trackData = null;
                this.currentFrame = 0;

                for (let i = 0; i < 64; i++) this.channels[i].reset();

                if (msg.track && msg.track.isSequenced) {
                    this.isSequenced = true;
                    this.seqType = msg.track.type;

                    if (this.seqType === 'HIPC' || this.seqType === 'COSO') {
                        this.cosoVM = new CosoVirtualMachine(
                            msg.track,
                            msg.track.samples || this.samples,
                            (logMsg) => this.port.postMessage({ type: 'LAB_LOG', msg: logMsg }),
                            { rasterTiming: true }
                        );
                        this.sampleCounter = 0;
                        this.numChannels = 4;
                        this.isPlaying = true;
                    } else {
                        this.cosoVM = null;
                        this.songLength = msg.track.songLength;
                        this.orderTable = msg.track.orderTable;
                        this.patterns = msg.track.patterns;
                        this.bpm = msg.track.bpm || 125;
                        this.speed = msg.track.speed || 6;
                        this.numChannels = msg.track.numChannels || 4;

                        this.currentOrder = 0;
                        this.currentRow = 0;
                        this.currentTick = 0;
                        this.samplesUntilNextTick = 0;
                        this.patternDelay = 0;
                        this.breakPending = false;
                        this.isPlaying = true;
                    }
                } else {
                    this.isSequenced = false;
                    this.cosoVM = null;
                    this.trackData = msg.track;
                    this.numChannels = 4; 
                    this.currentFrame = 0;
                    this.sampleCounter = 0;
                    this.isPlaying = true;
                }

            } else if (msg.type === 'STOP_TRACK') {
                this.isPlaying = false;
                for (let i = 0; i < 64; i++) {
                    this.channels[i].disableDMA();
                    this.channels[i].writeAUDxVOL(0);
                }
            } else if (msg.type === 'RESUME_TRACK') {
                this.isPlaying = true;
            } else if (msg.type === 'SEEK_TRACK') {
                if (this.isSequenced) {
                    if (this.seqType === 'HIPC' || this.seqType === 'COSO') {
                        this.sampleCounter = 0;
                        // Echtes Spulen auf den Ziel-Tick (statt immer zum Songanfang zu springen)
                        if (this.cosoVM) this.cosoVM.seekToTick(msg.frame);
                    } else {
                        const ticksPerOrder = 64 * this.speed;
                        const targetOrder = Math.floor(msg.frame / ticksPerOrder);
                        const remainingTicks = msg.frame % ticksPerOrder;
                        
                        this.currentOrder = targetOrder % this.songLength;
                        this.currentRow = Math.floor(remainingTicks / this.speed) % 64;
                        this.currentTick = remainingTicks % this.speed;
                        this.patternDelay = 0;
                        this.breakPending = false;
                    }
                } else {
                    if (this.trackData) this.currentFrame = msg.frame % this.trackData.length;
                }
            } else if (msg.type === 'CYCLE_FILTER') {
                this.filterModeState = (this.filterModeState + 1) % 3;
                if (this.filterModeState === 0) this.ledFilterOn = this.trackLedFilterOn; 
                else if (this.filterModeState === 1) this.ledFilterOn = true; 
                else if (this.filterModeState === 2) this.ledFilterOn = false; 
            }
        };
    }

    processTrackerTick(overshoot) {
        if (this.currentOrder >= this.songLength) {
            this.currentOrder = 0;
        }

        const patternIdx = this.orderTable[this.currentOrder];
        const patternObj = this.patterns[patternIdx];
        if (!patternObj) return;

        const pattern = patternObj.data;
        const numRows = patternObj.numRows;
        const rowOffset = this.currentRow * this.numChannels * 6;
        const linearXM = this.seqType === 'XM' && this.linearFreq;

        for (let ch = 0; ch < this.numChannels; ch++) {
            const cellOffset = rowOffset + (ch * 6);
            const period = pattern[cellOffset] | (pattern[cellOffset + 1] << 8);
            const sample = pattern[cellOffset + 2];
            const volume = pattern[cellOffset + 3];
            const effect = pattern[cellOffset + 4];
            const param = pattern[cellOffset + 5];
            const channel = this.channels[ch];

            if (sample > 0) channel.activeSample = sample;

            const activeSample = channel.activeSample || 1;
            const smpPrefix = this.seqType.toLowerCase();
            let currentSmpObj = this.samples[`${smpPrefix}_sample_${activeSample}`];
            if (!currentSmpObj) {
                currentSmpObj = this.samples[`mod_sample_${activeSample}`] ||
                                this.samples[`xm_sample_${activeSample}`] ||
                                this.samples[`hipc_sample_${activeSample}`] ||
                                this.samples[`dw_sample_${activeSample}`];
            }

            const isSampleChange = (sample > 0 && sample !== channel.lastPlayedSample);
            const isPortamento = (effect === 0x03 || effect === 0x05) && (channel.dataBuffer !== null) &&
                                 (this.seqType === 'XM' ? true : !isSampleChange);

            if (this.currentTick === 0) {
                const hasNote = (period > 0 && period !== 97);

                // Tremolo ist eine momentane Modulation. Die logische Kanal-
                // lautstärke bleibt für Folgezeilen und Volume-Slides erhalten.
                channel.writeAUDxVOL(channel.trackVolume);
                if (period === 97) setTrackerVolume(channel, 0);

                if (effect === 0x09 && param > 0) channel.sampleOffset = param * 256;

                if (hasNote) {
                    let calculatedPeriod = period;
                    let actualNote = 0;

                    if (this.seqType === 'XM') {
                        const relNote = currentSmpObj ? (currentSmpObj.relNote || 0) : 0;
                        const finetune = currentSmpObj ? (currentSmpObj.finetune || 0) : 0;
                        actualNote = clamp(period + relNote + (finetune / 128.0), 1, 96);
                        calculatedPeriod = xmNoteToPaulaPeriod(actualNote, this.linearFreq);
                    }

                    if (isPortamento) {
                        channel.targetPeriod = calculatedPeriod;
                        channel.targetNote = actualNote;
                    } else {
                        if (this.seqType === 'XM') setTrackerNote(channel, actualNote, this.linearFreq);
                        else setTrackerPeriod(channel, calculatedPeriod, 856);
                        channel.targetPeriod = 0;
                        channel.targetNote = 0;
                        channel.vibratoPhase = 0;
                        channel.tremoloPhase = 0;
                    }
                }

                if (hasNote && currentSmpObj && currentSmpObj.data) {
                    if (!isPortamento) {
                        channel.trigger(
                            currentSmpObj.data,
                            currentSmpObj.loopStart,
                            currentSmpObj.loopLen,
                            0x00020000,
                            0,
                            effect === 0x09 ? channel.sampleOffset : 0
                        );
                    }
                    if (sample > 0) channel.lastPlayedSample = sample;
                }

                if (sample > 0 && currentSmpObj) {
                    setTrackerVolume(channel, currentSmpObj.baseVolume);
                    if (this.seqType === 'XM' && currentSmpObj.pan !== undefined) {
                        channel.pan = clamp(currentSmpObj.pan / 255.0, 0, 1);
                    }
                }

                if (volume !== 0xFF) {
                    if (this.seqType === 'XM' && volume >= 0xC0 && volume <= 0xCF) {
                        channel.pan = (volume - 0xC0) / 15.0;
                    } else if (volume <= 64) {
                        setTrackerVolume(channel, volume);
                    }
                }

                if (effect !== 0x04 && effect !== 0x06) channel.hasVibrato = false;
                if (effect !== 0x07) channel.hasTremolo = false;

                switch (effect) {
                    case 0x01: if (param > 0) channel.portamentoUpSpeed = param; break;
                    case 0x02: if (param > 0) channel.portamentoDownSpeed = param; break;
                    case 0x03: if (param > 0) channel.portamentoSpeed = param; break;
                    case 0x04:
                        if ((param >> 4) > 0) channel.vibratoSpeed = (param >> 4) & 0x0F;
                        if ((param & 0x0F) > 0) channel.vibratoDepth = param & 0x0F;
                        channel.hasVibrato = true;
                        break;
                    case 0x05:
                    case 0x0A:
                        if (param > 0) channel.volSlideSpeed = param;
                        break;
                    case 0x06:
                        if (param > 0) channel.volSlideSpeed = param;
                        channel.hasVibrato = true;
                        break;
                    case 0x07:
                        if ((param >> 4) > 0) channel.tremoloSpeed = (param >> 4) & 0x0F;
                        if ((param & 0x0F) > 0) channel.tremoloDepth = param & 0x0F;
                        channel.hasTremolo = true;
                        break;
                    case 0x08:
                        if (this.seqType === 'XM') channel.pan = param / 255.0;
                        break;
                    case 0x0C:
                        setTrackerVolume(channel, param);
                        break;
                    case 0x0F:
                        if (param > 0) {
                            if (param < 32) this.speed = param;
                            else this.bpm = param;
                        }
                        break;
                    case 0x10:
                        if (this.seqType === 'XM') this.globalVolume = clamp(param, 0, 64);
                        break;
                    case 0x0B:
                        this.breakOrder = param;
                        this.breakRow = 0;
                        this.breakPending = true;
                        break;
                    case 0x0D:
                        this.breakOrder = this.currentOrder + 1;
                        this.breakRow = ((param >> 4) * 10) + (param & 0x0F);
                        this.breakPending = true;
                        break;
                    case 0x0E: {
                        const subEffect = param >> 4;
                        const subParam = param & 0x0F;
                        if (subEffect === 0x00) {
                            this.trackLedFilterOn = (subParam === 0);
                            if (this.filterModeState === 0) this.ledFilterOn = (subParam === 0);
                        } else if (subEffect === 0x0A) {
                            setTrackerVolume(channel, channel.trackVolume + subParam);
                        } else if (subEffect === 0x0B) {
                            setTrackerVolume(channel, channel.trackVolume - subParam);
                        } else if (subEffect === 0x01) {
                            if (linearXM) setTrackerNote(channel, channel.currentNote + subParam / 16.0, true);
                            else setTrackerPeriod(channel, channel.basePeriod - subParam, 856);
                        } else if (subEffect === 0x02) {
                            if (linearXM) setTrackerNote(channel, channel.currentNote - subParam / 16.0, true);
                            else setTrackerPeriod(channel, channel.basePeriod + subParam, 856);
                        } else if (subEffect === 0x08 && this.seqType === 'XM') {
                            channel.pan = subParam / 15.0;
                        } else if (subEffect === 0x0E) {
                            this.patternDelay = subParam;
                        }
                        break;
                    }
                }
            } else {
                switch (effect) {
                    case 0x00:
                        if (param > 0 && channel.basePeriod > 0) {
                            const arpTick = this.currentTick % 3;
                            const offset = arpTick === 1 ? ((param >> 4) & 0x0F) :
                                           arpTick === 2 ? (param & 0x0F) : 0;
                            if (linearXM) {
                                channel.writeAUDxPER(xmNoteToPaulaPeriod(channel.currentNote + offset, true));
                            } else {
                                channel.writeAUDxPER(clamp(Math.round(
                                    channel.basePeriod * Math.pow(2.0, -offset / 12.0)
                                ), 113, 856));
                            }
                        }
                        break;
                    case 0x01:
                        if (linearXM) setTrackerNote(channel, channel.currentNote + channel.portamentoUpSpeed / 16.0, true);
                        else setTrackerPeriod(channel, channel.basePeriod - channel.portamentoUpSpeed, 856);
                        break;
                    case 0x02:
                        if (linearXM) setTrackerNote(channel, channel.currentNote - channel.portamentoDownSpeed / 16.0, true);
                        else setTrackerPeriod(channel, channel.basePeriod + channel.portamentoDownSpeed, 856);
                        break;
                    case 0x03:
                    case 0x05:
                        if (linearXM) {
                            if (channel.targetNote > 0 && channel.currentNote !== channel.targetNote) {
                                const slide = channel.portamentoSpeed / 16.0;
                                const nextNote = channel.currentNote < channel.targetNote
                                    ? Math.min(channel.targetNote, channel.currentNote + slide)
                                    : Math.max(channel.targetNote, channel.currentNote - slide);
                                setTrackerNote(channel, nextNote, true);
                            }
                        } else if (channel.targetPeriod > 0 && channel.basePeriod !== channel.targetPeriod) {
                            const nextPeriod = channel.basePeriod < channel.targetPeriod
                                ? Math.min(channel.targetPeriod, channel.basePeriod + channel.portamentoSpeed)
                                : Math.max(channel.targetPeriod, channel.basePeriod - channel.portamentoSpeed);
                            setTrackerPeriod(channel, nextPeriod, 856);
                        }
                        if (effect === 0x05) slideTrackerVolume(channel, channel.volSlideSpeed);
                        break;
                    case 0x04:
                    case 0x06:
                        if (channel.hasVibrato) {
                            channel.vibratoPhase = (channel.vibratoPhase + channel.vibratoSpeed) & 63;
                            const sine = Math.sin(channel.vibratoPhase * (Math.PI / 32));
                            if (linearXM) {
                                channel.writeAUDxPER(xmNoteToPaulaPeriod(
                                    channel.currentNote + sine * channel.vibratoDepth / 32.0, true
                                ));
                            } else {
                                channel.writeAUDxPER(clamp(Math.round(
                                    channel.basePeriod + sine * channel.vibratoDepth * 2.0
                                ), 113, 856));
                            }
                        }
                        if (effect === 0x06) slideTrackerVolume(channel, channel.volSlideSpeed);
                        break;
                    case 0x07:
                        if (channel.hasTremolo) {
                            channel.tremoloPhase = (channel.tremoloPhase + channel.tremoloSpeed) & 63;
                            const sine = Math.sin(channel.tremoloPhase * (Math.PI / 32));
                            channel.writeAUDxVOL(Math.round(
                                channel.trackVolume + sine * channel.tremoloDepth * 4.0
                            ));
                        }
                        break;
                    case 0x0A:
                        slideTrackerVolume(channel, channel.volSlideSpeed);
                        break;
                }
            }
        }

        this.currentTick++;
        if (this.currentTick >= this.speed * (this.patternDelay + 1)) {
            this.currentTick = 0;
            this.patternDelay = 0;
            if (this.breakPending) {
                this.currentOrder = this.breakOrder;
                this.currentRow = this.breakRow;
                this.breakPending = false;
            } else {
                this.currentRow++;
                if (this.currentRow >= numRows) {
                    this.currentRow = 0;
                    this.currentOrder++;
                }
            }
        }
    }

    process(inputs, outputs) {
        const outL = outputs[0][0]; 
        const outR = outputs[0].length > 1 ? outputs[0][1] : null; 
        let oscValue = 0;

        let clockTicksPerSample = this.clock / this.internalRate;
        const CROSSTALK_BLEED = 0.035;

        for (let i = 0; i < outL.length; i++) {
            if (!this.isPlaying) {
                outL[i] = 0; if (outR) outR[i] = 0;
                continue; 
            }
            
            if (this.isSequenced) {
                if (this.seqType === 'HIPC' || this.seqType === 'COSO') {
                    this.sampleCounter--;
                    if (this.sampleCounter <= 0) {
                        this.sampleCounter += sampleRate / COSO_TICK_HZ;
                        if (this.cosoVM) {
                            this.cosoVM.processTick(this.channels);
                        }
                    }
                } else {
                    this.samplesUntilNextTick--;
                    if (this.samplesUntilNextTick <= 0) {
                        const overshoot = -this.samplesUntilNextTick; 
                        this.processTrackerTick(overshoot);
                        const samplesPerTick = (2.5 / this.bpm) * sampleRate;
                        this.samplesUntilNextTick += samplesPerTick;
                    }
                }
            }

            // 192 kHz Oversampling Loop
            for (let os = 0; os < this.OVERSAMPLING; os++) {
                // Nur HIP68K besitzt eine Rasterwarteschlange; COSO benötigt
                // keine zusätzlichen Schreibzugriffe zwischen den Replay-Ticks.
                if (this.cosoVM && typeof this.cosoVM.advance === 'function') {
                    this.cosoVM.advance(clockTicksPerSample);
                }
                let rawL = 0;
                let rawR = 0;
                
                for (let c = 0; c < this.numChannels; c++) {
                    const channel = this.channels[c];
                    let smp = channel.step(clockTicksPerSample);
                    if (smp !== 0) {
                        if (channel.pan >= 0) {
                            // XM-Panning ist Tracker-Steuerung, kein Eingriff in
                            // die nachfolgende A500-Crosstalk-/Analogstufe.
                            rawL += smp * (1.0 - channel.pan) * 2.0;
                            rawR += smp * channel.pan * 2.0;
                        } else {
                            let panMod = c % 4;
                            if (panMod === 0 || panMod === 3) rawL += smp;
                            else rawR += smp;
                        }
                    }
                }

                if (this.numChannels > 4) {
                    let mixAtten = Math.sqrt(4.0 / this.numChannels);
                    rawL *= mixAtten;
                    rawR *= mixAtten;
                }
                if ((this.seqType === 'MOD' || this.seqType === 'XM') && this.globalVolume !== 64) {
                    const globalGain = this.globalVolume / 64.0;
                    rawL *= globalGain;
                    rawR *= globalGain;
                }
                if (this.diagnosticTap) this.diagnosticTap(0, rawL, rawR);
                
                let bleedL = rawL * (1.0 - CROSSTALK_BLEED) + rawR * CROSSTALK_BLEED;
                let bleedR = rawR * (1.0 - CROSSTALK_BLEED) + rawL * CROSSTALK_BLEED;
                if (this.diagnosticTap) this.diagnosticTap(1, bleedL, bleedR);

                const filteredL = this.a500L.process(bleedL, this.ledFilterOn);
                const filteredR = this.a500R.process(bleedR, this.ledFilterOn);

                this.ringBufferL[this.ringIndex] = filteredL;
                this.ringBufferR[this.ringIndex] = filteredR;
                this.ringIndex = (this.ringIndex + 1) & 511;
            }

            let decL = 0;
            let decR = 0;
            let firIdx = (this.ringIndex - 1) & 511;
            
            for (let k = 0; k < this.FIR_TAPS; k++) {
                decL += this.ringBufferL[firIdx] * this.firKernel[k];
                decR += this.ringBufferR[firIdx] * this.firKernel[k];
                firIdx = (firIdx - 1) & 511;
            }

            outL[i] = decL * 0.7;
            if (outR) outR[i] = decR * 0.7; 
            else outL[i] += decR * 0.7;
            if (this.diagnosticTap) this.diagnosticTap(2, outL[i], outR ? outR[i] : outL[i]); 
            
            if (i === 0) oscValue = (decL + decR) / 2.0;
        }

        this.visCounter = (this.visCounter || 0) + 1;
        if (this.visCounter % 4 === 0) {
            let isAudible = Math.abs(oscValue) > 0.001;
            if (isAudible || this.wasAudible) {
                const view = this.visualView;
                view[0] = 1; // Amiga
                view[1] = this.isPlaying ? 1 : 0;
                
                let currentFrameVal = 0;
                if (this.isSequenced) {
                    if (this.seqType === 'HIPC' || this.seqType === 'COSO') {
                        currentFrameVal = this.cosoVM ? this.cosoVM.position : 0;      // Ticks im aktuellen Durchlauf (springt beim Loop auf 1)
                    } else {
                        currentFrameVal = (this.currentOrder * 64 * this.speed + this.currentRow * this.speed + this.currentTick);
                    }
                } else {
                    currentFrameVal = this.currentFrame;
                }
                view[2] = currentFrameVal;
                view[3] = oscValue;

                for(let c = 0; c < 4; c++) {
                    let offset = c * 7;
                    let ch = this.channels[c];
                    
                    let lc = ch.audLc || 0;
                    view[4 + offset] = (lc >> 8) & 0xFF; 
                    view[4 + offset + 1] = lc & 0xFF;       
                    
                    let len = ch.audLen || 0;
                    view[4 + offset + 2] = (len >> 8) & 0xFF;
                    view[4 + offset + 3] = len & 0xFF;
                    
                    view[4 + offset + 4] = (ch.audPer >> 8) & 0xFF;
                    view[4 + offset + 5] = ch.audPer & 0xFF;
                    
                    view[4 + offset + 6] = ch.audVol & 0xFF;
                }

                view[33] = this.ledFilterOn ? 1.0 : 0.0;

                let dmaMask = 0;
                for (let c = 0; c < 4; c++) {
                    let ch = this.channels[c];
                    view[34 + c] = ch.dmaEnabled ? (ch.audVol / 64.0) : 0.0;
                    if (ch.dmaEnabled) dmaMask |= 1 << c;
                }

                view[38] = this.filterModeState;
                view[39] = dmaMask;

                this.port.postMessage(view);
            }
            this.wasAudible = isAudible;
        }
        return true;
    }
}

registerProcessor('paula-exact-processor', PaulaProcessor);