import { YM2149_DAC32 } from './dsp-utils.js';

export const YM2149_CLOCK = 2000000;
export const YM2149_REGISTER_COUNT = 16;
export const YM2149_VOICE_COUNT = 3;

export class YM2149Core {
    constructor(clock = YM2149_CLOCK) {
        if (!Number.isFinite(clock) || clock <= 0) throw new RangeError('clock must be a positive finite number');
        this.clock = clock;
        this.regs = new Uint8Array(YM2149_REGISTER_COUNT);
        this.reset();
    }

    reset() {
        this.regs.fill(0);
        this.toneDivA = 0;
        this.toneDivB = 0;
        this.toneDivC = 0;
        this.noiseDiv = 0;
        this.envDiv = 0;
        this.envPos = 0;
        this.envShape = 0;
        this.envVol5Bit = 0;
        this.toneOutA = 1;
        this.toneOutB = 1;
        this.toneOutC = 1;
        this.noiseLfsr = 1;
        this.noiseOut = 1;
        this.volA = 0;
        this.volB = 0;
        this.volC = 0;
        this.outputSample = 0;
    }

    writeRegister(register, value) {
        if (register === 13) {
            if (value === 0xFF) return;
            this.regs[13] = value;
            this.envShape = value & 0x0F;
            this.envPos = 0;
            this.envVol5Bit = (this.envShape & 0x04) ? 0 : 31;
            this.envDiv = 8 * (((this.regs[12] << 8) | this.regs[11]) || 1);
            return;
        }
        this.regs[register] = value;
    }

    clockCycle(digiVal5Bit = -1, hijackedVoice = 0) {
        const regs = this.regs;
        const pA = (((regs[1] & 0x0F) << 8) | regs[0]) || 1;
        const pB = (((regs[3] & 0x0F) << 8) | regs[2]) || 1;
        const pC = (((regs[5] & 0x0F) << 8) | regs[4]) || 1;
        const pN = (regs[6] & 0x1F) || 1;
        const pE = ((regs[12] << 8) | regs[11]) || 1;

        if (--this.toneDivA <= 0) {
            this.toneDivA = 8 * pA;
            this.toneOutA ^= 1;
        }
        if (--this.toneDivB <= 0) {
            this.toneDivB = 8 * pB;
            this.toneOutB ^= 1;
        }
        if (--this.toneDivC <= 0) {
            this.toneDivC = 8 * pC;
            this.toneOutC ^= 1;
        }

        if (--this.noiseDiv <= 0) {
            this.noiseDiv = 16 * pN;
            const bit0 = this.noiseLfsr & 1;
            const bit3 = (this.noiseLfsr >> 3) & 1;
            this.noiseLfsr = (this.noiseLfsr >> 1) | ((bit0 ^ bit3) << 16);
            this.noiseOut = bit0;
        }

        if (--this.envDiv <= 0) {
            this.envDiv = 8 * pE;

            if (this.envPos < 32) {
                this.envPos++;
            } else if (this.envShape >= 8 && (this.envShape & 1) === 0) {
                this.envPos++;
                if (this.envPos >= 64) this.envPos = 0;
            }

            const p = this.envPos;
            const s = p & 31;
            let out = 0;
            switch (this.envShape) {
                case 0: case 1: case 2: case 3: out = (p < 32) ? (31 - s) : 0; break;
                case 4: case 5: case 6: case 7: out = (p < 32) ? s : 0; break;
                case 8: out = 31 - s; break;
                case 9: out = (p < 32) ? (31 - s) : 0; break;
                case 10: out = (p < 32) ? (31 - s) : s; break;
                case 11: out = (p < 32) ? (31 - s) : 31; break;
                case 12: out = s; break;
                case 13: out = (p < 32) ? s : 31; break;
                case 14: out = (p < 32) ? s : (31 - s); break;
                case 15: out = (p < 32) ? s : 0; break;
            }
            this.envVol5Bit = out;
        }

        const r8 = regs[8];
        const r9 = regs[9];
        const r10 = regs[10];
        let vA5 = (r8 & 0x10) ? this.envVol5Bit : ((r8 & 0x0F) === 0 ? 0 : (r8 & 0x0F) * 2 + 1);
        let vB5 = (r9 & 0x10) ? this.envVol5Bit : ((r9 & 0x0F) === 0 ? 0 : (r9 & 0x0F) * 2 + 1);
        let vC5 = (r10 & 0x10) ? this.envVol5Bit : ((r10 & 0x0F) === 0 ? 0 : (r10 & 0x0F) * 2 + 1);

        if (digiVal5Bit !== -1) {
            if (hijackedVoice === 1 || hijackedVoice === 0) vA5 = digiVal5Bit;
            else if (hijackedVoice === 2) vB5 = digiVal5Bit;
            else if (hijackedVoice === 3) vC5 = digiVal5Bit;
        }

        const mix = regs[7];
        let outA = ((mix & 0x01) | this.toneOutA) & (((mix & 0x08) >> 3) | this.noiseOut);
        let outB = (((mix & 0x02) >> 1) | this.toneOutB) & (((mix & 0x10) >> 4) | this.noiseOut);
        let outC = (((mix & 0x04) >> 2) | this.toneOutC) & (((mix & 0x20) >> 5) | this.noiseOut);

        if (digiVal5Bit !== -1) {
            if (hijackedVoice === 1 || hijackedVoice === 0) outA = 1;
            if (hijackedVoice === 2) outB = 1;
            if (hijackedVoice === 3) outC = 1;
        }

        const ampA = outA ? YM2149_DAC32[vA5] : 0;
        const ampB = outB ? YM2149_DAC32[vB5] : 0;
        const ampC = outC ? YM2149_DAC32[vC5] : 0;
        const sumRaw = ampA + ampB + ampC;
        this.outputSample = (sumRaw / (1 + 0.22 * sumRaw)) * 0.42;
        this.volA = ampA;
        this.volB = ampB;
        this.volC = ampC;
        return this.outputSample;
    }
}
