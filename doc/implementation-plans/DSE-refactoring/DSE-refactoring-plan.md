## Zielbild

Wir optimieren **jedes DSE so, dass es für sich allein auf der jeweiligen historischen Hardware glaubwürdig wäre**. Der Scene DJ darf diese Effekte weiterhin fantastisch kombinieren. Wir bauen dafür **keinen Emulator und keine Zyklus-Simulation**, sondern verbindliche Regeln für:

- Auflösung und Pixelraster
- gleichzeitig sichtbare Farben und Systempaletten
- 50-Hz-Animationscharakter
- Anzahl und Komplexität der bewegten Elemente
- ganzzahlige, vorberechnete oder gecachte Berechnungen
- kein Anti-Aliasing und kein Alpha-Blending innerhalb eines DSE
- deterministische, musikreaktive Bewegung ohne wachsenden Rechenaufwand

Übergänge des Scene DJs zwischen mehreren DSEs dürfen davon getrennt bleiben: Sie gehören zur Fantasy-Inszenierung, nicht zur Machbarkeit des einzelnen Effekts.

## Schritt 1: Ausgangsbasis und Prüfregeln festhalten

Vor Änderungen erstellen wir für jedes DSE eine kleine visuelle Baseline:

- isoliert ohne andere DSEs
- für `playing`, `buildup` und `climax`
- mit definierten Musikwerten und festem Zufalls-Seed
- als Screenshot und kurze Bewegungssequenz
- mit gemessener Farbanzahl und grobem Frame-Profil

Damit können wir anschließend beurteilen, ob ein Umbau den Effekt verbessert oder seinen Charakter versehentlich zerstört.

### Verbindliche Systembudgets

| System | Visuelle Zielgröße | Farblogik | Rechenmodell |
|---|---|---|---|
| **C64** | 200 Pixel Höhe, grobes Pixelraster | feste 16-Farben-Palette | wenige Integer-Operationen, Lookup-Tabellen, einfache Sprites und Linien |
| **Atari ST** | 200 Pixel Höhe | typischerweise 16 gleichzeitige Farben aus der 9-Bit-Palette | vorberechnete Spriteframes und Tabellen, begrenzte CPU-Arbeit |
| **Amiga** | 256 Pixel Höhe | typischerweise 32 gleichzeitige Farben aus 12 Bit, Copper-Effekte gesondert bewertet | Blitter-/Bob-ähnliche Sprites, Copper-Listen, vorberechnete Frames |

Diese Budgets sind bewusst **glaubwürdige Gestaltungsgrenzen**, keine exakten Hardware-Emulationen.

## Schritt 2: Zwei Integrationsfehler vor den DSE-Umbauten korrigieren

Diese Punkte sollten zuerst bereinigt werden, damit wir die DSEs anschließend zuverlässig beurteilen:

1. **Registerdaten an den TrackMonitor durchreichen**  
   Derzeit fehlt `chipRegs` beim `monitor.update()`-Aufruf. Dadurch läuft die gezielte SID-/YM-/Paula-Beat-Erkennung nicht wie vorgesehen.

2. **Doppelte DSE-Registrierung beim Kaltstart entfernen**  
   Alle DSEs werden momentan zweimal registriert. Nach einem Hardware-Power-Cycle ist das Verhalten anders. Vor Optimierungen sollte die Kandidatenliste eindeutig und reproduzierbar sein.

Dabei ändern wir weder Auswahlquoten noch die künstlerische Scene-DJ-Dramaturgie.

## Schritt 3: Gemeinsame Retro-Rendergrundlagen schaffen

Bevor wir einzelne Effekte umbauen, brauchen wir einheitliche Werkzeuge:

- aliaste Linien, Polygone, Kreise und Sprites ohne Canvas-AA
- systemabhängige Paletten und Farbbudgets
- Palette-Fades oder Dithering statt `globalAlpha`
- statische Hintergrund-Caches
- vorberechnete Sprite-, Rotations- und Bewegungstabellen
- deterministischer Zufall nur bei der Initialisierung, kein `Math.random()` während des Renderns
- 50-Hz-Updates für Bewegung und Musikreaktion
- feste Maximalwerte für Vertices, Sprites, Punkte und Tabellen

Wichtig: Ein Höhepunkt darf **nicht plötzlich mehr Geometrie oder Rechenarbeit erzeugen**. Er ändert bevorzugt Geschwindigkeit, Muster, Register oder Palette innerhalb desselben Budgets.

Außerdem beheben wir zwei bereits bekannte Fehler:

- die undefinierten Farben `cPathLight` und `cPathDark` im Atari-Sunset
- das erneute Aktivieren von `imageSmoothingEnabled` im Paula-Hintergrund

## Schritt 4: Universelle DSEs als Referenz umsetzen

### Starfield

- kleine, fest begrenzte Anzahl von Punkten
- ganzzahlige Positionen und wenige Helligkeitsstufen
- systemabhängige Farben
- feste Geschwindigkeitsklassen statt beliebig vieler moderner Partikel
- Beat verändert Phase oder Geschwindigkeit innerhalb fester Grenzen

### Copperbars

- klassische Rasterbalken mit systemgerechten Farben
- keine Alpha-Verläufe
- C64: reduzierte Palette und grobe Abstufungen
- Atari: wenige gleichzeitige Farben beziehungsweise glaubwürdige Rasterwechsel
- Amiga: Copper-ähnliche Farbzeilen
- sinusförmige Bewegung aus Lookup-Tabellen

Diese beiden DSEs werden unsere Referenz dafür, wie ein Effekt auf allen drei Systemen unterschiedlich aussieht, ohne seine Identität zu verlieren.

## Schritt 5: C64-DSEs optimieren

| DSE | Geplanter Ansatz |
|---|---|
| **C64RetroSunset** | statische Landschaft cachen, 16-Farben-Palette, Dithering statt Alpha, Horizont vereinheitlichen |
| **ChunkyPlasma** | Multicolor-/Chunky-Pixel-Charakter, Sinus- und Farbtabellen, keine pro Frame neuen komplexen Berechnungen |
| **SidSiliconBg** | Chipgrafik und Beschriftung als statische Ebene, nur wenige registergetriebene Anzeigen bewegen |
| **C64VectorStar** | wenige Vertices, ganzzahlige Projektion, Bresenham-Linien, keine geglätteten Vektorpfade |

Beim C64 steht anschließend besonders die Prüfung der **tatsächlich sichtbaren 16 Farben** im Vordergrund. Eine Quantisierung allein reicht hier nicht.

## Schritt 6: Atari-ST-DSEs optimieren

| DSE | Geplanter Ansatz |
|---|---|
| **AtariRetroSunset** | fehlerhafte Farben korrigieren, detaillierte Landschaft inklusive Blätter cachen, statische und dynamische Ebenen trennen |
| **YmSiliconBg** | statische Chipdarstellung, nur registerabhängige Anzeigen aktualisieren |
| **AtariDotTorus** | feste Punktzahl, vorberechnete Rotations-/Sinustabellen, wenige diskrete Tiefenstufen |
| **WireframeMorph** | begrenzte Vertexzahl und Morph-Tabellen, aliaste Linien, keine modernen geometrischen Übergänge |
| **AtariBobs** | `arc()` und freies `rotate()` durch vorberechnete, aliaste Spriteframes und Integerpositionen ersetzen |

Die Atari-Effekte sollen sich eher wie gut programmierte CPU-/Sprite-Effekte anfühlen, nicht wie eine moderne Canvas-Demo mit reduzierter Auflösung.

## Schritt 7: Amiga-DSEs optimieren

| DSE | Geplanter Ansatz |
|---|---|
| **AmigaRetroSunset** | statische Landschaft cachen, Copper-ähnliche Farbverläufe, 32-Farben-Budget |
| **PaulaSiliconBg** | Pixelglättung korrigieren, statische Siliziumdarstellung cachen, dynamische Registeranzeigen begrenzen |
| **KefrensCheckerboard** | vorberechnete Perspektiv- und Linienwerte, aliasanteile Kanten, feste Farb- und Segmentbudgets |
| **AmigaCube** | native AA-Polygone durch retroegerechte Füllung/Linien ersetzen, Rotationstabellen und begrenzte Flächenzahl |
| **AmigaBoingBall** | größter Umbau: 255 Vertices, dynamische Beleuchtung und Sortierung durch vorberechnete Ballframes beziehungsweise einen kleinen Frame-Cache ersetzen |

Der Boing Ball wird der wichtigste Referenzumbau: Er soll wieder wie ein vorberechneter Amiga-Effekt aussehen und nicht wie eine pro Frame neu berechnete 3D-Szene.

## Schritt 8: Musikreaktion historisch begrenzen

Nach den Umbauten prüfen wir jedes DSE mit echten Kanal- und Registerdaten:

- **Beat:** kurzer Sprite-, Muster- oder Palettenwechsel
- **Energie:** Geschwindigkeit oder Bewegungsamplitude innerhalb fester Grenzen
- **Tension:** Wechsel zwischen vordefinierten Animationssequenzen
- **Climax:** intensivere Nutzung desselben Effekts, nicht zusätzliche Rechenlast
- **Register:** nur systempassende Reaktionen, beispielsweise SID-Gates, YM-Hüllkurven oder Paula-DMA

Die Effekte sollen weiterhin hörbar auf die Musik reagieren, aber nicht durch moderne Partikel-, Blur- oder Blend-Effekte.

## Abnahmekriterien für jedes einzelne DSE

Ein DSE gilt erst als fertig, wenn:

1. es isoliert auf dem jeweiligen System glaubwürdig aussieht;
2. Farbzahl und Palette nachweisbar zum Systembudget passen;
3. keine AA-Zwischenfarben oder unbeabsichtigten Alpha-Verläufe entstehen;
4. dieselben Eingaben dieselbe Bewegung reproduzieren;
5. sich die Rechenlast zwischen `playing` und `climax` nicht wesentlich erhöht;
6. keine undefinierten Werte oder Zufallsänderungen während des Renderns auftreten;
7. Musikreaktion sichtbar bleibt;
8. Vorher-/Nachher-Aufnahmen den ursprünglichen Effektcharakter bewahren.

## Empfohlene Reihenfolge

**Baseline → Integrationsfehler → Rendergrundlagen → Starfield/Copperbars → C64 → Atari → Amiga mit Boing Ball als Hauptumbau → Gesamtprüfung.**

So bleibt jeder Schritt klein, separat überprüfbar und jederzeit rückgängig zu machen. Es wurde noch kein DSE-Code geändert.