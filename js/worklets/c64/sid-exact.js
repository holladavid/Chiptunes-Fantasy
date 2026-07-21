// === js/worklets/c64/sid-exact.js ===
import { CPU6502 } from '../lib/cpu6502.js';
import { SIDChip } from '../lib/sid-chip.js';
import { DCBlocker, C64AnalogFilter } from '../lib/dsp-utils.js';

class SIDProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.clock = 985248; 
        this.sid = new SIDChip();
        
        this.sid.useJfetSaturation = true;
        this.cpu = new CPU6502(this.sid);
        this.dcBlock = new DCBlocker();
        this.c64Output = new C64AnalogFilter(sampleRate);

        this.prgCode = null;
        this.loadAddr = 0;
        this.initAddress = 0;
        this.playAddress = 0;
        this.playSpeedCycles = 19705; 
        this.songSpeedFlags = 0;
        
        this.isPlaying = false;
        
        this.cycleAccumulator = 0.0;
        this.vblankTimer = 19705; 
        this.currentFrame = 0;
        this.hostPlayPending = false;
        
        this.temperature = 55.0;
        this.cpuCyclesRemaining = 0;
        this.lastSampleValue = 0;
        
        this.visualView = new Float32Array(40);

        this.diagCycles = 0;
        this.diagInstructions = 0;
        this.diagTimer = 0.0;
        this.diagIrqCount = 0;
        this.diagNmiCount = 0;

        this.port.onmessage = (e) => {
            const msg = e.data;
            
            if (msg.type === 'SET_TEMPERATURE') {
                this.temperature = Math.min(75, Math.max(15, msg.value));
                this.sid.temperature = this.temperature; 
                return;
            }

            if (msg.isSidFile) {
                this.c64Output = new C64AnalogFilter(sampleRate);
                this.dcBlock = new DCBlocker();
                this.lastSampleValue = 0;

                this.prgCode = msg.c64Code;
                this.loadAddr = msg.loadAddress;
                this.initAddress = msg.initAddress;
                this.playAddress = msg.playAddress;
                this.songSpeedFlags = msg.speed; 

                this.sid = new SIDChip();
                this.sid.useJfetSaturation = true;
                this.sid.temperature = this.temperature; 
                this.cpu = new CPU6502(this.sid);

                this.cpu.reset(this.loadAddr, this.prgCode, this.initAddress, this.playAddress);

                let songIndex = (msg.startSong > 0 ? msg.startSong - 1 : 0) & 0xFF;
                this.cpu.a = songIndex;
                this.cpu.x = songIndex; 
                this.cpu.y = 0;
                
                this.cpu.push(0xFF); 
                this.cpu.push(0xDF); 
                this.cpu.pc = this.initAddress;

                // 2 Mio Zyklen Safety Guard für schwere Exomizer-Entpacker
                let initSafety = 2000000; 
                while (this.cpu.pc !== 0xFFE0 && initSafety > 0) {
                    initSafety--;
                    this.cpu.clockHardware(1);
                    this.sid.clock();
                    
                    if (this.cpuCyclesRemaining === 1) {
                        this.cpu.irqAccepted = this.cpu.irqPending && (this.cpu.p & 0x04) === 0;
                        this.cpu.nmiAccepted = this.cpu.nmiPending;
                    }

                    if (this.cpu.rdy && this.cpuCyclesRemaining <= 0) {
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
                    } else if (this.cpu.rdy) {
                        this.cpuCyclesRemaining--;
                    }
                }
                
                this.cpu.pc = 0xFFE0; 
                this.cpu.p &= ~0x04;  

                this.useCiaTimer = ((this.songSpeedFlags >> songIndex) & 1) !== 0;
                if (this.useCiaTimer) {
                    this.cpu.cia1CtrlA |= 0x01; 
                }

                this.playSpeedCycles = this.useCiaTimer ? 19583 : 19705;
                this.vblankTimer = this.playSpeedCycles;

                let bootMsg = `==================================================\n` +
                              `[LAB-BOOT] Core: ${this.constructor.name}\n` +
                              `[LAB-BOOT] Subsong-Index: ${songIndex} | Address-Range: $${this.loadAddr.toString(16).toUpperCase()} - $${(this.loadAddr + this.prgCode.length).toString(16).toUpperCase()}\n` +
                              `[LAB-BOOT] Play-Address: $${this.playAddress.toString(16).toUpperCase()}\n` +
                              `[LAB-BOOT] Vector $0314 (IRQ): $${this.cpu.ram[0x0314].toString(16).toUpperCase().padStart(2, '0')}${this.cpu.ram[0x0315].toString(16).toUpperCase().padStart(2, '0')}\n` +
                              `[LAB-BOOT] Vector $0318 (NMI): $${this.cpu.ram[0x0318].toString(16).toUpperCase().padStart(2, '0')}${this.cpu.ram[0x0319].toString(16).toUpperCase().padStart(2, '0')}\n` +
                              `[LAB-BOOT] VIC Mask $D01A: $${this.cpu.ram[0xD01A].toString(16).toUpperCase()} | CIA-1 Mask $DC0D: $${this.cpu.cia1IrqMask.toString(16).toUpperCase()}\n` +
                              `[LAB-BOOT] Speedflags: %${this.songSpeedFlags.toString(2)} | useCiaTimer: ${this.useCiaTimer}\n` +
                              `==================================================`;
                this.port.postMessage({ type: 'LAB_LOG', msg: bootMsg });

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
                this.c64Output = new C64AnalogFilter(sampleRate);
                this.dcBlock = new DCBlocker();
                this.lastSampleValue = 0;

                this.sid = new SIDChip();
                this.sid.useJfetSaturation = true;
                this.sid.temperature = this.temperature;
                this.cpu.sid = this.sid;
                
                this.cpu.reset(this.loadAddr, this.prgCode, this.initAddress, this.playAddress);
                
                let songIndex = (msg.frame > 0 ? msg.frame - 1 : 0) & 0xFF;
                this.cpu.a = songIndex;
                this.cpu.x = songIndex;
                this.cpu.y = 0;
                
                this.cpu.push(0xFF); 
                this.cpu.push(0xDF); 
                this.cpu.pc = this.initAddress;
                
                let initSafety = 2000000;
                while (this.cpu.pc !== 0xFFE0 && initSafety > 0) {
                    initSafety--;
                    this.cpu.clockHardware(1);
                    this.sid.clock();
                    
                    if (this.cpuCyclesRemaining === 1) {
                        this.cpu.irqAccepted = this.cpu.irqPending && (this.cpu.p & 0x04) === 0;
                        this.cpu.nmiAccepted = this.cpu.nmiPending;
                    }

                    if (this.cpu.rdy && this.cpuCyclesRemaining <= 0) {
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
                    } else if (this.cpu.rdy) {
                        this.cpuCyclesRemaining--;
                    }
                }

                this.cpu.pc = 0xFFE0; 
                this.cpu.p &= ~0x04;
                
                this.useCiaTimer = ((this.songSpeedFlags >> songIndex) & 1) !== 0;
                if (this.useCiaTimer) {
                    this.cpu.cia1CtrlA |= 0x01; 
                }
                
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
                this.diagCycles++; 
                
                this.cpu.clockHardware(1); 
                this.sid.clock();          
                
                sampleSum += this.sid.outputSample;

                // --- FIX: VBLANK / CIA TIMER MANAGEMENT GEHÖRT IN DEN 1-MHZ CYCLE LOOP! ---
                if (this.playAddress === 0) {
                    this.vblankTimer--;
                    if (this.vblankTimer <= 0) {
                        this.vblankTimer += this.playSpeedCycles;
                        this.currentFrame = (this.currentFrame + 1) % this.maxFrames;
                    }
                } else {
                    if (!this.useCiaTimer) {
                        this.vblankTimer--;
                        if (this.vblankTimer <= 0) {
                            this.vblankTimer += this.playSpeedCycles;
                            this.hostPlayPending = true;
                        }
                    } else {
                        if (this.cpu.cia1TimerAUnderflowed) {
                            this.cpu.cia1TimerAUnderflowed = false;
                            this.hostPlayPending = true;
                        }
                    }
                }

                if (this.cpu.irqAccepted && this.cpuCyclesRemaining === 0) this.diagIrqCount++;
                if (this.cpu.nmiAccepted && this.cpuCyclesRemaining === 0) this.diagNmiCount++;

                if (this.cpuCyclesRemaining === 1) {
                    this.cpu.irqAccepted = this.cpu.irqPending && (this.cpu.p & 0x04) === 0;
                    this.cpu.nmiAccepted = this.cpu.nmiPending;
                }

                if (!this.cpu.rdy) {
                    // CPU stall
                } else {
                    if (this.cpuCyclesRemaining <= 0) {
                        // Safe Dispatch an der Idle-Schleife ($FFE0)
                        if (this.hostPlayPending && this.cpu.pc >= 0xFFE0 && this.cpu.pc <= 0xFFE2) {
                            this.hostPlayPending = false;
                            this.cpu.push(0xFF);
                            this.cpu.push(0xDF); 
                            this.cpu.pc = this.playAddress;
                            this.cpuCyclesRemaining = 6 - 1; 
                            this.currentFrame = (this.currentFrame + 1) % this.maxFrames; 
                            this.diagInstructions++;
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
                            this.diagInstructions++; 
                        }
                    } else {
                        this.cpuCyclesRemaining--;
                    }
                }
            }
            
            // --- BOXCAR DECIMATION (Integrate & Dump) ---
            let decimatedSample = cyclesToRun > 0 ? sampleSum / cyclesToRun : this.lastSampleValue;
            this.lastSampleValue = decimatedSample;

            // Analog Output Filter (16 kHz Butterworth pass)
            let analogSample = this.c64Output.process(decimatedSample);

            // DC Blocker (R=0.998 fängt das 400mV Bias ab)
            let finalSample = analogSample - this.dcBlock.lastIn + 0.998 * this.dcBlock.lastOut;
            this.dcBlock.lastIn = analogSample;
            this.dcBlock.lastOut = finalSample;

            outL[i] = finalSample;
            if (outR) outR[i] = finalSample;
            if (i === 0) visualValue = finalSample;
        }

        this.diagTimer += outL.length / sampleRate;
        if (this.diagTimer >= 1.0) {
            this.diagTimer -= 1.0;
            
            let activeRegs = Array.from(this.sid.regs).map(r => r.toString(16).toUpperCase().padStart(2, '0')).join(' ');
            
            let runtimeMsg = `--- [LAB-RUNTIME DIAGNOSTICS] ---\n` +
                             `[STATUS] Frame: ${this.currentFrame} | IsPlaying: ${this.isPlaying}\n` +
                             `[CPU] PC: $${this.cpu.pc.toString(16).toUpperCase().padStart(4, '0')} | SP: $${this.cpu.sp.toString(16).toUpperCase().padStart(2, '0')} | P: $${this.cpu.p.toString(16).toUpperCase().padStart(2, '0')}\n` +
                             `[CPU] Instructions/sec: ${this.diagInstructions} | Cycles/sec: ${this.diagCycles}\n` +
                             `[IRQ] Pending: ${this.cpu.irqPending} | Accepted: ${this.cpu.irqAccepted} | Count/sec: ${this.diagIrqCount}\n` +
                             `[NMI] Pending: ${this.cpu.nmiPending} | Accepted: ${this.cpu.nmiAccepted} | Count/sec: ${this.diagNmiCount}\n` +
                             `[VECTORS] $0314 (IRQ): $${this.cpu.ram[0x0314].toString(16).toUpperCase().padStart(2, '0')}${this.cpu.ram[0x0315].toString(16).toUpperCase().padStart(2, '0')}\n` +
                             `[TIMERS] CIA1-TimerA: ${this.cpu.cia1TimerA} | Latch: ${this.cpu.cia1TimerALatch} | CtrlA: $${this.cpu.cia1CtrlA.toString(16).toUpperCase().padStart(2, '0')}\n` +
                             `[TIMERS] VIC-Raster: ${this.cpu.rasterCounter} | Target: ${this.cpu.rasterIrqTarget} | Enabled: ${this.cpu.ram[0xD01A]}\n` +
                             `[SID REGS] $D400: ${activeRegs}\n` +
                             `---------------------------------`;
            this.port.postMessage({ type: 'LAB_LOG', msg: runtimeMsg });
            
            this.diagCycles = 0;
            this.diagInstructions = 0;
            this.diagIrqCount = 0;
            this.diagNmiCount = 0;
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