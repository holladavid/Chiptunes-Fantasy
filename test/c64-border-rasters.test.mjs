import test from 'node:test';
import assert from 'node:assert/strict';
import { C64BorderRasters } from '../js/visuals/dse/c64/border-rasters.js';
import { C64_PALETTE, rgbToHex } from '../js/visuals/utils/hardware-constraints.js';
import { makeMetrics, GRADED_BEAT_STRENGTHS } from '../tools/dse-baseline/harness.js';

const VALID_C64_HEX = new Set(C64_PALETTE.map(([r, g, b]) => rgbToHex(r, g, b).toLowerCase()));

function createUltraStrictFgCanvas(width, height) {
    const rects = [];
    let currentStyle = '#000000';
    let globalAlphaVal = 1.0;

    const forbid = (name) => () => {
        throw new Error(`Verbotene Canvas-Operation in DSE aufgerufen: ${name}`);
    };

    const ctx = {
        get globalAlpha() { return globalAlphaVal; },
        set globalAlpha(val) {
            assert.equal(val, 1, `globalAlpha muss 1 bleiben, erhalten: ${val}`);
            globalAlphaVal = val;
        },
        get fillStyle() { return currentStyle; },
        set fillStyle(val) { currentStyle = String(val); },
        fillRect(x, y, w, h) {
            assert.ok(Number.isFinite(x) && Number.isFinite(y), `Ungültige Koordinate (${x}, ${y})`);
            assert.ok(Number.isFinite(w) && Number.isFinite(h), `Ungültige Größe (${w}x${h})`);
            assert.ok(w > 0 && h > 0, `Nichtpositive Größe: ${w}x${h}`);
            assert.equal(x, Math.floor(x), `x nicht ganzzahlig: ${x}`);
            assert.equal(y, Math.floor(y), `y nicht ganzzahlig: ${y}`);
            assert.equal(w, Math.floor(w), `w nicht ganzzahlig: ${w}`);
            assert.equal(h, Math.floor(h), `h nicht ganzzahlig: ${h}`);
            assert.ok(x >= 0 && x + w <= width, `X außerhalb: ${x}+${w} > ${width}`);
            assert.ok(y >= 0 && y + h <= height, `Y außerhalb: ${y}+${h} > ${height}`);
            assert.ok(VALID_C64_HEX.has(currentStyle.toLowerCase()), `Unerlaubte C64-Farbe: ${currentStyle}`);
            rects.push({ x, y, w, h, fillStyle: currentStyle });
        },
        fillText: forbid('fillText'),
        measureText: forbid('measureText'),
        save: forbid('save'),
        restore: forbid('restore'),
        clip: forbid('clip'),
        getImageData: forbid('getImageData'),
        arc: forbid('arc'),
        lineTo: forbid('lineTo')
    };

    return { ctx, rects };
}

function makeBorderMetrics(overrides = {}) {
    return {
        system: 'c64',
        energy: 0.45,
        pulse: 0.1,
        tensionPct: 0.35,
        beat: [0],
        beatImpulse: [0],
        beatStarted: false,
        beatCount: 0,
        beatStrength: 0,
        beatLevel: 0,
        smooth: [0.3, 0.3, 0.3],
        isClimaxLocked: false,
        ...overrides
    };
}

test('Smoke, Numerik, PAL-Zeitbasis, kein Schwarz-Vollbild-Fade & Stopping-Ende', () => {
    const border = new C64BorderRasters();

    const idleCanvas = createUltraStrictFgCanvas(320, 200);
    border.render(idleCanvas.ctx, 320, 200, 0, 'idle', 0, undefined);
    assert.equal(idleCanvas.rects.length, 0);

    border.render(idleCanvas.ctx, 0, 200, 0.02, 'playing', 0, undefined);
    border.render(idleCanvas.ctx, 320, 0, 0.04, 'playing', 0, undefined);
    border.render(idleCanvas.ctx, NaN, 200, 0.06, 'playing', 0, undefined);
    border.render(idleCanvas.ctx, 320, -2, 0.08, 'playing', 0, undefined);

    const states = ['starting', 'playing', 'buildup', 'climax', 'afterglow', 'stopping'];
    let t = 0.2;
    for (const st of states) {
        const c = createUltraStrictFgCanvas(320, 200);
        border.render(c.ctx, 320, 200, t, st, 0.25, undefined);
        assert.ok(c.rects.length > 0, `Zustand ${st} muss ohne Metriken zeichnen`);
        assert.equal(c.rects.some(r => r.w === 320 && r.h === 200 && r.fillStyle === '#000000'), false);
        t += 0.02;
    }

    const snapA = createUltraStrictFgCanvas(320, 200);
    const snapB = createUltraStrictFgCanvas(320, 200);
    border.render(snapA.ctx, 320, 200, t, 'playing', t, undefined);
    border.render(snapB.ctx, 320, 200, t, 'playing', t, undefined);
    assert.deepEqual(snapA.rects, snapB.rects);

    const endStop = createUltraStrictFgCanvas(320, 200);
    border.render(endStop.ctx, 320, 200, t + 0.02, 'stopping', 1.5, undefined);
    assert.equal(endStop.rects.length, 0, 'Bei vis = 0 darf Foreground nichts mehr zeichnen');
});

test('Determinismus: gleiche Eingabesequenz über 300 Frames liefert bit-identische Ausgabe', () => {
    const bA = new C64BorderRasters();
    const bB = new C64BorderRasters();
    const outA = [];
    const outB = [];

    for (let f = 0; f < 300; f++) {
        const state = f < 25 ? 'starting' : f < 100 ? 'playing' : f < 180 ? 'buildup' : f < 250 ? 'climax' : 'afterglow';
        const m = makeMetrics('c64', state === 'starting' ? 'playing' : state, f, 'pattern', f);
        const t = 1 + f / 50;

        const cA = createUltraStrictFgCanvas(320, 200);
        const cB = createUltraStrictFgCanvas(320, 200);
        bA.render(cA.ctx, 320, 200, t, state, f * 0.02, m);
        bB.render(cB.ctx, 320, 200, t, state, f * 0.02, m);
        outA.push(cA.rects);
        outB.push(cB.rects);
    }

    assert.deepEqual(outA, outB);
});

test('Zusatztests §5.4: Pool <= 8, Sprites nur bei beatStarted level 3 (oder medium im climax), Innenbereich unberührt, rot nur bei % 4', () => {
    const border = new C64BorderRasters();

    // Hüllkurve ohne beatStarted darf weder Sprites noch rot auslösen
    for (let i = 0; i < 15; i++) {
        const c = createUltraStrictFgCanvas(320, 200);
        border.render(c.ctx, 320, 200, 0.02 * (i + 1), 'climax', 0.02 * (i + 1), makeBorderMetrics({
            tensionPct: 0.95,
            beatStarted: false,
            beat: [0.95],
            beatImpulse: [0.95],
            beatStrength: 0.95,
            beatLevel: 3
        }));
    }
    assert.ok(border.sprites.every(s => !s.active), 'Ohne beatStarted dürfen keine Sprites spawnen');
    assert.equal(border.rot, 0);

    // Ohne Sprites darf NICHTS im Inneren [btEff, w-btEff) x [btEff, h-btEff) gezeichnet werden!
    const cNoSprites = createUltraStrictFgCanvas(320, 200);
    border.render(cNoSprites.ctx, 320, 200, 0.40, 'climax', 0.40, makeBorderMetrics({
        tensionPct: 0.95,
        beatImpulse: [0]
    }));
    const btEff = border.lastBtEff;
    for (const r of cNoSprites.rects) {
        const touchesInteriorX = r.x + r.w > btEff && r.x < 320 - btEff;
        const touchesInteriorY = r.y + r.h > btEff && r.y < 200 - btEff;
        assert.equal(touchesInteriorX && touchesInteriorY, false,
            `Rahmenoperation berührt Innenbereich (${r.x},${r.y},${r.w},${r.h}) bei btEff=${btEff}`);
    }

    // In playing: medium (level 2) darf KEIN Sprite spawnen
    const cMedPlay = createUltraStrictFgCanvas(320, 200);
    border.render(cMedPlay.ctx, 320, 200, 0.50, 'playing', 0.50, makeBorderMetrics({
        tensionPct: 0.30,
        beatStarted: true,
        beatCount: 1,
        beatStrength: 0.5,
        beatLevel: 2
    }));
    assert.equal(border.sprites.filter(s => s.active).length, 0);
    assert.equal(border.rot, 0);

    // In climax: medium (level 2) spawnt genau 1 Sprite
    const cMedClimax = createUltraStrictFgCanvas(320, 200);
    border.render(cMedClimax.ctx, 320, 200, 0.60, 'climax', 0.60, makeBorderMetrics({
        tensionPct: 0.95,
        beatStarted: true,
        beatCount: 2,
        beatStrength: 0.5,
        beatLevel: 2
    }));
    assert.equal(border.sprites.filter(s => s.active).length, 1);
    assert.equal(border.rot, 0);

    // Beat 4 dreht rot um 1, Beat 8 kippt sinSign & loopDir
    const c4 = createUltraStrictFgCanvas(320, 200);
    border.render(c4.ctx, 320, 200, 1.0, 'climax', 1.0, makeBorderMetrics({
        tensionPct: 0.95,
        beatStarted: true,
        beatCount: 4,
        beatStrength: 0.9,
        beatLevel: 3
    }));
    assert.equal(border.rot, 1);

    // Pool mit vielen Hard-Beats fluten -> aktiv nie > 8
    for (let k = 0; k < 15; k++) {
        const ck = createUltraStrictFgCanvas(320, 200);
        border.render(ck.ctx, 320, 200, 1.3 + k * 0.30, 'climax', 1.3 + k * 0.30, makeBorderMetrics({
            tensionPct: 0.95,
            beatStarted: true,
            beatCount: 8 + k,
            beatStrength: 0.9,
            beatLevel: 3
        }));
    }
    assert.equal(border.sprites.length, 8);
    assert.ok(border.sprites.filter(s => s.active).length <= 8);
    assert.equal(border.sinSign, -1);
    assert.equal(border.loopDir, -1);
});

test('Beat-Intensität (§8): Kernstufe & Spritezahl unterscheiden soft / medium / hard', () => {
    const modes = ['soft', 'medium', 'hard'];
    const coreStages = {};
    const spriteCounts = {};
    const onsetSnaps = {};
    const frame8Snaps = {};

    for (const mode of modes) {
        const s = GRADED_BEAT_STRENGTHS[mode];
        const lvl = mode === 'soft' ? 1 : (mode === 'medium' ? 2 : 3);
        const border = new C64BorderRasters();

        const c0 = createUltraStrictFgCanvas(320, 200);
        border.render(c0.ctx, 320, 200, 1.0, 'playing', 3.0, makeBorderMetrics({
            tensionPct: 0.35,
            beatStarted: true,
            beatCount: 1,
            beat: [1.0],
            beatImpulse: [s],
            beatStrength: s,
            beatLevel: lvl,
            smooth: [0.8, 0.2, 0.3]
        }));
        coreStages[mode] = border.lastCoreStage;
        spriteCounts[mode] = border.sprites.filter(sp => sp.active).length;
        onsetSnaps[mode] = c0.rects;

        let lastRects = c0.rects;
        for (let f = 1; f <= 8; f++) {
            const env = Math.max(0, 0.82 - f * 0.19);
            const cf = createUltraStrictFgCanvas(320, 200);
            border.render(cf.ctx, 320, 200, 1.0 + f / 18, 'playing', 3.0 + f / 18, makeBorderMetrics({
                tensionPct: 0.35,
                beatStarted: false,
                beatCount: 1,
                beat: [env],
                beatImpulse: [env * s],
                beatStrength: s,
                beatLevel: lvl,
                smooth: [0.8, 0.2, 0.3]
            }));
            lastRects = cf.rects;
        }
        frame8Snaps[mode] = lastRects;
    }

    assert.deepEqual(coreStages, { soft: 1, medium: 2, hard: 3 });
    assert.deepEqual(spriteCounts, { soft: 0, medium: 0, hard: 1 });

    assert.notDeepEqual(onsetSnaps.soft, onsetSnaps.medium);
    assert.notDeepEqual(onsetSnaps.medium, onsetSnaps.hard);
    assert.notDeepEqual(frame8Snaps.soft, frame8Snaps.medium);
    assert.notDeepEqual(frame8Snaps.medium, frame8Snaps.hard);
});

test('Responsive Viewports, btEff <= floor(minDim/4), Rotation & Budget im Climax', () => {
    const border = new C64BorderRasters();
    const viewports = [
        [32, 32],
        [67, 200],  // 1:3 Extrem-Porträt
        [92, 200],  // Mobile Porträt
        [112, 200], // Kleines Mobile Porträt
        [320, 200], // C64 4:3
        [432, 200], // Mobile Landscape
        [474, 200], // Ultrawide (2560x1080)
        [600, 200], // 3:1 Extrem-Landscape
        [92, 200]   // Rück-Rotation
    ];

    let t = 0.02;
    for (let i = 0; i < 8; i++) {
        const c = createUltraStrictFgCanvas(320, 200);
        border.render(c.ctx, 320, 200, t, 'climax', t, makeBorderMetrics({
            tensionPct: 0.95,
            beatStarted: true,
            beatCount: i + 1,
            beatStrength: 0.9,
            beatLevel: 3,
            beatImpulse: [1.0],
            smooth: [0.9, 0.8, 0.95]
        }));
        t += 0.28;
    }

    for (const [w, h] of viewports) {
        const c = createUltraStrictFgCanvas(w, h);
        border.render(c.ctx, w, h, t, 'climax', t, makeBorderMetrics({
            tensionPct: 0.95,
            beatImpulse: [1.0],
            smooth: [0.9, 0.8, 0.95]
        }));
        assert.ok(c.rects.length > 0, `Viewport ${w}x${h} muss zeichnen`);
        assert.ok(border.lastBtEff <= Math.floor(Math.min(w, h) / 4),
            `btEff (${border.lastBtEff}) > floor(minDim/4) bei ${w}x${h}`);
        assert.ok(c.rects.length <= 1600, `Budget überschritten bei ${w}x${h}: ${c.rects.length}`);
        t += 0.02;
    }
});