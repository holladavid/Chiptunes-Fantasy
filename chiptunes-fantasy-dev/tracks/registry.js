import { hubbardTrack } from './c64/hubbard.js';
import { galwayTrack } from './c64/galway.js';
import { hippelTrack } from './atari/hippel.js';
import { bigAlecTrack } from './atari/bigalec.js';
import { externalYmTracks } from './atari/external.js'; 
import { jesterTrack } from './amiga/jester.js'; 
import { externalHipcTracks } from './amiga/external.js'; // Buggy
import { externalModTracks } from './amiga/mods.js';

export const trackRegistry = {
    c64: [ hubbardTrack, galwayTrack ],
    atari: [ hippelTrack, bigAlecTrack, ...externalYmTracks ], 
    amiga: [ jesterTrack, ...externalModTracks ]
};