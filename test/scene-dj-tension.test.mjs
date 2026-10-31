import test from 'node:test';
import assert from 'node:assert/strict';

import { TrackMonitor } from '../js/visuals/dj/track-monitor.js';
import { TensionManager } from '../js/visuals/dj/tension-manager.js';

const DT = 1 / 60;

function runTensionScenario({ energy, channels, beat, freshness, maxSeconds = 120 }) {
    const manager = new TensionManager();
    const info = { system: 'c64', isPlaying: true };
    const dynamics = {
        masterEnergy: new Float32Array([energy]),
        channelSmooth: Float32Array.from(channels),
        beatEnvelope: new Float32Array([beat])
    };
    const stageManager = {
        clearNonPermanentDSEs() {},
        getMaxClimaxHoldTime() { return 10; }
    };
    const transitions = [];
    let previousState = manager.macroState;
    let elapsed = 0;

    for (let frame = 0; frame < maxSeconds / DT; frame++) {
        manager.freshness = freshness;
        manager.update(dynamics, info, stageManager, DT, null);
        elapsed += DT;
        if (manager.macroState !== previousState) {
            transitions.push({ state: manager.macroState, time: elapsed });
            previousState = manager.macroState;
        }
        if (manager.macroState === 'climax') break;
    }

    return {
        transitions,
        buildupAt: transitions.find(entry => entry.state === 'buildup')?.time ?? null,
        climaxAt: transitions.find(entry => entry.state === 'climax')?.time ?? null
    };
}

test('C64 tension ignores the SID write rate in the unused fourth channel slot', () => {
    const monitor = new TrackMonitor();
    monitor.info.system = 'c64';
    monitor.info.isPlaying = true;

    monitor.update(Float32Array.from([0.6, 0.8, 1.0, 1500]), 0.05, null);

    assert.ok(Math.abs(monitor.dynamics.masterEnergy[0] - 0.8) < 1e-6);
    assert.equal(monitor.dynamics.channelSmooth[3], 0);
});

test('Amiga tension continues to include all four physical channels', () => {
    const monitor = new TrackMonitor();
    monitor.info.system = 'amiga';
    monitor.info.isPlaying = true;

    monitor.update(Float32Array.from([0.25, 0.5, 0.75, 1.0]), 0.05, null);

    assert.ok(Math.abs(monitor.dynamics.masterEnergy[0] - 0.625) < 1e-6);
    assert.equal(monitor.dynamics.channelSmooth[3], 1);
});

test('Moderate songs expose playing and buildup before reaching overdrive', () => {
    const result = runTensionScenario({
        energy: 0.52,
        channels: [0.52, 0.58, 0.46, 0],
        beat: 0.25,
        freshness: 0.45
    });

    assert.ok(result.buildupAt !== null, 'Buildup must be reached');
    assert.ok(result.climaxAt !== null, 'Overdrive must be reached');
    assert.ok(result.buildupAt > 5, 'The playing stage must remain recognizable');
    assert.ok(result.climaxAt > 20, 'Moderate songs must not snap directly to overdrive');
    assert.ok(result.climaxAt - result.buildupAt >= 3.4,
        'The normal buildup stage must remain visible for at least 3.4 seconds');
});

test('Full-board energy and drums reach overdrive faster without skipping buildup', () => {
    const moderate = runTensionScenario({
        energy: 0.52,
        channels: [0.52, 0.58, 0.46, 0],
        beat: 0.25,
        freshness: 0.45
    });
    const fullBoard = runTensionScenario({
        energy: 0.95,
        channels: [0.9, 0.95, 1.0, 0],
        beat: 1.0,
        freshness: 1.0
    });

    assert.ok(fullBoard.buildupAt !== null, 'Full board must still pass through buildup');
    assert.ok(fullBoard.climaxAt !== null, 'Full board must reach overdrive');
    assert.ok(fullBoard.climaxAt < moderate.climaxAt);
    assert.ok(fullBoard.climaxAt < 10, 'Full board should reach overdrive quickly');
    assert.ok(fullBoard.climaxAt - fullBoard.buildupAt >= 1.4,
        'Even the fastest buildup must remain visible for at least 1.4 seconds');
});
