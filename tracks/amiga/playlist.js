// === tracks/amiga/playlist.js ===
// Kuratierte Amiga- & Tracker-Playlist (73 Tracks: Games, Demoscene, Tracker-XM).

import { loadModFile } from '../../js/parsers/mod-parser.js';
import { loadXmFile } from '../../js/parsers/xm-parser.js';
import { loadHipcFile } from '../../js/parsers/hipc-parser.js';
import { amigaMuseumMetadata } from './museum.js';

const AMBERSTAR_BANK = 'tracks/amiga/games/amberstar/hipc.samp';

const amberstar = (file, listTitle) => ({
    path: `games/amberstar/${file}`,
    category: 'games',
    listTitle,
    sampleBank: AMBERSTAR_BANK,
    envSpec: true
});

const amigaTracks = [
    // --- GAMES: 1988 (The Great Giana Sisters) ---
    { path: 'games/giana-sisters/title-screen.mod',    category: 'games', listTitle: 'Title Screen' },
    { path: 'games/giana-sisters/get-ready.mod',       category: 'games', listTitle: 'Get Ready!' },
    { path: 'games/giana-sisters/ingame-1-ground.mod', category: 'games', listTitle: 'In-Game 1 – Ground' },
    { path: 'games/giana-sisters/ingame-2-cave.mod',   category: 'games', listTitle: 'In-Game 2 – Cave' },

    // --- GAMES: 1989 ---
    { path: 'games/blood-money-title.mod',             category: 'games', listTitle: 'Blood Money – Title' },
    { path: 'games/shadow-of-the-beast-title.mod',     category: 'games', listTitle: 'Shadow of the Beast – Title' },

    // --- GAMES: 1990 (Dragonflight & Wings of Death + Bitmap Brothers) ---
    { path: 'games/dragonflight/titletune.hipc',       category: 'games', listTitle: 'Title' },
    { path: 'games/dragonflight/surface.hipc',         category: 'games', listTitle: 'Surface' },
    { path: 'games/dragonflight/town.hipc',            category: 'games', listTitle: 'Town' },
    { path: 'games/dragonflight/dungeon.hipc',         category: 'games', listTitle: 'Dungeon' },
    { path: 'games/dragonflight/endsequence.hipc',     category: 'games', listTitle: 'End Sequence' },
    { path: 'games/dragonflight/ani.hipc',             category: 'games', listTitle: 'Animation' },
    { path: 'games/dragonflight/always.hipc',          category: 'games', listTitle: 'Always' },

    { path: 'games/wings-of-death/title.hip',          category: 'games', listTitle: 'Title', format: 'hip68k' },
    { path: 'games/wings-of-death/level-1.hipc',       category: 'games', listTitle: 'Level 1 – Over the Trees' },
    { path: 'games/wings-of-death/level-2.hipc',       category: 'games', listTitle: 'Level 2 – Inside the Cave' },
    { path: 'games/wings-of-death/level-3.hipc',       category: 'games', listTitle: 'Level 3 – Desert Rocks' },
    { path: 'games/wings-of-death/level-4.hipc',       category: 'games', listTitle: 'Level 4 – Mechanical Castle' },
    { path: 'games/wings-of-death/level-5.hipc',       category: 'games', listTitle: 'Level 5 – Bio-Hazard / Organic' },
    { path: 'games/wings-of-death/level-6.hipc',       category: 'games', listTitle: 'Level 6 – Glacier / Ice' },
    { path: 'games/wings-of-death/level-7.hipc',       category: 'games', listTitle: 'Level 7 – Volcanic / Fire' },
    { path: 'games/wings-of-death/end.hipc',           category: 'games', listTitle: 'End', format: 'hip68k' },

    { path: 'games/speedball-2-title.mod',             category: 'games', listTitle: 'Speedball 2 – Title' },

    // --- GAMES: 1991 ---
    { path: 'games/gods.mod',                          category: 'games', listTitle: 'Gods' },
    { path: 'games/lemmings.mod',                      category: 'games', listTitle: 'Lemmings' },
    { path: 'games/another-world-intro.mod',           category: 'games', listTitle: 'Another World – Intro' },
    { path: 'games/lotus-2-title.mod',                 category: 'games', listTitle: 'Lotus II – Title' },
    { path: 'games/moongazr.mod',                      category: 'games', listTitle: 'Moongazr (Cubulus)' },

    // --- GAMES: 1992 (inkl. Amberstar) ---
    { path: 'games/agony-intro.mod',                   category: 'games', listTitle: 'Agony – Intro' },
    amberstar('city-walk.hipc',      'City Walk'),
    amberstar('dreamcave.hipc',      'Dreamcave'),
    amberstar('eriks-revenge.hipc',  'Erik’s Revenge'),
    amberstar('fanfares.hipc',       'Fanfares'),
    amberstar('flying-high.hipc',    'Flying High'),
    amberstar('funkey-dungeon.hipc', 'Funkey Dungeon'),
    amberstar('gwens-lament.hipc',   'Gwen’s Lament'),
    amberstar('hasta-la-vista.hipc', 'Hasta La Vista'),
    amberstar('high-seas.hipc',      'High Seas'),
    amberstar('horse-song.hipc',     'Horse Song'),
    amberstar('irish-spring.hipc',   'Irish Spring'),
    amberstar('lullaby.hipc',        'Lullaby'),
    amberstar('lurking-horror.hipc', 'Lurking Horror'),
    amberstar('minor-quarrels.hipc', 'Minor Quarrels'),
    amberstar('misty-orc-hop.hipc',  'Misty Orc Hop'),
    amberstar('mystic-moments.hipc', 'Mystic Moments'),
    amberstar('ode-to-schnism.hipc', 'Ode to Schnism'),
    amberstar('travellers-tune.hipc','Travellers Tune'),
    amberstar('ingame.hipc',         'Ingame'),
    { path: 'games/dune-wormsign.mod',                 category: 'games', listTitle: 'Dune – Wormsign' },
    { path: 'games/pinball-dreams-beatbox.mod',        category: 'games', listTitle: 'Pinball Dreams – Beat Box' },
    { path: 'games/pinball-fantasies-party-land.mod',  category: 'games', listTitle: 'Pinball Fantasies – Party Land' },
    { path: 'games/project-x-bladswede.mod',           category: 'games', listTitle: 'Project-X – Bladswede Remix' },

    // --- GAMES: 1993 ---
    { path: 'games/cannon-fodder.mod',                 category: 'games', listTitle: 'Cannon Fodder' },
    { path: 'games/chaos-engine-k8.mod',               category: 'games', listTitle: 'The Chaos Engine – K8' },
    { path: 'games/superfrog-title.mod',               category: 'games', listTitle: 'Superfrog – Title' },

    // --- DEMOSCENE: 1989–1996 (4-Kanal-Amiga-MODs) ---
    { path: 'demoscene/occ-san-geen.mod',              category: 'demoscene', listTitle: 'Occ-San-Geen' },
    { path: 'demoscene/cream-of-the-earth.mod',        category: 'demoscene', listTitle: 'Cream of the Earth' },
    { path: 'demoscene/red-sector-theme.mod',          category: 'demoscene', listTitle: 'Red Sector Theme' },
    { path: 'demoscene/macrocosm.mod',                 category: 'demoscene', listTitle: 'Macrocosm' },
    { path: 'demoscene/obvious-disaster.mod',          category: 'demoscene', listTitle: 'Obvious Disaster' },
    { path: 'demoscene/hysteria.mod',                  category: 'demoscene', listTitle: 'Hysteria' },
    { path: 'demoscene/elysium.mod',                   category: 'demoscene', listTitle: 'Elysium' },
    { path: 'demoscene/guardian-dragon.mod',           category: 'demoscene', listTitle: 'Guardian Dragon' },
    { path: 'demoscene/towards-immortality.mod',       category: 'demoscene', listTitle: 'Towards Immortality' },
    { path: 'demoscene/sanctuary.mod',                 category: 'demoscene', listTitle: 'Sanctuary' },
    { path: 'demoscene/guitar-slinger.mod',            category: 'demoscene', listTitle: 'Guitar Slinger' },
    { path: 'demoscene/trans-atlantic.mod',            category: 'demoscene', listTitle: 'Trans Atlantic' },
    { path: 'demoscene/acid-injection.mod',            category: 'demoscene', listTitle: 'Acid Injection' },
    { path: 'demoscene/phantazia.mod',                 category: 'demoscene', listTitle: 'Phantazia.2' },
    { path: 'demoscene/carillon.mod',                  category: 'demoscene', listTitle: 'Carillon' },

    // --- TRACKER-XM (Multi-Channel-Covers & PC-FastTracker-2-Klassiker) ---
    { path: 'tracker-xm/space-debris.xm',              category: 'tracker-xm', listTitle: 'Space Debris (XM-Remake)' },
    { path: 'tracker-xm/turrican-2-title.xm',          category: 'tracker-xm', listTitle: 'Turrican II – Title (XM-Cover)' },
    { path: 'tracker-xm/deadlock.xm',                  category: 'tracker-xm', listTitle: 'Dead Lock' }
];

export const amigaPlaylist = amigaTracks.map((track, index) => {
    const fnLower = track.path.toLowerCase();
    const isXm = fnLower.endsWith('.xm');
    const isHip = fnLower.endsWith('.hipc') || fnLower.endsWith('.hip') || fnLower.endsWith('.coso');
    const isHip68k = track.format === 'hip68k' || fnLower.endsWith('.hip');

    const label = isHip68k ? 'HIPPEL-HIP68K' : (isHip ? 'HIPPEL-COSO' : (isXm ? 'FASTTRACKER' : 'PROTRACKER'));
    const displayFilename = track.path.split('/').pop();
    const metaInfo = amigaMuseumMetadata[track.path];

    if (!metaInfo) {
        throw new Error(`Fehlender Museumstext für Amiga-Titel: ${track.path}`);
    }

    return {
        path: track.path,
        category: track.category,
        title: `${index + 1}. LOAD ${label}: ${displayFilename}`,
        listTitle: track.listTitle,
        composerInfo: metaInfo,
        generator: function() { return []; },
        loadAsync: async function(options = {}) {
            if (isHip) {
                const songOptions = Number.isInteger(options.song) ? { song: options.song } : {};
                if (track.sampleBank) {
                    return await loadHipcFile(`tracks/amiga/${track.path}`, {
                        ...songOptions,
                        sampleBankUrl: track.sampleBank,
                        ...(track.envSpec ? { replayerOptions: { envSpec: true } } : {})
                    });
                }
                return await loadHipcFile(`tracks/amiga/${track.path}`, songOptions);
            } else if (isXm) {
                return await loadXmFile(`tracks/amiga/${track.path}`);
            } else {
                return await loadModFile(`tracks/amiga/${track.path}`);
            }
        }
    };
});