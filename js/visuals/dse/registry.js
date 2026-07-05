// === js/visuals/dse/registry.js ===
// =========================================================
// DEMO-SCENE-ELEMENT (DSE) REGISTRY & METADATA SCHEMAS
// Centralized configuration file acting as a single source 
// of truth for all orchestration, limits, and probabilities.
// =========================================================

import { LimitBar } from './universal/limit-bar.js';
import { Copperbars } from './universal/copperbars.js';
import { C64Starfield } from './c64/starfield.js';
import { AmigaCube } from './amiga/glenz-cube.js';
import { AtariBobs } from './atari/lissajous-bobs.js';

/**
 * Hilfsfunktion zur Durchsetzung eines strikten Metadaten-Vertrags (Schema Validation)
 * Verhindert Schema-Drift und füllt Standardwerte automatisch auf.
 */
function defineDSE(DseClass, customMetadata) {
    const defaults = {
        name: DseClass.name,
        computerType: ['all'],                  // 'c64', 'amiga', 'atari', 'all'
        placementType: 'foreground',            // 'background', 'floor', 'foreground', 'overlay'
        energyLevel: ['idle', 'quiet', 'medium', 'crazy'],
        triggerProbability: 0.5,                // 0.0 bis 1.0 (1.0 = permanent geschützt)
        minPlayTime: 5.0,                       // Mindestlaufzeit in Sekunden, bevor ein Swap erlaubt ist
        climaxHoldTime: 10.0                    // Standard Climax Nachbrennzeit
    };

    const metadata = { ...defaults, ...customMetadata };

    // Strikte Validierungsregeln zur Entwicklungszeit (Defensive Programming)
    if (!Array.isArray(metadata.computerType)) {
        throw new Error(`[DSE Schema Violation] ${metadata.name}: 'computerType' must be an Array.`);
    }
    const validPlacements = ['background', 'floor', 'foreground', 'overlay'];
    if (!validPlacements.includes(metadata.placementType)) {
        throw new Error(`[DSE Schema Violation] ${metadata.name}: Invalid 'placementType' [${metadata.placementType}].`);
    }
    if (metadata.triggerProbability < 0.0 || metadata.triggerProbability > 1.0) {
        throw new Error(`[DSE Schema Violation] ${metadata.name}: 'triggerProbability' must be between 0.0 and 1.0.`);
    }

    return {
        Class: DseClass,
        metadata: metadata
    };
}

// =========================================================
// CENTRAL REGISTRY TABLE (Der "Spielplan" des DJs)
// =========================================================
export const dseRegistry = [
    
    // --- OVERLAYS ---
    defineDSE(LimitBar, {
        placementType: 'overlay',
        computerType: ['all'],
        triggerProbability: 1.0,  // Immer aktiv (100% Wahrscheinlichkeit)
        minPlayTime: Infinity,    // Wird niemals freiwillig wegrotiert
        climaxHoldTime: 0.0
    }),

    // --- FLOORS / BACKGROUNDS ---
    defineDSE(Copperbars, {
        placementType: 'floor',
        computerType: ['all'],
        triggerProbability: 0.8,
        minPlayTime: 8.0,
        climaxHoldTime: 12.0
    }),
    
    defineDSE(C64Starfield, {
        placementType: 'background',
        computerType: ['c64'],
        triggerProbability: 0.7,
        minPlayTime: 6.0,
        climaxHoldTime: 8.0
    }),
    
    // --- FOREGROUNDS ---
    defineDSE(AmigaCube, {
        placementType: 'foreground',
        computerType: ['amiga'],
        triggerProbability: 0.7,
        minPlayTime: 10.0,
        climaxHoldTime: 15.0
    }),
    
    defineDSE(AtariBobs, {
        placementType: 'foreground',
        computerType: ['atari'],
        triggerProbability: 0.7,
        minPlayTime: 10.0,
        climaxHoldTime: 10.0
    })
];