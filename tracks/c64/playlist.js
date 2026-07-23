// === tracks/c64/external.js ===
// ==========================================
// C64 Jukebox Playlist Registry
// Curated Legendary Showcase Edition (incl. MoN)
// ==========================================

import { loadSidFile } from '../../js/parsers/sid-parser.js';

const mySidFiles = [
    "Commando.sid",                   // 1. Rob Hubbard
    "Crazy_Comets.sid",               // Rob Hubbards Synthwave-Meisterwerk
    "Sanxion.sid",                    // Rob Hubbards Thalamusik
    "Lightforce.sid",                 // Rob Hubbards Chiptune-Hymne
    "Wizball.sid",                    // 2. Martin Galway
    "Comic_Bakery.sid",               // Martin Galways Meisterwerk
    "Arkanoid.sid",                   // Martin Galways $D418 Digidrum Meilenstein
    "Great_Giana_Sisters.sid",        // 3. Chris Hülsbeck
    "Bionic_Commando.sid",            // 4. Tim Follin
    "Last_Ninja.sid",                 // 5. Ben Daglish & Anthony Lees
    "Last_Ninja_2.sid",               // Matt Grays Meisterwerk
    "Turbo_Outrun.sid",               // <--- NEU: Jeroen Tels Zero-Page Digi-Benchmark!
    "Cybernoid_II.sid",               // 6. Jeroen Tel
    "Supremacy.sid",                  // 7. Jeroen Tel
    "RoboCop_3.sid",                  // 8. Jeroen Tel
    "Myth.sid",                       // 9. Jeroen Tel
    "Monty_on_the_Run.sid",
    "Delta.sid",
    "To_Be_on_Top.sid",
    "Rambo_First_Blood_Part_II.sid",
    "Mega_Apocalypse.sid",
    "Miami_Vice.sid",                 
    "Way_of_the_Tiger.sid",           
    "Platoon.sid",                    
    "Compilation_I.sid",              
    "Compilation_II.sid"              
];

const composerMetadata = {
    "Turbo_Outrun.sid": `
        <h3>[ COMPOSER SPOTLIGHT: JEROEN TEL (MANIACS OF NOISE) ]</h3>
        <p>Der Soundtrack zu <strong>Turbo Outrun</strong> (1989), komponiert von <strong>Jeroen Tel</strong> (Maniacs of Noise), ist ein technisches Meisterwerk. Er nutzt eine hybride Zero-Page-Sample-Routine, die im Sub-Frame-Takt 4-Bit-Digidrums direkt in den SID-Chip feuert.</p>
        <p><strong>DSP-Fokus:</strong> Dieser Track testet die flankengetriggerte CIA-2 NMI-Emulation und simultane $D418-Schreibzugriffe (Filter-Bits + Sample-Volume) unter extremen Bedingungen. Unser zyklenexakter Core führt die Zero-Page-Routinen ohne Verzögerung aus.</p>
    `,
    "Myth.sid": `
        <h3>[ COMPOSER SPOTLIGHT: JEROEN TEL (MANIACS OF NOISE) ]</h3>
        <p>Der Soundtrack zum System-3-Plattformer <strong>Myth: History in the Making</strong> (1989), komponiert von <strong>Jeroen Tel</strong> (Maniacs of Noise), ist ein unumstrittenes Meisterwerk düsterer Fantasy-Elektronik. Der Track verbindet mystische, getragene Klangteppiche mit extrem aggressiven, treibenden Beats und Melodie-Kaskaden.</p>
        <p><strong>DSP-Fokus:</strong> Jeroen Tel zeigt hier seine absolute Beherrschung der <strong>kombinierten "illegalen" Wellenformen</strong> (Sägezahn + Puls + Rauschen). Durch das meisterhafte Ausnutzen des physischen Wire-AND-Kurzschlusses der DAC-Leitungen auf dem Silizium kreiert er metallische, unglaublich druckvolle Snares und Hi-Hats, die unser cycle-genauer Emulator absolut originalgetreu wiedergibt.</p>
    `,
    "Lightforce.sid": `
        <h3>[ COMPOSER SPOTLIGHT: ROB HUBBARD ]</h3>
        <p>Der Soundtrack zu <strong>Lightforce</strong> (1986), komponiert von <strong>Rob Hubbard</strong> für das FTL-Weltraum-Shoot-'em-up (Hewson Consultants), ist eine der meistgeliebten Melodie-Hymnen der C64-Geschichte. Der Track besticht durch seine heroische Energie, treibende Rhythmik und eine unnachahmliche harmonische Tiefe.</p>
        <p><strong>DSP-Fokus:</strong> Der Track glänzt durch eine extrem epische Lead-Stimme und Hubbards charakteristische, dichte Schlagzeug-Emulation. Unser cycle-genauer 1-MHz-Mischer verarbeitet die rasanten PWM-Breiten-Modulationen und die knackig gesnapten ADSR-Hüllkurven vollkommen phasenstarr und randscharf, was den hymnischen Charakter des Stücks eindrucksvoll zur Geltung bringt.</p>
    `,
    "Delta.sid": `
        <h3>[ COMPOSER SPOTLIGHT: ROB HUBBARD ]</h3>
        <p>Der Soundtrack zum Thalamus-Shoot-'em-up <strong>Delta</strong> (1987), komponiert von <strong>Rob Hubbard</strong>, ist eine absolute Chiptune-Sensation. Das Titelthema kombiniert Einflüsse aus Pink Floyds Synthesizer-Sequence <em>On the Run</em> (Album: Dark Side of the Moon) und Philip Glass' minimalistischen Strukturen zu einer epischen Space-Synth-Atmosphäre.</p>
        <p><strong>DSP-Fokus:</strong> <em>Delta</em> ist ein Lehrstück für komplexe Sequenzer-Arpeggios und treibende Bass-Grooves. Hubbard nutzt hier im Sekundentakt wechselnde Pulsweitenmodulationen und sachte Filter-Sweeps, um dem Soundtrack seine spacige Breite zu verleihen. Unser cycle-genauer Emulator bringt diese dichten Registerdaten absolut phasenstarr und ohne Aliasing-Rauschen auf deine Lautsprecher.</p>
    `,
    "Monty_on_the_Run.sid": `
        <h3>[ COMPOSER SPOTLIGHT: ROB HUBBARD ]</h3>
        <p>Der Soundtrack zu <strong>Monty on the Run</strong> (1985), komponiert von <strong>Rob Hubbard</strong> für das Gremlin-Graphics-Plattformspiel, ist ein Meilenstein der programmierbaren Melodieführung. Der Track ist berühmt für sein atemberaubendes, rasend schnelles <strong>E-Geigen-Solo (Violin Solo)</strong>, das als eines der virtuosesten Stücke gilt, die je für den C64 geschrieben wurden.</p>
        <p><strong>DSP-Fokus:</strong> Hubbard emuliert hier das physische Kratzen, Anreißen und schwebende Vibrato eines Geigenbogens. Er erreichte dies durch extrem optimierte, hochfrequente CPU-Interrupts (Timer-gesteuert), die die Oszillator-Wellenform und Filterhüllkurve über 100-mal pro Sekunde zur Laufzeit anpassen. Unser cycle-genauer 1-MHz-Mischer verarbeitet diese brutalen Hardware-Hacks phasenstarr und ohne Artefakte.</p>
    `,
    "Crazy_Comets.sid": `
        <h3>[ COMPOSER SPOTLIGHT: ROB HUBBARD ]</h3>
        <p>Der Soundtrack zu <strong>Crazy Comets</strong> (1985), komponiert von <strong>Rob Hubbard</strong> für das Martech-Weltraumspiel, gilt als eines der absolut wegbereitendsten Synthwave-Elektronik-Meisterwerke der Chiptune-Geschichte. Hubbard selbst bezeichnete den Track häufig als eine seiner besten Arbeiten.</p>
        <p><strong>DSP-Fokus:</strong> Der Track glänzt durch eine extrem fette, treibende F-Dur-Bassline und hochkomplexe, metallische Drums, die den SID-Chip an seine physikalischen Grenzen bringen. Das absolute Highlight ist Hubbards legendäre Programmierung einer <strong>künstlichen, roboterhaften Alien-Stimme (Voice Synthesis)</strong> auf dem 6581, die durch blitzschnelle Register-Hacks im Millisekundentakt geformt wird – ein Meisterwerk der Programmierkunst, das unser cycle-genauer Emulator absolut fehlerfrei wiedergibt.</p>
    `,
    "Sanxion.sid": `
        <h3>[ COMPOSER SPOTLIGHT: ROB HUBBARD ]</h3>
        <p>Der Soundtrack zu <strong>Sanxion</strong> (1986), komponiert von <strong>Rob Hubbard</strong> für das erste Spiel des Publishers Thalamus, ist ein akustisches Denkmal. Subtune 1 (die berühmte Lademusik <em>Thalamusik</em>) wurde von Jean-Michel Jarres Album <em>Zoolook</em> inspiriert, während das Titelthema Sergei Prokofjews dramatischen <em>Tanz der Ritter</em> aus dem Ballett Romeo und Julia meisterhaft adaptiert.</p>
        <p><strong>DSP-Fokus:</strong> <em>Thalamusik</em> glänzt durch seine fließenden, sphärischen Analogsounds und die unnachahmliche, beinahe jazzige Hubbard-Solostimme. Der Track nutzt das subtraktive Synthesepotential des 6581 voll aus, indem er extrem komplexe, LFO-artige PWM-Sweeps mit harten, bissigen Hüllkurven koppelt, die unser randscharfer Mischer vollkommen verzerrungsfrei wiedergibt.</p>
    `,
    "Arkanoid.sid": `
        <h3>[ COMPOSER SPOTLIGHT: MARTIN GALWAY ]</h3>
        <p>Der Soundtrack zur C64-Portierung von <strong>Arkanoid</strong> (1987), komponiert von <strong>Martin Galway</strong>, ist ein historisches Novum: Es war das <strong>allererste Mal in der Geschichte</strong>, dass echte, digitale PCM-Drums (Samples) innerhalb einer musikalischen Komposition auf dem Commodore 64 abgespielt wurden!</p>
        <p><strong>DSP-Fokus:</strong> Das Titelthema basiert auf Galways eigener Speccy-Musik aus dem Spiel <em>Cobra</em>, wurde aber für den SID mit spektakulären, metallischen Digidrums veredelt. Durch das blitzschnelle Beschreiben des 4-Bit-Lautstärkeregisters erzeugte er den berühmten samplebasierten "Galway-Hack" ($D418), den unser cycle-genauer 1-MHz-Mischer originalgetreu emuliert.</p>
    `,
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