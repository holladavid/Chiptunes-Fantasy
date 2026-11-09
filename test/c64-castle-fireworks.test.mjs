import test from 'node:test';
import assert from 'node:assert/strict';

import { C64_PALETTE, rgbToHex } from '../js/visuals/utils/hardware-constraints.js';
import { C64CastleFireworks } from '../js/visuals/dse/c64/castle-fireworks.js';
import { dseRegistry } from '../js/visuals/dse/registry.js';

const allowedColors = new Set(C64_PALETTE.map(color => rgbToHex(...color)));

function createContext() {
    return {
        fillStyle: '#000000',
        operations: [],
        fillRect(x, y, width, height) {
            assert.ok([x, y, width, height].every(Number.isInteger), 'scene geometry must use integer pixels');
            assert.ok(width > 0 && height > 0, 'scene rectangles must have positive dimensions');
            assert.ok(x >= 0 && y >= 0 && x + width <= this.viewportWidth && y + height <= this.viewportHeight,
                'scene rectangles must stay inside the viewport');
            assert.ok(allowedColors.has(this.fillStyle), `color ${this.fillStyle} must be in the VIC-II palette`);
            this.operations.push({ x, y, width, height, color: this.fillStyle });
        },
        viewportWidth: 0,
        viewportHeight: 0
    };
}

function createMetrics(overrides = {}) {
    return {
        beat: [0, 0, 0, 0],
        beatStarted: false,
        beatCount: 0,
        beatStrength: 0,
        beatImpulse: [0],
        ...overrides
    };
}

test('C64 castle scene renders a full sky and keeps its foreground boundary in the viewport', () => {
    const scene = new C64CastleFireworks();
    const ctx = createContext();
    ctx.viewportWidth = 320;
    ctx.viewportHeight = 200;

    scene.render(ctx, 320, 200, 1, 'playing', 0, createMetrics());

    assert.ok(ctx.operations.some(({ x, y, width, height }) =>
        x === 0 && y === 0 && width === 320 && height === 200));
    assert.equal(scene.floorY, 110);
    assert.ok(ctx.operations.every(({ y, height }) => y + height <= 200));
});

test('fireworks are triggered by exact beats, not a lingering beat envelope', () => {
    const scene = new C64CastleFireworks();
    const ctx = createContext();
    ctx.viewportWidth = 320;
    ctx.viewportHeight = 200;

    scene.render(ctx, 320, 200, 1, 'playing', 0, createMetrics({
        beatStarted: true,
        beatCount: 2,
        beatStrength: 0.9
    }));
    assert.equal(scene.burstCursor, 1);
    assert.equal(scene.bursts[0].particleCount, 16);

    scene.render(ctx, 320, 200, 1.02, 'playing', 0.02, createMetrics({
        beat: [1, 1, 1, 1],
        beatCount: 2,
        beatStrength: 0.9
    }));
    assert.equal(scene.burstCursor, 1, 'a decaying beat envelope must not retrigger fireworks');

    scene.render(ctx, 320, 200, 1.04, 'climax', 0.04, createMetrics({
        beatStarted: true,
        beatCount: 3,
        beatStrength: 0.5
    }));
    assert.equal(scene.burstCursor, 2, 'climax fireworks should respond on every beat');
});

test('C64 scene remains valid on narrow, wide, and tiny viewports', () => {
    const scene = new C64CastleFireworks();
    for (const [width, height] of [[90, 200], [1000, 200], [1, 1]]) {
        const ctx = createContext();
        ctx.viewportWidth = width;
        ctx.viewportHeight = height;
        scene.render(ctx, width, height, 2, 'playing', 0, createMetrics());
        assert.ok(ctx.operations.length > 0);
    }

    const ctx = createContext();
    ctx.viewportWidth = 0;
    ctx.viewportHeight = 200;
    scene.render(ctx, 0, 200, 2.02, 'playing', 0, createMetrics());
    assert.equal(ctx.operations.length, 0);
});

test('castle fireworks are registered as a C64 background with a floor horizon', () => {
    const entry = dseRegistry.find(candidate => candidate.Class === C64CastleFireworks);
    assert.ok(entry);
    assert.deepEqual(entry.metadata.systems, ['c64']);
    assert.equal(entry.metadata.layer, 'background');
    assert.equal(new entry.Class().floorHorizon, 0.55);
});
