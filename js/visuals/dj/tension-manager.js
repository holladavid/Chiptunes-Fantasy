// === js/visuals/dj/tension-manager.js ===
// =========================================================
// SCENE-DJ SKILL: TENSION MANAGER
// Interpretiert die Audio-Dynamik, steuert die Tension-Integration
// und feuert die globalen State-Machine Statusänderungen.
// Pure Tension Routing: KEIN direkter Climax-Sprung mehr!
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
        // KORREKTUR: C64 Bremse gelöst! Von 0.45 massiv auf 0.75 angehoben. 
        // Die Spannung akkumuliert bei Rob Hubbard Tracks nun rasant.
        if (info.system === 'c64') accumulationSpeed = 0.75;
        else if (info.system === 'atari') accumulationSpeed = 0.55;

        let targetState = this.macroState;

        if (!info.isPlaying) {
            this.isClimaxLocked = false;
            this.tension = Math.max(0.0, this.tension - (dt * 15.0));
            targetState = 'idle';
        } else {
            let isOverdrive = (rawState === 'climax');
            let isBuildup = (rawState === 'buildup');

            // 1. TENSION-AUFBAU (Kein Direct-Trigger Bypass mehr!)
            if (!this.isClimaxLocked) {
                if (isBuildup || isOverdrive) {
                    let power = (energy * 0.5) + (pulse * 2.0);
                    
                    // Moderater Boost bei extremen Drums (vorher 6.0)
                    if (isOverdrive) power *= 3.5; 
                    
                    this.tension += power * accumulationSpeed * dt;
                    
                    if (this.tension >= TENSION_MAX) {
                        this.tension = TENSION_MAX;
                        this.isClimaxLocked = true;
                        this.climaxTimer = 0.0;
                        this.currentClimaxHoldTime = stageManager.getMaxClimaxHoldTime();
                    }
                } else {
                    // Track ist ruhig ('playing') -> Spannung baut sich sanft ab
                    this.tension = Math.max(0.0, this.tension - (dt * 10.0));
                }
            }

            // 2. STATE TARGETING & DEBOUNCING
            if (this.macroState === 'idle') {
                // INSTANT WAKE-UP
                targetState = this.isClimaxLocked ? 'climax' : ((isBuildup || isOverdrive) ? 'buildup' : 'playing');
            } else if (this.isClimaxLocked) {
                targetState = 'climax';
                
                // Hold-Timer läuft rückwärts, wenn der physikalische Track-Overdrive abgeklungen ist
                if (!isOverdrive) {
                    this.climaxTimer += dt;
                    this.tension = TENSION_MAX * Math.max(0.0, 1.0 - (this.climaxTimer / this.currentClimaxHoldTime));
                    
                    if (this.climaxTimer >= this.currentClimaxHoldTime) {
                        this.isClimaxLocked = false;
                        this.tension = 0.0;
                        targetState = (isBuildup || isOverdrive) ? 'buildup' : 'playing';
                    }
                } else {
                    // Solange der Track massiv feuert, pausiert der Hold-Timer
                    this.climaxTimer = 0.0;
                    this.tension = TENSION_MAX;
                }
            } else {
                // Debouncing für flüssige Übergänge zwischen Playing und Buildup
                if (isBuildup || isOverdrive) {
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