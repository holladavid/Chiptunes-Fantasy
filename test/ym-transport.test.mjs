import test from 'node:test';
import assert from 'node:assert/strict';

import {
    formatFrameTime,
    framesToSeconds,
    getPlayerRate,
    isStoredLoopTransition,
    secondsToFrames
} from '../js/audio/playback-timing.js';

test('non-50-Hz metadata drives timeline, seeking and Media Session time values', () => {
    const track = { length: 600, metadata: { playerRate: 60 } };
    assert.equal(getPlayerRate(track), 60);
    assert.equal(framesToSeconds(150, track), 2.5);
    assert.equal(secondsToFrames(2.5, track), 150);
    assert.equal(formatFrameTime(600, track), '00:10');
    assert.equal(formatFrameTime(6000, track), '01:40');
});

test('missing or invalid player rates retain the 50 Hz compatibility default', () => {
    assert.equal(getPlayerRate({}), 50);
    assert.equal(getPlayerRate({ metadata: { playerRate: 0 } }), 50);
    assert.equal(getPlayerRate({ metadata: { playerRate: Infinity } }), 50);
    assert.equal(formatFrameTime(100, {}), '00:02');
});

test('stored loop transitions are distinguished from other frame jumps', () => {
    const track = { length: 100, metadata: { loopFrame: 5 } };
    assert.equal(isStoredLoopTransition(99, 5, track), true);
    assert.equal(isStoredLoopTransition(98, 5, track), true);
    assert.equal(isStoredLoopTransition(99, 0, track), false);
    assert.equal(isStoredLoopTransition(50, 5, track), false);
    assert.equal(isStoredLoopTransition(99, 5, { length: 100 }), false);
});
