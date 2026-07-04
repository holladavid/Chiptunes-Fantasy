// === js/visuals/scene-dj.js ===
// =========================================================
// DEMOSCENE-SEQUENCER (DSS) / THE "SCENE-DJ"
// Zero-Allocation Orchestrator for Dynamic Visual Choreographies
// Includes Reactive Demoscene-Style Limit Break Animations (Borderless)
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

const C64_COLS = ['#352879', '#6c5eb5', '#b5b5b5', '#ffffff', '#ff8a8a', '#ffff33'];

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

        if (!isBuildup && !isOverdrive) {
            this.isClimaxLocked = false;
            this.tension = Math.max(0.0, this.tension - (dt * 10.0)); 
            if (this.energyStateTimer > MIN_BUILDUP_TIME) targetEnergyState = 'Playing';
        } else {
            if (!this.isClimaxLocked) {
                let power = (energy * 0.5) + (pulse * 2.0); 
                if (isOverdrive) power *= 4.0; 

                this.tension += power * dt;

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

            if (this.isClimaxLocked) {
                targetEnergyState = 'Climax';
                
                if (isOverdrive) {
                    this.climaxTimer = 0.0;
                    this.tension = TENSION_MAX;
                } else {
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
        // LIMIT BREAK ANIMATION & TENSION METER (Borderless)
        // =========================================================
        const w = 240;
        const h = 18;
        const x = 20;
        const y = height - h - 20;

        let pct = this.tension / TENSION_MAX;
        
        let animIntensity = (this.currentEnergyState === 'Climax') ? 1.0 : pct;
        let isFlashing = (animIntensity >= 1.0 && (performance.now() % 150 < 75));

        pct = Math.max(0, Math.min(1.0, pct));

        if (this.currentSystem === 'c64') {
            // --- C64 STYLE: Rasterbar Animation (Background) ---
            if (animIntensity > 0.05) {
                let borderThick = Math.floor(2 + animIntensity * 6);
                let numStripes = 6;
                let stripeH = (h + borderThick * 2) / numStripes;
                for (let i = 0; i < numStripes; i++) {
                    let colIdx = Math.floor((t * (5 + animIntensity * 15) + i) % 4);
                    if (animIntensity >= 1.0 && Math.random() > 0.5) colIdx = 3 + Math.floor(Math.random() * 3); 
                    
                    ctx.fillStyle = C64_COLS[colIdx];
                    ctx.fillRect(x - borderThick, Math.floor(y - borderThick + i * stripeH), w + borderThick * 2, Math.ceil(stripeH));
                }
            }

            // Base Bar (Borderless)
            ctx.fillStyle = '#000000'; 
            ctx.fillRect(x, y, w, h);

            let segCount = 20;
            let gap = 2;
            let segW = (w / segCount) - gap;
            let activeSegs = Math.floor(pct * segCount);

            for (let i = 0; i < activeSegs; i++) {
                ctx.fillStyle = i > 15 ? '#ff8a8a' : (i > 10 ? '#ffffff' : '#6c5eb5');
                if (isFlashing) ctx.fillStyle = '#ffffff';
                ctx.fillRect(x + i * (segW + gap), y, segW, h); // Angepasst für Rahmenlosigkeit
            }

            ctx.font = '10px "Press Start 2P", monospace';
            ctx.fillStyle = isFlashing ? '#ffffff' : '#6c5eb5';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'bottom';
            ctx.fillText("LIMIT BREAK", x, y - 6);

        } else if (this.currentSystem === 'amiga') {
            // --- AMIGA STYLE: Hardware Copper Sweep & Bobs ---
            if (animIntensity > 0.05) {
                let sweepSpeed = t * (2 + animIntensity * 8);
                let sweepPos = (Math.sin(sweepSpeed) * 0.5 + 0.5) * w;
                let glowAlpha = 0.2 + animIntensity * 0.5;
                
                ctx.globalCompositeOperation = 'screen';
                ctx.fillStyle = `rgba(255, 255, 255, ${glowAlpha})`;
                ctx.fillRect(x + sweepPos - 15, y - 4, 30, h + 8);
                ctx.fillStyle = `rgba(255, 255, 255, ${glowAlpha * 1.5})`;
                ctx.fillRect(x + sweepPos - 5, y - 4, 10, h + 8);
                ctx.globalCompositeOperation = 'source-over';
                
                if (animIntensity >= 1.0) {
                    let bY = y + h/2 + Math.sin(t * 20) * 8;
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(x - 8, Math.floor(bY) - 3, 6, 6);
                    ctx.fillRect(x + w + 2, Math.floor(bY) - 3, 6, 6);
                }
            }

            // Base Bar (Borderless)
            ctx.fillStyle = '#000000'; 
            ctx.fillRect(x, y, w, h);

            if (pct > 0) {
                let grad = ctx.createLinearGradient(x, y, x + w, y);
                grad.addColorStop(0.0, '#002288');
                grad.addColorStop(0.5, '#ff8800'); 
                grad.addColorStop(1.0, '#ff0000');
                
                ctx.fillStyle = isFlashing ? '#ffffff' : grad;
                ctx.fillRect(x, y, w * pct, h); // Angepasst für Rahmenlosigkeit
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
            // --- ATARI ST STYLE: Vector Static Sparks ---
            if (animIntensity > 0.05) {
                ctx.strokeStyle = animIntensity >= 1.0 ? '#ffffff' : '#55ff55';
                ctx.lineWidth = 1.5;
                
                let numSparks = Math.floor(animIntensity * 12);
                if (animIntensity >= 1.0) numSparks = 25; 
                
                ctx.beginPath();
                for(let i=0; i < numSparks; i++) {
                    let edge = Math.floor(Math.random() * 4);
                    let sx, sy, dx, dy;
                    let offset = (Math.random() - 0.5) * (10 + animIntensity * 15);
                    let sparkLen = Math.random() * 10 * animIntensity;
                    
                    if (edge === 0) { sx = x + Math.random() * w; sy = y - 4; dx = sx + offset; dy = sy - sparkLen; } 
                    else if (edge === 1) { sx = x + Math.random() * w; sy = y + h + 4; dx = sx + offset; dy = sy + sparkLen; } 
                    else if (edge === 2) { sx = x - 4; sy = y + Math.random() * h; dx = sx - sparkLen; dy = sy + offset; } 
                    else { sx = x + w + 4; sy = y + Math.random() * h; dx = sx + sparkLen; dy = sy + offset; } 
                    
                    ctx.moveTo(sx, sy);
                    ctx.lineTo(dx, dy);
                }
                ctx.stroke();
            }

            // Base Bar (Borderless)
            ctx.fillStyle = '#000000';
            ctx.fillRect(x, y, w, h);

            if (pct > 0) {
                let segCount = 24;
                let gap = 2;
                let segW = (w / segCount) - gap;
                let activeSegs = Math.floor(pct * segCount);

                for (let i = 0; i < activeSegs; i++) {
                    let color = '#55ff55'; 
                    if (i > 18) color = '#ff3333'; 
                    else if (i > 13) color = '#ffff33'; 
                    
                    if (isFlashing) color = '#ffffff'; 
                    
                    ctx.fillStyle = color;
                    ctx.fillRect(x + i * (segW + gap), y, segW, h); // Angepasst für Rahmenlosigkeit
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