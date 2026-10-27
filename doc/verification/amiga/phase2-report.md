# Chiptunes Fantasy v1.5.4 — Amiga Exact, Phase 2

## 1. Ergebnis und Abgrenzung

Phase 2 korrigiert die gemeinsame Zeitbasis von COSO/HIPC und HIP68K sowie die im Original-HIP-Player nachgewiesenen Rasterwartezeiten. Der Exact-Worklet, der echte Paula-Vergleichsrenderer und die UADE-Auswertung verwenden nun denselben CIA-Takt. HIP68K führt die DMA- und Registerschreibzugriffe zusätzlich an ihren gemessenen Positionen innerhalb des Replay-Ticks aus.

Nicht verändert wurden COSO-Replay-Opcodes, Portamento, Vibrato, Envelopes, Wellenwechsel, MOD/XM-Effekte, Paula-Filterkoeffizienten, Sättigung, FIR und Pegel. Die referenzpflichtigen Parserwarnungen und `silentNotes` aus Phase 0 werden ohne neue externe Referenz nicht nachträglich als harmlos oder als Fehler umklassifiziert. Auch die Trackauswahl bleibt unverändert.

Die neuen Audio-Hashes sind selbst erzeugte Regressionsanker. Sie ersetzen keine erneute UADE-Messung mit den weiterhin nicht im Quellarchiv enthaltenen Referenz-WAVs und sind kein realer Hardwarebeweis.

## 2. Exakter CIA-Replay-Takt

Die verifizierte Spezifikation dokumentiert anhand dreier UADE-Vergleiche eine Drift von 27–28 ppm gegenüber der gerundeten 50-Hz-Annahme. Die gemeinsame Zeitbasis liegt deshalb jetzt zentral in `js/worklets/lib/amiga-timing.js`:

```text
PAL-Paula-Takt       = 3546895 Hz
PAL-CIA-Takt         = 3546895 / 5 = 709379 Hz
CIA-Timerperiode     = 14188
Replay-Tick          = 709379 / 14188
                     = 49,99851987595151 Hz
Tickdauer            = 20,00059206714605 ms
```

`CosoVirtualMachine` und `HipVirtualMachine` verwenden diesen Standardwert. Der Exact-Worklet berechnet seinen Sampleakkumulator ebenfalls daraus statt aus `sampleRate / 50.0`. Eine explizite `tickHz`-Option bleibt für kontrollierte Messungen möglich.

Auch `coso-render-paula.mjs` und der vereinfachte Analyse-Renderer `coso-render.mjs` starten standardmäßig mit dem CIA-Takt. `uade_fit.py` verwendet denselben Wert sowohl für das Quad-Rendering als auch für die Tickfenster der Anpassung; `--tickhz` erlaubt weiterhin ausdrückliche Gegenmessungen. `amiga-uade-reproduce.mjs` schreibt Wert und Herkunft in die Messeinstellungen und bindet die neue Timing-Quelle per SHA-256 ein.

Ein Kontrollrender mit implizitem Standard und ausdrücklich übergebenem `49.99851987595151 Hz` erzeugte bitidentische WAVs.

## 3. HIP68K-Rasterzeit

### Nachgewiesener Ablauf

Der Originalplayer führt bei einem DMA-Neustart die folgende Folge aus:

1. Audio-DMA löschen;
2. initiale LC/LEN-/PER-/VOL-Register schreiben;
3. drei Rasterzeilen über `VHPOSR` warten;
4. DMA setzen;
5. eine weitere Rasterzeile warten;
6. Loop-LC/LEN schreiben.

Im untersuchten Originalcode besteht eine Warteschleife aus zwei `VHPOSR`-Zugriffen: Anfangswert und erkannte Flanke. Der erste Start erfolgt deshalb nach sechs Zugriffen beziehungsweise drei Zeilen, die Loop-Latches nach zwei weiteren Zugriffen beziehungsweise einer Zeile.

Mit 227 Paula-Takten je PAL-Rasterzeile ergeben sich:

| Ereignis | Zeit ab Replay-Tick | Paula-Takte |
|---|---:|---:|
| DMA-Start | ca. 192 µs | 681 |
| Loop-LC/LEN | ca. 256 µs | 908 |

### Umsetzung

`HipVirtualMachine` besitzt eine vorallokierte chronologische Warteschlange für 1024 Registerereignisse. LC, LEN, PER, VOL, DMA-Start und DMA-Stopp werden mit ihrem Zeitoffset in der ursprünglichen Reihenfolge eingetragen. `advance(clockTicks)` führt fällige Ereignisse aus; der Exact-Worklet ruft diese Methode vor jedem der vier Paula-Oversamples auf. Dadurch werden insbesondere die initialen Sample-Zeiger nicht vorzeitig durch die späteren Loop-Zeiger überschrieben.

Der Produktions-Worklet und der echte Vergleichsrenderer aktivieren `rasterTiming`. Die synchrone Registerebene für Oracle-, Parser- und Seek-Tests bleibt ohne diese Option kompatibel. Stilles Vorspulen erzeugt keine Audioereignisse. Ein erneuter Trackstart verwirft die Warteschlange zusammen mit dem übrigen VM-Zustand.

Diese Änderung ist ein gezieltes Modell der dokumentierten Rasterwartezeiten, keine vollständige zyklusgenaue 68000-Busemulation. Andere HIP-Playerversionen benötigen weiterhin eigene Verifikation.

## 4. Exact-Messungen

Beide Fälle verwenden den Produktions-Worklet bei 48 kHz, vierfachem Oversampling, zwei Wiederholungen und dem Blockmuster `[1, 17, 64, 255, 3, 128]`. Master-Gain, Master-Crossfeed und Limiter bleiben ausgeschlossen.

| Fall | Dauer | Wiederholt | Blockunabhängig | Neustart = frisch | Gegenüber Phase 1 geändert |
|---|---:|---|---|---|---|
| COSO Level 1 | 1 s | ja | ja | ja | `paula`, `zoh`, `a500` |
| HIP68K Title | 1 s | ja | ja | ja | `paula`, `zoh`, `a500` |

Die Änderungen sind beabsichtigte Folgen der CIA- und HIP-Rasterkorrektur. Alle Messwerte sind endlich; HIP68K bleibt mit aktivierter Rasterzeit hörbar und ohne Playerfehler. Ein zusätzlicher einsekündiger Kontrolllauf des zweiten HIP68K-Titels `Wings_Of_Death-End.hipc` war ebenfalls fehlerfrei, endlich und hörbar (`paula`-RMS 0,17104).

Worklet-SHA-256 in Phase 1: `5eff4044743d8343b6c6de39bc2aa38efce4ba571167e8071b4d718d870000db`  
Worklet-SHA-256 in Phase 2: `daa3210d2d5cd0db2b01b090032cf092ab15674a0000ee5ed0b37f4846208b24`

### Neue Float64LE-Regressionsanker

| Fall | `paula` | `zoh` | `a500` |
|---|---|---|---|
| COSO Level 1 | `42522e05c3238b7e26201e11a541e37ae1cb193c2a340932ddc457ef94c43c3b` | `16cc273bb5e462b7dadbc4c03c0fde08b94aef10551f6f6da6f35c92dddb41bb` | `47ffd2f57581c9b63e0dadfca3a0701215f6a77e7567ee708a7c60ca0449e71f` |
| HIP68K Title | `2d6ec3bcd1509f08f2728aa04affc99250f5600df5483e6103840450312eece5` | `0ab3b1c0b7e8da773626439aa097b7e256284539f3a59cca48fc5c5ac28371ac` | `e64345f4b96fac1ae39435f8a71b95e5da8f82294039866f487c099de7a1e236` |

Zur Abgrenzung der beiden HIP-Korrekturen wurde zusätzlich derselbe CIA-Takt ohne Rasterzeit gemessen. Diese Kontrollausgabe unterscheidet sich ebenfalls auf allen Stufen von der finalen Phase-2-Ausgabe:

| Kontrolle | `paula` | `zoh` | `a500` |
|---|---|---|---|
| HIP68K, CIA-Takt ohne Rasterzeit | `8b54e71aee3600c68074f84a056bdb47a99fbdbbe21616eebd60c501f315ba59` | `86e4f570855f27dc964edb8444ebae60468a123f20a5e9ab3f82c226b42b509d` | `4276d79aaa7aa3895df016b10fd66fe4e02bc3be4eb0dd9e91bc974997c167ca` |

Die vollständigen Messdaten stehen in `phase2-exact-level1.json` und `phase2-exact-hip68k.json`.

## 5. Tests und Reproduktion

```bash
# CIA-Tick, HIP-Rasterfolge, Produktionsintegration, Allokation und aktuelle Hashes
node --expose-gc --test test/amiga-phase2.test.mjs

# Alle Amiga-nahen Tests einschließlich Phase 0/1, Parser, VMs, M68000 und Paula
node --expose-gc --test \
  test/amiga-phase0.test.mjs test/amiga-phase1.test.mjs \
  test/amiga-phase2.test.mjs test/hipc-parser.test.mjs \
  test/coso-replayer.test.mjs test/coso-vm.test.mjs test/hip.test.mjs \
  test/m68k.test.mjs test/paula-hw.test.mjs test/paula-visualizer.test.mjs

# COSO-Messreport
node tools/amiga-worklet-render.mjs \
  --input wings-of-death/Wings_Of_Death-Level_1.hipc \
  --seconds 1 --sample-rate 48000 --repeat 2 --phase 2 \
  --report doc/verification/amiga/phase2-exact-level1.json

# HIP68K-Messreport
node tools/amiga-worklet-render.mjs \
  --input wings-of-death/Wings_Of_Death-Title.hip \
  --seconds 1 --sample-rate 48000 --repeat 2 --phase 2 \
  --report doc/verification/amiga/phase2-exact-hip68k.json

# Echter Raw-/Quad-Renderer; Standardtick ist jetzt der CIA-Wert
node tools/coso-render-paula.mjs \
  --in tracks/amiga/wings-of-death/Wings_Of_Death-Level_1.hipc \
  --seconds 5 --stereo 2 --out /tmp/level1-quad.wav
```

Die fokussierte Amiga-Suite besteht aus 168 Tests und endet mit 168 bestandenen Tests ohne Fehler oder Skips. Die vollständige Suite umfasst 294 Tests: 293 bestehen, keiner wird übersprungen. Der einzige Fehler bleibt der bereits aus Phase 0 bekannte SID-Altfehler `SID synthetic corpus matches the reviewed Phase 3 raw/trace/WAV hashes` außerhalb des Amiga-Umfangs.

## 6. Historische Baselines und offene Arbeiten

Phase 0 und Phase 1 bleiben unveränderte historische Messstände. Ihre Tests prüfen Provenienz und die damals dokumentierten Befunde, statt den jeweils neueren Worklet fälschlich gegen alte COSO-/HIP-Ausgaben laufen zu lassen. Die Phase-1-Neustarttests laufen weiterhin gegen den aktuellen Worklet und bestehen auch mit Rasterzeit.

- [x] COSO und HIP68K verwenden den dokumentierten CIA-Tick statt 50 Hz.
- [x] Exact-Worklet, Raw-Renderer und UADE-Fit verwenden dieselbe Tickquelle.
- [x] HIP-DMA-Start erfolgt nach drei und Loop-Latches nach vier Rasterzeilen.
- [x] Initiale und spätere LC/LEN-Werte behalten ihre ursprüngliche Reihenfolge.
- [x] Rasterwarteschlange und `advance()` allokieren im Dauerbetrieb nichts.
- [x] COSO und HIP68K bleiben deterministisch, endlich, blockunabhängig und neustartstabil.
- [x] Keine vorgezogenen MOD/XM- oder A500-Parameteränderungen aus Phase 3/4.

Offen bleiben neue hashgebundene UADE-Audiomessungen mit konkret bereitgestellten WAVs, die referenzpflichtigen COSO-Diagnosen, eine vollständige 68000-Zyklus-/Buszeit und die Verifikation weiterer HIP-Playerversionen. Diese Punkte werden durch die aktuellen Regressionsanker nicht als erledigt ausgegeben.
