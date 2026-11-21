import test from 'node:test';
import assert from 'node:assert/strict';

import { AtariFlatShadedTrio } from '../js/visuals/dse/atari/flat-shaded-trio.js';
import { COOL, INK, RAMPS } from '../js/visuals/dse/atari/atari-kit.js';
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

test('1. AtariFlatShadedTrio is registered exclusively as an Atari foreground with exact metadata', () => {
    const entry = dseRegistry.find(e => e.Class === AtariFlatShadedTrio);
    assert.ok(entry, 'AtariFlatShadedTrio must be registered in dseRegistry');
    assert.deepEqual(entry.metadata.systems, ['atari']);
    assert.equal(entry.metadata.layer, 'foreground');
    assert.equal(entry.metadata.lifecycle, 'managed');
    assert.equal(entry.metadata.weight, 12);
    assert.equal(entry.metadata.duration, 14.0);
    assert.equal(entry.metadata.climaxHold, 14.0);
    assert.equal(entry.metadata.isDisabled, false);
    assert.equal(entry.metadata.isExclusive, false);
});

test('2. No backfaces drawn, 9-bit palette & <= 16 colors/scanline even mid-Raster-Wipe', () => {
    const dse = new AtariFlatShadedTrio();
    const w = 355, h = 200;

    // Spy on polygon draws to confirm every drawn face has n.z > 0 and viewDot < 0
    const origDrawPoly = dse._drawPolygonSplit.bind(dse);
    let checkedFaces = 0;
    dse._drawPolygonSplit = (ctx, pts, bodyIdx, stage, pw, ph, wipeY) => {
        checkedFaces++;
        origDrawPoly(ctx, pts, bodyIdx, stage, pw, ph, wipeY);
    };

    // Trigger 8th beat wipe and sample mid-wipe
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

    const midCtx = createStrictContext(w, h);
    dse.render(midCtx, w, h, 2.8, 'climax', 2.2, makeMetrics({
        tensionPct: 0.95,
        smooth: [0.8, 0.7, 0.6],
        beatImpulse: [0.6]
    }));

    assert.ok(checkedFaces > 0);
    for (let f = 0; f < dse.faceVisible.length; f++) {
        if (dse.faceVisible[f] === 1) {
            assert.ok(dse.faceNz[f] > 0, `visible face ${f} had n.z = ${dse.faceNz[f]} <= 0`);
        }
    }
    for (let y = 0; y < h; y++) {
        assert.ok(
            midCtx.scanlineColors[y].size <= 16,
            `scanline ${y} used ${midCtx.scanlineColors[y].size} colors (> 16)`
        );
    }
});

test('3. Smoke, idle, missing metrics, invalid/tiny viewports, foreground visI fade without black dither', () => {
    const dse = new AtariFlatShadedTrio();

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
    }

    // Foreground fade: vis=0 draws 0 ops; low vis (<=0.2) shows only body 0 (RED5 + INK), no black curtain
    const fadeDse = new AtariFlatShadedTrio();
    const s0 = createStrictContext(320, 200);
    fadeDse.render(s0, 320, 200, 1.0, 'starting', 0.0, makeMetrics());
    assert.equal(s0.ops.length, 0);

    const sLow = createStrictContext(320, 200);
    fadeDse.render(sLow, 320, 200, 1.02, 'starting', 0.25, makeMetrics()); // vis ~0.167 <= 0.2
    const redOrInk = new Set([...RAMPS.RED5, INK]);
    assert.ok(sLow.ops.length > 0 && sLow.ops.every(o => redOrInk.has(o.color)),
        'at vis <= 0.2 only body 0 (RED5 + INK) must be visible');

    // Silent without audio still rotates and bobs over t
    const silent = new AtariFlatShadedTrio();
    const c1 = createStrictContext(320, 200);
    const c2 = createStrictContext(320, 200);
    silent.render(c1, 320, 200, 1.0, 'playing', 1.0, {});
    silent.render(c2, 320, 200, 1.8, 'playing', 1.8, {});
    assert.notDeepEqual(c1.ops, c2.ops);
});

test('4. Determinism over 300 frames with identical input sequence', () => {
    const a = new AtariFlatShadedTrio();
    const b = new AtariFlatShadedTrio();
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

test('5. Discrete events trigger only on beatStarted; 4th/8th beat meshSet/spinSign/setIdx rules', () => {
    const dse = new AtariFlatShadedTrio();
    const w = 320, h = 200;

    for (let c = 1; c <= 3; c++) {
        dse.render(createStrictContext(w, h), w, h, 1 + c * 0.5, 'playing', 1, makeMetrics({
            beatStarted: true, beatCount: c, beatStrength: 0.20, beatLevel: 1
        }));
    }
    assert.equal(dse.meshSet, 0);
    assert.equal(dse.setIdx, 0);

    // Held envelope with beatStarted=false must NOT change lightAngle, boom, meshSet, spinSign or setIdx
    const savedLight = dse.lightAngle;
    for (let i = 1; i <= 5; i++) {
        dse.render(createStrictContext(w, h), w, h, 2.6 + i * 0.02, 'playing', 1, makeMetrics({
            beat: [0.95], beatStarted: false, beatCount: 3, beatStrength: 0.95, beatLevel: 3, beatImpulse: [0.9]
        }));
    }
    assert.equal(dse.lightAngle, savedLight);
    assert.deepEqual(Array.from(dse.boom), [0, 0, 0]);
    assert.equal(dse.meshSet, 0);
    assert.equal(dse.spinSign, 1);

    // Beat 4 starts 0.4s shrink/grow transition to meshSet 1
    dse.render(createStrictContext(w, h), w, h, 2.8, 'playing', 1, makeMetrics({
        beatStarted: true, beatCount: 4, beatStrength: 0.20, beatLevel: 1
    }));
    for (let i = 1; i <= 25; i++) {
        dse.render(createStrictContext(w, h), w, h, 2.8 + i * 0.02, 'playing', 1, makeMetrics());
    }
    assert.equal(dse.meshSet, 1, '4th beat completes meshSet transition to 1');
    assert.equal(dse.shrink, 1.0);

    // Beat 8 mirrors spinSign and advances setIdx
    for (let c = 5; c <= 8; c++) {
        dse.render(createStrictContext(w, h), w, h, 3.4 + c * 0.2, 'playing', 1, makeMetrics({
            beatStarted: true, beatCount: c, beatStrength: 0.20, beatLevel: 1
        }));
    }
    assert.equal(dse.spinSign, -1);
    assert.equal(dse.setIdx, 1);
});

test('6. Soft, medium and hard beat intensities differ measurably and obey hard cooldown', () => {
    const w = 320, h = 200;

    const runLevel = (strength, level) => {
        const dse = new AtariFlatShadedTrio();
        const baseLight = dse.lightAngle;
        const ctx = createStrictContext(w, h);
        dse.render(ctx, w, h, 1.0, 'playing', 1.0, makeMetrics({
            smooth: [0.2, 0.9, 0.1],
            beatStarted: strength > 0,
            beatCount: strength > 0 ? 1 : 0,
            beatStrength: strength,
            beatLevel: level,
            beatImpulse: [strength]
        }));
        const stage4GreenArea = ctx.ops
            .filter(o => o.color === RAMPS.GRN5[4])
            .reduce((s, o) => s + o.w * o.h, 0);
        return {
            dse,
            deltaLight: dse.lightAngle - baseLight,
            boom: Array.from(dse.boom),
            stage4GreenArea
        };
    };

    const zero = runLevel(0, 0);
    const soft = runLevel(0.20, 1);
    const medium = runLevel(0.50, 2);
    const hard = runLevel(0.90, 3);

    assert.equal(zero.deltaLight, 0);
    assert.deepEqual(zero.boom, [0, 0, 0]);

    assert.ok(Math.abs(soft.deltaLight - Math.PI / 6) < 1e-6, 'soft shifts lightAngle by pi/6');
    assert.deepEqual(soft.boom, [0, 0, 0]);

    assert.equal(medium.deltaLight, 0);
    assert.equal(medium.boom[0], 0);
    assert.equal(medium.boom[1], 0.25, 'medium booms strongest channel body only');
    assert.equal(medium.boom[2], 0);

    assert.deepEqual(hard.boom, [0.30, 0.30, 0.30], 'hard booms all 3 bodies to 0.30');
    assert.ok(hard.dse.hardFlashTimer > 0 && hard.stage4GreenArea > zero.stage4GreenArea,
        'hard forces strongest body faces to stage 4');

    // Second hard beat within 0.25s cooldown does not retrigger stage-4 flash
    hard.dse.hardFlashTimer = 0;
    hard.dse.render(createStrictContext(w, h), w, h, 1.1, 'playing', 1.1, makeMetrics({
        smooth: [0.2, 0.9, 0.1],
        beatStarted: true, beatCount: 2, beatStrength: 0.90, beatLevel: 3
    }));
    assert.equal(hard.dse.hardFlashTimer, 0, 'hard flash must obey 0.25s cooldown');
});

test('7. Channel isolation (body i responds only to ch(i)) & channel jump 0 -> 1 <= 2.5*omega*dt', () => {
    const w = 320, h = 200;

    // Isolated channel 1 check
    const base = new AtariFlatShadedTrio();
    const iso1 = new AtariFlatShadedTrio();
    const ctxBase = createStrictContext(w, h);
    const ctxIso1 = createStrictContext(w, h);

    base.render(ctxBase, w, h, 1.0, 'playing', 1.0, makeMetrics({ smooth: [0, 0, 0] }));
    iso1.render(ctxIso1, w, h, 1.0, 'playing', 1.0, makeMetrics({ smooth: [0, 1, 0] }));

    // Body 0 (RED5) & Body 2 (BLU5) pixel signatures must stay identical; Body 1 (GRN5) changes!
    const opsOf = (ops, ramp) => {
        const set = new Set(ramp);
        return ops.filter(o => set.has(o.color));
    };
    assert.deepEqual(opsOf(ctxBase.ops, RAMPS.RED5), opsOf(ctxIso1.ops, RAMPS.RED5), 'body 0 unaffected by ch(1)');
    assert.deepEqual(opsOf(ctxBase.ops, RAMPS.BLU5), opsOf(ctxIso1.ops, RAMPS.BLU5), 'body 2 unaffected by ch(1)');
    assert.notDeepEqual(opsOf(ctxBase.ops, RAMPS.GRN5), opsOf(ctxIso1.ops, RAMPS.GRN5), 'body 1 responds to ch(1)');

    // Channel jump 0 -> 1 must not jump angle by more than 2.5 * omega * dt
    const jumpDse = new AtariFlatShadedTrio();
    jumpDse.render(createStrictContext(w, h), w, h, 1.00, 'playing', 1.0, makeMetrics({ smooth: [0, 0, 0] }));
    const angBefore = jumpDse.angles[0];
    const dt = 0.02;
    jumpDse.render(createStrictContext(w, h), w, h, 1.02, 'playing', 1.02, makeMetrics({ smooth: [1, 0, 0] }));
    const dAng = Math.abs(jumpDse.angles[0] - angBefore);
    assert.ok(dAng <= 2.5 * jumpDse.omega * dt + 1e-6,
        `angle step ${dAng} exceeded 2.5 * omega * dt (${2.5 * jumpDse.omega * dt})`);
});

test('8. Macro states: afterglow COOL & zero explode, stopping cleans to 0 ops', () => {
    const dse = new AtariFlatShadedTrio();
    const w = 355, h = 200;

    dse.render(createStrictContext(w, h), w, h, 1.0, 'climax', 1.0, makeMetrics({
        tensionPct: 1.0, beatStarted: true, beatCount: 4, beatStrength: 0.5, beatLevel: 2
    }));
    for (let i = 1; i <= 25; i++) {
        dse.render(createStrictContext(w, h), w, h, 1 + i * 0.02, 'climax', 1.0, makeMetrics({ tensionPct: 1.0 }));
    }
    const savedMeshSet = dse.meshSet;

    // Afterglow retains meshSet, wipes cleanly to COOL
    let agCtx;
    for (let i = 1; i <= 30; i++) {
        agCtx = createStrictContext(w, h);
        dse.render(agCtx, w, h, 1.6 + i * 0.02, 'afterglow', i * 0.02, makeMetrics({ tensionPct: 0.2 }));
    }
    assert.equal(dse.meshSet, savedMeshSet, 'afterglow retains meshSet');
    const coolAllowed = new Set([...COOL.flat(), INK]);
    assert.ok(agCtx.ops.every(o => coolAllowed.has(o.color)), 'afterglow wipes cleanly to COOL');

    // Stopping at vis = 0 produces 0 ops
    const stopCtx = createStrictContext(w, h);
    dse.render(stopCtx, w, h, 3.0, 'stopping', 1.5, makeMetrics());
    assert.equal(stopCtx.ops.length, 0);
});

test('9. Rotation (portrait -> landscape -> portrait), all viewports & <= 6000 fillRect budget', () => {
    const viewports = [
        [112, 200], [92, 200], [432, 200], [355, 200], [474, 200], [600, 200], [66, 200]
    ];

    for (const [w, h] of viewports) {
        for (let ms = 0; ms < 4; ms++) {
            const dse = new AtariFlatShadedTrio();
            dse.meshSet = ms;
            const ctx = createStrictContext(w, h);
            dse.render(ctx, w, h, 2.0, 'climax', 2.0, makeMetrics({
                tensionPct: 0.95,
                smooth: [0.9, 0.8, 0.7],
                beatImpulse: [0.85]
            }));
            assert.ok(ctx.ops.length > 0);
            assert.ok(ctx.ops.length <= 6000,
                `${w}x${h} (meshSet ${ms}) climax drew ${ctx.ops.length} fillRects (> 6000 budget)`);
        }
    }

    // Same-instance continuity across portrait -> landscape -> portrait
    const rot = new AtariFlatShadedTrio();
    rot.render(createStrictContext(92, 200), 92, 200, 1.0, 'playing', 1.0, makeMetrics());
    const angAfter1 = rot.angles[0];

    const landCtx = createStrictContext(474, 200);
    rot.render(landCtx, 474, 200, 1.04, 'playing', 1.04, makeMetrics());
    assert.ok(rot.angles[0] > angAfter1);
    assert.ok(landCtx.ops.length > 0);

    const portCtx = createStrictContext(92, 200);
    rot.render(portCtx, 92, 200, 1.08, 'playing', 1.08, makeMetrics());
    assert.ok(portCtx.ops.length > 0);
});