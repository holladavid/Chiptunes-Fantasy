// === js/ui/silicon/sid-meter.js ===
// Demoscene-style SID activity instrument. Voice bars show envelope level,
// never loudness or processor load. The history shows register writes/second
// on a fixed logarithmic scale. All per-frame storage is preallocated.

const SID_ENV_STATE_LABELS = ['ATK', 'DEC', 'REL'];
const SID_METER_VOICES = 3;
const SID_METER_SEGMENTS = 16;
const SID_BUS_HISTORY = 48;

export function sidBusMeterLevel(writesPerSecond) {
    if (!(writesPerSecond > 0)) return 0;
    return Math.min(1, Math.log10(writesPerSecond + 1) / 5);
}

export class SidMeter {
    constructor() {
        this.voiceLevels = new Uint8Array(SID_METER_VOICES);
        this.voicePeaks = new Float32Array(SID_METER_VOICES);
        this.voicePeakY = new Int16Array(SID_METER_VOICES);
        this.voicePeakY.fill(-1);
        this.voicePeakHold = new Float32Array(SID_METER_VOICES);
        this.voiceSegments = new Array(SID_METER_VOICES);
        this.voicePeaksSvg = new Array(SID_METER_VOICES);
        this.voiceGates = new Array(SID_METER_VOICES);
        this.voiceStates = new Array(SID_METER_VOICES);
        this.lastGateMask = -1;
        this.lastStateMask = -1;
        this.busHistory = new Float32Array(SID_BUS_HISTORY);
        this.busHistoryBars = null;
        this.busHistoryHead = 0;
        this.busHistoryAccumulator = 0;
        this.textAccumulator = 0;
        this.smoothedBusRate = 0;
        this.lastBusText = '';
        this.lastDigiActive = false;
        this.busText = null;
        this.digiLed = null;
    }

    getHTML() {
        let voices = '';
        for (let v = 0; v < SID_METER_VOICES; v++) {
            const x = 18 + v * 43;
            let segments = '';
            for (let s = 0; s < SID_METER_SEGMENTS; s++) {
                segments += `<rect class="sid-meter-segment" x="${x}" y="${89 - s * 4}" width="22" height="3" />`;
            }
            voices += `
                <g class="sid-meter-voice sid-meter-voice-${v}">
                    <rect class="sid-meter-gate" x="${x}" y="22" width="22" height="3" />
                    ${segments}
                    <line class="sid-meter-peak" x1="${x - 1}" x2="${x + 23}" y1="94" y2="94" />
                    <text class="sid-meter-voice-label" x="${x + 11}" y="103" text-anchor="middle">V${v + 1}</text>
                    <text class="sid-meter-state" x="${x + 11}" y="112" text-anchor="middle">IDLE</text>
                </g>`;
        }

        let history = '';
        for (let i = 0; i < SID_BUS_HISTORY; i++) {
            history += `<rect class="sid-bus-history-bar" x="${10 + i * 3}" y="150" width="2" height="0" />`;
        }

        return `
            <aside class="sid-activity" aria-label="SID voice envelope and register bus activity">
                <svg viewBox="0 0 180 154" role="img" aria-label="Three envelope meters and logarithmic SID register write history">
                    <text class="sid-meter-title" x="10" y="10">SID ACTIVITY</text>
                    <text class="sid-meter-caption" x="10" y="18">ENVELOPE / GATE</text>
                    <rect class="sid-meter-digi" x="145" y="5" width="25" height="8" />
                    <text class="sid-meter-digi-label" x="157.5" y="11" text-anchor="middle">D418</text>
                    ${voices}
                    <text class="sid-meter-caption" x="10" y="125">REG WR/S · LOG</text>
                    <text class="sid-meter-bus-value" x="170" y="125" text-anchor="end">0</text>
                    <rect class="sid-bus-history-frame" x="9" y="130" width="145" height="22" />
                    <line class="sid-bus-history-grid" x1="10" y1="139" x2="153" y2="139" />
                    ${history}
                </svg>
            </aside>`;
    }

    cacheDOM(container) {
        for (let v = 0; v < SID_METER_VOICES; v++) {
            const group = container.querySelector(`.sid-meter-voice-${v}`);
            this.voiceSegments[v] = group.querySelectorAll('.sid-meter-segment');
            this.voicePeaksSvg[v] = group.querySelector('.sid-meter-peak');
            this.voiceGates[v] = group.querySelector('.sid-meter-gate');
            this.voiceStates[v] = group.querySelector('.sid-meter-state');
        }
        this.busHistoryBars = container.querySelectorAll('.sid-bus-history-bar');
        this.busText = container.querySelector('.sid-meter-bus-value');
        this.digiLed = container.querySelector('.sid-meter-digi');
    }

    update(vols, regs, writesPerSecond, dt) {
        let gateMask = 0;
        let stateMask = 0;
        for (let v = 0; v < SID_METER_VOICES; v++) {
            const envelope = Math.max(0, Math.min(1, vols[v] || 0));
            const level = Math.round(envelope * SID_METER_SEGMENTS);
            if (this.voiceLevels[v] !== level) {
                this.voiceLevels[v] = level;
                const segments = this.voiceSegments[v];
                for (let s = 0; s < SID_METER_SEGMENTS; s++) {
                    segments[s].classList.toggle('is-active', s < level);
                }
            }

            if (envelope >= this.voicePeaks[v]) {
                this.voicePeaks[v] = envelope;
                this.voicePeakHold[v] = 0.25;
            } else if (this.voicePeakHold[v] > 0) {
                this.voicePeakHold[v] = Math.max(0, this.voicePeakHold[v] - dt);
            } else {
                this.voicePeaks[v] = Math.max(envelope, this.voicePeaks[v] - dt * 1.8);
            }

            const peakY = 93 - Math.round(this.voicePeaks[v] * 64);
            if (this.voicePeakY[v] !== peakY) {
                this.voicePeakY[v] = peakY;
                this.voicePeaksSvg[v].setAttribute('y1', peakY);
                this.voicePeaksSvg[v].setAttribute('y2', peakY);
            }

            const gate = (regs[v * 7 + 4] & 1) !== 0;
            if (gate) gateMask |= (1 << v);
            const rawState = regs[30 + v] & 3;
            const state = (!gate && envelope < 0.005) ? 3 : rawState;
            stateMask |= state << (v * 2);
        }

        if (this.lastGateMask !== gateMask) {
            this.lastGateMask = gateMask;
            for (let v = 0; v < SID_METER_VOICES; v++) {
                this.voiceGates[v].classList.toggle('is-active', (gateMask & (1 << v)) !== 0);
            }
        }

        if (this.lastStateMask !== stateMask) {
            this.lastStateMask = stateMask;
            for (let v = 0; v < SID_METER_VOICES; v++) {
                const state = (stateMask >>> (v * 2)) & 3;
                const label = state < 3 ? SID_ENV_STATE_LABELS[state] : 'IDLE';
                if (this.voiceStates[v].textContent !== label) this.voiceStates[v].textContent = label;
            }
        }

        const blend = Math.min(1, dt * 12);
        this.smoothedBusRate += ((writesPerSecond || 0) - this.smoothedBusRate) * blend;
        this.textAccumulator += dt;
        if (this.textAccumulator >= 0.1) {
            this.textAccumulator = 0;
            const text = String(Math.round(this.smoothedBusRate));
            if (text !== this.lastBusText) {
                this.lastBusText = text;
                this.busText.textContent = text;
            }
        }

        const digiActive = (regs[25] || 0) > 2 || (regs[26] || 0) !== 0;
        if (digiActive !== this.lastDigiActive) {
            this.lastDigiActive = digiActive;
            this.digiLed.classList.toggle('is-active', digiActive);
        }

        this.busHistoryAccumulator += dt;
        if (this.busHistoryAccumulator >= 0.05) {
            this.busHistoryAccumulator %= 0.05;
            this.busHistory[this.busHistoryHead] = sidBusMeterLevel(this.smoothedBusRate);
            this.busHistoryHead = (this.busHistoryHead + 1) % SID_BUS_HISTORY;
            for (let i = 0; i < SID_BUS_HISTORY; i++) {
                const level = this.busHistory[(this.busHistoryHead + i) % SID_BUS_HISTORY];
                const height = Math.round(level * 20);
                this.busHistoryBars[i].setAttribute('y', 150 - height);
                this.busHistoryBars[i].setAttribute('height', height);
            }
        }
    }
}
