import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createAmigaFixtureResolver } from './helpers/amiga-fixtures.mjs';
import {
    AMIGA_HARNESS_ROOT, loadAmigaTrack
} from '../tools/lib/amiga-exact-harness.mjs';

const readJson = relative => JSON.parse(readFileSync(path.join(AMIGA_HARNESS_ROOT, relative), 'utf8'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

test('Amiga-Fixtures: rekursive Projektstruktur und flacher externer Bestand', () => {
    const nested = createAmigaFixtureResolver(['Wings_Of_Death-Level_1.hipc']);
    assert.ok(nested.fx('Wings_Of_Death-Level_1.hipc').endsWith(path.join('wings-of-death', 'Wings_Of_Death-Level_1.hipc')));

    const flat = mkdtempSync(path.join(tmpdir(), 'amiga-flat-fixtures-'));
    writeFileSync(path.join(flat, 'Wings_Of_Death-Level_1.hipc'), 'fixture');
    const resolver = createAmigaFixtureResolver(['Wings_Of_Death-Level_1.hipc'], flat);
    assert.equal(resolver.fx('Wings_Of_Death-Level_1.hipc'), path.join(flat, 'Wings_Of_Death-Level_1.hipc'));
});

test('Amiga-Fixtures: fehlende Pflichtdatei und mehrdeutiger Dateiname sind laute Fehler', () => {
    const missing = mkdtempSync(path.join(tmpdir(), 'amiga-missing-fixtures-'));
    assert.throws(() => createAmigaFixtureResolver(['required.hipc'], missing), /Pflicht-Fixture fehlt: required\.hipc/);

    const ambiguous = mkdtempSync(path.join(tmpdir(), 'amiga-ambiguous-fixtures-'));
    mkdirSync(path.join(ambiguous, 'a'));
    mkdirSync(path.join(ambiguous, 'b'));
    writeFileSync(path.join(ambiguous, 'a', 'same.hipc'), 'a');
    writeFileSync(path.join(ambiguous, 'b', 'same.hipc'), 'b');
    assert.throws(() => createAmigaFixtureResolver([], ambiguous), /Mehrdeutiges Amiga-Fixture/);
});

test('Phase-0-Korpus: alle 45 Playlist-Titel, Formate und Diagnosen sind vollständig', () => {
    const corpus = readJson('doc/verification/amiga/phase0-corpus.json');
    assert.equal(corpus.trackCount, 45);
    assert.equal(corpus.tracks.length, 45);
    assert.deepEqual(corpus.summary.formats, { COSO: 33, HIP68K: 2, MOD: 7, XM: 3 });
    assert.equal(corpus.summary.parserWarnings, 34);
    assert.equal(corpus.summary.silentNotes, 48);
    assert.deepEqual(corpus.summary.diagnosticClassifications, {
        'confirmed-benign': 0,
        'reference-required': 37,
        defect: 0
    });
    assert.equal(corpus.tracks.filter(track => track.loadError || track.replay?.failed).length, 0);
    assert.equal(corpus.tracks.find(track => track.path.endsWith('Wings_Of_Death-End.hipc')).format, 'HIP68K');
    for (const track of corpus.tracks) {
        assert.match(track.sha256, /^[0-9a-f]{64}$/);
        assert.ok(track.diagnostics.every(item => ['confirmed-benign', 'reference-required', 'defect'].includes(item.classification)));
    }
    assert.match(corpus.provenanceSha256['js/worklets/amiga/paula-exact.js'], /^[0-9a-f]{64}$/);
});

test('Phase-0-Provenienz: historischer COSO-Regressionsanker bleibt unverändert und hashgebunden', async () => {
    const baseline = readJson('doc/verification/amiga/phase0-exact-level1.json');
    const corpus = readJson('doc/verification/amiga/phase0-corpus.json');
    const loaded = await loadAmigaTrack(baseline.input);
    assert.equal(sha256(loaded.bytes), baseline.tuneSha256);
    assert.equal(baseline.format, 'chiptunes-fantasy-amiga-exact-phase0-v1');
    assert.equal(baseline.deterministic, true);
    assert.equal(baseline.finite, true);
    assert.equal(baseline.blockComparison.bitIdentical, true);
    assert.equal(baseline.restartComparison.bitIdenticalToFreshWorklet, false);
    assert.equal(baseline.workletSha256, corpus.provenanceSha256['js/worklets/amiga/paula-exact.js']);
});

test('Exact-Baselines: Deterministik, finite Ausgabe und dokumentierter Resetbefund', () => {
    for (const name of ['level1', 'hip68k', 'mod', 'xm']) {
        const report = readJson(`doc/verification/amiga/phase0-exact-${name}.json`);
        assert.equal(report.deterministic, true, name);
        assert.equal(report.finite, true, name);
        assert.equal(report.blockComparison.bitIdentical, true, name);
        assert.equal(report.masterProcessing.startsWith('excluded:'), true);
        assert.deepEqual(report.runs[0].taps.map(tap => tap.sampleRate), [192000, 192000, 48000]);
        const freshHashes = Object.fromEntries(report.runs[0].taps.map(tap => [tap.id, tap.sha256]));
        const differentStages = report.restartComparison.run.taps
            .filter(tap => freshHashes[tap.id] !== tap.sha256).map(tap => tap.id);
        if (name === 'mod') assert.deepEqual(differentStages, []);
        else assert.deepEqual(differentStages, ['a500'], `${name}: bekannter Phase-1-Resetbefund`);
    }
});

test('UADE-Manifest: fehlende WAV-Hashes sind transparent, Modul-Hashes stimmen mit dem Korpus überein', () => {
    const manifest = readJson('doc/verification/amiga/phase0-uade-manifest.json');
    const corpus = readJson('doc/verification/amiga/phase0-corpus.json');
    for (const item of manifest.cases) {
        const track = corpus.tracks.find(track => `tracks/amiga/${track.path}` === item.module);
        assert.ok(track, item.module);
        assert.equal(track.sha256, item.moduleSha256);
        assert.equal(track.bytes, item.moduleBytes);
        if (item.referenceSha256 === null) assert.equal(manifest.status, 'historical-results-documented-reference-wavs-not-in-source-archive');
    }
});
