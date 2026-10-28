# Amiga Exact Worklet — Phase 5: Produktionsabnahme

Stand: v1.5.4-Arbeitsstand nach Phase 5  
Produktions-Worklet SHA-256: `44e1a470617a36b7a4f8ab8e5def97bd67028b82152fb31c47325f7f46c6a364`

## Ergebnis

Der vollständige Amiga-Produktionskorpus, die repräsentativen Abtastraten, langen Offline-Renders und die echte Chromium-Integration sind bestanden. Pause/Resume wurde als letzter produktionsrelevanter Zustandsfehler korrigiert. Die Exact-/A500-Kommunikation beschreibt nun durchgehend die tatsächlich lineare, hostratenabhängige Ausgangsstufe.

Die Mess-Hashes bleiben selbst erzeugte Regressionsanker. Sie sind keine Hardware- oder UADE-Wahrheitsbeweise. Die Offline-Laufzeit ist kein gerätespezifischer Browser-Underrun-Beweis.

## 1. Pause/Resume ohne Zustandsverlust

`STOP_TRACK` deaktivierte bisher DMA und setzte alle Kanallautstärken auf null. `RESUME_TRACK` stellte diese Werte nicht wieder her, wodurch die Wiedergabe nach einer Pause stumm oder verändert fortgesetzt werden konnte.

`STOP_TRACK` friert nun ausschließlich die Wiedergabe ein. DMA, Samplepositionen, Effekt-, Sequencer-, Replayer- und Filterzustände bleiben unverändert. Während der Pause gibt das Worklet null aus und führt keinen Emulationszustand fort. `PLAY_TRACK` führt weiterhin den vollständigen Neustart-Reset aus.

Für COSO/HIPC, HIP68K, MOD und XM prüfen die neuen Tests jeweils:

1. bitgleiche Ausgabe vor der Pause,
2. unveränderte Transport- und Kanalzustände beim Pausieren,
3. durchgehend stille A500-Ausgabe ohne Zustandsfortschritt,
4. nach Resume bitgleiche `paula`-, `zoh`- und `a500`-Hashes gegenüber einem ununterbrochenen Referenzlauf.

Die Phase-4-Berichte behalten ihren historischen Worklet-Hash als Provenienz. Ihre unveränderten Wiedergabeanker werden weiterhin gegen das aktuelle Worklet geprüft.

## 2. Vollständiger Produktionskorpus

Alle 45 Playlist-Titel wurden mit dem realen Produktions-Worklet jeweils viermal für fünf Sekunden gerendert:

- zwei gleiche Läufe für Determinismus,
- irreguläre Blöcke `[1, 17, 64, 255, 3, 128]` für Blockunabhängigkeit,
- 0,25 Sekunden Warm-up und erneutes `PLAY_TRACK` für neustartidentische Ausgabe.

| Prüfung | Ergebnis |
|---|---:|
| Titel | 45/45 bestanden |
| Formate | 35 HIPC, 7 MOD, 3 XM |
| Endliche Samples | alle Läufe |
| Deterministisch | 45/45 |
| Blockunabhängig | 45/45 |
| Neustartidentisch | 45/45 |
| Stumme A500-Titel im Messfenster | 0 |

Der höchste ungeclippte A500-Float-Peak beträgt `1,2569701671600342` bei `amberstar/Ode_To_Schnism.hipc`. Dieser Wert liegt vor dem separaten Master-DSP und ist kein Produktions-Clippingbefund. Der Browserausgang nach Master-DSP wurde separat geprüft.

Zusätzlich bestehen COSO/HIPC, HIP68K, MOD und XM alle zwölf Fälle bei 44.100, 48.000 und 96.000 Hz. Vier wiederholte 60-Sekunden-Läufe sind endlich und deterministisch.

| Lauf | maximales Offline-Echtzeitverhältnis |
|---|---:|
| COSO/HIPC Level 1 | 0,1458788695 |
| HIP68K Title | 0,1497439295 |
| MOD ELYSIUM | 0,1474058169 |
| XM space_debris | 0,1724258061 |

Über den Fünf-Sekunden-Korpus liegt der langsamste Titel `DEADLOCK.XM` bei `0,1926896546`. Die Messung enthält drei diagnostische Hash-Abgriffe und deren Overhead. Alle Werte liegen unter dem Offline-Echtzeitbudget 1; daraus folgt keine Aussage über Audio-Underruns auf beliebigen Endgeräten.

## 3. Chromium- und Master-DSP-Abnahme

Chromium 151.0.7922.108 durchläuft den echten `audio-controller.js`, das registrierte `paula-exact-processor`, die realen Playlist-Parser und den Master-DSP. Die Engine-Abnahme umfasst vier Titel je Abtastrate und Viewport:

- COSO/HIPC: Wings of Death Level 1,
- HIP68K: Wings of Death Title,
- MOD: ELYSIUM,
- XM: space_debris.

Damit ergeben sich 16 bestandene Engine-Läufe bei 44.100 und 48.000 Hz auf Desktop und Mobile. Alle Ausgänge sind endlich und hörbar, der AudioContext läuft mit der angeforderten Rate, und jeder Master-Peak bleibt unter dem Gate `1,001`. Der höchste gemessene Engine-Master-Peak beträgt `0,6916207075119019`; der kleinste RMS-Wert bleibt mit `0,0033523109617795478` oberhalb des Hörbarsignal-Gates.

Die vollständigen Desktop- und Mobile-UI-Läufe bestehen ebenfalls. Sie verwenden Boot, Theme- und Trackauswahl, öffnen das HUD über dessen echten Inaktivitäts-/Eingabepfad und schalten die Amiga-LED per Klick. Beide Läufe bestätigen den Registry-Namen `Exact / A500`, hörbare Master-Ausgabe und den Filterwechsel von Track-Modus zu erzwungenem LED-Filter.

`ELYSIUM.MOD` beginnt mit ProTracker-Effekt `E01` und schaltet das LED-Filter daher selbst in Bypass. Die Abnahme erwartet nun korrekt diesen titelspezifischen Zustand. Der manuelle Zyklus liefert `LED erzwungen an → LED erzwungen aus → Track-Bypass`; ein pauschaler MOD-Standardwert „LED an“ wäre für diesen Titel falsch.

## 4. Hot-Path und Kommunikation

Ein heapstabiler HIP68K-/A500-Dauerlauf mit wiederverwendeten Ausgabepuffern besteht die Grenze von weniger als 512 KiB Heap-Zuwachs nach Warm-up und Garbage Collection. Der Test läuft mit `--expose-gc` und wird nicht übersprungen.

Die Produktionskommunikation wurde an den tatsächlichen Stand angeglichen:

- Registry: `Paula 8364 (Exact / A500)` statt `192kHz True Analog`,
- ZOH-Darstellung: vierfache Host-Abtastrate statt fester 192 kHz,
- lineare A500-Approximation mit 4,421-kHz-RC und optionalem 3,09-kHz-LED-Filter,
- keine aktiven LF347-/Slew-Rate- oder zusätzlichen `tanh`-Behauptungen mehr,
- COSO-Timing als PAL-CIA-Tick mit etwa 50 Hz statt exaktem 50-Hz-VBLANK,
- `initAudioEngine()` akzeptiert optional eine explizite Abtastrate für reproduzierbare Browserabnahmen; der Produktionsaufruf ohne Argument verwendet weiterhin die Host-Rate.

Die sichtbare Releaseversion und die Trackauswahl wurden in dieser technischen Phase nicht verändert.

## 5. Verifikation

- Phase-5-Suite: 10/10 Tests bestanden, keine Auslassungen.
- Fokussierte Amiga-/Replay-Suite: 213/213 Tests bestanden, keine Auslassungen.
- Frischer Overlay aus Originalarchiv und Phase 0–5: 213/213 Tests bestanden, keine Auslassungen.
- Gesamte Projektsuite: 338/339 Tests bestanden, keine Auslassungen. Der einzige Fehler bleibt der bekannte, nicht amigabezogene SID-Korpus-Altfehler `SID synthetic corpus matches the reviewed Phase 3 raw/trace/WAV hashes`; dessen Baselines wurden nicht überschrieben.

## 6. Reproduktion

```bash
# Vollständiger Offline-Produktionskorpus
node tools/amiga-production-acceptance.mjs \
  --seconds 5 --long-seconds 60 \
  --report doc/verification/amiga/phase5-production-corpus.json

# Echte Chromium-, Master-DSP- und UI-Abnahme
NODE_PATH=$(npm root -g) CHROMIUM_PATH=/usr/bin/chromium \
  node tools/amiga-browser-acceptance.mjs \
  --milliseconds 600 \
  --report doc/verification/amiga/phase5-browser.json

# Phase 5 einschließlich Heapprüfung
node --expose-gc --test test/amiga-phase5.test.mjs

# Fokussierte Amiga-/Replay-Suite
node --expose-gc --test \
  test/amiga-phase0.test.mjs test/amiga-phase1.test.mjs \
  test/amiga-phase2.test.mjs test/amiga-phase3.test.mjs \
  test/amiga-phase4.test.mjs test/amiga-phase5.test.mjs \
  test/hipc-parser.test.mjs test/coso-replayer.test.mjs \
  test/coso-vm.test.mjs test/hip.test.mjs test/m68k.test.mjs \
  test/paula-hw.test.mjs test/paula-visualizer.test.mjs

# Gesamte Projektsuite
node --expose-gc --test test/*.test.mjs
```

## 7. Verbleibende Grenzen

- Es liegen keine bereitgestellten Hardware- oder UADE-Referenz-WAVs für eine externe Klang- und Pegelabnahme vor.
- RC- und LED-Filter bleiben dokumentierte Softwareapproximationen, keine gemessene Mainboard-Kalibrierung.
- Headless-Chromium-Viewports sind keine physischen Mobilgeräte; Lautsprecher-, Latenz- und Underrun-Verhalten realer Geräte wurde nicht gemessen.
- Die Kuratierung der Amiga-Trackauswahl folgt erst nach Abschluss der technischen Phasen.
