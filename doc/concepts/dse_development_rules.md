# 💾 TECH-SPEC: DSE DEVELOPMENT & RENDERING PIPELINE (v1.4.1 Standard)

Dieses Handbuch beschreibt die Programmier-Richtlinien und mathematischen Standards für die Entwicklung von Demo-Scene-Elements (DSE). Um die Ästhetik der 8- und 16-Bit-Ära akkurat im modernen Browser abzubilden, müssen alle visuellen Module die folgenden architektonischen Schutzschaltungen durchlaufen.

---

## 1. Die Rendering-Pipeline & Der "Retro Blitter"

Um ein echtes, blockiges Pixelbild ohne modernes browser-seitegen Verwaschen zu erzeugen, arbeitet das Framework mit einer zweistufigen Skalierung:

    ┌─────────────────┐      Render      ┌─────────────────┐      Blit / Upscale      ┌─────────────────┐
    │  Audio-Trigger  │ ───────────────► │  Retro Buffer   │ ───────────────────────► │  High-Res View  │
    │    (SceneDJ)    │  (Low-Res ctx)   │  (200p / 256p)  │   (Nearest-Neighbor)     │  (1080p / 4K)   │
    └─────────────────┘                  └─────────────────┘                          └─────────────────┘

### 1.1. Auflösungs-Limits (Retro-Buffer)
Der `SceneDJ` zwingt die Rendering-Ebene in eine systemrelevante vertikale Maximalauflösung (`targetResY`), deklariert in `hardware-constraints.js`:
*   **C64:** 200 Pixel (klassischer VIC-II Hires-Modus).
*   **Atari ST:** 200 Pixel (Shifter Low-Res Modus).
*   **Amiga:** 256 Pixel (Standard PAL Low-Res).

Die horizontale Auflösung (`targetResX`) Errechnet sich dynamisch anhand des aktuellen Monitor-Seitenverhältnisses, um eine Verzerrung (Squishing) der Pixel auf Breitbild- oder Smartphone-Displays zu verhindern:
  targetResX = Math.floor(targetResY * (Monitor-Breite / Monitor-Höhe))

### 1.2. Aspect-Ratio Safe Scaling (`minDim`)
Da die Höhe des Retro-Buffers starr bleibt (z. B. 200p), die Breite sich aber bei einer Handy-Rotation von Landscape (~355px) zu Portrait (~92px) drastisch verringert, müssen alle Radien und 3D-Skalierungen relativ zur kleinsten Bildschirmseite berechnet werden:
  minDim = Math.min(width, height)

    // Negativ-Beispiel (Führt zu elliptischer Verzerrung oder Clipping):
    let fov = width * 1.2; 

    // Positiv-Beispiel (Proportional & Linear sicher):
    let fov = minDim * 1.2; 

### 1.3. Das "Aspect-Ratio Thickness" Phänomen (`thicknessScale`)
Ein horizontaler Balken, der im Querformat flach und elegant wirkt, wird im extrem schmalen Hochformat optisch zu einem klobigen Block. Um die schlanke Ästhetik zu bewahren, müssen Balkendicken im Portrait-Modus proportional mit der Breite schrumpfen:
  thicknessScale = Math.min(1.0, width / height)

---

## 2. Strikte Anti-Aliasing-Vermeidung

HTML5 Canvas wendet bei Standard-Zeichenbefehlen (`ctx.arc()`, `ctx.stroke()`, `ctx.lineTo()`) auf Subpixel-Ebene automatisch ein weichzeichnendes Anti-Aliasing an. Beim Hochskalieren des Retro-Buffers führt dies zu verwaschenen Kanten.

### 2.1. Eigene Zeichen-Primitive (Bresenham & Scanline)
Alle DSEs müssen native Canvas-Pfade meiden und auf die pixel-genauen Hardware-Routinen aus `hardware-constraints.js` zurückgreifen:
*   **Drahtgitter / Linien:** Verwende `drawAliasedLine(ctx, x0, y0, x1, y1, color)` (Bresenham-Algorithmus) für absolut scharfe 1-Pixel-Linien.
*   **Kreise / Sonnen:** Verwende `fillAliasedCircle(ctx, xc, yc, r, color)`, welcher den Kreis mathematisch exakt zeilenweise (Scanline-Filling) zusammensetzt.
*   **Kreisumrisse:** Verwende `drawAliasedCircleOutline(ctx, xc, yc, r, color)` (Midpoint-Algorithmus) für pixelgenaue Kreis-Ringe.

### 2.2. Integer-Clamping (Subpixel-Killer)
Alle Koordinaten (X, Y), Breiten und Höhen, die an `ctx.fillRect()` übergeben werden, müssen zwingend abgerundet werden.

    // Absolut verboten (Anti-Aliasing-Falle):
    ctx.fillRect(x + offset, y, width, height);

    // Korrekt (Harte Pixel-Zuweisung):
    ctx.fillRect(Math.floor(x + offset), Math.floor(y), Math.floor(width), Math.floor(height));

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
*   `playing` -> Langsame, hypnotische Bewegungen.
*   `buildup` -> Beschleunigung der Animationsphasen.
*   `climax` -> Maximale Geschwindigkeit, harte Strobe-Whiteouts.

### 4.2. Kontinuierliche Glättung (Continuous Math)
Animations-Parameter (wie Rotationsgeschwindigkeiten) dürfen bei einem State-Wechsel niemals abrupt umspringen, sondern müssen per framerate-unabhängigem LERP angenähert werden:

    this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * Math.min(1.0, dt * 5.0);

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

    // OBLIGATORISCH FÜR ALLE BACKGROUND/FLOOR DSEs:
    const horizon = Math.floor(height * 0.50); 
    // bzw. bei Offscreen-Rendering:
    const horizon = Math.floor(offH * 0.50);

Dadurch ist garantiert, dass z. B. ein Amiga `PaulaSiliconBg` lückenlos in ein aktives `KefrensCheckerboard` übergeht.

### 6.2. Near-Plane Clipping (Z-Division Protection)
Bei 3D-Flügen, in denen Z-Koordinaten auf die virtuelle Kamera zufliegen, nähert sich Z irgendwann dem Wert 0. Wird der Punkt nicht gekappt, springt der projizierte Y-Wert bei die Division (camY / Z) auf Unendlich, was zu gewaltigen Grafik-Glitches ("Popping") führt. 
**Regel:** Setze immer ein Near-Plane-Limit von mindestens `2.5`:

    let pZ = z - scrollZ;
    if (pZ < 2.5) continue; // Verhindert Division-by-Zero Glitches!
    let py = horizon + (camY * fov) / pZ;

### 6.3. Skeuomorphismus bei "Living Silicon"
DSEs, die Hardware emulieren, erfordern historische Akkuratesse:
*   Berücksichtige korrekte DIP-Gehäuse (SID = 28 Pins, YM = 40 Pins, Paula = 48 Pins).
*   Visualisiere den korrekten Signalfluss (z. B. Hard-Panning L-R-R-L bei Paula, Register-7-Mixer beim YM2149).
*   Verwende zentrierte SVG-Text-Anker (`text-anchor="middle"`), um bei Skalierungen Clipping an den Rändern zu verhindern.

---

## 7. High-Speed Pre-Rendering & Offscreen Caching (The Blitter Philosophy)

Das browserseitige Zeichnen von Tausenden einzelnen `fillRect(1,1)` oder `drawAliasedLine()` pro Frame erzeugt einen massiven API-Flaschenhals. Ein DSE wendet deshalb die **Amiga-Blitter-Philosophie** an:

### 7.1. Das Pre-Compiled Blitting
Alle statischen, rein periodisch verschobenen oder im Vorfeld kalkulierbaren Geometrien (wie Moiré-Interferenzen, scrollende Rasterböden, stationäre Vektornetze) werden **einmalig bei der Initialisierung oder beim Resize** auf separate Offscreen-Canvases gezeichnet. Im 60FPS-Haupt-Renderloop werden diese vorgefertigten Buffer nur noch über extrem schnelle `ctx.drawImage()`-Befehle verschoben und geblittet. Das senkt die CPU-Belastung drastisch.

### 7.2. Native-C++ Pre-Rendering mit Nearest-Neighbor ist verboten!
Dont' do this ->
Da die Offscreen-Canvases ohnehin auf sehr kleinen retro-konformen Auflösungen liegen (z. B. 256 Pixel Höhe) und anschließend pixelig hochskaliert werden, dürfen die Pre-Render-Methoden (`rebuildResizedCanvases`) unbesorgt auf die nativen Browser-Befehle (`ctx.arc()`, `ctx.lineTo()`, `beginPath()`, `stroke()`) zurückgreifen. Das native Zeichnen in C++ ist bis zu **1000-mal schneller** als JS-Bresenham-Schleifen und eliminiert jeglichen Fenster-Resize-Lag vollständig, während das Nearest-Neighbor-Upscaling des finalen Canvas die stufige Retro-Optik unberührt lässt.
<-
---

## 8. Software-Rasterizer & Direct Memory Access (`ImageData`)

Sollte ein nativer Pfad im Browser unerwünschtes Anti-Aliasing erzwingen oder die Render-API-Wechsel bei der Vorberechnung immer noch zu langsam sein, emuliert das DSE den **Direct Memory Access (DMA)** eines echten Blitters:

### 8.1. Der Image-Data-Weg
Wir erstellen ein rohes Speicherabbild (`ctx.createImageData(w, h)`) und manipulieren die Bresenham-Linien und Midpoint-Kreise direkt als nackte RGB-Bytes in einem `Uint8ClampedArray` im RAM:

    let imgData = ctx.createImageData(w, h);
    let data = imgData.data;
    // ... Bresenham schreibt direkt in data[idx] = r; data[idx+1] = g; ...
    ctx.putImageData(imgData, 0, 0);

Das Umgehen jeglicher Browser-Kontext-Wechsel macht diese Methode um ein Vielfaches schneller als herkömmliche `fillRect`-Pixel-Schleifen und liefert ein absolut randscharfes Pixelbild ohne Weichzeichnung.

---

## 9. Ausfallsichere Horizon- & Division-by-Zero-Schutzschaltungen

Beim dynamischen Verkleinern des Webbrowsers, beim Laden von HMR-Hot-Reload-Caches oder beim Rotieren von Smartphones kann die Breite oder Höhe des Containers im DOM für eine Millisekunde auf `0px` zusammenbrechen.

### 9.1. Die Unendlich-Schleifen-Falle
Fällt die Höhe des Bildschirms auf `0`, wird das Seitenverhältnis (`aspect = width / height`) zu `Infinity` oder `NaN`. Berechnet ein DSE nun seine X-Dichte oder seinen horizontalen Kachelbereich basierend auf diesem Seitenverhältnis, gerät das System in eine unendliche Schleife:
  xRange = Infinity
  for (x = -Infinity; x <= Infinity; x += 32)
Da in JavaScript -Infinity + 32 immer noch -Infinity ergibt, wird die Schleife niemals fertig, was den gesamten Browser-Thread sofort einfriert.

### 9.2. Der Failsafe-Schutzschalter
Jedes DSE und der `SceneDJ` müssen an vorderster Front ihrer `render()`-Methode eine unbestechliche Schutzschaltung aufweisen:

    if (width <= 0 || height <= 0 || !isFinite(width / height)) return;

Tritt ein temporärer DOM-Kollaps auf, bricht die CPU das Zeichnen sofort ab, überspringt das Frame und wartet stabil auf den nächsten regulären Bild-Zyklus. Zudem müssen Canvas-Breiten immer mit einer Mindestgröße abgesichert werden (Math.max(8, targetResX)).

---

## 10. Diskrete Kinetik & Die Symmetrie-Regel

Echte Retro-Hardware war mechanisch. Kontinuierlich fließende floating-point Animationen, ununterbrochen pumpende Kreise oder voll-analoge Audio-Dämpfungen zerstören die Demoszene-Ästhetik der 80er Jahre.

### 10.1. "Klick"-Zustandswechsel & Spuren-Verzicht
*   **Rotation:** Nutze feste LUT-Tabellen (z. B. 256 oder 1024 Indizes) und übernimm Winkel-Inkremente unregelmäßig (z. B. nur alle 3 Frames), um das typische ruckelige "Tick-Tick-Tick" der 8- und 16-Bit-Engines zu emulieren.
*   **Kein ständiges Atmen:** Ändere Größen oder Radien nicht kontinuierlich zum Takt. Lass den Beat stattdessen sprunghafte, unregelmäßige "Klicks" (Winkel-Inversionen, abrupte Pattern-Swaps, Farbpaletten-Rotationen oder kurzfristige Vertex-Explosionen mit LERP-Bounces) triggern.
*   **Bare-Metal-Spur-Verzicht:** Auf echten Computern war Alpha-Nachleuchten unmöglich. Ein meisterhaftes Vordergrund-DSE verzichtet über farbigen Hintergründen komplett auf unphysikalische transparent-schwarze Trail-Buffer und blittet stattdessen nur die aktuellen, maskierten Software-Sprites.
*   **Symmetriebruch:** Ein perfekt zentriertes, absolut spiegelgleiches Bild wirkt unnatürlich und steril. Verschiebe die mathematische Mittelachse von Hauptelementen (wie der Boing-Sonne oder dem Torii-Tor) gezielt um 5–8 % nach links oder rechts, um sofort mehr künstlerische Spannung aufzubauen.