// === js/visuals/dj/track-monitor.js ===
// =========================================================
// SCENE-DJ SKILL: TRACK MONITOR (HARDWARE SYNC EDITION)
// Bypasses analog envelope following by directly analyzing
// soundchip registers (Gate Bits, DMA Spikes, Envelope triggers)
// to guarantee 100% frame-accurate demoscene beat syncing.
// =========================================================

export const BEAT_LEVEL = Object.freeze({
    NONE: 0,
    SOFT: 1,
    MEDIUM: 2,
    HARD: 3
});

const MIN_BEAT_STRENGTH = 0.15;
const MEDIUM_BEAT_STRENGTH = 1.0 / 3.0;
const HARD_BEAT_STRENGTH = 2.0 / 3.0;

function clamp01(value) {
    return Math.max(0.0, Math.min(1.0, value));
}

function beatLevelForStrength(strength) {
    if (strength <= 0.0) return BEAT_LEVEL.NONE;
    if (strength >= HARD_BEAT_STRENGTH) return BEAT_LEVEL.HARD;
    if (strength >= MEDIUM_BEAT_STRENGTH) return BEAT_LEVEL.MEDIUM;
    return BEAT_LEVEL.SOFT;
}

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
        // Staerkegewichteter Impuls fuer die spaetere DSE-Auswertung. Die
        // bestehende Huelle bleibt normalisiert und damit abwaertskompatibel.
        this.beatImpulse = new Float32Array(1);
        this.channelSmooth = new Float32Array(4);
        this.rawEnergyState = 'playing';
        this.beatCooldown = 0.0;
        // Einmaliges Ereignis fuer Swap-Scheduling und Diagnose; das Envelope
        // bleibt davon unabhaengig und klingt weiterhin weich ab.
        this.beatStarted = false;
        this.beatCount = 0;
        this.beatStrength = 0.0;
        this.beatLevel = BEAT_LEVEL.NONE;
    }
}

export class TrackMonitor {
    constructor() {
        this.info = new TrackInfo();
        this.dynamics = new TrackDynamics();
        // Hardware-State-Speicher für Rising-Edge Detection
        this.lastRegs = new Uint8Array(32);
        this.hasRegisterSnapshot = false;
    }

    reset() {
        // Ein Track- oder Systemwechsel darf weder alte Registerflanken noch
        // die Energie/Beat-Huelse des vorherigen Songs in den neuen tragen.
        this.lastRegs.fill(0);
        this.hasRegisterSnapshot = false;
        this.dynamics.channelSmooth.fill(0);
        this.dynamics.masterEnergy[0] = 0.0;
        this.dynamics.transientPulse[0] = 0.0;
        this.dynamics.beatEnvelope[0] = 0.0;
        this.dynamics.beatImpulse[0] = 0.0;
        this.dynamics.beatCooldown = 0.0;
        this.dynamics.beatStarted = false;
        this.dynamics.beatCount = 0;
        this.dynamics.beatStrength = 0.0;
        this.dynamics.beatLevel = BEAT_LEVEL.NONE;
        this.dynamics.rawEnergyState = 'playing';
    }

    update(channelVolumes, dt, chipRegs) {
        this.dynamics.beatStarted = false;
        let totalEnergy = 0.0;
        let analogMaxPulse = 0.0;
        let numActiveChannels = (this.info.system === 'c64' || this.info.system === 'atari') ? 3 : 4;

        // 1. Analog Energy Tracking (Für die generelle Makro-Spannung / Tension)
        // Nur physische Kanaele einrechnen: Der vierte C64-Speicherplatz enthaelt
        // die SID-Schreibrate, keinen Audiopegel, und darf keine Phantomenergie liefern.
        for (let i = 0; i < numActiveChannels; i++) {
            let rawVol = channelVolumes[i] || 0.0;
            let smooth = this.dynamics.channelSmooth;

            let instantPulse = Math.max(0.0, rawVol - smooth[i]);
            if (instantPulse > analogMaxPulse) analogMaxPulse = instantPulse;

            if (rawVol > smooth[i]) smooth[i] += (rawVol - smooth[i]) * (dt * 20.0);
            else smooth[i] += (rawVol - smooth[i]) * (dt * 6.0);

            totalEnergy += smooth[i];
        }

        this.dynamics.masterEnergy[0] = totalEnergy / numActiveChannels;

        if (!this.info.isPlaying) {
            this.hasRegisterSnapshot = false;
            this.dynamics.transientPulse[0] = 0.0;
            this.dynamics.beatEnvelope[0] = 0.0;
            this.dynamics.beatImpulse[0] = 0.0;
            this.dynamics.beatStrength = 0.0;
            this.dynamics.beatLevel = BEAT_LEVEL.NONE;
            this.dynamics.beatCooldown = 0.0;
            this.dynamics.rawEnergyState = 'playing';
            return;
        }

        // =========================================================
        // 2. HARDWARE TRIGGER DETECTION (Demoscene Precision)
        // =========================================================
        let hardwareBeatStrength = 0.0;

        if (chipRegs) {
            // Der erste Snapshot ist eine Basislinie, kein Gate-/Volume-Event.
            // Sonst erzeugt der Wechsel vom Idle-Registerarray einen Phantom-Beat.
            if (!this.hasRegisterSnapshot) {
                for (let i = 0; i < 32; i++) this.lastRegs[i] = chipRegs[i];
                this.hasRegisterSnapshot = true;
            } else {
            if (this.info.system === 'c64') {
                // --- C64 SID: THE REAL KICK & SNARE CATCHER ---
                for (let v = 0; v < 3; v++) {
                    let ctrl = chipRegs[v * 7 + 4];
                    let lastCtrl = this.lastRegs[v * 7 + 4];
                    
                    // Frequenz (16-Bit) auslesen, um tiefe Kickdrums zu identifizieren
                    let freq = chipRegs[v * 7] | (chipRegs[v * 7 + 1] << 8);
                    
                    // Rising Edge: Gate ging von 0 auf 1!
                    if ((ctrl & 1) && !(lastCtrl & 1)) {
                        // 1. Snare/Hi-Hat: Nutzt das Noise-Bit (128). Ohne
                        // zusaetzliche Pegelinformation ist dies ein mittlerer Impuls.
                        if (ctrl & 128) {
                            hardwareBeatStrength = Math.max(hardwareBeatStrength, 0.55);
                        // 2. Synth-Kickdrum: Je tiefer die Frequenz landet,
                        // desto kraeftiger darf der Impuls ausfallen.
                        } else if (freq > 0 && freq < 4000) {
                            const bassWeight = 1.0 - freq / 4000.0;
                            hardwareBeatStrength = Math.max(hardwareBeatStrength,
                                0.35 + bassWeight * 0.45);
                        }
                    }
                    
                    // 3. Fallback für Arpeggio-Kicks (Schneller Pitch-Drop ohne erneutes Gate-On)
                    let lastFreq = this.lastRegs[v * 7] | (this.lastRegs[v * 7 + 1] << 8);
                    if ((ctrl & 1) && (lastCtrl & 1)) {
                        // Drop-Tiefe und Zielregister bestimmen gemeinsam die Staerke.
                        const drop = lastFreq - freq;
                        if (drop > 2000 && freq < 3500) {
                            const dropWeight = clamp01((drop - 2000) / 8000.0);
                            const bassWeight = 1.0 - freq / 3500.0;
                            hardwareBeatStrength = Math.max(hardwareBeatStrength,
                                0.35 + dropWeight * 0.5 + bassWeight * 0.15);
                        }
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

                    // 1. Volume-Spike: Sprunghoehe und erreichter Pegel bestimmen
                    // gemeinsam, ob der Impuls soft, medium oder hard ausfaellt.
                    if (!isEnv && vol > lastVol + 2) {
                        const jump = vol - lastVol;
                        const jumpWeight = clamp01((jump - 2) / 13.0);
                        const levelWeight = vol / 15.0;
                        hardwareBeatStrength = Math.max(hardwareBeatStrength,
                            0.25 + jumpWeight * 0.55 + levelWeight * 0.20);
                    }

                    // 2. Noise-Gate Snare/Hi-Hat Detection (NEU!)
                    // Im YM2149 ist Noise aktiv, wenn das Bit 0 ist (Active Low)
                    let noiseBit = 1 << (3 + v);
                    let noiseNowOn = (mixer & noiseBit) === 0;
                    let noiseWasOff = (lastMixer & noiseBit) !== 0;
                    
                    // Wenn Noise *jetzt* eingeschaltet wurde und Volume hörbar ist -> Harter Snare Hit!
                    if (noiseNowOn && noiseWasOff && (vol > 5 || isEnv)) {
                        const noiseStrength = isEnv ? 0.60 : 0.35 + (vol / 15.0) * 0.40;
                        hardwareBeatStrength = Math.max(hardwareBeatStrength, noiseStrength);
                    }
                }

                // 3. Hardware-Envelope getriggert (Sync-Buzzer Bässe & Kicks)
                if (chipRegs[13] !== this.lastRegs[13] && chipRegs[13] !== 255) {
                    hardwareBeatStrength = Math.max(hardwareBeatStrength, 0.45);
                }

                // 4. Digidrum Trigger via Virtual Registers (NEU!)
                // Fängt die Jochen Hippel 4-Bit-PCM Samples ab, die ansonsten zwischen 
                // den 60Hz Frame-Snapshots durchrutschen würden!
                if (chipRegs[14] !== this.lastRegs[14] && chipRegs[14] > 0) {
                    hardwareBeatStrength = Math.max(hardwareBeatStrength, 0.50);
                }
                if (chipRegs[15] !== this.lastRegs[15] && chipRegs[15] > 0) {
                    hardwareBeatStrength = Math.max(hardwareBeatStrength, 0.50);
                }

} else if (this.info.system === 'amiga') {
                // --- AMIGA PAULA: THE ULTIMATE PROTRACKER & FASTTRACKER BEAT CATCHER ---
                for (let c = 0; c < 4; c++) {
                    let offset = c * 7;
                    
                    let address = (chipRegs[offset] << 8) | chipRegs[offset + 1];
                    let lastAddress = (this.lastRegs[offset] << 8) | this.lastRegs[offset + 1];
                    
                    let period = (chipRegs[offset + 4] << 8) | chipRegs[offset + 5];
                    let vol = chipRegs[offset + 6];
                    let lastVol = this.lastRegs[offset + 6];

                    // 1. Harter Volume-Spike (Empfindlichkeit von +12 auf +8 gesenkt!)
                    // Fängt nun auch sanftere XM-Volume-Column-Befehle zuverlässig ab.
                    if (vol > lastVol + 8) {
                        const jump = vol - lastVol;
                        const jumpWeight = clamp01((jump - 8) / 56.0);
                        const levelWeight = clamp01(vol / 64.0);
                        hardwareBeatStrength = Math.max(hardwareBeatStrength,
                            0.25 + jumpWeight * 0.50 + levelWeight * 0.25);
                    }

                    // 2. Note-Trigger-Analyse (DMA-Pointer Reset)
                    if (address > 0 && lastAddress > 0 && address < lastAddress) {
                        // FastTracker II (XM) nutzt freies Panning! Drums können auf ALLEN Kanälen liegen.
                        // Die alte Einschränkung (Nur Kanal 0 & 3) ist gelöscht.
                        // Wir filtern lediglich extremes High-Pitch-Gepiepe heraus (Period < 120).
                        if (period > 120 && vol > 16) {
                            const levelWeight = clamp01(vol / 64.0);
                            const bassWeight = clamp01((600.0 - period) / 480.0);
                            hardwareBeatStrength = Math.max(hardwareBeatStrength,
                                0.30 + levelWeight * 0.45 + bassWeight * 0.15);
                        }
                    }
                }
            }
            
                // Register-Zustand für den nächsten Frame sichern
                for (let i = 0; i < 32; i++) this.lastRegs[i] = chipRegs[i];
            }
        } else {
            this.hasRegisterSnapshot = false;
        }

        // 3. Fallback: Strenger analoger Schmit-Trigger
        // KORREKTUR: Amiga-Analog-Schwelle von 0.45 auf 0.34 drastisch gesenkt! 
        // Das ist extrem wichtig für 7-Kanal XM-Tracks (wie Turrican 2). Kicks auf 
        // den unsichtbaren Kanälen 4-7 leaken nun als Pegelwelle durch den Master-Out 
        // und triggern das DSE-Netzwerk völlig problemlos von hinten herum!
        let pulseThresh = this.info.system === 'c64' ? 0.48 : (this.info.system === 'atari' ? 0.30 : 0.34);
        let isAnalogBeat = (analogMaxPulse > pulseThresh);
        const analogBeatStrength = isAnalogBeat
            ? clamp01((analogMaxPulse - pulseThresh) / Math.max(0.000001, 1.0 - pulseThresh))
            : 0.0;

        // 4. Gemeinsame Beat-Annahme fuer Hardware- und Analogtrigger.
        // Beide Quellen durchlaufen denselben Cooldown, damit ein Frame nicht
        // mehrere unterschiedlich starke DSE-Impulse ausloesen kann. Mehrere
        // Register desselben Schlags werden per Maximum statt Addition gebündelt.
        this.dynamics.beatCooldown = Math.max(0.0, this.dynamics.beatCooldown - dt);
        const beatRequested = hardwareBeatStrength > 0.0 || isAnalogBeat;
        const beatAccepted = beatRequested && this.dynamics.beatCooldown <= 0.0;

        if (beatAccepted) {
            const strength = clamp01(Math.max(
                MIN_BEAT_STRENGTH,
                hardwareBeatStrength,
                analogBeatStrength
            ));
            this.dynamics.transientPulse[0] = 1.0;
            this.dynamics.beatEnvelope[0] = 1.0;
            this.dynamics.beatStrength = strength;
            this.dynamics.beatLevel = beatLevelForStrength(strength);
            this.dynamics.beatStarted = true;
            this.dynamics.beatCount++;
            this.dynamics.beatCooldown = 0.15;
        } else {
            this.dynamics.transientPulse[0] = analogMaxPulse;
            this.dynamics.beatEnvelope[0] *= Math.exp(-dt * 15.0);
        }
        this.dynamics.beatImpulse[0] = this.dynamics.beatEnvelope[0] * this.dynamics.beatStrength;

        // 5. Macro State Logic (Tension States)
        const energy = this.dynamics.masterEnergy[0];
        let buildupThresh = 0.40, overdriveThresh = 0.58;

        if (this.info.system === 'c64') { buildupThresh = 0.35; overdriveThresh = 0.60; }
        else if (this.info.system === 'atari') { buildupThresh = 0.24; overdriveThresh = 0.48; }

        const isOverdrive = (energy > overdriveThresh && this.dynamics.transientPulse[0] > pulseThresh * 0.8);
        const isBuildup = (energy > buildupThresh);
        this.dynamics.rawEnergyState = isOverdrive ? 'climax' : (isBuildup ? 'buildup' : 'playing');
    }
}