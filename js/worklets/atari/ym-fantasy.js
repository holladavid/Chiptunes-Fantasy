// === js/worklets/atari/ym-fantasy.js ===
// =========================================================
// YM2149F CORE (CHIPTUNES FANTASY EDITION)
// Fully Synced with Shared YMVisualizer I/O
// =========================================================

import { YM_DAC, polyBLEP, cubicInterpolate, FourPoleFilter, MoogFilter, DCBlocker, detectDigidrum, detectDigidrumVoice } from '../lib/dsp-utils.js';
import { DynamicStaging } from '../lib/dynamic-staging.js';
import { YMVisualizer } from '../lib/ym-visualizer.js';

function nextPow2(v) {
    let p = 1;
    while (p < v) p <<= 1;
    return p;
}

class YMFantasyProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.clock = 2000000;
        this.regs = new Uint8Array(16);
        this.phaseA = 0; this.phaseB1 = 0; this.phaseB2 = 0; this.phaseC = 0;
        this.subPhaseA = 0; this.subPhaseB = 0; this.subPhaseC = 0;

        this.lfoPhase1 = 0.0;
        this.noiseLfsr = 1; this.noisePhase = 0; this.noiseOutput = 1;
        this.envPhase = 0.0;

        this.stager = new DynamicStaging();

        this.filterA = new FourPoleFilter();
        this.filterB_L = new FourPoleFilter(); this.filterB_R = new FourPoleFilter();
        this.filterC_L = new FourPoleFilter(); this.filterC_R = new FourPoleFilter();

        this.noiseHp = new MoogFilter();
        this.noiseLp1 = new MoogFilter(); this.noiseLp2 = new MoogFilter();
        this.drumHp = new MoogFilter();

        this.dcBlockL = new DCBlocker(sampleRate, 20.0);
        this.dcBlockR = new DCBlocker(sampleRate, 20.0);

        this.delaySize = nextPow2(Math.ceil(sampleRate * 1.25));
        this.delayMask = this.delaySize - 1;
        this.delayBufL = new Float32Array(this.delaySize);
        this.delayBufR = new Float32Array(this.delaySize);
        this.delayIdx = 0;
        this.delayTime = Math.floor(sampleRate * 0.375);
        this.tap1 = Math.floor(sampleRate * 0.43);
        this.tap2 = Math.floor(sampleRate * 0.71);
        this.tap3 = Math.floor(sampleRate * 1.13);
        this.delayLpL = 0; this.delayLpR = 0;
        this.delayLpCoef = 1.0 - Math.exp(-2.0 * Math.PI * 1900.0 / sampleRate);

        this.stageCoef = 1.0 - Math.exp(-96.0 / sampleRate);
        this.sidechainCoef = 1.0 - Math.exp(-96.0 / sampleRate);
        this.slewAtkCoef = 1.0 - Math.exp(-96.0 / sampleRate);
        this.slewRelCoef = 1.0 - Math.exp(-14.4 / sampleRate);

        this.smoothVoltA = 0; this.smoothVoltB = 0; this.smoothVoltC = 0;
        this.sidechainEnv = 1.0;

        this.digidrums = []; this.currentDigidrum = null; this.digiPos = 0; this.lastDigiTrigger = 0;
        this.currentDrumVoice = 0;
        this.trackData = null; this.currentFrame = 0;
        this.playerRate = 50; this.loopFrame = 0;
        this.sampleCounter = 0; this.isPlaying = false;
        this.fadeVol = 0.0;
        this.fadeStep = 1.0 / Math.max(1, Math.round(0.010 * sampleRate));

        this.volA = 0.0; this.volB = 0.0; this.volC = 0.0;
        this.visualEnvelopeLevel = 0;

        this.visualizer = new YMVisualizer(this.port);

        this.port.onmessage = (event) => {
            const msg = event.data;
            if (msg.type === 'PLAY_TRACK') {
                this.resetState();
                this.trackData = Array.isArray(msg.track) ? msg.track : null;
                const trackLen = this.trackData ? this.trackData.length : 0;
                this.digidrums = msg.digidrums || [];
                this.currentFrame = 0;
                this.playerRate = Number.isFinite(msg.playerRate) && msg.playerRate > 0 ? msg.playerRate : 50;
                this.loopFrame = Number.isInteger(msg.loopFrame) && msg.loopFrame >= 0 && msg.loopFrame < trackLen
                    ? msg.loopFrame
                    : 0;
                this.sampleCounter = 0;
                this.fadeVol = 0.0;
                this.isPlaying = trackLen > 0;
            } else if (msg.type === 'STOP_TRACK') {
                this.isPlaying = false;
            } else if (msg.type === 'RESUME_TRACK') {
                this.isPlaying = !!(this.trackData && this.trackData.length > 0);
            } else if (msg.type === 'SEEK_TRACK') {
                if (this.trackData && this.trackData.length > 0) {
                    const len = this.trackData.length;
                    const target = Number.isFinite(msg.frame) ? Math.trunc(msg.frame) : 0;
                    this.currentFrame = ((target % len) + len) % len;
                    this.sampleCounter = 0;
                    this.currentDigidrum = null;
                    this.lastDigiTrigger = 0;
                    this.currentDrumVoice = 0;
                }
            }
        };
    }

    resetState() {
        this.regs.fill(0);
        this.phaseA = 0; this.phaseB1 = 0; this.phaseB2 = 0; this.phaseC = 0;
        this.subPhaseA = 0; this.subPhaseB = 0; this.subPhaseC = 0;
        this.lfoPhase1 = 0.0;
        this.noiseLfsr = 1; this.noisePhase = 0; this.noiseOutput = 1;
        this.envPhase = 0.0;
        this.smoothVoltA = 0; this.smoothVoltB = 0; this.smoothVoltC = 0;
        this.sidechainEnv = 1.0;
        this.volA = 0.0; this.volB = 0.0; this.volC = 0.0;
        this.visualEnvelopeLevel = 0;
        this.currentDigidrum = null; this.digiPos = 0; this.lastDigiTrigger = 0;
        this.currentDrumVoice = 0;

        for (const f of [this.filterA, this.filterB_L, this.filterB_R, this.filterC_L, this.filterC_R]) {
            f.l1 = 0; f.b1 = 0; f.l2 = 0; f.b2 = 0;
        }
        for (const f of [this.noiseHp, this.noiseLp1, this.noiseLp2, this.drumHp]) {
            f.low = 0; f.band = 0;
        }
        this.dcBlockL.lastIn = 0; this.dcBlockL.lastOut = 0;
        this.dcBlockR.lastIn = 0; this.dcBlockR.lastOut = 0;
        this.delayBufL.fill(0);
        this.delayBufR.fill(0);
        this.delayIdx = 0;
        this.delayLpL = 0; this.delayLpR = 0;
    }

    process(inputs, outputs) {
        const outL = outputs[0][0];
        const outR = outputs[0].length > 1 ? outputs[0][1] : null;
        let currentVisualValue = 0;

        for (let i = 0; i < outL.length; i++) {
            if (this.isPlaying) this.fadeVol = Math.min(1.0, this.fadeVol + this.fadeStep);
            else this.fadeVol = Math.max(0.0, this.fadeVol - this.fadeStep);

            if (this.fadeVol === 0.0) {
                outL[i] = 0;
                if (outR) outR[i] = 0;
                continue;
            }

            if (this.trackData && this.trackData.length > 0) {
                this.sampleCounter--;
                if (this.sampleCounter <= 0) {
                    const overshoot = -this.sampleCounter;
                    this.sampleCounter += sampleRate / this.playerRate;
                    const frame = this.trackData[this.currentFrame];
                    if (frame) {
                        for (let r = 0; r < 16; r++) {
                            if (r === 13) {
                                if (frame[13] !== 0xFF) {
                                    this.regs[13] = frame[13];
                                    const pE = (this.regs[12] << 8) | this.regs[11];
                                    const incEnv = (2000000 / (256 * (pE === 0 ? 1 : pE))) / sampleRate;
                                    this.envPhase = overshoot * incEnv;
                                }
                            } else this.regs[r] = frame[r];
                        }

                        const activeDigiTrigger = detectDigidrum(frame);
                        const activeDigiVoice = detectDigidrumVoice(frame);

                        if (activeDigiTrigger > 0 && activeDigiTrigger !== this.lastDigiTrigger) {
                            if (this.digidrums[activeDigiTrigger - 1]) {
                                this.currentDigidrum = this.digidrums[activeDigiTrigger - 1];
                                this.digiPos = overshoot * (7812.5 / sampleRate);
                                this.sidechainEnv = 0.45;
                                this.port.postMessage({ type: 'DEBUG', msg: 'Drum ' + activeDigiTrigger });
                            }
                        }
                        this.lastDigiTrigger = activeDigiTrigger;
                        if (activeDigiTrigger > 0) this.currentDrumVoice = activeDigiVoice;

                        const pA = ((this.regs[1] & 0x0F) << 8) | this.regs[0];
                        const pB = ((this.regs[3] & 0x0F) << 8) | this.regs[2];
                        const pC = ((this.regs[5] & 0x0F) << 8) | this.regs[4];

                        const incA = (2000000 / (16 * (pA === 0 ? 1 : pA))) / sampleRate;
                        const incB = (2000000 / (16 * (pB === 0 ? 1 : pB))) / sampleRate;
                        const incC = (2000000 / (16 * (pC === 0 ? 1 : pC))) / sampleRate;

                        this.phaseA = (this.phaseA + overshoot * incA) % 1.0;
                        this.phaseB1 = (this.phaseB1 + overshoot * incB) % 1.0;
                        this.phaseB2 = (this.phaseB2 + overshoot * (incB * 1.003)) % 1.0;
                        this.phaseC = (this.phaseC + overshoot * incC) % 1.0;

                        this.subPhaseA = (this.subPhaseA + overshoot * (incA * 0.5)) % 1.0;
                        this.subPhaseB = (this.subPhaseB + overshoot * (incB * 0.5)) % 1.0;
                        this.subPhaseC = (this.subPhaseC + overshoot * (incC * 0.5)) % 1.0;
                    }

                    this.currentFrame++;
                    if (this.currentFrame >= this.trackData.length) this.currentFrame = this.loopFrame;
                }
            }

            this.sidechainEnv += (1.0 - this.sidechainEnv) * this.sidechainCoef;

            const pA = ((this.regs[1] & 0x0F) << 8) | this.regs[0];
            const pB = ((this.regs[3] & 0x0F) << 8) | this.regs[2];
            const pC = ((this.regs[5] & 0x0F) << 8) | this.regs[4];

            const incA = (2000000 / (16 * (pA === 0 ? 1 : pA))) / sampleRate;
            const incB = (2000000 / (16 * (pB === 0 ? 1 : pB))) / sampleRate;
            const incC = (2000000 / (16 * (pC === 0 ? 1 : pC))) / sampleRate;

            this.phaseA = (this.phaseA + incA) % 1.0;
            this.phaseB1 = (this.phaseB1 + incB) % 1.0;
            this.phaseB2 = (this.phaseB2 + incB * 1.003) % 1.0;
            this.phaseC = (this.phaseC + incC) % 1.0;

            this.subPhaseA = (this.subPhaseA + incA * 0.5) % 1.0;
            this.subPhaseB = (this.subPhaseB + incB * 0.5) % 1.0;
            this.subPhaseC = (this.subPhaseC + incC * 0.5) % 1.0;

            this.lfoPhase1 = (this.lfoPhase1 + 1.8 / sampleRate) % 1.0;

            const mix = this.regs[7];
            const tA = (mix & 0x01) === 0; const tB = (mix & 0x02) === 0; const tC = (mix & 0x04) === 0;
            const nA = (mix & 0x08) === 0; const nB = (mix & 0x10) === 0; const nC = (mix & 0x20) === 0;

            if (!this.currentDigidrum) this.currentDrumVoice = 0;

            const stage = this.stager.update(pA, pB, pC, nA, nB, nC, this.stageCoef, this.currentDrumVoice);

            const sqA = (this.phaseA < 0.5 ? 1.0 : -1.0) + polyBLEP(this.phaseA, incA) - polyBLEP((this.phaseA + 0.5) % 1.0, incA);
            const sFundA = Math.sin(this.phaseA * 2.0 * Math.PI);
            const sSubA = Math.sin(this.subPhaseA * 2.0 * Math.PI);
            let sigA = tA ? (sqA * (1.0 - stage.A.sub * 0.4) + sFundA * stage.A.sub * 1.0 + sSubA * stage.A.sub * 0.7) : 0.0;

            const sawB1 = ((this.phaseB1 * 2.0) - 1.0) - polyBLEP(this.phaseB1, incB);
            const sawB2 = ((this.phaseB2 * 2.0) - 1.0) - polyBLEP(this.phaseB2, incB * 1.003);
            const sFundB = Math.sin(this.phaseB1 * 2.0 * Math.PI);
            const sSubB = Math.sin(this.subPhaseB * 2.0 * Math.PI);
            let sigB_L = tB ? (sawB1 * (1.0 - stage.B.sub * 0.4) + sFundB * stage.B.sub * 1.0 + sSubB * stage.B.sub * 0.7) : 0.0;
            let sigB_R = tB ? (sawB2 * (1.0 - stage.B.sub * 0.4) + sFundB * stage.B.sub * 1.0 + sSubB * stage.B.sub * 0.7) : 0.0;

            const pwmWidth = Math.sin(this.lfoPhase1 * 2.0 * Math.PI) * 0.3 + 0.5;
            const pwmC = (this.phaseC < pwmWidth ? 1.0 : -1.0) + polyBLEP(this.phaseC, incC) - polyBLEP((this.phaseC + pwmWidth) % 1.0, incC);
            const sFundC = Math.sin(this.phaseC * 2.0 * Math.PI);
            const sSubC = Math.sin(this.subPhaseC * 2.0 * Math.PI);
            let sigC_L = tC ? (pwmC * (1.0 - stage.C.sub * 0.4) + sFundC * stage.C.sub * 1.0 + sSubC * stage.C.sub * 0.7) : 0.0;
            let sigC_R = sigC_L;

            const pN = this.regs[6] & 0x1F;
            this.noisePhase += (2000000 / (16 * (pN === 0 ? 1 : pN))) / sampleRate;
            if (this.noisePhase >= 1.0) {
                this.noisePhase %= 1.0;
                this.noiseLfsr ^= (((this.noiseLfsr & 1) ^ ((this.noiseLfsr >> 3) & 1)) << 17);
                this.noiseLfsr >>= 1;
                this.noiseOutput = (this.noiseLfsr & 1) ? 1.0 : -1.0;
            }

            let noiseVal = 0; let subNoiseVal = 0;
            if (nA || nB || nC) {
                const rawNoise = (Math.random() * 2.0 - 1.0);
                if (pN > 12) {
                    const cutoffN = 150 + (31 - pN) * 20;
                    const nLow1 = this.noiseLp1.process(rawNoise, cutoffN, 0.2, sampleRate);
                    subNoiseVal = this.noiseLp2.process(nLow1, cutoffN, 0.2, sampleRate) * 2.0;
                } else {
                    const cutoffHp = 4000 + (12 - pN) * 500;
                    const hpHigh = rawNoise - this.noiseHp.process(rawNoise, cutoffHp, 0.5, sampleRate);
                    noiseVal = hpHigh * 0.6;
                }
            }

            if (nA) sigA += noiseVal + subNoiseVal;
            if (nB) { sigB_L += noiseVal + subNoiseVal; sigB_R += noiseVal + subNoiseVal; }
            if (nC) { sigC_L += noiseVal + subNoiseVal; sigC_R += noiseVal + subNoiseVal; }

            const pE = (this.regs[12] << 8) | this.regs[11];
            this.envPhase += (2000000 / (256 * (pE === 0 ? 1 : pE))) / sampleRate;
            const shape = this.regs[13] & 0x0F;
            const cycles = Math.floor(this.envPhase);
            const localPhase = this.envPhase - cycles;
            let envVolRaw = 0;

            const attack = (shape & 4) !== 0; const cont = (shape & 8) !== 0;
            let alt = (shape & 2) !== 0; let hold = (shape & 1) !== 0;
            if (!cont) { hold = true; alt = false; } else { hold = (shape & 1) !== 0; alt = (shape & 2) !== 0; }
            if (cycles > 0 && hold) { envVolRaw = (alt ? (attack ? 0.0 : 1.0) : (attack ? 1.0 : 0.0)); }
            else { const flip = (cycles % 2 === 1) && alt; const up = attack ? !flip : flip; envVolRaw = up ? localPhase : (1.0 - localPhase); }

            const envVolIndex = Math.min(15, Math.max(0, Math.floor(envVolRaw * 15.99)));
            this.visualEnvelopeLevel = envVolIndex / 15;

            const targetVolA = (this.regs[8] & 0x10) ? YM_DAC[envVolIndex] : YM_DAC[this.regs[8] & 0x0F];
            const targetVolB = (this.regs[9] & 0x10) ? YM_DAC[envVolIndex] : YM_DAC[this.regs[9] & 0x0F];
            const targetVolC = (this.regs[10] & 0x10) ? YM_DAC[envVolIndex] : YM_DAC[this.regs[10] & 0x0F];

            const slewSpeedA = (this.regs[8] & 0x10) ? 1.0 : (targetVolA > this.smoothVoltA ? this.slewAtkCoef : this.slewRelCoef);
            const slewSpeedB = (this.regs[9] & 0x10) ? 1.0 : (targetVolB > this.smoothVoltB ? this.slewAtkCoef : this.slewRelCoef);
            const slewSpeedC = (this.regs[10] & 0x10) ? 1.0 : (targetVolC > this.smoothVoltC ? this.slewAtkCoef : this.slewRelCoef);

            this.smoothVoltA += (targetVolA - this.smoothVoltA) * slewSpeedA;
            this.smoothVoltB += (targetVolB - this.smoothVoltB) * slewSpeedB;
            this.smoothVoltC += (targetVolC - this.smoothVoltC) * slewSpeedC;

            const sweepA = Math.pow(this.smoothVoltA, 1.5);
            const sweepB = Math.pow(this.smoothVoltB, 1.5);
            const sweepC = Math.pow(this.smoothVoltC, 1.5);

            const cutA = 250 + sweepA * (12000 - stage.A.sub * 10000);
            const cutB = 250 + sweepB * (12000 - stage.B.sub * 10000);
            const cutC = 250 + sweepC * (12000 - stage.C.sub * 10000);

            const driveA = 1.0 + sweepA * 0.4;
            sigA = this.filterA.process(Math.tanh(sigA * driveA) / driveA, cutA, 0.45 - stage.A.sub * 0.35, sampleRate);

            const driveB = 1.0 + sweepB * 0.4;
            sigB_L = this.filterB_L.process(Math.tanh(sigB_L * driveB) / driveB, cutB, 0.45 - stage.B.sub * 0.35, sampleRate);
            sigB_R = this.filterB_R.process(Math.tanh(sigB_R * driveB) / driveB, cutB + 50, 0.45 - stage.B.sub * 0.35, sampleRate);

            const driveC = 1.0 + sweepC * 0.4;
            sigC_L = this.filterC_L.process(Math.tanh(sigC_L * driveC) / driveC, cutC, 0.45 - stage.C.sub * 0.35, sampleRate);
            sigC_R = this.filterC_R.process(Math.tanh(sigC_R * driveC) / driveC, cutC + 50, 0.45 - stage.C.sub * 0.35, sampleRate);

            const volA = this.smoothVoltA;
            const volB = this.smoothVoltB;
            const volC = this.smoothVoltC;
            this.volA = volA; this.volB = volB; this.volC = volC;

            let digiSample = 0;
            if (this.currentDigidrum) {
                const posInt = Math.floor(this.digiPos);
                if (posInt >= 0 && posInt < this.currentDigidrum.length - 2) {
                    const mu = this.digiPos - posInt;
                    const rawSample = cubicInterpolate(
                        this.currentDigidrum[posInt - 1] || 0, this.currentDigidrum[posInt],
                        this.currentDigidrum[posInt + 1] || 0, this.currentDigidrum[posInt + 2] || 0, mu) * 0.8;

                    const hpExciter = this.drumHp.process(rawSample, 3500, 0.15, sampleRate);
                    const highHarmonics = Math.tanh(hpExciter * 3.5) * 0.28;

                    digiSample = rawSample + highHarmonics;
                    this.digiPos += 7812.5 / sampleRate;
                } else {
                    this.currentDigidrum = null;
                }
            }

            const lvlA_L = sigA * volA * this.sidechainEnv * 0.18;
            const lvlA_R = lvlA_L;
            const lvlB_L = sigB_L * volB * this.sidechainEnv * 0.18;
            const lvlB_R = sigB_R * volB * this.sidechainEnv * 0.18;
            const lvlC_L = sigC_L * volC * this.sidechainEnv * 0.18;
            const lvlC_R = sigC_R * volC * this.sidechainEnv * 0.18;
            const lvlD = digiSample * stage.drums.gain;

            const epL_A = Math.cos(stage.A.pan * Math.PI * 0.5); const epR_A = Math.sin(stage.A.pan * Math.PI * 0.5);
            const epL_B = Math.cos(stage.B.pan * Math.PI * 0.5); const epR_B = Math.sin(stage.B.pan * Math.PI * 0.5);
            const epL_C = Math.cos(stage.C.pan * Math.PI * 0.5); const epR_C = Math.sin(stage.C.pan * Math.PI * 0.5);
            const epL_D = Math.cos(stage.drums.pan * Math.PI * 0.5); const epR_D = Math.sin(stage.drums.pan * Math.PI * 0.5);

            const mixL = (lvlA_L * epL_A) + (lvlB_L * epL_B) + (lvlC_L * epL_C) + (lvlD * epL_D);
            const mixR = (lvlA_R * epR_A) + (lvlB_R * epR_B) + (lvlC_R * epR_C) + (lvlD * epR_D);

            const readIdxL = (this.delayIdx - this.tap1) & this.delayMask;
            const readIdxR = (this.delayIdx - this.tap2) & this.delayMask;
            const readIdx3L = (this.delayIdx - this.tap3) & this.delayMask;
            const readIdx3R = (this.delayIdx - this.tap3) & this.delayMask;

            const r1L = this.delayBufL[readIdxL];
            const r2R = this.delayBufR[readIdxR];
            const r3L = this.delayBufL[readIdx3L];
            const r3R = this.delayBufR[readIdx3R];

            this.delayLpL += this.delayLpCoef * ((r1L + r3R) * 0.5 - this.delayLpL);
            this.delayLpR += this.delayLpCoef * ((r2R + r3L) * 0.5 - this.delayLpR);

            let finalL = mixL + this.delayLpL * 0.6;
            let finalR = mixR + this.delayLpR * 0.6;

            const revL = (lvlA_L * epL_A * stage.A.rev) + (lvlB_L * epL_B * stage.B.rev) + (lvlC_L * epL_C * stage.C.rev) + (lvlD * epL_D * stage.drums.rev);
            const revR = (lvlA_R * epR_A * stage.A.rev) + (lvlB_R * epR_B * stage.B.rev) + (lvlC_R * epR_C * stage.C.rev) + (lvlD * epR_D * stage.drums.rev);

            this.delayBufL[this.delayIdx] = revR * 0.4 + this.delayLpL * 0.5;
            this.delayBufR[this.delayIdx] = revL * 0.4 + this.delayLpR * 0.5;
            this.delayIdx = (this.delayIdx + 1) & this.delayMask;

            finalL = (Math.tanh(finalL * 2.8) / 1.1) * 0.95;
            finalR = (Math.tanh(finalR * 2.8) / 1.1) * 0.95;

            const dcL = this.dcBlockL.process(finalL) * this.fadeVol;
            const dcR = this.dcBlockR.process(finalR) * this.fadeVol;

            if (outR) {
                outL[i] = dcL;
                outR[i] = dcR;
            } else {
                outL[i] = (dcL + dcR) * 0.5;
            }
            if (i === 0) currentVisualValue = (dcL + dcR) * 0.5;
        }

        this.visualizer.update(this.isPlaying, this.currentFrame, currentVisualValue, this.regs, this.volA, this.volB, this.volC, this.noiseOutput, this.visualEnvelopeLevel || 0);
        return true;
    }
}

registerProcessor('ym-fantasy-processor', YMFantasyProcessor);