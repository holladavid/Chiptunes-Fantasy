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
    "dragonflight/dragonflight_titletune.HIPC",  // Main Title Theme (7.5 Min. Epos)
    "dragonflight/dragonflight_surface.HIPC",    // Overworld / Wilderness Travel
    "dragonflight/dragonflight_town.HIPC",       // Towns, Taverns & Marketplaces
    "dragonflight/dragonflight_dungeon.HIPC",    // Underground Catacombs & Caverns
    "dragonflight/dragonflight_endsequence.HIPC",// Victory Fanfare & End Credits
    "dragonflight/dragonflight_ani.HIPC",        // Cinematic Dragon Flight & Intro Anim
    "dragonflight/dragonflight_always.HIPC",     // Atmospheric Mystic Motif

    // --- JOCHEN HIPPEL: AMBERSTAR AMIGA COSO SUITE ---
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

    // --- JOCHEN HIPPEL: WINGS OF DEATH (7-VOICE COSO / HIP SUITE) ---
    "wings-of-death/Wings_Of_Death-Title.hip",     // Main Title Theme
    "wings-of-death/Wings_Of_Death-Level_1.hipc",   // Level 1: Over the Trees
    "wings-of-death/Wings_Of_Death-Level_2.hipc",   // Level 2: Inside the Cave
    "wings-of-death/Wings_Of_Death-Level_3.hipc",   // Level 3: Desert Rocks
    "wings-of-death/Wings_Of_Death-Level_4.hipc",   // Level 4: Mechanical Castle
    "wings-of-death/Wings_Of_Death-Level_5.hipc",   // Level 5: Bio-Hazard / Organic
    "wings-of-death/Wings_Of_Death-Level_6.hipc",   // Level 6: Glacier / Ice
    "wings-of-death/Wings_Of_Death-Level_7.hipc",   // Level 7: Volcanic / Fire
    "wings-of-death/Wings_Of_Death-End.hipc",       // End / Highscore Credits

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
    // AMBERSTAR (JOCHEN HIPPEL / MAD MAX) METADATA
    // =========================================================
    "amberstar/City_Walk.hipc": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p><strong>City Walk</strong> – Der Name klingt nach einem ruhigen Streifzug durch eine Stadt Lyramions statt nach einer Schlachtfanfare; ein schönes Gegenstück zur großen Fantasy-Geste des Spiels.</p>
        <p><strong>COSO-Forensik:</strong> Der Track enthält 38 Divisions, 34 Monopatterns, 8 Instrumente und 13 Timbres. Die Sequenz verweist also auf 34 wiederverwendbare Pattern-Bausteine und eine Sample-Tabelle mit 10 Einträgen.</p>
    `,
    "amberstar/Dreamcave.hipc": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p><strong>Dreamcave</strong> – Der Titel verspricht eher eine traumartige Höhle als einen konventionellen Dungeon; Hippels Amberstar-Musik lebt gerade von solchen Stimmungswechseln zwischen Abenteuer und Innenschau.</p>
        <p><strong>COSO-Forensik:</strong> 60 Divisions werden mit nur 14 Monopatterns gebaut. Dazu kommen 6 Instrumente, 7 Timbres und 6 Samples – ein kompaktes Beispiel dafür, wie viel Wiederholung und Variation eine kleine Pattern-Bibliothek ermöglicht.</p>
    `,
    "amberstar/Eriks_Revenge.hipc": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p><strong>Erik's Revenge</strong> – Der augenzwinkernde Dateiname liest sich wie ein persönlicher Mini-Plot innerhalb des großen Rollenspiel-Soundtracks.</p>
        <p><strong>COSO-Forensik:</strong> 50 Monopatterns speisen 41 Divisions; das Modul nutzt 9 Instrumente und 17 Timbres. Eine Division ist dabei ein kleiner Sequenzschritt, der Pattern und Transposition pro Stimme festlegt.</p>
    `,
    "amberstar/Fanfares.hipc": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p><strong>Fanfares</strong> – Ein Titel wie gemacht für Ankünfte, Entdeckungen oder große RPG-Momente. Die Datei bündelt tatsächlich eine vollständige Sequenz und nicht bloß einen einzelnen kurzen Signalton.</p>
        <p><strong>COSO-Forensik:</strong> 63 Divisions greifen auf 45 Monopatterns, 11 Instrumente und 19 Timbres zurück. Die 12 Sample-Einträge im Header zeigen, wie das Format synthetische Wellenformen und digitale Samples in derselben Komposition verwaltet.</p>
    `,
    "amberstar/Flying_High.hipc": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p><strong>Flying High</strong> – Der Name gibt der Musik einen klaren Aufwärtsimpuls: ein passender Kontrast zu den düsteren Höhlen- und Horror-Titeln im selben Set.</p>
        <p><strong>COSO-Forensik:</strong> Das Modul ist in 64 Divisions organisiert, verwendet aber nur 26 Monopatterns. 8 Instrumente, 12 Timbres und 10 Samples bilden die Klangpalette.</p>
    `,
    "amberstar/Funkey_Dungeon.hipc": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p><strong>Funkey Dungeon</strong> – Schon die Schreibweise macht aus dem Dungeon-Motiv eher einen Groove als eine reine Gruselkulisse; genau solche spielerischen Kontraste halten lange RPG-Soundtracks abwechslungsreich.</p>
        <p><strong>COSO-Forensik:</strong> 43 Monopatterns verteilen sich auf 64 Divisions. Dafür reichen 6 Instrumente und 11 Timbres – mit 7 Sample-Einträgen ein vergleichsweise kleines Klanginventar.</p>
    `,
    "amberstar/Gwens_Lament.hipc": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p><strong>Gwen's Lament</strong> – Der Titel deutet auf eine persönliche, melancholische Szene hin. Hippel komponierte für Amberstar nicht nur funktionale Kampf- und Reisemusik, sondern auch solche erzählerisch gefärbten Miniaturen.</p>
        <p><strong>COSO-Forensik:</strong> 68 Divisions und 52 Monopatterns bilden die längste Sequenz dieses Sets (geteilt mit <em>Irish Spring</em>); der Header nennt außerdem 9 Instrumente, 16 Timbres und 12 Samples.</p>
    `,
    "amberstar/Hasta_La_Vista.hipc": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p><strong>Hasta La Vista</strong> – Ein ungewöhnlich umgangssprachlicher Abschiedsgruß zwischen den eher märchenhaften Tracknamen; gerade dieser Kontrast macht die Archivsammlung charmant.</p>
        <p><strong>COSO-Forensik:</strong> Die Sequenz verwendet 24 Monopatterns über 59 Divisions, dazu 9 Instrumente, 15 Timbres und 7 Sample-Einträge.</p>
    `,
    "amberstar/High_Seas.hipc": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p><strong>High Seas</strong> – Der Titel öffnet den Maßstab vom Dungeon auf eine weite Seereise. Ein guter Anlass, auf Hippels Fähigkeit zu achten, innerhalb derselben Spielwelt sehr unterschiedliche Klangräume anzudeuten.</p>
        <p><strong>COSO-Forensik:</strong> Mit 36 Divisions ist dies eine der kürzeren Sequenzen im Set. Die Klangpalette ist dafür breit: 13 Instrumente, 13 Timbres und 12 Samples.</p>
    `,
    "amberstar/Horse_Song.hipc": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p><strong>Horse Song</strong> – Der Name klingt nach Reisebegleitung und gibt dem Stück eine bodenständigere Farbe als den magischen oder bedrohlichen Titeln.</p>
        <p><strong>COSO-Forensik:</strong> 66 Divisions nutzen 23 Monopatterns. Besonders nerdig: 8 Instrumente und 13 Timbres teilen sich 10 Sample-Einträge – Instrumente und Timbres sind im COSO-Format getrennte Ebenen.</p>
    `,
    "amberstar/Irish_Spring.hipc": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p><strong>Irish Spring</strong> – Der Titel weckt folkige Assoziationen, ohne dass dafür ein echtes irisches Instrument nötig wäre: Das Arrangement entsteht aus Hippels programmierten Instrumenten und Samples.</p>
        <p><strong>COSO-Forensik:</strong> Wie <em>Gwen's Lament</em> umfasst der Track 68 Divisions, nutzt aber 41 statt 52 Monopatterns. Der Header zählt 8 Instrumente, 13 Timbres und 12 Samples.</p>
    `,
    "amberstar/Lullaby.hipc": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p><strong>Lullaby</strong> – Ein Wiegenlied-Titel mitten in einem epischen Rollenspiel ist ein Hinweis auf die Bandbreite des Scores: nicht jede Szene braucht ein heroisches Leitmotiv.</p>
        <p><strong>COSO-Forensik:</strong> Der Header zählt 17 Instrumente und 17 Timbres – gemeinsam mit <em>Travellers Tune</em> die höchsten Werte dieses Sets. Die 40 Divisions greifen auf 47 Monopatterns und 9 Samples zurück.</p>
    `,
    "amberstar/Lurking_Horror.hipc": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p><strong>Lurking Horror</strong> – Der Titel setzt auf Spannung durch Erwartung: Das Unheimliche lauert, statt sofort als großes Action-Thema aufzutreten.</p>
        <p><strong>COSO-Forensik:</strong> 52 Divisions werden aus 26 Monopatterns zusammengesetzt. Das Modul hat 8 Instrumente, 12 Timbres und 7 Sample-Einträge.</p>
    `,
    "amberstar/Minor_Quarrels.hipc": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p><strong>Minor Quarrels</strong> – „Kleine Streitigkeiten“ klingt nach einem bewusst weniger apokalyptischen Konfliktmaßstab – ein hübscher Kontrast zu den Weltrettungsdimensionen des Spiels.</p>
        <p><strong>COSO-Forensik:</strong> Mit 113 Divisions ist dies die mit Abstand längste Sequenz der 19 Module. Sie verwendet 65 Monopatterns, 10 Instrumente, 19 Timbres und 9 Samples.</p>
    `,
    "amberstar/Misty_Orc_Hop.hipc": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p><strong>Misty Orc Hop</strong> – Nebel, Orks und ein „Hop“: Der Titel mischt Fantasy-Gefahr mit einem unerwartet tänzerischen Augenzwinkern.</p>
        <p><strong>COSO-Forensik:</strong> 39 Monopatterns verteilen sich auf 49 Divisions; die vergleichsweise kleine Palette umfasst 6 Instrumente, 7 Timbres und 7 Samples.</p>
    `,
    "amberstar/Mystic_Moments.hipc": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p><strong>Mystic Moments</strong> – Ein Titel für kurze magische Atempausen im Abenteuer. Hippels Rollenspielmusik ist nicht nur Kulisse, sondern arbeitet mit wiedererkennbaren Stimmungsfarben.</p>
        <p><strong>COSO-Forensik:</strong> 31 Monopatterns speisen 42 Divisions. Im Header stehen 7 Instrumente, 12 Timbres und 7 Sample-Einträge.</p>
    `,
    "amberstar/Ode_To_Schnism.hipc": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p><strong>Ode to Schnism</strong> – Ein rätselhafter Eigenname im Titel, der die Trackliste wie eine kleine Widmung wirken lässt; die Bedeutung von „Schnism“ ist aus den Dateidaten allein nicht belegbar.</p>
        <p><strong>COSO-Forensik:</strong> 19 Timbres sind hier mit 12 Instrumenten kombiniert. Die 45 Divisions greifen auf 46 Monopatterns und 12 Samples zu.</p>
    `,
    "amberstar/Travellers_Tune.hipc": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p><strong>Traveller's Tune</strong> – Der Titel passt zum Kern eines großen Rollenspiels: unterwegs sein. Als Gegenstück zu <em>City Walk</em> steht hier eher die Reise als der einzelne Ort im Vordergrund.</p>
        <p><strong>COSO-Forensik:</strong> Nur 19 Monopatterns tragen die 44 Divisions. Mit 17 Instrumenten und 17 Timbres ist die Klangpalette trotzdem besonders groß; der Header führt 9 Samples.</p>
    `,
    "amberstar/Ingame.hipc": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p><strong>Ingame</strong> – Der generische Name markiert vermutlich eine allgemeine Spielmusik-Datei; eine konkretere Szenenzuordnung lässt sich aus dem Dateinamen nicht sicher ableiten.</p>
        <p><strong>COSO-Forensik:</strong> Das kleinste Instrumentarium der Sammlung: 5 Instrumente und 7 Timbres strukturieren 26 Monopatterns über 40 Divisions, ergänzt um 7 Sample-Einträge.</p>
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
    const displayFilename = filename.split('/').pop();

    const metaInfo = composerMetadata[filename] || composerMetadata[displayFilename] || `
        <h3>[ CLASSIC AMIGA MODULE ]</h3>
        <p>Ein historisches Amiga-Tracker-Dokument. Geladen und emuliert direkt im RAM des Webbrowsers über unseren maßgeschneiderten MOS Paula 8364 Core.</p>
    `;

    return {
        path: filename,
        title: `${index + 1}. LOAD ${label}: ${displayFilename}`,
        composerInfo: metaInfo,
        generator: function() { return []; },
        loadAsync: async function() {
            if (isHip) {
                if (filename.startsWith('amberstar/')) {
                    return await loadHipcFile(`tracks/amiga/${filename}`, {
                        sampleBankUrl: 'tracks/amiga/amberstar/hipc.samp',
                        replayerOptions: { envSpec: true }
                    });
                }
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