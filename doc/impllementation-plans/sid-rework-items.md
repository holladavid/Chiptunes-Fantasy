# Bewertung der C64-Soundemulation

Mein Urteil: eine technisch ambitionierte Eigenentwicklung mit einer guten Echtzeitarchitektur, aber noch keine Emulation auf dem Genauigkeitsniveau von reSIDfp. Besonders positiv sind die taktbasierte Verarbeitung, die drei separat modellierten Stimmen, die Filterung und das eigene Resampling. Die größten Schwächen liegen in den vereinfachten Wellenformmodellen, der fehlenden echten 8580-Unterstützung und der bislang nicht nachgewiesenen Hardware-Kalibrierung.

Ich habe die sechs zentralen Quellbereiche in `C64_SOURCES.txt` geprüft: `cpu6502.js`, `sid-chip.js`, `sid-luts.js`, `sid-waveforms.js`, `dsp-utils.js` und `sid-exact.js`. Für die Einordnung habe ich sie mit der Dokumentation und den Quellinformationen von VICE, reSID und reSIDfp verglichen.

Wichtig: Das ist ein Code-Review, kein Hörvergleich. Es liegen keine Referenzaufnahmen, Testsignale oder Messergebnisse aus einem echten SID-Chip vor. Die technische Plausibilität kann ich beurteilen; die subjektive Klangqualität deiner aktuellen Version lässt sich daraus nicht abschließend bestimmen.

## 1. Die Gesamtbewertung

## Architektur und Implementierungsaufwand

# 7/10

Für eine eigenständige JavaScript-Implementierung beachtlich.

## Grundmodell des SID

# 5–6/10

Viele richtige Grundelemente, aber deutliche Näherungen.

## Hardware- und Analogtreue

# 3–4/10

Die entscheidenden nichtlinearen Eigenschaften sind noch zu heuristisch.

## Resampling und Audioausgabe

# 5/10

Guter Ansatz, aber die Anti-Aliasing-Reserve ist fraglich.

Diese Werte sind qualitative Einschätzungen des Quellcodes, keine gemessenen Klangnoten oder standardisierten Benchmark-Ergebnisse.

Im direkten Vergleich mit etablierten Referenzimplementierungen würde ich die nachgewiesene Emulationsgenauigkeit derzeit grob bei 4/10 einordnen. Das bedeutet nicht, dass die Musik schlecht klingt. Eine charaktervolle, gut klingende SID-Interpretation und eine möglichst originalgetreue Hardwareemulation sind zwei unterschiedliche Ziele.

## 2. Vergleich mit etablierten Lösungen

| Lösung                          | Stärken                                                                                                                          | Einordnung gegenüber deinen Sourcen                                                              |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| reSIDfp                         | Reverse Engineering, modellabhängige Kennlinien, gemessene kombinierte Wellenformen, hochwertige Filter- und Resamplingverfahren | Deutlich ausgereifter bei der Hardwaretreue                                                      |
| VICE mit reSID/reSIDfp          | Eingebettet in eine etablierte C64-Emulationsumgebung, verschiedene SID-Modelle und Samplingoptionen                             | Die bessere Referenz für systemnahe Kompatibilität und Vergleiche                                |
| Deine `SIDChip`-Implementierung | Zyklusweise Verarbeitung, DSP-Filter, DAC-Näherungen, eigene Sample-Unterstützung                                                | Vielversprechende Eigenentwicklung, aber zentrale Analog- und Wellenformdetails sind vereinfacht |

reSIDfp basiert auf Reverse Engineering des MOS 6581 und MOS 8580. Das Projekt beschreibt unter anderem kombinierte Wellenformen, die anhand realer Chipmessungen modelliert wurden, nicht allein durch frei gewählte Mischformeln. Auch die Filter- und DAC-Eigenschaften wurden über Jahre anhand von Hardwareuntersuchungen verbessert.

![](https://www.google.com/s2/favicons?domain=https://github.com\&sz=32)

GitHub

+1

VICE führt verschiedene SID-Engines und SID-Modelle und dokumentiert die Unterschiede der Samplingverfahren. Die dort verfügbaren reSID-Varianten gelten als genauere Alternativen zu einfacheren SID-Emulatoren.

![](https://www.google.com/s2/favicons?domain=https://vice-emu.sourceforge.io\&sz=32)

7 Machine-specific features

+1

Das ist der Maßstab, an dem ich deine Lösung messe.

## 3. Die wichtigsten technischen Befunde

### A. Wellenformgenerator: gute Basis, aber stark angenäherte Signalformen

Positiv ist, dass du wesentliche Eigenschaften des SID digital modellierst:

* 24-Bit-Phasenakkumulatoren und 16-Bit-Frequenzregister.

* Drei unabhängige Oszillatoren.

* Dreieck, Sägezahn, Puls und Rauschen.

* Ringmodulation und Hard Sync.

* Eine eigene Behandlung kombinierter Wellenformen.

Das passt grundsätzlich zur Architektur des SID. Auch die drei Stimmen werden separat getaktet und anschließend gemischt.

C64_SOURCES.txt

Der kritische Punkt sind die kombinierten Wellenformen.

In `sid-luts.js` werden diese beispielsweise mit Formeln wie

JavaScript

```
let triBleed = (tri & ~saw) * 0.18;
let sawBleed = (saw & ~tri) * 0.12;
```

und weiteren festen Faktoren für TRI+PULSE, SAW+PULSE und TRI+SAW+PULSE erzeugt.

C64_SOURCES.txt

Das ist als heuristische Näherung brauchbar. Es ist aber keine aus diesen Quellen belegbare physikalische Rekonstruktion des SID-Wellenformgenerators. Die komplizierten Zusammenhänge zwischen den Wellenformschaltungen, der Pulsbreite, den internen Pegeln und der chipabhängigen Signalverformung werden auf einfache Tabellenfunktionen reduziert.

reSIDfp verwendet dagegen ein parametrisiertes Modell kombinierter Wellenformen, das auf Messungen realer Chips beruht.

![](https://www.google.com/s2/favicons?domain=https://github.com\&sz=32)

GitHub

Meine Bewertung: Der Generator kann musikalisch überzeugen, ist aber einer der wichtigsten Gründe, weshalb ich noch nicht von hardwaregetreuer Emulation sprechen würde.

Ein weiterer konkreter Unterschied ist die Behandlung einer deaktivierten Wellenform: `calculateWaveform8Bit()` liefert hier `0x18`. Die reSID-Entwicklung dokumentiert ausdrücklich, dass der Fall „keine Wellenform ausgewählt“ nicht einfach als gewöhnliche Stille behandelt werden sollte, sondern einen bestimmten Hardware-Ausgangspegel besitzt.

![](https://www.google.com/s2/favicons?domain=https://github.com\&sz=32)

GitHub

Das Verhalten deiner Variante sollte daher mit entsprechenden Testprogrammen direkt verglichen werden.

C64_SOURCES.txt

### B. 6581 und 8580: in den Sourcen existieren Tabellen, aber keine echte Modellumschaltung

Das ist für mich der schwerwiegendste strukturelle Mangel.

In `sid-luts.js` werden sowohl `DAC_LUT_6581` als auch `DAC_LUT_8580` erzeugt. Im eigentlichen `SIDChip` verwendet der Signalweg für Wellenform und Hüllkurve jedoch durchgehend `DAC_LUT`. Diese Tabelle wird auf die 6581-Kennlinie gesetzt. Auch die Filterkennlinie wird über eine fest codierte Formel berechnet.

C64_SOURCES.txt

C64_SOURCES.txt

C64_SOURCES.txt

Daraus folgt:

* Die deklarierte 8580-DAC-Tabelle ist nicht in einen eigenständigen 8580-Signalpfad eingebunden.

* Die Filterkennlinie ist nicht modellabhängig implementiert.

* Die Unterschiede der beiden SID-Generationen werden nicht durch eine vollständige Auswahl von Modellparametern abgebildet.

reSIDfp unterstützt dagegen ausdrücklich beide Chipmodelle mit jeweils angepassten Eigenschaften.

![](https://www.google.com/s2/favicons?domain=https://github.com\&sz=32)

GitHub

Wenn deine Zielsetzung ein möglichst authentischer C64-Musikplayer ist, würde ich zuerst klären, ob du bewusst nur einen bestimmten 6581 nachbilden möchtest oder ob die Engine generell 6581 und 8580 unterstützen soll. Für Letzteres reicht es nicht, nur eine weitere DAC-Tabelle zu erzeugen.

### C. ADSR: funktional plausibel, aber nicht vollständig hardwaregetreu

Deine Stimmen besitzen Attack-, Decay- und Release-Zustände, einen Rate Counter, einen Exponential Counter und einen Sustain-Pegel. Die Zeitkonstanten sind in einer Lookup-Tabelle hinterlegt.

C64_SOURCES.txt

C64_SOURCES.txt

Das ist eine solide Basis. Was mir aber fehlt, ist ein Nachweis, dass die Hüllkurvengenerierung auch die bekannten Eigenheiten der realen Hardware abbildet.

Die Implementierung erhöht beziehungsweise verringert den Hüllkurvenzähler und setzt den Rate Counter bei Erreichen seiner Periodengrenze zurück. In den geprüften Routinen sehe ich keine vollständige Umsetzung des hardwaretypischen ADSR-Verhaltens, einschließlich der bekannten ADSR-Delay-Problematik und des detaillierteren internen Zählerverhaltens.

Die reSIDfp-Entwicklung hat gerade solche Details des Envelope Generators ausdrücklich nachmodelliert und im Laufe der Entwicklung korrigiert.

![](https://www.google.com/s2/favicons?domain=https://github.com\&sz=32)

GitHub

+1

Das muss nicht bei normalen Musikstücken sofort auffallen. Sehr kurze Noten, bestimmte Übergänge von Gate und Release sowie spezielle Effekte sind jedoch gute Stellen, um solche Differenzen hörbar zu machen.

### D. Filter und Analogmodell: ambitioniert, aber die Kalibrierung ist der Knackpunkt

Dein Filter verwendet eine Zwei-Integrator-Struktur mit Rückkopplung, Tiefpass-, Bandpass- und Hochpassanteilen sowie nichtlinearer Begrenzung. Die Implementierung berechnet zwei interne Teilschritte je SID-Takt.

C64_SOURCES.txt

Das ist grundsätzlich ein sinnvoller DSP-Ansatz: Die Filterzustände werden kontinuierlich weitergeführt, statt die Filterantwort für jede Note einfach aus einer Tabelle zu lesen.

Allerdings sind einige Details problematisch:

Die Filterparameter sind nicht ausreichend belegt. Die Grenzfrequenz wird aus einer festen Polynomformel abgeleitet; die Resonanz wird durch eine einfache lineare Abbildung aus dem Registerwert bestimmt. Nicht ersichtlich ist, dass diese Koeffizienten aus einem konkreten SID-Chip vermessen wurden.

C64_SOURCES.txt

C64_SOURCES.txt

Ein Teil der berechneten Parameter kommt im eigentlichen Filter nicht zum Einsatz. `updateFilterParameters()` berechnet `this.g` und `this.q`. Der Filter berechnet `subG` und `k` später jedoch erneut und unabhängig davon. Insbesondere die berechnete Temperaturkorrektur der Resonanz über `q` wirkt sich so nicht auf die tatsächliche Filter-Rückkopplung aus.

C64_SOURCES.txt

C64_SOURCES.txt

Der Begriff „Analog Master“ ist ambitionierter als der dokumentierte Modellierungsstand. Die Sättigung verwendet unter anderem `Math.tanh()` und feste Korrekturterme. Das kann als Klangmodell gut funktionieren, beweist aber nicht die Nachbildung der konkreten nichtlinearen Eigenschaften eines MOS 6581 oder CSG 8580.

Zum Vergleich: reSIDfp dokumentiert Messungen der Filtereigenschaften und bildet unter anderem die tatsächliche Filtertopologie und chipspezifische Besonderheiten nach.

![](https://www.google.com/s2/favicons?domain=https://sidplay-residfp.sourceforge.io\&sz=32)

SourceForge

+1

Ich würde deine Filterstufe daher als physikalisch inspiriertes, nichtlineares Synthesefilter einstufen, nicht als bereits nachgewiesenes Transistormodell des SID.

### E. Synchronisation, CPU und Sample-Wiedergabe

Die CPU- und Soundchip-Simulation laufen in `sid-exact.js` auf einer gemeinsamen PAL-Taktbasis. Pro emuliertem CPU-Takt wird die Hardware fortgeschaltet; Schreibzugriffe werden für ausgewählte Instruktionen zeitlich verzögert übernommen.

C64_SOURCES.txt

C64_SOURCES.txt

Das ist wesentlich besser als ein System, das nur alle 20 Millisekunden die SID-Register ausliest und daraus den gesamten Audioblock synthetisiert.

Trotzdem würde ich die Lösung nicht ohne weitere Tests als zyklusgenau bezeichnen. Der 6502 wird als Instruktionsinterpreter ausgeführt: Register- und Instruktionszustände werden innerhalb von `step()` aktualisiert, während die verstrichenen Takte außerhalb verwaltet werden. Einzelne Registerschreibvorgänge werden zwar gestaffelt, aber die gesamte CPU wird dadurch noch nicht zu einem vollständigen, buszyklusgenauen 6510-Modell.

C64_SOURCES.txt

C64_SOURCES.txt

Die Auswirkungen sind bei gewöhnlichen Musikroutinen möglicherweise gering. Bei sehr schnellen Digidrums, eng getakteten SID-Schreibvorgängen und speziellen Wiedergabeschleifen werden Timingabweichungen deutlich relevanter. reSID wiederum behandelt Oszillatorereignisse und Synchronisation gezielt an den maßgeblichen Akkumulatorflanken, damit Hard Sync korrekt funktioniert.

![](https://www.google.com/s2/favicons?domain=https://github.com\&sz=32)

GitHub

Deine spezielle Behandlung von PSID-Sample-Erweiterungen und `$D418`-Digis ist ein interessantes Plus. Sie ist aber ein eigener Kompatibilitätspfad; daraus ergibt sich noch kein Beleg dafür, dass alle realen SID-Sampletechniken korrekt wiedergegeben werden.

C64_SOURCES.txt

C64_SOURCES.txt

## 4. Resampling: gute Idee, aber hier sehe ich eine konkrete Schwäche

Die Audioausgabe erzeugt den SID intern taktweise und reduziert ihn anschließend mit einem 32-phasigen FIR-Filter mit 255 Taps auf die Ausgaberate. Die Filterkoeffizienten werden aus einer Sinc-Funktion und einem Blackman-Fenster gebildet.

C64_SOURCES.txt

Das ist ein guter Ansatz, um Aliasing zu reduzieren. Er ist auch wesentlich kontrollierbarer als eine einfache Mittelwertbildung über mehrere CPU-Takte.

Bei der rechnerischen Prüfung der Phase-0-Koeffizienten ist mir jedoch aufgefallen, dass die Filterflanke für den vorgesehenen Frequenzbereich relativ breit ausfällt: Die bei 20 kHz angesetzte Grenzfrequenz bedeutet bei 22,05 kHz – also der Nyquist-Frequenz eines 44,1-kHz-Ausgangssignals – in dieser 255-Tap-Blackman-Sinc-Konfiguration nur ungefähr 11 dB Dämpfung durch den FIR-Filter allein. Bei 24 kHz ergeben sich ungefähr 17 dB.

Das sind keine Messungen deiner tatsächlich ausgegebenen Musik, sondern die berechnete Übertragungsfunktion der implementierten FIR-Koeffizienten. Die nachgelagerte 16-kHz-Tiefpassstufe verändert den Frequenzgang zusätzlich, kann bereits entstandenes Aliasing aber nicht rückgängig machen.

C64_SOURCES.txt

C64_SOURCES.txt

Meine Empfehlung: Vergleiche das aktuelle Verfahren mit einer längeren FIR, einem besser auf den Ausgangs-Nyquist abgestimmten Filter und einer zweistufigen Resampling-Variante. Gerade der Ansatz von reSIDfp, hochwertige Resamplingverfahren mit möglichst geringem Rechenaufwand zu kombinieren, bietet einen guten Referenzpunkt.

![](https://www.google.com/s2/favicons?domain=https://github.com\&sz=32)

GitHub

+1

## 5. Was ich als Nächstes ändern würde

Ich würde nicht zuerst weitere analoge Effekte, Sättigungskurven oder „Temperatur“-Parameter ergänzen. Die höchste Priorität liegt auf der nachgewiesenen Korrektheit der bestehenden Modelle.

## 1

SID-Modell sauber trennen

Einen expliziten 6581- und 8580-Modus einführen, mit getrennten DAC-Kennlinien, Filterparametern und modellabhängigem Verhalten. Unbenutzte Tabellen und berechnete, aber nicht angewandte Filterparameter entfernen oder korrekt anbinden.

## 2

Wellenformen und ADSR validieren

Mit Referenzprogrammen zunächst die Einzelformen testen, danach kombinierte Wellenformen, Hard Sync, Ringmodulation, TEST-Bit und problematische ADSR-Sequenzen. Für die kombinierten Wellenformen sollten Messdaten oder etablierte empirische Modelle die Grundlage bilden.

## 3

Filtermessungen und Frequenzantworten

Grenzfrequenz-Sweeps, Resonanztests und kombinierte LP/BP/HP-Modi gegen reSIDfp vergleichen. Den Frequenzgang und die Aliasunterdrückung des Resamplers separat vermessen.

## 4

Ein reproduzierbarer Hörtest

Dieselben PSID-Dateien mit identischen Subsongs, gleicher Ausgaberate und angepasstem Pegel in deiner Engine und reSIDfp abspielen. Besonders wichtig sind filterintensive Titel, harte Sync-Sounds, kombinierte Wellenformen und `$D418`-Samples.

## Fazit

Deine Implementierung hat deutlich mehr Substanz als ein einfacher SID-Synthesizer, der nur vier Wellenformen und eine Hüllkurve erzeugt. Sie berücksichtigt zahlreiche echte Merkmale der Hardware und hat mit der taktweisen Verarbeitung und dem FIR-Resampling eine gute technische Grundlage.

Der entscheidende Unterschied zu etablierten Lösungen ist aber nicht die Menge an Code, sondern wie gut jede einzelne Näherung durch Messungen, Reverse Engineering und reproduzierbare Tests belegt ist.

Wenn dein Ziel ein überzeugender, eigenständiger C64-Musikplayer mit einer charakteristischen 6581-Note ist, lohnt sich die Weiterentwicklung. Wenn das Ziel dagegen eine möglichst authentische Emulation auf dem Niveau von VICE mit reSIDfp ist, würde ich derzeit zuerst die oben genannten Modellierungs- und Timinglücken schließen.

Eine ebenfalls sinnvolle Alternative wäre, reSIDfp als etablierte Engine zu verwenden und deine eigene JavaScript-Lösung als schlanke oder experimentelle Variante weiterzuführen. Dabei ist die Lizenz zu beachten: libresidfp steht unter GPL-2.0.

![](https://www.google.com/s2/favicons?domain=https://github.com\&sz=32)

GitHub
