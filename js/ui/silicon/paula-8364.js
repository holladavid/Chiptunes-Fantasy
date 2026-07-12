// === js/ui/silicon/paula-8364.js ===
import { BaseChip } from './base-chip.js';

export class Paula8364 extends BaseChip {
    
    cacheDOM() {
        this.cache = {
            dma0Hz: this.container.querySelector('.paula-dma0-hz'), dma1Hz: this.container.querySelector('.paula-dma1-hz'),
            dma2Hz: this.container.querySelector('.paula-dma2-hz'), dma3Hz: this.container.querySelector('.paula-dma3-hz'),
            ledFilt: this.container.querySelector('.paula-led-filt'), ledLabel: this.container.querySelector('.paula-led-label'),
            sig0: this.container.querySelector('.sig-path-0'), sig1: this.container.querySelector('.sig-path-1'),
            sig2: this.container.querySelector('.sig-path-2'), sig3: this.container.querySelector('.sig-path-3'),
            sigOutL: this.container.querySelector('.sig-path-out-l'), sigOutR: this.container.querySelector('.sig-path-out-r'),
            pinOutL: this.container.querySelector('.pin-audio-l'), pinOutR: this.container.querySelector('.pin-audio-r')
        };
    }

    update(vols, regs, t) {
        if (!regs) return;
        const v0 = vols[0] || 0.0, v1 = vols[1] || 0.0, v2 = vols[2] || 0.0, v3 = vols[3] || 0.0;

        this.updateBusFlow(this.cache.sig0, v0); this.updateBusFlow(this.cache.sig1, v1);
        this.updateBusFlow(this.cache.sig2, v2); this.updateBusFlow(this.cache.sig3, v3);

        const setDma = (idx, hzEl, hzReg) => {
            const hz = hzReg ? Math.round(3546895 / hzReg) : 0;
            if (hzEl) hzEl.textContent = hz > 0 && hz < 40000 ? `${hz}Hz` : 'IDLE';
        };
        setDma(0, this.cache.dma0Hz, (regs[4] << 8) | regs[5]);
        setDma(1, this.cache.dma1Hz, (regs[11] << 8) | regs[12]);
        setDma(2, this.cache.dma2Hz, (regs[18] << 8) | regs[19]);
        setDma(3, this.cache.dma3Hz, (regs[25] << 8) | regs[26]);

        const filterOn = (regs[29] === 0);
        if (this.cache.ledFilt) {
            this.cache.ledFilt.style.opacity = filterOn ? '0.95' : '0.15';
            this.cache.ledFilt.style.filter = filterOn ? 'drop-shadow(0 0 4px var(--text-color))' : 'none';
        }
        if (this.cache.ledLabel) this.cache.ledLabel.textContent = filterOn ? "ACTIVE" : "BYPASS";

        const outL = (v0 + v3) * 0.5;
        const outR = (v1 + v2) * 0.5;
        this.updateBusFlow(this.cache.sigOutL, outL); this.updateBusFlow(this.cache.sigOutR, outR);
        this.updatePinGlow(this.cache.pinOutL, outL); this.updatePinGlow(this.cache.pinOutR, outR);
    }

    getSvg() {
        return `
            <svg viewBox="0 0 500 200" xmlns="http://www.w3.org/2000/svg">
                ${this.generatePins(48, 50, 400)}
                <rect class="silicon-chip-body" x="50" y="30" width="400" height="140" rx="4" />
                <path d="M 50 85 A 15 15 0 0 1 50 115 Z" fill="var(--chassis-dark)" />
                <circle cx="65" cy="45" r="4" fill="var(--chassis-dark)" />
                <text x="250" y="42" class="silicon-chip-label" fill="var(--panel-text)" text-anchor="middle" dominant-baseline="middle">MOS 8364 PAULA (AMIGA DMA)</text>
                <rect x="90" y="55" width="320" height="100" rx="2" fill="var(--screen-bg)" stroke="var(--chassis-dark)" stroke-width="2" />

                <!-- 4x DMA FIFOS -->
                <g class="paula-dma-0" style="opacity: 0.95;">
                    <rect x="100" y="62" width="75" height="18" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.2" />
                    <text x="137" y="71" font-size="6" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">DMA 0</text>
                    <text x="165" y="71" class="paula-dma0-hz" font-size="5" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">0Hz</text>
                </g>
                <g class="paula-dma-1" style="opacity: 0.95;">
                    <rect x="100" y="84" width="75" height="18" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.2" />
                    <text x="137" y="93" font-size="6" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">DMA 1</text>
                    <text x="165" y="93" class="paula-dma1-hz" font-size="5" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">0Hz</text>
                </g>
                <g class="paula-dma-2" style="opacity: 0.95;">
                    <rect x="100" y="106" width="75" height="18" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.2" />
                    <text x="137" y="115" font-size="6" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">DMA 2</text>
                    <text x="165" y="115" class="paula-dma2-hz" font-size="5" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">0Hz</text>
                </g>
                <g class="paula-dma-3" style="opacity: 0.95;">
                    <rect x="100" y="128" width="75" height="18" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.2" />
                    <text x="137" y="137" font-size="6" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">DMA 3</text>
                    <text x="165" y="137" class="paula-dma3-hz" font-size="5" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">0Hz</text>
                </g>

                <!-- LED FILTER -->
                <g class="paula-led-filt" style="opacity: 0.15;">
                    <rect x="190" y="62" width="70" height="84" rx="2" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="225" y="74" font-size="6" fill="var(--text-color)" font-weight="bold" text-anchor="middle" dominant-baseline="middle">LED FILTER</text>
                    <text x="225" y="84" class="paula-led-label" font-size="6" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">ACTIVE</text>
                    <circle cx="225" cy="115" r="14" fill="none" stroke="var(--text-color)" stroke-width="1.5" stroke-dasharray="2,2" />
                </g>

                <g class="paula-dac-l" style="opacity: 0.95;">
                    <rect x="290" y="65" width="45" height="30" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="312" y="80" font-size="7" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">DAC L</text>
                </g>
                <g class="paula-dac-r" style="opacity: 0.95;">
                    <rect x="290" y="110" width="45" height="30" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="312" y="125" font-size="7" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">DAC R</text>
                </g>

                <path class="signal-bus sig-path-0" d="M 175 71 L 290 80" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <path class="signal-bus sig-path-3" d="M 175 137 L 275 137 L 275 80 L 290 80" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <path class="signal-bus sig-path-1" d="M 175 93 L 275 93 L 275 125 L 290 125" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <path class="signal-bus sig-path-2" d="M 175 115 L 290 125" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <path class="signal-bus sig-path-out-l" d="M 335 80 L 370 80 L 370 170" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <rect class="pin-audio-l" x="364" y="170" width="12" height="15" rx="1" fill="var(--chassis-dark)" />
                <path class="signal-bus sig-path-out-r" d="M 335 125 L 390 125 L 390 170" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <rect class="pin-audio-r" x="385" y="170" width="12" height="15" rx="1" fill="var(--chassis-dark)" />
            </svg>
        `;
    }
}