// === js/visuals/dj/stage-manager.js ===
const TRANSITION_TIME = 1.5;
const Z_ORDER = { 'background': 0, 'floor': 1, 'foreground': 2, 'overlay': 3 };

export class StageManager {
    constructor() {
        this.activeDSEs = [];
    }

    sortZOrder() {
        this.activeDSEs.sort((a, b) => Z_ORDER[a.metadata.layer] - Z_ORDER[b.metadata.layer]);
    }

    getMaxClimaxHoldTime() {
        if (this.activeDSEs.length === 0) return 10.0;
        return Math.max(...this.activeDSEs.map(d => d.metadata.climaxHold || 10.0));
    }

    clearNonPermanentDSEs() {
        for (let i = this.activeDSEs.length - 1; i >= 0; i--) {
            let dse = this.activeDSEs[i];
            if (dse.metadata.lifecycle === 'managed') {
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
            
            // --- DIAGNOSTISCHER DIAG-HARD-KILL (Debugging) ---
            // Wenn ein Element während der HMR (Hot Module Replacement) oder im Live-Betrieb
            // auf "disabled()" geschaltet wird, weichen wir das weiche Ausfaden auf und
            // reißen das Element im aktuellen Frame sofort geräuschlos vom Monitor.
            if (dse.metadata.isDisabled) {
                dse.state = 'idle';
                dse.stateTime = 0.0;
                dse._markedForRemoval = false;
                this.activeDSEs.splice(i, 1);
                continue;
            }

            dse.stateTime += dt;

            let transitionTime = dse.metadata.lifecycle === 'oneshot' ? 1.0 : TRANSITION_TIME;

            if (dse.metadata.lifecycle === 'oneshot' && !dse._markedForRemoval) {
                if (dse.stateTime >= dse.metadata.duration) {
                    dse._markedForRemoval = true;
                }
            }

            if (dse._markedForRemoval) {
                if (dse.state !== 'stopping') { 
                    dse.state = 'stopping'; 
                    dse.stateTime = 0.0; 
                } else if (dse.stateTime >= transitionTime) {
                    dse.state = 'idle'; 
                    dse.stateTime = 0.0; 
                    dse._markedForRemoval = false;
                    this.activeDSEs.splice(i, 1); 
                }
                continue; 
            }

            if (macroState === 'idle') {
                if (dse.state !== 'idle' && dse.state !== 'stopping') { 
                    dse.state = 'stopping'; 
                    dse.stateTime = 0.0; 
                } else if (dse.state === 'stopping' && dse.stateTime >= transitionTime) { 
                    dse.state = 'idle'; 
                    dse.stateTime = 0.0; 
                }
            } else {
                if (dse.state === 'idle' || dse.state === 'stopping') { 
                    dse.state = 'starting'; 
                    dse.stateTime = dse.state === 'stopping' ? Math.max(0.0, transitionTime - dse.stateTime) : 0.0; 
                } else if (dse.state === 'starting' && dse.stateTime >= transitionTime) { 
                    dse.state = macroState; 
                    dse.stateTime = 0.0; 
                } else if (dse.state === 'playing' || dse.state === 'buildup' || dse.state === 'climax' || dse.state === 'afterglow') {
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