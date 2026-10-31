# DSE-Entwicklungsregeln

**Geltungsbereich:** neue und überarbeitete Demo Scene Elements (DSEs) in Chiptunes Fantasy

**Ziel:** musikalisch lesbare, historisch plausible und auf jedem unterstützten Display stabile Effekte

**Verbindliche Referenz:** die aktuelle Implementierung, insbesondere `SceneDJ`, `StageManager`, `SetlistManager`, die DSE-Registry und `hardware-constraints.js`

Dieses Dokument ist die verbindliche Implementierungs- und Abnahmerichtlinie für DSEs. Ältere Konzept- und Release-Dokumente beschreiben teilweise historische Entwürfe und haben bei Abweichungen keinen Vorrang.

Die Begriffe **MUSS**, **SOLL** und **DARF** sind normativ gemeint. Nicht jeder Alt-DSE erfüllt bereits jede Regel; bei einer Überarbeitung ist die betreffende Regel mit zu erfüllen.

## 1. Gestaltungsziel

Ein DSE ist kein beliebiger moderner Canvas-Effekt mit Retro-Farben. Er soll wie ein Bestandteil einer Demo des jeweiligen Rechners wirken und gleichzeitig als responsives Element einer heutigen Webanwendung funktionieren.

Drei Ebenen müssen zusammenpassen:

1. **Musik:** Makrozustand und Tension bestimmen das Verhalten; exakte Beats und Kanalpegel bestimmen den unmittelbaren Impuls.
2. **Rechner:** Auflösung, Farben, Rasterung und Bewegungsmuster folgen der jeweiligen Hardwareästhetik.
3. **Abspielgerät:** Derselbe Effekt bleibt in Porträt, Querformat, Fenster, Vollbild und Ultrawide lesbar und vollständig.

Ein DSE MUSS ohne Audioeingabe, mit fehlenden Metriken und bei sehr kleinen oder extremen Viewports kontrolliert funktionieren. Musikreaktion ist eine Verstärkung, keine Voraussetzung für ein fehlerfreies Rendering.

## 2. Architektur und DSE-Vertrag

### 2.1 Zuständigkeiten

- `SceneDJ` koordiniert TrackMonitor, TensionManager, SetlistManager und StageManager.
- `TrackMonitor` liefert Energie, Transienten, Beat-Hüllkurven und exakte Beat-Events.
- `TensionManager` bestimmt den musikalischen Makrozustand.
- `SetlistManager` wählt DSEs anhand ihrer Registry-Metadaten aus.
- `StageManager` verwaltet Instanzen, Zustandsübergänge und das PAL-Tick-Caching.
- Der DSE rendert ausschließlich seine eigene visuelle Ausgabe. Er wählt keine Tracks, verändert keine DJ-Logik und steuert keine anderen DSEs.

### 2.2 Render-Schnittstelle

```javascript
render(ctx, width, height, t, state, stateTime, metrics)
```

- `ctx` ist der 2D-Kontext des niedrig aufgelösten Retro-Buffers, nicht der physische Ausgabe-Canvas.
- `width` und `height` sind die aktuellen Dimensionen dieses Buffers in Retro-Pixeln.
- `t` ist eine fortlaufende Zeit in Sekunden.
- `state` ist der aktuelle DSE-/DJ-Zustand.
- `stateTime` ist die Zeit im aktuellen Übergang. Sie wird nicht zwischen allen musikalischen Zuständen zurückgesetzt.
- `metrics` enthält die vom StageManager aufbereiteten Musik- und Systeminformationen.

Ein optionales `resize(width, height)` darf vorbereitende Arbeit übernehmen. Der DSE MUSS Größenänderungen auch dann korrekt behandeln, wenn seine Geometrie erst im nächsten `render()` angepasst wird. Es darf nicht vorausgesetzt werden, dass vor jedem Größenwechsel eine neue Instanz entsteht.

### 2.3 Eingangs- und Zeitschutz

Jeder DSE MUSS ungültige oder vorübergehend nutzlose Größen behandeln:

```javascript
if (width <= 0 || height <= 0 || !Number.isFinite(width / height)) {
    this.lastT = t;
    return;
}
```

Zusätzlich gilt:

- `dt` aus `t` ableiten und begrenzen, damit Tab-Wechsel oder Pausen keine Simulationssprünge erzeugen.
- Keine Division durch eine möglicherweise null gewordene Breite, Höhe, Distanz oder `minDim`.
- Nur endliche Koordinaten und nichtnegative Rechteckgrößen an Canvas übergeben.
- Beim ersten Frame und nach einer langen Unterbrechung einen definierten kleinen Zeitschritt verwenden.
- Ein `idle`-DSE SOLL keine teure Simulation durchführen und keine sichtbare Ausgabe erzeugen.

### 2.4 PAL-Tick und Caching

Der StageManager cached die Ausgabe pro PAL-Tick sowie nach Zustands- und Systemwechseln. Neue DSE-Bildzustände entstehen daher mit 50 Hz, auch wenn die Anwendung selbst mit einer höheren Bildwiederholrate läuft.

Daraus folgt:

- Bewegung MUSS zeitbasiert und nicht an die Anzahl tatsächlicher `render()`-Aufrufe gekoppelt sein.
- Exakte Beat-Events dürfen nicht als dauerhafter Pegel interpretiert werden, weil ein zwischengespeicherter Frame wiederholt angezeigt werden kann.
- Animationen sollen bewusst auf 50-Hz-Schritte ausgelegt werden; zusätzliche hochfrequente Zwischenframes bringen keinen Vorteil.
- Ein DSE DARF keine externen globalen Cache-Objekte verändern, die einer anderen Instanz oder einem anderen System gehören.

## 3. Musikreaktion

### 3.1 Trennung von Makro- und Mikrodynamik

Die zentrale Regel lautet:

> **Tension bestimmt, was sich wie verhält. Der Beat bestimmt, wann ein Impuls oder Wechsel sichtbar wird.**

Tension und Zustand steuern beispielsweise Geschwindigkeit, Amplitude, Anzahl aktiver Ebenen, Patternfamilie und maximale Intensität. Beats steuern kurze Nudges, Richtungswechsel, Palettenwechsel oder den Wechsel eines Patterns. Kanalpegel steuern einzelne Objekte oder visuelle Ebenen.

Ein DSE SOLL nicht ausschließlich lauter und heller werden. Ein guter Effekt verändert sein Verhalten erkennbar zwischen ruhigem Spiel, Aufbau, Höhepunkt und Nachklang.

### 3.2 Verfügbare Metriken

| Metrik | Bedeutung und vorgesehene Verwendung |
| --- | --- |
| `metrics.energy` | Geglättete Gesamtenergie (`masterEnergy`), geeignet für allgemeine Intensität. Nicht als Beat-Event verwenden. |
| `metrics.pulse` | Transientenimpuls (`transientPulse`), geeignet für kurze lokale Akzente. |
| `metrics.beat[c]` | Abklingende Beat-Hüllkurve pro logischem Band/Kanal, geeignet für kurze Amplituden, Nudges oder Helligkeitsstufen. |
| `metrics.beatStarted` | Exaktes Einmalereignis für einen erkannten Beat. Einzige zentrale Basis für diskrete Pattern-, Paletten- oder Richtungswechsel. |
| `metrics.beatCount` | Fortlaufende Beatnummer, beispielsweise für jeden zweiten oder vierten Beat. |
| `metrics.smooth[c]` | Geglättete Kanalenergie, geeignet für einzelne Balken, Sterne, Flächen oder Parameter einer Ebene. |
| `metrics.rawEnergyState` | Grober energetischer Zustand; nur verwenden, wenn diese Unterscheidung wirklich benötigt wird. |
| `metrics.tensionPct` | Kontinuierliche Tension von 0 bis 1. Für Zielwerte und Verläufe, nicht als alleiniger Beat-Ersatz. |
| `metrics.isClimaxLocked` | Kennzeichnet einen gehaltenen Climax. Nicht jeder DSE muss darauf separat reagieren. |
| `metrics.climaxTimer`, `metrics.climaxHoldTime` | Informationen über Climax-Dauer und Haltezeit. |
| `metrics.system` | `c64`, `amiga` oder `atari`; bestimmt Auflösung, Palette und systemspezifische Gestaltung. |
| `metrics.regs` | Optionale Chip-/Registerinformationen für bewusst systemspezifische Effekte. Vor Verwendung Verfügbarkeit und Semantik prüfen. |

Werte MÜSSEN defensiv gelesen werden. Optionale Arrays und Felder können fehlen; verwende endliche Fallbacks und begrenze Steuerwerte auf einen sinnvollen Bereich.

### 3.3 Exakte Beats statt Hüllkurven-Retrigger

`metrics.beat[0]` bleibt nach einem Beat für mehrere Frames größer als null. Ein Vergleich wie `beat[0] > 0.5` darf deshalb **keinen** einmaligen Patternwechsel auslösen.

Für diskrete Ereignisse gilt:

```javascript
if (metrics.beatStarted) {
    const count = Number.isFinite(metrics.beatCount)
        ? metrics.beatCount
        : this.lastBeatCount + 1;
    this.lastBeatCount = count;

    this.beatDirection = (count & 1) ? 1 : -1;
    if (count > 0 && count % 4 === 0) {
        this.pattern = (this.pattern + 1) % this.patternCount;
        this.palettePhase = (this.palettePhase + 1) % this.paletteCount;
    }
}
```

Regeln:

- Pattern- und Palettenwechsel nur über `beatStarted`.
- Beat-Zähler speichern, statt ein Ereignis in mehreren Frames erneut auszuführen.
- Vier- oder Acht-Beat-Raster für größere Wechsel bevorzugen; nicht jeder Effekt braucht denselben Rhythmus.
- Die Hüllkurve weiterhin für einen weichen oder gestuften Ausschlag verwenden.
- Ein Beat-Test MUSS auch mehrere Frames mit aktiver Hüllkurve, aber ohne neues `beatStarted`, enthalten.

### 3.4 Kanalzuordnung

- Ein Kanal SOLL eine erkennbare, möglichst stabile visuelle Aufgabe erhalten.
- Nicht jeder Effekt braucht alle Kanäle; gezielte Zuordnung ist besser als gleichförmiges Pumpen des ganzen Bildes.
- C64 besitzt drei physische SID-Stimmen. SID-Schreibfrequenz oder Registeraktivität DARF nicht als zusätzliche Audiospur oder Phantomenergie behandelt werden.
- Systemunterschiede in Kanalzahl und Registerinhalt dürfen nicht durch blinden Arrayzugriff zu Fehlern führen.

### 3.5 Verhalten je Makrozustand

| Zustand | Erwartetes Verhalten |
| --- | --- |
| `idle` | Keine sichtbare Ausgabe; keine unnötige Simulation. |
| `starting` | Kurzer, kontrollierter Aufbau über Geometrie, Palettenindex oder Ordered Dither. Kein sofortiger voller Effekt. |
| `playing` | Ruhige Grundbewegung, klare Form, sparsame Beat-Akzente und lesbare Kanalsteuerung. |
| `buildup` | Erhöhte Bewegungsenergie, dichtere oder aktivere Formation, stärkere aber noch nicht maximale Reaktion. Muss von `playing` unterscheidbar sein. |
| `climax` | Maximal vorgesehene Bewegung, Trails, Interferenz oder Sonderformation. Weiterhin deterministisch und bildfüllend, nicht bloß übersteuert. |
| `afterglow` | Deutlich reduzierte Geschwindigkeit und Intensität, kühlere oder dunklere Palette, kontrolliertes Abklingen. Kein abruptes Zurückspringen auf `playing`. |
| `stopping` | Kontrollierte Reduktion bis zur vollständigen Entfernung; keine neuen großen Patternwechsel oder Climax-Effekte. |

`stateTime` wird zwischen `playing`, `buildup`, `climax` und `afterglow` nicht zuverlässig auf null gesetzt. Für zustandslokale Animationen MUSS der DSE einen eigenen Übergangszähler führen:

```javascript
if (this.lastState !== state) {
    this.lastState = state;
    this.stateAge = 0;
} else {
    this.stateAge += dt;
}
```

Der Übergang in `afterglow` SOLL die letzte Formation und Objektpositionen übernehmen. Kein Re-Seed und kein harter Szenenwechsel nur wegen des neuen Makrozustands.

## 4. Historischer Stil und Hardwaregrenzen

### 4.1 Interne Retro-Auflösung

Die vertikale Auflösung wird zentral durch `SYSTEM_RESOLUTIONS` festgelegt:

| System | Interne Höhe | Farbregel |
| --- | ---: | --- |
| C64 | 200 Pixel | Ausschließlich die 16 Farben der VIC-II-/Colodore-Palette |
| Amiga | 256 Pixel | 12-Bit-RGB, 4 Bit pro Kanal |
| Atari ST | 200 Pixel | 9-Bit-RGB, 3 Bit pro Kanal |

Die Breite folgt dem tatsächlichen Seitenverhältnis:

```javascript
const targetResX = Math.max(8, Math.floor(targetResY * (width / height)));
```

Deshalb DARF kein DSE eine feste historische 4:3-Breite als dauerhafte Buffergröße annehmen. Die historische Pixelhöhe bleibt erhalten, während der sichtbare Bereich auf dem modernen Display breiter oder schmaler wird.

Die Ausgabe wird anschließend mit Nearest Neighbor hochskaliert. DSEs MÜSSEN für diesen Retro-Buffer zeichnen und keine hochauflösenden Canvas-Effekte als Ersatz verwenden.

### 4.2 Paletten und Quantisierung

Verbindliche Helfer aus `js/visuals/utils/hardware-constraints.js` verwenden:

- C64: `C64_PALETTE`, `getNearestC64Color(...)`.
- Amiga: `quantizeAmiga12Bit(...)`.
- Atari: `quantizeAtari9Bit(...)`.
- Hex-Ausgabe bei Bedarf: `rgbToHex(...)`.

Regeln:

- Hartcodierte Farbtabellen bereits korrekt quantisiert anlegen.
- Berechnete Farben vor dem Zeichnen quantisieren beziehungsweise auf die C64-Palette abbilden.
- Die Abnahme erfolgt an den tatsächlich gerenderten Pixeln, nicht nur an den Farbangaben im Quelltext.
- Keine Schatten, Browser-Filter, Antialiasing-Kanten oder Textausgabe, die unerlaubte Zwischenfarben erzeugen.
- Nicht versuchen, Paletteverletzungen nachträglich durch eine undokumentierte Ausnahmeregel zu verstecken.

### 4.3 Integer-Raster und Geometrie

Innerhalb von DSEs gilt:

- Ausschließlich opakes Pixel-Rastering.
- Rechtecke mit ganzzahligen Koordinaten und Größen über `fillRect()` zeichnen.
- Linien, Kreise und Polygone mit Bresenham-/Scanline-Verfahren oder den vorhandenen Aliasing-Helfern zeichnen.
- Keine antialiasing-erzeugenden Canvas-Pfade wie `arc()`, beliebige `lineTo()`-Konturen oder weich gezeichnete Strokes.
- Keine Canvas-Schatten, Weichzeichner, Gradienten mit unerlaubten Mischfarben oder Compositing-Tricks.
- Keine CSS-/Canvas-Filter als Ersatz für historische Shading-Tabellen.

Geeignete Helfer sind unter anderem:

- `fillAliasedCircle(...)`
- `drawAliasedCircleOutline(...)`
- `drawAliasedLine(...)`
- `fillAliasedPolygon(...)`

Historische Bewegung entsteht durch diskrete Raster-, Paletten- und Formwechsel, nicht durch moderne weiche Partikeleffekte.

### 4.4 Kein Alpha-Blending

`globalAlpha`, halbtransparente Füllfarben und Alpha-Überblendungen innerhalb eines DSE sind nicht zulässig. Auch `starting`, `stopping`, Trails und Afterglow müssen ohne Alpha-Mischung auskommen.

Geeignete Alternativen:

- Geometrie oder Objektanzahl stufenweise verändern.
- Palettenindizes und Shading-Tabellen reduzieren.
- Raster-/Scanline-Muster einsetzen.
- `applyOrderedDitherFade(...)` für deterministische Ordered-Dither-Übergänge verwenden.
- Trails durch begrenzte, opake Nachzeichnungen oder persistente Palettenstufen erzeugen.

### 4.5 Text und Typografie

Canvas-Text über `fillText()` und Textmessung über `measureText()` erzeugen browser- und plattformabhängige Antialiasing-Ergebnisse und sind in DSEs nicht zulässig.

Für Text gilt:

- Eine feste Bitmap-Schrift verwenden, beispielsweise 5×7 oder 8×8.
- Jedes gesetzte Fontpixel als ganzzahliges opakes Rechteck zeichnen.
- Ganzzahlige Skalierung und ganzzahlige Grundlinien verwenden.
- Zeichenvorrat, Groß-/Kleinschreibung und Fallbacks für nicht unterstützte Zeichen definieren.
- Textbreite aus Glyphbreite, Abstand und Skalierung selbst berechnen.
- Lange Titel deterministisch kürzen oder scrollen; kein unbegrenzter Umbruch und kein Zeichnen außerhalb des sicheren Bereichs.

## 5. Responsive DSEs und Abspielgeräte

### 5.1 Grundprinzip

Responsive bedeutet nicht, eine 4:3-Szene zu croppen oder ausschließlich die Mitte eines Ultrawide-Bildes zu füllen. Der DSE MUSS seine sichtbare Welt, Projektion und sein Layout an den aktuellen Retro-Buffer anpassen.

Alle unterstützten Betriebsarten verwenden denselben DSE-Vertrag:

- Mobile im Hochformat.
- Mobile im Querformat.
- Desktop-Fenster.
- Desktop-Vollbild.
- 16:9-, 16:10- und breitere Displays.
- Ultrawide und künstlich extreme Seitenverhältnisse als Robustheitstest.

Fenster- und Vollbildbetrieb dürfen sich nur durch Größe und Seitenverhältnis unterscheiden, nicht durch eine andere DSE-Implementierung.

### 5.2 Skalierung und sichere Bereiche

- Für Größen, Radien, FOV und 3D-Skalierung `minDim = Math.min(width, height)` verwenden.
- Horizontale und vertikale Verteilung separat an `width` und `height` anpassen.
- Balken, Linien und Schrift nicht allein aus der Bildbreite ableiten; in Porträt und Ultrawide sonst zu dünn oder zu groß werdende Elemente über `minDim` und Seitenverhältnis begrenzen.
- Wichtige Inhalte innerhalb eines definierten sicheren Bereichs halten. Vollflächige Hintergrund- und Bodeneffekte dürfen bis an alle Ränder reichen.
- Mindestgrößen für Text und zentrale Objekte festlegen, ohne bei kleinen Buffern negative oder null große Geometrie zu erzeugen.
- Auf Widescreen den zusätzlichen Raum tatsächlich bespielen; auf Porträt Inhalte neu verteilen statt sie nur horizontal abzuschneiden.

### 5.3 Projektion und Weltgrenzen

Bei perspektivischen Effekten gilt:

- FOV aus der kleineren Dimension ableiten und begrenzen.
- Weltgrenzen aus dem aktuell sichtbaren Projektionsbereich berechnen, nicht aus einer festen initialen Fenstergröße.
- Nahe Ebene und Clipping definieren; keine Division durch null bei Objekten auf oder hinter der Kamera.
- Bei Partikeln und Sternen prüfen, ob der gesamte projizierte Bildbereich mit Objekten versorgt wird.
- Eine symmetrische Anfangsverteilung allein beweist keine korrekte Verteilung nach Rotation oder Recycling.

Bei Rotations- oder Größenwechsel MÜSSEN bereits vorhandene Objekte auf den neuen sichtbaren Bereich abgebildet werden. Es reicht nicht, nur neu erzeugte Objekte mit den neuen Grenzen zu initialisieren.

### 5.4 Rotation und Resize mit derselben Instanz

Ein Wechsel Porträt → Querformat → Porträt ist ein zentraler Anwendungsfall.

Dabei MUSS der DSE:

- dieselbe Instanz und seine Simulationszeit beibehalten,
- Objekte, Tiefe, Patternphase und Beat-/Zustandszähler nicht grundlos zurücksetzen,
- XY-Verteilung und Projektion sofort an das neue Seitenverhältnis anpassen,
- veraltete größenabhängige Caches neu erstellen oder invalidieren,
- weder leere Bildbereiche noch Objektcluster durch veraltete Weltgrenzen erzeugen,
- endlich und fehlerfrei weiterzeichnen.

Ein vollständiger Neuaufbau ist nur zulässig, wenn die visuelle Kontinuität ausdrücklich nicht benötigt wird. Bei Starfields, Partikeln und fortlaufenden Formationen ist er nicht die Standardlösung.

### 5.5 Geräte- und Abnahmematrix

Mindestens folgende reale oder entsprechend emulierte Viewports prüfen:

| Klasse | Beispiel | Besondere Prüfung |
| --- | --- | --- |
| Kleines Mobile-Porträt | 320×568 | Lesbarkeit, keine negativen Größen, keine abgeschnittenen Pflichtinhalte |
| Mobile-Porträt | 390×844 | Vertikale Verteilung und zentrale Skalierung |
| Mobile-Querformat | 844×390 | Geringe Höhe, Text-/Balkendicke, vollständige horizontale Ausnutzung |
| Desktop-Fenster | 1280×720 | Normale Fensterdarstellung und späteres Resize |
| Desktop-Vollbild | 1920×1080 | Vollbild ohne separate Implementierung |
| Ultrawide | 2560×1080 | Keine leeren Seiten, keine Mittelcluster, keine überdehnten Objekte |
| Extremes Seitenverhältnis | etwa 3:1 und 1:3 | Robustheit und endliche Geometrie |

Für jede System-/DSE-Kombination sind mindestens repräsentative Stills in Porträt und Querformat sowie Widescreen erforderlich. Bewegung, Beat-Reaktion und Afterglow müssen zusätzlich als Sequenz beurteilt werden; ein einzelnes Still reicht nicht.

## 6. Registry, Layer und Lifecycle

### 6.1 Registrierung

Jeder DSE wird über `RegisterDSE(...)` mit expliziten Metadaten registriert. Beispiel:

```javascript
RegisterDSE(MyDse)
    .systems('c64', 'amiga', 'atari')
    .layer('foreground')
    .lifecycle('managed')
    .maxInstances(1)
    .weight(10)
    .duration(15.0)
    .climaxHold(10.0)
    .build();
```

Nur unterstützte Builder-Methoden und aktuelle Metadaten verwenden. Historische Felder wie `computerType`, `placementType`, `triggerProbability` oder `minPlayTime` sind nicht Teil des aktuellen Vertrags.

Metadatenbewusst wählen:

- `systems(...)`: nur Systeme eintragen, für die eine echte, geprüfte Darstellung existiert.
- `weight`: relative Auswahlwahrscheinlichkeit, keine Abspieldauer.
- `maxInstances`: bewusst begrenzen; Standard ist eine Instanz.
- `disabled()` nur für absichtlich deaktivierte Inhalte.
- `exclusive()` nur verwenden, wenn der Effekt tatsächlich exklusiv sein muss.
- `isVoid()` nur für den dafür vorgesehenen Void-DSE.

### 6.2 Layer und Z-Reihenfolge

| Layer | Z-Wert | Verwendung |
| --- | ---: | --- |
| `background` | 0 | Himmel, Fernfeld, vollflächiger Hintergrund |
| `floor` | 1 | Boden, Plattform, perspektivische Unterlage |
| `foreground` | 2 | Hauptobjekte und Demoeffekte |
| `overlay` | 3 | Präsentation, Einblendungen und vorderste Bildelemente |

Es gibt keinen separaten `presenter`-Layer. Der TrackPresenter ist ein `overlay`-DSE mit `oneshot`-Lifecycle.

### 6.3 Lifecycles und Dauer

- `managed`: regulärer, vom SetlistManager verwalteter DSE. `duration` ist die früheste Wechselzeit, keine garantierte absolute Lebensdauer.
- `permanent`: dauerhaft aktiver DSE; sparsam und nur für bewusst permanente Ebenen verwenden.
- `oneshot`: zeitlich begrenzter Einmaleffekt. `duration` ist die absolute Lebensdauer vor dem Übergang in `stopping`.

One-Shots MÜSSEN mehrfach startbar sein, ohne alte Trackdaten, Zeitstempel, `_markedForRemoval`-ähnliche interne Zustände oder Rendering-Artefakte unkontrolliert mitzunehmen. Sie dürfen erst nach ihrer definierten Lebensdauer und dem Stopping-Übergang entfernt werden.

## 7. Deterministik und Ressourcenbesitz

### 7.1 Kein unseeded Zufall

`Math.random()` ist im Renderloop nicht zulässig. Auch Recycling und Respawns MÜSSEN reproduzierbar sein.

- Instanzeigener, fest initialisierter PRNG-Seed.
- Gleiche Eingabesequenz erzeugt dieselbe Ausgabe.
- Keine Abhängigkeit von Wall-Clock-Zeit, Objekt-Iteration mit zufälliger Reihenfolge oder global veränderten Zufallszuständen.
- PRNG nach visueller Verteilung auswählen und testen. Ein einfacher LFSR kann bei aufeinanderfolgenden XY-Werten sichtbare Korrelationen erzeugen; Xorshift32 ist ein bewährter einfacher Ersatz, aber ebenfalls zu prüfen.

Determinismus bedeutet nicht mechanische Gleichförmigkeit: Beatcount, Tension, Kanalwerte und zulässige PRNG-Folgen sollen für kontrollierte Variation sorgen.

### 7.2 Instanzeigene Ressourcen

- Arrays, Pools, Paletten, Offscreen-Canvas und ImageData gehören eindeutig einer Instanz oder sind ausdrücklich immutable und gemeinsam nutzbar.
- Mutable Canvas-, ImageData- oder Cache-Objekte nicht zwischen Instanzen oder Systemen teilen.
- Pools mit fester Maximalgröße verwenden; keine unbegrenzt wachsenden Partikel-, Trail- oder History-Listen.
- Wiederverwendbare Objekte im Konstruktor oder bei der Initialisierung anlegen, statt pro Frame große Strukturen neu zu erzeugen.
- Größenabhängige Ressourcen bei Resize gezielt aktualisieren und alte Referenzen freigeben.

### 7.3 Offscreen-Caching

Offscreen-Caching ist sinnvoll für teure statische Inhalte, aber nur mit klarem Besitz und klarer Invalidierung.

- Nach System, Größe und allen das Bild verändernden Parametern unterscheiden.
- Kein Cache-Treffer aus einem anderen Seitenverhältnis oder System.
- Keine null großen Offscreen-Canvas an `drawImage()` übergeben.
- Cache-Inhalt selbst MUSS denselben Aliasing- und Palettenregeln entsprechen.
- Caching darf Musikreaktion und Zustandswechsel nicht einfrieren.

## 8. Performance und Fehlerverhalten

### 8.1 Performance-Budget

Ein DSE läuft zusammen mit Emulation, Audioanalyse und gegebenenfalls weiteren Layern. Deshalb gilt:

- Feste Objekt- und Geometriebudgets pro System definieren.
- Teure Tabellen und Paletten vorberechnen.
- Keine unnötigen Vollbild-Pixelzugriffe pro Frame, wenn Rasterbalken oder kleinere Regionen genügen.
- `getImageData()`/`putImageData()` nur einsetzen, wenn der Algorithmus sie tatsächlich benötigt und die Kosten kontrolliert sind.
- Keine wachsenden Allokationen, Listener, Timer oder Offscreen-Ressourcen im Renderloop.
- Systemabhängige Qualität reduzieren, bevor die Anwendung insgesamt instabil wird; dabei Palette und Determinismus beibehalten.

Die Abnahme erfolgt anhand gemessener Frame-Profile, nicht nur anhand subjektiver Flüssigkeit auf dem Entwicklungsrechner.

### 8.2 Kontrollierte Degradierung

Fehlende Musikdaten, ein Systemwechsel oder ungültige Zwischenwerte dürfen nicht zu einer Exception führen.

- Sichere Defaults für Energie, Beat, Tension und Kanalwerte.
- Keine stillschweigend falsche Systempalette als Fallback.
- Fehler nicht durch dauerhaftes Leerzeichnen verstecken.
- Nach `starting`, `stopping`, Rotation, Trackwechsel und One-Shot-Neustart muss die Instanz wieder einen definierten Zustand erreichen.
- Keine globalen Manager-, Audio- oder UI-Zustände aus dem DSE verändern.

## 9. Tests und visuelle Abnahme

### 9.1 Automatisierte Mindesttests

Für einen neuen oder wesentlich veränderten DSE sind mindestens erforderlich:

1. **Smoke:** alle unterstützten Systeme und Zustände rendern ohne Exception.
2. **Numerik:** endliche Koordinaten, positive beziehungsweise nichtnegative Rechteckgrößen, keine Division durch null.
3. **Deterministik:** zwei gleiche Eingabesequenzen liefern über mehrere hundert Frames identische Ausgabe beziehungsweise Operationen.
4. **Beat:** exakte Wechsel nur bei `beatStarted`; aktive Hüllkurve ohne neues Event retriggert nichts.
5. **Beat an/aus:** ein isolierter Beat-Eingang erzeugt die vorgesehene Änderung; ohne Beat bleibt das diskrete Pattern stabil.
6. **Zustände:** `starting → playing → buildup → climax → afterglow → stopping` mit derselben Instanz.
7. **Rotation:** Porträt → Querformat → Porträt mit derselben Instanz und ohne leere Bereiche, Cluster oder Ressourcenfehler.
8. **Palette:** tatsächliche Ausgabepixel erfüllen C64-/Amiga-/Atari-Grenzen.
9. **Viewport:** kleine, hohe, breite und extreme Seitenverhältnisse.
10. **Lifecycle:** Auswahl, Dauer, Stopping und Entfernung entsprechen den Registry-Metadaten; One-Shots zusätzlich erneut starten.

Ein Fake-Canvas für Unit-Tests SOLL absichtlich keine verbotenen Funktionen wie `fillText()` oder `measureText()` anbieten. Dadurch fallen verbotene APIs sofort auf.

### 9.2 Visuelle Nachweise

Stills und Bewegungsclips sollen über den vorhandenen DSE-Baseline-Harness beziehungsweise eine gleichwertige deterministische Umgebung erzeugt werden.

Erforderliche Sichtprüfung:

- Zustandsübersicht einschließlich `afterglow`.
- Porträt- und Querformatübersicht.
- Widescreen und mindestens ein Extremverhältnis.
- Rotationsfilmstrip mit derselben Instanz.
- Kurze Motion-Clips für `playing`, `buildup`, `climax` und `afterglow`.
- Bei räumlicher Verteilung ein Coverage-Grid oder eine gleichwertige Messung, nicht nur ein subjektiver Eindruck.

Kontaktübersichten helfen bei der Abnahme, ersetzen aber nicht die automatischen Fehler-, Paletten-, Determinismus- und Performanceprüfungen.

### 9.3 Reale Anwendung

Der isolierte Harness prüft nicht automatisch das Zusammenspiel mehrerer Layer. Vor Abschluss eines wesentlichen DSE ist deshalb zusätzlich die reale App zu prüfen:

- Demo-/DSE-Modus tatsächlich aktivieren.
- Trackstart und Presenter-Verhalten beobachten.
- Fenster vergrößern und verkleinern.
- Vollbild betreten und verlassen.
- Mobile Ausrichtung wechseln.
- Trackwechsel und One-Shot-Neustart prüfen, sofern relevant.
- Browserkonsole auf Fehler und neue Warnungen prüfen.

## 10. Empfohlener Implementierungsablauf

1. **Zweck festlegen:** Layer, Lifecycle, Systeme und musikalische Aufgabe des DSE definieren.
2. **Registry anlegen:** nur aktuelle Metadaten verwenden und Auswahlverhalten festlegen.
3. **Statische Grundform bauen:** Retro-Auflösung, Palette und Aliasing-Regeln zuerst erfüllen.
4. **Responsiveness einbauen:** Projektion, Weltgrenzen, Mindestgrößen und sichere Bereiche von Anfang an berücksichtigen.
5. **Makrozustände ergänzen:** `playing`, `buildup`, `climax` und `afterglow` sichtbar unterscheiden.
6. **Mikrodynamik ergänzen:** exakte Beat-Events, Hüllkurven und ausgewählte Kanalpegel zuordnen.
7. **Ressourcen sichern:** feste Pools, instanzeigene Caches, Seeds und Resize-Invalidierung.
8. **Automatisiert testen:** Numerik, Deterministik, Beat, Zustände, Rotation, Palette und Lifecycle.
9. **Visuell abnehmen:** Stills, Motion, Kontaktübersichten, Widescreen und reale App.
10. **Liefern:** nur neue oder geänderte Dateien paketieren und eine passende Conventional-Commit-Nachricht angeben.

## 11. Definition of Done

Ein neuer DSE ist erst abnahmebereit, wenn alle zutreffenden Punkte erfüllt sind:

### Musik

- [ ] Tension steuert Verhalten, nicht nur Helligkeit.
- [ ] `playing`, `buildup`, `climax` und `afterglow` sind unterscheidbar.
- [ ] Diskrete Wechsel verwenden ausschließlich `beatStarted`/`beatCount`.
- [ ] Kanalpegel haben eine nachvollziehbare visuelle Aufgabe.
- [ ] Fehlende Metriken führen zu sicheren Fallbacks.

### Retro-Stil

- [ ] Die zentrale Systemauflösung und dynamische Bufferbreite werden verwendet.
- [ ] Alle Ausgabepixel entsprechen der Systempalette.
- [ ] Kein Alpha-Blending, Antialiasing, Canvas-Text oder unerlaubter Browser-Filter.
- [ ] Geometrie und Typografie liegen auf einem ganzzahligen Retro-Raster.
- [ ] Fades und Trails verwenden Paletten-, Raster- oder Ordered-Dither-Verfahren.

### Geräte und Kontinuität

- [ ] Mobile Hoch- und Querformat sind geprüft.
- [ ] Desktop-Fenster, Vollbild und Widescreen sind geprüft.
- [ ] Extreme Seitenverhältnisse erzeugen keine Fehler oder unbrauchbare Geometrie.
- [ ] Rotation und Resize behalten dieselbe Instanz und sinnvolle Objektzustände.
- [ ] Keine leeren Bildregionen oder Cluster durch veraltete Projektionsgrenzen.

### Technik und Abnahme

- [ ] Registry, Layer, Lifecycle, Dauer und Instanzgrenze sind korrekt.
- [ ] Verhalten ist deterministisch; kein `Math.random()` im Renderloop.
- [ ] Ressourcen und mutable Caches haben eindeutigen Besitz.
- [ ] Objekt- und Speicherbudgets bleiben begrenzt.
- [ ] Automatisierte Smoke-, Numerik-, Beat-, Zustands-, Rotations-, Paletten- und Determinismusprüfungen bestehen.
- [ ] Stills, Motion-Clips und relevante reale App-Abläufe wurden sichtbar geprüft.
- [ ] Browserkonsole zeigt keine neuen DSE-bedingten Fehler oder Warnungen.

## 12. Maßgebliche Code-Referenzen

Bei Detailfragen haben die aktuellen Implementierungen Vorrang vor älteren Konzepttexten:

- `js/visuals/scene-dj.js` — Signalfluss und Retro-Canvas-Ausgabe
- `js/visuals/dj/stage-manager.js` — Instanzen, Metriken, Zustände und PAL-Tick-Caching
- `js/visuals/dj/setlist-manager.js` — Auswahl, Layerfüllung und Dauer
- `js/visuals/dj/track-monitor.js` — Energie, Hüllkurven und Beat-Events
- `js/visuals/dj/tension-manager.js` — Tension und Makrozustände
- `js/visuals/dse/registry.js` — Registry-Builder und gültige Metadaten
- `js/visuals/utils/hardware-constraints.js` — Auflösungen, Paletten, Quantisierung und Aliasing-Helfer
- `js/visuals/dse/universal/starfield.js` — responsive Projektion, Recycling und Rotationskontinuität
- `js/visuals/dse/universal/copperbars.js` — exakte Beatwechsel, Formationen und Afterglow
- `js/visuals/dse/universal/track-presenter.js` — Bitmap-Typografie und One-Shot-Overlay
- `tools/dse-baseline/harness.js` — deterministische isolierte DSE-Prüfung
