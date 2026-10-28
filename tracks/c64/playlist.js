// === tracks/c64/playlist.js ===
// C64 Jukebox Playlist Registry
// 26 preserved legacy paths + 24 researched HVSC #85 classics.

import { loadSidFile } from '../../js/parsers/sid-parser.js';
import { c64MuseumMetadata } from './museum.js';

const legacySidFiles = [
    "Commando.sid",
    "Crazy_Comets.sid",
    "Sanxion.sid",
    "Lightforce.sid",
    "Wizball.sid",
    "Comic_Bakery.sid",
    "Arkanoid.sid",
    "Great_Giana_Sisters.sid",
    "Bionic_Commando.sid",
    "Last_Ninja.sid",
    "Last_Ninja_2.sid",
    "Turbo_Outrun.sid",
    "Cybernoid_II.sid",
    "Supremacy.sid",
    "RoboCop_3.sid",
    "Myth.sid",
    "Monty_on_the_Run.sid",
    "Delta.sid",
    "To_be_on_Top.sid",
    "Rambo_First_Blood_Part_II.sid",
    "Mega_Apocalypse.sid",
    "Miami_Vice.sid",
    "Way_of_the_Tiger.sid",
    "Platoon.sid",
    "Compilation_I.sid",
    "Compilation_II.sid"
];

const classicSidFiles = [
    "classics/games/glider-rider.sid",
    "classics/games/lazy-jones.sid",
    "classics/games/ocean-loader-2.sid",
    "classics/games/ocean-loader-3.sid",
    "classics/games/ocean-loader-4.sid",
    "classics/games/parallax.sid",
    "classics/games/agent-x-ii.sid",
    "classics/games/led-storm.sid",
    "classics/games/ghouls-n-ghosts.sid",
    "classics/games/hawkeye.sid",
    "classics/games/eliminator.sid",
    "classics/games/katakis.sid",
    "classics/games/turrican.sid",
    "classics/games/armalyte.sid",
    "classics/games/citadel.sid",
    "classics/games/creatures-2.sid",
    "classics/games/mayhem-in-monsterland.sid",
    "classics/games/flimbos-quest.sid",
    "classics/games/last-ninja-3.sid",
    "classics/games/ghosts-n-goblins.sid",
    "classics/demoscene/radio-napalm.sid",
    "classics/demoscene/edge-of-disgrace.sid",
    "classics/demoscene/coma-light-13.sid",
    "classics/demoscene/comaland-100-end.sid"
];

export const c64TrackPaths = [...legacySidFiles, ...classicSidFiles];

export const c64Playlist = c64TrackPaths.map((path, index) => {
    const metaInfo = c64MuseumMetadata[path];

    if (!metaInfo) {
        throw new Error(`Fehlender Museumstext für C64-Titel: ${path}`);
    }

    const filename = path.split('/').pop();
    return {
        path,
        title: `${index + 1}. LOAD SID: ${filename}`,
        composerInfo: metaInfo,
        generator: function() { return []; },
        loadAsync: async function() {
            return await loadSidFile(`tracks/c64/${path}`);
        }
    };
});
