import test from 'node:test';
import assert from 'node:assert/strict';
import { AmigaTechTech } from '../js/visuals/dse/amiga/tech-tech.js';
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

test('1-2. Smoke, Idle, Numerik & Leben ohne Audio', () => {
    const dse = new AmigaTechTech();
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
        dse.render(c.ctx, 455, 256, t, st, 0.3, undefined);
        assert.ok(c.rects.length > 0, `Zustand ${st} muss ohne Metriken rendern`);
        const pal = new Set();
        for (const r of c.rects) {
            assertAmiga12BitHex(r.fillStyle);
            pal.add(r.fillStyle);
        }
        assert.ok(pal.size <= 32, `Palette ueber Budget (${pal.size})`);
        t += 0.02;
    }

    // Ohne Audio bewegt sich die Wand ueber t
    const live = new AmigaTechTech();
    const c1 = createStrictFakeCanvas(118, 256);
    const c2 = createStrictFakeCanvas(118, 256);
    live.render(c1.ctx, 118, 256, 0.1, 'playing', 1.0, undefined);
    live.render(c2.ctx, 118, 256, 0.7, 'playing', 1.6, undefined);
    assert.notDeepEqual(c1.rects, c2.rects);
});

test('3. Determinismus ueber 200 Frames', () => {
    const a = new AmigaTechTech();
    const b = new AmigaTechTech();
    for (let i = 0; i < 200; i++) {
        const onBeat = i % 12 === 0;
        const env = Math.max(0, 1 - (i % 12) / 9);
        const m = makeMetrics({
            tensionPct: Math.min(1, i / 140),
            beatStarted: onBeat,
            beatCount: Math.floor(i / 12) + 1,
            beat: [env],
            beatImpulse: [env * 0.6],
            beatStrength: 0.6,
            beatLevel: 2
        });
        const st = i < 20 ? 'starting' : (i < 100 ? 'buildup' : (i < 160 ? 'climax' : 'afterglow'));
        const cA = createStrictFakeCanvas(118, 256);
        const cB = createStrictFakeCanvas(118, 256);
        a.render(cA.ctx, 118, 256, i * 0.02, st, i * 0.02, m);
        b.render(cB.ctx, 118, 256, i * 0.02, st, i * 0.02, m);
        assert.deepEqual(cA.rects, cB.rects);
    }
});

test('4. Exakte Beats: Musterwechsel nur bei count % 4 === 0, kein Retrigger', () => {
    const dse = new AmigaTechTech();
    const c = createStrictFakeCanvas(118, 256);
    for (let b = 1; b <= 3; b++) {
        dse.render(c.ctx, 118, 256, b * 0.1, 'playing', 1.0, makeMetrics({
            beatStarted: true,
            beatCount: b,
            beatStrength: 0.5,
            beatLevel: 2
        }));
        assert.equal(dse.pat, 0, `Beat ${b} darf pat nicht wechseln`);
    }

    dse.render(c.ctx, 118, 256, 0.4, 'playing', 1.0, makeMetrics({
        beatStarted: true,
        beatCount: 4,
        beatStrength: 0.5,
        beatLevel: 2
    }));
    assert.equal(dse.pat, 1);

    const lockedShift = dse.shift;
    for (let i = 1; i <= 25; i++) {
        dse.render(c.ctx, 118, 256, 0.4 + i * 0.02, 'playing', 1.0, makeMetrics({
            beatStarted: false,
            beatCount: 4,
            beat: [0.9],
            beatImpulse: [0.85],
            beatStrength: 0.9,
            beatLevel: 3
        }));
        assert.equal(dse.pat, 1);
        assert.equal(dse.shift, lockedShift);
        assert.equal(dse.shockActive, false);
    }
});

test('5-6. Graduelle Beat-Staerken (soft/medium/hard) & Beat an/aus', () => {
    const strengths = [0.20, 0.50, 0.90];
    const outs = strengths.map((s) => {
        const dse = new AmigaTechTech();
        // Basisframe um Ausgangs-phi1 vor dem Beat zu messen
        const warmup = createStrictFakeCanvas(118, 256);
        dse.render(warmup.ctx, 118, 256, 0.0, 'playing', 1.0, makeMetrics());
        const phiBefore = dse.phi1;

        const c = createStrictFakeCanvas(118, 256);
        dse.render(c.ctx, 118, 256, 0.02, 'playing', 1.02, makeMetrics({
            beatStarted: true,
            beatCount: 1,
            beat: [1.0],
            beatImpulse: [s],
            beatStrength: s,
            beatLevel: s < 1 / 3 ? 1 : (s < 2 / 3 ? 2 : 3)
        }));
        return {
            phiDelta: dse.phi1 - phiBefore,
            shift: dse.shift,
            shockActive: dse.shockActive,
            rects: c.rects
        };
    });

    assert.ok(outs[0].phiDelta > 0.35 && outs[0].shift === 0 && !outs[0].shockActive);
    assert.ok(outs[1].phiDelta > 0.35 && outs[1].shift === 1 && !outs[1].shockActive);
    assert.equal(outs[2].shift, 2);
    assert.equal(outs[2].shockActive, true);
    assert.notDeepEqual(outs[0].rects, outs[1].rects);
    assert.notDeepEqual(outs[1].rects, outs[2].rects);
});

test('7. Zustaende, Afterglow (STEEL) & Stopping endet bei vis=0 vollstaendig', () => {
    const dse = new AmigaTechTech();
    for (let i = 1; i <= 45; i++) {
        dse.render(createStrictFakeCanvas(118, 256).ctx, 118, 256, i * 0.02, 'afterglow', i * 0.02, makeMetrics({ tensionPct: 0.2 }));
    }
    const steelAndInk = new Set([...RAMPS.STEEL, INK]);
    const cAfter = createStrictFakeCanvas(118, 256);
    dse.render(cAfter.ctx, 118, 256, 1.0, 'afterglow', 1.0, makeMetrics({ tensionPct: 0.2 }));
    for (const r of cAfter.rects) {
        assert.ok(steelAndInk.has(r.fillStyle), `Afterglow nutzt STEEL/INK, erhalten ${r.fillStyle}`);
    }

    const cStopEnd = createStrictFakeCanvas(118, 256);
    dse.render(cStopEnd.ctx, 118, 256, 2.5, 'stopping', 1.5, makeMetrics({ tensionPct: 0.1 }));
    assert.equal(cStopEnd.rects.length, 0);
});

test('8. Rotation Portrait -> Landscape -> Portrait behaelt phi1, pat, fam', () => {
    const dse = new AmigaTechTech();
    for (let i = 0; i < 8; i++) {
        dse.render(createStrictFakeCanvas(118, 256).ctx, 118, 256, i * 0.02, 'buildup', 1.0, makeMetrics({
            beatStarted: i === 4,
            beatCount: i,
            beatStrength: 0.5,
            beatLevel: 2
        }));
    }
    const phiBefore = dse.phi1;
    const patBefore = dse.pat;
    const famBefore = dse.fam;

    dse.resize(554, 256);
    const land = createStrictFakeCanvas(554, 256);
    dse.render(land.ctx, 554, 256, 8 * 0.02, 'buildup', 1.02, makeMetrics());
    assert.ok(Math.abs(dse.phi1 - phiBefore) < 0.2);
    assert.equal(dse.pat, patBefore);
    assert.equal(dse.fam, famBefore);
    assert.ok(land.rects.length > 0);
});

test('9-10 & Spezial: |dx| <= 0.2*minDim, rowH=3 auf Ultrawide, lueckenlose Laeufe in allen 4 Mustern & <= 6000 fillRects', () => {
    const viewports = [
        [85, 256, 2],   // 1:3 Extrem-Portraet
        [118, 256, 2],  // 390x844
        [455, 256, 2],  // 1920x1080
        [554, 256, 3],  // 844x390 (budget-geschuetzt auf 3)
        [606, 256, 3],  // 2560x1080 Ultrawide (muss 3 sein)
        [768, 256, 3]   // 3:1 Extrem-Querformat
    ];

    for (const [w, h, expectedRowH] of viewports) {
        const dse = new AmigaTechTech();
        const minDim = Math.min(w, h);
        for (let p = 0; p < 4; p++) {
            dse.pat = p;
            dse.patPrev = p;
            const c = createStrictFakeCanvas(w, h);
            dse.render(c.ctx, w, h, 0.5 + p * 0.06, 'climax', 1.0, makeMetrics({
                tensionPct: 1.0,
                beatImpulse: [1.0],
                smooth: [1, 1, 1, 1]
            }));

            assert.equal(dse.lastRowH, expectedRowH, `rowH bei ${w}x${h} erwartet ${expectedRowH}, erhalten ${dse.lastRowH}`);
            assert.ok(dse.lastMaxAbsDx <= 0.2 * minDim + 1e-9, `|dx| (${dse.lastMaxAbsDx}) > 0.2*minDim (${0.2 * minDim})`);
            assert.ok(c.rects.length <= 6000, `fillRect (${c.rects.length}) > 6000 bei ${w}x${h}, Muster P${p}`);

            // Lueckenlose Flaechenabdeckung pruefen (kein fehlender/ueberlappender Pixel nach Wrap)
            let areaSum = 0;
            const colors = new Set();
            for (const r of c.rects) {
                assertAmiga12BitHex(r.fillStyle);
                colors.add(r.fillStyle);
                areaSum += r.w * r.h;
            }
            assert.equal(areaSum, w * h, `Fläche bei ${w}x${h} Muster P${p} muss exakt w*h sein`);
            assert.ok(colors.size <= 13, `Einzelrampe + INK darf max 13 Farben nutzen (${colors.size})`);
        }
    }
});

test('Spezial: Zonenamplitude steigt monoton mit ch(2) bei isoliertem Kanal 2', () => {
    const levels = [0.0, 0.25, 0.5, 0.75, 1.0];
    const amps2 = [];
    for (const v of levels) {
        const dse = new AmigaTechTech();
        const c = createStrictFakeCanvas(118, 256);
        dse.render(c.ctx, 118, 256, 0.2, 'playing', 1.0, makeMetrics({
            tensionPct: 0.4,
            smooth: [0, 0, v, 0]
        }));
        amps2.push(dse.lastZoneAmps[2]);
        assert.ok(dse.lastZoneAmps[2] >= dse.lastZoneAmps[0]);
        assert.ok(dse.lastZoneAmps[2] >= dse.lastZoneAmps[1]);
        assert.ok(dse.lastZoneAmps[2] >= dse.lastZoneAmps[3]);
    }

    for (let i = 1; i < amps2.length; i++) {
        assert.ok(amps2[i] > amps2[i - 1], `Amplitude muss monoton mit ch(2) steigen: ${amps2}`);
    }
});

test('11. Registry-Metadaten von AmigaTechTech sind korrekt', () => {
    const entry = dseRegistry.find((e) => e.Class === AmigaTechTech);
    assert.ok(entry, 'AmigaTechTech muss in registry.js registriert sein');
    assert.deepEqual(entry.metadata.systems, ['amiga']);
    assert.equal(entry.metadata.layer, 'background');
    assert.equal(entry.metadata.weight, 12);
    assert.equal(entry.metadata.duration, 13.0);
    assert.equal(entry.metadata.climaxHold, 12.0);
});