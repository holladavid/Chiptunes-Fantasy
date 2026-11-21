import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createXorshift32,
    bayerFadeCells,
    drawAliasedLineClipped,
    fillAliasedPolygonClipped
} from '../js/visuals/utils/hardware-constraints.js';

function createBoundedFakeCanvas(width, height) {
    const rects = [];
    let currentStyle = '#000000';
    const ctx = {
        get fillStyle() { return currentStyle; },
        set fillStyle(val) { currentStyle = String(val); },
        fillRect(x, y, w, h) {
            assert.ok(Number.isFinite(x) && Number.isFinite(y));
            assert.ok(Number.isFinite(w) && Number.isFinite(h));
            assert.equal(x, Math.floor(x));
            assert.equal(y, Math.floor(y));
            assert.equal(w, Math.floor(w));
            assert.equal(h, Math.floor(h));
            assert.ok(w > 0 && h > 0, `Negative/Null-Größe: ${w}x${h}`);
            assert.ok(x >= 0 && x + w <= width, `X außerhalb: ${x}+${w} > ${width}`);
            assert.ok(y >= 0 && y + h <= height, `Y außerhalb: ${y}+${h} > ${height}`);
            rects.push({ x, y, w, h, fillStyle: currentStyle });
        }
    };
    return { ctx, rects };
}

test('createXorshift32 ist deterministisch, vermeidet Null-Lock und respektiert reset()', () => {
    const rngA = createXorshift32(0x12345678);
    const rngB = createXorshift32(0x12345678);
    const seqA = [];
    const seqB = [];

    for (let i = 0; i < 64; i++) {
        const fA = rngA.float();
        const fB = rngB.float();
        assert.ok(fA >= 0 && fA < 1);
        seqA.push(fA);
        seqB.push(fB);
        const r = rngA.int(7);
        assert.ok(r >= 0 && r < 7 && Number.isInteger(r));
    }
    assert.deepEqual(seqA, seqB);

    rngA.reset(0x12345678);
    assert.equal(rngA.float(), seqA[0]);

    const zeroSeed = createXorshift32(0);
    assert.notEqual(zeroSeed.next(), 0);
    assert.equal(zeroSeed.int(0), 0);
    assert.equal(zeroSeed.int(-5), 0);
});

test('bayerFadeCells arbeitet DOM-frei, run-merged und hart geclippt unter 4000 fillRects', () => {
    const full = createBoundedFakeCanvas(320, 200);
    bayerFadeCells(full.ctx, 0, 110, 320, 90, 1.0, 2, '#000000');
    assert.equal(full.rects.length, 0);

    const black = createBoundedFakeCanvas(320, 200);
    bayerFadeCells(black.ctx, 0, 110, 320, 90, 0.0, 2, '#000000');
    assert.equal(black.rects.length, 1);
    assert.deepEqual(black.rects[0], { x: 0, y: 110, w: 320, h: 90, fillStyle: '#000000' });

    // Halbsichtbar im Ultrawide-Fullscreen: strikt unter 4000 fillRects und horizontal gemerged
    const ultra = createBoundedFakeCanvas(600, 200);
    bayerFadeCells(ultra.ctx, 0, 0, 600, 200, 0.5, 2, '#000000');
    assert.ok(ultra.rects.length > 0 && ultra.rects.length <= 4000, `Budget überschritten: ${ultra.rects.length}`);

    // Clip-Region auf Floor-Bereich unterhalb horizon=110 prüfen
    const floorFade = createBoundedFakeCanvas(474, 200);
    bayerFadeCells(floorFade.ctx, 0, 110, 474, 90, 0.25, 2, '#000000');
    assert.ok(floorFade.rects.length > 0 && floorFade.rects.length <= 4000);
    for (const r of floorFade.rects) {
        assert.ok(r.y >= 110 && r.y + r.h <= 200);
    }
    assert.ok(floorFade.rects.some(r => r.w === 474), 'Zeilen ohne Aussparung müssen zu einem Lauf verschmolzen werden');
});

test('drawAliasedLineClipped clippt extreme Koordinaten hart auf ClipRect', () => {
    const c = createBoundedFakeCanvas(320, 200);
    const clip = { x: 10, y: 110, width: 300, height: 90 };

    drawAliasedLineClipped(c.ctx, -50000, 50, 50000, 250, '#ffffff', clip);
    assert.ok(c.rects.length > 0);
    for (const r of c.rects) {
        assert.ok(r.x >= 10 && r.x + r.w <= 310);
        assert.ok(r.y >= 110 && r.y + r.h <= 200);
    }

    const outside = createBoundedFakeCanvas(320, 200);
    drawAliasedLineClipped(outside.ctx, 0, 0, 320, 100, '#ffffff', clip);
    assert.equal(outside.rects.length, 0);
});

test('fillAliasedPolygonClipped clippt Polygone inkl. Dither hart auf ClipRect', () => {
    const c = createBoundedFakeCanvas(320, 200);
    const clip = { x: 0, y: 110, width: 320, height: 90 };
    const poly = [
        { x: -40, y: 50 },
        { x: 360, y: 80 },
        { x: 160, y: 240 }
    ];

    fillAliasedPolygonClipped(c.ctx, poly, '#7bbfc7', false, clip);
    assert.ok(c.rects.length > 0);
    for (const r of c.rects) {
        assert.ok(r.y >= 110 && r.y + r.h <= 200);
    }

    const dither = createBoundedFakeCanvas(320, 200);
    fillAliasedPolygonClipped(dither.ctx, poly, '#7bbfc7', true, clip);
    assert.ok(dither.rects.length > 0);
    for (const r of dither.rects) {
        assert.ok(r.y >= 110 && r.y + r.h <= 200);
    }
});