// === js/visuals/scene-dj.js ===
// =========================================================
// DEMOSCENE-SEQUENCER (DSS) / THE "SCENE-DJ"
// Zero-Allocation Orchestrator for Dynamic Visual Choreographies
// V1.2.0-beta.3: Pure Tension, Groove Env, Penalties & Black-Screen Protection
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
        this.beatEnvelope = new Float32Array(1); 

        this.metrics = {
            energy: this.masterEnergy,
            pulse: this.transientPulse,
            beat: this.beatEnvelope,     
            smooth: this.channelSmooth,
            tensionPct: 0.0,
            isClimaxLocked: false,
            climaxTimer: 0.0,
            climaxHoldTime: 0.0,
            rawEnergyState: 'playing',
            system: 'c64'
        };

        this.registeredDSEs = [];
        this.activeDSEs = [];
        this.currentSystem = null;
        this.lastTime = 0;
        this.currentSessionId = -1;
        
        this.energyStateTimer = 0.0;
        this.currentEnergyState = 'idle'; 
        this.rawEnergyState = 'playing';

        this.tension = 0.0;
        this.climaxTimer = 0.0;
        this.isClimaxLocked = false;
        this.currentClimaxHoldTime = 10.0;
        
        this.beatCooldown = 0.0; 
    }

    registerDSE(dse) {
        dse.state = 'idle';
        dse.stateTime = 0.0;
        dse._markedForRemoval = false;
        if (!dse.metadata) {
            console.warn(`[SCENE-DJ] Registered element ${dse.constructor.name} is missing a metadata contract!`);
            dse.metadata = { name: dse.constructor.name, minPlayTime: 5.0, weight: 10, climaxHoldTime: 10.0 };
        }
        // Initiales Laufzeit-Gewicht zuweisen
        dse.currentWeight = dse.metadata.weight || 10.0;
        this.registeredDSEs.push(dse);
    }

    // =========================================================
    // WEIGHT RESET
    // Setzt die Wahrscheinlichkeiten aller DSEs einer Ebene zurück,
    // nachdem erfolgreich ein neues DSE für den Layer gezogen wurde.
    // =========================================================
    resetWeightsForLayer(layer) {
        for (let d of this.registeredDSEs) {
            if (d.metadata.placementType === layer) {
                d.currentWeight = d.metadata.weight || 10.0;
            }
        }
    }

    selectWeightedDSE(candidates) {
        if (candidates.length === 0) return null;
        let totalWeight = 0.0;
        for (let i = 0; i < candidates.length; i++) totalWeight += candidates[i].currentWeight;
        
        const roll = Math.random() * totalWeight;
        let runningSum = 0.0;
        
        for (let i = 0; i < candidates.length; i++) {
            runningSum += candidates[i].currentWeight;
            if (roll <= runningSum) return candidates[i];
        }
        return candidates[0]; 
    }

    fillEmptyLayers(initialState = 'starting') {
        let layerFilled = { 'background': false, 'floor': false, 'foreground': false, 'overlay': false };

        for (let i = 0; i < this.activeDSEs.length; i++) {
            let dse = this.activeDSEs[i];
            if (!dse._markedForRemoval) layerFilled[dse.metadata.placementType] = true;
        }

        const layers = ['background', 'floor', 'foreground', 'overlay'];
        for (let layer of layers) {
            if (!layerFilled[layer]) {
                let candidates = this.registeredDSEs.filter(d => 
                    d.state === 'idle' && 
                    !d._markedForRemoval &&
                    d.metadata.placementType === layer &&
                    (d.metadata.computerType.includes(this.currentSystem) || d.metadata.computerType.includes('all'))
                );

                if (candidates.length > 0) {
                    this.resetWeightsForLayer(layer); 
                    let chosen = this.selectWeightedDSE(candidates);
                    chosen.state = initialState;
                    chosen.stateTime = 0.0;
                    chosen._markedForRemoval = false;
                    this.activeDSEs.push(chosen);
                }
            }
        }

        // =========================================================
        // BLACK SCREEN PROTECTION
        // Verhindert, dass alle Rendering-Layer transparent sind.
        // =========================================================
        let nonVoidCount = 0;
        let activeNonOverlays = this.activeDSEs.filter(d => d.metadata.placementType !== 'overlay' && !d._markedForRemoval);

        for (let i = 0; i < activeNonOverlays.length; i++) {
            if (!activeNonOverlays[i].metadata.isVoid) nonVoidCount++;
        }

        if (activeNonOverlays.length > 0 && nonVoidCount === 0) {
            let dseToReplace = activeNonOverlays[Math.floor(Math.random() * activeNonOverlays.length)];
            
            let realCandidates = this.registeredDSEs.filter(d => 
                !d.metadata.isVoid && 
                d.metadata.placementType === dseToReplace.metadata.placementType &&
                (d.metadata.computerType.includes(this.currentSystem) || d.metadata.computerType.includes('all'))
            );

            if (realCandidates.length > 0) {
                let idx = this.activeDSEs.indexOf(dseToReplace);
                if (idx !== -1) {
                    dseToReplace.state = 'idle';
                    dseToReplace.stateTime = 0.0;
                    this.activeDSEs.splice(idx, 1);
                }
                this.resetWeightsForLayer(dseToReplace.metadata.placementType);
                let chosen = this.selectWeightedDSE(realCandidates);
                chosen.state = initialState;
                chosen.stateTime = 0.0;
                chosen._markedForRemoval = false;
                
                if (!this.activeDSEs.includes(chosen)) this.activeDSEs.push(chosen);
            }
        }

        this.activeDSEs.sort((a, b) => Z_ORDER[a.metadata.placementType] - Z_ORDER[b.metadata.placementType]);
    }

    forceSystemChange(newSystem) {
        this.currentSystem = newSystem;
        for (let i = this.activeDSEs.length - 1; i >= 0; i--) {
            let dse = this.activeDSEs[i];
            if (dse.metadata.minPlayTime === Infinity && dse.metadata.computerType.includes('all')) continue; 
            if (!dse.metadata.computerType.includes(newSystem) && !dse.metadata.computerType.includes('all')) {
                dse.state = 'idle';
                this.activeDSEs.splice(i, 1);
            }
        }
        this.fillEmptyLayers('idle');
        this.currentEnergyState = 'idle';
        this.rawEnergyState = 'playing';
        this.energyStateTimer = 0.0;
        this.tension = 0.0;
        this.isClimaxLocked = false;
        this.beatEnvelope[0] = 0.0; 
    }

    resetTension() {
        this.tension = 0.0;
        this.isClimaxLocked = false;
        this.climaxTimer = 0.0;
        this.energyStateTimer = 0.0;
        this.beatEnvelope[0] = 0.0;
        this.currentEnergyState = 'idle'; 
    }

    resize(width, height) {
        for (let i = 0; i < this.registeredDSEs.length; i++) {
            if (typeof this.registeredDSEs[i].resize === 'function') this.registeredDSEs[i].resize(width, height);
        }
    }

    analyzeEnergy(channelVolumes, dt) {
        let totalEnergy = 0.0;
        let maxPulse = 0.0;
        let numActiveChannels = (this.currentSystem === 'c64' || this.currentSystem === 'atari') ? 3 : 4;

        for (let i = 0; i < 4; i++) {
            let rawVol = channelVolumes[i] || 0.0;

            let instantPulse = Math.max(0.0, rawVol - this.channelSmooth[i]);
            if (instantPulse > maxPulse) maxPulse = instantPulse;

            if (rawVol > this.channelSmooth[i]) {
                this.channelSmooth[i] += (rawVol - this.channelSmooth[i]) * (dt * 20.0); 
            } else {
                this.channelSmooth[i] += (rawVol - this.channelSmooth[i]) * (dt * 6.0); 
            }

            totalEnergy += this.channelSmooth[i];
        }

        this.masterEnergy[0] = totalEnergy / numActiveChannels;
        this.transientPulse[0] = maxPulse; 
    }

    manageDynamicSwaps(dt) {
        if (this.currentEnergyState === 'climax') return; 
        let swapOccurred = false;

        for (let i = 0; i < this.activeDSEs.length; i++) {
            let dse = this.activeDSEs[i];
            if (dse._markedForRemoval) continue; 

            if ((dse.state === 'playing' || dse.state === 'buildup') && dse.metadata.minPlayTime !== Infinity) {
                if (dse.stateTime >= dse.metadata.minPlayTime) {
                    let overTime = dse.stateTime - dse.metadata.minPlayTime;
                    let swapChance = overTime * 0.1 * dt; 

                    if (Math.random() < swapChance) {
                        let candidates = this.registeredDSEs.filter(alt => 
                            (alt.state === 'idle' || alt === dse) && 
                            !alt._markedForRemoval &&
                            alt.metadata.placementType === dse.metadata.placementType &&
                            (alt.metadata.computerType.includes(this.currentSystem) || alt.metadata.computerType.includes('all'))
                        );

                        if (candidates.length > 0) {
                            let chosen = this.selectWeightedDSE(candidates);
                            if (chosen === dse) {
                                // =========================================================
                                // PENALTY SYSTEM: DSE wurde erneut gezogen!
                                // Gewicht halbieren und Timer abkürzen, um nächsten Roll zu erzwingen
                                // =========================================================
                                dse.stateTime = Math.max(0, dse.metadata.minPlayTime - 5.0);
                                dse.currentWeight = Math.max(1.0, dse.currentWeight * 0.5);
                            } else {
                                // Neues DSE! Ausfaden lassen
                                dse._markedForRemoval = true; 
                                swapOccurred = true;
                            }
                        }
                    }
                }
            }
        }
        if (swapOccurred) this.fillEmptyLayers('starting'); // fillEmptyLayers resettet die Layer-Gewichte!
    }

    updateStateMachines(dt, isPlaying) {
        this.energyStateTimer += dt;
        
        const energy = this.masterEnergy[0];
        const pulse = this.transientPulse[0];
        
        let buildupThreshold = 0.40;    
        let overdriveThreshold = 0.60;   
        let pulseThreshold = 0.55;       
        let accumulationSpeed = 0.75;    

        if (this.currentSystem === 'c64') {
            buildupThreshold = 0.40;     
            overdriveThreshold = 0.60;   
            pulseThreshold = 0.50;       
            accumulationSpeed = 0.45;    
        } else if (this.currentSystem === 'atari') {
            buildupThreshold = 0.35;     
            overdriveThreshold = 0.55;   
            pulseThreshold = 0.45;       
            accumulationSpeed = 0.15;    
        }

        let isOverdrive = (energy > overdriveThreshold && pulse > pulseThreshold);
        let isBuildup = (energy > buildupThreshold);
        
        this.rawEnergyState = isOverdrive ? 'climax' : (isBuildup ? 'buildup' : 'playing');

        this.beatCooldown -= dt;
        let beatThreshold = pulseThreshold * 0.65; 
        
        if (isPlaying && pulse > beatThreshold && this.beatCooldown <= 0.0) {
            this.beatEnvelope[0] = 1.0; 
            this.beatCooldown = 0.12; 
        } else {
            this.beatEnvelope[0] *= Math.exp(-dt * 15.0); 
        }
        if (!isPlaying) this.beatEnvelope[0] = 0.0;

        let baseState = 'playing';
        if (!isPlaying) baseState = 'idle';
        else if (isBuildup || isOverdrive) baseState = 'buildup';

        let targetEnergyState = this.currentEnergyState;

        // 1. Idle & Wake-up
        if (baseState === 'idle') {
            this.isClimaxLocked = false;
            this.tension = Math.max(0.0, this.tension - (dt * 15.0)); 
            targetEnergyState = 'idle';
        } else if (this.currentEnergyState === 'idle') {
            targetEnergyState = baseState;
        } else {
            // 2. Track läuft - Spannung aufbauen (NUR wenn nicht im Climax!)
            if (!this.isClimaxLocked) {
                if (baseState === 'playing') {
                    this.tension = Math.max(0.0, this.tension - (dt * 10.0)); 
                    if (this.energyStateTimer > MIN_BUILDUP_TIME) targetEnergyState = 'playing';
                } else { 
                    let power = (energy * 0.5) + (pulse * 2.0); 
                    if (isOverdrive) power *= 6.0; 

                    this.tension += power * accumulationSpeed * dt;

                    if (this.tension >= TENSION_MAX) {
                        this.tension = TENSION_MAX;
                        this.isClimaxLocked = true;
                        this.climaxTimer = 0.0; 
                        this.currentClimaxHoldTime = this.activeDSEs.length > 0 
                            ? Math.max(...this.activeDSEs.map(d => d.metadata.climaxHoldTime || 10.0)) : 10.0;
                        targetEnergyState = 'climax'; 
                    } else if (this.currentEnergyState === 'playing' && this.energyStateTimer > MIN_BUILDUP_TIME) {
                        targetEnergyState = 'buildup';
                    }
                }
            }

            // 3. Climax-Lock Verarbeitung
            if (this.isClimaxLocked) {
                targetEnergyState = 'climax';
                
                if (isOverdrive) {
                    this.climaxTimer = 0.0;
                    this.tension = TENSION_MAX;
                } else {
                    this.climaxTimer += dt;
                    this.tension = TENSION_MAX * Math.max(0.0, 1.0 - (this.climaxTimer / this.currentClimaxHoldTime));

                    if (this.climaxTimer >= this.currentClimaxHoldTime) {
                        this.isClimaxLocked = false;
                        this.tension = 0.0;
                        targetEnergyState = baseState; 
                    }
                }
            }
        }

        if (this.currentEnergyState !== targetEnergyState) {
            if (this.currentEnergyState === 'idle' && targetEnergyState !== 'idle') {
                for (let i = this.activeDSEs.length - 1; i >= 0; i--) {
                    let dse = this.activeDSEs[i];
                    if (dse.metadata.minPlayTime !== Infinity) {
                        dse.state = 'idle';
                        dse.stateTime = 0.0;
                        this.activeDSEs.splice(i, 1);
                    }
                }
                this.fillEmptyLayers('starting');
            }

            this.currentEnergyState = targetEnergyState;
            this.energyStateTimer = 0.0;
        }

        for (let i = this.activeDSEs.length - 1; i >= 0; i--) {
            let dse = this.activeDSEs[i];
            dse.stateTime += dt;

            if (dse._markedForRemoval) {
                if (dse.state !== 'stopping') { dse.state = 'stopping'; dse.stateTime = 0.0; } 
                else if (dse.stateTime >= TRANSITION_TIME) { dse.state = 'idle'; dse.stateTime = 0.0; dse._markedForRemoval = false; this.activeDSEs.splice(i, 1); }
                continue; 
            }
            if (this.currentEnergyState === 'idle') {
                if (dse.state !== 'idle' && dse.state !== 'stopping') { dse.state = 'stopping'; dse.stateTime = 0.0; } 
                else if (dse.state === 'stopping' && dse.stateTime >= TRANSITION_TIME) { dse.state = 'idle'; dse.stateTime = 0.0; }
            } else {
                if (dse.state === 'idle' || dse.state === 'stopping') { dse.state = 'starting'; dse.stateTime = dse.state === 'stopping' ? Math.max(0.0, TRANSITION_TIME - dse.stateTime) : 0.0; } 
                else if (dse.state === 'starting' && dse.stateTime >= TRANSITION_TIME) { dse.state = this.currentEnergyState; dse.stateTime = 0.0; } 
                else if (dse.state === 'playing' || dse.state === 'buildup' || dse.state === 'climax') {
                    if (dse.state !== this.currentEnergyState) { dse.state = this.currentEnergyState; dse.stateTime = 0.0; }
                }
            }
        }
    }

    render(ctx, width, height, t, channelVolumes, isPlaying, sessionId) {
        let dt = 0.016; 
        if (this.lastTime !== 0) { dt = t - this.lastTime; if (dt > 0.1) dt = 0.016; }
        this.lastTime = t;

        if (this.currentSessionId !== sessionId) {
            this.resetTension();
            this.currentSessionId = sessionId;
        }

        this.analyzeEnergy(channelVolumes, dt);
        if (isPlaying) this.manageDynamicSwaps(dt);
        this.updateStateMachines(dt, isPlaying);

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