// === js/visuals/dse/amiga/retro-sunset.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: AMIGA RETRO SUNSET (v3.1.0 - Polish Milestone)
// 100% Alpha-free! Features discrete beat counters, palette-accurate
// clouds, Copper-Sun raster gaps, fixed-interval duties,
// narrow water-shimmer ripples, and a 20s twinkling big star.
// =========================================================

import { quantizeAmiga12Bit, rgbToHex, fillAliasedCircle, drawAliasedLine } from '../../utils/hardware-constraints.js';

export class AmigaRetroSunset {
    constructor() {
        this.internalT = 0;
        this.waterT = 0;
        this.lastT = 0;

        // Diskrete Coder-Variablen
        this.beatCounter = 0;
        this.wasBeat = false;

        this.bgScroll = 0.0;
        this.fgScroll = 0.0;

        this.cachedWidth = 0;
        this.cachedHeight = 0;

        this.cachedWaterColors = [];
        this.cachedRefColors = [];

        // Klassische Polygon-Berge (wenige Ecken)
        this.mountains1 = [
            { x: 0, y: 0 }, { x: 15, y: 15 }, { x: 25, y: 4 }, { x: 38, y: 24 },
            { x: 52, y: 8 }, { x: 68, y: 28 }, { x: 82, y: 6 }, { x: 100, y: 0 }
        ];
        this.mountains2 = [
            { x: 0, y: 0 }, { x: 20, y: 8 }, { x: 35, y: 16 }, { x: 50, y: 6 },
            { x: 65, y: 18 }, { x: 78, y: 4 }, { x: 90, y: 12 }, { x: 100, y: 0 }
        ];

        // Wolken
        this.cloud1X = -50;
        this.cloud1Y = 32; 
        this.cloud2X = -150;
        this.cloud2Y = 65; 

        // Möwenschwarm
        this.birdX = new Float32Array([-50, -50, -50]);
        this.birdY = new Float32Array([0, 0, 0]);
        this.birdYOffset = new Float32Array([0, 0, 0]);
        this.birdActive = [false, false, false];
        this.birdPhase = new Float32Array([0, 0.5, 1.0]);

        this.fishActive = false;
        this.fishT = 0;
        this.fishStartX = 0;
        this.fishBaseY = 0;

        this.starActive = false;
        this.starX = 0;
        this.starY = 0;
        this.starT = 0;

        this.sunPulse = 0.0;

        this.initialized = false;
        this.ensureInitialized();
    }

    // Selbstheilungs-Schutzschaltung
    ensureInitialized() {
        if (this.copperPalette && this.cSunCore) return;

        // --- 1. OCS PALETTE (Konsistente Namensgebung) ---
        this.cWaterBase = rgbToHex(...quantizeAmiga12Bit(0, 0, 34));          
        this.cWaterRefl = rgbToHex(...quantizeAmiga12Bit(255, 119, 0)); 
        this.cWaterStripe = rgbToHex(...quantizeAmiga12Bit(0, 17, 51));
        
        this.cSunCore   = rgbToHex(...quantizeAmiga12Bit(255, 255, 255));   
        this.cSunYellow = rgbToHex(...quantizeAmiga12Bit(255, 221, 0));   
        this.cSunOrange = rgbToHex(...quantizeAmiga12Bit(255, 119, 0));   
        this.cSunRed    = rgbToHex(...quantizeAmiga12Bit(204, 51, 0));       

        this.cMountain1 = rgbToHex(...quantizeAmiga12Bit(51, 17, 68));     
        this.cMountain2 = rgbToHex(...quantizeAmiga12Bit(17, 0, 34));      
        this.cMountOutl = rgbToHex(...quantizeAmiga12Bit(34, 17, 51));   
        
        // Clouds: Klassische Amiga-Farben (Weiß, Orange-Grau, Dunkelgrau)
        this.cCloudCore = rgbToHex(...quantizeAmiga12Bit(255, 255, 255));
        this.cCloudMid  = rgbToHex(...quantizeAmiga12Bit(204, 136, 68));      
        this.cCloudShad = rgbToHex(...quantizeAmiga12Bit(102, 68, 68));     

        this.cLensCore  = rgbToHex(...quantizeAmiga12Bit(255, 255, 255));
        this.cLensRing  = rgbToHex(...quantizeAmiga12Bit(255, 170, 0));

        // 28-Band Amiga OCS Copper-Himmel-Palette
        this.copperPalette = [
            [0, 0, 34], [0, 0, 34], [17, 0, 51], [17, 0, 51],
            [34, 0, 68], [34, 0, 68], [68, 0, 68], [68, 0, 68],
            [102, 0, 51], [102, 0, 51], [136, 0, 34], [136, 0, 34],
            [170, 17, 17], [170, 17, 17], [204, 51, 0], [204, 51, 0],
            [238, 85, 0], [238, 85, 0], [255, 119, 0], [255, 119, 0],
            [255, 153, 0], [255, 153, 0], [255, 187, 0], [255, 187, 0],
            [255, 221, 0], [255, 221, 0], [255, 255, 17], [255, 255, 17]  
        ].map(c => rgbToHex(...quantizeAmiga12Bit(c[0], c[1], c[2])));

        this.initialized = true;
    }

    drawChunkyMountainRange(ctx, width, horizon, points, color, scrollOffset, heightScale, outlineColor = null) {
        let totalW = width;
        let sOff = Math.floor(scrollOffset) % totalW;

        for (let x = 0; x < width; x++) {
            let vx = (x + sOff) % totalW;
            let pct = (vx / totalW) * 100;
            
            let p1, p2;
            for (let i = 0; i < points.length - 1; i++) {
                if (pct >= points[i].x && pct <= points[i+1].x) {
                    p1 = points[i]; p2 = points[i+1]; break;
                }
            }
            if (!p1) continue; 
            
            let t = (pct - p1.x) / (p2.x - p1.x);
            let tSmooth = (1 - Math.cos(t * Math.PI)) / 2;
            let hPct = p1.y + (p2.y - p1.y) * tSmooth;
            
            let h = Math.floor(horizon * heightScale * (hPct / 100));
            if (h <= 0) continue;
            let drawY = horizon - h;
            
            ctx.fillStyle = color;
            ctx.fillRect(x, drawY, 1, h + 1); 
            
            if (outlineColor) {
                ctx.fillStyle = outlineColor;
                ctx.fillRect(x, drawY, 1, 1);
            }
        }
    }

    rebuildWaterCache(width, height) {
        this.ensureInitialized();
        const horizon = Math.floor(height * 0.55);
        const numLines = Math.ceil((height - horizon) / 2);

        if (!this.cachedWaterColors || this.cachedWaterColors.length !== numLines) {
            this.cachedWaterColors = new Array(numLines);
            this.cachedRefColors = new Array(numLines);
        }

        for (let i = 0; i < numLines; i++) {
            let y = horizon + i * 2;
            let depth = (y - horizon) / (height - horizon);

            let r = 0, g = 0, b = 0;
            if (depth < 0.5) {
                let t = depth / 0.5;
                g = Math.floor(17 * t);
                b = Math.floor(34 + (68 - 34) * t);
            } else {
                let t = (depth - 0.5) / 0.5;
                g = Math.floor(17 + (34 - 17) * t);
                b = Math.floor(68 + (102 - 68) * t);
            }

            let isStripe = (depth > 0.6 && Math.floor(y / 4) % 3 === 0);
            if (isStripe) {
                this.cachedWaterColors[i] = this.cWaterStripe;
            } else {
                this.cachedWaterColors[i] = rgbToHex(...quantizeAmiga12Bit(r, g, b));
            }

            let shading = Math.max(0.15, 1.0 - depth * 0.72);
            this.cachedRefColors[i] = rgbToHex(...quantizeAmiga12Bit(255 * shading, 119 * shading, 0));
        }
    }

    render(ctx, width, height, t, state, stateTime, metrics) {
        this.ensureInitialized(); 
        
        if (state === 'idle') { this.lastT = t; return; }
        let dt = this.lastT === 0 ? 0.016 : t - this.lastT;
        this.lastT = t;

        // =========================================================
        // 1. BEAT & TENSION CHOREOGRAPHY (Diskrete Coder Logic)
        // =========================================================
        const beat = metrics.beat[0];
        const isBeat = beat > 0.75 && !this.wasBeat;
        this.wasBeat = (beat > 0.75);

        if (isBeat) this.beatCounter++;

        // Feste Zähler-Offsets für asynchrones Triggern
        const isFishTrigger = (this.beatCounter % 32 === 0) && isBeat;
        const isBirdTrigger = (this.beatCounter % 48 === 0) && isBeat;

        // Diskrete Geschwindigkeitsstufen
        let speedMult = (state === 'climax') ? 2.0 : (state === 'buildup' ? 1.5 : 1.0);

        this.internalT += dt * speedMult;
        this.waterT += dt * speedMult;

        let globalAlpha = 1.0;
        if (state === 'starting') globalAlpha = Math.min(1.0, stateTime / 1.5);
        if (state === 'stopping') globalAlpha = Math.max(0.0, 1.0 - (stateTime / 1.5));

        if (this.cachedWidth !== width || this.cachedHeight !== height) {
            this.cachedWidth = width;
            this.cachedHeight = height;
            this.rebuildWaterCache(width, height);
        }

        ctx.globalAlpha = globalAlpha;
        const horizon = Math.floor(height * 0.55); 
        const minDim = Math.min(width, height);

        // --- LAYER 1: THE COPPER SKY ---
        const bandH = Math.ceil(horizon / this.copperPalette.length);
        for (let i = 0; i < this.copperPalette.length; i++) {
            ctx.fillStyle = this.copperPalette[i];
            let startY = Math.floor(i * bandH);
            let endY = Math.floor((i + 1) * bandH);
            if (startY < horizon) ctx.fillRect(0, startY, width, Math.min(horizon, endY) - startY);
        }

        // --- LAYER 2: THE SINGLE BIG TWINKLING STAR (20s Cycle, no instant flashes) ---
        let blinkPhase = (t * 0.3) % (Math.PI * 2);
        if (blinkPhase < 0.8) {
            let starAlpha = Math.sin((blinkPhase / 0.8) * Math.PI);
            ctx.save();
            ctx.globalAlpha = starAlpha * globalAlpha;
            
            let sxStar = Math.floor(width * 0.8);
            let syStar = Math.floor(horizon * 0.2);
            
            ctx.fillStyle = this.cSunCore;
            ctx.fillRect(sxStar, syStar, 2, 2);
            ctx.fillStyle = this.cSunYellow;
            ctx.fillRect(sxStar - 2, syStar, 6, 2);
            ctx.fillRect(sxStar, syStar - 2, 2, 6);
            ctx.restore();
        }

        // --- LAYER 3: LENSFLARE SPRITE ---
        if (metrics.tensionPct > 0.4 && state === 'climax') {
            let lx = Math.floor(width * 0.15);
            let ly = Math.floor(horizon * 0.25);
            let lfScale = isBeat ? 4 : 2;

            ctx.fillStyle = this.cLensCore;
            ctx.fillRect(lx, ly, lfScale, lfScale);
            ctx.fillStyle = this.cLensRing;
            ctx.fillRect(lx - lfScale*2, ly, lfScale*5, 1);
            ctx.fillRect(lx, ly - lfScale*2, 1, lfScale*5);
        }

        // --- LAYER 4: COPPER SUN ---
        let sunR = Math.floor(minDim * 0.23); 
        let sx = Math.floor(width * 0.44); 
        let sy = Math.floor(horizon - 10);

        for (let dy = -sunR; dy <= sunR; dy += 2) {
            let yLine = sy + dy;
            if (yLine >= horizon) continue; 

            if (state === 'climax' && beat > 0.6) {
                if ((yLine + this.beatCounter * 2) % 6 === 0) continue;
            }

            let dx = Math.round(Math.sqrt(sunR * sunR - dy * dy));
            let rDist = Math.abs(dy) / sunR;

            let sunColor = this.cSunCore;
            if (rDist > 0.82) sunColor = this.cSunRed; 
            else if (rDist > 0.55) sunColor = this.cSunOrange; 
            else if (rDist > 0.28) sunColor = this.cSunYellow; 

            ctx.fillStyle = sunColor;
            ctx.fillRect(sx - dx, yLine, dx * 2, 2);
        }

        // --- LAYER 5: THE CLOUDS (100% Rect-Free, high-speed wrapping) ---
        this.cloud2X += dt * (8.0 + speedMult * 4.0); // Beschleunigter Drift
        
        let cloudW = 90; 
        let span = width + cloudW;
        let cx2 = Math.floor((this.cloud2X + cloudW) % span);
        if (cx2 < 0) cx2 += span; // Mathematisch ausfallsicherer Wrap-Around
        cx2 -= cloudW;
        
        let cy2 = Math.floor(this.cloud2Y);

        const drawCloud = (x, y, colCore, colMid, colShad) => {
            // Shadow (drawn first, shifted down/right)
            fillAliasedCircle(ctx, x, y + 2, 4, colShad);
            fillAliasedCircle(ctx, x + 8, y + 3, 6, colShad);
            fillAliasedCircle(ctx, x + 18, y - 1, 10, colShad);
            fillAliasedCircle(ctx, x + 30, y + 3, 7, colShad);
            fillAliasedCircle(ctx, x + 42, y - 2, 11, colShad);
            fillAliasedCircle(ctx, x + 56, y + 1, 8, colShad);
            fillAliasedCircle(ctx, x + 68, y - 3, 9, colShad);
            fillAliasedCircle(ctx, x + 80, y + 4, 4, colShad);

            // Mid/Highlight
            fillAliasedCircle(ctx, x, y + 1, 4, colMid);
            fillAliasedCircle(ctx, x + 8, y + 2, 6, colMid);
            fillAliasedCircle(ctx, x + 18, y - 2, 10, colMid);
            fillAliasedCircle(ctx, x + 30, y + 2, 7, colMid);
            fillAliasedCircle(ctx, x + 42, y - 3, 11, colMid);
            fillAliasedCircle(ctx, x + 56, y, 8, colMid);
            fillAliasedCircle(ctx, x + 68, y - 4, 9, colMid);
            fillAliasedCircle(ctx, x + 80, y + 3, 4, colMid);

            // Core
            fillAliasedCircle(ctx, x, y, 3, colCore);
            fillAliasedCircle(ctx, x + 8, y + 1, 5, colCore);
            fillAliasedCircle(ctx, x + 18, y - 3, 9, colCore);
            fillAliasedCircle(ctx, x + 30, y + 1, 6, colCore);
            fillAliasedCircle(ctx, x + 42, y - 4, 10, colCore);
            fillAliasedCircle(ctx, x + 56, y - 1, 7, colCore);
            fillAliasedCircle(ctx, x + 68, y - 5, 8, colCore);
            fillAliasedCircle(ctx, x + 80, y + 2, 3, colCore);
        };
        
        drawCloud(cx2, cy2, this.cCloudCore, this.cCloudMid, this.cCloudShad);

        // --- LAYER 6: PARALLAX MOUNTAINS ---
        this.bgScroll = (this.bgScroll + dt * 4.8) % width;
        this.drawChunkyMountainRange(ctx, width, horizon, this.mountains1, this.cMountain1, this.bgScroll, 0.38, null);

        this.fgScroll = (this.fgScroll + dt * 10.8) % width;
        this.drawChunkyMountainRange(ctx, width, horizon, this.mountains2, this.cMountain2, this.fgScroll, 0.25, this.cMountOutl);

        // --- LAYER 7: COPPER HORIZON FLICKER ---
        let hShift = (this.beatCounter % 2 === 0) ? 1 : 0;
        ctx.fillStyle = this.cSunYellow;
        ctx.fillRect(sx - Math.floor(sunR * 0.65) + hShift, horizon, Math.floor(sunR * 1.3), 1);

        // --- LAYER 8: GLIDING SEAGULLS ---
        if (!this.birdActive[0] && isBirdTrigger) {
            let baseRowY = Math.floor(horizon * 0.55);
            this.birdActive[0] = true; this.birdX[0] = width + 20; this.birdY[0] = baseRowY;
            this.birdActive[1] = true; this.birdX[1] = width + 48; this.birdY[1] = baseRowY - 10;
            this.birdActive[2] = true; this.birdX[2] = width + 58; this.birdY[2] = baseRowY + 10;
        }

        for (let b = 0; b < 3; b++) {
            if (this.birdActive[b]) {
                this.birdX[b] -= dt * 28.0;
                this.birdYOffset[b] = Math.sin(t * 2.0 + this.birdPhase[b]) * 4.0;
                
                if (this.birdX[b] < -30) {
                    this.birdActive[b] = false;
                } else {
                    let bx = Math.floor(this.birdX[b]);
                    let by = Math.floor(this.birdY[b] + this.birdYOffset[b]);
                    let flap = Math.sin(t * 8.0 + this.birdPhase[b]) > 0;
                    let wingY = flap ? -2 : 2;
                    
                    drawAliasedLine(ctx, bx - 4, by + wingY, bx, by, this.cMountain2);
                    drawAliasedLine(ctx, bx, by, bx + 4, by + wingY, this.cMountain2);
                }
            }
        }

        // --- LAYER 9: SHIMMERING WATER (Optimized Waves & Gaps) ---
        ctx.fillStyle = this.cWaterBase; 
        ctx.fillRect(0, horizon + 1, width, height - horizon);

        const numLines = this.cachedWaterColors.length;

        for (let i = 0; i < numLines; i++) {
            let y = horizon + i * 2;
            let depth = (y - horizon) / (height - horizon);
            let waveWidth = (minDim * 0.065) + (depth * (minDim * 0.28));

            let rawSway = Math.sin((y * 0.05) + (this.waterT * 2.0));
            let sway = Math.floor(rawSway * 4) * (2 + depth * 5); 

            let shimmer = Math.sin((y * 0.45) + (this.waterT * 8.0));
            
            // KORREKTUR: Schwelle auf -0.65 abgesenkt! Die Lücken sind nun wunderbar schmal.
            if (shimmer < -0.65) {
                ctx.fillStyle = this.cachedWaterColors[i];
                ctx.fillRect(0, y, width, 2);
                continue;
            }

            ctx.fillStyle = this.cachedWaterColors[i];
            ctx.fillRect(0, y, width, 2);

            let lx = sx - (waveWidth / 2) + sway + hShift;

            ctx.fillStyle = this.cachedRefColors[i];
            ctx.fillRect(Math.floor(lx), y, Math.floor(waveWidth), 2);

            let coreShimmer = Math.sin((y * 0.9) + (this.waterT * 12.0));
            if (coreShimmer > 0.1) {
                let coreW = waveWidth * 0.28 * (1.0 - depth * 0.45);
                ctx.fillStyle = this.cSunCore;
                ctx.fillRect(Math.floor(sx - (coreW / 2) + sway * 0.5 + hShift), y, Math.floor(coreW), 2);
            }
        }

        // --- LAYER 10: LEAPING FISH ---
        if (!this.fishActive && isFishTrigger) {
            this.fishActive = true;
            this.fishT = 0;
            this.fishStartX = Math.floor(width * 0.2 + Math.random() * width * 0.6);
            this.fishBaseY = horizon + 12 + Math.floor(Math.random() * (height - horizon - 28));
        }

        if (this.fishActive) {
            this.fishT += dt * 1.8;
            if (this.fishT >= 1.0) {
                this.fishActive = false;
            } else {
                let fx = Math.floor(this.fishStartX + this.fishT * 32);
                let u = 2.0 * this.fishT - 1.0;
                let arc = 1.0 - u * u;
                let fy = Math.floor(this.fishBaseY - arc * 22);

                if (this.fishT < 0.15 || this.fishT > 0.85) {
                    ctx.fillStyle = this.cSunCore;
                    let sY = this.fishBaseY;
                    ctx.fillRect(fx - 4, sY, 1, 1);
                    ctx.fillRect(fx + 4, sY, 1, 1);
                    ctx.fillRect(fx - 2, sY - 2, 1, 1);
                    ctx.fillRect(fx + 2, sY - 2, 1, 1);
                    ctx.fillRect(fx, sY - 4, 1, 1);
                }

                ctx.fillStyle = this.cSunGlow;
                ctx.fillRect(fx - 2, fy - 1, 4, 3);
                ctx.fillStyle = this.cWaterRefl;
                ctx.fillRect(fx - 4, fy, 2, 1);
            }
        }

        ctx.globalAlpha = 1.0;
    }
}