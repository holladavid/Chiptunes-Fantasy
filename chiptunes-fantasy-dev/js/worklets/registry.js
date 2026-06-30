// === js/worklets/registry.js ===
// ==========================================
// EMU CORE REGISTRY (AudioWorklets)
// ==========================================

export const workletRegistry = {
    atari: [
        { id: 'ym-exact', name: 'YM2149 (2MHz True Lockstep)', cpu: 4, file: 'js/worklets/atari/ym-exact.js', processor: 'ym-exact-processor' },
        { id: 'ym-standard', name: 'YM2149 (Standard)', cpu: 1, file: 'js/worklets/atari/ym-standard.js', processor: 'ym-processor' },
        { id: 'ym-fantasy', name: 'YM2149 (Chiptunes Fantasy)', cpu: 4, file: 'js/worklets/atari/ym-fantasy.js', processor: 'ym-fantasy-processor' },
        { id: 'ym-bladerunner', name: 'YM2149 (Blade Runner Cinematic)', cpu: 4, file: 'js/worklets/atari/ym-bladerunner.js', processor: 'ym-bladerunner-processor' }
    ],
    c64: [
        { id: 'sid-exact', name: 'SID 6581 (1MHz True Analog)', cpu: 4, file: 'js/worklets/c64/sid-exact.js', processor: 'sid-exact-processor' },
        { id: 'sid-standard', name: 'SID 6581 (Digital Fast)', cpu: 2, file: 'js/worklets/c64/sid-standard.js', processor: 'sid-standard-processor' }
    ],
    amiga: [
        { id: 'paula-exact', name: 'MOS Paula 8364 (Analog Dirt & Sync)', cpu: 3, file: 'js/worklets/amiga/paula-exact.js', processor: 'paula-exact-processor' },
        { id: 'paula-standard', name: 'MOS Paula 8364 (Digital Clean)', cpu: 2, file: 'js/worklets/amiga/paula-standard.js', processor: 'paula-standard-processor' }
    ]
};