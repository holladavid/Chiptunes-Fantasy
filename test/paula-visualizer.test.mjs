import test from 'node:test';
import assert from 'node:assert/strict';

import { Paula8364 } from '../js/ui/silicon/paula-8364.js';

function createVisualizer() {
    const elements = new Map();
    const container = {
        querySelector(selector) {
            if (!elements.has(selector)) elements.set(selector, { style: {}, textContent: '', setAttribute() {} });
            return elements.get(selector);
        },
        querySelectorAll(selector) {
            if (!elements.has(selector)) {
                elements.set(selector, Array.from({ length: 4 }, () => ({ style: {}, textContent: '' })));
            }
            return elements.get(selector);
        }
    };
    const visualizer = new Paula8364(container);
    visualizer.cacheDOM();
    return { visualizer, elements };
}

test('Paula visualization reports per-channel DMA, frequency and register state', () => {
    const { visualizer, elements } = createVisualizer();
    const regs = new Uint8Array(32);
    regs.set([0x12, 0x34, 0, 16, 1, 0xAC, 64], 0);
    regs.set([0, 0x80, 0, 8, 1, 0xAC, 32], 21);
    regs[29] = 2;
    regs[31] = (1 << 0) | (1 << 3);

    visualizer.update([0.8, 0, 0, 0.5], regs);

    assert.equal(elements.get('.paula-channel-state-0').textContent, 'DMA ON · 8287Hz');
    assert.equal(elements.get('.paula-channel-registers-0').textContent, 'LC:$1234 LEN:16 PER:428');
    assert.equal(elements.get('.paula-vol-txt-0').textContent, 'V:64');
    assert.equal(elements.get('.paula-channel-state-3').textContent, 'DMA ON · 8287Hz');
    assert.equal(elements.get('.paula-channel-state-1').textContent, 'DMA OFF · IDLE');
    assert.equal(elements.get('.paula-filter-status').textContent, 'LED FILTER: BYPASS');
    assert.equal(elements.get('.sig-path-0').style.opacity > 0, true);
});

test('Paula pin numbers and output traces use the package pin geometry', () => {
    const { visualizer } = createVisualizer();
    const svg = visualizer.getSvg();

    assert.match(svg, /class="silicon-pin pin-paula-32" x="340\.375" y="8"/);
    assert.match(svg, /class="silicon-pin pin-paula-33" x="321\.625" y="8"/);
    assert.match(svg, /d="M 344\.375 61 L 344\.375 8 L 344\.375 -14 L 528 -14 L 528 74 L 558 74/);
    assert.match(svg, /d="M 360 171 L 368 171 L 368 53 L 348\.375 53 A 4 4 0 0 0 340\.375 53 L 325\.625 53 L 325\.625 8/);
    assert.match(svg, /PIN 32 · AUDL · 12dB/);
    assert.match(svg, /PIN 33 · AUDR · 12dB/);
});
