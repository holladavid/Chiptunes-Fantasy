import { loadHipcFile } from '../../js/parsers/hipc-parser.js';

const myHipcFiles = [
    "Wings_Of_Death_Level_1.hipc",
    "Wings_Of_Death_Level_2.hipc",
    "Wings_Of_Death_Level_3.hipc",
    "Wings_Of_Death_Level_4.hipc",
    "Wings_Of_Death_Level_5.hipc",
    "Wings_Of_Death_Level_6.hipc",
    "Wings_Of_Death_Level_7.hipc"
];

// Automatische Generierung der Playlist-Einträge
export const externalHipcTracks = myHipcFiles.map((filename, index) => {
    return {
        title: `${index + 2}. LOAD ORIGINAL: ${filename}`,
        composerInfo: ``, // Wird dynamisch im Museum gefüllt
        generator: function() { return []; },
        loadAsync: async function() {
            return await loadHipcFile(`tracks/amiga/${filename}`);
        }
    };
});