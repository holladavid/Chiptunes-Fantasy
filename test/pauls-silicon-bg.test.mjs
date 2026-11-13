// === test/paula-silicon-bg.test.mjs ===
import test from 'node:test';
import assert from 'node:assert/strict';
import { PaulaSiliconBg } from '../js/visuals/dse/amiga/paula-silicon-bg.js';

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
        smooth: [0.4, 0.35, 0.3, 0.45],
        isClimaxLocked: false,
        ...overrides
    };
}

test('Smoke & DOM-Freiheit: idle, ungültige Größen, alle Zustände und fehlende Metriken', () => {
    const dse = new PaulaSiliconBg();

    const idleCanvas = createStrictFakeCanvas(455, 256);
    dse.render(idleCanvas.ctx, 455, 256, 0.0, 'idle', 0, undefined);
    assert.equal(idleCanvas.rects.length, 0);

    dse.render(idleCanvas.ctx, 0, 256, 0.02, 'playing', 0, undefined);
    dse.render(idleCanvas.ctx, 455, -1, 0.04, 'playing', 0, undefined);
    dse.render(idleCanvas.ctx, NaN, 256, 0.06, 'playing', 0, undefined);

    const states = ['starting', 'playing', 'buildup', 'climax', 'afterglow', 'stopping'];
    let t = 0.1;
    for (const st of states) {
        const c = createStrictFakeCanvas(455, 256);
        dse.render(c.ctx, 455, 256, t, st, 0.25, undefined);
        assert.ok(c.rects.length > 0, `Zustand ${st} sollte zeichnen`);
        for (const r of c.rects) {
            assertAmiga12BitHex(r.fillStyle);
        }
        t += 0.02;
    }
});

test('Determinismus: keine Math.random()-Abweichung zwischen zwei Instanzen', () => {
    const dseA = new PaulaSiliconBg();
    const dseB = new PaulaSiliconBg();

    const frames = [];
    for (let i = 0; i < 120; i++) {
        const beatStarted = i % 15 === 0;
        const beatEnv = Math.max(0, 1 - (i % 15) / 10);
        frames.push({
            t: i * 0.02,
            state: i < 20 ? 'starting' : (i < 60 ? 'playing' : (i < 95 ? 'climax' : 'afterglow')),
            metrics: makeTestMetrics({
                energy: 0.35 + (i % 15) * 0.03,
                tensionPct: Math.min(1, i / 85),
                beat: [beatEnv],
                beatImpulse: [beatEnv * 0.6],
                beatStarted,
                beatCount: Math.floor(i / 15) + 1,
                beatStrength: 0.6,
                beatLevel: 2,
                smooth: [0.5, 0.4, 0.6, 0.3]
            })
        });
    }

    const outA = [];
    const outB = [];
    for (const f of frames) {
        const cA = createStrictFakeCanvas(455, 256);
        const cB = createStrictFakeCanvas(455, 256);
        dseA.render(cA.ctx, 455, 256, f.t, f.state, f.t, f.metrics);
        dseB.render(cB.ctx, 455, 256, f.t, f.state, f.t, f.metrics);
        outA.push(cA.rects);
        outB.push(cB.rects);
    }

    assert.deepEqual(outA, outB);
});

test('Exakte Beats vs. Hüllkurve: kein Retrigger ohne beatStarted', () => {
    const dse = new PaulaSiliconBg();
    const c = createStrictFakeCanvas(455, 256);

    dse.render(c.ctx, 455, 256, 0.02, 'buildup', 0.02, makeTestMetrics({
        beatStarted: true,
        beatCount: 4,
        beat: [1.0],
        beatImpulse: [0.9],
        beatStrength: 0.9,
        beatLevel: 3
    }));
    const modeAfterBeat4 = dse.moirePaletteMode;
    assert.equal(modeAfterBeat4, 1);

    for (let i = 1; i <= 25; i++) {
        const frame = createStrictFakeCanvas(455, 256);
        dse.render(frame.ctx, 455, 256, 0.02 + i * 0.02, 'buildup', 0.02 + i * 0.02, makeTestMetrics({
            beatStarted: false,
            beatCount: 4,
            beat: [0.85],
            beatImpulse: [0.76],
            beatStrength: 0.9,
            beatLevel: 3
        }));
        assert.equal(dse.moirePaletteMode, modeAfterBeat4, `Frame ${i} darf Mode nicht re-triggern`);
    }
});

test('Graduelle Beat-Stärken (0.20 / 0.50 / 0.90) unterscheiden sich sichtbar', () => {
    const strengths = [0.20, 0.50, 0.90];
    const snapshots = strengths.map((s) => {
        const dse = new PaulaSiliconBg();
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

    assert.notDeepEqual(snapshots[0], snapshots[1]);
    assert.notDeepEqual(snapshots[1], snapshots[2]);
});

test('Kanalzuordnung: smooth[0..3] steuern individuelle DMA-Türme', () => {
    const dseA = new PaulaSiliconBg();
    const dseB = new PaulaSiliconBg();
    const cA = createStrictFakeCanvas(455, 256);
    const cB = createStrictFakeCanvas(455, 256);

    dseA.render(cA.ctx, 455, 256, 0.5, 'playing', 0.5, makeTestMetrics({ smooth: [0.95, 0.1, 0.1, 0.1] }));
    dseB.render(cB.ctx, 455, 256, 0.5, 'playing', 0.5, makeTestMetrics({ smooth: [0.1, 0.1, 0.95, 0.1] }));

    assert.notDeepEqual(cA.rects, cB.rects);
});

test('Zustände & Afterglow: sanftes Abkühlen ohne Re-Seed', () => {
    const dse = new PaulaSiliconBg();
    let t = 0.02;

    for (let i = 0; i < 30; i++) {
        const c = createStrictFakeCanvas(455, 256);
        dse.render(c.ctx, 455, 256, t, 'climax', t, makeTestMetrics({ tensionPct: 0.95, energy: 0.9 }));
        t += 0.02;
    }
    const climaxSnap = createStrictFakeCanvas(455, 256);
    dse.render(climaxSnap.ctx, 455, 256, t, 'climax', t, makeTestMetrics({ tensionPct: 0.95, energy: 0.9 }));

    const scrollBeforeAfterglow = dse.scrollZ;
    for (let i = 0; i < 45; i++) {
        t += 0.02;
        const c = createStrictFakeCanvas(455, 256);
        dse.render(c.ctx, 455, 256, t, 'afterglow', t, makeTestMetrics({ tensionPct: 0.2, energy: 0.25 }));
    }
    const afterglowSnap = createStrictFakeCanvas(455, 256);
    dse.render(afterglowSnap.ctx, 455, 256, t + 0.02, 'afterglow', t + 0.02, makeTestMetrics({ tensionPct: 0.15, energy: 0.2 }));

    assert.notDeepEqual(climaxSnap.rects, afterglowSnap.rects);
    assert.ok(dse.afterglowMix > 0.7, 'afterglowMix muss im Afterglow ansteigen');
    assert.notEqual(dse.scrollZ, scrollBeforeAfterglow);
});

test('Responsive Viewports & Rotation (Portrait -> Landscape -> Portrait, 1:3 & 3:1)', () => {
    const dse = new PaulaSiliconBg();
    const viewports = [
        [144, 256], // 320x568 Small Portrait
        [118, 256], // 390x844 Mobile Portrait
        [85, 256],  // ~1:3 Extreme Portrait
        [554, 256], // 844x390 Mobile Landscape
        [455, 256], // 16:9 Desktop
        [606, 256], // 2560x1080 Ultrawide
        [768, 256], // 3:1 Extreme Landscape
        [118, 256]  // Rück-Rotation auf derselben Instanz
    ];

    let t = 0.2;
    for (const [w, h] of viewports) {
        dse.resize(w, h);
        const c = createStrictFakeCanvas(w, h);
        dse.render(c.ctx, w, h, t, 'climax', t, makeTestMetrics({
            tensionPct: 0.85,
            beatImpulse: [0.6],
            smooth: [0.8, 0.7, 0.6, 0.75]
        }));

        assert.ok(c.rects.length > 0, `Viewport ${w}x${h} muss Ausgabe erzeugen`);
        for (const r of c.rects) {
            assertAmiga12BitHex(r.fillStyle);
        }
        t += 0.02;
    }

    assert.ok(dse.dmaTime > 0, 'dmaTime bleibt bei Rotation erhalten');
});