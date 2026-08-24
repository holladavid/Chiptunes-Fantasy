// === js/worklets/lib/coso-vm.js ===
// =========================================================
// JOCHEN HIPPEL (MAD MAX) COSO VIRTUAL MACHINE
// Production Master Edition — Native Paula Register Pipeline:
// - COSO VM -> writeAUDxLC, writeAUDxLEN, writeAUDxPER, writeAUDxVOL
// - Full Support for $E1, $E2, $E3, $E4, $E5/$E7, $E6, $E8, $E0
// - Unified Descriptor Lookup for $E1, $E5 and $E7
// - Direct Single-Pass DMA Activation for PCM Digidrums
// =========================================================

const PERIOD_TABLE = [
    0,
    856, 808, 762, 720, 678, 640, 604, 570, 538, 508, 480, 453, // Oktave 1 (1..12)
    428, 404, 381, 360, 339, 320, 302, 285, 269, 254, 240, 226, // Oktave 2 (13..24)
    214, 202, 190, 180, 170, 160, 151, 143, 135, 127, 120, 113, // Oktave 3 (25..36)
    107, 101,  95,  90,  85,  80,  75,  71,  67,  63,  60,  56, // Oktave 4 (37..48)
     53,  50,  47,  45,  42,  40,  37,  35,  33,  31,  30,  28  // Oktave 5 (49..60)
];

export function decodeTransposeByte(b1) {
    let transp = (b1 > 127) ? (b1 - 256) : b1;
    if (transp < -36 || transp > 36) {
        transp = Math.max(-36, Math.min(36, transp));
    }
    return transp;
}

export class CosoVirtualMachine {
    constructor(trackModule, samplesDict, traceCallback = null) {
        if (!trackModule || !trackModule.header) {
            throw new Error(`[COSO-VM CRITICAL] Ungültiges Modul übergeben: Header-Objekt fehlt.`);
        }

        this.data = trackModule.rawData || trackModule.blocks.tracks;
        this.fullData = trackModule.fullData || this.data;
        this.patternPointers = trackModule.patternPointers;
        this.macroPointers = trackModule.macroPointers;
        this.macroTableOffset = trackModule.header.macroTableOffset;
        this.patTableOffset = trackModule.header.patTableOffset;
        this.sampleDataOffset = trackModule.header.sampleDataOffset;
        this.actualWaveOffset = trackModule.header.actualWaveOffset || this.sampleDataOffset;
        this.sampleDescriptors = trackModule.sampleDescriptors || [];
        this.voiceTrackPointers = trackModule.voiceTrackPointers;
        this.samples = trackModule.samples || samplesDict || {};
        this.traceCallback = traceCallback;

        if (!this.voiceTrackPointers || this.voiceTrackPointers.length < 4) {
            throw new Error(`[COSO-VM CRITICAL] Unvollständige voiceTrackPointers vom Parser erhalten: ${JSON.stringify(this.voiceTrackPointers)}`);
        }

        this.tickCounter = 0;
        this.traceLogCount = 0;
        this.maxTraceLogs = 60;

        this.voices = [];
        for (let v = 0; v < 4; v++) {
            const rawStartPtr = this.voiceTrackPointers[v];
            const startPtr = (typeof rawStartPtr === 'number' && rawStartPtr >= 0x0020 && rawStartPtr < this.fullData.length)
                ? (rawStartPtr & ~1)
                : 0x0060;

            this.voices.push({
                voiceId: v,
                trackPtr: startPtr,
                startTrackPtr: startPtr,
                trackStack: [],
                patternPtr: -1,
                patternHeaderPending: false,
                patternDelay: null,
                transpose: 0,
                currentMacro: 0,
                wait: 0,
                stopped: false,

                macroPtr: -1,
                macroStartPtr: -1,
                macroActive: false,
                macroWait: 0,
                dmaTriggered: false,

                audLc: this.actualWaveOffset,
                audLen: 16,
                basePer: 428,
                audPer: 428,
                audVol: 64,
                sampleKey: 'hipc_sample_0'
            });
        }

        if (this.traceCallback) {
            this.traceCallback(`--- [COSO-VM INITIALIZED] True Hardware Paula-DMA Pipeline Active ---`);
        }
    }

    logTrace(msg) {
        if (this.traceCallback && this.traceLogCount < this.maxTraceLogs) {
            this.traceLogCount++;
            this.traceCallback(msg);
        }
    }

    // =========================================================
    // 1. SOUND-MACRO-ENGINE (SCHREIBT DIREKT IN PAULA-REGISTER)
    // =========================================================
    startMacro(voice, macroId, channel) {
        let macroOffset = -1;
        
        if (this.macroPointers && macroId < this.macroPointers.length && this.macroPointers[macroId] > 0) {
            macroOffset = this.macroPointers[macroId];
        } else if (this.macroTableOffset) {
            macroOffset = this.macroTableOffset + (macroId * 32);
        }

        if (macroOffset > 0 && macroOffset < this.fullData.length - 2) {
            voice.macroPtr = macroOffset;
            voice.macroStartPtr = macroOffset;
            voice.macroActive = true;
            voice.macroWait = 0;
            this.decodeMacroFrame(voice, channel, true);
        }
    }

    decodeMacroFrame(voice, channel, isFrame0 = false) {
        if (!voice.macroActive || voice.macroPtr <= 0 || voice.macroPtr >= this.fullData.length - 1) return;

        let macroSafety = 16;
        while (macroSafety > 0 && voice.macroActive) {
            macroSafety--;
            const op = this.fullData[voice.macroPtr++];
            const param = this.fullData[voice.macroPtr++];

            // $E0: End of Macro (Sustain/Hold)
            if (op === 0xE0) {
                voice.macroActive = false;
                break;
            }
            // $E1, $E5, $E7: Set Waveform or PCM Sample -> SCHREIBT AUDxLC / AUDxLEN / ENABLE DMA
            // Wir bündeln diese Opcodes, da Hippel in COSO alle Deskriptoren ins gleiche 16-Byte Array pfercht.
            else if (op === 0xE1 || op === 0xE5 || op === 0xE7) {
                const sampleIdx = param;
                
                // Wir schauen im pre-parsed Deskriptor-Array nach
                const desc = this.sampleDescriptors[sampleIdx] || this.sampleDescriptors[sampleIdx + 1];

                const smp = (desc && desc.data) ? desc : (
                    this.samples[`hipc_pcm_${sampleIdx}`] || 
                    this.samples[`hipc_pcm_${sampleIdx + 1}`] || 
                    this.samples[`hipc_sample_${sampleIdx}`] ||
                    this.samples[`hipc_sample_${sampleIdx + 1}`] ||
                    this.samples['hipc_sample_0']
                );

                if (desc) {
                    voice.audLc = desc.absStart;
                    voice.audLen = desc.sampleLengthWords;
                }

                if (smp && smp.data && channel) {
                    // Loop-Marker ermitteln (in 16-Bit Words)
                    const loopStartWords = desc ? desc.loopStartWords : (smp.loopStart ? Math.floor(smp.loopStart / 2) : 0);
                    const loopLenWords = desc ? desc.loopLengthWords : (smp.loopLen ? Math.floor(smp.loopLen / 2) : 0);
                    const vol = (desc && desc.baseVolume !== undefined) ? desc.baseVolume : (smp.baseVolume || voice.audVol);

                    channel.writeAUDxLC(voice.audLc, smp.data, loopStartWords, loopLenWords);
                    channel.writeAUDxLEN(desc ? desc.sampleLengthWords : Math.floor(smp.data.length / 2));
                    channel.writeAUDxPER(voice.audPer);
                    channel.writeAUDxVOL(vol);
                    channel.enableDMA(smp.data, loopStartWords, loopLenWords); // Feuert das Sample ab!
                    
                    voice.audVol = vol;
                    voice.dmaTriggered = true;
                }
            }
            // $E2: Set Volume -> SCHREIBT AUDxVOL
            else if (op === 0xE2) {
                voice.audVol = param > 64 ? 64 : param;
                if (channel) channel.writeAUDxVOL(voice.audVol);
            }
            // $E3: Volume Slide
            else if (op === 0xE3) {
                const sDelta = (param > 127) ? (param - 256) : param;
                voice.audVol = Math.max(0, Math.min(64, voice.audVol + sDelta));
                if (channel) channel.writeAUDxVOL(voice.audVol);
                if (!isFrame0) break;
            }
            // $E4: Portamento / Pitch Slide -> SCHREIBT AUDxPER
            else if (op === 0xE4) {
                let sPDelta = (param > 127) ? (param - 256) : param;
                
                // Portamento-Oktav-Skalierung bei hoher Transposition
                if (voice.transpose > 12) {
                    sPDelta = Math.round(sPDelta / 2.0);
                } else if (voice.transpose > 24) {
                    sPDelta = Math.round(sPDelta / 4.0);
                }

                voice.audPer = Math.max(113, voice.audPer + sPDelta);
                if (channel) channel.writeAUDxPER(voice.audPer);
                if (!isFrame0) break;
            }
            // $E6: NOP / Wait 1 Frame
            else if (op === 0xE6) {
                break;
            }
            // $E8: Macro Loop
            else if (op === 0xE8) {
                const targetStep = param;
                voice.macroPtr = voice.macroStartPtr + (targetStep * 2);
            }
            else {
                break;
            }
        }
    }

    // =========================================================
    // 2. PATTERN ENGINE
    // =========================================================
    decodePatternStream(voice, channel, currentTick) {
        if (voice.patternPtr >= this.fullData.length) {
            voice.patternPtr = -1;
            voice.patternHeaderPending = false;
            return false;
        }

        const patPC = voice.patternPtr;
        const b0 = this.fullData[voice.patternPtr++];

        // Pattern Header
        if (voice.patternHeaderPending) {
            voice.patternHeaderPending = false;

            if (b0 === 0x08 && voice.patternPtr < this.fullData.length - 2) {
                const nextDelay = this.fullData[voice.patternPtr++];
                const nextSound = this.fullData[voice.patternPtr++];
                if (nextDelay > 0) voice.patternDelay = nextDelay;
                voice.currentMacro = nextSound;
                this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${voice.voiceId} PatPC:$${patPC.toString(16)} -> Pattern Header [08 Delay:${nextDelay} Macro:${nextSound}]`);
                return false;
            }
        }

        // Opcode $E1: Pattern Return
        if (b0 === 0xE1) {
            this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${voice.voiceId} PatPC:$${patPC.toString(16)} -> Opcode $E1 (Pattern Return)`);
            voice.patternPtr = -1;
            voice.patternHeaderPending = false;
            return false;
        }

        // Opcode $FE: Set Macro ID
        if (b0 === 0xFE) {
            const macroId = this.fullData[voice.patternPtr++];
            voice.currentMacro = macroId;
            this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${voice.voiceId} PatPC:$${patPC.toString(16)} -> Opcode $FE (Set Macro ID = ${voice.currentMacro})`);
            return false;
        }

        // Opcode $FD: Set Delay
        if (b0 === 0xFD) {
            const delay = this.fullData[voice.patternPtr++];
            voice.patternDelay = Math.max(1, delay);
            this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${voice.voiceId} PatPC:$${patPC.toString(16)} -> Opcode $FD (Set Delay = ${delay})`);
            return false;
        }

        if (b0 === 0xFF) return false;

        // Note Trigger ($01..$3F)
        if (b0 >= 0x01 && b0 <= 0x3F) {
            let noteIdx = b0 + voice.transpose;
            
            while (noteIdx < 1) noteIdx += 12;
            while (noteIdx >= PERIOD_TABLE.length) noteIdx -= 12;

            let period = PERIOD_TABLE[noteIdx] || 428;
            if (period < 113) period = 113;

            voice.basePer = period;
            voice.audPer = period;
            voice.audVol = 64;
            voice.dmaTriggered = false;

            if (channel) {
                channel.writeAUDxPER(period);
                channel.writeAUDxVOL(64);
            }

            // 1. Startet das Sound-Macro (Schreibt AUDxLC, AUDxLEN und triggert DMA)
            this.startMacro(voice, voice.currentMacro, channel);

            // 2. Fallback: Nur wenn das Macro kein $E1/$E5/$E7 ausgeführt hat
            if (!voice.dmaTriggered && channel) {
                const pcmKey = `hipc_pcm_${voice.currentMacro}`;
                const waveKey = `hipc_sample_${voice.currentMacro}`;
                const smpObj = this.samples[pcmKey] || this.samples[waveKey] || this.samples['hipc_sample_0'];

                if (smpObj && smpObj.data) {
                    const loopStartWords = smpObj.loopStart ? Math.floor(smpObj.loopStart / 2) : 0;
                    const loopLenWords = smpObj.loopLen ? Math.floor(smpObj.loopLen / 2) : 0;

                    channel.writeAUDxLC(voice.audLc, smpObj.data, loopStartWords, loopLenWords);
                    channel.writeAUDxLEN(Math.floor(smpObj.data.length / 2));
                    channel.writeAUDxVOL(voice.audVol || 64);
                    channel.enableDMA(smpObj.data, loopStartWords, loopLenWords);
                }
            }

            if (voice.patternDelay === null) {
                voice.patternDelay = 4;
            }

            voice.wait = Math.max(0, voice.patternDelay - 1);
            this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${voice.voiceId} PatPC:$${patPC.toString(16)} -> Note $${b0.toString(16)} = Note ${noteIdx} | AUD${voice.voiceId}PER=${period}, VOL=${voice.audVol}`);
            return true;
        }

        // Rest ($00)
        if (b0 === 0x00) {
            voice.audVol = 0;
            voice.macroActive = false;
            if (channel) channel.writeAUDxVOL(0);

            if (voice.patternDelay === null) {
                voice.patternDelay = 4;
            }

            voice.wait = Math.max(0, voice.patternDelay - 1);
            this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${voice.voiceId} PatPC:$${patPC.toString(16)} -> Rest $00 | AUD${voice.voiceId}VOL=0`);
            return true;
        }

        return false;
    }

    // =========================================================
    // 3. TRACK ENGINE
    // =========================================================
    decodeTrackTuple(voice, currentTick) {
        const trackPC = voice.trackPtr;
        const b0 = this.fullData[voice.trackPtr++];
        const b1 = this.fullData[voice.trackPtr++];

        // A1. Track Loop ($E0)
        if (b0 === 0xE0) {
            const targetStep = b1;
            voice.trackPtr = voice.startTrackPtr + (targetStep * 2);
            this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${voice.voiceId} TrackPC:$${trackPC.toString(16)} -> Opcode $E0 (Track Loop to Step ${targetStep})`);
            return;
        }

        // A2. Track Jump ($E8)
        if (b0 === 0xE8) {
            const targetStep = b1;
            voice.trackPtr = voice.startTrackPtr + (targetStep * 2);
            this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${voice.voiceId} TrackPC:$${trackPC.toString(16)} -> Opcode $E8 (Track Jump to Step ${targetStep})`);
            return;
        }

        // B. Track Speed ($E2)
        if (b0 === 0xE2) {
            if (b1 > 0) voice.patternDelay = b1;
            this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${voice.voiceId} TrackPC:$${trackPC.toString(16)} -> Set Track Speed = ${b1}`);
            return;
        }

        // C. Track Subroutine Call ($E4 JSR)
        if (b0 === 0xE4) {
            const target = b1;
            let targetPtr = (target >= 0x40 && target < this.patTableOffset) 
                ? (target & ~1) 
                : (voice.startTrackPtr + (target * 2));

            if (voice.trackStack.length < 8) {
                voice.trackStack.push(voice.trackPtr);
            }
            voice.trackPtr = targetPtr;
            this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${voice.voiceId} TrackPC:$${trackPC.toString(16)} -> Opcode $E4 (Call Subroutine at $${targetPtr.toString(16)})`);
            return;
        }

        // D1. Track Subroutine Return ($E1 RTS)
        if (b0 === 0xE1) {
            if (voice.trackStack.length > 0) {
                voice.trackPtr = voice.trackStack.pop();
                this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${voice.voiceId} TrackPC:$${trackPC.toString(16)} -> Opcode $E1 (Track Subroutine Return)`);
            } else {
                voice.trackPtr = voice.startTrackPtr;
                this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${voice.voiceId} TrackPC:$${trackPC.toString(16)} -> Opcode $E1 (Track End -> Loop Start)`);
            }
            return;
        }

        // D2. Track End ($FF)
        if (b0 === 0xFF) {
            if (voice.trackStack.length > 0) {
                voice.trackPtr = voice.trackStack.pop();
                this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${voice.voiceId} TrackPC:$${trackPC.toString(16)} -> Opcode $FF (Subroutine Return)`);
            } else {
                voice.trackPtr = voice.startTrackPtr;
                this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${voice.voiceId} TrackPC:$${trackPC.toString(16)} -> Opcode $FF (Track End -> Loop Start)`);
            }
            return;
        }

        // E. Pattern Call
        if (b0 < 0xE0) {
            const patId = b0 & 0x7F;
            const transp = decodeTransposeByte(b1);

            if (this.patternPointers && patId < this.patternPointers.length) {
                voice.patternPtr = this.patternPointers[patId];
                voice.patternHeaderPending = true;
                voice.transpose = transp;
                this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${voice.voiceId} TrackPC:$${trackPC.toString(16)} -> Call Pattern ${patId} at $${voice.patternPtr.toString(16)} (Transpose ${transp})`);
            }
        }
    }

    processTick(paulaChannels) {
        const currentTick = this.tickCounter++;

        for (let v = 0; v < 4; v++) {
            const voice = this.voices[v];
            const channel = paulaChannels[v];
            if (voice.stopped) continue;

            // 1. Macro-Modulationen pro 50Hz Frame ausführen
            if (voice.macroActive) {
                this.decodeMacroFrame(voice, channel, false);
            }

            // 2. Note Sustain Warten
            if (voice.wait > 0) {
                voice.wait--;
                continue;
            }

            let safety = 64;
            while (safety > 0 && !voice.stopped) {
                safety--;

                if (voice.patternPtr !== -1) {
                    const noteTriggered = this.decodePatternStream(voice, channel, currentTick);
                    if (noteTriggered) break;
                } else {
                    this.decodeTrackTuple(voice, currentTick);
                }
            }
        }
    }
}