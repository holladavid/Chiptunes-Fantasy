import test from 'node:test';
import assert from 'node:assert/strict';
import {
    CRT_DEFAULTS,
    CRT_PRESETS,
    DisplaySettingsStore,
    OSC_DEFAULTS,
    STORAGE_KEY,
    toCrtMaskOptions
} from '../js/visuals/display-settings.js';

function createMemoryStorage(initial = {}) {
    const map = new Map(Object.entries(initial));
    return {
        getItem(key) {
            return map.has(key) ? map.get(key) : null;
        },
        setItem(key, value) {
            map.set(key, String(value));
        },
        dump() {
            return Object.fromEntries(map.entries());
        }
    };
}

test('DisplaySettingsStore initializes with factory defaults and survives broken storage', () => {
    const storeNull = new DisplaySettingsStore({ storage: null });
    assert.equal(storeNull.getState().crtPreset, 'default');
    assert.deepEqual(storeNull.getEffectiveCrt('c64'), CRT_DEFAULTS);
    assert.deepEqual(storeNull.getEffectiveOsc(), OSC_DEFAULTS);

    const throwingStorage = {
        getItem() { throw new Error('SecurityError'); },
        setItem() { throw new Error('QuotaExceededError'); }
    };
    const storeThrow = new DisplaySettingsStore({ storage: throwingStorage });
    storeThrow.updateOsc({ gain: 1.8 });
    assert.equal(storeThrow.getEffectiveOsc().gain, 1.8);

    const corruptStorage = createMemoryStorage({
        [STORAGE_KEY]: '{broken-json'
    });
    const storeCorrupt = new DisplaySettingsStore({ storage: corruptStorage });
    assert.deepEqual(storeCorrupt.getEffectiveCrt('amiga'), CRT_DEFAULTS);
});

test('DisplaySettingsStore clamps persisted values and restores across instances', () => {
    const storage = createMemoryStorage();
    const storeA = new DisplaySettingsStore({ storage });

    storeA.updateCrt({
        quality: 'medium',
        maskType: 'delta',
        pitch: 99,
        scanlineRows: 7,
        vignette: 0.99,
        contrast: 0.1
    });
    storeA.updateOsc({
        gain: 5,
        timeWindowMs: 2,
        beamMode: 'spot',
        phosphorTint: 'p31'
    });

    const storeB = new DisplaySettingsStore({ storage });
    const crt = storeB.getEffectiveCrt('c64');
    const osc = storeB.getEffectiveOsc();

    assert.equal(storeB.getState().crtPreset, 'custom');
    assert.equal(crt.quality, 'medium');
    assert.equal(crt.maskType, 'delta');
    assert.equal(crt.pitch, 8);
    assert.equal(crt.scanlineRows, 2);
    assert.equal(crt.vignette, 0.8);
    assert.equal(crt.contrast, 0.75);

    assert.equal(osc.gain, 2.5);
    assert.equal(osc.timeWindowMs, 8);
    assert.equal(osc.beamMode, 'spot');
    assert.equal(osc.phosphorTint, 'p31');
});

test('DisplaySettingsStore resolves AUTO system presets and preserves GPU quality', () => {
    const storage = createMemoryStorage();
    const store = new DisplaySettingsStore({ storage });

    store.updateCrt({ quality: 'medium' });
    store.setCrtPreset('auto', 'c64');

    assert.equal(store.getState().crtPreset, 'auto');
    assert.equal(store.getEffectiveCrt('c64').beamBlur, CRT_PRESETS.composite.beamBlur);
    assert.equal(store.getEffectiveCrt('c64').quality, 'medium');
    assert.equal(store.getEffectiveCrt('amiga').beamBlur, CRT_PRESETS.rgb.beamBlur);
    assert.equal(store.getEffectiveCrt('atari').maskType, 'grille');
    assert.equal(store.getEffectiveCrt('atari').quality, 'medium');

    // Qualitätsänderung allein darf AUTO nicht auf custom werfen
    store.updateCrt({ quality: 'low' }, 'c64');
    assert.equal(store.getState().crtPreset, 'auto');

    // Manueller Regler-Schub übernimmt die Basis des aktiven Systems ohne Sprung
    store.updateCrt({ scanlineStrength: 0.44 }, 'c64');
    assert.equal(store.getState().crtPreset, 'custom');
    assert.equal(store.getEffectiveCrt('c64').beamBlur, CRT_PRESETS.composite.beamBlur);
    assert.equal(store.getEffectiveCrt('c64').scanlineStrength, 0.44);
    assert.equal(store.getEffectiveCrt('c64').quality, 'low');
});

test('toCrtMaskOptions produces proportional Barrel curvature tuples and forwards all fields', () => {
    const defaultOpts = toCrtMaskOptions(CRT_DEFAULTS);
    assert.deepEqual(defaultOpts.curvature, [0.014, 0.018]);
    assert.equal(defaultOpts.vignette, 0.28);
    assert.equal(defaultOpts.contrast, 1.15);
    assert.equal(defaultOpts.scanlineRows, 1);

    const flatOpts = toCrtMaskOptions({ ...CRT_DEFAULTS, curvature: 0, scanlineRows: 2 });
    assert.deepEqual(flatOpts.curvature, [0, 0]);
    assert.equal(flatOpts.scanlineRows, 2);
});

test('DisplaySettingsStore supports A/B bypass, reset, availability status, and typed notifications', () => {
    const storage = createMemoryStorage();
    const store = new DisplaySettingsStore({ storage });
    const events = [];

    const unsubscribe = store.subscribe((state, meta) => {
        events.push({ reason: meta.reason, bypassed: state.bypassed, available: state.crtAvailable });
    });

    store.setCrtPreset('composite');
    store.updateOsc({ gain: 2.0 });
    store.setCrtAvailable(true);
    store.setCrtAvailable(true); // doppelter Wert darf kein Event feuern

    store.setBypassed(true);
    assert.deepEqual(store.getEffectiveCrt('c64'), CRT_DEFAULTS);
    assert.deepEqual(store.getEffectiveOsc(), OSC_DEFAULTS);
    assert.equal(store.getState().osc.gain, 2.0); // gespeicherter Wert bleibt erhalten

    // Tweaken beendet Bypass automatisch
    store.updateOsc({ bloom: 0.9 });
    assert.equal(store.isBypassed(), false);
    assert.equal(store.getEffectiveOsc().bloom, 0.9);
    assert.equal(store.getEffectiveOsc().gain, 2.0);

    store.resetAll();
    assert.equal(store.getState().crtPreset, 'default');
    assert.deepEqual(store.getEffectiveCrt('c64'), CRT_DEFAULTS);
    assert.deepEqual(store.getEffectiveOsc(), OSC_DEFAULTS);

    unsubscribe();
    store.updateOsc({ gain: 1.5 });

    assert.deepEqual(events.map(e => e.reason), [
        'crt',
        'osc',
        'availability',
        'bypass',
        'osc',
        'reset'
    ]);
});