// === tracks/amiga/playlist.js ===
// ==========================================
// AMIGA MODS & HIPC/HIP PLAYLIST INTERFACE
// Curated Showcase, Wings of Death & Dragonflight RPG Suite
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
    
    // --- JOCHEN HIPPEL: DRAGONFLIGHT (THALION 1990, COSO RPG SUITE) ---
    "dragonflight_titletune.HIPC",  // Main Title Theme (7.5 Min. Epos)
    "dragonflight_surface.HIPC",    // Overworld / Wilderness Travel
    "dragonflight_town.HIPC",       // Towns, Taverns & Marketplaces
    "dragonflight_dungeon.HIPC",    // Underground Catacombs & Caverns
    "dragonflight_endsequence.HIPC",// Victory Fanfare & End Credits
    "dragonflight_ani.HIPC",        // Cinematic Dragon Flight & Intro Anim
    "dragonflight_always.HIPC",     // Atmospheric Mystic Motif

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
    // DRAGONFLIGHT (JOCHEN HIPPEL / MAD MAX) METADATA
    // =========================================================
    "dragonflight_titletune.HIPC": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p>Das monumentale <strong>Titelthema</strong> des epischen High-Fantasy-Rollenspiels <strong>Dragonflight</strong> (Thalion Software, 1990; Spieldesign: Erik Simon, Code: Michael Bittner). Dieses Meisterwerk ist mit einer Spieldauer von über <strong>7,5 Minuten (22.880 Ticks @ 50Hz, 170 Divisions)</strong> eine der längsten und komplexesten Einzelsatz-Kompositionen der gesamten 16-Bit-Ära.</p>
        <p><strong>DSP- & Replay-Fokus:</strong> Mit einer gigantischen Sample-Bank von über 177 KB und Loop-Größen von bis zu 47.720 Bytes simuliert Hippel eine vollständige Orchesterbesetzung. Technisch brilliert das Stück durch den intensiven Einsatz von <em>Timbre-Adjustments</em> und den Hardware-Hüllkurven-Opcode <code>$E8</code> (Sustain-Hold), der Töne vor der Ausklingphase exakt im Pegel fixiert.</p>
    `,
    "dragonflight_surface.HIPC": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p><strong>Overworld / Wilderness</strong> – Die Erkundungsmusik für die weiten Kontinente und Ebenen von <em>Dragonflight</em> (1990). Hippel erschafft hier eine heroische, naturverbundene Atmosphäre des Aufbruchs und der Reise.</p>
        <p><strong>DSP- & Replay-Fokus:</strong> Schwebende Panflöten- und Oboen-Samples treffen auf sanfte, analog anmutende Basslinien. Durch die 14-Bit Hermite-Cubic-Interpolation unseres <em>Paula Fantasy Cores</em> klingen die Transienten gezupfter Instrumente wunderbar rund, während der <em>Paula Exact Core</em> mit 192 kHz ZOH-Oversampling den legendären kristallinen „Amiga-Schimmer“ bewahrt.</p>
    `,
    "dragonflight_town.HIPC": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p><strong>Town & Tavern</strong> – Die friedliche und geschäftige Begleitmusik der mittelalterlichen Städte, Märkte und Tavernen in <em>Dragonflight</em>. Einer der eingängigsten und charmantesten Akustik-Tracks aus Jochen Hippels Feder.</p>
        <p><strong>DSP- & Replay-Fokus:</strong> Polyphone Lauten-Arpeggios und grazile Flötenläufe imitieren echte Barockmusik auf nur vier physischen DMA-Kanälen. Die Register-Reloads von <code>AUDxLC</code> und <code>AUDxLEN</code> arbeiten hier im Sub-Millisekundentakt, um kurze Attack-Zupfer nahtlos in flache Haltephasen übergehen zu lassen.</p>
    `,
    "dragonflight_dungeon.HIPC": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p><strong>Catacombs & Dungeons</strong> – Düstere, beklemmende Verlies-Atmosphäre für die gefährlichen Tiefen und Labyrinthe von <em>Dragonflight</em>.</p>
        <p><strong>DSP- & Replay-Fokus:</strong> Hippel nutzt hier langgezogene, tief gestimmte Bass-Drones und unheimliche mikrotonale Pitch-Bends. Unser integriertes <em>Bauer Binaural Crossfeed</em> (700Hz / 4.5dB) fängt die harten L-R-R-L-Stereotrennungen ab und erzeugt einen unheimlich plastischen, klaustrophobischen Raumeindruck auf Kopfhörern.</p>
    `,
    "dragonflight_endsequence.HIPC": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p><strong>Victory & Credits</strong> – Die festliche Endsequenz-Fanfare für alle Helden, die das Geheimnis der verschwundenen Drachen gelüftet und die Welt von Dragonflight gerettet haben.</p>
        <p><strong>DSP- & Replay-Fokus:</strong> Triumphale Blechbläser-Fanfaren und orchestrale Percussion-Simulationen. Unser Lookahead True-Peak Limiter im Master-Bus fängt die massiven Signalspitzen bei maximalem 4-Kanal-Ausschlag verzerrungsfrei bei -0.35 dBFS ab und verhindert jedes Lautstärke-Ducking.</p>
    `,
    "dragonflight_ani.HIPC": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p><strong>Cinematic Flight Sequence</strong> – Die treibende Begleitmusik zur grafisch bahnbrechenden 3D-Flug- und Intro-Animation von Thalion-Legende Günter Schmitz.</p>
        <p><strong>DSP- & Replay-Fokus:</strong> Rasante Tempo- und Notenwechsel, synchron getaktet zum 50Hz-VBLANK-Raster des Amiga. Der Track fordert die COSO-Interpreter-Zustandsmaschine heraus und demonstriert die makellose Umschaltung zwischen verschiedenen Timbre- und Instrumenten-Banken zur Laufzeit.</p>
    `,
    "dragonflight_always.HIPC": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p><strong>Mystic Motif („Always“)</strong> – Ein melancholisches, hochgradig intimes musikalisches Leitmotiv, das in Schlüsselmomenten der Erzählung ertönt.</p>
        <p><strong>DSP- & Replay-Fokus:</strong> Feingliedrige Glocken- und Clavi-Wellenformen mit zarten Hüllkurven-Abklingkurven. Hier glänzt das analoge LF347-Op-Amp-Modell mit seiner begrenzten Slew Rate ($13\text{ V}/\mu\text{s}$), die selbst feinsten 8-Bit-Transienten den warmen, analogen Amiga-Schmelz verleiht.</p>
    `,

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
    const label = isHip ? "HIPPEL-COSO" : (isDw ? "WHITTAKER" : (isXm ? "FASTTRACKER" : "PROTRACKER"));

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