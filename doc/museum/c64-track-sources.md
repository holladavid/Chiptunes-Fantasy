# C64-Trackkuration: Quellen und redaktionelle Entscheidungen

## Umfang und Primärquellen

Die C64-Bibliothek umfasst **50 Titel**: 26 unveränderte Bestandspfade und 24 Neuzugänge aus der **High Voltage SID Collection #85**, veröffentlicht am 28. Juni 2026. Die Neuzugänge gliedern sich in 20 Spielmusiken und vier Demoscene-Arbeiten.

Als Primärquellen dienten:

- die PSID-/RSID-Header der tatsächlich ausgelieferten lokalen Dateien,
- `C64Music/DOCUMENTS/STIL.txt` aus HVSC #85 für Komponistenzitate, Autorenschaft, Subsongtitel und musikalische Bezüge,
- `C64Music/DOCUMENTS/Songlengths.md5` aus HVSC #85 für sämtliche Subsonglängen,
- das offizielle HVSC-Versions-API unter <https://www.hvsc.c64.org/api/v1/version/7z>,
- die nachfolgend genannten externen Interviews und Demoscene-Datenbanken.

Die Integritätsdaten, Originalpfade und Parserbefunde der 24 Neuzugänge stehen in `tracks/c64/classics/provenance.json`. Die Museumstexte verlinken ihre Quellen direkt im Eintrag.

**Rechtehinweis:** Die öffentliche Verfügbarkeit einer SID-Datei in HVSC bedeutet weder Public Domain noch eine allgemeine Nutzungs-, Weitergabe- oder kommerzielle Lizenz. Die Rechte verbleiben bei den jeweiligen Inhabern. Die Sammlung wird hier als Provenienz- und Recherchequelle dokumentiert, nicht als pauschale Lizenzfreigabe.

## Auswahl der 24 Neuzugänge

| Kategorie | Lokaler Titel | Komponist / Urheber | Recherche- und Technikfokus |
|---|---|---|---|
| Spiel | Glider Rider | David Whittaker | Selbstzitate aus Lazy Jones; drei Subsongs |
| Spiel | Lazy Jones | David Whittaker | 21 Minispiel-Subsongs; Star Dust und Kernkraft 400 |
| Spiel | Ocean Loader 2 | Martin Galway | Entstehung und Ocean-weite Wiederverwendung |
| Spiel | Ocean Loader 3 | Peter Clarke | Bewusstes Galway-Zitat zu Beginn |
| Spiel | Ocean Loader 4 | Jonathan Dunn | Einsatz in Ocean-/Imagine-Spielen 1988–1989 |
| Spiel | Parallax | Martin Galway | Jarre-Bezug; 11:23-minütiger Haupt-Subsong |
| Spiel | Agent X II | Tim Follin | Sechs Subsongs; Peanuts- und Werbejingle-Bezüge |
| Spiel | L.E.D. Storm | Tim Follin | Im Originalprogramm einstellbarer Filter |
| Spiel | Ghouls ’n’ Ghosts | Tim Follin | 32 Subsongs; Zuordnung zu Tamayo Kawamoto |
| Spiel | Hawkeye | Jeroen Tel | Fünf dokumentierte Ein-Stimmen-Ingame-Stücke |
| Spiel | Eliminator | Jeroen Tel | Start-Subsong 3; Gyroscope-Zitat |
| Spiel | Katakis | Chris Hülsbeck | 34 Subsongs; spätere Verwendung in Crush |
| Spiel | Turrican | Ramiro Vaca, Chris Hülsbeck, Stefan Hartwig | Getrennte Credits je Subsong |
| Spiel | Armalyte | Martin Walker | Eigener Player/Editor; vier Subsongs |
| Spiel | Citadel | Martin Walker | Entwicklungsgeschichte und cinematicsher Ansatz |
| Spiel | Creatures 2 | Steve Rowlands | 18 situationsspezifische Subsongs |
| Spiel | Mayhem in Monsterland | Steve Rowlands | 24 Subsongs; Level- und Stimmungsmusik |
| Spiel | Flimbo’s Quest (main) | Johannes Bjerregaard | Trennung von Haupt- und Intromusik |
| Spiel | Last Ninja 3 | Reyn Ouwehand | Bestätigte Restauration der Intro-Loop-Daten |
| Spiel | Ghosts’n Goblins | Mark Cooksey | Arcade-Übertragung und eigenständiges Ingame-Stück |
| Demo | Radio Napalm | PVCF | DMC, 16 Instrumenten-Slots, 6581-/8580-Fassungen |
| Demo | Edge of Disgrace | Dane | Vollständiger Soundtrack in Subsong 1; 15 Sprungpunkte |
| Demo | Coma Light 13, Tune 1 | Fanta | Kurze musikalische Referenz auf Edge of Disgrace |
| Demo | Comaland 100%, End | Magnar Harestad | RSID; Endpart und Sprachsamples |

## Externe Vertiefungsquellen

- **C64 Audio, „Rob Hubbard – 1985 on the run“**: zeitliche Einordnung von Crazy Comets, Monty on the Run und Commando sowie Hubbards Arbeitsgeschichte. <https://c64audio.com/blogs/rob-hubbard-master-of-magic/rob-hubbard-1985-on-the-run>
- **Commodore Format Archive, Martin-Walker-Interview**: Armalyte-Auftrag, eigener Musikplayer und Editor, Citadel-Entwicklung sowie Walkers eigene Einordnung seiner Soundtracks. <https://commodoreformatarchive.com/the-martin-walker-interview/>
- **CSDb, Dutch Breeze**: Veröffentlichung 1991 und die bereits vor RoboCop 3 verwendete Musik. <https://csdb.dk/release/?id=11584>
- **CSDb, Radio Napalm**: X’95, erster Platz und Credits für PVCF/Reflex. <https://csdb.dk/release/?id=11665>
- **CSDb, Edge of Disgrace**: X’2008, erster Platz und Danes Musik-Credit. <https://csdb.dk/release/?id=72550>
- **Oxyron, Demo-Übersicht**: Coma Light 13, 28. Oktober 2012, X2012, erster Platz. <https://www.oxyron.de/html/demos.html>
- **Demozoo und CSDb, Comaland 100%**: Veröffentlichung am 20. Juni 2015 auf der Nordlicht sowie Magnars Musik- und Sample-Credits. <https://demozoo.org/productions/140070/> und <https://csdb.dk/release/?id=139278>

## Wesentliche redaktionelle Korrekturen am Bestand

- **`Delta.sid`:** Der lokale Header und STIL identifizieren Tomas Dankos 1989 entstandene Interpretation, nicht Rob Hubbards Originaldatei. Der Text nennt den Glass-/Hubbard-Bezug und belässt den bestehenden Dateipfad unverändert.
- **`Compilation_II.sid`:** Der eingebettete Titel lautet „Compilation III“. Der Bestandspfad bleibt erhalten; Überschrift und Museumstext verwenden den tatsächlichen Inhalt.
- **`Comic_Bakery.sid`:** Der lokale Header nennt 1986 Imagine. Der frühere Text datierte das Stück auf 1985 und wurde korrigiert.
- **`Arkanoid.sid`:** Galways Aussage wird differenziert wiedergegeben: erstes veröffentlichtes C64-Stück mit Samples nach seiner eigenen Einordnung, aber keine Erfindung der Sample-Wiedergabe über das Lautstärkeregister.
- **`Mega_Apocalypse.sid`:** Rob Hubbards Musik und Simon Nicols Samplearbeit werden getrennt genannt.
- **`Last_Ninja.sid`:** Die Arbeit von Ben Daglish und Anthony Lees wird anhand der einzelnen STIL-Credits dargestellt; strittige Detailfragen werden nicht glattgezogen.
- **`Turrican.sid`:** Der C64-Score wird nicht allein Chris Hülsbeck zugeschrieben. Die Museumsfassung folgt den einzelnen Credits und verweist zusätzlich auf Michael Hendriks in STIL.
- **Jeroen-Tel-Bestand:** Die früheren Aliasse von Supremacy, RoboCop 3 und Myth auf den Cybernoid-II-Text wurden durch individuelle Einträge ersetzt.
- **Generische Fallbacks:** Sämtliche 50 Titel besitzen nun eigene Historien- und Datei-/Replay-Abschnitte. Nicht belegte Interrupt-Zahlen, angebliche Wellenformen und werbliche Emulationsversprechen wurden entfernt.

## Songlength-Zuordnung

Für 43 Bestands- und Neu-Dateien erfolgt die Zuordnung direkt über den MD5 der ausgelieferten Bytes zu `Songlengths.md5`. Bei sieben abweichenden Bestands-Rips wurde der eindeutig zugeordnete HVSC-Titelpfad verwendet, ohne die lokalen Dateien zu ersetzen:

- `Wizball.sid`
- `Bionic_Commando.sid`
- `Last_Ninja.sid`
- `Rambo_First_Blood_Part_II.sid`
- `Way_of_the_Tiger.sid`
- `Compilation_I.sid`
- `Compilation_II.sid` (inhaltlich Compilation III)

Die aktuelle HVSC-Fassung von Rambo führt 24 Längen, der lokale Header dagegen 23 Subsongs. Für den Bestands-Rip werden nur die ersten 23 Längen verwendet; diese Abweichung ist auch im Kommentar der Songlength-Datei und im Museumstext vermerkt. Für alle Neuzugänge stimmt die Anzahl der Songlängen exakt mit der Subsongzahl des lokalen Headers überein.
