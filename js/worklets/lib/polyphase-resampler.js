// Band-limited arbitrary-ratio resampler for native chip output streams.
// Causal linear-phase Kaiser-windowed sinc with interpolated polyphase kernels.
// Setup allocates and designs the bank; beginSample/write/process allocate nothing.

const TWO_PI = Math.PI * 2;

function besselI0(x) {
    let sum = 1.0;
    let term = 1.0;
    const half = x * 0.5;
    for (let k = 1; k < 40; k++) {
        term *= (half / k) * (half / k);
        sum += term;
        if (term < sum * 1e-16) break;
    }
    return sum;
}

export class PolyphaseResampler {
    constructor(inputRate, outputRate, {
        channels = 1,
        phases = 256,
        attenuation = 96,
        passbandHz = 20000,
        maximumStopbandHz = 24000
    } = {}) {
        if (!Number.isFinite(inputRate) || !Number.isFinite(outputRate) || inputRate <= 0 || outputRate <= 0) {
            throw new RangeError('sample rates must be finite positive numbers');
        }
        if (outputRate < 8000) throw new RangeError('outputRate below 8000 Hz is not supported');
        if (channels !== 1 && channels !== 2) throw new RangeError('channels must be 1 or 2');
        if (!Number.isInteger(phases) || phases < 16 || phases > 4096) {
            throw new RangeError('phases must be an integer from 16 through 4096');
        }
        if (!Number.isFinite(attenuation) || attenuation < 40 || attenuation > 160) {
            throw new RangeError('attenuation must be between 40 and 160 dB');
        }

        this.inputRate = inputRate;
        this.outputRate = outputRate;
        this.channels = channels;
        this.phases = phases;
        this.attenuation = attenuation;
        this.step = inputRate / outputRate;
        this.passbandHz = Math.min(passbandHz, outputRate * 0.45);
        this.stopbandHz = Math.min(outputRate * 0.5, maximumStopbandHz);
        this.cutoffHz = (this.passbandHz + this.stopbandHz) * 0.5;
        const transitionHz = this.stopbandHz - this.passbandHz;
        if (!(transitionHz > 0) || this.cutoffHz >= inputRate * 0.5) {
            throw new RangeError('invalid resampling transition band');
        }

        // Kaiser order estimate, rounded to an odd tap count for a constant
        // integer input-domain group delay. No runtime rate adaptation occurs.
        const transitionRadians = TWO_PI * transitionHz / inputRate;
        this.taps = Math.ceil((attenuation - 8.0) / (2.285 * transitionRadians)) + 1;
        if ((this.taps & 1) === 0) this.taps++;
        this.beta = attenuation > 50
            ? 0.1102 * (attenuation - 8.7)
            : attenuation >= 21
                ? 0.5842 * Math.pow(attenuation - 21, 0.4) + 0.07886 * (attenuation - 21)
                : 0;
        this.groupDelayInput = (this.taps - 1) * 0.5;
        this.groupDelaySeconds = this.groupDelayInput / inputRate;
        this.groupDelayOutputSamples = this.groupDelaySeconds * outputRate;

        this.ringSize = 1 << Math.ceil(Math.log2(this.taps + 2));
        this.ringMask = this.ringSize - 1;
        this.ringL = new Float32Array(this.ringSize);
        this.ringR = channels === 2 ? new Float32Array(this.ringSize) : null;
        // One explicit endpoint avoids a discontinuous wrap during interpolation.
        this.polyphaseTable = new Float32Array((phases + 1) * this.taps);
        this.reset();

        const cutoff = this.cutoffHz / inputRate;
        const half = this.groupDelayInput;
        const i0Beta = besselI0(this.beta);

        for (let phase = 0; phase <= phases; phase++) {
            // After beginSample, the newest input index is m and the ideal
            // output time is m + 1 + remainder. k therefore addresses m-k.
            const delay = 1.0 + phase / phases;
            const base = phase * this.taps;
            let sum = 0.0;

            for (let k = 0; k < this.taps; k++) {
                const x = k - half + delay;
                const sinc = Math.abs(x) < 1e-10
                    ? TWO_PI * cutoff
                    : Math.sin(TWO_PI * cutoff * x) / x;
                const windowPosition = (k + delay) / (this.taps - 1);
                let window = 0.0;
                if (windowPosition >= 0.0 && windowPosition <= 1.0) {
                    const radius = 2.0 * windowPosition - 1.0;
                    window = besselI0(this.beta * Math.sqrt(Math.max(0.0, 1.0 - radius * radius))) / i0Beta;
                }
                const coefficient = sinc * window;
                this.polyphaseTable[base + k] = coefficient;
                sum += coefficient;
            }

            const scale = 1.0 / sum;
            for (let k = 0; k < this.taps; k++) {
                this.polyphaseTable[base + k] = Math.fround(this.polyphaseTable[base + k] * scale);
            }
        }
    }

    reset() {
        this.ringL.fill(0);
        if (this.ringR) this.ringR.fill(0);
        this.ringIndex = 0;
        this.cycleAccumulator = 0.0;
        this.kernelBase = 0;
        this.phaseLerp = 0.0;
    }

    beginSample() {
        this.cycleAccumulator += this.step;
        const cycles = Math.floor(this.cycleAccumulator);
        this.cycleAccumulator -= cycles;
        const phasePosition = this.cycleAccumulator * this.phases;
        const phase = Math.floor(phasePosition);
        this.phaseLerp = phasePosition - phase;
        this.kernelBase = phase * this.taps;
        return cycles;
    }

    write(left, right = 0.0) {
        this.ringL[this.ringIndex] = left;
        if (this.ringR) this.ringR[this.ringIndex] = right;
        this.ringIndex = (this.ringIndex + 1) & this.ringMask;
    }

    processStereo() {
        const left = this.ringL;
        const right = this.ringR;
        const coefficients = this.polyphaseTable;
        const base = this.kernelBase;
        const mask = this.ringMask;
        const fraction = this.phaseLerp;
        let index = (this.ringIndex - 1) & mask;
        let outputL = 0.0;
        let outputR = 0.0;
        for (let k = 0; k < this.taps; k++) {
            const first = coefficients[base + k];
            const second = coefficients[base + this.taps + k];
            const coefficient = first + (second - first) * fraction;
            outputL += left[index] * coefficient;
            outputR += right[index] * coefficient;
            index = (index - 1) & mask;
        }
        this.outputL = outputL;
        this.outputR = outputR;
    }

    process(channel = 0) {
        const ring = channel === 0 ? this.ringL : this.ringR;
        const coefficients = this.polyphaseTable;
        const base = this.kernelBase;
        const mask = this.ringMask;
        let index = (this.ringIndex - 1) & mask;
        let output = 0.0;
        const fraction = this.phaseLerp;
        for (let k = 0; k < this.taps; k++) {
            const first = coefficients[base + k];
            const second = coefficients[base + this.taps + k];
            const coefficient = first + (second - first) * fraction;
            output += ring[index] * coefficient;
            index = (index - 1) & mask;
        }
        return output;
    }
}
