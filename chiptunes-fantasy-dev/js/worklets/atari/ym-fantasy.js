// =========================================================
// YM2149F "CHIPTUNES FANTASY" CORE (The Ultimate Mastering)
// =========================================================

const YM_DAC = [
    0.0000, 0.0137, 0.0205, 0.0291, 0.0423, 0.0618, 0.0847, 0.1369, 
    0.1691, 0.2647, 0.3527, 0.4499, 0.5704, 0.6873, 0.8482, 1.0000
];

function polyBLEP(t, dt) {
    if (t < dt) { t /= dt; return t + t - t * t - 1.0; }
    else if (t > 1.0 - dt) { t = (t - 1.0 + dt) / dt; return 1.0 - (t + t - t * t); }
    return 0.0;
}

function cubicInterpolate(y0, y1, y2, y3, mu) {
    let mu2 = mu * mu;
    let a0 = -0.5 * y0 + 1.5 * y1 - 1.5 * y2 + 0.5 * y3;
    let a1 = y0 - 2.5 * y1 + 2.0 * y2 - 0.5 * y3;
    let a2 = -0.5 * y0 + 0.5 * y2;
    return (a0 * mu * mu2 + a1 * mu2 + a2 * mu + y1);
}

class YMFantasyProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.clock = 2000000; 
        this.regs = new Uint8Array(16); 
        this.phaseA = 0; this.phaseB1 = 0; this.phaseB2 = 0; this.phaseC = 0;
        this.lfoPhase1 = 0.0; this.lfoPhase2 = 0.0; 
        this.noiseLfsr = 1; this.noisePhase = 0; this.noiseOutput = 1;
        this.envPhase = 0.0;
        
        this.f1Low = [0,0,0]; this.f1Band = [0,0,0]; 
        this.f2Low = [0,0,0]; this.f2Band = [0,0,0]; 
        
        this.nLow1 = 0; this.nBand1 = 0; this.nLow2 = 0; this.nBand2 = 0; 
        this.nHpLow = 0; this.nHpBand = 0; 
        
        this.delayBufL = new Float32Array(131072); 
        this.delayBufR = new Float32Array(131072);
        this.delayMask = 131071;
        this.delayIdx = 0;
        this.delayTime = 0; 
        this.delayLpL = 0; this.delayLpR = 0; 
        this.delayHpL = 0; this.delayHpR = 0;
        
        this.smoothVolA = 0; this.smoothVolB = 0; this.smoothVolC = 0;
        this.sidechainEnv = 1.0; 
        this.lastOutL = 0; this.lastInL = 0; 
        this.lastOutR = 0; this.lastInR = 0; 

        this.digidrums = [];
        this.currentDigidrum = null;
        this.digiPos = 0;
        this.lastDigiTrigger = 0;
        
        this.trackData = null;
        this.roles = { A: 'LEAD', B: 'PAD', C: 'BASS' }; // Default
        
        this.currentFrame = 0;
        this.sampleCounter = 0;
        this.isPlaying = false;
        
        this.port.onmessage = (event) => {
            if (event.data.type === 'PLAY_TRACK') {
                this.trackData = event.data.track;
                this.digidrums = event.data.digidrums || []; 
                this.roles = event.data.roles || this.roles; // Empfange die Smart-Roles!
                
                this.currentFrame = 0;
                this.sampleCounter = 0;
                this.currentDigidrum = null;
                this.lastDigiTrigger = 0;
                this.envPhase = 0;
                this.isPlaying = true;
            } else if (event.data.type === 'STOP_TRACK') {
                this.isPlaying = false;
            } else if (event.data.type === 'RESUME_TRACK') {
                this.isPlaying = true; 
            }
        };
    }

    apply4PoleFilter(input, ch, cutoffHz, resonance) {
        if (cutoffHz > 18000) cutoffHz = 18000; 
        let q = 1.0 - (resonance * 0.8); 
        let f = 2.0 * Math.sin(Math.PI * cutoffHz / sampleRate);
        if (f > 1.9 - q) f = 1.9 - q; 
        
        this.f1Low[ch] += f * this.f1Band[ch];
        let high1 = input - this.f1Low[ch] - q * this.f1Band[ch];
        this.f1Band[ch] += f * high1;
        
        this.f2Low[ch] += f * this.f2Band[ch];
        let high2 = this.f1Low[ch] - this.f2Low[ch] - q * this.f2Band[ch];
        this.f2Band[ch] += f * high2;

        if (isNaN(this.f2Low[ch])) { this.f1Low[ch]=0; this.f1Band[ch]=0; this.f2Low[ch]=0; this.f2Band[ch]=0; }
        return this.f2Low[ch]; 
    }

    // Baut den Oscillator basierend auf seiner "Rolle" im Song!
    renderOscillator(phase, role, inc) {
        let sq = (phase < 0.5 ? 1.0 : -1.0) + polyBLEP(phase, inc) - polyBLEP((phase + 0.5) % 1.0, inc);
        if (role === 'BASS') {
            let sub = Math.sin(phase * Math.PI); // Fetter Analog-Sub
            return sq * 0.5 + sub * 0.5;
        } else if (role === 'LEAD') {
            let saw = (phase * 2.0 - 1.0) - polyBLEP(phase, inc); // Scharfer Sägezahn für die Melodie
            return sq * 0.6 + saw * 0.4;
        } else { // PAD / ARP
            return sq; // Reines PolyBLEP Square (sitzt gut im Mix)
        }
    }

    process(inputs, outputs) {
        const outL = outputs[0][0];  
        const outR = outputs[0][1] || outputs[0][0]; 
        let currentVisualValue = 0;

        if (this.delayTime === 0) this.delayTime = Math.floor(sampleRate * 0.375);

        for (let i = 0; i < outL.length; i++) {
            if (!this.isPlaying) { outL[i] = 0; if (outR) outR[i] = 0; continue; }

            if (this.isPlaying && this.trackData) {
                this.sampleCounter--;
                if (this.sampleCounter <= 0) {
                    this.sampleCounter += sampleRate / 50.0; 
                    let frame = this.trackData[this.currentFrame];
                    for(let r=0; r<16; r++) {
                        if (r === 13) { if (frame[13] !== 0xFF) { this.regs[13] = frame[13]; this.envPhase = 0.0; } } 
                        else this.regs[r] = frame[r];
                    }
                    
                    let activeDigiTrigger = 0;
                    if (frame[15] > 0) activeDigiTrigger = frame[15];
                    else if (frame[14] > 0) activeDigiTrigger = frame[14];
                    let fx1Voice = (frame[1] & 0x30) >> 4;
                    if (fx1Voice > 0) activeDigiTrigger = (frame[8 + fx1Voice - 1] & 0x1F) + 1;
                    let fx2Voice = (frame[3] & 0x30) >> 4;
                    if (fx2Voice > 0) activeDigiTrigger = (frame[8 + fx2Voice - 1] & 0x1F) + 1;
                    if (activeDigiTrigger === 0) {
                        let fx1Type = (frame[1] & 0xC0) >> 6;
                        if (fx1Type === 0 && fx1Voice > 0) activeDigiTrigger = (frame[8 + fx1Voice - 1] & 0x1F) + 1;
                        let fx2Type = (frame[3] & 0xC0) >> 6;
                        if (fx2Type === 0 && fx2Voice > 0) activeDigiTrigger = (frame[8 + fx2Voice - 1] & 0x1F) + 1;
                    }

                    if (activeDigiTrigger > 0 && activeDigiTrigger !== this.lastDigiTrigger) {
                        if (this.digidrums[activeDigiTrigger - 1]) {
                            this.currentDigidrum = this.digidrums[activeDigiTrigger - 1];
                            this.digiPos = 0;
                            this.sidechainEnv = 0.35; // Kick Ducking
                            this.port.postMessage({ type: 'DEBUG', msg: 'Drum ' + activeDigiTrigger });
                        }
                    }
                    this.lastDigiTrigger = activeDigiTrigger;
                    this.currentFrame = (this.currentFrame + 1) % this.trackData.length;
                }
            }

            this.sidechainEnv += (1.0 - this.sidechainEnv) * 0.002;

            let pA = ((this.regs[1] & 0x0F) << 8) | this.regs[0];
            let pB = ((this.regs[3] & 0x0F) << 8) | this.regs[2];
            let pC = ((this.regs[5] & 0x0F) << 8) | this.regs[4];
            
            let incA = (2000000 / (16 * (pA === 0 ? 1 : pA))) / sampleRate;
            let incB = (2000000 / (16 * (pB === 0 ? 1 : pB))) / sampleRate;
            let incC = (2000000 / (16 * (pC === 0 ? 1 : pC))) / sampleRate;

            this.phaseA = (this.phaseA + incA) % 1.0;
            this.phaseB1 = (this.phaseB1 + incB) % 1.0;
            this.phaseC = (this.phaseC + incC) % 1.0;
            
            const mix = this.regs[7];
            let tA = (mix & 0x01) === 0; let tB = (mix & 0x02) === 0; let tC = (mix & 0x04) === 0;
            let nA = (mix & 0x08) === 0; let nB = (mix & 0x10) === 0; let nC = (mix & 0x20) === 0;

            // --- OSCILLATORS (Mit Rollen-Zuweisung!) ---
            let sigA = tA ? this.renderOscillator(this.phaseA, this.roles.A, incA) : 0.0;
            let sigB = tB ? this.renderOscillator(this.phaseB1, this.roles.B, incB) : 0.0;
            let sigC = tC ? this.renderOscillator(this.phaseC, this.roles.C, incC) : 0.0;

            // --- DUAL-BAND INTELLIGENT NOISE ---
            let pN = this.regs[6] & 0x1F;
            let noiseVal = 0;
            let subNoiseVal = 0;

            if (nA || nB || nC) {
                let rawNoise = (Math.random() * 2.0 - 1.0);
                if (pN > 12) {
                    // TIEFER BASS (Explosionen)
                    let cutoffN = 150 + (31 - pN) * 20; 
                    let fN = 2.0 * Math.sin(Math.PI * cutoffN / sampleRate);
                    this.nLow1 += fN * this.nBand1; let h1 = rawNoise - this.nLow1 - 0.2 * this.nBand1; this.nBand1 += fN * h1;
                    this.nLow2 += fN * this.nBand2; let h2 = this.nLow1 - this.nLow2 - 0.2 * this.nBand2; this.nBand2 += fN * h2;
                    subNoiseVal = this.nLow2 * 2.0; 
                } else {
                    // HOHE HATS (Zischen)
                    let cutoffHp = 4000 + (12 - pN) * 500;
                    let fHp = 2.0 * Math.sin(Math.PI * cutoffHp / sampleRate);
                    this.nHpLow += fHp * this.nHpBand;
                    let hpHigh = rawNoise - this.nHpLow - 0.5 * this.nHpBand;
                    this.nHpBand += fHp * hpHigh;
                    noiseVal = hpHigh * 0.6;
                }
            }

            if (nA) { sigA += noiseVal + subNoiseVal; }
            if (nB) { sigB += noiseVal + subNoiseVal; }
            if (nC) { sigC += noiseVal + subNoiseVal; }

            // --- ENVELOPES & FILTERS ---
            this.envPhase += (2000000 / (256 * (((this.regs[12] << 8) | this.regs[11]) === 0 ? 1 : ((this.regs[12] << 8) | this.regs[11])))) / sampleRate;
            let shape = this.regs[13] & 0x0F;
            let cycles = Math.floor(this.envPhase);
            let localPhase = this.envPhase - cycles;
            let envVolRaw = 0;

            let attack = (shape & 4) !== 0; let cont = (shape & 8) !== 0;
            let alt = (shape & 2) !== 0; let hold = (shape & 1) !== 0;
            if (!cont) { hold = true; alt = false; } else { hold = (shape & 1) !== 0; alt = (shape & 2) !== 0; }
            if (cycles > 0 && hold) { envVolRaw = (alt ? (attack ? 0.0 : 1.0) : (attack ? 1.0 : 0.0)); } 
            else { let flip = (cycles % 2 === 1) && alt; let up = attack ? !flip : flip; envVolRaw = up ? localPhase : (1.0 - localPhase); }
            
            let envVolIndex = Math.floor(envVolRaw * 15.99);

            let volA_raw = (this.regs[8] & 0x10) ? envVolIndex : (this.regs[8] & 0x0F);
            let volB_raw = (this.regs[9] & 0x10) ? envVolIndex : (this.regs[9] & 0x0F);
            let volC_raw = (this.regs[10] & 0x10) ? envVolIndex : (this.regs[10] & 0x0F);

            // Slew Limiters
            let slewSpeedA = (this.regs[8] & 0x10) ? 1.0 : (volA_raw > this.smoothVolA ? 0.002 : 0.0003);
            let slewSpeedB = (this.regs[9] & 0x10) ? 1.0 : (volB_raw > this.smoothVolB ? 0.002 : 0.0003);
            let slewSpeedC = (this.regs[10] & 0x10) ? 1.0 : (volC_raw > this.smoothVolC ? 0.002 : 0.0003);
            this.smoothVolA += (volA_raw - this.smoothVolA) * slewSpeedA;
            this.smoothVolB += (volB_raw - this.smoothVolB) * slewSpeedB;
            this.smoothVolC += (volC_raw - this.smoothVolC) * slewSpeedC;

            let sweepA = Math.pow(this.smoothVolA / 15.0, 1.5);
            let sweepB = Math.pow(this.smoothVolB / 15.0, 1.5);
            let sweepC = Math.pow(this.smoothVolC / 15.0, 1.5);

            // Filter Cutoff abhängig von der Rolle (Bass ist dumpfer, Lead knallt hoch!)
            let cutA = this.roles.A === 'BASS' ? 6000 : (this.roles.A === 'LEAD' ? 16000 : 10000);
            let cutB = this.roles.B === 'BASS' ? 6000 : (this.roles.B === 'LEAD' ? 16000 : 10000);
            let cutC = this.roles.C === 'BASS' ? 6000 : (this.roles.C === 'LEAD' ? 16000 : 10000);

            sigA = this.apply4PoleFilter(sigA, 0, 150 + sweepA * cutA, 0.4); 
            sigB = this.apply4PoleFilter(sigB, 1, 150 + sweepB * cutB, 0.4); 
            sigC = this.apply4PoleFilter(sigC, 2, 150 + sweepC * cutC, 0.4); 

            let volA = YM_DAC[Math.round(this.smoothVolA)];
            let volB = YM_DAC[Math.round(this.smoothVolB)];
            let volC = YM_DAC[Math.round(this.smoothVolC)];

            // --- CUBIC INTERPOLATION PCM ---
            let digiSample = 0;
            if (this.currentDigidrum) {
                let posInt = Math.floor(this.digiPos);
                let mu = this.digiPos - posInt;
                let y0 = this.currentDigidrum[posInt - 1] || 0;
                let y1 = this.currentDigidrum[posInt];
                let y2 = this.currentDigidrum[posInt + 1] || 0;
                let y3 = this.currentDigidrum[posInt + 2] || 0;
                
                digiSample = cubicInterpolate(y0, y1, y2, y3, mu) * 1.2; 
                this.digiPos += 7812.5 / sampleRate; 
                if (this.digiPos >= this.currentDigidrum.length - 2) this.currentDigidrum = null; 
            }

            // =========================================================
            // DYNAMIC STAGING PANNING
            // =========================================================
            let synthA = sigA * volA * this.sidechainEnv;
            let synthB = sigB * volB * this.sidechainEnv;
            let synthC = sigC * volC * this.sidechainEnv;
            
            // Pan-Werte nach Rolle: BASS = Mitte, LEAD = Breit, PAD = Extrem Breit
            let panA_L = this.roles.A === 'BASS' ? 0.707 : (this.roles.A === 'LEAD' ? 0.8 : 0.3);
            let panA_R = this.roles.A === 'BASS' ? 0.707 : (this.roles.A === 'LEAD' ? 0.6 : 0.9);
            
            let panB_L = this.roles.B === 'BASS' ? 0.707 : (this.roles.B === 'LEAD' ? 0.8 : 0.3);
            let panB_R = this.roles.B === 'BASS' ? 0.707 : (this.roles.B === 'LEAD' ? 0.6 : 0.9);
            
            let panC_L = this.roles.C === 'BASS' ? 0.707 : (this.roles.C === 'LEAD' ? 0.8 : 0.3);
            let panC_R = this.roles.C === 'BASS' ? 0.707 : (this.roles.C === 'LEAD' ? 0.6 : 0.9);

            let mixL = (synthA * panA_L) + (synthB * panB_L) + (synthC * panC_L) + (digiSample * 0.5);
            let mixR = (synthA * panA_R) + (synthB * panB_R) + (synthC * panC_R) + (digiSample * 0.5);

            // Reverb / Tape Delay
            let readIdxL = (this.delayIdx - this.delayTime + 131072) & this.delayMask;
            let readIdxR = (this.delayIdx - this.delayTime + 131072 + Math.floor(this.delayTime/2)) & this.delayMask;
            
            this.delayLpL += 0.3 * (this.delayBufL[readIdxL] - this.delayLpL); 
            this.delayLpR += 0.3 * (this.delayBufR[readIdxR] - this.delayLpR); 
            this.delayHpL += 0.05 * (this.delayLpL - this.delayHpL);
            this.delayHpR += 0.05 * (this.delayLpR - this.delayHpR);

            let tapeEchoL = this.delayLpL - this.delayHpL; 
            let tapeEchoR = this.delayLpR - this.delayHpR;

            let finalL = mixL + tapeEchoL * 0.3;
            let finalR = mixR + tapeEchoR * 0.3;

            this.delayBufL[this.delayIdx] = mixR * 0.3 + tapeEchoL * 0.15;
            this.delayBufR[this.delayIdx] = mixL * 0.3 + tapeEchoR * 0.15;
            this.delayIdx = (this.delayIdx + 1) & this.delayMask;

            finalL = (Math.tanh(finalL * 1.5) / 1.1) * 0.9;
            finalR = (Math.tanh(finalR * 1.5) / 1.1) * 0.9;

            let dcBlockL = finalL - this.lastInL + 0.995 * this.lastOutL;
            this.lastInL = finalL; this.lastOutL = dcBlockL;
            let dcBlockR = finalR - this.lastInR + 0.995 * this.lastOutR;
            this.lastInR = finalR; this.lastOutR = dcBlockR;

            outL[i] = dcBlockL;
            if (outR) outR[i] = dcBlockR;
            if (i === 0) currentVisualValue = (dcBlockL + dcBlockR) / 2.0;
        }

        this.visCounter = (this.visCounter || 0) + 1;
        if (this.visCounter % 4 === 0) {
            let isAudible = Math.abs(currentVisualValue) > 0.001;
            if (isAudible || this.wasAudible) {
                this.port.postMessage({ type: 'VISUAL_DATA', value: currentVisualValue, frame: this.currentFrame, regs: this.regs });
            }
            this.wasAudible = isAudible;
        }
        return true; 
    }
}
registerProcessor('ym-fantasy-processor', YMFantasyProcessor);