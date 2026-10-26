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

    // Mountet den Chip physisch auf das Mainboard und injiziert die Flanken-Diagnostik
    mount() {
        let clockFreq = "1.00 MHz";
        let regCount = "16";
        if (this.constructor.name === 'Sid6581') { clockFreq = "0.98 MHz"; regCount = "29"; }
        else if (this.constructor.name === 'Paula8364') { clockFreq = "3.54 MHz"; regCount = "DMA"; }
        else if (this.constructor.name === 'Ym2149') { clockFreq = "2.00 MHz"; regCount = "16"; }

        this.container.innerHTML = `
            <div class="silicon-chassis ${this.getChassisClass()}">
                <div class="silicon-diagnostics diag-left">
                    <div class="diag-block"><span class="d-lbl">CLOCK</span><span class="d-val">${clockFreq}</span></div>
                    <div class="diag-block"><span class="d-lbl">BUS</span><span class="d-val blink">ACTIVE</span></div>
                </div>
                <div class="silicon-die-wrapper">
                    ${this.getSvg()}
                </div>
                <div class="silicon-diagnostics diag-right">
                    <div class="diag-block"><span class="d-lbl">REGS</span><span class="d-val">${regCount}</span></div>
                    <div class="diag-block"><span class="d-lbl">PWR</span><span class="d-val">NOMINAL</span></div>
                </div>
                ${this.getSidePanelHTML()}
            </div>
        `;
        this.cacheDOM();
    }
}
