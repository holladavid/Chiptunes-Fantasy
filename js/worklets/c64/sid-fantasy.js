// === js/worklets/c64/sid-fantasy.js ===
// =========================================================
// MOS 6581 / CSG 8580 "CHIPTUNES FANTASY STUDIO" CORE
// Audiophile Edition: 1MHz 6502 Lockstep, Dual-Channel 255-Tap Sinc-FIR,
// CSG 8580 Linear DACs, 20kHz Studio Airband ZDF VCF, StereoSID Staging
// & Digidrum Transient Sub-Exciter
// =========================================================

import { CPU6502 } from '../lib/cpu6502.js';
import { calculateWaveform8Bit } from '../lib/sid-waveforms.js';
import { DAC_LUT_8580, PWM_LUT, RATE_COUNTER_PERIOD } from '../lib/sid-luts.js';
import { DCBlocker } from '../lib/dsp-utils.js';

const ENV_ATTACK = 0, ENV_DECAY = 1, ENV_RELEASE = 2; 

// Linear-proportionale 4-Bit Lautstärketabelle (CSG 8580 HiFi R-2R)
const VOLUME_DAC_8580 = new Float32Array([
    0.0000, 0.0667, 0.1333, 0.2000, 0.2667, 0.3333, 0.4000, 0.4667,
    0.5333, 0.6000, 0.6667, 0.7333, 0.8000, 0.8667, 0.9333, 1.0000
]);

class SIDFantasyChip {
    constructor() {
        this.regs = new Uint8Array(29);
        this.voices = [];
        for (let i = 0; i < 3; i++) {
            this.voices.push({
                freq: 0, pw: 2048, ctrl: 0, env: 0, phase: 0,
                state: ENV_RELEASE, prevGate: false,
                waveOut8Bit: 0x80, 
                busCharge: 0x80,
                env8Bit: 0, lfsr: 0x7FFFFF,
                rate_counter: 0, exponential_counter: 0, envelope_counter: 0,
                attack_period: RATE_COUNTER_PERIOD[0],
                decay_period: RATE_COUNTER_PERIOD[0],
                sustain_level: 0,
                release_period: RATE_COUNTER_PERIOD[0],
                msbRisingEdge: false,
                envDelay: 0,
                wrapped: false
            });
        }
        this.cutoff = 30; this.resonance = 0; this.filterMode = 0; this.masterVol = 0;
        
        // ZDF State-Space Memory für Stereo-VCF (L & R)
        this.x1_L = 0.0; this.x2_L = 0.0;
        this.x1_R = 0.0; this.x2_R = 0.0;

        this.outputSampleL = 0;
        this.outputSampleR = 0;
        
        this.activeCutoff = 30.0;
        this.q = 1.0;
        
        // StereoSID Panning-Winkel (Constant Power)
        // Voice 1: ~30% Left | Voice 2: ~30% Right | Voice 3: Center (0%)
        this.panL0 = 0.82; this.panR0 = 0.57; // 35°
        this.panL1 = 0.57; this.panR1 = 0.82; // 55°
        this.panL2 = 0.707; this.panR2 = 0.707; // 45° (Center)

        this.lastVol = 0;
        this.drumTransientEnv = 0.0;
        this.drumSubPhase = 0.0;
        this.d418Writes = 0;

        this.updateFilterParameters();
    }

    updateFilterParameters() {
        let cutoffReg = (this.regs[21] & 7) | (this.regs[22] << 3);
        let norm = cutoffReg / 2047.0;

        // 20 kHz Linear Studio Curve (CSG 8580 Airband)
        this.activeCutoff = 20.0 + Math.pow(norm, 1.25) * 19980.0;

        let resReg = this.regs[23] >> 4;
        let normRes = resReg / 15.0;
        this.q = 1.414 - (normRes * 1.15); // Clean Q_max ~ 3.8
    }

    writeReg(reg, val) {
        if (reg >= 29) return;
        this.regs[reg] = val;
        
        let vIdx = (reg / 7) | 0;
        if (vIdx < 3) {
            let ch = this.voices[vIdx];
            let base = vIdx * 7;
            
            ch.freq = this.regs[base] | (this.regs[base+1] << 8);
            ch.pw = this.regs[base+2] | ((this.regs[base+3] & 15) << 8);
            
            let prevCtrl = ch.ctrl;
            ch.ctrl = this.regs[base+4];
            
            let gate = (ch.ctrl & 1) !== 0;
            let prevGate = (prevCtrl & 1) !== 0;
            
            if (gate !== prevGate) {
                ch.envDelay = 1;
                ch.state = gate ? ENV_ATTACK : ENV_RELEASE;
                if (gate) {
                    ch.rate_counter = 0;
                    ch.exponential_counter = 0;
                }
            }
            ch.prevGate = gate;

            if (ch.ctrl & 8) {
                ch.phase = 0; 
                ch.lfsr = 0x7FFFFF;
            }

            if (reg === base + 5) { 
                ch.attack_period = RATE_COUNTER_PERIOD[val >> 4];
                ch.decay_period = RATE_COUNTER_PERIOD[val & 15];
            } else if (reg === base + 6) { 
                ch.sustain_level = (val >> 4) | ((val >> 4) << 4);
                ch.release_period = RATE_COUNTER_PERIOD[val & 15];
            }
        } else if (reg === 21 || reg === 22 || reg === 23) {
            this.updateFilterParameters();
        } else if (reg === 24) {
            this.filterMode = val;
            this.d418Writes++; 
            
            let volIndex = val & 15;
            let newVol = VOLUME_DAC_8580[volIndex];
            
            // Transient Shaper: Fängt steile Kanten bei Drum-Writes ab
            let delta = Math.abs(newVol - this.lastVol);
            if (delta > 0.15) {
                this.drumTransientEnv = 1.0;
            }
            this.lastVol = newVol;
            this.masterVol = newVol;
        }
    }

    clockEnvelopeOneCycle(v) {
        let ch = this.voices[v];
        if (ch.envDelay > 0) { ch.envDelay--; return; }

        let ratePeriod = ch.release_period;
        if (ch.state === ENV_ATTACK) ratePeriod = ch.attack_period;
        else if (ch.state === ENV_DECAY) ratePeriod = ch.decay_period;

        ch.rate_counter++;
        if (ch.rate_counter >= ratePeriod) {
            ch.rate_counter = 0; 

            let expPeriod = 1;
            if (ch.state !== ENV_ATTACK) {
                let envVal = ch.envelope_counter;
                if (envVal >= 93) expPeriod = 1;
                else if (envVal >= 54) expPeriod = 2;
                else if (envVal >= 26) expPeriod = 4;
                else if (envVal >= 14) expPeriod = 8;
                else if (envVal >= 6) expPeriod = 16;
                else expPeriod = 30;
            }

            ch.exponential_counter++;
            if (ch.exponential_counter >= expPeriod) {
                ch.exponential_counter = 0;
                if (ch.state === ENV_ATTACK) {
                    ch.envelope_counter++;
                    if (ch.envelope_counter >= 255) {
                        ch.envelope_counter = 255;
                        ch.state = ENV_DECAY;
                    }
                } else if (ch.state === ENV_DECAY) {
                    if (ch.envelope_counter !== ch.sustain_level && ch.envelope_counter > 0) {
                        ch.envelope_counter--;
                    }
                } else if (ch.state === ENV_RELEASE) {
                    if (ch.envelope_counter > 0) ch.envelope_counter--;
                }
            }
        }
    }

    synthesizeVoiceOneCycle(v) {
        let ch = this.voices[v];
        let freqInt = ch.freq;
        let pwInt = ch.pw;

        if ((ch.ctrl & 8) === 0) {
            let oldAcc = ch.phase;
            let newAcc = (ch.phase + freqInt) & 0xFFFFFF;

            let prevIdx = v === 0 ? 2 : v - 1;
            let prevCh = this.voices[prevIdx];
            if ((ch.ctrl & 2) !== 0 && prevCh.msbRisingEdge) newAcc = 0; 

            ch.msbRisingEdge = ((oldAcc & 0x800000) === 0) && ((newAcc & 0x800000) !== 0);
            ch.phase = newAcc;

            let oldStep = oldAcc & 0x080000;
            let newStep = ch.phase & 0x080000;
            if (!oldStep && newStep) {
                let bit = ((ch.lfsr >> 22) ^ (ch.lfsr >> 17)) & 1;
                if ((ch.ctrl & 0x80) && (ch.ctrl & 0x70) !== 0) {
                    let testPhase = (ch.phase >> 12) & 0xFFF;
                    let pwMapped = PWM_LUT[pwInt & 0xFFF];
                    let isPulseLow = (ch.ctrl & 0x40) && (testPhase >= pwMapped);
                    if (isPulseLow || (ch.ctrl & 0x30)) bit = 0; 
                }
                ch.lfsr = ((ch.lfsr << 1) & 0x7FFFFF) | bit;
            }
        } else {
            ch.msbRisingEdge = false;
        }

        let prevIdx = v === 0 ? 2 : v - 1;
        let prevCh = this.voices[prevIdx];
        let ownMSB = (ch.phase >> 23) & 1;
        let prevMSB = (prevCh.phase >> 23) & 1;
        let ringMSB = (ch.ctrl & 4) ? (ownMSB ^ prevMSB) : ownMSB;

        let hasWave = (ch.ctrl & 0xF0) !== 0;
        if (hasWave) {
            let rawWave8Bit = calculateWaveform8Bit(ch.ctrl, ch.phase, pwInt, ch.lfsr, ringMSB);
            let waveMask = ch.ctrl & 0xF0;
            let isCombined = (waveMask !== 0x10 && waveMask !== 0x20 && waveMask !== 0x40 && waveMask !== 0x80);

            if (isCombined) {
                ch.busCharge += 0.88 * (rawWave8Bit - ch.busCharge);
                ch.waveOut8Bit = ch.busCharge;
            } else {
                ch.busCharge = rawWave8Bit;
                ch.waveOut8Bit = rawWave8Bit;
            }
        } else {
            ch.busCharge += 0.0002 * (0x80 - ch.busCharge);
            ch.waveOut8Bit = ch.busCharge;
        }

        ch.env8Bit = ch.envelope_counter;

        // CSG 8580 Linear R-2R Lookup
        let envDac = DAC_LUT_8580[ch.env8Bit];
        let waveDac = DAC_LUT_8580[Math.floor(ch.waveOut8Bit)];
        let waveOutFloat = (waveDac * 2.0) - 1.0;
        
        return waveOutFloat * envDac;
    }

    clock() {
        for (let v = 0; v < 3; v++) {
            this.clockEnvelopeOneCycle(v);
        }

        let voice0 = this.synthesizeVoiceOneCycle(0);
        let voice1 = this.synthesizeVoiceOneCycle(1);
        let voice2 = this.synthesizeVoiceOneCycle(2);

        // =========================================================
        // STEREOSID DYNAMIC SPATIAL STAGING
        // =========================================================
        let v0_L = voice0 * this.panL0; let v0_R = voice0 * this.panR0;
        let v1_L = voice1 * this.panL1; let v1_R = voice1 * this.panR1;
        let v2_L = voice2 * this.panL2; let v2_R = voice2 * this.panR2;

        const isVoice3Off = (this.filterMode & 128) !== 0;

        let filtSumL = 0, unfiltSumL = 0;
        let filtSumR = 0, unfiltSumR = 0;

        if (this.regs[23] & 1) { filtSumL += v0_L; filtSumR += v0_R; } else { unfiltSumL += v0_L; unfiltSumR += v0_R; }
        if (this.regs[23] & 2) { filtSumL += v1_L; filtSumR += v1_R; } else { unfiltSumL += v1_L; unfiltSumR += v1_R; }
        
        if (!isVoice3Off) {
            if (this.regs[23] & 4) { filtSumL += v2_L; filtSumR += v2_R; } else { unfiltSumL += v2_L; unfiltSumR += v2_R; }
        }

        // =========================================================
        // 20kHz STEREO ZDF STATE-SPACE OTA FILTER (CSG 8580 AIRBAND)
        // =========================================================
        let subG = Math.tan((Math.PI * this.activeCutoff) / 1970496); // 2MHz Sub-sample Grid
        let k = this.q;
        let denom = 1.0 + subG * (subG + k);
        
        let filterOutL = 0, filterOutR = 0;

        for (let sub = 0; sub < 2; sub++) {
            // LEFT CHANNEL
            let hpL = (filtSumL - this.x1_L * (subG + k) - this.x2_L) / denom;
            let bpRawL = subG * hpL + this.x1_L;
            let bpL = Math.tanh(bpRawL * 0.65) / 0.65;
            let lpL = subG * bpL + this.x2_L;

            this.x1_L = 2.0 * bpL - this.x1_L;
            this.x2_L = 2.0 * lpL - this.x2_L;

            let outLpL = (this.filterMode & 16) ? lpL : 0;
            let outBpL = (this.filterMode & 32) ? bpL : 0;
            let outHpL = (this.filterMode & 64) ? hpL : 0;
            if ((this.filterMode & 80) === 80) outHpL = -outHpL * 0.95;
            filterOutL = outLpL + outBpL + outHpL;

            // RIGHT CHANNEL
            let hpR = (filtSumR - this.x1_R * (subG + k) - this.x2_R) / denom;
            let bpRawR = subG * hpR + this.x1_R;
            let bpR = Math.tanh(bpRawR * 0.65) / 0.65;
            let lpR = subG * bpR + this.x2_R;

            this.x1_R = 2.0 * bpR - this.x1_R;
            this.x2_R = 2.0 * lpR - this.x2_R;

            let outLpR = (this.filterMode & 16) ? lpR : 0;
            let outBpR = (this.filterMode & 32) ? bpR : 0;
            let outHpR = (this.filterMode & 64) ? hpR : 0;
            if ((this.filterMode & 80) === 80) outHpR = -outHpR * 0.95;
            filterOutR = outLpR + outBpR + outHpR;
        }

        // Anti-NaN Failsafe
        if (isNaN(this.x1_L) || isNaN(this.x2_L)) { this.x1_L = 0; this.x2_L = 0; filterOutL = 0; }
        if (isNaN(this.x1_R) || isNaN(this.x2_R)) { this.x1_R = 0; this.x2_R = 0; filterOutR = 0; }

        let mixL = unfiltSumL + filterOutL;
        let mixR = unfiltSumR + filterOutR;

        // =========================================================
        // 4-BIT DIGIDRUM SUB-EXCITER (Studio Punch)
        // =========================================================
        let drumPunch = 0;
        if (this.drumTransientEnv > 0.001) {
            this.drumSubPhase = (this.drumSubPhase + (48.0 / 985248)) % 1.0; // 48Hz Sub-Kick
            let subKick = Math.sin(this.drumSubPhase * Math.PI * 2) * this.drumTransientEnv * 0.45;
            drumPunch = subKick;
            this.drumTransientEnv *= 0.99988; // Organisches Ausklingen
        }

        // Master VCA & HiFi Tube Warmth
        let masterDc = 0.72; // Kalibrierter $D418 DC-Sockel
        let vcaL = (Math.tanh((mixL + drumPunch) * 0.48) * 1.65 + masterDc) * this.masterVol;
        let vcaR = (Math.tanh((mixR + drumPunch) * 0.48) * 1.65 + masterDc) * this.masterVol;

        this.outputSampleL = vcaL;
        this.outputSampleR = vcaR;
    }
}

class SIDFantasyProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.clock = 985248; // PAL Master Clock
        this.sid = new SIDFantasyChip();
        this.cpu = new CPU6502(this.sid);
        
        this.dcBlockL = new DCBlocker();
        this.dcBlockR = new DCBlocker();

        this.prgCode = null;
        this.loadAddr = 0;
        this.initAddress = 0;
        this.playAddress = 0;
        this.playSpeedCycles = 19656; 
        this.songSpeedFlags = 0;
        
        this.isPlaying = false;
        this.fadeVol = 0.0;
        
        this.cycleAccumulator = 0.0;
        this.vblankTimer = 19656; 
        this.currentFrame = 0;
        this.hostPlayPending = false;
        
        this.temperature = 55.0;
        this.cpuCyclesRemaining = 0;
        
        this.visualView = new Float32Array(40);

        // Dual-Channel 255-Tap Sinc-FIR Decimator (Stereo)
        this.FIR_TAPS = 255;
        this.firKernel = new Float32Array(this.FIR_TAPS);
        this.ringBufferL = new Float32Array(512); 
        this.ringBufferR = new Float32Array(512); 
        this.ringIndex = 0;

        const fc = 20000.0 / this.clock;
        let sum = 0;
        for (let i = 0; i < this.FIR_TAPS; i++) {
            let x = i - (this.FIR_TAPS - 1) / 2;
            let sinc = (x === 0) ? (2 * Math.PI * fc) : Math.sin(2 * Math.PI * fc * x) / x;
            let window = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / (this.FIR_TAPS - 1)) + 0.08 * Math.cos((4 * Math.PI * i) / (this.FIR_TAPS - 1));
            this.firKernel[i] = sinc * window;
            sum += this.firKernel[i];
        }
        for (let i = 0; i < this.FIR_TAPS; i++) {
            this.firKernel[i] /= sum;
        }

        this.port.onmessage = (e) => {
            const msg = e.data;
            if (msg.type === 'SET_TEMPERATURE') {
                this.temperature = Math.min(75, Math.max(15, msg.value));
                return;
            }

            if (msg.isSidFile) {
                this.ringBufferL.fill(0);
                this.ringBufferR.fill(0);
                this.ringIndex = 0;

                this.prgCode = msg.c64Code;
                this.loadAddr = msg.loadAddress;
                this.initAddress = msg.initAddress;
                this.playAddress = msg.playAddress;
                this.songSpeedFlags = msg.speed; 

                this.sid = new SIDFantasyChip();
                this.cpu = new CPU6502(this.sid);

                this.cpu.reset(this.loadAddr, this.prgCode, this.initAddress, this.playAddress);

                let songIndex = (msg.startSong > 0 ? msg.startSong - 1 : 0) & 0xFF;
                this.cpu.a = songIndex;
                this.cpu.x = songIndex; 
                this.cpu.y = 0;
                
                this.cpu.push(0xFF); 
                this.cpu.push(0xDF); 
                this.cpu.pc = this.initAddress;

                let initSafety = 2000000; 
                while (this.cpu.pc !== 0xFFE0 && initSafety > 0) {
                    initSafety--;
                    this.cpu.clockHardware(1);
                    this.sid.clock();
                    
                    if (this.cpuCyclesRemaining === 1) {
                        this.cpu.irqAccepted = this.cpu.irqPending && (this.cpu.p & 0x04) === 0;
                        this.cpu.nmiAccepted = this.cpu.nmiPending;
                    }

                    if (this.cpu.rdy && this.cpuCyclesRemaining <= 0) {
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
                            if (this.cpuCyclesRemaining === 0 && this.cpu.hasPendingWrite) {
                                this.cpu.commitPendingWrite();
                            }
                        }
                    } else if (this.cpu.rdy) {
                        this.cpuCyclesRemaining--;
                        if (this.cpuCyclesRemaining === 0 && this.cpu.hasPendingWrite) {
                            this.cpu.commitPendingWrite();
                        }
                    }
                }
                
                this.cpu.pc = 0xFFE0; 
                this.cpu.p &= ~0x04;  

                this.useCiaTimer = ((this.songSpeedFlags >> songIndex) & 1) !== 0;
                if (this.useCiaTimer) this.cpu.cia1CtrlA |= 0x01; 

                this.playSpeedCycles = this.useCiaTimer ? 19583 : 19656;
                this.vblankTimer = this.playSpeedCycles;

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
                this.ringBufferL.fill(0);
                this.ringBufferR.fill(0);
                this.ringIndex = 0;

                this.sid = new SIDFantasyChip();
                this.cpu.sid = this.sid;
                this.cpu.reset(this.loadAddr, this.prgCode, this.initAddress, this.playAddress);
                
                let songIndex = (msg.frame > 0 ? msg.frame - 1 : 0) & 0xFF;
                this.cpu.a = songIndex;
                this.cpu.x = songIndex;
                this.cpu.y = 0;
                
                this.cpu.push(0xFF); 
                this.cpu.push(0xDF); 
                this.cpu.pc = this.initAddress;
                
                let initSafety = 2000000;
                while (this.cpu.pc !== 0xFFE0 && initSafety > 0) {
                    initSafety--;
                    this.cpu.clockHardware(1);
                    this.sid.clock();
                    
                    if (this.cpuCyclesRemaining === 1) {
                        this.cpu.irqAccepted = this.cpu.irqPending && (this.cpu.p & 0x04) === 0;
                        this.cpu.nmiAccepted = this.cpu.nmiPending;
                    }

                    if (this.cpu.rdy && this.cpuCyclesRemaining <= 0) {
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
                            if (this.cpuCyclesRemaining === 0 && this.cpu.hasPendingWrite) {
                                this.cpu.commitPendingWrite();
                            }
                        }
                    } else if (this.cpu.rdy) {
                        this.cpuCyclesRemaining--;
                        if (this.cpuCyclesRemaining === 0 && this.cpu.hasPendingWrite) {
                            this.cpu.commitPendingWrite();
                        }
                    }
                }

                this.cpu.pc = 0xFFE0; 
                this.cpu.p &= ~0x04;
                
                this.useCiaTimer = ((this.songSpeedFlags >> songIndex) & 1) !== 0;
                if (this.useCiaTimer) this.cpu.cia1CtrlA |= 0x01; 

                this.playSpeedCycles = this.useCiaTimer ? 19583 : 19656;
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
        const outR = outputs[0].length > 1 ? outputs[0][1] : outputs[0][0];
        let visualValue = 0;

        for (let i = 0; i < outL.length; i++) {
            if (this.isPlaying) this.fadeVol = Math.min(1.0, this.fadeVol + 0.002);
            else this.fadeVol = Math.max(0.0, this.fadeVol - 0.002);

            if (this.fadeVol === 0.0) {
                outL[i] = 0; if (outR) outR[i] = 0;
                continue; 
            }
            
            this.cycleAccumulator += this.clock / sampleRate;
            let cyclesToRun = Math.floor(this.cycleAccumulator);
            this.cycleAccumulator -= cyclesToRun;

            // 1MHz PAL Lockstep Cycling
            for (let c = 0; c < cyclesToRun; c++) {
                this.cpu.clockHardware(1); 
                this.sid.clock();          
                
                this.ringBufferL[this.ringIndex] = this.sid.outputSampleL;
                this.ringBufferR[this.ringIndex] = this.sid.outputSampleR;
                this.ringIndex = (this.ringIndex + 1) & 511;

                if (this.playAddress === 0) {
                    this.vblankTimer--;
                    if (this.vblankTimer <= 0) {
                        this.vblankTimer += this.playSpeedCycles;
                        this.currentFrame = (this.currentFrame + 1) % this.maxFrames;
                    }
                } else {
                    if (!this.useCiaTimer) {
                        this.vblankTimer--;
                        if (this.vblankTimer <= 0) {
                            this.vblankTimer += this.playSpeedCycles;
                            this.hostPlayPending = true;
                        }
                    } else {
                        if (this.cpu.cia1TimerAUnderflowed) {
                            this.cpu.cia1TimerAUnderflowed = false;
                            this.hostPlayPending = true;
                        }
                    }
                }

                if (this.cpuCyclesRemaining === 1) {
                    this.cpu.irqAccepted = this.cpu.irqPending && (this.cpu.p & 0x04) === 0;
                    this.cpu.nmiAccepted = this.cpu.nmiPending;
                }

                if (this.cpu.rdy) {
                    if (this.cpuCyclesRemaining <= 0) {
                        if (this.hostPlayPending && this.cpu.pc >= 0xFFE0 && this.cpu.pc <= 0xFFE2) {
                            this.hostPlayPending = false;
                            this.cpu.push(0xFF);
                            this.cpu.push(0xDF); 
                            this.cpu.pc = this.playAddress;
                            this.cpuCyclesRemaining = 6 - 1; 
                            this.currentFrame = (this.currentFrame + 1) % this.maxFrames;
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
                            if (this.cpuCyclesRemaining === 0 && this.cpu.hasPendingWrite) {
                                this.cpu.commitPendingWrite();
                            }
                        }
                    } else {
                        this.cpuCyclesRemaining--;
                        if (this.cpuCyclesRemaining === 0 && this.cpu.hasPendingWrite) {
                            this.cpu.commitPendingWrite();
                        }
                    }
                }
            }
            
            // Dual-Channel 255-Tap Sinc-FIR Decimation (48 kHz)
            let decL = 0, decR = 0;
            let firIdx = (this.ringIndex - 1) & 511;
            for (let k = 0; k < this.FIR_TAPS; k++) {
                decL += this.ringBufferL[firIdx] * this.firKernel[k];
                decR += this.ringBufferR[firIdx] * this.firKernel[k];
                firIdx = (firIdx - 1) & 511;
            }

            // DC Blocking
            let dcL = this.dcBlockL.process(decL);
            let dcR = this.dcBlockR.process(decR);

            // Mastering Tube Stage & Soft-Saturator (Full 0dBFS Dynamic Range)
            let satL = Math.tanh(dcL * 0.95) * 0.78 * this.fadeVol;
            let satR = Math.tanh(dcR * 0.95) * 0.78 * this.fadeVol;

            outL[i] = satL;
            outR[i] = satR;
            if (i === 0) visualValue = (satL + satR) * 0.5;
        }

        this.visCounter = (this.visCounter || 0) + 1;
        if (this.visCounter % 4 === 0) {
            let isAudible = Math.abs(visualValue) > 0.001;
            if (isAudible || this.wasAudible) {
                const view = this.visualView;
                view[0] = 0; // System Flag: C64
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

registerProcessor('sid-fantasy-processor', SIDFantasyProcessor);