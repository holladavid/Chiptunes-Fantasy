// === js/visuals/dse/c64/starfield.js ===

export class C64Starfield {
    constructor() {
        this.name = 'C64 Warp Starfield';
        this.computerType = ['c64'];
        this.placementType = 'background';
        
        this.numStars = 150;
        this.stars = Array.from({ length: this.numStars }, () => ({
            x: (Math.random() - 0.5) * 2000,
            y: (Math.random() - 0.5) * 2000,
            z: Math.random() * 1000 + 10
        }));
    }

    resize(width, height) {}

    render(ctx, width, height, t, state, stateTime, metrics) {
        if (state === 'Idle') return;

        let globalAlpha = 1.0;
        let warpSpeed = 2 + (metrics.energy[0] * 16); 

        if (state === 'Starting') {
            globalAlpha = Math.min(1.0, stateTime / 1.5);
            warpSpeed *= globalAlpha;
        } else if (state === 'Stopping') {
            globalAlpha = Math.max(0.0, 1.0 - (stateTime / 1.5));
            warpSpeed *= globalAlpha;
        } else if (state === 'Buildup') {
            warpSpeed *= 1.5;
        } else if (state === 'Climax') {
            warpSpeed *= 2.5 + (metrics.pulse[0] * 2.0); // Transienten-Warp
            globalAlpha = 0.8 + (metrics.pulse[0] * 0.2);
        }

        ctx.globalAlpha = globalAlpha;
        ctx.lineCap = 'square'; 
        
        const cx = width / 2;
        const cy = height / 2;
        const fov = 400; 

        for (let i = 0; i < this.numStars; i++) {
            let star = this.stars[i];
            const prevZ = star.z;
            
            star.z -= warpSpeed;
            if (star.z <= 6) {
                star.z = 1000;
                star.x = (Math.random() - 0.5) * 2000;
                star.y = (Math.random() - 0.5) * 2000;
                continue; 
            }

            const curZ = star.z;
            const px = Math.floor(cx + (star.x / curZ) * fov);
            const py = Math.floor(cy + (star.y / curZ) * fov);
            const prevPx = Math.floor(cx + (star.x / prevZ) * fov);
            const prevPy = Math.floor(cy + (star.y / prevZ) * fov);

            let starColor = '#444444'; // VIC-II #11
            if (curZ < 200) starColor = '#ffffff'; // #01
            else if (curZ < 400) starColor = '#b5b5b5'; // #15
            else if (curZ < 650) starColor = '#6c5eb5'; // #14
            else if (curZ < 850) starColor = '#7a7a7a'; // #12

            ctx.strokeStyle = starColor;
            ctx.fillStyle = starColor;

            const dx = px - prevPx;
            const dy = py - prevPy;
            const distance = Math.sqrt(dx*dx + dy*dy);

            if (distance > 3.0) {
                ctx.lineWidth = Math.max(2, Math.floor((1000 - curZ) / 250));
                ctx.beginPath();
                ctx.moveTo(prevPx, prevPy);
                ctx.lineTo(px, py);
                ctx.stroke();
            } else {
                const size = Math.max(2, Math.floor((1000 - curZ) / 200));
                ctx.fillRect(px - size/2, py - size/2, size, size);
            }
        }
        ctx.globalAlpha = 1.0;
    }
}