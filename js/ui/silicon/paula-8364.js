// === js/ui/silicon/paula-8364.js ===
// =========================================================
// MOS 8364 (PAULA) & AMIGA 500 BOARD LIVING SILICON VISUALIZER
// Zero-Allocation, Zero-Clipping, Schematic-Grade Routing:
// - 4x Agnus/Paula DMA Channels with Live 6-Bit Volume Bars & Register Readout
// - Dual 14-Bit Multiplying DACs (8x6 Bit) with Live 192kHz ZOH Staircase Scope
// - On-Die DMA/Clock Control Core (3.55MHz PAL, DMACON D0-D3 LEDs, 2-Byte FIFO)
// - External Amiga 500 Board Stage: LF347 Slew + 4.42kHz Static RC + 3.5% Bleed
// - Left/Right 3.09kHz 12dB Butterworth LED Filters with Live Response Curves
// =========================================================

import { BaseChip } from './base-chip.js';

const CHANNELS = [
    { index: 0, output: 'L' },
    { index: 3, output: 'L' },
    { index: 1, output: 'R' },
    { index: 2, output: 'R' }
];

export class Paula8364 extends BaseChip {
    constructor(container) {
        super(container);
        this.lastFilterState = -99;
        this.lastOverrideState = -99;
        this.zohPhaseL = 0.0;
        this.zohPhaseR = 0.0;
    }

    generatePaulaPins() {
        const pinsPerSide = 24;
        const startX = 35;
        const width = 450;
        const spacing = width / pinsPerSide;
        const pinWidth = 8;
        let pins = '';

        for (let i = 0; i < pinsPerSide; i++) {
            const x = startX + i * spacing + (spacing - pinWidth) / 2;
            const topPin = 48 - i;
            const bottomPin = i + 1;
            pins += `<rect class="silicon-pin pin-paula-${topPin}" x="${x}" y="8" width="${pinWidth}" height="19" rx="1" />`;
            pins += `<rect class="silicon-pin pin-paula-${bottomPin}" x="${x}" y="225" width="${pinWidth}" height="19" rx="1" />`;
            pins += `<text class="paula-pin-number${topPin === 32 || topPin === 33 ? ' paula-audio-pin' : ''}" x="${x + pinWidth / 2}" y="33" text-anchor="middle">${topPin}</text>`;
            pins += `<text class="paula-pin-number" x="${x + pinWidth / 2}" y="222" text-anchor="middle">${bottomPin}</text>`;
        }

        return pins;
    }

    cacheDOM() {
        const q = (sel) => this.container.querySelector(sel);
        this.cache = {
            diagVals: this.container.querySelectorAll('.silicon-diagnostics .d-val'),
            diagLbls: this.container.querySelectorAll('.silicon-diagnostics .d-lbl'),

            channels: CHANNELS.map(({ index }) => q(`.paula-channel-${index}`)),
            states: CHANNELS.map(({ index }) => q(`.paula-channel-state-${index}`)),
            registers: CHANNELS.map(({ index }) => q(`.paula-channel-registers-${index}`)),
            volBars: CHANNELS.map(({ index }) => q(`.paula-vol-bar-${index}`)),
            volTexts: CHANNELS.map(({ index }) => q(`.paula-vol-txt-${index}`)),
            paths: CHANNELS.map(({ index }) => q(`.sig-path-${index}`)),
            dmaLeds: [q('.paula-dmacon-0'), q('.paula-dmacon-1'), q('.paula-dmacon-2'), q('.paula-dmacon-3')],

            mixL: q('.paula-mix-l'),
            mixR: q('.paula-mix-r'),
            zohPathL: q('.paula-zoh-wave-l'),
            zohPathR: q('.paula-zoh-wave-r'),
            coreBlock: q('.paula-core-ctrl'),
            fifoStatus: q('.paula-fifo-status'),

            sigDacL: q('.sig-dac-l'),
            sigDacR: q('.sig-dac-r'),
            sigOutL: q('.sig-path-out-l'),
            sigOutR: q('.sig-path-out-r'),

            rcStage: q('.paula-rc-stage'),
            filtL: q('.paula-filt-l'),
            filtR: q('.paula-filt-r'),
            filtCurveL: q('.paula-filt-curve-l'),
            filtCurveR: q('.paula-filt-curve-r'),
            filtBarL: q('.paula-filt-bar-l'),
            filtBarR: q('.paula-filt-bar-r'),
            filterStatus: q('.paula-filter-status'),

            pinOutL: q('.pin-paula-32'),
            pinOutR: q('.pin-paula-33'),
            pinClk: q('.pin-paula-6'),
            pinDmaL: q('.pin-paula-15')
        };

        if (this.cache.diagLbls && this.cache.diagLbls.length >= 4) {
            this.cache.diagLbls[0].textContent = 'PAL CLK';
            this.cache.diagLbls[1].textContent = 'DMACON';
            this.cache.diagLbls[2].textContent = 'ZOH DAC';
            this.cache.diagLbls[3].textContent = 'LED FILT';
        }
    }

    buildZohStaircasePath(x0, yMid, width, maxAmp, level, phase) {
        const steps = 8;
        const stepW = width / steps;
        const amp = Math.max(1.0, Math.min(maxAmp, level * maxAmp));
        let d = '';
        for (let s = 0; s < steps; s++) {
            const xStart = Math.round(x0 + s * stepW);
            const xEnd = Math.round(x0 + (s + 1) * stepW);
            const sampleQuant = Math.round(Math.sin(phase + s * 0.85) * 3.0) / 3.0;
            const y = Math.round(yMid - (level > 0.02 ? sampleQuant * amp : 0));
            if (s === 0) {
                d += `M ${xStart} ${y} L ${xEnd} ${y}`;
            } else {
                d += ` L ${xStart} ${y} L ${xEnd} ${y}`;
            }
        }
        return d;
    }

    update(vols, regs, t = 0) {
        if (!regs) return;

        const levels = [vols[0] || 0, vols[1] || 0, vols[2] || 0, vols[3] || 0];
        const rawMask = regs[31] || regs[28] || 0;
        const setGlow = (el, value) => {
            if (el) el.style.opacity = 0.35 + Math.min(1, value) * 0.65;
        };

        let activeChannelCount = 0;
        let avgPeriodL = 428;
        let avgPeriodR = 428;

        for (let i = 0; i < CHANNELS.length; i++) {
            const { index, output } = CHANNELS[i];
            const offset = index * 7;
            const lc = ((regs[offset] || 0) << 8) | (regs[offset + 1] || 0);
            const length = ((regs[offset + 2] || 0) << 8) | (regs[offset + 3] || 0);
            const period = ((regs[offset + 4] || 0) << 8) | (regs[offset + 5] || 0);
            const volume = Math.min(64, regs[offset + 6] || 0);
            const level = levels[index];

            // Fallback-safe DMA detection (works via explicit mask OR active register/level state)
            const dmaActive = ((rawMask & (1 << index)) !== 0) || (level > 0.005) || (length > 0 && volume > 0 && period > 0);
            if (dmaActive) activeChannelCount++;

            if (output === 'L' && period > 0) avgPeriodL = period;
            if (output === 'R' && period > 0) avgPeriodR = period;

            const hz = (dmaActive && period > 0) ? Math.round(3546895 / period) : 0;
            const freqStr = hz > 0 ? `${hz}Hz` : 'IDLE';

            if (this.cache.states[i]) {
                const stTxt = `${dmaActive ? 'DMA ON' : 'DMA OFF'} · ${freqStr}`;
                if (this.cache.states[i].textContent !== stTxt) {
                    this.cache.states[i].textContent = stTxt;
                }
            }
            if (this.cache.registers[i]) {
                const regTxt = `LC:$${lc.toString(16).padStart(4, '0').toUpperCase()} LEN:${length} PER:${period}`;
                if (this.cache.registers[i].textContent !== regTxt) {
                    this.cache.registers[i].textContent = regTxt;
                }
            }
            if (this.cache.volBars[i]) {
                const barW = Math.round((volume / 64.0) * 130);
                this.cache.volBars[i].setAttribute('width', barW);
            }
            if (this.cache.volTexts[i]) {
                const vTxt = `V:${volume.toString().padStart(2, '0')}`;
                if (this.cache.volTexts[i].textContent !== vTxt) {
                    this.cache.volTexts[i].textContent = vTxt;
                }
            }
            if (this.cache.dmaLeds[index]) {
                this.cache.dmaLeds[index].style.fill = dmaActive ? 'var(--highlight-color)' : 'var(--chassis-dark)';
            }

            setGlow(this.cache.channels[i], dmaActive ? Math.max(level, 0.35) : 0);
            this.updateBusFlow(this.cache.paths[i], level);
        }

        const outL = Math.min(1.0, (levels[0] + levels[3]) * 0.65);
        const outR = Math.min(1.0, (levels[1] + levels[2]) * 0.65);
        const totalOut = Math.max(outL, outR);

        setGlow(this.cache.mixL, outL);
        setGlow(this.cache.mixR, outR);
        setGlow(this.cache.coreBlock, activeChannelCount > 0 ? 0.55 + totalOut * 0.45 : 0.25);

        if (this.cache.fifoStatus) {
            const fifoTxt = activeChannelCount > 0 ? `FIFO: ${activeChannelCount}CH WORD-FETCH` : 'FIFO: STANDBY';
            if (this.cache.fifoStatus.textContent !== fifoTxt) {
                this.cache.fifoStatus.textContent = fifoTxt;
            }
        }

        // Update Live 192kHz ZOH Staircase Scopes inside Left & Right MDACs
        this.zohPhaseL = (this.zohPhaseL + (outL > 0.02 ? (600.0 / Math.max(113, avgPeriodL)) : 0)) % (Math.PI * 2);
        this.zohPhaseR = (this.zohPhaseR + (outR > 0.02 ? (600.0 / Math.max(113, avgPeriodR)) : 0)) % (Math.PI * 2);

        if (this.cache.zohPathL) {
            this.cache.zohPathL.setAttribute('d', this.buildZohStaircasePath(260, 108, 92, 9.5, outL, this.zohPhaseL));
        }
        if (this.cache.zohPathR) {
            this.cache.zohPathR.setAttribute('d', this.buildZohStaircasePath(260, 184, 92, 9.5, outR, this.zohPhaseR));
        }

        // Bus & Pin Glows
        this.updateBusFlow(this.cache.sigDacL, outL);
        this.updateBusFlow(this.cache.sigDacR, outR);
        this.updateBusFlow(this.cache.sigOutL, outL);
        this.updateBusFlow(this.cache.sigOutR, outR);
        this.updatePinGlow(this.cache.pinOutL, outL);
        this.updatePinGlow(this.cache.pinOutR, outR);
        this.updatePinGlow(this.cache.pinClk, 0.45 + 0.35 * Math.sin(t * 20.0));
        this.updatePinGlow(this.cache.pinDmaL, activeChannelCount > 0 ? 0.85 : 0.0);

        // External Amiga 500 Motherboard Filter Stage
        setGlow(this.cache.rcStage, totalOut);

        const filterState = regs[29];
        const overrideState = regs[30] || 0;
        const filterOn = filterState === 1;

        if (this.lastFilterState !== filterState || this.lastOverrideState !== overrideState) {
            this.lastFilterState = filterState;
            this.lastOverrideState = overrideState;

            const modeSuffix = overrideState > 0 ? ' [OVR]' : '';
            if (this.cache.filterStatus) {
                this.cache.filterStatus.textContent = filterOn
                    ? `LED FILTER: ACTIVE 3.09kHz${modeSuffix}`
                    : `LED FILTER: BYPASS${modeSuffix}`;
            }

            // Morph Filter Response Curve between 3.09kHz 12dB Butterworth Roll-Off and Flat Passband
            const curveL = filterOn
                ? 'M 684 122 L 722 122 Q 736 122 744 132 L 764 143'
                : 'M 684 122 L 752 122 Q 760 122 764 128';
            const curveR = filterOn
                ? 'M 684 176 L 722 176 Q 736 176 744 186 L 764 197'
                : 'M 684 176 L 752 176 Q 760 176 764 182';

            if (this.cache.filtCurveL) this.cache.filtCurveL.setAttribute('d', curveL);
            if (this.cache.filtCurveR) this.cache.filtCurveR.setAttribute('d', curveR);
        }

        if (this.cache.filtBarL) this.cache.filtBarL.setAttribute('width', Math.round(outL * 96));
        if (this.cache.filtBarR) this.cache.filtBarR.setAttribute('width', Math.round(outR * 96));

        for (const [filter, level] of [[this.cache.filtL, outL], [this.cache.filtR, outR]]) {
            if (!filter) continue;
            filter.style.opacity = filterOn ? 0.45 + level * 0.55 : 0.30 + level * 0.40;
            filter.style.filter = filterOn && level > 0.1
                ? `drop-shadow(0 0 ${level * 6}px var(--bus-active-color))`
                : 'none';
        }

        // Side Chassis Diagnostics
        if (this.cache.diagVals && this.cache.diagVals.length >= 4) {
            const dmaStr = `${activeChannelCount}/4 CH`;
            const zohStr = activeChannelCount > 0 ? '192k 14B' : 'STANDBY';
            const ledStr = filterOn ? '3.09k ON' : 'BYPASS';
            if (this.cache.diagVals[1].textContent !== dmaStr) this.cache.diagVals[1].textContent = dmaStr;
            if (this.cache.diagVals[2].textContent !== zohStr) this.cache.diagVals[2].textContent = zohStr;
            if (this.cache.diagVals[3].textContent !== ledStr) this.cache.diagVals[3].textContent = ledStr;
        }
    }

    getSvg() {
        return `
            <svg class="paula-visualization" viewBox="0 -42 800 305" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="paula-title paula-description">
                <title id="paula-title">MOS 8364 Paula &amp; Amiga 500 Audio Signalfluss</title>
                <desc id="paula-description">Vier Agnus/Paula DMA-Kanäle speisen zwei 14-Bit Multiplying DACs mit 192 kHz Zero-Order Hold. Über Pin 32 und Pin 33 gelangt das Stereosignal in die externe Amiga-500-Mainboard-Filterstufe (LF347 Op-Amp, 4.42 kHz RC-Tiefpass und schaltbares 3.09 kHz Butterworth LED-Filter).</desc>
                <defs>
                    <marker id="paula-arrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
                        <path d="M 0 0 L 5 2.5 L 0 5 Z" fill="var(--bus-active-color)" />
                    </marker>
                </defs>

                <!-- =========================================================
                     1. MOS 8364 PAULA DIP-48 PACKAGE & DIE CAVITY
                     ========================================================= -->
                <rect class="silicon-chip-body" x="20" y="27" width="480" height="199" rx="7" />
                <path d="M 20 88 A 15 15 0 0 1 20 118 Z" fill="var(--chassis-dark)" />
                <circle cx="39" cy="45" r="4" fill="var(--chassis-dark)" />
                ${this.generatePaulaPins()}
                <text x="260" y="40" class="silicon-chip-label" fill="var(--panel-text)" text-anchor="middle">MOS 8364 PAULA · 4-CHANNEL DMA &amp; 14-BIT MDAC</text>
                
                <!-- Silicon Die Cavity -->
                <rect x="34" y="48" width="452" height="164" rx="3" fill="var(--screen-bg)" stroke="var(--chassis-dark)" stroke-width="1.5" />
                <text x="42" y="57" class="paula-section-label" fill="var(--panel-text)">AGNUS/PAULA DMA CHANNELS (L-R-R-L)</text>
                <text x="306" y="57" class="paula-section-label" fill="var(--panel-text)" text-anchor="middle">14-BIT MDAC + ZOH</text>
                <text x="429" y="57" class="paula-section-label" fill="var(--panel-text)" text-anchor="middle">DMA CORE</text>

                <!-- =========================================================
                     2. FOUR AUDIO DMA CHANNELS (WIDTH 192px -> ZERO CLIPPING!)
                     ========================================================= -->
                <!-- CH 0 (LEFT) -->
                <g class="paula-channel-0" style="opacity:0.35">
                    <rect x="42" y="61" width="192" height="33" rx="2" fill="none" stroke="var(--text-color)" />
                    <text x="48" y="70" class="paula-channel-name" fill="var(--text-color)">CH 0 · LEFT</text>
                    <text x="228" y="70" class="paula-channel-state paula-channel-state-0" fill="var(--highlight-color)" text-anchor="end">DMA OFF · IDLE</text>
                    <text x="48" y="80" class="paula-channel-registers paula-channel-registers-0" fill="var(--text-color)">LC:$0000 LEN:0 PER:0</text>
                    <rect x="48" y="85" width="130" height="4" fill="var(--chassis-dark)" />
                    <rect class="paula-vol-bar-0" x="48" y="85" width="0" height="4" fill="var(--highlight-color)" />
                    <text x="228" y="89" class="paula-channel-registers paula-vol-txt-0" fill="var(--highlight-color)" text-anchor="end">V:00</text>
                </g>

                <!-- CH 3 (LEFT) -->
                <g class="paula-channel-3" style="opacity:0.35">
                    <rect x="42" y="98" width="192" height="33" rx="2" fill="none" stroke="var(--text-color)" />
                    <text x="48" y="107" class="paula-channel-name" fill="var(--text-color)">CH 3 · LEFT</text>
                    <text x="228" y="107" class="paula-channel-state paula-channel-state-3" fill="var(--highlight-color)" text-anchor="end">DMA OFF · IDLE</text>
                    <text x="48" y="117" class="paula-channel-registers paula-channel-registers-3" fill="var(--text-color)">LC:$0000 LEN:0 PER:0</text>
                    <rect x="48" y="122" width="130" height="4" fill="var(--chassis-dark)" />
                    <rect class="paula-vol-bar-3" x="48" y="122" width="0" height="4" fill="var(--highlight-color)" />
                    <text x="228" y="126" class="paula-channel-registers paula-vol-txt-3" fill="var(--highlight-color)" text-anchor="end">V:00</text>
                </g>

                <!-- CH 1 (RIGHT) -->
                <g class="paula-channel-1" style="opacity:0.35">
                    <rect x="42" y="135" width="192" height="33" rx="2" fill="none" stroke="var(--text-color)" />
                    <text x="48" y="144" class="paula-channel-name" fill="var(--text-color)">CH 1 · RIGHT</text>
                    <text x="228" y="144" class="paula-channel-state paula-channel-state-1" fill="var(--highlight-color)" text-anchor="end">DMA OFF · IDLE</text>
                    <text x="48" y="154" class="paula-channel-registers paula-channel-registers-1" fill="var(--text-color)">LC:$0000 LEN:0 PER:0</text>
                    <rect x="48" y="159" width="130" height="4" fill="var(--chassis-dark)" />
                    <rect class="paula-vol-bar-1" x="48" y="159" width="0" height="4" fill="var(--highlight-color)" />
                    <text x="228" y="163" class="paula-channel-registers paula-vol-txt-1" fill="var(--highlight-color)" text-anchor="end">V:00</text>
                </g>

                <!-- CH 2 (RIGHT) -->
                <g class="paula-channel-2" style="opacity:0.35">
                    <rect x="42" y="172" width="192" height="33" rx="2" fill="none" stroke="var(--text-color)" />
                    <text x="48" y="181" class="paula-channel-name" fill="var(--text-color)">CH 2 · RIGHT</text>
                    <text x="228" y="181" class="paula-channel-state paula-channel-state-2" fill="var(--highlight-color)" text-anchor="end">DMA OFF · IDLE</text>
                    <text x="48" y="191" class="paula-channel-registers paula-channel-registers-2" fill="var(--text-color)">LC:$0000 LEN:0 PER:0</text>
                    <rect x="48" y="196" width="130" height="4" fill="var(--chassis-dark)" />
                    <rect class="paula-vol-bar-2" x="48" y="196" width="0" height="4" fill="var(--highlight-color)" />
                    <text x="228" y="200" class="paula-channel-registers paula-vol-txt-2" fill="var(--highlight-color)" text-anchor="end">V:00</text>
                </g>

                <!-- Uncrossed Channel-to-MDAC Buses -->
                <path class="silicon-bus-wire" d="M 234 77 L 252 77" marker-end="url(#paula-arrow)" />
                <path class="silicon-bus-packet sig-path-0" d="M 234 77 L 252 77" />
                <path class="silicon-bus-wire" d="M 234 114 L 252 114" marker-end="url(#paula-arrow)" />
                <path class="silicon-bus-packet sig-path-3" d="M 234 114 L 252 114" />
                <path class="silicon-bus-wire" d="M 234 151 L 252 151" marker-end="url(#paula-arrow)" />
                <path class="silicon-bus-packet sig-path-1" d="M 234 151 L 252 151" />
                <path class="silicon-bus-wire" d="M 234 188 L 252 188" marker-end="url(#paula-arrow)" />
                <path class="silicon-bus-packet sig-path-2" d="M 234 188 L 252 188" />

                <!-- =========================================================
                     3. DUAL 14-BIT MULTIPLYING DAC + 192kHz ZOH STAIRCASE
                     ========================================================= -->
                <!-- LEFT MDAC (CH 0 + CH 3) -->
                <g class="paula-mix-l" style="opacity:0.35">
                    <rect x="252" y="61" width="108" height="66" rx="3" fill="none" stroke="var(--text-color)" stroke-width="1.3" />
                    <text x="306" y="72" class="paula-stage-title" fill="var(--text-color)" text-anchor="middle">LEFT MDAC</text>
                    <text x="306" y="82" class="paula-stage-caption" fill="var(--highlight-color)" text-anchor="middle">CH0+3 · 8x6 ZOH</text>
                    <!-- Live ZOH Staircase Scope Window -->
                    <rect x="258" y="88" width="96" height="33" rx="1" fill="var(--chassis-dark)" stroke="var(--text-color)" stroke-width="0.6" />
                    <path class="paula-zoh-wave-l" d="M 260 105 L 352 105" fill="none" stroke="var(--highlight-color)" stroke-width="1.3" />
                </g>

                <!-- RIGHT MDAC (CH 1 + CH 2) -->
                <g class="paula-mix-r" style="opacity:0.35">
                    <rect x="252" y="137" width="108" height="68" rx="3" fill="none" stroke="var(--text-color)" stroke-width="1.3" />
                    <text x="306" y="148" class="paula-stage-title" fill="var(--text-color)" text-anchor="middle">RIGHT MDAC</text>
                    <text x="306" y="158" class="paula-stage-caption" fill="var(--highlight-color)" text-anchor="middle">CH1+2 · 8x6 ZOH</text>
                    <!-- Live ZOH Staircase Scope Window -->
                    <rect x="258" y="164" width="96" height="35" rx="1" fill="var(--chassis-dark)" stroke="var(--text-color)" stroke-width="0.6" />
                    <path class="paula-zoh-wave-r" d="M 260 182 L 352 182" fill="none" stroke="var(--highlight-color)" stroke-width="1.3" />
                </g>

                <!-- =========================================================
                     4. ON-DIE AGNUS/PAULA DMA & CLOCK ENGINE (RIGHT COLUMN)
                     ========================================================= -->
                <g class="paula-core-ctrl" style="opacity:0.35">
                    <rect x="376" y="61" width="102" height="144" rx="3" fill="none" stroke="var(--text-color)" stroke-width="1.2" />
                    <text x="427" y="73" class="paula-stage-title" fill="var(--text-color)" text-anchor="middle">PAULA LOGIC</text>
                    <text x="427" y="84" class="paula-stage-caption" fill="var(--highlight-color)" text-anchor="middle">3.55MHz PAL</text>

                    <rect x="383" y="92" width="88" height="24" rx="1" fill="var(--chassis-dark)" stroke="var(--text-color)" stroke-width="0.6" />
                    <text x="427" y="101" class="paula-channel-registers" fill="var(--text-color)" text-anchor="middle">ZOH OVERSAMPLE</text>
                    <text x="427" y="111" class="paula-channel-state" fill="var(--highlight-color)" text-anchor="middle">192.0 kHz (4x)</text>

                    <!-- DMACON Active Channel Gate Matrix -->
                    <text x="427" y="128" class="paula-channel-registers" fill="var(--text-color)" text-anchor="middle">DMACON GATES</text>
                    <rect class="paula-dmacon-0" x="386" y="134" width="16" height="10" rx="1" fill="var(--chassis-dark)" stroke="var(--text-color)" stroke-width="0.6" />
                    <text x="394" y="141" class="paula-pin-number" fill="var(--screen-bg)" text-anchor="middle">D0</text>
                    <rect class="paula-dmacon-1" x="408" y="134" width="16" height="10" rx="1" fill="var(--chassis-dark)" stroke="var(--text-color)" stroke-width="0.6" />
                    <text x="416" y="141" class="paula-pin-number" fill="var(--screen-bg)" text-anchor="middle">D1</text>
                    <rect class="paula-dmacon-2" x="430" y="134" width="16" height="10" rx="1" fill="var(--chassis-dark)" stroke="var(--text-color)" stroke-width="0.6" />
                    <text x="438" y="141" class="paula-pin-number" fill="var(--screen-bg)" text-anchor="middle">D2</text>
                    <rect class="paula-dmacon-3" x="452" y="134" width="16" height="10" rx="1" fill="var(--chassis-dark)" stroke="var(--text-color)" stroke-width="0.6" />
                    <text x="460" y="141" class="paula-pin-number" fill="var(--screen-bg)" text-anchor="middle">D3</text>

                    <!-- 16-Bit AUDxDAT Demux Status -->
                    <rect x="383" y="154" width="88" height="42" rx="1" fill="var(--chassis-dark)" stroke="var(--text-color)" stroke-width="0.6" />
                    <text x="427" y="166" class="paula-channel-registers" fill="var(--text-color)" text-anchor="middle">AUDxDAT DEMUX</text>
                    <text x="427" y="178" class="paula-channel-state" fill="var(--highlight-color)" text-anchor="middle">16B -&gt; HI/LO 8B</text>
                    <text x="427" y="190" class="paula-channel-registers paula-fifo-status" fill="var(--text-color)" text-anchor="middle">FIFO: STANDBY</text>
                </g>

                <!-- =========================================================
                     5. SCHEMATIC-GRADE PIN 32 & PIN 33 ROUTING TO AMIGA BOARD
                     Uses clean PCB corridors & 4px schematic jumper arcs!
                     ========================================================= -->
                <!-- LEFT: MDAC L (344.375, 61) -> Pin 32 (344.375, 8) -> Board RC (558, 74) & Board Left LED Filter (558, 126) -->
                <path class="silicon-bus-wire" d="M 344.375 61 L 344.375 8 L 344.375 -14 L 528 -14 L 528 74 L 558 74 M 528 74 L 528 126 L 558 126" marker-end="url(#paula-arrow)" />
                <path class="silicon-bus-packet sig-dac-l sig-path-out-l" d="M 344.375 61 L 344.375 8 L 344.375 -14 L 528 -14 L 528 126 L 558 126" />

                <!-- RIGHT: MDAC R (360, 171) -> Corridor x=368 -> y=53 (Jumper Arc over 344.375) -> Pin 33 (325.625, 8) -> Board Right LED Filter (558, 180) -->
                <path class="silicon-bus-wire" d="M 360 171 L 368 171 L 368 53 L 348.375 53 A 4 4 0 0 0 340.375 53 L 325.625 53 L 325.625 8 L 325.625 -28 L 512 -28 L 512 180 L 558 180" marker-end="url(#paula-arrow)" />
                <path class="silicon-bus-packet sig-dac-r sig-path-out-r" d="M 360 171 L 368 171 L 368 53 L 348.375 53 A 4 4 0 0 0 340.375 53 L 325.625 53 L 325.625 8 L 325.625 -28 L 512 -28 L 512 180 L 558 180" />

                <!-- =========================================================
                     6. EXTERNAL AMIGA 500 MOTHERBOARD ANALOG STAGE
                     ========================================================= -->
                <rect class="paula-board-frame" x="546" y="27" width="242" height="216" rx="5" fill="var(--screen-bg)" stroke="var(--chassis-light)" stroke-dasharray="5 3" />
                <text x="667" y="42" class="silicon-chip-label" fill="var(--panel-text)" text-anchor="middle">AMIGA 500 BOARD · ANALOG STAGE</text>

                <!-- Stage 6A: LF347 JFET Op-Amp Slew & 4.42kHz Static RC Lowpass -->
                <g class="paula-rc-stage" style="opacity:0.35">
                    <rect x="558" y="54" width="216" height="40" rx="3" fill="none" stroke="var(--text-color)" stroke-width="1.2" />
                    <text x="568" y="68" class="paula-stage-title" fill="var(--text-color)">LF347 OP-AMP + STATIC RC</text>
                    <text x="568" y="83" class="paula-stage-caption" fill="var(--highlight-color)">13V/us · 4.42kHz LP · 3.5% BLEED</text>
                </g>

                <!-- Stage 6B: Left 3.09kHz 12dB/oct Butterworth LED Filter -->
                <g class="paula-filt-l" style="opacity:0.35">
                    <rect x="558" y="102" width="216" height="48" rx="3" fill="none" stroke="var(--text-color)" stroke-dasharray="4 2" />
                    <text x="568" y="116" class="paula-stage-title" fill="var(--text-color)">LED FILTER · LEFT</text>
                    <text x="568" y="129" class="paula-stage-caption" fill="var(--text-color)">PIN 32 · AUDL · 12dB</text>
                    <rect x="568" y="137" width="96" height="5" fill="var(--chassis-dark)" />
                    <rect class="paula-filt-bar-l" x="568" y="137" width="0" height="5" fill="var(--highlight-color)" />
                    <!-- Mini Filter Response Curve Window -->
                    <rect x="680" y="110" width="88" height="34" rx="1" fill="var(--chassis-dark)" stroke="var(--text-color)" stroke-width="0.6" />
                    <path class="paula-filt-curve-l" d="M 684 122 L 722 122 Q 736 122 744 132 L 764 143" fill="none" stroke="var(--highlight-color)" stroke-width="1.4" />
                </g>

                <!-- Stage 6C: Right 3.09kHz 12dB/oct Butterworth LED Filter -->
                <g class="paula-filt-r" style="opacity:0.35">
                    <rect x="558" y="156" width="216" height="48" rx="3" fill="none" stroke="var(--text-color)" stroke-dasharray="4 2" />
                    <text x="568" y="170" class="paula-stage-title" fill="var(--text-color)">LED FILTER · RIGHT</text>
                    <text x="568" y="183" class="paula-stage-caption" fill="var(--text-color)">PIN 33 · AUDR · 12dB</text>
                    <rect x="568" y="191" width="96" height="5" fill="var(--chassis-dark)" />
                    <rect class="paula-filt-bar-r" x="568" y="191" width="0" height="5" fill="var(--highlight-color)" />
                    <!-- Mini Filter Response Curve Window -->
                    <rect x="680" y="164" width="88" height="34" rx="1" fill="var(--chassis-dark)" stroke="var(--text-color)" stroke-width="0.6" />
                    <path class="paula-filt-curve-r" d="M 684 176 L 722 176 Q 736 176 744 186 L 764 197" fill="none" stroke="var(--highlight-color)" stroke-width="1.4" />
                </g>

                <!-- Clean RCA Output Arrows Exiting Right Edge of Filter Stages -->
                <path class="silicon-bus-wire" d="M 774 126 L 794 126" marker-end="url(#paula-arrow)" />
                <path class="silicon-bus-wire" d="M 774 180 L 794 180" marker-end="url(#paula-arrow)" />

                <text x="667" y="226" class="paula-filter-status" fill="var(--highlight-color)" text-anchor="middle">LED FILTER: ACTIVE 3.09kHz</text>
            </svg>
        `;
    }
}