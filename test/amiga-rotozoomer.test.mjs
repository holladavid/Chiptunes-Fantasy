import test from 'node:test';
import assert from 'node:assert/strict';
import { AmigaRotoZoomer } from '../js/visuals/dse/amiga/rotozoomer.js';
import { RAMPS } from '../js/visuals/dse/amiga/amiga-kit.js';
import { dseRegistry } from '../js/visuals/dse/registry.js';

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
            assert.ok(Number.isFinite(x) && Number.isFinite(y));
            assert.ok(Number.isFinite(w) && w >= 0);
            assert.ok(Number.isFinite(h) && h >= 0);
            assert.equal(x, Math.floor(x));
            assert.equal(y, Math.floor(y));
            assert.equal(w, Math.floor(w));
            assert.equal(h, Math.floor(h));
            assert.ok(x >= 0 && x + w <= width, `x+w (${x}+${w}) > ${width}`);
            assert.ok(y >= 0 && y + h <= height, `y+h (${y}+${h}) > ${height}`);
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
    assert.equal(r % 17, 0);
    assert.equal(g % 17, 0);
    assert.equal(b % 17, 0);
}

function makeMetrics(overrides = {}) {
    return {
        system: 'amiga',
        energy: 0.45,
        pulse: 0.1,
        tensionPct: 0.3,
        beat: [0],
        beatImpulse: [0],
        beatStarted: false,
        beatCount: 0,
        beatStrength: 0,
        beatLevel: 0,
        smooth: [0.4, 0.3, 0.25, 0.2],
        isClimaxLocked: false,
        ...overrides
    };
}

test('1-2. Smoke, Idle & Numerik-Schutz', () => {
    const dse = new AmigaRotoZoomer();
    const idleCanvas = createStrictFakeCanvas(455, 256);
    dse.render(idleCanvas.ctx, 455, 256, 0, 'idle', 0, undefined);
    assert.equal(idleCanvas.rects.length, 0);

    dse.render(idleCanvas.ctx, 0, 256, 0.02, 'playing', 0.1, undefined);
    dse.render(idleCanvas.ctx, 455, -1, 0.04, 'playing', 0.1, undefined);
    dse.render(idleCanvas.ctx, NaN, 256, 0.06, 'playing', 0.1, undefined);

    const states = ['starting', 'playing', 'buildup', 'climax', 'afterglow', 'stopping'];
    let t = 0.1;
    for (const st of states) {
        const c = createStrictFakeCanvas(455, 256);
        dse.render(c.ctx, 455, 256, t, st, 0.3, undefined);
        assert.ok(c.rects.length > 0, `Zustand ${st} muss ohne Metriken rendern`);
        const palette = new Set();
        for (const r of c.rects) {
            assertAmiga12BitHex(r.fillStyle);
            palette.add(r.fillStyle);
        }
        assert.ok(palette.size <= 32, `Palette darf max 32 Farben haben (${palette.size})`);
        t += 0.02;
    }

    // Ohne Audio/Metrics bleibt das Bild ueber Zeit lebendig
    const live = new AmigaRotoZoomer();
    const c1 = createStrictFakeCanvas(118, 256);
    const c2 = createStrictFakeCanvas(118, 256);
    live.render(c1.ctx, 118, 256, 0.1, 'playing', 1.0, undefined);
    live.render(c2.ctx, 118, 256, 0.6, 'playing', 1.5, undefined);
    assert.notDeepEqual(c1.rects, c2.rects);
});

test('3. Determinismus ueber 200 Frames', () => {
    const a = new AmigaRotoZoomer();
    const b = new AmigaRotoZoomer();
    for (let i = 0; i < 200; i++) {
        const onBeat = i % 10 === 0;
        const env = Math.max(0, 1 - (i % 10) / 8);
        const m = makeMetrics({
            tensionPct: Math.min(1, i / 150),
            beatStarted: onBeat,
            beatCount: Math.floor(i / 10) + 1,
            beat: [env],
            beatImpulse: [env * 0.5],
            beatStrength: 0.5,
            beatLevel: 2
        });
        const st = i < 20 ? 'starting' : (i < 120 ? 'buildup' : (i < 160 ? 'climax' : 'afterglow'));
        const cA = createStrictFakeCanvas(118, 256);
        const cB = createStrictFakeCanvas(118, 256);
        a.render(cA.ctx, 118, 256, i * 0.02, st, i * 0.02, m);
        b.render(cB.ctx, 118, 256, i * 0.02, st, i * 0.02, m);
        assert.deepEqual(cA.rects, cB.rects);
    }
});

test('4. Exakte Beats: Texturwechsel nur bei count % 4 === 0, kein Retrigger durch Huellkurve', () => {
    const dse = new AmigaRotoZoomer();
    const c = createStrictFakeCanvas(118, 256);
    for (let b = 1; b <= 3; b++) {
        dse.render(c.ctx, 118, 256, b * 0.1, 'playing', 1.0, makeMetrics({
            beatStarted: true,
            beatCount: b,
            beatStrength: 0.5,
            beatLevel: 2
        }));
        assert.equal(dse.tex, 0, `Beat ${b} darf Textur nicht wechseln`);
    }

    // Beat 4 wechselt auf T1
    dse.render(c.ctx, 118, 256, 0.4, 'playing', 1.0, makeMetrics({
        beatStarted: true,
        beatCount: 4,
        beatStrength: 0.5,
        beatLevel: 2
    }));
    assert.equal(dse.tex, 1);

    // 25 Frames ohne beatStarted trotz hoher Huellkurve/beatLevel -> kein Retrigger
    const shiftLocked = dse.shift;
    for (let i = 1; i <= 25; i++) {
        dse.render(c.ctx, 118, 256, 0.4 + i * 0.02, 'playing', 1.0, makeMetrics({
            beatStarted: false,
            beatCount: 4,
            beat: [0.9],
            beatImpulse: [0.85],
            beatStrength: 0.9,
            beatLevel: 3
        }));
        assert.equal(dse.tex, 1);
        assert.equal(dse.shift, shiftLocked);
    }
});

test('5-6. Graduelle Beat-Staerken (soft/medium/hard) & Beat an/aus', () => {
    const strengths = [0.20, 0.50, 0.90];
    const results = strengths.map((s) => {
        const dse = new AmigaRotoZoomer();
        const c = createStrictFakeCanvas(118, 256);
        dse.render(c.ctx, 118, 256, 0.02, 'playing', 1.0, makeMetrics({
            beatStarted: true,
            beatCount: 1,
            beat: [1.0],
            beatImpulse: [s],
            beatStrength: s,
            beatLevel: s < 1 / 3 ? 1 : (s < 2 / 3 ? 2 : 3)
        }));
        return { shift: dse.shift, snap: dse.snap, band: dse.copperHFrac, timer: dse.copperTimer, rects: c.rects };
    });

    assert.equal(results[0].shift, 1);
    assert.equal(results[0].timer, 0);
    assert.equal(results[1].shift, 2);
    assert.equal(results[1].band, 0.08);
    assert.ok(results[1].timer > 0);
    assert.equal(results[2].shift, 3);
    assert.equal(results[2].snap, 1.25);
    assert.equal(results[2].band, 0.12);
    assert.notDeepEqual(results[0].rects, results[1].rects);
    assert.notDeepEqual(results[1].rects, results[2].rects);
});

test('7. Zustaende, Afterglow (STEEL) & Stopping endet bei vis=0 vollstaendig', () => {
    const dse = new AmigaRotoZoomer();
    const cPlay = createStrictFakeCanvas(118, 256);
    const cAfter = createStrictFakeCanvas(118, 256);
    const cStopEnd = createStrictFakeCanvas(118, 256);

    dse.render(cPlay.ctx, 118, 256, 0.5, 'playing', 1.0, makeMetrics({ tensionPct: 0.25 }));
    for (let i = 1; i <= 40; i++) {
        dse.render(cAfter.ctx, 118, 256, 0.5 + i * 0.02, 'afterglow', i * 0.02, makeMetrics({ tensionPct: 0.2 }));
    }
    const steelSet = new Set(RAMPS.STEEL);
    const lastAfter = createStrictFakeCanvas(118, 256);
    dse.render(lastAfter.ctx, 118, 256, 1.5, 'afterglow', 1.0, makeMetrics({ tensionPct: 0.2 }));
    for (const r of lastAfter.rects) {
        assert.ok(steelSet.has(r.fillStyle), `Afterglow muss STEEL nutzen, erhalten ${r.fillStyle}`);
    }

    dse.render(cStopEnd.ctx, 118, 256, 3.0, 'stopping', 1.5, makeMetrics({ tensionPct: 0.1 }));
    assert.equal(cStopEnd.rects.length, 0, 'stopping bei vis=0 darf nichts mehr zeichnen');
});

test('8. Rotation Portrait -> Landscape -> Portrait behaelt theta, ou, ov auf derselben Instanz', () => {
    const dse = new AmigaRotoZoomer();
    dse.render(createStrictFakeCanvas(118, 256).ctx, 118, 256, 0.1, 'playing', 1.0, makeMetrics());
    dse.render(createStrictFakeCanvas(118, 256).ctx, 118, 256, 0.5, 'playing', 1.4, makeMetrics());
    const thetaBefore = dse.theta;
    const ouBefore = dse.ou;
    const ovBefore = dse.ov;

    dse.resize(554, 256);
    const land = createStrictFakeCanvas(554, 256);
    dse.render(land.ctx, 554, 256, 0.5, 'playing', 1.4, makeMetrics());
    assert.equal(dse.theta, thetaBefore);
    assert.equal(dse.ou, ouBefore);
    assert.equal(dse.ov, ovBefore);
    assert.ok(land.rects.length > 0);
});

test('9-10. Viewports & Budgets: Zellzahl <= 6000, alle Stufen 0..5 & fillRect-Budget', () => {
    const dse = new AmigaRotoZoomer();
    const viewports = [
        [85, 256],   // 1:3
        [118, 256],  // 390x844
        [455, 256],  // 1920x1080
        [554, 256],  // 844x390
        [606, 256],  // 2560x1080
        [768, 256]   // 3:1
    ];
    let t = 0.2;
    for (const [w, h] of viewports) {
        let cell = Math.max(3, Math.ceil(Math.sqrt((w * h) / 6000)));
        while (Math.ceil(w / cell) * Math.ceil(h / cell) > 6000) cell++;
        assert.ok(Math.ceil(w / cell) * Math.ceil(h / cell) <= 6000);

        const c = createStrictFakeCanvas(w, h);
        dse.render(c.ctx, w, h, t, 'climax', t, makeMetrics({ tensionPct: 0.95 }));
        assert.ok(c.rects.length <= 6000, `fillRect (${c.rects.length}) bei ${w}x${h} ueber Zelllimit`);
        const oceanSet = new Set(RAMPS.OCEAN);
        for (const r of c.rects) {
            assertAmiga12BitHex(r.fillStyle);
            assert.ok(oceanSet.has(r.fillStyle));
        }
        t += 0.02;
    }
});

test('Spezial: kMode aendert sich nur bei beatStarted oder nach 1.2s ohne Beat', () => {
    const dse = new AmigaRotoZoomer();
    const c = createStrictFakeCanvas(118, 256);

    // Climax treibt ten ueber Schwelle fuer kMode 2; ohne Beat 0.8s bleibt kMode auf 0
    for (let i = 0; i < 40; i++) {
        dse.render(c.ctx, 118, 256, i * 0.02, 'climax', i * 0.02, makeMetrics({
            tensionPct: 0.95,
            beatStarted: false
        }));
    }
    assert.equal(dse.kMode, 0, 'Vor 1.2s ohne Beat darf kMode noch nicht springen');

    // Nach insgesamt > 1.2s Pending-Zeit uebernimmt kMode automatisch
    for (let i = 40; i < 95; i++) {
        dse.render(c.ctx, 118, 256, i * 0.02, 'climax', i * 0.02, makeMetrics({
            tensionPct: 0.95,
            beatStarted: false
        }));
    }
    assert.equal(dse.kMode, 2, 'Nach 1.2s ohne Beat muss kMode pending uebernommen werden');

    // Zurueck in playing uebernimmt ein Beat den Wechsel sofort
    for (let i = 95; i < 140; i++) {
        dse.render(c.ctx, 118, 256, i * 0.02, 'playing', i * 0.02, makeMetrics({
            tensionPct: 0.2,
            beatStarted: false
        }));
    }
    dse.render(c.ctx, 118, 256, 140 * 0.02, 'playing', 140 * 0.02, makeMetrics({
        tensionPct: 0.2,
        beatStarted: true,
        beatCount: 1,
        beatStrength: 0.5,
        beatLevel: 2
    }));
    assert.equal(dse.kMode, 0, 'Beat uebernimmt anstehenden kMode-Wechsel sofort');
});

test('11. Registry-Metadaten von AmigaRotoZoomer sind korrekt', () => {
    const entry = dseRegistry.find((e) => e.Class === AmigaRotoZoomer);
    assert.ok(entry, 'AmigaRotoZoomer muss in registry.js registriert sein');
    assert.deepEqual(entry.metadata.systems, ['amiga']);
    assert.equal(entry.metadata.layer, 'background');
    assert.equal(entry.metadata.weight, 12);
    assert.equal(entry.metadata.duration, 14.0);
    assert.equal(entry.metadata.climaxHold, 12.0);
});