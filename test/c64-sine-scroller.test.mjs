import test from 'node:test';
import assert from 'node:assert/strict';
import { C64SineScroller } from '../js/visuals/dse/c64/sine-scroller.js';
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

function makeScrollerMetrics(overrides = {}) {
    return {
        system: 'c64',
        energy: 0.45,
        pulse: 0.1,
        tensionPct: 0.40,
        beat: [0],
        beatImpulse: [0],
        beatStarted: false,
        beatCount: 0,
        beatStrength: 0,
        beatLevel: 0,
        smooth: [0.2, 0.2, 0.2],
        isClimaxLocked: false,
        ...overrides
    };
}

test('Smoke, Numerik, kein fillText/measureText, kein Vollbild-Schwarz-Fade & Stopping-Ende', () => {
    const scroller = new C64SineScroller();

    const idleCanvas = createUltraStrictFgCanvas(320, 200);
    scroller.render(idleCanvas.ctx, 320, 200, 0, 'idle', 0, undefined);
    assert.equal(idleCanvas.rects.length, 0);

    scroller.render(idleCanvas.ctx, 0, 200, 0.02, 'playing', 0, undefined);
    scroller.render(idleCanvas.ctx, 320, 0, 0.04, 'playing', 0, undefined);
    scroller.render(idleCanvas.ctx, NaN, 200, 0.06, 'playing', 0, undefined);
    scroller.render(idleCanvas.ctx, 320, -2, 0.08, 'playing', 0, undefined);

    const states = ['starting', 'playing', 'buildup', 'climax', 'afterglow', 'stopping'];
    let t = 0.2;
    for (const st of states) {
        const c = createUltraStrictFgCanvas(320, 200);
        scroller.render(c.ctx, 320, 200, t, st, 0.25, undefined);
        assert.ok(c.rects.length > 0, `Zustand ${st} muss ohne Metriken zeichnen`);
        // Foreground darf nie ein Vollbild-Schwarz-Dither zeichnen
        const fullScreenBlack = c.rects.some(r => r.w === 320 && r.h === 200 && r.fillStyle === '#000000');
        assert.equal(fullScreenBlack, false);
        t += 0.02;
    }

    const snapA = createUltraStrictFgCanvas(320, 200);
    const snapB = createUltraStrictFgCanvas(320, 200);
    scroller.render(snapA.ctx, 320, 200, t, 'playing', t, undefined);
    scroller.render(snapB.ctx, 320, 200, t, 'playing', t, undefined);
    assert.deepEqual(snapA.rects, snapB.rects);

    const endStop = createUltraStrictFgCanvas(320, 200);
    scroller.render(endStop.ctx, 320, 200, t + 0.02, 'stopping', 1.5, undefined);
    assert.equal(endStop.rects.length, 0, 'Bei vis = 0 darf Foreground nichts mehr zeichnen');
});

test('Determinismus: gleiche Eingabesequenz über 300 Frames liefert bit-identische Ausgabe', () => {
    const sA = new C64SineScroller();
    const sB = new C64SineScroller();
    const outA = [];
    const outB = [];

    for (let f = 0; f < 300; f++) {
        const state = f < 25 ? 'starting' : f < 100 ? 'playing' : f < 180 ? 'buildup' : f < 250 ? 'climax' : 'afterglow';
        const m = makeMetrics('c64', state === 'starting' ? 'playing' : state, f, 'pattern', f);
        const t = 1 + f / 50;

        const cA = createUltraStrictFgCanvas(320, 200);
        const cB = createUltraStrictFgCanvas(320, 200);
        sA.render(cA.ctx, 320, 200, t, state, f * 0.02, m);
        sB.render(cB.ctx, 320, 200, t, state, f * 0.02, m);
        outA.push(cA.rects);
        outB.push(cB.rects);
    }

    assert.deepEqual(outA, outB);
});

test('Zusatztests §5.3: Outline vor Farbpass, fam nur bei % 4, scrollPos-Erhalt Porträt <-> Querformat, stopping ohne neue Zeichen', () => {
    const scroller = new C64SineScroller();

    // 1. Outline-Pass (#000000) kommt strikt vor Farbpass (in playing ohne Echo)
    const cOrder = createUltraStrictFgCanvas(320, 200);
    scroller.render(cOrder.ctx, 320, 200, 0.02, 'playing', 0.02, makeScrollerMetrics({ tensionPct: 0.2 }));
    let seenColor = false;
    for (const r of cOrder.rects) {
        const isOutlineBlack = r.fillStyle.toLowerCase() === '#000000';
        if (!isOutlineBlack) {
            seenColor = true;
        } else {
            assert.equal(seenColor, false, 'Outline-Rechtecke müssen strikt VOR dem Farbpass gezeichnet werden');
        }
    }
    assert.ok(seenColor, 'Farbpass muss nach dem Outline-Pass zeichnen');

    // 2. Moduswechsel Porträt (92x200) -> Querformat (432x200) -> Porträt erhält scrollPos
    const cPort = createUltraStrictFgCanvas(92, 200);
    scroller.render(cPort.ctx, 92, 200, 0.04, 'playing', 0.04, makeScrollerMetrics({ tensionPct: 0.2 }));
    const posAfterPortrait = scroller.scrollPos;
    assert.ok(posAfterPortrait > 0);

    const cLand = createUltraStrictFgCanvas(432, 200);
    scroller.render(cLand.ctx, 432, 200, 0.06, 'playing', 0.06, makeScrollerMetrics({ tensionPct: 0.2 }));
    assert.ok(scroller.scrollPos >= posAfterPortrait, 'Resize darf scrollPos nicht zurücksetzen');

    // 3. fam wechselt nur bei count % 4 === 0, phiSign kippt bei count % 8 === 0
    for (let b = 1; b <= 3; b++) {
        const cb = createUltraStrictFgCanvas(320, 200);
        scroller.render(cb.ctx, 320, 200, 0.1 + b * 0.2, 'playing', 0.1 + b * 0.2, makeScrollerMetrics({
            beatStarted: true,
            beatCount: b,
            beatStrength: 0.5,
            beatLevel: 2
        }));
        assert.equal(scroller.wipeActive, false);
        assert.equal(scroller.fam, 0);
    }

    const c4 = createUltraStrictFgCanvas(320, 200);
    scroller.render(c4.ctx, 320, 200, 1.0, 'playing', 1.0, makeScrollerMetrics({
        beatStarted: true,
        beatCount: 4,
        beatStrength: 0.5,
        beatLevel: 2
    }));
    assert.equal(scroller.wipeActive, true);
    assert.equal(scroller.wipeTo, 1);

    const c8 = createUltraStrictFgCanvas(320, 200);
    scroller.render(c8.ctx, 320, 200, 1.8, 'playing', 1.8, makeScrollerMetrics({
        beatStarted: true,
        beatCount: 8,
        beatStrength: 0.9,
        beatLevel: 3
    }));
    assert.equal(scroller.phiSign, -1, 'Jeder 8. Beat kippt die Wellenlaufrichtung');

    // 4. In stopping werden keine neuen Nicht-Leerzeichen mehr eingespeist
    const cStopStart = createUltraStrictFgCanvas(320, 200);
    scroller.render(cStopStart.ctx, 320, 200, 1.82, 'stopping', 0.02, makeScrollerMetrics());
    const cutoff = scroller.stopCutoff;
    assert.ok(Number.isFinite(cutoff));
    assert.equal(scroller._charAt(cutoff, true), ' ');
    assert.equal(scroller._charAt(cutoff + 5, true), ' ');

    // Nach ausreichend Auslaufzeit (t < 1.5s Auslaufweg) ist der Bildschirm komplett leergescrollt
    let lastStopRects = 1;
    for (let s = 1; s <= 70; s++) {
        const cs = createUltraStrictFgCanvas(320, 200);
        scroller.render(cs.ctx, 320, 200, 1.82 + s * 0.02, 'stopping', 0.02 + s * 0.02, makeScrollerMetrics());
        lastStopRects = cs.rects.length;
    }
    assert.equal(lastStopRects, 0, 'Alle vorhandenen Glyphen laufen in stopping leer aus');
});

test('Beat-Intensität (§8): rasterPhase-Delta & Top-Glyphen unterscheiden soft / medium / hard', () => {
    const modes = ['soft', 'medium', 'hard'];
    const rasterAfterBeat = {};
    const topCounts = {};
    const onsetSnaps = {};
    const frame8Snaps = {};

    for (const mode of modes) {
        const s = GRADED_BEAT_STRENGTHS[mode];
        const lvl = mode === 'soft' ? 1 : (mode === 'medium' ? 2 : 3);
        const scroller = new C64SineScroller();

        const c0 = createUltraStrictFgCanvas(320, 200);
        scroller.render(c0.ctx, 320, 200, 1.0, 'playing', 3.0, makeScrollerMetrics({
            tensionPct: 0.35,
            beatStarted: true,
            beatCount: 1,
            beat: [1.0],
            beatImpulse: [s],
            beatStrength: s,
            beatLevel: lvl,
            smooth: [0.1, 0.8, 0.2]
        }));
        rasterAfterBeat[mode] = scroller.rasterPhase;
        topCounts[mode] = scroller.lastTopGlyphCount;
        onsetSnaps[mode] = c0.rects;

        let lastRects = c0.rects;
        for (let f = 1; f <= 8; f++) {
            const env = Math.max(0, 0.82 - f * 0.19);
            const cf = createUltraStrictFgCanvas(320, 200);
            scroller.render(cf.ctx, 320, 200, 1.0 + f / 18, 'playing', 3.0 + f / 18, makeScrollerMetrics({
                tensionPct: 0.35,
                beatStarted: false,
                beatCount: 1,
                beat: [env],
                beatImpulse: [env * s],
                beatStrength: s,
                beatLevel: lvl,
                smooth: [0.1, 0.8, 0.2]
            }));
            lastRects = cf.rects;
        }
        frame8Snaps[mode] = lastRects;
    }

    assert.ok(rasterAfterBeat.soft < rasterAfterBeat.medium && rasterAfterBeat.medium < rasterAfterBeat.hard);
    assert.deepEqual(topCounts, { soft: 0, medium: 1, hard: 3 });

    assert.notDeepEqual(onsetSnaps.soft, onsetSnaps.medium);
    assert.notDeepEqual(onsetSnaps.medium, onsetSnaps.hard);
    assert.notDeepEqual(frame8Snaps.soft, frame8Snaps.medium);
    assert.notDeepEqual(frame8Snaps.medium, frame8Snaps.hard);
});

test('Responsive Viewports (wide & tall, 1:3, 3:1, Ultrawide), Echo-Zeile & Budget <= 2500 fillRect', () => {
    const scroller = new C64SineScroller();
    const viewports = [
        [32, 32],
        [67, 200],  // 1:3 tall
        [92, 200],  // Mobile Porträt tall
        [112, 200], // Kleines Mobile Porträt tall
        [320, 200], // C64 4:3 wide
        [432, 200], // Mobile Landscape wide
        [474, 200], // Ultrawide wide
        [600, 200], // 3:1 Extrem-Landscape wide
        [92, 200]   // Rück-Rotation nach tall
    ];

    let t = 0.02;
    // In Climax aufwärmen (Echo-Zeile aktiv)
    for (let i = 0; i < 40; i++) {
        const c = createUltraStrictFgCanvas(320, 200);
        scroller.render(c.ctx, 320, 200, t, 'climax', t, makeScrollerMetrics({
            tensionPct: 0.95,
            beatStarted: i === 10,
            beatCount: i === 10 ? 1 : 0,
            beatImpulse: [0.7],
            smooth: [0.8, 0.6, 0.9]
        }));
        t += 0.02;
    }
    assert.equal(scroller.echoActive, true, 'Echo-Zeile muss im Climax aktiv sein');

    for (const [w, h] of viewports) {
        const c = createUltraStrictFgCanvas(w, h);
        scroller.render(c.ctx, w, h, t, 'climax', t, makeScrollerMetrics({
            tensionPct: 0.95,
            beatImpulse: [0.7],
            smooth: [0.8, 0.6, 0.9]
        }));
        assert.ok(c.rects.length > 0, `Viewport ${w}x${h} muss zeichnen`);
        assert.ok(c.rects.length <= 2500, `Budget <= 2500 überschritten bei ${w}x${h}: ${c.rects.length}`);
        t += 0.02;
    }
});