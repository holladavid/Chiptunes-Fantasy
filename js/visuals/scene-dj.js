// === js/visuals/scene-dj.js ===
// =========================================================
// DEMOSCENE-SEQUENCER (DSS) / THE "SCENE-DJ"
// Zero-Allocation Orchestrator for Dynamic Visual Choreographies
// Includes System-Themed Limit Break & Overdrive Fill-Rates
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
        
        let isOverdrive = (energy > 0.60 && pulse > 0.4);
        let isBuildup = (energy > 0.45);
        
        this.rawEnergyState = isOverdrive ? 'Overdrive' : (isBuildup ? 'Buildup' : 'Playing');
        let targetEnergyState = this.currentEnergyState;

        // --- TENSION & LOCK LOGIK ---
        if (!isBuildup && !isOverdrive) {
            // Track macht Pause -> Sofortiger Spannungsabbau
            this.isClimaxLocked = false;
            this.tension = Math.max(0.0, this.tension - (dt * 10.0)); // Fällt schnell ab
            if (this.energyStateTimer > MIN_BUILDUP_TIME) targetEnergyState = 'Playing';
        } else {
            // Wir stauen Energie auf!
            if (!this.isClimaxLocked) {
                let power = (energy * 0.5) + (pulse * 2.0); 
                
                // Multiplikator: Bei "Crazy" Fills laden wir massiv schneller auf
                if (isOverdrive) {
                    power *= 4.0; 
                }

                this.tension += power * dt;

                // Limit Break erreicht!
                if (this.tension >= TENSION_MAX) {
                    this.tension = TENSION_MAX;
                    this.isClimaxLocked = true;
                    this.climaxTimer = 0.0; 
                    this.currentClimaxHoldTime = this.activeDSEs.length > 0 
                        ? Math.max(...this.activeDSEs.map(d => d.climaxHoldTime || 10.0)) : 10.0;
                } else if (this.currentEnergyState === 'Playing' && this.energyStateTimer > MIN_BUILDUP_TIME) {
                    targetEnergyState = 'Buildup';
                }
            }

            // Wenn wir im Climax-Mode sind
            if (this.isClimaxLocked) {
                targetEnergyState = 'Climax';
                
                if (isOverdrive) {
                    // Der Track rastet komplett aus -> Halt den Balken oben, pausiere den Timer!
                    this.climaxTimer = 0.0;
                    this.tension = TENSION_MAX;
                } else {
                    // Track ist wieder "normal" -> Timer läuft rückwärts ab
                    this.climaxTimer += dt;
                    this.tension = TENSION_MAX * Math.max(0.0, 1.0 - (this.climaxTimer / this.currentClimaxHoldTime));

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

        if (this.currentEnergyState === 'Climax') {
            if (this.rawEnergyState === 'Overdrive') {
                isFlashing = (performance.now() % 150 < 75); 
            } else if (this.isClimaxLocked) {
                isFlashing = (pct > 0.85) && (performance.now() % 300 < 150); 
            }
        }
        pct = Math.max(0, Math.min(1.0, pct));

        if (this.currentSystem === 'c64') {
            // --- C64 STYLE: Klobige Segmente, original VIC-II Palette ---
            ctx.fillStyle = '#352879'; 
            ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
            ctx.fillStyle = '#000000'; 
            ctx.fillRect(x, y, w, h);

            let segCount = 20;
            let gap = 2;
            let segW = (w / segCount) - gap;
            let activeSegs = Math.floor(pct * segCount);

            for (let i = 0; i < activeSegs; i++) {
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
            ctx.fillStyle = '#ffffff'; 
            ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
            ctx.fillStyle = '#000000'; 
            ctx.fillRect(x - 1, y - 1, w + 3, h + 3);
            ctx.fillStyle = '#aaaaaa'; 
            ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
            ctx.fillStyle = '#000000'; 
            ctx.fillRect(x, y, w, h);

            if (pct > 0) {
                let grad = ctx.createLinearGradient(x, y, x + w, y);
                grad.addColorStop(0.0, '#002288');
                grad.addColorStop(0.5, '#ff8800'); 
                grad.addColorStop(1.0, '#ff0000');
                
                ctx.fillStyle = isFlashing ? '#ffffff' : grad;
                ctx.fillRect(x + 1, y + 1, (w - 2) * pct, h - 2);
            }

            ctx.font = '18px "VT323", monospace';
            ctx.fillStyle = isFlashing ? '#ffffff' : '#ff8800';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'bottom';
            ctx.shadowColor = '#000000';
            ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 1;
            ctx.fillText("SYSTEM OVERDRIVE", x, y - 4);
            ctx.shadowColor = 'transparent';

        } else {
            // --- ATARI ST STYLE: Hardware-getreuer, klobiger 16-Color VU-Meter ---
            ctx.strokeStyle = '#55ff55';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x - 1, y - 1, w + 2, h + 2);
            ctx.fillStyle = '#000000';
            ctx.fillRect(x, y, w, h);

            if (pct > 0) {
                let segCount = 24;
                let gap = 2;
                let segW = (w / segCount) - gap;
                let activeSegs = Math.floor(pct * segCount);

                for (let i = 0; i < activeSegs; i++) {
                    // Strenge Atari-16-Farben-Auswahl ohne weiche Übergänge
                    let color = '#55ff55'; // ST Grün
                    if (i > 18) color = '#ff3333'; // ST Rot
                    else if (i > 13) color = '#ffff33'; // ST Gelb
                    
                    if (isFlashing) color = '#ffffff'; 
                    
                    ctx.fillStyle = color;
                    ctx.fillRect(x + 1 + i * (segW + gap), y + 2, segW, h - 4);
                }
            }

            ctx.font = '18px "VT323", monospace';
            ctx.fillStyle = isFlashing ? '#ff3333' : '#55ff55';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'bottom';
            ctx.fillText("TENSION LEVEL", x, y - 4);
        }
    }
}