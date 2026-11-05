import test from 'node:test';
import assert from 'node:assert/strict';

import { VoidElement } from '../js/visuals/dse/universal/void-element.js';
import { dseRegistry } from '../js/visuals/dse/registry.js';

test('VoidElement stays transparent without reading metrics or drawing', () => {
    const element = new VoidElement();
    const ctx = new Proxy({}, {
        get() {
            throw new Error('VoidElement must not access the drawing context');
        }
    });
    const metrics = new Proxy({}, {
        get() {
            throw new Error('VoidElement must not read visual metrics');
        }
    });

    for (const state of ['idle', 'starting', 'playing', 'buildup', 'climax', 'afterglow', 'stopping']) {
        element.render(ctx, 320, 200, 1, state, 3, metrics);
    }
    element.resize(844, 390);
});

test('VoidElement registry entries remain marked as transparent placeholders', () => {
    const entries = dseRegistry.filter(entry => entry.Class === VoidElement);
    assert.equal(entries.length, 3);
    assert.deepEqual(entries.map(entry => entry.metadata.layer).sort(),
        ['background', 'floor', 'foreground']);
    assert.ok(entries.every(entry => entry.metadata.isVoid));
    assert.ok(entries.every(entry => !entry.metadata.isDisabled));
});
