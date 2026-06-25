import { loadSidFile } from '../../js/parsers/sid-parser.js';

const mySidFiles = [
    "commando.sid",
    "monty_on_the_run.sid",
    "delta.sid",
    "wizball.sid",
    "great_giana_sisters.sid" // NEU: Chris Hülsbecks Meisterwerk!
];

export const externalSidTracks = mySidFiles.map((filename, index) => {
    return {
        title: `${index + 1}. LOAD SID: ${filename}`, // Index auf 1 basierend korrigiert
        composerInfo: ``,
        generator: function() { return []; },
        loadAsync: async function() {
            return await loadSidFile(`tracks/c64/${filename}`);
        }
    };
});