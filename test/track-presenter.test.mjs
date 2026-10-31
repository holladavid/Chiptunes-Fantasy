import test from 'node:test';
import assert from 'node:assert/strict';

import { TrackPresenter } from '../js/visuals/dse/universal/track-presenter.js';

function createContext() {
    return {
        globalAlpha: 1,
        fillStyle: '#000000',
        hash: 2166136261,
        operations: 0,
        fillRect(x, y, width, height) {
            assert.ok(Number.isFinite(x) && Number.isFinite(y), 'Text and panel coordinates must remain finite');
            assert.ok(Number.isFinite(width) && Number.isFinite(height), 'Rectangle sizes must remain finite');
            assert.ok(width > 0 && height > 0, 'Drawn rectangles must have a positive size');
            this.operations++;
            const signature = `${this.fillStyle}:${x},${y},${width},${height};`;
            for (let i = 0; i < signature.length; i++) {
                this.hash ^= signature.charCodeAt(i);
                this.hash = Math.imul(this.hash, 16777619);
            }
        },
        save() {},
        restore() {},
        beginPath() {},
        rect() {},
        clip() {}
        // No measureText/fillText: the presenter must use its aliased bitmap font.
    };
}

function createPresenter(longTitle = false) {
    const presenter = new TrackPresenter();
    presenter.metadata = { duration: 3 };
    presenter.setTrackInfo({
        name: longTitle ? 'The Last Fantastic Chiptunes Adventure' : 'Commando',
        author: 'Rob Hubbard',
        type: 'PSID',
        currentSubsong: 1,
        startSong: 1,
        songs: 19
    });
    return presenter;
}

function createMetrics(system, overrides = {}) {
    return {
        system,
        beat: [0.2, 0, 0, 0],
        beatStarted: false,
        beatCount: 0,
        smooth: [0.7, 0.5, 0.35, 0.2],
        tensionPct: 0.5,
        ...overrides
    };
}

test('TrackPresenter switches layout only on exact fourth-beat events', () => {
    const presenter = createPresenter();
    const ctx = createContext();

    presenter.render(ctx, 432, 200, 1, 'playing', 0, createMetrics('c64', {
        beatStarted: true, beatCount: 1
    }));
    assert.equal(presenter.layout, 0);
    assert.equal(presenter.palettePhase, 1);

    presenter.render(ctx, 432, 200, 1.02, 'playing', 0.02, createMetrics('c64', {
        beatStarted: true, beatCount: 4
    }));
    assert.equal(presenter.layout, 1);
    assert.equal(presenter.palettePhase, 0);

    presenter.render(ctx, 432, 200, 1.04, 'playing', 0.04, createMetrics('c64', {
        beat: [1, 1, 1, 1], beatStarted: false, beatCount: 4
    }));
    assert.equal(presenter.layout, 1, 'The beat envelope must not retrigger a layout');

    presenter.render(ctx, 432, 200, 1.06, 'afterglow', 12, createMetrics('c64', {
        tensionPct: 0.2
    }));
    assert.equal(presenter.stateAge, 0, 'Afterglow needs a local transition timestamp');
});

test('TrackPresenter is deterministic across systems, macro states and rotation', () => {
    for (const system of ['c64', 'amiga', 'atari']) {
        const first = createPresenter(true);
        const second = createPresenter(true);
        const firstCtx = createContext();
        const secondCtx = createContext();

        for (let frame = 0; frame < 600; frame++) {
            const beatStarted = frame % 10 === 0;
            const metrics = createMetrics(system, {
                beat: [beatStarted ? 1 : 0.2, 0, 0, 0],
                beatStarted,
                beatCount: Math.floor(frame / 10) + 1,
                tensionPct: frame < 450 ? 0.8 : Math.max(0, 1 - (frame - 450) / 150)
            });
            const state = frame < 150 ? 'playing' : frame < 300 ? 'buildup' : frame < 450 ? 'climax' : 'afterglow';
            const width = frame < 300 ? (system === 'amiga' ? 118 : 92) : (system === 'amiga' ? 554 : 432);
            const height = system === 'amiga' ? 256 : 200;
            const t = 1 + frame / 50;
            first.render(firstCtx, width, height, t, state, 3 + frame / 50, metrics);
            second.render(secondCtx, width, height, t, state, 3 + frame / 50, metrics);
        }

        assert.equal(firstCtx.hash, secondCtx.hash, `${system} render sequences must match`);
        assert.equal(first.layout, second.layout, `${system} layouts must match`);
        assert.ok(firstCtx.operations > 1000, `${system} must actually draw bitmap text and panels`);
    }
});
