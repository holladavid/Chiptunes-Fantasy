import test from 'node:test';
import assert from 'node:assert/strict';
import { YMVisualizer } from '../js/worklets/lib/ym-visualizer.js';
import { Ym2149 } from '../js/ui/silicon/ym-2149.js';
import { BaseChip } from '../js/ui/silicon/base-chip.js';

test('YM visualizer streams silent register state and envelope/noise telemetry', () => {
    const messages = [];
    const visualizer = new YMVisualizer({ postMessage: (view) => messages.push(view.slice()) });
    const regs = Uint8Array.from({ length: 16 }, (_, index) => index);

    for (let i = 0; i < 4; i++) {
        visualizer.update(true, 12, 0, regs, 0.2, 0.4, 0.6, -1, 0.75);
    }

    assert.equal(messages.length, 1);
    assert.equal(messages[0][0], 2);
    assert.equal(messages[0][1], 1);
    assert.equal(messages[0][2], 12);
    assert.deepEqual(Array.from(messages[0].slice(4, 20)), Array.from(regs));
    assert.ok(Math.abs(messages[0][34] - 0.2) < 1e-6);
    assert.ok(Math.abs(messages[0][35] - 0.4) < 1e-6);
    assert.ok(Math.abs(messages[0][36] - 0.6) < 1e-6);
    assert.equal(messages[0][38], 0);
    assert.equal(messages[0][39], 191);

    for (let i = 0; i < 4; i++) {
        visualizer.update(false, 12, 0, regs, 0, 0, 0, 1, 0);
    }
    assert.equal(messages.length, 2);
    assert.equal(messages[1][1], 0);
});

test('YM visualizer clamps envelope state and still reports current noise bit', () => {
    const messages = [];
    const visualizer = new YMVisualizer({ postMessage: (view) => messages.push(view.slice()) });

    for (let i = 0; i < 4; i++) {
        visualizer.update(true, 0, 0, new Uint8Array(16), 0, 0, 0, 1, 2);
    }

    assert.equal(messages[0][38], 1);
    assert.equal(messages[0][39], 255);
});

test('YM pin generator positions pins on both sides of the larger die', () => {
    const chip = new BaseChip({});
    const pins = chip.generatePins(40, 70, 760, 55, 405);

    assert.match(pins, /class="silicon-pin pin-bot-4" x="193\.5" y="405"/);
    assert.match(pins, /class="silicon-pin pin-bot-3" x="155\.5" y="405"/);
    assert.match(pins, /class="silicon-pin pin-top-38" x="155\.5" y="55"/);
});

test('YM display uses hardware divider behavior and shows register-driven gates', () => {
    const nodes = new Map();
    const createNode = () => ({
        style: {},
        attributes: {},
        textContent: '',
        classList: { toggle() {} },
        setAttribute(name, value) { this.attributes[name] = value; },
        querySelector() { return createNode(); }
    });
    const container = {
        querySelector(selector) {
            if (!nodes.has(selector)) nodes.set(selector, createNode());
            return nodes.get(selector);
        },
        querySelectorAll(selector) {
            if (!nodes.has(selector)) nodes.set(selector, Array.from({ length: 4 }, createNode));
            return nodes.get(selector);
        }
    };
    const chip = new Ym2149(container);
    chip.cacheDOM();

    const regs = new Uint8Array(32);
    regs[0] = 1;
    regs[1] = 0;
    regs[6] = 0;
    regs[7] = 0b10000010;
    regs[8] = 0x10;
    regs[11] = 0;
    regs[12] = 0;
    regs[13] = 0x0A;
    regs[14] = 0x5A;
    regs[15] = 0xA5;
    regs[30] = 1;
    regs[31] = 128;

    chip.update([0.1, 0.2, 0.3], regs, 0);

    assert.equal(nodes.get('.ym-tone-a-per').textContent, 'R00/01:$001');
    assert.equal(nodes.get('.ym-tone-a-hz').textContent, '125.0kHz');
    assert.equal(nodes.get('.ym-noise-hz').textContent, 'R06:$00 · 125.0kHz');
    assert.equal(nodes.get('.mix-t-a').style.fill, 'var(--highlight-color)');
    assert.equal(nodes.get('.mix-t-b').style.fill, 'var(--chassis-dark)');
    assert.equal(nodes.get('.ym-noise-gen').style.opacity, '1.0');
    assert.equal(nodes.get('.ym-env-level').attributes.width, '33');
    assert.equal(nodes.get('.ym-port-a-value').textContent, 'PA(FLP):$5A OUT');
    assert.equal(nodes.get('.ym-port-b-value').textContent, 'PB(PRT):$A5 IN');
    assert.equal(nodes.get('.ym-board-glue-txt').textContent, 'LINEAR SUM: 20%');
    assert.equal(nodes.get('.ym-board-glue-bar').attributes.width, '30');
});

test('YM SVG labels separated board stages and routes audio to selected package pins', () => {
    const chip = new Ym2149({});
    const svg = chip.getSvg();

    assert.match(svg, /ATARI ST · BOARD MODEL/);
    assert.match(svg, /A\/4 · B\/3 · C\/38/);
    assert.match(svg, /2-STAGE · 256-PHASE KAISER-SINC · 20kHz PB · 96dB/);
    assert.match(svg, /15\.9kHz LP · 25Hz HP · LINEAR/);
    assert.doesNotMatch(svg, /BUS GLUE|TANH|255-TAP|I\/\(1\+0\.22\*I\)/);
    assert.match(svg, /M 203 420 H 216 V 442 H 876 V 168 H 918/);
    assert.match(svg, /M 165 55 V 28 H 886 V 216 H 918/);
    assert.equal((svg.match(/class="silicon-pin-number"/g) || []).length, 40);
});
