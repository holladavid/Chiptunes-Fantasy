// === js/visuals/dse/registry.js ===
// =========================================================
// DEMO-SCENE-ELEMENT (DSE) REGISTRY & METADATA SCHEMAS
// Centralized configuration file acting as a single source 
// of truth for all orchestration, limits, and weights.
// =========================================================

import { LimitBar } from './universal/limit-bar.js';
import { Copperbars } from './universal/copperbars.js';
import { VoidFloor } from './universal/void-floor.js'; // NEU
import { RetroSunset } from './universal/retro-sunset.js';
import { Starfield } from './universal/starfield.js'; 
import { AmigaCube } from './amiga/glenz-cube.js';
import { AtariBobs } from './atari/lissajous-bobs.js';

function defineDSE(DseClass, customMetadata) {
    const defaults = {
        name: DseClass.name,
        computerType: ['all'],                  
        placementType: 'foreground',            
        energyLevel: ['idle', 'playing', 'buildup', 'climax'],
        weight: 10,                             // NEU: Relatives Gewicht (Standard 10)
        minPlayTime: 15.0,                      
        climaxHoldTime: 10.0                    
    };

    const metadata = { ...defaults, ...customMetadata };

    if (!Array.isArray(metadata.computerType)) throw new Error(`[DSE Schema] ${metadata.name}: 'computerType' must be an Array.`);
    const validPlacements = ['background', 'floor', 'foreground', 'overlay'];
    if (!validPlacements.includes(metadata.placementType)) throw new Error(`[DSE Schema] ${metadata.name}: Invalid placementType.`);
    
    // Validierung für das relative Gewicht
    if (typeof metadata.weight !== 'number' || metadata.weight <= 0) {
        throw new Error(`[DSE Schema] ${metadata.name}: 'weight' must be a positive Number.`);
    }

    return { Class: DseClass, metadata: metadata };
}

export const dseRegistry = [
    
    // --- OVERLAYS ---
    defineDSE(LimitBar, {
        placementType: 'overlay',
        computerType: ['all'],
        weight: 1,                // Da einziges Element auf Overlay, ist das Gewicht egal
        minPlayTime: Infinity,    // Wird niemals wegrotiert (Permanentes Schloss!)
        climaxHoldTime: 0.0
    }),

    // --- BACKGROUNDS ---
    defineDSE(Starfield, {
        placementType: 'background',
        computerType: ['all'], 
        weight: 7,               // Etwas seltener als der Sunset
        minPlayTime: 15.0,
        climaxHoldTime: 8.0
    }),
    
    defineDSE(RetroSunset, {
        placementType: 'background',
        computerType: ['all'],
        weight: 10,              // Höheres Gewicht = Taucht häufiger auf
        minPlayTime: 15.0,
        climaxHoldTime: 12.0
    }),

    // --- FLOORS (Tauschen sich nun gegenseitig aus!) ---
    defineDSE(Copperbars, {
        placementType: 'floor',
        computerType: ['all'],
        weight: 8,               // 50/50 Chance gegen den leeren VoidFloor
        minPlayTime: 15.0,
        climaxHoldTime: 12.0
    }),

    defineDSE(VoidFloor, {
        placementType: 'floor',
        computerType: ['all'],
        weight: 8,               // Gleiches Gewicht = Gleiche Chance wie Copperbars
        minPlayTime: 15.0,
        climaxHoldTime: 0.0
    }),
    
    // --- FOREGROUNDS ---
    defineDSE(AmigaCube, {
        placementType: 'foreground',
        computerType: ['amiga'],
        weight: 10,
        minPlayTime: 15.0,
        climaxHoldTime: 15.0
    }),
    
    defineDSE(AtariBobs, {
        placementType: 'foreground',
        computerType: ['atari'],
        weight: 10,
        minPlayTime: 15.0,
        climaxHoldTime: 10.0
    })
];