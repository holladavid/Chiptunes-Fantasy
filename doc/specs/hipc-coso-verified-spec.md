# Hippel-COSO (.hipc) — Verifizierte Layout-Spezifikation

**Status:** Phasen 2 (Forensik), 4 (Replay-Kern, Referenzmessung) und 5 (Paula-Hardwareanbindung) abgeschlossen · **Stand:** v1.5.0-dev
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
Envelope: `$E0 ticks` Sustain, `$E1..$E7` Hold, `$E8 off+5` Loop, sonst Volume (0..64), je `speed` Ticks.
In L1/L2 kommen nur Volume-Bytes und `$E1` vor. Alle Instrument-Indizes liegen im gültigen Bereich.

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

## 9. Offene Punkte

| # | Punkt | Stand |
|---|---|---|
| 1 | Tick-Arithmetik `song.speed` × `$FE/$FD`-Ticks × `channel_speed` | ✅ strukturell bestätigt (Abschnitt 10), L1 Song 0 = 64 Ticks/Division |
| 2 | Periodentabelle und Notensumme (Instrument-Pitch + Pattern-Note + Transpose) | ✅ im Bass auf ±1 Cent (Abschnitt 10) |
| 3 | Vibrato-/Portamento-Formeln | ❓ nicht isolierbar (Vibrato ≤ 0,25 %, Portamento nur 10 Vorkommen) |
| 4 | Verknüpfung Envelope × `channel_volume` | ❓ in L1/L2 ungenutzt (Division-Effekte nur `$00..$05`) |
| 5 | Instrumente ohne Terminator (7 von 37) | ❓ Hold am Elementende implementiert; Einfluss nicht messbar |
| 6 | Tickrate der Referenzaufnahme (49,707 Hz statt 50 Hz) | ❓ Ursache unbekannt (Abschnitt 10) |
| 7 | Loop-Konvention bei Samples mit `pos_loop + repeat < len` (Sample 18) | ❓ "ganze Länge, dann Loop" implementiert, nicht isoliert gemessen |
| 8 | Wellenwechsel mitten in der Note (`E2`/`E4`): DMA-Neustart oder nur LC/LEN-Latch | ⚠️ `latch` messbar leicht besser (Abschnitt 11), nicht bewiesen |
| 9 | `Wings_Of_Death-Title.hip` ist **kein COSO**, sondern das 68k-Replayer-in-front-Format (`BRA.W` bei `$00`/`$04`, Init `$08`, Play `$DC`, `"MAD MAX! * TEX * 1990"` bei `$1804`) | ❓ eigener Parser/Replay nötig |

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
* Das Tempo der Aufnahme liegt gleichmäßig 0,59 % unter 50 Hz (≈ 49,71 Hz, ±0,02). Eine globale Wiedergabe-Verlangsamung scheidet aus, weil die Tonhöhe im Bass nicht tiefer liegt. Ursache offen (Hypothesen: CIA-Timer des Spiels, Emulator-/Aufnahme-Timing). Der Adapter verwendet bis zur Klärung 50 Hz (`COSO_TICK_HZ`).
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

`hybrid` ist in Level 1 identisch zu `latch` (kein Fall "gleiches Sample, reset=1" mit Wirkung). Evidenz: moderat, nicht beweisend. `latch` ist Standard, weil es zusätzlich der Hardware-Logik entspricht (Wellenwechsel = Registerschreibzugriff).

**Nebenbefund `PaulaChannel` (nicht COSO-spezifisch):** Im unveränderten Kanal geht nach jedem `enableDMA()` das zweite Word der Sample-Daten verloren. Ein Loop-Puffer `[10,20,30,40,50,60,70,80]` erzeugt `10 20 50 60 70 80 10 20 30 40 …`. Ursache: `enableDMA()` lädt Word 1 per `fetchNextWordBuffer()` vor, die erste Ausgabe ruft es erneut auf und überschreibt es. Die Hardware-API vermeidet das (kein Vorab-Fetch), der MOD/XM-Pfad ist unverändert.

