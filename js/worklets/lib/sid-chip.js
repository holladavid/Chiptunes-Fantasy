// === js/worklets/lib/sid-chip.js ===
// =========================================================
// MOS Technology SID 6581 Sound Chip Emulation
// Phase 26: Asymmetric NMOS JFET Saturation & Real CUTOFF_LUT Integration
// Restores authentic 5.8kHz FET cutoff boundary & wet resonant "schmatzen"
// =========================================================

import { calculateWaveform8Bit } from './sid-waveforms.js';
import { DAC_LUT, CUTOFF_LUT } from './sid-luts.js';

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

        this._temperature = 55.0;
        this.thermalDacGain = 1.0;
        this.thermalDacOffset = 0.0;
        this.thermalLeakage = 0.03; 
        this.thermalDcOffset = 0.0;
        this.thermalJfetDrive = 0.8;

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
        
        // Bind cutoff directly to measured physical 6581 JFET LUT (30Hz - 5800Hz)
        let baseCutoff = CUTOFF_LUT[cutoffReg];
        let thermalCoefficient = Math.exp(-(this._temperature - 55.0) * 0.003);
        
        this.activeCutoff = Math.max(30.0, Math.min(6500.0, baseCutoff * thermalCoefficient));

        let baseG = Math.PI * this.activeCutoff / 985248;
        this.g = baseG * (1.0 + (this._temperature - 55.0) * 0.0005);
        
        let resReg = this.regs[23] >> 4;
        let normRes = resReg / 15.0;
        let q = 1.0 - normRes * 0.955;
        let thermalDamp = 1.0 + (this._temperature - 55.0) * 0.0015;
        this.q = Math.min(1.0, Math.max(0.035, q * thermalDamp));

        this.thermalDacGain = 1.0 - (this._temperature - 55.0) * 0.0008;
        this.thermalDacOffset = (this._temperature - 55.0) * 0.0003;
        this.thermalLeakage = 0.09 + (this._temperature - 25.0) * 0.0008;
        this.thermalDcOffset = (this._temperature - 55.0) * 0.005;
        this.thermalJfetDrive = 0.8 * (1.0 - (this._temperature - 55.0) * 0.004);
        if (this.thermalJfetDrive < 0.1) this.thermalJfetDrive = 0.1; 
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

        if ((ch.ctrl & 8) === 0) {
            let oldAcc = ch.phase;
            let newAcc = (ch.phase + ch.freq) & 0xFFFFFF;

            let prevIdx = v === 0 ? 2 : v - 1;
            let prevCh = this.voices[prevIdx];
            if ((ch.ctrl & 2) !== 0 && prevCh.msbRisingEdge) newAcc = 0; 

            ch.msbRisingEdge = ((oldAcc & 0x800000) === 0) && ((newAcc & 0x800000) !== 0);
            ch.phase = newAcc;

            let oldStep = oldAcc & 0x080000;
            let newStep = ch.phase & 0x080000;
            if (!oldStep && newStep) {
                let bit = ((ch.lfsr >> 22) ^ (ch.lfsr >> 17)) & 1;
                ch.lfsr = ((ch.lfsr << 1) & 0x7FFFFF) | bit;
            }
        } else {
            ch.msbRisingEdge = false;
        }

        let ringMSB = (ch.phase >> 23) & 1;
        if ((ch.ctrl & 4) !== 0) { 
            let prevIdx = v === 0 ? 2 : v - 1;
            let prevCh = this.voices[prevIdx];
            ringMSB ^= (prevCh.phase >> 23) & 1;
        }

        let hasWave = (ch.ctrl & 0xF0) !== 0;
        if (hasWave) {
            ch.waveOut8Bit = calculateWaveform8Bit(ch.ctrl, ch.phase, ch.pw, ch.lfsr, ringMSB);
        } else {
            ch.waveOut8Bit += (0x18 - ch.waveOut8Bit) * 0.00015;
        }

        ch.env8Bit = ch.envelope_counter;

        let envDac = DAC_LUT[ch.env8Bit];
        let waveDac = DAC_LUT[Math.floor(ch.waveOut8Bit)];

        let waveOutFloat = (waveDac * 2.0) - 1.0;
        
        waveOutFloat = waveOutFloat * this.thermalDacGain + this.thermalDacOffset;
        
        return waveOutFloat * envDac;
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
        if (this.activeCutoff < 600.0) {
            // Low-frequency quenching: FET channel resistance rises, dampening feedback
            let damp = (600.0 - this.activeCutoff) / 600.0; 
            q += damp * 0.45; 
        } else if (this.activeCutoff > 3500.0) {
            // High-frequency dampening near the 5.8kHz NMOS boundary
            let damp = (this.activeCutoff - 3500.0) / 2300.0;
            q += damp * 0.35; 
        }

        let h = filteredSum - this.filterLow;
        let hp = (h - q * this.filterBand) / (1.0 + g * (g + q));

        if (this.useJfetSaturation) {
            let qDrive = 1.0 / (q + 0.08); 
            let summerDrive = this.thermalJfetDrive * (1.1 + qDrive * 0.18); 
            
            // Asymmetric NMOS Summer Op-Amp Saturation (Generates 2nd & 4th harmonics for wet squelch)
            let dx = hp * summerDrive;
            if (dx < 0) {
                hp = Math.tanh(dx + 0.14 * dx * dx) / summerDrive;
            } else {
                hp = Math.tanh(dx - 0.06 * dx * dx) / summerDrive;
            }
        }

        let bp = this.filterBand + g * hp;
        let lp = this.filterLow + g * bp;
        
        this.filterLow = lp;
        
        if (this.useJfetSaturation) {
            // Asymmetric Bandpass Integrator Saturation
            let driveP = this.thermalJfetDrive * 0.65;
            let dbp = bp * driveP;
            if (dbp < 0) {
                this.filterBand = Math.tanh(dbp + 0.10 * dbp * dbp) / driveP;
            } else {
                this.filterBand = Math.tanh(dbp - 0.04 * dbp * dbp) / driveP;
            }
        } else {
            this.filterBand = bp / (1.0 + Math.abs(bp) * 0.15); 
        }

        let outLP = (this.filterMode & 16) ? this.filterLow : 0;
        let outBP = (this.filterMode & 32) ? this.filterBand : 0;
        let outHP = (this.filterMode & 64) ? hp : 0;

        if ((this.filterMode & 80) === 80) { 
            // Mode $50 (Notch Filter = LP + HP):
            // Emulates non-ideal op-amp phase cancellation for Rob Hubbard's phaser sweeps
            outHP *= 0.88; 
        }

        let filterOut = outLP + outBP + outHP;

        let leakage = filteredSum * this.thermalLeakage;
        let filteredMix = filterOut + leakage;

        let rawSum = unfilteredSum + filteredMix;
        let vcaIn = rawSum * 0.42; 
        
        let vcaQuad = this.useJfetSaturation ? (0.05 * Math.pow(vcaIn, 2)) : 0;
        
        let acSaturated = Math.tanh(vcaIn + vcaQuad);
        let finalMix = acSaturated + 0.45;

        this.outputSample = (finalMix * this.masterVol) + this.thermalDcOffset;
    }
}