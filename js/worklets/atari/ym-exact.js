// === js/worklets/atari/ym-exact.js ===
// =========================================================
// YM2149F CORE (CYCLE-EXACT 2MHz, LOG-DAC, TRUE 5-BIT ENV)
// Phase 1 Hardware Upgrade: True Measured DAC, 17-Bit LFSR Noise,
// Hardware Mixer Gates, 4-Bit Digidrum Hijacking & Analog Output Stage.
// =========================================================

import { detectDigidrum, detectDigidrumVoice, YM2149_DAC32, AtariAnalogFilter } from '../lib/dsp-utils.js';
import { YMVisualizer } from '../lib/ym-visualizer.js';

class YMExactProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.clock = 2000000; 
        this.regs = new Uint8Array(16); 
        
        this.toneDivA = 0; this.toneDivB = 0; this.toneDivC = 0;
        this.noiseDiv = 0;
        this.envDiv = 0;

        this.toneOutA = 1; this.toneOutB = 1; this.toneOutC = 1;
        
        // REVIEW FIX: 17-Bit LFSR Hardware Initialisierung
        this.noiseLfsr = 1; this.noiseOut = 1; 
        
        this.envStep = 0;   
        this.envPhase = 0;  
        this.envVol5Bit = 0; 
        this.envHold = true; 
        
        this.digidrums = [];
        this.currentDigidrum = null;
        this.digiPos = 0;
        this.lastDigiTrigger = 0;
        
        this.hijackedVoice = 0;
        this.hijackReleaseVol = 0; 
        
        this.trackData = null;
        this.currentFrame = 0;
        this.sampleCounter = 0;
        this.isPlaying = false;
        
        this.cycleAccumulator = 0.0;

        this.volA = 0.0; this.volB = 0.0; this.volC = 0.0;
        this.visualizer = new YMVisualizer(this.port);
        
        // Polyphase Sinc-FIR Decimator (Für Zero-Aliasing von 2MHz -> 48kHz)
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

        // REVIEW FIX: Echte Atari Analog-Motherboard Emulation!
        this.analogOut = new AtariAnalogFilter(sampleRate);
        this.outLp = 0;
        this.fadeVol = 0.0;
        
        this.port.onmessage = (event) => {
            const msg = event.data;
            if (msg.type === 'PLAY_TRACK') {
                this.trackData = msg.track;
                this.digidrums = msg.digidrums || []; 
                this.currentFrame = 0;
                this.sampleCounter = 0;
                this.currentDigidrum = null;
                this.lastDigiTrigger = 0;
                this.hijackedVoice = 0;
                this.hijackReleaseVol = 0;
                this.isPlaying = true;
                
                this.ringBuffer.fill(0);
                this.outLp = 0;
                this.analogOut = new AtariAnalogFilter(sampleRate);
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
        };
    }

    process(inputs, outputs) {
        const outL = outputs[0][0];  
        const outR = outputs[0].length > 1 ? outputs[0][1] : null; 
        let currentVisualValue = 0;

        for (let i = 0; i < outL.length; i++) {
            
            if (this.isPlaying) this.fadeVol = Math.min(1.0, this.fadeVol + 0.002);
            else this.fadeVol = Math.max(0.0, this.fadeVol - 0.002);

            if (this.fadeVol === 0.0) {
                let idleSample = this.analogOut.process(0);
                outL[i] = idleSample; if (outR) outR[i] = idleSample;
                continue; 
            }

            let decimationSum = 0;

            if (this.isPlaying && this.trackData && this.trackData.length > 0) {
                this.cycleAccumulator += this.clock / sampleRate;
                let cyclesToRun = Math.floor(this.cycleAccumulator);
                this.cycleAccumulator -= cyclesToRun;

                this.sampleCounter--;
                if (this.sampleCounter <= 0) {
                    this.sampleCounter += sampleRate / 50.0; 
                    
                    let frame = this.trackData[this.currentFrame];
                    for(let r=0; r<16; r++) {
                        let val = frame[r];
                        if (r === 13) {
                            if (val !== 0xFF) {
                                this.regs[13] = val;
                                this.envStep = 0;
                                this.envPhase = 0;
                                this.envDiv = 0; 
                                this.envHold = false;
                            }
                        } else {
                            this.regs[r] = val;
                        }
                    }
                    
                    let activeDigiTrigger = detectDigidrum(frame);
                    let activeDigiVoice = detectDigidrumVoice(frame);

                    if (activeDigiTrigger > 0 && activeDigiTrigger !== this.lastDigiTrigger) {
                        if (this.digidrums[activeDigiTrigger - 1]) {
                            this.currentDigidrum = this.digidrums[activeDigiTrigger - 1];
                            this.digiPos = 0;
                            
                            if (activeDigiVoice > 0) {
                                this.hijackedVoice = activeDigiVoice;
                                if (activeDigiVoice === 1) this.hijackReleaseVol = frame[8];
                                else if (activeDigiVoice === 2) this.hijackReleaseVol = frame[9];
                                else if (activeDigiVoice === 3) this.hijackReleaseVol = frame[10];
                            }
                            this.port.postMessage({ type: 'DEBUG', msg: 'Drum ' + activeDigiTrigger });
                        }
                    }
                    this.lastDigiTrigger = activeDigiTrigger;

                    if (this.hijackedVoice === 1 && frame[8] !== this.hijackReleaseVol) this.hijackedVoice = 0;
                    if (this.hijackedVoice === 2 && frame[9] !== this.hijackReleaseVol) this.hijackedVoice = 0;
                    if (this.hijackedVoice === 3 && frame[10] !== this.hijackReleaseVol) this.hijackedVoice = 0;

                    this.currentFrame = (this.currentFrame + 1) % this.trackData.length;
                }

                // REVIEW FIX: Period 0 wird als 1 behandelt!
                const pA = (((this.regs[1] & 0x0F) << 8) | this.regs[0]) || 1;
                const pB = (((this.regs[3] & 0x0F) << 8) | this.regs[2]) || 1;
                const pC = (((this.regs[5] & 0x0F) << 8) | this.regs[4]) || 1;
                const pN = (this.regs[6] & 0x1F) || 1;
                const pE = ((this.regs[12] << 8) | this.regs[11]) || 1;

                const mix = this.regs[7];
                const r8 = this.regs[8], r9 = this.regs[9], r10 = this.regs[10];
                
                // (Der Envelope-Code bleibt für Phase 1 noch grob erhalten, wird in Phase 2 refaktorisiert)
                const shape = this.regs[13] & 0x0F;
                const envAttack = (shape & 4) !== 0; const envCont = (shape & 8) !== 0;
                const envAlt = (shape & 2) !== 0; const envHoldFlag = (shape & 1) !== 0;

                // --- THE 2MHZ CYCLE-EXACT LOCKSTEP ---
                for (let c = 0; c < cyclesToRun; c++) {
                    
                    if (--this.toneDivA <= 0) { this.toneDivA = 8 * pA; this.toneOutA ^= 1; }
                    if (--this.toneDivB <= 0) { this.toneDivB = 8 * pB; this.toneOutB ^= 1; }
                    if (--this.toneDivC <= 0) { this.toneDivC = 8 * pC; this.toneOutC ^= 1; }
                    
                    // REVIEW FIX: True 17-Bit LFSR Feedback (Bit 0 XOR Bit 3)
                    if (--this.noiseDiv <= 0) {
                        this.noiseDiv = 16 * pN;
                        let bit0 = this.noiseLfsr & 1;
                        let bit3 = (this.noiseLfsr >> 3) & 1;
                        this.noiseLfsr = (this.noiseLfsr >> 1) | ((bit0 ^ bit3) << 16);
                        this.noiseOut = bit0; // 0 oder 1
                    }

                    if (--this.envDiv <= 0) {
                        this.envDiv = 8 * pE;
                        if (!this.envHold) {
                            this.envStep++;
                            if (this.envStep > 31) {
                                this.envStep = 0;
                                this.envPhase++;
                                if (!envCont) this.envHold = true;
                                if (envCont && envHoldFlag) this.envHold = true;
                            }
                            
                            let eVol = 0;
                            if (!envCont) {
                                eVol = (this.envPhase > 0) ? 0 : (envAttack ? this.envStep : (31 - this.envStep));
                            } else {
                                if (this.envHold && this.envPhase > 0) {
                                    let dirUp = envAttack ? !envAlt : envAlt;
                                    eVol = dirUp ? 31 : 0;
                                } else {
                                    let isReversed = envAlt && ((this.envPhase & 1) === 1);
                                    let dirUp = envAttack ? !isReversed : isReversed;
                                    eVol = dirUp ? this.envStep : (31 - this.envStep);
                                }
                            }
                            this.envVol5Bit = eVol;
                        }
                    }

                    // --- DIGIDRUM HIJACKING (REVIEW FIX: 4-Bit DAC Modulation) ---
                    let digiVal5Bit = -1;
                    if (this.currentDigidrum) {
                        let posInt = Math.floor(this.digiPos);
                        if (posInt < this.currentDigidrum.length) {
                            // Float (-1 bis +1) zu 5-Bit Quantisierung (0 bis 31)
                            let floatSample = this.currentDigidrum[posInt]; 
                            digiVal5Bit = Math.floor((floatSample + 1.0) * 15.5);
                            this.digiPos += (7812.5 / this.clock); 
                        } else {
                            this.currentDigidrum = null;
                        }
                    }

                    let vA5 = (r8 & 0x10) ? this.envVol5Bit : (r8 & 0x0F) * 2 + 1;
                    let vB5 = (r9 & 0x10) ? this.envVol5Bit : (r9 & 0x0F) * 2 + 1;
                    let vC5 = (r10 & 0x10) ? this.envVol5Bit : (r10 & 0x0F) * 2 + 1;

                    // Digidrum überschreibt das Lautstärkeregister (wie bei Mad Max!)
                    if (digiVal5Bit !== -1) {
                        if (this.hijackedVoice === 1 || this.hijackedVoice === 0) vA5 = digiVal5Bit;
                        else if (this.hijackedVoice === 2) vB5 = digiVal5Bit;
                        else if (this.hijackedVoice === 3) vC5 = digiVal5Bit;
                    }

                    // REVIEW FIX: Hardware Mixer Gates (AND / OR)
                    let toneEnA = (mix & 0x01) ? 1 : 0; let noiseEnA = (mix & 0x08) ? 1 : 0;
                    let toneEnB = (mix & 0x02) ? 1 : 0; let noiseEnB = (mix & 0x10) ? 1 : 0;
                    let toneEnC = (mix & 0x04) ? 1 : 0; let noiseEnC = (mix & 0x20) ? 1 : 0;

                    let outA = (toneEnA | this.toneOutA) & (noiseEnA | this.noiseOut);
                    let outB = (toneEnB | this.toneOutB) & (noiseEnB | this.noiseOut);
                    let outC = (toneEnC | this.toneOutC) & (noiseEnC | this.noiseOut);

                    // Digidrum erzwingt offenes Gate, damit der Sample nicht zerschnitten wird
                    if (digiVal5Bit !== -1) {
                        if (this.hijackedVoice === 1 || this.hijackedVoice === 0) outA = 1;
                        if (this.hijackedVoice === 2) outB = 1;
                        if (this.hijackedVoice === 3) outC = 1;
                    }

                    // REVIEW FIX: True Measured YM2149 DAC Table
                    let ampA = outA ? YM2149_DAC32[vA5] : 0;
                    let ampB = outB ? YM2149_DAC32[vB5] : 0;
                    let ampC = outC ? YM2149_DAC32[vC5] : 0;

                    let mixedSample = (ampA + ampB + ampC) / 3.0;

                    this.volA = ampA; this.volB = ampB; this.volC = ampC;
                    this.ringBuffer[this.ringIndex] = mixedSample;
                    this.ringIndex = (this.ringIndex + 1) & 511;
                }

                // Sinc-FIR Decimator
                for (let k = 0; k < this.FIR_TAPS; k++) {
                    let readIdx = (this.ringIndex - 1 - k + 512) & 511;
                    decimationSum += this.ringBuffer[readIdx] * this.firKernel[k];
                }
            }

            // Smoothing filter for FIR output
            this.outLp += 0.45 * (decimationSum - this.outLp);
            
            // REVIEW FIX: Atari Analog Stage
            let finalSample = this.analogOut.process(this.outLp) * this.fadeVol;

            outL[i] = finalSample;
            if (outR) outR[i] = finalSample;
            if (i === 0) currentVisualValue = finalSample;
        }

        this.visualizer.update(this.isPlaying, this.currentFrame, currentVisualValue, this.regs, this.volA, this.volB, this.volC);
        return true; 
    }
}

registerProcessor('ym-exact-processor', YMExactProcessor);