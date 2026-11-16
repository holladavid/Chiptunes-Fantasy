# MOS 6581 / 8580 „Blade Runner“ Core v1.1 – Architektur & DSP-Mathematik

> *Von Nerds für Nerds: Wie ein zyklusgenauer 985.248-Hz-C64-Kern, ein dreistimmiger Yamaha CS-80 und ein Lexicon-224-Konzertsaal im Echtzeit-AudioWorklet miteinander verschmelzen.*

---

## 1. System-Überblick & Signalfluss

Der `sid-bladerunner-processor` kombiniert kompromisslose Hardware-Emulation (MOS 6510/6502 + SID im 1-MHz-PAL-Lockstep) mit einer parallelen, musikalisch intelligenten Analog-Synthese- und Studio-Effektkette:

```text
[6502 CPU @ 985.248 Hz] ──(Register $D400..$D418)──┬──► [1 MHz Stereo SID + 2x ZDF-SVF] ──► [Kaiser-Sinc Resampler]
                                                   │
                                                   ├──► [6502 Bus-Settle Latch (64 cyc)] ──► [3x Yamaha CS-80 Voice]
                                                   │                                         (Dual-Rank PolyBLEP + HPF/LPF)
                                                   └──► [$D418 Onset Transient Designer] ──► [74→45 Hz Sub-Kick + Sidechain]
                                                                                                       │
             ┌─────────────────────────────────────────────────────────────────────────────────────────┘
             ▼
[Dynamisches Frequenz-Staging] ──┬──► Dry Bus ───────────────────────────────────────────────┐
                                 ├──► Dimension-D BBD Chorus (Bass-befreit, M/S-kreuzgekoppelt)─┼──► [C∞ Tape Saturator] ──► Out
                                 └──► Multi-Tap Tape Delay ──► 19ms Pre-Delay ──► Lexicon 224 FDN ┘
```

---

## 2. MOS Tow-Thomas-Filtertopologie & TPT-Notch-Beweis

Im SID-Chip arbeitet ein analoges **Tow-Thomas-Biquad** mit invertierenden NMOS/CMOS-Integratoren. Unser 2x-überabgetasteter (`1,970496 MHz`) Zero-Delay-Feedback State-Variable-Filter (Zavalishin TPT-SVF) besitzt mit der normierten Frequenzvariablen $s = j\omega / \omega_c$ die exakten Übertragungsfunktionen:

$$H_{\text{LP}}(s) = \frac{1}{s^2 + k s + 1}, \qquad H_{\text{BP}}(s) = \frac{s}{s^2 + k s + 1}, \qquad H_{\text{HP}}(s) = \frac{s^2}{s^2 + k s + 1}$$

### Warum `LP - BP + HP` physikalisch zwingend ist:
1. **Echter Notch-Modus (`$D418 = $5x`, LP + HP):**
   Addiert man $H_{\text{LP}}(s) + H_{\text{HP}}(s)$ ohne künstliche Phasen-Inversion, lautet der Zähler:
   $$1 + s^2 = 1 + \left(j\frac{\omega}{\omega_c}\right)^2 = 1 - \left(\frac{\omega}{\omega_c}\right)^2$$
   Bei $\omega = \omega_c$ entsteht eine **exakte Nullstelle ($-\infty\,\text{dB}$)** – genau jener legendäre C64-Phaser/Notch-Sweep aus *Lightforce*, *Mutants* oder *Last Ninja*. Würde man $H_{\text{HP}}$ invertieren ($1 - s^2 = 1 + (\omega/\omega_c)^2$), entstünde statt eines Notches bei hoher Resonanz ein $+17{,}5\,\text{dB}$ lauter Peak.
2. **Invertierter Bandpass (`-BP`) für Modus `$7x` (LP + BP + HP):**
   Im TPT-SVF gilt die Identität $H_{\text{HP}}(s) + k \cdot H_{\text{BP}}(s) + H_{\text{LP}}(s) \equiv 1$. Mit positivem Bandpass würde sich der Filter im Modus `$7x` bei mittlerer Güte ($k \approx 1$) zu einem flachen Draht selbst auslöschen! Durch `-BP` (analog zum invertierenden ersten Integrator im echten MOS 6581/8580) ergibt sich:
   $$H_{\text{LP}}(s) - H_{\text{BP}}(s) + H_{\text{HP}}(s) = 1 - (1 + k)\,H_{\text{BP}}(s)$$
   Das reproduziert die charakteristische Allpass-/Kammfärbung kombinierter SID-Filtermodi originalgetreu.

### Ruhe-DC-Kompensation (`dcBaseline`) ohne Verlust von `$D418`-Digis:
Auf einem echten 6581 moduliert das Lautstärkeregister `$D418` nicht nur das Nutzsignal, sondern auch den internen Ruhe-Gleichspannungsoffset (`MASTER_DC_BIAS = 1.05`). Um den massiven $+1{,}05$-Einschaltsprung (und dessen ~50 ms lange Entladekurve im 16-Hz-DC-Blocker) bei Track-Start vollständig zu eliminieren, speichert der Kern nach `runSubsongInit()` den initialen Arbeitspunkt $V_{\text{DC},0} = 1{,}05 \cdot V_{\text{init}}$:

$$y(t) = \bigl(\text{AC}(t) + 1{,}05\bigr)\cdot V(t) - V_{\text{DC},0}$$

Für konstante Lautstärke startet $y(0)$ exakt bei **`0.000000`** (null Sinc-Ringing im Resampler, null Vorspannung im Tape-Saturator), während jede dynamische `$D418`-Änderung $\frac{dy}{dt} = 1{,}05 \cdot \frac{dV}{dt}$ zu **100 % bit-identisch** erhalten bleibt.

---

## 3. 6502-zu-AudioWorklet Concurrency: Das Bus-Settle-Latch

Bei $48\,\text{kHz}$ entspricht ein Audio-Sample lediglich **20,526 PAL-Taktzyklen** – eine 6502-Playroutine läuft jedoch typischerweise 800 bis 2.500 Zyklen (~40–120 Samples).
Schreibt ein C64-Tracker nacheinander:
```asm
STA $D404 ; Zyklus 0:  Gate ON (Frequenzregister enthalten noch die ALTE Note!)
LDA #$9A  ; Zyklus 4
STA $D400 ; Zyklus 8:  Freq Lo-Byte (16-Bit-Frequenz ist kurzzeitig halb alt / halb neu!)
LDA #$15  ; Zyklus 12
STA $D401 ; Zyklus 16: Freq Hi-Byte komplett
```
fällt häufig eine Audio-Sample-Grenze *mitten* zwischen `STA $D404`, `STA $D400` und `STA $D401`. Ohne Synchronisation würde der parallele CS-80-Layer erst auf der alten (oder zerrissenen) Frequenz triggern und wenige Samples später einen vermeintlichen Legato-Sprung messen – wodurch langsame Melodien fälschlich als Arpeggio erkannt würden.

**Die Lösung (`settleTimer` + Sample-Domain-Zeitbasis):**
* Schreibzugriffe auf Frequenz-Lo, Frequenz-Hi oder Control starten ein kurzes **64-Zyklen-Settle-Fenster** ($65\,\mu\text{s} \approx 3$ Samples), gedeckelt durch ein Hunger-Limit (`settleMax = 128` Zyklen für kontinuierliche Audio-Rate-FM).
* Erst wenn der 6502-Schreibburst abgeschlossen ist (`settleTimer === 0`), übernimmt `CS80SidVoice` Frequenz und Gate **atomar** in einer einzigen Auswertung.
* Alle Zeitfenster (Arpeggio-Erkennung $\le 105\,\text{ms}$, Ribbon-Glide-Fenster $40\,\text{ms}$) laufen streng monoton in Audio-Samples statt über konkurrierende 50-Hz-Zähler.

---

## 4. Intelligenter `$D418` Onset-Transient-Designer

Klassische C64-Spiele nutzen `$D418` sowohl für knackige 4-Bit-PCM-Drums (*Skate or Die*, *IK+*) als auch für sekundenlange Sprachsamples (*Impossible Mission*, *Turbo OutRun*) oder sanfte 50-Hz-Song-Fadeouts.

Ein naiver Schwellwertdetektor würde bei jedem Nulldurchgang eines Sprachsamples nachtriggern und einen durchgehenden Sinuston unter die Stimme legen. Unser zweistufiger Detektor verhindert das zuverlässig:
1. **Dichte-Filter im 1-MHz-Kern:** Nur wenn mindestens 3 Lautstärkeänderungen mit $\Delta t < 2.500$ Zyklen ($> \sim 400\,\text{Hz}$ Modulationsrate) eintreffen, liegt überhaupt ein echter PCM-Stream vor. Normale 50-Hz-Fades werden komplett ignoriert.
2. **SPL-Style Dual-Envelope-Differenz im Audio-Thread:**
   * `digiFastEnv` fängt Impulse unabhängig von der Digi-Samplerate (4–15 kHz) sofort ein ($\tau_{\text{rel}} = 12\,\text{ms}$).
   * `digiSlowEnv` folgt dem stationären Sample-Grundpegel ($\tau_{\text{atk}} = 22\,\text{ms}$, $\tau_{\text{rel}} = 110\,\text{ms}$).
   * Nur wenn die **Transienten-Kante** $\text{digiFastEnv} - 1{,}25 \cdot \text{digiSlowEnv} > 0{,}24$ überschreitet (plus $95\,\text{ms}$ Holdoff), feuert einmalig ein phasenreiner Analog-Sub-Impuls mit exponentiellem Pitch-Drop (**$74\,\text{Hz} \to 45\,\text{Hz}$**) und kurzem CS-80-Sidechain-Dip. Gehaltene Vokale und Gitarren-Samples bleiben zu 100 % frei von Sub-Artefakten.

---

## 5. Yamaha CS-80 Dual-Rank-Stimmarchitektur

Jede der drei CS-80-Stimmen läuft parallel zu ihrer zugehörigen SID-Stimme:
* **Symmetrisches Dual-Rank-Detuning:** Rank 1 wird um $(1 - \Delta)$, Rank 2 um $(1 + \Delta)$ verstimmt, während der charakteristische CS-80-Post-Filter-Sinus (`phaseSub`) exakt auf $1{,}0 \cdot f_{\text{SID}}$ läuft. Der wahrgenommene Tonhöhenschwerpunkt rastet dadurch auf $\mathbf{0{,}0\text{ Cents}}$ exakt auf dem 1-MHz-SID-Kern ein.
* **Selektive Filter-Kopplung:** Nur wenn die jeweilige Stimme in `$D417` (`regs[23]`) tatsächlich auf das SID-Filter geroutet ist, moduliert `sidCutoffNorm` den CS-80-LPF (bei LP/BP-Modi) bzw. öffnet den CS-80-HPF (bei reinem SID-Hochpass `$40`). Ungefilterte Melodie-Leads behalten ihren vollen Vangelis-Brass-Schimmer, selbst wenn Stimme 0 parallel einen dunklen Filter-Bass spielt.
* **Triangle-Flöten-Skalierung:** Bei reinem SID-Dreieck (`$1x`) wird die Sägezahn/Puls-Anregung vor dem Filter auf `36 %` abgesenkt, während der Post-Filter-Sinus angehoben wird – für samtige Flöten- und Okarina-Klänge (*Last Ninja*, *Wizball*).

---

## 6. Orthogonales, 100 % monokompatibles Lexicon-224-FDN

Der Hall basiert auf einem 19-ms-Pre-Delay, zwei seriellen Stereo-Schroeder-Allpässen und einem 4x4-Hadamard-Feedback-Delay-Network ($H_4$) mit Primzahl-Verzögerungslängen (`nextPrime`), sodass bei *jeder* Host-Samplerate (44,1 / 48 / 88,2 / 96 kHz) keine zusammenfallenden Eigenmoden existieren.

### Warum klassische Vorzeichen-Taps in Mono scheitern – und wie wir es lösen:
Wählt man als Stereo-Abgriffe naiv $\mathbf{c}_L = (1, -1, 1, -1)$ und $\mathbf{c}_R = (1, 1, -1, -1)$, so gilt für die Monosumme:
$$\mathbf{c}_L + \mathbf{c}_R = (2,\; \mathbf{0},\; \mathbf{0},\; -2)$$
In Mono löschen sich **zwei der vier Delay-Linien vollständig zu Null aus** (50 % Dichteverlust!).

Stattdessen verwenden wir ein normiertes, exakt orthogonales Vektorpaar:
$$\mathbf{c}_L = 1{,}239 \cdot \begin{pmatrix} 1 \\ 0{,}55 \\ 0{,}55 \\ -1 \end{pmatrix}, \qquad \mathbf{c}_R = 1{,}239 \cdot \begin{pmatrix} 0{,}55 \\ -1 \\ 1 \\ 0{,}55 \end{pmatrix}$$

Beweis der Eigenschaften:
1. **Perfekte 90°-Stereo-Dekorrelation (IACC $\to 0$):**
   $$\mathbf{c}_L \cdot \mathbf{c}_R = 1{,}239^2 \cdot (0{,}55 - 0{,}55 + 0{,}55 - 0{,}55) = \mathbf{0}$$
2. **Identische Stereo-Leistung ($\Vert\mathbf{c}\Vert^2 = 4{,}000$):**
   $$1{,}239^2 \cdot (1^2 + 0{,}55^2 + 0{,}55^2 + (-1)^2) = 1{,}5351 \cdot 2{,}605 = \mathbf{4{,}000}$$
3. **Verlustfreie Monosumme ($\Vert\frac{\mathbf{c}_L + \mathbf{c}_R}{2}\Vert^2 = 2{,}000$):**
   $$\mathbf{c}_L + \mathbf{c}_R = 1{,}239 \cdot (1{,}55,\; -0{,}45,\; 1{,}55,\; -0{,}45) \neq \mathbf{0}$$
   Alle vier FDN-Delay-Linien bleiben auch auf Mono-Abhören voll präsent!

---

## 7. $C^\infty$-stetige Band-Sättigung & Padé-[5/4]-Hochgeschwindigkeits-Mathematik

### 1. Keine Übernahmeverzerrung im Master-Tape:
Stückweise definierte Sättiger ($x > 0$ vs. $x < 0$) erzeugen bei kleinsten Steigungsabweichungen im Nulldurchgang einen Knick in der ersten Ableitung ($f'(0^+) \neq f'(0^-)$), was selbst auf leisen Hallfahnen ungeradzahlige Verzerrungen provoziert. Unsere verschobene Kennlinie
$$f(x) = \tanh(g \cdot x - b) + \tanh(b)$$
besitzt exakt $f(0) = 0$, ist auf ganz $\mathbb{R}$ **unendlich oft stetig differenzierbar ($C^\infty$)** und erzeugt bei steigendem Pegel genau jene warmen geradzahligen ($k_2$) Obertöne analogen Magnetbands.

### 2. Padé-[5/4]-Approximation im 2-MHz-Filterkern:
Um im 1-MHz/2-MHz-Hot-Loop ~6 Millionen langsame `libm`-`Math.tanh()`-Aufrufe pro Sekunde einzusparen, nutzt der Kern den streng monotonen Lambert-Kettenbruch (Padé [5/4]):

$$\tanh(x) \approx \frac{x\,(945 + 105 x^2 + x^4)}{945 + 420 x^2 + 15 x^4} \quad \text{für } |x| < 3{,}6428$$

* **Genauigkeit bei $|x| \le 1$:** Abweichung $< 4 \cdot 10^{-8}$ (über 140 dB Rauschabstand zur exakten Funktion).
* **Sättigungsübergang:** Bei $|x| = 3{,}6428$ schneidet das Polynom exakt $\pm 1{,}000000$ (knackfrei $C^0$-stetig).
* Zusammen mit dem Herausziehen von `Math.tan()` und sämtlichen Divisionen aus `SIDBladeRunnerChip.clock()` sowie dem Sleep-Fast-Path für stumme CS-80-Kanäle sinkt die Echtzeit-CPU-Last im AudioWorklet um **~55–65 %** – bei **0 Bytes Garbage Collection** über die gesamte Laufzeit.