// === js/visuals/gimmicks/starfield-c64.js ===
// =========================================================
// CLASSIC 3D PARALLAX STARFIELD (C64 CRACKTRO GIMMICK)
// =========================================================

export class C64Starfield {
    constructor() {
        this.numStars = 150;
        this.stars = Array.from({ length: this.numStars }, () => ({
            x: (Math.random() - 0.5) * 2000,
            y: (Math.random() - 0.5) * 2000,
            z: Math.random() * 1000 + 10
        }));
    }

    render(ctx, width, height, t, volume) {
        const cx = width / 2;
        const cy = height / 2;
        // Warp Speed basiert auf der Musik-Lautstärke
        const speed = 2 + (volume * 15); 
        
        this.stars.forEach(star => {
            star.z -= speed;
            if (star.z <= 1) {
                star.z = 1000;
                star.x = (Math.random() - 0.5) * 2000;
                star.y = (Math.random() - 0.5) * 2000;
            }
            
            // 3D zu 2D Projektion
            const px = cx + (star.x / star.z) * 500;
            const py = cy + (star.y / star.z) * 500;
            
            if (px >= 0 && px <= width && py >= 0 && py <= height) {
                const size = Math.max(1, (1000 - star.z) / 200);
                // Je näher, desto weißer leuchtet der Stern
                ctx.fillStyle = star.z < 300 ? '#ffffff' : '#6c5eb5';
                ctx.fillRect(px, py, size, size);
            }
        });
    }
}