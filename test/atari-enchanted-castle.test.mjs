import test from 'node:test';
import assert from 'node:assert/strict';

import {
    AtariEnchantedCastle,
    ATARI_ENCHANTED_CASTLE_PALETTE,
    MAX_MAGIC_BURSTS
} from '../js/visuals/dse/atari/enchanted-castle.js';
import { quantizeAtari9Bit, rgbToHex } from '../js/visuals/utils/hardware-constraints.js';
import { dseRegistry } from '../js/visuals/dse/registry.js';

const allowedColors = new Set(
    ATARI_ENCHANTED_CASTLE_PALETTE.map(hex => {
        // Parse hex to verify it matches quantizeAtari9Bit
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return rgbToHex(...quantizeAtari9Bit(r, g, b));
    })
);

function createContext(width, height) {
    const operations = [];
    return {
        fillStyle: '#000000',
        pattern: null,
        operations,
        createPattern() {
            return this.pattern;
        },
        fillRect(x, y, rectWidth, rectHeight) {
            assert.ok([x, y, rectWidth, rectHeight].every(Number.isFinite), 'rectangle values must be finite');
            assert.ok([x, y, rectWidth, rectHeight].every(Number.isInteger), 'rectangle geometry must use integer pixels');
            assert.ok(rectWidth > 0 && rectHeight > 0, 'rectangle sizes must be positive');
            assert.ok(
                x >= 0 && y >= 0 && x + rectWidth <= width && y + rectHeight <= height,
                `rectangle ${x},${y},${rectWidth},${rectHeight} must stay inside ${width}x${height}`
            );
            if (typeof this.fillStyle === 'string') {
                assert.ok(
                    allowedColors.has(this.fillStyle),
                    `color ${this.fillStyle} must be quantized Atari 9-bit RGB`
                );
            }
            operations.push({ x, y, width: rectWidth, height: rectHeight, color: this.fillStyle });
        }
    };
}

function makeMetrics(overrides = {}) {
    return {
        beat: [0],
        beatStarted: false,
        beatCount: 0,
        beatStrength: 0,
        beatLevel: 0,
        beatImpulse: [0],
        tensionPct: 0.35,
        ...overrides
    };
}

function renderBeat(strength, state = 'playing', tensionPct = 0.35, beatCount = 1) {
    const scene = new AtariEnchantedCastle();
    const ctx = createContext(320, 200);
    scene.render(ctx, 320, 200, 1.0, state, 0, makeMetrics({
        beatStarted: true,
        beatCount,
        beatStrength: strength,
        beatLevel: strength >= 2 / 3 ? 3 : strength >= 1 / 3 ? 2 : 1,
        beatImpulse: [strength],
        tensionPct
    }));
    return { scene, ctx };
}

test('1. Atari enchanted castle is registered exclusively as an Atari background', () => {
    const entry = dseRegistry.find(candidate => candidate.Class === AtariEnchantedCastle);
    assert.ok(entry, 'AtariEnchantedCastle must be in the registry');
    assert.deepEqual(entry.metadata.systems, ['atari'], 'system must be exclusively atari');
    assert.equal(entry.metadata.layer, 'background', 'layer must be background');
    assert.equal(entry.metadata.lifecycle, 'managed', 'lifecycle must be managed');
    assert.equal(entry.metadata.weight, 12, 'weight should match castle background class');
    assert.equal(entry.metadata.duration, 15.0, 'duration must be 15.0s');
    assert.equal(entry.metadata.climaxHold, 12.0, 'climaxHold must be 12.0s');
});

test('2. Palette uses at most 16 colors and all drawn colors are strictly quantized Atari 9-bit', () => {
    assert.ok(ATARI_ENCHANTED_CASTLE_PALETTE.length <= 16, 'palette must have at most 16 colors');

    // Verify every color in the palette is bit-identical to quantizeAtari9Bit
    for (const hex of ATARI_ENCHANTED_CASTLE_PALETTE) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const quantized = quantizeAtari9Bit(r, g, b);
        assert.equal(hex, rgbToHex(...quantized), `palette color ${hex} must match 9-bit quantization`);
    }

    const scene = new AtariEnchantedCastle();
    const ctx = createContext(320, 200);
    scene.render(ctx, 320, 200, 1.0, 'playing', 0, makeMetrics());
    assert.ok(ctx.operations.length > 0, 'scene must render operations');
    assert.ok(
        ctx.operations.every(op => allowedColors.has(op.color)),
        'all operations must use strictly quantized Atari 9-bit colors'
    );
});

test('3. Geometry is finite, integer, positive, and stays strictly inside the viewport', () => {
    const scene = new AtariEnchantedCastle();
    const ctx = createContext(320, 200);

    scene.render(ctx, 320, 200, 1.0, 'climax', 0, makeMetrics({
        beatStarted: true,
        beatCount: 1,
        beatStrength: 0.9,
        beatImpulse: [0.9],
        tensionPct: 0.95
    }));

    assert.ok(ctx.operations.length > 20);
    for (const op of ctx.operations) {
        assert.ok(Number.isInteger(op.x) && Number.isInteger(op.y));
        assert.ok(Number.isInteger(op.width) && Number.isInteger(op.height));
        assert.ok(op.width > 0 && op.height > 0);
        assert.ok(op.x >= 0 && op.y >= 0);
        assert.ok(op.x + op.width <= 320);
        assert.ok(op.y + op.height <= 200);
    }
});

test('4. Invalid viewports return safely; tiny viewports render without invalid canvas calls', () => {
    const scene = new AtariEnchantedCastle();

    // Invalid dimensions return early with zero operations
    for (const [w, h] of [[0, 200], [320, 0], [-1, 200], [NaN, 200], [Infinity, 200]]) {
        const ctx = createContext(320, 200);
        scene.render(ctx, w, h, 1.0, 'playing', 0, makeMetrics());
        assert.equal(ctx.operations.length, 0, `invalid dimensions ${w}x${h} must not draw`);
    }

    // Tiny viewports must render safely within their bounds
    for (const [w, h] of [[1, 1], [3, 1], [1, 3], [7, 7]]) {
        const ctx = createContext(w, h);
        scene.render(ctx, w, h, 1.0, 'playing', 0, makeMetrics());
        assert.ok(ctx.operations.length > 0, `tiny viewport ${w}x${h} should render`);
        for (const op of ctx.operations) {
            assert.ok(op.x >= 0 && op.y >= 0 && op.x + op.width <= w && op.y + op.height <= h);
        }
    }
});

test('5. Portrait, landscape, widescreen, and extreme aspect ratios remain completely valid', () => {
    const scene = new AtariEnchantedCastle();
    const viewports = [
        [112, 200],  // Mobile small portrait (320x568 equiv)
        [92, 200],   // Mobile tall portrait (390x844 equiv)
        [432, 200],  // Mobile landscape (844x390 equiv)
        [355, 200],  // Desktop 16:9 (1280x720 / 1920x1080 equiv)
        [474, 200],  // Ultrawide 21:9 (2560x1080 equiv)
        [600, 200],  // Extreme 3:1 widescreen
        [66, 200]    // Extreme 1:3 narrow strip
    ];

    for (const [w, h] of viewports) {
        const ctx = createContext(w, h);
        scene.render(ctx, w, h, 1.0, 'playing', 0, makeMetrics());
        assert.ok(ctx.operations.length > 0, `expected rendered scene for ${w}x${h}`);
        assert.ok(
            ctx.operations.every(op => op.x >= 0 && op.y >= 0 && op.x + op.width <= w && op.y + op.height <= h),
            `all drawing operations for ${w}x${h} must stay strictly within bounds`
        );
    }
});

test('6. beatStarted triggers bursts exactly once; a decaying or held beat envelope does not retrigger', () => {
    const scene = new AtariEnchantedCastle();
    const ctx = createContext(320, 200);

    // Initial beat trigger on beat 1
    scene.render(ctx, 320, 200, 1.0, 'playing', 0, makeMetrics({
        beatStarted: true,
        beatCount: 1,
        beatStrength: 0.9,
        beatImpulse: [0.9]
    }));
    assert.equal(scene.burstCursor, 1, 'first beat must allocate burst index 1');
    assert.equal(scene.bursts[0].active, true);

    // Frame with active/decaying envelope but beatStarted=false
    scene.render(ctx, 320, 200, 1.02, 'playing', 0.02, makeMetrics({
        beat: [0.8],
        beatStarted: false,
        beatCount: 1,
        beatStrength: 0.9,
        beatImpulse: [0.72]
    }));
    assert.equal(scene.burstCursor, 1, 'decaying beat envelope must not retrigger a new burst');

    // Same beatCount repeated with beatStarted=true must be deduplicated
    scene.render(ctx, 320, 200, 1.04, 'playing', 0.04, makeMetrics({
        beatStarted: true,
        beatCount: 1,
        beatStrength: 0.9,
        beatImpulse: [0.55]
    }));
    assert.equal(scene.burstCursor, 1, 'same beat count must not trigger another burst');

    // New beat count triggers exactly once
    scene.render(ctx, 320, 200, 1.06, 'playing', 0.06, makeMetrics({
        beatStarted: true,
        beatCount: 2,
        beatStrength: 0.8,
        beatImpulse: [0.8]
    }));
    assert.equal(scene.burstCursor, 2, 'subsequent beat count must trigger next burst');
});

test('7. Soft, medium, and hard beats produce measurably distinct effects (radius and particle count)', () => {
    const soft = renderBeat(0.2, 'playing', 0.35, 1).scene.bursts[0];
    const medium = renderBeat(0.5, 'playing', 0.35, 2).scene.bursts[1];
    const hard = renderBeat(0.9, 'playing', 0.35, 3).scene.bursts[2];

    assert.ok(
        soft.radiusFactor < medium.radiusFactor && medium.radiusFactor < hard.radiusFactor,
        `radiusFactor must be strictly graded: soft (${soft.radiusFactor}) < medium (${medium.radiusFactor}) < hard (${hard.radiusFactor})`
    );
    assert.ok(
        soft.particleCount < medium.particleCount && medium.particleCount < hard.particleCount,
        `particleCount must be strictly graded: soft (${soft.particleCount}) < medium (${medium.particleCount}) < hard (${hard.particleCount})`
    );
});

test('8. Tension and macro state noticeably alter burst choreography and density', () => {
    const playing = renderBeat(0.5, 'playing', 0.2, 2).scene.bursts[1];
    const climax = renderBeat(0.5, 'climax', 0.95, 2).scene.bursts[1];

    assert.notEqual(playing.pattern, climax.pattern, 'climax must alter firework/magic pattern');
    assert.ok(climax.radiusFactor > playing.radiusFactor, 'climax must produce larger bursts');

    // Afterglow must not ignite new bursts
    const scene = new AtariEnchantedCastle();
    const ctx = createContext(320, 200);
    scene.render(ctx, 320, 200, 1.0, 'afterglow', 0, makeMetrics({
        beatStarted: true,
        beatCount: 10,
        beatStrength: 0.9
    }));
    assert.equal(scene.burstCursor, 0, 'afterglow must not trigger new bursts');
});

test('9. Particle pool and concurrently active bursts remain strictly bounded', () => {
    const scene = new AtariEnchantedCastle();
    const ctx = createContext(320, 200);

    for (let count = 1; count <= 80; count++) {
        scene.render(ctx, 320, 200, 1.0 + count * 0.02, 'climax', count * 0.02, makeMetrics({
            beatStarted: true,
            beatCount: count,
            beatStrength: 0.9,
            tensionPct: 1.0
        }));
    }

    assert.equal(scene.bursts.length, MAX_MAGIC_BURSTS, 'burst pool must not grow');
});

test('10. Same-instance resize keeps running validly without unwanted resets', () => {
    const scene = new AtariEnchantedCastle();

    // Start in standard 320x200
    const ctx1 = createContext(320, 200);
    scene.render(ctx1, 320, 200, 1.0, 'playing', 0, makeMetrics({
        beatStarted: true,
        beatCount: 1,
        beatStrength: 0.8
    }));
    assert.equal(scene.burstCursor, 1);
    assert.equal(scene.bursts[0].active, true);
    const timeAfterFrame1 = scene.internalT;

    // Rotate to mobile portrait (92x200)
    const ctx2 = createContext(92, 200);
    scene.render(ctx2, 92, 200, 1.04, 'playing', 0.04, makeMetrics({
        beatStarted: false,
        beatCount: 1,
        beatStrength: 0.8
    }));
    assert.ok(scene.internalT > timeAfterFrame1, 'internal time must advance continuously');
    assert.equal(scene.burstCursor, 1, 'burst state must not be reset on resize');
    assert.ok(ctx2.operations.length > 0);

    // Rotate to ultrawide (474x200)
    const ctx3 = createContext(474, 200);
    scene.render(ctx3, 474, 200, 1.08, 'playing', 0.08, makeMetrics({
        beatStarted: true,
        beatCount: 2,
        beatStrength: 0.8
    }));
    assert.equal(scene.burstCursor, 2, 'new beat after resize triggers normally');
    assert.ok(ctx3.operations.length > 0);
});

test('11. Starting and stopping macro states execute dither fades cleanly', () => {
    const scene = new AtariEnchantedCastle();
    const ctx = createContext(320, 200);

    // Starting fade
    scene.render(ctx, 320, 200, 1.0, 'starting', 0.5, makeMetrics());
    assert.ok(ctx.operations.length > 0);

    // Stopping fade
    scene.render(ctx, 320, 200, 1.02, 'stopping', 0.5, makeMetrics());
    assert.ok(ctx.operations.length > 0);
});
