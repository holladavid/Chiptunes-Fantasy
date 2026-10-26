// Cycle-level SID envelope generator shared by hardware-oriented chip models.
// Gate changes traverse a two-cycle input pipeline. Rising GATE restarts the
// 15-bit rate phase; only an exact period match emits an envelope tick.

export const SID_ENV_ATTACK = 0;
export const SID_ENV_DECAY = 1;
export const SID_ENV_RELEASE = 2;

export function initializeSidEnvelope(voice) {
    voice.state = SID_ENV_RELEASE;
    voice.gateInput = false;
    voice.gateDelay = false;
    voice.gate = false;
    voice.rate_counter = 0;
    voice.exponential_counter = 0;
    voice.envelope_counter = 0;
    voice.exponential_period = 1;
    voice.hold_zero = true;
}

export function setSidEnvelopeGate(voice, gate) {
    voice.gateInput = gate;
}

function updateExponentialPeriod(voice) {
    const envelope = voice.envelope_counter;
    let period = 30;
    if (envelope > 93) period = 1;
    else if (envelope > 54) period = 2;
    else if (envelope > 26) period = 4;
    else if (envelope > 14) period = 8;
    else if (envelope > 6) period = 16;
    voice.exponential_period = period;
}

export function clockSidEnvelope(voice) {
    const resolvedGate = voice.gateDelay;
    voice.gateDelay = voice.gateInput;

    if (resolvedGate !== voice.gate) {
        voice.gate = resolvedGate;
        voice.state = resolvedGate ? SID_ENV_ATTACK : SID_ENV_RELEASE;
        if (resolvedGate) {
            voice.rate_counter = 0;
            voice.exponential_counter = 0;
            voice.exponential_period = 1;
            voice.hold_zero = false;
        }
    }

    voice.rate_counter = (voice.rate_counter + 1) & 0x7FFF;

    let ratePeriod = voice.release_period;
    if (voice.state === SID_ENV_ATTACK) ratePeriod = voice.attack_period;
    else if (voice.state === SID_ENV_DECAY) ratePeriod = voice.decay_period;

    // Not >=: shortening a rate below the running counter waits for wraparound.
    if (voice.rate_counter !== ratePeriod) return;
    voice.rate_counter = 0;
    if (voice.hold_zero) return;

    if (voice.state !== SID_ENV_ATTACK) {
        voice.exponential_counter++;
        if (voice.exponential_counter !== voice.exponential_period) return;
        voice.exponential_counter = 0;
    }

    if (voice.state === SID_ENV_ATTACK) {
        voice.envelope_counter++;
        if (voice.envelope_counter === 0xFF) voice.state = SID_ENV_DECAY;
        voice.exponential_period = 1;
        return;
    }

    // A gate pulse can enter Release before Attack has lifted a zero envelope.
    // The 8-bit counter must hold at zero rather than indexing the DAC below 0.
    if (voice.envelope_counter === 0) {
        voice.hold_zero = true;
        return;
    }

    if (voice.state === SID_ENV_DECAY) {
        if (voice.envelope_counter === voice.sustain_level) return;
        voice.envelope_counter--;
    } else {
        voice.envelope_counter--;
    }

    updateExponentialPeriod(voice);
    if (voice.envelope_counter === 0) voice.hold_zero = true;
}
