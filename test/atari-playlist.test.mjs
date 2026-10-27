import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { atariPlaylist } from '../tracks/atari/playlist.js';
import { parseYM } from '../js/parsers/ym-parser.js';

const bySource = sourcePath => atariPlaylist.find(song => song.sourcePath === sourcePath);

test('Every curated Atari track has a unique logical path, source and museum card', () => {
    assert.equal(atariPlaylist.length, 86);
    assert.equal(new Set(atariPlaylist.map(song => song.path)).size, 86);
    assert.equal(new Set(atariPlaylist.map(song => song.sourcePath)).size, 86);

    for (const song of atariPlaylist) {
        assert.ok(song.title, song.path);
        assert.ok(song.listTitle, song.path);
        assert.match(song.composerInfo, /<h3>\[ ATARI ST/);
        assert.match(song.composerInfo, /<strong>YM-Archiv:<\/strong>/);
        assert.doesNotMatch(song.composerInfo, /CLASSIC ATARI ST YM2149F/);
        assert.doesNotMatch(song.composerInfo, /phasenstarr|aliasingfrei|physikalisch exakt|Programmier-Gott|unantastbar/i);
    }
});

test('All 86 physical YM sources parse as 2 MHz, 50 Hz register dumps', () => {
    let frameTotal = 0;
    for (const song of atariPlaylist) {
        const bytes = readFileSync(new URL(`../tracks/atari/${song.sourcePath}`, import.meta.url));
        const parsed = parseYM(bytes);
        assert.ok(parsed.frames.length > 0, song.sourcePath);
        assert.equal(parsed.metadata.masterClock, 2_000_000, song.sourcePath);
        assert.equal(parsed.metadata.playerRate, 50, song.sourcePath);
        assert.ok(['YM3!', 'YM3b', 'YM5!', 'YM6!'].includes(parsed.metadata.type), song.sourcePath);
        frameTotal += parsed.frames.length;
    }
    assert.equal(frameTotal, 787_018);
});

test('Corrected Xenon and Syntax Terror cards follow their embedded metadata', () => {
    assert.equal(bySource('XN1.YM').listTitle, 'Ingame');
    assert.match(bySource('XN1.YM').composerInfo, /Xenon \(Ingame\)/);
    assert.equal(bySource('XN2.YM').listTitle, 'End-of-Level-Battle');
    assert.equal(bySource('XN3.YM').listTitle, 'Titel');
    assert.match(bySource('XN3.YM').composerInfo, /Xenon \(Title\)/);

    const syntax = bySource('SyntaxTerror.YM');
    assert.match(syntax.composerInfo, /Jochen Hippel/);
    assert.match(syntax.composerInfo, /Syntax Terror: \? screen/);
});

test('Archive-only numbering no longer invents Amberstar or level titles', () => {
    const amber = bySource('amberstar/AMBER01.YM');
    assert.equal(amber.listTitle, 'Musik #20');
    assert.match(amber.composerInfo, /Amberstar #20/);
    assert.equal(amber.title, 'Amberstar – Musik #20');
    assert.doesNotMatch(amber.title, /Twinlake|Taverne|Titelthema/);

    const wings = bySource('wings-of-death/WINGLEV1.YM');
    assert.equal(wings.listTitle, 'Musikdump 01');
    assert.doesNotMatch(wings.composerInfo, /Over the Trees/);

    const lethal = bySource('LethalXcess2.YM');
    assert.equal(lethal.listTitle, 'Musik 2');
    assert.doesNotMatch(lethal.composerInfo, /Ruins of Methallycha|Dynamic-Staging|Nachhall-Verhalten der Hardware/);
});

test('The 13 new highlights are present and retain their verified credits', () => {
    const expected = new Map([
        ['ghouls-n-ghosts/Ghouls_1.YM', /Tim Follin/],
        ['ghouls-n-ghosts/Ghouls_2.YM', /Tim Follin/],
        ['ghouls-n-ghosts/Ghouls_3.YM', /Tim Follin/],
        ['speedball/Speedball_1.YM', /David Whittaker/],
        ['stormlord/Stormlord_Title.YM', /Jochen Hippel/],
        ['stormlord/Stormlord_Ingame.YM', /Jochen Hippel/],
        ['chambers-of-shaolin/Chambers_Title.YM', /Jochen Hippel/],
        ['chambers-of-shaolin/Chambers_Loader.YM', /Jochen Hippel/],
        ['xenon-2/Xenon_2_Megablast.YM', /Bomb the Bass/],
        ['led-storm/LED_Storm_1.YM', /Tim Follin/],
        ['synergy/Synergy_Main_Menu.YM', /Scavenger \/ Synergy/],
        ['synergy/Synergy_Credits.YM', /Scavenger \/ Synergy/],
        ['punish-your-machine/PYM_Best_Part_of_Creation.YM', /Big Alec \/ Delta Force/]
    ]);

    for (const [sourcePath, credit] of expected) {
        const song = bySource(sourcePath);
        assert.ok(song, sourcePath);
        assert.match(song.composerInfo, credit, sourcePath);
    }
    assert.equal(bySource('punish-your-machine/PYM_Best_Part_of_Creation.YM').composerInfo.includes('zwei eingebetteten Digidrum-Blöcken'), true);
});
