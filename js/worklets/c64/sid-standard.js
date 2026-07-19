// === js/worklets/c64/sid-standard.js ===
// =========================================================
// MOS TECHNOLOGY SID 6581 AUDIO WORKLET PROCESSOR
// CPU-Optimized 1MHz Lockstep Core with Boxcar Decimation
// Phase 9: True Lockstep Main Event Loop
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
                    let c = this.cpu.step();
                    this.cpu.clockHardware(c);
                }
                this.cpu.pc = 0xEA31; 
                this.cpu.p &= ~0x04; 

                this.playAddress = msg.playAddress;
                if (this.playAddress === 0) {
                    this.playAddress = this.cpu.read(0x0314) | (this.cpu.read(0x0315) << 8); 
                    if (this.playAddress === 0 || this.playAddress === 0xFFFF || this.playAddress === 0xEA31) {
                        this.playAddress = 0; 
                    }
                }

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
                
                let songIndex = (msg.frame > 0 ? msg.frame - 1 : 0) & 0xFF;
                this.cpu.a = songIndex;
                this.cpu.x = songIndex;
                this.cpu.y = 0;
                
                this.cpu.push(0xEA);
                this.cpu.push(0x30);
                this.cpu.pc = this.initAddress;
                
                let safety = 5000000;
                while (this.cpu.pc !== 0xEA31 && safety-- > 0) {
                    let c = this.cpu.step();
                    this.cpu.clockHardware(c);
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
            for (let c = 0; c < cyclesToRun; c++) {
                
                this.vblankTimer--;
                if (this.vblankTimer <= 0) {
                    this.vblankTimer += this.playSpeedCycles;
                    
                    if (this.playAddress !== 0) {
                        if (this.cpu.pc === 0xEA31) { 
                            this.cpu.push(0xEA);
                            this.cpu.push(0x30);
                            this.cpu.pc = this.playAddress;
                        }
                    }
                    this.currentFrame = (this.currentFrame + 1) % this.maxFrames;
                }

                if (this.cpuCyclesRemaining <= 0) {
                    if (this.cpu.pc !== 0xEA31 || this.cpu.irqPending || this.cpu.nmiPending) {
                        let cyclesUsed = this.cpu.step();
                        this.cpu.clockHardware(cyclesUsed);
                        this.cpuCyclesRemaining = cyclesUsed;
                    } else {
                        this.cpu.clockHardware(1);
                        this.cpuCyclesRemaining = 1;
                    }
                }
                this.cpuCyclesRemaining--;

                this.sid.clock();
                sampleSum += this.sid.outputSample;
            }
            
            let finalSample = cyclesToRun > 0 ? sampleSum / cyclesToRun : this.lastSampleValue;
            this.lastSampleValue = finalSample;
            
            finalSample = this.dcBlock.process(finalSample);

            this.outLp += 0.65 * (finalSample - this.outLp);
            finalSample = this.outLp;

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

registerProcessor('sid-standard-processor', SIDProcessor);