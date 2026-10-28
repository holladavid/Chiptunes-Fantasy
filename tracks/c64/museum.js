// Recherchierte Museumstexte für die vollständige C64-Playlist.
// Historische Angaben, lokale SID-Header und Wiedergabetechnik sind getrennt.
// Öffentliche HVSC-Verfügbarkeit bedeutet nicht Public Domain.

const HVSC_SOURCE = {
    label: 'HVSC #85: STIL & Songlengths',
    url: 'https://www.hvsc.c64.org/downloads'
};

function museum(title, history, replay, ...sources) {
    const links = [HVSC_SOURCE, ...sources]
        .map(source => `<a href="${source.url}" target="_blank" rel="noopener noreferrer">${source.label}</a>`)
        .join(' · ');
    return `
        <h3>[ MUSEUM: ${title} ]</h3>
        <p><strong>Historie:</strong> ${history}</p>
        <p><strong>SID &amp; Replay:</strong> ${replay}</p>
        <p class="museum-sources"><strong>Quellen:</strong> ${links}</p>
    `;
}

const csdb = (id, label) => ({ label: `CSDb: ${label}`, url: `https://csdb.dk/release/?id=${id}` });

export const c64MuseumMetadata = {
    "Commando.sid": museum(
        'ROB HUBBARD — COMMANDO',
        `<strong>Commando</strong> erschien 1985 bei Elite. <strong>Rob Hubbard</strong> erzählt, dass er die C64-Fassung in einer Nacht erstellte und dabei weit über eine wörtliche Übertragung von Tamayo Kawamotos Arcade-Musik hinausging. STIL ordnet einzelne Abschnitte des Hauptstücks dennoch konkreten Arcade-Themen zu.`,
        `Lokaler Header: <strong>PSID v2, 19 Subsongs, Start 1</strong>. Die lange erste Sequenz bildet den bekannten Hauptteil; die übrigen Subsongs enthalten kurze Spielsignale. Die Wiedergabe erfolgt aus dem gespeicherten 6510-Code, nicht aus einer nachträglich sequenzierten Tracker-Datei.`,
        { label: 'C64 Audio: Rob Hubbard 1985', url: 'https://c64audio.com/blogs/rob-hubbard-master-of-magic/rob-hubbard-1985-on-the-run' }
    ),
    "Crazy_Comets.sid": museum(
        'ROB HUBBARD — CRAZY COMETS',
        `<strong>Crazy Comets</strong> erschien 1985 bei Martech mit Musik von <strong>Rob Hubbard</strong>. Das Spiel ist der Vorgänger von <em>Mega Apocalypse</em>; Hubbard selbst äußerte später, dass er die Musik des ersten Teils bevorzugte. Frühere Behauptungen über eine roboterhafte Sprachsynthese sind für diese Datei nicht belastbar belegt.`,
        `Lokaler Header: <strong>PSID v2, 17 Subsongs, Start 1</strong>. HVSC führt für das Hauptstück 4:36 Minuten und für die übrigen Subsongs überwiegend kurze Effekte beziehungsweise Jingles. Der Text trennt diese dokumentierten Bestandteile von späteren Sample-Legenden.`,
        { label: 'C64 Audio: Rob Hubbard 1985', url: 'https://c64audio.com/blogs/rob-hubbard-master-of-magic/rob-hubbard-1985-on-the-run' }
    ),
    "Sanxion.sid": museum(
        'ROB HUBBARD — SANXION',
        `<strong>Sanxion</strong> war Thalamus’ erstes Spiel und erschien 1986. <strong>Rob Hubbard</strong> nennt Jean-Michel Jarres <em>Zoolook</em> als Inspiration für die Lademusik <strong>Thalamusik</strong>. Der zweite Subsong adaptiert Sergei Prokofjews <em>Tanz der Ritter</em> aus <em>Romeo und Julia</em>.`,
        `Lokaler Header: <strong>PSID v2, zwei Subsongs, Start 1</strong>. Die HVSC-Längen betragen 5:34 für <em>Thalamusik</em> und 3:06 für die Prokofjew-Adaption. Gerade die getrennten Subsongs zeigen, dass Lade- und Spielmusik nicht zu einem einzigen Track vermischt werden sollten.`
    ),
    "Lightforce.sid": museum(
        'ROB HUBBARD — LIGHTFORCE',
        `<strong>Lightforce</strong> erschien 1986 bei Faster Than Light. Die Musik stammt von <strong>Rob Hubbard</strong>. Sein späterer Kommentar ist bemerkenswert selbstkritisch: Den Rhythmus fand er gelungen, den Rest deutlich weniger. Diese Einordnung ersetzt die frühere werbliche Beschreibung durch eine dokumentierte Künstlerperspektive.`,
        `Lokaler Header: <strong>PSID v2, ein Subsong</strong>. HVSC #85 verzeichnet eine Länge von <strong>7:13,481</strong> – deutlich mehr als der frühere lokale Näherungswert. Der SID enthält den kompletten Replay-Code und die Musikdaten in einer Datei.`
    ),
    "Wizball.sid": museum(
        'MARTIN GALWAY — WIZBALL',
        `<strong>Wizball</strong> erschien 1987 bei Ocean. <strong>Martin Galway</strong> beschreibt besonders die intensive Arbeit am Klangdesign der Stimmen. STIL dokumentiert außerdem John Hares Bass-Riffs für die Bonusmusik und Chris Yates’ Gitarrenriff für das Game-over-Stück.`,
        `Lokaler Header: <strong>PSID v2, neun Subsongs, Start 4</strong> – die Datei öffnet daher direkt mit der Titelmusik. Die lokale Binärvariante bleibt erhalten; ihre Songlängen sind dem eindeutig zugeordneten HVSC-Titelpfad entnommen. Ein pauschaler D418-Sample-Nachweis wird für diesen Eintrag nicht behauptet.`
    ),
    "Comic_Bakery.sid": museum(
        'MARTIN GALWAY — COMIC BAKERY',
        `<strong>Comic Bakery</strong> erschien 1986 bei Imagine. <strong>Martin Galway</strong> erklärt, dass das Titelstück ursprünglich als Cover von Level 42s <em>Hot Water</em> begann, sich aber schon früh in eine eigene Komposition entwickelte. Subsong 6 adaptiert <em>Tea for Two</em> von Vincent Youmans und Irving Caesar.`,
        `Lokaler Header: <strong>PSID v2, 14 Subsongs, Start 1</strong>. Neben dem 3:09 Minuten langen Hauptthema enthält die Datei kürzere Spielmusiken und Jingles. Die technische Einordnung beschränkt sich auf diese nachweisbaren Bestandteile statt auf nicht belegte Interrupt- oder PWM-Werte.`
    ),
    "Arkanoid.sid": museum(
        'MARTIN GALWAY — ARKANOID',
        `<strong>Arkanoid</strong> erschien 1987 bei Imagine. <strong>Martin Galway</strong> ordnet die veröffentlichte C64-Fassung selbst als erstes veröffentlichtes C64-Stück mit Samples ein, betont aber ausdrücklich, die Technik des Schreibens auf das Lautstärkeregister nicht erfunden zu haben. Das Titelthema verwertet seine Musik aus dem Spectrum-Spiel <em>Cobra</em>; weitere Subsongs adaptieren Hisayoshi Oguras Arcade-Material.`,
        `Lokaler Header: <strong>RSID v2, 20 Subsongs, Start 1</strong>. RSID ist hier ein wichtiger Dateibefund: Die Fassung ist für ein realistischeres C64-Wiedergabemodell gedacht und nicht mit einem beliebigen PSID-Rip gleichzusetzen. Die Sample-Aussage bezieht sich auf Galways dokumentierte veröffentlichte Fassung.`
    ),
    "Great_Giana_Sisters.sid": museum(
        'CHRIS HÜLSBECK — THE GREAT GIANA SISTERS',
        `<strong>The Great Giana Sisters</strong> erschien 1987. <strong>Chris Hülsbeck</strong> beschreibt die Ingame-Musik als leicht reggae-inspiriert und das Titelthema als Hommage an Madonnas <em>True Blue</em>. Gleichzeitig betont er den eigenen Charakter der Stücke – eine wesentlich differenziertere Einordnung als bloße Vergleiche mit anderen Spielen.`,
        `Lokaler Header: <strong>RSID v2, 23 Subsongs, Start 1</strong>. Die Datei bündelt Titel-, Level- und kurze Ereignismusik. HVSC liefert für alle 23 Subsongs eigene Längen; der frühere verkürzte Acht-Werte-Eintrag wurde deshalb ersetzt.`
    ),
    "Bionic_Commando.sid": museum(
        'TIM FOLLIN — BIONIC COMMANDO',
        `<strong>Bionic Commando</strong> erschien 1988 für den C64 bei GO!/Capcom. <strong>Tim Follin</strong> begann mit einer Übertragung von Harumi Fujitas Arcade-Musik, ließ das Arrangement dann aber bewusst in eine eigene Richtung wachsen. STIL vermerkt unter anderem ein kurzes <em>Binary Sunset</em>-Zitat in Subsong 6 und die eigenständigen Stücke 1 und 10.`,
        `Lokaler Header: <strong>PSID v2, zehn Subsongs, Start 1</strong>. Die vorliegende Binärvariante bleibt unverändert; die zehn offiziellen Längen stammen vom zugeordneten HVSC-Titel. Die Datei eignet sich dadurch besonders gut zum Vergleich von Arcade-Vorlage und Follins eigener Erweiterung.`
    ),
    "Last_Ninja.sid": museum(
        'BEN DAGLISH & ANTHONY LEES — THE LAST NINJA',
        `<strong>The Last Ninja</strong> erschien 1987 bei System 3. Der Soundtrack ist eine Arbeit von <strong>Ben Daglish und Anthony Lees</strong>, nicht eine Serienproduktion eines einzelnen Komponisten. STIL weist den elf Subsongs einzelne Autoren und Spielbereiche zu; die Lade- und Ingame-Fassungen sind dabei bewusst zu unterscheiden.`,
        `Lokaler Header: <strong>PSID v2, elf Subsongs, Start 3</strong> – also <em>The Wastelands</em> als Lademusik. Die lokale Binärvariante bleibt erhalten, während die Songlängen aus dem zugehörigen HVSC-Eintrag übernommen wurden. Einzelne historische Autorenschaftsfragen werden von STIL ausdrücklich dokumentiert, nicht glattgezogen.`
    ),
    "Last_Ninja_2.sid": museum(
        'MATT GRAY — LAST NINJA 2',
        `<strong>Last Ninja 2: Back with a Vengeance</strong> erschien 1988. <strong>Matt Gray</strong> begann mit den Central-Park-Stücken, um dem Spiel seinen Klang zu geben, und bezeichnet den Soundtrack später als eine seiner wichtigsten Arbeiten. STIL dokumentiert zudem Anleihen bei Bomb the Bass, Tangerine Dream und Rob Hubbard in einzelnen Levelstücken.`,
        `Lokaler Header: <strong>PSID v2, 13 Subsongs, Start 1</strong>. Die Lade- und Ingame-Stücke für Central Park, Street, Sewers, Basement, Office und Mansion sind separat aufrufbar. Diese Struktur macht den Umfang des Scores unmittelbar im SID sichtbar.`
    ),
    "Turbo_Outrun.sid": museum(
        'JEROEN TEL — TURBO OUTRUN',
        `<strong>Turbo Outrun</strong> erschien 1989 bei US Gold/Probe. <strong>Jeroen Tel</strong> berichtet, dass er viele Stücke etwa dreimal neu komponierte. STIL ordnet zahlreiche Subsongs Vorlagen von Hiroshi Kawaguchi und Yasuhiro Takagi zu; im Intro ist Tels eigene gesampelte Stimme zu hören.`,
        `Lokaler Header: <strong>RSID v2, zwölf Subsongs, Start 1</strong>. Intro, Titel, Level 1–4, Tune-up und Endsequenzen sind getrennt abgelegt. Die Sample- und Arcade-Bezüge stammen aus STIL; eine pauschale „Zero-Page-Benchmark“-Behauptung wurde aus dem alten Text entfernt.`
    ),
    "Cybernoid_II.sid": museum(
        'JEROEN TEL — CYBERNOID II',
        `<strong>Cybernoid II</strong> erschien 1988 bei Hewson mit Musik von <strong>Jeroen Tel</strong>. Anders als der frühere Sammeltext behauptete, besitzt dieser Eintrag eine eigene, kleine Dokumentation: STIL benennt lediglich Titelmusik und Game-over-Stück, ohne zusätzliche Myth-, Supremacy- oder RoboCop-Details hineinzukopieren.`,
        `Lokaler Header: <strong>PSID v2, zwei Subsongs, Start 1</strong>. HVSC verzeichnet 5:46 Minuten für den Titel und acht Sekunden für das Game-over-Signal. Diese schlanke Struktur ist der belastbare technische Befund.`
    ),
    "Supremacy.sid": museum(
        'JEROEN TEL — SUPREMACY / OVERLORD',
        `<strong>Supremacy</strong> erschien mit Musik von <strong>Jeroen Tel</strong>; der lokale Header nennt 1991 und Virgin. Das Spiel wurde auch als <strong>Overlord</strong> veröffentlicht. Der eigenständige Eintrag ersetzt den früheren Alias auf den Cybernoid-II-Text und hält Titel und Alternativname auseinander.`,
        `Lokaler Header: <strong>PSID v2, drei Subsongs, Start 1</strong>. Die HVSC-Längen betragen 3:51, 0:39 und 2:31. Der technische Kern des Museumsbefunds ist damit die konkrete Drei-Subsong-Struktur, nicht eine unbelegte Wellenform-Behauptung.`
    ),
    "RoboCop_3.sid": museum(
        'JEROEN TEL — ROBOCOP 3',
        `<strong>RoboCop 3</strong> erschien 1992 bei Ocean. <strong>Jeroen Tels</strong> erster Subsong war bereits im Dezember 1991 in der Demo <em>Dutch Breeze</em> zu hören – ein gut dokumentiertes Beispiel dafür, wie Demo- und Spielmusik zeitlich verschränkt waren. Tel weist außerdem darauf hin, dass die Subsongs 4 und 5 jeweils nur eine Stimme verwenden.`,
        `Lokaler Header: <strong>PSID v2, 20 Subsongs, Start 1</strong>. Neben längeren Musikstücken enthält die Datei viele kurze Spielsignale. Die Ein-Stimmen-Beobachtung bezieht sich ausdrücklich nur auf die Subsongs 4 und 5.`,
        csdb(11584, 'Dutch Breeze')
    ),
    "Myth.sid": museum(
        'JEROEN TEL — MYTH',
        `<strong>Myth: History in the Making</strong> erschien 1989 bei System 3. <strong>Jeroen Tel</strong> komponierte die Musik; STIL dokumentiert für Subsong 2 zusätzlich eine aufgenommene Sprachstimme. Programmierer Peter Baron beschreibt, wie Grafiker Bob Stevenson das Samplematerial erstellte und es kurz vor Projektende integriert wurde.`,
        `Lokaler Header: <strong>RSID v2, drei Subsongs, Start 1</strong>. Die Datei enthält somit zwei längere Musikabschnitte und ein sehr kurzes Ereignis. Der Samplehinweis bezieht sich konkret auf Subsong 2 und wird nicht zu einer allgemeinen Behauptung über kombinierte Wellenformen ausgeweitet.`
    ),
    "Monty_on_the_Run.sid": museum(
        'ROB HUBBARD — MONTY ON THE RUN',
        `<strong>Monty on the Run</strong> erschien 1985 bei Gremlin Graphics. <strong>Rob Hubbard</strong> nennt Charles Williams’ <em>The Devil’s Gallop</em> aus der Radioserie <em>Dick Barton</em> als Ausgangspunkt. Den Mittelteil nutzte er, um einen neu geschriebenen Pitch-Bend-Code einzusetzen – eine belegte technische Besonderheit statt der früheren erfundenen Interrupt-Zahl.`,
        `Lokaler Header: <strong>PSID v2, 19 Subsongs, Start 1</strong>. Das 5:50 Minuten lange Hauptstück steht neben einer alternativen Fassung und zahlreichen kurzen Jingles. Die Pitch-Bend-Information betrifft den dokumentierten Mittelteil des Hauptstücks.`,
        { label: 'C64 Audio: Rob Hubbard 1985', url: 'https://c64audio.com/blogs/rob-hubbard-master-of-magic/rob-hubbard-1985-on-the-run' }
    ),
    "Delta.sid": museum(
        'TOMAS DANKO — DELTA / REINTERPRETATION',
        `Die lokale Datei ist <strong>nicht Rob Hubbards Original-SID</strong>, sondern <strong>Tomas Dankos</strong> 1989 veröffentlichte Interpretation. STIL beschreibt den Anfang als Bezug auf Philip Glass’ <em>Koyaanisqatsi</em>; ab 0:52 folgt Dankos Cover des eigenen Abschnitts aus Hubbards Delta-Subsong 12.`,
        `Lokaler Header: <strong>PSID v2, ein Subsong</strong>, HVSC-Länge 1:17. Der Dateipfad <code>Delta.sid</code> bleibt aus Kompatibilitätsgründen unverändert. Die frühere Zuschreibung an Rob Hubbard wurde deshalb im Museumstext korrigiert, ohne die Originalkomposition hinter der Cover-Quelle zu leugnen.`
    ),
    "To_be_on_Top.sid": museum(
        'CHRIS HÜLSBECK — TO BE ON TOP',
        `<strong>To be on Top</strong> erschien 1987 bei Rainbow Arts. <strong>Chris Hülsbeck</strong> steuerte nicht nur die Musik bei: STIL identifiziert auch seine eigene Stimme im Sample „Nineteen“. Die Subsongtitel reichen von <em>Drums to Heaven</em> bis <em>Funky Village</em>; Subsong 12 bündelt die im Spiel einsammelbaren musikalischen Ideen.`,
        `Lokaler Header: <strong>RSID v2, 19 Subsongs, Start 1</strong>. Die Sammlung enthält sowohl längere Stücke als auch sehr kurze Bausteine. Gerade Subsong 12 zeigt, dass der SID nicht nur lineare Titelmusik, sondern interaktiv kombinierbares Material speichert.`
    ),
    "Rambo_First_Blood_Part_II.sid": museum(
        'MARTIN GALWAY — RAMBO: FIRST BLOOD PART II',
        `<strong>Rambo: First Blood Part II</strong> erschien 1986 bei Ocean. <strong>Martin Galway</strong> übertrug Motive aus Jerry Goldsmiths Filmmusik und setzte zu Beginn selbst programmierten Morsecode ein. STIL entschlüsselt die Namen der Entwickler und vermerkt eine korrigierte Version in Subsong 2; Subsong 22 verweist auf Wagners <em>Ritt der Walküren</em>.`,
        `Lokaler Header: <strong>PSID v2, 23 Subsongs, Start 1</strong>. Die zugehörige aktuelle HVSC-Fassung führt 24 Längen; für diese ältere lokale Binärvariante werden nur die ersten 23 passend zum lokalen Header verwendet. Diese Abweichung ist in der Provenienzdokumentation ausdrücklich vermerkt.`
    ),
    "Mega_Apocalypse.sid": museum(
        'ROB HUBBARD & SIMON NICOL — MEGA APOCALYPSE',
        `<strong>Mega Apocalypse</strong> erschien 1987 als Nachfolger von <em>Crazy Comets</em>. STIL nennt <strong>Rob Hubbard</strong> für die Musik und <strong>Simon Nicol</strong> für die Samples. Die Kombination von dreistimmiger Musik und Samples während des Spiels wird dort als besondere technische Leistung eingeordnet; der erste Subsong greift auf <em>Crazy Comets</em> zurück.`,
        `Lokaler Header: <strong>RSID v2, elf Subsongs, Start 1</strong>. Auf das 7:21 Minuten lange Hauptstück folgen sehr kurze Ereignisse. Die getrennte Nennung von Komposition und Samplearbeit korrigiert die frühere unvollständige Ein-Personen-Zuschreibung.`
    ),
    "Miami_Vice.sid": museum(
        'MARTIN GALWAY — MIAMI VICE',
        `<strong>Miami Vice</strong> erschien 1986 bei Ocean. <strong>Martin Galway</strong> bearbeitete Jan Hammers <em>Evan</em> und das <em>Miami Vice Theme</em>. Für den ersten Track beschreibt er, wie ein nicht synchronisierter Filter-Sweep die ursprüngliche Konversion in ein ausgedehntes eigenes Stück verwandelte.`,
        `Lokaler Header: <strong>PSID v2, zwei Subsongs, Start 1</strong>. HVSC verzeichnet <strong>11:29,503</strong> für die ausgedehnte Evan-Bearbeitung und 2:10,237 für das Titelthema. Die Filter-Aussage stammt aus Galways dokumentiertem Kommentar, nicht aus einer nachträglichen Register-Schätzung.`
    ),
    "Way_of_the_Tiger.sid": museum(
        'BEN DAGLISH — WAY OF THE TIGER',
        `<strong>Way of the Tiger</strong> erschien 1986 bei Gremlin Graphics mit Musik von <strong>Ben Daglish</strong>. STIL identifiziert das Stück als Cover von <em>Firecracker</em>: ursprünglich von Martin Denny, hier in der Bearbeitung von Yellow Magic Orchestra. Diese doppelte Herkunft ist präziser als eine generische „asiatische Klang“-Beschreibung.`,
        `Lokaler Header: <strong>PSID v2, ein Subsong</strong>, HVSC-Länge 2:49. Die lokale Binärvariante bleibt erhalten; die Songlänge stammt vom eindeutig zugeordneten HVSC-Titelpfad.`
    ),
    "Platoon.sid": museum(
        'JONATHAN DUNN — PLATOON',
        `<strong>Platoon</strong> erschien 1988 bei Ocean mit Musik von <strong>Jonathan Dunn</strong>. STIL hebt Subsong 2 als <em>Sigh of the Eye</em> hervor – ein Remix eines eigenen Stücks. Damit ist der Soundtrack nicht nur als Auftragsarbeit zum Film, sondern auch mit Dunns übergreifendem musikalischen Katalog verbunden.`,
        `Lokaler Header: <strong>PSID v2, neun Subsongs, Start 1</strong>. Die neun Längen reichen von etwas über einer Minute bis zu mehr als vier Minuten. Die frühere Playlist enthielt keinen spezifischen Text; dieser Eintrag ersetzt den generischen Fallback vollständig.`
    ),
    "Compilation_I.sid": museum(
        'CHRIS HÜLSBECK — COMPILATION I',
        `<strong>Compilation I</strong> versammelt vier eigenständige Arbeiten von <strong>Chris Hülsbeck</strong>. Obwohl der Header 1989 nennt, datiert Hülsbeck die Entstehung auf September und Oktober 1988. Die Stücke heißen <em>Elladita</em>, <em>Time</em>, <em>Old Imagines</em> und <em>Trioly</em>; letzterer Titel verweist auf die verwendeten Triolen.`,
        `Lokaler Header: <strong>PSID v2, vier Subsongs, Start 3</strong>, die Datei beginnt also mit <em>Old Imagines</em>. Die lokale Binärvariante bleibt unverändert; alle vier offiziellen Songlängen stammen aus HVSC #85.`
    ),
    "Compilation_II.sid": museum(
        'CHRIS HÜLSBECK — COMPILATION III',
        `Der historische Dateiname lautet <code>Compilation_II.sid</code>, der eingebettete Titel ist jedoch eindeutig <strong>Compilation III</strong>. <strong>Chris Hülsbeck</strong> datiert die vier Stücke auf August und September 1988. <em>The Deep</em> wurde später als Subsong 3 von <em>Turrican</em> verwendet; <em>Dreamlights</em> wird mit dem Arbeitstitel Hurrican in Verbindung gebracht.`,
        `Lokaler Header: <strong>PSID v2, vier Subsongs, Start 3</strong> – der Start liegt auf <em>Dreamlights</em>. Der bestehende Pfad bleibt unverändert, während Überschrift und Text nun den tatsächlichen SID-Header korrekt wiedergeben.`
    ),

    "classics/games/glider-rider.sid": museum(
        'DAVID WHITTAKER — GLIDER RIDER',
        `<strong>Glider Rider</strong> erschien 1986 bei Quicksilva mit Musik von <strong>David Whittaker</strong>. STIL dokumentiert eine besonders schöne Verbindung im Katalog: Im ersten Subsong greift Whittaker ab 1:13 und 1:26 auf eigene Stücke aus <em>Lazy Jones</em> zurück.`,
        `Lokaler Header: <strong>PSID v2, drei Subsongs, Start 1</strong>. Alle drei offiziellen Längen sind mit jeweils 1:40 hinterlegt. Die Datei zeigt damit sowohl eine eigenständige Spielmusik als auch eine frühe Selbstreferenz des Komponisten.`
    ),
    "classics/games/lazy-jones.sid": museum(
        'DAVID WHITTAKER — LAZY JONES',
        `<strong>Lazy Jones</strong> erschien 1984 bei Terminal Software. <strong>David Whittaker</strong> versorgte das Spiel und seine zahlreichen Minispiele mit einem ebenso variantenreichen wie referenzfreudigen Score. STIL identifiziert unter anderem Nena, Visage, Blancmange und die Signaltöne aus <em>Unheimliche Begegnung der dritten Art</em>. Subsong 21, <em>Star Dust</em>, wurde später Grundlage von Zombie Nations <em>Kernkraft 400</em>.`,
        `Lokaler Header: <strong>PSID v2, 21 Subsongs, Start 1</strong>. Die vielen kurzen Sequenzen gehören zu den einzelnen Minispielen und sollten nicht zu einem vermeintlichen einzelnen Haupttrack zusammengefasst werden. Die vollständigen HVSC-Längen sind für alle 21 Subsongs hinterlegt.`
    ),
    "classics/games/ocean-loader-2.sid": museum(
        'MARTIN GALWAY — OCEAN LOADER 2',
        `<strong>Ocean Loader 2</strong> ist <strong>Martin Galways</strong> 1985 entstandene Überarbeitung eines älteren Stücks. Ursprünglich wollte er für jedes Ocean-Spiel eigene Lademusik schreiben; aus Zeitgründen blieb es bei dieser Fassung, die zwischen Ende 1985 und Mitte 1987 in zahlreichen Ocean- und Imagine-Spielen verwendet wurde.`,
        `Lokaler Header: <strong>PSID v2, ein Subsong</strong>, offizielle Länge <strong>4:13</strong>. Die historische Bedeutung liegt nicht in einem separaten Spiel-Soundtrack, sondern in der Wiederverwendung als wiedererkennbare Ladeidentität vieler Titel.`
    ),
    "classics/games/ocean-loader-3.sid": museum(
        'PETER CLARKE — OCEAN LOADER 3',
        `<strong>Ocean Loader 3</strong> stammt von <strong>Peter Clarke</strong> und erschien 1987. Clarke erklärt den dramatischen Konzeptwechsel: Das Stück beginnt mit Galways vertrauten Anfangstakten und bricht dann bewusst in eine eigene, energischere Fortsetzung auf. Er entwickelte es zunächst zu Hause und präsentierte erst die fertige Arbeit.`,
        `Lokaler Header: <strong>PSID v2, ein Subsong</strong>, offizielle Länge <strong>2:47</strong>. Der erkennbare Zitat-Anfang ist somit keine falsche Autorenzuordnung, sondern Teil von Clarkes dokumentiertem kompositorischem Plan.`
    ),
    "classics/games/ocean-loader-4.sid": museum(
        'JONATHAN DUNN — OCEAN LOADER 4',
        `<strong>Ocean Loader 4</strong> ist <strong>Jonathan Dunns</strong> Beitrag zur Ocean-Ladegeschichte. Die Musik wurde 1988 und 1989 in zahlreichen Ocean- und Imagine-Spielen eingesetzt. Zusammen mit den Fassungen von Galway und Clarke macht der Eintrag sichtbar, wie sich dieselbe funktionale Aufgabe über mehrere Komponisten und Jahre veränderte.`,
        `Lokaler Header: <strong>PSID v2, ein Subsong</strong>, offizielle Länge <strong>3:12</strong>. Die Playlist führt die Loader 2–4 als getrennte Werke; ihre unterschiedlichen Autoren und Entstehungsjahre werden nicht zu einem anonymen „Ocean Theme“ zusammengefasst.`
    ),
    "classics/games/parallax.sid": museum(
        'MARTIN GALWAY — PARALLAX',
        `<strong>Parallax</strong> erschien 1986 bei Ocean. <strong>Martin Galway</strong> wollte die gewaltigen visuellen Proportionen des Spiels mit einem entsprechend langen Stück spiegeln. Während der Arbeit hörte er Jean-Michel Jarres <em>Rendez-Vous</em> zunächst täglich; erst nach Veröffentlichung bemerkte er, wie stark sich der Einfluss eingeschlichen hatte.`,
        `Lokaler Header: <strong>PSID v2, fünf Subsongs, Start 1</strong>. Der erste Subsong ist mit <strong>11:23,2</strong> der lange Hauptteil; laut Galway nimmt allein das Intro etwa zwei Drittel davon ein. Die weiteren Subsongs enthalten deutlich kürzere Spielabschnitte.`
    ),
    "classics/games/agent-x-ii.sid": museum(
        'TIM FOLLIN — AGENT X II',
        `<strong>Agent X II: The Mad Prof’s Back</strong> erschien 1987 bei Mastertronic. <strong>Tim Follins</strong> Score verbindet eigene Stücke mit überraschenden Referenzen: STIL erkennt das Peanuts-Thema in den Subsongs 2 und 6 sowie einen kurzen Shake-’n’-Vac-Werbejingle in Subsong 3.`,
        `Lokaler Header: <strong>PSID v2, sechs Subsongs, Start 2</strong>. Die Datei startet deshalb nicht mit dem ersten, sondern mit dem zweiten Subsong. Die offiziellen Längen reichen von 13 Sekunden bis 3:37 und machen die unterschiedlichen Funktionen der einzelnen Sequenzen sichtbar.`
    ),
    "classics/games/led-storm.sid": museum(
        'TIM FOLLIN — L.E.D. STORM',
        `<strong>L.E.D. Storm</strong> erschien 1989 für den C64 bei GO!/Capcom. <strong>Tim Follins</strong> Fassung ist laut STIL keine direkte Cover-Version des Arcade-Soundtracks. Besonders ungewöhnlich: Auf dem Titelbildschirm lässt sich der Filter mit den Tasten <code>+</code> und <code>−</code> verstellen; der archivierte Rip verwendet die Standardeinstellung.`,
        `Lokaler Header: <strong>PSID v2, sieben Subsongs, Start 1</strong>. STIL vermerkt kurze Bezüge auf Deep Purple und Yello im ersten Stück sowie eine Checkpoint-Referenz in Subsong 6. Die einstellbare Filterung ist eine dokumentierte Eigenschaft des Originalprogramms, kein späterer Emulator-Effekt.`
    ),
    "classics/games/ghouls-n-ghosts.sid": museum(
        'TIM FOLLIN — GHOULS ’N’ GHOSTS',
        `<strong>Ghouls ’n’ Ghosts</strong> erschien 1989 für den C64 bei US Gold/Capcom. <strong>Tim Follin</strong> verarbeitete Tamayo Kawamotos Arcade-Vorlagen in einem außergewöhnlich umfangreichen SID. STIL identifiziert unter anderem die Stage-2- und Stage-4-Themen in den Subsongs 8 und 10.`,
        `Lokaler Header: <strong>PSID v2, 32 Subsongs, Start 1</strong>. Neben mehreren langen Levelstücken enthält die Datei viele sehr kurze Treffer-, Ereignis- und Übergangssignale. Die offiziellen Songlängen unterscheiden diese Funktionen bis auf Bruchteile von Sekunden.`
    ),
    "classics/games/hawkeye.sid": museum(
        'JEROEN TEL — HAWKEYE',
        `<strong>Hawkeye</strong> erschien 1988 bei Thalamus mit Musik von <strong>Jeroen Tel</strong>. STIL benennt Titel-, Lade-, Highscore- und Ereignismusik sowie fünf ausdrücklich als Ein-Stimmen-Stücke gekennzeichnete Ingame-Tracks. Diese Reduktion ist kompositorisch interessanter als pauschale Superlative über möglichst dichte Klänge.`,
        `Lokaler Header: <strong>PSID v2, zwölf Subsongs, Start 1</strong>. Der Titel ist mit 6:25 der längste Teil; die Ein-Stimmen-Ingame-Stücke stehen in den Subsongs 7–11. Die Datei macht damit verschiedene Arrangementdichten innerhalb eines Soundtracks direkt vergleichbar.`
    ),
    "classics/games/eliminator.sid": museum(
        'JEROEN TEL — ELIMINATOR',
        `<strong>Eliminator</strong> erschien 1989 bei Hewson. <strong>Jeroen Tel</strong> schrieb Ingame-, Highscore-, Titel- und Game-over-Musik. STIL vermerkt im Highscore-Subsong außerdem ein elfsekündiges Zitat von <em>Gyroscope</em> aus der Fernsehwerbung von Graham Jarvis und Rob Hartshorne.`,
        `Lokaler Header: <strong>PSID v2, vier Subsongs, Start 3</strong> – die Datei beginnt mit dem 2:55 Minuten langen Titelstück. Der erste Subsong ist die 7:18 Minuten lange Ingame-Musik; Start- und Nummerierungsreihenfolge sind deshalb nicht gleichzusetzen.`
    ),
    "classics/games/katakis.sid": museum(
        'CHRIS HÜLSBECK — KATAKIS',
        `<strong>Katakis</strong> erschien 1988 bei Rainbow Arts mit Musik von <strong>Chris Hülsbeck</strong>. Der Score umfasst zahlreiche Level- und Ereignissequenzen. STIL dokumentiert außerdem die spätere Wiederverwendung der ersten beiden Stücke in <em>Crush</em> (1999) sowie musikalische Referenzen unter anderem auf Laserdance und Alan Silvestri.`,
        `Lokaler Header: <strong>PSID v2, 34 Subsongs, Start 1</strong>. Der 5:33 Minuten lange Titel steht einer Folge wiederkehrender Levelmuster und sehr kurzer Signale gegenüber. Die vollständige Songlength-Liste erhält diese kleinteilige Struktur, statt alle Subsongs mit einer generischen Dauer zu versehen.`
    ),
    "classics/games/turrican.sid": museum(
        'RAMIRO VACA, CHRIS HÜLSBECK & STEFAN HARTWIG — TURRICAN',
        `Der C64-Score zu <strong>Turrican</strong> (1990) ist eine Gemeinschaftsarbeit und darf nicht allein Chris Hülsbeck zugeschrieben werden. STIL nennt <strong>Stefan Hartwig</strong> für Subsong 1, <strong>Chris Hülsbeck</strong> für <em>The Deep</em> in Subsong 3 und <strong>Michael Hendriks</strong> für Subsong 4; weitere Abschnitte adaptieren Vince DiCola beziehungsweise Hülsbecks Amiga-Musik. Der SID-Header bündelt die Autoren entsprechend.`,
        `Lokaler Header: <strong>PSID v2, sechs Subsongs, Start 1</strong>. Gerade <em>The Deep</em> verbindet diese Datei mit Hülsbecks <em>Compilation III</em>. Die Museumszuordnung folgt den einzelnen STIL-Credits statt einer vereinfachten Gesamtautorenschaft.`
    ),
    "classics/games/armalyte.sid": museum(
        'MARTIN WALKER — ARMALYTE',
        `<strong>Armalyte</strong> erschien 1988 bei Thalamus. <strong>Martin Walker</strong> erhielt den Auftrag für Musik und Soundeffekte und entwickelte in diesem Zusammenhang seinen eigenen C64-Player und Editor weiter. Im Commodore-Format-Interview nennt er <em>Armalyte</em> später eines der Werke, auf die er besonders stolz ist.`,
        `Lokaler Header: <strong>PSID v2, vier Subsongs, Start 1</strong>. Die drei längeren Stücke und ein kurzer Abschluss sind einzeln hinterlegt. Walkers dokumentierte Arbeit am eigenen Replay-Werkzeug ist der belastbare technische Hintergrund; keine nachträglich erfundenen Registerwerte.`,
        { label: 'Commodore Format: Martin Walker', url: 'https://commodoreformatarchive.com/the-martin-walker-interview/' }
    ),
    "classics/games/citadel.sid": museum(
        'MARTIN WALKER — CITADEL',
        `<strong>Citadel</strong> erschien 1989 bei Electric Dreams. <strong>Martin Walker</strong> verband hier seine Arbeit als Spieleentwickler mit dem Aufbau eines eigenen Musikplayers. In seiner Rückschau beschreibt er <em>Citadel</em> und <em>Armalyte</em> als Soundtracks mit cinematicshem Anspruch, komplexen sich entwickelnden Akkorden, tiefem Bass und perkussiven Elementen.`,
        `Lokaler Header: <strong>PSID v2, vier Subsongs, Start 1</strong>. Die offiziellen Längen betragen 4:02, 2:08, 0:42 und 2:56. Die Einordnung als eigener Player entstammt Walkers Interview und wird nicht mit fremden Replay-Systemen verwechselt.`,
        { label: 'Commodore Format: Martin Walker', url: 'https://commodoreformatarchive.com/the-martin-walker-interview/' }
    ),
    "classics/games/creatures-2.sid": museum(
        'STEVE ROWLANDS — CREATURES 2',
        `<strong>Creatures 2</strong> erschien 1992 bei Thalamus. <strong>Steve Rowlands</strong> erweiterte den Score um eine ungewöhnlich große Sammlung situativer Musik: Neben Titel und Highscore sind Interlude, versteckte Räume und sechs Torture-Screens separat dokumentiert. Subsong 16 ist eine Bearbeitung seines eigenen Stücks <em>Funky Music B</em>.`,
        `Lokaler Header: <strong>PSID v2, 18 Subsongs, Start 2</strong> – die Datei beginnt mit dem 3:46 Minuten langen Thema. Die 18 Einträge zeigen, wie stark der Soundtrack auf einzelne Spielsituationen zugeschnitten ist.`
    ),
    "classics/games/mayhem-in-monsterland.sid": museum(
        'STEVE ROWLANDS — MAYHEM IN MONSTERLAND',
        `<strong>Mayhem in Monsterland</strong> erschien 1993 bei Apex Computer Productions. <strong>Steve Rowlands</strong> schrieb einen ebenso bunten wie kleinteiligen Score für Jellyland, Pipeland, Spottyland, Cherryland und Rockland. STIL ordnet dem Thema in Subsong 3 Bruce Broughtons <em>Tiny Toons</em>-Melodie zu.`,
        `Lokaler Header: <strong>PSID v2, 24 Subsongs, Start 2</strong>, also mit dem Intro statt dem kurzen Mayhem-TV-Signal. Die vielen eigenen Level- und Stimmungstracks machen die Datei zu einem späten, umfangreichen Beispiel für C64-Spielmusik.`
    ),
    "classics/games/flimbos-quest.sid": museum(
        'JOHANNES BJERREGAARD — FLIMBO’S QUEST / MAIN',
        `<strong>Flimbo’s Quest</strong> erschien 1990 bei System 3. Diese Datei enthält <strong>Johannes Bjerregaards</strong> Hauptmusik. STIL berichtet außerdem, dass sein erster Ladevorschlag nicht verwendet wurde: Entwickler Laurens van der Donk entschied sich stattdessen für Reyn Ouwehands Intro. Die zwei Komponistenbereiche sind deshalb nicht miteinander zu vermischen.`,
        `Lokaler Header: <strong>PSID v2, acht Subsongs, Start 1</strong>. Neben vier längeren Levelstücken enthält die Datei kurze Signale und eine abschließende Sequenz. Der archivierte Zusatz <em>main</em> wird im lokalen Anzeigenamen bewusst als Hauptmusik interpretiert.`
    ),
    "classics/games/last-ninja-3.sid": museum(
        'REYN OUWEHAND — LAST NINJA 3',
        `<strong>Last Ninja 3</strong> erschien 1991 bei System 3 mit Musik von <strong>Reyn Ouwehand</strong>. Der Score führt durch Mountains sowie Wind-, Water-, Fire- und Void-Temple. STIL beschreibt außerdem eine historische Loop-Unregelmäßigkeit im Intro: Die vorliegende SID-Fassung wurde mit bestätigten Daten Ouwehands korrigiert.`,
        `Lokaler Header: <strong>PSID v2, zehn Subsongs, Start 3</strong> – die Datei öffnet mit dem 4:47 Minuten langen Intro. Die Dokumentation der restaurierten Loop-Daten ist wichtig: Sie betrifft diese archivierte Fassung und wird nicht als Fehler der lokalen Emulation dargestellt.`
    ),
    "classics/games/ghosts-n-goblins.sid": museum(
        'MARK COOKSEY — GHOSTS’N GOBLINS',
        `<strong>Ghosts’n Goblins</strong> erschien 1986 bei Elite. <strong>Mark Cooksey</strong> übernahm den Highscore-Tune aus Ayako Moris Arcade-Musik, komponierte für das Ingame aber bewusst ein eigenes gespenstisches Stück. STIL verweist darin auf Chopins Prélude op. 28 Nr. 20 und Klaus Wunderlichs <em>Dangerous Dreams</em>.`,
        `Lokaler Header: <strong>PSID v2, zwei Subsongs, Start 2</strong>. Die Wiedergabe beginnt deshalb mit Cookseys 3:50 Minuten langer Ingame-Komposition; der 2:27 Minuten lange Arcade-Bezug steht in Subsong 1.`
    ),

    "classics/demoscene/radio-napalm.sid": museum(
        'PVCF — RADIO NAPALM',
        `<strong>Radio Napalm</strong> ist <strong>PVCFs</strong> Musik zur Reflex-Trackmo, die 1995 den C64-Demowettbewerb der X’95 gewann. PVCF beschreibt die Arbeit mit DMC und dessen 16 Instrumenten-Slots; die dadurch stufigen Filterbewegungen im ersten Teil waren für ihn ein deutlicher Kompromiss. Das Stück entstand für den neuen 8580, später wurde eine angepasste 6581-Fassung veröffentlicht.`,
        `Lokaler Header: <strong>PSID v2, ein Subsong</strong>, offizielle Länge <strong>4:28,098</strong>. Der Eintrag dokumentiert gezielt die Abhängigkeit des Klangs von Player, Instrumentenlimit und SID-Modell, ohne eine der beiden historischen Hardwarefassungen zur einzig „richtigen“ zu erklären.`,
        csdb(11665, 'Radio Napalm')
    ),
    "classics/demoscene/edge-of-disgrace.sid": museum(
        'DANE — EDGE OF DISGRACE',
        `<strong>Edge of Disgrace</strong> erschien 2008 bei Booze Design und gewann den C64-Demowettbewerb der X’2008. <strong>Stellan Andersson (Dane)</strong> war neben Code und Grafik auch für die Musik verantwortlich. STIL vermerkt im langen Soundtrack unter anderem eine kurze Terminator-2-Referenz von Brad Fiedel.`,
        `Lokaler Header: <strong>PSID v2, 16 Subsongs, Start 1</strong>. Subsong 1 enthält den vollständigen <strong>14:34</strong> Minuten langen Demo-Soundtrack; die übrigen 15 Subsongs sind Einstiegspunkte zu einzelnen Teilen, keine zusätzlichen Kompositionen. Diese Struktur ist für die Museumswiedergabe besonders wichtig.`,
        csdb(72550, 'Edge of Disgrace')
    ),
    "classics/demoscene/coma-light-13.sid": museum(
        'FANTA — COMA LIGHT 13 / TUNE 1',
        `<strong>Coma Light 13</strong> gewann am 28. Oktober 2012 den C64-Demowettbewerb der X2012. Der erste Musikbeitrag stammt von <strong>Alexander Rotzsch (Fanta)</strong>. STIL identifiziert das kurze Stück als Bezug auf Danes ersten <em>Edge-of-Disgrace</em>-Subsong – eine direkte musikalische Verbindung zwischen zwei herausragenden C64-Demos.`,
        `Lokaler Header: <strong>PSID v2, ein Subsong</strong>, offizielle Länge <strong>0:38</strong>. Die Kürze ist hier Teil der dokumentierten Funktion und kein Hinweis auf eine unvollständige Datei. Die Playlist ordnet sie als eigenständiges Demo-Musikdokument ein.`,
        { label: 'Oxyron: Coma Light 13', url: 'https://www.oxyron.de/html/demos.html' }
    ),
    "classics/demoscene/comaland-100-end.sid": museum(
        'MAGNAR HARESTAD — COMALAND 100% / END',
        `<strong>Comaland 100%</strong> von Censor Design und Oxyron erschien am 20. Juni 2015 auf der Nordlicht. <strong>Magnar Harestad</strong> steuerte Musik und die Sprachsamples des Endteils bei. Diese Datei bewahrt gezielt die Musik des Endparts, nicht den kompletten Demo-Soundtrack von dEViLOCk, Fanta und Magnar.`,
        `Lokaler Header: <strong>RSID v2, ein Subsong</strong>, offizielle Länge <strong>6:02,201</strong>. Der RSID-Container und die dokumentierten Sprachsamples machen den Endpart zu einem eigenständigen technischen und historischen Museumsstück.`,
        { label: 'Demozoo: Comaland 100%', url: 'https://demozoo.org/productions/140070/' },
        csdb(139278, 'Comaland 100%')
    )
};
