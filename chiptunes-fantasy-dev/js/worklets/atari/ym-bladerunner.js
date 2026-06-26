// === js/worklets/atari/ym-bladerunner.js ===
// =========================================================
// YM2149F "BLADE RUNNER" CORE (Cinematic Analog CS-80 Edition)
// With Zero-Allocation Visualizer Buffer (Safe Clone)
// =========================================================

import { YM_DAC, polyBLEP, cubicInterpolate, MoogFilter, DCBlocker, detectDigidrum, detectDigidrumVoice } from '../lib/dsp-utils.js';
import { DynamicStaging } from '../lib/dynamic-staging.js';

class YMBladeRunnerProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.clock = 2000000; 
        
        this.regs = new Uint8Array(16); 
        this.trackData = null;
        this.currentFrame = 0;
        this.sampleCounter = 0;
        this.isPlaying = false;

        this.phaseA_L = 0; this.phaseA_R = 0;
        this.phaseB_L = 0; this.phaseB_R = 0;
        this.phaseC_L = 0; this.phaseC_R = 0;
        
        this.lfoVibrato = 0.0; 
        this.lfoWow = 0.0;     
        this.lfoFlutter = 0.0; 
        
        this.noiseLfsr = 1; this.noisePhase = 0; this.noiseOutput = 1;
        this.envPhase = 0.0;
        this.smoothVoltA = 0.0; this.smoothVoltB = 0.0; this.smoothVoltC = 0.0;

        this.stager = new DynamicStaging();
        
        this.filterA_L = new MoogFilter(); this.filterA_R = new MoogFilter();
        this.filterB_L = new MoogFilter(); this.filterB_R = new MoogFilter();
        this.filterC_L = new MoogFilter(); this.filterC_R = new MoogFilter();
        this.noiseFilter = new MoogFilter();
        this.drumHp = new MoogFilter(); 
        
        this.dcBlockL = new DCBlocker();
        this.dcBlockR = new DCBlocker();
        
        this.delayBufL = new Float32Array(65536); 
        this.delayBufR = new Float32Array(65536);
        this.delayIdx = 0;
        this.delayTime = 0; 
        this.delayLpL = 0; this.delayLpR = 0; 
        this.delayHpL = 0; this.delayHpR = 0;
        
        this.digidrums = [];
        this.currentDigidrum = null;
        this.digiPos = 0;
        this.lastDigiTrigger = 0;
        this.currentDrumVoice = 0; 
        this.sidechainEnv = 1.0; 

        // Visualizer Zero-Allocation Ring Buffer (40 Floats * 4 Bytes = 160 Bytes)
        this.visualView = new Float32Array(40);
        
        this.port.onmessage = (event) => {
            const msg = event.data;
            if (msg.type === 'PLAY_TRACK') {
                this.trackData = msg.track;
                this.digidrums = msg.digidrums || []; 
                if (msg.roles) this.stager.state = msg.roles; 
                this.currentFrame = 0;
                this.sampleCounter = 0;
                this.currentDigidrum = null;
                this.lastDigiTrigger = 0;
                this.envPhase = 0;
                this.isPlaying = true;
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
        const outR = outputs[0][1] || outputs[0][0]; 
        let currentVisualValue = 0;

        if (this.delayTime === 0) this.delayTime = Math.floor(sampleRate * 0.375);

        for (let i = 0; i < outL.length; i++) {
            if (!this.isPlaying) { 
                outL[i] = 0; 
                if (outR) outR[i] = 0; 
                continue; 
            }

            if (this.trackData) {
                this.sampleCounter--;
                if (this.sampleCounter <= 0) {
                    this.sampleCounter += sampleRate / 50.0; 
                    let frame = this.trackData[this.currentFrame];
                    if (!frame) continue;
                    
                    for(let r=0; r<16; r++) {
                        if (r === 13) { 
                            if (frame[13] !== 0xFF) { this.regs[13] = frame[13]; this.envPhase = 0.0; } 
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
                            this.sidechainEnv = 0.45; 
                            this.port.postMessage({ type: 'DEBUG', msg: 'Drum ' + activeDigiTrigger });
                        }
                    }
                    this.lastDigiTrigger = activeDigiTrigger;

                    if (activeDigiTrigger > 0) {
                        this.currentDrumVoice = activeDigiVoice;
                    }

                    this.currentFrame = (this.currentFrame + 1) % this.trackData.length;
                }
            }

            this.sidechainEnv += (1.0 - this.sidechainEnv) * 0.002;

            let pA = ((this.regs[1] & 0x0F) << 8) | this.regs[0];
            let pB = ((this.regs[3] & 0x0F) << 8) | this.regs[2];
            let pC = ((this.regs[5] & 0x0F) << 8) | this.regs[4];
            
            let incA = (this.clock / (16 * (pA === 0 ? 1 : pA))) / sampleRate;
            let incB = (this.clock / (16 * (pB === 0 ? 1 : pB))) / sampleRate;
            let incC = (this.clock / (16 * (pC === 0 ? 1 : pC))) / sampleRate;

            const mix = this.regs[7];
            let tA = (mix & 0x01) === 0; let tB = (mix & 0x02) === 0; let tC = (mix & 0x04) === 0;
            let nA = (mix & 0x08) === 0; let nB = (mix & 0x10) === 0; let nC = (mix & 0x20) === 0;

            if (!this.currentDigidrum) {
                this.currentDrumVoice = 0;
            }

            let stage = this.stager.update(pA, pB, pC, nA, nB, nC, 0.001, this.currentDrumVoice);

            this.lfoVibrato = (this.lfoVibrato + 5.5 / sampleRate) % 1.0; 
            this.lfoWow = (this.lfoWow + 0.15 / sampleRate) % 1.0; 
            this.lfoFlutter = (this.lfoFlutter + 1.2 / sampleRate) % 1.0;  
            
            let wowA = Math.sin(this.lfoWow * 2.0 * Math.PI) * 0.005; 
            let wowB = Math.sin((this.lfoWow + 0.33) * 2.0 * Math.PI) * 0.005; 
            let wowC = Math.sin((this.lfoWow + 0.66) * 2.0 * Math.PI) * 0.005; 

            let flutterA = Math.sin(this.lfoFlutter * 2.0 * Math.PI) * 0.0015; 
            let flutterB = Math.sin((this.lfoFlutter + 0.25) * 2.0 * Math.PI) * 0.0015; 
            let flutterC = Math.sin((this.lfoFlutter + 0.5) * 2.0 * Math.PI) * 0.0015; 
            
            let vibA = Math.sin(this.lfoVibrato * 2.0 * Math.PI) * (0.0005 + this.smoothVoltA * 0.004);
            let vibB = Math.sin(this.lfoVibrato * 2.0 * Math.PI) * (0.0005 + this.smoothVoltB * 0.004);
            let vibC = Math.sin(this.lfoVibrato * 2.0 * Math.PI) * (0.0005 + this.smoothVoltC * 0.004);

            let driftA = 1.0 + wowA + flutterA + vibA;
            let driftB = 1.0 + wowB + flutterB + vibB;
            let driftC = 1.0 + wowC + flutterC + vibC;
            
            this.phaseA_L = (this.phaseA_L + incA * driftA) % 1.0;
            this.phaseA_R = (this.phaseA_R + incA * (driftA + 0.002)) % 1.0; 
            
            this.phaseB_L = (this.phaseB_L + incB * driftB) % 1.0;
            this.phaseB_R = (this.phaseB_R + incB * (driftB + 0.003)) % 1.0; 
            
            this.phaseC_L = (this.phaseC_L + incC * driftC) % 1.0;
            this.phaseC_R = (this.phaseC_R + incC * (driftC + 0.002)) % 1.0; 

            let pwmWidth = Math.sin(this.lfoVibrato * 2.0 * Math.PI) * 0.2 + 0.5;
            
            // Channel A
            let sqA_L = (this.phaseA_L < pwmWidth ? 1.0 : -1.0) + polyBLEP(this.phaseA_L, incA) - polyBLEP((this.phaseA_L + pwmWidth) % 1.0, incA);
            let sawA_L = ((this.phaseA_L * 2.0) - 1.0) - polyBLEP(this.phaseA_L, incA);
            let sFundA = Math.sin(this.phaseA_L * 2.0 * Math.PI);
            let sigA_L = tA ? ((sqA_L * 0.3 + sawA_L * 0.7) * (1.0 - stage.A.sub*0.3) + sFundA * (0.3 + stage.A.sub * 0.9)) : 0.0;
            
            let sqA_R = (this.phaseA_R < pwmWidth ? 1.0 : -1.0) + polyBLEP(this.phaseA_R, incA) - polyBLEP((this.phaseA_R + pwmWidth) % 1.0, incA);
            let sawA_R = ((this.phaseA_R * 2.0) - 1.0) - polyBLEP(this.phaseA_R, incA);
            let sFundA_R = Math.sin(this.phaseA_R * 2.0 * Math.PI);
            let sigA_R = tA ? ((sqA_R * 0.3 + sawA_R * 0.7) * (1.0 - stage.A.sub*0.3) + sFundA_R * (0.3 + stage.A.sub * 0.9)) : 0.0;

            // Channel B
            let sqB_L = (this.phaseB_L < pwmWidth ? 1.0 : -1.0) + polyBLEP(this.phaseB_L, incB) - polyBLEP((this.phaseB_L + pwmWidth) % 1.0, incB);
            let sawB_L = ((this.phaseB_L * 2.0) - 1.0) - polyBLEP(this.phaseB_L, incB);
            let sFundB = Math.sin(this.phaseB_L * 2.0 * Math.PI);
            let sigB_L = tB ? ((sqB_L * 0.3 + sawB_L * 0.7) * (1.0 - stage.B.sub*0.3) + sFundB * (0.3 + stage.B.sub * 0.9)) : 0.0;
            
            let sqB_R = (this.phaseB_R < pwmWidth ? 1.0 : -1.0) + polyBLEP(this.phaseB_R, incB) - polyBLEP((this.phaseB_R + pwmWidth) % 1.0, incB);
            let sawB_R = ((this.phaseB_R * 2.0) - 1.0) - polyBLEP(this.phaseB_R, incB);
            let sFundB_R = Math.sin(this.phaseB_R * 2.0 * Math.PI);
            let sigB_R = tB ? ((sqB_R * 0.3 + sawB_R * 0.7) * (1.0 - stage.B.sub*0.3) + sFundB_R * (0.3 + stage.B.sub * 0.9)) : 0.0;

            // Channel C
            let sqC_L = (this.phaseC_L < pwmWidth ? 1.0 : -1.0) + polyBLEP(this.phaseC_L, incC) - polyBLEP((this.phaseC + pwmWidth) % 1.0, incC);
            let sawC_L = ((this.phaseC_L * 2.0) - 1.0) - polyBLEP(this.phaseC_L, incC);
            let sFundC = Math.sin(this.phaseC_L * 2.0 * Math.PI);
            let sigC_L = tC ? ((sqC_L * 0.3 + sawC_L * 0.7) * (1.0 - stage.C.sub*0.3) + sFundC * (0.3 + stage.C.sub * 0.9)) : 0.0;
            
            let sqC_R = (this.phaseC_R < pwmWidth ? 1.0 : -1.0) + polyBLEP(this.phaseC_R, incC) - polyBLEP((this.phaseC_R + pwmWidth) % 1.0, incC);
            let sawC_R = ((this.phaseC_R * 2.0) - 1.0) - polyBLEP(this.phaseC_R, incC);
            let sFundC_R = Math.sin(this.phaseC_R * 2.0 * Math.PI);
            let sigC_R = tC ? ((sqC_R * 0.3 + sawC_R * 0.7) * (1.0 - stage.C.sub*0.3) + sFundC_R * (0.3 + stage.C.sub * 0.9)) : 0.0;

            // Noise
            this.noisePhase += (this.clock / (16 * ((this.regs[6] & 0x1F) === 0 ? 1 : (this.regs[6] & 0x1F)))) / sampleRate;
            if (this.noisePhase >= 1.0) {
                this.noisePhase %= 1.0;
                this.noiseLfsr ^= (((this.noiseLfsr & 1) ^ ((this.noiseLfsr >> 3) & 1)) << 17);
                this.noiseLfsr >>= 1;
                this.noiseOutput = (this.noiseLfsr & 1) ? 1.0 : -1.0;
            }

            let pN = this.regs[6] & 0x1F;
            let noiseCutoff = 300 + (31 - pN) * 200; 
            let filteredNoise = this.noiseFilter.process(this.noiseOutput, noiseCutoff, 0.1, sampleRate) * 0.45;

            if (nA) { sigA_L += filteredNoise; sigA_R += filteredNoise; }
            if (nB) { sigB_L += filteredNoise; sigB_R += filteredNoise; }
            if (nC) { sigC_L += filteredNoise; sigC_R += filteredNoise; }

            this.envPhase += (this.clock / (256 * (((this.regs[12] << 8) | this.regs[11]) === 0 ? 1 : ((this.regs[12] << 8) | this.regs[11])))) / sampleRate;
            let shape = this.regs[13] & 0x0F;
            let cycles = Math.floor(this.envPhase);
            let localPhase = this.envPhase - cycles;
            let envVolRaw = 0;

            let attack = (shape & 4) !== 0; let cont = (shape & 8) !== 0;
            let alt = (shape & 2) !== 0; let hold = (shape & 1) !== 0;
            if (!cont) { hold = true; alt = false; } else { hold = (shape & 1) !== 0; alt = (shape & 2) !== 0; }
            if (cycles > 0 && hold) { envVolRaw = (alt ? (attack ? 0.0 : 1.0) : (attack ? 1.0 : 0.0)); } 
            else { let flip = (cycles % 2 === 1) && alt; let up = attack ? !flip : flip; envVolRaw = up ? localPhase : (1.0 - localPhase); }
            
            let envVolIndex = Math.min(15, Math.max(0, Math.floor(envVolRaw * 15.99)));

            let targetVolA = (this.regs[8] & 0x10) ? YM_DAC[envVolIndex] : YM_DAC[this.regs[8] & 0x0F];
            let targetVolB = (this.regs[9] & 0x10) ? YM_DAC[envVolIndex] : YM_DAC[this.regs[9] & 0x0F];
            let targetVolC = (this.regs[10] & 0x10) ? YM_DAC[envVolIndex] : YM_DAC[this.regs[10] & 0x0F];

            let slewSpeedA = (this.regs[8] & 0x10) ? 1.0 : (targetVolA > this.smoothVoltA ? 0.001 : 0.0001);
            let slewSpeedB = (this.regs[9] & 0x10) ? 1.0 : (targetVolB > this.smoothVoltB ? 0.002 : 0.0002);
            let slewSpeedC = (this.regs[10] & 0x10) ? 1.0 : (targetVolC > this.smoothVoltC ? 0.005 : 0.0005);
            
            this.smoothVoltA += (targetVolA - this.smoothVoltA) * slewSpeedA;
            this.smoothVoltB += (targetVolB - this.smoothVoltB) * slewSpeedB;
            this.smoothVoltC += (targetVolC - this.smoothVoltC) * slewSpeedC;

            let sweepA = Math.pow(this.smoothVoltA, 1.2);
            let sweepB = Math.pow(this.smoothVoltB, 1.2);
            let sweepC = Math.pow(this.smoothVoltC, 1.2);

            let cutA = 150 + sweepA * (6000 - stage.A.sub * 4200); 
            let cutB = 150 + sweepB * (6000 - stage.B.sub * 4200);
            let cutC = 150 + sweepC * (6000 - stage.C.sub * 4200);

            let resA = Math.max(0.01, 0.35 - (stage.A.sub * 0.3));
            let resB = Math.max(0.01, 0.35 - (stage.B.sub * 0.3));
            let resC = Math.max(0.01, 0.35 - (stage.C.sub * 0.3));

            let driveA = 1.0 + sweepA * 0.5;
            let drivenA_L = Math.tanh(sigA_L * driveA) / driveA;
            let drivenA_R = Math.tanh(sigA_R * driveA) / driveA;
            sigA_L = this.filterA_L.process(drivenA_L, cutA, resA, sampleRate);
            sigA_R = this.filterA_R.process(drivenA_R, cutA + 50, resA, sampleRate);

            let driveB = 1.0 + sweepB * 0.5;
            let drivenB_L = Math.tanh(sigB_L * driveB) / driveB;
            let drivenB_R = Math.tanh(sigB_R * driveB) / driveB;
            sigB_L = this.filterB_L.process(drivenB_L, cutB, resB, sampleRate);
            sigB_R = this.filterB_R.process(drivenB_R, cutB + 50, resB, sampleRate);

            let driveC = 1.0 + sweepC * 0.5;
            let drivenC_L = Math.tanh(sigC_L * driveC) / driveC;
            let drivenC_R = Math.tanh(sigC_R * driveC) / driveC;
            sigC_L = this.filterC_L.process(drivenC_L, cutC, resC, sampleRate);
            sigC_R = this.filterC_R.process(drivenC_R, cutC + 50, resC, sampleRate);

            let digiSample = 0;
            if (this.currentDigidrum) {
                let posInt = Math.floor(this.digiPos);
                if (posInt >= 0 && posInt < this.currentDigidrum.length - 2) {
                    let mu = this.digiPos - posInt;
                    let y0 = posInt > 0 ? this.currentDigidrum[posInt - 1] : 0;
                    let y1 = this.currentDigidrum[posInt];
                    let y2 = this.currentDigidrum[posInt + 1];
                    let y3 = this.currentDigidrum[posInt + 2];
                    
                    let rawSample = cubicInterpolate(y0, y1, y2, y3, mu) * 0.45; 
                    
                    let hpExciter = this.drumHp.process(rawSample, 3500, 0.15, sampleRate);
                    let highHarmonics = Math.tanh(hpExciter * 3.5) * 0.25;

                    digiSample = rawSample + highHarmonics;
                    this.digiPos += 8000 / sampleRate; 
                } else {
                    this.currentDigidrum = null; 
                }
            }

            let lvlA_L = sigA_L * this.smoothVoltA * this.sidechainEnv * 0.18;
            let lvlA_R = sigA_R * this.smoothVoltA * this.sidechainEnv * 0.18;
            let lvlB_L = sigB_L * this.smoothVoltB * this.sidechainEnv * 0.18;
            let lvlB_R = sigB_R * this.smoothVoltB * this.sidechainEnv * 0.18;
            let lvlC_L = sigC_L * this.smoothVoltC * this.sidechainEnv * 0.18;
            let lvlC_R = sigC_R * this.smoothVoltC * this.sidechainEnv * 0.18;

            let lvlD = digiSample * stage.drums.gain;

            let epL_A = Math.cos(stage.A.pan * Math.PI * 0.5); let epR_A = Math.sin(stage.A.pan * Math.PI * 0.5);
            let epL_B = Math.cos(stage.B.pan * Math.PI * 0.5); let epR_B = Math.sin(stage.B.pan * Math.PI * 0.5);
            let epL_C = Math.cos(stage.C.pan * Math.PI * 0.5); let epR_C = Math.sin(stage.C.pan * Math.PI * 0.5);
            let epL_D = Math.cos(stage.drums.pan * Math.PI * 0.5); let epR_D = Math.sin(stage.drums.pan * Math.PI * 0.5);

            let mixL = (lvlA_L * epL_A) + (lvlB_L * epL_B) + (lvlC_L * epL_C) + (lvlD * epL_D);
            let mixR = (lvlA_R * epR_A) + (lvlB_R * epR_B) + (lvlC_R * epR_C) + (lvlD * epR_D);

            const tap1 = this.delayTime;
            const tap2 = Math.floor(this.delayTime * 1.33);
            const tap3 = Math.floor(this.delayTime * 1.71);
            let readIdxL = (this.delayIdx - tap1 + 65536) % 65536;
            let readIdxR = (this.delayIdx - tap2 + 65536) % 65536;
            let readIdx3L = (this.delayIdx - tap3 + 65536) % 65536;
            let readIdx3R = (this.delayIdx - tap3 + 65536) % 65536;

            this.delayLpL += 0.2 * ((this.delayBufL[readIdxL] + this.delayBufR[readIdx3R]) * 0.5 - this.delayLpL); 
            this.delayLpR += 0.2 * ((this.delayBufR[readIdxR] + this.delayBufL[readIdx3L]) * 0.5 - this.delayLpR); 

            let finalL = mixL + this.delayLpL * 0.7; 
            let finalR = mixR + this.delayLpR * 0.7;

            this.delayBufL[this.delayIdx] = (lvlA_L * epL_A * stage.A.rev) + (lvlB_L * epL_B * stage.B.rev) + (lvlC_L * epL_C * stage.C.rev) + (lvlD * epL_D * stage.drums.rev) * 0.4 + this.delayLpL * 0.5;
            this.delayBufR[this.delayIdx] = (lvlA_R * epR_A * stage.A.rev) + (lvlB_R * epR_B * stage.B.rev) + (lvlC_R * epR_C * stage.C.rev) + (lvlD * epR_D * stage.drums.rev) * 0.4 + this.delayLpR * 0.5;
            this.delayIdx = (this.delayIdx + 1) & 65535;

            finalL = finalL > 0 ? Math.tanh(finalL * 2.0) : Math.tanh(finalL * 3.0) / 1.5;
            finalR = finalR > 0 ? Math.tanh(finalR * 2.0) : Math.tanh(finalR * 3.0) / 1.5;
            finalL *= 0.85; finalR *= 0.85; 

            let dcL = this.dcBlockL.process(finalL);
            let dcR = this.dcBlockR.process(finalR);

            outL[i] = dcL;
            if (outR) outR[i] = dcR;
            if (i === 0) currentVisualValue = (dcL + dcR) / 2.0;
        }

        this.visCounter = (this.visCounter || 0) + 1;
        if (this.visCounter % 4 === 0) {
            // === NEU: NATIVES SPEICHERKLONEN OHNE ENTWERTIERUNG ===
            let isAudible = Math.abs(currentVisualValue) > 0.001;
            if (isAudible || this.wasAudible) {
                const view = this.visualView;
                view[0] = 2; // System Flag: 2 = Atari ST
                view[1] = this.isPlaying ? 1 : 0;
                view[2] = this.currentFrame;
                view[3] = currentVisualValue;

                // Die 16 YM-Register bebefüllen
                for (let r = 0; r < 16; r++) {
                    view[4 + r] = this.regs[r];
                }

                // Stabiles postMessage
                this.port.postMessage(view);
            }
            this.wasAudible = isAudible;
        }
        return true; 
    }
}

registerProcessor('ym-bladerunner-processor', YMBladeRunnerProcessor);