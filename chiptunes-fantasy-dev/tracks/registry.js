// === tracks/registry.js ===
// ==========================================
// CENTRAL TRACK PLAYLIST REGISTRY
// ==========================================

import { externalSidTracks } from './c64/external.js'; 

import { hippelTrack } from './atari/hippel.js';
import { bigAlecTrack } from './atari/bigalec.js';
import { externalYmTracks } from './atari/external.js'; 

import { externalModTracks } from './amiga/mods.js'; // Jester gelöscht!

export const trackRegistry = {
    c64: [ ...externalSidTracks ],
    atari: [ hippelTrack, bigAlecTrack, ...externalYmTracks ], 
    amiga: [ ...externalModTracks ]
};