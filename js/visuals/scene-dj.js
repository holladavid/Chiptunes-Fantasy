// === js/visuals/scene-dj.js ===
// =========================================================
// DEMOSCENE-SEQUENCER (DSS) / THE "SCENE-DJ"
// Zero-Allocation Orchestrator for Dynamic Visual Choreographies
// Aligned States: idle -> playing -> buildup -> climax (v1.2.0)
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
        if (!dse.metadata) {
            console.warn(`[SCENE-DJ] Registered element ${dse.constructor.name} is missing a metadata contract!`);
            dse.metadata = { name: dse.constructor.name, minPlayTime: 5.0, triggerProbability: 0.5, climaxHoldTime: 10.0 };
        }
        this.registeredDSEs.push(dse);
    }

    forceSystemChange(newSystem) {
        this.currentSystem = newSystem;

        // 1. Systemfremde DSEs hart aus dem aktiven Pool werfen
        for (let i = this.activeDSEs.length - 1; i >= 0; i--) {
            let dse = this.activeDSEs[i];
            
            if (dse.metadata.triggerProbability === 1.0 && dse.metadata.computerType.includes('all')) {
                continue; 
            }

            if (!dse.metadata.computerType.includes(newSystem) && !dse.metadata.computerType.includes('all')) {
                dse.state = 'idle';
                this.activeDSEs.splice(i, 1);
            }
        }

        // 2. Systemgetreue DSEs in den Pool laden (schlafend)
        for (let i = 0; i < this.registeredDSEs.length; i++) {
            let dse = this.registeredDSEs[i];
            if (dse.metadata.computerType.includes(newSystem) || dse.metadata.computerType.includes('all')) {
                if (!this.activeDSEs.includes(dse)) {
                    dse.state = 'idle';
                    dse.stateTime = 0.0;
                    this.activeDSEs.push(dse);
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

    updateStateMachines(dt, isPlaying) {
        this.energyStateTimer += dt;
        
        const energy = this.masterEnergy[0];
        const pulse = this.transientPulse[0];
        
        // =========================================================
        // SYSTEM-SPEZIFISCHES FEINTUNING (UPDATE v1.2.0)
        // Drosselt die Empfindlichkeit für C64 und Amiga weiter,
        // um epische Spannungsaufbauten zu garantieren.
        // =========================================================
        let buildupThreshold = 0.40;    // Amiga Default (Erhöht von 0.38)
        let overdriveThreshold = 0.58;   // Amiga Default (Erhöht von 0.55)
        let pulseThreshold = 0.35;       
        let accumulationSpeed = 0.75;    // Amiga Füllrate gedrosselt (von 1.0)

        if (this.currentSystem === 'c64') {
            buildupThreshold = 0.40;     // Amiga Niveau angeglichen (von 0.32)
            overdriveThreshold = 0.58;   
            pulseThreshold = 0.30;       
            accumulationSpeed = 0.45;    // Füllrate gedrosselt (von 0.60)
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

        if (this.currentEnergyState !== targetEnergyState) {
            this.currentEnergyState = targetEnergyState;
            this.energyStateTimer = 0.0;
        }

        // =========================================================
        // KUGELSICHERES DSE STATE ROUTING
        // =========================================================
        for (let i = 0; i < this.activeDSEs.length; i++) {
            let dse = this.activeDSEs[i];
            dse.stateTime += dt;

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
                    dse.stateTime = 0.0;
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