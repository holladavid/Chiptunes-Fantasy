// === js/ui/environmental-sensors.js ===
// Time-based readout model for the C64 ENV DIAGNOSTICS panel.
// This is presentation-only telemetry; it never feeds back into SID emulation.

const REST_VOLTAGE = 5.02;
const REST_NOISE_DB = -74.0;
const REST_BIAS = 0.82;

const ENERGY_ATTACK_SECONDS = 0.10;
const ENERGY_RELEASE_SECONDS = 0.40;
const VOLTAGE_RESPONSE_SECONDS = 0.35;
const NOISE_RESPONSE_SECONDS = 0.45;
const BIAS_RESPONSE_SECONDS = 0.80;

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function smooth(current, target, dt, timeConstant) {
    if (dt <= 0) return current;
    return current + (target - current) * (1 - Math.exp(-dt / timeConstant));
}

export class EnvironmentalSensors {
    constructor() {
        this.reset();
    }

    reset() {
        this.voltage = REST_VOLTAGE;
        this.noiseDb = REST_NOISE_DB;
        this.bias = REST_BIAS;
        this.energy = 0;
        this.lastTime = null;
    }

    update({ volumes, channelCount = 3, temperature = 55, isPlaying = false }, nowSeconds) {
        let dt = this.lastTime === null ? 0 : nowSeconds - this.lastTime;
        this.lastTime = nowSeconds;
        if (!Number.isFinite(dt) || dt < 0) dt = 0;
        // A suspended browser tab must not turn the next HUD frame into a jump.
        dt = Math.min(dt, 1.0);

        let instantEnergy = 0;
        if (isPlaying && volumes && channelCount > 0) {
            for (let channel = 0; channel < channelCount; channel++) {
                const volume = Number.isFinite(volumes[channel]) ? volumes[channel] : 0;
                instantEnergy += clamp(volume, 0, 1);
            }
            instantEnergy /= channelCount;
        }

        const energyTimeConstant = instantEnergy > this.energy
            ? ENERGY_ATTACK_SECONDS
            : ENERGY_RELEASE_SECONDS;
        this.energy = smooth(this.energy, instantEnergy, dt, energyTimeConstant);

        const safeTemperature = Number.isFinite(temperature) ? clamp(temperature, 15, 75) : 55;
        const tempDelta = safeTemperature - 55;

        // Small, physically plausible operating-point changes only. No per-frame
        // random jitter: a constant machine state produces a constant readout.
        const targetVoltage = REST_VOLTAGE - this.energy * 0.12 - tempDelta * 0.001;
        const targetNoiseDb = REST_NOISE_DB + this.energy * 3.8 + tempDelta * 0.08;
        const targetBias = REST_BIAS + this.energy * 0.03 + tempDelta * 0.0025;

        this.voltage = smooth(this.voltage, targetVoltage, dt, VOLTAGE_RESPONSE_SECONDS);
        this.noiseDb = smooth(this.noiseDb, targetNoiseDb, dt, NOISE_RESPONSE_SECONDS);
        this.bias = smooth(this.bias, targetBias, dt, BIAS_RESPONSE_SECONDS);

        return this;
    }
}
