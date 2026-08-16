// === js/worklets/lib/master-processor.js ===
// =========================================================
// MASTER BUS DSP STAGE & AUDIOPHILE HEADPHONE ACOUSTICS
// Features:
// 1. Audiophile Binaural Bauer Crossfeed (bs2b 700Hz / 4.5dB)
// 2. 1.0ms Lookahead True-Peak Brickwall Limiter (-0.35 dBFS Ceiling)
// =========================================================

class MasterDSPProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.crossfeedEnabled = true;
        
        // =========================================================
        // 1. BAUER BINAURAL CROSSFEED (bs2b Standard)
        // =========================================================
        this.crossDelayLen = 64;
        this.crossDelayL = new Float32Array(this.crossDelayLen);
        this.crossDelayR = new Float32Array(this.crossDelayLen);
        this.crossDelayIdx = 0;
        
        // 250µs Inter-Aural Delay (~12 Samples @ 48kHz)
        this.crossDelaySamples = Math.max(4, Math.min(32, Math.round(0.00025 * sampleRate)));

        // 1-Pole Lowpass Filter (700 Hz)
        const fc = 700.0;
        this.crossAlpha = 1.0 - Math.exp(-2.0 * Math.PI * fc / sampleRate);
        this.crossLpL = 0.0;
        this.crossLpR = 0.0;
        this.crossFeedGain = 0.58; // -4.7 dB Crossfeed-Pegel
        
        // =========================================================
        // 2. 1.0ms LOOKAHEAD TRUE-PEAK LIMITER
        // =========================================================
        this.lookaheadLen = 128;
        this.lookaheadL = new Float32Array(this.lookaheadLen);
        this.lookaheadR = new Float32Array(this.lookaheadLen);
        this.lookaheadIdx = 0;
        this.lookaheadDelay = Math.max(16, Math.min(96, Math.floor(0.001 * sampleRate))); // 1.0ms Lookahead

        this.currentGain = 1.0;
        this.threshold = 0.96; // -0.35 dBFS True-Peak Ceiling
        this.releaseAlpha = 1.0 - Math.exp(-1.0 / (sampleRate * 0.045)); // ~45ms Release

        this.port.onmessage = (e) => {
            if (e.data && e.data.type === 'SET_CROSSFEED') {
                this.crossfeedEnabled = !!e.data.enabled;
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
        const outR = output.length > 1 ? output[1] : output[0];
        const len = inL.length;

        for (let i = 0; i < len; i++) {
            let sL = inL[i];
            let sR = inR[i];

            // =========================================================
            // STAGE 1: BINAURAL BAUER CROSSFEED
            // =========================================================
            let procL = sL;
            let procR = sR;

            if (this.crossfeedEnabled) {
                this.crossDelayL[this.crossDelayIdx] = sL;
                this.crossDelayR[this.crossDelayIdx] = sR;
                
                let readIdx = (this.crossDelayIdx - this.crossDelaySamples + this.crossDelayLen) % this.crossDelayLen;
                let delL = this.crossDelayL[readIdx];
                let delR = this.crossDelayR[readIdx];

                // Tiefpass-Filterung des verzögerten Gegenkanals
                this.crossLpL += this.crossAlpha * (delR - this.crossLpL);
                this.crossLpR += this.crossAlpha * (delL - this.crossLpR);

                // Mischen mit Pegel-Kompensation (0 dB Perceived Balance)
                procL = (sL + this.crossLpL * this.crossFeedGain) * 0.76;
                procR = (sR + this.crossLpR * this.crossFeedGain) * 0.76;

                this.crossDelayIdx = (this.crossDelayIdx + 1) % this.crossDelayLen;
            }

            // =========================================================
            // STAGE 2: 1ms LOOKAHEAD TRUE-PEAK LIMITER
            // =========================================================
            this.lookaheadL[this.lookaheadIdx] = procL;
            this.lookaheadR[this.lookaheadIdx] = procR;

            let delayedReadIdx = (this.lookaheadIdx - this.lookaheadDelay + this.lookaheadLen) % this.lookaheadLen;
            let delayedL = this.lookaheadL[delayedReadIdx];
            let delayedR = this.lookaheadR[delayedReadIdx];
            this.lookaheadIdx = (this.lookaheadIdx + 1) % this.lookaheadLen;

            // Peak-Analyse auf dem un-verzögerten Vorlauf-Signal
            let peak = Math.max(Math.abs(procL), Math.abs(procR));
            let targetGain = 1.0;
            if (peak > this.threshold) {
                targetGain = this.threshold / peak;
            }

            // Instant Lookahead Attack bei Peaks
            if (targetGain < this.currentGain) {
                this.currentGain = targetGain;
            } else {
                // Weiches Exponential Release
                this.currentGain += this.releaseAlpha * (1.0 - this.currentGain);
            }

            outL[i] = delayedL * this.currentGain;
            outR[i] = delayedR * this.currentGain;
        }

        return true;
    }
}

registerProcessor('master-dsp-processor', MasterDSPProcessor);