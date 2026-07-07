// === js/visuals/scene-dj.js ===
// =========================================================
// DEMOSCENE-SEQUENCER (DSS) / THE "SCENE-DJ"
// Modular ECS-Pattern Refactoring (v1.2.0)
// Includes the critical Getters for visualizer.js sync
// =========================================================

import { TrackMonitor } from './dj/track-monitor.js';
import { TensionManager, TENSION_MAX } from './dj/tension-manager.js';
import { SetlistManager } from './dj/setlist-manager.js';
import { StageManager } from './dj/stage-manager.js';

export class SceneDJ {
    constructor() {
        this.monitor = new TrackMonitor();
        this.tension = new TensionManager();
        this.setlist = new SetlistManager();
        this.stage = new StageManager();
        this.lastTime = 0;

        // Wrapper-Objekt für Abwärtskompatibilität des DSE-Interfaces
        this.metricsWrapper = {
            tensionPct: 0.0,
            isClimaxLocked: false,
            climaxTimer: 0.0,
            climaxHoldTime: 0.0
        };
    }

    // =========================================================
    // FIX: Die lebenswichtige Schnittstelle für die visualizer.js
    // Verhindert, dass der DJ in jedem Frame einen System-Reset macht!
    // =========================================================
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
        for (let dse of this.setlist.registeredDSEs) {
            if (typeof dse.resize === 'function') dse.resize(width, height);
        }
    }

    render(ctx, width, height, t, channelVolumes, isPlaying, sessionId) {
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
        }

        this.monitor.info.isPlaying = isPlaying;

        // 1. Audio-Analyse
        this.monitor.update(channelVolumes, dt);

        // 2. Makro-Zustand berechnen
        let didWakeUp = this.tension.update(this.monitor.dynamics, this.monitor.info, this.stage, dt);

        // 3. Setlist / Swaps würfeln
        if (isPlaying) {
            this.setlist.manageSwaps(this.stage, this.monitor.info, this.tension.macroState, dt);
            
            // Wake-Up Roll Check
            if (didWakeUp) {
                this.setlist.fillEmptyLayers(this.stage, this.monitor.info, 'starting');
            }
        }

        // 4. Bühne aktualisieren
        this.stage.updateCrossfades(this.tension.macroState, dt);

        // 5. Daten übergeben und zeichnen
        this.metricsWrapper.tensionPct = this.tension.tension / TENSION_MAX;
        this.metricsWrapper.isClimaxLocked = this.tension.isClimaxLocked;
        this.metricsWrapper.climaxTimer = this.tension.climaxTimer;
        this.metricsWrapper.climaxHoldTime = this.tension.currentClimaxHoldTime;

        this.stage.renderAll(ctx, width, height, t, this.monitor.dynamics, this.monitor.info, this.metricsWrapper);
    }
}