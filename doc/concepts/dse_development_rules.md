

---

### 📄 Aktualisiertes Dokument: `doc/_development_rules.md`

```markdown
# 💾 TECH-SPEC: DSE DEVELOPMENT & RENDERING PIPELINE (v1.4.0 Standard)

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
Der `SceneDJ` zwingt die Rendering-Ebene in eine systemrelevante vertikale Maximalauflösung (`targetResY`), deklariert in `hardware-constraints.js`:
*   **C64:** 200 Pixel (klassischer VIC-II Hires-Modus).
*   **Atari ST:** 200 Pixel (Shifter Low-Res Modus).
*   **Amiga:** 256 Pixel (Standard PAL Low-Res).

Die horizontale Auflösung (`targetResX`) errechnet sich dynamisch anhand des aktuellen Monitor-Seitenverhältnisses, um eine Verzerrung (Squishing) der Pixel auf Breitbild- oder Smartphone-Displays zu verhindern:
$$\text{targetResX} = \lfloor\text{targetResY} \cdot (\text{Monitor-Breite} / \text{Monitor-Höhe})\rfloor$$

### 1.2. Aspect-Ratio Safe Scaling (`minDim`)
Da die Höhe des Retro-Buffers starr bleibt (z. B. 200p), die Breite sich aber bei einer Handy-Rotation von Landscape (~355px) zu Portrait (~92px) drastisch verringert, müssen alle Radien und 3D-Skalierungen relativ zur kleinsten Bildschirmseite berechnet werden:
$$\text{minDim} = \min(\text{width}, \text{height})$$

```javascript
// Negativ-Beispiel (Führt zu elliptischer Verzerrung oder Clipping):
let fov = width * 1.2; 

// Positiv-Beispiel (Proportional & Linear sicher):
let fov = minDim * 1.2; 
```

### 1.3. Das "Aspect-Ratio Thickness" Phänomen (`thicknessScale`)
Ein horizontaler Balken, der im Querformat flach und elegant wirkt, wird im extrem schmalen Hochformat optisch zu einem klobigen Block. Um die schlanke Ästhetik zu bewahren, müssen Balkendicken im Portrait-Modus proportional mit der Breite schrumpfen:
$$\text{thicknessScale} = \min(1.0, \text{width} / \text{height})$$

---

## 2. Strikte Anti-Aliasing-Vermeidung

HTML5 Canvas wendet bei Standard-Zeichenbefehlen (`ctx.arc()`, `ctx.stroke()`, `ctx.lineTo()`) auf Subpixel-Ebene automatisch ein weichzeichnendes Anti-Aliasing an. Beim Hochskalieren des Retro-Buffers führt dies zu verwaschenen Kanten.

### 2.1. Eigene Zeichen-Primitive (Bresenham & Scanline)
Alle DSEs müssen native Canvas-Pfade meiden und auf die pixel-genauen Hardware-Routinen aus `hardware-constraints.js` zurückgreifen:
*   **Drahtgitter / Linien:** Verwende `drawAliasedLine(ctx, x0, y0, x1, y1, color)` (Bresenham-Algorithmus) für absolut scharfe 1-Pixel-Linien.
*   **Kreise / Sonnen:** Verwende `fillAliasedCircle(ctx, xc, yc, r, color)`, welcher den Kreis mathematisch exakt zeilenweise (Scanline-Filling) zusammensetzt.

### 2.2. Integer-Clamping (Subpixel-Killer)
Alle Koordinaten ($X, Y$), Breiten und Höhen, die an `ctx.fillRect()` übergeben werden, müssen zwingend abgerundet werden.
```javascript
// Absolut verboten (Anti-Aliasing-Falle):
ctx.fillRect(x + offset, y, width, height);

// Korrekt (Harte Pixel-Zuweisung):
ctx.fillRect(Math.floor(x + offset), Math.floor(y), Math.floor(width), Math.floor(height));
```

---

## 3. Hardware-Exakte Farbtiefen & Einschränkungen

Die DSEs müssen sich den Farbräumen der originalen Grafikprozessoren unterwerfen. Modernes, freies Farb-Mischen im 24-Bit RGB-Raum ist untersagt.

*   **C64 (VIC-II):** Nutze ausschließlich die vordefinierten 16 Hex-Farben aus `C64_PALETTE`. Nutze `getNearestC64Color(r, g, b)` für Color-Cycling und hartes Raster-Banding.
*   **Amiga (OCS):** Quantisiere jeden errechneten Farbwert vor der Ausgabe per `quantizeAmiga12Bit(r, g, b)` (strikter 12-Bit-Farbraum / 4096 Farben).
*   **Atari ST (Shifter):** Quantisiere jeden errechneten Farbwert vor der Ausgabe per `quantizeAtari9Bit(r, g, b)` (strikter 9-Bit-Farbraum / 512 Farben).

---

## 4. Audio-Visual Reactivity (Musik-Kopplung)

### 4.1. Makro-Dynamics (Tension)
Der global vom `TensionManager` bereitgestellte Zustand (`state` bzw. `metrics.rawEnergyState`) steuert die Grundkomplexität:
*   `playing` $\to$ Langsame, hypnotische Bewegungen.
*   `buildup` $\to$ Beschleunigung der Animationsphasen.
*   `climax` $\to$ Maximale Geschwindigkeit, harte Strobe-Whiteouts.

### 4.2. Kontinuierliche Glättung (Continuous Math)
Animations-Parameter (wie Rotationsgeschwindigkeiten) dürfen bei einem State-Wechsel niemals abrupt umspringen, sondern müssen per framerate-unabhängigem LERP angenähert werden:
```javascript
this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * Math.min(1.0, dt * 5.0);
```

### 4.3. Mikro-Dynamics (Beat-Pulsing)
Der Beat-Envelope (`metrics.beat[0]`) liefert eine saubere, exponentiell abfallende Flanke bei jedem harten Transientenschlag. Verwende diesen Wert, um 3D-Geometrien zu pumpen oder Leuchtkraft (`illumination`) direkt zu addieren.

---

## 5. Scene-DJ Orchestration & ECS Layering

Das visuelle Ökosystem wird als striktes Entity-Component-System (ECS) verwaltet, geordnet nach der Eigenschaft `placementType`.

| Layer | Z-Order | Typische DSEs | Verhalten |
| :--- | :--- | :--- | :--- |
| `background` | 0 | `Starfield`, `RetroSunset`, `PaulaSiliconBg` | Dauerhaft oder rotierend |
| `floor` | 1 | `Copperbars`, `KefrensCheckerboard` | Dauerhaft oder rotierend |
| `foreground` | 2 | `AmigaCube`, `AtariDotTorus` | Dauerhaft oder rotierend |
| `overlay` | 3 | `LimitBar` | Permanent (`minPlayTime: Infinity`) |
| `presenter` | 4 | `TrackPresenter` | One-Shot (Auto-Destruct) |

Sollte der DJ für alle grafischen Ebenen einen `VoidElement` (unsichtbaren Platzhalter) würfeln, greift eine Black-Screen-Schutzschaltung, die sofort einen Re-Roll erzwingt.

---

## 6. 3D-Geometrie & Die Horizont-Regel (Horizon Alignment)

Um sicherzustellen, dass DSEs unterschiedlicher Schichten (z. B. `background` und `floor`) nahtlos ineinandergreifen, ohne dass Kanten clippen oder schwarze Lücken im Canvas entstehen, müssen folgende geometrische Gesetze beachtet werden:

### 6.1. Die absolute 50%-Horizont-Regel
Alle DSEs, die eine Boden-Fläche, ein Raster oder eine perspektivische Fluchtlinie zeichnen, müssen ihren mathematischen Horizont exakt auf **50% der vertikalen Auflösung** fixieren!
```javascript
// OBLIGATORISCH FÜR ALLE BACKGROUND/FLOOR DSEs:
const horizon = Math.floor(height * 0.50); 
// bzw. bei Offscreen-Rendering:
const horizon = Math.floor(offH * 0.50);
```
Dadurch ist garantiert, dass z. B. ein Amiga `PaulaSiliconBg` lückenlos in ein aktives `KefrensCheckerboard` übergeht.

### 6.2. Near-Plane Clipping (Z-Division Protection)
Bei 3D-Flügen, in denen Z-Koordinaten auf die virtuelle Kamera zufliegen, nähert sich $Z$ irgendwann dem Wert $0$. Wird der Punkt nicht gekappt, springt der projizierte $Y$-Wert bei der Division ($\text{camY} / Z$) auf Unendlich, was zu gewaltigen Grafik-Glitches ("Popping") führt. 
**Regel:** Setze immer ein Near-Plane-Limit von mindestens `2.5`:
```javascript
let pZ = z - scrollZ;
if (pZ < 2.5) continue; // Verhindert Division-by-Zero Glitches!
let py = horizon + (camY * fov) / pZ;
```

### 6.3. Skeuomorphismus bei "Living Silicon"
DSEs, die Hardware emulieren, erfordern historische Akkuratesse:
*   Berücksichtige korrekte DIP-Gehäuse (SID = 28 Pins, YM = 40 Pins, Paula = 48 Pins).
*   Visualisiere den korrekten Signalfluss (z. B. Hard-Panning L-R-R-L bei Paula, Register-7-Mixer beim YM2149).
*   Verwende zentrierte SVG-Text-Anker (`text-anchor="middle"`), um bei Skalierungen Clipping an den Rändern zu verhindern.
```

---
