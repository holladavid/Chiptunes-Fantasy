// === js/visuals/scene-dj.js ===
// =========================================================
// DEMOSCENE-SEQUENCER (DSS) / THE "SCENE-DJ"
// Zero-Allocation Orchestrator for Dynamic Visual Choreographies
// V2.0 Ready: Rebuilt with Black-Screen Protection (v1.2.0)
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
        dse._markedForRemoval = false;
        if (!dse.metadata) {
            console.warn(`[SCENE-DJ] Registered element ${dse.constructor.name} is missing a metadata contract!`);
            dse.metadata = { name: dse.constructor.name, minPlayTime: 5.0, weight: 10, climaxHoldTime: 10.0 };
        }
        this.registeredDSEs.push(dse);
    }

    selectWeightedDSE(candidates) {
        if (candidates.length === 0) return null;
        
        let totalWeight = 0.0;
        for (let i = 0; i < candidates.length; i++) {
            totalWeight += candidates[i].metadata.weight || 10.0;
        }

        const roll = Math.random() * totalWeight;
        let runningSum = 0.0;

        for (let i = 0; i < candidates.length; i++) {
            runningSum += candidates[i].metadata.weight || 10.0;
            if (roll <= runningSum) {
                return candidates[i];
            }
        }
        return candidates[0]; // Fallback
    }

    // =========================================================
    // SLOT-MASCHINE MIT INTEGRIERTER BLACK-SCREEN PROTECTION
    // Garantiert, dass niemals alle Ebenen gleichzeitig leer gefegt sind.
    // =========================================================
    fillEmptyLayers(initialState = 'starting') {
        let layerFilled = { 'background': false, 'floor': false, 'foreground': false, 'overlay': false };

        for (let i = 0; i < this.activeDSEs.length; i++) {
            let dse = this.activeDSEs[i];
            if (!dse._markedForRemoval) {
                layerFilled[dse.metadata.placementType] = true;
            }
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
        // Falls alle aktiven Nicht-Overlay Ebenen auf "Void" gefallen sind,
        // zwingen wir eine zufällige Ebene zur Wahl eines echten GFX-Effekts!
        // =========================================================
        let nonVoidCount = 0;
        let activeNonOverlays = this.activeDSEs.filter(d => d.metadata.placementType !== 'overlay' && !d._markedForRemoval);

        for (let i = 0; i < activeNonOverlays.length; i++) {
            if (!activeNonOverlays[i].metadata.isVoid) {
                nonVoidCount++;
            }
        }

        if (activeNonOverlays.length > 0 && nonVoidCount === 0) {
            // Wähle eine zufällige aktive Ebene aus, die wir überschreiben
            let dseToReplace = activeNonOverlays[Math.floor(Math.random() * activeNonOverlays.length)];
            
            // Suche echte, nicht-leere Alternativen für dieses Placement
            let realCandidates = this.registeredDSEs.filter(d => 
                d.state === 'idle' && 
                !d._markedForRemoval &&
                !d.metadata.isVoid && // Erfordert echtes GFX
                d.metadata.placementType === dseToReplace.metadata.placementType &&
                (d.metadata.computerType.includes(this.currentSystem) || d.metadata.computerType.includes('all'))
            );

            if (realCandidates.length > 0) {
                // Lösche das Void-Element sofort aus dem aktiven Verzeichnis
                let idx = this.activeDSEs.indexOf(dseToReplace);
                if (idx !== -1) {
                    dseToReplace.state = 'idle';
                    dseToReplace.stateTime = 0.0;
                    this.activeDSEs.splice(idx, 1);
                }

                // Ziehe eine echte GFX-Karte
                let chosen = this.selectWeightedDSE(realCandidates);
                chosen.state = initialState;
                chosen.stateTime = 0.0;
                chosen._markedForRemoval = false;
                this.activeDSEs.push(chosen);
            }
        }

        // Finales Z-Sorting
        this.activeDSEs.sort((a, b) => Z_ORDER[a.metadata.placementType] - Z_ORDER[b.metadata.placementType]);
    }

    forceSystemChange(newSystem) {
        this.currentSystem = newSystem;

        for (let i = this.activeDSEs.length - 1; i >= 0; i--) {
            let dse = this.activeDSEs[i];
            
            if (dse.metadata.minPlayTime === Infinity && dse.metadata.computerType.includes('all')) {
                continue; 
            }

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
                                dse.stateTime = Math.max(0, dse.metadata.minPlayTime - 5.0);
                            } else {
                                dse._markedForRemoval = true; 
                                swapOccurred = true;
                            }
                        }
                    }
                }
            }
        }

        if (swapOccurred) {
            this.fillEmptyLayers('starting');
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

        // --- TENSION & LOCK LOGIK ---
        if (!isPlaying) {
            this.isClimaxLocked = false;
            this.tension = Math.max(0.0, this.tension - (dt * 15.0)); 
            targetEnergyState = 'idle';
        } else if (!isBuildup && !isOverdrive) {
            this.isClimaxLocked = false;
            this.tension = Math.max(0.0, this.tension - (dt * 10.0)); 
            if (this.energyStateTimer > MIN_BUILDUP_TIME) {
                targetEnergyState = 'playing';
            }
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

        // =========================================================
        // WAKE-UP ROLL 
        // =========================================================
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

        // =========================================================
        // KUGELSICHERES DSE STATE ROUTING
        // =========================================================
        for (let i = this.activeDSEs.length - 1; i >= 0; i--) {
            let dse = this.activeDSEs[i];
            dse.stateTime += dt;

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