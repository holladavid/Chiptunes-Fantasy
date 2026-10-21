// === js/ui/silicon/ym-2149.js ===
// =========================================================
// YAMAHA YM2149F (ATARI ST) LIVING SILICON VISUALIZER (v1.5.0)
// Zero-Allocation, Zero-Clipping, Schematic-Grade Signal Flow:
// - 3x Square-Wave Tone Generators with Live Period-Scaled Scopes
// - 17-Bit LFSR Noise Generator with Live Shift-Register Bit Bar
// - 5-Bit (32-Step) Hardware Envelope Generator with Dedicated Shape Scope & Sync-Buzzer Detector
// - 3x 32-Step Logarithmic DACs (-1.5dB/step) with Live Envelope & Digidrum Injection Buses
// - On-Die Digidrum / Timer-B Hijack Detector & 32-Step Log-DAC Curve Stage
// - External Atari ST Board Model: R43/R44/R45 Open-Collector Summing ("Atari Bus Glue") & 15.9kHz Filter
// =========================================================

import { BaseChip } from './base-chip.js';
import { detectDigidrum, detectDigidrumVoice } from '../../worklets/lib/dsp-utils.js';

const YM_CLOCK = 2000000;

function periodFrequency(period, divider) {
    return period > 0 ? (YM_CLOCK / (divider * period)) : 0;
}

function portDirection(mixerRegister, bit) {
    return ((mixerRegister >> bit) & 1) ? 'IN' : 'OUT';
}

export class Ym2149 extends BaseChip {
    constructor(container) {
        super(container);
        this.lastShape = -1;
        this.sqPhaseA = 0.0;
        this.sqPhaseB = 0.0;
        this.sqPhaseC = 0.0;
        this.digiHoldFrames = 0;
        this.activeDigiSample = 0;
        this.activeDigiVoice = 0;
    }

    cacheDOM() {
        const q = (selector) => this.container.querySelector(selector);
        this.cache = {
            diagVals: this.container.querySelectorAll('.silicon-diagnostics .d-val'),
            diagLbls: this.container.querySelectorAll('.silicon-diagnostics .d-lbl'),

            toneA: q('.ym-tone-a'),
            toneB: q('.ym-tone-b'),
            toneC: q('.ym-tone-c'),
            toneAHz: q('.ym-tone-a-hz'),
            toneBHz: q('.ym-tone-b-hz'),
            toneCHz: q('.ym-tone-c-hz'),
            toneAPer: q('.ym-tone-a-per'),
            toneBPer: q('.ym-tone-b-per'),
            toneCPer: q('.ym-tone-c-per'),
            sqWaveA: q('.ym-sq-wave-a'),
            sqWaveB: q('.ym-sq-wave-b'),
            sqWaveC: q('.ym-sq-wave-c'),

            regA: q('.ym-reg-a'),
            regB: q('.ym-reg-b'),
            regC: q('.ym-reg-c'),
            mixerValue: q('.ym-mixer-value'),

            noiseGen: q('.ym-noise-gen'),
            noiseLabel: q('.ym-noise-hz'),
            noiseBar: q('.ym-noise-bar'),

            envGen: q('.ym-env-gen'),
            envLabel: q('.ym-env-hz'),
            envShape: q('.ym-env-shape-preview'),
            envShapeLabel: q('.ym-env-shape-label'),
            envLevel: q('.ym-env-level'),

            ioPortA: q('.ym-port-a-value'),
            ioPortB: q('.ym-port-b-value'),

            mixTA: q('.mix-t-a'),
            mixTB: q('.mix-t-b'),
            mixTC: q('.mix-t-c'),
            mixNA: q('.mix-n-a'),
            mixNB: q('.mix-n-b'),
            mixNC: q('.mix-n-c'),

            dacA: q('.ym-dac-a'),
            dacB: q('.ym-dac-b'),
            dacC: q('.ym-dac-c'),
            dacValA: q('.ym-dac-val-a'),
            dacValB: q('.ym-dac-val-b'),
            dacValC: q('.ym-dac-val-c'),
            dacBarA: q('.ym-dac-bar-a'),
            dacBarB: q('.ym-dac-bar-b'),
            dacBarC: q('.ym-dac-bar-c'),

            digiEngine: q('.ym-digi-engine'),
            digiStatus: q('.ym-digi-status'),
            digiTarget: q('.ym-digi-target'),
            hegStatus: q('.ym-heg-status'),

            sigToneA: q('.sig-tone-a'),
            sigToneB: q('.sig-tone-b'),
            sigToneC: q('.sig-tone-c'),
            sigNoiseA: q('.sig-noise-a'),
            sigNoiseB: q('.sig-noise-b'),
            sigNoiseC: q('.sig-noise-c'),
            sigMixA: q('.sig-mix-a'),
            sigMixB: q('.sig-mix-b'),
            sigMixC: q('.sig-mix-c'),
            sigEnvA: q('.sig-env-a'),
            sigEnvB: q('.sig-env-b'),
            sigEnvC: q('.sig-env-c'),
            sigDigiA: q('.sig-digi-a'),
            sigDigiB: q('.sig-digi-b'),
            sigDigiC: q('.sig-digi-c'),
            sigOutA: q('.sig-out-a'),
            sigOutB: q('.sig-out-b'),
            sigOutC: q('.sig-out-c'),

            boardInA: q('.ym-board-in-a'),
            boardInB: q('.ym-board-in-b'),
            boardInC: q('.ym-board-in-c'),
            boardSumFeed: q('.ym-board-sum-feed'),
            boardSum: q('.ym-board-sum'),
            boardGlueBar: q('.ym-board-glue-bar'),
            boardGlueText: q('.ym-board-glue-txt'),
            boardFilterBlock: q('.ym-board-filter'),
            boardOutBar: q('.ym-board-out-bar'),
            boardOut: q('.ym-board-out'),

            pinOutA: q('.pin-bot-4'),
            pinOutB: q('.pin-bot-3'),
            pinOutC: q('.pin-top-38'),
            pinClock: q('.pin-top-21')
        };

        if (this.cache.diagLbls && this.cache.diagLbls.length >= 4) {
            this.cache.diagLbls[0].textContent = 'ST CLK';
            this.cache.diagLbls[1].textContent = 'MIX R07';
            this.cache.diagLbls[2].textContent = 'HEG/DIGI';
            this.cache.diagLbls[3].textContent = 'BUS GLUE';
        }
    }

    buildSquareWavePath(x0, yMid, width, amp, active, period, phase) {
        if (!active || amp < 1.0) {
            return `M ${x0} ${yMid} H ${x0 + width}`;
        }
        // Number of half-periods scales with pitch (smaller period = higher freq = tighter square wave)
        const halfPeriods = period < 120 ? 6 : (period < 350 ? 4 : 2);
        const segW = width / halfPeriods;
        const yHigh = Math.round(yMid - amp);
        const yLow = Math.round(yMid + amp);
        const flip = Math.sin(phase) >= 0 ? 0 : 1;

        let d = '';
        for (let s = 0; s < halfPeriods; s++) {
            const xStart = Math.round(x0 + s * segW);
            const xEnd = Math.round(x0 + (s + 1) * segW);
            const y = ((s + flip) & 1) === 0 ? yHigh : yLow;
            const prevY = ((s + flip - 1) & 1) === 0 ? yHigh : yLow;
            if (s === 0) {
                d += `M ${xStart} ${y} H ${xEnd}`;
            } else {
                d += ` V ${y} H ${xEnd}`;
            }
        }
        return d;
    }

    buildEnvelopeShapePath(shape) {
        // Drawn strictly inside Scope Box: x = 580..642 (w=62), y = 132..152 (h=20)
        const x0 = 580, x1 = 600, x2 = 621, x3 = 642;
        const hi = 133, lo = 151;
        const s = shape & 0x0F;

        if (s < 4 || s === 9) {
            // \___ (Decay then Hold 0)
            return `M ${x0} ${hi} L ${x1} ${lo} H ${x3}`;
        }
        if (s < 8 || s === 15) {
            // /___ (Attack then Drop to 0 & Hold)
            return `M ${x0} ${lo} L ${x1} ${hi} V ${lo} H ${x3}`;
        }
        switch (s) {
            case 8: // \\\\ (Sawtooth Decay)
                return `M ${x0} ${hi} L ${x1} ${lo} V ${hi} L ${x2} ${lo} V ${hi} L ${x3} ${lo}`;
            case 10: // \/\/ (Triangle Inv)
                return `M ${x0} ${hi} L ${x1} ${lo} L ${x2} ${hi} L ${x3} ${lo}`;
            case 11: // \‾‾‾ (Decay then Hold High)
                return `M ${x0} ${hi} V ${lo} V ${hi} H ${x3}`;
            case 12: // //// (Sawtooth Attack)
                return `M ${x0} ${lo} L ${x1} ${hi} V ${lo} L ${x2} ${hi} V ${lo} L ${x3} ${hi}`;
            case 13: // /‾‾‾ (Attack then Hold High)
                return `M ${x0} ${lo} L ${x1} ${hi} H ${x3}`;
            case 14: // /\/\ (Triangle)
                return `M ${x0} ${lo} L ${x1} ${hi} L ${x2} ${lo} L ${x3} ${hi}`;
            default:
                return `M ${x0} ${lo} H ${x3}`;
        }
    }

    update(vols, regs, t = 0) {
        if (!regs || regs.length < 16) return;

        const vA = Math.min(1, vols[0] || 0);
        const vB = Math.min(1, vols[1] || 0);
        const vC = Math.min(1, vols[2] || 0);
        const levels = [vA, vB, vC];

        const periodA = regs[0] | ((regs[1] & 0x0F) << 8);
        const periodB = regs[2] | ((regs[3] & 0x0F) << 8);
        const periodC = regs[4] | ((regs[5] & 0x0F) << 8);
        const periods = [periodA, periodB, periodC];

        const setText = (el, text) => {
            if (el && el.textContent !== text) el.textContent = text;
        };

        // 1. Register Summary Block
        setText(this.cache.regA, `A:$${periodA.toString(16).toUpperCase().padStart(3, '0')}`);
        setText(this.cache.regB, `B:$${periodB.toString(16).toUpperCase().padStart(3, '0')}`);
        setText(this.cache.regC, `C:$${periodC.toString(16).toUpperCase().padStart(3, '0')}`);

        const mixer = regs[7];
        setText(this.cache.mixerValue, `MIX R07:$${mixer.toString(16).toUpperCase().padStart(2, '0')}`);

        // 2. Tone Generators & Live Square-Wave Scopes
        const toneEnabled = [0, 1, 2].map((ch) => (mixer & (1 << ch)) === 0);
        const noiseEnabled = [0, 1, 2].map((ch) => (mixer & (1 << (ch + 3))) === 0);

        const formatHz = (per, active) => {
            if (!active || per === 0) return 'IDLE';
            const hz = Math.round(periodFrequency(per, 16));
            return hz >= 10000 ? `${(hz / 1000).toFixed(1)}kHz` : `${hz} Hz`;
        };

        setText(this.cache.toneAPer, `R00/01:$${periodA.toString(16).toUpperCase().padStart(3, '0')}`);
        setText(this.cache.toneBPer, `R02/03:$${periodB.toString(16).toUpperCase().padStart(3, '0')}`);
        setText(this.cache.toneCPer, `R04/05:$${periodC.toString(16).toUpperCase().padStart(3, '0')}`);

        setText(this.cache.toneAHz, formatHz(periodA, vA > 0.02 || toneEnabled[0]));
        setText(this.cache.toneBHz, formatHz(periodB, vB > 0.02 || toneEnabled[1]));
        setText(this.cache.toneCHz, formatHz(periodC, vC > 0.02 || toneEnabled[2]));

        this.sqPhaseA = (this.sqPhaseA + (vA > 0.02 ? 0.35 : 0)) % (Math.PI * 2);
        this.sqPhaseB = (this.sqPhaseB + (vB > 0.02 ? 0.35 : 0)) % (Math.PI * 2);
        this.sqPhaseC = (this.sqPhaseC + (vC > 0.02 ? 0.35 : 0)) % (Math.PI * 2);

        if (this.cache.sqWaveA) {
            this.cache.sqWaveA.setAttribute('d', this.buildSquareWavePath(152, 226, 74, Math.max(2, vA * 8), vA > 0.02 && toneEnabled[0], periodA, this.sqPhaseA));
        }
        if (this.cache.sqWaveB) {
            this.cache.sqWaveB.setAttribute('d', this.buildSquareWavePath(152, 294, 74, Math.max(2, vB * 8), vB > 0.02 && toneEnabled[1], periodB, this.sqPhaseB));
        }
        if (this.cache.sqWaveC) {
            this.cache.sqWaveC.setAttribute('d', this.buildSquareWavePath(152, 362, 74, Math.max(2, vC * 8), vC > 0.02 && toneEnabled[2], periodC, this.sqPhaseC));
        }

        // 3. Mixer Gate Indicators
        const toneIndicators = [this.cache.mixTA, this.cache.mixTB, this.cache.mixTC];
        const noiseIndicators = [this.cache.mixNA, this.cache.mixNB, this.cache.mixNC];
        for (let i = 0; i < 3; i++) {
            if (toneIndicators[i]) toneIndicators[i].style.fill = toneEnabled[i] ? 'var(--highlight-color)' : 'var(--chassis-dark)';
            if (noiseIndicators[i]) noiseIndicators[i].style.fill = noiseEnabled[i] ? 'var(--highlight-color)' : 'var(--chassis-dark)';
        }

        // 4. 17-Bit LFSR Noise Generator
        const noisePeriod = regs[6] & 0x1F;
        const noiseHz = Math.round(periodFrequency(noisePeriod || 1, 16));
        const noiseHzStr = noiseHz >= 10000 ? `${(noiseHz / 1000).toFixed(1)}kHz` : `${noiseHz}Hz`;
        setText(this.cache.noiseLabel, `R06:$${noisePeriod.toString(16).toUpperCase().padStart(2, '0')} · ${noiseHzStr}`);

        const noiseHigh = regs[30] === 1;
        const anyNoiseRouted = (noiseEnabled[0] && vA > 0.02) || (noiseEnabled[1] && vB > 0.02) || (noiseEnabled[2] && vC > 0.02);
        if (this.cache.noiseGen) {
            this.cache.noiseGen.style.opacity = anyNoiseRouted ? (noiseHigh ? '1.0' : '0.65') : '0.35';
        }
        if (this.cache.noiseBar) {
            const nWidth = anyNoiseRouted ? Math.round((noiseHigh ? 1.0 : 0.45) * ((32 - noisePeriod) / 32) * 150) : 0;
            this.cache.noiseBar.setAttribute('width', Math.max(anyNoiseRouted ? 18 : 0, nWidth));
        }

        // 5. 5-Bit (32-Step) Hardware Envelope Generator (HEG) & Sync-Buzzer Detection
        const envelopePeriod = ((regs[12] & 0xFF) << 8) | (regs[11] & 0xFF);
        const envelopeHz = periodFrequency(envelopePeriod || 1, 256);
        const shape = regs[13] & 0x0F;
        const envelopeLevel = Math.max(0, Math.min(1, (Number(regs[31]) || 0) / 255));

        const envActiveA = (regs[8] & 0x10) !== 0;
        const envActiveB = (regs[9] & 0x10) !== 0;
        const envActiveC = (regs[10] & 0x10) !== 0;
        const anyEnvActive = envActiveA || envActiveB || envActiveC;
        const isSyncBuzzer = anyEnvActive && envelopeHz >= 35.0;

        const envHzStr = envelopeHz >= 1000 ? `${(envelopeHz / 1000).toFixed(1)}kHz` : `${envelopeHz.toFixed(1)}Hz`;
        setText(this.cache.envLabel, `P:$${envelopePeriod.toString(16).toUpperCase().padStart(4, '0')} ${envHzStr}`);
        setText(this.cache.envShapeLabel, isSyncBuzzer ? `SHP:$${shape.toString(16).toUpperCase()} BUZZER!` : `SHAPE:$${shape.toString(16).toUpperCase()} (32-ST)`);

        if (this.cache.envGen) {
            this.cache.envGen.style.opacity = anyEnvActive ? `${0.55 + envelopeLevel * 0.45}` : '0.35';
        }
        if (this.cache.envLevel) {
            this.cache.envLevel.setAttribute('width', `${Math.round((anyEnvActive ? envelopeLevel : 0) * 66)}`);
        }
        if (this.lastShape !== shape && this.cache.envShape) {
            this.lastShape = shape;
            this.cache.envShape.setAttribute('d', this.buildEnvelopeShapePath(shape));
        }

        // 6. Digidrum / Timer-B DAC Hijack Detection
        const trigSample = detectDigidrum(regs);
        const trigVoice = detectDigidrumVoice(regs);
        if (trigSample > 0) {
            this.activeDigiSample = trigSample;
            this.activeDigiVoice = trigVoice || 1;
            this.digiHoldFrames = 10;
        } else if (this.digiHoldFrames > 0) {
            this.digiHoldFrames--;
            if (this.digiHoldFrames === 0) {
                this.activeDigiSample = 0;
                this.activeDigiVoice = 0;
            }
        }

        const isDigiActive = this.digiHoldFrames > 0;
        const voiceNames = ['NONE', 'DAC A', 'DAC B', 'DAC C'];

        if (this.cache.digiEngine) {
            this.cache.digiEngine.style.opacity = (isDigiActive || isSyncBuzzer) ? '1.0' : '0.45';
        }
        setText(this.cache.digiStatus, isDigiActive ? `DIGI: SMP #${this.activeDigiSample.toString().padStart(2, '0')}` : 'DIGI: STANDBY');
        setText(this.cache.digiTarget, isDigiActive ? `INJECT -> ${voiceNames[this.activeDigiVoice]}` : 'TIMER-B: IDLE');
        setText(this.cache.hegStatus, isSyncBuzzer ? 'HEG: SYNC-BUZZER' : (anyEnvActive ? 'HEG: 5-BIT ENV' : 'HEG: FIX 4-BIT'));

        // 7. 3x 32-Step Logarithmic DACs (R08, R09, R10)
        const volumeRegs = [regs[8], regs[9], regs[10]];
        const envFlags = [envActiveA, envActiveB, envActiveC];
        const dacBlocks = [this.cache.dacA, this.cache.dacB, this.cache.dacC];
        const dacVals = [this.cache.dacValA, this.cache.dacValB, this.cache.dacValC];
        const dacBars = [this.cache.dacBarA, this.cache.dacBarB, this.cache.dacBarC];
        const toneBlocks = [this.cache.toneA, this.cache.toneB, this.cache.toneC];

        for (let i = 0; i < 3; i++) {
            const rawReg = volumeRegs[i];
            const lvl = levels[i];
            const isHijacked = isDigiActive && this.activeDigiVoice === (i + 1);
            let modeTxt;
            if (isHijacked) {
                modeTxt = `DIGI SMP #${this.activeDigiSample} (5B)`;
            } else if (envFlags[i]) {
                const step5 = Math.round(envelopeLevel * 31);
                modeTxt = `ENV 5-BIT (${step5}/31)`;
            } else {
                const v4 = rawReg & 0x0F;
                const step5 = v4 === 0 ? 0 : (v4 * 2 + 1);
                modeTxt = `FIX ${v4}/15 (${step5}/31)`;
            }

            setText(dacVals[i], modeTxt);
            if (dacBars[i]) dacBars[i].setAttribute('width', `${Math.round(lvl * 168)}`);
            if (dacBlocks[i]) dacBlocks[i].style.opacity = `${0.35 + lvl * 0.65}`;
            if (toneBlocks[i]) toneBlocks[i].style.opacity = `${0.35 + lvl * 0.65}`;
        }

        // 8. Signal Buses (Tone, Noise, Mixer, Envelope, Digidrum, Package Pins)
        const toneSignals = [this.cache.sigToneA, this.cache.sigToneB, this.cache.sigToneC];
        const noiseSignals = [this.cache.sigNoiseA, this.cache.sigNoiseB, this.cache.sigNoiseC];
        const mixSignals = [this.cache.sigMixA, this.cache.sigMixB, this.cache.sigMixC];
        const envSignals = [this.cache.sigEnvA, this.cache.sigEnvB, this.cache.sigEnvC];
        const digiSignals = [this.cache.sigDigiA, this.cache.sigDigiB, this.cache.sigDigiC];
        const outSignals = [this.cache.sigOutA, this.cache.sigOutB, this.cache.sigOutC];
        const boardInputs = [this.cache.boardInA, this.cache.boardInB, this.cache.boardInC];

        for (let i = 0; i < 3; i++) {
            const lvl = levels[i];
            const isHijacked = isDigiActive && this.activeDigiVoice === (i + 1);
            this.updateBusFlow(toneSignals[i], toneEnabled[i] ? lvl : 0);
            this.updateBusFlow(noiseSignals[i], (noiseEnabled[i] && noiseHigh) ? Math.max(0.25, lvl) : 0);
            this.updateBusFlow(mixSignals[i], lvl);
            this.updateBusFlow(envSignals[i], envFlags[i] ? Math.max(0.35, envelopeLevel) : 0);
            this.updateBusFlow(digiSignals[i], isHijacked ? Math.max(0.6, lvl) : 0);
            this.updateBusFlow(outSignals[i], lvl);
            this.updateBusFlow(boardInputs[i], lvl);
        }

        // 9. External Atari ST Board Model (Open-Collector Summing & Bus Glue)
        const sumRaw = vA + vB + vC;
        const compressedSum = sumRaw / (1.0 + 0.22 * sumRaw);
        const normSum = Math.min(1.0, sumRaw / 2.4);
        const gluePct = sumRaw > 0.05 ? Math.round((1.0 - (compressedSum / sumRaw)) * 100) : 0;

        this.updateBusFlow(this.cache.boardSumFeed, normSum);
        if (this.cache.boardSum) {
            this.cache.boardSum.style.opacity = `${0.35 + normSum * 0.65}`;
            this.cache.boardSum.style.filter = normSum > 0.1 ? `drop-shadow(0 0 ${2 + normSum * 5}px var(--bus-active-color))` : 'none';
        }
        if (this.cache.boardGlueBar) {
            this.cache.boardGlueBar.setAttribute('width', `${Math.round(normSum * 150)}`);
        }
        setText(this.cache.boardGlueText, `GLUE: -${gluePct}% COMP`);

        if (this.cache.boardFilterBlock) {
            this.cache.boardFilterBlock.style.opacity = `${0.40 + normSum * 0.60}`;
        }
        if (this.cache.boardOutBar) {
            this.cache.boardOutBar.setAttribute('width', `${Math.round(normSum * 150)}`);
        }
        this.updateBusFlow(this.cache.boardOut, normSum);

        // 10. DIP-40 Physical Pins & Parallel I/O Ports
        this.updatePinGlow(this.cache.pinOutA, vA);
        this.updatePinGlow(this.cache.pinOutB, vB);
        this.updatePinGlow(this.cache.pinOutC, vC);
        this.updatePinGlow(this.cache.pinClock, 0.45 + 0.35 * Math.sin(t * 22.0));

        const portA = regs[14] & 0xFF;
        const portB = regs[15] & 0xFF;
        setText(this.cache.ioPortA, `PA(FLP):$${portA.toString(16).toUpperCase().padStart(2, '0')} ${portDirection(mixer, 6)}`);
        setText(this.cache.ioPortB, `PB(PRT):$${portB.toString(16).toUpperCase().padStart(2, '0')} ${portDirection(mixer, 7)}`);

        // 11. Side Chassis Diagnostics
        if (this.cache.diagVals && this.cache.diagVals.length >= 4) {
            setText(this.cache.diagVals[1], `$${mixer.toString(16).toUpperCase().padStart(2, '0')}`);
            setText(this.cache.diagVals[2], isDigiActive ? `SMP#${this.activeDigiSample}` : (isSyncBuzzer ? 'BUZZER' : (anyEnvActive ? `SHP $${shape.toString(16).toUpperCase()}` : 'LOG-32')));
            setText(this.cache.diagVals[3], gluePct > 0 ? `-${gluePct}% GLUE` : 'LINEAR');
        }
    }

    getSvg() {
        return `
            <svg class="ym-visualization" viewBox="0 0 1240 480" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="YM2149 Atari ST signal flow">
                <defs>
                    <marker id="ym-arrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
                        <path d="M 0 0 L 5 2.5 L 0 5 Z" fill="var(--bus-active-color)" />
                    </marker>
                </defs>

                <!-- =========================================================
                     1. YAMAHA YM2149F DIP-40 PACKAGE & PINS
                     ========================================================= -->
                <rect class="silicon-chip-body" x="40" y="70" width="820" height="335" rx="8" />
                ${this.generatePins(40, 70, 760, 55, 405, true)}
                <circle cx="60" cy="88" r="7" fill="var(--chassis-dark)" />
                <text x="450" y="90" class="silicon-chip-label" fill="var(--panel-text)" text-anchor="middle" dominant-baseline="middle">YAMAHA YM2149F · 2.00 MHz SSG / PSG (DIP-40)</text>
                <text x="55" y="110" class="ym-section-label" fill="var(--highlight-color)">YM2149 SILICON DIE · 3x TONE · 17-BIT LFSR · 5-BIT HEG · 32-STEP LOG DAC</text>

                <!-- =========================================================
                     2. TOP ROW: REGISTERS, 17-BIT NOISE, 5-BIT HEG, I/O PORTS
                     ========================================================= -->
                <!-- 2A: Tone Period & Mixer Registers -->
                <g class="ym-registers">
                    <rect x="55" y="118" width="195" height="56" rx="3" />
                    <text x="65" y="133" fill="var(--highlight-color)">TONE &amp; MIXER REGS</text>
                    <text class="ym-reg-a" x="65" y="149">A:$000</text>
                    <text class="ym-reg-b" x="128" y="149">B:$000</text>
                    <text class="ym-reg-c" x="190" y="149">C:$000</text>
                    <text class="ym-mixer-value" x="65" y="164" fill="var(--highlight-color)">MIX R07:$FF</text>
                    <text x="165" y="164">2.00MHz</text>
                </g>

                <!-- 2B: Shared 17-Bit LFSR Noise Generator -->
                <g class="ym-noise-gen" style="opacity:0.35">
                    <rect x="262" y="118" width="176" height="56" rx="3" />
                    <text x="350" y="133" text-anchor="middle" fill="var(--highlight-color)">17-BIT NOISE LFSR</text>
                    <text class="ym-noise-hz" x="350" y="149" text-anchor="middle">R06:$00 · IDLE</text>
                    <rect x="275" y="158" width="150" height="6" class="ym-envelope-meter-bg" />
                    <rect class="ym-noise-bar" x="275" y="158" width="0" height="6" fill="var(--highlight-color)" />
                </g>

                <!-- 2C: Shared 5-Bit (32-Step) Hardware Envelope Generator (ZERO OVERLAP!) -->
                <g class="ym-env-gen" style="opacity:0.35">
                    <rect x="450" y="118" width="205" height="56" rx="3" />
                    <text x="458" y="133" fill="var(--highlight-color)">5-BIT ENV (HEG)</text>
                    <text class="ym-env-hz" x="458" y="149">P:$0000 0.0Hz</text>
                    <text class="ym-env-shape-label" x="458" y="164">SHAPE:$0 (32-ST)</text>
                    <!-- Dedicated CRT Scope Box for Envelope Shape (x=576..646, y=126..156) -->
                    <rect x="576" y="126" width="68" height="30" rx="1" fill="var(--chassis-dark)" stroke="var(--text-color)" stroke-width="0.8" />
                    <path class="ym-env-shape-preview" d="M 580 133 L 600 151 H 642" />
                    <!-- Live 5-Bit Envelope Output Bar -->
                    <rect x="576" y="160" width="68" height="5" class="ym-envelope-meter-bg" />
                    <rect class="ym-env-level" x="576" y="160" width="0" height="5" />
                </g>

                <!-- 2D: Parallel I/O Ports A & B (Floppy / Printer / Digidrum Regs R14/R15) -->
                <g class="ym-ioports">
                    <rect x="667" y="118" width="178" height="56" rx="3" />
                    <text x="676" y="133" fill="var(--highlight-color)">I/O PORTS R14/15</text>
                    <text class="ym-port-a-value" x="676" y="149">PA(FLP):$00 OUT</text>
                    <text class="ym-port-b-value" x="676" y="164">PB(PRT):$00 OUT</text>
                </g>

                <!-- =========================================================
                     3. THREE CHANNEL ROWS: TONE GEN -> MIXER GATE -> LOG DAC
                     ========================================================= -->
                <!-- TONE GENERATORS A, B, C (With Live Square-Wave Scopes!) -->
                <g class="ym-channel ym-tone-a">
                    <rect x="55" y="192" width="180" height="54" rx="3" />
                    <text x="64" y="207" fill="var(--highlight-color)">TONE A</text>
                    <text class="ym-tone-a-per" x="226" y="207" text-anchor="end">R00/01:$000</text>
                    <text class="ym-tone-a-hz" x="64" y="229" fill="var(--highlight-color)">IDLE</text>
                    <rect x="148" y="214" width="80" height="24" rx="1" fill="var(--chassis-dark)" stroke="var(--text-color)" stroke-width="0.7" />
                    <path class="ym-sq-wave-a" d="M 152 226 H 226" fill="none" stroke="var(--highlight-color)" stroke-width="1.3" />
                </g>

                <g class="ym-channel ym-tone-b">
                    <rect x="55" y="260" width="180" height="54" rx="3" />
                    <text x="64" y="275" fill="var(--highlight-color)">TONE B</text>
                    <text class="ym-tone-b-per" x="226" y="275" text-anchor="end">R02/03:$000</text>
                    <text class="ym-tone-b-hz" x="64" y="297" fill="var(--highlight-color)">IDLE</text>
                    <rect x="148" y="282" width="80" height="24" rx="1" fill="var(--chassis-dark)" stroke="var(--text-color)" stroke-width="0.7" />
                    <path class="ym-sq-wave-b" d="M 152 294 H 226" fill="none" stroke="var(--highlight-color)" stroke-width="1.3" />
                </g>

                <g class="ym-channel ym-tone-c">
                    <rect x="55" y="328" width="180" height="54" rx="3" />
                    <text x="64" y="343" fill="var(--highlight-color)">TONE C</text>
                    <text class="ym-tone-c-per" x="226" y="343" text-anchor="end">R04/05:$000</text>
                    <text class="ym-tone-c-hz" x="64" y="365" fill="var(--highlight-color)">IDLE</text>
                    <rect x="148" y="350" width="80" height="24" rx="1" fill="var(--chassis-dark)" stroke="var(--text-color)" stroke-width="0.7" />
                    <path class="ym-sq-wave-c" d="M 152 362 H 226" fill="none" stroke="var(--highlight-color)" stroke-width="1.3" />
                </g>

                <!-- MIXER GATES A, B, C (Tone & Noise NAND/OR Matrix) -->
                <g class="ym-gates">
                    <rect x="262" y="192" width="176" height="54" rx="3" />
                    <text x="350" y="208" text-anchor="middle" fill="var(--highlight-color)">MIXER GATE A</text>
                    <rect class="mix-t-a" x="280" y="220" width="12" height="12" />
                    <text x="298" y="230">TONE</text>
                    <rect class="mix-n-a" x="356" y="220" width="12" height="12" />
                    <text x="374" y="230">NOISE</text>

                    <rect x="262" y="260" width="176" height="54" rx="3" />
                    <text x="350" y="276" text-anchor="middle" fill="var(--highlight-color)">MIXER GATE B</text>
                    <rect class="mix-t-b" x="280" y="288" width="12" height="12" />
                    <text x="298" y="298">TONE</text>
                    <rect class="mix-n-b" x="356" y="288" width="12" height="12" />
                    <text x="374" y="298">NOISE</text>

                    <rect x="262" y="328" width="176" height="54" rx="3" />
                    <text x="350" y="344" text-anchor="middle" fill="var(--highlight-color)">MIXER GATE C</text>
                    <rect class="mix-t-c" x="280" y="356" width="12" height="12" />
                    <text x="298" y="366">TONE</text>
                    <rect class="mix-n-c" x="356" y="356" width="12" height="12" />
                    <text x="374" y="366">NOISE</text>
                </g>

                <!-- 32-STEP LOGARITHMIC DACS A, B, C (R08, R09, R10) -->
                <g class="ym-dac ym-dac-a">
                    <rect x="468" y="192" width="186" height="54" rx="3" />
                    <text x="478" y="207" fill="var(--highlight-color)">LOG DAC A · R08</text>
                    <text class="ym-dac-val-a" x="478" y="224">FIX 0/15 (0/31)</text>
                    <rect x="478" y="233" width="168" height="6" class="ym-envelope-meter-bg" />
                    <rect class="ym-dac-bar-a" x="478" y="233" width="0" height="6" fill="var(--highlight-color)" />
                </g>

                <g class="ym-dac ym-dac-b">
                    <rect x="468" y="260" width="186" height="54" rx="3" />
                    <text x="478" y="275" fill="var(--highlight-color)">LOG DAC B · R09</text>
                    <text class="ym-dac-val-b" x="478" y="292">FIX 0/15 (0/31)</text>
                    <rect x="478" y="301" width="168" height="6" class="ym-envelope-meter-bg" />
                    <rect class="ym-dac-bar-b" x="478" y="301" width="0" height="6" fill="var(--highlight-color)" />
                </g>

                <g class="ym-dac ym-dac-c">
                    <rect x="468" y="328" width="186" height="54" rx="3" />
                    <text x="478" y="343" fill="var(--highlight-color)">LOG DAC C · R10</text>
                    <text class="ym-dac-val-c" x="478" y="360">FIX 0/15 (0/31)</text>
                    <rect x="478" y="369" width="168" height="6" class="ym-envelope-meter-bg" />
                    <rect class="ym-dac-bar-c" x="478" y="369" width="0" height="6" fill="var(--highlight-color)" />
                </g>

                <!-- =========================================================
                     4. ON-DIE DIGIDRUM & 32-STEP LOG-DAC ENGINE (RIGHT COLUMN)
                     ========================================================= -->
                <g class="ym-digi-engine" style="opacity:0.45">
                    <rect x="674" y="192" width="171" height="190" rx="3" fill="var(--screen-bg)" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="759" y="208" text-anchor="middle" fill="var(--highlight-color)">DAC &amp; DIGI CORE</text>
                    <text x="759" y="222" text-anchor="middle" style="font-size:6px;">32-STEP LOG (-1.5dB)</text>

                    <!-- Logarithmic Staircase Curve Window -->
                    <rect x="686" y="230" width="147" height="44" rx="2" fill="var(--chassis-dark)" stroke="var(--text-color)" stroke-width="0.7" />
                    <path d="M 692 268 H 712 V 265 H 732 V 260 H 752 V 252 H 772 V 242 H 792 V 234 H 826" fill="none" stroke="var(--highlight-color)" stroke-width="1.4" />
                    <text x="700" y="244" style="font-size:5.5px;" fill="var(--text-color)">5-BIT EXP CURVE</text>

                    <!-- Live Digidrum / Timer-B Hijack Detector -->
                    <rect x="686" y="282" width="147" height="46" rx="2" fill="var(--chassis-dark)" stroke="var(--text-color)" stroke-width="0.8" />
                    <text class="ym-digi-status" x="759" y="298" text-anchor="middle" fill="var(--highlight-color)">DIGI: STANDBY</text>
                    <text class="ym-digi-target" x="759" y="315" text-anchor="middle" style="font-size:6px;">TIMER-B: IDLE</text>

                    <!-- HEG / Sync-Buzzer Status & Pin Legend -->
                    <text class="ym-heg-status" x="759" y="346" text-anchor="middle" fill="var(--highlight-color)">HEG: FIX 4-BIT</text>
                    <text x="759" y="366" text-anchor="middle" style="font-size:6px;">OUT: A/4 · B/3 · C/38</text>
                </g>

                <!-- =========================================================
                     5. INTERNAL DIE SIGNAL ROUTING (WITH SCHEMATIC JUMPERS)
                     ========================================================= -->
                <!-- Tone A/B/C -> Mixer Gates (Straight horizontal, 0 crossings) -->
                <path class="silicon-bus-wire" d="M 235 219 H 262" /><path class="silicon-bus-packet sig-tone-a" d="M 235 219 H 262" />
                <path class="silicon-bus-wire" d="M 235 287 H 262" /><path class="silicon-bus-packet sig-tone-b" d="M 235 287 H 262" />
                <path class="silicon-bus-wire" d="M 235 355 H 262" /><path class="silicon-bus-packet sig-tone-c" d="M 235 355 H 262" />

                <!-- Shared Noise LFSR -> Mixer Gates A/B/C (Continuous paths down x=248 with jumper arcs over y=219 & y=287) -->
                <path class="silicon-bus-wire" d="M 350 174 V 183 H 248 V 205 H 262 M 248 205 V 215 A 4 4 0 0 1 248 223 V 273 H 262 M 248 273 V 283 A 4 4 0 0 1 248 291 V 341 H 262" />
                <path class="silicon-bus-packet sig-noise-a" d="M 350 174 V 183 H 248 V 205 H 262" />
                <path class="silicon-bus-packet sig-noise-b" d="M 350 174 V 183 H 248 V 273 H 262" />
                <path class="silicon-bus-packet sig-noise-c" d="M 350 174 V 183 H 248 V 341 H 262" />

                <!-- Mixer Gates -> Log DACs A/B/C -->
                <path class="silicon-bus-wire" d="M 438 219 H 468" /><path class="silicon-bus-packet sig-mix-a" d="M 438 219 H 468" />
                <path class="silicon-bus-wire" d="M 438 287 H 468" /><path class="silicon-bus-packet sig-mix-b" d="M 438 287 H 468" />
                <path class="silicon-bus-wire" d="M 438 355 H 468" /><path class="silicon-bus-packet sig-mix-c" d="M 438 355 H 468" />

                <!-- Shared 5-Bit Envelope (HEG) -> Log DACs A/B/C (Down x=454 corridor) -->
                <path class="silicon-bus-wire" d="M 540 174 V 183 H 454 V 205 H 468 M 454 205 V 215 A 4 4 0 0 1 454 223 V 273 H 468 M 454 273 V 283 A 4 4 0 0 1 454 291 V 341 H 468" />
                <path class="silicon-bus-packet sig-env-a" d="M 540 174 V 183 H 454 V 205 H 468" />
                <path class="silicon-bus-packet sig-env-b" d="M 540 174 V 183 H 454 V 273 H 468" />
                <path class="silicon-bus-packet sig-env-c" d="M 540 174 V 183 H 454 V 341 H 468" />

                <!-- Digidrum Injection Paths -> Log DACs A/B/C -->
                <path class="silicon-bus-wire" d="M 674 210 H 654" /><path class="silicon-bus-packet sig-digi-a" d="M 674 210 H 654" />
                <path class="silicon-bus-wire" d="M 674 278 H 654" /><path class="silicon-bus-packet sig-digi-b" d="M 674 278 H 654" />
                <path class="silicon-bus-wire" d="M 674 346 H 654" /><path class="silicon-bus-packet sig-digi-c" d="M 674 346 H 654" />

                <!-- Internal Die Output Traces to Package Pins (100% inside chip body!) -->
                <!-- DAC A (654, 228) -> Corridor x=662 -> y=390 -> Pin 4 (203, 405) -->
                <path class="silicon-bus-wire" d="M 654 228 H 662 V 390 H 203 V 405" />
                <path class="silicon-bus-packet sig-out-a" d="M 654 228 H 662 V 390 H 203 V 405" />

                <!-- DAC B (654, 296) -> Corridor x=668 -> y=397 -> Pin 3 (165, 405) -->
                <path class="silicon-bus-wire" d="M 654 296 H 658 A 4 4 0 0 1 666 296 H 668 V 397 H 207 A 4 4 0 0 1 199 397 H 165 V 405" />
                <path class="silicon-bus-packet sig-out-b" d="M 654 296 H 668 V 397 H 165 V 405" />

                <!-- DAC C (654, 364) -> Bottom/Right Inner Perimeter x=852 -> y=78 -> Pin 38 (165, 70) -->
                <path class="silicon-bus-wire" d="M 654 364 H 658 A 4 4 0 0 1 670 364 V 392 H 852 V 78 H 165 V 70" />
                <path class="silicon-bus-packet sig-out-c" d="M 654 364 H 670 V 392 H 852 V 78 H 165 V 70" />

                <!-- =========================================================
                     6. EXTERNAL ATARI ST MOTHERBOARD AUDIO MODEL
                     ========================================================= -->
                <g class="ym-board">
                    <rect x="896" y="70" width="324" height="335" rx="6" />
                    <text x="1058" y="94" class="ym-board-title" text-anchor="middle">ATARI ST · BOARD MODEL</text>
                    <text x="1058" y="110" class="ym-board-note" text-anchor="middle">OPEN-COLLECTOR BUS &amp; ANALOG STAGE</text>

                    <!-- External PCB Traces from Pin 4 (203, 420), Pin 3 (165, 420) & Pin 38 (165, 55) -->
                    <!-- Steps cleanly around Pin Numbers 4 & 3 (at y=431) -->
                    <path class="silicon-bus-wire" d="M 203 420 H 216 V 442 H 876 V 168 H 918" marker-end="url(#ym-arrow)" />
                    <path class="silicon-bus-packet ym-board-in-a" d="M 203 420 H 216 V 442 H 876 V 168 H 918" />

                    <path class="silicon-bus-wire" d="M 165 420 H 178 V 456 H 886 V 192 H 918" marker-end="url(#ym-arrow)" />
                    <path class="silicon-bus-packet ym-board-in-b" d="M 165 420 H 178 V 456 H 886 V 192 H 918" />

                    <path class="silicon-bus-wire" d="M 165 55 V 28 H 886 V 216 H 918" marker-end="url(#ym-arrow)" />
                    <path class="silicon-bus-packet ym-board-in-c" d="M 165 55 V 28 H 886 V 216 H 918" />

                    <!-- Stage 6A: Open-Collector Summing Bus (R43, R44, R45 = 1k Ohm) -->
                    <rect x="918" y="128" width="280" height="122" rx="4" />
                    <text x="1058" y="145" text-anchor="middle" fill="var(--highlight-color)">PASSIVE SUMMING (R43-R45 1k)</text>

                    <text x="928" y="171" style="font-size:6px;">PIN 4 (A)</text>
                    <rect x="992" y="163" width="32" height="10" rx="1" fill="var(--chassis-dark)" stroke="var(--text-color)" stroke-width="0.8" />
                    <text x="1008" y="171" style="font-size:5.5px;" text-anchor="middle">R43</text>

                    <text x="928" y="195" style="font-size:6px;">PIN 3 (B)</text>
                    <rect x="992" y="187" width="32" height="10" rx="1" fill="var(--chassis-dark)" stroke="var(--text-color)" stroke-width="0.8" />
                    <text x="1008" y="195" style="font-size:5.5px;" text-anchor="middle">R44</text>

                    <text x="928" y="219" style="font-size:6px;">PIN 38 (C)</text>
                    <rect x="992" y="211" width="32" height="10" rx="1" fill="var(--chassis-dark)" stroke="var(--text-color)" stroke-width="0.8" />
                    <text x="1008" y="219" style="font-size:5.5px;" text-anchor="middle">R45</text>

                    <path class="silicon-bus-wire" d="M 1024 168 H 1055 V 192 H 1082 M 1024 192 H 1082 M 1024 216 H 1055 V 192" />
                    <path class="silicon-bus-packet ym-board-sum-feed" d="M 1024 168 H 1055 V 192 H 1082 M 1024 192 H 1082 M 1024 216 H 1055 V 192" />

                    <circle class="ym-board-sum" cx="1092" cy="192" r="9" fill="var(--highlight-color)" opacity="0.35" />
                    <text x="1152" y="188" text-anchor="middle" fill="var(--highlight-color)" style="font-size:6px;">ATARI BUS</text>
                    <text class="ym-board-glue-txt" x="1152" y="201" text-anchor="middle" style="font-size:5.5px;">GLUE: 0%</text>

                    <!-- Non-Linear Bus Glue Meter -->
                    <rect x="932" y="234" width="150" height="6" class="ym-envelope-meter-bg" />
                    <rect class="ym-board-glue-bar" x="932" y="234" width="0" height="6" fill="var(--highlight-color)" />
                    <text x="1142" y="240" text-anchor="middle" style="font-size:5.5px;">I/(1+0.22*I)</text>

                    <!-- Connection from Summing Node to Analog Filter Stage -->
                    <path class="silicon-bus-wire" d="M 1092 201 V 268" marker-end="url(#ym-arrow)" />
                    <path class="silicon-bus-packet ym-board-out" d="M 1092 201 V 268" />

                    <!-- Stage 6B: Sinc-FIR Decimator & Atari Analog Filter Stage -->
                    <g class="ym-board-filter" style="opacity:0.45">
                        <rect x="918" y="268" width="280" height="106" rx="4" fill="var(--screen-bg)" stroke="var(--text-color)" stroke-width="1.5" />
                        <text x="1058" y="286" text-anchor="middle" fill="var(--highlight-color)">ST ANALOG &amp; SINC-FIR STAGE</text>
                        <text x="1058" y="303" text-anchor="middle" style="font-size:6px;">255-TAP SINC-FIR (12.5kHz BRICKWALL)</text>
                        <text x="1058" y="319" text-anchor="middle" style="font-size:6px;">15.9kHz RC LP · 25Hz AC HP · TANH</text>

                        <text x="932" y="343" style="font-size:6px;" fill="var(--highlight-color)">MONO OUT</text>
                        <rect x="996" y="336" width="150" height="7" class="ym-envelope-meter-bg" />
                        <rect class="ym-board-out-bar" x="996" y="336" width="0" height="7" fill="var(--highlight-color)" />
                        <text x="1058" y="362" class="ym-board-note" text-anchor="middle">PIN 4 + PIN 3 + PIN 38 PASSIVE SUM</text>
                    </g>

                    <!-- Clean Forward-Pointing Audio Output Arrow -->
                    <path class="silicon-bus-wire" d="M 1198 321 H 1232" marker-end="url(#ym-arrow)" />
                </g>
            </svg>
        `;
    }
}