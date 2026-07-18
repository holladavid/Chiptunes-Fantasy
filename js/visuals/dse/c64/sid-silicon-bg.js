// === js/visuals/dse/c64/sid-silicon-bg.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: SID 6581 MICROVERSE (BACKGROUND)
// 100% Anti-Aliasing & Alpha-free. Pure fillRect() integer rendering.
// Calibrated C64 mind-set: Register-triggered signal packets (Freq, PW, ADSR),
// active internal phase/LFSR lockstep simulators, authentic ADSR tracers,
// and VIC-II comb-resonance rasters. Completely asymmetric and organic.
// =========================================================

import { C64_PALETTE, rgbToHex, drawAliasedLine } from '../../utils/hardware-constraints.js';

const PAL = C64_PALETTE.map(c => rgbToHex(c[0], c[1], c[2]));

// Statisches Backup-Register für Idle-Messungen
const idleRegs = new Uint8Array(32);

export class SidSiliconBg {
    constructor() {
        this.name = 'SID 6581 Microverse';
        this.computerType = ['c64'];
        this.placementType = 'background';
        
        this.offscreen = document.createElement('canvas');
        this.ctx = this.offscreen.getContext('2d', { alpha: false });
        
        this.lastT = 0;
        this.internalT = 0;

        // Zero-Allocation Register-Cache
        this.lastRegs = new Uint8Array(32);

        // Physische, lokale SID-Emulatoren (Phase & 23-Bit LFSR pro Voice)
        this.phase = new Float32Array(3);
        this.lfsr = new Uint32Array(3);
        this.lfsr.fill(0x7FFFFF); // Hardware-Seed des 6581

        // Pre-allozierte Signal-Elektronen pro Bus (Max 6 Pakete pro Voice)
        this.electrons = Array.from({ length: 3 }, () => Array.from({ length: 6 }, () => ({
            pos: 0.0,
            active: false,
            speed: 1.5,
            type: 0 // 0: Freq (Fast), 1: PW (Medium), 2: ADSR (Slow)
        })));
    }

    resize(width, height) {}

    // Hilfsfunktion für 100% harte Pixel-Linien
    drawHLine(ctx, x, y, len, colIdx) {
        ctx.fillStyle = PAL[colIdx];
        ctx.fillRect(x | 0, y | 0, len | 0, 1);
    }
    drawVLine(ctx, x, y, len, colIdx) {
        ctx.fillStyle = PAL[colIdx];
        ctx.fillRect(x | 0, y | 0, 1, len | 0);
    }

    // Trigger für ein neues Datenpaket auf Bus (v) aufgeteilt nach Registergruppe
    triggerElectron(v, type) {
        for (let e = 0; e < 6; e++) {
            let el = this.electrons[v][e];
            if (!el.active) {
                el.active = true;
                el.pos = 0.0;
                el.type = type;
                if (type === 0) el.speed = 2.6;       // Freq ist pfeilschnell
                else if (type === 1) el.speed = 1.8;  // PW ist moderat
                else el.speed = 1.0;                  // ADSR fließt ruhig
                break;
            }
        }
    }

    // Zeichnet ein Signalpaket entlang der orthogonalen Manhattan-Leitungen
    drawElectron(ctx, startX, startY, endX, endY, pos, type) {
        const midX = Math.floor(startX + (endX - startX) * 0.55);
        const totalDist = (midX - startX) + Math.abs(endY - startY) + (endX - midX);
        const curDist = pos * totalDist;

        let curX = startX;
        let curY = startY;

        if (curDist < (midX - startX)) {
            // Segment 1 (Horizontal)
            curX = startX + curDist;
            curY = startY;
        } else if (curDist < (midX - startX) + Math.abs(endY - startY)) {
            // Segment 2 (Vertikal)
            curX = midX;
            let vDist = curDist - (midX - startX);
            curY = startY + (startY < endY ? vDist : -vDist);
        } else {
            // Segment 3 (Horizontal)
            let hDist = curDist - (midX - startX) - Math.abs(endY - startY);
            curX = midX + hDist;
            curY = endY;
        }

        // Subpixel-Killer: Erzwingt knallharte Koordinaten
        curX |= 0;
        curY |= 0;

        // Draw unterschiedliche Paketformen je nach Registergruppe (Trick 11)
        if (type === 0) {
            // Freq-Write: Scharfes weißes 1x1 Pixel
            ctx.fillStyle = PAL[1];
            ctx.fillRect(curX, curY, 1, 1);
        } else if (type === 1) {
            // PW-Write: Dickes, blockiges 2x2 Cyan-Paket
            ctx.fillStyle = PAL[3];
            ctx.fillRect(curX - 1, curY - 1, 2, 2);
        } else {
            // ADSR-Write: Orangefarbene 3x1 Daten-Leiterbahn
            ctx.fillStyle = PAL[8];
            ctx.fillRect(curX - 1, curY, 3, 1);
        }
    }

    // Zeichnet die schwingende Wellenform gekoppelt an den ECHTEN internen SID-Zustand (Nerd Gold!)
    drawOscillatingCore(ctx, x, y, w, h, ctrl, pw12, phase, lfsr, vol) {
        // Subpixel-Killer: Strikte Integer-Zuweisung für fillRect
        x |= 0; y |= 0; w |= 0; h |= 0;

        ctx.fillStyle = PAL[0]; // Clear (Black)
        ctx.fillRect(x, y, w, h);

        if (vol < 0.05) {
            this.drawHLine(ctx, x, y + h/2, w, 12); // Flatline (Grey 12)
            return;
        }

        // Silizium-Transistor-Felder im Hintergrund (Trick 9)
        ctx.fillStyle = PAL[11]; // Dark Grey
        for (let px = x + 4; px < x + w - 4; px += 8) {
            if ((px * 3 + y) % 7 < 4) {
                ctx.fillRect(px, y + 3, 2, h - 6);
            }
        }

        ctx.fillStyle = PAL[1]; // White Waveform
        if (ctrl & 128) {
            // NOISE: Zeichnet das ECHTE aktuelle 23-Bit-LFSR-Muster in chunky Blöcken!
            for (let px = x + 2; px < x + w - 2; px += 2) {
                let bitIdx = (px - x) % 23;
                let isBitOn = (lfsr & (1 << bitIdx)) !== 0;
                if (isBitOn) {
                    ctx.fillRect(px, y + 4 + (px % (h - 8)), 2, 2); // 2x2 C64-Pixel
                }
            }
        } else if (ctrl & 64) {
            // PULSE: Schreibt die exakt programmierte Pulsbreite (pw12) auf die Matrikel!
            let pwNorm = pw12 / 4095.0;
            let highLimit = Math.floor(w * pwNorm);
            
            for (let px = x + 2; px < x + w - 2; px++) {
                let localX = px - (x + 2);
                let isHigh = localX < highLimit;
                ctx.fillRect(px, isHigh ? (y + 4) : (y + h - 6), 1, 1);
                if (localX === highLimit) {
                    ctx.fillRect(px, y + 4, 1, h - 10);
                }
            }
        } else if (ctrl & 32) {
            // SAWTOOTH: Sägezahn gekoppelt an die ECHTE interpolierte CPU-Phase
            for (let px = x + 2; px < x + w - 2; px++) {
                let localX = px - (x + 2);
                let localPhase = (phase + localX / w) % 1.0;
                let py = Math.floor(y + 4 + localPhase * (h - 9));
                ctx.fillRect(px, py, 1, 1);
            }
        } else if (ctrl & 16) {
            // TRIANGLE: Dreieckswelle gekoppelt an die Phase
            for (let px = x + 2; px < x + w - 2; px++) {
                let localX = px - (x + 2);
                let localPhase = (phase + localX / w) % 1.0;
                let py;
                if (localPhase < 0.5) py = y + 4 + (localPhase * 2.0) * (h - 9);
                else py = y + h - 5 - ((localPhase - 0.5) * 2.0) * (h - 9);
                ctx.fillRect(px, Math.floor(py), 1, 1);
            }
        } else {
            // Keine Wellenform selektiert -> Sanfte Sinuswelle
            for (let px = x + 2; px < x + w - 2; px++) {
                let localX = px - (x + 2);
                let angle = (localX / w) * Math.PI * 4 + phase * Math.PI * 2;
                let py = y + h/2 + Math.sin(angle) * (h * 0.25);
                ctx.fillRect(px, Math.floor(py), 1, 1);
            }
        }
    }

    // Zeichnet den ECHTEN Hüllkurven-Pfad (Bresenham-Linien ohne Weichzeichnung!)
    drawAdsrBlock(ctx, x, y, w, h, gate, envVal, sr) {
        const x0 = x | 0;
        const y0 = y | 0;
        const wVal = w | 0;
        const hVal = h | 0;

        const xA = Math.floor(x0 + wVal * 0.20);
        const yA = y0;
        
        const xD = Math.floor(x0 + wVal * 0.45);
        const yD = Math.floor(y0 + hVal * 0.4);
        
        const xS = Math.floor(x0 + wVal * 0.75);
        const yS = yD;
        
        const xR = x0 + wVal;
        const yR = y0 + hVal;

        // Draw 100% scharfe Bresenham-Linien
        drawAliasedLine(ctx, x0, y0 + hVal, xA, yA, PAL[12]); // Attack
        drawAliasedLine(ctx, xA, yA, xD, yD, PAL[12]);       // Decay
        drawAliasedLine(ctx, xD, yD, xS, yS, PAL[12]);       // Sustain
        drawAliasedLine(ctx, xS, yS, xR, yR, PAL[12]);       // Release

        let dotX = x0;
        let dotY = y0 + hVal;

        // Echtzeit-Mapping des Envelope-Wertes auf den realen ADSR-Flankenverlauf
        if (gate) {
            let sustainLevel = (sr >> 4) / 15.0;
            if (envVal < 0.98 && envVal > sustainLevel) {
                // Decay Flanke
                let t = (1.0 - envVal) / (1.0 - sustainLevel);
                dotX = x0 + (0.20 + t * 0.25) * wVal;
                dotY = y0 + hVal - (envVal * hVal);
            } else if (envVal <= sustainLevel + 0.05) {
                // Sustain Plateau
                dotX = x0 + 0.60 * wVal;
                dotY = y0 + hVal - (envVal * hVal);
            } else {
                // Attack Rampe
                dotX = x0 + (envVal * 0.20) * wVal;
                dotY = y0 + hVal - (envVal * hVal);
            }
        } else {
            // Release Rampe
            let t = 1.0 - envVal;
            dotX = x0 + (0.75 + t * 0.25) * wVal;
            dotY = y0 + hVal - (envVal * hVal);
        }

        ctx.fillStyle = PAL[1]; // White dot (1)
        ctx.fillRect(Math.floor(dotX - 1), Math.floor(dotY - 1), 3, 3);
    }

    // Zeichnet den interaktiven VCF-Block (Resonanz & Cutoff)
    drawVcfBlock(ctx, x, y, w, h, cutoffReg, resReg) {
        x |= 0; y |= 0; w |= 0; h |= 0; // Subpixel-Killer

        ctx.fillStyle = PAL[0]; // Clear (Black)
        ctx.fillRect(x, y, w, h);

        // Silizium-Leiterbahnen
        ctx.fillStyle = PAL[11]; // Dark Grey
        for (let py = y + 4; py < y + h - 4; py += 4) {
            this.drawHLine(ctx, x + 4, py, w - 8, 11);
        }

        // Frequenz-Nadel wandert weich nach Cutoff-Register
        let normCut = cutoffReg / 2047.0;
        let cutX = Math.floor(x + 4 + normCut * (w - 12));
        
        ctx.fillStyle = PAL[10]; // Light Red (10)
        ctx.fillRect(cutX - 1, y + 4, 3, h - 8);

        // VIC-II RESORASTER: Konzentrische Ringe weichen einem unruhigen Rasterkamm (||||||)
        ctx.fillStyle = PAL[7]; // Yellow (7)
        let spacing = Math.max(2, 16 - resReg); // Raster-Weite zieht sich mit Resonanz zusammen!
        for (let rx = x + 4; rx < x + w - 4; rx += spacing) {
            ctx.fillRect(Math.floor(rx), y + 6, 1, h - 12);
        }
    }

    // Isometrischer, asymmetrischer Chip-Block
    drawAsymmetricBlock(ctx, x, y, w, h, isVcf) {
        x |= 0; y |= 0; w |= 0; h |= 0; // Subpixel-Killer
        const colMain = isVcf ? 4 : 14; // Purple oder Light Blue
        
        // Schatten (Hard Drop)
        ctx.fillStyle = PAL[0]; // Black
        ctx.fillRect(x + 3, y + 3, w, h);

        // Platinengehäuse
        ctx.fillStyle = PAL[colMain];
        ctx.fillRect(x, y, w, h);

        // Harte Lichtkanten (White & Light Grey)
        this.drawHLine(ctx, x, y, w, 1);
        this.drawVLine(ctx, x, y, h, 1);
        this.drawHLine(ctx, x + 1, y + h - 1, w - 1, 15);
        this.drawVLine(ctx, x + w - 1, y + 1, h - 1, 15);
    }

    render(mainCtx, width, height, t, state, stateTime, metrics) {
        if (state === 'idle') { this.lastT = t; return; }
        let dt = this.lastT === 0 ? 0.016 : t - this.lastT;
        this.lastT = t;

        const TARGET_HEIGHT = 200;
        const aspect = width / height;
        const offW = Math.floor(TARGET_HEIGHT * aspect);
        const offH = TARGET_HEIGHT;

        if (this.offscreen.width !== offW || this.offscreen.height !== TARGET_HEIGHT) {
            this.offscreen.width = offW;
            this.offscreen.height = TARGET_HEIGHT;
        }

        const regs = metrics.regs || idleRegs;
        const vols = metrics.smooth;

        let globalAlpha = 1.0;
        let speedMult = 1.0;

        if (state === 'starting') { globalAlpha = Math.min(1.0, stateTime / 1.5); } 
        else if (state === 'stopping') { globalAlpha = Math.max(0.0, 1.0 - (stateTime / 1.5)); } 
        else if (state === 'buildup') { speedMult = 1.5; } 
        else if (state === 'climax') { speedMult = 2.5; }

        this.internalT += dt * speedMult;
        const time = this.internalT;

        const ctx = this.ctx;
        ctx.imageSmoothingEnabled = false;

        // =========================================================
        // 1. BACKGROUND: SILICON MICRO-GATES (Substratschicht)
        // =========================================================
        ctx.fillStyle = PAL[0]; // Black Out
        ctx.fillRect(0, 0, offW, 200);

        const off1X = (time * 8) % 16;
        const off1Y = (time * 4) % 16;
        ctx.fillStyle = PAL[11]; // Dark Grey (11)
        for (let y = -(off1Y | 0); y < 200; y += 16) {
            for (let x = -(off1X | 0); x < offW; x += 16) {
                ctx.fillRect(x | 0, y | 0, 1, 1); // Winzige Gate-Arrays
            }
        }

        // =========================================================
        // 2. THE CHIP CORES (Asymmetry & Detailing)
        // =========================================================
        // Subpixel-Killer: cx und span MÜSSEN ganzzahlig sein!
        const cx = Math.floor(offW / 2);
        const span = Math.floor(Math.min(110, offW * 0.35)); 
        
        const oscX = Math.floor(cx - span);
        // OPTIMIERTES LAYOUT: Mathematisch perfekte Symmetrie für bolzengerades Routing!
        // Stimme 2 sitzt auf 94 (Ausgang auf 100), Abstand ist exakt 59 Pixel.
        const oscY = [35, 94, 153]; 
        const oscW = 46;

        const vcfX = Math.floor(cx + span * 0.63);
        const vcfW = 56;
        const vcfH = 64;
        // OPTIMIERTES LAYOUT: Perfekte vertikale Zentrierung für symmetrisches Bus-Routing!
        const vcfY = Math.floor((offH - vcfH) / 2);

        // Leiterbahnen im Hintergrund zeichnen (Dunkles Violett 6)
        ctx.fillStyle = PAL[6];
        for (let i = 0; i < 3; i++) {
            // Hauptbusse (Kompaktes, lückenloses Routing zum VCF)
            const midX = Math.floor(oscX + oscW + (vcfX - (oscX + oscW)) * 0.55);
            const yStart = oscY[i] + 6; // Exakt mittig aus dem neuen 40px Gehäuse
            const yEnd = vcfY + 20 + i * 12;

            ctx.fillRect(oscX + oscW, yStart, midX - (oscX + oscW), 2);
            
            // +2 an der Höhe schließt die "Ecken" der Leitungen perfekt ab
            const vY = Math.min(yStart, yEnd);
            const vH = Math.abs(yStart - yEnd) + 2;
            ctx.fillRect(midX, vY, 2, vH);
            
            ctx.fillRect(midX, yEnd, vcfX - midX, 2);
        }

        // =========================================================
        // 3. REGISTER ACTIVITY & DATA PACKETS (Elektronenströme)
        // =========================================================
        if (metrics.regs) {
            for (let v = 0; v < 3; v++) {
                let base = v * 7;
                
                if (regs[base] !== this.lastRegs[base] || regs[base+1] !== this.lastRegs[base+1]) {
                    this.triggerElectron(v, 0);
                }
                if (regs[base+2] !== this.lastRegs[base+2] || regs[base+3] !== this.lastRegs[base+3]) {
                    this.triggerElectron(v, 1);
                }
                if (regs[base+5] !== this.lastRegs[base+5] || regs[base+6] !== this.lastRegs[base+6]) {
                    this.triggerElectron(v, 2);
                }
            }
            
            // Register-Zustand sichern
            for (let i = 0; i < 32; i++) {
                this.lastRegs[i] = metrics.regs[i];
            }
        }

        for (let v = 0; v < 3; v++) {
            for (let e = 0; e < 6; e++) {
                let el = this.electrons[v][e];
                if (el.active) {
                    el.pos += dt * el.speed;
                    if (el.pos >= 1.0) {
                        el.active = false;
                        el.pos = 0.0;
                    } else {
                        // Fließweg der Elektronen exakt an das neue Gehäuse-Zentrum (oscY[v] + 6) gebunden!
                        this.drawElectron(ctx, oscX + oscW, oscY[v] + 6, vcfX, vcfY + 20 + v * 12, el.pos, el.type);
                    }
                }
            }
        }

        // =========================================================
        // 4. THE WAVEFORM CHIP MODULES
        // =========================================================
        for (let v = 0; v < 3; v++) {
            const ctrl = regs[v * 7 + 4];
            const pw12 = regs[v * 7 + 2] | ((regs[v * 7 + 3] & 15) << 8);
            const freq = regs[v * 7] | (regs[v * 7 + 1] << 8);
            const sr = regs[v * 7 + 6];
            const envVal = vols[v]; // Hüllkurvenwert (0.0 bis 1.0)

            this.phase[v] = (this.phase[v] + freq * dt * 0.15) % 1.0;
            
            let overran = (this.phase[v] < (freq * dt * 0.15));
            if (overran && (ctrl & 128)) {
                let bit = ((this.lfsr[v] >> 22) ^ (this.lfsr[v] >> 17)) & 1;
                this.lfsr[v] = ((this.lfsr[v] << 1) & 0x7FFFFF) | bit;
            }

            // Chip Gehäuse (Kompakt! Höhe 40 statt 64, Y-Center verschoben)
            this.drawAsymmetricBlock(ctx, oscX - 32, oscY[v] - 14, oscW + 36, 40, false);

            // Active Waveform Core (Höhe 28, perfekt eingefasst)
            this.drawOscillatingCore(ctx, oscX - 4, oscY[v] - 8, oscW + 4, 28, ctrl, pw12, this.phase[v], this.lfsr[v], envVal);

            // ADSR Live Flanken-Tracer
            let gate = (ctrl & 1) !== 0;
            this.drawAdsrBlock(ctx, oscX - 26, oscY[v] + 2, 18, 12, gate, envVal, sr);
        }

        const cutoffReg = (regs[21] & 7) | (regs[22] << 3);
        const resReg = regs[23] >> 4;
        this.drawAsymmetricBlock(ctx, vcfX - 6, vcfY - 12, vcfW + 12, vcfH + 24, true);
        this.drawVcfBlock(ctx, vcfX, vcfY, vcfW, vcfH, cutoffReg, resReg);

        if (state === 'climax' && metrics.beat[0] > 0.85) {
            ctx.fillStyle = PAL[1]; 
            ctx.fillRect(0, 0, offW, 200);
        }

        // =========================================================
        // BLIT TO MAIN CANVAS
        // Wir entfernen den fehlerhaften imageSmoothingEnabled=true Aufruf am Ende,
        // um den RetroCtx nicht aus Versehen aufzuweichen!
        // =========================================================
        mainCtx.globalAlpha = globalAlpha;
        mainCtx.imageSmoothingEnabled = false; 
        mainCtx.drawImage(this.offscreen, 0, 0, width, height);
        mainCtx.globalAlpha = 1.0;
    }
}