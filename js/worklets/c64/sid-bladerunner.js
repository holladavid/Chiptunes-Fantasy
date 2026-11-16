// === js/worklets/c64/sid-bladerunner.js ===
// =========================================================
// MOS 6581 / 8580 "BLADE RUNNER" CORE v1.1 (Director's Cut)
// 1MHz 6502 Lockstep + Kaiser-Sinc Stereo SID + CS-80 Dual-Rank
// Voice Layer + Dimension-D Chorus + Tape Delay + Lexicon 224 FDN
// =========================================================

import { CPU6502 } from '../lib/cpu6502.js';
import { calculateWaveform8Bit } from '../lib/sid-waveforms.js';
import { DAC_LUT_8580, PWM_LUT, RATE_COUNTER_PERIOD } from '../lib/sid-luts.js';
import { DCBlocker, polyBLEP } from '../lib/dsp-utils.js';
import { SidResampler } from '../lib/sid-resampler.js';

const TWO_PI = Math.PI * 2.0;
const SID_CLOCK = 985248.0; // PAL Master Clock (Hz)
const ENV_ATTACK = 0, ENV_DECAY = 1, ENV_RELEASE = 2;
const MASTER_DC_BIAS = 1.05;

const VOLUME_DAC_8580 = new Float32Array([
    0.0000, 0.0667, 0.1333, 0.2000, 0.2667, 0.3333, 0.4000, 0.4667,
    0.5333, 0.6000, 0.6667, 0.7333, 0.8000, 0.8667, 0.9333, 1.0000
]);

function nextPow2(v) {
    let p = 1;
    while (p < v) p <<= 1;
    return p;
}

function isPrime(n) {
    if (n < 2) return false;
    if ((n & 1) === 0) return n === 2;
    for (let d = 3; d * d <= n; d += 2) {
        if (n % d === 0) return false;
    }
    return true;
}

// Findet die nächste Primzahl >= n für garantierte Teilerfremdheit der FDN-Moden
function nextPrime(n) {
    let c = Math.max(2, n | 0);
    if ((c & 1) === 0) c++;
    while (!isPrime(c)) c += 2;
    return c;
}

// Exakte, trig-freie Equal-Power-Pan-Kurve sin(u * PI/2) auf [0..1]
function fastSinHalfPi(u) {
    const x = u < 0.0 ? 0.0 : (u > 1.0 ? 1.0 : u);
    const x2 = x * x;
    return x * (1.5707963 - x2 * (0.6459641 - 0.0751678 * x2));
}

// Streng monotone Padé-[5/4]-Approximation für tanh(x)
// Fehler < 4e-8 für |x| <= 1, C0-exakter Übergang auf +-1.0 bei |x| = 3.6428
function fastTanh(x) {
    if (x >= 3.6428) return 1.0;
    if (x <= -3.6428) return -1.0;
    const x2 = x * x;
    return x * (945.0 + x2 * (105.0 + x2)) / (945.0 + x2 * (420.0 + 15.0 * x2));
}

// =========================================================
// ZERO-DELAY FEEDBACK (TPT) SVF MIT ANALOGER RESONATOR-SÄTTIGUNG
// =========================================================
class ZDFFilter {
    constructor() {
        this.ic1 = 0.0;
        this.ic2 = 0.0;
        this.a1 = 0.0;
        this.a2 = 0.0;
        this.a3 = 0.0;
        this.k = 1.5;
        this.lp = 0.0;
        this.bp = 0.0;
        this.hp = 0.0;
    }

    reset() {
        this.ic1 = 0.0;
        this.ic2 = 0.0;
        this.lp = 0.0;
        this.bp = 0.0;
        this.hp = 0.0;
    }

    setParams(cutoffHz, resonance, sr) {
        const fc = cutoffHz < 20.0 ? 20.0 : (cutoffHz > sr * 0.42 ? sr * 0.42 : cutoffHz);
        const res = resonance < 0.0 ? 0.0 : (resonance > 0.92 ? 0.92 : resonance);

        // Padé [3/2] für tan(PI * fc / sr)
        const x = Math.PI * fc / sr;
        const x2 = x * x;
        const g = x * (15.0 - x2) / (15.0 - 6.0 * x2);

        const k = 1.8 - res * 1.66;
        const a1 = 1.0 / (1.0 + g * (g + k));
        this.k = k;
        this.a1 = a1;
        this.a2 = g * a1;
        this.a3 = g * this.a2;
    }

    process(input) {
        const u = this.ic1 > 2.5 ? 2.5 : (this.ic1 < -2.5 ? -2.5 : this.ic1);
        const ic1Sat = u - (u * u * u) * 0.035;

        const v3 = input - this.ic2;
        const v1 = this.a1 * ic1Sat + this.a2 * v3;
        const v2 = this.ic2 + this.a2 * ic1Sat + this.a3 * v3;

        this.ic1 = 2.0 * v1 - ic1Sat;
        this.ic2 = 2.0 * v2 - this.ic2;

        if (!Number.isFinite(this.ic1) || !Number.isFinite(this.ic2)) {
            this.reset();
            return;
        }

        this.lp = v2;
        this.bp = v1;
        this.hp = input - this.k * v1 - v2;
    }

    step(input, cutoffHz, resonance, sr) {
        this.setParams(cutoffHz, resonance, sr);
        this.process(input);
    }
}

// =========================================================
// DYNAMISCHES C64-BÜHNEN-STAGING (HZ- & WELLENFORM-BASIERT)
// =========================================================
class SIDDynamicStaging {
    constructor() {
        this.voices = [
            { pan: 0.34, sub: 0.0, rev: 0.48 },
            { pan: 0.66, sub: 0.0, rev: 0.48 },
            { pan: 0.50, sub: 0.0, rev: 0.42 }
        ];
        this.basePans = [0.34, 0.66, 0.50];
    }

    reset() {
        for (let i = 0; i < 3; i++) {
            this.voices[i].pan = this.basePans[i];
            this.voices[i].sub = 0.0;
            this.voices[i].rev = i === 2 ? 0.42 : 0.48;
        }
    }

    update(sid, speed) {
        for (let v = 0; v < 3; v++) {
            const ch = sid.voices[v];
            const st = this.voices[v];
            const hz = (ch.freq * SID_CLOCK) / 16777216.0;
            const ctrl = ch.ctrl;
            const hasTone = (ctrl & 0x70) !== 0;
            const isNoise = (ctrl & 0x80) !== 0;
            const isFiltered = (sid.regs[23] & (1 << v)) !== 0;
            const isActive = ((ctrl & 1) !== 0 || ch.envelope_counter > 0) && (hasTone || isNoise);

            let targetPan = this.basePans[v];
            let targetSub = 0.0;
            let targetRev = isFiltered ? 0.56 : 0.44;

            if (isActive) {
                if (isNoise && !hasTone) {
                    // Snare / HiHat / Perkussives Rauschen
                    targetPan = v === 0 ? 0.44 : (v === 1 ? 0.56 : 0.50);
                    targetSub = 0.0;
                    targetRev = 0.28;
                } else if (hasTone && hz > 18.0 && hz < 185.0) {
                    // Bass / Sub-Fundament: eng in der Mitte, trocken & druckvoll
                    targetPan = 0.50;
                    targetSub = hz < 120.0 ? 0.85 : 0.55;
                    targetRev = 0.10;
                } else if (hz >= 520.0) {
                    // Hohe Melodie-Leads / Glocken / Arps: breite Bühne & schwebender Hall
                    targetPan = v === 0 ? 0.28 : (v === 1 ? 0.72 : 0.46);
                    targetSub = 0.0;
                    targetRev = isFiltered ? 0.65 : 0.52;
                }
            }

            st.pan += (targetPan - st.pan) * speed;
            st.sub += (targetSub - st.sub) * speed;
            st.rev += (targetRev - st.rev) * speed;
        }
    }
}

// =========================================================
// AUTHENTISCHER 1MHz SID-KERN (HARD-SYNC, RINGMOD, ZDF-VCF)
// =========================================================
class SIDBladeRunnerChip {
    constructor() {
        this.regs = new Uint8Array(29);
        this.voices = [];
        for (let i = 0; i < 3; i++) {
            this.voices.push({
                freq: 0, pw: 2048, ctrl: 0, phase: 0,
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
                gateJustTriggered: false,
                settleTimer: 0,
                settleMax: 0
            });
        }

        this.temperature = 55.0;
        this.panL0 = 0.80; this.panR0 = 0.60;
        this.panL1 = 0.60; this.panR1 = 0.80;
        this.panL2 = 0.707; this.panR2 = 0.707;

        this.filterMode = 0x0F;
        this.masterVol = VOLUME_DAC_8580[15];
        this.dcBaseline = MASTER_DC_BIAS;
        this.activeCutoff = 24.0;
        this.q = 1.414;
        this.subG = 0.0;
        this.subGK = 1.414;
        this.denomInv = 1.0;
        this.otaDrive = 0.72;
        this.invOtaDrive = 1.0 / 0.72;

        this.x1_L = 0.0; this.x2_L = 0.0;
        this.x1_R = 0.0; this.x2_R = 0.0;
        this.outputSampleL = 0.0;
        this.outputSampleR = 0.0;

        this.lastVol = 1.0;
        this.cycleCount = 0;
        this.lastVolWriteCycle = 0;
        this.digiDensity = 0;
        this.digiPeakDelta = 0.0;
        this.d418Writes = 0;
        this.registerWrites = 0;

        this.reset();
    }

    reset() {
        this.regs.fill(0);
        this.regs[24] = 0x0F;

        for (let i = 0; i < 3; i++) {
            const ch = this.voices[i];
            ch.freq = 0;
            ch.pw = 2048;
            ch.ctrl = 0;
            ch.phase = 0;
            ch.state = ENV_RELEASE;
            ch.prevGate = false;
            ch.waveOut8Bit = 0x80;
            ch.busCharge = 0x80;
            ch.env8Bit = 0;
            ch.lfsr = 0x7FFFFF;
            ch.rate_counter = 0;
            ch.exponential_counter = 0;
            ch.envelope_counter = 0;
            ch.attack_period = RATE_COUNTER_PERIOD[0];
            ch.decay_period = RATE_COUNTER_PERIOD[0];
            ch.sustain_level = 0;
            ch.release_period = RATE_COUNTER_PERIOD[0];
            ch.msbRisingEdge = false;
            ch.envDelay = 0;
            ch.gateJustTriggered = false;
            ch.settleTimer = 0;
            ch.settleMax = 0;
        }

        this.filterMode = 0x0F;
        this.masterVol = VOLUME_DAC_8580[15];
        this.dcBaseline = MASTER_DC_BIAS * this.masterVol;

        this.x1_L = 0.0; this.x2_L = 0.0;
        this.x1_R = 0.0; this.x2_R = 0.0;
        this.outputSampleL = 0.0;
        this.outputSampleR = 0.0;

        this.lastVol = 1.0;
        this.cycleCount = 0;
        this.lastVolWriteCycle = 0;
        this.digiDensity = 0;
        this.digiPeakDelta = 0.0;
        this.d418Writes = 0;
        this.registerWrites = 0;

        this.updateFilterParameters();
    }

    updateFilterParameters() {
        const cutoffReg = (this.regs[21] & 7) | (this.regs[22] << 3);
        const norm = cutoffReg / 2047.0;
        const thermalShift = (this.temperature - 55.0) * 12.0;

        // Authentische Hybrid-Kurve (MOS 8580/6581 Sweetspot):
        // $000 -> ~24 Hz, $200 -> ~1.75 kHz, $400 -> ~4.95 kHz, $7FF -> ~14.2 kHz
        this.activeCutoff = Math.max(22.0, Math.min(16500.0, 24.0 + Math.pow(norm, 1.52) * 14200.0 + thermalShift));

        const resReg = this.regs[23] >> 4;
        const normRes = resReg / 15.0;
        this.q = 1.414 - (normRes * 1.16);

        // Vorberechnung für die 2x-Oversampling-ZDF-Schleife (spart 1M tan() + 4M Divs/s)
        const subG = Math.tan((Math.PI * this.activeCutoff) / 1970496.0);
        this.subG = subG;
        this.subGK = subG + this.q;
        this.denomInv = 1.0 / (1.0 + subG * this.subGK);
        this.otaDrive = 0.62 + (this.temperature - 15.0) * 0.0025;
        this.invOtaDrive = 1.0 / this.otaDrive;
    }

    writeReg(reg, val) {
        if (reg >= 29) return;
        this.registerWrites++;
        this.regs[reg] = val;

        const vIdx = (reg / 7) | 0;
        if (vIdx < 3) {
            const ch = this.voices[vIdx];
            const base = vIdx * 7;
            const offset = reg - base;

            ch.freq = this.regs[base] | (this.regs[base + 1] << 8);
            ch.pw = this.regs[base + 2] | ((this.regs[base + 3] & 15) << 8);

            const prevCtrl = ch.ctrl;
            ch.ctrl = this.regs[base + 4];

            // 6502-Bus-Settle-Fenster (~64 Zyklen = 0.065ms) verhindert zerrissene
            // 16-Bit-Frequenzen zwischen STA $D400, STA $D401 und STA $D404
            if (offset === 0 || offset === 1 || offset === 4) {
                if (ch.settleTimer === 0 && ch.settleMax === 0) {
                    ch.settleTimer = 64;
                    ch.settleMax = 128;
                } else if (ch.settleMax > 0) {
                    ch.settleTimer = ch.settleMax < 64 ? ch.settleMax : 64;
                }
            }

            const gate = (ch.ctrl & 1) !== 0;
            const prevGate = (prevCtrl & 1) !== 0;

            if (gate !== prevGate) {
                ch.envDelay = 1;
                ch.state = gate ? ENV_ATTACK : ENV_RELEASE;
                if (gate) {
                    ch.rate_counter = 0;
                    ch.exponential_counter = 0;
                    ch.gateJustTriggered = true;
                }
            }
            ch.prevGate = gate;

            if (ch.ctrl & 8) {
                ch.phase = 0;
                ch.lfsr = 0x7FFFFF;
            }

            if (offset === 5) {
                ch.attack_period = RATE_COUNTER_PERIOD[val >> 4];
                ch.decay_period = RATE_COUNTER_PERIOD[val & 15];
            } else if (offset === 6) {
                ch.sustain_level = (val >> 4) | ((val >> 4) << 4);
                ch.release_period = RATE_COUNTER_PERIOD[val & 15];
            }
        } else if (reg === 21 || reg === 22 || reg === 23) {
            this.updateFilterParameters();
        } else if (reg === 24) {
            this.filterMode = val;
            this.d418Writes++;

            const volIndex = val & 15;
            const newVol = VOLUME_DAC_8580[volIndex];
            const delta = Math.abs(newVol - this.lastVol);

            // Unterscheidet echte Audio-Rate-$D418-PCM-Streams (> ~400 Hz) von 50Hz-Fades
            if (delta > 0.001) {
                const dtCycles = (this.cycleCount - this.lastVolWriteCycle) >>> 0;
                this.lastVolWriteCycle = this.cycleCount;
                if (dtCycles < 2500) {
                    if (this.digiDensity < 8) this.digiDensity++;
                } else {
                    this.digiDensity = 1;
                }
                if (this.digiDensity >= 3 && delta > 0.14) {
                    if (delta > this.digiPeakDelta) this.digiPeakDelta = delta;
                }
            }

            this.lastVol = newVol;
            this.masterVol = newVol;
        }
    }

    clockEnvelopeOneCycle(v) {
        const ch = this.voices[v];
        if (ch.envDelay > 0) { ch.envDelay--; return; }

        let ratePeriod = ch.release_period;
        if (ch.state === ENV_ATTACK) ratePeriod = ch.attack_period;
        else if (ch.state === ENV_DECAY) ratePeriod = ch.decay_period;

        ch.rate_counter++;

        if (ch.rate_counter >= ratePeriod) {
            ch.rate_counter = 0;

            let expPeriod = 1;
            if (ch.state !== ENV_ATTACK) {
                const envVal = ch.envelope_counter;
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

    clockOscillatorsOneCycle() {
        for (let v = 0; v < 3; v++) {
            const ch = this.voices[v];
            if (ch.settleTimer > 0) ch.settleTimer--;
            if (ch.settleMax > 0) ch.settleMax--;

            if ((ch.ctrl & 8) === 0) {
                const oldAcc = ch.phase;
                const newAcc = (oldAcc + ch.freq) & 0xFFFFFF;
                ch.msbRisingEdge = ((oldAcc & 0x800000) === 0) && ((newAcc & 0x800000) !== 0);
                ch.phase = newAcc;

                const oldStep = oldAcc & 0x080000;
                const newStep = newAcc & 0x080000;
                if (!oldStep && newStep) {
                    let bit = ((ch.lfsr >> 22) ^ (ch.lfsr >> 17)) & 1;
                    if ((ch.ctrl & 0x80) && (ch.ctrl & 0x70) !== 0) {
                        const testPhase = (newAcc >> 12) & 0xFFF;
                        const pwMapped = PWM_LUT[ch.pw & 0xFFF];
                        const isPulseLow = (ch.ctrl & 0x40) && (testPhase >= pwMapped);
                        if (isPulseLow || (ch.ctrl & 0x30)) bit = 0;
                    }
                    ch.lfsr = ((ch.lfsr << 1) & 0x7FFFFF) | bit;
                }
            } else {
                ch.msbRisingEdge = false;
            }
        }

        for (let v = 0; v < 3; v++) {
            const ch = this.voices[v];
            const prevIdx = v === 0 ? 2 : v - 1;
            if ((ch.ctrl & 2) !== 0 && (ch.ctrl & 8) === 0 && this.voices[prevIdx].msbRisingEdge) {
                ch.phase = 0;
            }
        }
    }

    synthesizeVoiceOneCycle(v) {
        const ch = this.voices[v];
        const prevIdx = v === 0 ? 2 : v - 1;
        const prevCh = this.voices[prevIdx];
        const ownMSB = (ch.phase >> 23) & 1;
        const prevMSB = (prevCh.phase >> 23) & 1;
        const ringMSB = (ch.ctrl & 4) ? (ownMSB ^ prevMSB) : ownMSB;

        const hasWave = (ch.ctrl & 0xF0) !== 0;
        if (hasWave) {
            const rawWave8Bit = calculateWaveform8Bit(ch.ctrl, ch.phase, ch.pw, ch.lfsr, ringMSB, ch.freq);
            const waveMask = ch.ctrl & 0xF0;
            const isCombined = (waveMask !== 0x10 && waveMask !== 0x20 && waveMask !== 0x40 && waveMask !== 0x80);

            if (isCombined) {
                ch.busCharge += 0.35 * (rawWave8Bit - ch.busCharge);
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

        if (v === 2) {
            // Hält $D41B (OSC3) & $D41C (ENV3) im Registerfile zyklusgenau aktuell
            this.regs[27] = ch.waveOut8Bit & 0xFF;
            this.regs[28] = ch.env8Bit;
        }

        const envDac = DAC_LUT_8580[ch.env8Bit];
        const waveDac = DAC_LUT_8580[ch.waveOut8Bit | 0];
        const waveOutFloat = (waveDac * 2.0) - 1.0;

        return (waveOutFloat + 0.025) * envDac;
    }

    clock() {
        this.cycleCount = (this.cycleCount + 1) | 0;
        this.clockEnvelopeOneCycle(0);
        this.clockEnvelopeOneCycle(1);
        this.clockEnvelopeOneCycle(2);
        this.clockOscillatorsOneCycle();

        const voice0 = this.synthesizeVoiceOneCycle(0);
        const voice1 = this.synthesizeVoiceOneCycle(1);
        const voice2 = this.synthesizeVoiceOneCycle(2);

        const v0_L = voice0 * this.panL0; const v0_R = voice0 * this.panR0;
        const v1_L = voice1 * this.panL1; const v1_R = voice1 * this.panR1;
        const v2_L = voice2 * this.panL2; const v2_R = voice2 * this.panR2;

        const filtBits = this.regs[23];
        const fMode = this.filterMode;
        const isVoice3Off = (fMode & 128) !== 0;

        let filtSumL = 0.0, unfiltSumL = 0.0;
        let filtSumR = 0.0, unfiltSumR = 0.0;

        if (filtBits & 1) { filtSumL += v0_L; filtSumR += v0_R; } else { unfiltSumL += v0_L; unfiltSumR += v0_R; }
        if (filtBits & 2) { filtSumL += v1_L; filtSumR += v1_R; } else { unfiltSumL += v1_L; unfiltSumR += v1_R; }

        if (filtBits & 4) {
            filtSumL += v2_L;
            filtSumR += v2_R;
        } else if (!isVoice3Off) {
            unfiltSumL += v2_L;
            unfiltSumR += v2_R;
        } else {
            // Subtiles analoges AC-Übersprechen statt unipolarem Envelope-DC-Knacksen
            const v3AcLeak = voice2 * 0.006;
            unfiltSumL += v3AcLeak * this.panL2;
            unfiltSumR += v3AcLeak * this.panR2;
        }

        const subG = this.subG;
        const subGK = this.subGK;
        const denomInv = this.denomInv;
        const otaDrive = this.otaDrive;
        const invOtaDrive = this.invOtaDrive;

        // 2x Oversampled ZDF-SVF (ausgerollt: Summierung erst nach Sub-Step 2)
        // Sub-Step 1
        let hpL = (filtSumL - this.x1_L * subGK - this.x2_L) * denomInv;
        let bpL = fastTanh((subG * hpL + this.x1_L) * otaDrive) * invOtaDrive;
        let lpL = subG * bpL + this.x2_L;
        this.x1_L = 2.0 * bpL - this.x1_L;
        this.x2_L = 2.0 * lpL - this.x2_L;

        let hpR = (filtSumR - this.x1_R * subGK - this.x2_R) * denomInv;
        let bpR = fastTanh((subG * hpR + this.x1_R) * otaDrive) * invOtaDrive;
        let lpR = subG * bpR + this.x2_R;
        this.x1_R = 2.0 * bpR - this.x1_R;
        this.x2_R = 2.0 * lpR - this.x2_R;

        // Sub-Step 2
        hpL = (filtSumL - this.x1_L * subGK - this.x2_L) * denomInv;
        bpL = fastTanh((subG * hpL + this.x1_L) * otaDrive) * invOtaDrive;
        lpL = subG * bpL + this.x2_L;
        this.x1_L = 2.0 * bpL - this.x1_L;
        this.x2_L = 2.0 * lpL - this.x2_L;

        hpR = (filtSumR - this.x1_R * subGK - this.x2_R) * denomInv;
        bpR = fastTanh((subG * hpR + this.x1_R) * otaDrive) * invOtaDrive;
        lpR = subG * bpR + this.x2_R;
        this.x1_R = 2.0 * bpR - this.x1_R;
        this.x2_R = 2.0 * lpR - this.x2_R;

        // Tow-Thomas MOS-Topologie: invertierter BP (-bp), echter TPT-Notch bei LP+HP ($5x)
        let filterOutL = ((fMode & 16) ? lpL : 0.0) - ((fMode & 32) ? bpL : 0.0) + ((fMode & 64) ? hpL : 0.0);
        let filterOutR = ((fMode & 16) ? lpR : 0.0) - ((fMode & 32) ? bpR : 0.0) + ((fMode & 64) ? hpR : 0.0);

        if (!Number.isFinite(this.x1_L) || !Number.isFinite(this.x2_L)) {
            this.x1_L = 0.0; this.x2_L = 0.0; filterOutL = 0.0;
        }
        if (!Number.isFinite(this.x1_R) || !Number.isFinite(this.x2_R)) {
            this.x1_R = 0.0; this.x2_R = 0.0; filterOutR = 0.0;
        }

        const mixL = unfiltSumL + filterOutL;
        const mixR = unfiltSumR + filterOutR;

        // Bewahrt 100% der $D418-PCM-Digis, eliminiert aber den +1.05-Einschalt-DC-Sprung
        this.outputSampleL = (fastTanh(mixL * 0.45) * 1.48 + MASTER_DC_BIAS) * this.masterVol - this.dcBaseline;
        this.outputSampleR = (fastTanh(mixR * 0.45) * 1.48 + MASTER_DC_BIAS) * this.masterVol - this.dcBaseline;
    }
}

// =========================================================
// YAMAHA CS-80 VOICE LAYER (PARALLEL ZUM 1MHz SID-KERN)
// Dual-Rank PolyBLEP VCO -> Drive -> HPF -> LPF -> [+ Post-VCF Sine] -> VCA
// =========================================================
class CS80SidVoice {
    constructor(voiceIdx, sr) {
        this.voiceIdx = voiceIdx;
        this.sr = sr;

        this.phase1 = (voiceIdx * 0.19) % 1.0;
        this.phase2 = (0.37 + voiceIdx * 0.23) % 1.0;
        this.phaseSub = (voiceIdx * 0.11) % 1.0;

        this.lfoPwm = (voiceIdx * 0.33) % 1.0;
        this.lfoPwmInc = (0.27 + voiceIdx * 0.07) / sr;
        this.lfoWow = (voiceIdx * 0.31) % 1.0;
        this.lfoWowInc = (0.14 + voiceIdx * 0.03) / sr;
        this.lfoFlut = (voiceIdx * 0.27) % 1.0;
        this.lfoFlutInc = (1.13 + voiceIdx * 0.19) / sr;

        this.hpf = new ZDFFilter();
        this.lpf = new ZDFFilter();

        this.smoothVolt = 0.0;
        this.filterEnv = 0.0;
        this.filterEnvAttack = false;
        this.pitchBloom = 0.0;
        this.vibratoGate = 0.0;
        this.currentInc = 0.0;
        this.useGlide = false;

        this.prevActive = false;
        this.prevFreq = 0;
        this.latchedFreq = 0;

        // Reine Audio-Sample-Zeitbasis (immun gegen 50Hz-vs-CIA-Multispeed-Races)
        this.arpWindowSamples = Math.round(0.105 * sr);
        this.glideWindowSamples = Math.round(0.040 * sr);
        this.arpDecayStartSamples = Math.round(0.120 * sr);
        this.maxNoteAge = Math.round(10.0 * sr);
        this.arpSampleDecay = Math.exp(Math.log(0.85) / (0.020 * sr));
        this.samplesSinceNote = this.maxNoteAge;
        this.arpAmount = 0.0;

        this.atkSlow = 1.0 - Math.exp(-1.0 / (0.042 * sr));
        this.atkFast = 1.0 - Math.exp(-1.0 / (0.0045 * sr));
        this.decRate = 1.0 - Math.exp(-1.0 / (0.540 * sr));
        this.bloomDec = Math.exp(-1.0 / (0.024 * sr));
        this.vibRise = 1.0 - Math.exp(-1.0 / (0.260 * sr));
        this.glideCoef = 1.0 - Math.exp(-1.0 / (0.008 * sr)); // ~8ms CS-80 Ribbon-Legato

        this.vcaAtk = 1.0 - Math.exp(-1.0 / (0.0018 * sr));
        this.vcaRel = 1.0 - Math.exp(-1.0 / (0.0180 * sr));
    }

    reset(clearFilters = false) {
        this.smoothVolt = 0.0;
        this.filterEnv = 0.0;
        this.filterEnvAttack = false;
        this.pitchBloom = 0.0;
        this.vibratoGate = 0.0;
        this.currentInc = 0.0;
        this.useGlide = false;
        this.prevActive = false;
        this.prevFreq = 0;
        this.latchedFreq = 0;
        this.samplesSinceNote = this.maxNoteAge;
        this.arpAmount = 0.0;
        if (clearFilters) {
            this.hpf.reset();
            this.lpf.reset();
        }
    }

    updateControl(sidCh, mutedBy3Off) {
        if (this.samplesSinceNote < this.maxNoteAge) this.samplesSinceNote++;
        if (this.samplesSinceNote > this.glideWindowSamples) this.useGlide = false;
        if (this.samplesSinceNote > this.arpDecayStartSamples) this.arpAmount *= this.arpSampleDecay;

        // Wartet das kurze 6502-Bus-Settle-Fenster ab, damit Lo-Byte, Hi-Byte und Gate atomar vorliegen
        if (sidCh.settleTimer > 0) return;

        const settledFreq = sidCh.freq;
        this.latchedFreq = settledFreq;

        const ctrl = sidCh.ctrl;
        const hasTone = (ctrl & 0x70) !== 0;
        const gateOn = (ctrl & 1) !== 0;
        const isActive = !mutedBy3Off && hasTone && ((ctrl & 8) === 0) && settledFreq > 0
            && (gateOn || sidCh.envelope_counter > 0);

        let retrigger = sidCh.gateJustTriggered;
        sidCh.gateJustTriggered = false;

        let pitchJump = false;
        if (isActive) {
            if (!this.prevActive) {
                retrigger = true;
            } else if (settledFreq > 0 && this.prevFreq > 0) {
                const relDiff = Math.abs(settledFreq - this.prevFreq) / this.prevFreq;
                if (relDiff > 0.035) {
                    retrigger = true;
                    pitchJump = true;
                }
            }
        }

        if (retrigger && !mutedBy3Off && settledFreq > 0) {
            if (this.samplesSinceNote <= this.arpWindowSamples) {
                this.arpAmount = Math.min(1.0, this.arpAmount + 0.42);
            } else {
                this.arpAmount *= 0.40;
            }

            if (pitchJump && this.prevActive && this.arpAmount < 0.35) {
                const ratio = settledFreq / this.prevFreq;
                this.useGlide = (ratio > 0.48 && ratio < 2.08);
            } else {
                this.useGlide = false;
            }

            this.samplesSinceNote = 0;
            this.filterEnvAttack = true;
            if (this.arpAmount < 0.5) {
                this.pitchBloom = this.useGlide ? 0.35 : 1.0;
                this.vibratoGate *= 0.30;
            }
        }

        this.prevActive = isActive;
        if (settledFreq > 0) this.prevFreq = settledFreq;
    }

    process(sidCh, mutedBy3Off, isFiltered, sidFilterMode, sidCutoffNorm, stageSub, smoothMasterVol, sidechainEnv, vibSin, thermalDrift) {
        this.updateControl(sidCh, mutedBy3Off);

        const sr = this.sr;
        const ctrl = sidCh.ctrl;
        const waveMask = ctrl & 0xF0;
        const hasTri = (waveMask & 0x10) !== 0;
        const hasSaw = (waveMask & 0x20) !== 0;
        const hasPulse = (waveMask & 0x40) !== 0;
        const hasNoise = (waveMask & 0x80) !== 0;
        const hasTone = hasTri || hasSaw || hasPulse;
        const isExoticSid = ((ctrl & 6) !== 0) || (hasNoise && hasTone) || (hasTri && hasSaw) || (hasSaw && hasPulse);

        this.lfoPwm += this.lfoPwmInc;
        if (this.lfoPwm >= 1.0) this.lfoPwm -= 1.0;
        this.lfoWow += this.lfoWowInc;
        if (this.lfoWow >= 1.0) this.lfoWow -= 1.0;
        this.lfoFlut += this.lfoFlutInc;
        if (this.lfoFlut >= 1.0) this.lfoFlut -= 1.0;

        if (this.filterEnvAttack) {
            const rate = this.atkSlow + (this.atkFast - this.atkSlow) * Math.max(this.arpAmount, stageSub * 0.7);
            this.filterEnv += (1.05 - this.filterEnv) * rate;
            if (this.filterEnv >= 1.0) {
                this.filterEnv = 1.0;
                this.filterEnvAttack = false;
            }
        } else {
            this.filterEnv += (0.26 - this.filterEnv) * this.decRate;
        }

        this.pitchBloom *= this.bloomDec;
        this.vibratoGate += (1.0 - this.vibratoGate) * this.vibRise;

        const activeFreq = this.latchedFreq > 0 ? this.latchedFreq : sidCh.freq;

        // Bei Sync/RingMod/Combined-SID-Tricks tritt CS-80 zurück, damit die SID-Textur dominiert
        let layerWeight = 1.0;
        if (mutedBy3Off || !hasTone || (ctrl & 8) !== 0 || activeFreq === 0) {
            layerWeight = 0.0;
        } else if (isExoticSid) {
            layerWeight = 0.30;
        }

        const envDac = DAC_LUT_8580[sidCh.envelope_counter];
        const targetVolt = envDac * smoothMasterVol * layerWeight;
        const vcaSpeed = targetVolt > this.smoothVolt ? this.vcaAtk : this.vcaRel;
        this.smoothVolt += (targetVolt - this.smoothVolt) * vcaSpeed;

        const targetInc = (activeFreq > 0) ? ((activeFreq * SID_CLOCK) / 16777216.0) / sr : 0.0;
        if (targetInc <= 0.0) {
            this.currentInc = 0.0;
        } else if (this.currentInc <= 0.0 || !this.useGlide || stageSub > 0.45) {
            this.currentInc = targetInc;
        } else {
            this.currentInc += (targetInc - this.currentInc) * this.glideCoef;
        }
        const incBase = this.currentInc;

        // Zero-Artifact Sleep-Fast-Path für stumme oder reine Noise-Kanäle (<-114 dBFS)
        if (this.smoothVolt < 1e-5 && targetVolt === 0.0) {
            const filterEnergy = Math.abs(this.hpf.ic1) + Math.abs(this.hpf.ic2)
                               + Math.abs(this.lpf.ic1) + Math.abs(this.lpf.ic2);
            if (filterEnergy < 1e-7) {
                if (incBase > 0.0) {
                    this.phase1 = (this.phase1 + incBase) % 1.0;
                    this.phase2 = (this.phase2 + incBase) % 1.0;
                    this.phaseSub = (this.phaseSub + incBase) % 1.0;
                }
                return 0.0;
            }
        }

        let nyquistGain = 1.0;
        if (incBase <= 0.0) nyquistGain = 0.0;
        else if (incBase > 0.36) nyquistGain = incBase >= 0.47 ? 0.0 : (0.47 - incBase) / 0.11;

        const wow = Math.sin(this.lfoWow * TWO_PI) * (0.0028 + thermalDrift * 0.0010);
        const flutter = Math.sin(this.lfoFlut * TWO_PI) * 0.0009;
        const vibDepth = (0.0003 + this.smoothVolt * 0.0030) * this.vibratoGate * (1.0 - this.arpAmount * 0.85);
        const pitchMod = 1.0 + wow + flutter + vibSin * vibDepth - this.pitchBloom * 0.0065 * (1.0 - stageSub * 0.65);

        // Symmetrisches Dual-Rank-Detuning um das exakte 1MHz-SID-Pitchzentrum
        const halfDetune = 0.00022 + (1.0 - stageSub) * (0.0010 + thermalDrift * 0.0004);
        const incCenter = incBase * pitchMod;
        const inc1 = incCenter * (1.0 - halfDetune);
        const inc2 = incCenter * (1.0 + halfDetune);

        if (incCenter > 0.0) {
            this.phase1 = (this.phase1 + inc1) % 1.0;
            this.phase2 = (this.phase2 + inc2) % 1.0;
            this.phaseSub = (this.phaseSub + incCenter) % 1.0;
        }

        let vcfIn = 0.0;
        let postFilterSine = 0.0;

        if (nyquistGain > 0.0 && this.smoothVolt > 0.00001) {
            const sidPwNorm = Math.max(0.08, Math.min(0.92, sidCh.pw / 4095.0));
            const pwmDrift = Math.sin(this.lfoPwm * TWO_PI) * 0.08;
            const pwm1 = Math.max(0.05, Math.min(0.95, sidPwNorm + pwmDrift));
            const pwm2 = Math.max(0.05, Math.min(0.95, sidPwNorm - pwmDrift));

            const sq1 = (this.phase1 < pwm1 ? 1.0 : -1.0)
                + polyBLEP(this.phase1, inc1)
                - polyBLEP((this.phase1 - pwm1 + 1.0) % 1.0, inc1);
            const saw1 = (this.phase1 * 2.0 - 1.0) - polyBLEP(this.phase1, inc1);

            const sq2 = (this.phase2 < pwm2 ? 1.0 : -1.0)
                + polyBLEP(this.phase2, inc2)
                - polyBLEP((this.phase2 - pwm2 + 1.0) % 1.0, inc2);
            const saw2 = (this.phase2 * 2.0 - 1.0) - polyBLEP(this.phase2, inc2);

            const isPureTri = hasTri && !hasSaw && !hasPulse;
            const sawWeight = hasSaw ? 0.72 : (hasTri ? 0.25 : 0.42);
            const sqWeight = hasPulse ? 0.65 : (hasTri ? 0.15 : 0.30);
            const wNorm = 1.0 / (sawWeight + sqWeight);

            // Bewahrt den samtigen Flöten-/Okarina-Charakter reiner SID-Dreieckswellen ($11)
            const harmonicScale = isPureTri ? 0.36 : 1.0;

            const rank1 = (saw1 * sawWeight + sq1 * sqWeight) * wNorm;
            const rank2 = (saw2 * sawWeight + sq2 * sqWeight) * wNorm;

            vcfIn = (rank1 * 0.54 + rank2 * 0.46) * harmonicScale * (1.0 - stageSub * 0.32) * nyquistGain;
            const triBody = hasTri ? 0.25 : 0.0;
            postFilterSine = Math.sin(this.phaseSub * TWO_PI) * (0.14 + triBody + stageSub * 0.62) * nyquistGain;
        }

        const v = this.smoothVolt;
        const sweep = v * (0.80 + 0.20 * v);
        const drive = 1.0 + sweep * (0.50 + thermalDrift * 0.20);
        let sig = fastTanh(vcfIn * drive) / drive;

        const isPureSidHp = isFiltered && ((sidFilterMode & 0x70) === 0x40);
        const isSidLpOrBp = isFiltered && ((sidFilterMode & 0x30) !== 0);

        // 1. CS-80 12dB High-Pass Filter (folgt optional reinem SID-Hochpass-Routing)
        const hpSidBoost = isPureSidHp ? sidCutoffNorm * 1400.0 : 0.0;
        const hpCut = 26.0 + (1.0 - stageSub) * (36.0 + sweep * 78.0) + hpSidBoost;
        const hpRes = 0.15 + (1.0 - stageSub) * 0.14;
        this.hpf.step(sig, hpCut, hpRes, sr);
        sig = this.hpf.hp;

        // 2. CS-80 12dB Resonant Low-Pass Filter (ungefilterte Leads strahlen mit sidMod = 1.0!)
        const envMod = this.filterEnv * (1.0 - stageSub * 0.45);
        const sidMod = isSidLpOrBp ? (0.28 + 0.72 * sidCutoffNorm) : 1.0;
        const lpCut = (145.0 + sweep * (3800.0 - stageSub * 2600.0) + envMod * (3500.0 - stageSub * 2000.0)) * sidMod;
        const lpRes = Math.max(0.05, 0.28 + this.filterEnv * 0.14 - stageSub * 0.18);
        this.lpf.step(sig, lpCut, lpRes, sr);

        const voiceOut = this.lpf.lp + postFilterSine;
        return voiceOut * v * sidechainEnv * 0.19;
    }
}

// =========================================================
// HAUPT-WORKLET PROZESSOR
// =========================================================
class SIDBladeRunnerProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        const sr = (typeof sampleRate === 'number' && sampleRate > 0) ? sampleRate : 48000;
        this.sr = sr;
        this.clock = SID_CLOCK;

        this.sid = new SIDBladeRunnerChip();
        this.cpu = new CPU6502(this.sid);
        this.stager = new SIDDynamicStaging();
        this.stageSpeed = 1.0 - Math.exp(-44.1 / sr);

        this.voiceA = new CS80SidVoice(0, sr);
        this.voiceB = new CS80SidVoice(1, sr);
        this.voiceC = new CS80SidVoice(2, sr);

        this.resampler = new SidResampler(this.clock, sr, { channels: 2 });
        this.dcSidL = new DCBlocker(sr, 16.0);
        this.dcSidR = new DCBlocker(sr, 16.0);

        this.prgCode = null;
        this.loadAddr = 0;
        this.initAddress = 0;
        this.playAddress = 0;
        this.playSpeedCycles = 19656;
        this.songSpeedFlags = 0;

        this.isPlaying = false;
        this.wasPlaying = false;
        this.fadeVol = 0.0;
        this.fadeStep = 1.0 / Math.max(1, Math.round(0.004 * sr)); // 4ms knackfreie Rampe (bewahrt Frame-0-Drums)

        this.vblankTimer = 19656;
        this.currentFrame = 0;
        this.maxFrames = 7500;
        this.displayClockAccumulator = 0;
        this.hostPlayPending = false;
        this.temperature = 55.0;
        this.cpuCyclesRemaining = 0;

        this.thermalDrift = 0.6667;
        this.tapeDrive = 1.78;
        this.tapeBias = 0.185;
        this.tapeBiasComp = fastTanh(0.185);
        this.updateThermalCache();

        this.smoothMasterVol = 1.0;
        this.masterVolCoef = 1.0 - Math.exp(-1.0 / (0.0025 * sr));

        this.lfoVibrato = 0.0;
        this.lfoVibratoInc = 5.4 / sr;

        // Intelligenter $D418-Onset-Transienten-Detektor (verhindert 48Hz-Dauerton bei Speech/Samples)
        this.digiFastEnv = 0.0;
        this.digiSlowEnv = 0.0;
        this.digiFastRel = Math.exp(-1.0 / (0.012 * sr));
        this.digiSlowAtk = 1.0 - Math.exp(-1.0 / (0.022 * sr));
        this.digiSlowRel = Math.exp(-1.0 / (0.110 * sr));
        this.drumHoldoffMax = Math.round(0.095 * sr);
        this.drumHoldoffSamples = 0;

        this.drumTransientEnv = 0.0;
        this.drumTransientDecay = Math.exp(-1.0 / (0.080 * sr));
        this.drumPitchEnv = 0.0;
        this.drumPitchDecay = Math.exp(-1.0 / (0.028 * sr));
        this.drumSubPhase = 0.0;
        this.sidechainEnv = 1.0;
        this.sidechainRec = 1.0 - Math.exp(-1.0 / (0.014 * sr));

        // TRUE-STEREO DIMENSION-D BBD CHORUS (100% monokompatibel)
        this.chorusSize = nextPow2(Math.ceil(sr * 0.04));
        this.chorusMask = this.chorusSize - 1;
        this.chorusBufL = new Float32Array(this.chorusSize);
        this.chorusBufR = new Float32Array(this.chorusSize);
        this.chorusIdx = 0;
        this.chorusLfo = 0.0;
        this.chorusLfoInc = 0.48 / sr;
        this.chorusLpL = 0.0;
        this.chorusLpR = 0.0;
        this.chorusLpCoef = 1.0 - Math.exp(-TWO_PI * 6400.0 / sr);

        // TAPE MULTI-TAP PING-PONG DELAY
        this.delaySize = nextPow2(Math.ceil(sr * 0.85));
        this.delayMask = this.delaySize - 1;
        this.delayBufL = new Float32Array(this.delaySize);
        this.delayBufR = new Float32Array(this.delaySize);
        this.delayIdx = 0;
        this.delayTime = Math.floor(sr * 0.375);
        this.delayTap2 = Math.floor(this.delayTime * 1.333);
        this.delayTap3 = Math.floor(this.delayTime * 1.71);
        this.delayFlutterPhase = 0.0;
        this.delayFlutterInc = 0.88 / sr;

        this.delayLpL = 0.0; this.delayLpR = 0.0;
        this.delayHpL = 0.0; this.delayHpR = 0.0;
        this.delayHpPrevL = 0.0; this.delayHpPrevR = 0.0;
        this.delayLpCoef = 1.0 - Math.exp(-TWO_PI * 3100.0 / sr);
        this.delayHpAlpha = Math.exp(-TWO_PI * 140.0 / sr);

        // LEXICON 224 CONCERT HALL: 19ms PRE-DELAY + 2x ALLPASS + 4x PRIME QUAD-MOD FDN
        this.preDelayLen = Math.max(16, Math.round(0.019 * sr));
        this.preDelayBufL = new Float32Array(this.preDelayLen);
        this.preDelayBufR = new Float32Array(this.preDelayLen);
        this.preDelayIdx = 0;

        this.ap1LenL = nextPrime(Math.max(17, Math.round(0.0047 * sr)));
        this.ap1LenR = nextPrime(Math.max(19, Math.round(0.0053 * sr)));
        this.ap2LenL = nextPrime(Math.max(23, Math.round(0.0111 * sr)));
        this.ap2LenR = nextPrime(Math.max(29, Math.round(0.0123 * sr)));
        this.ap1BufL = new Float32Array(this.ap1LenL);
        this.ap1BufR = new Float32Array(this.ap1LenR);
        this.ap2BufL = new Float32Array(this.ap2LenL);
        this.ap2BufR = new Float32Array(this.ap2LenR);
        this.ap1IdxL = 0; this.ap1IdxR = 0;
        this.ap2IdxL = 0; this.ap2IdxR = 0;

        this.fdnModPhase0 = 0.0;
        this.fdnModPhase1 = 0.25;
        this.fdnModInc0 = 0.37 / sr;
        this.fdnModInc1 = 0.53 / sr;
        this.fdnModDepth = 0.00035 * sr;
        this.fdnModMargin = Math.ceil(this.fdnModDepth) + 4;

        // Primzahl-Basisverzögerungen garantieren teilerfremde Raummoden bei jeder Sample-Rate
        this.fdnBaseDelays = [
            nextPrime(Math.max(67, Math.round(0.0317 * sr))),
            nextPrime(Math.max(71, Math.round(0.0473 * sr))),
            nextPrime(Math.max(73, Math.round(0.0683 * sr))),
            nextPrime(Math.max(79, Math.round(0.0919 * sr)))
        ];
        this.fdnLens = [
            this.fdnBaseDelays[0] + this.fdnModMargin,
            this.fdnBaseDelays[1] + this.fdnModMargin,
            this.fdnBaseDelays[2] + this.fdnModMargin,
            this.fdnBaseDelays[3] + this.fdnModMargin
        ];
        this.fdnBufs = [
            new Float32Array(this.fdnLens[0]),
            new Float32Array(this.fdnLens[1]),
            new Float32Array(this.fdnLens[2]),
            new Float32Array(this.fdnLens[3])
        ];
        this.fdnIdx = new Int32Array(4);
        this.fdnDampLp = new Float32Array(4);
        this.fdnDampHp = new Float32Array(4);
        this.fdnHpPrev = new Float32Array(4);
        this.fdnLpCoef = 1.0 - Math.exp(-TWO_PI * 4500.0 / sr);
        this.fdnHpAlpha = Math.exp(-TWO_PI * 95.0 / sr);

        this.dcBlockOutL = new DCBlocker(sr, 18.0);
        this.dcBlockOutR = new DCBlocker(sr, 18.0);

        // Ausbalancierte Studio-Makros für C64 SID
        this.cs80Mix = 0.92;
        this.chorusMix = 0.20;
        this.delayMix = 0.34;
        this.reverbMix = 0.32;

        this.visualView = new Float32Array(41);
        this.visCounter = 0;
        this.visSamplesAccum = 0;
        this.wasAudible = false;
        this.lastVisD418Writes = 0;
        this.lastVisRegisterWrites = 0;

        this.port.onmessage = (e) => {
            const msg = e.data;
            if (msg.type === 'SET_TEMPERATURE') {
                this.temperature = Math.min(75, Math.max(15, msg.value));
                this.sid.temperature = this.temperature;
                this.sid.updateFilterParameters();
                this.updateThermalCache();
                return;
            }
            if (msg.type === 'SET_PARAMS') {
                if (typeof msg.cs80Mix === 'number') this.cs80Mix = Math.max(0.0, Math.min(1.5, msg.cs80Mix));
                if (typeof msg.reverbMix === 'number') this.reverbMix = Math.max(0.0, Math.min(0.8, msg.reverbMix));
                if (typeof msg.delayMix === 'number') this.delayMix = Math.max(0.0, Math.min(0.8, msg.delayMix));
                if (typeof msg.chorusMix === 'number') this.chorusMix = Math.max(0.0, Math.min(0.6, msg.chorusMix));
                return;
            }

            if (msg.isSidFile) {
                this.prgCode = msg.c64Code;
                this.loadAddr = msg.loadAddress;
                this.initAddress = msg.initAddress;
                this.playAddress = msg.playAddress;
                this.songSpeedFlags = msg.speed;

                this.sid.temperature = this.temperature;
                this.sid.reset();
                this.cpu = new CPU6502(this.sid);

                this.resetFxAndVoices(true);
                this.runSubsongInit(msg.startSong > 0 ? msg.startSong - 1 : 0, msg.length || 7500);
                this.fadeVol = 0.0;
                this.isPlaying = true;
            } else if (msg.type === 'STOP_TRACK') {
                this.isPlaying = false;
            } else if (msg.type === 'RESUME_TRACK') {
                this.isPlaying = !!this.prgCode;
            } else if (msg.type === 'CHANGE_SUBSONG') {
                if (!this.prgCode) return;
                this.sid.temperature = this.temperature;
                this.sid.reset();
                this.cpu.sid = this.sid;

                this.resetFxAndVoices(true);
                this.runSubsongInit(msg.frame > 0 ? msg.frame - 1 : 0, msg.length || 7500);
                this.fadeVol = 0.0;
            }
        };
    }

    updateThermalCache() {
        this.thermalDrift = (this.temperature - 15.0) / 60.0;
        this.tapeDrive = 1.62 + this.thermalDrift * 0.24;
        this.tapeBias = 0.165 + this.thermalDrift * 0.030;
        this.tapeBiasComp = fastTanh(this.tapeBias);
    }

    resetFxAndVoices(clearSpace) {
        this.stager.reset();
        this.voiceA.reset(clearSpace);
        this.voiceB.reset(clearSpace);
        this.voiceC.reset(clearSpace);
        this.smoothMasterVol = 1.0;

        this.digiFastEnv = 0.0;
        this.digiSlowEnv = 0.0;
        this.drumHoldoffSamples = 0;
        this.drumTransientEnv = 0.0;
        this.drumPitchEnv = 0.0;
        this.drumSubPhase = 0.0;
        this.sidechainEnv = 1.0;

        this.lastVisD418Writes = 0;
        this.lastVisRegisterWrites = 0;

        if (clearSpace) {
            this.dcSidL.lastIn = 0; this.dcSidL.lastOut = 0;
            this.dcSidR.lastIn = 0; this.dcSidR.lastOut = 0;
            this.dcBlockOutL.lastIn = 0; this.dcBlockOutL.lastOut = 0;
            this.dcBlockOutR.lastIn = 0; this.dcBlockOutR.lastOut = 0;

            this.chorusBufL.fill(0); this.chorusBufR.fill(0);
            this.chorusIdx = 0;
            this.chorusLpL = 0.0; this.chorusLpR = 0.0;

            this.delayBufL.fill(0); this.delayBufR.fill(0);
            this.delayIdx = 0;
            this.delayLpL = 0.0; this.delayLpR = 0.0;
            this.delayHpL = 0.0; this.delayHpR = 0.0;
            this.delayHpPrevL = 0.0; this.delayHpPrevR = 0.0;

            this.preDelayBufL.fill(0); this.preDelayBufR.fill(0);
            this.preDelayIdx = 0;

            this.ap1BufL.fill(0); this.ap1BufR.fill(0);
            this.ap2BufL.fill(0); this.ap2BufR.fill(0);
            this.ap1IdxL = 0; this.ap1IdxR = 0;
            this.ap2IdxL = 0; this.ap2IdxR = 0;

            for (let c = 0; c < 4; c++) this.fdnBufs[c].fill(0);
            this.fdnIdx.fill(0);
            this.fdnDampLp.fill(0);
            this.fdnDampHp.fill(0);
            this.fdnHpPrev.fill(0);
        }
    }

    runSubsongInit(songIndex, maxFrames) {
        songIndex &= 0xFF;
        this.cpu.reset(this.loadAddr, this.prgCode, this.initAddress, this.playAddress);

        this.cpu.a = songIndex;
        this.cpu.x = songIndex;
        this.cpu.y = 0;

        this.cpu.push(0xFF);
        this.cpu.push(0xDF);
        this.cpu.pc = this.initAddress;
        this.cpuCyclesRemaining = 0;

        let initSafety = 250000;
        while ((this.cpu.pc < 0xFFE0 || this.cpu.pc > 0xFFE3) && initSafety > 0) {
            initSafety--;
            this.cpu.clockHardware(1);
            this.sid.clock();

            if (this.cpuCyclesRemaining === 2) this.cpu.pollInterrupts();

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
                    this.cpuCyclesRemaining = this.cpu.beginInstruction();
                }
            } else if (this.cpu.canAdvanceCycle(this.cpuCyclesRemaining)) {
                this.cpuCyclesRemaining = this.cpu.advanceCycle(this.cpuCyclesRemaining);
            }
        }

        if ((this.cpu.pc >= 0xFFE0 && this.cpu.pc <= 0xFFE3) || this.cpu.pc === 0x0000) {
            this.cpu.pc = 0xFFE0;
            this.cpu.p &= ~0x04;
        }

        this.useCiaTimer = ((this.songSpeedFlags >> Math.min(31, songIndex)) & 1) !== 0;
        if (this.useCiaTimer) this.cpu.cia1CtrlA |= 0x01;

        this.playSpeedCycles = 19656;
        this.vblankTimer = this.playSpeedCycles;

        // Bereinigt Init-Artefakte ($D418-Clear-Loops, DC-Sprung & Telemetrie-Spitzen)
        this.sid.dcBaseline = MASTER_DC_BIAS * this.sid.masterVol;
        this.sid.digiDensity = 0;
        this.sid.digiPeakDelta = 0.0;
        this.sid.d418Writes = 0;
        this.sid.registerWrites = 0;
        this.smoothMasterVol = this.sid.masterVol;
        for (let v = 0; v < 3; v++) {
            this.sid.voices[v].settleTimer = 0;
            this.sid.voices[v].settleMax = 0;
        }

        this.resampler.reset();
        this.currentFrame = 0;
        this.displayClockAccumulator = 0;
        this.maxFrames = (Number.isFinite(maxFrames) && maxFrames > 0) ? maxFrames : 7500;
        this.hostPlayPending = false;
    }

    readDelayLinear(buf, mask, writeIdx, delaySamples) {
        const dInt = Math.floor(delaySamples);
        const frac = delaySamples - dInt;
        const idx0 = (writeIdx - dInt) & mask;
        const idx1 = (idx0 - 1) & mask;
        return buf[idx0] + (buf[idx1] - buf[idx0]) * frac;
    }

    readFdnModLinear(buf, len, writeIdx, baseOffset, modValue) {
        const dOff = baseOffset - modValue;
        const dInt = Math.floor(dOff);
        const frac = dOff - dInt;
        let rA = writeIdx - dInt;
        if (rA < 0) rA += len;
        let rB = rA - 1;
        if (rB < 0) rB += len;
        return buf[rA] + (buf[rB] - buf[rA]) * frac;
    }

    process(inputs, outputs) {
        const outL = outputs[0][0];
        const outR = outputs[0].length > 1 ? outputs[0][1] : null;
        const sr = this.sr;
        const thermalDrift = this.thermalDrift;
        const tapeDrive = this.tapeDrive;
        const tapeBias = this.tapeBias;
        const tapeBiasComp = this.tapeBiasComp;
        const fdnFeedback = 0.412 + Math.min(0.5, this.reverbMix) * 0.064;
        const revScale = this.reverbMix * 1.239;

        let visualValue = 0.0;

        for (let i = 0; i < outL.length; i++) {
            if (this.isPlaying) this.fadeVol = Math.min(1.0, this.fadeVol + this.fadeStep);
            else this.fadeVol = Math.max(0.0, this.fadeVol - this.fadeStep);

            if (this.fadeVol === 0.0) {
                outL[i] = 0.0;
                if (outR) outR[i] = 0.0;
                continue;
            }

            // 1. 1MHz PAL Lockstep (6502 + SID + 50Hz UI-Framezähler)
            const cyclesToRun = this.resampler.beginSample();
            for (let c = 0; c < cyclesToRun; c++) {
                this.cpu.clockHardware(1);
                this.sid.clock();

                this.displayClockAccumulator += 50;
                if (this.displayClockAccumulator >= this.clock) {
                    this.displayClockAccumulator -= this.clock;
                    this.currentFrame = (this.currentFrame + 1) % this.maxFrames;
                }

                this.resampler.write(this.sid.outputSampleL, this.sid.outputSampleR);

                if (this.playAddress === 0) {
                    this.vblankTimer--;
                    if (this.vblankTimer <= 0) this.vblankTimer += this.playSpeedCycles;
                } else if (!this.useCiaTimer) {
                    this.vblankTimer--;
                    if (this.vblankTimer <= 0) {
                        this.vblankTimer += this.playSpeedCycles;
                        this.hostPlayPending = true;
                    }
                } else if (this.cpu.cia1TimerAUnderflowed) {
                    this.cpu.cia1TimerAUnderflowed = false;
                    this.hostPlayPending = true;
                }

                if (this.cpuCyclesRemaining === 2) this.cpu.pollInterrupts();

                if (this.cpu.canAdvanceCycle(this.cpuCyclesRemaining)) {
                    if (this.cpuCyclesRemaining <= 0) {
                        const inIdleStub = (this.cpu.pc >= 0xFFE0 && this.cpu.pc <= 0xFFE3);
                        const canInterruptForeground = !inIdleStub && ((this.cpu.p & 0x04) === 0) && (this.cpu.sp > 0x60);

                        if (this.hostPlayPending && inIdleStub) {
                            this.hostPlayPending = false;
                            this.cpu.sp = 0xFF;
                            this.cpu.push(0xFF);
                            this.cpu.push(0xDF);
                            this.cpu.p |= 0x04;
                            this.cpu.pc = this.playAddress;
                            this.cpuCyclesRemaining = 6 - 1;
                        } else if (this.hostPlayPending && canInterruptForeground) {
                            this.hostPlayPending = false;
                            this.cpu.push(this.cpu.pc >> 8);
                            this.cpu.push(this.cpu.pc & 0xFF);
                            this.cpu.push((this.cpu.p & 0xEF) | 0x20);
                            this.cpu.p |= 0x04;
                            this.cpu.pc = 0xFFD0;
                            this.cpuCyclesRemaining = 7 - 1;
                        } else if (this.cpu.nmiAccepted) {
                            this.cpu.nmiAccepted = false;
                            this.cpu.triggerHardwareNmi();
                            this.cpuCyclesRemaining = 7 - 1;
                        } else if (this.cpu.irqAccepted) {
                            this.cpu.irqAccepted = false;
                            this.cpu.triggerHardwareIrq();
                            this.cpuCyclesRemaining = 7 - 1;
                        } else {
                            this.cpuCyclesRemaining = this.cpu.beginInstruction();
                        }
                    } else {
                        this.cpuCyclesRemaining = this.cpu.advanceCycle(this.cpuCyclesRemaining);
                    }
                }
            }

            // 2. Stereo SID Ausgang + DC-Blocker
            this.resampler.processStereo();
            const sidL = this.dcSidL.process(this.resampler.outputL) * 0.52;
            const sidR = this.dcSidR.process(this.resampler.outputR) * 0.52;

            // 3. $D418 Onset-Transienten-Detektor -> Pitch-Kick (74Hz -> 45Hz) & Sidechain
            const rawDigi = Math.min(1.0, this.sid.digiPeakDelta * 1.4);
            this.sid.digiPeakDelta = 0.0;

            if (rawDigi > this.digiFastEnv) {
                this.digiFastEnv += (rawDigi - this.digiFastEnv) * 0.55;
            } else {
                this.digiFastEnv *= this.digiFastRel;
            }

            if (this.digiFastEnv > this.digiSlowEnv) {
                this.digiSlowEnv += (this.digiFastEnv - this.digiSlowEnv) * this.digiSlowAtk;
            } else {
                this.digiSlowEnv *= this.digiSlowRel;
            }

            if (this.drumHoldoffSamples > 0) this.drumHoldoffSamples--;

            const digiOnset = this.digiFastEnv - this.digiSlowEnv * 1.25;
            if (digiOnset > 0.24 && this.drumHoldoffSamples === 0) {
                const hitStrength = Math.min(1.0, digiOnset * 1.8);
                this.drumTransientEnv = Math.max(this.drumTransientEnv, hitStrength);
                this.drumPitchEnv = 1.0;
                this.sidechainEnv = Math.min(this.sidechainEnv, 1.0 - hitStrength * 0.35);
                this.drumHoldoffSamples = this.drumHoldoffMax;
                this.digiSlowEnv = Math.max(this.digiSlowEnv, this.digiFastEnv * 0.85);
            }
            this.sidechainEnv += (1.0 - this.sidechainEnv) * this.sidechainRec;

            let subKick = 0.0;
            if (this.drumTransientEnv > 0.001) {
                const kickHz = 45.0 + this.drumPitchEnv * 29.0;
                this.drumSubPhase = (this.drumSubPhase + kickHz / sr) % 1.0;
                subKick = Math.sin(this.drumSubPhase * TWO_PI) * this.drumTransientEnv * 0.14;
                this.drumTransientEnv *= this.drumTransientDecay;
                this.drumPitchEnv *= this.drumPitchDecay;
            } else {
                this.drumTransientEnv = 0.0;
                this.drumPitchEnv = 0.0;
            }

            // 4. CS-80 3-Voice Analog Layer + Dynamisches Stereo-Staging
            this.smoothMasterVol += (this.sid.masterVol - this.smoothMasterVol) * this.masterVolCoef;
            this.stager.update(this.sid, this.stageSpeed);

            const stageA = this.stager.voices[0];
            const stageB = this.stager.voices[1];
            const stageC = this.stager.voices[2];

            this.lfoVibrato += this.lfoVibratoInc;
            if (this.lfoVibrato >= 1.0) this.lfoVibrato -= 1.0;
            const vibSin = Math.sin(this.lfoVibrato * TWO_PI);

            const filtRouting = this.sid.regs[23];
            const sidFilterMode = this.sid.regs[24];
            const v3Off = ((sidFilterMode & 0x80) !== 0) && ((filtRouting & 4) === 0);
            const sidCutoffNorm = ((this.sid.regs[21] & 7) | (this.sid.regs[22] << 3)) / 2047.0;

            const sigA = this.voiceA.process(
                this.sid.voices[0], false, (filtRouting & 1) !== 0, sidFilterMode,
                sidCutoffNorm, stageA.sub, this.smoothMasterVol, this.sidechainEnv, vibSin, thermalDrift
            ) * this.cs80Mix;

            const sigB = this.voiceB.process(
                this.sid.voices[1], false, (filtRouting & 2) !== 0, sidFilterMode,
                sidCutoffNorm, stageB.sub, this.smoothMasterVol, this.sidechainEnv, vibSin, thermalDrift
            ) * this.cs80Mix;

            const sigC = this.voiceC.process(
                this.sid.voices[2], v3Off, (filtRouting & 4) !== 0, sidFilterMode,
                sidCutoffNorm, stageC.sub, this.smoothMasterVol, this.sidechainEnv, vibSin, thermalDrift
            ) * this.cs80Mix;

            const epL_A = fastSinHalfPi(1.0 - stageA.pan), epR_A = fastSinHalfPi(stageA.pan);
            const epL_B = fastSinHalfPi(1.0 - stageB.pan), epR_B = fastSinHalfPi(stageB.pan);
            const epL_C = fastSinHalfPi(1.0 - stageC.pan), epR_C = fastSinHalfPi(stageC.pan);

            const dryL = sidL + sigA * epL_A + sigB * epL_B + sigC * epL_C + subKick;
            const dryR = sidR + sigA * epR_A + sigB * epR_B + sigC * epR_C + subKick;

            // 5. True-Stereo Dimension-D BBD Chorus (Bässe bleiben sauber ausgespart!)
            const chInL = sidL * 0.35 + sigA * epL_A * (1.0 - stageA.sub) + sigB * epL_B * (1.0 - stageB.sub) + sigC * epL_C * (1.0 - stageC.sub);
            const chInR = sidR * 0.35 + sigA * epR_A * (1.0 - stageA.sub) + sigB * epR_B * (1.0 - stageB.sub) + sigC * epR_C * (1.0 - stageC.sub);
            this.chorusBufL[this.chorusIdx] = chInL;
            this.chorusBufR[this.chorusIdx] = chInR;

            this.chorusLfo += this.chorusLfoInc;
            if (this.chorusLfo >= 1.0) this.chorusLfo -= 1.0;
            const cSin = Math.sin(this.chorusLfo * TWO_PI);
            const cModL = (0.0098 + cSin * 0.0024) * sr;
            const cModR = (0.0106 - cSin * 0.0024) * sr;

            const cTapL = this.readDelayLinear(this.chorusBufL, this.chorusMask, this.chorusIdx, cModL);
            const cTapR = this.readDelayLinear(this.chorusBufR, this.chorusMask, this.chorusIdx, cModR);
            this.chorusLpL += this.chorusLpCoef * (cTapL - this.chorusLpL);
            this.chorusLpR += this.chorusLpCoef * (cTapR - this.chorusLpR);
            this.chorusIdx = (this.chorusIdx + 1) & this.chorusMask;

            const dimWetL = this.chorusLpL - this.chorusLpR * 0.25;
            const dimWetR = this.chorusLpR - this.chorusLpL * 0.25;

            // 6. Space Send -> Tape Multi-Tap Delay -> 19ms Pre-Delay -> Lexicon 224 FDN
            const sendL = sidL * 0.32
                + sigA * epL_A * stageA.rev
                + sigB * epL_B * stageB.rev
                + sigC * epL_C * stageC.rev
                + dimWetL * 0.14;

            const sendR = sidR * 0.32
                + sigA * epR_A * stageA.rev
                + sigB * epR_B * stageB.rev
                + sigC * epR_C * stageC.rev
                + dimWetR * 0.14;

            this.delayFlutterPhase += this.delayFlutterInc;
            if (this.delayFlutterPhase >= 1.0) this.delayFlutterPhase -= 1.0;
            const flutterSmp = Math.sin(this.delayFlutterPhase * TWO_PI) * (0.00042 * sr);

            const tap1L = this.readDelayLinear(this.delayBufL, this.delayMask, this.delayIdx, this.delayTime + flutterSmp);
            const tap2R = this.readDelayLinear(this.delayBufR, this.delayMask, this.delayIdx, this.delayTap2 - flutterSmp);
            const tap3L = this.readDelayLinear(this.delayBufL, this.delayMask, this.delayIdx, this.delayTap3 + flutterSmp * 0.5);
            const tap3R = this.readDelayLinear(this.delayBufR, this.delayMask, this.delayIdx, this.delayTap3 - flutterSmp * 0.5);

            const rawDelL = (tap1L + tap3R) * 0.5;
            const rawDelR = (tap2R + tap3L) * 0.5;

            this.delayLpL += this.delayLpCoef * (rawDelL - this.delayLpL);
            this.delayLpR += this.delayLpCoef * (rawDelR - this.delayLpR);

            this.delayHpL = this.delayHpAlpha * (this.delayHpL + this.delayLpL - this.delayHpPrevL);
            this.delayHpPrevL = this.delayLpL;
            this.delayHpR = this.delayHpAlpha * (this.delayHpR + this.delayLpR - this.delayHpPrevR);
            this.delayHpPrevR = this.delayLpR;

            this.delayBufL[this.delayIdx] = fastTanh(sendR * 0.45 + this.delayHpL * 0.48);
            this.delayBufR[this.delayIdx] = fastTanh(sendL * 0.45 + this.delayHpR * 0.48);
            this.delayIdx = (this.delayIdx + 1) & this.delayMask;

            // 19ms Lexicon Pre-Delay
            const preInL = sendL * 0.55 + this.delayHpL * 0.28;
            const preInR = sendR * 0.55 + this.delayHpR * 0.28;
            let diffL = this.preDelayBufL[this.preDelayIdx];
            let diffR = this.preDelayBufR[this.preDelayIdx];
            this.preDelayBufL[this.preDelayIdx] = preInL;
            this.preDelayBufR[this.preDelayIdx] = preInR;
            if (++this.preDelayIdx >= this.preDelayLen) this.preDelayIdx = 0;

            const ap1OutL = this.ap1BufL[this.ap1IdxL];
            const ap1InL = diffL + ap1OutL * 0.5;
            this.ap1BufL[this.ap1IdxL] = ap1InL;
            diffL = ap1OutL - ap1InL * 0.5;
            if (++this.ap1IdxL >= this.ap1LenL) this.ap1IdxL = 0;

            const ap1OutR = this.ap1BufR[this.ap1IdxR];
            const ap1InR = diffR + ap1OutR * 0.5;
            this.ap1BufR[this.ap1IdxR] = ap1InR;
            diffR = ap1OutR - ap1InR * 0.5;
            if (++this.ap1IdxR >= this.ap1LenR) this.ap1IdxR = 0;

            const ap2OutL = this.ap2BufL[this.ap2IdxL];
            const ap2InL = diffL + ap2OutL * 0.45;
            this.ap2BufL[this.ap2IdxL] = ap2InL;
            diffL = ap2OutL - ap2InL * 0.45;
            if (++this.ap2IdxL >= this.ap2LenL) this.ap2IdxL = 0;

            const ap2OutR = this.ap2BufR[this.ap2IdxR];
            const ap2InR = diffR + ap2OutR * 0.45;
            this.ap2BufR[this.ap2IdxR] = ap2InR;
            diffR = ap2OutR - ap2InR * 0.45;
            if (++this.ap2IdxR >= this.ap2LenR) this.ap2IdxR = 0;

            // 4x Quadrature-Modulated Hadamard FDN (Primzahl-Verzögerungen)
            this.fdnModPhase0 += this.fdnModInc0;
            if (this.fdnModPhase0 >= 1.0) this.fdnModPhase0 -= 1.0;
            this.fdnModPhase1 += this.fdnModInc1;
            if (this.fdnModPhase1 >= 1.0) this.fdnModPhase1 -= 1.0;

            const modA = Math.sin(this.fdnModPhase0 * TWO_PI) * this.fdnModDepth;
            const modB = Math.cos(this.fdnModPhase1 * TWO_PI) * this.fdnModDepth;

            const len0 = this.fdnLens[0], idx0 = this.fdnIdx[0], buf0 = this.fdnBufs[0];
            const len1 = this.fdnLens[1], idx1 = this.fdnIdx[1], buf1 = this.fdnBufs[1];
            const len2 = this.fdnLens[2], idx2 = this.fdnIdx[2], buf2 = this.fdnBufs[2];
            const len3 = this.fdnLens[3], idx3 = this.fdnIdx[3], buf3 = this.fdnBufs[3];

            const y0 = this.readFdnModLinear(buf0, len0, idx0, this.fdnBaseDelays[0], modA);
            const y1 = this.readFdnModLinear(buf1, len1, idx1, this.fdnBaseDelays[1], -modA * 0.85);
            const y2 = this.readFdnModLinear(buf2, len2, idx2, this.fdnBaseDelays[2], modB);
            const y3 = this.readFdnModLinear(buf3, len3, idx3, this.fdnBaseDelays[3], -modB * 0.85);

            const s0 = y0 + y1, s1 = y0 - y1;
            const s2 = y2 + y3, s3 = y2 - y3;
            const m0 = (s0 + s2) * fdnFeedback;
            const m1 = (s1 + s3) * fdnFeedback;
            const m2 = (s0 - s2) * fdnFeedback;
            const m3 = (s1 - s3) * fdnFeedback;

            const in0 = m0 + diffL, in1 = m1 + diffR, in2 = m2 + diffL, in3 = m3 - diffR;

            this.fdnDampLp[0] += this.fdnLpCoef * (in0 - this.fdnDampLp[0]);
            this.fdnDampHp[0] = this.fdnHpAlpha * (this.fdnDampHp[0] + this.fdnDampLp[0] - this.fdnHpPrev[0]);
            this.fdnHpPrev[0] = this.fdnDampLp[0];
            buf0[idx0] = this.fdnDampHp[0];
            if (++this.fdnIdx[0] >= len0) this.fdnIdx[0] = 0;

            this.fdnDampLp[1] += this.fdnLpCoef * (in1 - this.fdnDampLp[1]);
            this.fdnDampHp[1] = this.fdnHpAlpha * (this.fdnDampHp[1] + this.fdnDampLp[1] - this.fdnHpPrev[1]);
            this.fdnHpPrev[1] = this.fdnDampLp[1];
            buf1[idx1] = this.fdnDampHp[1];
            if (++this.fdnIdx[1] >= len1) this.fdnIdx[1] = 0;

            this.fdnDampLp[2] += this.fdnLpCoef * (in2 - this.fdnDampLp[2]);
            this.fdnDampHp[2] = this.fdnHpAlpha * (this.fdnDampHp[2] + this.fdnDampLp[2] - this.fdnHpPrev[2]);
            this.fdnHpPrev[2] = this.fdnDampLp[2];
            buf2[idx2] = this.fdnDampHp[2];
            if (++this.fdnIdx[2] >= len2) this.fdnIdx[2] = 0;

            this.fdnDampLp[3] += this.fdnLpCoef * (in3 - this.fdnDampLp[3]);
            this.fdnDampHp[3] = this.fdnHpAlpha * (this.fdnDampHp[3] + this.fdnDampLp[3] - this.fdnHpPrev[3]);
            this.fdnHpPrev[3] = this.fdnDampLp[3];
            buf3[idx3] = this.fdnDampHp[3];
            if (++this.fdnIdx[3] >= len3) this.fdnIdx[3] = 0;

            // Orthogonale Stereo-Auskopplung (cL · cR = 0) OHNE Auslöschung von Linien in Mono!
            const revWetL = (y0 + 0.55 * y1 + 0.55 * y2 - y3) * revScale;
            const revWetR = (0.55 * y0 - y1 + y2 + 0.55 * y3) * revScale;

            // 7. Master-Summe + C-unendlich-glatte asymmetrische Tape-Sättigung + DC-Blocker
            let finalL = dryL + dimWetL * this.chorusMix + this.delayHpL * this.delayMix + revWetL;
            let finalR = dryR + dimWetR * this.chorusMix + this.delayHpR * this.delayMix + revWetR;

            if (!Number.isFinite(finalL)) finalL = 0.0;
            if (!Number.isFinite(finalR)) finalR = 0.0;

            finalL = fastTanh(finalL * tapeDrive - tapeBias) + tapeBiasComp;
            finalR = fastTanh(finalR * tapeDrive - tapeBias) + tapeBiasComp;

            const outSampleL = this.dcBlockOutL.process(finalL * 0.76) * this.fadeVol;
            const outSampleR = this.dcBlockOutR.process(finalR * 0.76) * this.fadeVol;

            if (outR) {
                outL[i] = outSampleL;
                outR[i] = outSampleR;
            } else {
                outL[i] = (outSampleL + outSampleR) * 0.5;
            }

            const mono = (outSampleL + outSampleR) * 0.5;
            if (Math.abs(mono) >= Math.abs(visualValue)) {
                visualValue = mono;
            }
        }

        // 8. Telemetrie & Living-Silicon-Ausgabe (100% kompatibel zu sid-exact/sid-fantasy)
        this.visSamplesAccum += outL.length;
        this.visCounter++;
        if (this.visCounter % 4 === 0) {
            const isAudible = Math.abs(visualValue) > 0.001;
            if (this.isPlaying || this.wasPlaying || isAudible || this.wasAudible) {
                const view = this.visualView;
                view[0] = 0; // C64
                view[1] = this.isPlaying ? 1 : 0;
                view[2] = this.currentFrame;
                view[3] = visualValue;

                for (let r = 0; r < 29; r++) view[4 + r] = this.sid.regs[r];
                const deltaDigi = Math.max(0, this.sid.d418Writes - this.lastVisD418Writes);
                this.lastVisD418Writes = this.sid.d418Writes;
                view[4 + 25] = Math.min(255, deltaDigi);
                view[4 + 26] = this.cpu.psidSampleActive ? 1 : 0;
                view[4 + 27] = Math.floor(this.sid.voices[2].waveOut8Bit) & 0xFF;
                view[4 + 28] = Math.floor(this.sid.voices[2].env8Bit) & 0xFF;
                view[33] = this.temperature;
                for (let v = 0; v < 3; v++) view[34 + v] = this.sid.voices[v].envelope_counter / 255.0;

                const writeTotal = this.sid.registerWrites;
                const deltaWrites = writeTotal >= this.lastVisRegisterWrites
                    ? writeTotal - this.lastVisRegisterWrites
                    : writeTotal;
                this.lastVisRegisterWrites = writeTotal;
                const packetDurationSec = this.visSamplesAccum / sr;
                view[37] = packetDurationSec > 0 ? (deltaWrites / packetDurationSec) : 0;
                for (let v = 0; v < 3; v++) view[38 + v] = this.sid.voices[v].state;

                this.port.postMessage(view);
            }
            this.visSamplesAccum = 0;
            this.wasAudible = isAudible;
            this.wasPlaying = this.isPlaying;
        }
        return true;
    }
}

registerProcessor('sid-bladerunner-processor', SIDBladeRunnerProcessor);