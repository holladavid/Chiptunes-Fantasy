// === js/visuals/gimmicks/cube-amiga.js ===
// =========================================================
// ROTATING 3D WIREFRAME CUBE (AMIGA 3D MATH GIMMICK)
// =========================================================

export class AmigaCube {
    constructor() {
        this.cubeVertices = [
            [-1, -1, -1], [ 1, -1, -1], [ 1,  1, -1], [-1,  1, -1],
            [-1, -1,  1], [ 1, -1,  1], [ 1,  1,  1], [-1,  1,  1]
        ];
        this.cubeEdges = [
            [0,1], [1,2], [2,3], [3,0], // Hinten
            [4,5], [5,6], [6,7], [7,4], // Vorne
            [0,4], [1,5], [2,6], [3,7]  // Verbindungsstreben
        ];
    }

    render(ctx, width, height, t, bassVolume) {
        const cx = width / 2;
        const cy = height / 2;
        
        // Rotationsgeschwindigkeiten auf den 3 Achsen
        const rx = t * 0.8;
        const ry = t * 1.2;
        const rz = t * 0.5;
        
        // Der Würfel pulsiert im Takt des Basses (Kanal 0)
        const scale = 80 + (bassVolume * 100);
        const projected = [];
        
        // 3D Rotations-Matrix-Multiplikation
        this.cubeVertices.forEach(v => {
            let x = v[0], y = v[1], z = v[2];
            
            // Rot X
            let y1 = y * Math.cos(rx) - z * Math.sin(rx);
            let z1 = y * Math.sin(rx) + z * Math.cos(rx);
            // Rot Y
            let x2 = x * Math.cos(ry) + z1 * Math.sin(ry);
            let z2 = -x * Math.sin(ry) + z1 * Math.cos(ry);
            // Rot Z
            let x3 = x2 * Math.cos(rz) - y1 * Math.sin(rz);
            let y3 = x2 * Math.sin(rz) + y1 * Math.cos(rz);
            
            // Kamera-Projektion
            const fov = 400;
            const zOff = z2 + 4; // Abstand zur Kamera
            const px = cx + (x3 * fov) / zOff * (scale / 100);
            const py = cy + (y3 * fov) / zOff * (scale / 100);
            projected.push({x: px, y: py});
        });
        
        ctx.strokeStyle = '#ff8800'; // Amiga Orange
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        
        this.cubeEdges.forEach(edge => {
            const p1 = projected[edge[0]];
            const p2 = projected[edge[1]];
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
        });
        
        ctx.stroke();
    }
}