import test from 'node:test';
import assert from 'node:assert/strict';
import { C64FireWall } from '../js/visuals/dse/c64/fire-wall.js';
import { C64_PALETTE, rgbToHex } from '../js/visuals/utils/hardware-constraints.js';
import { makeMetrics, GRADED_BEAT_STRENGTHS } from '../tools/dse-baseline/harness.js';

const VALID_C64_HEX = new Set(C64_PALETTE.map(([r, g, b]) => rgbToHex(r, g, b).toLowerCase()));
const BLUE_RAMP_HEX = new Set([0, 6, 14, 3, 1].map(idx => rgbToHex(...C64_PALETTE[idx]).toLowerCase()));

function createUltraStrictBgCanvas(width, height) {
    const rects = [];
    let currentStyle = '#000000';
    let globalAlphaVal = 1.0;

    const forbid = (name) => () => {
        throw new Error(`Verbotene Canvas-Operation in DSE aufgerufen: ${name}`);
    };

    const ctx = {
        get globalAlpha() { return globalAlphaVal; },
        set globalAlpha(val) {
            assert.equal(val, 1, `globalAlpha muss 1 bleiben, erhalten: ${val}`);
            globalAlphaVal = val;
        },
        get fillStyle() { return currentStyle; },
        set fillStyle(val) { currentStyle = String(val); },
        fillRect(x, y, w, h) {
            assert.ok(Number.isFinite(x) && Number.isFinite(y), `Ungültige Koordinate (${x}, ${y})`);
            assert.ok(Number.isFinite(w) && Number.isFinite(h), `Ungültige Größe (${w}x${h})`);
            assert.ok(w > 0 && h > 0, `Nichtpositive Größe: ${w}x${h}`);
            assert.equal(x, Math.floor(x), `x nicht ganzzahlig: ${x}`);
            assert.equal(y, Math.floor(y), `y nicht ganzzahlig: ${y}`);
            assert.equal(w, Math.floor(w), `w nicht ganzzahlig: ${w}`);
            assert.equal(h, Math.floor(h), `h nicht ganzzahlig: ${h}`);
            assert.ok(x >= 0 && x + w <= width, `X außerhalb: ${x}+${w} > ${width}`);
            assert.ok(y >= 0 && y + h <= height, `Y außerhalb: ${y}+${h} > ${height}`);
            assert.ok(VALID_C64_HEX.has(currentStyle.toLowerCase()), `Unerlaubte C64-Farbe: ${currentStyle}`);
            rects.push({ x, y, w, h, fillStyle: currentStyle });
        },
        fillText: forbid('fillText'),
        measureText: forbid('measureText'),
        save: forbid('save'),
        restore: forbid('restore'),
        clip: forbid('clip'),
        getImageData: forbid('getImageData'),
        arc: forbid('arc'),
        lineTo: forbid('lineTo')
    };

    return { ctx, rects };
}

function makeFireMetrics(overrides = {}) {
    return {
        system: 'c64',
        energy: 0.45,
        pulse: 0.1,
        tensionPct: 0.40,
        beat: [0],
        beatImpulse: [0],
        beatStarted: false,
        beatCount: 0,
        beatStrength: 0,
        beatLevel: 0,
        smooth: [0.3, 0.3, 0.3],
        isClimaxLocked: false,
        ...overrides
    };
}

test('Smoke, Numerik, PAL-Zeitbasis, nahtloser Horizont & Stopping-Ende', () => {
    const fire = new C64FireWall();

    const idleCanvas = createUltraStrictBgCanvas(320, 200);
    fire.render(idleCanvas.ctx, 320, 200, 0, 'idle', 0, undefined);
    assert.equal(idleCanvas.rects.length, 0);

    fire.render(idleCanvas.ctx, 0, 200, 0.02, 'playing', 0, undefined);
    fire.render(idleCanvas.ctx, 320, 0, 0.04, 'playing', 0, undefined);
    fire.render(idleCanvas.ctx, NaN, 200, 0.06, 'playing', 0, undefined);
    fire.render(idleCanvas.ctx, 320, -2, 0.08, 'playing', 0, undefined);

    // Auch bei ten = 0 und ohne smooth müssen oberhalb und bündig an horizon Flammen brennen
    let t = 0.1;
    let flameRectsAboveHorizon = 0;
    let horizonSeamCovered = false;
    for (let i = 0; i < 40; i++) {
        const c = createUltraStrictBgCanvas(320, 200);
        fire.render(c.ctx, 320, 200, t, 'playing', t, makeFireMetrics({
            tensionPct: 0.0,
            smooth: [0, 0, 0]
        }));
        flameRectsAboveHorizon = c.rects.filter(r => r.y < 95 && r.fillStyle !== '#000000').length;
        // Prüft, dass bei cell=3 keine dunkle 2-px-Lücke bei y=108..109 vor horizon=110 entsteht
        horizonSeamCovered = c.rects.some(r =>
            r.y <= 108 && r.y + r.h === 110 && r.w >= 160 && r.fillStyle !== '#000000'
        );
        t += 0.02;
    }
    assert.ok(flameRectsAboveHorizon > 10, 'Ohne Audio und bei ten=0 müssen Flammen deutlich oberhalb des Horizonts brennen');
    assert.ok(horizonSeamCovered, 'Unterste Flammenzeile muss lückenlos bis y=horizon (110) reichen');

    const states = ['starting', 'playing', 'buildup', 'climax', 'afterglow', 'stopping'];
    for (const st of states) {
        const c = createUltraStrictBgCanvas(320, 200);
        fire.render(c.ctx, 320, 200, t, st, 0.25, undefined);
        assert.ok(c.rects.length > 0, `Zustand ${st} muss ohne Metriken zeichnen`);
        t += 0.02;
    }

    const snapA = createUltraStrictBgCanvas(320, 200);
    const snapB = createUltraStrictBgCanvas(320, 200);
    fire.render(snapA.ctx, 320, 200, t, 'playing', t, undefined);
    fire.render(snapB.ctx, 320, 200, t, 'playing', t, undefined);
    assert.deepEqual(snapA.rects, snapB.rects);

    const endStop = createUltraStrictBgCanvas(320, 200);
    fire.render(endStop.ctx, 320, 200, t + 0.02, 'stopping', 1.5, undefined);
    assert.equal(endStop.rects.length, 0, 'Bei vis = 0 darf nichts mehr gezeichnet werden');
});

test('Zusatztest §5.2: Determinismus über 300 Frames liefert identische Operationsfolge', () => {
    const fA = new C64FireWall();
    const fB = new C64FireWall();
    const opsA = [];
    const opsB = [];

    for (let f = 0; f < 300; f++) {
        const state = f < 25 ? 'starting' : f < 100 ? 'playing' : f < 180 ? 'buildup' : f < 250 ? 'climax' : 'afterglow';
        const m = makeMetrics('c64', state === 'starting' ? 'playing' : state, f, 'pattern', f);
        const t = 1 + f / 50;

        const cA = createUltraStrictBgCanvas(320, 200);
        const cB = createUltraStrictBgCanvas(320, 200);
        fA.render(cA.ctx, 320, 200, t, state, f * 0.02, m);
        fB.render(cB.ctx, 320, 200, t, state, f * 0.02, m);
        opsA.push(cA.rects);
        opsB.push(cB.rects);
    }

    assert.deepEqual(opsA, opsB);
});

test('Zusatztests §5.2: Resize Porträt -> Querformat erhält Hitzefeld, Pool <= 24, Cooldown 0.25 s, fam ohne beatStarted stabil', () => {
    const fire = new C64FireWall();
    let t = 0.02;

    for (let i = 0; i < 40; i++) {
        const c = createUltraStrictBgCanvas(92, 200);
        fire.render(c.ctx, 92, 200, t, 'climax', t, makeFireMetrics({
            tensionPct: 0.9,
            beatStarted: false,
            beat: [0.95],
            beatImpulse: [0.95],
            smooth: [0.9, 0.9, 0.9]
        }));
        t += 0.02;
    }
    assert.equal(fire.fam, 3, 'Ohne beatStarted darf fam nicht wechseln');

    fire.resize(844, 390);
    const cLand = createUltraStrictBgCanvas(432, 200);
    fire.render(cLand.ctx, 432, 200, t, 'climax', t, makeFireMetrics({
        tensionPct: 0.9,
        smooth: [0.9, 0.9, 0.9]
    }));

    let sumHeat = 0;
    let maxRowWithHeat = 0;
    for (let y = 0; y < fire.hRow; y++) {
        for (let x = 0; x < fire.cols; x++) {
            const hv = fire.heat[y * fire.cols + x];
            sumHeat += hv;
            if (hv > 20 && y < fire.hRow - 2) maxRowWithHeat++;
        }
    }
    assert.ok(sumHeat > 5000 && maxRowWithHeat > 50, 'Hitzefeld darf bei Resize nicht auf Null zurückfallen');

    fire.hardColCount = 0;
    for (let k = 0; k < 10; k++) {
        t += 0.04;
        const ck = createUltraStrictBgCanvas(432, 200);
        fire.render(ck.ctx, 432, 200, t, 'climax', t, makeFireMetrics({
            tensionPct: 0.95,
            beatStarted: true,
            beatCount: k + 1,
            beatStrength: 0.9,
            beatLevel: 3
        }));
    }
    assert.ok(fire.hardColCount <= 2, `Hard-Cooldown verletzt: ${fire.hardColCount} Säulen in 0.40s`);

    assert.equal(fire.sparkLife.length, 24);
    let activeSparks = 0;
    for (let i = 0; i < fire.sparkLife.length; i++) {
        if (fire.sparkLife[i] > 0) activeSparks++;
    }
    assert.ok(activeSparks <= 24);

    t += 0.30;
    const c4 = createUltraStrictBgCanvas(432, 200);
    fire.render(c4.ctx, 432, 200, t, 'climax', t, makeFireMetrics({
        tensionPct: 0.9,
        beatStarted: true,
        beatCount: 4,
        beatStrength: 0.5,
        beatLevel: 2
    }));
    assert.equal(fire.wipeActive, true);
    assert.equal(fire.wipeTo, 0);
});

test('Beat-Intensität (§8): Quellhitzesumme über 6 Schritte & Funkenzahl unterscheiden soft / medium / hard', () => {
    const modes = ['soft', 'medium', 'hard'];
    const heatSums = {};
    const sparkCounts = {};
    const onsetSnaps = {};
    const frame8Snaps = {};

    for (const mode of modes) {
        const s = GRADED_BEAT_STRENGTHS[mode];
        const lvl = mode === 'soft' ? 1 : (mode === 'medium' ? 2 : 3);
        const fire = new C64FireWall();

        for (let w = 0; w < 20; w++) {
            const cw = createUltraStrictBgCanvas(320, 200);
            fire.render(cw.ctx, 320, 200, 0.02 * (w + 1), 'playing', 0.02 * (w + 1), makeFireMetrics({
                tensionPct: 0.30,
                smooth: [0.2, 0.2, 0.2]
            }));
        }

        const c0 = createUltraStrictBgCanvas(320, 200);
        fire.render(c0.ctx, 320, 200, 1.0, 'playing', 3.0, makeFireMetrics({
            tensionPct: 0.30,
            beatStarted: true,
            beatCount: 1,
            beat: [1.0],
            beatImpulse: [s],
            beatStrength: s,
            beatLevel: lvl,
            smooth: [0.2, 0.2, 0.2]
        }));
        onsetSnaps[mode] = c0.rects;

        let activeSparks = 0;
        for (let i = 0; i < fire.sparkLife.length; i++) {
            if (fire.sparkLife[i] > 0) activeSparks++;
        }
        sparkCounts[mode] = activeSparks;

        let sum6 = fire.lastSourceHeatSum;
        for (let st = 1; st < 6; st++) {
            const cs = createUltraStrictBgCanvas(320, 200);
            fire.render(cs.ctx, 320, 200, 1.0 + st * 0.02, 'playing', 3.0 + st * 0.02, makeFireMetrics({
                tensionPct: 0.30,
                beatStarted: false,
                beatCount: 1,
                beat: [0.8],
                beatImpulse: [0.8 * s],
                beatStrength: s,
                beatLevel: lvl,
                smooth: [0.2, 0.2, 0.2]
            }));
            sum6 += fire.lastSourceHeatSum;
        }
        heatSums[mode] = sum6;

        let lastRects = c0.rects;
        for (let f = 1; f <= 8; f++) {
            const env = Math.max(0, 0.82 - f * 0.19);
            const cf = createUltraStrictBgCanvas(320, 200);
            fire.render(cf.ctx, 320, 200, 1.12 + f / 18, 'playing', 3.12 + f / 18, makeFireMetrics({
                tensionPct: 0.30,
                beatStarted: false,
                beatCount: 1,
                beat: [env],
                beatImpulse: [env * s],
                beatStrength: s,
                beatLevel: lvl,
                smooth: [0.2, 0.2, 0.2]
            }));
            lastRects = cf.rects;
        }
        frame8Snaps[mode] = lastRects;
    }

    assert.equal(sparkCounts.soft, 0);
    assert.equal(sparkCounts.medium, 4);
    assert.equal(sparkCounts.hard, 10);
    assert.ok(heatSums.soft < heatSums.medium && heatSums.medium < heatSums.hard,
        `Quellhitze muss mit Beat-Stärke wachsen: soft=${heatSums.soft}, med=${heatSums.medium}, hard=${heatSums.hard}`);

    assert.notDeepEqual(onsetSnaps.soft, onsetSnaps.medium);
    assert.notDeepEqual(onsetSnaps.medium, onsetSnaps.hard);
    assert.notDeepEqual(frame8Snaps.soft, frame8Snaps.medium);
    assert.notDeepEqual(frame8Snaps.medium, frame8Snaps.hard);
});

test('Afterglow (kaltes BLUE-Feuer), Rotation & Budget <= 3000 fillRect über alle Viewports', () => {
    const fire = new C64FireWall();
    const viewports = [
        [32, 32],
        [67, 200],  // 1:3 Extrem-Porträt
        [92, 200],  // Mobile Porträt
        [112, 200], // Kleines Mobile Porträt
        [320, 200], // C64 4:3
        [432, 200], // Mobile Landscape
        [474, 200], // Ultrawide (2560x1080)
        [600, 200], // 3:1 Extrem-Landscape
        [92, 200]   // Rück-Rotation
    ];

    let t = 0.02;
    for (let i = 0; i < 40; i++) {
        const c = createUltraStrictBgCanvas(320, 200);
        fire.render(c.ctx, 320, 200, t, 'climax', t, makeFireMetrics({
            tensionPct: 0.95,
            beatImpulse: [0.8],
            smooth: [0.9, 0.8, 0.95]
        }));
        t += 0.02;
    }

    for (const [w, h] of viewports) {
        const c = createUltraStrictBgCanvas(w, h);
        fire.render(c.ctx, w, h, t, 'climax', t, makeFireMetrics({
            tensionPct: 0.95,
            beatImpulse: [0.8],
            smooth: [0.9, 0.8, 0.95]
        }));
        assert.ok(c.rects.length > 0, `Viewport ${w}x${h} muss zeichnen`);
        assert.ok(c.rects.length <= 3000, `Budget <= 3000 überschritten bei ${w}x${h}: ${c.rects.length}`);
        t += 0.02;
    }

    for (let i = 0; i < 40; i++) {
        t += 0.02;
        const ca = createUltraStrictBgCanvas(320, 200);
        fire.render(ca.ctx, 320, 200, t, 'afterglow', t, makeFireMetrics({ tensionPct: 0.15 }));
        if (i >= 32) {
            for (const r of ca.rects) {
                assert.ok(BLUE_RAMP_HEX.has(r.fillStyle.toLowerCase()),
                    `Kaltes Afterglow-Feuer nutzt Nicht-BLUE-Farbe: ${r.fillStyle}`);
            }
        }
    }
    assert.equal(fire.fam, 0);
});