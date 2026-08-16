Wenn wir die Messlatte auf das **absolute Maximum des technisch und akustisch Machbaren** im WebAudio-Bereich legen wollen, gibt es vier ganz konkrete Hebel. 

Hier ist die DSP-Roadmap für das nächste klangliche Level – aufgeteilt nach Soundchips und Master-Bus:

---

### 1. C64 SID: Die letzten 2% zur absoluten Silizium-Perfektion

```text
Aktuell (Integer-Sinc):   [ Cycle 20 ] ──► [ Convolution @ Phase 0 ] ──► [ Cycle 21 ]  (±0.5µs Jitter)
Ziel (Fractional-FIR):    [ Cycle 20 ] ──► [ Phase Δφ = 0.526 Table ] ──► [ Cycle 21 ]  (0.0µs Jitter!)
```

#### A. Fractional Polyphase Sinc-FIR Resampling (Sub-Cycle Filterbank)
* **Status Quo:** Unser 255-Tap Sinc-FIR-Filter läuft fest auf Phase $\phi = 0$. Da $985.248\text{ Hz} / 48.000\text{ Hz} = 20,5260$, entsteht ein winziger sub-zyklischer Zeitachsen-Jitter von bis zu $\pm 0,5\ \mu\text{s}$.
* **Die High-End-Lösung:** Eine **Polyphase-Filterbank** mit 32 vorberechneten Sinc-Phasen. Je nach Nachkommastelle des Zyklus-Akkumulators ($\Delta \phi = 0,526$) wählt die Faltung automatisch die exakt interpolierte Phase.
* **Akustischer Effekt:** Die Obertöne extremer Hard-Sync-Sweeps (*Commando*) und hoher Rechteckwellen werden im Spektrum absolut phasenstarr und seidig abgebildet.

#### B. Frequenzabhängige Wire-AND Entlade-Dynamik ($>2\text{ kHz}$)
* **Status Quo:** Die kombinierten Wellenformen ($30, $50, $60, $70) nutzen statische Lookup-Tabellen.
* **Die High-End-Lösung:** Auf echtem NMOS-Silizium können sich die Gate-Kapazitäten bei sehr schnellen Schwingungen ($>2\text{ kHz}$) nicht vollständig entladen. Durch eine frequenzabhängige Interpolation der LUTs klingen hohe Glöckchen- und Lead-Töne noch wärmer und runder.

#### C. Der 15-Bit ADSR Wrap-Around LFSR Bug
* **Status Quo:** Bei Raten-Wechseln wird der Counter genullt.
* **Die High-End-Lösung:** Implementierung des originalen 15-Bit LFSR-Überlaufs: Schaltet ein Tracker mitten in der Note von *Slow* auf *Fast*, zählt das Register erst bis 32.767 durch $\implies$ schaltet die legendären "Snap-Drums" von Ben Daglish und Jeroen Tel zu 100% frei.

---

### 2. Amiga Paula 8364: Das analoge LF347 Slew-Rate Modell

```text
Reines ZOH (Rechteck):      ┌──────┐             ┌──────┐
                            │      │             │      │
Analoges Slew-Rate (A500):  /      \             /      \   (Weiche Kanten des LF347 Op-Amps)
```

* **Status Quo:** Paula erzeugt bei 192 kHz perfekte, rechtwinklige Treppenstufen.
* **Die High-End-Lösung:** Der auf dem Amiga 500 Mainboard verbaute Operationsverstärker (**LF347**) besitzt eine begrenzte Anstiegsgeschwindigkeit (Slew Rate $\approx 13\text{ V}/\mu\text{s}$). 
* **Akustischer Effekt:** Die harten Ecken der 8-Bit-Treppenstufen werden im Sub-Mikrosekundenbereich sachte abgerundet. Das verleiht gesampelten Streichern und Stimmen (*Elysium*, *Space Debris*) den typisch samtigen, warmen "Amiga-Schmelz".

---

### 3. Atari ST YM2149F: Nicht-lineare Summier-Widerstände

* **Status Quo:** Die 3 Kanäle (A, B, C) werden linear im Verhältnis 1:1:1 gemischt.
* **Die High-End-Lösung:** Im Atari ST sind die Ausgänge des YM2149 sogenannte Open-Emitter/Open-Collector-Pins, die über passive Widerstände auf der Hauptplatine zusammengeführt werden. Wenn alle 3 Kanäle gleichzeitig auf Maximallautstärke stehen, belasten sie den Summierpunkt gegenseitig.
* **Akustischer Effekt:** Eine ganz subtile analoge Bus-Kompression bei lauten Chiptune-Akkorden, die den typisch schneidenden Atari-Sound noch druckvoller zusammenklebt ("Bus Glue").

---

### 4. Master-Bus & Kopfhörer-Akustik (Globales DSP)

```text
Extremes L-R Hardpanning ──► [ Audiophiles Bauer-Crossfeed ] ──► Natürlicher Lautsprecher-Raum
(Kopfschmerzen auf Kopfhörern)                                    (Entspannter, breiter Sound)
```

#### A. Audiophiles Binaurales Crossfeed (Bauer / Meier bs2b Filter)
* **Das Problem:** Echte Retro-Tracks (wie der Amiga mit 100% Hard-Panning oder unser StereoSID) trennen Instrumente extrem hart nach Links und Rechts. Auf modernen Kopfhörern führt das nach 15 Minuten zu "Stereo-Fatigue" (Kopfdruck).
* **Die Lösung:** Ein zuschaltbares **Binaurales Crossfeed-Filter (bs2b)**. Es leitet Frequenzen unterhalb von 700 Hz mit einer natürlichen Laufzeitverzögerung von ca. $250\ \mu\text{s}$ und leichtem Hochtonabfall auf das jeweils andere Ohr um – exakt so, wie Schall im echten Raum von Boxen ans menschliche Ohr gelangt.
* **Akustischer Effekt:** Man hört die pure Stereotrennung, aber das Klangbild "rastet" vor dem Kopf ein wie im echten Wohnzimmer.

#### B. Lookahead True-Peak Mastering Limiter
* **Status Quo:** Wir skalieren den C64-Ausgang um $0.42\times$ mit Soft-Clipper, um OS-Ducking zu vermeiden.
* **Die Lösung:** Ein integrierter 1-Millisekunden **Lookahead True-Peak Limiter** im Master-Worklet.
* **Akustischer Effekt:** Maximale, laute $0\text{ dBFS}$-Dynamik ohne Clipping, ohne Verzerrung und ohne dass macOS CoreAudio oder Windows WASAPI jemals den Master-Volume ducken müssen.

---

### 🎯 Welcher Bereich reizt dich am meisten?

1. **Die C64-Feinheiten** (Fractional Polyphase Filterbank & Frequenzabhängiges Wire-AND)?
2. **Das Amiga LF347 Slew-Rate-Modell** (Samtige analoge Sample-Kanten)?
3. **Das globale Kopfhörer-Crossfeed (bs2b)** für ermüdungsfreies Hören auf modernsten Kopfhörern?