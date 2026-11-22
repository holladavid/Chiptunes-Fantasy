// === test/ym-silicon-bg.test.mjs ===
import test from 'node:test';
import assert from 'node:assert/strict';

import { YmSiliconBg } from '../js/visuals/dse/atari/ym-silicon-bg.js';
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
            assert.ok(rw > 0 && rh > 0, `rect size must be positive: ${rw}x${rh}`);
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
        smooth: [0.55, 0.35, 0.25],
        tensionPct: 0.35,
        system: 'atari',
        ...overrides
    };
}

test('1. YmSiliconBg is registered exclusively as an Atari background with exact metadata', () => {
    const entry = dseRegistry.find(e => e.Class === YmSiliconBg);
    assert.ok(entry, 'YmSiliconBg must be registered in dseRegistry');
    assert.deepEqual(entry.metadata.systems, ['atari']);
    assert.equal(entry.metadata.layer, 'background');
    assert.equal(entry.metadata.lifecycle, 'managed');
    assert.equal(entry.metadata.weight, 12);
    assert.equal(entry.metadata.duration, 12.0);
    assert.equal(entry.metadata.climaxHold, 10.0);
    assert.equal(entry.metadata.isDisabled, false);
});

test('2. Strict 9-bit palette & <= 16 colors/scanline across all macro states and Sync-Buzzer tears', () => {
    const w = 355, h = 200;
    const states = ['starting', 'playing', 'buildup', 'climax', 'afterglow', 'stopping'];

    for (const st of states) {
        const dse = new YmSiliconBg();
        const ctx = createStrictContext(w, h);
        const stateT = st === 'starting' ? 0.75 : (st === 'stopping' ? 0.5 : 2.0);
        dse.render(ctx, w, h, 2.0, st, stateT, makeMetrics({
            tensionPct: st === 'climax' ? 0.98 : 0.6,
            smooth: [0.9, 0.75, 0.65],
            beatStarted: true,
            beatCount: 4,
            beatStrength: 0.9,
            beatLevel: 3,
            beatImpulse: [0.9]
        }));
        assert.ok(ctx.ops.length > 0, `${st} must produce output`);
        for (let y = 0; y < h; y++) {
            assert.ok(
                ctx.scanlineColors[y].size <= 16,
                `${st} scanline ${y} exceeded 16 colors (${ctx.scanlineColors[y].size})`
            );
        }
    }
});

test('3. Smoke, idle, missing metrics, invalid/tiny viewports & live silent rendering', () => {
    const dse = new YmSiliconBg();

    for (const [w, h] of [[0, 200], [320, 0], [-10, 200], [NaN, 200], [Infinity, 200]]) {
        const ctx = createStrictContext(320, 200);
        dse.render(ctx, w, h, 1.0, 'playing', 1.0, makeMetrics());
        assert.equal(ctx.ops.length, 0);
    }

    const idleCtx = createStrictContext(320, 200);
    dse.render(idleCtx, 320, 200, 1.0, 'idle', 0, makeMetrics());
    assert.equal(idleCtx.ops.length, 0);

    for (const [w, h] of [[1, 1], [3, 1], [1, 3], [7, 7], [18, 18]]) {
        const ctx = createStrictContext(w, h);
        dse.render(ctx, w, h, 1.0, 'playing', 1.0, undefined);
        assert.ok(ctx.ops.length > 0);
    }

    // Without audio beats, animation remains alive over time
    const silent = new YmSiliconBg();
    const c1 = createStrictContext(320, 200);
    const c2 = createStrictContext(320, 200);
    silent.render(c1, 320, 200, 1.0, 'playing', 1.0, {});
    silent.render(c2, 320, 200, 1.4, 'playing', 1.4, {});
    assert.notDeepEqual(c1.ops, c2.ops, 'silent scene must animate over time');
});

test('4. Determinism over 300 frames (identical ops stream)', () => {
    const a = new YmSiliconBg();
    const b = new YmSiliconBg();
    const w = 355, h = 200;

    for (let f = 0; f < 300; f++) {
        const ctxA = createStrictContext(w, h);
        const ctxB = createStrictContext(w, h);
        const t = 1 + f * 0.02;
        const state = f < 40 ? 'starting' : f < 140 ? 'playing' : f < 210 ? 'buildup' : f < 260 ? 'climax' : 'afterglow';
        const onBeat = f % 12 === 0;
        const m = makeMetrics({
            beatStarted: onBeat,
            beatCount: Math.floor(f / 12),
            beatStrength: onBeat ? 0.6 : 0,
            beatLevel: onBeat ? 2 : 0,
            beatImpulse: [Math.max(0, 0.6 - (f % 12) * 0.08)],
            tensionPct: state === 'climax' ? 0.95 : state === 'buildup' ? 0.65 : 0.30,
            smooth: [0.4 + 0.4 * Math.sin(f * 0.08), 0.5, 0.3]
        });
        a.render(ctxA, w, h, t, state, f * 0.02, m);
        b.render(ctxB, w, h, t, state, f * 0.02, m);
        assert.deepEqual(ctxA.ops, ctxB.ops, `frame ${f} differed`);
    }
});

test('5. Horizon contract protection: oscillator cores remain cleanly above 0.55*h in landscape & portrait', () => {
    for (const [w, h] of [[320, 200], [474, 200], [112, 200]]) {
        const dse = new YmSiliconBg();
        const horizon = Math.floor(h * 0.55);
        const ctx = createStrictContext(w, h);
        dse.render(ctx, w, h, 1.0, 'playing', 1.0, makeMetrics({
            smooth: [0.85, 0.70, 0.60],
            beatImpulse: [0.75]
        }));

        // Bright green/white oscillator waveform pixels must live exclusively inside the upper chip (y < horizon)
        const waveformOps = ctx.ops.filter(op => op.color === '#00fc00' && op.y < horizon);
        assert.ok(waveformOps.length > 5, `${w}x${h} must draw oscillator cores above horizon ${horizon}`);
        const lowerScopeBoxes = ctx.ops.filter(op => op.color === '#000000' && op.y >= horizon);
        assert.equal(lowerScopeBoxes.length, 0, `${w}x${h} oscillator scopes must not leak below floor horizon`);
    }
});

test('6. Discrete events trigger only on beatStarted (incl. beatCount=0, never on envelope)', () => {
    const dse = new YmSiliconBg();
    const w = 320, h = 200;

    // First beat with beatCount=0 must be accepted!
    dse.render(createStrictContext(w, h), w, h, 1.0, 'playing', 1.0, makeMetrics({
        beatStarted: true, beatCount: 0, beatStrength: 0.5, beatLevel: 2
    }));
    assert.equal(dse.lastBeatCount, 0);
    assert.ok(dse.dacWaveAge < 0.01);

    // Beats 1..3 -> themePhase stays 0
    for (let c = 1; c <= 3; c++) {
        dse.render(createStrictContext(w, h), w, h, 1.0 + c * 0.2, 'playing', 1.0, makeMetrics({
            beatStarted: true, beatCount: c, beatStrength: 0.5, beatLevel: 2
        }));
    }
    assert.equal(dse.themePhase, 0);

    // Decaying envelope without beatStarted must never advance themePhase or retrigger dacWave
    for (let i = 1; i <= 5; i++) {
        dse.render(createStrictContext(w, h), w, h, 1.7 + i * 0.02, 'playing', 1.0, makeMetrics({
            beat: [0.9],
            beatImpulse: [0.85],
            beatStarted: false,
            beatCount: 3,
            beatStrength: 0.9,
            beatLevel: 3
        }));
    }
    assert.equal(dse.themePhase, 0, 'envelope must not advance themePhase');
    assert.ok(dse.dacWaveAge >= 0.08, 'envelope must not retrigger dacWaveAge');

    // Beat 4 advances themePhase
    dse.render(createStrictContext(w, h), w, h, 2.0, 'playing', 1.0, makeMetrics({
        beatStarted: true, beatCount: 4, beatStrength: 0.5, beatLevel: 2
    }));
    assert.equal(dse.themePhase, 1);

    // Beat 8 flips busDir
    for (let c = 5; c <= 8; c++) {
        dse.render(createStrictContext(w, h), w, h, 2.0 + c * 0.2, 'playing', 1.0, makeMetrics({
            beatStarted: true, beatCount: c, beatStrength: 0.5, beatLevel: 2
        }));
    }
    assert.equal(dse.busDir, -1);
});

test('7. Graded beat intensities (soft 0.20, medium 0.50, hard 0.90) produce distinct visuals', () => {
    const w = 320, h = 200;

    const runLevel = (strength, level) => {
        const dse = new YmSiliconBg();
        const ctx = createStrictContext(w, h);
        dse.render(ctx, w, h, 1.0, 'climax', 2.0, makeMetrics({
            tensionPct: 0.95,
            smooth: [0.6, 0.5, 0.4],
            beatStarted: strength > 0,
            beatCount: strength > 0 ? 1 : 0,
            beatStrength: strength,
            beatLevel: level,
            beatImpulse: [strength]
        }));
        return {
            ops: ctx.ops,
            whiteCount: ctx.ops.filter(o => o.color === '#fcfcfc').length,
            tearActive: dse.tearBurstAge === 0,
            dacPeak: dse.dacWavePeak
        };
    };

    const soft = runLevel(0.20, 1);
    const medium = runLevel(0.50, 2);
    const hard = runLevel(0.90, 3);

    assert.equal(soft.tearActive, false);
    assert.equal(medium.tearActive, true);
    assert.equal(hard.tearActive, true);
    assert.ok(soft.dacPeak < medium.dacPeak && medium.dacPeak < hard.dacPeak);
    assert.ok(hard.whiteCount > soft.whiteCount, 'hard beat must emit prominent #fcfcfc register flashes');
    assert.notDeepEqual(soft.ops, medium.ops);
    assert.notDeepEqual(medium.ops, hard.ops);
});

test('8. Optional metrics.regs modulates waveforms safely and degrades cleanly on malformed regs', () => {
    const w = 320, h = 200;
    const base = new YmSiliconBg();
    const withRegs = new YmSiliconBg();

    const baseCtx = createStrictContext(w, h);
    const regCtx = createStrictContext(w, h);

    base.render(baseCtx, w, h, 1.0, 'playing', 1.0, makeMetrics({ smooth: [0.6, 0.5, 0.4] }));
    withRegs.render(regCtx, w, h, 1.0, 'playing', 1.0, makeMetrics({
        smooth: [0.6, 0.5, 0.4],
        regs: { periods: [180, 90, 45], envShape: 10, noisePeriod: 5 }
    }));
    assert.notDeepEqual(baseCtx.ops, regCtx.ops, 'valid YM regs should tune waveform frequencies');

    // Corrupt/partial regs must not throw or emit NaNs
    const dirtyCtx = createStrictContext(w, h);
    withRegs.render(dirtyCtx, w, h, 1.04, 'playing', 1.04, makeMetrics({
        regs: { r: [NaN, undefined, -5], periods: null, envShape: Infinity }
    }));
    assert.ok(dirtyCtx.ops.length > 0);
});

test('9. Macro states (starting 1.5s, playing, buildup, climax, afterglow, stopping 1.5s)', () => {
    const dse = new YmSiliconBg();
    const w = 355, h = 200;

    // starting(0.0) -> fully black curtain
    const s0 = createStrictContext(w, h);
    dse.render(s0, w, h, 0.0, 'starting', 0.0, makeMetrics());
    assert.equal(s0.ops.length, 1);
    assert.equal(s0.ops[0].color, '#000000');

    const playingCtx = createStrictContext(w, h);
    dse.render(playingCtx, w, h, 2.0, 'playing', 1.5, makeMetrics({ tensionPct: 0.30 }));

    const buildCtx = createStrictContext(w, h);
    dse.render(buildCtx, w, h, 2.5, 'buildup', 2.0, makeMetrics({ tensionPct: 0.68, smooth: [0.8, 0.7, 0.6] }));

    const climaxCtx = createStrictContext(w, h);
    dse.render(climaxCtx, w, h, 3.0, 'climax', 2.5, makeMetrics({
        tensionPct: 0.96, smooth: [0.9, 0.85, 0.8],
        beatStarted: true, beatCount: 4, beatStrength: 0.9, beatLevel: 3, beatImpulse: [0.9]
    }));

    // Afterglow settles to cool slate/silver palette without bright neon green/magenta
    let agCtx;
    for (let i = 0; i < 40; i++) {
        agCtx = createStrictContext(w, h);
        dse.render(agCtx, w, h, 3.1 + i * 0.05, 'afterglow', i * 0.05, makeMetrics({ tensionPct: 0.20 }));
    }
    const agColors = new Set(agCtx.ops.map(o => o.color));
    assert.equal(agColors.has('#00fc00'), false, 'afterglow must cool down out of neon green');
    assert.equal(agColors.has('#fc00fc'), false, 'afterglow must cool down out of bright magenta');

    assert.notDeepEqual(playingCtx.ops, buildCtx.ops);
    assert.notDeepEqual(buildCtx.ops, climaxCtx.ops);

    // stopping(1.5) -> clean full black end state
    const stopEnd = createStrictContext(w, h);
    dse.render(stopEnd, w, h, 6.0, 'stopping', 1.5, makeMetrics());
    assert.equal(stopEnd.ops.length, 1);
    assert.equal(stopEnd.ops[0].color, '#000000');
});

test('10. Rotation continuity, extreme viewports & <= 4000 fillRect budget', () => {
    const viewports = [
        [66, 200],
        [92, 200],
        [112, 200],
        [320, 200],
        [355, 200],
        [474, 200],
        [600, 200]
    ];

    for (const [w, h] of viewports) {
        const dse = new YmSiliconBg();
        const ctx = createStrictContext(w, h);
        dse.render(ctx, w, h, 1.0, 'climax', 2.0, makeMetrics({
            tensionPct: 0.96,
            smooth: [0.9, 0.85, 0.8],
            beatStarted: true,
            beatCount: 4,
            beatStrength: 0.9,
            beatLevel: 3,
            beatImpulse: [0.9]
        }));
        assert.ok(ctx.ops.length > 0, `expected output for ${w}x${h}`);
        assert.ok(ctx.ops.length <= 4000, `${w}x${h} drew ${ctx.ops.length} fillRects (> 4000 budget)`);
    }

    // Same-instance portrait -> landscape -> portrait preserves internal phases & beat state
    const rot = new YmSiliconBg();
    rot.render(createStrictContext(112, 200), 112, 200, 1.0, 'playing', 1.0, makeMetrics({
        beatStarted: true, beatCount: 4, beatStrength: 0.5, beatLevel: 2
    }));
    const savedTheme = rot.themePhase;
    const savedT = rot.internalT;

    const landCtx = createStrictContext(474, 200);
    rot.render(landCtx, 474, 200, 1.04, 'playing', 1.04, makeMetrics());
    assert.equal(rot.themePhase, savedTheme);
    assert.ok(rot.internalT > savedT);
    assert.ok(landCtx.ops.length > 0);

    const portCtx = createStrictContext(112, 200);
    rot.render(portCtx, 112, 200, 1.08, 'playing', 1.08, makeMetrics());
    assert.equal(rot.themePhase, savedTheme);
    assert.ok(portCtx.ops.length > 0);
});