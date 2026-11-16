// === js/worklets/lib/master-processor.js ===
// =========================================================
// MASTER BUS DSP STAGE & AUDIOPHILE HEADPHONE ACOUSTICS
// Features:
// 1. Audiophile Binaural Bauer Crossfeed (bs2b 700Hz / 4.5dB)
// 2. 1.0ms Lookahead Brickwall Limiter (-0.35 dBFS Ceiling)
// =========================================================

function nextPow2(v) {
    let p = 1;
    while (p < v) p <<= 1;
    return p;
}

class MasterDSPProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.crossfeedEnabled = false;

        // =========================================================
        // 1. BAUER BINAURAL CROSSFEED (bs2b Standard)
        // =========================================================
        // 250µs Inter-Aural Delay (~12 Samples @ 48kHz, ~24 @ 96kHz)
        this.crossDelaySamples = Math.max(4, Math.round(0.00025 * sampleRate));
        this.crossDelayLen = nextPow2(this.crossDelaySamples + 4);
        this.crossDelayMask = this.crossDelayLen - 1;
        this.crossDelayL = new Float32Array(this.crossDelayLen);
        this.crossDelayR = new Float32Array(this.crossDelayLen);
        this.crossDelayIdx = 0;

        // 1-Pole Lowpass Filter (700 Hz)
        const fc = 700.0;
        this.crossAlpha = 1.0 - Math.exp(-2.0 * Math.PI * fc / sampleRate);
        this.crossLpL = 0.0;
        this.crossLpR = 0.0;
        this.crossFeedGain = 0.58; // -4.7 dB Crossfeed-Pegel
        this.crossfeedMix = 0.0;
        this.crossMixAlpha = 1.0 - Math.exp(-1.0 / (0.010 * sampleRate)); // 10ms Fade

        // =========================================================
        // 2. 1.0ms LOOKAHEAD BRICKWALL LIMITER
        // =========================================================
        this.lookaheadDelay = Math.max(16, Math.round(0.001 * sampleRate));
        this.lookaheadLen = nextPow2(this.lookaheadDelay + 4);
        this.lookaheadMask = this.lookaheadLen - 1;
        this.lookaheadL = new Float32Array(this.lookaheadLen);
        this.lookaheadR = new Float32Array(this.lookaheadLen);
        this.lookaheadIdx = 0;

        this.threshold = 0.96; // -0.35 dBFS Ceiling
        this.releaseAlpha = 1.0 - Math.exp(-1.0 / (sampleRate * 0.045)); // ~45ms Release
        this.envGain = 1.0;

        // O(1) Sliding-Window-Minimum über [n - lookaheadDelay .. n]
        this.sampleCounter = 0;
        this.dequePos = new Float64Array(this.lookaheadLen);
        this.dequeVal = new Float64Array(this.lookaheadLen);
        this.dequeHead = 0;
        this.dequeTail = 0;

        // 1.0ms Attack-Glättung über das Lookahead-Fenster (kein Step vor Transienten)
        this.smoothGainBuf = new Float64Array(this.lookaheadDelay);
        this.smoothGainBuf.fill(1.0);
        this.smoothGainIdx = 0;
        this.smoothGainSum = this.lookaheadDelay;

        this.port.onmessage = (e) => {
            if (e.data && e.data.type === 'SET_CROSSFEED') {
                const nextEnabled = !!e.data.enabled;
                if (nextEnabled && !this.crossfeedEnabled) {
                    this.crossDelayL.fill(0);
                    this.crossDelayR.fill(0);
                    this.crossLpL = 0.0;
                    this.crossLpR = 0.0;
                    this.crossDelayIdx = 0;
                }
                this.crossfeedEnabled = nextEnabled;
            }
        };
    }

    process(inputs, outputs) {
        const input = inputs[0];
        const output = outputs[0];
        if (!input || !input[0] || !output || !output[0]) return true;

        const inL = input[0];
        const inR = input.length > 1 ? input[1] : input[0];
        const outL = output[0];
        const outR = output.length > 1 ? output[1] : null;
        const len = inL.length;

        for (let i = 0; i < len; i++) {
            const sL = inL[i];
            const sR = inR[i];

            // =========================================================
            // STAGE 1: BINAURAL BAUER CROSSFEED
            // =========================================================
            const targetMix = this.crossfeedEnabled ? 1.0 : 0.0;
            this.crossfeedMix += this.crossMixAlpha * (targetMix - this.crossfeedMix);
            if (!this.crossfeedEnabled && this.crossfeedMix < 1e-5) {
                this.crossfeedMix = 0.0;
            }

            let procL = sL;
            let procR = sR;

            if (this.crossfeedMix > 0.0) {
                this.crossDelayL[this.crossDelayIdx] = sL;
                this.crossDelayR[this.crossDelayIdx] = sR;

                const readIdx = (this.crossDelayIdx - this.crossDelaySamples) & this.crossDelayMask;
                const delL = this.crossDelayL[readIdx];
                const delR = this.crossDelayR[readIdx];

                this.crossLpL += this.crossAlpha * (delR - this.crossLpL);
                this.crossLpR += this.crossAlpha * (delL - this.crossLpR);

                const wetL = (sL + this.crossLpL * this.crossFeedGain) * 0.76;
                const wetR = (sR + this.crossLpR * this.crossFeedGain) * 0.76;

                procL = sL + (wetL - sL) * this.crossfeedMix;
                procR = sR + (wetR - sR) * this.crossfeedMix;

                this.crossDelayIdx = (this.crossDelayIdx + 1) & this.crossDelayMask;
            }

            // =========================================================
            // STAGE 2: 1ms LOOKAHEAD BRICKWALL LIMITER
            // =========================================================
            this.lookaheadL[this.lookaheadIdx] = procL;
            this.lookaheadR[this.lookaheadIdx] = procR;

            const delayedReadIdx = (this.lookaheadIdx - this.lookaheadDelay) & this.lookaheadMask;
            const delayedL = this.lookaheadL[delayedReadIdx];
            const delayedR = this.lookaheadR[delayedReadIdx];
            this.lookaheadIdx = (this.lookaheadIdx + 1) & this.lookaheadMask;

            const peak = Math.max(Math.abs(procL), Math.abs(procR));
            const reqGain = peak > this.threshold ? (this.threshold / peak) : 1.0;

            if (reqGain < this.envGain) {
                this.envGain = reqGain;
            } else {
                this.envGain += this.releaseAlpha * (reqGain - this.envGain);
                if (this.envGain > 1.0) this.envGain = 1.0;
            }

            const n = this.sampleCounter++;
            while (this.dequeTail !== this.dequeHead) {
                const backIdx = (this.dequeTail - 1) & this.lookaheadMask;
                if (this.dequeVal[backIdx] >= this.envGain) {
                    this.dequeTail = backIdx;
                } else {
                    break;
                }
            }
            this.dequePos[this.dequeTail] = n;
            this.dequeVal[this.dequeTail] = this.envGain;
            this.dequeTail = (this.dequeTail + 1) & this.lookaheadMask;

            const minPos = n - this.lookaheadDelay;
            while (this.dequeHead !== this.dequeTail && this.dequePos[this.dequeHead] < minPos) {
                this.dequeHead = (this.dequeHead + 1) & this.lookaheadMask;
            }
            const winMinGain = this.dequeVal[this.dequeHead];

            const oldSmooth = this.smoothGainBuf[this.smoothGainIdx];
            this.smoothGainBuf[this.smoothGainIdx] = winMinGain;
            this.smoothGainSum += winMinGain - oldSmooth;
            if (++this.smoothGainIdx >= this.lookaheadDelay) this.smoothGainIdx = 0;

            const gain = Math.min(1.0, Math.max(0.0, this.smoothGainSum / this.lookaheadDelay));
            const finalL = delayedL * gain;
            const finalR = delayedR * gain;

            if (outR) {
                outL[i] = finalL;
                outR[i] = finalR;
            } else {
                outL[i] = (finalL + finalR) * 0.5;
            }
        }

        // Akkumulator-Drift exakt auf Null halten
        let exactSum = 0.0;
        for (let k = 0; k < this.lookaheadDelay; k++) {
            exactSum += this.smoothGainBuf[k];
        }
        this.smoothGainSum = exactSum;

        return true;
    }
}

registerProcessor('master-dsp-processor', MasterDSPProcessor);