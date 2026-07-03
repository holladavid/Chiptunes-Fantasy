// === js/visuals/gimmicks/cube-amiga.js ===
// =========================================================
// ROTATING SOLID 3D GLENZ-VECTOR CUBE (PHENOMENA STYLE)
// Features: Pure mathematical choreography (music-independent),
// 3D perspective projection, Z-Centroid Sorting, and Flat-Shading.
// =========================================================

export class AmigaCube {
    constructor() {
        this.cubeVertices = [
            [-1, -1, -1], [ 1, -1, -1], [ 1,  1, -1], [-1,  1, -1],
            [-1, -1,  1], [ 1, -1,  1], [ 1,  1,  1], [-1,  1,  1]
        ];

        this.cubeFaces = [
            { idxs: [4, 5, 6, 7], baseColor: [255, 102, 0] },
            { idxs: [1, 0, 3, 2], baseColor: [255, 102, 0] },
            { idxs: [3, 2, 6, 7], baseColor: [0, 68, 170] },
            { idxs: [1, 5, 4, 0], baseColor: [0, 68, 170] },
            { idxs: [0, 4, 7, 3], baseColor: [0, 204, 255] },
            { idxs: [5, 1, 2, 6], baseColor: [0, 204, 255] }
        ];
    }

    render(ctx, width, height, t) {
        const cx = width / 2;
        const cy = height / 2;
        
        // Konstante, seidenweiche Rotation
        const rx = t * 0.8;
        const ry = t * 1.2;
        const rz = t * 0.5;
        
        // CHOREOGRAPHIE UPGRADE: Majestätisches, musik-unabhängiges Atmen
        // Der Würfel pulsiert langsam und organisch durch eine Sinuswelle
        const scale = 110 + Math.sin(t * 0.75) * 20;
        
        const rotated = [];
        this.cubeVertices.forEach(v => {
            let x = v[0], y = v[1], z = v[2];
            
            let y1 = y * Math.cos(rx) - z * Math.sin(rx);
            let z1 = y * Math.sin(rx) + z * Math.cos(rx);
            let x2 = x * Math.cos(ry) + z1 * Math.sin(ry);
            let z2 = -x * Math.sin(ry) + z1 * Math.cos(ry);
            let x3 = x2 * Math.cos(rz) - y1 * Math.sin(rz);
            let y3 = x2 * Math.sin(rz) + y1 * Math.cos(rz);
            
            rotated.push({ x: x3, y: y3, z: z2 });
        });

        const projected = [];
        rotated.forEach(v => {
            const fov = 400;
            const zOff = v.z + 4.0; 
            const px = cx + (v.x * fov) / zOff * (scale / 100);
            const py = cy + (v.y * fov) / zOff * (scale / 100);
            projected.push({ x: px, y: py });
        });

        const lx = 0.5, ly = -0.5, lz = -0.7;
        const lLen = Math.sqrt(lx*lx + ly*ly + lz*lz);
        const nlx = lx / lLen, nly = ly / lLen, nlz = lz / lLen;

        const facesToDraw = [];
        this.cubeFaces.forEach(face => {
            const idxs = face.idxs;
            const zCentroid = (rotated[idxs[0]].z + rotated[idxs[1]].z + rotated[idxs[2]].z + rotated[idxs[3]].z) / 4.0;
            
            const p0 = rotated[idxs[0]];
            const p1 = rotated[idxs[1]];
            const p2 = rotated[idxs[2]];

            const abX = p1.x - p0.x, abY = p1.y - p0.y, abZ = p1.z - p0.z;
            const acX = p2.x - p0.x, acY = p2.y - p0.y, acZ = p2.z - p0.z;

            let nx = abY * acZ - abZ * acY;
            let ny = abZ * acX - abX * acZ;
            let nz = abX * acY - abY * acX;

            const len = Math.sqrt(nx*nx + ny*ny + nz*nz);
            if (len > 0) { nx /= len; ny /= len; nz /= len; }

            const dotLight = nx * nlx + ny * nly + nz * nlz;
            const brightness = 0.35 + 0.65 * Math.max(0.0, -dotLight);

            const vx = p0.x, vy = p0.y, vz = p0.z + 4.0;
            const vLen = Math.sqrt(vx*vx + vy*vy + vz*vz);
            const nvx = vx / vLen, nvy = vy / vLen, nvz = vz / vLen;

            const dotCull = nx * nvx + ny * nvy + nz * nvz;
            const isBackface = (dotCull >= 0);

            facesToDraw.push({
                idxs: idxs,
                r: Math.round(face.baseColor[0] * brightness),
                g: Math.round(face.baseColor[1] * brightness),
                b: Math.round(face.baseColor[2] * brightness),
                z: zCentroid,
                isBackface: isBackface
            });
        });

        facesToDraw.sort((a, b) => b.z - a.z);

        facesToDraw.forEach(face => {
            const idxs = face.idxs;

            ctx.beginPath();
            ctx.moveTo(projected[idxs[0]].x, projected[idxs[0]].y);
            ctx.lineTo(projected[idxs[1]].x, projected[idxs[1]].y);
            ctx.lineTo(projected[idxs[2]].x, projected[idxs[2]].y);
            ctx.lineTo(projected[idxs[3]].x, projected[idxs[3]].y);
            ctx.closePath();

            if (face.isBackface) {
                ctx.fillStyle = `rgba(${face.r * 0.4}, ${face.g * 0.4}, ${face.b * 0.4}, 0.28)`;
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
                ctx.lineWidth = 1.0;
                ctx.stroke();
            } else {
                ctx.fillStyle = `rgba(${face.r}, ${face.g}, ${face.b}, 0.65)`;
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.8; // Konstante Vektordicke für saubere Optik
                ctx.stroke();
            }
        });
    }
}