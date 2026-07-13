// === js/ui/silicon/paula-8364.js ===
// =========================================================
// MOS 8364 (PAULA) SILICON DIE VISUALIZER
// Historically accurate die layout featuring 4x DMA FIFOs,
// hard-wired L-R-R-L crossover routing, 8x6-bit MDACs, 
// non-audio logic (Floppy/UART), and virtual external OCS
// analog LED filters feeding into DIP-48 Pins 32 & 33.
// =========================================================

import { BaseChip } from './base-chip.js';

export class Paula8364 extends BaseChip {
    
    cacheDOM() {
        this.cache = {
            // Functional Blocks
            dma0: this.container.querySelector('.paula-dma-0'), dma1: this.container.querySelector('.paula-dma-1'),
            dma2: this.container.querySelector('.paula-dma-2'), dma3: this.container.querySelector('.paula-dma-3'),
            mdacL: this.container.querySelector('.paula-mdac-l'), mdacR: this.container.querySelector('.paula-mdac-r'),
            filtL: this.container.querySelector('.paula-filt-l'), filtR: this.container.querySelector('.paula-filt-r'),
            
            // Frequency Labels
            dma0Hz: this.container.querySelector('.paula-dma0-hz'), dma1Hz: this.container.querySelector('.paula-dma1-hz'),
            dma2Hz: this.container.querySelector('.paula-dma2-hz'), dma3Hz: this.container.querySelector('.paula-dma3-hz'),
            filtLabel: this.container.querySelector('.paula-filt-label'),
            
            // Signal Buses
            sig0: this.container.querySelector('.sig-path-0'), sig1: this.container.querySelector('.sig-path-1'),
            sig2: this.container.querySelector('.sig-path-2'), sig3: this.container.querySelector('.sig-path-3'),
            sigDacL: this.container.querySelector('.sig-dac-l'), sigDacR: this.container.querySelector('.sig-dac-r'),
            sigOutL: this.container.querySelector('.sig-path-out-l'), sigOutR: this.container.querySelector('.sig-path-out-r'),
            
            // Physical DIP-48 Pins (32 = AUDL, 33 = AUDR) -> Zählung top row von rechts!
            pinOutL: this.container.querySelector('.pin-top-32'), 
            pinOutR: this.container.querySelector('.pin-top-33')
        };
    }

    update(vols, regs, t) {
        if (!regs) return;
        
        const v0 = vols[0] || 0.0;
        const v1 = vols[1] || 0.0;
        const v2 = vols[2] || 0.0;
        const v3 = vols[3] || 0.0;

        // 1. DMA Frequencies (Amiga PAL Clock = 3546895 Hz)
        const hz0 = (regs[4] | regs[5]) ? Math.round(3546895 / ((regs[4] << 8) | regs[5])) : 0;
        const hz1 = (regs[11] | regs[12]) ? Math.round(3546895 / ((regs[11] << 8) | regs[12])) : 0;
        const hz2 = (regs[18] | regs[19]) ? Math.round(3546895 / ((regs[18] << 8) | regs[19])) : 0;
        const hz3 = (regs[25] | regs[26]) ? Math.round(3546895 / ((regs[25] << 8) | regs[26])) : 0;

        if (this.cache.dma0Hz) this.cache.dma0Hz.textContent = hz0 > 0 && hz0 < 50000 ? `${hz0}Hz` : 'IDLE';
        if (this.cache.dma1Hz) this.cache.dma1Hz.textContent = hz1 > 0 && hz1 < 50000 ? `${hz1}Hz` : 'IDLE';
        if (this.cache.dma2Hz) this.cache.dma2Hz.textContent = hz2 > 0 && hz2 < 50000 ? `${hz2}Hz` : 'IDLE';
        if (this.cache.dma3Hz) this.cache.dma3Hz.textContent = hz3 > 0 && hz3 < 50000 ? `${hz3}Hz` : 'IDLE';

        // 2. Element Glows (DMA blocks & MDACs)
        const setGlow = (el, val) => { if (el) el.style.opacity = 0.25 + val * 0.75; };
        setGlow(this.cache.dma0, v0); setGlow(this.cache.dma1, v1);
        setGlow(this.cache.dma2, v2); setGlow(this.cache.dma3, v3);

        const outL = (v0 + v3) * 0.5;
        const outR = (v1 + v2) * 0.5;
        setGlow(this.cache.mdacL, outL);
        setGlow(this.cache.mdacR, outR);

        // 3. External LED Filter State (Motherboard)
        const filterOn = (regs[29] === 0);
        if (this.cache.filtLabel) this.cache.filtLabel.textContent = filterOn ? "LED: ACTIVE" : "LED: BYPASS";
        
        const applyFilterGlow = (el, val) => {
            if (!el) return;
            el.style.opacity = filterOn ? (0.4 + val * 0.6) : 0.15;
            el.style.filter = (filterOn && val > 0.1) ? `drop-shadow(0 0 ${val * 8}px var(--text-color))` : 'none';
        };
        applyFilterGlow(this.cache.filtL, outL);
        applyFilterGlow(this.cache.filtR, outR);

        // 4. Signal Buses (Hard-wired L-R-R-L routing inside the die)
        this.updateBusFlow(this.cache.sig0, v0);
        this.updateBusFlow(this.cache.sig1, v1);
        this.updateBusFlow(this.cache.sig2, v2);
        this.updateBusFlow(this.cache.sig3, v3);

        this.updateBusFlow(this.cache.sigDacL, outL);
        this.updateBusFlow(this.cache.sigDacR, outR);
        
        this.updateBusFlow(this.cache.sigOutL, outL);
        this.updateBusFlow(this.cache.sigOutR, outR);

        // 5. Physical Output Pins (Pin 32 & 33)
        this.updatePinGlow(this.cache.pinOutL, outL);
        this.updatePinGlow(this.cache.pinOutR, outR);
    }

    getSvg() {
        return `
            <svg viewBox="0 0 500 200" xmlns="http://www.w3.org/2000/svg">
                <!-- 48 DIP Pins -->
                ${this.generatePins(48, 50, 400)}

                <!-- Package Body -->
                <rect class="silicon-chip-body" x="50" y="30" width="400" height="140" rx="4" />
                <path d="M 50 85 A 15 15 0 0 1 50 115 Z" fill="var(--chassis-dark)" />
                <circle cx="65" cy="45" r="4" fill="var(--chassis-dark)" />
                <text x="250" y="42" class="silicon-chip-label" fill="var(--panel-text)" text-anchor="middle" dominant-baseline="middle">MOS 8364 PAULA (AMIGA I/O & AUDIO)</text>

                <!-- Die Window (Smaller to make room for external mobo traces) -->
                <rect x="80" y="48" width="280" height="106" rx="2" fill="var(--screen-bg)" stroke="var(--chassis-dark)" stroke-width="2" />

                <!-- == 4x DMA FIFOS (Audio Fetchers) == -->
                <g class="paula-dma-0" style="opacity: 0.25;">
                    <rect x="90" y="52" width="65" height="20" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.2" />
                    <text x="122" y="58" font-size="5" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">DMA 0 FIFO</text>
                    <text x="122" y="66" class="paula-dma0-hz" font-size="6" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">0Hz</text>
                </g>
                <g class="paula-dma-1" style="opacity: 0.25;">
                    <rect x="90" y="77" width="65" height="20" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.2" />
                    <text x="122" y="83" font-size="5" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">DMA 1 FIFO</text>
                    <text x="122" y="91" class="paula-dma1-hz" font-size="6" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">0Hz</text>
                </g>
                <g class="paula-dma-2" style="opacity: 0.25;">
                    <rect x="90" y="102" width="65" height="20" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.2" />
                    <text x="122" y="108" font-size="5" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">DMA 2 FIFO</text>
                    <text x="122" y="116" class="paula-dma2-hz" font-size="6" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">0Hz</text>
                </g>
                <g class="paula-dma-3" style="opacity: 0.25;">
                    <rect x="90" y="127" width="65" height="20" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.2" />
                    <text x="122" y="133" font-size="5" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">DMA 3 FIFO</text>
                    <text x="122" y="141" class="paula-dma3-hz" font-size="6" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">0Hz</text>
                </g>

                <!-- == NON-AUDIO LOGIC (Authentic Die Detailing) == -->
                <g class="paula-uart" style="opacity: 0.15;">
                    <rect x="195" y="52" width="45" height="45" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1" stroke-dasharray="1,1" />
                    <text x="217" y="70" font-size="5" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">SERIAL</text>
                    <text x="217" y="78" font-size="5" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">UART</text>
                </g>
                <g class="paula-floppy" style="opacity: 0.15;">
                    <rect x="195" y="102" width="45" height="45" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1" stroke-dasharray="1,1" />
                    <text x="217" y="120" font-size="5" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">FLOPPY</text>
                    <text x="217" y="128" font-size="5" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">CTRL</text>
                </g>

                <!-- == 8x6 MULTIPLYING DACS == -->
                <g class="paula-mdac-l" style="opacity: 0.25;">
                    <rect x="290" y="60" width="55" height="35" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="317" y="73" font-size="6" fill="var(--text-color)" font-weight="bold" text-anchor="middle" dominant-baseline="middle">8x6 MDAC</text>
                    <text x="317" y="83" font-size="5" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">LEFT (0+3)</text>
                </g>
                <g class="paula-mdac-r" style="opacity: 0.25;">
                    <rect x="290" y="105" width="55" height="35" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="317" y="118" font-size="6" fill="var(--text-color)" font-weight="bold" text-anchor="middle" dominant-baseline="middle">8x6 MDAC</text>
                    <text x="317" y="128" font-size="5" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">RIGHT (1+2)</text>
                </g>

                <!-- == VIRTUAL EXTERNAL MOTHERBOARD FILTERS (Outside the Silicon Die) == -->
                <g class="paula-filt-l" style="opacity: 0.15;">
                    <rect x="375" y="60" width="55" height="35" rx="2" fill="none" stroke="var(--text-color)" stroke-width="1.5" stroke-dasharray="3,2" />
                    <text x="402" y="73" font-size="5" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">VIRTUAL OCS</text>
                    <text x="402" y="83" font-size="5" fill="var(--text-color)" font-weight="bold" text-anchor="middle" dominant-baseline="middle">FILTER L</text>
                </g>
                <g class="paula-filt-r" style="opacity: 0.15;">
                    <rect x="375" y="105" width="55" height="35" rx="2" fill="none" stroke="var(--text-color)" stroke-width="1.5" stroke-dasharray="3,2" />
                    <text x="402" y="118" font-size="5" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">VIRTUAL OCS</text>
                    <text x="402" y="128" font-size="5" fill="var(--text-color)" font-weight="bold" text-anchor="middle" dominant-baseline="middle">FILTER R</text>
                </g>
                <text x="402" y="152" class="paula-filt-label" font-size="6" fill="var(--highlight-color)" font-weight="bold" text-anchor="middle" dominant-baseline="middle">LED: BYPASS</text>

                <!-- == L-R-R-L DIE ROUTING BUSES == -->
                <!-- CH0 -> MDAC L -->
                <path class="signal-bus sig-path-0" d="M 155 62 L 175 62 L 175 68 L 290 68" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <!-- CH3 -> MDAC L -->
                <path class="signal-bus sig-path-3" d="M 155 137 L 165 137 L 165 85 L 290 85" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                
                <!-- CH1 -> MDAC R -->
                <path class="signal-bus sig-path-1" d="M 155 87 L 175 87 L 175 115 L 290 115" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <!-- CH2 -> MDAC R -->
                <path class="signal-bus sig-path-2" d="M 155 112 L 185 112 L 185 130 L 290 130" fill="none" stroke="var(--text-color)" stroke-width="1.5" />

                <!-- MDAC to EXTERNAL FILTER -->
                <path class="signal-bus sig-dac-l" d="M 345 77 L 375 77" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <path class="signal-bus sig-dac-r" d="M 345 122 L 375 122" fill="none" stroke="var(--text-color)" stroke-width="1.5" />

                <!-- == PIN ROUTING (Pin 32 & 33) == -->
                <!-- Spacing is ~16.6px. Left edge is 50. Top right is pin 25. 
                     Pin 32 = 50 + 16*16.66 = ~316 -->

                <path class="signal-bus sig-path-out-l" d="M 402 60 L 402 45 L 320 45 L 320 20" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <text x="320" y="38" font-size="5" fill="var(--panel-text)" text-anchor="middle" dominant-baseline="middle">AUDL</text>

                <path class="signal-bus sig-path-out-r" d="M 402 140 L 402 155 L 304 155 L 304 20" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <text x="304" y="38" font-size="5" fill="var(--panel-text)" text-anchor="middle" dominant-baseline="middle">AUDR</text>
            </svg>
        `;
    }
}