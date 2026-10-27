// === js/worklets/atari/ym-exact.js ===
// =========================================================
// YM2149F CORE (CYCLE-EXACT 2MHz, LOG-DAC, TRUE 5-BIT ENV)
// Interpolated 256-phase Kaiser polyphase resampling, linear channel summing,
// 64-step envelope state machine and YM6 effect injection.
// =========================================================

import { AtariAnalogFilter } from '../lib/dsp-utils.js';
import { YM2149Core } from '../lib/ym2149-core.js';
import { YM6Effects } from '../lib/ym6-effects.js';
import { TwoStagePolyphaseResampler } from '../lib/polyphase-resampler.js';
import { YMVisualizer } from '../lib/ym-visualizer.js';

class YMExactProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.clock = 2000000; // 2.0 MHz Atari ST Master Clock
        this.core = new YM2149Core(this.clock);
        this.regs = this.core.regs;

        this.digidrums = [];
        this.effects = new YM6Effects(this.clock);

        this.trackData = null;
        this.currentFrame = 0;
        this.playerRate = 50;
        this.loopFrame = 0;
        this.sampleCounter = 0;
        this.isPlaying = false;

        this.volA = 0.0; this.volB = 0.0; this.volC = 0.0;
        this.visualizer = new YMVisualizer(this.port);

        this.resampler = new TwoStagePolyphaseResampler(this.clock, sampleRate, {
            attenuation: 96,
            passbandHz: 20000,
            maximumStopbandHz: sampleRate * 0.5
        });
        this.analogOut = new AtariAnalogFilter(sampleRate);
        this.fadeVol = 0.0;

        this.port.onmessage = (event) => {
            const msg = event.data;
            if (msg.type === 'PLAY_TRACK') {
                this.core.reset();
                this.trackData = msg.track;
                this.digidrums = msg.digidrums || [];
                this.currentFrame = 0;
                this.playerRate = Number.isFinite(msg.playerRate) && msg.playerRate > 0 ? msg.playerRate : 50;
                this.loopFrame = Number.isInteger(msg.loopFrame) && msg.loopFrame >= 0 && msg.loopFrame < this.trackData.length
                    ? msg.loopFrame
                    : 0;
                this.sampleCounter = 0;
                this.effects.reset();
                this.resampler.reset();
                this.isPlaying = true;

                this.fadeVol = 0;
                this.volA = 0;
                this.volB = 0;
                this.volC = 0;
                this.analogOut.reset();
            } else if (msg.type === 'STOP_TRACK') {
                this.isPlaying = false;
            } else if (msg.type === 'RESUME_TRACK') {
                this.isPlaying = true;
            } else if (msg.type === 'SEEK_TRACK') {
                if (this.trackData) {
                    this.currentFrame = msg.frame % this.trackData.length;
                    this.effects.reset();
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
                const cyclesToRun = this.resampler.beginSample();

                this.sampleCounter--;
                if (this.sampleCounter <= 0) {
                    this.sampleCounter += sampleRate / this.playerRate;

                    let frame = this.trackData[this.currentFrame];
                    for (let r = 0; r < 16; r++) {
                        this.core.writeRegister(r, frame[r]);
                    }

                    this.effects.applyFrame(frame, this.digidrums);
                    if (this.effects.digidrumStartMask !== 0) {
                        this.port.postMessage({ type: 'DEBUG', msg: 'YM6 Digidrum' });
                    }

                    this.currentFrame++;
                    if (this.currentFrame >= this.trackData.length) this.currentFrame = this.loopFrame;
                }

                // =========================================================
                // 2.0 MHz CYCLE-EXACT LOCKSTEP LOOP
                // =========================================================
                for (let c = 0; c < cyclesToRun; c++) {
                    const effectLevels = this.effects.clockCycle(this.core);
                    const mixedSample = this.core.clockCycle(-1, 0, effectLevels);
                    this.volA = this.core.volA;
                    this.volB = this.core.volB;
                    this.volC = this.core.volC;
                    this.resampler.write(mixedSample);
                }
                decimationSum = this.resampler.process();
            }

            let finalSample = this.analogOut.process(decimationSum) * this.fadeVol;

            outL[i] = finalSample;
            if (outR) outR[i] = finalSample;
            if (i === 0) currentVisualValue = finalSample;
        }

        this.visualizer.update(this.isPlaying, this.currentFrame, currentVisualValue, this.regs, this.volA, this.volB, this.volC, this.core.noiseOut, this.core.envVol5Bit / 31);
        return true;
    }
}

registerProcessor('ym-exact-processor', YMExactProcessor);
