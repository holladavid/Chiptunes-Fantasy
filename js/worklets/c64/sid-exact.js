// === js/worklets/c64/sid-exact.js ===
// =========================================================
// MOS TECHNOLOGY SID 6581 AUDIO WORKLET PROCESSOR
// High-Fidelity Cycle-Exact Lockstep Mischer
// Studio-Grade Polyphase Sinc-FIR Decimator (Zero Aliasing)
// Phase 11: True 1MHz Micro-Stepping & Badline Timing Support (Step 1)
// =========================================================

import { CPU6502 } from '../lib/cpu6502.js';
import { SIDChip } from '../lib/sid-chip.js';
import { DCBlocker } from '../lib/dsp-utils.js';

class SIDProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.clock = 985248; // PAL C64 Clock
        this.sid = new SIDChip();
        
        this.sid.useJfetSaturation = true;
        this.cpu = new CPU6502(this.sid);
        this.dcBlock = new DCBlocker();

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
        
        this.FIR_TAPS = 255;
        this.firKernel = new Float32Array(this.FIR_TAPS);
        this.ringBuffer = new Float32Array(512); 
        this.ringIndex = 0;
        
        let fc = 12500.0 / this.clock; 
        let sum = 0;
        
        for (let i = 0; i < this.FIR_TAPS; i++) {
            let x = i - (this.FIR_TAPS - 1) / 2;
            let sinc = (x === 0) ? (2 * Math.PI * fc) : Math.sin(2 * Math.PI * fc * x) / x;
            let window = 0.42 - 0.5 * Math.cos(2 * Math.PI * i / (this.FIR_TAPS - 1)) + 0.08 * Math.cos(4 * Math.PI * i / (this.FIR_TAPS - 1));
            this.firKernel[i] = sinc * window;
            sum += this.firKernel[i];
        }
        for (let i = 0; i < this.FIR_TAPS; i++) this.firKernel[i] /= sum; 

        this.visualView = new Float32Array(40);

        this.port.onmessage = (e) => {
            const msg = e.data;
            
            if (msg.type === 'SET_TEMPERATURE') {
                this.temperature = Math.min(75, Math.max(15, msg.value));
                this.sid.temperature = this.temperature; 
                return;
            }

            if (msg.isSidFile) {
                this.ringBuffer.fill(0);
                this.ringIndex = 0;
                this.dcBlock = new DCBlocker();

                this.prgCode = msg.c64Code;
                this.loadAddr = msg.loadAddress;
                this.initAddress = msg.initAddress;
                // --- FIX: Speed-Flags für spätere Subsong-Wechsel speichern! ---
                this.songSpeedFlags = msg.speed; 

                this.sid = new SIDChip();
                this.sid.useJfetSaturation = true;
                this.sid.temperature = this.temperature; 
                this.cpu = new CPU6502(this.sid);

                this.cpu.reset(this.loadAddr, this.prgCode);

                let songIndex = (msg.startSong > 0 ? msg.startSong - 1 : 0) & 0xFF;
                this.cpu.a = songIndex;
                this.cpu.x = songIndex; 
                this.cpu.y = 0;
                
                // Init in die Routine drücken
                this.cpu.push(0xEF); 
                this.cpu.push(0xFE); // Return to $EFFF (Host Idle Loop)
                this.cpu.pc = this.initAddress;

                let safety = 5000000;
                while (this.cpu.pc !== 0xEFFF && safety-- > 0) { // <- Auf $EFFF abfragen!
                    this.cpu.clockHardware(1);
                    this.sid.clock();
                    
                    if (this.cpuCyclesRemaining === 1) {
                        this.cpu.irqAccepted = this.cpu.irqPending && (this.cpu.p & 0x04) === 0;
                        this.cpu.nmiAccepted = this.cpu.nmiPending;
                    }

                    if (!this.cpu.rdy) {
                        // CPU stall
                    } else {
                        if (this.cpuCyclesRemaining <= 0) {
                            if (this.cpu.nmiAccepted) {
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
                
                this.cpu.pc = 0xEA31;
                this.cpu.p &= ~0x04; 

                this.playAddress = msg.playAddress;

                // --- FIX: Nur noch EINE Zuweisung, sauber gekoppelt an die Instanz ---
                this.useCiaTimer = ((this.songSpeedFlags >> songIndex) & 1) !== 0;
                this.playSpeedCycles = this.useCiaTimer ? 19583 : 19705;
                this.vblankTimer = this.playSpeedCycles;

                this.cycleAccumulator = 0.0;
                this.cpuCyclesRemaining = 0;

                this.currentFrame = 0;
                this.maxFrames = msg.length || 7500;
                this.hostPlayPending = false;
                this.isPlaying = true;
                
            } else if (msg.type === 'STOP_TRACK') {
                this.isPlaying = false;
            } else if (msg.type === 'RESUME_TRACK') {
                this.isPlaying = true;
            } else if (msg.type === 'CHANGE_SUBSONG') {
                this.ringBuffer.fill(0);
                this.ringIndex = 0;
                this.dcBlock = new DCBlocker();

                this.sid = new SIDChip();
                this.sid.useJfetSaturation = true;
                this.sid.temperature = this.temperature;
                this.cpu.sid = this.sid;
                
                this.cpu.reset(this.loadAddr, this.prgCode);
                
                let songIndex = (msg.frame > 0 ? msg.frame - 1 : 0) & 0xFF;
                this.cpu.a = songIndex;
                this.cpu.x = songIndex;
                this.cpu.y = 0;
                
                // Init in die Routine drücken
                this.cpu.push(0xEF); 
                this.cpu.push(0xFE); // Return to $EFFF (Host Idle Loop)
                this.cpu.pc = this.initAddress;

                let safety = 5000000;
                while (this.cpu.pc !== 0xEFFF && safety-- > 0) { // <- Auf $EFFF abfragen!
                    this.cpu.clockHardware(1);
                    this.sid.clock();
                    
                    if (this.cpuCyclesRemaining === 1) {
                        this.cpu.irqAccepted = this.cpu.irqPending && (this.cpu.p & 0x04) === 0;
                        this.cpu.nmiAccepted = this.cpu.nmiPending;
                    }

                    if (!this.cpu.rdy) {
                        // CPU stall
                    } else {
                        if (this.cpuCyclesRemaining <= 0) {
                            if (this.cpu.nmiAccepted) {
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
                this.cpu.pc = 0xEFFF; // <- Auf $EFFF zwingen!
                this.cpu.p &= ~0x04;
                
                // --- FIX: Subsong Timer-Update nutzt nun die gespeicherten Flags ---
                this.useCiaTimer = ((this.songSpeedFlags >> songIndex) & 1) !== 0;
                this.playSpeedCycles = this.useCiaTimer ? 19583 : 19705;
                this.vblankTimer = this.playSpeedCycles;

                this.cycleAccumulator = 0.0;
                this.cpuCyclesRemaining = 0;
                
                this.currentFrame = 0;
                this.maxFrames = msg.length || 7500;
                this.hostPlayPending = false;
            }
        };
    }
    // In js/worklets/c64/sid-exact.js:

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

            // --- THE NATIVE CYCLE-EXACT LOCKSTEP LOOP (1 MHz) ---
            for (let c = 0; c < cyclesToRun; c++) {
                
                // 1. Hardware Ticking (Exakt 1 Takt pro Iteration)
                this.cpu.clockHardware(1); 
                this.sid.clock();          
                // In sid-standard.js hier: sampleSum += this.sid.outputSample;
                
                // 2. VBLANK / Host Player Call
                // Wir prüfen, ob der Track die Hardware-Vektoren umgebogen hat. 
                // Wenn ja, feuert die Hardware den Track an. Der Host greift nicht mehr künstlich ein!
                let irqHijacked = (this.cpu.ram[0x0314] !== 0x81) || (this.cpu.ram[0x0315] !== 0xEA) || 
                                  (this.cpu.ram[0xFFFE] !== 0x48) || (this.cpu.ram[0xFFFF] !== 0xFF);
                
                if (!this.useCiaTimer) {
                    this.vblankTimer--;
                    if (this.vblankTimer <= 0) {
                        this.vblankTimer += this.playSpeedCycles;
                        
                        // Injiziere den Host-Call NUR, wenn die Interrupts NICHT gekapert wurden!
                        if (!irqHijacked && this.playAddress !== 0) {
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
                    // CIA-SYNCED HOST CALL: Wizball-Fix! 
                    // Feuert den Player exakt beim Hardware-Underflow des CIA Timers.
                    if (this.cpu.cia1TimerAUnderflowed) {
                        this.cpu.cia1TimerAUnderflowed = false;
                        if (!irqHijacked && this.playAddress !== 0) {
                            this.hostPlayPending = true;
                        }
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
                        // Der Host Play Call injiziert nur noch, wenn die CPU sicher im Host-Idle ist!
                        if (this.hostPlayPending && this.cpu.pc >= 0xEFFF && this.cpu.pc <= 0xF001) {
                            this.hostPlayPending = false;
                            this.cpu.push(0xEF);
                            this.cpu.push(0xFE); 
                            this.cpu.pc = this.playAddress;
                            this.cpuCyclesRemaining = 6 - 1; 
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
                                
                // Schreibe den analogen SID-Spannungswert in den Ringpuffer
                this.ringBuffer[this.ringIndex] = this.sid.outputSample;
                this.ringIndex = (this.ringIndex + 1) & 511; 
            }
            
            // --- THE POLYPHASE DECIMATION STAGE (48 kHz) ---
            let decimationSum = 0;
            for (let k = 0; k < this.FIR_TAPS; k++) {
                let readIdx = (this.ringIndex - 1 - k + 512) & 511;
                decimationSum += this.ringBuffer[readIdx] * this.firKernel[k];
            }
            
            let finalSample = this.dcBlock.process(decimationSum);

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

registerProcessor('sid-exact-processor', SIDProcessor);