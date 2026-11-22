// === test/atari-bobs.test.mjs ===
import test from 'node:test';
import assert from 'node:assert/strict';

import { AtariBobs } from '../js/visuals/dse/atari/lissajous-bobs.js';
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
            assert.notEqual(this.fillStyle.toLowerCase(), '#ffffff', '9-bit ST white max is #fcfcfc');
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

test('1. AtariBobs is registered exclusively as an Atari foreground DSE', () => {
    const entry = dseRegistry.find(e => e.Class === AtariBobs);
    assert.ok(entry, 'AtariBobs must be registered in dseRegistry');
    assert.deepEqual(entry.metadata.systems, ['atari']);
    assert.equal(entry.metadata.layer, 'foreground');
    assert.equal(entry.metadata.lifecycle, 'managed');
    assert.equal(entry.metadata.isDisabled, false);
});

test('2. Smoke, idle, invalid/tiny viewports, missing metrics & beatless motion', () => {
    const dse = new AtariBobs();

    for (const [w, h] of [[0, 200], [320, 0], [-10, 200], [NaN, 200], [Infinity, 200]]) {
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
    }

    // Beatless playback still animates smoothly over t and smooth[0..2]
    const silent = new AtariBobs();
    const ctx1 = createStrictContext(320, 200);
    const ctx2 = createStrictContext(320, 200);
    silent.render(ctx1, 320, 200, 1.0, 'playing', 1.0, {});
    silent.render(ctx2, 320, 200, 1.5, 'playing', 1.5, {});
    assert.ok(ctx1.ops.length > 0);
    assert.notDeepEqual(ctx1.ops, ctx2.ops, 'beatless animation must still move over time');
});

test('3. Strict 9-bit palette & <= 16 colors per scanline across all states & climax', () => {
    const dse = new AtariBobs();
    const w = 355, h = 200;

    for (let f = 0; f < 60; f++) {
        const ctx = createStrictContext(w, h);
        const state = f < 15 ? 'playing' : f < 35 ? 'buildup' : f < 50 ? 'climax' : 'afterglow';
        const onBeat = f % 6 === 0;
        dse.render(ctx, w, h, 1 + f * 0.04, state, f * 0.04, makeMetrics({
            tensionPct: state === 'climax' ? 0.95 : 0.45,
            smooth: [0.8, 0.7, 0.9],
            beatStarted: onBeat,
            beatCount: Math.floor(f / 6) + 1,
            beatStrength: 0.9,
            beatLevel: 3,
            beatImpulse: [0.85]
        }));
        for (let y = 0; y < h; y++) {
            assert.ok(
                ctx.scanlineColors[y].size <= 16,
                `scanline ${y} used ${ctx.scanlineColors[y].size} colors (> 16)`
            );
        }
    }
});

test('4. Determinism over 300 frames', () => {
    const a = new AtariBobs();
    const b = new AtariBobs();
    const w = 355, h = 200;

    for (let f = 0; f < 300; f++) {
        const ctxA = createStrictContext(w, h);
        const ctxB = createStrictContext(w, h);
        const state = f < 40 ? 'starting' : f < 140 ? 'playing' : f < 210 ? 'buildup' : f < 260 ? 'climax' : 'afterglow';
        const onBeat = f % 12 === 0;
        const m = makeMetrics({
            beatStarted: onBeat,
            beatCount: Math.floor(f / 12) + 1,
            beatStrength: onBeat ? 0.65 : 0,
            beatLevel: onBeat ? 2 : 0,
            beatImpulse: [Math.max(0, 0.65 - (f % 12) * 0.1)],
            tensionPct: state === 'climax' ? 0.95 : state === 'buildup' ? 0.65 : 0.30,
            smooth: [0.4 + 0.4 * Math.sin(f * 0.08), 0.5, 0.3]
        });
        a.render(ctxA, w, h, 1 + f * 0.02, state, f * 0.02, m);
        b.render(ctxB, w, h, 1 + f * 0.02, state, f * 0.02, m);
        assert.deepEqual(ctxA.ops, ctxB.ops, `frame ${f} differed`);
    }
});

test('5. Discrete beat rules: only beatStarted triggers shifts; 4th beat flips rot/palette, 8th beat swaps formation', () => {
    const dse = new AtariBobs();
    const w = 320, h = 200;

    for (let c = 1; c <= 3; c++) {
        dse.render(createStrictContext(w, h), w, h, 1 + c * 0.2, 'playing', 1.0, makeMetrics({
            beatStarted: true, beatCount: c, beatStrength: 0.5, beatLevel: 2
        }));
    }
    assert.equal(dse.rotDirection, 1);
    assert.equal(dse.paletteShift, 0);
    assert.equal(dse.stateIndex, 0);

    // Held/decaying envelope without beatStarted must not retrigger
    for (let i = 1; i <= 6; i++) {
        dse.render(createStrictContext(w, h), w, h, 1.6 + i * 0.02, 'playing', 1.0, makeMetrics({
            beat: [0.95], beatImpulse: [0.85], beatStrength: 0.95, beatLevel: 3, beatStarted: false, beatCount: 3
        }));
    }
    assert.equal(dse.rotDirection, 1);
    assert.equal(dse.paletteShift, 0);
    assert.equal(dse.stateIndex, 0);

    // 4th beat flips rotDirection & advances paletteShift
    dse.render(createStrictContext(w, h), w, h, 1.8, 'playing', 1.0, makeMetrics({
        beatStarted: true, beatCount: 4, beatStrength: 0.5, beatLevel: 2
    }));
    assert.equal(dse.rotDirection, -1);
    assert.equal(dse.paletteShift, 1);
    assert.equal(dse.stateIndex, 0);

    // 8th beat switches formation
    for (let c = 5; c <= 8; c++) {
        dse.render(createStrictContext(w, h), w, h, 2.0 + c * 0.2, 'playing', 1.0, makeMetrics({
            beatStarted: true, beatCount: c, beatStrength: 0.5, beatLevel: 2
        }));
    }
    assert.equal(dse.stateIndex, 1);
});

test('6. Soft, medium and hard beats differ measurably in wave amplitude and pixel output', () => {
    const w = 320, h = 200;

    const runIntensity = (strength, level) => {
        const dse = new AtariBobs();
        dse.render(createStrictContext(w, h), w, h, 1.0, 'buildup', 2.0, makeMetrics({
            tensionPct: 0.65,
            smooth: [0.5, 0.5, 0.5],
            beatStarted: strength > 0,
            beatCount: strength > 0 ? 1 : 0,
            beatStrength: strength,
            beatLevel: level,
            beatImpulse: [strength]
        }));
        const followCtx = createStrictContext(w, h);
        dse.render(followCtx, w, h, 1.06, 'buildup', 2.06, makeMetrics({
            tensionPct: 0.65,
            smooth: [0.5, 0.5, 0.5],
            beatImpulse: [strength * 0.7]
        }));
        const whiteCount = followCtx.ops
            .filter(o => o.color === '#fcfcfc')
            .reduce((sum, o) => sum + o.w * o.h, 0);
        return {
            opsCount: followCtx.ops.length,
            whiteCount,
            maxTier: Math.max(...dse.bobPulseTier),
            kickZ: dse.beatKickZ
        };
    };

    const soft = runIntensity(0.20, 1);
    const medium = runIntensity(0.50, 2);
    const hard = runIntensity(0.90, 3);

    assert.ok(soft.kickZ < medium.kickZ && medium.kickZ < hard.kickZ);
    assert.ok(hard.maxTier >= medium.maxTier && medium.maxTier >= soft.maxTier);
    assert.ok(hard.whiteCount > soft.whiteCount, 'hard beat must produce brighter specular wave');
});

test('7. Macro lifecycle: starting(0)->0 ops, foreground-safe (no black screen wipe), afterglow cooling, stopping(1.5)->0 ops', () => {
    const dse = new AtariBobs();
    const w = 355, h = 200;

    const start0 = createStrictContext(w, h);
    dse.render(start0, w, h, 1.0, 'starting', 0.0, makeMetrics());
    assert.equal(start0.ops.length, 0);

    const startMid = createStrictContext(w, h);
    dse.render(startMid, w, h, 1.75, 'starting', 0.75, makeMetrics());
    assert.ok(startMid.ops.length > 0);
    // Must not draw a full-width black curtain over background
    assert.ok(!startMid.ops.some(o => o.color === '#000000' && o.w >= w * 0.8));

    // Afterglow cools down to Midnight Chrome palette
    let agCtx;
    for (let f = 0; f < 100; f++) {
        agCtx = createStrictContext(w, h);
        dse.render(agCtx, w, h, 2.0 + f * 0.04, 'afterglow', f * 0.04, makeMetrics({ tensionPct: 0.15 }));
    }
    const agColors = new Set(agCtx.ops.map(o => o.color));
    assert.ok(agColors.has('#b4d8fc') || agColors.has('#6c90b4'), 'afterglow must cascade into cool chrome tones');

    const stopEnd = createStrictContext(w, h);
    dse.render(stopEnd, w, h, 6.5, 'stopping', 1.5, makeMetrics());
    assert.equal(stopEnd.ops.length, 0);
});

test('8. Portrait <-> Landscape <-> Ultrawide continuity, full horizontal coverage & <= 4000 fillRect budget', () => {
    const viewports = [
        [112, 200],
        [92, 200],
        [320, 200],
        [432, 200],
        [474, 200],
        [600, 200],
        [66, 200]
    ];

    for (const [w, h] of viewports) {
        const dse = new AtariBobs();
        let peakCtx;
        for (let f = 0; f < 10; f++) {
            peakCtx = createStrictContext(w, h);
            dse.render(peakCtx, w, h, 1 + f * 0.04, 'climax', 2.0 + f * 0.04, makeMetrics({
                tensionPct: 0.95,
                smooth: [0.9, 0.8, 0.9],
                beatStarted: f === 0,
                beatCount: 1,
                beatStrength: 0.9,
                beatLevel: 3,
                beatImpulse: [0.85]
            }));
        }
        assert.ok(peakCtx.ops.length > 0, `expected pixels at ${w}x${h}`);
        assert.ok(peakCtx.ops.length <= 4000, `${w}x${h} climax used ${peakCtx.ops.length} fillRects (> 4000)`);
    }

    // Ultrawide coverage: formation must span outside central 35% strip
    const uw = new AtariBobs();
    let minX = Infinity, maxX = -Infinity;
    for (let f = 0; f < 40; f++) {
        const ctx = createStrictContext(474, 200);
        uw.render(ctx, 474, 200, 1 + f * 0.04, 'playing', f * 0.04, makeMetrics());
        for (const op of ctx.ops) {
            if (op.x < minX) minX = op.x;
            if (op.x + op.w > maxX) maxX = op.x + op.w;
        }
    }
    assert.ok(maxX - minX > 474 * 0.60, `ultrawide span too narrow (${maxX - minX}px of 474px)`);

    // Same-instance rotation continuity (Portrait -> Landscape -> Portrait)
    const rot = new AtariBobs();
    rot.render(createStrictContext(92, 200), 92, 200, 1.0, 'playing', 1.0, makeMetrics({
        beatStarted: true, beatCount: 4, beatStrength: 0.5, beatLevel: 2
    }));
    const savedRotDir = rot.rotDirection;
    const savedPal = rot.paletteShift;

    const landCtx = createStrictContext(474, 200);
    rot.render(landCtx, 474, 200, 1.04, 'playing', 1.04, makeMetrics());
    assert.equal(rot.rotDirection, savedRotDir);
    assert.equal(rot.paletteShift, savedPal);
    assert.ok(landCtx.ops.length > 0);

    const portCtx = createStrictContext(92, 200);
    rot.render(portCtx, 92, 200, 1.08, 'playing', 1.08, makeMetrics());
    assert.equal(rot.rotDirection, savedRotDir);
    assert.equal(rot.paletteShift, savedPal);
    assert.ok(portCtx.ops.length > 0);
});