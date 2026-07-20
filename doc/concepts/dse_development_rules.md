# 💾 TECH-SPEC: DSE DEVELOPMENT & RENDERING PIPELINE

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
`targetResX = Math.floor(targetResY * (Monitor-Breite / Monitor-Höhe))`

### 1.2. Aspect-Ratio Safe Scaling (`minDim`)
Da die Höhe des Retro-Buffers starr bleibt (z. B. 200p), die Breite sich aber bei einer Handy-Rotation von Landscape (~355px) zu Portrait (~92px) drastisch verringert, müssen alle Radien und 3D-Skalierungen relativ zur kleinsten Bildschirmseite berechnet werden:
`minDim = Math.min(width, height)`

```javascript
// Negativ-Beispiel (Führt zu elliptischer Verzerrung oder Clipping):
let fov = width * 1.2; 

// Positiv-Beispiel (Proportional & Linear sicher):
let fov = minDim * 1.2; 
```

### 1.3. Das "Aspect-Ratio Thickness" Phänomen (`thicknessScale`)
Ein horizontaler Balken, der im Querformat flach und elegant wirkt, wird im extrem schmalen Hochformat optisch zu einem klobigen Block. Um die schlanke Ästhetik zu bewahren, müssen Balkendicken im Portrait-Modus proportional mit der Breite schrumpfen:
`thicknessScale = Math.min(1.0, width / height)`

---

## 2. Strikte Anti-Aliasing-Vermeidung

HTML5 Canvas wendet bei Standard-Zeichenbefehlen automatisch ein weichzeichnendes Anti-Aliasing auf Subpixel-Ebene an. Beim Hochskalieren des Retro-Buffers führt dies zu verwaschenen Kanten.

### 2.1. Eigene Zeichen-Primitive (Bresenham & Scanline)
Alle DSEs müssen native Canvas-Pfade meiden und auf die pixel-genauen Hardware-Routinen aus `hardware-constraints.js` zurückgreifen:
*   **Drahtgitter / Linien:** Verwende `drawAliasedLine(ctx, x0, y0, x1, y1, color)` (Bresenham-Algorithmus) für absolut scharfe 1-Pixel-Linien.
*   **Kreise / Sonnen:** Verwende `fillAliasedCircle(ctx, xc, yc, r, color)` für zeilenweises (Scanline-Filling) Zeichnen.
*   **Kreisumrisse:** Verwende `drawAliasedCircleOutline(ctx, xc, yc, r, color)` (Midpoint-Algorithmus) für pixelgenaue Kreis-Ringe.

### 2.2. Integer-Clamping (Subpixel-Killer)
Alle Koordinaten, Breiten und Höhen, die an Zeichen-Befehle übergeben werden, müssen zwingend abgerundet werden. **Achtung: Auch Zwischenvariablen können ungerade Floats sein!**

```javascript
// GEFÄHRLICH (Der halbe Pixel 177.5 erzwingt unbarmherzig weiche Render-Kanten!):
let cx = width / 2;
let span = width * 0.35;
ctx.fillRect(cx - span, y, w, h);

// KORREKT (Erzwungenes Ganzzahl-Raster):
let cx = Math.floor(width / 2);
let span = Math.floor(width * 0.35);
ctx.fillRect(cx - span, y, w, h);
```

### 2.3. CSS-Level Anti-Aliasing (Vollbild- & Retina-Schutz)
Damit der Browser das `<canvas>`-Element beim Strecken auf hochauflösenden Retina-Displays oder im maximierten Vollbild-Modus nicht hardwareseitig bilinear weichzeichnet, muss im Stylesheet zwingend folgender CSS-Filter aktiv sein:

```css
canvas {
    image-rendering: -moz-crisp-edges;
    image-rendering: -webkit-crisp-edges;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
}
```

---

## 3. Hardware-Exakte Farbtiefen & Einschränkungen

Die DSEs müssen sich den Farbräumen der originalen Grafikprozessoren unterwerfen. Modernes, freies Farb-Mischen im 24-Bit RGB-Raum oder Alpha-Transparenzen sind untersagt.

*   **C64 (VIC-II):** Nutze ausschließlich die vordefinierten 16 Hex-Farben aus `C64_PALETTE`. Nutze `getNearestC64Color(r, g, b)` für Color-Cycling und hartes Raster-Banding.
*   **Amiga (OCS):** Quantisiere jeden errechneten Farbwert vor der Ausgabe per `quantizeAmiga12Bit(r, g, b)` (strikter 12-Bit-Farbraum / 4096 Farben).
*   **Atari ST (Shifter):** Quantisiere jeden errechneten Farbwert vor der Ausgabe per `quantizeAtari9Bit(r, g, b)` (strikter 9-Bit-Farbraum / 512 Farben).

### 3.1. Die Alpha-Sünde (Absolute Opazität)
Auf echter 8/16-Bit-Hardware gab es kein Alpha-Blending. Jedes gezeichnete Pixel muss zu 100 % deckend (opak) auf das Canvas geblittet werden.
*   **Kollaps statt Verblassen:** Nutze keine `globalAlpha` Blenden für Übergänge. Lass Elemente stattdessen mechanisch aus dem Bildschirmrand rutschen (LimitBar) oder zur Mitte kollabieren (Presenter).
*   **Opaque Overlaps:** Wenn sich zwei Layer (z. B. Copperbars) kreuzen, stanzt der vordere den hinteren komplett und scharfkantig aus (Z-Overdraw).
*   **Raster-Gates:** Anstatt inaktive Tonspuren transparent auszufaden, schalte das Zeichnen ihrer Repräsentanten ab einer gewissen Stummheits-Schwelle augenblicklich und hart ab (`if (vol < 0.04) continue;`).

---

## 4. Audio-Visual Reactivity (Musik-Kopplung)

### 4.1. Hardware-Register-Sniffing (Nerd Gold)
Koppele die GFX-Elemente nicht bloß an das globale Volumen, sondern lies direkt die emulierten Soundchip-Register aus (`metrics.regs`):
*   Zeichne schwingende Oscillator-Kerne basierend auf den Wavetable-Bits (SID `$D404`).
*   Bringe ADSR-Tracer auf echten Hüllkurven-Pfaden zum Glenz-Gleiten (Envelope-Sniffing).
*   Verzögere oder beschleunige 3D-Rotationen (Atari) direkt gekoppelt an die Lautstärkeregister (R8, R9, R10) des YM2149F.

### 4.2. Event-based Climax & Afterglow-Dramaturgie
Ein Climax ist ein explosives, kurzes Ereignis, kein Dauerfeuer!
*   **50/50 Split:** Teilt die `climaxHoldTime` der DSE-Metadaten hälftig auf. Die erste Hälfte zündet einen unbarmherzig weißen 3D-Kollaps (Climax-Event), die zweite Hälfte schaltet das System in den **Afterglow-Modus** (Abkühlphase).
*   **Atmendes Verblassen:** Im Afterglow sinkt die `tension` linear auf Null zurück. Der LimitBar schmilzt bündig weg, die Farbpaletten kühlen ab und Rotationen verlangsamen sich sachte, um dem Auge Kontrast und Erholung zu bieten.

### 4.3. Mikro-Dynamics (Beat-Pulsing)
Der Beat-Envelope (`metrics.beat[0]`) liefert eine saubere, exponentiell abfallende Flanke bei jedem harten Transientenschlag. Verwende diesen Wert, um 3D-Geometrien sprunghaft zu pumpen.

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
Alle DSEs, die eine Boden-Fläche, uneben oder flach, ein Raster oder eine perspektivische Fluchtlinie zeichnen, müssen ihren mathematischen Horizont exakt auf **50% der vertikalen Auflösung** fixieren!

```javascript
// OBLIGATORISCH FÜR ALLE BACKGROUND/FLOOR DSEs:
const horizon = Math.floor(height * 0.50); 
// bzw. bei Offscreen-Rendering:
const horizon = Math.floor(offH * 0.50);
```

Dadurch ist garantiert, dass z. B. ein Amiga `PaulaSiliconBg` lückenlos in ein aktives `KefrensCheckerboard` übergeht.

### 6.2. Near-Plane Clipping (Z-Division Protection)
Bei 3D-Flügen, in denen Z-Koordinaten auf die virtuelle Kamera zufliegen, nähert sich Z irgendwann dem Wert 0. Wird der Punkt nicht gekappt, springt der projizierte Y-Wert bei der Division (camY / Z) auf Unendlich, was zu gewaltigen Grafik-Glitches ("Popping") führt. 
**Regel:** Setze immer ein Near-Plane-Limit von mindestens `2.5`:

```javascript
let pZ = z - scrollZ;
if (pZ < 2.5) continue; // Verhindert Division-by-Zero Glitches!
let py = horizon + (camY * fov) / pZ;
```

---

## 7. High-Speed Pre-Rendering & Offscreen Caching (The Blitter Philosophy)

Das browserseitige Zeichnen von Tausenden einzelnen Pixeln pro Frame erzeugt einen massiven API-Flaschenhals. Ein DSE wendet deshalb die **Amiga-Blitter-Philosophie** an:

### 7.1. Das Pre-Compiled Blitting
Alle statischen, rein periodisch verschobenen oder im Vorfeld kalkulierbaren Geometrien (wie Moiré-Interferenzen, scrollende Rasterböden, stationäre Vektornetze) werden **einmalig bei der Initialisierung oder beim Resize** auf separate Offscreen-Canvases gezeichnet. Im 60FPS-Haupt-Renderloop werden diese vorgefertigten Buffer nur noch über extrem schnelle `ctx.drawImage()`-Befehle verschoben und geblittet. Das senkt die CPU-Belastung drastisch.

### 7.2. Native Zeichenbefehle im Cache sind verboten!
Da die Offscreen-Canvases ohnehin auf sehr kleinen retro-konformen Auflösungen liegen (z. B. 256 Pixel Höhe) und anschließend pixelig hochskaliert werden, **erzeugt jeder native Pfad-Aufruf (`ctx.arc()`, `ctx.lineTo()`) an den Diagonalen weichgewaschene Subpixel**. Zeichne stattdessen auch im Offscreen-Cache mit unseren scharfen Bresenham-Routinen (`drawAliasedLine`), um den ungetrübten, stufigen Retro-Pixel-Art-Look auf allen Viewport-Skalierungen zu sichern!

---

## 8. Software-Rasterizer & Direct Memory Access (`ImageData`)

Sollte ein nativer Pfad im Browser unerwünschtes Anti-Aliasing erzwingen oder die Render-API-Wechsel bei der Vorberechnung immer noch zu langsam sein, emuliert das DSE den **Direct Memory Access (DMA)** eines echten Blitters:

### 8.1. Der Image-Data-Weg
Wir erstellen ein rohes Speicherabbild (`ctx.createImageData(w, h)`) und manipulieren die Bresenham-Linien und Midpoint-Kreise direkt als nackte RGB-Bytes in einem `Uint8ClampedArray` im RAM:

```javascript
let imgData = ctx.createImageData(w, h);
let data = imgData.data;
// ... Bresenham schreibt direkt in data[idx] = r; data[idx+1] = g; ...
ctx.putImageData(imgData, 0, 0);
```

Das Umgehen jeglicher Browser-Kontext-Wechsel macht diese Methode um ein Vielfaches schneller als herkömmliche `fillRect`-Pixel-Schleifen und liefert ein absolut randscharfes Pixelbild ohne Weichzeichnung.

---

## 9. Ausfallsichere Horizon- & Division-by-Zero-Schutzschaltungen

Beim dynamischen Verkleinern des Webbrowsers, beim Laden von HMR-Hot-Reload-Caches oder beim Rotieren von Smartphones kann die Breite oder Höhe des Containers im DOM für eine Millisekunde auf `0px` zusammenbrechen.

### 9.1. Die Unendlich-Schleifen-Falle
Fällt die Höhe des Bildschirms auf `0`, wird das Seitenverhältnis (`aspect = width / height`) zu `Infinity` oder `NaN`. Berechnet ein DSE nun seine X-Dichte oder seinen horizontalen Kachelbereich basierend auf diesem Seitenverhältnis, gerät das System in eine unendliche Schleife:
`xRange = Infinity`
`for (x = -Infinity; x <= Infinity; x += 32)`
Da in JavaScript -Infinity + 32 immer noch -Infinity ergibt, wird die Schleife niemals fertig, was den gesamten Browser-Thread sofort einfriert.

### 9.2. Der Failsafe-Schutzschalter
Jedes DSE und der `SceneDJ` müssen an vorderster Front ihrer `render()`-Methode eine unbestechliche Schutzschaltung aufweisen:

```javascript
if (width <= 0 || height <= 0 || !isFinite(width / height)) return;
```

Tritt ein temporärer DOM-Kollaps auf, bricht die CPU das Zeichnen sofort ab, überspringt das Frame und wartet stabil auf den nächsten regulären Bild-Zyklus. Zudem müssen Canvas-Breiten immer mit einer Mindestgröße abgesichert werden (`Math.max(8, targetResX)`).

---

## 10. Diskrete Kinetik & Deterministischer Zufall

Echte Retro-Hardware war mechanisch. Kontinuierlich fließende floating-point Animationen, ununterbrochen pumpende Kreise oder voll-analoge Audio-Dämpfungen zerstören die Demoszene-Ästhetik der 80er Jahre.

### 10.1. "Klick"-Zustandswechsel & Spuren-Verzicht
*   **Rotation:** Feste LUT-Tabellen (z. B. 256 oder 1024 Indizes) nutzen und Winkel-Inkremente unregelmäßig (z. B. nur alle 3 Frames) übernehmen, um das typische ruckelige "Tick-Tick-Tick" der 8- und 16-Bit-Engines zu emulieren.
*   **Kein ständiges Atmen:** Größen oder Radien nicht kontinuierlich zum Takt ändern. Der Beat soll stattdessen sprunghafte, unregelmäßige "Klicks" (Winkel-Inversionen, abrupte Pattern-Swaps, Farbpaletten-Rotationen oder kurzfristige Vertex-Explosionen mit LERP-Bounces) triggern.
*   **Symmetriebruch:** Ein perfekt zentriertes, absolut spiegelgleiches Bild wirkt unnatürlich und steril. Verschiebe die mathematische Mittelachse von Hauptelementen (wie der Boing-Sonne oder dem Torii-Tor) gezielt um 5–8 % nach links oder rechts, um sofort mehr künstlerische Spannung aufzubauen.

### 10.2. Kein `Math.random()` im Render-Loop!
`Math.random()` erzeugt hochfrequentes, unnatürlich "modernes" Rauschen.
*   Nutze einen emulierten **23-Bit LFSR** (Linear-feedback shift register) für echtes C64-Rauschen.
*   Für Sternengeburt oder Partikelsysteme: Generiere Pseudozufall deterministisch aus einem Frame-Counter und einem festen Array.
*   *Ausnahme:* In der einmaligen Initialisierungs-Phase (`ensureInitialized` oder Constructor) ist `Math.random()` erlaubt, um Moiré-Effekte (Marsaglia-Lattice) oder synchrone Start-Phasen (Wasser-Zufalls-Offsets) einmalig auszuwürfeln.

---

## 11. Diagnose- & Teststeuerungen für Entwickler (Debugging-Tools)

Um die Erstellung, Justierung und klangliche Kalibrierung neuer DSE-Komponenten zu vereinfachen, stellt die `DseBuilder`-Schnittstelle in `registry.js` zwei Fluent-Methoden zur Teststeuerung bereit:

### 11.1. Deaktivierung (`.disabled()`)
Fügt der Metadaten-Konfiguration des Elements die Eigenschaft `isDisabled: true` hinzu. 
*   **Laufzeit-Verhalten:** Das Gimmick wird vom `SetlistManager` bei der automatischen Wurf-Auswahl (Roulette) vollständig ignoriert. 
*   **Diag-Hard-Kill:** Sollte das Element im HMR-Betrieb (Hot Module Replacement) oder während des Debuggings im aktiven Render-Pool des `StageManagers` laufen und auf `disabled` geschaltet werden, bricht die Engine das weiche Ausblenden (Crossfade) ab und löscht das Element augenblicklich im aktuellen Frame, um Speicherlecks und Fehler-Hänger zu verhindern.

### 11.2. Exklusiver Testfokus (`.exclusive()`)
Fügt der Metadaten-Konfiguration des Elements die Eigenschaft `isExclusive: true` hinzu.
*   **Laufzeit-Verhalten:** Sobald *mindestens ein* registriertes Gimmick im System exklusiv geschaltet ist, sperrt der `SetlistManager` alle anderen, nicht-exklusiven Wellenformen im `managed` Lifecycle-Pool.
*   **Exklusives Testing-Fade-Out:** Um das isolierte Testen eines Moduls ohne Störeinflüsse anderer Layer zu ermöglichen, zwingt diese Weiche alle anderen aktiven und nicht-exklusiven `managed` Layer sofort in die `stopping`-Phase des `StageManagers`, wo sie innerhalb von 1.5 Sekunden weich ausblenden und dem exklusiven Fokus-Modul Platz machen.

```javascript
// Beispiel für eine isolierte Diagnose-Registrierung in registry.js:
RegisterDSE(MeinNeuesDSE)
    .systems('c64')
    .layer('foreground')
    .weight(10)
    .exclusive() // <--- Sichert den ungestörten, exklusiven Test-Fokus
    // .disabled() // <--- Deaktiviert das Modul temporär für andere Tests
    .build()
```