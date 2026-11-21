import test from 'node:test';
import assert from 'node:assert/strict';
import { AmigaTwister } from '../js/visuals/dse/amiga/twister.js';
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
    const dse = new AmigaTwister();
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
        dse.render(c.ctx, 455, 256, t, st, 0.4, undefined);
        assert.ok(c.rects.length > 0, `Zustand ${st} muss ohne Metriken rendern`);
        const pal = new Set();
        for (const r of c.rects) {
            assertAmiga12BitHex(r.fillStyle);
            pal.add(r.fillStyle);
        }
        assert.ok(pal.size <= 32, `Palette ueber Budget (${pal.size})`);
        t += 0.02;
    }

    // Ohne Audio dreht sich der Balken weiter ueber t
    const live = new AmigaTwister();
    const c1 = createStrictFakeCanvas(118, 256);
    const c2 = createStrictFakeCanvas(118, 256);
    live.render(c1.ctx, 118, 256, 0.1, 'playing', 1.0, undefined);
    live.render(c2.ctx, 118, 256, 0.6, 'playing', 1.5, undefined);
    assert.notDeepEqual(c1.rects, c2.rects);
});

test('3. Determinismus ueber 200 Frames', () => {
    const a = new AmigaTwister();
    const b = new AmigaTwister();
    for (let i = 0; i < 200; i++) {
        const onBeat = i % 10 === 0;
        const env = Math.max(0, 1 - (i % 10) / 8);
        const m = makeMetrics({
            tensionPct: Math.min(1, i / 140),
            beatStarted: onBeat,
            beatCount: Math.floor(i / 10) + 1,
            beat: [env],
            beatImpulse: [env * 0.5],
            beatStrength: 0.5,
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

test('4. Exakte Beats: mode wechselt nur bei count % 4 === 0, kein Retrigger', () => {
    const dse = new AmigaTwister();
    const c = createStrictFakeCanvas(118, 256);
    for (let b = 1; b <= 3; b++) {
        dse.render(c.ctx, 118, 256, b * 0.1, 'playing', 1.0, makeMetrics({
            beatStarted: true,
            beatCount: b,
            beatStrength: 0.5,
            beatLevel: 2
        }));
        assert.equal(dse.mode, 0, `Beat ${b} darf mode nicht wechseln`);
    }

    dse.render(c.ctx, 118, 256, 0.4, 'playing', 1.0, makeMetrics({
        beatStarted: true,
        beatCount: 4,
        beatStrength: 0.5,
        beatLevel: 2
    }));
    assert.equal(dse.mode, 1);

    const lockedBand = dse.bandPhase;
    for (let i = 1; i <= 25; i++) {
        dse.render(c.ctx, 118, 256, 0.4 + i * 0.02, 'playing', 1.0, makeMetrics({
            beatStarted: false,
            beatCount: 4,
            beat: [0.9],
            beatImpulse: [0.85],
            beatStrength: 0.9,
            beatLevel: 3
        }));
        assert.equal(dse.mode, 1);
        assert.equal(dse.bandPhase, lockedBand);
    }
});

test('5-6. Graduelle Beat-Staerken (soft/medium/hard) & Beat an/aus', () => {
    const topColors = new Set(CH_RAMPS.map((r) => RAMPS[r][5]));
    const strengths = [0.20, 0.50, 0.90];
    const outs = strengths.map((s) => {
        const dse = new AmigaTwister();
        const c = createStrictFakeCanvas(118, 256);
        dse.render(c.ctx, 118, 256, 0.02, 'playing', 1.0, makeMetrics({
            beatStarted: true,
            beatCount: 1,
            beat: [1.0],
            beatImpulse: [s],
            beatStrength: s,
            beatLevel: s < 1 / 3 ? 1 : (s < 2 / 3 ? 2 : 3),
            smooth: [0.9, 0.2, 0.2, 0.2]
        }));
        const level5Count = c.rects.filter((r) => topColors.has(r.fillStyle) && r.w > 1).length;
        return {
            bandPhase: dse.bandPhase,
            twistKick: dse.twistKick,
            level5Count,
            rects: c.rects
        };
    });

    assert.equal(outs[0].bandPhase, 1);
    assert.equal(outs[0].twistKick, 0);
    assert.equal(outs[1].bandPhase, 0);
    assert.ok(outs[1].twistKick > 0.5);
    assert.ok(outs[2].level5Count > outs[0].level5Count);
    assert.ok(outs[2].level5Count > outs[1].level5Count);
    assert.notDeepEqual(outs[0].rects, outs[1].rects);
    assert.notDeepEqual(outs[1].rects, outs[2].rects);
});

test('7. Zustaende: kein Schwarz-Vollbild-Dither, COOL-Afterglow, Stopping endet auf 0 fillRects', () => {
    const dse = new AmigaTwister();
    const cStart = createStrictFakeCanvas(455, 256);
    dse.render(cStart.ctx, 455, 256, 0.05, 'starting', 0.15, makeMetrics());
    // Kein Vollbild-Schwarzvorhang im Starting (Hintergrund muss sichtbar bleiben)
    const totalArea = cStart.rects.reduce((acc, r) => acc + r.w * r.h, 0);
    assert.ok(totalArea < 455 * 256 * 0.25, 'Foreground starting darf keinen Vollbild-Dither malen');

    for (let i = 1; i <= 75; i++) {
        dse.render(createStrictFakeCanvas(118, 256).ctx, 118, 256, 0.1 + i * 0.02, 'afterglow', i * 0.02, makeMetrics({ tensionPct: 0.2 }));
    }
    assert.ok(dse.twist < 0.7, `Afterglow muss twist Richtung 0.6 entspannen (${dse.twist})`);
    const coolSet = new Set([...RAMPS[COOL[0]], ...RAMPS[COOL[1]], INK]);
    const cAfter = createStrictFakeCanvas(118, 256);
    dse.render(cAfter.ctx, 118, 256, 2.0, 'afterglow', 1.6, makeMetrics({ tensionPct: 0.2 }));
    for (const r of cAfter.rects) {
        assert.ok(coolSet.has(r.fillStyle), `Afterglow nutzt COOL/INK, erhalten ${r.fillStyle}`);
    }

    const cStopEnd = createStrictFakeCanvas(455, 256);
    dse.render(cStopEnd.ctx, 455, 256, 3.0, 'stopping', 1.5, makeMetrics());
    assert.equal(cStopEnd.rects.length, 0);
});

test('8. Rotation Portrait -> Landscape -> Portrait behaelt Phasen & Zustand', () => {
    const dse = new AmigaTwister();
    for (let i = 0; i < 10; i++) {
        dse.render(createStrictFakeCanvas(118, 256).ctx, 118, 256, i * 0.02, 'buildup', 1.0, makeMetrics({
            beatStarted: i === 4,
            beatCount: i,
            beatStrength: 0.5,
            beatLevel: 2
        }));
    }
    const phaseBefore = dse.rotPhase;
    const modeBefore = dse.mode;

    dse.resize(554, 256);
    const land = createStrictFakeCanvas(554, 256);
    dse.render(land.ctx, 554, 256, 10 * 0.02, 'buildup', 1.02, makeMetrics());
    assert.equal(dse.lastTwisterCount, 2);
    assert.ok(Math.abs(dse.rotPhase - phaseBefore) < 0.2);
    assert.equal(dse.mode, modeBefore);

    dse.resize(118, 256);
    const portAgain = createStrictFakeCanvas(118, 256);
    dse.render(portAgain.ctx, 118, 256, 11 * 0.02, 'buildup', 1.04, makeMetrics());
    assert.equal(dse.lastTwisterCount, 1);
});

test('9-10 & Spezial: Balkenzahl n nach Tabelle, max. 2 Flaechen/Zeile, Kanalstabilitaet & Budget <= 2000', () => {
    const viewports = [
        [85, 256, 1],   // 1:3
        [341, 256, 1],  // 4:3
        [455, 256, 2],  // 16:9
        [606, 256, 3],  // 21:9 (2560x1080)
        [768, 256, 3]   // 3:1
    ];

    for (const [w, h, expectedN] of viewports) {
        const dse = new AmigaTwister();
        const c = createStrictFakeCanvas(w, h);
        dse.render(c.ctx, w, h, 0.5, 'climax', 1.0, makeMetrics({
            tensionPct: 1.0,
            smooth: [0.2, 0.4, 1.0, 0.1]
        }));
        assert.equal(dse.lastTwisterCount, expectedN, `n bei ${w}x${h} erwartet ${expectedN}`);
        assert.ok(dse.lastMaxVisibleFacesPerRow <= 2, `Max 2 Flaechen pro Zeile, erhalten ${dse.lastMaxVisibleFacesPerRow}`);
        assert.ok(c.rects.length <= 2000, `fillRect (${c.rects.length}) > 2000 bei ${w}x${h}`);

        const colors = new Set();
        for (const r of c.rects) {
            assertAmiga12BitHex(r.fillStyle);
            colors.add(r.fillStyle);
        }
        assert.ok(colors.size <= 25, `Normale Climax-Palette <= 25 (${colors.size})`);
    }

    // Feste Kanalzuordnung: isolierter Kanal 2 faerbt genau Flaeche 2 (JADE) heller
    const dseCh = new AmigaTwister();
    const cLow = createStrictFakeCanvas(118, 256);
    const cHigh = createStrictFakeCanvas(118, 256);
    dseCh.render(cLow.ctx, 118, 256, 0.2, 'playing', 1.0, makeMetrics({ smooth: [0, 0, 0, 0] }));
    const dseCh2 = new AmigaTwister();
    dseCh2.render(cHigh.ctx, 118, 256, 0.2, 'playing', 1.0, makeMetrics({ smooth: [0, 0, 1, 0] }));

    const jadeBright = new Set([RAMPS.JADE[4], RAMPS.JADE[5]]);
    const jadeLowHits = cLow.rects.filter((r) => jadeBright.has(r.fillStyle)).length;
    const jadeHighHits = cHigh.rects.filter((r) => jadeBright.has(r.fillStyle)).length;
    assert.ok(jadeHighHits > jadeLowHits, `Flaeche 2 (JADE) muss mit ch(2) aufleuchten (${jadeHighHits} > ${jadeLowHits})`);
});

test('11. Registry-Metadaten von AmigaTwister sind korrekt', () => {
    const entry = dseRegistry.find((e) => e.Class === AmigaTwister);
    assert.ok(entry, 'AmigaTwister muss in registry.js registriert sein');
    assert.deepEqual(entry.metadata.systems, ['amiga']);
    assert.equal(entry.metadata.layer, 'foreground');
    assert.equal(entry.metadata.weight, 12);
    assert.equal(entry.metadata.duration, 14.0);
    assert.equal(entry.metadata.climaxHold, 14.0);
});