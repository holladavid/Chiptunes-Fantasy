// === js/visuals/dse/amiga/glenz-cube.js ===
export class AmigaCube {
    constructor() {
        this.cubeVertices = [[-1, -1, -1], [ 1, -1, -1], [ 1,  1, -1], [-1,  1, -1], [-1, -1,  1], [ 1, -1,  1], [ 1,  1,  1], [-1,  1,  1]];
        this.cubeFacesDef = [
            { idxs: [4, 5, 6, 7], baseColor: [255, 102, 0] }, { idxs: [1, 0, 3, 2], baseColor: [255, 102, 0] },
            { idxs: [3, 2, 6, 7], baseColor: [0, 68, 170] }, { idxs: [1, 5, 4, 0], baseColor: [0, 68, 170] },
            { idxs: [0, 4, 7, 3], baseColor: [0, 204, 255] }, { idxs: [5, 1, 2, 6], baseColor: [0, 204, 255] }
        ];
        this.rotated = Array(8).fill(null).map(() => ({x: 0, y: 0, z: 0}));
        this.projected = Array(8).fill(null).map(() => ({x: 0, y: 0}));
        this.facesToDraw = Array(6).fill(null).map(() => ({idxs: null, r: 0, g: 0, b: 0, z: 0, isBackface: false}));
        this.lastT = 0; this.internalT = 0; this.smoothedSpeed = 1.0;
    }

    resize(width, height) {}

    render(ctx, width, height, t, state, stateTime, metrics) {
        if (state === 'idle') { this.lastT = t; return; }
        let dt = this.lastT === 0 ? 0.016 : t - this.lastT;
        this.lastT = t;

        let globalAlpha = 1.0;
        let scaleMultiplier = 1.0;
        let targetSpeed = 1.0;
        let beatScale = 0.0;

        if (state === 'starting') {
            globalAlpha = Math.min(1.0, stateTime / 1.5);
            scaleMultiplier = globalAlpha;
        } else if (state === 'stopping') {
            globalAlpha = Math.max(0.0, 1.0 - (stateTime / 1.5));
            scaleMultiplier = globalAlpha;
        } else if (state === 'buildup') {
            targetSpeed = 1.2; // Smoother Anstieg
            beatScale = 5.0;   // Fast unmerkliches Atmen
        } else if (state === 'climax') {
            targetSpeed = 2.5; // Schnelle Drehung
            beatScale = 30.0;  // Gewaltige Sprünge (Crazy Jumping ist hier gewollt)
            globalAlpha = 0.8 + (metrics.beat[0] * 0.2); 
        }

        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * 0.05;
        this.internalT += dt * this.smoothedSpeed;

        ctx.globalAlpha = globalAlpha;

        const cx = width / 2; const cy = height / 2;
        const rx = this.internalT * 0.8; const ry = this.internalT * 1.2; const rz = this.internalT * 0.5;
        const scale = (110 + Math.sin(this.internalT * 0.75) * 20) * scaleMultiplier + (metrics.beat[0] * beatScale);
        
        for (let i = 0; i < 8; i++) {
            let x = this.cubeVertices[i][0], y = this.cubeVertices[i][1], z = this.cubeVertices[i][2];
            let y1 = y * Math.cos(rx) - z * Math.sin(rx); let z1 = y * Math.sin(rx) + z * Math.cos(rx);
            let x2 = x * Math.cos(ry) + z1 * Math.sin(ry); let z2 = -x * Math.sin(ry) + z1 * Math.cos(ry);
            let x3 = x2 * Math.cos(rz) - y1 * Math.sin(rz); let y3 = x2 * Math.sin(rz) + y1 * Math.cos(rz);
            this.rotated[i].x = x3; this.rotated[i].y = y3; this.rotated[i].z = z2;
        }

        const fov = 400;
        for (let i = 0; i < 8; i++) {
            const zOff = this.rotated[i].z + 4.0; 
            this.projected[i].x = cx + (this.rotated[i].x * fov) / zOff * (scale / 100);
            this.projected[i].y = cy + (this.rotated[i].y * fov) / zOff * (scale / 100);
        }

        const lx = 0.5, ly = -0.5, lz = -0.7;
        const lLen = Math.sqrt(lx*lx + ly*ly + lz*lz); const nlx = lx / lLen, nly = ly / lLen, nlz = lz / lLen;

        for (let i = 0; i < 6; i++) {
            const faceDef = this.cubeFacesDef[i]; const idxs = faceDef.idxs;
            const p0 = this.rotated[idxs[0]], p1 = this.rotated[idxs[1]], p2 = this.rotated[idxs[2]];
            const zCentroid = (p0.z + p1.z + p2.z + this.rotated[idxs[3]].z) / 4.0;
            const abX = p1.x - p0.x, abY = p1.y - p0.y, abZ = p1.z - p0.z;
            const acX = p2.x - p0.x, acY = p2.y - p0.y, acZ = p2.z - p0.z;

            let nx = abY * acZ - abZ * acY; let ny = abZ * acX - abX * acZ; let nz = abX * acY - abY * acX;
            const len = Math.sqrt(nx*nx + ny*ny + nz*nz); if (len > 0) { nx /= len; ny /= len; nz /= len; }

            const dotLight = nx * nlx + ny * nly + nz * nlz;
            const brightness = 0.35 + 0.65 * Math.max(0.0, -dotLight);
            const vLen = Math.sqrt(p0.x*p0.x + p0.y*p0.y + (p0.z + 4.0)*(p0.z + 4.0));
            const nvx = p0.x / vLen, nvy = p0.y / vLen, nvz = (p0.z + 4.0) / vLen;

            let f = this.facesToDraw[i];
            f.idxs = idxs; f.r = Math.round(faceDef.baseColor[0] * brightness); f.g = Math.round(faceDef.baseColor[1] * brightness); f.b = Math.round(faceDef.baseColor[2] * brightness); f.z = zCentroid;
            f.isBackface = (nx * nvx + ny * nvy + nz * nvz >= 0);
        }

        this.facesToDraw.sort((a, b) => b.z - a.z);

        for (let i = 0; i < 6; i++) {
            let face = this.facesToDraw[i]; let idxs = face.idxs;
            ctx.beginPath(); ctx.moveTo(this.projected[idxs[0]].x, this.projected[idxs[0]].y); ctx.lineTo(this.projected[idxs[1]].x, this.projected[idxs[1]].y); ctx.lineTo(this.projected[idxs[2]].x, this.projected[idxs[2]].y); ctx.lineTo(this.projected[idxs[3]].x, this.projected[idxs[3]].y); ctx.closePath();

            if (face.isBackface) {
                ctx.fillStyle = `rgba(${face.r * 0.4}, ${face.g * 0.4}, ${face.b * 0.4}, 0.28)`; ctx.fill();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'; ctx.lineWidth = 1.0; ctx.stroke();
            } else {
                ctx.fillStyle = `rgba(${face.r}, ${face.g}, ${face.b}, 0.65)`; ctx.fill();
                ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.8; ctx.stroke();
            }
        }
        ctx.globalAlpha = 1.0;
    }
}