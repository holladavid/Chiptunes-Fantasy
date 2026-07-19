import { CPU6502 } from '../lib/cpu6502.js';
import { SIDChip } from '../lib/sid-chip.js';
import { DCBlocker } from '../lib/dsp-utils.js';

class SIDProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.clock = 985248; 
        this.sid = new SIDChip();
        
        this.sid.useJfetSaturation = true;
        this.cpu = new CPU6502(this.sid);
        this.dcBlock = new DCBlocker();

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
                
                this.cpu.push(0xEF); 
                this.cpu.push(0xFE); 
                this.cpu.pc = this.initAddress;

                let safety = 5000000;
                while (this.cpu.pc !== 0xEFFF && safety-- > 0) {
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
                
                this.cpu.pc = 0xEFFF; 
                this.cpu.p &= ~0x04;  

                this.playAddress = msg.playAddress;

                this.useCiaTimer = ((this.songSpeedFlags >> songIndex) & 1) !== 0;
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
                
                this.cpu.push(0xEF); 
                this.cpu.push(0xFE); 
                this.cpu.pc = this.initAddress;
                
                let safety = 5000000;
                while (this.cpu.pc !== 0xEFFF && safety-- > 0) {
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
                this.cpu.pc = 0xEFFF; 
                this.cpu.p &= ~0x04;
                
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

    process(inputs, outputs) {
        const outL = outputs[0][0];
        const outR = outputs[0].length > 1 ? outputs[0][1] : null;
        let visualValue = 0;

        let irqHijacked = false;
        let vicIrqEnabled = false;
        let cia1TimerAEnabled = false;
        let isSelfDriving = false;

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
                
                this.cpu.clockHardware(1); 
                this.sid.clock();          
                
                irqHijacked = (this.cpu.ram[0x0314] !== this.cpu.defaultIrqLo) || (this.cpu.ram[0x0315] !== this.cpu.defaultIrqHi);
                vicIrqEnabled = (this.cpu.ram[0xD01A] & 0x01) !== 0;
                cia1TimerAEnabled = (this.cpu.cia1IrqMask & 0x01) !== 0;
                isSelfDriving = irqHijacked && (vicIrqEnabled || cia1TimerAEnabled);

                if (!this.useCiaTimer) {
                    this.vblankTimer--;
                    if (this.vblankTimer <= 0) {
                        this.vblankTimer += this.playSpeedCycles;
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
                    
                    if (this.cpu.cia1TimerAUnderflowed) {
                        this.cpu.cia1TimerAUnderflowed = false;
                        if (this.playAddress !== 0) {
                            this.hostPlayPending = true;
                        }
                    }
                }

                if (this.cpuCyclesRemaining === 1) {
                    this.cpu.irqAccepted = this.cpu.irqPending && (this.cpu.p & 0x04) === 0;
                    this.cpu.nmiAccepted = this.cpu.nmiPending;
                }

                if (!this.cpu.rdy) {
                    // CPU stall
                } else {
                    if (this.cpuCyclesRemaining <= 0) {
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
                
                this.ringBuffer[this.ringIndex] = this.sid.outputSample;
                this.ringIndex = (this.ringIndex + 1) & 511; 
            }
            
            // --- DECIMATION ---
            let decimationSum = 0;
            for (let k = 0; k < this.FIR_TAPS; k++) {
                let readIdx = (this.ringIndex - 1 - k + 512) & 511;
                decimationSum += this.ringBuffer[readIdx] * this.firKernel[k];
            }
            
            // --- REIN RECHTLINIGER DC-BLOCKER ---
            // Da die Wiggle-Erkennung nun vollkommen autonom und extrem hochauflösend
            // in der 1-MHz-Schleife der sid-chip.js arbeitet, läuft der DC-Blocker 
            // im Wrapper wieder absolut standardkonform und stabil.
            let finalSample = this.dcBlock.process(decimationSum);

            outL[i] = finalSample;
            if (outR) outR[i] = finalSample;
            if (i === 0) visualValue = finalSample;
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