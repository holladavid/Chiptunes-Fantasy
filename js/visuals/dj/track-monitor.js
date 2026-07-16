// === js/visuals/dj/track-monitor.js ===
// =========================================================
// SCENE-DJ SKILL: TRACK MONITOR (HARDWARE SYNC EDITION)
// Bypasses analog envelope following by directly analyzing
// soundchip registers (Gate Bits, DMA Spikes, Envelope triggers)
// to guarantee 100% frame-accurate demoscene beat syncing.
// =========================================================

export class TrackInfo {
    constructor() {
        this.system = 'c64';
        this.sessionId = -1;
        this.isPlaying = false;
    }
}

export class TrackDynamics {
    constructor() {
        this.masterEnergy = new Float32Array(1);
        this.transientPulse = new Float32Array(1);
        this.beatEnvelope = new Float32Array(1);
        this.channelSmooth = new Float32Array(4);
        this.rawEnergyState = 'playing';
        this.beatCooldown = 0.0;
    }
}

export class TrackMonitor {
    constructor() {
        this.info = new TrackInfo();
        this.dynamics = new TrackDynamics();
        // Hardware-State-Speicher für Rising-Edge Detection
        this.lastRegs = new Uint8Array(32); 
    }

    update(channelVolumes, dt, chipRegs) {
        let totalEnergy = 0.0;
        let analogMaxPulse = 0.0;
        let numActiveChannels = (this.info.system === 'c64' || this.info.system === 'atari') ? 3 : 4;

        // 1. Analog Energy Tracking (Für die generelle Makro-Spannung / Tension)
        for (let i = 0; i < 4; i++) {
            let rawVol = channelVolumes[i] || 0.0;
            let smooth = this.dynamics.channelSmooth;

            let instantPulse = Math.max(0.0, rawVol - smooth[i]);
            if (instantPulse > analogMaxPulse) analogMaxPulse = instantPulse;

            if (rawVol > smooth[i]) smooth[i] += (rawVol - smooth[i]) * (dt * 20.0);
            else smooth[i] += (rawVol - smooth[i]) * (dt * 6.0);

            totalEnergy += smooth[i];
        }

        this.dynamics.masterEnergy[0] = totalEnergy / numActiveChannels;

// =========================================================
        // 2. HARDWARE TRIGGER DETECTION (Demoscene Precision)
        // =========================================================
        let isHardwareBeat = false;

        if (chipRegs && this.info.isPlaying) {
            if (this.info.system === 'c64') {
                // C64: Wir suchen nach dem ADSR "Gate Bit" (Bit 0 in Ctrl-Reg)
                for (let v = 0; v < 3; v++) {
                    let ctrl = chipRegs[v * 7 + 4];
                    let lastCtrl = this.lastRegs[v * 7 + 4];
                    
                    // Rising Edge: Gate ging von 0 auf 1!
                    if ((ctrl & 1) && !(lastCtrl & 1)) {
                        // Triggern, wenn es eine Noise-Drum (Bit 128) oder tiefe Frequenz ist
                        if (ctrl & 128) isHardwareBeat = true; 
                    }
                }
            } else if (this.info.system === 'atari') {
                // --- ATARI ST: THE ULTIMATE YM2149 RHYTHM CATCHER ---
                const mixer = chipRegs[7];
                const lastMixer = this.lastRegs[7];

                for (let v = 0; v < 3; v++) {
                    let vol = chipRegs[8 + v] & 15;
                    let lastVol = this.lastRegs[8 + v] & 15;
                    let isEnv = (chipRegs[8 + v] & 16) !== 0;

                    // 1. Harter Volume-Spike (Empfindlichkeit von +3 auf +2 gesenkt!)
                    if (!isEnv && vol > lastVol + 2) isHardwareBeat = true;

                    // 2. Noise-Gate Snare/Hi-Hat Detection (NEU!)
                    // Im YM2149 ist Noise aktiv, wenn das Bit 0 ist (Active Low)
                    let noiseBit = 1 << (3 + v);
                    let noiseNowOn = (mixer & noiseBit) === 0;
                    let noiseWasOff = (lastMixer & noiseBit) !== 0;
                    
                    // Wenn Noise *jetzt* eingeschaltet wurde und Volume hörbar ist -> Harter Snare Hit!
                    if (noiseNowOn && noiseWasOff && (vol > 5 || isEnv)) {
                        isHardwareBeat = true;
                    }
                }

                // 3. Hardware-Envelope getriggert (Sync-Buzzer Bässe & Kicks)
                if (chipRegs[13] !== this.lastRegs[13] && chipRegs[13] !== 255) {
                    isHardwareBeat = true;
                }

                // 4. Digidrum Trigger via Virtual Registers (NEU!)
                // Fängt die Jochen Hippel 4-Bit-PCM Samples ab, die ansonsten zwischen 
                // den 60Hz Frame-Snapshots durchrutschen würden!
                if (chipRegs[14] !== this.lastRegs[14] && chipRegs[14] > 0) isHardwareBeat = true;
                if (chipRegs[15] !== this.lastRegs[15] && chipRegs[15] > 0) isHardwareBeat = true;

            } else if (this.info.system === 'amiga') {
                // Amiga: Paula DMA Volume Spikes
                for (let c = 0; c < 4; c++) {
                    let vol = chipRegs[c * 7 + 6];
                    let lastVol = this.lastRegs[c * 7 + 6];
                    if (vol > lastVol + 20) isHardwareBeat = true; 
                }
            }
            
            // Register-Zustand für den nächsten Frame sichern
            for(let i=0; i<32; i++) this.lastRegs[i] = chipRegs[i];
        }

        // 3. Fallback: Strenger analoger Schmit-Trigger
        // KORREKTUR: Atari-Schwelle radikal von 0.42 auf 0.30 gesenkt für schwächere RMS-Pegel
        let pulseThresh = this.info.system === 'c64' ? 0.60 : (this.info.system === 'atari' ? 0.30 : 0.45);
        let isAnalogBeat = (analogMaxPulse > pulseThresh);

        // Signal in die Pipeline schreiben
        if (isHardwareBeat || isAnalogBeat) {
            this.dynamics.transientPulse[0] = 1.0; 
        } else {
            this.dynamics.transientPulse[0] = analogMaxPulse;
        }

        // 4. Macro State Logic (Tension States)
        const energy = this.dynamics.masterEnergy[0];
        let buildupThresh = 0.40, overdriveThresh = 0.58;
        
        if (this.info.system === 'c64') { buildupThresh = 0.40; overdriveThresh = 0.65; } 
        // KORREKTUR: Tension zündet bei YM-Tracks nun signifikant früher!
        else if (this.info.system === 'atari') { buildupThresh = 0.24; overdriveThresh = 0.48; }

        let isOverdrive = (energy > overdriveThresh && this.dynamics.transientPulse[0] > pulseThresh * 0.8);
        let isBuildup = (energy > buildupThresh);
        this.dynamics.rawEnergyState = isOverdrive ? 'climax' : (isBuildup ? 'buildup' : 'playing');
        
        // 5. Perfect Micro-Dynamics (Beat Envelope)
        this.dynamics.beatCooldown -= dt;
        
        if (this.info.isPlaying && (isHardwareBeat || (isAnalogBeat && this.dynamics.beatCooldown <= 0.0))) {
            this.dynamics.beatEnvelope[0] = 1.0; // Sofortiger Einschlag!
            this.dynamics.beatCooldown = 0.15; // Cooldown verhindert Maschinengewehr-Zittern
        } else {
            // Musikalisches Abklingen der Flanke (Exponential Decay)
            this.dynamics.beatEnvelope[0] *= Math.exp(-dt * 15.0);
        }
        
        if (!this.info.isPlaying) this.dynamics.beatEnvelope[0] = 0.0;
    }
}