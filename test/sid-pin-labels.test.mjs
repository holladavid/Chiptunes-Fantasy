import test from 'node:test';
import assert from 'node:assert/strict';

import { Sid6581 } from '../js/ui/silicon/sid-6581.js';

test('SID visualization labels all 28 package pins without changing the SVG viewport', () => {
    const visualizer = new Sid6581({});
    const svg = visualizer.getSvg();
    const pinLabels = [...svg.matchAll(/class="silicon-pin-number"[^>]*>(\d+)<\/text>/g)]
        .map(([, pin]) => Number(pin));

    assert.equal((svg.match(/viewBox="0 0 500 200"/g) || []).length, 1);
    assert.deepEqual(pinLabels, [
        1, 28, 2, 27, 3, 26, 4, 25, 5, 24, 6, 23, 7, 22,
        8, 21, 9, 20, 10, 19, 11, 18, 12, 17, 13, 16, 14, 15
    ]);
    const bottomPin = svg.match(/class="silicon-pin pin-bot-1" x="([\d.]+)" y="170"/);
    const topPin = svg.match(/class="silicon-pin pin-top-28" x="([\d.]+)" y="15"/);
    assert.ok(bottomPin);
    assert.ok(topPin);
    assert.ok(Math.abs(Number(bottomPin[1]) - 57.14285714285714) < 1e-10);
    assert.ok(Math.abs(Number(topPin[1]) - 57.14285714285714) < 1e-10);
});
