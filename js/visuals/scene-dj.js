// === js/visuals/scene-dj.js ===
// =========================================================
// DEMOSCENE-SEQUENCER (DSS) / THE "SCENE-DJ"
// Zero-Allocation Orchestrator for Dynamic Visual Choreographies
// V2.0 Ready: Dynamic Crossfade Swapping & Tension Logic
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
            rawEnergyState: 'playing',
            system: 'c64'
        };

        this.registeredDSEs = [];
        this.activeDSEs = [];
        this.currentSystem = null;
        this.lastTime = 0;
        
        this.energyStateTimer = 0.0;
        this.currentEnergyState = 'idle'; 
        this.rawEnergyState = 'playing';

        this.tension = 0.0;
        this.climaxTimer = 0.0;
        this.isClimaxLocked = false;
        this.currentClimaxHoldTime = 10.0;
    }

    registerDSE(dse) {
        dse.state = 'idle';
        dse.stateTime = 0.0;
        dse._markedForRemoval = false; // NEU: Crossfade Flag
        if (!dse.metadata) {
            console.warn(`[SCENE-DJ] Registered element ${dse.constructor.name} is missing a metadata contract!`);
            dse.metadata = { name: dse.constructor.name, minPlayTime: 5.0, triggerProbability: 0.5, climaxHoldTime: 10.0 };
        }
        this.registeredDSEs.push(dse);
    }

    forceSystemChange(newSystem) {
        this.currentSystem = newSystem;

        // 1. Markiere inkompatible DSEs für einen sauberen Crossfade-Ausstieg
        for (let i = this.activeDSEs.length - 1; i >= 0; i--) {
            let dse = this.activeDSEs[i];
            if (dse.metadata.triggerProbability === 1.0 && dse.metadata.computerType.includes('all')) continue; 

            if (!dse.metadata.computerType.includes(newSystem) && !dse.metadata.computerType.includes('all')) {
                dse._markedForRemoval = true; 
            }
        }

        // 2. Fülle sofort die leeren (oder zu leerenden) Slot-Ebenen
        const layers = ['background', 'floor', 'foreground', 'overlay'];
        const filledLayers = new Set(this.activeDSEs.filter(d => !d._markedForRemoval).map(d => d.metadata.placementType));

        for (let layer of layers) {
            if (!filledLayers.has(layer)) {
                let candidates = this.registeredDSEs.filter(d => 
                    d.state === 'idle' && 
                    d.metadata.placementType === layer &&
                    (d.metadata.computerType.includes(newSystem) || d.metadata.computerType.includes('all'))
                );

                if (candidates.length > 0) {
                    let chosen = candidates[Math.floor(Math.random() * candidates.length)];
                    chosen.state = 'starting';
                    chosen.stateTime = 0.0;
                    chosen._markedForRemoval = false;
                    this.activeDSEs.push(chosen);
                }
            }
        }
        
        this.activeDSEs.sort((a, b) => Z_ORDER[a.metadata.placementType] - Z_ORDER[b.metadata.placementType]);
        
        this.currentEnergyState = 'idle';
        this.rawEnergyState = 'playing';
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

        let numActiveChannels = (this.currentSystem === 'c64' || this.currentSystem === 'atari') ? 3 : 4;

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

        this.masterEnergy[0] = totalEnergy / numActiveChannels;
        this.transientPulse[0] = maxPulse > 0.0 ? maxPulse : 0.0;
    }

    // =========================================================
    // DYNAMIC SWAP MANAGER
    // Würfelt bei abgelaufener minPlayTime, ob ein Effekt sanft 
    // gegen eine Alternative auf demselben Layer ausgetauscht wird.
    // =========================================================
    manageDynamicSwaps(dt) {
        // Erlaubt Swaps im 'playing' UND 'buildup' State. Nur Climax wird blockiert!
        if (this.currentEnergyState === 'climax') return; 

        let layerFilled = { 'background': false, 'floor': false, 'foreground': false, 'overlay': false };

        for (let i = 0; i < this.activeDSEs.length; i++) {
            let dse = this.activeDSEs[i];
            
            if (dse._markedForRemoval) continue; 
            
            layerFilled[dse.metadata.placementType] = true;

            // Prüft, ob das Element lange genug im Bild ist (15s)
            if ((dse.state === 'playing' || dse.state === 'buildup') && dse.metadata.minPlayTime !== Infinity && dse.stateTime >= dse.metadata.minPlayTime) {
                
                let altExists = this.registeredDSEs.some(alt => 
                    alt !== dse && 
                    alt.metadata.placementType === dse.metadata.placementType &&
                    (alt.metadata.computerType.includes(this.currentSystem) || alt.metadata.computerType.includes('all'))
                );

                if (altExists) {
                    if (Math.random() < 0.02 * dt) {
                        dse._markedForRemoval = true; 
                        layerFilled[dse.metadata.placementType] = false; 
                    }
                }
            }
        }

        // Freigewordene Layer mit neuen DSEs auffüllen
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
                    let chosen = candidates[Math.floor(Math.random() * candidates.length)];
                    chosen.state = 'starting';
                    chosen.stateTime = 0.0;
                    chosen._markedForRemoval = false;
                    this.activeDSEs.push(chosen);
                    
                    this.activeDSEs.sort((a, b) => Z_ORDER[a.metadata.placementType] - Z_ORDER[b.metadata.placementType]);
                    layerFilled[layer] = true; 
                }
            }
        }
    }

    updateStateMachines(dt, isPlaying) {
        this.energyStateTimer += dt;
        
        const energy = this.masterEnergy[0];
        const pulse = this.transientPulse[0];
        
        let buildupThreshold = 0.40;    
        let overdriveThreshold = 0.58;   
        let pulseThreshold = 0.35;       
        let accumulationSpeed = 0.75;    

        if (this.currentSystem === 'c64') {
            buildupThreshold = 0.40;     
            overdriveThreshold = 0.58;   
            pulseThreshold = 0.30;       
            accumulationSpeed = 0.45;    
        } else if (this.currentSystem === 'atari') {
            buildupThreshold = 0.26;     
            overdriveThreshold = 0.44;   
            pulseThreshold = 0.22;       
            accumulationSpeed = 1.5;     
        }

        let isOverdrive = (energy > overdriveThreshold && pulse > pulseThreshold);
        let isBuildup = (energy > buildupThreshold);
        
        this.rawEnergyState = isOverdrive ? 'climax' : (isBuildup ? 'buildup' : 'playing');
        let targetEnergyState = this.currentEnergyState;

        if (!isPlaying) {
            this.isClimaxLocked = false;
            this.tension = Math.max(0.0, this.tension - (dt * 15.0)); 
            targetEnergyState = 'idle';
        } else if (!isBuildup && !isOverdrive) {
            this.isClimaxLocked = false;
            this.tension = Math.max(0.0, this.tension - (dt * 10.0)); 
            if (this.energyStateTimer > MIN_BUILDUP_TIME) targetEnergyState = 'playing';
        } else {
            if (!this.isClimaxLocked) {
                let power = (energy * 0.5) + (pulse * 2.0); 
                if (isOverdrive) power *= 4.0; 

                this.tension += power * accumulationSpeed * dt;

                if (this.tension >= TENSION_MAX) {
                    this.tension = TENSION_MAX;
                    this.isClimaxLocked = true;
                    this.climaxTimer = 0.0; 
                    this.currentClimaxHoldTime = this.activeDSEs.length > 0 
                        ? Math.max(...this.activeDSEs.map(d => d.metadata.climaxHoldTime || 10.0)) : 10.0;
                } else if (this.currentEnergyState === 'playing' && this.energyStateTimer > MIN_BUILDUP_TIME) {
                    targetEnergyState = 'buildup';
                }
            }

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
                        targetEnergyState = 'buildup';
                    }
                }
            } else {
                if (targetEnergyState === 'climax') targetEnergyState = 'buildup';
            }
        }

        if (this.currentEnergyState !== targetEnergyState) {
            this.currentEnergyState = targetEnergyState;
            this.energyStateTimer = 0.0;
        }

        // =========================================================
        // KUGELSICHERES DSE STATE ROUTING & CROSSFADES
        // =========================================================
        for (let i = this.activeDSEs.length - 1; i >= 0; i--) {
            let dse = this.activeDSEs[i];
            dse.stateTime += dt;

            // 1. Crossfade Swap-Out Handler
            if (dse._markedForRemoval) {
                if (dse.state !== 'stopping') {
                    dse.state = 'stopping';
                    dse.stateTime = 0.0;
                } else if (dse.stateTime >= TRANSITION_TIME) {
                    dse.state = 'idle';
                    dse.stateTime = 0.0;
                    dse._markedForRemoval = false;
                    this.activeDSEs.splice(i, 1); // Element ist komplett unsichtbar und wird gelöscht
                }
                continue; // Überspringt die normale Musik-Logik für dieses Element!
            }

            // 2. Normale Musik-Logik
            if (this.currentEnergyState === 'idle') {
                if (dse.state !== 'idle' && dse.state !== 'stopping') {
                    dse.state = 'stopping';
                    dse.stateTime = 0.0;
                } else if (dse.state === 'stopping' && dse.stateTime >= TRANSITION_TIME) {
                    dse.state = 'idle'; 
                    dse.stateTime = 0.0;
                }
            } else {
                if (dse.state === 'idle' || dse.state === 'stopping') {
                    dse.state = 'starting';
                    dse.stateTime = dse.state === 'stopping' ? Math.max(0.0, TRANSITION_TIME - dse.stateTime) : 0.0;
                } else if (dse.state === 'starting' && dse.stateTime >= TRANSITION_TIME) {
                    dse.state = this.currentEnergyState;
                    dse.stateTime = 0.0;
                } else if (dse.state === 'playing' || dse.state === 'buildup' || dse.state === 'climax') {
                    if (dse.state !== this.currentEnergyState) {
                        dse.state = this.currentEnergyState;
                        dse.stateTime = 0.0; 
                    }
                }
            }
        }
    }

    render(ctx, width, height, t, channelVolumes, isPlaying) {
        let dt = 0.016; 
        if (this.lastTime !== 0) {
            dt = t - this.lastTime;
            if (dt > 0.1) dt = 0.016; 
        }
        this.lastTime = t;

        this.analyzeEnergy(channelVolumes, dt);
        
        // NEU: Dynamic Swapping aufrufen, BEVOR wir die States updaten!
        if (isPlaying) {
            this.manageDynamicSwaps(dt);
        }
        
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