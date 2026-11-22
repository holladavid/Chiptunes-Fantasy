// === js/visuals/dse/atari/ym-silicon-bg.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: YM2149F MICROVERSE (BACKGROUND)
// DOM-free 9-bit Atari ST rendering via pure fillRect:
// - Strenger Horizont-Vertrag: YM2149F-IC-Die & 3 Oszillatoren oberhalb
//   horizon = floor(0.55 * h); Log-DAC-Platine & Bus-Leiterbahnen darunter
// - Duales adaptives Layout (Landscape 3er-Array / Portrait-DIP-Stapel)
// - 3 echte YM2149F-Signale (4-Bit-Log-DAC-Stufen, Hardware-Envelope, PWM/Sync)
//   inkl. 10-Segment-LED-Peak-Hold & optionaler metrics.regs-Auswertung
// - Deterministischer 16-Bit-LFSR-Register-Monitor, Kupfer-Bus-Elektronen &
//   Timer-B Sync-Buzzer Raster-Tears (strict <= 15 Farben / Scanline)
// =========================================================

import {
    bayerFadeCells,
    createXorshift32,
    quantizeAtari9Bit,
    rgbToHex
} from '../../utils/hardware-constraints.js';

const T_IN = 1.5;
const T_OUT = 1.5;

function quantHex(r, g, b) {
    const [qr, qg, qb] = quantizeAtari9Bit(r, g, b);
    return rgbToHex(qr, qg, qb);
}

// Strenge 15-Farben Atari ST 9-Bit Silizium-Palette (max #fcfcfc, garantiert <= 16/Scanline)
const PAL = Object.freeze({
    BLACK:        quantHex(0, 0, 0),       // 0: Chip-Vertiefung & Scope-Hintergrund
    WHITE:        quantHex(252, 252, 252), // 1: Peak-LED, Hard-Beat-Entladung (#fcfcfc)
    SILICON_DARK: quantHex(0, 36, 36),     // 2: Wafer-Substrat (Dunkel-Petrol)
    SILICON_MID:  quantHex(0, 72, 72),     // 3: Wafer-Grid & Afterglow-Basis
    SILICON_DEEP: quantHex(0, 0, 36),      // 4: Tiefer Schatten / Afterglow-Wafer
    STEEL_BLUE:   quantHex(36, 72, 108),   // 5: IC-Gehaeuse-Kante & Afterglow-Bus
    COOL_SILVER:  quantHex(72, 144, 144),  // 6: Afterglow-Oszillator & kalte Bevels
    NEON_GREEN:   quantHex(0, 252, 0),     // 7: Voice A (4-Bit Log-DAC Bass) & LEDs
    DARK_GREEN:   quantHex(0, 144, 0),     // 8: Voice A Phosphor-Echo & Leiterbahn
    CYAN:         quantHex(0, 252, 252),   // 9: Voice B (Hardware-Envelope) & DAC-Welle
    DARK_CYAN:    quantHex(0, 144, 144),   // 10: Chip-Innenrahmen & Scope-Grid
    AMBER:        quantHex(252, 180, 0),   // 11: Gold-Pins, Copper-Spitzen & Voice C Peak
    COPPER:       quantHex(144, 72, 0),    // 12: Kupfer-Busspuren & Pin-Sockel
    MAGENTA:      quantHex(252, 0, 252),   // 13: LFSR-Bitstrom & Sync-Buzzer-Tears
    DARK_MAGENTA: quantHex(108, 0, 108)    // 14: LFSR-Trail & Theme-2-Substrat
});

const FALLBACK_TENSION = {
    playing: 0.30,
    buildup: 0.65,
    climax: 1.0,
    afterglow: 0.20
};

function clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
}

function clamp01(v) {
    return Number.isFinite(v) ? clamp(v, 0, 1) : 0;
}

function readChannel(arr, idx, fallback) {
    if (!arr || idx >= arr.length) return fallback;
    return Number.isFinite(arr[idx]) ? clamp01(arr[idx]) : fallback;
}

function readYmRegs(regs) {
    if (!regs || typeof regs !== 'object') return null;

    const raw = (Array.isArray(regs.r) || ArrayBuffer.isView(regs.r))
        ? regs.r
        : ((Array.isArray(regs.registers) || ArrayBuffer.isView(regs.registers)) ? regs.registers : null);

    if (raw && raw.length >= 14) {
        const pA = ((raw[1] & 0x0F) << 8) | (raw[0] & 0xFF);
        const pB = ((raw[3] & 0x0F) << 8) | (raw[2] & 0xFF);
        const pC = ((raw[5] & 0x0F) << 8) | (raw[4] & 0xFF);
        const noisePeriod = raw[6] & 0x1F;
        const mixer = raw[7] & 0x3F;
        const envShape = raw[13] & 0x0F;
        if ([pA, pB, pC, noisePeriod, mixer, envShape].every(Number.isFinite)) {
            return {
                periods: [pA, pB, pC],
                noisePeriod,
                mixer,
                envShape
            };
        }
    }

    const pArr = (Array.isArray(regs.periods) || ArrayBuffer.isView(regs.periods)) ? regs.periods : null;
    if (pArr && pArr.length >= 3 && [pArr[0], pArr[1], pArr[2]].every(Number.isFinite)) {
        return {
            periods: [clamp(pArr[0], 1, 4095), clamp(pArr[1], 1, 4095), clamp(pArr[2], 1, 4095)],
            noisePeriod: Number.isFinite(regs.noisePeriod) ? clamp(regs.noisePeriod, 0, 31) : 12,
            mixer: Number.isFinite(regs.mixer) ? (regs.mixer & 0x3F) : 0,
            envShape: Number.isFinite(regs.envShape) ? (regs.envShape & 0x0F) : 8
        };
    }
    return null;
}

function fillClippedRect(ctx, x, y, rw, rh, minX, minY, maxX, maxY, color) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(rw) || !Number.isFinite(rh)) return;
    const x0 = Math.max(minX, Math.floor(x));
    const y0 = Math.max(minY, Math.floor(y));
    const x1 = Math.min(maxX, Math.floor(x + rw));
    const y1 = Math.min(maxY, Math.floor(y + rh));
    const cw = x1 - x0;
    const ch = y1 - y0;
    if (cw > 0 && ch > 0) {
        if (color !== undefined) ctx.fillStyle = color;
        ctx.fillRect(x0, y0, cw, ch);
    }
}

export class YmSiliconBg {
    constructor() {
        this.name = 'YM2149F Microverse';

        // Zeit- & Zustandsverwaltung
        this.lastT = null;
        this.lastState = 'idle';
        this.stateAge = 0;

        // Kontinuierliche Simulation (bleibt bei Resize/Rotation erhalten)
        this.internalT = 0;
        this.smoothedSpeed = 1.0;
        this.afterglowMix = 0.0;
        this.ten = 0.30;
        this.tenInit = false;

        // Beat- & Buszustand
        this.lastBeatCount = -1;
        this.beatParity = 0;
        this.themePhase = 0;
        this.busDir = 1;
        this.dacWaveAge = 10.0;
        this.dacWavePeak = 0.0;
        this.hardFlashAge = 10.0;
        this.tearBurstAge = 10.0;

        // Peak-Hold pro YM-Stimme (A=0, B=1, C=2)
        this.peaks = new Float32Array([0.1, 0.1, 0.1]);

        // Instanzeigener deterministischer Xorshift32 PRNG (Zero Math.random)
        this.rng = createXorshift32(0x594D3231); // 'YM21'
        this.lfsrBits = 0x1A5B3;

        // Vorallokierte Timer-B Sync-Buzzer Tear-Slots (Zero-GC)
        this.tearSlots = Array.from({ length: 5 }, (_, i) => ({
            yFrac: 0.12 + i * 0.16,
            hPx: 2,
            shift: 0
        }));
    }

    resize() {
        // Adaptives Dual-Layout (Landscape/Portrait) skaliert dynamisch aus w/h.
    }

    _sampleWaveform(coreIdx, xNorm, vol, time, regInfo, beatImpulse) {
        // Optionales Perioden-Tuning aus YM-Registern, Amplitude immer ueber vol
        let freqMult = 1.0;
        if (regInfo && regInfo.periods[coreIdx] > 0) {
            const normP = clamp(420 / regInfo.periods[coreIdx], 0.55, 2.2);
            freqMult = normP;
        }

        if (coreIdx === 0) {
            // Voice A: Stepped 4-Bit Log-DAC Square + Decay-Treppe (typisch YM-Digibass)
            const cycles = (2.5 + vol * 2.0) * freqMult;
            const cycPos = ((xNorm * cycles + time * 1.4) % 1 + 1) % 1;
            const sq = cycPos < 0.5 ? 1.0 : -1.0;
            const envRamp = 1.0 - (cycPos % 0.5) * 1.1; // leichter 4-Bit-DAC-Droop
            const raw = sq * envRamp * (0.25 + 0.75 * vol);
            return Math.round(raw * 7) / 7; // 15 diskrete 4-Bit-Stufen
        }

        if (coreIdx === 1) {
            // Voice B: YM Hardware-Envelope Dreieck/Saegezahn-Hybride (/\/\)
            const envShape = regInfo ? regInfo.envShape : (8 + (this.themePhase * 2));
            const cycles = (3.5 + vol * 3.5) * freqMult;
            const p = ((xNorm * cycles - time * 1.8) % 1 + 1) % 1;
            const tri = (envShape & 2) ? (1.0 - Math.abs(p * 2 - 1) * 2) : (1.0 - p * 2);
            const mod = (((xNorm * cycles * 4 + time * 5) % 1) < 0.5 ? 0.18 : -0.18) * (0.3 + beatImpulse);
            return clamp((tri * (0.28 + 0.72 * vol)) + mod, -1, 1);
        }

        // Voice C: Hochfrequente Sync-Buzzer / PWM-Lead-Spur
        const cycles = (5.0 + vol * 6.0) * freqMult;
        const duty = 0.25 + 0.30 * Math.sin(time * 2.4 + vol * 3.1);
        const p = ((xNorm * cycles + time * 2.6 * this.busDir) % 1 + 1) % 1;
        const sq = p < duty ? 1.0 : -1.0;
        return sq * (0.22 + 0.78 * vol);
    }

    _drawWaveformTrace(ctx, coreIdx, sx, sy, sw, sh, vol, time, regInfo, isCool, beatImpulse, tearActive, w, h) {
        if (sw < 4 || sh < 6) return;

        const innerTop = sy + 1;
        const innerBot = sy + sh - 2;
        const usableH = Math.max(2, innerBot - innerTop);
        const midY = innerTop + Math.floor(usableH * 0.5);
        const ampPx = Math.max(1, Math.floor(usableH * 0.44 * clamp01(0.12 + vol * 0.76 + beatImpulse * 0.12)));

        // Leise Ruhelage bei extrem kleinem Pegel
        if (vol < 0.03 && beatImpulse < 0.05) {
            const idleCol = isCool ? PAL.STEEL_BLUE : PAL.DARK_CYAN;
            fillClippedRect(ctx, sx, midY, sw, 1, sx, sy, sx + sw, sy + sh, idleCol);
            return;
        }

        // Spurfarben je YM-Kanal & Makrozustand
        let mainCol;
        let trailCol;
        if (isCool) {
            mainCol = PAL.COOL_SILVER;
            trailCol = PAL.STEEL_BLUE;
        } else if (coreIdx === 0) {
            mainCol = this.hardFlashAge < 0.06 ? PAL.WHITE : PAL.NEON_GREEN; 
            trailCol = PAL.DARK_GREEN;
        } else if (coreIdx === 1) {
            mainCol = (this.themePhase === 2 || beatImpulse > 0.72) ? PAL.AMBER : PAL.CYAN;
            trailCol = PAL.DARK_CYAN;
        } else {
            mainCol = beatImpulse > 0.55 ? PAL.WHITE : (this.themePhase === 1 ? PAL.AMBER : PAL.NEON_GREEN);
            trailCol = this.themePhase === 2 ? PAL.DARK_MAGENTA : PAL.DARK_GREEN;
        }

        const thick = (vol > 0.65 || beatImpulse > 0.70) && usableH >= 14 ? 2 : 1;
        const passOffsets = isCool ? [0] : [1, 0]; // Pass 0 = Phosphor-Schatten +1px tiefer

        for (let pass = 0; pass < passOffsets.length; pass++) {
            const yBias = passOffsets[pass];
            const col = yBias === 0 ? mainCol : trailCol;
            ctx.fillStyle = col;

            let prevY = midY;
            let runStart = 0;

            for (let x = 0; x < sw; x++) {
                const sample = this._sampleWaveform(coreIdx, x / Math.max(1, sw - 1), vol, time, regInfo, beatImpulse);
                let py = Math.round(midY - sample * ampPx) + yBias;
                py = clamp(py, innerTop, innerBot - (thick - 1));

                // Subtile Timer-B HBL-Phasenverschiebung bei aktiven Sync-Buzzer-Tears
                if (tearActive && yBias === 0) {
                    const yFrac = py / Math.max(1, h);
                    for (let s = 0; s < this.tearSlots.length; s++) {
                        const slot = this.tearSlots[s];
                        if (Math.abs(yFrac - slot.yFrac) < 0.035) {
                            py = clamp(py + (slot.shift > 0 ? -1 : 1), innerTop, innerBot);
                            break;
                        }
                    }
                }

                if (x === 0) {
                    prevY = py;
                    runStart = 0;
                    continue;
                }

                if (py !== prevY) {
                    fillClippedRect(ctx, sx + runStart, prevY, x - runStart, thick, sx, sy, sx + sw, sy + sh);
                    const vy0 = Math.min(prevY, py);
                    const vy1 = Math.max(prevY, py);
                    fillClippedRect(ctx, sx + x, vy0, 1, vy1 - vy0 + thick, sx, sy, sx + sw, sy + sh);
                    prevY = py;
                    runStart = x;
                }
            }
            // Sauberes Schlusssegment exakt bis zum rechten Rand sw
            fillClippedRect(ctx, sx + runStart, prevY, sw - runStart, thick, sx, sy, sx + sw, sy + sh);
        }
    }

    _drawLogDacLedMeter(ctx, mx, my, mw, mh, vol, peak, isCool, vertical, beatImpulse, w, h) {
        if (mw < 2 || mh < 4) return;
        const segments = vertical
            ? Math.max(4, Math.min(10, Math.floor(mh / 3)))
            : Math.max(4, Math.min(10, Math.floor(mw / 4)));
        const activeSegs = Math.round(clamp01(vol * 0.88 + beatImpulse * 0.12) * segments);
        const peakIdx = clamp(Math.floor(clamp01(peak) * (segments - 1)), 0, segments - 1);

        if (vertical) {
            const pitch = Math.max(2, Math.floor(mh / segments));
            const ledH = Math.max(1, pitch - 1);
            for (let s = 0; s < segments; s++) {
                const ly = my + mh - (s + 1) * pitch;
                if (ly < my) break;
                const lit = s < activeSegs;
                const isPeak = s === peakIdx && peak > 0.08;
                let col = PAL.SILICON_DARK;
                if (isCool) {
                    col = (lit || isPeak) ? (isPeak ? PAL.COOL_SILVER : PAL.STEEL_BLUE) : PAL.SILICON_DEEP;
                } else if (isPeak && (beatImpulse > 0.55 || s >= segments - 2)) {
                    col = PAL.WHITE;
                } else if (lit || isPeak) {
                    col = s >= segments - 2 ? PAL.AMBER : (s >= segments - 4 ? PAL.CYAN : PAL.NEON_GREEN);
                }
                fillClippedRect(ctx, mx, ly, mw, ledH, 0, 0, w, h, col);
            }
        } else {
            const pitch = Math.max(2, Math.floor(mw / segments));
            const ledW = Math.max(1, pitch - 1);
            for (let s = 0; s < segments; s++) {
                const lx = mx + s * pitch;
                if (lx >= mx + mw) break;
                const lit = s < activeSegs;
                const isPeak = s === peakIdx && peak > 0.08;
                let col = PAL.SILICON_DARK;
                if (isCool) {
                    col = (lit || isPeak) ? (isPeak ? PAL.COOL_SILVER : PAL.STEEL_BLUE) : PAL.SILICON_DEEP;
                } else if (isPeak && (beatImpulse > 0.55 || s >= segments - 2)) {
                    col = PAL.WHITE;
                } else if (lit || isPeak) {
                    col = s >= segments - 2 ? PAL.AMBER : (s >= segments - 4 ? PAL.CYAN : PAL.NEON_GREEN);
                }
                fillClippedRect(ctx, lx, my, ledW, mh, 0, 0, w, h, col);
            }
        }
    }

    _drawOscChamber(ctx, coreIdx, bx, by, bw, bh, vol, peak, time, regInfo, isCool, beatImpulse, tearActive, w, h) {
        if (bw < 6 || bh < 6) return;

        // Kammerrand + tiefschwarze Scope-Kammer
        const frameCol = isCool
            ? PAL.STEEL_BLUE
            : (beatImpulse > 0.70 ? PAL.WHITE : (beatImpulse > 0.35 ? PAL.CYAN : PAL.DARK_CYAN));
        fillClippedRect(ctx, bx, by, bw, bh, 0, 0, w, h, frameCol);
        fillClippedRect(ctx, bx + 1, by + 1, bw - 2, bh - 2, 0, 0, w, h, PAL.BLACK);

        // Dezentes Scope-Raster innen
        const gridCol = isCool ? PAL.SILICON_DEEP : PAL.SILICON_DARK;
        const innerX = bx + 1;
        const innerY = by + 1;
        const innerW = bw - 2;
        const innerH = bh - 2;

        if (innerH >= 10) {
            fillClippedRect(ctx, innerX, innerY + Math.floor(innerH * 0.5), innerW, 1, 0, 0, w, h, gridCol);
            if (innerH >= 24) {
                fillClippedRect(ctx, innerX, innerY + Math.floor(innerH * 0.25), innerW, 1, 0, 0, w, h, gridCol);
                fillClippedRect(ctx, innerX, innerY + Math.floor(innerH * 0.75), innerW, 1, 0, 0, w, h, gridCol);
            }
        }
        if (innerW >= 24) {
            const stepX = Math.max(8, Math.floor(innerW / 4));
            for (let gx = innerX + stepX; gx < innerX + innerW - 2; gx += stepX) {
                fillClippedRect(ctx, gx, innerY, 1, innerH, 0, 0, w, h, gridCol);
            }
        }

        // Aufteilung zwischen Scope & 4-Bit-Log-DAC-LED-Anzeige
        const verticalLed = bw >= bh * 0.9;
        let scopeX = innerX + 1;
        let scopeY = innerY + 1;
        let scopeW = Math.max(2, innerW - 2);
        let scopeH = Math.max(2, innerH - 2);

        if (verticalLed && innerW >= 18) {
            const meterW = Math.max(3, Math.min(6, Math.floor(innerW * 0.14)));
            scopeW = Math.max(4, innerW - meterW - 4);
            this._drawLogDacLedMeter(
                ctx, innerX + innerW - meterW - 1, innerY + 2, meterW, Math.max(4, innerH - 4),
                vol, peak, isCool, true, beatImpulse, w, h
            );
        } else if (!verticalLed && innerH >= 14) {
            const meterH = 2;
            scopeH = Math.max(4, innerH - meterH - 3);
            this._drawLogDacLedMeter(
                ctx, innerX + 2, innerY + innerH - meterH - 1, Math.max(4, innerW - 4), meterH,
                vol, peak, isCool, false, beatImpulse, w, h
            );
        }

        this._drawWaveformTrace(
            ctx, coreIdx, scopeX, scopeY, scopeW, scopeH,
            vol, time, regInfo, isCool, beatImpulse, tearActive, w, h
        );
    }

    _drawHeaderRegisters(ctx, x, y, wBox, hBox, noiseVol, ten, isCool, beatImpulse, regInfo, bufW, bufH) {
        if (wBox < 16 || hBox < 4) return;
        fillClippedRect(ctx, x, y, wBox, hBox, 0, 0, bufW, bufH, PAL.BLACK);

        // 17-Bit LFSR Rausch-Bitstrom links (16 Segment-Bits)
        const bitZoneW = Math.floor(wBox * 0.56);
        const cells = Math.max(4, Math.min(16, Math.floor(bitZoneW / 4)));
        const cellPitch = Math.max(2, Math.floor(bitZoneW / cells));
        const cellW = Math.max(1, cellPitch - 1);
        const cellH = Math.max(2, hBox - 2);
        const activeDensity = clamp01(0.18 + noiseVol * 0.55 + ten * 0.25 + beatImpulse * 0.20);

        for (let b = 0; b < cells; b++) {
            const bitOn = ((this.lfsrBits >>> b) & 1) === 1;
            const thr = (b / cells) < activeDensity;
            let col = PAL.SILICON_DEEP;
            if (bitOn && thr) {
                col = isCool
                    ? PAL.COOL_SILVER
                    : (beatImpulse > 0.68 && (b & 3) === 0 ? PAL.WHITE : PAL.MAGENTA);
            } else if (bitOn) {
                col = isCool ? PAL.SILICON_MID : PAL.DARK_MAGENTA;
            }
            fillClippedRect(ctx, x + 2 + b * cellPitch, y + 1, cellW, cellH, 0, 0, bufW, bufH, col);
        }

        // Hardware-Envelope-Icon rechts (Saegezahn / Dreieck Symbol)
        const envX = x + bitZoneW + 4;
        const envW = Math.max(4, wBox - bitZoneW - 6);
        if (envW >= 10) {
            const envCol = isCool ? PAL.COOL_SILVER : (this.themePhase === 1 ? PAL.AMBER : PAL.CYAN);
            const steps = Math.max(3, Math.min(8, Math.floor(envW / 4)));
            const sw = Math.max(1, Math.floor(envW / steps));
            const shape = regInfo ? (regInfo.envShape & 3) : (this.themePhase & 1);
            for (let s = 0; s < steps; s++) {
                const frac = shape === 0 ? (1 - (s % 4) / 3) : (Math.abs(((s % 4) / 1.5) - 1));
                const py = y + 1 + Math.floor((1 - frac) * Math.max(0, cellH - 1));
                fillClippedRect(ctx, envX + s * sw, py, Math.max(1, sw - 1), 1, 0, 0, bufW, bufH, envCol);
            }
        }
    }

    render(ctx, width, height, t, state = 'playing', stateTime = 0, metrics = {}) {
        const safeT = Number.isFinite(t) ? t : (this.lastT !== null ? this.lastT : 0);

        if (
            !ctx ||
            !Number.isFinite(width) ||
            !Number.isFinite(height) ||
            width <= 0 ||
            height <= 0 ||
            !Number.isFinite(width / height)
        ) {
            this.lastT = safeT;
            return;
        }

        const w = Math.floor(width);
        const h = Math.floor(height);
        if (w <= 0 || h <= 0) {
            this.lastT = safeT;
            return;
        }

        if (state === 'idle') {
            this.lastT = safeT;
            this.lastState = 'idle';
            this.stateAge = 0;
            return;
        }

        let dt = this.lastT === null ? 0.02 : (safeT - this.lastT);
        if (!Number.isFinite(dt) || dt < 0) {
            if (dt < 0) {
                this.rng.reset(0x594D3231);
                this.lastBeatCount = -1;
            }
            dt = 0.02;
        } else if (dt > 0.1) {
            dt = 0.1;
        }
        this.lastT = safeT;

        if (this.lastState !== state) {
            if (state === 'starting') {
                this.lastBeatCount = -1;
            }
            this.lastState = state;
            this.stateAge = 0;
        } else {
            this.stateAge += dt;
        }

        const safeStateTime = Number.isFinite(stateTime) && stateTime >= 0 ? stateTime : this.stateAge;
        let revealRatio = 1.0;
        if (state === 'starting') {
            revealRatio = clamp01(safeStateTime / T_IN);
        } else if (state === 'stopping') {
            revealRatio = 1.0 - clamp01(safeStateTime / T_OUT);
        }

        if (revealRatio <= 0.001) {
            ctx.fillStyle = PAL.BLACK;
            ctx.fillRect(0, 0, w, h);
            return;
        }

        // ---------------------------------------------------------
        // Defensive Metriken & optionale YM2149-Register
        // ---------------------------------------------------------
        const safeMetrics = metrics || {};
        const energy = clamp01(safeMetrics.energy ?? 0.35);
        const pulse = clamp01(safeMetrics.pulse ?? 0);
        const isClimaxLocked = Boolean(safeMetrics.isClimaxLocked);

        let targetTen = clamp01(safeMetrics.tensionPct ?? FALLBACK_TENSION[state] ?? 0.30);
        if (state === 'afterglow') targetTen = Math.min(targetTen, 0.30);
        if (state === 'starting' || state === 'stopping') targetTen = Math.min(targetTen, 0.25);

        if (!this.tenInit) {
            this.ten = targetTen;
            this.tenInit = true;
        } else {
            const tau = targetTen > this.ten ? 0.30 : 0.85;
            this.ten += (targetTen - this.ten) * (1 - Math.exp(-dt / tau));
        }

        const beatEnv = (safeMetrics.beat && Number.isFinite(safeMetrics.beat[0])) ? clamp01(safeMetrics.beat[0]) : 0;
        const beatImpulse = (safeMetrics.beatImpulse && Number.isFinite(safeMetrics.beatImpulse[0]))
            ? clamp01(safeMetrics.beatImpulse[0])
            : beatEnv;

        const smooth = (Array.isArray(safeMetrics.smooth) || ArrayBuffer.isView(safeMetrics.smooth))
            ? safeMetrics.smooth
            : null;
        const vols = [
            readChannel(smooth, 0, energy),
            readChannel(smooth, 1, energy * 0.88),
            readChannel(smooth, 2, energy * 0.76)
        ];

        const regInfo = readYmRegs(safeMetrics.regs);

        // Peak-Hold Integration pro YM-Kanal
        const peakDecay = dt * (state === 'afterglow' ? 0.55 : 0.90);
        for (let c = 0; c < 3; c++) {
            const targetV = clamp01(vols[c] + beatImpulse * 0.14);
            if (targetV >= this.peaks[c]) this.peaks[c] = targetV;
            else this.peaks[c] = Math.max(targetV, this.peaks[c] - peakDecay);
        }

        // ---------------------------------------------------------
        // Diskrete Beat-Events (streng ueber beatStarted)
        // ---------------------------------------------------------
        const allowDiscrete = state !== 'afterglow' && state !== 'stopping';
        this.dacWaveAge = Math.min(10.0, this.dacWaveAge + dt);
        this.hardFlashAge = Math.min(10.0, this.hardFlashAge + dt);
        this.tearBurstAge = Math.min(10.0, this.tearBurstAge + dt);
        
        if (safeMetrics.beatStarted === true) {
            const incomingCount = Number.isFinite(safeMetrics.beatCount)
                ? Math.floor(safeMetrics.beatCount)
                : (this.lastBeatCount < 0 ? 1 : this.lastBeatCount + 1);

            if (incomingCount !== this.lastBeatCount) {
                this.lastBeatCount = incomingCount;
                this.beatParity = incomingCount & 1;

                const beatStrength = Number.isFinite(safeMetrics.beatStrength)
                    ? clamp01(safeMetrics.beatStrength)
                    : Math.max(0.15, beatImpulse);
                const level = [1, 2, 3].includes(safeMetrics.beatLevel)
                    ? safeMetrics.beatLevel
                    : (beatStrength < 1 / 3 ? 1 : (beatStrength < 2 / 3 ? 2 : 3));

                this.dacWaveAge = 0;
                const levelWeight = level === 3 ? 1.0 : (level === 2 ? 0.60 : 0.25);
                this.dacWavePeak = Math.max(beatStrength, levelWeight);

                if (level === 3 && allowDiscrete) {
                    this.hardFlashAge = 0;
                }

                // Deterministische LFSR-Rotation & Sync-Buzzer Tears auf Medium/Hard
                this.lfsrBits = (this.rng.next() >>> 15) & 0xFFFF;
                if (allowDiscrete && (state === 'climax' || (state === 'buildup' && this.ten > 0.45)) && level >= 2) {
                    this.tearBurstAge = 0;
                    const maxShift = level === 3 ? 4 : 2;
                    for (let s = 0; s < this.tearSlots.length; s++) {
                        this.tearSlots[s].yFrac = 0.08 + this.rng.float() * 0.84;
                        this.tearSlots[s].hPx = 1 + this.rng.int(level === 3 ? 3 : 2);
                        this.tearSlots[s].shift = (this.rng.next() & 1 ? 1 : -1) * (1 + this.rng.int(maxShift));
                    }
                }

                if (allowDiscrete && incomingCount > 0 && incomingCount % 4 === 0) {
                    this.themePhase = (this.themePhase + 1) % 3;
                }
                if (incomingCount > 0 && incomingCount % 8 === 0) {
                    this.busDir = -this.busDir;
                }
            }
        }

        this.dacWaveAge = Math.min(10.0, this.dacWaveAge + dt);
        this.hardFlashAge = Math.min(10.0, this.hardFlashAge + dt);
        this.tearBurstAge = Math.min(10.0, this.tearBurstAge + dt);

        // ---------------------------------------------------------
        // Makrozustands-Dynamik
        // ---------------------------------------------------------
        let targetSpeed = 1.0 + this.ten * 0.4;
        let targetAfterglow = 0.0;

        if (state === 'starting') targetSpeed = 0.85;
        else if (state === 'playing') targetSpeed = 0.95 + this.ten * 0.40;
        else if (state === 'buildup') targetSpeed = 1.50 + this.ten * 0.55;
        else if (state === 'climax') targetSpeed = 2.35 + this.ten * 0.65 + (isClimaxLocked ? 0.25 : 0);
        else if (state === 'afterglow') {
            targetSpeed = 0.28;
            targetAfterglow = 1.0;
        } else if (state === 'stopping') targetSpeed = 0.35;

        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * Math.min(1.0, dt * 4.0);
        this.afterglowMix += (targetAfterglow - this.afterglowMix) * Math.min(1.0, dt * 2.5);
        const ag = this.afterglowMix;
        const isCool = ag > 0.5 || state === 'afterglow';

        const busKick = 1.0 + beatImpulse * (isCool ? 0.10 : 0.45);
        this.internalT = (this.internalT + dt * this.smoothedSpeed * busKick) % 4096;
        const time = this.internalT;

        // Kontinuierliche LFSR-Register-Animation (auch ohne Beats lebendig)
        if (((Math.floor(time * 25)) & 3) === 0) {
            const bit = ((this.lfsrBits >> 0) ^ (this.lfsrBits >> 2) ^ (this.lfsrBits >> 3) ^ (this.lfsrBits >> 5)) & 1;
            this.lfsrBits = ((this.lfsrBits >>> 1) | (bit << 15)) & 0xFFFF;
        }

        // =========================================================
        // MINI-VIEWPORT FALLBACK (z. B. 1x1, 3x1, 7x7)
        // =========================================================
        if (w < 20 || h < 20) {
            fillClippedRect(ctx, 0, 0, w, h, 0, 0, w, h, isCool ? PAL.SILICON_DEEP : PAL.SILICON_DARK);
            const mid = Math.floor(h * 0.5);
            fillClippedRect(ctx, 0, mid, w, 1, 0, 0, w, h, isCool ? PAL.COOL_SILVER : PAL.NEON_GREEN);
            if (revealRatio < 1.0) {
                bayerFadeCells(ctx, 0, 0, w, h, revealRatio, 2, PAL.BLACK);
            }
            return;
        }

        // =========================================================
        // 1. SILIZIUM-WAFER & LEITERBAHN-SUBSTRAT (0 .. h)
        // =========================================================
        const waferCol = isCool ? PAL.SILICON_DEEP : PAL.SILICON_DARK;
        const gridLineCol = isCool ? PAL.SILICON_MID : (this.themePhase === 2 && state === 'climax' ? PAL.DARK_MAGENTA : PAL.SILICON_MID);
        fillClippedRect(ctx, 0, 0, w, h, 0, 0, w, h, waferCol);

        const horizon = Math.max(12, Math.floor(h * 0.55));
        const floorH = Math.max(1, h - horizon);

        // Orthogonales IC-Grid im oberen Hero-Feld (spart fillRects durch grobes Raster)
        const cellStep = Math.max(12, Math.floor(Math.min(w, h) * 0.12));
        for (let gy = cellStep; gy < horizon; gy += cellStep) {
            fillClippedRect(ctx, 0, gy, w, 1, 0, 0, w, horizon, gridLineCol);
        }
        for (let gx = cellStep; gx < w; gx += cellStep) {
            fillClippedRect(ctx, gx, 0, 1, horizon, 0, 0, w, horizon, gridLineCol);
        }

        // =========================================================
        // 2. PERSPEKTIV-LOG-DAC-SUBSTRAT UNTERHALB HORIZONT
        //    (Verdeckt durch aktive Floor-DSEs; voller Boden bei VoidFloor)
        // =========================================================
        const scrollPeriod = Math.max(6, Math.floor(floorH * 0.20));
        const scrollShift = (time * 16 * (isCool ? 0.35 : 1.0)) % scrollPeriod;
        const dacActive = this.dacWaveAge < 0.70 && this.dacWavePeak > 0.01;
        const dacNorm = this.dacWaveAge / 0.70;
        const baseFloorLineCol = isCool ? PAL.STEEL_BLUE : (this.themePhase === 1 ? PAL.COPPER : PAL.DARK_GREEN);

        for (let i = 0; i < 9; i++) {
            const frac = Math.pow(1.34, i) * 0.055;
            const py = horizon + Math.floor(((frac * floorH) + scrollShift) % floorH);
            const normDist = (py - horizon) / floorH;
            const isWaveHit = dacActive && Math.abs(normDist - dacNorm) < 0.15;

            let lineCol = baseFloorLineCol;
            if (isWaveHit && !isCool) {
                lineCol = this.dacWavePeak >= 0.66 ? PAL.WHITE : (this.dacWavePeak >= 0.34 ? PAL.CYAN : PAL.NEON_GREEN);
            }
            fillClippedRect(ctx, 0, py, w, 1, 0, horizon, w, h, lineCol);
        }

        // Perspektivische Adressbus-Lanes von den unteren IC-Pins nach vorne
        const cx = Math.floor(w * 0.5);
        const busLanes = 6;
        const busCol = isCool ? PAL.SILICON_MID : PAL.COPPER;
        const packetCol = isCool ? PAL.COOL_SILVER : (this.hardFlashAge < 0.14 ? PAL.WHITE : (beatImpulse > 0.45 ? PAL.AMBER : PAL.NEON_GREEN));

        for (let l = -busLanes; l <= busLanes; l++) {
            if (l === 0) continue;
            const topX = cx + Math.floor(l * (w * 0.038));
            const botX = cx + Math.floor(l * (w * 0.11));
            const steps = Math.max(4, Math.floor(floorH / 5));
            const stepH = Math.ceil(floorH / steps);
            for (let st = 0; st < steps; st++) {
                const f = st / Math.max(1, steps - 1);
                const lx = Math.floor(topX + (botX - topX) * f);
                const ly = horizon + st * stepH;
                fillClippedRect(ctx, lx, ly, 1, stepH, 0, horizon, w, h, busCol);
            }
            // Laufendes Bus-Datenpaket entlang der Spur
            const laneChan = Math.abs(l) % 3;
            if (vols[laneChan] > 0.12 || this.ten > 0.25) {
                const pFrac = (((time * (1.2 + vols[laneChan] * 1.8) * this.busDir + Math.abs(l) * 0.21) % 1) + 1) % 1;
                const px = Math.floor(topX + (botX - topX) * pFrac);
                const py = horizon + Math.floor(pFrac * (floorH - 2));
                fillClippedRect(ctx, px - 1, py, 3, 2, 0, horizon, w, h, packetCol);
            }
        }

        // Horizont-Leiterbahn-Trennlinie (y = horizon - 1)
        const horCol = isCool ? PAL.STEEL_BLUE : (beatImpulse > 0.55 ? PAL.AMBER : PAL.DARK_CYAN);
        fillClippedRect(ctx, 0, horizon - 1, w, 1, 0, 0, w, horizon, horCol);

        // =========================================================
        // 3. HERO YM2149F SILICON IC-GEHAEUSE (strikt < horizon!)
        // =========================================================
        const isLandscape = w >= h * 0.92;
        const sidePad = isLandscape ? Math.max(6, Math.floor(w * 0.065)) : Math.max(4, Math.floor(w * 0.08));
        const chipW = Math.max(16, w - sidePad * 2);
        const chipX = Math.floor((w - chipW) * 0.5);
        const topPinH = Math.max(3, Math.floor(horizon * 0.07));
        const botPinH = Math.max(4, Math.floor(horizon * 0.08));
        const chipY = topPinH;
        const chipH = Math.max(14, horizon - topPinH - botPinH - 1);

        // Seitliche Kupfer-Busleiterbahnen vom Chip zu beiden Bildraendern (fuellt Ultrawide!)
        const sideRailCount = isLandscape ? 5 : 4;
        const sideBusCol = isCool ? PAL.STEEL_BLUE : (this.themePhase === 1 ? PAL.AMBER : PAL.DARK_GREEN);
        const pulseDotCol = isCool ? PAL.COOL_SILVER : (this.hardFlashAge < 0.12 ? PAL.WHITE : PAL.AMBER);

        for (let r = 0; r < sideRailCount; r++) {
            const ry = chipY + Math.floor(((r + 1) / (sideRailCount + 1)) * chipH);
            fillClippedRect(ctx, 0, ry, chipX, 1, 0, 0, w, horizon, sideBusCol);
            fillClippedRect(ctx, chipX + chipW, ry, w - (chipX + chipW), 1, 0, 0, w, horizon, sideBusCol);

            // Bus-Elektronen rasen in die seitlichen Busse
            const chIdx = r % 3;
            const spd = 0.8 + vols[chIdx] * 2.2 + beatImpulse * 0.8;
            const travel = (((time * spd * this.busDir + r * 0.37) % 1) + 1) % 1;
            const lx = Math.floor(travel * Math.max(1, chipX - 3));
            const rx = chipX + chipW + Math.floor((1 - travel) * Math.max(1, w - chipX - chipW - 3));
            if (chipX >= 4) {
                fillClippedRect(ctx, lx, ry - 1, 3, 2, 0, 0, w, horizon, pulseDotCol);
                fillClippedRect(ctx, rx, ry - 1, 3, 2, 0, 0, w, horizon, pulseDotCol);
            }
        }

        // Untere & obere DIP-40 IC-Pin-Beinchen (ankern exakt auf horizon - 1!)
        const pinStep = Math.max(5, Math.floor(chipW / 18));
        const pinW = Math.max(2, Math.min(4, Math.floor(pinStep * 0.55)));
        const pinBaseCol = isCool ? PAL.STEEL_BLUE : PAL.COPPER;
        const pinTipCol = isCool ? PAL.COOL_SILVER : PAL.AMBER;

        for (let px = chipX + 4, idx = 0; px + pinW <= chipX + chipW - 4; px += pinStep, idx++) {
            const chV = vols[idx % 3];
            const lit = chV > 0.42 || beatImpulse > 0.50;
            // Obere Pins
            fillClippedRect(ctx, px, 1, pinW, Math.max(1, chipY - 1), 0, 0, w, horizon, pinBaseCol);
            if (lit) fillClippedRect(ctx, px, chipY - 2, pinW, 2, 0, 0, w, horizon, pinTipCol);
            // Untere Pins bis zum Horizont
            const botPinY = chipY + chipH;
            const botPinLen = Math.max(1, horizon - 1 - botPinY);
            fillClippedRect(ctx, px, botPinY, pinW, botPinLen, 0, 0, w, horizon, pinBaseCol);
            if (lit) fillClippedRect(ctx, px, botPinY, pinW, Math.max(1, botPinLen - 1), 0, 0, w, horizon, pinTipCol);
        }

        // IC-Gehaeuse (abgeschrägte Bevel-Kante + schwarzer Chip-Körper + DIP-Kerbe links)
        const bezelCol = isCool
            ? PAL.STEEL_BLUE
            : (this.hardFlashAge < 0.12 ? PAL.WHITE : (beatImpulse > 0.60 ? PAL.CYAN : PAL.STEEL_BLUE));
        fillClippedRect(ctx, chipX, chipY, chipW, chipH, 0, 0, w, horizon, bezelCol);
        fillClippedRect(ctx, chipX + 1, chipY + 1, chipW - 2, chipH - 2, 0, 0, w, horizon, PAL.SILICON_DEEP);

        // DIP-Orientierungs-Kerbe auf der linken Chip-Seite
        const notchH = Math.max(4, Math.floor(chipH * 0.18));
        const notchY = chipY + Math.floor((chipH - notchH) * 0.5);
        fillClippedRect(ctx, chipX, notchY, 3, notchH, 0, 0, w, horizon, waferCol);

        // Header-Leiste: 16-Bit LFSR Noise-Shift-Register & Hardware-Envelope-Monitor
        const innerChipX = chipX + 5;
        const innerChipY = chipY + 3;
        const innerChipW = Math.max(8, chipW - 10);
        const innerChipH = Math.max(8, chipH - 6);
        const headerH = innerChipH >= 28 ? Math.max(5, Math.min(9, Math.floor(innerChipH * 0.14))) : 0;

        if (headerH > 0) {
            const noiseVol = (vols[0] + vols[1] + vols[2]) / 3;
            this._drawHeaderRegisters(
                ctx, innerChipX, innerChipY, innerChipW, headerH,
                noiseVol, this.ten, isCool, beatImpulse, regInfo, w, horizon
            );
        }

        // =========================================================
        // 4. DIE 3 YM2149F-OSZILLATOR-KAMMERN (A, B, C)
        // =========================================================
        const tearActive = !isCool && this.tearBurstAge < 0.14 && (state === 'climax' || this.ten > 0.45);
        const coresY = innerChipY + (headerH > 0 ? headerH + 3 : 0);
        const coresH = Math.max(6, innerChipH - (headerH > 0 ? headerH + 3 : 0));

        if (isLandscape) {
            const gapX = Math.max(3, Math.floor(innerChipW * 0.035));
            const coreW = Math.max(6, Math.floor((innerChipW - gapX * 2) / 3));
            const totalW = coreW * 3 + gapX * 2;
            const startX = innerChipX + Math.floor((innerChipW - totalW) * 0.5);

            for (let i = 0; i < 3; i++) {
                const bx = startX + i * (coreW + gapX);
                this._drawOscChamber(
                    ctx, i, bx, coresY, coreW, coresH,
                    vols[i], this.peaks[i], time + i * 0.4, regInfo,
                    isCool, beatImpulse, tearActive, w, horizon
                );
            }
        } else {
            // Portrait: 3 vertikal gestapelte Racks sauber ueber dem Horizont
            const gapY = Math.max(2, Math.floor(coresH * 0.06));
            const coreH = Math.max(6, Math.floor((coresH - gapY * 2) / 3));
            const totalH = coreH * 3 + gapY * 2;
            const startY = coresY + Math.floor((coresH - totalH) * 0.5);

            for (let i = 0; i < 3; i++) {
                const by = startY + i * (coreH + gapY);
                this._drawOscChamber(
                    ctx, i, innerChipX, by, innerChipW, coreH,
                    vols[i], this.peaks[i], time + i * 0.4, regInfo,
                    isCool, beatImpulse, tearActive, w, horizon
                );
            }
        }

        // =========================================================
        // 5. TIMER-B SYNC-BUZZER RASTER-TEAR STREIFEN (Zero getImageData)
        // =========================================================
        if (tearActive) {
            for (let s = 0; s < this.tearSlots.length; s++) {
                const slot = this.tearSlots[s];
                const ty = Math.floor(slot.yFrac * h);
                const th = slot.hPx;
                const tx = slot.shift > 0 ? 0 : Math.floor(w * 0.12);
                const tw = Math.floor(w * 0.88);
                const col = (s & 1) === 0 ? PAL.MAGENTA : (this.hardFlashAge < 0.12 ? PAL.WHITE : PAL.CYAN);
                // Dither-Streifen ueber Scanline-Band
                for (let dy = 0; dy < th; dy++) {
                    const rowY = ty + dy;
                    if (rowY < 0 || rowY >= h) continue;
                    const segW = Math.max(4, Math.floor(tw * 0.22));
                    fillClippedRect(ctx, tx + ((dy & 1) * 6), rowY, segW, 1, 0, 0, w, h, col);
                    fillClippedRect(ctx, w - segW - ((dy & 1) * 6), rowY, segW, 1, 0, 0, w, h, col);
                }
            }
        }

        // =========================================================
        // 6. BAYER 4x4 TRANSITION FADE (exakt 1.5 s, DOM-frei)
        // =========================================================
        if (revealRatio < 1.0) {
            bayerFadeCells(ctx, 0, 0, w, h, revealRatio, 2, PAL.BLACK);
        }
    }
}