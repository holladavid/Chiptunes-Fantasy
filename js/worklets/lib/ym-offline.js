import {
    YM2149_CLOCK,
    YM2149_REGISTER_COUNT,
    YM2149_VOICE_COUNT,
    YM2149Core
} from './ym2149-core.js';

function positiveInteger(value, name, allowZero = false) {
    if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) {
        throw new RangeError(`${name} must be ${allowZero ? 'a non-negative' : 'a positive'} safe integer`);
    }
}

export class YMOfflineHarness {
    constructor({ cycles, events = [], clock = YM2149_CLOCK, traceStride = 1 }) {
        positiveInteger(cycles, 'cycles', true);
        positiveInteger(clock, 'clock');
        positiveInteger(traceStride, 'traceStride');
        if (cycles > 0xFFFFFFFF) throw new RangeError('cycles must fit the uint32 trace format');
        if (!Array.isArray(events)) throw new TypeError('events must be an array');

        this.cycles = cycles;
        this.clock = clock;
        this.traceStride = traceStride;
        this.raw = new Float32Array(cycles);

        const ordered = events.map((event, index) => ({ event, index }));
        ordered.sort((a, b) => a.event.cycle - b.event.cycle || a.index - b.index);
        this.eventCycles = new Uint32Array(events.length);
        this.eventRegisters = new Uint8Array(events.length);
        this.eventValues = new Uint8Array(events.length);

        for (let i = 0; i < ordered.length; i++) {
            const event = ordered[i].event;
            if (!event || !Number.isSafeInteger(event.cycle) || event.cycle < 0 || event.cycle >= cycles) {
                throw new RangeError(`event ${ordered[i].index} has an out-of-range cycle`);
            }
            if (!Number.isInteger(event.register) || event.register < 0 || event.register >= YM2149_REGISTER_COUNT) {
                throw new RangeError(`event ${ordered[i].index} has an invalid register`);
            }
            if (!Number.isInteger(event.value) || event.value < 0 || event.value > 255) {
                throw new RangeError(`event ${ordered[i].index} has an invalid value`);
            }
            this.eventCycles[i] = event.cycle;
            this.eventRegisters[i] = event.register;
            this.eventValues[i] = event.value;
        }

        this.ym = new YM2149Core(clock);
        this.frameCount = Math.ceil(cycles / traceStride);
        this.trace = {
            stride: traceStride,
            cycle: new Uint32Array(this.frameCount),
            output: new Float32Array(this.frameCount),
            registers: new Uint8Array(this.frameCount * YM2149_REGISTER_COUNT),
            toneDivider: new Uint32Array(this.frameCount * YM2149_VOICE_COUNT),
            toneOutput: new Uint8Array(this.frameCount * YM2149_VOICE_COUNT),
            noiseDivider: new Uint32Array(this.frameCount),
            noiseLfsr: new Uint32Array(this.frameCount),
            noiseOutput: new Uint8Array(this.frameCount),
            envelopeDivider: new Uint32Array(this.frameCount),
            envelopePosition: new Uint8Array(this.frameCount),
            envelopeShape: new Uint8Array(this.frameCount),
            envelopeLevel: new Uint8Array(this.frameCount),
            volume: new Float32Array(this.frameCount * YM2149_VOICE_COUNT)
        };
    }

    run() {
        const ym = this.ym;
        const trace = this.trace;
        const stride = this.traceStride;
        let eventIndex = 0;
        let frame = 0;

        for (let cycle = 0; cycle < this.cycles; cycle++) {
            while (eventIndex < this.eventCycles.length && this.eventCycles[eventIndex] === cycle) {
                ym.writeRegister(this.eventRegisters[eventIndex], this.eventValues[eventIndex]);
                eventIndex++;
            }

            this.raw[cycle] = ym.clockCycle();
            if (cycle % stride === 0) {
                const voiceOffset = frame * YM2149_VOICE_COUNT;
                trace.cycle[frame] = cycle;
                trace.output[frame] = ym.outputSample;
                trace.registers.set(ym.regs, frame * YM2149_REGISTER_COUNT);
                trace.toneDivider[voiceOffset] = ym.toneDivA;
                trace.toneDivider[voiceOffset + 1] = ym.toneDivB;
                trace.toneDivider[voiceOffset + 2] = ym.toneDivC;
                trace.toneOutput[voiceOffset] = ym.toneOutA;
                trace.toneOutput[voiceOffset + 1] = ym.toneOutB;
                trace.toneOutput[voiceOffset + 2] = ym.toneOutC;
                trace.noiseDivider[frame] = ym.noiseDiv;
                trace.noiseLfsr[frame] = ym.noiseLfsr;
                trace.noiseOutput[frame] = ym.noiseOut;
                trace.envelopeDivider[frame] = ym.envDiv;
                trace.envelopePosition[frame] = ym.envPos;
                trace.envelopeShape[frame] = ym.envShape;
                trace.envelopeLevel[frame] = ym.envVol5Bit;
                trace.volume[voiceOffset] = ym.volA;
                trace.volume[voiceOffset + 1] = ym.volB;
                trace.volume[voiceOffset + 2] = ym.volC;
                frame++;
            }
        }
        return this;
    }
}

export function renderYMOffline(options) {
    return new YMOfflineHarness(options).run();
}

export function encodeYMWav(samples, sampleRate = YM2149_CLOCK) {
    positiveInteger(sampleRate, 'sampleRate');
    if (!(samples instanceof Float32Array)) throw new TypeError('samples must be a Float32Array');

    const bytes = 44 + samples.length * 4;
    const wav = new Uint8Array(bytes);
    const view = new DataView(wav.buffer);
    view.setUint32(0, 0x46464952, false);
    view.setUint32(4, bytes - 8, true);
    view.setUint32(8, 0x45564157, false);
    view.setUint32(12, 0x20746D66, false);
    view.setUint32(16, 16, true);
    view.setUint16(20, 3, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 4, true);
    view.setUint16(32, 4, true);
    view.setUint16(34, 32, true);
    view.setUint32(36, 0x61746164, false);
    view.setUint32(40, samples.length * 4, true);
    for (let i = 0; i < samples.length; i++) view.setFloat32(44 + i * 4, samples[i], true);
    return wav;
}

export function ymTraceToCsv(harness) {
    const trace = harness.trace;
    const rows = new Array(trace.cycle.length + 1);
    rows[0] = 'cycle,output,registers_hex,tone_div_a,tone_div_b,tone_div_c,' +
        'tone_out_a,tone_out_b,tone_out_c,noise_div,noise_lfsr,noise_out,' +
        'env_div,env_pos,env_shape,env_level,volume_a,volume_b,volume_c';

    for (let frame = 0; frame < trace.cycle.length; frame++) {
        let registers = '';
        const registerOffset = frame * YM2149_REGISTER_COUNT;
        for (let reg = 0; reg < YM2149_REGISTER_COUNT; reg++) {
            registers += trace.registers[registerOffset + reg].toString(16).padStart(2, '0');
        }
        const voiceOffset = frame * YM2149_VOICE_COUNT;
        rows[frame + 1] = [
            trace.cycle[frame], trace.output[frame], registers,
            trace.toneDivider[voiceOffset], trace.toneDivider[voiceOffset + 1], trace.toneDivider[voiceOffset + 2],
            trace.toneOutput[voiceOffset], trace.toneOutput[voiceOffset + 1], trace.toneOutput[voiceOffset + 2],
            trace.noiseDivider[frame], trace.noiseLfsr[frame], trace.noiseOutput[frame],
            trace.envelopeDivider[frame], trace.envelopePosition[frame], trace.envelopeShape[frame], trace.envelopeLevel[frame],
            trace.volume[voiceOffset], trace.volume[voiceOffset + 1], trace.volume[voiceOffset + 2]
        ].join(',');
    }
    return rows.join('\n') + '\n';
}
