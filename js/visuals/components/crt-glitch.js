// === js/visuals/components/crt-glitch.js ===
// =========================================================
// CRT DEGAUSS & POWER-CYCLE GLITCH EFFECT
// Frame-synced 3-phase CRT collapse, degauss wave & warm-up.
// Zero per-frame allocations; single lazily cached scratch surface.
// =========================================================

function readThemeAccent() {
    const color = getComputedStyle(document.body).getPropertyValue('--bus-active-color').trim();
    return color || '#5c94fc';
}

export class CrtGlitch {
    constructor() {
        this.timer = 0;
        this.duration = 0.6; // Synchronisiert mit 300ms Peak + 300ms Power-Up in app.js
        this.phase = 0;
        this.swappedThemeColor = false;
        this.accentColor = '#5c94fc';
        this.scratch = null;
        this.scratchCtx = null;
        this.reducedMotionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)') || null;

        // Lauscht auf den Hardware-Bus, ohne enge Kopplung an die UI
        window.addEventListener('trigger-glitch', (event) => {
            const customDuration = Number(event?.detail?.duration);
            this.duration = Number.isFinite(customDuration) && customDuration > 0.1 ? customDuration : 0.6;
            this.timer = this.duration;
            this.phase = 0;
            this.swappedThemeColor = false;
            this.accentColor = readThemeAccent();
        });
    }

    ensureScratch(width, height) {
        if (!this.scratch) {
            this.scratch = document.createElement('canvas');
            this.scratchCtx = this.scratch.getContext('2d', { alpha: false });
        }
        if (this.scratch.width !== width || this.scratch.height !== height) {
            this.scratch.width = width;
            this.scratch.height = height;
        }
    }

    render(ctx, width, height, dt) {
        if (this.timer <= 0 || width <= 0 || height <= 0) return;

        this.timer = Math.max(0, this.timer - dt);
        this.phase += dt;

        const progress = 1 - (this.timer / this.duration); // 0.0 -> 1.0
        const env = Math.sin(progress * Math.PI);          // 0 -> 1 (bei 0.5) -> 0

        // Bei 50% (System-Switch-Peak) auf die Phosphorfarbe des neuen Systems umschalten
        if (progress >= 0.5 && !this.swappedThemeColor) {
            this.swappedThemeColor = true;
            this.accentColor = readThemeAccent();
        }

        // Sanfte Alternative ohne Strobe bei aktiviertem "Bewegung reduzieren"
        if (this.reducedMotionQuery?.matches) {
            ctx.save();
            ctx.fillStyle = '#000000';
            ctx.globalAlpha = env * 0.72;
            ctx.fillRect(0, 0, width, height);
            ctx.restore();
            return;
        }

        // 1. Aktuellen Canvas-Frame einmalig in Scratch-Buffer spiegeln
        this.ensureScratch(width, height);
        if (!this.scratchCtx) return;
        this.scratchCtx.drawImage(ctx.canvas, 0, 0);

        // 2. Vertikale CRT-Kollaps- & Warm-Up-Kurve berechnen
        let scaleY = 1.0;
        if (progress >= 0.34 && progress < 0.47) {
            const t = (progress - 0.34) / 0.13;
            scaleY = Math.max(0.025, 1 - (t * t));
        } else if (progress >= 0.47 && progress < 0.54) {
            scaleY = 0.025;
        } else if (progress >= 0.54 && progress < 0.70) {
            const t = (progress - 0.54) / 0.16;
            scaleY = 0.025 + 0.975 * (1 - Math.pow(1 - t, 3));
        }

        ctx.save();
        ctx.imageSmoothingEnabled = false;

        // Hintergrund für versetzte Scanlines & Kollaps-Balken schwärzen
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);

        // 3. Degauss-Welle & H-Sync-Tearing auf den echten Analyzer-Pixeln
        const yMid = height * 0.5;
        const sliceH = Math.max(4, Math.round(height / 28));
        const waveAmp = width * 0.028 * env;
        const waveFreq = 0.022 + env * 0.015;
        const waveSpeed = this.phase * 34;

        for (let y = 0; y < height; y += sliceH) {
            const sh = Math.min(sliceH, height - y);
            let dx = Math.sin(y * waveFreq + waveSpeed) * waveAmp;

            // Zufällige scharfe H-Sync-Sprünge in einzelnen Zeilenbändern
            if (Math.random() < 0.24 * env) {
                dx += (Math.random() - 0.5) * width * 0.12 * env;
            }

            const destY = yMid + (y - yMid) * scaleY;
            const destH = scaleY > 0.2 ? (sh * scaleY + 0.6) : Math.max(1, sh * scaleY);
            ctx.drawImage(this.scratch, 0, y, width, sh, dx, destY, width, destH);
        }

        // 4. Additiver Geister-Split (Chroma-Jitter auf ausgewählten Streifen)
        if (env > 0.22 && scaleY > 0.2) {
            ctx.globalCompositeOperation = 'lighter';
            const ghostCount = Math.ceil(4 * env);
            for (let i = 0; i < ghostCount; i++) {
                const gy = Math.floor(Math.random() * Math.max(1, height - 18));
                const gh = Math.min(height - gy, Math.floor(4 + Math.random() * 18));
                const shift = (Math.random() - 0.5) * width * 0.08 * env;
                const destY = yMid + (gy - yMid) * scaleY;

                ctx.globalAlpha = 0.28 * env;
                ctx.drawImage(this.scratch, 0, gy, width, gh, shift, destY, width, gh * scaleY);
                ctx.drawImage(this.scratch, 0, gy, width, gh, -shift * 0.7, destY, width, gh * scaleY);
            }
        }

        // 5. Dünne Phosphor- & Raster-Störstreifen in der Systemfarbe
        if (env > 0.15) {
            ctx.globalCompositeOperation = 'lighter';
            const streakCount = Math.floor(2 + Math.random() * 7 * env);
            for (let i = 0; i < streakCount; i++) {
                const roll = Math.random();
                ctx.fillStyle = roll > 0.72
                    ? '#ffffff'
                    : (roll > 0.38 ? this.accentColor : (roll > 0.18 ? '#ff2a55' : '#00e5ff'));
                ctx.globalAlpha = (0.14 + Math.random() * 0.35) * env;
                const sy = Math.random() * height;
                const sh = 1 + Math.random() * 2.5;
                const sx = Math.random() * width * 0.25;
                const sw = width * (0.4 + Math.random() * 0.6);
                ctx.fillRect(sx, sy, sw, sh);
            }
        }

        // 6. Elektronenstrahl-Kollaps & Power-Up-Bloom um den 50%-Peak (300ms)
        const beamDist = Math.abs(progress - 0.5) / 0.16;
        if (beamDist < 1.0) {
            const beamStrength = Math.pow(1 - beamDist, 1.6);
            ctx.globalCompositeOperation = 'lighter';

            // Systemfarbige Corona um die Strahl-Linie
            ctx.fillStyle = this.accentColor;
            ctx.globalAlpha = 0.55 * beamStrength;
            const haloH = Math.max(6, height * 0.08 * beamStrength);
            ctx.fillRect(0, yMid - haloH * 0.5, width, haloH);

            // Rasiermesserscharfer weißer Kathodenstrahl
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = 0.92 * beamStrength;
            const coreH = Math.max(1.5, 4 * beamStrength);
            ctx.fillRect(0, yMid - coreH * 0.5, width, coreH);

            // Zentraler Phosphor-Spot beim Umschalt-Moment
            const spotW = width * (0.18 + 0.45 * beamStrength);
            ctx.globalAlpha = 0.65 * beamStrength;
            ctx.fillRect((width - spotW) * 0.5, yMid - coreH * 1.4, spotW, coreH * 2.8);
        }

        ctx.restore();
    }
}