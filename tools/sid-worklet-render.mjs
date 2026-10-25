// Offline Phase 5 audition harness for the production C64 AudioWorklets.
// Setup-time I/O and analysis only; the measured process() path is unchanged.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, basename } from 'node:path';

function argument(name, fallback = null) {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] : fallback;
}

const engine = argument('--engine');
const input = argument('--input');
const seconds = Number(argument('--seconds', '20'));
const outputPath = argument('--out');
const reportPath = argument('--report');
const sampleRate = Number(argument('--sample-rate', '48000'));
if (!['exact', 'fantasy'].includes(engine)) throw new Error('--engine exact|fantasy required');
if (!input) throw new Error('--input file.sid required');
if (!outputPath || !(seconds > 0)) throw new Error('--out file.wav and positive --seconds required');

function parseSid(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const magic = String.fromCharCode(...bytes.subarray(0, 4));
    if (magic !== 'PSID' && magic !== 'RSID') throw new Error('PSID/RSID input required');
    const dataOffset = view.getUint16(6, false);
    let loadAddress = view.getUint16(8, false);
    let initAddress = view.getUint16(10, false);
    const playAddress = view.getUint16(12, false);
    const startSong = view.getUint16(16, false);
    const speed = view.getUint32(18, false);
    let start = dataOffset;
    const fileLoadAddress = bytes[start] | (bytes[start + 1] << 8);
    if (loadAddress === 0) {
        loadAddress = fileLoadAddress;
        start += 2;
    } else if (fileLoadAddress === loadAddress) {
        start += 2;
    }
    if (initAddress === 0) initAddress = loadAddress;
    return {
        isSidFile: true,
        c64Code: bytes.slice(start),
        loadAddress,
        initAddress,
        playAddress,
        startSong,
        speed,
        lengths: [seconds],
        length: Math.ceil(seconds * 50),
        metadata: { name: basename(input), songs: view.getUint16(14, false) }
    };
}

const processors = new Map();
globalThis.sampleRate = sampleRate;
globalThis.AudioWorkletProcessor = class {
    constructor() {
        this.port = { onmessage: null, postMessage() {} };
    }
};
globalThis.registerProcessor = (name, processor) => processors.set(name, processor);
await import('../js/worklets/c64/sid-exact.js');
await import('../js/worklets/c64/sid-fantasy.js');

const processorName = engine === 'exact' ? 'sid-exact-processor' : 'sid-fantasy-processor';
const Processor = processors.get(processorName);
// Pin the optional per-instance Exact calibration for repeatable offline runs.
// Browser playback keeps its normal per-instance variation.
Math.random = () => 0.5;
const processor = new Processor();
const tuneBytes = readFileSync(input);
const track = parseSid(tuneBytes);
processor.port.onmessage({ data: track });

const frames = Math.ceil(seconds * sampleRate);
const pcm = new Float32Array(frames * 2);
const blockL = new Float32Array(128);
const blockR = new Float32Array(128);
const output = [blockL, blockR];
let writeIndex = 0;
while (writeIndex < frames) {
    processor.process([], [output]);
    const count = Math.min(128, frames - writeIndex);
    for (let i = 0; i < count; i++) {
        pcm[(writeIndex + i) * 2] = blockL[i];
        pcm[(writeIndex + i) * 2 + 1] = blockR[i];
    }
    writeIndex += count;
}

let sumL = 0, sumR = 0, sumSquareL = 0, sumSquareR = 0;
let sumLR = 0, sumSide = 0, peak = 0, nonFinite = 0;
for (let i = 0; i < frames; i++) {
    const left = pcm[i * 2];
    const right = pcm[i * 2 + 1];
    if (!Number.isFinite(left) || !Number.isFinite(right)) nonFinite++;
    sumL += left;
    sumR += right;
    sumSquareL += left * left;
    sumSquareR += right * right;
    sumLR += left * right;
    const side = (left - right) * 0.5;
    sumSide += side * side;
    peak = Math.max(peak, Math.abs(left), Math.abs(right));
}
const dcL = sumL / frames;
const dcR = sumR / frames;
const rmsL = Math.sqrt(sumSquareL / frames);
const rmsR = Math.sqrt(sumSquareR / frames);
const correlation = sumLR / Math.max(1e-20, Math.sqrt(sumSquareL * sumSquareR));
const metrics = {
    engine,
    processor: processorName,
    input: basename(input),
    tuneSha256: (await import('node:crypto')).createHash('sha256').update(tuneBytes).digest('hex'),
    sampleRate,
    seconds,
    frames,
    rmsL,
    rmsR,
    rms: Math.sqrt((sumSquareL + sumSquareR) / (frames * 2)),
    peak,
    dcL,
    dcR,
    stereoCorrelation: correlation,
    sideRms: Math.sqrt(sumSide / frames),
    nonFinite
};

function encodeWav16(samples) {
    const dataBytes = samples.length * 2;
    const buffer = Buffer.alloc(44 + dataBytes);
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataBytes, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(2, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * 4, 28);
    buffer.writeUInt16LE(4, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataBytes, 40);
    for (let i = 0; i < samples.length; i++) {
        const sample = Math.max(-1, Math.min(1, samples[i]));
        buffer.writeInt16LE(Math.round(sample * (sample < 0 ? 32768 : 32767)), 44 + i * 2);
    }
    return buffer;
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, encodeWav16(pcm));
if (reportPath) {
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, JSON.stringify(metrics, null, 2) + '\n');
}
console.log(JSON.stringify(metrics, null, 2));
if (nonFinite !== 0) throw new Error('Non-finite worklet output');
