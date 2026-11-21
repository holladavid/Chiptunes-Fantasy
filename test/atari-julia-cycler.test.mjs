import test from 'node:test';
import assert from 'node:assert/strict';

import { AtariJuliaCycler } from '../js/visuals/dse/atari/julia-cycler.js';
import { INK, RAMPS, WHITE } from '../js/visuals/dse/atari/atari-kit.js';
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
    let cell = Math.max(3, Math.ceil(Math.sqrt((w * h) / 6000)));
    while (Math.ceil(w / cell) * Math.ceil(h / cell) > 6000) cell++;
    return Math.ceil(w / cell) * Math.ceil(h / cell);
}

test('1. AtariJuliaCycler is registered exclusively as an Atari background with exact metadata', () => {
    const entry = dseRegistry.find(e => e.Class === AtariJuliaCycler);
    assert.ok(entry, 'AtariJuliaCycler must be registered in dseRegistry');
    assert.deepEqual(entry.metadata.systems, ['atari']);
    assert.equal(entry.metadata.layer, 'background');
    assert.equal(entry.metadata.lifecycle, 'managed');
    assert.equal(entry.metadata.weight, 11);
    assert.equal(entry.metadata.duration, 14.0);
    assert.equal(entry.metadata.climaxHold, 12.0);
    assert.equal(entry.metadata.isDisabled, false);
    assert.equal(entry.metadata.isExclusive, false);
});

test('2. Cell count <= 6000 across viewports, 9-bit palette & <= 16 colors/scanline even mid-wipe', () => {
    const viewports = [
        [112, 200], [92, 200], [432, 200], [355, 200], [474, 200], [600, 200], [66, 200]
    ];
    for (const [w, h] of viewports) {
        assert.ok(computeCellGridCount(w, h) <= 6000, `${w}x${h} cell count exceeded 6000`);
    }

    const dse = new AtariJuliaCycler();
    const w = 355, h = 200;

    // 8th beat starts Timer-B Raster-Wipe from RING_HUE (14+2) to ringOf(AMB5)
    for (let c = 1; c <= 8; c++) {
        dse.render(createStrictContext(w, h), w, h, 1 + c * 0.2, 'climax', 2.0, makeMetrics({
            tensionPct: 0.95,
            smooth: [0.8, 0.5, 0.3],
            beatStarted: true,
            beatCount: c,
            beatStrength: 0.9,
            beatLevel: 3,
            beatImpulse: [0.9]
        }));
    }

    const midCtx = createStrictContext(w, h);
    dse.render(midCtx, w, h, 2.8, 'climax', 2.2, makeMetrics({
        tensionPct: 0.95,
        smooth: [0.8, 0.5, 0.3],
        beatImpulse: [0.6]
    }));

    assert.ok(midCtx.ops.length > 0);
    for (let y = 0; y < h; y++) {
        assert.ok(
            midCtx.scanlineColors[y].size <= 16,
            `scanline ${y} used ${midCtx.scanlineColors[y].size} colors (> 16)`
        );
    }
});

test('3. Smoke, idle, missing metrics, invalid/tiny viewports & animation without audio', () => {
    const dse = new AtariJuliaCycler();

    for (const [w, h] of [[0, 200], [320, 0], [-5, 200], [NaN, 200], [Infinity, 200]]) {
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

    // Without smooth/beats, palette cycles & breathes continuously over t
    const silent = new AtariJuliaCycler();
    const ctx1 = createStrictContext(320, 200);
    const ctx2 = createStrictContext(320, 200);
    silent.render(ctx1, 320, 200, 1.0, 'playing', 1.0, {});
    silent.render(ctx2, 320, 200, 1.6, 'playing', 1.6, {});
    assert.notDeepEqual(ctx1.ops, ctx2.ops, 'silent Julia cycler must animate over t');
});

test('4. Determinism over 300 frames with identical input sequence', () => {
    const a = new AtariJuliaCycler();
    const b = new AtariJuliaCycler();
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

test('5. cycleRate <= 6 in every state & iteration count n always finite and <= maxIter', () => {
    const dse = new AtariJuliaCycler();
    for (const [state, ten] of [['starting', 0.2], ['playing', 0.3], ['buildup', 0.7], ['climax', 1.0], ['afterglow', 0.2]]) {
        for (let i = 0; i < 30; i++) {
            dse.render(createStrictContext(320, 200), 320, 200, 1 + i * 0.02, state, i * 0.02, makeMetrics({
                tensionPct: ten
            }));
            assert.ok(Number.isFinite(dse.cycleRate) && dse.cycleRate <= 6.0,
                `cycleRate ${dse.cycleRate} exceeded 6.0 in ${state}`);
            assert.ok(dse.currentMaxIter >= 14 && dse.currentMaxIter <= 28);
        }
    }
    const nVal = dse._iterateJulia(0.2, -0.3, -0.8, 0.156, dse.currentMaxIter);
    assert.ok(Number.isInteger(nVal) && nVal >= 0 && nVal <= dse.currentMaxIter);
});

test('6. Discrete events (cycleJump, fam, psiSign, ringIdx) trigger only on beatStarted', () => {
    const dse = new AtariJuliaCycler();
    const w = 320, h = 200;

    for (let c = 1; c <= 3; c++) {
        dse.render(createStrictContext(w, h), w, h, 1 + c * 0.2, 'playing', 1, makeMetrics({
            beatStarted: true, beatCount: c, beatStrength: 0.20, beatLevel: 1
        }));
    }
    assert.equal(dse.cycleJump, 3);
    assert.equal(dse.fam, 0);
    assert.equal(dse.ringIdx, 0);

    // Held/decaying beat envelope with beatStarted=false must NOT change cycleJump, fam, psiSign, ringIdx
    for (let i = 1; i <= 5; i++) {
        dse.render(createStrictContext(w, h), w, h, 1.6 + i * 0.02, 'playing', 1, makeMetrics({
            beat: [0.95],
            beatStarted: false,
            beatCount: 3,
            beatStrength: 0.95,
            beatLevel: 3,
            beatImpulse: [0.9]
        }));
    }
    assert.equal(dse.cycleJump, 3, 'envelope must not increment cycleJump');
    assert.equal(dse.fam, 0);
    assert.equal(dse.ringIdx, 0);
    assert.equal(dse.psiSign, 1);

    // Beat 4 changes fam (c0)
    dse.render(createStrictContext(w, h), w, h, 1.8, 'playing', 1, makeMetrics({
        beatStarted: true, beatCount: 4, beatStrength: 0.20, beatLevel: 1
    }));
    assert.equal(dse.cycleJump, 4);
    assert.equal(dse.fam, 1);
    assert.equal(dse.ringIdx, 0);

    // Beat 8 changes fam, flips psiSign and changes ringIdx
    for (let c = 5; c <= 8; c++) {
        dse.render(createStrictContext(w, h), w, h, 2.0 + c * 0.2, 'playing', 1, makeMetrics({
            beatStarted: true, beatCount: c, beatStrength: 0.20, beatLevel: 1
        }));
    }
    assert.equal(dse.fam, 2);
    assert.equal(dse.psiSign, -1);
    assert.equal(dse.ringIdx, 1);
});

test('7. Soft, medium and hard beats differ measurably (cycleJump, maxIter +4, WHITE contour + cooldown)', () => {
    const w = 320, h = 200;

    const runLevel = (strength, level) => {
        const dse = new AtariJuliaCycler();
        const ctx = createStrictContext(w, h);
        dse.render(ctx, w, h, 1.0, 'playing', 1.0, makeMetrics({
            tensionPct: 0.30,
            beatStarted: strength > 0,
            beatCount: strength > 0 ? 1 : 0,
            beatStrength: strength,
            beatLevel: level,
            beatImpulse: [strength]
        }));
        const whiteCells = ctx.ops
            .filter(o => o.color === WHITE)
            .reduce((s, o) => s + o.w * o.h, 0);
        return { dse, whiteCells };
    };

    const zero = runLevel(0, 0);
    const soft = runLevel(0.20, 1);
    const medium = runLevel(0.50, 2);
    const hard = runLevel(0.90, 3);

    assert.equal(zero.dse.cycleJump, 0);
    assert.equal(zero.dse.currentMaxIter, 16);
    assert.equal(zero.whiteCells, 0);

    assert.equal(soft.dse.cycleJump, 1);
    assert.equal(soft.dse.currentMaxIter, 16);
    assert.equal(soft.whiteCells, 0);

    assert.equal(medium.dse.cycleJump, 2);
    assert.equal(medium.dse.currentMaxIter, 20, 'medium adds +4 maxIter for 0.2s');
    assert.equal(medium.whiteCells, 0);

    assert.equal(hard.dse.cycleJump, 3);
    assert.equal(hard.dse.currentMaxIter, 16);
    assert.ok(hard.whiteCells > 0, 'hard highlights contour band n = 1 + (count % 8) in WHITE');

    // Second hard beat within 0.25s cooldown must NOT flash WHITE contour
    hard.dse.hardFlashTimer = 0;
    const cdCtx = createStrictContext(w, h);
    hard.dse.render(cdCtx, w, h, 1.1, 'playing', 1.1, makeMetrics({
        tensionPct: 0.30,
        beatStarted: true, beatCount: 2, beatStrength: 0.90, beatLevel: 3
    }));
    assert.equal(cdCtx.ops.filter(o => o.color === WHITE).length, 0,
        'hard WHITE flash must obey 0.25s cooldown');
});

test('8. Radial channel zones: ch(2) affects outer band without altering center zone', () => {
    const w = 320, h = 200;
    const base = new AtariJuliaCycler();
    const outerBoost = new AtariJuliaCycler();

    const ctxBase = createStrictContext(w, h);
    const ctxOuter = createStrictContext(w, h);

    base.render(ctxBase, w, h, 1.0, 'playing', 1.0, makeMetrics({ smooth: [0, 0, 0] }));
    outerBoost.render(ctxOuter, w, h, 1.0, 'playing', 1.0, makeMetrics({ smooth: [0, 0, 1] }));

    assert.notDeepEqual(ctxBase.ops, ctxOuter.ops, 'outer channel C must shift outer ring phase');

    // Verify exact center pixel matches between both runs
    const atCenter = ops => ops.find(o => o.x <= 160 && o.x + o.w > 160 && o.y <= 100 && o.y + o.h > 100)?.color;
    assert.equal(atCenter(ctxBase.ops), atCenter(ctxOuter.ops), 'center zone must remain unaffected by ch(2)');
});

test('9. Macro states: starting -> playing -> buildup -> climax -> afterglow (BLU5) -> stopping', () => {
    const dse = new AtariJuliaCycler();
    const w = 355, h = 200;

    dse.render(createStrictContext(w, h), w, h, 1.0, 'playing', 1.0, makeMetrics({ tensionPct: 0.25 }));
    assert.equal(dse.currentMaxIter, 16);

    dse.render(createStrictContext(w, h), w, h, 1.5, 'buildup', 1.0, makeMetrics({ tensionPct: 0.65 }));
    assert.equal(dse.currentMaxIter, 24);

    // Switch c0 to F1 on beat 4 in climax
    for (let c = 1; c <= 4; c++) {
        dse.render(createStrictContext(w, h), w, h, 1.6 + c * 0.2, 'climax', 1.0, makeMetrics({
            tensionPct: 0.95, beatStarted: true, beatCount: c, beatStrength: 0.5, beatLevel: 2
        }));
    }
    const savedFam = dse.fam;
    assert.equal(savedFam, 1);

    // Enter afterglow -> slows cycleRate to 0.8, maxIter 14, retains fam, wipes to ringOf(BLU5)
    let agCtx;
    for (let i = 1; i <= 30; i++) {
        agCtx = createStrictContext(w, h);
        dse.render(agCtx, w, h, 2.5 + i * 0.02, 'afterglow', i * 0.02, makeMetrics({ tensionPct: 0.2 }));
    }
    assert.equal(dse.fam, savedFam, 'afterglow retains current c0 family');
    assert.equal(dse.currentMaxIter, 14);
    assert.ok(Math.abs(dse.cycleRate - 0.8) < 1e-6);

    const bluAllowed = new Set([...RAMPS.BLU5.slice(1), INK]);
    assert.ok(agCtx.ops.every(o => bluAllowed.has(o.color)), 'afterglow must wipe cleanly to ringOf(BLU5)');

    // Stopping at vis = 0 ends in pure black INK
    const stopCtx = createStrictContext(w, h);
    dse.render(stopCtx, w, h, 3.5, 'stopping', 1.5, makeMetrics());
    assert.equal(stopCtx.ops.length, 1);
    assert.equal(stopCtx.ops[0].color, INK);
});

test('10. Rotation (portrait -> landscape -> portrait), all viewports & <= 3000 fillRect budget', () => {
    const viewports = [
        [112, 200], [92, 200], [432, 200], [355, 200], [474, 200], [600, 200], [66, 200]
    ];

    for (const [w, h] of viewports) {
        for (let fam = 0; fam < 4; fam++) {
            const dse = new AtariJuliaCycler();
            dse.fam = fam;
            dse.curC0r = dse.fromC0r = fam === 0 ? -0.8 : fam === 1 ? -0.123 : fam === 2 ? -0.391 : 0.285;
            dse.curC0i = dse.fromC0i = fam === 0 ? 0.156 : fam === 1 ? 0.745 : fam === 2 ? -0.587 : 0.010;
            const ctx = createStrictContext(w, h);
            dse.render(ctx, w, h, 2.0, 'climax', 2.0, makeMetrics({
                tensionPct: 0.95,
                smooth: [0.9, 0.7, 0.5],
                beatImpulse: [0.85]
            }));
            assert.ok(ctx.ops.length > 0);
            assert.ok(ctx.ops.length <= 3000, `${w}x${h} (fam ${fam}) climax drew ${ctx.ops.length} fillRects (> 3000 budget)`);
        }
    }

    // Same-instance continuity across rotation
    const rotDse = new AtariJuliaCycler();
    rotDse.render(createStrictContext(92, 200), 92, 200, 1.0, 'playing', 1.0, makeMetrics({
        beatStarted: true, beatCount: 4, beatStrength: 0.5, beatLevel: 2
    }));
    const savedFam = rotDse.fam;
    const savedCycle = rotDse.cycle;

    const landCtx = createStrictContext(474, 200);
    rotDse.render(landCtx, 474, 200, 1.04, 'playing', 1.04, makeMetrics());
    assert.equal(rotDse.fam, savedFam);
    assert.ok(rotDse.cycle > savedCycle);
    assert.ok(landCtx.ops.length > 0);

    const portCtx = createStrictContext(92, 200);
    rotDse.render(portCtx, 92, 200, 1.08, 'playing', 1.08, makeMetrics());
    assert.equal(rotDse.fam, savedFam);
    assert.ok(portCtx.ops.length > 0);
});