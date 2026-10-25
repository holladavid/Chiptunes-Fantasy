# Der SID singt zweimal

## Von Bob Yannes’ Synthesizer-Chip zur Echtzeit-Emulation in Chiptunes Fantasy

*Eine technische Biographie des MOS 6581 — und die Geschichte davon, wie ein Browser lernt, nicht nur dessen Töne, sondern auch den Computer um ihn herum nachzuvollziehen.*

> **Chiptunes Fantasy v1.5.0 — „Von Nerds für Nerds“**  
> Dieser Text erzählt die Entstehung des Commodore-SID und zugleich die Entwicklung der in diesem Projekt realisierten Emulation. Historische Berichte, persönliche Erinnerungen und eigene Messungen werden bewusst unterschieden. „Exact“ bezeichnet hier das Ziel und die Modellgrenzen eines bestimmten Nachbaus, nicht den Beweis vollkommener Übereinstimmung mit jedem realen Chip.

---

## Prolog: Eine Datei, die kein Klang ist

Eine SID-Datei sieht unscheinbar aus. Oft ist sie nur wenige Kilobyte groß, kleiner als ein einziges hochaufgelöstes Foto und sehr viel kleiner als eine mehrminütige Audiodatei. Wer sie in einem Hex-Editor öffnet, findet Buchstaben wie `PSID` oder `RSID`, einen Titel, einen Namen, vielleicht eine Jahresangabe — und danach Zahlenkolonnen, die zunächst wenig musikalisch wirken.

Doch genau darin liegt der Clou: **Eine solche Datei enthält normalerweise nicht die fertige Musik als aufgezeichnete Schallwelle. Sie enthält ein Programm.**

Dieses Programm wurde einst für einen Commodore 64 geschrieben. Es kennt Adressen wie `$D400`, den Beginn der Register des Sound Interface Device, kurz SID. Es setzt Frequenzen, öffnet und schließt Hüllkurven, wählt Wellenformen, verändert Pulsbreiten und Filter. Es besitzt einen Musiktreiber, Notenwerte, Tabellen und mitunter raffinierte Tricks, die weit über das hinausgehen, was ein Datenblatt als naheliegende Anwendung beschreibt.

Wenn Chiptunes Fantasy eine solche Datei abspielt, wird deshalb nicht lediglich ein Klang entschlüsselt. Im Browser entsteht eine kleine, zeitlich organisierte Maschinenwelt: Ein emulierter 6502/6510-Prozessor führt den ursprünglichen Maschinencode aus, Timer erzeugen Unterbrechungen, Schreibzugriffe treffen zu bestimmten Takten auf SID-Register, und ein digitales Klangmodell antwortet darauf. Erst am Ende dieses Weges stehen Abtastwerte für die Lautsprecher.

Das unterscheidet die hier beschriebene Anwendung grundlegend von einem Musikplayer, der eine MP3-Datei oder einen anderen vorgerenderten Strom abspielt. Die Musik wird **zur Laufzeit neu erzeugt**. Jede Note entsteht erneut aus Programm, Zustand und Zeit.

Diese Biographie handelt deshalb von zwei Geschichten, die ineinandergreifen. Die erste beginnt Anfang der achtziger Jahre mit einem Chip, dessen Entwickler eigentlich Synthesizer im Sinn hatte. Die zweite beginnt Jahrzehnte später mit der Frage, wie man dieses Verhalten in modernen Browsern nachbildet, ohne sich mit schönen Schlagworten über die verbleibenden Unsicherheiten hinwegzusetzen.

---

# Erster Teil: Der Chip, der eigentlich ein Instrument werden wollte

## 1. Ein Synthesizer im Heimcomputer

Der Commodore 64 erschien 1982 und wurde zu einem der einflussreichsten Heimcomputer seiner Generation. Seine Grafikfähigkeiten, sein Preis und die enorme Verbreitung prägten Spiele, Demoszene und Computerkultur. Doch schon die ersten Töne verrieten, dass in dieser Maschine mehr steckte als ein simpler Piepser.

Sein Soundchip hieß **SID — Sound Interface Device**. Die bekannteste frühe Ausführung war der **MOS 6581**. Entwickelt wurde er bei MOS Technology, dem Halbleiterunternehmen, das zu Commodore gehörte. Maßgeblicher Entwickler war **Robert „Bob“ Yannes**, der den Entwurf 1981 begann.

Yannes brachte eine für diese Aufgabe ungewöhnlich passende Doppelbegabung mit: Er beschäftigte sich mit integrierten Schaltungen, war aber auch elektronischer Musiker und Synthesizer-Bastler. In einem späteren Interview erklärte er, dass seine Kenntnisse über Musik-Synthese ein Grund dafür gewesen seien, warum MOS ihn eingestellt habe. Sein Ziel war nicht nur, einem Computer ein paar Töne zu entlocken. Er dachte an eine vollständige Synthesizer-Stimme auf einem Chip — etwas, das sich grundsätzlich auch in mehrstimmigen Instrumenten einsetzen ließe. [[1]](#quellen)

Diese Herkunft hört man dem SID bis heute an. Er besitzt nicht nur Oszillatoren, sondern pro Stimme eine ADSR-Hüllkurve; nicht nur eine feste Klangfarbe, sondern mehrere Wellenformen, variable Pulsbreite, Synchronisation und Ringmodulation. Hinzu kommt ein programmierbares Filter mit mehreren Betriebsarten und ein externer Audioeingang. Das ist weniger die Ausstattung eines gewöhnlichen Computer-Soundbausteins als die Grundstruktur eines kleinen Analogsynthesizers.

Das ursprüngliche Datenblatt führt diese Bestandteile nüchtern auf: drei Stimmen, Dreieck, Sägezahn, variable Rechteck- beziehungsweise Pulsform und Rauschen, vier Hüllkurvenparameter, Synchronisation, Ringmodulation und ein multimodales Filter. Hinter dieser Liste verbirgt sich jedoch eine kreative Einladung. Die Komponenten lassen sich kombinieren, schnell umstellen und mit Prozessorbefehlen in eine Bewegung versetzen, die aus statischen Registern Musik macht. [[2]](#quellen)

Yannes’ ursprüngliche Synthesizer-Ambition wurde nicht in dem Umfang verwirklicht, den er sich vorgestellt hatte. Nach seiner Erinnerung verschlang die C64-Produktion die verfügbaren Chips; Sequential Circuits soll Interesse gezeigt haben, ein Geschäft kam aber nicht zustande. So wurde aus dem Baustein mit Instrumenten-Ambitionen vor allem die Stimme eines Heimcomputers — und schließlich eine eigene Musiktradition. [[1]](#quellen)

## 2. Die Schönheit eines unvollkommenen Bauteils

Heute spricht man gern vom „SID-Sound“, als hätte es genau einen gegeben. Schon die Hardwaregeschichte widerspricht dieser Vorstellung. Neben dem 6581 erschien später unter anderem der 8580; verschiedene Rechner- und Platinengenerationen, Fertigungsstreuung und analoge Außenbeschaltung trugen ebenfalls zum Ergebnis bei.

Das Datenblatt des 6581 warnt ausdrücklich vor Streuungen des Filters. Fertigungsprozess, Kondensatoren und Betriebsbedingungen konnten die tatsächliche Filterfrequenz beeinflussen. Was für einen Ingenieur eine Toleranz ist, kann für einen Musiker Charakter sein — und für einen Emulator-Entwickler eine Warnung: Ein einzelnes Messergebnis beschreibt nicht automatisch jedes Exemplar. [[2]](#quellen)

Yannes schilderte später, wie sehr das Filter durch die damalige NMOS-Technologie begrenzt war. Die verfügbaren Operationsverstärker und die Streuung der als Schaltelemente eingesetzten Feldeffekttransistoren ließen wenig Raum für ideale Lehrbuchlösungen. Gerade deshalb ist es problematisch, den SID durch eine hübsche Übertragungsfunktion allein erklären zu wollen. Zwischen Registereinstellung und hörbarem Klang liegt analoge Elektronik mit ihren eigenen Launen. [[1]](#quellen)

Auch die Hüllkurvenzeiten entstanden nicht als Ergebnis einer rein abstrakten musikalischen Formel. Yannes erzählte, dass er die Raten subjektiv auswählte, unter anderem mit Blick auf einen Sequential-Circuits-Pro-One und mit Beurteilung nach Gehör. Das ist eine reizvolle Szene in der Geschichte digitaler Klangerzeugung: Ein Chip, der später millionenfach mathematisch analysiert werden sollte, erhielt einen Teil seines musikalischen Zeitgefühls durch einen Entwickler, der zuhörte. [[1]](#quellen)

Eine weitere Anekdote aus demselben Interview zeigt, wie gefährlich die Kluft zwischen Dokumentation und Wirklichkeit sein konnte. Yannes berichtete von frühen japanischen Spielen, deren Sound nach einer ungenauen Spezifikation programmiert worden sei. Der Code habe dem Dokument gefolgt — nur das Dokument entsprach nicht ausreichend dem tatsächlichen Chip. Das Ergebnis klang schlecht. Für die Emulation ist diese Erinnerung fast eine Leitregel: Das Datenblatt ist ein Ausgangspunkt, aber kein vollständiger Schaltplan und kein Ersatz für Beobachtung.

## 3. Was drei Stimmen aus Komponisten machen

Drei unabhängige Stimmen klingen für heutige Verhältnisse nach einer strengen Begrenzung. Eine Melodie, ein Bass und eine Begleitung — dann wäre das Kontingent eigentlich erschöpft. Doch SID-Musik entwickelte gerade aus dieser Knappheit eine eigene Sprache.

Ein besonders prägnantes Mittel ist das **Arpeggio**: Mehrere Töne eines Akkords werden in sehr schneller Folge auf einer Stimme gespielt. Aus der zeitlichen Abfolge entsteht im Ohr der Eindruck eines zusammenhängenden Klanges. Das Arpeggio ist nicht allein eine Notlösung; seine Bewegung, Schärfe und Rhythmik wurden zu einem erkennbaren Stilmittel.

Ebenso wichtig ist die schnelle Veränderung der Klangparameter. Eine Stimme muss nicht während einer ganzen Note dieselbe Gestalt behalten. Der Musiktreiber kann Pulsbreite, Wellenform, Filter oder Lautstärke laufend verändern. Ein scheinbar statischer Klang beginnt dadurch zu atmen. Die Musik entsteht nicht nur aus Noten, sondern aus der Choreographie der Register.

Der Softwarehistoriker Jesper Juul beschreibt diese Verbindung aus drei Stimmen, schnellen Arpeggios und fortlaufend veränderten Klangeigenschaften als einen zentralen Teil der SID-Musikgeschichte. Er weist außerdem darauf hin, dass SID-Musik schon vor der MP3-Ära unabhängig von den Spielen verbreitet wurde — als Musik, die man sich nicht nur während des Spielens anhörte. [[3]](#quellen)

Damit verschiebt sich der Blick auf die Komponisten. Sie waren nicht nur Melodieschreiber, die einem fertigen Instrument Noten übergaben. Viele entwickelten eigene Treiber oder veränderten sie von Stück zu Stück. Komposition und Programmierung gingen ineinander über. Der Musiktreiber war zugleich Instrumentenbauer, Aufführungspraxis und Effektgerät.

## 4. Hubbard, Galway und die Kunst des Musiktreibers

**Rob Hubbard** und **Martin Galway** zählen zu den bekanntesten Stimmen dieser Epoche. Ihre Musik half, den SID von einer technischen Besonderheit zu einem kulturellen Klang zu machen. Es wäre jedoch zu einfach, ihre Arbeit nur als eine Folge guter Melodien zu beschreiben. Entscheidend war, wie tief ihre Programme in die Möglichkeiten des Chips eingriffen.

Hubbard wird mit einer langen Reihe einflussreicher C64-Stücke verbunden. Für *Monty on the Run* entwickelte er nach eigener Darstellung neuen Pitch-Bend-Code; bei *Commando* entstand Musik, die bis heute als Referenz für energische, rhythmisch dichte SID-Komposition gilt. Die oft erzählte Episode, wonach er an *Commando* über Nacht arbeitete, sollte man als persönliche beziehungsweise weitergegebene Erinnerung lesen, nicht als Anlass, eine filmreife Szene zu erfinden. [[6]](#quellen) [[7]](#quellen)

Galway wiederum sprach in Interviews mit großer Bewunderung über Hubbards Treiber und dessen perkussive Klänge. Zugleich wehrte er sich gegen eine Vereinfachung, die später gern entstand: Er habe die Sample-Wiedergabe auf dem C64 nicht erfunden. Er beschrieb vielmehr, dass er fremde Software und Digidrum-Ansätze analysiert und deren musikalische Verwendung weiterentwickelt beziehungsweise veröffentlicht habe. Über die veröffentlichten Trommelgeräusche in *Arkanoid* urteilte er selbstironisch als „farts and burps“. Die Anekdote ist aufschlussreich, weil sie den Glanz der Erinnerung mit der Enge damaliger Entwicklungsbedingungen kontrastiert. [[4]](#quellen) [[5]](#quellen)

Für eine Emulation ist diese Geschichte keine dekorative Fußnote. Sie erklärt, warum es nicht genügt, ein paar Wellenformen korrekt zu erzeugen. Der Klassiker lebt davon, **wann** der Treiber ein Register verändert, ob ein Interrupt rechtzeitig kommt, ob ein Schreibzugriff im richtigen Prozessortakt sichtbar wird und ob ein Sample-Trick trotz anderer Aufgaben weiterläuft.

Die eigentliche Partitur liegt daher nicht nur in Notentabellen. Sie liegt auch im Verhalten des Prozessors.

---

# Zweiter Teil: Wie der SID einen Klang baut

## 5. Ein Oszillator, der durch die Zeit zählt

Der digitale Ausgangspunkt einer SID-Stimme ist ein **24-Bit-Phasenakku**. Man kann ihn sich als einen Zähler vorstellen, der bei jedem Takt um einen einstellbaren Betrag weiterläuft. Er zählt nicht die Tonhöhe direkt, sondern die Position innerhalb einer Schwingung. Je größer der Zuwachs, desto schneller durchläuft er den Zyklus und desto höher wird der Ton.

Das ursprüngliche Datenblatt gibt den Zusammenhang als Formel an:

```text
Fout = Fn × Fclk / 16777216
```

Dabei ist `Fn` der programmierte Frequenzwert, `Fclk` der SID-Takt und `16777216` gleich `2^24`, also der Umfang des Phasenraums. Die Schönheit dieses Prinzips liegt in seiner Präzision: Auch mit einem festen Takt lassen sich viele Frequenzen fein abstufen. [[2]](#quellen)

Yannes bezeichnete den SID in seinem Interview als seinen ersten Entwurf mit phasenakkumulierenden Oszillatoren. Spätere Arbeiten bei Ensoniq gingen andere Wege, unter anderem mit zeitlich gemultiplexten Oszillatoren für sehr viel mehr Stimmen. Es wäre deshalb falsch, Ensoniq einfach als „großen SID“ zu beschreiben; die Entwicklungsgeschichte ist verbunden, die Architektur nicht identisch. [[1]](#quellen)

Aus der Phase werden die Wellenformen abgeleitet:

- **Sägezahn** folgt unmittelbar dem ansteigenden Phasenverlauf und klingt obertonreich.
- **Dreieck** entsteht durch geeignete Spiegelung des Verlaufs und wirkt weicher.
- **Puls** entsteht aus einem Vergleich der Phase mit einer einstellbaren Schwelle; die Pulsbreite verändert das Obertonspektrum.
- **Rauschen** wird über ein rückgekoppeltes Schieberegister erzeugt. Es klingt zufällig, ist aber digital deterministisch aufgebaut.

In der hier beschriebenen Exact-Implementierung bleiben diese Pfade mit **12 Bit** bis zur Wellenformwandlung erhalten. Das ist wichtig, weil eine zu frühe Reduktion auf acht Bit Feinheiten verwirft, bevor Filter und Mischer überhaupt arbeiten können.

## 6. Die Hüllkurve: Wie aus einem Ton eine Note wird

Ein Oszillator allein erzeugt einen Dauerton. Musikalisch wird er erst durch eine zeitliche Lautstärkebewegung. Die SID-Hüllkurve besitzt die vier klassischen Abschnitte:

1. **Attack:** Wie schnell steigt die Lautstärke nach dem Öffnen des Gates?
2. **Decay:** Wie schnell fällt sie vom Anfangshöhepunkt auf den Haltepegel?
3. **Sustain:** Auf welchem Pegel bleibt sie, solange die Note gehalten wird?
4. **Release:** Wie schnell klingt sie nach dem Schließen des Gates aus?

Diese vier Begriffe sind leicht zu erklären, aber die konkrete Maschine dahinter ist eigenwilliger als eine idealisierte Grafik. Attack verläuft linear, Decay und Release verwenden stückweise exponentielles Verhalten. Ein interner Ratenzähler besitzt einen eigenen, fortbestehenden Zustand; Gate-Wechsel treffen nicht ohne jede Verzögerung ein.

Der Exact-Pfad von Chiptunes Fantasy bildet deshalb nicht nur die vier sichtbaren Parameter nach. Er verwendet einen 15-Bit-Ratenzähler mit Wraparound, eine Zwei-Takt-Gate-Pipeline und die dokumentierten Schwellen für den Wechsel der exponentiellen Teiler. Gerade solche Details entscheiden darüber, ob neu gestartete Noten, schnelle Wiederholungen und perkussive Figuren das richtige Zeitverhalten zeigen.

Hier zeigt sich ein Grundsatz des Projekts: **Das Musikalische steckt häufig im Zustand.** Ein Modell, das nur den gegenwärtigen Registerwert betrachtet, kann den richtigen Momentanwert liefern und trotzdem die falsche Bewegung erzeugen.

## 7. Synchronisation, Ringmodulation und das Filter

Neben den Grundwellenformen erweitern zwei Verknüpfungen die Klangpalette.

Bei **Hard Sync** wird die Phase einer Stimme zurückgesetzt, sobald die vorgegebene Nachbarstimme ihren Phasenumlauf erreicht. Die zurückgesetzte Stimme verliert dadurch nicht einfach ihre Bedeutung: Ihre eigene Frequenz und Wellenform beeinflussen weiterhin das Spektrum. Es entstehen harte, oft obertonreiche Klänge, deren Bewegung sich besonders gut für melodische Sweeps eignet.

Bei der **Ringmodulation** wird der Verlauf mit dem Vorzeichen beziehungsweise MSB einer Nachbarstimme verknüpft. Das Ergebnis kann metallisch, glockig oder dissonant wirken. Auch hier hängt der Klang von der Beziehung zweier laufender Oszillatoren ab, nicht von einer isolierten Wellenformtabelle.

Das Filter bildet eine zweite Klangebene. Es bietet Tiefpass, Bandpass und Hochpass beziehungsweise Kombinationen dieser Modi. Der Datenblatt-Hinweis auf additive Auswahl ist praktisch bedeutsam: Die Kombination von Tief- und Hochpass kann eine Kerbe im Spektrum erzeugen, statt bloß einen weiteren einfachen Modus darzustellen.

Im Projekt wird das Filter als Zwei-Integrator-System mit **Zero-Delay Feedback** berechnet. Die Formel mag im technischen Anhang ihre Berechtigung haben; für das Verständnis genügt zunächst das Bild zweier speichernder Stufen, die gegenseitig auf ihren aktuellen Zustand reagieren. Resonanz verstärkt den Bereich um die Grenzfrequenz und kann dem Klang den typischen pfeifenden, singenden oder sprechenden Charakter geben.

Die digitale Idealformel allein reicht jedoch nicht. Deshalb wurden Grenzfrequenz, Dämpfung und bestimmte Durchgriffe anhand externer Beobachtungen kalibriert — mit einer Grenze, auf die dieser Text noch mehrfach zurückkommt: Die Kalibrierung vergleicht mit einem etablierten Referenzmodell, nicht mit einer eigenen Messreihe an realen 6581-Chips.

## 8. Der Trommeltrick im Lautstärkeregister

Eine der erstaunlichsten Entwicklungen der SID-Musik nutzt etwas, das zunächst gar nicht wie ein Sample-System aussieht: das Master-Lautstärkeregister `$D418`.

Durch schnelle Änderungen dieses Registers lässt sich ein hörbares Signal erzeugen. Vier Bit reichen für grob aufgelöste Sample-Werte; die nötige Schreibgeschwindigkeit liefert der Prozessor. So können Trommeln oder andere gesamplete Klänge neben den drei Synthesizer-Stimmen erscheinen. Der Preis ist Rechenzeit und eine enge Abhängigkeit vom Timing.

Diese sogenannten **Digidrums** machen auf besonders anschauliche Weise klar, warum eine SID-Emulation nicht am Chipgehäuse aufhören darf. Wenn der Prozessor Schreibzugriffe zu früh ausführt, Timer ungenau laufen oder Interrupts Notenframes verschlucken, verändert sich der Klang. Die Melodie kann stocken, das Schlagzeug kann falsch rhythmisiert sein, und selbst ein an sich brauchbares Wellenformmodell rettet das Ergebnis nicht.

In Galways *Arkanoid* kommt zusätzlich eine schwierige Programmstruktur ins Spiel: Eine lange Sample-Schleife kann über mehrere reguläre Musikframes hinweg aktiv bleiben. Der Emulator muss die Musikunterbrechung daher mitten in dieser Arbeit zulassen und anschließend exakt zum unterbrochenen Programmzustand zurückkehren. Sonst opfert das Schlagzeug die Melodie — ein Fehler, der nicht durch Filterkalibrierung zu beheben ist.

---

# Dritter Teil: Die Emulation als Rekonstruktion einer Aufführung

## 9. Der Browser wird nicht zum C64 — er baut die nötigen Teile nach

Die Aufgabe von Chiptunes Fantasy ist nicht, einen vollständigen Commodore 64 mit Bildschirm, Datasette und Diskettenlaufwerk zu ersetzen. Für die Wiedergabe von PSID- und RSID-Dateien werden jene Teile benötigt, die das Verhalten des Musikprogramms und seines Klanges bestimmen.

Der Parser liest zunächst den Container: Magic Header, Versionsnummer, Ladeadresse, Init- und Play-Adresse, Anzahl der Stücke, Start-Stück und Speed-Flags. Titel, Autor und Veröffentlichungsangabe stehen in festen Textfeldern. Danach folgt der eigentliche 6502-Maschinencode.

Diese Unterscheidung ist wichtig:

```text
SID-Datei
  ├─ Metadaten und Wiedergabeparameter
  └─ 6502/6510-Programm
        ├─ Initialisierung
        ├─ Musiktreiber und Notendaten
        └─ Schreibzugriffe auf CIA/VIC/SID
              ↓
       Echtzeit erzeugtes Audiosignal
```

Der Ablauf gleicht daher eher einer Aufführung als dem Abspielen einer Aufnahme. Der Emulatorkern ist der Musiker, das SID-Modell das Instrument, und das ursprüngliche Programm bestimmt beides. Dieselbe Datei kann sich bei unterschiedlichen Emulatoren hörbar unterscheiden, weil nicht nur die „Klangdatei“, sondern das gesamte Aufführungssystem nachgebildet wird.

Für die eigentliche Klangerzeugung nutzt das Projekt die **Web Audio API** und `AudioWorkletProcessor`. Die rechenintensive Emulation läuft damit auf dem Audio-Thread statt als lockere Folge von Timer-Aufrufen auf der Benutzeroberfläche. Das ist keine kosmetische Architekturentscheidung: Audio verlangt einen kontinuierlichen Strom. Eine verspätete Animation ist ärgerlich; eine Lücke im Audiopuffer ist sofort hörbar.

## 10. Zwei Uhren, ein Klang

Der PAL-C64 und ein moderner Audioausgang arbeiten nicht mit derselben Abtastrate. Der SID-Kern läuft im Projekt mit dem PAL-Takt von **985.248 Hz**. Die Audioausgabe verwendet dagegen beispielsweise 44.100 oder 48.000 Abtastwerte pro Sekunde.

Man könnte versucht sein, einfach bei jedem Ausgabesample einen SID-Zustand abzufragen. Doch damit gingen Zwischenereignisse verloren. Ein Register kann sich mehrfach ändern, bevor der nächste 48-kHz-Abtastwert fällig ist. Gerade bei schnellen Sample-Schleifen und eng getakteten Treibern ist dieser Unterschied entscheidend.

Chiptunes Fantasy arbeitet deshalb mit zwei verbundenen Zeitdomänen:

```text
PAL-Domäne: 985.248 Schritte pro Sekunde
  CPU → Timer/Interrupts → SID-Register → Oszillatoren/Hüllkurven/Filter
                                      ↓
                              bandbegrenzte Umrechnung
                                      ↓
Host-Domäne: z. B. 48.000 Samples pro Sekunde
```

Für die Umrechnung kommt ein polyphasischer, Kaiser-gefensterter Sinc-Resampler mit **256 Phasen** zum Einsatz. Seine Koeffizienten und Ringspeicher werden beim Aufbau angelegt. Während der Audiowiedergabe arbeitet er mit bereits vorhandenen Typed Arrays und skalaren Variablen.

Bei 48 kHz besitzt der entworfene Kernel 1.511 Koeffizienten pro Phase; bei 44,1 kHz sind es 2.741. Die projektspezifischen Messungen dokumentieren einen nahezu ebenen Durchlassbereich bis 20 kHz und mindestens etwa 96 dB Dämpfung am jeweils definierten Stopband-Anfang. Die feste Gruppenlaufzeit wird nicht versteckt, sondern ausdrücklich bestimmt und per Impulstest geprüft.

Diese Zahlen sind keine Behauptung über den analogen SID. Sie beweisen etwas Bescheideneres, aber sehr Nützliches: Der digitale Übergang von der internen Taktdomäne zur Host-Abtastrate ist reproduzierbar und messtechnisch untersucht.

## 11. Warum im Audio-Hot-Path nichts Neues entstehen darf

In JavaScript wirken Objekte und Arrays harmlos. Man erzeugt sie, verwendet sie und überlässt die Entsorgung der Garbage Collection. Für Echtzeit-Audio kann genau diese Bequemlichkeit zum Risiko werden: Eine ungünstig platzierte Speicherbereinigung kann Rechenzeit kosten und die kontinuierliche Ausgabe gefährden.

Deshalb gilt im Projekt für die relevanten Audio- und Render-Hot-Paths eine strikte Regel: **keine laufenden Neuanlagen**. Keine frischen Objekte, Arrays oder Puffer pro Sample beziehungsweise Frame. Koeffiziententabellen, Zustandsfelder, Ringspeicher und Ausgabepuffer werden vorab erzeugt; in der Schleife werden nur vorhandene Speicherplätze und primitive Zahlen verwendet.

Das ist keine Behauptung, JavaScript insgesamt sei dadurch vollständig deterministisch wie Bare-Metal-Hardware. Es ist eine konkrete Maßnahme gegen vermeidbare Arbeit und Speicherdruck an der empfindlichsten Stelle. Ein separater Regressionstest prüft das Hot-Path-Verhalten, sofern die Tests mit explizitem Garbage-Collector-Zugriff laufen.

Auch die visuelle Seite folgt einem eigenen historischen Stil: ganzzahlige Blitter-Koordinaten, Nearest-Neighbor-Darstellung und historische Paletten. Die Regeln für die Retro-Grafik ändern jedoch nichts an der Klangmathematik — und der bekannte, separate `drawImage`-Fehler bei einer null großen Canvas-Fläche gehört nicht in diesen Emulationsbericht. Er wurde während der SID-Phasen bewusst nicht angefasst.

## 12. Exact und Fantasy: Zwei Antworten auf zwei verschiedene Fragen

Das Projekt besitzt zwei bewusst getrennte C64-Klangwege.

### SID Exact

Der Exact-Pfad fragt: **Wie lässt sich das Verhalten eines MOS 6581 R3 innerhalb klar dokumentierter Modellgrenzen nachbilden?**

Dazu gehören unter anderem:

- die explizite Modellidentität `MOS6581_R3`;
- 12-Bit-Wellenformpfade für Sägezahn, Dreieck, Puls und Rauschen;
- der Zustand des Wellenform-DAC bei abgewählter Wellenform;
- Hard Sync und Ringmodulation auf der gemeinsamen Oszillatoruhr;
- die zustandsbehaftete ADSR-Maschine;
- kalibrierte Filter- und Mischparameter;
- Monoausgabe am Worklet-Ausgang;
- die passive Ausgangsstufe mit 16-kHz-Tiefpass und 16-Hz-Kopplung;
- dieselbe sorgfältig terminierte CPU-/CIA-Ausführung wie beim künstlerischen Pfad.

„Exact“ ist hier also ein technischer Name, kein Freibrief für die Aussage „klingt mit jedem Original identisch“. Gerade bei kombinierten Wellenformen, DAC-/DC-Verhalten, nichtlinearer Verzerrung und realer Filterstreuung bleiben Forschungsfragen offen.

### SID Fantasy

Der Fantasy-Pfad beantwortet eine andere Frage: **Wie kann dieselbe ursprüngliche Musik als moderne Stereo-Studio-Interpretation inszeniert werden?**

Dazu gehören eine bewusst andere, künstlerische 8-Bit-Wellenformrichtung, Constant-Power-Panning der Stimmen, ein Stereo-Studiofilter, Sättigung und ein 48-Hz-Subharmonik-Exciter für Digidrum-Transients. Diese Zusätze sind keine versehentlichen Hardwarefehler und werden auch nicht als verborgene 8580-Wahrheit ausgegeben. Sie sind künstlerische Entscheidungen.

Die Trennung ist fundamental:

| Frage | Exact | Fantasy |
|---|---|---|
| Ziel | dokumentierter MOS-6581-R3-Modellpfad | künstlerische Stereo-Studio-Interpretation |
| Stereo-Inszenierung | nein, mono am Worklet | ja, bewusst |
| Studio-Sättigung/Exciter | nein | ja |
| Messwerte als Hardwarebeweis | nein | erst recht nein |
| 8580-Exact-Ersatz | nein | nein |

Ein separater, hardwareorientierter **Exact-8580-Pfad** bleibt eigenständige Zukunftsarbeit. Fantasy wird dafür weder umbenannt noch stillschweigend in einen solchen Pfad verwandelt.

---

# Vierter Teil: Sechs Phasen, eine Maschine

## 13. Phase 0 — Erst eine Messuhr, dann ein besserer Klang

Die Versuchung bei einer Emulation ist groß, zuerst am Klang zu drehen. Ein wenig mehr Resonanz hier, etwas Sättigung dort — und schon klingt ein bekanntes Stück vertrauter. Doch ohne feste Ausgangslage lässt sich anschließend kaum sagen, was tatsächlich besser wurde.

Deshalb begann das Projekt mit einem **Offline-Harness und einer unveränderten Baseline**. Synthetische Registerfälle und reproduzierbare Renderings machten das Verhalten beobachtbar, ohne bei jeder Untersuchung manuell im Browser Musik starten zu müssen.

Diese Entscheidung bestimmte alle späteren Phasen. Nicht jede Verbesserung muss sofort spektakulär klingen; sie muss zunächst erklärbar und wiederholbar sein. Die Baseline diente als Gedächtnis: Wenn sich später etwas veränderte, sollte die Veränderung absichtlich, messbar und auf den vorgesehenen Bereich beschränkt sein.

## 14. Phase 1 — Der Resampler bekommt ein eigenes Gutachten

Die erste große technische Erneuerung betraf die Abtastratenwandlung. Der vorherige 32-Phasen-Ansatz mit 255 Koeffizienten wurde durch den gemessenen 256-Phasen-Kaiser-Sinc-Resampler ersetzt.

Entscheidend war dabei nicht allein die höhere Zahl. Der Entwurf richtet sich nach der tatsächlichen Ausgaberate, besitzt einen definierten Durchlass- und Sperrbereich und macht seine Gruppenlaufzeit explizit. Streaming-Tests prüfen den Betrieb über Blockgrenzen hinweg; Impulstests kontrollieren die zeitliche Ausrichtung.

Eine alte Droop-Kompensation wurde im Exact-Pfad deaktiviert. Sie hatte zum früheren Kernel gehört und hätte beim neuen, bereits ebenen Durchlassbereich eine unbegründete Höhenanhebung erzeugt. Das ist ein schönes Beispiel für die eigentliche Arbeit einer Verfeinerung: Nicht jeder erhaltene Parameter ist ein Schatz. Manche Kompensation überlebt ihren Grund und muss verschwinden.

## 15. Phase 2 — Die digitale Seele des 6581

Die zweite Phase konzentrierte sich auf Oszillatoren, Wellenformen und Hüllkurven. Die Exact-Signalwege wurden auf zwölf Bit gehalten; die reine Spiegelung von OSC3 auf acht Bit blieb davon getrennt. Künstliche PWM-Verschiebungen und spekulativer Wellenform-„Bleed“ hatten in diesem Pfad keinen Platz mehr.

Für kombinierte Wellenformselektoren übernahm Exact eine dokumentierte Wired-AND-Baseline. Das ist bewusst vorsichtig formuliert: Die logische Verknüpfung ist eine brauchbare Ausgangsbasis, aber kein vollständiges Analogmodell der Pull-down-Wechselwirkungen eines realen 6581. Gerade hier wäre „jetzt perfekt“ eine unbelegte Behauptung.

Auch der DAC-Latch erhielt einen Zustand: Ist keine Wellenform ausgewählt, wird der letzte DAC-Eingang gehalten, statt auf einen erfundenen Gleichspannungswert zu driften. Hüllkurvenzähler, Gate-Verzögerung und exponentielle Schwellen wurden entsprechend dem dokumentierten digitalen Vertrag behandelt.

Wichtig ist auch die Herkunftsgrenze: Die Implementierung wurde unabhängig erstellt. Es wurden keine reSIDfp-/VICE-Implementierungscodes oder internen Tabellen still übernommen. Externe Projekte dienen als Referenz und Beobachtungsgegenstand; ihre Lizenzen und ihre geistige Herkunft werden respektiert.

## 16. Phase 3 — Das Filter wird vermessen, nicht verklärt

Das Filter ist der Ort, an dem technische Demut besonders nötig ist. Ein paar bekannte Kurven und ein resonanter Klang reichen nicht aus, um ein Modell als allgemeingültige 6581-Wahrheit zu verkaufen.

Für Phase 3 wurden **639 EXT-IN-Antworten** über die öffentliche API einer festgelegten libresidfp-Version erzeugt. Der externe Kern diente als Black Box. Aus den Beobachtungen entstanden eigene, beim Setup aufgebaute Tabellen: 2.048 Grenzfrequenzpositionen und 16 Resonanzstufen. Dazu kamen getrennte Durchgriffe für Band- und Hochpass, additive Filtermodi, lineare Master-Lautstärke und die dokumentierte Voice-3-OFF-Routingregel.

Die produktive Filter-/Mischerstrecke wurde direkt mit diesen Antworten verglichen:

| Vergleichsmaß | Ergebnis |
|---|---:|
| Median des absoluten Fehlers | 1,876 dB |
| 95-Perzentil des absoluten Fehlers | 6,737 dB |
| RMS-Fehler | 3,396 dB |

Diese Werte sind nützlich, weil sie Fehler sichtbar machen statt ihn hinter dem Wort „authentisch“ zu verstecken. Zugleich haben sie eine klare Bedeutungsgrenze: **Sie messen Übereinstimmung mit einem externen Modell unter einem bestimmten Stimulus.** Sie sind keine Aufnahme eines realen Chips, keine Hörteststudie und keine Garantie für alle Registerkombinationen.

Auch die verwendete DAC-Kennlinie blieb als parametrisiertes Modell gekennzeichnet. Neue unabhängige Messungen zu DAC, DC, mehrstufiger Verzerrung oder Temperaturverhalten wurden nicht erfunden. Der Hardware-Lab-Temperaturregler beeinflusst weiterhin nur die ausdrücklich explorativen Parameter; er verstellt nicht die zuvor kalibrierte Filterkurve.

## 17. Phase 4 — Der Prozessor tritt in den Vordergrund

Nach Oszillator und Filter rückte die Zeit selbst ins Zentrum. Viele Fehler in klassischen Stücken entstehen nicht, weil eine Welle falsch aussieht, sondern weil ein Ereignis im falschen Takt geschieht.

Ein absoluter `STA $D418` benötigt auf dem 6502/6510 mehrere Takte. Der entscheidende Bus-Schreibzugriff findet im letzten Takt statt. Die Emulation merkt sich Adresse und Wert daher zunächst und schreibt erst am vorgesehenen Zyklusende in das Zielregister. Bei NMOS-Read-Modify-Write-Befehlen kommt der historische Dummy Write hinzu: Der unveränderte Wert erscheint vor dem veränderten erneut auf dem Bus.

Solche Einzelheiten klingen wie Purismus, bis ein Musiktreiber genau darauf aufbaut. Dann werden sie zur Rhythmik.

Phase 4 präzisierte außerdem:

- Interrupt-Polling am vorletzten Instruktionstakt;
- das verzögerte Verhalten von `CLI` und `SEI`;
- einen gezielt final getakteten `LDA $DC0D`-Zugriff auf das CIA-Interruptkontrollregister;
- CIA-Timer-A/B-Startverzögerung, Force Load, Underflow und One-Shot;
- Timer-B-Kaskadierung mit sichtbarer Null;
- verzögerte CIA-IRQ-/NMI-Ausgangs-Flipflops;
- RDY-Stalls, bei denen Lesezugriffe anhalten, bereits inszenierte Schreibvorgänge aber fortgesetzt werden.

Für *Arkanoid* blieb der wiedereintrittsfähige Play-IRQ-Wrapper entscheidend. Wenn Galways lange Digidrum-Schleife noch arbeitet, darf der nächste Musikaufruf nicht einfach verloren gehen. Der Wrapper rettet die Prozessorregister, führt den Play-Treiber aus und kehrt per `RTI` zum unterbrochenen Zustand zurück.

Die Reichweite bleibt trotzdem begrenzt. Nicht jeder allgemeine Buslesezugriff, jede ALU-/RMW-Sonderform, jede Branch-Interrupt-Eigenheit oder jeder RDY-Spezialfall wurde dadurch zu einem vollständigen physikalischen Busmodell. Die Phase lieferte gezielte, getestete Verbesserungen — nicht die Lizenz, fortan jede denkbare C64-Software als zyklisch bewiesen zu bezeichnen.

## 18. Phase 5 — Zwei bekannte Stücke als letzte Prüfung

Zum Abschluss der sechs Phasen wurden die **tatsächlich ausgelieferten Produktions-Worklets** offline gerendert. Das ist ein wichtiger Unterschied zu einem separaten Testmodell: Der Vergleich importiert die Exact- und Fantasy-Prozessoren unverändert und ersetzt lediglich die browserseitige Worklet-Registrierung durch eine kleine Testhülle.

Als Material dienten zwanzig Sekunden aus Rob Hubbards *Commando* und Martin Galways *Arkanoid*. Die Dateien wurden über ihre SHA-256-Hashes identifiziert. Auch die externen libsidplayfp-/libresidfp-Versionen, Render- und Vergleichsparameter wurden archiviert. Die urheberrechtlich geschützten Stücke und erzeugten WAVs gehören deshalb nicht zum Quellarchiv; die Messergebnisse lassen sich mit eigenen legal beschafften Kopien reproduzieren.

Für den musikalischen Vergleich wurde eine phasenunempfindliche Spektralform-Metrik verwendet. Stereo wird zu Mono gemittelt, ein Hann-gefenstertes STFT zerlegt das Signal in kurze Spektren, und deren normierte Magnituden werden per Kosinusähnlichkeit verglichen. Ein Median von 1 bedeutete im Selbstvergleich identische Spektralform. Diese Methode bestraft nicht jede bloße zeitliche Phasenverschiebung als musikalischen Fehler — aber sie beweist eben auch keine wellenformgenaue Gleichheit.

Die Exact-Ergebnisse lauteten:

| Stück | RMS | Sample-Peak | Spektralform-Median | p10 |
|---|---:|---:|---:|---:|
| *Commando* | 0,159905 | 0,821866 | 0,887454 | 0,816106 |
| *Arkanoid* | 0,308768 | 0,732312 | 0,863779 | 0,659909 |

Beide Renderings enthielten keine nicht-finiten Samples. Exact blieb am Worklet-Ausgang mono. Vor allem aber blieben beide Exact-WAVs vor und nach der abschließenden Fantasy-Änderung **Byte für Byte identisch**. Die künstlerische Retusche hatte den Hardwarepfad also nicht unbemerkt mitverändert.

### Die eine bewusste Studio-Änderung

Fantasy erhielt eine neue, abtastratenunabhängige 16-Hz-Ausgangskopplung. Der bisherige feste DC-Blocker-Koeffizient `0.995` ließ die tatsächliche Grenzfrequenz von der Host-Abtastrate abhängen und dämpfte den gewollten 48-Hz-Digidrum-Anteil stärker als beabsichtigt.

Der neue Koeffizient wird nur beim Setup berechnet:

```text
coefficient = exp(-2π × cutoffHz / sampleRate)
```

Bei 44,1 und 48 kHz zeigt die Messung nun etwa −3,00 dB bei 16 Hz und −0,448 dB bei 48 Hz. Der 48-Hz-Exciter bleibt dadurch wirksamer, ohne die DC-Abweisung aufzugeben. Bestehende andere Aufrufer, die keine neuen Parameter übergeben, behalten dagegen den historischen Koeffizienten `0.995`.

Die Musikvergleiche bestätigten die örtlich begrenzte Wirkung:

| Stück | Leistung 40–56 Hz | Leistung 1–20 kHz | Sample-Peak danach |
|---|---:|---:|---:|
| *Commando* | +1,533 dB | −0,017 dB | 0,716010 |
| *Arkanoid* | +1,623 dB | −0,152 dB | 0,735155 |

Beide Fantasy-Ausgaben bestanden ausschließlich aus endlichen Abtastwerten, enthielten weder `NaN` noch Unendlich und blieben unter dem digitalen Vollaussteuerungswert 1,0. Panning, Stereo-Filter, Sättigung und Wellenformmodell wurden nicht gleichzeitig neu erfunden. Es war eine einzelne, gemessene künstlerische Korrektur — kein versteckter Versuch, Fantasy durch Referenzähnlichkeit zu Exact zu machen.

---

# Fünfter Teil: Was wir heute wissen — und was nicht

## 19. Auf den Schultern einer Emulationsgeschichte

Die heutige SID-Emulation ist nicht aus dem Nichts entstanden. Über Jahre haben Entwickler Registerverhalten analysiert, Schaltkreise fotografiert, Messungen verglichen und Software geschrieben, die ihrerseits wieder neue Forschung ermöglichte.

Dag Lems **reSID** ist ein wichtiger Teil dieser Geschichte. Das Projekt beschreibt sich als reverse-engineered SID-Emulator; reSID 0.16 erschien 2004. Spätere Entwicklungen stützten sich unter anderem auf Die-Fotografien und analoge Messungen. **reSIDfp** entwickelte diesen Ansatz mit besonderem Augenmerk auf eine verbesserte Filteremulation weiter; libresidfp stellt die zugehörige Bibliothek im Umfeld von libsidplayfp bereit. [[8]](#quellen) [[9]](#quellen)

Für Chiptunes Fantasy sind solche Projekte wertvolle externe Referenzen. Zugleich gilt eine klare Grenze: libresidfp steht unter der GPL. Deshalb werden öffentliche Schnittstellen genutzt, um Beobachtungen und Vergleichsausgaben zu erzeugen; Implementierungscode und interne Tabellen werden nicht still in die eigene Engine kopiert.

Diese Unterscheidung ist mehr als Verwaltungsformalismus. Sie zwingt das Projekt dazu, sein eigenes Modell zu verstehen und seine Herkunft offenzulegen. Eine gemessene Antwort kann eigene Parameter informieren, ohne dass daraus eine behauptete Eigenentwicklung fremden Codes wird.

## 20. Drei Arten von Wahrheit

Bei Emulationsprojekten werden gern Aussagen vermischt, die eigentlich verschiedene Beweise benötigen. Für diesen Bericht lohnt eine Dreiteilung:

### 1. Digitale Vertragswahrheit

Sie betrifft Fragen wie: Zählt ein Phasenakku mit 24 Bit? Erfolgt ein inszenierter Schreibzugriff im vorgesehenen Takt? Bleibt der Ratenzähler nach einem Gate-Wechsel erhalten? Solche Eigenschaften lassen sich mit gezielten Tests und definierten Zustandsfolgen prüfen.

### 2. Übereinstimmung mit einer externen Referenz

Hier wird dieselbe Eingabe durch das eigene Modell und durch eine festgelegte externe Implementierung geschickt. Abweichungen werden gemessen. Das ist sehr wertvoll, sagt aber zunächst etwas über **zwei Modelle** aus.

### 3. Übereinstimmung mit physischer Hardware

Dafür bräuchte man geeignete reale Chips, kontrollierte Schaltungen, dokumentierte Messungen und idealerweise mehrere Exemplare. Erst dann ließen sich Aussagen über Fertigungsstreuung, analoge Nichtlinearität oder konkrete Platinen sinnvoll kalibrieren.

Die sechs abgeschlossenen Phasen liefern vor allem Belege der ersten beiden Arten. Sie ersetzen nicht die dritte. Diese Trennung schmälert die Arbeit nicht; sie macht sie belastbar.

## 21. Die offenen Kapitel

Eine ehrliche Biographie endet nicht mit der Behauptung, der Gegenstand sei vollständig erklärt. Für die SID-Emulation bleiben mehrere Kapitel offen.

### Kombinierte Wellenformen

Die Wired-AND-Baseline ist nachvollziehbar und testbar. Reale analoge Pull-down-Wechselwirkungen, Restladungen und deren Abhängigkeit vom konkreten Chip lassen sich daraus aber nicht vollständig ableiten. Hier sind eigene Hardwareaufnahmen und ein belastbares Identifikationsverfahren nötig, bevor weitere Koeffizienten als gemessen gelten könnten.

### DAC, DC und nichtlineare Verzerrung

Die vorhandenen Kennlinien sind parametrisierte Modelle. Sie dürfen nicht nachträglich zu unabhängigen Halbleitermessungen umdeklariert werden. Offen bleiben insbesondere mehrstufiges Verzerrungsverhalten, DC-Drift und das genaue Zusammenspiel mit `$D418` unter verschiedenen Bedingungen.

### Reale Filterstreuung

Die externe Kalibrierung verbessert die definierte Modellübereinstimmung. Sie erfasst nicht die Verteilung realer 6581-Exemplare. Ein zukünftiger Hardwarevergleich müsste Exemplar, Platine, Versorgung, Temperatur und Messkette dokumentieren. Ein einzelnes „goldenes“ Gerät wäre noch kein universeller SID.

### Vollständigkeit des Busmodells

Die CPU-/CIA-Arbeit schloss wichtige Lücken für die Musikwiedergabe. Ein vollständiger Buszyklus-Simulator mit allen Lese-, RMW-, RDY-, Branch- und Interrupt-Sonderfällen ist eine weitere Aufgabe. Gerade weil der jetzige Umfang gezielt erweitert wurde, sollte er nicht nachträglich größer erzählt werden.

### Exact 8580

Der 8580 ist nicht nur ein Schalter am Fantasy-Klang. Ein eigener Exact-Pfad erfordert eine separate Modelldefinition, eigene Beobachtungen und eigene Abnahmekriterien. Bis dahin bleibt die korrekte Aussage: Exact zielt auf MOS 6581 R3; Fantasy ist künstlerisch; Exact 8580 steht noch aus.

### Breitere musikalische und reale Hardware-Abnahme

Zwei zwanzigsekündige Ausschnitte sind bewusst ein kleines Korpus. Sie ergänzen synthetische Tests, ersetzen aber weder eine große kuratierte Titelsammlung noch kontrollierte Hörtests oder reale Chipaufnahmen. Gerade unterschiedliche Treiberfamilien könnten weitere Timing- und Modellfragen sichtbar machen.

## 22. Was die abgeschlossene Arbeit bereits trägt

Nach so vielen Grenzen darf auch das Erreichte klar benannt werden: Die SID-Simulation steht jetzt auf einer **soliden, reproduzierbaren und messtechnisch dokumentierten Basis**.

Die gesammelte SID-Abnahme umfasste zuletzt **50 erfolgreiche Tests ohne SID-Fehler**, einschließlich des optionalen Hot-Path-Allocationstests. Die Baseline prüfte zehn Fälle, die Filterabnahme 639 externe Antworten, und die Resampler-Messungen bestanden. Im Browser liefen Exact und Fantasy nach einem Kaltstart mit endlichem Audiosignal und ohne HTTP-Fehler im erfolgreichen Lauf.

Das bedeutet nicht, dass jede denkbare SID-Datei bereits perfekt klingt. Es bedeutet etwas für die Weiterentwicklung Wertvolleres: Es gibt definierte Pfade, reproduzierbare Werkzeuge, festgehaltene Messbedingungen und ausdrücklich benannte Grenzen. Neue Arbeit kann nun auf Beobachtungen aufsetzen statt auf Erinnerungen an einen einzelnen Klang.

Auch die Zweiteilung ist tragfähig. Exact konnte während der letzten Studioanpassung byteidentisch bewahrt werden. Fantasy durfte sich musikalisch verändern, ohne seine Identität als künstlerischer Pfad zu verlieren. Diese saubere Trennung ist kein Nebenprodukt, sondern eine Architekturentscheidung mit kulturellem Respekt: Der historische Chip und die moderne Interpretation müssen nicht gegeneinander ausgespielt werden.

---

# Epilog: Warum der SID noch immer singt

Der SID überlebte seine ursprüngliche Hardware, weil er mehr hinterließ als eine bestimmte Menge an Tönen. Er hinterließ eine Verbindung aus Technik und Ausdruck.

Man kann sie in Bob Yannes’ Erinnerung hören, die Hüllkurvenraten nach Gehör ausgewählt zu haben. Man kann sie in der Knappheit dreier Stimmen sehen, aus der Komponisten schnelle Arpeggios und ständig veränderte Klanggestalten entwickelten. Man findet sie in Musiktreibern, die zugleich Instrument und Aufführung waren, und in Digidrums, die aus einem Lautstärkeregister einen zusätzlichen Spielraum holten.

Und man findet sie in der Emulation. Dort wird deutlich, dass ein Klang nicht allein aus einer Wellenform besteht. Er besteht aus einer Abfolge: ein Prozessorbefehl, ein Timer, ein Interrupt, ein Registerzugriff im richtigen Takt, ein Zähler mit altem Zustand, ein Filter mit eigener Dynamik — und schließlich ein Abtastwert, der rechtzeitig im Browser ankommt.

Deshalb ist eine gute SID-Emulation mehr als ein Synthesizer mit nostalgischem Namen. Sie ist die Rekonstruktion einer Aufführung.

Chiptunes Fantasy erzählt diese Aufführung auf zwei Arten. **Exact** versucht, das historische Verhalten innerhalb offen dokumentierter Grenzen zu bewahren. **Fantasy** fragt, wie dieselbe Musik in einer modernen Stereo-Studiovorstellung erklingen kann. Der eine Ansatz schützt die Spur des Chips; der andere eröffnet ihr einen neuen Raum.

Vielleicht ist das der schönste Grund, sich Jahrzehnte nach 1981 noch mit 24-Bit-Zählern, NMOS-Schreibzugriffen und Filterfehlern in Dezibel zu beschäftigen: Der SID ist nicht nur ein Objekt der Vergangenheit. Er ist weiterhin ein Instrument. Und jedes Mal, wenn ein kleines Programm im Browser erneut ausgeführt wird, entsteht die Musik wieder — nicht als konservierte Schallwelle, sondern als lebendiger Ablauf.

*Von Nerds für Nerds.*

---

# Anhang A: Die Reise eines SID-Takts in zehn Schritten

1. **Lesen:** Der Parser erkennt PSID/RSID, Metadaten, Lade- und Einsprungadressen.
2. **Laden:** Der ursprüngliche 6502-Maschinencode wird in den emulierten Speicher gelegt.
3. **Initialisieren:** Der Init-Einsprung bereitet Stück, Treiber und Register vor.
4. **Takten:** CPU, CIA-Timer und zugehörige Systemzustände laufen in der PAL-Zeitdomäne.
5. **Unterbrechen:** IRQ/NMI rufen den Musiktreiber nach den modellierten Polling- und Maskierungsregeln auf.
6. **Schreiben:** Der Treiber verändert SID-Register zu den vorgesehenen Buszyklen.
7. **Synthetisieren:** Oszillatoren, Hüllkurven, Wellenformlogik, Filter und Mischer erzeugen den internen Signalstrom.
8. **Umrechnen:** Der bandbegrenzte Resampler wandelt 985.248 Hz in die Host-Abtastrate.
9. **Inszenieren:** Exact behält seinen mono Hardwaremodellpfad; Fantasy fügt die getrennte Stereo-Studio-Kette hinzu.
10. **Ausgeben:** Der `AudioWorkletProcessor` füllt die vorhandenen Ausgabepuffer ohne Hot-Path-Neuanlagen.

# Anhang B: Kleines Glossar für neugierige Nerds

**ADSR**  
Attack, Decay, Sustain, Release: vier Parameter beziehungsweise Abschnitte der Lautstärkehüllkurve einer Note.

**Arpeggio**  
Die schnelle Abfolge einzelner Akkordtöne. Auf einer einzigen SID-Stimme kann dadurch der Eindruck eines Akkords entstehen.

**AudioWorklet**  
Browser-Schnittstelle für eigene Audioverarbeitung auf dem Audio-Thread. Hier führt sie die Emulation und Klangerzeugung in Echtzeit aus.

**CIA 6526**  
Ein Baustein des C64 mit unter anderem Timern und Interruptfunktionen. Für Musiktreiber und Sample-Timing ist er oft genauso wichtig wie der SID selbst.

**DC-Blocker / Ausgangskopplung**  
Ein Hochpass beziehungsweise eine äquivalente Kopplung, die einen Gleichanteil entfernt. Seine Grenzfrequenz muss niedrig genug liegen, damit gewollte tiefe Anteile erhalten bleiben.

**Digidrums**  
Sample- beziehungsweise Trommelklänge, die häufig durch schnelle Änderungen des SID-Master-Lautstärkeregisters erzeugt werden.

**Hard Sync**  
Eine Stimme setzt die Phase einer anderen zurück. Dadurch entstehen charakteristische, obertonreiche Klänge.

**Hot Path**  
Code, der fortlaufend in der Echtzeitverarbeitung läuft. Hier sollen keine neuen Objekte oder Puffer angelegt werden.

**LFSR**  
Linear rückgekoppeltes Schieberegister. Beim SID erzeugt es das digitale Rauschsignal.

**MOS 6581 R3**  
Die im Exact-Pfad ausdrücklich adressierte Modellidentität. Die Bezeichnung macht keine Aussage darüber, dass jedes reale Exemplar bereits vollständig vermessen sei.

**Phasenakku**  
Ein Zähler, der die Position innerhalb einer Wellenformperiode fortschreibt. Der SID verwendet dafür 24 Bit.

**PSID / RSID**  
Containerformate für SID-Musikprogramme und zugehörige Wiedergabeinformationen. Sie sind keine gewöhnlichen PCM-Aufnahmen.

**Resampling**  
Die bandbegrenzte Umrechnung eines Signals von einer Abtastrate in eine andere.

**Ringmodulation**  
Eine Verknüpfung zweier Stimmen, die unter anderem metallische und glockenartige Spektren erzeugen kann.

**STFT**  
Kurzzeit-Fourier-Transformation. Sie zerlegt aufeinanderfolgende Signalausschnitte in Spektren und eignet sich für zeitlich aufgelöste Klangvergleiche.

**Zero Allocation**  
Im hier verwendeten Sinn: keine neuen Objekte, Arrays oder Puffer in den gekennzeichneten Audio-/Render-Hot-Paths. Setup- und Offline-Analysecode sind davon begrifflich zu unterscheiden.

# Anhang C: Nachprüfen statt glauben

Die wichtigsten projektinternen Belege liegen in folgenden Dokumenten:

```text
doc/specs/emulation/c64/sid-digital-model.md
doc/specs/emulation/c64/sid-filter-model.md
doc/specs/emulation/c64/sid-cpu-cia-timing.md
doc/specs/emulation/c64/sid-fantasy-studio.md
doc/specs/emulation/c64/sid-measurement-harness.md
doc/specs/emulation/c64/technical-deep-dive-c64.md
test/fixtures/sid-phase5-studio-reference.json
```

Die zentralen SID-Regressionen lassen sich im Projektverzeichnis unter anderem mit folgenden Kommandos ausführen:

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

Ein Produktions-Worklet kann mit einer eigenen, legal vorhandenen SID-Datei offline gerendert werden:

```bash
node tools/sid-worklet-render.mjs \
  --engine exact \
  --input /pfad/zu/stueck.sid \
  --seconds 20 \
  --sample-rate 48000 \
  --out exact.wav \
  --report exact.json
```

Für Fantasy wird `--engine fantasy` verwendet. Die Messwerkzeuge und Vergleichsmetriken sind im Projekt dokumentiert; externe Referenzversionen und Eingabe-Hashes stehen im Phase-5-Fixture. Ein Vergleich mit einem externen Modell ist dabei stets als solcher zu lesen — nicht als reale Hardwareaufnahme.

# Quellen

Die historischen Aussagen beruhen auf den folgenden, bewusst verlinkten Quellen. Interviews geben persönliche Erinnerungen wieder; sie werden nicht als unfehlbare zeitgenössische Protokolle behandelt. Die technischen Aussagen über Chiptunes Fantasy stammen aus den oben genannten Projektquellen und Messarchiven.

1. **Bob Yannes, ausführliches Interview zum SID und zu seiner späteren Arbeit.** Verwendet wurden die Aussagen zu Yannes’ musikalischem Hintergrund, Synthesizer-Absicht, Phasenakkumulatoren, ADSR-Auswahl, Filtergrenzen, Spezifikationsanekdote und Ensoniq.  
   [landley.net/history/mirror/commodore/yannes.html](https://landley.net/history/mirror/commodore/yannes.html)

2. **MOS Technology: 6581 Sound Interface Device, ursprüngliches Datenblatt.** Grundlage für Registerumfang, Stimmen, Wellenformen, ADSR, Sync/Ringmodulation, Filtermodi, EXT-IN, Frequenzformel und Filterstreuung.  
   [ccrma.stanford.edu/~chet/projects/tech_content/6581.pdf](https://ccrma.stanford.edu/~chet/projects/tech_content/6581.pdf)

3. **Jesper Juul: “The History of the Commodore 64 in Twelve Objects #7: The SID chip / Commodore 64 Music”, 13. Dezember 2024.** Historischer Kontext zu Yannes, drei Stimmen, Arpeggios, Treibern und eigenständiger Verbreitung von SID-Musik.  
   [jesperjuul.net/ludologist/2024/12/13/the-history-of-the-commodore-64-in-twelve-objects-7-the-sid-chip-commodore-64-music/](https://www.jesperjuul.net/ludologist/2024/12/13/the-history-of-the-commodore-64-in-twelve-objects-7-the-sid-chip-commodore-64-music/)

4. **Martin Galway, Interview bei Remix64.** Persönliche Darstellung zu Treibern, Sample-Wiedergabe, Digidrums, *Arkanoid* und den Arbeitsbedingungen.  
   [remix64.com/interviews/interview-martin-galway.html](https://remix64.com/interviews/interview-martin-galway.html)

5. **Martin Galway, weiteres Interviewmaterial.** Ergänzende persönliche Erinnerungen zu Rob Hubbard, eigenem Musiktreiber, Filter und Sample-Techniken.  
   [sidmusic.org/sid/mgalway.html](http://www.sidmusic.org/sid/mgalway.html)  
   [lemon64.com/page/martin-galway-interview](https://www.lemon64.com/page/martin-galway-interview)

6. **C64-Wiki: Rob Hubbard.** Biographischer Überblick und Quelle der vorsichtig zugeschriebenen *Commando*-Anekdote.  
   [c64-wiki.com/wiki/Rob_Hubbard](https://www.c64-wiki.com/wiki/Rob_Hubbard)

7. **Rob Hubbard, Interview bei Karsmakers’ Metal e-zine.** Persönliche Darstellung zu eigenen Treibern, *Monty on the Run*, Komposition und *Commando*.  
   [karsmakers.nl/metal-e-zine/robb.htm](https://www.karsmakers.nl/metal-e-zine/robb.htm)

8. **Dag Lem: reSID.** Projektdarstellung und Versionsgeschichte des reverse-engineered SID-Emulators.  
   [github.com/daglem/reSID](https://github.com/daglem/reSID)

9. **libsidplayfp: libresidfp.** Projektdarstellung, Herkunft des reSIDfp-Ansatzes und Lizenzkontext der externen Referenzbibliothek.  
   [github.com/libsidplayfp/libresidfp](https://github.com/libsidplayfp/libresidfp)

---

*Stand dieses Berichts: Chiptunes Fantasy v1.5.0 nach Abschluss der SID-Phasen 0 bis 5. Spätere Änderungen an Modellen, Messungen oder unterstützten Formaten gehören in eine aktualisierte Fassung.*
