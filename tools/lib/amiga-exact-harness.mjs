// Reusable offline harness for the production Paula Exact AudioWorklet.
// No master gain, crossfeed or limiter is instantiated. Diagnostic taps are
// disabled during normal browser playback and enabled only by this harness.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { amigaPlaylist } from '../../tracks/amiga/playlist.js';
import { loadHipcFile } from '../../js/parsers/hipc-parser.js';
import { loadModFile } from '../../js/parsers/mod-parser.js';
import { loadXmFile } from '../../js/parsers/xm-parser.js';
import { loadDwFile } from '../../js/parsers/dw-parser.js';

export const AMIGA_HARNESS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const TAP_DEFINITIONS = Object.freeze([
    Object.freeze({ id: 'paula', stage: 0, rate: 'internal', description: 'L/R-Kanalsumme nach logischer Kanaldämpfung, vor Crosstalk und Analogstufen' }),
    Object.freeze({ id: 'zoh', stage: 1, rate: 'internal', description: 'ZOH-/Panning-Signal nach 3,5-%Crosstalk, unmittelbar vor LF347/RC/LED' }),
    Object.freeze({ id: 'a500', stage: 2, rate: 'output', description: 'A500-Ausgabestufe nach LF347, RC, optionalem LED-Filter, Sättigung, FIR und 0,7-Pegel' })
]);

const processors = new Map();
globalThis.sampleRate = 48000;
globalThis.AudioWorkletProcessor = class {
    constructor() {
        this.port = { onmessage: null, postMessage() {} };
    }
};
globalThis.registerProcessor = (name, processor) => processors.set(name, processor);
globalThis.fetch = async url => {
    const filename = path.resolve(AMIGA_HARNESS_ROOT, String(url));
    if (!filename.startsWith(AMIGA_HARNESS_ROOT + path.sep)) throw new Error(`Pfad ausserhalb des Projekts: ${url}`);
    const bytes = readFileSync(filename);
    return {
        ok: true,
        arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    };
};
await import('../../js/worklets/amiga/paula-exact.js');
const Processor = processors.get('paula-exact-processor');
if (!Processor) throw new Error('paula-exact-processor wurde nicht registriert');

const normalize = filename => filename.split(path.sep).join('/').replace(/^\.\//, '');
const fileBytes = filename => readFileSync(path.resolve(AMIGA_HARNESS_ROOT, filename));
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export async function loadAmigaTrack(input, song = null) {
    const relative = normalize(path.isAbsolute(input) ? path.relative(AMIGA_HARNESS_ROOT, input) : input);
    const playlistMatches = amigaPlaylist.filter(entry => entry.path === relative || path.basename(entry.path) === path.basename(relative));
    if (playlistMatches.length > 1) throw new Error(`Dateiname ist in der Playlist mehrdeutig: ${input}`);
    const options = {};
    if (song !== null && song !== undefined) options.song = Number(song);
    if (relative.toLowerCase().startsWith('amberstar/') || relative.toLowerCase().includes('/amberstar/')) {
        options.sampleBankUrl = 'tracks/amiga/amberstar/hipc.samp';
        options.replayerOptions = { envSpec: true };
    }
    let track;
    if (playlistMatches.length === 1 && song === null) {
        track = await playlistMatches[0].loadAsync();
    } else {
        const url = relative.startsWith('tracks/amiga/') ? relative : `tracks/amiga/${relative}`;
        const lower = relative.toLowerCase();
        if (/\.(hipc|hip|coso)$/.test(lower)) track = await loadHipcFile(url, options);
        else if (lower.endsWith('.xm')) track = await loadXmFile(url);
        else if (lower.endsWith('.dw')) track = await loadDwFile(url);
        else track = await loadModFile(url);
    }
    return { track, path: relative.replace(/^tracks\/amiga\//, ''), bytes: fileBytes(relative.startsWith('tracks/amiga/') ? relative : `tracks/amiga/${relative}`) };
}

export function startExactTrack(processor, track) {
    for (const [name, data] of Object.entries(track.samples || {})) {
        processor.port.onmessage({ data: { type: 'UPLOAD_SAMPLE', name, data } });
    }
    processor.port.onmessage({ data: { type: 'PLAY_TRACK', track } });
}

export function createExactProcessor(track, outputRate = 48000) {
    globalThis.sampleRate = outputRate;
    const processor = new Processor();
    startExactTrack(processor, track);
    return processor;
}

class TapCapture {
    constructor(definition, sampleRate, keepPcm) {
        this.definition = definition;
        this.sampleRate = sampleRate;
        this.hash = createHash('sha256');
        this.scratch = Buffer.allocUnsafe(16);
        this.frames = 0;
        this.peak = 0;
        this.sum = 0;
        this.sumSquare = 0;
        this.nonFinite = 0;
        this.pcm = keepPcm ? [] : null;
    }
    write(left, right) {
        if (!Number.isFinite(left) || !Number.isFinite(right)) this.nonFinite++;
        this.peak = Math.max(this.peak, Math.abs(left), Math.abs(right));
        this.sum += left + right;
        this.sumSquare += left * left + right * right;
        this.scratch.writeDoubleLE(left, 0);
        this.scratch.writeDoubleLE(right, 8);
        this.hash.update(this.scratch);
        if (this.pcm) this.pcm.push(left, right);
        this.frames++;
    }
    finish(elapsedMs) {
        return {
            id: this.definition.id,
            description: this.definition.description,
            sampleRate: this.sampleRate,
            frames: this.frames,
            channels: 2,
            hashEncoding: 'interleaved Float64LE before PCM quantization',
            sha256: this.hash.digest('hex'),
            peak: this.peak,
            dc: this.sum / Math.max(1, this.frames * 2),
            rms: Math.sqrt(this.sumSquare / Math.max(1, this.frames * 2)),
            nonFiniteSamples: this.nonFinite,
            elapsedMs
        };
    }
}

export function encodeWav16(pcm, sampleRate) {
    const dataBytes = pcm.length * 2;
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
    for (let i = 0; i < pcm.length; i++) {
        const sample = Math.max(-1, Math.min(1, pcm[i]));
        buffer.writeInt16LE(Math.round(sample * (sample < 0 ? 32768 : 32767)), 44 + i * 2);
    }
    return buffer;
}

export function renderExact(processor, {
    seconds = 5,
    outputRate = 48000,
    blockSize = 128,
    blockPattern = null,
    keepPcm = false
} = {}) {
    const frames = Math.round(seconds * outputRate);
    const captures = TAP_DEFINITIONS.map(definition => new TapCapture(
        definition,
        definition.rate === 'internal' ? outputRate * processor.OVERSAMPLING : outputRate,
        keepPcm
    ));
    processor.diagnosticTap = (stage, left, right) => captures[stage].write(left, right);
    let rendered = 0;
    let block = 0;
    const started = performance.now();
    while (rendered < frames) {
        const requested = blockPattern ? blockPattern[block % blockPattern.length] : blockSize;
        const size = Math.min(requested, frames - rendered);
        const left = new Float32Array(size);
        const right = new Float32Array(size);
        if (!processor.process([], [[left, right]])) throw new Error('Paula Exact Processor stopped unexpectedly');
        rendered += size;
        block++;
    }
    const elapsedMs = performance.now() - started;
    processor.diagnosticTap = null;
    const result = {
        frames,
        seconds: frames / outputRate,
        blockSize,
        blockPattern: blockPattern ? [...blockPattern] : null,
        elapsedMs,
        taps: captures.map(capture => capture.finish(elapsedMs))
    };
    if (keepPcm) result.pcm = Object.fromEntries(captures.map(capture => [capture.definition.id, {
        sampleRate: capture.sampleRate,
        samples: Float32Array.from(capture.pcm)
    }]));
    return result;
}

export function tapHashes(run) {
    return Object.fromEntries(run.taps.map(tap => [tap.id, tap.sha256]));
}

export function sameTaps(left, right) {
    const a = tapHashes(left);
    const b = tapHashes(right);
    return TAP_DEFINITIONS.every(definition => a[definition.id] === b[definition.id]);
}

export function nonFiniteSamples(run) {
    return run.taps.reduce((sum, tap) => sum + tap.nonFiniteSamples, 0);
}
