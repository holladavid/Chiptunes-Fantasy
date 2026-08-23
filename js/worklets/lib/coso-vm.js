// === js/worklets/lib/coso-vm.js ===
// =========================================================
// JOCHEN HIPPEL (MAD MAX) COSO VIRTUAL MACHINE
// Calibrated 50Hz VBLANK Replayer Engine
// - Pattern Range $00..$7F with Bit-7 Track Command Masking
// - Verified 50Hz Tick & Wait Counter
// - Real-time Paula Register Commits (AUDxPER, AUDxVOL, AUDxLC, AUDxLEN)
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
        this.voiceTrackPointers = trackModule.voiceTrackPointers;
        this.samples = samplesDict;
        this.traceCallback = traceCallback;

        this.tickCounter = 0;
        this.traceLogCount = 0;
        this.maxTraceLogs = 80;

        this.voices = [];
        for (let v = 0; v < 4; v++) {
            let startPtr = (this.voiceTrackPointers && this.voiceTrackPointers[v]) ? this.voiceTrackPointers[v] : (0x0074 + v * 0x14);
            this.voices.push({
                voiceId: v,
                trackPtr: startPtr,
                startTrackPtr: startPtr,
                patternPtr: -1,
                patternDelay: 4,
                transpose: 0,
                currentMacro: 1,
                wait: 0,
                stopped: false,

                // Paula State
                audPer: 0,
                audVol: 0,
                sampleKey: 'hipc_sample_1'
            });
        }

        if (this.traceCallback) {
            this.traceCallback(`--- [COSO-VM CALIBRATED] Voices: [0:$${this.voices[0].trackPtr.toString(16)}, 1:$${this.voices[1].trackPtr.toString(16)}, 2:$${this.voices[2].trackPtr.toString(16)}, 3:$${this.voices[3].trackPtr.toString(16)}] ---`);
        }
    }

    logTrace(msg) {
        if (this.traceCallback && this.traceLogCount < this.maxTraceLogs) {
            this.traceLogCount++;
            this.traceCallback(msg);
        }
    }

    processTick(paulaChannels) {
        const currentTick = this.tickCounter++;

        for (let v = 0; v < 4; v++) {
            const voice = this.voices[v];
            const channel = paulaChannels[v];
            if (voice.stopped) continue;

            if (voice.wait > 0) {
                voice.wait--;
                continue;
            }

            let safety = 64;
            while (safety > 0 && !voice.stopped) {
                safety--;

                // --- PATTERN BYTECODE-STREAM ---
                if (voice.patternPtr !== -1) {
                    if (voice.patternPtr >= this.fullData.length) {
                        voice.patternPtr = -1;
                        continue;
                    }

                    const patPC = voice.patternPtr;
                    const b0 = this.fullData[voice.patternPtr++];

                    // Opcode $E1: Pattern Return
                    if (b0 === 0xE1) {
                        this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${v} PatPC:$${patPC.toString(16)} -> Opcode $E1 (Pattern Return)`);
                        voice.patternPtr = -1;
                        continue;
                    }

                    // Opcode $FE: Set Macro ID
                    if (b0 === 0xFE) {
                        const macroId = this.fullData[voice.patternPtr++];
                        this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${v} PatPC:$${patPC.toString(16)} -> Opcode $FE (Set Sound Macro ${macroId})`);
                        voice.currentMacro = macroId > 0 ? macroId : 1;
                        voice.sampleKey = `hipc_sample_${voice.currentMacro}`;
                        continue;
                    }

                    // Opcode $FD: Set Delay
                    if (b0 === 0xFD) {
                        const delay = this.fullData[voice.patternPtr++];
                        this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${v} PatPC:$${patPC.toString(16)} -> Opcode $FD (Set Delay = ${delay} Ticks)`);
                        voice.patternDelay = Math.max(1, delay);
                        continue;
                    }

                    // Opcode $08: Pattern-Header
                    if (b0 === 0x08 && voice.patternPtr < this.fullData.length - 2) {
                        const nextDelay = this.fullData[voice.patternPtr++];
                        const nextSound = this.fullData[voice.patternPtr++];
                        this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${v} PatPC:$${patPC.toString(16)} -> Pattern-Header [08 ${nextDelay} ${nextSound}]`);
                        if (nextDelay > 0) voice.patternDelay = nextDelay;
                        if (nextSound > 0) {
                            voice.currentMacro = nextSound;
                            voice.sampleKey = `hipc_sample_${voice.currentMacro}`;
                        }
                        continue;
                    }

                    if (b0 === 0xFF) continue;

                    // Note Trigger ($01..$3F)
                    if (b0 >= 0x01 && b0 <= 0x3F) {
                        let noteIdx = b0 + voice.transpose;
                        if (noteIdx < 1) noteIdx = 1;
                        if (noteIdx >= PERIOD_TABLE.length) noteIdx = PERIOD_TABLE.length - 1;

                        let period = PERIOD_TABLE[noteIdx];
                        if (period < 113) period = 113;

                        voice.audPer = period;
                        voice.audVol = 64;

                        if (channel) {
                            channel.per = period;
                            channel.vol = 64;
                            const smpObj = this.samples[voice.sampleKey] || this.samples['hipc_sample_1'];
                            if (smpObj && smpObj.data) {
                                channel.trigger(smpObj.data, smpObj.loopStart, smpObj.loopLen);
                            }
                        }

                        voice.wait = Math.max(0, voice.patternDelay - 1);
                        this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${v} PatPC:$${patPC.toString(16)} -> Note $${b0.toString(16)} (+${voice.transpose}) = Note ${noteIdx} | AUD${v}PER=${period}, VOL=64 (Wait ${voice.wait})`);
                        break;
                    }

                    // Rest / Pause ($00)
                    if (b0 === 0x00) {
                        voice.audVol = 0;
                        if (channel) channel.vol = 0;
                        voice.wait = Math.max(0, voice.patternDelay - 1);
                        this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${v} PatPC:$${patPC.toString(16)} -> Rest $00 | AUD${v}VOL=0 (Wait ${voice.wait})`);
                        break;
                    }
                }

                // --- TRACK-ORDERLIST STREAM ---
                else {
                    const trackPC = voice.trackPtr;
                    const b0 = this.fullData[voice.trackPtr++];
                    const b1 = this.fullData[voice.trackPtr++];

                    // Track Loop ($E0 oder $E8)
                    if (b0 === 0xE0 || b0 === 0xE8) {
                        const targetStep = b1;
                        voice.trackPtr = voice.startTrackPtr + (targetStep * 2);
                        this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${v} TrackPC:$${trackPC.toString(16)} -> Track Loop to Step ${targetStep} ($${voice.trackPtr.toString(16)})`);
                        continue;
                    }

                    // Track Speed ($E2)
                    if (b0 === 0xE2) {
                        voice.patternDelay = Math.max(1, b1);
                        this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${v} TrackPC:$${trackPC.toString(16)} -> Set Track Speed = ${b1}`);
                        continue;
                    }

                    // Special Call ($E4)
                    if (b0 === 0xE4) {
                        this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${v} TrackPC:$${trackPC.toString(16)} -> Opcode $E4 (Special Call)`);
                        continue;
                    }

                    // Track End ($FF)
                    if (b0 === 0xFF) {
                        this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${v} TrackPC:$${trackPC.toString(16)} -> Opcode $FF (Track End)`);
                        voice.trackPtr = voice.startTrackPtr;
                        continue;
                    }

                    // Pattern Call (0..127 mit $7F Maskierung)
                    if (b0 < 0xE0) {
                        const patId = b0 & 0x7F;
                        const transp = (b1 > 127) ? (b1 - 256) : b1;
                        
                        let patOffset = (this.patternPointers && patId < this.patternPointers.length) 
                            ? this.patternPointers[patId] 
                            : (0x02FC);

                        voice.patternPtr = patOffset;
                        voice.transpose = transp;
                        this.logTrace(`[TICK ${currentTick.toString().padStart(3, '0')}] V${v} TrackPC:$${trackPC.toString(16)} -> Call Pattern ${patId} at $${patOffset.toString(16)} (Transpose ${transp})`);
                        continue;
                    }
                }
            }
        }
    }
}