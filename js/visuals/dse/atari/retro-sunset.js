// === js/visuals/dse/atari/retro-sunset.js ===
import { quantizeAtari9Bit, rgbToHex, fillAliasedCircle, drawAliasedLine } from '../../utils/hardware-constraints.js';

export class AtariRetroSunset {
    constructor() {
        this.internalT = 0;
        this.waterT = 0;
        this.smoothedSpeed = 1.0;
        this.lastT = 0;

        // Pre-allocated Arrays for Zero-Allocation Rendering
        this.clouds = [];
        this.shrines = [];
        this.leafClusters = [];
        this.leaves = [];

        this.ensureInitialized();
    }

    ensureInitialized() {
        if (this.initialized) return;

        // --- STRICT ATARI ST 9-BIT SHIFTER PALETTE (512 Colors) ---
        // Sky Gradient (Magenta -> Red -> Orange -> Yellowish)
        this.cSkyTop  = rgbToHex(...quantizeAtari9Bit(68, 0, 68));    
        this.cSkyMid1 = rgbToHex(...quantizeAtari9Bit(136, 0, 34));   
        this.cSkyMid2 = rgbToHex(...quantizeAtari9Bit(204, 68, 0));   
        this.cSkyBot  = rgbToHex(...quantizeAtari9Bit(255, 170, 102));

        this.cSun = rgbToHex(...quantizeAtari9Bit(255, 204, 0));      

        // Water
        this.cWaterDark  = rgbToHex(...quantizeAtari9Bit(0, 0, 51));  
        this.cWaterLight = rgbToHex(...quantizeAtari9Bit(0, 68, 136));
        this.cWaterRefl  = rgbToHex(...quantizeAtari9Bit(255, 255, 136)); 

        // Architecture & Path
        this.cTorii     = rgbToHex(...quantizeAtari9Bit(34, 17, 0));  
        this.cToriiHigh = rgbToHex(...quantizeAtari9Bit(85, 34, 0));  
        
        this.cPathLight = rgbToHex(...quantizeAtari9Bit(136, 136, 136)); 
        this.cPathDark  = rgbToHex(...quantizeAtari9Bit(68, 68, 68));    
        this.cPathLine  = rgbToHex(...quantizeAtari9Bit(17, 17, 17));    

        // Vegetation (Autumn Bonsai Colors)
        this.cTreeTrunk = rgbToHex(...quantizeAtari9Bit(68, 34, 0));  
        this.cLeaf1 = rgbToHex(...quantizeAtari9Bit(255, 136, 0));    // Orange
        this.cLeaf2 = rgbToHex(...quantizeAtari9Bit(204, 170, 0));    // Gelbgrün
        this.cLeaf3 = rgbToHex(...quantizeAtari9Bit(85, 136, 0));     // Mid Green
        this.cGrass = rgbToHex(...quantizeAtari9Bit(34, 102, 0));     // Dark Green

        this.cLantern1 = rgbToHex(...quantizeAtari9Bit(204, 34, 0));  
        this.cLantern2 = rgbToHex(...quantizeAtari9Bit(255, 136, 0)); 

        this.cCloud1 = rgbToHex(...quantizeAtari9Bit(204, 68, 102));  
        this.cCloud2 = rgbToHex(...quantizeAtari9Bit(255, 136, 170)); 
        this.cCloud3 = rgbToHex(...quantizeAtari9Bit(255, 204, 204)); 

        // --- PRE-CALCULATE STATIC STRUCTURES ---
        
        // Wolken (Relativ-Koordinaten)
        this.clouds = [
            { y: 0.15, x: 0.2, w: 0.3, col: this.cCloud1, phase: 0 },
            { y: 0.17, x: 0.22, w: 0.25, col: this.cCloud2, phase: 1 },
            { y: 0.22, x: 0.6, w: 0.28, col: this.cCloud1, phase: 2 },
            { y: 0.24, x: 0.55, w: 0.35, col: this.cCloud2, phase: 3 },
            { y: 0.26, x: 0.58, w: 0.2, col: this.cCloud3, phase: 4 },
            { y: 0.35, x: 0.1, w: 0.4, col: this.cCloud2, phase: 5 },
            { y: 0.37, x: 0.15, w: 0.2, col: this.cCloud3, phase: 6 }
        ];

        // --- THE BONSAI TREE LOGIC ---
        // Vordefinierte Ast-Zentren (relativ zur Höhe/Breite des Stamms)
        this.leafClusters = [
            { dx: -0.12, dy: -0.15, r: 0.08 }, // Ast 1: Links Mitte
            { dx: -0.04, dy: -0.28, r: 0.11 }, // Ast 2: Oben Mitte
            { dx:  0.08, dy: -0.22, r: 0.09 }, // Ast 3: Rechts Oben
            { dx:  0.09, dy: -0.10, r: 0.07 }  // Ast 4: Rechts Unten
        ];

        // Dicht gepacktes Laub um die Zweige (Square Root Sampling)
        for (let c of this.leafClusters) {
            // 45 Pixel pro Cluster für eine dichte Wolken-Ästhetik
            for (let i = 0; i < 45; i++) {
                let angle = Math.random() * Math.PI * 2;
                // sqrt sorgt für dichtere Packung im Zentrum des Astes
                let dist = Math.sqrt(Math.random()) * c.r; 
                this.leaves.push({
                    cdx: c.dx, cdy: c.dy, // Cluster-Zentrum
                    lx: Math.cos(angle) * dist,
                    ly: Math.sin(angle) * dist,
                    size: Math.floor(Math.random() * 3) + 2, // 2-4 px
                    colIdx: Math.random() > 0.55 ? 0 : (Math.random() > 0.4 ? 1 : 2),
                    phase: Math.random() * Math.PI * 2
                });
            }
        }

        // Schreine (Z-Tiefe für perspektivisches Sortieren)
        this.shrines = [
            { xDir: -1, z: 0.8 }, { xDir: 1, z: 0.8 },
            { xDir: -1, z: 0.5 }, { xDir: 1, z: 0.5 },
            { xDir: -1, z: 0.15 }, { xDir: 1, z: 0.15 }
        ];

        this.initialized = true;
    }

    resize(width, height) {}

    drawDitheredBand(ctx, width, yStart, yEnd, col1, col2) {
        for (let y = yStart; y < yEnd; y++) {
            ctx.fillStyle = (y % 2 === 0) ? col1 : col2;
            ctx.fillRect(0, y, width, 1);
        }
    }

    render(ctx, width, height, t, state, stateTime, metrics) {
        this.ensureInitialized(); 
        
        if (state === 'idle') { this.lastT = t; return; }
        let dt = this.lastT === 0 ? 0.016 : t - this.lastT;
        this.lastT = t;

        let globalAlpha = 1.0;
        let targetSpeed = 1.0;
        
        if (state === 'starting') {
            globalAlpha = Math.min(1.0, stateTime / 1.5);
        } else if (state === 'stopping') {
            globalAlpha = Math.max(0.0, 1.0 - (stateTime / 1.5));
        } else if (state === 'buildup') {
            targetSpeed = 1.5;             
        } else if (state === 'climax') {
            targetSpeed = 2.5; 
        }

        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * 0.05;
        this.internalT += dt * this.smoothedSpeed;
        this.waterT += dt * this.smoothedSpeed;

        const beat = metrics.beat[0];
        ctx.globalAlpha = globalAlpha;
        
        const horizon = Math.floor(height * 0.55); 
        const cx = Math.floor(width / 2);
        const minDim = Math.min(width, height);

        // =========================================================
        // 1. THE SKY (Atari Banding & Dithering)
        // =========================================================
        const h0 = 0;
        const h1 = Math.floor(horizon * 0.3);
        const h2 = Math.floor(horizon * 0.4);
        const h3 = Math.floor(horizon * 0.7);
        const h4 = Math.floor(horizon * 0.85);

        ctx.fillStyle = this.cSkyTop;
        ctx.fillRect(0, 0, width, h1);
        this.drawDitheredBand(ctx, width, h1, h2, this.cSkyTop, this.cSkyMid1);
        ctx.fillStyle = this.cSkyMid1;
        ctx.fillRect(0, h2, width, h3 - h2);
        this.drawDitheredBand(ctx, width, h3, h4, this.cSkyMid1, this.cSkyMid2);
        ctx.fillStyle = this.cSkyMid2;
        ctx.fillRect(0, h4, width, horizon - h4);
        
        ctx.fillStyle = this.cSkyBot;
        ctx.fillRect(0, horizon - 2, width, 2);

        // =========================================================
        // 2. THE CLOUDS
        // =========================================================
        for (let i = 0; i < this.clouds.length; i++) {
            let c = this.clouds[i];
            let cy = Math.floor(horizon * c.y);
            let shimmerW = Math.floor(Math.sin(this.internalT * 2.0 + c.phase) * 4);
            let cw = Math.floor(width * c.w) + shimmerW;
            let cxCloud = Math.floor(width * c.x);

            ctx.fillStyle = c.col;
            ctx.fillRect(cxCloud, cy, cw, 2);
            ctx.fillRect(cxCloud - 4, cy, 2, 1);
            ctx.fillRect(cxCloud + cw + 2, cy + 1, 2, 1);
        }

        // =========================================================
        // 3. THE BEAT-PULSING SUN
        // =========================================================
        // Dynamische Größe durch den Transienten-Envelope
        const activeSunPulse = Math.floor(beat * minDim * 0.035);
        const sunR = Math.floor(minDim * 0.14) + activeSunPulse;
        
        fillAliasedCircle(ctx, cx, horizon - sunR + 4, sunR, this.cSun);

        // =========================================================
        // 4. THE WATER & REFLECTION
        // =========================================================
        ctx.fillStyle = this.cWaterDark;
        ctx.fillRect(0, horizon, width, height - horizon);

        ctx.fillStyle = this.cWaterLight;
        for (let y = horizon + 2; y < height; y += 4) {
            ctx.fillRect(0, y, width, 1);
            ctx.fillRect(Math.floor(width * 0.2), y + 2, Math.floor(width * 0.6), 1);
        }

        ctx.fillStyle = this.cWaterRefl;
        for (let y = horizon + 2; y < height; y += 2) {
            let depth = (y - horizon) / (height - horizon);
            let shimmer = Math.sin(y * 0.8 + this.waterT * 5.0) + (beat * 0.5);
            
            if (shimmer > -0.2) {
                let rWidth = 10 + (depth * 40);
                rWidth *= (0.5 + Math.sin(y * 0.15) * 0.8);
                rWidth += beat * 16.0; // Kräftigeres Aufblitzen der Reflexion

                let jitterX = Math.floor(Math.sin(y * 0.5 + this.waterT * 8.0) * 2);
                ctx.fillRect(Math.floor(cx - rWidth / 2 + jitterX), y, Math.floor(rWidth), 1);
            }
        }

        // =========================================================
        // 5. STONE PATH
        // =========================================================
        for (let y = horizon; y <= height; y++) {
            let depth = (y - horizon) / (height - horizon); 
            let pathW = 10 + depth * 280; 
            let px = cx - pathW / 2;

            ctx.fillStyle = this.cPathLight;
            ctx.fillRect(Math.floor(px), y, Math.floor(pathW), 1);

            ctx.fillStyle = this.cPathLine;
            ctx.fillRect(Math.floor(px) - 1, y, 1, 1);
            ctx.fillRect(Math.floor(px + pathW), y, 1, 1);

            let gapFreq = Math.sin(Math.pow(depth, 0.5) * 40.0);
            if (gapFreq > 0.92) {
                ctx.fillStyle = this.cPathDark;
                ctx.fillRect(Math.floor(px), y, Math.floor(pathW), 1);
            }
        }

        // =========================================================
        // 6. SHRINES / BENCHES
        // =========================================================
        for (let i = 0; i < this.shrines.length; i++) {
            let s = this.shrines[i];
            let sy = Math.floor(horizon + s.z * (height - horizon));
            let sx = cx + s.xDir * (20 + s.z * 180);
            let sWidth = 15 + s.z * 40;
            let sHeight = 8 + s.z * 25;

            ctx.fillStyle = this.cPathDark;
            ctx.fillRect(Math.floor(sx - sWidth / 2), sy - sHeight, Math.floor(sWidth), sHeight);
            
            ctx.fillStyle = this.cPathLight;
            ctx.fillRect(Math.floor(sx - sWidth / 2 - 2), sy - sHeight - 2, Math.floor(sWidth + 4), 3);

            let flicker = Math.sin(this.internalT * 8.0 + i) > 0 ? 1 : 0;
            ctx.fillStyle = this.cGrass;
            ctx.fillRect(Math.floor(sx - sWidth / 2 - 4), sy - 1, 3 + flicker, 2);
            ctx.fillRect(Math.floor(sx + sWidth / 2 + 1), sy - 2 + flicker, 2, 2);
        }

        // =========================================================
        // 7. THE TORII GATE
        // =========================================================
        const toriiTop = horizon - 90;
        const toriiBot = horizon + 50;

        for (let y = toriiTop; y <= toriiBot; y++) {
            let depth = (y - toriiTop) / (toriiBot - toriiTop);
            let offset = 45 + depth * 15; 
            let postW = 8 + depth * 6;
            
            let pxLeft = cx - offset - postW / 2;
            let pxRight = cx + offset - postW / 2;

            ctx.fillStyle = this.cTorii;
            ctx.fillRect(Math.floor(pxLeft), y, Math.floor(postW), 1);
            ctx.fillRect(Math.floor(pxRight), y, Math.floor(postW), 1);

            ctx.fillStyle = this.cToriiHigh;
            ctx.fillRect(Math.floor(pxLeft + postW - 2), y, 2, 1);
            ctx.fillRect(Math.floor(pxRight + postW - 2), y, 2, 1);

            if (y > horizon - 60 && y < horizon && y % 12 < 4) {
                ctx.fillStyle = this.cSun;
                ctx.fillRect(Math.floor(cx - offset - 1), y, 2, 1);
                ctx.fillRect(Math.floor(cx + offset - 1), y, 2, 1);
            }
        }

        ctx.fillStyle = this.cTorii;
        ctx.fillRect(cx - 75, toriiTop, 150, 6);
        ctx.fillStyle = this.cToriiHigh;
        ctx.fillRect(cx - 75, toriiTop, 150, 1);

        ctx.fillStyle = this.cTorii;
        ctx.fillRect(cx - 65, toriiTop + 12, 130, 4);

        const lanternX = [cx - 35, cx - 15, cx + 15, cx + 35];
        for (let i = 0; i < 4; i++) {
            let swing = Math.sin(this.internalT * 2.5 + i) * (2 + beat * 4.0);
            let lx = Math.floor(lanternX[i] + swing);
            let ly = toriiTop + 16;
            
            ctx.fillStyle = this.cPathLine;
            ctx.fillRect(lx, ly, 1, 6);
            
            ctx.fillStyle = (i % 2 === 0) ? this.cLantern1 : this.cLantern2;
            ctx.fillRect(lx - 3, ly + 6, 7, 8);
            
            ctx.fillStyle = this.cSun;
            ctx.fillRect(lx - 1, ly + 8, 3, 4);
        }

        // =========================================================
        // 8. THE BONSAI TREE (Redesign)
        // =========================================================
        let trunkBaseX = width - Math.floor(minDim * 0.15); // ca. 15% vom rechten Rand
        let trunkBaseY = horizon + 10;
        let trunkTopY = horizon - Math.floor(minDim * 0.28); // Stamm endet sicher unterhalb des Bildschirms!
        
        // 8a. Stamm zeichnen
        for (let y = trunkTopY; y <= trunkBaseY; y++) {
            let depth = (y - trunkTopY) / (trunkBaseY - trunkTopY);
            let tw = 5 + Math.pow(depth, 1.8) * 16; // Wurzelt sich weich auf
            let tx = trunkBaseX + Math.sin(depth * 2) * 8; // Stammkrümmung

            ctx.fillStyle = this.cTreeTrunk;
            ctx.fillRect(Math.floor(tx - tw/2), y, Math.floor(tw), 1);

            // Rinde
            if (y % 4 === 0) {
                ctx.fillStyle = this.cToriiHigh;
                ctx.fillRect(Math.floor(tx - tw/2 + 2), y, Math.floor(tw * 0.4), 1);
            }
        }

        let branchBaseX = trunkBaseX + Math.sin(0) * 8; // Startpunkt der Äste an der Baumkrone

        // 8b. Verzweigte Äste zeichnen
        for (let c of this.leafClusters) {
            let destX = trunkBaseX + Math.floor(c.dx * minDim);
            let destY = trunkBaseY + Math.floor(c.dy * minDim);
            
            // Bresenham-Linie für die Äste, gedoppelt für 2px Dicke
            drawAliasedLine(ctx, branchBaseX, trunkTopY + 5, destX, destY, this.cTreeTrunk);
            drawAliasedLine(ctx, branchBaseX - 1, trunkTopY + 5, destX - 1, destY, this.cTreeTrunk);
        }

        // 8c. Dichte Laub-Wolken zeichnen (atmend)
        for (let l of this.leaves) {
            let lx = trunkBaseX + (l.cdx * minDim) + (l.lx * minDim);
            let ly = trunkBaseY + (l.cdy * minDim) + (l.ly * minDim);
            
            let rustleX = Math.round(Math.sin(this.internalT * 3.0 + l.phase) * (1.0 + beat * 2.0));
            let rustleY = Math.round(Math.cos(this.internalT * 2.0 + l.phase) * (0.5 + beat * 1.0));
            
            let col = l.colIdx === 0 ? this.cLeaf1 : (l.colIdx === 1 ? this.cLeaf2 : this.cLeaf3);
            ctx.fillStyle = col;
            ctx.fillRect(Math.floor(lx + rustleX), Math.floor(ly + rustleY), l.size, l.size);
        }

        ctx.globalAlpha = 1.0;
    }
}