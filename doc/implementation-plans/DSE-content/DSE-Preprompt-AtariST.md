# Pre-Prompt: DSE-Paket Atari ST — 6 neue Demo Scene Elements für Chiptunes Fantasy

## 0. Auftrag

Du bist ein erfahrener Atari-ST-Demoscener und JavaScript-Entwickler. Implementiere sechs neue DSEs für das System **Atari ST** (Shifter mit 9-Bit-Palette, Timer-B-Rasters, YM2149 mit 3 Stimmen), je zwei für die Layer `background`, `foreground` und `floor`.

Verbindliche Referenzen, die diesem Prompt beiliegen: **DSE-Entwicklungsregeln**, `js/visuals/dse/registry.js`, `js/visuals/utils/hardware-constraints.js`. Dieser Prompt ergänzt sie und hebt keine Regel auf. Bei Konflikt gelten die DSE-Entwicklungsregeln. Dateien, die nicht beiliegen (Test-Harness, `ym-silicon-bg.js`), nicht raten: eigenständig implementieren oder nachlesen und im Lieferbericht als **Annahme** auflisten.

| Layer | DSE (Klasse) | Datei unter `js/visuals/dse/atari/` |
| --- | --- | --- |
| background | `AtariMetaBlobs` | `meta-blobs.js` |
| background | `AtariJuliaCycler` | `julia-cycler.js` |
| foreground | `AtariFlatShadedTrio` | `flat-shaded-trio.js` |
| foreground | `AtariLineRibbons` | `line-ribbons.js` |
| floor | `AtariLaserGrid` | `laser-grid.js` |
| floor | `AtariPondRipples` | `pond-ripples.js` |

Bereits vorhanden (nicht duplizieren): `AtariRetroSunset`, `AtariEnchantedCastle`, `YmSiliconBg` (background), `AtariDotTorus`, `WireframeMorph`, `AtariBobs` (foreground). Es gibt auf dem Atari **keinen** Floor: die beiden neuen Böden schließen diese Lücke. Die neuen DSEs sind bewusst anders gebaut: Feldfunktionen und Palettenzyklus statt Landschaft, gefüllte Flat-Shading-Körper und Linienbänder statt Dots, Wireframe und Bobs.

## 1. Nicht verhandelbar (Kurzfassung der DSE-Regeln)

- Signatur `render(ctx, width, height, t, state, stateTime, metrics)`; `ctx` = niedrig aufgelöster Retro-Buffer; optional `resize(width, height)`. Größenwechsel auch erst im nächsten `render()` korrekt behandeln, **dieselbe Instanz**, Simulationszustand erhalten, größenabhängige Caches neu bauen, Objekte auf den neuen Sichtbereich abbilden.
- Eingangsschutz am Anfang von `render()`: `width <= 0 || height <= 0 || !Number.isFinite(width / height)` → `this.lastT = t; return;`. `dt` aus `t` ableiten, auf max. `0.1 s` begrenzen (erster Frame: `0.02`). Keine Division durch `0`.
- **PAL-Tick-Caching (50 Hz):** Bewegung rein zeitbasiert. Exakte Beat-Events niemals als Pegel lesen.
- **Ohne Audio lebendig:** Grundbewegung aus `t`, `energy`, `smooth[c]`. Beats sind nur Akzent. Fehlende Metriken → endliche Fallbacks (`0`).
- **Diskrete Wechsel** (Muster, Palette, Richtung, Modus) **nur** bei `metrics.beatStarted` (mit `beatCount`). Kontinuierliche Ausschläge nur über `beatImpulse[0]` (Fallback: begrenztes `beat[0]`). `beat[0] > x` ist als Trigger verboten.
- **Retro-Stil:** Höhe laut `SYSTEM_RESOLUTIONS.atari = 200`, Breite dynamisch. 9-Bit-RGB, 3 Bit je Kanal, Werte `0..7 × 36`, **Maximum `252` (`#fcfcfc`), nie `255`**. Alle Farben über den Helfer `st(r, g, b)` (siehe §3) bzw. `quantizeAtari9Bit` + `rgbToHex`. **Farbbudget:** höchstens 16 Grundfarben je Scanline und DSE; Palettenwechsel innerhalb eines Bildes nur als dokumentierte Timer-B-Raster-Splits (siehe „Raster-Wipe“ in §5.0).
- Nur ganzzahlige opake `fillRect`; kein `globalAlpha`, `arc`, `lineTo`-Konturen, Schatten, Filter, Gradienten, `fillText`, `measureText`, `getImageData`.
- Linien, Kreise, Ellipsen und Polygone nur über Bresenham-/Scanline-Helfer. Die Helfer **clippen nicht**: jedes Primitiv hart auf `[0..width]×[0..height]` begrenzen (Floors zusätzlich auf `y >= horizon`).
- **Layer-Regeln:** `background` darf vollflächig mit Bayer-Dither aus Schwarz ein-/ausblenden. `floor` nur **unterhalb** `horizon = Math.floor(height * 0.55)`; Bereich `0 .. horizon-1` bleibt unberührt. `foreground` blendet **nie** per Schwarz-Vollbild-Dither, sondern über Geometrie, Objektzahl oder Schrittsichtbarkeit.
- **Kontrast-Vertrag:** Foreground-Formen brauchen dunkle Outline (`INK`) oder klare Rampen-Kontraste, auch vor hellen Backgrounds.
- Kein `Math.random()`. Instanzeigener **Xorshift32** mit festem Seed. Feste Pools. Keine Allokation im Renderloop. Resize allokiert gezielt neu.
- **Strobe-Schutz:** Beat-Akzente betreffen max. ca. 25 % der Bildfläche und max. 2 Rampenstufen. Keine Schwarz↔Weiß-Flächenwechsel im Beat-Takt (bis ca. 6,7 Beats/s möglich). Palettenzyklen laufen mit höchstens 6 Schritten/s.
- Kein DOM in DSEs: nativen Bayer-Zellen-Fade nutzen (siehe §4), nicht `applyOrderedDitherFade`.
- Jedes Modul exportiert nur seine Klasse und importiert `registry.js` **nicht**.
- Buffergrößen zur Orientierung (Höhe 200): 390×844 → 92×200, 844×390 → 432×200, 1920×1080 → 355×200, 2560×1080 → 474×200, 3:1 → 600×200, 1:3 → 66×200.

## 2. Gemeinsame Konventionen für alle 6 DSEs

```javascript
const clamp01 = v => Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
const lerp = (a, b, k) => a + (b - a) * k;

// Tension (asymmetrisch geglättet: Anstieg tau 0.30 s, Abfall tau 0.90 s)
const FALLBACK = { playing: 0.30, buildup: 0.65, climax: 1.0, afterglow: 0.20 };
let target = clamp01(metrics?.tensionPct ?? FALLBACK[state] ?? 0.2);
if (state === 'afterglow') target = Math.min(target, 0.30);
if (state === 'starting' || state === 'stopping') target = Math.min(target, 0.25);
this.ten += (target - this.ten) * (1 - Math.exp(-dt / (target > this.ten ? 0.30 : 0.90)));

// Beat
const impulse = clamp01(metrics?.beatImpulse?.[0] ?? metrics?.beat?.[0]);
const count = Number.isFinite(metrics?.beatCount) ? metrics.beatCount : this.lastBeatCount + 1;
const onBeat = metrics?.beatStarted === true && count !== this.lastBeatCount;
const level = !onBeat ? 0 : ([1, 2, 3].includes(metrics.beatLevel) ? metrics.beatLevel
            : (s => s < 1/3 ? 1 : s < 2/3 ? 2 : 3)(Number.isFinite(metrics.beatStrength) ? metrics.beatStrength : 1));
if (onBeat) this.lastBeatCount = count;
const dir = (count & 1) ? 1 : -1;

// YM-Stimme c = 0..2 (A, B, C), defensiv (fehlender Kanal = 0, keine Phantomenergie)
const ch = c => clamp01(metrics?.smooth?.[c] ?? 0);

// eigener Zustandszaehler (stateTime wird nicht zuverlaessig zurueckgesetzt)
if (this.lastState !== state) { this.lastState = state; this.stateAge = 0; } else this.stateAge += dt;
```

- **Kanäle:** Der YM2149 hat drei Rechteckstimmen (A, B, C) plus Rauschen und Hüllkurve. `smooth[0..2]` entspricht A, B, C. Rauschen, Hüllkurve und Registerfrequenzen sind **keine** zusätzlichen Kanäle: `metrics.regs` wird in diesem Paket nicht verwendet, alle sechs DSEs laufen vollständig ohne.
- **Simulationen** (Pools, Partikel) laufen mit festem 50-Hz-Schritt: `acc += dt; let n = 0; while (acc >= 0.02 && n++ < 4) { step(); acc -= 0.02; }`.
- **Tension-Bänder:** *low* = `ten < 0.35` (≙ `playing`), *mid* = `0.35–0.70` (≙ `buildup`), *high* = `> 0.70` (≙ `climax`). `afterglow` ist ein eigener Zustand mit gekühlter Palette. Strukturgrößen (Ballzahl, Ecken, Ripples) nur per **Index-Aktivierung** in festen Pools ändern, nie per Re-Seed.
- **Beat-Stufen** (identisch zu `getBeatLevel`):

| Stufe | `beatLevel` | `beatStrength` | Rolle in diesem Paket |
| --- | ---: | --- | --- |
| soft | 1 | `> 0` und `< 1/3` | Mikro-Nudge, kleinster diskreter Schritt |
| medium | 2 | `1/3` bis `< 2/3` | Nudge + Form- oder Palettenschritt |
| hard | 3 | `>= 2/3` | Nudge + lokales Sonderereignis (max. 1 pro 0,25 s je DSE) |
| jeder 4. Beat | `count > 0 && count % 4 === 0` | | Muster-/Mesh-/Parameterfamilie |
| jeder 8. Beat | `count > 0 && count % 8 === 0` | | Richtungs- oder Paletten-Wechsel |

- **Afterglow-Regel:** letzte Formation und Objektpositionen übernehmen, Geschwindigkeit ca. ×0,3, Palette auf kühle Rampen, Rückkehr der Palette per Raster-Wipe. Kein Re-Seed, kein harter Szenenwechsel.
- **Warteregel für Strukturwechsel:** ein pendender Wechsel (z. B. Eckenzahl) wird beim nächsten `beatStarted` übernommen, spätestens nach 1,2 s ohne Beat (Tracks ohne Perkussion).

## 3. Atari-ST-Hardware-Fingerabdruck

- **Shifter:** 512 Farben (3 Bit je Kanal), Lowres 320×200 mit 16 Farben. Die 16 Palettenregister lassen sich **pro Scanline** umschreiben (Timer-B-Interrupt): das sind die berühmten „Rasters“ und der Grund, warum ein Bild mehr als 16 Farben zeigen kann, jede Zeile aber nur 16.
- **Kein Sprite-Chip:** Objekte sind Software-Bobs, Linien und gefüllte Polygone (Blitter nur Mega ST/STE). Overscan öffnet die Ränder, Sync-Scrolling ersetzt Hardware-Scrolling.
- **YM2149:** 3 Rechteckstimmen (A, B, C), Rauschen, Hüllkurve. `smooth[0..2]`.
- **Klassiker:** Rasters, Dist-Scroller, Dot-Balls, gefüllte Vektoren (Flat Shading), Fraktale (Mandelbrot/Julia als ST-Benchmark und Demo-Effekt), Palettenzyklen.
- **Helfer und Farben:**

```javascript
const st = (r, g, b) => { const [R, G, B] = quantizeAtari9Bit(r * 36, g * 36, b * 36); return rgbToHex(R, G, B); }; // r,g,b = 0..7
const INK = st(0, 0, 0), WHITE = st(7, 7, 7); // WHITE = '#fcfcfc'
```

| Rampe (dunkel → hell, 5 Stufen, `[r,g,b]` je 0..7) | Stufen 0 … 4 |
| --- | --- |
| `RED5` | `[1,0,0] [3,0,0] [5,1,0] [7,3,1] [7,6,3]` |
| `GRN5` | `[0,1,0] [0,3,1] [1,5,1] [3,7,2] [6,7,4]` |
| `BLU5` | `[0,0,2] [0,1,4] [1,3,6] [3,5,7] [5,6,7]` |
| `AMB5` | `[1,1,0] [3,2,0] [5,4,0] [7,6,1] [7,7,4]` |
| `CYN5` | `[0,1,1] [0,3,3] [1,5,5] [3,7,6] [5,7,7]` |
| `VIO5` | `[1,0,2] [2,0,4] [4,1,6] [6,3,7] [7,6,7]` |

**Zwischentöne nur per Dither** (Zeilen-/Spalten-Checker, 2×2-Bayer) zwischen zwei Rampenstufen, kein Mischen. Jede Zeilentabelle für Raster-Splits muss im Code und im Lieferbericht dokumentiert sein.

## 4. Empfohlene Erweiterungen

Nur anlegen, wenn nicht schon im Repo vorhanden (die Pakete für C64, Amiga und Atari können parallel entstehen: gemeinsame Helfer **nur einmal** in `hardware-constraints.js` anlegen, vorher prüfen, ob ein anderes Paket sie schon geliefert hat). Existiert ein nativer Bayer-Fade in `YmSiliconBg` oder `AtariEnchantedCastle`, **extrahieren statt neu schreiben**. Reine Zusätze, keine Änderung bestehender Exporte.

- `createXorshift32(seed)` → `{ next(), float(), int(n), reset(seed) }`.
- `bayerFadeCells(ctx, x, y, w, h, visibility, cell = 2, color = '#000000')`: DOM-freier 4×4-Bayer-Fade aus `fillRect`-Zellen mit horizontalem Run-Merging, hart auf die Region geclippt, max. ca. 4000 `fillRect` je Aufruf.
- `fillAliasedPolygonClipped(...)` und `drawAliasedLineClipped(...)`: wie die vorhandenen Helfer, aber mit Clip-Rechteck als letztem Parameter.
- `drawAliasedEllipseOutlineClipped(ctx, xc, yc, rx, ry, color, clip)`: Midpoint-Ellipse mit Run-Merging (zusammenhängende Pixel einer Zeile als eine Spanne), geclippt. Wird von `AtariPondRipples` gebraucht.
- **Neu, nur Atari:** `js/visuals/dse/atari/atari-kit.js` (kein DSE, exportiert nur unveränderliche Daten): `st`, `INK`, `WHITE`, `RAMPS` (Hex-Tabellen aus der Tabelle oben), `RING_HUE` (siehe §5.2), `pp(L)`. Es darf von allen sechs Modulen importiert werden. Existieren in den vorhandenen Atari-DSEs schon gleichwertige Tabellen, diese wiederverwenden.

## 5. DSE-Spezifikationen

### 5.0 Gemeinsame Bausteine (in allen sechs DSEs gleich umsetzen)

- **Ping-Pong-Indexfolge** `pp(L) = [0, 1, …, L-1, L-2, …, 1]`, für 5-stufige Rampen `PP5 = [0,1,2,3,4,3,2,1]`. Jeder Farbmarsch (Rampenzyklus) läuft über eine Ping-Pong-Folge: die mittlere Luminanz bleibt konstant, ein Beat verschiebt nur Bänder und lässt nie die Fläche blitzen.
- **Familien:** Einzelrampen `FAM = [CYN5, VIO5, AMB5, GRN5]`, Index `fam`. Stimmen-Sets (je Stimme eine Rampe): `SETS = [[RED5, GRN5, BLU5], [AMB5, CYN5, VIO5]]`, Index `setIdx`. `afterglow` erzwingt `BLU5` bzw. `COOL = [BLU5, CYN5, VIO5]`. `fam`, `setIdx` ändern sich nur durch die 4.-/8.-Beat-Regel des jeweiligen DSE oder beim Verlassen von `afterglow`.
- **Raster-Wipe (Timer-B-Split) statt Blitz:** `setFamily(next)` merkt `wipeFrom`, `wipeTo`, `wipeT0 = t`. Eine Wipe-Linie `wipeY` läuft in 0,5 s von `wipeStart` (bei Floors `horizon`, sonst `0`) bis `height`; Zeilen mit `y < wipeY` nutzen die neue Palette, die übrigen die alte. So nutzt jede Scanline weiterhin nur eine Palette (≤ 16 Farben), genau wie beim echten Timer-B-Split. Rechtecke, die `wipeY` kreuzen, werden dort geteilt (Helfer `famAt(y)`).
- **Sichtbarkeit `vis`:** `starting` → `clamp01(stateTime / T_IN)`; `stopping` → `1 - clamp01(stateTime / T_OUT)`; sonst `1`. Startwerte `T_IN = T_OUT = 1.0 s` (background/floor) bzw. `0.8 s` (foreground). **In `stage-manager.js` nachlesen, wie lange `starting`/`stopping` real dauern, Konstanten angleichen, Ergebnis im Lieferbericht als Annahme melden.** Auf opaken Layern (`background`, `floor`) wartet der Nachfolger auf das Ende von `stopping`: das Ausblenden MUSS bei `vis = 0` vollständig enden und danach nichts mehr zeichnen.
- **Clip-Helfer (privat im Modul):** `fr(x, y, w, h)` rundet auf Integer, schneidet auf `[0..width]×[yMin..height]` zu (`yMin = horizon` bei Floors, sonst `0`) und verwirft `w <= 0 || h <= 0`. Jede Zeichenoperation läuft durch ihn.
- **Horizont:** `const horizon = Math.floor(height * 0.55)`. Floors schreiben nur `y >= horizon`; Backgrounds legen ihr Hauptmotiv oberhalb ab.
- **Fade:** `bayerFadeCells(ctx, x, y, w, h, vis)` aus §4, **nur** bei `background` und (unterhalb `horizon`) `floor`. Bei `vis >= 1` nicht aufrufen.
- **Beat-Limits:** hard-Sonderereignisse max. 1 pro 0,25 s je DSE (`this.hardCooldown -= dt`).
- **Idle:** `state === 'idle'` → sofort `return`, keine Simulation.
- **Seitenverhältnis:** `aspect = width / height`, `long = Math.max(width, height)`, `minDim = Math.min(width, height)`. Lange Achse ist im Querformat x, im Porträt y; Layouts verteilen sich entlang der langen Achse.

