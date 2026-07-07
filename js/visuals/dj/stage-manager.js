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
        return this.activeDSEs.length > 0 ? Math.max(...this.activeDSEs.map(d => d.metadata.climaxHoldTime || 10.0)) : 10.0;
    }

    clearNonPermanentDSEs() {
        for (let i = this.activeDSEs.length - 1; i >= 0; i--) {
            let dse = this.activeDSEs[i];
            if (dse.metadata.minPlayTime !== Infinity) {
                dse.state = 'idle';
                dse.stateTime = 0.0;
                this.activeDSEs.splice(i, 1);
            }
        }
    }

    updateCrossfades(macroState, dt) {
        for (let i = this.activeDSEs.length - 1; i >= 0; i--) {
            let dse = this.activeDSEs[i];
            dse.stateTime += dt;

            if (dse._markedForRemoval) {
                if (dse.state !== 'stopping') { dse.state = 'stopping'; dse.stateTime = 0.0; } 
                else if (dse.stateTime >= TRANSITION_TIME) {
                    dse.state = 'idle'; dse.stateTime = 0.0; dse._markedForRemoval = false;
                    this.activeDSEs.splice(i, 1); 
                }
                continue; 
            }

            if (macroState === 'idle') {
                if (dse.state !== 'idle' && dse.state !== 'stopping') { dse.state = 'stopping'; dse.stateTime = 0.0; } 
                else if (dse.state === 'stopping' && dse.stateTime >= TRANSITION_TIME) { dse.state = 'idle'; dse.stateTime = 0.0; }
            } else {
                if (dse.state === 'idle' || dse.state === 'stopping') { 
                    dse.state = 'starting'; 
                    dse.stateTime = dse.state === 'stopping' ? Math.max(0.0, TRANSITION_TIME - dse.stateTime) : 0.0; 
                } else if (dse.state === 'starting' && dse.stateTime >= TRANSITION_TIME) { 
                    dse.state = macroState; dse.stateTime = 0.0; 
                } else if (dse.state === 'playing' || dse.state === 'buildup' || dse.state === 'climax') {
                    if (dse.state !== macroState) { dse.state = macroState; dse.stateTime = 0.0; }
                }
            }
        }
    }

    renderAll(ctx, width, height, t, dynamics, info, metricsWrapper) {
        // Zero-Allocation Mapping für Abwärtskompatibilität der DSEs
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