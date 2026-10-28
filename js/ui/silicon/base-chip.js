// === js/ui/silicon/base-chip.js ===
// =========================================================
// LIVING SILICON BASE CLASS
// Provides shared physical modeling tools (Pins, Buses, Glow)
// =========================================================

export class BaseChip {
    constructor(container) {
        this.container = container;
        this.cache = {};
    }

    // Erzeugt physikalisch korrekte DIP-Pins
    generatePins(pinCount, startX, width, topY = 15, bottomY = 170, showNumbers = false) {
        const pinsPerSide = pinCount / 2;
        const spacing = width / pinsPerSide;
        let pinsHTML = '';
        for (let i = 0; i < pinsPerSide; i++) {
            const px = startX + (i * spacing) + (spacing * 0.25);
            const pinW = spacing * 0.5;
            const bottomPin = i + 1;
            const topPin = pinCount - i;
            const bottomCenter = px + pinW / 2;
            const topCenter = bottomCenter + (topPin === 38 ? 15 : 0);
            pinsHTML += `<rect class="silicon-pin pin-bot-${bottomPin}" x="${px}" y="${bottomY}" width="${pinW}" height="15" rx="1" />`;
            pinsHTML += `<rect class="silicon-pin pin-top-${topPin}" x="${px}" y="${topY}" width="${pinW}" height="15" rx="1" />`;
            if (showNumbers) {
                pinsHTML += `<text class="silicon-pin-number" x="${bottomCenter}" y="${bottomY + 26}" text-anchor="middle">${bottomPin}</text>`;
                pinsHTML += `<text class="silicon-pin-number" x="${topCenter}" y="${topY - 5}" text-anchor="middle">${topPin}</text>`;
            }
        }
        return pinsHTML;
    }

    updateBusFlow(el, volume) {
        if (!el) return;
        const wire = el._wire || (el._wire = (el.previousElementSibling && (el.previousElementSibling.classList.contains('silicon-bus-wire') || el.previousElementSibling.classList.contains('sid-bus-wire'))) ? el.previousElementSibling : null);

        if (volume > 0.04) {
            // 1. Traveling Discrete Energy Packet (Photon)
            el.style.opacity = Math.min(1.0, 0.25 + volume * 0.75);
            el.style.filter = `drop-shadow(0 0 ${2 + volume * 4}px var(--highlight-color))`;

            // 2. Base Circuit Wire Gentle Glow in System Color (C64 Blue, Amiga Orange, Atari Green)
            if (wire) {
                wire.style.stroke = 'var(--bus-active-color)';
                wire.style.opacity = Math.min(0.85, 0.35 + volume * 0.50);
                wire.style.filter = `drop-shadow(0 0 ${1 + volume * 3}px var(--bus-active-color))`;
            }
        } else {
            el.style.opacity = '0';
            el.style.filter = 'none';
            if (wire) {
                wire.style.stroke = 'var(--text-color)';
                wire.style.opacity = '0.20';
                wire.style.filter = 'none';
            }
        }
    }

    updatePinGlow(el, val) {
        if (!el) return;
        el.style.fill = val > 0.1 ? 'var(--highlight-color)' : 'var(--panel-text)';
        el.style.filter = val > 0.1 ? `drop-shadow(0 0 ${1 + val * 6}px var(--text-color))` : 'none';
    }

    // Muss von Kind-Klassen überschrieben werden
    getSvg() { return ''; }
    getChassisClass() { return ''; }
    getSidePanelHTML() { return ''; }
    cacheDOM() {}
    update(vols, regs, t, telemetry) {}

    getGuideProfile() {
        const profiles = {
            Sid6581: {
                labels: ['PAL CLK', '$D418 BUS', 'VCF MODE', 'MODEL TEMP'],
                values: ['0.98 MHz', 'STANDBY', 'STANDBY', '55°C SIM'],
                stages: ['OSC 1–3', 'VCF', 'VCA', 'AUDIO OUT'],
                description: 'Three oscillators feed the multimode filter and master VCA. Bright buses reveal active routing; envelope phases and filter values follow the emulated SID registers.',
                diagramLabel: 'MOS 6581 SID Oszillatoren, Hüllkurven, Filter und Audioausgang'
            },
            Paula8364: {
                labels: ['PAL CLK', 'DMACON', 'ZOH DAC', 'LED FILT'],
                values: ['3.54 MHz', '0/4 CH', 'STANDBY', 'STANDBY'],
                stages: ['DMA 0–3', 'ZOH DAC', 'RC + LED', 'L / R OUT'],
                description: 'Four DMA voices feed the zero-order-hold DACs and the Amiga 500 filter stage. Channel states, output scopes and filter telemetry mirror the active Paula registers.',
                diagramLabel: 'MOS 8364 Paula DMA-Kanäle, DACs, Filter und Stereoausgang'
            },
            Ym2149: {
                labels: ['ST CLK', 'MIX R07', 'HEG/DIGI', 'SUM LEVEL'],
                values: ['2.00 MHz', 'STANDBY', 'STANDBY', 'STANDBY'],
                stages: ['TONE A–C', 'MIX + HEG', 'LOG DAC', 'BOARD OUT'],
                description: 'Tone and noise sources pass through the mixer, hardware envelope and logarithmic DACs. Digidrum activity and board-level output remain visible in the same signal chain.',
                diagramLabel: 'Yamaha YM2149 Tonquellen, Mixer, Hüllkurve und Ausgangsstufe'
            }
        };
        return profiles[this.constructor.name] || {
            labels: ['CLOCK', 'BUS', 'REGS', 'PWR'],
            values: ['1.00 MHz', 'STANDBY', '16', 'NOMINAL'],
            stages: ['INPUT', 'CORE', 'MIX', 'OUTPUT'],
            description: 'Live telemetry follows the emulated audio signal from its sources to the hardware output.',
            diagramLabel: 'Emulierter Audiochip und Signalfluss'
        };
    }

    syncReadout() {
        if (!this.readoutLabels || !this.readoutValues || !this.sourceDiagLabels || !this.sourceDiagValues) return;
        for (let index = 0; index < this.readoutLabels.length; index++) {
            const label = this.sourceDiagLabels[index]?.textContent || '';
            const value = this.sourceDiagValues[index]?.textContent || '';
            if (this.readoutLabels[index].textContent !== label) this.readoutLabels[index].textContent = label;
            if (this.readoutValues[index].textContent !== value) this.readoutValues[index].textContent = value;
        }
    }

    // Mountet den Chip physisch auf das Mainboard und injiziert die Flanken-Diagnostik
    mount() {
        const profile = this.getGuideProfile();
        const diagnostics = profile.labels.map((label, index) => `
            <div class="diag-block"><span class="d-lbl">${label}</span><span class="d-val">${profile.values[index]}</span></div>
        `);
        const readout = profile.labels.map((label, index) => `
            <div><dt>${label}</dt><dd>${profile.values[index]}</dd></div>
        `).join('');

        this.container.innerHTML = `
            <div class="silicon-chassis ${this.getChassisClass()}">
                <div class="silicon-diagnostics diag-left">
                    ${diagnostics[0]}
                    ${diagnostics[1]}
                </div>
                <div class="silicon-die-wrapper">
                    ${this.getSvg()}
                </div>
                <div class="silicon-diagnostics diag-right">
                    ${diagnostics[2]}
                    ${diagnostics[3]}
                </div>
                ${this.getSidePanelHTML()}
            </div>
            <details class="silicon-guide">
                <summary>&gt; SIGNAL GUIDE <span>LIVE READOUT</span></summary>
                <div class="silicon-guide-content">
                    <ol class="silicon-signal-flow" aria-label="Audio-Signalweg">
                        ${profile.stages.map(stage => `<li>${stage}</li>`).join('')}
                    </ol>
                    <p class="silicon-guide-copy">${profile.description}</p>
                    <dl class="silicon-readout" aria-label="Aktuelle Chip-Telemetrie">${readout}</dl>
                    <p class="silicon-guide-note">Values follow emulation telemetry; no synthetic demo animation.</p>
                </div>
            </details>
        `;

        const diagram = this.container.querySelector('.silicon-die-wrapper svg');
        if (diagram) {
            if (!diagram.hasAttribute('role')) diagram.setAttribute('role', 'img');
            if (!diagram.hasAttribute('aria-label') && !diagram.hasAttribute('aria-labelledby')) {
                diagram.setAttribute('aria-label', profile.diagramLabel);
            }
        }

        this.cacheDOM();
        this.sourceDiagLabels = this.container.querySelectorAll('.silicon-diagnostics .d-lbl');
        this.sourceDiagValues = this.container.querySelectorAll('.silicon-diagnostics .d-val');
        this.readoutLabels = this.container.querySelectorAll('.silicon-readout dt');
        this.readoutValues = this.container.querySelectorAll('.silicon-readout dd');
        this.syncReadout();
    }
}
