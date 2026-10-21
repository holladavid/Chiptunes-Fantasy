// === js/ui/silicon/ym-2149.js ===
// =========================================================
// YM2149F (ATARI ST) LIVING SILICON VISUALIZER
// Schematic view of the shared PSG signal path and ST output model.
// =========================================================

import { BaseChip } from './base-chip.js';

const YM_CLOCK = 2000000;

function periodFrequency(period, divider) {
    return YM_CLOCK / (divider * (period || 1));
}

export class Ym2149 extends BaseChip {
    cacheDOM() {
        const q = (selector) => this.container.querySelector(selector);
        this.cache = {
            toneA: q('.ym-tone-a'),
            toneB: q('.ym-tone-b'),
            toneC: q('.ym-tone-c'),
            noiseGen: q('.ym-noise-gen'),
            envGen: q('.ym-env-gen'),
            envLevel: q('.ym-env-level'),
            dacA: q('.ym-dac-a'),
            dacB: q('.ym-dac-b'),
            dacC: q('.ym-dac-c'),
            toneAHz: q('.ym-tone-a-hz'),
            toneBHz: q('.ym-tone-b-hz'),
            toneCHz: q('.ym-tone-c-hz'),
            noiseLabel: q('.ym-noise-hz'),
            envLabel: q('.ym-env-hz'),
            envShape: q('.ym-env-shape-preview'),
            envShapeLabel: q('.ym-env-shape-label'),
            regA: q('.ym-reg-a'),
            regB: q('.ym-reg-b'),
            regC: q('.ym-reg-c'),
            mixerValue: q('.ym-mixer-value'),
            ioPortA: q('.ym-port-a-value'),
            ioPortB: q('.ym-port-b-value'),
            mixTA: q('.mix-t-a'),
            mixTB: q('.mix-t-b'),
            mixTC: q('.mix-t-c'),
            mixNA: q('.mix-n-a'),
            mixNB: q('.mix-n-b'),
            mixNC: q('.mix-n-c'),
            sigToneA: q('.sig-tone-a'),
            sigToneB: q('.sig-tone-b'),
            sigToneC: q('.sig-tone-c'),
            sigNoiseA: q('.sig-noise-a'),
            sigNoiseB: q('.sig-noise-b'),
            sigNoiseC: q('.sig-noise-c'),
            sigMixA: q('.sig-mix-a'),
            sigMixB: q('.sig-mix-b'),
            sigMixC: q('.sig-mix-c'),
            sigOutA: q('.sig-out-a'),
            sigOutB: q('.sig-out-b'),
            sigOutC: q('.sig-out-c'),
            boardInA: q('.ym-board-in-a'),
            boardInB: q('.ym-board-in-b'),
            boardInC: q('.ym-board-in-c'),
            boardSumFeed: q('.ym-board-sum-feed'),
            boardSum: q('.ym-board-sum'),
            boardOut: q('.ym-board-out'),
            pinOutA: q('.pin-bot-4'),
            pinOutB: q('.pin-bot-3'),
            pinOutC: q('.pin-top-38')
        };
    }

    update(vols, regs, t) {
        if (!regs || regs.length < 16) return;
        const vA = vols[0] || 0;
        const vB = vols[1] || 0;
        const vC = vols[2] || 0;
        const periodA = regs[0] | ((regs[1] & 0x0F) << 8);
        const periodB = regs[2] | ((regs[3] & 0x0F) << 8);
        const periodC = regs[4] | ((regs[5] & 0x0F) << 8);
        const setText = (el, text) => {
            if (el) el.textContent = text;
        };
        const formatTone = (period) => {
            const hz = Math.round(periodFrequency(period, 16));
            return `P${period.toString(16).toUpperCase().padStart(3, '0')} · ${hz}Hz`;
        };

        setText(this.cache.toneAHz, formatTone(periodA));
        setText(this.cache.toneBHz, formatTone(periodB));
        setText(this.cache.toneCHz, formatTone(periodC));
        setText(this.cache.regA, `R00-01 $${periodA.toString(16).toUpperCase().padStart(3, '0')}`);
        setText(this.cache.regB, `R02-03 $${periodB.toString(16).toUpperCase().padStart(3, '0')}`);
        setText(this.cache.regC, `R04-05 $${periodC.toString(16).toUpperCase().padStart(3, '0')}`);

        const mixer = regs[7];
        const toneEnabled = [0, 1, 2].map((channel) => (mixer & (1 << channel)) === 0);
        const noiseEnabled = [0, 1, 2].map((channel) => (mixer & (1 << (channel + 3))) === 0);
        const toneIndicators = [this.cache.mixTA, this.cache.mixTB, this.cache.mixTC];
        const noiseIndicators = [this.cache.mixNA, this.cache.mixNB, this.cache.mixNC];
        toneIndicators.forEach((el, i) => {
            if (el) el.style.fill = toneEnabled[i] ? 'var(--highlight-color)' : 'var(--chassis-dark)';
        });
        noiseIndicators.forEach((el, i) => {
            if (el) el.style.fill = noiseEnabled[i] ? 'var(--highlight-color)' : 'var(--chassis-dark)';
        });
        setText(this.cache.mixerValue, `R07 $${mixer.toString(16).toUpperCase().padStart(2, '0')}`);

        const noisePeriod = regs[6] & 0x1F;
        const noiseHz = Math.round(periodFrequency(noisePeriod, 16));
        setText(this.cache.noiseLabel, `P${noisePeriod} · ${noiseHz}Hz`);
        const noiseHigh = regs[30] === 1;
        if (this.cache.noiseGen) {
            this.cache.noiseGen.style.opacity = noiseHigh ? '1' : '0.3';
            this.cache.noiseGen.classList.toggle('is-active', noiseHigh);
        }

        const envelopePeriod = ((regs[12] & 0xFF) << 8) | (regs[11] & 0xFF);
        const envelopeHz = periodFrequency(envelopePeriod, 256);
        const shape = regs[13] & 0x0F;
        const envelopeLevel = Math.max(0, Math.min(1, (Number(regs[31]) || 0) / 255));
        setText(this.cache.envLabel, `P${envelopePeriod.toString(16).toUpperCase().padStart(4, '0')} · ${envelopeHz.toFixed(1)}Hz`);
        setText(this.cache.envShapeLabel, `SHAPE ${shape.toString(16).toUpperCase()}`);
        if (this.cache.envGen) this.cache.envGen.style.opacity = `${0.3 + envelopeLevel * 0.7}`;
        if (this.cache.envLevel) {
            this.cache.envLevel.setAttribute('width', `${Math.round(envelopeLevel * 76)}`);
        }
        if (this.cache.envShape) {
            const rising = (shape & 0x04) !== 0;
            const continuous = (shape & 0x08) !== 0;
            const alternate = (shape & 0x02) !== 0;
            const hold = (shape & 0x01) !== 0;
            const startY = rising ? 133 : 117;
            const endY = rising ? 117 : 133;
            let path = `M 483 ${startY} L 519 ${endY}`;
            if (!continuous) {
                path = `M 483 ${startY} L 519 ${endY} L 555 ${endY}`;
            } else if (hold) {
                path = `M 483 ${startY} L 519 ${endY} L 555 ${alternate ? startY : endY}`;
            } else if (alternate) {
                path = `M 483 ${startY} L 519 ${endY} L 555 ${startY}`;
            } else {
                path = `M 483 ${startY} L 519 ${endY} L 555 ${endY}`;
            }
            this.cache.envShape.setAttribute('d', path);
        }

        const volumeRegs = [regs[8], regs[9], regs[10]];
        const volumeText = volumeRegs.map((value) => (value & 0x10)
            ? `ENV / $${(value & 0x0F).toString(16).toUpperCase()}`
            : `FIX ${value & 0x0F}/15`);
        [this.cache.dacA, this.cache.dacB, this.cache.dacC].forEach((el, i) => {
            if (el) {
                el.style.opacity = `${0.25 + [vA, vB, vC][i] * 0.75}`;
                const label = el.querySelector('.ym-dac-value');
                if (label) label.textContent = volumeText[i];
            }
        });
        [this.cache.toneA, this.cache.toneB, this.cache.toneC].forEach((el, i) => {
            if (el) el.style.opacity = `${0.25 + [vA, vB, vC][i] * 0.75}`;
        });

        const toneSignals = [this.cache.sigToneA, this.cache.sigToneB, this.cache.sigToneC];
        const noiseSignals = [this.cache.sigNoiseA, this.cache.sigNoiseB, this.cache.sigNoiseC];
        const mixSignals = [this.cache.sigMixA, this.cache.sigMixB, this.cache.sigMixC];
        const outSignals = [this.cache.sigOutA, this.cache.sigOutB, this.cache.sigOutC];
        const boardInputs = [this.cache.boardInA, this.cache.boardInB, this.cache.boardInC];
        const levels = [vA, vB, vC];
        for (let i = 0; i < 3; i++) {
            this.updateBusFlow(toneSignals[i], toneEnabled[i] ? levels[i] : 0);
            this.updateBusFlow(noiseSignals[i], noiseEnabled[i] ? (noiseHigh ? levels[i] : 0) : 0);
            this.updateBusFlow(mixSignals[i], levels[i]);
            this.updateBusFlow(outSignals[i], levels[i]);
            this.updateBusFlow(boardInputs[i], levels[i]);
        }
        const total = vA + vB + vC;
        this.updateBusFlow(this.cache.boardSumFeed, total / 3);
        if (this.cache.boardSum) {
            this.cache.boardSum.style.opacity = `${0.3 + Math.min(1, total / 3) * 0.7}`;
            this.cache.boardSum.style.filter = `drop-shadow(0 0 ${1 + total * 2}px var(--bus-active-color))`;
        }
        this.updateBusFlow(this.cache.boardOut, total / 3);
        this.updatePinGlow(this.cache.pinOutA, vA);
        this.updatePinGlow(this.cache.pinOutB, vB);
        this.updatePinGlow(this.cache.pinOutC, vC);

        const portA = regs[14] & 0xFF;
        const portB = regs[15] & 0xFF;
        setText(this.cache.ioPortA, `$${portA.toString(16).toUpperCase().padStart(2, '0')} · ${portDirection(regs[7], 6)}`);
        setText(this.cache.ioPortB, `$${portB.toString(16).toUpperCase().padStart(2, '0')} · ${portDirection(regs[7], 7)}`);
    }

    getSvg() {
        return `
            <svg class="ym-visualization" viewBox="0 0 1240 480" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="YM2149 Atari ST signal flow">
                <rect class="silicon-chip-body" x="40" y="70" width="820" height="330" rx="8" />
                ${this.generatePins(40, 70, 760, 55, 405, true)}
                <circle cx="60" cy="88" r="7" fill="var(--chassis-dark)" />
                <text x="450" y="90" class="silicon-chip-label" fill="var(--panel-text)" text-anchor="middle" dominant-baseline="middle">YAMAHA YM2149F · PSG / SSG</text>
                <text x="55" y="112" class="ym-section-label" fill="var(--highlight-color)">YM2149 DIE · 2.00 MHz · 16 REGISTERS</text>

                <g class="ym-registers">
                    <rect x="55" y="122" width="205" height="54" rx="3" />
                    <text x="65" y="137">TONE PERIODS</text>
                    <text class="ym-reg-a" x="65" y="151">R00-01 $000</text>
                    <text class="ym-reg-b" x="65" y="162">R02-03 $000</text>
                    <text class="ym-reg-c" x="165" y="151">R04-05 $000</text>
                    <text class="ym-mixer-value" x="165" y="162">R07 $00</text>
                </g>

                <g class="ym-noise-gen" style="opacity:.3">
                    <rect x="280" y="122" width="150" height="54" rx="3" />
                    <text x="355" y="138" text-anchor="middle">SHARED NOISE LFSR</text>
                    <text class="ym-noise-hz" x="355" y="157" text-anchor="middle">P0 · 125000Hz</text>
                </g>

                <g class="ym-env-gen" style="opacity:.3">
                    <rect x="445" y="122" width="195" height="54" rx="3" />
                    <text x="455" y="138">SHARED 5-BIT ENVELOPE</text>
                    <text class="ym-env-hz" x="455" y="151">P0000 · 7812.5Hz</text>
                    <text class="ym-env-shape-label" x="455" y="165">SHAPE 0</text>
                    <path class="ym-env-shape-preview" d="M 483 133 L 519 133 L 555 133" />
                    <rect x="560" y="163" width="76" height="5" class="ym-envelope-meter-bg" />
                    <rect class="ym-env-level" x="560" y="163" width="0" height="5" />
                </g>

                <g class="ym-ioports">
                    <rect x="655" y="122" width="190" height="54" rx="3" />
                    <text x="665" y="138">PARALLEL I/O REGISTERS</text>
                    <text x="665" y="154">A · R14</text>
                    <text class="ym-port-a-value" x="665" y="169">$00 / OUT</text>
                    <text x="755" y="154">B · R15</text>
                    <text class="ym-port-b-value" x="755" y="169">$00 / OUT</text>
                </g>

                <g class="ym-channel ym-tone-a">
                    <rect x="55" y="190" width="145" height="52" rx="3" />
                    <text x="67" y="207">TONE A · R00/R01</text>
                    <text class="ym-tone-a-hz" x="67" y="226">P000 · 125000Hz</text>
                </g>
                <g class="ym-channel ym-tone-b">
                    <rect x="55" y="258" width="145" height="52" rx="3" />
                    <text x="67" y="275">TONE B · R02/R03</text>
                    <text class="ym-tone-b-hz" x="67" y="294">P000 · 125000Hz</text>
                </g>
                <g class="ym-channel ym-tone-c">
                    <rect x="55" y="326" width="145" height="52" rx="3" />
                    <text x="67" y="343">TONE C · R04/R05</text>
                    <text class="ym-tone-c-hz" x="67" y="362">P000 · 125000Hz</text>
                </g>

                <g class="ym-gates">
                    <rect x="280" y="190" width="145" height="52" rx="3" />
                    <text x="352" y="207" text-anchor="middle">A · TONE / NOISE</text>
                    <rect class="mix-t-a" x="302" y="217" width="10" height="10" />
                    <text x="317" y="226">T</text><rect class="mix-n-a" x="345" y="217" width="10" height="10" />
                    <text x="360" y="226">N</text>
                    <rect x="280" y="258" width="145" height="52" rx="3" />
                    <text x="352" y="275" text-anchor="middle">B · TONE / NOISE</text>
                    <rect class="mix-t-b" x="302" y="285" width="10" height="10" />
                    <text x="317" y="294">T</text><rect class="mix-n-b" x="345" y="285" width="10" height="10" />
                    <text x="360" y="294">N</text>
                    <rect x="280" y="326" width="145" height="52" rx="3" />
                    <text x="352" y="343" text-anchor="middle">C · TONE / NOISE</text>
                    <rect class="mix-t-c" x="302" y="353" width="10" height="10" />
                    <text x="317" y="362">T</text><rect class="mix-n-c" x="345" y="353" width="10" height="10" />
                    <text x="360" y="362">N</text>
                </g>

                <g class="ym-dac ym-dac-a">
                    <rect x="485" y="190" width="155" height="52" rx="3" />
                    <text x="562" y="208" text-anchor="middle">VOLUME / DAC A · R08</text>
                    <text class="ym-dac-value" x="562" y="227" text-anchor="middle">FIX 0/15</text>
                </g>
                <g class="ym-dac ym-dac-b">
                    <rect x="485" y="258" width="155" height="52" rx="3" />
                    <text x="562" y="276" text-anchor="middle">VOLUME / DAC B · R09</text>
                    <text class="ym-dac-value" x="562" y="295" text-anchor="middle">FIX 0/15</text>
                </g>
                <g class="ym-dac ym-dac-c">
                    <rect x="485" y="326" width="155" height="52" rx="3" />
                    <text x="562" y="344" text-anchor="middle">VOLUME / DAC C · R10</text>
                    <text class="ym-dac-value" x="562" y="363" text-anchor="middle">FIX 0/15</text>
                </g>

                <path class="silicon-bus-wire" d="M 200 216 H 230 V 235 H 250 Q 257 228 264 235 H 280" /><path class="silicon-bus-packet sig-tone-a" d="M 200 216 H 230 V 235 H 250 Q 257 228 264 235 H 280" />
                <path class="silicon-bus-wire" d="M 200 284 H 230 V 303 H 250 Q 257 296 264 303 H 280" /><path class="silicon-bus-packet sig-tone-b" d="M 200 284 H 230 V 303 H 250 Q 257 296 264 303 H 280" />
                <path class="silicon-bus-wire" d="M 200 352 H 230 V 371 H 250 Q 257 364 264 371 H 280" /><path class="silicon-bus-packet sig-tone-c" d="M 200 352 H 230 V 371 H 250 Q 257 364 264 371 H 280" />
                <path class="silicon-bus-wire" d="M 430 148 H 455 V 184 H 257 V 216 H 280" />
                <path class="silicon-bus-packet sig-noise-a" d="M 430 148 H 455 V 184 H 257 V 216 H 280" />
                <path class="silicon-bus-wire" d="M 257 216 V 229 M 257 241 V 284 H 280 M 257 284 V 297 M 257 309 V 352 H 280" />
                <path class="silicon-bus-packet sig-noise-b" d="M 257 216 V 229 M 257 241 V 284 H 280" />
                <path class="silicon-bus-packet sig-noise-c" d="M 257 284 V 297 M 257 309 V 352 H 280" />
                <path class="silicon-bus-wire" d="M 425 216 H 485" /><path class="silicon-bus-packet sig-mix-a" d="M 425 216 H 485" />
                <path class="silicon-bus-wire" d="M 425 284 H 485" /><path class="silicon-bus-packet sig-mix-b" d="M 425 284 H 485" />
                <path class="silicon-bus-wire" d="M 425 352 H 485" /><path class="silicon-bus-packet sig-mix-c" d="M 425 352 H 485" />
                <path class="silicon-bus-wire" d="M 640 216 H 690 V 390 H 203 V 420" /><path class="silicon-bus-packet sig-out-a" d="M 640 216 H 690 V 390 H 203 V 420" />
                <path class="silicon-bus-wire" d="M 640 284 H 710 V 396 H 165 V 420" /><path class="silicon-bus-packet sig-out-b" d="M 640 284 H 710 V 396 H 165 V 420" />
                <path class="silicon-bus-wire" d="M 640 352 H 835 V 35 H 165 V 55" /><path class="silicon-bus-packet sig-out-c" d="M 640 352 H 835 V 35 H 165 V 55" />

                <g class="ym-board">
                    <rect x="900" y="95" width="310" height="295" rx="6" />
                    <text x="1055" y="120" class="ym-board-title" text-anchor="middle">ATARI ST · BOARD MODEL</text>
                    <text x="1055" y="139" class="ym-board-note" text-anchor="middle">EXTERNAL TO YM2149</text>
                    <rect x="955" y="180" width="200" height="78" rx="4" />
                    <text x="1055" y="198" text-anchor="middle">PSG OUTPUTS → SUM NODE</text>
                    <text x="1055" y="211" text-anchor="middle">A/4 · B/3 · C/38</text>
                    <path class="silicon-bus-wire" d="M 203 420 L 213 430 V 442 H 880 V 219 H 955" /><path class="silicon-bus-packet ym-board-in-a" d="M 203 420 L 213 430 V 442 H 880 V 219 H 955" />
                    <path class="silicon-bus-wire" d="M 165 420 L 177 432 V 454 H 890 V 230 H 955" /><path class="silicon-bus-packet ym-board-in-b" d="M 165 420 L 177 432 V 454 H 890 V 230 H 955" />
                    <path class="silicon-bus-wire" d="M 165 55 V 30 H 900 V 241 H 955" /><path class="silicon-bus-packet ym-board-in-c" d="M 165 55 V 30 H 900 V 241 H 955" />
                    <path class="silicon-bus-wire" d="M 955 219 H 1000 V 224 H 1047 M 955 230 H 1047 M 955 241 H 1000 V 236 H 1047" />
                    <path class="silicon-bus-packet ym-board-sum-feed" d="M 955 219 H 1000 V 224 H 1047 M 955 230 H 1047 M 955 241 H 1000 V 236 H 1047" />
                    <circle class="ym-board-sum" cx="1055" cy="230" r="8" fill="var(--highlight-color)" opacity=".25" />
                    <text x="1055" y="278" text-anchor="middle">RESISTIVE SUM / MONO PATH</text>
                    <path class="silicon-bus-wire" d="M 1055 238 H 1175 V 315 H 1080" />
                    <path class="silicon-bus-packet ym-board-out" d="M 1055 238 H 1175 V 315 H 1080" />
                    <rect x="1030" y="300" width="50" height="30" rx="3" />
                    <text x="1055" y="319" text-anchor="middle">ST AUDIO</text>
                    <text x="1055" y="357" class="ym-board-note" text-anchor="middle">BOARD MIX IS SCHEMATIC</text>
                </g>
            </svg>
        `;
    }
}

function portDirection(mixerRegister, bit) {
    return ((mixerRegister >> bit) & 1) ? 'IN' : 'OUT';
}
