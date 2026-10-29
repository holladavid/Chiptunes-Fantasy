import test from 'node:test';
import assert from 'node:assert/strict';

import { buildNowPlayingModel } from '../js/ui/now-playing-console.js';

const tracks = [
    { title: 'CURRENT TRACK' },
    { title: 'NEXT TRACK' }
];

test('fullscreen console maps complete C64 metadata and the next track', () => {
    const model = buildNowPlayingModel({
        system: 'c64',
        metadata: {
            author: 'MAGNAR HARESTAD',
            released: '2015 CENSOR DESIGN/OXYRON',
            type: 'RSID v2 (6502 Emulator)',
            songs: 3,
            loadAddress: '0x0800',
            playAddress: '0x0000'
        },
        selectedSong: tracks[0],
        trackIndex: 0,
        tracks,
        currentSubsong: 2
    });

    assert.equal(model.composer, 'MAGNAR HARESTAD');
    assert.equal(model.release, '2015 CENSOR DESIGN/OXYRON');
    assert.equal(model.subsong, '02 / 03');
    assert.equal(model.format, 'RSID v2 (6502 Emulator)');
    assert.equal(model.hardware, 'LOAD 0x0800 · PLAY 0x0000');
    assert.equal(model.next, 'NEXT TRACK');
    assert.deepEqual(model.channelLabels, ['SID 1', 'SID 2', 'SID 3']);
});

test('fullscreen console does not reuse stale metadata while a new track loads', () => {
    const model = buildNowPlayingModel({
        system: 'c64',
        metadata: null,
        selectedSong: tracks[0],
        trackIndex: 0,
        tracks
    });

    assert.equal(model.composer, 'READING METADATA');
    assert.equal(model.release, 'READING METADATA');
    assert.equal(model.format, 'READING METADATA');
    assert.equal(model.hardware, 'READING METADATA');
    assert.equal(model.subsong, '—');
    assert.equal(model.next, 'NEXT TRACK');
});

test('fullscreen console exposes four Paula DMA channels and module details', () => {
    const model = buildNowPlayingModel({
        system: 'amiga',
        metadata: {
            author: 'UNKNOWN SCENER',
            type: 'ProTracker 4-Channel',
            patternCount: 12,
            instrumentCount: 8
        },
        selectedSong: tracks[1],
        trackIndex: 1,
        tracks
    });

    assert.deepEqual(model.channelLabels, ['DMA 1', 'DMA 2', 'DMA 3', 'DMA 4']);
    assert.equal(model.hardware, '4 DMA VOICES · 12 PATTERNS · 8 SAMPLES');
    assert.equal(model.release, 'NOT IN FILE');
    assert.equal(model.next, 'CURRENT TRACK', 'the archive wraps to its first track');
});

test('fullscreen console exposes three YM voices and real clock metadata', () => {
    const model = buildNowPlayingModel({
        system: 'atari',
        metadata: {
            author: 'JOCHEN HIPPEL',
            type: 'YM6!',
            masterClock: 2000000,
            playerRate: 50
        }
    });

    assert.deepEqual(model.channelLabels, ['PSG A', 'PSG B', 'PSG C']);
    assert.equal(model.hardware, '3 PSG · 2.00 MHZ · 50 HZ');
    assert.equal(model.subsong, '—');
    assert.equal(model.next, '—');
});
