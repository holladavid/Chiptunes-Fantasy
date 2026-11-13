// === test/sid-silicon-bg.test.mjs ===
import test from 'node:test';
import assert from 'node:assert/strict';
import { SidSiliconBg } from '../js/visuals/dse/c64/sid-silicon-bg.js';
import { C64_PALETTE, rgbToHex } from '../js/visuals/utils/hardware-constraints.js';

const VALID_C64_HEX = new Set(C64_PALETTE.map(([r, g, b]) => rgbToHex(r, g, b).toLowerCase()));

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
            assert.ok(Number.isFinite(x), `x muss endlich sein (${x})`);
            assert.ok(Number.isFinite(y), `y muss endlich sein (${y})`);
            assert.ok(Number.isFinite(w) && w >= 0, `w muss endlich und >= 0 sein (${w})`);
            assert.ok(Number.isFinite(h) && h >= 0, `h muss endlich und >= 0 sein (${h})`);
            assert.equal(x, Math.floor(x), `x muss ganzzahlig sein (${x})`);
            assert.equal(y, Math.floor(y), `y muss ganzzahlig sein (${y})`);
            assert.equal(w, Math.floor(w), `w muss ganzzahlig sein (${w})`);
            assert.equal(h, Math.floor(h), `h muss ganzzahlig sein (${h})`);
            assert.ok(x >= 0 && x + w <= width, `Rechteck außerhalb Breite: ${x}+${w} > ${width}`);
            assert.ok(y >= 0 && y + h <= height, `Rechteck außerhalb Höhe: ${y}+${h} > ${height}`);
            rects.push({ x, y, w, h, fillStyle: currentStyle });
        }
    };

    return { ctx, rects };
}

function assertC64PaletteHex(hex) {
    assert.ok(VALID_C64_HEX.has(String(hex).toLowerCase()), `Unerlaubte Nicht-C64-Farbe: ${hex}`);
}

function makeSidRegs({ sustain = 0xFF, ctrl0 = 65, ctrl1 = 33, ctrl2 = 129, cutoff = 1200, res = 10 } = {}) {
    const regs = new Uint8Array(29);
    regs[0] = 0x40; regs[1] = 0x18; regs[2] = 0x00; regs[3] = 0x08; regs[4] = ctrl0; regs[5] = 0x24; regs[6] = sustain;
    regs[7] = 0x80; regs[8] = 0x22; regs[9] = 0x00; regs[10] = 0x04; regs[11] = ctrl1; regs[12] = 0x15; regs[13] = 0xA5;
    regs[14] = 0x20; regs[15] = 0x30; regs[16] = 0x00; regs[17] = 0x06; regs[18] = ctrl2; regs[19] = 0x09; regs[20] = 0x73;
    regs[21] = cutoff & 7;
    regs[22] = (cutoff >> 3) & 0xFF;
    regs[23] = ((res & 15) << 4) | 7;
    return regs;
}

function makeTestMetrics(overrides = {}) {
    return {
        system: 'c64',
        energy: 0.45,
        pulse: 0.1,
        tensionPct: 0.4,
        beat: [0.0],
        beatImpulse: [0.0],
        beatStarted: false,
        beatCount: 0,
        beatStrength: 0.0,
        beatLevel: 0,
        smooth: [0.6, 0.45, 0.7],
        isClimaxLocked: false,
        ...overrides
    };
}

test('Smoke & DOM-Freiheit: idle, ungültige Größen, fehlende Regs & Sustain=1.0 Schutz', () => {
    const dse = new SidSiliconBg();

    const idleCanvas = createStrictFakeCanvas(320, 200);
    dse.render(idleCanvas.ctx, 320, 200, 0.0, 'idle', 0, undefined);
    assert.equal(idleCanvas.rects.length, 0);

    dse.render(idleCanvas.ctx, 0, 200, 0.02, 'playing', 0, undefined);
    dse.render(idleCanvas.ctx, 320, 0, 0.04, 'playing', 0, undefined);
    dse.render(idleCanvas.ctx, NaN, 200, 0.06, 'playing', 0, undefined);

    const regsEdge = makeSidRegs({ sustain: 0xFF });
    const states = ['starting', 'playing', 'buildup', 'climax', 'afterglow', 'stopping'];
    let t = 0.1;
    for (const st of states) {
        const cNoRegs = createStrictFakeCanvas(320, 200);
        dse.render(cNoRegs.ctx, 320, 200, t, st, 0.3, undefined);
        assert.ok(cNoRegs.rects.length > 0);

        const cWithRegs = createStrictFakeCanvas(320, 200);
        dse.render(cWithRegs.ctx, 320, 200, t + 0.01, st, 0.3, makeTestMetrics({ regs: regsEdge, beatImpulse: [0.9] }));
        assert.ok(cWithRegs.rects.length > 0);
        for (const r of cWithRegs.rects) {
            assertC64PaletteHex(r.fillStyle);
        }
        t += 0.02;
    }

    const climaxHit = createStrictFakeCanvas(320, 200);
    dse.render(climaxHit.ctx, 320, 200, 1.0, 'climax', 1.0, makeTestMetrics({
        regs: regsEdge,
        beat: [1.0],
        beatImpulse: [0.95],
        beatStarted: true,
        beatCount: 4,
        beatLevel: 3
    }));
    const fullWhite = climaxHit.rects.find((r) => r.w === 320 && r.h === 200 && r.fillStyle.toLowerCase() === '#ffffff');
    assert.equal(fullWhite, undefined, 'Climax darf kein weißes Vollbild über den Chip legen');
});

test('Determinismus: identische Register- und Beat-Sequenzen erzeugen identische Ausgabe', () => {
    const dseA = new SidSiliconBg();
    const dseB = new SidSiliconBg();

    const seq = [];
    for (let i = 0; i < 120; i++) {
        const beatStarted = i % 12 === 0;
        const beatEnv = Math.max(0, 1 - (i % 12) / 9);
        seq.push({
            t: i * 0.02,
            state: i < 20 ? 'starting' : (i < 60 ? 'playing' : (i < 90 ? 'climax' : 'afterglow')),
            metrics: makeTestMetrics({
                energy: 0.35 + (i % 12) * 0.04,
                tensionPct: Math.min(1, i / 85),
                beat: [beatEnv],
                beatImpulse: [beatEnv * 0.8],
                beatStarted,
                beatCount: Math.floor(i / 12) + 1,
                beatStrength: 0.8,
                beatLevel: 3,
                regs: makeSidRegs({ cutoff: 400 + (i * 29) % 1600, res: (i % 15) + 1 })
            })
        });
    }

    const outA = [];
    const outB = [];
    for (const s of seq) {
        const cA = createStrictFakeCanvas(320, 200);
        const cB = createStrictFakeCanvas(320, 200);
        dseA.render(cA.ctx, 320, 200, s.t, s.state, s.t, s.metrics);
        dseB.render(cB.ctx, 320, 200, s.t, s.state, s.t, s.metrics);
        outA.push(cA.rects);
        outB.push(cB.rects);
    }

    assert.deepEqual(outA, outB);
});

test('Exakte Beats vs. Hüllkurve: kein Retrigger ohne beatStarted', () => {
    const dse = new SidSiliconBg();
    const c = createStrictFakeCanvas(320, 200);

    dse.render(c.ctx, 320, 200, 0.02, 'buildup', 0.02, makeTestMetrics({
        beatStarted: true,
        beatCount: 4,
        beat: [1.0],
        beatImpulse: [0.9],
        beatStrength: 0.9,
        beatLevel: 3
    }));
    const phaseAfter4 = dse.busAccentPhase;
    assert.equal(phaseAfter4, 1);

    for (let i = 1; i <= 25; i++) {
        const frame = createStrictFakeCanvas(320, 200);
        dse.render(frame.ctx, 320, 200, 0.02 + i * 0.02, 'buildup', 0.02 + i * 0.02, makeTestMetrics({
            beatStarted: false,
            beatCount: 4,
            beat: [0.85],
            beatImpulse: [0.76],
            beatStrength: 0.9,
            beatLevel: 3
        }));
        assert.equal(dse.busAccentPhase, phaseAfter4);
    }
});

test('Graduelle Beat-Stärken (0.20 / 0.50 / 0.90) unterscheiden sich sichtbar', () => {
    const strengths = [0.20, 0.50, 0.90];
    const snapshots = strengths.map((s) => {
        const dse = new SidSiliconBg();
        const c = createStrictFakeCanvas(320, 200);
        dse.render(c.ctx, 320, 200, 0.02, 'playing', 0.02, makeTestMetrics({
            beatStarted: true,
            beatCount: 1,
            beat: [1.0],
            beatImpulse: [s],
            beatStrength: s,
            beatLevel: s < 0.33 ? 1 : (s < 0.66 ? 2 : 3)
        }));
        return c.rects;
    });

    assert.notDeepEqual(snapshots[0], snapshots[1]);
    assert.notDeepEqual(snapshots[1], snapshots[2]);
});

test('Zustände & Afterglow: kühle Bus-Beruhigung ohne Phase-Reset', () => {
    const dse = new SidSiliconBg();
    let t = 0.02;

    for (let i = 0; i < 30; i++) {
        const c = createStrictFakeCanvas(320, 200);
        dse.render(c.ctx, 320, 200, t, 'climax', t, makeTestMetrics({
            tensionPct: 0.95,
            energy: 0.9,
            beatImpulse: [0.75],
            regs: makeSidRegs()
        }));
        t += 0.02;
    }
    const climaxSnap = createStrictFakeCanvas(320, 200);
    dse.render(climaxSnap.ctx, 320, 200, t, 'climax', t, makeTestMetrics({
        tensionPct: 0.95,
        energy: 0.9,
        beatImpulse: [0.75],
        regs: makeSidRegs()
    }));

    const timeBeforeAfterglow = dse.internalT;
    for (let i = 0; i < 50; i++) {
        t += 0.02;
        const c = createStrictFakeCanvas(320, 200);
        dse.render(c.ctx, 320, 200, t, 'afterglow', t, makeTestMetrics({
            tensionPct: 0.15,
            energy: 0.2,
            regs: makeSidRegs()
        }));
    }
    const afterglowSnap = createStrictFakeCanvas(320, 200);
    dse.render(afterglowSnap.ctx, 320, 200, t + 0.02, 'afterglow', t + 0.02, makeTestMetrics({
        tensionPct: 0.15,
        energy: 0.2,
        regs: makeSidRegs()
    }));

    assert.notDeepEqual(climaxSnap.rects, afterglowSnap.rects);
    assert.ok(dse.afterglowMix > 0.7, 'afterglowMix muss im Afterglow ansteigen');
    assert.ok(dse.internalT > timeBeforeAfterglow, 'Simulationszeit läuft ruhig weiter');
});

test('Responsive Viewports & Rotation (Landscape <-> Portrait, 1:3, 3:1, Mini)', () => {
    const dse = new SidSiliconBg();
    const viewports = [
        [32, 32],   // Tiny Buffer
        [112, 200], // 320x568 Small Portrait
        [92, 200],  // 390x844 Mobile Portrait
        [67, 200],  // ~1:3 Extreme Portrait
        [432, 200], // 844x390 Mobile Landscape
        [320, 200], // 4:3 C64 Standard
        [474, 200], // 2560x1080 Ultrawide
        [600, 200], // 3:1 Extreme Landscape
        [92, 200]   // Rück-Rotation auf derselben Instanz
    ];

    let t = 0.2;
    const regs = makeSidRegs();
    for (const [w, h] of viewports) {
        dse.resize(w, h);
        const c = createStrictFakeCanvas(w, h);
        dse.render(c.ctx, w, h, t, 'buildup', t, makeTestMetrics({
            tensionPct: 0.75,
            beatImpulse: [0.55],
            beatStarted: true,
            beatCount: 2,
            beatLevel: 2,
            regs
        }));

        assert.ok(c.rects.length > 0, `Viewport ${w}x${h} muss Ausgabe erzeugen`);
        for (const r of c.rects) {
            assertC64PaletteHex(r.fillStyle);
        }
        t += 0.02;
    }

    assert.ok(dse.internalT > 0);
});