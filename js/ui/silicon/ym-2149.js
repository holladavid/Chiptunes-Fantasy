// === js/ui/silicon/ym-2149.js ===
import { BaseChip } from './base-chip.js';

export class Ym2149 extends BaseChip {

    constructor(container) {
        super(container);
        this.noiseState = false;
        this.lastNoiseFlip = 0;
    }
    
    cacheDOM() {
        this.cache = {
            toneA: this.container.querySelector('.ym-tone-a'), toneB: this.container.querySelector('.ym-tone-b'), toneC: this.container.querySelector('.ym-tone-c'),
            toneAHz: this.container.querySelector('.ym-tone-a-hz'), toneBHz: this.container.querySelector('.ym-tone-b-hz'), toneCHz: this.container.querySelector('.ym-tone-c-hz'),
            noiseGen: this.container.querySelector('.ym-noise-gen'), noiseLabel: this.container.querySelector('.ym-noise-hz'),
            envGen: this.container.querySelector('.ym-env-gen'), envLabel: this.container.querySelector('.ym-env-hz'),
            mixTA: this.container.querySelector('.mix-t-a'), mixTB: this.container.querySelector('.mix-t-b'), mixTC: this.container.querySelector('.mix-t-c'),
            mixNA: this.container.querySelector('.mix-n-a'), mixNB: this.container.querySelector('.mix-n-b'), mixNC: this.container.querySelector('.mix-n-c'),
            sig0: this.container.querySelector('.sig-path-0'), sig1: this.container.querySelector('.sig-path-1'), sig2: this.container.querySelector('.sig-path-2'),
            sigOutL: this.container.querySelector('.sig-path-out-l'), pinOutL: this.container.querySelector('.pin-audio-l')
        };
    }

    update(vols, regs, t) {
        if (!regs) return;
        const v0 = vols[0] || 0.0, v1 = vols[1] || 0.0, v2 = vols[2] || 0.0;

        const hzA = (regs[0] | ((regs[1] & 0x0F) << 8)) ? Math.round(2000000 / (16 * (regs[0] | ((regs[1] & 0x0F) << 8)))) : 0;
        const hzB = (regs[2] | ((regs[3] & 0x0F) << 8)) ? Math.round(2000000 / (16 * (regs[2] | ((regs[3] & 0x0F) << 8)))) : 0;
        const hzC = (regs[4] | ((regs[5] & 0x0F) << 8)) ? Math.round(2000000 / (16 * (regs[4] | ((regs[5] & 0x0F) << 8)))) : 0;

        if (this.cache.toneAHz) this.cache.toneAHz.textContent = hzA > 0 && hzA < 20000 ? `${hzA}Hz` : 'IDLE';
        if (this.cache.toneBHz) this.cache.toneBHz.textContent = hzB > 0 && hzB < 20000 ? `${hzB}Hz` : 'IDLE';
        if (this.cache.toneCHz) this.cache.toneCHz.textContent = hzC > 0 && hzC < 20000 ? `${hzC}Hz` : 'IDLE';

        if (this.cache.toneA) this.cache.toneA.style.opacity = 0.2 + v0 * 0.8;
        if (this.cache.toneB) this.cache.toneB.style.opacity = 0.2 + v1 * 0.8;
        if (this.cache.toneC) this.cache.toneC.style.opacity = 0.2 + v2 * 0.8;

        const mix = regs[7];
        if(this.cache.mixTA) this.cache.mixTA.style.fill = (mix & 1) === 0 ? 'var(--highlight-color)' : 'var(--chassis-dark)';
        if(this.cache.mixTB) this.cache.mixTB.style.fill = (mix & 2) === 0 ? 'var(--highlight-color)' : 'var(--chassis-dark)';
        if(this.cache.mixTC) this.cache.mixTC.style.fill = (mix & 4) === 0 ? 'var(--highlight-color)' : 'var(--chassis-dark)';
        if(this.cache.mixNA) this.cache.mixNA.style.fill = (mix & 8) === 0 ? 'var(--highlight-color)' : 'var(--chassis-dark)';
        if(this.cache.mixNB) this.cache.mixNB.style.fill = (mix & 16) === 0 ? 'var(--highlight-color)' : 'var(--chassis-dark)';
        if(this.cache.mixNC) this.cache.mixNC.style.fill = (mix & 32) === 0 ? 'var(--highlight-color)' : 'var(--chassis-dark)';

        const pN = regs[6] & 0x1F;
        if (this.cache.noiseLabel) this.cache.noiseLabel.textContent = pN ? `${(Math.round(125000 / pN)/1000).toFixed(1)}k` : 'IDLE';
        if (this.cache.noiseGen) {
            if (t - this.lastNoiseFlip > Math.max(0.01, 0.1 - (pN / 31) * 0.1)) {
                this.noiseState = !this.noiseState;
                this.lastNoiseFlip = t;
            }
            this.cache.noiseGen.style.opacity = this.noiseState && pN > 0 ? 0.3 + (Math.random() * 0.7) : 0.1;
        }

        const pE = (regs[12] << 8) | regs[11];
        const hzEnv = pE ? (2000000 / (256 * pE)) : 0;
        if (this.cache.envLabel) this.cache.envLabel.textContent = hzEnv > 0 ? `${hzEnv.toFixed(1)}Hz` : 'IDLE';
        if (this.cache.envGen) {
            this.cache.envGen.style.opacity = Math.max(0.15, hzEnv > 0 ? 0.3 + Math.sin(t * hzEnv * Math.PI * 2) * 0.5 : 0.15);
        }

        const outVal = (v0 + v1 + v2) / 3.0;
        this.updateBusFlow(this.cache.sig0, v0); this.updateBusFlow(this.cache.sig1, v1); this.updateBusFlow(this.cache.sig2, v2);
        this.updateBusFlow(this.cache.sigOutL, outVal); this.updatePinGlow(this.cache.pinOutL, outVal);
    }

    getSvg() {
        return `
            <svg viewBox="0 0 500 200" xmlns="http://www.w3.org/2000/svg">
                ${this.generatePins(40, 50, 400)}
                <rect class="silicon-chip-body" x="50" y="30" width="400" height="140" rx="4" />
                <path d="M 50 85 A 15 15 0 0 1 50 115 Z" fill="var(--chassis-dark)" />
                <circle cx="65" cy="45" r="4" fill="var(--chassis-dark)" />
                <text x="250" y="42" class="silicon-chip-label" fill="var(--panel-text)" text-anchor="middle" dominant-baseline="middle">YAMAHA YM2149F SSG</text>
                <rect x="90" y="55" width="320" height="100" rx="2" fill="var(--screen-bg)" stroke="var(--chassis-dark)" stroke-width="2" />

                <!-- TONE GENERATORS -->
                <g class="ym-tone-a" style="opacity: 0.25;">
                    <rect x="100" y="62" width="60" height="24" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.2" />
                    <text x="130" y="70" font-size="6" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">TONE A</text>
                    <text x="130" y="78" class="ym-tone-a-hz" font-size="6" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">0Hz</text>
                </g>
                <g class="ym-tone-b" style="opacity: 0.25;">
                    <rect x="100" y="93" width="60" height="24" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.2" />
                    <text x="130" y="101" font-size="6" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">TONE B</text>
                    <text x="130" y="109" class="ym-tone-b-hz" font-size="6" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">0Hz</text>
                </g>
                <g class="ym-tone-c" style="opacity: 0.25;">
                    <rect x="100" y="124" width="60" height="24" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.2" />
                    <text x="130" y="132" font-size="6" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">TONE C</text>
                    <text x="130" y="140" class="ym-tone-c-hz" font-size="6" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">0Hz</text>
                </g>

                <!-- MIXER MATRIX -->
                <g class="ym-mixer" style="opacity: 0.9;">
                    <rect x="180" y="80" width="70" height="50" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="215" y="90" font-size="6" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">MIXER (R7)</text>
                    
                    <text x="195" y="102" font-size="5" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">TONE</text>
                    <rect class="mix-t-a" x="185" y="106" width="6" height="6" fill="var(--chassis-dark)"/><text x="188" y="117" font-size="4" fill="var(--text-color)" text-anchor="middle">A</text>
                    <rect class="mix-t-b" x="195" y="106" width="6" height="6" fill="var(--chassis-dark)"/><text x="198" y="117" font-size="4" fill="var(--text-color)" text-anchor="middle">B</text>
                    <rect class="mix-t-c" x="205" y="106" width="6" height="6" fill="var(--chassis-dark)"/><text x="208" y="117" font-size="4" fill="var(--text-color)" text-anchor="middle">C</text>
                    
                    <text x="235" y="102" font-size="5" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">NOISE</text>
                    <rect class="mix-n-a" x="225" y="106" width="6" height="6" fill="var(--chassis-dark)"/>
                    <rect class="mix-n-b" x="235" y="106" width="6" height="6" fill="var(--chassis-dark)"/>
                    <rect class="mix-n-c" x="245" y="106" width="6" height="6" fill="var(--chassis-dark)"/>
                </g>

                <!-- NOISE & ENV -->
                <g class="ym-noise-gen" style="opacity: 0.15;">
                    <rect x="180" y="62" width="70" height="15" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.2" />
                    <text x="215" y="69" class="ym-noise-hz" font-size="6" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">NOISE</text>
                </g>
                <g class="ym-env-gen" style="opacity: 0.15;">
                    <rect x="260" y="62" width="60" height="68" rx="2" fill="none" stroke="var(--text-color)" stroke-width="1.5" stroke-dasharray="2,2" />
                    <text x="290" y="74" font-size="6" fill="var(--text-color)" font-weight="bold" text-anchor="middle" dominant-baseline="middle">ENV GEN</text>
                    <text x="290" y="86" class="ym-env-hz" font-size="6" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">0Hz</text>
                </g>

                <!-- LOG DAC -->
                <g class="ym-dac" style="opacity: 0.95;">
                    <rect x="330" y="85" width="60" height="40" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="360" y="105" font-size="6" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">3x LOG_DAC</text>
                </g>

                <path class="signal-bus sig-path-0" d="M 160 74 L 180 90" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <path class="signal-bus sig-path-1" d="M 160 105 L 180 105" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <path class="signal-bus sig-path-2" d="M 160 136 L 180 120" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <path class="signal-bus sig-path-out-l" d="M 250 105 L 330 105" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <path class="signal-bus sig-path-out-l" d="M 390 105 L 420 105 L 420 170 L 105 170" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <rect class="pin-audio-l" x="93" y="170" width="14" height="15" rx="1" fill="var(--chassis-dark)" />
            </svg>
        `;
    }
}