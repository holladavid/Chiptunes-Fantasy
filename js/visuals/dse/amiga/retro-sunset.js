// === js/visuals/dse/amiga/retro-sunset.js ===
import { quantizeAmiga12Bit, rgbToHex, fillAliasedCircle, drawAliasedLine } from '../../utils/hardware-constraints.js';

export class AmigaRetroSunset {
    constructor() {
        this.internalT = 0;
        this.waterT = 0;
        this.smoothedSpeed = 1.0;
        this.smoothedWaveSpeed = 1.0;
        this.lastT = 0;

        this.bgScroll = 0.0;
        this.fgScroll = 0.0;

        // IK+ Mountain-Basepoints (X: 0-100%, Y: 0-100% Höhe)
        // Dank Cosine-Interpolation brauchen wir nur wenige Punkte für weiche Hügel
        this.mountains1 = [
            { x: 0, y: 0 }, { x: 15, y: 15 }, { x: 28, y: 5 }, { x: 42, y: 24 },
            { x: 55, y: 9 }, { x: 72, y: 28 }, { x: 85, y: 7 }, { x: 100, y: 0 }
        ];
        this.mountains2 = [
            { x: 0, y: 0 }, { x: 20, y: 8 }, { x: 35, y: 16 }, { x: 50, y: 6 },
            { x: 65, y: 18 }, { x: 78, y: 4 }, { x: 90, y: 12 }, { x: 100, y: 0 }
        ];

        // Wolke 1 (Fluffy, Foreground)
        this.cloud1X = -50;
        this.cloud1Y = 32; 
        this.cloud1SpeedOffset = 0.0;

        // Wolke 2 (Stratus, Background, lang und flach)
        this.cloud2X = -150;
        this.cloud2Y = 65; 
        this.cloud2SpeedOffset = 0.0;

        // Möwenschwarm
        this.birdX = new Float32Array([-50, -50, -50]);
        this.birdY = new Float32Array([0, 0, 0]);
        this.birdActive = [false, false, false];
        this.birdSpeed = new Float32Array([0, 0, 0]);
        this.birdYOffset = new Float32Array([0, 0, 0]);
        this.birdPhase = new Float32Array([0, 0, 0]);

        this.fishActive = false;
        this.fishT = 0;
        this.fishStartX = 0;
        this.fishBaseY = 0;

        this.starActive = false;
        this.starX = 0;
        this.starY = 0;
        this.starT = 0;

        this.sunPulse = 0.0;

        this.ensureInitialized();
    }

    // Selbstheilungs-Schutzschaltung
    ensureInitialized() {
        if (this.copperPalette && this.sunColorCore) return;

        // --- WASSER PALETTE (Strikes OCS Navy/Teal, KEIN LILA!) ---
        this.waterColor = rgbToHex(...quantizeAmiga12Bit(0, 5, 20));          // Mitternachts-Navy
        this.mountainReflColor1 = rgbToHex(...quantizeAmiga12Bit(0, 10, 30)); // Dither Schatten 1
        this.mountainReflColor2 = rgbToHex(...quantizeAmiga12Bit(0, 15, 40)); // Dither Schatten 2
        this.waterRippleColor = rgbToHex(...quantizeAmiga12Bit(0, 45, 85));   // Bob Ross Liquid Cyan
        
        // --- SONNEN & REFLEXIONS PALETTE ---
        this.sunReflColor1 = rgbToHex(...quantizeAmiga12Bit(255, 187, 0));    // Kern-Glitzern
        this.sunReflColor2 = rgbToHex(...quantizeAmiga12Bit(255, 119, 0));    // Mittleres Orange
        this.sunReflColor3 = rgbToHex(...quantizeAmiga12Bit(204, 51, 0));     // Dunkles Ausfransen
        
        this.sunColorCore = rgbToHex(...quantizeAmiga12Bit(255, 255, 255));   
        this.sunColorYellow = rgbToHex(...quantizeAmiga12Bit(255, 221, 0));   
        this.sunColorOrange = rgbToHex(...quantizeAmiga12Bit(255, 119, 0));   
        this.sunColorRed = rgbToHex(...quantizeAmiga12Bit(204, 51, 0));       

        // --- BERGE & WOLKEN ---
        this.mountain1Color = rgbToHex(...quantizeAmiga12Bit(51, 17, 68));     // Ferne Kette
        this.mountain2Color = rgbToHex(...quantizeAmiga12Bit(17, 0, 34));      // Nahe Kette (Tief-Charcoal)
        this.mountain2Outline = rgbToHex(...quantizeAmiga12Bit(34, 17, 51));   // Kontur
        
        this.cloud1Core = rgbToHex(...quantizeAmiga12Bit(255, 255, 255));
        this.cloud1Shadow = rgbToHex(...quantizeAmiga12Bit(255, 119, 0));
        this.cloud2Core = rgbToHex(...quantizeAmiga12Bit(204, 102, 153));      // Altrosa
        this.cloud2Shadow = rgbToHex(...quantizeAmiga12Bit(136, 51, 102));     // Dunkelviolett

        // 28-Band Amiga OCS Copper-Himmel-Palette (Top-down Shading)
        this.copperPalette = [
            [0, 0, 34], [0, 0, 34], [17, 0, 51], [17, 0, 51],
            [34, 0, 68], [34, 0, 68], [68, 0, 68], [68, 0, 68],
            [102, 0, 51], [102, 0, 51], [136, 0, 34], [136, 0, 34],
            [170, 17, 17], [170, 17, 17], [204, 51, 0], [204, 51, 0],
            [238, 85, 0], [238, 85, 0], [255, 119, 0], [255, 119, 0],
            [255, 153, 0], [255, 153, 0], [255, 187, 0], [255, 187, 0],
            [255, 221, 0], [255, 221, 0], [255, 255, 17], [255, 255, 17]  
        ].map(c => rgbToHex(...quantizeAmiga12Bit(c[0], c[1], c[2])));
    }

    // =========================================================
    // 100% ANTI-ALIASING FREE MOUNTAIN RENDERER
    // Nutzt Cosine-Interpolation + 1-Pixel fillRect Säulen.
    // Garantiert die absolut schärfsten Pixeltreppen!
    // =========================================================
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
            
            // Cosine Interpolation erzeugt weiche, aber völlig alias-freie Hügel
            let t = (pct - p1.x) / (p2.x - p1.x);
            let tSmooth = (1 - Math.cos(t * Math.PI)) / 2;
            let hPct = p1.y + (p2.y - p1.y) * tSmooth;
            
            let h = Math.floor(horizon * heightScale * (hPct / 100));
            if (h <= 0) continue;
            let drawY = horizon - h;
            
            ctx.fillStyle = color;
            ctx.fillRect(x, drawY, 1, h + 1); // +1 überlappt den Horizont sicher
            
            // Plastische 1-Pixel-Kante auf der Bergkuppe
            if (outlineColor) {
                ctx.fillStyle = outlineColor;
                ctx.fillRect(x, drawY, 1, 1);
            }
        }
    }

    // =========================================================
    // BOB ROSS PULL DOWN: DITHERED MOUNTAIN REFLECTIONS
    // =========================================================
    drawChunkyMountainReflection(ctx, width, horizon, points, color, scrollOffset, heightScale) {
        let totalW = width;
        let sOff = Math.floor(scrollOffset) % totalW;

        ctx.fillStyle = color;
        // Rastert in 2-Pixel-Sprüngen (Dither/Interlace Effekt im Wasser)
        for (let x = 0; x < width; x += 2) { 
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
            
            // Staucht die Spiegelung perspektivisch zusammen
            let h = Math.floor(horizon * heightScale * (hPct / 100) * 0.45); 
            
            for(let dy = 0; dy < h; dy += 2) {
                ctx.fillRect(x, horizon + dy, 2, 1);
            }
        }
    }

    resize(width, height) {}

    render(ctx, width, height, t, state, stateTime, metrics) {
        this.ensureInitialized(); 
        
        if (state === 'idle') { this.lastT = t; return; }
        let dt = this.lastT === 0 ? 0.016 : t - this.lastT;
        this.lastT = t;

        let globalAlpha = 1.0;
        let targetSpeed = 1.0;
        let targetWaveSpeed = 1.0;
        let beatIntensity = 0.0; 

        if (state === 'starting') {
            globalAlpha = Math.min(1.0, stateTime / 1.5);
        } else if (state === 'stopping') {
            globalAlpha = Math.max(0.0, 1.0 - (stateTime / 1.5));
        } else if (state === 'buildup') {
            targetSpeed = 1.25; targetWaveSpeed = 1.8; beatIntensity = 0.35;           
        } else if (state === 'climax') {
            targetSpeed = 2.0; targetWaveSpeed = 4.2; beatIntensity = 1.0;           
        }

        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * 0.05;
        this.smoothedWaveSpeed += (targetWaveSpeed - this.smoothedWaveSpeed) * 0.05;
        this.internalT += dt * this.smoothedSpeed;
        this.waterT += dt * this.smoothedWaveSpeed;

        const beat = metrics.beat[0];
        this.sunPulse += (beat * beatIntensity * 0.15 - this.sunPulse) * 0.1;

        ctx.globalAlpha = globalAlpha;
        const horizon = Math.floor(height * 0.55); 
        const minDim = Math.min(width, height);

        let skyJitterY = 0;
        if (Math.sin(t * 1.5) > 0.97) skyJitterY = Math.floor(Math.sin(t * 60) * 1.2);

        // --- LAYER 1: THE COPPER SKY ---
        const bandH = Math.ceil(horizon / this.copperPalette.length);
        for (let i = 0; i < this.copperPalette.length; i++) {
            ctx.fillStyle = this.copperPalette[i];
            let startY = Math.floor(i * bandH) + skyJitterY;
            let endY = Math.floor((i + 1) * bandH) + skyJitterY;
            if (startY < horizon) ctx.fillRect(0, startY, width, Math.min(horizon, endY) - startY);
        }

        // --- LAYER 2: THE SINGLE SHINING STAR ---
        if (!this.starActive && Math.sin(t * 0.4) > 0.96) {
            this.starActive = true;
            this.starX = Math.floor(width * 0.15 + Math.random() * width * 0.7);
            this.starY = Math.floor(height * 0.05 + Math.random() * height * 0.1);
            this.starT = 0;
        }

        if (this.starActive) {
            this.starT += dt * 1.5;
            if (this.starT >= Math.PI) this.starActive = false;
            else {
                let starAlpha = Math.sin(this.starT);
                ctx.fillStyle = this.sunCoreColor;
                ctx.save();
                ctx.globalAlpha = starAlpha * globalAlpha;
                let sxStar = Math.floor(this.starX);
                let syStar = Math.floor(this.starY) + skyJitterY;
                ctx.fillRect(sxStar, syStar, 1, 1);
                if (starAlpha > 0.8) {
                    ctx.fillStyle = this.sunColorYellow;
                    ctx.fillRect(sxStar - 1, syStar, 1, 1);
                    ctx.fillRect(sxStar + 1, syStar, 1, 1);
                    ctx.fillRect(sxStar, syStar - 1, 1, 1);
                    ctx.fillRect(sxStar, syStar + 1, 1, 1);
                }
                ctx.restore();
            }
        }

        // --- LAYER 3: COPPER SUN (Asymmetrisch) ---
        let sunR = Math.floor(minDim * 0.23); 
        let sx = Math.floor(width * 0.44); 
        let sy = Math.floor(horizon - 10) + skyJitterY;

        for (let dy = -sunR; dy <= sunR; dy += 2) {
            let yLine = sy + dy;
            if (yLine >= horizon) continue; 

            let dx = Math.round(Math.sqrt(sunR * sunR - dy * dy));
            let rDist = Math.abs(dy) / sunR;

            let sunColor = this.sunColorCore;
            if (rDist > 0.82) sunColor = this.sunColorRed; 
            else if (rDist > 0.55) sunColor = this.sunColorOrange; 
            else if (rDist > 0.28) sunColor = this.sunColorYellow; 
            
            if (beat > 0.75 && (yLine % 4 === 0)) continue;

            ctx.fillStyle = sunColor;
            ctx.fillRect(sx - dx, yLine, dx * 2, 2);
        }

        // --- LAYER 4: CLOUD 2 (Stratus, zieht HINTER den Bergen vorbei) ---
        this.cloud2SpeedOffset += (beat * 8.0 - this.cloud2SpeedOffset) * 0.05;
        this.cloud2X += dt * (1.2 + this.cloud2SpeedOffset);
        if (this.cloud2X > width + 100) this.cloud2X = -100;

        let cx2 = Math.floor(this.cloud2X);
        let cy2 = Math.floor(this.cloud2Y) + skyJitterY;
        
        ctx.fillStyle = this.cloud2Shadow;
        ctx.fillRect(cx2, cy2 + 2, 70, 6);
        fillAliasedCircle(ctx, cx2, cy2 + 5, 5, this.cloud2Shadow);
        fillAliasedCircle(ctx, cx2 + 70, cy2 + 5, 5, this.cloud2Shadow);
        ctx.fillStyle = this.cloud2Core;
        ctx.fillRect(cx2, cy2, 70, 6);
        fillAliasedCircle(ctx, cx2, cy2 + 3, 5, this.cloud2Core);
        fillAliasedCircle(ctx, cx2 + 70, cy2 + 3, 5, this.cloud2Core);

        // --- LAYER 5: PARALLAX MOUNTAINS (Chunky Aliased Routine) ---
        this.bgScroll = (this.bgScroll + dt * 4.8) % width;
        this.drawChunkyMountainRange(ctx, width, horizon, this.mountains1, this.mountain1Color, this.bgScroll, 0.38, null);

        this.fgScroll = (this.fgScroll + dt * 10.8) % width;
        this.drawChunkyMountainRange(ctx, width, horizon, this.mountains2, this.mountain2Color, this.fgScroll, 0.25, this.mountain2Outline);

        // --- LAYER 6: CLOUD 1 (Fluffy, zieht VOR den Bergen vorbei) ---
        this.cloud1SpeedOffset += (beat * 14.0 - this.cloud1SpeedOffset) * 0.08;
        this.cloud1X += dt * (2.8 + this.cloud1SpeedOffset);
        if (this.cloud1X > width + 60) this.cloud1X = -60;

        let cx1 = Math.floor(this.cloud1X);
        let cy1 = Math.floor(this.cloud1Y) + skyJitterY;
        
        ctx.fillStyle = this.cloud1Shadow;
        fillAliasedCircle(ctx, cx1, cy1 + 2, 13, this.cloud1Shadow);
        fillAliasedCircle(ctx, cx1 - 11, cy1 + 3, 9, this.cloud1Shadow);
        fillAliasedCircle(ctx, cx1 + 11, cy1 + 3, 9, this.cloud1Shadow);
        
        ctx.fillStyle = this.cloud1Core;
        fillAliasedCircle(ctx, cx1, cy1, 12, this.cloud1Core);
        fillAliasedCircle(ctx, cx1 - 11, cy1 + 1, 8, this.cloud1Core);
        fillAliasedCircle(ctx, cx1 + 11, cy1 + 1, 8, this.cloud1Core);

        // --- LAYER 7: SHIMMERING HORIZON-GLOW ---
        let horizonFlicker = Math.floor(t * 30) % 2 === 0;
        if (horizonFlicker) {
            ctx.fillStyle = this.sunColorYellow;
            let hStart = sx - Math.floor(sunR * 0.65);
            let hWidth = Math.floor(sunR * 1.3);
            ctx.fillRect(hStart, horizon, hWidth, 1);
        }

        // --- LAYER 8: GLIDING SEAGULLS (Tiefer Flug über die Gipfel) ---
        let flockInactive = !this.birdActive[0] && !this.birdActive[1] && !this.birdActive[2];
        if (flockInactive && Math.random() < 0.0035) {
            let baseSpeed = 24 + Math.random() * 10;
            let baseRowY = Math.floor(horizon * 0.60 + Math.random() * horizon * 0.15); // Deutlich tiefer!
            
            this.birdActive[0] = true; this.birdX[0] = width + 20; this.birdY[0] = baseRowY; this.birdSpeed[0] = baseSpeed; this.birdPhase[0] = 0.0;
            this.birdActive[1] = true; this.birdX[1] = width + 48; this.birdY[1] = baseRowY - 10; this.birdSpeed[1] = baseSpeed; this.birdPhase[1] = 0.5;
            this.birdActive[2] = true; this.birdX[2] = width + 58; this.birdY[2] = baseRowY + 10; this.birdSpeed[2] = baseSpeed; this.birdPhase[2] = 1.0;
        }

        for (let b = 0; b < 3; b++) {
            if (this.birdActive[b]) {
                this.birdX[b] -= dt * (this.birdSpeed[b] + beat * 35.0);
                this.birdYOffset[b] = Math.sin(t * 3.5 + this.birdPhase[b]) * 5.0 + (Math.sin(t * 12.0) * 1.0);
                
                if (this.birdX[b] < -30) this.birdActive[b] = false;
                else {
                    let bx = Math.floor(this.birdX[b]);
                    let by = Math.floor(this.birdY[b] + this.birdYOffset[b]) + skyJitterY;
                    let flap = Math.sin(t * 10.0 + beat * 15.0 + this.birdPhase[b] * Math.PI) > 0;
                    let wingY = flap ? -3 : 3;
                    
                    drawAliasedLine(ctx, bx - 4, by + wingY, bx, by, this.mountain2Color);
                    drawAliasedLine(ctx, bx, by, bx + 4, by + wingY, this.mountain2Color);
                }
            }
        }

        // =========================================================
        // LAYER 9: BOB ROSS WATER RENDERING
        // =========================================================

        // 9a. Base Water (Deep Navy)
        ctx.fillStyle = this.waterColor;
        ctx.fillRect(0, horizon + 1, width, height - horizon);

        // 9b. "Pull Down": Mountain Reflections
        this.drawChunkyMountainReflection(ctx, width, horizon + 1, this.mountains1, this.mountainReflColor1, this.bgScroll, 0.35);
        this.drawChunkyMountainReflection(ctx, width, horizon + 1, this.mountains2, this.mountainReflColor2, this.fgScroll, 0.22);

        // 9c. "Liquid White": Horizontal water surface lines
        ctx.fillStyle = this.waterRippleColor;
        for (let y = horizon + 4; y < height; y += 4) {
            let drift = Math.sin(y * 0.1 + this.waterT);
            if (drift > 0.5) {
                let rx = (this.waterT * 10 + y * 5) % width;
                ctx.fillRect(Math.floor(rx), y, 10 + Math.floor(drift * 20), 1);
                ctx.fillRect(Math.floor((rx + width/2) % width), y, 8 + Math.floor(drift * 10), 1);
            }
        }

        // 9d. "Cut Across": Dashed Sun Reflection
        const activeBeatDistortion = beat * beatIntensity * 3.0;
        const distortion = 1.0 + activeBeatDistortion;

        for (let y = horizon + 1; y < height; y += 2) {
            let depth = (y - horizon) / (height - horizon);

            // Modulated sine waves cut transparent gaps into the reflection
            let cut = Math.sin((y * 0.25) - this.waterT * 4.5) + Math.sin((y * 0.5) + this.waterT * 3.2);
            if (cut > 0.4 + depth * 0.6) continue; 

            let reflWidth = (minDim * 0.12) + (depth * minDim * 0.25);
            let sway = Math.sin((y * 0.05) + (this.waterT * 2.0)) * (8 + depth * 25) * distortion;
            let lineJitter = Math.floor(Math.sin((y * 0.8) + this.waterT * 6.0) * 1.5);
            let startX = sx - (reflWidth / 2) + sway + lineJitter;

            let rColor = this.sunReflColor3; 
            if (depth < 0.4 && cut < -0.2) rColor = this.sunReflColor2; 
            if (depth < 0.2 && cut < -0.8) rColor = this.sunReflColor1; 

            ctx.fillStyle = rColor;
            
            // Break the band into multiple organic dashes
            let dashCount = 1 + Math.floor(depth * 4);
            let dashW = reflWidth / dashCount;

            for (let d = 0; d < dashCount; d++) {
                let dashMod = 0.6 + Math.sin(y * 0.2 + d) * 0.4; 
                let dW = dashW * dashMod;
                let dX = startX + (d * dashW) + ((dashW - dW) / 2);
                ctx.fillRect(Math.floor(dX), y, Math.floor(dW), 1); // 1-Pixel hohe Glints!
            }
        }

        // --- LAYER 10: ANTICS: LEAPING FISH ---
        if (!this.fishActive && beat > 0.82 && Math.random() < 0.015) {
            this.fishActive = true;
            this.fishT = 0;
            this.fishStartX = Math.floor(width * 0.2 + Math.random() * width * 0.6);
            this.fishBaseY = horizon + 12 + Math.floor(Math.random() * (height - horizon - 28));
        }

        if (this.fishActive) {
            this.fishT += dt * 2.1;
            if (this.fishT >= 1.0) {
                this.fishActive = false;
            } else {
                let fx = Math.floor(this.fishStartX + this.fishT * 32);
                let u = 2.0 * this.fishT - 1.0;
                let arc = 1.0 - u * u;
                let fy = Math.floor(this.fishBaseY - arc * 22);

                if (this.fishT < 0.15 || this.fishT > 0.85) {
                    ctx.fillStyle = this.sunCoreColor;
                    let sY = this.fishBaseY;
                    ctx.fillRect(fx - 4, sY, 1, 1);
                    ctx.fillRect(fx + 4, sY, 1, 1);
                    ctx.fillRect(fx - 2, sY - 2, 1, 1);
                    ctx.fillRect(fx + 2, sY - 2, 1, 1);
                    ctx.fillRect(fx, sY - 4, 1, 1);
                }

                ctx.fillStyle = this.sunGlowColor;
                ctx.fillRect(fx - 2, fy - 1, 4, 3);
                ctx.fillStyle = this.reflectionColor;
                ctx.fillRect(fx - 4, fy, 2, 1);
            }
        }

        ctx.globalAlpha = 1.0;
    }
}