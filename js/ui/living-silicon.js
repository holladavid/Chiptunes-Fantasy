// === js/ui/living-silicon.js ===
// =========================================================
// LIVING SILICON (HARDWARE LABORATORY VISUALIZER)
// Optimized high-readability text labels & scaled vector tracks.
// =========================================================

export class LivingSilicon {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.activeSystem = null;
        this.cache = {};
    }

    setSystem(system) {
        if (this.activeSystem === system) return;
        this.activeSystem = system;
        this.renderChassis();
    }

    renderChassis() {
        if (!this.container) return;

        let svgContent = '';
        if (this.activeSystem === 'c64') {
            svgContent = this.getSidSvg();
        } else if (this.activeSystem === 'amiga') {
            svgContent = this.getPaulaSvg();
        } else {
            svgContent = this.getYmSvg();
        }

        this.container.innerHTML = `
            <div class="silicon-chassis">
                ${svgContent}
            </div>
        `;

        this.cache = {
            v0: this.container.querySelector('.silicon-v0'),
            v1: this.container.querySelector('.silicon-v1'),
            v2: this.container.querySelector('.silicon-v2'),
            v3: this.container.querySelector('.silicon-v3'),
            outL: this.container.querySelector('.silicon-out-l'),
            outR: this.container.querySelector('.silicon-out-r'),
            pin0: this.container.querySelector('.pin-ch0'),
            pin1: this.container.querySelector('.pin-ch1'),
            pin2: this.container.querySelector('.pin-ch2'),
            pin3: this.container.querySelector('.pin-ch3'),
            pinOutL: this.container.querySelector('.pin-out-l'),
            pinOutR: this.container.querySelector('.pin-out-r')
        };
    }

    update(channelVolumes) {
        if (!this.activeSystem || !this.cache) return;

        const v0 = channelVolumes[0] || 0.0;
        const v1 = channelVolumes[1] || 0.0;
        const v2 = channelVolumes[2] || 0.0;
        const v3 = channelVolumes[3] || 0.0;

        let outL = 0.0;
        let outR = 0.0;

        if (this.activeSystem === 'amiga') {
            outL = (v0 + v3) * 0.5;
            outR = (v1 + v2) * 0.5;
        } else {
            outL = (v0 + v1 + v2) / 3.0;
            outR = outL;
        }

        if (this.cache.v0) this.updateElementGlow(this.cache.v0, v0);
        if (this.cache.v1) this.updateElementGlow(this.cache.v1, v1);
        if (this.cache.v2) this.updateElementGlow(this.cache.v2, v2);
        if (this.cache.v3) this.updateElementGlow(this.cache.v3, v3);

        if (this.cache.outL) this.updateElementGlow(this.cache.outL, outL);
        if (this.cache.outR) this.updateElementGlow(this.cache.outR, outR);

        if (this.cache.pin0) this.updatePinGlow(this.cache.pin0, v0);
        if (this.cache.pin1) this.updatePinGlow(this.cache.pin1, v1);
        if (this.cache.pin2) this.updatePinGlow(this.cache.pin2, v2);
        if (this.cache.pin3) this.updatePinGlow(this.cache.pin3, v3);

        if (this.cache.pinOutL) this.updatePinGlow(this.cache.pinOutL, outL);
        if (this.cache.pinOutR) this.updatePinGlow(this.cache.pinOutR, outR);
    }

    updateElementGlow(el, val) {
        el.style.opacity = 0.15 + val * 0.85;
        if (val > 0.05) {
            el.style.filter = `drop-shadow(0 0 ${2 + val * 10}px var(--text-color))`;
        } else {
            el.style.filter = 'none';
        }
    }

    updatePinGlow(el, val) {
        el.style.fill = val > 0.1 ? 'var(--highlight-color)' : 'var(--panel-text)';
        if (val > 0.1) {
            el.style.filter = `drop-shadow(0 0 ${1 + val * 6}px var(--text-color))`;
        } else {
            el.style.filter = 'none';
        }
    }

    getSidSvg() {
        return `
            <svg viewBox="0 0 400 130" xmlns="http://www.w3.org/2000/svg">
                <!-- Package Body -->
                <rect class="silicon-chip-body" x="40" y="30" width="320" height="70" rx="3" />
                <!-- Notch -->
                <path d="M 40 55 A 10 10 0 0 1 40 75 Z" fill="var(--chassis-dark)" />
                <text x="55" y="46" class="silicon-chip-label" fill="var(--panel-text)">MOS 6581 - SID</text>
                
                <!-- Pins Links -->
                <rect class="silicon-pin" x="70" y="20" width="10" height="10" />
                <rect class="silicon-pin" x="100" y="20" width="10" height="10" />
                <rect class="silicon-pin" x="130" y="20" width="10" height="10" />
                <rect class="silicon-pin pin-ch0" x="160" y="20" width="10" height="10" />
                <rect class="silicon-pin pin-ch1" x="190" y="20" width="10" height="10" />
                <rect class="silicon-pin pin-ch2" x="220" y="20" width="10" height="10" />
                <rect class="silicon-pin" x="250" y="20" width="10" height="10" />
                <rect class="silicon-pin" x="280" y="20" width="10" height="10" />
                <rect class="silicon-pin" x="310" y="20" width="10" height="10" />

                <!-- Pins Rechts -->
                <rect class="silicon-pin pin-out-l" x="280" y="100" width="10" height="10" />
                <rect class="silicon-pin" x="310" y="100" width="10" height="10" />

                <!-- Internal Die Window -->
                <rect x="110" y="48" width="180" height="34" rx="2" fill="var(--screen-bg)" stroke="var(--chassis-dark)" stroke-width="1.5" />
                
                <!-- Silicon Die Circuits -->
                <g class="silicon-v0" style="opacity: 0.2;">
                    <rect x="120" y="53" width="30" height="12" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="126" y="62" font-size="8" fill="var(--text-color)">V1</text>
                </g>
                <g class="silicon-v1" style="opacity: 0.2;">
                    <rect x="155" y="53" width="30" height="12" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="161" y="62" font-size="8" fill="var(--text-color)">V2</text>
                </g>
                <g class="silicon-v2" style="opacity: 0.2;">
                    <rect x="190" y="53" width="30" height="12" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="196" y="62" font-size="8" fill="var(--text-color)">V3</text>
                </g>
                <g class="silicon-out-l" style="opacity: 0.2;">
                    <rect x="230" y="53" width="52" height="24" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="234" y="67" font-size="8" fill="var(--text-color)" font-weight="bold">SVF/VCA</text>
                </g>

                <!-- Signal Bus Lines -->
                <path class="silicon-die-bus silicon-v0" d="M 135 65 L 135 72 L 230 72" fill="none" stroke="var(--text-color)" stroke-width="1" style="opacity:0.2;" />
                <path class="silicon-die-bus silicon-v1" d="M 170 65 L 170 72 L 230 72" fill="none" stroke="var(--text-color)" stroke-width="1" style="opacity:0.2;" />
                <path class="silicon-die-bus silicon-v2" d="M 205 65 L 205 72 L 230 72" fill="none" stroke="var(--text-color)" stroke-width="1" style="opacity:0.2;" />
                <path class="silicon-die-bus silicon-out-l" d="M 282 65 L 285 65 L 285 100" fill="none" stroke="var(--text-color)" stroke-width="1" style="opacity:0.2;" />
            </svg>
        `;
    }

    getPaulaSvg() {
        return `
            <svg viewBox="0 0 400 130" xmlns="http://www.w3.org/2000/svg">
                <rect class="silicon-chip-body" x="40" y="30" width="320" height="70" rx="3" />
                <path d="M 40 55 A 10 10 0 0 1 40 75 Z" fill="var(--chassis-dark)" />
                <text x="55" y="46" class="silicon-chip-label" fill="var(--panel-text)">MOS 8364 - PAULA</text>

                <!-- Pins Left/Right Output Channels -->
                <rect class="silicon-pin pin-ch0" x="80" y="20" width="10" height="10" />
                <rect class="silicon-pin pin-ch1" x="110" y="20" width="10" height="10" />
                <rect class="silicon-pin pin-ch2" x="140" y="20" width="10" height="10" />
                <rect class="silicon-pin pin-ch3" x="170" y="20" width="10" height="10" />
                
                <rect class="silicon-pin pin-out-l" x="250" y="100" width="10" height="10" />
                <rect class="silicon-pin pin-out-r" x="280" y="100" width="10" height="10" />

                <!-- Die Window -->
                <rect x="70" y="48" width="260" height="34" rx="2" fill="var(--screen-bg)" stroke="var(--chassis-dark)" stroke-width="1.5" />

                <!-- 4 DMA Audios -->
                <g class="silicon-v0" style="opacity: 0.2;">
                    <rect x="80" y="53" width="35" height="12" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="83" y="62" font-size="8" fill="var(--text-color)">DMA0</text>
                </g>
                <g class="silicon-v1" style="opacity: 0.2;">
                    <rect x="120" y="53" width="35" height="12" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="123" y="62" font-size="8" fill="var(--text-color)">DMA1</text>
                </g>
                <g class="silicon-v2" style="opacity: 0.2;">
                    <rect x="160" y="53" width="35" height="12" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="163" y="62" font-size="8" fill="var(--text-color)">DMA2</text>
                </g>
                <g class="silicon-v3" style="opacity: 0.2;">
                    <rect x="200" y="53" width="35" height="12" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="203" y="62" font-size="8" fill="var(--text-color)">DMA3</text>
                </g>

                <!-- Stereo Mixing Gatter -->
                <g class="silicon-out-l" style="opacity: 0.2;">
                    <rect x="245" y="53" width="35" height="24" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="248" y="67" font-size="8" fill="var(--text-color)" font-weight="bold">DAC_L</text>
                </g>
                <g class="silicon-out-r" style="opacity: 0.2;">
                    <rect x="285" y="53" width="35" height="24" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="288" y="67" font-size="8" fill="var(--text-color)" font-weight="bold">DAC_R</text>
                </g>

                <!-- Stereo Bus routing -->
                <path class="silicon-die-bus silicon-v0" d="M 97 65 L 97 74 L 245 74" fill="none" stroke="var(--text-color)" stroke-width="1" style="opacity:0.2;" />
                <path class="silicon-die-bus silicon-v3" d="M 217 65 L 217 74 L 245 74" fill="none" stroke="var(--text-color)" stroke-width="1" style="opacity:0.2;" />
                
                <path class="silicon-die-bus silicon-v1" d="M 137 65 L 137 70 L 285 70" fill="none" stroke="var(--text-color)" stroke-width="1" style="opacity:0.2;" />
                <path class="silicon-die-bus silicon-v2" d="M 177 65 L 177 70 L 285 70" fill="none" stroke="var(--text-color)" stroke-width="1" style="opacity:0.2;" />

                <path class="silicon-die-bus silicon-out-l" d="M 262 77 L 262 100" fill="none" stroke="var(--text-color)" stroke-width="1" style="opacity:0.2;" />
                <path class="silicon-die-bus silicon-out-r" d="M 302 77 L 290 77 L 290 100" fill="none" stroke="var(--text-color)" stroke-width="1" style="opacity:0.2;" />
            </svg>
        `;
    }

    getYmSvg() {
        return `
            <svg viewBox="0 0 400 130" xmlns="http://www.w3.org/2000/svg">
                <rect class="silicon-chip-body" x="40" y="30" width="320" height="70" rx="3" />
                <path d="M 40 55 A 10 10 0 0 1 40 75 Z" fill="var(--chassis-dark)" />
                <text x="55" y="46" class="silicon-chip-label" fill="var(--panel-text)">YM2149F - SSG</text>

                <!-- Standard Pins -->
                <rect class="silicon-pin pin-ch0" x="70" y="20" width="10" height="10" />
                <rect class="silicon-pin pin-ch1" x="100" y="20" width="10" height="10" />
                <rect class="silicon-pin pin-ch2" x="130" y="20" width="10" height="10" />
                <rect class="silicon-pin pin-out-l" x="250" y="100" width="10" height="10" />

                <!-- Die Window -->
                <rect x="70" y="48" width="260" height="34" rx="2" fill="var(--screen-bg)" stroke="var(--chassis-dark)" stroke-width="1.5" />

                <!-- Registers / Logic Blocks -->
                <g class="silicon-v0" style="opacity: 0.2;">
                    <rect x="80" y="53" width="35" height="12" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="83" y="62" font-size="8" fill="var(--text-color)">OSC_A</text>
                </g>
                <g class="silicon-v1" style="opacity: 0.2;">
                    <rect x="120" y="53" width="35" height="12" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="123" y="62" font-size="8" fill="var(--text-color)">OSC_B</text>
                </g>
                <g class="silicon-v2" style="opacity: 0.2;">
                    <rect x="160" y="53" width="35" height="12" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="163" y="62" font-size="8" fill="var(--text-color)">OSC_C</text>
                </g>
                
                <!-- Logarithmischer 5-Bit DAC -->
                <g class="silicon-out-l" style="opacity: 0.2;">
                    <rect x="205" y="53" width="115" height="24" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="209" y="67" font-size="8" fill="var(--text-color)" font-weight="bold">3x LOG_DAC</text>
                </g>

                <path class="silicon-die-bus silicon-v0" d="M 97 65 L 97 74 L 205 74" fill="none" stroke="var(--text-color)" stroke-width="1" style="opacity:0.2;" />
                <path class="silicon-die-bus silicon-v1" d="M 137 65 L 137 70 L 205 70" fill="none" stroke="var(--text-color)" stroke-width="1" style="opacity:0.2;" />
                <path class="silicon-die-bus silicon-v2" d="M 177 65 L 177 74 L 205 74" fill="none" stroke="var(--text-color)" stroke-width="1" style="opacity:0.2;" />

                <path class="silicon-die-bus silicon-out-l" d="M 262 77 L 262 100" fill="none" stroke="var(--text-color)" stroke-width="1" style="opacity:0.2;" />
            </svg>
        `;
    }
}