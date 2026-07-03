// === js/visuals/gimmicks/cube-amiga.js ===
// =========================================================
// ROTATING SOLID 3D GLENZ-VECTOR CUBE (PHENOMENA STYLE)
// Features: 3D perspective projection, 3D centroid-based Z-Sorting 
// (Painter's Algorithm), discrete front/backface rendering for true 
// glass transparency, and audio-reactive vector line blooming.
// =========================================================

export class AmigaCube {
    constructor() {
        // Die 8 Eckpunkte des 3D-Würfels
        this.cubeVertices = [
            [-1, -1, -1], [ 1, -1, -1], [ 1,  1, -1], [-1,  1, -1], // Hinten (0-3)
            [-1, -1,  1], [ 1, -1,  1], [ 1,  1,  1], [-1,  1,  1]  // Vorne (4-7)
        ];

        // Die 6 quatratischen Flächen (CCW-Wicklung für präzise Normalen-Vektoren)
        this.cubeFaces = [
            { idxs: [4, 5, 6, 7], baseColor: [255, 102, 0] },   // Vorne (Amiga Orange)
            { idxs: [1, 0, 3, 2], baseColor: [255, 102, 0] },   // Hinten (Amiga Orange)
            { idxs: [3, 2, 6, 7], baseColor: [0, 68, 170] },    // Oben (Amiga Blau)
            { idxs: [1, 5, 4, 0], baseColor: [0, 68, 170] },    // Unten (Amiga Blau)
            { idxs: [0, 4, 7, 3], baseColor: [0, 204, 255] },   // Links (Amiga Cyan)
            { idxs: [5, 1, 2, 6], baseColor: [0, 204, 255] }    // Rechts (Amiga Cyan)
        ];
    }

    render(ctx, width, height, t, bassVolume) {
        const cx = width / 2;
        const cy = height / 2;
        
        const rx = t * 0.8;
        const ry = t * 1.2;
        const rz = t * 0.5;
        
        // Der Würfel pulsiert im Takt des Amiga-Basses
        const scale = 80 + (bassVolume * 120);
        
        // --- 1. ROTATION ALLER 8 ECKPUNKTE IN 3D ---
        const rotated = [];
        this.cubeVertices.forEach(v => {
            let x = v[0], y = v[1], z = v[2];
            
            // Rotation X-Achse
            let y1 = y * Math.cos(rx) - z * Math.sin(rx);
            let z1 = y * Math.sin(rx) + z * Math.cos(rx);
            // Rotation Y-Achse
            let x2 = x * Math.cos(ry) + z1 * Math.sin(ry);
            let z2 = -x * Math.sin(ry) + z1 * Math.cos(ry);
            // Rotation Z-Achse
            let x3 = x2 * Math.cos(rz) - y1 * Math.sin(rz);
            let y3 = x2 * Math.sin(rz) + y1 * Math.cos(rz);
            
            rotated.push({ x: x3, y: y3, z: z2 });
        });

        // --- 2. PERSPEKTIVISCHE 2D-PROJEKTION ---
        const projected = [];
        rotated.forEach(v => {
            const fov = 400;
            const zOff = v.z + 4.0; // Z-Offset in die Tiefe
            const px = cx + (v.x * fov) / zOff * (scale / 100);
            const py = cy + (v.y * fov) / zOff * (scale / 100);
            projected.push({ x: px, y: py });
        });

        // --- 3. LICHTQUELLE (Top-Left-Front) ---
        const lx = 0.5, ly = -0.5, lz = -0.7;
        const lLen = Math.sqrt(lx*lx + ly*ly + lz*lz);
        const nlx = lx / lLen, nly = ly / lLen, nlz = lz / lLen;

        // =========================================================
        // --- 4. PAINTER'S ALGORITHM (Z-Centroid Sorting) ---
        // Wir berechnen für alle 6 Flächen den Z-Mittelpunkt (Centroid) 
        // und sortieren sie absteigend von hinten nach vorne.
        // =========================================================
        const facesToDraw = [];
        this.cubeFaces.forEach(face => {
            const idxs = face.idxs;
            
            // Berechnung des Z-Mittelpunkts der Fläche
            const zCentroid = (rotated[idxs[0]].z + rotated[idxs[1]].z + rotated[idxs[2]].z + rotated[idxs[3]].z) / 4.0;
            
            // Richtungsvektoren für Normale und Licht berechnen
            const p0 = rotated[idxs[0]];
            const p1 = rotated[idxs[1]];
            const p2 = rotated[idxs[2]];

            const abX = p1.x - p0.x, abY = p1.y - p0.y, abZ = p1.z - p0.z;
            const acX = p2.x - p0.x, acY = p2.y - p0.y, acZ = p2.z - p0.z;

            // Kreuzprodukt für Normale
            let nx = abY * acZ - abZ * acY;
            let ny = abZ * acX - abX * acZ;
            let nz = abX * acY - abY * acX;

            const len = Math.sqrt(nx*nx + ny*ny + nz*nz);
            if (len > 0) { nx /= len; ny /= len; nz /= len; }

            // Lichtstärke berechnen (Flat Shading)
            const dotLight = nx * nlx + ny * nly + nz * nlz;
            const brightness = 0.35 + 0.65 * Math.max(0.0, -dotLight);

            // Sicht-Vektor zur Kamera (0, 0, -4)
            const vx = p0.x;
            const vy = p0.y;
            const vz = p0.z + 4.0;
            const vLen = Math.sqrt(vx*vx + vy*vy + vz*vz);
            const nvx = vx / vLen, nvy = vy / vLen, nvz = vz / vLen;

            // Dot-Product zur Unterscheidung: Zeigt die Fläche zum Auge oder weg?
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

        // Sortieren: Größter Z-Wert (am weitesten entfernt) zuerst!
        facesToDraw.sort((a, b) => b.z - a.z);

        // --- 5. COMPOSITE GLENZ-VECTOR RENDERING ---
        facesToDraw.forEach(face => {
            const idxs = face.idxs;

            ctx.beginPath();
            ctx.moveTo(projected[idxs[0]].x, projected[idxs[0]].y);
            ctx.lineTo(projected[idxs[1]].x, projected[idxs[1]].y);
            ctx.lineTo(projected[idxs[2]].x, projected[idxs[2]].y);
            ctx.lineTo(projected[idxs[3]].x, projected[idxs[3]].y);
            ctx.closePath();

            if (face.isBackface) {
                // =========================================================
                // RÜCKSEITEN (Backfaces): 
                // Werden zuerst gezeichnet. Sie sind dunkler, transparenter (0.28)
                // und haben eine feine, zarte, leicht abgedunkelte Outline.
                // =========================================================
                ctx.fillStyle = `rgba(${face.r * 0.4}, ${face.g * 0.4}, ${face.b * 0.4}, 0.28)`;
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
                ctx.lineWidth = 1.0;
                ctx.stroke();
            } else {
                // =========================================================
                // VORDERSEITEN (Frontfaces):
                // Werden zuletzt gezeichnet (überdecken die Rückseiten). Sie glühen intensiv,
                // haben eine hohe Deckkraft (0.65) und eine fette, strahlend weiße Outline,
                // die bei Bass-Schlägen kraftvoll aufleuchtet (CRT Vector Bloom!).
                // =========================================================
                ctx.fillStyle = `rgba(${face.r}, ${face.g}, ${face.b}, 0.65)`;
                ctx.fill();
                
                ctx.strokeStyle = '#ffffff';
                // Audio-Reactive Vector Line Blooming
                ctx.lineWidth = 1.5 + (bassVolume * 2.0); 
                ctx.stroke();
            }
        });
    }
}