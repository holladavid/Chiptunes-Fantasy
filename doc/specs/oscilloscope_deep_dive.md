# Technical Deep Dive: CRT-Oszilloskop & VFD-Spektrumanalysator

> **Projekt:** Chiptunes Fantasy  
> **Module:** `js/visuals/components/oscilloscope.js` & `js/visuals/components/fft-analyzer.js`  
> **Philosophie:** *„Von Nerds für Nerds“* – Physikalisch akkurate Emulation analoger Kathodenstrahlröhren (CRT) und Vakuum-Fluoreszenz-Anzeigen (VFD) in Echtzeit ohne Garbage-Collection-Overhead.

---

## Inhaltsverzeichnis

1. [Überblick & Design-Philosophie](#1-überblick--design-philosophie)
2. [Softwarearchitektur & Rendering-Pipeline](#2-softwarearchitektur--rendering-pipeline)
3. [Physikalischer Deep Dive: Das CRT-Oszilloskop](#3-physikalischer-deep-dive-das-crt-oszilloskop)
   - [3.1 Z-Achsen-Helligkeitsmodulation (Verweildauer-Physik)](#31-z-achsen-helligkeitsmodulation-verweildauer-physik)
   - [3.2 Umkehrpunkt-Aufhellung (Turn-Around Peak Intensification)](#32-umkehrpunkt-aufhellung-turn-around-peak-intensification)
   - [3.3 Zweistufige Phosphor-Persistenz (Fluoreszenz vs. Phosphoreszenz)](#33-zweistufige-phosphor-persistenz-fluoreszenz-vs-phosphoreszenz)
   - [3.4 HF-Reject Schmitt-Trigger mit Phasen-Korrelation](#34-hf-reject-schmitt-trigger-mit-phasen-korrelation)
   - [3.5 Sub-Sample Catmull-Rom-Interpolation & RC-Overshoot](#35-sub-sample-catmull-rom-interpolation--rc-overshoot)
4. [Physikalischer Deep Dive: Der VFD/CRT-Spektrumanalysator](#4-physikalischer-deep-dive-der-vfdcrt-spektrumanalysator)
5. [Default-Spezifikationen (Technische Daten)](#5-default-spezifikationen-technische-daten)
6. [Konfigurations- & Tuning-Referenz](#6-konfigurations---tuning-referenz)
   - [6.1 Parameter in `oscilloscope.js`](#61-parameter-in-oscilloscopejs)
   - [6.2 Parameter in `fft-analyzer.js`](#62-parameter-in-fft-analyzerjs)
   - [6.3 Wichtige Wechselwirkung: `TIME_WINDOW_SECONDS` vs. `fftSize`](#63-wichtige-wechselwirkung-time_window_seconds-vs-fftsize)
7. [Performance & Speichermanagement (Zero-GC-Design)](#7-performance--speichermanagement-zero-gc-design)

---

## 1. Überblick & Design-Philosophie

Klassische Canvas-Oszilloskope zeichnen Audiosignale meist als simplen Vektorpfad (`ctx.lineTo`) mit konstanter Linienstärke und gleichmäßiger Deckkraft. Auf einem echten analogen Labor-Oszilloskop (wie einem **Tektronix 465B** oder **Hameg HM203**) sieht ein Chiptune-Signal eines **MOS 6581/8580 (SID)**, **Amiga 8364 (Paula)** oder **Atari YM2149** jedoch völlig anders aus:

1. **Puls- und Rechteckwellen** besitzen gleißend helle, leicht überstrahlende (bloomende) horizontale Dächer, während die vertikalen Flanken dazwischen fast unsichtbar hauchdünn sind.
2. **Hüllkurven und Amplitudenmodulationen** leuchten an ihren oberen und unteren Umkehrpunkten deutlich stärker als in der Nulldurchgangs-Mitte.
3. **Phosphorschichten (P31 Grün, P11 Blau-Violett, P3 Amber)** reagieren zweistufig: Ein weißglühender Blitz im Moment des Elektronenbeschusses (*Fluoreszenz*) geht über in ein farbig gesättigtes, exponentiell abklingendes Nachleuchten (*Phosphoreszenz*).

Beide Visualisierungs-Komponenten bilden diese analoge Schaltungs- und Röhrenphysik mathematisch nach und teilen sich denselben Ziel-Viewport im `screen`-Compositing-Modus.

---

## 2. Softwarearchitektur & Rendering-Pipeline

Um bei 60–144 FPS ohne teure WebGL-Shader oder langsame `ctx.shadowBlur`-Aufrufe eine echte optische Glas-Halation und unabhängige Nachleuchtzeiten zu erreichen, arbeitet das Oszilloskop mit einer **4-Schichten-Offscreen-Architektur**:

```text
                       ┌──────────────────────────────┐
                       │  Web Audio API AnalyserNode  │
                       │  (Float32 PCM Time-Domain)   │
                       └──────────────┬───────────────┘
                                      │
                                      ▼
               ┌──────────────────────────────────────────────┐
               │ 1. DSP & Trigger-Stufe                       │
               │ • DC-Offset-Entfernung & RMS-Messung         │
               │ • 1-Pol IIR Tiefpass (HF-Reject @ ~1.9 kHz)  │
               │ • Schmitt-Trigger + Phasen-Korrelations-Lock │
               └──────────────────────┬───────────────────────┘
                                      │
                                      ▼
               ┌──────────────────────────────────────────────┐
               │ 2. Sub-Sample Rasterizer (buildSweepRaster)  │
               │ • Catmull-Rom Spline-Interpolation           │
               │ • Analoger Transienten-Overshoot (Gibbs)     │
               │ • Johnson-Nyquist Thermisches Grundrauschen  │
               │ • Spaltenweise Min/Max/Mid-Projektion        │
               └──────────────────────┬───────────────────────┘
                                      │
            ┌─────────────────────────┼─────────────────────────┐
            ▼                         ▼                         ▼
┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐
│   this.offscreen      │ │     this.memory       │ │      this.bloom       │
│   (Auflösung: 1:1)    │ │   (Auflösung: 1:1)    │ │  (Auflösung: 0.25x)   │
│                       │ │                       │ │                       │
│ • Scharfer 1px Kern   │ │ • Langsamer P31/P11   │ │ • Bilineares Tent-    │
│ • Z-Modulations-Alpha │ │   Phosphor-Afterglow  │ │   Filter Upscaling    │
│ • Schnelles Decay     │ │ • τ ≈ 208 ms          │ │ • Glas-Halation       │
└───────────┬───────────┘ └───────────┬───────────┘ └───────────┬───────────┘
            │                         │                         │
            └─────────────────────────┼─────────────────────────┘
                                      ▼
               ┌──────────────────────────────────────────────┐
               │ 3. Haupt-Canvas Compositing (mode: 'screen') │
               │ • Layer 0: this.graticule (Geätztes Raster)  │
               │ • Layer 1: this.bloom (Weiches Glas-Leuchten)│
               │ • Layer 2: this.memory (Phosphoreszenz)      │
               │ • Layer 3: this.offscreen (Fluoreszenz-Spur) │
               │ • Layer 4: Kathoden-Brennspot & Funken-Pool  │
               └──────────────────────────────────────────────┘
```

### Zusammenspiel mit `FftAnalyzer`
* `FftAnalyzer` belegt die unteren **43 %** der Viewport-Höhe (`height * 0.43`) und rendert sein statisches VFD-Anodengitter sowie die Frequenzskala über ein gecachtes Canvas (`this.staticGrid`), das nur bei einem `resize`-Event oder Systemwechsel (`c64`, `amiga`, `atari`) neu aufgebaut wird.
* Das geätzte vertikale Trigger-Graticule des Oszilloskops blendet ab **45 %** der Bildschirmhöhe sanft nach unten aus (`fade`), sodass sich Oszilloskop-Skala und Spektrumanalysator optisch niemals in die Quere kommen.

---

## 3. Physikalischer Deep Dive: Das CRT-Oszilloskop

### 3.1 Z-Achsen-Helligkeitsmodulation (Verweildauer-Physik)

In einer analogen Oszilloskopröhre emittiert die Elektronenkanone einen konstanten Strahlstrom $I_0$. Während der Sägezahn-Zeitbasisgenerator den Strahl mit konstanter Horizontalgeschwindigkeit $v_x = \frac{dx}{dt}$ von links nach rechts zieht, lenkt der Vertikalverstärker den Strahl mit $v_y = \frac{dy}{dt}$ ab.

Die Bahngeschwindigkeit $v$ des Elektronenbrennpunkts auf dem Röhrenschirm beträgt:

$$v(x) = \sqrt{v_x^2 + v_y(x)^2} = v_x \cdot \sqrt{1 + \left(\frac{\Delta y}{\Delta x}\right)^2}$$

Da sich die pro Pixelspalte $\Delta x = 1\text{ px}$ deponierte Ladungsmenge auf die zurückgelegte vertikale Strecke $\Delta y$ verteilt, ist die lokale Phosphor-Anregungsenergie $E_{\text{dwell}}(x)$ umgekehrt proportional zur vertikalen Sprunghöhe $\Delta y$:

$$E_{\text{dwell}}(x) = \left( \frac{1}{1 + k_v \cdot \Delta y(x)} \right)^{\gamma}$$

Im Code (`burnPhosphorTrace`) ist dies mit $k_v = 0.22$ und dem Phosphor-Sättigungsexponenten $\gamma = 0.62$ implementiert:
* **Flaches Plateau ($\Delta y = 0$):** $E_{\text{dwell}} = 1.0 \rightarrow$ Maximale Verweildauer, Farbtemperatur wandert in der 32-stufigen LUT (`this.coreColors`) bis ins Weißglühende, volle Einspeisung in den `bloom`-Buffer.
* **Steile Rechteckflanke ($\Delta y = 80\text{ px}$):** $E_{\text{dwell}} \approx 0.16 \rightarrow$ Der Strahl rast in Nanosekunden vertikal durch; gezeichnet wird eine `1px` dünne, geisterhaft-transparente Linie ohne Halo.

### 3.2 Umkehrpunkt-Aufhellung (Turn-Around Peak Intensification)

Wenn eine hochfrequente Schwingung (z. B. ein hoher SID-Lead oder ein moduliertes Signal) innerhalb einer einzigen Bildschirmspalte $x$ von `top` bis `bottom` schwingt ($\text{span} > 2\text{ px}$), muss der Elektronenstrahl am oberen Umkehrpunkt (`top`) und unteren Umkehrpunkt (`bottom`) vertikal auf $v_y = 0$ abbremsen, bevor er seine Richtung umkehrt.

Deshalb erhalten die beiden vertikalen Extrempunkte jeder Spalte im Code eine gezielte Aufhellung (`turnAroundIdx = colorIdx + 7`, `alpha * 1.45`). Dadurch entsteht bei dichten Wellenpaketen der authentische analoge „Röhren-Schimmer“ an den Hüllkurvenrändern.

### 3.3 Zweistufige Phosphor-Persistenz (Fluoreszenz vs. Phosphoreszenz)

Echter P31- oder P11-Phosphor fällt nicht linear ab, sondern besitzt zwei Zeitkonstanten, die in `fadePhosphorSurfaces(dt)` über `globalCompositeOperation = 'destination-out'` zeitrichtig (unabhängig von der Framerate) gelöst werden:

$$A_{\text{fade}}(\Delta t) = 1 - e^{-\lambda \cdot \Delta t}$$

1. **Fluoreszenz-Schicht (`this.offscreen`):** $\lambda_{\text{fast}} = 16.5\text{ s}^{-1}$ (Zeitkonstante $\tau \approx 60.6\text{ ms}$). Sorgt dafür, dass schnelle Wellenformänderungen (Arpeggios, Drum-Transienten) sofort scharf abgebildet werden.
2. **Phosphoreszenz-Schicht (`this.memory`):** $\lambda_{\text{slow}} = 4.8\text{ s}^{-1}$ (Zeitkonstante $\tau \approx 208.3\text{ ms}$). Hält das nachglühende Geisterbild vergangener Perioden auf dem Schirm.

### 3.4 HF-Reject Schmitt-Trigger mit Phasen-Korrelation

Chiptunes stellen für einfache Nulldurchgangs-Trigger den Worst Case dar: Pulsweitenmodulation (PWM), Ringmodulation, Hard-Sync und überlagertes Rauschen erzeugen ständig falsche Nulldurchgänge. Das Oszilloskop löst dies dreistufig in `captureWaveform()`:

1. **DC-Blocking:** Subtraktion des arithmetischen Mittelwerts $\mu$, damit unsymmetrische Pulswellen (z. B. 10 % Duty-Cycle) sauber um $0\text{ V}$ zentriert sind.
2. **Virtueller `HF REJ`-Filter:** Ein einpoliger IIR-Tiefpass ($y[n] = y[n-1] + \alpha \cdot (x[n] - y[n-1])$ mit $\alpha = 0.22$, Grenzfrequenz $f_c \approx 1.9\text{ kHz}$ bei $48\text{ kHz}$ Abtastrate) glättet *ausschließlich* das Triggersignal (`this.triggerFilterBuf`), während das Zeichensignal (`this.timeDomainData`) seine volle Bandbreite behält.
3. **Schmitt-Trigger + Phasen-Korrelation:** Der Trigger schaltet erst scharf (`armed = true`), wenn das Signal unter die negative Hystereseschwelle (`-dynamicHysteresis`) gefallen ist. Beim anschließenden steigenden Nulldurchgang wird der exakte Sub-Sample-Nulldurchgang linear interpoliert und mittels kleinster Fehlerquadrate (`corr`) mit der gespeicherten Wellenform des vorherigen Frames (`this.prevTriggerWave`) verglichen. Dadurch rastet die Welle selbst bei komplexen Akkorden stehend ein.

### 3.5 Sub-Sample Catmull-Rom-Interpolation & RC-Overshoot

Bei hohen Frequenzen liegen nur wenige Audio-Samples zwischen zwei Bildschirmspalten. Um Treppenstufen zu vermeiden, tastet `sampleInterpolated(position)` das Zeitsignal über ein kubisches **Catmull-Rom-Spline** über 4 Nachbarstützstellen $(y_0, y_1, y_2, y_3)$ ab:

$$P(t) = \frac{1}{2} \begin{bmatrix} 1 & t & t^2 & t^3 \end{bmatrix} \begin{bmatrix} 0 & 2 & 0 & 0 \\ -1 & 0 & 1 & 0 \\ 2 & -5 & 4 & -1 \\ -1 & 3 & -3 & 1 \end{bmatrix} \begin{bmatrix} y_0 \\ y_1 \\ y_2 \\ y_3 \end{bmatrix}$$

Zusätzlich wird ein dezenter erster Differenzenquotient `stepAccent = (y2 - y1) * 0.045` addiert, der das charakteristische leichte Überschwingen (*Gibbs-Overshoot*) analoger Koppelkondensatoren und Vertikalverstärker an harten Rechteckflanken nachbildet.

---

## 4. Physikalischer Deep Dive: Der VFD/CRT-Spektrumanalysator

In `fft-analyzer.js` wurden zwei klassische Probleme digitaler Web-Audio-Spektrumanalysatoren behoben:

1. **Das Low-Bin-Treppenproblem:** Bei einer Standard-`fftSize` von `2048` und `48000 Hz` Sample-Rate beträgt die physikalische Auflösung pro FFT-Bin $\Delta f = \frac{48000}{2048} = 23.4375\text{ Hz}$. Zwischen `45 Hz` und `150 Hz` liegen also nur knapp 4 ganzzahlige FFT-Bins, auf die sich im tiefen Bereich aber über 12 logarithmische Balken verteilen. Durch die Umstellung auf gebrochene Gleitkomma-Bingrenzen (`this.exactBinRanges`) in Kombination mit kubischer Catmull-Rom-Interpolation (`sampleSubBin`) gleiten Bassläufe stufenlos über die unteren Balken und stimmen exakt mit den gedruckten Skalenmarkierungen (`50`, `100`, `500`, `1K`, `4K`, `12K`) überein.
2. **Psychoakustischer Chiptune-Tilt:** Da die spektrale Leistungsdichte von Rechteck- und Sägezahnwellen mit $1/f$ ($-6\text{ dB/Oktave}$) abfällt, wird eine frequenzabhängige Höhenanhebung (`highFrequencyBoost` von $+0\text{ %}$ bei $45\text{ Hz}$ bis $+62\text{ %}$ bei $12\text{ kHz}$) sowie eine sanfte Potenz-Kompression ($\text{shaped} = x^{0.92}$) angewandt.

---

## 5. Default-Spezifikationen (Technische Daten)

| System-Merkmal | Oszilloskop (`oscilloscope.js`) | FFT-Analyzer (`fft-analyzer.js`) |
| :--- | :--- | :--- |
| **Primäre Signalquelle** | `analyser.getFloatTimeDomainData()` | `analyser.getByteFrequencyData()` |
| **Erwartete Audio-Sample-Rate** | `48.000 Hz` (adaptiv über `audioCtx.sampleRate`) | `48.000 Hz` (adaptiv über `audioCtx.sampleRate`) |
| **Standard-FFT-Größe (`fftSize`)** | `2048 Samples` ($\approx 42,67\text{ ms}$ Puffer bei 48 kHz) | `2048 Samples` ($1024$ Frequenz-Bins) |
| **Aufzeichnungsfenster / Messbereich** | `32,0 ms` (`TIME_WINDOW_SECONDS = 0.032`) | `45 Hz` bis `12.000 Hz` (logarithmisch) |
| **Horizontale Ablenkung (Timebase)** | `3,2 ms / Div` (bei 10 horizontalen Teilungen) | `48 Bänder` ($\approx 1/6$-Oktav-Auflösung) |
| **Untere Grenzfrequenz (1 Vollperiode)**| `31,25 Hz` (erfasst ab Note **C1 = 32,7 Hz**) | `45,0 Hz` (Sub-Bin interpoliert) |
| **Abtast- / Update-Intervall** | Echtzeit pro Render-Frame (`60–144 Hz`) | `30 Hz` (`SAMPLE_INTERVAL = 1 / 30` s) |
| **Interne Spur-Auflösung** | `1:1` Nativ (Pixelgenau) | `1:1` Nativ (Gecachtes Statik-Grid) |
| **Optische Halation-Auflösung** | `0.25x` (`1/16` Fläche, bilinear gefiltert) | Direktes Segment-Korona-Rendering |
| **Farbtemperatur-Quantisierung** | `32 Stufen` (`COLOR_LUT_SIZE`) | `3 Zonen` (`low`, `mid`, `high`) + Core-Mix |

---

## 6. Konfigurations- & Tuning-Referenz

Alle zentralen Parameter sind am Dateikopf als Konstanten bzw. in den Kernmethoden definiert und können bei Bedarf feinjustiert werden.

### 6.1 Parameter in `oscilloscope.js`

| Konstante / Variable | Default-Wert | Einheit | Auswirkung bei Änderung |
| :--- | :--- | :--- | :--- |
| `TIME_WINDOW_SECONDS` | `0.032` | Sekunden (`s`) | **Zeitbasis (Horizontaler Zoom).** Kleinerer Wert (z. B. `0.016` = 16 ms) zoomt näher in die Wellenform hinein (weniger Perioden sichtbar, breitere Darstellung). Größerer Wert zeigt mehr Perioden (Hüllkurven-Blick). *Siehe Hinweis 6.3!* |
| `AMPLITUDE_GAIN` | `1.24` | Faktor (linear) | **Vertikale Verstärkung (`V/Div`).** Höherer Wert (z. B. `1.6`) streckt leise Signale vertikal stärker, führt bei lauten Tracks aber früher zur Begrenzung am oberen/unteren Röhrenrand. |
| `TRIGGER_HYSTERESIS` | `0.015` | Normierte Amplitude `[0..1]` | **Schmitt-Trigger-Schwelle.** Mindest-Unterschreitung unter 0 V, bevor der Trigger scharf schaltet. Erhöhen (z. B. auf `0.03`), falls stark verrauschte Signale falsch triggern; verringern (z. B. `0.005`), damit auch extrem leise Fade-Outs noch triggern. |
| `BLOOM_SCALE` | `0.25` | Skalierungsfaktor `[0.1..1.0]` | **Radius & Weichheit des Röhrenglas-Leuchtens.** Ein kleinerer Wert (z. B. `0.15`) erzeugt einen breiteren, weicheren Halo um helle Linien (und spart noch mehr GPU-Füllrate). Ein größerer Wert (`0.5`) macht den Glow enger und schärfer. |
| `COLOR_LUT_SIZE` | `32` | Anzahl Stufen (`Int`) | **Auflösung des Farbtemperatur-Übergangs** von der Primärfarbe zu Weißglut. `32` ist das Optimum aus sanftem Gradienten und minimalem Speicherbedarf. |
| `MAX_SPARKS` | `64` | Anzahl Partikel (`Int`) | **Größe des Funken-Ringbuffers.** Bestimmt, wie viele ballistische Kathoden-Funken gleichzeitig bei harten Transienten existieren dürfen (`0` deaktiviert Funken komplett). |
| `alpha` *(in `captureWaveform`)* | `0.22` | Filterkoeffizient `[0.05..1.0]` | **Grenzfrequenz des Trigger-Tiefpasses (`HF REJ`).** Kleinerer Wert (z. B. `0.10`) filtert Oberwellen im Trigger noch aggressiver weg (ideal für reine Bass-Synchronisation). `1.0` deaktiviert den Tiefpass. |
| `fastFade` *(in `fadePhosphorSurfaces`)* | `-16.5` | Abklingrate $\lambda$ (`1/s`) | **Fluoreszenz-Abklinggeschwindigkeit.** Höherer Betrag (z. B. `-25.0`) lässt die Hauptspur schneller verschwinden; niedrigerer Betrag (`-10.0`) erzeugt längeres Nachziehen bei schnellen Wellenänderungen. |
| `slowFade` *(in `fadePhosphorSurfaces`)* | `-4.8` | Abklingrate $\lambda$ (`1/s`) | **Phosphoreszenz-Nachleuchtdauer (`memory`).** Kleinerer Betrag (z. B. `-2.5`) simuliert extrem lang nachleuchtenden P7/P39-Radarphosphor. |
| `sweepRate` *(in `burnPhosphorTrace`)* | `2.15` | Durchläufe / Sekunde (`Hz`) | **Grundgeschwindigkeit des sichtbaren Kathoden-Brennspots**, der mit seinem Kometenschweif über die stehende Welle wandert. |

### 6.2 Parameter in `fft-analyzer.js`

| Konstante / Variable | Default-Wert | Einheit | Auswirkung bei Änderung |
| :--- | :--- | :--- | :--- |
| `SAMPLE_INTERVAL` | `1 / 30` | Sekunden (`s`) | **Abtastrate der FFT-Daten (`33,3 ms`).** Ein Wert von `1 / 60` aktualisiert die Zielwerte jeden Frame, `1 / 30` verleiht dem Display die authentische Trägheit klassischer Hardware-Controller. |
| `MIN_FREQUENCY` | `45` | Hertz (`Hz`) | **Mittenfrequenz des ersten Balkens (links).** Tiefer als `40 Hz` ist bei Chiptunes meist leerer Sub-Bass. |
| `MAX_FREQUENCY` | `12000` | Hertz (`Hz`) | **Mittenfrequenz des letzten Balkens (rechts).** Deckt das gesamte relevante Oberwellenspektrum klassischer 8-/16-Bit-Soundchips ab. |
| `this.barCount` | `48` | Anzahl Balken (`Int`) | **Horizontale Auflösung des Spektrums.** Kann z. B. auf `32` (breitere Retro-Balken) oder `64` (feinere Studio-Auflösung) geändert werden. |
| `attackBlend` *(in `render`)* | `-30` | Zeitkonstante $\lambda$ (`1/s`) | **Anstiegsgeschwindigkeit der Balken.** Höherer Betrag (`-50`) lässt Balken bei Drums nahezu verzögerungsfrei nach oben schießen. |
| `releaseBlend` *(in `render`)* | `-11.5` | Zeitkonstante $\lambda$ (`1/s`) | **Rücklaufgeschwindigkeit der Balken.** Kleinerer Betrag (`-7.0`) lässt die Balken gemütlicher absinken. |
| `trailDecayBlend` *(in `render`)* | `-4.2` | Zeitkonstante $\lambda$ (`1/s`) | **Nachleuchtdauer der VFD-Geistersegmente (`this.trails`)** oberhalb fallender Balken. |
| `this.peakHoldSeconds` | `0.44` | Sekunden (`s`) | **Haltezeit der weißen Peak-Hold-Indikatoren**, bevor sie mit `peakFallSpeed` der Schwerkraft folgen. |

### 6.3 Wichtige Wechselwirkung: `TIME_WINDOW_SECONDS` vs. `fftSize`

Damit der Korrelations-Trigger des Oszilloskops einen stabilen Nulldurchgang finden kann, benötigt er im Audio-Puffer (`fftSize`) **Such-Headroom** vor dem eigentlichen Zeichenfenster (`windowSampleCount`):

$$\text{Suchfenster (Samples)} = \text{fftSize} - (\text{sampleRate} \times \text{TIME\_WINDOW\_SECONDS})$$

* **Im Default-Zustand** ($48.000\text{ Hz}$, `fftSize = 2048`, `TIME_WINDOW_SECONDS = 0.032`):
  * $\text{windowSampleCount} = 48.000 \times 0.032 = 1536\text{ Samples}$.
  * Es verbleiben $2048 - 1536 = \mathbf{512\text{ Samples}}$ ($\approx 10,67\text{ ms}$) Suchfenster für den Trigger. Das reicht für alle Frequenzen oberhalb von $\approx 93\text{ Hz}$ für einen lückenlosen Vollperioden-Lock.
* **Regel für Anpassungen:** Wenn `TIME_WINDOW_SECONDS` auf z. B. `0.050` ($50\text{ ms}$) vergrößert werden soll, sollte am Web-Audio-`AnalyserNode` die `fftSize` auf `4096` verdoppelt werden, damit das Trigger-Suchfenster groß genug bleibt.

---

## 7. Performance & Speichermanagement (Zero-GC-Design)

Um selbst auf schwächerer Hardware oder mobilen Browsern konstante 60 FPS ohne **Garbage-Collection-Ruckler (GC Pauses)** zu garantieren, befolgen beide Module strikte Speichergesetze:

1. **Keine Allokationen im Render-Loop:** Sämtliche Puffer (`Float32Array`, `Int16Array`, `Int32Array`, `Uint8Array`) werden ausschließlich einmalig im Konstruktor oder bei einer Größenänderung (`resize` / `configureAnalyser`) allokiert.
2. **Pre-Computed Color LUTs:** Farbstrings (`rgb(r, g, b)`) werden nicht pro Frame zusammengebaut, sondern nur bei Änderung von `lineColor` in `prepareColors()` in ein 32-elementiges Array (`this.coreColors`, `this.haloColors`) vorberechnet.
3. **Statischer Partikel-Ringbuffer:** Die bis zu 64 Kathodenfunken (`this.sparks`) sind beim Start vorallokierte Objekte. `spawnSparks()` überschreibt lediglich das jeweils älteste Objekt über einen Ring-Zeiger (`this.sparkCursor = (this.sparkCursor + 1) % MAX_SPARKS`) – kein `new`, kein `Array.push()`, kein `Array.splice()`.
4. **Hardware-beschleunigte Achsen-Quads (`fillRect`) statt Pfad-Triangulierung:** Statt hunderte Male pro Frame `beginPath() -> moveTo() -> lineTo() -> stroke()` aufzurufen (was den Browser-Grafiktreiber zur aufwendigen Pfad-Tesselierung zwingt), zeichnet der Rasterizer des Oszilloskops jede Spalte über achsenparallele `fillRect(x, y, 1, span)`-Aufrufe direkt auf das GPU-Backed Canvas.