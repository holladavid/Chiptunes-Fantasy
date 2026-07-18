// === js/visuals/scene-dj.js ===
import { TrackMonitor } from './dj/track-monitor.js';
import { TensionManager, TENSION_MAX } from './dj/tension-manager.js';
import { SetlistManager } from './dj/setlist-manager.js';
import { StageManager } from './dj/stage-manager.js';
import { SYSTEM_RESOLUTIONS } from './utils/hardware-constraints.js'; // NEU!

export class SceneDJ {
    constructor() {
        this.monitor = new TrackMonitor();
        this.tension = new TensionManager();
        this.setlist = new SetlistManager();
        this.stage = new StageManager();
        this.lastTime = 0;

        this.metricsWrapper = {
            tensionPct: 0.0,
            isClimaxLocked: false,
            climaxTimer: 0.0,
            climaxHoldTime: 0.0
        };

        // --- NEU: DER RETRO BLITTER BUFFER ---
        this.retroCanvas = document.createElement('canvas');
        this.retroCtx = this.retroCanvas.getContext('2d', { alpha: false });
    }

    get currentSystem() {
        return this.monitor.info.system;
    }

    registerDSE(dse) {
        this.setlist.registerDSE(dse);
    }

    forceSystemChange(newSystem) {
        this.monitor.info.system = newSystem;
        this.setlist.forceSystemChange(this.stage, this.monitor.info);
        this.tension.reset();
        this.monitor.dynamics.beatEnvelope[0] = 0.0;
    }

    resize(width, height) {
        // Da wir nun intern skalieren, müssen die DSEs nicht mehr auf 
        // Monitor-Auflösungsänderungen reagieren. Der Blitter fängt alles ab.
        for (let dse of this.setlist.registeredDSEs) {
            if (typeof dse.resize === 'function') dse.resize(width, height);
        }
    }

    // FIX: chipRegs Argument am Ende hinzugefügt
    render(ctx, width, height, t, channelVolumes, isPlaying, sessionId, trackMetadata, chipRegs) {
        
        // --- SCHUTZSCHALTUNG 1: Abfangen von 0px, NaN oder Infinity Viewports ---
        if (width <= 0 || height <= 0 || !isFinite(width / height)) return;

        let dt = 0.016; 
        if (this.lastTime !== 0) { 
            dt = t - this.lastTime; 
            if (dt > 0.1) dt = 0.016; 
        }
        this.lastTime = t;

        // Unidirectional State Sync (Neues Lied gewählt)
        if (this.monitor.info.sessionId !== sessionId) {
            this.tension.reset();
            this.monitor.info.sessionId = sessionId;
            this.monitor.dynamics.beatEnvelope[0] = 0.0;
            
            if (this.setlist.triggerPresenter && trackMetadata) {
                this.setlist.triggerPresenter(this.stage, this.monitor.info, trackMetadata);
            }
        }

        this.monitor.info.isPlaying = isPlaying;

        // 1. Audio-Analyse
        this.monitor.update(channelVolumes, dt);

        // 2. Makro-Zustand berechnen (NEU: chipRegs an den Director übergeben!)
        let didWakeUp = this.tension.update(this.monitor.dynamics, this.monitor.info, this.stage, dt, chipRegs);

        // 3. Setlist / Swaps würfeln
        if (isPlaying) {
            this.setlist.manageSwaps(this.stage, this.monitor.info, this.tension.macroState, dt);
            if (didWakeUp) this.setlist.fillEmptyLayers(this.stage, this.monitor.info, 'starting');
        }

        // 4. Bühne aktualisieren
        this.stage.updateCrossfades(this.tension.macroState, dt);

        // 5. Daten übergeben und zeichnen
        this.metricsWrapper.tensionPct = this.tension.tension / TENSION_MAX;
        this.metricsWrapper.isClimaxLocked = this.tension.isClimaxLocked;
        this.metricsWrapper.climaxTimer = this.tension.climaxTimer;
        this.metricsWrapper.climaxHoldTime = this.tension.currentClimaxHoldTime;
        
        // FIX: Die Hardware-Register für die DSEs durchreichen (behebt Zeile 76)
        this.metricsWrapper.regs = chipRegs;

        // =========================================================
        // 5. HARDWARE RESOLUTION CONSTRAINTS (RETRO BLITTER)
        // Alle Elemente (auch Overlays!) laufen durch den Chunky-Filter.
        // =========================================================
        const targetResY = SYSTEM_RESOLUTIONS[this.monitor.info.system] || 200;
        
        // Aspect-Ratio auf die Retro-Ebene übertragen (z.B. 355x200)
        // KORREKTUR: Math.max(8, ...) garantiert, dass das Canvas niemals eine ungültige Breite von 0px erhält!
        const targetResX = Math.max(8, Math.floor(targetResY * (width / height))); 

        if (this.retroCanvas.width !== targetResX || this.retroCanvas.height !== targetResY) {
            this.retroCanvas.width = targetResX;
            this.retroCanvas.height = targetResY;
            this.retroCtx.imageSmoothingEnabled = false; // Nearest-Neighbor (Crisp Pixels)
        }

        // Low-Res Buffer clearen
        this.retroCtx.fillStyle = '#000000';
        this.retroCtx.fillRect(0, 0, targetResX, targetResY);

        // ALLE LAYER in den geschrumpften Retro-Canvas pressen!
        this.stage.renderAll(this.retroCtx, targetResX, targetResY, t, this.monitor.dynamics, this.monitor.info, this.metricsWrapper);

        // Finales Hardware-Upscaling auf den echten High-Res Monitor
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this.retroCanvas, 0, 0, width, height);
    }
}