import test from 'node:test';
import assert from 'node:assert/strict';
import { C64RasterRoad } from '../js/visuals/dse/c64/raster-road.js';
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

function makeRoadMetrics(overrides = {}) {
    return {
        system: 'c64',
        energy: 0.45,
        pulse: 0.1,
        tensionPct: 0.35,
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

test('Smoke, Numerik, Horizon-Guard, PAL-Zeitbasis & vollständiges Stopping-Ausblenden', () => {
    const road = new C64RasterRoad();

    // Idle zeichnet nichts
    const idleCanvas = createUltraStrictFloorCanvas(320, 200);
    road.render(idleCanvas.ctx, 320, 200, 0, 'idle', 0, undefined);
    assert.equal(idleCanvas.rects.length, 0);

    // Ungültige Maße werden sauber ignoriert
    road.render(idleCanvas.ctx, 0, 200, 0.02, 'playing', 0, undefined);
    road.render(idleCanvas.ctx, 320, 0, 0.04, 'playing', 0, undefined);
    road.render(idleCanvas.ctx, NaN, 200, 0.06, 'playing', 0, undefined);
    road.render(idleCanvas.ctx, 320, -10, 0.08, 'playing', 0, undefined);

    // Ohne Metriken (undefined) lebendig in allen Zuständen
    const states = ['starting', 'playing', 'buildup', 'climax', 'afterglow', 'stopping'];
    let t = 0.2;
    for (const st of states) {
        const c = createUltraStrictFloorCanvas(320, 200);
        road.render(c.ctx, 320, 200, t, st, 0.25, undefined);
        assert.ok(c.rects.length > 0, `Zustand ${st} muss ohne Metriken zeichnen`);
        t += 0.02;
    }

    // Identisches t darf nichts vorwärtsspulen (PAL-Tick-Caching)
    const snapA = createUltraStrictFloorCanvas(320, 200);
    const snapB = createUltraStrictFloorCanvas(320, 200);
    road.render(snapA.ctx, 320, 200, 1.0, 'playing', 1.0, undefined);
    road.render(snapB.ctx, 320, 200, 1.0, 'playing', 1.0, undefined);
    assert.deepEqual(snapA.rects, snapB.rects);

    // Bei vis = 0 (stopping am Ende von T_OUT = 1.5s) zeichnet der Floor gar nichts mehr
    const endStop = createUltraStrictFloorCanvas(320, 200);
    road.render(endStop.ctx, 320, 200, 1.02, 'stopping', 1.5, undefined);
    assert.equal(endStop.rects.length, 0);
});

test('Determinismus: gleiche Harness-Eingabesequenz über 300 Frames liefert bit-identische Ausgabe', () => {
    const roadA = new C64RasterRoad();
    const roadB = new C64RasterRoad();

    const hashesA = [];
    const hashesB = [];

    for (let f = 0; f < 300; f++) {
        const state = f < 25 ? 'starting' : f < 100 ? 'playing' : f < 180 ? 'buildup' : f < 250 ? 'climax' : 'afterglow';
        const stateTime = f * 0.02;
        const m = makeMetrics('c64', state === 'starting' ? 'playing' : state, f, 'pattern', f);
        const t = 1 + f / 50;

        const cA = createUltraStrictFloorCanvas(320, 200);
        const cB = createUltraStrictFloorCanvas(320, 200);
        roadA.render(cA.ctx, 320, 200, t, state, stateTime, m);
        roadB.render(cB.ctx, 320, 200, t, state, stateTime, m);
        hashesA.push(cA.rects);
        hashesB.push(cB.rects);
    }

    assert.deepEqual(hashesA, hashesB);
});

test('Exakte Beats, Beat an/aus, Familie am 4. Beat, Kurvenrichtung am 8. Beat', () => {
    const road = new C64RasterRoad();

    // Ohne Beat bleibt alles stabil
    for (let i = 0; i < 20; i++) {
        const c = createUltraStrictFloorCanvas(320, 200);
        road.render(c.ctx, 320, 200, 0.02 * (i + 1), 'playing', 0.02 * (i + 1), makeRoadMetrics({
            beatStarted: false,
            beat: [0.95],
            beatImpulse: [0.95],
            beatStrength: 0.95,
            beatLevel: 3
        }));
    }
    assert.equal(road.famIdx, 0);
    assert.equal(road.wipeActive, false);
    assert.equal(road.curveSignTarget, 1);
    assert.ok(road.gates.every(g => !g.active), 'Hüllkurve allein darf kein Gate spawnen');

    // Beat #0 darf nicht durch lastBeatCount=0-Bug verschluckt werden
    const c0 = createUltraStrictFloorCanvas(320, 200);
    road.render(c0.ctx, 320, 200, 0.50, 'playing', 0.50, makeRoadMetrics({
        beatStarted: true,
        beatCount: 0,
        beatStrength: GRADED_BEAT_STRENGTHS.soft,
        beatLevel: 1
    }));
    assert.equal(road.kerbPhase, 1, 'Beat #0 muss kerbPhase umschalten');

    // 4. Beat startet Familien-Wipe, Hüllkurve ohne beatStarted retriggert nicht
    const c4 = createUltraStrictFloorCanvas(320, 200);
    road.render(c4.ctx, 320, 200, 0.52, 'playing', 0.52, makeRoadMetrics({
        beatStarted: true,
        beatCount: 4,
        beatStrength: GRADED_BEAT_STRENGTHS.medium,
        beatLevel: 2
    }));
    assert.equal(road.wipeActive, true);
    assert.equal(road.wipeTo, 1);

    // 8. Beat dreht curveSignTarget und startet nächsten Wipe
    const c8 = createUltraStrictFloorCanvas(320, 200);
    road.render(c8.ctx, 320, 200, 1.30, 'playing', 1.30, makeRoadMetrics({
        beatStarted: true,
        beatCount: 8,
        beatStrength: GRADED_BEAT_STRENGTHS.hard,
        beatLevel: 3
    }));
    assert.equal(road.curveSignTarget, -1);
    assert.equal(road.wipeTo, 2);
    assert.equal(road.gates.filter(g => g.active).length, 1, 'Hard-Beat spawnt genau ein Gate');
});

test('Beat-Intensität (soft 0.20 / medium 0.50 / hard 0.90) unterscheidet sich direkt und nach 8 Frames', () => {
    const levels = ['soft', 'medium', 'hard'];
    const onsetSnaps = {};
    const frame8Snaps = {};
    const activeGates = {};

    for (const mode of levels) {
        const s = GRADED_BEAT_STRENGTHS[mode];
        const lvl = mode === 'soft' ? 1 : (mode === 'medium' ? 2 : 3);
        const road = new C64RasterRoad();

        // Beat auf Frame 0
        const c0 = createUltraStrictFloorCanvas(320, 200);
        road.render(c0.ctx, 320, 200, 1.0, 'playing', 3.0, makeRoadMetrics({
            beatStarted: true,
            beatCount: 1,
            beat: [1.0],
            beatImpulse: [s],
            beatStrength: s,
            beatLevel: lvl
        }));
        onsetSnaps[mode] = c0.rects;

        // 8 Frames Abklingen à 1/18s (analog DSEBaseline.runBeatIntensity)
        let lastRects = c0.rects;
        for (let f = 1; f <= 8; f++) {
            const env = Math.max(0, 0.82 - f * 0.19);
            const cf = createUltraStrictFloorCanvas(320, 200);
            road.render(cf.ctx, 320, 200, 1.0 + f / 18, 'playing', 3.0 + f / 18, makeRoadMetrics({
                beatStarted: false,
                beatCount: 1,
                beat: [env],
                beatImpulse: [env * s],
                beatStrength: s,
                beatLevel: lvl
            }));
            lastRects = cf.rects;
        }
        frame8Snaps[mode] = lastRects;
        activeGates[mode] = road.gates.filter(g => g.active).length;
    }

    assert.notDeepEqual(onsetSnaps.soft, onsetSnaps.medium);
    assert.notDeepEqual(onsetSnaps.medium, onsetSnaps.hard);
    assert.notDeepEqual(frame8Snaps.soft, frame8Snaps.medium);
    assert.notDeepEqual(frame8Snaps.medium, frame8Snaps.hard);
    assert.equal(activeGates.soft, 0);
    assert.equal(activeGates.medium, 0);
    assert.equal(activeGates.hard, 1);
});

test('Gate-Cooldown, Pool-Limit (<= 3), Mindestabstand & strenge Z-Sortierung (fern vor nah)', () => {
    const road = new C64RasterRoad();
    for (let i = 0; i < 10; i++) {
        const c = createUltraStrictFloorCanvas(320, 200);
        road.render(c.ctx, 320, 200, 0.04 * (i + 1), 'climax', 0.04 * (i + 1), makeRoadMetrics({
            tensionPct: 0.95,
            beatStarted: true,
            beatCount: i + 1,
            beatStrength: 0.9,
            beatLevel: 3
        }));
    }
    assert.ok(road.gates.length <= 3);
    assert.equal(road.gates.filter(g => g.active).length, 1, 'Mindestabstand verhindert Gate-Stau am Horizont');

    // Z-Sortierung explizit gegen vertauschte Pool-Slots testen:
    // Slot 0 hat nahes Gate (z = 1.6), Slot 1 hat fernes Gate (z = 4.8).
    // Das ferne Gate muss trotzdem VOR dem nahen Gate gezeichnet werden!
    const roadSort = new C64RasterRoad();
    roadSort.gates[0].active = true;
    roadSort.gates[0].z = 1.6;
    roadSort.gates[1].active = true;
    roadSort.gates[1].z = 4.8;
    const cSort = createUltraStrictFloorCanvas(320, 200);
    roadSort.render(cSort.ctx, 320, 200, 0.02, 'playing', 0.02, makeRoadMetrics({ tensionPct: 0.2 }));

    // Finde Querbalken/Pfosten der beiden Gates (Farbe = HEX[1] = #ffffff, Breite >= 20 px Querbalken)
    const crossbars = cSort.rects
        .map((r, idx) => ({ ...r, idx }))
        .filter(r => r.fillStyle === '#ffffff' && r.y >= cSort.horizon && r.w > 20 && r.h >= 2);
    assert.equal(crossbars.length, 2, 'Beide Gates müssen genau einen Querbalken zeichnen');
    assert.ok(crossbars[0].w < crossbars[1].w, 'Schmaleres (fernes) Gate muss VOR breiterem (nahem) Gate gezeichnet werden');
    assert.ok(crossbars[0].idx < crossbars[1].idx);
});

test('Zusatztest §5.5: vEff <= 1.7 in jedem Frame, Dunstzone unabhängig von dist, Lane-Hysterese', () => {
    // 1. vEff-Deckel bei Maximum ten=1, impulse=1
    const roadSpeed = new C64RasterRoad();
    for (let i = 0; i < 40; i++) {
        const c = createUltraStrictFloorCanvas(320, 200);
        roadSpeed.render(c.ctx, 320, 200, 0.02 * (i + 1), 'climax', 0.02 * (i + 1), makeRoadMetrics({
            tensionPct: 1.0,
            beatImpulse: [1.0]
        }));
        assert.ok(roadSpeed.lastVEff <= 1.7, `vEff überschritten: ${roadSpeed.lastVEff}`);
    }

    // 2. Dunstzone hängt nicht von dist ab
    const roadA = new C64RasterRoad();
    const roadB = new C64RasterRoad();
    roadB.dist = 1.43; // deutlicher Versatz außerhalb der Dunstzone
    const cA = createUltraStrictFloorCanvas(320, 200);
    const cB = createUltraStrictFloorCanvas(320, 200);
    const mHaze = makeRoadMetrics({ tensionPct: 0.20, smooth: [0, 0, 0] });
    roadA.render(cA.ctx, 320, 200, 1.0, 'playing', 1.0, mHaze);
    roadB.render(cB.ctx, 320, 200, 1.0, 'playing', 1.0, mHaze);

    const H = 200 - cA.horizon;
    const hazeRows = Math.floor(Math.sqrt((1.5 * H) / 0.28)) - 1;
    const maxHazeY = cA.horizon + hazeRows;
    const hazeRectsA = cA.rects.filter(r => r.y < maxHazeY);
    const hazeRectsB = cB.rects.filter(r => r.y < maxHazeY);
    assert.ok(hazeRectsA.length > 0);
    assert.deepEqual(hazeRectsA, hazeRectsB, 'Dunstzone darf nicht von dist abhängen');

    // 3. Lane-Hysterese flackert nicht um 0.5
    const roadHyst = new C64RasterRoad();
    const renderSmooth = (val, t) => {
        const c = createUltraStrictFloorCanvas(320, 200);
        roadHyst.render(c.ctx, 320, 200, t, 'playing', t, makeRoadMetrics({ smooth: [val, 0.5, 0.5] }));
    };
    renderSmooth(0.55, 0.02);
    assert.equal(roadHyst.laneLit[0], 0, 'Unterhalb 0.6 bleibt Lane aus');
    renderSmooth(0.62, 0.04);
    assert.equal(roadHyst.laneLit[0], 1, 'Ab 0.6 geht Lane an');
    renderSmooth(0.45, 0.06);
    renderSmooth(0.55, 0.08);
    renderSmooth(0.41, 0.10);
    assert.equal(roadHyst.laneLit[0], 1, 'Zwischen 0.4 und 0.6 bleibt Lane stabil an');
    renderSmooth(0.39, 0.12);
    assert.equal(roadHyst.laneLit[0], 0, 'Unter 0.4 geht Lane wieder aus');
});

test('Responsive Viewports, Rotation (Porträt <-> Querformat <-> Ultrawide) & Budget <= 1500 fillRect', () => {
    const road = new C64RasterRoad();
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

    let t = 0.1;
    // Aufwärmen auf Climax damit Pylonen, Streaks & Gates geprüft werden
    for (let i = 0; i < 40; i++) {
        const c = createUltraStrictFloorCanvas(320, 200);
        road.render(c.ctx, 320, 200, t, 'climax', t, makeRoadMetrics({
            tensionPct: 0.95,
            beatStarted: i === 5,
            beatCount: i === 5 ? 1 : 0,
            beatStrength: 0.9,
            beatLevel: 3,
            beatImpulse: [0.8],
            smooth: [0.8, 0.2, 0.8]
        }));
        t += 0.02;
    }

    const distBefore = road.dist;
    for (const [w, h] of viewports) {
        road.resize(w, h);
        const c = createUltraStrictFloorCanvas(w, h);
        road.render(c.ctx, w, h, t, 'climax', t, makeRoadMetrics({
            tensionPct: 0.95,
            beatImpulse: [0.75],
            smooth: [0.8, 0.2, 0.8]
        }));
        assert.ok(c.rects.length > 0, `Viewport ${w}x${h} muss zeichnen`);
        assert.ok(c.rects.length <= 1500, `Budget-Überschreitung bei ${w}x${h}: ${c.rects.length}`);
        t += 0.02;
    }

    assert.ok(road.dist > distBefore);
});

test('Lifecycle & Afterglow: Übergang zu Nacht ohne Reset', () => {
    const road = new C64RasterRoad();
    let t = 0.02;
    for (let i = 0; i < 30; i++) {
        const c = createUltraStrictFloorCanvas(320, 200);
        road.render(c.ctx, 320, 200, t, 'climax', t, makeRoadMetrics({ tensionPct: 0.95 }));
        t += 0.02;
    }
    const distBefore = road.dist;

    // Wechsel in Afterglow ohne Beats -> nach >= 1.2 s greift Nacht-Wipe
    for (let i = 0; i < 95; i++) {
        t += 0.02;
        const c = createUltraStrictFloorCanvas(320, 200);
        road.render(c.ctx, 320, 200, t, 'afterglow', t, makeRoadMetrics({ tensionPct: 0.15 }));
    }
    assert.equal(road.famIdx, 3, 'Afterglow muss auf Familie Nacht (3) wechseln');
    assert.ok(road.dist > distBefore, 'Fahrt läuft im Afterglow sanft weiter');
});