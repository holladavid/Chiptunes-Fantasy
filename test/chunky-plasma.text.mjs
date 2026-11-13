// === test/chunky-plasma.test.mjs ===
import test from 'node:test';
import assert from 'node:assert/strict';
import { ChunkyPlasma } from '../js/visuals/dse/c64/chunky-plasma.js';
import { C64_PALETTE, rgbToHex } from '../js/visuals/utils/hardware-constraints.js';

const VALID_C64_HEX = new Set(C64_PALETTE.map(([r, g, b]) => rgbToHex(r, g, b).toLowerCase()));

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
    };

    return { ctx, rects };
}

function assertC64PaletteHex(hex) {
    assert.ok(VALID_C64_HEX.has(String(hex).toLowerCase()), `Unerlaubte Nicht-C64-Farbe: ${hex}`);
}

function makeTestMetrics(overrides = {}) {
    return {
        system: 'c64',
        energy: 0.45,
        pulse: 0.1,
        tensionPct: 0.4,
        beat: [0.0],
        beatImpulse: [0.0],
        beatStarted: false,
        beatCount: 0,
        beatStrength: 0.0,
        beatLevel: 0,
        smooth: [0.45, 0.35, 0.3],
        isClimaxLocked: false,
        ...overrides
    };
}

test('Smoke & VIC-II Palette: idle, ungültige Größen, fehlende Metriken & alle Zustände', () => {
    const dse = new ChunkyPlasma();

    const idleCanvas = createStrictFakeCanvas(320, 200);
    dse.render(idleCanvas.ctx, 320, 200, 0.0, 'idle', 0, undefined);
    assert.equal(idleCanvas.rects.length, 0);

    dse.render(idleCanvas.ctx, 0, 200, 0.02, 'playing', 0, undefined);
    dse.render(idleCanvas.ctx, 320, -10, 0.04, 'playing', 0, undefined);
    dse.render(idleCanvas.ctx, NaN, 200, 0.06, 'playing', 0, undefined);

    const states = ['starting', 'playing', 'buildup', 'climax', 'afterglow', 'stopping'];
    let t = 0.1;
    for (const st of states) {
        const c = createStrictFakeCanvas(320, 200);
        dse.render(c.ctx, 320, 200, t, st, 0.25, undefined);
        assert.ok(c.rects.length > 0, `Zustand ${st} sollte zeichnen`);
        for (const r of c.rects) {
            assertC64PaletteHex(r.fillStyle);
        }
        t += 0.02;
    }
});

test('Determinismus: identische Sequenzen liefern über 150 Frames identische Ausgabe', () => {
    const dseA = new ChunkyPlasma();
    const dseB = new ChunkyPlasma();

    const seq = [];
    for (let i = 0; i < 150; i++) {
        const beatStarted = i % 12 === 0;
        const beatEnv = Math.max(0, 1 - (i % 12) / 9);
        seq.push({
            t: i * 0.02,
            state: i < 20 ? 'starting' : (i < 65 ? 'playing' : (i < 110 ? 'climax' : 'afterglow')),
            metrics: makeTestMetrics({
                energy: 0.3 + (i % 16) * 0.04,
                tensionPct: Math.min(1, i / 100),
                beat: [beatEnv],
                beatImpulse: [beatEnv * 0.7],
                beatStarted,
                beatCount: Math.floor(i / 12) + 1,
                beatStrength: 0.7,
                beatLevel: 2,
                smooth: [0.6, 0.4, 0.7]
            })
        });
    }

    const outA = [];
    const outB = [];
    for (const step of seq) {
        const cA = createStrictFakeCanvas(320, 200);
        const cB = createStrictFakeCanvas(320, 200);
        dseA.render(cA.ctx, 320, 200, step.t, step.state, step.t, step.metrics);
        dseB.render(cB.ctx, 320, 200, step.t, step.state, step.t, step.metrics);
        outA.push(cA.rects);
        outB.push(cB.rects);
    }

    assert.deepEqual(outA, outB);
});

test('Exakte Beats vs. Hüllkurve: Paletten-/Patternwechsel nur bei beatStarted', () => {
    const dse = new ChunkyPlasma();
    const c = createStrictFakeCanvas(320, 200);

    // Beat 8 löst Paletten- und Patternwechsel aus
    dse.render(c.ctx, 320, 200, 0.02, 'climax', 0.02, makeTestMetrics({
        beatStarted: true,
        beatCount: 8,
        beat: [1.0],
        beatImpulse: [0.9],
        beatStrength: 0.9,
        beatLevel: 3
    }));
    const palAfter8 = dse.paletteIndex;
    const patAfter8 = dse.patternIndex;
    assert.equal(palAfter8, 1);
    assert.equal(patAfter8, 1);

    // 25 Frames mit hoher Hüllkurve und beatLevel=3, aber beatStarted=false -> kein Retrigger
    for (let i = 1; i <= 25; i++) {
        const frame = createStrictFakeCanvas(320, 200);
        dse.render(frame.ctx, 320, 200, 0.02 + i * 0.02, 'climax', 0.02 + i * 0.02, makeTestMetrics({
            beatStarted: false,
            beatCount: 8,
            beat: [0.85],
            beatImpulse: [0.76],
            beatStrength: 0.9,
            beatLevel: 3
        }));
        assert.equal(dse.paletteIndex, palAfter8);
        assert.equal(dse.patternIndex, patAfter8);
    }
});

test('Graduelle Beat-Stärken (0.20 / 0.50 / 0.90) erzeugen unterscheidbare Reaktionen', () => {
    const strengths = [0.20, 0.50, 0.90];
    const snapshots = strengths.map((s) => {
        const dse = new ChunkyPlasma();
        const c = createStrictFakeCanvas(320, 200);
        dse.render(c.ctx, 320, 200, 0.02, 'buildup', 0.02, makeTestMetrics({
            beatStarted: true,
            beatCount: 1,
            beat: [1.0],
            beatImpulse: [s],
            beatStrength: s,
            beatLevel: s < 0.33 ? 1 : (s < 0.66 ? 2 : 3)
        }));
        return c.rects;
    });

    assert.notDeepEqual(snapshots[0], snapshots[1]);
    assert.notDeepEqual(snapshots[1], snapshots[2]);
});

test('SID-3-Kanalzuordnung & Afterglow-Übergang ohne Re-Seed', () => {
    const dse = new ChunkyPlasma();
    let t = 0.02;

    for (let i = 0; i < 30; i++) {
        const c = createStrictFakeCanvas(320, 200);
        dse.render(c.ctx, 320, 200, t, 'climax', t, makeTestMetrics({
            tensionPct: 0.95,
            energy: 0.9,
            smooth: [0.9, 0.85, 0.95]
        }));
        t += 0.02;
    }
    const climaxSnap = createStrictFakeCanvas(320, 200);
    dse.render(climaxSnap.ctx, 320, 200, t, 'climax', t, makeTestMetrics({
        tensionPct: 0.95,
        energy: 0.9,
        smooth: [0.9, 0.85, 0.95]
    }));

    const cycleBefore = dse.colorCyclePhase;
    for (let i = 0; i < 50; i++) {
        t += 0.02;
        const c = createStrictFakeCanvas(320, 200);
        dse.render(c.ctx, 320, 200, t, 'afterglow', t, makeTestMetrics({
            tensionPct: 0.15,
            energy: 0.2,
            smooth: [0.2, 0.15, 0.1]
        }));
    }
    const afterglowSnap = createStrictFakeCanvas(320, 200);
    dse.render(afterglowSnap.ctx, 320, 200, t + 0.02, 'afterglow', t + 0.02, makeTestMetrics({
        tensionPct: 0.15,
        energy: 0.2,
        smooth: [0.2, 0.15, 0.1]
    }));

    assert.notDeepEqual(climaxSnap.rects, afterglowSnap.rects);
    assert.ok(dse.afterglowMix > 0.7, 'afterglowMix muss ansteigen');
    assert.notEqual(dse.colorCyclePhase, cycleBefore);
});

test('Responsive Viewports & Rotation (Portrait -> Landscape -> Portrait, Extremratios & ungerade Kanten)', () => {
    const dse = new ChunkyPlasma();

    // C64 200px Höhe mit verschiedenen Seitenverhältnissen + ungeraden Rändern + Mini-Buffer
    const viewports = [
        [32, 32],   // Tiny Buffer
        [112, 200], // 320x568 Small Portrait
        [92, 200],  // 390x844 Mobile Portrait
        [67, 200],  // ~1:3 Extreme Portrait
        [432, 200], // 844x390 Mobile Landscape
        [355, 200], // 16:9 Desktop
        [317, 199], // Ungerade Kantenmaße (Edge Clipping Check)
        [474, 200], // 2560x1080 Ultrawide
        [600, 200], // 3:1 Extreme Landscape
        [92, 200]   // Rück-Rotation auf derselben Instanz
    ];

    let t = 0.2;
    for (const [w, h] of viewports) {
        dse.resize(w, h);
        const c = createStrictFakeCanvas(w, h);
        dse.render(c.ctx, w, h, t, 'buildup', t, makeTestMetrics({
            tensionPct: 0.75,
            beatImpulse: [0.55],
            smooth: [0.7, 0.6, 0.8]
        }));

        assert.ok(c.rects.length > 0, `Viewport ${w}x${h} muss Ausgabe erzeugen`);
        for (const r of c.rects) {
            assertC64PaletteHex(r.fillStyle);
        }
        t += 0.02;
    }

    assert.ok(dse.internalT > 0, 'Simulationszeit bleibt bei Rotation erhalten');
});