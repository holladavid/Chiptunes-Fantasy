// === tracks/amiga/mods.js ===
// ==========================================
// AMIGA MODS PLAYLIST INTERFACE
// Curated 5-Legendary Showcase Edition
// ==========================================

import { loadModFile } from '../../js/parsers/mod-parser.js';
import { loadXmFile } from '../../js/parsers/xm-parser.js'; 
import { loadDwFile } from '../../js/parsers/dw-parser.js'; // <--- NEUER PARSER IMPORT!

const myModFiles = [
    "ELYSIUM.MOD",          // Jester / Sanity (1)
    "space_debris.xm",      // Captain (2)
    "GSLINGER.MOD",         // Jogeir Liljedahl (3)
    "agony_intro.mod",      // Jochen Hippel (4)
    "turrican_2_title.xm",  // Chris Huelsbeck (5)
    "beast1.title.dw",      // <--- NEU: David Whittakers unschlagbares Meisterwerk!
    "blood_money_title.mod",
    "moongazr.mod",
    "immortal.mod",
    "lotus2-title.mod",
    "DEADLOCK.XM"
];

const composerMetadata = {
    "beast1.title.dw": `
        <h3>[ COMPOSER SPOTLIGHT: DAVID WHITTAKER ]</h3>
        <p>Das Titelthema von <strong>Shadow of the Beast</strong> (1989), komponiert von <strong>David Whittaker</strong>, ist eine absolute Legende und gilt als einer der atmosphärisch dichtesten Amiga-Soundtracks aller Zeiten. Whittaker brachte mit diesem Track echten, cineastischen Synthesizer-Sound in die Videospielwelt.</p>
        <p><strong>DSP-Fokus:</strong> Whittaker revolutionierte das Amiga-Trackwriting, indem er extrem lange, atmosphärische Panflöten- und Akustikgitarren-Samples in den Speicher lud. Da der Paula-Chip eine harte L-R-R-L-Stereotrennung besitzt (die unser cycle-genauer Core mit 3,5 % Übersprechen originalgetreu nachbildet), erzeugte Whittaker über mikro-verzögerte Echo-Effekte ein episches, beispiellos breites Klangpanorama.</p>
    `,
    "ELYSIUM.MOD": `
        <h3>[ COMPOSER SPOTLIGHT: JESTER (SANITY) ]</h3>
        <p><strong>Elysium</strong> ist eine der wegweisendsten Demoscene-Hymnen aller Zeiten, komponiert 1992 von <strong>Volker Tripp (Jester)</strong> für die Sanity-Megademo <em>Interference</em>. Der Track zeigt die reinste Form des 4-Spur ProTracker-Handwerks: Extrem sauberes 8-Bit Sample-Slicing, tighte perkussive Beatzuweisung und jazzige, synkopierte Rhythmen, die ohne jegliche Pitch-Hüllkurven allein durch exzellente Volumensteuerung und Micro-Slides geformt wurden.</p>
    `,
    "space_debris.xm": `
        <h3>[ COMPOSER SPOTLIGHT: CAPTAIN (MARKUS KAARLONEN) ]</h3>
        <p>Komponiert im Jahr 1993, gilt <strong>Space Debris</strong> von <strong>Markus Kaarlonen (Captain)</strong> als melodisches Kronjuwel der Demoszene. Der Track nutzt dichte, spacige Synthesizer-Pads und schwebende Portamentos (Effekt <code>0x03</code>), um eine beinahe dreidimensionale akustische Bühne aufzubauen. Es ist das perfekte Beispiel für den Epochenwechsel von rauen Chiptunes zu komplexeren, atmosphärischen Tracker-Arrangements.</p>
    `,
    "GSLINGER.MOD": `
        <h3>[ COMPOSER SPOTLIGHT: JOGEIR LILJEDAHL ]</h3>
        <p><strong>Jogeir Liljedahl</strong> gilt als einer der virtuosesten Sound-Hacker der Amiga-Ära. Mit <strong>Guitar Slinger</strong> (1994) vollbrachte er das Unmögliche: Er zwang Paula dazu, das Jaulen, verzerrende Feedback und expressive Vibrato einer elektrischen E-Gitarre auf nur 4 Spuren täuschend echt zu emulieren. Dies gelingt durch die exzessive Nutzung von Sample-Offsets (Effekt <code>0x09</code>) und rasanten Micro-Pitch-Bends.</p>
    `,
    "agony_intro.mod": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL / MAD MAX ]</h3>
        <p>Das legendäre Titelthema des Psygnosis-Spiels <strong>Agony</strong> (1992) ist ein Meisterwerk der symphonischen Spielmusik. Ursprünglich von <strong>Jochen Hippel</strong> (Mad Max) komponiert und von Jogeir Liljedahl verfeinert, verbindet es melancholische Piano-Soli mit getragenen Streichern. Unser phasenstarres Sub-Sample-Timing sorgt hier dafür, dass die schnellen Piano-Akkorde und Triller absolut präzise und glasklar abgemischt werden.</p>
    `,
    "turrican_2_title.xm": `
        <h3>[ COMPOSER SPOTLIGHT: CHRIS HUELSBECK ]</h3>
        <p>Der legendäre Soundtrack zu <strong>Turrican II: The Final Fight</strong> (1991) von <strong>Chris Hülsbeck</strong>. Diese 7-Kanal-Konvertierung demonstriert das volle Spektrum unseres emulierten Paula-Kerns: Epische, breit panned Bläser, butterweiche Synthesizer-Glides (Compatible Gxx) und druckvolle Percussions. Dank der präzisen 16-Bit -> 8-Bit PCM-Konvertierung entfaltet sich die klassische Hülsbeck-Dynamik ohne kratziges Emulator-Rauschen.</p>
    `
};

export const amigaPlaylist = myModFiles.map((filename, index) => {
    const isXm = filename.toLowerCase().endsWith('.xm');
    const isDw = filename.toLowerCase().endsWith('.dw'); // Check auf Whittaker Format
    
    const label = isXm ? "FASTTRACKER" : (isDw ? "CUSTOM DW" : "PROTRACKER");
    const metaInfo = composerMetadata[filename] || `
        <h3>[ CLASSIC AMIGA MODULE ]</h3>
        <p>Ein historisches Amiga-Tracker-Dokument. Geladen und emuliert direkt im RAM des Webbrowsers über unseren maßgeschneiderten, phasenstarres MOS Paula 8364 Core.</p>
    `;

    return {
        title: `${index + 1}. LOAD ${label}: ${filename}`,
        composerInfo: metaInfo,
        generator: function() { return []; },
        loadAsync: async function() {
            if (isXm) {
                return await loadXmFile(`tracks/amiga/${filename}`);
            } else if (isDw) {
                return await loadDwFile(`tracks/amiga/${filename}`); // <--- LÄDT DEN UWA PARSER!
            } else {
                return await loadModFile(`tracks/amiga/${filename}`);
            }
        }
    };
});f