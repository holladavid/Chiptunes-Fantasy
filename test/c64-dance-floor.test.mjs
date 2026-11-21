import test from 'node:test';
import assert from 'node:assert/strict';
import { C64DanceFloor } from '../js/visuals/dse/c64/dance-floor.js';
import { C64_PALETTE, rgbToHex } from '../js/visuals/utils/hardware-constraints.js';
import { makeMetrics, GRADED_BEAT_STRENGTHS } from '../tools/dse-baseline/harness.js';

const VALID_C64_HEX = new Set(C64_PALETTE.map(([r, g, b]) => rgbToHex(r, g, b).toLowerCase()));

function createUltraStrictFloorCanvas(width, height) {
    const horizon = Math.floor(height * 0.55);
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
            assert.ok(y >= horizon, `Floor zeichnet oberhalb horizon (${horizon}): y=${y}`);
            assert.ok(y + h <= height, `Y außerhalb: ${y}+${h} > ${height}`);
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

    return { ctx, rects, horizon };
}

function makeFloorMetrics(overrides = {}) {
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

test('Smoke, Numerik, Horizon-Guard, lückenloser Start direkt am Horizont & Stopping-Ende', () => {
    const floor = new C64DanceFloor();

    const idleCanvas = createUltraStrictFloorCanvas(320, 200);
    floor.render(idleCanvas.ctx, 320, 200, 0, 'idle', 0, undefined);
    assert.equal(idleCanvas.rects.length, 0);

    floor.render(idleCanvas.ctx, 0, 200, 0.02, 'playing', 0, undefined);
    floor.render(idleCanvas.ctx, 320, 0, 0.04, 'playing', 0, undefined);
    floor.render(idleCanvas.ctx, NaN, 200, 0.06, 'playing', 0, undefined);
    floor.render(idleCanvas.ctx, 320, -5, 0.08, 'playing', 0, undefined);

    const states = ['starting', 'playing', 'buildup', 'climax', 'afterglow', 'stopping'];
    let t = 0.2;
    for (const st of states) {
        const c = createUltraStrictFloorCanvas(320, 200);
        floor.render(c.ctx, 320, 200, t, st, 0.25, undefined);
        assert.ok(c.rects.length > 0, `Zustand ${st} muss ohne Metriken zeichnen`);
        t += 0.02;
    }

    // Kein schwarzer Balken am Horizont: Kachelzeilen starten direkt ab horizon + 1
    const playCanvas = createUltraStrictFloorCanvas(320, 200);
    floor.render(playCanvas.ctx, 320, 200, t, 'playing', 1.0, undefined);
    const tileRectsNearHorizon = playCanvas.rects.filter(r => r.fillStyle !== '#000000' && r.y <= playCanvas.horizon + 2);
    assert.ok(tileRectsNearHorizon.length > 0, 'Kacheln müssen direkt bis an den Horizont (y <= horizon + 2) reichen');

    // Identisches t darf Simulation nicht weiterdrehen
    const snapA = createUltraStrictFloorCanvas(320, 200);
    const snapB = createUltraStrictFloorCanvas(320, 200);
    floor.render(snapA.ctx, 320, 200, 1.0, 'playing', 1.0, undefined);
    floor.render(snapB.ctx, 320, 200, 1.0, 'playing', 1.0, undefined);
    assert.deepEqual(snapA.rects, snapB.rects);

    // Bei vis = 0 am Ende von stopping zeichnet der Floor gar nichts mehr
    const endStop = createUltraStrictFloorCanvas(320, 200);
    floor.render(endStop.ctx, 320, 200, 1.02, 'stopping', 1.5, undefined);
    assert.equal(endStop.rects.length, 0);
});

test('Determinismus: gleiche Eingabesequenz über 300 Frames liefert bit-identische Ausgabe', () => {
    const floorA = new C64DanceFloor();
    const floorB = new C64DanceFloor();

    const seqA = [];
    const seqB = [];
    for (let f = 0; f < 300; f++) {
        const state = f < 25 ? 'starting' : f < 100 ? 'playing' : f < 180 ? 'buildup' : f < 250 ? 'climax' : 'afterglow';
        const m = makeMetrics('c64', state === 'starting' ? 'playing' : state, f, 'pattern', f);
        const t = 1 + f / 50;

        const cA = createUltraStrictFloorCanvas(320, 200);
        const cB = createUltraStrictFloorCanvas(320, 200);
        floorA.render(cA.ctx, 320, 200, t, state, f * 0.02, m);
        floorB.render(cB.ctx, 320, 200, t, state, f * 0.02, m);
        seqA.push(cA.rects);
        seqB.push(cB.rects);
    }

    assert.deepEqual(seqA, seqB);
});

test('Zusatztest §5.6: pat wechselt nur bei count % 4 === 0, Ripple-Pool <= 3, lvl in 0..4', () => {
    const floor = new C64DanceFloor();

    for (let i = 0; i < 15; i++) {
        const c = createUltraStrictFloorCanvas(320, 200);
        floor.render(c.ctx, 320, 200, 0.02 * (i + 1), 'playing', 0.02 * (i + 1), makeFloorMetrics({
            beatStarted: false,
            beat: [0.95],
            beatImpulse: [0.95],
            beatStrength: 0.95,
            beatLevel: 3
        }));
    }
    assert.equal(floor.pat, 0);
    assert.equal(floor.fam, 0);
    assert.equal(floor.ripples.length, 3);
    assert.ok(floor.ripples.every(r => !r.active));

    for (let b = 0; b < 4; b++) {
        const c = createUltraStrictFloorCanvas(320, 200);
        floor.render(c.ctx, 320, 200, 0.5 + b * 0.3, 'buildup', 0.5 + b * 0.3, makeFloorMetrics({
            tensionPct: 0.6,
            beatStarted: true,
            beatCount: b,
            beatStrength: 0.5,
            beatLevel: 2
        }));
        assert.equal(floor.pat, 0);
    }

    const c4 = createUltraStrictFloorCanvas(320, 200);
    floor.render(c4.ctx, 320, 200, 1.8, 'buildup', 1.8, makeFloorMetrics({
        tensionPct: 0.6,
        beatStarted: true,
        beatCount: 4,
        beatStrength: 0.5,
        beatLevel: 2
    }));
    assert.equal(floor.pat, 1);

    const c8 = createUltraStrictFloorCanvas(320, 200);
    floor.render(c8.ctx, 320, 200, 2.2, 'climax', 2.2, makeFloorMetrics({
        tensionPct: 0.95,
        beatStarted: true,
        beatCount: 8,
        beatStrength: 0.9,
        beatLevel: 3
    }));
    assert.equal(floor.pat, 2);
    assert.equal(floor.wipeActive, true);
    assert.equal(floor.wipeTo, 1);
    assert.equal(floor.ripples.filter(r => r.active).length, 1);

    for (let k = 1; k <= 6; k++) {
        const ck = createUltraStrictFloorCanvas(320, 200);
        floor.render(ck.ctx, 320, 200, 2.2 + k * 0.1, 'climax', 2.2 + k * 0.1, makeFloorMetrics({
            tensionPct: 0.95,
            beatStarted: true,
            beatCount: 8 + k,
            beatStrength: 0.9,
            beatLevel: 3,
            smooth: [0.9, 0.9, 0.9]
        }));
    }
    assert.equal(floor.ripples.length, 3);
    assert.ok(floor.ripples.filter(r => r.active).length <= 3);
    for (let idx = 0; idx < floor.lvl.length; idx++) {
        assert.ok(floor.lvl[idx] >= 0 && floor.lvl[idx] <= 4, `Ungültiges lvl: ${floor.lvl[idx]}`);
    }
});

test('Zusatztest §5.6: ohne beatStarted bleibt pat stabil, interner 2-Hz-Takt erzeugt Bewegung', () => {
    const floor = new C64DanceFloor();
    let t = 0.02;

    let sumAt12 = 0;
    let sumAfterFallback = 0;
    for (let i = 0; i < 110; i++) {
        const c = createUltraStrictFloorCanvas(320, 200);
        floor.render(c.ctx, 320, 200, t, 'playing', t, makeFloorMetrics({
            tensionPct: 0.30,
            beatStarted: false,
            smooth: [0, 0, 0]
        }));
        let s = 0;
        for (let k = 0; k < floor.lvl.length; k++) s += floor.lvl[k];
        if (i === 55) sumAt12 = s;
        if (i > 65 && s > 0) sumAfterFallback = Math.max(sumAfterFallback, s);
        t += 0.02;
    }

    assert.equal(floor.pat, 0, 'Ohne beatStarted darf pat nicht wechseln');
    assert.equal(sumAt12, 0, 'Vor 1.2s ohne Beats und ohne smooth sind Kacheln aus');
    assert.ok(sumAfterFallback > 0, 'Nach 1.2s muss der interne 2-Hz-Takt Kacheln beleuchten');
});

test('Beat-Intensität (soft 0.20 / medium 0.50 / hard 0.90) unterscheidet max lvl & leuchtende Kacheln', () => {
    const levels = ['soft', 'medium', 'hard'];
    const onsetSnaps = {};
    const frame8Snaps = {};
    const maxLvlByMode = {};
    const litSumByMode = {};

    for (const mode of levels) {
        const s = GRADED_BEAT_STRENGTHS[mode];
        const lvl = mode === 'soft' ? 1 : (mode === 'medium' ? 2 : 3);
        const floor = new C64DanceFloor();

        for (let w = 0; w < 30; w++) {
            const cw = createUltraStrictFloorCanvas(320, 200);
            floor.render(cw.ctx, 320, 200, 0.02 * (w + 1), 'buildup', 0.02 * (w + 1), makeFloorMetrics({
                tensionPct: 0.65,
                smooth: [0, 0, 0]
            }));
        }

        const c0 = createUltraStrictFloorCanvas(320, 200);
        floor.render(c0.ctx, 320, 200, 1.0, 'buildup', 1.0, makeFloorMetrics({
            tensionPct: 0.65,
            beatStarted: true,
            beatCount: 1,
            beat: [1.0],
            beatImpulse: [s],
            beatStrength: s,
            beatLevel: lvl,
            smooth: [0.2, 0.8, 0.1]
        }));
        onsetSnaps[mode] = c0.rects;

        let maxL = 0;
        let litCount = 0;
        for (let k = 0; k < floor.lvl.length; k++) {
            if (floor.lvl[k] > maxL) maxL = floor.lvl[k];
            if (floor.lvl[k] > 0) litCount++;
        }
        maxLvlByMode[mode] = maxL;
        litSumByMode[mode] = litCount;

        let lastRects = c0.rects;
        for (let f = 1; f <= 8; f++) {
            const env = Math.max(0, 0.82 - f * 0.19);
            const cf = createUltraStrictFloorCanvas(320, 200);
            floor.render(cf.ctx, 320, 200, 1.0 + f / 18, 'buildup', 1.0 + f / 18, makeFloorMetrics({
                tensionPct: 0.65,
                beatStarted: false,
                beatCount: 1,
                beat: [env],
                beatImpulse: [env * s],
                beatStrength: s,
                beatLevel: lvl,
                smooth: [0.2, 0.8, 0.1]
            }));
            lastRects = cf.rects;
        }
        frame8Snaps[mode] = lastRects;
    }

    assert.equal(maxLvlByMode.soft, 2);
    assert.equal(maxLvlByMode.medium, 3);
    assert.ok(maxLvlByMode.hard >= 3);
    assert.notDeepEqual(onsetSnaps.soft, onsetSnaps.medium);
    assert.notDeepEqual(onsetSnaps.medium, onsetSnaps.hard);
    assert.notDeepEqual(frame8Snaps.soft, frame8Snaps.medium);
    assert.notDeepEqual(frame8Snaps.medium, frame8Snaps.hard);
    assert.ok(litSumByMode.medium > litSumByMode.soft, 'Medium-Funken erhöhen Anzahl leuchtender Kacheln');
});

test('Responsive Viewports (inkl. Ultrawide, 1:3, 3:1), Rotation & Budget <= 2500 fillRect', () => {
    const floor = new C64DanceFloor();
    const viewports = [
        [32, 32],
        [67, 200],  // 1:3 Extrem-Porträt
        [92, 200],  // Mobile Porträt (390x844)
        [112, 200], // Kleines Mobile Porträt (320x568)
        [320, 200], // C64 4:3
        [432, 200], // Mobile Landscape (844x390)
        [474, 200], // Ultrawide (2560x1080)
        [600, 200], // 3:1 Extrem-Landscape
        [92, 200]   // Rück-Rotation mit derselben Instanz
    ];

    let t = 0.02;
    for (let i = 0; i < 20; i++) {
        const c = createUltraStrictFloorCanvas(320, 200);
        floor.render(c.ctx, 320, 200, t, 'climax', t, makeFloorMetrics({
            tensionPct: 0.95,
            beatStarted: i % 4 === 0,
            beatCount: i,
            beatStrength: 0.9,
            beatLevel: 3,
            smooth: [0.8, 0.9, 0.7]
        }));
        t += 0.02;
    }

    for (const [w, h] of viewports) {
        floor.resize(w, h);
        const c = createUltraStrictFloorCanvas(w, h);
        floor.render(c.ctx, w, h, t, 'climax', t, makeFloorMetrics({
            tensionPct: 0.95,
            beatImpulse: [0.8],
            smooth: [0.8, 0.9, 0.7]
        }));
        assert.ok(c.rects.length > 0, `Viewport ${w}x${h} muss zeichnen`);
        assert.ok(c.rects.length <= 2500, `Budget-Überschreitung bei ${w}x${h}: ${c.rects.length}`);
        t += 0.02;
    }
});

test('Zustände & Afterglow: Muster friert ein, Palette wird BLUE, Kacheln klingen ab', () => {
    const floor = new C64DanceFloor();
    let t = 0.02;

    for (let i = 0; i < 30; i++) {
        const c = createUltraStrictFloorCanvas(320, 200);
        floor.render(c.ctx, 320, 200, t, 'climax', t, makeFloorMetrics({
            tensionPct: 0.95,
            beatStarted: i % 5 === 0,
            beatCount: 8 + Math.floor(i / 5) * 4,
            beatStrength: 0.9,
            beatLevel: 3
        }));
        t += 0.02;
    }
    const patInClimax = floor.pat;

    for (let i = 0; i < 95; i++) {
        t += 0.02;
        const c = createUltraStrictFloorCanvas(320, 200);
        floor.render(c.ctx, 320, 200, t, 'afterglow', t, makeFloorMetrics({
            tensionPct: 0.15,
            beatStarted: i === 20,
            beatCount: 40,
            beatStrength: 0.9,
            beatLevel: 3
        }));
    }

    assert.equal(floor.pat, patInClimax, 'Muster muss im Afterglow eingefroren bleiben');
    assert.equal(floor.fam, 0, 'Afterglow muss auf Familie BLUE (0) wechseln');
});