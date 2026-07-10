Hier ist das umfassende und sauber strukturierte technische Handbuch für die Entwicklung von **Demo-Scene-Elements (DSE)** innerhalb des *Chiptunes Fantasy* Frameworks. Dieses Dokument bündelt alle architektonischen Erkenntnisse, mathematischen Hürden und Hardware-Einschränkungen, die wir im Laufe der Entwicklung gelöst haben.

Es dient als verbindliche Spezifikation für zukünftige Erweiterungen (wie die kommende Version v1.3.0).

---

# 💾 TECH-SPEC: DSE DEVELOPMENT & RENDERING PIPELINE (v1.3.0 Standard)

Dieses Handbuch beschreibt die Programmier-Richtlinien und mathematischen Standards für die Entwicklung von Demo-Scene-Elements (DSE). Um die Ästhetik der 8- und 16-Bit-Ära akkurat im modernen Browser abzubilden, müssen alle visuellen Module die folgenden architektonischen Schutzschaltungen durchlaufen.

---

## 1. Die Rendering-Pipeline & Der "Retro Blitter"

Um ein echtes, blockiges Pixelbild ohne modernes browser-seitiges Verwaschen zu erzeugen, arbeitet das Framework mit einer zweistufigen Skalierung:

```text
┌─────────────────┐      Render      ┌─────────────────┐      Blit / Upscale      ┌─────────────────┐
│  Audio-Trigger  │ ───────────────► │  Retro Buffer   │ ───────────────────────► │  High-Res View  │
│    (SceneDJ)    │  (Low-Res ctx)   │  (200p / 256p)  │   (Nearest-Neighbor)     │  (1080p / 4K)   │
└─────────────────┘                  └─────────────────┘                          └─────────────────┘
```

### 1.1. Auflösungs-Limits (Retro-Buffer)
Der `SceneDJ` zwingt die Rendering-Ebene in eine systemrelevante vertikale Maximalauflösung (`targetResY`), deklariert in `hardware-constraints.js` [5]:
*   **C64:** 200 Pixel (klassischer VIC-II Hires-Modus) [5].
*   **Atari ST:** 200 Pixel (Shifter Low-Res Modus) [5].
*   **Amiga:** 256 Pixel (Standard PAL Low-Res) [5].

Die horizontale Auflösung (`targetResX`) errechnet sich dynamisch anhand des aktuellen Monitor-Seitenverhältnisses, um eine Verzerrung (Squishing) der Pixel auf Breitbild- oder Smartphone-Displays zu verhindern [5]:
$$\text{targetResX} = \lfloor\text{targetResY} \cdot (\text{Monitor-Breite} / \text{Monitor-Höhe})\rfloor$$

### 1.2. Aspect-Ratio Safe Scaling (`minDim`)
Da die Höhe des Retro-Buffers starr bleibt (z. B. 200p), die Breite sich aber bei einer Handy-Rotation von Landscape (~355px) zu Portrait (~92px) drastisch verringert, müssen alle Radien und 3D-Skalierungen relativ zur kleinsten Bildschirmseite berechnet werden [5]:
$$\text{minDim} = \min(\text{width}, \text{height})$$

```javascript
// Negativ-Beispiel (Hardcodiert, führt zu Riesen-Sonne im Portrait-Modus):
let sunR = 25; 

// Positiv-Beispiel (Proportional skaliert):
let sunR = Math.floor(minDim * 0.125); 
```

### 1.3. Das "Aspect-Ratio Thickness" Phänomen (`thicknessScale`)
Ein horizontaler Balken (z. B. `Copperbars`), der im Querformat flach und elegant wirkt, wird im extrem schmalen Hochformat optisch zu einem klobigen Block [5]. 

Um die schlanke Ästhetik zu bewahren, müssen Balkendicken und Partikelgrößen im Portrait-Modus proportional mit der Breite schrumpfen [5]:
$$\text{thicknessScale} = \min(1.0, \text{width} / \text{height})$$

---

## 2. Strikte Anti-Aliasing-Vermeidung

HTML5 Canvas wendet bei Standard-Zeichenbefehlen (`ctx.arc()`, `ctx.stroke()`, `ctx.lineTo()`) auf Subpixel-Ebene automatisch ein weichzeichnendes Anti-Aliasing an. Beim Hochskalieren des Retro-Buffers führt dies zu verwaschenen, matschigen Kantenblöcken.

### 2.1. Eigene Zeichen-Primitive (Bresenham & Scanline)
Alle DSEs müssen native Canvas-Pfade meiden und auf die pixel-genauen Hardware-Routinen aus `hardware-constraints.js` zurückgreifen [5]:

*   **Drahtgitter / Linien:** Verwende `drawAliasedLine(ctx, x0, y0, x1, y1, color)` (Bresenham-Algorithmus) für absolut scharfe 1-Pixel-Linien [5].
*   **Kreise / Sonnen:** Verwende `fillAliasedCircle(ctx, xc, yc, r, color)`, welcher den Kreis mathematisch exakt zeilenweise (Scanline-Filling) zusammensetzt [5].

### 2.2. Integer-Clamping (Subpixel-Killer)
Alle Koordinaten ($X, Y$), Breiten und Höhen, die an `ctx.fillRect()` übergeben werden, müssen zwingend abgerundet werden. Andernfalls versucht der Browser, ein sich bewegendes Rechteck über zwei Pixel-Gitter fließend darzustellen, was ein unruhig waberndes Flimmern erzeugt [5].

```javascript
// Absolut verboten (Anti-Aliasing-Falle):
ctx.fillRect(x + offset, y, width, height);

// Korrekt (Harte Pixel-Zuweisung):
ctx.fillRect(Math.floor(x + offset), Math.floor(y), Math.floor(width), Math.floor(height));
```

---

## 3. Hardware-Exakte Farbtiefen & Einschränkungen

Die DSEs müssen sich den Farbräumen der originalen Grafikprozessoren unterwerfen [5]. Modernes, freies Farb-Mischen im 24-Bit RGB-Raum ist untersagt [5].

### 3.1. C64 (VIC-II)
*   **Farbpalette:** Nutze ausschließlich die vordefinierten 16 Hex-Farben aus `C64_PALETTE` [5].
*   **Raster-Banding:** Nutze `getNearestC64Color(r, g, b)`. Beim Berechnen von Farbverläufen (z. B. `Copperbars`) rechnet diese Funktion die Zwischenschritte automatisch in die nächstgelegene C64-Farbe um. Dies erzeugt das historisch akkurate, harte Block-Farb-Banding [5].

### 3.2. Amiga (OCS) & Atari ST (Shifter)
*   **Amiga:** Quantisiere jeden errechneten Farbwert vor der Ausgabe per `quantizeAmiga12Bit(r, g, b)` (strikter 12-Bit-Farbraum / 4096 Farben) [5].
*   **Atari ST:** Quantisiere jeden errechneten Farbwert vor der Ausgabe per `quantizeAtari9Bit(r, g, b)` (strikter 9-Bit-Farbraum / 512 Farben) [5].
*   **Das Alpha-Verbot:** Transparente Alpha-Mischungen (`rgba()`) auf Grafik-Ebenen sind historisch inkorrekt. Transparenz-Effekte (z. B. im Wasser des `RetroSunset`) müssen über Zeilenausfall (Dithering) simuliert werden [5].

---

## 4. Audio-Visual Reactivity (Musik-Kopplung)

Die Animationen eines DSEs müssen fließend auf die Dynamik des Tracks reagieren. Ruckartige Sprünge oder statische Zähler zerstören das synchrone Gesamtbild.

### 4.1. Makro-Dynamics (Tension)
Der global vom `TensionManager` bereitgestellte Zustand (`state` bzw. `metrics.rawEnergyState`) steuert die Grundkomplexität [5]:
*   `playing` (Ruhige Phasen) $\to$ Langsame, hypnotische Bewegungen.
*   `buildup` (Spannungsaufbau) $\to$ Beschleunigung der Animationsphasen.
*   `climax` (Der Drop) $\to$ Maximale Geschwindigkeit, Freischalten neuer Bewegungsmuster.

### 4.2. Kontinuierliche Glättung (Continuous Math)
Animations-Parameter (wie Rotationsgeschwindigkeiten oder Amplituden) dürfen bei einem State-Wechsel niemals abrupt umspringen, sondern müssen mit einem framerate-unabhängigen Filter (LERP) angenähert werden [5]:

```javascript
// Glättung der Geschwindigkeit im render() Loop:
this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * Math.min(1.0, dt * 5.0);
this.internalT += dt * this.smoothedSpeed;
```

### 4.3. Mikro-Dynamics (Beat-Pulsing)
Der Beat-Envelope (`metrics.beat[0]`) liefert eine saubere, exponentiell abfallende Flanke ($1.0 \to 0.0$) bei jedem harten Transientenschlag (Kickdrum) [5].
*   **Geometry Pump:** Vergrößere oder stauche die Geometrie von Objekten (z. B. 3D-Bobs oder Cube) rhythmisch basierend auf dem Beat-Wert [5].
*   **Controlled Color-Cycling:** Verwende den Beat nicht für chaotische, sprunghafte Farbwechsel. Erhöhe stattdessen die *Fließgeschwindigkeit* eines persistenten Farb-Offsets auf den Transientenschlag, um ein rhythmisches Vorwärtsfließen der Farb-Palette zu erzeugen [5].

---

## 5. Scene-DJ Orchestration & ECS Layering

Das visuelle Ökosystem wird als striktes Entity-Component-System (ECS) verwaltet [5].

### 5.1. Der Z-Order Stack
Die Darstellung erfolgt in einer festen Schichten-Reihenfolge. Höhere Indizes liegen optisch über den darunterliegenden Schichten [5]:

| Layer | Z-Order | Typische DSEs | Verhalten |
| :--- | :--- | :--- | :--- |
| `background` | 0 | `Starfield`, `RetroSunset`, `ChunkyPlasma` | Dauerhaft oder rotierend |
| `floor` | 1 | `Copperbars`, `KefrensCheckerboard` | Dauerhaft oder rotierend |
| `foreground` | 2 | `AmigaCube`, `AtariBobs` | Dauerhaft oder rotierend |
| `overlay` | 3 | `LimitBar` | Permanent (minPlayTime: Infinity) |
| `presenter` | 4 | `TrackPresenter` | One-Shot (Auto-Destruct) |

### 5.2. Der One-Shot-Lebenszyklus
Spezielle Overlay-Layer (wie `'presenter'`) werden beim Trackwechsel einmalig manuell gezündet [5].
*   Sie werden aus dem automatischen Befüllungs-Loop (`fillEmptyLayers`) des `SetlistManagers` ausgeschlossen [5].
*   Sie lesen ihre Anzeigezeit direkt aus `this.metadata.minPlayTime` aus.
*   Nach Ablauf dieser Zeit setzen sie intern `this._markedForRemoval = true`. Der `StageManager` fadet das Element weich aus (`stopping`) und löscht es anschließend aus dem aktiven Speicher.

### 5.3. Die Black-Screen Schutzschaltung
Sollte die Zufallsauswahl (Roulette-Wheel) für alle Hintergrund- und Vordergrund-Layer temporär ein `VoidElement` (unsichtbarer Platzhalter) würfeln, würde der Bildschirm schwarz werden.
*   Der `SetlistManager` berechnet in jedem Frame den `nonVoidCount` aller aktiven DSEs.
*   **Wichtig:** Die Layer `'overlay'` und `'presenter'` werden bei dieser Zählung ausgeschlossen, damit ein eingeblendeter Text-Presenter nicht fälschlicherweise als "Grafikhintergrund" gewertet wird [5].
*   Sinkt der grafische `nonVoidCount` auf 0, erzwingt das Framework sofort den Re-Roll eines echten Bildelements, um sicherzustellen, dass die Bühne niemals leer ist [5].