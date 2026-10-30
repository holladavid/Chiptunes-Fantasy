# Chiptunes Fantasy – DSE-Optimierung, Schritt 1

## Ergebnis

Die reproduzierbare Baseline ist vollständig erstellt. Sie dokumentiert die unveränderten, verwalteten DSEs isoliert und ohne Vermischung mit anderen Effekten. Es wurden keine DSE-, Scene-DJ- oder Audiodateien verändert. Die Verbesserung der musikgesteuerten DSE-Aktivität und spontanen Beat-Reaktion bleibt wie vereinbart Schritt 2 vorbehalten.

## Prüfumfang und Abnahme

| Nachweis | Ergebnis |
|---|---|
| Verwaltete DSE-/System-Kombinationen | 20 |
| Zustände je Kombination und Ausrichtung | `playing`, `buildup`, `climax` |
| Mobile Einzelbilder | 120 |
| Bewegungsclips | 40 Clips, jeweils 36 Frames bei 18 fps |
| Live-Rotation Hoch → Quer → Hoch | 20 Läufe, jeweils mit derselben DSE-Instanz |
| Determinismus mit festem Seed und Musikmetriken | 40/40 bestanden |
| DSE-Laufzeitfehler | 0 |
| Clips ohne Bewegung oder mit identischen Folgeframes | 0 |
| Technische Validierung | alle 180 Einzel-/Rotations-PNGs lesbar; alle 40 MP4s mit 36 Frames |

Die synthetischen Stage-Viewports betragen 390 × 844 px im Hochformat und 844 × 390 px im Querformat. Dadurch ergeben sich dieselbe Pufferlogik und dieselben Abmessungen wie im Scene DJ:

- C64 und Atari: 92 × 200 ↔ 432 × 200 Pixel
- Amiga: 118 × 256 ↔ 554 × 256 Pixel

Beim Rotationslauf bleibt die Instanzkennung über alle drei Phasen gleich. Die Puffergrößen wechseln korrekt und kehren beim Zurückdrehen zu ihren Ausgangswerten zurück. Die Kontaktübersichten in `contacts/rotation-*.png` dokumentieren zusätzlich die visuelle Kontrolle.

## Zentrale Baseline-Befunde

### Historische Farb- und Pixeltreue

In 8 der 20 Kombinationen wurden im erzeugten RGB-Bild Palette-Verstöße gemessen:

- `Starfield`: C64, Amiga und Atari, jeweils im Zustand `climax`
- `AmigaRetroSunset`
- `AtariRetroSunset`
- `AmigaCube`
- `AmigaBoingBall`
- `AtariBobs`

Besonders hohe maxima der gemessenen Einzelbild-Farbanzahl:

- `AmigaBoingBall`: 564 Farben, davon 545 außerhalb der angenommenen Amiga-12-Bit-Quantisierung
- `AtariBobs`: 340 Farben, davon 334 außerhalb der angenommenen Atari-9-Bit-Quantisierung
- `AmigaCube`: 165 Farben, davon 160 außerhalb der angenommenen Amiga-12-Bit-Quantisierung

Diese Werte sind ein Ausgangsbefund, keine vollständige historische Bewertung. Gleichzeitig darstellbare Farben, Speicher und Rasterzeit werden erst in den systemspezifischen Folgeschritten festgelegt und optimiert.

### Renderverfahren und Frame-Profile

- `PaulaSiliconBg` setzt in sämtlichen geprüften Frames `imageSmoothingEnabled = true`. Das widerspricht dem angestrebten harten Retro-Upscaling und ist ein Kandidat für Schritt 3 beziehungsweise die Amiga-Optimierung.
- Der höchste gemessene Initialisierungs-/Frame-Ausreißer beträgt 106,5 ms bei `PaulaSiliconBg` im Querformat. In den Bewegungsläufen liegen die Mittelwerte bei etwa 0,65 ms im Hochformat und 1,74 ms im Querformat. Initialisierung und Dauerlast sind deshalb getrennt zu betrachten.
- `AtariRetroSunset` erreicht im Querformat durchschnittlich etwa 7245 `fillRect`-Aufrufe pro Frame und rund 2,76 ms mittlere Renderzeit im Bewegungslauf.
- `AmigaBoingBall` verwendet im Hauptkontext unter anderem 105 gefüllte Pfade und eine Ellipse pro Frame. `AtariBobs` zeichnet 48 vorberechnete Sprites pro Frame; die hohe Farbanzahl dokumentiert den weichen Sprite-/Glow-Look.

Die Renderzeiten stammen aus headless Chromium auf der Testmaschine. Sie sind keine Aussage über die Geschwindigkeit historischer Hardware und keine physische-iPhone-Messung.

### Beat-Reaktion als Ausgangswert

In 24 von 40 Beat-an/Beat-aus-Diagnosen verändern sich die Pixel. Das entspricht 12 der 20 Kombinationen mit einer direkt messbaren Reaktion auf den isolierten Beat-Wert.

Keine direkte Pixeländerung im Beat-0/Beat-1-Vergleich zeigen:

- `SidSiliconBg`
- `PaulaSiliconBg`
- `YmSiliconBg`
- `Copperbars` auf C64, Amiga und Atari
- `KefrensCheckerboard`
- `AmigaBoingBall`

Das bedeutet nicht, dass diese DSEs generell nicht auf Musik reagieren: Kanalglättung, Energie und Register können weiterhin wirken. Es bedeutet nur, dass der isolierte Beat-Wert im kontrollierten Vergleich keine Ausgabeänderung verursacht. Die Qualität und Sauberkeit der musikalischen Steuerung wird nicht in Schritt 1 verändert.

## Paketinhalt

- `baseline-report.md`: automatisch erzeugte Tabelle aller 20 Kombinationen mit Farben, Frame-Profilen, Bewegung, Determinismus, Beat- und Rotationsergebnissen
- `baseline-results.json`: vollständige Einzelmessungen einschließlich Operationszählern und frameweiser Bewegungsdaten
- `baseline-summary.json`: kompakte maschinenlesbare Zusammenfassung
- `screenshots/`: 120 Einzelbilder, nearest-neighbor hochskaliert
- `motion/`: 40 kurze MP4-Bewegungssequenzen, nearest-neighbor hochskaliert
- `rotation/`: 60 Bilder aus den drei Rotationsphasen
- `contacts/`: sechs Zustands-/Orientierungsübersichten und vier Rotationsübersichten
- `tools/`: Browser-Harness, Capture-Runner und Kontaktübersichten-Skript

## Reproduktion

Aus dem Projektstamm von Chiptunes Fantasy:

```bash
CHROMIUM_PATH=/usr/bin/chromium node tools/dse-baseline-capture.mjs \
  --output /mnt/agents/output/DSE-Schritt-1-Baseline

python3 tools/dse-baseline-contact-sheets.py \
  /mnt/agents/output/DSE-Schritt-1-Baseline
```

Optional kann der Lauf mit `--only c64-Starfield` auf eine Kombination oder mit `--skip-motion` auf Standbilder, Diagnose und Rotation begrenzt werden.

## Grenzen des Nachweises

Die Baseline verwendet deterministische, synthetische Musikmetriken und einen festen Zufalls-Seed. Sie prüft isolierte DSE-Ausgaben, nicht das Mischen mehrerer Effekte und keine vollständige Emulation historischer Rechner. Ein fehlerfreier, deterministischer und rotationsfähiger DSE ist damit noch nicht automatisch historisch plausibel. Die einzige sonstige Runner-Meldung war eine nicht vorhandene Favicon-Ressource der Testseite; sie ist kein DSE-Fehler.
