// === js/visuals/dj/tension-manager.js ===
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
        let desiredState = 'playing';
        
        if (!info.isPlaying) desiredState = 'idle';
        else if (rawState === 'climax' || this.isClimaxLocked) desiredState = 'climax';
        else if (rawState === 'buildup') desiredState = 'buildup';

        if (desiredState === 'idle') {
            this.isClimaxLocked = false;
            this.tension = Math.max(0.0, this.tension - (dt * 15.0));
            targetState = 'idle';
        } else if (this.macroState === 'idle') {
            targetState = desiredState;
        } else {
            if (this.energyStateTimer > MIN_BUILDUP_TIME) targetState = desiredState;
        }

        if (info.isPlaying && !this.isClimaxLocked) {
            let power = (energy * 0.5) + (pulse * 2.0);
            if (rawState === 'climax') power *= 6.0;
            
            this.tension += power * accumulationSpeed * dt;
            
            if (this.tension >= TENSION_MAX) {
                this.tension = TENSION_MAX;
                this.isClimaxLocked = true;
                this.climaxTimer = 0.0;
                this.currentClimaxHoldTime = stageManager.getMaxClimaxHoldTime();
                targetState = 'climax';
            }
        }

        if (this.isClimaxLocked && info.isPlaying) {
            targetState = 'climax';
            if (rawState !== 'climax') {
                this.climaxTimer += dt;
                this.tension = TENSION_MAX * Math.max(0.0, 1.0 - (this.climaxTimer / this.currentClimaxHoldTime));
                if (this.climaxTimer >= this.currentClimaxHoldTime) {
                    this.isClimaxLocked = false;
                    this.tension = 0.0;
                    targetState = 'buildup';
                }
            } else {
                this.climaxTimer = 0.0;
                this.tension = TENSION_MAX;
            }
        }

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