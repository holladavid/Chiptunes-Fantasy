# DSE-Optimierung – Schritt 1: Baseline und Akzeptanznachweise

Dieser Bericht dokumentiert den unveränderten Ausgangszustand. Er ist keine historische Freigabe der einzelnen Effekte. Renderzeiten stammen aus headless Chromium und dienen ausschließlich dem Vergleich innerhalb dieser Baseline.

## Prüfumfang

- 20 verwaltete DSE-/System-Kombinationen
- 120 Einzelbilder: playing, buildup und climax in Mobile Hoch- und Querformat
- 40 kurze Bewegungssequenzen mit 18 fps
- 20 Rotationsläufe Hoch → Quer → Hoch mit derselben DSE-Instanz
- 40 Determinismus- und Beat-an/Beat-aus-Diagnosen
- Zufalls-Seed: 0x5eed1234
- Synthetische Musikmetriken; keine Verbesserung der Aktivitätsumschaltung oder Beat-Reaktion

## Kombinationsübersicht

| DSE / System | Renderfehler | max. Farben | Palette-Verstöße | p95 max. (ms) | Bewegung Ø | Deterministisch | Beat-Reaktion | Rotation |
|---|---:|---:|---:|---:|---:|---|---|---|
| Starfield / c64 | 0 | 4 | 3 | 0.7 | 0.4 % | ja | 2/2 Ausrichtungen | ohne Fehler |
| Starfield / amiga | 0 | 54 | 53 | 0.9 | 6.05 % | ja | 2/2 Ausrichtungen | ohne Fehler |
| Starfield / atari | 0 | 4 | 3 | 0.6 | 0.27 % | ja | 2/2 Ausrichtungen | ohne Fehler |
| C64RetroSunset / c64 | 0 | 6 | 0 | 0.8 | 5.72 % | ja | 2/2 Ausrichtungen | ohne Fehler |
| AmigaRetroSunset / amiga | 0 | 39 | 1 | 2.7 | 1.21 % | ja | 2/2 Ausrichtungen | ohne Fehler |
| AtariRetroSunset / atari | 0 | 24 | 3 | 5.7 | 0.48 % | ja | 2/2 Ausrichtungen | ohne Fehler |
| ChunkyPlasma / c64 | 0 | 7 | 0 | 1.9 | 24.64 % | ja | 2/2 Ausrichtungen | ohne Fehler |
| SidSiliconBg / c64 | 0 | 12 | 0 | 1.9 | 1.87 % | ja | 0/2 Ausrichtungen | ohne Fehler |
| PaulaSiliconBg / amiga | 0 | 40 | 0 | 106.5 | 19.09 % | ja | 0/2 Ausrichtungen | ohne Fehler |
| YmSiliconBg / atari | 0 | 6 | 0 | 1.2 | 12.16 % | ja | 0/2 Ausrichtungen | ohne Fehler |
| Copperbars / c64 | 0 | 12 | 0 | 0.6 | 6.84 % | ja | 0/2 Ausrichtungen | ohne Fehler |
| Copperbars / amiga | 0 | 37 | 0 | 0.2 | 17.73 % | ja | 0/2 Ausrichtungen | ohne Fehler |
| Copperbars / atari | 0 | 24 | 0 | 0.2 | 11.89 % | ja | 0/2 Ausrichtungen | ohne Fehler |
| KefrensCheckerboard / amiga | 0 | 19 | 0 | 1.6 | 8.21 % | ja | 0/2 Ausrichtungen | ohne Fehler |
| AmigaCube / amiga | 0 | 165 | 160 | 1.7 | 3.19 % | ja | 2/2 Ausrichtungen | ohne Fehler |
| AmigaBoingBall / amiga | 0 | 564 | 545 | 3.1 | 4.51 % | ja | 0/2 Ausrichtungen | ohne Fehler |
| AtariDotTorus / atari | 0 | 16 | 0 | 0.8 | 4.65 % | ja | 2/2 Ausrichtungen | ohne Fehler |
| WireframeMorph / atari | 0 | 2 | 0 | 0.6 | 1.44 % | ja | 2/2 Ausrichtungen | ohne Fehler |
| AtariBobs / atari | 0 | 340 | 334 | 0.7 | 8.48 % | ja | 2/2 Ausrichtungen | ohne Fehler |
| C64VectorStar / c64 | 0 | 6 | 0 | 1.2 | 4.08 % | ja | 2/2 Ausrichtungen | ohne Fehler |

## Festgestellte Renderfehler

Keine Laufzeitfehler im Capture aufgetreten.

## Interpretation

- **Palette-Verstöße** zählen RGB-Werte außerhalb der jeweils angenommenen C64-, Amiga- oder Atari-Palette. Sie erfassen unter anderem Browser-Anti-Aliasing und Alpha-Mischungen.
- **Farbanzahl und Palette** allein beweisen keine historische Machbarkeit. Rechenaufwand, Speicher, Rasterzeit und gleichzeitig darstellbare Farben werden in den Folgeschritten bewertet.
- **Beat-Reaktion** bedeutet hier nur, dass sich bei sonst identischem Lauf zwischen Beat 0 und Beat 1 Pixel unterscheiden. Die Qualität der musikalischen Steuerung wird ausdrücklich erst in Schritt 2 verbessert.
- **Rotation ohne Fehler** bestätigt Instanzkontinuität und fehlerfreie Ausgabe. Die visuelle Kontrolle der drei gespeicherten Phasen bleibt Teil des Akzeptanznachweises.

## Dateien

- `screenshots/`: Einzelbilder aller Zustände und Ausrichtungen
- `motion/`: kurze Bewegungsclips
- `rotation/`: vor, während und nach der Live-Rotation
- `contacts/`: Übersichtstafeln zur visuellen Kontrolle
- `baseline-results.json`: vollständige Messwerte einschließlich Frame-Profilen
- `tools/`: reproduzierbarer Capture-Runner und Browser-Harness
