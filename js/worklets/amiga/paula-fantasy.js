// === js/worklets/amiga/paula-fantasy.js ===
// ==========================================
// MOS TECHNOLOGY PAULA 8364 / AHI STUDIO CORE
// Audiophile Edition: 14-Bit Hermite Cubic Interpolation,
// Constant-Power Spatial Panning, Parametric Stereo Diffusion Reverb,
// Airband Presence Exciter & Dual-Channel 255-Tap Sinc-FIR Decimator
// Full Native Jochen Hippel COSO/HIPC Virtual Machine Support!
// ==========================================

import { CosoVirtualMachine } from '../lib/coso-vm.js';

class StudioStereoReverb {
    constructor(sampleRate) {
        const scale = sampleRate / 44100.0;
        this.combLenL = [1116, 1188, 1277, 1356].map(l => Math.max(8, Math.round(l * scale)));
        this.combLenR = [1139, 1211, 1300, 1379].map(l => Math.max(8, Math.round(l * scale)));

        this.combBufL = this.combLenL.map(len => new Float32Array(len));
        this.combBufR = this.combLenR.map(len => new Float32Array(len));

        this.combIdxL = [0, 0, 0, 0];
        this.combIdxR = [0, 0, 0, 0];

        this.combFiltL = [0, 0, 0, 0];
        this.combFiltR = [0, 0, 0, 0];

        this.feedback = 0.76;
        this.damp = 0.28;

        this.apLenL = [225, 556].map(l => Math.max(4, Math.round(l * scale)));
        this.apLenR = [248, 579].map(l => Math.max(4, Math.round(l * scale)));

        this.apBufL = this.apLenL.map(len => new Float32Array(len));
        this.apBufR = this.apLenR.map(len => new Float32Array(len));

        this.apIdxL = [0, 0];
        this.apIdxR = [0, 0];

        this.apFeedback = 0.5;
        this.wetGain = 0.20;
    }

    reset() {
        for (let i = 0; i < 4; i++) {
            this.combBufL[i].fill(0);
            this.combBufR[i].fill(0);
            this.combIdxL[i] = 0;
            this.combIdxR[i] = 0;
            this.combFiltL[i] = 0;
            this.combFiltR[i] = 0;
        }
        for (let i = 0; i < 2; i++) {
            this.apBufL[i].fill(0);
            this.apBufR[i].fill(0);
            this.apIdxL[i] = 0;
            this.apIdxR[i] = 0;
        }
    }

    process(inL, inR) {
        let combSumL = 0, combSumR = 0;

        for (let i = 0; i < 4; i++) {
            const bufL = this.combBufL[i];
            const idxL = this.combIdxL[i];
            const outL = bufL[idxL];

            this.combFiltL[i] = outL * (1.0 - this.damp) + this.combFiltL[i] * this.damp;
            bufL[idxL] = inL + this.combFiltL[i] * this.feedback;
            this.combIdxL[i] = (idxL + 1) % this.combLenL[i];
            combSumL += outL;

            const bufR = this.combBufR[i];
            const idxR = this.combIdxR[i];
            const outR = bufR[idxR];

            this.combFiltR[i] = outR * (1.0 - this.damp) + this.combFiltR[i] * this.damp;
            bufR[idxR] = inR + this.combFiltR[i] * this.feedback;
            this.combIdxR[i] = (idxR + 1) % this.combLenR[i];
            combSumR += outR;
        }

        let diffL = combSumL * 0.25;
        let diffR = combSumR * 0.25;
        const apOneMinusG2 = 1.0 - this.apFeedback * this.apFeedback;

        for (let i = 0; i < 2; i++) {
            const bufL = this.apBufL[i];
            const idxL = this.apIdxL[i];
            const delayedL = bufL[idxL];
            bufL[idxL] = diffL + delayedL * this.apFeedback;
            diffL = -this.apFeedback * diffL + delayedL * apOneMinusG2;
            this.apIdxL[i] = (idxL + 1) % this.apLenL[i];

            const bufR = this.apBufR[i];
            const idxR = this.apIdxR[i];
            const delayedR = bufR[idxR];
            bufR[idxR] = diffR + delayedR * this.apFeedback;
            diffR = -this.apFeedback * diffR + delayedR * apOneMinusG2;
            this.apIdxR[i] = (idxR + 1) % this.apLenR[i];
        }

        return [diffL * this.wetGain, diffR * this.wetGain];
    }
}

class PaulaFantasyChannel {
    constructor() {
        this.vol = 0;
        this.per = 428;
        this.data = null;
        this.pointer = 0;
        this.length = 0;
        this.repPointer = 0;
        this.repLength = 0;
        this.phase = 0;
        this.activeSample = 1;

        // DMA Hardware-Register Properties für COSO-VM
        this.audLc = 0x00020000;
        this.audLen = 16;
        this.audPer = 428;
        this.audVol = 0;
        this.dmaEnabled = false;

        this.targetPeriod = 0;
        this.basePeriod = 428;
        this.currentNote = 0;
        this.targetNote = 0;

        this.portamentoSpeed = 0;
        this.portamentoUpSpeed = 0;
        this.portamentoDownSpeed = 0;
        this.volSlideSpeed = 0;
        this.sampleOffset = 0;

        this.pan = 0.5;
        this.vibratoSpeed = 0;
        this.vibratoDepth = 0;
        this.vibratoPhase = 0;
        this.hasVibrato = false;

        this.lastPlayedSample = 0;
        this.patternLoopRow = 0;
        this.patternLoopCount = 0;

        // Hardware-DMA-Modus (COSO-VM): gemeinsames Chip-RAM + Reload aus AUDxLC/AUDxLEN
        this.hw = false;
        this.chipRam = null;
        this.prevByte = 0;
    }

    writeAUDxLC(address, dataBuffer, loopStartWords = 0, loopLengthWords = 0) {
        this.audLc = address & ~1;
        this.data = dataBuffer;
        this.repPointer = loopLengthWords > 1 ? (loopStartWords * 2) & ~1 : -1;
        this.repLength = loopLengthWords > 1 ? loopLengthWords * 2 : 0;
    }

    writeAUDxLEN(lengthWords) {
        this.audLen = lengthWords;
    }

    writeAUDxPER(period) {
        this.per = Math.max(113, period);
        this.audPer = this.per;
    }

    writeAUDxVOL(volume) {
        this.vol = Math.max(0, Math.min(64, volume));
        this.audVol = this.vol;
    }

    enableDMA(dataBuffer = null, loopStartWords = 0, loopLengthWords = 0) {
        this.hw = false;
        this.dmaEnabled = true;
        if (dataBuffer) this.data = dataBuffer;
        this.pointer = 0;
        this.phase = 0;

        const lenBytes = this.audLen * 2;
        this.length = (this.data && lenBytes <= this.data.length && lenBytes > 0) ? lenBytes : (this.data ? this.data.length : 0);

        if (loopLengthWords > 1) {
            this.repPointer = (loopStartWords * 2) & ~1;
            this.repLength = loopLengthWords * 2;
        } else {
            this.repPointer = -1;
            this.repLength = 0;
        }
    }

    disableDMA() {
        this.dmaEnabled = false;
        this.vol = 0;
        this.audVol = 0;
        this.data = null;
        this.length = 0;
    }

    trigger(data, loopStart, loopLen) {
        this.hw = false;
        this.data = data;
        this.pointer = 0;
        this.phase = 0;
        this.dmaEnabled = true;

        loopStart &= ~1;
        loopLen &= ~1;

        if (loopLen > 2) {
            if (loopStart >= data.length) loopStart = 0;
            if (loopStart + loopLen > data.length) loopLen = data.length - loopStart;
            this.length = loopStart + loopLen;
            this.repPointer = loopStart;
            this.repLength = loopLen;
        } else {
            this.length = data.length;
            this.repPointer = -1;
            this.repLength = 0;
        }
    }

    // ---------------------------------------------------------------
    // HARDWARE-DMA-API (v1.5.0, für COSO-VM)
    // Gemeinsames Chip-RAM + echte AUDxLC/AUDxLEN-Latch-Semantik (Reload am Pass-Ende).
    // Der MOD/XM-Pfad (writeAUDxLC/enableDMA/trigger) bleibt unverändert.
    // ---------------------------------------------------------------
    hwAttach(chipRam) {
        this.chipRam = chipRam;
    }

    hwWriteLC(address) {
        this.audLc = address & ~1;
    }

    hwWriteLEN(words) {
        this.audLen = (words === 0) ? 0x10000 : words;      // Hardware: LEN 0 = 65536 Words
    }

    hwStartDMA() {
        this.hw = true;
        this.dmaEnabled = true;
        this.data = this.chipRam;
        this.pointer = this.audLc;
        this.length = this.audLen * 2;
        this.phase = 0;
        this.prevByte = 0;
    }

    hwStopDMA() {
        this.dmaEnabled = false;
        this.length = 0;
    }

    // Hardware-Modus: Chip-RAM-Stream mit Reload aus gelatchten Registern. Die Hermite-Nachbarn folgen
    // dem STREAM (Loop-Naht, nächster Pass) statt in angrenzende Samples der Bank hineinzulesen.
    stepHw(clockTicksPerSample) {
        if (!this.dmaEnabled || this.vol === 0 || this.per === 0 || this.length <= 0) return 0;

        this.phase += clockTicksPerSample / this.per;
        while (this.phase >= 1.0) {
            this.phase -= 1.0;
            this.prevByte = this.data[this.pointer] | 0;
            this.pointer++;
            this.length--;
            if (this.length <= 0) {
                this.pointer = this.audLc;
                this.length = this.audLen * 2;
            }
        }

        const d = this.data;
        const p0 = this.prevByte;
        const p1 = d[this.pointer] | 0;
        let p2, p3;
        if (this.length > 2) {
            p2 = d[this.pointer + 1] | 0;
            p3 = d[this.pointer + 2] | 0;
        } else if (this.length === 2) {
            p2 = d[this.pointer + 1] | 0;
            p3 = d[this.audLc] | 0;
        } else {
            p2 = d[this.audLc] | 0;
            p3 = d[this.audLc + 1] | 0;
        }

        const mu = this.phase;
        const c0 = p1;
        const c1 = 0.5 * (p2 - p0);
        const c2 = p0 - 2.5 * p1 + 2.0 * p2 - 0.5 * p3;
        const c3 = 0.5 * (p3 - p0) + 1.5 * (p1 - p2);
        const interpolated = ((c3 * mu + c2) * mu + c1) * mu + c0;
        return (interpolated * Math.round(this.vol)) / 8128.0;
    }

    // 14-Bit Hermite Cubic Interpolation
    step(clockTicksPerSample) {
        if (this.hw) return this.stepHw(clockTicksPerSample);
        if (!this.dmaEnabled && this.data === null) return 0;
        if (!this.data || this.vol === 0 || this.per === 0 || this.length <= 0) return 0;

        this.phase += clockTicksPerSample / this.per;
        while (this.phase >= 1.0) {
            this.phase -= 1.0;
            this.pointer++;
            this.length--;

            if (this.length <= 0) {
                if (this.repPointer === -1) {
                    this.data = null;
                    this.dmaEnabled = false;
                    return 0;
                } else {
                    this.pointer = this.repPointer;
                    this.length = this.repLength;
                }
            }
        }

        if (!this.data) return 0;

        const idx = Math.floor(this.pointer);
        const mu = this.phase;

        const p0 = idx > 0 ? this.data[idx - 1] : this.data[idx];
        const p1 = this.data[idx] || 0;
        const p2 = (idx + 1 < this.data.length) ? this.data[idx + 1] : p1;
        const p3 = (idx + 2 < this.data.length) ? this.data[idx + 2] : p2;

        const c0 = p1;
        const c1 = 0.5 * (p2 - p0);
        const c2 = p0 - 2.5 * p1 + 2.0 * p2 - 0.5 * p3;
        const c3 = 0.5 * (p3 - p0) + 1.5 * (p1 - p2);

        const interpolated = ((c3 * mu + c2) * mu + c1) * mu + c0;
        const vol6 = Math.round(this.vol);

        return (interpolated * vol6) / 8128.0;
    }
}

class PaulaFantasyProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.clock = 3546895; // PAL Master Clock

        this.channels = [];
        for (let i = 0; i < 64; i++) {
            this.channels.push(new PaulaFantasyChannel());
        }

        this.samples = {};
        this.isPlaying = false;
        this.wasPlaying = false;
        this.wasAudible = false;
        this.visCounter = 0;
        this.visualView = new Float32Array(40);

        this.isSequenced = false;
        this.seqType = 'MOD';
        this.linearFreq = false;

        this.songLength = 0;
        this.orderTable = null;
        this.patterns = null;
        this.bpm = 125;
        this.speed = 6;
        this.numChannels = 4;

        this.currentOrder = 0;
        this.currentRow = 0;
        this.currentTick = 0;
        this.samplesUntilNextTick = 0;
        this.sampleCounter = 0;

        this.patternDelay = 0;
        this.breakPending = false;
        this.breakOrder = 0;
        this.breakRow = 0;

        this.cosoVM = null;

        this.reverb = new StudioStereoReverb(sampleRate);

        const fcAir = 8000.0;
        this.alphaAir = 1.0 - Math.exp(-2.0 * Math.PI * fcAir / sampleRate);
        this.airLpL = 0.0; this.airLpR = 0.0;

        this.port.onmessage = (e) => {
            const msg = e.data;
            if (msg.type === 'CLEAR_SAMPLES') {
                this.samples = {};
            } else if (msg.type === 'UPLOAD_SAMPLE') {
                if (msg.data && msg.data.data instanceof Int8Array) {
                    this.samples[msg.name] = msg.data;
                }
            } else if (msg.type === 'PLAY_TRACK') {
                const isHipc = msg.track && (msg.track.type === 'HIPC' || msg.track.type === 'COSO');
                const isXM = msg.track && msg.track.type === 'XM';
                this.linearFreq = msg.track ? (msg.track.linearFreq || false) : false;

                const hipcPannings = [0.25, 0.40, 0.60, 0.75, 0.30, 0.70, 0.50];

                this.reverb.reset();
                this.airLpL = 0.0;
                this.airLpR = 0.0;
                this.wasPlaying = false;
                this.wasAudible = false;
                this.visCounter = 0;
                this.visualView.fill(0);

                for (let i = 0; i < 64; i++) {
                    const ch = this.channels[i];
                    ch.disableDMA();
                    ch.hw = false;
                    ch.chipRam = null;
                    ch.prevByte = 0;
                    ch.audLc = 0x00020000;
                    ch.audLen = 16;
                    ch.audPer = 428;
                    ch.audVol = 0;
                    ch.per = 428;
                    ch.pointer = 0;
                    ch.length = 0;
                    ch.repPointer = 0;
                    ch.repLength = 0;
                    ch.phase = 0;
                    ch.activeSample = 1;

                    ch.targetPeriod = 0;
                    ch.basePeriod = 428;
                    ch.currentNote = 0;
                    ch.targetNote = 0;

                    ch.portamentoSpeed = 0;
                    ch.portamentoUpSpeed = 0;
                    ch.portamentoDownSpeed = 0;
                    ch.volSlideSpeed = 0;
                    ch.sampleOffset = 0;

                    ch.patternLoopRow = 0;
                    ch.patternLoopCount = 0;
                    ch.lastPlayedSample = 0;

                    ch.pan = isHipc
                        ? hipcPannings[i % 7]
                        : (isXM ? 0.5 : [0.30, 0.45, 0.55, 0.70][i % 4]);

                    ch.vibratoSpeed = 0;
                    ch.vibratoDepth = 0;
                    ch.vibratoPhase = 0;
                    ch.hasVibrato = false;
                }

                if (msg.track && msg.track.isSequenced) {
                    this.isSequenced = true;
                    this.seqType = msg.track.type;

                    if (this.seqType === 'HIPC' || this.seqType === 'COSO') {
                        this.cosoVM = new CosoVirtualMachine(
                            msg.track,
                            msg.track.samples || this.samples,
                            (logMsg) => this.port.postMessage({ type: 'LAB_LOG', msg: logMsg })
                        );
                        this.sampleCounter = 0;
                        this.numChannels = 4;
                        this.isPlaying = true;
                    } else {
                        this.cosoVM = null;
                        this.songLength = msg.track.songLength;
                        this.orderTable = msg.track.orderTable;
                        this.patterns = msg.track.patterns;
                        this.bpm = msg.track.bpm || 125;
                        this.speed = msg.track.speed || 6;
                        this.numChannels = msg.track.numChannels || 4;

                        this.currentOrder = 0;
                        this.currentRow = 0;
                        this.currentTick = 0;
                        this.samplesUntilNextTick = 0;
                        this.patternDelay = 0;
                        this.breakPending = false;
                        this.isPlaying = true;
                    }
                } else {
                    this.isSequenced = false;
                    this.cosoVM = null;
                    this.trackData = msg.track;
                    this.numChannels = 4;
                    this.currentFrame = 0;
                    this.sampleCounter = 0;
                    this.isPlaying = true;
                }
            } else if (msg.type === 'STOP_TRACK') {
                // Pause friert Kanal- und COSO-VM-Zustand unverändert für RESUME_TRACK ein.
                this.isPlaying = false;
            } else if (msg.type === 'RESUME_TRACK') {
                this.isPlaying = true;
            } else if (msg.type === 'SEEK_TRACK') {
                const targetFrame = Number.isFinite(msg.frame) ? Math.max(0, Math.trunc(msg.frame)) : 0;
                for (let i = 0; i < 64; i++) this.channels[i].disableDMA();
                this.samplesUntilNextTick = 0;
                this.patternDelay = 0;
                this.breakPending = false;

                if (this.isSequenced) {
                    if (this.seqType === 'HIPC' || this.seqType === 'COSO') {
                        this.sampleCounter = 0;
                        // Echtes Spulen auf den Ziel-Tick (statt immer zum Songanfang zu springen)
                        if (this.cosoVM) this.cosoVM.seekToTick(targetFrame);
                    } else if (this.songLength > 0 && this.orderTable && this.patterns) {
                        const stepSpeed = Math.max(1, this.speed || 6);
                        let totalTicks = 0;
                        for (let o = 0; o < this.songLength; o++) {
                            const pat = this.patterns[this.orderTable[o]];
                            totalTicks += (pat?.numRows || 64) * stepSpeed;
                        }
                        let remaining = totalTicks > 0 ? (targetFrame % totalTicks) : 0;
                        let order = 0;
                        while (order < this.songLength) {
                            const pat = this.patterns[this.orderTable[order]];
                            const orderTicks = (pat?.numRows || 64) * stepSpeed;
                            if (remaining < orderTicks) break;
                            remaining -= orderTicks;
                            order++;
                        }
                        this.currentOrder = order % this.songLength;
                        const pat = this.patterns[this.orderTable[this.currentOrder]];
                        const rows = pat?.numRows || 64;
                        this.currentRow = Math.min(rows - 1, Math.floor(remaining / stepSpeed));
                        this.currentTick = remaining % stepSpeed;
                    }
                } else if (this.trackData && this.trackData.length > 0) {
                    this.currentFrame = targetFrame % this.trackData.length;
                }
            }
        };
    }

    processTrackerTick(overshoot) {
        if (this.songLength <= 0 || !this.orderTable || !this.patterns) return;
        if (this.currentOrder >= this.songLength) {
            this.currentOrder = 0;
        }

        const patternIdx = this.orderTable[this.currentOrder];
        const patternObj = this.patterns[patternIdx];
        if (!patternObj) return;

        const pattern = patternObj.data;
        const numRows = patternObj.numRows;
        const rowOffset = this.currentRow * this.numChannels * 6;
        const clockTicksPerSample = this.clock / sampleRate;
        const smpPrefix = this.seqType.toLowerCase();

        for (let ch = 0; ch < this.numChannels; ch++) {
            const cellOffset = rowOffset + (ch * 6);
            const period = pattern[cellOffset] | (pattern[cellOffset + 1] << 8);
            const sample = pattern[cellOffset + 2];
            const volume = pattern[cellOffset + 3];
            const effect = pattern[cellOffset + 4];
            const param = pattern[cellOffset + 5];

            const channel = this.channels[ch];

            if (sample > 0) {
                channel.activeSample = sample;
            }

            const activeSample = channel.activeSample || 1;
            const smpName = `${smpPrefix}_sample_${activeSample}`;
            let currentSmpObj = this.samples[smpName];
            if (!currentSmpObj) {
                currentSmpObj = this.samples[`mod_sample_${activeSample}`] ||
                                this.samples[`xm_sample_${activeSample}`] ||
                                this.samples[`hipc_sample_${activeSample}`] ||
                                this.samples[`dw_sample_${activeSample}`];
            }

            const isSampleChange = (sample > 0 && sample !== channel.lastPlayedSample);
            const isPortamento = (effect === 0x03 || effect === 0x05) && (channel.data !== null) &&
                                 (this.seqType === 'XM' ? true : !isSampleChange);

            if (this.currentTick === 0) {
                const hasNote = (period > 0 && period !== 97);

                if (channel.dmaEnabled && channel.basePeriod > 0) {
                    channel.per = channel.basePeriod;
                }

                if (hasNote) {
                    let calculatedPeriod = period;
                    let actualNote = 0;

                    if (this.seqType === 'XM') {
                        const relNote = currentSmpObj ? (currentSmpObj.relNote || 0) : 0;
                        const finetune = currentSmpObj ? (currentSmpObj.finetune || 0) : 0;
                        actualNote = period + relNote + (finetune / 128.0);
                        const clampedNote = Math.min(96, Math.max(1, actualNote));
                        calculatedPeriod = Math.round(428.0 * Math.pow(2.0, (49 - clampedNote) / 12.0));
                    }

                    if (isPortamento) {
                        channel.targetPeriod = calculatedPeriod;
                        channel.targetNote = actualNote;
                    } else {
                        channel.per = calculatedPeriod;
                        channel.basePeriod = calculatedPeriod;
                        channel.targetPeriod = 0;
                        channel.currentNote = actualNote;
                        channel.targetNote = 0;
                    }
                }

                if (hasNote && currentSmpObj && currentSmpObj.data) {
                    if (!isPortamento) {
                        channel.trigger(currentSmpObj.data, currentSmpObj.loopStart, currentSmpObj.loopLen);
                        channel.phase = overshoot * (clockTicksPerSample / channel.per);

                        if (effect === 0x09) {
                            if (param > 0) channel.sampleOffset = param * 256;
                            const offset = channel.sampleOffset & ~1;
                            if (offset >= channel.length) {
                                channel.dmaEnabled = false;
                                channel.data = null;
                                channel.length = 0;
                            } else {
                                channel.pointer = offset;
                                channel.length -= offset;
                            }
                        }
                    }
                    if (sample > 0) {
                        channel.lastPlayedSample = sample;
                    }
                }

                if (sample > 0 && currentSmpObj) {
                    channel.vol = currentSmpObj.baseVolume;
                    if (currentSmpObj.pan !== undefined) {
                        channel.pan = currentSmpObj.pan / 255.0;
                    }
                }

                if (period === 97) channel.vol = 0;

                if (volume !== 0xFF) {
                    if (volume >= 0xC0 && volume <= 0xCF) {
                        channel.pan = (volume - 0xC0) / 15.0;
                    } else if (volume <= 64) {
                        channel.vol = volume;
                    }
                }

                if (effect !== 0x04 && effect !== 0x06) {
                    channel.hasVibrato = false;
                }

                switch (effect) {
                    case 0x01: if (param > 0) channel.portamentoUpSpeed = param; break;
                    case 0x02: if (param > 0) channel.portamentoDownSpeed = param; break;
                    case 0x03: if (param > 0) channel.portamentoSpeed = param; break;
                    case 0x04:
                        if (param > 0) {
                            if ((param >> 4) > 0) channel.vibratoSpeed = (param >> 4) & 0x0F;
                            if ((param & 0x0F) > 0) channel.vibratoDepth = param & 0x0F;
                        }
                        channel.hasVibrato = true;
                        break;
                    case 0x05:
                    case 0x0A:
                        if (param > 0) channel.volSlideSpeed = param;
                        break;
                    case 0x06:
                        if (param > 0) channel.volSlideSpeed = param;
                        channel.hasVibrato = true;
                        break;
                    case 0x08:
                        channel.pan = param / 255.0;
                        break;
                    case 0x0C:
                        channel.vol = param > 64 ? 64 : param;
                        break;
                    case 0x0F:
                        if (param > 0) {
                            if (param < 32) this.speed = param;
                            else this.bpm = param;
                        }
                        break;
                    case 0x0B:
                        this.breakOrder = param;
                        this.breakRow = 0;
                        this.breakPending = true;
                        break;
                    case 0x0D:
                        this.breakOrder = this.currentOrder + 1;
                        this.breakRow = ((param >> 4) * 10) + (param & 0x0F);
                        this.breakPending = true;
                        break;
                    case 0x0E: {
                        const subEffect = param >> 4;
                        const subParam = param & 0x0F;
                        if (subEffect === 0x08) {
                            channel.pan = subParam / 15.0;
                        } else if (subEffect === 0x0A) {
                            channel.vol = Math.min(64, channel.vol + subParam);
                        } else if (subEffect === 0x0B) {
                            channel.vol = Math.max(0, channel.vol - subParam);
                        } else if (subEffect === 0x01) {
                            if (this.seqType === 'XM' && this.linearFreq) {
                                channel.currentNote = Math.min(96, channel.currentNote + (subParam / 16.0));
                                channel.per = Math.round(428.0 * Math.pow(2.0, (49 - channel.currentNote) / 12.0));
                            } else if (channel.per > 0) {
                                channel.per = Math.max(113, channel.per - subParam);
                            }
                            channel.basePeriod = channel.per;
                        } else if (subEffect === 0x02) {
                            if (this.seqType === 'XM' && this.linearFreq) {
                                channel.currentNote = Math.max(1, channel.currentNote - (subParam / 16.0));
                                channel.per = Math.round(428.0 * Math.pow(2.0, (49 - channel.currentNote) / 12.0));
                            } else if (channel.per > 0) {
                                channel.per = Math.min(856, channel.per + subParam);
                            }
                            channel.basePeriod = channel.per;
                        } else if (subEffect === 0x0E) {
                            this.patternDelay = subParam;
                        } else if (subEffect === 0x06) {
                            if (subParam === 0) {
                                channel.patternLoopRow = this.currentRow;
                            } else {
                                if (channel.patternLoopCount === 0) channel.patternLoopCount = subParam;
                                else channel.patternLoopCount--;
                                if (channel.patternLoopCount > 0) {
                                    this.breakOrder = this.currentOrder;
                                    this.breakRow = channel.patternLoopRow;
                                    this.breakPending = true;
                                }
                            }
                        }
                        break;
                    }
                }
            } else {
                switch (effect) {
                    case 0x00:
                        if (param > 0 && channel.per > 0) {
                            const arpOffsets = [0, (param >> 4) & 0x0F, param & 0x0F];
                            const currentOffset = arpOffsets[this.currentTick % 3];
                            if (this.seqType === 'XM' && this.linearFreq) {
                                const arpNote = channel.currentNote + currentOffset;
                                const clampedNote = Math.min(96, Math.max(1, arpNote));
                                channel.per = Math.round(428.0 * Math.pow(2.0, (49 - clampedNote) / 12.0));
                            } else {
                                const base = (period > 0 && period !== 97) ? period : channel.basePeriod;
                                channel.per = base * Math.pow(2.0, -currentOffset / 12.0);
                            }
                        }
                        break;
                    case 0x01:
                        if (this.seqType === 'XM' && this.linearFreq) {
                            channel.currentNote = Math.min(96, channel.currentNote + (channel.portamentoUpSpeed / 16.0));
                            channel.per = Math.round(428.0 * Math.pow(2.0, (49 - channel.currentNote) / 12.0));
                        } else if (channel.per > 0) {
                            channel.per = Math.max(113, channel.per - channel.portamentoUpSpeed);
                        }
                        channel.basePeriod = channel.per;
                        break;
                    case 0x02:
                        if (this.seqType === 'XM' && this.linearFreq) {
                            channel.currentNote = Math.max(1, channel.currentNote - (channel.portamentoDownSpeed / 16.0));
                            channel.per = Math.round(428.0 * Math.pow(2.0, (49 - channel.currentNote) / 12.0));
                        } else if (channel.per > 0) {
                            channel.per = Math.min(856, channel.per + channel.portamentoDownSpeed);
                        }
                        channel.basePeriod = channel.per;
                        break;
                    case 0x03:
                    case 0x05:
                        if (this.seqType === 'XM' && this.linearFreq) {
                            if (channel.targetNote > 0 && channel.currentNote !== channel.targetNote) {
                                const slideAmount = channel.portamentoSpeed / 16.0;
                                if (channel.currentNote < channel.targetNote) {
                                    channel.currentNote = Math.min(channel.targetNote, channel.currentNote + slideAmount);
                                } else {
                                    channel.currentNote = Math.max(channel.targetNote, channel.currentNote - slideAmount);
                                }
                                const clampedNote = Math.min(96, Math.max(1, channel.currentNote));
                                channel.per = Math.round(428.0 * Math.pow(2.0, (49 - clampedNote) / 12.0));
                                channel.basePeriod = channel.per;
                            }
                        } else {
                            if (channel.targetPeriod > 0 && channel.per !== channel.targetPeriod) {
                                if (channel.per < channel.targetPeriod) {
                                    channel.per = Math.min(channel.targetPeriod, channel.per + channel.portamentoSpeed);
                                } else {
                                    channel.per = Math.max(channel.targetPeriod, channel.per - channel.portamentoSpeed);
                                }
                                channel.basePeriod = channel.per;
                            }
                        }
                        if (effect === 0x05) {
                            const slideUp = (channel.volSlideSpeed >> 4) & 0x0F;
                            const slideDown = channel.volSlideSpeed & 0x0F;
                            if (slideUp > 0) channel.vol = Math.min(64, channel.vol + slideUp);
                            else if (slideDown > 0) channel.vol = Math.max(0, channel.vol - slideDown);
                        }
                        break;
                    case 0x04:
                    case 0x06:
                        if (channel.hasVibrato) {
                            channel.vibratoPhase = (channel.vibratoPhase + channel.vibratoSpeed) & 63;
                            const vibSine = Math.sin(channel.vibratoPhase * (Math.PI / 32));
                            if (this.seqType === 'XM' && this.linearFreq) {
                                const vibOffsetNotes = vibSine * (channel.vibratoDepth / 16.0);
                                const clampedNote = Math.min(96, Math.max(1, channel.currentNote + vibOffsetNotes));
                                channel.per = Math.round(428.0 * Math.pow(2.0, (49 - clampedNote) / 12.0));
                            } else {
                                const vibOffset = vibSine * channel.vibratoDepth * 2.5;
                                channel.per = Math.max(113, Math.min(856, Math.round(channel.basePeriod + vibOffset)));
                            }
                        }
                        if (effect === 0x06) {
                            const slideUp = (channel.volSlideSpeed >> 4) & 0x0F;
                            const slideDown = channel.volSlideSpeed & 0x0F;
                            if (slideUp > 0) channel.vol = Math.min(64, channel.vol + slideUp);
                            else if (slideDown > 0) channel.vol = Math.max(0, channel.vol - slideDown);
                        }
                        break;
                    case 0x0A: {
                        const slideUp = (channel.volSlideSpeed >> 4) & 0x0F;
                        const slideDown = channel.volSlideSpeed & 0x0F;
                        if (slideUp > 0) channel.vol = Math.min(64, channel.vol + slideUp);
                        else if (slideDown > 0) channel.vol = Math.max(0, channel.vol - slideDown);
                        break;
                    }
                }
            }
        }

        this.currentTick++;
        if (this.currentTick >= this.speed * (this.patternDelay + 1)) {
            this.currentTick = 0;
            this.patternDelay = 0;
            if (this.breakPending) {
                this.currentOrder = this.songLength > 0 ? (this.breakOrder % this.songLength) : 0;
                const nextPat = this.patterns[this.orderTable[this.currentOrder]];
                const nextRows = nextPat ? nextPat.numRows : 64;
                this.currentRow = (this.breakRow >= 0 && this.breakRow < nextRows) ? this.breakRow : 0;
                this.breakPending = false;
            } else {
                this.currentRow++;
                if (this.currentRow >= numRows) {
                    this.currentRow = 0;
                    this.currentOrder++;
                }
            }
        }
    }

    process(inputs, outputs) {
        const outL = outputs[0][0];
        const outR = outputs[0].length > 1 ? outputs[0][1] : null;
        let oscValue = 0;

        const clockTicksPerSample = this.clock / sampleRate;

        for (let i = 0; i < outL.length; i++) {
            if (!this.isPlaying) {
                outL[i] = 0; if (outR) outR[i] = 0;
                continue;
            }

            if (this.isSequenced) {
                if (this.seqType === 'HIPC' || this.seqType === 'COSO') {
                    this.sampleCounter--;
                    if (this.sampleCounter <= 0) {
                        this.sampleCounter += sampleRate / 50.0;
                        if (this.cosoVM) {
                            this.cosoVM.processTick(this.channels);
                        }
                    }
                } else {
                    this.samplesUntilNextTick--;
                    if (this.samplesUntilNextTick <= 0) {
                        const overshoot = -this.samplesUntilNextTick;
                        this.processTrackerTick(overshoot);
                        const samplesPerTick = (2.5 / this.bpm) * sampleRate;
                        this.samplesUntilNextTick += samplesPerTick;
                    }
                }
            } else if (this.trackData && this.trackData.length > 0) {
                this.sampleCounter--;
                if (this.sampleCounter <= 0) {
                    this.sampleCounter += sampleRate / 50.0;
                    const frame = this.trackData[this.currentFrame];
                    if (frame && frame.cmds) {
                        for (const cmd of frame.cmds) {
                            const ch = this.channels[cmd.ch];
                            if (cmd.smp) {
                                const sampleObj = this.samples[cmd.smp];
                                if (sampleObj && sampleObj.data) {
                                    ch.trigger(sampleObj.data, sampleObj.loopStart, sampleObj.loopLen);
                                }
                            }
                            if (cmd.per !== undefined) ch.per = cmd.per;
                            if (cmd.vol !== undefined) ch.vol = cmd.vol;
                        }
                    }
                    this.currentFrame = (this.currentFrame + 1) % this.trackData.length;
                }
            }

            // 14-Bit AHI Hermite Mixing & Spatial Staging
            let mixedL = 0, mixedR = 0;

            for (let c = 0; c < this.numChannels; c++) {
                const sampleVal = this.channels[c].step(clockTicksPerSample);
                if (sampleVal !== 0) {
                    const pan = this.channels[c].pan;
                    mixedL += sampleVal * Math.cos(pan * Math.PI * 0.5);
                    mixedR += sampleVal * Math.sin(pan * Math.PI * 0.5);
                }
            }

            if (this.numChannels > 4) {
                const mixAtten = Math.sqrt(4.0 / this.numChannels);
                mixedL *= mixAtten;
                mixedR *= mixAtten;
            }

            // Airband Presence Exciter (> 8 kHz)
            this.airLpL += this.alphaAir * (mixedL - this.airLpL);
            this.airLpR += this.alphaAir * (mixedR - this.airLpR);
            const airHighL = mixedL - this.airLpL;
            const airHighR = mixedR - this.airLpR;

            const brightL = mixedL + airHighL * 0.35;
            const brightR = mixedR + airHighR * 0.35;

            // Parametrischer Stereo-Reverb
            const [revL, revR] = this.reverb.process(brightL, brightR);

            const studioL = brightL * 0.88 + revL;
            const studioR = brightR * 0.88 + revR;

            const finalL = Math.tanh(studioL * 1.05) * 0.92;
            const finalR = Math.tanh(studioR * 1.05) * 0.92;

            if (outR) {
                outL[i] = finalL;
                outR[i] = finalR;
            } else {
                outL[i] = (finalL + finalR) * 0.5;
            }

            if (i === 0) oscValue = (finalL + finalR) * 0.5;
        }

        this.visCounter++;
        if (this.visCounter % 4 === 0) {
            const isAudible = Math.abs(oscValue) > 0.001;
            if (this.isPlaying || this.wasPlaying || isAudible || this.wasAudible) {
                const view = this.visualView;
                view[0] = 1; // Amiga
                view[1] = this.isPlaying ? 1 : 0;
                view[2] = this.isSequenced
                    ? (this.seqType === 'HIPC' || this.seqType === 'COSO' ? (this.cosoVM ? this.cosoVM.position : 0) : (this.currentOrder * 64 * this.speed + this.currentRow * this.speed + this.currentTick))
                    : this.currentFrame;
                view[3] = oscValue;

                for (let c = 0; c < 4; c++) {
                    const offset = c * 7;
                    const ch = this.channels[c];
                    const simulatedAddress = ch.audLc || (ch.data ? 0x00020000 + c * 0x4000 + Math.floor(ch.pointer) : 0);
                    view[4 + offset] = (simulatedAddress >> 8) & 0xFF;
                    view[4 + offset + 1] = simulatedAddress & 0xFF;
                    const len = ch.audLen || (ch.data ? Math.floor(ch.data.length / 2) : 0);
                    view[4 + offset + 2] = (len >> 8) & 0xFF;
                    view[4 + offset + 3] = len & 0xFF;
                    view[4 + offset + 4] = (ch.per >> 8) & 0xFF;
                    view[4 + offset + 5] = ch.per & 0xFF;
                    view[4 + offset + 6] = Math.round(ch.vol) & 0xFF;
                }

                view[33] = 2.0; // Filter state: not modeled by this core.

                let dmaMask = 0;
                for (let c = 0; c < 4; c++) {
                    const ch = this.channels[c];
                    view[34 + c] = (ch.data || ch.dmaEnabled) ? (ch.vol / 64.0) : 0.0;
                    if (ch.dmaEnabled) dmaMask |= 1 << c;
                }

                view[38] = 0.0;
                view[39] = dmaMask;

                this.port.postMessage(view);
            }
            this.wasAudible = isAudible;
            this.wasPlaying = this.isPlaying;
        }
        return true;
    }
}

registerProcessor('paula-fantasy-processor', PaulaFantasyProcessor);