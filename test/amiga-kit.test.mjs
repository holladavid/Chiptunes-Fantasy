import test from 'node:test';
import assert from 'node:assert/strict';
import { quantizeAmiga12Bit, rgbToHex } from '../js/visuals/utils/hardware-constraints.js';
import { RAMPS, INK, SNOW, FAM, CH_RAMPS, COOL, PAULA_LRRL, pp, PP6 } from '../js/visuals/dse/amiga/amiga-kit.js';

test('Amiga-Kit Rampen sind gueltige 12-Bit-#RRGGBB-Werte und unveraenderlich', () => {
    assert.ok(Object.isFrozen(RAMPS));
    assert.equal(INK, '#000000');
    assert.equal(SNOW, '#ffffff');
    assert.deepEqual(PAULA_LRRL, [0, 3, 1, 2]);
    assert.deepEqual(FAM, ['OCEAN', 'MAGMA', 'JADE', 'VIOLET']);
    assert.deepEqual(CH_RAMPS, ['MAGMA', 'OCEAN', 'JADE', 'GOLD']);
    assert.deepEqual(COOL, ['OCEAN', 'STEEL', 'OCEAN', 'STEEL']);
    assert.deepEqual(PP6, [0, 1, 2, 3, 4, 5, 4, 3, 2, 1]);
    assert.deepEqual(pp(4), [0, 1, 2, 3, 2, 1]);
    assert.deepEqual(pp(1), [0]);

    for (const [name, ramp] of Object.entries(RAMPS)) {
        assert.ok(Object.isFrozen(ramp), `${name} muss frozen sein`);
        assert.equal(ramp.length, 6, `${name} braucht 6 Stufen`);
        for (const hex of ramp) {
            assert.match(hex, /^#[0-9a-f]{6}$/);
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            const [qr, qg, qb] = quantizeAmiga12Bit(r, g, b);
            assert.equal(rgbToHex(qr, qg, qb), hex);
            assert.equal(r % 17, 0);
            assert.equal(g % 17, 0);
            assert.equal(b % 17, 0);
        }
    }
});