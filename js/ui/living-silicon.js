// === js/ui/living-silicon.js ===
// =========================================================
// LIVING SILICON (THE HARDWARE LABORATORY VISUALIZER)
// High-Fidelity Vector Silicon Die Emulator with real-time
// register parsing, interactive bus-routing and signal-flows.
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

        // Cache alle dynamischen DOM-Schnittstellen (Zero-Allocation im Render-Loop)
        this.cache = {
            // General
            title: this.container.querySelector('.silicon-chip-label'),
            // SID Specific
            osc1: this.container.querySelector('.sid-osc1'),
            osc2: this.container.querySelector('.sid-osc2'),
            osc3: this.container.querySelector('.sid-osc3'),
            sync12: this.container.querySelector('.sid-sync12'),
            ring23: this.container.querySelector('.sid-ring23'),
            filtBlock: this.container.querySelector('.sid-filt-block'),
            filtCutLabel: this.container.querySelector('.sid-filt-cut'),
            filtResBar: this.container.querySelector('.sid-filt-res-bar'),
            lpLed: this.container.querySelector('.sid-lp-led'),
            bpLed: this.container.querySelector('.sid-bp-led'),
            hpLed: this.container.querySelector('.sid-hp-led'),
            osc1Hz: this.container.querySelector('.sid-osc1-hz'),
            osc2Hz: this.container.querySelector('.sid-osc2-hz'),
            osc3Hz: this.container.querySelector('.sid-osc3-hz'),
            // YM Specific
            toneA: this.container.querySelector('.ym-tone-a'),
            toneB: this.container.querySelector('.ym-tone-b'),
            toneC: this.container.querySelector('.ym-tone-c'),
            toneAHz: this.container.querySelector('.ym-tone-a-hz'),
            toneBHz: this.container.querySelector('.ym-tone-b-hz'),
            toneCHz: this.container.querySelector('.ym-tone-c-hz'),
            noiseGen: this.container.querySelector('.ym-noise-gen'),
            noiseLabel: this.container.querySelector('.ym-noise-hz'),
            envGen: this.container.querySelector('.ym-env-gen'),
            envLabel: this.container.querySelector('.ym-env-hz'),
            envShape: this.container.querySelector('.ym-env-shape-preview'),
            mixG: this.container.querySelector('.ym-mixer-gate'),
            // Paula Specific
            dma0Hz: this.container.querySelector('.paula-dma0-hz'),
            dma1Hz: this.container.querySelector('.paula-dma1-hz'),
            dma2Hz: this.container.querySelector('.paula-dma2-hz'),
            dma3Hz: this.container.querySelector('.paula-dma3-hz'),
            ledFilt: this.container.querySelector('.paula-led-filt'),
            ledLabel: this.container.querySelector('.paula-led-label'),
            // Signal Lines
            sig0: this.container.querySelector('.sig-path-0'),
            sig1: this.container.querySelector('.sig-path-1'),
            sig2: this.container.querySelector('.sig-path-2'),
            sig3: this.container.querySelector('.sig-path-3'),
            sigOutL: this.container.querySelector('.sig-path-out-l'),
            sigOutR: this.container.querySelector('.sig-path-out-r')
        };
    }

    update(channelVolumes, currentRegs, t) {
        if (!this.activeSystem || !this.cache) return;

        const v0 = channelVolumes[0] || 0.0;
        const v1 = channelVolumes[1] || 0.0;
        const v2 = channelVolumes[2] || 0.0;
        const v3 = channelVolumes[3] || 0.0;

        // Signalleitungen dynamisch befeuern (CSS stroke-dashoffset Speed & Opacity)
        this.updateBusFlow(this.cache.sig0, v0);
        this.updateBusFlow(this.cache.sig1, v1);
        this.updateBusFlow(this.cache.sig2, v2);
        this.updateBusFlow(this.cache.sig3, v3);

        if (this.activeSystem === 'c64') {
            this.updateSidLogic(currentRegs, v0, v1, v2);
        } else if (this.activeSystem === 'atari') {
            this.updateYmLogic(currentRegs, v0, v1, v2, t);
        } else if (this.activeSystem === 'amiga') {
            this.updatePaulaLogic(currentRegs, v0, v1, v2, v3);
        }
    }

    updateBusFlow(el, volume) {
        if (!el) return;
        el.style.opacity = 0.1 + volume * 0.9;
        if (volume > 0.05) {
            // Skaliert die Geschwindigkeit der Elektronen proportional zur Lautstärke
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

    updateSidLogic(regs, v0, v1, v2) {
        if (!regs) return;

        // 1. Frequenzen der Oszillatoren dekodieren
        const f0 = regs[0] | (regs[1] << 8);
        const f1 = regs[7] | (regs[8] << 8);
        const f2 = regs[14] | (regs[15] << 8);

        const hz0 = f0 ? Math.round((f0 * 985248) / 16777216) : 0;
        const hz1 = f1 ? Math.round((f1 * 985248) / 16777216) : 0;
        const hz2 = f2 ? Math.round((f2 * 985248) / 16777216) : 0;

        if (this.cache.osc1Hz) this.cache.osc1Hz.textContent = hz0 > 0 ? `${hz0}Hz` : 'OFF';
        if (this.cache.osc2Hz) this.cache.osc2Hz.textContent = hz1 > 0 ? `${hz1}Hz` : 'OFF';
        if (this.cache.osc3Hz) this.cache.osc3Hz.textContent = hz2 > 0 ? `${hz2}Hz` : 'OFF';

        // Oszillator-Glow passend zur Aktivität
        if (this.cache.osc1) this.cache.osc1.style.opacity = 0.2 + v0 * 0.8;
        if (this.cache.osc2) this.cache.osc2.style.opacity = 0.2 + v1 * 0.8;
        if (this.cache.osc3) this.cache.osc3.style.opacity = 0.2 + v2 * 0.8;

        // 2. SYNC & RING MOD Status visualisieren
        const ctrl1 = regs[4];
        const ctrl2 = regs[11];
        
        const syncActive = (ctrl1 & 2) !== 0;
        const ringActive = (ctrl2 & 4) !== 0;

        if (this.cache.sync12) this.cache.sync12.style.opacity = syncActive ? '1.0' : '0.1';
        if (this.cache.ring23) this.cache.ring23.style.opacity = ringActive ? '1.0' : '0.1';

        // 3. Analoges SVF Filter-Modul berechnen
        const cutoffReg = (regs[22] << 3) | (regs[21] & 7);
        const resReg = regs[23] >> 4;
        const fMode = regs[24] & 0xF0;

        // Anzeige des echten Cutoffs in Hz
        const temp = regs[29] || 55;
        const norm = cutoffReg / 2047.0;
        const thermalCoefficient = 1.0 - (temp - 55.0) * 0.0035;
        let fhz = (220.0 + Math.pow(norm, 1.4) * 11500.0) * thermalCoefficient;
        if (fhz < 30) fhz = 30;

        if (this.cache.filtCutLabel) this.cache.filtCutLabel.textContent = `FC:${Math.round(fhz)}Hz`;
        if (this.cache.filtResBar) this.cache.filtResBar.setAttribute('width', (resReg / 15) * 50);

        // Filter LEDs
        if (this.cache.lpLed) this.cache.lpLed.style.fill = (fMode & 16) ? 'var(--highlight-color)' : 'var(--chassis-dark)';
        if (this.cache.bpLed) this.cache.bpLed.style.fill = (fMode & 32) ? 'var(--highlight-color)' : 'var(--chassis-dark)';
        if (this.cache.hpLed) this.cache.hpLed.style.fill = (fMode & 64) ? 'var(--highlight-color)' : 'var(--chassis-dark)';

        // Gesamter Filter Block pulsiert bei Resonanz & Pegel
        if (this.cache.filtBlock) {
            const intensity = 0.2 + (v0 + v1 + v2) * 0.4 + (resReg / 15.0) * 0.4;
            this.cache.filtBlock.style.opacity = intensity;
            this.cache.filtBlock.style.filter = resReg > 8 ? `drop-shadow(0 0 ${resReg}px var(--text-color))` : 'none';
        }

        const outVal = (v0 + v1 + v2) / 3.0;
        this.updateBusFlow(this.cache.sigOutL, outVal);
    }

    updateYmLogic(regs, v0, v1, v2, t) {
        if (!regs) return;

        // 1. Töne
        const pA = ((regs[1] & 0x0F) << 8) | regs[0];
        const pB = ((regs[3] & 0x0F) << 8) | regs[2];
        const pC = ((regs[5] & 0x0F) << 8) | regs[4];

        const hzA = pA ? Math.round(2000000 / (16 * pA)) : 0;
        const hzB = pB ? Math.round(2000000 / (16 * pB)) : 0;
        const hzC = pC ? Math.round(2000000 / (16 * pC)) : 0;

        if (this.cache.toneAHz) this.cache.toneAHz.textContent = hzA > 0 && hzA < 20000 ? `${hzA}Hz` : 'OFF';
        if (this.cache.toneBHz) this.cache.toneBHz.textContent = hzB > 0 && hzB < 20000 ? `${hzB}Hz` : 'OFF';
        if (this.cache.toneCHz) this.cache.toneCHz.textContent = hzC > 0 && hzC < 20000 ? `${hzC}Hz` : 'OFF';

        if (this.cache.toneA) this.cache.toneA.style.opacity = 0.2 + v0 * 0.8;
        if (this.cache.toneB) this.cache.toneB.style.opacity = 0.2 + v1 * 0.8;
        if (this.cache.toneC) this.cache.toneC.style.opacity = 0.2 + v2 * 0.8;

        // 2. Rausch-Generator (Chaotisches Flackern auf dem Die)
        const pN = regs[6] & 0x1F;
        const hzNoise = pN ? Math.round(125000 / pN) : 0;
        if (this.cache.noiseLabel) this.cache.noiseLabel.textContent = hzNoise > 0 ? `${(hzNoise/1000).toFixed(1)}k` : 'OFF';

        if (this.cache.noiseGen) {
            // Chaotischer Trigger basierend auf Zeitstempel & Noise-Frequenz
            if (t - this.lastNoiseFlip > Math.max(0.01, 0.1 - (pN / 31) * 0.1)) {
                this.noiseState = !this.noiseState;
                this.lastNoiseFlip = t;
            }
            this.cache.noiseGen.style.opacity = this.noiseState && pN > 0 ? 0.3 + (Math.random() * 0.7) : 0.1;
        }

        // 3. Hüllkurven Modulator (Atmen des Blocks)
        const pE = (regs[12] << 8) | regs[11];
        const hzEnv = pE ? (2000000 / (256 * pE)) : 0;
        if (this.cache.envLabel) this.cache.envLabel.textContent = hzEnv > 0 ? `${hzEnv.toFixed(1)}Hz` : 'OFF';

        if (this.cache.envGen) {
            // Atmet langsam über Sinuswelle gekoppelt an die Frequenz
            const breathing = hzEnv > 0 ? 0.3 + Math.sin(t * hzEnv * Math.PI * 2) * 0.5 : 0.15;
            this.cache.envGen.style.opacity = Math.max(0.15, breathing);
        }

        // Mini-Wellenformvorschau auf dem Die zeichnen
        const shape = regs[13] & 0x0F;
        if (this.cache.envShape) {
            let pathD = "M 205 130 L 225 130"; // Flat fallback
            if (pE > 0) {
                if (shape === 8 || shape === 9) pathD = "M 205 135 L 225 125 L 225 135"; // Sawtooth falling
                else if (shape === 12 || shape === 13) pathD = "M 205 125 L 225 135 L 225 125"; // Sawtooth rising
                else if (shape === 10 || shape === 14) pathD = "M 205 135 L 215 125 L 225 135"; // Triangle
            }
            this.cache.envShape.setAttribute('d', pathD);
        }

        // Mixer Gate (R7) visualisieren
        const mix = regs[7];
        if (this.cache.mixG) {
            this.cache.mixG.style.opacity = 0.2 + (v0 + v1 + v2) * 0.8;
            this.cache.mixG.style.stroke = mix !== 0x3F ? 'var(--highlight-color)' : 'var(--text-color)';
        }

        const outVal = (v0 + v1 + v2) / 3.0;
        this.updateBusFlow(this.cache.sigOutL, outVal);
    }

    updatePaulaLogic(currentRegs, v0, v1, v2, v3) {
        if (!currentRegs) return;

        // 1. DMA Perioden (Frequenzen) decodieren
        const p0 = (currentRegs[4] << 8) | currentRegs[5];
        const p1 = (currentRegs[11] << 8) | currentRegs[12];
        const p2 = (currentRegs[18] << 8) | currentRegs[19];
        const p3 = (currentRegs[25] << 8) | currentRegs[26];

        const hz0 = p0 ? Math.round(3546895 / p0) : 0;
        const hz1 = p1 ? Math.round(3546895 / p1) : 0;
        const hz2 = p2 ? Math.round(3546895 / p2) : 0;
        const hz3 = p3 ? Math.round(3546895 / p3) : 0;

        if (this.cache.dma0Hz) this.cache.dma0Hz.textContent = hz0 > 0 && hz0 < 40000 ? `${hz0}Hz` : 'OFF';
        if (this.cache.dma1Hz) this.cache.dma1Hz.textContent = hz1 > 0 && hz1 < 40000 ? `${hz1}Hz` : 'OFF';
        if (this.cache.dma2Hz) this.cache.dma2Hz.textContent = hz2 > 0 && hz2 < 40000 ? `${hz2}Hz` : 'OFF';
        if (this.cache.dma3Hz) this.cache.dma3Hz.textContent = hz3 > 0 && hz3 < 40000 ? `${hz3}Hz` : 'OFF';

        // 2. Hardware Gehäuse-LED-Filter (Butterworth Bypass)
        const ledState = currentRegs[29]; // 0 = Filter AN (gedimmt), 1 = Filter AUS (klar)
        const filterOn = (ledState === 0);

        if (this.cache.ledFilt) {
            this.cache.ledFilt.style.opacity = filterOn ? '0.95' : '0.15';
            this.cache.ledFilt.style.filter = filterOn ? 'drop-shadow(0 0 4px var(--text-color))' : 'none';
        }
        if (this.cache.ledLabel) {
            this.cache.ledLabel.textContent = filterOn ? "LED-LP: 3.09kHz" : "LP: BYPASSED";
            this.cache.ledLabel.style.fill = filterOn ? "var(--panel-text)" : "rgba(255,255,255,0.2)";
        }

        // Signal-Bus-Ströme L-R-R-L kacheln
        const outL = (v0 + v3) * 0.5;
        const outR = (v1 + v2) * 0.5;
        this.updateBusFlow(this.cache.sigOutL, outL);
        this.updateBusFlow(this.cache.sigOutR, outR);
    }

    getSidSvg() {
        return `
            <svg viewBox="0 0 440 180" xmlns="http://www.w3.org/2000/svg">
                <!-- Silicon Die Substrate / Transistor Matrix Background Grid -->
                <rect x="5" y="5" width="430" height="170" rx="6" fill="#0c071d" stroke="var(--chassis-dark)" stroke-width="3" />
                <path d="M 50 15 L 390 15 M 50 165 L 390 165 M 40 40 L 40 140 M 400 40 L 400 140" stroke="rgba(255,255,255,0.03)" stroke-width="1.5" stroke-dasharray="2,6" />
                <path d="M 80 40 L 360 40 L 360 140 L 80 140 Z" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1" />

                <!-- Package Pins (Silicon bonding pads representation) -->
                <rect class="silicon-pin pin-ch0" x="110" y="5" width="12" height="10" rx="1" />
                <rect class="silicon-pin pin-ch1" x="170" y="5" width="12" height="10" rx="1" />
                <rect class="silicon-pin pin-ch2" x="230" y="5" width="12" height="10" rx="1" />
                <rect class="silicon-pin pin-out-l" x="350" y="165" width="12" height="10" rx="1" />

                <text x="50" y="28" class="silicon-chip-label" fill="var(--panel-text)" font-size="8">MOS 6581 SOUND INTERFACE DEVICE</text>

                <!-- Silicon Core Boundary -->
                <rect x="75" y="42" width="290" height="110" rx="2" fill="var(--screen-bg)" stroke="var(--chassis-dark)" stroke-width="2" />

                <!-- == OSCILLATORS (Die Gatter) == -->
                <g class="sid-osc1" style="opacity: 0.25;">
                    <rect x="85" y="50" width="65" height="24" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="90" y="60" font-size="7" fill="var(--text-color)">OSC 1</text>
                    <text x="90" y="70" class="sid-osc1-hz" font-size="6" fill="var(--highlight-color)">0Hz</text>
                </g>
                <g class="sid-osc2" style="opacity: 0.25;">
                    <rect x="85" y="85" width="65" height="24" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="90" y="95" font-size="7" fill="var(--text-color)">OSC 2</text>
                    <text x="90" y="105" class="sid-osc2-hz" font-size="6" fill="var(--highlight-color)">0Hz</text>
                </g>
                <g class="sid-osc3" style="opacity: 0.25;">
                    <rect x="85" y="120" width="65" height="24" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="90" y="130" font-size="7" fill="var(--text-color)">OSC 3</text>
                    <text x="90" y="140" class="sid-osc3-hz" font-size="6" fill="var(--highlight-color)">0Hz</text>
                </g>

                <!-- SYNC & RING MODULATION CHANNELS -->
                <line class="sid-sync12" x1="117" y1="74" x2="117" y2="85" stroke="var(--highlight-color)" stroke-width="1.5" style="opacity: 0.1;" />
                <text x="120" y="82" font-size="5" fill="var(--text-color)">SYNC</text>

                <line class="sid-ring23" x1="117" y1="109" x2="117" y2="120" stroke="var(--highlight-color)" stroke-width="1.5" style="opacity: 0.1;" />
                <text x="120" y="117" font-size="5" fill="var(--text-color)">RING</text>

                <!-- == THE ANALOG FILTERS & VCA (40% Die Reservation) == -->
                <g class="sid-filt-block" style="opacity: 0.25;">
                    <!-- Massive Filter Box -->
                    <rect x="180" y="50" width="115" height="94" rx="2" fill="none" stroke="var(--text-color)" stroke-width="2" />
                    <text x="188" y="62" font-size="7" fill="var(--text-color)" font-weight="bold">ANALOG VCF (12dB)</text>
                    <text x="188" y="74" class="sid-filt-cut" font-size="6" fill="var(--highlight-color)">FC:30Hz</text>
                    
                    <!-- Resonance Meter -->
                    <text x="188" y="86" font-size="5" fill="var(--text-color)">RES</text>
                    <rect x="210" y="81" width="50" height="6" fill="none" stroke="var(--text-color)" stroke-width="1" />
                    <rect class="sid-filt-res-bar" x="210" y="81" width="0" height="6" fill="var(--text-color)" />

                    <!-- Active Filter LEDs (LP, BP, HP) -->
                    <rect class="sid-lp-led" x="188" y="98" width="6" height="6" rx="3" fill="var(--chassis-dark)" />
                    <text x="198" y="104" font-size="5" fill="var(--text-color)">LP</text>

                    <rect class="sid-bp-led" x="218" y="98" width="6" height="6" rx="3" fill="var(--chassis-dark)" />
                    <text x="228" y="104" font-size="5" fill="var(--text-color)">BP</text>

                    <rect class="sid-hp-led" x="248" y="98" width="6" height="6" rx="3" fill="var(--chassis-dark)" />
                    <text x="258" y="104" font-size="5" fill="var(--text-color)">HP</text>

                    <!-- VCA Gatter -->
                    <rect x="188" y="115" width="98" height="20" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1" stroke-dasharray="1,2" />
                    <text x="194" y="127" font-size="6" fill="var(--text-color)">INTEGRATED VCA</text>
                </g>

                <!-- == FINAL STAGE (DAC & OUTPUT) == -->
                <g class="sid-dac" style="opacity: 0.95;">
                    <rect x="315" y="75" width="40" height="30" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="318" y="92" font-size="7" fill="var(--text-color)">DAC Out</text>
                </g>

                <!-- == SIGNAL BUS ROADS (Animated dash-offset) == -->
                <!-- Oscillators to VCF -->
                <path class="signal-bus sig-path-0" d="M 150 62 L 180 62" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <path class="signal-bus sig-path-1" d="M 150 97 L 180 97" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <path class="signal-bus sig-path-2" d="M 150 132 L 165 132 L 165 120 L 180 120" fill="none" stroke="var(--text-color)" stroke-width="1.5" />

                <!-- VCF to DAC -->
                <path class="signal-bus sig-path-out-l" d="M 295 90 L 315 90" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <!-- DAC to Output Pin -->
                <path class="signal-bus sig-path-out-l" d="M 355 90 L 380 90 L 380 152 L 356 152" fill="none" stroke="var(--text-color)" stroke-width="1.5" />

                <!-- Gold Bond Wires (Feste, edle Vektoren zum Gehäuse) -->
                <path d="M 116 15 L 116 42" stroke="#d4af37" stroke-width="0.8" style="opacity: 0.65;" />
                <path d="M 176 15 L 176 42" stroke="#d4af37" stroke-width="0.8" style="opacity: 0.65;" />
                <path d="M 236 15 L 236 42" stroke="#d4af37" stroke-width="0.8" style="opacity: 0.65;" />
                <path d="M 356 165 L 356 155" stroke="#d4af37" stroke-width="0.8" style="opacity: 0.65;" />
            </svg>
        `;
    }

    getPaulaSvg() {
        return `
            <svg viewBox="0 0 440 180" xmlns="http://www.w3.org/2000/svg">
                <rect class="silicon-chip-body" x="5" y="5" width="430" height="170" rx="6" fill="#0d0802" stroke="var(--chassis-dark)" stroke-width="3" />
                <path d="M 50 15 L 390 15 M 50 165 L 390 165 M 40 40 L 40 140 M 400 40 L 400 140" stroke="rgba(255,255,255,0.03)" stroke-width="1.5" stroke-dasharray="2,6" />

                <!-- Pins -->
                <rect class="silicon-pin pin-ch0" x="80" y="5" width="12" height="10" rx="1" />
                <rect class="silicon-pin pin-ch1" x="110" y="5" width="12" height="10" rx="1" />
                <rect class="silicon-pin pin-ch2" x="140" y="5" width="12" height="10" rx="1" />
                <rect class="silicon-pin pin-ch3" x="170" y="5" width="12" height="10" rx="1" />
                
                <rect class="silicon-pin pin-out-l" x="320" y="165" width="12" height="10" rx="1" />
                <rect class="silicon-pin pin-out-r" x="360" y="165" width="12" height="10" rx="1" />

                <text x="50" y="28" class="silicon-chip-label" fill="var(--panel-text)" font-size="8">MOS 8364 PAULA DMA CHIP (AMIGA 500)</text>

                <!-- Silicon Core -->
                <rect x="75" y="42" width="290" height="110" rx="2" fill="var(--screen-bg)" stroke="var(--chassis-dark)" stroke-width="2" />

                <!-- == 4x DMA CONTROLLER & SAMPLE FIFOS == -->
                <g class="paula-dma-0" style="opacity: 0.95;">
                    <rect x="85" y="50" width="80" height="20" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.2" />
                    <text x="89" y="59" font-size="6" fill="var(--text-color)">DMA0-FIFO</text>
                    <text x="89" y="67" class="paula-dma0-hz" font-size="5" fill="var(--highlight-color)">0Hz</text>
                </g>
                <g class="paula-dma-1" style="opacity: 0.95;">
                    <rect x="85" y="74" width="80" height="20" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.2" />
                    <text x="89" y="83" font-size="6" fill="var(--text-color)">DMA1-FIFO</text>
                    <text x="89" y="91" class="paula-dma1-hz" font-size="5" fill="var(--highlight-color)">0Hz</text>
                </g>
                <g class="paula-dma-2" style="opacity: 0.95;">
                    <rect x="85" y="98" width="80" height="20" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.2" />
                    <text x="89" y="107" font-size="6" fill="var(--text-color)">DMA2-FIFO</text>
                    <text x="89" y="115" class="paula-dma2-hz" font-size="5" fill="var(--highlight-color)">0Hz</text>
                </g>
                <g class="paula-dma-3" style="opacity: 0.95;">
                    <rect x="85" y="122" width="80" height="20" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.2" />
                    <text x="89" y="131" font-size="6" fill="var(--text-color)">DMA3-FIFO</text>
                    <text x="89" y="139" class="paula-dma3-hz" font-size="5" fill="var(--highlight-color)">0Hz</text>
                </g>

                <!-- == PAULA ANALOG LED BUTTERWORTH FILTER == -->
                <g class="paula-led-filt" style="opacity: 0.15;">
                    <rect x="180" y="50" width="80" height="92" rx="2" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <!-- Analog filter schematics -->
                    <circle cx="220" cy="85" r="10" fill="none" stroke="var(--text-color)" stroke-width="1.5" stroke-dasharray="2,2" />
                    <line x1="210" y1="85" x2="230" y2="85" stroke="var(--text-color)" stroke-width="1.5" />
                    <line x1="220" y1="75" x2="220" y2="95" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="185" y="125" class="paula-led-label" font-size="6" fill="var(--text-color)">LED FILTER</text>
                    <text x="185" y="61" font-size="6" fill="var(--text-color)" font-weight="bold">12dB LP FILT</text>
                </g>

                <!-- == LEFT & RIGHT MULTIPLYING DACs == -->
                <g class="paula-dac-l" style="opacity: 0.95;">
                    <rect x="280" y="55" width="38" height="34" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="284" y="70" font-size="6" fill="var(--text-color)" font-weight="bold">DAC L</text>
                    <text x="284" y="80" font-size="5" fill="var(--text-color)">0+3 OUT</text>
                </g>
                <g class="paula-dac-r" style="opacity: 0.95;">
                    <rect x="280" y="105" width="38" height="34" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="284" y="120" font-size="6" fill="var(--text-color)" font-weight="bold">DAC R</text>
                    <text x="284" y="130" font-size="5" fill="var(--text-color)">1+2 OUT</text>
                </g>

                <!-- == STEREO HARD-ROUTING ROAD (Paula L-R-R-L Bus Matrix) == -->
                <!-- Channel 0 (DMA0) to DAC L -->
                <path class="signal-bus sig-path-0" d="M 165 60 L 220 60 L 220 70 L 280 70" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <!-- Channel 3 (DMA3) to DAC L -->
                <path class="signal-bus sig-path-3" d="M 165 132 L 205 132 L 205 80 L 280 80" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                
                <!-- Channel 1 (DMA1) to DAC R -->
                <path class="signal-bus sig-path-1" d="M 165 84 L 210 84 L 210 115 L 280 115" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <!-- Channel 2 (DMA2) to DAC R -->
                <path class="signal-bus sig-path-2" d="M 165 108 L 280 108" fill="none" stroke="var(--text-color)" stroke-width="1.5" />

                <!-- DAC output lines going through physical LED filters and exiting to bottom pins -->
                <path class="signal-bus sig-path-out-l" d="M 318 72 L 326 72 L 326 152" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <path class="signal-bus sig-path-out-r" d="M 318 122 L 366 122 L 366 152" fill="none" stroke="var(--text-color)" stroke-width="1.5" />

                <path d="M 86 15 L 86 42" stroke="#d4af37" stroke-width="0.8" style="opacity: 0.65;" />
                <path d="M 116 15 L 116 42" stroke="#d4af37" stroke-width="0.8" style="opacity: 0.65;" />
                <path d="M 146 15 L 146 42" stroke="#d4af37" stroke-width="0.8" style="opacity: 0.65;" />
                <path d="M 176 15 L 176 42" stroke="#d4af37" stroke-width="0.8" style="opacity: 0.65;" />
                <path d="M 326 165 L 326 152" stroke="#d4af37" stroke-width="0.8" style="opacity: 0.65;" />
                <path d="M 366 165 L 366 152" stroke="#d4af37" stroke-width="0.8" style="opacity: 0.65;" />
            </svg>
        `;
    }

    getYmSvg() {
        return `
            <svg viewBox="0 0 440 180" xmlns="http://www.w3.org/2000/svg">
                <rect class="silicon-chip-body" x="5" y="5" width="430" height="170" rx="6" fill="#050a05" stroke="var(--chassis-dark)" stroke-width="3" />
                <path d="M 50 15 L 390 15 M 50 165 L 390 165 M 40 40 L 40 140 M 400 40 L 400 140" stroke="rgba(255,255,255,0.03)" stroke-width="1.5" stroke-dasharray="2,6" />

                <!-- Standard Pins -->
                <rect class="silicon-pin pin-ch0" x="80" y="5" width="12" height="10" rx="1" />
                <rect class="silicon-pin pin-ch1" x="110" y="5" width="12" height="10" rx="1" />
                <rect class="silicon-pin pin-ch2" x="140" y="5" width="12" height="10" rx="1" />
                <rect class="silicon-pin pin-out-l" x="350" y="165" width="12" height="10" rx="1" />

                <text x="50" y="28" class="silicon-chip-label" fill="var(--panel-text)" font-size="8">YM2149F SYSTEM SYNTHESIZER GENERATOR</text>

                <!-- Silicon Core -->
                <rect x="75" y="42" width="290" height="110" rx="2" fill="var(--screen-bg)" stroke="var(--chassis-dark)" stroke-width="2" />

                <!-- == 3x TONE SQUARE GENERATORS == -->
                <g class="ym-tone-a" style="opacity: 0.25;">
                    <rect x="85" y="50" width="65" height="20" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.2" />
                    <text x="89" y="58" font-size="6" fill="var(--text-color)">TONE A</text>
                    <text x="89" y="66" class="ym-tone-a-hz" font-size="5" fill="var(--highlight-color)">0Hz</text>
                </g>
                <g class="ym-tone-b" style="opacity: 0.25;">
                    <rect x="85" y="74" width="65" height="20" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.2" />
                    <text x="89" y="82" font-size="6" fill="var(--text-color)">TONE B</text>
                    <text x="89" y="90" class="ym-tone-b-hz" font-size="5" fill="var(--highlight-color)">0Hz</text>
                </g>
                <g class="ym-tone-c" style="opacity: 0.25;">
                    <rect x="85" y="98" width="65" height="20" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.2" />
                    <text x="89" y="106" font-size="6" fill="var(--text-color)">TONE C</text>
                    <text x="89" y="114" class="ym-tone-c-hz" font-size="5" fill="var(--highlight-color)">0Hz</text>
                </g>

                <!-- == NOISE GENERATOR (Flashing layout) == -->
                <g class="ym-noise-gen" style="opacity: 0.15;">
                    <rect x="85" y="122" width="65" height="24" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.2" />
                    <!-- Transistor grid matrix representing chaotic noise source -->
                    <line x1="90" y1="130" x2="100" y2="140" stroke="var(--text-color)" stroke-width="1" />
                    <line x1="105" y1="126" x2="115" y2="138" stroke="var(--text-color)" stroke-width="1" />
                    <text x="122" y="132" font-size="6" fill="var(--text-color)">NOISE</text>
                    <text x="122" y="141" class="ym-noise-hz" font-size="5" fill="var(--highlight-color)">OFF</text>
                </g>

                <!-- == HARDWARE ENVELOPE MODULATOR == -->
                <g class="ym-env-gen" style="opacity: 0.15;">
                    <rect x="175" y="50" width="60" height="92" rx="2" fill="none" stroke="var(--text-color)" stroke-width="1.5" stroke-dasharray="1,1" />
                    <text x="180" y="62" font-size="6" fill="var(--text-color)" font-weight="bold">ENV GEN</text>
                    <text x="180" y="74" class="ym-env-hz" font-size="5" fill="var(--highlight-color)">0Hz</text>
                    
                    <!-- Dynamic Envelope Shape Preview inside Silicon -->
                    <path class="ym-env-shape-preview" d="M 180 110 L 220 110" fill="none" stroke="var(--highlight-color)" stroke-width="1.2" />
                </g>

                <!-- == HARDWARE MIXER & GATE == -->
                <g style="opacity: 0.95;">
                    <circle cx="270" cy="95" r="14" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="258" y="98" font-size="6" fill="var(--text-color)" font-weight="bold">GATE</text>
                    <line class="ym-mixer-gate" x1="256" y1="95" x2="284" y2="95" stroke="var(--text-color)" stroke-width="2" />
                </g>

                <!-- == LOGARITHMIC DAC LADDER (YM 32-Steps spec) == -->
                <g class="ym-dac" style="opacity: 0.95;">
                    <rect x="310" y="75" width="45" height="38" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="314" y="90" font-size="6" fill="var(--text-color)" font-weight="bold">3x DAC</text>
                    <text x="314" y="100" font-size="5" fill="var(--text-color)">LOG-5BIT</text>
                </g>

                <!-- == SIGNAL BUS PATHS == -->
                <!-- Tone Channel lines to GATE -->
                <path class="signal-bus sig-path-0" d="M 150 60 L 245 60 L 245 90 L 256 90" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <path class="signal-bus sig-path-1" d="M 150 84 L 256 84" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <path class="signal-bus sig-path-2" d="M 150 108 L 256 108" fill="none" stroke="var(--text-color)" stroke-width="1.5" />

                <!-- Gate to Log DAC -->
                <path class="signal-bus sig-path-out-l" d="M 284 95 L 310 95" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <!-- DAC to Output Pin -->
                <path class="signal-bus sig-path-out-l" d="M 355 95 L 380 95 L 380 152 L 356 152" fill="none" stroke="var(--text-color)" stroke-width="1.5" />

                <path d="M 86 15 L 86 42" stroke="#d4af37" stroke-width="0.8" style="opacity: 0.65;" />
                <path d="M 116 15 L 116 42" stroke="#d4af37" stroke-width="0.8" style="opacity: 0.65;" />
                <path d="M 146 15 L 146 42" stroke="#d4af37" stroke-width="0.8" style="opacity: 0.65;" />
                <path d="M 356 165 L 356 152" stroke="#d4af37" stroke-width="0.8" style="opacity: 0.65;" />
            </svg>
        `;
    }
}