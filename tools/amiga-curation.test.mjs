import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { AMIGA_HARNESS_ROOT, sha256 } from '../tools/lib/amiga-exact-harness.mjs';
import { amigaPlaylist } from '../tracks/amiga/playlist.js';
import { amigaMuseumMetadata } from '../tracks/amiga/museum.js';

const source = relative => readFileSync(path.join(AMIGA_HARNESS_ROOT, relative));
const json = relative => JSON.parse(source(relative));
const expectedLegacyPrefix = [
    'ELYSIUM.MOD', 'space_debris.xm', 'GSLINGER.MOD', 'agony_intro.mod', 'turrican_2_title.xm',
    'dragonflight/dragonflight_titletune.HIPC', 'dragonflight/dragonflight_surface.HIPC',
    'dragonflight/dragonflight_town.HIPC', 'dragonflight/dragonflight_dungeon.HIPC',
    'dragonflight/dragonflight_endsequence.HIPC', 'dragonflight/dragonflight_ani.HIPC',
    'dragonflight/dragonflight_always.HIPC',
    'amberstar/City_Walk.hipc', 'amberstar/Dreamcave.hipc', 'amberstar/Eriks_Revenge.hipc',
    'amberstar/Fanfares.hipc', 'amberstar/Flying_High.hipc', 'amberstar/Funkey_Dungeon.hipc',
    'amberstar/Gwens_Lament.hipc', 'amberstar/Hasta_La_Vista.hipc', 'amberstar/High_Seas.hipc',
    'amberstar/Horse_Song.hipc', 'amberstar/Irish_Spring.hipc', 'amberstar/Lullaby.hipc',
    'amberstar/Lurking_Horror.hipc', 'amberstar/Minor_Quarrels.hipc', 'amberstar/Misty_Orc_Hop.hipc',
    'amberstar/Mystic_Moments.hipc', 'amberstar/Ode_To_Schnism.hipc', 'amberstar/Travellers_Tune.hipc',
    'amberstar/Ingame.hipc', 'wings-of-death/Wings_Of_Death-Title.hip',
    'wings-of-death/Wings_Of_Death-Level_1.hipc', 'wings-of-death/Wings_Of_Death-Level_2.hipc',
    'wings-of-death/Wings_Of_Death-Level_3.hipc', 'wings-of-death/Wings_Of_Death-Level_4.hipc',
    'wings-of-death/Wings_Of_Death-Level_5.hipc', 'wings-of-death/Wings_Of_Death-Level_6.hipc',
    'wings-of-death/Wings_Of_Death-Level_7.hipc', 'wings-of-death/Wings_Of_Death-End.hipc',
    'blood_money_title.mod', 'moongazr.mod', 'immortal.mod', 'lotus2-title.mod', 'DEADLOCK.XM'
];

test('Kuration: 45 Bestandspfade bleiben unverändert und 24 eindeutige Klassiker ergänzen sie', () => {
    assert.equal(amigaPlaylist.length, 69);
    assert.equal(new Set(amigaPlaylist.map(entry => entry.path)).size, 69);
    assert.deepEqual(amigaPlaylist.slice(0, 45).map(entry => entry.path), expectedLegacyPrefix);
    const additions = amigaPlaylist.slice(45).map(entry => entry.path);
    assert.equal(additions.filter(filename => filename.startsWith('classics/games/')).length, 12);
    assert.equal(additions.filter(filename => filename.startsWith('classics/demoscene/')).length, 12);
    assert.ok(additions.every(filename => filename.endsWith('.mod')));
    assert.ok(!amigaPlaylist.some(entry => entry.path === 'beast1.title.dw'));
});

test('Kuration: jeder Titel besitzt einen spezifischen, strukturierten Museumstext', () => {
    assert.equal(Object.keys(amigaMuseumMetadata).length, 69);
    assert.deepEqual(Object.keys(amigaMuseumMetadata).sort(), amigaPlaylist.map(entry => entry.path).sort());
    for (const entry of amigaPlaylist) {
        const text = amigaMuseumMetadata[entry.path];
        assert.equal(entry.composerInfo, text);
        assert.match(text, /<strong>Historie:<\/strong>/);
        assert.match(text, /<strong>Datei &amp; Replay:<\/strong>/);
        assert.match(text, /<strong>Quellen:<\/strong>/);
        assert.doesNotMatch(text, /\[ CLASSIC AMIGA MODULE \]|Ein historisches Amiga-Tracker-Dokument/);
        for (const match of text.matchAll(/<a\s+([^>]+)>/g)) {
            assert.match(match[1], /target="_blank"/);
            assert.match(match[1], /rel="noopener noreferrer"/);
        }
    }
});

test('Kuration: Provenienz stimmt mit allen 24 ausgelieferten Dateibytes überein', () => {
    const provenance = json('tracks/amiga/classics/provenance.json');
    assert.equal(provenance.schema, 'chiptunes-fantasy-amiga-classics-provenance-v1');
    assert.equal(provenance.tracks.length, 24);
    assert.match(provenance.rightsNotice, /does not imply public domain/i);
    const additions = new Set(amigaPlaylist.slice(45).map(entry => `tracks/amiga/${entry.path}`));
    assert.deepEqual(new Set(provenance.tracks.map(track => track.path)), additions);
    for (const track of provenance.tracks) {
        const bytes = source(track.path);
        assert.equal(bytes.length, track.bytes, track.path);
        assert.equal(sha256(bytes), track.sha256, track.path);
        assert.match(track.sourceUrl, /^https:\/\/modland\.com\/pub\/modules\/Protracker\//);
        assert.ok(track.originalFilename.length > 0);
        assert.ok(['M.K.', 'M!K!', '4CHN', 'FLT4'].includes(track.magic));
        assert.ok(track.orders > 0 && track.patterns > 0 && track.usedSamples > 0);
    }
    const excluded = provenance.excludedExistingFiles.find(track => track.path === 'tracks/amiga/beast1.title.dw');
    assert.ok(excluded);
    assert.equal(sha256(source(excluded.path)), excluded.sha256);
    assert.match(excluded.reason, /No speculative parser change/);
});

test('Kuration: separate 69-Titel-Abnahme ist bestanden und Phase 5 bleibt historisch unverändert', () => {
    const result = json('doc/verification/amiga/curation-library-corpus.json');
    assert.equal(result.format, 'chiptunes-fantasy-amiga-curation-library-v1');
    assert.equal(result.passed, true);
    assert.equal(result.corpus.trackCount, 69);
    assert.equal(result.corpus.tracks.length, 69);
    assert.deepEqual(result.corpus.formatCounts, { HIPC: 35, MOD: 31, XM: 3 });
    assert.ok(result.corpus.tracks.every(track => track.passed && track.finite && track.audible &&
        track.deterministic && track.blockIndependent && track.restartIdentical));
    assert.deepEqual(result.corpus.silentA500Tracks, []);
    assert.equal(result.performance.withinOfflineRealTimeBudget, true);
    assert.equal(result.workletSha256, sha256(source('js/worklets/amiga/paula-exact.js')));
    assert.equal(result.playlistSha256, sha256(source('tracks/amiga/playlist.js')));
    assert.equal(result.museumSha256, sha256(source('tracks/amiga/museum.js')));
    assert.equal(result.provenanceSha256, sha256(source('tracks/amiga/classics/provenance.json')));

    const phase5 = json('doc/verification/amiga/phase5-production-corpus.json');
    assert.equal(phase5.corpus.trackCount, 45);
    assert.deepEqual(phase5.corpus.formatCounts, { HIPC: 35, MOD: 7, XM: 3 });
    assert.equal(result.workletSha256, phase5.workletSha256);
});
