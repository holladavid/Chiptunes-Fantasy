// === js/worklets/c64/sid-worklet.js ===
// =========================================================
// MOS TECHNOLOGY SID 6581 AUDIO WORKLET PROCESSOR
// With Safe-Cloned Zero-Allocation View & Sub-Sample Phase Alignment
// =========================================================

import { CPU6502 } from '../lib/cpu6502.js';
import { SIDChip } from '../lib/sid-chip.js';

class SIDProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.clock = 985248; // PAL C64 Clock
        this.sid = new SIDChip();
        this.cpu = new CPU6502(this.sid);

        this.trackData = null;
        this.isPlaying = false;
        this.sampleCounter = 0;
        this.currentFrame = 0;
        
        this.initAddress = 0;
        this.playAddress = 0;
        this.useCiaTimer = false; 
        this.isIrqRoutine = false; 

        // Visualizer Zero-Allocation Buffer (Safe Clone)
        this.visualView = new Float32Array(40);

        this.port.onmessage = (e) => {
            const msg = e.data;
            if (msg.isSidFile) {
                this.cpu.reset(msg.loadAddress, msg.c64Code);
                this.initAddress = msg.initAddress;
                this.playAddress = msg.playAddress;
                
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

                this.currentFrame = 0;
                this.sampleCounter = 0;
                
                this.maxFrames = msg.length || 7500;
                this.isPlaying = true;
                
                console.log(`[6502 CPU] Program loaded. Max frames: ${this.maxFrames} | CIA Mode: ${this.useCiaTimer}`);
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
                
                this.currentFrame = 0;
                this.sampleCounter = 0;
                this.maxFrames = msg.length || 7500;
                console.log(`[6502 CPU] Switched Subsong to ${songIndex + 1}. Max frames: ${this.maxFrames}`);
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
            
            if (this.isPlaying && this.playAddress > 0) {
                this.sampleCounter--;
                if (this.sampleCounter <= 0) {
                    // === DETERMINISTISCHE SUB-SAMPLE PHASEN-KOMPENSATION ===
                    const overshoot = -this.sampleCounter;

                    let hz = 50.0; 
                    
                    if (this.useCiaTimer && this.cpu.ciaTimerA > 0) {
                        hz = this.clock / this.cpu.ciaTimerA;
                    }

                    if (hz < 10) hz = 10;
                    if (hz > 1000) hz = 1000;
                    
                    this.sampleCounter += sampleRate / hz;
                    
                    this.cpu.write(0xD019, 0x81);
                    
                    if (this.isIrqRoutine) {
                        this.cpu.irq(this.playAddress);
                    } else {
                        this.cpu.jsr(this.playAddress);
                    }

                    // Die Phasen-Akkumulatoren des SIDs sub-sample-genau ausrichten!
                    // Dies kompensiert Jitter, der entsteht, wenn die 6502-CPU einen Oszillator via Test-Bit resetet.
                    for (let v = 0; v < 3; v++) {
                        let ch = this.sid.voices[v];
                        if (ch.freq > 0) {
                            let phaseInc = ((ch.freq * this.clock) / 16777216.0) / sampleRate;
                            ch.phase = (ch.phase + overshoot * phaseInc) % 1.0;
                        }
                    }
                    
                    this.currentFrame = (this.currentFrame + 1) % this.maxFrames;
                }
            }

            let mix = 0;
            for (let v = 0; v < 3; v++) {
                let voiceOut = this.sid.synthesizeVoice(v, this.clock, sampleRate);
                
                if (this.sid.regs[23] & (1 << v)) {
                    let f = 2.0 * Math.sin(Math.PI * this.sid.cutoff / sampleRate);
                    if (f > 1.0) f = 1.0; 
                    
                    this.sid.filterLow += f * this.sid.filterBand;
                    let high = voiceOut - this.sid.filterLow - (1.0 - this.sid.resonance * 0.9) * this.sid.filterBand;
                    this.sid.filterBand += f * high;
                    
                    if (this.sid.filterBand > 3.0) this.sid.filterBand = 3.0;
                    if (this.sid.filterBand < -3.0) this.sid.filterBand = -3.0;
                    if (this.sid.filterLow > 3.0) this.sid.filterLow = 3.0;
                    if (this.sid.filterLow < -3.0) this.sid.filterLow = -3.0;
                    
                    let filterOut = 0;
                    if (this.sid.filterMode & 16) filterOut += this.sid.filterLow; 
                    if (this.sid.filterMode & 32) filterOut += this.sid.filterBand; 
                    if (this.sid.filterMode & 64) filterOut += high; 
                    voiceOut = filterOut;
                }
                mix += voiceOut;
            }

            let finalOut = (mix / 3.0) * this.sid.masterVol;
            outL[i] = finalOut;
            if (outR) outR[i] = finalOut;
            if (i === 0) visualValue = finalOut;
        }

        this.visCounter = (this.visCounter || 0) + 1;
        if (this.visCounter % 4 === 0) {
            let isAudible = Math.abs(visualValue) > 0.001;
            if (isAudible || this.wasAudible) {
                const view = this.visualView;
                view[0] = 0; // System Flag: 0 = C64 (SID)
                view[1] = this.isPlaying ? 1 : 0;
                view[2] = this.currentFrame;
                view[3] = visualValue;

                // Die 29 SID-Register in den Puffer kopieren
                for (let r = 0; r < 29; r++) {
                    view[4 + r] = this.sid.regs[r];
                }

                // Absolut stabiles Senden ohne Entwertung
                this.port.postMessage(view);
            }
            this.wasAudible = isAudible;
        }
        return true;
    }
}

registerProcessor('sid-processor', SIDProcessor);