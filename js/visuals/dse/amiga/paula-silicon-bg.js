// === js/visuals/dse/amiga/paula-silicon-bg.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: PAULA 8364 MICROVERSE (v2.3.0 - DMA Edition)
// 100% Alpha & Anti-Aliasing free! Employs a direct-memory Software 
// Rasterizer (ImageData) for instant Bresenham pre-compilation 
// without browser API bottlenecks. 
// =========================================================

import { quantizeAmiga12Bit, rgbToHex } from '../../../visuals/utils/hardware-constraints.js';

export class PaulaSiliconBg {
    constructor() {
        this.name = 'Paula 8364 Microverse';
        this.computerType = ['amiga'];
        this.placementType = 'background';
        
        this.offscreen = document.createElement('canvas');
        this.ctx = this.offscreen.getContext('2d', { alpha: false });

        this.moireCanvas = document.createElement('canvas');
        this.climaxMoireCanvas = document.createElement('canvas');
        this.gridCanvases = Array.from({ length: 16 }, () => document.createElement('canvas'));
        
        this.lastT = 0;
        this.internalT = 0;

        this.skyPalettes = [];
        this.stars = [];
        this.leftFades = [];
        this.rightFades = [];

        this.lfsrSeed = 0xACE1;
        this.initialized = false;
        this.ensureInitialized();
    }

    ensureInitialized() {
        if (this.initialized) return;

        for (let i = 0; i < 20; i++) {
            this.stars.push({
                x: this.nextLfsrFloat(),
                y: this.nextLfsrFloat() * 0.5,
                phase: this.nextLfsrFloat() * 10
            });
        }

        for (let t = 0; t <= 10; t++) {
            let tension = t / 10.0;
            let pal = [];
            for (let i = 0; i < 16; i++) {
                let r, g, b, pct = i / 15.0; 
                if (tension < 0.5) {
                    r = Math.floor(pct * 80 + tension * 100); g = Math.floor(pct * 20); b = Math.floor(50 + pct * 150);
                } else {
                    r = Math.floor(pct * 150 + tension * 105); g = Math.floor(pct * 120 * tension); b = Math.floor(50 + (1.0 - pct) * 80);
                }
                pal.push(rgbToHex(...quantizeAmiga12Bit(r, g, b)));
            }
            this.skyPalettes.push(pal);
        }

        this.mFront = rgbToHex(...quantizeAmiga12Bit(34, 34, 68));
        this.mHighlight = rgbToHex(...quantizeAmiga12Bit(68, 68, 102));
        this.mShadow = rgbToHex(...quantizeAmiga12Bit(17, 17, 34));

        this.floorColor = rgbToHex(...quantizeAmiga12Bit(5, 5, 17));
        this.whiteColor = rgbToHex(...quantizeAmiga12Bit(255, 255, 255));
        this.reflectionColor = rgbToHex(...quantizeAmiga12Bit(255, 119, 0));
        this.glitchColor = rgbToHex(...quantizeAmiga12Bit(255, 0, 255));
        this.glitchColor2 = rgbToHex(...quantizeAmiga12Bit(0, 255, 0));

        for (let i = 0; i < 16; i++) {
            let pct = i / 15.0;
            this.leftFades.push(rgbToHex(...quantizeAmiga12Bit(0, Math.floor(50 + pct * 200), 255)));
            this.rightFades.push(rgbToHex(...quantizeAmiga12Bit(Math.floor(255 * pct), Math.floor(50 + pct * 100), 0)));
        }

        this.initialized = true;
    }

    nextLfsr() {
        let bit = ((this.lfsrSeed >> 0) ^ (this.lfsrSeed >> 2) ^ (this.lfsrSeed >> 3) ^ (this.lfsrSeed >> 5)) & 1;
        this.lfsrSeed = (this.lfsrSeed >> 1) | (bit << 15);
        return this.lfsrSeed;
    }

    nextLfsrFloat() { return this.nextLfsr() / 65535.0; }

    // =========================================================
    // DIRECT-MEMORY SOFTWARE RASTERIZER (Zero API Overhead!)
    // Plottet Bresenham und Kreise direkt als Bytes ins RAM. 
    // Garantiert 100% Aliasing bei maximaler Geschwindigkeit.
    // =========================================================
    rebuildResizedCanvases(offW, offH, horizon) {
        
        // Helper: Hex String (#RRGGBB) zu RGBA Bytes parsen
        const hexToRgba = (hex) => ({
            r: parseInt(hex.slice(1, 3), 16),
            g: parseInt(hex.slice(3, 5), 16),
            b: parseInt(hex.slice(5, 7), 16),
            a: 255
        });

        // 1. Moiré-Kreise Software Renderer
        const rMax = 200;
        const moireSize = rMax * 2;
        
        const drawSoftwareCircles = (canvas, colorHex) => {
            canvas.width = moireSize; canvas.height = moireSize;
            const ctx = canvas.getContext('2d');
            let imgData = ctx.createImageData(moireSize, moireSize);
            let data = imgData.data;
            let c = hexToRgba(colorHex);
            
            const setPixel = (x, y) => {
                if (x < 0 || x >= moireSize || y < 0 || y >= moireSize) return;
                let idx = (y * moireSize + x) * 4;
                data[idx] = c.r; data[idx+1] = c.g; data[idx+2] = c.b; data[idx+3] = c.a;
            };

            const drawMidpointCircle = (xc, yc, r) => {
                let x = 0, y = r, d = 3 - 2 * r;
                while (y >= x) {
                    setPixel(xc + x, yc + y); setPixel(xc - x, yc + y);
                    setPixel(xc + x, yc - y); setPixel(xc - x, yc - y);
                    setPixel(xc + y, yc + x); setPixel(xc - y, yc + x);
                    setPixel(xc + y, yc - x); setPixel(xc - y, yc - x);
                    x++;
                    if (d > 0) { y--; d = d + 4 * (x - y) + 10; } 
                    else { d = d + 4 * x + 6; }
                }
            };

            for (let r = 10; r < rMax; r += 14) drawMidpointCircle(rMax, rMax, r);
            ctx.putImageData(imgData, 0, 0); // Einziger Grafik-API Aufruf!
        };

        drawSoftwareCircles(this.moireCanvas, rgbToHex(...quantizeAmiga12Bit(0, 140, 255)));
        drawSoftwareCircles(this.climaxMoireCanvas, rgbToHex(...quantizeAmiga12Bit(255, 100, 0)));

        // 2. 3D Grid Floor Software Renderer
        const zMax = 400, zStep = 16, fov = 150, camY = 38;
        const gridH = offH - horizon;
        
        if (gridH <= 0 || offW <= 0) return;

        for (let f = 0; f < 16; f++) {
            let gCanvas = this.gridCanvases[f];
            gCanvas.width = offW; gCanvas.height = gridH;
            let gCtx = gCanvas.getContext('2d');
            
            let imgData = gCtx.createImageData(offW, gridH);
            let data = imgData.data;
            let bg = hexToRgba(this.floorColor);
            let ln = hexToRgba(rgbToHex(...quantizeAmiga12Bit(0, 140, 255)));

            // High-Speed Background Fill
            for (let i = 0; i < data.length; i += 4) {
                data[i] = bg.r; data[i+1] = bg.g; data[i+2] = bg.b; data[i+3] = bg.a;
            }

            const setPixel = (x, y) => {
                if (x < 0 || x >= offW || y < 0 || y >= gridH) return;
                let idx = (y * offW + x) * 4;
                data[idx] = ln.r; data[idx+1] = ln.g; data[idx+2] = ln.b; data[idx+3] = ln.a;
            };

            const drawBresenham = (x0, y0, x1, y1) => {
                x0 = Math.floor(x0); y0 = Math.floor(y0);
                x1 = Math.floor(x1); y1 = Math.floor(y1);
                let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
                let dy = Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
                let err = (dx > dy ? dx : -dy) / 2;
                while (true) {
                    setPixel(x0, y0);
                    if (x0 === x1 && y0 === y1) break;
                    let e2 = err;
                    if (e2 > -dx) { err -= dy; x0 += sx; }
                    if (e2 < dy) { err += dx; y0 += sy; }
                }
            };

            let scrollZ = f;
            for (let z = zMax; z >= zStep; z -= zStep) {
                let pZ = z - scrollZ;
                if (pZ < 2.5) continue;
                let py = Math.floor((camY * fov) / pZ);
                if (py > gridH) continue;
                // Turboschnelle Horizontal-Linie direkt im RAM
                for (let px = 0; px < offW; px++) setPixel(px, py);
            }

            const xRange = Math.max(400, offW * 1.5);
            const cx = offW / 2;
            for (let x = -xRange; x <= xRange; x += 32) {
                let startZ = zStep - scrollZ;
                if (startZ < 2.5) startZ = 2.5;
                let pxStart = cx + (x * fov) / startZ;
                let pyStart = (camY * fov) / startZ;
                let pxEnd = cx + (x * fov) / zMax;
                let pyEnd = (camY * fov) / zMax;
                drawBresenham(pxStart, pyStart, pxEnd, pyEnd);
            }

            gCtx.putImageData(imgData, 0, 0); // BAM! Im Bruchteil einer Millisekunde aufs Canvas!
        }
    }

    render(mainCtx, width, height, t, state, stateTime, metrics) {
        this.ensureInitialized();

        if (state === 'idle') { this.lastT = t; return; }
        
        if (width <= 0 || height <= 0) return; 

        let dt = this.lastT === 0 ? 0.016 : t - this.lastT;
        this.lastT = t;

        const TARGET_HEIGHT = 256;
        const aspect = width / height;

        if (!isFinite(aspect) || aspect <= 0) return;

        const offW = Math.floor(TARGET_HEIGHT * aspect);
        const offH = TARGET_HEIGHT;

        const horizon = Math.floor(offH * 0.55); 
        if (this.offscreen.width !== offW || this.offscreen.height !== offH) {
            this.offscreen.width = offW;
            this.offscreen.height = offH;
            this.rebuildResizedCanvases(offW, offH, horizon);
        }

        const beat = metrics.beat[0]; 
        const tension = metrics.tensionPct; 
        const vols = metrics.smooth; 

        let globalAlpha = 1.0;
        let speedMult = 1.0;
        if (state === 'starting') { globalAlpha = Math.min(1.0, stateTime / 1.5); } 
        else if (state === 'stopping') { globalAlpha = Math.max(0.0, 1.0 - (stateTime / 1.5)); } 
        else if (state === 'buildup') { speedMult = 1.8; } 
        else if (state === 'climax') { speedMult = 3.0; }

        this.internalT += dt * speedMult;
        const time = this.internalT;

        const ctx = this.ctx;
        ctx.imageSmoothingEnabled = false;
        const cx = offW / 2; 

        let palIdx = Math.floor(tension * 10);
        if (palIdx > 10) palIdx = 10;
        const activeSkyPalette = this.skyPalettes[palIdx];

        const bandH = Math.ceil(horizon / 16);
        for (let i = 0; i < 16; i++) {
            ctx.fillStyle = activeSkyPalette[i];
            ctx.fillRect(0, i * bandH, offW, bandH);
        }

        const starColors = ['#ffffff', '#ffff00', '#ff8800', '#0055ff'];
        for (let i = 0; i < this.stars.length; i++) {
            let s = this.stars[i];
            let sx = Math.floor(s.x * offW);
            let sy = Math.floor(s.y * horizon);
            let cIdx = Math.floor(time * 5.0 + s.phase) % 4;
            ctx.fillStyle = starColors[cIdx];
            ctx.fillRect(sx, sy, 1, 1);
        }

        if (tension > 0.2) {
            const intensity = (tension - 0.2) / 0.8; 
            const cx1 = Math.floor(cx + Math.sin(time) * (40 + intensity * 40));
            const cy1 = Math.floor(70 + Math.cos(time * 1.3) * 30);
            const cx2 = Math.floor(cx + Math.sin(time * 1.1 + Math.PI) * (40 + intensity * 40));
            const cy2 = Math.floor(70 + Math.cos(time * 0.9 + Math.PI) * 30);
            
            const rMax = 200;
            let activeMoire = (state === 'climax') ? this.climaxMoireCanvas : this.moireCanvas;
            
            ctx.drawImage(activeMoire, cx1 - rMax, cy1 - rMax);
            ctx.drawImage(activeMoire, cx2 - rMax, cy2 - rMax);
        }

        let scrollZ = (time * 150) % 16;
        let fIdx = Math.floor(scrollZ);
        ctx.drawImage(this.gridCanvases[fIdx], 0, horizon);

        if (this.nextLfsrFloat() < 0.35) {
            let nx = Math.floor(this.nextLfsrFloat() * offW);
            let ny = horizon + 2 + Math.floor(this.nextLfsrFloat() * (offH - horizon - 2));
            ctx.fillStyle = (this.nextLfsrFloat() > 0.5) ? this.whiteColor : this.horizonLineColor;
            ctx.fillRect(nx, ny, 2, 1);
        }

        const span = Math.min(100, offW * 0.25); 
        const dmaX = [cx - span, cx + span * 0.35, cx + span, cx - span * 0.35];

        for (let i = 0; i < 4; i++) {
            let x = Math.floor(dmaX[i]);
            let vol = vols[i];
            let isLeft = (i === 0 || i === 3);

            const baseW = 24;
            const baseH = 20 + Math.floor(vol * 15);
            const baseY = horizon;

            ctx.fillStyle = this.mShadow;
            ctx.fillRect(x - baseW/2 - 4, baseY - 2, baseW + 8, 2);
            
            ctx.fillStyle = this.mFront;
            ctx.fillRect(x - baseW/2, baseY - baseH, baseW, baseH - 2);
            
            ctx.fillStyle = this.mHighlight; 
            ctx.fillRect(x - baseW/2, baseY - baseH, 2, baseH - 2);
            
            ctx.fillStyle = this.mShadow;    
            ctx.fillRect(x + baseW/2 - 2, baseY - baseH, 2, baseH - 2);
            
            ctx.fillStyle = this.mHighlight; 
            ctx.fillRect(x - baseW/2, baseY - baseH, baseW, 2);

            let fadeArray = isLeft ? this.leftFades : this.rightFades;
            let volIdx = Math.floor(vol * 15);
            ctx.fillStyle = fadeArray[volIdx];
            ctx.fillRect(x - 6, baseY - baseH + 6, 12, 12);

            let fetchSpeed = 40 + vol * 150 + tension * 100;
            let numBlocks = Math.floor(vol * 8) + (tension > 0.5 ? 3 : 1);
            
            for (let b = 0; b < numBlocks; b++) {
                let yOffset = (time * fetchSpeed + b * 25) % horizon;
                let blockY = (baseY - baseH) - yOffset;
                
                if (blockY < 0) continue; 
                
                let jitterX = 0;
                if (tension > 0.7 && vol > 0.4) {
                    jitterX = Math.floor((this.nextLfsrFloat() - 0.5) * 6 * tension);
                }

                let hPct = blockY / horizon; 
                let blockVolIdx = Math.floor(volIdx * hPct);
                
                ctx.fillStyle = fadeArray[blockVolIdx];
                ctx.fillRect(x - 5 + jitterX, Math.floor(blockY), 10, Math.max(3, Math.floor(vol * 12)));
            }

            if (state === 'climax' && beat > 0.3 && vol > 0.3) {
                let beamYStart = 0;
                let beamYEnd = baseY - baseH;
                
                ctx.fillStyle = this.whiteColor;
                for (let beamY = beamYStart; beamY < beamYEnd; beamY += 4) {
                    if ((beamY + Math.floor(time * 50)) % 8 < 4) ctx.fillRect(x - 4, beamY, 8, 2);
                }
                
                ctx.fillStyle = this.reflectionColor;
                for (let beamY = beamYStart; beamY < beamYEnd; beamY += 4) {
                    if ((beamY + Math.floor(time * 50)) % 8 >= 4) ctx.fillRect(x - 4, beamY, 8, 2);
                }
            }
        }

        if (state !== 'idle' && this.nextLfsrFloat() < 0.03) {
            let gx = Math.floor(this.nextLfsrFloat() * offW);
            let gy = Math.floor(this.nextLfsrFloat() * offH);
            ctx.fillStyle = this.glitchColor; 
            ctx.fillRect(gx, gy, 16, 2);
            ctx.fillStyle = this.glitchColor2; 
            ctx.fillRect(gx + 4, gy + 2, 8, 2);
        }

        mainCtx.globalAlpha = globalAlpha;
        mainCtx.imageSmoothingEnabled = false; 
        mainCtx.drawImage(this.offscreen, 0, 0, width, height);
        mainCtx.imageSmoothingEnabled = true; 
        mainCtx.globalAlpha = 1.0;
    }
}