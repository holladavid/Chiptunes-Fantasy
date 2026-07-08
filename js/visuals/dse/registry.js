// === js/visuals/dse/registry.js ===
// =========================================================
// DEMO-SCENE-ELEMENT (DSE) REGISTRY & METADATA SCHEMAS
// Centralized configuration file acting as a single source 
// of truth for all orchestration, limits, and weights.
// =========================================================

import { LimitBar } from './universal/limit-bar.js';
import { Copperbars } from './universal/copperbars.js';
import { VoidElement } from './universal/void-element.js'; // NEU: Universeller Platzhalter
import { RetroSunset } from './universal/retro-sunset.js';
import { Starfield } from './universal/starfield.js'; 
import { AmigaCube } from './amiga/glenz-cube.js';
import { AtariBobs } from './atari/lissajous-bobs.js';
import { ChunkyPlasma } from './c64/chunky-plasma.js';

function defineDSE(DseClass, customMetadata) {
    const defaults = {
        name: DseClass.name,
        computerType: ['all'],                  
        placementType: 'foreground',            
        energyLevel: ['idle', 'playing', 'buildup', 'climax'],
        weight: 10,                             
        minPlayTime: 15.0,                      
        climaxHoldTime: 10.0,
        isVoid: false // NEU: Standardmäßig ist ein Element sichtbar (kein Void)
    };

    const metadata = { ...defaults, ...customMetadata };

    if (!Array.isArray(metadata.computerType)) throw new Error(`[DSE Schema] ${metadata.name}: 'computerType' must be an Array.`);
    const validPlacements = ['background', 'floor', 'foreground', 'overlay'];
    if (!validPlacements.includes(metadata.placementType)) throw new Error(`[DSE Schema] ${metadata.name}: Invalid placementType.`);
    if (typeof metadata.isVoid !== 'boolean') throw new Error(`[DSE Schema] ${metadata.name}: 'isVoid' must be a Boolean.`);
    if (typeof metadata.weight !== 'number' || metadata.weight <= 0) throw new Error(`[DSE Schema] ${metadata.name}: 'weight' must be a positive Number.`);

    return { Class: DseClass, metadata: metadata };
}

export const dseRegistry = [
    
    // --- OVERLAYS ---
    defineDSE(LimitBar, {
        placementType: 'overlay',
        computerType: ['all'],
        weight: 1,                
        minPlayTime: Infinity,    
        climaxHoldTime: 0.0
    }),

    // --- BACKGROUNDS (Tauschen sich nun gegenseitig aus!) ---
    defineDSE(Starfield, {
        placementType: 'background',
        computerType: ['all'], 
        weight: 7,               
        minPlayTime: 15.0,
        climaxHoldTime: 8.0
    }),
    
    defineDSE(RetroSunset, {
        placementType: 'background',
        computerType: ['all'],
        weight: 10,              
        minPlayTime: 15.0,
        climaxHoldTime: 12.0
    }),

        defineDSE(ChunkyPlasma, {
        placementType: 'background',
        computerType: ['c64'],   // Wird NUR getriggert, wenn C64 aktiv ist
        weight: 12,              // Hohe Gewichtung, taucht oft auf
        minPlayTime: 12.0,
        climaxHoldTime: 10.0
    }),

    defineDSE(VoidElement, {
        name: 'VoidBackground', // Weist der universellen Klasse einen spezifischen Namen zu
        placementType: 'background',
        computerType: ['all'],
        weight: 5,              // Geringeres Gewicht = seltener als echte Grafik-Hintergründe
        minPlayTime: 15.0,
        climaxHoldTime: 0.0,
        isVoid: true            // Als Void-Element markiert
    }),

    // --- FLOORS (Tauschen sich nun gegenseitig aus!) ---
    defineDSE(Copperbars, {
        placementType: 'floor',
        computerType: ['all'],
        weight: 8,               
        minPlayTime: 15.0,
        climaxHoldTime: 12.0
    }),

    defineDSE(VoidElement, {
        name: 'VoidFloor',
        placementType: 'floor',
        computerType: ['all'],
        weight: 8,               
        minPlayTime: 15.0,
        climaxHoldTime: 0.0,
        isVoid: true
    }),
    
    // --- FOREGROUNDS (Tauschen sich nun gegenseitig aus!) ---
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
    }),

    defineDSE(VoidElement, {
        name: 'VoidForeground',
        placementType: 'foreground',
        computerType: ['all'],
        weight: 5,               
        minPlayTime: 15.0,
        climaxHoldTime: 0.0,
        isVoid: true
    })
];