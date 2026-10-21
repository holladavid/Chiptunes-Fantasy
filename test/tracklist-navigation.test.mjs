import test from 'node:test';
import assert from 'node:assert/strict';

import { getTracklistEntries, trackRegistry } from '../tracks/index.js';

test('Amiga tracklist shows Amberstar as a folder and navigates its tracks', () => {
    const rootEntries = getTracklistEntries(trackRegistry.amiga);
    const amberstarFolder = rootEntries.find(entry => entry.type === 'folder' && entry.name === 'amberstar');

    assert.ok(amberstarFolder);
    assert.equal(rootEntries.some(entry => entry.song?.path?.startsWith('amberstar/')), false);
    assert.equal(rootEntries.filter(entry => entry.type === 'track').length, 26);

    const amberstarEntries = getTracklistEntries(trackRegistry.amiga, amberstarFolder.path);
    assert.equal(amberstarEntries.length, 19);
    assert.ok(amberstarEntries.every(entry => entry.type === 'track'));
    assert.equal(amberstarEntries[6].song.path, 'amberstar/Gwens_Lament.hipc');
});
