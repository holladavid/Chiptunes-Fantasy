import test from 'node:test';
import assert from 'node:assert/strict';
import { AmigaParallaxGround } from '../js/visuals/dse/amiga/parallax-ground.js';
import { RAMPS, INK, SNOW } from '../js/visuals/dse/amiga/amiga-kit.js';
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

test('1-2. Smoke, Idle, Numerik, nichts oberhalb Horizont & Leben ohne Audio', () => {
    const dse = new AmigaParallaxGround();
    const idleCanvas = createStrictFakeCanvas(455, 256);
    dse.render(idleCanvas.ctx, 455, 256, 0, 'idle', 0, undefined);
    assert.equal(idleCanvas.rects.length, 0);

    dse.render(idleCanvas.ctx, 0, 256, 0.02, 'playing', 0.1, undefined);
    dse.render(idleCanvas.ctx, 455, 0, 0.04, 'playing', 0.1, undefined);
    dse.render(idleCanvas.ctx, NaN, 256, 0.06, 'playing', 0.1, undefined);

    const horizon = Math.floor(256 * 0.55);
    const states = ['starting', 'playing', 'buildup', 'climax', 'afterglow', 'stopping'];
    let t = 0.1;
    for (const st of states) {
        const c = createStrictFakeCanvas(455, 256);
        dse.render(c.ctx, 455, 256, t, st, 0.4, undefined);
        assert.ok(c.rects.length > 0, `Zustand ${st} muss ohne Metriken rendern`);
        const pal = new Set();
        for (const r of c.rects) {
            assertAmiga12BitHex(r.fillStyle);
            assert.ok(r.y >= horizon, `Keine Operation oberhalb Horizont ${horizon} (y=${r.y})`);
            pal.add(r.fillStyle);
        }
        assert.ok(pal.size <= 32, `Palette ueber Budget (${pal.size})`);
        t += 0.02;
    }

    // Ohne Audio scrollen und wehen Halme weiter
    const live = new AmigaParallaxGround();
    const c1 = createStrictFakeCanvas(118, 256);
    const c2 = createStrictFakeCanvas(118, 256);
    live.render(c1.ctx, 118, 256, 0.1, 'playing', 1.0, undefined);
    live.render(c2.ctx, 118, 256, 0.6, 'playing', 1.5, undefined);
    assert.notDeepEqual(c1.rects, c2.rects);
});

test('3. Determinismus ueber 200 Frames (inkl. Xorshift32 Objekte & Staub)', () => {
    const a = new AmigaParallaxGround();
    const b = new AmigaParallaxGround();
    for (let i = 0; i < 200; i++) {
        const onBeat = i % 10 === 0;
        const env = Math.max(0, 1 - (i % 10) / 8);
        const m = makeMetrics({
            tensionPct: Math.min(1, i / 100),
            beatStarted: onBeat,
            beatCount: Math.floor(i / 10) + 1,
            beat: [env],
            beatImpulse: [env * 0.9],
            beatStrength: 0.9,
            beatLevel: 3
        });
        const st = i < 15 ? 'starting' : (i < 80 ? 'buildup' : (i < 160 ? 'climax' : 'afterglow'));
        const cA = createStrictFakeCanvas(455, 256);
        const cB = createStrictFakeCanvas(455, 256);
        a.render(cA.ctx, 455, 256, i * 0.02, st, i * 0.02, m);
        b.render(cB.ctx, 455, 256, i * 0.02, st, i * 0.02, m);
        assert.deepEqual(cA.rects, cB.rects);
    }
});

test('4. Exakte Beats: Themenwechsel nur bei count % 4 === 0, dir-Flip nur bei count % 8 === 0', () => {
    const dse = new AmigaParallaxGround();
    const c = createStrictFakeCanvas(455, 256);
    for (let b = 1; b <= 3; b++) {
        dse.render(c.ctx, 455, 256, b * 0.1, 'playing', 1.0, makeMetrics({
            beatStarted: true,
            beatCount: b,
            beatStrength: 0.5,
            beatLevel: 2
        }));
        assert.equal(dse.theme, 0);
        assert.equal(dse.dirTarget, 1);
    }

    // Beat 4: Themenwechsel 0 -> 1
    dse.render(c.ctx, 455, 256, 0.4, 'playing', 1.0, makeMetrics({
        beatStarted: true,
        beatCount: 4,
        beatStrength: 0.5,
        beatLevel: 2
    }));
    assert.equal(dse.theme, 1);
    assert.equal(dse.dirTarget, 1);

    // Beat 8: Themenwechsel 1 -> 2 UND dir-Flip 1 -> -1
    for (let b = 5; b <= 8; b++) {
        dse.render(c.ctx, 455, 256, b * 0.1, 'playing', 1.0, makeMetrics({
            beatStarted: true,
            beatCount: b,
            beatStrength: 0.5,
            beatLevel: 2
        }));
    }
    assert.equal(dse.theme, 2);
    assert.equal(dse.dirTarget, -1);

    // Abklingende Huellkurve ohne beatStarted retriggert nichts
    for (let i = 1; i <= 25; i++) {
        dse.render(c.ctx, 455, 256, 0.8 + i * 0.02, 'playing', 1.0, makeMetrics({
            beatStarted: false,
            beatCount: 8,
            beat: [0.85],
            beatImpulse: [0.76],
            beatStrength: 0.9,
            beatLevel: 3
        }));
        assert.equal(dse.theme, 2);
        assert.equal(dse.dirTarget, -1);
    }
});

test('5-6. Graduelle Beat-Staerken (soft/medium/hard) & Beat an/aus', () => {
    const strengths = [0.20, 0.50, 0.90];
    const outs = strengths.map((s) => {
        const dse = new AmigaParallaxGround();
        const c = createStrictFakeCanvas(455, 256);
        dse.render(c.ctx, 455, 256, 0.02, 'playing', 1.0, makeMetrics({
            beatStarted: true,
            beatCount: 1,
            beat: [1.0],
            beatImpulse: [s],
            beatStrength: s,
            beatLevel: s < 1 / 3 ? 1 : (s < 2 / 3 ? 2 : 3),
            smooth: [0.1, 0.9, 0.2, 0.2]
        }));
        return {
            softTimer: dse.softLineTimer,
            medTimer: dse.medFlashTimer,
            quakeTimer: dse.quakeTimer,
            dustCount: dse.lastActiveDust,
            rects: c.rects
        };
    });

    assert.ok(outs[0].softTimer > 0 && outs[0].medTimer === 0 && outs[0].dustCount === 0);
    assert.ok(outs[1].medTimer > 0 && outs[1].dustCount === 4 && outs[1].quakeTimer === 0);
    assert.ok(outs[2].quakeTimer > 0 && outs[2].dustCount === 12);
    assert.notDeepEqual(outs[0].rects, outs[1].rects);
    assert.notDeepEqual(outs[1].rects, outs[2].rects);
});

test('7. Zustaende: Afterglow kuehl (OCEAN/STEEL) & Stopping endet bei vis=0 auf 0 fillRects', () => {
    const dse = new AmigaParallaxGround();
    for (let i = 0; i < 60; i++) {
        dse.render(createStrictFakeCanvas(455, 256).ctx, 455, 256, i * 0.02, 'climax', 1.0, makeMetrics({
            tensionPct: 1.0,
            beatStarted: i % 10 === 0,
            beatCount: Math.floor(i / 10) + 1,
            beatStrength: 0.9,
            beatLevel: 3
        }));
    }

    // Nach 1.2s Afterglow sind Staubpartikel ausgelaufen und Farben kuehl
    for (let i = 0; i < 60; i++) {
        dse.render(createStrictFakeCanvas(455, 256).ctx, 455, 256, 1.2 + i * 0.02, 'afterglow', i * 0.02, makeMetrics({ tensionPct: 0.2 }));
    }
    const coolSet = new Set([...RAMPS.OCEAN, ...RAMPS.STEEL, INK, SNOW]);
    const cAfter = createStrictFakeCanvas(455, 256);
    dse.render(cAfter.ctx, 455, 256, 2.5, 'afterglow', 1.3, makeMetrics({ tensionPct: 0.2 }));
    for (const r of cAfter.rects) {
        assert.ok(coolSet.has(r.fillStyle), `Afterglow nutzt OCEAN/STEEL/INK/SNOW, erhalten ${r.fillStyle}`);
    }

    const cStopEnd = createStrictFakeCanvas(455, 256);
    dse.render(cStopEnd.ctx, 455, 256, 4.0, 'stopping', 1.5, makeMetrics());
    assert.equal(cStopEnd.rects.length, 0);
});

test('8. Rotation & zero-crossing dirSlew halten Scroll endlich', () => {
    const dse = new AmigaParallaxGround();
    for (let i = 0; i < 16; i++) {
        dse.render(createStrictFakeCanvas(118, 256).ctx, 118, 256, i * 0.02, 'buildup', 1.0, makeMetrics({
            beatStarted: i === 8,
            beatCount: i === 8 ? 8 : i,
            beatStrength: 0.5,
            beatLevel: 2
        }));
    }
    assert.equal(dse.dirTarget, -1);

    // Durch Nulldurchgang des dirSlew rotieren
    dse.resize(606, 256);
    for (let i = 16; i < 45; i++) {
        const c = createStrictFakeCanvas(606, 256);
        dse.render(c.ctx, 606, 256, i * 0.02, 'buildup', 1.0, makeMetrics());
        for (let b = 0; b < 8; b++) {
            assert.ok(Number.isFinite(dse.scroll[b]), `scroll[${b}] muss endlich bleiben`);
        }
    }
    assert.equal(dse.dirSlew, -1);
});

test('9-10 & Spezial: Baender lueckenlos [horizon, height), kaskadierender Wipe, Poollimits & Budget <= 1500', () => {
    const viewports = [
        [85, 256],   // 1:3
        [118, 256],  // 390x844
        [455, 256],  // 1920x1080
        [554, 256],  // 844x390
        [606, 256],  // 2560x1080
        [768, 256]   // 3:1
    ];

    for (const [w, h] of viewports) {
        const dse = new AmigaParallaxGround();
        const horizon = Math.floor(h * 0.55);
        let lastC = null;
        for (let i = 0; i < 90; i++) {
            lastC = createStrictFakeCanvas(w, h);
            dse.render(lastC.ctx, w, h, i * 0.02, 'climax', 1.0 + i * 0.02, makeMetrics({
                tensionPct: 1.0,
                beatStarted: i % 15 === 0,
                beatCount: Math.floor(i / 15) + 1,
                beatImpulse: [0.85],
                beatStrength: 0.9,
                beatLevel: 3,
                smooth: [0.9, 0.7, 0.8, 0.6]
            }));
        }

        // Baender decken [horizon, height) exakt lueckenlos ab
        assert.equal(dse.bandY[0], horizon);
        for (let b = 0; b < 8; b++) {
            assert.ok(dse.bandH[b] >= 1);
            if (b < 7) assert.equal(dse.bandY[b] + dse.bandH[b], dse.bandY[b + 1]);
            else assert.equal(dse.bandY[b] + dse.bandH[b], h);
        }

        assert.ok(dse.lastActiveObjects <= 6, `Objekt-Pool (${dse.lastActiveObjects}) <= 6`);
        assert.ok(dse.lastActiveDust <= 16, `Staub-Pool (${dse.lastActiveDust}) <= 16`);
        assert.ok(lastC.rects.length <= 1500, `fillRect (${lastC.rects.length}) > 1500 bei ${w}x${h}`);

        const colors = new Set();
        for (const r of lastC.rects) {
            assertAmiga12BitHex(r.fillStyle);
            assert.ok(r.y >= horizon, `Keine Op oberhalb horizon (${r.y} < ${horizon})`);
            colors.add(r.fillStyle);
        }
        assert.ok(colors.size <= 26, `Palette unter 32 (${colors.size})`);
    }

    // Kaskadierender Themen-Wipe: Band 0 zeigt neues Thema deutlich vor Band 7
    const wipeDse = new AmigaParallaxGround();
    wipeDse.render(createStrictFakeCanvas(455, 256).ctx, 455, 256, 0.02, 'playing', 1.0, makeMetrics({
        beatStarted: true,
        beatCount: 4,
        beatStrength: 0.5,
        beatLevel: 2
    }));
    // Nach 0.30s: Band 0 ist laengst fertig gewechselt (localAge = 0.30 >= 0.25),
    // Band 7 (Versatz 7 * 0.07 = 0.49s) noch komplett beim alten Thema (localAge < 0)!
    const cWipe = createStrictFakeCanvas(455, 256);
    wipeDse.render(cWipe.ctx, 455, 256, 0.32, 'playing', 1.3, makeMetrics());
    const band0Rects = cWipe.rects.filter((r) => r.y >= wipeDse.bandY[0] && r.y < wipeDse.bandY[1]);
    const band7Rects = cWipe.rects.filter((r) => r.y >= wipeDse.bandY[7]);
    assert.ok(band0Rects.some((r) => RAMPS.STEEL.includes(r.fillStyle)), 'Band 0 muss bereits STEEL (theme 1) zeigen');
    assert.ok(!band7Rects.some((r) => RAMPS.STEEL.includes(r.fillStyle)), 'Band 7 darf nach 0.30s noch nicht auf STEEL gewechselt haben');
});

test('11. Registry-Metadaten von AmigaParallaxGround sind korrekt', () => {
    const entry = dseRegistry.find((e) => e.Class === AmigaParallaxGround);
    assert.ok(entry, 'AmigaParallaxGround muss in registry.js registriert sein');
    assert.deepEqual(entry.metadata.systems, ['amiga']);
    assert.equal(entry.metadata.layer, 'floor');
    assert.equal(entry.metadata.weight, 12);
    assert.equal(entry.metadata.duration, 14.0);
    assert.equal(entry.metadata.climaxHold, 12.0);
});