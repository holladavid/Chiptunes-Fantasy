// === js/worklets/c64/sid-standard.js ===
// =========================================================
// MOS TECHNOLOGY SID 6581 AUDIO WORKLET PROCESSOR
// CPU-Optimized 1MHz Lockstep Core with Boxcar Decimation
// Phase 11: True 1MHz Micro-Stepping & Badline Timing Support (Step 1)
// =========================================================

import { CPU6502 } from '../lib/cpu6502.js';
import { SIDChip } from '../lib/sid-chip.js';
import { DCBlocker } from '../lib/dsp-utils.js';

class SIDProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.clock = 985248; 
        this.sid = new SIDChip();
        
        this.sid.useJfetSaturation = false;
        this.cpu = new CPU6502(this.sid);
        this.dcBlock = new DCBlocker();
        this.outLp = 0; 

        this.prgCode = null;
        this.loadAddr = 0;
        this.initAddress = 0;
        this.playAddress = 0;
        this.playSpeedCycles = 19705; 

        this.isPlaying = false;
        this.hostPlayPending = false;
        this.cycleAccumulator = 0.0;
        this.vblankTimer = 19705; 
        this.currentFrame = 0;
        
        this.temperature = 55.0;
        this.cpuCyclesRemaining = 0;
        this.lastSampleValue = 0;
        
        this.visualView = new Float32Array(40);

        this.port.onmessage = (e) => {
            const msg = e.data;
            
            if (msg.type === 'SET_TEMPERATURE') {
                this.temperature = Math.min(75, Math.max(15, msg.value));
                this.sid.temperature = this.temperature; 
                return;
            }

            if (msg.isSidFile) {
                this.lastSampleValue = 0;
                this.outLp = 0;
                this.dcBlock = new DCBlocker();
                this.hostPlayPending = false;
                this.prgCode = msg.c64Code;
                this.loadAddr = msg.loadAddress;
                this.initAddress = msg.initAddress;

                this.sid = new SIDChip();
                this.sid.useJfetSaturation = false;
                this.sid.temperature = this.temperature;
                this.cpu = new CPU6502(this.sid);

                this.cpu.reset(this.loadAddr, this.prgCode);

                let songIndex = (msg.startSong > 0 ? msg.startSong - 1 : 0) & 0xFF;
                this.cpu.a = songIndex;
                this.cpu.x = songIndex; 
                this.cpu.y = 0;
                
                this.cpu.push(0xEA);
                this.cpu.push(0x30);
                this.cpu.pc = this.initAddress;

                let safety = 5000000;
                while (this.cpu.pc !== 0xEA31 && safety-- > 0) {
                    this.cpu.clockHardware();
                    this.sid.clock();
                    
                    if (this.cpu.cpuStall > 0) {
                        this.cpu.cpuStall--;
                    } else {
                        if (this.cpuCyclesRemaining <= 0) {
                            let cyclesUsed = this.cpu.step();
                            this.cpuCyclesRemaining = cyclesUsed - 1; 
                        } else {
                            this.cpuCyclesRemaining--;
                        }
                    }
                }
                this.cpu.pc = 0xEA31; 
                this.cpu.p &= ~0x04; 

                this.playAddress = msg.playAddress;

                let useCiaTimer = ((msg.speed >> songIndex) & 1) !== 0;
                this.playSpeedCycles = useCiaTimer ? 19583 : 19705;
                this.vblankTimer = this.playSpeedCycles;

                this.cycleAccumulator = 0.0;
                this.cpuCyclesRemaining = 0;
                
                this.currentFrame = 0;
                this.maxFrames = msg.length || 7500;
                this.isPlaying = true;
            } else if (msg.type === 'STOP_TRACK') {
                this.isPlaying = false;
            } else if (msg.type === 'RESUME_TRACK') {
                this.isPlaying = true;
            } else if (msg.type === 'CHANGE_SUBSONG') {
                this.lastSampleValue = 0;
                this.outLp = 0;
                this.dcBlock = new DCBlocker();

                this.sid = new SIDChip();
                this.sid.useJfetSaturation = false;
                this.sid.temperature = this.temperature;
                this.cpu.sid = this.sid;
                
                this.cpu.reset(this.loadAddr, this.prgCode);
                this.hostPlayPending = false;
                let songIndex = (msg.frame > 0 ? msg.frame - 1 : 0) & 0xFF;
                this.cpu.a = songIndex;
                this.cpu.x = songIndex;
                this.cpu.y = 0;
                
                this.cpu.push(0xEA);
                this.cpu.push(0x30);
                this.cpu.pc = this.initAddress;
                
                let safety = 5000000;
                while (this.cpu.pc !== 0xEA31 && safety-- > 0) {
                    this.cpu.clockHardware();
                    this.sid.clock();
                    
                    if (this.cpu.cpuStall > 0) {
                        this.cpu.cpuStall--;
                    } else {
                        if (this.cpuCyclesRemaining <= 0) {
                            let cyclesUsed = this.cpu.step();
                            this.cpuCyclesRemaining = cyclesUsed - 1; 
                        } else {
                            this.cpuCyclesRemaining--;
                        }
                    }
                }
                this.cpu.pc = 0xEA31;
                this.cpu.p &= ~0x04;
                
                this.vblankTimer = this.playSpeedCycles;
                this.cycleAccumulator = 0.0;
                this.cpuCyclesRemaining = 0;
                this.currentFrame = 0;
                this.maxFrames = msg.length || 7500;
            }
        };
    }

    // In js/worklets/c64/sid-standard.js:
    process(inputs, outputs) {
        const outL = outputs[0][0];
        const outR = outputs[0].length > 1 ? outputs[0][1] : null;
        let visualValue = 0;

        for (let i = 0; i < outL.length; i++) {
            if (!this.isPlaying) {
                outL[i] = 0; if (outR) outR[i] = 0;
                continue; 
            }
            
            this.cycleAccumulator += this.clock / sampleRate;
            let cyclesToRun = Math.floor(this.cycleAccumulator);
            this.cycleAccumulator -= cyclesToRun;

            let sampleSum = 0;

// --- THE NATIVE CYCLE-EXACT LOCKSTEP LOOP (1 MHz) ---
            for (let c = 0; c < cyclesToRun; c++) {
                
                // 1. Hardware Ticking (Exakt 1 Takt pro Iteration)
                this.cpu.clockHardware(1); 
                this.sid.clock();          
                // In sid-standard.js hier: sampleSum += this.sid.outputSample;
                
                // 2. VBLANK / Host Player Call
                if (!this.useCiaTimer) {
                    this.vblankTimer--;
                    if (this.vblankTimer <= 0) {
                        this.vblankTimer += this.playSpeedCycles;
                        // Setze das Pending-Flag, anstatt sofort asynchron einzugreifen!
                        if (this.playAddress !== 0) {
                            this.hostPlayPending = true;
                        }
                        this.currentFrame = (this.currentFrame + 1) % this.maxFrames;
                    }
                } else {
                    this.vblankTimer--;
                    if (this.vblankTimer <= 0) {
                        this.vblankTimer += this.playSpeedCycles;
                        this.currentFrame = (this.currentFrame + 1) % this.maxFrames;
                    }
                }

                // --- SCHRITT 3: IRQ-LATENZ SAMPLING ---
                if (this.cpuCyclesRemaining === 1) {
                    this.cpu.irqAccepted = this.cpu.irqPending && (this.cpu.p & 0x04) === 0;
                    this.cpu.nmiAccepted = this.cpu.nmiPending;
                }

                // 3. CPU Ausführung
                if (!this.cpu.rdy) {
                    // CPU blockiert
                } else {
                    if (this.cpuCyclesRemaining <= 0) {
                        // --- PHASE 12: SYNCHRONISIERTER HOST PLAY CALL ---
                        // Wir injizieren den Play-Call NUR an Opcode-Grenzen und NUR, 
                        // wenn die CPU gerade sicher in der Idle-Schleife ($EA31 bis $EA33) steht!
                        if (this.hostPlayPending && this.cpu.pc >= 0xEA31 && this.cpu.pc <= 0xEA33) {
                            this.hostPlayPending = false;
                            this.cpu.push(0xEA);
                            this.cpu.push(0x30); 
                            this.cpu.pc = this.playAddress;
                            this.cpuCyclesRemaining = 6 - 1; // 6 Zyklen für den JSR-Simulations-Takt
                        } else if (this.cpu.nmiAccepted) {
                            this.cpu.nmiAccepted = false;
                            this.cpu.triggerHardwareNmi();
                            this.cpuCyclesRemaining = 7 - 1; 
                        } else if (this.cpu.irqAccepted) {
                            this.cpu.irqAccepted = false;
                            this.cpu.triggerHardwareIrq();
                            this.cpuCyclesRemaining = 7 - 1;
                        } else {
                            let cyclesUsed = this.cpu.step(); 
                            this.cpuCyclesRemaining = cyclesUsed - 1;
                        }
                    } else {
                        this.cpuCyclesRemaining--;
                    }
                }
            }
            
            // --- BOXCAR DECIMATION (Mittelwert-Bildung) ---
            let finalSample = cyclesToRun > 0 ? sampleSum / cyclesToRun : this.lastSampleValue;
            this.lastSampleValue = finalSample;
            
            finalSample = this.dcBlock.process(finalSample);

            // --- C64 Motherboard Audio Filter (1-Pole RC, ca. 12.5 kHz) ---
            this.outLp += 0.65 * (finalSample - this.outLp);
            finalSample = this.outLp;

            outL[i] = finalSample;
            if (outR) outR[i] = finalSample;
            if (i === 0) visualValue = finalSample;
        }

        // --- VISUALIZATION DATA DISPATCH ---
        this.visCounter = (this.visCounter || 0) + 1;
        if (this.visCounter % 4 === 0) {
            let isAudible = Math.abs(visualValue) > 0.001;
            if (isAudible || this.wasAudible) {
                const view = this.visualView;
                view[0] = 0; 
                view[1] = this.isPlaying ? 1 : 0;
                view[2] = this.currentFrame;
                view[3] = visualValue;

                for (let r = 0; r < 29; r++) view[4 + r] = this.sid.regs[r];
                view[33] = this.temperature;
                for (let v = 0; v < 3; v++) view[34 + v] = this.sid.voices[v].envelope_counter / 255.0;
                view[37] = 0.0;

                this.port.postMessage(view);
            }
            this.wasAudible = isAudible;
        }
        return true;
    }
}

registerProcessor('sid-standard-processor', SIDProcessor);