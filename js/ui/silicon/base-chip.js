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
    generatePins(pinCount, startX, width) {
        const pinsPerSide = pinCount / 2;
        const spacing = width / pinsPerSide;
        let pinsHTML = '';
        for (let i = 0; i < pinsPerSide; i++) {
            const px = startX + (i * spacing) + (spacing * 0.25);
            const pinW = spacing * 0.5;
            pinsHTML += `<rect class="silicon-pin pin-bot-${i + 1}" x="${px}" y="170" width="${pinW}" height="15" rx="1" />`;
            pinsHTML += `<rect class="silicon-pin pin-top-${pinCount - i}" x="${px}" y="15" width="${pinW}" height="15" rx="1" />`;
        }
        return pinsHTML;
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

    // Muss von Kind-Klassen überschrieben werden
    getSvg() { return ''; }
    cacheDOM() {}
    update(vols, regs, t) {}

    // Mountet den Chip physisch auf das Mainboard und injiziert die Flanken-Diagnostik
    mount() {
        let clockFreq = "1.00 MHz";
        let regCount = "16";
        if (this.constructor.name === 'Sid6581') { clockFreq = "0.98 MHz"; regCount = "29"; }
        else if (this.constructor.name === 'Paula8364') { clockFreq = "3.54 MHz"; regCount = "DMA"; }
        else if (this.constructor.name === 'Ym2149') { clockFreq = "2.00 MHz"; regCount = "16"; }

        this.container.innerHTML = `
            <div class="silicon-chassis">
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
            </div>
        `;
        this.cacheDOM();
    }
}