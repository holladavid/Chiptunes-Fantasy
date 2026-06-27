// === js/worklets/registry.js ===
// ==========================================
// EMU CORE REGISTRY (AudioWorklets)
// ==========================================

export const workletRegistry = {
    atari: [
        { id: 'ym-exact', name: 'YM2149 (PolyBLEP Anti-Aliasing)', cpu: 2, file: 'js/worklets/atari/ym-exact.js', processor: 'ym-exact-processor' },
        { id: 'ym-standard', name: 'YM2149 (Standard)', cpu: 1, file: 'js/worklets/atari/ym-standard.js', processor: 'ym-processor' },
        { id: 'ym-fantasy', name: 'YM2149 (Chiptunes Fantasy)', cpu: 4, file: 'js/worklets/atari/ym-fantasy.js', processor: 'ym-fantasy-processor' },
        { id: 'ym-bladerunner', name: 'YM2149 (Blade Runner Cinematic)', cpu: 4, file: 'js/worklets/atari/ym-bladerunner.js', processor: 'ym-bladerunner-processor' }
    ],
    c64: [
        { id: 'sid-6581', name: 'MOS SID 6581 (Classic)', cpu: 3, file: 'js/worklets/c64/sid-worklet.js', processor: 'sid-processor' }
    ],
    amiga: [
        // Index 0 wird automatisch als Default geladen!
        { id: 'paula-standard', name: 'MOS Paula 8364 (Standard)', cpu: 2, file: 'js/worklets/amiga/paula-standard.js', processor: 'paula-standard-processor' },
        { id: 'paula-exact', name: 'MOS Paula 8364 (Analog Dirt & Sync)', cpu: 3, file: 'js/worklets/amiga/paula-exact.js', processor: 'paula-exact-processor' }
    ]
};