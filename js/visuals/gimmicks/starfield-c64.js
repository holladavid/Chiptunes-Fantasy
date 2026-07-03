// === js/visuals/gimmicks/starfield-c64.js ===
// =========================================================
// CLASSIC 3D WARP STARFIELD (C64 CRACKTRO GIMMICK)
// Features: Mathematical motion-blur streaks, strict 16-color VIC-II 
// palette mapping, and integer coordinate raster-snapping.
// =========================================================

export class C64Starfield {
    constructor() {
        this.numStars = 150;
        // 3D-Koordinaten der Sterne im Raum
        this.stars = Array.from({ length: this.numStars }, () => ({
            x: (Math.random() - 0.5) * 2000,
            y: (Math.random() - 0.5) * 2000,
            z: Math.random() * 1000 + 10
        }));
    }

    render(ctx, width, height, t, volume) {
        const cx = width / 2;
        const cy = height / 2;
        
        // Warp-Geschwindigkeit koppelt weich und dynamisch an die Lautstärke
        const speed = 2 + (volume * 16); 
        const fov = 400; // Projektions-Brennweite
        
        ctx.lineCap = 'square'; // Harte, blockige Enden für die Streaks

        this.stars.forEach(star => {
            // Merken der Z-Tiefe vor dem Update
            const prevZ = star.z;
            
            star.z -= speed;
            if (star.z <= 6) {
                star.z = 1000;
                star.x = (Math.random() - 0.5) * 2000;
                star.y = (Math.random() - 0.5) * 2000;
                return; // Reset, in diesem Frame nicht zeichnen
            }

            const curZ = star.z;

            // =========================================================
            // RASTER-SNAPPING & PROJEKTION
            // Math.floor() eliminiert die Browser-Glättung und sorgt für 
            // messerscharfe, knackscharfe 8-Bit-Pixelkanten.
            // =========================================================
            const px = Math.floor(cx + (star.x / curZ) * fov);
            const py = Math.floor(cy + (star.y / curZ) * fov);
            
            const prevPx = Math.floor(cx + (star.x / prevZ) * fov);
            const prevPy = Math.floor(cy + (star.y / prevZ) * fov);

            // =========================================================
            // GFX UPGRADE: TRUE VIC-II 16-COLOR PALETTE SHADING
            // Das Signal wird basierend auf der Tiefe hart schattiert.
            // =========================================================
            let starColor = '#444444'; // Dunkelgrau (VIC-II #11)
            
            if (curZ < 200) {
                starColor = '#ffffff'; // Reinweiß (VIC-II #01)
            } else if (curZ < 400) {
                starColor = '#b5b5b5'; // Hellgrau (VIC-II #15)
            } else if (curZ < 650) {
                starColor = '#6c5eb5'; // C64 Hellblau (VIC-II #14)
            } else if (curZ < 850) {
                starColor = '#7a7a7a'; // Mittelgrau (VIC-II #12)
            }

            ctx.strokeStyle = starColor;
            ctx.fillStyle = starColor;

            // Berechnen der zurückgelegten Distanz im Frame
            const dx = px - prevPx;
            const dy = py - prevPy;
            const distance = Math.sqrt(dx*dx + dy*dy);

            if (distance > 3.0) {
                // =========================================================
                // WARP-SPEED STREAK (Motion Blur)
                // Ist der Stern schnell genug, zeichnen wir eine dicke, blockige Linie.
                // Die Linienstärke wächst, je näher uns der Stern kommt.
                // =========================================================
                ctx.lineWidth = Math.max(2, Math.floor((1000 - curZ) / 250));
                ctx.beginPath();
                ctx.moveTo(prevPx, prevPy);
                ctx.lineTo(px, py);
                ctx.stroke();
            } else {
                // =========================================================
                // LOW-SPEED PIXEL BLOCK
                // Bei langsamen Geschwindigkeiten verharrt der Stern als massiver Pixelblock.
                // =========================================================
                const size = Math.max(2, Math.floor((1000 - curZ) / 200));
                ctx.fillRect(px - size/2, py - size/2, size, size);
            }
        });
    }
}