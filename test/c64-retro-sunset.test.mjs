// === test/c64-retro-sunset.test.mjs ===
import test from 'node:test';
import assert from 'node:assert/strict';
import { C64RetroSunset } from '../js/visuals/dse/c64/retro-sunset.js';
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

test('Smoke, VIC-II Palette & Zeitbasis: idle, ungültige Größen, fehlende Metriken & PAL-Caching', () => {
    const dse = new C64RetroSunset();

    const idleCanvas = createStrictFakeCanvas(320, 200);
    dse.render(idleCanvas.ctx, 320, 200, 0.0, 'idle', 0, undefined);
    assert.equal(idleCanvas.rects.length, 0);

    dse.render(idleCanvas.ctx, 0, 200, 0.02, 'playing', 0, undefined);
    dse.render(idleCanvas.ctx, 320, 0, 0.04, 'playing', 0, undefined);
    dse.render(idleCanvas.ctx, NaN, 200, 0.06, 'playing', 0, undefined);

    // Doppeltes Rendern bei identischem t (PAL-Cache-Hit-Simulation) darf Zustand nicht weiterschalten
    const palA = createStrictFakeCanvas(320, 200);
    const palB = createStrictFakeCanvas(320, 200);
    dse.render(palA.ctx, 320, 200, 0.5, 'playing', 0.5, undefined);
    dse.render(palB.ctx, 320, 200, 0.5, 'playing', 0.5, undefined);
    assert.deepEqual(palA.rects, palB.rects, 'Identisches t darf keine Frame-Counter-Abweichung erzeugen');

    const states = ['starting', 'playing', 'buildup', 'climax', 'afterglow', 'stopping'];
    let t = 0.6;
    for (const st of states) {
        const c = createStrictFakeCanvas(320, 200);
        dse.render(c.ctx, 320, 200, t, st, 0.3, undefined);
        assert.ok(c.rects.length > 0, `Zustand ${st} sollte zeichnen`);
        for (const r of c.rects) {
            assertC64PaletteHex(r.fillStyle);
        }
        t += 0.02;
    }
});

test('Determinismus: identische Sequenzen liefern trotz Water-Offsets identische Ausgabe', () => {
    const dseA = new C64RetroSunset();
    const dseB = new C64RetroSunset();

    const seq = [];
    for (let i = 0; i < 140; i++) {
        const beatStarted = i % 15 === 0;
        const beatEnv = Math.max(0, 1 - (i % 15) / 10);
        seq.push({
            t: i * 0.02,
            state: i < 20 ? 'starting' : (i < 60 ? 'playing' : (i < 100 ? 'climax' : 'afterglow')),
            metrics: makeTestMetrics({
                energy: 0.3 + (i % 14) * 0.04,
                tensionPct: Math.min(1, i / 95),
                beat: [beatEnv],
                beatImpulse: [beatEnv * 0.75],
                beatStarted,
                beatCount: Math.floor(i / 15) + 1,
                beatStrength: 0.75,
                beatLevel: 3,
                smooth: [0.5, 0.4, 0.7]
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

test('Exakte Beats vs. Hüllkurve: kein Retrigger ohne beatStarted', () => {
    const dse = new C64RetroSunset();
    const c = createStrictFakeCanvas(320, 200);

    // Beat 4 schaltet skyAccentPhase
    dse.render(c.ctx, 320, 200, 0.02, 'playing', 0.02, makeTestMetrics({
        beatStarted: true,
        beatCount: 4,
        beat: [1.0],
        beatImpulse: [0.9],
        beatStrength: 0.9,
        beatLevel: 3
    }));
    const phaseAfter4 = dse.skyAccentPhase;
    assert.equal(phaseAfter4, 1);

    // 25 Frames mit beat[0] > 0.8 und beatLevel=3, aber beatStarted=false -> kein Retrigger
    for (let i = 1; i <= 25; i++) {
        const frame = createStrictFakeCanvas(320, 200);
        dse.render(frame.ctx, 320, 200, 0.02 + i * 0.02, 'playing', 0.02 + i * 0.02, makeTestMetrics({
            beatStarted: false,
            beatCount: 4,
            beat: [0.88],
            beatImpulse: [0.79],
            beatStrength: 0.9,
            beatLevel: 3
        }));
        assert.equal(dse.skyAccentPhase, phaseAfter4);
    }
});

test('Graduelle Beat-Stärken (0.20 / 0.50 / 0.90) unterscheiden sich sichtbar', () => {
    const strengths = [0.20, 0.50, 0.90];
    const snapshots = strengths.map((s) => {
        const dse = new C64RetroSunset();
        const c = createStrictFakeCanvas(320, 200);
        dse.render(c.ctx, 320, 200, 0.02, 'playing', 0.02, makeTestMetrics({
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

test('Zustände & Afterglow: sanfte C64-Dämmerung ohne Phase-Reset', () => {
    const dse = new C64RetroSunset();
    let t = 0.02;

    for (let i = 0; i < 30; i++) {
        const c = createStrictFakeCanvas(320, 200);
        dse.render(c.ctx, 320, 200, t, 'climax', t, makeTestMetrics({ tensionPct: 0.95, energy: 0.9, beatImpulse: [0.6] }));
        t += 0.02;
    }
    const climaxSnap = createStrictFakeCanvas(320, 200);
    dse.render(climaxSnap.ctx, 320, 200, t, 'climax', t, makeTestMetrics({ tensionPct: 0.95, energy: 0.9, beatImpulse: [0.6] }));

    const waterBefore = dse.waterT;
    for (let i = 0; i < 50; i++) {
        t += 0.02;
        const c = createStrictFakeCanvas(320, 200);
        dse.render(c.ctx, 320, 200, t, 'afterglow', t, makeTestMetrics({ tensionPct: 0.15, energy: 0.2 }));
    }
    const afterglowSnap = createStrictFakeCanvas(320, 200);
    dse.render(afterglowSnap.ctx, 320, 200, t + 0.02, 'afterglow', t + 0.02, makeTestMetrics({ tensionPct: 0.15, energy: 0.2 }));

    assert.notDeepEqual(climaxSnap.rects, afterglowSnap.rects);
    assert.ok(dse.afterglowMix > 0.7, 'afterglowMix muss im Afterglow ansteigen');
    assert.notEqual(dse.waterT, waterBefore);
});

test('Responsive Viewports & Rotation (Portrait -> Landscape -> Portrait, Extremratios & ungerade Höhe)', () => {
    const dse = new C64RetroSunset();
    const viewports = [
        [32, 32],   // Tiny Buffer
        [112, 200], // 320x568 Small Portrait
        [92, 200],  // 390x844 Mobile Portrait
        [67, 200],  // ~1:3 Extreme Portrait
        [432, 200], // 844x390 Mobile Landscape
        [355, 200], // 16:9 Desktop
        [317, 199], // Ungerade Maße (Edge & Odd-Row Clipping Check)
        [474, 200], // 2560x1080 Ultrawide
        [600, 200], // 3:1 Extreme Landscape
        [92, 200]   // Rück-Rotation auf derselben Instanz
    ];

    let t = 0.2;
    for (const [w, h] of viewports) {
        dse.resize(w, h);
        const c = createStrictFakeCanvas(w, h);
        dse.render(c.ctx, w, h, t, 'climax', t, makeTestMetrics({
            tensionPct: 0.85,
            beatImpulse: [0.65],
            smooth: [0.75, 0.7, 0.8]
        }));

        assert.ok(c.rects.length > 0, `Viewport ${w}x${h} muss Ausgabe erzeugen`);
        for (const r of c.rects) {
            assertC64PaletteHex(r.fillStyle);
        }
        t += 0.02;
    }

    assert.ok(dse.waterT > 0, 'waterT bleibt bei Rotation erhalten');
});