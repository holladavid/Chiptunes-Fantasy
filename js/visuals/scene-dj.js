// === js/visuals/scene-dj.js ===
// =========================================================
// DEMOSCENE-SEQUENCER (DSS) / THE "SCENE-DJ"
// Zero-Allocation Orchestrator for Dynamic Visual Choreographies
// =========================================================

const Z_ORDER = {
    'background': 0,
    'floor': 1,
    'foreground': 2,
    'overlay': 3
};

const MIN_BUILDUP_TIME = 0.5;
const TRANSITION_TIME = 1.5; 

export class SceneDJ {
    constructor() {
        this.channelSmooth = new Float32Array(4);
        this.channelPeaks = new Float32Array(4);
        this.masterEnergy = new Float32Array(1);
        this.transientPulse = new Float32Array(1);

        this.metrics = {
            energy: this.masterEnergy,
            pulse: this.transientPulse,
            smooth: this.channelSmooth
        };

        this.registeredDSEs = [];
        this.activeDSEs = [];
        this.currentSystem = null;
        this.lastTime = 0;
        
        this.energyStateTimer = 0.0;
        this.currentEnergyState = 'Playing'; 

        // --- NEU: Climax Lock & Auto-Trigger Timer ---
        this.buildupTimer = 0.0;
        this.climaxTimer = 0.0;
        this.isClimaxLocked = false;
        this.currentClimaxHoldTime = 10.0;
    }

    registerDSE(dse) {
        dse.state = 'Idle';
        dse.stateTime = 0.0;
        this.registeredDSEs.push(dse);
    }

    forceSystemChange(newSystem) {
        this.currentSystem = newSystem;

        for (let i = this.activeDSEs.length - 1; i >= 0; i--) {
            let dse = this.activeDSEs[i];
            if (!dse.computerType.includes(newSystem) && !dse.computerType.includes('all')) {
                dse.state = 'Idle';
                dse.stateTime = 0.0;
                this.activeDSEs.splice(i, 1);
            }
        }

        for (let i = 0; i < this.registeredDSEs.length; i++) {
            let dse = this.registeredDSEs[i];
            if ((dse.computerType.includes(newSystem) || dse.computerType.includes('all')) && dse.state === 'Idle') {
                dse.state = 'Starting';
                dse.stateTime = 0.0;
                this.activeDSEs.push(dse);
            }
        }
        
        this.activeDSEs.sort((a, b) => Z_ORDER[a.placementType] - Z_ORDER[b.placementType]);
        
        // Reset System State
        this.currentEnergyState = 'Playing';
        this.energyStateTimer = 0.0;
        this.buildupTimer = 0.0;
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
        
        // 1. Raw State aus dem aktuellen Audio-Frame ermitteln
        let rawState = 'Playing';
        // Wir senken die Climax-Schwelle minimal, damit er öfter von Natur aus feuert
        if (energy > 0.60 && pulse > 0.4) {
            rawState = 'Climax';
        } else if (energy > 0.45) {
            rawState = 'Buildup';
        }

        let targetEnergyState = this.currentEnergyState;

        // 2. Climax Lock & 30s Auto-Trigger Logik
        if (rawState === 'Playing') {
            // Fällt der Track in ein ruhiges Break, heben wir den Climax SOFORT auf
            this.isClimaxLocked = false;
            this.buildupTimer = 0.0;
            if (this.energyStateTimer > MIN_BUILDUP_TIME) {
                targetEnergyState = 'Playing';
            }
        } else {
            // Wir sind in einem energetischen Bereich
            if (rawState === 'Climax' && !this.isClimaxLocked) {
                // Natürlicher Climax getriggert!
                this.isClimaxLocked = true;
                this.climaxTimer = 0.0;
                this.currentClimaxHoldTime = this.activeDSEs.length > 0 
                    ? Math.max(...this.activeDSEs.map(d => d.climaxHoldTime || 10.0)) 
                    : 10.0;
            } else if (rawState === 'Buildup' && !this.isClimaxLocked) {
                // Wir sind im Buildup -> Zähler für den Auto-Climax erhöhen
                this.buildupTimer += dt;
                
                // Nach 30 Sekunden ununterbrochenem Buildup -> Forced Climax!
                if (this.buildupTimer >= 30.0) {
                    this.isClimaxLocked = true;
                    this.climaxTimer = 0.0;
                    this.currentClimaxHoldTime = this.activeDSEs.length > 0 
                        ? Math.max(...this.activeDSEs.map(d => d.climaxHoldTime || 10.0)) 
                        : 10.0;
                }
                
                if (this.currentEnergyState === 'Playing' && this.energyStateTimer > MIN_BUILDUP_TIME) {
                    targetEnergyState = 'Buildup';
                }
            }

            // Wenn der Climax gelockt ist, überschreibt er alles!
            if (this.isClimaxLocked) {
                targetEnergyState = 'Climax';
                this.climaxTimer += dt;
                
                // Hold-Time abgelaufen? Zurück in den Buildup.
                if (this.climaxTimer >= this.currentClimaxHoldTime) {
                    this.isClimaxLocked = false;
                    this.buildupTimer = 0.0; // Reset für die nächsten 30s
                    targetEnergyState = 'Buildup';
                }
            } else {
                if (targetEnergyState === 'Climax') targetEnergyState = 'Buildup'; // Sanfter Fallback
            }
        }

        // 3. Globalen State übernehmen, falls er sich geändert hat
        if (this.currentEnergyState !== targetEnergyState) {
            this.currentEnergyState = targetEnergyState;
            this.energyStateTimer = 0.0;
        }

        // 4. DSE-spezifische State-Machine Updates
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
                dse.state = 'Idle';
                dse.stateTime = 0.0;
                this.activeDSEs.splice(i, 1);
            }
        }
    }

    render(ctx, width, height, t, channelVolumes) {
        let dt = 0.016; 
        if (this.lastTime !== 0) {
            dt = t - this.lastTime;
        }
        this.lastTime = t;

        this.analyzeEnergy(channelVolumes, dt);
        this.updateStateMachines(dt);

        for (let i = 0; i < this.activeDSEs.length; i++) {
            let dse = this.activeDSEs[i];
            dse.render(ctx, width, height, t, dse.state, dse.stateTime, this.metrics);
        }

        // =========================================================
        // TEMPORARY DEBUG HUD (Energy, State & Timers)
        // =========================================================
        const padding = 15;
        const lineH = 20;
        const activeTextCount = this.activeDSEs.length;
        
        // Etwas mehr Höhe für die Timer-Informationen
        const boxH = 110 + (activeTextCount * lineH);
        const boxW = 260;
        const boxX = 15;
        const boxY = height - boxH - 15;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;

        ctx.fillRect(boxX, boxY, boxW, boxH);
        ctx.strokeRect(boxX, boxY, boxW, boxH);

        ctx.font = '12px "VT323", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        let textY = boxY + padding;

        if (this.currentEnergyState === 'Climax') ctx.fillStyle = '#ff3333';
        else if (this.currentEnergyState === 'Buildup') ctx.fillStyle = '#ffff33';
        else ctx.fillStyle = '#33ff33';

        // Anzeige des Haupt-States UND der aktuellen Timer (Climax-Hold vs 30s Countdown)
        let timerInfo = "";
        if (this.isClimaxLocked) {
            timerInfo = `(HOLD: ${(this.currentClimaxHoldTime - this.climaxTimer).toFixed(1)}s)`;
        } else if (this.currentEnergyState === 'Buildup') {
            timerInfo = `(AUTO: ${(30.0 - this.buildupTimer).toFixed(1)}s)`;
        }
        
        ctx.fillText(`DJ STATE : [ ${this.currentEnergyState.toUpperCase()} ] ${timerInfo}`, boxX + 10, textY);
        
        textY += lineH;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`ENERGY   : ${this.masterEnergy[0].toFixed(3)}`, boxX + 10, textY);
        ctx.fillStyle = '#444444';
        ctx.fillRect(boxX + 90, textY + 2, 150, 8);
        ctx.fillStyle = '#ffff33'; 
        ctx.fillRect(boxX + 90, textY + 2, Math.min(1.0, this.masterEnergy[0]) * 150, 8);

        textY += lineH;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`PULSE    : ${this.transientPulse[0].toFixed(3)}`, boxX + 10, textY);
        ctx.fillStyle = '#444444';
        ctx.fillRect(boxX + 90, textY + 2, 150, 8);
        ctx.fillStyle = '#ff3333'; 
        ctx.fillRect(boxX + 90, textY + 2, Math.min(1.0, this.transientPulse[0]) * 150, 8);

        textY += lineH + 10;
        ctx.fillStyle = '#6c5eb5'; 
        ctx.fillText(`ACTIVE DSE CLASSES:`, boxX + 10, textY);

        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < this.activeDSEs.length; i++) {
            textY += lineH;
            let dse = this.activeDSEs[i];
            let className = dse.constructor.name;
            ctx.fillText(`> ${className} [${dse.state}]`, boxX + 10, textY);
        }
    }
}