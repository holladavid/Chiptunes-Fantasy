// === js/worklets/c64/sid-exact.js ===
// =========================================================
// MOS TECHNOLOGY SID 6581 AUDIO WORKLET PROCESSOR
// High-Fidelity Cycle-Exact Lockstep Mischer
// Studio-Grade Polyphase Sinc-FIR Decimator (Zero Aliasing)
// =========================================================

import { CPU6502 } from '../lib/cpu6502.js';
import { SIDChip } from '../lib/sid-chip.js';
import { DCBlocker } from '../lib/dsp-utils.js';

class SIDProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.clock = 985248; // PAL C64 Clock
        this.sid = new SIDChip();
        
        // Aktiviere die authentische analoge JFET-Sättigung für den Exact-Core
        this.sid.useJfetSaturation = true;
        
        this.cpu = new CPU6502(this.sid);
        this.dcBlock = new DCBlocker();

        this.trackData = null;
        this.isPlaying = false;
        
        this.cycleAccumulator = 0.0;
        this.vblankCycles = 19705; 
        this.currentFrame = 0;
        
        this.initAddress = 0;
        this.playAddress = 0;
        this.useCiaTimer = false; 
        this.isIrqRoutine = false; 

        this.temperature = 55.0;
        this.cpuCyclesRemaining = 0;
        
        // =========================================================
        // DSP UPGRADE: 255-TAP POLYPHASE SINC-FIR DECIMATOR
        // =========================================================
        this.FIR_TAPS = 255;
        this.firKernel = new Float32Array(this.FIR_TAPS);
        
        // Wir nutzen eine Zweierpotenz (512) für den Ringpuffer, um mit Bitwise-AND maskieren zu können (schneller als Modulo)
        this.ringBuffer = new Float32Array(512); 
        this.ringIndex = 0;
        
        // Cutoff bei 12.5 kHz simuliert den C64 Motherboard Kondensator
        // und wirkt gleichzeitig als Brickwall Anti-Aliasing Filter für das Downsampling
        let fc = 12500.0 / this.clock; 
        let sum = 0;
        
        // Konstruktion des Blackman-Windowed Sinc-Kernels
        for (let i = 0; i < this.FIR_TAPS; i++) {
            let x = i - (this.FIR_TAPS - 1) / 2;
            let sinc = (x === 0) ? (2 * Math.PI * fc) : Math.sin(2 * Math.PI * fc * x) / x;
            // Blackman Window für exzellente Stopband Attenuation (ca. -74dB)
            let window = 0.42 - 0.5 * Math.cos(2 * Math.PI * i / (this.FIR_TAPS - 1)) + 0.08 * Math.cos(4 * Math.PI * i / (this.FIR_TAPS - 1));
            
            this.firKernel[i] = sinc * window;
            sum += this.firKernel[i];
        }
        
        // Normalisierung für Unity Gain (0 dB)
        for (let i = 0; i < this.FIR_TAPS; i++) {
            this.firKernel[i] /= sum; 
        }

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

                // KORREKTUR: Wir erzeugen eine frische, saubere SIDChip-Instanz (wie im Standard-Core),
                // um Ghost-Register zu killen und das Temperatur-Setting sauber zu vererben!
                this.sid = new SIDChip();
                this.sid.useJfetSaturation = true;
                this.sid.temperature = this.temperature; 
                this.cpu = new CPU6502(this.sid);

                this.cpu.reset(msg.loadAddress, msg.c64Code);

                this.initAddress = msg.initAddress;
                this.playAddress = msg.playAddress;
                this.isIrqRoutine = false; 
                
                let songIndex = (msg.startSong > 0 ? msg.startSong - 1 : 0) & 0xFF;
                this.cpu.a = songIndex;
                this.cpu.x = songIndex; 
                this.cpu.y = 0;
                this.cpu.p &= ~1;
                
                this.useCiaTimer = ((msg.speed >> songIndex) & 1) !== 0;
                this.cpu.jsr(this.initAddress); 
                this.isIrqRoutine = false;

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

                this.cycleAccumulator = 0.0;
                this.vblankCycles = 19705;
                this.cpuCyclesRemaining = 0;
                this.cpu.isIdle = true;

                this.currentFrame = 0;
                this.maxFrames = msg.length || 7500;
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
                
                let songIndex = (msg.frame > 0 ? msg.frame - 1 : 0) & 0xFF;
                this.cpu.a = songIndex;
                this.cpu.x = songIndex;
                this.cpu.y = 0;
                this.cpu.p &= ~1;
                
                this.cpu.jsr(this.initAddress);
                
                this.cycleAccumulator = 0.0;
                this.vblankCycles = 19705;
                this.cpuCyclesRemaining = 0;
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
            
            let cyclesToRun = 0;
            if (this.isPlaying && this.playAddress > 0) {
                this.cycleAccumulator += this.clock / sampleRate;
                cyclesToRun = Math.floor(this.cycleAccumulator);
                this.cycleAccumulator -= cyclesToRun;

                // --- THE NATIVE CYCLE-EXACT LOCKSTEP LOOP (1 MHz) ---
                for (let c = 0; c < cyclesToRun; c++) {
                    
                    if (this.useCiaTimer) {
                        this.cpu.ciaTimerA--;
                        if (this.cpu.ciaTimerA <= 0) {
                            let timerPeriod = (this.cpu.ram[0xDC05] << 8) | this.cpu.ram[0xDC04];
                            if (timerPeriod === 0) timerPeriod = 19583; 
                            this.cpu.ciaTimerA += timerPeriod;
                            
                            if (this.cpu.isIdle) {
                                this.cpu.isIdle = false;
                                if (this.isIrqRoutine) {
                                    this.cpu.push(0xFF); this.cpu.push(0xFE); this.cpu.push(this.cpu.p); 
                                } else {
                                    this.cpu.push(0xFF); this.cpu.push(0xFE);
                                }
                                this.cpu.pc = this.playAddress;
                                this.currentFrame = (this.currentFrame + 1) % this.maxFrames;
                            }
                        }
                    } else {
                        this.vblankCycles--;
                        if (this.vblankCycles <= 0) {
                            this.vblankCycles += 19705; 
                            
                            if (this.cpu.isIdle) {
                                this.cpu.isIdle = false;
                                if (this.isIrqRoutine) {
                                    this.cpu.push(0xFF); this.cpu.push(0xFE); this.cpu.push(this.cpu.p); 
                                } else {
                                    this.cpu.push(0xFF); this.cpu.push(0xFE);
                                }
                                this.cpu.pc = this.playAddress;
                                this.currentFrame = (this.currentFrame + 1) % this.maxFrames;
                            }
                        }
                    }

                    if (this.cpuCyclesRemaining <= 0) {
                        if (!this.cpu.isIdle) {
                            let cyclesUsed = this.cpu.step();
                            this.cpuCyclesRemaining += cyclesUsed;
                            if (this.cpu.pc === 0xFFFE || this.cpu.pc === 0xFFFF) {
                                this.cpu.isIdle = true; 
                            }
                        }
                    }
                    if (this.cpuCyclesRemaining > 0) {
                        this.cpuCyclesRemaining--;
                    }
                    
                    this.sid.clock();
                    
                    // Rohes 1-MHz Signal in den Ringpuffer schreiben (Keine teure IIR-Berechnung hier!)
                    this.ringBuffer[this.ringIndex] = this.sid.outputSample;
                    this.ringIndex = (this.ringIndex + 1) & 511; // 512 Wrap-around Mask
                }
                
                // --- THE POLYPHASE DECIMATION STAGE (48 kHz) ---
                // Faltung des 1-MHz Verlaufs mit unserem Sinc-Kernel
                let decimationSum = 0;
                for (let k = 0; k < this.FIR_TAPS; k++) {
                    // Rückwärtslesen ab dem letzten geschriebenen Index
                    let readIdx = (this.ringIndex - 1 - k + 512) & 511;
                    decimationSum += this.ringBuffer[readIdx] * this.firKernel[k];
                }
                
                // DC Offset entfernen und final rausschicken
                let finalSample = this.dcBlock.process(decimationSum);

                outL[i] = finalSample;
                if (outR) outR[i] = finalSample;
                if (i === 0) visualValue = finalSample;
            }
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

                for (let v = 0; v < 3; v++) {
                    view[34 + v] = this.sid.voices[v].envelope_counter / 255.0;
                }
                view[37] = 0.0;

                this.port.postMessage(view);
            }
            this.wasAudible = isAudible;
        }
        return true;
    }
}

registerProcessor('sid-exact-processor', SIDProcessor);