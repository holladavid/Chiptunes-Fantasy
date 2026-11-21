import test from 'node:test';
import assert from 'node:assert/strict';

import { AtariLaserGrid } from '../js/visuals/dse/atari/laser-grid.js';
import { FAM, INK, RAMPS } from '../js/visuals/dse/atari/atari-kit.js';
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

test('1. AtariLaserGrid is registered exclusively as an Atari floor with exact metadata', () => {
    const entry = dseRegistry.find(e => e.Class === AtariLaserGrid);
    assert.ok(entry, 'AtariLaserGrid must be registered in dseRegistry');
    assert.deepEqual(entry.metadata.systems, ['atari']);
    assert.equal(entry.metadata.layer, 'floor');
    assert.equal(entry.metadata.lifecycle, 'managed');
    assert.equal(entry.metadata.weight, 12);
    assert.equal(entry.metadata.duration, 15.0);
    assert.equal(entry.metadata.climaxHold, 14.0);
    assert.equal(entry.metadata.isDisabled, false);
    assert.equal(entry.metadata.isExclusive, false);
});

test('2. Strict horizon contract, 9-bit palette, <= 6 colors/scanline and vanishing point', () => {
    const dse = new AtariLaserGrid();
    const w = 355, h = 200;
    const horizon = Math.floor(h * 0.55); // 110
    const ctx = createStrictContext(w, h);

    dse.render(ctx, w, h, 1.0, 'climax', 2.0, makeMetrics({
        tensionPct: 0.95,
        smooth: [0.9, 0.6, 0.4],
        beatStarted: true,
        beatCount: 4,
        beatStrength: 0.9,
        beatLevel: 3,
        beatImpulse: [0.9]
    }));

    assert.ok(ctx.ops.length > 50);
    for (const op of ctx.ops) {
        assert.ok(op.y >= horizon, `floor must not draw above horizon ${horizon}, got y=${op.y}`);
    }
    for (let y = 0; y < h; y++) {
        if (y < horizon) {
            assert.equal(ctx.scanlineColors[y].size, 0, `row ${y} above horizon must be empty`);
        } else {
            assert.ok(ctx.scanlineColors[y].size <= 6, `row ${y} used ${ctx.scanlineColors[y].size} colors (>6)`);
        }
    }

    // All vertical lines converge to vanishing point vx on first floor row y = horizon (+/-1 px)
    const vx = Math.round(w * 0.5 + dse.driftNorm * w);
    const firstRowGridOps = ctx.ops.filter(op => op.y === horizon && op.h === 1 && op.w <= 4 && op.color !== INK);
    assert.ok(firstRowGridOps.length > 0);
    for (const op of firstRowGridOps) {
        assert.ok(Math.abs(op.x - vx) <= 1, `first-row grid pixel x=${op.x} should converge at vx=${vx}`);
    }
});

test('3. Smoke, idle, missing metrics and invalid/tiny viewports behave safely', () => {
    const dse = new AtariLaserGrid();

    for (const [w, h] of [[0, 200], [320, 0], [-10, 200], [NaN, 200], [Infinity, 200]]) {
        const ctx = createStrictContext(320, 200);
        dse.render(ctx, w, h, 1.0, 'playing', 1.0, makeMetrics());
        assert.equal(ctx.ops.length, 0);
    }

    const idleCtx = createStrictContext(320, 200);
    dse.render(idleCtx, 320, 200, 1.0, 'idle', 0, makeMetrics());
    assert.equal(idleCtx.ops.length, 0, 'idle must produce no output');

    for (const [w, h] of [[1, 1], [3, 1], [1, 3], [7, 7]]) {
        const ctx = createStrictContext(w, h);
        dse.render(ctx, w, h, 1.0, 'playing', 1.0, undefined);
    }

    // No audio / missing metrics still animates over t
    const silentA = new AtariLaserGrid();
    const ctx1 = createStrictContext(320, 200);
    const ctx2 = createStrictContext(320, 200);
    silentA.render(ctx1, 320, 200, 1.0, 'playing', 1.0, {});
    silentA.render(ctx2, 320, 200, 1.5, 'playing', 1.5, {});
    assert.ok(ctx1.ops.length > 0 && ctx2.ops.length > 0);
    assert.notDeepEqual(ctx1.ops, ctx2.ops, 'silent effect must remain alive over t');
});

test('4. Determinism over 300 frames with identical input sequence', () => {
    const a = new AtariLaserGrid();
    const b = new AtariLaserGrid();
    const w = 355, h = 200;

    for (let f = 0; f < 300; f++) {
        const ctxA = createStrictContext(w, h);
        const ctxB = createStrictContext(w, h);
        const t = 1 + f * 0.02;
        const state = f < 40 ? 'starting' : f < 140 ? 'playing' : f < 210 ? 'buildup' : f < 260 ? 'climax' : 'afterglow';
        const onBeat = f % 12 === 0;
        const m = makeMetrics({
            beatStarted: onBeat,
            beatCount: Math.floor(f / 12) + 1,
            beatStrength: onBeat ? 0.55 : 0,
            beatLevel: onBeat ? 2 : 0,
            beatImpulse: [Math.max(0, 0.55 - (f % 12) * 0.08)],
            tensionPct: state === 'climax' ? 0.95 : state === 'buildup' ? 0.65 : 0.30,
            smooth: [0.2 + 0.5 * Math.sin(f * 0.1), 0.4, 0.3]
        });
        a.render(ctxA, w, h, t, state, f * 0.02, m);
        b.render(ctxB, w, h, t, state, f * 0.02, m);
        assert.deepEqual(ctxA.ops, ctxB.ops, `frame ${f} differed`);
    }
});

test('5. Discrete events trigger only on beatStarted (never on decaying beat envelope)', () => {
    const dse = new AtariLaserGrid();
    const w = 320, h = 200;

    // 3 beats without reaching beat 4
    for (let c = 1; c <= 3; c++) {
        dse.render(createStrictContext(w, h), w, h, 1 + c * 0.2, 'playing', 1, makeMetrics({
            beatStarted: true,
            beatCount: c,
            beatStrength: 0.5,
            beatLevel: 2,
            beatImpulse: [0.5]
        }));
    }
    const famBefore = dse.fam;
    assert.equal(famBefore, 0);

    // Beat 4 triggers fam change
    dse.render(createStrictContext(w, h), w, h, 1.8, 'playing', 1, makeMetrics({
        beatStarted: true,
        beatCount: 4,
        beatStrength: 0.5,
        beatLevel: 2,
        beatImpulse: [0.5]
    }));
    assert.equal(dse.fam, 1, '4th beat must advance fam');

    // Held/decaying beat envelope with beatStarted=false (even at high beat[0] / beatLevel) must NOT advance fam or pulses
    const activePulsesAtBeat4 = dse.pulses.filter(p => p.active).length;
    for (let i = 1; i <= 5; i++) {
        dse.render(createStrictContext(w, h), w, h, 1.8 + i * 0.02, 'playing', 1, makeMetrics({
            beat: [0.9],
            beatStarted: false,
            beatCount: 4,
            beatStrength: 0.9,
            beatLevel: 3,
            beatImpulse: [0.8]
        }));
    }
    assert.equal(dse.fam, 1, 'envelope must not retrigger fam');
    assert.equal(dse.pulses.filter(p => p.active).length, activePulsesAtBeat4, 'envelope must not spawn pulses');
    assert.equal(dse.waveTimer, 0, 'envelope must not trigger hard wave');

    // Beat 8 flips driftSign and advances fam
    for (let c = 5; c <= 8; c++) {
        dse.render(createStrictContext(w, h), w, h, 2.0 + c * 0.2, 'playing', 1, makeMetrics({
            beatStarted: true,
            beatCount: c,
            beatStrength: 0.5,
            beatLevel: 2,
            beatImpulse: [0.5]
        }));
    }
    assert.equal(dse.fam, 2);
    assert.equal(dse.driftSign, -1, '8th beat must flip driftSign');
});

test('6. Soft, medium, and hard beat intensities differ measurably and obey hard cooldown', () => {
    const w = 320, h = 200;

    const runLevel = (strength, level) => {
        const dse = new AtariLaserGrid();
        const ctx = createStrictContext(w, h);
        dse.render(ctx, w, h, 1.0, 'playing', 2.0, makeMetrics({
            beatStarted: true,
            beatCount: 1,
            beatStrength: strength,
            beatLevel: level,
            beatImpulse: [strength],
            smooth: [0.2, 0.8, 0.1]
        }));
        const step4Rows = new Set(ctx.ops.filter(o => o.color === FAM[0][4] && o.w === w).map(o => o.y));
        return { dse, step4Rows, activePulses: dse.pulses.filter(p => p.active).length };
    };

    const zero = runLevel(0, 0);
    zero.dse.pulses.forEach(p => { assert.equal(p.active, false); });

    const soft = runLevel(0.20, 1);
    const medium = runLevel(0.50, 2);
    const hard = runLevel(0.90, 3);

    assert.ok(soft.step4Rows.size >= 2 && soft.dse.softFrontTimer > 0, 'soft highlights front horizontal line');
    assert.equal(soft.activePulses, 0);
    assert.equal(soft.dse.waveTimer, 0);

    assert.equal(medium.activePulses, 1, 'medium spawns 1 pulse line');
    assert.equal(medium.dse.boostedLane, 1, 'medium boosts highest channel lane');
    assert.equal(medium.dse.waveTimer, 0);

    assert.ok(hard.dse.waveTimer > 0, 'hard activates grid wave');
    assert.equal(hard.dse.boostedLane, 3, 'hard boosts all lanes');
    assert.ok(hard.dse.hardCooldown > 0.2, 'hard enforces 0.25s cooldown');

    // Second hard beat within 0.25s must be gated by cooldown
    hard.dse.waveTimer = 0;
    hard.dse.render(createStrictContext(w, h), w, h, 1.1, 'playing', 2.1, makeMetrics({
        beatStarted: true,
        beatCount: 2,
        beatStrength: 0.90,
        beatLevel: 3,
        beatImpulse: [0.90]
    }));
    assert.equal(hard.dse.waveTimer, 0, 'hard beat within 0.25s cooldown must not re-trigger wave');
});

test('7. Macro state transitions, laser sweeps (>=0.70), wave bounds, afterglow BLU5 & zero end-of-stop', () => {
    const dse = new AtariLaserGrid();
    const w = 355, h = 200;

    // Starting at vis = 0 draws nothing; vis = 0.5 draws partial floor
    const start0 = createStrictContext(w, h);
    dse.render(start0, w, h, 1.0, 'starting', 0.0, makeMetrics());
    assert.equal(start0.ops.length, 0);

    const startMid = createStrictContext(w, h);
    dse.render(startMid, w, h, 1.75, 'starting', 0.75, makeMetrics());
    assert.ok(startMid.ops.length > 0);

    // Playing: no sweeps, no wave
    const playCtx = createStrictContext(w, h);
    dse.render(playCtx, w, h, 2.5, 'playing', 1.0, makeMetrics({ tensionPct: 0.30 }));
    assert.equal(dse.currentWave, 0);

    // Climax (ten >= 0.70): sweeps + wave active, pulse pool <= 4
    const climaxCtx = createStrictContext(w, h);
    dse.render(climaxCtx, w, h, 4.0, 'climax', 2.0, makeMetrics({ tensionPct: 0.95 }));
    assert.ok(dse.currentWave > 0, 'climax activates grid wave');
    assert.ok(climaxCtx.ops.some(o => o.w < 20 && o.color === FAM[0][4]), 'climax draws diagonal laser sweeps');

    // Afterglow: cools to BLU5 via Raster-Wipe, disables wave & sweeps
    let agCtx;
    for (let i = 0; i < 30; i++) {
        agCtx = createStrictContext(w, h);
        dse.render(agCtx, w, h, 4.02 + i * 0.02, 'afterglow', i * 0.02, makeMetrics({ tensionPct: 0.20 }));
    }
    assert.equal(dse.currentWave, 0, 'afterglow disables wave');
    const bluSet = new Set(RAMPS.BLU5);
    assert.ok(agCtx.ops.every(o => bluSet.has(o.color) || o.color === INK), 'afterglow wipes completely to BLU5');

    // Stopping at stateTime >= 1.5 (vis = 0) draws 0 ops
    const stop0 = createStrictContext(w, h);
    dse.render(stop0, w, h, 5.0, 'stopping', 1.5, makeMetrics());
    assert.equal(stop0.ops.length, 0, 'floor must draw nothing at vis = 0');
});

test('8. Rotation (portrait -> landscape -> portrait), all viewports & <= 2500 fillRect budget', () => {
    const dse = new AtariLaserGrid();
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
        const ctx = createStrictContext(w, h);
        dse.render(ctx, w, h, 2.0, 'climax', 2.0, makeMetrics({
            tensionPct: 0.95,
            smooth: [0.8, 0.7, 0.6],
            beatImpulse: [0.8]
        }));
        assert.ok(ctx.ops.length > 0, `expected output for ${w}x${h}`);
        assert.ok(ctx.ops.length <= 2500, `${w}x${h} climax drew ${ctx.ops.length} fillRects (> 2500 budget)`);
    }

    // Continuity across portrait -> landscape -> portrait with same instance
    const rotDse = new AtariLaserGrid();
    rotDse.render(createStrictContext(92, 200), 92, 200, 1.0, 'playing', 1.0, makeMetrics({
        beatStarted: true, beatCount: 4, beatStrength: 0.5, beatLevel: 2
    }));
    const savedFam = rotDse.fam;
    const savedDist = rotDse.dist;

    const landCtx = createStrictContext(474, 200);
    rotDse.render(landCtx, 474, 200, 1.04, 'playing', 1.04, makeMetrics());
    assert.equal(rotDse.fam, savedFam);
    assert.ok(rotDse.dist > savedDist);
    assert.ok(landCtx.ops.length <= 2500);

    const portCtx = createStrictContext(92, 200);
    rotDse.render(portCtx, 92, 200, 1.08, 'playing', 1.08, makeMetrics());
    assert.equal(rotDse.fam, savedFam);
    assert.ok(portCtx.ops.length > 0);
});