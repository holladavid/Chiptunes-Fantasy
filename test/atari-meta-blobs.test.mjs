import test from 'node:test';
import assert from 'node:assert/strict';

import { AtariMetaBlobs } from '../js/visuals/dse/atari/meta-blobs.js';
import { COOL, INK, RAMPS, WHITE } from '../js/visuals/dse/atari/atari-kit.js';
import { dseRegistry } from '../js/visuals/dse/registry.js';

function isValidAtari9BitHex(hex) {
    if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) return false;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b].every(v => v >= 0 && v <= 252 && v % 36 === 0);
}

function createStrictContext(width, height) {
    const ops = [];
    const scanlineColors = Array.from({ length: height }, () => new Set());
    const deny = name => () => {
        throw new Error(`Forbidden Canvas API called: ${name}`);
    };

    const ctx = {
        fillStyle: '#000000',
        ops,
        scanlineColors,
        fillText: deny('fillText'),
        measureText: deny('measureText'),
        save: deny('save'),
        clip: deny('clip'),
        getImageData: deny('getImageData'),
        putImageData: deny('putImageData'),
        fillRect(x, y, rw, rh) {
            assert.ok([x, y, rw, rh].every(Number.isFinite), 'coords/sizes must be finite');
            assert.ok([x, y, rw, rh].every(Number.isInteger), 'coords/sizes must be integers');
            assert.ok(rw > 0 && rh > 0, 'rect width and height must be positive');
            assert.ok(
                x >= 0 && y >= 0 && x + rw <= width && y + rh <= height,
                `rect (${x},${y},${rw},${rh}) out of bounds ${width}x${height}`
            );
            assert.ok(
                isValidAtari9BitHex(this.fillStyle),
                `color ${this.fillStyle} is not valid 9-bit Atari ST RGB`
            );
            assert.notEqual(this.fillStyle.toLowerCase(), '#ffffff');
            for (let py = y; py < y + rh; py++) {
                scanlineColors[py].add(this.fillStyle);
            }
            ops.push({ x, y, w: rw, h: rh, color: this.fillStyle });
        }
    };

    Object.defineProperty(ctx, 'globalAlpha', {
        get() { return 1; },
        set() { throw new Error('Forbidden globalAlpha assignment'); }
    });

    return ctx;
}

function makeMetrics(overrides = {}) {
    return {
        energy: 0.45,
        pulse: 0,
        beat: [0],
        beatImpulse: [0],
        beatStarted: false,
        beatCount: 0,
        beatStrength: 0,
        beatLevel: 0,
        smooth: [0.3, 0.25, 0.2],
        tensionPct: 0.30,
        system: 'atari',
        ...overrides
    };
}

function computeCellGridCount(w, h) {
    let cell = Math.max(3, Math.ceil(Math.sqrt((w * h) / 5000)));
    while (Math.ceil(w / cell) * Math.ceil(h / cell) > 5000) cell++;
    return Math.ceil(w / cell) * Math.ceil(h / cell);
}

test('1. AtariMetaBlobs is registered exclusively as an Atari background with exact metadata', () => {
    const entry = dseRegistry.find(e => e.Class === AtariMetaBlobs);
    assert.ok(entry, 'AtariMetaBlobs must be registered in dseRegistry');
    assert.deepEqual(entry.metadata.systems, ['atari']);
    assert.equal(entry.metadata.layer, 'background');
    assert.equal(entry.metadata.lifecycle, 'managed');
    assert.equal(entry.metadata.weight, 12);
    assert.equal(entry.metadata.duration, 13.0);
    assert.equal(entry.metadata.climaxHold, 12.0);
    assert.equal(entry.metadata.isDisabled, false);
    assert.equal(entry.metadata.isExclusive, false);
});

test('2. Cell count <= 5000 across viewports, 9-bit palette & <= 14 colors/scanline even mid-wipe', () => {
    const viewports = [
        [112, 200], [92, 200], [432, 200], [355, 200], [474, 200], [600, 200], [66, 200]
    ];

    for (const [w, h] of viewports) {
        assert.ok(computeCellGridCount(w, h) <= 5000, `${w}x${h} cell count exceeded 5000`);
    }

    const dse = new AtariMetaBlobs();
    const w = 355, h = 200;

    // Advance to 8th beat to trigger Timer-B Raster-Wipe
    for (let c = 1; c <= 8; c++) {
        dse.render(createStrictContext(w, h), w, h, 1 + c * 0.2, 'climax', 2.0, makeMetrics({
            tensionPct: 0.95,
            smooth: [0.8, 0.7, 0.6],
            beatStarted: true,
            beatCount: c,
            beatStrength: 0.9,
            beatLevel: 3,
            beatImpulse: [0.9]
        }));
    }

    // Mid-wipe frame
    const midCtx = createStrictContext(w, h);
    dse.render(midCtx, w, h, 2.8, 'climax', 2.2, makeMetrics({
        tensionPct: 0.95,
        smooth: [0.8, 0.7, 0.6],
        beatImpulse: [0.7]
    }));

    const frameColors = new Set(midCtx.ops.map(o => o.color));
    assert.ok(frameColors.size <= 16);
    for (let y = 0; y < h; y++) {
        assert.ok(
            midCtx.scanlineColors[y].size <= 14,
            `scanline ${y} used ${midCtx.scanlineColors[y].size} colors (> 14)`
        );
    }
});

test('3. Smoke, idle, missing metrics, invalid/tiny viewports and animation without audio', () => {
    const dse = new AtariMetaBlobs();

    for (const [w, h] of [[0, 200], [320, 0], [-4, 200], [NaN, 200], [Infinity, 200]]) {
        const ctx = createStrictContext(320, 200);
        dse.render(ctx, w, h, 1.0, 'playing', 1.0, makeMetrics());
        assert.equal(ctx.ops.length, 0);
    }

    const idleCtx = createStrictContext(320, 200);
    dse.render(idleCtx, 320, 200, 1.0, 'idle', 0, makeMetrics());
    assert.equal(idleCtx.ops.length, 0);

    for (const [w, h] of [[1, 1], [3, 1], [1, 3], [7, 7]]) {
        const ctx = createStrictContext(w, h);
        dse.render(ctx, w, h, 1.0, 'playing', 1.0, undefined);
        assert.ok(ctx.ops.length > 0);
    }

    // Silent input without smooth/beats still animates over t
    const silent = new AtariMetaBlobs();
    const ctx1 = createStrictContext(320, 200);
    const ctx2 = createStrictContext(320, 200);
    silent.render(ctx1, 320, 200, 1.0, 'playing', 1.0, {});
    silent.render(ctx2, 320, 200, 2.0, 'playing', 2.0, {});
    assert.notDeepEqual(ctx1.ops, ctx2.ops, 'silent blobs must stay alive over t');
});

test('4. Determinism over 300 frames with identical input sequence', () => {
    const a = new AtariMetaBlobs();
    const b = new AtariMetaBlobs();
    const w = 355, h = 200;

    for (let f = 0; f < 300; f++) {
        const ctxA = createStrictContext(w, h);
        const ctxB = createStrictContext(w, h);
        const t = 1 + f * 0.02;
        const state = f < 40 ? 'starting' : f < 130 ? 'playing' : f < 200 ? 'buildup' : f < 250 ? 'climax' : 'afterglow';
        const onBeat = f % 12 === 0;
        const m = makeMetrics({
            beatStarted: onBeat,
            beatCount: Math.floor(f / 12) + 1,
            beatStrength: onBeat ? 0.55 : 0,
            beatLevel: onBeat ? 2 : 0,
            beatImpulse: [Math.max(0, 0.55 - (f % 12) * 0.08)],
            tensionPct: state === 'climax' ? 0.95 : state === 'buildup' ? 0.65 : 0.30,
            smooth: [0.3 + 0.4 * Math.sin(f * 0.08), 0.5, 0.2]
        });
        a.render(ctxA, w, h, t, state, f * 0.02, m);
        b.render(ctxB, w, h, t, state, f * 0.02, m);
        assert.deepEqual(ctxA.ops, ctxB.ops, `frame ${f} differed`);
    }
});

test('5. Discrete events trigger only on beatStarted; 4th/8th beat orbitShape/setIdx/orbitSign rules', () => {
    const dse = new AtariMetaBlobs();
    const w = 320, h = 200;

    for (let c = 1; c <= 3; c++) {
        dse.render(createStrictContext(w, h), w, h, 1 + c * 0.2, 'buildup', 1, makeMetrics({
            beatStarted: true, beatCount: c, beatStrength: 0.5, beatLevel: 2
        }));
    }
    assert.equal(dse.orbitShape, 0);
    assert.equal(dse.setIdx, 0);

    // Envelope without beatStarted must not change repel, medTimer, pop, orbitShape, setIdx
    dse.repel = 0;
    dse.medTimer = 0;
    dse.pop.fill(1.0);
    for (let i = 1; i <= 5; i++) {
        dse.render(createStrictContext(w, h), w, h, 1.6 + i * 0.02, 'buildup', 1, makeMetrics({
            beat: [0.95],
            beatStarted: false,
            beatCount: 3,
            beatStrength: 0.95,
            beatLevel: 3,
            beatImpulse: [0.9]
        }));
    }
    assert.equal(dse.repel, 0);
    assert.equal(dse.medTimer, 0);
    assert.deepEqual(Array.from(dse.pop), [1, 1, 1]);
    assert.equal(dse.orbitShape, 0);

    // 4th beat switches orbitShape
    dse.render(createStrictContext(w, h), w, h, 1.8, 'buildup', 1, makeMetrics({
        beatStarted: true, beatCount: 4, beatStrength: 0.5, beatLevel: 2
    }));
    assert.equal(dse.orbitShape, 1);
    assert.equal(dse.setIdx, 0);

    // 8th beat switches orbitShape, flips orbitSign, and wipes setIdx
    for (let c = 5; c <= 8; c++) {
        dse.render(createStrictContext(w, h), w, h, 2.0 + c * 0.2, 'buildup', 1, makeMetrics({
            beatStarted: true, beatCount: c, beatStrength: 0.5, beatLevel: 2
        }));
    }
    assert.equal(dse.orbitShape, 2);
    assert.equal(dse.orbitSign, -1);
    assert.equal(dse.setIdx, 1);
});

test('6. Soft, medium and hard beats differ measurably and obey hard cooldown', () => {
    const w = 320, h = 200;

    const runLevel = (strength, level) => {
        const dse = new AtariMetaBlobs();
        const ctx = createStrictContext(w, h);
        dse.render(ctx, w, h, 1.0, 'playing', 1.0, makeMetrics({
            tensionPct: 0.30,
            smooth: [0.2, 0.9, 0.1],
            beatStarted: strength > 0,
            beatCount: strength > 0 ? 1 : 0,
            beatStrength: strength,
            beatLevel: level,
            beatImpulse: [strength]
        }));
        const whiteArea = ctx.ops
            .filter(o => o.color === WHITE)
            .reduce((sum, o) => sum + o.w * o.h, 0);
        return { dse, whiteArea };
    };

    const zero = runLevel(0, 0);
    const soft = runLevel(0.20, 1);
    const medium = runLevel(0.50, 2);
    const hard = runLevel(0.90, 3);

    assert.equal(zero.dse.repel, 0);
    assert.equal(zero.dse.medTimer, 0);
    assert.equal(zero.whiteArea, 0);

    assert.equal(soft.dse.repel, 1.0);
    assert.equal(soft.dse.medTimer, 0);
    assert.equal(soft.whiteArea, 0);

    assert.equal(medium.dse.repel, 0);
    assert.equal(medium.dse.medTimer, 0.15);
    assert.equal(medium.whiteArea, 0);

    assert.ok(Math.abs(hard.dse.pop[1] - 1.6) < 1e-5, 'hard pops highest channel ball (ch 1) to 1.6');
    assert.ok(hard.whiteArea > 0, 'hard highlights Level-3 band in WHITE');

    // Second hard beat within 0.25s is gated by cooldown
    hard.dse.pop.fill(1.0);
    hard.dse.render(createStrictContext(w, h), w, h, 1.1, 'playing', 1.1, makeMetrics({
        smooth: [0.2, 0.9, 0.1],
        beatStarted: true, beatCount: 2, beatStrength: 0.90, beatLevel: 3
    }));
    assert.equal(hard.dse.pop[1], 1.0, 'hard cooldown blocks retrigger within 0.25s');
});

test('7. Hue follows dominant ball (isolated channel ch(2) = 1 -> BLU5)', () => {
    const dse = new AtariMetaBlobs();
    const w = 320, h = 200;
    const ctx = createStrictContext(w, h);

    dse.render(ctx, w, h, 1.0, 'playing', 1.0, makeMetrics({
        tensionPct: 0.30,
        smooth: [0, 0, 1]
    }));

    const areaOf = ramp => {
        const set = new Set(ramp.slice(1));
        return ctx.ops.filter(o => set.has(o.color)).reduce((s, o) => s + o.w * o.h, 0);
    };

    const redArea = areaOf(RAMPS.RED5);
    const grnArea = areaOf(RAMPS.GRN5);
    const bluArea = areaOf(RAMPS.BLU5);

    assert.ok(bluArea > redArea && bluArea > grnArea,
        `expected BLU5 (${bluArea}) to dominate RED5 (${redArea}) and GRN5 (${grnArea})`);
});

test('8. Macro states: ball progression (3 -> 5 -> 7), climax WHITE core, afterglow COOL & stopping black', () => {
    const dse = new AtariMetaBlobs();
    const w = 355, h = 200;

    dse.render(createStrictContext(w, h), w, h, 1.0, 'playing', 1.0, makeMetrics({ tensionPct: 0.25 }));
    assert.equal(dse.nActive, 3);

    for (let i = 1; i <= 40; i++) {
        dse.render(createStrictContext(w, h), w, h, 1 + i * 0.04, 'buildup', 1 + i * 0.04, makeMetrics({ tensionPct: 0.55 }));
    }
    assert.equal(dse.nActive, 5);

    let climaxCtx;
    for (let i = 1; i <= 40; i++) {
        climaxCtx = createStrictContext(w, h);
        dse.render(climaxCtx, w, h, 2.6 + i * 0.04, 'climax', 1 + i * 0.04, makeMetrics({
            tensionPct: 0.98,
            smooth: [0.95, 0.95, 0.95],
            beatImpulse: [0.85]
        }));
    }
    assert.equal(dse.nActive, 7);
    assert.ok(climaxCtx.ops.some(o => o.color === WHITE), 'climax must produce WHITE core where F > 4.5');

    // Afterglow preserves nActive (7) and wipes to COOL
    let agCtx;
    for (let i = 1; i <= 30; i++) {
        agCtx = createStrictContext(w, h);
        dse.render(agCtx, w, h, 4.2 + i * 0.02, 'afterglow', i * 0.02, makeMetrics({ tensionPct: 0.2 }));
    }
    assert.equal(dse.nActive, 7, 'afterglow retains existing satellites');
    const coolAllowed = new Set([...COOL.flat(), INK]);
    assert.ok(agCtx.ops.every(o => coolAllowed.has(o.color)), 'afterglow must wipe cleanly to COOL');

    // Stopping at vis = 0 ends in pure black INK
    const stopCtx = createStrictContext(w, h);
    dse.render(stopCtx, w, h, 5.0, 'stopping', 1.5, makeMetrics());
    assert.equal(stopCtx.ops.length, 1);
    assert.equal(stopCtx.ops[0].color, INK);
});

test('9. Rotation (portrait -> landscape -> portrait), all viewports & <= 2500 fillRect budget', () => {
    const viewports = [
        [112, 200], [92, 200], [432, 200], [355, 200], [474, 200], [600, 200], [66, 200]
    ];

    for (const [w, h] of viewports) {
        const dse = new AtariMetaBlobs();
        const ctx = createStrictContext(w, h);
        dse.render(ctx, w, h, 2.0, 'climax', 2.0, makeMetrics({
            tensionPct: 0.95,
            smooth: [0.9, 0.8, 0.7],
            beatImpulse: [0.85]
        }));
        assert.ok(ctx.ops.length > 0);
        assert.ok(ctx.ops.length <= 2500, `${w}x${h} climax drew ${ctx.ops.length} fillRects (> 2500 budget)`);
    }

    // Same-instance continuity across rotation
    const rotDse = new AtariMetaBlobs();
    rotDse.render(createStrictContext(92, 200), 92, 200, 1.0, 'buildup', 1.0, makeMetrics({
        tensionPct: 0.65,
        beatStarted: true, beatCount: 4, beatStrength: 0.5, beatLevel: 2
    }));
    const savedOrbitShape = rotDse.orbitShape;
    const savedOrbit = rotDse.orbit;

    const landCtx = createStrictContext(474, 200);
    rotDse.render(landCtx, 474, 200, 1.04, 'buildup', 1.04, makeMetrics({ tensionPct: 0.65 }));
    assert.equal(rotDse.orbitShape, savedOrbitShape);
    assert.ok(rotDse.orbit > savedOrbit);
    assert.ok(landCtx.ops.length > 0);

    const portCtx = createStrictContext(92, 200);
    rotDse.render(portCtx, 92, 200, 1.08, 'buildup', 1.08, makeMetrics({ tensionPct: 0.65 }));
    assert.equal(rotDse.orbitShape, savedOrbitShape);
    assert.ok(portCtx.ops.length > 0);
});