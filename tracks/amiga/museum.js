// Recherchierte Museumstexte für die vollständige Amiga-Playlist.
// Historische Angaben, lokale Binärbefunde und Wiedergabetechnik sind getrennt.
// Öffentliche Archivverfügbarkeit bedeutet nicht Public Domain.

export const amigaMuseumMetadata = {
    "ELYSIUM.MOD": `
        <h3>[ MUSEUM: JESTER / SANITY — ELYSIUM ]</h3>
        <p><strong>Historie:</strong> <strong>Elysium</strong> ist Jesters Musik zur gleichnamigen Sanity-Demo, veröffentlicht am <strong>28. April 1991</strong>. Die frühere Zuordnung zur Demo <em>Interference</em> und zum Jahr 1992 war falsch. Das Stück gehört zur frühen Phase der Gruppe, bevor spätere Sanity-Produktionen wie <em>Arte</em> erschienen.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler Dateibefund: Vierkanal-MOD mit <strong>29 Orders, 23 Patterns und 16 genutzten Samples</strong>. Der Exact-Pfad spielt das gespeicherte MOD direkt; der anfängliche ProTracker-Befehl <code>E01</code> setzt den LED-Filter korrekt außer Kraft.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://demozoo.org/music/19935/" target="_blank" rel="noopener noreferrer">Demozoo: Elysium</a> · <a href="https://www.pouet.net/prod.php?which=1505" target="_blank" rel="noopener noreferrer">Pouët: Elysium</a> · <a href="https://www.exotica.org.uk/wiki/Sanity" target="_blank" rel="noopener noreferrer">ExoticA: Sanity</a></p>
    `,
    "space_debris.xm": `
        <h3>[ MUSEUM: CAPTAIN / MARKUS KAARLONEN — SPACE DEBRIS ]</h3>
        <p><strong>Historie:</strong> Markus Kaarlonen datiert das Original von <strong>Space Debris auf 1991</strong>. Auf seiner eigenen Website beschreibt er Crossfade-Loops, Akkord-Samples und manuell programmierte Delays – also Kompositions- und Sounddesign-Techniken, nicht bloß eine spätere Remix-Legende.</p>
        <p><strong>Datei &amp; Replay:</strong> Die vorliegende Datei ist <strong>nicht das ursprüngliche Vierkanal-Amiga-MOD</strong>, sondern eine erweiterte XM-Fassung mit <strong>32 Spuren, 58 Orders, 60 Patterns und 45 Samples</strong>. Der XM-Parser und der generische Sequencer sind deshalb der richtige Wiedergabeweg; eine direkte Gleichsetzung mit dem historischen Amiga-Replay wäre falsch.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://markuskaarlonen.com/space-debris" target="_blank" rel="noopener noreferrer">Markus Kaarlonen: Space Debris</a></p>
    `,
    "GSLINGER.MOD": `
        <h3>[ MUSEUM: JOGEIR LILJEDAHL — GUITAR SLINGER ]</h3>
        <p><strong>Historie:</strong> <strong>Guitar Slinger</strong> gewann den Musikwettbewerb der <strong>Rendezvous 1993</strong>. Im Modul selbst steht <code>(c) 1992/93 noiseless</code>; diese beiden Angaben erklären, warum eine pauschale Datierung auf 1994 irreführend war.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler Dateibefund: Vierkanal-MOD mit <strong>41 Orders, 41 Patterns und 31 genutzten Samples</strong> sowie 406.354 Bytes. Die Gitarrenillusion entsteht aus gesampeltem Material und Arrangement auf vier Paula-Kanälen – nicht aus einem Synthesizer mit mehreren Dutzend Hardwarestimmen.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://janeway.exotica.org.uk/release.php?id=47991" target="_blank" rel="noopener noreferrer">Janeway/ExoticA: Guitar Slinger</a></p>
    `,
    "agony_intro.mod": `
        <h3>[ MUSEUM: TIM WRIGHT — AGONY INTRO ]</h3>
        <p><strong>Historie:</strong> Das Titelstück zu <strong>Agony</strong> stammt von <strong>Tim Wright</strong>, nicht von Jochen Hippel. Franck Sauer berichtet, dass er Pianosamples ersetzte; außerdem musste eine Note wegen der Amiga-Periodengrenze um eine Oktave versetzt werden. Das Modul trägt die Notiz <code>written 16/09/91</code>.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler Dateibefund: Vierkanal-MOD mit <strong>41 Orders, 17 Patterns und vier genutzten Samples</strong>. Gerade die kleine Samplezahl macht die Datei zu einem aufschlussreichen Beispiel für Arrangement, Samplewahl und Paulas beschränkten Periodenbereich.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://www.francksauer.com/index.php/games?view=article&amp;id=10:agony&amp;catid=15:published-games" target="_blank" rel="noopener noreferrer">Franck Sauer: Agony</a></p>
    `,
    "turrican_2_title.xm": `
        <h3>[ MUSEUM: CHRIS HÜLSBECK — TURRICAN II TITLE ]</h3>
        <p><strong>Historie:</strong> <strong>Turrican II: The Final Fight</strong> erschien 1991 mit Musik von <strong>Chris Hülsbeck</strong>. Das Amiga-Original verwendet sein TFMX-System; die sieben logischen Stimmen des Originals sind ein Replay-Konzept und keine sieben zusätzlichen Paula-DMA-Kanäle.</p>
        <p><strong>Datei &amp; Replay:</strong> Die lokale Datei ist eine <strong>16-Spur-XM-Konversion</strong> mit 86 Orders, 73 Patterns und zwölf Samples – nicht die originale TFMX-Datei. Sie dokumentiert eine spätere Tracker-Bearbeitung und wird entsprechend über den XM-Sequencer wiedergegeben.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://www.exotica.org.uk/wiki/Turrican_II_-_The_Final_Fight" target="_blank" rel="noopener noreferrer">ExoticA: Turrican II</a></p>
    `,
    "dragonflight/dragonflight_titletune.HIPC": `
        <h3>[ MUSEUM: DRAGONFLIGHT — TITLETUNE ]</h3>
        <p><strong>Historie:</strong> Das Titelthema eröffnet Thalions Rollenspiel <strong>Dragonflight</strong> (Amiga, 1990) mit Musik von <strong>Jochen Hippel</strong>. Es ist der umfangreichste Einzel-Song dieser lokalen Suite.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler COSO-/HIPC-Befund: <strong>13 Instrumente, 23 Timbres, 94 Monopatterns, 170 Divisions und 1 Song</strong>. Die Datei referenziert 10 Samples mit zusammen 177.402 PCM-Bytes. Die Wiedergabe erfolgt über Hippels COSO-Interpreter mit PAL-CIA-Timing; Instrumente, Timbres und Songs sind getrennte Ebenen des Formats.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://amiga.abime.net/412" target="_blank" rel="noopener noreferrer">Hall of Light: Dragonflight</a></p>
    `,
    "dragonflight/dragonflight_surface.HIPC": `
        <h3>[ MUSEUM: DRAGONFLIGHT — SURFACE ]</h3>
        <p><strong>Historie:</strong> Die Surface-Datei gehört zur Musik für die Oberwelt von <strong>Dragonflight</strong>. Wie die übrigen HIPC-Dateien stammt sie aus Jochen Hippels Thalion-Kontext, nicht aus einem generischen ProTracker-Modul.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler COSO-/HIPC-Befund: <strong>16 Instrumente, 19 Timbres, 64 Monopatterns, 158 Divisions und 4 Songs</strong>. Die Datei referenziert 32 Samples mit zusammen 7.546 PCM-Bytes. Die Wiedergabe erfolgt über Hippels COSO-Interpreter mit PAL-CIA-Timing; Instrumente, Timbres und Songs sind getrennte Ebenen des Formats.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://amiga.abime.net/412" target="_blank" rel="noopener noreferrer">Hall of Light: Dragonflight</a></p>
    `,
    "dragonflight/dragonflight_town.HIPC": `
        <h3>[ MUSEUM: DRAGONFLIGHT — TOWN ]</h3>
        <p><strong>Historie:</strong> Town ist die Städte-Musik aus <strong>Dragonflight</strong> (Thalion, 1990). Der Dateiname liefert die Szenenzuordnung; weitergehende Handlungsbehauptungen wären ohne Spielbeleg Spekulation.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler COSO-/HIPC-Befund: <strong>13 Instrumente, 20 Timbres, 40 Monopatterns, 116 Divisions und 3 Songs</strong>. Die Datei referenziert 28 Samples mit zusammen 724 PCM-Bytes. Die Wiedergabe erfolgt über Hippels COSO-Interpreter mit PAL-CIA-Timing; Instrumente, Timbres und Songs sind getrennte Ebenen des Formats.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://amiga.abime.net/412" target="_blank" rel="noopener noreferrer">Hall of Light: Dragonflight</a></p>
    `,
    "dragonflight/dragonflight_dungeon.HIPC": `
        <h3>[ MUSEUM: DRAGONFLIGHT — DUNGEON ]</h3>
        <p><strong>Historie:</strong> Dungeon ist die für die unterirdischen Bereiche archivierte Musik aus <strong>Dragonflight</strong>. Mit sieben Songs in einer Datei zeigt sie besonders deutlich, dass HIPC mehrere aufrufbare Sequenzen bündeln kann.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler COSO-/HIPC-Befund: <strong>21 Instrumente, 27 Timbres, 133 Monopatterns, 238 Divisions und 7 Songs</strong>. Die Datei referenziert 29 Samples mit zusammen 992 PCM-Bytes. Die Wiedergabe erfolgt über Hippels COSO-Interpreter mit PAL-CIA-Timing; Instrumente, Timbres und Songs sind getrennte Ebenen des Formats.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://amiga.abime.net/412" target="_blank" rel="noopener noreferrer">Hall of Light: Dragonflight</a></p>
    `,
    "dragonflight/dragonflight_endsequence.HIPC": `
        <h3>[ MUSEUM: DRAGONFLIGHT — ENDSEQUENCE ]</h3>
        <p><strong>Historie:</strong> Die Endsequence-Datei enthält Musik für den Abschluss von <strong>Dragonflight</strong>. Sie bleibt als eigener Bestandteil der siebenteiligen lokalen Suite erhalten.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler COSO-/HIPC-Befund: <strong>12 Instrumente, 20 Timbres, 75 Monopatterns, 156 Divisions und 3 Songs</strong>. Die Datei referenziert 29 Samples mit zusammen 992 PCM-Bytes. Die Wiedergabe erfolgt über Hippels COSO-Interpreter mit PAL-CIA-Timing; Instrumente, Timbres und Songs sind getrennte Ebenen des Formats.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://amiga.abime.net/412" target="_blank" rel="noopener noreferrer">Hall of Light: Dragonflight</a></p>
    `,
    "dragonflight/dragonflight_ani.HIPC": `
        <h3>[ MUSEUM: DRAGONFLIGHT — ANI ]</h3>
        <p><strong>Historie:</strong> Ani ist die der Animations- beziehungsweise Intro-Sequenz zugeordnete Musikdatei aus <strong>Dragonflight</strong>. Die archivierte Bezeichnung wird hier bewusst nicht zu einer genaueren Filmszenenbeschreibung ausgeschmückt.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler COSO-/HIPC-Befund: <strong>8 Instrumente, 9 Timbres, 27 Monopatterns, 45 Divisions und 2 Songs</strong>. Die Datei referenziert 29 Samples mit zusammen 850 PCM-Bytes. Die Wiedergabe erfolgt über Hippels COSO-Interpreter mit PAL-CIA-Timing; Instrumente, Timbres und Songs sind getrennte Ebenen des Formats.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://amiga.abime.net/412" target="_blank" rel="noopener noreferrer">Hall of Light: Dragonflight</a></p>
    `,
    "dragonflight/dragonflight_always.HIPC": `
        <h3>[ MUSEUM: DRAGONFLIGHT — ALWAYS ]</h3>
        <p><strong>Historie:</strong> Always ergänzt die <strong>Dragonflight</strong>-Suite um fünf Songs. Der Titel ist als Dateiname dokumentiert; eine bestimmte narrative Funktion lässt sich daraus allein nicht sicher ableiten.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler COSO-/HIPC-Befund: <strong>12 Instrumente, 16 Timbres, 101 Monopatterns, 136 Divisions und 5 Songs</strong>. Die Datei referenziert 44 Samples mit zusammen 4.078 PCM-Bytes. Die Wiedergabe erfolgt über Hippels COSO-Interpreter mit PAL-CIA-Timing; Instrumente, Timbres und Songs sind getrennte Ebenen des Formats.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://amiga.abime.net/412" target="_blank" rel="noopener noreferrer">Hall of Light: Dragonflight</a></p>
    `,
    "amberstar/City_Walk.hipc": `
        <h3>[ MUSEUM: JOCHEN HIPPEL — AMBERSTAR / CITY WALK ]</h3>
        <p><strong>Historie:</strong> <strong>City Walk</strong> ist Teil der Musik zu Thalions Rollenspiel <strong>Amberstar</strong>, komponiert von <strong>Jochen Hippel</strong>. Der Titel gehört zur Stadtseite des Rollenspiel-Soundtracks; die konkrete Dateibezeichnung ist erhalten. Die kuratorische Einordnung trennt diese Titelinformation von den folgenden Parserbefunden.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler COSO-/HIPC-Befund: 8 Instrumente, 13 Timbres, <strong>34 Monopatterns</strong>, <strong>38 Divisions</strong>. Der Header führt 10 Sample-Einträge. Alle Amberstar-Stücke greifen auf die gemeinsame Samplebank <code>hipc.samp</code> mit 57.576 PCM-Bytes zu; der Replay läuft über den COSO-Interpreter mit <code>envSpec</code>.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://www.exotica.org.uk/wiki/Amberstar" target="_blank" rel="noopener noreferrer">ExoticA: Amberstar</a> · <a href="https://amiga.abime.net/3257" target="_blank" rel="noopener noreferrer">Hall of Light: Amberstar</a></p>
    `,
    "amberstar/Dreamcave.hipc": `
        <h3>[ MUSEUM: JOCHEN HIPPEL — AMBERSTAR / DREAMCAVE ]</h3>
        <p><strong>Historie:</strong> <strong>Dreamcave</strong> ist Teil der Musik zu Thalions Rollenspiel <strong>Amberstar</strong>, komponiert von <strong>Jochen Hippel</strong>. Dreamcave verbindet die Höhlenumgebung mit einem ausdrücklich träumerisch benannten musikalischen Baustein. Die kuratorische Einordnung trennt diese Titelinformation von den folgenden Parserbefunden.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler COSO-/HIPC-Befund: 6 Instrumente, 7 Timbres, <strong>14 Monopatterns</strong>, <strong>60 Divisions</strong>. Der Header führt 6 Sample-Einträge. Alle Amberstar-Stücke greifen auf die gemeinsame Samplebank <code>hipc.samp</code> mit 57.576 PCM-Bytes zu; der Replay läuft über den COSO-Interpreter mit <code>envSpec</code>.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://www.exotica.org.uk/wiki/Amberstar" target="_blank" rel="noopener noreferrer">ExoticA: Amberstar</a> · <a href="https://amiga.abime.net/3257" target="_blank" rel="noopener noreferrer">Hall of Light: Amberstar</a></p>
    `,
    "amberstar/Eriks_Revenge.hipc": `
        <h3>[ MUSEUM: JOCHEN HIPPEL — AMBERSTAR / ERIKS REVENGE ]</h3>
        <p><strong>Historie:</strong> <strong>Eriks Revenge</strong> ist Teil der Musik zu Thalions Rollenspiel <strong>Amberstar</strong>, komponiert von <strong>Jochen Hippel</strong>. Der eigenwillige Titel ist Teil der archivierten Amberstar-Musiksammlung; eine Deutung des Namens bleibt bewusst offen. Die kuratorische Einordnung trennt diese Titelinformation von den folgenden Parserbefunden.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler COSO-/HIPC-Befund: 9 Instrumente, 17 Timbres, <strong>50 Monopatterns</strong>, <strong>41 Divisions</strong>. Alle Amberstar-Stücke greifen auf die gemeinsame Samplebank <code>hipc.samp</code> mit 57.576 PCM-Bytes zu; der Replay läuft über den COSO-Interpreter mit <code>envSpec</code>.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://www.exotica.org.uk/wiki/Amberstar" target="_blank" rel="noopener noreferrer">ExoticA: Amberstar</a> · <a href="https://amiga.abime.net/3257" target="_blank" rel="noopener noreferrer">Hall of Light: Amberstar</a></p>
    `,
    "amberstar/Fanfares.hipc": `
        <h3>[ MUSEUM: JOCHEN HIPPEL — AMBERSTAR / FANFARES ]</h3>
        <p><strong>Historie:</strong> <strong>Fanfares</strong> ist Teil der Musik zu Thalions Rollenspiel <strong>Amberstar</strong>, komponiert von <strong>Jochen Hippel</strong>. Fanfares bündelt ein längeres Sequenzmaterial und nicht nur einen isolierten Signalton. Die kuratorische Einordnung trennt diese Titelinformation von den folgenden Parserbefunden.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler COSO-/HIPC-Befund: 11 Instrumente, 19 Timbres, <strong>45 Monopatterns</strong>, <strong>63 Divisions</strong>. Der Header führt 12 Sample-Einträge. Alle Amberstar-Stücke greifen auf die gemeinsame Samplebank <code>hipc.samp</code> mit 57.576 PCM-Bytes zu; der Replay läuft über den COSO-Interpreter mit <code>envSpec</code>.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://www.exotica.org.uk/wiki/Amberstar" target="_blank" rel="noopener noreferrer">ExoticA: Amberstar</a> · <a href="https://amiga.abime.net/3257" target="_blank" rel="noopener noreferrer">Hall of Light: Amberstar</a></p>
    `,
    "amberstar/Flying_High.hipc": `
        <h3>[ MUSEUM: JOCHEN HIPPEL — AMBERSTAR / FLYING HIGH ]</h3>
        <p><strong>Historie:</strong> <strong>Flying High</strong> ist Teil der Musik zu Thalions Rollenspiel <strong>Amberstar</strong>, komponiert von <strong>Jochen Hippel</strong>. Flying High ergänzt die Suite um einen Titel, dessen Name einen klaren Gegenpol zu Dungeon und Horror bildet. Die kuratorische Einordnung trennt diese Titelinformation von den folgenden Parserbefunden.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler COSO-/HIPC-Befund: 8 Instrumente, 12 Timbres, <strong>26 Monopatterns</strong>, <strong>64 Divisions</strong>. Der Header führt 10 Sample-Einträge. Alle Amberstar-Stücke greifen auf die gemeinsame Samplebank <code>hipc.samp</code> mit 57.576 PCM-Bytes zu; der Replay läuft über den COSO-Interpreter mit <code>envSpec</code>.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://www.exotica.org.uk/wiki/Amberstar" target="_blank" rel="noopener noreferrer">ExoticA: Amberstar</a> · <a href="https://amiga.abime.net/3257" target="_blank" rel="noopener noreferrer">Hall of Light: Amberstar</a></p>
    `,
    "amberstar/Funkey_Dungeon.hipc": `
        <h3>[ MUSEUM: JOCHEN HIPPEL — AMBERSTAR / FUNKEY DUNGEON ]</h3>
        <p><strong>Historie:</strong> <strong>Funkey Dungeon</strong> ist Teil der Musik zu Thalions Rollenspiel <strong>Amberstar</strong>, komponiert von <strong>Jochen Hippel</strong>. Die Schreibweise <em>Funkey</em> steht so im Dateinamen und wird nicht stillschweigend zu <em>Funky</em> normalisiert. Die kuratorische Einordnung trennt diese Titelinformation von den folgenden Parserbefunden.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler COSO-/HIPC-Befund: 6 Instrumente, 11 Timbres, <strong>43 Monopatterns</strong>, <strong>64 Divisions</strong>. Der Header führt 7 Sample-Einträge. Alle Amberstar-Stücke greifen auf die gemeinsame Samplebank <code>hipc.samp</code> mit 57.576 PCM-Bytes zu; der Replay läuft über den COSO-Interpreter mit <code>envSpec</code>.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://www.exotica.org.uk/wiki/Amberstar" target="_blank" rel="noopener noreferrer">ExoticA: Amberstar</a> · <a href="https://amiga.abime.net/3257" target="_blank" rel="noopener noreferrer">Hall of Light: Amberstar</a></p>
    `,
    "amberstar/Gwens_Lament.hipc": `
        <h3>[ MUSEUM: JOCHEN HIPPEL — AMBERSTAR / GWENS LAMENT ]</h3>
        <p><strong>Historie:</strong> <strong>Gwens Lament</strong> ist Teil der Musik zu Thalions Rollenspiel <strong>Amberstar</strong>, komponiert von <strong>Jochen Hippel</strong>. Gwens Lament ist eine der beiden längsten Dateien nach Divisions und trägt einen ausdrücklich erzählerischen Titel. Die kuratorische Einordnung trennt diese Titelinformation von den folgenden Parserbefunden.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler COSO-/HIPC-Befund: 9 Instrumente, 16 Timbres, <strong>52 Monopatterns</strong>, <strong>68 Divisions</strong>. Der Header führt 12 Sample-Einträge. Alle Amberstar-Stücke greifen auf die gemeinsame Samplebank <code>hipc.samp</code> mit 57.576 PCM-Bytes zu; der Replay läuft über den COSO-Interpreter mit <code>envSpec</code>.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://www.exotica.org.uk/wiki/Amberstar" target="_blank" rel="noopener noreferrer">ExoticA: Amberstar</a> · <a href="https://amiga.abime.net/3257" target="_blank" rel="noopener noreferrer">Hall of Light: Amberstar</a></p>
    `,
    "amberstar/Hasta_La_Vista.hipc": `
        <h3>[ MUSEUM: JOCHEN HIPPEL — AMBERSTAR / HASTA LA VISTA ]</h3>
        <p><strong>Historie:</strong> <strong>Hasta La Vista</strong> ist Teil der Musik zu Thalions Rollenspiel <strong>Amberstar</strong>, komponiert von <strong>Jochen Hippel</strong>. Der umgangssprachliche Abschiedsgruß ist als Originaltitel erhalten und hebt sich von den Fantasy-Namen der Suite ab. Die kuratorische Einordnung trennt diese Titelinformation von den folgenden Parserbefunden.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler COSO-/HIPC-Befund: 9 Instrumente, 15 Timbres, <strong>24 Monopatterns</strong>, <strong>59 Divisions</strong>. Der Header führt 7 Sample-Einträge. Alle Amberstar-Stücke greifen auf die gemeinsame Samplebank <code>hipc.samp</code> mit 57.576 PCM-Bytes zu; der Replay läuft über den COSO-Interpreter mit <code>envSpec</code>.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://www.exotica.org.uk/wiki/Amberstar" target="_blank" rel="noopener noreferrer">ExoticA: Amberstar</a> · <a href="https://amiga.abime.net/3257" target="_blank" rel="noopener noreferrer">Hall of Light: Amberstar</a></p>
    `,
    "amberstar/High_Seas.hipc": `
        <h3>[ MUSEUM: JOCHEN HIPPEL — AMBERSTAR / HIGH SEAS ]</h3>
        <p><strong>Historie:</strong> <strong>High Seas</strong> ist Teil der Musik zu Thalions Rollenspiel <strong>Amberstar</strong>, komponiert von <strong>Jochen Hippel</strong>. High Seas gehört zur Reise- und Seefahrtseite des Soundtracks; die lokale Struktur ist trotz weniger Divisions klanglich breit angelegt. Die kuratorische Einordnung trennt diese Titelinformation von den folgenden Parserbefunden.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler COSO-/HIPC-Befund: 13 Instrumente, 13 Timbres, <strong>26 Monopatterns, 36 Divisions</strong>. Der Header führt 12 Sample-Einträge. Alle Amberstar-Stücke greifen auf die gemeinsame Samplebank <code>hipc.samp</code> mit 57.576 PCM-Bytes zu; der Replay läuft über den COSO-Interpreter mit <code>envSpec</code>.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://www.exotica.org.uk/wiki/Amberstar" target="_blank" rel="noopener noreferrer">ExoticA: Amberstar</a> · <a href="https://amiga.abime.net/3257" target="_blank" rel="noopener noreferrer">Hall of Light: Amberstar</a></p>
    `,
    "amberstar/Horse_Song.hipc": `
        <h3>[ MUSEUM: JOCHEN HIPPEL — AMBERSTAR / HORSE SONG ]</h3>
        <p><strong>Historie:</strong> <strong>Horse Song</strong> ist Teil der Musik zu Thalions Rollenspiel <strong>Amberstar</strong>, komponiert von <strong>Jochen Hippel</strong>. Horse Song nutzt vergleichsweise wenige Pattern über viele Divisions und zeigt damit die Wiederverwendung musikalischer Bausteine. Die kuratorische Einordnung trennt diese Titelinformation von den folgenden Parserbefunden.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler COSO-/HIPC-Befund: 8 Instrumente, 13 Timbres, <strong>23 Monopatterns</strong>, <strong>66 Divisions</strong>. Der Header führt 10 Sample-Einträge. Alle Amberstar-Stücke greifen auf die gemeinsame Samplebank <code>hipc.samp</code> mit 57.576 PCM-Bytes zu; der Replay läuft über den COSO-Interpreter mit <code>envSpec</code>.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://www.exotica.org.uk/wiki/Amberstar" target="_blank" rel="noopener noreferrer">ExoticA: Amberstar</a> · <a href="https://amiga.abime.net/3257" target="_blank" rel="noopener noreferrer">Hall of Light: Amberstar</a></p>
    `,
    "amberstar/Irish_Spring.hipc": `
        <h3>[ MUSEUM: JOCHEN HIPPEL — AMBERSTAR / IRISH SPRING ]</h3>
        <p><strong>Historie:</strong> <strong>Irish Spring</strong> ist Teil der Musik zu Thalions Rollenspiel <strong>Amberstar</strong>, komponiert von <strong>Jochen Hippel</strong>. Irish Spring teilt mit Gwens Lament die höchste Divisionszahl dieses Sets, verwendet aber eine andere Patternbibliothek. Die kuratorische Einordnung trennt diese Titelinformation von den folgenden Parserbefunden.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler COSO-/HIPC-Befund: 8 Instrumente, 13 Timbres, <strong>41 Monopatterns</strong>, <strong>68 Divisions</strong>. Der Header führt 12 Sample-Einträge. Alle Amberstar-Stücke greifen auf die gemeinsame Samplebank <code>hipc.samp</code> mit 57.576 PCM-Bytes zu; der Replay läuft über den COSO-Interpreter mit <code>envSpec</code>.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://www.exotica.org.uk/wiki/Amberstar" target="_blank" rel="noopener noreferrer">ExoticA: Amberstar</a> · <a href="https://amiga.abime.net/3257" target="_blank" rel="noopener noreferrer">Hall of Light: Amberstar</a></p>
    `,
    "amberstar/Lullaby.hipc": `
        <h3>[ MUSEUM: JOCHEN HIPPEL — AMBERSTAR / LULLABY ]</h3>
        <p><strong>Historie:</strong> <strong>Lullaby</strong> ist Teil der Musik zu Thalions Rollenspiel <strong>Amberstar</strong>, komponiert von <strong>Jochen Hippel</strong>. Lullaby besitzt zusammen mit Travellers Tune die größte Instrumenten- und Timbrezahl der lokalen Amberstar-Dateien. Die kuratorische Einordnung trennt diese Titelinformation von den folgenden Parserbefunden.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler COSO-/HIPC-Befund: 17 Instrumente, 17 Timbres, <strong>47 Monopatterns</strong>, <strong>40 Divisions</strong>. Der Header führt 9 Sample-Einträge. Alle Amberstar-Stücke greifen auf die gemeinsame Samplebank <code>hipc.samp</code> mit 57.576 PCM-Bytes zu; der Replay läuft über den COSO-Interpreter mit <code>envSpec</code>.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://www.exotica.org.uk/wiki/Amberstar" target="_blank" rel="noopener noreferrer">ExoticA: Amberstar</a> · <a href="https://amiga.abime.net/3257" target="_blank" rel="noopener noreferrer">Hall of Light: Amberstar</a></p>
    `,
    "amberstar/Lurking_Horror.hipc": `
        <h3>[ MUSEUM: JOCHEN HIPPEL — AMBERSTAR / LURKING HORROR ]</h3>
        <p><strong>Historie:</strong> <strong>Lurking Horror</strong> ist Teil der Musik zu Thalions Rollenspiel <strong>Amberstar</strong>, komponiert von <strong>Jochen Hippel</strong>. Lurking Horror ist der bedrohliche Gegenpol zu Stadt-, Reise- und Wiegenliedtiteln der Sammlung. Die kuratorische Einordnung trennt diese Titelinformation von den folgenden Parserbefunden.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler COSO-/HIPC-Befund: 8 Instrumente, 12 Timbres, <strong>26 Monopatterns</strong>, <strong>52 Divisions</strong>. Der Header führt 7 Sample-Einträge. Alle Amberstar-Stücke greifen auf die gemeinsame Samplebank <code>hipc.samp</code> mit 57.576 PCM-Bytes zu; der Replay läuft über den COSO-Interpreter mit <code>envSpec</code>.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://www.exotica.org.uk/wiki/Amberstar" target="_blank" rel="noopener noreferrer">ExoticA: Amberstar</a> · <a href="https://amiga.abime.net/3257" target="_blank" rel="noopener noreferrer">Hall of Light: Amberstar</a></p>
    `,
    "amberstar/Minor_Quarrels.hipc": `
        <h3>[ MUSEUM: JOCHEN HIPPEL — AMBERSTAR / MINOR QUARRELS ]</h3>
        <p><strong>Historie:</strong> <strong>Minor Quarrels</strong> ist Teil der Musik zu Thalions Rollenspiel <strong>Amberstar</strong>, komponiert von <strong>Jochen Hippel</strong>. Mit 113 Divisions ist Minor Quarrels die längste Sequenz der neunzehn lokalen Amberstar-Module. Die kuratorische Einordnung trennt diese Titelinformation von den folgenden Parserbefunden.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler COSO-/HIPC-Befund: 10 Instrumente, 19 Timbres, <strong>65 Monopatterns</strong>, <strong>113 Divisions</strong>. Der Header führt 9 Sample-Einträge. Alle Amberstar-Stücke greifen auf die gemeinsame Samplebank <code>hipc.samp</code> mit 57.576 PCM-Bytes zu; der Replay läuft über den COSO-Interpreter mit <code>envSpec</code>.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://www.exotica.org.uk/wiki/Amberstar" target="_blank" rel="noopener noreferrer">ExoticA: Amberstar</a> · <a href="https://amiga.abime.net/3257" target="_blank" rel="noopener noreferrer">Hall of Light: Amberstar</a></p>
    `,
    "amberstar/Misty_Orc_Hop.hipc": `
        <h3>[ MUSEUM: JOCHEN HIPPEL — AMBERSTAR / MISTY ORC HOP ]</h3>
        <p><strong>Historie:</strong> <strong>Misty Orc Hop</strong> ist Teil der Musik zu Thalions Rollenspiel <strong>Amberstar</strong>, komponiert von <strong>Jochen Hippel</strong>. Misty Orc Hop verbindet einen Fantasy-Titel mit einer kleinen, ökonomischen Instrumenten- und Timbrepalette. Die kuratorische Einordnung trennt diese Titelinformation von den folgenden Parserbefunden.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler COSO-/HIPC-Befund: 6 Instrumente, 7 Timbres, <strong>39 Monopatterns</strong>, <strong>49 Divisions</strong>. Der Header führt 7 Sample-Einträge. Alle Amberstar-Stücke greifen auf die gemeinsame Samplebank <code>hipc.samp</code> mit 57.576 PCM-Bytes zu; der Replay läuft über den COSO-Interpreter mit <code>envSpec</code>.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://www.exotica.org.uk/wiki/Amberstar" target="_blank" rel="noopener noreferrer">ExoticA: Amberstar</a> · <a href="https://amiga.abime.net/3257" target="_blank" rel="noopener noreferrer">Hall of Light: Amberstar</a></p>
    `,
    "amberstar/Mystic_Moments.hipc": `
        <h3>[ MUSEUM: JOCHEN HIPPEL — AMBERSTAR / MYSTIC MOMENTS ]</h3>
        <p><strong>Historie:</strong> <strong>Mystic Moments</strong> ist Teil der Musik zu Thalions Rollenspiel <strong>Amberstar</strong>, komponiert von <strong>Jochen Hippel</strong>. Mystic Moments gehört zu den atmosphärisch benannten Bausteinen der Suite; mehr lässt der Dateiname nicht zuverlässig erschließen. Die kuratorische Einordnung trennt diese Titelinformation von den folgenden Parserbefunden.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler COSO-/HIPC-Befund: 7 Instrumente, 12 Timbres, <strong>31 Monopatterns</strong>, <strong>42 Divisions</strong>. Der Header führt 7 Sample-Einträge. Alle Amberstar-Stücke greifen auf die gemeinsame Samplebank <code>hipc.samp</code> mit 57.576 PCM-Bytes zu; der Replay läuft über den COSO-Interpreter mit <code>envSpec</code>.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://www.exotica.org.uk/wiki/Amberstar" target="_blank" rel="noopener noreferrer">ExoticA: Amberstar</a> · <a href="https://amiga.abime.net/3257" target="_blank" rel="noopener noreferrer">Hall of Light: Amberstar</a></p>
    `,
    "amberstar/Ode_To_Schnism.hipc": `
        <h3>[ MUSEUM: JOCHEN HIPPEL — AMBERSTAR / ODE TO SCHNISM ]</h3>
        <p><strong>Historie:</strong> <strong>Ode To Schnism</strong> ist Teil der Musik zu Thalions Rollenspiel <strong>Amberstar</strong>, komponiert von <strong>Jochen Hippel</strong>. Die Bedeutung von <em>Schnism</em> ist aus den lokalen Dateidaten nicht belegbar und wird deshalb nicht interpretiert. Die kuratorische Einordnung trennt diese Titelinformation von den folgenden Parserbefunden.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler COSO-/HIPC-Befund: 12 Instrumente, 19 Timbres, <strong>46 Monopatterns</strong>, <strong>45 Divisions</strong>. Der Header führt 12 Sample-Einträge. Alle Amberstar-Stücke greifen auf die gemeinsame Samplebank <code>hipc.samp</code> mit 57.576 PCM-Bytes zu; der Replay läuft über den COSO-Interpreter mit <code>envSpec</code>.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://www.exotica.org.uk/wiki/Amberstar" target="_blank" rel="noopener noreferrer">ExoticA: Amberstar</a> · <a href="https://amiga.abime.net/3257" target="_blank" rel="noopener noreferrer">Hall of Light: Amberstar</a></p>
    `,
    "amberstar/Travellers_Tune.hipc": `
        <h3>[ MUSEUM: JOCHEN HIPPEL — AMBERSTAR / TRAVELLERS TUNE ]</h3>
        <p><strong>Historie:</strong> <strong>Travellers Tune</strong> ist Teil der Musik zu Thalions Rollenspiel <strong>Amberstar</strong>, komponiert von <strong>Jochen Hippel</strong>. Travellers Tune erreicht mit nur 19 Monopatterns 44 Divisions und kombiniert diese Ökonomie mit 17 Instrumenten und Timbres. Die kuratorische Einordnung trennt diese Titelinformation von den folgenden Parserbefunden.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler COSO-/HIPC-Befund: 17 Instrumente, 17 Timbres, <strong>19 Monopatterns</strong>, <strong>44 Divisions</strong>. Der Header führt 9 Sample-Einträge. Alle Amberstar-Stücke greifen auf die gemeinsame Samplebank <code>hipc.samp</code> mit 57.576 PCM-Bytes zu; der Replay läuft über den COSO-Interpreter mit <code>envSpec</code>.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://www.exotica.org.uk/wiki/Amberstar" target="_blank" rel="noopener noreferrer">ExoticA: Amberstar</a> · <a href="https://amiga.abime.net/3257" target="_blank" rel="noopener noreferrer">Hall of Light: Amberstar</a></p>
    `,
    "amberstar/Ingame.hipc": `
        <h3>[ MUSEUM: JOCHEN HIPPEL — AMBERSTAR / INGAME ]</h3>
        <p><strong>Historie:</strong> <strong>Ingame</strong> ist Teil der Musik zu Thalions Rollenspiel <strong>Amberstar</strong>, komponiert von <strong>Jochen Hippel</strong>. Der generische Dateiname erlaubt keine konkretere Szenenzuordnung; die kleine Klangpalette ist dagegen messtechnisch eindeutig. Die kuratorische Einordnung trennt diese Titelinformation von den folgenden Parserbefunden.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler COSO-/HIPC-Befund: 5 Instrumente, 7 Timbres, <strong>26 Monopatterns</strong>, <strong>40 Divisions</strong>. Der Header führt 7 Sample-Einträge. Alle Amberstar-Stücke greifen auf die gemeinsame Samplebank <code>hipc.samp</code> mit 57.576 PCM-Bytes zu; der Replay läuft über den COSO-Interpreter mit <code>envSpec</code>.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://www.exotica.org.uk/wiki/Amberstar" target="_blank" rel="noopener noreferrer">ExoticA: Amberstar</a> · <a href="https://amiga.abime.net/3257" target="_blank" rel="noopener noreferrer">Hall of Light: Amberstar</a></p>
    `,
    "wings-of-death/Wings_Of_Death-Title.hip": `
        <h3>[ MUSEUM: JOCHEN HIPPEL — WINGS OF DEATH TITLE ]</h3>
        <p><strong>Historie:</strong> Das Titelstück zu <strong>Wings of Death</strong> (Thalion, Amiga 1990) stammt von <strong>Jochen Hippel</strong>. Es ist Teil seines eigenen HIP-/COSO-Ökosystems und kein ProTracker-MOD. Die frühere pauschale Bezeichnung der gesamten Suite als „7-Voice“ wurde entfernt.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler Dateibefund: <strong>HIP mit originalem 68000-Replaycode</strong>, 39 Instrumente, 48 Timbres, 153 Patterns, 132 Divisions und drei Songs. Der Worklet führt den mitgelieferten 68000-Replay mit Raster-Timing aus; das unterscheidet diese Datei grundlegend von den COSO-Leveln.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://vgmpf.com/Wiki/index.php?title=Wings_of_Death_(AMI)" target="_blank" rel="noopener noreferrer">VGMPF: Wings of Death (Amiga)</a></p>
    `,
    "wings-of-death/Wings_Of_Death-Level_1.hipc": `
        <h3>[ MUSEUM: JOCHEN HIPPEL — WINGS OF DEATH / LEVEL 1 ]</h3>
        <p><strong>Historie:</strong> <strong>Level 1: OVER THE TREES</strong> gehört zu Jochen Hippels Musik für <strong>Wings of Death</strong> (1990). Die Eröffnungsmusik des Shoot ’em ups bleibt als eigenständige Leveldatei erhalten.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler COSO-/HIPC-Befund: <strong>vier Voices</strong>, 22 Instrumente, 12 Timbres, 89 Patterns, 172 Divisions und 2 Songs. Alle sieben Leveldateien referenzieren 34 Samples mit zusammen 13.308 PCM-Bytes. Vier Voices sind hier die im Format sichtbaren logischen Stimmen; daraus wird keine „7-Voice Macro-Engine“ abgeleitet.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://vgmpf.com/Wiki/index.php?title=Wings_of_Death_(AMI)" target="_blank" rel="noopener noreferrer">VGMPF: Wings of Death (Amiga)</a></p>
    `,
    "wings-of-death/Wings_Of_Death-Level_2.hipc": `
        <h3>[ MUSEUM: JOCHEN HIPPEL — WINGS OF DEATH / LEVEL 2 ]</h3>
        <p><strong>Historie:</strong> <strong>Level 2: INSIDE THE CAVE</strong> gehört zu Jochen Hippels Musik für <strong>Wings of Death</strong> (1990). Die Höhlenmusik nutzt ein anderes Pattern- und Instrumentenverhältnis als der erste Level.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler COSO-/HIPC-Befund: <strong>vier Voices</strong>, 15 Instrumente, 16 Timbres, 57 Patterns, 125 Divisions und 1 Song. Alle sieben Leveldateien referenzieren 34 Samples mit zusammen 13.308 PCM-Bytes. Vier Voices sind hier die im Format sichtbaren logischen Stimmen; daraus wird keine „7-Voice Macro-Engine“ abgeleitet.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://vgmpf.com/Wiki/index.php?title=Wings_of_Death_(AMI)" target="_blank" rel="noopener noreferrer">VGMPF: Wings of Death (Amiga)</a></p>
    `,
    "wings-of-death/Wings_Of_Death-Level_3.hipc": `
        <h3>[ MUSEUM: JOCHEN HIPPEL — WINGS OF DEATH / LEVEL 3 ]</h3>
        <p><strong>Historie:</strong> <strong>Level 3: DESERT ROCKS</strong> gehört zu Jochen Hippels Musik für <strong>Wings of Death</strong> (1990). Desert Rocks ist die kompakteste Leveldatei dieser lokalen Suite nach Instrumenten, Timbres und Divisions.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler COSO-/HIPC-Befund: <strong>vier Voices</strong>, 8 Instrumente, 8 Timbres, 25 Patterns, 70 Divisions und 1 Song. Alle sieben Leveldateien referenzieren 34 Samples mit zusammen 13.308 PCM-Bytes. Vier Voices sind hier die im Format sichtbaren logischen Stimmen; daraus wird keine „7-Voice Macro-Engine“ abgeleitet.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://vgmpf.com/Wiki/index.php?title=Wings_of_Death_(AMI)" target="_blank" rel="noopener noreferrer">VGMPF: Wings of Death (Amiga)</a></p>
    `,
    "wings-of-death/Wings_Of_Death-Level_4.hipc": `
        <h3>[ MUSEUM: JOCHEN HIPPEL — WINGS OF DEATH / LEVEL 4 ]</h3>
        <p><strong>Historie:</strong> <strong>Level 4: MECHANICAL CASTLE</strong> gehört zu Jochen Hippels Musik für <strong>Wings of Death</strong> (1990). Mechanical Castle besitzt mit 194 Divisions die längste Sequenz der sieben Leveldateien.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler COSO-/HIPC-Befund: <strong>vier Voices</strong>, 19 Instrumente, 20 Timbres, 71 Patterns, 194 Divisions und 1 Song. Alle sieben Leveldateien referenzieren 34 Samples mit zusammen 13.308 PCM-Bytes. Vier Voices sind hier die im Format sichtbaren logischen Stimmen; daraus wird keine „7-Voice Macro-Engine“ abgeleitet.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://vgmpf.com/Wiki/index.php?title=Wings_of_Death_(AMI)" target="_blank" rel="noopener noreferrer">VGMPF: Wings of Death (Amiga)</a></p>
    `,
    "wings-of-death/Wings_Of_Death-Level_5.hipc": `
        <h3>[ MUSEUM: JOCHEN HIPPEL — WINGS OF DEATH / LEVEL 5 ]</h3>
        <p><strong>Historie:</strong> <strong>Level 5: BIO-HAZARD / ORGANIC</strong> gehört zu Jochen Hippels Musik für <strong>Wings of Death</strong> (1990). Die archivierte Levelbezeichnung wird kuratorisch verwendet; daraus folgt keine Behauptung über zusätzliche Replaystimmen.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler COSO-/HIPC-Befund: <strong>vier Voices</strong>, 11 Instrumente, 12 Timbres, 43 Patterns, 108 Divisions und 1 Song. Alle sieben Leveldateien referenzieren 34 Samples mit zusammen 13.308 PCM-Bytes. Vier Voices sind hier die im Format sichtbaren logischen Stimmen; daraus wird keine „7-Voice Macro-Engine“ abgeleitet.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://vgmpf.com/Wiki/index.php?title=Wings_of_Death_(AMI)" target="_blank" rel="noopener noreferrer">VGMPF: Wings of Death (Amiga)</a></p>
    `,
    "wings-of-death/Wings_Of_Death-Level_6.hipc": `
        <h3>[ MUSEUM: JOCHEN HIPPEL — WINGS OF DEATH / LEVEL 6 ]</h3>
        <p><strong>Historie:</strong> <strong>Level 6: GLACIER / ICE</strong> gehört zu Jochen Hippels Musik für <strong>Wings of Death</strong> (1990). Glacier / Ice zeigt mit zwölf Instrumenten und elf Timbres eine weitere eigenständige Klangkonfiguration.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler COSO-/HIPC-Befund: <strong>vier Voices</strong>, 12 Instrumente, 11 Timbres, 61 Patterns, 164 Divisions und 1 Song. Alle sieben Leveldateien referenzieren 34 Samples mit zusammen 13.308 PCM-Bytes. Vier Voices sind hier die im Format sichtbaren logischen Stimmen; daraus wird keine „7-Voice Macro-Engine“ abgeleitet.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://vgmpf.com/Wiki/index.php?title=Wings_of_Death_(AMI)" target="_blank" rel="noopener noreferrer">VGMPF: Wings of Death (Amiga)</a></p>
    `,
    "wings-of-death/Wings_Of_Death-Level_7.hipc": `
        <h3>[ MUSEUM: JOCHEN HIPPEL — WINGS OF DEATH / LEVEL 7 ]</h3>
        <p><strong>Historie:</strong> <strong>Level 7: VOLCANIC / FIRE</strong> gehört zu Jochen Hippels Musik für <strong>Wings of Death</strong> (1990). Volcanic / Fire schließt die sieben COSO-Leveldateien ab; die Endmusik liegt separat im HIP68K-Format vor.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler COSO-/HIPC-Befund: <strong>vier Voices</strong>, 14 Instrumente, 16 Timbres, 70 Patterns, 137 Divisions und 1 Song. Alle sieben Leveldateien referenzieren 34 Samples mit zusammen 13.308 PCM-Bytes. Vier Voices sind hier die im Format sichtbaren logischen Stimmen; daraus wird keine „7-Voice Macro-Engine“ abgeleitet.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://vgmpf.com/Wiki/index.php?title=Wings_of_Death_(AMI)" target="_blank" rel="noopener noreferrer">VGMPF: Wings of Death (Amiga)</a></p>
    `,
    "wings-of-death/Wings_Of_Death-End.hipc": `
        <h3>[ MUSEUM: JOCHEN HIPPEL — WINGS OF DEATH END ]</h3>
        <p><strong>Historie:</strong> Die Enddatei enthält Abschlussmusik zu <strong>Wings of Death</strong>. Trotz der Endung <code>.hipc</code> belegt der Parserbefund einen anderen Replaytyp als bei den sieben Leveln – ein schönes Beispiel dafür, warum Dateiendung und Inhalt getrennt geprüft werden müssen.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler Dateibefund: <strong>HIP/68000-Replay</strong>, nicht COSO. Enthalten sind zehn Instrumente, 19 Timbres, 49 Patterns, 76 Divisions und zwei Songs. Der Worklet wählt daher wie beim Titel den 68000-Replaypfad mit Raster-Timing.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://vgmpf.com/Wiki/index.php?title=Wings_of_Death_(AMI)" target="_blank" rel="noopener noreferrer">VGMPF: Wings of Death (Amiga)</a></p>
    `,
    "blood_money_title.mod": `
        <h3>[ MUSEUM: RAY NORRISH — BLOOD MONEY TITLE ]</h3>
        <p><strong>Historie:</strong> <strong>Blood Money</strong> wurde von DMA Design entwickelt und 1989 von Psygnosis veröffentlicht. Die Musik wird <strong>Ray Norrish</strong> zugeschrieben; David Whittaker wird für Soundeffekte genannt. Diese Rollentrennung verhindert die sonst naheliegende, aber falsche pauschale Whittaker-Zuschreibung.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler Dateibefund: Vierkanal-MOD mit <strong>31 Orders, 15 Patterns und 15 genutzten Samples</strong>. Die Datei wird als MOD abgespielt; Aussagen über ein anderes ursprüngliches Spiel-Replay werden aus diesem Container nicht abgeleitet.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://www.mobygames.com/game/6173/blood-money/" target="_blank" rel="noopener noreferrer">MobyGames: Blood Money</a></p>
    `,
    "moongazr.mod": `
        <h3>[ MUSEUM: BJØRN LYNNE — MOONGAZR / CUBULUS ]</h3>
        <p><strong>Historie:</strong> <strong>Moongazer</strong> gehört zur Musik des Amiga-Spiels <strong>Cubulus</strong> von Software 2000 (1991). Die Datenbanken führen <strong>Bjørn Lynne</strong> als Musiker; die bisherige isolierte Dateibetrachtung wird damit wieder mit dem Spielkontext verbunden.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler Dateibefund: Vierkanal-MOD mit <strong>59 Orders, 37 Patterns und 17 genutzten Samples</strong>. Der kurze Dateiname <code>moongazr.mod</code> bleibt unverändert, während der Museumstext die historische Zuordnung sichtbar macht.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://www.mobygames.com/game/14567/cubulus/" target="_blank" rel="noopener noreferrer">MobyGames: Cubulus</a> · <a href="https://www.lemonamiga.com/game/cubulus" target="_blank" rel="noopener noreferrer">Lemon Amiga: Cubulus</a> · <a href="https://www.exotica.org.uk/wiki/Cubulus" target="_blank" rel="noopener noreferrer">ExoticA: Cubulus</a></p>
    `,
    "immortal.mod": `
        <h3>[ MUSEUM: GROO / THE BLACK ROBES — TOWARDS IMMORTALITY ]</h3>
        <p><strong>Historie:</strong> <strong>Towards Immortality</strong> von Groo / The Black Robes erreichte beim Musikwettbewerb der <strong>Assembly 1992 den zweiten Platz</strong>. Im Modul ist der <strong>16. Juli 1992</strong> als Fertigstellungsdatum notiert.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler Dateibefund: Vierkanal-MOD mit <strong>40 Orders, 37 Patterns und 19 genutzten Samples</strong>. Die Wettbewerbsangabe beschreibt das historische Ereignis; Orders und Patterns stammen dagegen aus der vorliegenden Datei.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://demozoo.org/music/6410/" target="_blank" rel="noopener noreferrer">Demozoo: Towards Immortality</a> · <a href="https://www.pouet.net/party_results.php?which=7&amp;when=1992" target="_blank" rel="noopener noreferrer">Pouët: Assembly 1992 results</a></p>
    `,
    "lotus2-title.mod": `
        <h3>[ MUSEUM: BARRY LEITCH — LOTUS II TITLE ]</h3>
        <p><strong>Historie:</strong> Der Titel gehört zu <strong>Lotus Turbo Challenge 2</strong> und wird <strong>Barry Leitch</strong> zugeschrieben. Demozoo datiert das Musikstück auf <strong>November 1991</strong>. Der im Modul eingebettete Name lautet schlicht <code>bootup</code>.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler Dateibefund: Vierkanal-MOD mit <strong>22 Orders, 15 Patterns und 13 genutzten Samples</strong>. Eingebetteter Titel, Dateiname und historischer Spieltitel werden bewusst nicht als dasselbe Metadatenfeld behandelt.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://demozoo.org/music/57599/" target="_blank" rel="noopener noreferrer">Demozoo: Lotus II bootup</a></p>
    `,
    "DEADLOCK.XM": `
        <h3>[ MUSEUM: ELWOOD — DEAD LOCK ]</h3>
        <p><strong>Historie:</strong> <strong>Dead Lock</strong> ist ein Titel von <strong>Elwood</strong> aus dem Jahr 1995. Er gehört in dieser Playlist zur erweiterten Tracker-Geschichte, ist aber <strong>kein historisches Vierkanal-Amiga-MOD</strong>.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler Dateibefund: FastTracker-XM mit <strong>24 Spuren, 76 Orders, 59 Patterns und 32 Samples</strong>. Die Datei wird über den XM-Parser wiedergegeben. Ihre Aufnahme erweitert den Blick auf die Trackerkultur der neunziger Jahre, ohne eine Amiga-Herkunft vorzutäuschen.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://en.wikipedia.org/wiki/Module_file" target="_blank" rel="noopener noreferrer">Wikipedia: Module file / Dead Lock</a></p>
    `,
    "classics/games/cannon-fodder.mod": `
        <h3>[ MUSEUM: JON HARE / RICHARD JOSEPH — CANNON FODDER ]</h3>
        <p><strong>Historie:</strong> Jon Hare schrieb <strong>War</strong> für <strong>Cannon Fodder</strong>; Richard Joseph arrangierte das Stück 1993 für das Spiel. Die Samplebezeichnungen der lokalen Datei – etwa <code>War.snd</code>, <code>Brother.snd</code> und <code>DyingInTheSun.snd</code> – machen die Verwendung digitalisierter Sprachfragmente unmittelbar nachvollziehbar.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler Dateibefund: Vierkanal-MOD, Magic <code>M.K.</code>, <strong>30 Orders, 18 Patterns und 13 genutzte Samples</strong>; 248.058 Bytes, davon 228.542 Sampledaten. Die gespeicherten Samplenamen sind Teil des Dokuments; persönliche Kontaktdaten aus Modulen werden nicht in die Museumstexte übernommen. Die Wiedergabe nutzt den MOD-Parser und den linearen Paula-Exact-/A500-Pfad.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://remix64.com/track/war/cannon-fodder-war/" target="_blank" rel="noopener noreferrer">Remix64: Cannon Fodder — War</a></p>
    `,
    "classics/games/chaos-engine-k8.mod": `
        <h3>[ MUSEUM: RICHARD JOSEPH — THE CHAOS ENGINE / K8 ]</h3>
        <p><strong>Historie:</strong> <strong>The Chaos Engine</strong> gehört zu den Bitmap-Brothers-Produktionen mit Musik von <strong>Richard Joseph</strong>. Der lokale Titel <code>k8</code> wird als eigener Dateiname beziehungsweise Modulname geführt, ohne daraus eine nicht belegte alternatives offizielle Trackbezeichnung zu erfinden.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler Dateibefund: Vierkanal-MOD, Magic <code>FLT4</code>, <strong>16 Orders, 18 Patterns und 22 genutzte Samples</strong>; 307.558 Bytes, davon 288.042 Sampledaten. Das Magic <code>FLT4</code> kennzeichnet den unterstützten Vierkanal-Start- oder Split-Layout-Container; die Wiedergabe bleibt eine MOD-Wiedergabe. Die Wiedergabe nutzt den MOD-Parser und den linearen Paula-Exact-/A500-Pfad.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://www.theransomnote.com/music/news/the-bitmap-brothers-remembering-the-music-of-amiga-pioneers/" target="_blank" rel="noopener noreferrer">The Ransom Note: Bitmap Brothers music</a></p>
    `,
    "classics/games/speedball-2-title.mod": `
        <h3>[ MUSEUM: RICHARD JOSEPH / NATION 12 — SPEEDBALL 2 TITLE ]</h3>
        <p><strong>Historie:</strong> Die Titelmusik zu <strong>Speedball 2: Brutal Deluxe</strong> verbindet Richard Joseph mit dem Umfeld von John Foxx beziehungsweise <strong>Nation 12</strong>. Die lokale Datei nennt ausdrücklich <code>#Nation 12</code> und <code>Richard Joseph</code> – ein seltener, direkt im Modul erhaltener Produktionshinweis.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler Dateibefund: Vierkanal-MOD, Magic <code>M.K.</code>, <strong>26 Orders, 19 Patterns und 30 genutzte Samples</strong>; 201.688 Bytes, davon 181.148 Sampledaten. Eingebetteter Titel: <code>SB2_Intro</code>. Die Wiedergabe nutzt den MOD-Parser und den linearen Paula-Exact-/A500-Pfad.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://www.theransomnote.com/music/news/the-bitmap-brothers-remembering-the-music-of-amiga-pioneers/" target="_blank" rel="noopener noreferrer">The Ransom Note: Bitmap Brothers music</a></p>
    `,
    "classics/games/gods.mod": `
        <h3>[ MUSEUM: RICHARD JOSEPH / NATION 12 — GODS ]</h3>
        <p><strong>Historie:</strong> <strong>Gods</strong> ist ein weiterer Bitmap-Brothers-Titel aus dem Umfeld von Richard Joseph und Nation 12. Die historische Einordnung bezieht sich auf das Spiel; der Dateiname <code>gods17.mod</code> und der eingebettete Titel <code>gods17</code> dokumentieren die konkrete archivierte Fassung.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler Dateibefund: Vierkanal-MOD, Magic <code>M.K.</code>, <strong>40 Orders, 31 Patterns und 27 genutzte Samples</strong>; 320.044 Bytes, davon 287.216 Sampledaten. Mit 40 Orders und 31 Patterns ist dies eines der strukturell umfangreicheren Spielmodule der Neuzugänge. Die Wiedergabe nutzt den MOD-Parser und den linearen Paula-Exact-/A500-Pfad.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://www.theransomnote.com/music/news/the-bitmap-brothers-remembering-the-music-of-amiga-pioneers/" target="_blank" rel="noopener noreferrer">The Ransom Note: Bitmap Brothers music</a></p>
    `,
    "classics/games/pinball-dreams-beatbox.mod": `
        <h3>[ MUSEUM: OLOF GUSTAFSSON — PINBALL DREAMS / BEAT BOX ]</h3>
        <p><strong>Historie:</strong> <strong>Pinball Dreams</strong> von Digital Illusions erschien 1992 mit Musik von <strong>Olof Gustafsson</strong>. <strong>Beat Box</strong> ist einer der vier Tische; die lokale Datei trägt zusätzlich den technischen Titel <code>pinball-stage-3</code>.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler Dateibefund: Vierkanal-MOD, Magic <code>M.K.</code>, <strong>49 Orders, 49 Patterns und 27 genutzte Samples</strong>; 152.792 Bytes, davon 101.532 Sampledaten. Alle 49 Orders referenzieren hier eine ebenso große allozierte Patternbibliothek von 49 Patterns. Die Wiedergabe nutzt den MOD-Parser und den linearen Paula-Exact-/A500-Pfad.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://www.mobygames.com/game/703/pinball-dreams/" target="_blank" rel="noopener noreferrer">MobyGames: Pinball Dreams</a></p>
    `,
    "classics/games/pinball-fantasies-party-land.mod": `
        <h3>[ MUSEUM: OLOF GUSTAFSSON — PINBALL FANTASIES / PARTY LAND ]</h3>
        <p><strong>Historie:</strong> <strong>Pinball Fantasies</strong> ist Digital Illusions’ Nachfolger zu Pinball Dreams und erschien in Europa im Oktober 1992, erneut mit Musik von <strong>Olof Gustafsson</strong>. Die Modulnotiz <code>for pinball dreams 2</code> bewahrt die Arbeitstitel- beziehungsweise Entwicklungsperspektive.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler Dateibefund: Vierkanal-MOD, Magic <code>M.K.</code>, <strong>64 Orders, 64 Patterns und 26 genutzte Samples</strong>; 210.760 Bytes, davon 144.140 Sampledaten. Eingebetteter Titel: <code>pinball2-table1</code>; die Datei enthält 64 Orders und 64 Patterns. Die Wiedergabe nutzt den MOD-Parser und den linearen Paula-Exact-/A500-Pfad.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://en.wikipedia.org/wiki/Pinball_Fantasies" target="_blank" rel="noopener noreferrer">Pinball Fantasies — historische Übersicht</a></p>
    `,
    "classics/games/project-x-bladswede.mod": `
        <h3>[ MUSEUM: ALLISTER BRIMBLE — PROJECT-X / BLADSWEDE REMIX ]</h3>
        <p><strong>Historie:</strong> <strong>Project-X</strong> erschien 1992 mit Musik von <strong>Allister Brimble</strong>. Neben anderen Fassungen ist die Rave-/Bladswede-Version besonders eng mit der Trackerkultur verbunden; der Originaldateiname nennt ausdrücklich <code>bladswede remix!</code>.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler Dateibefund: Vierkanal-MOD, Magic <code>M.K.</code>, <strong>37 Orders, 21 Patterns und 26 genutzte Samples</strong>; 117.450 Bytes, davon 94.862 Sampledaten. Eingebetteter Titel: <code>px.bladswede remix!</code>. Die Datei wird als eigenständige archivierte Fassung und nicht als generische Project-X-Titelauswahl dokumentiert. Die Wiedergabe nutzt den MOD-Parser und den linearen Paula-Exact-/A500-Pfad.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://demozoo.org/sceners/2965/" target="_blank" rel="noopener noreferrer">Demozoo: Allister Brimble</a> · <a href="https://thecakeisaliegaming.wordpress.com/2019/11/26/project-x-music-amiga/" target="_blank" rel="noopener noreferrer">Project-X music — Amiga</a></p>
    `,
    "classics/games/superfrog-title.mod": `
        <h3>[ MUSEUM: ALLISTER BRIMBLE — SUPERFROG ]</h3>
        <p><strong>Historie:</strong> <strong>Superfrog</strong> von Team17 erschien 1993 mit Musik von <strong>Allister Brimble</strong>. Die archivierte Datei trägt den eingebetteten Titel <code>Superfrog World 1</code>, obwohl der Originaldateiname sie als Titelmodul führt; beide Bezeichnungen bleiben sichtbar.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler Dateibefund: Vierkanal-MOD, Magic <code>M.K.</code>, <strong>19 Orders, 16 Patterns und 12 genutzte Samples</strong>; 73.836 Bytes, davon 56.368 Sampledaten. Die Datei wurde laut Modulnotiz mit <strong>ProWizard aus Player-4.1A</strong> konvertiert. Sie ist daher eine MOD-Konversion und kein Beweis dafür, dass das Spiel intern ProTracker verwendete. Die Wiedergabe nutzt den MOD-Parser und den linearen Paula-Exact-/A500-Pfad.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://demozoo.org/sceners/2965/" target="_blank" rel="noopener noreferrer">Demozoo: Allister Brimble</a> · <a href="https://en.wikipedia.org/wiki/Allister_Brimble" target="_blank" rel="noopener noreferrer">Allister Brimble — Übersicht</a></p>
    `,
    "classics/games/lemmings.mod": `
        <h3>[ MUSEUM: TIM WRIGHT / BRIAN JOHNSTON — LEMMINGS ]</h3>
        <p><strong>Historie:</strong> Tim Wright beschreibt in einem Interview, dass er bei <strong>Lemmings</strong> kurzfristig problematische Stücke ersetzen und neben eigenen Kompositionen auch gemeinfreie beziehungsweise bereits von Psygnosis verwendete Melodien arrangieren sollte. Die lokale Datei nennt <strong>Brian Johnston und Tim Wright</strong>; daraus wird keine einzelne Melodie pauschal einer Person zugerechnet.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler Dateibefund: Vierkanal-MOD, Magic <code>M.K.</code>, <strong>77 Orders, 64 Patterns und 14 genutzte Samples</strong>; 152.808 Bytes, davon 86.188 Sampledaten. Mit 77 Orders und 64 Patterns bündelt die Datei ein vergleichsweise großes Musikprogramm. Die Wiedergabe nutzt den MOD-Parser und den linearen Paula-Exact-/A500-Pfad.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://www.squareenixmusic.com/features/interviews/timwright.shtml" target="_blank" rel="noopener noreferrer">Square Enix Music Online: Tim Wright Interview</a></p>
    `,
    "classics/games/another-world-intro.mod": `
        <h3>[ MUSEUM: JEAN-FRANÇOIS FREITAS — ANOTHER WORLD INTRO ]</h3>
        <p><strong>Historie:</strong> Die Musik zu <strong>Another World</strong> (1991) stammt von <strong>Jean-François Freitas</strong>. Sie ist ein wesentlicher Teil der filmisch-reduzierten Präsentation des Spiels; die hier archivierte Datei dokumentiert zusätzlich eine spätere Tracker-Konversion.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler Dateibefund: Vierkanal-MOD, Magic <code>M.K.</code>, <strong>14 Orders, 14 Patterns und 6 genutzte Samples</strong>; 85.760 Bytes, davon 70.340 Sampledaten. Die Modulnotiz datiert eine manuelle <strong>SoundFX-zu-MOD-Konversion durch Gabriele Priarone auf den 14. September 1997</strong>. Komponist und Konverter werden deshalb ausdrücklich getrennt. Die Wiedergabe nutzt den MOD-Parser und den linearen Paula-Exact-/A500-Pfad.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://en.wikipedia.org/wiki/Another_World_(video_game)" target="_blank" rel="noopener noreferrer">Another World — historische Übersicht</a> · <a href="https://www.discogs.com/release/10834621-Jean-Fran%C3%A7ois-Freitas-Another-World-Official-Soundtrack" target="_blank" rel="noopener noreferrer">Discogs: Another World Official Soundtrack</a></p>
    `,
    "classics/games/dune-wormsign.mod": `
        <h3>[ MUSEUM: STÉPHANE PICQ — DUNE / WORMSIGN ]</h3>
        <p><strong>Historie:</strong> <strong>Dune</strong> ist mit der Musik von <strong>Stéphane Picq</strong> verbunden; Philippe Ulrich wird für Beiträge genannt. Picqs Material wurde später auch als <em>Dune – Spice Opera</em> veröffentlicht. Diese Produktionsgeschichte wird nicht mit technischen Details der PC-AdLib-/MT-32-Fassungen vermischt.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler Dateibefund: Vierkanal-MOD, Magic <code>FLT4</code>, <strong>26 Orders, 25 Patterns und 11 genutzte Samples</strong>; 148.686 Bytes, davon 122.002 Sampledaten. Eingebetteter Titel: <code>WORMSIGN</code>; Magic <code>FLT4</code>. Die Aussagen zu Orders, Patterns und Samples beziehen sich ausschließlich auf diese Amiga-MOD-Datei. Die Wiedergabe nutzt den MOD-Parser und den linearen Paula-Exact-/A500-Pfad.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://vgmpf.com/Wiki/index.php/Dune_(DOS)" target="_blank" rel="noopener noreferrer">VGMPF: Dune</a></p>
    `,
    "classics/games/shadow-of-the-beast-title.mod": `
        <h3>[ MUSEUM: DAVID WHITTAKER / JOGEIR LILJEDAHL — SHADOW OF THE BEAST ]</h3>
        <p><strong>Historie:</strong> Das Titelthema zu <strong>Shadow of the Beast</strong> (1989) stammt von <strong>David Whittaker</strong>. Die neue Playlistdatei ist jedoch eine <strong>Vierkanal-MOD-Konversion von Jogeir Liljedahl</strong>: Ihre Sampletexte nennen <code>by jogeir liljedahl</code> und <code>original: d.whittaker</code>.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler Dateibefund: Vierkanal-MOD, Magic <code>M.K.</code>, <strong>15 Orders, 14 Patterns und 3 genutzte Samples</strong>; 56.838 Bytes, davon 41.418 Sampledaten. Diese kompatible Konversion ersetzt in der Auswahl den unspielbaren Bestands-DW-Dump, ohne die Originaldatei zu verändern. Die historische Komposition und die spätere Konversion bleiben getrennt ausgewiesen. Die Wiedergabe nutzt den MOD-Parser und den linearen Paula-Exact-/A500-Pfad.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://en.wikipedia.org/wiki/Shadow_of_the_Beast_(1989_video_game)" target="_blank" rel="noopener noreferrer">Shadow of the Beast — historische Übersicht</a> · <a href="https://modland.com/pub/modules/Protracker/Jogeir%20Liljedahl/beast-title.mod" target="_blank" rel="noopener noreferrer">Modland: Originaldatei</a></p>
    `,
    "classics/demoscene/red-sector-theme.mod": `
        <h3>[ MUSEUM: 4-MAT / ANARCHY — RED SECTOR THEME ]</h3>
        <p><strong>Historie:</strong> <strong>Red Sector Theme</strong> wird 4-Mat / Anarchy zugeschrieben und ist auf den <strong>5. Juli 1990</strong> datiert; das Datum steht auch im Modul. Demozoo führt außerdem die Alternativnamen <em>Shockwave</em> und <em>Electric Revenge</em>.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler Dateibefund: Vierkanal-MOD, Magic <code>M.K.</code>, <strong>50 Orders, 33 Patterns und 12 genutzte Samples</strong>; 214.418 Bytes, davon 179.542 Sampledaten. Die Namensvarianten werden als historische Metadaten geführt; die lokale Datei behält ihren eindeutigen kuratorischen Pfad. Die Wiedergabe nutzt den MOD-Parser und den linearen Paula-Exact-/A500-Pfad.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://demozoo.org/music/46142/" target="_blank" rel="noopener noreferrer">Demozoo: Red Sector Theme</a></p>
    `,
    "classics/demoscene/trans-atlantic.mod": `
        <h3>[ MUSEUM: LIZARDKING / ALCATRAZ — TRANS ATLANTIC ]</h3>
        <p><strong>Historie:</strong> <strong>Trans Atlantic</strong> von Lizardking / Alcatraz wird auf <strong>Mai 1993</strong> datiert. Ein Sampletext verweist auf einen Musikwettbewerb in Mora mit Renegade als Veranstalter; das ist ein direkter Dateibefund und keine nachträglich erfundene Partygeschichte.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler Dateibefund: Vierkanal-MOD, Magic <code>M.K.</code>, <strong>63 Orders, 51 Patterns und 31 genutzte Samples</strong>; 315.418 Bytes, davon 262.110 Sampledaten. Mit 63 Orders, 51 Patterns und 31 genutzten Samples gehört die Datei zu den umfangreicheren Szene-Modulen der Erweiterung. Die Wiedergabe nutzt den MOD-Parser und den linearen Paula-Exact-/A500-Pfad.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://demozoo.org/sceners/232/" target="_blank" rel="noopener noreferrer">Demozoo: Lizardking</a></p>
    `,
    "classics/demoscene/cream-of-the-earth.mod": `
        <h3>[ MUSEUM: ROMEO KNIGHT / RED SECTOR INC. — CREAM OF THE EARTH ]</h3>
        <p><strong>Historie:</strong> Demozoo datiert <strong>Cream of the Earth</strong> von Romeo Knight / Red Sector Inc. auf <strong>Dezember 1989</strong> und ordnet es dem Amiga OCS/ECS zu. Ein späteres Remix64-Interview ergänzt die Perspektive des Musikers auf seine Trackerzeit.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler Dateibefund: Vierkanal-MOD, Magic <code>M.K.</code>, <strong>27 Orders, 28 Patterns und 16 genutzte Samples</strong>; 130.382 Bytes, davon 100.626 Sampledaten. Der Parser ermittelt 28 tatsächlich allozierte Patterns; diese Zahl ersetzt die zunächst nur aus den referenzierten Orders geschätzte niedrigere Patternzahl. Die Wiedergabe nutzt den MOD-Parser und den linearen Paula-Exact-/A500-Pfad.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://demozoo.org/music/21557/" target="_blank" rel="noopener noreferrer">Demozoo: Cream of the Earth</a> · <a href="https://remix64.com/interviews/an-interview-with-romeo-knight.html" target="_blank" rel="noopener noreferrer">Remix64: Romeo Knight Interview</a></p>
    `,
    "classics/demoscene/occ-san-geen.mod": `
        <h3>[ MUSEUM: UNCLE TOM / SCOOPEX — OCC-SAN-GEEN ]</h3>
        <p><strong>Historie:</strong> <strong>Occ-San-Geen</strong> wird Uncle Tom / Scoopex zugeschrieben und auf <strong>Oktober 1989</strong> datiert. Der eigenwillige Titel bleibt in seiner archivierten Schreibweise erhalten.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler Dateibefund: Vierkanal-MOD, Magic <code>M.K.</code>, <strong>73 Orders, 46 Patterns und 19 genutzte Samples</strong>; 232.298 Bytes, davon 184.110 Sampledaten. 73 Orders und 46 Patterns zeigen eine lange Sequenz mit wieder verwendeten musikalischen Bausteinen; das ist eine Strukturaussage, keine Behauptung über die Wiedergabedauer. Die Wiedergabe nutzt den MOD-Parser und den linearen Paula-Exact-/A500-Pfad.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://demozoo.org/music/22230/" target="_blank" rel="noopener noreferrer">Demozoo: Occ-San-Geen</a></p>
    `,
    "classics/demoscene/hysteria.mod": `
        <h3>[ MUSEUM: AUDIOMONSTER / THE SILENTS — HYSTERIA ]</h3>
        <p><strong>Historie:</strong> <strong>Hysteria</strong> von Audiomonster / The Silents ist auf den <strong>19. April 1991</strong> datiert. Besonders anschaulich ist die Sampleliste: Über mehrere Instrumentenslots hinweg bildet sie schrittweise den Namen „Audiomonster“.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler Dateibefund: Vierkanal-MOD, Magic <code>M.K.</code>, <strong>43 Orders, 27 Patterns und 14 genutzte Samples</strong>; 84.158 Bytes, davon 55.426 Sampledaten. Die Namensfragmente sind Metadaten in den 22-Byte-Samplefeldern und keine zusätzlichen Stimmen oder Audiokanäle. Die Wiedergabe nutzt den MOD-Parser und den linearen Paula-Exact-/A500-Pfad.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://demozoo.org/music/57578/" target="_blank" rel="noopener noreferrer">Demozoo: Hysteria</a></p>
    `,
    "classics/demoscene/phantazia.mod": `
        <h3>[ MUSEUM: QUAZAR — PHANTAZIA.2 ]</h3>
        <p><strong>Historie:</strong> Die lokale Datei identifiziert sich als <strong>phantazia.2</strong> von <strong>Quazar, 1995</strong>. Eine Modulnotiz beschreibt sie als letztes Amiga-Modul des Autors und betont <code>only 4 channels</code>. Eine weitergehende Künstlernamenszuordnung wird ohne belastbare Quelle nicht übernommen.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler Dateibefund: Vierkanal-MOD, Magic <code>M.K.</code>, <strong>50 Orders, 44 Patterns und 30 genutzte Samples</strong>; 429.748 Bytes, davon 383.608 Sampledaten. Mit 429.748 Bytes und 383.608 Bytes Sampledaten ist Phantazia der größte neue Vierkanal-MOD der Auswahl. Die Wiedergabe nutzt den MOD-Parser und den linearen Paula-Exact-/A500-Pfad.</p>
        <p class="museum-sources"><strong>Quellen:</strong> Lokale Modulnotizen, Binär- und Parseranalyse; Originalarchiv in der Provenienzdatei.</p>
    `,
    "classics/demoscene/guardian-dragon.mod": `
        <h3>[ MUSEUM: S.L.L. — GUARDIAN DRAGON ]</h3>
        <p><strong>Historie:</strong> <strong>Guardian Dragon</strong> wird S.L.L. zugeordnet und mit Kefrens’ Produktion <em>Guardian Dragon</em> von <strong>1991</strong> verbunden. Der Dateiname und die externen Kataloge tragen hier zusammen die Zuschreibung.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler Dateibefund: Vierkanal-MOD, Magic <code>M.K.</code>, <strong>47 Orders, 35 Patterns und 20 genutzte Samples</strong>; 163.246 Bytes, davon 126.322 Sampledaten. Die lokale Datei wurde laut Modulnotiz mit <strong>ProWizard aus UNIC Tracker</strong> konvertiert. Das ursprüngliche Replayformat und der heutige MOD-Container werden deshalb nicht gleichgesetzt. Die Wiedergabe nutzt den MOD-Parser und den linearen Paula-Exact-/A500-Pfad.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://demozoo.org/sceners/669/" target="_blank" rel="noopener noreferrer">Demozoo: S.L.L.</a> · <a href="https://janeway.exotica.org.uk/release.php?id=881" target="_blank" rel="noopener noreferrer">Janeway/ExoticA: Guardian Dragon</a></p>
    `,
    "classics/demoscene/macrocosm.mod": `
        <h3>[ MUSEUM: FIREFOX / PHENOMENA — MACROCOSM ]</h3>
        <p><strong>Historie:</strong> <strong>Macrocosm</strong> gewann den Musikwettbewerb der <strong>Amiga Halloween Conference 1990</strong>. Die Datei selbst nennt <code>firefox of phenomena</code>; Janeway führt zusätzlich Tip. Die Kuratierung nennt deshalb Firefox als unmittelbar belegten Autor und die Katalogabweichung ausdrücklich.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler Dateibefund: Vierkanal-MOD, Magic <code>M.K.</code>, <strong>32 Orders, 26 Patterns und 27 genutzte Samples</strong>; 165.658 Bytes, davon 137.950 Sampledaten. 32 Orders, 26 Patterns und 27 genutzte Samples beschreiben die konkrete Wettbewerbsfassung in der lokalen Datei. Die Wiedergabe nutzt den MOD-Parser und den linearen Paula-Exact-/A500-Pfad.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://demozoo.org/music/69710/" target="_blank" rel="noopener noreferrer">Demozoo: Macrocosm</a> · <a href="https://janeway.exotica.org.uk/release.php?id=15194" target="_blank" rel="noopener noreferrer">Janeway/ExoticA: Macrocosm</a></p>
    `,
    "classics/demoscene/sanctuary.mod": `
        <h3>[ MUSEUM: MOBY — SANCTUARY / IMPACT16 ]</h3>
        <p><strong>Historie:</strong> Die archivierte Komposition <strong>Sanctuary</strong> wird Moby zugeordnet. Der eingebettete Modultitel lautet dagegen <strong>impact16</strong>; beide Ebenen werden nebeneinander ausgewiesen, statt einen der Namen still zu verwerfen.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler Dateibefund: Vierkanal-MOD, Magic <code>M.K.</code>, <strong>27 Orders, 11 Patterns und 6 genutzte Samples</strong>; 47.236 Bytes, davon 34.888 Sampledaten. Nur sechs genutzte Samples und 34.888 Sampledatenbytes tragen 27 Orders und elf Patterns – das kompakteste konventionelle Arrangement neben Carillon in dieser Auswahl. Die Wiedergabe nutzt den MOD-Parser und den linearen Paula-Exact-/A500-Pfad.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://janeway.exotica.org.uk/release.php?id=37854" target="_blank" rel="noopener noreferrer">Janeway/ExoticA: Sanctuary</a> · <a href="https://demozoo.org/sceners/416/" target="_blank" rel="noopener noreferrer">Demozoo: Moby</a></p>
    `,
    "classics/demoscene/acid-injection.mod": `
        <h3>[ MUSEUM: NUKE / OPTIK — ACID INJECTION ]</h3>
        <p><strong>Historie:</strong> Demozoo führt <strong>Acid Injection</strong> von Nuke / Optik mit <strong>Dezember 1993</strong>. Die lokale Notiz präzisiert <code>On 12-28-93</code> und <code>FiNiShEd At 2:50am</code> – ein ungewöhnlich konkreter Blick auf den Fertigstellungszeitpunkt.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler Dateibefund: Vierkanal-MOD, Magic <code>M.K.</code>, <strong>32 Orders, 25 Patterns und 8 genutzte Samples</strong>; 113.646 Bytes, davon 86.962 Sampledaten. Persönliche oder religiöse Sampletextpassagen werden nicht unnötig reproduziert; für die Technik sind die 32 Orders, 25 Patterns und acht genutzten Samples relevant. Die Wiedergabe nutzt den MOD-Parser und den linearen Paula-Exact-/A500-Pfad.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://demozoo.org/music/?order=title&amp;dir=desc&amp;platform=&amp;production_type=&amp;page=2636" target="_blank" rel="noopener noreferrer">Demozoo: Musikindex / Acid Injection</a></p>
    `,
    "classics/demoscene/carillon.mod": `
        <h3>[ MUSEUM: DIZZY / CARILLON & CYBERIAD — CARILLON ]</h3>
        <p><strong>Historie:</strong> <strong>Carillon</strong> von Dizzy / Carillon & Cyberiad trägt das Moduldatum <strong>2. April 1996</strong>; Aminet dokumentiert die Archivveröffentlichung 1996. Das Stück ist zugleich ein extremes Beispiel für Tracker-Ökonomie.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler Dateibefund: Vierkanal-MOD, Magic <code>M.K.</code>, <strong>2 Orders, 2 Patterns und 1 genutzte Samples</strong>; 27.708 Bytes, davon 24.576 Sampledaten. Nur <strong>zwei Orders, zwei Patterns und ein einziges Sample</strong>: Die kurze Sequenz ist kein Parserfehler, sondern der tatsächliche Aufbau der 27.708 Bytes großen Datei. Die Wiedergabe nutzt den MOD-Parser und den linearen Paula-Exact-/A500-Pfad.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://aminet.net/package/mods/dizzy/Carillon" target="_blank" rel="noopener noreferrer">Aminet: Carillon</a></p>
    `,
    "classics/demoscene/obvious-disaster.mod": `
        <h3>[ MUSEUM: TIP / PHENOMENA — OBVIOUS DISASTER ]</h3>
        <p><strong>Historie:</strong> Janeway unterscheidet bei <strong>Obvious Disaster</strong> von Tip / Phenomena eine <strong>Party Version von Dezember 1990</strong> und eine <strong>Final-Fassung von 1991</strong>. Der Originaldateiname <code>obvious disaster.final.mod</code> identifiziert die lokale Datei mit der letztgenannten Linie.</p>
        <p><strong>Datei &amp; Replay:</strong> Lokaler Dateibefund: Vierkanal-MOD, Magic <code>M.K.</code>, <strong>53 Orders, 50 Patterns und 26 genutzte Samples</strong>; 212.512 Bytes, davon 160.228 Sampledaten. Die Datei wurde laut Modulnotiz mit <strong>ProWizard aus NoisePacker v2</strong> konvertiert. 53 Orders und 50 Patterns beschreiben die vorliegende Final-MOD-Konversion. Die Wiedergabe nutzt den MOD-Parser und den linearen Paula-Exact-/A500-Pfad.</p>
        <p class="museum-sources"><strong>Quellen:</strong> <a href="https://janeway.exotica.org.uk/release.php?id=7129" target="_blank" rel="noopener noreferrer">Janeway/ExoticA: Obvious Disaster final</a> · <a href="https://janeway.exotica.org.uk/release.php?id=326" target="_blank" rel="noopener noreferrer">Janeway/ExoticA: Obvious Disaster party version</a></p>
    `,
};
