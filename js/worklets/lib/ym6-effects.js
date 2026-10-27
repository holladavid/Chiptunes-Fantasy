import { YM2149_CLOCK } from './ym2149-core.js';

export const MFP_CLOCK = 2457600;
export const MFP_PREDIVISORS = new Uint16Array([0, 4, 10, 16, 50, 64, 100, 200]);

export const YM6_EFFECT = Object.freeze({
    SID_VOICE: 0,
    DIGIDRUM: 1,
    SINUS_SID: 2,
    SYNC_BUZZER: 3
});

const SINUS_SID_TABLE = new Uint8Array(16 * 8);
for (let volume = 0; volume < 16; volume++) {
    for (let position = 0; position < 8; position++) {
        const level = Math.round(volume * (1 + Math.sin(position * Math.PI / 4)) / 2);
        SINUS_SID_TABLE[volume * 8 + position] = level;
    }
}

export function mfpTimerFrequency(timerPredivisor, timerCount) {
    const predivisor = MFP_PREDIVISORS[timerPredivisor & 7];
    if (!predivisor || !timerCount) return 0;
    return MFP_CLOCK / predivisor / timerCount;
}

export function decodeYM6Effect(frame, slotIndex, target = {}) {
    const descriptorRegister = slotIndex === 0 ? 1 : 3;
    const timerRegister = slotIndex === 0 ? 6 : 8;
    const countRegister = slotIndex === 0 ? 14 : 15;
    const descriptor = frame[descriptorRegister];
    const voice = (descriptor >> 4) & 3;

    target.type = (descriptor >> 6) & 3;
    target.voice = voice;
    target.timerPredivisor = (frame[timerRegister] >> 5) & 7;
    target.timerCount = frame[countRegister];
    target.parameter = voice ? frame[7 + voice] & (target.type === YM6_EFFECT.DIGIDRUM ? 0x1F : 0x0F) : 0;
    target.active = voice !== 0 && target.timerPredivisor !== 0 && target.timerCount !== 0;
    return target;
}

function createSlot() {
    return {
        active: false,
        type: 0,
        voice: 0,
        parameter: 0,
        timerPredivisor: 0,
        timerCount: 0,
        timerThreshold: 1,
        timerPhase: 0,
        sample: null,
        samplePosition: 0,
        sequencePosition: 0,
        level: 0,
        command: {}
    };
}

export class YM6Effects {
    constructor(clock = YM2149_CLOCK) {
        if (!Number.isFinite(clock) || clock <= 0) throw new RangeError('clock must be a positive finite number');
        this.clock = clock;
        this.slots = [createSlot(), createSlot()];
        this.voiceLevels = new Int8Array(3);
        this.digidrumStartMask = 0;
        this.reset();
    }

    reset() {
        for (let i = 0; i < 2; i++) {
            const slot = this.slots[i];
            slot.active = false;
            slot.type = 0;
            slot.voice = 0;
            slot.parameter = 0;
            slot.timerPredivisor = 0;
            slot.timerCount = 0;
            slot.timerThreshold = 1;
            slot.timerPhase = 0;
            slot.sample = null;
            slot.samplePosition = 0;
            slot.sequencePosition = 0;
            slot.level = 0;
        }
        this.voiceLevels.fill(-1);
        this.digidrumStartMask = 0;
    }

    applyFrame(frame, digidrums) {
        this.digidrumStartMask = 0;
        for (let i = 0; i < 2; i++) {
            const slot = this.slots[i];
            const command = decodeYM6Effect(frame, i, slot.command);
            if (!command.active) {
                if (slot.active && slot.type !== YM6_EFFECT.DIGIDRUM) slot.active = false;
                continue;
            }

            const unchanged = slot.active && slot.type === command.type && slot.voice === command.voice &&
                slot.parameter === command.parameter && slot.timerPredivisor === command.timerPredivisor &&
                slot.timerCount === command.timerCount;
            if (command.type !== YM6_EFFECT.DIGIDRUM && unchanged) continue;

            slot.active = false;
            slot.type = command.type;
            slot.voice = command.voice;
            slot.parameter = command.parameter;
            slot.timerPredivisor = command.timerPredivisor;
            slot.timerCount = command.timerCount;
            slot.timerThreshold = this.clock * MFP_PREDIVISORS[command.timerPredivisor] * command.timerCount;
            slot.timerPhase = slot.timerThreshold; // The first timer event occurs at the next YM cycle.
            slot.sample = null;
            slot.samplePosition = 0;
            slot.sequencePosition = 0;
            slot.level = 0;

            if (command.type === YM6_EFFECT.DIGIDRUM) {
                const sample = digidrums[command.parameter];
                if (!sample || sample.length === 0) continue;
                slot.sample = sample;
                slot.active = true;
                this.digidrumStartMask |= 1 << i;
            } else {
                slot.active = true;
            }
        }
    }

    clockCycle(core) {
        this.voiceLevels.fill(-1);
        for (let i = 0; i < 2; i++) {
            const slot = this.slots[i];
            if (!slot.active) continue;

            if (slot.timerPhase >= slot.timerThreshold) {
                slot.timerPhase -= slot.timerThreshold;
                if (slot.type === YM6_EFFECT.DIGIDRUM && slot.samplePosition >= slot.sample.length) {
                    slot.active = false;
                    slot.sample = null;
                    continue;
                }
                switch (slot.type) {
                    case YM6_EFFECT.DIGIDRUM: {
                        const value = Math.max(-1, Math.min(1, slot.sample[slot.samplePosition]));
                        const nibble = Math.max(0, Math.min(15, Math.floor((value + 1) * 8)));
                        slot.level = nibble === 0 ? 0 : nibble * 2 + 1;
                        slot.samplePosition++;
                        break;
                    }
                    case YM6_EFFECT.SID_VOICE:
                        slot.level = slot.level === 0 ? (slot.parameter === 0 ? 0 : slot.parameter * 2 + 1) : 0;
                        break;
                    case YM6_EFFECT.SINUS_SID: {
                        const nibble = SINUS_SID_TABLE[slot.parameter * 8 + slot.sequencePosition];
                        slot.level = nibble === 0 ? 0 : nibble * 2 + 1;
                        slot.sequencePosition = (slot.sequencePosition + 1) & 7;
                        break;
                    }
                    case YM6_EFFECT.SYNC_BUZZER:
                        core.writeRegister(13, slot.parameter);
                        break;
                }
            }

            if (slot.type !== YM6_EFFECT.SYNC_BUZZER) {
                const voice = slot.voice - 1;
                if (voice >= 0) this.voiceLevels[voice] = slot.level;
            }
            slot.timerPhase += MFP_CLOCK;
        }
        return this.voiceLevels;
    }
}
