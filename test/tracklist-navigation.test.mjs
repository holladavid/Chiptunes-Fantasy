import test from 'node:test';
import assert from 'node:assert/strict';

import { getTracklistEntries, searchTracks, trackRegistry } from '../tracks/index.js';

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
    const rootFolderCount = rootEntries.filter(entry => entry.type === 'folder').length;
    assert.equal(rootFolderCount, 4);
    assert.ok(rootEntries.slice(rootFolderCount).every(entry => entry.type === 'track'));
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
    assert.match(dragonflightEntries[0].song.composerInfo, /Jochen Hippel/);
    assert.match(dragonflightEntries[0].song.composerInfo, /COSO-\/HIPC/);

    const wingsEntries = getTracklistEntries(trackRegistry.amiga, wingsFolder.path);
    assert.equal(wingsEntries.length, 9);
    assert.ok(wingsEntries.every(entry => entry.type === 'track'));
    assert.equal(wingsEntries[0].song.path, 'wings-of-death/Wings_Of_Death-Title.hip');
    assert.match(wingsEntries[0].song.composerInfo, /Jochen Hippel/);
    assert.match(wingsEntries[0].song.composerInfo, /HIP mit originalem 68000-Replaycode/);
});

test('Atari tracklist separates games, demos and five curated root tracks', () => {
    const rootEntries = getTracklistEntries(trackRegistry.atari);
    const folders = rootEntries.filter(entry => entry.type === 'folder');
    const rootTracks = rootEntries.filter(entry => entry.type === 'track');

    assert.equal(trackRegistry.atari.length, 86);
    assert.deepEqual(folders.map(entry => entry.name), ['spiele', 'demo-szene']);
    assert.deepEqual(rootTracks.map(entry => entry.song.listTitle), [
        'Thalion – Intro',
        'Bionic Commando',
        'Stormlord – Titel',
        'Goldrunner',
        'Punish Your Machine – Best Part of Creation'
    ]);
    assert.ok(rootEntries.slice(0, 2).every(entry => entry.type === 'folder'));
});

test('Atari game folders contain the curated tracks without flattening their paths', () => {
    const gameFolders = getTracklistEntries(trackRegistry.atari, 'spiele');
    const expectedTracks = {
        dragonflight: 5,
        amberstar: 20,
        'wings-of-death': 10,
        'lethal-xcess': 7,
        turrican: 2,
        xenon: 3,
        'giana-sisters': 6,
        'ghouls-n-ghosts': 3,
        speedball: 1,
        stormlord: 1,
        'chambers-of-shaolin': 2,
        'xenon-2': 1,
        'led-storm': 1,
        'enchanted-land': 1
    };

    assert.deepEqual(
        gameFolders.map(entry => entry.name),
        Object.keys(expectedTracks)
    );
    assert.ok(gameFolders.every(entry => entry.type === 'folder'));

    for (const [folder, expectedCount] of Object.entries(expectedTracks)) {
        const directory = `spiele/${folder}`;
        const tracks = getTracklistEntries(trackRegistry.atari, directory);
        assert.equal(tracks.length, expectedCount, directory);
        assert.ok(tracks.every(entry => entry.type === 'track'));
        assert.ok(tracks.every(entry => entry.song.path.startsWith(`${directory}/`)));
        assert.ok(tracks.every(entry => entry.song.listTitle.length < entry.song.title.length + 1));
    }

    const xenonTracks = getTracklistEntries(trackRegistry.atari, 'spiele/xenon');
    assert.deepEqual(xenonTracks.map(entry => entry.song.listTitle), [
        'Titel', 'Ingame', 'End-of-Level-Battle'
    ]);
});

test('Atari demo folders preserve screen-specific groups and nested navigation', () => {
    const demoFolders = getTracklistEntries(trackRegistry.atari, 'demo-szene');
    const expectedTracks = {
        'union-demo': 11,
        'syntax-terror': 3,
        spherical: 1,
        synergy: 2,
        remixes: 1
    };

    assert.deepEqual(demoFolders.map(entry => entry.name), Object.keys(expectedTracks));
    for (const [folder, expectedCount] of Object.entries(expectedTracks)) {
        const tracks = getTracklistEntries(trackRegistry.atari, `demo-szene/${folder}`);
        assert.equal(tracks.length, expectedCount, folder);
        assert.ok(tracks.every(entry => entry.type === 'track'));
    }

    const syntaxTracks = getTracklistEntries(trackRegistry.atari, 'demo-szene/syntax-terror');
    assert.deepEqual(syntaxTracks.map(entry => entry.song.listTitle), [
        'Screen unbekannt', 'TeX 24hours', 'TLB Screen'
    ]);
});

test('Logical Atari folders do not change physical production baseline sources', () => {
    const expectedSources = new Map([
        ['spiele/giana-sisters/Giana_Title.YM', 'Giana_Title.YM'],
        ['spiele/wings-of-death/WINGLEV1.YM', 'wings-of-death/WINGLEV1.YM'],
        ['GOLDRUN.YM', 'GOLDRUN.YM']
    ]);

    for (const [logicalPath, sourcePath] of expectedSources) {
        const song = trackRegistry.atari.find(entry => entry.path === logicalPath);
        assert.ok(song, logicalPath);
        assert.equal(song.sourcePath, sourcePath);
    }
});


test('Archive search finds nested tracks with normalized title and path terms', () => {
    const wingsTracks = searchTracks(trackRegistry.atari, 'wings of death');
    assert.equal(wingsTracks.length, 10);
    assert.ok(wingsTracks.every(entry => entry.song.path.startsWith('wings-of-death/') || entry.song.path.startsWith('spiele/wings-of-death/')));

    const gwensLament = searchTracks(trackRegistry.amiga, 'Gwens Lament');
    assert.ok(gwensLament.length >= 1);
    assert.equal(gwensLament[0].song.path, 'amberstar/Gwens_Lament.hipc');

    assert.deepEqual(searchTracks(trackRegistry.c64, ''), []);
    assert.deepEqual(searchTracks(trackRegistry.c64, 'definitely-not-a-track'), []);
});

test('Archive search includes curated composer metadata and preserves registry indices', () => {
    const results = searchTracks(trackRegistry.atari, 'Jochen Hippel');
    assert.ok(results.length > 0);
    assert.ok(results.every(entry => entry.song.composerInfo.includes('Jochen Hippel')));
    assert.ok(results.every(entry => trackRegistry.atari[entry.index] === entry.song));

    const xenonResults = searchTracks(trackRegistry.atari, 'xenon');
    const directXenonResults = xenonResults.filter(entry => entry.song.path.includes('xenon'));
    assert.equal(directXenonResults.length, 4);
    assert.deepEqual(
        xenonResults.slice(0, directXenonResults.length).map(entry => entry.song.path),
        directXenonResults.map(entry => entry.song.path)
    );
    assert.ok(xenonResults.slice(directXenonResults.length).every(entry => !entry.song.path.includes('xenon')));
});
