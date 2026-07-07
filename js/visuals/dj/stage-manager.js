// === js/visuals/dj/stage-manager.js ===
const TRANSITION_TIME = 1.5;
const Z_ORDER = { 'background': 0, 'floor': 1, 'foreground': 2, 'overlay': 3 };

export class StageManager {
    constructor() {
        this.activeDSEs = [];
    }

    sortZOrder() {
        this.activeDSEs.sort((a, b) => Z_ORDER[a.metadata.placementType] - Z_ORDER[b.metadata.placementType]);
    }

    getMaxClimaxHoldTime() {
        if (this.activeDSEs.length === 0) return 10.0;
        return Math.max(...this.activeDSEs.map(d => d.metadata.climaxHoldTime || 10.0));
    }

    clearNonPermanentDSEs() {
        for (let i = this.activeDSEs.length - 1; i >= 0; i--) {
            let dse = this.activeDSEs[i];
            if (dse.metadata.minPlayTime !== Infinity) {
                dse.state = 'idle';
                dse.stateTime = 0.0;
                dse._markedForRemoval = false;
                this.activeDSEs.splice(i, 1);
            }
        }
    }

    updateCrossfades(macroState, dt) {
        for (let i = this.activeDSEs.length - 1; i >= 0; i--) {
            let dse = this.activeDSEs[i];
            dse.stateTime += dt;

            // 1. Crossfade Ausstieg (Element wird durch den SetlistManager wegrotiert)
            if (dse._markedForRemoval) {
                if (dse.state !== 'stopping') { 
                    dse.state = 'stopping'; 
                    dse.stateTime = 0.0; 
                } else if (dse.stateTime >= TRANSITION_TIME) {
                    dse.state = 'idle'; 
                    dse.stateTime = 0.0; 
                    dse._markedForRemoval = false;
                    this.activeDSEs.splice(i, 1); 
                }
                continue; 
            }

            // 2. Normale State Machine Steuerung
            if (macroState === 'idle') {
                // Musik pausiert: Alles weich ausfaden
                if (dse.state !== 'idle' && dse.state !== 'stopping') { 
                    dse.state = 'stopping'; 
                    dse.stateTime = 0.0; 
                } else if (dse.state === 'stopping' && dse.stateTime >= TRANSITION_TIME) { 
                    dse.state = 'idle'; 
                    dse.stateTime = 0.0; 
                }
            } else {
                // Musik läuft
                if (dse.state === 'idle' || dse.state === 'stopping') { 
                    // Sanfter Einstieg (Wenn es gerade ausgefadet ist, wird die Zeit für einen fließenden Umkehreffekt invertiert)
                    dse.state = 'starting'; 
                    dse.stateTime = dse.state === 'stopping' ? Math.max(0.0, TRANSITION_TIME - dse.stateTime) : 0.0; 
                } else if (dse.state === 'starting' && dse.stateTime >= TRANSITION_TIME) { 
                    // Intro beendet -> Ab in den aktiven Modus! (Hier wird die Zeit zum Zählen der Lebensdauer resettet)
                    dse.state = macroState; 
                    dse.stateTime = 0.0; 
                } else if (dse.state === 'playing' || dse.state === 'buildup' || dse.state === 'climax') {
                    // ARCHITEKTUR-FIX: Wenn der DJ die Intensität ändert, passt sich das DSE an,
                    // ABER der Timer (stateTime) darf NICHT zurückgesetzt werden!
                    if (dse.state !== macroState) { 
                        dse.state = macroState; 
                    }
                }
            }
        }
    }

    renderAll(ctx, width, height, t, dynamics, info, metricsWrapper) {
        metricsWrapper.energy = dynamics.masterEnergy;
        metricsWrapper.pulse = dynamics.transientPulse;
        metricsWrapper.beat = dynamics.beatEnvelope;
        metricsWrapper.smooth = dynamics.channelSmooth;
        metricsWrapper.rawEnergyState = dynamics.rawEnergyState;
        metricsWrapper.system = info.system;

        for (let i = 0; i < this.activeDSEs.length; i++) {
            let dse = this.activeDSEs[i];
            dse.render(ctx, width, height, t, dse.state, dse.stateTime, metricsWrapper);
        }
    }
}