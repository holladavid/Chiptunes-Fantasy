// === js/visuals/scene-dj.js ===
import { TrackMonitor } from './dj/track-monitor.js';
import { TensionManager, TENSION_MAX } from './dj/tension-manager.js';
import { SetlistManager } from './dj/setlist-manager.js';
import { StageManager } from './dj/stage-manager.js';
import { SYSTEM_RESOLUTIONS } from './utils/hardware-constraints.js';

export class SceneDJ {
    constructor(options = {}) {
        const createCanvas = typeof options.createCanvas === 'function'
            ? options.createCanvas
            : () => document.createElement('canvas');

        this.monitor = new TrackMonitor();
        this.tension = new TensionManager();
        this.setlist = new SetlistManager();
        this.stage = new StageManager({ createCanvas });
        this.lastTime = null;
        this.pendingPresenterMetadata = null;

        this.metricsWrapper = {
            tensionPct: 0.0,
            isClimaxLocked: false,
            climaxTimer: 0.0,
            climaxHoldTime: 0.0
        };

        // --- RETRO BLITTER BUFFER ---
        this.retroCanvas = createCanvas();
        this.retroCtx = this.retroCanvas.getContext('2d', { alpha: false });

        this.setOptions(options);
    }

    setOptions(options = {}) {
        if (options.dseRefreshDivisor !== undefined) {
            this.stage.setRefreshDivisor(options.dseRefreshDivisor);
        }
        if (options.tensionSpeed !== undefined) {
            this.tension.setSpeedMode(options.tensionSpeed);
        }
    }

    get currentSystem() {
        return this.monitor.info.system;
    }

    registerDSE(dse) {
        this.setlist.registerDSE(dse);
    }

    forceSystemChange(newSystem) {
        this.monitor.info.system = newSystem;
        this.monitor.reset();
        this.tension.reset();
        this.pendingPresenterMetadata = null;
        this.setlist.forceSystemChange(this.stage, this.monitor.info);
    }

    resize(width, height) {
        if (width <= 0 || height <= 0 || !Number.isFinite(width / height)) return;

        const aspect = width / height;
        const defaultResY = SYSTEM_RESOLUTIONS[this.currentSystem] || 200;
        const defaultResX = Math.max(8, Math.floor(defaultResY * aspect));

        for (let dse of this.setlist.registeredDSEs) {
            if (typeof dse.resize !== 'function') continue;

            const systems = dse.metadata && dse.metadata.systems;
            if (systems && systems.length === 1 && systems[0] !== 'all' && SYSTEM_RESOLUTIONS[systems[0]]) {
                const sysResY = SYSTEM_RESOLUTIONS[systems[0]];
                const sysResX = Math.max(8, Math.floor(sysResY * aspect));
                dse.resize(sysResX, sysResY);
            } else {
                dse.resize(defaultResX, defaultResY);
            }
        }
    }

    render(ctx, width, height, t, channelVolumes, isPlaying, sessionId, trackMetadata, chipRegs) {
        // --- SCHUTZSCHALTUNG 1: Abfangen von 0px, NaN oder Infinity Viewports & Zeit ---
        if (width <= 0 || height <= 0 || !Number.isFinite(width / height) || !Number.isFinite(t)) return;

        let dt = 0.016;
        if (this.lastTime !== null) {
            dt = t - this.lastTime;
            if (!Number.isFinite(dt) || dt < 0.0 || dt > 0.1) dt = 0.016;
        }
        this.lastTime = t;

        // Unidirectional State Sync (Neues Lied gewählt)
        if (this.monitor.info.sessionId !== sessionId) {
            this.monitor.reset();
            this.tension.reset();
            this.monitor.info.sessionId = sessionId;
            this.pendingPresenterMetadata = trackMetadata || null;
        }

        this.monitor.info.isPlaying = isPlaying;

        // 1. Audio-Analyse inklusive echter Soundchip-Register
        this.monitor.update(channelVolumes, dt, chipRegs);

        // 2. Makro-Zustand berechnen
        let didWakeUp = this.tension.update(this.monitor.dynamics, this.monitor.info, this.stage, dt, chipRegs);

        // 3. Setlist / Presenter / Swaps auf musikalischen Ereignissen buendeln
        if (isPlaying) {
            if (this.pendingPresenterMetadata && this.setlist.triggerPresenter) {
                this.setlist.triggerPresenter(this.stage, this.monitor.info, this.pendingPresenterMetadata);
                this.pendingPresenterMetadata = null;
            }

            if (didWakeUp) {
                if (typeof this.setlist.clearQueuedTransitions === 'function') {
                    this.setlist.clearQueuedTransitions();
                }
                this.setlist.fillEmptyLayers(this.stage, this.monitor.info, 'starting');
            }

            this.setlist.manageSwaps(
                this.stage,
                this.monitor.info,
                this.tension.macroState,
                dt,
                this.monitor.dynamics.beatStarted
            );
        }

        // 4. Bühne aktualisieren
        this.stage.updateCrossfades(this.tension.macroState, dt);

        // 5. Daten übergeben und zeichnen
        this.metricsWrapper.tensionPct = this.tension.tension / TENSION_MAX;
        this.metricsWrapper.isClimaxLocked = this.tension.isClimaxLocked;
        this.metricsWrapper.climaxTimer = this.tension.climaxTimer;
        this.metricsWrapper.climaxHoldTime = this.tension.currentClimaxHoldTime;
        this.metricsWrapper.regs = chipRegs;

        // =========================================================
        // HARDWARE RESOLUTION CONSTRAINTS (RETRO BLITTER)
        // =========================================================
        const targetResY = SYSTEM_RESOLUTIONS[this.monitor.info.system] || 200;
        const targetResX = Math.max(8, Math.floor(targetResY * (width / height)));

        if (this.retroCanvas.width !== targetResX || this.retroCanvas.height !== targetResY) {
            this.retroCanvas.width = targetResX;
            this.retroCanvas.height = targetResY;
            this.retroCtx.imageSmoothingEnabled = false;
        }

        this.retroCtx.fillStyle = '#000000';
        this.retroCtx.fillRect(0, 0, targetResX, targetResY);

        this.stage.renderAll(this.retroCtx, targetResX, targetResY, t, this.monitor.dynamics, this.monitor.info, this.metricsWrapper);

        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this.retroCanvas, 0, 0, width, height);
    }
}