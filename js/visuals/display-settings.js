// === js/visuals/display-settings.js ===
// =========================================================
// PERSISTENT CRT SHADOW MASK & OSCILLOSCOPE CALIBRATION STORE
// Verwaltet Hardware-Presets, striktes Clamping, localStorage-
// Persistenz, System-Auto-Profile und Live-Subscriber.
// =========================================================

export const STORAGE_KEY = 'chiptunes-fantasy.display-settings.v1';

const CURVATURE_Y_RATIO = 0.018 / 0.014;

export const CRT_BOUNDS = Object.freeze({
    pitch: Object.freeze({ min: 2, max: 8, step: 0.5 }),
    maskStrength: Object.freeze({ min: 0, max: 1.3, step: 0.05 }),
    scanlineStrength: Object.freeze({ min: 0, max: 1, step: 0.05 }),
    scanlineRows: Object.freeze({ min: 1, max: 2, step: 1 }),
    beamBlur: Object.freeze({ min: 0, max: 1, step: 0.05 }),
    halation: Object.freeze({ min: 0, max: 0.5, step: 0.02 }),
    convergence: Object.freeze({ min: 0, max: 4, step: 0.1 }),
    curvature: Object.freeze({ min: 0, max: 0.056, step: 0.002 }),
    vignette: Object.freeze({ min: 0, max: 0.8, step: 0.02 }),
    contrast: Object.freeze({ min: 0.75, max: 1.75, step: 0.05 })
});

export const OSC_BOUNDS = Object.freeze({
    gain: Object.freeze({ min: 0.5, max: 2.5, step: 0.02 }),
    timeWindowMs: Object.freeze({ min: 8, max: 36, step: 1 }),
    persistence: Object.freeze({ min: 0, max: 1, step: 0.05 }),
    bloom: Object.freeze({ min: 0, max: 1, step: 0.02 }),
    graticule: Object.freeze({ min: 0, max: 1, step: 0.05 })
});

export const EMU_BOUNDS = Object.freeze({
    sidTemperature: Object.freeze({ min: 15, max: 75, step: 1 })
});

export const CRT_QUALITIES = Object.freeze(['off', 'low', 'medium', 'high']);
export const CRT_MASK_TYPES = Object.freeze(['slot', 'delta', 'grille']);
export const OSC_BEAM_MODES = Object.freeze(['sparks', 'spot', 'off']);
export const OSC_TRIGGER_MODES = Object.freeze(['auto', 'free']);
export const OSC_PHOSPHOR_TINTS = Object.freeze(['system', 'p31', 'p11', 'amber']);
export const DSE_REFRESH_DIVISORS = Object.freeze([1, 2, 3, 4]);
export const DSE_TENSION_SPEEDS = Object.freeze(['slow', 'normal', 'fast']);

export const CRT_DEFAULTS = Object.freeze({
    quality: 'high',
    maskType: 'slot',
    pitch: 3,
    maskStrength: 1,
    scanlineStrength: 0.3,
    scanlineRows: 1,
    beamBlur: 0.25,
    halation: 0.1,
    convergence: 0.5,
    curvature: 0.014,
    vignette: 0.28,
    contrast: 1.15
});

export const OSC_DEFAULTS = Object.freeze({
    gain: 1.24,
    timeWindowMs: 32,
    persistence: 0.5,
    bloom: 0.52,
    graticule: 0.55,
    beamMode: 'sparks',
    triggerMode: 'auto',
    phosphorTint: 'system'
});

export const EMU_DEFAULTS = Object.freeze({
    dseRefreshDivisor: 1,
    tensionSpeed: 'normal',
    sidTemperature: 55,
    showLimitBar: false
});

export const CRT_PRESETS = Object.freeze({
    default: Object.freeze({ ...CRT_DEFAULTS }),
    rgb: Object.freeze({
        ...CRT_DEFAULTS,
        maskType: 'slot',
        pitch: 3,
        maskStrength: 1,
        scanlineStrength: 0.3,
        scanlineRows: 1,
        beamBlur: 0.3,
        halation: 0.12,
        convergence: 0.8,
        curvature: 0.014,
        vignette: 0.28,
        contrast: 1.15
    }),
    composite: Object.freeze({
        ...CRT_DEFAULTS,
        maskType: 'slot',
        pitch: 3,
        maskStrength: 1,
        scanlineStrength: 0.36,
        scanlineRows: 1,
        beamBlur: 0.7,
        halation: 0.22,
        convergence: 1.2,
        curvature: 0.022,
        vignette: 0.34,
        contrast: 1.2
    }),
    grille: Object.freeze({
        ...CRT_DEFAULTS,
        maskType: 'grille',
        pitch: 3,
        maskStrength: 1,
        scanlineStrength: 0.22,
        scanlineRows: 1,
        beamBlur: 0.3,
        halation: 0.16,
        convergence: 0.5,
        curvature: 0.008,
        vignette: 0.22,
        contrast: 1.15
    }),
    delta: Object.freeze({
        ...CRT_DEFAULTS,
        maskType: 'delta',
        pitch: 4,
        maskStrength: 1.05,
        scanlineStrength: 0.32,
        scanlineRows: 1,
        beamBlur: 0.45,
        halation: 0.18,
        convergence: 1.0,
        curvature: 0.024,
        vignette: 0.36,
        contrast: 1.2
    })
});

export const SYSTEM_CRT_PRESETS = Object.freeze({
    c64: 'composite',
    amiga: 'rgb',
    atari: 'grille'
});

const VALID_CRT_PRESET_IDS = Object.freeze(['default', 'auto', 'rgb', 'composite', 'grille', 'delta', 'custom']);
const CRT_VISUAL_KEYS = Object.freeze(Object.keys(CRT_DEFAULTS).filter(key => key !== 'quality'));

function clampNumber(value, bounds, fallback) {
    if (!Number.isFinite(value)) return fallback;
    const clamped = Math.min(bounds.max, Math.max(bounds.min, value));
    return Math.round(clamped * 10000) / 10000;
}

function clampInt(value, bounds, fallback) {
    if (!Number.isFinite(value)) return fallback;
    const clamped = Math.min(bounds.max, Math.max(bounds.min, Math.round(value)));
    return clamped;
}

function pickEnum(value, allowed, fallback) {
    return allowed.includes(value) ? value : fallback;
}

export function sanitizeCrtSettings(raw, base = CRT_DEFAULTS) {
    const src = (raw && typeof raw === 'object') ? raw : {};
    return {
        quality: pickEnum(src.quality, CRT_QUALITIES, base.quality),
        maskType: pickEnum(src.maskType, CRT_MASK_TYPES, base.maskType),
        pitch: clampNumber(src.pitch, CRT_BOUNDS.pitch, base.pitch),
        maskStrength: clampNumber(src.maskStrength, CRT_BOUNDS.maskStrength, base.maskStrength),
        scanlineStrength: clampNumber(src.scanlineStrength, CRT_BOUNDS.scanlineStrength, base.scanlineStrength),
        scanlineRows: clampInt(src.scanlineRows, CRT_BOUNDS.scanlineRows, base.scanlineRows),
        beamBlur: clampNumber(src.beamBlur, CRT_BOUNDS.beamBlur, base.beamBlur),
        halation: clampNumber(src.halation, CRT_BOUNDS.halation, base.halation),
        convergence: clampNumber(src.convergence, CRT_BOUNDS.convergence, base.convergence),
        curvature: clampNumber(src.curvature, CRT_BOUNDS.curvature, base.curvature),
        vignette: clampNumber(src.vignette, CRT_BOUNDS.vignette, base.vignette),
        contrast: clampNumber(src.contrast, CRT_BOUNDS.contrast, base.contrast)
    };
}

export function sanitizeOscSettings(raw, base = OSC_DEFAULTS) {
    const src = (raw && typeof raw === 'object') ? raw : {};
    return {
        gain: clampNumber(src.gain, OSC_BOUNDS.gain, base.gain),
        timeWindowMs: clampInt(src.timeWindowMs, OSC_BOUNDS.timeWindowMs, base.timeWindowMs),
        persistence: clampNumber(src.persistence, OSC_BOUNDS.persistence, base.persistence),
        bloom: clampNumber(src.bloom, OSC_BOUNDS.bloom, base.bloom),
        graticule: clampNumber(src.graticule, OSC_BOUNDS.graticule, base.graticule),
        beamMode: pickEnum(src.beamMode, OSC_BEAM_MODES, base.beamMode),
        triggerMode: pickEnum(src.triggerMode, OSC_TRIGGER_MODES, base.triggerMode),
        phosphorTint: pickEnum(src.phosphorTint, OSC_PHOSPHOR_TINTS, base.phosphorTint)
    };
}

export function sanitizeEmuSettings(raw, base = EMU_DEFAULTS) {
    const src = (raw && typeof raw === 'object') ? raw : {};
    const div = Number(src.dseRefreshDivisor);
    return {
        dseRefreshDivisor: DSE_REFRESH_DIVISORS.includes(div) ? div : base.dseRefreshDivisor,
        tensionSpeed: pickEnum(src.tensionSpeed, DSE_TENSION_SPEEDS, base.tensionSpeed),
        sidTemperature: clampInt(src.sidTemperature, EMU_BOUNDS.sidTemperature, base.sidTemperature),
        showLimitBar: typeof src.showLimitBar === 'boolean' ? src.showLimitBar : base.showLimitBar
    };
}

export function toCrtMaskOptions(crtState) {
    const safe = sanitizeCrtSettings(crtState);
    const curvX = safe.curvature;
    const curvY = Math.round(curvX * CURVATURE_Y_RATIO * 10000) / 10000;
    return {
        quality: safe.quality,
        maskType: safe.maskType,
        pitch: safe.pitch,
        maskStrength: safe.maskStrength,
        scanlineStrength: safe.scanlineStrength,
        scanlineRows: safe.scanlineRows,
        beamBlur: safe.beamBlur,
        halation: safe.halation,
        convergence: safe.convergence,
        curvature: [curvX, curvY],
        vignette: safe.vignette,
        contrast: safe.contrast
    };
}

function getDefaultStorage() {
    try {
        if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis && globalThis.localStorage) {
            return globalThis.localStorage;
        }
    } catch {
        return null;
    }
    return null;
}

function loadFromStorage(storage) {
    if (!storage || typeof storage.getItem !== 'function') return null;
    try {
        const raw = storage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return (parsed && typeof parsed === 'object') ? parsed : null;
    } catch {
        return null;
    }
}

function saveToStorage(storage, state) {
    if (!storage || typeof storage.setItem !== 'function') return false;
    try {
        storage.setItem(STORAGE_KEY, JSON.stringify({
            version: 1,
            crtPreset: state.crtPreset,
            crt: state.crt,
            osc: state.osc,
            emu: state.emu
        }));
        return true;
    } catch {
        return false;
    }
}

function isOnlyQualityPatch(patch) {
    if (!patch || typeof patch !== 'object') return false;
    let hasQuality = false;
    for (const key of Object.keys(patch)) {
        if (patch[key] === undefined) continue;
        if (key === 'quality') hasQuality = true;
        else if (CRT_VISUAL_KEYS.includes(key)) return false;
    }
    return hasQuality;
}

export class DisplaySettingsStore {
    constructor(options = {}) {
        const hasCustomStorage = Object.prototype.hasOwnProperty.call(options, 'storage');
        this.storage = hasCustomStorage ? options.storage : getDefaultStorage();
        this.listeners = new Set();
        this.bypassed = false;
        this.crtAvailable = false;

        const saved = loadFromStorage(this.storage);
        const crtPreset = pickEnum(saved?.crtPreset, VALID_CRT_PRESET_IDS, 'default');
        this.state = {
            crtPreset,
            crt: sanitizeCrtSettings(saved?.crt, CRT_DEFAULTS),
            osc: sanitizeOscSettings(saved?.osc, OSC_DEFAULTS),
            emu: sanitizeEmuSettings(saved?.emu, EMU_DEFAULTS)
        };
    }

    getState() {
        return {
            crtPreset: this.state.crtPreset,
            crt: { ...this.state.crt },
            osc: { ...this.state.osc },
            emu: { ...this.state.emu },
            bypassed: this.bypassed,
            crtAvailable: this.crtAvailable
        };
    }

    getPresetCrt(presetId, system = 'c64') {
        if (presetId === 'auto') {
            const sysPresetId = SYSTEM_CRT_PRESETS[system] || 'rgb';
            return { ...CRT_PRESETS[sysPresetId], quality: this.state.crt.quality };
        }
        const preset = CRT_PRESETS[presetId] || CRT_DEFAULTS;
        if (presetId === 'default') return { ...preset };
        return { ...preset, quality: this.state.crt.quality };
    }

    getEffectiveCrt(system = 'c64') {
        if (this.bypassed) {
            return { ...CRT_DEFAULTS };
        }
        if (this.state.crtPreset === 'auto') {
            return this.getPresetCrt('auto', system);
        }
        return { ...this.state.crt };
    }

    getEffectiveOsc() {
        if (this.bypassed) {
            return { ...OSC_DEFAULTS };
        }
        return { ...this.state.osc };
    }

    getEffectiveEmu() {
        if (this.bypassed) {
            return { ...EMU_DEFAULTS };
        }
        return { ...this.state.emu };
    }

    isBypassed() {
        return this.bypassed;
    }

    setBypassed(bypassed) {
        const next = Boolean(bypassed);
        if (next === this.bypassed) return;
        this.bypassed = next;
        this.notify('bypass');
    }

    isCrtAvailable() {
        return this.crtAvailable;
    }

    setCrtAvailable(available) {
        const next = Boolean(available);
        if (next === this.crtAvailable) return;
        this.crtAvailable = next;
        this.notify('availability');
    }

    setCrtPreset(presetId, system = 'c64') {
        if (presetId !== 'auto' && !Object.prototype.hasOwnProperty.call(CRT_PRESETS, presetId)) {
            return;
        }
        this.bypassed = false;
        this.state.crtPreset = presetId;
        this.state.crt = this.getPresetCrt(presetId, system);
        saveToStorage(this.storage, this.state);
        this.notify('crt');
    }

    updateCrt(patch = {}, system = 'c64') {
        if (!patch || typeof patch !== 'object') return;
        const base = this.state.crtPreset === 'auto'
            ? this.getPresetCrt('auto', system)
            : this.state.crt;
        const nextCrt = sanitizeCrtSettings({ ...base, ...patch }, base);
        const keepAutoPreset = this.state.crtPreset === 'auto' && isOnlyQualityPatch(patch);

        this.bypassed = false;
        this.state.crt = nextCrt;
        this.state.crtPreset = keepAutoPreset ? 'auto' : 'custom';
        saveToStorage(this.storage, this.state);
        this.notify('crt');
    }

    updateOsc(patch = {}) {
        if (!patch || typeof patch !== 'object') return;
        this.bypassed = false;
        this.state.osc = sanitizeOscSettings({ ...this.state.osc, ...patch }, this.state.osc);
        saveToStorage(this.storage, this.state);
        this.notify('osc');
    }

    updateEmu(patch = {}) {
        if (!patch || typeof patch !== 'object') return;
        this.bypassed = false;
        this.state.emu = sanitizeEmuSettings({ ...this.state.emu, ...patch }, this.state.emu);
        saveToStorage(this.storage, this.state);
        this.notify('emu');
    }

    resetCrt() {
        this.bypassed = false;
        this.state.crtPreset = 'default';
        this.state.crt = { ...CRT_DEFAULTS };
        saveToStorage(this.storage, this.state);
        this.notify('crt');
    }

    resetOsc() {
        this.bypassed = false;
        this.state.osc = { ...OSC_DEFAULTS };
        saveToStorage(this.storage, this.state);
        this.notify('osc');
    }

    resetEmu() {
        this.bypassed = false;
        this.state.emu = { ...EMU_DEFAULTS };
        saveToStorage(this.storage, this.state);
        this.notify('emu');
    }

    resetAll() {
        this.bypassed = false;
        this.state.crtPreset = 'default';
        this.state.crt = { ...CRT_DEFAULTS };
        this.state.osc = { ...OSC_DEFAULTS };
        this.state.emu = { ...EMU_DEFAULTS };
        saveToStorage(this.storage, this.state);
        this.notify('reset');
    }

    subscribe(listener) {
        if (typeof listener !== 'function') return () => {};
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    notify(reason) {
        if (this.listeners.size === 0) return;
        const snapshot = this.getState();
        const meta = { reason };
        for (const listener of this.listeners) {
            listener(snapshot, meta);
        }
    }
}

export const displaySettings = new DisplaySettingsStore();