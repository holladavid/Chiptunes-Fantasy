# C64-Trackkuration: Abnahmebericht

## Umfang

Die Bibliothek enthält 50 Titel: 26 unveränderte Bestandspfade sowie 24 neue Dateien aus HVSC #85, aufgeteilt in 20 Spiel- und vier Demoscene-Titel. Alle 50 besitzen individuelle Museumstexte und offizielle Subsonglängen. Die 26 vorhandenen SID-Binärdateien und das SID-Exact-Worklet wurden nicht verändert.

Zusätzlich zur Kuration aktiviert `js/app.js` die bereits vorhandene Ordnernavigation nun auch für C64. Dadurch sind `classics/games` und `classics/demoscene` in der echten Oberfläche erreichbar.

## Konsistenz und Provenienz

`node --test test/c64-curation.test.mjs` besteht mit sechs Tests:

- 50 eindeutige Playlist-Pfade mit unverändertem 26-Titel-Bestandspräfix,
- 20 Spiel- und vier Demo-Neuzugänge,
- 50 unterschiedliche, strukturierte Museumstexte mit sicheren Quellenlinks,
- Bytezahl, MD5, SHA-256 und Headerfelder aller 24 Provenienzeinträge,
- exakte Übereinstimmung jeder Songlength-Liste mit der lokalen Subsongzahl,
- verschachtelte Tracklist-Navigation.

Der Test erkannte während der Abnahme falsch dokumentierte Kompatibilitätsflags in der neuen Provenienzdatei. Diese Metadaten wurden aus den tatsächlichen Big-Endian-Headern korrigiert; keine SID-Datei wurde verändert.

## Offline-Wiedergabe aller 50 Titel

Der Bericht `curation-library-corpus.json` wurde mit dem produktiven `sid-exact-processor` bei 48 kHz erzeugt. Jeder Titel wurde viermal gerendert: zweimal mit Standardblöcken, einmal mit unregelmäßigen Blockgrößen und einmal nach einem Neustart. Nach einer verworfenen Einblendphase von 0,25 Sekunden wurden jeweils drei Sekunden ausgewertet.

Ergebnis:

- **50/50 bestanden**, keine stillen Titel und keine nicht-finiten Samples,
- bitidentische Wiederholungs-, Blockgrößen- und Neustartvergleiche,
- Formatverteilung: 43 × PSID v2 und 7 × RSID v2,
- minimaler RMS: 0,010032101364220006,
- maximaler Peak: 0,8455578088760376,
- schlechtestes Offline-Echtzeitverhältnis: 0,8356682067692298.

Das Echtzeitverhältnis ist eine Offline-Messung einschließlich Analyseaufwand, kein Beweis gegen browser- oder gerätespezifische Audioaussetzer.

## Echte Browserabnahme

`curation-browser.json` dokumentiert die Produktionsoberfläche in headless Chromium 151 auf Desktop und Mobil. Auf beiden Ansichten wurden geprüft:

- 26 Wurzeltitel und der Ordner `classics`,
- 20 Titel unter `games` und vier unter `demoscene`,
- Museumsdarstellung und sichere Quellenlinks,
- hörbare, finite Wiedergabe von Ocean Loader 2 (neuer PSID-Titel), Comaland 100% (neuer RSID-Titel) und Commando (Bestand),
- keine Konsolenfehler, Dialogfehler, fehlgeschlagenen Requests oder HTTP-Fehler,
- kein horizontaler Dokumentüberlauf in den beiden getesteten Viewports.

Die Screenshots `curation-desktop.png` und `curation-mobile.png` zeigen die kuratierte Ordneransicht und die mobile Museumsdarstellung. Headless Chromium ersetzt keine Abnahme auf physischen Zielgeräten.

## Gesamtsuite

Aktueller Stand von `node --test`:

- 361 Tests insgesamt,
- 353 bestanden,
- 7 übersprungen,
- 1 bekanntes, bereits vor dieser Kuration bestehendes Abweichen des SID-Phase-3-Rohhashs.

Der betroffene Test lautet `SID synthetic corpus matches the reviewed Phase 3 raw/trace/WAV hashes`. Für `noise-adsr` bleibt der Ist-Hash unverändert bei `d26ae30f7221b719eb6dfdebb5b77b7ed5f841662c28ab7d9943a5e522d93ff0`; die alte Baseline `4f55245b29247e471793189e9113a4b24e79062fae38bbe31e3050da2e78dd37` wurde nicht überschrieben. Diese Kuration ändert weder den getesteten Emulatorpfad noch dessen Baselines.
