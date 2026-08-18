// === tracks/amiga/playlist.js ===
// ==========================================
// AMIGA MODS & HIPC/HIP PLAYLIST INTERFACE
// Curated Showcase + Complete Wings of Death (Hippel-7V) Suite
// ==========================================

import { loadModFile } from '../../js/parsers/mod-parser.js';
import { loadXmFile } from '../../js/parsers/xm-parser.js'; 
import { loadDwFile } from '../../js/parsers/dw-parser.js';
import { loadHipcFile } from '../../js/parsers/hipc-parser.js';

const myModFiles = [
    // --- CLASSIC DEMO & GAME HIGHLIGHTS ---
    "ELYSIUM.MOD",                  // Jester / Sanity (1)
    "space_debris.xm",              // Captain (2)
    "GSLINGER.MOD",                 // Jogeir Liljedahl (3)
    "agony_intro.mod",              // Jochen Hippel (4)
    "turrican_2_title.xm",          // Chris Huelsbeck (5)
    
    // --- JOCHEN HIPPEL: WINGS OF DEATH (7-VOICE COSO / HIP SUITE) ---
    "Wings_Of_Death-Title.hip",     // Main Title Theme
    "Wings_Of_Death-Level_1.hipc",   // Level 1: Over the Trees
    "Wings_Of_Death-Level_2.hipc",   // Level 2: Inside the Cave
    "Wings_Of_Death-Level_3.hipc",   // Level 3: Desert Rocks
    "Wings_Of_Death-Level_4.hipc",   // Level 4: Mechanical Castle
    "Wings_Of_Death-Level_5.hipc",   // Level 5: Bio-Hazard / Organic
    "Wings_Of_Death-Level_6.hipc",   // Level 6: Glacier / Ice
    "Wings_Of_Death-Level_7.hipc",   // Level 7: Volcanic / Fire
    "Wings_Of_Death-End.hipc",       // End / Highscore Credits

    // --- EXTENDED ARCHIVE ---
    "blood_money_title.mod",
    "moongazr.mod",
    "immortal.mod",
    "lotus2-title.mod",
    "DEADLOCK.XM"
];

const composerMetadata = {
    // =========================================================
    // WINGS OF DEATH (JOCHEN HIPPEL / MAD MAX) METADATA
    // =========================================================
    "Wings_Of_Death-Title.hip": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p>Das legendäre <strong>Titelthema</strong> des Thalion-Klassikers <strong>Wings of Death</strong> (Amiga, 1990). Dieser Track etablierte Hippels bahnbrechende <strong>7-Voice Macro-Engine</strong> auf dem Amiga.</p>
        <p><strong>DSP-Fokus:</strong> Hippel kombiniert hier treibende Synth-Rock-Rhythmen mit wuchtigen 8-Bit-PCM Digidrums und virtuosen Arpeggios. Durch das dynamische Voice-Stealing teilen sich Lead-Melodie und Drums die 4 physikalischen DMA-Kanäle der Paula ohne klangliche Einbußen.</p>
    `,
    "Wings_Of_Death-Level_1.hipc": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p><strong>Level 1: Over the Trees</strong> – Die ikonische Eröffnungshymne von <em>Wings of Death</em>. Ein Paradebeispiel für Hippels melodische Finesse und das Zusammenspiel von 7 logischen Tracker-Spuren.</p>
        <p><strong>DSP-Fokus:</strong> Achte auf die satten Slap-Bass-Lines und die butterweichen Pitch-Slides der Leadstimme. Unser 192kHz-Oversampling-Core mit analoger LF347-Slew-Rate-Modulation verleiht den 8-Bit-Samples einen seidigen, warmen Glanz.</p>
    `,
    "Wings_Of_Death-Level_2.hipc": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p><strong>Level 2: Inside the Cave</strong> – Düsterer, treibender Höhlen-Techno aus <em>Wings of Death</em> (1990).</p>
        <p><strong>DSP-Fokus:</strong> Hippel nutzt hier perkussive Chiptune-Echos und harte Snare-Akzente. Die dichten Event-Streams fordern das Timing der Sound-Makros heraus, die von unserem bitgenauen COSO-Interpreter frame-exakt getaktet werden.</p>
    `,
    "Wings_Of_Death-Level_3.hipc": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p><strong>Level 3: Desert Rocks</strong> – Epische Wüsten-Atmosphäre mit orientalisch angehauchten Tonleitern und komplexer Rhythmik.</p>
        <p><strong>DSP-Fokus:</strong> Das Zusammenspiel aus resonanten Synth-Pads und knallharten Hi-Hat-Mustern demonstriert die Stärke der Amiga-Kanal-Priorisierung: Schnelle Percussions verdrängen Hintergrund-Töne nur für Sekundenbruchteile.</p>
    `,
    "Wings_Of_Death-Level_4.hipc": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p><strong>Level 4: Mechanical Castle / Factory</strong> – Unerbittliche, metallische Industrie-Beats treffen auf majestätische Melodiebögen.</p>
        <p><strong>DSP-Fokus:</strong> Hippel setzt in diesem Track gezielte Macro-Transpositionen und Volume-Envelopes ein, um aus simplen Synth-Samples komplexe, chorale Mehrklänge zu formen.</p>
    `,
    "Wings_Of_Death-Level_5.hipc": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p><strong>Level 5: Bio-Hazard / Organic</strong> – Ein pulsierender, organischer Chiptune-Track voller unheimlicher Pitch-Bends und schwebender Portamentos.</p>
        <p><strong>DSP-Fokus:</strong> Die kontinuierlichen LFO-Modulationen in Hippels Macro-Tabelle erzeugen lebendige, atmende Klangstrukturen, die auf echten Hardware-Register-Events basieren.</p>
    `,
    "Wings_Of_Death-Level_6.hipc": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p><strong>Level 6: Glacier / Ice</strong> – Kristallklare Glocken-Sounds und schneidende Synth-Leads im ewigen Eis.</p>
        <p><strong>DSP-Fokus:</strong> Das 12-Bit OCS-Stereo-Panning unseres Studio-Cores fächert die schnellen Glissando-Läufe weit über die Stereobühne auf, während das Bauer-Binaural-Crossfeed Hörermüdung auf Kopfhörern verhindert.</p>
    `,
    "Wings_Of_Death-Level_7.hipc": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p><strong>Level 7: Volcanic / Fire</strong> – Das feurige Finale vor dem Endgegner. Rasantes Tempo und brachiale Bass-Fundamente.</p>
        <p><strong>DSP-Fokus:</strong> Die 7-Kanal-Mischung läuft hier mit maximaler Dynamik. Unser Lookahead True-Peak Limiter hält das Signal bei -0.35 dBFS stabil und schützt vor digitalem Clipping.</p>
    `,
    "Wings_Of_Death-End.hipc": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p><strong>End Theme & Credits</strong> – Die triumphale Belohnung für alle Spieler, die <em>Wings of Death</em> bezwungen haben.</p>
        <p><strong>DSP-Fokus:</strong> Ein getragener, hymnischer Ausklang mit orchestralen Streicher-Simulationen und weichen Fade-Outs, die die meisterhafte Sample-Ökonomie von Mad Max unter Beweis stellen.</p>
    `,

    // =========================================================
    // CLASSIC TRACKS
    // =========================================================
    "beast1.title.dw": `
        <h3>[ COMPOSER SPOTLIGHT: DAVID WHITTAKER ]</h3>
        <p>Das Titelthema von <strong>Shadow of the Beast</strong> (1989), komponiert von <strong>David Whittaker</strong>, ist eine absolute Legende und gilt als einer der atmosphärisch dichtesten Amiga-Soundtracks aller Zeiten.</p>
    `,
    "ELYSIUM.MOD": `
        <h3>[ COMPOSER SPOTLIGHT: JESTER (SANITY) ]</h3>
        <p><strong>Elysium</strong> ist eine der wegweisendsten Demoscene-Hymnen aller Zeiten, komponiert 1992 von <strong>Volker Tripp (Jester)</strong> für die Sanity-Megademo <em>Interference</em>.</p>
    `,
    "space_debris.xm": `
        <h3>[ COMPOSER SPOTLIGHT: CAPTAIN (MARKUS KAARLONEN) ]</h3>
        <p>Komponiert im Jahr 1993, gilt <strong>Space Debris</strong> von <strong>Markus Kaarlonen (Captain)</strong> als melodisches Kronjuwel der Demoszene.</p>
    `,
    "GSLINGER.MOD": `
        <h3>[ COMPOSER SPOTLIGHT: JOGEIR LILJEDAHL ]</h3>
        <p><strong>Jogeir Liljedahl</strong> gilt als einer der virtuosesten Sound-Hacker der Amiga-Ära. Mit <strong>Guitar Slinger</strong> (1994) vollbrachte er das Unmögliche: Er zwang Paula dazu, eine elektrische E-Gitarre auf nur 4 Spuren täuschend echt zu emulieren.</p>
    `,
    "agony_intro.mod": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL / MAD MAX ]</h3>
        <p>Das legendäre Titelthema des Psygnosis-Spiels <strong>Agony</strong> (1992) ist ein Meisterwerk der symphonischen Spielmusik.</p>
    `,
    "turrican_2_title.xm": `
        <h3>[ COMPOSER SPOTLIGHT: CHRIS HUELSBECK ]</h3>
        <p>Der legendäre Soundtrack zu <strong>Turrican II: The Final Fight</strong> (1991) von <strong>Chris Hülsbeck</strong>.</p>
    `
};

export const amigaPlaylist = myModFiles.map((filename, index) => {
    const fnLower = filename.toLowerCase();
    const isXm = fnLower.endsWith('.xm');
    const isHip = fnLower.endsWith('.hipc') || fnLower.endsWith('.hip') || fnLower.endsWith('.coso');
    const isDw = fnLower.endsWith('.dw');
    const label = isHip ? "HIPPEL-7V" : (isDw ? "WHITTAKER" : (isXm ? "FASTTRACKER" : "PROTRACKER"));

    const metaInfo = composerMetadata[filename] || `
        <h3>[ CLASSIC AMIGA MODULE ]</h3>
        <p>Ein historisches Amiga-Tracker-Dokument. Geladen und emuliert direkt im RAM des Webbrowsers über unseren maßgeschneiderten MOS Paula 8364 Core.</p>
    `;

    return {
        title: `${index + 1}. LOAD ${label}: ${filename}`,
        composerInfo: metaInfo,
        generator: function() { return []; },
        loadAsync: async function() {
            if (isHip) {
                return await loadHipcFile(`tracks/amiga/${filename}`);
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