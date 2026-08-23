// === js/worklets/lib/coso-vm.js ===
// =========================================================
// JOCHEN HIPPEL (MAD MAX) COSO VIRTUAL MACHINE
// Production Master Edition:
// - Full Track Subroutine Call Stack ($E4 JSR -> $E1/$FF RTS)
// - Context-Aware $08 Pattern Initialization Header
// - Decoupled 50Hz Macro VM & Paula DMA Register Management
// - Isolated decodeTransposeByte() with M68k EXT.W Semantics
// =========================================================

const PERIOD_TABLE = [
    0,
    856, 808, 762, 720, 678, 640, 604, 570, 538, 508, 480, 453, // Oktave 1 (1..12)
    428, 404, 381, 360, 339, 320, 302, 285, 269, 254, 240, 226, // Oktave 2 (13..24)
    214, 202, 190, 180, 170, 160, 151, 143, 135, 127, 120, 113, // Oktave 3 (25..36)
    107, 101,  95,  90,  85,  80,  75,  71,  67,  63,  60,  56, // Oktave 4 (37..48)
     53,  50,  47,  45,  42,  40,  37,  35,  33,  31,  30,  28  // Oktave 5 (49..60)
];

// Isolierte, saubere Transpositionsfunktion
export function decodeTransposeByte(b1) {
    let transp = (b1 > 127) ? (b1 - 256) : b1;
    if (transp < -36 || transp > 36) {
        transp = Math.max(-36, Math.min(36, transp));
    }
    return transp;
}

export class CosoVirtualMachine {
    constructor(trackModule, samplesDict, traceCallback = null) {
        this.data = trackModule.rawData || trackModule.blocks.tracks;
        this.fullData = trackModule.fullData || this.data;
        this.patternPointers = trackModule.patternPointers;
        this.macroPointers = trackModule.macroPointers;
        this.macroTableOffset = (trackModule.header && trackModule.header.macroTableOffset) || 0x09EE;
        this.patTableOffset = (trackModule.header && trackModule.header.patTableOffset) || 0x02E4;
        this.sampleDataOffset = (trackModule.header && trackModule.header.sampleDataOffset) || 0x1C3E;
        this.sampleDescriptors = trackModule.sampleDescriptors || [];
        this.voiceTrackPointers = trackModule.voiceTrackPointers;
        this.samples = samplesDict;
        this.traceCallback = traceCallback;

        this.tickCounter = 0;
        this.traceLogCount = 0;
        this.maxTraceLogs = 80;

        this.voices = [];
        for (let v = 0; v < 4; v++) {
            let rawStartPtr = (this.voiceTrackPointers && this.voiceTrackPointers[v]) 
                ? this.voiceTrackPointers[v] 
                : (0x0074 + v * 0x14);
            
            let startPtr = rawStartPtr & ~1;

            this.voices.push({
                voiceId: v,
                trackPtr: startPtr,
                startTrackPtr: startPtr,
                trackStack: [], // Callstack für $E4 Subroutinen!
                patternPtr: -1,
                patternHeaderPending: false,
                patternDelay: 4,
                transpose: 0,
                currentMacro: 1,
                wait: 0,
                stopped: false,

                // Macro State
                macroPtr: -1,
                macroStartPtr: -1,
                macroActive: false,
                macroWait: 0,

                // Paula State
                audLc: this.sampleDataOffset,
                audLen: 16,
                basePer: 428,
                audPer: 428,
                audVol: 64,
                sampleKey: 'hipc_sample_1'
            });
        }

        if (this.traceCallback) {
            this.traceCallback(`--- [COSO-VM INITIALIZED] $E4 Track-Subroutine Callstack Active ---`);
        }
    }

    logTrace(msg) {
        if (this.traceCallback && this.traceLogCount < this.maxTraceLogs) {
            this.traceLogCount++;
            this.traceCallback(msg);
        }
    }

    // =========================================================
    // 1. SOUND-MACRO-ENGINE
    // =========================================================
    startMacro(voice, macroId, channel) {
        let macroOffset = -1;
        
        if (this.macroPointers && macroId < this.macroPointers.length && this.macroPointers[macroId] > 0) {
            macroOffset = this.macroPointers[macroId];
        }

        if (macroOffset > 0 && macroOffset < this.fullData.length - 2) {
            voice.macroPtr = macroOffset;
            voice.macroStartPtr = macroOffset;
            voice.macroActive = true;
            voice.macroWait = 0;
            this.decodeMacroFrame(voice, channel, true);
        } else {
            voice.audLc = this.sampleDataOffset;
            voice.audLen = 16;
            const smp = this.samples['hipc_sample_1'];
            if (smp && smp.data && channel) {
                channel.trigger(smp.data, 0, 32);
                channel.audLc = voice.audLc;
                channel.audLen = 16;
            }
        }
    }

    decodeMacroFrame(voice, channel, isFrame0 = false) {
        if (!voice.macroActive || voice.macroPtr <= 0 || voice.macroPtr >= this.fullData.length) return;

        let macroSafety = 16;
        while (macroSafety > 0 && voice.macroActive) {
            macroSafety--;
            const op = this.fullData[voice.macroPtr++];

            if (op === 0xE0) {
                voice.macroActive = false;
                break;
            } else if (op === 0xE1) {
                const waveIdx = this.fullData[voice.macroPtr++];
                voice.sampleKey = `hipc_sample_${waveIdx + 1}`;
                voice.audLc = this.sampleDataOffset + (waveIdx * 32);
                voice.audLen = 16;

                const smp = this.samples[voice.sampleKey] || this.samples['hipc_sample_1'];
                if (smp && smp.data && channel) {
                    channel.trigger(smp.data, 0, 32);
                    channel.audLc = voice.audLc;
                    channel.audLen = 16;
                }
            } else if (op === 0xE2) {
                const vol = this.fullData[voice.macroPtr++];
                voice.audVol = vol > 64 ? 64 : vol;
                if (channel) channel.vol = voice.audVol;
            } else if (op === 0xE3) {
                const delta = this.fullData[voice.macroPtr++];
                const sDelta = (delta > 127) ? (delta - 256) : delta;
                voice.audVol = Math.max(0, Math.min(64, voice.audVol + sDelta));
                if (channel) channel.vol = voice.audVol;
                if (!isFrame0) break;
            } else if (op === 0xE4) {
                const pDelta = this.fullData[voice.macroPtr++];
                const sPDelta = (pDelta > 127) ? (pDelta - 256) : pDelta;
                voice.audPer = Math.max(113, voice.audPer + sPDelta);
                if (channel) channel.per = voice.audPer;
                if (!isFrame0) break;
            } else if (op === 0xE5 || op === 0xE7) {
                const sampleIdx = this.fullData[voice.macroPtr++];
                const pcmKey = `hipc_pcm_${sampleIdx}`;
                const desc = this.sampleDescriptors[sampleIdx];

                if (desc) {
                    voice.audLc = desc.absStart;
                    voice.audLen = desc.sampleLengthWords;
                }

                const smp = this.samples[pcmKey] || this.samples[`hipc_sample_${sampleIdx}`];
                if (smp && smp.data && channel) {
                    channel.trigger(smp.data, smp.loopStart, smp.loopLen);
                    channel.audLc = voice.audLc;
                    channel.audLen = voice.audLen;
                    if (smp.baseVolume !== undefined) {
                        channel.vol = smp.baseVolume;
                        voice.audVol = smp.baseVolume;
                    }
                }
            } else if (op === 0xE6) {
                break;
            } else if (op === 0xE8) {
                const targetStep = this.fullData[voice.macroPtr++];
                voice.macroPtr = voice.macroStartPtr + (targetStep * 2);
            } else {
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

        if (voice.patternHeaderPending) {
            voice.patternHeaderPending = false;

            if (b0 === 0x08 && voice.patternPtr < this.fullData.length - 2) {
                const nextDelay = this.fullData[voice.patternPtr++];
                const nextSound = this.fullData[voice.patternPtr++];
                if (nextDelay > 0) voice.patternDelay = nextDelay;
                if (nextSound > 0) voice.currentMacro = nextSound;
                this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${voice.voiceId} PatPC:$${patPC.toString(16)} -> Pattern Header [08 Delay:${nextDelay} Macro:${nextSound}]`);
                return false;
            }
        }

        if (b0 === 0xE1) {
            this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${voice.voiceId} PatPC:$${patPC.toString(16)} -> Opcode $E1 (Pattern Return)`);
            voice.patternPtr = -1;
            voice.patternHeaderPending = false;
            return false;
        }

        if (b0 === 0xFE) {
            const macroId = this.fullData[voice.patternPtr++];
            voice.currentMacro = macroId > 0 ? macroId : 1;
            this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${voice.voiceId} PatPC:$${patPC.toString(16)} -> Opcode $FE (Set Macro ID = ${voice.currentMacro})`);
            return false;
        }

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

            if (channel) {
                channel.per = period;
                channel.vol = 64;

                const pcmKey = `hipc_pcm_${voice.currentMacro}`;
                const waveKey = `hipc_sample_${voice.currentMacro}`;
                const smpObj = this.samples[pcmKey] || this.samples[waveKey] || this.samples['hipc_sample_1'];

                if (smpObj && smpObj.data) {
                    channel.trigger(smpObj.data, smpObj.loopStart, smpObj.loopLen);
                    channel.audLc = voice.audLc;
                    channel.audLen = voice.audLen;
                    if (smpObj.baseVolume !== undefined) {
                        channel.vol = smpObj.baseVolume;
                        voice.audVol = smpObj.baseVolume;
                    }
                }
            }

            this.startMacro(voice, voice.currentMacro, channel);

            voice.wait = Math.max(0, voice.patternDelay - 1);
            this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${voice.voiceId} PatPC:$${patPC.toString(16)} -> Note $${b0.toString(16)} (${voice.transpose >= 0 ? '+' : ''}${voice.transpose}) = Note ${noteIdx} | AUD${voice.voiceId}PER=${period}, VOL=${voice.audVol} (Macro ${voice.currentMacro}, Wait ${voice.wait})`);
            return true;
        }

        // Rest ($00)
        if (b0 === 0x00) {
            voice.audVol = 0;
            voice.macroActive = false;
            if (channel) channel.vol = 0;
            voice.wait = Math.max(0, voice.patternDelay - 1);
            this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${voice.voiceId} PatPC:$${patPC.toString(16)} -> Rest $00 | AUD${voice.voiceId}VOL=0 (Wait ${voice.wait})`);
            return true;
        }

        return false;
    }

    // =========================================================
    // 3. TRACK ENGINE (MIT $E4 SUBROUTINE CALLSTACK)
    // =========================================================
    decodeTrackTuple(voice, currentTick) {
        const trackPC = voice.trackPtr;
        const b0 = this.fullData[voice.trackPtr++];
        const b1 = this.fullData[voice.trackPtr++];

        // A1. Unbedingter Track Loop ($E0)
        if (b0 === 0xE0) {
            const targetStep = b1;
            voice.trackPtr = voice.startTrackPtr + (targetStep * 2);
            this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${voice.voiceId} TrackPC:$${trackPC.toString(16)} -> Opcode $E0 (Track Loop to Step ${targetStep} -> $${voice.trackPtr.toString(16)})`);
            return;
        }

        // A2. Track Jump ($E8)
        if (b0 === 0xE8) {
            const targetStep = b1;
            voice.trackPtr = voice.startTrackPtr + (targetStep * 2);
            this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${voice.voiceId} TrackPC:$${trackPC.toString(16)} -> Opcode $E8 (Track Jump to Step ${targetStep} -> $${voice.trackPtr.toString(16)})`);
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

            // Rücksprungadresse auf dem Track-Stack sichern
            if (voice.trackStack.length < 8) {
                voice.trackStack.push(voice.trackPtr);
            }
            voice.trackPtr = targetPtr;
            this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${voice.voiceId} TrackPC:$${trackPC.toString(16)} -> Opcode $E4 (Call Subroutine at $${targetPtr.toString(16)})`);
            return;
        }

        // D1. Track Subroutine Return ($E1 RTS auf Track-Ebene)
        if (b0 === 0xE1) {
            if (voice.trackStack.length > 0) {
                voice.trackPtr = voice.trackStack.pop();
                this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${voice.voiceId} TrackPC:$${trackPC.toString(16)} -> Opcode $E1 (Track Subroutine Return to $${voice.trackPtr.toString(16)})`);
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
                this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${voice.voiceId} TrackPC:$${trackPC.toString(16)} -> Opcode $FF (Subroutine Return to $${voice.trackPtr.toString(16)})`);
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

            // Macro-Modulationen ausführen
            if (voice.macroActive) {
                this.decodeMacroFrame(voice, channel, false);
            }

            // Note Sustain Warten
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