// Deterministic, DOM-free SID measurement harness.
// Writes are applied at the start of their cycle, followed by one SID clock.
// The raw tap is SIDChip.outputSample: no resampler, motherboard or master DSP.

import { SIDChip } from './sid-chip.js';

export const SID_PAL_CLOCK = 985248;
export const SID_REGISTER_COUNT = 29;
export const SID_VOICE_COUNT = 3;

function positiveInteger(value, name, allowZero = false) {
    if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) {
        throw new RangeError(`${name} must be ${allowZero ? 'a non-negative' : 'a positive'} safe integer`);
    }
}

export class SidOfflineHarness {
    constructor({
        cycles,
        events = [],
        clock = SID_PAL_CLOCK,
        traceStride = 1,
        vcfOffset = 0,
        temperature = 55
    }) {
        positiveInteger(cycles, 'cycles', true);
        positiveInteger(clock, 'clock');
        positiveInteger(traceStride, 'traceStride');
        if (cycles > 0xFFFFFFFF) throw new RangeError('cycles must fit the uint32 trace format');
        if (!Array.isArray(events)) throw new TypeError('events must be an array');
        if (!Number.isFinite(vcfOffset) || !Number.isFinite(temperature)) {
            throw new TypeError('vcfOffset and temperature must be finite numbers');
        }

        this.cycles = cycles;
        this.clock = clock;
        this.traceStride = traceStride;
        this.raw = new Float32Array(cycles);

        // Event normalization and validation happen only during setup.
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
            if (!Number.isInteger(event.register) || event.register < 0 || event.register >= SID_REGISTER_COUNT) {
                throw new RangeError(`event ${ordered[i].index} has an invalid register`);
            }
            if (!Number.isInteger(event.value) || event.value < 0 || event.value > 255) {
                throw new RangeError(`event ${ordered[i].index} has an invalid value`);
            }
            this.eventCycles[i] = event.cycle;
            this.eventRegisters[i] = event.register;
            this.eventValues[i] = event.value;
        }

        this.sid = new SIDChip(vcfOffset);
        this.sid.temperature = temperature;

        this.frameCount = Math.ceil(cycles / traceStride);
        this.trace = {
            stride: traceStride,
            cycle: new Uint32Array(this.frameCount),
            output: new Float32Array(this.frameCount),
            filterLow: new Float32Array(this.frameCount),
            filterBand: new Float32Array(this.frameCount),
            activeCutoff: new Float32Array(this.frameCount),
            registers: new Uint8Array(this.frameCount * SID_REGISTER_COUNT),
            phase: new Uint32Array(this.frameCount * SID_VOICE_COUNT),
            waveform: new Uint16Array(this.frameCount * SID_VOICE_COUNT),
            envelope: new Uint8Array(this.frameCount * SID_VOICE_COUNT),
            envelopeState: new Uint8Array(this.frameCount * SID_VOICE_COUNT),
            rateCounter: new Uint16Array(this.frameCount * SID_VOICE_COUNT),
            exponentialCounter: new Uint16Array(this.frameCount * SID_VOICE_COUNT),
            lfsr: new Uint32Array(this.frameCount * SID_VOICE_COUNT)
        };
    }

    run() {
        const sid = this.sid;
        const trace = this.trace;
        const stride = this.traceStride;
        const voices = sid.voices;
        let eventIndex = 0;
        let frame = 0;

        // No allocations in the cycle loop; all trace storage is preallocated.
        for (let cycle = 0; cycle < this.cycles; cycle++) {
            while (eventIndex < this.eventCycles.length && this.eventCycles[eventIndex] === cycle) {
                sid.writeReg(this.eventRegisters[eventIndex], this.eventValues[eventIndex]);
                eventIndex++;
            }

            sid.clock();
            this.raw[cycle] = sid.outputSample;

            if (cycle % stride === 0) {
                const voiceOffset = frame * SID_VOICE_COUNT;
                trace.cycle[frame] = cycle;
                trace.output[frame] = sid.outputSample;
                trace.filterLow[frame] = sid.filterLow;
                trace.filterBand[frame] = sid.filterBand;
                trace.activeCutoff[frame] = sid.activeCutoff;
                trace.registers.set(sid.regs, frame * SID_REGISTER_COUNT);

                for (let voice = 0; voice < SID_VOICE_COUNT; voice++) {
                    const state = voices[voice];
                    const index = voiceOffset + voice;
                    trace.phase[index] = state.phase;
                    trace.waveform[index] = state.waveOut12Bit;
                    trace.envelope[index] = state.envelope_counter;
                    trace.envelopeState[index] = state.state;
                    trace.rateCounter[index] = state.rate_counter;
                    trace.exponentialCounter[index] = state.exponential_counter;
                    trace.lfsr[index] = state.lfsr;
                }
                frame++;
            }
        }
        return this;
    }
}

export function renderSidOffline(options) {
    return new SidOfflineHarness(options).run();
}

// IEEE-float WAV preserves the unquantized raw tap for external analysis.
export function encodeSidWav(samples, sampleRate = SID_PAL_CLOCK) {
    positiveInteger(sampleRate, 'sampleRate');
    if (!(samples instanceof Float32Array)) throw new TypeError('samples must be a Float32Array');

    const bytes = 44 + samples.length * 4;
    const wav = new Uint8Array(bytes);
    const view = new DataView(wav.buffer);
    view.setUint32(0, 0x46464952, false); // RIFF
    view.setUint32(4, bytes - 8, true);
    view.setUint32(8, 0x45564157, false); // WAVE
    view.setUint32(12, 0x20746D66, false); // "fmt " chunk
    view.setUint32(16, 16, true);
    view.setUint16(20, 3, true); // IEEE float
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 4, true);
    view.setUint16(32, 4, true);
    view.setUint16(34, 32, true);
    view.setUint32(36, 0x61746164, false); // data
    view.setUint32(40, samples.length * 4, true);
    for (let i = 0; i < samples.length; i++) view.setFloat32(44 + i * 4, samples[i], true);
    return wav;
}

export function sidTraceToCsv(harness) {
    const trace = harness.trace;
    const rows = new Array(trace.cycle.length + 1);
    rows[0] = 'cycle,output,filter_low,filter_band,active_cutoff,registers_hex,' +
        'v0_phase,v0_wave,v0_env,v0_env_state,v0_rate,v0_exp,v0_lfsr,' +
        'v1_phase,v1_wave,v1_env,v1_env_state,v1_rate,v1_exp,v1_lfsr,' +
        'v2_phase,v2_wave,v2_env,v2_env_state,v2_rate,v2_exp,v2_lfsr';

    for (let frame = 0; frame < trace.cycle.length; frame++) {
        let registers = '';
        const registerOffset = frame * SID_REGISTER_COUNT;
        for (let reg = 0; reg < SID_REGISTER_COUNT; reg++) {
            registers += trace.registers[registerOffset + reg].toString(16).padStart(2, '0');
        }
        const voiceOffset = frame * SID_VOICE_COUNT;
        const values = [
            trace.cycle[frame], trace.output[frame], trace.filterLow[frame],
            trace.filterBand[frame], trace.activeCutoff[frame], registers
        ];
        for (let voice = 0; voice < SID_VOICE_COUNT; voice++) {
            const index = voiceOffset + voice;
            values.push(
                trace.phase[index], trace.waveform[index], trace.envelope[index],
                trace.envelopeState[index], trace.rateCounter[index],
                trace.exponentialCounter[index], trace.lfsr[index]
            );
        }
        rows[frame + 1] = values.join(',');
    }
    return rows.join('\n') + '\n';
}
