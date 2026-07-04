// === js/visuals/scene-dj.js ===
// =========================================================
// DEMOSCENE-SEQUENCER (DSS) / THE "SCENE-DJ"
// Zero-Allocation Orchestrator for Dynamic Visual Choreographies
// Includes System-Themed "LIMIT BREAK" Tension Meter
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
            smooth: this.channelSmooth
        };

        this.registeredDSEs = [];
        this.activeDSEs = [];
        this.currentSystem = null;
        this.lastTime = 0;
        
        this.energyStateTimer = 0.0;
        this.currentEnergyState = 'Playing'; 
        this.rawEnergyState = 'Playing';

        this.tension = 0.0;
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
        
        this.currentEnergyState = 'Playing';
        this.rawEnergyState = 'Playing';
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
        
        let rawState = 'Playing';
        if (energy > 0.60 && pulse > 0.4) {
            rawState = 'Climax';
        } else if (energy > 0.45) {
            rawState = 'Buildup';
        }
        
        this.rawEnergyState = rawState;
        let targetEnergyState = this.currentEnergyState;

        if (rawState === 'Playing') {
            this.isClimaxLocked = false;
            this.tension = Math.max(0.0, this.tension - (dt * 5.0)); 
            if (this.energyStateTimer > MIN_BUILDUP_TIME) targetEnergyState = 'Playing';
        } else {
            if (rawState === 'Climax') {
                this.isClimaxLocked = true;
                this.climaxTimer = 0.0; 
                this.tension = 0.0;     
                this.currentClimaxHoldTime = this.activeDSEs.length > 0 
                    ? Math.max(...this.activeDSEs.map(d => d.climaxHoldTime || 10.0)) : 10.0;
            } else if (rawState === 'Buildup') {
                if (!this.isClimaxLocked) {
                    let power = (energy * 0.5) + (pulse * 2.0); 
                    this.tension += power * dt;

                    if (this.tension >= TENSION_MAX) {
                        this.isClimaxLocked = true;
                        this.climaxTimer = 0.0;
                        this.tension = 0.0; 
                        this.currentClimaxHoldTime = this.activeDSEs.length > 0 
                            ? Math.max(...this.activeDSEs.map(d => d.climaxHoldTime || 10.0)) : 10.0;
                    } else if (this.currentEnergyState === 'Playing' && this.energyStateTimer > MIN_BUILDUP_TIME) {
                        targetEnergyState = 'Buildup';
                    }
                }
            }

            if (this.isClimaxLocked) {
                targetEnergyState = 'Climax';
                if (rawState === 'Buildup') {
                    this.climaxTimer += dt;
                    if (this.climaxTimer >= this.currentClimaxHoldTime) {
                        this.isClimaxLocked = false;
                        this.tension = 0.0;
                        targetEnergyState = 'Buildup';
                    }
                }
            } else {
                if (targetEnergyState === 'Climax') targetEnergyState = 'Buildup';
            }
        }

        if (this.currentEnergyState !== targetEnergyState) {
            this.currentEnergyState = targetEnergyState;
            this.energyStateTimer = 0.0;
        }

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
        if (this.lastTime !== 0) dt = t - this.lastTime;
        this.lastTime = t;

        this.analyzeEnergy(channelVolumes, dt);
        this.updateStateMachines(dt);

        for (let i = 0; i < this.activeDSEs.length; i++) {
            let dse = this.activeDSEs[i];
            dse.render(ctx, width, height, t, dse.state, dse.stateTime, this.metrics);
        }

        // =========================================================
        // LIMIT BREAK TENSION METER (System-Themed)
        // =========================================================
        const w = 240;
        const h = 18;
        const x = 20;
        const y = height - h - 20;

        let pct = this.tension / TENSION_MAX;
        let isFlashing = false;

        // Prozent-Kalkulation & Flashing-Logik
        if (this.currentEnergyState === 'Climax') {
            if (this.rawEnergyState === 'Climax') {
                pct = 1.0;
                isFlashing = (performance.now() % 150 < 75); // Schnelles Blinken
            } else if (this.isClimaxLocked) {
                // Balken läuft sanft rückwärts ab (Hold-Time)
                pct = Math.max(0.0, 1.0 - (this.climaxTimer / this.currentClimaxHoldTime));
                isFlashing = (pct > 0.85) && (performance.now() % 300 < 150); // Langsames Blinken
            }
        }
        pct = Math.max(0, Math.min(1.0, pct));

        // System-Weiche für das Rendern
        if (this.currentSystem === 'c64') {
            // --- C64 STYLE: Klobige Segmente, original VIC-II Palette ---
            ctx.fillStyle = '#352879'; // Dark Blue Border
            ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
            ctx.fillStyle = '#000000'; // Inner Bg
            ctx.fillRect(x, y, w, h);

            let segCount = 20;
            let gap = 2;
            let segW = (w / segCount) - gap;
            let activeSegs = Math.floor(pct * segCount);

            for (let i = 0; i < activeSegs; i++) {
                // Von Hellblau zu Weiß zu Hellrot
                ctx.fillStyle = i > 15 ? '#ff8a8a' : (i > 10 ? '#ffffff' : '#6c5eb5');
                if (isFlashing) ctx.fillStyle = '#ffffff';
                ctx.fillRect(x + 1 + i * (segW + gap), y + 2, segW, h - 4);
            }

            ctx.font = '10px "Press Start 2P", monospace';
            ctx.fillStyle = isFlashing ? '#ffffff' : '#6c5eb5';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'bottom';
            ctx.fillText("LIMIT BREAK", x, y - 6);

        } else if (this.currentSystem === 'amiga') {
            // --- AMIGA STYLE: ProTracker 3D-Bevel mit Copper-Gradient ---
            ctx.fillStyle = '#ffffff'; // Top/Left Highlight
            ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
            ctx.fillStyle = '#000000'; // Bottom/Right Shadow
            ctx.fillRect(x - 1, y - 1, w + 3, h + 3);
            ctx.fillStyle = '#aaaaaa'; // Base Bevel
            ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
            ctx.fillStyle = '#000000'; // Inner Track
            ctx.fillRect(x, y, w, h);

            if (pct > 0) {
                let grad = ctx.createLinearGradient(x, y, x + w, y);
                grad.addColorStop(0.0, '#002288');
                grad.addColorStop(0.5, '#ff8800'); // Amiga Orange
                grad.addColorStop(1.0, '#ff0000');
                
                ctx.fillStyle = isFlashing ? '#ffffff' : grad;
                ctx.fillRect(x + 1, y + 1, (w - 2) * pct, h - 2);
            }

            ctx.font = '18px "VT323", monospace';
            ctx.fillStyle = isFlashing ? '#ffffff' : '#ff8800';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'bottom';
            // Kleiner 1px Drop-Shadow für den klassischen Amiga-Text-Look
            ctx.shadowColor = '#000000';
            ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 1;
            ctx.fillText("SYSTEM OVERDRIVE", x, y - 4);
            ctx.shadowColor = 'transparent';

        } else {
            // --- ATARI ST STYLE: Hartscharfer Neon-Rahmen (Delta Force Style) ---
            ctx.strokeStyle = '#55ff55';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x - 1, y - 1, w + 2, h + 2);
            ctx.fillStyle = '#000000';
            ctx.fillRect(x, y, w, h);

            if (pct > 0) {
                let grad = ctx.createLinearGradient(x, y, x + w, y);
                grad.addColorStop(0.0, '#00aa00');
                grad.addColorStop(0.6, '#ffff33');
                grad.addColorStop(1.0, '#ff3333');
                
                ctx.fillStyle = isFlashing ? '#ff3333' : grad;
                ctx.fillRect(x, y, w * pct, h);
            }

            ctx.font = '18px "VT323", monospace';
            ctx.fillStyle = isFlashing ? '#ff3333' : '#55ff55';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'bottom';
            ctx.fillText("TENSION LEVEL", x, y - 4);
        }
    }
}