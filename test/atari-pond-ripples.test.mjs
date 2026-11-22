import test from 'node:test';
import assert from 'node:assert/strict';

import { AtariPondRipples } from '../js/visuals/dse/atari/pond-ripples.js';
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

test('1. AtariPondRipples is registered exclusively as an Atari floor with exact metadata', () => {
    const entry = dseRegistry.find(e => e.Class === AtariPondRipples);
    assert.ok(entry, 'AtariPondRipples must be registered in dseRegistry');
    assert.deepEqual(entry.metadata.systems, ['atari']);
    assert.equal(entry.metadata.layer, 'floor');
    assert.equal(entry.metadata.lifecycle, 'managed');
    assert.equal(entry.metadata.weight, 12);
    assert.equal(entry.metadata.duration, 14.0);
    assert.equal(entry.metadata.climaxHold, 12.0);
    assert.equal(entry.metadata.isDisabled, false);
    assert.equal(entry.metadata.isExclusive, false);
});

test('2. Strict horizon contract, 9-bit palette, <= 6 colors/scanline even during Raster-Wipe', () => {
    const dse = new AtariPondRipples();
    const w = 355, h = 200;
    const horizon = Math.floor(h * 0.55); // 110

    // Trigger 4th beat to start a Raster-Wipe across water & 3D ripples
    for (let c = 1; c <= 4; c++) {
        dse.render(createStrictContext(w, h), w, h, 1 + c * 0.2, 'climax', 2.0, makeMetrics({
            tensionPct: 0.95,
            smooth: [0.8, 0.6, 0.4],
            beatStarted: true,
            beatCount: c,
            beatStrength: 0.9,
            beatLevel: 3,
            beatImpulse: [0.9]
        }));
    }

    // Advance 0.20s mid-wipe so wipeY cuts right through active ellipses, troughs, shimmer & glints
    const midCtx = createStrictContext(w, h);
    dse.render(midCtx, w, h, 1.9, 'climax', 2.2, makeMetrics({
        tensionPct: 0.95,
        smooth: [0.8, 0.6, 0.4],
        beatImpulse: [0.85]
    }));

    assert.ok(midCtx.ops.length > 20);
    for (const op of midCtx.ops) {
        assert.ok(op.y >= horizon, `floor must not draw above horizon ${horizon}, got y=${op.y}`);
    }
    for (let y = 0; y < h; y++) {
        if (y < horizon) {
            assert.equal(midCtx.scanlineColors[y].size, 0);
        } else {
            assert.ok(
                midCtx.scanlineColors[y].size <= 6,
                `scanline ${y} used ${midCtx.scanlineColors[y].size} colors (>6)`
            );
        }
    }
});

test('3. Smoke, idle, missing metrics, invalid/tiny viewports and droplets without audio', () => {
    const dse = new AtariPondRipples();

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

    // Without beats/audio, deterministic droplets and glints still animate over t
    const silent = new AtariPondRipples();
    let sawRipple = false;
    for (let f = 0; f < 180; f++) {
        silent.render(createStrictContext(320, 200), 320, 200, 1 + f * 0.02, 'buildup', 2.0, {});
        if (silent.ripples.some(r => r.active)) {
            sawRipple = true;
            break;
        }
    }
    assert.ok(sawRipple, 'silent buildup must spawn reproducible ambient droplets');
});

test('4. Determinism over 300 frames (identical ripples, droplets & fillRect stream)', () => {
    const a = new AtariPondRipples();
    const b = new AtariPondRipples();
    const w = 355, h = 200;

    for (let f = 0; f < 300; f++) {
        const ctxA = createStrictContext(w, h);
        const ctxB = createStrictContext(w, h);
        const t = 1 + f * 0.02;
        const state = f < 40 ? 'starting' : f < 140 ? 'playing' : f < 210 ? 'buildup' : f < 260 ? 'climax' : 'afterglow';
        const onBeat = f % 14 === 0;
        const m = makeMetrics({
            beatStarted: onBeat,
            beatCount: Math.floor(f / 14) + 1,
            beatStrength: onBeat ? 0.55 : 0,
            beatLevel: onBeat ? 2 : 0,
            beatImpulse: [Math.max(0, 0.55 - (f % 14) * 0.08)],
            tensionPct: state === 'climax' ? 0.95 : state === 'buildup' ? 0.65 : 0.30,
            smooth: [0.3 + 0.5 * Math.sin(f * 0.09), 0.5, 0.2]
        });
        a.render(ctxA, w, h, t, state, f * 0.02, m);
        b.render(ctxB, w, h, t, state, f * 0.02, m);
        assert.deepEqual(ctxA.ops, ctxB.ops, `frame ${f} differed`);
    }
});

test('5. Pool bounds (ripples <= 12, sprays <= 12) and tension ripMax limits', () => {
    const checkCap = (state, tensionPct, expectedCap) => {
        const dse = new AtariPondRipples();
        for (let c = 1; c <= 20; c++) {
            dse.render(createStrictContext(320, 200), 320, 200, 1 + c * 0.06, state, 2.0, makeMetrics({
                tensionPct,
                smooth: [0.9, 0.9, 0.9],
                beatStarted: true,
                beatCount: c,
                beatStrength: 0.9,
                beatLevel: 3,
                beatImpulse: [0.9]
            }));
        }
        assert.equal(dse.ripples.length, 12);
        assert.equal(dse.sprays.length, 12);
        assert.ok(dse.ripples.filter(r => r.active).length <= expectedCap,
            `${state} active ripples exceeded ${expectedCap}`);
    };

    checkCap('playing', 0.25, 4);
    checkCap('buildup', 0.55, 8);
    checkCap('climax', 0.95, 12);
});

test('6. Discrete events trigger only on beatStarted (never on decaying envelope); 4th/8th beat rules', () => {
    const dse = new AtariPondRipples();
    const w = 320, h = 200;

    for (let c = 1; c <= 3; c++) {
        dse.render(createStrictContext(w, h), w, h, 1 + c * 0.2, 'playing', 1.0, makeMetrics({
            beatStarted: true,
            beatCount: c,
            beatStrength: 0.5,
            beatLevel: 2
        }));
    }
    assert.equal(dse.fam, 0);

    dse.ripples.forEach(r => { r.active = false; });
    for (let i = 1; i <= 5; i++) {
        dse.render(createStrictContext(w, h), w, h, 1.6 + i * 0.02, 'playing', 1.0, makeMetrics({
            beat: [0.9],
            beatStarted: false,
            beatCount: 3,
            beatStrength: 0.9,
            beatLevel: 3,
            beatImpulse: [0.8]
        }));
    }
    assert.equal(dse.fam, 0, 'envelope must not advance fam');
    assert.equal(dse.sprays.filter(s => s.active).length, 0, 'envelope must not emit sprays');

    dse.render(createStrictContext(w, h), w, h, 1.8, 'playing', 1.0, makeMetrics({
        beatStarted: true,
        beatCount: 4,
        beatStrength: 0.5,
        beatLevel: 2
    }));
    assert.equal(dse.fam, 1);

    for (let c = 5; c <= 8; c++) {
        dse.render(createStrictContext(w, h), w, h, 2.0 + c * 0.2, 'playing', 1.0, makeMetrics({
            beatStarted: true,
            beatCount: c,
            beatStrength: 0.5,
            beatLevel: 2
        }));
    }
    assert.equal(dse.fam, 2);
    assert.equal(dse.driftSign, -1);
});

test('7. Soft, medium and hard beats differ measurably; channel tie breaks to lowest index', () => {
    const w = 320, h = 200;

    const runIntensity = (strength, level, smooth = [0.6, 0.7, 0.8]) => {
        const dse = new AtariPondRipples();
        dse.render(createStrictContext(w, h), w, h, 1.0, 'climax', 2.0, makeMetrics({
            tensionPct: 0.95,
            smooth,
            beatStarted: strength > 0,
            beatCount: strength > 0 ? 1 : 0,
            beatStrength: strength,
            beatLevel: level,
            beatImpulse: [strength]
        }));
        return {
            activeRipples: dse.ripples.filter(r => r.active),
            activeSprays: dse.sprays.filter(s => s.active).length
        };
    };

    const zero = runIntensity(0, 0);
    const soft = runIntensity(0.20, 1);
    const medium = runIntensity(0.50, 2);
    const hard = runIntensity(0.90, 3);

    assert.equal(zero.activeRipples.length, 0);
    assert.equal(soft.activeRipples.length, 1);
    assert.equal(soft.activeSprays, 0);

    assert.equal(medium.activeRipples.length, 3);
    assert.equal(medium.activeSprays, 0);

    assert.equal(hard.activeRipples.length, 4);
    assert.ok(hard.activeRipples.some(r => r.delay > 0));
    assert.equal(hard.activeSprays, 6);

    const tie = runIntensity(0.20, 1, [0.5, 0.5, 0.5]);
    assert.ok(tie.activeRipples[0].xw < 0, 'tie must deterministically select lowest channel index 0');
});

test('8. Macro states: starting gates ripples until vis >= 0.6, afterglow cools to BLU5, stopping ends at 0 ops', () => {
    const dse = new AtariPondRipples();
    const w = 355, h = 200;

    const start0 = createStrictContext(w, h);
    dse.render(start0, w, h, 1.0, 'starting', 0.0, makeMetrics({
        beatStarted: true, beatCount: 1, beatStrength: 0.9, beatLevel: 3
    }));
    assert.equal(start0.ops.length, 0);
    assert.equal(dse.ripples.filter(r => r.active).length, 0, 'vis < 0.6 must gate new ripples');

    for (let c = 2; c <= 4; c++) {
        dse.render(createStrictContext(w, h), w, h, 1.0 + c * 0.3, 'climax', 2.0, makeMetrics({
            tensionPct: 0.95,
            smooth: [0.8, 0.7, 0.6],
            beatStarted: true,
            beatCount: c,
            beatStrength: 0.9,
            beatLevel: 3,
            beatImpulse: [0.9]
        }));
    }
    assert.equal(dse.fam, 1);

    let agCtx;
    for (let i = 0; i < 30; i++) {
        agCtx = createStrictContext(w, h);
        dse.render(agCtx, w, h, 2.5 + i * 0.02, 'afterglow', i * 0.02, makeMetrics({ tensionPct: 0.2 }));
    }
    const bluSet = new Set(RAMPS.BLU5);
    assert.ok(agCtx.ops.every(o => bluSet.has(o.color) || o.color === INK), 'afterglow must wipe cleanly to BLU5');

    const stop0 = createStrictContext(w, h);
    dse.render(stop0, w, h, 3.5, 'stopping', 1.5, makeMetrics());
    assert.equal(stop0.ops.length, 0);
});

test('9. Rotation (portrait -> landscape -> portrait), all viewports & <= 4000 fillRect budget', () => {
    const viewports = [
        [112, 200],
        [92, 200],
        [432, 200],
        [355, 200],
        [474, 200],
        [600, 200],
        [66, 200]
    ];

    for (const [w, h] of viewports) {
        const dse = new AtariPondRipples();
        for (let f = 0; f < 16; f++) {
            const onBeat = f % 4 === 0;
            dse.render(createStrictContext(w, h), w, h, 1 + f * 0.04, 'climax', 2.0, makeMetrics({
                tensionPct: 0.95,
                smooth: [0.9, 0.8, 0.7],
                beatStarted: onBeat,
                beatCount: Math.floor(f / 4) + 1,
                beatStrength: 0.9,
                beatLevel: 3,
                beatImpulse: [0.85]
            }));
        }
        const peakCtx = createStrictContext(w, h);
        dse.render(peakCtx, w, h, 1.7, 'climax', 2.7, makeMetrics({
            tensionPct: 0.95,
            smooth: [0.9, 0.8, 0.7],
            beatImpulse: [0.85]
        }));
        assert.ok(peakCtx.ops.length > 0, `expected output for ${w}x${h}`);
        assert.ok(peakCtx.ops.length <= 4000, `${w}x${h} climax drew ${peakCtx.ops.length} fillRects (> 4000 budget)`);
    }

    const rotDse = new AtariPondRipples();
    rotDse.render(createStrictContext(92, 200), 92, 200, 1.0, 'playing', 1.0, makeMetrics({
        beatStarted: true, beatCount: 4, beatStrength: 0.5, beatLevel: 2
    }));
    const savedFam = rotDse.fam;
    const activeBefore = rotDse.ripples.filter(r => r.active).length;
    assert.ok(activeBefore > 0);

    const landCtx = createStrictContext(474, 200);
    rotDse.render(landCtx, 474, 200, 1.04, 'playing', 1.04, makeMetrics());
    assert.equal(rotDse.fam, savedFam);
    assert.ok(rotDse.ripples.some(r => r.active));
    assert.ok(landCtx.ops.length > 0);

    const portCtx = createStrictContext(92, 200);
    rotDse.render(portCtx, 92, 200, 1.08, 'playing', 1.08, makeMetrics());
    assert.equal(rotDse.fam, savedFam);
    assert.ok(portCtx.ops.length > 0);
});

test('10. Ultrawide coverage: ripples & shimmer reach left and right outer thirds (no central cluster)', () => {
    const w = 600, h = 200;
    const dse = new AtariPondRipples();

    for (let f = 0; f < 80; f++) {
        const onBeat = f % 10 === 0;
        dse.render(createStrictContext(w, h), w, h, 1 + f * 0.02, 'buildup', 1.0, makeMetrics({
            tensionPct: 0.75,
            smooth: [0.85, 0.70, 0.85],
            beatStarted: onBeat,
            beatCount: Math.floor(f / 10) + 1,
            beatStrength: onBeat ? 0.6 : 0,
            beatLevel: onBeat ? 2 : 0,
            beatImpulse: [onBeat ? 0.6 : 0.2]
        }));
    }

    const active = dse.ripples.filter(r => r.active);
    const sx = 0.5 * Math.min(w, 1.6 * h);
    const wideHalf = Math.max(sx, w * 0.5 * 1.25);
    const xs = active.map(rp => w * 0.5 + rp.xw * wideHalf / rp.zw);

    assert.ok(xs.some(x => x < w * 0.34), 'ultrawide must place ripples in left third');
    assert.ok(xs.some(x => x > w * 0.66), 'ultrawide must place ripples in right third');
});

test('11. Visual graded beat output: soft, medium and hard impulses produce distinct crest rendering', () => {
    const w = 320, h = 200;

    const sampleRender = (strength, level) => {
        const dse = new AtariPondRipples();
        dse.render(createStrictContext(w, h), w, h, 1.0, 'playing', 1.0, makeMetrics({
            tensionPct: 0.55,
            smooth: [0.7, 0.8, 0.7],
            beatStarted: true,
            beatCount: 1,
            beatStrength: strength,
            beatLevel: level,
            beatImpulse: [strength]
        }));
        const outCtx = createStrictContext(w, h);
        dse.render(outCtx, w, h, 1.12, 'playing', 1.12, makeMetrics({
            tensionPct: 0.55,
            smooth: [0.7, 0.8, 0.7],
            beatImpulse: [strength]
        }));
        return outCtx.ops;
    };

    const softOps = sampleRender(0.20, 1);
    const medOps = sampleRender(0.50, 2);
    const hardOps = sampleRender(0.90, 3);

    assert.notDeepEqual(softOps, medOps);
    assert.notDeepEqual(medOps, hardOps);
    assert.ok(hardOps.some(o => o.color === WHITE), 'hard beat impulse must flash #fcfcfc crest highlights');
});

test('12. Continuous glint twinkle & mid-wipe snapshot safety', () => {
    const dse = new AtariPondRipples();
    const w = 320, h = 200;
    const before = dse.glints.map(g => ({ xNorm: g.xNorm, rNorm: g.rNorm }));

    // 4 PAL ticks must drift glints smoothly without wiping all 24 positions
    for (let f = 0; f < 4; f++) {
        dse.render(createStrictContext(w, h), w, h, 1 + f * 0.02, 'playing', 1.0, makeMetrics());
    }
    const unchangedCount = dse.glints.filter((g, i) =>
        g.xNorm === before[i].xNorm && g.rNorm === before[i].rNorm
    ).length;
    assert.ok(unchangedCount >= 20, 'glints must not teleport all 24 slots every 4 frames');
    assert.notEqual(dse.glintDriftPx, 0, 'glint drift must accumulate continuously');

    // Interrupting an active wipe must preserve the upper active palette as wipeFrom
    dse._startWipe(RAMPS.CYN5);
    dse.wipeAge = 0.2;
    dse._startWipe(RAMPS.VIO5);
    assert.equal(dse.wipeFrom, RAMPS.CYN5);
    assert.equal(dse.wipeTo, RAMPS.VIO5);
    assert.equal(dse.wipeAge, 0);
});

test('13. Transparent Bayer floor fade: starting at vis=0.5 dissolves without solid #000000 curtain', () => {
    const dse = new AtariPondRipples();
    const w = 320, h = 200;
    const horizon = Math.floor(h * 0.55);
    const midStartCtx = createStrictContext(w, h);

    dse.render(midStartCtx, w, h, 1.0, 'starting', 0.75, makeMetrics());
    assert.ok(midStartCtx.ops.length > 0);
    const maxY = Math.max(...midStartCtx.ops.map(o => o.y + o.h));
    assert.ok(maxY <= horizon + Math.floor((h - horizon) * 0.5), 'fade must stay within visH');
    assert.equal(midStartCtx.ops.some(o => o.color === INK), false, 'transparent Bayer fade must not paint #000000 over background');
});