// === js/visuals/dj/tension-manager.js ===
// =========================================================
// SCENE-DJ SKILL: TENSION MANAGER (DEMO-DIRECTOR EDITION)
// Hardware-Register Sniffing, Novelty/Freshness Tracking,
// Event-based Climax with 50/50 Climax-Hold/Afterglow Split.
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
        
        // Demo-Director Metriken (Zero Allocation Speicher)
        this.lastRegs = new Uint8Array(32);
        this.freshness = 0.0;
        this.lastEnergy = 0.0;
        this.afterglowTimer = 0.0;
    }

    reset() {
        this.tension = 0.0;
        this.climaxTimer = 0.0;
        this.isClimaxLocked = false;
        this.energyStateTimer = 0.0;
        this.macroState = 'idle';
        
        this.freshness = 0.0;
        this.lastEnergy = 0.0;
        this.afterglowTimer = 0.0;
        this.lastRegs.fill(0);
    }

    update(dynamics, info, stageManager, dt, chipRegs) {
        this.energyStateTimer += dt;
        
        const energy = dynamics.masterEnergy[0];
        // 1. Momentum: Steigt die Energie gerade abrupt an?
        const momentum = Math.max(0.0, energy - this.lastEnergy) * 10.0;
        this.lastEnergy = energy;

        let freshnessSpike = 0.0;

        // =========================================================
        // 2. HARDWARE EVENT SNIFFING (NOVELTY DETECTION)
        // Analyse der Silizium-Register auf signifikante Ereignisse
        // =========================================================
        if (chipRegs && info.isPlaying) {
            if (info.system === 'c64') {
                // SID Events
                for (let v = 0; v < 3; v++) {
                    let ctrl = chipRegs[v * 7 + 4];
                    let lastCtrl = this.lastRegs[v * 7 + 4];
                    if ((ctrl & 1) && !(lastCtrl & 1)) freshnessSpike += 0.15; // Gate On
                    if ((ctrl & 0xF0) !== (lastCtrl & 0xF0)) freshnessSpike += 0.25; // Waveform Wechsel
                }
                let cut = (chipRegs[21] & 7) | (chipRegs[22] << 3);
                let lastCut = (this.lastRegs[21] & 7) | (this.lastRegs[22] << 3);
                if (Math.abs(cut - lastCut) > 200) freshnessSpike += 0.2; // Filter-Fahrt
                
            } else if (info.system === 'amiga') {
                // Paula Events (Gedämpftes Spiking gegen Hyperaktivität!)
                for (let c = 0; c < 4; c++) {
                    let offset = c * 7;
                    let vol = chipRegs[offset + 6];
                    let lastVol = this.lastRegs[offset + 6];
                    let per = (chipRegs[offset + 4] << 8) | chipRegs[offset + 5];
                    let lastPer = (this.lastRegs[offset + 4] << 8) | this.lastRegs[offset + 5];

                    if (vol > lastVol + 12) freshnessSpike += 0.08; 
                    if (vol > 0 && per !== lastPer && Math.abs(per - lastPer) > 12) freshnessSpike += 0.05; 
                }
                
            } else if (info.system === 'atari') {
                // YM Events
                if (chipRegs[13] !== this.lastRegs[13] && chipRegs[13] !== 255) freshnessSpike += 0.4; // Hardware Env
                if ((chipRegs[7] & 0x38) !== (this.lastRegs[7] & 0x38)) freshnessSpike += 0.3; // Noise Toggle
                if (chipRegs[14] !== this.lastRegs[14] && chipRegs[14] > 0) freshnessSpike += 0.3; // Digidrum 1
                if (chipRegs[15] !== this.lastRegs[15] && chipRegs[15] > 0) freshnessSpike += 0.3; // Digidrum 2
            }

            // Register-Zustand sichern
            for(let i = 0; i < 32; i++) {
                this.lastRegs[i] = chipRegs[i];
            }
        }

        // Freshness akkumulieren und abbauen
        this.freshness = Math.min(1.0, this.freshness + freshnessSpike);
        this.freshness = Math.max(0.0, this.freshness - (dt * 0.45));

        let targetState = this.macroState;

        if (!info.isPlaying) {
            this.tension = Math.max(0.0, this.tension - (dt * 15.0));
            this.isClimaxLocked = false;
            this.afterglowTimer = 0.0;
            targetState = 'idle';
        } else {
            // =========================================================
            // 3. EVENT-ORIENTED STATE MACHINE
            // =========================================================
            let refHold = Math.max(2.0, this.currentClimaxHoldTime);
            let halfHold = refHold * 0.5; // Die unbestechliche 50/50 Halbwertszeit

            if (this.macroState === 'afterglow') {
                // AFTERGLOW PHASE (Der Abkühlungs-Glow):
                // Die Tension fällt absolut linear mit dem Afterglow-Timer ab!
                this.afterglowTimer -= dt;
                
                this.tension = TENSION_MAX * Math.max(0.0, this.afterglowTimer / halfHold);
                
                if (this.afterglowTimer <= 0) {
                    this.tension = 0.0;
                    targetState = 'playing';
                    this.energyStateTimer = 0.0;
                }
            } else if (this.isClimaxLocked) {
                // CLIMAX PHASE (Die eigentliche Explosion):
                // Zündet für exakt 50% der climaxHoldTime das pure Action-Feuerwerkt!
                this.climaxTimer += dt;
                this.tension = TENSION_MAX; // Bleibt auf Vollanschlag

                if (this.climaxTimer >= halfHold) {
                    this.isClimaxLocked = false;
                    this.freshness = 0.0; // Kaltstart für die Erholungsphase
                    targetState = 'afterglow';
                    
                    // Die verbleibenden 50% der climaxHoldTime wandern in den Afterglow-Timer!
                    this.afterglowTimer = halfHold; 
                }
            } else {
                // BUILDUP PHASE: 40% Energy + 40% Momentum + 20% Novelty
                let power = (energy * 0.4) + (momentum * 0.4) + (this.freshness * 0.2);
                
                // Visual Intensity Multiplikator: Ohne Freshness (Novelty) verhungert der Pegelaufbau
                let visualIntensity = power * (0.3 + this.freshness * 0.7);

                // Extrem feinfühlige Akkumulations-Geschwindigkeiten
                let accumulationSpeed = 0.8;
                if (info.system === 'c64') accumulationSpeed = 1.0;
                else if (info.system === 'amiga') accumulationSpeed = 0.48; // Zügelt den rasanten Paula-Aufbau massiv

                if (visualIntensity > 0.15) {
                    this.tension += visualIntensity * accumulationSpeed * dt * 5.0; 
                    
                    if (this.tension >= TENSION_MAX) {
                        this.tension = TENSION_MAX;
                        this.isClimaxLocked = true;
                        this.climaxTimer = 0.0;
                        this.currentClimaxHoldTime = stageManager.getMaxClimaxHoldTime();
                        targetState = 'climax';
                    } else if (this.tension > TENSION_MAX * 0.65) {
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
                } else {
                    this.tension = Math.max(0.0, this.tension - (dt * 3.0));
                    if (this.macroState === 'buildup' && this.energyStateTimer > MIN_BUILDUP_TIME) {
                        targetState = 'playing';
                    }
                }
            }
        }

        // 4. WAKE-UP EVENT SIGNALISIEREN
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