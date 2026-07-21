// === js/worklets/lib/sid-chip.js ===
// =========================================================
// MOS Technology SID 6581 Sound Chip Emulation
// Phase 8: True Hardware DC-Bias VCA Injection
// Removed digital wiggle-hacks. Added authentic 400mV Mux offset
// for physically accurate $D418 Digidrum amplification.
// =========================================================

import { calculateWaveform8Bit } from './sid-waveforms.js';
import { DAC_LUT, CUTOFF_LUT } from './sid-luts.js';

const ENV_ATTACK = 0, ENV_DECAY = 1, ENV_RELEASE = 2; 
const RATE_COUNTER_PERIOD = [9, 32, 63, 95, 149, 220, 267, 313, 392, 977, 1954, 3126, 3907, 11720, 19530, 31256];

// --- STATISCHER VERLAUF DES NICHT-LINEAREN 6581 LAUTSTÄRKE-D/A-WANDLERS ---
// Gemessen von Pex "Mahoney" Tufvesson auf realem 6581 NMOS-Silizium.
// Bildet das unregelmäßige Verhalten der R-2R-Widerstandsleiter exakt ab.
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
                waveOut8Bit: 0x18, // Startet genau auf dem schwebenden DC-Ruhepegel (24)
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

        // Thermische Caches (Zero-Allocation Loop Optimization)
        this._temperature = 55.0;
        this.thermalDacGain = 1.0;
        this.thermalDacOffset = 0.0;
        this.thermalLeakage = 0.11;
        this.thermalDcOffset = 0.0;
        this.thermalJfetDrive = 0.8;

        this.updateFilterParameters();
    }

    get temperature() { return this._temperature; }
    set temperature(val) {
        this._temperature = val;
        this.updateFilterParameters();
    }

    // =========================================================
    // THERMAL HARDWARE MODELING
    // Alle temperaturabhängigen Werte werden vorab berechnet.
    // =========================================================
    updateFilterParameters() {
        let cutoffReg = (this.regs[21] & 7) | (this.regs[22] << 3);
        let norm = cutoffReg / 2047.0;

        // 1. Exponential Cutoff Drift
        let thermalCoefficient = Math.exp(-(this._temperature - 55.0) * 0.003);

        let fetCurve = 30.0 + 250.0 * norm + 8000.0 * (norm * norm) + 8000.0 * (norm * norm * norm);
        
        this.activeCutoff = fetCurve * thermalCoefficient;
        if (this.activeCutoff < 30) this.activeCutoff = 30;
        if (this.activeCutoff > 16000) this.activeCutoff = 16000;

        // 2. Integrator Drift
        let baseG = Math.PI * this.activeCutoff / 985248;
        this.g = baseG * (1.0 + (this._temperature - 55.0) * 0.0005);
        
        let resReg = this.regs[23] >> 4;
        let normRes = resReg / 15.0;
        let q = 1.0 - normRes * 0.92;
        let thermalDamp = 1.0 + (this._temperature - 55.0) * 0.0015;
        this.q = Math.min(1.0, Math.max(0.04, q * thermalDamp));

        // 3. DAC Gain & Offset Drift
        this.thermalDacGain = 1.0 - (this._temperature - 55.0) * 0.0008;
        this.thermalDacOffset = (this._temperature - 55.0) * 0.0003;

        // 4. VCF Leakage Steigerung bei Wärme
        this.thermalLeakage = 0.09 + (this._temperature - 25.0) * 0.0008;

        // 5. Hardware DC Offset Drift
        this.thermalDcOffset = (this._temperature - 55.0) * 0.005;

        // 6. JFET Saturation Drive (Warme Transistoren clippen früher/weicher)
        this.thermalJfetDrive = 0.8 * (1.0 - (this._temperature - 55.0) * 0.004);
        if (this.thermalJfetDrive < 0.1) this.thermalJfetDrive = 0.1; // Failsafe
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
                    // --- GATE-ON RESET ---
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
            
            // --- NON-LINEARER LAUTSTÄRKE DAC ---
            // Mappt das Register d418 über den gemessenen analogen Widerstandspfad.
            let volIndex = val & 15;
            this.masterVol = VOLUME_DAC_6581[volIndex];
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

        // --- HARDWARE-ACCURATE 15-BIT UP-COUNTER WRAP ---
        ch.rate_counter++;
        if (ch.rate_counter & 0x8000) {
            ch.rate_counter = (ch.rate_counter + 1) & 0x7FFF;
        }

        if (ch.rate_counter === ratePeriod) {
            ch.rate_counter = 0; // Reset nur bei exakter Koinzidenz

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

        // --- CYCLE-GENAUE FLOATING DAC ENTLADUNG ---
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
        
        // Analog DAC Thermal Drift
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

        let filteredSum = 0;
        let unfilteredSum = 0;

        const isVoice3Off = (this.filterMode & 128) !== 0;

        if (this.regs[23] & 1) filteredSum += voice0; else unfilteredSum += voice0;
        if (this.regs[23] & 2) filteredSum += voice1; else unfilteredSum += voice1;

        if (!isVoice3Off) {
            if (this.regs[23] & 4) filteredSum += voice2; else unfilteredSum += voice2;
        }

        let g = this.g;
        let q = this.q;
        
        // --- PRIO 4: OP-AMP BANDWIDTH LIMITS (Analog Voodoo) ---
        // Resonanz bricht bei sehr tiefen und sehr hohen Frequenzen physikalisch ein
        if (this.activeCutoff < 800.0) {
            let damp = (800.0 - this.activeCutoff) / 800.0; 
            q += damp * 0.55; 
        } else if (this.activeCutoff > 10000.0) {
            let damp = (this.activeCutoff - 10000.0) / 6000.0;
            q += damp * 0.8; // Harter Resonanz-Verlust im High-End
        }

        let h = filteredSum - this.filterLow;
        let hp = (h - q * this.filterBand) / (1.0 + g * (g + q));

        // --- NON-LINEARER ADDIEERER (hp-Op-Amp-Sättigung / Filter Squelch) ---
        if (this.useJfetSaturation) {
            // Die Resonanz (inverses q) treibt den Op-Amp in die asymmetrische Sättigung
            let qDrive = 1.0 / (q + 0.1); 
            let summerDrive = this.thermalJfetDrive * (1.2 + qDrive * 0.15); 
            hp = Math.tanh(hp * summerDrive) / summerDrive;
        }

        let bp = this.filterBand + g * hp;
        let lp = this.filterLow + g * bp;
        
        this.filterLow = lp;
        
        if (this.useJfetSaturation) {
            let driveP = this.thermalJfetDrive;
            let driveN = driveP * 1.875; 
            
            if (bp > 0) {
                this.filterBand = Math.tanh(bp * driveP) / driveP;
            } else {
                this.filterBand = Math.tanh(bp * driveN) / driveN;
            }
        } else {
            this.filterBand = bp / (1.0 + Math.abs(bp) * 0.15); 
        }

        // --- PRIO 4: PHASE ERROR MIXING (The Hubbard Notch) ---
        // Wenn LP und HP gemischt werden (Notch), ist der Highpass auf dem echten 
        // 6581 aufgrund von Bauteiltoleranzen leicht phasenverschoben und gedämpft.
        let outLP = (this.filterMode & 16) ? this.filterLow : 0;
        let outBP = (this.filterMode & 32) ? this.filterBand : 0;
        let outHP = (this.filterMode & 64) ? hp : 0;

        if ((this.filterMode & 80) === 80) { // Notch-Filter (LP + HP)
            outHP *= 0.85; // Asymmetrische Dämpfung erzeugt den echten Hubbard-Phaser-Klang
        }

        let filterOut = outLP + outBP + outHP;

        let leakage = filteredSum * this.thermalLeakage;
        let filteredMix = filterOut + leakage;

        let rawSum = unfilteredSum + filteredMix;
        let vcaIn = rawSum * 0.42; 
        
        let vcaQuad = this.useJfetSaturation ? (0.05 * Math.pow(vcaIn, 2)) : 0;
        
        // --- CIRCUIT-ACCURATE MULTIPLIER OFFSET (The true $D418 Bug) ---
        // Der echte 6581 Mischer hat einen permanenten DC-Offset von ca. 400mV.
        // Wenn $D418 rasant umgeschaltet wird, wird dieser konstante Gleichstrom mit dem 
        // neuen Lautstärkewert multipliziert. Das IST der berühmte Arkanoid Digidrum-Hack!
        let vcaInWithBias = vcaIn + 0.45;

        let finalMix = vcaInWithBias > 0 
            ? Math.tanh(vcaInWithBias + vcaQuad) 
            : Math.tanh(vcaInWithBias * 0.85 + vcaQuad) / 0.85;

        // Der Lautstärke-DAC multipliziert nun direkt den analogen, gesättigten DC-Offset!
        this.outputSample = (finalMix * this.masterVol) + this.thermalDcOffset;
    }
}
