// === js/worklets/lib/sid-chip.js ===
// =========================================================
// MOS Technology SID 6581 Sound Chip Emulation (v1.5.0)
// True Analog Master Edition:
// - Parallel 3-Voice Phase Accumulator & Symmetric Hard-Sync/RingMod
// - Full 12-Bit Waveform DAC Input, Persistent 15-Bit ADSR State
// - Black-Box-Calibrated R3 Cutoff/Resonance and 2MHz ZDF Filter
// =========================================================

import { calculateWaveform12Bit6581R3 } from './sid-waveforms-6581.js';
import { WAVE_DAC_6581_R3, DAC_LUT_6581_R3, RATE_COUNTER_PERIOD } from './sid-luts.js';
import {
    clockSidEnvelope,
    initializeSidEnvelope,
    setSidEnvelopeGate
} from './sid-envelope.js';
import {
    BP_FEEDTHROUGH_6581_R3,
    CUTOFF_HZ_6581_R3,
    FILTER_DAMPING_6581_R3,
    HP_FEEDTHROUGH_6581_R3,
    HP_GAIN_6581_R3,
    SID_FILTER_SUBCLOCK
} from './sid-filter-6581.js';

// The datasheet defines sixteen linear master-volume steps.
const VOLUME_DAC_6581 = new Float32Array(16);
for (let i = 0; i < 16; i++) VOLUME_DAC_6581[i] = i / 15;

export class SIDChip {
    // Optional deterministic calibration hook for offline measurements.
    // Browser playback keeps the original per-instance analogue variation.
    constructor(vcfOffset = (Math.random() - 0.5) * 80.0) {
        this.model = 'MOS6581_R3';
        this.waveformDac = WAVE_DAC_6581_R3;
        this.envelopeDac = DAC_LUT_6581_R3;
        this.regs = new Uint8Array(29);
        this.regs[24] = 0x0F;
        this.voices = [];
        for (let i = 0; i < 3; i++) {
            const voice = {
                freq: 0, pw: 2048, ctrl: 0, phase: 0,
                waveOut12Bit: 0,
                waveOut8Bit: 0,
                env8Bit: 0, lfsr: 0x7FFFFF,
                attack_period: RATE_COUNTER_PERIOD[0],
                decay_period: RATE_COUNTER_PERIOD[0],
                sustain_level: 0,
                release_period: RATE_COUNTER_PERIOD[0],
                msbRisingEdge: false
            };
            initializeSidEnvelope(voice);
            this.voices.push(voice);
        }
        this.cutoff = 30; this.resonance = 0; this.filterMode = 0x0F;
        this.masterVol = VOLUME_DAC_6581[15];
        this.filterLow = 0; this.filterBand = 0;
        
        this.x1 = 0.0;
        this.x2 = 0.0;

        this.outputSample = 0;
        this.useJfetSaturation = true; 
        
        this.g = 0;
        this.q = 1.0;
        this.activeCutoff = 30.0;
        
        this.vcfOffset = vcfOffset;

        this._temperature = 55.0;
        this.thermalDacGain = 1.0;
        this.thermalDacOffset = 0.0;
        this.thermalDcOffset = 0.0;
        this.thermalMasterDcBias = 0.90;

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
        const cutoffReg = (this.regs[21] & 7) | (this.regs[22] << 3);
        const resonance = this.regs[23] >> 4;

        // vcfOffset is an explicit per-chip calibration offset, not a random
        // temperature curve. Temperature no longer changes the measured map.
        this.activeCutoff = Math.max(30.0,
            CUTOFF_HZ_6581_R3[cutoffReg] + this.vcfOffset);
        this.g = Math.tan(Math.PI * this.activeCutoff / SID_FILTER_SUBCLOCK);
        this.q = FILTER_DAMPING_6581_R3[cutoffReg * 16 + resonance];

        this.thermalDacGain = 1.0 - (this._temperature - 55.0) * 0.0008;
        this.thermalDacOffset = (this._temperature - 55.0) * 0.0003;
        this.thermalDcOffset = (this._temperature - 55.0) * 0.005;
        this.thermalMasterDcBias = 0.90 + (this._temperature - 55.0) * 0.003;
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
            
            const gate = (ch.ctrl & 1) !== 0;
            const previousGate = (prevCtrl & 1) !== 0;
            if (gate !== previousGate) setSidEnvelopeGate(ch, gate);

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
        clockSidEnvelope(this.voices[v]);
    }

    clockOscillatorsOneCycle() {
        for (let v = 0; v < 3; v++) {
            let ch = this.voices[v];
            if ((ch.ctrl & 8) === 0) {
                let oldAcc = ch.phase;
                let newAcc = (oldAcc + ch.freq) & 0xFFFFFF;
                ch.msbRisingEdge = ((oldAcc & 0x800000) === 0) && ((newAcc & 0x800000) !== 0);
                ch.phase = newAcc;

                let oldStep = oldAcc & 0x080000;
                let newStep = newAcc & 0x080000;
                if (!oldStep && newStep) {
                    let bit = ((ch.lfsr >> 22) ^ (ch.lfsr >> 17)) & 1;

                    if ((ch.ctrl & 0x80) && (ch.ctrl & 0x70) !== 0) {
                        const testPhase = (newAcc >> 12) & 0xFFF;
                        const isPulseLow = (ch.ctrl & 0x40) && (testPhase >= (ch.pw & 0xFFF));
                        
                        if (isPulseLow || (ch.ctrl & 0x30)) {
                            bit = 0; 
                        }
                    }

                    ch.lfsr = ((ch.lfsr << 1) & 0x7FFFFF) | bit;
                }
            } else {
                ch.msbRisingEdge = false;
            }
        }

        for (let v = 0; v < 3; v++) {
            let ch = this.voices[v];
            let prevIdx = v === 0 ? 2 : v - 1;
            if ((ch.ctrl & 2) !== 0 && (ch.ctrl & 8) === 0 && this.voices[prevIdx].msbRisingEdge) {
                ch.phase = 0;
            }
        }
    }

    synthesizeVoiceOneCycle(v) {
        let ch = this.voices[v];

        let prevIdx = v === 0 ? 2 : v - 1;
        let prevCh = this.voices[prevIdx];
        let ownMSB = (ch.phase >> 23) & 1;
        let prevMSB = (prevCh.phase >> 23) & 1;
        let ringMSB = (ch.ctrl & 4) ? (ownMSB ^ prevMSB) : ownMSB;

        if ((ch.ctrl & 0xF0) !== 0) {
            ch.waveOut12Bit = calculateWaveform12Bit6581R3(
                ch.ctrl, ch.phase, ch.pw, ch.lfsr, ringMSB
            );
        }
        // With no selected waveform the DAC input latch retains its last value.
        ch.waveOut8Bit = ch.waveOut12Bit >>> 4;
        ch.env8Bit = ch.envelope_counter;

        const envDac = this.envelopeDac[ch.env8Bit];
        const waveDac = this.waveformDac[ch.waveOut12Bit];

        let waveOutFloat = (waveDac * 2.0) - 1.0;
        waveOutFloat = waveOutFloat * this.thermalDacGain + this.thermalDacOffset;
        
        return waveOutFloat * envDac;
    }

    clock() {
        for (let v = 0; v < 3; v++) {
            this.clockEnvelopeOneCycle(v);
        }

        this.clockOscillatorsOneCycle();

        let voice0 = this.synthesizeVoiceOneCycle(0);
        let voice1 = this.synthesizeVoiceOneCycle(1);
        let voice2 = this.synthesizeVoiceOneCycle(2);

        let filteredSum = 0;
        let unfilteredSum = 0;
        const routing = this.regs[23];
        const voice3Off = (this.filterMode & 128) !== 0;

        if (routing & 1) filteredSum += voice0; else unfilteredSum += voice0;
        if (routing & 2) filteredSum += voice1; else unfilteredSum += voice1;

        // 3 OFF disconnects only the direct path. A filtered voice 3 remains
        // audible, as documented in the datasheet; no invented crosstalk path.
        if (routing & 4) filteredSum += voice2;
        else if (!voice3Off) unfilteredSum += voice2;

        this.processFilterMixer(filteredSum, unfilteredSum);
    }

    // Separate analog entry point for deterministic EXT IN-style measurements.
    // No objects or arrays are created in this hot path.
    processFilterMixer(filteredSum, unfilteredSum) {
        const subG = this.g;
        const k = this.q;
        const denom = 1.0 + subG * (subG + k);
        let filterOut = 0;

        // Two trapezoidal-integrator substeps per SID clock.
        for (let sub = 0; sub < 2; sub++) {
            const hp = (filteredSum - this.x1 * (subG + k) - this.x2) / denom;
            const bp = subG * hp + this.x1;
            const lp = subG * bp + this.x2;

            this.x1 = 2.0 * bp - this.x1;
            this.x2 = 2.0 * lp - this.x2;
            this.filterBand = bp;
            this.filterLow = lp;

            filterOut = ((this.filterMode & 16) ? lp : 0) +
                ((this.filterMode & 32) ?
                    bp + filteredSum * BP_FEEDTHROUGH_6581_R3 : 0) +
                ((this.filterMode & 64) ?
                    hp * HP_GAIN_6581_R3 + filteredSum * HP_FEEDTHROUGH_6581_R3 : 0);
        }

        if (!Number.isFinite(this.filterLow) || !Number.isFinite(this.filterBand)) {
            this.filterLow = 0;
            this.filterBand = 0;
            this.x1 = 0;
            this.x2 = 0;
            filterOut = 0;
        }

        const mixed = unfilteredSum + filterOut;
        const vcaIn = mixed * 0.35;
        const acSaturated = this.useJfetSaturation ? Math.tanh(vcaIn) : vcaIn;
        const finalMix = acSaturated * 1.65 + this.thermalMasterDcBias;
        this.outputSample = finalMix * this.masterVol + this.thermalDcOffset;
        return this.outputSample;
    }
}
