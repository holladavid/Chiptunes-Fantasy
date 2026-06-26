// === js/worklets/c64/sid-worklet.js ===
// =========================================================
// MOS TECHNOLOGY SID 6581 AUDIO WORKLET PROCESSOR
// High-Fidelity Cycle-Exact CPU Lockstep Mischer & Timer Engine (RTI/RTS Stack Fixed)
// =========================================================

import { CPU6502 } from '../lib/cpu6502.js';
import { SIDChip } from '../lib/sid-chip.js';
import { DCBlocker } from '../lib/dsp-utils.js';

class SIDProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.clock = 985248; // PAL C64 Clock
        this.sid = new SIDChip();
        this.cpu = new CPU6502(this.sid);
        this.dcBlock = new DCBlocker();

        this.trackData = null;
        this.isPlaying = false;
        
        // Lockstep-Verteiler Variablen
        this.cycleAccumulator = 0.0;
        this.vblankCycles = 19705; // Standard-PAL-VBLANK (985248 / 50 Hz)
        this.currentFrame = 0;
        
        this.initAddress = 0;
        this.playAddress = 0;
        this.useCiaTimer = false; 
        this.isIrqRoutine = false; 

        this.temperature = 55.0;
        this.visualView = new Float32Array(40);

        this.port.onmessage = (e) => {
            const msg = e.data;
            
            if (msg.type === 'SET_TEMPERATURE') {
                this.temperature = Math.min(75, Math.max(15, msg.value));
                return;
            }

            if (msg.isSidFile) {
                this.cpu.reset(msg.loadAddress, msg.c64Code);
                this.initAddress = msg.initAddress;
                this.playAddress = msg.playAddress;
                this.isIrqRoutine = false; // Zurücksetzen für neuen Track
                
                let songIndex = (msg.startSong > 0 ? msg.startSong - 1 : 0) & 0xFF;
                this.cpu.a = songIndex;
                this.cpu.x = songIndex; 
                this.cpu.y = 0;
                this.cpu.p &= ~1;
                
                this.useCiaTimer = ((msg.speed >> songIndex) & 1) !== 0;
                this.cpu.jsr(this.initAddress); 

                if (this.playAddress === 0) {
                    this.playAddress = this.cpu.read(0x0314) | (this.cpu.read(0x0315) << 8); 
                    if (this.playAddress === 0 || this.playAddress === 0xFFFF) {
                        this.playAddress = this.cpu.read(0xFFFE) | (this.cpu.read(0xFFFF) << 8);
                        if (this.playAddress !== 0 && this.playAddress !== 0xFFFF) {
                            this.isIrqRoutine = true; 
                        }
                    }
                    if (this.playAddress === 0 || this.playAddress === 0xFFFF) {
                        this.playAddress = this.initAddress + 3; 
                    }
                }

                // Initial-Reset der Mischer-Verteiler
                this.temperature = 55.0;
                this.cycleAccumulator = 0.0;
                this.vblankCycles = 19705;
                this.cpu.isIdle = true;

                this.currentFrame = 0;
                this.maxFrames = msg.length || 7500;
                this.isPlaying = true;
                
                console.log(`[6502 CPU] Cycle-Exact Lockstep ready.`);
            } else if (msg.type === 'STOP_TRACK') {
                this.isPlaying = false;
            } else if (msg.type === 'RESUME_TRACK') {
                this.isPlaying = true;
            } else if (msg.type === 'SEEK_TRACK') {
                this.currentFrame = msg.frame % this.maxFrames;
            } else if (msg.type === 'CHANGE_SUBSONG') {
                this.sid = new SIDChip();
                this.cpu.sid = this.sid;
                
                let songIndex = (msg.frame > 0 ? msg.frame - 1 : 0) & 0xFF;
                this.cpu.a = songIndex;
                this.cpu.x = songIndex;
                this.cpu.y = 0;
                this.cpu.p &= ~1;
                
                this.cpu.jsr(this.initAddress);
                
                this.temperature = 55.0;
                this.cycleAccumulator = 0.0;
                this.vblankCycles = 19705;
                this.cpu.isIdle = true;
                this.currentFrame = 0;
                this.maxFrames = msg.length || 7500;
            }
        };
    }

    process(inputs, outputs) {
        const outL = outputs[0][0];
        const outR = outputs[0].length > 1 ? outputs[0][1] : null;
        let visualValue = 0;

        for (let i = 0; i < outL.length; i++) {
            if (!this.isPlaying) {
                outL[i] = 0; if (outR) outR[i] = 0;
                continue; 
            }
            
            // === NATIVE HIGH-PERFORMANCE CYCLE-EXACT LOCKSTEP ENGINE ===
            let cyclesToRun = 0;
            if (this.isPlaying && this.playAddress > 0) {
                this.cycleAccumulator += this.clock / sampleRate;
                cyclesToRun = Math.floor(this.cycleAccumulator);
                this.cycleAccumulator -= cyclesToRun;

                if (this.useCiaTimer) {
                    this.cpu.ciaTimerA -= cyclesToRun;
                    if (this.cpu.ciaTimerA <= 0) {
                        let timerPeriod = (this.cpu.ram[0xDC05] << 8) | this.cpu.ram[0xDC04];
                        if (timerPeriod === 0) timerPeriod = 19583; // fallback
                        this.cpu.ciaTimerA += timerPeriod;
                        
                        // Interrupt nur auslösen, wenn die CPU bereit ist (verhindert Stack-Overflows)
                        if (this.cpu.isIdle) {
                            this.cpu.isIdle = false;
                            if (this.isIrqRoutine) {
                                // Für RTI-Interrupts: Push PC-High, PC-Low und STATUS (P)
                                this.cpu.push(0xFF);
                                this.cpu.push(0xFE);
                                this.cpu.push(this.cpu.p); 
                            } else {
                                // Für RTS-Routinen: Push PC-High und PC-Low
                                this.cpu.push(0xFF);
                                this.cpu.push(0xFE);
                            }
                            this.cpu.pc = this.playAddress;
                            this.currentFrame = (this.currentFrame + 1) % this.maxFrames;
                        }
                    }
                } else {
                    this.vblankCycles -= cyclesToRun;
                    if (this.vblankCycles <= 0) {
                        this.vblankCycles += 19705; 
                        
                        if (this.cpu.isIdle) {
                            this.cpu.isIdle = false;
                            if (this.isIrqRoutine) {
                                this.cpu.push(0xFF);
                                this.cpu.push(0xFE);
                                this.cpu.push(this.cpu.p); 
                            } else {
                                this.cpu.push(0xFF);
                                this.cpu.push(0xFE);
                            }
                            this.cpu.pc = this.playAddress;
                            this.currentFrame = (this.currentFrame + 1) % this.maxFrames;
                        }
                    }
                }

                let remainingCycles = cyclesToRun;
                while (remainingCycles > 0) {
                    if (!this.cpu.isIdle) {
                        let cyclesUsed = this.cpu.step();
                        remainingCycles -= cyclesUsed;
                        
                        // RTI (Return from Interrupt) springt auf 0xFFFE zurück, RTS (Return from Subroutine) auf 0xFFFF
                        if (this.cpu.pc === 0xFFFE || this.cpu.pc === 0xFFFF) {
                            this.cpu.isIdle = true; 
                        }
                    } else {
                        remainingCycles = 0; 
                    }
                }
            }

            let mix = 0;
            for (let v = 0; v < 3; v++) {
                let voiceOut = this.sid.synthesizeVoice(v, this.clock, sampleRate, cyclesToRun);
                
                if (this.sid.regs[23] & (1 << v)) {
                    let cutoffReg = (this.sid.regs[21] & 7) | (this.sid.regs[22] << 3);
                    let norm = cutoffReg / 2047.0;
                    let baseCutoff = 220.0 + Math.pow(norm, 1.4) * 11500.0;

                    let thermalCoefficient = 1.0 - (this.temperature - 55.0) * 0.0035;
                    let activeCutoff = baseCutoff * thermalCoefficient;
                    if (activeCutoff < 30) activeCutoff = 30;
                    if (activeCutoff > 16000) activeCutoff = 16000;

                    let g = Math.tan(Math.PI * activeCutoff / sampleRate);
                    
                    let resReg = this.sid.regs[23] >> 4;
                    let normRes = resReg / 15.0;
                    let q = 1.0 - normRes * 0.92;
                    let thermalDamp = 1.0 + (this.temperature - 55.0) * 0.0015;
                    q = Math.min(1.0, Math.max(0.04, q * thermalDamp));

                    let h = voiceOut - this.sid.filterLow;
                    let hp = (h - q * this.sid.filterBand) / (1.0 + g * (g + q));
                    let bp = this.sid.filterBand + g * hp;
                    let lp = this.sid.filterLow + g * bp;
                    
                    this.sid.filterLow = lp;
                    this.sid.filterBand = bp / (1.0 + Math.abs(bp) * 0.15); 
                    
                    if (this.sid.filterBand > 3.0) this.sid.filterBand = 3.0;
                    if (this.sid.filterBand < -3.0) this.sid.filterBand = -3.0;
                    if (this.sid.filterLow > 3.0) this.sid.filterLow = 3.0;
                    if (this.sid.filterLow < -3.0) this.sid.filterLow = -3.0;
                    
                    let filterOut = 0;
                    if (this.sid.filterMode & 16) filterOut += this.sid.filterLow; 
                    if (this.sid.filterMode & 32) filterOut += this.sid.filterBand; 
                    if (this.sid.filterMode & 64) filterOut += hp; 
                    
                    let leakage = voiceOut * 0.11;
                    voiceOut = filterOut + leakage;
                }
                mix += voiceOut;
            }

            let finalOut = (mix / 3.0) * this.sid.masterVol;
            finalOut = this.dcBlock.process(finalOut);

            outL[i] = finalOut;
            if (outR) outR[i] = finalOut;
            if (i === 0) visualValue = finalOut;
        }

        this.visCounter = (this.visCounter || 0) + 1;
        if (this.visCounter % 4 === 0) {
            let isAudible = Math.abs(visualValue) > 0.001;
            if (isAudible || this.wasAudible) {
                const view = this.visualView;
                view[0] = 0; 
                view[1] = this.isPlaying ? 1 : 0;
                view[2] = this.currentFrame;
                view[3] = visualValue;

                for (let r = 0; r < 29; r++) {
                    view[4 + r] = this.sid.regs[r];
                }

                view[33] = this.temperature;
                this.port.postMessage(view);
            }
            this.wasAudible = isAudible;
        }
        return true;
    }
}

registerProcessor('sid-processor', SIDProcessor);