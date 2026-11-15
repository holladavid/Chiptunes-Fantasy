import test from 'node:test';
import assert from 'node:assert/strict';

import { StageManager } from '../js/visuals/dj/stage-manager.js';
import { TensionManager, TENSION_MAX } from '../js/visuals/dj/tension-manager.js';
import { SetlistManager } from '../js/visuals/dj/setlist-manager.js';

function makeDse(name, overrides = {}) {
    return {
        state: 'idle',
        stateTime: 0,
        _markedForRemoval: false,
        metadata: {
            name,
            systems: ['all'],
            layer: 'foreground',
            lifecycle: 'managed',
            maxInstances: 1,
            weight: 10,
            duration: 15,
            climaxHold: 10,
            isVoid: false,
            isDisabled: false,
            isExclusive: false,
            ...overrides
        }
    };
}

function makeDynamics(energy = 0.5) {
    return {
        masterEnergy: Float32Array.from([energy]),
        beatEnvelope: Float32Array.from([0]),
        channelSmooth: Float32Array.from([energy, energy, energy, energy])
    };
}

test('oneshot DSE does not re-enter stopping while stopped in idle and is removed cleanly', () => {
    const stage = new StageManager();
    const presenter = makeDse('TrackPresenter', {
        layer: 'overlay',
        lifecycle: 'oneshot',
        duration: 3.0,
        climaxHold: 0
    });
    presenter.state = 'starting';
    stage.activeDSEs.push(presenter);

    // 1.0s starting -> playing
    stage.updateCrossfades('playing', 0.5);
    stage.updateCrossfades('playing', 0.5);
    assert.equal(presenter.state, 'playing');

    // Track stoppt -> 1.0s stopping -> Entfernung aus activeDSEs
    stage.updateCrossfades('idle', 0.1);
    assert.equal(presenter.state, 'stopping');
    for (let i = 0; i < 10; i++) {
        stage.updateCrossfades('idle', 0.1);
    }
    assert.equal(stage.activeDSEs.length, 0);
    assert.equal(presenter.state, 'idle');

    // Lange Idle-Phase darf keinen Zombie-Fade ausloesen
    for (let i = 0; i < 50; i++) {
        stage.updateCrossfades('idle', 0.1);
    }
    assert.equal(stage.activeDSEs.length, 0);
    assert.equal(presenter.state, 'idle');
});

test('clearNonPermanentDSEs preserves fresh starting oneshot while removing stale oneshots and managed DSEs', () => {
    const stage = new StageManager();
    const managed = makeDse('Starfield', { layer: 'background' });
    managed.state = 'playing';
    const permanent = makeDse('LimitBar', { layer: 'overlay', lifecycle: 'permanent' });
    permanent.state = 'playing';
    const stalePresenter = makeDse('OldPresenter', { layer: 'overlay', lifecycle: 'oneshot' });
    stalePresenter.state = 'stopping';
    const freshPresenter = makeDse('NewPresenter', { layer: 'overlay', lifecycle: 'oneshot' });
    freshPresenter.state = 'starting';

    stage.activeDSEs.push(managed, permanent, stalePresenter, freshPresenter);
    stage.clearNonPermanentDSEs();

    assert.deepEqual(stage.activeDSEs, [permanent, freshPresenter]);
});

test('getMaxClimaxHoldTime ignores void, oneshot, permanent, and removing DSEs', () => {
    const stage = new StageManager();
    const starfield = makeDse('Starfield', { layer: 'background', climaxHold: 8.0 });
    starfield.state = 'playing';
    const voidFloor = makeDse('VoidFloor', { layer: 'floor', isVoid: true, climaxHold: 10.0 });
    voidFloor.state = 'playing';
    const presenter = makeDse('TrackPresenter', { layer: 'overlay', lifecycle: 'oneshot', climaxHold: 0 });
    presenter.state = 'playing';
    const removingBg = makeDse('OldSunset', { layer: 'background', climaxHold: 15.0 });
    removingBg.state = 'stopping';
    removingBg._markedForRemoval = true;

    stage.activeDSEs.push(starfield, voidFloor, presenter, removingBg);
    assert.equal(stage.getMaxClimaxHoldTime(), 8.0);

    stage.activeDSEs = [voidFloor, presenter];
    assert.equal(stage.getMaxClimaxHoldTime(), 10.0);
});

test('TensionManager momentum buildup is consistent between 60 Hz and 120 Hz', () => {
    const stage = new StageManager();
    const info = { system: 'c64', isPlaying: true };
    const tm60 = new TensionManager();
    const tm120 = new TensionManager();

    // Baseline-Frame bei gleicher Energie
    tm60.update(makeDynamics(0.3), info, stage, 1 / 60, null);
    tm120.update(makeDynamics(0.3), info, stage, 1 / 120, null);

    // Identischer linearer Energieanstieg von 0.3 auf 0.8 ueber 1.0s
    for (let i = 1; i <= 60; i++) {
        tm60.update(makeDynamics(0.3 + 0.5 * (i / 60)), info, stage, 1 / 60, null);
    }
    for (let i = 1; i <= 120; i++) {
        tm120.update(makeDynamics(0.3 + 0.5 * (i / 120)), info, stage, 1 / 120, null);
    }

    assert.ok(tm60.tension > 0);
    assert.ok(Math.abs(tm60.tension - tm120.tension) < 0.02,
        `Expected matching tension (60Hz=${tm60.tension}, 120Hz=${tm120.tension})`);
});

test('TensionManager preserves buildup hysteresis across brief quiet dips below 0.25', () => {
    const stage = new StageManager();
    const info = { system: 'atari', isPlaying: true };
    const tm = new TensionManager();
    const regsA = new Uint8Array(32);
    const regsB = new Uint8Array(32);
    regsA[7] = 0xFF;
    regsB[7] = 0xF7;
    regsB[8] = 15;

    // Buildup mit deutlich ueber 45% Tension erreichen und MIN_BUILDUP_TIME ueberschreiten
    let step = 0;
    while (step < 1200 && (tm.macroState !== 'buildup' || tm.tension < 15.0 || tm.energyStateTimer < 0.6)) {
        tm.update(makeDynamics(0.85), info, stage, 1 / 60, (step & 1) ? regsB : regsA);
        step++;
    }
    assert.equal(tm.macroState, 'buildup');
    assert.ok(tm.tension >= 15.0);

    // Kurzes Break (0.3s mit energy <= 0.25) darf buildup nicht auf playing zurueckwerfen
    for (let i = 0; i < 18; i++) {
        tm.update(makeDynamics(0.2), info, stage, 1 / 60, regsA);
    }
    assert.equal(tm.macroState, 'buildup');
    assert.ok(tm.tension > TENSION_MAX * 0.45);

    // Erst unter 45% Tension darf der Rueckfall auf playing erfolgen
    for (let i = 0; i < 300 && tm.macroState === 'buildup'; i++) {
        tm.update(makeDynamics(0.2), info, stage, 1 / 60, regsA);
    }
    assert.equal(tm.macroState, 'playing');
    assert.ok(tm.tension < TENSION_MAX * 0.45);
});

test('TensionManager detects Atari YM2149 tone and volume novelty without noise or digidrums', () => {
    const stage = new StageManager();
    const info = { system: 'atari', isPlaying: true };
    const tm = new TensionManager();

    const base = new Uint8Array(32);
    base[7] = 0xFF; // Noise aus
    base[13] = 255; // Kein Hardware-Envelope-Write
    base[0] = 100;
    base[8] = 2;

    const note = new Uint8Array(base);
    note[0] = 60;  // Tonhoehenwechsel > 8
    note[8] = 12;  // Volume-Sprung > 2

    tm.update(makeDynamics(0.5), info, stage, 1 / 60, base);
    tm.update(makeDynamics(0.5), info, stage, 1 / 60, note);

    assert.ok(tm.freshness > 0.1);
});

test('SetlistManager.forceSystemChange removes foreign DSEs without filling idle slots or burning fatigue', () => {
    const stage = new StageManager();
    const setlist = new SetlistManager();

    const c64 = makeDse('C64Bg', { systems: ['c64'], layer: 'background', weight: 12 });
    c64.state = 'playing';
    const amiga1 = makeDse('AmigaBg1', { systems: ['amiga'], layer: 'background', weight: 12 });
    const amiga2 = makeDse('AmigaBg2', { systems: ['amiga'], layer: 'background', weight: 10 });

    setlist.registerDSE(c64);
    setlist.registerDSE(amiga1);
    setlist.registerDSE(amiga2);
    stage.activeDSEs.push(c64);

    setlist.forceSystemChange(stage, { system: 'amiga', isPlaying: false });

    assert.equal(stage.activeDSEs.length, 0);
    assert.equal(c64.state, 'idle');
    assert.equal(amiga1.currentWeight, 12);
    assert.equal(amiga2.currentWeight, 10);
});