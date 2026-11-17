Hier ist **Schritt 3 für Amiga** als fertiger **Implementation Plan in Markdown** – genau so kuratiert, dass alle **10 Neuzugänge** echte **4-Kanal-ProTracker-MODs (`.mod`)** sind (damit laufen sie out-of-the-box auf eurem `mod-parser.js`, ohne dass ihr einen neuen Player wie TFMX oder OctaMED schreiben müsst) und gleichzeitig die letzten großen Namen der Amiga-Geschichte in die Jukebox holen.

---

# Implementation Plan: Amiga Playlist Expansion (Wave 2)

## 1. Überblick & Kurationsziel

Ausbau der Amiga-Playlist von **73 auf 83 Tracks** (+10 Pflichtklassiker):
- **Games (`games/`, +2):** Vollendung der *Lotus*-Reihe (*Lotus III* von **Patrick Phelan** neben *Lotus II*) sowie Aufnahme von **Martin Ivesons** (*Nuke / Atjazz*) legendärem *Jaguar-XJ220*-Soundtrack – beides native ProTracker-MODs, die auch zeigen, wie Rennspiele ab 1992 eigene Autoradio-Tracklisten im Spiel einführten,.
- **Demoscene (`demoscene/`, +8):**
  - Das **echte 4-Kanal-Original** von **`Space Debris`** (damit man es direkt mit dem 32-Spur-XM-Remake vergleichen kann!).
  - Schließung der großen Komponisten- & Demo-Lücken: **Jesper Kyd** (*Hardwired* / *Global Trash 3 v2* — vor *Hitman* & *Assassin’s Creed*!), **Firefox & Tip** (*Enigma*), **Jester**s Allzeit-Hit (*Stardust Memories*), **Travolta** (*State of the Art*), **Laxity / Kefrens** (*Desert Dream IV*), **Moby** (*Arte / Elekfunk!*) und **Jogeir Liljedahls** zweites ProTracker-Epos (*Physical Presence* neben *Guitar Slinger*),,,,,.

---

## 2. Dateimapping & Bezugsquellen (Modland / ModArchive)

Alle 10 Dateien liegen auf **Modland** (`ftp.modland.com/pub/modules/Protracker/...`) und/oder **ModArchive** vor:

| Zielpfad in `tracks/amiga/` | Originaldatei / Modland- / ModArchive-Fundstelle | Jahr | Komponist | Hinweis |
| :--- | :--- | :--- | :--- | :--- |
| `games/lotus-3-breathless.mod` | `Protracker/Patrick Phelan/lotus 3 - breathless.mod` *(oder Wanted Team `MOD_Lotus3.lzx`)* | 1992 | Patrick Phelan | ProTracker-MOD |
| `games/jaguar-xj220-moody-breeze.mod` | `Protracker/Spaceman/jaguar xj220 - moody breeze.mod` (53.044 B) | 1992 | Martin Iveson (`Nuke`) | ProTracker-MOD |
| `demoscene/space-debris.mod` | `Protracker/Captain/space debris.mod` *(ModArchive #57925)* | 1991 | Markus Kaarlonen (`Captain`) | Echtes 4-Kanal-MOD! |
| `demoscene/enigma-a-final-hyperbase.mod` | `Firefox + Tip - A Final Hyperbase / Musiklinjen` *(ModArchive #42146)* | 1991 | Firefox & Tip / Phenomena | 1. Platz Anarchy Easter ’91 |
| `demoscene/global-trash-3-v2.mod` | `Protracker/Jesper Kyd/global trash 3 v2.mod` (204.728 B) | 1991 | Jesper Kyd / The Silents | Aus *Hardwired*, |
| `demoscene/stardust-memories.mod` | `Jester - stardust memories.mod` (153.676 B) | 1992 | Volker Tripp (`Jester`) | Aus *World of Commodore* |
| `demoscene/condom-corruption.mod` | `Travolta - condom corruption.mod` *(ModArchive #39162, 230.652 B)* | 1992 | Jogeir Liljedahl (`Travolta`), | Timing-Check empfohlen! |
| `demoscene/desert-dream-4.mod` | `Laxity - desert dream iv.mod` *(ModArchive #36889)* | 1993 | Laxity / Kefrens | Nicht der C64-Laxity! |
| `demoscene/elekfunk.mod` | `Moby - elekfunk !.mod` (224.342 B) | 1993 | Frédéric Motte (`Moby`) | 1. Platz The Party ’93 Music, |
| `demoscene/physical-presence.mod` | `Protracker/Jogeir Liljedahl/physical presence.mod` (285.004 B) | 1994 | Jogeir Liljedahl | Aus Virtual Dreams’ *Love* |

---

## 3. Änderungen an `tracks/amiga/playlist.js`

Einfach chronologisch an den jeweiligen Stellen in `amigaTracks` einfügen:

```javascript
// --- GAMES: 1992 (nach project-x-bladswede.mod): ---
    { path: 'games/lotus-3-breathless.mod',         category: 'games', listTitle: 'Lotus III – Breathless' },
    { path: 'games/jaguar-xj220-moody-breeze.mod',  category: 'games', listTitle: 'Jaguar XJ220 – Moody Breeze' },

// --- DEMOSCENE: 1991 (direkt vor bzw. rund um elysium.mod): ---
    { path: 'demoscene/enigma-a-final-hyperbase.mod', category: 'demoscene', listTitle: 'Enigma – A Final Hyperbase' },
    { path: 'demoscene/space-debris.mod',             category: 'demoscene', listTitle: 'Space Debris (Original 4-Ch MOD)' },
    { path: 'demoscene/global-trash-3-v2.mod',        category: 'demoscene', listTitle: 'Hardwired – Global Trash 3 v2' },

// --- DEMOSCENE: 1992 (rund um towards-immortality.mod / sanctuary.mod): ---
    { path: 'demoscene/stardust-memories.mod',        category: 'demoscene', listTitle: 'Stardust Memories' },
    { path: 'demoscene/condom-corruption.mod',        category: 'demoscene', listTitle: 'State of the Art – Condom Corruption' },

// --- DEMOSCENE: 1993–1994 (rund um guitar-slinger.mod / acid-injection.mod): ---
    { path: 'demoscene/desert-dream-4.mod',           category: 'demoscene', listTitle: 'Desert Dream IV' },
    { path: 'demoscene/elekfunk.mod',                 category: 'demoscene', listTitle: 'Arte – Elekfunk!' },
    { path: 'demoscene/physical-presence.mod',        category: 'demoscene', listTitle: 'Physical Presence' },
```

*(Und bei `tracker-xm/space-debris.xm` bleibt das 32-Spur-XM-Remake ganz am Ende als spannender Vergleich zum 4-Kanal-Original in `demoscene/space-debris.mod` erhalten!)*

---

## 4. Museumstexte für `tracks/amiga/museum.js`

Erst diesen kleinen Helper zu den anderen Link-Helpern ganz oben in `tracks/amiga/museum.js` legen:
```javascript
const modarchive = (id, label) => ({ label: `ModArchive: ${label}`, url: `https://modarchive.org/index.php?request=view_by_moduleid&query=${id}` });
```

Danach die zehn neuen Einträge in `amigaMuseumMetadata` einfügen:

```javascript
    // =========================================================================
    // WAVE 2 — GAMES (1992)
    // =========================================================================
    "games/lotus-3-breathless.mod": museum(
        'PATRICK PHELAN — LOTUS III / BREATHLESS (1992)',
        `Jeder der drei Teile von Magnetic Fields’ legendärer <em>Lotus</em>-Rennspieltrilogie hatte einen anderen Hauskomponisten – beim großen Finale <strong>Lotus III: The Ultimate Challenge</strong> (1992) kehrte endlich das geliebte „Autoradio“ aus Teil 1 zurück! Statt nur ein Titelthema zu hören, durfte man vor dem Rennen zwischen mehreren Stücken von <strong>Patrick Phelan</strong> wählen – allen voran das euphorische <strong>Breathless</strong> (das später zahllose Remixes inspirierte). Obendrauf bauten die Entwickler das geniale Streckengenerator-System <em>RECS</em> und ein verstecktes Minispiel namens <em>POD</em> ein.`,
        `<strong>4-Kanal-ProTracker-MOD</strong>. Während Teil 1 und 2 noch eigene Custom-Formate nutzten, lieferte Phelan den gesamten <em>Lotus-III</em>-Score im glasklaren Standard-ProTracker-Format ab – druckvolle Synth-Bässe, treibende Hi-Hats und eingängige Lead-Linien für nächtliche Splitscreen-Duelle.`,
        hol(929, 'Classic Lotus Trilogy')
    ),
    "games/jaguar-xj220-moody-breeze.mod": museum(
        'MARTIN IVESON — JAGUAR XJ220 / MOODY BREEZE (1992)',
        `Core Designs direkter Rivale zu <em>Lotus</em> erschien 1992 passend zum britischen Marktstart des 470.000-Pfund-Supersportwagens <strong>Jaguar XJ220</strong> – inklusive Strecken-Editor und wählbarem Ingame-Autoradio. Am Mischpult saß <strong>Martin Iveson</strong>, in der Amiga-Demoscene bereits als <strong>Nuke / Anarchy</strong> und später Mitgründer der Gruppe <em>Lemon.</em> (als <em>Spaceman</em>) gefeiert, bevor er als House-/Broken-Beat-Produzent unter dem Namen <strong>Atjazz</strong> international Karriere machte! <strong>Moody Breeze</strong> fängt diese lässige britische Club-Eleganz perfekt ein.`,
        `<strong>4-Kanal-MOD (53.044 Bytes)</strong>. Unglaubliche Sample-Ökonomie: In gerade einmal 52 KB zaubert Iveson einen butterweichen, jazzig-funkigen Groove mit entspannten Akkord-Stabs und federnder Bassline auf vier Paula-Stimmen.`,
        { label: 'Hall of Light: Jaguar XJ220', url: 'https://amiga.abime.net/games/view/jaguar-xj220' },
        { label: 'Wikipedia: Jaguar XJ220', url: 'https://en.wikipedia.org/wiki/Jaguar_XJ220_(video_game)' }
    ),

    // =========================================================================
    // WAVE 2 — DEMOSCENE (1991–1994)
    // =========================================================================
    "demoscene/enigma-a-final-hyperbase.mod": museum(
        'FIREFOX & TIP / PHENOMENA — ENIGMA / A FINAL HYPERBASE (1991)',
        `Am <strong>30. März 1991</strong> setzte die schwedische Gruppe <strong>Phenomena</strong> auf der <em>Anarchy Easter Conference</em> einen Meilenstein: Ihre Demo <strong>Enigma</strong> (1. Platz!) lief dank butterweicher 3D-Vektoren, Raytracing-Kugeln und Plasma-Effekten damals sogar als Vorführvideo auf Amiga-500-Monitoren in Computerläden. Untrennbar verbunden mit den fliegenden Würfeln ist der hypnotische, fast zehnminütige Track <strong>A Final Hyperbase</strong> (in der Szene auch als <em>Musiklinjen</em> oder <em>Hyperbased</em> bekannt) vom schwedischen Duo <strong>Firefox &amp; Tip</strong>.`,
        `<strong>4-Kanal-ProTracker-MOD</strong>. Einer der ersten großen Demo-Tracks, die konsequent ein ganzes Acid-House-/Rave-Set innerhalb eines einzigen 4-Kanal-Moduls durchziehen – berühmt für seine charakteristischen Synth-Riffs, deren Sample-Set Jahrzehnte später noch als Hommage von Künstlern wie Dubmood zitiert wurde.`,
        { label: 'Demozoo: Enigma', url: 'https://demozoo.org/productions/143/' },
        modarchive(42146, 'A Final Hyperbase')
    ),
    "demoscene/space-debris.mod": museum(
        'CAPTAIN / IMAGE — SPACE DEBRIS ORIGINAL (1991)',
        `Hier schlägt das Herz der 4-Kanal-Tracker-Geschichte: Bevor Markus Kaarlonen später bei den <em>Poets of the Fall</em> (und für <em>Alan Wake</em> / <em>Old Gods of Asgard</em>) die Studios dieser Welt betrat, programmierte er als Finne <strong>Captain</strong> im Jahr 1991 dieses unsterbliche Amiga-Original. Alles, was auf seiner Website als Geheimrezept beschrieben ist – nahtlose <strong>Crossfade-Loops</strong>, als Einzelsamples abgespeicherte volle Akkorde und von Hand in die Pattern-Zeilen getippte Echos –, hört man hier im rohen, unverfälschten 8-Bit-Original.`,
        `<strong>Original 4-Kanal-MOD</strong>. Im direkten Hörvergleich zum 32-Spur-XM-Remake in der <code>tracker-xm</code>-Sektion wird sofort klar, warum Paula-Puristen dieses Original vergöttern: Kein 32-Kanal-Polster, sondern messerscharfes, luftiges 4-Stimmen-Handwerk.`,
        exotica('Captain', 'Captain'),
        { label: 'Markus Kaarlonen: Space Debris', url: 'https://markuskaarlonen.com/space-debris' },
        modarchive(57925, 'Space Debris (MOD)')
    ),
    "demoscene/global-trash-3-v2.mod": museum(
        'JESPER KYD / THE SILENTS — HARDWIRED / GLOBAL TRASH 3 V2 (1991)',
        `Lange bevor der Däne <strong>Jesper Kyd</strong> die düsteren Orchester- und Elektronik-Soundtracks für Blockbuster wie <em>Hitman</em>, <em>Assassin’s Creed</em> und <em>Borderlands</em> komponierte, drehte er als Teenager bei den Demoscene-Legenden <strong>The Silents</strong> auf dem Amiga voll auf. Sein treibendes, fast industrielles Techno-Epos <strong>Global Trash 3 v2</strong> (Oktober 1991) krönte im Dezember 1991 die zweidiskettige Mega-Trackmo <strong>Hardwired</strong> (von Crionics &amp; The Silents) – gewählt zur besten Trackmo seiner Zeit.`,
        `<strong>4-Kanal-ProTracker-MOD (204.728 Bytes)</strong>. Über 200 KB kompromisslose 91er-Rave-Energie: Kyd schichtet harte Drum-Loops, schneidende Synth-Bässe und düstere Chöre so dicht übereinander, dass man dem Amiga 500 jedes Watt abnimmt.`,
        janeway(504, 'Hardwired')
    ),
    "demoscene/stardust-memories.mod": museum(
        'JESTER / SANITY — STARDUST MEMORIES (1992)',
        `Wenn man Amiga-Fans weltweit nach ihrem absoluten Lieblings-MOD fragt, landet neben <em>Space Debris</em> und <em>Elysium</em> fast immer dieser Track von <strong>Volker Tripp (Jester)</strong> auf Platz 1! Erschienen im November 1992 in Sanity’s Kult-Trackmo <strong>World of Commodore 92</strong> (Platz 2 der Compo, programmiert u. a. von Chaos), liefert <strong>Stardust Memories</strong> knapp vier Minuten puren Synth-Pop-Zauber. Herrliches Trivia aus den internen Sample-Texten: Jester schreibt stolz <em>„all samples by me ^ except #10 by ff/pha“</em> (ein einzelnes Sample von Firefox/Phenomena!) – und druckte gleich seine Bocholter Privatadresse samt Festnetznummer für kommerzielle Musikaufträge ins Modul.`,
        `<strong>4-Kanal-Noisetracker-/ProTracker-MOD (153.676 Bytes · ca. 3:59)</strong>. Ein Paradebeispiel für den berühmten warmen „Sanity-Sound“ der frühen 90er: federnde Bass-Grooves, kristallklare Synth-Leads und perfekt ausbalancierte 8-Bit-Samples.`,
        { label: 'Demozoo: World of Commodore', url: 'https://demozoo.org/productions/9014/' },
        pouet(2938, 'World of Commodore'),
        janeway(8970, 'World of Commodore')
    ),
    "demoscene/condom-corruption.mod": museum(
        'TRAVOLTA / SPACEBALLS — STATE OF THE ART / CONDOM CORRUPTION (1992)',
        `Auf <strong>The Party 1992</strong> (29. Dezember) revolutionierte die norwegische Gruppe <strong>Spaceballs</strong> mit <strong>State of the Art</strong> die gesamte Demoscene und räumte Platz 1 ab: Statt klassischer Amiga-Scrolltexte zeigten sie flüssig tanzende Silhouetten – von Grafiker/Coder <em>Major Asshole</em> mühsam von echtem Videomaterial Einzelbild für Einzelbild per Hand vektorisiert (<strong>1 Stunde Zeichenarbeit pro 1 Sekunde Video!</strong>) und durch clevere Speicher-Hacks über den Erweiterungsport des Amiga 500 gejagt. Den gnadenlos treibenden Techno-Beat <strong>Condom Corruption</strong> lieferte <strong>Travolta</strong> – niemand geringeres als <strong>Jogeir Liljedahl</strong> unter seinem Spaceballs-Pseudonym!`,
        `<strong>4-Kanal-MOD (230.652 Bytes · ca. 3:27)</strong>. Während die längere Compo-Fassung („Maxi“) noch länger läuft, steckt hier die straffe Demo-Synchronisation, bei der jedes Beat-Sample punktgenau auf die tanzenden Vektor-Figuren knallt. Technischer Härtetest für Player: Manche moderneren Tracker hatten historisch kleine Timing-Eigenheiten mit den ProTracker-Effekten dieses Moduls.`,
        demozooMusic(516, 'Condom Corruption'),
        modarchive(39162, 'Condom Corruption'),
        { label: 'Demovibes: Condom Corruption', url: 'https://www.scenemusic.net/demovibes/song/7169/' }
    ),
    "demoscene/desert-dream-4.mod": museum(
        'LAXITY / KEFRENS — DESERT DREAM IV (1993)',
        `Ein echtes Stück skandinavischer Demo-Ekstase von <strong>The Gathering 1993</strong> (10. April 1993): Die dänische Gruppe <strong>Kefrens</strong> holte mit <strong>Desert Dream</strong> unter tosendem Hallenjubel den Demo-Sieg. Hinter dem Soundtrack – ebenso wie hinter seinem eigenen Music-Packer <em>Laxity Tracker</em> – steckte der dänische Coder und Musiker <strong>Laxity</strong> (Kefrens / Polka Brothers). Wichtiger Nerd-Hinweis zur Vermeidung von Verwechslungen: Dieser Amiga-Laxity ist <em>nicht</em> identisch mit dem gleichnamigen berühmten dänischen C64-SID-Musiker Laxity von Vibrants!`,
        `<strong>4-Kanal-ProTracker-MOD</strong>. Ursprünglich für die Disk-Demo über den gepackten <em>UNIC Tracker 2</em> abgespielt und später verlustfrei in ProTracker rekonstruiert, fängt Teil 4 des Scores die schimmernde, orientalisch-elektronische Atmosphäre der Wüsten-Trackmo makellos ein.`,
        modarchive(36889, 'Desert Dream')
    ),
    "demoscene/elekfunk.mod": museum(
        'MOBY / SANITY — ARTE / ELEKFUNK! (1993)',
        `Ende Dezember 1993 auf <strong>The Party 3</strong> erschien mit Sanity’s <strong>Arte</strong> für viele das beste Amiga-500-Single-Disk-Demo aller Zeiten – benannt nach dem deutsch-französischen TV-Kultursender, passend zur Kooperation zwischen deutschen Codern (Chaos, Mr. Pet) und dem französischen Kreativduo <strong>Ra</strong> (Grafik) und <strong>Moby</strong> (Frédéric Motte, Musik), die kurz danach zum berühmten PC-Team <em>NoooN</em> wechselten. Den Musikwettbewerb der Party gewann Mobys übermütiges Funk-Feuerwerk <strong>Elekfunk!</strong> hochverdient auf <strong>Platz 1</strong>.`,
        `<strong>4-Kanal-ProTracker-MOD (224.342 Bytes · ca. 3:21)</strong>. Virtuose Slap-Bass-Samples, messerscharfe Bläser-Stabs und funkelnde Piano-Läufe demonstrieren eindrucksvoll, warum Moby als unangefochtener König des französischen Amiga-Funks galt.`,
        janeway(279, 'Arte')
    ),
    "demoscene/physical-presence.mod": museum(
        'JOGEIR LILJEDAHL — PHYSICAL PRESENCE (1994)',
        `Nach seinem ProTracker-Gitarren-Streich <em>Guitar Slinger</em> (1993) bewies der Norweger <strong>Jogeir Liljedahl</strong> im Juni 1994 mit <strong>Physical Presence</strong> (veröffentlicht für <em>Virtual Dreams’</em> Amiga-AGA-Demo <strong>Love</strong>), dass selbst in der späten 94er-Ära noch ungeahnte Tiefen in vier 8-Bit-Kanälen steckten: Düster-atmosphärische Flächen treffen auf fette Breakbeats und Jogeirs typisch gefühlvolle E-Gitarren- und Synth-Soli.`,
        `<strong>4-Kanal-ProTracker-MOD (285.004 Bytes)</strong>. Fast 285 KB meisterhaft abgemischte Samples über einen der ausgereiftesten, organischsten ProTracker-Mixes der mittleren 90er – ein würdiger Höhepunkt für die späte OCS/AGA-Übergangszeit.`,
        demozooMusic(18671, 'Physical Presence')
    ),
```

---

## 5. Test- & Verifikations-Checkliste

1. **Key-Konsistenz prüfen:** Nach dem Einfügen einmal die Playlist laden – `playlist.js` meldet sofort per Error, falls auch nur ein Pfad zwischen `playlist.js` und `museum.js` nicht deckungsgleich ist.
2. **Timing-Härtetest an `condom-corruption.mod`:** Auf dem Paula-Exact-/A500-Pfad durchhören (speziell Effekte/Tempo-Kommandos und Loops – da manche Tracker dort historische Eigenheiten haben).
3. **A/B-Hörvergleich (`space-debris.mod` vs. `space-debris.xm`):** Einmal direkt nacheinander spielen, um sicherzugehen, dass beide sauber auf 4 bzw. 32 Stimmen ohne Clipping laufen.
4. **Conventional Commit für Amiga Wave 2:**
   ```text
   feat(amiga): add wave 2 game and demoscene MOD classics (83 tracks)
   ```

---

