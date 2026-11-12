import test from 'node:test';
import assert from 'node:assert/strict';

import {
    AmigaCastleFireworks,
    AMIGA_CASTLE_FIREWORKS_PALETTE,
    MAX_FIREWORK_BURSTS
} from '../js/visuals/dse/amiga/castle-fireworks.js';
import { quantizeAmiga12Bit, rgbToHex } from '../js/visuals/utils/hardware-constraints.js';
import { dseRegistry } from '../js/visuals/dse/registry.js';

const BASE_PALETTE = [
    [0, 0, 0], [8, 8, 35], [12, 16, 61], [26, 16, 82],
    [54, 22, 92], [90, 29, 79], [123, 28, 58], [156, 41, 37],
    [90, 20, 30], [17, 13, 35], [32, 24, 55], [21, 18, 40],
    [39, 30, 61], [75, 52, 84], [70, 146, 193], [50, 205, 225],
    [243, 230, 167], [192, 210, 239], [255, 208, 79], [255, 127, 33],
    [230, 53, 60], [209, 73, 170], [67, 216, 157], [255, 255, 255],
    [64, 69, 105], [110, 122, 157], [28, 52, 104]
];
const allowedColors = new Set(BASE_PALETTE.map(color => rgbToHex(...quantizeAmiga12Bit(...color))));

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
            assert.ok(x >= 0 && y >= 0 && x + rectWidth <= width && y + rectHeight <= height,
                `rectangle ${x},${y},${rectWidth},${rectHeight} must stay inside ${width}x${height}`);
            if (typeof this.fillStyle === 'string') {
                assert.ok(allowedColors.has(this.fillStyle), `color ${this.fillStyle} must be quantized Amiga 12-bit RGB`);
            }
            operations.push({ x, y, width: rectWidth, height: rectHeight, color: this.fillStyle });
        }
    };
}

function metrics(overrides = {}) {
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
    const scene = new AmigaCastleFireworks();
    const ctx = createContext(455, 256);
    scene.render(ctx, 455, 256, 1, state, 0, metrics({
        beatStarted: true,
        beatCount,
        beatStrength: strength,
        beatLevel: strength >= 2 / 3 ? 3 : strength >= 1 / 3 ? 2 : 1,
        beatImpulse: [strength],
        tensionPct
    }));
    return { scene, ctx };
}

test('Amiga castle fireworks are registered only as an Amiga background', () => {
    const entry = dseRegistry.find(candidate => candidate.Class === AmigaCastleFireworks);
    assert.ok(entry);
    assert.deepEqual(entry.metadata.systems, ['amiga']);
    assert.equal(entry.metadata.layer, 'background');
    assert.equal(entry.metadata.lifecycle, 'managed');
    assert.ok(entry.metadata.weight > 0);
    assert.equal(entry.metadata.duration, 15);
});

test('the scene uses a bounded OCS palette generated through the shared quantizer', () => {
    assert.ok(AMIGA_CASTLE_FIREWORKS_PALETTE.length <= 32);
    assert.deepEqual(
        [...new Set(AMIGA_CASTLE_FIREWORKS_PALETTE)].sort(),
        [...allowedColors].sort()
    );

    const scene = new AmigaCastleFireworks();
    const ctx = createContext(455, 256);
    scene.render(ctx, 455, 256, 1, 'playing', 0, metrics());
    assert.ok(ctx.operations.length > 0);
    assert.ok(ctx.operations.every(operation => allowedColors.has(operation.color)));
});

test('responsive and extreme viewports keep all drawing operations valid, including resize reuse', () => {
    const scene = new AmigaCastleFireworks();
    const viewports = [
        [144, 256], [118, 256], [554, 256], [455, 256],
        [768, 256], [256, 768], [1, 1], [3, 1], [1, 3]
    ];

    for (let index = 0; index < viewports.length; index++) {
        const [width, height] = viewports[index];
        const ctx = createContext(width, height);
        scene.render(ctx, width, height, 1 + index / 50, 'playing', 0, metrics());
        assert.ok(ctx.operations.length > 0, `expected a rendered sky for ${width}x${height}`);
    }
});

test('invalid viewports return without issuing canvas operations', () => {
    const scene = new AmigaCastleFireworks();
    for (const [width, height] of [[0, 256], [455, 0], [-1, 256], [Number.NaN, 256], [Infinity, 256]]) {
        const ctx = createContext(455, 256);
        scene.render(ctx, width, height, 1, 'playing', 0, metrics());
        assert.equal(ctx.operations.length, 0);
    }
});

test('missing and invalid music metrics remain safe and cannot retrigger held onset events', () => {
    const scene = new AmigaCastleFireworks();
    const ctx = createContext(455, 256);
    scene.render(ctx, 455, 256, 1, 'playing', 0, undefined);
    assert.ok(ctx.operations.length > 0);

    scene.render(ctx, 455, 256, 1.02, 'climax', 0.02, {
        beatStarted: true,
        beatCount: Number.NaN,
        beatStrength: Number.NaN,
        beatLevel: 99,
        beatImpulse: [Number.NaN],
        tensionPct: Number.NaN
    });
    assert.equal(scene.burstCursor, 1);

    scene.render(ctx, 455, 256, 1.04, 'climax', 0.04, {
        beatStarted: true,
        beatStrength: Infinity,
        tensionPct: Infinity
    });
    assert.equal(scene.burstCursor, 1);
});

test('fireworks trigger once per exact beat and not from a held beat envelope', () => {
    const scene = new AmigaCastleFireworks();
    const ctx = createContext(455, 256);

    scene.render(ctx, 455, 256, 1, 'playing', 0, metrics({
        beatStarted: true,
        beatCount: 1,
        beatStrength: 0.9,
        beatImpulse: [0.9]
    }));
    assert.equal(scene.burstCursor, 1);
    assert.equal(scene.bursts[0].active, true);

    scene.render(ctx, 455, 256, 1.02, 'playing', 0.02, metrics({
        beat: [0.8],
        beatStarted: false,
        beatCount: 1,
        beatStrength: 0.9,
        beatImpulse: [0.6]
    }));
    assert.equal(scene.burstCursor, 1);

    scene.render(ctx, 455, 256, 1.04, 'playing', 0.04, metrics({
        beatStarted: true,
        beatCount: 1,
        beatStrength: 0.9
    }));
    assert.equal(scene.burstCursor, 1, 'a repeated beat number must not duplicate a burst');
});

test('soft, medium and hard beats produce visibly graded burst sizes and particle counts', () => {
    const soft = renderBeat(0.2).scene.bursts[0];
    const medium = renderBeat(0.5).scene.bursts[0];
    const hard = renderBeat(0.9).scene.bursts[0];

    assert.ok(soft.radiusFactor < medium.radiusFactor && medium.radiusFactor < hard.radiusFactor);
    assert.ok(soft.particleCount < medium.particleCount && medium.particleCount < hard.particleCount);
});

test('macro-state and tension alter burst choreography without growing pools or palettes', () => {
    const playing = renderBeat(0.5, 'playing', 0.2).scene.bursts[0];
    const climax = renderBeat(0.5, 'climax', 0.95).scene.bursts[0];
    assert.notEqual(playing.pattern, climax.pattern);
    assert.ok(climax.radiusFactor > playing.radiusFactor);

    const scene = new AmigaCastleFireworks();
    const ctx = createContext(455, 256);
    for (let count = 1; count <= 80; count++) {
        scene.render(ctx, 455, 256, 1 + count / 50, 'climax', count / 50, metrics({
            beatStarted: true,
            beatCount: count,
            beatStrength: 0.9,
            tensionPct: 1
        }));
    }
    assert.equal(scene.bursts.length, MAX_FIREWORK_BURSTS);
    assert.ok(scene.bursts.filter(burst => burst.active).length <= MAX_FIREWORK_BURSTS);
    assert.ok(scene.bursts.every(burst => burst.particleCount <= 13));
    assert.ok(scene.bursts.every(burst => burst.color < AMIGA_CASTLE_FIREWORKS_PALETTE.length));
});

test('starting and stopping use the shared ordered-dither fade helper', () => {
    const previousDocument = globalThis.document;
    const pattern = {};
    globalThis.document = {
        createElement() {
            return {
                width: 0,
                height: 0,
                getContext() {
                    return { fillStyle: '', fillRect() {}, createPattern: () => pattern };
                }
            };
        }
    };

    try {
        const scene = new AmigaCastleFireworks();
        const ctx = createContext(455, 256);
        ctx.pattern = pattern;
        scene.render(ctx, 455, 256, 1, 'starting', 0.75, metrics());
        assert.ok(ctx.operations.some(operation => operation.color === pattern));

        const stopContext = createContext(455, 256);
        stopContext.pattern = pattern;
        scene.render(stopContext, 455, 256, 1.02, 'stopping', 0.75, metrics());
        assert.ok(stopContext.operations.some(operation => operation.color === pattern));
    } finally {
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
    }
});

test('same-instance rotation and repeated inputs remain deterministic', () => {
    const first = new AmigaCastleFireworks();
    const second = new AmigaCastleFireworks();
    const outputs = [];
    for (const [frame, [width, height]] of [
        [0, [144, 256]], [1, [554, 256]], [2, [144, 256]]
    ]) {
        const firstContext = createContext(width, height);
        const secondContext = createContext(width, height);
        const frameMetrics = metrics({
            beatStarted: frame === 1,
            beatCount: frame,
            beatStrength: frame === 1 ? 0.5 : 0,
            beatImpulse: [frame === 1 ? 0.5 : 0]
        });
        first.render(firstContext, width, height, frame / 50, 'playing', 0, frameMetrics);
        second.render(secondContext, width, height, frame / 50, 'playing', 0, frameMetrics);
        assert.deepEqual(firstContext.operations, secondContext.operations);
        outputs.push(firstContext.operations.length);
    }
    assert.ok(outputs.every(count => count > 0));
});
