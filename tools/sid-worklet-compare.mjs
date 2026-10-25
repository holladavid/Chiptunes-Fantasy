// Offline Phase 5 comparison for PCM16 WAV renders. Analysis code only;
// no part of this file runs in an AudioWorklet or animation hot path.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, basename } from 'node:path';

function argument(name, fallback = null) {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] : fallback;
}

const referencePath = argument('--reference');
const candidatePath = argument('--candidate');
const reportPath = argument('--report');
if (!referencePath || !candidatePath) {
    throw new Error('--reference reference.wav --candidate candidate.wav required');
}

function readPcm16Wav(path) {
    const bytes = readFileSync(path);
    if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') {
        throw new Error(`${path}: RIFF/WAVE required`);
    }
    let offset = 12;
    let channels = 0;
    let sampleRate = 0;
    let bits = 0;
    let dataOffset = -1;
    let dataLength = 0;
    while (offset + 8 <= bytes.length) {
        const chunk = bytes.toString('ascii', offset, offset + 4);
        const length = bytes.readUInt32LE(offset + 4);
        if (chunk === 'fmt ') {
            if (bytes.readUInt16LE(offset + 8) !== 1) throw new Error(`${path}: integer PCM required`);
            channels = bytes.readUInt16LE(offset + 10);
            sampleRate = bytes.readUInt32LE(offset + 12);
            bits = bytes.readUInt16LE(offset + 22);
        } else if (chunk === 'data') {
            dataOffset = offset + 8;
            dataLength = Math.min(length, bytes.length - dataOffset);
        }
        offset += 8 + length + (length & 1);
    }
    if (bits !== 16 || (channels !== 1 && channels !== 2) || dataOffset < 0) {
        throw new Error(`${path}: mono/stereo PCM16 WAV with fmt/data chunks required`);
    }
    const frames = Math.floor(dataLength / (channels * 2));
    const mono = new Float64Array(frames);
    for (let i = 0; i < frames; i++) {
        const at = dataOffset + i * channels * 2;
        let sample = bytes.readInt16LE(at) / 32768;
        if (channels === 2) sample = 0.5 * (sample + bytes.readInt16LE(at + 2) / 32768);
        mono[i] = sample;
    }
    return { path: basename(path), sampleRate, frames, mono };
}

const reference = readPcm16Wav(referencePath);
const candidate = readPcm16Wav(candidatePath);
if (reference.sampleRate !== candidate.sampleRate) throw new Error('Sample rates must match');

function makeFft(size) {
    const reversal = new Uint32Array(size);
    const cosine = new Float64Array(size / 2);
    const sine = new Float64Array(size / 2);
    const bits = Math.log2(size);
    if (!Number.isInteger(bits)) throw new Error('FFT size must be a power of two');
    for (let i = 0; i < size; i++) {
        let source = i;
        let reversed = 0;
        for (let bit = 0; bit < bits; bit++) {
            reversed = (reversed << 1) | (source & 1);
            source >>= 1;
        }
        reversal[i] = reversed;
    }
    for (let i = 0; i < size / 2; i++) {
        const angle = -2 * Math.PI * i / size;
        cosine[i] = Math.cos(angle);
        sine[i] = Math.sin(angle);
    }
    return { size, reversal, cosine, sine };
}

function transform(real, imaginary, fft) {
    const size = fft.size;
    for (let i = 0; i < size; i++) {
        const target = fft.reversal[i];
        if (target > i) {
            let value = real[i]; real[i] = real[target]; real[target] = value;
            value = imaginary[i]; imaginary[i] = imaginary[target]; imaginary[target] = value;
        }
    }
    for (let length = 2; length <= size; length *= 2) {
        const half = length / 2;
        const stride = size / length;
        for (let start = 0; start < size; start += length) {
            for (let j = 0; j < half; j++) {
                const even = start + j;
                const odd = even + half;
                const twiddle = j * stride;
                const oddReal = real[odd] * fft.cosine[twiddle] - imaginary[odd] * fft.sine[twiddle];
                const oddImaginary = real[odd] * fft.sine[twiddle] + imaginary[odd] * fft.cosine[twiddle];
                real[odd] = real[even] - oddReal;
                imaginary[odd] = imaginary[even] - oddImaginary;
                real[even] += oddReal;
                imaginary[even] += oddImaginary;
            }
        }
    }
}

function compareSpectra(left, right, sampleRate, size, minHz, maxHz, collectBands) {
    const fft = makeFft(size);
    const real = new Float64Array(size);
    const imaginary = new Float64Array(size);
    const spectrumA = new Float64Array(size / 2 + 1);
    const spectrumB = new Float64Array(size / 2 + 1);
    const window = new Float64Array(size);
    const correlations = [];
    const bandLimits = [16, 32, 40, 56, 64, 128, 1000, 20000];
    const bandPowerA = new Float64Array(bandLimits.length - 1);
    const bandPowerB = new Float64Array(bandLimits.length - 1);
    const firstBin = Math.max(0, Math.ceil(minHz * size / sampleRate));
    const lastBin = Math.min(size / 2, Math.floor(maxHz * size / sampleRate));
    for (let i = 0; i < size; i++) window[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (size - 1));
    const hop = size / 2;
    const frames = Math.min(left.length, right.length);
    for (let start = 0; start + size <= frames; start += hop) {
        let normA = 0;
        let normB = 0;
        for (let channel = 0; channel < 2; channel++) {
            const input = channel === 0 ? left : right;
            for (let i = 0; i < size; i++) {
                real[i] = input[start + i] * window[i];
                imaginary[i] = 0;
            }
            transform(real, imaginary, fft);
            const spectrum = channel === 0 ? spectrumA : spectrumB;
            for (let bin = 0; bin <= size / 2; bin++) {
                const magnitude = Math.hypot(real[bin], imaginary[bin]);
                spectrum[bin] = magnitude;
                if (collectBands) {
                    const frequency = bin * sampleRate / size;
                    for (let band = 0; band < bandLimits.length - 1; band++) {
                        if (frequency >= bandLimits[band] && frequency < bandLimits[band + 1]) {
                            (channel === 0 ? bandPowerA : bandPowerB)[band] += magnitude * magnitude;
                            break;
                        }
                    }
                }
            }
        }
        let correlation = 0;
        for (let bin = firstBin; bin <= lastBin; bin++) {
            correlation += spectrumA[bin] * spectrumB[bin];
            normA += spectrumA[bin] * spectrumA[bin];
            normB += spectrumB[bin] * spectrumB[bin];
        }
        correlations.push(correlation / Math.max(1e-30, Math.sqrt(normA * normB)));
    }
    const result = { size, hop, window: 'symmetric Hann, no boundary padding', frames: correlations.length };
    if (correlations.length > 0) {
        const sorted = correlations.slice().sort((a, b) => a - b);
        result.median = sorted[Math.floor((sorted.length - 1) * 0.5)];
        result.p10 = sorted[Math.floor((sorted.length - 1) * 0.1)];
    }
    if (collectBands) {
        result.bands = {};
        for (let band = 0; band < bandLimits.length - 1; band++) {
            const name = `${bandLimits[band]}-${bandLimits[band + 1]}Hz`;
            result.bands[name] = {
                referencePower: bandPowerA[band],
                candidatePower: bandPowerB[band],
                changeDb: 10 * Math.log10(bandPowerB[band] / Math.max(1e-30, bandPowerA[band]))
            };
        }
    }
    return result;
}

const report = {
    format: 'chiptunes-fantasy-sid-phase5-comparison-v1',
    reference: { file: reference.path, sampleRate: reference.sampleRate, frames: reference.frames },
    candidate: { file: candidate.path, sampleRate: candidate.sampleRate, frames: candidate.frames },
    method: 'mono channel average; per-frame cosine similarity of uncentered FFT magnitudes',
    spectralShape: compareSpectra(reference.mono, candidate.mono, reference.sampleRate, 4096, 40, 20000, false),
    bandPower: compareSpectra(reference.mono, candidate.mono, reference.sampleRate, 8192, 0, 24000, true).bands
};
const json = JSON.stringify(report, null, 2) + '\n';
if (reportPath) {
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, json);
}
console.log(json);
