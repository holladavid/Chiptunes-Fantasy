Hier ist der fertige **Implementation Plan** in Markdown – inklusive zweier wichtiger Recherche-Funde zu *Cubase64* und *Second Reality*, damit du beim Bauen keine bösen Überraschungen erlebst.

---

# Implementation Plan: C64 Playlist Expansion (Wave 2)

## 1. Überblick & Kurationsziel

Ausbau der C64-Playlist von **57 auf 66 Tracks** (+9 Meilensteine), um die letzten großen inhaltlichen Lücken zu schließen:
- **Spiele-Kanon (`games/`):** Einführung des bisher komplett fehlenden 80er-Pioniers **Fred Gray** (*Mutants*) sowie Ergänzung der fehlenden Top-Klassiker *International Karate*, *Deflektor*, *Cybernoid* (Teil 1) und *R-Type*.
- **Demoscene (`demoscene/`):** Schließen der großen Zeitlücke zwischen 1989 und 2008 (*The Alibi*, *Second Reality 64*) plus zwei extreme Hardware-/Minimalismus-Benchmarks (*Fanta in Space*, *A Mind Is Born*).

### Wichtige Erkenntnisse aus dem HVSC-Check vorab
1. **`Cubase64` → ersetzt durch `Fanta in Space` (Mahoney, 2008):**
   *Cubase64* (X’2010) ist eine interaktive C64-Disk-Demo (`.d64`) mit Echtzeit-Audio-Streaming und Effekt-Schaltern und existiert **nicht** als eigenständige `.sid`-Datei in HVSC,. Der direkte Vorgänger und klangliche Wegbereiter aus derselben Schmiede liegt jedoch als echtes `.sid` in HVSC #85 vor: **`/MUSICIANS/M/Mahoney/Fanta_in_Space.sid`**, – Mahoney (Pex Tufvesson) reizt darin SounDemoNs berüchtigte 8-Bit-Sample-Routine (*Vicious SID*) mit **4 Sample-Kanälen + 2 SID-Synth-Kanälen + Filterung** aus,. Der Museumstext schlägt den kompletten Bogen bis zu *Cubase64*.
2. **`Second Reality 64` (1997):**
   In HVSC #85 ist der Soundtrack auf **vier Dateien** aufgeteilt (`2nd_Reality_part_1.sid` bis `_part_4.sid`),. Der Plan nimmt den ikonischen Eröffnungstrack **`2nd_Reality_part_1.sid`** auf (optional lassen sich die Teile 2–4 bei Bedarf nachziehen – für Part 2 & 3 liegen in HVSC auch `_PSID.sid`-Varianten vor, falls ein Player mit RSID-Timing hakt).

---

## 2. Dateimapping & HVSC-#85-Quellen

| Zielpfad in `tracks/c64/` | HVSC-#85-Quellpfad | Jahr | Komponist | Emulations-Hinweis |
| :--- | :--- | :--- | :--- | :--- |
| `games/international-karate.sid` | `/MUSICIANS/H/Hubbard_Rob/International_Karate.sid` | 1986 | Rob Hubbard | 6581 (1 Subsong) |
| `games/mutants.sid` | `/MUSICIANS/G/Gray_Fred/Mutants.sid` | 1987 | Fred Gray | 6581 (2 Subsongs) |
| `games/deflektor.sid` | `/MUSICIANS/D/Daglish_Ben/Deflektor.sid` | 1987 | Ben Daglish | 6581 |
| `games/cybernoid.sid` | `/MUSICIANS/T/Tel_Jeroen/Cybernoid.sid` | 1988 | Jeroen Tel | 6581 |
| `games/r-type.sid` | `/MUSICIANS/H/Huelsbeck_Chris/R-Type.sid` | 1988 | Chris Hülsbeck & Ramiro Vaca | 6581 (14 Subsongs) |
| `demoscene/the-alibi.sid` | `/MUSICIANS/L/Laxity/Alibi.sid` | 1989/90 | Thomas E. Petersen (Laxity), | 6581 |
| `demoscene/second-reality-part-1.sid` | `/MUSICIANS/K/KB/2nd_Reality_part_1.sid` | 1997 | Tammo Hinrichs (`kb`) | Standard-Part-1-Rip |
| `demoscene/fanta-in-space.sid` | `/MUSICIANS/M/Mahoney/Fanta_in_Space.sid` | 2008 | Pex „Mahoney“ Tufvesson | **Stresstest:** 8-Bit-FM/PWM-Digis |
| `demoscene/a-mind-is-born.sid` | `/MUSICIANS/L/Lft/A_Mind_is_Born.sid` | 2017 | Linus Åkesson (`lft`) | 60-Hz-Timer / LFSR / Reset-Ende, |

---

## 3. Code-Änderungen

### Schritt 1: Dateien aus HVSC #85 kopieren
Die neun `.sid`-Dateien aus der Tabelle oben in `tracks/c64/games/` bzw. `tracks/c64/demoscene/` unter den neuen `kebab-case`-Dateinamen ablegen.

### Schritt 2: `tracks/c64/playlist.js` erweitern
Die neuen Einträge chronologisch in `c64Tracks` einsortieren:

```javascript
// --- GAMES: 1984–1986 ---
// ... direkt nach way-of-the-tiger.sid (oder zwischen parallax.sid und ghosts-n-goblins.sid):
    { path: 'games/international-karate.sid', category: 'games', listTitle: 'International Karate' },

// --- GAMES: 1987–1989 ---
// ... direkt nach delta.sid / wizball.sid (1987):
    { path: 'games/mutants.sid',              category: 'games', listTitle: 'Mutants' },
// ... nach the-last-ninja.sid / agent-x-ii.sid (1987):
    { path: 'games/deflektor.sid',            category: 'games', listTitle: 'Deflektor' },
// ... direkt VOR cybernoid-ii.sid (1988):
    { path: 'games/cybernoid.sid',            category: 'games', listTitle: 'Cybernoid' },
// ... direkt nach katakis.sid (1988):
    { path: 'games/r-type.sid',               category: 'games', listTitle: 'R-Type' },

// --- DEMOSCENE (1989–2024) ---
// ... direkt nach delta-tomas-danko.sid (1989):
    { path: 'demoscene/the-alibi.sid',             category: 'demoscene', listTitle: 'The Alibi' },
// ... direkt nach radio-napalm.sid (1995):
    { path: 'demoscene/second-reality-part-1.sid', category: 'demoscene', listTitle: 'Second Reality 64 (Part 1)' },
// ... direkt nach edge-of-disgrace.sid (2008):
    { path: 'demoscene/fanta-in-space.sid',        category: 'demoscene', listTitle: 'Fanta in Space' },
// ... direkt nach comaland-100-facetime.sid (2015):
    { path: 'demoscene/a-mind-is-born.sid',        category: 'demoscene', listTitle: 'A Mind Is Born (256 Bytes)' },
```

### Schritt 3: Songlängen aus `Songlengths.md5` ziehen (`js/content/songlengths.js`)
Im Ordner deiner HVSC-#85-`Songlengths.md5` ausführen (die Keys passen bereits exakt zur `basename`-Normalisierung in `sid-parser.js`!):

```bash
node -e '
const fs = require("fs");
const lines = fs.readFileSync("Songlengths.md5", "utf8").split(/\r?\n/);
const targets = [
  ["internationalkarate", "/MUSICIANS/H/Hubbard_Rob/International_Karate.sid"],
  ["mutants", "/MUSICIANS/G/Gray_Fred/Mutants.sid"],
  ["deflektor", "/MUSICIANS/D/Daglish_Ben/Deflektor.sid"],
  ["cybernoid", "/MUSICIANS/T/Tel_Jeroen/Cybernoid.sid"],
  ["rtype", "/MUSICIANS/H/Huelsbeck_Chris/R-Type.sid"],
  ["thealibi", "/MUSICIANS/L/Laxity/Alibi.sid"],
  ["secondrealitypart1", "/MUSICIANS/K/KB/2nd_Reality_part_1.sid"],
  ["fantainspace", "/MUSICIANS/M/Mahoney/Fanta_in_Space.sid"],
  ["amindisborn", "/MUSICIANS/L/Lft/A_Mind_is_Born.sid"]
];
for (const [key, sidPath] of targets) {
  const idx = lines.findIndex(l => l.trim().toLowerCase().endsWith(sidPath.toLowerCase()));
  if (idx === -1 || !lines[idx + 1] || !lines[idx + 1].includes("=")) {
    console.log("// NICHT GEFUNDEN:", sidPath);
    continue;
  }
  const secs = lines[idx + 1].split("=")[1].trim().split(/\s+/).map(t => {
    const [m, s] = t.replace(/\([^)]*\)/g, "").split(":");
    return Number((Number(m) * 60 + Number(s)).toFixed(3));
  });
  console.log("\"" + key + "\": { lengths: [" + secs.join(", ") + "] },");
}
'
```

*(Hinweis: Da `sid-parser.js` für `the-alibi.sid` den Key `"thealibi"` erzeugt, passt der Key oben perfekt zur umbenannten Datei.)*

### Schritt 4: Museumstexte in `tracks/c64/museum.js` einfügen

```javascript
    // =========================================================================
    // WAVE 2 — GAMES
    // =========================================================================
    "games/international-karate.sid": museum(
        'ROB HUBBARD — INTERNATIONAL KARATE (1986)',
        `Bevor System 3 mit <em>The Last Ninja</em> und <em>IK+</em> Weltgeschichte schrieb, landete Programmierer Archer Maclean 1986 mit <strong>International Karate</strong> den großen Durchbruch – auch dank <strong>Rob Hubbard</strong>. Statt kurzer Kampf-Jingles legte Hubbard ein fast elfminütiges, meditatives Fernost-Epos vor, das sich immer wieder neu aufbaut. Im Zentrum zitiert er berührend Ryuichi Sakamotos berühmtes Klaviermotiv aus <em>Merry Christmas, Mr. Lawrence</em>, verwebt es aber nahtlos mit eigenen, geheimnisvollen Synth-Passagen.`,
        `<strong>1 Subsong · ca. 10:43 Minuten · MOS 6581</strong>. Ein Meisterstück der Dynamik auf drei Kanälen: Statt permanent Vollgas zu geben, lässt Hubbard bewusst Luft zwischen den Tönen. Weiche Dreieck- und Puls-Koto-Klänge wechseln sich mit trockenen Noise-Perkussion-Einwürfen und schneidenden 6581-Filterbögen ab – ein Track, der beweist, wie filmisch ein 8-Bit-Chip ohne Samples klingen kann.`,
        deepsid('/MUSICIANS/H/Hubbard_Rob/International_Karate.sid')
    ),
    "games/mutants.sid": museum(
        'FRED GRAY — MUTANTS (1987)',
        `Neben Rob Hubbard und Martin Galway gehört <strong>Fred Gray</strong> zu den prägendsten britischen SID-Pionieren der 80er – berühmt für seine Arbeit bei Imagine und Denton Designs. Bei Oceans abstraktem Sci-Fi-Shooter <strong>Mutants</strong> verhalf Gray einem eher minimalistischen Pixel-Spiel zu einer gigantischen akustischen Bühne: Das Hauptstück beginnt mit einem lässigen, fast schwerelosen Groove, bevor es nach rund einer Minute plötzlich in eine breite, elegische Weltraum-Hymne explodiert – nicht umsonst Platz 13 in der großen HVSC-Top-100.`,
        `<strong>2 Subsongs · MOS 6581</strong>. Fred Gray selbst bezeichnete <strong>Mutants</strong> rückblickend augenzwinkernd als Teil seiner <em>„Ringmodulatorphase“</em>: Durch gezielte <strong>Ringmodulation</strong> und fein modulierte Pulsweiten erschafft er schimmernde, leicht metallische Sternennebel-Flächen, die sich markant vom typischen Arpeggio-Brei vieler Zeitgenossen abheben.`,
        deepsid('/MUSICIANS/G/Gray_Fred/Mutants.sid')
    ),
    "games/deflektor.sid": museum(
        'BEN DAGLISH — DEFLEKTOR (1987)',
        `Vortex Softwares Laser-Spiegel-Knobelei <strong>Deflektor</strong> (veröffentlicht über Gremlin Graphics) bekam von <strong>Ben Daglish</strong> einen der eingängigsten Ohrwürmer seiner gesamten Karriere – und die Entstehungsgeschichte ist pure Nerd-Folklore: Daglish verriet in einem Interview, dass der komplette Track eigentlich nur aus einem einzigen Grund existiert: <em>„Weil ich endlich herausgefunden hatte, wie man auf dem SID einen richtig guten Cowbell-Sound programmiert – also habe ich das ganze Stück rund um diese Cowbell herumgeschrieben!“</em>`,
        `<strong>MOS 6581</strong>. Bemerkenswert ist auch Daglishs Arbeitsweise: Selbst als längst komfortable Tracker aufkamen, nutzte er am liebsten einen schlichten <strong>Texteditor</strong>, um Notendaten direkt für seinen Maschinensprache-Driver einzutippen – für maximale Kontrolle über jede einzelne Frame-Veränderung, Hüllkurve und eben jene unvergleichliche 6581-Kuhglocke.`,
        deepsid('/MUSICIANS/D/Daglish_Ben/Deflektor.sid')
    ),
    "games/cybernoid.sid": museum(
        'JEROEN TEL — CYBERNOID (1988)',
        `Bevor <em>Cybernoid II</em> erschien, setzte Hewson Consultants mit <strong>Cybernoid: The Fighting Machine</strong> (programmiert von Raffaele Cecco) Anfang 1988 einen visuellen und musikalischen Meilenstein. Der damals 16-jährige <strong>Jeroen Tel</strong> lieferte einen fast siebenminütigen Soundtrack ab, der die perfekte Balance aus heroischer Arcade-Action und niederländischer Elektronik-Kühle traf – Platz 9 der großen HVSC-Allzeit-Charts und später sogar in Orchester-Fassungen wie <em>RUN 10</em> (Ricciotti Ensemble) verewigt.`,
        `<strong>MOS 6581</strong>. Im frühen <strong>Maniacs-of-Noise-Player</strong> demonstriert Tel sein Gespür für druckvolle Synth-Bässe, präzise abgestimmte Noise-Snares und langgezogene, singende Lead-Linien mit punktgenauem Portamento und Vibrato.`,
        deepsid('/MUSICIANS/T/Tel_Jeroen/Cybernoid.sid')
    ),
    "games/r-type.sid": museum(
        'CHRIS HÜLSBECK & RAMIRO VACA — R-TYPE (1988)',
        `Nachdem Manfred Trenz und Andreas Escher mit <em>Katakis</em> bewiesen hatten, dass sie Irem’s Arcade-Überhit <em>R-Type</em> technisch auf den C64 stemmen können, engagierte Publisher Activision das deutsche Duo kurzerhand für die offizielle Portierung. Auch musikalisch entstand ein deutsches Dream-Team: <strong>Chris Hülsbeck</strong> steuerte ein komplett eigenes, hymnisches Titelthema bei, während <strong>Ramiro Vaca</strong> und Hülsbeck Masato Ishizakis düstere Arcade-Stage-Themes (darunter <em>Battle Theme</em> und <em>Monster Beat</em>) meisterhaft auf den SID übertrugen.`,
        `<strong>14 Subsongs · MOS 6581</strong>. Vom treibenden Titelthema über die atmosphärischen Stage-1- bis Stage-7-Loops bis hin zum Siegesstück <em>Like a Hero</em> zeigt der 14-Subsong-Score das ganze Repertoire des späten 80er-Rainbow-Arts-Sounds – straffe Arpeggio-Akkorde, schneidende Leads und wuchtige Filter-Bässe.`,
        deepsid('/MUSICIANS/H/Huelsbeck_Chris/R-Type.sid')
    ),

    // =========================================================================
    // WAVE 2 — DEMOSCENE
    // =========================================================================
    "demoscene/the-alibi.sid": museum(
        'LAXITY — THE ALIBI (1989/90)',
        `Kaum ein Name steht so sehr für die dänische Demoscene-Goldära rund um <em>Vibrants</em> und die <em>Maniacs of Noise</em> wie <strong>Thomas Egeskov Petersen (Laxity)</strong>. <strong>The Alibi</strong> gehört zu den legendärsten Demo-SIDs der Jahrhundertwende 1989/90 – berühmt für seinen unwiderstehlichen Funk-Groove und einen herrlich schrägen Zufall der Musikgeschichte: Fast zeitgleich komponierte der Niederländer Ronny (<em>Audial Arts</em>) sein Stück <em>Wave Goodbye</em> mit verblüffend ähnlichem Klang und identischem Melodie-Einstieg, obwohl keiner der beiden den Track des anderen kannte. Später schuf JCH (Jens-Christian Huus) davon sogar eine Kult-Umsetzung für AdLib/SoundBlaster.`,
        `<strong>MOS 6581</strong>. Ein Lehrstück in dänischer <strong>6581-Klangästhetik</strong>: knackigste Slap-Synth-Bässe, extrem geschmeidige Pulsweiten-Leads und genau das richtige Maß an schwingenden Arpeggios, das bis heute in „Best-of-SID“-Listen ganz oben steht.`,
        deepsid('/MUSICIANS/L/Laxity/Alibi.sid')
    ),
    "demoscene/second-reality-part-1.sid": museum(
        'KB / SMASH DESIGNS — SECOND REALITY 64 / PART 1 (1997)',
        `1993 erschütterte Future Crews MS-DOS-Demo <em>Second Reality</em> die PC-Welt – vier Jahre später wagten die deutschen Gruppen <strong>Smash Designs</strong> und <strong>The Obsessed Maniacs</strong> das scheinbar Unmögliche: eine liebevolle, technisch irrwitzige <strong>C64-Portierung auf zwei Diskettenseiten</strong>! Auf <strong>The Party 1997</strong> räumte das Werk von AEG, DCP, Idefix und Musiker <strong>Tammo Hinrichs (kb)</strong> souverän Platz 1 im C64-Demo-Wettbewerb ab. kb – später Mitbegründer der PC-Demo-Legende <em>Farbrausch</em> – fängt die Seele von Purple Motions und Skavens PC-Soundtrack erstaunlich präzise auf drei Stimmen ein.`,
        `<strong>Teil 1 von 4</strong>. Während HVSC den gesamten Soundtrack in vier separate Parts aufteilt (die Teile 2 und 3 existieren dort wegen komplexer Demo-Timing-Tricks zusätzlich als spezielle <code>_PSID</code>-Anpassungen), liefert Part 1 den ikonischen Einstieg zwischen treibendem Techno-Drive und kühler Demo-Atmosphäre.`,
        deepsid('/MUSICIANS/K/KB/2nd_Reality_part_1.sid'),
        csdb(908, 'Second Reality 64')
    ),
    "demoscene/fanta-in-space.sid": museum(
        'MAHONEY — FANTA IN SPACE (2008)',
        `Wenn jemand weiß, wie man Sound-Hardware komplett umkrempelt, dann der Schwede <strong>Pex „Mahoney“ Tufvesson</strong> (in den 90ern Miterschaffer des legendären Amiga-<em>NoiseTracker</em>). 2008 sorgte er mit <strong>Fanta in Space</strong> für offene Münder in der gesamten Retro-Szene – dem klanglichen Showcase jener revolutionären 8-Bit-Digi-Routine von <strong>SounDemoN</strong> aus <em>Vicious SID</em>, aus der Mahoney kurz darauf noch extremere C64-Wunder wie <em>c64mp3</em> und das Echtzeit-Effekt-Monster <strong>Cubase64</strong> (X’2010, elf DSP-Effekte gleichzeitig auf 1 MHz!) entwickelte.`,
        `<strong>Hardcore-Emulations-Stresstest!</strong> Statt des klassischen verrauschten 4-Bit-<code>$D418</code>-Tricks kombiniert diese Technik präzise getimte <strong>Frequenzmodulations- und Pulsweiten-Tricks</strong>: Gleichzeitig laufen <strong>vier 8-Bit-Sample-Kanäle plus zwei reguläre SID-Synth-Kanäle</strong> – und sowohl Samples als auch Synth-Stimmen lassen sich sogar durch den analogen SID-Filter schicken. Selbst Hardware-Nachbauten wie der frühe SwinSID bissen sich daran jahrelang die Zähne aus.`,
        deepsid('/MUSICIANS/M/Mahoney/Fanta_in_Space.sid'),
        { label: 'Mahoney: Cubase64 White Paper', url: 'https://www.livet.se/mahoney/cubase64' }
    ),
    "demoscene/a-mind-is-born.sid": museum(
        'LINUS ÅKESSON (LFT) — A MIND IS BORN (2017)',
        `Das vielleicht faszinierendste Exponat dieses Museums: Auf der <strong>Revision 2017</strong> trat der schwedische Hardware-Künstler und Demoscener <strong>Linus Åkesson (lft)</strong> mangels eigener 256-Byte-Kategorie einfach im <em>Oldskool-4K-Intro</em>-Wettbewerb an – und schlug mit einem ausführbaren C64-Programm von exakt <strong>256 Bytes</strong> die gesamte Konkurrenz auf Platz 1! Aus weniger Maschinencode, als dieser Absatz Buchstaben hat, generiert der C64 in Echtzeit Grafik <em>und</em> einen kompletten 64-taktigen Techno-/Ambient-Track.`,
        `<strong>380 Bytes (HVSC-SID) · 112,5 BPM · 60-Hz-Timer-Interrupt</strong>. Die 3 SID-Stimmen sind genial verteilt: <strong>Stimme 1</strong> übernimmt Kick und Bass, <strong>Stimme 2</strong> erzeugt die sich entwickelnde Melodie per <strong>Linear-Feedback-Shift-Register (LFSR)</strong>, und <strong>Stimme 3</strong> spielt eine Fläche, die auf jedem Viertelschlag abgesenkt wird und so echte <strong>Side-Chain-Kompression</strong> imitiert! Nach Takt <code>$40</code> schaltet der Code den Bildschirm dunkel und springt über den System-Reset-Vektor sauber zurück auf den blauen C64-Startbildschirm.`,
        deepsid('/MUSICIANS/L/Lft/A_Mind_is_Born.sid'),
        { label: 'Linus Åkesson: A Mind Is Born', url: 'https://www.linusakesson.net/scene/a-mind-is-born/' }
    ),
```

---

## 4. Test- & Verifikations-Checkliste

1. **Key-Konsistenz prüfen:** Starte die App nach dem Einpflegen einmal lokal – `playlist.js` wirft sofort eine klare Fehlermeldung, falls ein Key in `museum.js` vom Pfad in `playlist.js` abweicht.
2. **SLDB-Abgleich:** Prüfen, ob für alle 9 neuen Tracks ein Eintrag in `js/content/songlengths.js` vorhanden ist (besonders bei `internationalkarate` > 10 min und `amindisborn`).
3. **Emulations-Härtetests anhören:**
   - **`fanta-in-space.sid`:** Läuft euer JS-/WebAudio-SID-Emulator cycle-akkurat genug für 8-Bit-FM-/PWM-Samples, oder übersteuert/rauscht er? *(Falls letzteres passiert, haben wir direkt ein super Demo-Objekt für Emulator-Tuning – oder man entscheidet bewusst, ob man bei Problemen stattdessen einen klassischen HVSC-Track wie z. B. JCH, DRAX oder Reyn Ouwehand nimmt.)*
   - **`a-mind-is-born.sid`:** Prüfen, ob 60-Hz-Timer-Timing, Side-Chain-Ducking auf Stimme 3 und das Ende bei Takt `$40` (Reset-Vektor) sauber durchlaufen,.
4. **Conventional Commit für Wave 2:**
   ```text
   feat(c64): add wave 2 classics and demoscene benchmarks (66 tracks)
   ```

---
