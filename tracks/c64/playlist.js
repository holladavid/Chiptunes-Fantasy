// === tracks/c64/playlist.js ===
// C64 Jukebox Playlist Registry
// 26 preserved legacy paths + 24 researched HVSC #85 classics + 4 Assembly winners.

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

// Gesamtsieger der Assembly Oldskool-/Mixed-Demo-Competition auf dem C64.
// Nicht jede jährliche Siegerproduktion war eine C64-Produktion; die Lücken
// 2006–2011, 2013–2019, 2021, 2022 und 2025 sind deshalb beabsichtigt.
const assemblySidFiles = [
    "assembly/playhorse.sid",
    "assembly/nine-nights-from-the-black-moon.sid",
    "assembly/scroll-of-antonius.sid",
    "assembly/transcend-the-game.sid"
];

export const c64TrackPaths = [...legacySidFiles, ...classicSidFiles, ...assemblySidFiles];

// Kuratierte Titel für die Auswahlliste. Der historische Dateipfad bleibt
// erhalten, auch wenn er – wie bei Compilation III und zwei Demo-SIDs – vom
// tatsächlichen Inhalt der Datei abweicht.
const c64ListTitles = [
    'Commando',
    'Crazy Comets',
    'Sanxion',
    'Lightforce',
    'Wizball',
    'Comic Bakery',
    'Arkanoid',
    'The Great Giana Sisters',
    'Bionic Commando',
    'The Last Ninja',
    'Last Ninja 2',
    'Turbo OutRun',
    'Cybernoid II',
    'Supremacy',
    'RoboCop 3',
    'Myth',
    'Monty on the Run',
    'Delta',
    'To Be on Top',
    'Rambo: First Blood Part II',
    'Mega Apocalypse',
    'Miami Vice',
    'Way of the Tiger',
    'Platoon',
    'Compilation I',
    'Compilation III',
    'Glider Rider',
    'Lazy Jones',
    'Ocean Loader 2',
    'Ocean Loader 3',
    'Ocean Loader 4',
    'Parallax',
    'Agent X II',
    'L.E.D. Storm',
    'Ghouls ’n’ Ghosts',
    'Hawkeye',
    'Eliminator',
    'Katakis',
    'Turrican',
    'Armalyte',
    'Citadel',
    'Creatures 2',
    'Mayhem in Monsterland',
    'Flimbo’s Quest',
    'Last Ninja 3',
    'Ghosts ’n Goblins',
    'Coma Light 13 – Tune 1',
    'Edge of Disgrace',
    'Radio Napalm',
    'Comaland 100% – End',
    'Assembly 2012 · Conservative Megademo – Playhorse',
    'Assembly 2020 · Fantomas – Nine Nights from the Black Moon',
    'Assembly 2023 · The Scroll of Antonius',
    'Assembly 2024 · Transcend the Game'
];

export const c64Playlist = c64TrackPaths.map((path, index) => {
    const metaInfo = c64MuseumMetadata[path];

    if (!metaInfo) {
        throw new Error(`Fehlender Museumstext für C64-Titel: ${path}`);
    }

    const filename = path.split('/').pop();
    return {
        path,
        title: `${index + 1}. LOAD SID: ${filename}`,
        listTitle: c64ListTitles[index],
        composerInfo: metaInfo,
        generator: function() { return []; },
        loadAsync: async function() {
            return await loadSidFile(`tracks/c64/${path}`);
        }
    };
});
