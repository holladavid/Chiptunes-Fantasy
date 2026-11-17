// === tracks/c64/playlist.js ===
// Kuratierte C64-Jukebox-Playlist (Games, Musicdisks, Demoscene, Tests).

import { loadSidFile } from '../../js/parsers/sid-parser.js';
import { c64MuseumMetadata } from './museum.js';

const c64Tracks = [
    // --- GAMES: 1984–1986 (Die frühen SID-Pioniere) ---
    { path: 'games/lazy-jones.sid',                  category: 'games',      listTitle: 'Lazy Jones' },
    { path: 'games/commando.sid',                    category: 'games',      listTitle: 'Commando' },
    { path: 'games/monty-on-the-run.sid',            category: 'games',      listTitle: 'Monty on the Run' },
    { path: 'games/crazy-comets.sid',                category: 'games',      listTitle: 'Crazy Comets' },
    { path: 'games/ocean-loader-1.sid', category: 'games', listTitle: 'Ocean Loader 1' },
    { path: 'games/ocean-loader-2.sid',              category: 'games',      listTitle: 'Ocean Loader 2' },
    { path: 'games/sanxion.sid',                     category: 'games',      listTitle: 'Sanxion' },
    { path: 'games/lightforce.sid',                  category: 'games',      listTitle: 'Lightforce' },
    { path: 'games/comic-bakery.sid',                category: 'games',      listTitle: 'Comic Bakery' },
    { path: 'games/miami-vice.sid',                  category: 'games',      listTitle: 'Miami Vice' },
    { path: 'games/rambo-first-blood-part-ii.sid',   category: 'games',      listTitle: 'Rambo: First Blood Part II' },
    { path: 'games/parallax.sid',                    category: 'games',      listTitle: 'Parallax' },
    { path: 'games/way-of-the-tiger.sid',            category: 'games',      listTitle: 'Way of the Tiger' },
    { path: 'games/ghosts-n-goblins.sid',            category: 'games',      listTitle: 'Ghosts ’n Goblins' },
    { path: 'games/glider-rider.sid',                category: 'games',      listTitle: 'Glider Rider' },

    // --- GAMES: 1987–1989 (Goldenes Zeitalter & Digi-Samples) ---
    { path: 'games/delta.sid',          category: 'games', listTitle: 'Delta' },
    { path: 'games/wizball.sid',                     category: 'games',      listTitle: 'Wizball' },
    { path: 'games/arkanoid.sid',                    category: 'games',      listTitle: 'Arkanoid' },
    { path: 'games/ocean-loader-3.sid',              category: 'games',      listTitle: 'Ocean Loader 3' },
    { path: 'games/mega-apocalypse.sid',             category: 'games',      listTitle: 'Mega Apocalypse' },
    { path: 'games/last-ninja.sid',                  category: 'games',      listTitle: 'The Last Ninja' },
    { path: 'games/great-giana-sisters.sid',         category: 'games',      listTitle: 'The Great Giana Sisters' },
    { path: 'games/to-be-on-top.sid',                category: 'games',      listTitle: 'To Be on Top' },
    { path: 'games/agent-x-ii.sid',                  category: 'games',      listTitle: 'Agent X II' },
    { path: 'games/ocean-loader-4.sid',              category: 'games',      listTitle: 'Ocean Loader 4' },
    { path: 'games/platoon.sid',                     category: 'games',      listTitle: 'Platoon' },
    { path: 'games/bionic-commando.sid',             category: 'games',      listTitle: 'Bionic Commando' },
    { path: 'games/last-ninja-2.sid',                category: 'games',      listTitle: 'Last Ninja 2' },
    { path: 'games/cybernoid-ii.sid',                category: 'games',      listTitle: 'Cybernoid II' },
    { path: 'games/hawkeye.sid',                     category: 'games',      listTitle: 'Hawkeye' },
    { path: 'games/katakis.sid',                     category: 'games',      listTitle: 'Katakis' },
    { path: 'games/armalyte.sid',                    category: 'games',      listTitle: 'Armalyte' },
    { path: 'games/turbo-outrun.sid',                category: 'games',      listTitle: 'Turbo OutRun' },
    { path: 'games/myth.sid',                        category: 'games',      listTitle: 'Myth' },
    { path: 'games/eliminator.sid',                  category: 'games',      listTitle: 'Eliminator' },
    { path: 'games/led-storm.sid',                   category: 'games',      listTitle: 'L.E.D. Storm' },
    { path: 'games/ghouls-n-ghosts.sid',             category: 'games',      listTitle: 'Ghouls ’n’ Ghosts' },
    { path: 'games/citadel.sid',                     category: 'games',      listTitle: 'Citadel' },

    // --- GAMES: 1990–1993 (Spätphase) ---
    { path: 'games/turrican.sid',                    category: 'games',      listTitle: 'Turrican' },
    { path: 'games/flimbos-quest.sid',               category: 'games',      listTitle: 'Flimbo’s Quest' },
    { path: 'games/last-ninja-3.sid',                category: 'games',      listTitle: 'Last Ninja 3' },
    { path: 'games/supremacy.sid',                   category: 'games',      listTitle: 'Supremacy' },
    { path: 'games/robocop-3.sid',                   category: 'games',      listTitle: 'RoboCop 3' },
    { path: 'games/creatures-2.sid',                 category: 'games',      listTitle: 'Creatures 2' },
    { path: 'games/mayhem-in-monsterland.sid',       category: 'games',      listTitle: 'Mayhem in Monsterland' },

    // --- MUSICDISKS (1988–1989) ---
    { path: 'musicdisks/compilation-i.sid',          category: 'musicdisks', listTitle: 'Compilation I' },
    { path: 'musicdisks/compilation-iii.sid',        category: 'musicdisks', listTitle: 'Compilation III' },

    // --- DEMOSCENE (1989–2024) ---
    { path: 'demoscene/delta-tomas-danko.sid',       category: 'demoscene',  listTitle: 'Delta (Tomas Danko Reinterpretation)' },
    { path: 'demoscene/radio-napalm.sid',            category: 'demoscene',  listTitle: 'Radio Napalm' },
    { path: 'demoscene/edge-of-disgrace.sid',        category: 'demoscene',  listTitle: 'Edge of Disgrace' },
    { path: 'demoscene/coma-light-13-tune-1.sid',    category: 'demoscene',  listTitle: 'Coma Light 13 – Tune 1' },
    { path: 'demoscene/playhorse.sid',               category: 'demoscene',  listTitle: 'Assembly 2012 · Conservative Megademo – Playhorse' },
    { path: 'demoscene/comaland-100-facetime.sid',   category: 'demoscene',  listTitle: 'Comaland 100% – FaceTime' },
    { path: 'demoscene/nine-nights-from-the-black-moon.sid', category: 'demoscene', listTitle: 'Assembly 2020 · Fantomas – Nine Nights from the Black Moon' },
    { path: 'demoscene/scroll-of-antonius.sid',      category: 'demoscene',  listTitle: 'Assembly 2023 · The Scroll of Antonius' },
    { path: 'demoscene/transcend-the-game.sid',      category: 'demoscene',  listTitle: 'Assembly 2024 · Transcend the Game' },

    // --- TECHNIK / EMULATIONS-TEST ---
    { path: 'tests/sid-emulation-test.sid',          category: 'tests',      listTitle: 'SID Emulation Test Suite' }
];

export const c64TrackPaths = c64Tracks.map(track => track.path);

export const c64Playlist = c64Tracks.map((track, index) => {
    const metaInfo = c64MuseumMetadata[track.path];

    if (!metaInfo) {
        throw new Error(`Fehlender Museumstext für C64-Titel: ${track.path}`);
    }

    const filename = track.path.split('/').pop();
    return {
        path: track.path,
        category: track.category,
        title: `${index + 1}. LOAD SID: ${filename}`,
        listTitle: track.listTitle,
        composerInfo: metaInfo,
        generator: function() { return []; },
        loadAsync: async function() {
            return await loadSidFile(`tracks/c64/${track.path}`);
        }
    };
});