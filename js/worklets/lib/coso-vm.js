// === js/worklets/lib/coso-vm.js ===
// =========================================================
// JOCHEN HIPPEL (MAD MAX) COSO VIRTUAL MACHINE
// Production Master Edition — Decoupled Sound-Macro VM ($E0..$E8):
// - FE <id> sets currentMacro strictly as macro selector
// - Note-On initiates Sound-Macro VM execution (Frame 0 Multi-Command)
// - 50Hz Macro-VM controls AUDxLC, AUDxLEN, AUDxVOL, AUDxPER dynamically
// - Full Support for $E1 (Waveform), $E2 (Vol), $E3 (Slide), $E4 (Pitch),
//   $E5/$E7 (PCM Digidrums), $E6 (Wait/NOP), $E8 (Macro Loop), $E0 (Sustain)
// =========================================================

const PERIOD_TABLE = [
    0,
    856, 808, 762, 720, 678, 640, 604, 570, 538, 508, 480, 453, // Oktave 1 (1..12)
    428, 404, 381, 360, 339, 320, 302, 285, 269, 254, 240, 226, // Oktave 2 (13..24)
    214, 202, 190, 180, 170, 160, 151, 143, 135, 127, 120, 113, // Oktave 3 (25..36)
    107, 101,  95,  90,  85,  80,  75,  71,  67,  63,  60,  56, // Oktave 4 (37..48)
     53,  50,  47,  45,  42,  40,  37,  35,  33,  31,  30,  28  // Oktave 5 (49..60)
];

export class CosoVirtualMachine {
    constructor(trackModule, samplesDict, traceCallback = null) {
        this.data = trackModule.rawData || trackModule.blocks.tracks;
        this.fullData = trackModule.fullData || this.data;
        this.patternPointers = trackModule.patternPointers;
        this.macroPointers = trackModule.macroPointers;
        this.macroTableOffset = trackModule.header.macroTableOffset || 0x03E4;
        this.voiceTrackPointers = trackModule.voiceTrackPointers;
        this.samples = samplesDict;
        this.traceCallback = traceCallback;

        this.tickCounter = 0;
        this.traceLogCount = 0;
        this.maxTraceLogs = 80;

        this.voices = [];
        for (let v = 0; v < 4; v++) {
            let startPtr = (this.voiceTrackPointers && this.voiceTrackPointers[v]) 
                ? this.voiceTrackPointers[v] 
                : (0x0074 + v * 0x14);
                
            this.voices.push({
                voiceId: v,
                trackPtr: startPtr,
                startTrackPtr: startPtr,
                patternPtr: -1,
                patternHeaderPending: false,
                patternDelay: 4,
                transpose: 0,
                currentMacro: 1, // Standard-Macro
                wait: 0,
                stopped: false,

                // Macro State Machine
                macroPtr: -1,
                macroStartPtr: -1,
                macroActive: false,
                macroWait: 0,

                // Paula Hardware State
                basePer: 428,
                audPer: 428,
                audVol: 0,
                sampleKey: 'hipc_sample_1'
            });
        }

        if (this.traceCallback) {
            this.traceCallback(`--- [COSO-VM INITIALIZED] True 2-Level Macro-VM Ready ---`);
        }
    }

    logTrace(msg) {
        if (this.traceCallback && this.traceLogCount < this.maxTraceLogs) {
            this.traceLogCount++;
            this.traceCallback(msg);
        }
    }

    // =========================================================
    // SOUND-MACRO-VM: START BEI NOTE-ON
    // =========================================================
    startMacro(voice, macroId, channel) {
        let macroOffset = -1;
        
        if (this.macroPointers && macroId < this.macroPointers.length && this.macroPointers[macroId] > 0) {
            macroOffset = this.macroPointers[macroId];
        } else {
            macroOffset = this.macroTableOffset + (Math.max(0, macroId - 1) * 32);
        }

        if (macroOffset > 0 && macroOffset < this.fullData.length) {
            voice.macroPtr = macroOffset;
            voice.macroStartPtr = macroOffset;
            voice.macroActive = true;
            voice.macroWait = 0;
            
            // Frame 0: Führt sofort alle Initialisierungsbefehle bis zum ersten Wait/Ende aus
            this.executeMacroStep(voice, channel, true);
        }
    }

    // =========================================================
    // SOUND-MACRO-VM: 50-Hz VBLANK EXECUTION ($E0..$E8)
    // =========================================================
    executeMacroStep(voice, channel, isFrame0 = false) {
        if (!voice.macroActive || voice.macroPtr <= 0 || voice.macroPtr >= this.fullData.length) return;

        let macroSafety = 32;
        while (macroSafety > 0 && voice.macroActive) {
            macroSafety--;
            const op = this.fullData[voice.macroPtr++];

            // $E0: End of Macro (Sustain/Hold)
            if (op === 0xE0) {
                voice.macroActive = false;
                break;
            }
            // $E1: Set 32-Byte Waveform
            else if (op === 0xE1) {
                const waveIdx = this.fullData[voice.macroPtr++];
                voice.sampleKey = `hipc_sample_${waveIdx + 1}`;
                const smp = this.samples[voice.sampleKey] || this.samples['hipc_sample_1'];
                if (smp && smp.data && channel) {
                    channel.trigger(smp.data, 0, 32);
                }
            }
            // $E2: Set Volume
            else if (op === 0xE2) {
                const vol = this.fullData[voice.macroPtr++];
                voice.audVol = vol > 64 ? 64 : vol;
                if (channel) channel.vol = voice.audVol;
            }
            // $E3: Volume Slide
            else if (op === 0xE3) {
                const delta = this.fullData[voice.macroPtr++];
                const sDelta = (delta > 127) ? (delta - 256) : delta;
                voice.audVol = Math.max(0, Math.min(64, voice.audVol + sDelta));
                if (channel) channel.vol = voice.audVol;
                if (!isFrame0) break; // Wartet 1 Frame
            }
            // $E4: Portamento / Pitch Slide
            else if (op === 0xE4) {
                const pDelta = this.fullData[voice.macroPtr++];
                const sPDelta = (pDelta > 127) ? (pDelta - 256) : pDelta;
                voice.audPer = Math.max(113, voice.audPer + sPDelta);
                if (channel) channel.per = voice.audPer;
                if (!isFrame0) break; // Wartet 1 Frame
            }
            // $E5 / $E7: Set Sample (PCM Digidrum)
            else if (op === 0xE5 || op === 0xE7) {
                const sampleIdx = this.fullData[voice.macroPtr++];
                const pcmKey = `hipc_pcm_${sampleIdx}`;
                const smp = this.samples[pcmKey] || this.samples[`hipc_sample_${sampleIdx}`];
                if (smp && smp.data && channel) {
                    channel.trigger(smp.data, smp.loopStart, smp.loopLen);
                    if (smp.baseVolume !== undefined) {
                        channel.vol = smp.baseVolume;
                        voice.audVol = smp.baseVolume;
                    }
                }
            }
            // $E6: NOP / Wait 1 Frame
            else if (op === 0xE6) {
                break; // Beendet Frame-Abarbeitung
            }
            // $E8: Macro Loop
            else if (op === 0xE8) {
                const targetStep = this.fullData[voice.macroPtr++];
                voice.macroPtr = voice.macroStartPtr + (targetStep * 2);
            }
            else {
                break;
            }
        }
    }

    // =========================================================
    // 50-Hz VBLANK TICK (HAUPTSCHLEIFE)
    // =========================================================
    processTick(paulaChannels) {
        const currentTick = this.tickCounter++;

        for (let v = 0; v < 4; v++) {
            const voice = this.voices[v];
            const channel = paulaChannels[v];
            if (voice.stopped) continue;

            // 1. Laufende Sound-Macro-Modulationen pro Frame ausführen
            if (voice.macroActive) {
                this.executeMacroStep(voice, channel, false);
            }

            // 2. Note Sustain: Warten bis zum nächsten Pattern-Event
            if (voice.wait > 0) {
                voice.wait--;
                continue;
            }

            let safety = 64;
            while (safety > 0 && !voice.stopped) {
                safety--;

                // =========================================================
                // PATTERN BYTECODE-STREAM
                // =========================================================
                if (voice.patternPtr !== -1) {
                    if (voice.patternPtr >= this.fullData.length) {
                        voice.patternPtr = -1;
                        voice.patternHeaderPending = false;
                        continue;
                    }

                    const patPC = voice.patternPtr;
                    const b0 = this.fullData[voice.patternPtr++];

                    // A. Pattern Header ($08) - Nur am Pattern-Start
                    if (voice.patternHeaderPending) {
                        voice.patternHeaderPending = false;

                        if (b0 === 0x08 && voice.patternPtr < this.fullData.length - 2) {
                            const nextDelay = this.fullData[voice.patternPtr++];
                            const nextSound = this.fullData[voice.patternPtr++];
                            if (nextDelay > 0) voice.patternDelay = nextDelay;
                            if (nextSound > 0) voice.currentMacro = nextSound;
                            this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${v} PatPC:$${patPC.toString(16)} -> Pattern Header [08 Delay:${nextDelay} Macro:${nextSound}]`);
                            continue;
                        }
                    }

                    // B. Opcode $E1: Pattern Return
                    if (b0 === 0xE1) {
                        this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${v} PatPC:$${patPC.toString(16)} -> Opcode $E1 (Pattern Return)`);
                        voice.patternPtr = -1;
                        voice.patternHeaderPending = false;
                        continue;
                    }

                    // C. Opcode $FE: Set Macro ID (Reiner Selektor!)
                    if (b0 === 0xFE) {
                        const macroId = this.fullData[voice.patternPtr++];
                        voice.currentMacro = macroId > 0 ? macroId : 1;
                        this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${v} PatPC:$${patPC.toString(16)} -> Opcode $FE (Set Macro ID = ${voice.currentMacro})`);
                        continue; // Kein Sample-Trigger! Wartet auf Note-On
                    }

                    // D. Opcode $FD: Set Delay Override
                    if (b0 === 0xFD) {
                        const delay = this.fullData[voice.patternPtr++];
                        voice.patternDelay = Math.max(1, delay);
                        this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${v} PatPC:$${patPC.toString(16)} -> Opcode $FD (Set Delay = ${delay})`);
                        continue;
                    }

                    // E. Opcode $FF: NOP
                    if (b0 === 0xFF) continue;

                    // F. Note Trigger ($01..$3F) -> STARTET SOUND-MACRO-VM!
                    if (b0 >= 0x01 && b0 <= 0x3F) {
                        let noteIdx = b0 + voice.transpose;
                        if (noteIdx < 1) noteIdx = 1;
                        if (noteIdx >= PERIOD_TABLE.length) noteIdx = PERIOD_TABLE.length - 1;

                        let period = PERIOD_TABLE[noteIdx];
                        if (period < 113) period = 113;

                        voice.basePer = period;
                        voice.audPer = period;
                        if (channel) channel.per = period;

                        // Startet die Macro-VM ab Frame 0 (Übernimmt AUDxLC, AUDxLEN, AUDxVOL!)
                        this.startMacro(voice, voice.currentMacro, channel);

                        voice.wait = Math.max(0, voice.patternDelay - 1);
                        this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${v} PatPC:$${patPC.toString(16)} -> Note $${b0.toString(16)} (+${voice.transpose}) = Note ${noteIdx} | Trigger Macro ${voice.currentMacro} | PER=${period}, VOL=${voice.audVol} (Wait ${voice.wait})`);
                        break;
                    }

                    // G. Rest / Pause ($00)
                    if (b0 === 0x00) {
                        voice.audVol = 0;
                        voice.macroActive = false;
                        if (channel) channel.vol = 0;
                        voice.wait = Math.max(0, voice.patternDelay - 1);
                        this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${v} PatPC:$${patPC.toString(16)} -> Rest $00 | AUD${v}VOL=0 (Wait ${voice.wait})`);
                        break;
                    }
                }

                // =========================================================
                // TRACK-ORDERLIST STREAM
                // =========================================================
                else {
                    const trackPC = voice.trackPtr;
                    const b0 = this.fullData[voice.trackPtr++];
                    const b1 = this.fullData[voice.trackPtr++];

                    // A. Track Loop ($E0 oder $E8)
                    if (b0 === 0xE0 || b0 === 0xE8) {
                        const targetStep = b1;
                        voice.trackPtr = voice.startTrackPtr + (targetStep * 2);
                        this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${v} TrackPC:$${trackPC.toString(16)} -> Track Loop to Step ${targetStep} ($${voice.trackPtr.toString(16)})`);
                        continue;
                    }

                    // B. Track Speed ($E2)
                    if (b0 === 0xE2) {
                        if (b1 > 0) voice.patternDelay = b1;
                        this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${v} TrackPC:$${trackPC.toString(16)} -> Set Track Speed = ${b1}`);
                        continue;
                    }

                    // C. Special Call ($E4)
                    if (b0 === 0xE4) {
                        this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${v} TrackPC:$${trackPC.toString(16)} -> Opcode $E4 (Special Call)`);
                        continue;
                    }

                    // D. Track End ($FF)
                    if (b0 === 0xFF) {
                        this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${v} TrackPC:$${trackPC.toString(16)} -> Opcode $FF (Track End)`);
                        voice.trackPtr = voice.startTrackPtr;
                        continue;
                    }

                    // E. Pattern Call ([Pattern_ID, Transpose])
                    if (b0 < 0xE0) {
                        const patId = b0 & 0x7F;

                        // $80-zentrierte Transposition
                        let transp = 0;
                        if (b1 >= 0x80) {
                            transp = b1 - 0x80;
                        } else if (b1 > 0x40) {
                            transp = b1 - 0x80;
                        } else {
                            transp = b1;
                        }

                        if (this.patternPointers && patId < this.patternPointers.length) {
                            voice.patternPtr = this.patternPointers[patId];
                            voice.patternHeaderPending = true;
                            voice.transpose = transp;
                            this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${v} TrackPC:$${trackPC.toString(16)} -> Call Pattern ${patId} at $${voice.patternPtr.toString(16)} (Transpose ${transp})`);
                        }
                        continue;
                    }
                }
            }
        }
    }
}