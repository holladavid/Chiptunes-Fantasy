// === js/visuals/dse/c64/sid-silicon-bg.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: SID 6581 MICROVERSE (BACKGROUND)
// Chunky 320x200 internal rendering, boiling plasma substrate,
// pumping oscillator blocks, and racing data buses.
// Built for maximum audio-reactivity and climax tension.
// =========================================================

// C64 Color Palette
const C64 = [
    '#000000', '#FFFFFF', '#880000', '#AAFFEE', 
    '#CC44CC', '#00CC55', '#0000AA', '#EEEE77', 
    '#DD8855', '#664400', '#FF7777', '#333333', 
    '#777777', '#AAFF66', '#0088FF', '#BBBBBB'
];

// Mapping für das kochende Silizium-Plasma (Blau/Cyan/Lila-Töne)
const PLASMA_MAP = [6, 6, 14, 14, 3, 3, 1, 1, 3, 14, 4, 4, 11, 6, 6, 6];

export class SidSiliconBg {
    constructor() {
        this.name = 'SID 6581 Microverse';
        this.computerType = ['c64'];
        this.placementType = 'background';
        
        // 320x200 Chunky Offscreen Buffer
        this.offscreen = document.createElement('canvas');
        this.offscreen.width = 320;
        this.offscreen.height = 200;
        this.ctx = this.offscreen.getContext('2d', { alpha: false });
        
        this.lastT = 0;
        this.internalT = 0;
    }

    resize(width, height) {}

    render(mainCtx, width, height, t, state, stateTime, metrics) {
        if (state === 'idle') { this.lastT = t; return; }
        let dt = this.lastT === 0 ? 0.016 : t - this.lastT;
        this.lastT = t;

        // 1. Dynamics Extraction
        const beat = metrics.beat[0]; 
        const tension = metrics.tensionPct; 
        const vols = metrics.smooth; 

        let globalAlpha = 1.0;
        let speedMult = 1.0;

        if (state === 'starting') {
            globalAlpha = Math.min(1.0, stateTime / 1.5);
        } else if (state === 'stopping') {
            globalAlpha = Math.max(0.0, 1.0 - (stateTime / 1.5));
        } else if (state === 'buildup') {
            speedMult = 1.5;
        } else if (state === 'climax') {
            speedMult = 2.5;
        }

        this.internalT += dt * speedMult;
        const time = this.internalT;

        // =========================================================
        // OFFSCREEN RENDERING (320x200 C64 Resolution)
        // =========================================================
        const ctx = this.ctx;
        ctx.fillStyle = C64[0];
        ctx.fillRect(0, 0, 320, 200);

        ctx.save();

        // --- CAMERA SHAKE (Nur im Climax beim Beat) ---
        if (state === 'climax' && beat > 0.2) {
            const shakeX = (Math.random() - 0.5) * beat * 10;
            const shakeY = (Math.random() - 0.5) * beat * 10;
            ctx.translate(shakeX, shakeY);
        }

        // --- 1. BOILING PLASMA SUBSTRATE ---
        // Sichtbar basierend auf Tension (flackert im Hintergrund)
        if (tension > 0.05) {
            const plasmaBlocksX = 40; // 320 / 8
            const plasmaBlocksY = 25; // 200 / 8
            
            for (let y = 0; y < plasmaBlocksY; y++) {
                for (let x = 0; x < plasmaBlocksX; x++) {
                    // Mathematische Plasma-Funktion (Sinus-Interferenzen)
                    let v = Math.sin(x * 0.2 + time) + Math.sin(y * 0.2 + time * 1.5) + Math.sin((x + y) * 0.15 - time);
                    let cIdx = Math.floor((v + 3) * 2.6) & 15;
                    
                    // Nur zeichnen, wenn Tension hoch genug ist, um das Plasma durchbrechen zu lassen
                    if ((cIdx / 15.0) < tension) {
                        ctx.fillStyle = C64[PLASMA_MAP[cIdx]];
                        ctx.fillRect(x * 8, y * 8, 8, 8);
                    }
                }
            }
        }

        // --- 2. GRID LINES (Moving Tech-Floor) ---
        ctx.strokeStyle = C64[11]; // Dark Grey
        ctx.lineWidth = 1;
        ctx.beginPath();
        const gridOffset = (time * 20) % 32;
        for (let x = -gridOffset; x < 320; x += 32) { ctx.moveTo(x, 0); ctx.lineTo(x, 200); }
        for (let y = -gridOffset; y < 200; y += 32) { ctx.moveTo(0, y); ctx.lineTo(320, y); }
        ctx.stroke();

        // --- 3. SIGNAL BUSES (Racing Data Lines) ---
        const drawBus = (startX, startY, endX, endY, vol) => {
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            
            // Manhattan-Routing (Rechter Winkel zur Filter-Einheit)
            const midX = startX + 60;
            ctx.lineTo(midX, startY);
            ctx.lineTo(midX, endY);
            ctx.lineTo(endX, endY);

            // Inaktive Spur
            ctx.strokeStyle = C64[6]; // Blue
            ctx.lineWidth = 2;
            ctx.setLineDash([]);
            ctx.stroke();

            // Aktive Datenpakete
            if (vol > 0.05) {
                ctx.strokeStyle = vol > 0.5 ? C64[1] : C64[3]; // White or Cyan
                ctx.lineWidth = 2 + (vol * 2);
                ctx.setLineDash([8, 8]);
                // Dashes rasen je nach Lautstärke in Richtung Filter
                ctx.lineDashOffset = -(time * 100 * (0.5 + vol)); 
                ctx.stroke();
                ctx.setLineDash([]);
            }
        };

        const oscY = [40, 100, 160];
        const vcfPos = { x: 220, y: 100 };

        // Busse zeichnen
        drawBus(50, oscY[0], vcfPos.x, vcfPos.y - 20, vols[0]);
        drawBus(50, oscY[1], vcfPos.x, vcfPos.y,      vols[1]);
        drawBus(50, oscY[2], vcfPos.x, vcfPos.y + 20, vols[2]);

        // Bus VCF -> VCA -> Output
        const vcaVol = (vols[0] + vols[1] + vols[2]) / 3.0;
        ctx.beginPath();
        ctx.moveTo(220, 100); ctx.lineTo(320, 100);
        ctx.strokeStyle = C64[6]; ctx.lineWidth = 4; ctx.stroke();
        if (vcaVol > 0.05) {
            ctx.strokeStyle = C64[10]; // Light Red für Master Out
            ctx.lineWidth = 4 + vcaVol * 4;
            ctx.setLineDash([12, 12]);
            ctx.lineDashOffset = -(time * 150);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // --- 4. THE HARDWARE BLOCKS (OSC & VCF) ---
        const drawBlock = (x, y, baseSize, vol, isVcf) => {
            // Block pumpt mit Beat und Lautstärke
            const size = baseSize + (vol * 15) + (beat * 10);
            
            // Schatten-Block (3D Effekt)
            ctx.fillStyle = C64[0]; 
            ctx.fillRect(x - size/2 + 4, y - size/2 + 4, size, size);

            // Haupt-Block
            ctx.fillStyle = isVcf ? C64[4] : C64[14]; // Purple or Light Blue
            if (vol > 0.6) ctx.fillStyle = C64[1]; // Weißes Glühen bei Übersteuerung
            else if (vol > 0.3) ctx.fillStyle = C64[3]; // Cyan
            
            ctx.fillRect(x - size/2, y - size/2, size, size);

            // Innerer Platinen-Kern
            ctx.fillStyle = C64[0];
            ctx.fillRect(x - (size/2) + 4, y - (size/2) + 4, size - 8, size - 8);
            
            // Flimmerndes Herz
            if (vol > 0.1) {
                ctx.fillStyle = isVcf ? C64[10] : C64[7]; // Light Red or Yellow
                const coreSize = (size - 12) * (0.5 + vol * 0.5);
                ctx.fillRect(x - coreSize/2, y - coreSize/2, coreSize, coreSize);
            }
        };

        // Oszillatoren
        drawBlock(50, oscY[0], 24, vols[0], false);
        drawBlock(50, oscY[1], 24, vols[1], false);
        drawBlock(50, oscY[2], 24, vols[2], false);

        // Analog Filter (VCF) - Kombiniert die Lautstärken
        drawBlock(vcfPos.x, vcfPos.y, 40, vcaVol, true);

        // --- STROBE INVERT (Climax Flash) ---
        if (state === 'climax' && beat > 0.8) {
            ctx.globalCompositeOperation = 'difference';
            ctx.fillStyle = C64[1]; // White
            ctx.fillRect(0, 0, 320, 200);
            ctx.globalCompositeOperation = 'source-over';
        }

        ctx.restore();

        // =========================================================
        // BLIT TO MAIN CANVAS (Chunky Pixel Upscaling)
        // =========================================================
        mainCtx.globalAlpha = globalAlpha;
        mainCtx.imageSmoothingEnabled = false; // Verhindert Anti-Aliasing -> harte Pixel!
        mainCtx.drawImage(this.offscreen, 0, 0, width, height);
        mainCtx.imageSmoothingEnabled = true; // Zurücksetzen für nachfolgende DSEs
        mainCtx.globalAlpha = 1.0;
    }
}