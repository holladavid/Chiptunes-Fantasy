// === js/visuals/dse/registry.js ===
// =========================================================
// DEMO-SCENE-ELEMENT (DSE) REGISTRY
// Füge hier neue Effekte hinzu. Der Scene-DJ instanziiert und 
// orchestriert sie automatisch basierend auf ihren Metadaten.
// =========================================================

import { LimitBar } from './universal/limit-bar.js';
import { Copperbars } from './universal/copperbars.js';
import { C64Starfield } from './c64/starfield.js';
import { AmigaCube } from './amiga/glenz-cube.js';
import { AtariBobs } from './atari/lissajous-bobs.js';

export const dseRegistry = [
    // --- UNIVERSAL OVERLAYS ---
    LimitBar,

    // --- UNIVERSAL GIMMICKS ---
    Copperbars,
    
    // --- C64 ---
    C64Starfield,
    
    // --- AMIGA ---
    AmigaCube,
    
    // --- ATARI ST ---
    AtariBobs
];