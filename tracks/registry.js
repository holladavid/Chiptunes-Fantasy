import { externalSidTracks } from './c64/external.js'; // Binärer SID-Lader

import { hippelTrack } from './atari/hippel.js';
import { bigAlecTrack } from './atari/bigalec.js';
import { externalYmTracks } from './atari/external.js'; 

import { jesterTrack } from './amiga/jester.js'; 
import { externalModTracks } from './amiga/mods.js'; 

export const trackRegistry = {
    // 100% echter, binärer C64-Wiedergabe-Zweig (Nativ über die emulierte 6502-CPU!)
    c64: [ ...externalSidTracks ],
    
    atari: [ hippelTrack, bigAlecTrack, ...externalYmTracks ], 
    amiga: [ jesterTrack, ...externalModTracks ]
};