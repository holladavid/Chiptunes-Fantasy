import test from 'node:test';
import assert from 'node:assert/strict';

import { getTracklistEntries, trackRegistry } from '../tracks/index.js';

test('Amiga tracklist shows game folders and navigates their tracks', () => {
    const rootEntries = getTracklistEntries(trackRegistry.amiga);
    const amberstarFolder = rootEntries.find(entry => entry.type === 'folder' && entry.name === 'amberstar');
    const dragonflightFolder = rootEntries.find(entry => entry.type === 'folder' && entry.name === 'dragonflight');
    const wingsFolder = rootEntries.find(entry => entry.type === 'folder' && entry.name === 'wings-of-death');

    assert.ok(amberstarFolder);
    assert.ok(dragonflightFolder);
    assert.ok(wingsFolder);
    assert.deepEqual(
        rootEntries.slice(0, 3).map(entry => entry.name),
        ['dragonflight', 'amberstar', 'wings-of-death']
    );
    assert.ok(rootEntries.slice(0, 3).every(entry => entry.type === 'folder'));
    assert.ok(rootEntries.slice(3).every(entry => entry.type === 'track'));
    assert.equal(rootEntries.some(entry => entry.song?.path?.startsWith('amberstar/')), false);
    assert.equal(rootEntries.filter(entry => entry.type === 'track').length, 10);

    const amberstarEntries = getTracklistEntries(trackRegistry.amiga, amberstarFolder.path);
    assert.equal(amberstarEntries.length, 19);
    assert.ok(amberstarEntries.every(entry => entry.type === 'track'));
    assert.equal(amberstarEntries[6].song.path, 'amberstar/Gwens_Lament.hipc');

    const dragonflightEntries = getTracklistEntries(trackRegistry.amiga, dragonflightFolder.path);
    assert.equal(dragonflightEntries.length, 7);
    assert.ok(dragonflightEntries.every(entry => entry.type === 'track'));
    assert.equal(dragonflightEntries[0].song.path, 'dragonflight/dragonflight_titletune.HIPC');
    assert.match(dragonflightEntries[0].song.composerInfo, /COMPOSER SPOTLIGHT/);

    const wingsEntries = getTracklistEntries(trackRegistry.amiga, wingsFolder.path);
    assert.equal(wingsEntries.length, 9);
    assert.ok(wingsEntries.every(entry => entry.type === 'track'));
    assert.equal(wingsEntries[0].song.path, 'wings-of-death/Wings_Of_Death-Title.hip');
    assert.match(wingsEntries[0].song.composerInfo, /COMPOSER SPOTLIGHT/);
});
