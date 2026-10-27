# Amiga Exact Worklet — Phase 3: MOD/XM

## 1. Umfang und Befund

Phase 3 korrigiert den generischen MOD-/XM-Sequencer im Produktions-Worklet `js/worklets/amiga/paula-exact.js`. Ausgangspunkt war die Phase-0-Effektmatrix des realen Bestands: sieben MOD- und drei XM-Titel, darunter 16-, 24- und 32-Kanal-XMs, variable Patternlängen, lineare Frequenzen, Panning, Sample-Offset und kontinuierliche Effekte.

Vor der Korrektur wurden Noten und Effektparameter fast ausschließlich auf Tick 0 verarbeitet. Arpeggio, Portamento, Vibrato, Tremolo und Volume-Slides liefen auf den Folgeticks nicht weiter. Lineare XM-Frequenzen, XM-Panning, Sample-Offset und XM-Globalvolume fehlten im Exact-Pfad. Die neue Phase-3-Testsuite zeigte vor der Korrektur elf funktionale Fehlschläge; nur der bereits korrekte Wechsel variabler Patternlängen bestand zunächst.

Nicht verändert wurden COSO-/HIP68K-Replay und -Timing, Paula-DMA, PAL-Takt, L-R-R-L-Hard-Panning für MOD, die bestehende `sqrt(4/N)`-Mehrkanaldämpfung, Crosstalk, LF347-/RC-/LED-Filter, Sättigung, FIR und Ausgangspegel. Auch die Trackauswahl bleibt unverändert.

## 2. Implementierte Sequencer-Semantik

### Kontinuierliche Effekte

- `0`: Arpeggio auf den Folgeticks mit zyklischer Rückkehr zur Basisperiode.
- `1`/`2`: Portamento up/down mit Effektspeicher.
- `3`: Tone-Portamento zum Ziel, ohne unerwünschten erneuten Sample-Trigger.
- `4`: Vibrato mit fortgeschriebener Sinusphase; die Basisperiode bleibt unverändert.
- `5`/`6`: Tone-Portamento beziehungsweise Vibrato zusammen mit Volume-Slide.
- `7`: Tremolo als momentane Lautstärkemodulation; die logische Kanallautstärke bleibt für Folgezeilen und Slides erhalten.
- `A`: Volume-Slide auf allen Ticks nach Tick 0, mit Clamping auf 0…64 und Effektspeicher.

Die feinen Pitch-/Volume-Untereffekte `E1`, `E2`, `EA` und `EB` aktualisieren nun ebenfalls die logischen Basiswerte. `ED`-Pattern-Delay und variable `numRows` verwenden weiterhin die vorhandene Sequencerlogik.

### Lineare XM-Frequenzen

Die Umrechnung verwendet 64 lineare XM-Periodeneinheiten je Halbton und die XM-Referenzfrequenz 8363 Hz bei C-4:

```text
linearPeriod = 7744 - 64 * note
frequency    = 8363 * 2^((4608 - linearPeriod) / 768)
paulaPeriod  = round(3546895 / frequency)
```

Damit ergibt C-4 eine gerundete Paula-Periode von 424. Tiefe lineare XM-Noten werden nicht auf die ProTracker-Grenze 856 begrenzt; diese Grenze gilt für die MOD-Perioden- und Slide-Pfade. Pitch-Slides, Fine-Slides, Arpeggio, Tone-Portamento und Vibrato verwenden dieselbe Frequenzumrechnung.

### Sample-Offset, Panning und Globalvolume

- Effekt `9` adressiert den DMA-Start mit `param * 256`, ausgerichtet auf ein 16-Bit-DMA-Wort. Parameter `00` verwendet den gespeicherten Offset. Ein Offset außerhalb des Samples erzeugt keinen Zugriff außerhalb des Puffers und keinen abschließenden Datenwort-Klick.
- XM-Sample-Panning, Effekt `8`, Volume-Column-Panning `C0…CF` und `E8` steuern die Stereomischung. Die lineare Verstärkung beträgt `L = sample * (1 - pan) * 2` und `R = sample * pan * 2`. MOD-Kanäle ohne XM-Panning behalten das physische L-R-R-L-Panning.
- XM-Effekt `10` setzt Globalvolume 0…64. Der digitale Summenpfad wird mit `globalVolume / 64` skaliert; `PLAY_TRACK` setzt den Wert auf 64 zurück.

Die Umsetzung ist ein gezielter MOD-/XM-Replay, keine vollständige FastTracker-II-Instrumentenengine. Insbesondere Instrumenten-Envelopes, Keymaps, Auto-Vibrato und die übrigen kontinuierlichen Volume-Column-Kommandos werden dadurch nicht als implementiert ausgegeben. Effekt `1B` kommt im aktuellen Korpus ausschließlich mit Parameter `00` vor und bleibt ohne belegte aktive Wirkung.

## 3. Tests und realer Korpus

`test/amiga-phase3.test.mjs` enthält 18 Tests: 13 gezielte Verhaltenstests, vier Exact-Regressions-/Neustarttests und einen vollständigen Korpusberichtstest. Die synthetischen Zellen prüfen Tick-0-/Folgetick-Trennung, Effektspeicher, Kombinationseffekte, lineare hohe und tiefe Noten, DMA-Offset, lineares Panning, Globalvolume, Mehrkanaldämpfung und variable Patternlängen.

Zusätzlich rendert `tools/amiga-modxm-corpus.mjs` jeden der zehn realen MOD-/XM-Playlist-Titel für eine Sekunde durch den Produktions-Worklet. Alle zehn Ausgaben sind auf allen drei Messabgriffen endlich. Der Bericht `phase3-modxm-corpus.json` enthält Titel-, Worklet- und Audio-Hashes sowie Format-, Effekt-, Kanal- und Patternmerkmale. Stille Anfangsabschnitte werden nicht als Fehler umgedeutet; der Korpuslauf ist ein Finite-/Integritätscheck, kein Hör- oder Hardwarevergleich.

Die historische Phase-2-Provenienz bleibt unverändert. Ihre beiden Tests prüfen weiterhin die damalige Worklet-SHA-256 als historische Angabe und zusätzlich, dass die aktuelle COSO-/HIP68K-Ausgabe bitgleich zu den Phase-2-Audioankern bleibt.

## 4. Exact-Messungen

Messbedingungen: realer Produktions-Worklet, 48 kHz, vierfaches Oversampling, Blöcke zu 128 Frames, zwei frische Läufe, zusätzlich irreguläre Blöcke und Neustartvergleich. Keine Master-Gain-, Crossfeed- oder Limiter-Stufe. Worklet-SHA-256:

```text
fe5a21871380b91dcfb11e310f21fc3265b897e242f767aaa674fba0f49f6dd4
```

| Titel / Abschnitt | Abgriff | Phase-3-SHA-256 |
|---|---|---|
| COSO Level 1, 1 s | paula | `42522e05c3238b7e26201e11a541e37ae1cb193c2a340932ddc457ef94c43c3b` |
|  | zoh | `16cc273bb5e462b7dadbc4c03c0fde08b94aef10551f6f6da6f35c92dddb41bb` |
|  | a500 | `47ffd2f57581c9b63e0dadfca3a0701215f6a77e7567ee708a7c60ca0449e71f` |
| HIP68K Title, 1 s | paula | `2d6ec3bcd1509f08f2728aa04affc99250f5600df5483e6103840450312eece5` |
|  | zoh | `0ab3b1c0b7e8da773626439aa097b7e256284539f3a59cca48fc5c5ac28371ac` |
|  | a500 | `e64345f4b96fac1ae39435f8a71b95e5da8f82294039866f487c099de7a1e236` |
| GSLINGER.MOD, 30 s | paula | `dc4ad212e76d8c475fe9db5200bb980c82e567707c2d4011efef0cd56237a108` |
|  | zoh | `1154c83554ea8e69a012b4658dc5cb31728c45ba5129e9a659d0aa5f324a5db1` |
|  | a500 | `93889c89f8d8b33012a7e414793edd4ca982f2f2cefd5707e86b06318c22bb4a` |
| space_debris.xm, 1 s | paula | `78e35614664956ed7b1f49651f1c6ebac1e247f033270f31a6a18c2b79aa1235` |
|  | zoh | `716ad047588c67053ee697b665be629218cc9f0218794234977127290df068c4` |
|  | a500 | `16dee06306ba077370f4d79b10a61459132a0c86efe4d36291f6e76227aa5c37` |

COSO und HIP68K sind gegen Phase 2 auf allen Abgriffen bitgleich. Der bisherige Fünf-Sekunden-MOD-Abschnitt änderte sich nicht, weil die korrigierten kontinuierlichen Effekte dort noch nicht aktiv sind; der Messabschnitt wurde deshalb auf 30 Sekunden erweitert. Gegen einen separat ausgeführten Phase-2-Worklet ändern sich in diesem effektaktiven Abschnitt alle drei MOD-Abgriffe. Auch die XM-Ausgabe ändert sich erwartbar auf allen Abgriffen. Der XM-RMS des Paula-Abgriffs sinkt im ersten Wiedergabesekundenabschnitt von 0,022540340745 auf 0,004387528110; wesentliche Ursachen sind das nun ausgeführte anfangs niedrige Globalvolume sowie die korrigierte lineare Frequenz-/Panning-Verarbeitung. Diese Pegeländerung ist kein eigenständiger Gütebeweis.

Alle vier Phase-3-Messreihen sind deterministisch, endlich, blockunabhängig und nach erneutem `PLAY_TRACK` bitgleich zu einem frischen Worklet.

## 5. Reproduktion und Gesamtergebnis

```bash
# Verhalten, aktuelle Exact-Hashes, Neustart und Korpusbericht
node --expose-gc --test test/amiga-phase3.test.mjs

# Fokussierte Amiga-Suite
node --expose-gc --test \
  test/amiga-phase0.test.mjs test/amiga-phase1.test.mjs \
  test/amiga-phase2.test.mjs test/amiga-phase3.test.mjs \
  test/hipc-parser.test.mjs test/coso-replayer.test.mjs \
  test/coso-vm.test.mjs test/hip.test.mjs test/m68k.test.mjs \
  test/paula-hw.test.mjs test/paula-visualizer.test.mjs

# Vollständige Suite
node --expose-gc --test test/*.test.mjs

# Alle realen MOD/XM-Titel
node tools/amiga-modxm-corpus.mjs --seconds 1 \
  --report doc/verification/amiga/phase3-modxm-corpus.json

# Effektaktiver MOD-Messabschnitt
node tools/amiga-worklet-render.mjs --input GSLINGER.MOD \
  --seconds 30 --sample-rate 48000 --repeat 2 --phase 3 \
  --report doc/verification/amiga/phase3-exact-mod.json

# XM-Messabschnitt
node tools/amiga-worklet-render.mjs --input space_debris.xm \
  --seconds 1 --sample-rate 48000 --repeat 2 --phase 3 \
  --report doc/verification/amiga/phase3-exact-xm.json
```

Ergebnis: fokussierte Amiga-Suite **186/186**, vollständige Suite **311/312**, jeweils ohne Skips. Der einzige Gesamtfehler bleibt der bereits seit Phase 0 bekannte SID-Altfehler `SID synthetic corpus matches the reviewed Phase 3 raw/trace/WAV hashes` außerhalb des Amiga-Umfangs.

## 6. Grenzen und nächste Phase

Die Audio-Hashes sind selbst erzeugte Regressionsanker, keine Hardware- oder UADE-Wahrheitsbeweise. Es wurden keine fehlenden Referenz-WAVs oder Vergleichsmetriken ergänzt. Eine vollständige FT2-Instrumenten-/Envelope-Engine, exakte Subsample-Platzierung des bisher ungenutzten Tracker-`overshoot`, ein von 64-Zeilen-Annahmen unabhängiger Seek sowie alle nicht belegten Spezialeffekte bleiben offene Arbeiten und werden nicht als gelöst ausgegeben.

Phase 4 kann sich nun isoliert auf die A500-Ausgangsstufe konzentrieren. Die Track-Kuration erfolgt weiterhin erst nach allen technischen Phasen.
