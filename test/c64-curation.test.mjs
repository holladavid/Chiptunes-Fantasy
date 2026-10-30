import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SID_SLDB } from '../js/content/songlengths.js';
import { c64Playlist, c64TrackPaths } from '../tracks/c64/playlist.js';
import { c64MuseumMetadata } from '../tracks/c64/museum.js';
import { getTracklistEntries, searchTracks, trackRegistry } from '../tracks/index.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = relative => readFileSync(path.join(root, relative));
const json = relative => JSON.parse(source(relative));
const digest = (algorithm, bytes) => createHash(algorithm).update(bytes).digest('hex');
const normalizedKey = filename => filename.split('/').pop().toLowerCase()
    .replace('.sid', '').replace(/[\s_-]/g, '');

const expectedLegacyPrefix = [
    'Commando.sid', 'Crazy_Comets.sid', 'Sanxion.sid', 'Lightforce.sid', 'Wizball.sid',
    'Comic_Bakery.sid', 'Arkanoid.sid', 'Great_Giana_Sisters.sid', 'Bionic_Commando.sid',
    'Last_Ninja.sid', 'Last_Ninja_2.sid', 'Turbo_Outrun.sid', 'Cybernoid_II.sid',
    'Supremacy.sid', 'RoboCop_3.sid', 'Myth.sid', 'Monty_on_the_Run.sid', 'Delta.sid',
    'To_be_on_Top.sid', 'Rambo_First_Blood_Part_II.sid', 'Mega_Apocalypse.sid',
    'Miami_Vice.sid', 'Way_of_the_Tiger.sid', 'Platoon.sid', 'Compilation_I.sid',
    'Compilation_II.sid'
];

function header(relative) {
    const bytes = source(relative);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const text = offset => bytes.subarray(offset, offset + 32).toString('latin1')
        .replace(/\0.*$/s, '').trim();
    return {
        bytes,
        magic: bytes.toString('ascii', 0, 4),
        version: view.getUint16(4, false),
        dataOffset: view.getUint16(6, false),
        loadAddress: view.getUint16(8, false),
        initAddress: view.getUint16(10, false),
        playAddress: view.getUint16(12, false),
        songs: view.getUint16(14, false),
        startSong: view.getUint16(16, false),
        speed: view.getUint32(18, false),
        title: text(22),
        author: text(54),
        released: text(86),
        compatibilityFlags: bytes.length >= 0x7c ? view.getUint16(0x76, false) : 0
    };
}

const hex = (value, width) => `0x${value.toString(16).padStart(width, '0')}`;

test('Kuration: 26 Bestandspfade, 24 Klassiker und vier Assembly-Sieger bleiben eindeutig', () => {
    assert.equal(c64Playlist.length, 54);
    assert.equal(c64TrackPaths.length, 54);
    assert.equal(new Set(c64TrackPaths).size, 54);
    assert.deepEqual(c64TrackPaths.slice(0, 26), expectedLegacyPrefix);
    assert.deepEqual(c64Playlist.map(entry => entry.path), c64TrackPaths);
    const additions = c64TrackPaths.slice(26);
    assert.equal(additions.filter(filename => filename.startsWith('classics/games/')).length, 20);
    assert.equal(additions.filter(filename => filename.startsWith('classics/demoscene/')).length, 4);
    assert.equal(additions.filter(filename => filename.startsWith('assembly/')).length, 4);
    assert.ok(additions.every(filename => filename.endsWith('.sid')));
});

test('Kuration: jeder Titel besitzt einen eigenen strukturierten Museumstext mit sicheren Quellenlinks', () => {
    assert.equal(Object.keys(c64MuseumMetadata).length, 54);
    assert.deepEqual(Object.keys(c64MuseumMetadata).sort(), [...c64TrackPaths].sort());
    assert.equal(new Set(Object.values(c64MuseumMetadata)).size, 54);
    for (const entry of c64Playlist) {
        const museumText = c64MuseumMetadata[entry.path];
        assert.equal(entry.composerInfo, museumText);
        assert.ok(entry.listTitle, entry.path);
        assert.doesNotMatch(entry.listTitle, /LOAD SID|\.sid$/i);
        assert.match(museumText, /<h3>\[ MUSEUM: .+ \]<\/h3>/);
        assert.match(museumText, /<strong>Historie:<\/strong>/);
        assert.match(museumText, /<strong>SID &amp; Replay:<\/strong>/);
        assert.match(museumText, /<strong>Quellen:<\/strong>/);
        assert.doesNotMatch(museumText, /\[ CLASSIC C64 SID \]|Ein historisches C64-SID-Dokument/);
        for (const match of museumText.matchAll(/<a\s+([^>]+)>/g)) {
            assert.match(match[1], /href="https:\/\//);
            assert.match(match[1], /target="_blank"/);
            assert.match(match[1], /rel="noopener noreferrer"/);
        }
    }
});

test('Kuration: sichtbare Titel und Museumstexte folgen den tatsächlichen SID-Headern', () => {
    const byPath = path => c64Playlist.find(entry => entry.path === path);
    const expectations = [
        ['Compilation_II.sid', 'Compilation III', 'Compilation III'],
        ['To_be_on_Top.sid', 'To Be on Top', 'To be on Top'],
        ['classics/demoscene/radio-napalm.sid', 'Coma Light 13 – Tune 1', 'Coma Light 13 (tune 1)'],
        ['classics/demoscene/coma-light-13.sid', 'Radio Napalm', 'Radio Napalm']
    ];

    for (const [path, listTitle, embeddedTitle] of expectations) {
        const entry = byPath(path);
        assert.equal(entry.listTitle, listTitle, path);
        assert.equal(header(`tracks/c64/${path}`).title, embeddedTitle, path);
        assert.ok(entry.composerInfo.includes(embeddedTitle), path);
    }
    assert.match(byPath('Compilation_II.sid').composerInfo, /1989 bei A\.U\.D\.I\.O\.S/);
    assert.match(byPath('To_be_on_Top.sid').composerInfo, /erschien 1987/);
});

test('Kuration: Provenienz und SID-Header stimmen mit allen 24 neuen Dateibytes überein', () => {
    const provenance = json('tracks/c64/classics/provenance.json');
    assert.equal(provenance.schema, 'chiptunes-fantasy-c64-classics-provenance-v1');
    assert.equal(provenance.tracks.length, 24);
    assert.match(provenance.rightsNotice, /does not imply public domain/i);
    assert.equal(provenance.source.name, 'High Voltage SID Collection #85');
    assert.equal(provenance.source.archiveBytes, 84827547);
    assert.equal(provenance.source.archiveSha256,
        'f770339229446df1b8e037938fb70f3f4c953cb4a6eeef7ce357f05ca2c73225');
    const additions = new Set(c64TrackPaths.slice(26, 50).map(filename => `tracks/c64/${filename}`));
    assert.deepEqual(new Set(provenance.tracks.map(track => track.path)), additions);

    for (const track of provenance.tracks) {
        const sid = header(track.path);
        assert.equal(sid.bytes.length, track.bytes, track.path);
        assert.equal(digest('sha256', sid.bytes), track.sha256, track.path);
        assert.equal(digest('md5', sid.bytes), track.md5, track.path);
        assert.equal(`${sid.magic} v${sid.version}`, track.format, track.path);
        assert.equal(sid.title, track.embeddedTitle, track.path);
        assert.equal(sid.author, track.embeddedAuthor, track.path);
        assert.equal(sid.released, track.embeddedReleased, track.path);
        assert.equal(sid.songs, track.songs, track.path);
        assert.equal(sid.startSong, track.startSong, track.path);
        assert.equal(hex(sid.speed, 8), track.speed, track.path);
        assert.equal(hex(sid.compatibilityFlags, 4), track.compatibilityFlags, track.path);
        assert.equal(hex(sid.loadAddress, 4), track.loadAddress, track.path);
        assert.equal(hex(sid.initAddress, 4), track.initAddress, track.path);
        assert.equal(hex(sid.playAddress, 4), track.playAddress, track.path);
        assert.equal(sid.dataOffset, track.dataOffset, track.path);
        assert.equal(track.sourceUrl, provenance.source.archiveUrl, track.path);
        assert.match(track.hvscPath, /^MUSICIANS\/.+\.sid$/);
        assert.ok(['games', 'demoscene'].includes(track.category));
    }
});

test('Kuration: 53 HVSC-Songlength-Listen passen; der neue 2024-Rip nutzt bewusst den Fallback', () => {
    assert.equal(Object.keys(SID_SLDB).length, 53);
    for (const filename of c64TrackPaths) {
        const sid = header(`tracks/c64/${filename}`);
        assert.ok(['PSID', 'RSID'].includes(sid.magic), filename);
        assert.ok(sid.songs > 0, filename);
        assert.ok(sid.startSong >= 1 && sid.startSong <= sid.songs, filename);
        const key = normalizedKey(filename);
        const lengths = SID_SLDB[key]?.lengths;
        if (filename === 'assembly/transcend-the-game.sid') {
            assert.equal(lengths, undefined);
            continue;
        }
        assert.ok(lengths, `${filename}: fehlender normalisierter Schlüssel ${key}`);
        assert.equal(lengths.length, sid.songs, filename);
        assert.ok(lengths.every(length => Number.isFinite(length) && length > 0), filename);
        assert.equal(lengths[sid.startSong - 1], SID_SLDB[key].lengths[sid.startSong - 1]);
    }
    assert.equal(SID_SLDB.rambofirstbloodpartii.lengths.length, 23);
    assert.deepEqual(SID_SLDB.playhorse.lengths, [118, 153]);
});

test('Kuration: Tracklist-Navigation erhält Klassikergruppen und den Assembly-Ordner', () => {
    const rootEntries = getTracklistEntries(trackRegistry.c64);
    assert.equal(rootEntries.filter(entry => entry.type === 'track').length, 26);
    const classics = rootEntries.find(entry => entry.type === 'folder' && entry.name === 'classics');
    assert.ok(classics);
    const groups = getTracklistEntries(trackRegistry.c64, classics.path);
    assert.deepEqual(groups.map(entry => entry.name), ['games', 'demoscene']);
    assert.ok(groups.every(entry => entry.type === 'folder'));
    for (const group of groups) {
        const tracks = getTracklistEntries(trackRegistry.c64, group.path);
        assert.equal(tracks.length, group.name === 'games' ? 20 : 4);
        assert.ok(tracks.every(entry => entry.type === 'track'));
        assert.ok(tracks.every(entry => entry.song.path.startsWith(`${group.path}/`)));
        assert.ok(tracks.every(entry => entry.song.composerInfo.includes('[ MUSEUM:')));
    }

    const assembly = rootEntries.find(entry => entry.type === 'folder' && entry.name === 'assembly');
    assert.ok(assembly);
    const winners = getTracklistEntries(trackRegistry.c64, assembly.path);
    assert.equal(winners.length, 4);
    assert.deepEqual(winners.map(entry => entry.song.listTitle), [
        'Assembly 2012 · Conservative Megademo – Playhorse',
        'Assembly 2020 · Fantomas – Nine Nights from the Black Moon',
        'Assembly 2023 · The Scroll of Antonius',
        'Assembly 2024 · Transcend the Game'
    ]);
});

test('Assembly: 20-Jahres-Abdeckung, Provenienz und Suche sind an die gelieferten Bytes gebunden', () => {
    const provenance = json('tracks/c64/assembly/provenance.json');
    assert.equal(provenance.schema, 'chiptunes-fantasy-c64-assembly-provenance-v1');
    assert.equal(provenance.coverage.length, 20);
    assert.equal(provenance.tracks.length, 4);
    assert.deepEqual(provenance.coverage.filter(year => year.includedTrack).map(year => year.year),
        [2012, 2020, 2023, 2024]);
    assert.equal(provenance.coverage.find(year => year.year === 2007).platform, 'NES/Famicom');
    assert.equal(provenance.coverage.find(year => year.year === 2025).platform, 'MS-DOS/GUS');
    assert.equal(searchTracks(trackRegistry.c64, 'Assembly').length, 4);
    assert.equal(searchTracks(trackRegistry.c64, 'schwarzen Mond')[0].song.path,
        'assembly/nine-nights-from-the-black-moon.sid');

    for (const track of provenance.tracks) {
        const sid = header(track.path);
        assert.equal(digest('sha256', sid.bytes), track.sha256, track.path);
        assert.equal(digest('md5', sid.bytes), track.md5, track.path);
        assert.equal(sid.title, track.embeddedTitle, track.path);
        assert.equal(sid.author, track.embeddedAuthor, track.path);
        assert.equal(sid.songs, track.songs, track.path);
        assert.match(track.csdbReleaseUrl, /^https:\/\/csdb\.dk\/release\/\?id=\d+$/);
        if (track.year === 2024) {
            assert.equal(track.sourceArchive, null);
            assert.equal(track.songlengthsSeconds, null);
            assert.match(track.ripMethod, /\$0400–\$0AFF/);
            assert.equal(sid.initAddress, 0x0400);
            assert.equal(sid.playAddress, 0x0403);
        } else {
            assert.equal(track.sourceArchive, 'High Voltage SID Collection #85');
            assert.equal(track.songlengthsSeconds.length, sid.songs);
        }
    }
});

test('Kuration: separate 54-Titel-Audioabnahme ist bestanden und an die ausgelieferten Quellen gebunden', () => {
    const result = json('doc/verification/c64/curation-library-corpus.json');
    assert.equal(result.format, 'chiptunes-fantasy-c64-curation-library-v1');
    assert.equal(result.passed, true);
    assert.equal(result.engine, 'exact');
    assert.equal(result.processor, 'sid-exact-processor');
    assert.equal(result.corpus.trackCount, 54);
    assert.equal(result.corpus.tracks.length, 54);
    assert.deepEqual(result.corpus.tracks.map(track => track.path), c64TrackPaths);
    assert.equal(Object.values(result.corpus.formatCounts).reduce((sum, count) => sum + count, 0), 54);
    assert.equal(result.corpus.formatCounts['PSID v2'], 47);
    assert.equal(result.corpus.formatCounts['RSID v2'], 7);
    assert.ok(result.corpus.tracks.some(track => track.path === 'classics/demoscene/comaland-100-end.sid' &&
        track.format === 'RSID v2' && track.audible));
    assert.ok(result.corpus.tracks.every(track => track.passed && track.finite && track.audible &&
        track.deterministic && track.blockIndependent && track.restartIdentical));
    assert.deepEqual(result.corpus.silentTracks, []);
    assert.equal(result.performance.withinOfflineRealTimeBudget, true);
    assert.equal(result.workletSha256, digest('sha256', source('js/worklets/c64/sid-exact.js')));
    assert.equal(result.playlistSha256, digest('sha256', source('tracks/c64/playlist.js')));
    assert.equal(result.museumSha256, digest('sha256', source('tracks/c64/museum.js')));
    assert.equal(result.provenanceSha256, digest('sha256', source('tracks/c64/classics/provenance.json')));
    assert.equal(result.assemblyProvenanceSha256, digest('sha256', source('tracks/c64/assembly/provenance.json')));
    assert.equal(result.songlengthsSha256, digest('sha256', source('js/content/songlengths.js')));
});
