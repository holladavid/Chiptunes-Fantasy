# Hippel-COSO (.hipc) — Verifizierte Layout-Spezifikation

**Status:** Phasen 2 (Forensik), 4 (Replay-Kern), 5 (Paula-Hardwareanbindung), 7 (zweite Referenz, Dragonflight) und 8 (UADE als Referenz) abgeschlossen · **Stand:** v1.5.0-dev
**Verifiziert an:** `Wings_Of_Death-Level_1.hipc` (18282 B), `Wings_Of_Death-Level_2.hipc` (17112 B)
**Externe Referenz (nur Gegenprüfung):** Pyrdacor/Amberstar `FileSpecs/Hippel-CoSo.md`

Legende: ✅ an beiden Dateien bewiesen · ⚠️ plausibel, aber nicht bewiesen · ❓ offen

> Dieses Dokument ersetzt `doc/specs/hipc-specification.md` und `doc/v1.5.0/hipc-parser-howto.md`.
> Beide enthielten ein geratenes Layout (siehe Abschnitt 8).

---

## 1. Header (`$0000`–`$0033`), alles Big-Endian ✅

| Offset | Feld | L1 | L2 |
|---|---|---|---|
| `$00` | `"COSO"` | ✓ | ✓ |
| `$04` | `pos_instruments` | `$0040` | `$0040` |
| `$08` | `pos_timbres` | `$02E4` | `$01CE` |
| `$0C` | `pos_monopatterns` | `$03E4` | `$02F6` |
| `$10` | `pos_divisions` | `$09EE` | `$0796` |
| `$14` | `pos_songs` | `$11FE` | `$0D72` |
| `$18` | `pos_samples` | `$1210` | `$0D7E` |
| `$1C` | `total_length` (= Beginn PCM-Bank) | `$136E` | `$0EDC` |
| `$20` | `"TFMX"` | ✓ | ✓ |
| `$24` | `num_instruments - 1` | 21 → 22 | 14 → 15 |
| `$26` | `num_timbres - 1` | 11 → 12 | 15 → 16 |
| `$28` | `num_monopatterns - 1` | 88 → 89 | 56 → 57 |
| `$2A` | `num_divisions - 1` | 171 → 172 | 124 → 125 |
| `$2C` | `$0040` (Bedeutung ❓, vermutlich max. Bytes pro Instrument-Slot) | | |
| `$2E` | `$0002` (❓ unbekannt) | | |
| `$30` | `num_songs` (**direkt**, nicht −1) | 2 | 1 |
| `$32` | `num_samples` (**direkt**, nicht −1) | 34 | 34 |

Konsistenzbeweise (beide Dateien exakt):

* Instrument-, Timbre- und Monopattern-Indextabellen: `index[0] == pos + 2·n`, streng monoton, letzte Grenze = Beginn des Folgeabschnitts.
* `(pos_songs − pos_divisions) / 12 == num_divisions`.
* Songs belegen `(num_songs + 1) · 6` Byte, Samples `(num_samples + 1) · 10` Byte. Der jeweils letzte Slot ist **Terminator/Müll** (Songs: 6 Null-Bytes; Samples: 10 Byte, in L1 beginnend mit `"SPC\0"`). Parser muss ihn ignorieren.
* Alle `pos_*` sind relativ zum Header-Beginn (hier Dateianfang).

## 2. Dateilayout ✅

```text
$0000  Header (52 B + Padding bis $0040)
pos_instruments   u16-Indextabelle + Instrument-Programme
pos_timbres       u16-Indextabelle + Timbre-Elemente
pos_monopatterns  u16-Indextabelle + Monopatterns
pos_divisions     num_divisions × 12 B
pos_songs         (num_songs+1) × 6 B   (letzter = Terminator)
pos_samples       (num_samples+1) × 10 B (letzter = Müll)
total_length      PCM-Bank (13308 B = $33FC), danach EOF
```

Indextabellen enthalten u16-Offsets relativ zum Header. Elementende = nächster Indexeintrag bzw. Abschnittsende.

## 3. PCM-Bank & Sample-Header ✅

* PCM-Bank beginnt bei `total_length`. **L1 und L2 enthalten eine byte-identische Bank** (13308 B).
* Sample-Header (10 B): `u32 pos` (**relativ zur PCM-Bank**), `u16 len>>1`, `u16 pos_loop` (Bytes), `u16 repeat>>1`.
  Beweis: Ende des letzten Samples == Bankgröße (`$33FC`) in beiden Dateien.
* Loop-Konvention: `repeat == 2 Byte` (1 Word) bedeutet **kein Loop** (Amiga-Standard).

| Sample | Länge | Loop | Bedeutung |
|---|---|---|---|
| 0–15 | 32 B | ganz | 16 Synth-Wellenformen |
| 16 | 16 B | ganz | Mini-Welle |
| 17 | 482 B | – | One-Shot |
| 18 | 6552 B | `$1028`, 1208 B | langes Sample mit Loop |
| 19, 20 | 692 B, 512 B | – | One-Shots |
| 21–28 | 16 B | ganz | Mini-Wellen |
| 29–33 | 720 / 2100 / 472 / 498 / 624 B | – | One-Shots |

## 4. Songs & Divisions ✅

**Song** (6 B): `u16 start`, `u16 end`, `u16 speed`. `start`/`end` sind **Division-Indizes, `end` inklusive** (nicht Byte-Offsets).
Beweis: Songs partitionieren die Divisions lückenlos.

| Datei | Song 0 | Song 1 |
|---|---|---|
| L1 | Div 0–167, speed 2 | Div 168–171, speed 3 |
| L2 | Div 0–124, speed 2 | – |

**Division** (12 B) = 4 Stimmen × 3 B: `u8 monopattern`, `i8 transpose`, `u8 effect`.
Alle Pattern-Indizes liegen im gültigen Bereich (max 88 bzw. 56). `effect` ist in beiden Dateien nur `0x00..0x05`, also `timbre_adjust` (`effect & 0x80 == 0`). Weitere Effekt-Codes (`0x8y` FULL-STOP, `0xEy` channel_speed, `0xFy` channel_volume) ⚠️ nur aus der Amberstar-Spec.

## 5. Monopatterns — Grammatik ✅ (89/89 und 57/57 terminieren exakt) · Flag-Semantik ⚠️

| Byte | Folge | Bedeutung |
|---|---|---|
| `$FF` | – | Pattern-Ende |
| `$FE` | `ticks` | Speed setzen (`ticks + 1`) |
| `$FD` | `ticks` | Speed setzen + Pause (Delay) |
| `note` | `info`, [`extra` wenn `info & $E0`] | Note-Event |

* ⚠️ `note > 0`: `info` = Timbre-Index (untere 5 Bit) + Flags. `$20` → Portamento (`extra` = Slope), `$40` → Instrument-Override aus `extra` (Semantik nur aus der Amberstar-Spec; die Byte-*Längen* sind bewiesen).
* Beobachtet ✅: Noten mit gesetztem Bit 7 (L1: `$8C`–`$A2`, L2: 5 Vorkommen) stehen immer mit `info = 0`, in L1 jeweils nach Portamento-Noten. Die Amberstar-Spec nennt hier nur `note = 0`; das stimmt für Wings of Death nicht.
* Implementiert ⚠️ (nicht isoliert gemessen): Tonhöhe = `note & $7F`, **kein Retrigger**, Timbre bleibt, ein laufendes Portamento endet.
* Genutzte Flag-Kombinationen in L1/L2: `0`, `$20`, `$40`.

## 6. Instrumente (Pitch-/Wave-Programm) — Opcode-Längen ✅ (nur genutzte Ops) · Semantik ⚠️

| Op | Parameter | Bedeutung | in L1/L2 genutzt |
|---|---|---|---|
| `$E0` | `pos` | Loop auf Byte `pos` im Instrument | ✓ |
| `$E1` | – | Ende / Hold | ✓ |
| `$E2` | `sample` | Wave setzen + Position zurücksetzen | ✓ |
| `$E3` | `slope, depth` | Vibrato | – |
| `$E4` | `sample` | Wave setzen; Amberstar-Spec: wie `$E2` (Reset-Unterschied ❓ unbestätigt) | ✓ (Wave-Animation) |
| `$E5` | 8 B (`sample`, `loop`16, `len>>1`16, `delta>>1`16, `speed`) | SAMPLE + SLIDE (Loop-Fenster wandert) | – (Länge nur aus Amberstar-Spec, ungeprüft) |
| `$E6` | 5 B | SLIDE | – |
| `$E7` | `sample` | Sample ohne Reset + RESET-VOL | – |
| `$E8` | `ticks` | Instrument-Delay | – |
| `$E9` | 2 B | Sample mit Offset | – |
| `<$E0` | – | Pitch (1 Tick); Bit 7 = absolut, sonst relativ | ✓ |

❓ Offen: 7 von 37 Instrumenten (L1: 9, 11, 12, 13, 15 · L2: 9, 11; alle exakt 64 B groß, Wave-Animationen) enden **ohne `$E0`/`$E1`**. Vermutung: Hold am Elementende. Muss gegen Referenz-Rendering geprüft werden. Timbres sind in beiden Dateien durchgehend terminiert.
❓ Manche Elemente enden mit einem einzelnen Rest-Byte nach `$E1` (L2 Instrument 14: `e1 0e`; L1 Timbre 11: `e1 4d`), vermutlich Padding.

## 7. Timbres — Header-Plausibilität ✅ · Envelope-Semantik ⚠️

Header (5 B): `speed`, `instrument` (`$80` = nicht überschreiben), `vib_slope`, `vib_depth`, `vib_delay`.
Envelope: `$E8 ticks` **SUSTAIN** (belegt an Dragonflight, Abschnitt 14), `$E0 pos` LOOP (element-relativ, ⚠️ nur aus Symmetrie zur Instrument-Tabelle), `$E1..$E7` HOLD, sonst Volume (0..64), je `speed` Ticks. **Achtung:** Die Amberstar-Spec nennt `$E0` SUSTAIN und `$E8` LOOP; das widerspricht den Dragonflight-Daten.
In L1/L2 kommen nur Volume-Bytes und `$E1` vor, Dragonflight nutzt zusätzlich `$E8`. Alle Instrument-Indizes liegen im gültigen Bereich.

## 8. Widerlegt durch die Forensik (alter Parser/VM)

| Annahme im alten Code | Befund |
|---|---|
| Header: 4 Pointer + „Flags" bei `$04/$06` | 7 Pointer ab `$04`, Counts ab `$24` |
| „Subsong-Tabelle" bei `$20` mit 4×u16 | `$40`ff. ist die **Instrument-Indextabelle** |
| Wavetable-Bank bei `$1C3E` / `$17AC` | Treffer liegt **mitten in Sample 18** (PCM-relativ `$08D0`). Echte Wellen: PCM `$0000`–`$01FF`. |
| IRA-„BRA.S"-Artefakt als Präambel | PCM-Daten, als Code fehlinterpretiert |
| Sample-Deskriptor 16 B | 10 B |
| Track-Orderliste mit E0/E2/E4/E8 | Divisions (12 B) + Songs (6 B) |
| Pattern-Header `08 delay macro` | existiert nicht |
| 1 „Sound-Macro" pro Stimme | Timbre (Volume-Env.) **plus** Instrument (Pitch/Wave) |
| „Subsong 1 = Hauptthema" (L1) | Song 0 = 168 Divisions (Hauptmusik), Song 1 = 4 Divisions |
| Portamento ÷ 2^N | stammt aus ST-Rip-Konvertierung, hier unbelegt |

## 9. Stand der Annahmen

Referenz seit Phase 8: UADE-Renderings (Abschnitt 15). Die YouTube-Aufnahmen (Abschnitte 10, 12, 14) haben nur eine grobe Spektralmessung erlaubt und sind in mehreren Punkten **überholt**.

| # | Punkt | Stand |
|---|---|---|
| 1 | Tick-Arithmetik `song.speed` × `$FE/$FD`-Ticks × `channel_speed` | ✅ gegen UADE (Songlängen auf 0,02 % genau) |
| 2 | Periodentabelle, Notensumme (Instrument-Pitch + Note + Transpose) | ✅ Wellenformen stimmen Wert für Wert (Korrelation 0,997) |
| 3 | Tickrate des Players | ✅ 50 Hz (CIA-Timer 14188 = 49,9985 Hz); die 49,707 Hz der YouTube-Aufnahmen sind ein Aufnahmeartefakt |
| 4 | Portamento | ✅ **Formel der Amberstar-Spec** `period·t·slope>>10`, `t = 1` im ersten Tick (R² 0,77 gegen ≈ 0,3 bei jeder Alternative). Der frühere additive Fit ist **verworfen** |
| 5 | Vibrato | ✅ Startwert `+depth/2`, Skala `>>10`, keine Wirkung während der Verzögerung, erst anwenden dann weiterschalten, Rundung Richtung Null. ⚠️ Schrittweite/Randverhalten nur teilweise bestimmt |
| 6 | Notenstart | ✅ startet die DMA **nicht** neu; nur `$E2` (SAMPLE mit Reset) tut das |
| 7 | Wellenwechsel mitten in der Note | ✅ `$E4`/`$E7` latchen nur AUDxLC/LEN, `$E2` startet neu (`split`); `restart` und `latch` brechen je ein Instrument-Paar ein |
| 8 | Envelope-Opcode `$E8` | ✅ **SUSTAIN(ticks)** (Audio: +5 Punkte erklärte Energie gegen die Spec-Lesart), `$E0` = LOOP ❓ ungeprüft |
| 9 | Instrumente ohne Terminator | ⚠️ der Zeiger läuft in die Bytes des Folge-Instruments weiter (`continue`), leicht besser als Hold; Stille und Restart schlechter |
| 10 | Loop-Konvention Sample 18 | ✅ für Level 1 irrelevant (Loop-Region wird nie erreicht) |
| 11 | Timbre-Aliase (zwei Indexeinträge, ein Offset) | ✅ Elementende = nächster größerer Offset; Dragonflight Timbre 3 ist stumm |
| 12 | Envelope × `channel_volume`, `E5`, `E6`, `E9`, `E0`-LOOP, `FULL-STOP` | ❓ in keiner der drei Dateien genutzt |
| 13 | `word2E` im Header | Beobachtung: entspricht in allen drei Dateien dem Speed von Song 0 (2, 2, 5) |
| 14 | `Wings_Of_Death-Title.hip` (68k-Replayer-Format) | ⚠️ Datenlayout großteils entschlüsselt (Abschnitt 13), Pattern-Zeilensemantik offen |

## 10. Referenzmessung (Phase 4)

**Referenz:** `level-1.wav`, Aufnahme von Level 1 (44,1 kHz, 16 Bit, 232,29 s, beide Kanäle identisch). Der WAV-Header trägt einen Platzhalter (1073741823 Frames), die Länge muss aus der Dateigröße berechnet werden. Die Aufnahme enthält Ladesound und Schussgeräusche, die Musik beginnt bei 10,75 s.

**Methode:** 48-Band-Log-Spektrogramm (60 Hz–6 kHz, 50-ms-Raster, pro Band mittelwertfrei), normierte Kreuzkorrelation (ncc) zwischen Modell-Rendering und Referenz. Schussgeräusche und fehlende Analogfilter drücken die absoluten Werte; belastbar sind die relativen Vergleiche.

| Messung | Ergebnis |
|---|---|
| Songlänge Modell, L1 Song 0 | 10752 Ticks = 168 Divisions × 64 Ticks; alle 4 Stimmen je Division gleich lang |
| Wiederholungsperiode in der WAV | 5,15 s (= 4 Divisions) |
| Modell bei 50,000 Hz | ncc 0,25 (z = 5,5), linearer Drift +0,59 % (0,85 s nach 150 s) |
| Modell bei 49,707 Hz | ncc 0,48, 30-s-Fenster 0,46–0,63, Restdrift 0 über 200 s |
| 4-s-Segmente (49,707 Hz) | Median 0,53, p10 0,43, p90 0,68 |
| Tonhöhe 80–250 Hz | im Mittel +1 Cent (einzelne Blöcke streuen bis ±15 Cent) |
| Tonhöhe 250–700 / 700–1600 / 1600–3500 Hz | +1 / +3 / +5 Cent |
| Laufzeitpfad (Adapter + `PaulaChannel`) | ncc 0,483 gegenüber 0,479 im Analyse-Renderer |

Die Messmethode für die Tonhöhe wurde mit einer künstlich um 0,4 % verschobenen Kopie validiert (erwartet +6,9, gemessen +6,7 Cent).

**Schlüsse:**

* Noten, Division-Raster und Tick-Arithmetik passen über 200 s ohne Restdrift. Eine falsche Speed-Semantik würde ungleichmäßig driften.
* Das Tempo der Aufnahme liegt gleichmäßig 0,59 % unter 50 Hz (≈ 49,71 Hz, ±0,02). Eine globale Wiedergabe-Verlangsamung scheidet aus, weil die Tonhöhe im Bass nicht tiefer liegt. Ursache offen (Hypothesen: CIA-Timer des Spiels, Emulator-/Aufnahme-Timing). Der Adapter verwendet 50 Hz (`COSO_TICK_HZ`). **Geklärt in Abschnitt 15:** Die Abweichung ist ein Aufnahmeartefakt, der Player läuft mit 50 Hz.
* Der Anstieg der Abweichung zu hohen Frequenzen (bis +5 Cent) ist nicht erklärt; er liegt in den Obertönen, nicht in den Grundtönen.

**Implementiert, aber in L1/L2 nicht belegbar** (im Code mit `UNVERIFIED` markiert): `E3`, `E5`, `E6`, `E8`, `E9`, Envelope-`SUSTAIN` und -`LOOP`, `FULL-STOP`, `channel_speed`- und `channel_volume`-Effekte der Divisions.

## 11. Hardware-Anbindung an Paula (Phase 5)

**Chip-RAM-Layout** (`CosoVirtualMachine`): Adresse `$0000` = Stille-Wort (Ziel für "kein Loop"), ab `CHIP_BASE = $0100` die PCM-Bank (Kopie, wortweise gepolstert). Sample-Adressen sind `CHIP_BASE + start`.

**Registerfolge je Stimme und Tick:**

| Replayer-Ereignis | Schreibzugriffe |
|---|---|
| `RETRIGGER` (Note-Trigger, bzw. Wellenwechsel im Modus `restart`) | `LC/LEN` = erster Durchlauf → **DMA-Start** (lädt LC/LEN sofort) → `LC/LEN` = Loop-Fenster, bzw. Stille-Wort bei Sample ohne Loop |
| `WAVE_CHANGED` mit Loop | `LC/LEN` = Loop-Fenster, greift am nächsten Reload |
| `WAVE_CHANGED` ohne Loop (One-Shot) | `LC/LEN` = Sample, **im Folgetick** `LC/LEN` = Stille-Wort |
| SLIDE (Loop-Fenster wandert) | `LC/LEN` pro Tick neu, kein Neustart |

Hardware-Semantik der Kanäle (`hwAttach`, `hwWriteLC`, `hwWriteLEN`, `hwStartDMA`, `hwStopDMA`): Schreibzugriffe auf `LC/LEN` wirken erst beim nächsten Reload am Ende des laufenden Durchlaufs, `hwStartDMA()` lädt sie sofort, `LEN = 0` bedeutet 65536 Words. Die Fantasy-Klasse interpoliert entlang des Streams (Loop-Naht, nächster Durchlauf) und nicht in angrenzende Samples der Bank. Die Legacy-API (MOD/XM) bleibt unverändert: 1600 zufällige `enableDMA`/`trigger`-Läufe liefern in Original und Patch bitidentische Ausgabe.

**Messung `waveChange` (Level-1-Referenz, 49,707 Hz, 4-s-Segmente 0–190 s, gepaart):**

| Features | restart | latch | Differenz | Segmente besser |
|---|---|---|---|---|
| 48 Bänder | 0,549 | 0,560 | +0,012 ± 0,007 (t = 1,7) | 27 / 47 |
| 160 feine Bänder | 0,527 | 0,543 | +0,016 ± 0,007 (t = 2,3) | 33 / 47 |

`hybrid` ist in Level 1 identisch zu `latch`. **Überholt:** Die Level-2-Messung (Abschnitt 14) widerlegt reines `latch` als Standard; der Standard ist jetzt `split` (`$E4`/`$E7` latchen, `$E2`/`$E5`/`$E9` starten neu).

**Nebenbefund `PaulaChannel` (nicht COSO-spezifisch):** Im unveränderten Kanal geht nach jedem `enableDMA()` das zweite Word der Sample-Daten verloren. Ein Loop-Puffer `[10,20,30,40,50,60,70,80]` erzeugt `10 20 50 60 70 80 10 20 30 40 …`. Ursache: `enableDMA()` lädt Word 1 per `fetchNextWordBuffer()` vor, die erste Ausgabe ruft es erneut auf und überschreibt es. Die Hardware-API vermeidet das (kein Vorab-Fetch), der MOD/XM-Pfad ist unverändert.

## 12. Messreihe Phase 6 (Level-1-Referenz, 49,707 Hz, gepaart)

> **Teilweise überholt (Abschnitt 15):** Der hier gefittete additive Portamento-Ansatz (`(t·slope)>>5`) ist gegen UADE **falsch**; die proportionale Spec-Formel war richtig und die grobe Spektralmessung hat sie verdeckt. Die Aussagen zu Stille am Instrumentende und zu Vibrato sind ebenfalls durch Abschnitt 15 ersetzt.

Alle Werte sind Differenzen der normierten Korrelation zur jeweiligen Basis (positiv = näher an der Aufnahme). Die Referenz stammt aus einem YouTube-Video; die Aufnahmekette (Emulator, Capture, Neuenkodierung) ist unbekannt.

| Frage | Beobachtung | Entscheidung |
|---|---|---|
| Unterminierte Instrumente, Stille am Ende | −0,013 (t = −2,9) | **verworfen** |
| Unterminierte Instrumente, Restart statt Hold | −0,001 (t = −0,8) | nicht unterscheidbar, Hold bleibt |
| Loop-Konvention (`toLoopEnd`) | exakt 0 | irrelevant für L1 (Loop-Region wird nie erreicht) |
| Vibrato aus | −0,0015 (t = −2,8) | Vorhandensein gestützt; Skalen `>>6/8/10/12` ohne klare Ordnung, Standard bleibt `>>10` |
| Portamento, Spec-Formel `period·t·slope>>10` | schlechter als "aus" (−0,021, t = −6,7) | **verworfen** |
| Portamento additiv `(t·slope·K)>>7`, K = 2/3/4/5/6/8 | +0,004 / +0,006 / +0,009 / +0,009 / +0,007 / −0,002 gegenüber "aus" (85 Noten) | **K = 4 (`>>5`)** |
| dasselbe nur auf den 6 langen Glissandi (12–56 Ticks) | K = 4: +0,082 (t = 3,6), 6 von 6 besser; proportional `>>14`: +0,045 | additiv bevorzugt |

Zusammensetzung der 91 Portamento-Noten: 82 × (slope 127, 4 Ticks), 3 × (16, 24), 3 × (18, 56), 2 × (32, 8), 1 × (64, 32). Die Gesamtstärke ist durch die Zaps gut bestimmt, die **Zeitform** (linear in `t`, proportional zu `slope`) nur durch sechs lange Glissandi. Die Formel ist ein **empirischer Fit**, nicht die Originalformel.

Gesamteffekt der neuen Standardwerte gegenüber Phase 5: 4-s-Segmente +0,008 (grobe Bänder, t = 5,9) und +0,011 (feine Bänder, t = 5,6), auf den Portamento-Fenstern +0,030 (t = 6,3).

**Tickrate:** Eine unabhängige Referenz aus einer anderen Aufnahmekette würde die Frage klären, z. B. ein WAV-Export derselben `.hipc`-Datei mit UADE. Liegt dieser bei exakt 50 Hz, ist die Abweichung ein Aufnahmeartefakt; liegt er ebenfalls bei ≈ 49,7 Hz, steckt sie im Timer des Originals.

## 13. `Wings_Of_Death-Title.hip` (unkomprimierter Hippel-Container)

Beleg: Die Datei ist der **unkomprimierte Vorläufer** des COSO-Formats, mit 68k-Replayer vorweg.

| Bereich | Offset | Befund |
|---|---|---|
| 68k-Code | ab `$0000` | `BRA.W` Init `$08`, Play `$DC`; die Periodentabelle (113er-Clamp, danach Oktave 5 `$0D60…`) endet bei `$0A93`, Codeende nicht bestimmt |
| Zählerblock | `$0A94` | `"TFMX"` + dieselben 8 Words wie COSO `$24..`: 39 Instrumente, 48 Timbres, 153 Monopatterns, 132 Divisions (jeweils Zähler + 1 wie im COSO-Header), `$40`, 4, 3 Songs, 21 Samples (jeweils direkt, Samples ungeprüft) |
| Instrumente | `$0AB4` | 39 × **64-Byte-Slots**, 37 von 39 mit gültigem `E0`/`E1`-Programm (Rest ist Füllmaterial hinter dem Terminator) |
| Timbres | `$1474` | 48 × 64 Byte, 47 von 48 plausibel; die Zeichenkette `"MAD MAX! * TEX * 1990"` liegt im Leerraum von Timbre 14 |
| Monopatterns | `$2074` | 153 × 64 Byte als **4-Byte-Zeilenraster** (16 Zeilen), keine `FF`-Streams |
| Divisions | `$46B4` | 132 × 12 Byte, maximaler Pattern-Index 152, Format wie in COSO |
| Songs | `$4CE4` | Song 0 = Divisions 0–131, Speed 4; zwei Platzhalter |
| danach | `$4CF6` | Dateinamen der Samples (`WOD_1:MVERZ3.DIG` …), dann PCM |

Offen: die Zeilensemantik des Rasters (Pausen, Dauern, Entsprechung zu `FE/FD/FF`) steht nur im Code des Replayers. Zwei Wege: (a) die Play-Routine disassemblieren und die Zeilenkodierung nachbauen, (b) einen schlanken M68000-Interpreter schreiben, der Init/Play des Originals ausführt und die Paula-Registerschreibzugriffe abgreift. (b) liefert zugleich Originaltiming und deckt weitere Dateien dieser Familie ab.

## 14. Phase 7: zweite Referenz (Level 2) und Dragonflight

### 14.1 Level-2-Aufnahme

`_Amiga__Wings_of_Death_-_Level_2.wav`: 44,1 kHz, 16 Bit, 264,13 s, beide Kanäle identisch, Header ist diesmal gültig. Musikbeginn bei 6,3 s. Die Aufnahme enthält Schussgeräusche.

| Messung | Ergebnis |
|---|---|
| Modell bei 50,000 Hz | ncc 0,20, Drift +0,576 % |
| Modell bei 49,707 Hz | ncc 0,62, 30-s-Fenster 0,47–0,64, Restdrift +0,04 % |

Level 1 lag bei 0,590 %. Beide Aufnahmen weichen also um denselben Betrag ab. Das schließt einen Einzelfall-Fehler aus, aber nicht die gemeinsame Aufnahmekette. Standard bleibt 50 Hz.

### 14.2 Out-of-Sample-Prüfung der Level-1-Fits (Level 2, 49,707 Hz)

| Entscheidung | Level 2 | Urteil |
|---|---|---|
| Portamento additiv `>>5` (Standard) gegen "aus", 52 Noten (Slopes 63/64, in L1 nicht angepasst) | +0,037 (t = 10,0), 52 von 52 besser | **bestätigt** |
| Portamento, Spec-Formel `>>10` | −0,012 (t = −2,8) | **verworfen** |
| Portamento-Skala `(t·slope·K)>>8`, K = 5…11 | Gipfel bei K = 8–9 (+0,037), K = 5 und 11 nur +0,008 | Optimum 1,0–1,12 × Standard, deckt sich mit Level 1 (≈ 1,1 ×) |
| Instrumente ohne Terminator: Stille | −0,004 (t = −4,6) | **verworfen** (wie L1) |
| dasselbe: Restart statt Hold | −0,001 (t = −2,4) | Hold bleibt |
| Vibrato aus | −0,0003 (t = −2,9) | praktisch ohne Wirkung |
| Wellenwechsel `latch` gegen `restart` | **−0,006 (t = −5,6)** | widerspricht Level 1 |
| Wellenwechsel `split` gegen `restart` | +0,003 (t = 4,3) auf L2, +0,020 (t = 2,7) auf L1 | **neuer Standard** |

Die scharfe Portamento-Spitze ist plausibel: Eine Tonrampe muss auf wenige Prozent stimmen, damit die Spektralkämme zur Aufnahme passen.

Gesamtbilanz gegenüber dem Stand von Phase 5 (Spec-Portamento, `latch`): Level 1 4-s-Segmente +0,013 / +0,015 (t = 9,2 / 7,1), Level 2 +0,009 / +0,012 (t = 6,6 / 8,7), Portamento-Fenster +0,040 bzw. +0,059 (t > 8).

### 14.3 Dragonflight Title Tune (`dragonflight_titletune.HIPC`)

Gültiger COSO-Header, 13 Instrumente, 23 Timbres, 94 Monopatterns, 170 Divisions, 1 Song (Speed 5, 22880 Ticks = 457,6 s), 10 Samples (177402 Byte PCM). Keine Referenzaufnahme vorhanden, die folgenden Befunde sind strukturell.

* **Alias-Einträge in Indextabellen:** Timbre 3 und 4 zeigen auf denselben Offset (`$12F`). Das Original dedupliziert identische Elemente, das Element des ersten Eintrags ist nicht leer. Elementende = nächster **streng größerer** Offset. Der Parser leitete es zuvor aus dem Folgeeintrag ab und machte Timbre 3 zu einem leeren Element, wodurch die Lautstärke der Vornote stehen blieb.
* **Timbre 3 ist ein stummes Timbre:** Envelope `00 00 E1`, wird 95-mal getriggert und ist nie hörbar (Note-aus).
* **Envelope-Opcode `$E8` = SUSTAIN(ticks):** In allen 6 Vorkommen steht hinter dem Operanden die Abklingrampe, die bei Loop-Lesart unerreichbar wäre. Zwei Operanden (`$20` bei Elementlängen 24 und 25) zeigen hinter das Elementende. Mit Sustain ergibt sich überall *anheben, halten, abklingen*. Ein Audiobeleg fehlt. `$E0` wurde als LOOP gesetzt (Symmetrie zur Instrument-Tabelle), ohne Beleg.
* `timbre_adjust` wird intensiv genutzt (Werte bis 22, alle 680 Division-Effekte), die Wings-Dateien nutzen nur Werte bis 5.
* `E3` kommt nur als `VIBRATO(0,0)` vor (schaltet Vibrato ab), `E7` in einem Instrument mit stummem 2-Byte-Sample.
* Instrumente sind Ein-Sample-Programme mit langen Loop-Samples (bis 47720 Byte).

## 15. Phase 8: UADE als Referenz

### 15.1 Material und Methode

`level1.wav`, `level2.wav`, `dragonflight.wav`: mit `uade123 --filter=none --panning=0` gerendert, 44,1 kHz, 16 Bit, Stereo mit harter Amiga-Trennung (links = Stimmen 0+3, rechts = 1+2, L/R-Korrelation ≈ 0). Dauer 222,824 s (L1), 160,030 s (L2), 457,652 s (Dragonflight). Modell bei 50 Hz: 160,000 s und 457,600 s. Erster Ton nach 41 ms (UADE-Anlauf). Die mitgelieferten `.txt`-Dateien sind IRA-Disassemblies der Daten (als Code gelesen) und enthalten keine Registerspuren.

Jede Stimme wird einzeln durch den echten Laufzeitpfad (Adapter + `PaulaChannel`) gerendert. Pro Tick (882 Samples) wird die UADE-Seite als Summe der zwei Stimmen der Seite per Kleinste-Quadrate angepasst. Maße:

* **feste Phase** (nur blockweise Ausrichtung): empfindlich für **Tonhöhe**, schon 0,1 % Fehler summieren sich zu Phasenfehlern.
* **lokale Phase** (±40 Samples pro Fenster freigegeben): prüft **Wellenform, Lautstärke, Hüllkurve und Wellenwechsel** unabhängig von kleiner Phasendrift.
* Isolierte Stimmen: Fenster, in denen die Partnerstimme im Modell < 3 % der Energie hat. Bei Bedarf Tiefpass 2,5 kHz (Resampling-Unterschiede).

UADE-Pegel = 1,645 × unsere 0,3-skalierte Ausgabe, konstant. Eine stabile Sample-10-Note stimmt **Wert für Wert** überein (Korrelation 0,997, Zahlen auf ±0,01).

### 15.2 Tempo

Die blockweise Ausrichtung driftet in allen drei Stücken um **27–28 ppm** (+178 Samples in 150 s, +148 in 120 s, +248 in 200 s). Das entspricht einem Tick von 49,9985 Hz = CIA-Timer 14188 (709379/14188). Der Player läuft damit praktisch mit 50 Hz; die um 0,59 % langsameren Aufnahmen vom YouTube-Video sind ein Artefakt ihrer Kette.

### 15.3 Entscheidungen, die UADE bestätigt oder umgestoßen hat

| Frage | Messung gegen UADE | Urteil |
|---|---|---|
| Notenstart startet DMA neu | `triggerRestart=0`: L2 I10 R² 0,08 → 0,80, I12 0,18 → 0,57, nichts verschlechtert | **nur `$E2` startet neu** |
| Wellenwechsel | `split`: I9 0,93, I0 0,99. `restart`: I9 0,22. `latch`: I0 0,23 | **`$E2` Neustart, `$E4`/`$E7` Latch** |
| Vibrato, Startwert/Skala | Dragonflight I5 (Slope 0, Tiefe 48, n = 1009): R² 0,98. `start=zero/bottom`, `>>9`, `>>11`: 0,12–0,19 | **Start `+depth/2`, `>>10`** |
| Vibrato, Verzögerung | Offset schon während der Verzögerung: Dragonflight 78,7 → 74,8 % | **kein Offset** |
| Vibrato, Reihenfolge/Rundung | erst anwenden: L2 I10 0,80 → 0,91; Rundung Richtung Null: I9 0,95 → 0,99 | **anwenden, dann weiterschalten, Rundung Richtung Null** |
| Portamento | Spec `>>10`: R² 0,77 (L2) und 0,76 (L1, Median 0,92); `add5`, `>>9`, `>>11`, `add4`: ≈ 0,3 | **Spec-Formel**, `t = 1` im ersten Tick (`t = 0`: 0,42) |
| Envelope `$E8` | Dragonflight ganzes Stück, Sustain gegen Spec-Lesart: +4,7 (lokal) bzw. +5,1 Punkte (fest) | **SUSTAIN(ticks)** |
| Instrumente ohne Terminator | `continue`: L2 89,1 %, L1 86,9 % gegen `hold` 88,9 / 86,3 %, `silence` 88,4 / 85,2 % | **Zeiger läuft weiter** |
| Timbre-Alias 3 (Dragonflight) | UADE-RMS nach Trigger 0,019 gegenüber 0,063 im Stück (10 Fälle) | stumm, konsistent |

**Korrekturen früherer Aussagen:** Der additive Portamento-Fit (Abschnitt 12, `(t·slope)>>5`, "an Level 2 bestätigt" in Abschnitt 14) war ein Artefakt der groben Spektralmessung der YouTube-Aufnahmen. Die Spec-Formel ist richtig. Auch die Aussage, Vibrato sei "nicht messbar", galt nur für jene Methode.

### 15.4 Stand der Übereinstimmung

Erklärte Energie der UADE-Seiten durch das Modell:

| Stück | Stand der letzten Runde (fest / lokal) | heute (fest / lokal) |
|---|---|---|
| Level 1 | 84,2 / 90,7 % | **86,9 / 95,2 %** |
| Level 2 | 87,5 / 97,4 % | **89,1 / 98,0 %** |
| Dragonflight | 81,8 / 92,0 % | **83,3 / 92,5 %** |

Mit lokaler Phase erreichen praktisch alle Instrumente R² 0,96–1,00. Der Rest bei fester Phase ist **Phasendrift**: Der relative Frequenzfehler je Instrument liegt im Median bei −1147 bis +1273 ppm (höchstens 0,13 %, 2 Cent), die größeren Werte bei Instrumenten mit Tonhöhensprüngen innerhalb weniger Ticks, wo ein halber Tick Versatz zwischen Registerschreibzeitpunkt und Tickgrenze wie ein Frequenzfehler wirkt. Statische Instrumente liegen bei −48 bis −62 ppm.

### 15.5 Offen

* `$E0` als Envelope-LOOP, `E5`, `E6`, `E9`, `channel_volume`, `FULL-STOP`: in keiner Datei genutzt.
* Schrittweite und Randverhalten des Vibratos bei Slope > 0: widersprüchliche Signale zwischen Instrumenten, nicht entschieden.
* UADE spielt Level 1 7,78 s über den ersten Durchlauf (215,04 s) hinaus; Ursache nicht geprüft (vermutlich Loop-Erkennung oder Timeout von UADE).
* Registerebene: `uade123 --write-audio` ist noch nicht ausgewertet.

