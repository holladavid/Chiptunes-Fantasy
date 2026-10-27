# Chiptunes Fantasy v1.5.4 — Amiga Exact, Phase 0

## 1. Ergebnis und Abgrenzung

Phase 0 stellt die Mess- und Nachweisbasis bereit. Es wurden **keine Emulationskorrekturen** aus Phase 1 vorgezogen: DMA-Zeitverhalten, Tickraten, Trackersemantik, Filterkoeffizienten und Sättigung bleiben unverändert. Die einzige Änderung am Produktions-Worklet ist ein standardmäßig deaktivierter diagnostischer Signalabgriff.

Die Amiga-Trackauswahl wurde nicht verändert; ihre Kuratierung bleibt für den Abschluss aller Phasen reserviert.

## 2. Reproduktionskommandos

Alle Kommandos laufen aus dem Projektstamm mit Node.js 22 oder neuer.

```bash
# Reale Fixture-Integration, jetzt mit rekursiver und verbindlicher Auflösung
node --test test/hipc-parser.test.mjs test/coso-replayer.test.mjs \
  test/coso-vm.test.mjs test/hip.test.mjs

# Vollständiges Korpus-, Effekt- und Diagnoseinventar neu erzeugen
node tools/amiga-corpus-inventory.mjs \
  --out doc/verification/amiga/phase0-corpus.json \
  --markdown doc/verification/amiga/phase0-corpus.md

# Beispiel: echter Exact-Worklet, drei getrennte Abgriffe
node tools/amiga-worklet-render.mjs \
  --input wings-of-death/Wings_Of_Death-Level_1.hipc \
  --seconds 1 --sample-rate 48000 --repeat 2 \
  --report doc/verification/amiga/phase0-exact-level1.json

# Optional PCM16-WAVs aller Stufen schreiben
node tools/amiga-worklet-render.mjs --input GSLINGER.MOD --seconds 5 \
  --out-prefix /tmp/gslinger --report /tmp/gslinger.json
```

Die WAV-Namen enden auf `.paula.wav`, `.zoh.wav` und `.a500.wav`. Die Hashes im JSON beziehen sich dagegen auf den unquantisierten, verschachtelten Float64LE-Messstrom. Dadurch sind die Regressionsnachweise unabhängig von der WAV-Quantisierung.

## 3. Pflicht-Fixtures

`test/helpers/amiga-fixtures.mjs` löst Dateien rekursiv im projekteigenen Verzeichnisbaum oder in einem durch `HIPC_FIXTURES` gesetzten externen Verzeichnis auf. Flache und verschachtelte Fixture-Bestände funktionieren dadurch gleichermaßen.

- Fehlende Pflichtdateien werfen einen Fehler, statt Integrationstests still zu überspringen.
- Gleichnamige Dateien an mehreren Orten werden als mehrdeutig gemeldet.
- Ein fokussierter Lauf der vier betroffenen Testdateien ergab 111 Tests: 107 bestanden, 0 fehlgeschlagen, 4 übersprungen. Die vier Skips sind Allokationstests ohne `--expose-gc`, keine fehlenden Amiga-Fixtures.

## 4. Korpus- und Diagnoseinventar

Das Inventar folgt `tracks/amiga/playlist.js` und erkennt HIP68K anhand des Parserformats, nicht anhand der Dateiendung. Dadurch wird auch `Wings_Of_Death-End.hipc` korrekt als HIP68K geführt.

| Format | Titel |
|---|---:|
| COSO | 33 |
| HIP68K | 2 |
| MOD | 7 |
| XM | 3 |
| **Gesamt** | **45** |

Alle 45 Titel ließen sich laden; beide HIP68K-Titel und alle COSO-Titel durchliefen zusätzlich einen vollständigen headless Replay-Durchlauf. Es traten keine ungültigen Referenzen, Guard-Hits oder Playerabstürze auf.

Das Inventar enthält pro Titel Datei-SHA-256, Format, Kanalzahl, Laufzeit, Tracker-Effekthistogramm, Patternzeilen, Sampleeigenschaften beziehungsweise COSO-/HIP-Strukturmerkmale sowie Quell-Hashes der untersuchten Implementierung.

### Diagnoseklassifikation

| Klasse | Anzahl | Bedeutung |
|---|---:|---|
| bestätigt harmlos (`confirmed-benign`) | 0 | Nur mit ausreichender externer Referenz |
| Referenz erforderlich (`reference-required`) | 37 | Keine automatische Fehlerbehauptung |
| Fehler (`defect`) | 0 | Keine Lade-, Struktur- oder Replayfehler im Lauf |

Die 37 offenen Diagnosen setzen sich aus 34 Parserwarnungen und drei `silentNotes`-Befunden zusammen: Level 2 = 8, Level 3 = 16, Level 4 = 24, insgesamt 48. Die Warnung zu Level 3 Instrument 7 (`$E4` am Elementende) bleibt ebenfalls referenzpflichtig. Ohne Original-/UADE-Vergleich wird weder eine beabsichtigte Note-aus-Semantik noch ein Replayfehler unterstellt.

Für MOD/XM macht die Effektmatrix die Phase-3-Prioritäten sichtbar: lineare XM-Frequenzen, 16/24/32 logische Kanäle, variable Patternlängen, Panning, Sample-Offset sowie kontinuierliche Pitch-/Vibrato-/Volume-Effekte kommen im tatsächlichen Bestand vor.

## 5. Exact-Offline-Harness

Der Harness importiert den echten `paula-exact-processor` und verwendet die normalen Parser- und `PLAY_TRACK`-/`UPLOAD_SAMPLE`-Nachrichten. `audio-controller.js` und `master-processor.js` werden nicht geladen. Master-Gain, Master-Crossfeed und Limiter sind daher ausgeschlossen.

| Abgriff | Rate | Position |
|---|---:|---|
| `paula` | 4 × Ausgaberate | L/R-Digitalsumme nach logischer Kanaldämpfung, vor Crosstalk und Analogstufen |
| `zoh` | 4 × Ausgaberate | ZOH-/Panning-Signal nach 3,5-%-Crosstalk, unmittelbar vor LF347/RC/LED |
| `a500` | Ausgaberate | Nach LF347, RC, optionalem LED-Filter, bestehender Sättigung, FIR und 0,7-Pegel |

Jeder Lauf prüft Wiederholbarkeit, nicht-finite Samples und Unabhängigkeit von der Blockgröße `[1, 17, 64, 255, 3, 128]`. Zusätzlich vergleicht er einen Neustart im bereits verwendeten Worklet mit einem frischen Worklet.

Ein separater Kontrolllauf über eine Sekunde COSO Level 1 bei 48 kHz verglich das unveränderte Archiv-Worklet mit der instrumentierten Datei bei deaktiviertem `diagnosticTap`. Der interleaved Float32-Ausgabestrom war in beiden Fällen bitidentisch (`3d6e67bea649345d0f2b0dc041ea3b78549125fe361639d611d80dc1bb1d057b`). Dieser Hash verwendet eine andere Kodierung als die drei Float64LE-Abgriff-Hashes.

### Selbst erzeugte Regressionsanker

| Fall | Dauer | Deterministisch | Blockunabhängig | Neustart = frisch | Abweichende Stufe |
|---|---:|---|---|---|---|
| COSO Level 1 | 1 s | ja | ja | nein | nur `a500` |
| HIP68K Title | 1 s | ja | ja | nein | nur `a500` |
| MOD GSLINGER | 5 s | ja | ja | ja | keine |
| XM Space Debris | 1 s | ja | ja | nein | nur `a500` |

Die Ergebnisse grenzen den bereits bekannten Resetbefund bei den drei sofort hörbaren Fällen auf die Analog-/Ausgabehistorie ein. Der MOD-Fall beginnt mit Stille und ist daher kein Gegenbeweis für den allgemeinen Resetfehler.

Diese JSON-Dateien und SHA-256-Werte sind **selbst erzeugte Regressionsanker**, keine Hardware- oder UADE-Wahrheitsbeweise. Sie sollen spätere Änderungen sichtbar machen und müssen bei beabsichtigten Emulationskorrekturen erneuert und begründet werden.

## 6. UADE-Reproduktion

### Vorhandene historische Ergebnisse

`doc/specs/hipc-coso-verified-spec.md`, Abschnitt 15, dokumentiert die folgenden Vergleiche mit `uade123 --filter=none --panning=0`, 44,1 kHz, PCM16, Stereo:

| Modul | historischer Referenzname | fest / lokal erklärte Energie |
|---|---|---:|
| Wings of Death Level 1 | `level1.wav` | 86,9 % / 95,2 % |
| Wings of Death Level 2 | `level2.wav` | 89,1 % / 98,0 % |
| Dragonflight Title | `dragonflight.wav` | 83,3 % / 92,5 % |

Die WAVs und ihre SHA-256-Hashes sind nicht im Quellarchiv enthalten. Deshalb wurden diese Werte in Phase 0 **nicht als neu reproduziert** ausgegeben. `phase0-uade-manifest.json` hält Modulgrößen und Modul-Hashes fest und kennzeichnet die fehlenden Referenz-Hashes ausdrücklich mit `null`. Eine frühere UADE-Versionsnummer wird nicht nachträglich erfunden.

### Referenz erzeugen und Vergleich hashfest wiederholen

```bash
# Beispiel Level 2; UADE muss separat installiert sein
uade123 -f /tmp/level2.wav -e wav --filter=none --panning=0 \
  tracks/amiga/wings-of-death/Wings_Of_Death-Level_2.hipc

# Python 3 mit NumPy/SciPy; erzeugt vollständigen JSON-Nachweis
node tools/amiga-uade-reproduce.mjs \
  --module tracks/amiga/wings-of-death/Wings_Of_Death-Level_2.hipc \
  --reference /tmp/level2.wav \
  --origin "lokaler UADE-Export, filter=none, panning=0" \
  --seconds 120 --lowpass 2500 --local 40 \
  --report /tmp/level2-uade.json
```

Der Bericht bindet Standardausgabe und Messwerte an SHA-256 von Modul, konkreter Referenz-WAV, Fit-Werkzeug, Raw-Renderer und Replay-/Paula-Quellen. Er enthält ausserdem die exakten Kommandos und Einstellungen. Dasselbe Verfahren ist für Level 1 mit 150 Sekunden und Dragonflight mit 200 Sekunden vorgesehen. Für HIP68K Title ist weiterhin ein eigener UADE-Audiovergleich erforderlich.

Die vorhandene Fit-Methode rendert vier getrennte Paula-Stimmen ohne A500-/Master-Kette und verwendet weiterhin 50 Hz im Raw-Renderer. Der dokumentierte CIA-Wert von etwa 49,9985 Hz wird dadurch nicht still ersetzt; die Timingkorrektur und ihr Vergleich gehören zu Phase 2.

## 7. Phase-0-Abnahme und Übergabe an Phase 1

- [x] Verschachtelte und flache Fixture-Bestände werden zuverlässig aufgelöst.
- [x] Fehlende Pflicht-Fixtures erzeugen keine grünen Skips mehr.
- [x] Alle 45 Playlist-Titel sind mit Format- und Feature-Matrix inventarisiert.
- [x] Parserwarnungen und `silentNotes` sind ohne unbelegte Fehlerbehauptung klassifiziert.
- [x] Paula-Rohstrom, ZOH/vor Analog und A500-Ausgang sind getrennt messbar.
- [x] Master-DSP ist im Harness nachweislich nicht Bestandteil des Signalpfads.
- [x] Wiederholung und Blockgrößenunabhängigkeit sind für vier Formate belegt.
- [x] Der Neustartbefund ist auf die A500-Stufe eingegrenzt und als Phase-1-Arbeit offen dokumentiert.
- [x] UADE-Herkunft, Einstellungen, Kommandos und verfügbare Datei-Hashes sind festgehalten; fehlende Referenzen sind transparent markiert.

Phase 1 kann nun die digitalen Paula-/Resetfehler korrigieren, ohne gleichzeitig Referenz- oder Messsystematik ändern zu müssen.
