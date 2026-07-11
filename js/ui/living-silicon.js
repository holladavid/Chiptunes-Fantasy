// === js/ui/living-silicon.js ===
// =========================================================
// LIVING SILICON (THE HARDWARE LABORATORY VISUALIZER)
// High-Fidelity Vector Silicon Die Emulator with real-time
// DIP-Package mapping, Notch-Design and Logic-Gate analysis.
// =========================================================

export class LivingSilicon {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.activeSystem = null;
        this.cache = {};
        this.lastNoiseFlip = 0;
        this.noiseState = false;
    }

    setSystem(system) {
        if (this.activeSystem === system) return;
        this.activeSystem = system;
        this.renderChassis();
    }

    // Erzeugt physikalisch korrekte DIP-Pins entlang der oberen und unteren Gehäusekante
    generatePins(pinCount, startX, width) {
        const pinsPerSide = pinCount / 2;
        const spacing = width / pinsPerSide;
        let pinsHTML = '';
        for (let i = 0; i < pinsPerSide; i++) {
            const px = startX + (i * spacing) + (spacing * 0.25);
            const pinW = spacing * 0.5;
            // Untere Reihe (Pin 1 bis N/2) - Zählung links nach rechts
            pinsHTML += `<rect class="silicon-pin pin-bot-${i + 1}" x="${px}" y="170" width="${pinW}" height="15" rx="1" />`;
            // Obere Reihe (Pin N bis N/2 + 1) - Zählung rechts nach links!
            pinsHTML += `<rect class="silicon-pin pin-top-${pinCount - i}" x="${px}" y="15" width="${pinW}" height="15" rx="1" />`;
        }
        return pinsHTML;
    }

    renderChassis() {
        if (!this.container) return;

        let svgContent = '';
        if (this.activeSystem === 'c64') svgContent = this.getSidSvg();
        else if (this.activeSystem === 'amiga') svgContent = this.getPaulaSvg();
        else svgContent = this.getYmSvg();

        this.container.innerHTML = `
            <div class="silicon-chassis">
                ${svgContent}
            </div>
        `;

        // Zero-Allocation DOM Caching
        this.cache = {
            osc1: this.container.querySelector('.sid-osc1'),
            osc2: this.container.querySelector('.sid-osc2'),
            osc3: this.container.querySelector('.sid-osc3'),
            filtBlock: this.container.querySelector('.sid-filt-block'),
            filtCutLabel: this.container.querySelector('.sid-filt-cut'),
            filtResBar: this.container.querySelector('.sid-filt-res-bar'),
            lpLed: this.container.querySelector('.sid-lp-led'),
            bpLed: this.container.querySelector('.sid-bp-led'),
            hpLed: this.container.querySelector('.sid-hp-led'),
            osc1Hz: this.container.querySelector('.sid-osc1-hz'),
            osc2Hz: this.container.querySelector('.sid-osc2-hz'),
            osc3Hz: this.container.querySelector('.sid-osc3-hz'),
            
            w1T: this.container.querySelector('.w1-t'), w1S: this.container.querySelector('.w1-s'), w1P: this.container.querySelector('.w1-p'), w1N: this.container.querySelector('.w1-n'),
            w2T: this.container.querySelector('.w2-t'), w2S: this.container.querySelector('.w2-s'), w2P: this.container.querySelector('.w2-p'), w2N: this.container.querySelector('.w2-n'),
            w3T: this.container.querySelector('.w3-t'), w3S: this.container.querySelector('.w3-s'), w3P: this.container.querySelector('.w3-p'), w3N: this.container.querySelector('.w3-n'),

            toneA: this.container.querySelector('.ym-tone-a'), toneB: this.container.querySelector('.ym-tone-b'), toneC: this.container.querySelector('.ym-tone-c'),
            toneAHz: this.container.querySelector('.ym-tone-a-hz'), toneBHz: this.container.querySelector('.ym-tone-b-hz'), toneCHz: this.container.querySelector('.ym-tone-c-hz'),
            noiseGen: this.container.querySelector('.ym-noise-gen'), noiseLabel: this.container.querySelector('.ym-noise-hz'),
            envGen: this.container.querySelector('.ym-env-gen'), envLabel: this.container.querySelector('.ym-env-hz'),
            mixTA: this.container.querySelector('.mix-t-a'), mixTB: this.container.querySelector('.mix-t-b'), mixTC: this.container.querySelector('.mix-t-c'),
            mixNA: this.container.querySelector('.mix-n-a'), mixNB: this.container.querySelector('.mix-n-b'), mixNC: this.container.querySelector('.mix-n-c'),
            
            dma0Hz: this.container.querySelector('.paula-dma0-hz'), dma1Hz: this.container.querySelector('.paula-dma1-hz'),
            dma2Hz: this.container.querySelector('.paula-dma2-hz'), dma3Hz: this.container.querySelector('.paula-dma3-hz'),
            ledFilt: this.container.querySelector('.paula-led-filt'), ledLabel: this.container.querySelector('.paula-led-label'),
            
            sig0: this.container.querySelector('.sig-path-0'), sig1: this.container.querySelector('.sig-path-1'),
            sig2: this.container.querySelector('.sig-path-2'), sig3: this.container.querySelector('.sig-path-3'),
            sigOutL: this.container.querySelector('.sig-path-out-l'), sigOutR: this.container.querySelector('.sig-path-out-r'),
            
            pinOutL: this.container.querySelector('.pin-audio-l'), pinOutR: this.container.querySelector('.pin-audio-r')
        };
    }

    update(channelVolumes, currentRegs, t) {
        if (!this.activeSystem || !this.cache) return;

        const v0 = channelVolumes[0] || 0.0;
        const v1 = channelVolumes[1] || 0.0;
        const v2 = channelVolumes[2] || 0.0;
        const v3 = channelVolumes[3] || 0.0;

        this.updateBusFlow(this.cache.sig0, v0);
        this.updateBusFlow(this.cache.sig1, v1);
        this.updateBusFlow(this.cache.sig2, v2);
        this.updateBusFlow(this.cache.sig3, v3);

        if (this.activeSystem === 'c64') this.updateSidLogic(currentRegs, v0, v1, v2);
        else if (this.activeSystem === 'atari') this.updateYmLogic(currentRegs, v0, v1, v2, t);
        else if (this.activeSystem === 'amiga') this.updatePaulaLogic(currentRegs, v0, v1, v2, v3);
    }

    updateBusFlow(el, volume) {
        if (!el) return;
        el.style.opacity = 0.1 + volume * 0.9;
        if (volume > 0.05) {
            const duration = Math.max(0.15, 1.2 - volume * 1.0);
            el.style.animationDuration = `${duration}s`;
            el.style.stroke = 'var(--highlight-color)';
            el.style.filter = `drop-shadow(0 0 ${2 + volume * 6}px var(--text-color))`;
        } else {
            el.style.animationDuration = '0s';
            el.style.stroke = 'var(--text-color)';
            el.style.filter = 'none';
        }
    }

    updatePinGlow(el, val) {
        if (!el) return;
        el.style.fill = val > 0.1 ? 'var(--highlight-color)' : 'var(--panel-text)';
        el.style.filter = val > 0.1 ? `drop-shadow(0 0 ${1 + val * 6}px var(--text-color))` : 'none';
    }

    updateSidLogic(regs, v0, v1, v2) {
        if (!regs) return;

        const f0 = regs[0] | (regs[1] << 8); const hz0 = f0 ? Math.round((f0 * 985248) / 16777216) : 0;
        const f1 = regs[7] | (regs[8] << 8); const hz1 = f1 ? Math.round((f1 * 985248) / 16777216) : 0;
        const f2 = regs[14] | (regs[15] << 8); const hz2 = f2 ? Math.round((f2 * 985248) / 16777216) : 0;

        if (this.cache.osc1Hz) this.cache.osc1Hz.textContent = hz0 > 0 ? `${hz0}Hz` : 'IDLE';
        if (this.cache.osc2Hz) this.cache.osc2Hz.textContent = hz1 > 0 ? `${hz1}Hz` : 'IDLE';
        if (this.cache.osc3Hz) this.cache.osc3Hz.textContent = hz2 > 0 ? `${hz2}Hz` : 'IDLE';

        if (this.cache.osc1) this.cache.osc1.style.opacity = 0.2 + v0 * 0.8;
        if (this.cache.osc2) this.cache.osc2.style.opacity = 0.2 + v1 * 0.8;
        if (this.cache.osc3) this.cache.osc3.style.opacity = 0.2 + v2 * 0.8;

        // Waveform LEDs dekodieren
        const setWave = (w, ctrl) => {
            if(this.cache[`w${w}T`]) this.cache[`w${w}T`].style.fill = (ctrl & 16) ? 'var(--highlight-color)' : 'var(--chassis-dark)';
            if(this.cache[`w${w}S`]) this.cache[`w${w}S`].style.fill = (ctrl & 32) ? 'var(--highlight-color)' : 'var(--chassis-dark)';
            if(this.cache[`w${w}P`]) this.cache[`w${w}P`].style.fill = (ctrl & 64) ? 'var(--highlight-color)' : 'var(--chassis-dark)';
            if(this.cache[`w${w}N`]) this.cache[`w${w}N`].style.fill = (ctrl & 128) ? 'var(--highlight-color)' : 'var(--chassis-dark)';
        };
        setWave(1, regs[4]); setWave(2, regs[11]); setWave(3, regs[18]);

        // SVF Filter
        const cutoffReg = (regs[22] << 3) | (regs[21] & 7);
        const resReg = regs[23] >> 4;
        const fMode = regs[24] & 0xF0;

        const temp = regs[29] || 55;
        const norm = cutoffReg / 2047.0;
        let fhz = (220.0 + Math.pow(norm, 1.4) * 11500.0) * (1.0 - (temp - 55.0) * 0.0035);
        if (fhz < 30) fhz = 30;

        if (this.cache.filtCutLabel) this.cache.filtCutLabel.textContent = `${Math.round(fhz)}Hz`;
        if (this.cache.filtResBar) this.cache.filtResBar.setAttribute('width', (resReg / 15) * 50);

        if (this.cache.lpLed) this.cache.lpLed.style.fill = (fMode & 16) ? 'var(--highlight-color)' : 'var(--chassis-dark)';
        if (this.cache.bpLed) this.cache.bpLed.style.fill = (fMode & 32) ? 'var(--highlight-color)' : 'var(--chassis-dark)';
        if (this.cache.hpLed) this.cache.hpLed.style.fill = (fMode & 64) ? 'var(--highlight-color)' : 'var(--chassis-dark)';

        if (this.cache.filtBlock) {
            const intensity = 0.2 + (v0 + v1 + v2) * 0.3 + (resReg / 15.0) * 0.5;
            this.cache.filtBlock.style.opacity = intensity;
            this.cache.filtBlock.style.filter = resReg > 8 ? `drop-shadow(0 0 ${resReg}px var(--text-color))` : 'none';
        }

        const outVal = (v0 + v1 + v2) / 3.0;
        this.updateBusFlow(this.cache.sigOutL, outVal);
        this.updatePinGlow(this.cache.pinOutL, outVal); // AUDIO OUT PIN (Pin 27)
    }

    updateYmLogic(regs, v0, v1, v2, t) {
        if (!regs) return;

        const pA = ((regs[1] & 0x0F) << 8) | regs[0]; const hzA = pA ? Math.round(2000000 / (16 * pA)) : 0;
        const pB = ((regs[3] & 0x0F) << 8) | regs[2]; const hzB = pB ? Math.round(2000000 / (16 * pB)) : 0;
        const pC = ((regs[5] & 0x0F) << 8) | regs[4]; const hzC = pC ? Math.round(2000000 / (16 * pC)) : 0;

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
        const hzNoise = pN ? Math.round(125000 / pN) : 0;
        if (this.cache.noiseLabel) this.cache.noiseLabel.textContent = hzNoise > 0 ? `${(hzNoise/1000).toFixed(1)}k` : 'IDLE';

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
            const breathing = hzEnv > 0 ? 0.3 + Math.sin(t * hzEnv * Math.PI * 2) * 0.5 : 0.15;
            this.cache.envGen.style.opacity = Math.max(0.15, breathing);
        }

        const outVal = (v0 + v1 + v2) / 3.0;
        this.updateBusFlow(this.cache.sigOutL, outVal);
        this.updatePinGlow(this.cache.pinOutL, outVal); // AUDIO PIN (z.B. Pin 4)
    }

    updatePaulaLogic(regs, v0, v1, v2, v3) {
        if (!regs) return;

        const setDma = (idx, hzEl, hzReg, vol) => {
            const hz = hzReg ? Math.round(3546895 / hzReg) : 0;
            if (hzEl) hzEl.textContent = hz > 0 && hz < 40000 ? `${hz}Hz` : 'IDLE';
        };
        setDma(0, this.cache.dma0Hz, (regs[4] << 8) | regs[5], v0);
        setDma(1, this.cache.dma1Hz, (regs[11] << 8) | regs[12], v1);
        setDma(2, this.cache.dma2Hz, (regs[18] << 8) | regs[19], v2);
        setDma(3, this.cache.dma3Hz, (regs[25] << 8) | regs[26], v3);

        const filterOn = (regs[29] === 0);
        if (this.cache.ledFilt) {
            this.cache.ledFilt.style.opacity = filterOn ? '0.95' : '0.15';
            this.cache.ledFilt.style.filter = filterOn ? 'drop-shadow(0 0 4px var(--text-color))' : 'none';
        }
        if (this.cache.ledLabel) this.cache.ledLabel.textContent = filterOn ? "ACTIVE" : "BYPASS";

        const outL = (v0 + v3) * 0.5;
        const outR = (v1 + v2) * 0.5;
        this.updateBusFlow(this.cache.sigOutL, outL);
        this.updateBusFlow(this.cache.sigOutR, outR);
        this.updatePinGlow(this.cache.pinOutL, outL); // Pin 32 (AUDL)
        this.updatePinGlow(this.cache.pinOutR, outR); // Pin 33 (AUDR)
    }

    getSidSvg() {
        return `
            <svg viewBox="0 0 500 200" xmlns="http://www.w3.org/2000/svg">
                <!-- 28 DIP Pins -->
                ${this.generatePins(28, 50, 400)}
                
                <!-- Package Body -->
                <rect class="silicon-chip-body" x="50" y="30" width="400" height="140" rx="4" />
                
                <!-- Notch & Pin 1 Dimple -->
                <path d="M 50 85 A 15 15 0 0 1 50 115 Z" fill="var(--chassis-dark)" />
                <circle cx="65" cy="45" r="4" fill="var(--chassis-dark)" />

                <text x="250" y="42" class="silicon-chip-label" fill="var(--panel-text)" text-anchor="middle" dominant-baseline="middle">MOS 6581 SOUND INTERFACE DEVICE</text>

                <!-- Die Window -->
                <rect x="90" y="55" width="320" height="100" rx="2" fill="var(--screen-bg)" stroke="var(--chassis-dark)" stroke-width="2" />

                <!-- == 3x OSCILLATORS == -->
                <g class="sid-osc1" style="opacity: 0.25;">
                    <rect x="100" y="62" width="70" height="24" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="135" y="70" font-size="6" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">OSC 1</text>
                    <text x="135" y="78" class="sid-osc1-hz" font-size="6" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">0Hz</text>
                    <!-- Waveform LEDs -->
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

                <!-- == FILTER BLOCK == -->
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

                <!-- Signal Bus -->
                <path class="signal-bus sig-path-0" d="M 170 74 L 220 74" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <path class="signal-bus sig-path-1" d="M 170 105 L 220 105" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <path class="signal-bus sig-path-2" d="M 170 136 L 195 136 L 195 120 L 220 120" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <path class="signal-bus sig-path-out-l" d="M 320 105 L 340 105" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                
                <!-- Pin Routing (Pin 27 Audio Out = Top row, 2nd from left) -->
                <path class="signal-bus sig-path-out-l" d="M 390 105 L 420 105 L 420 20 L 105 20" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <rect class="pin-audio-l" x="93" y="15" width="14" height="15" rx="1" fill="var(--chassis-dark)" />
            </svg>
        `;
    }

    getYmSvg() {
        return `
            <svg viewBox="0 0 500 200" xmlns="http://www.w3.org/2000/svg">
                <!-- 40 DIP Pins -->
                ${this.generatePins(40, 50, 400)}
                
                <rect class="silicon-chip-body" x="50" y="30" width="400" height="140" rx="4" />
                <path d="M 50 85 A 15 15 0 0 1 50 115 Z" fill="var(--chassis-dark)" />
                <circle cx="65" cy="45" r="4" fill="var(--chassis-dark)" />

                <text x="250" y="42" class="silicon-chip-label" fill="var(--panel-text)" text-anchor="middle" dominant-baseline="middle">YAMAHA YM2149F SSG</text>

                <rect x="90" y="55" width="320" height="100" rx="2" fill="var(--screen-bg)" stroke="var(--chassis-dark)" stroke-width="2" />

                <!-- == 3x TONE GENERATORS == -->
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

                <!-- == MIXER MATRIX == -->
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

                <!-- == NOISE GENERATOR == -->
                <g class="ym-noise-gen" style="opacity: 0.15;">
                    <rect x="180" y="62" width="70" height="15" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.2" />
                    <text x="215" y="69" class="ym-noise-hz" font-size="6" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">NOISE</text>
                </g>

                <!-- == ENVELOPE == -->
                <g class="ym-env-gen" style="opacity: 0.15;">
                    <rect x="260" y="62" width="60" height="68" rx="2" fill="none" stroke="var(--text-color)" stroke-width="1.5" stroke-dasharray="2,2" />
                    <text x="290" y="74" font-size="6" fill="var(--text-color)" font-weight="bold" text-anchor="middle" dominant-baseline="middle">ENV GEN</text>
                    <text x="290" y="86" class="ym-env-hz" font-size="6" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">0Hz</text>
                    <path d="M 270 115 L 290 100 L 290 115" fill="none" stroke="var(--highlight-color)" stroke-width="1.5" />
                </g>

                <!-- == LOG DAC == -->
                <g class="ym-dac" style="opacity: 0.95;">
                    <rect x="330" y="85" width="60" height="40" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="360" y="105" font-size="6" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">3x LOG_DAC</text>
                </g>

                <!-- Signal Bus -->
                <path class="signal-bus sig-path-0" d="M 160 74 L 180 90" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <path class="signal-bus sig-path-1" d="M 160 105 L 180 105" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <path class="signal-bus sig-path-2" d="M 160 136 L 180 120" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <path class="signal-bus sig-path-out-l" d="M 250 105 L 330 105" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                
                <!-- Pin 4 (Audio Out) Bottom Row -->
                <path class="signal-bus sig-path-out-l" d="M 390 105 L 420 105 L 420 170 L 105 170" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <rect class="pin-audio-l" x="93" y="170" width="14" height="15" rx="1" fill="var(--chassis-dark)" />
            </svg>
        `;
    }

    getPaulaSvg() {
        return `
            <svg viewBox="0 0 500 200" xmlns="http://www.w3.org/2000/svg">
                <!-- 48 DIP Pins -->
                ${this.generatePins(48, 50, 400)}

                <rect class="silicon-chip-body" x="50" y="30" width="400" height="140" rx="4" />
                <path d="M 50 85 A 15 15 0 0 1 50 115 Z" fill="var(--chassis-dark)" />
                <circle cx="65" cy="45" r="4" fill="var(--chassis-dark)" />

                <text x="250" y="42" class="silicon-chip-label" fill="var(--panel-text)" text-anchor="middle" dominant-baseline="middle">MOS 8364 PAULA (AMIGA DMA)</text>

                <rect x="90" y="55" width="320" height="100" rx="2" fill="var(--screen-bg)" stroke="var(--chassis-dark)" stroke-width="2" />

                <!-- == 4x DMA FIFOS == -->
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

                <!-- == LED FILTER == -->
                <g class="paula-led-filt" style="opacity: 0.15;">
                    <rect x="190" y="62" width="70" height="84" rx="2" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="225" y="74" font-size="6" fill="var(--text-color)" font-weight="bold" text-anchor="middle" dominant-baseline="middle">LED FILTER</text>
                    <text x="225" y="84" class="paula-led-label" font-size="6" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">ACTIVE</text>
                    <circle cx="225" cy="115" r="14" fill="none" stroke="var(--text-color)" stroke-width="1.5" stroke-dasharray="2,2" />
                </g>

                <!-- == DUAL DACS == -->
                <g class="paula-dac-l" style="opacity: 0.95;">
                    <rect x="290" y="65" width="45" height="30" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="312" y="80" font-size="7" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">DAC L</text>
                </g>
                <g class="paula-dac-r" style="opacity: 0.95;">
                    <rect x="290" y="110" width="45" height="30" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="312" y="125" font-size="7" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">DAC R</text>
                </g>

                <!-- Paula Hard-Routing -->
                <path class="signal-bus sig-path-0" d="M 175 71 L 290 80" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <path class="signal-bus sig-path-3" d="M 175 137 L 275 137 L 275 80 L 290 80" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                
                <path class="signal-bus sig-path-1" d="M 175 93 L 275 93 L 275 125 L 290 125" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <path class="signal-bus sig-path-2" d="M 175 115 L 290 125" fill="none" stroke="var(--text-color)" stroke-width="1.5" />

                <!-- Pin 32/33 Bottom Row (Right side) -->
                <path class="signal-bus sig-path-out-l" d="M 335 80 L 370 80 L 370 170" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <rect class="pin-audio-l" x="364" y="170" width="12" height="15" rx="1" fill="var(--chassis-dark)" />

                <path class="signal-bus sig-path-out-r" d="M 335 125 L 390 125 L 390 170" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <rect class="pin-audio-r" x="385" y="170" width="12" height="15" rx="1" fill="var(--chassis-dark)" />
            </svg>
        `;
    }
}