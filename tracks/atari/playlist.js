// === tracks/atari/playlist.js ===
// Atari ST YM2149 Jukebox Playlist Registry (86 Tracks: Games & Demoscene).

import { loadYmFile } from '../../js/parsers/ym-parser.js';
import { atariMuseumMetadata } from './museum.js';

// Amberstar-Dumps lagen im Archiv rückwärts nummeriert (amber-20.ym = #1 .. amber-01.ym = #20).
const amberstarTracks = Array.from({ length: 20 }, (_, i) => {
    const archiveNumber = i + 1;
    const fileNumber = String(21 - archiveNumber).padStart(2, '0');
    return {
        path: `games/amberstar/amber-${fileNumber}.ym`,
        category: 'games',
        title: `Amberstar – Musik #${archiveNumber}`,
        listTitle: `Musik #${archiveNumber}`
    };
});

const wingsOfDeathTracks = [
    { path: 'games/wings-of-death/loader.ym', category: 'games', title: 'Wings of Death – Loader', listTitle: 'Loader' },
    ...Array.from({ length: 9 }, (_, i) => {
        const level = i + 1;
        const pad = String(level).padStart(2, '0');
        return {
            path: `games/wings-of-death/level-${level}.ym`,
            category: 'games',
            title: `Wings of Death – Musikdump ${pad}`,
            listTitle: `Musikdump ${pad}`
        };
    })
];

const lethalXcessTracks = Array.from({ length: 7 }, (_, i) => {
    const num = i + 1;
    return {
        path: `games/lethal-xcess/music-${num}.ym`,
        category: 'games',
        title: `Lethal Xcess – Musik ${num}`,
        listTitle: `Musik ${num}`
    };
});

const atariTracks = [
    // --- GAMES: 1987–1988 ---
    { path: 'games/goldrunner.ym',                              category: 'games', title: 'Goldrunner', listTitle: 'Goldrunner' },
    { path: 'games/xenon/title.ym',                             category: 'games', title: 'Xenon – Titel', listTitle: 'Titel' },
    { path: 'games/xenon/ingame.ym',                            category: 'games', title: 'Xenon – Ingame', listTitle: 'Ingame' },
    { path: 'games/xenon/end-of-level-battle.ym',               category: 'games', title: 'Xenon – End-of-Level-Battle', listTitle: 'End-of-Level-Battle' },
    { path: 'games/speedball/speedball-1.ym',                   category: 'games', title: 'Speedball – Archivfassung 1', listTitle: 'Archivfassung 1' },
    { path: 'games/bionic-commando.ym',                         category: 'games', title: 'Bionic Commando', listTitle: 'Bionic Commando' },
    { path: 'games/giana-sisters/title.ym',                     category: 'games', title: 'The Great Giana Sisters – Titel', listTitle: 'Titel' },
    { path: 'games/giana-sisters/ingame-1.ym',                  category: 'games', title: 'The Great Giana Sisters – Ingame 1', listTitle: 'Ingame 1' },
    { path: 'games/giana-sisters/ingame-2.ym',                  category: 'games', title: 'The Great Giana Sisters – Ingame 2', listTitle: 'Ingame 2' },
    { path: 'games/giana-sisters/ingame-3.ym',                  category: 'games', title: 'The Great Giana Sisters – Ingame 3', listTitle: 'Ingame 3' },
    { path: 'games/giana-sisters/bonus.ym',                     category: 'games', title: 'The Great Giana Sisters – Bonus Stage', listTitle: 'Bonus Stage' },
    { path: 'games/giana-sisters/highscore.ym',                 category: 'games', title: 'The Great Giana Sisters – Highscore', listTitle: 'Highscore' },

    // --- GAMES: 1989 ---
    { path: 'games/xenon-2/megablast.ym',                       category: 'games', title: 'Xenon 2 – Megablast', listTitle: 'Megablast' },
    { path: 'games/chambers-of-shaolin/title.ym',               category: 'games', title: 'Chambers of Shaolin – Titel', listTitle: 'Titel' },
    { path: 'games/chambers-of-shaolin/loader.ym',              category: 'games', title: 'Chambers of Shaolin – Loader', listTitle: 'Loader' },
    { path: 'games/stormlord/title.ym',                         category: 'games', title: 'Stormlord – Titel', listTitle: 'Titel' },
    { path: 'games/stormlord/ingame.ym',                        category: 'games', title: 'Stormlord – Ingame', listTitle: 'Ingame' },
    { path: 'games/spherical-intro.ym',                         category: 'games', title: 'Spherical – Intro', listTitle: 'Spherical – Intro' },
    { path: 'games/ghouls-n-ghosts/ghouls-1.ym',                category: 'games', title: 'Ghouls ’n Ghosts – Archivfassung 1', listTitle: 'Archivfassung 1' },
    { path: 'games/ghouls-n-ghosts/ghouls-2.ym',                category: 'games', title: 'Ghouls ’n Ghosts – Archivfassung 2', listTitle: 'Archivfassung 2' },
    { path: 'games/ghouls-n-ghosts/ghouls-3.ym',                category: 'games', title: 'Ghouls ’n Ghosts – Archivfassung 3', listTitle: 'Archivfassung 3' },
    { path: 'games/led-storm/led-storm-1.ym',                   category: 'games', title: 'LED Storm – Archivfassung 1', listTitle: 'Archivfassung 1' },

    // --- GAMES: 1990–1991 ---
    { path: 'games/enchanted-land-intro.ym',                    category: 'games', title: 'Enchanted Land – Intro', listTitle: 'Enchanted Land – Intro' },
    { path: 'games/dragonflight/title.ym',                      category: 'games', title: 'Dragonflight – Titel', listTitle: 'Titel' },
    { path: 'games/dragonflight/city-1.ym',                     category: 'games', title: 'Dragonflight – Stadt 1', listTitle: 'Stadt 1' },
    { path: 'games/dragonflight/city-2.ym',                     category: 'games', title: 'Dragonflight – Stadt 2', listTitle: 'Stadt 2' },
    { path: 'games/dragonflight/city-3.ym',                     category: 'games', title: 'Dragonflight – Stadt 3', listTitle: 'Stadt 3' },
    { path: 'games/dragonflight/unknown.ym',                    category: 'games', title: 'Dragonflight – Szene nicht bezeichnet', listTitle: 'Szene unbekannt' },
    ...wingsOfDeathTracks,
    { path: 'games/turrican/turrican-1-world-1-1.ym',           category: 'games', title: 'Turrican – World 1-1', listTitle: 'World 1-1' },
    { path: 'games/turrican/turrican-2-desert-rocks.ym',        category: 'games', title: 'Turrican 2 – The Desert Rocks', listTitle: 'The Desert Rocks' },
    ...lethalXcessTracks,

    // --- GAMES: 1992 ---
    ...amberstarTracks,

    // --- DEMOSCENE (1989–1993) ---
    { path: 'demoscene/thalion-intro.ym',                       category: 'demoscene', title: 'Thalion – Intro', listTitle: 'Thalion – Intro' },
    { path: 'demoscene/union-demo/loader.ym',                   category: 'demoscene', title: 'The Union Demo – Loader', listTitle: 'Loader' },
    { path: 'demoscene/union-demo/menu.ym',                     category: 'demoscene', title: 'The Union Demo – Menu', listTitle: 'Menu' },
    { path: 'demoscene/union-demo/copier.ym',                   category: 'demoscene', title: 'The Union Demo – Copier', listTitle: 'Copier' },
    { path: 'demoscene/union-demo/sphericool-screen.ym',        category: 'demoscene', title: 'The Union Demo – Sphericool Screen', listTitle: 'Sphericool Screen' },
    { path: 'demoscene/union-demo/l16-fullscreen.ym',           category: 'demoscene', title: 'The Union Demo – L16 FullScreen', listTitle: 'L16 FullScreen' },
    { path: 'demoscene/union-demo/tnt-vector-screen.ym',        category: 'demoscene', title: 'The Union Demo – TNT Vector Screen', listTitle: 'TNT Vector Screen' },
    { path: 'demoscene/union-demo/tcb-scroller.ym',             category: 'demoscene', title: 'The Union Demo – TCB Scroller', listTitle: 'TCB Scroller' },
    { path: 'demoscene/union-demo/wobbly-sprites.ym',           category: 'demoscene', title: 'The Union Demo – Wobbly Sprites', listTitle: 'Wobbly Sprites' },
    { path: 'demoscene/union-demo/starballs-screen.ym',         category: 'demoscene', title: 'The Union Demo – Starballs Screen', listTitle: 'Starballs Screen' },
    { path: 'demoscene/union-demo/beat-dis-screen.ym',          category: 'demoscene', title: 'The Union Demo – Beat Dis Screen', listTitle: 'Beat Dis Screen' },
    { path: 'demoscene/union-demo/superscroller-screen.ym',     category: 'demoscene', title: 'The Union Demo – SuperScroller Screen', listTitle: 'SuperScroller Screen' },
    { path: 'demoscene/syntax-terror/syntax-terror.ym',         category: 'demoscene', title: 'Syntax Terror – Screen nicht bezeichnet', listTitle: 'Screen unbekannt' },
    { path: 'demoscene/syntax-terror/tex-24hours.ym',           category: 'demoscene', title: 'Syntax Terror – TeX 24hours Screen', listTitle: 'TeX 24hours' },
    { path: 'demoscene/syntax-terror/tlb-screen.ym',            category: 'demoscene', title: 'Syntax Terror – TLB Screen', listTitle: 'TLB Screen' },
    { path: 'demoscene/punish-your-machine/best-part-of-creation.ym', category: 'demoscene', title: 'Punish Your Machine – Best Part of Creation', listTitle: 'Best Part of Creation' },
    { path: 'demoscene/synergy/main-menu.ym',                   category: 'demoscene', title: 'Synergy – Main Menu', listTitle: 'Main Menu' },
    { path: 'demoscene/synergy/credits.ym',                     category: 'demoscene', title: 'Synergy – Credits', listTitle: 'Credits' },
    { path: 'demoscene/remixes/shades-giana-remix.ym',          category: 'demoscene', title: 'Shades & Giana Sisters – Remix', listTitle: 'Shades & Giana Sisters' }
];

export const atariPlaylist = atariTracks.map((track, index) => {
    const metaInfo = atariMuseumMetadata[track.path];

    if (!metaInfo) {
        throw new Error(`Fehlender Museumstext für Atari-Titel: ${track.path}`);
    }

    return {
        path: track.path,
        sourcePath: track.path,
        category: track.category,
        title: track.title,
        listTitle: track.listTitle,
        composerInfo: metaInfo,
        generator: function() { return []; },
        loadAsync: async function() {
            return await loadYmFile(`tracks/atari/${track.path}`);
        }
    };
});