// === js/ui/silicon/sid-6581.js ===
// =========================================================
// MOS 6581 (SID) SILICON DIE VISUALIZER
// Historically accurate die layout featuring distinct ADSR 
// envelopes, real-time Filter/Bypass multiplexer routing, 
// and precise DIP-28 pin mappings (Caps: 1-4, Audio: 27).
// =========================================================

import { BaseChip } from './base-chip.js';

export class Sid6581 extends BaseChip {
    
    cacheDOM() {
        this.cache = {
            // Functional Blocks
            osc1: this.container.querySelector('.sid-osc1'), osc2: this.container.querySelector('.sid-osc2'), osc3: this.container.querySelector('.sid-osc3'),
            env1: this.container.querySelector('.sid-env1'), env2: this.container.querySelector('.sid-env2'), env3: this.container.querySelector('.sid-env3'),
            filtBlock: this.container.querySelector('.sid-filt-block'), vcaBlock: this.container.querySelector('.sid-vca'),
            
            // Labels & Data
            osc1Hz: this.container.querySelector('.sid-osc1-hz'), osc2Hz: this.container.querySelector('.sid-osc2-hz'), osc3Hz: this.container.querySelector('.sid-osc3-hz'),
            filtCutLabel: this.container.querySelector('.sid-filt-cut'), filtResBar: this.container.querySelector('.sid-filt-res-bar'),
            
            // LEDs
            w1T: this.container.querySelector('.w1-t'), w1S: this.container.querySelector('.w1-s'), w1P: this.container.querySelector('.w1-p'), w1N: this.container.querySelector('.w1-n'),
            w2T: this.container.querySelector('.w2-t'), w2S: this.container.querySelector('.w2-s'), w2P: this.container.querySelector('.w2-p'), w2N: this.container.querySelector('.w2-n'),
            w3T: this.container.querySelector('.w3-t'), w3S: this.container.querySelector('.w3-s'), w3P: this.container.querySelector('.w3-p'), w3N: this.container.querySelector('.w3-n'),
            lpLed: this.container.querySelector('.sid-lp-led'), bpLed: this.container.querySelector('.sid-bp-led'), hpLed: this.container.querySelector('.sid-hp-led'),
            
            // Physical Routing Buses
            sigOsc1Filt: this.container.querySelector('.sig-osc1-filt'), sigOsc1Byp: this.container.querySelector('.sig-osc1-byp'),
            sigOsc2Filt: this.container.querySelector('.sig-osc2-filt'), sigOsc2Byp: this.container.querySelector('.sig-osc2-byp'),
            sigOsc3Filt: this.container.querySelector('.sig-osc3-filt'), sigOsc3Byp: this.container.querySelector('.sig-osc3-byp'),
            sigVcfOut: this.container.querySelector('.sig-vcf-out'), sigMasterOut: this.container.querySelector('.sig-master-out'),
            
            // Physical DIP-28 Pins
            pinOut: this.container.querySelector('.pin-top-27'), // Pin 27 = Audio Out
            pinCap1A: this.container.querySelector('.pin-bot-1'), pinCap1B: this.container.querySelector('.pin-bot-2'), // Pins 1 & 2
            pinCap2A: this.container.querySelector('.pin-bot-3'), pinCap2B: this.container.querySelector('.pin-bot-4')  // Pins 3 & 4
        };
    }

    update(vols, regs, t) {
        if (!regs) return;
        const v0 = vols[0] || 0.0, v1 = vols[1] || 0.0, v2 = vols[2] || 0.0;
        const totalV = (v0 + v1 + v2) / 3.0;

        // 1. Oscillator Frequencies
        const hz0 = (regs[0] | (regs[1] << 8)) ? Math.round(((regs[0] | (regs[1] << 8)) * 985248) / 16777216) : 0;
        const hz1 = (regs[7] | (regs[8] << 8)) ? Math.round(((regs[7] | (regs[8] << 8)) * 985248) / 16777216) : 0;
        const hz2 = (regs[14] | (regs[15] << 8)) ? Math.round(((regs[14] | (regs[15] << 8)) * 985248) / 16777216) : 0;

        if (this.cache.osc1Hz) this.cache.osc1Hz.textContent = hz0 > 0 ? `${hz0}Hz` : 'IDLE';
        if (this.cache.osc2Hz) this.cache.osc2Hz.textContent = hz1 > 0 ? `${hz1}Hz` : 'IDLE';
        if (this.cache.osc3Hz) this.cache.osc3Hz.textContent = hz2 > 0 ? `${hz2}Hz` : 'IDLE';

        // 2. Component Glow
        const setGlow = (el, val) => { if (el) el.style.opacity = 0.25 + val * 0.75; };
        setGlow(this.cache.osc1, v0); setGlow(this.cache.env1, v0);
        setGlow(this.cache.osc2, v1); setGlow(this.cache.env2, v1);
        setGlow(this.cache.osc3, v2); setGlow(this.cache.env3, v2);
        setGlow(this.cache.vcaBlock, totalV);

        // 3. Waveform Registers
        const setWave = (w, ctrl) => {
            if(this.cache[`w${w}T`]) this.cache[`w${w}T`].style.fill = (ctrl & 16) ? 'var(--highlight-color)' : 'var(--chassis-dark)';
            if(this.cache[`w${w}S`]) this.cache[`w${w}S`].style.fill = (ctrl & 32) ? 'var(--highlight-color)' : 'var(--chassis-dark)';
            if(this.cache[`w${w}P`]) this.cache[`w${w}P`].style.fill = (ctrl & 64) ? 'var(--highlight-color)' : 'var(--chassis-dark)';
            if(this.cache[`w${w}N`]) this.cache[`w${w}N`].style.fill = (ctrl & 128) ? 'var(--highlight-color)' : 'var(--chassis-dark)';
        };
        setWave(1, regs[4]); setWave(2, regs[11]); setWave(3, regs[18]);

        // 4. Analog Filter Data
        const cutoffReg = (regs[22] << 3) | (regs[21] & 7);
        const resReg = regs[23] >> 4;
        const routeReg = regs[23] & 15; // Filter Routing Multiplexer
        const fMode = regs[24] & 0xF0;

        let fhz = (220.0 + Math.pow(cutoffReg / 2047.0, 1.4) * 11500.0) * (1.0 - ((regs[29] || 55) - 55.0) * 0.0035);
        if (this.cache.filtCutLabel) this.cache.filtCutLabel.textContent = `${Math.round(Math.max(30, fhz))}Hz`;
        if (this.cache.filtResBar) this.cache.filtResBar.setAttribute('width', (resReg / 15) * 60);

        if (this.cache.lpLed) this.cache.lpLed.style.fill = (fMode & 16) ? 'var(--highlight-color)' : 'var(--chassis-dark)';
        if (this.cache.bpLed) this.cache.bpLed.style.fill = (fMode & 32) ? 'var(--highlight-color)' : 'var(--chassis-dark)';
        if (this.cache.hpLed) this.cache.hpLed.style.fill = (fMode & 64) ? 'var(--highlight-color)' : 'var(--chassis-dark)';

        let filterLoad = 0.0;
        if (routeReg & 1) filterLoad += v0;
        if (routeReg & 2) filterLoad += v1;
        if (routeReg & 4) filterLoad += v2;

        if (this.cache.filtBlock) {
            this.cache.filtBlock.style.opacity = 0.25 + filterLoad * 0.4 + (resReg / 15.0) * 0.35;
            this.cache.filtBlock.style.filter = resReg > 8 ? `drop-shadow(0 0 ${resReg}px var(--text-color))` : 'none';
        }

        // 5. Multiplexer Routing Paths (Filter vs VCA Bypass)
        this.updateBusFlow(this.cache.sigOsc1Filt, (routeReg & 1) ? v0 : 0);
        this.updateBusFlow(this.cache.sigOsc1Byp,  (routeReg & 1) ? 0 : v0);
        
        this.updateBusFlow(this.cache.sigOsc2Filt, (routeReg & 2) ? v1 : 0);
        this.updateBusFlow(this.cache.sigOsc2Byp,  (routeReg & 2) ? 0 : v1);
        
        this.updateBusFlow(this.cache.sigOsc3Filt, (routeReg & 4) ? v2 : 0);
        this.updateBusFlow(this.cache.sigOsc3Byp,  (routeReg & 4) ? 0 : v2);

        this.updateBusFlow(this.cache.sigVcfOut, filterLoad);
        this.updateBusFlow(this.cache.sigMasterOut, totalV);
        
        // 6. Output & Capacitor Pins
        this.updatePinGlow(this.cache.pinOut, totalV);
        
        // The analog capacitors (Pins 1-4) light up when the filter processes strong resonance
        const capGlow = (filterLoad * 0.5) + (resReg / 15.0) * 0.5;
        this.updatePinGlow(this.cache.pinCap1A, capGlow);
        this.updatePinGlow(this.cache.pinCap1B, capGlow);
        this.updatePinGlow(this.cache.pinCap2A, capGlow);
        this.updatePinGlow(this.cache.pinCap2B, capGlow);
    }

    getSvg() {
        return `
            <svg viewBox="0 0 500 200" xmlns="http://www.w3.org/2000/svg">
                <!-- 28 DIP Pins -->
                ${this.generatePins(28, 50, 400)}
                
                <!-- Package Body -->
                <rect class="silicon-chip-body" x="50" y="30" width="400" height="140" rx="4" />
                <path d="M 50 85 A 15 15 0 0 1 50 115 Z" fill="var(--chassis-dark)" />
                <circle cx="65" cy="45" r="4" fill="var(--chassis-dark)" />
                <text x="250" y="40" class="silicon-chip-label" fill="var(--panel-text)" text-anchor="middle" dominant-baseline="middle">MOS 6581 SOUND INTERFACE DEVICE</text>

                <!-- Die Window -->
                <rect x="80" y="48" width="340" height="106" rx="2" fill="var(--screen-bg)" stroke="var(--chassis-dark)" stroke-width="2" />

                <!-- == 3x OSCILLATORS == -->
                <g class="sid-osc1" style="opacity: 0.25;">
                    <rect x="85" y="52" width="55" height="28" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.2" />
                    <text x="112" y="60" font-size="6" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">OSC 1</text>
                    <text x="112" y="68" class="sid-osc1-hz" font-size="6" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">0Hz</text>
                    <rect class="w1-t" x="91" y="73" width="4" height="4" fill="var(--chassis-dark)"/><text x="93" y="80" font-size="4" fill="var(--text-color)" text-anchor="middle">T</text>
                    <rect class="w1-s" x="101" y="73" width="4" height="4" fill="var(--chassis-dark)"/><text x="103" y="80" font-size="4" fill="var(--text-color)" text-anchor="middle">S</text>
                    <rect class="w1-p" x="111" y="73" width="4" height="4" fill="var(--chassis-dark)"/><text x="113" y="80" font-size="4" fill="var(--text-color)" text-anchor="middle">P</text>
                    <rect class="w1-n" x="121" y="73" width="4" height="4" fill="var(--chassis-dark)"/><text x="123" y="80" font-size="4" fill="var(--text-color)" text-anchor="middle">N</text>
                </g>
                <g class="sid-osc2" style="opacity: 0.25;">
                    <rect x="85" y="87" width="55" height="28" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.2" />
                    <text x="112" y="95" font-size="6" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">OSC 2</text>
                    <text x="112" y="103" class="sid-osc2-hz" font-size="6" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">0Hz</text>
                    <rect class="w2-t" x="91" y="108" width="4" height="4" fill="var(--chassis-dark)"/><rect class="w2-s" x="101" y="108" width="4" height="4" fill="var(--chassis-dark)"/>
                    <rect class="w2-p" x="111" y="108" width="4" height="4" fill="var(--chassis-dark)"/><rect class="w2-n" x="121" y="108" width="4" height="4" fill="var(--chassis-dark)"/>
                </g>
                <g class="sid-osc3" style="opacity: 0.25;">
                    <rect x="85" y="122" width="55" height="28" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.2" />
                    <text x="112" y="130" font-size="6" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">OSC 3</text>
                    <text x="112" y="138" class="sid-osc3-hz" font-size="6" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">0Hz</text>
                    <rect class="w3-t" x="91" y="143" width="4" height="4" fill="var(--chassis-dark)"/><rect class="w3-s" x="101" y="143" width="4" height="4" fill="var(--chassis-dark)"/>
                    <rect class="w3-p" x="111" y="143" width="4" height="4" fill="var(--chassis-dark)"/><rect class="w3-n" x="121" y="143" width="4" height="4" fill="var(--chassis-dark)"/>
                </g>

                <!-- == 3x ADSR ENVELOPES == -->
                <g class="sid-env1" style="opacity: 0.25;">
                    <rect x="145" y="52" width="35" height="28" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.2" />
                    <text x="162" y="60" font-size="5" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">ADSR 1</text>
                    <path d="M 148 75 L 154 65 L 158 69 L 168 69 L 175 75" fill="none" stroke="var(--text-color)" stroke-width="1" />
                </g>
                <g class="sid-env2" style="opacity: 0.25;">
                    <rect x="145" y="87" width="35" height="28" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.2" />
                    <text x="162" y="95" font-size="5" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">ADSR 2</text>
                    <path d="M 148 110 L 154 100 L 158 104 L 168 104 L 175 110" fill="none" stroke="var(--text-color)" stroke-width="1" />
                </g>
                <g class="sid-env3" style="opacity: 0.25;">
                    <rect x="145" y="122" width="35" height="28" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.2" />
                    <text x="162" y="130" font-size="5" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">ADSR 3</text>
                    <path d="M 148 145 L 154 135 L 158 139 L 168 139 L 175 145" fill="none" stroke="var(--text-color)" stroke-width="1" />
                </g>

                <!-- == MULTIMODE FILTER == -->
                <g class="sid-filt-block" style="opacity: 0.25;">
                    <rect x="195" y="52" width="125" height="98" rx="2" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="257" y="64" font-size="7" fill="var(--text-color)" font-weight="bold" text-anchor="middle" dominant-baseline="middle">MULTIMODE VCF</text>
                    <text x="257" y="78" class="sid-filt-cut" font-size="8" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">FC: 30Hz</text>
                    
                    <text x="222" y="95" font-size="5" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">RES</text>
                    <rect x="235" y="93" width="60" height="4" fill="none" stroke="var(--text-color)" stroke-width="1" />
                    <rect class="sid-filt-res-bar" x="235" y="93" width="0" height="4" fill="var(--text-color)" />

                    <circle class="sid-lp-led" cx="225" cy="110" r="4" fill="var(--chassis-dark)" />
                    <text x="225" y="120" font-size="5" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">LP</text>
                    
                    <circle class="sid-bp-led" cx="257" cy="110" r="4" fill="var(--chassis-dark)" />
                    <text x="257" y="120" font-size="5" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">BP</text>

                    <circle class="sid-hp-led" cx="289" cy="110" r="4" fill="var(--chassis-dark)" />
                    <text x="289" y="120" font-size="5" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">HP</text>
                </g>

                <!-- == MASTER VCA == -->
                <g class="sid-vca" style="opacity: 0.95;">
                    <rect x="335" y="85" width="65" height="32" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="367" y="96" font-size="6" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">MASTER VCA</text>
                    <text x="367" y="106" font-size="5" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">MULTIPLIER</text>
                </g>

                <!-- == SIGNAL BUS: FILTER ROUTING MULTIPLEXER == -->
                <!-- Paths to Filter -->
                <path class="signal-bus sig-osc1-filt" d="M 180 66 L 195 66" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <path class="signal-bus sig-osc2-filt" d="M 180 101 L 195 101" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <path class="signal-bus sig-osc3-filt" d="M 180 136 L 195 136" fill="none" stroke="var(--text-color)" stroke-width="1.5" />

                <!-- Paths bypassing the Filter (Direct to VCA) -->
                <path class="signal-bus sig-osc1-byp" d="M 180 58 L 190 58 L 190 42 L 355 42 L 355 85" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <path class="signal-bus sig-osc2-byp" d="M 180 93 L 187 93 L 187 42" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <path class="signal-bus sig-osc3-byp" d="M 180 128 L 184 128 L 184 160 L 355 160 L 355 117" fill="none" stroke="var(--text-color)" stroke-width="1.5" />

                <path class="signal-bus sig-vcf-out" d="M 320 101 L 335 101" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                
                <!-- Output to Pin 27 (Top Row, 2nd from left = cx ~93) -->
                <path class="signal-bus sig-master-out" d="M 400 101 L 425 101 L 425 20 L 93 20 L 93 15" fill="none" stroke="var(--text-color)" stroke-width="1.5" />

                <!-- VCF to Capacitors (Pins 1-4 Bottom Left) -->
                <path class="signal-bus sig-vcf-out" d="M 230 150 L 230 160 L 64 160 L 64 170" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <path class="signal-bus sig-vcf-out" d="M 250 150 L 250 163 L 93 163 L 93 170" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <path class="signal-bus sig-vcf-out" d="M 270 150 L 270 163 L 121 163 L 121 170" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <path class="signal-bus sig-vcf-out" d="M 290 150 L 290 160 L 150 160 L 150 170" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
            </svg>
        `;
    }
}