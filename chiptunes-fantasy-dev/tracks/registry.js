import { hubbardTrack } from './c64/hubbard.js';
import { galwayTrack } from './c64/galway.js';
import { hippelTrack } from './atari/hippel.js';
import { bigAlecTrack } from './atari/bigalec.js';
import { jesterTrack } from './amiga/jester.js';

export const trackRegistry = {
    c64: [ hubbardTrack, galwayTrack ],
    atari: [ hippelTrack, bigAlecTrack ],
    amiga: [ jesterTrack ]
};