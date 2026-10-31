import test from 'node:test';
import assert from 'node:assert/strict';

import { Copperbars } from '../js/visuals/dse/universal/copperbars.js';

function createContext() {
    return {
        fillStyle: '#000000',
        hash: 2166136261,
        operations: 0,
        fillRect(x, y, width, height) {
            assert.ok(Number.isFinite(x) && Number.isFinite(y), 'Bar coordinates must remain finite');
            assert.ok(Number.isFinite(width) && Number.isFinite(height), 'Bar sizes must remain finite');
            assert.ok(width > 0 && height > 0, 'Bars must have a positive size');
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
        beatStarted: false,
        beatCount: 0,
        smooth: [0.7, 0.55, 0.4, 0.3],
        tensionPct: 0.5,
        rawEnergyState: 'playing',
        ...overrides
    };
}

test('Copperbars changes formations only on exact fourth-beat events', () => {
    const bars = new Copperbars();
    const ctx = createContext();

    bars.render(ctx, 320, 200, 1, 'playing', 0, createMetrics('c64', {
        beatStarted: true, beatCount: 1
    }));
    assert.equal(bars.pattern, 0);
    assert.equal(bars.palettePhase, 0);

    bars.render(ctx, 320, 200, 1.02, 'playing', 0.02, createMetrics('c64', {
        beatStarted: true, beatCount: 4
    }));
    assert.equal(bars.pattern, 1);
    assert.equal(bars.palettePhase, 1);

    bars.render(ctx, 320, 200, 1.04, 'playing', 0.04, createMetrics('c64', {
        beat: [1, 1, 1, 1], beatStarted: false, beatCount: 4
    }));
    assert.equal(bars.pattern, 1, 'The beat envelope must not retrigger a formation');
    assert.equal(bars.palettePhase, 1);

    bars.render(ctx, 320, 200, 1.06, 'afterglow', 12, createMetrics('c64', {
        tensionPct: 0.2
    }));
    assert.equal(bars.stateAge, 0, 'Afterglow needs a local transition timestamp');
    assert.equal(bars.barsToDraw[0].pal, bars.c64Palettes[0]);
    assert.equal(bars.barsToDraw[0].intensity, 0.4);
});

test('Copperbars remains deterministic across systems and macro states', () => {
    for (const system of ['c64', 'amiga', 'atari']) {
        const first = new Copperbars();
        const second = new Copperbars();
        const firstCtx = createContext();
        const secondCtx = createContext();

        for (let frame = 0; frame < 600; frame++) {
            const beatStarted = frame % 10 === 0;
            const metrics = createMetrics(system, {
                beat: [beatStarted ? 1 : 0.2, 0, 0, 0],
                beatStarted,
                beatCount: Math.floor(frame / 10) + 1,
                tensionPct: frame < 450 ? 0.8 : Math.max(0, 1 - (frame - 450) / 150)
            });
            const state = frame < 150 ? 'playing' : frame < 300 ? 'buildup' : frame < 450 ? 'climax' : 'afterglow';
            const t = 1 + frame / 50;
            first.render(firstCtx, 320, 200, t, state, 3 + frame / 50, metrics);
            second.render(secondCtx, 320, 200, t, state, 3 + frame / 50, metrics);
        }

        assert.equal(firstCtx.hash, secondCtx.hash, `${system} render sequences must match`);
        assert.equal(first.pattern, second.pattern, `${system} formations must match`);
        assert.ok(firstCtx.operations > 1000, `${system} must actually draw raster bars`);
    }
});
