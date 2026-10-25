import test from 'node:test';
import assert from 'node:assert/strict';

import { MediaSessionController } from '../js/audio/media-session.js';

class MockMediaMetadata {
    constructor(init) {
        Object.assign(this, init);
    }
}

function createMock(unsupportedActions = []) {
    const handlers = new Map();
    const positionStates = [];
    return {
        handlers,
        positionStates,
        metadata: null,
        playbackState: 'none',
        setActionHandler(action, handler) {
            if (unsupportedActions.includes(action)) throw new TypeError(`Unsupported: ${action}`);
            handlers.set(action, handler);
        },
        setPositionState(state) {
            positionStates.push(state);
        }
    };
}

test('Media Session routes transport actions through the shared callbacks', () => {
    const mock = createMock();
    const calls = [];
    const controller = new MediaSessionController({
        mediaSession: mock,
        Metadata: MockMediaMetadata,
        onPlay: () => calls.push('play'),
        onPause: () => calls.push('pause'),
        onNext: () => calls.push('next'),
        onPrevious: () => calls.push('previous')
    });

    mock.handlers.get('play')();
    mock.handlers.get('pause')();
    mock.handlers.get('stop')();
    mock.handlers.get('nexttrack')();
    mock.handlers.get('previoustrack')();

    assert.deepEqual(calls, ['play', 'pause', 'pause', 'next', 'previous']);
    controller.setPlaybackState('playing');
    assert.equal(mock.playbackState, 'playing');
});

test('Media Session publishes title, artist, album and artwork', () => {
    const mock = createMock();
    const artwork = [{ src: 'cover.png', sizes: '512x512', type: 'image/png' }];
    const controller = new MediaSessionController({ mediaSession: mock, Metadata: MockMediaMetadata });

    controller.setMetadata('Commando [SUB 2/3]', 'Rob Hubbard', 'Chiptunes Fantasy · C64', artwork);

    assert.equal(mock.metadata.title, 'Commando [SUB 2/3]');
    assert.equal(mock.metadata.artist, 'Rob Hubbard');
    assert.equal(mock.metadata.album, 'Chiptunes Fantasy · C64');
    assert.equal(mock.metadata.artwork, artwork);
});

test('seek actions are enabled only for seekable formats and use ten-second defaults', () => {
    const mock = createMock();
    const seeks = [];
    const controller = new MediaSessionController({
        mediaSession: mock,
        onSeekBackward: offset => seeks.push(-offset),
        onSeekForward: offset => seeks.push(offset),
        onSeekTo: seconds => seeks.push(seconds)
    });

    assert.equal(mock.handlers.has('seekbackward'), false);
    assert.equal(mock.handlers.has('seekforward'), false);
    assert.equal(mock.handlers.has('seekto'), false);

    controller.setSeekable(true);
    mock.handlers.get('seekbackward')({});
    mock.handlers.get('seekforward')({ seekOffset: 5 });
    mock.handlers.get('seekto')({ seekTime: 42.5 });
    mock.handlers.get('seekto')({});
    assert.deepEqual(seeks, [-10, 5, 42.5]);

    controller.setSeekable(false);
    assert.equal(mock.handlers.get('seekbackward'), null);
    assert.equal(mock.handlers.get('seekforward'), null);
    assert.equal(mock.handlers.get('seekto'), null);
});

test('position updates are clamped, finite and throttled outside forced changes', () => {
    const mock = createMock();
    let now = 0;
    const controller = new MediaSessionController({ mediaSession: mock, now: () => now });

    controller.updatePosition(180, -4);
    now = 100;
    controller.updatePosition(180, 1);
    now = 1000;
    controller.updatePosition(180, 200);
    now = 1001;
    controller.updatePosition(180, 3, true);
    controller.updatePosition(0, 0, true);
    controller.updatePosition(180, Infinity, true);

    assert.deepEqual(mock.positionStates, [
        { duration: 180, position: 0, playbackRate: 1 },
        { duration: 180, position: 180, playbackRate: 1 },
        { duration: 180, position: 3, playbackRate: 1 }
    ]);
});

test('unsupported optional actions and position reporting never break playback', () => {
    const mock = createMock(['seekto']);
    mock.setPositionState = undefined;
    const controller = new MediaSessionController({ mediaSession: mock });

    assert.doesNotThrow(() => {
        controller.setSeekable(true);
        controller.updatePosition(100, 10, true);
        controller.setMetadata('Title', 'Artist', 'Album');
        controller.clear();
    });
    assert.equal(mock.handlers.get('seekbackward'), null);
    assert.equal(mock.handlers.get('seekforward'), null);
    assert.equal(mock.handlers.has('seekto'), false);
});

test('a browser without Media Session or MediaMetadata is a no-op', () => {
    const controller = new MediaSessionController({ mediaSession: null, Metadata: null });
    assert.doesNotThrow(() => {
        controller.setMetadata('Title', 'Artist', 'Album');
        controller.setPlaybackState('playing');
        controller.setSeekable(true);
        controller.updatePosition(100, 10, true);
        controller.clear();
    });
});
