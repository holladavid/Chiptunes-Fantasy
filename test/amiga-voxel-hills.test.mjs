import test from 'node:test';
import assert from 'node:assert/strict';
import { AmigaVoxelHills } from '../js/visuals/dse/amiga/voxel-hills.js';
import { RAMPS, INK } from '../js/visuals/dse/amiga/amiga-kit.js';
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

test('1-2. Smoke, Idle, Numerik, oberer Himmel geschont & Leben ohne Audio', () => {
    const dse = new AmigaVoxelHills();
    const idleCanvas = createStrictFakeCanvas(455, 256);
    dse.render(idleCanvas.ctx, 455, 256, 0, 'idle', 0, undefined);
    assert.equal(idleCanvas.rects.length, 0);

    dse.render(idleCanvas.ctx, 0, 256, 0.02, 'playing', 0.1, undefined);
    dse.render(idleCanvas.ctx, 455, 0, 0.04, 'playing', 0.1, undefined);
    dse.render(idleCanvas.ctx, NaN, 256, 0.06, 'playing', 0.1, undefined);

    const skyCeiling = Math.floor(256 * 0.14);
    const states = ['starting', 'playing', 'buildup', 'climax', 'afterglow', 'stopping'];
    let t = 0.1;
    for (const st of states) {
        const c = createStrictFakeCanvas(455, 256);
        dse.render(c.ctx, 455, 256, t, st, 0.5, undefined);
        assert.ok(c.rects.length > 0, `Zustand ${st} muss ohne Metriken rendern`);
        assert.equal(dse.lastAllFinite, true);
        assert.equal(dse.lastMonotonicYTop, true);
        const pal = new Set();
        for (const r of c.rects) {
            assertAmiga12BitHex(r.fillStyle);
            assert.ok(r.y >= skyCeiling, `Oberste 14% Himmel bleiben frei (${r.y} < ${skyCeiling})`);
            pal.add(r.fillStyle);
        }
        assert.ok(pal.size <= 32, `Palette ueber Budget (${pal.size})`);
        t += 0.02;
    }

    // Ohne Audio fliegt die Kamera weiter ueber t
    const live = new AmigaVoxelHills();
    const c1 = createStrictFakeCanvas(118, 256);
    const c2 = createStrictFakeCanvas(118, 256);
    live.render(c1.ctx, 118, 256, 0.1, 'playing', 1.0, undefined);
    live.render(c2.ctx, 118, 256, 0.5, 'playing', 1.4, undefined);
    assert.notDeepEqual(c1.rects, c2.rects);
});

test('3. Determinismus ueber 200 Frames', () => {
    const a = new AmigaVoxelHills();
    const b = new AmigaVoxelHills();
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
            beatLevel: 2,
            smooth: [0.8, 0.5, 0.7, 0.4]
        });
        const st = i < 15 ? 'starting' : (i < 100 ? 'buildup' : (i < 160 ? 'climax' : 'afterglow'));
        const cA = createStrictFakeCanvas(455, 256);
        const cB = createStrictFakeCanvas(455, 256);
        a.render(cA.ctx, 455, 256, i * 0.02, st, i * 0.02, m);
        b.render(cB.ctx, 455, 256, i * 0.02, st, i * 0.02, m);
        assert.deepEqual(cA.rects, cB.rects);
    }
});

test('4. Exakte Beats: Terrainwechsel nur bei count % 4 === 0, kein Retrigger', () => {
    const dse = new AmigaVoxelHills();
    const c = createStrictFakeCanvas(455, 256);
    for (let b = 1; b <= 3; b++) {
        dse.render(c.ctx, 455, 256, b * 0.1, 'playing', 1.0, makeMetrics({
            beatStarted: true,
            beatCount: b,
            beatStrength: 0.5,
            beatLevel: 2
        }));
        assert.equal(dse.terrain, 0);
    }

    dse.render(c.ctx, 455, 256, 0.4, 'playing', 1.0, makeMetrics({
        beatStarted: true,
        beatCount: 4,
        beatStrength: 0.5,
        beatLevel: 2
    }));
    assert.equal(dse.terrain, 1);

    for (let i = 1; i <= 25; i++) {
        dse.render(c.ctx, 455, 256, 0.4 + i * 0.02, 'playing', 1.0, makeMetrics({
            beatStarted: false,
            beatCount: 4,
            beat: [0.9],
            beatImpulse: [0.85],
            beatStrength: 0.9,
            beatLevel: 3
        }));
        assert.equal(dse.terrain, 1);
    }
});

test('5-6. Graduelle Beat-Staerken (soft/medium/hard) & Beat an/aus', () => {
    const strengths = [0.20, 0.50, 0.90];
    const outs = strengths.map((s) => {
        const dse = new AmigaVoxelHills();
        const c = createStrictFakeCanvas(455, 256);
        dse.render(c.ctx, 455, 256, 0.02, 'playing', 1.0, makeMetrics({
            beatStarted: true,
            beatCount: 1,
            beat: [1.0],
            beatImpulse: [s],
            beatStrength: s,
            beatLevel: s < 1 / 3 ? 1 : (s < 2 / 3 ? 2 : 3),
            smooth: [0.8, 0.8, 0.8, 0.8]
        }));
        return {
            boost: dse.lastContourBoost,
            width: dse.lastContourWidth,
            yawKick: dse.lastMaxYawKick,
            rects: c.rects
        };
    });

    assert.equal(outs[0].boost, 1);
    assert.equal(outs[0].width, 1.2);
    assert.equal(outs[0].yawKick, 0);
    assert.equal(outs[1].boost, 2);
    assert.equal(outs[1].width, 1.2);
    assert.equal(outs[2].boost, 3);
    assert.equal(outs[2].width, 2.4);
    assert.ok(outs[2].yawKick > 0.05);
    assert.notDeepEqual(outs[0].rects, outs[1].rects);
    assert.notDeepEqual(outs[1].rects, outs[2].rects);
});

test('7. Zustaende: Afterglow (STEEL + INK) & Stopping endet bei vis=0 auf 0 fillRects', () => {
    const dse = new AmigaVoxelHills();
    for (let i = 0; i < 45; i++) {
        dse.render(createStrictFakeCanvas(455, 256).ctx, 455, 256, i * 0.02, 'afterglow', i * 0.02, makeMetrics({
            tensionPct: 0.2,
            smooth: [0, 0, 0, 0]
        }));
    }
    const steelAndInk = new Set([...RAMPS.STEEL, INK]);
    const cAfter = createStrictFakeCanvas(455, 256);
    dse.render(cAfter.ctx, 455, 256, 1.0, 'afterglow', 1.0, makeMetrics({
        tensionPct: 0.2,
        smooth: [0, 0, 0, 0]
    }));
    for (const r of cAfter.rects) {
        assert.ok(steelAndInk.has(r.fillStyle), `Afterglow-Terrain nutzt STEEL/INK, erhalten ${r.fillStyle}`);
    }

    const cStopEnd = createStrictFakeCanvas(455, 256);
    dse.render(cStopEnd.ctx, 455, 256, 3.0, 'stopping', 1.5, makeMetrics());
    assert.equal(cStopEnd.rects.length, 0);
});

test('8. Rotation Portrait -> Landscape -> Portrait behaelt camZ & ridge auf derselben Instanz', () => {
    const dse = new AmigaVoxelHills();
    for (let i = 0; i < 30; i++) {
        dse.render(createStrictFakeCanvas(118, 256).ctx, 118, 256, i * 0.02, 'buildup', 1.0, makeMetrics({
            smooth: [0.9, 0.5, 0.7, 0.4]
        }));
    }
    const camZBefore = dse.camZ;
    const ridgeSnap = Float32Array.from(dse.ridge);

    dse.resize(606, 256);
    const ultra = createStrictFakeCanvas(606, 256);
    dse.render(ultra.ctx, 606, 256, 30 * 0.02, 'buildup', 1.02, makeMetrics({
        smooth: [0.9, 0.5, 0.7, 0.4]
    }));
    assert.ok(dse.camZ > camZBefore);
    assert.ok(dse.ridge.some((v, idx) => v > 0 && ridgeSnap[idx] > 0));
    assert.equal(dse.lastMonotonicYTop, true);
});

test('9-10 & Spezial: Gipfel ueber Horizont mit transparenten Himmelsluecken, Boden [horizon..h) lueckenlos & Budgets', () => {
    const viewports = [
        [85, 256],   // 1:3
        [118, 256],  // 390x844
        [455, 256],  // 1920x1080
        [554, 256],  // 844x390
        [606, 256],  // 2560x1080
        [768, 256]   // 3:1
    ];

    for (const [w, h] of viewports) {
        const dse = new AmigaVoxelHills();
        const horizon = Math.floor(h * 0.55);
        const skyCeiling = Math.floor(h * 0.14);
        let lastC = null;
        for (let i = 0; i < 60; i++) {
            lastC = createStrictFakeCanvas(w, h);
            dse.render(lastC.ctx, w, h, i * 0.02, 'climax', 1.0 + i * 0.02, makeMetrics({
                tensionPct: 1.0,
                beatImpulse: [0.9],
                smooth: [1.0, 0.8, 0.9, 0.7]
            }));
            assert.ok(dse.lastSpawnStepCells <= 64, `Spawn (${dse.lastSpawnStepCells}) > 64`);
            assert.ok(dse.lastSamples <= 12000, `Samples (${dse.lastSamples}) > 12000 bei ${w}x${h}`);
        }

        assert.equal(dse.lastMonotonicYTop, true);
        assert.equal(dse.lastAllFinite, true);
        assert.ok(dse.lastMinPeakY < horizon, `Einzelne Berggipfel duerfen ueber den Horizont (${horizon}) ragen (${dse.lastMinPeakY})`);
        assert.ok(lastC.rects.length <= 3500, `fillRect (${lastC.rects.length}) > 3500 bei ${w}x${h}`);

        // Unterhalb des Horizonts muessen volle w * (h - horizon) Pixel lueckenlos gefuellt sein;
        // oberhalb bleibt leerer Himmel zwischen den Gipfeln transparent.
        let floorArea = 0;
        const colors = new Set();
        for (const r of lastC.rects) {
            assertAmiga12BitHex(r.fillStyle);
            assert.ok(r.y >= skyCeiling);
            colors.add(r.fillStyle);

            const fy0 = Math.max(horizon, r.y);
            const fy1 = Math.min(h, r.y + r.h);
            if (fy1 > fy0) {
                floorArea += r.w * (fy1 - fy0);
            }
        }
        assert.equal(floorArea, w * (h - horizon), `Boden [horizon..height) muss bei ${w}x${h} lueckenlos gefuellt sein`);
        assert.ok(colors.size <= 32, `Palette ueber 32 (${colors.size})`);
    }
});

test('11. Registry-Metadaten von AmigaVoxelHills und VoidFloor-Gewicht sind korrekt', () => {
    const entry = dseRegistry.find((e) => e.Class === AmigaVoxelHills);
    assert.ok(entry, 'AmigaVoxelHills muss in registry.js registriert sein');
    assert.deepEqual(entry.metadata.systems, ['amiga']);
    assert.equal(entry.metadata.layer, 'floor');
    assert.equal(entry.metadata.weight, 12);
    assert.equal(entry.metadata.duration, 15.0);
    assert.equal(entry.metadata.climaxHold, 15.0);

    const voidFloor = dseRegistry.find((e) => e.metadata.name === 'VoidFloor');
    assert.ok(voidFloor);
    assert.equal(voidFloor.metadata.weight, 18);
});