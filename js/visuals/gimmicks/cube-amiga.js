// === js/visuals/gimmicks/cube-amiga.js ===
// =========================================================
// ROTATING SOLID 3D CUBE (AMIGA GLENZ-VECTOR GIMMICK)
// Features: 3D perspective projection, cross-product Backface Culling,
// diffuse Flat-Shading, and semi-transparent "Glenz" glass polygons.
// =========================================================

export class AmigaCube {
    constructor() {
        // Die 8 Eckpunkte des 3D-Würfels
        this.cubeVertices = [
            [-1, -1, -1], [ 1, -1, -1], [ 1,  1, -1], [-1,  1, -1], // Hinten (0-3)
            [-1, -1,  1], [ 1, -1,  1], [ 1,  1,  1], [-1,  1,  1]  // Vorne (4-7)
        ];

        // Definition der 6 Flächen (Quads) in mathematisch exakter Gegenzeigersinn-Wicklung (CCW)
        // von außen betrachtet. Das sichert, dass die Oberflächen-Normalen strikt nach außen zeigen.
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
        
        // Rotationswinkel auf allen drei Achsen
        const rx = t * 0.8;
        const ry = t * 1.2;
        const rz = t * 0.5;
        
        // Der Würfel pulsiert im Takt des Amiga-Basses
        const scale = 80 + (bassVolume * 120);
        
        // --- 1. ROTATION ALLER 8 ECKPUNKTE ---
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
            const zOff = v.z + 4.0; // Würfel 4 Einheiten in den Raum schieben (Z-Offset)
            const px = cx + (v.x * fov) / zOff * (scale / 100);
            const py = cy + (v.y * fov) / zOff * (scale / 100);
            projected.push({ x: px, y: py });
        });

        // --- 3. VIRTUELLE LICHTQUELLE DEFINIEREN ---
        // Licht kommt von oben-links-vorne (für plastische 3D-Schattierung)
        const lx = 0.5, ly = -0.5, lz = -0.7;
        const lLen = Math.sqrt(lx*lx + ly*ly + lz*lz);
        const nlx = lx / lLen, nly = ly / lLen, nlz = lz / lLen;

        // --- 4. FLÄCHEN SCHATTIEREN & RENDER-INTERZEPT (Z-Culling) ---
        this.cubeFaces.forEach(face => {
            const idxs = face.idxs;
            const p0 = rotated[idxs[0]];
            const p1 = rotated[idxs[1]];
            const p2 = rotated[idxs[2]];

            // Zwei Richtungsvektoren der Fläche berechnen (AB und AC in 3D)
            const abX = p1.x - p0.x, abY = p1.y - p0.y, abZ = p1.z - p0.z;
            const acX = p2.x - p0.x, acY = p2.y - p0.y, acZ = p2.z - p0.z;

            // Kreuzprodukt (Cross Product), um die Flächennormale zu erhalten
            let nx = abY * acZ - abZ * acY;
            let ny = abZ * acX - abX * acZ;
            let nz = abX * acY - abY * acX;

            // Normale normalisieren (Einheitsvektor)
            const len = Math.sqrt(nx*nx + ny*ny + nz*nz);
            if (len > 0) { nx /= len; ny /= len; nz /= len; }

            // Sicht-Vektor (View Vector) von der Kamera (0, 0, -4) zum Punkt P0 der Fläche
            const vx = p0.x;
            const vy = p0.y;
            const vz = p0.z + 4.0;
            const vLen = Math.sqrt(vx*vx + vy*vy + vz*vz);
            const nvx = vx / vLen, nvy = vy / vLen, nvz = vz / vLen;

            // =========================================================
            // --- BACKFACE CULLING (Verdeckungs-Prüfung) ---
            // Skalarprodukt aus Normale und Sicht-Vektor. 
            // Ist der Wert >= 0, zeigt die Fläche von der Kamera weg -> Nicht zeichnen!
            // =========================================================
            const dotCull = nx * nvx + ny * nvy + nz * nvz;
            if (dotCull >= 0) return; 

            // =========================================================
            // --- DIFFUSE FLAT-SHADING (Beleuchtung) ---
            // Bestimmt die Helligkeit basierend auf dem Winkel zur Lichtquelle
            // =========================================================
            const dotLight = nx * nlx + ny * nly + nz * nlz;
            const brightness = 0.35 + 0.65 * Math.max(0.0, -dotLight); // Bereich von 0.35 (Schatten) bis 1.0 (Licht)

            // Farbe der Fläche anhand der Helligkeit berechnen
            const r = Math.round(face.baseColor[0] * brightness);
            const g = Math.round(face.baseColor[1] * brightness);
            const b = Math.round(face.baseColor[2] * brightness);

            // Polygon zeichnen
            ctx.beginPath();
            ctx.moveTo(projected[idxs[0]].x, projected[idxs[0]].y);
            ctx.lineTo(projected[idxs[1]].x, projected[idxs[1]].y);
            ctx.lineTo(projected[idxs[2]].x, projected[idxs[2]].y);
            ctx.lineTo(projected[idxs[3]].x, projected[idxs[3]].y);
            ctx.closePath();

            // Glenz-Transparenz-Füllung (Klassischer Amiga Glass-Vektor-Effekt!)
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.72)`;
            ctx.fill();

            // Messerscharfe, weiße Outlines für den originalen Vektor-Look drüberlegen
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        });
    }
}