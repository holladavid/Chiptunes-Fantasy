// === js/visuals/dse/amiga/boing-ball.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: AMIGA BOING BALL (1984 TRIBUTE)
// Authentic 16x14 mesh, 17-degree right tilt, and strict 12-bit
// OCS shading. Features a rigid, majestic parabolic gravity arc 
// and linear wall-bounces. No squash & stretch!
// =========================================================

import { quantizeAmiga12Bit, rgbToHex } from '../../utils/hardware-constraints.js';

export class AmigaBoingBall {
    constructor() {
        this.name = 'Amiga Boing Ball';
        this.computerType = ['amiga'];
        this.placementType = 'foreground';
        
        // 1. Mesh Generation (16 Longitude x 14 Latitude)
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

                // Checkerboard Logic (Alternating Red and White)
                let isRed = (lat % 2 === 0) ? (lon % 2 === 0) : (lon % 2 !== 0);
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
        this.facesToDraw = Array(this.facesDef.length).fill(null).map(() => ({idxs: null, hex: '', z: 0}));

        // Unabhängige Physik-Akkumulatoren
        this.moveXPhase = 0.0;
        this.moveYPhase = 0.0;
        this.currentRotY = 0.0; 
        this.smoothedSpeed = 1.0;
        this.lastT = 0;
    }

    resize(width, height) {}

    render(ctx, width, height, t, state, stateTime, metrics) {
        if (state === 'idle') { this.lastT = t; return; }
        
        let dt = this.lastT === 0 ? 0.016 : t - this.lastT;
        this.lastT = t;

        let globalAlpha = 1.0;
        let targetSpeed = 1.0;

        // Dämpft die Extreme im Climax, damit die Trägheit des Balls erhalten bleibt
        if (state === 'starting') {
            globalAlpha = Math.min(1.0, stateTime / 1.5);
        } else if (state === 'stopping') {
            globalAlpha = Math.max(0.0, 1.0 - (stateTime / 1.5));
        } else if (state === 'buildup') {
            targetSpeed = 1.2;
        } else if (state === 'climax') {
            targetSpeed = 1.6;
        }

        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * Math.min(1.0, dt * 5.0);

// =========================================================
        // 1. X-ACHSE: MAJESTÄTISCHES, LINEARES PING-PONG
        // =========================================================
        const speedX = 0.25 * this.smoothedSpeed;
        this.moveXPhase = (this.moveXPhase + dt * speedX) % 2.0; 
        
        const isMovingRight = this.moveXPhase < 1.0;
        const xNorm = isMovingRight 
            ? (this.moveXPhase * 2.0 - 1.0) 
            : (1.0 - (this.moveXPhase - 1.0) * 2.0); 
            
        // Sweep über 30% der Bildschirmbreite
        const moveX = xNorm * (width * 0.30);

        // =========================================================
        // 2. ROTATION: GEKOPPELT AN X-RICHTUNG
        // =========================================================
        const rotSpeed = 1.6 * this.smoothedSpeed;
        this.currentRotY += isMovingRight ? (dt * rotSpeed) : -(dt * rotSpeed);

        // =========================================================
        // 3. Y-ACHSE: STARRE PARABOLISCHE SCHWERKRAFT
        // =========================================================
        const bounceFreq = 1.1 * this.smoothedSpeed;
        this.moveYPhase = (this.moveYPhase + dt * bounceFreq) % 1.0;
        
        let u = 2.0 * this.moveYPhase - 1.0; 
        let parabolicArc = 1.0 - (u * u);    
        
        // Sprunghöhe: 40% der Bildschirmhöhe
        const bounceY = parabolicArc * (height * 0.40);

        const beat = metrics.beat[0];
        const illumination = beat * 0.35; 
        
        // --- 4. 3D-KINEMATIK & ROTATION (Rigid Body) ---
        const rotY = this.currentRotY; 
        const tiltZ = 0.3; // 17 Grad Rechtsneigung

        const sinRy = Math.sin(rotY), cosRy = Math.cos(rotY);
        const sinT = Math.sin(tiltZ), cosT = Math.cos(tiltZ);

        for (let i = 0; i < this.vertices.length; i++) {
            let v = this.vertices[i];
            
            let sx = v.x;
            let sy = v.y;
            let sz = v.z;

            let rx = sx * cosRy - sz * sinRy;
            let rz = sx * sinRy + sz * cosRy;
            let ry = sy;

            let tx = rx * cosT - ry * sinT;
            let ty = rx * sinT + ry * cosT;
            let tz = rz;

            this.transformed[i].x = tx;
            this.transformed[i].y = ty;
            // 3.5 ist unser fester Kameraabstand auf der Z-Achse
            this.transformed[i].z = tz + 3.5; 
        }

        // =========================================================
        // 5. KAMERA & LINEARE PROJEKTION (GFX FIX)
        // =========================================================
        const minDim = Math.min(width, height);
        
        // Lineares FOV (keine quadratischen Bugs mehr!)
        const fov = minDim * 0.85; 
        
        // Dynamische Boden-Berechnung: Wir subtrahieren den Radius der 3D-Kugel, 
        // damit sie unten haargenau auf dem Gehäuserand abprallt.
        const ballRadiusOnScreen = fov / 3.5; 
        const floorY = height * 0.92 - ballRadiusOnScreen; 
        
        const cx = width / 2;

        for (let i = 0; i < this.vertices.length; i++) {
            let zOff = this.transformed[i].z;
            
            let targetX = cx + moveX;
            let targetY = floorY - bounceY;

            // Saubere, rein lineare 3D-Projektion
            this.projected[i].x = Math.floor(targetX + (this.transformed[i].x * fov) / zOff);
            this.projected[i].y = Math.floor(targetY + (this.transformed[i].y * fov) / zOff);
        }

        const lx = 0.5, ly = -0.5, lz = -0.7;
        const lLen = Math.sqrt(lx*lx + ly*ly + lz*lz);
        const nlx = lx/lLen, nly = ly/lLen, nlz = lz/lLen;

        let activeFaces = 0;
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
            let brightness = 0.25 + 0.75 * Math.max(0.0, -dotLight) + illumination;
            
            let rawR = Math.min(255, Math.floor(faceDef.baseColor[0] * brightness));
            let rawG = Math.min(255, Math.floor(faceDef.baseColor[1] * brightness));
            let rawB = Math.min(255, Math.floor(faceDef.baseColor[2] * brightness));
            
            let qColor = quantizeAmiga12Bit(rawR, rawG, rawB);

            let zCentroid = (p0.z + p1.z + p2.z + this.transformed[idxs[3]].z) / 4.0;

            let f = this.facesToDraw[activeFaces++];
            f.idxs = idxs;
            f.hex = rgbToHex(qColor[0], qColor[1], qColor[2]);
            f.z = zCentroid;
        }

        const visibleFaces = this.facesToDraw.slice(0, activeFaces);
        visibleFaces.sort((a, b) => b.z - a.z);

        ctx.globalAlpha = globalAlpha;

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
        }

        ctx.globalAlpha = 1.0;
    }
}