import test from 'node:test';
import assert from 'node:assert/strict';

import { EnvironmentalSensors } from '../js/ui/environmental-sensors.js';

const C64_VOICES = new Float32Array([0.2, 0.4, 0.6, 5000]);

function advance(sensors, seconds, hz, input) {
    for (let frame = 1; frame <= seconds * hz; frame++) {
        sensors.update(input, frame / hz);
    }
    return sensors;
}

test('constant machine state stays constant without render-loop randomness', () => {
    const originalRandom = Math.random;
    Math.random = () => { throw new Error('Sensor readout must not use random jitter'); };
    try {
        const sensors = new EnvironmentalSensors();
        advance(sensors, 4, 60, {
            volumes: new Float32Array(4),
            channelCount: 3,
            temperature: 55,
            isPlaying: true
        });
        assert.equal(sensors.voltage, 5.02);
        assert.equal(sensors.noiseDb, -74);
        assert.equal(sensors.bias, 0.82);
        assert.equal(sensors.energy, 0);
    } finally {
        Math.random = originalRandom;
    }
});

test('C64 model excludes the fourth telemetry slot containing the SID bus rate', () => {
    const withBusRate = new EnvironmentalSensors();
    const withoutBusRate = new EnvironmentalSensors();
    const input = {
        volumes: C64_VOICES,
        channelCount: 3,
        temperature: 55,
        isPlaying: true
    };
    advance(withBusRate, 8, 60, input);
    advance(withoutBusRate, 8, 60, {
        ...input,
        volumes: new Float32Array([0.2, 0.4, 0.6, 0])
    });

    assert.equal(withBusRate.energy, withoutBusRate.energy);
    assert.equal(withBusRate.voltage, withoutBusRate.voltage);
    assert.equal(withBusRate.noiseDb, withoutBusRate.noiseDb);
    assert.equal(withBusRate.bias, withoutBusRate.bias);
    assert.ok(Math.abs(withBusRate.energy - 0.4) < 1e-7);
    assert.ok(Math.abs(withBusRate.voltage - 4.972) < 1e-8);
    assert.ok(Math.abs(withBusRate.noiseDb - (-72.48)) < 1e-7);
    assert.ok(Math.abs(withBusRate.bias - 0.832) < 1e-6);
});

test('sensor response is time-based and independent of HUD refresh rate', () => {
    const at15Hz = new EnvironmentalSensors();
    const at60Hz = new EnvironmentalSensors();
    const input = {
        volumes: new Float32Array([0.8, 0.6, 0.4, 12000]),
        channelCount: 3,
        temperature: 65,
        isPlaying: true
    };
    advance(at15Hz, 4, 15, input);
    advance(at60Hz, 4, 60, input);

    assert.ok(Math.abs(at15Hz.energy - at60Hz.energy) < 1e-12);
    assert.ok(Math.abs(at15Hz.voltage - at60Hz.voltage) < 1e-6);
    assert.ok(Math.abs(at15Hz.noiseDb - at60Hz.noiseDb) < 1e-4);
    assert.ok(Math.abs(at15Hz.bias - at60Hz.bias) < 1e-4);
});

test('real level and temperature changes remain visible and settle plausibly', () => {
    const sensors = new EnvironmentalSensors();
    const active = {
        volumes: new Float32Array([1, 1, 1, 9000]),
        channelCount: 3,
        temperature: 75,
        isPlaying: true
    };
    advance(sensors, 0.2, 60, active);
    assert.ok(sensors.voltage < 5.0, 'supply sag should react within 200 ms');
    assert.ok(sensors.noiseDb > -73.5, 'noise readout should react within 200 ms');
    assert.ok(sensors.bias > 0.82, 'thermal bias drift should remain visible');

    advance(sensors, 7.8, 60, active);
    assert.ok(Math.abs(sensors.voltage - 4.88) < 1e-8);
    assert.ok(Math.abs(sensors.noiseDb - (-68.6)) < 1e-6);
    assert.ok(Math.abs(sensors.bias - 0.90) < 1e-5);

    advance(sensors, 8, 60, { ...active, temperature: 15, isPlaying: false });
    assert.ok(Math.abs(sensors.voltage - 5.06) < 1e-8);
    assert.ok(Math.abs(sensors.noiseDb - (-77.2)) < 1e-6);
    assert.ok(Math.abs(sensors.bias - 0.72) < 3e-5);
});

test('invalid telemetry is contained and reset restores the rest state', () => {
    const sensors = new EnvironmentalSensors();
    advance(sensors, 2, 60, {
        volumes: new Float32Array([NaN, Infinity, -4, 1e9]),
        channelCount: 3,
        temperature: NaN,
        isPlaying: true
    });
    assert.ok(Number.isFinite(sensors.voltage));
    assert.ok(Number.isFinite(sensors.noiseDb));
    assert.ok(Number.isFinite(sensors.bias));
    assert.ok(sensors.energy >= 0 && sensors.energy <= 1);

    sensors.reset();
    assert.equal(sensors.voltage, 5.02);
    assert.equal(sensors.noiseDb, -74);
    assert.equal(sensors.bias, 0.82);
    assert.equal(sensors.energy, 0);
    assert.equal(sensors.lastTime, null);
});
