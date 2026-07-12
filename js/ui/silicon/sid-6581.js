// === js/ui/silicon/sid-6581.js ===
import { BaseChip } from './base-chip.js';

export class Sid6581 extends BaseChip {
    
    cacheDOM() {
        this.cache = {
            osc1: this.container.querySelector('.sid-osc1'), osc2: this.container.querySelector('.sid-osc2'), osc3: this.container.querySelector('.sid-osc3'),
            filtBlock: this.container.querySelector('.sid-filt-block'), filtCutLabel: this.container.querySelector('.sid-filt-cut'), filtResBar: this.container.querySelector('.sid-filt-res-bar'),
            lpLed: this.container.querySelector('.sid-lp-led'), bpLed: this.container.querySelector('.sid-bp-led'), hpLed: this.container.querySelector('.sid-hp-led'),
            osc1Hz: this.container.querySelector('.sid-osc1-hz'), osc2Hz: this.container.querySelector('.sid-osc2-hz'), osc3Hz: this.container.querySelector('.sid-osc3-hz'),
            w1T: this.container.querySelector('.w1-t'), w1S: this.container.querySelector('.w1-s'), w1P: this.container.querySelector('.w1-p'), w1N: this.container.querySelector('.w1-n'),
            w2T: this.container.querySelector('.w2-t'), w2S: this.container.querySelector('.w2-s'), w2P: this.container.querySelector('.w2-p'), w2N: this.container.querySelector('.w2-n'),
            w3T: this.container.querySelector('.w3-t'), w3S: this.container.querySelector('.w3-s'), w3P: this.container.querySelector('.w3-p'), w3N: this.container.querySelector('.w3-n'),
            sig0: this.container.querySelector('.sig-path-0'), sig1: this.container.querySelector('.sig-path-1'), sig2: this.container.querySelector('.sig-path-2'),
            sigOutL: this.container.querySelector('.sig-path-out-l'), pinOutL: this.container.querySelector('.pin-audio-l')
        };
    }

    update(vols, regs, t) {
        if (!regs) return;
        const v0 = vols[0] || 0.0, v1 = vols[1] || 0.0, v2 = vols[2] || 0.0;

        this.updateBusFlow(this.cache.sig0, v0); this.updateBusFlow(this.cache.sig1, v1); this.updateBusFlow(this.cache.sig2, v2);

        const hz0 = (regs[0] | (regs[1] << 8)) ? Math.round(((regs[0] | (regs[1] << 8)) * 985248) / 16777216) : 0;
        const hz1 = (regs[7] | (regs[8] << 8)) ? Math.round(((regs[7] | (regs[8] << 8)) * 985248) / 16777216) : 0;
        const hz2 = (regs[14] | (regs[15] << 8)) ? Math.round(((regs[14] | (regs[15] << 8)) * 985248) / 16777216) : 0;

        if (this.cache.osc1Hz) this.cache.osc1Hz.textContent = hz0 > 0 ? `${hz0}Hz` : 'IDLE';
        if (this.cache.osc2Hz) this.cache.osc2Hz.textContent = hz1 > 0 ? `${hz1}Hz` : 'IDLE';
        if (this.cache.osc3Hz) this.cache.osc3Hz.textContent = hz2 > 0 ? `${hz2}Hz` : 'IDLE';

        if (this.cache.osc1) this.cache.osc1.style.opacity = 0.2 + v0 * 0.8;
        if (this.cache.osc2) this.cache.osc2.style.opacity = 0.2 + v1 * 0.8;
        if (this.cache.osc3) this.cache.osc3.style.opacity = 0.2 + v2 * 0.8;

        const setWave = (w, ctrl) => {
            if(this.cache[`w${w}T`]) this.cache[`w${w}T`].style.fill = (ctrl & 16) ? 'var(--highlight-color)' : 'var(--chassis-dark)';
            if(this.cache[`w${w}S`]) this.cache[`w${w}S`].style.fill = (ctrl & 32) ? 'var(--highlight-color)' : 'var(--chassis-dark)';
            if(this.cache[`w${w}P`]) this.cache[`w${w}P`].style.fill = (ctrl & 64) ? 'var(--highlight-color)' : 'var(--chassis-dark)';
            if(this.cache[`w${w}N`]) this.cache[`w${w}N`].style.fill = (ctrl & 128) ? 'var(--highlight-color)' : 'var(--chassis-dark)';
        };
        setWave(1, regs[4]); setWave(2, regs[11]); setWave(3, regs[18]);

        const cutoffReg = (regs[22] << 3) | (regs[21] & 7);
        const resReg = regs[23] >> 4;
        const fMode = regs[24] & 0xF0;
        let fhz = (220.0 + Math.pow(cutoffReg / 2047.0, 1.4) * 11500.0) * (1.0 - ((regs[29] || 55) - 55.0) * 0.0035);
        
        if (this.cache.filtCutLabel) this.cache.filtCutLabel.textContent = `${Math.round(Math.max(30, fhz))}Hz`;
        if (this.cache.filtResBar) this.cache.filtResBar.setAttribute('width', (resReg / 15) * 50);

        if (this.cache.lpLed) this.cache.lpLed.style.fill = (fMode & 16) ? 'var(--highlight-color)' : 'var(--chassis-dark)';
        if (this.cache.bpLed) this.cache.bpLed.style.fill = (fMode & 32) ? 'var(--highlight-color)' : 'var(--chassis-dark)';
        if (this.cache.hpLed) this.cache.hpLed.style.fill = (fMode & 64) ? 'var(--highlight-color)' : 'var(--chassis-dark)';

        if (this.cache.filtBlock) {
            this.cache.filtBlock.style.opacity = 0.2 + (v0 + v1 + v2) * 0.3 + (resReg / 15.0) * 0.5;
            this.cache.filtBlock.style.filter = resReg > 8 ? `drop-shadow(0 0 ${resReg}px var(--text-color))` : 'none';
        }

        const outVal = (v0 + v1 + v2) / 3.0;
        this.updateBusFlow(this.cache.sigOutL, outVal);
        this.updatePinGlow(this.cache.pinOutL, outVal);
    }

    getSvg() {
        return `
            <svg viewBox="0 0 500 200" xmlns="http://www.w3.org/2000/svg">
                ${this.generatePins(28, 50, 400)}
                <rect class="silicon-chip-body" x="50" y="30" width="400" height="140" rx="4" />
                <path d="M 50 85 A 15 15 0 0 1 50 115 Z" fill="var(--chassis-dark)" />
                <circle cx="65" cy="45" r="4" fill="var(--chassis-dark)" />
                <text x="250" y="42" class="silicon-chip-label" fill="var(--panel-text)" text-anchor="middle" dominant-baseline="middle">MOS 6581 SOUND INTERFACE DEVICE</text>
                <rect x="90" y="55" width="320" height="100" rx="2" fill="var(--screen-bg)" stroke="var(--chassis-dark)" stroke-width="2" />

                <!-- OSCILLATORS -->
                <g class="sid-osc1" style="opacity: 0.25;">
                    <rect x="100" y="62" width="70" height="24" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="135" y="70" font-size="6" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">OSC 1</text>
                    <text x="135" y="78" class="sid-osc1-hz" font-size="6" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">0Hz</text>
                    <rect class="w1-t" x="103" y="65" width="4" height="4" fill="var(--chassis-dark)"/><text x="105" y="74" font-size="4" fill="var(--text-color)" text-anchor="middle">T</text>
                    <rect class="w1-s" x="110" y="65" width="4" height="4" fill="var(--chassis-dark)"/><text x="112" y="74" font-size="4" fill="var(--text-color)" text-anchor="middle">S</text>
                    <rect class="w1-p" x="156" y="65" width="4" height="4" fill="var(--chassis-dark)"/><text x="158" y="74" font-size="4" fill="var(--text-color)" text-anchor="middle">P</text>
                    <rect class="w1-n" x="163" y="65" width="4" height="4" fill="var(--chassis-dark)"/><text x="165" y="74" font-size="4" fill="var(--text-color)" text-anchor="middle">N</text>
                </g>
                <g class="sid-osc2" style="opacity: 0.25;">
                    <rect x="100" y="93" width="70" height="24" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="135" y="101" font-size="6" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">OSC 2</text>
                    <text x="135" y="109" class="sid-osc2-hz" font-size="6" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">0Hz</text>
                    <rect class="w2-t" x="103" y="96" width="4" height="4" fill="var(--chassis-dark)"/><rect class="w2-s" x="110" y="96" width="4" height="4" fill="var(--chassis-dark)"/>
                    <rect class="w2-p" x="156" y="96" width="4" height="4" fill="var(--chassis-dark)"/><rect class="w2-n" x="163" y="96" width="4" height="4" fill="var(--chassis-dark)"/>
                </g>
                <g class="sid-osc3" style="opacity: 0.25;">
                    <rect x="100" y="124" width="70" height="24" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="135" y="132" font-size="6" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">OSC 3</text>
                    <text x="135" y="140" class="sid-osc3-hz" font-size="6" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">0Hz</text>
                    <rect class="w3-t" x="103" y="127" width="4" height="4" fill="var(--chassis-dark)"/><rect class="w3-s" x="110" y="127" width="4" height="4" fill="var(--chassis-dark)"/>
                    <rect class="w3-p" x="156" y="127" width="4" height="4" fill="var(--chassis-dark)"/><rect class="w3-n" x="163" y="127" width="4" height="4" fill="var(--chassis-dark)"/>
                </g>

                <!-- FILTER BLOCK -->
                <g class="sid-filt-block" style="opacity: 0.25;">
                    <rect x="220" y="62" width="100" height="86" rx="2" fill="none" stroke="var(--text-color)" stroke-width="2" />
                    <text x="270" y="74" font-size="7" fill="var(--text-color)" font-weight="bold" text-anchor="middle" dominant-baseline="middle">ANALOG VCF</text>
                    <text x="270" y="86" class="sid-filt-cut" font-size="7" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">FC: 30Hz</text>
                    
                    <text x="238" y="100" font-size="5" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">RES</text>
                    <rect x="250" y="97" width="50" height="6" fill="none" stroke="var(--text-color)" stroke-width="1" />
                    <rect class="sid-filt-res-bar" x="250" y="97" width="0" height="6" fill="var(--text-color)" />

                    <rect class="sid-lp-led" x="240" y="110" width="8" height="8" rx="4" fill="var(--chassis-dark)" />
                    <text x="244" y="124" font-size="5" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">LP</text>
                    <rect class="sid-bp-led" x="266" y="110" width="8" height="8" rx="4" fill="var(--chassis-dark)" />
                    <text x="270" y="124" font-size="5" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">BP</text>
                    <rect class="sid-hp-led" x="292" y="110" width="8" height="8" rx="4" fill="var(--chassis-dark)" />
                    <text x="296" y="124" font-size="5" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">HP</text>
                </g>

                <g class="sid-vca" style="opacity: 0.95;">
                    <rect x="340" y="85" width="50" height="40" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="365" y="105" font-size="7" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">VCA/DAC</text>
                </g>

                <path class="signal-bus sig-path-0" d="M 170 74 L 220 74" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <path class="signal-bus sig-path-1" d="M 170 105 L 220 105" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <path class="signal-bus sig-path-2" d="M 170 136 L 195 136 L 195 120 L 220 120" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <path class="signal-bus sig-path-out-l" d="M 320 105 L 340 105" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <path class="signal-bus sig-path-out-l" d="M 390 105 L 420 105 L 420 20 L 105 20" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <rect class="pin-audio-l" x="93" y="15" width="14" height="15" rx="1" fill="var(--chassis-dark)" />
            </svg>
        `;
    }
}