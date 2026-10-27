# Der SID singt zweimal

## Von Bob Yannes’ Synthesizer-Chip zur Echtzeit-Emulation in Chiptunes Fantasy

*Eine technische Biographie des MOS 6581 — über die Ingenieure und Komponisten, die einem unvollkommenen Stück Silizium das Singen beibrachten, über sterbende Halbleiter und moderne Ersatzschaltungen, und über die jahrzehntelange Suche danach, seine Seele in Mathematik zu fassen.*

> **Chiptunes Fantasy v1.5.0 — „Von Nerds für Nerds“**  
> Dieses Buch erzählt zwei Geschichten, die untrennbar miteinander verwoben sind: die historische Entstehung des Commodore-Soundchips SID samt den Programmierer-Komponisten, die ihn zur Kunstform erhoben, und die ingenieurwissenschaftliche Rekonstruktion dieses Systems im modernen Webbrowser. Historische Berichte, persönliche Erinnerungen der Pioniere und eigene Messungen werden bewusst unterschieden. „Exact“ bezeichnet in diesem Projekt das Ziel und die klar benannten Modellgrenzen eines spezifischen Nachbaus — nicht die vermessene Behauptung vollkommener Übereinstimmung mit jedem jemals gefertigten Exemplar aus Silizium.

---

## Prolog: Eine Datei, die kein Klang ist

Wer eine klassische SID-Datei auf seiner Festplatte betrachtet, sieht zunächst ein Rätsel der Sparsamkeit. Oft ist sie kaum vier oder fünf Kilobyte groß — kleiner als das Vorschaubild eines modernen Musikalben-Covers, tausendmal kleiner als eine gewöhnliche MP3-Aufnahme. Öffnet man sie in einem Hexadezimal-Editor, blickt man nicht auf die sanft geschwungenen Wellenberge einer abgetasteten Schallwelle. Stattdessen erscheinen vier schlichte Buchstaben — `PSID` oder `RSID` —, gefolgt von einem Titel, dem Namen eines Komponisten, einem Erscheinungsjahr und einer dichten Kolonne scheinbar stummer Zahlen.

Doch genau in dieser Stummheit liegt der Zauber: **Eine SID-Datei enthält keine aufgezeichnete Musik. Sie enthält eine Partitur samt ihrem eigenen kleinen Orchester als ausführbares Computerprogramm.**

Geschrieben wurde dieses Programm vor rund vier Jahrzehnten in der Maschinensprache des 6510-Prozessors für den Commodore 64. Es kennt Speicheradressen wie `$D400`, an denen im echten Rechner die Register des *Sound Interface Device* (SID) lagen. Es berechnet Tonhöhen, öffnet und schließt elektronische Schalter, verschiebt Pulsbreiten im Takt von Fünfzigstelsekunden, verbiegt Filterkurven und nutzt mitunter physikalische Nebenwirkungen des Halbleiters aus, an die bei seiner Konstruktion niemand gedacht hatte.

Wenn *Chiptunes Fantasy* eine solche Datei im Browser lädt, wird deshalb keine Konserve geöffnet. Im Arbeitsspeicher entsteht für die Dauer des Stücks eine präzise getaktete Mikrowelt: Ein emulierter Prozessor liest Befehl für Befehl den historischen Maschinencode, Zeitgeber-Bausteine lösen fünfzigmal pro Sekunde — oder noch viel häufiger — Unterbrechungen aus, Schreibzugriffe treffen im exakt vorgesehenen Prozessortakt auf virtuelle Register, und ein digitales Modell des Soundchips formt daraus Schwingung für Schwingung neuen Klang.

Die großen Durchbrüche der Computergeschichte ereignen sich fast immer dort, wo technische Strenge und künstlerische Vorstellungskraft aufeinanderprallen. Im Handbuch der schwedischen *Elektron SidStation* — eines Ende der neunziger Jahre gebauten MIDI-Synthesizers, in dessen Innerem ein echter alter C64-Soundchip arbeitete — fand sich dafür ein poetischer Satz: *„Der SID ist der klassische Synthesizer, um den herum niemals ein Gehäuse gebaut wurde.“* [[14]](#quellen) [[15]](#quellen)

Dieses fehlende Gehäuse schufen erst die Musiker mit ihrem Programmcode — und später die Entwickler von Emulatoren mit ihrer Mathematik. Deshalb singt der SID in dieser Geschichte zweimal: das erste Mal auf den warm werdenden Platinen des Commodore 64, das zweite Mal als Echtzeit-Rekonstruktion im Browser.

---

# Erster Teil: Der Chip, der eigentlich ein Instrument werden wollte

## 1. Fünf Monate in Norristown — Bob Yannes, Charles Winterble und das Wunder von 1981

Im Frühsommer des Jahres 1981 herrschte in den Laboren von MOS Technology in Norristown, Pennsylvania, eine Atmosphäre zwischen Aufbruch und Belagerungszustand. Commodore-Gründer Jack Tramiel — ein Mann, der den Markt für Heimcomputer wie einen Kriegsschauplatz betrachtete und nach der Maxime *„Business is war“* handelte — hatte die Losung ausgegeben, dass bis zur Consumer Electronics Show (CES) im Januar 1982 ein neuer Rechner fertig sein musste. Nicht irgendein Nachfolger des erfolgreichen VIC-20, sondern eine Maschine mit 64 Kilobyte Speicher, deren Grafik und Klang alles in den Schatten stellen sollten, was Atari, Apple oder Texas Instruments zu bieten hatten.

Für den Klang dieses geplanten Rechners war ein vierundzwanzigjähriger Ingenieur namens **Robert „Bob“ Yannes** verantwortlich.

Yannes war kein gewöhnlicher Schaltkreis-Entwerfer. Er hatte an der Villanova University Elektrotechnik studiert, nebenbei Philosophiekurse belegt und verbrachte seine Freizeit damit, eigene analoge Synthesizer zu löten und elektronische Musik von Kraftwerk, Tangerine Dream oder Wendy Carlos zu analysieren. Als MOS Technology ihn einstellte, geschah das nicht zuletzt deshalb, weil er verstand, wie musikalische Klänge physikalisch entstehen. [[1]](#quellen)

Als Yannes sich die Soundchips ansah, die Anfang der achtziger Jahre in Heimcomputern und Spielautomaten steckten — etwa Ataris TIA, den Texas Instruments SN76489 oder den General Instrument AY-3-8910 —, empfand er als Musiker fast körperliches Unbehagen. „Ich hielt die vorhandenen Soundchips für primitiv“, erinnerte er sich später. „Sie waren offensichtlich von Leuten entworfen worden, die nichts von Musik verstanden.“ [[1]](#quellen) Jene Bausteine waren bessere Signalgeber: Sie konnten starre Rechteckwellen piepsen lassen und ein wenig Rauschen für Explosionen beimischen, doch es fehlte ihnen alles, was einem Ton Ausdruck, Wärme und zeitliche Form verleiht.

Yannes wollte keinen Computer-Piepser bauen. Er wollte einen echten, subtraktiven Synthesizer auf ein einziges Stück Silizium bannen — ein Instrument in der Tradition von Bob Moog und Dave Smith (*Sequential Circuits*), nur geschrumpft auf die Fläche eines Fingernagels. [[11]](#quellen) [[12]](#quellen)

Gemeinsam mit **Albert Charpentier**, der parallel den neuen Grafikchip VIC-II entwarf, und unter der Rückendeckung des MOS-Entwicklungsleiters **Charles Winterble** genoss Yannes eine Freiheit, die in großen Konzernen selten ist. Es gab keine endlosen Gremiensitzungen, keine Marketing-Abteilungen, die ihm vorschrieben, wie viele Register ein Chip haben durfte. Als Winterble sah, was Yannes auf dem Reißbrett entwarf, sagte er trocken: *„Dieses Ding ist jetzt schon zehnmal besser als alles andere da draußen — und zwanzigmal besser, als es eigentlich sein müsste.“* [[14]](#quellen) Es gab nur eine unerbittliche Bedingung: Das Design musste im Herbst 1981 stehen, damit die ersten Prototypen rechtzeitig zur Messe im Januar 1982 aus der Fertigung kamen.

In knapp fünf Monaten zeichnete Yannes die Architektur des **MOS 6581** (dokumentiert auch in seinem 1983 eingereichten und 1987 erteilten US-Patent 4,677,890). [[10]](#quellen) Statt simpler Frequenzteiler spendierte er dem Chip drei unabhängige Stimmen mit hochauflösenden 24-Bit-Phasenakkumulatoren. Jede Stimme erhielt vier wählbare Grundwellenformen — Dreieck, Sägezahn, eine in 4.096 Stufen regelbare Pulswelle und Rauschen —, dazu einen eigenen Hüllkurvengenerator mit Attack, Decay, Sustain und Release (ADSR). Man konnte die Oszillatoren über *Hard Sync* hart miteinander verkoppeln oder über *Ringmodulation* metallische Glockenspektren erzeugen. Und am Ende der Kette saß der eigentliche Geniestreich: ein echtes, analoges Multimode-Filter mit einstellbarer Resonanz, das über zwei externe Kondensatoren an den Gehäuse-Pins 1 bis 4 beschaltet wurde und dem digitalen Oszillatorsignal jene organische Wärme verlieh, die man sonst nur von großen Tasteninstrumenten kannte. [[2]](#quellen)

Eigentlich träumte Yannes davon, dass sein Chip weit über den Heimcomputer hinaus Karriere machen würde. Er hatte das Bauteil so ausgelegt, dass mehrere Exemplare kaskadiert werden konnten, um einen professionellen polyphonen Synthesizer mit acht oder sechzehn Stimmen anzutreiben. Tatsächlich zeigte Dave Smiths Firma Sequential Circuits — damals berühmt für den *Prophet-5* — Interesse an dem Baustein. Doch der ungeheure Verkaufserfolg des Commodore 64 (mit rund 17 Millionen verkauften Geräten das meistverkaufte Einzelmodell der PC-Geschichte) machte diese Pläne zunichte: Commodore benötigte jedes einzelne produzierte Exemplar für die eigene Rechnerfertigung. [[1]](#quellen) [[14]](#quellen)

So geschah etwas Ironisches: Der Chip kam nicht zu den Synthesizer-Spielern in die großen Studios — stattdessen verwandelte er Millionen von Kinder- und Jugendzimmern in Studios. Als Yannes Commodore 1984 verließ, um gemeinsam mit Charpentier und Winterble den Synthesizer-Hersteller **Ensoniq** zu gründen (dessen *Mirage*-Sampler die Musikwelt revolutionieren sollte), hatte sein Erstlingswerk bereits begonnen, eine eigene Musikkultur zu prägen.

## 2. Die Schönheit eines unvollkommenen Bauteils — NMOS, Silizium-Launen und der Übergang zum 8580/6582

Der kanadische DSP-Entwickler David Viens, der für seine Instrumentensammlung *chipsounds* dutzende historische Soundchips untersuchte, brachte das Wesen des SID auf eine knappe Formel: *„Dieser Chip bedarf keiner Vorstellung. Er ist mit Abstand der berühmteste Musikchip der Welt. Und er ist zugleich mit Abstand der komplexeste analog-hybride Chip von allen — und dementsprechend der am schwersten zu emulierende.“* [[15]](#quellen)

Wer verstehen will, warum gerade der frühe SID — der **MOS 6581** — bis heute wie ein lebendiges Wesen verehrt wird, muss sich von der Vorstellung verabschieden, ein Computerchip sei ein fehlerfreies Uhrwerk.

Der 6581 war ein **Hybrid-Chip**. Während seine Zähler, Register und Hüllkurven digital arbeiteten (`+5V` Versorgungsspannung), bestanden seine Digital-Analog-Wandler (DACs), sein Multimode-Filter und seine Ausgangsverstärker aus analogen Schaltungen, die eine zusätzliche **`+12V`-Spannung (`VDD` an Pin 28)** benötigten. Und beide Welten mussten im selben, damals bei MOS üblichen **NMOS-Halbleiterprozess** (mit Strukturbreiten von 6 bis 7 Mikrometern) gefertigt werden — einem Verfahren, das für digitale Logikgatter gedacht war, sich für präzise analoge Verstärker jedoch als ausgesprochen widerspenstig erwies. [[1]](#quellen) [[10]](#quellen)

Yannes musste improvisieren. Die Operationsverstärker im Inneren des Chips besaßen nur eine begrenzte Verstärkung; die Feldeffekttransistoren (FETs), die im Filter als spannungsgesteuerte Widerstände dienten, streuten von Produktionslauf zu Produktionslauf erheblich. Selbst das offizielle Datenblatt des 6581 enthielt einen fast entschuldigenden Hinweis darauf, dass die Filterkennlinie erheblichen Fertigungsschwankungen unterliege. [[2]](#quellen)

Aus genau diesen physikalischen Unzulänglichkeiten entstand jedoch der unverwechselbare Charakter des 6581:

* **Nichtlineare Widerstandsleitern (R-2R-DACs):** Auf dem Silizium des 6581 stimmten die geometrischen Verhältnisse der Transistoren in den 8-Bit-Wandlern nicht exakt mit dem idealen Zweierpotenz-Verhältnis überein, und die Leitungen waren am unteren Ende nicht perfekt abgeschlossen. Das führte zu kleinen Spannungssprüngen („Kinks“) in der Kennlinie — eine subtile harmonische Rauheit, die jedem Sägezahn und jeder Dreieckswelle eine warme, leicht körnige Textur gab. [[11]](#quellen)
* **Analoge Sättigung und Filter-Drift:** Wenn man mehrere Stimmen mit hoher Resonanz in das 6581-Filter schickte, gerieten die internen Transistorstufen in eine sanfte, asymmetrische Übersteuerung. Zudem war das Filter thermisch empfindlich: Ein frisch eingeschalteter, „kalter“ Brotkasten klang in den ersten Minuten oft heller und schärfer als derselbe Rechner nach einer Stunde Spielbetrieb, wenn sich das Silizium auf über 55 Grad Celsius erwärmt hatte.
* **Leckströme und Gleichspannungsversatz (DC-Offset):** Zwischen den Stufen des 6581 sickerten winzige Gleichspannungen hindurch. Wenn man das Master-Lautstärkeregister `$D418` veränderte, verschob sich nicht nur die Lautstärke der Oszillatoren, sondern auch dieser Gleichspannungs-Ruhepegel mit einem hörbaren Knacken. Was auf dem Papier ein Schaltungsfehler war, sollte wenige Jahre später zur Geburtsstunde der digitalen Sprach- und Schlagzeugwiedergabe auf dem C64 werden.

Sogar das Zeitgefühl der Hüllkurven trug Yannes’ persönliche Handschrift. Er berechnete die sechzehn Attack-, Decay- und Release-Raten nicht nach einer sterilen mathematischen Reihe, sondern setzte sich an einen *Sequential Circuits Pro-One*-Synthesizer, drehte an den Reglern und wählte die Teilerwerte für den Chip nach seinem eigenen musikalischen Gehör aus. [[1]](#quellen)

Im Laufe der Produktionsjahre durchlief der Chip mehrere Revisionen, die unter Sammlern und Musikern wie Jahrgänge eines Weins gehandelt werden [[10]](#quellen) [[15]](#quellen):

1. **MOS 6581 (R1, R2, R3 und R4AR):** Die klassische NMOS-Familie im „Brotkasten“ (mit externen `470 pF` Filterkondensatoren). Während frühe R2- und R3-Exemplare für ihren rauen, mittigen Charakter und laute `$D418`-Samples berühmt sind, bot die späte Revision **R4AR** (*Advanced Resonance*) eine ausgeprägtere Filterresonanz und tiefere Grenzfrequenzen.
2. **MOS/CSG 8580 (R5) und MOS 6582:** Als Commodore ab 1987 den flacheren C64C (Platine ASSY 250469) einführte, wurde der Chip im moderneren **HMOS-II-Prozess** neu aufgelegt (mit `+9V` statt `+12V` an Pin 28 und `22 nF` Filterkondensatoren; der elektrisch baugleiche **MOS 6582** kam unter anderem in Spezialanwendungen und späteren Synthesizern zum Einsatz). [[10]](#quellen)

Beim Übergang vom 6581 zum 8580 veränderte sich das Klangbild dramatisch [[15]](#quellen): Die D/A-Wandler des 8580 waren nahezu linear, das Filter rauschte weniger und gehorchte einer weiten, gleichmäßigen Kennlinie, und das `$D418`-Lautstärkeknacken war fast verschwunden — wodurch alte Sample-Spiele auf dem neuen C64C plötzlich flüsterleise wurden, bis Programmierer lernten, die Samples über andere Registertricks anzuheben. Gleichzeitig wurden auf dem 8580 die **kombinierten Wellenformen** (wie Dreieck+Puls `$50` oder Sägezahn+Puls `$60`), die auf dem alten 6581 wegen der schwachen Pull-down-Transistoren oft am Rande des Abreißens schwebten, kräftig, stabil und vorhersagbar. [[15]](#quellen)

## 3. Das Trauma von `POKE 54272` und das 15-Rasterzeilen-Budget — Warum der SID den Maschinencode brauchte

Als die ersten Käufer 1982 ihren Commodore 64 auspackten und das Handbuch aufschlugen, erlebten viele eine herbe Enttäuschung. Zwar prahlte die Verpackung mit einem dreistimmigen Musiksynthesizer, doch das eingebaute **Commodore BASIC V2** kannte keinen einzigen Musikbefehl. Es gab kein `SOUND`, kein `PLAY`, kein `ENVELOPE`.

Wer in BASIC einen einzigen Ton erzeugen wollte, musste dutzende Speicherstellen ab Adresse `54272` (hexadezimal `$D400`) einzeln per `POKE`-Befehl beschreiben — ein mühsamer Vorgang, den schon das Computermagazin *COMPUTE!* im Oktober 1983 in seinem Grundlagenartikel *„Working with SID“* als größte Hürde für Einsteiger beschrieb. [[16]](#quellen) Schlimmer noch: Weil der BASIC-Interpreter Zeilen im Schneckentempo abarbeitete, klangen selbst abgetippte BASIC-Melodien wie eine träge Heimorgel. Für ein schnelles Arpeggio oder ein lebendiges Vibrato war BASIC um Größenordnungen zu langsam.

Die wahre Geburtsstunde der C64-Musik schlug erst, als Programmierer das Betriebssystem beiseiteschoben und ihre eigenen **Musiktreiber in 6502-Maschinensprache** direkt an den **50-Hertz-Bildwechsel-Interrupt** (beim europäischen PAL-Fernsehbild alle 20 Millisekunden, beim amerikanischen NTSC-Bild alle 16,7 Millisekunden) hängten. [[14]](#quellen) [[16]](#quellen)

James Newman hat in seiner medienwissenschaftlichen Studie *„Driving the SID chip“* gezeigt, dass erst dieser maßgeschneiderte Treibercode den nackten Chip zu einem spielbaren Instrument machte: Jeder Komponist baute mit seiner Software ein eigenes „Gehäuse“ um das Silizium. [[14]](#quellen)

Dabei arbeiteten die Musiker unter einem eisernen Zeitdiktat. In einem Computerspiel musste derselbe 1-MHz-Prozessor, der die Musik berechnete, gleichzeitig Dutzende Sprites bewegen, Kollisionen prüfen und den Bildschirm scrollen. Um zu messen, wie viel Rechenzeit ihr Musiktreiber verbrauchte, nutzten die Programmierer einen sichtbaren Trick: Zu Beginn der Musikroutine schalteten sie per `INC $D020` die Rahmenfarbe des Fernsehbildschirms um, und am Ende der Routine setzten sie sie per `DEC $D020` wieder zurück. An der Dicke des farbigen Streifens im Bildschirmrahmen ließ sich die Prozessorlast direkt in **Rasterzeilen** ablesen. Ein guter Spieletreiber durfte oft nicht mehr als **10 bis 15 Rasterzeilen** (rund 600 bis 900 Taktzyklen — weniger als 5 Prozent eines Bilddurchlaufs!) verbrauchen und nicht mehr als zwei bis vier Kilobyte Speicher belegen. [[14]](#quellen)

Aus diesem extremen Spardruck entstanden die raffiniertesten Algorithmen der 8-Bit-Geschichte.

---

# Zweiter Teil: Die Virtuosen des Maschinencodes

## 4. Was drei Stimmen aus Komponisten machen — Wavetables, der ADSR-Bug und der „Hard Restart“

Wie gelingt es, auf nur drei Stimmen gleichzeitig Schlagzeug, Bass, Akkorde und eine Solomelodie erklingen zu lassen? Wer moderne C64-Editoren wie *SID Factory II*, *GoatTracker* oder die klassischen Treiber von Jens-Christian Huus (*JCH / Chordian*) und Thomas E. Petersen (*Laxity*) untersucht, stößt auf zwei fundamentale Werkzeuge der SID-Kunst: **Tabellen-Multiplexing** und den **Hard Restart**. [[17]](#quellen)

### Die 20-Millisekunden-Illusion (Wave-, Pulse- und Filter-Tabellen)

In der C64-Musik ist ein „Instrument“ keine gespeicherte Tonaufnahme, sondern eine kleine Liste von Befehlen, die im 50-Hertz-Raster (alle 20 Millisekunden) Schritt für Schritt abgearbeitet wird [[17]](#quellen):

```text
Frame 0 (0–20 ms):   Wellenform $81 (Rauschen + Gate), feste Tonhöhe $D8
                     ──► Erzeugt den kurzen, scharfen Anschlagsklick einer Snare oder Kick!
Frame 1 (20–40 ms):  Wellenform $41 (Puls + Gate), Tonhöhe der gespielten Note
                     ──► Sofortiger Wechsel auf den eigentlichen, melodischen Basston!
Frame 2..n:          Pulsbreiten-Tabelle verschiebt PW in jedem Frame um +$040
                     ──► Der Basston beginnt breit und lebendig zu schweben!
```

Weil der Wechsel zwischen Geräusch-Attack und harmonischem Ton schneller erfolgt als das zeitliche Auflösungsvermögen unseres Gehörs, nimmt das Gehirn nicht einen umgeschalteten Oszillator wahr, sondern **zwei gleichzeitige Instrumente**: ein Schlagzeug und einen E-Bass auf derselben Spur! [[14]](#quellen) [[17]](#quellen)

### Die Zähmung des widerspenstigen Zählers: Der „ADSR-Bug“ und der „Hard Restart“

Doch wer versuchte, auf dem SID schnelle Sechzehntelnoten abzufeuern, stieß bald auf eine tückische Eigenheit der Hardware, die unter Musikern als **ADSR Delay Bug** berüchtigt wurde. [[17]](#quellen)

Wie in Kapitel 10 näher beschrieben wird, steuert der SID die Geschwindigkeit seiner Hüllkurven über einen internen 15-Bit-Zähler, der fortlaufend hochzählt und bei Erreichen eines Zielwerts zurückgesetzt wird. Spielt eine Stimme bereits eine Note und wird für die nächste Note neu angeschlagen, während die alte Hüllkurve noch nicht ganz auf null abgeklungen ist oder gerade die Ratenregister gewechselt werden, kann der interne Zähler über seinen neuen, kleineren Zielwert hinausschießen. Er muss dann erst alle **32.768 Takte** bis zum Überlauf durchzählen — was eine unvorhersehbare Verzögerung von bis zu **33 Millisekunden** verursacht! Die neue Note kommt zu spät, klingt verschluckt oder verliert ihren knackigen Anschlag.

Um diesen Hardware-Fehler zu überlisten, entwickelten Programmierer wie JCH und Laxity die Technik des **Hard Restart (`HR`)** [[17]](#quellen):
Exakt ein bis zwei Frames (20 bis 40 Millisekunden) *bevor* eine neue Note angeschlagen wird, schaltet der Musiktreiber das Gate-Bit der laufenden Note auf `0` und zwingt die ADSR-Register kurzzeitig auf Werte wie `$0000` oder `$0F00`. Dadurch wird die Hüllkurve rechtzeitig vor dem neuen Notenstart kontrolliert auf exakt null entladen. Wenn zwei Frames später die neue Note mit Gate `1` beginnt, startet ihr Anschlag jedes einzelne Mal mit mikrosekundengenauer Präzision. Erst dieser Kniff gab den späten C64-Stücken ab 1987 ihren unerbittlichen, maschinenhaft präzisen Groove.

## 5. Rob Hubbard — Der Jazz-Musiker, der in Hexadezimal dachte

Als **Rob Hubbard** Anfang der achtziger Jahre zum ersten Mal einem Commodore 64 begegnete, war er kein Teenager mehr, sondern Ende zwanzig — ein ausgebildeter Berufsmusiker aus dem nordenglischen Hull und später Newcastle, der in Tanzkapellen, Jazz-Combos und Tonstudios gespielt hatte. Er kannte Harmonielehre, Kontrapunkt und Studiotechnik, doch als Studiomusiker war das Geld knapp. Also brachte er sich selbst bei, den 6502-Prozessor in Maschinensprache zu programmieren. [[6]](#quellen) [[7]](#quellen)

Diese Kombination aus reifer musikalischer Ausbildung und kompromissloser Assembler-Programmierung machte Hubbard zur prägenden Gestalt der goldenen C64-Ära. Wo frühere Spielmusiken oft wie abgehackte Kinderlieder klangen, schrieb Hubbard seinen eigenen, hochkompakten Musiktreiber, der ihm erlaubte, Phrasierung, Portamento (stufenloses Gleiten zwischen Tönen), Vibrato und komplexe Trommel-Hüllkurven direkt im Maschinencode auszudrücken. [[14]](#quellen)

Seine Werke zwischen 1985 und 1987 lesen sich wie ein Kanon der elektronischen Computermusik:

* ***Monty on the Run* (1985):** Inspiriert von *The Devil’s Galop*, schuf Hubbard hier ein treibendes Meisterwerk, dessen Herzstück ein virtuoses, rasend schnelles „E-Geigen“-Solo ist. Hubbard programmierte dafür eigenen Pitch-Bend-Code, der das Anreißen und Gleiten auf einem Griffbrett mit einer Ausdruckskraft nachbildete, die niemand zuvor aus einem 8-Bit-Rechner gehört hatte. [[7]](#quellen)
* ***Commando* (1985):** Nach einer vielfach überlieferten Erinnerung entstand dieses Stück in einer einzigen nächtlichen Sitzung in den Büros des Publishers Elite Systems. [[6]](#quellen) *Commando* nutzt *Hard Sync* (die harte Phasensynchronisation zweier Oszillatoren) für einen schneidenden, fast wie eine übersteuerte E-Gitarre schreienden Lead-Sound, während der Bass in unaufhaltsamen Achtelnoten nach vorne peitscht.
* ***Crazy Comets* (1985) & *Lightforce* (1986):** In *Crazy Comets* legte Hubbard über eine synkopierte Funk-Basslinie perkussive Geräusche und eine fast sprachähnliche Roboter-Modulation; in *Lightforce* entwarf er eine getragene, fast neunminütige Weltraum-Hymne voller dramatischer Spannungsbögen.
* ***Sanxion* (1986) & *Delta* (1987):** Für die Lademusik von *Sanxion* (*Thalamusik*) ließ sich Hubbard von Jean-Michel Jarres Album *Zoolook* inspirieren, während er in *Delta* minimalistische Sequenzen im Stil von Philip Glass und Pink Floyds *On the Run* mit dem analogen Filter des SID verschmolz.

Hubbard bewies, dass drei Stimmen auf einem Mikrochip ausreichten, um die Energie einer kompletten Rockband oder die Weite eines elektronischen Konzeptalbums zu entfesseln.

## 6. Martin Galway — Der Klangmaler und der Puls im Lautstärkeregister

Wenn Rob Hubbard der virtuose Jazz- und Prog-Rock-Solist des C64 war, dann war **Martin Galway** sein großer Klangmaler und Studio-Alchemist. Aufgewachsen in Nordirland und später im Umfeld von Ocean Software in Manchester tätig, betrachtete Galway den SID weniger als Notenabspielgerät denn als akustisches Labor. [[4]](#quellen) [[5]](#quellen)

Galway hörte sich Hubbards Treiber genau an — beide verband eine Mischung aus kollegialer Freundschaft und sportlicher Rivalität — und suchte nach Wegen, den Chip noch breiter, noch sphärischer und zugleich noch perkussiver klingen zu lassen. Er liebte langsame, gegeneinander verschobene Pulsbreiten-Modulationen (PWM), die einer einzelnen Stimme den breiten Schwebeklang eines mehrstimmigen Chorus-Effekts gaben, und er meisterte das analoge Filter des 6581 wie kaum ein Zweiter:

* ***Comic Bakery* (1985) & *Rambo: First Blood Part II* (1985):** Schon hier zeigte sich Galways Gespür für eingängige, hymnenhafte Melodien, die von rastlosen Arpeggio-Teppichen und warmen, pulsierenden Bassfiguren getragen wurden.
* ***Wizball* (1987):** Ein Meilenstein atmosphärischer Klangkunst. Im Titelstück ließ Galway das analoge Filter des 6581 mit hoher Resonanz über Minuten hinweg wie einen langsamen Atemzug über die Obertöne streichen. Zudem nutzte er eine Eigenheit des Chips aus: Wenn man im Steuerregister alle Wellenform-Bits auf null setzte (`$00`), fiel die Spannung am D/A-Wandler wegen der winzigen Kapazität der Datenleitungen nicht sofort ab, sondern hielt ihren Pegel bzw. „blutete“ weich aus — was seinen Melodien ein seltsam organisches Nachschwingen verlieh. Im Highscore-Thema (*Subsong 7*) wiederum trieb er schnelle 50-Hz-Arpeggios so dicht aneinander, dass jeder Emulator, dessen ADSR-Ratenzähler beim Gate-Wechsel falsch reagiert, ins Stolpern gerät.
* ***Arkanoid* (1987) und die Geburt des `$D418`-Digidrums in der Spielmusik:** In den Credits von *Arkanoid* schrieb Galway den berühmten Satz: *„Wait a minute… There’s a drumkit inside my C64!“* Später stellte Galway in Interviews bescheiden klar, dass er die Sample-Wiedergabe über das Lautstärkeregister `$D418` nicht im Alleingang erfunden hatte — er hatte bestehende Sprach- und Sample-Routinen (unter anderem aus dem Umfeld früher *Digidrum*-Experimente) studiert und in seinen Musiktreiber integriert. [[4]](#quellen) Doch in *Arkanoid* ging er noch einen Schritt weiter: Statt bloß fertige Sample-Tabellen aus dem Speicher abzuspielen, ließ er den 6510-Prozessor die Trommelklänge zur Laufzeit über kleine mathematische Schleifen (`ADC #$65 / AND #$0F / STA $D418`) berechnen, während im Hintergrund die dreistimmige Musik weiterlief. Über das klangliche Resultat spottete er später selbstironisch als „farts and burps“ [[4]](#quellen) — technisch gesehen war es jedoch ein Bravourstück nebenläufiger Programmierung.

## 7. Chris Hülsbeck — Der siebzehnjährige Rebell, „Shades“, der *Soundmonitor* und *Turrican*

Während in England Hubbard und Galway den Ton angaben, reifte in Deutschland ein siebzehnjähriger Schüler heran, der nicht nur unsterbliche Melodien schreiben, sondern nebenbei das Werkzeug erfinden sollte, das die gesamte europäische Demoszene veränderte: **Chris Hülsbeck**.

Im Frühjahr 1986 rief das deutsche Computermagazin *64’er* zu einem großen Musikwettbewerb auf. Hülsbeck, der in Gießen lebte und sich das Programmieren des 6510-Prozessors im Selbststudium beigebracht hatte, reichte ein Stück namens ***Shades*** ein. Als die Jury das Stück hörte, traute sie ihren Ohren kaum: *Shades* klang nicht nach drei getrennten Computerstimmen. Es besaß einen butterweichen, fast melancholisch singenden Lead-Synthesizer, einen federnden Bass, knackige Schlagzeug-Illusionen und einen strukturellen Aufbau wie ein großer Synthpop-Hit. *Shades* gewann den ersten Preis mit überwältigendem Vorsprung. [[6]](#quellen)

Doch noch folgenreicher war das Programm, mit dem Hülsbeck *Shades* geschrieben hatte. Im Oktober 1986 veröffentlichte die *64’er* Hülsbecks Editor als mehrseitiges Abtipp-Listing unter dem Namen **„Soundmonitor“**. [[6]](#quellen) Zum ersten Mal wurden Noten, Instrumenten-Nummern und Steuerbefehle auf dem Bildschirm in vertikal ablaufenden Textspuren (Patterns) dargestellt. Es war die Urform des **Trackers** — jenes Prinzips, das Karsten Obarski ein Jahr später auf dem Amiga zum *Ultimate Soundtracker* inspirierte und auf dem die gesamte spätere `.mod`- und `.xm`-Kultur aufbaute.

Auf dem C64 und kurz darauf auf dem Amiga (bei Rainbow Arts und Factor 5) schuf Hülsbeck Werke, die bis heute als Prüfsteine für jede Emulation gelten:

* ***The Great Giana Sisters* (1987):** Das Titelstück begrüßt den Hörer mit glockigen Ringmodulations-Klängen und einem erdigen 4-Bit-Digidrum-Beat, während ein schmatzender, resonanter Filter-Bass das Fundament legt. Im zweiten Stück — der unvergesslichen In-Game- und Highscore-Melodie — nutzt Hülsbeck für die Hauptstimme ab Takt 3 eine „illegale“ Wellenformkombination: **`$50` (Dreieck und Puls gleichzeitig)**. Auf dem 6581-Silizium führt diese gleichzeitige Anwahl zu einem Zusammenspiel der offenen Transistor-Ausgänge (*Wired-AND*), woraus jene gläsern-perlende, leicht gehauchte „Engelsstimme“ entsteht, die zum Markenzeichen von *Giana Sisters* wurde.
* ***To Be On Top* (1987) & *Katakis* (1988):** In *To Be On Top* machte Hülsbeck das Komponieren von Computermusik selbst zum Spielinhalt und feuerte ein Feuerwerk aus Sample-Drums, Filterfahrten und treibenden CIA-Timer-Routinen ab; in *Katakis* lieferte er eine brachiale elektronische Kampfmusik ab.
* ***Turrican* (1990) & *Turrican II: The Final Fight* (1991):** Mit der *Turrican*-Reihe schlug Hülsbeck die Brücke zwischen der 8-Bit-Welt des C64 (wo Ramiro Vaca die SID-Adaptionen betreute) und seiner neuen 7-Stimmen-TFMX-Architektur auf dem Amiga, deren hymnisches *Turrican-II*-Titelthema später sogar von großen Symphonieorchestern aufgeführt wurde. [[18]](#quellen)

## 8. Die zweite Welle der Hexenmeister — Ben Daglish, Jeroen Tel, Tim Follin und Matt Gray

In der zweiten Hälfte der achtziger Jahre verwandelte sich die C64-Musik in ein hochspezialisiertes Feld, in dem eine neue Generation von Komponisten und Gruppen die Grenzen des Chips immer weiter hinausschob:

* **Ben Daglish (*The Last Ninja*, 1987):** Ein klassisch geschulter Multiinstrumentalist aus Sheffield, der gemeinsam mit Anthony Lees den Soundtrack zu *The Last Ninja* schrieb. Daglish verstand es, asiatisch anmutende Pentatonik mit extrem zupackenden, trockenen Schlagzeug-Hüllkurven zu verbinden, die genau auf den Eigenheiten des 15-Bit-ADSR-Zählers des SID aufbauten.
* **Matt Gray (*Last Ninja 2*, 1988):** Erst siebzehn Jahre alt, trat Gray bei *Last Ninja 2* in riesige Fußstapfen — und schuf mit Stücken wie *Central Park* und *The Office* einige der meistgehörten Elektro-Funk-Hymnen der 8-Bit-Geschichte, getragen von messerscharfen Pulsbreiten-Sweeps und flötenartigen Dreiecks-Leads.
* **Jeroen Tel & Maniacs of Noise (*Cybernoid II*, *Supremacy*, *Myth*, *Turbo Outrun*, 1988–1989):** Der Niederländer Jeroen Tel und seine Gruppe *Maniacs of Noise* definierten den „schweren“, hochmodernen C64-Sound der späten achtziger Jahre. Tel nutzte kombinierte Wellenformen (`$60` Sägezahn+Puls, `$70` Dreieck+Sägezahn+Puls) für wuchtige Bässe und metallisch knallende Snares. In *Turbo Outrun* (1989) setzte er zudem eine Zero-Page-NMI-Routine ein, die mit minimaler Prozessorlast kristallklare 4-Bit-Drums und Sprachsamples mitten ins laufende Rennen feuerte.
* **Tim Follin (*Bionic Commando*, *Ghouls ’n Ghosts*, 1988–1989):** Der vielleicht radikalste Klang-Exzentriker der 8-Bit-Ära. Follin schrieb progressive, rhythmisch vertrackte Rock- und Fusion-Kompositionen direkt im Assembler-Code und trieb Phasenverschiebungen, schnelle Filter-Umschaltungen und kombinierte Wellenformen in eine Komplexität, bei der man kaum glauben konnte, dass im Inneren des Rechners immer noch derselbe kleine Chip aus dem Jahr 1981 arbeitete.

---

# Dritter Teil: Wie der SID einen Klang baut

## 9. Ein Oszillator, der durch die Zeit zählt

Um zu begreifen, wie dieser Reichtum an Klängen technisch entsteht, lohnt ein Blick unter das Mikroskop — in die digitale Logik einer einzelnen SID-Stimme.

Der Ausgangspunkt jeder Stimme ist kein analoger Schwingkreis, sondern ein **24-Bit-Phasenakkumulator**. Man kann ihn sich wie den Kilometerzähler eines Autos vorstellen, der von `0` bis `16.777.215` ($2^{24} - 1$) zählt und danach wieder bei `0` beginnt. Mit jedem einzelnen Takt des Systemprozessors — beim europäischen PAL-C64 genau **985.248-mal pro Sekunde** — wird auf diesen Zähler die Zahl addiert, die der Programmierer in die beiden Frequenzregister der Stimme geschrieben hat.

Das Datenblatt fasst diesen Vorgang in einer eleganten Gleichung zusammen [[2]](#quellen):

```text
Fout = Fn × Fclk / 16777216
```

Wenn `Fn` klein ist, wächst der Zähler langsam und braucht viele Tausend Takte für eine volle Runde — es entsteht ein tiefer Basston. Ist `Fn` groß, rast der Zähler mehrere tausend Mal pro Sekunde durch seinen Wertebereich — es entsteht ein hoher Diskantton. Weil der Zähler 24 Bit breit ist, lassen sich Tonhöhen in Schritten von weniger als einem sechzehntel Hertz abstufen.

Aus den obersten zwölf Bits dieses Zählers formt der SID nun in jedem Takt seine vier Grundwellenformen:

* **Sägezahn (Sawtooth):** Die einfachste und zugleich obertonreichste Form. Der Chip nimmt einfach die obersten zwölf Bits des Zählers direkt als Zahlenwert. Während der Zähler ansteigt, wächst die Welle wie eine schiefe Rampe nach oben und fällt beim Überlauf schlagartig auf null zurück.
* **Dreieck (Triangle):** Sobald das höchste Bit (Bit 23, das *Most Significant Bit*) eins wird — also genau auf halbem Weg durch die Schwingung —, klappt eine logische Exklusiv-Oder-Schaltung (XOR) die darunterliegenden elf Bits um. Aus der steilen Rampe wird ein symmetrischer Berg, der aufwärts und wieder abwärts läuft und viel weicher, fast flötenartig klingt.
* **Puls (Rechteck mit variabler Breite):** Ein digitaler Komparator vergleicht die oberen zwölf Bits des Phasenakkumulators mit dem 12-Bit-Wert im Pulsbreitenregister (`PW`). Solange die Phase auf der einen Seite der Schwelle liegt, stehen alle zwölf Ausgangsbits auf `1` (`$FFF`), auf der anderen Seite auf `0` (`$000`). Bei einem Wert von `2048` (`$800`) entsteht eine symmetrische Rechteckwelle (50 % Tastverhältnis), die hohl und klarinettenartig klingt; verschiebt man den Wert in Richtung der Ränder, wird der Ton immer dünner, näselnder und schneidender.
* **Rauschen (Noise):** Ein eigenes **23-Bit-Schieberegister mit linearer Rückkopplung (LFSR)** erzeugt eine deterministische Folge von Pseudozufallsbits, sobald Bit 19 des Phasenakkumulators umschaltet. Dadurch lässt sich selbst das Rauschen in seiner „Tonhöhe“ — vom tiefen Donnerrollen bis zum feinen Zischen einer Hi-Hat — präzise stimmen.

In der Exact-Implementierung von *Chiptunes Fantasy* bleiben diese Wellenformpfade mit ihrer vollen **12-Bit-Auflösung** bis zur D/A-Wandlung erhalten, während die 8-Bit-Spiegelung des Ausleseregisters `OSC3` (`$D41B`) sauber davon getrennt bleibt.

## 10. Die Hüllkurve: Wie aus einem Ton eine Note wird

Ein nackter Oszillator kennt weder Anfang noch Ende; er tönt unaufhörlich weiter, solange er eine Frequenz hat. Erst der **Hüllkurvengenerator (Envelope Generator)** formt aus diesem endlosen Signal eine musikalische Note mit Anschlag, Körper und Ausklang.

Jede der drei SID-Stimmen besitzt dafür einen eigenen 8-Bit-Zähler (`envelope_counter`), der Werte zwischen `0` (stumm) und `255` (volle Lautstärke) annehmen kann und über das **Gate-Bit** (Bit 0 im Steuerregister der Stimme) gesteuert wird:

1. **Attack (Anschlag):** Sobald das Programm das Gate-Bit von `0` auf `1` setzt, zählt der Hüllkurvenzähler Schritt für Schritt linear von seinem aktuellen Wert bis auf `255` hinauf.
2. **Decay (Abschwellen):** Hat der Zähler die Spitze `255` erreicht, schaltet die interne Zustandsmaschine automatisch in die Decay-Phase um und senkt den Wert wieder ab, bis der programmierte **Sustain-Pegel** (Haltepegel) erreicht ist.
3. **Sustain (Halten):** Solange das Gate-Bit auf `1` bleibt, verharrt die Lautstärke auf diesem Niveau.
4. **Release (Ausklingen):** Setzt das Programm das Gate-Bit wieder auf `0`, fällt der Zähler von seinem momentanen Stand bis auf `0` zurück.

Die eigentliche Raffinesse steckt in der Art, **wie** dieser Zähler gebremst wird. Das menschliche Gehör empfindet Lautstärke logarithmisch. Um ohne teure Multiplizierer eine natürlich klingende, exponentiell abfallende Kurve auf dem Chip zu erzeugen, baute Bob Yannes einen zweistufigen Mechanismus ein [[10]](#quellen):

* Ein **15-Bit-Ratenzähler** taktet mit den 985.248 Hz des Systemtakts und bestimmt das Grundtempo der gewählten Attack-, Decay- oder Release-Stufe.
* In der Decay- und Release-Phase schaltet sich zusätzlich ein **exponentieller Teiler** dazwischen, der bei bestimmten Schwellenwerten des 8-Bit-Hüllkurvenzählers (`255`, `93`, `54`, `26`, `14` und `6`) das Tempo stufenweise verlangsamt — erst wird bei jedem Ratentakt gezählt, dann nur noch bei jedem zweiten, vierten, achten, sechzehnten und schließlich dreißigsten!

Der Exact-Pfad bildet genau diese zustandsbehaftete Logik mit 15-Bit-Wraparound, Zwei-Takt-Gate-Pipeline und den exakten Schwellenwerten nach.

## 11. Synchronisation, Ringmodulation und das analoge Filter

Über die einzelnen Stimmen hinaus bietet der SID zwei kreuzweise Verschaltungen, bei denen die drei Oszillatoren im Ring miteinander sprechen (Stimme 1 blickt auf Stimme 3, Stimme 2 auf Stimme 1, Stimme 3 auf Stimme 2):

* **Hard Sync:** Immer wenn der steuernde Nachbar-Oszillator seinen Phasenzyklus vollendet, zwingt er den synchronisierten Oszillator augenblicklich auf Phase `0` zurück. Verändert man nun die Frequenz des synchronisierten Oszillators, verschieben sich die Obertonspitzen innerhalb der Grundperiode des Nachbarn — es entsteht jener schneidende, kehlige *Sync-Sweep*, den Rob Hubbard in *Commando* unsterblich machte.
* **Ringmodulation:** Bei ausgewählter Dreieckswelle ersetzt das höchste Bit des Nachbar-Oszillators das eigene Richtungsbit der Dreiecksfaltung. Mathematisch entsteht dadurch eine Frequenzmultiplikation: Statt der ursprünglichen Töne hört man Summen- und Differenzfrequenzen — das Rezept für metallische Glocken, Gongs und E-Piano-artige Klänge.

Hinter den drei Stimmen-Mischern wartet schließlich das **analoge Multimode-Filter**. Über eine Schaltmatrix (`$D417`) lässt sich für jede Stimme einzeln festlegen, ob sie durch dieses Filter läuft oder ungefiltert daran vorbeigeführt wird. Im Projekt wird dieses Filter als **Zwei-Integrator-Schleife mit Zero-Delay Feedback (ZDF)** modelliert, die gleichzeitig den Tiefpass- (LP), Bandpass- (BP) und Hochpass-Ausgang (HP) sowie deren additive Kombinationen (etwa `LP + HP` als Kerbfilter/*Notch*) bestimmt.

## 12. Vom `$D418`-Trick bis zum 8-Bit-PWM-Wunder — Die vier Generationen der SID-Samples

Obwohl Bob Yannes beim Entwurf des SID keinerlei digitalen Sample-Kanal vorgesehen hatte, verwandelten Programmierer den Chip im Laufe der Jahre durch immer kühnere Schaltungstricks in einen echten PCM-Sample-Spieler. In der technischen Referenzsammlung `sid-digi` lassen sich vier historische Entwicklungsstufen unterscheiden [[19]](#quellen):

1. **Generation 1 — Der klassische 4-Bit-`$D418`-Lautstärke-Trick:** Durch schnelles Umschalten der unteren vier Bits des Hauptlautstärkeregisters `$D418` (Werte `0` bis `15`) wird der interne Gleichspannungsversatz des 6581 im Rhythmus einer 4-Bit-Wellenform moduliert (beim neueren 8580 wird dafür oft eine Stimme über das Test-Bit oder Pulsbreite `$000` als Gleichspannungsträger aufgesteuert). Das Verfahren ermöglichte erstmals echte Drums (*Arkanoid*, *Skate or Die*) und Sprache (*Impossible Mission*: *„Stay a while — stay forever!“*), veränderte jedoch gleichzeitig die Gesamtlautstärke der laufenden Musikstimmen.
2. **Generation 2 — Kanalgebundene Hüllkurven-Modulation (ADSR-Sustain-Digis):** Um ein Sample nur auf einer einzelnen Stimme abzuspielen, ohne die beiden anderen Musikstimmen in ihrer Lautstärke zu beeinflussen, wird auf einer Stimme eine konstante Gleichspannung erzeugt und im Sample-Takt das Sustain-Register (`$D406`) verändert, während das Gate-Bit kurz umgeschaltet wird.
3. **Generation 3 — Ultraschall-Pulsbreitenmodulation (8-Bit-PWM-Digis):** Einer der verblüffendsten Hacks der Demoszene (bekannt durch Programmierer wie Laxity, HCL und Pex „Mahoney“ Tufvesson mit *Cubase64*). [[19]](#quellen) Dabei wird auf einer Stimme die Pulswelle (`$41`) mit extrem hoher Frequenz gewählt oder über das **Test-Bit (`$49`)** und schnelle NMI-Interrupts fortlaufend mit dem aktuellen Sample-Wert im **Pulsbreitenregister (`$D402/$D403`)** gefüttert. Das nachgeschaltete analoge Tiefpassfilter glättet die hochfrequenten Rechteckimpulse zu einer kontinuierlichen Spannung — und verwandelt den SID in einen **8-Bit-Audio-D/A-Wandler**, während die beiden übrigen Stimmen völlig ungestört weiter Musik spielen!
4. **Generation 4 — Frequenz- und Phasenakkumulator-Modulation:** Durch gezieltes Beschreiben der Frequenzregister im Takt eines CIA-Timers wird der 24-Bit-Phasenakkumulator selbst als Funktionsgenerator für komplexe Wellenformen zweckentfremdet.

Gerade diese Sample-Techniken zeigen, warum ein SID-Emulator auf den einzelnen Prozessortakt genau arbeiten muss: Wenn das Zusammenspiel zwischen 6510-Befehl, CIA-Timer und Register-Latch auch nur um wenige Mikrosekunden wackelt, bricht die Illusion zusammen.

---

# Vierter Teil: Sterbendes Silizium und die lange Jagd nach der Emulation

## 13. „When the SID hits the fan“ — Warum echte 6581-Chips sterben und wie Hardware-Ersatzchips das Erbe retten

Während die Musik des Commodore 64 zeitlos blieb, erwies sich das physische Silizium aus den achtziger Jahren als verwundbar. In Werkstätten und Foren der Retro-Szene — treffend zusammengefasst unter dem Schlagwort *„When the SID hits the fan“* — gehört der Ausfall des Soundchips zu den häufigsten Todesursachen alter C64-Platinen. [[20]](#quellen) [[21]](#quellen)

Dafür gibt es drei physikalische Gründe:

1. **Die thermische Last der 12-Volt-Schiene:** Der MOS 6581 benötigt neben den `+5V` für die Logik satte **`+12V`** für seine analogen Verstärker- und Filterstufen. In dem engen, kaum belüfteten Kunststoffgehäuse des C64 heizt sich der Chip im Dauerbetrieb auf 60 bis über 70 Grad Celsius auf. Über Jahrzehnte beschleunigt diese Hitze die Elektromigration in den feinen Leiterbahnen: Oft fällt zuerst das analoge Filter aus, dann verstummt eine einzelne Stimme, bis schließlich nur noch ein leises Brummen übrig bleibt.
2. **Ungeschützte Eingangs-Pins (ESD):** Die Anschlüsse für die analogen Paddles (`POTX`/`POTY`) und die Audio-Buchse führen fast ungeschützt auf empfindliche NMOS-Transistoren im Chip. Ein einziger statischer Funke beim Umstecken eines Joysticks oder Audiokabels bei eingeschaltetem Rechner reicht aus, um Teile des Chips dauerhaft zu zerstören. [[20]](#quellen)
3. **Endliche Bestände:** Seit Commodore 1994 Insolvenz anmeldete, wurde kein einziger originaler 6581 oder 8580 mehr in einer Halbleiterfabrik gefertigt.

Aus dieser Not entstand ab Ende der neunziger Jahre eine faszinierende Parallelwelt: Wenn es keine neuen Originalchips mehr gab, musste man entweder die letzten Überlebenden in eigene Musikinstrumente retten — oder den SID auf moderner Hardware neu erschaffen. [[22]](#quellen) [[23]](#quellen)

* **Vom Sammlerstück zum Studio-Synthesizer (*SidStation* & *HardSID*, 1999):** Das schwedische Unternehmen Elektron baute 1999 restliche Originalbestände des 6581 in die **SidStation** ein — einen ausgewachsenen MIDI-Synthesizer, mit dem Bands und Produzenten von Machinae Supremacy bis Daft Punk und Timbaland den echten C64-Klang ins moderne Tonstudio holten; parallel erlaubten PCI- und USB-Karten wie der *HardSID*, echte Chips direkt vom PC aus anzusteuern. [[10]](#quellen) [[14]](#quellen)
* **Die erste Generation der Mikrocontroller-Ersatzchips (*SwinSID*):** Als erschwinglicher Ersatz für defekte C64-Platinen entstand zunächst der auf einem kleinen AVR-Mikrocontroller basierende *SwinSID* (von Swinkels). Er hielt tausende C64 am Leben, musste aber wegen der knappen Rechenleistung des 8-Bit-Controllers bei Filterkurven, kombinierten Wellenformen und den Paddle-Eingängen deutliche Kompromisse eingehen. [[22]](#quellen) [[23]](#quellen)
* **Präzision in Logikgattern und ARM-Kernen (*FPGASID*, *ARMSID*, *BackSID*, *UltiSID*):** In den folgenden Jahren erreichte die Hardware-Nachbildung ein völlig neues Niveau. Projekte wie der **FPGASID** (der die digitale und analoge Schaltung in einem programmierbaren FPGA nachbildet) sowie schnelle ARM-basierte Drop-in-Ersatzchips wie **ARMSID** und **BackSID** passten exakt in den 28-poligen Sockel des C64, unterstützen sogar die analogen Maus-/Paddle-Eingänge und lassen sich per Software zwischen 6581- und 8580-Charakteristik umschalten. [[22]](#quellen) [[23]](#quellen)
* **Die Open-Source-Revolution mit dem Raspberry Pi RP2040 (*SIDKick Pico* & *USBSID-Pico*):** Ab 2023/2024 zeigte der Entwickler **Frenetic** mit dem **SIDKick Pico** (und der kompakten Einzelplatinen-Variante *SKPico2040DAC*), was moderne Mikrocontroller leisten können: Auf einer winzigen Platine von der Größe des alten DIP-28-Chips taktet ein zweikerniger RP2040-Prozessor, der den Datenbus des C64 in Echtzeit belauscht und eine hochpräzise `reSID`/`reSIDfp`-Emulation — auf Wunsch sogar als **Dual-Stereo-SID** samt zusätzlicher FM-Klangerzeugung — direkt im echten C64 ausführt. [[23]](#quellen) [[24]](#quellen) Und Projekte wie **USBSID-Pico** schlagen heute den Bogen zurück zum PC und Browser, indem sie echte oder emulierte SID-Chips über WebUSB direkt aus Webanwendungen wie *DeepSID* ansprechbar machen.

## 14. Von PlaySID bis reSIDfp — Wie Software-Pioniere den Chip im Computer nachbauten

Parallel zu diesen Hardware-Rettern vollzog sich in der Software-Welt jene wissenschaftliche Pionierarbeit, ohne die eine präzise Browser-Emulation undenkbar wäre:

1. **Die Pionierzeit auf dem Amiga — *PlaySID* (1990):** Als Ende der achtziger Jahre viele C64-Szener auf den 16-Bit-Amiga wechselten, schrieben die Schweden **Per Håkan Sundell** und **Ron Birk** das Programm *PlaySID*. [[10]](#quellen) Sie emulierten den 6510-Prozessor und bildeten die drei SID-Stimmen auf den vier DMA-Kanälen des Amiga-Paula-Chips nach. Für Sample-Stücke wie *The Great Giana Sisters* führten sie **erweiterte virtuelle Register ab `$D41D`** ein, über die der vierte Amiga-Kanal direkt 4-Bit-Samples abspielen konnte. Aus dieser Zeit stammt das **PSID-Format**, das bis heute das Rückgrat der **High Voltage SID Collection (HVSC)** (über 58.000 archivierte Stücke) und moderner Web-Archive wie **DeepSID** oder **SID-Spieler** bildet. [[10]](#quellen) [[25]](#quellen)
2. **Die wissenschaftliche Wende — Dag Lems *reSID* (1998–2004):** 1998 veröffentlichte der Norweger **Dag Lem** die Bibliothek **reSID**. [[8]](#quellen) Lem verließ die ungenaue Methode, den Chip nur im 44,1-kHz-Raster der Soundkarte zu berechnen: Er ließ Phasenakkumulatoren, LFSR-Schieberegister und den 15-Bit-ADSR-Zähler exakt im **1-Megahertz-Takt** des C64 laufen und untersuchte geöffnete 6581- und 8580-Chips unter dem Mikroskop (*Die-Shots*).
3. **Die Entschlüsselung der analogen Nichtlinearität — *reSIDfp*:** Ab Mitte der 2000er Jahre modellierten **Antti S. Lankila** und später **Leandro Nini** (*libsidplayfp* / *reSIDfp*) die nichtlinearen Kennlinien der FET-Schalter im 6581-Filter und die Verzerrungen der analogen Stufen mit Fließkomma-Präzision. [[9]](#quellen)

## 15. Die Bühne im Browser — Wie Chiptunes Fantasy die Aufführung rekonstruiert

Als *Chiptunes Fantasy* antrat, diese Tradition in den modernen Webbrowser zu holen, galt ein kompromissloses Gesetz: **Kein einziger Ton darf vorgerendert sein, und kein externes Framework darf zwischen dem Code und der Maschine stehen.**

Die gesamte Verarbeitungskette läuft als reines ES6-JavaScript innerhalb eines asynchronen `AudioWorkletProcessor` auf dem dedizierten Audio-Thread des Browsers:

```text
SID-Binärdatei (.sid)
  ├─ PSID/RSID-Header (Metadaten, Load/Init/Play-Vektoren, Speed-Flags)
  └─ 6502/6510-Maschinencode
        │
        ▼  [PAL-Taktdomäne: 985.248 Hz Lockstep]
  ┌──────────────────────────────────────────────────────────┐
  │  1. CPU 6510 + CIA 1/2 + VIC-II Raster / Badlines        │
  │     (Sub-Cycle Write Pipeline, RMW Dummy-Writes,         │
  │      Re-Entrant $FFD0 Play-Wrapper, PlaySID DMA Trap)    │
  ├──────────────────────────────────────────────────────────┤
  │  2. SID-Kern (Exact 6581 R3  ODER  Fantasy Studio)       │
  │     (24-Bit Phase Acc, 15-Bit ADSR, ZDF VCF, VCA)        │
  └────────────────────────────┬─────────────────────────────┘
                               │ 985.248 kHz Rohstrom
                               ▼
  ┌──────────────────────────────────────────────────────────┐
  │  3. 256-Phasen Kaiser-Sinc Polyphase-Resampler           │
  └────────────────────────────┬─────────────────────────────┘
                               │ 48.000 Hz / 44.100 Hz
                               ▼
  ┌──────────────────────────────────────────────────────────┐
  │  4. Ausgangsstufe & Master-DSP (bs2b Crossfeed + Limiter)│
  └──────────────────────────────────────────────────────────┘
```

### Zwei Uhren und das Gesetz der Null-Allokation

Weil der PAL-C64 mit **985.248 Hz** taktet, die Soundkarte eines modernen Rechners aber beispielsweise **48.000 Abtastwerte pro Sekunde** verlangt (ein krummes Verhältnis von rund $20{,}526$ Chip-Takten pro Audio-Sample), darf die Emulation keine Zwischenschritte überspringen. Für jedes einzelne Ausgabesample laufen CPU, Timer und SID ihre 20 bis 21 Einzelzyklen durch; ein **256-Phasen-Kaiser-Sinc-Resampler** berechnet daraus bandbegrenzt und phasenstarr den Abtastwert für den Host.

Dabei gilt im gesamten Audio- und Grafik-Hot-Path das Prinzip **Zero Allocation**: Innerhalb der laufenden Berechnungen darf kein einziges neues JavaScript-Objekt (`new`, `{}`, `[]`) erzeugt werden. Alle Ringpuffer, Filterkoeffizienten und Registerfelder werden beim Start als `TypedArrays` voralloziiert, damit die *Garbage Collection* des Browsers niemals einen hörbaren Aussetzer verursacht.

### Exact und Fantasy: Zwei ehrliche Antworten auf zwei verschiedene Fragen

Statt historische Genauigkeit und modernen Studio-Genuss in einem faulen Kompromiss zu vermischen, trennt *Chiptunes Fantasy* beide Welten in zwei eigenständige Prozessoren:

| Eigenschaft | **SID Exact (`MOS6581_R3`)** | **SID Fantasy (`Studio`)** |
|---|---|---|
| **Leitfrage** | Wie verhält sich ein MOS 6581 R3 innerhalb klar dokumentierter und gemessener Modellgrenzen? | Wie klingt dieselbe C64-Aufführung als breit gestaffelte, audiophile Stereo-Studio-Inszenierung? |
| **Wellenformpfad** | 12-Bit-Pfade für Saw/Tri/Pulse/Noise, dokumentierte Wired-AND-Baseline, gehaltener DAC-Latch bei `$00` | Bewusst eigenständige 8-Bit-Studio-Charakteristik |
| **Filter & Ausgang** | Kalibriertes 6581-R3-ZDF-Filter, lineare Master-Lautstärke, 16-kHz-LP + 16-Hz-Kopplung, **Mono** | 20-kHz-Airband-Stereo-VCF, Constant-Power-StereoSID-Panning, 48-Hz-Digidrum-Sub-Exciter, 16-Hz-Kopplung |
| **Wissenschaftlicher Anspruch** | Reproduzierbares Referenzmodell (keine falsche Gleichsetzung mit jedem realen Chip) | Bewusst künstlerische Interpretation (kein versteckter „8580-Exact“-Ersatz) |

---

# Fünfter Teil: Sechs Phasen, eine Maschine — Das Ingenieurstagebuch

Wie bringt man einer solchen Architektur Schritt für Schritt bei, verlässlich und überprüfbar zu arbeiten? Statt blind nach Gehör an Dutzenden Schrauben gleichzeitig zu drehen, durchlief die SID-Engine von *Chiptunes Fantasy* sechs streng voneinander abgegrenzte Entwicklungsphasen.

## 16. Phase 0 — Erst eine Messuhr, dann ein besserer Klang

Jede seriöse Restaurierung beginnt mit einer Bestandsaufnahme. Bevor auch nur eine einzige Filterformel verändert wurde, entstand ein **Offline-Mess-Harness** (`tools/sid-render.mjs`). Zehn synthetische Register-Testfälle und reproduzierbare Referenz-Renderings legten das Verhalten des Ausgangszustands als unverrückbare Baseline fest.

Der Grundsatz dahinter ist einfach, wird aber in vielen Emulationsprojekten vernachlässigt: Wer keine Messuhr besitzt, kann eine Verbesserung nicht von einem bloßen Zufall unterscheiden.

## 17. Phase 1 — Der Resampler bekommt ein eigenes Gutachten

Die erste bauliche Erneuerung galt der Brücke zwischen der 985.248-Hz-Welt des Chips und der 48-kHz-Welt der Soundkarte. Der frühere 32-Phasen-Ansatz mit 255 Taps wich einem **polyphasischen Kaiser-gefensterten Sinc-Resampler mit 256 Phasen**.

Je nach Host-Abtastrate wird der Kernel beim Setup exakt ausgelegt:
* Bei **48 kHz** umfasst er **1.511 Koeffizienten pro Phase**,
* bei **44,1 kHz** sind es **2.741 Koeffizienten pro Phase**.

Die Messungen (`tools/sid-resampler-measure.mjs`) weisen einen nahezu spiegelglatten Durchlassbereich bis **20 kHz** und eine Sperrdämpfung von **mindestens rund 96 dB** am jeweiligen Stopband-Beginn nach. Die feste Gruppenlaufzeit wird explizit ausgewiesen und per Impulstest überwacht.

Gleichzeitig konnte im Exact-Pfad eine alte Höhen-Vorverzerrung (*Sinc-Droop-Equalizer*) abgeschaltet werden: Sie hatte lediglich den Höhenabfall des früheren, kürzeren Filters ausgeglichen und hätte beim neuen, bis 20 kHz linearen Resampler eine unnatürliche Höhenanhebung verursacht.

## 18. Phase 2 — Die digitale Seele des 6581

In der zweiten Phase wurden die digitalen Bausteine des `MOS6581_R3`-Pfads von alten Behelfslösungen befreit:

* **Volle 12-Bit-Wellenformpfade:** Sägezahn, Dreieck, Puls und Rauschen behalten ihre 12-Bit-Präzision bis zum Wellenform-DAC; nur das vom Prozessor auslesbare Register `OSC3` (`$D41B`) spiegelt wie auf der echten Hardware die oberen acht Bits wider.
* **Dokumentierte Wired-AND-Baseline & DAC-Latch:** Künstliche Pulsbreiten-Verschiebungen und spekulatives „Übersprechen“ wurden aus dem Exact-Pfad entfernt. Wird im Steuerregister keine Wellenform gewählt (`$00`), hält der Wellenform-DAC seinen letzten Eingangswert fest, statt auf einen willkürlichen Festwert zu springen.
* **Zustandsbehaftete ADSR-Maschine:** Der 15-Bit-Ratenzähler mit Überlauf (Wraparound), die Zwei-Takt-Gate-Verzögerung und die exakten Schwellen des exponentiellen Teilers wurden als deterministischer digitaler Vertrag implementiert und durch Einzelzyklus-Tests (`test/sid-digital.test.mjs`) abgesichert.

Dabei wurde strikt auf **saubere Urheberschaft (Clean-Room-Prinzip)** geachtet: Externe Projekte wie `reSIDfp` oder `VICE` dienten als Vergleichs- und Beobachtungsobjekte, doch kein fremder GPL-Code und keine internen Tabellen wurden in unsere Engine kopiert.

## 19. Phase 3 — Das Filter wird vermessen, nicht verklärt

Das analoge Filter des 6581 ist das Gebiet, auf dem in Foren und Dokumentationen am meisten Mythen kursieren. Um für den Exact-Pfad eine nachvollziehbare, ehrliche Grundlage zu schaffen, wurden **639 Filter-Antworten über den externen Audioeingang (`EXT-IN`)** an der öffentlichen Programmierschnittstelle einer fest definierten `libresidfp`-Referenzversion gemessen.

Aus diesen Black-Box-Beobachtungen generiert das Projekt eigene, beim Start aufgebaute Kennlinien für **2.048 Grenzfrequenz-Schritte** und **16 Resonanzstufen**, ergänzt um getrennte Durchgriffe für Band- und Hochpass, additive Filterkombinationen, lineare Master-Lautstärke und die schaltplangemäße `Voice-3-OFF`-Regel (bei der Bit 7 in `$D418` Stimme 3 nur dann stummschaltet, wenn sie *nicht* in das Filter geroutet ist).

Der direkte Vergleich unserer produktiven Filter- und Mischerstrecke mit den 639 Referenzantworten (`tools/sid-filter-measure.mjs`) liefert klare, ungeschönte Kennzahlen:

| Metrik über 639 EXT-IN-Antworten | Gemessene Abweichung |
|---|---:|
| **Median des absoluten Fehlers** | **1,876 dB** |
| **95-Perzentil des absoluten Fehlers** | **6,737 dB** |
| **RMS-Fehler (Quadratisches Mittel)** | **3,396 dB** |

Diese Tabelle ist ein Bekenntnis zu wissenschaftlicher Redlichkeit: Ein Medianfehler von unter 1,9 dB zeigt eine enge Annäherung an das Referenzmodell, verschweigt aber nicht, dass in extremen Randbereichen bis zu 6,7 dB (95-Perzentil) Abweichung auftreten — und dass hier die Übereinstimmung zweier Modelle gemessen wurde, nicht eine Messreihe an Dutzenden gealterten Original-Chips aus den achtziger Jahren.

Auch der Temperaturregler im *Hardware-Lab* der Benutzeroberfläche wurde sauber eingeordnet: Er moduliert ausschließlich die ausdrücklich als explorativ gekennzeichneten Drift-Parameter, ohne die kalibrierte 6581-R3-Grundkurve zu verfälschen.

## 20. Phase 4 — Der Prozessor tritt in den Vordergrund

Warum klangen manche Stücke mit schnellen Timern oder Digidrums trotz gutem Filter noch immer unruhig? Weil in der Musik des C64 **die Zeit selbst Teil des Klangs ist**.

Ein Befehl wie `STA $D418` benötigt auf dem 6510 vier Prozessortakte. In den ersten drei Takten liest die CPU den Befehl und die 16-Bit-Adresse aus dem Speicher; erst im **vierten und letzten Takt** legt sie den neuen Lautstärkewert tatsächlich auf den Datenbus des SID. Und bei einem *Read-Modify-Write*-Befehl (wie `INC`, `DEC`, `ASL` oder `LSR`) schreibt der NMOS-Prozessor im vorletzten Takt sogar noch einmal den *alten*, unveränderten Wert auf den Bus (*Dummy Write*), bevor im letzten Takt der neue Wert folgt — ein Detail, auf das sich zahllose C64-Routinen beim Quittieren von Interrupts verlassen.

Phase 4 verankerte diese zeitliche Präzision tief im CPU- und CIA-Kern (`test/sid-cpu-timing.test.mjs`):

* **Final-Cycle Bus Writes & RMW Dummy Writes** für Registerzugriffe;
* **Interrupt-Polling am vorletzten Instruktionstakt** sowie die einzyklige Verzögerung bei `CLI` und `SEI`;
* **Final-Cycle-Read bei `LDA $DC0D`** auf das Interrupt-Kontrollregister des CIA-Bausteins;
* **Exakte CIA-6526-Timer-Pipeline:** Startverzögerung, *Force Load*, Underflow, One-Shot-Abschaltung, Timer-B-Kaskadierung mit sichtbarem Nulldurchgang und verzögerte IRQ-/NMI-Flipflops;
* **VIC-II RDY-Stalls (Badlines):** Wenn der Grafikchip den Prozessor für 40 Takte anhält, pausieren Lesezugriffe sofort, während bereits angestoßene Schreibzyklen wie auf echter Hardware zu Ende geführt werden;
* **Der wiedereintrittsfähige Play-IRQ-Wrapper (`$FFD0`) für *Arkanoid*:** Wenn Martin Galways prozedurale `$D418`-Trommelschleife über mehrere Bildschirmframes hinweg im Vordergrund rechnet und dabei Interrupts per `CLI` zulässt, unterbricht unser 14-Byte-KERNAL-Wrapper die Trommelschleife alle 20 Millisekunden, rettet die Register `A`, `X` und `Y` auf den Stack, führt das 50-Hz-Update der drei Melodiestimmen aus und kehrt per `RTI` nahtlos in den nächsten Takt der Trommelberechnung zurück.

## 21. Phase 5 — Zwei Klassiker auf dem Prüfstand

Zum Abschluss mussten sich die **unveränderten Produktions-Worklets** (`sid-exact.js` und `sid-fantasy.js`) an echter Musik beweisen. Gerendert wurden jeweils zwanzig Sekunden aus Rob Hubbards ***Commando*** und Martin Galways ***Arkanoid*** — zwei Stücke, die mit Hard Sync, schnellen Arpeggios und mehrframigen Vordergrund-Digidrums fast jede Baugruppe der Emulation gleichzeitig fordern.

Um den musikalischen Gesamteindruck über reine Phasenverschiebungen hinweg objektiv zu bewerten, zerlegt das Prüfwerkzeug (`tools/sid-worklet-render.mjs`) die Signale mittels Hann-gefensterter Kurzzeit-Fourier-Transformation (STFT) in aufeinanderfolgende Spektren und berechnet deren **Kosinusähnlichkeit** (wobei `1,0` für identische spektrale Energieverteilung steht):

| Referenzstück (20 s, Exact-Worklet) | RMS-Pegel | Sample-Peak | Spektralform-Median | 10%-Perzentil (p10) |
|---|---:|---:|---:|---:|
| ***Commando* (Rob Hubbard)** | 0,159905 | 0,821866 | **0,887454** | 0,816106 |
| ***Arkanoid* (Martin Galway)** | 0,308768 | 0,732312 | **0,863779** | 0,659909 |

Gleichzeitig erhielt der **Fantasy-Studio-Pfad** eine gezielte akustische Verfeinerung: Sein Ausgangs-Hochpass (DC-Blocker) wurde von einem starren Faktor (`0.995`, dessen Grenzfrequenz von der Soundkarten-Rate abhing und den 48-Hz-Subbass-Exciter unnötig schwächte) auf eine abtastratenunabhängige **16-Hz-Kopplung** ($\text{coeff} = e^{-2\pi \cdot 16 / f_s}$) umgestellt.

Das Ergebnis im Fantasy-Pfad war exakt so lokal begrenzt wie berechnet: Im Subbass-Band (40–56 Hz) gewannen *Commando* (**+1,533 dB**) und *Arkanoid* (**+1,623 dB**) spürbar an Fundament, während der Hochtonbereich (1–20 kHz) mit **−0,017 dB** bzw. **−0,152 dB** praktisch unangetastet blieb — und die **Exact-Renderings vor und nach dieser Änderung Byte für Byte zu 100 % identisch blieben**.

---

# Sechster Teil: Was wir heute wissen — und was nicht

## 22. Drei Arten von Wahrheit

Wer über historische Computer-Emulation schreibt, tut gut daran, drei Ebenen von „Richtigkeit“ sauber auseinanderzuhalten:

1. **Digitale Vertragswahrheit:** Zählt der Phasenakkumulator mit 24 Bit? Kippt das Rausch-Schieberegister beim richtigen Phasenbit? Trifft der Schreibbefehl `STA $D418` im vierten Takt ein? Solche Regeln lassen sich durch deterministische Einheitstests zweifelsfrei beweisen.
2. **Referenzmodell-Übereinstimmung:** Wie nah liegt unser Filter- und Ausgangsmodell an einer etablierten externen Referenz wie `libresidfp`? Das liefert reproduzierbare Dezibel- und Spektralmaße, vergleicht aber immer noch **ein mathematisches Modell mit einem anderen**.
3. **Physische Hardware-Wahrheit:** Wie verhält sich das Modell im Vergleich zu einer repräsentativen Stichprobe echter, gealterter MOS-6581- und CSG-8580-Chips auf verschiedenen C64-Hauptplatinen (etwa ASSY 250407 gegen ASSY 250469) unter kontrollierten Laborbedingungen?

Die sechs Phasen in *Chiptunes Fantasy* liefern starke, nachprüfbare Belege auf den ersten beiden Ebenen — und benennen offen, wo die dritte Ebene beginnt.

## 23. Die offenen Kapitel der Forschung

Eine gute Biographie verschweigt nicht, welche Fragen noch auf künftige Forscher warten:

* **Analoge Physik kombinierter Wellenformen:** Die Wired-AND-Baseline im Exact-Pfad ist klar dokumentiert; die komplexe, frequenz- und exemplarabhängige Ladungsverteilung auf dem echten NMOS-Wellenformbus erfordert jedoch echte Chip-Messreihen, bevor man weitere Parameter als gesicherte Physik bezeichnen darf.
* **Mehrstufige DAC- und VCA-Nichtlinearität:** Wie sich Gleichspannungsversatz, R-2R-Leiterfehler und `$D418`-Modulation unter extremen Pegeln auf verschiedenen Chip-Revisionen (6581 R2, R3, R4AR) gegenseitig beeinflussen, bleibt ein offenes Feld für direkte Halbleitermessungen.
* **Ein eigenständiger Exact-8580-Pfad:** Der spätere HMOS-II-Chip CSG 8580 (und sein Bruder 6582) verdient eines Tages ein eigenes, ebenso streng vermessenes Exact-Modell (mit linearen DACs, geänderter Kombinationslogik und 8580-Filterkennlinie) — getrennt vom künstlerischen Fantasy-Studio-Pfad.
* **Vollständige Bus-Simulation aller Grenz-Opcodes:** So weitreichend die CPU- und CIA-Präzisierung in Phase 4 für die Musikwiedergabe war, bleibt ein lückenloser Zyklus-für-Zyklus-Simulator sämtlicher undokumentierter 6510-Grenzverhalten eine eigene Disziplin.

## 24. Das Fundament steht

Was heute vor uns liegt, ist eine SID-Architektur, die in **50 automatisierten Tests ohne einen einzigen SID-Fehler** besteht, deren Resampler bis auf Bruchteile eines Dezibels vermessen ist, deren Filter gegen 639 externe Antworten geprüft wurde und deren zwei Seelen — **Exact** und **Fantasy** — sauber voneinander getrennt im Browser arbeiten.

Und wer während der Wiedergabe den Blick auf das **Living-Silicon-Labor** in der Oberfläche richtet, sieht diese Arbeit nicht nur als abstrakten Zahlenstrom: Er sieht, wie die drei Oszillatoren ihre Pulsbreiten verschieben, wie der Leuchtpunkt auf den ADSR-Flanken entlangwandert, wie sich die Resonanzspitze des Filters aufbäumt und wie bei *Arkanoid* oder *The Great Giana Sisters* die `$D418`-Digidrums in den Verstärker einschlagen.

---

# Epilog: Warum der SID noch immer singt

Vielleicht liegt das Geheimnis des MOS 6581 am Ende genau darin, dass er nie ein steriles, vollkommenes Bauteil war. Er war das Werk eines vierundzwanzigjährigen Musikers und Ingenieurs, der innerhalb von fünf Monaten in Norristown versuchte, seine Liebe zu analogen Synthesizern auf ein Stück NMOS-Silizium zu retten.

Weil das Silizium seine Grenzen hatte, erhielt der Chip Ecken, Kanten und Wärme. Weil er nur drei Stimmen besaß, zwang er Komponisten wie Rob Hubbard, Martin Galway, Chris Hülsbeck, Ben Daglish, Jeroen Tel und Tim Follin zu einer Kunstform, in der Programmcode und Musik ununterscheidbar wurden. Und weil eine `.sid`-Datei keine tote Tonaufnahme ist, sondern das ursprüngliche Programm selbst bewahrt, altert diese Musik nicht wie ein Magnetband.

Jedes Mal, wenn im Browser der virtuelle 6510-Prozessor an seiner Startadresse erwacht, wenn der erste Timer-Interrupt feuert und der 24-Bit-Phasenakkumulator zu zählen beginnt, geschieht dasselbe kleine Wunder wie im Jahr 1982: Aus einer Handvoll Bytes, aus Takt und Zustand, wird im selben Augenblick lebendige Musik.

Der SID singt wieder.

*Von Nerds für Nerds.*

---

# Anhang A: Die Reise eines SID-Takts in zehn Schritten

1. **Container lesen:** Der Parser erkennt den `PSID`- oder `RSID`-Header, Metadaten, Lade-, Init- und Play-Adressen sowie die Speed-Flags.
2. **Speicher bestücken:** Der ursprüngliche 6502/6510-Maschinencode wird an seine historische Zieladresse im 64-KB-RAM gelegt.
3. **Initialisieren:** Der `INIT`-Einsprung bereitet Subsong, Musiktreiber, Zeiger und Timer vor.
4. **PAL-Taktung (985.248 Hz):** CPU, CIA-1/2-Timer und VIC-II-Rasterzeilen laufen Takt für Takt in der internen Zeitdomäne.
5. **Interrupt-Steuerung:** IRQ und NMI unterbrechen den Programmfluss nach den modellierten Polling-, Maskierungs- und Re-Entrancy-Regeln (`$FFD0`-Wrapper).
6. **Bus-Commit:** Schreibzugriffe (`STA/STX/STY` sowie RMW-Dummy-Writes) treffen im exakt vorgesehenen Zyklus auf die SID-Register `$D400–$D418`.
7. **Klangsynthese:** Phasenakkumulatoren, Hüllkurvenzähler, Wellenformlogik, ZDF-Multimode-Filter und Mischer erzeugen den internen 1-MHz-Signalstrom.
8. **Polyphasen-Resampling:** Der 256-Phasen-Kaiser-Sinc-Resampler faltet das 985.248-Hz-Signal bandbegrenzt auf die Host-Abtastrate (z. B. 48 kHz) herunter.
9. **Charakter-Weiche:** *Exact* bewahrt den unverfälschten Mono-Hardwarepfad (`MOS6581_R3`); *Fantasy* öffnet die Stereo-Studio-Bühne mit Airband-VCF, Sub-Exciter und 16-Hz-Kopplung.
10. **Ausgabe:** Der `AudioWorkletProcessor` übergibt die Abtastwerte ohne jede Hot-Path-Speicherallokation an die Master-DSP-Stufe.

---

# Anhang B: Kleines Glossar für neugierige Nerds

**ADSR & Hard Restart (HR)**  
*Attack, Decay, Sustain, Release*: die vier zeitlichen Abschnitte der Lautstärkehüllkurve. Um den berüchtigten 15-Bit-ADSR-Verzögerungsbug des SID zu umgehen, entladen C64-Musiktreiber die Hüllkurve oft ein bis zwei Frames vor einer neuen Note kontrolliert auf null (*Hard Restart*).

**Arpeggio**  
Das blitzschnelle Nacheinanderspielen der Einzeltöne eines Akkords (oft im 50-Hz-Bildwechseltakt), sodass im Ohr der Eindruck von Mehrstimmigkeit auf einer einzigen Spur entsteht.

**AudioWorklet**  
Moderne Web-Audio-Schnittstelle, die eigenen DSP- und Emulationscode in einem dedizierten Echtzeit-Audio-Thread unabhängig von der Benutzeroberfläche ausführt.

**Badline (RDY-Stall)**  
Jede achte Rasterzeile im sichtbaren Bildbereich, in der der Grafikchip VIC-II zusätzliche Videodaten holt und den 6510-Prozessor über die `RDY`-Leitung für rund 40 Takte anhält.

**CIA 6526**  
*Complex Interface Adapter*: Ein Ein-/Ausgabebaustein des C64 mit zwei 16-Bit-Timern, die in der Musikprogrammierung für präzise Spielgeschwindigkeiten und Sample-Interrupts genutzt werden.

**DC-Blocker / Ausgangskopplung**  
Ein Hochpassfilter (beim C64 durch den Koppelkondensator auf der Hauptplatine bestimmt, ca. 16 Hz), das Gleichspannungsanteile entfernt, ohne den Tiefbass zu beschneiden.

**Digidrums (`$D418` & PWM-Samples)**  
Digitale Schlagzeug- oder Sprachklänge, die entweder durch tausendfaches Umschalten des 4-Bit-Master-Lautstärkeregisters `$D418` oder durch hochfrequente 8-Bit-Pulsbreitenmodulation (PWM) erzeugt werden.

**Hard Sync**  
Harte Phasensynchronisation, bei der ein Oszillator den Phasenzähler seines Nachbarn bei jedem eigenen Umlauf auf null zwingt — berühmt für schreiende Lead-Klänge.

**Hot Path (Zero Allocation)**  
Der tausendfach pro Sekunde durchlaufene Kern der Audio- und Grafikberechnung, in dem keine neuen Speicherobjekte angelegt werden dürfen, um Aussetzer durch die *Garbage Collection* zu vermeiden.

**LFSR**  
*Linear-Feedback Shift Register*: Ein rückgekoppeltes 23-Bit-Schieberegister, das im SID das deterministische Pseudozufalls-Rauschen für Snares, Hi-Hats und Geräuscheffekte erzeugt.

**MOS 6581 / CSG 8580 / MOS 6582**  
Die beiden großen Baureihen des SID: der frühe, mit 12V betriebene NMOS-Chip **6581** (R1–R4AR) mit seinen warmen Nichtlinearitäten und der ab 1987 im C64C eingesetzte, mit 9V betriebene HMOS-II-Chip **8580** (sowie der baugleiche **6582**).

**Phasenakkumulator**  
Ein 24-Bit-Zähler, der in jedem Takt um den Frequenzwert erhöht wird und die aktuelle Position innerhalb einer Wellenformperiode angibt.

**PSID / RSID**  
Standardisierte Containerformate der *High Voltage SID Collection*, die den originalen 6502-Maschinencode eines C64-Musikstücks samt kleinem Header kapseln.

**Resampling (Polyphasen-Sinc-FIR)**  
Die mathematisch bandbegrenzte Umrechnung des internen 985.248-Hz-Takts auf die Abtastrate der Soundkarte (44,1 oder 48 kHz) unter Unterdrückung von Spiegelfrequenzen (Aliasing).

**Ringmodulation**  
Logische XOR-Verknüpfung des Dreieckswellen-Vorzeichens mit dem MSB der Nachbarstimme zur Erzeugung glockiger, unharmonischer Obertonspektren.

**Soundmonitor / Tracker**  
Das 1986 von Chris Hülsbeck veröffentlichte C64-Musikprogramm, das die vertikale Pattern-Schreibweise etablierte und zum Vorfahren der Amiga- und PC-Tracker wurde.

**Wired-AND (Kombinierte Wellenformen)**  
Das gleichzeitige Einschalten mehrerer Wellenformen (z. B. `$50` = Dreieck + Puls) auf einer Stimme, wodurch die Ausgänge auf dem Chip elektrisch gegeneinander arbeiten und neue Mischspektren formen.

---

# Anhang C: Nachprüfen statt glauben

Die wichtigsten projektinternen Spezifikationen und Messprotokolle liegen in folgenden Dokumenten:

```text
doc/specs/emulation/c64/sid-digital-model.md
doc/specs/emulation/c64/sid-filter-model.md
doc/specs/emulation/c64/sid-cpu-cia-timing.md
doc/specs/emulation/c64/sid-fantasy-studio.md
doc/specs/emulation/c64/sid-measurement-harness.md
doc/specs/emulation/c64/technical-deep-dive-c64.md
test/fixtures/sid-phase5-studio-reference.json
```

Die zentralen SID-Regressionstests lassen sich im Projektverzeichnis mit folgenden Kommandos ausführen:

```bash
node --expose-gc --test \
  test/sid-fantasy-studio.test.mjs \
  test/sid-worklet-resampler.test.mjs \
  test/sid-offline.test.mjs \
  test/sid-pin-labels.test.mjs \
  test/sid-digital.test.mjs \
  test/sid-filter.test.mjs \
  test/sid-resampler.test.mjs \
  test/sid-cpu-timing.test.mjs

node tools/sid-render.mjs --case all --check
node tools/sid-filter-measure.mjs --check
node tools/sid-resampler-measure.mjs
```

Ein Produktions-Worklet kann mit einer eigenen, legal vorhandenen SID-Datei offline gerendert und analysiert werden:

```bash
node tools/sid-worklet-render.mjs \
  --engine exact \
  --input /pfad/zu/stueck.sid \
  --seconds 20 \
  --sample-rate 48000 \
  --out exact.wav \
  --report exact.json
```

Für den Studio-Pfad wird `--engine fantasy` übergeben. Ein Vergleich mit einem externen Referenzmodell ist dabei stets als Modellvergleich zu lesen — nicht als Ersatz für eine reale Hardwareaufnahme.

---

# Quellen

Die historischen und technischen Kapitel stützen sich auf die folgenden Quellen, Fachartikel und Zeitzeugen-Interviews. Persönliche Erinnerungen in Interviews werden bewusst als solche eingeordnet; die Aussagen über *Chiptunes Fantasy* beruhen auf den oben genannten Projektquellen und Messarchiven.

1. **Bob Yannes, ausführliches Interview zum Entwurf des SID und seiner späteren Arbeit bei Ensoniq.**  
   [landley.net/history/mirror/commodore/yannes.html](https://landley.net/history/mirror/commodore/yannes.html)

2. **MOS Technology: *6581 Sound Interface Device (SID)*, Original-Datenblatt (1982).**  
   [ccrma.stanford.edu/~chet/projects/tech_content/6581.pdf](https://ccrma.stanford.edu/~chet/projects/tech_content/6581.pdf)

3. **Jesper Juul: *“The History of the Commodore 64 in Twelve Objects #7: The SID chip / Commodore 64 Music”*, 13. Dezember 2024.**  
   [jesperjuul.net/ludologist/2024/12/13/the-history-of-the-commodore-64-in-twelve-objects-7-the-sid-chip-commodore-64-music/](https://www.jesperjuul.net/ludologist/2024/12/13/the-history-of-the-commodore-64-in-twelve-objects-7-the-sid-chip-commodore-64-music/)

4. **Martin Galway, Interview bei Remix64.**  
   [remix64.com/interviews/interview-martin-galway.html](https://remix64.com/interviews/interview-martin-galway.html)

5. **Martin Galway, weiterführende Interviews (SID Music / Lemon64).**  
   [sidmusic.org/sid/mgalway.html](http://www.sidmusic.org/sid/mgalway.html)  
   [lemon64.com/page/martin-galway-interview](https://www.lemon64.com/page/martin-galway-interview)

6. **C64-Wiki: *Rob Hubbard*, *Chris Hülsbeck* & *Soundmonitor*.**  
   [c64-wiki.com/wiki/Rob_Hubbard](https://www.c64-wiki.com/wiki/Rob_Hubbard)  
   [c64-wiki.de/wiki/Chris_H%C3%BClsbeck](https://www.c64-wiki.de/wiki/Chris_H%C3%BClsbeck)  
   [c64-wiki.de/wiki/Soundmonitor](https://www.c64-wiki.de/wiki/Soundmonitor)

7. **Rob Hubbard, Interview bei Karsmakers’ Metal e-zine.**  
   [karsmakers.nl/metal-e-zine/robb.htm](https://karsmakers.nl/metal-e-zine/robb.htm)

8. **Dag Lem: *reSID*.**  
   [github.com/daglem/reSID](https://github.com/daglem/reSID)

9. **libsidplayfp / Leandro Nini & Antti S. Lankila: *libresidfp*.**  
   [github.com/libsidplayfp/libresidfp](https://github.com/libsidplayfp/libresidfp)

10. **Wikipedia & Encyclopedia MDPI: *MOS Technology 6581 / 8580 / 6582* (inkl. US-Patent 4,677,890, Chip-Revisionen, SidStation und PlaySID-Historie).**  
    [en.wikipedia.org/wiki/MOS_Technology_6581](https://en.wikipedia.org/wiki/MOS_Technology_6581)  
    [encyclopedia.pub/entry/28597](https://encyclopedia.pub/entry/28597)

11. **jamesm.blog: *“The SID Chip: Engineering the Most Iconic Sound in Computing History”*.**  
    [jamesm.blog/retro-computing/sid-chip-most-iconic-sound/](https://jamesm.blog/retro-computing/sid-chip-most-iconic-sound/)

12. **Paul Scarlett: *“The SID Chip”*.**  
    [pscarlett.me.uk/post/c64/sid/sid.html](https://pscarlett.me.uk/post/c64/sid/sid.html)

13. **YouTube-Vergleichsstudie: *“Commodore 64 SID Chip showdown 6581 VS 8580”*.**  
    [youtube.com/watch?v=p8nGolisjHY](https://www.youtube.com/watch?v=p8nGolisjHY)

14. **James Newman: *“Driving the SID chip: Affordances, driver programming and the birth of chiptune”*, in: G|A|M|E – The Italian Journal of Game Studies, Issue 6 (*Hear the Music*), 2017.**  
    [gamejournal.it/wp-content/uploads/2019/08/GAME_06_HearTheMusic_Journal_Newman.pdf](https://www.gamejournal.it/wp-content/uploads/2019/08/GAME_06_HearTheMusic_Journal_Newman.pdf)

15. **David Viens / Plogue Art et Technologie: *chipsounds User’s Guide* (Abschnitt MOS 6581 / 8580 / 6582 & kombinierte Wellenformen).**  
    [s3.amazonaws.com/chipsounds/chipsounds_guide.pdf](https://s3.amazonaws.com/chipsounds/chipsounds_guide.pdf)

16. **Classic Computer Magazine Archive (*COMPUTE!* Issue 41, Oktober 1983): *“Working with SID”*.**  
    [atarimagazines.com/compute/issue41/Working_With_SID.php](https://www.atarimagazines.com/compute/issue41/Working_With_SID.php)

17. **Jens-Christian Huus (Chordian / JCH): *“Composing in SID Factory II, Part 4 – Instruments”* (Wave/Pulse/Filter-Tabellen, ADSR-Verhalten und Hard Restart).**  
    [blog.chordian.net/2022/08/27/composing-in-sid-factory-ii-part-4-instruments/](https://blog.chordian.net/2022/08/27/composing-in-sid-factory-ii-part-4-instruments/)

18. **Wikipedia & Epsilon’s World: *Turrican II: The Final Fight* & der Brückenschlag zwischen C64- und Amiga-Musikarchitekturen.**  
    [en.wikipedia.org/wiki/Turrican_II:_The_Final_Fight](https://en.wikipedia.org/wiki/Turrican_II:_The_Final_Fight)  
    [epsilonsworld.com/2026/03/enjoying-music-applications-with-amiga.html](https://www.epsilonsworld.com/2026/03/enjoying-music-applications-with-amiga.html)

19. **anarkiwi: *sid-digi — Reference for SID digi playing techniques* (`$D418`-Volume, ADSR-Modulation und 8-Bit-PWM-Samples).**  
    [github.com/anarkiwi/sid-digi](https://github.com/anarkiwi/sid-digi)

20. **AMI64.com: *“When the ‘SID’ hits the fan”* (Ausfallursachen, 12V-Thermik und ESD-Empfindlichkeit echter 6581-Chips).**  
    [ami64.com/post/when-the-sid-hits-the-fan](https://www.ami64.com/post/when-the-sid-hits-the-fan)

21. **Reddit C64-Community: *“Problems with SID replacement”*.**  
    [reddit.com/r/c64/comments/v2ih2h/problems_with_sid_replacement/](https://www.reddit.com/r/c64/comments/v2ih2h/problems_with_sid_replacement/)

22. **Davide Bucci: *“Comparison of SID replacement solutions”* (*SwinSID*, *FPGASID*, *ARMSID* u. a.).**  
    [davbucci.chez-alice.fr/index.php?argument=varie/sidcmp/sidcmp.inc](http://davbucci.chez-alice.fr/index.php?argument=varie/sidcmp/sidcmp.inc)

23. **Hackaday (23. Dezember 2025): *“Exploring Modern SID Chip Substitutes”*.**  
    [hackaday.com/2025/12/23/exploring-modern-sid-chip-substitutes/](https://hackaday.com/2025/12/23/exploring-modern-sid-chip-substitutes/)

24. **We are All Geeks! & YouTube-Testbericht: *“SidKick Pico: DIY C64 SID chip replacement – Stereophony and more”* (RP2040-basierte Dual-SID-Emulation von Frenetic).**  
    [wereallgeeks.wordpress.com/2024/09/13/sidkickpico/](https://wereallgeeks.wordpress.com/2024/09/13/sidkickpico/)  
    [youtube.com/watch?v=g3PLBo_tNEg](https://www.youtube.com/watch?v=g3PLBo_tNEg)

25. **High Voltage SID Collection (HVSC), SID-Spieler & Pouët.net Demoscene-Archiv.**  
    [hvsc.c64.org](https://www.hvsc.c64.org/)  
    [sidspieler.de/player-c64.html](http://www.sidspieler.de/player-c64.html)  
    [pouet.net/prodlist.php?type%5B0%5D=demotool&order=added&page=46](https://www.pouet.net/prodlist.php?type%5B0%5D=demotool&order=added&page=46)

---

*Stand dieses Buches: Chiptunes Fantasy v1.5.0 nach Abschluss der SID-Phasen 0 bis 5. Spätere Erweiterungen an Modellen, Messreihen oder unterstützten Chip-Revisionen gehören in eine künftige Auflage.*