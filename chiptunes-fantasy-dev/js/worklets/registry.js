// ==========================================
// EMU CORE REGISTRY (AudioWorklets)
// ==========================================

export const workletRegistry = {
    atari: [
        // NEU: Der PolyBLEP Core ist jetzt der Standard (Index 0)!
        { id: 'ym-exact', name: 'YM2149 (PolyBLEP Anti-Aliasing)', file: 'js/worklets/atari/ym-exact.js', processor: 'ym-exact-processor' },
        { id: 'ym-standard', name: 'YM2149 (Standard)', file: 'js/worklets/atari/ym-worklet.js', processor: 'ym-processor' },
        { id: 'ym-hifi', name: 'YM2149 (Next-Gen Hi-Fi Remaster)', file: 'js/worklets/atari/ym-hifi.js', processor: 'ym-hifi-processor' }
    ],
    c64: [
        { id: 'sid-6581', name: 'MOS SID 6581 (Classic)', file: 'js/worklets/c64/sid-worklet.js', processor: 'sid-processor' }
    ],
    amiga: [
        { id: 'paula-standard', name: 'MOS Paula 8364', file: 'js/worklets/amiga/paula-worklet.js', processor: 'paula-processor' }
    ]
};