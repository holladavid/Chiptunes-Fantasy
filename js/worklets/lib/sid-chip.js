// === js/worklets/lib/sid-chip.js ===
// =========================================================
// MOS Technology SID 6581 Sound Chip Emulation
// True Analog Master Edition:
// - Voice 3 DC-Leakage Persistence on 3OFF ($D418 Bit 7)
// - Wizball-Stable 2MHz ZDF OTA Filter Solver (MOS 6581 R3 S-Curve)
// - Calibrated PlaySID 4-Bit Drum DC Bias & Voice Gain Staging
// =========================================================

import { calculateWaveform8Bit } from './sid-waveforms.js';
import { DAC_LUT, CUTOFF_LUT, PWM_LUT, RATE_COUNTER_PERIOD } from './sid-luts.js';

const ENV_ATTACK = 0, ENV_DECAY = 1, ENV_RELEASE = 2; 

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
                busCharge: 0x18, // Parasitische C_gate Knoten-Ladung (0x18 = DC Bias)
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
        
        // Zero-Delay Feedback (ZDF) State-Space Memory (Capacitor Charges)
        this.x1 = 0.0;
        this.x2 = 0.0;

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
        this.thermalMasterDcBias = 0.70;

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
        
        // =========================================================
        // ORIGINAL MOS 6581 R3 S-CURVE (30Hz bis 6.200Hz)
        // =========================================================
        let baseHz = 30.0 + (1200.0 * norm) + (7200.0 * norm * norm) - (2230.0 * norm * norm * norm);
        if (baseHz > 6200.0) baseHz = 6200.0;
        
        this.activeCutoff = Math.max(30.0, Math.min(6800.0, baseHz * thermalCoefficient + this.vcfOffset));

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
        this.thermalMasterDcBias = 0.70 + (this._temperature - 55.0) * 0.003;
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
                    
                    if (isPulseLow || (ch.ctrl & 0x30)) {
                        bit = 0; 
                    }
                }

                ch.lfsr = ((ch.lfsr << 1) & 0x7FFFFF) | bit;
            }
        } else {
            ch.msbRisingEdge = false;
        }

        // Physical MOS 6581 Ring Modulation:
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
                ch.busCharge += 0.82 * (rawWave8Bit - ch.busCharge);
                ch.waveOut8Bit = ch.busCharge;
            } else {
                ch.busCharge = rawWave8Bit;
                ch.waveOut8Bit = rawWave8Bit;
            }
        } else {
            ch.busCharge += 0.00015 * (0x18 - ch.busCharge);
            ch.waveOut8Bit = ch.busCharge;
        }

        ch.env8Bit = ch.envelope_counter;

        let envDac = DAC_LUT[ch.env8Bit];
        let waveDac = DAC_LUT[Math.floor(ch.waveOut8Bit)];

        let waveOutFloat = (waveDac * 2.0) - 1.0;
        waveOutFloat = waveOutFloat * this.thermalDacGain + this.thermalDacOffset;
        
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

        // =========================================================
        // VOICE 3 DISCONNECT ($D418 BIT 7) & DC-LEAKAGE PERSISTENCE
        // =========================================================
        if (!isVoice3Off) {
            // Voice 3 normal verbunden (AC + DC)
            if (this.regs[23] & 4) filteredSum += bleed2; else unfilteredSum += bleed2;
        } else {
            // Voice 3 stummgeschaltet (3OFF): AC-Wellenform abgetrennt, 
            // aber DAC-Gleichspannungssockel und Substrat-Bleed bleiben im Summierknoten aktiv!
            let envDac3 = DAC_LUT[this.voices[2].env8Bit];
            let v3DcLeak = (this.thermalVoiceDcLeakage * envDac3) + (bleed0 * 0.004 + bleed1 * 0.008);
            if (this.regs[23] & 4) filteredSum += v3DcLeak; else unfilteredSum += v3DcLeak;
        }

        // =========================================================
        // ZERO-DELAY FEEDBACK (ZDF) TRAPEZOIDAL STATE-SPACE SOLVER (2MHz)
        // =========================================================
        let subG = Math.tan((Math.PI * this.activeCutoff) / 1970496); // 2MHz Sub-sample Grid
        
        let resReg = this.regs[23] >> 4;
        let normRes = resReg / 15.0;
        let k = 1.414 - (normRes * 1.08); // Q_max clamp to ~3.0 (reSID-fp matched)
        
        let denom = 1.0 + subG * (subG + k);
        let filterOut = 0;

        for (let sub = 0; sub < 2; sub++) {
            let hp = (filteredSum - this.x1 * (subG + k) - this.x2) / denom;
            let bpRaw = subG * hp + this.x1;
            
            // Symmetrisches JFET Triode Quenching
            let bp = bpRaw;
            if (this.useJfetSaturation) {
                let summerDrive = this.thermalJfetDrive * 0.70;
                bp = Math.tanh(bpRaw * summerDrive) / summerDrive;
            }

            let lp = subG * bp + this.x2;

            // Trapezoidales Zustandsgedächtnis
            this.x1 = 2.0 * bp - this.x1;
            this.x2 = 2.0 * lp - this.x2;

            this.filterBand = bp;
            this.filterLow = lp;

            let outLP = (this.filterMode & 16) ? lp : 0;
            let outBP = (this.filterMode & 32) ? bp : 0;
            let outHP = (this.filterMode & 64) ? hp : 0;

            if ((this.filterMode & 80) === 80) { 
                outHP = -outHP * 0.90; // Notch Phase Inversion
            }

            filterOut = outLP + outBP + outHP;
        }

        // Anti-NaN Failsafe
        if (isNaN(this.filterLow) || isNaN(this.filterBand)) {
            this.filterLow = 0.0;
            this.filterBand = 0.0;
            this.x1 = 0.0;
            this.x2 = 0.0;
            filterOut = 0.0;
        }

        let leakage = filteredSum * this.thermalLeakage;
        let filteredMix = filterOut + leakage;

        let rawSum = unfilteredSum + filteredMix;

        // =========================================================
        // MASTER VCA SATURATION & DC OFFSET
        // =========================================================
        let vcaIn = rawSum * 0.35; 
        let vcaCurve = vcaIn + (this.useJfetSaturation ? (0.05 * Math.pow(vcaIn, 2)) : 0);
        let acSaturated = Math.tanh(vcaCurve);
        let finalMix = (acSaturated * 1.65) + this.thermalMasterDcBias;

        this.outputSample = (finalMix * this.masterVol) + this.thermalDcOffset;
    }
}