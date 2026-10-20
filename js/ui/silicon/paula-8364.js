// === js/ui/silicon/paula-8364.js ===
// =========================================================
// MOS 8364 (PAULA) SIGNAL-FLOW VISUALIZER
// Paula audio paths and the external board model are shown as separate stages.
// =========================================================

import { BaseChip } from './base-chip.js';

const CHANNELS = [
    { index: 0, output: 'L' },
    { index: 3, output: 'L' },
    { index: 1, output: 'R' },
    { index: 2, output: 'R' }
];

export class Paula8364 extends BaseChip {
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
            pins += `<text class="paula-pin-number${bottomPin === 32 || bottomPin === 33 ? ' paula-audio-pin' : ''}" x="${x + pinWidth / 2}" y="222" text-anchor="middle">${bottomPin}</text>`;
        }

        return pins;
    }

    cacheDOM() {
        this.cache = {
            channels: CHANNELS.map(({ index }) => this.container.querySelector(`.paula-channel-${index}`)),
            states: CHANNELS.map(({ index }) => this.container.querySelector(`.paula-channel-state-${index}`)),
            registers: CHANNELS.map(({ index }) => this.container.querySelector(`.paula-channel-registers-${index}`)),
            paths: CHANNELS.map(({ index }) => this.container.querySelector(`.sig-path-${index}`)),
            mixL: this.container.querySelector('.paula-mix-l'),
            mixR: this.container.querySelector('.paula-mix-r'),
            sigDacL: this.container.querySelector('.sig-dac-l'),
            sigDacR: this.container.querySelector('.sig-dac-r'),
            sigOutL: this.container.querySelector('.sig-path-out-l'),
            sigOutR: this.container.querySelector('.sig-path-out-r'),
            filtL: this.container.querySelector('.paula-filt-l'),
            filtR: this.container.querySelector('.paula-filt-r'),
            filterStatus: this.container.querySelector('.paula-filter-status'),
            pinOutL: this.container.querySelector('.pin-paula-32'),
            pinOutR: this.container.querySelector('.pin-paula-33')
        };
    }

    update(vols, regs) {
        if (!regs) return;

        const levels = [vols[0] || 0, vols[1] || 0, vols[2] || 0, vols[3] || 0];
        const activeMask = regs[31] || 0;
        const setGlow = (el, value) => {
            if (el) el.style.opacity = 0.45 + Math.min(1, value) * 0.55;
        };

        for (let i = 0; i < CHANNELS.length; i++) {
            const { index, output } = CHANNELS[i];
            const offset = index * 7;
            const lc = ((regs[offset] || 0) << 8) | (regs[offset + 1] || 0);
            const length = ((regs[offset + 2] || 0) << 8) | (regs[offset + 3] || 0);
            const period = ((regs[offset + 4] || 0) << 8) | (regs[offset + 5] || 0);
            const volume = regs[offset + 6] || 0;
            const frequency = period > 0 ? `${Math.round(3546895 / period)} Hz` : 'IDLE';
            const dmaActive = (activeMask & (1 << index)) !== 0;
            const level = levels[index];

            if (this.cache.states[i]) this.cache.states[i].textContent =
                `${dmaActive ? 'DMA ON' : 'DMA OFF'} · ${frequency.replace(' ', '')} · VOL ${volume}/64`;
            if (this.cache.registers[i]) this.cache.registers[i].textContent =
                `LC16 $${lc.toString(16).padStart(4, '0').toUpperCase()} · LEN ${length} · PER ${period}`;
            setGlow(this.cache.channels[i], dmaActive ? Math.max(level, 0.35) : 0);
            this.updateBusFlow(this.cache.paths[i], level);
        }

        const outL = (levels[0] + levels[3]) * 0.5;
        const outR = (levels[1] + levels[2]) * 0.5;
        setGlow(this.cache.mixL, outL);
        setGlow(this.cache.mixR, outR);

        this.updateBusFlow(this.cache.sigDacL, outL);
        this.updateBusFlow(this.cache.sigDacR, outR);
        this.updateBusFlow(this.cache.sigOutL, outL);
        this.updateBusFlow(this.cache.sigOutR, outR);
        this.updatePinGlow(this.cache.pinOutL, outL);
        this.updatePinGlow(this.cache.pinOutR, outR);

        const filterState = regs[29];
        const filterKnown = filterState === 0 || filterState === 1;
        const filterOn = filterState === 1;
        if (this.cache.filterStatus) {
            this.cache.filterStatus.textContent = filterKnown
                ? `LED FILTER: ${filterOn ? 'ACTIVE' : 'BYPASS'}`
                : 'LED FILTER: NOT MODELED';
        }

        for (const [filter, level] of [[this.cache.filtL, outL], [this.cache.filtR, outR]]) {
            if (!filter) continue;
            filter.style.opacity = filterKnown && filterOn ? 0.35 + level * 0.65 : 0.22;
            filter.style.filter = filterKnown && filterOn && level > 0.1
                ? `drop-shadow(0 0 ${level * 8}px var(--bus-active-color))`
                : 'none';
        }
    }

    getSvg() {
        return `
            <svg class="paula-visualization" viewBox="0 -55 800 355" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="paula-title paula-description">
                <title id="paula-title">Paula 8364 Signalfluss</title>
                <desc id="paula-description">Vier Paula-Audiokanäle speisen die Links-Rechts-Mischung. Die Ausgänge an Pin 32 und 33 führen zu separat dargestellten Amiga-Board-Filterstufen.</desc>
                <defs>
                    <marker id="paula-arrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
                        <path d="M 0 0 L 5 2.5 L 0 5 Z" fill="var(--bus-active-color)" />
                    </marker>
                </defs>

                <!-- Paula package and pin rows -->
                <rect class="silicon-chip-body" x="20" y="27" width="480" height="199" rx="7" />
                <path d="M 20 88 A 15 15 0 0 1 20 118 Z" fill="var(--chassis-dark)" />
                <circle cx="39" cy="45" r="4" fill="var(--chassis-dark)" />
                ${this.generatePaulaPins()}
                <text x="260" y="40" class="silicon-chip-label" fill="var(--panel-text)" text-anchor="middle">MOS 8364 PAULA · AUDIO MODEL</text>
                <rect x="34" y="48" width="452" height="163" rx="3" fill="var(--screen-bg)" stroke="var(--chassis-dark)" stroke-width="1.5" />
                <text x="44" y="59" class="paula-section-label" fill="var(--panel-text)">PAULA · FOUR AUDIO CHANNELS</text>

                <!-- Channel lanes are ordered by their modeled L/R destination to keep traces uncrossed. -->
                <g class="paula-channel-0" style="opacity:0.22">
                    <rect x="45" y="59" width="145" height="32" rx="2" fill="none" stroke="var(--text-color)" />
                    <text x="52" y="68" class="paula-channel-name" fill="var(--text-color)">CH 0 · LEFT</text>
                    <text x="52" y="78" class="paula-channel-state paula-channel-state-0" fill="var(--highlight-color)">DMA OFF · IDLE · VOL 0/64</text>
                    <text x="52" y="87" class="paula-channel-registers paula-channel-registers-0" fill="var(--text-color)">LC16 $0000 · LEN 0 · PER 0</text>
                </g>
                <g class="paula-channel-3" style="opacity:0.22">
                    <rect x="45" y="96" width="145" height="32" rx="2" fill="none" stroke="var(--text-color)" />
                    <text x="52" y="105" class="paula-channel-name" fill="var(--text-color)">CH 3 · LEFT</text>
                    <text x="52" y="115" class="paula-channel-state paula-channel-state-3" fill="var(--highlight-color)">DMA OFF · IDLE · VOL 0/64</text>
                    <text x="52" y="124" class="paula-channel-registers paula-channel-registers-3" fill="var(--text-color)">LC16 $0000 · LEN 0 · PER 0</text>
                </g>
                <g class="paula-channel-1" style="opacity:0.22">
                    <rect x="45" y="133" width="145" height="32" rx="2" fill="none" stroke="var(--text-color)" />
                    <text x="52" y="142" class="paula-channel-name" fill="var(--text-color)">CH 1 · RIGHT</text>
                    <text x="52" y="152" class="paula-channel-state paula-channel-state-1" fill="var(--highlight-color)">DMA OFF · IDLE · VOL 0/64</text>
                    <text x="52" y="161" class="paula-channel-registers paula-channel-registers-1" fill="var(--text-color)">LC16 $0000 · LEN 0 · PER 0</text>
                </g>
                <g class="paula-channel-2" style="opacity:0.22">
                    <rect x="45" y="170" width="145" height="32" rx="2" fill="none" stroke="var(--text-color)" />
                    <text x="52" y="179" class="paula-channel-name" fill="var(--text-color)">CH 2 · RIGHT</text>
                    <text x="52" y="189" class="paula-channel-state paula-channel-state-2" fill="var(--highlight-color)">DMA OFF · IDLE · VOL 0/64</text>
                    <text x="52" y="198" class="paula-channel-registers paula-channel-registers-2" fill="var(--text-color)">LC16 $0000 · LEN 0 · PER 0</text>
                </g>

                <!-- Non-crossing channel-to-mix routes -->
                <path class="silicon-bus-wire" d="M 190 78 L 205 70" marker-end="url(#paula-arrow)" />
                <path class="silicon-bus-packet sig-path-0" d="M 190 78 L 205 70" />
                <path class="silicon-bus-wire" d="M 190 112 L 205 88" marker-end="url(#paula-arrow)" />
                <path class="silicon-bus-packet sig-path-3" d="M 190 112 L 205 88" />
                <path class="silicon-bus-wire" d="M 190 146 L 205 145" marker-end="url(#paula-arrow)" />
                <path class="silicon-bus-packet sig-path-1" d="M 190 146 L 205 145" />
                <path class="silicon-bus-wire" d="M 190 180 L 205 163" marker-end="url(#paula-arrow)" />
                <path class="silicon-bus-packet sig-path-2" d="M 190 180 L 205 163" />

                <!-- Fantasy L/R summing stages -->
                <g class="paula-mix-l" style="opacity:0.22">
                    <rect x="205" y="57" width="110" height="45" rx="3" fill="none" stroke="var(--text-color)" stroke-width="1.4" />
                    <text x="260" y="74" class="paula-stage-title" fill="var(--text-color)" text-anchor="middle">LEFT MIX</text>
                    <text x="260" y="88" class="paula-stage-caption" fill="var(--highlight-color)" text-anchor="middle">CH 0 + CH 3</text>
                </g>
                <g class="paula-mix-r" style="opacity:0.22">
                    <rect x="205" y="125" width="110" height="45" rx="3" fill="none" stroke="var(--text-color)" stroke-width="1.4" />
                    <text x="260" y="142" class="paula-stage-title" fill="var(--text-color)" text-anchor="middle">RIGHT MIX</text>
                    <text x="260" y="156" class="paula-stage-caption" fill="var(--highlight-color)" text-anchor="middle">CH 1 + CH 2</text>
                </g>

                <!-- Paula output traces terminate at the numbered package pins. -->
                <path class="silicon-bus-wire" d="M 315 79 L 344.375 79 L 344.375 8 L 344.375 -20 L 520 -20 L 520 91 L 558 91 L 570 91 L 570 110 L 768 110 L 782 110" marker-end="url(#paula-arrow)" />
                <path class="silicon-bus-packet sig-dac-l sig-path-out-l" d="M 315 79 L 344.375 79 L 344.375 8 L 344.375 -20 L 520 -20 L 520 91 L 558 91 L 570 91 L 570 110 L 768 110 L 782 110" />
                <path class="silicon-bus-wire" d="M 315 147 L 325.625 147 L 325.625 8 L 325.625 -40 L 544 -40 L 544 183 L 558 183 L 570 183 L 570 202 L 768 202 L 782 202" marker-end="url(#paula-arrow)" />
                <path class="silicon-bus-packet sig-dac-r sig-path-out-r" d="M 315 147 L 325.625 147 L 325.625 8 L 325.625 -40 L 544 -40 L 544 183 L 558 183 L 570 183 L 570 202 L 768 202 L 782 202" />

                <!-- External board stages, kept outside the Paula package -->
                <rect class="paula-board-frame" x="558" y="28" width="224" height="218" rx="5" fill="var(--screen-bg)" stroke="var(--chassis-light)" stroke-dasharray="5 3" />
                <text x="670" y="46" class="silicon-chip-label" fill="var(--panel-text)" text-anchor="middle">AMIGA BOARD · AUDIO MODEL</text>

                <path class="silicon-bus-wire" d="M 344.375 244 L 520 244 L 520 91 L 558 91 L 570 91 L 570 110 L 768 110 L 782 110" marker-end="url(#paula-arrow)" />
                <path class="silicon-bus-packet sig-path-out-l" d="M 344.375 244 L 520 244 L 520 91 L 558 91 L 570 91 L 570 110 L 768 110 L 782 110" />
                <path class="silicon-bus-wire" d="M 325.625 244 L 325.625 276 L 544 276 L 544 183 L 558 183 L 570 183 L 570 202 L 768 202 L 782 202" marker-end="url(#paula-arrow)" />
                <path class="silicon-bus-packet sig-path-out-r" d="M 325.625 244 L 325.625 276 L 544 276 L 544 183 L 558 183 L 570 183 L 570 202 L 768 202 L 782 202" />

                <g class="paula-filt-l" style="opacity:0.22">
                    <rect x="570" y="66" width="198" height="52" rx="3" fill="none" stroke="var(--text-color)" stroke-dasharray="4 2" />
                    <text x="584" y="83" class="paula-stage-title" fill="var(--text-color)">LED FILTER · LEFT</text>
                    <text x="584" y="100" class="paula-stage-caption" fill="var(--text-color)">PIN 32 · AUDL → BOARD</text>
                </g>
                <g class="paula-filt-r" style="opacity:0.22">
                    <rect x="570" y="158" width="198" height="52" rx="3" fill="none" stroke="var(--text-color)" stroke-dasharray="4 2" />
                    <text x="584" y="175" class="paula-stage-title" fill="var(--text-color)">LED FILTER · RIGHT</text>
                    <text x="584" y="192" class="paula-stage-caption" fill="var(--text-color)">PIN 33 · AUDR → BOARD</text>
                </g>
                <text x="670" y="230" class="paula-filter-status" fill="var(--highlight-color)" text-anchor="middle">LED FILTER: NOT MODELED</text>
            </svg>
        `;
    }
}
