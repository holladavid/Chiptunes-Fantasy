# 💾 TECHNISCHE SPEZIFIKATION: JOCHEN HIPPEL (MAD MAX) COSO / HIPC REPLAY ENGINE
**Dokument-Version:** 2.0.0-GOLD (Konsolidierte Spezifikation nach empirischer Verifikation)  
**System-Fokus:** Commodore Amiga (MOS Technology Paula 8364 / 4-Kanal DMA)  
**Verifizierte Referenzmodule:** `Wings_Of_Death-Level_1.hipc` & `Wings_Of_Death-Level_2.hipc`  
**Disassembler-Basis:** IRA v2.12 Motorola 68000 Stream Dump

---

## 1. Systemübersicht & Container-Architektur

Das **COSO-Format** (*Compressed Song*, Dateiendungen `.hipc`, `.hip`, `.coso`) ist Jochen Hippels proprietäres, hochgradig komprimiertes Musikformat für den Commodore Amiga und Atari ST. Es stellt eine speicheroptimierte Weiterentwicklung des TFMX-Systems dar. 

Im Gegensatz zum Standard-TFMX-System (getrennte `.mdat`-Musikdaten und `.smpl`-Samplebanken) vereint COSO alle Datenstrukturen in einer **einzigen, autarken Binärdatei**:

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                      COSO SINGLE-FILE BINARY CONTAINER                       │
├──────────────────────────────────────────────────────────────────────────────┤
│ BLOCK 0: HEADER              Offset $0000..$001F (32 Bytes, Big-Endian)      │
│ BLOCK 1: TRACK ORDERLISTS    Offset $0020..ptr_patterns (2-Byte Tuples)      │
│ BLOCK 2: PATTERN STREAMS     Offset ptr_patterns..ptr_macros (Bytecode)      │
│ BLOCK 3: SOUND MACROS        Offset ptr_macros..ptr_samples (50Hz VM)        │
│ BLOCK 4: SAMPLE DESCRIPTORS  Offset ptr_samples..ptr_pcm_data (16B Structs)  │
│ BLOCK 5: SAMPLE BANK         Offset ptr_pcm_data..EOF (32B Waves + 8-Bit PCM)│
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Der 32-Byte Container-Header (`$0000`–`$001F`)

Der Header belegt exakt die ersten **32 Bytes (`$20` Bytes)**. Alle Tabellen-Offsets sind als **32-Bit Big-Endian Longwords** abgelegt und referenzieren absolute Byte-Positionen ab Dateianfang (`$0000`):

### 2.1. Header-Layout

| Byte-Offset | Datentyp | Feldbezeichnung | Beschreibung |
| :--- | :--- | :--- | :--- |
| **`$0000`** | `char[4]` | `magic_id` | ASCII `"COSO"` (`$434F534F`) Container-Signatur |
| **`$0004`** | `uint16` | `init_flags` | Initialisierungs-Flags & Standard-VBLANK-Timer (`$003C`) |
| **`$0006`** | `uint16` | `subsong_info` | Subsong-Parameter & Voice-Konfiguration (`$0040`) |
| **`$0008`** | `uint32` | `ptr_patterns` | Absoluter Pointer zur Pattern-Pointer-Tabelle |
| **`$000C`** | `uint32` | `ptr_macros` | Absoluter Pointer zur Sound-Macro-Tabelle |
| **`$0010`** | `uint32` | `ptr_samples` | Absoluter Pointer zur Sample-Deskriptor-Tabelle |
| **`$0014`** | `uint32` | `ptr_pcm_data` | Absoluter Pointer zum Beginn der Sample-Metadaten/PCM |
| **`$0018`** | `char[4]` | `tracker_sig` | ASCII `"TFMX"` (`$54464D58`) Verwandtschafts-Signatur |
| **`$001C`** | `uint32` | `ptr_track_data`| Start-Offset des Track-Header-Bereichs |

### 2.2. Empirischer Vergleich verifizierter Module

| Parameter | Header-Feld | Wings of Death (Level 1) | Wings of Death (Level 2) |
| :--- | :---: | :---: | :---: |
| Magic Tag | `$0000` | `"COSO"` (`$434F534F`) | `"COSO"` (`$434F534F`) |
| Pattern-Pointer-Tabelle (`ptr_patterns`) | `$0008` | **`$000002E4`** | **`$000001CE`** |
| Sound-Macro-Tabelle (`ptr_macros`) | `$000C` | **`$000003E4`** | **`$000002F6`** |
| Sample-Deskriptoren (`ptr_samples`) | `$0010` | **`$000009EE`** | **`$00000796`** |
| Sample-Bank / PCM (`ptr_pcm_data`) | `$0014` | **`$00001C3E`** | **`$000017AC`** |
| Tracker-Signatur | `$0018` | `"TFMX"` (`$54464D58`) | `"TFMX"` (`$54464D58`) |
| Voice 0 Start-Offset | `$0028`+ | **`$0074`** (oder `$006C`) | **`$009F`** (oder `$005E`) |

---

## 3. Die 5 Daten-Blöcke im Detail

```text
                               ┌─── [32-Byte Header] ───┐
                               │  ptr_patterns ($0008)  │ ──► [Block 2: Patterns]
                               │  ptr_macros   ($000C)  │ ──► [Block 3: Macros]
                               │  ptr_samples  ($0010)  │ ──► [Block 4: Descriptors]
                               │  ptr_pcm_data ($0014)  │ ──► [Block 5: Waves/PCM]
                               └────────────────────────┘
```

### Block 1: Track-Orderlisten (`$0020` – `ptr_patterns`)
* **Voice-Start-Pointer:** Im Bereich zwischen `$0020` und `$0060` liegen die 16-Bit-Pointers auf die Orderlisten der 4 Stimmen.
* **Format:** Jeder Orderlist-Schritt besteht aus einem **2-Byte-Tuple**: `[Byte0, Byte1]`.

### Block 2: Pattern-Pointer & Bytecode-Streams (`ptr_patterns` – `ptr_macros`)
* **Pointer-Tabelle:** Beginnt bei `ptr_patterns` als Array von **16-Bit Big-Endian Offsets (`uint16`)**.
* **Pattern-Adressierung:** Jeder Eintrag $i$ verweist auf die Startadresse des jeweiligen Patterns im Speicher:
  $$\text{Pattern-Adresse} = \text{view.getUint16}(\text{ptr\_patterns} + i \times 2)$$
* **Pattern-Anzahl:** Ergibt sich aus der Differenz zwischen `ptr_patterns` und dem ersten Pattern-Pointer:
  $$N = \frac{\text{ptr\_first\_pattern} - \text{ptr\_patterns}}{2}$$
  * *Level 1:* $(\$02FC - \$02E4) / 2 =$ **12 Patterns** (Pointer bei `$02E4..$02FB`)
  * *Level 2:* $(\$01EE - \$01CE) / 2 =$ **16 Patterns** (Pointer bei `$01CE..$01ED`)

### Block 3: Sound-Macro-Tabelle (`ptr_macros` – `ptr_samples`)
* Enthält für jedes Instrument/Sound-Macro (`$01`..`$1F`) die 50Hz-Modulationsprogramme.
* Jedes Macro besteht aus einer Folge von 4-Byte-Befehlen, die pro VBLANK-Frame abgearbeitet werden.

### Block 4: Sample-Deskriptoren (`ptr_samples` – `ptr_pcm_data`)
* Definiert die Parameter der digitalen Samples und Wavetables als **16-Byte-Structs**:

```c
struct CosoSampleDescriptor {
    uint32_t sampleStartOffset; // Relativer Byte-Offset ab ptr_pcm_data
    uint16_t sampleLengthWords; // Sample-Länge in 16-Bit Words (Bytes = Words * 2)
    uint16_t loopStartWords;    // Loop-Start in Words
    uint16_t loopLengthWords;   // Loop-Länge in Words (0 oder 1 = kein Loop / One-Shot)
    uint8_t  baseVolume;        // Basis-Lautstärke (0 .. 64)
    int8_t   finetune;          // Transpositions-Kompensation / Finetune
    uint16_t reserved;          // Padding / Flags
};
```

### Block 5: Sample-Bank (`ptr_pcm_data` – Dateiende)
* **Bereich A (32-Byte Synthesizer-Wavetables):** Ab der Basisadresse liegen $N \times 32$ Bytes nahtlos loopbarer Einzelschwingungen (16 Words), die über Macro-Befehl `$E1` dynamisch durchgeschaltet werden.
* **Bereich B (Digitale PCM-Digidrums):** Daran anschließend liegen vorzeichenbehaftete **Signed 8-Bit PCM-Audiodaten** ($-128$ bis $+127$).

---

## 4. Aufklärung des IRA-Disassembler-Artefakts (`$1C3E` vs. `$1C92` / `$1C94`)

In der linearen IRA-M68000-Disassembly tauchte scheinbar ein Widerspruch auf: Der Byte-Scanner lokalisierte die 32-Byte-Wavetables bei `$1C3E`, während in der Disassembly das Sprungziel-Label `LAB_1C92` stand.

### Der mathematische Beweis des Phantoms

```assembly
; Offset $1C3C in Wings of Death Level 1:
    BRA.S   LAB_1C92                                  ; Opcode $60 $54 (Branch Short +84 Bytes!)
    DC.L    $483c3229,$211a1411,$0e0d0c0a,$08070604  ; Waveform 0 (Byte 0..15)
    DC.L    $030000fe,$fcfaf8f7,$f5f4f2f0,$f0eeeceb  ; Waveform 0 (Byte 16..31) -> 32 Bytes!
    DC.L    $e9e8e6e3,$e2e0dedc,$dbd9d9d7,$d5d4d3d1  ; Waveform 1 (Byte 0..15)
    DC.L    $d0cfcccc,$cac8c7c5,$c4c2c1c0,$bfbebdbc  ; Waveform 1 (Byte 16..31) -> 32 Bytes!
    DC.L    $bbb9b8b7,$b6b5b4b3,$b2b1b0af,$aeadacac  ; Waveform 2 (Byte 0..15)
    DC.L    $abababa9                                ; Waveform 2 (Byte 16..19)
LAB_1C92:
    DC.W    $a8a8, $a8a7, $a7a6, $a6a5...            ; Waveform 2 (Fortsetzung ab Byte 20!)
```

### Befund:
1. An Offset `$1C3C` befanden sich zufällig die Bytes `$60 $54`. IRA interpretierte dies als `BRA.S` (+84 Bytes) und setzte am Ziel `$1C3C + 2 + $54 = \mathbf{\$1C92}$` ein Label.
2. Die 84 Bytes dazwischen sind **keine Präambel**, sondern die **vollständige Waveform 0, Waveform 1 und der Beginn von Waveform 2**.
3. **Ergebnis:** Die 32-Byte-Wavetables beginnen **ohne Lücke direkt bei `$1C3E`** (Level 1) bzw. **`$17AC`** (Level 2).

---

## 5. Die COSO Virtual Machine ISA (Befehls-Grammatik)

### 5.1. Track-Orderlist-Ebene
*Jeder Schritt verbraucht 2 Bytes: `[b0, b1]`*

```text
b0 gelesen:
 ├── $00..$7F ──► PATTERN CALL (Pattern-ID = b0 & $7F)
 │                b1 = Transposition ($80-zentriert)
 │
 ├── $E0 / $E8 ─► TRACK LOOP (Endlosschleife zu Schritt b1)
 ├── $E2      ──► SET TRACK SPEED (b1 = Ticks pro Noten-Zeile)
 ├── $E4      ──► SUBROUTINE CALL (Verzweigung zu Sub-Pattern)
 └── $FF      ──► TRACK END (Loop zu Start-Adresse)
```

#### Die `$80`-zentrierte Transpositions-Regel:
* `$80` (128) = Transposition $0$ (Grundton unverändert)
* `$80 + N` = Transposition um $+N$ Halbtöne nach oben (z. B. `$95` $\implies 149 - 128 = \mathbf{+21\text{ Halbtöne}}$)
* `$80 - N` = Transposition um $-N$ Halbtöne nach unten (z. B. `$74` $\implies 116 - 128 = \mathbf{-12\text{ Halbtöne}}$ = -1 Oktave)
* Werte $< \$40$ (z. B. `$07`) = Direkter positiver Halbton-Shift ($+7$)

---

### 5.2. Pattern-Bytecode-Ebene
*Patterns sind variable Byte-Streams, die sequenziell abgearbeitet werden.*

```text
Byte gelesen:
 ├── 08 xx yy ──► PATTERN HEADER (3 Bytes: 08 <Delay_Ticks> <Default_Macro>)
 ├── $01..$3F ──► NOTE EVENT (1 Byte: Note = b0 + Transpose, setzt wait = delay - 1)
 ├── $00      ──► REST / KEY-OFF (1 Byte: AUDxVOL = 0, setzt wait = delay - 1)
 ├── $FE <id> ──► SET SOUND MACRO (2 Bytes: Setzt aktives Instrument auf <id>)
 ├── $FD <sp> ──► SET PATTERN DELAY (2 Bytes: Überschreibt Notendauer auf <sp> Ticks)
 ├── $E1      ──► PATTERN RETURN (1 Byte: Beendet Pattern, Rücksprung zur Orderliste)
 └── $FF      ──► STREAM DELIMITER / NOP (1 Byte: Überspringen)
```

| Opcode / Byte | Folge-Bytes | Name | Ausführungslogik im AudioWorklet |
| :--- | :---: | :--- | :--- |
| **`08`** | `2 Bytes` | **Pattern Header** | Liest `08 <Delay> <Macro>`. Setzt `patternDelay = Delay` und `currentMacro = Macro`. |
| **`$01` .. `$3F`** | *keine* | **Note Event** | Berechnet $\text{Note} = b_0 + \text{Transpose}$. Ermittelt Paula-Periode `PERIOD_TABLE[Note]`. Schreibt `AUDxPER`, setzt `AUDxVOL = 64`, triggert Sample und setzt `wait = patternDelay - 1`. |
| **`$00`** | *keine* | **Rest / Pause** | Schreibt `AUDxVOL = 0` (Key-Off) und setzt `wait = patternDelay - 1`. |
| **`$FE`** | `1 Byte` | **Set Sound Macro** | Weist der Stimme das Macro `<id>` für alle folgenden Noten zu (`sampleKey = hipc_sample_<id>`). |
| **`$FD`** | `1 Byte` | **Set Delay** | Ändert die Schrittweite/Wartezeit des aktuellen Patterns zur Laufzeit auf `<sp>` Ticks. |
| **`$E1`** | *keine* | **Pattern Return** | Beendet das Pattern sofort. Die VM liest im selben Tick das nächste 2-Byte-Tuple aus der Track-Orderliste. |
| **`$FF`** | *variabel* | **Delimiter** | NOP / Wartetakt vor Steuersequenzen. |

---

### 5.3. Sound-Macro-Ebene (50Hz VBLANK Modulations-Engine)
*Wird bei jeder Note getriggert und pro 50Hz-VBLANK-Frame ausgeführt.*

| Opcode | Parameter | Befehlsname | Auswirkung auf Paula-Hardware |
| :--- | :--- | :--- | :--- |
| **`$E0`** | `$00` | **End of Macro** | Hält Macro-Abarbeitung an. Die Note schwingt im aktuellen Zustand weiter (Sustain). |
| **`$E1`** | `<Wave_Idx> <Len>` | **Set 32B Wave** | Schreibt die Basisadresse von 32-Byte-Wavetable `<Wave_Idx>` in `AUDxLC` und setzt `AUDxLEN = 16` Words (PWM/Filter-Modulation). |
| **`$E2`** | `<Volume>` | **Set Volume** | Schreibt Lautstärke `$00`..`$40` ($0$..$64$) direkt in das Paula-Register `AUDxVOL`. |
| **`$E3`** | `<Delta>` | **Volume Slide** | Addiert/subtrahiert `<Delta>` pro Frame auf `AUDxVOL` (Linearer ADSR-Fade). |
| **`$E4`** | `<Pitch_Delta>` | **Portamento** | Verstimmt die Paula-Periode `AUDxPER` kontinuierlich (Glide / Pitch-Bend). |
| **`$E5` / `$E7`** | `<Sample_ID>` | **Set Sample** | Schaltet den Kanal auf ein PCM-Digidrum aus Block 4 um (`AUDxLC` = PCM-Adresse, `AUDxLEN` = Sample-Länge). |
| **`$E6`** | `$00` | **NOP** | Ein Frame Wartezeit ohne Registeränderung. |
| **`$E8`** | `<Step>` | **Macro Loop** | Springt auf Schritt `<Step>` des Macros zurück (Endlos-Vibrato/LFO-Schleifen). |

---

## 6. Hardware-Schnittstelle & Audio-Parameter

1. **Paula DMA-Mapping:** Feste Zuweisung im **L-R-R-L Schema** (Kanal 0 Links, 1 Rechts, 2 Rechts, 3 Links).
2. **Perioden-Untergrenze:** Hippel begrenzt Paula-Periodenwerte nach unten strikt auf **`$71`** ($113 \approx 31.4\text{ kHz}$).
3. **Signed 8-Bit PCM Konvertierung:** Alle Samples sind vorzeichenbehaftete 8-Bit-Integers ($-128$ bis $+127$).
4. **DMA Word-Alignment:** Alle Sample-Pointer und Loop-Grenzen sind zwingend **16-Bit-Word-aligned** (`& ~1`).
5. **Portamento-Oktav-Kompensation:** Bei Aufwärtstranspositionen um $N$ Oktaven in der Tracktabelle muss der Portamento-Parameter durch $2^N$ dividiert werden ($\Delta_{\text{neu}} = \Delta_{\text{orig}} / 8$ bei 3 Oktaven).

---

## 7. Der bewiesene Replay-Ablauf (Trace-Verifikation)

Am Beispiel von *Wings of Death Level 1* (Voice 0 / Pattern 12 an `$04AA`):

```text
Track $0094: 01 07  ──► Ruft Pattern 1 an $0317 auf (Transpose +7)
                        Header [08 04 00] setzt Delay = 4 Ticks
                        Spielt 28 Events (112 Ticks = 2.24s) bis Terminator $E1

Track $0096: 0C 0C  ──► Ruft Pattern 12 an $04AA auf (Transpose +12)
                        FE 03 Note $16 -> Macro 3 spielt F-2 auf Stimme A
                        FE 07 Note $1A -> Macro 7 spielt A-2 auf Stimme B
                        FE 13 Note $1B -> Macro 19 spielt C-3 auf Stimme C
                        (Der legendäre 3-Stimmen-Akkord aus dem Intro!)
```