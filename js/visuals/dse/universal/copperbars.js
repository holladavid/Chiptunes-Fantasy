// === js/visuals/dse/universal/copperbars.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: COVERS / RASTERBARS (v2.0.0 - OCS Edition)
// 100% Alpha-free. Pure hardware overdraw, no transparency blending.
// C64: Strict 16 VIC-II colors, 1px steps, mechanical Sine LUT.
// Amiga: 12-Bit OCS hex tables with dynamic expanding white cores.
// Atari ST: Hard 9-Bit step-shading. Proportional 3/4 layout preserved.
// =========================================================

import { C64_PALETTE, getNearestC64Color, quantizeAmiga12Bit, quantizeAtari9Bit, rgbToHex } from '../../utils/hardware-constraints.js';

export class Copperbars {
    constructor() {
        // Vorberechnete 256-Byte Sinus-Tabelle für den mechanischen Raster-Lauf
        this.sinLUT = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
            this.sinLUT[i] = Math.sin((i / 256) * Math.PI * 2);
        }

        // Relative Höhengewichtung zur Zentrierung
        this.heightWeights = [0.24, 0.24, 0.24, 0.24];
        
        this.barsToDraw = [
            { y: 0, h: 0, vol: 0, z: 0, pal: null },
            { y: 0, h: 0, vol: 0, z: 0, pal: null },
            { y: 0, h: 0, vol: 0, z: 0, pal: null },
            { y: 0, h: 0, vol: 0, z: 0, pal: null }
        ];

        this.sortedBars = Array(4).fill(null);
        
        this.lastT = 0;
        this.internalT = 0;
        this.smoothedSpeed = 1.0;
        this.smoothedAmplitude = 0.85;

        // Beat-Zaehler und lokale Zustandszeit ergaenzen die fortlaufende DJ-Zeit.
        this.lastState = 'idle';
        this.stateAge = 0;
        this.pattern = 0;
        this.palettePhase = 0;
        this.lastBeatCount = 0;
        this.beatDirection = 1;

        this.initialized = false;
        this.ensureInitialized();
    }

    ensureInitialized() {
        if (this.initialized) return;

        // OCS & 9-Bit Farb-Parser
        const parseOcs = (val) => {
            let r = ((val >> 8) & 15) * 17;
            let g = ((val >> 4) & 15) * 17;
            let b = (val & 15) * 17;
            return rgbToHex(r, g, b);
        };

        const parse9Bit = (val) => {
            let r = ((val >> 8) & 7) * 36;
            let g = ((val >> 4) & 7) * 36;
            let b = (val & 7) * 36;
            return rgbToHex(r, g, b);
        };

        const parseC64 = (idx) => {
            let c = C64_PALETTE[idx];
            return rgbToHex(c[0], c[1], c[2]);
        };

        // --- C64 RASTERBAR SHADING TABLES (Strict VIC-II Palette) ---
        this.c64Palettes = [
            [6, 6, 11, 14, 14, 15, 1].map(parseC64),  // Blue Theme
            [9, 2, 2, 8, 10, 10, 1].map(parseC64),    // Red Theme
            [5, 5, 12, 13, 13, 15, 1].map(parseC64)   // Green Theme
        ];

        // --- AMIGA OCS COPPERLISTS (Concentric 12-Bit Shading) ---
        this.amigaPalettes = [
            [0x002, 0x003, 0x004, 0x006, 0x008, 0x00a, 0x00c, 0x00f, 0x25f, 0x6af, 0xfff].map(parseOcs), // Blue
            [0x200, 0x300, 0x500, 0x700, 0x900, 0xb00, 0xd00, 0xf00, 0xf40, 0xf80, 0xfff].map(parseOcs), // Red/Orange
            [0x101, 0x202, 0x404, 0x606, 0x808, 0xa0a, 0xc0c, 0xf0f, 0xf4f, 0xf8f, 0xfff].map(parseOcs), // Purple/Pink
            [0x010, 0x020, 0x040, 0x060, 0x080, 0x0a0, 0x0c0, 0x0f0, 0x4f4, 0x8f8, 0xfff].map(parseOcs)  // Green
        ];

        // --- ATARI ST HARD SHIFTER SHADING (Rigid 9-Bit Steps) ---
        this.atariPalettes = [
            [0x001, 0x002, 0x003, 0x004, 0x005, 0x006, 0x007, 0x337, 0x777].map(parse9Bit), // Blue
            [0x100, 0x200, 0x300, 0x410, 0x520, 0x630, 0x740, 0x760, 0x777].map(parse9Bit), // Orange/Gold
            [0x010, 0x020, 0x030, 0x040, 0x050, 0x060, 0x070, 0x373, 0x777].map(parse9Bit)  // Green
        ];

        this.initialized = true;
    }

    // Zeichnet eine rastergetreue, palettenbasierte Copperbar (Absolut Opak / Keine CPU-Garbages!)
    drawPalettedBar(ctx, w, yCenter, shadingTable, smoothVol, scanlineHeight,
        intensity = 1, corePunch = 0, rasterWobble = 0) {
        const maxIdx = shadingTable.length - 1;

        // Lautstaerke und Afterglow begrenzen ausschliesslich den Palettenindex.
        // Dadurch verschwindet der helle Kern ohne Alpha-Mischung.
        const volumeScale = Math.max(0, Math.min(1, (0.5 + smoothVol * 0.5) * intensity));
        const activeMax = Math.floor(maxIdx * volumeScale);
        const halfHeight = maxIdx;

        for (let dy = -halfHeight; dy <= halfHeight; dy++) {
            const lookup = maxIdx - Math.abs(dy);
            let activeIdx = Math.floor(lookup * volumeScale);
            if (activeIdx > activeMax) activeIdx = activeMax;
            if (activeIdx < 0) activeIdx = 0;

            ctx.fillStyle = shadingTable[activeIdx];
            let drawX = 0;
            if (rasterWobble > 0) {
                const wobbleIdx = (Math.floor(this.internalT * 80) + dy * 6) & 255;
                drawX = Math.round(this.sinLUT[wobbleIdx] * rasterWobble);
            }
            const punch = dy === 0 ? corePunch : 0;
            const drawY = Math.floor(yCenter + dy * scanlineHeight) - punch;
            ctx.fillRect(drawX, drawY, w, scanlineHeight + punch * 2);
        }
    }

    resize(width, height) {}

    render(ctx, width, height, t, state, stateTime, metrics) {
        this.ensureInitialized();
        if (width <= 0 || height <= 0 || !isFinite(width / height)) {
            this.lastT = t;
            return;
        }
        if (state === 'idle') {
            this.lastT = t;
            this.lastState = state;
            return;
        }

        const dt = this.lastT === 0 ? 0.02 : Math.max(0, Math.min(0.1, t - this.lastT));
        this.lastT = t;
        if (this.lastState !== state) {
            this.lastState = state;
            this.stateAge = 0;
        } else {
            this.stateAge += dt;
        }

        // Formation und Copperliste wechseln nur auf einem echten Beat-Event.
        // Die abklingende Huelle bleibt fuer Nudge und Kernverdickung zustaendig.
        if (metrics.beatStarted) {
            const count = Number.isFinite(metrics.beatCount)
                ? metrics.beatCount
                : this.lastBeatCount + 1;
            this.lastBeatCount = count;
            this.beatDirection = (count & 1) ? 1 : -1;
            if (count > 0 && count % 4 === 0) {
                this.pattern = (this.pattern + 1) % 3;
                this.palettePhase = (this.palettePhase + 1) % 4;
            }
        }

        const system = metrics.system;
        const numBars = system === 'amiga' ? 4 : 3;
        const scanlineHeight = 1;
        const beat = metrics.beat?.[0] || 0;
        const fallbackTension = state === 'afterglow' ? Math.max(0, 1 - this.stateAge / 5) : 0.5;
        const tension = Math.max(0, Math.min(1,
            Number.isFinite(metrics.tensionPct) ? metrics.tensionPct : fallbackTension));

        let globalAlpha = 1.0;
        let targetSpeed = 0.85;
        let targetAmplitude = 0.82;

        if (state === 'starting') {
            globalAlpha = Math.min(1.0, stateTime / 1.5);
            targetAmplitude = globalAlpha * 0.82;
        } else if (state === 'stopping') {
            globalAlpha = Math.max(0.0, 1.0 - stateTime / 1.5);
            targetAmplitude = globalAlpha * 0.82;
        } else if (state === 'buildup') {
            targetSpeed = 1.25;
            targetAmplitude = 0.95;
        } else if (state === 'climax') {
            targetSpeed = 1.75;
            targetAmplitude = 1.08;
        } else if (state === 'afterglow') {
            targetSpeed = 0.18 + tension * 0.45;
            targetAmplitude = 0.35 + tension * 0.4;
        }

        if (globalAlpha <= 0.05) return;

        const smoothing = Math.min(1.0, dt * 5.0);
        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * smoothing;
        this.smoothedAmplitude += (targetAmplitude - this.smoothedAmplitude) * smoothing;
        this.internalT += dt * this.smoothedSpeed;

        const baseSpeed = 0.65;
        const phaseStep = (Math.PI * 2) / numBars;
        const beatNudge = Math.round(beat * (state === 'climax' ? 4 : 2));
        const amplitude = height * 0.24 * this.smoothedAmplitude;

        for (let c = 0; c < numBars; c++) {
            const smoothVol = metrics.smooth[c] || 0;
            let angle;
            if (this.pattern === 1) {
                // Gespiegelte Paare: klassische Accordion-/Mirror-Copperbars.
                angle = this.internalT * baseSpeed + (c & 1) * Math.PI + Math.floor(c / 2) * Math.PI * 0.5;
            } else if (this.pattern === 2) {
                // Eng versetzte Kaskade mit einer zweiten Interferenzwelle.
                angle = this.internalT * baseSpeed * 1.35 + c * 0.68;
            } else {
                angle = this.internalT * baseSpeed + c * phaseStep;
            }

            const lutIdx = Math.floor(angle * 256 / (Math.PI * 2)) & 255;
            let sineVal = this.sinLUT[lutIdx];
            if (this.pattern === 2 && (state === 'buildup' || state === 'climax')) {
                const interferenceIdx = (Math.floor(this.internalT * 110) + c * 47) & 255;
                sineVal = sineVal * 0.72 + this.sinLUT[interferenceIdx] * 0.28;
            }

            let yCenter = height / 2 + sineVal * amplitude;
            yCenter += (c & 1) === 0 ? beatNudge : -beatNudge;

            if (state === 'climax') {
                const twistIdx = (Math.floor(this.internalT * 96) + c * 32) & 255;
                yCenter += this.sinLUT[twistIdx] * beat * (this.pattern === 0 ? 8 : 4);
                if (this.pattern === 2) yCenter += this.beatDirection * 3;
            }
            if (this.pattern === 2 && state !== 'afterglow') {
                const rasterStep = system === 'amiga' ? 1 : 2;
                yCenter = Math.round(yCenter / rasterStep) * rasterStep;
            }

            const bar = this.barsToDraw[c];
            bar.y = yCenter;
            bar.vol = smoothVol;
            bar.z = this.sinLUT[(lutIdx + 64) & 255];
            bar.intensity = state === 'afterglow' ? 0.25 + tension * 0.75 : 1;
            bar.punch = state === 'climax' ? Math.round(beat * 2) : state === 'buildup' ? Math.round(beat) : 0;
            bar.wobble = 0;
            if (system === 'c64' && state === 'climax') {
                bar.wobble = this.pattern === 1 ? 3 : this.pattern === 2 ? 5 : 0;
            } else if (system === 'c64' && state === 'buildup' && this.pattern === 2) {
                bar.wobble = 1;
            } else if (system === 'amiga' && state === 'climax' && this.pattern === 2) {
                bar.wobble = 2;
            }

            if (state === 'afterglow') {
                // Alle Kanaele kuehlen in dieselbe blaue Copperliste ab.
                bar.pal = system === 'c64' ? this.c64Palettes[0]
                    : system === 'amiga' ? this.amigaPalettes[0]
                    : this.atariPalettes[0];
            } else if (system === 'c64') {
                bar.pal = this.c64Palettes[(c + this.palettePhase) % 3];
            } else if (system === 'amiga') {
                bar.pal = this.amigaPalettes[(c + this.palettePhase) % 4];
            } else {
                bar.pal = this.atariPalettes[(c + this.palettePhase) % 3];
            }
        }

        // Z-Buffer sortieren (Painter's Algorithm)
        for (let i = 0; i < numBars; i++) this.sortedBars[i] = this.barsToDraw[i];
        for (let i = 0; i < numBars - 1; i++) {
            for (let j = 0; j < numBars - i - 1; j++) {
                if (this.sortedBars[j].z > this.sortedBars[j + 1].z) {
                    const temp = this.sortedBars[j];
                    this.sortedBars[j] = this.sortedBars[j + 1];
                    this.sortedBars[j + 1] = temp;
                }
            }
        }

        for (let i = 0; i < numBars; i++) {
            const bar = this.sortedBars[i];
            // Stille Kanaele bleiben ein hartes, historisches Raster-Gate.
            if (bar.vol < 0.04) continue;
            this.drawPalettedBar(ctx, width, bar.y, bar.pal, bar.vol, scanlineHeight,
                bar.intensity, bar.punch, bar.wobble);
        }
    }
}