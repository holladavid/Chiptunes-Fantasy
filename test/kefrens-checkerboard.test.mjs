// === test/kefrens-checkerboard.test.mjs ===
import test from 'node:test';
import assert from 'node:assert/strict';
import { KefrensCheckerboard } from '../js/visuals/dse/amiga/kefrens-checkerboard.js';

function createStrictFakeCanvas(width, height) {
    const rects = [];
    let currentStyle = '#000000';

    const ctx = {
        get fillStyle() {
            return currentStyle;
        },
        set fillStyle(val) {
            currentStyle = String(val);
        },
        fillRect(x, y, w, h) {
            assert.ok(Number.isFinite(x), `x muss endlich sein (${x})`);
            assert.ok(Number.isFinite(y), `y muss endlich sein (${y})`);
            assert.ok(Number.isFinite(w) && w >= 0, `w muss endlich und >= 0 sein (${w})`);
            assert.ok(Number.isFinite(h) && h >= 0, `h muss endlich und >= 0 sein (${h})`);
            assert.equal(x, Math.floor(x), `x muss ganzzahlig sein (${x})`);
            assert.equal(y, Math.floor(y), `y muss ganzzahlig sein (${y})`);
            assert.equal(w, Math.floor(w), `w muss ganzzahlig sein (${w})`);
            assert.equal(h, Math.floor(h), `h muss ganzzahlig sein (${h})`);
            assert.ok(x >= 0 && x + w <= width, `Rechteck außerhalb Breite: ${x}+${w} > ${width}`);
            assert.ok(y >= 0 && y + h <= height, `Rechteck außerhalb Höhe: ${y}+${h} > ${height}`);
            rects.push({ x, y, w, h, fillStyle: currentStyle });
        }
        // Bewusst KEIN fillText, measureText, arc, lineTo, globalAlpha-Support
    };

    return { ctx, rects };
}

function assertAmiga12BitHex(hex) {
    assert.match(hex, /^#[0-9a-fA-F]{6}$/, `Erwartet #RRGGBB, erhalten: ${hex}`);
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    assert.equal(r % 17, 0, `Rot nicht 12-Bit quantisiert: ${r} (${hex})`);
    assert.equal(g % 17, 0, `Grün nicht 12-Bit quantisiert: ${g} (${hex})`);
    assert.equal(b % 17, 0, `Blau nicht 12-Bit quantisiert: ${b} (${hex})`);
}

function makeTestMetrics(overrides = {}) {
    return {
        system: 'amiga',
        energy: 0.45,
        pulse: 0.1,
        tensionPct: 0.4,
        beat: [0.0],
        beatImpulse: [0.0],
        beatStarted: false,
        beatCount: 0,
        beatStrength: 0.0,
        beatLevel: 0,
        smooth: [0.4, 0.35, 0.3, 0.2],
        isClimaxLocked: false,
        ...overrides
    };
}

test('Smoke & Idle: alle Zustände und fehlende Metriken rendern fehlerfrei', () => {
    const dse = new KefrensCheckerboard();

    // idle darf nichts zeichnen
    const idleCanvas = createStrictFakeCanvas(455, 256);
    dse.render(idleCanvas.ctx, 455, 256, 0.0, 'idle', 0, undefined);
    assert.equal(idleCanvas.rects.length, 0);

    // Ungültige Buffergrößen dürfen nicht crashen
    dse.render(idleCanvas.ctx, 0, 256, 0.02, 'playing', 0, undefined);
    dse.render(idleCanvas.ctx, 455, 0, 0.04, 'playing', 0, undefined);
    dse.render(idleCanvas.ctx, NaN, 256, 0.06, 'playing', 0, undefined);

    const states = ['starting', 'playing', 'buildup', 'climax', 'afterglow', 'stopping'];
    let t = 0.1;
    for (const st of states) {
        const c = createStrictFakeCanvas(455, 256);
        dse.render(c.ctx, 455, 256, t, st, 0.25, undefined);
        assert.ok(c.rects.length > 0, `Zustand ${st} sollte Rechtecke zeichnen`);
        for (const r of c.rects) {
            assertAmiga12BitHex(r.fillStyle);
        }
        t += 0.02;
    }
});

test('Determinismus: identische Eingabesequenzen liefern identische Ausgabe', () => {
    const dseA = new KefrensCheckerboard();
    const dseB = new KefrensCheckerboard();

    const seq = [];
    for (let i = 0; i < 120; i++) {
        const beatStarted = i % 15 === 0;
        const beatEnv = Math.max(0, 1 - (i % 15) / 10);
        const strength = beatStarted ? 0.5 : 0.5;
        seq.push({
            t: i * 0.02,
            state: i < 20 ? 'starting' : (i < 60 ? 'playing' : (i < 95 ? 'climax' : 'afterglow')),
            metrics: makeTestMetrics({
                energy: 0.3 + (i % 20) * 0.03,
                tensionPct: Math.min(1, i / 90),
                beat: [beatEnv],
                beatImpulse: [beatEnv * strength],
                beatStarted,
                beatCount: Math.floor(i / 15) + 1,
                beatStrength: strength,
                beatLevel: 2
            })
        });
    }

    const outA = [];
    const outB = [];
    for (const step of seq) {
        const cA = createStrictFakeCanvas(455, 256);
        const cB = createStrictFakeCanvas(455, 256);
        dseA.render(cA.ctx, 455, 256, step.t, step.state, step.t, step.metrics);
        dseB.render(cB.ctx, 455, 256, step.t, step.state, step.t, step.metrics);
        outA.push(cA.rects);
        outB.push(cB.rects);
    }

    assert.deepEqual(outA, outB);
});

test('Exakte Beats vs. abklingende Hüllkurve: kein Retrigger ohne beatStarted', () => {
    const dse = new KefrensCheckerboard();
    const c = createStrictFakeCanvas(455, 256);

    // Beat 4 löst Palettenwechsel aus
    dse.render(c.ctx, 455, 256, 0.02, 'playing', 0.02, makeTestMetrics({
        beatStarted: true,
        beatCount: 4,
        beat: [1.0],
        beatImpulse: [0.9],
        beatStrength: 0.9,
        beatLevel: 3
    }));
    const paletteAfterBeat4 = dse.paletteIndex;
    assert.equal(paletteAfterBeat4, 1);

    // 25 Frames hohe Hüllkurve und beatLevel=3, aber beatStarted=false -> KEIN Retrigger!
    for (let i = 1; i <= 25; i++) {
        const frame = createStrictFakeCanvas(455, 256);
        dse.render(frame.ctx, 455, 256, 0.02 + i * 0.02, 'playing', 0.02 + i * 0.02, makeTestMetrics({
            beatStarted: false,
            beatCount: 4,
            beat: [0.85],
            beatImpulse: [0.76],
            beatStrength: 0.9,
            beatLevel: 3
        }));
        assert.equal(dse.paletteIndex, paletteAfterBeat4, `Frame ${i} darf Palette nicht neu wechseln`);
    }
});

test('Graduelle Beat-Stärken (0.20 / 0.50 / 0.90) erzeugen unterscheidbare Ausschläge', () => {
    const strengths = [0.20, 0.50, 0.90];
    const snapshots = strengths.map((s) => {
        const dse = new KefrensCheckerboard();
        const c = createStrictFakeCanvas(455, 256);
        dse.render(c.ctx, 455, 256, 0.02, 'playing', 0.02, makeTestMetrics({
            beatStarted: true,
            beatCount: 1,
            beat: [1.0],
            beatImpulse: [s],
            beatStrength: s,
            beatLevel: s < 0.33 ? 1 : (s < 0.66 ? 2 : 3)
        }));
        return c.rects;
    });

    assert.notDeepEqual(snapshots[0], snapshots[1], 'Soft (0.20) und Medium (0.50) müssen sich unterscheiden');
    assert.notDeepEqual(snapshots[1], snapshots[2], 'Medium (0.50) und Hard (0.90) müssen sich unterscheiden');
});

test('Zustände & Afterglow: kontinuierlicher Übergang und unterscheidbare Zustände', () => {
    const dse = new KefrensCheckerboard();
    const renderAt = (t, state, tensionPct = 0.5) => {
        const c = createStrictFakeCanvas(455, 256);
        dse.render(c.ctx, 455, 256, t, state, t, makeTestMetrics({ tensionPct }));
        return c.rects;
    };

    const playing = renderAt(1.0, 'playing', 0.3);
    const climax = renderAt(2.0, 'climax', 0.95);
    const afterglowStart = renderAt(2.02, 'afterglow', 0.2);
    const afterglowSettled = renderAt(3.5, 'afterglow', 0.1);

    assert.notDeepEqual(playing, climax);
    assert.notDeepEqual(climax, afterglowSettled);
    assert.ok(afterglowStart.length > 0);
    assert.ok(afterglowSettled.length > 0);
});

test('Responsive Viewports & Rotation (Portrait -> Landscape -> Portrait auf derselben Instanz)', () => {
    const dse = new KefrensCheckerboard();

    // Typische Amiga-Buffer (256px Höhe, dynamische Breite) + Extremverhältnisse
    const viewports = [
        [144, 256], // 320x568 Small Portrait
        [118, 256], // 390x844 Mobile Portrait
        [85, 256],  // ~1:3 Extreme Portrait
        [554, 256], // 844x390 Mobile Landscape
        [455, 256], // 16:9 Desktop
        [606, 256], // 2560x1080 Ultrawide
        [768, 256], // 3:1 Extreme Landscape
        [118, 256]  // Rück-Rotation zu Portrait auf derselben Instanz
    ];

    let t = 0.5;
    for (const [w, h] of viewports) {
        dse.resize(w, h);
        const c = createStrictFakeCanvas(w, h);
        dse.render(c.ctx, w, h, t, 'buildup', t, makeTestMetrics({ tensionPct: 0.7 }));

        const horizon = Math.floor(h * 0.55);
        // Prüfen, ob jede Scanline ab y = horizon bis h - 1 vollständig von 0 bis w abgedeckt ist
        const coveredWidthByRow = new Map();
        for (const r of c.rects) {
            assertAmiga12BitHex(r.fillStyle);
            assert.ok(r.y >= horizon, `Darf nicht über Horizont ${horizon} zeichnen (y=${r.y})`);
            coveredWidthByRow.set(r.y, (coveredWidthByRow.get(r.y) || 0) + r.w);
        }
        for (let y = horizon; y < h; y++) {
            assert.equal(coveredWidthByRow.get(y), w, `Scanline ${y} bei ${w}x${h} muss lückenlos sein`);
        }
        t += 0.04;
    }

    // Simulationszeit / Phase wurde beim Rotieren nicht zurückgesetzt
    assert.ok(dse.scrollTiles > 0, 'scrollTiles muss kontinuierlich erhalten bleiben');
});