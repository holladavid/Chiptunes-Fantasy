# Hippel-COSO (.hipc) — Verifizierte Layout-Spezifikation

**Status:** Phase 2 (Forensik) abgeschlossen · **Stand:** v1.5.0-dev
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
* `note <= 0` (signed): Bytes werden gelesen, Timbre bleibt unverändert (Note 0 = Pause) ⚠️.
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

## 9. Offene Punkte (vor VM-Abnahme zu klären)

1. ❓ Tick-Semantik: `song.speed` (2/3) × `$FE/$FD`-Ticks × Division-`channel_speed`.
2. ❓ Periodentabelle (7 Oktaven, Clamp auf 113) und Summe aus Instrument-Pitch + Pattern-Note + Division-Transpose.
3. ❓ Vibrato-/Portamento-Formeln (aus Amberstar-Spec abgeleitet, hier ungeprüft).
4. ❓ Lautstärke-Verknüpfung Envelope × Division-`channel_volume`.
5. ❓ Verhalten bei Instrumenten ohne Terminator (Abschnitt 6).
6. ❓ `Wings_Of_Death-Title.hip` ist **kein COSO**, sondern das 68k-Replayer-in-front-Format (`BRA.W` bei `$00`/`$04`, Init `$08`, Play `$DC`, `"MAD MAX! * TEX * 1990"` bei `$1804`). Eigener Parser/Replay nötig.
