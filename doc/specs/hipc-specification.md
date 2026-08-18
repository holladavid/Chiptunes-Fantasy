# Technische Spezifikation: Jochen Hippel (Mad Max) COSO / HIPC-Format

Diese Spezifikation beschreibt das **HIPC-Format** (häufig als **COSO** für *Compressed Song* bezeichnet) [99], welches von **Jochen Hippel (Mad Max)** auf dem Atari ST und Amiga entwickelt wurde [3, 75]. Das Format stellt eine proprietäre, komprimierte Weiterentwicklung des klassischen TFMX-Musiksystems dar und zeichnet sich durch integrierte digitale Samples sowie optimierte M68k-Laufzeitstrukturen aus [3, 99].

---

## 1. Systemarchitektur & Wiedergabe-Eigenschaften

* **Single-File-Architektur:** Im Gegensatz zu Chris Hülsbecks klassischem TFMX-System (das getrennte `.mdat`-Musikdaten und `.smpl`-Samplebanken erfordert) vereint das COSO/HIPC-Format Songdaten, Tracktabellen, Pattern und PCM-Samples in einer einzigen, selbsttragenden Binärdatei [55].
* **Paula Wiedergabe-Schnittstelle:** Auf dem Amiga nutzt die Replay-Engine standardmäßig eine synchrone **50Hz VBLANK polyphone Routine** [1].
* **Kanal-Belegung (Panning):** Die Wiedergabe erfolgt fest über die vier Hardware-Kanäle des Amiga-Paula-Chips im Panning-Schema **L-R-R-L** (Kanal 0 Links, Kanal 1 Rechts, Kanal 2 Rechts, Kanal 3 Links) [1].

---

## 2. Header-Spezifikation (M68k-Binärstruktur)

Der Header eines HIPC-Moduls ist so entworfen, dass er gleichzeitig gültigen Motorola 68000 Maschinencode enthält, was oft als "Replayer in the front" bezeichnet wird, um mit DeliTracker/EaglePlayer kompatibel zu sein [3, 33]. Er lässt sich bytegenau wie folgt rekonstruieren [103, 127]:

### Offset-Tabelle

| Byte-Offset | Datentyp | Wert / Hex | Beschreibung / Disassemblierter M68k-Opcode |
| :--- | :--- | :--- | :--- |
| **`$0000`** | `uint16` | `$434F` | ASCII-Zeichen `"CO"` (Magic Byte) [103, 127] |
| **`$0002`** | `uint16` | `$534F` | ASCII-Zeichen `"SO"`; disassembliert als `SUBQ.W #1, A7` [103, 127] |
| **`$0004`** | `uint16` | `$003C` | Disassembliert als Teil des Opcodes `ORI.B #$40, D0` [103, 127] |
| **`$0006`** | `uint16` | `$0040` | Disassembliert als Teil des Opcodes `ORI.B #$40, D0` [103, 127] |
| **`$0008`** | `uint16` | `$0000` | Platzhalter / Datenwort [103, 127] |
| **`$000A`** | `uint16` | `$02E4` / `$02F6` | Subsong-Offset/Parameter (variiert, z. B. `$02E4` für Level 1 [103], `$02F6` für Level 2 [127]) |
| **`$000C`** | `uint16` | `$0000` | Platzhalter [103, 127] |
| **`$000E`** | `uint16` | Variabel | Weitere disassemblierte Code-Segmente (z.B. `MOVEP.L` [127] oder `BSET` [103]) |

### Wichtige Header-Anomalien

1. **Dragonflight-Ausnahme:** Bei bestimmten Rips (z. B. *Dragonflight*) wird die charakteristische `"CO"`-Signatur an Offset `$0000` im Header durch **zusätzliche globale Lautstärkewerte (Volume Information)** überschrieben [29]. Ein robuster Parser darf daher nicht exklusiv auf das Vorhandensein von `"COSO"` prüfen, sondern muss diesen Offset tolerant behandeln [29].
2. **Die `"MX"`-Signatur:** Später im Header befindet sich an einem festen Offset das ASCII-Wort `"MX"` (`$4D58`), welches im Quelltext als Befehl getarnt ist (`MOVE.B $5446(A6), $4D58(A1)` – wobei `$5446` für ASCII `"TF"` und `$4D58` für ASCII `"MX"` steht) [103]. Dies kennzeichnet die Verwandtschaft mit dem *Mad Max Music Editor (MMME)* bzw. der TFMX-Struktur [3, 99].

---

## 3. Sample-Handhabung & Vorzeichenkonvertierung

Der Parser muss je nach Herkunft des Musik-Rips (Atari ST vs. Amiga) die Sample-Daten unterschiedlich interpretieren [33, 40]:

* **Atari ST-Rips (Unsigned):** Der ursprüngliche Atari ST-Soundchip (YM2149) verwendet standardmäßig **vorzeichenlose (unsigned) 8-Bit-PCM-Samples** [33, 40, 83].
* **Amiga-Paula-Rips (Signed):** Der Amiga-Paula-Chip erwartet zwingend **vorzeichenbehaftete (signed) 8-Bit-PCM-Samples** [40].
* **Parser-Implementierung:** Wenn ein Player ST-Rips auf dem Amiga oder einem modernen PCM-Mischer abspielt, müssen die unkomprimierten PCM-Samples durch Subtraktion von `128` (bzw. Bit-Invertierung des MSB) von Unsigned in Signed konvertiert werden (bzw. umgekehrt), da es sonst zu extremem Rauschen und Verzerrungen kommt.

---

## 4. Frequenztabellen & Perioden-Limitierung

Die Wiedergaberoutine von Jochen Hippel unterliegt harten Limitierungen des Amiga-Hardware-Schnittstellendesigns [7, 18]:

* **Perioden-Untergrenze:** Hippels Standard-Amiga-Player begrenzt die Paula-Periodenwerte nach unten auf **`$71`** (was einer maximalen Wiedergabefrequenz von ca. 28 kHz entspricht) [7, 18, 19].
* **Sicherer PAL-Bereich:** Der tatsächliche stabile Grenzwert für PAL-Amigas liegt bei etwa **`$7C`** (ca. 28.6 kHz) [18, 19]. Frequenzen darüber hinaus können auf echten 15kHz-PAL-Bildschirmen zu Aussetzern führen [19, 21].
* **ST-Kompatibilität & Tabellenerweiterung:** Wenn du originale Atari-ST-Musikstücke abspielst, musst du die Paula-Periodentabelle zwingend nach unten hin erweitern (niedrigere Periodenwerte = höhere Frequenzen), da die Samples sonst deutlich verstimmt und zu tief abgespielt werden [8].

---

## 5. Effekt-Spezifikation (Portamento & Vibrato)

Die Effekte in HIPC/COSO weichen teilweise eklatant vom klassischen Hülsbeck-TFMX ab [13, 43]. Hier müssen folgende mathematische Regeln implementiert werden:

### A. Portamento-Kompensation (Oktav-Skalierung)
Das größte Problem bei Portamento-Gleitlauten in HIPC liegt in der unskalierten Frequenzberechnung im M68k-Treiber [37]. 

Wenn ein Track in der Tracktabelle transponiert ist, ändert sich der Basisfrequenz-Periodenwert drastisch [37]. Da der M68k-Replayer den Portamento-Gleitwert additiv/subtraktiv direkt auf den Paula-Periodenwert rechnet, führt dies bei hohen Tönen zu einer extremen Übersteuerung des Effekts (der Ton gleitet viel zu schnell und unkontrollierbar) [37].

* **Berechnungs-Beispiel (*Wings of Death*, Track-Table Step `$21`, Voice 4, Pattern `$43`):**
  * Im Amiga-Rip ist die Transposition auf **`$F4`** (-12 Halbtöne / -1 Oktave) gesetzt [38].
  * Im Atari-ST-Rip ist die Transposition auf **`$18`** (+24 Halbtöne / +2 Oktaven) gesetzt [38].
  * Die Differenz beträgt `$18 - $F4 = $24` Halbtöne, was einer Transposition von exakt **3 Oktaven nach oben** entspricht [37, 43].
* **Die Skalierungsregel:** Um die Portamento-Geschwindigkeit bei einer Aufwärtstransponierung konstant zu halten, muss der Portamento-Ebene-Parameter (Speed/Level) im Parser skaliert werden [41, 43]:
  $$\text{Portamento\_Neu} = \frac{\text{Portamento\_Original}}{2^N}$$
  Wobei $N$ die Anzahl der nach oben transponierten Oktaven darstellt. Bei einer Erhöhung um 3 Oktaven müssen die Portamento-Parameter zwingend **durch $8$ ($2^3$) dividiert** werden, da der Song andernfalls unerträglich verstimmt klingt [41, 43].

### B. Portamento-Modelle
Der Parser muss zwischen zwei Wiedergabemodi unterscheiden [15, 26]:
1. **TFMX-Style Portamento:** Der ältere Modus (z. B. verwendet in *Dragonflight*), welcher direkte Register-Periodenmanipulationen vornimmt [15, 26].
2. **COSO-Style Portamento:** Das neuere, von Hippel für komprimierte Dateien optimierte Portamento-Modell [15, 26].

### C. COSO-Vibrato
Das COSO-Vibrato unterscheidet sich signifikant vom herkömmlichen TFMX-Vibrato [43]. Es ist **schwächer ausgeprägt, intern weicher skaliert** und stellt bei Portamento-Kompensationen ein stabileres Abspielverhalten sicher [43].

---

## 6. Wichtige Parser-Gotchas (Kritische Implementierungsaspekte)

* **Das 2-Byte-Defizit (File Length Padding):** Ein kritischer Fehler beim Extrahieren (Ripping) von originalen Musikdaten ist, dass manche originalen Tracker-Exportdateien **um exakt 2 Bytes zu kurz** abgespeichert wurden [3]. Der Parser muss daher folgendes Sicherheitsnetz bieten [3]:
  * Berechne die Modulgröße anhand der Header-Strukturen [3].
  * Prüfe, ob die tatsächliche Dateigröße der berechneten Größe entspricht [3].
  * Sollte die Datei zu kurz sein, fülle sie am Ende mit **2 bis 30 Null-Bytes (Padding)** auf, um Speicherzugriffsfehler (Out-of-Bounds) in der Replay-Engine zu verhindern [3].
* **Systemnahe Registeroptimierungen:** Originale M68k-Treiber von Mad Max klauen Systemregister zur Laufzeitoptimierung [76, 77]. Beim Schreiben eines portablen Emulators/Parsers darf sich der Code nicht auf feste CPU-Registerzustände verlassen [75].

---

## 7. Bekannte Open-Source-Implementierungen zur Code-Analyse

Falls du Referenzquellcodes analysieren möchtest, sind diese drei Engines die am besten dokumentierten Anlaufstellen:

1. **`libtfmxaudiodecoder`** (von misc2025): Bietet hochpräzise native Dekodierung und implementiert die mathematisch korrekte Portamento-Division durch 8 bei Oktavsprüngen [11, 41, 55].
2. **`FlodJS`** (von Christian Corti / photonstorm): Ein JavaScript-Tracker-Player (ab v2.0), welcher Hippel- und COSO-Formate für 4 Stimmen nativ über die Web Audio API wiedergibt [65, 69].
3. **`c-flod`** (von rofl0r): Eine hocheffiziente C-Portierung von Flod, die ohne dynamische Speicherallokation auskommt und sich hervorragend für ressourcenarme Hardware eignet [4, 151].
