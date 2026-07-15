// === js/visuals/dse/atari/retro-sunset.js ===
import { quantizeAtari9Bit, rgbToHex, fillAliasedCircle, drawAliasedLine } from '../../utils/hardware-constraints.js';

export class AtariRetroSunset {
    constructor() {
        this.internalT = 0;
        this.waterT = 0;
        this.smoothedSpeed = 1.0;
        this.smoothedWaveSpeed = 1.0;
        this.lastT = 0;

        // Parallax-Scroll-Akkumulatoren
        this.bgScroll = 0.0;
        this.fgScroll = 0.0;

        this.cachedWidth = 0;
        this.cachedHeight = 0;

        // Speicher-Arrays für das vorab berechnete Wasser-Shading (Zero Allocation)
        this.cachedWaterColors = [];
        this.cachedRefColors = [];

        // IK+ Mountain-Polygone (X: 0-100%, Y: 0-100% Höhe über Horizont)
        this.mountains1 = [
            { x: 0, y: 0 }, { x: 12, y: 15 }, { x: 25, y: 4 }, { x: 38, y: 24 },
            { x: 52, y: 8 }, { x: 68, y: 28 }, { x: 82, y: 6 }, { x: 100, y: 0 }
        ];
        this.mountains2 = [
            { x: 0, y: 0 }, { x: 18, y: 8 }, { x: 32, y: 16 }, { x: 48, y: 6 },
            { x: 60, y: 18 }, { x: 75, y: 4 }, { x: 88, y: 12 }, { x: 100, y: 0 }
        ];

        // --- ANTICS (Archer Maclean Tribute States) ---
        this.cloudX = -50;
        this.cloudY = 45; 
        this.cloudSpeedOffset = 0.0;

        // Das 3er Möwengeschwader
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

        // Kaltstart-Initialisierung
        this.ensureInitialized();
    }

    // Selbstheilungs-Schutzschaltung gegen Hot-Reload / State-Caches
    ensureInitialized() {
        if (this.copperPalette && this.sunColorCore) return;

        // Exakte Atari-Farbpalette (9-Bit Shifter - 512 Farben)
        this.waterColor = rgbToHex(...quantizeAtari9Bit(0, 0, 34));          // Tiefes ST-Marineblau
        this.reflectionColor = rgbToHex(...quantizeAtari9Bit(255, 102, 0));  // Kratziges ST-Orange
        this.sunGlowColor = rgbToHex(...quantizeAtari9Bit(255, 170, 0));     // ST-Gold
        this.sunCoreColor = rgbToHex(...quantizeAtari9Bit(255, 255, 255));   // Reinweiß
        
        // Harmonisch glühende Sonnen-Palette
        this.sunColorYellow = rgbToHex(...quantizeAtari9Bit(255, 255, 85));   
        this.sunColorOrange = rgbToHex(...quantizeAtari9Bit(255, 136, 0));   
        this.sunColorRed = rgbToHex(...quantizeAtari9Bit(204, 34, 0));       

        // Subtile Tiefenperspektive für die Berghorizonte
        this.mountain1Color = rgbToHex(...quantizeAtari9Bit(68, 0, 68));       // Ferne Kette (Dunkles ST-Magenta)
        this.mountain2Color = rgbToHex(...quantizeAtari9Bit(0, 0, 17));        // Nahe Kette (Fast schwarzes Nachtblau)
        this.mountain2Outline = rgbToHex(...quantizeAtari9Bit(0, 34, 51));     // Dunkle Konturkante für Berg 2

        // Der brutale ST Glitch-Farbton
        this.glitchColor = rgbToHex(...quantizeAtari9Bit(255, 255, 255));

        // 8-Band Atari ST Himmel-Palette (Weniger Bänder, mehr Hardcore-Retro-Feeling)
        this.copperPalette = [
            [0, 0, 51],     // Midnight Blue
            [34, 0, 51],    // Deep Purple
            [68, 0, 34],    // Maroon
            [102, 0, 17],   // Dark Red
            [136, 0, 0],    // Red
            [170, 34, 0],   // Vermilion
            [204, 68, 0],   // Orange
            [255, 102, 0]   // ST Sunset Orange
        ].map(c => rgbToHex(...quantizeAtari9Bit(c[0], c[1], c[2])));
    }

    // Tiling-fähiger, allokationsfreier Berg-Renderer
    drawMountainRange(ctx, width, horizon, points, color, scrollOffset, heightScale, isForeground = false) {
        ctx.fillStyle = color;
        let sOff = Math.floor(scrollOffset);
        
        ctx.save();
        ctx.translate(-sOff, 0);
        for (let tile = 0; tile < 2; tile++) {
            let tX = tile * width;
            ctx.beginPath();
            ctx.moveTo(tX, horizon + 1);
            for (let i = 0; i < points.length; i++) {
                let p = points[i];
                let px = Math.floor((p.x / 100) * width) + tX;
                let py = Math.floor(horizon - (p.y / 100) * horizon * heightScale);
                ctx.lineTo(px, py);
            }
            ctx.lineTo(width + tX, horizon + 1);
            ctx.closePath();
            ctx.fill();

            if (isForeground) {
                ctx.strokeStyle = this.mountain2Outline;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(tX, horizon);
                for (let i = 0; i < points.length; i++) {
                    let p = points[i];
                    let px = Math.floor((p.x / 100) * width) + tX;
                    let py = Math.floor(horizon - (p.y / 100) * horizon * heightScale);
                    ctx.lineTo(px, py);
                }
                ctx.stroke();
            }
        }
        ctx.restore();
    }

    // BOB ROSS "VERTICAL PULL"
    drawMirroredMountainRange(ctx, width, horizon, points, color, scrollOffset, heightScale) {
        ctx.fillStyle = color;
        let sOff = Math.floor(scrollOffset);
        
        ctx.save();
        ctx.translate(-sOff, 0);
        for (let tile = 0; tile < 2; tile++) {
            let tX = tile * width;
            ctx.beginPath();
            ctx.moveTo(tX, horizon);
            for (let i = 0; i < points.length; i++) {
                let p = points[i];
                let px = Math.floor((p.x / 100) * width) + tX;
                let py = Math.floor(horizon + (p.y / 100) * horizon * heightScale * 0.82);
                ctx.lineTo(px, py);
            }
            ctx.lineTo(width + tX, horizon);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
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

            // --- ATARI TEAL WATER BASE ---
            // Gradient from deep navy to bright classic ST Teal/Cyan
            let r = 0, g = 0, b = 0;
            if (depth < 0.5) {
                let t = depth / 0.5;
                r = 0;
                g = Math.floor(34 * t);
                b = Math.floor(34 + (85 - 34) * t);
            } else {
                let t = (depth - 0.5) / 0.5;
                r = 0;
                g = Math.floor(34 + (102 - 34) * t);
                b = Math.floor(85 + (170 - 85) * t);
            }

            // ST Hard Banding Stripe
            let isStripe = (depth > 0.65 && Math.floor(y / 4) % 3 === 0);
            if (isStripe) {
                this.cachedWaterColors[i] = rgbToHex(...quantizeAtari9Bit(0, 0, 51));
            } else {
                this.cachedWaterColors[i] = rgbToHex(...quantizeAtari9Bit(r, g, b));
            }

            let shading = Math.max(0.15, 1.0 - depth * 0.72);
            this.cachedRefColors[i] = rgbToHex(...quantizeAtari9Bit(255 * shading, 102 * shading, 0));
        }
    }

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
            targetSpeed = 1.25;             
            targetWaveSpeed = 1.8;         
            beatIntensity = 0.35;           
        } else if (state === 'climax') {
            targetSpeed = 2.0;
            targetWaveSpeed = 4.2;         
            beatIntensity = 1.0;           
        }

        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * 0.05;
        this.smoothedWaveSpeed += (targetWaveSpeed - this.smoothedWaveSpeed) * 0.05;
        
        this.internalT += dt * this.smoothedSpeed;
        this.waterT += dt * this.smoothedWaveSpeed;

        const beat = metrics.beat[0];
        this.sunPulse += (beat * beatIntensity * 0.15 - this.sunPulse) * 0.1;

        if (this.cachedWidth !== width || this.cachedHeight !== height) {
            this.cachedWidth = width;
            this.cachedHeight = height;
            this.rebuildWaterCache(width, height);
        }

        ctx.globalAlpha = globalAlpha;
        
        const horizon = Math.floor(height * 0.55); 
        const minDim = Math.min(width, height);

        let skyJitterY = 0;
        if (Math.sin(t * 1.5) > 0.97) {
            skyJitterY = Math.floor(Math.sin(t * 60) * 1.2);
        }

        // --- LAYER 1: THE 8-BAND ATARI SKY ---
        const bandH = Math.ceil(horizon / this.copperPalette.length);
        for (let i = 0; i < this.copperPalette.length; i++) {
            ctx.fillStyle = this.copperPalette[i];
            let startY = Math.floor(i * bandH) + skyJitterY;
            let endY = Math.floor((i + 1) * bandH) + skyJitterY;
            if (startY < horizon) {
                ctx.fillRect(0, startY, width, Math.min(horizon, endY) - startY);
            }
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
            if (this.starT >= Math.PI) {
                this.starActive = false;
            } else {
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

        // --- LAYER 3: ATARI SUN (Asymmetrisch, breiter) ---
        let sunR = Math.floor(minDim * 0.23); 
        let sx = Math.floor(width * 0.44); // Asymmetrischer Offset
        let sy = Math.floor(horizon - 10) + skyJitterY;

        for (let dy = -sunR; dy <= sunR; dy += 2) {
            let yLine = sy + dy;
            if (yLine >= horizon) continue; 

            let dx = Math.round(Math.sqrt(sunR * sunR - dy * dy));
            let rDist = Math.abs(dy) / sunR;

            let sunColor = this.sunCoreColor;
            if (rDist > 0.82) sunColor = this.sunColorRed; 
            else if (rDist > 0.55) sunColor = this.sunColorOrange; 
            else if (rDist > 0.28) sunColor = this.sunColorYellow; 
            
            // Hardcore Zebra-Gaps on Climax
            if (beat > 0.75 && (yLine % 4 === 0)) continue;

            ctx.fillStyle = sunColor;
            ctx.fillRect(sx - dx, yLine, dx * 2, 2);
        }

        // --- LAYER 4: ANTICS: MOUNTING CLOUD ---
        this.cloudSpeedOffset += (beat * 14.0 - this.cloudSpeedOffset) * 0.08;
        this.cloudX += dt * (2.2 + this.cloudSpeedOffset);
        if (this.cloudX > width + 60) this.cloudX = -60;

        let cx = Math.floor(this.cloudX);
        let cy = Math.floor(this.cloudY) + skyJitterY;
        
        ctx.fillStyle = this.reflectionColor;
        fillAliasedCircle(ctx, cx, cy + 2, 13, this.reflectionColor);
        fillAliasedCircle(ctx, cx - 11, cy + 3, 9, this.reflectionColor);
        fillAliasedCircle(ctx, cx + 11, cy + 3, 9, this.reflectionColor);
        
        ctx.fillStyle = this.sunCoreColor;
        fillAliasedCircle(ctx, cx, cy, 12, this.sunCoreColor);
        fillAliasedCircle(ctx, cx - 11, cy + 1, 8, this.sunCoreColor);
        fillAliasedCircle(ctx, cx + 11, cy + 1, 8, this.sunCoreColor);

        // --- LAYER 5: PARALLAX MOUNTAINS ---
        this.bgScroll = (this.bgScroll + dt * 4.8) % width;
        this.drawMountainRange(ctx, width, horizon, this.mountains1, this.mountain1Color, this.bgScroll, 0.35, false);

        this.fgScroll = (this.fgScroll + dt * 10.8) % width;
        this.drawMountainRange(ctx, width, horizon, this.mountains2, this.mountain2Color, this.fgScroll, 0.22, true);

        // --- LAYER 6: SHIMMERING HORIZON-GLOW ---
        let horizonFlicker = Math.floor(t * 30) % 2 === 0;
        if (horizonFlicker) {
            ctx.fillStyle = this.sunColorYellow;
            let hStart = sx - Math.floor(sunR * 0.65);
            let hWidth = Math.floor(sunR * 1.3);
            ctx.fillRect(hStart, horizon, hWidth, 1);
        }

        // --- LAYER 7: BOB ROSS "VERTICAL PULL" ---
        ctx.save();
        ctx.globalAlpha = globalAlpha * 0.35; 
        let bgRefWobble = this.bgScroll + Math.sin(this.waterT * 2.5) * 6;
        let fgRefWobble = this.fgScroll + Math.cos(this.waterT * 2.5) * 8;
        this.drawMirroredMountainRange(ctx, width, horizon, this.mountains1, this.mountain1Color, bgRefWobble, 0.35);
        this.drawMirroredMountainRange(ctx, width, horizon, this.mountains2, this.mountain2Color, fgRefWobble, 0.22);
        ctx.restore();

        // --- LAYER 8: SHIMMERING WATER & HORIZONTAL WHISPERS ---
        const numLines = this.cachedWaterColors.length;
        const activeBeatDistortion = beat * beatIntensity * 4.0; 
        const distortion = 1.5 + (activeBeatDistortion * 2.0);

        for (let i = 0; i < numLines; i++) {
            let y = horizon + i * 2;
            let depth = (y - horizon) / (height - horizon);
            let waveWidth = (minDim * 0.065) + (depth * (minDim * 0.28));

            let wobble = Math.sin((y * 0.08) + (this.waterT * 3.8)) * distortion;
            let lineJitter = Math.floor(Math.sin(y * 0.5 + this.waterT * 10.0) * 1.2);
            let lineNoiseX = Math.sin((y * 1.8) + (this.waterT * 8.0)) * 2.5; 
            let xOffset = wobble + lineJitter + lineNoiseX;

            let shimmer = Math.sin((y * 0.45) + (this.waterT * 12.0));
            if (shimmer < -0.15) {
                ctx.fillStyle = this.cachedWaterColors[i];
                ctx.fillRect(0, y, width, 2);
                continue;
            }

            ctx.fillStyle = this.cachedWaterColors[i];
            ctx.fillRect(0, y, width, 2);

            let lx = sx - (waveWidth / 2) + xOffset;

            // Atari ST Glitch Stripes auf extremen Transienten (anstatt Ripple)
            if (activeBeatDistortion > 2.0 && Math.random() > 0.75) {
                ctx.fillStyle = this.glitchColor;
                ctx.fillRect(0, y, width, 1);
            } else {
                ctx.fillStyle = this.cachedRefColors[i];
                ctx.fillRect(Math.floor(lx), y, Math.floor(waveWidth), 2);
                
                let coreShimmer = Math.sin((y * 0.9) + (this.waterT * 18.0));
                if (coreShimmer > 0.1) {
                    let coreW = waveWidth * 0.28 * (1.0 - depth * 0.45);
                    ctx.fillStyle = this.sunCoreColor;
                    ctx.fillRect(Math.floor(sx - (coreW / 2) + xOffset * 0.5), y, Math.floor(coreW), 2);
                }

                // Liquid White Ripples
                let rippleNoise = Math.sin(y * 0.95 + this.waterT * 7.0);
                if (rippleNoise > 0.94) {
                    let rx = sx + Math.sin(y * 12.3) * (width * 0.35);
                    let rW = 8 + Math.abs(Math.sin(y)) * 14;
                    ctx.fillStyle = this.sunCoreColor;
                    ctx.fillRect(Math.floor(rx - rW/2), y, Math.floor(rW), 1); 
                }
            }
        }

        // --- LAYER 9: ANTICS: GLIDING SEAGULLS ---
        let flockInactive = !this.birdActive[0] && !this.birdActive[1] && !this.birdActive[2];
        if (flockInactive && Math.random() < 0.0035) {
            let baseSpeed = 24 + Math.random() * 10;
            let baseRowY = Math.floor(horizon * 0.45 + Math.random() * horizon * 0.25);
            
            this.birdActive[0] = true; this.birdX[0] = width + 20; this.birdY[0] = baseRowY; this.birdSpeed[0] = baseSpeed; this.birdPhase[0] = 0.0;
            this.birdActive[1] = true; this.birdX[1] = width + 48; this.birdY[1] = baseRowY - 10; this.birdSpeed[1] = baseSpeed; this.birdPhase[1] = 0.5;
            this.birdActive[2] = true; this.birdX[2] = width + 58; this.birdY[2] = baseRowY + 10; this.birdSpeed[2] = baseSpeed; this.birdPhase[2] = 1.0;
        }

        for (let b = 0; b < 3; b++) {
            if (this.birdActive[b]) {
                this.birdX[b] -= dt * (this.birdSpeed[b] + beat * 35.0);
                this.birdYOffset[b] = Math.sin(t * 3.5 + this.birdPhase[b]) * 5.0 + (Math.sin(t * 12.0) * 1.0);
                
                if (this.birdX[b] < -30) {
                    this.birdActive[b] = false;
                } else {
                    let bx = Math.floor(this.birdX[b]);
                    let by = Math.floor(this.birdY[b] + this.birdYOffset[b]) + skyJitterY;
                    
                    let flap = Math.sin(t * 10.0 + beat * 15.0 + this.birdPhase[b] * Math.PI) > 0;
                    let wingY = flap ? -3 : 3;
                    
                    drawAliasedLine(ctx, bx - 4, by + wingY, bx, by, this.mountain1Color);
                    drawAliasedLine(ctx, bx, by, bx + 4, by + wingY, this.mountain1Color);
                }
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