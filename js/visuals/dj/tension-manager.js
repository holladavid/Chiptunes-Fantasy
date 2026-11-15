// === js/visuals/dj/tension-manager.js ===
// =========================================================
// SCENE-DJ SKILL: TENSION MANAGER (DEMO-DIRECTOR EDITION)
// Hardware-Register Sniffing, Novelty/Freshness Tracking,
// Event-based Climax with 50/50 Climax-Hold/Afterglow Split.
// Calibrated Amiga Pacing & Instant-Wake-Up for Quiet Intos.
// =========================================================

const MIN_BUILDUP_TIME = 0.5;
const BUILDUP_THRESHOLD = 0.55;
const BUILDUP_HOLD_TIME = 3.5;
const FULL_BOARD_BUILDUP_HOLD_TIME = 1.5;
const FULL_BOARD_SPEED_BOOST = 1.3;
const MAX_DT = 0.1;
const MIN_RATE_DT = 1.0 / 240.0;
const MOMENTUM_MAX = 2.0;
export const TENSION_MAX = 20.0;

function clamp01(value) {
    return Number.isFinite(value) ? Math.max(0.0, Math.min(1.0, value)) : 0.0;
}

function sanitizeDt(dt) {
    return Number.isFinite(dt) && dt > 0.0 ? Math.min(dt, MAX_DT) : 0.0;
}

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
        this.hasRegisterSnapshot = false;
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
        this.hasRegisterSnapshot = false;
    }

    update(dynamics, info, stageManager, dt, chipRegs) {
        const safeDt = sanitizeDt(dt);
        this.energyStateTimer += safeDt;

        const energy = clamp01(dynamics && dynamics.masterEnergy ? dynamics.masterEnergy[0] : 0.0);
        // 1. Momentum: FPS-unabhaengige Anstiegsrate der Energie (kalibriert auf 60-Hz-Basis)
        const energyRate = safeDt > 0.0
            ? Math.max(0.0, energy - this.lastEnergy) / Math.max(safeDt, MIN_RATE_DT)
            : 0.0;
        const momentum = Math.min(MOMENTUM_MAX, energyRate * (10.0 / 60.0));
        this.lastEnergy = energy;

        let freshnessSpike = 0.0;

        // =========================================================
        // 2. HARDWARE EVENT SNIFFING (NOVELTY DETECTION)
        // Analyse der Silizium-Register auf signifikante Ereignisse
        // =========================================================
        if (chipRegs && info.isPlaying) {
            if (!this.hasRegisterSnapshot) {
                // Erster Live-Snapshot: nur Basislinie, keine kuenstliche Novelty.
                for (let i = 0; i < 32; i++) this.lastRegs[i] = chipRegs[i];
                this.hasRegisterSnapshot = true;
            } else {
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
                    // Paula Events (Kalibriert: Gesunder Mittelweg gegen Sättigung)
                    for (let c = 0; c < 4; c++) {
                        let offset = c * 7;
                        let vol = chipRegs[offset + 6];
                        let lastVol = this.lastRegs[offset + 6];
                        let per = (chipRegs[offset + 4] << 8) | chipRegs[offset + 5];
                        let lastPer = (this.lastRegs[offset + 4] << 8) | this.lastRegs[offset + 5];

                        if (vol > lastVol + 12) freshnessSpike += 0.10; // Ausgewogene Trigger-Schwelle
                        if (vol > 0 && per !== lastPer && Math.abs(per - lastPer) > 12) freshnessSpike += 0.05;
                    }

                } else if (info.system === 'atari') {
                    // YM Events: Hardware-Effekte plus melodische/rhythmische Kanalwechsel
                    for (let v = 0; v < 3; v++) {
                        const vol = chipRegs[8 + v] & 15;
                        const lastVol = this.lastRegs[8 + v] & 15;
                        const isEnv = (chipRegs[8 + v] & 16) !== 0;
                        const tonePer = chipRegs[v * 2] | ((chipRegs[v * 2 + 1] & 0x0F) << 8);
                        const lastTonePer = this.lastRegs[v * 2] | ((this.lastRegs[v * 2 + 1] & 0x0F) << 8);

                        if (!isEnv && vol > lastVol + 2) freshnessSpike += 0.10;
                        if ((vol > 0 || isEnv) && tonePer > 0 && Math.abs(tonePer - lastTonePer) > 8) {
                            freshnessSpike += 0.05;
                        }
                    }
                    if (chipRegs[13] !== this.lastRegs[13] && chipRegs[13] !== 255) freshnessSpike += 0.4; // Hardware Env
                    if ((chipRegs[7] & 0x38) !== (this.lastRegs[7] & 0x38)) freshnessSpike += 0.3; // Noise Toggle
                    if (chipRegs[14] !== this.lastRegs[14] && chipRegs[14] > 0) freshnessSpike += 0.3; // Digidrum 1
                    if (chipRegs[15] !== this.lastRegs[15] && chipRegs[15] > 0) freshnessSpike += 0.3; // Digidrum 2
                }

                // Register-Zustand sichern
                for (let i = 0; i < 32; i++) {
                    this.lastRegs[i] = chipRegs[i];
                }
            }
        } else {
            this.hasRegisterSnapshot = false;
        }

        // Systemspezifischer Abbau (Amiga sachte beschleunigt auf 0.65)
        let decaySpeed = 0.45;
        if (info.system === 'amiga') decaySpeed = 0.65;

        // Freshness akkumulieren und abbauen
        this.freshness = Math.min(1.0, this.freshness + freshnessSpike);
        this.freshness = Math.max(0.0, this.freshness - (safeDt * decaySpeed));

        let targetState = this.macroState;

        if (!info.isPlaying) {
            this.tension = Math.max(0.0, this.tension - (safeDt * 15.0));
            this.isClimaxLocked = false;
            this.afterglowTimer = 0.0;
            targetState = 'idle';
        } else {
            // =========================================================
            // ANTI-BLACKOUT: SOFORTIGES ERWACHEN AUS DEM IDLE-SCHLAF
            // =========================================================
            if (this.macroState === 'idle') {
                targetState = 'playing';
                this.tension = 0.0;
            }

            // =========================================================
            // 3. EVENT-ORIENTED STATE MACHINE
            // =========================================================
            let refHold = Math.max(2.0, this.currentClimaxHoldTime);
            let halfHold = refHold * 0.5; // Die unbestechliche 50/50 Halbwertszeit

            if (this.macroState === 'afterglow') {
                this.afterglowTimer -= safeDt;

                this.tension = TENSION_MAX * Math.max(0.0, this.afterglowTimer / halfHold);

                if (this.afterglowTimer <= 0) {
                    this.tension = 0.0;
                    targetState = 'playing';
                    this.energyStateTimer = 0.0;
                }
            } else if (this.isClimaxLocked) {
                this.climaxTimer += safeDt;
                this.tension = TENSION_MAX;

                if (this.climaxTimer >= halfHold) {
                    this.isClimaxLocked = false;
                    this.freshness = 0.0;
                    targetState = 'afterglow';
                    this.afterglowTimer = halfHold;
                }
            } else {
                let power = (energy * 0.4) + (momentum * 0.4) + (this.freshness * 0.2);
                let visualIntensity = power * (0.3 + this.freshness * 0.7);

                const channelCount = info.system === 'amiga' ? 4 : 3;
                const channelSmooth = dynamics ? dynamics.channelSmooth : null;
                let weakestChannel = 1.0;
                for (let i = 0; i < channelCount; i++) {
                    weakestChannel = Math.min(weakestChannel, clamp01(channelSmooth ? channelSmooth[i] : 0.0));
                }
                const channelDrive = clamp01((weakestChannel - 0.35) / 0.45);
                const loudnessDrive = clamp01((energy - 0.55) / 0.30);
                const beatDrive = clamp01(dynamics && dynamics.beatEnvelope ? dynamics.beatEnvelope[0] : 0.0);
                const fullBoardDrive = channelDrive * loudnessDrive * (0.35 + beatDrive * 0.65);

                let accumulationSpeed = 0.65;
                if (info.system === 'c64') accumulationSpeed = 0.40;
                else if (info.system === 'amiga') accumulationSpeed = 0.30;
                accumulationSpeed *= 1.0 + fullBoardDrive * FULL_BOARD_SPEED_BOOST;

                if (energy > 0.25) {
                    this.tension = Math.min(TENSION_MAX,
                        this.tension + visualIntensity * accumulationSpeed * safeDt * 4.0);

                    const buildupHoldTime = BUILDUP_HOLD_TIME -
                        fullBoardDrive * (BUILDUP_HOLD_TIME - FULL_BOARD_BUILDUP_HOLD_TIME);
                    const buildupComplete = this.macroState === 'buildup' &&
                        this.energyStateTimer >= buildupHoldTime;

                    if (this.tension >= TENSION_MAX && buildupComplete) {
                        this.tension = TENSION_MAX;
                        this.isClimaxLocked = true;
                        this.climaxTimer = 0.0;
                        this.currentClimaxHoldTime = stageManager.getMaxClimaxHoldTime();
                        targetState = 'climax';
                    } else if (this.macroState === 'playing' &&
                               this.tension > TENSION_MAX * BUILDUP_THRESHOLD &&
                               this.energyStateTimer > MIN_BUILDUP_TIME) {
                        targetState = 'buildup';
                    } else if (this.macroState === 'buildup' &&
                               this.tension < TENSION_MAX * 0.45 &&
                               this.energyStateTimer > MIN_BUILDUP_TIME) {
                        targetState = 'playing';
                    } else if (this.macroState !== 'playing' && this.macroState !== 'buildup') {
                        targetState = 'playing';
                    }
                } else {
                    // Song ist leise -> Tension baut sich sachte ab, aber Buildup-Hysterese (45%) bleibt intakt
                    this.tension = Math.max(0.0, this.tension - (safeDt * 3.0));

                    if (this.macroState === 'buildup' &&
                        this.tension < TENSION_MAX * 0.45 &&
                        this.energyStateTimer > MIN_BUILDUP_TIME) {
                        targetState = 'playing';
                    } else if (this.macroState === 'idle') {
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