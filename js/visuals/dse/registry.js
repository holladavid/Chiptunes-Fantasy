// === js/visuals/dse/registry.js ===
// =========================================================
// DEMO-SCENE-ELEMENT (DSE) REGISTRY & METADATA SCHEMAS
// Centralized configuration file acting as a single source 
// of truth for all orchestration, limits, and probabilities.
// =========================================================

import { LimitBar } from './universal/limit-bar.js';
import { Copperbars } from './universal/copperbars.js';
import { RetroSunset } from './universal/retro-sunset.js';
import { C64Starfield } from './c64/starfield.js';
import { AmigaCube } from './amiga/glenz-cube.js';
import { AtariBobs } from './atari/lissajous-bobs.js';

function defineDSE(DseClass, customMetadata) {
    const defaults = {
        name: DseClass.name,
        computerType: ['all'],                  
        placementType: 'foreground',            
        energyLevel: ['idle', 'quiet', 'medium', 'crazy'],
        triggerProbability: 0.5,                
        minPlayTime: 15.0, // Erhöht auf 15s für stabile Szenen
        climaxHoldTime: 10.0                    
    };

    const metadata = { ...defaults, ...customMetadata };

    if (!Array.isArray(metadata.computerType)) throw new Error(`[DSE Schema] ${metadata.name}: 'computerType' must be an Array.`);
    const validPlacements = ['background', 'floor', 'foreground', 'overlay'];
    if (!validPlacements.includes(metadata.placementType)) throw new Error(`[DSE Schema] ${metadata.name}: Invalid placementType.`);
    if (metadata.triggerProbability < 0.0 || metadata.triggerProbability > 1.0) throw new Error(`[DSE Schema] ${metadata.name}: Invalid probability.`);

    return { Class: DseClass, metadata: metadata };
}

export const dseRegistry = [
    
    // --- OVERLAYS ---
    defineDSE(LimitBar, {
        placementType: 'overlay',
        computerType: ['all'],
        triggerProbability: 1.0,  
        minPlayTime: Infinity,    
        climaxHoldTime: 0.0
    }),

    // --- BACKGROUNDS ---
    defineDSE(C64Starfield, {
        placementType: 'background',
        computerType: ['c64'],
        triggerProbability: 0.7,
        minPlayTime: 15.0,
        climaxHoldTime: 8.0
    }),
    
    defineDSE(RetroSunset, {
        placementType: 'background',
        computerType: ['all'],
        triggerProbability: 0.8, 
        minPlayTime: 15.0,
        climaxHoldTime: 12.0
    }),

    // --- FLOORS ---
    defineDSE(Copperbars, {
        placementType: 'floor',
        computerType: ['all'],
        triggerProbability: 0.8,
        minPlayTime: 15.0,
        climaxHoldTime: 12.0
    }),
    
    // --- FOREGROUNDS ---
    defineDSE(AmigaCube, {
        placementType: 'foreground',
        computerType: ['amiga'],
        triggerProbability: 0.7,
        minPlayTime: 15.0,
        climaxHoldTime: 15.0
    }),
    
    defineDSE(AtariBobs, {
        placementType: 'foreground',
        computerType: ['atari'],
        triggerProbability: 0.7,
        minPlayTime: 15.0,
        climaxHoldTime: 10.0
    })
];