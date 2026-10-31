import test from 'node:test';
import assert from 'node:assert/strict';

import { Starfield } from '../js/visuals/dse/universal/starfield.js';

function createSeededStarfield() {
    const originalRandom = Math.random;
    let seed = 0x5eed1234;
    Math.random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
    };
    try {
        return new Starfield();
    } finally {
        Math.random = originalRandom;
    }
}

function createContext() {
    return {
        globalAlpha: 1,
        fillStyle: '#000000',
        hash: 2166136261,
        operations: 0,
        fillRect(x, y, width, height) {
            assert.ok(Number.isFinite(x) && Number.isFinite(y), 'Star coordinates must remain finite');
            assert.ok(Number.isFinite(width) && Number.isFinite(height), 'Star sizes must remain finite');
            this.operations++;
            const signature = `${this.fillStyle}:${x},${y},${width},${height};`;
            for (let i = 0; i < signature.length; i++) {
                this.hash ^= signature.charCodeAt(i);
                this.hash = Math.imul(this.hash, 16777619);
            }
        }
    };
}

function createCoverageContext() {
    return {
        globalAlpha: 1,
        fillStyle: '#000000',
        points: [],
        fillRect(x, y, width, height) {
            if (width <= 2 && height <= 2 && this.fillStyle !== '#000000') {
                this.points.push([x, y]);
            }
        }
    };
}

function createMetrics(system, overrides = {}) {
    const regs = new Uint8Array(32);
    regs[8] = regs[9] = regs[10] = 12;
    return {
        system,
        beat: [0, 0, 0, 0],
        beatStarted: false,
        beatCount: 0,
        smooth: [0.5, 0.4, 0.3, 0.2],
        tensionPct: 0.4,
        rawEnergyState: 'playing',
        regs,
        ...overrides
    };
}

test('Starfield switches patterns only on exact beat events', () => {
    const starfield = createSeededStarfield();
    const ctx = createContext();

    starfield.render(ctx, 160, 200, 1, 'playing', 0, createMetrics('c64', {
        beatStarted: true, beatCount: 1
    }));
    assert.equal(starfield.pattern, 0);
    assert.equal(starfield.palettePhase, 1);

    starfield.render(ctx, 160, 200, 1.02, 'playing', 0.02, createMetrics('c64', {
        beatStarted: true, beatCount: 4
    }));
    assert.equal(starfield.pattern, 1);
    assert.equal(starfield.palettePhase, 0);

    starfield.render(ctx, 160, 200, 1.04, 'playing', 0.04, createMetrics('c64', {
        beat: [1, 1, 1, 1], beatStarted: false, beatCount: 4
    }));
    assert.equal(starfield.pattern, 1, 'The decaying envelope must not retrigger a pattern');

    starfield.render(ctx, 160, 200, 1.06, 'afterglow', 12, createMetrics('c64', {
        tensionPct: 0.2
    }));
    assert.equal(starfield.lastState, 'afterglow');
    assert.equal(starfield.stateAge, 0, 'Afterglow needs a local transition timestamp');
});

test('Starfield recycling is deterministic and uses no randomness while rendering', () => {
    const originalRandom = Math.random;
    Math.random = () => {
        throw new Error('Math.random() is forbidden in the Starfield render loop');
    };

    try {
        for (const system of ['c64', 'amiga', 'atari']) {
            const first = createSeededStarfield();
            const second = createSeededStarfield();
            const firstCtx = createContext();
            const secondCtx = createContext();

            for (let frame = 0; frame < 720; frame++) {
                const beatStarted = frame % 10 === 0;
                const beatCount = Math.floor(frame / 10) + 1;
                const metrics = createMetrics(system, {
                    beat: [beatStarted ? 1 : 0.25, 0, 0, 0],
                    beatStarted,
                    beatCount
                });
                const state = frame < 240 ? 'playing' : frame < 480 ? 'buildup' : 'climax';
                const t = 1 + frame / 50;
                first.render(firstCtx, 160, 200, t, state, 3 + frame / 50, metrics);
                second.render(secondCtx, 160, 200, t, state, 3 + frame / 50, metrics);
            }

            assert.equal(firstCtx.hash, secondCtx.hash, `${system} render sequences must match`);
            assert.equal(first.recycleState, second.recycleState, `${system} PRNG states must match`);
            assert.ok(firstCtx.operations > 1000, `${system} must actually render and recycle stars`);
        }
    } finally {
        Math.random = originalRandom;
    }
});

test('Starfield covers widescreen and redistributes immediately after mobile rotation', () => {
    function renderCoverage(starfield, ctx, system, width, height, firstFrame, frames) {
        let grid = null;
        for (let frame = firstFrame; frame < firstFrame + frames; frame++) {
            ctx.points.length = 0;
            starfield.render(ctx, width, height, 1 + frame / 50, 'playing',
                3 + frame / 50, createMetrics(system));
        }

        grid = Array(12).fill(0);
        for (const [x, y] of ctx.points) {
            if (x < 0 || y < 0 || x >= width || y >= height) continue;
            const column = Math.min(3, Math.floor(x / width * 4));
            const row = Math.min(2, Math.floor(y / height * 3));
            grid[row * 4 + column]++;
        }
        return grid;
    }

    for (const system of ['c64', 'amiga', 'atari']) {
        const height = system === 'amiga' ? 256 : 200;
        const portraitWidth = Math.floor(height * 390 / 844);
        const landscapeWidth = Math.floor(height * 844 / 390);
        const rotating = createSeededStarfield();
        const rotatingCtx = createCoverageContext();

        renderCoverage(rotating, rotatingCtx, system, portraitWidth, height, 0, 40);
        const rotatedGrid = renderCoverage(
            rotating, rotatingCtx, system, landscapeWidth, height, 40, 4
        );
        assert.ok(rotatedGrid.every(count => count > 0),
            `${system} must fill every screen region after portrait-to-landscape rotation`);

        const widescreen = createSeededStarfield();
        const widescreenCtx = createCoverageContext();
        const widescreenGrid = renderCoverage(
            widescreen, widescreenCtx, system, height * 3, height, 0, 40
        );
        assert.ok(widescreenGrid.every(count => count > 0),
            `${system} must fill every screen region on a 3:1 desktop viewport`);
    }
});
