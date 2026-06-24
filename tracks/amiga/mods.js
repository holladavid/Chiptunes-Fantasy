import { loadModFile } from '../../js/parsers/mod-parser.js';
import { loadXmFile } from '../../js/parsers/xm-parser.js'; // Den XM-Parser dazu importieren

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
    // Endung prüfen (case-insensitive)
    const isXm = filename.toLowerCase().endsWith('.xm');
    const label = isXm ? "FASTTRACKER" : "PROTRACKER";

    return {
        title: `${index + 2}. LOAD ${label}: ${filename}`,
        composerInfo: ``,
        generator: function() { return []; },
        loadAsync: async function() {
            // Smart Routing: Wähle automatisch den korrekten Parser!
            if (isXm) {
                return await loadXmFile(`tracks/amiga/${filename}`);
            } else {
                return await loadModFile(`tracks/amiga/${filename}`);
            }
        }
    };
});