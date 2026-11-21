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

---

### 5.1 `AtariMetaBlobs` — background

**Vorbild:** Metaballs: eine Feldfunktion über allen Bällen wird in Iso-Bänder geschnitten, gerechnet in groben Chunky-Zellen. Hier mit ST-Palette: vier Stufen je Stimme, Farbe nach dominantem Ball. Drei Blobs gehören den drei YM-Stimmen.
**Registry:** `.systems('atari').layer('background').weight(12).duration(13.0).climaxHold(12.0)`

**Aufbau**

1. **Zellraster:** `cell = max(3, ceil(sqrt(width·height / 5000)))` (≤ 5000 Zellen).
2. **Bälle** (7 Slots, `Float32Array`). Hilfsfunktion `P(u, v)` bildet `u` (lange Achse) und `v` (kurze Achse), beide `0..1`, auf Pixel ab: `width >= height ? (u·width, v·height) : (v·width, u·height)`.
   - Slots `0..2` = Stimmenbälle (A, B, C): `u = 0.2 + 0.3·c + 0.07·sin(0.31·t·(1 + 0.3·c) + 2.1·c) + (c − 1)·0.02·repel`, `v = 0.5 + 0.22·sin(0.43·t + 1.7·c)`.
   - Slots `3..6` = Satelliten, gehören der Stimme `(i − 3) % 3`: `orbit += ωs·dt·orbitSign` (integrieren, nicht `ωs·t`), `ang = orbit + (i − 3)·π/2`, `ωs = lerp(0.25, 0.9, ten)`. Bahnform `orbitShape`: `0` Ellipse `u = 0.5 + 0.36·cos(ang)`, `v = 0.5 + 0.30·sin(ang)`; `1` Acht `u = 0.5 + 0.36·cos(ang)`, `v = 0.5 + 0.24·sin(2·ang)`; `2` Ellipse quer (Faktoren `0.22 / 0.40`); `3` Ellipse längs (Faktoren `0.42 / 0.18`). Beim Wechsel werden die Faktoren in 0,5 s interpoliert.
   - Radien: `R0 = 0.11·(minDim + long)/2`. Stimmenball `r = R0·(0.55 + 0.9·ch(c))·(1 + 0.3·impulse)·pop_c`, Satellit `r = 0.6·R0·(0.6 + 0.8·ch(v))·(1 + 0.3·impulse)`. Index-Aktivierung: ein Satellit läuft mit τ 0,2 s auf Radius `0`, solange er nicht aktiv ist.
3. **Feld:** `F(x, y) = Σ r_i² / ((x − xi)² + (y − yi)² + 1)` über alle aktiven Bälle; der Ball mit dem größten Einzelterm bestimmt die Stimme `vo` der Zelle (Hue). Schwellen `TH = [0.55, 0.90, 1.40, 2.20]·(1.25 − 0.5·ten)·thMul`, `thMul = 0.85` für 0,15 s bei medium. Level `L` = Zahl der überschrittenen Schwellen (`0..4`).
4. **Farbe:** `L = 0` → `INK`; `L = 1..4` → Stufe `L` der Rampe von Stimme `vo` (`SETS[setIdx][vo]`, `afterglow`: `COOL`). Im `climax` wird `F > 4.5` zu `WHITE` (Kern). Palette je Scanline: 3 × 4 + `INK` + `WHITE` = 14 Farben.
5. **Darstellung:** je Zellzeile Läufe gleicher `(L, vo)` zu einem `fr` verschmelzen.
6. **Raster-Wipe** beim Wechsel von `setIdx` (siehe §5.0). Zuletzt `bayerFadeCells(ctx, 0, 0, width, height, vis)`.

**Tension → Verhalten** (`nActive = ten < 0.35 ? 3 : ten < 0.70 ? 5 : 7`, Hysterese ±0.05)

| Zustand / Band | Sichtbares Verhalten |
| --- | --- |
| `starting` | Bayer-Fade, Radien `· vis`: die Blobs wachsen aus dem Nichts |
| `playing` / low | 3 Stimmenblobs, große glatte Formen, langsame Bahnen (`ωs ≈ 0,25–0,5`), Schwellen weit (Blobs getrennt) |
| `buildup` / mid | 2 Satelliten, schnellere Bahnen (`ωs ≈ 0,6`), Schwellen enger, Blobs verschmelzen zeitweise |
| `climax` / high | alle 7 Bälle, `ωs ≈ 0,9`, Blobs fließen zusammen, `WHITE`-Kern bei `F > 4.5` |
| `afterglow` | `COOL`-Familien, Radien `× 0.8`, `ωs × 0.3`, Satelliten bleiben (Formation bleibt), kein neuer Ball |
| `stopping` | Radien `· vis`, Bayer-Fade bis Schwarz |

**Beat → Verhalten**

| Auslöser | Reaktion |
| --- | --- |
| `impulse` (kontinuierlich) | alle Radien `× (1 + 0.3·impulse)` (die Blobs atmen im Beat) |
| soft | `repel = 1` (klingt mit τ 0,2 s ab): die drei Stimmenblobs stoßen sich entlang der langen Achse kurz ab |
| medium | `thMul = 0.85` für 0,15 s: die Iso-Bänder schwellen an (Welle durch alle Blobs) |
| hard | Stimmenball mit dem höchsten `ch`: `pop = 1.6`, klingt mit τ 0,1 s ab, plus Level-3-Band 0,12 s in `WHITE` (dünne Kontur, max. 1×/0,25 s) |
| jeder 4. Beat | Satellitenbahn wechselt die Form: `orbitShape = (orbitShape + 1) & 3` (Ellipse, Acht, Ellipse quer, Ellipse längs), weicher Übergang 0,5 s |
| jeder 8. Beat | `orbitSign = −orbitSign` und `setIdx = (setIdx + 1) & 1` per Raster-Wipe |

**Kanäle:** Stimmenball `c` ↔ YM-Stimme `c`; Satelliten erben die Hue und die Größenmodulation ihrer Stimme `(i − 3) % 3`. Die Hue-Zuordnung (A rot, B grün, C blau in `SETS[0]`) bleibt in jeder Zelle erkennbar. Ohne `smooth` gilt `ch = 0`: Mindestradius `0.55·R0`, Bahnen laufen aus `t`.
**Responsive:** Anker liegen entlang der langen Achse: im Porträt stapeln sich die Blobs vertikal, im Querformat und auf Ultrawide verteilen sie sich horizontal; Satellitenbahnen skalieren mit der langen Achse. `R0` mischt `minDim` und `long`, damit Blobs auf Ultrawide nicht zu klein werden.
**Budget:** ≤ 5000 Zellen × 7 Bälle = 35 000 Feldterme, ≤ 2500 `fillRect`/Frame nach Run-Merging.
**Zusatztests (`test/atari-meta-blobs.test.mjs`):** Zellzahl ≤ 5000 in allen Viewports; höchstens 14 verschiedene `fillStyle` je Frame und Scanline; `repel`/`pop` entstehen nur bei `beatStarted`; Hue folgt dem dominanten Ball (isolierte Eingabe `ch(2) = 1`); `orbitShape` wechselt nur bei `count % 4 === 0`.

---

### 5.2 `AtariJuliaCycler` — background

**Vorbild:** Julia-Menge mit Palettenzyklus. Fraktale waren auf dem ST Benchmark und Demo-Effekt, der Farbring dreht sich per Palettenregister-Rotation. Der Parameter `c` wandert auf einer kleinen Bahn, die Menge atmet im Takt.
**Registry:** `.systems('atari').layer('background').weight(11).duration(14.0).climaxHold(12.0)`

**Aufbau**

1. **Zellraster:** `cell = max(3, ceil(sqrt(width·height / 6000)))` (≤ 6000 Zellen).
2. **Abbildung:** Zellmitte `(px, py)` → `zx = (px − cx)·k`, `zy = (py − cy)·k`, `k = 3.2 / (minDim·Z)`, `Z = (1 + 0.12·sin(0.4·t))·(1 + 0.18·impulse)·(1 + 2·(1 − vis))`. Die Ebene ist über `minDim` etwa 3,2 Einheiten breit; Ultrawide zeigt mehr Ebene, nicht gestreckte.
3. **Iteration:** `z ← z² + c`, Abbruch bei `|z|² > 16` oder `n == maxIter`. `maxIter = ten < 0.35 ? 16 : 24` (`afterglow`: 14), bei medium `+4` für 0,2 s.
4. **Parameter `c`:** `c = c0 + ρ·(cos ψ, sin ψ) + 0.01·impulse·(cos(0.7·dir), sin(0.7·dir))`. `ψ += ψdot·dt·psiSign`, `ψdot = 0.5 + 1.5·ten`, `ρ = lerp(0.01, 0.04, ten)` (`afterglow`: `0.005`). Familien `c0[f]`: `F0 = (−0.8, 0.156)`, `F1 = (−0.123, 0.745)` (Douady-Hase), `F2 = (−0.391, −0.587)` (Siegel-Scheibe), `F3 = (0.285, 0.010)`. Bei Familienwechsel läuft `c0` in 1,0 s linear zum neuen Wert.
5. **Farbring:** Innen (`n == maxIter`) `INK`; außen `RING[(n + cycleInt + zoneOff) % RING.length]`. `RING_HUE` hat 14 Einträge mit nahezu gleicher Helligkeit (Y ≈ 2,8–4,3): `st(7,2,1) st(6,4,0) st(4,5,0) st(2,6,1) st(1,6,3) st(0,5,5) st(0,4,6) st(1,3,7) st(3,2,7) st(5,2,7) st(6,2,6) st(7,2,5) st(7,3,4) st(7,2,2)`. Weitere Familien: `ringOf(ramp) = [r1, r2, r3, r4, r3, r2]` (6 Einträge, ohne die dunkelste Stufe). `RINGS = [RING_HUE, ringOf(AMB5), ringOf(GRN5), ringOf(BLU5)]`, `afterglow` erzwingt `ringOf(BLU5)`. Palette je Scanline: ≤ 14 Ringfarben + `INK` + `WHITE` = 16.
6. **Zyklus:** `cycle += cycleRate·dt`, `cycleRate = lerp(2, 6, ten)` Schritte/s (Flackerschutz: nie über 6), `cycleInt = floor(cycle) + cycleJump`. `cycleJump` wächst nur durch Beat-Schritte.
7. **Zonen:** `rr = hypot(px − cx, py − cy) / halbeDiagonale`; Zone 0 (`rr < 0.33`) = Stimme A, Zone 1 (`< 0.66`) = B, sonst C. `zoneOff = round(ch(zone)·3)` (Farbphasenversatz).
8. **Darstellung:** je Zellzeile Läufe gleicher Farbe verschmelzen. Raster-Wipe beim Ringwechsel (8. Beat), zuletzt `bayerFadeCells(ctx, 0, 0, width, height, vis)`.

**Tension → Verhalten**

| Zustand / Band | Sichtbares Verhalten |
| --- | --- |
| `starting` | Bayer-Fade, `Z` fährt von 3× auf 1× (die Menge zoomt heraus), `maxIter` 16 |
| `playing` / low | `maxIter 16`, `ρ ≈ 0,01–0,02`, Zyklus 2–3,5 Schritte/s, ruhige Atmung |
| `buildup` / mid | `maxIter 24`, `ρ ≈ 0,025`, Zyklus 4–5 Schritte/s, mehr Detailbänder |
| `climax` / high | `maxIter 24`, `ρ = 0,04`, Zyklus 6 Schritte/s, Zoom-Amplitude `× 1.5` |
| `afterglow` | `ρ → 0,005`, Zyklus 0,8 Schritte/s, Ring `ringOf(BLU5)`, `maxIter 14`, `c0` bleibt |
| `stopping` | `Z` fährt auf 3×, Bayer-Fade bis Schwarz |

**Beat → Verhalten**

| Auslöser | Reaktion |
| --- | --- |
| `impulse` (kontinuierlich) | Zoom-Puls `Z × (1 + 0.18·impulse)`, `c`-Nudge `0.01·impulse` |
| soft | `cycleJump += 1` (die Farbbänder wandern um einen Schritt) |
| medium | `cycleJump += 2`, `maxIter + 4` für 0,2 s (ein zusätzliches Detailband) |
| hard | `cycleJump += 3`, Konturband `n == 1 + (count % 8)` 0,12 s in `WHITE` (dünn, max. 1×/0,25 s) |
| jeder 4. Beat | Familie `f = (f + 1) & 3`, `c0` morpht in 1,0 s |
| jeder 8. Beat | `psiSign = −psiSign` und Ringfamilie per Raster-Wipe |

**Kanäle:** drei Radialzonen (innen, Mitte, außen) gehören A, B, C; die Farbphase der Zone springt mit der Stimme. Alles bleibt in denselben 16 Farben. Ohne `smooth` gilt `zoneOff = 0`, der Zyklus läuft aus `t`.
**Responsive:** Ebene über `minDim` skaliert; Porträt zeigt die Menge hochkant mit viel Außenbereich, Ultrawide breit mit mehr Außenbändern. Zellgröße steigt automatisch, damit die Zellzahl ≤ 6000 bleibt.
**Budget:** ≤ 6000 Zellen × im Mittel ca. 10 Iterationen = 60 000 Iterationen/Frame, ≤ 3000 `fillRect`/Frame. Reicht die Rechenzeit nicht, zuerst `maxIter` senken, dann die Zellgröße um 1 erhöhen.
**Zusatztests (`test/atari-julia-cycler.test.mjs`):** alle `n` endlich und `<= maxIter`; `cycleRate <= 6` in jedem Frame; `cycleJump` ändert sich nur bei `beatStarted`; Familienwechsel nur bei `count % 4 === 0`; höchstens 16 verschiedene `fillStyle` je Scanline; deterministische Ausgabe über 300 Frames.

---

### 5.3 `AtariFlatShadedTrio` — foreground

**Vorbild:** Gefüllte Vektorkörper mit Flat Shading, der klassische ST-Look (Cuddly-Demos, Starglider): drei Polyeder, Lambert-Schattierung in fünf Rampenstufen, Rückseiten-Culling. Jeder Körper gehört einer YM-Stimme.
**Registry:** `.systems('atari').layer('foreground').weight(12).duration(14.0).climaxHold(14.0)`

**Aufbau**

1. **Meshes** (konstante Tabellen im Modul, Flächen gegen den Uhrzeigersinn, Normalen vorab berechnet, alle auf Umkugelradius 1 normiert): `CUBE` (8 Ecken, 6 Quads), `OCTA` (6 Ecken, 8 Dreiecke), `TETRA` (4 Ecken `(1,1,1) (1,−1,−1) (−1,1,−1) (−1,−1,1)`, 4 Dreiecke), `PRISM3` (dreieckiges Prisma, 6 Ecken, 2 Dreiecke + 3 Quads), `PYRAMID4` (5 Ecken, 1 Quad + 4 Dreiecke), `BIPYR6` (sechseckige Bipyramide, 8 Ecken, 12 Dreiecke). `MESHSETS = [[CUBE, OCTA, TETRA], [PRISM3, PYRAMID4, BIPYR6], [OCTA, CUBE, PYRAMID4], [TETRA, BIPYR6, PRISM3]]`, Index `meshSet`; Objekt `i` nutzt `MESHSETS[meshSet][i]`.
2. **Layout** auf der langen Achse: Objekt `i ∈ {0,1,2}` bei `lcenter + (i − 1)·spacing`, `spacing = min(long/3, 0.95·minDim)`, Querachse `0.5·short + 0.04·minDim·sin(0.8·t + 2.1·i)` (Bob). Im Porträt stehen die Körper übereinander.
3. **Größe:** `R = 0.30·minDim·scaleState·(0.75 + 0.5·ch(i))·(1 + 0.30·impulse)·visI·shrink`, `scaleState = lerp(0.72, 1.10, ten)`, `visI = clamp01((vis − 0.2·i)/(1 − 0.2·i))`, `shrink` für den Meshwechsel (siehe Punkt 8). Perspektive `persp = 4/(4 − z)`.
4. **Rotation:** je Objekt drei Eulerwinkel, **integriert**: `ang_i[k] += ω·kmul[k]·(1 + 1.5·ch(i))·dt·spinSign`, `ω = lerp(0.5, 1.6, ten)`, `kmul = [1.0, 0.7, 0.45]`, Startphase `0.3·i`. Beat-Offset `0.4·impulse` rad auf dem ersten Winkel (nicht integriert), damit ein Kanalsprung keinen Winkelsprung erzeugt.
5. **Licht:** `L = normalize(0.6·cos λ, −0.5, 0.6·sin λ + 0.6)`, `λ = lightAngle + lightSpeed·t`, `lightSpeed = lerp(0.3, 1.4, ten)`; `lightAngle += π/6` bei soft.
6. **Flächen:** Ecken drehen und projizieren, Rückseiten verwerfen (`n.z <= 0`), `s = clamp01(n·L)`, `stufe = clamp(round(s·3.5) + round(ch(i)), 0, 4)`, Farbe `SETS[setIdx][i][stufe]` (`afterglow`: `COOL`). **Explosionsansicht:** jede Fläche um `explode·R` entlang ihrer Normalen verschoben, `explode = 0.06·smoothstep(0.7, 1, ten) + boom_i`, `boom_i` klingt mit τ 0,12 s ab. Flächen nach mittlerer Tiefe sortieren (Insertion-Sort auf `Uint8Array`, ≤ 12 Flächen), hinten zuerst.
7. **Zeichnen:** `fillAliasedPolygonClipped` je Fläche, danach Kantenpass mit `drawAliasedLineClipped` in `INK` (1 px) an allen Kanten sichtbarer Flächen. Überschreitet die Messung das Budget, nur an Silhouettenkanten (Kante gehört zu genau einer sichtbaren Fläche).
8. **Meshwechsel** (4. Beat): `shrink` fällt in 0,15 s auf 0, `meshSet` wechselt, `shrink` wächst in 0,25 s auf 1 (reine Geometrie). **Farbwechsel** (8. Beat): Raster-Wipe auf `setIdx`.

**Palette:** 3 × 5 + `INK` = 16 Farben je Scanline (kein `WHITE`; Highlights nutzen Stufe 4).

**Tension → Verhalten**

| Zustand / Band | Sichtbares Verhalten |
| --- | --- |
| `starting` | die Körper wachsen nacheinander aus der Mitte (`visI`), kein Schwarz-Fade |
| `playing` / low | kleine Körper (`scaleState ≈ 0,72–0,85`), langsame Drehung, ruhiges Licht, keine Explosion |
| `buildup` / mid | größere Körper (`≈ 0,9–1,0`), Drehung ≈ 1,0–1,3 rad/s, schnelleres Licht, Bob aktiv |
| `climax` / high | größte Körper (`≈ 1,05–1,10`), Drehung ≈ 1,6 rad/s, Grund-Explosion `0.06`, Beats öffnen die Körper kurz weiter |
| `afterglow` | `scaleState 0,7`, `ω × 0.3`, `COOL`-Set, `explode 0`, Formation bleibt |
| `stopping` | die Körper schrumpfen in umgekehrter Reihenfolge (`visI`) |

**Beat → Verhalten**

| Auslöser | Reaktion |
| --- | --- |
| `impulse` (kontinuierlich) | Größe `× (1 + 0.30·impulse)`, Winkel-Offset `0.4·impulse` |
| soft | `lightAngle += π/6`: die Schattierung springt um einen Lichtschritt |
| medium | Körper der Stimme mit dem höchsten `ch`: `boom = 0.25` (die Flächen öffnen sich kurz) |
| hard | alle drei Körper `boom = 0.30`, Körper der stärksten Stimme 0,12 s komplett in Stufe 4 (max. 1×/0,25 s) |
| jeder 4. Beat | `meshSet = (meshSet + 1) & 3` über Schrumpf-/Wachs-Übergang (0,4 s) |
| jeder 8. Beat | `spinSign = −spinSign` und `setIdx = (setIdx + 1) & 1` per Raster-Wipe |

**Kanäle:** Körper `i` ↔ YM-Stimme `i` (A, B, C): Größe, Spingeschwindigkeit und Schattierung folgen `ch(i)`. Ohne `smooth` zeigen die Körper Grundgröße und drehen aus `t`.
**Responsive:** Layout auf der langen Achse; Porträt zeigt drei übereinander gestapelte Körper (Radius an `minDim`), Ultrawide drei weit gespreizte (Abstand bis `0,95·minDim`). 3:1 und 1:3 müssen ohne negative Geometrie laufen.
**Budget:** ≤ 6000 `fillRect`/Frame (36 Polygone plus Kantenpass), ≤ 12 Flächen je Körper, Sortierpuffer fest, keine Allokation im Renderloop.
**Zusatztests (`test/atari-flat-shaded-trio.test.mjs`):** keine Rückseite wird gezeichnet; `meshSet` wechselt nur bei `count % 4 === 0`, `setIdx` nur bei `count % 8 === 0`; `boom` entsteht nur bei `beatStarted`; Körper `i` reagiert nur auf `ch(i)` (isolierte Eingabe); ein Kanalsprung `0 → 1` erzeugt höchstens `2.5·ω·dt` Winkeländerung je Frame; höchstens 16 verschiedene `fillStyle` je Scanline.

---

### 5.4 `AtariLineRibbons` — foreground

**Vorbild:** Linienbänder (Mystify-Stil): mehrere Polygone aus Linien, deren Ecken durch den sicheren Bereich prallen, dazu eine Spur aus Geisterkopien in abnehmender Helligkeit. Ein reiner Bresenham-Effekt, wie er auf dem ST ohne Sprites typisch war.
**Registry:** `.systems('atari').layer('foreground').weight(11).duration(15.0).climaxHold(12.0)`

**Aufbau**

1. **Bänder:** 3 Bänder (A, B, C), je `nv` Ecken (`nv = 4`, im `climax` 5, Pool 6 reserviert). Ecke = Position `(x, y)` und Geschwindigkeit `(vx, vy)` in `Float32Array`. Initialisierung im Konstruktor aus dem Xorshift32 (fester Seed): Positionen im sicheren Rechteck, `|v| = 0.8…1.2`, Richtungen deterministisch.
2. **Sicherer Bereich:** `m = round(0.06·minDim)`, Rechteck `[m, width − m] × [m, height − m]`. Ecken reflektieren am Rand (Vorzeichen von `vx`/`vy` wechselt, Position wird geklemmt). **Resize:** Positionen proportional auf das neue Rechteck abbilden (`x' = m' + (x − m)/(width − 2m)·(width' − 2m')`), Geschwindigkeiten bleiben: dieselbe Instanz läuft ohne Sprung weiter.
3. **Bewegung** im 50-Hz-Schritt: `x += vx·vBase·(1 + 0.6·ch(c))·(1 + 0.8·impulse)·dt`, `vBase = lerp(30, 90, ten)·(minDim/200)` px/s (der Kanalfaktor wirkt auf die Geschwindigkeit und wird integriert, kein Phasensprung). Radiale Beat-Schübe addieren ein `shove`-Feld, das mit τ 0,25 s abklingt.
4. **Spuren:** Ringpuffer `H = 8` Momentaufnahmen je Band (`Int16Array(3·6·2·8)`), neue Aufnahme alle 2 PAL-Schritte (25 Hz) und sofort bei medium/hard (`snapNow`). Aktive Ghosts `gh = ten < 0.35 ? 3 : ten < 0.70 ? 5 : 8`.
5. **Zeichnen:** von der ältesten zur neuesten Kopie (Kopf zuletzt), Linien mit `drawAliasedLineClipped`. Stufe `max(1, 4 − floor(g·4 / gh))` (Kopf 4, älteste 1), Farbe `SETS[setIdx][c][stufe]` (`afterglow`: `COOL`). Der Kopf bekommt darunter eine `INK`-Linie um `(+1, +1)` versetzt (Kontrast) und eine zweite Farblinie 1 px daneben (2 px dick, bei flachen Linien in y, sonst in x).
6. **Verbindungsmuster** `link` (4. Beat): `0` Umriss (`i → i+1`), `1` Stern (`i → i+2`, bei `nv = 4` zwei Diagonalen), `2` Umriss plus Diagonalen.
7. **Eckenzahl:** `nv` wächst auf 5, sobald `ten >= 0.70` (pending-Regel; die neue Ecke entsteht in der Mitte der Kante `nv−1 → 0` mit der Geschwindigkeit der Ecke `nv−1`). Sie kehrt zurück, wenn `ten < 0.50` seit 1,2 s gilt: Ecke 4 läuft in 0,5 s linear auf Ecke 3 zu und wird deaktiviert.
8. **Ein-/Ausblenden** ohne Fade: Ghost-Zahl `floor(gh·vis)`, Band `c` sichtbar ab `vis > 0.2·c`.

**Palette:** 3 × 4 + `INK` = 13 Farben.

**Tension → Verhalten**

| Zustand / Band | Sichtbares Verhalten |
| --- | --- |
| `starting` | Bänder erscheinen nacheinander, die Ghost-Zahl wächst von 1 auf `floor(gh·vis)`, kein Fade |
| `playing` / low | 4 Ecken, 3 Ghosts, `vBase ≈ 30–50`, Umriss-Link |
| `buildup` / mid | 4 Ecken, 5 Ghosts, `vBase ≈ 55–70` |
| `climax` / high | 5 Ecken, 8 Ghosts, `vBase ≈ 75–90`, Doppelkopf auf allen Bändern |
| `afterglow` | `COOL`, `vBase × 0.35`, Ghosts auf 5 (alle 0,15 s einer weniger), Ecken bleiben, Formation bleibt |
| `stopping` | Ghosts schrumpfen (`· vis`), Bänder verschwinden nacheinander |

**Beat → Verhalten**

| Auslöser | Reaktion |
| --- | --- |
| `impulse` (kontinuierlich) | Eckengeschwindigkeit `× (1 + 0.8·impulse)`, Kopfdicke `+ round(impulse)` px |
| soft | Band der stärksten Stimme: Geschwindigkeits-Nudge `dir·0.15·vBase` in x |
| medium | `snapNow` und radialer Schub `0.25·vBase` (das Band weitet sich), die Beat-Kante bleibt als Ghost sichtbar |
| hard | alle Bänder: radialer Schub `0.4·vBase`, `snapNow`, Doppelkopf 0,12 s (max. 1×/0,25 s) |
| jeder 4. Beat | `link = (link + 1) % 3` |
| jeder 8. Beat | alle `vx → −vx` (Spiegelung der Bewegung) und `setIdx = (setIdx + 1) & 1` per Raster-Wipe |

**Kanäle:** Band `c` ↔ YM-Stimme `c`: Farbe aus `SETS[setIdx][c]`, Geschwindigkeit `× (1 + 0.6·ch(c))`. Ohne `smooth` laufen die Bänder mit Basisgeschwindigkeit.
**Responsive:** sicherer Bereich `m` aus `minDim`, Geschwindigkeit mit `minDim/200`; Porträt (66–92 px Breite) braucht `m ≈ 4–6`, Ultrawide verteilt die Bänder über die volle Breite (Startpositionen deterministisch über das gesamte Rechteck). Auf Widescreen nutzen die Bänder den Raum, sie bleiben nicht in der Mitte.
**Budget:** ≤ 5000 `fillRect`/Frame (im `climax` 3 × 5 Linien × 9 Kopien). Überschreitet die Messung das Budget, `gh` im Climax auf 6, dann 5 senken.
**Zusatztests (`test/atari-line-ribbons.test.mjs`):** alle Ecken bleiben im sicheren Rechteck; Resize Porträt → Querformat → Porträt erhält die relativen Positionen (Toleranz 1 px); Schnappschüsse nur alle 2 Schritte plus `snapNow` bei medium/hard-`beatStarted`; `link` wechselt nur bei `count % 4 === 0`; `nv <= 6`; alle Linien im Buffer.

---

### 5.5 `AtariLaserGrid` — floor

**Vorbild:** Perspektivisches Laser-/Drahtgitter, der klassische Neon-Boden der 80er/90er-Demos, Zeile für Zeile gerechnet. Der Farbwechsel läuft als Raster-Wipe (Timer-B-Palettensplit). Drei Lanen gehören den drei YM-Stimmen.
**Registry:** `.systems('atari').layer('floor').weight(12).duration(15.0).climaxHold(14.0)`

**Aufbau (alles geclippt auf `y >= horizon`)**

1. `H = height − horizon`; Zeile `r = 1..H` ↔ `y = horizon + r − 1`; `p = r/H`; `z = 1/p`. Fluchtpunkt `vx = width/2 + driftX`, `driftX` läuft mit 0,5 s Slew gegen `driftSign·0.05·width`.
2. Basis: `fr(0, horizon, width, H)` in Stufe 0 der Rampe (sehr dunkel).
3. **Horizontale Linien:** `dzLine = 0.4`, Linie `k = 0..9` bei `z_k = 1 + ((k·dzLine − dist) mod (10·dzLine))`, Zeile `r_k = H / z_k`. Gezeichnet wird nur, wenn der Zeilenabstand `H·dzLine / z_k² >= 2` ist; die Dunstzone darüber (≈ obere 23 % des Floors) bekommt stattdessen jede zweite Zeile (`y & 1`) in Stufe 1 (Zeilen-Dither gegen Moiré). Linie `fr(0, y, width, 1)`, Stufe `clamp(1 + floor(p·4), 1, 4)`, im unteren Drittel (`p > 0.66`) 2 px dick.
4. **Vertikale Linien:** `dxB = max(10, round(0.14·min(width, 1.6·height)))·(1 + 0.04·impulse)`, `i ∈ [−N, N]`, `N = ceil((width/2 + |driftX| + dxB)/dxB)`. Je Zeile (kein Bresenham): `x_i(r) = round(vx + i·dxB·p + wob(r)·p)`; zeichnet die Spanne `fr(min(x_prev, x_cur), y, |x_cur − x_prev| + 1, 1)` zur vorigen Zeile, damit steile äußere Linien durchgehend bleiben. `wob(r) = wave·sin(0.22·r − 4·t)·(1 + 0.5·sin(0.07·r))`, `wave = 0` außer im `climax` (`0.06·minDim`) und bei hard (`+0.05·minDim`, klingt in 0,5 s ab). Alle Linien laufen exakt im Fluchtpunkt zusammen.
5. **Lane-Glow** (vor den Linien gezeichnet): Lane 0 = `x < vx − 1.5·dxB·p` (Stimme A), Lane 1 = dazwischen (B), Lane 2 = `x > vx + 1.5·dxB·p` (C). Nur Zeilen mit `(y & 1) == 0` (Scanline-Raster 50 %), `laneLvl = round(ch(v)·3)` (`afterglow` `−1`), Füllung `fr(xa, y, xb − xa, 1)` in Rampenstufe `laneLvl`, wenn `laneLvl >= 1`.
6. **Pulse-Linien** (Pool 4): `zp` startet bei `zFar = 4.2` und läuft mit `3.0·speed` z/s auf `1.0`; Zeile `H/zp`, Stufe 4, 1 px (im unteren Drittel 2 px).
7. **Laser-Sweeps** (nur `ten >= 0.70`): zwei Linien von `(vx, horizon)` mit Winkel `φ = 0.8·sin(0.5·t) ± 0.35` rad (0 = senkrecht nach unten) bis zum Bufferrand, `drawAliasedLineClipped`, Stufe 4.
8. **Raster-Wipe** auf `fam` ab `horizon`, zuletzt `bayerFadeCells(ctx, 0, horizon, width, H, vis)`.

**Familien:** `FAM = [CYN5, VIO5, AMB5, GRN5]` (Cyan, Violett, Bernstein, Grün); `afterglow` erzwingt `BLU5`. **Palette:** je Scanline eine Rampe (5 Farben) plus `INK`: ≤ 6 Farben.

**Tension → Verhalten** (`speed = lerp(0.5, 2.6, ten)` z/s, `dist += speed·(1 + 1.2·impulse)·dt`; der Linienabstand am unteren Rand beträgt ≈ 25 Zeilen (bei `H = 90`: von Zeile 90 auf 64), daher bewegt sich das Gitter, es flackert nicht)

| Zustand / Band | Sichtbares Verhalten |
| --- | --- |
| `starting` | sichtbar sind Zeilen `y < horizon + vis·H`: der Boden wächst vom Horizont nach unten, dazu Bayer-Fade |
| `playing` / low | Scroll 0,5–1,1 z/s, glattes Gitter, Lane-Glow nur durch die Stimmen, keine Pulse-Linien |
| `buildup` / mid | Scroll 1,2–1,9, bis 2 Pulse-Linien, Lane-Glow kräftiger (`laneLvl` bis 3) |
| `climax` / high | Scroll 2,0–2,6, Wellengitter, 2 Laser-Sweeps, bis 4 Pulse-Linien |
| `afterglow` | `speed × 0.3`, Familie `BLU5`, Wellen und Sweeps aus, `laneLvl − 1`, Formation bleibt |
| `stopping` | sichtbare Zeilen `y < horizon + vis·H` (die unteren verschwinden zuerst), danach Bayer-Fade |

**Beat → Verhalten**

| Auslöser | Reaktion |
| --- | --- |
| `impulse` (kontinuierlich) | Scroll-Schub `speed·(1 + 1.2·impulse)`, Rasterweite `dxB × (1 + 0.04·impulse)` |
| soft | die vorderste horizontale Linie 0,1 s in Stufe 4 und 2 px dick (nur diese eine Linie) |
| medium | Pulse-Linie (Pool 4) spawnt, Lane der Stimme mit dem höchsten `ch` `+1` |
| hard | Gitterwelle (`wave += 0.05·minDim`, klingt in 0,5 s ab) und alle Lanen `+1` (max. 1×/0,25 s) |
| jeder 4. Beat | `fam = (fam + 1) & 3` per Raster-Wipe ab dem Horizont |
| jeder 8. Beat | `driftSign = −driftSign`: das Gitter driftet über 0,5 s zur anderen Seite |

**Kanäle:** Lane 0 / 1 / 2 ↔ YM-Stimme A / B / C. Die Lane leuchtet in Rampenstufen mit `ch`, als Scanline-Raster (jede zweite Zeile), damit die Fläche historisch dithert statt zu blenden. Ohne `smooth` bleibt `laneLvl = 0`, Scroll und Gitter laufen aus `t`.
**Responsive:** `dxB` und Laneränder an `min(width, 1.6·height)`; Porträt ≈ 9 vertikale Linien, Ultrawide ≈ 13 plus Randlinien, 3:1 mehr. Die Muster hängen an Welt-, nicht an Bildschirmbreite.
**Budget:** ≤ 2500 `fillRect`/Frame (≈ 90 Zeilen × bis 15 Linienspannen plus Lanen, Pulse, Sweeps).
**Zusatztests (`test/atari-laser-grid.test.mjs`):** keine Operation oberhalb `horizon`; alle vertikalen Linien treffen sich in der ersten Zeile im Fluchtpunkt (±1 px); Pulse-Pool ≤ 4; `wave > 0` nur im `climax` oder kurz nach hard; `fam` wechselt nur bei `count % 4 === 0`, `driftSign` nur bei `count % 8 === 0`; Sweeps nur bei `ten >= 0.70`.

---

### 5.6 `AtariPondRipples` — floor

**Vorbild:** Wasserfläche mit Wellenringen: Tropfen und Beats erzeugen Ringe, die sich in der Perspektive als flache Ellipsen ausbreiten. Acht Blaustufen der 9-Bit-Palette (hier fünf je Familie) mit Zeilen-Dither.
**Registry:** `.systems('atari').layer('floor').weight(12).duration(14.0).climaxHold(12.0)`

**Aufbau (alles geclippt auf `y >= horizon`)**

1. `H`, `p = r/H`, `z = 1/p`, `sx = 0.5·min(width, 1.6·height)`, `wideK = clamp(width / (1.6·height), 1, 1.5)`.
2. **Wasser:** Zeilenstufe `base(r) = clamp(floor(1 + p·2.99), 1, 3)` (fern dunkel, nah heller) aus `WFAM[fam]`, `WFAM = [BLU5, CYN5, VIO5, AMB5]` (Abendrot). An Stufengrenzen alternieren die Zeilen zwischen den beiden Stufen (Zeilen-Dither). Zeilen gleicher Stufe zu einem `fr(0, y, width, h)` verschmelzen (≈ 10 `fillRect`).
3. **Glitzer** (Pool 24): horizontale Striche, 2–6 px lang. Alle 4 Schritte (12,5 Hz) werden `n = 8 + round(16·ten)` Positionen aus dem Xorshift32 neu gewürfelt (Zeile `r = H·(0.2 + 0.8·rnd²)`, nahe Zeilen bevorzugt), Stufe 4 (nah) bzw. 3 (fern), Drift `driftSign·6 px/s`. `afterglow`: `n = 6`.
4. **Ripples** (Pool 12): Weltposition `(xw, zw)`, `age`, `amp ∈ 1..3`, `rings ∈ 1..3`. Schirmposition `p0 = 1/zw`, `xc = width/2 + xw·sx·p0`, `yc = horizon + H/zw`. Weltradius `Rw = age·speed`, `speed = (0.30 + 0.12·amp)·(1 + 0.8·ten)`; Schirmradien `rx = Rw·sx·p0`, `ry = rx·(0.18 + 0.20·p0)`. Ring `j` hat `rx − j·gap`, `gap = max(2, round(0.06·sx·p0))`. Lebensdauer `life = 1.4 + 0.6·amp` s; Stufe `4 − floor(3·age/life)` (hell → dunkel). Zeichnen mit `drawAliasedEllipseOutlineClipped` (Run-Merging, Clip `y >= horizon`); bei `thick = 1 + round(impulse) = 2` zusätzlich eine Ellipse mit `rx − 1`, `ry − 1`. Ripples mit `age >= life` verschwinden aus dem Pool.
5. **Quellen** (Stimmen): `(xw, zw)` = `((c − 1)·0.55·wideK, [2.8, 1.8, 2.8][c])`: A links-fern, B mittig-nah, C rechts-fern.
6. **Tropfen** (ohne Beats lebendig): pro 50-Hz-Schritt Wahrscheinlichkeit `dripP = lerp(0.002, 0.03, ten)` (`afterglow` `× 0.3`), Position `xw = (rnd − 0.5)·1.6·wideK`, `zw = 1.4 + 2.6·rnd`, `amp = 1`.
7. **Sprühstriche** (Pool 12): 2–4 px lange Striche in Stufe 4 an `hash`-Positionen auf dem ersten Ring, Lebensdauer 0,25 s.
8. **Raster-Wipe** auf `fam` ab `horizon`, zuletzt `bayerFadeCells(ctx, 0, horizon, width, H, vis)`.

**Palette:** Wasserrampe (5) plus `INK`: ≤ 6 Farben je Scanline.

**Tension → Verhalten** (`ripMax = ten < 0.35 ? 4 : ten < 0.70 ? 8 : 12`, `rings = ten < 0.35 ? 1 : ten < 0.70 ? 2 : 3`)

| Zustand / Band | Sichtbares Verhalten |
| --- | --- |
| `starting` | das Wasser wächst vom Horizont nach unten (`y < horizon + vis·H`), dazu Bayer-Fade; neue Ripples erst ab `vis >= 0.6` |
| `playing` / low | höchstens 4 Ripples, 1 Ring, Tropfen selten (`dripP ≈ 0,002–0,008`), 8–12 Glitzerstriche |
| `buildup` / mid | höchstens 8 Ripples, 2 Ringe, `dripP ≈ 0,01–0,02`, 16–20 Glitzerstriche |
| `climax` / high | höchstens 12 Ripples, 3 Ringe, `dripP ≈ 0,03`, 24 Glitzerstriche, hellere Ringe |
| `afterglow` | Familie `BLU5`, 1 Ring, `speed × 0.5`, `dripP × 0.3`, 6 Glitzerstriche; bestehende Ripples laufen aus |
| `stopping` | die Wasserfläche zieht sich zum Horizont zurück (`y < horizon + vis·H`), dann Bayer-Fade |

**Beat → Verhalten**

| Auslöser | Reaktion |
| --- | --- |
| `impulse` (kontinuierlich) | Ringdicke `1 + round(impulse)`, Ringstufe `+ round(impulse)` (nur Anzeige) |
| soft | Emission nur an der Quelle mit dem höchsten `ch` (`amp 1`) |
| medium | Emission an allen Quellen mit `ch >= 0.25` (mindestens an der stärksten), `amp = 1 + round(2·ch(c))` |
| hard | wie medium, dazu Doppelring (zweiter Ring 0,12 s verzögert) und 6 Sprühstriche am ersten Ring der stärksten Quelle (max. 1×/0,25 s) |
| jeder 4. Beat | Wasserfamilie `fam = (fam + 1) & 3` per Raster-Wipe ab dem Horizont |
| jeder 8. Beat | Wind: `driftSign = −driftSign`, Ripple-Zentren driften mit `0.06·driftSign` Welteinheiten/s, Glitzer folgen |

**Kanäle:** Quelle `c` ↔ YM-Stimme `c`; Amplitude aus `ch(c)` (die Schwelle `0,25` wird nur im Beat-Ereignis geprüft, nicht pro Frame). Bei Gleichstand gewinnt der niedrigste Index (deterministisch). Ohne `smooth` kommen die Ringe aus Tropfen und Beats.
**Responsive:** `sx` und `wideK` an `min(width, 1.6·height)`; Porträt: Quellen bei ±25 px, Ultrawide: ±130 px, Ringe laufen über die volle Breite und werden am Rand geclippt. Weder Ellipsen noch Glitzer erzeugen Operationen oberhalb des Horizonts.
**Budget:** ≤ 4000 `fillRect`/Frame (12 Ripples × 3 Ringe × ≈ 100 Spannen). Überschreitet die Messung das Budget, `rings` auf 2 begrenzen.
**Zusatztests (`test/atari-pond-ripples.test.mjs`):** keine Operation oberhalb `horizon`; Pool ≤ 12 (Ripples) und ≤ 12 (Sprühstriche); Emission aus Beats nur bei `beatStarted`; Tropfen reproduzierbar (zwei gleiche Läufe → gleiche Ripples); `ry` und `rx` immer endlich; Ellipsenläufe im Buffer; `fam` nur bei `count % 4 === 0`.

---

## 6. Registry-Einträge

Nur ergänzen, bestehende Einträge nicht verändern. Importe oben in `registry.js`, Einträge in den passenden Abschnitten:

```javascript
import { AtariMetaBlobs } from './atari/meta-blobs.js';
import { AtariJuliaCycler } from './atari/julia-cycler.js';
import { AtariFlatShadedTrio } from './atari/flat-shaded-trio.js';
import { AtariLineRibbons } from './atari/line-ribbons.js';
import { AtariLaserGrid } from './atari/laser-grid.js';
import { AtariPondRipples } from './atari/pond-ripples.js';

// --- BACKGROUNDS (Atari) ---
RegisterDSE(AtariMetaBlobs).systems('atari').layer('background').weight(12).duration(13.0).climaxHold(12.0).build(),
RegisterDSE(AtariJuliaCycler).systems('atari').layer('background').weight(11).duration(14.0).climaxHold(12.0).build(),

// --- FLOORS (Atari, bisher keine) ---
RegisterDSE(AtariLaserGrid).systems('atari').layer('floor').weight(12).duration(15.0).climaxHold(14.0).build(),
RegisterDSE(AtariPondRipples).systems('atari').layer('floor').weight(12).duration(14.0).climaxHold(12.0).build(),

// --- FOREGROUNDS (Atari) ---
RegisterDSE(AtariFlatShadedTrio).systems('atari').layer('foreground').weight(12).duration(14.0).climaxHold(14.0).build(),
RegisterDSE(AtariLineRibbons).systems('atari').layer('foreground').weight(11).duration(15.0).climaxHold(12.0).build(),
```

- `maxInstances` bleibt beim Standard `1`. `.exclusive()` darf lokal zum Isolationstest gesetzt werden, **nicht** im Commit.
- Auf dem Atari existiert bisher nur `VoidFloor` im Layer `floor`. Mit zwei neuen Floors (je Gewicht 12) gegen `VoidFloor` (Gewicht 15) erscheint künftig häufiger ein sichtbarer Boden. Im Lieferbericht die resultierende Verteilung nennen und bei Bedarf die Gewichte nachjustieren.
- Prüfen, wie `SetlistManager` mehrere Foreground-Kandidaten behandelt (`AtariDotTorus`, `WireframeMorph`, `AtariBobs`, `Copperbars`, die zwei neuen: eine Instanz je Layer oder je DSE?), und das Ergebnis als Annahme dokumentieren.

## 7. Zusammenspiel und Kontrast (Pflicht-Stills)

Je Kombination Stills in 390×844, 844×390 und 2560×1080, in `climax` und `afterglow`:

| Kombination | Worauf achten |
| --- | --- |
| `AtariMetaBlobs` × `AtariFlatShadedTrio` | beide färben nach Stimme A/B/C (rot/grün/blau in `SETS[0]`): die Körper dürfen in den Blobs nicht verschwinden. `INK`-Kanten müssen tragen, im Zweifel anderes `setIdx` wählen (nur abstimmen, nicht fest verdrahten) |
| `AtariMetaBlobs` × `AtariPondRipples` | Lava-Lampe über Wasser: Horizontfuge und Farbfamilie von Blobs und Wasser |
| `AtariJuliaCycler` × `AtariLineRibbons` | unruhiges Background gegen dünne Linien: `INK`-Schatten und 2-px-Kopf müssen tragen |
| `AtariJuliaCycler` × `AtariLaserGrid` | helles Fraktal über dunklem Raster: Horizont und Gitterkontrast |
| `AtariRetroSunset` × `AtariLaserGrid` / `AtariPondRipples` | Outrun-/Abendrot-Look: Horizont und Familie passen zur Sonne |
| `AtariEnchantedCastle` × `AtariPondRipples` | Burg am Wasser: Burg steht oberhalb des Horizonts, Wasserfamilie passt zur Nachtszene |
| `YmSiliconBg` × `AtariFlatShadedTrio` / `AtariLineRibbons` | beide benutzen drei Stimmen: Farbcodes dürfen sich nicht widersprechen |
| `AtariDotTorus` / `WireframeMorph` / `AtariBobs` × neue Foregrounds | nur prüfen, wenn mehrere Foregrounds gleichzeitig aktiv sein können |
| `Copperbars` × neue Foregrounds | `Copperbars` läuft im Layer `foreground`: auf Überlappung prüfen (nur melden, nicht ändern) |
| jeder Floor × `VoidBackground` / `VoidFloor` | keine Lücken, kein Zeichnen oberhalb des Horizonts |

## 8. Tests

Für jede der sechs Klassen sind alle elf Mindesttests aus den DSE-Entwicklungsregeln §9.1 Pflicht (Smoke, Numerik, Determinismus, Beat, Beat-Intensität, Beat an/aus, Zustände, Rotation, Palette, Viewport, Lifecycle). Dazu die DSE-spezifischen Tests aus §5.

- **Harness:** `makeMetrics(...)`, `runBeatIntensity(...)`, `GRADED_BEAT_STRENGTHS` (`soft 0.20`, `medium 0.50`, `hard 0.90`) aus `tools/dse-baseline/harness.js`. Nicht vorhandene Hilfen minimal selbst ergänzen und als Annahme melden.
- **Fake-Canvas:** strikt wie in §9.1 (Integer, Bounds, Palette, kein `globalAlpha`, `save()`/`clip()`, `getImageData()`, `fillText()`).
- **Palette:** jede `fillStyle` ist ein gültiger 9-Bit-Wert (jeder Kanal ∈ `{0, 36, 72, 108, 144, 180, 216, 252}`, also nie `#ffffff`). Der Fake-Canvas protokolliert die Farbe je Zeile: **höchstens 16 verschiedene Farben je Scanline und DSE**.
- **Beat-Intensität:** Messgröße je DSE, die sich bei soft/medium/hard reproduzierbar und sichtbar unterscheidet:

| DSE | soft | medium | hard | Messgröße |
| --- | --- | --- | --- | --- |
| `AtariMetaBlobs` | `repel 1` | `thMul 0.85` | `pop 1.6`, Level-3-Band `WHITE` | Abstoßungsbetrag, `thMul`, max. Radius, Anzahl `WHITE`-Zellen |
| `AtariJuliaCycler` | `cycleJump +1` | `+2`, `maxIter +4` | `+3`, Konturband `WHITE` | `cycleJump`-Delta, `maxIter`, Anzahl `WHITE`-Zellen |
| `AtariFlatShadedTrio` | Licht `+π/6` | `boom 0.25` (ein Körper) | `boom 0.30` (alle), Stufe 4 | Lichtwinkel-Delta, `boom`, Anzahl Stufe-4-Flächen |
| `AtariLineRibbons` | Nudge `0.15·vBase` | `snapNow`, Schub `0.25·vBase` | Schub `0.4·vBase`, Doppelkopf | Geschwindigkeits-Delta, Snapshot-Anzahl, Kopfdicke |
| `AtariLaserGrid` | vorderste Linie Stufe 4 | Pulse-Linie, Lane `+1` | Gitterwelle, alle Lanen `+1` | Anzahl Stufe-4-Zeilen, Pulse-Pool, `wave` |
| `AtariPondRipples` | 1 Ripple | bis 3 Ripples | 3 Ripples, Doppelring, Sprühstriche | Ripple-Anzahl, Ringzahl, Sprühstriche |

```sh
node --test \
  test/atari-meta-blobs.test.mjs \
  test/atari-julia-cycler.test.mjs \
  test/atari-flat-shaded-trio.test.mjs \
  test/atari-line-ribbons.test.mjs \
  test/atari-laser-grid.test.mjs \
  test/atari-pond-ripples.test.mjs
```

Zusätzlich die bestehenden Suites laufen lassen, die Registry, Stage und Layer betreffen (`test/dj-engine-lifecycle.test.mjs`, `test/scene-dj-integration.test.mjs`, `test/graded-beat-routing.test.mjs`) sowie die vorhandenen Atari-Suites (`test/ym-silicon-bg.test.mjs`, `test/atari-enchanted-castle.test.mjs`, `test/atari-retro-sunset.test.mjs`, `test/atari-dot-torus.test.mjs`, `test/atari-bobs.test.mjs`, `test/atari-wireframe-morph.test.mjs`).

## 9. Abnahme und Lieferbericht

**Messung:** je DSE `fillRect`-Anzahl und Renderzeit (p50/p95 über 600 Frames) in 390×844, 844×390 und 2560×1080 im Zustand `climax`; Werte mit den Budgets aus §5 vergleichen (MetaBlobs ≤ 2500, JuliaCycler ≤ 3000, FlatShadedTrio ≤ 6000, LineRibbons ≤ 5000, LaserGrid ≤ 2500, PondRipples ≤ 4000). Überschreitungen mit Qualitätsreduktion lösen (Zellgröße, `maxIter`, Ghost-Zahl, Ringzahl, Kantenpass), Palette und Determinismus bleiben unverändert. `AtariJuliaCycler` (Iterationen), `AtariFlatShadedTrio` und `AtariLineRibbons` (Linien) sind die Kandidaten für Performance-Probleme auf Mobile.

**Visuelle Nachweise** (Harness oder gleichwertig): Zustandsübersicht inkl. `afterglow`, Porträt/Querformat/Ultrawide, 1:3 und 3:1, Rotationsfilmstrip mit derselben Instanz (bei `AtariLineRibbons` zusätzlich mit sichtbarer Positionserhaltung), Motion-Clips für `playing`/`buildup`/`climax`/`afterglow`, je ein Clip mit soft, medium und hard, ein Clip mit Raster-Wipe (Familienwechsel), Kombinations-Stills aus §7.

**Reale App** (DSE-Modus): Trackstart, Presenter-Verhalten, Fenster vergrößern/verkleinern, Vollbild, Mobile-Ausrichtung wechseln, Trackwechsel, `image-rendering: pixelated`, Konsole ohne neue Fehler.

**Lieferbericht (Pflicht):**

1. Neue und geänderte Dateien (inkl. `registry.js`, `hardware-constraints.js`, `atari-kit.js`, Tests).
2. **Annahmen**, mindestens: `smooth[0..2]` = YM A/B/C; reale Dauer von `starting`/`stopping`; Existenz von `bayerFadeCells` und der geclippten Helfer oder Extraktion; Layer-Instanzmodell; Fallback bei fehlendem `beatLevel`; `st()` liefert exakt die Werte von `quantizeAtari9Bit`.
3. **Zeilentabelle der Raster-Wipes** je DSE (welche Palette gilt in welchen Zeilen, wie lange).
4. Messtabelle (§9 Messung).
5. Offene Punkte, Abweichungen von diesem Prompt mit Begründung.
6. Commit-Vorschläge im Conventional-Commit-Format, z. B. `feat(dse/atari): add laser grid and pond ripples floors`, `feat(dse/atari): add meta blobs and julia cycler backgrounds`, `feat(dse/atari): add flat shaded trio and line ribbons foregrounds`, `chore(visuals): add atari-kit, ellipse and clipped line helpers`.

**Zusätzliche Definition of Done (zu §11 der DSE-Regeln):**

- [ ] Alle sechs DSEs nutzen den Beat-Zustand aus §2 und lesen `beat[0]` nie als Trigger.
- [ ] hard-Sonderereignisse sind auf 1× je 0,25 s begrenzt; kein flächiger Hochkontrast-Blitz; Palettenzyklen laufen mit höchstens 6 Schritten/s.
- [ ] Höchstens 16 Farben je Scanline und DSE; Weiß nur als `#fcfcfc`; Farbmärsche nur über Ping-Pong-Folgen.
- [ ] Raster-Wipes teilen Rechtecke an `wipeY` und lassen jede Scanline bei einer Palette.
- [ ] Floors schreiben nachweislich nichts oberhalb `horizon`; Foregrounds blenden nie mit Schwarz-Vollbild-Dither.
- [ ] Ausblenden endet bei `vis = 0` vollständig (opake Layer warten darauf).
- [ ] Ohne Audio und ohne `smooth`/`beatImpulse` rendert jede DSE lebendig und fehlerfrei.

## 10. Empfohlene Implementierungsreihenfolge

1. **Helfer** in `hardware-constraints.js` (§4) und `atari-kit.js`, mit eigenen Tests (Ellipse und geclippte Linien zuerst).
2. **Floors zuerst:** `AtariLaserGrid`, dann `AtariPondRipples`. Sie schließen die Lücke am schnellsten und lassen sich gegen die vorhandenen Atari-Backgrounds prüfen.
3. **Backgrounds:** `AtariMetaBlobs`, zuletzt `AtariJuliaCycler` wegen der Rechenzeit-Messung.
4. **Foregrounds:** `AtariLineRibbons` (einfach, Resize-Mapping), dann `AtariFlatShadedTrio` (Meshes, Sortierung, Kantenpass).
5. **Registry** je DSE einzeln aktivieren (lokal `.exclusive()`, vor dem Commit entfernen), danach Kombinationen aus §7.
6. **Reale App** testen, Lieferbericht schreiben.

Liefere nur neue oder geänderte Dateien.
