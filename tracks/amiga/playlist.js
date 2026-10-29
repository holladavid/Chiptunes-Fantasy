// === tracks/amiga/playlist.js ===
// 45 Bestandstitel + 24 recherchierte Spiel- und Demoscene-Klassiker.

import { loadModFile } from '../../js/parsers/mod-parser.js';
import { loadXmFile } from '../../js/parsers/xm-parser.js';
import { loadDwFile } from '../../js/parsers/dw-parser.js';
import { loadHipcFile } from '../../js/parsers/hipc-parser.js';
import { amigaMuseumMetadata } from './museum.js';

const myModFiles = [
    // --- BESTAND: DEMO & GAME HIGHLIGHTS ---
    "ELYSIUM.MOD",
    "space_debris.xm",
    "GSLINGER.MOD",
    "agony_intro.mod",
    "turrican_2_title.xm",

    // --- BESTAND: JOCHEN HIPPEL / DRAGONFLIGHT ---
    "dragonflight/dragonflight_titletune.HIPC",
    "dragonflight/dragonflight_surface.HIPC",
    "dragonflight/dragonflight_town.HIPC",
    "dragonflight/dragonflight_dungeon.HIPC",
    "dragonflight/dragonflight_endsequence.HIPC",
    "dragonflight/dragonflight_ani.HIPC",
    "dragonflight/dragonflight_always.HIPC",

    // --- BESTAND: JOCHEN HIPPEL / AMBERSTAR ---
    "amberstar/City_Walk.hipc",
    "amberstar/Dreamcave.hipc",
    "amberstar/Eriks_Revenge.hipc",
    "amberstar/Fanfares.hipc",
    "amberstar/Flying_High.hipc",
    "amberstar/Funkey_Dungeon.hipc",
    "amberstar/Gwens_Lament.hipc",
    "amberstar/Hasta_La_Vista.hipc",
    "amberstar/High_Seas.hipc",
    "amberstar/Horse_Song.hipc",
    "amberstar/Irish_Spring.hipc",
    "amberstar/Lullaby.hipc",
    "amberstar/Lurking_Horror.hipc",
    "amberstar/Minor_Quarrels.hipc",
    "amberstar/Misty_Orc_Hop.hipc",
    "amberstar/Mystic_Moments.hipc",
    "amberstar/Ode_To_Schnism.hipc",
    "amberstar/Travellers_Tune.hipc",
    "amberstar/Ingame.hipc",

    // --- BESTAND: JOCHEN HIPPEL / WINGS OF DEATH ---
    "wings-of-death/Wings_Of_Death-Title.hip",
    "wings-of-death/Wings_Of_Death-Level_1.hipc",
    "wings-of-death/Wings_Of_Death-Level_2.hipc",
    "wings-of-death/Wings_Of_Death-Level_3.hipc",
    "wings-of-death/Wings_Of_Death-Level_4.hipc",
    "wings-of-death/Wings_Of_Death-Level_5.hipc",
    "wings-of-death/Wings_Of_Death-Level_6.hipc",
    "wings-of-death/Wings_Of_Death-Level_7.hipc",
    "wings-of-death/Wings_Of_Death-End.hipc",

    // --- BESTAND: ERWEITERTES ARCHIV ---
    "blood_money_title.mod",
    "moongazr.mod",
    "immortal.mod",
    "lotus2-title.mod",
    "DEADLOCK.XM",

    // --- NEU: SPIELMUSIK-KLASSIKER ---
    "classics/games/cannon-fodder.mod",
    "classics/games/chaos-engine-k8.mod",
    "classics/games/speedball-2-title.mod",
    "classics/games/gods.mod",
    "classics/games/pinball-dreams-beatbox.mod",
    "classics/games/pinball-fantasies-party-land.mod",
    "classics/games/project-x-bladswede.mod",
    "classics/games/superfrog-title.mod",
    "classics/games/lemmings.mod",
    "classics/games/another-world-intro.mod",
    "classics/games/dune-wormsign.mod",
    "classics/games/shadow-of-the-beast-title.mod",

    // --- NEU: DEMOSCENE-KLASSIKER ---
    "classics/demoscene/red-sector-theme.mod",
    "classics/demoscene/trans-atlantic.mod",
    "classics/demoscene/cream-of-the-earth.mod",
    "classics/demoscene/occ-san-geen.mod",
    "classics/demoscene/hysteria.mod",
    "classics/demoscene/phantazia.mod",
    "classics/demoscene/guardian-dragon.mod",
    "classics/demoscene/macrocosm.mod",
    "classics/demoscene/sanctuary.mod",
    "classics/demoscene/acid-injection.mod",
    "classics/demoscene/carillon.mod",
    "classics/demoscene/obvious-disaster.mod",

    // --- NEU: THE GREAT GIANA SISTERS (AMIGA) ---
    "giana-sisters/title-screen.mod",
    "giana-sisters/get-ready.mod",
    "giana-sisters/ingame-1-ground.mod",
    "giana-sisters/ingame-2-cave.mod",
];

// Echte Stück- beziehungsweise dokumentierte Szenentitel für die Auswahlliste.
// In Unterordnern reicht der lokale Titel; Spiel- und Demozuordnung steht in
// Breadcrumb, Tooltip und Museumskarte.
const amigaListTitles = [
    'Elysium',
    'Space Debris',
    'Guitar Slinger',
    'Agony – Intro',
    'Turrican II – Title',
    'Title',
    'Surface',
    'Town',
    'Dungeon',
    'End Sequence',
    'Animation',
    'Always',
    'City Walk',
    'Dreamcave',
    'Erik’s Revenge',
    'Fanfares',
    'Flying High',
    'Funkey Dungeon',
    'Gwen’s Lament',
    'Hasta La Vista',
    'High Seas',
    'Horse Song',
    'Irish Spring',
    'Lullaby',
    'Lurking Horror',
    'Minor Quarrels',
    'Misty Orc Hop',
    'Mystic Moments',
    'Ode to Schnism',
    'Travellers Tune',
    'Ingame',
    'Title',
    'Level 1 – Over the Trees',
    'Level 2 – Inside the Cave',
    'Level 3 – Desert Rocks',
    'Level 4 – Mechanical Castle',
    'Level 5 – Bio-Hazard / Organic',
    'Level 6 – Glacier / Ice',
    'Level 7 – Volcanic / Fire',
    'End',
    'Blood Money – Title',
    'Moongazr',
    'Towards Immortality',
    'Lotus II – Title',
    'Dead Lock',
    'Cannon Fodder',
    'The Chaos Engine – K8',
    'Speedball 2 – Title',
    'Gods',
    'Pinball Dreams – Beat Box',
    'Pinball Fantasies – Party Land',
    'Project-X – Bladswede Remix',
    'Superfrog – Title',
    'Lemmings',
    'Another World – Intro',
    'Dune – Wormsign',
    'Shadow of the Beast – Title',
    'Red Sector Theme',
    'Trans Atlantic',
    'Cream of the Earth',
    'Occ-San-Geen',
    'Hysteria',
    'Phantazia.2',
    'Guardian Dragon',
    'Macrocosm',
    'Sanctuary',
    'Acid Injection',
    'Carillon',
    'Obvious Disaster',
    'Title Screen',
    'Get Ready!',
    'In-Game 1 – Ground',
    'In-Game 2 – Cave'
];

export const amigaPlaylist = myModFiles.map((filename, index) => {
    const fnLower = filename.toLowerCase();
    const isXm = fnLower.endsWith('.xm');
    const isHip = fnLower.endsWith('.hipc') || fnLower.endsWith('.hip') || fnLower.endsWith('.coso');
    const isDw = fnLower.endsWith('.dw');
    const isHip68k = fnLower.endsWith('.hip') || filename === 'wings-of-death/Wings_Of_Death-End.hipc';
    const label = isHip68k ? 'HIPPEL-HIP68K' : (isHip ? 'HIPPEL-COSO' :
        (isDw ? 'WHITTAKER' : (isXm ? 'FASTTRACKER' : 'PROTRACKER')));
    const displayFilename = filename.split('/').pop();
    const metaInfo = amigaMuseumMetadata[filename];

    if (!metaInfo) {
        throw new Error(`Fehlender Museumstext für Amiga-Titel: ${filename}`);
    }

    return {
        path: filename,
        title: `${index + 1}. LOAD ${label}: ${displayFilename}`,
        listTitle: amigaListTitles[index],
        composerInfo: metaInfo,
        generator: function() { return []; },
        loadAsync: async function(options = {}) {
            if (isHip) {
                const songOptions = Number.isInteger(options.song) ? { song: options.song } : {};
                if (filename.startsWith('amberstar/')) {
                    return await loadHipcFile(`tracks/amiga/${filename}`, {
                        ...songOptions,
                        sampleBankUrl: 'tracks/amiga/amberstar/hipc.samp',
                        replayerOptions: { envSpec: true }
                    });
                }
                return await loadHipcFile(`tracks/amiga/${filename}`, songOptions);
            } else if (isDw) {
                return await loadDwFile(`tracks/amiga/${filename}`);
            } else if (isXm) {
                return await loadXmFile(`tracks/amiga/${filename}`);
            } else {
                return await loadModFile(`tracks/amiga/${filename}`);
            }
        }
    };
});
