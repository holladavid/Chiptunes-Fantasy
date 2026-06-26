// === js/worklets/c64/sid-worklet.js ===
// =========================================================
// MOS TECHNOLOGY SID 6581 AUDIO WORKLET PROCESSOR
// With Analog Op-Amp Saturation, Filter Leakage & Real-Time Thermal Drift
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

        // Starttemperatur: Kühle 28°C beim Einschalten des Systems
        this.temperature = 28.0;

        // Visualizer Zero-Allocation Buffer (Safe Clone)
        this.visualView = new Float32Array(40);

        this.port.onmessage = (e) => {
            const msg = e.data;
            
            // Manuelle Temperatureinstellung über den Regler
            if (msg.type === 'SET_TEMPERATURE') {
                this.temperature = Math.min(75, Math.max(15, msg.value));
                return;
            }

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

                // Temperatur beim Track-Start auf kühle 28°C zurücksetzen (Neustart-Feeling)
                this.temperature = 28.0;

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

                    // Phasen-Ausrichtung
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

            // === DYNAMISCHE THERMISCHE ERWÄRMUNG (Selbsterhitzung im Betrieb) ===
            if (this.temperature < 55.0) {
                this.temperature += (55.0 - this.temperature) * 0.000003; 
            }

            let mix = 0;
            for (let v = 0; v < 3; v++) {
                let voiceOut = this.sid.synthesizeVoice(v, this.clock, sampleRate);
                
                if (this.sid.regs[23] & (1 << v)) {
                    // 1. THERMISCHEN DRIFT-KOEFFIZIENT ANWENDEN
                    // Grenzfrequenz (Cutoff) sinkt bei Hitze (Widerstand der FETs steigt)
                    let thermalCoefficient = 1.0 - (this.temperature - 40.0) * 0.0035;
                    let activeCutoff = this.sid.cutoff * thermalCoefficient;
                    if (activeCutoff < 30) activeCutoff = 30;
                    if (activeCutoff > 12000) activeCutoff = 12000;

                    let f = 2.0 * Math.sin(Math.PI * activeCutoff / sampleRate);
                    if (f > 1.0) f = 1.0; 
                    
                    this.sid.filterLow += f * this.sid.filterBand;
                    
                    // Resonanz dämpft sich bei Hitze minimal ab (thermischer Transistor-Drift)
                    let resonanceDamp = 1.0 - (this.sid.resonance * 0.92) * (1.0 + (this.temperature - 40.0) * 0.001);
                    if (resonanceDamp < 0.05) resonanceDamp = 0.05;

                    let feedback = this.sid.filterLow + resonanceDamp * this.sid.filterBand;
                    
                    // 2. ANALOGE SÄTTIGUNG (Math.tanh Soft-Clipping) im Op-Amp-Feedback-Weg
                    let saturatedFeedback = Math.tanh(feedback);
                    let high = voiceOut - saturatedFeedback;
                    this.sid.filterBand += f * high;
                    
                    // Anti-Windup Hard-Clamping
                    if (this.sid.filterBand > 3.0) this.sid.filterBand = 3.0;
                    if (this.sid.filterBand < -3.0) this.sid.filterBand = -3.0;
                    if (this.sid.filterLow > 3.0) this.sid.filterLow = 3.0;
                    if (this.sid.filterLow < -3.0) this.sid.filterLow = -3.0;
                    
                    let filterOut = 0;
                    if (this.sid.filterMode & 16) filterOut += this.sid.filterLow; 
                    if (this.sid.filterMode & 32) filterOut += this.sid.filterBand; 
                    if (this.sid.filterMode & 64) filterOut += high; 
                    
                    // 3. ANALOGES SIGNAL-LEAKAGE (Leckstrom)
                    // Etwa 11% des trockenen Signals umgehen den Filter (Silicon-Ungenauigkeit des 6581)
                    let leakage = voiceOut * 0.11;
                    voiceOut = filterOut + leakage;
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

                // Temperatur-Rückmeldung an den Puffer übergeben (Index 33)
                view[33] = this.temperature;

                this.port.postMessage(view);
            }
            this.wasAudible = isAudible;
        }
        return true;
    }
}

registerProcessor('sid-processor', SIDProcessor);