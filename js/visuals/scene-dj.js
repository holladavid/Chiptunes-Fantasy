// === js/visuals/scene-dj.js ===
// =========================================================
// DEMOSCENE-SEQUENCER (DSS) / THE "SCENE-DJ"
// Zero-Allocation Orchestrator for Dynamic Visual Choreographies
// Includes Reactive Demoscene-Style Limit Break Animations (Borderless)
// =========================================================

const Z_ORDER = {
    'background': 0,
    'floor': 1,
    'foreground': 2,
    'overlay': 3
};

const MIN_BUILDUP_TIME = 0.5;
const TRANSITION_TIME = 1.5; 
const TENSION_MAX = 20.0; 

export class SceneDJ {
    constructor() {
        this.channelSmooth = new Float32Array(4);
        this.channelPeaks = new Float32Array(4);
        this.masterEnergy = new Float32Array(1);
        this.transientPulse = new Float32Array(1);

        this.metrics = {
            energy: this.masterEnergy,
            pulse: this.transientPulse,
            smooth: this.channelSmooth,
            tensionPct: 0.0,
            isClimaxLocked: false,
            climaxTimer: 0.0,
            climaxHoldTime: 0.0,
            rawEnergyState: 'Playing',
            system: 'c64'
        };

        this.registeredDSEs = [];
        this.activeDSEs = [];
        this.currentSystem = null;
        this.lastTime = 0;
        
        this.energyStateTimer = 0.0;
        this.currentEnergyState = 'Playing'; 
        this.rawEnergyState = 'Playing';

        this.tension = 0.0;
        this.climaxTimer = 0.0;
        this.isClimaxLocked = false;
        this.currentClimaxHoldTime = 10.0;
    }

    registerDSE(dse) {
        dse.state = 'Idle';
        dse.stateTime = 0.0;
        if (!dse.metadata) {
            console.warn(`[SCENE-DJ] Registered element ${dse.constructor.name} is missing a metadata contract!`);
            dse.metadata = { name: dse.constructor.name, minPlayTime: 5.0, triggerProbability: 0.5, climaxHoldTime: 10.0 };
        }
        this.registeredDSEs.push(dse);
    }

    forceSystemChange(newSystem) {
        this.currentSystem = newSystem;

        for (let i = this.activeDSEs.length - 1; i >= 0; i--) {
            let dse = this.activeDSEs[i];
            
            if (dse.metadata.triggerProbability === 1.0 && dse.metadata.computerType.includes('all')) {
                continue; 
            }

            if (!dse.metadata.computerType.includes(newSystem) && !dse.metadata.computerType.includes('all')) {
                dse.state = 'Idle';
                dse.stateTime = 0.0;
                this.activeDSEs.splice(i, 1);
            }
        }

        for (let i = 0; i < this.registeredDSEs.length; i++) {
            let dse = this.registeredDSEs[i];
            if ((dse.metadata.computerType.includes(newSystem) || dse.metadata.computerType.includes('all')) && dse.state === 'Idle') {
                dse.state = 'Starting';
                dse.stateTime = 0.0;
                this.activeDSEs.push(dse);
            }
        }
        
        this.activeDSEs.sort((a, b) => Z_ORDER[a.metadata.placementType] - Z_ORDER[b.metadata.placementType]);
        
        this.currentEnergyState = 'Playing';
        this.rawEnergyState = 'Playing';
        this.energyStateTimer = 0.0;
        this.tension = 0.0;
        this.isClimaxLocked = false;
    }

    resize(width, height) {
        for (let i = 0; i < this.registeredDSEs.length; i++) {
            if (typeof this.registeredDSEs[i].resize === 'function') {
                this.registeredDSEs[i].resize(width, height);
            }
        }
    }

    analyzeEnergy(channelVolumes, dt) {
        let totalEnergy = 0.0;
        let maxPulse = 0.0;

        for (let i = 0; i < 4; i++) {
            let rawVol = channelVolumes[i] || 0.0;

            if (rawVol > this.channelSmooth[i]) {
                this.channelSmooth[i] += (rawVol - this.channelSmooth[i]) * 0.8; 
            } else {
                this.channelSmooth[i] += (rawVol - this.channelSmooth[i]) * 0.15; 
            }

            if (rawVol > this.channelPeaks[i]) {
                this.channelPeaks[i] = rawVol;
            } else {
                this.channelPeaks[i] -= 0.5 * dt; 
                if (this.channelPeaks[i] < 0) this.channelPeaks[i] = 0;
            }

            let pulse = this.channelPeaks[i] - this.channelSmooth[i];
            if (pulse > maxPulse) maxPulse = pulse;

            totalEnergy += this.channelSmooth[i];
        }

        this.masterEnergy[0] = totalEnergy / 4.0;
        this.transientPulse[0] = maxPulse > 0.0 ? maxPulse : 0.0;
    }

    updateStateMachines(dt) {
        this.energyStateTimer += dt;
        
        const energy = this.masterEnergy[0];
        const pulse = this.transientPulse[0];
        
        // 1. Raw State aus dem Echtzeit-Pegel
        let isOverdrive = (energy > 0.60 && pulse > 0.4);
        let isBuildup = (energy > 0.45);
        
        this.rawEnergyState = isOverdrive ? 'Overdrive' : (isBuildup ? 'Buildup' : 'Playing');
        let targetEnergyState = this.currentEnergyState;

        // --- TENSION & LOCK LOGIK ---
        if (!isBuildup && !isOverdrive) {
            // Track macht Pause -> Sofortiger Spannungsabbau
            this.isClimaxLocked = false;
            this.tension = Math.max(0.0, this.tension - (dt * 10.0)); 
            
            if (this.energyStateTimer > MIN_BUILDUP_TIME) {
                targetEnergyState = 'Playing';
            }
        } else {
            // Track ist laut
            if (!this.isClimaxLocked) {
                let power = (energy * 0.5) + (pulse * 2.0); 
                
                // Multiplikator bei "Crazy" Overdrive-Fills
                if (isOverdrive) {
                    power *= 4.0; 
                }

                this.tension += power * dt;

                // Limit Break erreicht?
                if (this.tension >= TENSION_MAX) {
                    this.tension = TENSION_MAX;
                    this.isClimaxLocked = true;
                    this.climaxTimer = 0.0; 
                    
                    this.currentClimaxHoldTime = this.activeDSEs.length > 0 
                        ? Math.max(...this.activeDSEs.map(d => d.metadata.climaxHoldTime || 10.0)) : 10.0;
                } else if (this.currentEnergyState === 'Playing' && this.energyStateTimer > MIN_BUILDUP_TIME) {
                    targetEnergyState = 'Buildup';
                }
            }

            // Wenn wir im Climax-Mode sind
            if (this.isClimaxLocked) {
                targetEnergyState = 'Climax';
                
                if (isOverdrive) {
                    this.climaxTimer = 0.0;
                    this.tension = TENSION_MAX;
                } else {
                    this.climaxTimer += dt;
                    this.tension = TENSION_MAX * Math.max(0.0, 1.0 - (this.climaxTimer / this.currentClimaxHoldTime));

                    if (this.climaxTimer >= this.currentClimaxHoldTime) {
                        this.isClimaxLocked = false;
                        this.tension = 0.0;
                        targetEnergyState = 'Buildup';
                    }
                }
            } else {
                if (targetEnergyState === 'Climax') targetEnergyState = 'Buildup';
            }
        }

        // Globalen State übernehmen
        if (this.currentEnergyState !== targetEnergyState) {
            this.currentEnergyState = targetEnergyState;
            this.energyStateTimer = 0.0;
        }

        // DSE-spezifische Updates
        for (let i = this.activeDSEs.length - 1; i >= 0; i--) {
            let dse = this.activeDSEs[i];
            dse.stateTime += dt;

            if (dse.state === 'Starting' && dse.stateTime >= TRANSITION_TIME) {
                dse.state = this.currentEnergyState;
                dse.stateTime = 0.0;
            }
            
            if (dse.state === 'Playing' || dse.state === 'Buildup' || dse.state === 'Climax') {
                if (dse.state !== this.currentEnergyState) {
                    dse.state = this.currentEnergyState;
                    dse.stateTime = 0.0; 
                }
            }

            if (dse.state === 'Stopping' && dse.stateTime >= TRANSITION_TIME) {
                if (dse.stateTime >= dse.metadata.minPlayTime || dse.metadata.minPlayTime === Infinity) {
                    dse.state = 'Idle';
                    dse.stateTime = 0.0;
                    this.activeDSEs.splice(i, 1);
                }
            }
        }
    }

    render(ctx, width, height, t, channelVolumes) {
        let dt = 0.016; 
        if (this.lastTime !== 0) dt = t - this.lastTime;
        this.lastTime = t;

        this.analyzeEnergy(channelVolumes, dt);
        this.updateStateMachines(dt);

        // Populate dynamic metrics for DSEs
        this.metrics.tensionPct = this.tension / TENSION_MAX;
        this.metrics.isClimaxLocked = this.isClimaxLocked;
        this.metrics.climaxTimer = this.climaxTimer;
        this.metrics.climaxHoldTime = this.currentClimaxHoldTime;
        this.metrics.rawEnergyState = this.rawEnergyState;
        this.metrics.system = this.currentSystem;

        for (let i = 0; i < this.activeDSEs.length; i++) {
            let dse = this.activeDSEs[i];
            dse.render(ctx, width, height, t, dse.state, dse.stateTime, this.metrics);
        }
    }
}