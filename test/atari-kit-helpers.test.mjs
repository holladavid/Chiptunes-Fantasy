import test from 'node:test';
import assert from 'node:assert/strict';

import {
    drawAliasedEllipseOutlineClipped,
    quantizeAtari9Bit,
    rgbToHex
} from '../js/visuals/utils/hardware-constraints.js';
import {
    INK,
    WHITE,
    RAMPS,
    FAM,
    WFAM,
    SETS,
    COOL,
    RING_HUE,
    pp,
    PP5,
    st
} from '../js/visuals/dse/atari/atari-kit.js';

function createClippedFakeCtx(width, height) {
    const ops = [];
    return {
        fillStyle: '#000000',
        ops,
        fillRect(x, y, w, h) {
            assert.ok([x, y, w, h].every(Number.isFinite));
            assert.ok([x, y, w, h].every(Number.isInteger));
            assert.ok(w > 0 && h > 0);
            assert.ok(x >= 0 && y >= 0 && x + w <= width && y + h <= height);
            ops.push({ x, y, w, h, color: this.fillStyle });
        }
    };
}

test('atari-kit exports strictly quantized 9-bit Atari ST colors (max #fcfcfc)', () => {
    assert.equal(INK, '#000000');
    assert.equal(WHITE, '#fcfcfc');
    assert.equal(RING_HUE.length, 14);
    assert.deepEqual(PP5, [0, 1, 2, 3, 4, 3, 2, 1]);
    assert.deepEqual(pp(3), [0, 1, 2, 1]);

    const allColors = [
        INK,
        WHITE,
        ...RING_HUE,
        ...Object.values(RAMPS).flat(),
        ...FAM.flat(),
        ...WFAM.flat(),
        ...SETS.flat(2),
        ...COOL.flat()
    ];

    for (const hex of allColors) {
        assert.notEqual(hex, '#ffffff', '9-bit ST white must never reach 255');
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        assert.equal(hex, rgbToHex(...quantizeAtari9Bit(r, g, b)));
    }

    assert.equal(st(7, 7, 7), '#fcfcfc');
});

test('drawAliasedEllipseOutlineClipped handles clipping, symmetry, run-merging and degenerates', () => {
    const ctx = createClippedFakeCtx(120, 80);
    const clip = { x: 0, y: 44, w: 120, h: 36 }; // horizon=44

    // Partially above horizon -> must clip strictly to y >= 44
    drawAliasedEllipseOutlineClipped(ctx, 60, 46, 28, 10, WHITE, clip);
    assert.ok(ctx.ops.length > 0);
    for (const op of ctx.ops) {
        assert.ok(op.y >= 44 && op.y + op.h <= 80);
        assert.ok(op.x >= 0 && op.x + op.w <= 120);
        assert.equal(op.color, WHITE);
    }

    // Fully unclipped ellipse: verify pixel symmetry and run-merging
    const fullCtx = createClippedFakeCtx(100, 100);
    drawAliasedEllipseOutlineClipped(fullCtx, 50, 50, 20, 8, '#00fcfc', { x: 0, y: 0, w: 100, h: 100 });
    assert.ok(fullCtx.ops.length < 40, 'run-merged ellipse should need very few fillRect calls');

    const pixels = new Set();
    for (const op of fullCtx.ops) {
        for (let py = op.y; py < op.y + op.h; py++) {
            for (let px = op.x; px < op.x + op.w; px++) {
                pixels.add(`${px},${py}`);
            }
        }
    }
    for (const key of pixels) {
        const [px, py] = key.split(',').map(Number);
        assert.ok(pixels.has(`${100 - px},${py}`), 'horizontal symmetry');
        assert.ok(pixels.has(`${px},${100 - py}`), 'vertical symmetry');
    }

    // Degenerate / offscreen / invalid inputs must not throw or violate bounds
    const degCtx = createClippedFakeCtx(80, 60);
    drawAliasedEllipseOutlineClipped(degCtx, 40, 30, 0, 0, WHITE, { x: 0, y: 0, w: 80, h: 60 });
    drawAliasedEllipseOutlineClipped(degCtx, 40, 30, 10, 0, WHITE, { x: 0, y: 0, w: 80, h: 60 });
    drawAliasedEllipseOutlineClipped(degCtx, 40, 30, 0, 10, WHITE, { x: 0, y: 0, w: 80, h: 60 });
    drawAliasedEllipseOutlineClipped(degCtx, -200, 30, 10, 5, WHITE, { x: 0, y: 0, w: 80, h: 60 });
    drawAliasedEllipseOutlineClipped(degCtx, 40, 30, -5, 5, WHITE, { x: 0, y: 0, w: 80, h: 60 });
    drawAliasedEllipseOutlineClipped(degCtx, NaN, 30, 10, 5, WHITE, { x: 0, y: 0, w: 80, h: 60 });
    assert.ok(degCtx.ops.length > 0);
});