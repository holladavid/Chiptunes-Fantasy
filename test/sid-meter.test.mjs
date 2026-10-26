import test from 'node:test';
import assert from 'node:assert/strict';

import { SIDChip } from '../js/worklets/lib/sid-chip.js';
import { SidMeter, sidBusMeterLevel } from '../js/ui/silicon/sid-meter.js';

test('SID register telemetry counts repeated writes without affecting register contents', () => {
    const sid = new SIDChip(0);
    sid.writeReg(0, 0x21);
    sid.writeReg(0, 0x21);
    sid.writeReg(24, 0x0F);
    sid.writeReg(29, 0xFF);

    assert.equal(sid.registerWrites, 3);
    assert.equal(sid.regs[0], 0x21);
    assert.equal(sid.regs[24], 0x0F);
});

test('SID bus history uses a bounded logarithmic scale', () => {
    assert.equal(sidBusMeterLevel(0), 0);
    assert.equal(sidBusMeterLevel(-1), 0);
    assert.equal(sidBusMeterLevel(Number.NaN), 0);
    assert.ok(sidBusMeterLevel(50) > 0.3);
    assert.ok(sidBusMeterLevel(50) < 0.4);
    assert.ok(sidBusMeterLevel(4000) > 0.7);
    assert.ok(sidBusMeterLevel(4000) < 0.8);
    assert.equal(sidBusMeterLevel(100000), 1);
    assert.equal(sidBusMeterLevel(1000000), 1);
});

test('SID activity markup contains three 16-segment meters and a 48-column bus history', () => {
    const meter = new SidMeter();
    const html = meter.getHTML();

    assert.equal((html.match(/class="sid-meter-segment"/g) || []).length, 48);
    assert.equal((html.match(/class="sid-bus-history-bar"/g) || []).length, 48);
    assert.equal((html.match(/class="sid-meter-gate"/g) || []).length, 3);
    assert.match(html, /ENVELOPE \/ GATE/);
    assert.match(html, /REG WR\/S · LOG/);
    assert.doesNotMatch(html, /CPU LOAD|SID LOAD|VOLUME/);
});
