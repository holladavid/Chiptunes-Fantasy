import { loadYmFile } from '../../js/parsers/ym-parser.js';

// HIER EINFACH ALLE DATEINAMEN EINTRAGEN, DIE IN DEINEM ORDNER LIEGEN!
const myYmFiles = [
    "thalion_loader.YM",           // Dein erster Test-Song
    "turrican1_world_1_1.YM",      // Lade hier deine entpackten Lieblingstracks rein...
    "WINGLEV1.YM",               // ...
    "GOLDRUN.YM",
    "spherical_intro.YM"
];

// Wir generieren mit .map() automatisch für jeden Namen einen fertigen Track-Eintrag!
export const externalYmTracks = myYmFiles.map((filename, index) => {
    return {
        title: `${index + 3}. LOAD ORIGINAL: ${filename}`,
        composerInfo: ``, // Bleibt leer, die app.js übernimmt jetzt!
        generator: function() { return []; },
        loadAsync: async function() {
            return await loadYmFile(`tracks/atari/${filename}`);
        }
    };
});