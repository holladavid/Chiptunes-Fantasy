// =========================================================
// YM2149F "BLADE RUNNER" CORE (Cinematic Analog Edition)
// Soft-Interpolated Dynamic Staging & Safe Buffer Sizing
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

class YMBladeRunnerProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.clock = 2000000; 
        this.regs = new Uint8Array(16); 
        this.phaseA = 0; this.phaseB1 = 0; this.phaseB2 = 0; this.phaseC = 0;
        
        this.lfoPhase1 = 0.0; this.lfoPhase2 = 0.0; this.lfoPhase3 = 0.0; 
        this.noiseLfsr = 1; this.noisePhase = 0; this.noiseOutput = 1;
        this.envPhase = 0.0;
        
        this.fLow = new Float32Array(7); 
        this.fBand = new Float32Array(7); 
        this.nLow1 = 0; this.nBand1 = 0; this.nLow2 = 0; this.nBand2 = 0; 
        this.nHpLow = 0; this.nHpBand = 0; 
        
        // CRASH-FIX: Der Puffer muss 262144 groß sein (und die Maske 262143),
        // damit hohe SampleRates (z.B. 96kHz auf iOS) nicht auf negative/undefined Indizes stoßen!
        this.delayBufL = new Float32Array(262144); 
        this.delayBufR = new Float32Array(262144);
        this.delayMask = 262143; 
        this.delayIdx = 0;
        this.delayTime = 0; 
        this.delayLpL = 0; this.delayLpR = 0; 
        
        this.smoothVoltA = 0; this.smoothVoltB = 0; this.smoothVoltC = 0;
        this.lastOutL = 0; this.lastInL = 0; 
        this.lastOutR = 0; this.lastInR = 0; 

        this.digidrums = [];
        this.currentDigidrum = null;
        this.digiPos = 0;
        this.lastDigiTrigger = 0;
        
        this.trackData = null;
        this.currentFrame = 0;
        this.sampleCounter = 0;
        this.isPlaying = false;
        
        this.stage = {
            A: { pan: 0.5, sub: 0.0, rev: 0.2 },
            B: { pan: 0.5, sub: 0.0, rev: 0.2 },
            C: { pan: 0.5, sub: 0.0, rev: 0.2 }
        };
        
        this.port.onmessage = (event) => {
            if (event.data.type === 'PLAY_TRACK') {
                this.trackData = event.data.track;
                this.digidrums = event.data.digidrums || []; 
                this.currentFrame = 0;
                this.sampleCounter = 0;
                this.currentDigidrum = null;
                this.lastDigiTrigger = 0;
                this.isPlaying = true;
            } else if (event.data.type === 'STOP_TRACK') {
                this.isPlaying = false;
            } else if (event.data.type === 'RESUME_TRACK') {
                this.isPlaying = true; 
            }
        };
    }

    applyMoogFilter(input, ch, cutoffHz, resonance) {
        if (cutoffHz < 20) cutoffHz = 20;
        if (cutoffHz > 16000) cutoffHz = 16000; 
        let q = 1.0 - resonance;
        let f = 2.0 * Math.sin(Math.PI * cutoffHz / sampleRate);
        if (f > 1.9 - q) f = 1.9 - q; 
        
        this.fLow[ch] += f * this.fBand[ch];
        let high = input - this.fLow[ch] - q * this.fBand[ch];
        this.fBand[ch] += f * high;
        if (isNaN(this.fLow[ch])) { this.fLow[ch] = 0; this.fBand[ch] = 0; }
        return this.fLow[ch]; 
    }

    // DIE NEUE INTELLIGENZ: Berechnet stufenlos den Bass-Faktor (0.0 bis 1.0)
    getBassFactor(period) {
        if (period === 0) period = 1;
        let hz = 125000 / period; // Exakte Frequenz des Atari
        if (hz <= 80) return 1.0; // Tiefer als 80Hz -> Voller Sub-Bass
        if (hz >= 156) return 0.0; // Höher als 156Hz -> Volle Melodie
        // Dazwischen: Linearer Fade von 1.0 runter auf 0.0
        return 1.0 - ((hz - 80) / 76.0); 
    }

    process(inputs, outputs) {
        const outL = outputs[0][0];  
        const outR = outputs[0][1] || outputs[0][0]; 
        let currentVisualValue = 0;

        if (this.delayTime === 0) this.delayTime = Math.floor(sampleRate * 0.375);
        const tap1 = Math.floor(sampleRate * 0.43);
        const tap2 = Math.floor(sampleRate * 0.71);
        const tap3 = Math.floor(sampleRate * 1.13);

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
                            this.port.postMessage({ type: 'DEBUG', msg: 'Drum ' + activeDigiTrigger });
                        }
                    }
                    this.lastDigiTrigger = activeDigiTrigger;
                    this.currentFrame = (this.currentFrame + 1) % this.trackData.length;
                }
            }

            let pA = ((this.regs[1] & 0x0F) << 8) | this.regs[0];
            let pB = ((this.regs[3] & 0x0F) << 8) | this.regs[2];
            let pC = ((this.regs[5] & 0x0F) << 8) | this.regs[4];
            
            let incA = (2000000 / (16 * (pA === 0 ? 1 : pA))) / sampleRate;
            let incB = (2000000 / (16 * (pB === 0 ? 1 : pB))) / sampleRate;
            let incC = (2000000 / (16 * (pC === 0 ? 1 : pC))) / sampleRate;

            this.lfoPhase1 = (this.lfoPhase1 + 5.5 / sampleRate) % 1.0; 
            this.lfoPhase2 = (this.lfoPhase2 + 0.15 / sampleRate) % 1.0; 
            this.lfoPhase3 = (this.lfoPhase3 + 1.2 / sampleRate) % 1.0;  
            
            let wow = Math.sin(this.lfoPhase2 * 2.0 * Math.PI) * 0.005; 
            let flutter = Math.sin(this.lfoPhase3 * 2.0 * Math.PI) * 0.0015; 
            
            let vibA = Math.sin(this.lfoPhase1 * 2.0 * Math.PI) * (0.0005 + this.smoothVoltA * 0.004);
            let vibB = Math.sin(this.lfoPhase1 * 2.0 * Math.PI) * (0.0005 + this.smoothVoltB * 0.004);
            let vibC = Math.sin(this.lfoPhase1 * 2.0 * Math.PI) * (0.0005 + this.smoothVoltC * 0.004);

            let driftA = 1.0 + wow + flutter + vibA;
            let driftB = 1.0 + wow + flutter + vibB;
            let driftC = 1.0 + wow + flutter + vibC;
            
            this.phaseA = (this.phaseA + incA * driftA) % 1.0;
            this.phaseB1 = (this.phaseB1 + incB * driftB) % 1.0;
            this.phaseB2 = (this.phaseB2 + incB * (driftB + 0.003)) % 1.0; 
            this.phaseC = (this.phaseC + incC * driftC) % 1.0;

            const mix = this.regs[7];
            let tA = (mix & 0x01) === 0; let tB = (mix & 0x02) === 0; let tC = (mix & 0x04) === 0;
            let nA = (mix & 0x08) === 0; let nB = (mix & 0x10) === 0; let nC = (mix & 0x20) === 0;

            // =========================================================
            // DYNAMIC STAGING 2.0: Soft Interpolation!
            // =========================================================
            let bFactorA = this.getBassFactor(pA);
            let bFactorB = this.getBassFactor(pB);
            let bFactorC = this.getBassFactor(pC);

            // Tonal Parameters (Fades smoothly between Bass and Melody profiles)
            let tPanA = 0.2 + (0.3 * bFactorA); // Fades von 0.2 (Lead) auf 0.5 (Mitte)
            let tSubA = bFactorA;               // Fades von 0.0 (Lead) auf 1.0 (Bass)
            let tRevA = 0.3 - (0.3 * bFactorA); // Fades von 0.3 (Lead) auf 0.0 (Bass)

            let tPanB = 0.8 - (0.3 * bFactorB); // Fades von 0.8 (Pad) auf 0.5 (Mitte)
            let tSubB = bFactorB;
            let tRevB = 0.6 - (0.6 * bFactorB); 

            let tPanC = 0.5;                    // Kanal C bleibt mittig gepannt, verändert aber Sub/Rev
            let tSubC = bFactorC;
            let tRevC = 0.3 - (0.3 * bFactorC);

            // Percussion Override (Knallt alles sofort in die Mitte!)
            if (nA) { tPanA = 0.5; tSubA = 0.0; tRevA = 0.1; }
            if (nB) { tPanB = 0.5; tSubB = 0.0; tRevB = 0.1; }
            if (nC) { tPanC = 0.5; tSubC = 0.0; tRevC = 0.1; }

            // Slew Limiting
            let stageSpeed = 0.002; 
            this.stage.A.pan += (tPanA - this.stage.A.pan) * stageSpeed; this.stage.A.sub += (tSubA - this.stage.A.sub) * stageSpeed; this.stage.A.rev += (tRevA - this.stage.A.rev) * stageSpeed;
            this.stage.B.pan += (tPanB - this.stage.B.pan) * stageSpeed; this.stage.B.sub += (tSubB - this.stage.B.sub) * stageSpeed; this.stage.B.rev += (tRevB - this.stage.B.rev) * stageSpeed;
            this.stage.C.pan += (tPanC - this.stage.C.pan) * stageSpeed; this.stage.C.sub += (tSubC - this.stage.C.sub) * stageSpeed; this.stage.C.rev += (tRevC - this.stage.C.rev) * stageSpeed;

            // --- OSCILLATORS ---
            let pwmWidth = Math.sin(this.lfoPhase1 * 2.0 * Math.PI) * 0.2 + 0.5;
            
            let sqA = (this.phaseA < pwmWidth ? 1.0 : -1.0) + polyBLEP(this.phaseA, incA) - polyBLEP((this.phaseA + pwmWidth) % 1.0, incA);
            let sawA_L = ((this.phaseA * 2.0) - 1.0) - polyBLEP(this.phaseA, incA);
            let sFundA = Math.sin(this.phaseA * 2.0 * Math.PI);
            let sigA_L = tA ? ((sqA * 0.4 + sawA_L * 0.6) * (1.0 - this.stage.A.sub*0.3) + sFundA * (0.3 + this.stage.A.sub * 0.9)) : 0.0;
            let sigA_R = sigA_L;

            let sqB = (this.phaseB1 < pwmWidth ? 1.0 : -1.0) + polyBLEP(this.phaseB1, incB) - polyBLEP((this.phaseB1 + pwmWidth) % 1.0, incB);
            let sawB_L = ((this.phaseB1 * 2.0) - 1.0) - polyBLEP(this.phaseB1, incB);
            let sawB_R = ((this.phaseB2 * 2.0) - 1.0) - polyBLEP(this.phaseB2, incB * 1.003);
            let sFundB = Math.sin(this.phaseB1 * 2.0 * Math.PI);
            let sigB_L = tB ? ((sqB * 0.4 + sawB_L * 0.6) * (1.0 - this.stage.B.sub*0.3) + sFundB * (0.3 + this.stage.B.sub * 0.9)) : 0.0;
            let sigB_R = tB ? ((sqB * 0.4 + sawB_R * 0.6) * (1.0 - this.stage.B.sub*0.3) + sFundB * (0.3 + this.stage.B.sub * 0.9)) : 0.0;

            let sqC = (this.phaseC < pwmWidth ? 1.0 : -1.0) + polyBLEP(this.phaseC, incC) - polyBLEP((this.phaseC + pwmWidth) % 1.0, incC);
            let sawC_L = ((this.phaseC * 2.0) - 1.0) - polyBLEP(this.phaseC, incC);
            let sFundC = Math.sin(this.phaseC * 2.0 * Math.PI);
            let sigC_L = tC ? ((sqC * 0.4 + sawC_L * 0.6) * (1.0 - this.stage.C.sub*0.3) + sFundC * (0.3 + this.stage.C.sub * 0.9)) : 0.0;
            let sigC_R = sigC_L;

            // --- CINEMATIC NOISE ---
            this.noisePhase += this.incNoise;
            if (this.noisePhase >= 1.0) {
                this.noisePhase %= 1.0;
                this.noiseLfsr ^= (((this.noiseLfsr & 1) ^ ((this.noiseLfsr >> 3) & 1)) << 17);
                this.noiseLfsr >>= 1;
                this.noiseOutput = (this.noiseLfsr & 1) ? 1.0 : -1.0;
            }

            let pN = this.regs[6] & 0x1F;
            let noiseCutoff = 300 + (31 - pN) * 200; 
            let filteredNoise = this.applyMoogFilter(this.noiseOutput, 6, noiseCutoff, 0.1) * 0.45;

            if (this.noiseA) { sigA_L += filteredNoise; sigA_R += filteredNoise; }
            if (this.noiseB) { sigB_L += filteredNoise; sigB_R += filteredNoise; }
            if (this.noiseC) { sigC_L += filteredNoise; sigC_R += filteredNoise; }

            // --- ENVELOPES ---
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

            let targetVolA = (this.regs[8] & 0x10) ? YM_DAC[envVolIndex] : YM_DAC[this.regs[8] & 0x0F];
            let targetVolB = (this.regs[9] & 0x10) ? YM_DAC[envVolIndex] : YM_DAC[this.regs[9] & 0x0F];
            let targetVolC = (this.regs[10] & 0x10) ? YM_DAC[envVolIndex] : YM_DAC[this.regs[10] & 0x0F];

            let slewSpeedA = (this.regs[8] & 0x10) ? 1.0 : (targetVolA > this.smoothVoltA ? 0.001 : 0.0001);
            let slewSpeedB = (this.regs[9] & 0x10) ? 1.0 : (targetVolB > this.smoothVoltB ? 0.002 : 0.0002);
            let slewSpeedC = (this.regs[10] & 0x10) ? 1.0 : (targetVolC > this.smoothVoltC ? 0.005 : 0.0005);
            
            this.smoothVoltA += (targetVolA - this.smoothVoltA) * slewSpeedA;
            this.smoothVoltB += (targetVolB - this.smoothVoltB) * slewSpeedB;
            this.smoothVoltC += (targetVolC - this.smoothVoltC) * slewSpeedC;

            let sweepA = Math.pow(this.smoothVoltA, 1.2);
            let sweepB = Math.pow(this.smoothVoltB, 1.2);
            let sweepC = Math.pow(this.smoothVoltC, 1.2);

            let cutA = 150 + sweepA * (6000 - this.stage.A.sub * 4200); 
            let cutB = 150 + sweepB * (6000 - this.stage.B.sub * 4200);
            let cutC = 150 + sweepC * (6000 - this.stage.C.sub * 4200);

            let resA = 0.35 - (this.stage.A.sub * 0.3);
            let resB = 0.35 - (this.stage.B.sub * 0.3);
            let resC = 0.35 - (this.stage.C.sub * 0.3);

            sigA_L = this.applyMoogFilter(sigA_L, 0, cutA, resA); 
            sigA_R = this.applyMoogFilter(sigA_R, 1, cutA + 50, resA); 
            sigB_L = this.applyMoogFilter(sigB_L, 2, cutB, resB); 
            sigB_R = this.applyMoogFilter(sigB_R, 3, cutB + 50, resB); 
            sigC_L = this.applyMoogFilter(sigC_L, 4, cutC, resC); 
            sigC_R = this.applyMoogFilter(sigC_R, 5, cutC + 50, resC); 

            let volA = this.smoothVoltA;
            let volB = this.smoothVoltB;
            let volC = this.smoothVoltC;

            // --- PCM DRUMS ---
            let digiSample = 0;
            if (this.currentDigidrum) {
                let posInt = Math.floor(this.digiPos);
                let mu = this.digiPos - posInt;
                let y0 = this.currentDigidrum[posInt - 1] || 0;
                let y1 = this.currentDigidrum[posInt];
                let y2 = this.currentDigidrum[posInt + 1] || 0;
                let y3 = this.currentDigidrum[posInt + 2] || 0;
                
                digiSample = cubicInterpolate(y0, y1, y2, y3, mu) * 0.45; 
                this.digiPos += 8000 / sampleRate; 
                if (this.digiPos >= this.currentDigidrum.length - 2) this.currentDigidrum = null; 
            }

            // --- GAIN STAGING ---
            let lvlA_L = sigA_L * volA * 0.18;
            let lvlA_R = sigA_R * volA * 0.18;
            let lvlB_L = sigB_L * volB * 0.18;
            let lvlB_R = sigB_R * volB * 0.18;
            let lvlC_L = sigC_L * volC * 0.18;
            let lvlC_R = sigC_R * volC * 0.18;

            let epL_A = Math.cos(this.stage.A.pan * Math.PI * 0.5); let epR_A = Math.sin(this.stage.A.pan * Math.PI * 0.5);
            let epL_B = Math.cos(this.stage.B.pan * Math.PI * 0.5); let epR_B = Math.sin(this.stage.B.pan * Math.PI * 0.5);
            let epL_C = Math.cos(this.stage.C.pan * Math.PI * 0.5); let epR_C = Math.sin(this.stage.C.pan * Math.PI * 0.5);

            let mixL = (lvlA_L * epL_A) + (lvlB_L * epL_B) + (lvlC_L * epL_C) + (digiSample * 0.5);
            let mixR = (lvlA_R * epR_A) + (lvlB_R * epR_B) + (lvlC_R * epR_C) + (digiSample * 0.5);

            // --- REVERB ---
            let revL = (lvlA_L * epL_A * this.stage.A.rev) + (lvlB_L * epL_B * this.stage.B.rev) + (lvlC_L * epL_C * this.stage.C.rev);
            let revR = (lvlA_R * epR_A * this.stage.A.rev) + (lvlB_R * epR_B * this.stage.B.rev) + (lvlC_R * epR_C * this.stage.C.rev);
            if (this.currentDigidrum) { revL += digiSample * 0.15; revR += digiSample * 0.15; }

            // SICHERER INDEX FÜR DEN DELAY BUFFER (Apple/iOS Crash Fix)
            let readIdxL = (this.delayIdx - tap1 + 262144) & this.delayMask;
            let readIdxR = (this.delayIdx - tap2 + 262144) & this.delayMask;
            let readIdx3L = (this.delayIdx - tap3 + 262144) & this.delayMask;
            let readIdx3R = (this.delayIdx - tap3 + 262144) & this.delayMask;

            let r1L = this.delayBufL[readIdxL];
            let r2R = this.delayBufR[readIdxR];
            let r3L = this.delayBufL[readIdx3L];
            let r3R = this.delayBufR[readIdx3R];

            this.delayLpL += 0.2 * ((r1L + r3R) * 0.5 - this.delayLpL); 
            this.delayLpR += 0.2 * ((r2R + r3L) * 0.5 - this.delayLpR); 

            let finalL = mixL + this.delayLpL * 0.7; 
            let finalR = mixR + this.delayLpR * 0.7;

            this.delayBufL[this.delayIdx] = mixR * 0.4 + this.delayLpL * 0.5;
            this.delayBufR[this.delayIdx] = mixL * 0.4 + this.delayLpR * 0.5;
            this.delayIdx = (this.delayIdx + 1) & this.delayMask;

            // --- TUBE SATURATION ---
            finalL = finalL > 0 ? Math.tanh(finalL * 2.0) : Math.tanh(finalL * 3.0) / 1.5;
            finalR = finalR > 0 ? Math.tanh(finalR * 2.0) : Math.tanh(finalR * 3.0) / 1.5;
            finalL *= 0.85; finalR *= 0.85; 

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
registerProcessor('ym-bladerunner-processor', YMBladeRunnerProcessor);