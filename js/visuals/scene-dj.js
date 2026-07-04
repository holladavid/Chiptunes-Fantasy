// === js/visuals/scene-dj.js ===
// =========================================================
// DEMOSCENE-SEQUENCER (DSS) / THE "SCENE-DJ"
// Zero-Allocation Orchestrator for Dynamic Visual Choreographies
// Includes Transient Detection, RMS Energy Tracking & State Machine
// =========================================================

// Z-Order Map für aufeinanderfolgendes Rendern ohne Allokationen
const Z_ORDER = {
    'background': 0,
    'floor': 1,
    'foreground': 2,
    'overlay': 3
};

// Hysterese-Zeiten (in Sekunden), um visuelles Flackern zu verhindern
const MIN_CLIMAX_TIME = 0.5;
const MIN_BUILDUP_TIME = 0.5;
const TRANSITION_TIME = 1.5; // Dauer für Starting/Stopping

export class SceneDJ {
    constructor() {
        // =========================================================
        // ZERO-ALLOCATION MEMORY (DSP Metrics)
        // =========================================================
        this.channelSmooth = new Float32Array(4);
        this.channelPeaks = new Float32Array(4);
        this.masterEnergy = new Float32Array(1);
        this.transientPulse = new Float32Array(1);

        // Pre-allocated metrics object passed to DSE render() calls
        this.metrics = {
            energy: this.masterEnergy,
            pulse: this.transientPulse,
            smooth: this.channelSmooth
        };

        // =========================================================
        // POOLS & STATE
        // =========================================================
        this.registeredDSEs = [];
        this.activeDSEs = [];
        this.currentSystem = null;
        this.lastTime = 0;
        
        // Timer für die Hysterese der Intensitäts-States
        this.energyStateTimer = 0.0;
        this.currentEnergyState = 'Playing'; // 'Playing', 'Buildup', 'Climax'
    }

    /**
     * Registriert ein neues Demo-Scene-Element (DSE).
     * @param {Object} dse - Das zu registrierende DSE
     */
    registerDSE(dse) {
        // Initiale State-Variablen an das DSE hängen, falls nicht vorhanden
        dse.state = 'Idle';
        dse.stateTime = 0.0;
        this.registeredDSEs.push(dse);
    }

    /**
     * Wird von visualizer.js bei einem Systemwechsel (Tab-Klick) aufgerufen.
     * @param {String} newSystem - z.B. 'c64', 'amiga', 'atari'
     */
    forceSystemChange(newSystem) {
        this.currentSystem = newSystem;

        // 1. Inkompatible aktive DSEs stoppen
        for (let i = this.activeDSEs.length - 1; i >= 0; i--) {
            let dse = this.activeDSEs[i];
            if (!dse.computerType.includes(newSystem) && !dse.computerType.includes('all')) {
                // Wir setzen sie sofort auf Idle, um visuelle Glitches bei Core-Resets zu vermeiden
                dse.state = 'Idle';
                dse.stateTime = 0.0;
                this.activeDSEs.splice(i, 1);
            }
        }

        // 2. Passende DSEs für das neue System finden und starten
        // (Vorerst starten wir das erste passende Gimmick, das wir finden)
        for (let i = 0; i < this.registeredDSEs.length; i++) {
            let dse = this.registeredDSEs[i];
            if ((dse.computerType.includes(newSystem) || dse.computerType.includes('all')) && dse.state === 'Idle') {
                dse.state = 'Starting';
                dse.stateTime = 0.0;
                this.activeDSEs.push(dse);
                
                // Active-Array sofort nach Z-Order sortieren
                this.activeDSEs.sort((a, b) => Z_ORDER[a.placementType] - Z_ORDER[b.placementType]);
                break; // In v1.2.0 nur ein Gimmick pro System
            }
        }
        
        // Reset Energy State
        this.currentEnergyState = 'Playing';
        this.energyStateTimer = 0.0;
    }

    /**
     * Leitet Window-Resize-Events an alle DSEs (aktiv & idle) weiter.
     */
    resize(width, height) {
        for (let i = 0; i < this.registeredDSEs.length; i++) {
            if (typeof this.registeredDSEs[i].resize === 'function') {
                this.registeredDSEs[i].resize(width, height);
            }
        }
    }

    /**
     * Analysiert die Audio-Energie ohne Garbage Collection.
     */
    analyzeEnergy(channelVolumes, dt) {
        let totalEnergy = 0.0;
        let maxPulse = 0.0;

        for (let i = 0; i < 4; i++) {
            let rawVol = channelVolumes[i] || 0.0;

            // 1. Envelope Follower (IIR Filter)
            // Schneller Attack, langsamer Decay
            if (rawVol > this.channelSmooth[i]) {
                this.channelSmooth[i] += (rawVol - this.channelSmooth[i]) * 0.8; // Attack
            } else {
                this.channelSmooth[i] += (rawVol - this.channelSmooth[i]) * 0.15; // Decay
            }

            // 2. Peak Detection (Transienten)
            if (rawVol > this.channelPeaks[i]) {
                this.channelPeaks[i] = rawVol;
            } else {
                this.channelPeaks[i] -= 0.5 * dt; // Gravity
                if (this.channelPeaks[i] < 0) this.channelPeaks[i] = 0;
            }

            // Transient Pulse: Distanz vom Smooth zum Peak
            let pulse = this.channelPeaks[i] - this.channelSmooth[i];
            if (pulse > maxPulse) maxPulse = pulse;

            totalEnergy += this.channelSmooth[i];
        }

        // Master RMS Näherung & Pulse Normalisierung
        this.masterEnergy[0] = totalEnergy / 4.0;
        this.transientPulse[0] = maxPulse > 0.0 ? maxPulse : 0.0;
    }

    /**
     * Steuert die State-Machines der aktiven DSEs.
     */
    updateStateMachines(dt) {
        // 1. Globale Energie-Einstufung (Mit Hysterese)
        this.energyStateTimer += dt;
        
        const energy = this.masterEnergy[0];
        const pulse = this.transientPulse[0];
        
        let targetEnergyState = 'Playing';
        if (energy > 0.65 && pulse > 0.4) {
            targetEnergyState = 'Climax';
        } else if (energy > 0.45) {
            targetEnergyState = 'Buildup';
        }

        // Hysterese-Logik: States dürfen nur abgewertet werden, wenn die Mindestzeit abgelaufen ist
        if (targetEnergyState === 'Climax') {
            this.currentEnergyState = 'Climax';
            this.energyStateTimer = 0.0;
        } else if (targetEnergyState === 'Buildup') {
            if (this.currentEnergyState !== 'Climax' || this.energyStateTimer > MIN_CLIMAX_TIME) {
                this.currentEnergyState = 'Buildup';
                this.energyStateTimer = 0.0;
            }
        } else {
            // Target is 'Playing'
            if ((this.currentEnergyState === 'Climax' && this.energyStateTimer > MIN_CLIMAX_TIME) ||
                (this.currentEnergyState === 'Buildup' && this.energyStateTimer > MIN_BUILDUP_TIME) ||
                this.currentEnergyState === 'Playing') {
                this.currentEnergyState = 'Playing';
            }
        }

        // 2. DSE-spezifische State-Machine Updates
        for (let i = this.activeDSEs.length - 1; i >= 0; i--) {
            let dse = this.activeDSEs[i];
            dse.stateTime += dt;

            // Transition: Starting -> Active Energy State
            if (dse.state === 'Starting' && dse.stateTime >= TRANSITION_TIME) {
                dse.state = this.currentEnergyState;
                dse.stateTime = 0.0;
            }
            
            // Sync Energy State wenn wir bereits spielen
            if (dse.state === 'Playing' || dse.state === 'Buildup' || dse.state === 'Climax') {
                if (dse.state !== this.currentEnergyState) {
                    dse.state = this.currentEnergyState;
                    dse.stateTime = 0.0; // Reset timer for the specific energy state
                }
            }

            // Transition: Stopping -> Idle (Aus dem aktiven Pool entfernen)
            if (dse.state === 'Stopping' && dse.stateTime >= TRANSITION_TIME) {
                dse.state = 'Idle';
                dse.stateTime = 0.0;
                this.activeDSEs.splice(i, 1);
            }
        }
    }

/**
     * Haupt-Render-Schleife. Wird von visualizer.js aufgerufen.
     */
    render(ctx, width, height, t, channelVolumes) {
        // Delta Time berechnen (in Sekunden)
        let dt = 0.016; // Fallback (60fps)
        if (this.lastTime !== 0) {
            dt = t - this.lastTime;
        }
        this.lastTime = t;

        // 1. Analyse & Orchestrierung
        this.analyzeEnergy(channelVolumes, dt);
        this.updateStateMachines(dt);

        // 2. Z-Order Rendering (activeDSEs sind bereits beim Insert sortiert!)
        for (let i = 0; i < this.activeDSEs.length; i++) {
            let dse = this.activeDSEs[i];
            // Unified DSE Render Call
            dse.render(ctx, width, height, t, dse.state, dse.stateTime, this.metrics);
        }

        // =========================================================
        // TEMPORARY DEBUG HUD (Energy & State)
        // =========================================================
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        
        // Kasten oben links
        ctx.fillRect(10, 10, 240, 80);
        ctx.strokeRect(10, 10, 240, 80);

        ctx.font = '12px "VT323", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        // State-Text Farbe abhängig von der Intensität
        if (this.currentEnergyState === 'Climax') ctx.fillStyle = '#ff3333';
        else if (this.currentEnergyState === 'Buildup') ctx.fillStyle = '#ffff33';
        else ctx.fillStyle = '#33ff33';

        ctx.fillText(`DJ STATE : [ ${this.currentEnergyState.toUpperCase()} ]`, 20, 20);

        // RMS Energy Bar
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`ENERGY   : ${this.masterEnergy[0].toFixed(3)}`, 20, 40);
        ctx.fillStyle = '#444444';
        ctx.fillRect(110, 42, 120, 8);
        ctx.fillStyle = '#ffff33'; // Gelb für RMS
        ctx.fillRect(110, 42, Math.min(1.0, this.masterEnergy[0]) * 120, 8);

        // Transient Pulse Bar
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`PULSE    : ${this.transientPulse[0].toFixed(3)}`, 20, 60);
        ctx.fillStyle = '#444444';
        ctx.fillRect(110, 62, 120, 8);
        ctx.fillStyle = '#ff3333'; // Rot für Transienten (Kick/Snare)
        ctx.fillRect(110, 62, Math.min(1.0, this.transientPulse[0]) * 120, 8);
        // =========================================================
    }
}