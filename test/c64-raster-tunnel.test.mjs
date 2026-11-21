import test from 'node:test';
import assert from 'node:assert/strict';
import { C64RasterTunnel } from '../js/visuals/dse/c64/raster-tunnel.js';
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

function makeTunnelMetrics(overrides = {}) {
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
        smooth: [0, 0, 0],
        isClimaxLocked: false,
        ...overrides
    };
}

test('Smoke, Numerik, PAL-Zeitbasis, fehlende Metriken & Stopping-Ausblenden bis vis = 0', () => {
    const tunnel = new C64RasterTunnel();

    const idleCanvas = createUltraStrictBgCanvas(320, 200);
    tunnel.render(idleCanvas.ctx, 320, 200, 0, 'idle', 0, undefined);
    assert.equal(idleCanvas.rects.length, 0);

    tunnel.render(idleCanvas.ctx, 0, 200, 0.02, 'playing', 0, undefined);
    tunnel.render(idleCanvas.ctx, 320, 0, 0.04, 'playing', 0, undefined);
    tunnel.render(idleCanvas.ctx, NaN, 200, 0.06, 'playing', 0, undefined);
    tunnel.render(idleCanvas.ctx, 320, -2, 0.08, 'playing', 0, undefined);

    const states = ['starting', 'playing', 'buildup', 'climax', 'afterglow', 'stopping'];
    let t = 0.2;
    for (const st of states) {
        const c = createUltraStrictBgCanvas(320, 200);
        tunnel.render(c.ctx, 320, 200, t, st, 0.25, undefined);
        assert.ok(c.rects.length > 0, `Zustand ${st} muss ohne Metriken zeichnen`);
        t += 0.02;
    }

    const snapA = createUltraStrictBgCanvas(320, 200);
    const snapB = createUltraStrictBgCanvas(320, 200);
    tunnel.render(snapA.ctx, 320, 200, 1.0, 'playing', 1.0, undefined);
    tunnel.render(snapB.ctx, 320, 200, 1.0, 'playing', 1.0, undefined);
    assert.deepEqual(snapA.rects, snapB.rects);

    const endStop = createUltraStrictBgCanvas(320, 200);
    tunnel.render(endStop.ctx, 320, 200, 1.02, 'stopping', 1.5, undefined);
    assert.equal(endStop.rects.length, 0, 'Bei vis = 0 darf nichts mehr gezeichnet werden');
});

test('Determinismus: gleiche Eingabesequenz über 300 Frames liefert bit-identische Ausgabe', () => {
    const tA = new C64RasterTunnel();
    const tB = new C64RasterTunnel();
    const outA = [];
    const outB = [];

    for (let f = 0; f < 300; f++) {
        const state = f < 25 ? 'starting' : f < 100 ? 'playing' : f < 180 ? 'buildup' : f < 250 ? 'climax' : 'afterglow';
        const m = makeMetrics('c64', state === 'starting' ? 'playing' : state, f, 'pattern', f);
        const t = 1 + f / 50;

        const cA = createUltraStrictBgCanvas(320, 200);
        const cB = createUltraStrictBgCanvas(320, 200);
        tA.render(cA.ctx, 320, 200, t, state, f * 0.02, m);
        tB.render(cB.ctx, 320, 200, t, state, f * 0.02, m);
        outA.push(cA.rects);
        outB.push(cB.rects);
    }

    assert.deepEqual(outA, outB);
});

test('Zusatztests §5.1: lv ändert sich nur bei Ringeintritt, Pulsringe nur bei beatStarted, Familie nur bei % 4', () => {
    const tunnel = new C64RasterTunnel();

    // Frame 0 initialisiert lastFarR
    const cInit = createUltraStrictBgCanvas(320, 200);
    tunnel.render(cInit.ctx, 320, 200, 0.02, 'playing', 0.02, makeTunnelMetrics({
        tensionPct: 0.2,
        smooth: [0, 0, 0]
    }));
    const farInit = tunnel.lastFarR;
    const lvSnapshot = Uint8Array.from(tunnel.lv);

    // Kleiner Zeitschritt ohne neuen Ringeintritt (farR unverändert), aber volles smooth = [1, 1, 1]
    const cNoEntry = createUltraStrictBgCanvas(320, 200);
    tunnel.render(cNoEntry.ctx, 320, 200, 0.04, 'playing', 0.04, makeTunnelMetrics({
        tensionPct: 0.2,
        smooth: [1.0, 1.0, 1.0],
        beatStarted: false,
        beat: [0.95],
        beatImpulse: [0.95]
    }));
    assert.equal(tunnel.lastFarR, farInit);
    assert.deepEqual(tunnel.lv, lvSnapshot, 'lv darf sich ohne Ringeintritt nicht ändern');
    assert.ok(tunnel.pulses.every(p => !p.active), 'Ohne beatStarted dürfen keine Pulsringe entstehen');
    assert.equal(tunnel.fam, 0);

    // Genügend Frames vorwärts, sodass mindestens 1 Ring eintritt -> jetzt schreibt lv
    let t = 0.06;
    while (tunnel.lastFarR === farInit) {
        const cStep = createUltraStrictBgCanvas(320, 200);
        tunnel.render(cStep.ctx, 320, 200, t, 'playing', t, makeTunnelMetrics({
            tensionPct: 0.2,
            smooth: [1.0, 1.0, 1.0]
        }));
        t += 0.02;
    }
    const enteredRing = tunnel.lastFarR;
    assert.equal(tunnel.lv[enteredRing & 31], 2, 'Beim Ringeintritt muss lv[r & 31] = round(ch * 2) gesetzt werden');

    // Familienwechsel nur bei count % 4 === 0, Richtung bei % 8 === 0
    for (let b = 1; b <= 3; b++) {
        t += 0.3;
        const cb = createUltraStrictBgCanvas(320, 200);
        tunnel.render(cb.ctx, 320, 200, t, 'playing', t, makeTunnelMetrics({
            beatStarted: true,
            beatCount: b,
            beatStrength: 0.5,
            beatLevel: 2
        }));
        assert.equal(tunnel.wipeActive, false);
        assert.equal(tunnel.fam, 0);
    }

    t += 0.3;
    const c4 = createUltraStrictBgCanvas(320, 200);
    tunnel.render(c4.ctx, 320, 200, t, 'playing', t, makeTunnelMetrics({
        beatStarted: true,
        beatCount: 4,
        beatStrength: 0.5,
        beatLevel: 2
    }));
    assert.equal(tunnel.wipeActive, true);
    assert.equal(tunnel.wipeTo, 1);

    t += 0.7;
    const c8 = createUltraStrictBgCanvas(320, 200);
    tunnel.render(c8.ctx, 320, 200, t, 'playing', t, makeTunnelMetrics({
        beatStarted: true,
        beatCount: 8,
        beatStrength: 0.9,
        beatLevel: 3
    }));
    assert.equal(tunnel.bendDirTarget, -1, 'Jeder 8. Beat kippt die Schlängelrichtung');
    assert.equal(tunnel.wipeTo, 2);
});

test('Zusatztest §5.1: afterglow verwendet ausschließlich BLUE-Indizes & schreibt lv nicht neu', () => {
    const tunnel = new C64RasterTunnel();
    let t = 0.02;

    // Zuerst in Climax auf andere Familie (FIRE/PURPLE) wechseln
    for (let i = 0; i < 40; i++) {
        const c = createUltraStrictBgCanvas(320, 200);
        tunnel.render(c.ctx, 320, 200, t, 'climax', t, makeTunnelMetrics({
            tensionPct: 0.95,
            beatStarted: i === 5 || i === 15,
            beatCount: i === 5 ? 4 : (i === 15 ? 8 : 0),
            beatStrength: 0.9,
            beatLevel: 3,
            smooth: [0.5, 0.5, 0.5]
        }));
        t += 0.02;
    }

    const lvSnapshot = Uint8Array.from(tunnel.lv);

    // Im Afterglow: alle Pixel ausschließlich aus BLUE-Rampe, lv wird nicht neu beschrieben
    for (let i = 0; i < 45; i++) {
        t += 0.02;
        const c = createUltraStrictBgCanvas(320, 200);
        tunnel.render(c.ctx, 320, 200, t, 'afterglow', t, makeTunnelMetrics({
            tensionPct: 0.15,
            smooth: [1.0, 1.0, 1.0]
        }));
        for (const r of c.rects) {
            assert.ok(BLUE_RAMP_HEX.has(r.fillStyle.toLowerCase()),
                `Afterglow nutzt Nicht-BLUE-Farbe: ${r.fillStyle}`);
        }
    }
    assert.deepEqual(tunnel.lv, lvSnapshot, 'Im Afterglow darf lv[] nicht neu geschrieben werden');
});

test('Zusatztest §5.1: Ringe mit d <= 0 oder d > N werden nicht gezeichnet', () => {
    const tunnel = new C64RasterTunnel();

    // Ungültige Pulsringe außerhalb (0, N] manuell injizieren
    tunnel.pulses[0] = { active: true, d: 0.0, stageFromTop: 1 };
    tunnel.pulses[1] = { active: true, d: -1.5, stageFromTop: 1 };
    tunnel.pulses[2] = { active: true, d: 25.0, stageFromTop: 1 }; // > N (N=20 bei low)

    const c = createUltraStrictBgCanvas(320, 200);
    tunnel.render(c.ctx, 320, 200, 0.02, 'playing', 0.02, makeTunnelMetrics({ tensionPct: 0.2 }));

    // Es gibt genau 1 Basis-Fill + höchstens N = 20 Ringe = 21 fillRects (keine Pulsringe mit d <= 0 oder d > N!)
    assert.ok(c.rects.length <= 21, `Es wurden ungültige Ringe oder Pulsringe gezeichnet: ${c.rects.length}`);
    // Weiß (#ffffff) dürfte weder im Basis-Tunnel (PP_BASE hat kein Top-Weiß, lv=0) noch durch die ungültigen Pulse erscheinen
    assert.ok(c.rects.every(r => r.fillStyle.toLowerCase() !== '#ffffff'));
});

test('Beat-Intensität (§8): soft (shift +1, L-3), medium (shift +1, L-2), hard (shift +2, Top + Zwilling)', () => {
    const modes = ['soft', 'medium', 'hard'];
    const shifts = {};
    const pulseStages = {};
    const pulseCounts = {};
    const onsetSnaps = {};
    const frame8Snaps = {};

    for (const mode of modes) {
        const s = GRADED_BEAT_STRENGTHS[mode];
        const lvl = mode === 'soft' ? 1 : (mode === 'medium' ? 2 : 3);
        const tunnel = new C64RasterTunnel();

        const c0 = createUltraStrictBgCanvas(320, 200);
        tunnel.render(c0.ctx, 320, 200, 1.0, 'playing', 3.0, makeTunnelMetrics({
            tensionPct: 0.45,
            beatStarted: true,
            beatCount: 1,
            beat: [1.0],
            beatImpulse: [s],
            beatStrength: s,
            beatLevel: lvl
        }));

        shifts[mode] = tunnel.shift;
        const activePulses = tunnel.pulses.filter(p => p.active);
        pulseCounts[mode] = activePulses.length;
        pulseStages[mode] = activePulses.map(p => p.stageFromTop);
        onsetSnaps[mode] = c0.rects;

        let lastRects = c0.rects;
        for (let f = 1; f <= 8; f++) {
            const env = Math.max(0, 0.82 - f * 0.19);
            const cf = createUltraStrictBgCanvas(320, 200);
            tunnel.render(cf.ctx, 320, 200, 1.0 + f / 18, 'playing', 3.0 + f / 18, makeTunnelMetrics({
                tensionPct: 0.45,
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
    }

    assert.equal(shifts.soft, 1);
    assert.equal(shifts.medium, 1);
    assert.equal(shifts.hard, 2);
    assert.equal(pulseCounts.soft, 1);
    assert.equal(pulseCounts.medium, 1);
    assert.equal(pulseCounts.hard, 2);
    assert.deepEqual(pulseStages.soft, [3]);   // L-3
    assert.deepEqual(pulseStages.medium, [2]); // L-2
    assert.deepEqual(pulseStages.hard, [1, 1]); // Top + Zwilling

    assert.notDeepEqual(onsetSnaps.soft, onsetSnaps.medium);
    assert.notDeepEqual(onsetSnaps.medium, onsetSnaps.hard);
    assert.notDeepEqual(frame8Snaps.soft, frame8Snaps.medium);
    assert.notDeepEqual(frame8Snaps.medium, frame8Snaps.hard);
});

test('Responsive Viewports (Porträt, 1:3, 3:1, Ultrawide), Rotation & Budget <= 100 fillRect', () => {
    const tunnel = new C64RasterTunnel();
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
    // Aufwärmen auf Climax mit max 6 Pulsringen im Pool
    for (let i = 0; i < 45; i++) {
        const c = createUltraStrictBgCanvas(320, 200);
        tunnel.render(c.ctx, 320, 200, t, 'climax', t, makeTunnelMetrics({
            tensionPct: 0.95,
            beatStarted: i % 13 === 0,
            beatCount: Math.floor(i / 13) + 1,
            beatStrength: 0.9,
            beatLevel: 3,
            beatImpulse: [0.85],
            smooth: [0.8, 0.6, 0.9]
        }));
        t += 0.02;
    }

    const sBefore = tunnel.S;
    for (const [w, h] of viewports) {
        tunnel.resize(w, h);
        const c = createUltraStrictBgCanvas(w, h);
        tunnel.render(c.ctx, w, h, t, 'climax', t, makeTunnelMetrics({
            tensionPct: 0.95,
            beatImpulse: [0.85],
            smooth: [0.8, 0.6, 0.9]
        }));
        assert.ok(c.rects.length > 0, `Viewport ${w}x${h} muss zeichnen`);
        assert.ok(c.rects.length <= 100, `Budget <= 100 überschritten bei ${w}x${h}: ${c.rects.length}`);
        t += 0.02;
    }
    assert.ok(tunnel.S > sBefore);
});