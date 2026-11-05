import test from 'node:test';
import assert from 'node:assert/strict';

import { BEAT_LEVEL } from '../js/visuals/dj/track-monitor.js';
import { StageManager } from '../js/visuals/dj/stage-manager.js';
import {
    GRADED_BEAT_STRENGTHS,
    makeMetrics
} from '../tools/dse-baseline/harness.js';

function createDynamics(overrides = {}) {
    return {
        masterEnergy: new Float32Array(1),
        transientPulse: new Float32Array(1),
        beatEnvelope: new Float32Array(1),
        beatImpulse: new Float32Array(1),
        channelSmooth: new Float32Array(4),
        rawEnergyState: 'playing',
        beatStarted: false,
        beatCount: 0,
        beatStrength: 0,
        beatLevel: BEAT_LEVEL.NONE,
        ...overrides
    };
}

function createRenderTarget() {
    const renders = [];
    const dse = {
        state: 'playing',
        render(ctx, width, height, t, state, stateTime, metrics) {
            renders.push({
                beatStarted: metrics.beatStarted,
                beatCount: metrics.beatCount,
                beatStrength: metrics.beatStrength,
                beatLevel: metrics.beatLevel,
                beatImpulse: metrics.beatImpulse[0],
                impulseBuffer: metrics.beatImpulse
            });
        }
    };
    const stage = new StageManager();
    stage.activeDSEs.push(dse);
    stage.frameCaches.set(dse, {
        canvas: { width: 8, height: 8 },
        ctx: { globalAlpha: 1, imageSmoothingEnabled: false, clearRect() {} },
        tick: null,
        state: null,
        system: null
    });
    return {
        stage,
        renders,
        targetCtx: { imageSmoothingEnabled: false, drawImage() {} }
    };
}

test('StageManager forwards exact graded onset and decay metrics without retriggering', () => {
    const { stage, renders, targetCtx } = createRenderTarget();
    const impulse = Float32Array.from([0.55]);
    const dynamics = createDynamics({
        beatEnvelope: Float32Array.from([1]),
        beatImpulse: impulse,
        beatStarted: true,
        beatCount: 7,
        beatStrength: 0.55,
        beatLevel: BEAT_LEVEL.MEDIUM
    });
    const metrics = {};

    stage.renderAll(targetCtx, 8, 8, 0, dynamics, { system: 'c64' }, metrics);
    assert.equal(metrics.beatStrength, 0.55);
    assert.equal(metrics.beatLevel, BEAT_LEVEL.MEDIUM);
    assert.equal(metrics.beatImpulse, impulse, 'The monitor buffer must be forwarded directly');

    dynamics.beatStarted = false;
    dynamics.beatEnvelope[0] = 0.5;
    dynamics.beatImpulse[0] = 0.275;
    stage.renderAll(targetCtx, 8, 8, 1 / 50, dynamics, { system: 'c64' }, metrics);

    assert.deepEqual(renders.map(({ impulseBuffer, ...snapshot }) => snapshot), [
        {
            beatStarted: true,
            beatCount: 7,
            beatStrength: 0.55,
            beatLevel: BEAT_LEVEL.MEDIUM,
            beatImpulse: Float32Array.from([0.55])[0]
        },
        {
            beatStarted: false,
            beatCount: 7,
            beatStrength: 0.55,
            beatLevel: BEAT_LEVEL.MEDIUM,
            beatImpulse: Float32Array.from([0.275])[0]
        }
    ]);
    assert.equal(renders[0].impulseBuffer, impulse);
    assert.equal(renders[1].impulseBuffer, impulse);
});

test('legacy metrics retain full-strength beats with a reusable impulse fallback', () => {
    const { stage, renders, targetCtx } = createRenderTarget();
    const dynamics = createDynamics({ beatEnvelope: Float32Array.from([0.75]) });
    delete dynamics.beatStrength;
    delete dynamics.beatLevel;
    delete dynamics.beatImpulse;
    const metrics = {};

    stage.renderAll(targetCtx, 8, 8, 0, dynamics, { system: 'c64' }, metrics);
    assert.equal(metrics.beatStrength, 1);
    assert.equal(metrics.beatLevel, BEAT_LEVEL.HARD);
    assert.equal(metrics.beatImpulse[0], 0.75);
    assert.equal(metrics.beatImpulse, stage.legacyBeatImpulse);

    dynamics.beatEnvelope[0] = 0.25;
    stage.renderAll(targetCtx, 8, 8, 1 / 50, dynamics, { system: 'c64' }, metrics);
    assert.equal(metrics.beatImpulse, stage.legacyBeatImpulse);
    assert.equal(metrics.beatImpulse[0], 0.25);
    assert.equal(renders[1].beatStarted, false);
});

test('invalid graded fields fall back to finite compatible values', () => {
    const { stage, targetCtx } = createRenderTarget();
    const dynamics = createDynamics({
        beatEnvelope: Float32Array.from([0.4]),
        beatImpulse: Float32Array.from([Number.NaN]),
        beatStrength: Number.NaN,
        beatLevel: 99
    });
    const metrics = {};

    stage.renderAll(targetCtx, 8, 8, 0, dynamics, { system: 'c64' }, metrics);
    assert.equal(metrics.beatStrength, 1);
    assert.equal(metrics.beatLevel, BEAT_LEVEL.HARD);
    assert.ok(Math.abs(metrics.beatImpulse[0] - 0.4) < 1e-6);

    dynamics.beatStrength = 0.2;
    dynamics.beatLevel = Number.NaN;
    dynamics.beatImpulse = Float32Array.from([0.08]);
    stage.renderAll(targetCtx, 8, 8, 1 / 50, dynamics, { system: 'c64' }, metrics);
    assert.equal(metrics.beatStrength, 0.2);
    assert.equal(metrics.beatLevel, BEAT_LEVEL.SOFT);
    assert.ok(Math.abs(metrics.beatImpulse[0] - 0.08) < 1e-6);
});

test('baseline harness creates deterministic soft, medium and hard onset/decay inputs', () => {
    const expectedLevels = {
        soft: BEAT_LEVEL.SOFT,
        medium: BEAT_LEVEL.MEDIUM,
        hard: BEAT_LEVEL.HARD
    };

    for (const [mode, level] of Object.entries(expectedLevels)) {
        const onset = makeMetrics('c64', 'playing', 0, mode);
        const repeated = makeMetrics('c64', 'playing', 0, mode);
        const decay = makeMetrics('c64', 'playing', 1, mode);
        const strength = GRADED_BEAT_STRENGTHS[mode];

        assert.deepEqual(onset, repeated, `${mode} inputs must be reproducible`);
        assert.equal(onset.beatStarted, true);
        assert.equal(onset.beatStrength, strength);
        assert.equal(onset.beatLevel, level);
        assert.ok(onset.beatImpulse instanceof Float32Array);
        assert.ok(Math.abs(onset.beatImpulse[0] - onset.beat[0] * strength) < 1e-6);

        assert.equal(decay.beatStarted, false, 'Decay must not retrigger the beat event');
        assert.equal(decay.beatCount, onset.beatCount);
        assert.equal(decay.beatStrength, strength);
        assert.equal(decay.beatLevel, level);
        assert.ok(decay.beatImpulse[0] > 0);
        assert.ok(decay.beatImpulse[0] < onset.beatImpulse[0]);
    }

    const zero = makeMetrics('c64', 'playing', 0, 'zero');
    assert.equal(zero.beatStarted, false);
    assert.equal(zero.beatStrength, 0);
    assert.equal(zero.beatLevel, BEAT_LEVEL.NONE);
    assert.equal(zero.beatImpulse[0], 0);
});
