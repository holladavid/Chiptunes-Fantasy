// === tracks/registry.js ===
// ==========================================
// CENTRAL TRACK PLAYLIST REGISTRY
// ==========================================

import { externalSidTracks } from './c64/external.js'; 
import { externalYmTracks } from './atari/external.js'; 
import { externalModTracks } from './amiga/mods.js'; 

export const trackRegistry = {
    c64: [ ...externalSidTracks ],
    atari: [ ...externalYmTracks ], 
    amiga: [ ...externalModTracks ]
};