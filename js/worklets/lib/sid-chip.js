// === js/worklets/lib/sid-chip.js ===
// =========================================================
// MOS Technology SID 6581 Sound Chip Emulation
// Phase 35: Zero-Lag Instantaneous Register Updates
// Eliminates register smoothing lag to restore Huelsbeck's fast
// ADSR attacks, continuous PWM sweeps & glassy lead transients.
// =========================================================

import { calculateWaveform8Bit } from './sid-waveforms.js';
import { DAC_LUT, CUTOFF_LUT, PWM_LUT } from './sid-luts.js';

const ENV_ATTACK = 0, ENV_DECAY = 1, ENV_RELEASE = 2; 
const RATE_COUNTER_PERIOD = [9, 32, 63, 95, 149, 220, 267, 313, 392, 977, 1954, 3126, 3907, 11720, 19530, 31256];

const VOLUME_DAC_6581 = new Float32Array([
    0.000, 0.078, 0.149, 0.228, 0.307, 0.378, 0.449, 0.512,
    0.606, 0.669, 0.724, 0.787, 0.842, 0.898, 0.953, 1.000
]);

export class SIDChip {
    constructor() {
        this.regs = new Uint8Array(29);
        this.voices = [];
        for (let i = 0; i < 3; i++) {
            this.voices.push({
                freq: 0, pw: 2048, ctrl: 0, env: 0, phase: 0,
                state: ENV_RELEASE, prevGate: false,
                waveOut8Bit: 0x18, 
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
        this.filterLow = 0; this.filterBand = 0;
        this.outputSample = 0;
        this.useJfetSaturation = true; 
        
        this.g = 0;
        this.q = 1.0;
        this.activeCutoff = 30.0;
        
        // Silicon Lottery VCF Offset (+/- 40Hz)
        this.vcfOffset = (Math.random() - 0.5) * 80.0;

        this._temperature = 55.0;
        this.thermalDacGain = 1.0;
        this.thermalDacOffset = 0.0;
        this.thermalLeakage = 0.03; 
        this.thermalDcOffset = 0.0;
        this.thermalJfetDrive = 0.8;

        // Thermal VCA Properties
        this.thermalVoiceDcLeakage = 0.012;
        this.thermalMasterDcBias = 0.45;

        this.volWiggleActivity = 0.0;
        this.d418Writes = 0; 

        this.updateFilterParameters();
    }

    get temperature() { return this._temperature; }
    set temperature(val) {
        this._temperature = val;
        this.updateFilterParameters();
    }

    updateFilterParameters() {
        let cutoffReg = (this.regs[21] & 7) | (this.regs[22] << 3);
        let norm = cutoffReg / 2047.0;

        let thermalCoefficient = Math.exp(-(this._temperature - 55.0) * 0.003);
        
        // Balanced 6581 FET Cutoff Curve: Provides open midrange (850Hz - 3500Hz)
        let fetCurve = 30.0 + 400.0 * norm + 7200.0 * (norm * norm) + 7680.0 * (norm * norm * norm);
        
        this.activeCutoff = Math.max(30.0, Math.min(16000.0, fetCurve * thermalCoefficient + this.vcfOffset));

        let baseG = Math.PI * this.activeCutoff / 985248;
        this.g = baseG * (1.0 + (this._temperature - 55.0) * 0.0005);
        
        let resReg = this.regs[23] >> 4;
        let normRes = resReg / 15.0;
        let q = 1.0 - normRes * 0.945;
        let thermalDamp = 1.0 + (this._temperature - 55.0) * 0.0015;
        this.q = Math.min(1.0, Math.max(0.035, q * thermalDamp));

        this.thermalDacGain = 1.0 - (this._temperature - 55.0) * 0.0008;
        this.thermalDacOffset = (this._temperature - 55.0) * 0.0003;
        this.thermalLeakage = 0.09 + (this._temperature - 25.0) * 0.0008;
        this.thermalDcOffset = (this._temperature - 55.0) * 0.005;
        this.thermalJfetDrive = 0.8 * (1.0 - (this._temperature - 55.0) * 0.004);
        if (this.thermalJfetDrive < 0.1) this.thermalJfetDrive = 0.1; 

        let tempNorm = (this._temperature - 15.0) / 40.0;
        this.thermalVoiceDcLeakage = 0.003 + Math.pow(Math.max(0.0, tempNorm), 1.6) * 0.012;
        this.thermalMasterDcBias = 0.45 + (this._temperature - 55.0) * 0.002;
    }

    writeReg(reg, val) {
        if (reg >= 29) return;
        this.regs[reg] = val;
        
        let vIdx = (reg / 7) | 0;
        if (vIdx < 3) {
            let ch = this.voices[vIdx];
            let base = vIdx * 7;
            
            // Immediate 100% instantaneous hardware register updates (NO SMOOTHING / NO GLIDE)
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
            let newVol = VOLUME_DAC_6581[volIndex];
            
            let delta = Math.abs(newVol - this.masterVol);
            if (delta > 0.01) {
                this.volWiggleActivity = Math.min(1.0, this.volWiggleActivity + 0.15);
            }
            this.masterVol = newVol;
        }
    }

    clockEnvelopeOneCycle(v) {
        let ch = this.voices[v];

        if (ch.envDelay > 0) {
            ch.envDelay--;
            return;
        }

        let ratePeriod = ch.release_period;
        if (ch.state === ENV_ATTACK) ratePeriod = ch.attack_period;
        else if (ch.state === ENV_DECAY) ratePeriod = ch.decay_period;

        ch.rate_counter++;
        if (ch.rate_counter & 0x8000) {
            ch.rate_counter = (ch.rate_counter + 1) & 0x7FFF;
        }

        if (ch.rate_counter === ratePeriod) {
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
                    if (ch.envelope_counter !== ch.sustain_level) {
                        if (ch.envelope_counter > 0) ch.envelope_counter--;
                    }
                } else if (ch.state === ENV_RELEASE) {
                    if (ch.envelope_counter > 0) {
                        ch.envelope_counter--;
                    }
                }
            }
        }
    }

    synthesizeVoiceOneCycle(v) {
        let ch = this.voices[v];

        // 100% Instantaneous hardware registers (Zero lag/smoothing for sharp attack transients and exact PWM)
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

                // Physical MOS 6581 Combined Waveform LFSR Feedback Suppression:
                // Feedback bit is suppressed ONLY during the low phase of the accompanying wave.
                if (ch.ctrl & 0x80) {
                    let combined = ch.ctrl & 0x70;
                    if (combined !== 0) {
                        let testPhase = (ch.phase >> 12) & 0xFFF;
                        let pwMapped = PWM_LUT[pwInt & 0xFFF];
                        
                        let isPulseLow = (ch.ctrl & 0x40) && (testPhase >= pwMapped);
                        let isSawLow   = (ch.ctrl & 0x20) && ((ch.phase & 0x800000) === 0);
                        let isTriLow   = (ch.ctrl & 0x10) && ((ch.phase & 0x400000) === 0);

                        if (isPulseLow || isSawLow || isTriLow) {
                            bit = 0; // Forced feedback suppression only during low wave phases
                        }
                    }
                }

                ch.lfsr = ((ch.lfsr << 1) & 0x7FFFFF) | bit;
            }
        } else {
            ch.msbRisingEdge = false;
        }

        // Physical MOS 6581 Ring Modulation:
        // Substitutes the voice's MSB with the EXCLUSIVE-OR of its own MSB and the carrier's MSB.
        let prevIdx = v === 0 ? 2 : v - 1;
        let prevCh = this.voices[prevIdx];
        let ownMSB = (ch.phase >> 23) & 1;
        let prevMSB = (prevCh.phase >> 23) & 1;
        let ringMSB = (ch.ctrl & 4) ? (ownMSB ^ prevMSB) : ownMSB;

        let hasWave = (ch.ctrl & 0xF0) !== 0;
        if (hasWave) {
            ch.waveOut8Bit = calculateWaveform8Bit(ch.ctrl, ch.phase, pwInt, ch.lfsr, ringMSB);
        } else {
            ch.waveOut8Bit += (0x18 - ch.waveOut8Bit) * 0.00015;
        }

        ch.env8Bit = ch.envelope_counter;

        let envDac = DAC_LUT[ch.env8Bit];
        let waveDac = DAC_LUT[Math.floor(ch.waveOut8Bit)];

        let waveOutFloat = (waveDac * 2.0) - 1.0;
        
        waveOutFloat = waveOutFloat * this.thermalDacGain + this.thermalDacOffset;
        
        // Inject thermally modulated Voice VCA DC offset before envelope multiplication
        return (waveOutFloat + this.thermalVoiceDcLeakage) * envDac;
    }

    clock() {
        for (let v = 0; v < 3; v++) {
            this.clockEnvelopeOneCycle(v);
        }

        let voice0 = this.synthesizeVoiceOneCycle(0);
        let voice1 = this.synthesizeVoiceOneCycle(1);
        let voice2 = this.synthesizeVoiceOneCycle(2);

        // --- INTER-VOICE CROSSTALK ---
        let bleed0 = voice0 + voice1 * 0.008 + voice2 * 0.004;
        let bleed1 = voice1 + voice0 * 0.008 + voice2 * 0.008;
        let bleed2 = voice2 + voice1 * 0.008 + voice0 * 0.004;

        let filteredSum = 0;
        let unfilteredSum = 0;

        const isVoice3Off = (this.filterMode & 128) !== 0;

        if (this.regs[23] & 1) filteredSum += bleed0; else unfilteredSum += bleed0;
        if (this.regs[23] & 2) filteredSum += bleed1; else unfilteredSum += bleed1;

        if (!isVoice3Off) {
            if (this.regs[23] & 4) filteredSum += bleed2; else unfilteredSum += bleed2;
        }

        let g = this.g;
        let q = this.q;

        // Dynamic resonance shaping across frequency range (Resonance Quenching & Mid-Range Squelch)
        if (this.activeCutoff < 250.0) {
            let damp = (250.0 - this.activeCutoff) / 250.0; 
            q += damp * 0.15; 
        } else if (this.activeCutoff > 4500.0) {
            let damp = (this.activeCutoff - 4500.0) / 1700.0;
            // "Breathing" resonance at high cutoffs for glassy instability
            let breath = ((this.voices[0].lfsr & 0xFF) / 255.0 - 0.5) * 0.06;
            q += damp * (0.20 + breath); 
        }

        // =========================================================
        // 100% UNCONDITIONALLY STABLE EXPLICIT CHAMBERLIN SVF (1 MHz)
        // =========================================================
        let h = filteredSum - this.filterLow;
        let hp = (h - q * this.filterBand) / (1.0 + g * (g + q));

        if (this.useJfetSaturation) {
            let qDrive = 1.0 / (q + 0.1); 
            let summerDrive = this.thermalJfetDrive * (1.2 + qDrive * 0.15); 
            hp = Math.tanh(hp * summerDrive) / summerDrive;
        }

        let bp = this.filterBand + g * hp;
        let lp = this.filterLow + g * bp;
        
        this.filterLow = lp;
        
        if (this.useJfetSaturation) {
            let driveP = this.thermalJfetDrive * 0.65;
            this.filterBand = Math.tanh(bp * driveP) / driveP;
        } else {
            this.filterBand = bp / (1.0 + Math.abs(bp) * 0.15); 
        }

        let outLP = (this.filterMode & 16) ? this.filterLow : 0;
        let outBP = (this.filterMode & 32) ? this.filterBand : 0;
        let outHP = (this.filterMode & 64) ? hp : 0;

        if ((this.filterMode & 80) === 80) { 
            outHP *= 0.85; 
        }

        let filterOut = outLP + outBP + outHP;

        let leakage = filteredSum * this.thermalLeakage;
        let filteredMix = filterOut + leakage;

        let rawSum = unfilteredSum + filteredMix;

        // Expand linear headroom (0.28x) so loud basslines don't crush the delicate synths
        let vcaIn = rawSum * 0.28; 
        
        let vcaQuad = this.useJfetSaturation ? (0.05 * Math.pow(vcaIn, 2)) : 0;
        
        let acSaturated = Math.tanh(vcaIn + vcaQuad);
        let finalMix = (acSaturated * 1.35) + this.thermalMasterDcBias;

        this.outputSample = (finalMix * this.masterVol) + this.thermalDcOffset;
    }
}