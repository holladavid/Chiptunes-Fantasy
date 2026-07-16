// === js/visuals/dse/atari/retro-sunset.js ===
import { quantizeAtari9Bit, rgbToHex, fillAliasedCircle, drawAliasedLine } from '../../utils/hardware-constraints.js';

export class AtariRetroSunset {
    constructor() {
        this.internalT = 0;
        this.waterT = 0;
        this.lastT = 0;
        
        // Zero-Allocation Arrays
        this.clouds = [];
        this.leafClusters = [];
        this.treeLeaves = [];
        this.shrines = [];
        
        this.initialized = false;
        this.ensureInitialized();
    }

    ensureInitialized() {
        if (this.initialized) return;

        // --- STRICT ATARI ST 9-BIT SHIFTER PALETTE (IK+ Match) ---
        // Sky (Magenta -> Red -> Orange -> Pale Yellow)
        this.cSky1 = rgbToHex(...quantizeAtari9Bit(0, 0, 0));       
        this.cSky2 = rgbToHex(...quantizeAtari9Bit(136, 0, 102));   
        this.cSky3 = rgbToHex(...quantizeAtari9Bit(204, 34, 68));   
        this.cSky4 = rgbToHex(...quantizeAtari9Bit(255, 102, 68));  
        this.cSky5 = rgbToHex(...quantizeAtari9Bit(255, 204, 136)); 

        // Clouds
        this.cCloudW = rgbToHex(...quantizeAtari9Bit(255, 255, 255)); 
        this.cCloudP = rgbToHex(...quantizeAtari9Bit(204, 136, 170)); 
        this.cCloudD = rgbToHex(...quantizeAtari9Bit(136, 68, 102));  

        this.cSun = rgbToHex(...quantizeAtari9Bit(255, 255, 0));      

        // Water
        this.cWater      = rgbToHex(...quantizeAtari9Bit(34, 68, 255)); 
        this.cWaterDark  = rgbToHex(...quantizeAtari9Bit(0, 34, 170));  
        this.cWaterRefl  = rgbToHex(...quantizeAtari9Bit(255, 255, 0)); 
        this.cWaterRefl2 = rgbToHex(...quantizeAtari9Bit(255, 136, 0)); 

        // Mountains & Buildings
        this.cMountain = rgbToHex(...quantizeAtari9Bit(34, 17, 17));    
        this.cBuilding = rgbToHex(...quantizeAtari9Bit(255, 255, 255)); 

        // Architecture (Torii & Shrines)
        this.cTorii     = rgbToHex(...quantizeAtari9Bit(17, 0, 0));     
        this.cToriiHigh = rgbToHex(...quantizeAtari9Bit(85, 34, 17));   
        this.cKanji     = rgbToHex(...quantizeAtari9Bit(255, 170, 0));  
        
        this.cStoneLight = rgbToHex(...quantizeAtari9Bit(170, 170, 170)); 
        this.cStoneMid   = rgbToHex(...quantizeAtari9Bit(102, 102, 102)); 
        this.cStoneDark  = rgbToHex(...quantizeAtari9Bit(51, 51, 51));    
        this.cStoneLine  = rgbToHex(...quantizeAtari9Bit(17, 17, 17));    

        // Vegetation (Bonsai Colors)
        this.cTreeTrunk = rgbToHex(...quantizeAtari9Bit(102, 51, 0));   
        this.cLeaf1 = rgbToHex(...quantizeAtari9Bit(136, 204, 34));     
        this.cLeaf2 = rgbToHex(...quantizeAtari9Bit(255, 204, 0));      
        this.cLeaf3 = rgbToHex(...quantizeAtari9Bit(255, 102, 0));      
        this.cMoss  = rgbToHex(...quantizeAtari9Bit(51, 204, 51));      

        // --- PRE-CALCULATED STRUCTURES ---
        
        // Clouds
        this.clouds = [
            { y: 0.1, x: 0.2, w: 0.6, h: 0.15 },
            { y: 0.25, x: 0.0, w: 0.4, h: 0.1 },
            { y: 0.3, x: 0.5, w: 0.5, h: 0.12 },
            { y: 0.5, x: 0.1, w: 0.8, h: 0.08 }
        ];

        // The Bonsai Branch Logic
        this.leafClusters = [
            { dx: -0.15, dy: -0.02, r: 0.10 }, // Links unten
            { dx: -0.06, dy: -0.15, r: 0.12 }, // Mitte hoch
            { dx:  0.08, dy: -0.12, r: 0.11 }, // Rechts hoch
            { dx:  0.18, dy:  0.02, r: 0.09 }  // Rechts unten
        ];

        // Populate tree leaves around branches
        for (let c of this.leafClusters) {
            for(let i = 0; i < 40; i++) {
                let angle = Math.random() * Math.PI * 2;
                let dist = Math.sqrt(Math.random()) * c.r;
                this.treeLeaves.push({
                    dx: c.dx + Math.cos(angle) * dist,
                    dy: c.dy + Math.sin(angle) * dist * 0.8,
                    r: Math.floor(Math.random() * 4) + 2,
                    col: Math.random() > 0.6 ? this.cLeaf1 : (Math.random() > 0.3 ? this.cLeaf2 : this.cLeaf3),
                    phase: Math.random() * Math.PI * 2
                });
            }
        }

        // Shrines/Benches (Z-Depth relative to SHORE, not horizon)
        this.shrines = [
            { xDir: -1, z: 0.85 }, { xDir: 1, z: 0.85 },
            { xDir: -1, z: 0.55 }, { xDir: 1, z: 0.55 },
            { xDir: -1, z: 0.25 }, { xDir: 1, z: 0.25 },
            { xDir: -1, z: 0.05 }, { xDir: 1, z: 0.05 }
        ];

        this.initialized = true;
    }

    resize(width, height) {}

    drawDitherRect(ctx, x, y, w, h, col1, col2) {
        x = Math.floor(x); y = Math.floor(y); w = Math.floor(w); h = Math.floor(h);
        for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                ctx.fillStyle = ((dx + dy) % 2 === 0) ? col1 : col2;
                ctx.fillRect(x + dx, y + dy, 1, 1);
            }
        }
    }

    drawDitheredBand(ctx, width, yStart, yEnd, col1, col2) {
        yStart = Math.floor(yStart); yEnd = Math.floor(yEnd);
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
        let speedMult = 1.0;
        
        if (state === 'starting') {
            globalAlpha = Math.min(1.0, stateTime / 1.5);
        } else if (state === 'stopping') {
            globalAlpha = Math.max(0.0, 1.0 - (stateTime / 1.5));
        } else if (state === 'buildup') {
            speedMult = 1.5;             
        } else if (state === 'climax') {
            speedMult = 2.5; 
        }

        this.internalT += dt * speedMult;
        this.waterT += dt * speedMult;

        const beat = metrics.beat[0];
        ctx.globalAlpha = globalAlpha;
        
        const horizon = Math.floor(height * 0.55); 
        const minDim = Math.min(width, height);
        const cx = Math.floor(width / 2);

        // =========================================================
        // DIE UFERKANTE (Trennt das Wasser sauber vom Steinweg ab)
        // =========================================================
        const shoreY = horizon + Math.floor(minDim * 0.15); 

        // =========================================================
        // 1. THE SKY (Atari Banding & Dithering)
        // =========================================================
        const h1 = Math.floor(horizon * 0.15);
        const h2 = Math.floor(horizon * 0.35);
        const h3 = Math.floor(horizon * 0.6);
        const h4 = Math.floor(horizon * 0.85);

        ctx.fillStyle = this.cSky1;
        ctx.fillRect(0, 0, width, h1);
        this.drawDitheredBand(ctx, width, h1, h2, this.cSky1, this.cSky2);
        
        ctx.fillStyle = this.cSky2;
        ctx.fillRect(0, h2, width, h3 - h2);
        
        this.drawDitheredBand(ctx, width, h3, h4, this.cSky2, this.cSky3);
        
        ctx.fillStyle = this.cSky3;
        ctx.fillRect(0, h4, width, horizon - h4);
        
        this.drawDitheredBand(ctx, width, horizon - Math.floor(horizon*0.1), horizon, this.cSky3, this.cSky4);
        
        ctx.fillStyle = this.cSky5;
        ctx.fillRect(0, horizon - 2, width, 2);

        // =========================================================
        // 2. THE CLOUDS
        // =========================================================
        for (let i = 0; i < this.clouds.length; i++) {
            let c = this.clouds[i];
            let cy = Math.floor(horizon * c.y);
            let ch = Math.floor(horizon * c.h);
            let cw = Math.floor(width * c.w);
            let cxCloud = Math.floor(width * c.x);

            let drift = Math.floor(this.internalT * 2.0 * (i % 2 === 0 ? 1 : -1));
            cxCloud += drift;

            this.drawDitherRect(ctx, cxCloud, cy, cw, ch, this.cCloudW, this.cCloudP);
            this.drawDitherRect(ctx, cxCloud + 10, cy + ch - 4, cw - 20, 4, this.cCloudP, this.cCloudD);
        }

        // =========================================================
        // 3. THE MOUNTAINS 
        // =========================================================
        ctx.fillStyle = this.cMountain;
        
        ctx.beginPath();
        ctx.moveTo(0, horizon);
        ctx.lineTo(0, horizon - Math.floor(horizon * 0.4));
        ctx.lineTo(Math.floor(width * 0.15), horizon - Math.floor(horizon * 0.2));
        ctx.lineTo(Math.floor(width * 0.35), horizon);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(width, horizon);
        ctx.lineTo(width, horizon - Math.floor(horizon * 0.35));
        ctx.lineTo(Math.floor(width * 0.8), horizon - Math.floor(horizon * 0.15));
        ctx.lineTo(Math.floor(width * 0.65), horizon);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = this.cBuilding;
        ctx.fillRect(Math.floor(width * 0.05), horizon - 6, 12, 6);
        ctx.fillStyle = this.cStoneLine;
        ctx.fillRect(Math.floor(width * 0.05) + 3, horizon - 4, 3, 4); 
        
        ctx.fillStyle = this.cBuilding;
        ctx.fillRect(Math.floor(width * 0.75), horizon - 8, 16, 8);
        ctx.fillStyle = this.cStoneLine;
        ctx.fillRect(Math.floor(width * 0.75) + 5, horizon - 5, 4, 5);

        // =========================================================
        // 4. THE PULSING SUN
        // =========================================================
        // Der Beat lässt die Sonne majestätisch aufatmen!
        let baseSunR = Math.floor(minDim * 0.12);
        let activeSunR = baseSunR + Math.floor(beat * minDim * 0.035);
        
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, width, horizon); 
        ctx.clip();
        fillAliasedCircle(ctx, cx, horizon, activeSunR, this.cSun);
        ctx.restore();

        // =========================================================
        // 5. THE WATER & REFLECTION (Geklippt auf die Uferkante!)
        // =========================================================
        ctx.fillStyle = this.cWater;
        ctx.fillRect(0, horizon, width, shoreY - horizon);

        ctx.fillStyle = this.cWaterDark;
        ctx.fillRect(0, horizon, Math.floor(width * 0.35), 4);
        ctx.fillRect(Math.floor(width * 0.65), horizon, width, 4);

        ctx.fillStyle = this.cWaterRefl;
        // Reflektion endet exakt am Ufer (shoreY)
        for (let y = horizon + 2; y < shoreY; y += 2) {
            let depth = (y - horizon) / (shoreY - horizon);
            
            let shimmer = Math.sin(y * 1.2 - this.waterT * 6.0);
            
            if (shimmer > -0.3) {
                let rWidth = activeSunR * 0.6 + (depth * activeSunR * 1.2);
                rWidth *= (0.5 + Math.sin(y * 0.15) * 0.8);
                rWidth += beat * 12.0;

                let jitterX = Math.floor(Math.sin(y * 0.5 + this.waterT * 8.0) * 2);
                
                ctx.fillStyle = this.cWaterRefl2;
                ctx.fillRect(Math.floor(cx - rWidth / 2 - 2 + jitterX), y, Math.floor(rWidth + 4), 1);
                
                ctx.fillStyle = this.cWaterRefl;
                if (depth > 0.3 && y % 4 === 0) {
                    let half = Math.floor(rWidth / 2);
                    ctx.fillRect(Math.floor(cx - rWidth / 2 + jitterX), y, half - 2, 1);
                    ctx.fillRect(Math.floor(cx + 2 + jitterX), y, half - 2, 1);
                } else {
                    ctx.fillRect(Math.floor(cx - rWidth / 2 + jitterX), y, Math.floor(rWidth), 1);
                }
            }
        }

        // =========================================================
        // 6. THE SHORELINE & STONE PATH
        // =========================================================
        // Basis-Uferkante zeichnen
        ctx.fillStyle = this.cStoneDark;
        ctx.fillRect(0, shoreY, width, height - shoreY);
        ctx.fillStyle = this.cStoneLine;
        ctx.fillRect(0, shoreY, width, 2);

        const pathBottomW = width * 0.9; 
        const pathTopW = width * 0.15;   

        // Weg rendert erst AB der Uferkante
        for (let y = shoreY; y <= height; y++) {
            // Perspektiven-Tiefe bleibt auf HORIZON gemünzt, damit die Fluchtlinie stimmt!
            let trueDepth = (y - horizon) / (height - horizon); 
            let pathW = pathTopW + trueDepth * (pathBottomW - pathTopW); 
            let px = cx - pathW / 2;

            ctx.fillStyle = this.cPathLight;
            ctx.fillRect(Math.floor(px), y, Math.floor(pathW), 1);

            ctx.fillStyle = this.cStoneLine;
            ctx.fillRect(Math.floor(px) - 1, y, 1, 1);
            ctx.fillRect(Math.floor(px + pathW), y, 1, 1);

            let gapFreq = Math.sin(Math.pow(trueDepth, 0.5) * 50.0);
            if (gapFreq > 0.95) {
                ctx.fillStyle = this.cPathDark;
                ctx.fillRect(Math.floor(px), y, Math.floor(pathW), 1);
            }

            let numLanes = 6;
            for (let lane = 1; lane < numLanes; lane++) {
                let laneNorm = (lane / numLanes) - 0.5; 
                let laneX = cx + (pathW * laneNorm);
                ctx.fillStyle = this.cStoneLine;
                ctx.fillRect(Math.floor(laneX), y, 1, 1);
            }

            if (y % 8 < 2 && trueDepth > 0.2) {
                ctx.fillStyle = this.cMoss;
                ctx.fillRect(Math.floor(px) - 2, y, 2, 1);
                ctx.fillRect(Math.floor(px + pathW), y, 2, 1);
            }
        }

        // =========================================================
        // 7. SHRINES / BENCHES (Placed exactly on the shore)
        // =========================================================
        for (let i = 0; i < this.shrines.length; i++) {
            let s = this.shrines[i];
            
            let scale = Math.pow(s.z, 1.5);
            // Y-Pos berechnet sich zwischen shoreY und height
            let sy = Math.floor(shoreY + scale * (height - shoreY));
            
            let trueDepth = (sy - horizon) / (height - horizon);
            let pathWAtZ = pathTopW + trueDepth * (pathBottomW - pathTopW);
            let sx = cx + s.xDir * (pathWAtZ / 2 + 10 + scale * 40);
            
            let sWidth = 8 + scale * 30;
            let sHeight = 15 + scale * 40;

            ctx.fillStyle = this.cPathDark;
            ctx.fillRect(Math.floor(sx - sWidth/2), sy - Math.floor(sHeight*0.2), Math.floor(sWidth), Math.floor(sHeight*0.2));
            
            ctx.fillStyle = this.cStoneMid;
            ctx.fillRect(Math.floor(sx - sWidth*0.25), sy - Math.floor(sHeight*0.7), Math.floor(sWidth*0.5), Math.floor(sHeight*0.5));
            
            ctx.fillStyle = this.cPathLight;
            ctx.fillRect(Math.floor(sx - sWidth*0.6), sy - Math.floor(sHeight*0.9), Math.floor(sWidth*1.2), Math.floor(sHeight*0.2));

            fillAliasedCircle(ctx, sx, sy - Math.floor(sHeight*0.9), Math.floor(sWidth*0.4), this.cStoneDark);

            ctx.fillStyle = this.cMoss;
            ctx.fillRect(Math.floor(sx - sWidth*0.5), sy - Math.floor(sHeight*0.7), 2, Math.floor(sHeight*0.3));
        }

        // =========================================================
        // 8. THE TORII GATE
        // =========================================================
        const toriiTop = horizon - 90;
        const toriiBot = shoreY + Math.floor(minDim * 0.05); // Steht massiv im Vordergrund!

        for (let y = toriiTop; y <= toriiBot; y++) {
            // Reale Perspektive zum Horizont
            let depth = (y - horizon) / (height - horizon);
            if (depth < 0) depth = 0;
            
            let offset = Math.floor(minDim * 0.22) + depth * Math.floor(minDim * 0.05); 
            let postW = Math.floor(minDim * 0.03) + depth * 4;
            
            let pxLeft = cx - offset - postW / 2;
            let pxRight = cx + offset - postW / 2;

            ctx.fillStyle = this.cTorii;
            ctx.fillRect(Math.floor(pxLeft), y, Math.floor(postW), 1);
            ctx.fillRect(Math.floor(pxRight), y, Math.floor(postW), 1);

            ctx.fillStyle = this.cToriiHigh;
            ctx.fillRect(Math.floor(pxLeft + postW - 2), y, 2, 1);
            ctx.fillRect(Math.floor(pxRight + postW - 2), y, 2, 1);

            if (y > toriiTop + 20 && y < toriiBot - 20 && (y * 7) % 11 < 3) {
                ctx.fillStyle = this.cKanji;
                ctx.fillRect(Math.floor(pxLeft + postW/2 - 1), y, 2, 1);
                ctx.fillRect(Math.floor(pxRight + postW/2 - 1), y, 2, 1);
            }
        }

        ctx.fillStyle = this.cTorii;
        let bWidth = Math.floor(minDim * 0.6);
        ctx.fillRect(cx - bWidth/2, toriiTop, bWidth, Math.floor(minDim * 0.04));
        ctx.fillStyle = this.cToriiHigh;
        ctx.fillRect(cx - bWidth/2, toriiTop, bWidth, 1);

        let bWidth2 = Math.floor(minDim * 0.5);
        ctx.fillStyle = this.cTorii;
        ctx.fillRect(cx - bWidth2/2, toriiTop + Math.floor(minDim * 0.06), bWidth2, Math.floor(minDim * 0.02));
        ctx.fillRect(cx - 2, toriiTop, 4, Math.floor(minDim * 0.06));

        // =========================================================
        // 9. THE BONSAI TREE (Solid & Rooted)
        // =========================================================
        let trunkBaseX = width - Math.floor(minDim * 0.15); 
        let trunkBaseY = shoreY + Math.floor(minDim * 0.15); // Wurzelt tief auf der Shore-Ebene
        let trunkTopY = shoreY - Math.floor(minDim * 0.25);  // Krone ragt hoch in den Himmel
        
        let crownBaseX = trunkBaseX + Math.sin(0) * Math.floor(minDim * 0.06);

        // 9a. Die knorrigen Äste zeichnen (Verbinden Stamm und Blatt-Cluster!)
        for (let c of this.leafClusters) {
            let endX = Math.floor(crownBaseX + c.dx * minDim);
            let endY = Math.floor(trunkTopY + c.dy * minDim);
            
            // Massiver Ast (3 Pixel breit für Pixel-Art-Vibe)
            drawAliasedLine(ctx, crownBaseX, trunkTopY + 8, endX, endY, this.cTreeTrunk);
            drawAliasedLine(ctx, crownBaseX - 1, trunkTopY + 8, endX - 1, endY, this.cTreeTrunk);
            drawAliasedLine(ctx, crownBaseX + 1, trunkTopY + 8, endX + 1, endY, this.cTreeTrunk);
        }

        // 9b. Den dicken Stamm zeichnen (überdeckt die unteren Astansätze)
        for (let y = trunkTopY; y <= trunkBaseY; y++) {
            let depth = (y - trunkTopY) / (trunkBaseY - trunkTopY);
            let tw = Math.floor(minDim * 0.04) + Math.pow(depth, 2) * Math.floor(minDim * 0.1); 
            let tx = trunkBaseX + Math.sin(depth * 3.5) * Math.floor(minDim * 0.06); 

            ctx.fillStyle = this.cTreeTrunk;
            ctx.fillRect(Math.floor(tx - tw/2), y, Math.floor(tw), 1);

            if (y % 4 === 0) {
                ctx.fillStyle = this.cToriiHigh;
                ctx.fillRect(Math.floor(tx - tw/2 + 2), y, Math.floor(tw * 0.4), 1);
            }
        }

        // 9c. Das dichte Blattwerk an den Enden der Äste zeichnen
        for (let i = 0; i < this.treeLeaves.length; i++) {
            let leaf = this.treeLeaves[i];
            
            let rustleX = Math.round(Math.sin(this.internalT * 3.0 + leaf.phase) * (1.0 + beat * 2.0));
            let rustleY = Math.round(Math.cos(this.internalT * 2.0 + leaf.phase) * (0.5 + beat * 1.0));
            
            let lx = Math.floor(crownBaseX + leaf.dx * minDim + rustleX);
            let ly = Math.floor(trunkTopY + leaf.dy * minDim + rustleY);
            
            fillAliasedCircle(ctx, lx, ly, leaf.r, leaf.col);
        }

        ctx.globalAlpha = 1.0;
    }
}