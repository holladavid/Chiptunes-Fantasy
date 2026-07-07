// === js/visuals/dj/tension-manager.js ===
// =========================================================
// SCENE-DJ SKILL: TENSION MANAGER
// Interpretiert die Audio-Dynamik, steuert die Tension-Integration
// und feuert die globalen State-Machine Statusänderungen.
// =========================================================

const MIN_BUILDUP_TIME = 0.5;
export const TENSION_MAX = 20.0;

export class TensionManager {
    constructor() {
        this.tension = 0.0;
        this.climaxTimer = 0.0;
        this.isClimaxLocked = false;
        this.currentClimaxHoldTime = 10.0;
        this.macroState = 'idle';
        this.energyStateTimer = 0.0;
    }

    reset() {
        this.tension = 0.0;
        this.climaxTimer = 0.0;
        this.isClimaxLocked = false;
        this.energyStateTimer = 0.0;
        this.macroState = 'idle';
    }

    update(dynamics, info, stageManager, dt) {
        this.energyStateTimer += dt;
        
        const energy = dynamics.masterEnergy[0];
        const pulse = dynamics.transientPulse[0];
        const rawState = dynamics.rawEnergyState;

        let accumulationSpeed = 0.75;
        if (info.system === 'c64') accumulationSpeed = 0.45;
        else if (info.system === 'atari') accumulationSpeed = 0.15;

        let targetState = this.macroState;

        if (!info.isPlaying) {
            this.isClimaxLocked = false;
            this.tension = Math.max(0.0, this.tension - (dt * 15.0));
            targetState = 'idle';
        } else {
            let isOverdrive = (rawState === 'climax');
            let isBuildup = (rawState === 'buildup');

            // 1. TENSION & TRIGGER LOGIK
            if (isOverdrive) {
                // =========================================================
                // DIREKT-TRIGGER: SOFORTIGE ESKALATION
                // =========================================================
                this.isClimaxLocked = true;
                this.climaxTimer = 0.0;
                this.tension = TENSION_MAX;
                this.currentClimaxHoldTime = stageManager.getMaxClimaxHoldTime();
            } else if (isBuildup && !this.isClimaxLocked) {
                // =========================================================
                // TENSION-AUFBAU (Fass füllen)
                // =========================================================
                let power = (energy * 0.5) + (pulse * 2.0);
                this.tension += power * accumulationSpeed * dt;
                
                if (this.tension >= TENSION_MAX) {
                    this.tension = TENSION_MAX;
                    this.isClimaxLocked = true;
                    this.climaxTimer = 0.0;
                    this.currentClimaxHoldTime = stageManager.getMaxClimaxHoldTime();
                }
            } else if (!this.isClimaxLocked) {
                // Beruhigung
                this.tension = Math.max(0.0, this.tension - (dt * 10.0));
            }

            // 2. STATE TARGETING & DEBOUNCING
            if (this.macroState === 'idle') {
                // INSTANT WAKE-UP
                targetState = this.isClimaxLocked ? 'climax' : (isBuildup ? 'buildup' : 'playing');
            } else if (this.isClimaxLocked) {
                targetState = 'climax';
                
                // Hold-Timer läuft rückwärts, wenn der direkte Overdrive abgeklungen ist
                if (!isOverdrive) {
                    this.climaxTimer += dt;
                    this.tension = TENSION_MAX * Math.max(0.0, 1.0 - (this.climaxTimer / this.currentClimaxHoldTime));
                    
                    if (this.climaxTimer >= this.currentClimaxHoldTime) {
                        this.isClimaxLocked = false;
                        this.tension = 0.0;
                        targetState = isBuildup ? 'buildup' : 'playing';
                    }
                }
            } else {
                // Debouncing für flüssige Übergänge zwischen Playing und Buildup
                if (isBuildup) {
                    if (this.macroState === 'playing' && this.energyStateTimer > MIN_BUILDUP_TIME) {
                        targetState = 'buildup';
                    }
                } else {
                    if (this.macroState === 'buildup' && this.energyStateTimer > MIN_BUILDUP_TIME) {
                        targetState = 'playing';
                    } else if (this.macroState !== 'buildup') {
                        targetState = 'playing'; 
                    }
                }
            }
        }

        // 3. WAKE-UP EVENT SIGNALISIEREN
        let didWakeUp = false;
        if (this.macroState !== targetState) {
            if (this.macroState === 'idle' && targetState !== 'idle') {
                stageManager.clearNonPermanentDSEs();
                didWakeUp = true;
            }
            this.macroState = targetState;
            this.energyStateTimer = 0.0;
        }
        return didWakeUp;
    }
}