import test from 'node:test';
import assert from 'node:assert/strict';

import { AtariLineRibbons } from '../js/visuals/dse/atari/line-ribbons.js';
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

test('1. AtariLineRibbons is registered exclusively as an Atari foreground with exact metadata', () => {
    const entry = dseRegistry.find(e => e.Class === AtariLineRibbons);
    assert.ok(entry, 'AtariLineRibbons must be registered in dseRegistry');
    assert.deepEqual(entry.metadata.systems, ['atari']);
    assert.equal(entry.metadata.layer, 'foreground');
    assert.equal(entry.metadata.lifecycle, 'managed');
    assert.equal(entry.metadata.weight, 11);
    assert.equal(entry.metadata.duration, 15.0);
    assert.equal(entry.metadata.climaxHold, 12.0);
    assert.equal(entry.metadata.isDisabled, false);
    assert.equal(entry.metadata.isExclusive, false);
});

test('2. Vertices stay inside safe rectangle, 9-bit palette & <= 13 colors/scanline even mid-wipe', () => {
    const dse = new AtariLineRibbons();
    const w = 355, h = 200;
    const m = Math.round(0.06 * Math.min(w, h));

    for (let f = 1; f <= 30; f++) {
        const onBeat = f % 3 === 0;
        dse.render(createStrictContext(w, h), w, h, 1 + f * 0.04, 'climax', 2.0, makeMetrics({
            tensionPct: 0.95,
            smooth: [0.9, 0.8, 0.7],
            beatStarted: onBeat,
            beatCount: onBeat ? Math.floor(f / 3) : 0,
            beatStrength: onBeat ? 0.9 : 0,
            beatLevel: onBeat ? 3 : 0,
            beatImpulse: [onBeat ? 0.9 : 0.4]
        }));

        for (let b = 0; b < 3; b++) {
            for (let v = 0; v < dse.nv; v++) {
                const idx = b * 6 + v;
                assert.ok(dse.px[idx] >= m && dse.px[idx] <= w - m, `x=${dse.px[idx]} outside [${m}, ${w - m}]`);
                assert.ok(dse.py[idx] >= m && dse.py[idx] <= h - m, `y=${dse.py[idx]} outside [${m}, ${h - m}]`);
            }
        }
    }

    // Trigger 8th beat wipe and sample mid-wipe scanlines
    dse.render(createStrictContext(w, h), w, h, 2.3, 'climax', 2.0, makeMetrics({
        tensionPct: 0.95, beatStarted: true, beatCount: 16, beatStrength: 0.9, beatLevel: 3
    }));
    const midCtx = createStrictContext(w, h);
    dse.render(midCtx, w, h, 2.5, 'climax', 2.2, makeMetrics({ tensionPct: 0.95 }));
    for (let y = 0; y < h; y++) {
        assert.ok(midCtx.scanlineColors[y].size <= 13, `scanline ${y} used ${midCtx.scanlineColors[y].size} colors (> 13)`);
    }
});

test('3. Smoke, idle, missing metrics, invalid/tiny viewports, foreground fade without black curtain', () => {
    const dse = new AtariLineRibbons();

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

    // Foreground fade: vis=0 emits 0 ops; vis=0.15 draws only ribbon 0 (no black fullscreen dither)
    const fadeDse = new AtariLineRibbons();
    const start0 = createStrictContext(320, 200);
    fadeDse.render(start0, 320, 200, 1.0, 'starting', 0.0, makeMetrics());
    assert.equal(start0.ops.length, 0);

    const startLow = createStrictContext(320, 200);
    fadeDse.render(startLow, 320, 200, 1.02, 'starting', 0.20, makeMetrics()); // vis ~0.13 <= 0.2
    const redOrInk = new Set([...RAMPS.RED5, INK]);
    assert.ok(startLow.ops.length > 0 && startLow.ops.every(o => redOrInk.has(o.color)),
        'at vis <= 0.2 only ribbon 0 (RED5 + INK) must be visible without black dither');

    // Silent without audio still moves over t
    const silent = new AtariLineRibbons();
    const c1 = createStrictContext(320, 200);
    const c2 = createStrictContext(320, 200);
    silent.render(c1, 320, 200, 1.0, 'playing', 1.0, {});
    silent.render(c2, 320, 200, 1.6, 'playing', 1.6, {});
    assert.notDeepEqual(c1.ops, c2.ops);
});

test('4. Determinism over 300 frames with identical input sequence', () => {
    const a = new AtariLineRibbons();
    const b = new AtariLineRibbons();
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

test('5. Snapshot cadence (every 2 steps + snapNow on medium/hard) & discrete beatStarted gating', () => {
    const dse = new AtariLineRibbons();
    const w = 320, h = 200;

    // Frame 0 initializes filledSlots = 1 (step 1 -> odd, no extra snap)
    dse.render(createStrictContext(w, h), w, h, 1.00, 'playing', 1.0, makeMetrics());
    const afterStep1 = dse.filledSlots;

    // Step 2 (even) records snapshot
    dse.render(createStrictContext(w, h), w, h, 1.02, 'playing', 1.02, makeMetrics());
    assert.equal(dse.filledSlots, afterStep1 + 1);

    // Step 3 (odd) without beat -> no snapshot
    dse.render(createStrictContext(w, h), w, h, 1.04, 'playing', 1.04, makeMetrics());
    assert.equal(dse.filledSlots, afterStep1 + 1);

    // Held envelope with beatStarted=false on odd step -> NO snapNow, NO link change, NO shove
    const slotsBeforeEnv = dse.filledSlots;
    dse.render(createStrictContext(w, h), w, h, 1.05, 'playing', 1.05, makeMetrics({
        beat: [0.95], beatStarted: false, beatCount: 4, beatStrength: 0.95, beatLevel: 3, beatImpulse: [0.9]
    }));
    assert.equal(dse.filledSlots, slotsBeforeEnv);
    assert.equal(dse.link, 0);

    // Medium beat on odd step triggers snapNow immediately
    dse.render(createStrictContext(w, h), w, h, 1.065, 'playing', 1.065, makeMetrics({
        beatStarted: true, beatCount: 1, beatStrength: 0.50, beatLevel: 2
    }));
    assert.equal(dse.filledSlots, slotsBeforeEnv + 1, 'medium beat must trigger snapNow');

    // 4th beat changes link; 8th beat mirrors vx and changes setIdx
    const vxBefore = Array.from(dse.vx);
    for (let c = 2; c <= 4; c++) {
        dse.render(createStrictContext(w, h), w, h, 1.1 + c * 0.1, 'playing', 1.0, makeMetrics({
            beatStarted: true, beatCount: c, beatStrength: 0.20, beatLevel: 1
        }));
    }
    assert.equal(dse.link, 1, '4th beat changes link');
    assert.equal(dse.setIdx, 0);

    for (let c = 5; c <= 8; c++) {
        dse.render(createStrictContext(w, h), w, h, 1.5 + c * 0.1, 'playing', 1.0, makeMetrics({
            beatStarted: true, beatCount: c, beatStrength: 0.20, beatLevel: 1
        }));
    }
    assert.equal(dse.link, 2);
    assert.equal(dse.setIdx, 1);
    for (let i = 0; i < vxBefore.length; i++) {
        assert.equal(dse.vx[i], -vxBefore[i], '8th beat must mirror all vx');
    }
});

test('6. Soft, medium and hard beat intensities differ measurably and obey hard cooldown', () => {
    const w = 320, h = 200;

    const runLevel = (strength, level) => {
        const dse = new AtariLineRibbons();
        // Warmup 1 step so stepCounter becomes odd -> only snapNow adds snapshot
        dse.render(createStrictContext(w, h), w, h, 1.00, 'playing', 1.0, makeMetrics());
        const slotsBefore = dse.filledSlots;

        dse.render(createStrictContext(w, h), w, h, 1.02, 'playing', 1.02, makeMetrics({
            smooth: [0.2, 0.9, 0.1],
            beatStarted: strength > 0,
            beatCount: strength > 0 ? 1 : 0,
            beatStrength: strength,
            beatLevel: level,
            beatImpulse: [strength]
        }));
        const maxShove = Math.max(...Array.from(dse.shoveVx).map(Math.abs), ...Array.from(dse.shoveVy).map(Math.abs));
        return {
            dse,
            deltaSlots: dse.filledSlots - slotsBefore,
            nudgeCh1: Math.abs(dse.nudgeVx[1]),
            maxShove,
            hardHead: dse.hardHeadTimer
        };
    };

    const soft = runLevel(0.20, 1);
    const medium = runLevel(0.50, 2);
    const hard = runLevel(0.90, 3);

    assert.ok(soft.nudgeCh1 > 0, 'soft nudges strongest channel ribbon');
    assert.equal(soft.maxShove, 0);
    assert.equal(soft.hardHead, 0);

    assert.equal(medium.deltaSlots, 1, 'medium triggers snapNow');
    assert.ok(medium.maxShove > 0);
    assert.equal(medium.hardHead, 0);

    assert.equal(hard.deltaSlots, 1, 'hard triggers snapNow');
    assert.ok(hard.maxShove > medium.maxShove, 'hard shove > medium shove');
    assert.ok(hard.hardHead > 0, 'hard activates 0.12s double head');

    // Second hard beat within 0.25s cooldown does not retrigger hardHeadTimer
    hard.dse.hardHeadTimer = 0;
    hard.dse.render(createStrictContext(w, h), w, h, 1.12, 'playing', 1.12, makeMetrics({
        beatStarted: true, beatCount: 2, beatStrength: 0.90, beatLevel: 3
    }));
    assert.equal(hard.dse.hardHeadTimer, 0);
});

test('7. Vertex progression (nv 4 -> 5 in climax, <= 6 pool, graceful shrink) & afterglow COOL', () => {
    const dse = new AtariLineRibbons();
    const w = 355, h = 200;

    dse.render(createStrictContext(w, h), w, h, 1.0, 'playing', 1.0, makeMetrics({ tensionPct: 0.30 }));
    assert.equal(dse.nv, 4);

    // Ramp tension >= 0.70 and provide beat -> grows to 5
    for (let i = 1; i <= 30; i++) {
        dse.render(createStrictContext(w, h), w, h, 1 + i * 0.04, 'climax', 1.0, makeMetrics({
            tensionPct: 0.95,
            beatStarted: i === 25,
            beatCount: 1,
            beatStrength: 0.5,
            beatLevel: 2
        }));
    }
    assert.equal(dse.nv, 5);
    assert.ok(dse.nv <= 6);

    // Afterglow retains nv = 5 and wipes to COOL
    let agCtx;
    for (let i = 1; i <= 30; i++) {
        agCtx = createStrictContext(w, h);
        dse.render(agCtx, w, h, 2.5 + i * 0.02, 'afterglow', i * 0.02, makeMetrics({ tensionPct: 0.2 }));
    }
    assert.equal(dse.nv, 5, 'afterglow retains existing vertex count');
    const coolAllowed = new Set([...COOL.flat(), INK]);
    assert.ok(agCtx.ops.every(o => coolAllowed.has(o.color)), 'afterglow wipes cleanly to COOL');

    // Return to low playing tension for > 1.7s -> shrinks back to nv = 4
    for (let i = 1; i <= 60; i++) {
        dse.render(createStrictContext(w, h), w, h, 3.2 + i * 0.04, 'playing', 1.0, makeMetrics({ tensionPct: 0.20 }));
    }
    assert.equal(dse.nv, 4, 'after sustained low tension, nv smoothly returns to 4');
});

test('8. Resize position preservation (portrait -> landscape -> portrait <= 1px) & <= 5000 fillRect budget', () => {
    const viewports = [
        [112, 200], [92, 200], [432, 200], [355, 200], [474, 200], [600, 200], [66, 200]
    ];

    for (const [w, h] of viewports) {
        for (let link = 0; link < 3; link++) {
            const dse = new AtariLineRibbons();
            dse.link = link;
            // Warm up history buffer with 16 frames in climax
            for (let f = 0; f < 16; f++) {
                dse.render(createStrictContext(w, h), w, h, 1 + f * 0.02, 'climax', 2.0, makeMetrics({
                    tensionPct: 0.95, smooth: [0.9, 0.8, 0.7], beatImpulse: [0.85]
                }));
            }
            const peakCtx = createStrictContext(w, h);
            dse.render(peakCtx, w, h, 1.34, 'climax', 2.34, makeMetrics({
                tensionPct: 0.95, smooth: [0.9, 0.8, 0.7], beatImpulse: [0.85]
            }));
            assert.ok(peakCtx.ops.length > 0);
            assert.ok(peakCtx.ops.length <= 5000,
                `${w}x${h} (link ${link}) climax drew ${peakCtx.ops.length} fillRects (> 5000 budget)`);
        }
    }

    // Portrait -> Landscape -> Portrait relative & absolute preservation within <= 1 px
    const rot = new AtariLineRibbons();
    rot.render(createStrictContext(92, 200), 92, 200, 1.0, 'playing', 1.0, makeMetrics());
    const pxBefore = Float32Array.from(rot.px);
    const pyBefore = Float32Array.from(rot.py);

    // Same t=1.0 (dt=0) isolates pure geometric resize mapping
    rot.render(createStrictContext(474, 200), 474, 200, 1.0, 'playing', 1.0, makeMetrics());
    rot.render(createStrictContext(92, 200), 92, 200, 1.0, 'playing', 1.0, makeMetrics());

    for (let i = 0; i < 18; i++) {
        assert.ok(Math.abs(rot.px[i] - pxBefore[i]) <= 1.0, `px[${i}] drifted > 1px across round-trip resize`);
        assert.ok(Math.abs(rot.py[i] - pyBefore[i]) <= 1.0, `py[${i}] drifted > 1px across round-trip resize`);
    }
});