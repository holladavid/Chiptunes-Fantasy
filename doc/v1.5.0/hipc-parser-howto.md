# 💾 TECHNISCHE SPEZIFIKATION: JOCHEN HIPPEL (MAD MAX) COSO / HIPC ENGINE
**Dokument-Version:** 2.1.0-PRODUCTION (Konsolidierte Master-Spezifikation)  
**System-Fokus:** Commodore Amiga (MOS Technology Paula 8364 / 4-Kanal DMA)  
**Verifizierte Referenzmodule:** `Wings_Of_Death-Level_1.hipc` & `Wings_Of_Death-Level_2.hipc`  
**Disassembler-Basis:** IRA v2.12 Motorola 68000 Stream Dump

---

## 1. Systemübersicht & Entkoppeltes 2-Stufen-Modell

Das **COSO-Format** (*Compressed Song*, Dateiendungen `.hipc`, `.hip`, `.coso`) ist Jochen Hippels proprietäres, speicheroptimiertes Musikformat für den Commodore Amiga und Atari ST [3, 99]. Alle Daten (Tracks, Patterns, Sound-Macros, Sample-Deskriptoren und PCM/Wavetable-Audiodaten) sind in einer **einzigen Binärdatei** gebündelt [55].

Zur Vermeidung von Container-Leaks und fehlerhaften Adressannahmen ist die Replay-Pipeline strikt in zwei unabhängige Schichten entkoppelt:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. PARSER-SCHICHT (hipc-parser.js)                                          │
│    - Liest den 32-Byte Header ($0000..$001F)                                │
│    - Löst die 4-Byte Pattern-Deskriptoren in ein bereinigtes Array auf      │
│    - Validiert geradzahlige (Word-Aligned) Voice-Startadressen              │
│    - Schneidet die 5 Rohblöcke isoliert aus                                 │
│    - Extrahiert 16-Byte Sample-Deskriptoren und Signed 8-Bit PCM-Daten      │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Übergabe als formatierte Datenblöcke
                                       ▼ (patternPointers, macroPointers, etc.)
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. REPLAY-ENGINE (CosoVirtualMachine / paula-exact.js)                      │
│    - 3 getrennte Dispatcher: Track-Tuple, Pattern-Stream, Sound-Macro       │
│    - 50-Hz VBLANK Zeitachse (Frame-Takt) ohne magische Adressannahmen       │
│    - Schreibt direkt in die expliziten Paula-DMA-Register:                  │
│      AUDxLC, AUDxLEN (in Words), AUDxPER, AUDxVOL                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Der 32-Byte Container-Header (`$0000`–`$001F`)

Der Container-Header belegt exakt die ersten **32 Bytes (`$20` Bytes)** [103, 127]. Alle Tabellen-Offsets sind als **32-Bit Big-Endian Longwords** abgelegt und referenzieren absolute Byte-Positionen ab Dateianfang (`$0000`) [103, 127]:

### 2.1. Header-Layout

| Byte-Offset | Datentyp | Feldbezeichnung | Beschreibung |
| :--- | :--- | :--- | :--- |
| **`$0000`** | `char[4]` | `magic_id` | ASCII `"COSO"` (`$434F534F`) Container-Signatur [103, 127] |
| **`$0004`** | `uint16` | `init_flags` | Initialisierungs-Flags & Standard-VBLANK-Timer (`$003C`) [103, 127] |
| **`$0006`** | `uint16` | `subsong_info` | Subsong-Parameter & Voice-Konfiguration (`$0040`) [103, 127] |
| **`$0008`** | `uint32` | `ptr_pattern_table` | Absoluter Pointer zur 4-Byte Pattern-Deskriptor-Tabelle |
| **`$000C`** | `uint32` | `ptr_pattern_data`  | Absoluter Pointer zum Beginn der Pattern-Daten (Pattern 0) |
| **`$0010`** | `uint32` | `ptr_sound_macros`  | Absoluter Pointer zur Sound-Macro-Tabelle |
| **`$0014`** | `uint32` | `ptr_sample_table`  | Absoluter Pointer zur Sample-Deskriptor-Tabelle |
| **`$0018`** | `char[4]` | `tracker_sig` | ASCII `"TFMX"` (`$54464D58`) Verwandtschafts-Signatur [103] |
| **`$001C`** | `uint32` | `ptr_track_data`    | Start-Offset des Track-Header-Bereichs |

### 2.2. Empirische Verifikation an Referenz-Dateien

| Parameter | Header-Feld | Wings of Death (Level 1) | Wings of Death (Level 2) |
| :--- | :---: | :---: | :---: |
| Magic Tag | `$0000` | `"COSO"` (`$434F534F`) [103, 127] | `"COSO"` (`$434F534F`) [103, 127] |
| Pattern-Pointer-Tabelle (`ptr_pattern_table`) | `$0008` | **`$000002E4`** | **`$000001CE`** |
| Pattern-Daten-Start (`ptr_pattern_data`) | `$000C` | **`$000003E4`** | **`$000002F6`** |
| Sound-Macro-Tabelle (`ptr_sound_macros`) | `$0010` | **`$000009EE`** | **`$00000796`** |
| Sample-Deskriptoren (`ptr_sample_table`) | `$0014` | **`$000011FE`** | **`$000017AC`** (Metadaten) |
| 32B Wavetable-Start (`actualWaveOffset`) | Scan / Offset | **`$00001C3E`** | **`$000017AC`** |
| Tracker-Signatur | `$0018` | `"TFMX"` (`$54464D58`) [103] | `"TFMX"` (`$54464D58`) [103] |
| Voice-Startadressen (Subsong 0/1) | `$0028`+ | **`$0094, $009E, $00A8, $00B0`** | **`$009E, $00A8, $00B0, $00BA`** |

---

## 3. Die 5 Datenblöcke im Dateilayout

```text
$0000..$001F  (32 Bytes)   BLOCK 0: Header ("COSO", Flags, 4 Pointer, "TFMX")
$0020..ptr_patTable        BLOCK 1: Track-Orderlisten (2-Byte Tuples Voice 0..3)
ptr_patTable..ptr_patData  BLOCK 2A: Pattern-Pointer-Tabelle (4-Byte Deskriptoren)
ptr_patData..ptr_macros    BLOCK 2B: Pattern-Bytecode-Streams (Patterns 0..N, $E1 Return)
ptr_macros..ptr_samples    BLOCK 3: Sound-Macro-Tabellen & 50Hz-Modulationscode
ptr_samples..ptr_waves     BLOCK 4: Sample-Deskriptoren (16-Byte C-Structs)
ptr_waves..EOF             BLOCK 5: Sample-Bank (32B Wavetables + 8-Bit PCM Digidrums)
```

---

## 4. Aufklärung des IRA-Disassembler-Artefakts (`$1C3E` vs. `LAB_1C92`)

In der linearen IRA-M68000-Disassembly tauchte scheinbar ein Widerspruch auf: Der Rohbyte-Scanner fand die 32-Byte-Wavetables bei `$1C3E`, während in der Disassembly das Label `LAB_1C92` stand.

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
1. An Offset `$1C3C` lagen zufällig die Bytes `$60 $54`. IRA interpretierte dies fälschlich als `BRA.S` (+84 Bytes) und setzte am Ziel `$1C3C + 2 + $54 = \mathbf{\$1C92}$` ein Label.
2. Die 84 Bytes dazwischen sind **keine Präambel**, sondern die **vollständige Waveform 0, Waveform 1 und die ersten 20 Bytes von Waveform 2**.
3. **Ergebnis:** Die 32-Byte-Wavetables beginnen **ohne Lücke direkt bei `$1C3E`** (Level 1) bzw. **`$17AC`** (Level 2).

---

## 5. Die 3-stufige Replay-ISA (Befehls-Grammatik)

Die `CosoVirtualMachine` führt drei streng getrennte Decoder aus:

```text
                             ┌── [50-Hz VBLANK Tick] ──┐
                             │                         │
                             ▼                         ▼
                 [1. decodeTrackTuple]     [3. decodeMacroFrame]
                             │                         │
                             ▼                         ▼
                 [2. decodePatternStream]     Paula Register Commits
                                              (AUDxLC, AUDxLEN,
                                               AUDxVOL, AUDxPER)
```

---

### 5.1. Ebene 1: Track-Orderlist Dispatcher (`decodeTrackTuple`)
*Liest 2-Byte-Tuples: `[b0, b1]` ab `voice.trackPtr`.*

| Byte 0 | Byte 1 | Befehlsname | Ausführungslogik & Semantik |
| :--- | :--- | :--- | :--- |
| **`$00` .. `$7F`** | `Transpose` | **Pattern Call** | Startet Pattern `b0 & $7F`. Berechnet Transposition über `decodeTransposeByte(b1)`. Aktiviert `patternHeaderPending = true`. |
| **`$E0`** | `Step` | **Track Loop** | Unbedingter Sprung zurück zu Schritt `b1` in der Orderliste (`voice.trackPtr = startTrackPtr + b1 * 2`). |
| **`$E2`** | `Speed` | **Set Track Speed** | Setzt die Standard-Zeilenzeit / Delay der Stimme auf `b1` Ticks. |
| **`$E4`** | `Target` | **Subroutine Call (JSR)** | Speichert Rücksprungadresse auf `voice.trackStack` und verzweigt zur Sub-Sequenz an Adresse `Target`. |
| **`$E1`** | `00` | **Subroutine Return (RTS)** | Wenn `trackStack.length > 0`: Holt Rücksprungadresse vom Stack. Wenn Stack leer: Loopback auf Song-Start. |
| **`$E8`** | `Step` | **Track Jump** | Separater Track-Sprungbefehl / Section-Jump zu Schritt `b1`. |
| **`$FF`** | `00` | **Track End / Loopback** | Wenn `trackStack.length > 0`: Subroutine Return (RTS). Wenn Stack leer: Endlos-Loopback auf `startTrackPtr` (Game-Loop). |

#### Die isolierte Transpositionsfunktion (`decodeTransposeByte`):
```javascript
export function decodeTransposeByte(b1) {
    // M68k EXT.W (Standard Signed 8-Bit Two's Complement: -128 .. +127)
    let transp = (b1 > 127) ? (b1 - 256) : b1;
    // Musikalische Schutzschaltung gegen Oktav-Blowouts:
    if (transp < -36 || transp > 36) {
        transp = Math.max(-36, Math.min(36, transp));
    }
    return transp;
}
```

---

### 5.2. Ebene 2: Pattern-Bytecode Dispatcher (`decodePatternStream`)
*Patterns sind variable Byte-Streams, die sequenziell verarbeitet werden.*

```text
Byte gelesen:
 ├── 08 xx yy ──► PATTERN HEADER (NUR gültig wenn patternHeaderPending === true)
 │                xx = Notendauer in Ticks (Delay), yy = Default-Macro
 │
 ├── $01..$3F ──► NOTE EVENT (Inklusive Note $08 mitten im Stream!)
 │                Berechnet Period = PERIOD_TABLE[Note + Transpose]
 │                Startet Sound-Macro ab Frame 0, setzt wait = delay - 1
 │
 ├── $00      ──► REST / KEY-OFF (Schreibt AUDxVOL = 0, setzt wait = delay - 1)
 ├── $FE <id> ──► SET SOUND MACRO (Setzt voice.currentMacro = <id>)
 ├── $FD <sp> ──► SET DELAY OVERRIDE (Überschreibt Notendauer auf <sp> Ticks)
 ├── $E1      ──► PATTERN RETURN (RTS zur Track-Orderliste)
 └── $FF      ──► STREAM DELIMITER / NOP (Überspringen)
```

| Opcode | Parameter | Name | Ausführungslogik |
| :--- | :---: | :--- | :--- |
| **`08`** | `2 Bytes` | **Pattern Header** | **NUR am Pattern-Start:** Liest `08 <Delay> <Macro>`. Setzt `patternDelay = Delay` und `currentMacro = Macro`. Mitten im Stream wird `$08` als **Note 8** ausgeführt! |
| **`$01` .. `$3F`** | *keine* | **Note Event** | Berechnet Note mit Transposition und Oktaverhalt. Schreibt `AUDxPER`, setzt `AUDxVOL = 64`, triggert Sample und startet das Sound-Macro ab Frame 0. Setzt `wait = patternDelay - 1`. |
| **`$00`** | *keine* | **Rest / Pause** | Schreibt `AUDxVOL = 0` (Key-Off) und setzt `wait = patternDelay - 1`. |
| **`$FE`** | `1 Byte` | **Set Sound Macro** | Reiner Selektor: Weist der Stimme das Macro `<id>` für alle folgenden Noten zu (`voice.currentMacro = id`). |
| **`$FD`** | `1 Byte` | **Set Delay** | Ändert die Notendauer des aktuellen Patterns zur Laufzeit auf `<sp>` Ticks. |
| **`$E1`** | *keine* | **Pattern Return** | Beendet das Pattern sofort. Die VM kehrt zur Track-Orderliste zurück und liest im selben Tick das nächste Tuple. |
| **`$FF`** | *variabel* | **Delimiter** | NOP / Wartetakt vor Steuersequenzen. |

---

### 5.3. Ebene 3: Sound-Macro-VM (`decodeMacroFrame`)
*Wird bei jeder Note getriggert und pro 50-Hz-VBLANK-Frame ausgeführt. Steuert direkt die Paula-Hardware-Register.*

| Opcode | Parameter | Befehlsname | Auswirkung auf Paula DMA Register |
| :--- | :--- | :--- | :--- |
| **`$E0`** | `$00` | **End of Macro** | Hält Macro-Ausführung an. Die Note schwingt im aktuellen Zustand weiter (Sustain). |
| **`$E1`** | `<Wave_Idx>` | **Set 32B Wave** | Schreibt $\text{AUDxLC} = \text{actualWaveOffset} + (\text{Wave\_Idx} \times 32)$ und $\text{AUDxLEN} = 16\text{ Words}$ ($32\text{ Bytes}$). Triggert Schwingung nahtlos im Loop! |
| **`$E2`** | `<Volume>` | **Set Volume** | Schreibt Lautstärke `$00`..`$40` ($0$..$64$) direkt in das Register `AUDxVOL`. |
| **`$E3`** | `<Delta>` | **Volume Slide** | Addiert/subtrahiert `<Delta>` (signed int8) pro Frame auf `AUDxVOL` (ADSR-Decay). |
| **`$E4`** | `<Pitch_Delta>` | **Portamento** | Verstimmt die Periode `AUDxPER` kontinuierlich pro Frame (Vibrato / LFO / Slide). |
| **`$E5` / `$E7`** | `<Sample_ID>` | **Set Sample (PCM)** | Schreibt $\text{AUDxLC} = \text{Descriptor.absStart}$ und $\text{AUDxLEN} = \text{Descriptor.sampleLengthWords}$ für digitale Digidrums! |
| **`$E6`** | `$00` | **NOP** | Ein Frame Wartezeit ohne Registeränderung. |
| **`$E8`** | `<Step>` | **Macro Loop** | Springt auf Schritt `<Step>` des Macros zurück (Endlos-Schwebung / LFO). |

---

## 6. Sample-Deskriptoren (Block 4) & Audiodaten

### 6.1. 16-Byte Sample-Deskriptor Struct
Jeder Eintrag in Block 4 beschreibt ein digitales Sample oder Wavetable:

```c
struct CosoSampleDescriptor {
    uint32_t sampleStartOffset; // Byte-Offset relativ zu actualWaveOffset
    uint16_t sampleLengthWords; // Länge in 16-Bit Words (Bytes = Words * 2)
    uint16_t loopStartWords;    // Loop-Start in Words
    uint16_t loopLengthWords;   // Loop-Länge in Words (0 oder 1 = kein Loop / One-Shot)
    uint8_t  baseVolume;        // Basis-Lautstärke (0 .. 64)
    int8_t   finetune;          // Transpositions-Kompensation / Finetune
    uint16_t reserved;          // Padding / Flags
};
```

### 6.2. Audio-Parameter & Hardware-Limits
* **Paula Panning:** Feste Zuweisung im **L-R-R-L Schema** (Kanal 0 Links, 1 Rechts, 2 Rechts, 3 Links) [1].
* **Perioden-Untergrenze:** Hippels Treiber begrenzt Perioden nach unten strikt auf **`$71`** ($113 \approx 31.4\text{ kHz}$) [7, 18, 19].
* **Signed 8-Bit PCM:** Alle Samples im Container sind vorzeichenbehaftete 8-Bit-Integers ($-128$ bis $+127$) [40].
* **DMA Word-Alignment:** Alle Adressen (`AUDxLC`) und Loop-Grenzen sind zwingend **16-Bit-Word-aligned** (`& ~1`).

---

## 7. Verifizierter Beweis-Trace (Wings of Death Level 1)

```text
Track $0094: 01 07  ──► Ruft Pattern 1 an $0317 auf (Transpose +7)
                        Header [08 04 00] setzt Delay = 4 Ticks
                        Spielt 28 Events (112 Ticks = 2.24s) bis Terminator $E1

Track $0096: 0C 0C  ──► Ruft Pattern 12 an $04AA auf (Transpose +12)
                        FE 03 Note $16 -> Macro 3 spielt F-2 auf Stimme 0
                        FE 07 Note $1A -> Macro 7 spielt A-2 auf Stimme 1
                        FE 13 Note $1B -> Macro 19 spielt C-3 auf Stimme 2
                        (Der legendäre 3-Stimmen-Akkord aus dem Intro!)

Track $009A: E4 C2  ──► Subroutine Call (JSR) zur Sub-Sequenz an $00C2
Track $00C2..$00C8  ──► Spielt Bridge-Arrangement
Track $00C8: E1 00  ──► Subroutine Return (RTS) zurück zu $009C
Track $009C: E8 14  ──► Section-Jump zurück zu Schritt 20 ($009C) (Endlosschleife!)
```