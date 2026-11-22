================================================================================
FILE 1: DSE-Entwicklungsregeln.md
================================================================================

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
- `TrackMonitor` liefert Energie, Transienten, Beat-Hüllkurven, graduelle Beat-Stärken und exakte Beat-Events.
- `TensionManager` bestimmt den musikalischen Makrozustand.
- `SetlistManager` wählt DSEs anhand ihrer Registry-Metadaten aus.
- `StageManager` verwaltet Instanzen, Zustandsübergänge, das PAL-Tick-Caching und das kompatible Routing der graduellen Beat-Metriken.
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

Ein optionales `resize(width, height)` darf vorbereitende Arbeit übernehmen. `SceneDJ.resize(...)` übergibt dabei Retro-Buffer-Dimensionen (bei systemexklusiven DSEs die des jeweiligen Zielsystems, bei universellen DSEs die des aktuell aktiven Systems). Der DSE MUSS Größenänderungen auch dann korrekt behandeln, wenn sich System oder Größe erst im nächsten `render()` ändern. Es darf nicht vorausgesetzt werden, dass vor jedem Größenwechsel eine neue Instanz entsteht.

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

Der StageManager cached die Ausgabe pro PAL-Tick sowie nach Zustands-, Größen- und Systemwechseln (und nach expliziter Cache-Invalidierung bzw. `starting`-Neustarts). Neue DSE-Bildzustände entstehen daher regulär mit 50 Hz, auch wenn die Anwendung selbst mit 60, 120 oder 144 Hz läuft. Fällt ein `beatStarted`-Ereignis auf einen gecachten PAL-Frame, puffert der `StageManager` das Ereignis samt Peak-Werten pro DSE-Cache und liefert es beim nächsten gerenderten PAL-Tick exakt einmal nach. Für `idle`-DSEs überspringt der `StageManager` Simulation, Offscreen-Buffer-Allokation und Blitting vollständig.

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

Ebenso DARF sich kein DSE für Grundbewegung oder sichtbare Variation ausschließlich auf `beatStarted` verlassen: Auch bei ruhigen oder perkussionslosen Tracks ohne erkannte Beats MUSS der Effekt über `t`, `energy` und `smooth[c]` lebendig bleiben.

### 3.2 Verfügbare Metriken

| Metrik | Bedeutung und vorgesehene Verwendung |
| --- | --- |
| `metrics.energy` | Geglättete Gesamtenergie (`masterEnergy`), geeignet für allgemeine Intensität. Nicht als Beat-Event verwenden. |
| `metrics.pulse` | Transientenimpuls (`transientPulse`), geeignet für kurze lokale Akzente. |
| `metrics.beat[c]` | Abklingende Beat-Hüllkurve pro logischem Band/Kanal, geeignet für kurze Amplituden, Nudges oder Helligkeitsstufen. |
| `metrics.beatStrength` | Stärke des letzten akzeptierten Beats von 0 bis 1. Bleibt während dessen Abklingens erhalten und wird erst beim nächsten akzeptierten Beat ersetzt. |
| `metrics.beatLevel` | Diskrete Einordnung der letzten Beat-Stärke: `0` = kein Beat, `1` = soft, `2` = medium, `3` = hard. |
| `metrics.beatImpulse[0]` | Stärkegewichteter Beat-Ausschlag: `beat[0] × beatStrength`. Bevorzugte Metrik für kontinuierliche sichtbare Reaktionen. |
| `metrics.beatStarted` | Exaktes Einmalereignis für einen erkannten Beat. Einzige zentrale Basis für diskrete Pattern-, Paletten- oder Richtungswechsel. |
| `metrics.beatCount` | Fortlaufende Beatnummer, beispielsweise für jeden zweiten oder vierten Beat. |
| `metrics.smooth[c]` | Geglättete Kanalenergie, geeignet für einzelne Balken, Sterne, Flächen oder Parameter einer Ebene. |
| `metrics.rawEnergyState` | Grober energetischer Zustand; nur verwenden, wenn diese Unterscheidung wirklich benötigt wird. |
| `metrics.tensionPct` | Kontinuierliche Tension von 0 bis 1. Für Zielwerte und Verläufe, nicht als alleiniger Beat-Ersatz. |
| `metrics.isClimaxLocked` | Kennzeichnet einen gehaltenen Climax. Nicht jeder DSE muss darauf separat reagieren. |
| `metrics.climaxTimer`, `metrics.climaxHoldTime` | Informationen über Climax-Laufzeit und Gesamthaltezeit. `climaxHoldTime` stammt von aktiven sichtbaren `managed`-DSEs (ohne `isVoid`/`oneshot`) und wird vom `TensionManager` 50/50 auf `climax` (`climaxTimer` bis `0.5 × climaxHoldTime`) und `afterglow` aufgeteilt. |
| `metrics.system` | `c64`, `amiga` oder `atari`; bestimmt Auflösung, Palette und systemspezifische Gestaltung. |
| `metrics.regs` | Optionale Chip-/Registerinformationen für bewusst systemspezifische Effekte. Vor Verwendung Verfügbarkeit und Semantik prüfen. |

Werte MÜSSEN defensiv gelesen werden. Optionale Arrays und Felder können fehlen; verwende endliche Fallbacks und begrenze Steuerwerte auf einen sinnvollen Bereich.

Der TrackMonitor bündelt Hardware- und analoge Beat-Kandidaten desselben Schlags per `Math.max(...)`, nicht durch Addition. Beide Quellen durchlaufen denselben Cooldown und erzeugen gemeinsam höchstens ein Beat-Event. Ein akzeptierter Beat erhält mindestens die Stärke `0.15`; die zentrale Levelzuordnung erfolgt ausschließlich über `getBeatLevel(...)`:

| Level | Stärke |
| --- | --- |
| `NONE` (`0`) | `0` |
| `SOFT` (`1`) | größer als `0` und kleiner als `1/3` |
| `MEDIUM` (`2`) | mindestens `1/3` und kleiner als `2/3` |
| `HARD` (`3`) | mindestens `2/3` |

Der kontinuierliche Ausschlag wird zentral berechnet:

```javascript
beatImpulse[0] = beatEnvelope[0] * beatStrength;
```

Beim akzeptierten Beat ist die Hüllkurve `1`, daher entspricht der Anfangsimpuls genau `beatStrength`. Während des Abklingens bleiben Stärke und Level erhalten, während `beatImpulse` mit der Hüllkurve abnimmt.

`TrackMonitor`, `TensionManager`, `StageManager` und `SetlistManager` begrenzen `dt` defensiv (maximal `0.1 s`, keine negativen/`NaN`-Zeitschritte); `TrackMonitor` nutzt exponentielle Glättung und begrenzt Kanalpegel auf `[0, 1]`. Der `StageManager` begrenzt eingehende Beat-Werte auf ihren gültigen Bereich, interpretiert fehlende `beatStrength` bei vorhandenem Beat als Vollschlag und stellt über wiederverwendete `Float32Array(1)`-Puffer kompatible Fallback- und Nachlieferungs-Werte bereit, ohne neue Arrays im Renderloop zu erzeugen.

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
- Kontinuierliche stärkeabhängige Ausschläge über `beatImpulse[0]` berechnen, nicht über erneute lokale Schwellen an `beat[0]`.
- `beatLevel` darf zusammen mit `beatStarted` eine soft-, medium- oder hard-Variante auswählen. Der während des Abklingens erhaltene Levelwert allein ist kein neues Ereignis.
- `beatStrength` beschreibt die Impulsgröße, nicht die Dauerlautstärke und nicht die Tension.
- Ein Beat-Test MUSS auch mehrere Frames mit aktiver Hüllkurve, aber ohne neues `beatStarted`, enthalten.
- **Strobe-Schutz:** Wegen des Beat-Cooldowns von `0.15 s` sind bis zu ~6,7 Beats/s möglich. Vollflächige Hochkontrast-Blitze (z. B. Weiß/Schwarz-Wipes im Beat-Takt) sind im Webkontext nicht zulässig; Beat-Akzente SOLLEN lokal begrenzt oder über abgestufte Paletten-/Formwechsel umgesetzt werden.

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

Der `StageManager` rendert jeden aktiven DSE in einen eigenen, vor jedem gerenderten Frame per `clearRect(0, 0, width, height)` geleerten Offscreen-Buffer und blittet die sichtbaren Layer anschließend übereinander. Die reguläre Übergangsdauer für `starting` und `stopping` beträgt gemäß `StageManager` (`TRANSITION_TIME`) **`1.5 s`** für `managed`-DSEs (und **`1.0 s`** für `oneshot`-DSEs). Ein DSE SOLL seine Ein- und Ausblendkonstanten exakt auf diese Zeiten auslegen, damit Übergänge nahtlos und ohne abruptes Abschneiden am Ende von `stopping` abschließen.

```javascript
if (this.lastState !== state) {
    this.lastState = state;
    this.stateAge = 0;
} else {
    this.stateAge += dt;
}
```

Der Übergang in `afterglow` SOLL die letzte Formation und Objektpositionen übernehmen. Kein Re-Seed und kein harter Szenenwechsel nur wegen des neuen Makrozustands.

### 3.6 Universelle DSEs: finaler Umsetzungsstand

| DSE | Kontinuierliche Reaktion auf `beatImpulse[0]` | Diskrete Ereignisse und Sonderregeln |
| --- | --- | --- |
| `Starfield` | Gewichteter Warp-Schub; C64-Rasterwobble, Amiga-Nebel-/Helligkeitsakzente und ganzzahliger Atari-Größenkick | Pattern und Paletten nur bei `beatStarted`/`beatCount` |
| `Copperbars` | Vertikaler Nudge, Climax-Interferenz und abgestufter Core-Punch | Formationen und Copperlists nur am exakten vierten Beat |
| `TrackPresenter` | Systemgerechte Panel-Bewegung; zusätzlicher horizontaler Bitmap-Titel-Nudge im Climax | Layoutwechsel nur am exakten vierten Beat; One-Shot-Verhalten bleibt unverändert |
| `LimitBar` | C64-Rasterstärke, Amiga-Sweep-Größe sowie Atari-Funkenanzahl und -länge; Impulssteuerung des Climax-Strobes | Bleibt über `.disabled()` deaktiviert und wird nur isoliert getestet |
| `VoidElement` | Absichtlich keine; der Platzhalter liest keine Musikmetriken und zeichnet nichts | Alle drei Registry-Einträge bleiben `isVoid()` |

Alle sichtbaren universellen DSEs verwenden bei fehlendem `beatImpulse` weiterhin die begrenzte `beat[0]`-Hüllkurve als Fallback. Eine abklingende Hüllkurve oder ein erhaltener `beatLevel` darf bei ihnen keine Pattern-, Paletten-, Formations-, Richtungs- oder Layoutwechsel erneut auslösen.

### 3.7 Systemspezifische DSEs: Umsetzungsstand (v1.6.0)

| System | DSE | Reaktion auf `beatImpulse[0]`, Makrozustand & Kanäle | Besonderheiten & Nachweise |
| --- | --- | --- | --- |
| Amiga | `KefrensCheckerboard` | Copper-Kurven, Z-Schockwellen, `camH`-Dip und 4 Paletten/Pattern-Familien | Floor ab `horizon = 0.55 * height`; 12-Bit LUT; Bayer-Floor-Curtain (`test/kefrens-checkerboard.test.mjs`) |
| Amiga | `PaulaSiliconBg` | 4 L-R-R-L DMA-Säulen, 3D-Busspuren, Z-Welle, Oktant-Moiré und Copper-Himmel | DOM-frei ohne Offscreen-Canvas/Global-Cache (`test/paula-silicon-bg.test.mjs`) |
| Amiga | `AmigaRetroSunset` | Sonnenpuls, Berg-Rimlight, Wasser-Shimmer, Climax-Slits; 16./24.-Beat-Fisch/Möwen | Kachelnde Berge, 2 Wolken, Xorshift32, Blue-Hour-Afterglow (`test/retro-sunset.test.mjs`) |
| Amiga | `AmigaCastleFireworks` | Gestufte OCS-Nachtpalette, Copper-Raster, Burg & Feuerwerk nach Tension/Beat | Burst-Zündung nur auf dedupliziertem `beatStarted` (`test/amiga-castle-fireworks.test.mjs`) |
| C64 | `ChunkyPlasma` | 4 VIC-II-Ramps, 4 Plasmafamilien, Zoom-Bounce, PETSCII-Subblock-Dither (`smooth[0..2]`) | Wiederverwendbare Zeilenpuffer, Bayer-Night-Afterglow (`test/chunky-plasma.test.mjs`) |
| C64 | `C64RetroSunset` | Sonnenradius, Kegelbreite, Glanztiefe, Sky-Dither-Säume, 1px-Heat-Haze (`smooth[0..2]`) | Rein zeitbasiert ohne `frameCounter`, Xorshift32 `$D016`-Wasser (`test/c64-retro-sunset.test.mjs`) |
| C64 | `SidSiliconBg` | 3 SID-Oszillatoren + VCF-Kamm, Bus-Elektronen nach `beatLevel`, ADSR-Schutz | Adaptives Landscape-/Portrait-Layout, Fallback ohne `regs` (`test/sid-silicon-bg.test.mjs`) |
| C64 | `C64VectorStar` | FOV-/Spitzen-Kick, 4 Raster-Paletten, 4 Modi inkl. 2-Step-Ghost-Trails (`smooth[0..2]`) | `0.06s`-6510-Stutter auf `dt`, geclippt, geometrisches Starting/Stopping (`test/c64-vector-star.test.mjs`) |
| C64 | `C64CastleFireworks` | VIC-II-Nachtszene mit Burg, Vordergrund & Beat-Feuerwerk | Bursts nur auf `beatStarted` (`test/c64-castle-fireworks.test.mjs`) |
| Atari | `AtariDotTorus` | Scale-Kick, 4 Shifter-Paletten, 4 Morph-Modi, 1×1/2×2-Tiefenpass (`smooth[0..2]`) | Symmetrische 3-Achsen-Float-Phasen für 50 Hz PAL (`test/atari-dot-torus.test.mjs`) |
| Atari | `AtariBobs` | Radius-/Warp-Schub, Ketten-Highlight-Welle, 3D-Bob-Größe (`smooth[0..2]`) | DOM-freie Scanline-Kreis-LUT, symmetrische 4-Quadranten-Spiegelung (`test/atari-bobs.test.mjs`) |
| Atari | `AtariRetroSunset` | Sonnenpuls, Wasserwelle, Torii-Kanji, Bonsai-Rascheln & fallende Blütenblätter | DOM-frei, geclippte Kurven-Bonsai-Äste, Zen-Afterglow (`test/atari-retro-sunset.test.mjs`) |
| Atari | `WireframeMorph` | Morph-Schub, 4 Themes, 2-Pass-Z-Depth, Ghost-Trails & Dual-Shell-Kern (`smooth[0..2]`) | Kalibriertes FOV + geclippte Bresenham-Kanten (`test/atari-wireframe-morph.test.mjs`) |
| Atari | `YmSiliconBg` | 3 Rechteck-Oszillatoren, Log-DAC-Schockwelle, LFSR-Regen & Timer-B-Scanline-Tears | Ohne `getImageData`/`putImageData` & ohne Weiß-Wipe, Dual-Layout (`test/ym-silicon-bg.test.mjs`) |
| Atari | `AtariEnchantedCastle` | 9-Bit-Shifter-Sturmszene mit Burg & gradierten Blitz-/Magie-Effekten | Maximal 16 Farben, begrenzte Pools (`test/atari-enchanted-castle.test.mjs`) |
| Atari | `AtariLaserGrid` | Perspektivisches Z-Gitter ab `horizon`, 3 YM-Lanes per Scanline-Dither, Climax-Sweeps, 4er-Pulse-Pool | ≤ 6 Farben/Scanline, Timer-B-Raster-Wipe am 4. Beat (`test/atari-laser-grid.test.mjs`) |
| Atari | `AtariPondRipples` | 3 YM-Wellenquellen, Tiefendither, 12er-Ripple-/Sprüh-Pools, 24 Glitzer, Doppelringe auf Hard-Beats | Midpoint-Ellipsen-Run-Merging (`drawAliasedEllipseOutlineClipped`), `atari-kit.js` (`test/atari-pond-ripples.test.mjs`) |
| Atari | `AtariMetaBlobs` | 3 YM-Stimmenbälle + 4 Satelliten mit Hysterese, 4 Bahnformen, `beatImpulse`-Atmung, Climax-`WHITE`-Kern | ≤ 5000 Chunky-Zellen mit Run-Merging, ≤ 14 Farben/Scanline (`test/atari-meta-blobs.test.mjs`) |
| Atari | `AtariJuliaCycler` | 4 Julia-Familien (`c0`-Morph), 3 Radialzonen (A/B/C), `RING_HUE`-Zyklus ≤ 6 Schritte/s | ≤ 6000 Zellen, Run-Merging, Konturband-Highlight bei Hard-Beat (`test/atari-julia-cycler.test.mjs`) |
| Atari | `AtariLineRibbons` | 3 Vektorbänder (Pool 6, 5 im Climax), 8er-History-Ringpuffer, 3 Link-Modi, Doppelkopf | Proportionales Resize inkl. History, `INK` (+1,+1)-Kontrast, geometrisches Fade (`test/atari-line-ribbons.test.mjs`) |
| Atari | `AtariFlatShadedTrio` | 6 normierte Polyeder, Lambert-Flat-Shading pro Stimme, Explosion, 4.-Beat-Geometriewechsel | Perspektiv-Backface-Culling, Painter-Sort, deduplizierter `INK`-Kantenpass (`test/atari-flat-shaded-trio.test.mjs`) |

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

### 4.2 Paletten, Farbbudgets und Raster-Techniken

Verbindliche Helfer aus `js/visuals/utils/hardware-constraints.js` verwenden:

- C64: `C64_PALETTE`, `getNearestC64Color(...)`.
- Amiga: `quantizeAmiga12Bit(...)`.
- Atari: `quantizeAtari9Bit(...)`.
- Hex-Ausgabe bei Bedarf: `rgbToHex(...)`.

Regeln:

- Hartcodierte Farbtabellen bereits korrekt quantisiert anlegen.
- Berechnete Farben vor dem Zeichnen quantisieren beziehungsweise auf die C64-Palette abbilden.
- Die Abnahme erfolgt an den tatsächlich gerenderten Pixeln, nicht nur an den Farbangaben im Quelltext.
- Neben dem Farbraum ist auch die historische Chip-Ästhetik (inkl. Raster-Interrupts und Copperlists zur Farbvermehrung) systemgerecht zu achten:
  - **C64 (VIC-II):** Ausschließlich die 16 festen Colodore-Farben (keine Interlace-/25-Hz-IFLI-Flickermodi wegen Strobe-Schutz). Um nicht wie eine beliebige 16-Farben-Pixelmap zu wirken, SOLLEN C64-DSEs nach Möglichkeit erkennbar die historische Rasterlogik widerspiegeln: **Hires** (1×1-Pixel mit lokaler 2-Farben-Disziplin für Vektoren/Schrift/Sprites), **Multicolor** (2×1-„Fat-Pixels“ für flächige Grafik) sowie **Raster-Splits / FLI** (`$D020`/`$D021`-Scanline-Rasterbars, 4×1-/8×1-Streifen und Sprite-Multiplexing). Für Dithering auf modernen OLEDs SOLLEN abgestufte Helligkeits-Ramps statt harter komplementärer 1×1-Checkerboards verwendet werden.
  - **Amiga (OCS/ECS):** Bewusste Subpalette im Standard-Bitplane-Betrieb (**16–32 Farben**, 4–5 Bitplanes) zzgl. **Copper-Zeilenwechseln**. Ausdrücklich zulässig sind zudem historische OCS-Erweiterungen: **EHB** (Extra Half-Brite: 64 Farben pro Scanline aus 32 Basis- und 32 halbhellen Farben), **HAM6** (alle 4096 Farben bei Beachtung der 1-Kanal-Modify-Regel / des charakteristischen HAM-Fringing) sowie **Mid-Scanline Copper / Copper-Chunky** (horizontale Registerwechsel im 8px- bzw. 4px-Preload-Raster).
  - **Atari ST (ST/STFM, 9-Bit Shifter – kein 12-Bit-STe):** Pro eigenständigem DSE-Layer gilt ein Budget von **maximal 16 Farben pro Scanline** (4 Bitplanes). Vertikal darf die Palette durch simulierte **Timer-B-Raster-Splits** beliebig über den Frame erweitert werden; als spezielle Demo-Technik ist auch ein **Spectrum-512-Modus** (bis zu 3 horizontale 16-Farben-Palettenwechsel pro Scanline = max. 48 Farben pro Zeile) zulässig. Da kombinierte Web-Layer (`background`, `floor`, `foreground`, `overlay`) technisch eigene Paletten auf derselben Zeile überlagern können, wird das 16-Farben-Scanline-Budget verbindlich pro Layer geprüft.
- Keine Schatten, Browser-Filter, Antialiasing-Kanten oder Textausgabe, die unerlaubte Zwischenfarben erzeugen.
- Nicht versuchen, Paletteverletzungen nachträglich durch eine undokumentierte Ausnahmeregel zu verstecken.
- Bei Atari ST beträgt der maximale quantisierte Kanalwert der Projektkonvention `252` (`7 × 36`, `#fcfcfc`) und nicht `255` (`#ffffff`). Auch Weiß-Highlights MÜSSEN über `quantizeAtari9Bit(...)` erzeugt werden.

### 4.3 Integer-Raster und Geometrie

Innerhalb von DSEs gilt:

- Ausschließlich opakes Pixel-Rastering.
- Rechtecke mit ganzzahligen Koordinaten und Größen über `fillRect()` zeichnen.
- Linien, Kreise und Polygone mit Bresenham-/Scanline-Verfahren oder den vorhandenen Aliasing-Helfern zeichnen.
- Keine antialiasing-erzeugenden Canvas-Pfade wie `arc()`, beliebige `lineTo()`-Konturen oder weich gezeichnete Strokes.
- Keine Canvas-Schatten, Weichzeichner, Gradienten mit unerlaubten Mischfarben oder Compositing-Tricks.
- Keine CSS-/Canvas-Filter als Ersatz für historische Shading-Tabellen.

Geeignete Helfer in `js/visuals/utils/hardware-constraints.js` sind unter anderem:

- `fillAliasedCircle(ctx, xc, yc, r, color, clipRect?)` / `fillAliasedCircleClipped(...)` (symmetrische Midpoint-Spans passend zu `drawAliasedCircleOutline`)
- `drawAliasedCircleOutline(ctx, xc, yc, r, color, clipRect?)` / `drawAliasedCircleOutlineClipped(...)`
- `drawAliasedLine(...)` / `drawAliasedLineClipped(ctx, x0, y0, x1, y1, color, clipRect)`
- `fillAliasedPolygon(...)` / `fillAliasedPolygonClipped(ctx, points, color, transparentDither, clipRect)`
- `drawAliasedEllipseOutlineClipped(ctx, xc, yc, rx, ry, color, clipRect)` (Midpoint-Ellipse mit Span-Run-Merging)

Historische Bewegung entsteht durch diskrete Raster-, Paletten- und Formwechsel, nicht durch moderne weiche Partikeleffekte.
Die klassischen Basishelfer ohne `*Clipped`-Suffix clippen Koordinaten standardmäßig nicht auf den Retro-Buffer (sofern kein optionales `clipRect` übergeben wird). Jeder DSE MUSS entweder die `*Clipped`-Varianten bzw. ein explizites `clipRect` nutzen oder sicherstellen, dass Linien, Kreise und Sprites am Bildrand hart auf `[0..width, 0..height]` (bzw. auf layer-spezifische Grenzen wie `y >= horizon` bei `floor`-DSEs) beschnitten werden und keine negativen Koordinaten oder Überläufe an `fillRect()` übergeben.

### 4.4 Kein Alpha-Blending

`globalAlpha`, halbtransparente Füllfarben und Alpha-Überblendungen innerhalb eines DSE sind nicht zulässig. Auch `starting`, `stopping`, Trails und Afterglow müssen ohne Alpha-Mischung auskommen.

Geeignete Alternativen:

- Geometrie oder Objektanzahl stufenweise verändern.
- Palettenindizes und Shading-Tabellen reduzieren.
- **Bitplane-Index-Addition / Shade-Bobs:** Scheinbare Transparenz und Glenz-/Überlagerungseffekte durch Erhöhen des Farbindex innerhalb definierter Paletten-Ramps (oder Zeichnen in separate Bitplane-Ebenen) statt Alpha-Mischung realisieren.
- Raster-/Scanline-Muster einsetzen (`transparentDither` in `fillAliasedPolygonClipped` auf großen Ultrawide-Polygonen wegen der vielen 1×1-`fillRect`-Aufrufe sparsam nutzen oder durch Shade-Bobs/abgestufte Ramps ersetzen).
- `applyOrderedDitherFade(...)` bzw. `bayerFadeCells(...)` für deterministische Ordered-Dither-Übergänge verwenden.
- Trails durch begrenzte, opake Nachzeichnungen oder persistente Palettenstufen erzeugen.

Für Ein- und Ausblendungen gilt zusätzlich die Layer-Trennung:
- Vollflächige `#000000`-Ordered-Dither-Vorhänge sind **nur** für `background`-DSEs (und bei `floor`-DSEs ausschließlich unterhalb der Horizontlinie) zulässig. Auf `floor`-Layern SOLL das Ein-/Ausblenden auf den jeweils aktiven Bereich `[horizon .. horizon + Math.floor(vis * (height - horizon)))` begrenzt werden (bei `vis <= 0` null Zeichenoperationen), damit bei Übergängen zu `VoidFloor` kein schwarzes Rechteck über dem Hintergrund stehen bleibt.
- `foreground`- und `overlay`-DSEs DÜRFEN in `starting`/`stopping` keinen schwarzen Vollbild-Dither über den Hintergrund legen, sondern müssen über eigene Geometrie, schrittweise Sichtbarkeit oder Objektanzahl ein- und ausblenden.
- Hinweis zu `applyOrderedDitherFade(...)` vs. `bayerFadeCells(...)`: `applyOrderedDitherFade(...)` nutzt intern `document.createElement('canvas')` und `createPattern(...)`. Für DOM-freie DSEs und Node-Unit-Tests steht in `hardware-constraints.js` der native, run-gemergte Helfer `bayerFadeCells(ctx, x, y, w, h, visibility, cell, color)` bereit.

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

Alle DSEs werden **zentral** im Array `dseRegistry` in `js/visuals/dse/registry.js` über den lokalen Builder `RegisterDSE(...)` registriert. Einzelne DSE-Module exportieren ausschließlich ihre Klasse (`export class MyDse`) und importieren `registry.js` **nicht** selbst (Vermeidung zirkulärer Imports und `SyntaxError`).
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

**Horizont-Vertrag (`background` + `floor`):** Kombinierbare `floor`-DSEs (wie `KefrensCheckerboard`) beginnen ab `horizon = Math.floor(height * 0.55)` und lassen den Bereich `0 .. horizon - 1` vollständig unberührt. System-Hintergründe (`RetroSunset`, `PaulaSiliconBg`, `CastleFireworks`, `EnchantedCastle`) platzieren Himmel und Haupt-Silhouetten oberhalb dieser Linie, damit ein aktiver `floor`-DSE nur den unteren Vordergrund übernimmt.

**Kontrast-Vertrag (`background` + `foreground`/`overlay`):** `foreground`- und `overlay`-DSEs müssen auch vor hellen, vollflächigen oder stark bewegten `background`-DSEs (z. B. `ChunkyPlasma` oder `RetroSunset`) lesbar bleiben. Wichtige Formen, Sprites und Bitmap-Schriften SOLLEN sich über klare Kontrast-Ramps, dunkle Outlines oder Schattenrahmen abheben.

### 6.3 Lifecycles und Dauer

- `managed`: regulärer, vom SetlistManager verwalteter DSE. `duration` ist die früheste Wechselzeit, keine garantierte absolute Lebensdauer. Neue Swaps werden nur in `playing` und `buildup` ausgelöst (laufende `climax`- und `afterglow`-Phasen werden nicht unterbrochen); `maxInstances` gilt sowohl bei initialer Füllung als auch beim Swap.
- **Sequenzielle vs. simultane Layer-Übergänge:** Auf transparenten Layern (`foreground`, `overlay`) laufen ausgehender (`stopping`) und eingehender (`starting`) DSE simultan. Auf opaken Layern (`background`, `floor`) wartet ein eingehender sichtbarer (`!isVoid`) DSE, bis der ausgehende sichtbare DSE seine `stopping`-Phase vollständig beendet hat, damit Ausblendungen nicht sofort übermalt werden (bei Beteiligung eines `isVoid`-DSEs wird direkt überblendet).
- `permanent`: dauerhaft aktiver DSE; sparsam und nur für bewusst permanente Ebenen verwenden.
- `oneshot`: zeitlich begrenzter Einmaleffekt. `duration` zählt ausschließlich im aktiv laufenden Onstage-Zustand (nicht während `starting`, `stopping` oder `idle`) vor dem Übergang in `stopping`. Nach dem Ausblenden im `idle`-Zustand wird der `oneshot` sauber aus `activeDSEs` entfernt; ein bereits vor Spielbeginn ausgelöster Presenter startet automatisch beim ersten `isPlaying`-Frame.

One-Shots MÜSSEN mehrfach startbar sein, ohne alte Trackdaten, Zeitstempel, `_markedForRemoval`-ähnliche interne Zustände oder Rendering-Artefakte unkontrolliert mitzunehmen. Sie dürfen erst nach ihrer definierten Lebensdauer und dem Stopping-Übergang entfernt werden.

## 7. Deterministik und Ressourcenbesitz

### 7.1 Kein unseeded Zufall

`Math.random()` ist im Renderloop nicht zulässig. Auch Recycling und Respawns MÜSSEN reproduzierbar sein.

- Instanzeigener, fest initialisierter PRNG-Seed.
- Gleiche Eingabesequenz erzeugt dieselbe Ausgabe.
- Keine Abhängigkeit von Wall-Clock-Zeit, Objekt-Iteration mit zufälliger Reihenfolge oder global veränderten Zufallszuständen.
- PRNG nach visueller Verteilung auswählen und testen. Ein einfacher LFSR kann bei aufeinanderfolgenden XY-Werten sichtbare Korrelationen erzeugen; Xorshift32 ist ein bewährter einfacher Ersatz, aber ebenfalls zu prüfen.
- Für instanzeigenes deterministisches Rauschen stellt `hardware-constraints.js` `createXorshift32(seed)` bereit.

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
- `getImageData()` (Readback aus dem Canvas) ist grundsätzlich **nicht zulässig**.
- `putImageData()` DARF ausschließlich als gezielter Chunky-/C2P-Pfad aus einem **instanzeigenen, fest allokierten Pixel- oder Index-Buffer** eingesetzt werden, wenn der Algorithmus ihn benötigt (z. B. Tunnel, Rotozoomer, Plasma oder Shade-Bobs), alle geschriebenen Pixel garantiert der quantisierten Systempalette entsprechen und die Kosten auch auf Ultrawide im Budget bleiben; reguläre Effekte SOLLEN weiterhin Run-Merged-`fillRect`-Verfahren bevorzugen.
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
5. **Beat-Intensität:** reproduzierbare soft-/medium-/hard-Sequenzen mit `beatStrength`, `beatLevel` und `beatImpulse`; die vorgesehenen Ausschläge müssen sich sichtbar unterscheiden.
6. **Beat an/aus:** ein isolierter Beat-Eingang erzeugt die vorgesehene Änderung; ohne Beat bleibt das diskrete Pattern stabil.
7. **Zustände:** `starting → playing → buildup → climax → afterglow → stopping` mit derselben Instanz.
8. **Rotation:** Porträt → Querformat → Porträt mit derselben Instanz und ohne leere Bereiche, Cluster oder Ressourcenfehler.
9. **Palette:** tatsächliche Ausgabepixel erfüllen C64-/Amiga-/Atari-Grenzen.
10. **Viewport:** kleine, hohe, breite und extreme Seitenverhältnisse.
11. **Lifecycle:** Auswahl, Dauer, Stopping und Entfernung entsprechen den Registry-Metadaten; One-Shots zusätzlich erneut starten.

Der DSE-Baseline-Harness stellt dafür `makeMetrics(...)` und `runBeatIntensity(...)` bereit. Die festen Vergleichsstärken `GRADED_BEAT_STRENGTHS` sind `soft = 0.20`, `medium = 0.50` und `hard = 0.90`. Für exakte Onset-Frames ist ein Still mit `warmup: 0` sinnvoll; bei DSEs mit eigenem Einzug ist zusätzlich eine Sequenz mit separatem Warmup zu prüfen.

Die fokussierte Engine- und Universal-Suite für das graduelle Beat-System und den DJ-Lifecycle umfasst:

```sh
node --test \
  test/graded-beat-detection.test.mjs \
  test/graded-beat-routing.test.mjs \
  test/dj-engine-lifecycle.test.mjs \
  test/scene-dj-integration.test.mjs \
  test/starfield.test.mjs \
  test/copperbars.test.mjs \
  test/track-presenter.test.mjs \
  test/limit-bar.test.mjs \
  test/void-element.test.mjs
```

Zusätzlich decken die systemspezifischen Suites das v1.6.0-Overhaul ab:

```sh
node --test \
  test/kefrens-checkerboard.test.mjs \
  test/paula-silicon-bg.test.mjs \
  test/retro-sunset.test.mjs \
  test/amiga-castle-fireworks.test.mjs \
  test/chunky-plasma.test.mjs \
  test/c64-retro-sunset.test.mjs \
  test/sid-silicon-bg.test.mjs \
  test/c64-vector-star.test.mjs \
  test/c64-castle-fireworks.test.mjs \
  test/atari-dot-torus.test.mjs \
  test/atari-bobs.test.mjs \
  test/atari-retro-sunset.test.mjs \
  test/atari-wireframe-morph.test.mjs \
  test/ym-silicon-bg.test.mjs \
  test/atari-enchanted-castle.test.mjs \
  test/atari-kit-helpers.test.mjs \
  test/atari-laser-grid.test.mjs \
  test/atari-pond-ripples.test.mjs \
  test/atari-meta-blobs.test.mjs \
  test/atari-julia-cycler.test.mjs \
  test/atari-line-ribbons.test.mjs \
  test/atari-flat-shaded-trio.test.mjs
```

Ein Fake-Canvas für Unit-Tests SOLL zusätzlich zu fehlendem `fillText()`/`measureText()` strikte Integer-, Bounds- (`0 <= x`, `x + w <= width`, `0 <= y`, `y + h <= height`) und Palettenprüfungen erzwingen sowie `globalAlpha`, `save()`/`clip()` und `getImageData()` verweigern bzw. markieren (`putImageData()` wird – sofern für Chunky-DSEs unterstützt – ebenfalls vollständig auf Systempalette und Buffer-Bounds geprüft). DSEs SOLLEN idealerweise ohne globales `document` in Node testbar sein; für Engine-Tests stehen dafür optional `new SceneDJ({ createCanvas })` und `new StageManager({ createCanvas })` bereit.

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
- Sicherstellen, dass der physische Ausgabe-Canvas im Host-DOM `image-rendering: pixelated` nutzt, damit Nearest-Neighbor-Skalierung auf HiDPI-Displays scharf bleibt.
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
- [ ] Kontinuierliche Beat-Ausschläge verwenden `beatImpulse`; soft, medium und hard sind bei vorgesehenen Reaktionen sichtbar unterscheidbar.
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
- `js/visuals/dj/stage-manager.js` — Instanzen, Metriken, Zustände, PAL-Tick-Caching und >50-Hz-Beat-Latching
- `js/visuals/dj/setlist-manager.js` — Auswahl, Layerfüllung, sequenzielle Layer-Übergänge und Dauer
- `js/visuals/dj/track-monitor.js` — Energie, Hüllkurven und Beat-Events
- `js/visuals/dj/tension-manager.js` — Tension und Makrozustände
- `js/visuals/dse/registry.js` — Registry-Builder und gültige Metadaten
- `js/visuals/utils/hardware-constraints.js` — Auflösungen, Paletten, Quantisierung und Aliasing-Helfer
- `js/visuals/dse/universal/starfield.js` — responsive Projektion, Recycling und Rotationskontinuität
- `js/visuals/dse/universal/copperbars.js` — exakte Beatwechsel, Formationen und Afterglow
- `js/visuals/dse/universal/track-presenter.js` — Bitmap-Typografie und One-Shot-Overlay
- `js/visuals/dse/universal/limit-bar.js` — isoliert getesteter, deaktivierter Tension-Overlay
- `js/visuals/dse/universal/void-element.js` — transparenter Zero-CPU-Platzhalter
- `tools/dse-baseline/harness.js` — deterministische isolierte DSE-Prüfung einschließlich gradueller Beat-Intensitäten
