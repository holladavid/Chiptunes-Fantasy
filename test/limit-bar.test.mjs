import test from 'node:test';
import assert from 'node:assert/strict';

import { LimitBar } from '../js/visuals/dse/universal/limit-bar.js';
import { dseRegistry } from '../js/visuals/dse/registry.js';

function createContext(recordRects = true) {
    return {
        fillStyle: '#000000',
        hash: 2166136261,
        operations: 0,
        rects: [],
        fillRect(x, y, width, height) {
            assert.ok(Number.isFinite(x) && Number.isFinite(y), 'Bar coordinates must remain finite');
            assert.ok(Number.isFinite(width) && Number.isFinite(height), 'Bar sizes must remain finite');
            assert.ok(width > 0 && height > 0, 'Drawn rectangles must have a positive size');
            assert.ok(Number.isInteger(x) && Number.isInteger(y)
                && Number.isInteger(width) && Number.isInteger(height),
            'LimitBar must rasterize exclusively on integer coordinates');
            const rect = { color: this.fillStyle, x, y, width, height };
            if (!this.firstRect) this.firstRect = rect;
            if (recordRects) this.rects.push(rect);
            this.operations++;
            const signature = `${this.fillStyle}:${x},${y},${width},${height};`;
            for (let i = 0; i < signature.length; i++) {
                this.hash ^= signature.charCodeAt(i);
                this.hash = Math.imul(this.hash, 16777619);
            }
        }
    };
}

function createMetrics(system, overrides = {}) {
    return {
        system,
        beat: [0, 0, 0, 0],
        beatImpulse: [0],
        beatStrength: 0,
        beatLevel: 0,
        beatStarted: false,
        beatCount: 0,
        tensionPct: 0.8,
        rawEnergyState: 'climax',
        isClimaxLocked: true,
        climaxTimer: 1,
        climaxHoldTime: 12,
        ...overrides
    };
}

function renderIntensity(system, strength, overrides = {}) {
    const bar = new LimitBar();
    const ctx = createContext();
    bar.render(ctx, 320, 200, 1, 'climax', 3, createMetrics(system, {
        beat: [1, 0, 0, 0],
        beatImpulse: [strength],
        beatStrength: strength,
        beatStarted: true,
        beatCount: 1,
        tensionPct: 1,
        ...overrides
    }));
    return { bar, ctx };
}

test('LimitBar remains disabled in the DSE registry', () => {
    const entries = dseRegistry.filter(entry => entry.Class === LimitBar);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].metadata.isDisabled, true);
    assert.equal(entries[0].metadata.lifecycle, 'permanent');
    assert.equal(entries[0].metadata.layer, 'overlay');
});

test('LimitBar makes soft, medium and hard impulses visibly distinct on every system', () => {
    for (const system of ['c64', 'amiga', 'atari']) {
        const responses = [0.2, 0.5, 0.9].map(strength => renderIntensity(system, strength));
        assert.equal(new Set(responses.map(response => response.ctx.hash)).size, 3,
            `${system} soft/medium/hard frames must be visibly distinct`);
        assert.ok(responses.every(response => response.ctx.operations > 0),
            `${system} must actually draw its tension bar`);
    }
});

test('LimitBar grades the C64 raster border and Amiga sweep by impulse strength', () => {
    const c64Responses = [0.2, 0.5, 0.9].map(strength => renderIntensity('c64', strength));
    assert.ok(c64Responses[0].ctx.firstRect.width < c64Responses[1].ctx.firstRect.width
        && c64Responses[1].ctx.firstRect.width < c64Responses[2].ctx.firstRect.width,
    'C64 raster borders must become thicker with beat strength');

    const amigaResponses = [0.2, 0.5, 0.9].map(strength => renderIntensity('amiga', strength));
    const sweepWidths = amigaResponses.map(response =>
        response.ctx.rects.find(rect => rect.color === '#ffffff').width);
    assert.deepEqual(sweepWidths, [10, 12, 16]);
});

test('LimitBar uses the legacy beat envelope when impulse metrics are absent', () => {
    for (const system of ['c64', 'amiga', 'atari']) {
        const legacy = new LimitBar();
        const graded = new LimitBar();
        const legacyCtx = createContext();
        const gradedCtx = createContext();
        const beat = 0.55;

        legacy.render(legacyCtx, 320, 200, 1, 'climax', 3, createMetrics(system, {
            beat: [beat, 0, 0, 0],
            beatImpulse: undefined
        }));
        graded.render(gradedCtx, 320, 200, 1, 'climax', 3, createMetrics(system, {
            beat: [beat, 0, 0, 0],
            beatImpulse: [beat]
        }));

        assert.equal(gradedCtx.hash, legacyCtx.hash, `${system} fallback must match the impulse path`);
    }
});

test('LimitBar impulse rendering does not depend on a new beat event', () => {
    for (const system of ['c64', 'amiga', 'atari']) {
        const onset = renderIntensity(system, 0.5, { beatStarted: true });
        const decay = renderIntensity(system, 0.5, { beatStarted: false, beat: [0.5, 0, 0, 0] });
        assert.equal(decay.ctx.hash, onset.ctx.hash,
            `${system} retained impulse values must not trigger a separate response`);
    }
});

test('LimitBar remains deterministic across systems and macro states', () => {
    for (const system of ['c64', 'amiga', 'atari']) {
        const first = new LimitBar();
        const second = new LimitBar();
        const firstCtx = createContext(false);
        const secondCtx = createContext(false);

        for (let frame = 0; frame < 600; frame++) {
            const beatStarted = frame % 10 === 0;
            const envelope = beatStarted ? 1 : 0.2;
            const state = frame < 150 ? 'playing' : frame < 300 ? 'buildup' : frame < 450 ? 'climax' : 'afterglow';
            const metrics = createMetrics(system, {
                beat: [envelope, 0, 0, 0],
                beatImpulse: [envelope * 0.55],
                beatStrength: 0.55,
                beatLevel: 2,
                beatStarted,
                beatCount: Math.floor(frame / 10) + 1,
                tensionPct: frame < 450 ? 0.8 : Math.max(0, 1 - (frame - 450) / 150),
                rawEnergyState: state,
                isClimaxLocked: state === 'climax'
            });
            const t = 1 + frame / 50;
            first.render(firstCtx, 320, 200, t, state, 3 + frame / 50, metrics);
            second.render(secondCtx, 320, 200, t, state, 3 + frame / 50, metrics);
        }

        assert.equal(firstCtx.hash, secondCtx.hash, `${system} render sequences must match`);
        assert.equal(first.displayAlpha, second.displayAlpha, `${system} transitions must match`);
        assert.ok(firstCtx.operations > 1000, `${system} must actually draw its effects`);
    }
});
