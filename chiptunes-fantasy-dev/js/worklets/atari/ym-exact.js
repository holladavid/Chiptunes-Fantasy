// === js/worklets/atari/ym-exact.js ===
// =========================================================
// YM2149F CORE (CYCLE-EXACT 2MHz, LOG-DAC, TRUE 5-BIT ENV)
// Studio-Grade Polyphase Sinc-FIR Decimator & Digidrum DAC Injection
// Final Master: True 32-Step Yamaha D/A Converter Resolution
// =========================================================

import { DCBlocker, detectDigidrum, detectDigidrumVoice } from '../lib/dsp-utils.js';
import { YMVisualizer } from '../lib/ym-visualizer.js';

// =========================================================
// DSP UPGRADE: TRUE YM2149F 32-STEP LOG-DAC
// Der Yamaha Chip besitzt (im Gegensatz zum GI AY-3-8910)
// 32 logarithmische Lautstärkestufen zu je exakt -1.5dB.
// =========================================================
const YM_DAC32 = new Float32Array(32);
YM_DAC32[0] = 0.0;
for (let i = 1; i < 32; i++) {
    // -1.5dB pro Stufe Dämpfung, normalisiert auf 1.0 bei Index 31
    YM_DAC32[i] = Math.pow(10, (-1.5 * (31 - i)) / 20.0);
}

class YMExactProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.clock = 2000000; 
        this.regs = new Uint8Array(16); 
        
        this.tickCounter = 0;
        this.toneCountA = 0; this.toneCountB = 0; this.toneCountC = 0;
        this.toneOutA = 1; this.toneOutB = 1; this.toneOutC = 1;
        this.noiseCount = 0; this.noiseLfsr = 1; this.noiseOut = 1;
        
        this.envCount = 0; 
        this.envVol5Bit = 0; 
        this.envHold = true; 
        this.envDir = 1;
        
        this.digidrums = [];
        this.currentDigidrum = null;
        this.digiPos = 0;
        this.lastDigiTrigger = 0;
        this.currentDrumVoice = 0;
        
        this.trackData = null;
        this.currentFrame = 0;
        this.sampleCounter = 0;
        this.isPlaying = false;
        
        this.cycleAccumulator = 0.0;

        this.volA = 0.0; this.volB = 0.0; this.volC = 0.0;
        this.visualizer = new YMVisualizer(this.port);
        
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

                const pA = (((this.regs[1] & 0x0F) << 8) | this.regs[0]) || 1;
                const pB = (((this.regs[3] & 0x0F) << 8) | this.regs[2]) || 1;
                const pC = (((this.regs[5] & 0x0F) << 8) | this.regs[4]) || 1;
                const pN = (this.regs[6] & 0x1F) || 1;
                const pE = ((this.regs[12] << 8) | this.regs[11]) || 1;

                const mix = this.regs[7];
                const r8 = this.regs[8], r9 = this.regs[9], r10 = this.regs[10];
                const shape = this.regs[13] & 0x0F;

                const envCont = (shape & 8) !== 0;
                const envAlt = (shape & 2) !== 0;
                const envHoldFlag = (shape & 1) !== 0;

                for (let c = 0; c < cyclesToRun; c++) {
                    this.tickCounter++;

                    // 1. TONE & NOISE GENERATORS
                    if ((this.tickCounter & 15) === 0) {
                        if (--this.toneCountA <= 0) { this.toneCountA = pA; this.toneOutA ^= 1; }
                        if (--this.toneCountB <= 0) { this.toneCountB = pB; this.toneOutB ^= 1; }
                        if (--this.toneCountC <= 0) { this.toneCountC = pC; this.toneOutC ^= 1; }
                        
                        if (--this.noiseCount <= 0) {
                            this.noiseCount = pN;
                            this.noiseLfsr ^= (((this.noiseLfsr & 1) ^ ((this.noiseLfsr >> 3) & 1)) << 17);
                            this.noiseLfsr >>= 1;
                            this.noiseOut = this.noiseLfsr & 1;
                        }
                    }

                    // 2. TRUE 5-BIT ENVELOPE GENERATOR
                    if ((this.tickCounter & 255) === 0) {
                        if (--this.envCount <= 0) {
                            this.envCount = pE;
                            
                            if (!this.envHold) {
                                this.envVol5Bit += this.envDir;
                                if (this.envVol5Bit < 0 || this.envVol5Bit > 31) {
                                    if (!envCont) {
                                        this.envVol5Bit = 0;
                                        this.envHold = true;
                                    } else {
                                        if (envAlt) this.envDir = -this.envDir;
                                        this.envVol5Bit = (this.envDir > 0) ? 0 : 31;
                                        if (envHoldFlag) this.envHold = true;
                                    }
                                }
                            }
                        }
                    }

                    // 3. HARDWARE-ACCURATE VOLUME MAPPING
                    // Mapping des 4-Bit Registers auf die 5-Bit D/A Struktur:
                    // Wert 0 = 0. Wert X = (X * 2) + 1.
                    let fixVolA = r8 & 0x0F;
                    let vA5 = (r8 & 0x10) ? this.envVol5Bit : (fixVolA === 0 ? 0 : fixVolA * 2 + 1);
                    
                    let fixVolB = r9 & 0x0F;
                    let vB5 = (r9 & 0x10) ? this.envVol5Bit : (fixVolB === 0 ? 0 : fixVolB * 2 + 1);
                    
                    let fixVolC = r10 & 0x0F;
                    let vC5 = (r10 & 0x10) ? this.envVol5Bit : (fixVolC === 0 ? 0 : fixVolC * 2 + 1);

                    // 4. DIGIDRUM INJECTION (LOG-DAC COMPRESSION)
                    if (this.currentDigidrum) {
                        let posInt = Math.floor(this.digiPos);
                        if (posInt < this.currentDigidrum.length) {
                            let floatSample = this.currentDigidrum[posInt];
                            // Float PCM auf 4-Bit Register Wert (0-15)
                            let dacVal = Math.max(0, Math.min(15, Math.round((floatSample + 1.0) * 7.5)));
                            // Digidrums unterliegen ebenfalls dem 4-to-5-Bit Mapping der Hardware!
                            let dac5 = dacVal === 0 ? 0 : dacVal * 2 + 1;
                            
                            if (this.currentDrumVoice === 1) vA5 = dac5;
                            else if (this.currentDrumVoice === 2) vB5 = dac5;
                            else if (this.currentDrumVoice === 3) vC5 = dac5;
                            else { vA5 = vB5 = vC5 = dac5; }
                            
                            this.digiPos += (7812.5 / this.clock); 
                        } else {
                            this.currentDigidrum = null;
                        }
                    }

                    // 5. BOOLEAN MIXER
                    let outA = 1, outB = 1, outC = 1;
                    if ((mix & 0x01) === 0 && !this.toneOutA) outA = 0;
                    if ((mix & 0x08) === 0 && !this.noiseOut) outA = 0;
                    
                    if ((mix & 0x02) === 0 && !this.toneOutB) outB = 0;
                    if ((mix & 0x10) === 0 && !this.noiseOut) outB = 0;
                    
                    if ((mix & 0x04) === 0 && !this.toneOutC) outC = 0;
                    if ((mix & 0x20) === 0 && !this.noiseOut) outC = 0;

                    let mixedSample = (outA * YM_DAC32[vA5] + outB * YM_DAC32[vB5] + outC * YM_DAC32[vC5]) / 3.0;

                    this.volA = YM_DAC32[vA5];
                    this.volB = YM_DAC32[vB5];
                    this.volC = YM_DAC32[vC5];

                    this.ringBuffer[this.ringIndex] = mixedSample;
                    this.ringIndex = (this.ringIndex + 1) & 511;
                }

                // =========================================================
                // DECIMATION & MOTHERBOARD FILTER
                // =========================================================
                let decimationSum = 0;
                for (let k = 0; k < this.FIR_TAPS; k++) {
                    let readIdx = (this.ringIndex - 1 - k + 512) & 511;
                    decimationSum += this.ringBuffer[readIdx] * this.firKernel[k];
                }

                this.outLp += 0.45 * (decimationSum - this.outLp);
                let finalSample = this.dcBlock.process(this.outLp);

                outL[i] = finalSample;
                if (outR) outR[i] = finalSample;
                if (i === 0) currentVisualValue = finalSample;
            }
        }

        this.visualizer.update(this.isPlaying, this.currentFrame, currentVisualValue, this.regs, this.volA, this.volB, this.volC);
        return true; 
    }
}

registerProcessor('ym-exact-processor', YMExactProcessor);