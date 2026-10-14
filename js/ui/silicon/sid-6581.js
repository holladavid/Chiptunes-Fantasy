// === js/ui/silicon/sid-6581.js ===
// =========================================================
// MOS 6581 / CSG 8580 (SID) LIVING SILICON DIE VISUALIZER (v1.5.0)
// Zero-Allocation, 100% Hardware-Synchronized Die Telemetry:
// - 3x 24-Bit Oscillators with Live 12-Bit PWM Bar, TEST-Bit & NMOS Wire-AND Badge
// - Inter-Voice Cross-Modulation Pathways (Hard-Sync & XOR Ring-Modulation)
// - 3x Dynamic 15-Bit ADSR Envelope Graphs with Live Phase/Level Tracer Dot
// - Filter Routing Multiplexer ($D417) + Schematic-Accurate 3OFF ($D418 Bit 7) Switch
// - 2MHz ZDF Multimode VCF with Live Morphing Frequency Response Curve (LP/BP/HP/NOTCH)
// - 4-Bit Multiplying Master VCA with $D418 Galway Digi & PlaySID DMA Detector
// - Full DIP-28 Pinout Activity (CAP1/2, PHI2, /CS, A0-A4, D0-D7, AUDIO OUT)
// =========================================================

import { BaseChip } from './base-chip.js';

export class Sid6581 extends BaseChip {
    constructor(container) {
        super(container);
        // Zero-Allocation State Caches for Dirty-Checking & Bus Diffing
        this.lastRegs = new Uint8Array(32);
        this.lastAdsrPacked = new Int32Array([-1, -1, -1]);
        this.lastFilterGraphHash = -1;
        this.digiHoldTimer = 0.0;
        this.digiModeType = 0; // 0 = IDLE, 1 = $D418 DIGI, 2 = PLAYSID DMA
        this.lastT = 0.0;
    }

    cacheDOM() {
        const q = (sel) => this.container.querySelector(sel);
        this.cache = {
            // Side Chassis Diagnostics (from BaseChip wrapper)
            diagVals: this.container.querySelectorAll('.silicon-diagnostics .d-val'),
            diagLbls: this.container.querySelectorAll('.silicon-diagnostics .d-lbl'),

            // Oscillator Blocks, Labels, PWM Bars & Badges
            osc1: q('.sid-osc1'), osc2: q('.sid-osc2'), osc3: q('.sid-osc3'),
            osc1Hz: q('.sid-osc1-hz'), osc2Hz: q('.sid-osc2-hz'), osc3Hz: q('.sid-osc3-hz'),
            pwBar1: q('.sid-pw-bar-1'), pwBar2: q('.sid-pw-bar-2'), pwBar3: q('.sid-pw-bar-3'),
            wand1: q('.sid-wand-1'), wand2: q('.sid-wand-2'), wand3: q('.sid-wand-3'),

            // Waveform LEDs (T, S, P, N)
            w1T: q('.w1-t'), w1S: q('.w1-s'), w1P: q('.w1-p'), w1N: q('.w1-n'),
            w2T: q('.w2-t'), w2S: q('.w2-s'), w2P: q('.w2-p'), w2N: q('.w2-n'),
            w3T: q('.w3-t'), w3S: q('.w3-s'), w3P: q('.w3-p'), w3N: q('.w3-n'),

            // Cross-Modulation (SYNC / RING) Badges & Buses
            sync1: q('.sid-sync-1'), sync2: q('.sid-sync-2'), sync3: q('.sid-sync-3'),
            ring1: q('.sid-ring-1'), ring2: q('.sid-ring-2'), ring3: q('.sid-ring-3'),
            xmodBus1: q('.sig-xmod-1'), xmodBus2: q('.sig-xmod-2'), xmodBus3: q('.sig-xmod-3'),

            // ADSR Blocks, Dynamic Paths, Live Tracer Dots & State Labels
            env1: q('.sid-env1'), env2: q('.sid-env2'), env3: q('.sid-env3'),
            adsrPath1: q('.sid-adsr-path-1'), adsrPath2: q('.sid-adsr-path-2'), adsrPath3: q('.sid-adsr-path-3'),
            adsrDot1: q('.sid-adsr-dot-1'), adsrDot2: q('.sid-adsr-dot-2'), adsrDot3: q('.sid-adsr-dot-3'),
            adsrState1: q('.sid-adsr-st-1'), adsrState2: q('.sid-adsr-st-2'), adsrState3: q('.sid-adsr-st-3'),
            gateLed1: q('.sid-gate-1'), gateLed2: q('.sid-gate-2'), gateLed3: q('.sid-gate-3'),

            // Filter Block, Dynamic Response Curve & Mode LEDs
            filtBlock: q('.sid-filt-block'),
            filtCutLabel: q('.sid-filt-cut'),
            filtModeLabel: q('.sid-filt-mode'),
            filtCurvePath: q('.sid-vcf-curve'),
            filtCutLine: q('.sid-vcf-cut-line'),
            filtResBar: q('.sid-filt-res-bar'),
            lpLed: q('.sid-lp-led'), bpLed: q('.sid-bp-led'), hpLed: q('.sid-hp-led'),
            rt1Led: q('.sid-rt-1'), rt2Led: q('.sid-rt-2'), rt3Led: q('.sid-rt-3'),

            // 3OFF Switch & Master VCA / Digi Block
            v3OffBox: q('.sid-3off-box'),
            v3OffText: q('.sid-3off-text'),
            vcaBlock: q('.sid-vca'),
            vcaVolText: q('.sid-vca-vol'),
            vcaVolBar: q('.sid-vca-vol-bar'),
            digiBox: q('.sid-digi-box'),
            digiStatus: q('.sid-digi-status'),
            digiSub: q('.sid-digi-sub'),
            dieTempText: q('.sid-die-temp'),

            // Signal Routing Buses
            sigOsc1Filt: q('.sig-osc1-filt'), sigOsc1Byp: q('.sig-osc1-byp'),
            sigOsc2Filt: q('.sig-osc2-filt'), sigOsc2Byp: q('.sig-osc2-byp'),
            sigOsc3Filt: q('.sig-osc3-filt'), sigOsc3Byp: q('.sig-osc3-byp'),
            sigVcfOut: q('.sig-vcf-out'), sigMasterOut: q('.sig-master-out'),
            sigCap1: q('.sig-cap-1'), sigCap2: q('.sig-cap-2'),
            sigCap3: q('.sig-cap-3'), sigCap4: q('.sig-cap-4'),

            // Physical DIP-28 Pins
            pinCap1A: q('.pin-bot-1'), pinCap1B: q('.pin-bot-2'),
            pinCap2A: q('.pin-bot-3'), pinCap2B: q('.pin-bot-4'),
            pinPhi2: q('.pin-bot-6'),
            pinCs: q('.pin-bot-8'),
            pinA0: q('.pin-bot-9'), pinA1: q('.pin-bot-10'), pinA2: q('.pin-bot-11'),
            pinA3: q('.pin-bot-12'), pinA4: q('.pin-bot-13'),
            pinD0: q('.pin-top-15'), pinD1: q('.pin-top-16'), pinD2: q('.pin-top-17'),
            pinD3: q('.pin-top-18'), pinD4: q('.pin-top-19'), pinD5: q('.pin-top-20'),
            pinD6: q('.pin-top-21'), pinD7: q('.pin-top-22'),
            pinOut: q('.pin-top-27'),
            pinVdd: q('.pin-top-28')
        };

        // Configure side diagnostic labels for C64 Hardware Lab
        if (this.cache.diagLbls && this.cache.diagLbls.length >= 4) {
            this.cache.diagLbls[0].textContent = 'PAL CLK';
            this.cache.diagLbls[1].textContent = '$D418 BUS';
            this.cache.diagLbls[2].textContent = 'VCF MODE';
            this.cache.diagLbls[3].textContent = 'DIE TEMP';
        }
    }

    updateVoiceADSR(vIdx, baseX, baseY, ad, sr, gate, envNorm) {
        const packed = (ad << 8) | sr;
        const a = (ad >> 4) & 15;
        const d = ad & 15;
        const s = (sr >> 4) & 15;
        const r = sr & 15;

        // Geometry inside 44x15 ADSR graph window
        const w = 44;
        const h = 14;
        const bottomY = baseY + h;

        const atkW = Math.max(3, Math.round((a / 15) * 12));
        const decW = Math.max(3, Math.round((d / 15) * 12));
        const relW = Math.max(3, Math.round((r / 15) * 10));
        const susY = Math.round(bottomY - (s / 15) * h);

        const xA = baseX + atkW;
        const xD = xA + decW;
        const xS = baseX + w - relW;
        const xR = baseX + w;

        // Only update SVG path string if AD/SR registers changed (Zero-Allocation Dirty Check)
        if (this.lastAdsrPacked[vIdx] !== packed) {
            this.lastAdsrPacked[vIdx] = packed;
            const pathEl = this.cache[`adsrPath${vIdx + 1}`];
            if (pathEl) {
                pathEl.setAttribute('d', `M ${baseX} ${bottomY} L ${xA} ${baseY} L ${xD} ${susY} L ${xS} ${susY} L ${xR} ${bottomY}`);
            }
        }

        // Compute live Tracer Dot position & Envelope Phase label
        let dotX = baseX;
        let dotY = bottomY - Math.round(envNorm * h);
        let stateStr = 'IDLE';
        const susNorm = s / 15.0;

        if (gate) {
            if (envNorm > 0.94) {
                dotX = xA;
                stateStr = 'ATK';
            } else if (envNorm > susNorm + 0.04) {
                const decProgress = 1.0 - ((envNorm - susNorm) / Math.max(0.01, 1.0 - susNorm));
                dotX = Math.round(xA + Math.max(0, Math.min(1, decProgress)) * (xD - xA));
                stateStr = 'DEC';
            } else {
                dotX = Math.round((xD + xS) * 0.5);
                stateStr = 'SUS';
            }
        } else {
            if (envNorm > 0.02) {
                const relProgress = 1.0 - Math.min(1.0, envNorm / Math.max(0.05, susNorm || 0.5));
                dotX = Math.round(xS + Math.max(0, Math.min(1, relProgress)) * (xR - xS));
                stateStr = 'REL';
            }
        }

        const dotEl = this.cache[`adsrDot${vIdx + 1}`];
        if (dotEl) {
            dotEl.setAttribute('cx', dotX);
            dotEl.setAttribute('cy', dotY);
            dotEl.style.fill = gate ? 'var(--highlight-color)' : (envNorm > 0.02 ? 'var(--text-color)' : 'var(--chassis-dark)');
        }

        const stEl = this.cache[`adsrState${vIdx + 1}`];
        if (stEl && stEl.textContent !== stateStr) {
            stEl.textContent = stateStr;
        }

        const gateEl = this.cache[`gateLed${vIdx + 1}`];
        if (gateEl) {
            gateEl.style.fill = gate ? 'var(--highlight-color)' : 'var(--chassis-dark)';
        }
    }

    updateFilterResponseCurve(cutoffReg, resReg, fMode) {
        const hash = (cutoffReg << 8) | (resReg << 4) | (fMode >> 4);
        if (this.lastFilterGraphHash === hash) return;
        this.lastFilterGraphHash = hash;

        const pathEl = this.cache.filtCurvePath;
        const cutLineEl = this.cache.filtCutLine;
        if (!pathEl) return;

        // Graph bounds: x = 244..332 (w = 88), y = 73..105 (h = 32)
        const gx = 244;
        const gy = 73;
        const gw = 88;
        const gh = 32;
        const bottomY = gy + gh - 2;
        const midY = gy + 18;

        const normCut = cutoffReg / 2047.0;
        const cutX = Math.round(gx + 6 + normCut * (gw - 12));
        const resPeak = Math.round((resReg / 15.0) * 13);
        const peakY = Math.max(gy + 2, midY - resPeak);

        if (cutLineEl) {
            cutLineEl.setAttribute('x1', cutX);
            cutLineEl.setAttribute('x2', cutX);
        }

        const hasLP = (fMode & 16) !== 0;
        const hasBP = (fMode & 32) !== 0;
        const hasHP = (fMode & 64) !== 0;

        let d = '';
        if (!hasLP && !hasBP && !hasHP) {
            // Filter disabled: flat baseline
            d = `M ${gx} ${bottomY} L ${gx + gw} ${bottomY}`;
        } else if (hasLP && hasHP && !hasBP) {
            // NOTCH (LP + HP Phase Inversion)
            const nLeft = Math.max(gx + 2, cutX - 8);
            const nRight = Math.min(gx + gw - 2, cutX + 8);
            d = `M ${gx} ${midY} L ${nLeft} ${midY} L ${cutX} ${bottomY} L ${nRight} ${midY} L ${gx + gw} ${midY}`;
        } else if (hasLP && !hasHP) {
            // LOWPASS (with optional BP boost)
            const kneeX = Math.max(gx + 2, cutX - 6);
            const dropX = Math.min(gx + gw, cutX + 14);
            d = `M ${gx} ${midY} L ${kneeX} ${midY} L ${cutX} ${peakY} L ${dropX} ${bottomY} L ${gx + gw} ${bottomY}`;
        } else if (hasHP && !hasLP) {
            // HIGHPASS
            const riseX = Math.max(gx, cutX - 14);
            const kneeX = Math.min(gx + gw - 2, cutX + 6);
            d = `M ${gx} ${bottomY} L ${riseX} ${bottomY} L ${cutX} ${peakY} L ${kneeX} ${midY} L ${gx + gw} ${midY}`;
        } else {
            // BANDPASS
            const leftX = Math.max(gx, cutX - 14);
            const rightX = Math.min(gx + gw, cutX + 14);
            d = `M ${gx} ${bottomY} L ${leftX} ${bottomY} L ${cutX} ${peakY} L ${rightX} ${bottomY} L ${gx + gw} ${bottomY}`;
        }

        pathEl.setAttribute('d', d);
    }

    update(vols, regs, t) {
        if (!regs) return;
        const dt = this.lastT === 0 ? 0.016 : Math.max(0.001, Math.min(0.1, t - this.lastT));
        this.lastT = t;

        const v0 = vols[0] || 0.0;
        const v1 = vols[1] || 0.0;
        const v2 = vols[2] || 0.0;
        const totalV = (v0 + v1 + v2) / 3.0;

        // =========================================================
        // 1. DETECT CPU BUS REGISTER WRITES (FOR PIN & DIGI TELEMETRY)
        // =========================================================
        let lastWrittenReg = -1;
        let lastWrittenVal = 0;
        let volChanged = (regs[24] & 0x0F) !== (this.lastRegs[24] & 0x0F);

        for (let r = 0; r < 25; r++) {
            if (regs[r] !== this.lastRegs[r]) {
                lastWrittenReg = r;
                lastWrittenVal = regs[r];
                this.lastRegs[r] = regs[r];
            }
        }

        const subFrameDigiWrites = regs[25] || 0;
        const playSidDmaActive = (regs[26] || 0) !== 0;

        if (playSidDmaActive) {
            this.digiHoldTimer = 0.25;
            this.digiModeType = 2; // PLAYSID DMA
        } else if (subFrameDigiWrites > 2 || volChanged) {
            this.digiHoldTimer = 0.20;
            this.digiModeType = 1; // $D418 DIGI WIGGLE
        } else if (this.digiHoldTimer > 0) {
            this.digiHoldTimer = Math.max(0.0, this.digiHoldTimer - dt);
            if (this.digiHoldTimer === 0) this.digiModeType = 0;
        }

        // =========================================================
        // 2. OSCILLATORS 1-3: FREQ, TEST-BIT, 12-BIT PWM, WIRE-AND & SYNC/RING
        // =========================================================
        const adsrBaseY = [60, 95, 130];

        for (let v = 0; v < 3; v++) {
            const base = v * 7;
            const idx = v + 1;
            const freqReg = regs[base] | (regs[base + 1] << 8);
            const pwReg = regs[base + 2] | ((regs[base + 3] & 15) << 8);
            const ctrl = regs[base + 4];
            const ad = regs[base + 5];
            const sr = regs[base + 6];
            const vol = vols[v] || 0.0;

            const isTest = (ctrl & 8) !== 0;
            const isSync = (ctrl & 2) !== 0;
            const isRing = (ctrl & 4) !== 0;
            const isGate = (ctrl & 1) !== 0;
            const waveMask = ctrl & 0xF0;
            const isCombined = (waveMask !== 0 && waveMask !== 0x10 && waveMask !== 0x20 && waveMask !== 0x40 && waveMask !== 0x80);

            // Frequency or TEST-Bit Lock Display
            const hz = freqReg ? Math.round((freqReg * 985248) / 16777216) : 0;
            const hzEl = this.cache[`osc${idx}Hz`];
            if (hzEl) {
                const txt = isTest ? 'TEST' : (hz > 0 ? (hz >= 1000 ? `${(hz / 1000).toFixed(1)}k` : `${hz}Hz`) : 'IDLE');
                if (hzEl.textContent !== txt) hzEl.textContent = txt;
            }

            // 12-Bit PWM Duty Cycle Bar (Test-Bit on Pulse forces 100% DC High!)
            const pwBar = this.cache[`pwBar${idx}`];
            if (pwBar) {
                const hasPulse = (ctrl & 64) !== 0;
                const pwNorm = (hasPulse && isTest) ? 1.0 : (pwReg / 4095.0);
                pwBar.setAttribute('width', Math.max(1, Math.round(pwNorm * 40)));
                pwBar.style.opacity = hasPulse ? 0.95 : 0.25;
            }

            // NMOS Wire-AND Combined Waveform Badge ($30, $50, $60, $70)
            const wandEl = this.cache[`wand${idx}`];
            if (wandEl) {
                wandEl.style.opacity = isCombined ? '1.0' : '0.15';
                wandEl.style.fill = isCombined ? 'var(--highlight-color)' : 'var(--text-color)';
            }

            // Waveform LEDs (Triangle, Sawtooth, Pulse, Noise)
            if (this.cache[`w${idx}T`]) this.cache[`w${idx}T`].style.fill = (ctrl & 16) ? 'var(--highlight-color)' : 'var(--chassis-dark)';
            if (this.cache[`w${idx}S`]) this.cache[`w${idx}S`].style.fill = (ctrl & 32) ? 'var(--highlight-color)' : 'var(--chassis-dark)';
            if (this.cache[`w${idx}P`]) this.cache[`w${idx}P`].style.fill = (ctrl & 64) ? 'var(--highlight-color)' : 'var(--chassis-dark)';
            if (this.cache[`w${idx}N`]) this.cache[`w${idx}N`].style.fill = (ctrl & 128) ? 'var(--highlight-color)' : 'var(--chassis-dark)';

            // Hard-Sync & Ring-Modulation Badges + Inter-Voice Bus
            const syncEl = this.cache[`sync${idx}`];
            const ringEl = this.cache[`ring${idx}`];
            const xmodBus = this.cache[`xmodBus${idx}`];
            if (syncEl) syncEl.style.fill = isSync ? 'var(--highlight-color)' : 'var(--chassis-dark)';
            if (ringEl) ringEl.style.fill = isRing ? 'var(--highlight-color)' : 'var(--chassis-dark)';
            this.updateBusFlow(xmodBus, (isSync || isRing) ? Math.max(0.35, vol) : 0.0);

            // Block Glow
            if (this.cache[`osc${idx}`]) this.cache[`osc${idx}`].style.opacity = 0.30 + vol * 0.70;
            if (this.cache[`env${idx}`]) this.cache[`env${idx}`].style.opacity = 0.30 + vol * 0.70;

            // Update Dynamic ADSR Graph & Live Tracer Dot
            this.updateVoiceADSR(v, 156, adsrBaseY[v], ad, sr, isGate, vol);
        }

        // =========================================================
        // 3. 2MHz ZDF MULTIMODE VCF & SCHEMATIC-ACCURATE 3OFF ROUTING
        // =========================================================
        const cutoffReg = (regs[22] << 3) | (regs[21] & 7);
        const resReg = regs[23] >> 4;
        const routeReg = regs[23] & 15;
        const fMode = regs[24] & 0xF0;
        const masterVol4Bit = regs[24] & 0x0F;
        const is3Off = (fMode & 128) !== 0;
        const temp = regs[29] || 55;

        // Exact MOS 6581 R3 S-Curve + Thermal Drift
        const norm = cutoffReg / 2047.0;
        let baseHz = 30.0 + (1200.0 * norm) + (7200.0 * norm * norm) - (2230.0 * norm * norm * norm);
        if (baseHz > 6200.0) baseHz = 6200.0;
        const thermalCoefficient = Math.exp(-(temp - 55.0) * 0.003);
        const fhz = Math.round(Math.max(30.0, Math.min(6800.0, baseHz * thermalCoefficient)));

        if (this.cache.filtCutLabel) this.cache.filtCutLabel.textContent = `FC:${fhz}Hz`;
        if (this.cache.filtResBar) this.cache.filtResBar.setAttribute('width', Math.round((resReg / 15) * 52));

        // Filter Mode String (LP, BP, HP, NOTCH)
        let modeStr = 'OFF';
        if ((fMode & 80) === 80) modeStr = (fMode & 32) ? 'LP+BP+HP' : 'NOTCH';
        else if (fMode & 16) modeStr = (fMode & 32) ? 'LP+BP' : 'LOWPASS';
        else if (fMode & 64) modeStr = (fMode & 32) ? 'BP+HP' : 'HIGHPASS';
        else if (fMode & 32) modeStr = 'BANDPASS';

        if (this.cache.filtModeLabel && this.cache.filtModeLabel.textContent !== modeStr) {
            this.cache.filtModeLabel.textContent = modeStr;
        }

        // Update Live SVG Filter Response Curve
        this.updateFilterResponseCurve(cutoffReg, resReg, fMode);

        // Filter Mode & Routing LEDs
        if (this.cache.lpLed) this.cache.lpLed.style.fill = (fMode & 16) ? 'var(--highlight-color)' : 'var(--chassis-dark)';
        if (this.cache.bpLed) this.cache.bpLed.style.fill = (fMode & 32) ? 'var(--highlight-color)' : 'var(--chassis-dark)';
        if (this.cache.hpLed) this.cache.hpLed.style.fill = (fMode & 64) ? 'var(--highlight-color)' : 'var(--chassis-dark)';

        if (this.cache.rt1Led) this.cache.rt1Led.style.fill = (routeReg & 1) ? 'var(--highlight-color)' : 'var(--chassis-dark)';
        if (this.cache.rt2Led) this.cache.rt2Led.style.fill = (routeReg & 2) ? 'var(--highlight-color)' : 'var(--chassis-dark)';
        if (this.cache.rt3Led) this.cache.rt3Led.style.fill = (routeReg & 4) ? 'var(--highlight-color)' : 'var(--chassis-dark)';

        // 3OFF Switch State (Schematic-accurate: only disconnects unfiltered Voice 3 path, leaks DC!)
        if (this.cache.v3OffBox) {
            this.cache.v3OffBox.style.opacity = is3Off ? '1.0' : '0.35';
        }
        if (this.cache.v3OffText) {
            const v3Txt = is3Off ? '3OFF:DC' : '3ON';
            if (this.cache.v3OffText.textContent !== v3Txt) this.cache.v3OffText.textContent = v3Txt;
        }

        let filterLoad = 0.0;
        if (routeReg & 1) filterLoad += v0;
        if (routeReg & 2) filterLoad += v1;
        if (routeReg & 4) filterLoad += v2;

        if (this.cache.filtBlock) {
            this.cache.filtBlock.style.opacity = 0.30 + Math.min(0.70, filterLoad * 0.45 + (resReg / 15.0) * 0.35);
        }

        // Filter vs Bypass Signal Bus Flows
        this.updateBusFlow(this.cache.sigOsc1Filt, (routeReg & 1) ? v0 : 0);
        this.updateBusFlow(this.cache.sigOsc1Byp,  (routeReg & 1) ? 0 : v0);

        this.updateBusFlow(this.cache.sigOsc2Filt, (routeReg & 2) ? v1 : 0);
        this.updateBusFlow(this.cache.sigOsc2Byp,  (routeReg & 2) ? 0 : v1);

        this.updateBusFlow(this.cache.sigOsc3Filt, (routeReg & 4) ? v2 : 0);
        // If 3OFF is set on unfiltered Voice 3, show subtle DC-leakage trickle (0.18 * v2)
        const v2BypassFlow = (routeReg & 4) ? 0 : (is3Off ? v2 * 0.18 : v2);
        this.updateBusFlow(this.cache.sigOsc3Byp, v2BypassFlow);

        this.updateBusFlow(this.cache.sigVcfOut, filterLoad);

        // =========================================================
        // 4. MASTER VCA, $D418 DIGI DETECTOR & THERMAL READOUT
        // =========================================================
        const isDigiActive = this.digiModeType > 0;
        const masterActivity = Math.max(totalV, isDigiActive ? (masterVol4Bit / 15.0) : 0.0);

        if (this.cache.vcaBlock) {
            this.cache.vcaBlock.style.opacity = 0.40 + masterActivity * 0.60;
        }
        if (this.cache.vcaVolText) {
            const volStr = `VOL:${masterVol4Bit.toString().padStart(2, '0')} ($${masterVol4Bit.toString(16).toUpperCase()})`;
            if (this.cache.vcaVolText.textContent !== volStr) this.cache.vcaVolText.textContent = volStr;
        }
        if (this.cache.vcaVolBar) {
            this.cache.vcaVolBar.setAttribute('width', Math.round((masterVol4Bit / 15.0) * 56));
        }

        if (this.cache.digiBox) {
            this.cache.digiBox.style.opacity = isDigiActive ? '1.0' : '0.30';
            this.cache.digiBox.style.filter = isDigiActive ? 'drop-shadow(0 0 5px var(--text-color))' : 'none';
        }
        if (this.cache.digiStatus && this.cache.digiSub) {
            const dStat = this.digiModeType === 2 ? 'PLAYSID DMA' : (this.digiModeType === 1 ? '$D418 DIGI' : '4-BIT DAC');
            const dSub = this.digiModeType === 2 ? '3.91kHz NIBBLE' : (this.digiModeType === 1 ? 'GALWAY VCA MOD' : 'MULTIPLIER');
            if (this.cache.digiStatus.textContent !== dStat) this.cache.digiStatus.textContent = dStat;
            if (this.cache.digiSub.textContent !== dSub) this.cache.digiSub.textContent = dSub;
        }

        if (this.cache.dieTempText) {
            const tStr = `DIE:${temp}°C`;
            if (this.cache.dieTempText.textContent !== tStr) this.cache.dieTempText.textContent = tStr;
        }

        this.updateBusFlow(this.cache.sigMasterOut, masterActivity);

        // =========================================================
        // 5. DIP-28 PHYSICAL PINS & SIDE DIAGNOSTIC TELEMETRY
        // =========================================================
        const capGlow = Math.min(1.0, (filterLoad * 0.55) + (resReg / 15.0) * 0.45);
        this.updateBusFlow(this.cache.sigCap1, capGlow);
        this.updateBusFlow(this.cache.sigCap2, capGlow);
        this.updateBusFlow(this.cache.sigCap3, capGlow);
        this.updateBusFlow(this.cache.sigCap4, capGlow);

        this.updatePinGlow(this.cache.pinCap1A, capGlow);
        this.updatePinGlow(this.cache.pinCap1B, capGlow);
        this.updatePinGlow(this.cache.pinCap2A, capGlow);
        this.updatePinGlow(this.cache.pinCap2B, capGlow);
        this.updatePinGlow(this.cache.pinOut, masterActivity);
        this.updatePinGlow(this.cache.pinPhi2, 0.45 + 0.35 * Math.sin(t * 24.0));
        this.updatePinGlow(this.cache.pinVdd, 0.5);

        // Address (A0-A4), Data (D0-D7) & /CS Pin Flash on CPU Register Writes
        const hasBusWrite = lastWrittenReg >= 0 || isDigiActive;
        const activeAddr = isDigiActive ? 24 : Math.max(0, lastWrittenReg);
        const activeData = isDigiActive ? regs[24] : lastWrittenVal;

        this.updatePinGlow(this.cache.pinCs, hasBusWrite ? 0.9 : 0.0);
        this.updatePinGlow(this.cache.pinA0, (hasBusWrite && (activeAddr & 1)) ? 0.85 : 0.0);
        this.updatePinGlow(this.cache.pinA1, (hasBusWrite && (activeAddr & 2)) ? 0.85 : 0.0);
        this.updatePinGlow(this.cache.pinA2, (hasBusWrite && (activeAddr & 4)) ? 0.85 : 0.0);
        this.updatePinGlow(this.cache.pinA3, (hasBusWrite && (activeAddr & 8)) ? 0.85 : 0.0);
        this.updatePinGlow(this.cache.pinA4, (hasBusWrite && (activeAddr & 16)) ? 0.85 : 0.0);

        this.updatePinGlow(this.cache.pinD0, (hasBusWrite && (activeData & 1)) ? 0.85 : 0.0);
        this.updatePinGlow(this.cache.pinD1, (hasBusWrite && (activeData & 2)) ? 0.85 : 0.0);
        this.updatePinGlow(this.cache.pinD2, (hasBusWrite && (activeData & 4)) ? 0.85 : 0.0);
        this.updatePinGlow(this.cache.pinD3, (hasBusWrite && (activeData & 8)) ? 0.85 : 0.0);
        this.updatePinGlow(this.cache.pinD4, (hasBusWrite && (activeData & 16)) ? 0.85 : 0.0);
        this.updatePinGlow(this.cache.pinD5, (hasBusWrite && (activeData & 32)) ? 0.85 : 0.0);
        this.updatePinGlow(this.cache.pinD6, (hasBusWrite && (activeData & 64)) ? 0.85 : 0.0);
        this.updatePinGlow(this.cache.pinD7, (hasBusWrite && (activeData & 128)) ? 0.85 : 0.0);

        // Side Chassis Diagnostics
        if (this.cache.diagVals && this.cache.diagVals.length >= 4) {
            const busTxt = this.digiModeType === 2 ? 'DMA DIGI' : (this.digiModeType === 1 ? '$D418 MOD' : (hasBusWrite ? `$D4${activeAddr.toString(16).toUpperCase().padStart(2, '0')}` : 'LOCKSTEP'));
            if (this.cache.diagVals[1].textContent !== busTxt) this.cache.diagVals[1].textContent = busTxt;
            if (this.cache.diagVals[2].textContent !== modeStr) this.cache.diagVals[2].textContent = modeStr;
            const tempTxt = `${temp}°C R3`;
            if (this.cache.diagVals[3].textContent !== tempTxt) this.cache.diagVals[3].textContent = tempTxt;
        }
    }

    getSvg() {
        return `
            <svg viewBox="0 0 500 200" xmlns="http://www.w3.org/2000/svg">
                <!-- 28 DIP Pins (1-14 Bottom, 28-15 Top) -->
                ${this.generatePins(28, 50, 400)}
                
                <!-- Ceramic / NMOS DIP-28 Package Body -->
                <rect class="silicon-chip-body" x="50" y="30" width="400" height="140" rx="4" />
                <path d="M 50 85 A 15 15 0 0 1 50 115 Z" fill="var(--chassis-dark)" />
                <circle cx="63" cy="42" r="3.5" fill="var(--chassis-dark)" />
                <text x="250" y="39" class="silicon-chip-label" fill="var(--panel-text)" text-anchor="middle" dominant-baseline="middle">MOS 6581 SOUND INTERFACE DEVICE (1MHz DIE)</text>

                <!-- Silicon Die Cavity Window -->
                <rect x="70" y="46" width="360" height="108" rx="2" fill="var(--screen-bg)" stroke="var(--chassis-dark)" stroke-width="2" />

                <!-- =========================================================
                     INTER-VOICE CROSS-MODULATION BUS (SYNC / RING)
                     OSC3 -> OSC1 -> OSC2 -> OSC3
                     ========================================================= -->
                <path class="signal-bus sig-xmod-1" d="M 79 135 L 74 135 L 74 65 L 79 65" fill="none" stroke="var(--text-color)" stroke-width="1.2" style="opacity: 0.1;" />
                <path class="signal-bus sig-xmod-2" d="M 79 65 L 76 65 L 76 100 L 79 100" fill="none" stroke="var(--text-color)" stroke-width="1.2" style="opacity: 0.1;" />
                <path class="signal-bus sig-xmod-3" d="M 79 100 L 76 100 L 76 135 L 79 135" fill="none" stroke="var(--text-color)" stroke-width="1.2" style="opacity: 0.1;" />

                <!-- =========================================================
                     STAGE 1: 3x 24-BIT OSCILLATORS & WAVEFORM SELECTORS
                     ========================================================= -->
                <!-- OSC 1 -->
                <g class="sid-osc1" style="opacity: 0.30;">
                    <rect x="79" y="50" width="68" height="30" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.2" />
                    <text x="83" y="56" font-size="5" fill="var(--text-color)" font-weight="bold" dominant-baseline="middle">V1</text>
                    <text x="113" y="56" class="sid-osc1-hz" font-size="5.5" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">IDLE</text>
                    <text x="144" y="56" class="sid-wand-1" font-size="4.5" fill="var(--text-color)" text-anchor="end" dominant-baseline="middle" style="opacity:0.15;">W&amp;</text>
                    
                    <!-- 12-Bit PWM Bar -->
                    <rect x="83" y="61" width="40" height="3" fill="var(--chassis-dark)" />
                    <rect class="sid-pw-bar-1" x="83" y="61" width="20" height="3" fill="var(--highlight-color)" />
                    <!-- Sync & Ring LEDs -->
                    <rect class="sid-sync-1" x="127" y="60" width="7" height="4" fill="var(--chassis-dark)" />
                    <text x="130.5" y="62.5" font-size="3.2" fill="var(--screen-bg)" text-anchor="middle" dominant-baseline="middle">SY</text>
                    <rect class="sid-ring-1" x="136" y="60" width="7" height="4" fill="var(--chassis-dark)" />
                    <text x="139.5" y="62.5" font-size="3.2" fill="var(--screen-bg)" text-anchor="middle" dominant-baseline="middle">RM</text>

                    <!-- Waveform Selector Matrix (T S P N) -->
                    <rect class="w1-t" x="83" y="67" width="4" height="4" fill="var(--chassis-dark)"/><text x="85" y="75" font-size="4" fill="var(--text-color)" text-anchor="middle">T</text>
                    <rect class="w1-s" x="96" y="67" width="4" height="4" fill="var(--chassis-dark)"/><text x="98" y="75" font-size="4" fill="var(--text-color)" text-anchor="middle">S</text>
                    <rect class="w1-p" x="109" y="67" width="4" height="4" fill="var(--chassis-dark)"/><text x="111" y="75" font-size="4" fill="var(--text-color)" text-anchor="middle">P</text>
                    <rect class="w1-n" x="122" y="67" width="4" height="4" fill="var(--chassis-dark)"/><text x="124" y="75" font-size="4" fill="var(--text-color)" text-anchor="middle">N</text>
                </g>

                <!-- OSC 2 -->
                <g class="sid-osc2" style="opacity: 0.30;">
                    <rect x="79" y="85" width="68" height="30" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.2" />
                    <text x="83" y="91" font-size="5" fill="var(--text-color)" font-weight="bold" dominant-baseline="middle">V2</text>
                    <text x="113" y="91" class="sid-osc2-hz" font-size="5.5" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">IDLE</text>
                    <text x="144" y="91" class="sid-wand-2" font-size="4.5" fill="var(--text-color)" text-anchor="end" dominant-baseline="middle" style="opacity:0.15;">W&amp;</text>
                    
                    <rect x="83" y="96" width="40" height="3" fill="var(--chassis-dark)" />
                    <rect class="sid-pw-bar-2" x="83" y="96" width="20" height="3" fill="var(--highlight-color)" />
                    <rect class="sid-sync-2" x="127" y="95" width="7" height="4" fill="var(--chassis-dark)" />
                    <text x="130.5" y="97.5" font-size="3.2" fill="var(--screen-bg)" text-anchor="middle" dominant-baseline="middle">SY</text>
                    <rect class="sid-ring-2" x="136" y="95" width="7" height="4" fill="var(--chassis-dark)" />
                    <text x="139.5" y="97.5" font-size="3.2" fill="var(--screen-bg)" text-anchor="middle" dominant-baseline="middle">RM</text>

                    <rect class="w2-t" x="83" y="102" width="4" height="4" fill="var(--chassis-dark)"/><text x="85" y="110" font-size="4" fill="var(--text-color)" text-anchor="middle">T</text>
                    <rect class="w2-s" x="96" y="102" width="4" height="4" fill="var(--chassis-dark)"/><text x="98" y="110" font-size="4" fill="var(--text-color)" text-anchor="middle">S</text>
                    <rect class="w2-p" x="109" y="102" width="4" height="4" fill="var(--chassis-dark)"/><text x="111" y="110" font-size="4" fill="var(--text-color)" text-anchor="middle">P</text>
                    <rect class="w2-n" x="122" y="102" width="4" height="4" fill="var(--chassis-dark)"/><text x="124" y="110" font-size="4" fill="var(--text-color)" text-anchor="middle">N</text>
                </g>

                <!-- OSC 3 -->
                <g class="sid-osc3" style="opacity: 0.30;">
                    <rect x="79" y="120" width="68" height="30" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.2" />
                    <text x="83" y="126" font-size="5" fill="var(--text-color)" font-weight="bold" dominant-baseline="middle">V3</text>
                    <text x="113" y="126" class="sid-osc3-hz" font-size="5.5" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">IDLE</text>
                    <text x="144" y="126" class="sid-wand-3" font-size="4.5" fill="var(--text-color)" text-anchor="end" dominant-baseline="middle" style="opacity:0.15;">W&amp;</text>
                    
                    <rect x="83" y="131" width="40" height="3" fill="var(--chassis-dark)" />
                    <rect class="sid-pw-bar-3" x="83" y="131" width="20" height="3" fill="var(--highlight-color)" />
                    <rect class="sid-sync-3" x="127" y="130" width="7" height="4" fill="var(--chassis-dark)" />
                    <text x="130.5" y="132.5" font-size="3.2" fill="var(--screen-bg)" text-anchor="middle" dominant-baseline="middle">SY</text>
                    <rect class="sid-ring-3" x="136" y="130" width="7" height="4" fill="var(--chassis-dark)" />
                    <text x="139.5" y="132.5" font-size="3.2" fill="var(--screen-bg)" text-anchor="middle" dominant-baseline="middle">RM</text>

                    <rect class="w3-t" x="83" y="137" width="4" height="4" fill="var(--chassis-dark)"/><text x="85" y="145" font-size="4" fill="var(--text-color)" text-anchor="middle">T</text>
                    <rect class="w3-s" x="96" y="137" width="4" height="4" fill="var(--chassis-dark)"/><text x="98" y="145" font-size="4" fill="var(--text-color)" text-anchor="middle">S</text>
                    <rect class="w3-p" x="109" y="137" width="4" height="4" fill="var(--chassis-dark)"/><text x="111" y="145" font-size="4" fill="var(--text-color)" text-anchor="middle">P</text>
                    <rect class="w3-n" x="122" y="137" width="4" height="4" fill="var(--chassis-dark)"/><text x="124" y="145" font-size="4" fill="var(--text-color)" text-anchor="middle">N</text>
                </g>

                <!-- =========================================================
                     STAGE 2: 3x 15-BIT ADSR ENVELOPE GENERATORS + LIVE TRACER
                     ========================================================= -->
                <!-- ADSR 1 -->
                <g class="sid-env1" style="opacity: 0.30;">
                    <rect x="152" y="50" width="52" height="30" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.2" />
                    <text x="156" y="56" font-size="4.5" fill="var(--text-color)" dominant-baseline="middle">ENV1</text>
                    <text x="184" y="56" class="sid-adsr-st-1" font-size="4.5" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">IDLE</text>
                    <circle class="sid-gate-1" cx="199" cy="55.5" r="2" fill="var(--chassis-dark)" />
                    <path class="sid-adsr-path-1" d="M 156 74 L 164 60 L 174 66 L 190 66 L 200 74" fill="none" stroke="var(--text-color)" stroke-width="1.1" />
                    <circle class="sid-adsr-dot-1" cx="156" cy="74" r="2.2" fill="var(--chassis-dark)" />
                </g>

                <!-- ADSR 2 -->
                <g class="sid-env2" style="opacity: 0.30;">
                    <rect x="152" y="85" width="52" height="30" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.2" />
                    <text x="156" y="91" font-size="4.5" fill="var(--text-color)" dominant-baseline="middle">ENV2</text>
                    <text x="184" y="91" class="sid-adsr-st-2" font-size="4.5" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">IDLE</text>
                    <circle class="sid-gate-2" cx="199" cy="90.5" r="2" fill="var(--chassis-dark)" />
                    <path class="sid-adsr-path-2" d="M 156 109 L 164 95 L 174 101 L 190 101 L 200 109" fill="none" stroke="var(--text-color)" stroke-width="1.1" />
                    <circle class="sid-adsr-dot-2" cx="156" cy="109" r="2.2" fill="var(--chassis-dark)" />
                </g>

                <!-- ADSR 3 -->
                <g class="sid-env3" style="opacity: 0.30;">
                    <rect x="152" y="120" width="52" height="30" rx="1" fill="none" stroke="var(--text-color)" stroke-width="1.2" />
                    <text x="156" y="126" font-size="4.5" fill="var(--text-color)" dominant-baseline="middle">ENV3</text>
                    <text x="184" y="126" class="sid-adsr-st-3" font-size="4.5" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">IDLE</text>
                    <circle class="sid-gate-3" cx="199" cy="125.5" r="2" fill="var(--chassis-dark)" />
                    <path class="sid-adsr-path-3" d="M 156 144 L 164 130 L 174 136 L 190 136 L 200 144" fill="none" stroke="var(--text-color)" stroke-width="1.1" />
                    <circle class="sid-adsr-dot-3" cx="156" cy="144" r="2.2" fill="var(--chassis-dark)" />
                </g>

                <!-- =========================================================
                     STAGE 3: 2MHz ZDF STATE-SPACE MULTIMODE VCF
                     ========================================================= -->
                <g class="sid-filt-block" style="opacity: 0.30;">
                    <rect x="238" y="50" width="102" height="100" rx="2" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="289" y="57" font-size="5.5" fill="var(--text-color)" font-weight="bold" text-anchor="middle" dominant-baseline="middle">2MHz ZDF OTA VCF</text>
                    
                    <text x="243" y="66" class="sid-filt-cut" font-size="5.5" fill="var(--highlight-color)" dominant-baseline="middle">FC:30Hz</text>
                    <text x="335" y="66" class="sid-filt-mode" font-size="5" fill="var(--text-color)" text-anchor="end" dominant-baseline="middle">OFF</text>

                    <!-- Live Filter Frequency Response Graph Window -->
                    <rect x="243" y="72" width="92" height="35" fill="var(--chassis-dark)" stroke="var(--text-color)" stroke-width="0.6" />
                    <line class="sid-vcf-cut-line" x1="255" y1="73" x2="255" y2="106" stroke="var(--text-color)" stroke-width="0.6" stroke-dasharray="1,1" />
                    <path class="sid-vcf-curve" d="M 244 103 L 332 103" fill="none" stroke="var(--highlight-color)" stroke-width="1.4" />

                    <!-- Resonance Bar -->
                    <text x="243" y="114" font-size="4.8" fill="var(--text-color)" dominant-baseline="middle">RES</text>
                    <rect x="259" y="111.5" width="52" height="4" fill="none" stroke="var(--text-color)" stroke-width="0.8" />
                    <rect class="sid-filt-res-bar" x="259" y="111.5" width="0" height="4" fill="var(--highlight-color)" />
                    <text x="335" y="114" font-size="4.5" fill="var(--text-color)" text-anchor="end" dominant-baseline="middle">JFET</text>

                    <!-- Filter Mode LEDs (LP / BP / HP) -->
                    <circle class="sid-lp-led" cx="255" cy="125" r="3" fill="var(--chassis-dark)" />
                    <text x="255" y="133" font-size="4.5" fill="var(--text-color)" text-anchor="middle">LP</text>
                    
                    <circle class="sid-bp-led" cx="289" cy="125" r="3" fill="var(--chassis-dark)" />
                    <text x="289" y="133" font-size="4.5" fill="var(--text-color)" text-anchor="middle">BP</text>

                    <circle class="sid-hp-led" cx="323" cy="125" r="3" fill="var(--chassis-dark)" />
                    <text x="323" y="133" font-size="4.5" fill="var(--text-color)" text-anchor="middle">HP</text>

                    <!-- Filter Voice Routing Indicators ($D417) -->
                    <text x="244" y="143" font-size="4.2" fill="var(--text-color)" dominant-baseline="middle">MUX:</text>
                    <rect class="sid-rt-1" x="263" y="140" width="5" height="5" fill="var(--chassis-dark)" /><text x="272" y="143" font-size="4.2" fill="var(--text-color)" dominant-baseline="middle">V1</text>
                    <rect class="sid-rt-2" x="285" y="140" width="5" height="5" fill="var(--chassis-dark)" /><text x="294" y="143" font-size="4.2" fill="var(--text-color)" dominant-baseline="middle">V2</text>
                    <rect class="sid-rt-3" x="307" y="140" width="5" height="5" fill="var(--chassis-dark)" /><text x="316" y="143" font-size="4.2" fill="var(--text-color)" dominant-baseline="middle">V3</text>
                </g>

                <!-- =========================================================
                     STAGE 4: MASTER VCA, $D418 DIGI ENGINE & DIE SENSOR
                     ========================================================= -->
                <g class="sid-vca" style="opacity: 0.90;">
                    <rect x="352" y="50" width="70" height="100" rx="2" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                    <text x="387" y="57" font-size="5.5" fill="var(--text-color)" font-weight="bold" text-anchor="middle" dominant-baseline="middle">MASTER VCA</text>
                    
                    <text x="387" y="67" class="sid-vca-vol" font-size="5" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">VOL:15 ($F)</text>
                    <rect x="359" y="72" width="56" height="4" fill="var(--chassis-dark)" stroke="var(--text-color)" stroke-width="0.6" />
                    <rect class="sid-vca-vol-bar" x="359" y="72" width="56" height="4" fill="var(--highlight-color)" />

                    <!-- $D418 Digidrum / PlaySID DMA Detector Box -->
                    <g class="sid-digi-box" style="opacity: 0.30;">
                        <rect x="357" y="82" width="60" height="28" rx="1" fill="var(--chassis-dark)" stroke="var(--text-color)" stroke-width="1" />
                        <text x="387" y="91" class="sid-digi-status" font-size="5" fill="var(--highlight-color)" font-weight="bold" text-anchor="middle" dominant-baseline="middle">4-BIT DAC</text>
                        <text x="387" y="101" class="sid-digi-sub" font-size="4.2" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">MULTIPLIER</text>
                    </g>

                    <!-- Thermal Sensor & R3 Mixer DC Bias -->
                    <text x="387" y="122" class="sid-die-temp" font-size="5" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">DIE:55°C</text>
                    <text x="387" y="132" font-size="4.2" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">DC BIAS: 1.12V</text>
                    <text x="387" y="142" font-size="4.2" fill="var(--text-color)" text-anchor="middle" dominant-baseline="middle">C13 HP: 16Hz</text>
                </g>

                <!-- =========================================================
                     SIGNAL BUS: FILTER MULTIPLEXER, BYPASS & 3OFF GATE
                     ========================================================= -->
                <!-- Paths to Filter -->
                <path class="signal-bus sig-osc1-filt" d="M 204 65 L 238 65" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <path class="signal-bus sig-osc2-filt" d="M 204 100 L 238 100" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
                <path class="signal-bus sig-osc3-filt" d="M 204 135 L 238 135" fill="none" stroke="var(--text-color)" stroke-width="1.5" />

                <!-- Paths bypassing the Filter (Direct to Master VCA) -->
                <path class="signal-bus sig-osc1-byp" d="M 204 56 L 216 56 L 216 48 L 368 48 L 368 50" fill="none" stroke="var(--text-color)" stroke-width="1.3" />
                <path class="signal-bus sig-osc2-byp" d="M 204 91 L 212 91 L 212 48" fill="none" stroke="var(--text-color)" stroke-width="1.3" />
                <path class="signal-bus sig-osc3-byp" d="M 204 144 L 216 144 L 216 152 L 368 152 L 368 150" fill="none" stroke="var(--text-color)" stroke-width="1.3" />

                <!-- Schematic-Accurate 3OFF Gate Badge on Voice 3 Unfiltered Bypass -->
                <g class="sid-3off-box" style="opacity: 0.35;">
                    <rect x="207" y="145" width="28" height="8" rx="1" fill="var(--screen-bg)" stroke="var(--text-color)" stroke-width="0.8" />
                    <text x="221" y="149.5" class="sid-3off-text" font-size="3.8" fill="var(--highlight-color)" text-anchor="middle" dominant-baseline="middle">3ON</text>
                </g>

                <!-- VCF Output to Master VCA -->
                <path class="signal-bus sig-vcf-out" d="M 340 100 L 352 100" fill="none" stroke="var(--text-color)" stroke-width="1.6" />
                
                <!-- Master VCA Output to Pin 27 (AUDIO OUT, Top Row 2nd from left = cx ~93) -->
                <path class="signal-bus sig-master-out" d="M 422 100 L 436 100 L 436 22 L 93 22 L 93 15" fill="none" stroke="var(--text-color)" stroke-width="1.6" />

                <!-- VCF Integrators to External Polystyrene Filter Capacitors (Pins 1-4 Bottom Left) -->
                <path class="signal-bus sig-cap-1" d="M 255 150 L 255 160 L 64 160 L 64 170" fill="none" stroke="var(--text-color)" stroke-width="1.2" />
                <path class="signal-bus sig-cap-2" d="M 275 150 L 275 163 L 93 163 L 93 170" fill="none" stroke="var(--text-color)" stroke-width="1.2" />
                <path class="signal-bus sig-cap-3" d="M 295 150 L 295 163 L 121 163 L 121 170" fill="none" stroke="var(--text-color)" stroke-width="1.2" />
                <path class="signal-bus sig-cap-4" d="M 315 150 L 315 160 L 150 160 L 150 170" fill="none" stroke="var(--text-color)" stroke-width="1.2" />
            </svg>
        `;
    }
}