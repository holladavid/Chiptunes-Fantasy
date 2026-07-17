// === js/visuals/dse/amiga/boing-ball.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: AMIGA BOING BALL (v3.2.0 - Edge Bouncing)
// Transparent foreground layer. Staggered mesh, dithered shadow,
// specular face-override, and dynamic edge-detection bouncing.
// =========================================================

import { quantizeAmiga12Bit, rgbToHex, drawAliasedLine } from '../../utils/hardware-constraints.js';

export class AmigaBoingBall {
    constructor() {
        this.name = 'Amiga Boing Ball';
        this.computerType = ['amiga'];
        this.placementType = 'foreground';
        
        // Mesh Generation (16 Longitude x 14 Latitude)
        const latBands = 14;
        const lonBands = 16;
        this.vertices = [];
        this.facesDef = [];
        
        for (let lat = 0; lat <= latBands; lat++) {
            let theta = lat * Math.PI / latBands;
            let sinTheta = Math.sin(theta);
            let cosTheta = Math.cos(theta);

            for (let lon = 0; lon <= lonBands; lon++) {
                let phi = lon * 2 * Math.PI / lonBands;
                let sinPhi = Math.sin(phi);
                let cosPhi = Math.cos(phi);

                let x = cosPhi * sinTheta;
                let y = cosTheta;
                let z = sinPhi * sinTheta;
                this.vertices.push({x, y, z});
            }
        }

        for (let lat = 0; lat < latBands; lat++) {
            for (let lon = 0; lon < lonBands; lon++) {
                let first = (lat * (lonBands + 1)) + lon;
                let second = first + lonBands + 1;

                // Authentic Boing pattern stagger
                let stagger = Math.floor(lat / 2) % 2;
                let isRed = (lon + stagger) % 2 === 0;
                let color = isRed ? [255, 0, 0] : [255, 255, 255];

                this.facesDef.push({
                    idxs: [first, first + 1, second + 1, second],
                    baseColor: color
                });
            }
        }

        const numVerts = this.vertices.length;
        this.transformed = Array(numVerts).fill(null).map(() => ({x: 0, y: 0, z: 0}));
        this.projected = Array(numVerts).fill(null).map(() => ({x: 0, y: 0}));
        this.facesToDraw = Array(this.facesDef.length).fill(null).map(() => ({idxs: null, hex: '', z: 0, dot: 0}));

        // Physik-Akkumulatoren
        this.moveXPhase = 0.0;
        this.moveYPhase = 0.0;
        this.currentRotY = 0.0; 
        this.currentRotSpeed = 0.0;
        this.smoothedSpeed = 1.0;
        this.lastT = 0;
        
        // Scene FX
        this.bounceFrames = 0;
        this.initialized = false;
        this.ensureInitialized();
    }

    ensureInitialized() {
        if (this.initialized) return;

        // Dither Pattern für den OCS-Schatten (1-Bit Schachbrett statt Alpha!)
        const sCanvas = document.createElement('canvas');
        sCanvas.width = 2; 
        sCanvas.height = 2;
        const sCtx = sCanvas.getContext('2d');
        sCtx.fillStyle = rgbToHex(...quantizeAmiga12Bit(0, 0, 0));
        sCtx.fillRect(0, 0, 1, 1);
        sCtx.fillRect(1, 1, 1, 1);
        
        this.shadowPattern = sCtx.createPattern(sCanvas, 'repeat');
        this.reflColor = rgbToHex(...quantizeAmiga12Bit(170, 0, 0));

        this.initialized = true;
    }

    resize(width, height) {}

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
            targetSpeed = 1.15;
        } else if (state === 'climax') {
            targetSpeed = 1.3;
        }

        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * Math.min(1.0, dt * 5.0);

        // =========================================================
        // 1. COORDINATE BASICS (Zuerst berechnen für dynamischen Rand-Bounce)
        // =========================================================
        const cx = Math.floor(width / 2);
        const horizon = Math.floor(height * 0.90);

        // Proportionale Skalierung (kompakt)
        const minDim = Math.min(width, height);
        const fov = minDim * 0.58; 
        
        const ballRadiusOnScreen = fov / 3.5; 
        const floorY = horizon - ballRadiusOnScreen; 

        // =========================================================
        // 2. PHYSICS & DYNAMIC BOUNCE BOUNDARIES
        // =========================================================
        const speedX = 0.25 * this.smoothedSpeed;
        this.moveXPhase = (this.moveXPhase + dt * speedX) % 2.0; 
        
        const isMovingRight = this.moveXPhase < 1.0;
        const xNorm = isMovingRight 
            ? (this.moveXPhase * 2.0 - 1.0) 
            : (1.0 - (this.moveXPhase - 1.0) * 2.0); 
            
        // EXAKTER RAND-AUFPRALL-EFFEKT (Berührt den Rand haargenau vor dem Richtungswechsel)
        const maxAmplitude = Math.max(0, (width / 2) - ballRadiusOnScreen);
        const moveX = xNorm * maxAmplitude;

        // Y-Achse
        const bounceFreq = 1.1 * this.smoothedSpeed;
        let prevYPhase = this.moveYPhase;
        this.moveYPhase = (this.moveYPhase + dt * bounceFreq) % 1.0;
        
        // Bounce Detector
        if (this.moveYPhase < prevYPhase) {
            this.bounceFrames = 2; 
            this.currentRotSpeed *= 0.85; 
        }

        let u = 2.0 * this.moveYPhase - 1.0; 
        let parabolicArc = 1.0 - (u * u);    
        const bounceY = parabolicArc * (height * 0.28);

        // Rotation
        let targetRotSpeed = 1.8 * this.smoothedSpeed;
        this.currentRotSpeed += (targetRotSpeed - this.currentRotSpeed) * dt * 2.0;
        this.currentRotY += isMovingRight ? (dt * this.currentRotSpeed) : -(dt * this.currentRotSpeed);

        // --- SCREEN SHAKE FX ---
        let shakeX = 0, shakeY = 0;
        if (this.bounceFrames > 0) {
            shakeX = (this.bounceFrames % 2 === 0) ? 1 : -1;
            shakeY = (this.bounceFrames % 2 === 0) ? 1 : 0;
            this.bounceFrames--;
        }

        // Transform-Offsets für Screen Shake anwenden
        const finalCx = cx + shakeX;
        const finalHorizon = horizon + shakeY;
        const finalFloorY = floorY + shakeY;

        // =========================================================
        // 3. 3D-TRANSFORMATION
        // =========================================================
        const rotY = this.currentRotY; 
        const tiltZ = 0.3; // 17 Grad Rechtsneigung

        const sinRy = Math.sin(rotY), cosRy = Math.cos(rotY);
        const sinT = Math.sin(tiltZ), cosT = Math.cos(tiltZ);

        for (let i = 0; i < this.vertices.length; i++) {
            let v = this.vertices[i];
            
            let sx = v.x, sy = v.y, sz = v.z;
            let rx = sx * cosRy - sz * sinRy;
            let rz = sx * sinRy + sz * cosRy;
            let ry = sy;

            let tx = rx * cosT - ry * sinT;
            let ty = rx * sinT + ry * cosT;

            this.transformed[i].x = tx;
            this.transformed[i].y = ty;
            this.transformed[i].z = rz + 3.5; 
        }

        for (let i = 0; i < this.vertices.length; i++) {
            let zOff = this.transformed[i].z;
            let targetX = finalCx + moveX;
            let targetY = finalFloorY - bounceY;

            // SCENE JITTER (1-Pixel-Rundungsfehler)
            this.projected[i].x = Math.floor(targetX + (this.transformed[i].x * fov) / zOff) + (i % 2);
            this.projected[i].y = Math.floor(targetY + (this.transformed[i].y * fov) / zOff);
        }

        // =========================================================
        // 4. SHADOW & BOUNCE REFLECTION
        // =========================================================
        let shadowX = finalCx + moveX;
        let shadowY = finalHorizon;
        
        // Die Rote Blitz-Reflexion beim Aufprall
        if (this.bounceFrames > 0) {
            ctx.fillStyle = this.reflColor;
            ctx.fillRect(shadowX - ballRadiusOnScreen * 0.8, shadowY + 2, ballRadiusOnScreen * 1.6, 6);
        }

        // Dithered 1-Bit Shadow (Skaliert mit der Flughöhe)
        let shadowW = ballRadiusOnScreen * 1.2 * (1.0 - (bounceY / height));
        let shadowH = ballRadiusOnScreen * 0.3 * (1.0 - (bounceY / height));
        
        ctx.save();
        ctx.fillStyle = this.shadowPattern;
        ctx.beginPath();
        ctx.ellipse(shadowX, shadowY, shadowW, shadowH, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // =========================================================
        // 5. LIGHTING & FAKE SPECULAR HIGHLIGHT
        // =========================================================
        const lx = 0.2, ly = -0.8, lz = -0.5;
        const lLen = Math.sqrt(lx*lx + ly*ly + lz*lz);
        const nlx = lx/lLen, nly = ly/lLen, nlz = lz/lLen;

        let activeFaces = 0;
        let maxDot = -1.0;
        let specFaceIdx = -1;

        for (let i = 0; i < this.facesDef.length; i++) {
            let faceDef = this.facesDef[i];
            let idxs = faceDef.idxs;
            
            let p0 = this.transformed[idxs[0]];
            let p1 = this.transformed[idxs[1]];
            let p2 = this.transformed[idxs[2]];
            
            let abX = p1.x - p0.x, abY = p1.y - p0.y, abZ = p1.z - p0.z;
            let acX = p2.x - p0.x, acY = p2.y - p0.y, acZ = p2.z - p0.z;
            
            let nx = abY * acZ - abZ * acY;
            let ny = abZ * acX - abX * acZ;
            let nz = abX * acY - abY * acX;
            
            if (nz >= 0) continue; // Backface Culling

            let len = Math.sqrt(nx*nx + ny*ny + nz*nz);
            nx /= len; ny /= len; nz /= len;

            let dotLight = nx * nlx + ny * nly + nz * nlz;
            
            if (dotLight > maxDot) {
                maxDot = dotLight;
                specFaceIdx = activeFaces;
            }

            let brightness = 0.25 + 0.75 * Math.max(0.0, -dotLight);
            
            if (i % 2 !== 0) brightness *= 0.95; // Scanline-Dämpfung

            let rawR = Math.min(255, Math.floor(faceDef.baseColor[0] * brightness));
            let rawG = Math.min(255, Math.floor(faceDef.baseColor[1] * brightness));
            let rawB = Math.min(255, Math.floor(faceDef.baseColor[2] * brightness));
            
            let qColor = quantizeAmiga12Bit(rawR, rawG, rawB);
            let zCentroid = (p0.z + p1.z + p2.z + this.transformed[idxs[3]].z) / 4.0;

            let f = this.facesToDraw[activeFaces++];
            f.idxs = idxs;
            f.hex = rgbToHex(qColor[0], qColor[1], qColor[2]);
            f.z = zCentroid;
            f.dot = dotLight;
        }

        // Specular Hack: Glanzfleck auf Reinweiß zwingen
        if (specFaceIdx !== -1 && maxDot > 0.8) {
            this.facesToDraw[specFaceIdx].hex = rgbToHex(...quantizeAmiga12Bit(255, 255, 255));
        }

        const visibleFaces = this.facesToDraw.slice(0, activeFaces);
        visibleFaces.sort((a, b) => b.z - a.z);

        // =========================================================
        // 6. RENDER FACES
        // =========================================================
        for (let i = 0; i < activeFaces; i++) {
            let face = visibleFaces[i];
            let idxs = face.idxs;

            ctx.beginPath();
            ctx.moveTo(this.projected[idxs[0]].x, this.projected[idxs[0]].y);
            ctx.lineTo(this.projected[idxs[1]].x, this.projected[idxs[1]].y);
            ctx.lineTo(this.projected[idxs[2]].x, this.projected[idxs[2]].y);
            ctx.lineTo(this.projected[idxs[3]].x, this.projected[idxs[3]].y);
            ctx.closePath();
            
            ctx.fillStyle = face.hex;
            ctx.fill();

            // 1-Pixel Black Outline an der Schattenseite
            if (face.dot < -0.3) {
                drawAliasedLine(ctx, this.projected[idxs[0]].x, this.projected[idxs[0]].y, this.projected[idxs[1]].x, this.projected[idxs[1]].y, '#000000');
            }
        }

        ctx.globalAlpha = 1.0;
    }
}