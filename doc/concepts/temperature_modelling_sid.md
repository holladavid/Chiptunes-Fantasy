# 💾 SPEZIFIKATION: PHYSIKALISCHE TEMPERATURMODELLIERUNG MOS 6581 (SID)

Dieses Dokument beschreibt das mathematische und physikalische Modell zur Simulation der Temperaturabhängigkeiten des analogen Soundchips MOS Technology 6581 (SID). Das Modell wurde entwickelt, um die thermischen Drifteffekte echter Halbleiter in Echtzeit abzubilden, ohne die CPU-Ressourcen des Host-Systems zu belasten.

---

## 1. Das analoge thermische Phänomen (MOS 6581)

Der MOS 6581 ist ein hochgradig analoger Hybrid-Chip. Im Gegensatz zu rein digitalen Synthesizern verändern sich die physikalischen Parameter seiner internen JFET-Transistoren, D/A-Wandler (DAC) und Operationsverstärker (Op-Amps) signifikant mit der Betriebstemperatur. 

Ein "kalter" SID (ca. 15°C bis 25°C) klingt meist klirrend, scharf, höhenreich und transparent. Ein "aufgewärmter" SID (Betriebstemperatur ca. 50°C bis 65°C) oder ein heißgelaufenes Modell (bis 75°C) driftet in einen dunkleren, cremigeren Frequenzbereich ab, neigt zu weicherer JFET-Filtersättigung und weist höhere Leckströme sowie DC-Offsets auf.

---

## 2. Die mathematischen Säulen des Modells

Das thermische Verhaltensprofil koppelt die Temperatur über sieben dedizierte, nicht-lineare Gleichungen an alle analogen Verarbeitungsblöcke der Emulation.

### 2.1. Exponentieller Cutoff-Drift (VCF)
Der Kanalwiderstand der JFET-Transistoren im Filter sinkt mit steigender Temperatur nicht-linear. Dies verschiebt die Grenzfrequenz (Cutoff) sachte nach unten.
*   **Gleichung:**
    `thermalCoefficient = Math.exp(-(temperature - 55.0) * 0.003)`
*   **Auswirkung:** Bei 15°C steigt der Cutoff um $\approx 12.7\%$. Bei 75°C sinkt der Cutoff um $\approx 5.8\%$ ab (Klang wird wärmer und dunkler).

### 2.2. Integrator-Drift (g)
Die Integratorstufe des Filters erfährt eine leichte Verschiebung ihrer zeitlichen Ladekonstante.
*   **Gleichung:**
    `g = baseG * (1.0 + (temperature - 55.0) * 0.0005)`

### 2.3. Resonanz-Dämpfung (q)
Bei wärmerem Chip sinkt die Resonanzgüte (Dämpfungsfaktor des Filters) durch Halbleiter-Drift leicht ab.
*   **Gleichung:**
    `thermalDamp = 1.0 + (temperature - 55.0) * 0.0015`
    `q_final = Math.min(1.0, Math.max(0.04, q * thermalDamp))`

### 2.4. Analog JFET Saturation (Sättigungskurve)
Die JFET-Transistoren im analogen Filter besitzen eine asymmetrische Übertragungsfunktion (`Math.tanh`), die bei zunehmender Erwärmung weicher und früher einbricht (früheres, harmonisches Clipping).
*   **Gleichung:**
    `thermalJfetDrive = 0.8 * (1.0 - (temperature - 55.0) * 0.004)`
    *(Begrenzt per Failsafe auf ein Minimum von 0.1)*
*   **Auswirkung:** Heiße Chips clippen sanfter und verzerren Bässe cremiger; kalte Chips klingen transientenstark und hart.

### 2.5. VCF-Leckstrom (Leakage)
Der SID-Filter ist physisch undicht. Ein minimaler Prozentsatz des ungefilterten Signals schlüpft am Filter vorbei. Dieser Leckstrom steigt temperaturabhängig an.
*   **Gleichung:**
    `thermalLeakage = 0.09 + (temperature - 25.0) * 0.0008`

### 2.6. DC Offset Drift (VCA-Leckage)
Die analoge Lautstärkesteuerung (VCA) besitzt ein Gleichspannungs-Leck, das mit der Erwärmung ansteigt und die typischen, dumpfen Knackgeräusche (Galway-Hack) beim Wellenform-Wechsel moduliert.
*   **Gleichung:**
    `thermalDcOffset = (temperature - 55.0) * 0.005`

### 2.7. DAC Gain & Offset (Oszillatoren)
Die 8-Bit-Widerstands-Leitern (DACs) der Oszillatoren verändern ihre Linearität bei Wärme. Wir modulieren dies über eine leichte Skalierung der Amplituden-Dichte.
*   **Gleichung:**
    `thermalDacGain = 1.0 - (temperature - 55.0) * 0.0008`
    `thermalDacOffset = (temperature - 55.0) * 0.0003`
*   **Anwendung:**
    `waveOutFloat = (waveOutFloat * thermalDacGain) + thermalDacOffset`

---

## 3. Performance-Design (Stapelverarbeitungs-Paradigma)

Ein kontinuierlicher 1-MHz-Timer ist im Browser nicht performant ausführbar. Die Emulation des MOS 6581 (PAL-Takt: 985.248 Hz) wird daher über eine hochoptimierte **zyklengenaue Stapelverarbeitung (Batching)** im asynchronen `AudioWorkletProcessor` abgebildet.

### Die Weichen-Architektur:
*   **Das Web-Audio-Raster:** Das Worklet wird im nativen Audio-Raster der Soundkarte (z. B. 48.000 Hz) aufgerufen [1.1.2]. 
*   **Der Catch-Up-Loop:** Pro berechnetem Audio-Sample berechnet die Engine, wie viele Emulator-Schritte vergangen sind (bei 48 kHz sind das genau **ca. 20,5 Zyklen pro Sample**). Diese Zyklen werden in einer kompakten, internen Schleife am Stück berechnet und an den Audio-Puffer übergeben.
*   **Zero-Allocation-Performance:** Da im 1-MHz-Emulations-Takt (3 Oszillatoren * 1 MHz = 3.000.000 Zyklen pro Sekunde) absolut keine Objekte alloziiert werden dürfen, sind sämtliche thermischen Berechnungen in den unkritischen Setter ausgelagert (`updateFilterParameters()`). Im schnellen Loop laufen ausschließlich grundlegende Float-Operationen auf vor-allozierten Variablen im RAM.

---

## 4. Sicherheits-Failsafes (Anti-Crash)

Um unvorhergesehene Browser-Crashes oder unendliche Eigenschwingungen des Filters (NaN-Generierungen) durch extreme Reglereinstellungen zu verhindern, sind folgende Schutzschaltungen aktiv:

*   **JFET-Sicherheitsdeckel:** Der Wert `thermalJfetDrive` wird hart auf ein Minimum von `0.1` begrenzt. Dadurch wird eine Division durch Null im Sättigungs-Loop (`Math.tanh(bp * drive) / drive`) physikalisch unmöglich gemacht.
*   **Resonanz-Sperre:** Der Gütefaktor `q_final` wird über ein `Math.max(0.04, ...)` abgesichert. Das Filter kann sich somit niemals bis in die absolute Selbstzerstörung aufschwingen.
*   **Grenzfrequenz-Clamp:** Die Grenzfrequenz `activeCutoff` wird strikt im sicheren Bereich zwischen `30 Hz` und `16000 Hz` gehalten.