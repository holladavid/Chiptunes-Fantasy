// === tracks/atari/museum.js ===
// Kuratierte Museumstexte für die Atari-ST-Playlist von Chiptunes Fantasy.
// Fokus: YM2149-Hardwaretricks, MFP-Timer-Digidrums, ST-Sound-Archivierung & Demoscene-History.

function museum(title, history, replay, ...sources) {
    const links = sources
        .map(source => `<a href="${source.url}" target="_blank" rel="noopener noreferrer">${source.label}</a>`)
        .join(' · ');
    return `
        <h3>[ MUSEUM: ${title} ]</h3>
        <p><strong>Historie:</strong> ${history}</p>
        <p><strong>YM2149 &amp; Replay:</strong> ${replay}</p>
        <p class="museum-sources"><strong>Quellen:</strong> ${links}</p>
    `;
}

const wiki = (slug, label) => ({ label: `Wikipedia: ${label}`, url: `https://en.wikipedia.org/wiki/${slug}` });
const exotica = (slug, label = slug) => ({ label: `ExoticA: ${label}`, url: `https://www.exotica.org.uk/wiki/${slug}` });
const hol = (id, label) => ({ label: `Hall of Light: ${label}`, url: `https://amiga.abime.net/${id}` });
const ST_SOUND = { label: 'GitHub: Leonard / ST-Sound YM', url: 'https://github.com/arnaud-carre/StSound' };
const ATARI_SOURCES = { label: 'Lokal: tracks/atari/SOURCES.md', url: './tracks/atari/SOURCES.md' };

const amberstarHighlights = [
    // Archivnummer #1 (amber-20.ym) bis #20 (amber-01.ym)
    [1, '20', 'Der Auftakt der zwanzigteiligen <em>Amberstar</em>-YM-Sammlung von 1992. Nach dem Rollenspiel-Debüt <em>Dragonflight</em> legte Thalion in Gütersloh dieses riesige Epos in nur zwölf Monaten vor – während Amiga-Spieler dank Shared-Samplebank PCM-Klänge hörten, musste <strong>Jochen Hippel (Mad Max)</strong> auf dem Atari ST den gesamten Soundtrack aus dem nackten YM2149 pressen.', 'Dumped mit <strong>SainT</strong> (Arnaud Carré &amp; James Boulton). Beachte die Archivnummerierung: Im ST-Archiv laufen die Dateinamen rückwärts – <code>AMBER20.YM</code> enthält die eingebettete Sequenz <code>Amberstar #1</code>.'],
    [2, '19', 'Zweiter Baustein aus <strong>Jochen Hippels</strong> ST-Score zu Thalions Rollenspiel <em>Amberstar</em> (1992). Auf dem Atari ST bedeutete ein gewaltiges Open-World-RPG wie <em>Amberstar</em> kompromisslose Klangökonomie ohne DMA-Soundhardware.', '<strong>SainT-Dump (<code>Amberstar #2</code>)</strong>. Drei reine Rechteckwellen-Oszillatoren plus ein gemeinsam genutzter 5-Bit-Rauschgenerator und eine globale Hardware-Hüllkurve liefern das komplette Arrangement.'],
    [3, '18', 'Einer der atmosphärischen Wander- und Schauplatz-Bausteine aus <em>Amberstar</em> (1992). Anders als bei den betitelten Amiga-COSO-Dateien speicherten die ST-Registerdumps keine Ortsnamen wie <em>Twinlake</em> oder <em>Dreamcave</em>.', '<strong>SainT-Dump (<code>Amberstar #3</code>)</strong>. Hippel nutzt extrem schnelle 50-Hz-Arpeggios auf einer Stimme, um auf nur drei Rechteckkanälen volle Fantasy-Akkorde vorzutäuschen.'],
    [4, '17', 'Viertes Stück aus der 20-teiligen <em>Amberstar</em>-Reihe (1992). Auf dem ST zeigt sich Hippels Herkunft aus der Atari-Demoszene besonders deutlich: knackige Bass-Oktaven, glasklare Leads und federnde Pseudo-Perkussion.', '<strong>SainT-Dump (<code>Amberstar #4</code>)</strong>. Ohne Amiga-Filter klingt die YM2149-Fassung trockener, kantiger und überraschend druckvoll – fast wie ein eigenständiger 8-Bit-Chiptune-Soundtrack.'],
    [5, '16', 'Mitten im gewaltigen <em>Amberstar</em>-Paket von 1992 demonstriert <strong>Mad Max</strong>, wie abwechslungsreich man zwanzig RPG-Stimmungen auf identischer Chip-Architektur anlegen kann.', '<strong>SainT-Dump (<code>Amberstar #5</code>)</strong>. Durch raffiniertes Mischen von Rechteckton und Rauschbit innerhalb eines einzelnen Kanals entstehen zischende Hi-Hats und Snare-Impulse, ohne eine ganze Melodie-Stimme zu opfern.'],
    [6, '15', 'Sechste Archivsequenz aus Thalions Kult-RPG <em>Amberstar</em> (1992), programmiert u. a. von Karsten Köper und geschrieben von Jurie Horneman, mit Art Direction von TEX-Gründer Erik Simon.', '<strong>SainT-Dump (<code>Amberstar #6</code>)</strong>. Die im Container festgehaltenen 50-Hz-Registerdaten frieren jeden einzelnen Schreibzugriff der originalen 68000-Musikroutine punktgenau ein.'],
    [7, '14', 'Siebter Baustein der <em>Amberstar</em>-Suite (1992). Während die Amiga-Version fast zwanzig Stücke über eine 57,5-KB-Samplebank speiste, verließ sich die ST-Fassung ganz auf Hippels ultra-kompakten COSO-Chip-Code.', '<strong>SainT-Dump (<code>Amberstar #7</code>)</strong>. Durch gezieltes Umschalten der YM2149-Hardware-Hüllkurven (Dreieck/Sägezahn bei hohen Raten) formt Hippel seinen berühmten brummenden <em>Buzzer</em>-Bass.'],
    [8, '13', 'Achter Track aus der 1992er Rollenspiel-Sammlung <em>Amberstar</em>. Im Vergleich zum Vorgänger <em>Dragonflight</em> verfeinerte Hippel seine ST-Instrumententabellen noch einmal spürbar in Richtung fließender Phrasierungen.', '<strong>SainT-Dump (<code>Amberstar #8</code>)</strong>. Kompakter Registerstrom unter Autor-Tag <code>Mad Max</code> – ein Direktvergleich mit unseren Amiga-<code>.hipc</code>-Versionen lohnt sich bei jedem Takt.'],
    [9, '12', 'Neunte Archivnummer aus Thalions zweitem großen Rollenspiel-Meilenstein <em>Amberstar</em> (1992). Jeder Ton zeigt Hippels Gespür für eingängige, beinahe folkloristische Melodiebögen jenseits reiner Action-Musik.', '<strong>SainT-Dump (<code>Amberstar #9</code>)</strong>. Saubere 50-Hz-Emulation der drei Yamaha-Rechteckkanäle (A, B, C) ohne externe Sample-Unterstützung.'],
    [10, '11', 'Halbzeit in der zwanzigteiligen <em>Amberstar</em>-Serie (1992): Genau wie bei anderen Thalion-Klassikern blieb diese Musik bis zur Einführung der modernen ST-Sound-Dumps untrennbar mit der Erinnerung an Disketten-Wechselorgien verbunden.', '<strong>SainT-Dump (<code>Amberstar #10</code>)</strong>. Konserviert über den Emulator <em>SainT</em>, der speziell für exaktes Atari-ST-Chip- und MFP-Timing entwickelt wurde.'],
    [11, '10', 'Elfte Sequenz von <strong>Jochen Hippel</strong> für <em>Amberstar</em> (1992). Ein gutes Beispiel dafür, wie stark der Yamaha YM2149F – eigentlich eng verwandt mit dem AY-3-8910 aus ZX Spectrum 128 und Schneider CPC – unter Hippels Fingern aufblühte.', '<strong>SainT-Dump (<code>Amberstar #11</code>)</strong>. Durch schnelle Lautstärke-Hüllkurven pro 20-ms-VBL-Tick täuschen die statischen Rechteckwellen erstaunlich lebendige Flöten- und Zupfklänge vor.'],
    [12, '09', 'Zwölfte Nummer aus <em>Amberstar</em> (1992). Wer beide Versionen kennt, entdeckt hier reizvolle Unterschiede: Manche Takte wirken durch das Fehlen von Amiga-Hall und Samples plötzlich viel rhythmischer und pointierter.', '<strong>SainT-Dump (<code>Amberstar #12</code>)</strong>. Der reine YM-Datenstrom zeigt, wie diszipliniert Hippel auf 68000-Ebene arbeitete – der Replay kostete im Spiel kaum mehr als wenige Prozent CPU-Zeit.'],
    [13, '08', 'Dreizehntes Stück des 1992er <em>Amberstar</em>-Scores. Inmitten der riesigen Welt von Lyramion sorgte Hippels Musik dafür, dass selbst textlastige Dungeons und Städte auf dem monochromen oder 16-Farben-ST lebendig wirkten.', '<strong>SainT-Dump (<code>Amberstar #13</code>)</strong>. Konserviert die exakte Registerfolge für Kanal-Frequenzen, Rauschperiode, Mixer-Maske (<code>R7</code>) und Lautstärketabellen.'],
    [14, '07', 'Vierzehnter Track aus <em>Amberstar</em> (1992). Wie beim Vorgänger <em>Dragonflight</em> steckt im Inneren dieser ST-Fassung dieselbe kompositorische Handschrift, die kurz darauf auch das Nachfolgeprojekt <em>Ambermoon</em> prägen sollte.', '<strong>SainT-Dump (<code>Amberstar #14</code>)</strong>. Sauberer Register-Capture ohne zusätzliche Digidrum-Timer-Hacks – pures YM2149-Handwerk.'],
    [15, '06', 'Fünfzehnte Archivnummer der <em>Amberstar</em>-Reihe (1992). Gerade im direkten Wechsel zwischen kurzen Stimmungsstücken und längeren Themen zeigt sich die enorme Bandbreite des Gütersloher Thalion-Teams.', '<strong>SainT-Dump (<code>Amberstar #15</code>)</strong>. Dumped via <em>SainT</em> mit expliziter <code>Mad Max</code>-Autorenkennung im YM-Header.'],
    [16, '05', 'Sechzehnte Komposition aus <strong>Jochen Hippels</strong> gewaltigem 1992er RPG-Marathon für Thalion.', '<strong>SainT-Dump (<code>Amberstar #16</code>)</strong>. Nutzt fein gestufte Tonhöhen-Vibratos und schnelle Kanal-Alternierung für dichte Gegenmelodien auf nur drei Tongeneratoren.'],
    [17, '04', 'Siebzehnte Nummer aus der <em>Amberstar</em>-Sammlung (1992). Die späten Archivnummern beweisen, dass Thalion selbst für Nebenorte und Spezialereignisse vollwertige Kompositionen statt Zweizeiler spendierte.', '<strong>SainT-Dump (<code>Amberstar #17</code>)</strong>. Alle drei Oszillatoren und der gemeinsame Rauschkanal greifen im 50-Hz-Takt nahtlos ineinander.'],
    [18, '03', 'Achtzehnter Track von <strong>Mad Max</strong> für <em>Amberstar</em> (1992). Ein weiteres Puzzleteil aus jenem Jahr, in dem Thalion mit <em>Amberstar</em> Maßstäbe für deutsche Computer-Rollenspiele setzte.', '<strong>SainT-Dump (<code>Amberstar #18</code>)</strong>. Rekonstruiert den originalen 68000-COSO-Registerfluss über den SainT-Export.'],
    [19, '02', 'Vorletztes Stück der zwanzigteiligen <em>Amberstar</em>-Reihe (1992). Während der Amiga bereits auf seinen Abschied zusteuerte und auf dem ST langsam Stille einkehrte, feuerte Hippel hier noch einmal ein ganzes Musikalbum ab.', '<strong>SainT-Dump (<code>Amberstar #19</code>)</strong>. Im Dateisystem als <code>amber-02.ym</code> abgelegt – direkt vor dem umgekehrten Schlusslicht der SainT-Serie.'],
    [20, '01', 'Zwanzigste und letzte Archivnummer aus Thalions Rollenspiel <em>Amberstar</em> (1992). Zusammen mit dem fast parallelen Amiga-Paket zeigt diese Suite wie kaum eine zweite Produktion, wie unterschiedlich derselbe Komponist denselben Soundtrack für Paula und YM2149 dachte.', '<strong>SainT-Dump (<code>Amberstar #20</code>)</strong>. Eingebetteter Name <code>Amberstar #20</code> in Datei <code>amber-01.ym</code>; sauberer Abschluss des zwanzigteiligen Atari-ST-Archivs.']
];

const wingsLevelDetails = [
    [1, 4, 'Erster Level-Dump des 1990er Thalion-Vertikalshooters <strong>Wings of Death</strong>. Während Michael Bittners 68000-Engine das Bild bei satten 50 Frames scrollte, trieb <strong>Jochen Hippel</strong> die Action nicht nur mit Chip-Melodien, sondern zusätzlich per Software-Mixer über den Soundchip an.', '<strong>YM6! · 4 Digidrum-Blöcke</strong>. Ein riesiger technischer Meilenstein auf dem ST: Per <strong>MFP-68901-Timer-Interrupt</strong> unterbrach Hippels Routine die CPU tausende Male pro Sekunde und hämmerte 4-Bit-Sampledaten direkt in das Lautstärkeregister des YM2149!'],
    [2, 2, 'Zweiter Level-Dump aus Eclipse Softwares und Thalions <strong>Wings of Death</strong> (1990). Anders als die deutlich bekanntere Titelmusik liefen die Ingame-Stages auf beiden 16-Bit-Systemen im hochoptimierten COSO-Korsett, um mitten im Kugelhagel noch Platz für Soundeffekte zu lassen.', '<strong>YM6! · 2 Digidrum-Blöcke</strong>. Das kompakte Digidrum-Set (nur zwei eingebettete Drum-Samples) entlastet die ST-CPU während intensiver Sprite-Wellen, liefert aber trotzdem unverwechselbaren 16-Bit-Schlagzeug-Punch.'],
    [3, 2, 'Dritter Level-Dump aus <strong>Wings of Death</strong> (1990). Genau wie beim Amiga-Pendant decken die durchnummerierten Dumps die düsteren bis feurigen Stages des siebenstufigen Shooters ab.', '<strong>YM6! · 2 Digidrum-Blöcke</strong>. Ohne einen modernen Container wie <strong>YM6!</strong> wären diese Timer-getriggerten Drum-Samples bei einer reinen 50-Hz-Aufnahme völlig verloren gegangen – erst Leonards ST-Sound-Format rettete die speziellen Digidrum-Blöcke.'],
    [4, 3, 'Vierter Level-Dump zu Thalions <strong>Wings of Death</strong> (1990). Die Musik vereint Hippels knackige Atari-ST-Synthese mit druckvollen, leicht rauen 4-Bit-Drums.', '<strong>YM6! · 3 Digidrum-Blöcke</strong>. Drei separate Sample-Blöcke sorgen im Container für abwechslungsreiche Snare-, Kick- und Tom-Akzente über die drei laufenden YM-Tongeneratoren.'],
    [5, 3, 'Fünfter Level-Dump aus dem 1990er Kult-Shooter <strong>Wings of Death</strong>. Interessanter Hardware-Fakt am Rande: Viele Spieler kannten diese YM-Timer-Drums damals als Markenzeichen von Thalions hauseigener <em>Digisynth</em>-Technik.', '<strong>YM6! · 3 Digidrum-Blöcke</strong>. Das YM6!-Format bettet neben den drei Digidrum-Samples exakt ein, mit welcher Timer-Frequenz der MFP-Baustein sie auf dem originalen Atari ST abfeuerte.'],
    [6, 2, 'Sechster Level-Dump aus <strong>Wings of Death</strong> (1990). Während auf der Amiga-Version alle Levels eine schlanke gemeinsame Sample-Bank nutzten, schnürte Hippel für den ST eigene COSO- und Timer-Pakete.', '<strong>YM6! · 2 Digidrum-Blöcke</strong>. Klassisches ST-Duell: Zwei YM-Kanäle liefern schneidende Arpeggio- und Bass-Arbeit, während der dritte Kanal abwechselnd Leads und Timer-Drums schultert.'],
    [7, 3, 'Siebter Level-Dump aus Eclipse/Thalions <strong>Wings of Death</strong> (1990). Die gesamte Musik entsteht aus einem einzigen Soundchip, der von Atari ursprünglich nur für schlichte Büro-Pieptöne verbaut worden war.', '<strong>YM6! · 3 Digidrum-Blöcke</strong>. Ein Paradebeispiel für Hippels Kunst, das logarithmische Lautstärkeverhalten des YM2149 für saubere Drum-Transienten auszurechnen.'],
    [8, 4, 'Achter Level-Dump aus <strong>Wings of Death</strong> (1990) – gemeinsam mit Dump 01 die drum-reichste Stufe unter den neun archivierten Level-Dumps.', '<strong>YM6! · 4 Digidrum-Blöcke</strong>. Vier eingebettete Digidrum-Blöcke geben den treibenden Boss- und Spät-Stage-Grooves besonders viel Abwechslung und Nachdruck.'],
    [9, 3, 'Neunter und letzter Level-Dump der <em>Wings-of-Death</em>-Suite (1990). Ob Intro, Boss oder Abspann – Hippel verwandelte den unterschätzten ST-Chip hier in eine echte Arcade-Maschine.', '<strong>YM6! · 3 Digidrum-Blöcke</strong>. Alle neun Dumps teilen intern den generischen Headernamen <code>Wing of Death Level</code> und bewahren die komplette Ingame-Palette im YM6!-Container.']
];

const lethalXcessDetails = [
    [1, '1991 legten Programmierer Michael Bittner und Eclipse/Thalion mit <strong>Lethal Xcess: Wings of Death II</strong> noch eine Schippe drauf – technisch eines der beeindruckendsten ST-Spiele überhaupt (mit abgeschalteten oberen und unteren Bildschirmrändern und 50-Hz-Scrolling auch auf dem normalen ST!). Natürlich lieferte wieder <strong>Mad Max</strong> die knallende Begleitmusik.', '<strong>YM5! · 4 Digidrum-Blöcke (<code>Lethal XCess Music 1</code>)</strong>. Wie beim Vorgänger stützt sich Hippels Score auf eine Kombination aus treibenden YM-Melodien und 4 eingebetteten Timer-Digidrum-Blöcken.'],
    [2, 'Zweiter Musikdump aus <strong>Lethal Xcess</strong> (1991). Das Spiel war einer der wenigen deutschen Shooter, die auf Atari ST <em>und</em> STE Hardware-Extras ausreizten – und gleichzeitig durch ihren gnadenlosen Schwierigkeitsgrad wie ihren Soundtrack berühmt wurden.', '<strong>YM5! · 4 Digidrum-Blöcke (<code>Lethal XCess Music 2</code>)</strong>. Der YM5!-Container speichert neben den 16 Chip-Registern auch die speziellen Drum-Samples, ohne auf externe Dateien angewiesen zu sein.'],
    [3, 'Drittes Stück der siebenteiligen <strong>Lethal-Xcess</strong>-Sammlung (1991). Hippel zeigte hier auf dem Höhepunkt seiner ST-Jahre noch einmal, wie wuchtig selbst ein sechster oder siebter Arcade-Track auf drei Rechteck-Oszillatoren klingen kann.', '<strong>YM5! · 4 Digidrum-Blöcke (<code>Lethal XCess Music 3</code>)</strong>. Alle sieben Musikdumps setzen auf reines Mono-YM-plus-Digidrum-Timing am 50-Hz-VBL-Takt.'],
    [4, 'Vierter Dump aus Eclipse/Thalions <strong>Lethal Xcess</strong> (1991). Während die Musik spielte, schob Bittners Code im Hintergrund gigantische 16-Bit-Overscan-Bitmaps über den ST-Bildschirm.', '<strong>YM5! · 4 Digidrum-Blöcke (<code>Lethal XCess Music 4</code>)</strong>. Bemerkenswert ist die enge Verzahnung aus scharfer Rechteck-Bassline, Hardware-Hüllkurve und kurzen 4-Bit-Drum-Schlägen.'],
    [5, 'Fünfter Track des 1991er <strong>Lethal-Xcess</strong>-Soundtracks. Eine der letzten großen ST-Action-Produktionen von Jochen Hippel, bevor sich Thalion immer stärker auf Amiga und PC konzentrierte.', '<strong>YM5! · 4 Digidrum-Blöcke (<code>Lethal XCess Music 5</code>)</strong>. Eingebetteter Name <code>Lethal XCess Music 5</code> mit <code>Mad Max</code> im Autorenfeld.'],
    [6, 'Sechster Dump aus <strong>Lethal Xcess</strong> (1991). Hippels typische Wechsel zwischen heroischen Fanfaren und gehetzten Moll-Arpeggios verleihen auch den späteren Spielabschnitten enormen Zug.', '<strong>YM5! · 4 Digidrum-Blöcke (<code>Lethal XCess Music 6</code>)</strong>. Der YM5!-Container erhält sowohl die regulären Registeränderungen als auch die timer-basierten Digidrum-Blöcke sauber abspielbar.'],
    [7, 'Siebter und letzter Musikdump aus <strong>Lethal Xcess</strong> (1991) – dem großen Finale von Thalions hauseigener Shooter-Dilogie.', '<strong>YM5! · 4 Digidrum-Blöcke (<code>Lethal XCess Music 7</code>)</strong>. Schließt das siebenstufige Shooter-Paket mit voller 4-Digidrum-Unterstützung ab.']
];

export const atariMuseumMetadata = {
    // =========================================================================
    // GAMES: 1987–1988
    // =========================================================================
    "games/goldrunner.ym": museum(
        'ROB HUBBARD — GOLDRUNNER (1987)',
        `Ein historischer Meilenstein mit amüsanter Vorgeschichte: Im Frühjahr 1987 überredete Steve Bak seinen Freund <strong>Rob Hubbard</strong>, sich endlich einen Atari ST zuzulegen – doch Hubbard hasste den primitiven YM2149-Soundchip im Vergleich zu seinem geliebten C64-SID zunächst wie die Pest! Um dem berüchtigten „Super-Scroller“ <strong>Goldrunner</strong> dennoch eine würdige Musik zu verpassen, nutzte Hubbard den ST-Treiber von Kollege David Whittaker und goss einfach sein eigenes C64-Stück aus <em>Human Race</em> (Level 4, 1985) in ein treibendes ST-Arrangement um (im Spiel selbst noch begleitet von digitalisierter Sprache).`,
        `<strong>YM5! · 50 Hz · 9.408 Frames (188,16 s) · keine Digidrums</strong>. Konvertiert von Oedipus. Reines, schnörkelloses 1987er-Pionierwerk: Ohne Timer-Samples oder wilde SID-Buzzer-Hacks zeigt Hubbard allein durch messerscharfes Sequenzing, was selbst in der Frühzeit im ST-Sound steckte.`,
        wiki('Goldrunner', 'Goldrunner'),
        ST_SOUND
    ),
    "games/xenon/title.ym": museum(
        'DAVID WHITTAKER — XENON / TITEL (1988)',
        `Das allererste Spiel der legendären <strong>Bitmap Brothers</strong>! Als der Panzer- und Jet-Shooter <strong>Xenon</strong> im Januar 1988 erschien, setzte er sofort Maßstäbe für den kühl-metallischen Bitmap-Stil – und <strong>David Whittaker</strong> komponierte den krachenden Soundtrack direkt auf dem Atari ST. Erst durch den eingebetteten Headernamen <code>Xenon (Title)</code> ließ sich dieser Track sauber als das unvergessliche Titelstück identifizieren.`,
        `<strong>YM5! · 5.759 Frames · keine Digidrums · Konversion: Oedipus</strong>. Whittaker verstand den YM2149 früh wie kaum ein Zweiter: trockene, extrem schneidende Rechteck-Leads und schnelle Bass-Läufe ohne jeden Sample-Ballast.`,
        wiki('Xenon_(video_game)', 'Xenon')
    ),
    "games/xenon/ingame.ym": museum(
        'DAVID WHITTAKER — XENON / INGAME (1988)',
        `Während das Titelthema die Kassen klingeln ließ, begleitete diese knapp vierminütige Komposition (<code>Xenon (Ingame)</code>) das eigentliche Spielgeschehen zwischen Panzer- und Flugmodus – eine der längsten und ausdauerndsten frühen Atari-ST-Ingame-Kompositionen von <strong>David Whittaker</strong>.`,
        `<strong>YM5! · 12.287 Frames (ca. 4:05 min) · keine Digidrums</strong>. Reine Drei-Stimmen-Chip-Synthese bei 50 Hz, die durch geschicktes Rhythmisieren des Rauschgenerators (Kanal-Sharing zwischen Snare und Lead) auch ohne Digidrums ordentlich schiebt.`,
        wiki('Xenon_(video_game)', 'Xenon')
    ),
    "games/xenon/end-of-level-battle.ym": museum(
        'DAVID WHITTAKER — XENON / END-OF-LEVEL-BATTLE (1988)',
        `Wenn am Ende jedes Sektors die gewaltigen Endgegner von <strong>Xenon</strong> ins Bild rollten, zog <strong>David Whittaker</strong> das Tempo und die Dramatik schlagartig an. Dieser eigenständige Boss-Track (<code>Xenon (End of level battle)</code>) beweist, wie früh Multi-Track-Dynamik auf dem ST Einzug hielt.`,
        `<strong>YM5! · 3.071 Frames (ca. 61 s Loop)</strong>. Kurze, gehetzte Sequenzen mit scharfen Tonhöhensprüngen treiben die Spannung im Bosskampf in die Höhe.`,
        wiki('Xenon_(video_game)', 'Xenon')
    ),
    "games/speedball/speedball-1.ym": museum(
        'DAVID WHITTAKER — SPEEDBALL (1988)',
        `Im November 1988 schickten die Bitmap Brothers ihren futuristischen Brutalo-Sport <strong>Speedball</strong> erstmals in die stählerne Arena – natürlich wieder vertont von Hauskomponist <strong>David Whittaker</strong> (bevor <em>Speedball 2</em> zwei Jahre später auf dem Amiga mit Nation 12 Popgeschichte schrieb). Ein kraftvoller, kantiger ST-Score, der perfekt zur eisernen Sci-Fi-Optik passt.`,
        `<strong>YM5! · 50 Hz · 7.529 Frames (ca. 2:30 min)</strong>. Eingebetteter Titel <code>Speedball</code>. Whittaker entlockt dem YM2149 mit straffen Bass-Pulsen und präzisen Hüllkurven-Clicks ein trockenes, fast industrielles Sportarena-Flair.`,
        ST_SOUND
    ),
    "games/bionic-commando.ym": museum(
        'TIM FOLLIN — BIONIC COMMANDO (1988)',
        `Der 17-jährige Brite <strong>Tim Follin</strong> war dafür berüchtigt, auf jedem Heimcomputer Klänge zu erzeugen, die Hardware-Spezifikationen Lügen straften – so auch bei Software Creations’ Atari-ST-Umsetzung von Capcoms <strong>Bionic Commando</strong> (1988). Angetrieben von der Musikroutine seines Bruders Mike Follin übertrug Tim Harumi Fujitas Arcade-Motive mit verblüffender Wucht auf den simplen ST-Chip.`,
        `<strong>YM5! · 50 Hz · 4.735 Frames · keine Digidrums</strong>. Follins Geheimwaffe auf drei schlichten Rechteckwellen: extrem schnelle Arpeggios und raffinierte Schwebungen (leichte Verstimmungen zwischen zwei Kanälen), die auf dem trockenen YM2149 einen überraschend fetten Chorus-Klang erzeugen.`,
        ST_SOUND
    ),
    "games/giana-sisters/title.ym": museum(
        'JOCHEN HIPPEL / CHRIS HÜLSBECK — GIANA SISTERS / TITEL (1988)',
        `Eines der frühesten kommerziellen Bravourstücke von <strong>Jochen Hippel</strong>: Für Rainbow Arts’ ST-Portierung des indizierten C64-Kulthits <strong>The Great Giana Sisters</strong> übertrug Hippel Chris Hülsbecks 1987er Meisterwerk auf den Yamaha YM2149 – und schuf damit eine der beliebtesten Chip-Konvertierungen der ganzen ST-Ära.`,
        `<strong>YM-Archiv · Eingebettet: <code>Great Giana Sisters (title)</code> · Autor: Jochen Hippel</strong>. Statt der warmen SID-Filter-Leads des C64 schneidet Hülsbecks Madonna-Hommage auf dem Atari ST mit glockenklaren, präzisen Rechteckwellen-Stimmen direkt durch.`,
        exotica('The_Great_Giana_Sisters', 'The Great Giana Sisters'),
        exotica('Jochen_Hippel', 'Jochen Hippel')
    ),
    "games/giana-sisters/ingame-1.ym": museum(
        'JOCHEN HIPPEL / CHRIS HÜLSBECK — GIANA SISTERS / INGAME 1 (1988)',
        `Das unsterbliche Oberwelt-Stück der Giana-Schwestern in seiner Atari-ST-Fassung (1988): Während Amiga-Spieler zur gleichen Zeit Thomas Lopatics gesampelte Beathoven-Klänge hörten, hielt <strong>Jochen Hippel</strong> auf dem ST am kristallinen 8-Bit-Chiptune-Charme des C64 fest.`,
        `<strong>YM-Archiv · Eingebettet: <code>Great Giana Sisters (ingame1)</code> · Autor: Jochen Hippel</strong>. Der Reggae-Groove sitzt auf dem YM2149 verblüffend tight: Knackige Rausch-Hi-Hats und treibende Hardware-Hüllkurven-Bässe lassen kaum vermissen, dass dem Chip echte Pulswellen-Breiten fehlen.`,
        exotica('The_Great_Giana_Sisters', 'The Great Giana Sisters')
    ),
    "games/giana-sisters/ingame-2.ym": museum(
        'JOCHEN HIPPEL / CHRIS HÜLSBECK — GIANA SISTERS / INGAME 2 (1988)',
        `Das zweite große Level-Thema (auf dem Amiga bekannt als <em>Cave BGM</em>) begleitet die geheimnisvollen Untergrund-Abschnitte von <strong>The Great Giana Sisters</strong>. <strong>Jochen Hippel</strong> trifft den treibenden, leicht düsteren Ton der C64-Vorlage mit chirurgischer Präzision.`,
        `<strong>YM-Archiv · Eingebettet: <code>Great Giana Sisters (ingame2)</code> · Autor: Jochen Hippel</strong>. Klassische Drei-Kanal-Aufteilung mit schneidender Lead-Melodie, flinker Akkord-Arpeggierung und markantem Rechteck-Bass.`,
        exotica('The_Great_Giana_Sisters', 'The Great Giana Sisters')
    ),
    "games/giana-sisters/ingame-3.ym": museum(
        'JOCHEN HIPPEL / CHRIS HÜLSBECK — GIANA SISTERS / INGAME 3 (1988)',
        `Drittes Ingame-Motiv der ST-Version von <strong>The Great Giana Sisters</strong>. Anders als in den ersten beiden Files vermerkt der Container im Autorenfeld ausdrücklich beide Köpfe: <code>Jochen Hippel (Chris Huelsbeck)</code>.`,
        `<strong>YM-Archiv · Eingebettet: <code>Great Giana Sisters</code></strong>. Dokumentiert sauber sowohl die kompositorische Urheberschaft Hülsbecks als auch Hippels eigenständige ST-YM2149-Bearbeitung.`,
        exotica('The_Great_Giana_Sisters', 'The Great Giana Sisters')
    ),
    "games/giana-sisters/bonus.ym": museum(
        'JOCHEN HIPPEL / CHRIS HÜLSBECK — GIANA SISTERS / BONUS STAGE (1988)',
        `Kurzes, überschäumendes Motiv für die Geheim- und Bonuspassagen von <strong>The Great Giana Sisters</strong> auf dem Atari ST, bearbeitet von <strong>Jochen Hippel</strong>.`,
        `<strong>YM-Archiv · Eingebettet: <code>Great Giana Sisters (bonus stage)</code></strong>. Ein knackiges Mini-Arrangement im 50-Hz-Registerdump, das trotz seiner Kürze eigenständig im Archiv bewahrt wird.`,
        exotica('The_Great_Giana_Sisters', 'The Great Giana Sisters')
    ),
    "games/giana-sisters/highscore.ym": museum(
        'JOCHEN HIPPEL / CHRIS HÜLSBECK — GIANA SISTERS / HIGHSCORE (1988)',
        `Der würdige Abschluss nach verlorenen Leben oder neuem Punkterekord in <strong>The Great Giana Sisters</strong>: Ein weiterer kleiner Chip-Ohrwurm, bei dem der Container sowohl <strong>Jochen Hippel</strong> als auch Originalkomponist <strong>Chris Hülsbeck</strong> nennt.`,
        `<strong>YM-Archiv · Eingebettet: <code>Great Giana Sisters</code></strong>. Geschlossener, sauber looperhaltender Register-Capture der ST-Highscore-Sequenz.`,
        exotica('The_Great_Giana_Sisters', 'The Great Giana Sisters')
    ),

    // =========================================================================
    // GAMES: 1989
    // =========================================================================
    "games/xenon-2/megablast.ym": museum(
        'DAVID WHITTAKER / BOMB THE BASS — XENON 2: MEGABLAST (1989)',
        `Einer der kultigsten Lizenzeinkäufe der Spielegeschichte: Für <strong>Xenon 2: Megablast</strong> (August/September 1989) engagierten die Bitmap Brothers nicht nur <strong>Tim Simenon (Bomb the Bass)</strong> – dessen Club-Hit <em>Megablast (Hip Hop on Precinct 13)</em> wiederum direkt auf John Carpenters Filmmusik zu <em>Assault – Anschlag bei Nacht</em> aufbaute! Während die Amiga-Fassung mit fetten Hip-Hop-Samples protzte, lieferte <strong>David Whittaker</strong> auf dem Atari ST das Kunststück ab, den Club-Track rein aus dem YM2149 herauszuschälen.`,
        `<strong>YM3! (ohne Header-Metadaten)</strong>. Ein frühes, rohes <strong>YM3!</strong>-Capture noch vor Leonards YM5!/YM6!-Erweiterungen: keine eingebetteten Metadaten oder Digidrum-Blöcke, sondern die nackte, kompromisslose 1989er Chip-Fassung des Beats.`,
        wiki('Xenon_2:_Megablast', 'Xenon 2: Megablast'),
        ATARI_SOURCES
    ),
    "games/chambers-of-shaolin/title.ym": museum(
        'JOCHEN HIPPEL — CHAMBERS OF SHAOLIN / TITEL (1989)',
        `Thalions großer Durchbruch von 1989! Programmiert von <strong>Marc Rosocha</strong> (dem späteren Producer von <em>Wings of Death</em>) und Erik Simon, verlangt das fernöstliche Prügel- und Geschicklichkeitsspiel erst sechs knallharte Trainingsprüfungen vor dem Turnier. Musikalisch setzte <strong>Jochen Hippel</strong> einen Meilenstein auf dem Atari ST: Zeitgenössische Magazine feierten begeistert, wie Hippel hier erstmals seine ST-Soundchip-Musik direkt mit satten, gesampelten <strong>Digidrums</strong> mischte!`,
        `<strong>YM6! · 24.600 Frames (8:12 min!) · Konversion: Leonard</strong>. Über acht Minuten lang entfaltet sich das fernöstlich angehauchte Hauptthema (<code>Chambers of Shaolin Title Track</code>) in einem gewaltigen YM6!-Container.`,
        wiki('Chambers_of_Shaolin', 'Chambers of Shaolin'),
        exotica('Jochen_Hippel', 'Jochen Hippel')
    ),
    "games/chambers-of-shaolin/loader.ym": museum(
        'JOCHEN HIPPEL — CHAMBERS OF SHAOLIN / LOADER (1989)',
        `Auch während <strong>Chambers of Shaolin</strong> 1989 von den Floppy-Disks nachlud, ließ Thalion die Spieler nicht im Stillen warten: <strong>Jochen Hippel</strong> spendierte eine eigene, fast dreiminütige Lademusik (im historischen Header charmant verschrieben als <code>Chambers of Shalolin Loader</code>).`,
        `<strong>YM6! · 8.550 Frames (171 s)</strong>. Deutlich kürzer und fokussierter als das achteinhalbminütige Titelthema, technisch im selben späten YM6!-Archivstandard bewahrt.`,
        wiki('Chambers_of_Shaolin', 'Chambers of Shaolin')
    ),
    "games/stormlord/title.ym": museum(
        'JOCHEN HIPPEL / MANIACS OF NOISE — STORMLORD / TITEL (1989)',
        `Hewson Consultants und Entwickler-Legende Raffaele Cecco (<em>Cybernoid</em>) brachten 1989 das Fantasy-Jump-’n’-Run <strong>Stormlord</strong> auf die 16-Bit-Rechner – berühmt für seine detaillierten Pixel-Animationen und die für damalige Verhältnisse ziemlich gewagte Feen-Grafik (die später in den USA entschärft wurde). Der eingängige Soundtrack stammte ursprünglich aus der Schmiede der niederländischen <strong>Maniacs of Noise</strong> (Johannes Bjerregaard) – und <strong>Jochen Hippel</strong> adaptierte ihn als ausdrückliche <code>MoN conversion</code> für den Atari ST!`,
        `<strong>YM5! · 18.624 Frames (ca. 6:12 min) · Konversion: Leonard</strong>. Eingebettet als <code>Stormlord: Title (MoN conversion)</code>: Hippel übersetzt die federnden Bjerregaard-Basslines souverän auf die Hüllkurven des YM2149.`,
        ST_SOUND
    ),
    "games/stormlord/ingame.ym": museum(
        'JOCHEN HIPPEL / MANIACS OF NOISE — STORMLORD / INGAME (1989)',
        `Während das Titelthema die Richtung vorgibt, legt die Ingame-Musik zu <strong>Stormlord</strong> (1989) noch einmal eine Schippe Laufzeit oben drauf – über acht Minuten durchkomponierte Abenteuer-Begleitung nach der Originalvorlage der <em>Maniacs of Noise</em>.`,
        `<strong>YM5! · 24.576 Frames (ca. 8:11 min)</strong>. Eingebettet als <code>Stormlord Ingame (MoN conversion)</code>; ein eindrucksvolles Beispiel dafür, wie stark sich deutsche ST-Komponisten und holländische C64-Künstler Ende der 80er gegenseitig inspirierten.`,
        ST_SOUND
    ),
    "games/spherical-intro.ym": museum(
        'ATARI ST · RAINBOW ARTS — SPHERICAL / INTRO (1989)',
        `Ein lange falsch einsortiertes Spieljuwel, jetzt endlich am richtigen Platz! <strong>Spherical</strong> war 1989 ein cleverer Action-Puzzler von <strong>Rainbow Arts</strong> rund um einen kleinen Zauberer und springende Kugeln (wie eine Mischung aus <em>Lode Runner</em> und <em>Solomon’s Key</em>). Nur weil im ST-Archiv als Autor <code>unknown</code> eingetragen blieb, galt dieses über dreiminütige Intro-Thema lange irrtümlich als Demoscene-Track.`,
        `<strong>YM6! · 10.930 Frames (218,6 s) · Konversion: Jochen Knaus</strong>. Eingebettet als <code>Spherical: Spherical I (Intro)</code>. Typischer später 80er-Rainbow-Arts-Klang mit zackigen Rechteck-Arpeggios und verspielter Melodieführung.`,
        wiki('Spherical_(video_game)', 'Spherical')
    ),
    "games/ghouls-n-ghosts/ghouls-1.ym": museum(
        'TIM FOLLIN — GHOULS ’N GHOSTS / FASSUNG 1 (1989)',
        `Nach seinem Meisterstreich auf dem C64 (zusammen mit Tamayo Kawamotos überragender Capcom-Arcade-Vorlage) übertrug <strong>Tim Follin</strong> den schaurigen Ritter-Score von <strong>Ghouls ’n Ghosts</strong> 1989 auch für den Atari ST. Ein wilder, virtuoser Ritt durch gotische Orgel-Läufe und rockige Bassfiguren.`,
        `<strong>YM-Archiv · Eingebettet: <code>Ghouls'n Ghosts</code> · Autor: Tim Follin</strong>. Erste von drei archivierten Fassungen aus der ST-Umsetzung – unverkennbar Follins Handschrift durch extrem straffe Harmoniewechsel auf nur drei Rechteckstimmen.`,
        ST_SOUND
    ),
    "games/ghouls-n-ghosts/ghouls-2.ym": museum(
        'TIM FOLLIN — GHOULS ’N GHOSTS / FASSUNG 2 (1989)',
        `Zweite überlieferte YM-Archivfassung aus der ST-Portierung von Capcoms Kult-Actionspiel <strong>Ghouls ’n Ghosts</strong> (1989). Während auf dem Spielautomaten noch FM-Synthese hämmerte, verwandelt <strong>Tim Follin</strong> die Motive hier in scharfe, fast barocke 16-Bit-Rechteck-Polyphonie.`,
        `<strong>YM-Archiv · Eingebettet: <code>Ghouls'n Ghosts</code> · Autor: Tim Follin</strong>. Saubere Dokumentation des zweiten archivierten Registerdumps aus dem Spiel.`,
        ST_SOUND
    ),
    "games/ghouls-n-ghosts/ghouls-3.ym": museum(
        'TIM FOLLIN — GHOULS ’N GHOSTS / FASSUNG 3 (1989)',
        `Dritte archivierte Fassung aus Software Creations’ ST-Fassung von <strong>Ghouls ’n Ghosts</strong> (1989). Zeigt eindrucksvoll, warum <strong>Tim Follin</strong> selbst aus dem trockenen Yamaha-Chip eine Dramatik herausholte, an der fast alle westlichen Kollegen scheiterten.`,
        `<strong>YM-Archiv · Eingebettet: <code>Ghouls'n Ghosts</code> · Autor: Tim Follin</strong>. Komplettiert die drei archivierten ST-Varianten neben Follins <em>Bionic Commando</em> und <em>LED Storm</em>.`,
        ST_SOUND
    ),
    "games/led-storm/led-storm-1.ym": museum(
        'TIM FOLLIN — LED STORM (1989)',
        `Capcoms futuristischer Überholspur-Racer <strong>LED Storm</strong> erhielt 1989 von Software Creations eine blitzschnelle 16-Bit-Umsetzung – und wieder saß Ausnahme-Musiker <strong>Tim Follin</strong> am Sounddriver. Anders als beim schnöden Automaten-Gedudel liefert Follin hier pure Hochgeschwindigkeits-Ekstase ab.`,
        `<strong>YM5! · 50 Hz · 8.109 Frames (Loop bei Frame 8.099) · Konversion: Oedipus</strong>. Knapp 2:42 Minuten non-stop Adrenalin über knackig getimte Rechteck-Riffs und rasende Hüllkurven-Grooves.`,
        ST_SOUND
    ),

    // =========================================================================
    // GAMES: 1990–1991
    // =========================================================================
    "games/enchanted-land-intro.ym": museum(
        'JOCHEN HIPPEL — ENCHANTED LAND / INTRO (1990)',
        `Demo-Elite trifft kommerzielles Jump-’n’-Run: Thalion ließ das knallbunte Fantasy-Spiel <strong>Enchanted Land</strong> 1990 niemand anderem als den schwedischen Demo-Superstars <strong>The CareBears (TCB)</strong> programmieren! Die Musik schrieb natürlich <strong>Jochen Hippel</strong> – und zwar so eingängig, dass sie kurz darauf sogar in Demo-Reset-Screens wie bei Delta Forces <em>Punish Your Machine</em> wiederverwendet wurde!`,
        `<strong>YM6! · 11.650 Frames (233 s) · keine Digidrums · Konversion: Leonard</strong>. Eingebettet als <code>Enchanted Lands: Intro</code>. Fast vier Minuten lange, glasklare ST-Chip-Melodik ohne Sample-Tricks.`,
        exotica('Jochen_Hippel', 'Jochen Hippel')
    ),
    "games/dragonflight/title.ym": museum(
        'JOCHEN HIPPEL — DRAGONFLIGHT / TITEL (1990)',
        `1990 schlug die große Stunde des jungen Gütersloher Studios <strong>Thalion</strong>: Mit dem epischen Rollenspiel <strong>Dragonflight</strong> bewiesen die Ex-Demo-Stars von <em>The Exceptions</em>, dass sie nicht nur megacoole Cracktros, sondern ganze Fantasy-Welten bauen konnten. <strong>Jochen Hippel (Mad Max)</strong> komponierte für das Titelthema eines seiner majestätischsten Stücke auf dem Atari ST.`,
        `<strong>YM6! · 50 Hz · 21.250 Frames (7:05 min!) · Konversion: Jochen Knaus</strong>. Über sieben Minuten Laufzeit voller feierlicher Fanfaren, treibender Bässe und dramatischer Taktwechsel auf dem reinen YM2149.`,
        hol(412, 'Dragonflight'),
        exotica('Jochen_Hippel', 'Jochen Hippel')
    ),
    "games/dragonflight/city-1.ym": museum(
        'JOCHEN HIPPEL — DRAGONFLIGHT / STADT 1 (1990)',
        `Erstes der drei archivierten Stadt-Themen aus Thalions Rollenspiel <strong>Dragonflight</strong> (1990). Während die Amiga-Version in <code>town.hipc</code> mit gerade einmal 724 Bytes PCM-Wellenformen auskam, speiste die ST-Fassung ihre charmante Tavernen- und Gassenstimmung direkt aus den reinen YM2149-Registern.`,
        `<strong>YM6! · 9.200 Frames (184 s) · Konversion: Leonard</strong>. Eingebettet als <code>Dragonflight: City</code> mit <code>Jochen Hippel</code> als Autor.`,
        hol(412, 'Dragonflight')
    ),
    "games/dragonflight/city-2.ym": museum(
        'JOCHEN HIPPEL — DRAGONFLIGHT / STADT 2 (1990)',
        `Zweite Stadt-Komposition aus Thalions <strong>Dragonflight</strong> (1990) – über vier Minuten lang und voller verträumter Mittelalter-Anklänge aus der Feder von <strong>Mad Max</strong>.`,
        `<strong>YM6! · 12.300 Frames (246 s)</strong>. Eingebettet als <code>Dragonflight: City #2</code>; nutzt fein modulierte Hardware-Hüllkurven für warme, flötenartige Oberstimmen.`,
        hol(412, 'Dragonflight')
    ),
    "games/dragonflight/city-3.ym": museum(
        'JOCHEN HIPPEL — DRAGONFLIGHT / STADT 3 (1990)',
        `Dritte Stadt-Fassung aus <strong>Dragonflight</strong> (1990) – etwas kompakter als Teil 1 und 2, aber mit derselben unverwechselbaren Gütersloher Thalion-Handschrift.`,
        `<strong>YM6! · 7.150 Frames (143 s)</strong>. Eingebettet als <code>Dragonflight: City #3</code>; das direkte Gegenstück zur Amiga-COSO-Suite.`,
        hol(412, 'Dragonflight')
    ),
    "games/dragonflight/unknown.ym": museum(
        'JOCHEN HIPPEL — DRAGONFLIGHT / SZENE UNBEKANNT (1990)',
        `Ein kleines Mysterium aus dem <strong>Dragonflight</strong>-Archiv (1990): Dieser anderthalbminütige Track von <strong>Jochen Hippel</strong> trug schon beim Rippen nur ein Fragezeichen im Titel (<code>Dragonflight: ?</code>) und ergänzt die fünf ST-Dumps des Rollenspiels.`,
        `<strong>YM6! · 4.600 Frames (92 s) · Konversion: Leonard</strong>. Zeigt auch in dieser kompakten Form Hippels sicheres Gespür für geschlossene Spannungsbögen auf drei Kanälen.`,
        hol(412, 'Dragonflight')
    ),
    "games/wings-of-death/loader.ym": museum(
        'JOCHEN HIPPEL — WINGS OF DEATH / LOADER (1990)',
        `Der Startschuss zu einem der technisch beeindruckendsten Atari-ST-Spiele des Jahres 1990: Bevor <strong>Wings of Death</strong> das Feuer eröffnete, bereitete <strong>Jochen Hippels</strong> knackiger Loader die Spieler akustisch auf die kommenden Digisynth-Salven vor.`,
        `<strong>YM6! · 1.550 Frames (31 s) · 5 Digidrum-Blöcke · Konversion: Leonard</strong>. Als einziger Track der Gruppe ausdrücklich als Loader betitelt – gleich mit fünf eingebetteten Timer-Digidrums im Bauch!`,
        exotica('Jochen_Hippel', 'Jochen Hippel')
    ),
    ...Object.fromEntries(
        wingsLevelDetails.map(([level, drums, hist, tech]) => [
            `games/wings-of-death/level-${level}.ym`,
            museum(`JOCHEN HIPPEL — WINGS OF DEATH / MUSIKDUMP 0${level} (1990)`, hist, tech, exotica('Jochen_Hippel', 'Jochen Hippel'))
        ])
    ),
    "games/turrican/turrican-1-world-1-1.ym": museum(
        'CHRIS HÜLSBECK & JOCHEN HIPPEL — TURRICAN / WORLD 1-1 (1990)',
        `Manfred Trenz’ Über-Actionspiel <strong>Turrican</strong> schlug 1990 ein wie ein Meteorit – und genau für den Sound arbeiteten zwei Freunde aus der deutschen 16-Bit-Elite Hand in Hand: <strong>Chris Hülsbeck</strong> lieferte das epochale Original, während ST-Magier <strong>Jochen Hippel</strong> die Musik für den Atari ST auf den Yamaha YM2149 übersetzte. Schon im ersten Level (<em>World 1-1</em>) hämmerten die Drums dank Timer-Samples mit ungeahnter Kraft aus dem ST.`,
        `<strong>YM5! · 6.480 Frames (ca. 2:10 min) · 3 Digidrum-Blöcke · Konversion: Oedipus</strong>. Eingebetteter Titel <code>Turrican</code>. Drei eingebettete Digidrum-Samples fangen die Wucht von Hülsbecks Amiga-Trommeln erstaunlich druckvoll ein.`,
        wiki('Turrican', 'Turrican'),
        exotica('Jochen_Hippel', 'Jochen Hippel')
    ),
    "games/turrican/turrican-2-desert-rocks.ym": museum(
        'CHRIS HÜLSBECK & JOCHEN HIPPEL — TURRICAN II / THE DESERT ROCKS (1991)',
        `Während Chris Hülsbeck bei <strong>Turrican II: The Final Fight</strong> (1991) auf dem Amiga seine berühmte 7-Voice-Engine zündete, setzte <strong>Jochen Hippel</strong> auf dem Atari ST noch einmal einen drauf: Für das ikonische Wüsten-Thema <strong>The Desert Rocks</strong> (Welt 1-1 / Secret Area) reizte er den ST-Timer mit gleich zehn Digidrum-Bausteinen bis an die Belastungsgrenze aus!`,
        `<strong>YM6! · 10.080 Frames (3:21,6 min) · 10 Digidrum-Blöcke</strong>. Ein absolutes Technik-Brett: Zehn eingebettete Digidrum-Blöcke befeuern das rhythmische Fundament unter Hülsbecks mitreißender Melodie – ohne zusätzliche Hardwarekanäle, rein durch hochfrequentes MFP-Timer-Timing.`,
        wiki('Turrican_II:_The_Final_Fight', 'Turrican II')
    ),
    ...Object.fromEntries(
        lethalXcessDetails.map(([num, hist, tech]) => [
            `games/lethal-xcess/music-${num}.ym`,
            museum(`JOCHEN HIPPEL — LETHAL XCESS / MUSIK ${num} (1991)`, hist, tech, wiki('Lethal_Xcess', 'Lethal Xcess'))
        ])
    ),

    // =========================================================================
    // GAMES: 1992 — AMBERSTAR (20 ARCHIVDUMPS)
    // =========================================================================
    ...Object.fromEntries(
        amberstarHighlights.map(([archiveNum, filePad, hist, tech]) => [
            `games/amberstar/amber-${filePad}.ym`,
            museum(`JOCHEN HIPPEL — AMBERSTAR / MUSIK #${archiveNum} (1992)`, hist, tech, exotica('Amberstar', 'Amberstar'), hol(3257, 'Amberstar'))
        ])
    ),

    // =========================================================================
    // DEMOSCENE (1989–1993)
    // =========================================================================
    "demoscene/thalion-intro.ym": museum(
        'JOCHEN HIPPEL — THALION INTRO',
        `Kaum eine Melodie weckt bei alten Atari-ST-Veteranen so sofort das nostalgische Floppy-Laufwerk-Knattern wie dieses <strong>Thalion Intro</strong> von <strong>Jochen Hippel</strong>. Bevor auf dem ST überhaupt die ersten Thalion-Spiele starteten, sorgte diese federleichte, fast drei Minuten lange Intro-Hymne auf Cracktros, Vorspännen und Werbedisketten für sofortigen Wiedererkennungswert.`,
        `<strong>YM5! · 50 Hz · 8.868 Frames (Loop bei Frame 1.016) · Konversion: Oedipus</strong>. Über dreieinhalb Minuten reiner, zeitloser Mad-Max-Chip-Zauber mit sauberem Loop-Einsprung nach dem Intro-Teil.`,
        exotica('Jochen_Hippel', 'Jochen Hippel')
    ),
    "demoscene/union-demo/loader.ym": museum(
        'MAD MAX / MANIACS OF NOISE — THE UNION DEMO / LOADER (1989)',
        `Der Startschuss zu einem Beben der 16-Bit-Szene: Am <strong>7. Januar 1989</strong> erschien <strong>The Union Demo</strong> – das bahnbrechende Gemeinschafts-Megademo des großen Atari-ST-Verbunds <em>The Union</em> (u. a. <em>The Exceptions</em>, <em>The CareBears</em>, <em>Level 16</em>, <em>Delta Force</em>, <em>TNT-Crew</em>, <em>The Replicants</em>), das direkt unter dem legendären Motto <em>„…needs no customchips!!“</em> dem Amiga den Kampf ansagte. Schon im Loader (<code>ThinkTwice</code>) schlägt <strong>Mad Max</strong> eine Brücke zur Konkurrenzplattform und adaptiert ein Stück der niederländischen C64-Größen <em>Maniacs of Noise</em>.`,
        `<strong>YM5! · PaCifiST-Dump · Loop-Frame 1</strong>. Eingebettet als <code>Union Demo LOADER</code> mit Credits an Mad Max und die Maniacs of Noise – knackige ST-Synthese als Einstimmung auf zwölf legendäre Demo-Screens.`,
        wiki('Atari_ST', 'Atari ST'),
        exotica('Jochen_Hippel', 'Jochen Hippel')
    ),
    "demoscene/union-demo/menu.ym": museum(
        'MAD MAX / M.O.N. — THE UNION DEMO / HAUPTMENÜ (1989)',
        `Die Schaltzentrale von <strong>The Union Demo</strong> (Januar 1989): Im berühmten Hauptmenü der Demo spaziert ein winziges Männchen über eine Landschaft zu den Portalen der einzelnen Demo-Teams. Während man zum nächsten Screen lief, spielte <strong>Mad Max’</strong> mitreißende ST-Adaption von <em>Alloy Run</em> (Maniacs of Noise).`,
        `<strong>YM5! · PaCifiST-Dump · Loop-Frame 1</strong>. Eingebettet als <code>Union Demo MENU</code>; im Autorenfeld stehen <code>Mad Max</code>, <code>Alloyrun</code> und <code>M.O.N.</code>. Flotte Arpeggios und helle Rechteck-Leads halten die Menü-Navigation in Schwung.`,
        ST_SOUND
    ),
    "demoscene/union-demo/copier.ym": museum(
        'MAD MAX / M.O.N. — THE UNION DEMO / COPIER (1989)',
        `Ein besonders typisches Relikt der späten 80er: In vielen Megademos dieser Ära gab es neben Grafik-Screens auch ein kleines Dienstprogramm – bei der <strong>Union Demo</strong> einen flinken Disketten-Kopierer von <strong>The Exceptions</strong> (<em>„The Copy-Programm“</em>). Musikalisch untermalt von <strong>Mad Max’</strong> ST-Umsetzung eines weiteren Stücks der <em>Maniacs of Noise</em> (<code>ThatsTheWayItIs</code>).`,
        `<strong>YM5! · PaCifiST-Dump · Loop-Frame 0</strong>. Eingebettet als <code>UNION DEMO Copier</code>. Gerade weil Kopierprogramme auf einem nicht unterbrechbaren Hardware-Track liefen, musste Hippels 50-Hz-Routine minimalen Speicher und CPU-Zeit fressen.`,
        ST_SOUND
    ),
    "demoscene/union-demo/sphericool-screen.ym": museum(
        'MAD MAX / ROB HUBBARD — THE UNION DEMO / SPHERICOOL SCREEN (1989)',
        `Ein denkwürdiger Doppelschlag: In der <strong>Union Demo</strong> steuerte die Stuttgarter Kultgruppe <strong>Delta Force</strong> ihren eigenen Part <em>The Delta Force Mega-Demo (Spherical Demo / Sphericool Screen)</em> bei – mit einem der damals spektakulärsten Kugel- und Vector-Screens auf dem ST. Für den passenden Sound nahm <strong>Mad Max</strong> Rob Hubbards legendären <em>Mega-Apocalypse</em>-Soundtrack (1987) auseinander und bewies, wie druckvoll der YM2149 Hubbards Synth-Grooves meistern konnte.`,
        `<strong>YM5! · PaCifiST-Dump · Loop-Frame 1.344</strong>. Eingebettet als <code>Sphericool Screen (UNION DEMO)</code> mit Rob Hubbard als Originalkomponist. Der späte Loop-Punkt bei Frame 1.344 überspringt das dramatische Eröffnungsthema sauber.`,
        exotica('Jochen_Hippel', 'Jochen Hippel')
    ),
    "demoscene/union-demo/l16-fullscreen.ym": museum(
        'MAD MAX — THE UNION DEMO / L16 FULLSCREEN (1989)',
        `Computer-Geschichte zum Anhören! Der berühmte Screen von <strong>Level 16</strong> in der <strong>Union Demo</strong> (Januar 1989) schrieb Software-Geschichte, weil er einer der allerersten echten <strong>Fullscreen-Overscan-Screens auf dem Atari ST</strong> war – die Programmierer tricksten den Shifter-Videochip exakt auf den Taktzyklus aus, um alle vier schwarzen Monitor-Ränder zu öffnen! Und weil dafür fast 100 % der CPU-Zeit im Raster gefressen wurden, brauchte der Screen eine extrem schlanke, dennoch euphorische Eigenkomposition von <strong>Mad Max</strong>.`,
        `<strong>YM5! · PaCifiST-Dump · Loop-Frame 0</strong>. Eingebettet als <code>L16 FullScreen (Union Demo)</code> – anders als viele Nachbarscreens keine C64-Portierung, sondern echtes ST-Originalmaterial von Jochen Hippel.`,
        wiki('Atari_ST', 'Atari ST')
    ),
    "demoscene/union-demo/tnt-vector-screen.ym": museum(
        'MAD MAX / M.O.N. — THE UNION DEMO / TNT VECTOR SCREEN (1989)',
        `Der gefüllte 3D-Vektor-Screen der schwedischen <strong>TNT-Crew</strong> in der <strong>Union Demo</strong> (Januar 1989) brachte den 8-MHz-68000er des ST richtig ins Schwitzen – und bekam dafür <strong>Mad Max’</strong> kraftvolle ST-Bearbeitung von Maniacs of Noises treibendem <em>Last Ninja Remix</em> als akustischen Turbo verpasst.`,
        `<strong>YM5! · PaCifiST-Dump · Loop-Frame 0</strong>. Eingebettet als <code>TNT Vector Screen (UNION DEMO)</code>; verweist ausdrücklich auf <code>M.O.N.</code> als Originalkomponist.`,
        ST_SOUND
    ),
    "demoscene/union-demo/tcb-scroller.ym": museum(
        'MAD MAX / ROB HUBBARD — THE UNION DEMO / TCB SCROLLER (1989)',
        `<strong>The CareBears (TCB)</strong> aus Schweden – darunter Grafik- und Code-Größen wie AN Cool und Tanis – zeigten in ihrem berühmten <em>Wow!-Scroller</em> in der <strong>Union Demo</strong> (1989) endlose bunte Rasterschriften und Scrolling-Tricks. Für die musikalische Begleitung bearbeitete <strong>Mad Max</strong> Rob Hubbards unvergessliche C64-Titelmusik zum Zeichentrick-Actioner <em>ThunderCats</em> (1987).`,
        `<strong>YM5! · PaCifiST-Dump · Loop-Frame 384</strong>. Eingebettet als <code>TCB Scroller (UNION DEMO)</code>. Nach einem kurzen 7,7-Sekunden-Anlauf springt die Musik endlos bei Frame 384 wieder ein.`,
        exotica('Jochen_Hippel', 'Jochen Hippel')
    ),
    "demoscene/union-demo/wobbly-sprites.ym": museum(
        'MAD MAX / JEROEN TEL — THE UNION DEMO / WOBBLY SPRITES (1989)',
        `Auch die legendären französischen Cracker von <strong>The Replicants</strong> (Code: Excalibur, Grafik: Rank Xerox) schlossen sich dem Bündnis von <em>The Union</em> an und steuerten ihren berühmten <em>Wobbly Screen</em> bei. <strong>Mad Max</strong> lieferte dazu ein charmantes ST-Cover von Jeroen Tels (<em>Maniacs of Noise</em>) verspieltem C64-Stück <em>Children’s Songs</em>.`,
        `<strong>YM5! · PaCifiST-Dump · Loop-Frame 0</strong>. Eingebettet als <code>Replicants Wobbly Sprites (UNION DEMO)</code> mit Nennung von <code>Children Songs</code> und <code>M.O.N.</code> im Header.`,
        ST_SOUND
    ),
    "demoscene/union-demo/starballs-screen.ym": museum(
        'MAD MAX / ROB HUBBARD — THE UNION DEMO / STARBALLS SCREEN (1989)',
        `Noch ein Highlight der schwedischen <strong>TNT-Crew</strong> aus der <strong>Union Demo</strong> (Januar 1989): Im <em>Starballs</em>-Screen rotierten funkelnde Sternenkugeln über den Schirm, angetrieben von <strong>Mad Max’</strong> energiegeladener YM2149-Bearbeitung von Rob Hubbards C64-Klassiker <em>Pandora</em> (1988).`,
        `<strong>YM5! · PaCifiST-Dump · Loop-Frame 1</strong>. Eingebettet als <code>Starballs Screen (UNION DEMO)</code> mit Rob Hubbard als eingetragenem Originalkomponisten.`,
        ST_SOUND
    ),
    "demoscene/union-demo/beat-dis-screen.ym": museum(
        'MAD MAX / FRED GRAY — THE UNION DEMO / BEAT DIS SCREEN (1989)',
        `In diesem wilden Screen der Schweden von <strong>The CareBears</strong> (1989) regierte purer 80er-Sampling-und-House-Geist: Der Name erinnert zwar direkt an Bomb the Bass’ Club-Hit <em>Beat Dis</em>, die musikalische Vorlage für <strong>Mad Max’</strong> ST-Umsetzung stammt laut Header aber von niemand geringerem als C64-Pionier <strong>Fred Gray</strong> (<em>Pro BMX Simulator</em>, 1988)!`,
        `<strong>YM5! · PaCifiST-Dump · Loop-Frame 384</strong>. Eingebettet als <code>Beat Dis Screen (Union Demo)</code> mit ausdrücklicher Nennung von Fred Gray als Originalkomponist.`,
        ST_SOUND
    ),
    "demoscene/union-demo/superscroller-screen.ym": museum(
        'MAD MAX / JEROEN TEL — THE UNION DEMO / SUPERSCROLLER SCREEN (1989)',
        `Der dritte Streich der <strong>TNT-Crew</strong> aus der <strong>Union Demo</strong> (Januar 1989) brachte den wahrscheinlich berühmtesten C64-Ohrwurm des Jahres 1988 auf den Atari ST: <strong>Mad Max</strong> portierte Jeroen Tels (<em>Maniacs of Noise</em>) überragendes <em>Cybernoid</em>-Hauptthema auf den Yamaha-Chip – ein Stück, das sofort zum ewigen ST-Demo-Standard wurde.`,
        `<strong>YM5! · PaCifiST-Dump · Loop-Frame 12</strong>. Eingebettet als <code>SuperScroller Screen (UNION DEMO)</code> mit <code>Cybernoid</code> und <code>M.O.N.</code> im Autorenfeld.`,
        ST_SOUND
    ),
    "demoscene/syntax-terror/syntax-terror.ym": museum(
        'JOCHEN HIPPEL — SYNTAX TERROR (1990)',
        `Im Dezember 1990 präsentierte die deutsche Top-Gruppe <strong>Delta Force</strong> auf der legendären holländischen Party <strong>STNICCC 1990</strong> ihr zweites großes Megademo <strong>Syntax Terror</strong> – heute unter anderem dafür berühmt, dass The GigaByte Crew darin schon knapp zwei Jahre vor Amigas <em>World of Commodore</em> einen vollwertigen Echtzeit-Rotozoomer auf den ST zauberte! Den Soundtrack dieses rätselhaften <code>? screen</code> schrieb <strong>Jochen Hippel</strong> (nicht Big Alec).`,
        `<strong>YM6! · 5.350 Frames (107 s) · Konversion: Leonard</strong>. Eingebettet als <code>Syntax Terror: ? screen</code> – knackige 1990er ST-Chip-Komposition auf dem Höhepunkt der deutschen Delta-Force-Ära.`,
        exotica('Jochen_Hippel', 'Jochen Hippel')
    ),
    "demoscene/syntax-terror/tex-24hours.ym": museum(
        'JOCHEN HIPPEL — SYNTAX TERROR / TEX 24HOURS SCREEN (1990)',
        `Legendäre Demo-Anekdote direkt im Titel: <strong>The Exceptions (TEX)</strong> – ursprünglich die Wiege von Thalion und Jochen Hippels alte Heimatgruppe – steuerten für Delta Forces <strong>Syntax Terror</strong> (Dezember 1990) diesen berüchtigten Gast-Screen bei, den sie buchstäblich <strong>in einer 24-Stunden-Hauruckaktion</strong> zusammengeschraubt hatten!`,
        `<strong>YM6! · 9.248 Frames (Loop bei Frame 32) · Konversion: Jochen Knaus</strong>. Eingebettet als <code>Syntax Terror: TeX 24hours screen</code>; über drei Minuten treibende Hippel-Melodik ohne Digidrum-Krücken.`,
        exotica('Jochen_Hippel', 'Jochen Hippel')
    ),
    "demoscene/syntax-terror/tlb-screen.ym": museum(
        'JOCHEN HIPPEL — SYNTAX TERROR / TLB SCREEN (1990)',
        `In einer großen europäischen Kooperation fehlten natürlich auch Großbritanniens ST-Könige nicht: <strong>The Lost Boys (TLB)</strong> – bekannt durch Klassiker wie <em>Mindbomb</em> und <em>Ooh Crikey Wot a Scorcher</em> – bekamen in Delta Forces <strong>Syntax Terror</strong> (1990) ebenfalls einen Gast-Screen spendiert, erneut vertont von <strong>Jochen Hippel</strong>.`,
        `<strong>YM6! · 11.150 Frames (223 s) · Konversion: Leonard</strong>. Eingebettet als <code>Syntax Terror: TLB screen</code> – fast vier Minuten lang mit satten Buzzer-Bässen und schnellen Akkordwechseln.`,
        exotica('Jochen_Hippel', 'Jochen Hippel')
    ),
    "demoscene/punish-your-machine/best-part-of-creation.ym": museum(
        'BIG ALEC / DELTA FORCE — PUNISH YOUR MACHINE / BEST PART OF CREATION (1991)',
        `Wachablösung auf dem Atari-ST-Soundthron! Am <strong>13. November 1991</strong> veröffentlichte <strong>Delta Force</strong> auf der <em>International Coding Conference (ICC) #2</em> das monumentale Megademo <strong>Punish Your Machine</strong> (inklusive legendärer 4-Bit-Syncscroll-Screens). Während Jochen Hippel inzwischen voll bei Thalion eingespannt war, trat ein neuer deutscher Chip-Virtuose aus dem Schatten: <strong>Big Alec</strong> (Gunnar Gaubatz, später bekannt für <em>No Second Prize</em>)! Sein <strong>Best Part of the Creation</strong> gehört zu den kultigsten Tracks der späten 91er-Ära.`,
        `<strong>YM5! · 9.604 Frames (ca. 3:12 min) · 2 Digidrum-Blöcke · Konversion: Leonard</strong>. Der Container kennzeichnet die eingebetteten Samples ausdrücklich als bereits im <strong>4-Bit</strong>-Zielformat vorliegend – fette Timer-Drums treffen auf Big Alecs extrem saubere, federnde YM2149-Arpeggios.`,
        ST_SOUND
    ),
    "demoscene/synergy/main-menu.ym": museum(
        'SCAVENGER / SYNERGY — SYNERGY MEGADEMO / MAIN MENU (1993)',
        `Wer beim Blick auf den Namen <strong>Scavenger</strong> denkt, das sei nur irgendein holländischer Demo-Musiker von 1993, staunt nicht schlecht: Hinter Scavenger (der bei <strong>Synergy</strong> übrigens gleich auch Code, Logos und den hauseigenen ST-Tracker <em>ChipMon II</em> mitentwickelte!) steckt <strong>Joris de Man</strong> – heute weltberühmter, zweifacher Ivor-Novello-Preisträger und Komponist der PlayStation-Blockbuster <em>Killzone</em> und <strong>Horizon Zero Dawn</strong>! Sein geschmeidiges Main-Menu-Stück (<em>Pajaro</em> / <em>Synergy Megademo</em>, Ende 1993) zählt zum Ausgereiftesten, was jemals über einen Atari ST lief.`,
        `<strong>YM6! · 9.217 Frames (184,3 s) · Konversion: Leonard</strong>. Eingebettet als <code>Synergy MainMenu</code>. Ein Lehrstück der späten 93er ST-Schule: butterweiche Hüllkurven, komplexe Harmonien und messerscharfe Timer-Techniken.`,
        wiki('Joris_de_Man', 'Joris de Man'),
        ST_SOUND
    ),
    "demoscene/synergy/credits.ym": museum(
        'SCAVENGER / SYNERGY — SYNERGY MEGADEMO / CREDITS (1993)',
        `Der glanzvolle Abspann aus dem späten holländischen Meisterwerk <strong>Synergy Megademo</strong> (Dezember 1993). Noch einmal zeigt der junge <strong>Joris de Man (Scavenger)</strong>, wie viel Wärme, Groove und echte Musikalität man einem acht Jahre alten 3-Kanal-Rechteckchip entlocken kann, wenn man ihm wie im hauseigenen <em>ChipMon II</em> volle Kontrolle über jede Hüllkurve gibt.`,
        `<strong>YM6! · 5.377 Frames (107,5 s) · Konversion: Leonard</strong>. Eingebettet als <code>Synergy Credits Screen</code> – kompakt, druckvoll und ein wunderbares Abschiedslied der späten ST-Demoszene.`,
        wiki('Joris_de_Man', 'Joris de Man')
    ),
    "demoscene/remixes/shades-giana-remix.ym": museum(
        'JOCHEN HIPPEL / CHRIS HÜLSBECK — SHADES & GIANA SISTERS REMIX (1990)',
        `Ein echtes Geschenk an alle C64- und ST-Nostalgiker: In diesem über sechsminütigen Mammut-Remix verschmilzt <strong>Jochen Hippel</strong> gleich zwei der berühmtesten frühen C64-Kompositionen seines Freundes <strong>Chris Hülsbeck</strong> – die epische 1987er C64-Musicdisk-Hymne <em>Shades</em> (einst „Listing des Monats“ im <em>64’er</em>-Magazin) und <em>The Great Giana Sisters</em> – zu einem einzigen, mitreißenden Atari-ST-Medley.`,
        `<strong>YM6! · 18.200 Frames (364 s = 6:04 min!) · Konversion: Leonard</strong>. Eingebettet als <code>Shades &amp; Giana Sisters Remix</code>. Auf über sechs Minuten Spielzeit zeigt Hippel die komplette Kunst des ST-Chipsound-Handwerks ohne jede Sample-Hilfe.`,
        exotica('Jochen_Hippel', 'Jochen Hippel')
    )
};