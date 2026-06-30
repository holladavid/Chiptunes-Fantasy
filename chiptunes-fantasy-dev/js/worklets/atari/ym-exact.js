// === js/worklets/atari/ym-exact.js ===
// =========================================================
// YM2149F CORE (CYCLE-EXACT 2MHz, LOG-DAC, TRUE 5-BIT ENV)
// Studio-Grade Polyphase Sinc-FIR Decimator & Digidrum DAC Injection
// =========================================================

import { DCBlocker, detectDigidrum, detectDigidrumVoice } from '../lib/dsp-utils.js';
import { YMVisualizer } from '../lib/ym-visualizer.js';

// Die gemessene logarithmische D/A-Wandler-Kurve des YM2149F
const YM_DAC = [
    0.0000, 0.0137, 0.0205, 0.0291, 0.0423, 0.0618, 0.0847, 0.1369, 
    0.1691, 0.2647, 0.3527, 0.4499, 0.5704, 0.6873, 0.8482, 1.0000
];

class YMExactProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.clock = 2000000; // Atari ST YM Clock: 2 MHz
        this.regs = new Uint8Array(16); 
        
        // 2 MHz Lockstep Hardware Counters
        this.tickCounter = 0;
        
        this.toneCountA = 0; this.toneCountB = 0; this.toneCountC = 0;
        this.toneOutA = 1; this.toneOutB = 1; this.toneOutC = 1;
        
        this.noiseCount = 0; this.noiseLfsr = 1; this.noiseOut = 1;
        
        // True 5-Bit Hardware Envelope State Machine
        this.envCount = 0; 
        this.envVol5Bit = 0; 
        this.envHold = true; 
        this.envDir = 1;
        
        // Digidrum (DAC Hack)
        this.digidrums = [];
        this.currentDigidrum = null;
        this.digiPos = 0;
        this.lastDigiTrigger = 0;
        this.currentDrumVoice = 0;
        
        // Player state
        this.trackData = null;
        this.currentFrame = 0;
        this.sampleCounter = 0;
        this.isPlaying = false;
        
        this.cycleAccumulator = 0.0;

        // Visualizer & UI state
        this.volA = 0.0; this.volB = 0.0; this.volC = 0.0;
        this.visualizer = new YMVisualizer(this.port);
        
        // =========================================================
        // DSP UPGRADE: 255-TAP POLYPHASE SINC-FIR DECIMATOR
        // =========================================================
        this.FIR_TAPS = 255;
        this.firKernel = new Float32Array(this.FIR_TAPS);
        this.ringBuffer = new Float32Array(512); 
        this.ringIndex = 0;
        
        // 12.5 kHz Cutoff blockt Aliasing vor der Dezimation ab
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

        // Motherboard Filters
        this.dcBlock = new DCBlocker();
        this.outLp = 0;
        
        this.port.onmessage = this.handleMessage.bind(this);
    }

    handleMessage(event) {
        const msg = event.data;
        if (msg.type === 'PLAY_TRACK') {
            this.trackData = msg.track;
            this.digidrums = msg.digidrums || []; 
            this.currentFrame = 0;
            this.sampleCounter = 0;
            this.currentDigidrum = null;
            this.lastDigiTrigger = 0;
            this.isPlaying = true;
            this.ringBuffer.fill(0);
        } else if (msg.type === 'STOP_TRACK') {
            this.isPlaying = false;
        } else if (msg.type === 'RESUME_TRACK') {
            this.isPlaying = true; 
        } else if (msg.type === 'SEEK_TRACK') {
            if (this.trackData) {
                this.currentFrame = msg.frame % this.trackData.length;
                this.currentDigidrum = null; 
            }
        }
    }

    process(inputs, outputs) {
        const outL = outputs[0][0];  
        const outR = outputs[0].length > 1 ? outputs[0][1] : null; 
        let currentVisualValue = 0;

        for (let i = 0; i < outL.length; i++) {
            if (!this.isPlaying) {
                outL[i] = 0; if (outR) outR[i] = 0;
                continue; 
            }

            let cyclesToRun = 0;
            if (this.trackData) {
                this.cycleAccumulator += this.clock / sampleRate;
                cyclesToRun = Math.floor(this.cycleAccumulator);
                this.cycleAccumulator -= cyclesToRun;

                this.sampleCounter--;
                if (this.sampleCounter <= 0) {
                    this.sampleCounter += sampleRate / 50.0; 
                    
                    let frame = this.trackData[this.currentFrame];
                    for(let r=0; r<16; r++) {
                        if (r === 13) {
                            if (frame[13] !== 0xFF) {
                                this.regs[13] = frame[13];
                                // Hardware Env Reset
                                this.envHold = false;
                                this.envDir = (frame[13] & 4) ? 1 : -1;
                                this.envVol5Bit = (frame[13] & 4) ? 0 : 31;
                            }
                        } else {
                            this.regs[r] = frame[r];
                        }
                    }
                    
                    let activeDigiTrigger = detectDigidrum(frame);
                    let activeDigiVoice = detectDigidrumVoice(frame);

                    if (activeDigiTrigger > 0 && activeDigiTrigger !== this.lastDigiTrigger) {
                        if (this.digidrums[activeDigiTrigger - 1]) {
                            this.currentDigidrum = this.digidrums[activeDigiTrigger - 1];
                            this.digiPos = 0;
                            this.currentDrumVoice = activeDigiVoice;
                            this.port.postMessage({ type: 'DEBUG', msg: 'Drum ' + activeDigiTrigger });
                        }
                    }
                    this.lastDigiTrigger = activeDigiTrigger;
                    
                    this.currentFrame = (this.currentFrame + 1) % this.trackData.length;
                }

                // =========================================================
                // THE NATIVE 2 MHz LOCKSTEP LOOP
                // =========================================================
                for (let c = 0; c < cyclesToRun; c++) {
                    this.tickCounter++;

                    // --- 1. TONE & NOISE GENERATORS (Clock / 16) ---
                    if ((this.tickCounter & 15) === 0) {
                        // Tones
                        if (--this.toneCountA <= 0) {
                            let pA = ((this.regs[1] & 0x0f) << 8) | this.regs[0];
                            this.toneCountA = pA === 0 ? 1 : pA;
                            this.toneOutA ^= 1;
                        }
                        if (--this.toneCountB <= 0) {
                            let pB = ((this.regs[3] & 0x0f) << 8) | this.regs[2];
                            this.toneCountB = pB === 0 ? 1 : pB;
                            this.toneOutB ^= 1;
                        }
                        if (--this.toneCountC <= 0) {
                            let pC = ((this.regs[5] & 0x0f) << 8) | this.regs[4];
                            this.toneCountC = pC === 0 ? 1 : pC;
                            this.toneOutC ^= 1;
                        }

                        // Noise (17-bit LFSR)
                        if (--this.noiseCount <= 0) {
                            let pN = this.regs[6] & 0x1f;
                            this.noiseCount = pN === 0 ? 1 : pN;
                            
                            this.noiseLfsr ^= (((this.noiseLfsr & 1) ^ ((this.noiseLfsr >> 3) & 1)) << 17);
                            this.noiseLfsr >>= 1;
                            this.noiseOut = this.noiseLfsr & 1;
                        }
                    }

                    // --- 2. ENVELOPE GENERATOR (Clock / 256) ---
                    if ((this.tickCounter & 255) === 0) {
                        if (--this.envCount <= 0) {
                            let pE = (this.regs[12] << 8) | this.regs[11];
                            this.envCount = pE === 0 ? 1 : pE;
                            
                            if (!this.envHold) {
                                this.envVol5Bit += this.envDir;
                                // 5-Bit Überlauf (32 Steps)
                                if (this.envVol5Bit < 0 || this.envVol5Bit > 31) {
                                    let shape = this.regs[13] & 0x0f;
                                    let cont = (shape & 8) !== 0;
                                    let alt = (shape & 2) !== 0;
                                    let hold = (shape & 1) !== 0;

                                    if (!cont) {
                                        this.envVol5Bit = 0;
                                        this.envHold = true;
                                    } else {
                                        if (alt) this.envDir = -this.envDir;
                                        this.envVol5Bit = (this.envDir > 0) ? 0 : 31;
                                        if (hold) this.envHold = true;
                                    }
                                }
                            }
                        }
                    }

                    // --- 3. MIXER & DIGIDRUM INJECTION ---
                    // Der YM mappt das 5-Bit Envelope-Register auf den 4-Bit DAC 
                    let vA = (this.regs[8] & 0x10) ? Math.floor(this.envVol5Bit / 2) : (this.regs[8] & 0x0F);
                    let vB = (this.regs[9] & 0x10) ? Math.floor(this.envVol5Bit / 2) : (this.regs[9] & 0x0F);
                    let vC = (this.regs[10] & 0x10) ? Math.floor(this.envVol5Bit / 2) : (this.regs[10] & 0x0F);

                    if (this.currentDigidrum) {
                        let posInt = Math.floor(this.digiPos);
                        if (posInt < this.currentDigidrum.length) {
                            let floatSample = this.currentDigidrum[posInt];
                            // Wandlung Float PCM -> 4-Bit Hardware DAC Wert (0-15)
                            let dacVal = Math.max(0, Math.min(15, Math.round((floatSample + 1.0) * 7.5)));
                            
                            if (this.currentDrumVoice === 1) vA = dacVal;
                            else if (this.currentDrumVoice === 2) vB = dacVal;
                            else if (this.currentDrumVoice === 3) vC = dacVal;
                            else { vA = vB = vC = dacVal; } // Fallback für globale Drums
                            
                            // YM6 Digidrums liefen historisch über Timer bei ~7.8 - 8 kHz
                            this.digiPos += (7812.5 / this.clock); 
                        } else {
                            this.currentDigidrum = null;
                        }
                    }

                    const mix = this.regs[7];
                    let outA = 1, outB = 1, outC = 1;
                    
                    // Hardware Logik: Wenn Tone/Noise "off" (Bit = 1) sind, bleibt Output auf 1 (DC-Level)
                    if ((mix & 0x01) === 0 && !this.toneOutA) outA = 0;
                    if ((mix & 0x08) === 0 && !this.noiseOut) outA = 0;
                    
                    if ((mix & 0x02) === 0 && !this.toneOutB) outB = 0;
                    if ((mix & 0x10) === 0 && !this.noiseOut) outB = 0;
                    
                    if ((mix & 0x04) === 0 && !this.toneOutC) outC = 0;
                    if ((mix & 0x20) === 0 && !this.noiseOut) outC = 0;

                    let mixedSample = (outA * YM_DAC[vA] + outB * YM_DAC[vB] + outC * YM_DAC[vC]) / 3.0;

                    // UI Sync
                    this.volA = YM_DAC[vA];
                    this.volB = YM_DAC[vB];
                    this.volC = YM_DAC[vC];

                    // Ringpuffer für Sinc-Decimation
                    this.ringBuffer[this.ringIndex] = mixedSample;
                    this.ringIndex = (this.ringIndex + 1) & 511;
                }

                // =========================================================
                // DECIMATION & MOTHERBOARD FILTERING (48 kHz Rate)
                // =========================================================
                let decimationSum = 0;
                for (let k = 0; k < this.FIR_TAPS; k++) {
                    let readIdx = (this.ringIndex - 1 - k + 512) & 511;
                    decimationSum += this.ringBuffer[readIdx] * this.firKernel[k];
                }

                // Atari ST Motherboard RC Lowpass (ca. 15.9 kHz) zur Dämpfung der Trägerfrequenz
                this.outLp += 0.45 * (decimationSum - this.outLp);
                
                // DC-Offset rausfiltern (Koppelkondensator)
                let finalSample = this.dcBlock.process(this.outLp);

                outL[i] = finalSample;
                if (outR) outR[i] = finalSample;
                if (i === 0) currentVisualValue = finalSample;
            }
        }

        // Visualizer Update
        this.visualizer.update(this.isPlaying, this.currentFrame, currentVisualValue, this.regs, this.volA, this.volB, this.volC);
        return true; 
    }
}

registerProcessor('ym-exact-processor', YMExactProcessor);