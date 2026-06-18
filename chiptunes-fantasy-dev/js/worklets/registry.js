// ==========================================
// EMU CORE REGISTRY (AudioWorklets)
// ==========================================

export const workletRegistry = {
    atari: [
        { id: 'ym-standard', name: 'YM2149 (Standard Core)', file: 'js/worklets/atari/ym-worklet.js', processor: 'ym-processor' }
        // Später: { id: 'ym-exact', name: 'YM2149 (Cycle Exact)', file: 'js/worklets/atari/ym-exact.js', processor: 'ym-exact-processor' }
    ],
    c64: [
        { id: 'sid-6581', name: 'MOS SID 6581 (Old)', file: 'js/worklets/c64/sid-worklet.js', processor: 'sid-processor' },
        { id: 'sid-8580', name: 'MOS SID 8580 (New)', file: 'js/worklets/c64/sid-worklet.js', processor: 'sid-processor' } // Placeholder für später
    ],
    amiga: [
        { id: 'paula-standard', name: 'MOS Paula 8364', file: 'js/worklets/amiga/paula-worklet.js', processor: 'paula-processor' }
    ]
};