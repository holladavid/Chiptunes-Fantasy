// === js/ui/silicon/ym-2149.js ===
// =========================================================
// YM2149F (ATARI ST) SILICON DIE VISUALIZER
// Historically accurate die layout. Fixed I/O port placements,
// cleaned up dynamic pin routing and removed stray rects.
// =========================================================

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
            noiseGen: this.container.querySelector('.ym-noise-gen'), envGen: this.container.querySelector('.ym-env-gen'),
            dacA: this.container.querySelector('.ym-dac-a'), dacB: this.container.querySelector('.ym-dac-b'), dacC: this.container.querySelector('.ym-dac-c'),
            
            toneAHz: this.container.querySelector('.ym-tone-a-hz'), toneBHz: this.container.querySelector('.ym-tone-b-hz'), toneCHz: this.container.querySelector('.ym-tone-c-hz'),
            noiseLabel: this.container.querySelector('.ym-noise-hz'), envLabel: this.container.querySelector('.ym-env-hz'),
            envShape: this.container.querySelector('.ym-env-shape-preview'),
            
            volModeA: this.container.querySelector('.ym-vol-mode-a'), volModeB: this.container.querySelector('.ym-vol-mode-b'), volModeC: this.container.querySelector('.ym-vol-mode-c'),
            
            mixTA: this.container.querySelector('.mix-t-a'), mixTB: this.container.querySelector('.mix-t-b'), mixTC: this.container.querySelector('.mix-t-c'),
            mixNA: this.container.querySelector('.mix-n-a'), mixNB: this.container.querySelector('.mix-n-b'), mixNC: this.container.querySelector('.mix-n-c'),
            
            sigToneA: this.container.querySelector('.sig-tone-a'), sigToneB: this.container.querySelector('.sig-tone-b'), sigToneC: this.container.querySelector('.sig-tone-c'),
            sigNoiseA: this.container.querySelector('.sig-noise-a'), sigNoiseB: this.container.querySelector('.sig-noise-b'), sigNoiseC: this.container.querySelector('.sig-noise-c'),
            sigMixA: this.container.querySelector('.sig-mix-a'), sigMixB: this.container.querySelector('.sig-mix-b'), sigMixC: this.container.querySelector('.sig-mix-c'),
            
            sigOutA: this.container.querySelector('.sig-out-a'), sigOutB: this.container.querySelector('.sig-out-b'), sigOutC: this.container.querySelector('.sig-out-c'),
            
            pinOutA: this.container.querySelector('.pin-bot-4'),
            pinOutB: this.container.querySelector('.pin-bot-3'),
            pinOutC: this.container.querySelector('.pin-top-38')
        };
    }

    update(vols, regs, t) {
        if (!regs) return;
        const v0 = vols[0] || 0.0, v1 = vols[1] || 0.0, v2 = vols[2] || 0.0;

        const pA = (regs[0] | ((regs[1] & 0x0F) << 8)); const hzA = pA ? Math.round(2000000 / (16 * pA)) : 0;
        const pB = (regs[2] | ((regs[3] & 0x0F) << 8)); const hzB = pB ? Math.round(2000000 / (16 * pB)) : 0;
        const pC = (regs[4] | ((regs[5] & 0x0F) << 8)); const hzC = pC ? Math.round(2000000 / (16 * pC)) : 0;

        if (this.cache.toneAHz) this.cache.toneAHz.textContent = hzA > 0 && hzA < 20000 ? `${hzA}Hz` : 'IDLE';
        if (this.cache.toneBHz) this.cache.toneBHz.textContent = hzB > 0 && hzB < 20000 ? `${hzB}Hz` : 'IDLE';
        if (this.cache.toneCHz) this.cache.toneCHz.textContent = hzC > 0 && hzC < 20000 ? `${hzC}Hz` : 'IDLE';

        if (this.cache.toneA) this.cache.toneA.style.opacity = 0.2 + v0 * 0.8;
        if (this.cache.toneB) this.cache.toneB.style.opacity = 0.2 + v1 * 0.8;
        if (this.cache.toneC) this.cache.toneC.style.opacity = 0.2 + v2 * 0.8;

        const mix = regs[7];
        const tA = (mix & 1) === 0; const tB = (mix & 2) === 0; const tC = (mix & 4) === 0;
        const nA = (mix & 8) === 0; const nB = (mix & 16) === 0; const nC = (mix & 32) === 0;

        if(this.cache.mixTA) this.cache.mixTA.style.fill = tA ? 'var(--highlight-color)' : 'var(--chassis-dark)';
        if(this.cache.mixTB) this.cache.mixTB.style.fill = tB ? 'var(--highlight-color)' : 'var(--chassis-dark)';
        if(this.cache.mixTC) this.cache.mixTC.style.fill = tC ? 'var(--highlight-color)' : 'var(--chassis-dark)';
        if(this.cache.mixNA) this.cache.mixNA.style.fill = nA ? 'var(--highlight-color)' : 'var(--chassis-dark)';
        if(this.cache.mixNB) this.cache.mixNB.style.fill = nB ? 'var(--highlight-color)' : 'var(--chassis-dark)';
        if(this.cache.mixNC) this.cache.mixNC.style.fill = nC ? 'var(--highlight-color)' : 'var(--chassis-dark)';

        const pN = regs[6] & 0x1F;
        if (this.cache.noiseLabel) this.cache.noiseLabel.textContent = pN ? `${(Math.round(125000 / pN)/1000).toFixed(1)}k` : 'IDLE';
        if (this.cache.noiseGen) {
            if (t - this.lastNoiseFlip > Math.max(0.01, 0.1 - (pN / 31) * 0.1)) {
                this.noiseState = !this.noiseState;
                this.lastNoiseFlip = t;
            }
            this.cache.noiseGen.style.opacity = this.noiseState && pN > 0 ? 0.3 + (Math.random() * 0.7) : 0.15;
        }

        const pE = (regs[12] << 8) | regs[11];
        const hzEnv = pE ? (2000000 / (256 * pE)) : 0;
        if (this.cache.envLabel) this.cache.envLabel.textContent = hzEnv > 0 ? `${hzEnv.toFixed(1)}Hz` : 'IDLE';
        if (this.cache.envGen) {
            this.cache.envGen.style.opacity = Math.max(0.15, hzEnv > 0 ? 0.3 + Math.sin(t * hzEnv * Math.PI * 2) * 0.5 : 0.15);
        }

        const shape = regs[13] & 0x0F;
        if (this.cache.envShape) {
            let pathD = "M 183 125 L 207 125"; 
            if (pE > 0) {
                if (shape === 8 || shape === 9) pathD = "M 183 130 L 207 120 L 207 130"; 
                else if (shape === 12 || shape === 13) pathD = "M 183 120 L 207 130 L 207 120"; 
                else if (shape === 10 || shape === 14) pathD = "M 183 130 L 195 120 L 207 130"; 
            }
            this.cache.envShape.setAttribute('d', pathD);
        }

        const envModeA = (regs[8] & 0x10) !== 0;
        const envModeB = (regs[9] & 0x10) !== 0;
        const envModeC = (regs[10] & 0x10) !== 0;

        if (this.cache.volModeA) this.cache.volModeA.textContent = envModeA ? 'ENV' : 'FIX';
        if (this.cache.volModeB) this.cache.volModeB.textContent = envModeB ? 'ENV' : 'FIX';
        if (this.cache.volModeC) this.cache.volModeC.textContent = envModeC ? 'ENV' : 'FIX';

        if (this.cache.dacA) this.cache.dacA.style.opacity = 0.2 + v0 * 0.8;
        if (this.cache.dacB) this.cache.dacB.style.opacity = 0.2 + v1 * 0.8;
        if (this.cache.dacC) this.cache.dacC.style.opacity = 0.2 + v2 * 0.8;

        this.updateBusFlow(this.cache.sigToneA, tA ? v0 : 0);
        this.updateBusFlow(this.cache.sigToneB, tB ? v1 : 0);
        this.updateBusFlow(this.cache.sigToneC, tC ? v2 : 0);

        let nVol = (v0 + v1 + v2) / 3.0; 
        this.updateBusFlow(this.cache.sigNoiseA, nA ? nVol : 0);
        this.updateBusFlow(this.cache.sigNoiseB, nB ? nVol : 0);
        this.updateBusFlow(this.cache.sigNoiseC, nC ? nVol : 0);

        this.updateBusFlow(this.cache.sigMixA, v0);
        this.updateBusFlow(this.cache.sigMixB, v1);
        this.updateBusFlow(this.cache.sigMixC, v2);

        this.updateBusFlow(this.cache.sigOutA, v0);
        this.updateBusFlow(this.cache.sigOutB, v1);
        this.updateBusFlow(this.cache.sigOutC, v2);

        this.updatePinGlow(this.cache.pinOutA, v0); // Pin 4
        this.updatePinGlow(this.cache.pinOutB, v1); // Pin 3
        this.updatePinGlow(this.cache.pinOutC, v2); // Pin 38
    }

    getSvg() {
        return `
            <svg viewBox="0 0 500 200" xmlns="http://www.w3.org/2000/svg">
                <!-- 40 DIP Pins -->
                ${this.generatePins(40, 50, 400)}
                
                <rect class="silicon-chip-body" x="50" y="30" width="400" height="140" rx="4" />
                <path d="M 50 85 A 15 15 0 0 1 50 115 Z" fill="var(--chassis-dark)" />
                <circle cx="65" cy="45" r="4" fill="var(--chassis-dark)" />
                <text x="250" y="42" class="silicon-chip-label" fill="var(--panel-text)" text-anchor="middle" dominant-baseline="middle">YAMAHA YM2149F SSG</text>

                <rect x="75" y="48" width="350" height="106" rx="2" fill="var(--screen-bg)" stroke="var(--chassis-dark)" stroke-width="2" />

                <!-- == I/O PORTS (Moved to the far right to prevent clipping) == -->
                <g class="ym-ioports" style="opacity: 0.15;">
                    <rect x="382" y="55" width="36" height="40" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1" stroke-dasharray="1,1" />
                    <text x="400" y="70" font-size="5" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">PORT A</text>
                    <text x="400" y="80" font-size="4" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">FLOPPY</text>

                    <rect x="382" y="105" width="36" height="40" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1" stroke-dasharray="1,1" />
                    <text x="400" y="120" font-size="5" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">PORT B</text>
                    <text x="400" y="130" font-size="4" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">PRINTER</text>
                </g>

                <!-- == 3x TONE GENERATORS == -->
                <g class="ym-tone-a" style="opacity: 0.25;">
                    <rect x="85" y="55" width="55" height="24" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.2" />
                    <text x="112" y="63" font-size="6" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">TONE A</text>
                    <text x="112" y="72" class="ym-tone-a-hz" font-size="6" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">0Hz</text>
                </g>
                <g class="ym-tone-b" style="opacity: 0.25;">
                    <rect x="85" y="86" width="55" height="24" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.2" />
                    <text x="112" y="94" font-size="6" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">TONE B</text>
                    <text x="112" y="103" class="ym-tone-b-hz" font-size="6" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">0Hz</text>
                </g>
                <g class="ym-tone-c" style="opacity: 0.25;">
                    <rect x="85" y="117" width="55" height="24" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.2" />
                    <text x="112" y="125" font-size="6" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">TONE C</text>
                    <text x="112" y="134" class="ym-tone-c-hz" font-size="6" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">0Hz</text>
                </g>

                <!-- == MIXER MATRIX == -->
                <g class="ym-mixer" style="opacity: 0.95;">
                    <rect x="195" y="55" width="60" height="50" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="225" y="65" font-size="6" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle" font-weight="bold">MIXER MATRIX</text>
                    
                    <text x="205" y="76" font-size="5" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">TONE</text>
                    <rect class="mix-t-a" x="198" y="81" width="4" height="4" fill="var(--chassis-dark)"/><text x="200" y="90" font-size="4" fill="var(--text-color)" text-anchor="middle">A</text>
                    <rect class="mix-t-b" x="205" y="81" width="4" height="4" fill="var(--chassis-dark)"/><text x="207" y="90" font-size="4" fill="var(--text-color)" text-anchor="middle">B</text>
                    <rect class="mix-t-c" x="212" y="81" width="4" height="4" fill="var(--chassis-dark)"/><text x="214" y="90" font-size="4" fill="var(--text-color)" text-anchor="middle">C</text>
                    
                    <text x="242" y="76" font-size="5" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">NOISE</text>
                    <rect class="mix-n-a" x="235" y="81" width="4" height="4" fill="var(--chassis-dark)"/>
                    <rect class="mix-n-b" x="242" y="81" width="4" height="4" fill="var(--chassis-dark)"/>
                    <rect class="mix-n-c" x="249" y="81" width="4" height="4" fill="var(--chassis-dark)"/>
                </g>

                <!-- == NOISE GENERATOR == -->
                <g class="ym-noise-gen" style="opacity: 0.15;">
                    <rect x="150" y="55" width="35" height="24" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.2" />
                    <text x="167" y="63" font-size="5" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">NOISE</text>
                    <text x="167" y="72" class="ym-noise-hz" font-size="5" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">0Hz</text>
                </g>

                <!-- == ENVELOPE GENERATOR == -->
                <g class="ym-env-gen" style="opacity: 0.15;">
                    <rect x="150" y="105" width="40" height="36" rx="2" fill="none" stroke="var(--text-color)" stroke-width="1.5" stroke-dasharray="2,2" />
                    <text x="170" y="113" font-size="5" fill="var(--text-color)" font-weight="bold" text-anchor="middle" dominant-baseline="middle">ENV GEN</text>
                    <text x="170" y="122" class="ym-env-hz" font-size="5" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">0Hz</text>
                    <rect x="155" y="126" width="30" height="10" fill="var(--chassis-dark)" />
                    <path class="ym-env-shape-preview" d="M 158 134 L 182 134" fill="none" stroke="var(--highlight-color)" stroke-width="1.2" />
                </g>

                <!-- == 3x LOG DACs == -->
                <g class="ym-dac-a" style="opacity: 0.25;">
                    <rect x="290" y="55" width="55" height="24" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="317" y="63" font-size="6" fill="var(--text-color)" font-weight="bold" text-anchor="middle" dominant-baseline="middle">LOG DAC A</text>
                    <text x="317" y="72" class="ym-vol-mode-a" font-size="5" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">FIX</text>
                </g>
                <g class="ym-dac-b" style="opacity: 0.25;">
                    <rect x="290" y="86" width="55" height="24" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="317" y="94" font-size="6" fill="var(--text-color)" font-weight="bold" text-anchor="middle" dominant-baseline="middle">LOG DAC B</text>
                    <text x="317" y="103" class="ym-vol-mode-b" font-size="5" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">FIX</text>
                </g>
                <g class="ym-dac-c" style="opacity: 0.25;">
                    <rect x="290" y="117" width="55" height="24" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="317" y="125" font-size="6" fill="var(--text-color)" font-weight="bold" text-anchor="middle" dominant-baseline="middle">LOG DAC C</text>
                    <text x="317" y="134" class="ym-vol-mode-c" font-size="5" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">FIX</text>
                </g>

                <!-- == SIGNAL BUS PATHS == -->
                <path class="signal-bus sig-tone-a" d="M 140 64 L 140 50 L 199 50 L 199 55" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <path class="signal-bus sig-tone-b" d="M 140 98 L 195 98" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <path class="signal-bus sig-tone-c" d="M 140 129 L 140 144 L 213 144 L 213 105" fill="none" stroke="var(--text-color)" stroke-width="1.5" />

                <path class="signal-bus sig-noise-a" d="M 185 64 L 195 64" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <path class="signal-bus sig-noise-b" d="M 185 67 L 189 67 L 189 80 L 195 80" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <path class="signal-bus sig-noise-c" d="M 185 70 L 185 90 L 195 90" fill="none" stroke="var(--text-color)" stroke-width="1.5" />

                <path class="signal-bus sig-mix-a" d="M 255 67 L 290 67" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <path class="signal-bus sig-mix-b" d="M 255 80 L 270 80 L 270 98 L 290 98" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <path class="signal-bus sig-mix-c" d="M 255 93 L 265 93 L 265 129 L 290 129" fill="none" stroke="var(--text-color)" stroke-width="1.5" />

                <!-- DACS to OUTPUT PINS -->
                <!-- Weave the lines left of the I/O Ports to avoid overlapping -->
                <path class="signal-bus sig-out-a" d="M 345 67 L 355 67 L 355 155 L 120 155 L 120 170" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <path class="signal-bus sig-out-b" d="M 345 98 L 365 98 L 365 162 L 100 162 L 100 170" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <path class="signal-bus sig-out-c" d="M 345 129 L 375 129 L 375 42 L 100 42 L 100 30" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
            </svg>
        `;
    }
}