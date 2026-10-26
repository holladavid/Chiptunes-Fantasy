// === js/worklets/atari/ym-exact.js ===
// =========================================================
// YM2149F CORE (CYCLE-EXACT 2MHz, LOG-DAC, TRUE 5-BIT ENV)
// Master Edition: 32-Phase Polyphase Sinc-FIR Decimator (255 Taps @ 12.5kHz),
// Open-Collector Non-Linear Summing Bus Compression ("Atari Bus Glue"),
// 64-Step Envelope State Machine & Digidrum DAC Injection
// =========================================================

import { detectDigidrum, detectDigidrumVoice, AtariAnalogFilter } from '../lib/dsp-utils.js';
import { YM2149Core } from '../lib/ym2149-core.js';
import { YMVisualizer } from '../lib/ym-visualizer.js';

class YMExactProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.clock = 2000000; // 2.0 MHz Atari ST Master Clock
        this.core = new YM2149Core(this.clock);
        this.regs = this.core.regs;

        this.digidrums = [];
        this.currentDigidrum = null;
        this.digiPos = 0;
        this.lastDigiTrigger = 0;

        this.hijackedVoice = 0;
        this.hijackReleaseVol = 0;

        this.trackData = null;
        this.currentFrame = 0;
        this.sampleCounter = 0;
        this.isPlaying = false;

        this.cycleAccumulator = 0.0;

        this.volA = 0.0; this.volB = 0.0; this.volC = 0.0;
        this.visualizer = new YMVisualizer(this.port);

        // =========================================================
        // DSP UPGRADE: 32-PHASE POLYPHASE SINC-FIR FILTERBANK (255 Taps)
        // Brickwall-Filterung bei 12.5 kHz auf der 2-MHz-Ebene
        // =========================================================
        this.FIR_TAPS = 255;
        this.NUM_PHASES = 32;
        this.polyphaseTable = new Float32Array(this.NUM_PHASES * this.FIR_TAPS);
        this.ringBuffer = new Float32Array(512);
        this.ringIndex = 0;

        const fc = 12500.0 / this.clock;
        const halfK = (this.FIR_TAPS - 1) / 2;

        for (let p = 0; p < this.NUM_PHASES; p++) {
            const dt = p / this.NUM_PHASES; // Sub-Zyklus Phasen-Offset [0.0 .. 0.96875]
            let sum = 0.0;
            const phaseOffset = p * this.FIR_TAPS;

            for (let i = 0; i < this.FIR_TAPS; i++) {
                const x = (i - halfK) - dt;
                const sinc = (Math.abs(x) < 1e-7) ? (2 * Math.PI * fc) : Math.sin(2 * Math.PI * fc * x) / x;
                const wPos = (i - dt) / (this.FIR_TAPS - 1);
                const window = (wPos >= 0.0 && wPos <= 1.0)
                    ? (0.42 - 0.5 * Math.cos(2 * Math.PI * wPos) + 0.08 * Math.cos(4 * Math.PI * wPos))
                    : 0.0;

                const val = sinc * window;
                this.polyphaseTable[phaseOffset + i] = val;
                sum += val;
            }

            if (sum > 0) {
                for (let i = 0; i < this.FIR_TAPS; i++) {
                    this.polyphaseTable[phaseOffset + i] /= sum;
                }
            }
        }

        this.analogOut = new AtariAnalogFilter(sampleRate);
        this.outLp = 0;
        this.fadeVol = 0.0;

        this.port.onmessage = (event) => {
            const msg = event.data;
            if (msg.type === 'PLAY_TRACK') {
                this.core.reset();
                this.trackData = msg.track;
                this.digidrums = msg.digidrums || [];
                this.currentFrame = 0;
                this.sampleCounter = 0;
                this.currentDigidrum = null;
                this.digiPos = 0;
                this.lastDigiTrigger = 0;
                this.hijackedVoice = 0;
                this.hijackReleaseVol = 0;
                this.cycleAccumulator = 0;
                this.isPlaying = true;

                this.ringBuffer.fill(0);
                this.ringIndex = 0;
                this.outLp = 0;
                this.fadeVol = 0;
                this.volA = 0;
                this.volB = 0;
                this.volC = 0;
                this.analogOut = new AtariAnalogFilter(sampleRate);
            } else if (msg.type === 'STOP_TRACK') {
                this.isPlaying = false;
            } else if (msg.type === 'RESUME_TRACK') {
                this.isPlaying = true;
            } else if (msg.type === 'SEEK_TRACK') {
                if (this.trackData) {
                    this.currentFrame = msg.frame % this.trackData.length;
                    this.currentDigidrum = null;
                }
            }
        };
    }

    process(inputs, outputs) {
        const outL = outputs[0][0];
        const outR = outputs[0].length > 1 ? outputs[0][1] : null;
        let currentVisualValue = 0;

        for (let i = 0; i < outL.length; i++) {

            if (this.isPlaying) this.fadeVol = Math.min(1.0, this.fadeVol + 0.002);
            else this.fadeVol = Math.max(0.0, this.fadeVol - 0.002);

            if (this.fadeVol === 0.0) {
                let idleSample = this.analogOut.process(0);
                outL[i] = idleSample; if (outR) outR[i] = idleSample;
                continue;
            }

            let decimationSum = 0;

            if (this.isPlaying && this.trackData && this.trackData.length > 0) {
                this.cycleAccumulator += this.clock / sampleRate;
                let cyclesToRun = Math.floor(this.cycleAccumulator);
                this.cycleAccumulator -= cyclesToRun;

                // Sub-Cycle Phasen-Index [0 .. 31]
                let phaseIdx = Math.floor(this.cycleAccumulator * this.NUM_PHASES);
                if (phaseIdx >= this.NUM_PHASES) phaseIdx = this.NUM_PHASES - 1;
                let kernelBase = phaseIdx * this.FIR_TAPS;

                this.sampleCounter--;
                if (this.sampleCounter <= 0) {
                    this.sampleCounter += sampleRate / 50.0;

                    let frame = this.trackData[this.currentFrame];
                    for (let r = 0; r < 16; r++) {
                        this.core.writeRegister(r, frame[r]);
                    }

                    let activeDigiTrigger = detectDigidrum(frame);
                    let activeDigiVoice = detectDigidrumVoice(frame);

                    if (activeDigiTrigger > 0 && activeDigiTrigger !== this.lastDigiTrigger) {
                        if (this.digidrums[activeDigiTrigger - 1]) {
                            this.currentDigidrum = this.digidrums[activeDigiTrigger - 1];
                            this.digiPos = 0;

                            if (activeDigiVoice > 0) {
                                this.hijackedVoice = activeDigiVoice;
                                if (activeDigiVoice === 1) this.hijackReleaseVol = frame[8];
                                else if (activeDigiVoice === 2) this.hijackReleaseVol = frame[9];
                                else if (activeDigiVoice === 3) this.hijackReleaseVol = frame[10];
                            }
                            this.port.postMessage({ type: 'DEBUG', msg: 'Drum ' + activeDigiTrigger });
                        }
                    }
                    this.lastDigiTrigger = activeDigiTrigger;

                    if (this.hijackedVoice === 1 && frame[8] !== this.hijackReleaseVol) this.hijackedVoice = 0;
                    if (this.hijackedVoice === 2 && frame[9] !== this.hijackReleaseVol) this.hijackedVoice = 0;
                    if (this.hijackedVoice === 3 && frame[10] !== this.hijackReleaseVol) this.hijackedVoice = 0;

                    this.currentFrame = (this.currentFrame + 1) % this.trackData.length;
                }

                // =========================================================
                // 2.0 MHz CYCLE-EXACT LOCKSTEP LOOP
                // =========================================================
                for (let c = 0; c < cyclesToRun; c++) {
                    let digiVal5Bit = -1;
                    if (this.currentDigidrum) {
                        let posInt = Math.floor(this.digiPos);
                        if (posInt < this.currentDigidrum.length) {
                            let floatSample = this.currentDigidrum[posInt];
                            digiVal5Bit = Math.floor((floatSample + 1.0) * 15.5);
                            this.digiPos += (7812.5 / this.clock);
                        } else {
                            this.currentDigidrum = null;
                        }
                    }

                    const mixedSample = this.core.clockCycle(digiVal5Bit, this.hijackedVoice);
                    this.volA = this.core.volA;
                    this.volB = this.core.volB;
                    this.volC = this.core.volC;
                    this.ringBuffer[this.ringIndex] = mixedSample;
                    this.ringIndex = (this.ringIndex + 1) & 511;
                }

                // =========================================================
                // FRACTIONAL POLYPHASE SINC-FIR CONVOLUTION (2MHz -> 48kHz)
                // =========================================================
                let firIdx = (this.ringIndex - 1) & 511;
                for (let k = 0; k < this.FIR_TAPS; k++) {
                    decimationSum += this.ringBuffer[firIdx] * this.polyphaseTable[kernelBase + k];
                    firIdx = (firIdx - 1) & 511;
                }
            }

            this.outLp += 0.45 * (decimationSum - this.outLp);
            let finalSample = this.analogOut.process(this.outLp) * this.fadeVol;

            outL[i] = finalSample;
            if (outR) outR[i] = finalSample;
            if (i === 0) currentVisualValue = finalSample;
        }

        this.visualizer.update(this.isPlaying, this.currentFrame, currentVisualValue, this.regs, this.volA, this.volB, this.volC, this.core.noiseOut, this.core.envVol5Bit / 31);
        return true;
    }
}

registerProcessor('ym-exact-processor', YMExactProcessor);
