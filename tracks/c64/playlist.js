// === tracks/c64/external.js ===
// ==========================================
// C64 Jukebox Playlist Registry
// Curated Legendary Showcase Edition (incl. MoN)
// ==========================================

import { loadSidFile } from '../../js/parsers/sid-parser.js';

const mySidFiles = [
    "Commando.sid",                   // 1. Rob Hubbard
    "Wizball.sid",                    // 2. Martin Galway
    "Comic_Bakery.sid",               // <--- NEU: Martin Galways bahnbrechendes Meisterwerk!
    "Great_Giana_Sisters_PSID.sid",   // 3. Chris Hülsbeck
    "Bionic_Commando.sid",            // 4. Tim Follin
    "Last_Ninja.sid",                 // 5. Ben Daglish & Anthony Lees
    "Last_Ninja_2.sid",               // <--- NEU: Matt Grays Meisterwerk!
    "Cybernoid_II.sid",               // 6. Jeroen Tel
    "Supremacy.sid",                  // 7. Jeroen Tel
    "RoboCop_3.sid",                  // 8. Jeroen Tel
    "Myth.sid",                       // 9. Jeroen Tel
    "Monty_on_the_Run.sid",
    "Delta.sid",
    "To_Be_on_Top_PSID.sid",
    "Rambo_First_Blood_Part_II.sid",
    "Mega_Apocalypse_PSID.sid",
    "Miami_Vice.sid",                 
    "Way_of_the_Tiger.sid",           
    "Platoon.sid",                    
    "Compilation_I.sid",              
    "Compilation_II.sid"              
];

const composerMetadata = {
    "Comic_Bakery.sid": `
        <h3>[ COMPOSER SPOTLIGHT: MARTIN GALWAY ]</h3>
        <p>Der Soundtrack zu <strong>Comic Bakery</strong> (1985), komponiert von <strong>Martin Galway</strong>, ist einer der einflussreichsten und meistgecoverten Meilensteine der Chiptune-Geschichte. Galway erschuf hier ein elektronisches Kunstwerk, das die Grenzen des SID-Chips sprengte.</p>
        <p><strong>DSP-Fokus:</strong> Das legendäre Hauptthema demonstriert das Potential von Galways charakteristischer <strong>Pulsweitenmodulation (PWM)</strong>. Durch gezieltes Software-LFO-Wobbeln der Rechteckbreite erzeugte er einen fetten, chorusschwebenden Synthesizer-Bass. Gekoppelt mit rasanten 50Hz-VBLANK-Arpeggios gaukelt der Track dem Ohr eine dichte, vielstimmige Anordnung vor, obwohl der SID nur 3 Oszillatoren besitzt.</p>
    `,
    "Last_Ninja_2.sid": `
        <h3>[ COMPOSER SPOTLIGHT: MATT GRAY ]</h3>
        <p>Der Soundtrack zu <strong>Last Ninja 2: Back with a Vengeance</strong> (1988), komponiert von <strong>Matt Gray</strong>, ist eine absolute Chiptune-Ikone der C64-Geschichte. Gray verschmolz fernöstliche Harmonien mit wuchtigen, treibenden Funk/Synthwave-Basslines und schuf damit unvergessliche Tracks wie <em>Central Park</em> und <em>The Office</em>.</p>
        <p><strong>DSP-Fokus:</strong> Matt Gray kitzelte das subtraktive Potential des 6581 meisterhaft heraus. Seine butterweichen, flötengleichen Hauptmelodien im Mittenbereich harmonieren perfekt mit den knallhart gesnapten ADSR-Hüllkurven der Percussions. Unser cycle-genauer Mischer verarbeitet diese dichten Registerfahrten absolut phasenstarr und knackig.</p>
    `,
    "Commando.sid": `
        <h3>[ COMPOSER SPOTLIGHT: ROB HUBBARD ]</h3>
        <p><strong>Rob Hubbard</strong> ist der unangefochtene Rockgott des C64. Als er 1985 den Soundtrack zum Arcade-Port <em>Commando</em> ablieferte, veränderte er die Spielmusik für immer. Anstatt die von Commodore mitgelieferten, trägen Basic-Routinen zu nutzen, schrieb Hubbard seinen eigenen pfeilschnellen Maschinencode-Treiber.</p>
        <p><strong>DSP-Fokus:</strong> Achte auf die peitschenden, kratzigen Lead-Gitarren. Diese entstehen durch aggressive <strong>Oszillator-Synchronisation (Hard-Sync)</strong>. Unser 1-MHz-Core berechnet die Phase exakt auf der MSB-Flanke (Bit 23), und der neue Polyphase Sinc-FIR Decimator fängt das extreme Aliasing dieser Rechteck-Kreissägen perfekt ab.</p>
    `,
    "Wizball.sid": `
        <h3>[ COMPOSER SPOTLIGHT: MARTIN GALWAY ]</h3>
        <p>Wenn Hubbard der Rocker war, dann war <strong>Martin Galway</strong> der Pink Floyd der Chiptunes. Sein Soundtrack zu <em>Wizball</em> (1987) ist episch, atmosphärisch und von langsamen, organischen Filter-Sweeps geprägt.</p>
        <p><strong>DSP-Fokus:</strong> Galway war der Meister des "Floating DAC"-Hacks. In diesem Track nutzt er das Master-Volume-Register <code>$D418</code>, um digitale Rhythmus-Samples auszugeben. Unsere Engine fängt dieses Gleichspannungs-Leck auf die Mikrosekunde genau ab, während das analog gemodelte JFET-Filter für den knurrenden Sweep im Bass sorgt.</p>
    `,
    "Great_Giana_Sisters_PSID.sid": `
        <h3>[ COMPOSER SPOTLIGHT: CHRIS HUELSBECK ]</h3>
        <p>Bevor er den Amiga dominierte, zeigte <strong>Chris Hülsbeck</strong> auf dem C64 seine melodische Genialität. <em>The Great Giana Sisters</em> (1987) beweist, wie man mit nur drei Stimmen komplette orchestrale Pop-Hymnen aufbaut.</p>
        <p><strong>DSP-Fokus:</strong> Höre genau auf den legendären, perlenden Lead-Synthesizer. Er basiert auf <strong>Ring-Modulation</strong> (XOR-Bit-Kopplung) zwischen Dreieck- und Rechteck-Oszillator. Im Hintergrund murmelt ein fetter PWM-Bass, dessen Resonanz durch unser asymmetrisches JFET-Transistor-Modell weich und warm bei extrem tiefen Frequenzen sättigt.</p>
    `,
    "Bionic_Commando.sid": `
        <h3>[ COMPOSER SPOTLIGHT: TIM FOLLIN ]</h3>
        <p><strong>Tim Follin</strong> war der absolute Wahnsinnige unter den C64-Codern. Seine Soundtracks klingen eher nach Progressive-Metal-Alben, die auf einer CPU gerendert wurden. Er strapazierte den 6502-Prozessor so stark, dass bei seinen Routinen oft kaum noch CPU-Zeit für das eigentliche Spiel übrig blieb.</p>
        <p><strong>DSP-Fokus:</strong> Follin nutzte komplexe "Illegal Waveforms" und spielte mit Phaser-ähnlichen Effekten durch engmaschige Timer-Interrupts. Unser 1-MHz Lockstep-Mischer verarbeitet diese brutalen Timer-Hacks so präzise, dass die Phasenverschiebungen absolut sauber schwingen.</p>
    `,
    "Last_Ninja.sid": `
        <h3>[ COMPOSER SPOTLIGHT: BEN DAGLISH & ANTHONY LEES ]</h3>
        <p>Der Soundtrack zu <em>The Last Ninja</em> (1987) kombinierte traditionelle asiatische Melodie-Skalen mit harten 80er-Jahre Synthesizer-Beats. Er gilt bis heute als einer der längsten, abwechslungsreichsten und meistverkauften Game-Soundtracks aller Zeiten.</p>
        <p><strong>DSP-Fokus:</strong> Die extrem perkussiven Hüllkurven (ADSR) in diesem Track demonstrieren den Hardware-Bug "Sustain-Drop" und den "ADSR Pipeline Delay". Unser Core friert die Akkumulatoren beim Gate-Wechsel exakt ein und resettet den Rate-Divider. Das sorgt für das unerreichte "Snappen" der asiatischen Trommeln.</p>
    `,
    "Cybernoid_II.sid": `
        <h3>[ COMPOSER SPOTLIGHT: JEROEN TEL (MANIACS OF NOISE) ]</h3>
        <p><strong>Jeroen Tel</strong> definierte in den späten 80ern mit der Gruppe <em>Maniacs of Noise (MoN)</em> den ultimativen "Heavy"-Sound des C64. Seine Tracks (wie Cybernoid II, Myth oder Supremacy) sind berühmt für drückende, sub-bassige Kicks und unglaublich präsente, synthetische Snare-Drums.</p>
        <p><strong>DSP-Fokus:</strong> Tel trieb die analogen Grenzen des SID auf die Spitze. Er nutzte kombinierte Wellenformen (Sägezahn + Puls + Noise). Da wir diese Kombinationen nicht mehr logisch "ver-AND-en", sondern den physikalischen Kurzschluss (Wire-AND Pull-Down) der DAC-Leitungen auf dem Silizium exakt nachbilden, krachen diese Drums nun mit ihrer dreckigen Original-Wucht durch die Speaker.</p>
    `
};

// Verwende die Cybernoid-Beschreibung für alle Jeroen Tel Tracks als Referenz
composerMetadata["Supremacy.sid"] = composerMetadata["Cybernoid_II.sid"];
composerMetadata["RoboCop_3.sid"] = composerMetadata["Cybernoid_II.sid"];
composerMetadata["Myth.sid"] = composerMetadata["Cybernoid_II.sid"];

export const c64Playlist = mySidFiles.map((filename, index) => {
    const metaInfo = composerMetadata[filename] || `
        <h3>[ CLASSIC C64 SID ]</h3>
        <p>Ein historisches C64-Tracker-Dokument. Die kompilierte 6502-Maschinencode-Routine wird in Echtzeit von unserem 1-MHz Lockstep-CPU-Emulator berechnet, während der MOS 6581 Kern die analogen Wellenformen synthetisiert.</p>
    `;

    return {
        title: `${index + 1}. LOAD SID: ${filename}`,
        composerInfo: metaInfo,
        generator: function() { return []; },
        loadAsync: async function() {
            return await loadSidFile(`tracks/c64/${filename}`);
        }
    };
});