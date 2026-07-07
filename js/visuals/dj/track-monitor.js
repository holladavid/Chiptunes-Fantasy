// === js/visuals/dj/track-monitor.js ===
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
        this.channelPeaks = new Float32Array(4);
        this.rawEnergyState = 'playing';
        this.beatCooldown = 0.0;
    }
}

export class TrackMonitor {
    constructor() {
        this.info = new TrackInfo();
        this.dynamics = new TrackDynamics();
    }

    update(channelVolumes, dt) {
        let totalEnergy = 0.0;
        let maxPulse = 0.0;
        let numActiveChannels = (this.info.system === 'c64' || this.info.system === 'atari') ? 3 : 4;

        for (let i = 0; i < 4; i++) {
            let rawVol = channelVolumes[i] || 0.0;
            let smooth = this.dynamics.channelSmooth;
            let peaks = this.dynamics.channelPeaks;

            let instantPulse = Math.max(0.0, rawVol - smooth[i]);
            if (instantPulse > maxPulse) maxPulse = instantPulse;

            if (rawVol > smooth[i]) smooth[i] += (rawVol - smooth[i]) * (dt * 20.0);
            else smooth[i] += (rawVol - smooth[i]) * (dt * 6.0);

            totalEnergy += smooth[i];
        }

        this.dynamics.masterEnergy[0] = totalEnergy / numActiveChannels;
        this.dynamics.transientPulse[0] = maxPulse;

        const energy = this.dynamics.masterEnergy[0];
        const pulse = this.dynamics.transientPulse[0];
        
        let buildupThresh = 0.40, overdriveThresh = 0.58, pulseThresh = 0.35;
        if (this.info.system === 'c64') { buildupThresh = 0.40; overdriveThresh = 0.60; pulseThresh = 0.50; } 
        else if (this.info.system === 'atari') { buildupThresh = 0.35; overdriveThresh = 0.66; pulseThresh = 0.48; }

        let isOverdrive = (energy > overdriveThresh && pulse > pulseThresh);
        let isBuildup = (energy > buildupThresh);
        this.dynamics.rawEnergyState = isOverdrive ? 'climax' : (isBuildup ? 'buildup' : 'playing');

        this.dynamics.beatCooldown -= dt;
        let beatThresh = pulseThresh * 0.65;
        if (this.info.isPlaying && pulse > beatThresh && this.dynamics.beatCooldown <= 0.0) {
            this.dynamics.beatEnvelope[0] = 1.0;
            this.dynamics.beatCooldown = 0.12;
        } else {
            this.dynamics.beatEnvelope[0] *= Math.exp(-dt * 15.0);
        }
        if (!this.info.isPlaying) this.dynamics.beatEnvelope[0] = 0.0;
    }
}