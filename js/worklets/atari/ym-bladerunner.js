// === js/worklets/atari/ym-bladerunner.js ===
// =========================================================
// YM2149F "BLADE RUNNER" CORE v2.5 (Director's Cut)
// Authentic CS-80 Signal Path + YM6 Timer FX + Lexicon 224 FDN
// =========================================================

import {
    YM_DAC,
    polyBLEP,
    cubicInterpolate,
    DCBlocker,
    detectDigidrum,
    detectDigidrumVoice
} from '../lib/dsp-utils.js';
import { DynamicStaging } from '../lib/dynamic-staging.js';
import { YMVisualizer } from '../lib/ym-visualizer.js';

const TWO_PI = Math.PI * 2.0;
const MFP_CLOCK = 2457600.0;
const MFP_PREDIV = [0, 4, 10, 16, 50, 64, 100, 200];

function nextPow2(v) {
    let p = 1;
    while (p < v) p <<= 1;
    return p;
}

// Exakte, stufenfreie Equal-Power-Pan-Kurve sin(u * PI/2) auf [0..1] (< 0.001 dB Fehler, 0 Trig-Calls)
function fastSinHalfPi(u) {
    const x = u < 0.0 ? 0.0 : (u > 1.0 ? 1.0 : u);
    const x2 = x * x;
    return x * (1.5707963 - x2 * (0.6459641 - 0.0751678 * x2));
}

// =========================================================
// ZERO-DELAY FEEDBACK (TPT) SVF MIT ANALOGER RESONATOR-SÄTTIGUNG
// Schnelle Padé-[3/2]-Tan-Approximation + cremiges Self-Limiting
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

        // Padé [3/2] für tan(PI * fc / sr): extrem präzise & strikt positiv bis > 0.42 * sr
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
        // Sanfte kubische Sättigung im Bandpass-Integrator (echtes analoges Resonanz-Limiting)
        const u = this.ic1 > 2.5 ? 2.5 : (this.ic1 < -2.5 ? -2.5 : this.ic1);
        const ic1Sat = u - (u * u * u) * 0.035;

        const v3 = input - this.ic2;
        const v1 = this.a1 * ic1Sat + this.a2 * v3;
        const v2 = this.ic2 + this.a2 * ic1Sat + this.a3 * v3;

        this.ic1 = 2.0 * v1 - ic1Sat;
        this.ic2 = 2.0 * v2 - this.ic2;

        if (!Number.isFinite(this.ic1) || !Number.isFinite(this.ic2)) {
            this.ic1 = 0.0;
            this.ic2 = 0.0;
            this.lp = 0.0;
            this.bp = 0.0;
            this.hp = 0.0;
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
// YAMAHA CS-80 VOICE ENGINE
// Dual-Rank VCO -> Drive -> HPF -> LPF -> [+ Post-VCF Sine!] -> VCA
// =========================================================
class CS80Voice {
    constructor(voiceIdx, sr) {
        this.voiceIdx = voiceIdx;
        this.sr = sr;

        this.phase1 = (voiceIdx * 0.19) % 1.0;
        this.phase2 = (0.37 + voiceIdx * 0.23) % 1.0;
        this.sidPhase = 0.0;

        this.lfoPwm = (voiceIdx * 0.33) % 1.0;
        this.lfoPwmInc = (0.29 + voiceIdx * 0.08) / sr;
        this.lfoWow = (voiceIdx * 0.31) % 1.0;
        this.lfoWowInc = (0.14 + voiceIdx * 0.03) / sr;
        this.lfoFlut = (voiceIdx * 0.27) % 1.0;
        this.lfoFlutInc = (1.15 + voiceIdx * 0.17) / sr;

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
        this.prevPeriod = 0;
        this.prevVolRaw = 0;
        this.framesSinceNote = 100;
        this.arpAmount = 0.0;

        this.atkSlow = 1.0 - Math.exp(-1.0 / (0.040 * sr));
        this.atkFast = 1.0 - Math.exp(-1.0 / (0.0045 * sr));
        this.decRate = 1.0 - Math.exp(-1.0 / (0.520 * sr));
        this.bloomDec = Math.exp(-1.0 / (0.024 * sr));
        this.vibRise = 1.0 - Math.exp(-1.0 / (0.250 * sr));
        this.glideCoef = 1.0 - Math.exp(-1.0 / (0.009 * sr)); // ~9ms Legato-Ribbon-Glide

        this.vcaAtk = 1.0 - Math.exp(-1.0 / (0.0016 * sr));
        this.vcaRel = 1.0 - Math.exp(-1.0 / (0.0190 * sr));
    }

    reset(clearFilters = false) {
        this.smoothVolt = 0.0;
        this.filterEnv = 0.0;
        this.filterEnvAttack = false;
        this.pitchBloom = 0.0;
        this.vibratoGate = 0.0;
        this.currentInc = 0.0;
        this.useGlide = false;
        this.sidPhase = 0.0;
        this.prevActive = false;
        this.prevPeriod = 0;
        this.prevVolRaw = 0;
        this.framesSinceNote = 100;
        this.arpAmount = 0.0;
        if (clearFilters) {
            this.hpf.reset();
            this.lpf.reset();
        }
    }

    onFrame(period, toneOn, noiseOn, rawRegVol) {
        const envActive = (rawRegVol & 0x10) !== 0;
        const vol4 = rawRegVol & 0x0F;
        const isPureBuzzer = !toneOn && !noiseOn && envActive;
        const isActive = (toneOn || noiseOn || isPureBuzzer) && (envActive || vol4 > 0);

        let retrigger = false;
        let pitchJump = false;
        if (isActive) {
            if (!this.prevActive) {
                retrigger = true;
            } else if (period > 0 && this.prevPeriod > 0) {
                const relDiff = Math.abs(period - this.prevPeriod) / this.prevPeriod;
                if (relDiff > 0.035) {
                    retrigger = true;
                    pitchJump = true;
                }
            }
            if (!envActive && (vol4 - this.prevVolRaw) >= 3) {
                retrigger = true;
            }
        }

        if (retrigger) {
            if (this.framesSinceNote <= 5) {
                this.arpAmount = Math.min(1.0, this.arpAmount + 0.42);
            } else {
                this.arpAmount *= 0.40;
            }

            // Legato-Glide nur für gebundene Melodien innerhalb ~1 Oktave (nie bei Arps)
            if (pitchJump && this.prevActive && this.arpAmount < 0.35 && !isPureBuzzer) {
                const ratio = period / this.prevPeriod;
                this.useGlide = (ratio > 0.48 && ratio < 2.08);
            } else {
                this.useGlide = false;
            }

            this.framesSinceNote = 0;
            this.filterEnvAttack = true;
            if (this.arpAmount < 0.5 && !isPureBuzzer) {
                this.pitchBloom = this.useGlide ? 0.35 : 1.0;
                this.vibratoGate *= 0.30;
            }
        } else {
            if (this.framesSinceNote < 200) this.framesSinceNote++;
            if (this.framesSinceNote > 2) this.useGlide = false; // Tracker-Slides 1:1 folgen
            if (this.framesSinceNote > 6) this.arpAmount *= 0.85;
        }

        this.prevActive = isActive;
        this.prevPeriod = period;
        this.prevVolRaw = vol4;
    }

    process(clock, period, toneOn, noiseOn, rawRegVol, filteredNoise, envDAC, buzzerWave, envStoppedZero, sidInc, stageSub, sidechainEnv, vibSin) {
        const sr = this.sr;
        const envActive = (rawRegVol & 0x10) !== 0;
        const vol4 = rawRegVol & 0x0F;
        const isPureBuzzer = !toneOn && !noiseOn && envActive;

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

        // VCA Zielspannung (mit Fix für abgelaufene One-Shot-Buzzer!)
        let targetVolt;
        if (isPureBuzzer) {
            targetVolt = envStoppedZero ? 0.0 : 0.74;
        } else if (envActive) {
            targetVolt = envDAC;
        } else {
            targetVolt = YM_DAC[vol4];
        }

        if (envActive && !isPureBuzzer) {
            this.smoothVolt = targetVolt;
        } else {
            const vcaSpeed = targetVolt > this.smoothVolt ? this.vcaAtk : this.vcaRel;
            this.smoothVolt += (targetVolt - this.smoothVolt) * vcaSpeed;
        }

        // Oszillator-Frequenz + Legato-Glide + Analog-Drift
        const safePeriod = period === 0 ? 1 : period;
        const targetInc = (clock / (16.0 * safePeriod)) / sr;
        if (this.currentInc <= 0.0 || !this.useGlide || stageSub > 0.45) {
            this.currentInc = targetInc;
        } else {
            this.currentInc += (targetInc - this.currentInc) * this.glideCoef;
        }
        const incBase = this.currentInc;

        let nyquistGain = 1.0;
        if (incBase > 0.36) {
            nyquistGain = incBase >= 0.47 ? 0.0 : (0.47 - incBase) / 0.11;
        }

        const wow = Math.sin(this.lfoWow * TWO_PI) * 0.0032;
        const flutter = Math.sin(this.lfoFlut * TWO_PI) * 0.0010;
        const vibDepth = (0.00035 + this.smoothVolt * 0.0035) * this.vibratoGate * (1.0 - this.arpAmount * 0.85);
        const pitchMod = 1.0 + wow + flutter + vibSin * vibDepth - this.pitchBloom * 0.0070 * (1.0 - stageSub * 0.65);

        const detune = 1.0 + (0.00045 + (1.0 - stageSub) * 0.0023);
        const inc1 = incBase * pitchMod;
        const inc2 = inc1 * detune;

        this.phase1 = (this.phase1 + inc1) % 1.0;
        this.phase2 = (this.phase2 + inc2) % 1.0;

        let vcfIn = 0.0;
        let postFilterSine = 0.0;

        if (toneOn && nyquistGain > 0.0) {
            const pwmMod = Math.sin(this.lfoPwm * TWO_PI) * 0.23;
            const pwm1 = 0.5 + pwmMod;
            const pwm2 = 0.5 - pwmMod;

            const sq1 = (this.phase1 < pwm1 ? 1.0 : -1.0)
                + polyBLEP(this.phase1, inc1)
                - polyBLEP((this.phase1 - pwm1 + 1.0) % 1.0, inc1);
            const saw1 = (this.phase1 * 2.0 - 1.0) - polyBLEP(this.phase1, inc1);
            const rank1 = sq1 * 0.32 + saw1 * 0.68;

            const sq2 = (this.phase2 < pwm2 ? 1.0 : -1.0)
                + polyBLEP(this.phase2, inc2)
                - polyBLEP((this.phase2 - pwm2 + 1.0) % 1.0, inc2);
            const saw2 = (this.phase2 * 2.0 - 1.0) - polyBLEP(this.phase2, inc2);
            const rank2 = sq2 * 0.32 + saw2 * 0.68;

            vcfIn = (rank1 * 0.54 + rank2 * 0.46) * (1.0 - stageSub * 0.30) * nyquistGain;

            // Echter CS-80 Signalweg: Reiner Sinus wird NACH HPF/LPF beigemischt!
            postFilterSine = Math.sin(this.phase1 * TWO_PI) * (0.15 + stageSub * 0.62) * nyquistGain;
        }

        if (noiseOn) {
            vcfIn += filteredNoise;
        }

        if (isPureBuzzer) {
            vcfIn = buzzerWave;
        } else if (!toneOn && !noiseOn && vol4 > 0) {
            vcfIn = 0.32;
        }

        // Optionaler YM6 Atari SID-Voice Ring/Gate-Modulator (bandlimitiert!)
        if (sidInc > 0.0) {
            this.sidPhase = (this.sidPhase + sidInc) % 1.0;
            if (sidInc < 0.45) {
                const sidSq = (this.sidPhase < 0.5 ? 1.0 : -1.0)
                    + polyBLEP(this.sidPhase, sidInc)
                    - polyBLEP((this.sidPhase + 0.5) % 1.0, sidInc);
                vcfIn *= (0.52 + 0.48 * sidSq);
                postFilterSine *= (0.55 + 0.45 * sidSq);
            }
        }

        // Schnelle Polynom-Kurve statt Math.pow(smoothVolt, 1.15)
        const v = this.smoothVolt;
        const sweep = v * (0.80 + 0.20 * v);
        const drive = 1.0 + sweep * 0.55;
        let sig = Math.tanh(vcfIn * drive) / drive;

        // 1. CS-80 12dB High-Pass Filter
        const hpCut = 26.0 + (1.0 - stageSub) * (38.0 + sweep * 82.0);
        const hpRes = 0.15 + (1.0 - stageSub) * 0.14;
        this.hpf.step(sig, hpCut, hpRes, sr);
        sig = this.hpf.hp;

        // 2. CS-80 12dB Resonant Low-Pass Filter
        const envMod = this.filterEnv * (1.0 - stageSub * 0.45);
        const lpCut = 135.0 + sweep * (4200.0 - stageSub * 2900.0) + envMod * (3800.0 - stageSub * 2200.0);
        const lpRes = Math.max(0.05, 0.30 + this.filterEnv * 0.15 - stageSub * 0.20);
        this.lpf.step(sig, lpCut, lpRes, sr);

        // 3. Post-VCF CS-80 Sine-Lever Addition + VCA
        const voiceOut = this.lpf.lp + postFilterSine;
        return voiceOut * v * sidechainEnv * 0.22;
    }
}

// =========================================================
// HAUPT-WORKLET PROZESSOR
// =========================================================
class YMBladeRunnerProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        const sr = (typeof sampleRate === 'number' && sampleRate > 0) ? sampleRate : 48000;
        this.sr = sr;
        this.clock = 2000000;

        this.regs = new Uint8Array(16);
        this.trackData = null;
        this.currentFrame = 0;
        this.playerRate = 50;
        this.loopFrame = 0;
        this.sampleCounter = 0.0;
        this.isPlaying = false;
        this.fadeVol = 0.0;
        this.fadeStep = 1.0 / Math.max(1, Math.round(0.010 * sr));

        this.voiceA = new CS80Voice(0, sr);
        this.voiceB = new CS80Voice(1, sr);
        this.voiceC = new CS80Voice(2, sr);

        // YM6 MFP Timer Special-FX States
        this.sidIncA = 0.0;
        this.sidIncB = 0.0;
        this.sidIncC = 0.0;
        this.syncBuzzerPhase = 0.0;
        this.syncBuzzerInc = 0.0;

        this.lfoVibrato = 0.0;
        this.lfoVibratoInc = 5.4 / sr;

        this.noiseLfsr = 1;
        this.noisePhase = 0.0;
        this.noiseOutput = 1.0;
        this.lastNoiseReg = -1;
        this.noiseFilter = new ZDFFilter();
        this.noiseFilter.setParams(4000.0, 0.12, sr);

        this.envPhase = 0.0;
        this.visualEnvelopeLevel = 0.0;

        this.stager = new DynamicStaging();
        this.stageSpeed = 1.0 - Math.exp(-44.1 / sr);

        // Digidrum Engine mit MFP-Pitch & Anti-Click Crossfade
        this.digidrums = [];
        this.currentDigidrum = null;
        this.digiPos = 0.0;
        this.digiRate = 8000.0;
        this.lastDigiSample = 0.0;
        this.digiFadeOut = 0.0;
        this.digiFadeCoef = Math.exp(-1.0 / (0.0015 * sr));
        this.lastDigiTrigger = 0;
        this.currentDrumVoice = 0;
        this.drumHp = new ZDFFilter();
        this.drumHp.setParams(3000.0, 0.15, sr);
        this.sidechainEnv = 1.0;
        this.sidechainRec = 1.0 - Math.exp(-1.0 / (0.011 * sr));

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

        // TAPE MULTI-TAP DELAY
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

        // LEXICON 224 CONCERT HALL: 19ms PRE-DELAY + 2x ALLPASS + 4x QUAD-MOD FDN
        this.preDelayLen = Math.max(16, Math.round(0.019 * sr));
        this.preDelayBufL = new Float32Array(this.preDelayLen);
        this.preDelayBufR = new Float32Array(this.preDelayLen);
        this.preDelayIdx = 0;

        this.ap1LenL = Math.max(16, Math.round(0.0047 * sr));
        this.ap1LenR = Math.max(16, Math.round(0.0053 * sr));
        this.ap2LenL = Math.max(16, Math.round(0.0111 * sr));
        this.ap2LenR = Math.max(16, Math.round(0.0123 * sr));
        this.ap1BufL = new Float32Array(this.ap1LenL);
        this.ap1BufR = new Float32Array(this.ap1LenR);
        this.ap2BufL = new Float32Array(this.ap2LenL);
        this.ap2BufR = new Float32Array(this.ap2LenR);
        this.ap1IdxL = 0; this.ap1IdxR = 0;
        this.ap2IdxL = 0; this.ap2IdxR = 0;

        this.fdnLens = [
            Math.max(64, Math.round(0.0317 * sr)),
            Math.max(64, Math.round(0.0473 * sr)),
            Math.max(64, Math.round(0.0683 * sr)),
            Math.max(64, Math.round(0.0919 * sr))
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
        this.fdnModPhase0 = 0.0;
        this.fdnModPhase1 = 0.25;
        this.fdnModInc0 = 0.37 / sr;
        this.fdnModInc1 = 0.53 / sr;
        this.fdnModDepth = 0.00035 * sr;
        this.fdnModMargin = Math.ceil(this.fdnModDepth) + 4;

        this.dcBlockL = new DCBlocker(sr, 18.0);
        this.dcBlockR = new DCBlocker(sr, 18.0);

        // Optionale Live-Makros (falls später UI-Regler angebunden werden)
        this.reverbMix = 0.36;
        this.delayMix = 0.42;
        this.chorusMix = 0.22;

        this.volA = 0.0; this.volB = 0.0; this.volC = 0.0;
        this.visualizer = new YMVisualizer(this.port);

        this.port.onmessage = (event) => {
            const msg = event.data;
            if (msg.type === 'PLAY_TRACK') {
                this.regs.fill(0);
                this.trackData = Array.isArray(msg.track) ? msg.track : null;
                const trackLen = this.trackData ? this.trackData.length : 0;
                this.digidrums = msg.digidrums || [];
                if (msg.roles) this.stager.state = msg.roles;
                this.currentFrame = 0;
                this.playerRate = Number.isFinite(msg.playerRate) && msg.playerRate > 0 ? msg.playerRate : 50;
                this.loopFrame = Number.isInteger(msg.loopFrame) && msg.loopFrame >= 0 && msg.loopFrame < trackLen
                    ? msg.loopFrame
                    : 0;
                this.sampleCounter = 0.0;
                this.currentDigidrum = null;
                this.digiRate = 8000.0;
                this.lastDigiSample = 0.0;
                this.digiFadeOut = 0.0;
                this.lastDigiTrigger = 0;
                this.currentDrumVoice = 0;
                this.envPhase = 0.0;
                this.sidechainEnv = 1.0;
                this.volA = 0.0; this.volB = 0.0; this.volC = 0.0;
                this.visualEnvelopeLevel = 0.0;
                this.fadeVol = 0.0;
                this.resetFxAndVoices(true);
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
                    this.sampleCounter = 0.0;
                    this.currentDigidrum = null;
                    this.lastDigiTrigger = 0;
                    this.currentDrumVoice = 0;
                    this.resetFxAndVoices(false);
                }
            } else if (msg.type === 'SET_PARAMS') {
                if (typeof msg.reverbMix === 'number') this.reverbMix = Math.max(0.0, Math.min(0.8, msg.reverbMix));
                if (typeof msg.delayMix === 'number') this.delayMix = Math.max(0.0, Math.min(0.8, msg.delayMix));
                if (typeof msg.chorusMix === 'number') this.chorusMix = Math.max(0.0, Math.min(0.6, msg.chorusMix));
            }
        };
    }

    resetFxAndVoices(clearSpace) {
        this.voiceA.reset(clearSpace);
        this.voiceB.reset(clearSpace);
        this.voiceC.reset(clearSpace);
        this.sidIncA = 0.0; this.sidIncB = 0.0; this.sidIncC = 0.0;
        this.syncBuzzerInc = 0.0;
        this.syncBuzzerPhase = 0.0;
        this.lastNoiseReg = -1;
        if (clearSpace) {
            this.noiseLfsr = 1;
            this.noisePhase = 0.0;
            this.noiseOutput = 1.0;
            this.noiseFilter.reset();
            this.drumHp.reset();
            this.chorusBufL.fill(0);
            this.chorusBufR.fill(0);
            this.chorusLpL = 0; this.chorusLpR = 0;
            this.delayBufL.fill(0);
            this.delayBufR.fill(0);
            this.delayLpL = 0; this.delayLpR = 0;
            this.delayHpL = 0; this.delayHpR = 0;
            this.delayHpPrevL = 0; this.delayHpPrevR = 0;
            this.preDelayBufL.fill(0);
            this.preDelayBufR.fill(0);
            this.ap1BufL.fill(0); this.ap1BufR.fill(0);
            this.ap2BufL.fill(0); this.ap2BufR.fill(0);
            for (let c = 0; c < 4; c++) this.fdnBufs[c].fill(0);
            this.fdnDampLp.fill(0);
            this.fdnDampHp.fill(0);
            this.fdnHpPrev.fill(0);
            this.dcBlockL.lastIn = 0; this.dcBlockL.lastOut = 0;
            this.dcBlockR.lastIn = 0; this.dcBlockR.lastOut = 0;
        }
    }

    decodeSlotFx(fxVoice, fxType, tp, tc, frame) {
        if (fxVoice === 0) return 0.0;
        const prediv = MFP_PREDIV[tp & 7];
        const timerHz = (prediv > 0 && tc > 0) ? (MFP_CLOCK / (prediv * tc)) : 0.0;
        const volReg = 7 + fxVoice; // 8, 9 oder 10

        if (fxType === 1) {
            // Digidrum: R8..R10 enthält 5-Bit Sample-ID -> darf keinen Synth-Buzzer triggern!
            this.regs[volReg] = 0;
            return timerHz;
        } else if (fxType === 0 && timerHz > 20.0) {
            // Atari SID-Voice: 2 Interrupts = 1 volle Rechteck-Periode
            const inc = (timerHz * 0.5) / this.sr;
            if (fxVoice === 1) this.sidIncA = inc;
            else if (fxVoice === 2) this.sidIncB = inc;
            else if (fxVoice === 3) this.sidIncC = inc;
            this.regs[volReg] = frame[volReg] & 0x0F;
        } else if (fxType === 3 && timerHz > 20.0) {
            // TAO Sync-Buzzer: Timer schreibt Shape (untere 4 Bit) periodisch nach R13
            this.syncBuzzerInc = timerHz / this.sr;
            this.regs[13] = frame[volReg] & 0x0F;
            this.regs[volReg] = 0x10;
        }
        return timerHz;
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
        if (rA < 0 || rA >= len) rA = ((rA % len) + len) % len;
        let rB = rA - 1;
        if (rB < 0) rB += len;
        return buf[rA] + (buf[rB] - buf[rA]) * frac;
    }

    process(inputs, outputs) {
        const outL = outputs[0][0];
        const outR = outputs[0].length > 1 ? outputs[0][1] : null;
        const sr = this.sr;
        const framesPerSample = this.playerRate / sr;
        let currentVisualValue = 0.0;

        for (let i = 0; i < outL.length; i++) {
            if (this.isPlaying) this.fadeVol = Math.min(1.0, this.fadeVol + this.fadeStep);
            else this.fadeVol = Math.max(0.0, this.fadeVol - this.fadeStep);

            if (this.fadeVol === 0.0) {
                outL[i] = 0.0;
                if (outR) outR[i] = 0.0;
                continue;
            }

            // 1. Register-Frame-Update + YM6 MFP-Timer-FX-Decoder
            if (this.trackData && this.trackData.length > 0) {
                this.sampleCounter -= 1.0;
                if (this.sampleCounter <= 0.0) {
                    const overshoot = -this.sampleCounter;
                    this.sampleCounter += 1.0 / framesPerSample;

                    const frame = this.trackData[this.currentFrame];
                    if (frame) {
                        for (let r = 0; r < 16; r++) {
                            if (r === 13) {
                                if (frame[13] !== 0xFF) {
                                    this.regs[13] = frame[13];
                                    const pE = (this.regs[12] << 8) | this.regs[11];
                                    const incEnv = (this.clock / (256.0 * (pE === 0 ? 1 : pE))) / sr;
                                    this.envPhase = overshoot * incEnv;
                                }
                            } else {
                                this.regs[r] = frame[r];
                            }
                        }

                        // YM6 Special-FX (Slot 1 & Slot 2) auswerten
                        this.sidIncA = 0.0; this.sidIncB = 0.0; this.sidIncC = 0.0;
                        this.syncBuzzerInc = 0.0;

                        const fx1Voice = (frame[1] >> 4) & 0x03;
                        const fx1Type = (frame[1] >> 6) & 0x03;
                        const tp1 = (frame[6] >> 5) & 0x07;
                        const timerHz1 = this.decodeSlotFx(fx1Voice, fx1Type, tp1, frame[14], frame);

                        const fx2Voice = (frame[3] >> 4) & 0x03;
                        const fx2Type = (frame[3] >> 6) & 0x03;
                        const tp2 = (frame[8] >> 5) & 0x07;
                        const timerHz2 = this.decodeSlotFx(fx2Voice, fx2Type, tp2, frame[15], frame);

                        // Digidrum-Erkennung (geschützt gegen R14/R15 Timer-Counts bei SID/SyncBuzzer!)
                        let activeDigiTrigger = detectDigidrum(frame);
                        const activeDigiVoice = detectDigidrumVoice(frame);

                        if (activeDigiVoice === 0 && (fx1Voice > 0 || fx2Voice > 0)) {
                            activeDigiTrigger = 0;
                            if (fx2Voice === 0 && frame[15] > 0) activeDigiTrigger = frame[15];
                            else if (fx1Voice === 0 && frame[14] > 0) activeDigiTrigger = frame[14];
                        }

                        // Exakte MFP-Abspielfrequenz für YM6-Digidrums (Fallback 8000 Hz)
                        let newDigiRate = 8000.0;
                        if (fx1Voice > 0 && fx1Type === 1 && timerHz1 > 0.0) {
                            newDigiRate = Math.max(2500.0, Math.min(32000.0, timerHz1));
                        } else if (fx2Voice > 0 && fx2Type === 1 && timerHz2 > 0.0) {
                            newDigiRate = Math.max(2500.0, Math.min(32000.0, timerHz2));
                        }

                        // YM5/YM6 Start-Flag erlaubt direkte Snare-Rolls auf demselben Drum-Index!
                        const shouldTrigger = activeDigiTrigger > 0
                            && (activeDigiVoice > 0 || activeDigiTrigger !== this.lastDigiTrigger);

                        if (shouldTrigger && this.digidrums[activeDigiTrigger - 1]) {
                            this.digiFadeOut += this.lastDigiSample; // Klickfreier Übergang!
                            this.currentDigidrum = this.digidrums[activeDigiTrigger - 1];
                            this.digiRate = newDigiRate;
                            this.digiPos = overshoot * (newDigiRate / sr);
                            this.sidechainEnv = 0.45;
                            this.currentDrumVoice = activeDigiVoice;
                        }
                        this.lastDigiTrigger = activeDigiTrigger;
                    }

                    // Noise-Filter nur neu parametrisieren, wenn sich R6 geändert hat
                    const pN_f = this.regs[6] & 0x1F;
                    if (pN_f !== this.lastNoiseReg) {
                        this.lastNoiseReg = pN_f;
                        this.noiseFilter.setParams(550.0 + (31 - pN_f) * 240.0, 0.12, sr);
                    }

                    const pA_f = ((this.regs[1] & 0x0F) << 8) | this.regs[0];
                    const pB_f = ((this.regs[3] & 0x0F) << 8) | this.regs[2];
                    const pC_f = ((this.regs[5] & 0x0F) << 8) | this.regs[4];
                    const mix_f = this.regs[7];

                    const drumMask = this.currentDigidrum ? this.currentDrumVoice : 0;
                    this.voiceA.onFrame(pA_f, (mix_f & 0x01) === 0, (mix_f & 0x08) === 0, drumMask === 1 ? 0 : this.regs[8]);
                    this.voiceB.onFrame(pB_f, (mix_f & 0x02) === 0, (mix_f & 0x10) === 0, drumMask === 2 ? 0 : this.regs[9]);
                    this.voiceC.onFrame(pC_f, (mix_f & 0x04) === 0, (mix_f & 0x20) === 0, drumMask === 3 ? 0 : this.regs[10]);

                    this.currentFrame++;
                    if (this.currentFrame >= this.trackData.length) this.currentFrame = this.loopFrame;
                }
            }

            // 2. Sidechain Recovery & stufenfreies Sample-Exact Staging
            this.sidechainEnv += (1.0 - this.sidechainEnv) * this.sidechainRec;

            const pA = ((this.regs[1] & 0x0F) << 8) | this.regs[0];
            const pB = ((this.regs[3] & 0x0F) << 8) | this.regs[2];
            const pC = ((this.regs[5] & 0x0F) << 8) | this.regs[4];
            const mix = this.regs[7];
            const tA = (mix & 0x01) === 0; const tB = (mix & 0x02) === 0; const tC = (mix & 0x04) === 0;
            const nA = (mix & 0x08) === 0; const nB = (mix & 0x10) === 0; const nC = (mix & 0x20) === 0;

            if (!this.currentDigidrum) this.currentDrumVoice = 0;

            const stage = this.stager.update(pA, pB, pC, nA, nB, nC, this.stageSpeed, this.currentDrumVoice);

            const epL_A = fastSinHalfPi(1.0 - stage.A.pan), epR_A = fastSinHalfPi(stage.A.pan);
            const epL_B = fastSinHalfPi(1.0 - stage.B.pan), epR_B = fastSinHalfPi(stage.B.pan);
            const epL_C = fastSinHalfPi(1.0 - stage.C.pan), epR_C = fastSinHalfPi(stage.C.pan);
            const epL_D = fastSinHalfPi(1.0 - stage.drums.pan), epR_D = fastSinHalfPi(stage.drums.pan);

            // 3. YM2149 LFSR Noise
            const pN = this.regs[6] & 0x1F;
            const noisePhaseInc = (this.clock / (16.0 * (pN === 0 ? 1 : pN))) / sr;
            this.noisePhase += noisePhaseInc;
            let noiseSteps = 0;
            while (this.noisePhase >= 1.0 && noiseSteps < 8) {
                this.noisePhase -= 1.0;
                this.noiseLfsr ^= (((this.noiseLfsr & 1) ^ ((this.noiseLfsr >> 3) & 1)) << 17);
                this.noiseLfsr >>= 1;
                this.noiseOutput = (this.noiseLfsr & 1) ? 1.0 : -1.0;
                noiseSteps++;
            }
            if (this.noisePhase >= 1.0) this.noisePhase %= 1.0;

            this.noiseFilter.process(this.noiseOutput);
            const filteredNoise = this.noiseFilter.lp * 0.42;

            // 4. YM2149F 32-Step Hardware-Hüllkurve + Sync-Buzzer + PolyBLEP-Buzzer
            const pE = (this.regs[12] << 8) | this.regs[11];
            const incEnv = (this.clock / (256.0 * (pE === 0 ? 1 : pE))) / sr;
            this.envPhase += incEnv;

            if (this.syncBuzzerInc > 0.0) {
                this.syncBuzzerPhase += this.syncBuzzerInc;
                if (this.syncBuzzerPhase >= 1.0) {
                    this.syncBuzzerPhase -= 1.0;
                    this.envPhase = this.syncBuzzerPhase * (incEnv / this.syncBuzzerInc);
                }
            }

            const shape = this.regs[13] & 0x0F;
            const cycles = Math.floor(this.envPhase);
            const localPhase = this.envPhase - cycles;

            const attack = (shape & 4) !== 0;
            const cont = (shape & 8) !== 0;
            const alt = (shape & 2) !== 0;
            const hold = (shape & 1) !== 0;

            let envVolRaw;
            let envStoppedZero = false;
            if (!cont) {
                if (cycles > 0) {
                    envVolRaw = 0.0;
                    envStoppedZero = true;
                } else {
                    envVolRaw = attack ? localPhase : (1.0 - localPhase);
                }
            } else if (hold) {
                if (cycles > 0) {
                    if (attack !== alt) {
                        envVolRaw = 1.0;
                    } else {
                        envVolRaw = 0.0;
                        envStoppedZero = true;
                    }
                } else {
                    envVolRaw = attack ? localPhase : (1.0 - localPhase);
                }
            } else {
                const flip = ((cycles & 1) === 1) && alt;
                const up = attack !== flip;
                envVolRaw = up ? localPhase : (1.0 - localPhase);
            }

            const envStep32 = Math.min(31, Math.max(0, Math.floor(envVolRaw * 31.999)));
            const envF16 = envStep32 * (15.0 / 31.0);
            const eIdx0 = Math.floor(envF16);
            const eIdx1 = eIdx0 < 15 ? eIdx0 + 1 : 15;
            const envDAC = YM_DAC[eIdx0] + (YM_DAC[eIdx1] - YM_DAC[eIdx0]) * (envF16 - eIdx0);
            this.visualEnvelopeLevel = envStep32 / 31.0;

            // Bandlimitierte Buzzer-Wellenform für Sägezahn-Hüllkurven (Shapes 8 & 12)
            let buzzerBlepped = envDAC;
            if (cont && !hold && !alt && incEnv > 0.0004 && incEnv < 0.45) {
                const edgeCorr = 0.5 * polyBLEP(localPhase, incEnv);
                buzzerBlepped += attack ? -edgeCorr : edgeCorr;
            }
            const buzzerWave = (buzzerBlepped - 0.36) * 1.55;

            // 5. Globales Vibrato + 3 CS-80 Stimmen (mit aktiver Digidrum-Voice-Isolierung)
            this.lfoVibrato += this.lfoVibratoInc;
            if (this.lfoVibrato >= 1.0) this.lfoVibrato -= 1.0;
            const vibSin = Math.sin(this.lfoVibrato * TWO_PI);

            const regVolA = this.currentDrumVoice === 1 ? 0 : this.regs[8];
            const regVolB = this.currentDrumVoice === 2 ? 0 : this.regs[9];
            const regVolC = this.currentDrumVoice === 3 ? 0 : this.regs[10];

            const sigA = this.voiceA.process(this.clock, pA, tA, nA, regVolA, filteredNoise, envDAC, buzzerWave, envStoppedZero, this.sidIncA, stage.A.sub, this.sidechainEnv, vibSin);
            const sigB = this.voiceB.process(this.clock, pB, tB, nB, regVolB, filteredNoise, envDAC, buzzerWave, envStoppedZero, this.sidIncB, stage.B.sub, this.sidechainEnv, vibSin);
            const sigC = this.voiceC.process(this.clock, pC, tC, nC, regVolC, filteredNoise, envDAC, buzzerWave, envStoppedZero, this.sidIncC, stage.C.sub, this.sidechainEnv, vibSin);

            this.volA = this.voiceA.smoothVolt;
            this.volB = this.voiceB.smoothVolt;
            this.volC = this.voiceC.smoothVolt;

            // 6. Digidrum Engine (MFP-Pitch + Anti-Click Crossfade + ZDF High-Pass Air)
            this.digiFadeOut *= this.digiFadeCoef;
            let digiSample = this.digiFadeOut;
            if (this.currentDigidrum) {
                const posInt = Math.floor(this.digiPos);
                if (posInt >= 0 && posInt < this.currentDigidrum.length - 2) {
                    const mu = this.digiPos - posInt;
                    const y0 = posInt > 0 ? this.currentDigidrum[posInt - 1] : 0.0;
                    const y1 = this.currentDigidrum[posInt];
                    const y2 = this.currentDigidrum[posInt + 1];
                    const y3 = this.currentDigidrum[posInt + 2];

                    const rawSample = cubicInterpolate(y0, y1, y2, y3, mu) * 0.48;
                    this.drumHp.process(rawSample);
                    const highAir = Math.tanh(this.drumHp.hp * 3.2) * 0.24;

                    const curOut = rawSample + highAir;
                    this.lastDigiSample = curOut;
                    digiSample += curOut;
                    this.digiPos += this.digiRate / sr;
                } else {
                    this.lastDigiSample = 0.0;
                    this.currentDigidrum = null;
                }
            } else {
                this.lastDigiSample = 0.0;
            }
            const lvlD = digiSample * stage.drums.gain;

            // 7. Dry Mix + True-Stereo Dimension-D BBD Chorus (100% monokompatibel!)
            const dryL = sigA * epL_A + sigB * epL_B + sigC * epL_C + lvlD * epL_D;
            const dryR = sigA * epR_A + sigB * epR_B + sigC * epR_C + lvlD * epR_D;

            const chInL = sigA * epL_A * (1.0 - stage.A.sub) + sigB * epL_B * (1.0 - stage.B.sub) + sigC * epL_C * (1.0 - stage.C.sub);
            const chInR = sigA * epR_A * (1.0 - stage.A.sub) + sigB * epR_B * (1.0 - stage.B.sub) + sigC * epR_C * (1.0 - stage.C.sub);
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

            // 8. Space Send -> Tape Multi-Tap Delay -> 19ms Pre-Delay -> Lexicon 224 FDN
            const sendL = sigA * epL_A * stage.A.rev
                + sigB * epL_B * stage.B.rev
                + sigC * epL_C * stage.C.rev
                + lvlD * epL_D * stage.drums.rev
                + dimWetL * 0.16;

            const sendR = sigA * epR_A * stage.A.rev
                + sigB * epR_B * stage.B.rev
                + sigC * epR_C * stage.C.rev
                + lvlD * epR_D * stage.drums.rev
                + dimWetR * 0.16;

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

            this.delayBufL[this.delayIdx] = Math.tanh(sendR * 0.45 + this.delayHpL * 0.50);
            this.delayBufR[this.delayIdx] = Math.tanh(sendL * 0.45 + this.delayHpR * 0.50);
            this.delayIdx = (this.delayIdx + 1) & this.delayMask;

            // 19ms Lexicon Pre-Delay (hält trockene Transienten glasklar vorne!)
            const preInL = sendL * 0.55 + this.delayHpL * 0.30;
            const preInR = sendR * 0.55 + this.delayHpR * 0.30;
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

            // Alle 4 FDN-Lines quadratur-moduliert (+sin, -sin, +cos, -cos -> konstante Gesamtlänge!)
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

            const y0 = this.readFdnModLinear(buf0, len0, idx0, len0 - this.fdnModMargin, modA);
            const y1 = this.readFdnModLinear(buf1, len1, idx1, len1 - this.fdnModMargin, -modA * 0.85);
            const y2 = this.readFdnModLinear(buf2, len2, idx2, len2 - this.fdnModMargin, modB);
            const y3 = this.readFdnModLinear(buf3, len3, idx3, len3 - this.fdnModMargin, -modB * 0.85);

            const s0 = y0 + y1, s1 = y0 - y1;
            const s2 = y2 + y3, s3 = y2 - y3;
            const m0 = (s0 + s2) * 0.415;
            const m1 = (s1 + s3) * 0.415;
            const m2 = (s0 - s2) * 0.415;
            const m3 = (s1 - s3) * 0.415;

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

            const revWetL = (y0 - y1 + y2 - y3) * this.reverbMix;
            const revWetR = (y0 + y1 - y2 - y3) * this.reverbMix;

            // 9. Master-Summe + Asymmetrische Tape-Sättigung + DC Blocker
            let finalL = dryL + dimWetL * this.chorusMix + this.delayHpL * this.delayMix + revWetL;
            let finalR = dryR + dimWetR * this.chorusMix + this.delayHpR * this.delayMix + revWetR;

            if (!Number.isFinite(finalL)) finalL = 0.0;
            if (!Number.isFinite(finalR)) finalR = 0.0;

            finalL = finalL > 0.0 ? Math.tanh(finalL * 1.65) : Math.tanh(finalL * 2.4) / 1.45;
            finalR = finalR > 0.0 ? Math.tanh(finalR * 1.65) : Math.tanh(finalR * 2.4) / 1.45;
            finalL *= 0.86;
            finalR *= 0.86;

            const dcL = this.dcBlockL.process(finalL) * this.fadeVol;
            const dcR = this.dcBlockR.process(finalR) * this.fadeVol;

            if (outR) {
                outL[i] = dcL;
                outR[i] = dcR;
            } else {
                outL[i] = (dcL + dcR) * 0.5;
            }

            // Vorzeichenbehafteter Block-Peak statt Blind-Abtastung auf Sample 0
            const mono = (dcL + dcR) * 0.5;
            if (Math.abs(mono) >= Math.abs(currentVisualValue)) {
                currentVisualValue = mono;
            }
        }

        this.visualizer.update(
            this.isPlaying,
            this.currentFrame,
            currentVisualValue,
            this.regs,
            this.volA,
            this.volB,
            this.volC,
            this.noiseOutput,
            this.visualEnvelopeLevel || 0
        );
        return true;
    }
}

registerProcessor('ym-bladerunner-processor', YMBladeRunnerProcessor);