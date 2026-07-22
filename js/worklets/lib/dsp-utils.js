// === js/worklets/lib/dsp-utils.js ===
// =========================================================
// DSP UTILITIES & FILTERS
// Das Effekt-Rack für alle Worklets
// =========================================================

export const YM_DAC = [
    0.0000, 0.0137, 0.0205, 0.0291, 0.0423, 0.0618, 0.0847, 0.1369, 
    0.1691, 0.2647, 0.3527, 0.4499, 0.5704, 0.6873, 0.8482, 1.0000
];

export function polyBLEP(t, dt) {
    if (t < dt) { t /= dt; return t + t - t * t - 1.0; }
    else if (t > 1.0 - dt) { t = (t - 1.0 + dt) / dt; return 1.0 - (t + t - t * t); }
    return 0.0;
}

export function cubicInterpolate(y0, y1, y2, y3, mu) {
    let mu2 = mu * mu;
    let a0 = -0.5 * y0 + 1.5 * y1 - 1.5 * y2 + 0.5 * y3;
    let a1 = y0 - 2.5 * y1 + 2.0 * y2 - 0.5 * y3;
    let a2 = -0.5 * y0 + 0.5 * y2;
    return (a0 * mu * mu2 + a1 * mu2 + a2 * mu + y1);
}

// 12dB Moog-Style Filter (Für Blade Runner & Noise)
export class MoogFilter {
    constructor() { this.low = 0; this.band = 0; }
    process(input, cutoffHz, resonance, sampleRate) {
        if (cutoffHz < 20) cutoffHz = 20;
        if (cutoffHz > 16000) cutoffHz = 16000; 
        let q = 1.0 - resonance;
        let f = 2.0 * Math.sin(Math.PI * cutoffHz / sampleRate);
        if (f > 1.9 - q) f = 1.9 - q; 
        
        this.low += f * this.band;
        let hp = input - this.low - q * this.band;
        this.band += f * hp;
        
        if (isNaN(this.low)) { this.low = 0; this.band = 0; }
        return this.low; 
    }
}

// 24dB 4-Pole Filter (Für Chiptunes Fantasy)
export class FourPoleFilter {
    constructor() { this.l1 = 0; this.b1 = 0; this.l2 = 0; this.b2 = 0; }
    process(input, cutoffHz, resonance, sampleRate) {
        if (cutoffHz < 20) cutoffHz = 20;
        if (cutoffHz > 18000) cutoffHz = 18000; 
        let q = 1.0 - (resonance * 0.8); 
        let f = 2.0 * Math.sin(Math.PI * cutoffHz / sampleRate);
        if (f > 1.9 - q) f = 1.9 - q; 
        
        this.l1 += f * this.b1;
        let h1 = input - this.l1 - q * this.b1;
        this.b1 += f * h1;
        
        this.l2 += f * this.b2;
        let h2 = this.l1 - this.l2 - q * this.b2;
        this.b2 += f * h2;

        if (isNaN(this.l2)) { this.l1=0; this.b1=0; this.l2=0; this.b2=0; }
        return this.l2; 
    }
}

// DC Blocker (Hält die Lautsprecher-Membranen mittig)
export class DCBlocker {
    constructor() { this.lastIn = 0; this.lastOut = 0; }
    process(input) {
        let out = input - this.lastIn + 0.995 * this.lastOut;
        this.lastIn = input; this.lastOut = out;
        return out;
    }
}

// =========================================================
// C64 ANALOG OUTPUT STAGE (1-Pole RC + Sinc-Droop Equalizer)
// =========================================================
// === js/worklets/lib/dsp-utils.js ===
// =========================================================
// C64 ANALOG OUTPUT STAGE (1-Pole RC + 45Hz AC-Coupling + Sinc-Droop)
// =========================================================

export class C64AnalogFilter {
    constructor(sampleRate) {
        // 1. Sinc-Droop Equalizer Pre-Emphasis (+2.5 dB bei 16 kHz)
        this.cComp = 0.22;
        this.lastX = 0;

        // 2. C64 Motherboard 16kHz Lowpass Filter
        const fc = 16000.0;
        this.alphaLp = Math.exp(-2.0 * Math.PI * fc / sampleRate);
        this.lastLp = 0;

        // 3. C64 Motherboard 45Hz AC-Coupling Highpass Filter (C12/C13 Capacitors)
        // Rolls off infrasonic sub-50Hz rumble to match physical C64 A/V output stage
        const fhp = 45.0;
        this.alphaHp = Math.exp(-2.0 * Math.PI * fhp / sampleRate);
        this.lastHpIn = 0;
        this.lastHpOut = 0;
    }

    process(x) {
        // A) Sinc-Droop Pre-Equalization
        let comp = (1.0 + this.cComp) * x - this.cComp * this.lastX;
        this.lastX = x;

        // B) 16kHz 1-Pole Lowpass RC Filter
        let lp = (1.0 - this.alphaLp) * comp + this.alphaLp * this.lastLp;
        this.lastLp = lp;

        // C) 45Hz 1-Pole AC-Coupling Highpass Filter (Motherboard C12/C13)
        let hp = this.alphaHp * (this.lastHpOut + lp - this.lastHpIn);
        this.lastHpIn = lp;
        this.lastHpOut = hp;

        return hp;
    }
}

/**
 * Erkennt Digidrum-Trigger innerhalb eines YM5/YM6-Register-Frames.
 */
export function detectDigidrum(frame) {
    let activeDigiTrigger = 0;

    const fx1Type = (frame[1] & 0xC0) >> 6;
    const fx1Voice = (frame[1] & 0x30) >> 4;

    if (fx1Type === 1 && fx1Voice > 0) {
        const sampleReg = 8 + fx1Voice - 1;
        activeDigiTrigger = (frame[sampleReg] & 0x1F) + 1;
    } else {
        const fx2Type = (frame[3] & 0xC0) >> 6;
        const fx2Voice = (frame[3] & 0x30) >> 4;

        if (fx2Type === 1 && fx2Voice > 0) {
            const sampleReg = 8 + fx2Voice - 1;
            activeDigiTrigger = (frame[sampleReg] & 0x1F) + 1;
        }
    }

    if (activeDigiTrigger === 0) {
        if (frame[15] > 0) activeDigiTrigger = frame[15];
        else if (frame[14] > 0) activeDigiTrigger = frame[14];
    }

    return activeDigiTrigger;
}

export function detectDigidrumVoice(frame) {
    const fx1Type = (frame[1] & 0xC0) >> 6;
    const fx1Voice = (frame[1] & 0x30) >> 4;
    if (fx1Type === 1 && fx1Voice > 0) return fx1Voice;

    const fx2Type = (frame[3] & 0xC0) >> 6;
    const fx2Voice = (frame[3] & 0x30) >> 4;
    if (fx2Type === 1 && fx2Voice > 0) return fx2Voice;

    return 0; 
}

export const YM2149_DAC32 = new Float32Array([
    0.0000, 0.0043, 0.0061, 0.0084, 0.0119, 0.0163, 0.0242, 0.0345,
    0.0483, 0.0682, 0.0988, 0.1384, 0.1983, 0.2831, 0.3984, 0.5510,
    0.5843, 0.6121, 0.6433, 0.6784, 0.7183, 0.7634, 0.8142, 0.8724,
    0.8845, 0.8988, 0.9155, 0.9348, 0.9573, 0.9830, 0.9950, 1.0000
]);

export class AtariAnalogFilter {
    constructor(sampleRate) {
        this.lpAlpha = Math.exp(-2.0 * Math.PI * 15900.0 / sampleRate);
        this.hpAlpha = Math.exp(-2.0 * Math.PI * 25.0 / sampleRate); 
        this.lastLp = 0;
        this.lastHpIn = 0;
        this.lastHpOut = 0;
    }
    
    process(input) {
        let lp = (1.0 - this.lpAlpha) * input + this.lpAlpha * this.lastLp;
        this.lastLp = lp;
        let hp = this.hpAlpha * (this.lastHpOut + lp - this.lastHpIn);
        this.lastHpIn = lp;
        this.lastHpOut = hp;
        return Math.tanh(hp * 1.25) / 1.25;
    }
}