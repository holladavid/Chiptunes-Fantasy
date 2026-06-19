// =========================================================
// YM2149F "HI-FI REIMAGINED" CORE (Synthwave Edition)
// Translates 8-Bit Registers into Modern Analog Synthesis!
// =========================================================

const YM_DAC = [
    0.0000, 0.0137, 0.0205, 0.0291, 0.0423, 0.0618, 0.0847, 0.1369, 
    0.1691, 0.2647, 0.3527, 0.4499, 0.5704, 0.6873, 0.8482, 1.0000
];

class YMHifiProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.clock = 2000000; 
        this.regs = new Uint8Array(16); 
        this.phaseA = 0; this.phaseB = 0; this.phaseC = 0;
        this.envPhase = 0.0;
        this.lfoPhase = 0.0; // Für die PWM Modulation
        
        this.incA = 0; this.incB = 0; this.incC = 0;
        this.incEnv = 0;
        this.toneA = false; this.toneB = false; this.toneC = false;
        this.noiseA = false; this.noiseB = false; this.noiseC = false;
        
        // --- STUDIO FX SETUP ---
        // State Variable Filter (Analog Pluck Simulation)
        this.fLow = [0, 0, 0]; this.fBand = [0, 0, 0];
        // Highpass Filter für die Noise-Drums (TR-909 Style)
        this.nLow = 0; this.nBand = 0;
        
        // Ping-Pong Delay Buffer (Größe: 131072 = Power of 2, ca. 2.7s bei 48kHz)
        this.delayBufL = new Float32Array(131072);
        this.delayBufR = new Float32Array(131072);
        this.delayMask = 131071;
        this.delayIdx = 0;
        this.delayFeedback = 0.45; // 45% Echo
        this.delayTime = 0; // Wird im Prozess initialisiert

        this.digidrums = [];
        this.currentDigidrum = null;
        this.digiPos = 0;
        this.lastDigiTrigger = 0;
        
        this.trackData = null;
        this.currentFrame = 0;
        this.sampleCounter = 0;
        this.isPlaying = false;
        
        this.port.onmessage = (event) => {
            if (event.data.type === 'PLAY_TRACK') {
                this.trackData = event.data.track;
                this.digidrums = event.data.digidrums || []; 
                this.currentFrame = 0;
                this.sampleCounter = 0;
                this.currentDigidrum = null;
                this.lastDigiTrigger = 0;
                this.envPhase = 0;
                this.isPlaying = true;
                this.updateInternals(); 
            } else if (event.data.type === 'STOP_TRACK') {
                this.isPlaying = false;
            } else if (event.data.type === 'RESUME_TRACK') {
                this.isPlaying = true; 
            }
        };
    }

    updateInternals() {
        let pA = ((this.regs[1] & 0x0F) << 8) | this.regs[0];
        let pB = ((this.regs[3] & 0x0F) << 8) | this.regs[2];
        let pC = ((this.regs[5] & 0x0F) << 8) | this.regs[4];
        
        this.incA = (this.clock / (16 * (pA === 0 ? 1 : pA))) / sampleRate;
        this.incB = (this.clock / (16 * (pB === 0 ? 1 : pB))) / sampleRate;
        this.incC = (this.clock / (16 * (pC === 0 ? 1 : pC))) / sampleRate;

        let pE = (this.regs[12] << 8) | this.regs[11];
        this.incEnv = (this.clock / (256 * (pE === 0 ? 1 : pE))) / sampleRate;

        const mix = this.regs[7];
        this.toneA = (mix & 0x01) === 0;
        this.toneB = (mix & 0x02) === 0;
        this.toneC = (mix & 0x04) === 0;
        this.noiseA = (mix & 0x08) === 0;
        this.noiseB = (mix & 0x10) === 0;
        this.noiseC = (mix & 0x20) === 0;
    }

    // Hilfsfunktion: State Variable Filter (Moog-Style Lowpass)
    applyFilter(input, ch, cutoffHz, resonance) {
        if (cutoffHz > sampleRate / 2) cutoffHz = sampleRate / 2.1;
        let f = 2.0 * Math.sin(Math.PI * cutoffHz / sampleRate);
        let q = 1.0 - resonance;
        
        this.fLow[ch] += f * this.fBand[ch];
        let high = input - this.fLow[ch] - q * this.fBand[ch];
        this.fBand[ch] += f * high;
        return this.fLow[ch]; // Lowpass Output
    }

    process(inputs, outputs) {
        const channelLeft = outputs[0][0];  
        const channelRight = outputs[0][1] || outputs[0][0]; 
        let currentVisualValue = 0;

        // Init Delay Time (3/16th Noten Bounce bei ca. 125 BPM)
        if (this.delayTime === 0) this.delayTime = Math.floor(sampleRate * 0.35);

        for (let i = 0; i < channelLeft.length; i++) {
            
            if (!this.isPlaying) {
                channelLeft[i] = 0; if (channelRight) channelRight[i] = 0;
                continue; 
            }

            // --- 50HZ HARDWARE SEQUENZER ---
            if (this.isPlaying && this.trackData) {
                this.sampleCounter--;
                if (this.sampleCounter <= 0) {
                    this.sampleCounter += sampleRate / 50.0; 
                    let frame = this.trackData[this.currentFrame];
                    
                    for(let r=0; r<16; r++) {
                        if (r === 13) {
                            if (frame[13] !== 0xFF) {
                                this.regs[13] = frame[13];
                                this.envPhase = 0.0; 
                            }
                        } else this.regs[r] = frame[r];
                    }
                    
                    // Digidrum Catcher
                    let activeDigiTrigger = 0;
                    if (frame[15] > 0) activeDigiTrigger = frame[15];
                    else if (frame[14] > 0) activeDigiTrigger = frame[14];
                    let fx1Voice = (frame[1] & 0x30) >> 4;
                    if (fx1Voice > 0) activeDigiTrigger = (frame[8 + fx1Voice - 1] & 0x1F) + 1;
                    let fx2Voice = (frame[3] & 0x30) >> 4;
                    if (fx2Voice > 0) activeDigiTrigger = (frame[8 + fx2Voice - 1] & 0x1F) + 1;

                    if (activeDigiTrigger > 0 && activeDigiTrigger !== this.lastDigiTrigger) {
                        if (this.digidrums[activeDigiTrigger - 1]) {
                            this.currentDigidrum = this.digidrums[activeDigiTrigger - 1];
                            this.digiPos = 0;
                            this.port.postMessage({ type: 'DEBUG', msg: 'Drum ' + activeDigiTrigger });
                        }
                    }
                    this.lastDigiTrigger = activeDigiTrigger;
                    
                    this.updateInternals();
                    this.currentFrame = (this.currentFrame + 1) % this.trackData.length;
                }
            }

            // --- NEXT GEN DSP (Reimagined Synthesis) ---
            this.phaseA = (this.phaseA + this.incA) % 1.0;
            this.phaseB = (this.phaseB + this.incB) % 1.0;
            this.phaseC = (this.phaseC + this.incC) % 1.0;
            this.lfoPhase = (this.lfoPhase + 3.0 / sampleRate) % 1.0; // 3 Hz LFO
            
            // Channel A: Fat Sawtooth + Sub-Oscillator
            let sqA = (this.phaseA * 2.0) - 1.0; 
            let subA = ((this.phaseA * 0.5) % 1.0) > 0.5 ? 0.5 : -0.5;
            let outA = this.toneA ? (sqA + subA) * 0.7 : 0.0;
            
            // Channel B: Lush PWM (Pulse Width Modulation) driven by LFO
            let pwmB = Math.sin(this.lfoPhase * 2.0 * Math.PI) * 0.3 + 0.5;
            let outB = this.toneB ? (this.phaseB > pwmB ? 1.0 : -1.0) : 0.0;
            
            // Channel C: Triangle/Saw Mix (Smooth Lead)
            let triC = Math.abs((this.phaseC * 2.0) - 1.0) * 2.0 - 1.0;
            let outC = this.toneC ? triC : 0.0;

            // Hi-Fi Noise (TR-909 Style White Noise)
            let pN = this.regs[6] & 0x1F;
            let modernNoise = 0;
            if (this.noiseA || this.noiseB || this.noiseC) {
                let rawNoise = (Math.random() * 2.0 - 1.0);
                // Highpass Filter für knackige Hi-Hats
                let cutoffN = 1000 + (31 - pN) * 200; 
                let fN = 2.0 * Math.sin(Math.PI * cutoffN / sampleRate);
                this.nLow += fN * this.nBand;
                let nHigh = rawNoise - this.nLow - 0.5 * this.nBand;
                this.nBand += fN * nHigh;
                modernNoise = nHigh * 1.5; 
            }

            if (this.noiseA) outA += modernNoise;
            if (this.noiseB) outB += modernNoise;
            if (this.noiseC) outC += modernNoise;

            // Hardware Envelope Calculation
            this.envPhase += this.incEnv;
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

            // ANALOG FILTER: The Volume dictates the Cutoff Frequency! (Pluck-Effect)
            // A loud note opens the filter to 8000Hz, a quiet note muffles it at 300Hz.
            outA = this.applyFilter(outA, 0, 300 + (volA_raw/15) * 8000, 0.4);
            outB = this.applyFilter(outB, 1, 300 + (volB_raw/15) * 8000, 0.4);
            outC = this.applyFilter(outC, 2, 300 + (volC_raw/15) * 8000, 0.4);

            let volA = YM_DAC[volA_raw];
            let volB = YM_DAC[volB_raw];
            let volC = YM_DAC[volC_raw];

            // Digidrum Playback
            let digiSample = 0;
            if (this.currentDigidrum) {
                let posInt = Math.floor(this.digiPos);
                if (posInt < this.currentDigidrum.length) {
                    digiSample = this.currentDigidrum[posInt] * 1.5;
                    this.digiPos += 12500 / sampleRate; 
                } else this.currentDigidrum = null; 
            }

            // --- STEREO PANNING & MIXING ---
            // A = 70% Left, B = Center, C = 70% Right
            let mixL = (outA * volA * 0.85) + (outB * volB * 0.5) + (outC * volC * 0.15) + (digiSample * 0.5);
            let mixR = (outA * volA * 0.15) + (outB * volB * 0.5) + (outC * volC * 0.85) + (digiSample * 0.5);

            // --- PING PONG DELAY ---
            let readIdxL = (this.delayIdx - this.delayTime + 131072) & this.delayMask;
            let readIdxR = (this.delayIdx - this.delayTime + 131072 + Math.floor(this.delayTime/2)) & this.delayMask;
            
            let echoL = this.delayBufL[readIdxL];
            let echoR = this.delayBufR[readIdxR];

            // Output Mix
            let finalL = mixL + echoL * this.delayFeedback;
            let finalR = mixR + echoR * this.delayFeedback;

            // Write to Delay Buffer (Criss-Cross)
            this.delayBufL[this.delayIdx] = mixR + echoL * 0.2;
            this.delayBufR[this.delayIdx] = mixL + echoR * 0.2;
            this.delayIdx = (this.delayIdx + 1) & this.delayMask;

            // Hard Limiter
            if (finalL > 1.0) finalL = 1.0; if (finalL < -1.0) finalL = -1.0;
            if (finalR > 1.0) finalR = 1.0; if (finalR < -1.0) finalR = -1.0;

            channelLeft[i] = finalL;
            if (channelRight) channelRight[i] = finalR;
            if (i === 0) currentVisualValue = (finalL + finalR) / 2.0;
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
registerProcessor('ym-hifi-processor', YMHifiProcessor);