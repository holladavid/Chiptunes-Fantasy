// MOS 6581 R3 digital waveform selector.
// Primitive generators retain the SID's full 12-bit DAC input resolution.
// Triangle+pulse uses independently measured external-model anchors. Other
// combined waveforms retain the documented wired-AND digital baseline.

import { trianglePulse12Bit6581R3 } from './sid-combined-6581.js';

export function triangle12Bit(phase24, ringMSB) {
    const triangle = (phase24 >>> 11) & 0x0FFF;
    return ringMSB ? triangle ^ 0x0FFF : triangle;
}

export function sawtooth12Bit(phase24) {
    return (phase24 >>> 12) & 0x0FFF;
}

export function pulse12Bit(phase24, pw12, test) {
    if (test) return 0x0FFF;
    return ((phase24 >>> 12) & 0x0FFF) < (pw12 & 0x0FFF) ? 0x0FFF : 0;
}

export function noise12Bit(lfsr23) {
    return ((lfsr23 & 0x100000) >>> 9) |
        ((lfsr23 & 0x040000) >>> 8) |
        ((lfsr23 & 0x004000) >>> 5) |
        ((lfsr23 & 0x000800) >>> 3) |
        ((lfsr23 & 0x000200) >>> 2) |
        ((lfsr23 & 0x000020) << 1) |
        ((lfsr23 & 0x000004) << 3) |
        ((lfsr23 & 0x000001) << 4);
}

export function calculateWaveform12Bit6581R3(ctrl, phase24, pw12, lfsr23, ringMSB) {
    const selected = ctrl & 0xF0;
    if (selected === 0x50) {
        return trianglePulse12Bit6581R3(
            (phase24 >>> 12) & 0x0FFF,
            pulse12Bit(phase24, pw12, (ctrl & 0x08) !== 0)
        );
    }

    let output = 0x0FFF;

    // A zero on any selected DAC input dominates the wired combination.
    if (selected & 0x10) output &= triangle12Bit(phase24, ringMSB);
    if (selected & 0x20) output &= sawtooth12Bit(phase24);
    if (selected & 0x40) output &= pulse12Bit(phase24, pw12, (ctrl & 0x08) !== 0);
    if (selected & 0x80) output &= noise12Bit(lfsr23);

    return output;
}
