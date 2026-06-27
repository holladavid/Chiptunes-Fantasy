// === tracks/amiga/mods.js ===
// ==========================================
// AMIGA MODS PLAYLIST INTERFACE
// ==========================================

import { loadModFile } from '../../js/parsers/mod-parser.js';
import { loadXmFile } from '../../js/parsers/xm-parser.js'; 

const myModFiles = [
    "ELYSIUM.MOD",
    "blood_money_title.mod",
    "agony_intro.mod",
    "moongazr.mod",
    "GSLINGER.MOD",
    "immortal.mod",
    "space_debris.xm",
    "turrican_2_title.xm" 
];

export const externalModTracks = myModFiles.map((filename, index) => {
    const isXm = filename.toLowerCase().endsWith('.xm');
    const label = isXm ? "FASTTRACKER" : "PROTRACKER";

    return {
        title: `${index + 1}. LOAD ${label}: ${filename}`, // Index auf 1-basiert korrigiert!
        composerInfo: ``,
        generator: function() { return []; },
        loadAsync: async function() {
            if (isXm) {
                return await loadXmFile(`tracks/amiga/${filename}`);
            } else {
                return await loadModFile(`tracks/amiga/${filename}`);
            }
        }
    };
});