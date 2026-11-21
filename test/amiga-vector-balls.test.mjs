import test from 'node:test';
import assert from 'node:assert/strict';
import { AmigaVectorBalls } from '../js/visuals/dse/amiga/vector-balls.js';
import { RAMPS, INK, COOL, CH_RAMPS } from '../js/visuals/dse/amiga/amiga-kit.js';
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
            assert.ok(Number.isFinite(w) && w > 0, `w muss > 0 sein (${w})`);
            assert.ok(Number.isFinite(h) && h > 0, `h muss > 0 sein (${h})`);
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
        smooth: [0.3, 0.3, 0.3, 0.3],
        isClimaxLocked: false,
        ...overrides
    };
}

test('1-2. Smoke, Idle, Numerik & Leben ohne Audio', () => {
    const dse = new AmigaVectorBalls();
    const idleCanvas = createStrictFakeCanvas(455, 256);
    dse.render(idleCanvas.ctx, 455, 256, 0, 'idle', 0, undefined);
    assert.equal(idleCanvas.rects.length, 0);

    dse.render(idleCanvas.ctx, 0, 256, 0.02, 'playing', 0.1, undefined);
    dse.render(idleCanvas.ctx, 455, 0, 0.04, 'playing', 0.1, undefined);
    dse.render(idleCanvas.ctx, NaN, 256, 0.06, 'playing', 0.1, undefined);

    const states = ['starting', 'playing', 'buildup', 'climax', 'afterglow', 'stopping'];
    let t = 0.1;
    for (const st of states) {
        const c = createStrictFakeCanvas(455, 256);
        dse.render(c.ctx, 455, 256, t, st, 0.6, undefined);
        assert.ok(c.rects.length > 0, `Zustand ${st} muss ohne Metriken rendern`);
        const pal = new Set();
        for (const r of c.rects) {
            assertAmiga12BitHex(r.fillStyle);
            pal.add(r.fillStyle);
        }
        assert.ok(pal.size <= 32, `Palette ueber Budget (${pal.size})`);
        t += 0.02;
    }

    // Ohne Audio dreht sich der Koerper weiter ueber t
    const live = new AmigaVectorBalls();
    const c1 = createStrictFakeCanvas(118, 256);
    const c2 = createStrictFakeCanvas(118, 256);
    live.render(c1.ctx, 118, 256, 0.1, 'playing', 1.0, undefined);
    live.render(c2.ctx, 118, 256, 0.5, 'playing', 1.4, undefined);
    assert.notDeepEqual(c1.rects, c2.rects);
});

test('3. Determinismus ueber 200 Frames', () => {
    const a = new AmigaVectorBalls();
    const b = new AmigaVectorBalls();
    for (let i = 0; i < 200; i++) {
        const onBeat = i % 10 === 0;
        const env = Math.max(0, 1 - (i % 10) / 8);
        const m = makeMetrics({
            tensionPct: Math.min(1, i / 140),
            beatStarted: onBeat,
            beatCount: Math.floor(i / 10) + 1,
            beat: [env],
            beatImpulse: [env * 0.6],
            beatStrength: 0.6,
            beatLevel: 2
        });
        const st = i < 20 ? 'starting' : (i < 100 ? 'buildup' : (i < 160 ? 'climax' : 'afterglow'));
        const cA = createStrictFakeCanvas(455, 256);
        const cB = createStrictFakeCanvas(455, 256);
        a.render(cA.ctx, 455, 256, i * 0.02, st, i * 0.02, m);
        b.render(cB.ctx, 455, 256, i * 0.02, st, i * 0.02, m);
        assert.deepEqual(cA.rects, cB.rects);
    }
});

test('4. Exakte Beats: Familienwechsel f nur bei count % 4 === 0, kein Retrigger', () => {
    const dse = new AmigaVectorBalls();
    const c = createStrictFakeCanvas(118, 256);
    for (let b = 1; b <= 3; b++) {
        dse.render(c.ctx, 118, 256, b * 0.1, 'playing', 1.0, makeMetrics({
            beatStarted: true,
            beatCount: b,
            beatStrength: 0.5,
            beatLevel: 2
        }));
        assert.equal(dse.f, 0, `Beat ${b} darf f nicht wechseln`);
    }

    dse.render(c.ctx, 118, 256, 0.4, 'playing', 1.0, makeMetrics({
        beatStarted: true,
        beatCount: 4,
        beatStrength: 0.5,
        beatLevel: 2
    }));
    assert.equal(dse.f, 1);

    // Morph erhaelt Slot-Indizes (kein Re-Seed / keine Abkuerzung von rot/ballScale)
    const rotBefore = dse.rot;
    for (let i = 1; i <= 25; i++) {
        dse.render(c.ctx, 118, 256, 0.4 + i * 0.02, 'playing', 1.0, makeMetrics({
            beatStarted: false,
            beatCount: 4,
            beat: [0.9],
            beatImpulse: [0.85],
            beatStrength: 0.9,
            beatLevel: 3
        }));
        assert.equal(dse.f, 1);
        assert.equal(dse.rot, rotBefore);
    }
});

test('5-6. Graduelle Beat-Staerken (soft/medium/hard) & Beat an/aus', () => {
    const strengths = [0.20, 0.50, 0.90];
    const outs = strengths.map((s) => {
        const dse = new AmigaVectorBalls();
        const warm = createStrictFakeCanvas(455, 256);
        dse.render(warm.ctx, 455, 256, 0.0, 'playing', 1.0, makeMetrics());
        const ayBefore = dse.ay;

        const c = createStrictFakeCanvas(455, 256);
        dse.render(c.ctx, 455, 256, 0.02, 'playing', 1.02, makeMetrics({
            beatStarted: true,
            beatCount: 1,
            beat: [1.0],
            beatImpulse: [s],
            beatStrength: s,
            beatLevel: s < 1 / 3 ? 1 : (s < 2 / 3 ? 2 : 3),
            smooth: [0.9, 0.2, 0.2, 0.2]
        }));
        return {
            ayDelta: Math.abs(dse.ay - ayBefore),
            boom: dse.boom,
            flashBalls: dse.lastHardFlashBalls,
            rects: c.rects
        };
    });

    assert.ok(outs[0].ayDelta > 0.10 && outs[0].boom === 0 && outs[0].flashBalls === 0);
    assert.ok(outs[1].boom > 0.95 && outs[1].boom < 1.1 && outs[1].flashBalls === 0);
    assert.ok(outs[2].boom > 1.35 && outs[2].flashBalls > 0);
    assert.notDeepEqual(outs[0].rects, outs[1].rects);
    assert.notDeepEqual(outs[1].rects, outs[2].rects);
});

test('7. Zustaende: kein Schwarz-Vollbild-Dither, COOL-Afterglow ohne Ghosts, Stopping -> 0 fillRects', () => {
    const dse = new AmigaVectorBalls();
    const cStart = createStrictFakeCanvas(455, 256);
    dse.render(cStart.ctx, 455, 256, 0.1, 'starting', 0.25, makeMetrics());
    const areaStart = cStart.rects.reduce((acc, r) => acc + r.w * r.h, 0);
    assert.ok(areaStart < 455 * 256 * 0.25, 'Foreground starting darf keinen Schwarz-Vollbild-Dither zeichnen');

    for (let i = 0; i < 60; i++) {
        dse.render(createStrictFakeCanvas(455, 256).ctx, 455, 256, 0.2 + i * 0.02, 'afterglow', i * 0.02, makeMetrics({ tensionPct: 0.2 }));
    }
    assert.equal(dse.lastGhostsDrawn, 0, 'Afterglow muss Ghosts abschalten');
    const coolSet = new Set([...RAMPS[COOL[0]], ...RAMPS[COOL[1]], INK]);
    const cAfter = createStrictFakeCanvas(455, 256);
    dse.render(cAfter.ctx, 455, 256, 1.5, 'afterglow', 1.3, makeMetrics({ tensionPct: 0.2 }));
    for (const r of cAfter.rects) {
        assert.ok(coolSet.has(r.fillStyle), `Afterglow nutzt COOL/INK, erhalten ${r.fillStyle}`);
    }

    const cStopEnd = createStrictFakeCanvas(455, 256);
    dse.render(cStopEnd.ctx, 455, 256, 3.0, 'stopping', 1.5, makeMetrics());
    assert.equal(cStopEnd.rects.length, 0);
});

test('8. Rotation Portrait -> Landscape -> Portrait behaelt ay, f, rot & gueltige Ordnung', () => {
    const dse = new AmigaVectorBalls();
    for (let i = 0; i < 8; i++) {
        dse.render(createStrictFakeCanvas(118, 256).ctx, 118, 256, i * 0.02, 'buildup', 1.0, makeMetrics({
            beatStarted: i === 4,
            beatCount: i,
            beatStrength: 0.5,
            beatLevel: 2
        }));
    }
    const ayBefore = dse.ay;
    const fBefore = dse.f;

    dse.resize(606, 256);
    const ultra = createStrictFakeCanvas(606, 256);
    dse.render(ultra.ctx, 606, 256, 8 * 0.02, 'buildup', 1.02, makeMetrics());
    assert.equal(dse.lastGroups, 2);
    assert.equal(dse.f, fBefore);
    assert.ok(Math.abs(dse.ay - ayBefore) < 0.15);
    assert.equal(dse.lastOrderSorted, true);

    dse.resize(118, 256);
    const port = createStrictFakeCanvas(118, 256);
    dse.render(port.ctx, 118, 256, 9 * 0.02, 'buildup', 1.04, makeMetrics());
    assert.equal(dse.lastGroups, 1);
});

test('9-10 & Spezial: r in 2..14, Ghosts nur bei ten > 0.70, Tiefensortierung & Budget <= 5000', () => {
    // Low tension: keine Ghosts
    const dseLow = new AmigaVectorBalls();
    for (let i = 0; i < 15; i++) {
        dseLow.render(createStrictFakeCanvas(455, 256).ctx, 455, 256, i * 0.02, 'playing', 1.0, makeMetrics({ tensionPct: 0.3 }));
    }
    assert.equal(dseLow.lastGhostsDrawn, 0, 'Bei ten <= 0.70 duerfen keine Ghosts gezeichnet werden');

    // High tension / Climax ueber alle Viewports: Ghosts aktiv, r in 2..14, fillRect <= 5000
    const viewports = [
        [85, 256],   // 1:3
        [118, 256],  // 390x844
        [455, 256],  // 1920x1080
        [554, 256],  // 844x390
        [606, 256],  // 2560x1080 Ultrawide (2 Gruppen)
        [768, 256]   // 3:1 (2 Gruppen)
    ];

    for (const [w, h] of viewports) {
        const dse = new AmigaVectorBalls();
        let lastC = null;
        for (let i = 0; i < 60; i++) {
            lastC = createStrictFakeCanvas(w, h);
            dse.render(lastC.ctx, w, h, i * 0.02, 'climax', 1.0 + i * 0.02, makeMetrics({
                tensionPct: 1.0,
                beatImpulse: [0.8],
                smooth: [0.9, 0.7, 0.5, 0.3]
            }));
        }
        assert.ok(dse.ten > 0.70);
        assert.ok(dse.lastGhostsDrawn > 0, `Climax bei ${w}x${h} muss Ghosts zeichnen`);
        assert.ok(dse.lastMinR >= 2 && dse.lastMaxR <= 14, `r muss in 2..14 liegen (${dse.lastMinR}..${dse.lastMaxR})`);
        assert.equal(dse.lastOrderSorted, true, 'Z-Sortierung muss streng monoton bleiben');
        assert.ok(lastC.rects.length <= 5000, `fillRect (${lastC.rects.length}) > 5000 bei ${w}x${h}`);

        const pal = new Set();
        for (const r of lastC.rects) {
            assertAmiga12BitHex(r.fillStyle);
            pal.add(r.fillStyle);
        }
        assert.ok(pal.size <= 25, `Normale Climax-Palette <= 25 (${pal.size})`);
    }
});

test('Spezial: Kugel i nutzt Rampe von Kanal i % 4', () => {
    // Hard-Beat mit isoliertem Kanal 2 (JADE) hebt nur Kugeln mit i % 4 === 2 auf Stufe 5
    const dse = new AmigaVectorBalls();
    const c = createStrictFakeCanvas(455, 256);
    dse.render(c.ctx, 455, 256, 0.02, 'playing', 1.0, makeMetrics({
        beatStarted: true,
        beatCount: 1,
        beatStrength: 0.9,
        beatLevel: 3,
        smooth: [0, 0, 1, 0]
    }));

    assert.equal(dse.hardFlashCh, 2);
    const jadeTop = RAMPS[CH_RAMPS[2]][5];
    const otherTops = new Set([RAMPS[CH_RAMPS[0]][5], RAMPS[CH_RAMPS[1]][5], RAMPS[CH_RAMPS[3]][5]]);
    assert.ok(c.rects.some((r) => r.fillStyle === jadeTop), 'Kugeln i % 4 === 2 muessen JADE Stufe 5 zeichnen');
    assert.ok(!c.rects.some((r) => otherTops.has(r.fillStyle)), 'Andere Kanal-Rampen duerfen nicht in Stufe 5 geflasht sein');
});

test('11. Registry-Metadaten von AmigaVectorBalls sind korrekt', () => {
    const entry = dseRegistry.find((e) => e.Class === AmigaVectorBalls);
    assert.ok(entry, 'AmigaVectorBalls muss in registry.js registriert sein');
    assert.deepEqual(entry.metadata.systems, ['amiga']);
    assert.equal(entry.metadata.layer, 'foreground');
    assert.equal(entry.metadata.weight, 11);
    assert.equal(entry.metadata.duration, 15.0);
    assert.equal(entry.metadata.climaxHold, 15.0);
});