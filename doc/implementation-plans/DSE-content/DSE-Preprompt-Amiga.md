# Pre-Prompt: DSE-Paket Amiga — 6 neue Demo Scene Elements für Chiptunes Fantasy

## 0. Auftrag

Du bist ein erfahrener Amiga-Demoscener und JavaScript-Entwickler. Implementiere sechs neue DSEs für das System **Amiga** (OCS/ECS, Copper, Blitter, Paula mit 4 Kanälen), je zwei für die Layer `background`, `foreground` und `floor`.

Verbindliche Referenzen, die diesem Prompt beiliegen: **DSE-Entwicklungsregeln**, `js/visuals/dse/registry.js`, `js/visuals/utils/hardware-constraints.js`. Dieser Prompt ergänzt sie und hebt keine Regel auf. Bei Konflikt gelten die DSE-Entwicklungsregeln. Dateien, die nicht beiliegen (Test-Harness, `paula-silicon-bg.js`, Font-Module), nicht raten: eigenständig implementieren oder nachlesen und im Lieferbericht als **Annahme** auflisten.

| Layer | DSE (Klasse) | Datei unter `js/visuals/dse/amiga/` |
| --- | --- | --- |
| background | `AmigaRotoZoomer` | `rotozoomer.js` |
| background | `AmigaTechTech` | `tech-tech.js` |
| foreground | `AmigaTwister` | `twister.js` |
| foreground | `AmigaVectorBalls` | `vector-balls.js` |
| floor | `AmigaVoxelHills` | `voxel-hills.js` |
| floor | `AmigaParallaxGround` | `parallax-ground.js` |

Bereits vorhanden (nicht duplizieren): `AmigaRetroSunset`, `AmigaCastleFireworks`, `PaulaSiliconBg` (background), `KefrensCheckerboard` (floor), `AmigaCube`, `AmigaBoingBall` (foreground). Die neuen DSEs sind bewusst anders gebaut: Rotation und Zeilenversatz statt Landschaft, Raster-Körper und Vector Balls statt Glenz und Boing, Voxel- und Parallax-Boden statt Schachbrett.

## 1. Nicht verhandelbar (Kurzfassung der DSE-Regeln)

- Signatur `render(ctx, width, height, t, state, stateTime, metrics)`; `ctx` = niedrig aufgelöster Retro-Buffer; optional `resize(width, height)`. Größenwechsel auch erst im nächsten `render()` korrekt behandeln, **dieselbe Instanz**, Simulationszustand erhalten, größenabhängige Caches neu bauen, Objekte auf den neuen Sichtbereich abbilden.
- Eingangsschutz am Anfang von `render()`: `width <= 0 || height <= 0 || !Number.isFinite(width / height)` → `this.lastT = t; return;`. `dt` aus `t` ableiten, auf max. `0.1 s` begrenzen (erster Frame: `0.02`). Keine Division durch `0`.
- **PAL-Tick-Caching (50 Hz):** Bewegung rein zeitbasiert. Exakte Beat-Events niemals als Pegel lesen.
- **Ohne Audio lebendig:** Grundbewegung aus `t`, `energy`, `smooth[c]`. Beats sind nur Akzent. Fehlende Metriken → endliche Fallbacks (`0`).
- **Diskrete Wechsel** (Muster, Palette, Richtung, Modus) **nur** bei `metrics.beatStarted` (mit `beatCount`). Kontinuierliche Ausschläge nur über `beatImpulse[0]` (Fallback: begrenztes `beat[0]`). `beat[0] > x` ist als Trigger verboten.
- **Retro-Stil:** Höhe laut `SYSTEM_RESOLUTIONS.amiga = 256`, Breite dynamisch. 12-Bit-RGB. Farbtabellen als **3-stellige Hex-Strings** (`#rgb` = Nibble × 17, exakt das Ergebnis von `quantizeAmiga12Bit`). Berechnete Farben immer durch `quantizeAmiga12Bit` + `rgbToHex`. **Farbbudget:** bewusste OCS-Subpalette von höchstens 32 Einträgen je DSE (5 Bitplanes) plus dokumentierte Copper-Zeilenwechsel; keine willkürlichen Echtfarb-Verläufe.
- Nur ganzzahlige opake `fillRect`; kein `globalAlpha`, `arc`, `lineTo`-Konturen, Schatten, Filter, Gradienten, `fillText`, `measureText`, `getImageData`.
- Linien, Kreise und Polygone nur über Bresenham-/Scanline-Helfer oder vorberechnete Run-Templates. Die Helfer **clippen nicht**: jedes Primitiv hart auf `[0..width]×[0..height]` begrenzen (Floors zusätzlich auf `y >= horizon`).
- **Layer-Regeln:** `background` darf vollflächig mit Bayer-Dither aus Schwarz ein-/ausblenden. `floor` nur **unterhalb** `horizon = Math.floor(height * 0.55)`; Bereich `0 .. horizon-1` bleibt unberührt. `foreground` blendet **nie** per Schwarz-Vollbild-Dither, sondern über Geometrie, Objektzahl oder Schrittsichtbarkeit.
- **Kontrast-Vertrag:** Foreground-Formen brauchen dunkle Outline oder klare Rampen-Kontraste, auch vor hellen Backgrounds.
- Kein `Math.random()`. Instanzeigener **Xorshift32** mit festem Seed. Feste Pools. Keine Allokation im Renderloop. Resize allokiert gezielt neu.
- **Strobe-Schutz:** Beat-Akzente betreffen max. ca. 25 % der Bildfläche und max. 2 Rampenstufen. Keine Schwarz↔Weiß-Flächenwechsel im Beat-Takt (bis ca. 6,7 Beats/s möglich).
- Kein DOM in DSEs: nativen Bayer-Zellen-Fade nutzen (siehe §4), nicht `applyOrderedDitherFade`.
- Jedes Modul exportiert nur seine Klasse und importiert `registry.js` **nicht**.
- Buffergrößen zur Orientierung (Höhe 256): 390×844 → 118×256, 844×390 → 554×256, 1920×1080 → 455×256, 2560×1080 → 606×256, 3:1 → 768×256, 1:3 → 85×256.

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

// Paula-Kanal c = 0..3, defensiv (fehlender Kanal = 0, keine Phantomenergie)
const ch = c => clamp01(metrics?.smooth?.[c] ?? 0);

// eigener Zustandszaehler (stateTime wird nicht zuverlaessig zurueckgesetzt)
if (this.lastState !== state) { this.lastState = state; this.stateAge = 0; } else this.stateAge += dt;
```

- **Kanalreihenfolge:** Paula-Panning ist L-R-R-L (Kanäle 0 und 3 links, 1 und 2 rechts). Layouts, die Kanäle von links nach rechts anordnen, nutzen die Reihenfolge **0, 1, 2, 3** wie `paula-silicon-bg.js`. Diese Datei nachlesen und bei Abweichung ihre Zuordnung übernehmen.
- **Simulationen** (Pools, Partikel) laufen mit festem 50-Hz-Schritt: `acc += dt; let n = 0; while (acc >= 0.02 && n++ < 4) { step(); acc -= 0.02; }`.
- **Tension-Bänder:** *low* = `ten < 0.35` (≙ `playing`), *mid* = `0.35–0.70` (≙ `buildup`), *high* = `> 0.70` (≙ `climax`). `afterglow` ist ein eigener Zustand mit gekühlter Palette. Strukturgrößen (Ballzahl, Twister-Anzahl, Bänder) nur per **Index-Aktivierung** in festen Pools ändern, nie per Re-Seed.
- **Beat-Stufen** (identisch zu `getBeatLevel`):

| Stufe | `beatLevel` | `beatStrength` | Rolle in diesem Paket |
| --- | ---: | --- | --- |
| soft | 1 | `> 0` und `< 1/3` | Mikro-Nudge, kleinster diskreter Schritt |
| medium | 2 | `1/3` bis `< 2/3` | Nudge + Form- oder Palettenschritt |
| hard | 3 | `>= 2/3` | Nudge + lokales Sonderereignis (max. 1 pro 0,25 s je DSE) |
| jeder 4. Beat | `count > 0 && count % 4 === 0` | | Muster-/Themen-/Modusfamilie |
| jeder 8. Beat | `count > 0 && count % 8 === 0` | | Richtungs-, Achsen- oder Palettenwechsel |

- **Afterglow-Regel:** letzte Formation und Objektpositionen übernehmen, Geschwindigkeit ca. ×0,3, Palette auf kühle Rampen, Rückkehr der Palette per Wipe. Kein Re-Seed, kein harter Szenenwechsel.
- **Warteregel für Strukturwechsel:** ein pendender Wechsel (z. B. Kaleidoskop-Stufe nach Tension-Band-Wechsel) wird beim nächsten `beatStarted` übernommen, spätestens nach 1,2 s ohne Beat (Tracks ohne Perkussion).

## 3. Amiga-Hardware-Fingerabdruck

- **Denise/Agnus (OCS/ECS):** 12-Bit-Palette (4096 Farben), in Lores bis 32 Farben (5 Bitplanes), dazu EHB (64) und HAM; hier gilt die 32-Farben-Subpalette.
- **Copper:** schreibt Register pro Rasterzeile: Hintergrundverläufe (`COLOR00`), Palettenwechsel mitten im Bild, `BPLCON1` für horizontalen Zeilenversatz (Tech-Tech, echte Reichweite ±15 px).
- **Blitter:** Bobs (maskierte Sprites), Linien, Füllungen. **Hardware-Sprites:** 8 Stück, 16 px breit, 3 Farben.
- **Paula:** 4 DMA-Kanäle, 8-Bit-Samples, Panning L-R-R-L. `smooth[0..3]`.
- **PAL:** 50 Hz, 256 Zeilen. Typische Tricks: Copper-Gradienten, Kefrens-Balken, Rotozoomer (4×4-Chunky), Twister, Vector Balls, Voxel-Landschaft, Dual-Playfield-Parallax.
- **Rampen** (dunkel → hell, je 6 Stufen, `#rgb` = exakte 12-Bit-Werte):

| Rampe | Stufen 0 … 5 |
| --- | --- |
| `MAGMA` | `#200 #501 #a12 #e42 #f93 #fd7` |
| `OCEAN` | `#003 #016 #05a #28d #5bf #aef` |
| `JADE` | `#021 #043 #076 #1a8 #4db #9fd` |
| `VIOLET` | `#102 #313 #626 #94a #c7d #ecf` |
| `GOLD` | `#210 #430 #760 #a90 #dc2 #ff8` |
| `STEEL` | `#112 #223 #445 #668 #99a #cce` |

Dazu `INK = '#000'` (Outline, Fuge) und `SNOW = '#fff'` (seltene Highlights). **Zwischentöne nur per Dither** (2×2-Bayer oder Zeilen-/Spalten-Checker) zwischen zwei Rampenstufen, kein Mischen.

## 4. Empfohlene Erweiterungen

Nur anlegen, wenn nicht schon im Repo vorhanden (die Pakete für C64, Amiga und Atari können parallel entstehen: gemeinsame Helfer **nur einmal** in `hardware-constraints.js` anlegen, vorher prüfen, ob ein anderes Paket sie schon geliefert hat). Existiert ein nativer Bayer-Fade in `KefrensCheckerboard` oder `PaulaSiliconBg`, **extrahieren statt neu schreiben**. Reine Zusätze, keine Änderung bestehender Exporte.

- `createXorshift32(seed)` → `{ next(), float(), int(n), reset(seed) }`.
- `bayerFadeCells(ctx, x, y, w, h, visibility, cell = 2, color = '#000000')`: DOM-freier 4×4-Bayer-Fade aus `fillRect`-Zellen mit horizontalem Run-Merging, hart auf die Region geclippt, max. ca. 4000 `fillRect` je Aufruf.
- `fillAliasedPolygonClipped(...)` und `drawAliasedLineClipped(...)`: wie die vorhandenen Helfer, aber mit Clip-Rechteck als letztem Parameter.
- **Neu, nur Amiga:** `js/visuals/dse/amiga/amiga-kit.js` (kein DSE, exportiert nur unveränderliche Daten): `RAMPS` (§3), `INK`, `SNOW`, `pp(L)`, `PP6 = pp(6)`. Es darf von allen sechs Modulen importiert werden. Existieren in den vorhandenen Amiga-DSEs schon gleichwertige Tabellen, diese wiederverwenden.

## 5. DSE-Spezifikationen

### 5.0 Gemeinsame Bausteine (in allen sechs DSEs gleich umsetzen)

- **Ping-Pong-Indexfolge** `pp(L) = [0, 1, …, L-1, L-2, …, 1]`, `PP6 = [0,1,2,3,4,5,4,3,2,1]`. Jeder Farbmarsch (Rampenzyklus) läuft über `PP6`: die mittlere Luminanz bleibt konstant, ein Beat verschiebt nur Bänder und lässt nie die Fläche blitzen.
- **Einzelrampen-Familien:** `FAM = [OCEAN, MAGMA, JADE, VIOLET]`, Index `fam`. **Kanal-Sets** (pro Paula-Kanal eine Rampe): `CH_RAMPS = [MAGMA, OCEAN, JADE, GOLD]`, Kanal `c` nutzt `CH_RAMPS[(c + rot) & 3]`. `afterglow` erzwingt `STEEL` (Einzelrampe) bzw. `COOL = [OCEAN, STEEL, OCEAN, STEEL]` (Kanal-Sets). `fam`, `rot` ändern sich nur durch die 4.-/8.-Beat-Regel des jeweiligen DSE oder beim Verlassen von `afterglow` (dann per Wipe).
- **Wipe statt Blitz:** `setFamily(next)` merkt `wipeFrom`, `wipeTo`, `wipeT0 = t`. Jedes Element hat eine Koordinate `q ∈ [0..1]` (Definition je DSE, `0` = zuerst betroffen) und nimmt die neue Familie, sobald `q <= clamp01((t - wipeT0) / 0.6)`. Während eines Wipes dürfen zwei Rampen gleichzeitig vorkommen (Budget 32 Farben beachten).
- **Sichtbarkeit `vis`:** `starting` → `clamp01(stateTime / T_IN)`; `stopping` → `1 - clamp01(stateTime / T_OUT)`; sonst `1`. Startwerte `T_IN = T_OUT = 1.0 s` (background/floor) bzw. `0.8 s` (foreground). **In `stage-manager.js` nachlesen, wie lange `starting`/`stopping` real dauern, Konstanten angleichen, Ergebnis im Lieferbericht als Annahme melden.** Auf opaken Layern (`background`, `floor`) wartet der Nachfolger auf das Ende von `stopping`: das Ausblenden MUSS bei `vis = 0` vollständig enden und danach nichts mehr zeichnen.
- **Clip-Helfer (privat im Modul):** `fr(x, y, w, h)` rundet auf Integer, schneidet auf `[0..width]×[yMin..height]` zu (`yMin = horizon` bei Floors, sonst `0`) und verwirft `w <= 0 || h <= 0`. Jede Zeichenoperation läuft durch ihn.
- **Horizont:** `const horizon = Math.floor(height * 0.55)`. Floors schreiben nur `y >= horizon`; Backgrounds legen ihr Hauptmotiv oberhalb ab.
- **Fade:** `bayerFadeCells(ctx, x, y, w, h, vis)` aus §4, **nur** bei `background` und (unterhalb `horizon`) `floor`. Bei `vis >= 1` nicht aufrufen.
- **Beat-Limits:** hard-Sonderereignisse max. 1 pro 0,25 s je DSE (`this.hardCooldown -= dt`).
- **Idle:** `state === 'idle'` → sofort `return`, keine Simulation.
- **Seitenverhältnis:** `aspect = width / height`. Alles, was Breite braucht, leitet sich aus `width`, alles Skalierte aus `minDim = Math.min(width, height)` ab (im Porträt ist `minDim = width`, sonst `height`).

---

### 5.1 `AmigaRotoZoomer` — background

**Vorbild:** Rotozoomer: eine kachelnde Textur rotiert und zoomt, gerechnet in groben Chunky-Zellen (wie die 4×4-Chunky-Routinen), 6-stufige Rampe, Copper-Vignette.
**Registry:** `.systems('amiga').layer('background').weight(12).duration(14.0).climaxHold(12.0)`

**Aufbau**

1. **Texturen** `T0..T3`: je `Uint8Array(64·64)` mit Stufen `0..5`, im Konstruktor deterministisch erzeugt. `fu = abs(((u + 32) & 63) − 32)`, `fv` analog (nahtlose Dreieckswelle 0..32).
   - `T0` Diamanten: `((fu + fv) >> 2) % 6`.
   - `T1` Schachbrett mit Fase: `base = ((u >> 4) ^ (v >> 4)) & 1 ? 4 : 1`; Kantenpixel `(u & 15) == 0 || (v & 15) == 0` → `base + 1`, `(u & 15) == 15 || (v & 15) == 15` → `base − 1`.
   - `T2` Ziegel: Reihen zu 8 Zeilen, Ziegel 16 breit, ungerade Reihen um 8 versetzt, Mörtel (1 px Rand) Stufe 0, Ziegelstufe `2 + ((id·5) % 3)`.
   - `T3` Interferenz: `clamp(floor(3 + 2.5·sin(2π·2u/64) + 2.5·sin(2π·3v/64)), 0, 5)`.
2. **Zellraster:** `cell = max(3, ceil(sqrt(width·height / 6000)))` (≤ 6000 Zellen). Pro Zelle (Mitte `px, py`) einmal direkt rechnen, kein inkrementelles Abtasten (Kaleidoskop-Faltung bricht es).
3. **Abbildung:** `Z = zoomBase · snap · (1 + 0.35·impulse) · (1 + 3·(1 − vis))`, `zoomBase = 1 + 0.35·sin(0.55 t)`, `sc = 64 / (0.42·minDim) / Z` Texel je px, `θeff = θ + 0.18·impulse·dir`:
   `u = ((px − cx)·cosθeff − (py − cy)·sinθeff)·sc + ou`, `v = ((px − cx)·sinθeff + (py − cy)·cosθeff)·sc + ov`.
   Kaleidoskop faltet vor der Rechnung `px → cx + |px − cx|` (kMode ≥ 1) und `py → cy + |py − cy|` (kMode 2). Texel `T[((v|0) & 63) << 6 | ((u|0) & 63)]`.
4. **Farbstufe:** `idx = PP6[(texel + shift) % 10] + zoneBias(x) − vignette(y)`, geklemmt auf `0..5`. Copper-Vignette: `vignette = 1` in den äußeren 12 % oben und unten (in `afterglow` `2` dort und `1` in den äußeren 25 %).
5. **Zeichnen:** je Zellzeile Läufe gleicher Stufe zu einem `fr(x0·cell, y·cell, run·cell, cell)` verschmelzen. Farbe `RAMPS[FAM[fam]][idx]`.
6. **Wipes** (vertikale Kante, läuft in 0,5 s von links nach rechts, Zellen mit `x·cell <= wipeX` nutzen den neuen Wert): Textur (4. Beat), Kaleidoskop-Stufe (pending, siehe §2), Familie (8. Beat). Keine Alpha-Überblendung.
7. Zuletzt `bayerFadeCells(ctx, 0, 0, width, height, vis)`.

**Tension → Verhalten** (`ω = lerp(0.25, 1.4, ten)·rotSign` rad/s, `rotSign` mit 0,25 s Slew; `drift = lerp(6, 40, ten)` Texel/s in Richtung `0.7·t`; `kTarget = ten < 0.35 ? 0 : ten < 0.70 ? 1 : 2`, Hysterese ±0.05, Übernahme per pending-Regel)

| Zustand / Band | Sichtbares Verhalten |
| --- | --- |
| `starting` | `Z` startet bei 4× und fährt auf 1× (die Textur zoomt aus der Nähe heraus), dazu Bayer-Fade |
| `playing` / low | langsame Drehung (≈ 0,25–0,6 rad/s), eine Textur, kein Spiegel (`kMode 0`) |
| `buildup` / mid | schnellere Drehung (≈ 0,7–1,0), horizontale Spiegelsymmetrie (`kMode 1`) |
| `climax` / high | ≈ 1,1–1,4 rad/s, 4-fach-Kaleidoskop (`kMode 2`), größte Zoom-Amplitude |
| `afterglow` | `ω × 0.3`, Familie `STEEL`, `kMode 0` (Übernahme sofort per Wipe), stärkere Vignette, Formation (`θ`, `ou`, `ov`) bleibt |
| `stopping` | `Z` zoomt wieder auf 4× heraus, Bayer-Fade bis Schwarz |

**Beat → Verhalten**

| Auslöser | Reaktion |
| --- | --- |
| `impulse` (kontinuierlich) | Zoom-Kick `Z × (1 + 0.35·impulse)`, Winkel-Versatz `0.18·impulse·dir` (Offset, nicht integriert) |
| soft | `shift += 1` (Farbmarsch um eine Stufe) |
| medium | `shift += 2`, Kupferband: Zeilenband von 8 % Höhe bei `hash(count)`, `+2` Stufen für 0,15 s |
| hard | `shift += 3`, Zoom-Snap (`snap = 1.25`, Abklingen τ 0,2 s), Kupferband 12 % Höhe `+2` Stufen 0,12 s (max. 1×/0,25 s) |
| jeder 4. Beat | `tex = (tex + 1) & 3` per vertikalem Wipe |
| jeder 8. Beat | `rotSign = −rotSign` und `setFamily((fam + 1) % 4)`, Wipe-Koordinate `q = x/width` |

**Kanäle:** vier vertikale Zonen in Kanalreihenfolge 0, 1, 2, 3 von links nach rechts (Bildschirmkoordinaten, **nicht** nach der Kaleidoskop-Faltung): `zoneBias = round(ch(zone)·2)` Stufen heller. Ohne `smooth`: `zoneBias = 0`, Drehung und Zoom laufen aus `t`.
**Responsive:** Rotationszentrum ist die Bildmitte; `sc` hängt an `minDim` (ca. 2,4 Texturkacheln je `minDim`), Ultrawide zeigt mehr Kacheln statt gestreckter. Zellgröße steigt automatisch, damit die Zellzahl ≤ 6000 bleibt.
**Budget:** ≤ 6000 Zellen, typisch ≤ 3500 `fillRect` nach Run-Merging. Palette: eine Rampe (6) plus zweite während eines Wipes, `INK` unbenutzt, ≤ 12 Farben.
**Zusatztests (`test/amiga-rotozoomer.test.mjs`):** Zellzahl ≤ 6000 in allen Viewports; Texturwechsel nur bei `count % 4 === 0`; `kMode` ändert sich nur bei `beatStarted` oder nach 1,2 s ohne Beat; alle Stufen in `0..5`; Rotation Porträt → Querformat behält `θ`, `ou`, `ov`.

---

### 5.2 `AmigaTechTech` — background

**Vorbild:** Tech-Tech: der Copper schreibt `BPLCON1` pro Rasterzeile und verschiebt so jede Zeile eines Bildes horizontal. Eine Wand aus Mustern wellt wie ein Vorhang im Wind.
**Registry:** `.systems('amiga').layer('background').weight(12).duration(13.0).climaxHold(12.0)`

**Aufbau**

1. **Zeilen:** `rowH = 2` px (Copper-Zeilenpaare), bei `aspect > 2.2` `rowH = 3`. `nRows = ceil(height / rowH)`.
2. **Muster** `pat 0..3` über `ts = max(16, round(0.14·minDim))`, jeweils als Funktion, die für eine Zeile die Läufe `(start, len, stufe)` einer Periode in einen vorreservierten `Int16Array` schreibt (keine Allokation):
   - `P0` Schachbrett: Kacheln `ts` breit, Stufen 2/4, Reihenparität `((yTile + xTile) & 1)`.
   - `P1` Vorhang: Periode `ts`, Läufe `[0, 0.15)` Stufe 5, `[0.15, 0.60)` Stufe 3, `[0.60, 1.0)` Stufe 1.
   - `P2` Rauten: `dy = abs((y mod ts) − ts/2)`, Raute Stufe 4 mit Halbbreite `ts/2 − dy` um die Kachelmitte, sonst Stufe 2.
   - `P3` Ziegel: Reihenhöhe `ts/3`, Ziegelbreite `1.5·ts`, ungerade Reihen um die halbe Breite versetzt, Mörtel (1 px) Stufe 0, Ziegelstufe `2 + ((id·7) % 3)`.
3. **Versatz je Zeile:** `dx(y) = a(y)·(sin(2π·y/λ1 + φ1) + h2·sin(2π·y/λ2 − φ2) + h3·sin(2π·y/λ3 + 1.7·φ1))`, `λ1 = 0.55·height`, `λ2 = 0.23·height`, `λ3 = 0.11·height`, `h2 = ten >= 0.35 ? 0.45 : 0`, `h3 = ten >= 0.70 ? 0.25 : 0`. Phasen `φ1 += (0.6 + 1.4·ten)·dt·phiSign`, `φ2 = 1.3·φ1` (Gegenlauf). Amplitude `a(y) = Abase·(0.6 + 0.8·zoneCh(y))·(1 + 1.2·impulse)·vis`, `Abase = lerp(0.03, 0.12, ten)·minDim`, `|dx| <= 0.2·minDim`. Bis ca. 15 px entspricht das dem echten `BPLCON1`; darüber gilt der Blitter-Shift-Trick, das ist erlaubt.
4. **Zeichnen:** Läufe um `dx` verschoben, über die Breite wiederholt (`start + k·ts` bzw. Periodenlänge), über `fr` geclippt. Farbe `RAMPS[FAM[fam]][clamp(PP6[(stufe + shift) % 10] − copperDim(y), 0, 5)]`, `copperDim = 1` in den äußeren 12 % (Copper-Verlauf).
5. **Shockwave-Band** (hard): 6 Zeilen hoch, läuft mit 300 Zeilen/s von oben nach unten, darin `+2` Stufen und doppelte Amplitude.
6. **Wipe:** Mustertausch per Zeilen-Wipe (`y < wipeY` nutzt das neue Muster, `wipeY` läuft in 0,5 s von oben nach unten).
7. Zuletzt `bayerFadeCells(ctx, 0, 0, width, height, vis)`.

**Tension → Verhalten**

| Zustand / Band | Sichtbares Verhalten |
| --- | --- |
| `starting` | Bayer-Fade, Amplitude `· vis`: die Wand erscheint zuerst gerade |
| `playing` / low | `Abase ≈ 0,03–0,06·minDim`, nur Grundwelle, Phasenlauf ≈ 0,9 rad/s |
| `buildup` / mid | `Abase ≈ 0,07–0,09·minDim`, zweite Harmonische im Gegenlauf, Phasenlauf ≈ 1,6 rad/s |
| `climax` / high | `Abase ≈ 0,10–0,12·minDim`, dritte Harmonische, sich kreuzende Wellen |
| `afterglow` | Amplitude `× 0.3`, Familie `STEEL`, Muster bleibt stehen, `copperDim` +1 |
| `stopping` | Amplitude `· vis`, Bayer-Fade bis Schwarz |

**Beat → Verhalten**

| Auslöser | Reaktion |
| --- | --- |
| `impulse` (kontinuierlich) | `a × (1 + 1.2·impulse)`, Phase `+ 0.25·impulse·dir` (Offset) |
| soft | `φ1 += 0.4` (die Wand „zuckt“ seitlich) |
| medium | `φ1 += 0.4`, `shift += 1`, Amplitude der Zone mit dem höchsten `ch` 0,2 s `× 1.5` |
| hard | Shockwave-Band (siehe Aufbau 5) und `shift += 2`; max. 1×/0,25 s |
| jeder 4. Beat | `pat = (pat + 1) & 3` per Zeilen-Wipe |
| jeder 8. Beat | `phiSign = −phiSign` und `setFamily((fam + 1) % 4)`, Wipe-Koordinate `q = y/height` |

**Kanäle:** vier horizontale Zeilenzonen von oben nach unten (Kanäle 0–3). `zoneCh(y)` interpoliert linear zwischen den Ankern `[1/8, 3/8, 5/8, 7/8]·height` mit `ch(0..3)`; die Wellenamplitude einer Zone wächst mit „ihrem“ Paula-Kanal. Ohne `smooth` gilt `zoneCh = 0`, die Welle läuft aus `t`.
**Responsive:** `ts` hängt an `minDim` (Porträt 16 px, Querformat ≈ 36 px), Wellenlängen an `height`. Ultrawide und 3:1 bekommen mehr Läufe je Zeile, dann `rowH = 3`. Bei Porträt ist die Breite klein, `dx`-Wrap muss über die Musterperiode laufen, nicht über die Breite.
**Budget:** ≤ 6000 `fillRect`/Frame (≈ 128 Zeilen × ≤ 40 Läufe). Palette: eine Rampe, bei Wipe zwei, `INK` für Mörtel: ≤ 13 Farben.
**Zusatztests (`test/amiga-tech-tech.test.mjs`):** `|dx|` bleibt `<= 0.2·minDim`; Musterwechsel nur bei `count % 4 === 0`; `rowH` wird bei Ultrawide automatisch 3; keine Läufe mit negativer Länge nach Wrap; Zonenamplitude steigt monoton mit `ch` (isolierte Eingabe `ch(2) = 1`, andere `0`).

---

### 5.3 `AmigaTwister` — foreground

**Vorbild:** Twister: ein vierseitiger Balken, dessen Drehwinkel sich entlang der Y-Achse ändert, Zeile für Zeile gerechnet. Die vier Flächen gehören den vier Paula-Kanälen: jede Fläche leuchtet mit „ihrem“ Kanal.
**Registry:** `.systems('amiga').layer('foreground').weight(12).duration(14.0).climaxHold(14.0)`

**Aufbau**

1. **Anzahl:** `n = aspect < 1.5 ? 1 : aspect < 2.3 ? 2 : 3`. Mitten `cx_k = width·(k + 0.5)/n + 0.04·minDim·sin(0.5 t + 1.7 k)`, Phasenversatz `k·2π/3` im Drehwinkel, `rowH = n == 1 ? 1 : 2`. Twister `k` startet verzögert: `visK = clamp01((vis − 0.2·k) / (1 − 0.2·k))`.
2. **Winkel je Zeile `y`:** `θ(y) = ω·t + 2π·twist·g(y)·visK + 2π·twistKick·(y/height) + 0.5·impulse·dir + k·2π/3`, `ω = lerp(0.9, 2.2, ten)·rotSign` (Slew 0,4 s), `twist = lerp(1.2, 3.5, ten)` Umdrehungen über die Höhe (in `afterglow` Ziel `0.6`, Slew 1,2 s). Modus `mode` (4. Beat), Übergang `mb` 0→1 in 0,5 s, `g = lerp(g_alt, g_neu, mb)`:
   - `0` linear: `g = y/height`; `1` Sägezahn: `g = frac(2·y/height)`; `2` Zickzack-Helix: `g = 2·tri(y/128)` mit `tri(x) = abs(((x + 1) mod 2) − 1)` (Richtung wechselt alle 128 Zeilen, stetig); `3` pulsierend: `g = (y/height)·(0.6 + 0.4·sin(1.3 t))`.
3. **Radius:** `R(y) = R0·(1 + bulge·sin(2π·y/(0.7·height) + 0.8 t))·(1 + 0.35·impulse)·visK`, `R0 = 0.28·minDim·(n > 1 ? 0.8 : 1)`, `bulge = 0.25·smoothstep(0.3, 0.6, ten)`.
4. **Ecken** `x_i = cx + R·cos(θ + i·π/2)`, `i = 0..3`. Fläche `i` liegt zwischen `x_i` und `x_{(i+1)&3}` und ist sichtbar, wenn `x_{i+1} > x_i`. Beim Quadratquerschnitt sind je Zeile höchstens **2** Flächen sichtbar.
5. **Stufe:** `lit = clamp01((x_{i+1} − x_i) / (1.414·R))` (frontal = hell), `stufe = 1 + round(lit·3) + round(ch(i))`, Streifenmuster entlang `y`: `band = (floor(y/8) + bandPhase) & 1` → `stufe − band`, geklemmt `0..5`. Farbe `RAMPS[CH_RAMPS[(i + rot) & 3]][stufe]` (`afterglow`: `COOL`).
6. **Zeichnen:** je Zeile `fr(xa, y, xb − xa, rowH)` je sichtbarer Fläche; Fuge zwischen zwei Flächen 1 px `INK`; Silhouette links und rechts außen 1 px `INK`. Im `climax` zeichnet die Fläche mit dem höchsten `ch` ihre Kanten in Stufe 5 statt `INK`.

**Tension → Verhalten**

| Zustand / Band | Sichtbares Verhalten |
| --- | --- |
| `starting` | Balken wächst aus der Mitte (`R · visK`, `twist · visK`), bei `n > 1` entstehen die Twister nacheinander. Kein Schwarz-Fade. |
| `playing` / low | `twist ≈ 1,2–1,9`, `ω ≈ 0,9–1,4`, Balken schlank, kein Bulge |
| `buildup` / mid | `twist ≈ 2,0–2,8`, Bulge aktiv, `ω ≈ 1,5–1,9` |
| `climax` / high | `twist ≈ 2,9–3,5`, `ω` bis 2,2, volle Bulge, Kanten der lautesten Fläche in Stufe 5 |
| `afterglow` | `twist` entspannt auf 0,6, `ω × 0.3`, `COOL`-Familien, Bulge aus, Formation bleibt |
| `stopping` | `R · visK`, `twist · visK`: der Balken schrumpft zur Mitte, die Twister verschwinden in umgekehrter Reihenfolge |

**Beat → Verhalten**

| Auslöser | Reaktion |
| --- | --- |
| `impulse` (kontinuierlich) | Radius `× (1 + 0.35·impulse)` (Aufblähen), Winkel-Versatz `0.5·impulse·dir` |
| soft | `bandPhase += 1` (das Streifenmuster schiebt sich um einen Block) |
| medium | `twistKick = 0.6` Umdrehungen, klingt mit τ 0,25 s ab; Flächen der stärksten Stimme 0,2 s `+1` Stufe |
| hard | Fläche der stärksten Stimme 0,12 s über die volle Länge in Stufe 5 (≤ ca. 10 % der Bildfläche), max. 1×/0,25 s |
| jeder 4. Beat | `mode = (mode + 1) & 3`, weicher Übergang über `mb` |
| jeder 8. Beat | `rotSign = −rotSign` (Slew 0,4 s) und `rot += 1` (Flächenfarben rotieren) per Wipe, `q = y/height` |

**Kanäle:** Fläche `i` ↔ Kanal `i` (Hardware-Fakt: 0 und 3 links, 1 und 2 rechts). Die Zuordnung bleibt über alle Zeilen stabil, auch wenn der Balken sich verdreht. Ohne `smooth` zeigen die Flächen ihre Grundfarbe, Drehung und Twist laufen aus `t`.
**Responsive:** `n` und `R0` aus Seitenverhältnis und `minDim`; Porträt ein schlanker Balken (≈ 56 % der Breite), Ultrawide drei Twister mit Phasenversatz. Auf Widescreen den zusätzlichen Raum bespielen, nicht den einen Balken strecken.
**Budget:** ≤ 2000 `fillRect`/Frame (2 Flächen + 3 Kanten je Zeile, `rowH = 2` ab `n >= 2`). Palette: 4 Rampen × 6 + `INK` = 25 Farben.
**Zusatztests (`test/amiga-twister.test.mjs`):** je Zeile höchstens 2 sichtbare Flächen; Fläche `i` bleibt Kanal `i` zugeordnet; `mode` ändert sich nur bei `count % 4 === 0`; `n` folgt der Tabelle für 4:3, 16:9, 21:9, 3:1, 1:3; alle `fr`-Aufrufe liegen im Buffer.

---

### 5.4 `AmigaVectorBalls` — foreground

**Vorbild:** Vector Balls: schattierte Kugeln (Blitter-Bobs) auf den Eckpunkten eines rotierenden 3D-Körpers, nach Tiefe sortiert. Die Kugeln gehören reihum den vier Paula-Kanälen.
**Registry:** `.systems('amiga').layer('foreground').weight(11).duration(15.0).climaxHold(15.0)`

**Aufbau**

1. **Familien** `FAMV[f]` (je `Float32Array(36·3)`, auf Radius ≈ 1 normiert, Slots ab `cnt[f]` liegen im Zentrum und sind inaktiv): `F0` Würfelgitter, 26 Punkte aus `{−1,0,1}³` ohne Zentrum, `×0.62`; `F1` Doppelhelix, 28 Punkte (2 Stränge × 14, `y = −1 + 2·m/13`, Winkel `0.55·m + s·π`, Radius `0.62`, Gesamtskala `0.85`); `F2` Kugelschale (Fibonacci), 32 Punkte, `×0.95`; `F3` Kleeblattknoten, 36 Punkte, `x = sin t + 2 sin 2t`, `y = cos t − 2 cos 2t`, `z = −sin 3t`, `t = 2π·m/36`, Skala `1/3.2`.
2. **Aktive Bälle:** `act = ten < 0.35 ? 18 : ten < 0.70 ? 28 : 36`, effektiv `min(act, cnt[f])`; bei `groups == 2` zusätzlich `× 0.75` abgerundet. Jede Kugel hat eine Skala `s_i`, die mit τ 0,12 s gegen 1 (aktiv) oder 0 (inaktiv) läuft (Index-Aktivierung, kein Re-Seed). Beim Morph wandert die Vertexposition `lerp(alt, neu, smoothstep(e))`, `e` läuft in 0,8 s von 0 auf 1; überzählige Slots fahren ins Zentrum und schrumpfen.
3. **Rotation:** `ωy = lerp(0.5, 1.8, ten)·rotSign`, `ay = ωy·t`, `ax = 0.6·ωy·t` bzw. nach `axisMode` (0: Y plus feste Neigung 0,35 rad, 1: X+Y, 2: Y+Z), `az = 0.3·ωy·t·smoothstep(0.6, 0.85, ten)` (Taumeln im Climax). Nach jedem Moduswechsel 0,4 s Slew.
4. **Projektion:** `S = minDim·lerp(0.16, 0.24, ten)·(1 + 0.22·impulse)·(1 + 0.3·boom)`, begrenzt auf `0.30·minDim`; `persp = 3.2 / (3.2 − z)`; Bildpunkt `(cx + x·S·persp, cy + y·S·persp)`, `cy = 0.45·height`. Kugelradius `r = clamp(round(0.12·S·persp·(0.75 + 0.6·ch(i % 4)) + round(impulse·1.5)), 2, 14)`.
5. **Gruppen:** `groups = aspect >= 2.0 ? 2 : 1`; Mitten `cx_g = width·(g + 0.5)/groups`; Gruppe 1 dreht gegenläufig (`−ay`).
6. **Sortierung:** `Uint8Array order` je Gruppe per Insertion-Sort nach `z` (Rücken zuerst), keine Allokation.
7. **Kugel-Templates:** im Konstruktor für `r = 2..14` als flache `Int16Array`-Läufe `[dy, dx0, dx1, stufe]`. Schattierung: Normale `n = (dx, dy, √(r²−dx²−dy²))/r`, Licht `L = (−0.45, −0.55, 0.7)` normiert, `stufe = floor(max(0, n·L)·5.99)`; der äußerste 1-px-Ring ist `INK` (Stufe `−1`). Zeichnen als `fr(sx + dx0, sy + dy, dx1 − dx0 + 1, 1)`. Tiefenverschiebung der Stufe: `z < −0.4` → `−1`, `z > 0.5` → `+1`. Farbe `RAMPS[CH_RAMPS[((i % 4) + rot) & 3]]` (`afterglow`: `COOL`).
8. **Ghost-Trails** (nur `ten > 0.70`): Positionen von vor 2 und 4 PAL-Schritten (`Int16Array`-Ringpuffer) als kleinere Kugeln (`r·0.8` mit Stufe `−2`, `r·0.6` mit Stufe `−3`), **vor** der echten Kugel gezeichnet. Bei `groups == 2` nur ein Ghost-Schritt.

**Tension → Verhalten**

| Zustand / Band | Sichtbares Verhalten |
| --- | --- |
| `starting` | Bälle erscheinen nacheinander (`floor(act·vis)` aktiv, Radius wächst von 0), kein Schwarz-Fade |
| `playing` / low | 18 Bälle, kleiner Körper (`S ≈ 0,16–0,19·minDim`), ruhige Drehung, keine Ghosts, Morph erlaubt |
| `buildup` / mid | 28 Bälle, größerer Körper, schnellere Drehung, zweite Rotationsachse |
| `climax` / high | 36 Bälle, größter Körper (`≈ 0,24·minDim`), Taumeln, Ghost-Trails |
| `afterglow` | `S` schrumpft Richtung `0,16`, `ωy × 0.3`, `COOL`-Familien, Ghosts aus, kein neuer Morph (laufender endet), Formation bleibt |
| `stopping` | `floor(act·vis)` fällt: die letzten Bälle verschwinden zuerst, Radien schrumpfen |

**Beat → Verhalten**

| Auslöser | Reaktion |
| --- | --- |
| `impulse` (kontinuierlich) | `S × (1 + 0.22·impulse)` (der Körper atmet), Kugelradius `+ round(impulse·1.5)` px |
| soft | `ay += 0.12·dir` (Richtungs-Nudge) |
| medium | Explosion: `boom = 1`, Vertices `× (1 + 0.3·boom)`, `boom *= exp(−dt/0.12)` |
| hard | Bälle des Kanals mit dem höchsten `ch` 0,12 s in Stufe 5, Explosion `boom = 1.4`, max. 1×/0,25 s |
| jeder 4. Beat | Morph zur nächsten Familie `f = (f + 1) & 3` (0,8 s) |
| jeder 8. Beat | `axisMode = (axisMode + 1) % 3` und `rotSign = −rotSign` (Slew 0,4 s), `rot += 1` per Wipe, `q` = normierte Tiefe |

**Kanäle:** Kugel `i` gehört Kanal `i % 4` (reihum um den Körper verteilt); Radius `0.75 + 0.6·ch`, Farbfamilie aus `CH_RAMPS`. Ohne `smooth` gilt `ch = 0`, die Kugeln behalten Grundradius, der Körper dreht aus `t`.
**Responsive:** `S` an `minDim`, `cy = 0.45·height`; Ultrawide (`aspect >= 2.0`) zeigt zwei gegenläufige Körper nebeneinander, Porträt einen zentrierten. Kugelradius max. 14 px, keine negativen Rechtecke bei kleinen Buffern.
**Budget:** ≤ 5000 `fillRect`/Frame (≈ 60 je Kugel plus Ghosts), Pools fest: 36 Slots je Gruppe, 13 Templates, keine Allokation im Renderloop. Palette: 4 Rampen × 6 + `INK` = 25 Farben.
**Zusatztests (`test/amiga-vector-balls.test.mjs`):** Morph erhält Slot-Indizes (kein Re-Seed); `r` immer in `2..14`; Ghosts nur bei `ten > 0.70`; Familienwechsel nur bei `count % 4 === 0`; Sortierung stabil und endlich; Kugel `i` nutzt Rampe von Kanal `i % 4`.

---

### 5.5 `AmigaVoxelHills` — floor

**Vorbild:** Voxel-Landschaft (Height-Map-Raycasting, Spaltenspans): eine Hügellandschaft, über die die Kamera fliegt. Die vier Paula-Kanäle werden als Rücken gemalt, die am Horizont entstehen und auf den Betrachter zulaufen: die Musik ist die Landschaft.
**Registry:** `.systems('amiga').layer('floor').weight(12).duration(15.0).climaxHold(15.0)`

**Aufbau (alles geclippt auf `y >= horizon`)**

1. **Karten** (Konstruktor, deterministisch, 128×128, wrappend): `HM` (`Uint8Array`, 0..255) aus 4 Sinus-Oktaven plus Xorshift32-Value-Noise auf einem 16×16-Gitter (bilinear, nahtlos). `CM` (Stufenkarte 0..5): `stufe = clamp(floor(HM/48) + slope, 0, 5)`, `slope = +1`, wenn `HM[x−1] − HM[x+1] > 6` (Sonnenhang), `−1`, wenn `< −6`, sonst `0`.
2. **Familien** `TERRAIN = [JADE, GOLD, STEEL, MAGMA]` (Grün, Wüste, Eis, Lava), Index `terrain`; `afterglow` erzwingt Eis (`STEEL`). Rücken nutzen die Stufen 2..5 der Rampen aus `CH_RAMPS`. **Palettenbudget:** Terrain 6 + zweite Terrain-Rampe während eines Wipes 6 + 4 Rücken-Rampen × 4 Stufen 16 + `INK` + `SNOW` = 30 Farben.
3. **Kamera:** `camZ += vEff·dt`, Streckenverlauf `winding(z) = 6·sin(0.045·z)`, `camX = winding(camZ)`, Gieren `ψ = yawAmp·yawSign·sin(0.21 t) + yawKick`.
4. **Projektion:** `vs = lerp(0.10, 0.22, ten)·minDim·(1 + 0.12·impulse)·vis` (Pixel je Höheneinheit). Welthöhe `h ∈ [0, 1.6]` (Karte `HM/255` plus Rücken). Bildzeile `ySc = horizon + (2.0 − h)·vs / z`. Die Kamera liegt (`2.0 > 1.6`) immer über dem Gelände, also fällt nichts oberhalb des Horizonts. Die erste Stichprobe (`z0 = 1`) füllt bis zur Unterkante.
5. **Abtastung:** `colW = width <= 300 ? 2 : width <= 520 ? 3 : 4`; Strahl `dxRay = ((x + 0.5)·colW/width − 0.5)·2·spread`, `spread = clamp(0.4 + 0.35·aspect, 0.55, 1.4)`. `z` läuft von 1 bis `zMax = 64`, `dz` startet bei 0,6 und wächst um Faktor 1,03 je Schritt. Weltpunkt `wx = camX + (sinψ + dxRay·cosψ)·z`, `wz = camZ + (cosψ − dxRay·sinψ)·z`, Kartenindex `(wx, wz) & 127`.
6. **Rücken:** Ringpuffer `ridge = Float32Array(4·256)`, Zelle `c = floor(wz / 0.5) & 255`. Je PAL-Schritt wird bis zur Zelle `floor((camZ + 0.92·zMax) / 0.5)` nachgefüllt (max. 64 Zellen je Schritt): `ridge[k·256 + c] = ch(k)·ridgeGain`. Lane `k` liegt bei `winding(wz) + (k − 1.5)·14`; nur die nächste Lane `kk = round((wx − winding(wz))/14 + 1.5)` (falls `0..3`) wirkt: `h += 0.6·ridge[kk·256 + c]·max(0, 1 − (d/5)²)`, `d = |wx − Lanenmitte|`. Liegt der Beitrag über `0.08`, nimmt die Spalte die Rücken-Farbe `RAMPS[CH_RAMPS[(kk + rot) & 3]][2 + round(3·ridgeNorm)]` statt der Geländefarbe.
7. **Nebel:** Stufe `− floor(z/16)` (min. 0); ab `z > 48` Zeilen-Dither (`y & 1`) zwischen Stufe 0 und 1.
8. **Zeichnen:** `yTop[x] = height`; ist `ySc < yTop[x]`, Span `[max(floor(ySc), horizon), yTop[x])` als `fr(x·colW, y0, colW, y1 − y0)`, dann `yTop[x] = ySc`. Aufeinanderfolgende Stichproben gleicher Farbe pro Spalte zu einem Span verschmelzen.
9. Zuletzt `bayerFadeCells(ctx, 0, horizon, width, height − horizon, vis)`.

**Tension → Verhalten** (`v = lerp(8, 32, ten)` Welteinheiten/s, `vEff = v·(1 + 0.4·impulse)`; `yawAmp = lerp(0.05, 0.35, ten)` rad; `ridgeGain = lerp(0.6, 1.4, ten)`)

| Zustand / Band | Sichtbares Verhalten |
| --- | --- |
| `starting` | `vs · vis`: das Gelände wächst aus der Ebene, dazu Bayer-Fade unterhalb des Horizonts |
| `playing` / low | ruhiger Flug (8–14 u/s), flache Hügel (`vs ≈ 0,10–0,14·minDim`), kaum Gieren, niedrige Rücken |
| `buildup` / mid | 15–22 u/s, mittlere Hügel, Gieren ≈ ±0,2 rad, Rücken normal |
| `climax` / high | 25–32 u/s, hohe Hügel (`vs ≈ 0,22·minDim`), Gieren ≈ ±0,35 rad, Rücken ×1,4 |
| `afterglow` | `v × 0.3`, `vs <= 0,12·minDim`, Familie Eis, Rücken −2 Stufen, Rückenspawn mit `ch × 0.5`, Formation bleibt |
| `stopping` | `vs · vis`, danach Bayer-Fade bis Schwarz |

**Beat → Verhalten**

| Auslöser | Reaktion |
| --- | --- |
| `impulse` (kontinuierlich) | `vs × (1 + 0.12·impulse)` (das Gelände hebt sich mit dem Beat), `vEff × (1 + 0.4·impulse)` |
| soft | Konturband (Breite 1,2 Welteinheiten) läuft mit 40 u/s von nah nach fern, `+1` Stufe |
| medium | Konturband `+2` Stufen und Rücken-Knoten: die vier Lane-Werte dieses Spawn-Schritts `× 1.4` |
| hard | Konturband `+3` Stufen, Breite 2,4, dazu `yawKick = 0.08·dir` (klingt in 0,3 s ab), max. 1×/0,25 s |
| jeder 4. Beat | `terrain = (terrain + 1) & 3` per Wipe, `q = 1 − z/zMax` (die neue Landschaft rollt aus der Ferne heran) |
| jeder 8. Beat | `yawSign = −yawSign` mit 0,5 s Slew |

**Kanäle:** Lane `k` ↔ Kanal `k` (links nach rechts 0..3). Der Rücken entsteht am fernen Ende aus dem aktuellen `ch(k)` und läuft als farbiger Höhenzug auf den Betrachter zu (Wasserfall-Prinzip). Die unmittelbare Rückmeldung am Beat kommt aus `vs`-Atmung, `vEff` und Konturband. Ohne `smooth` bleiben die Rücken flach, die Landschaft fliegt trotzdem.
**Responsive:** Spaltenbreite und `spread` folgen dem Buffer: Porträt (118 px) 59 Spalten, schmaler Korridor mit 1–2 Lanen im Vordergrund; Ultrawide 152–192 Spalten, alle vier Lanen sichtbar. Bei Resize bleiben `camZ`, `ridge`, `yTop` wird neu dimensioniert.
**Budget:** ≤ 12 000 Stichproben und ≤ 3500 `fillRect`/Frame. Überschreitet die Renderzeit das Budget, zuerst `zMax` auf 48, dann `colW` +1 (Palette und Determinismus bleiben).
**Zusatztests (`test/amiga-voxel-hills.test.mjs`):** keine Operation oberhalb `horizon`; `yTop[x]` ist je Spalte monoton nicht steigend; Rückenspawn je Schritt ≤ 64 Zellen; alle `h`, `ySc` endlich; Rotation Porträt → Querformat behält `camZ` und `ridge`; Terrainwechsel nur bei `count % 4 === 0`.

---

### 5.6 `AmigaParallaxGround` — floor

**Vorbild:** Mehrlagiger Parallax-Boden aus Amiga-Spielen (Dual-Playfield und Copper-Streifen, Shadow-of-the-Beast-Look): horizontale Bänder scrollen mit wachsender Geschwindigkeit nach unten, Halme, Steine oder Dünen ragen aus der Bandkante. Die Bänder gehören den vier Paula-Kanälen.
**Registry:** `.systems('amiga').layer('floor').weight(12).duration(14.0).climaxHold(12.0)`

**Aufbau (alles geclippt auf `y >= horizon`)**

1. **Bänder:** `N = 8`, `H = height − horizon`; Höhen `hB_i = round(H·w_i/Σw)`, `w_i = 1 + 0.45·i` (`i = 0` fern/oben … `7` nah/unten), Rest ins letzte Band, Startzeilen lückenlos von `horizon` bis `height`.
2. **Nähe und Scroll:** `n_i = (i + 1)/N`, `f_i = 0.15 + 0.85·n_i^1.5`, `scroll_i += dirSlew·v0·f_i·(1 + 0.9·impulse)·dt`. Kachel `tw_i = max(6, round(lerp(10, 44, n_i)·clamp(minDim/200, 0.6, 1.4)))`.
3. **Themen** `theme 0..3`: Wiese (`JADE`), Fels (`STEEL`), Sand (`GOLD`), Schnee (`OCEAN` mit `SNOW`-Spitzen). Bandfüllung Stufe `base_i = 1 + floor(n_i·2.99)` (fern dunkel, nah heller), obere 35 % des Bandes `base_i + 1` (beleuchtete Oberkante). Im `climax` nutzen die Bänder `i < 4` `MAGMA` (Dämmerung).
4. **Bewuchs** je Kachel an `x = k·tw_i − (scroll_i mod tw_i)`: Höhe `th = max(2, round(hB_i·0.5·(0.7 + 0.9·ch(c(i)))) + round(2·impulse))`, `c(i) = floor(i/2)`. Muster je Thema aus ≤ 3 `fr`: Wiese (zwei Halme mit Neigung `lean = round(sin(1.7 t + 0.9 k)·wind)`), Fels (Block mit hellerer Oberkante), Sand (Düne aus zwei Stufen), Schnee (3×3-Kristall). Spitzenstufe `min(5, base_i + 1 + (ch(c(i)) >= 0.6 ? 1 : 0))`. Reihenfolge fern → nah: erst Bandfläche, dann Bewuchs; nahe Halme überdecken ferne Bänder. Bewuchs von Band 0 wird am Horizont geclippt.
5. **Objekte** (Pool 6): hartkodierte 8×10-Bitmaps je Thema (Pfosten, Fels, Busch, Eisblock) mit 1 px `INK`-Kontur, auf den Bändern `4..7`, Spawn am Rand in Bewegungsrichtung (Xorshift32, Mindestabstand 40 px), skaliert nach `n_i`, scrollen mit `scroll_i`.
6. **Staub** (Pool 16): 1×1-Partikel in `GOLD` Stufe 3, Spawn an der Oberkante der Bänder 6–7, `vy = −20…−50 px/s`, Gravitation `+120 px/s²`, Lebensdauer ≤ 0,5 s, geclippt.
7. **Themenwechsel** (4. Beat): die Bänder wechseln nacheinander von fern nach nah (70 ms Versatz). Jedes Band wechselt mit einer vertikalen Kante, die in 0,25 s von rechts nach links läuft (`x >= sweepX_i` zeigt das neue Thema).
8. Zuletzt `bayerFadeCells(ctx, 0, horizon, width, H, vis)`.

**Palettenbudget:** Themenrampe 6 + `MAGMA` 6 + zweite Themenrampe während des Wechsels 6 + `INK` + `SNOW` = 20 Farben.

**Tension → Verhalten** (`v0 = lerp(10, 70, ten)` px/s am nächsten Band, `wind = lerp(0.5, 3, ten)` px, `objMax = ten < 0.35 ? 0 : ten < 0.70 ? 3 : 6`)

| Zustand / Band | Sichtbares Verhalten |
| --- | --- |
| `starting` | Bänder erscheinen von fern nach nah (`bVis = ceil(N·vis)`), dazu Bayer-Fade unterhalb des Horizonts |
| `playing` / low | `v0 ≈ 10–25`, ruhige Halme (`wind ≈ 0,5–1`), keine Objekte |
| `buildup` / mid | `v0 ≈ 30–45`, bis 3 Objekte, `wind ≈ 1,5` |
| `climax` / high | `v0 ≈ 50–70`, bis 6 Objekte, `wind ≈ 3`, Dämmerungsfarben auf den fernen Bändern |
| `afterglow` | `v0 × 0.25`, Rampen `OCEAN`/`STEEL` (Nacht), `wind ≈ 0,5`, keine neuen Objekte (vorhandene scrollen aus), Formation bleibt |
| `stopping` | `bVis` fällt: nahe Bänder verschwinden zuerst, Bayer-Fade bis Schwarz |

**Beat → Verhalten**

| Auslöser | Reaktion |
| --- | --- |
| `impulse` (kontinuierlich) | Scrollschub `× (1 + 0.9·impulse)` auf alle Bänder (die Parallaxe „zuckt“), Halmhöhe `+ round(2·impulse)` px |
| soft | Oberkante (1 Zeile) des Bandes der stärksten Stimme 0,1 s in Top-Stufe |
| medium | Bänder 6 und 7 für 0,15 s `+1` Stufe, 4 Staubpartikel |
| hard | Beben: Bewuchs und Objekte gerader Bänder `+1` px, ungerader `−1` px für 0,1 s; dazu 12 Staubpartikel (max. 1×/0,25 s) |
| jeder 4. Beat | Themenwechsel `theme = (theme + 1) & 3`, bandweise mit Kantenlauf |
| jeder 8. Beat | `dir = −dir` mit 0,4 s Slew (die Parallaxe läuft rückwärts, `dirSlew` geht durch 0) |

**Kanäle:** Bandzonen von fern nach nah: Bänder 0–1 ↔ Kanal 0, 2–3 ↔ 1, 4–5 ↔ 2, 6–7 ↔ 3. Halmhöhe wächst mit `ch`, Spitzen werden bei `ch >= 0.6` eine Stufe heller. Der Boden wirkt wie ein Equalizer aus Gras. Ohne `smooth` gilt `ch = 0`, die Halme bleiben auf Grundhöhe, Scroll und Wind laufen weiter.
**Responsive:** Bänder verteilen sich auf `H`, Kacheln und Bewuchs skalieren mit `minDim`. Porträt: wenige, kleine Halme; Ultrawide: viele Halme je Band (Band 0 ≈ 59, Band 7 ≈ 14), keine gestreckten Objekte.
**Budget:** ≤ 1500 `fillRect`/Frame (≈ 240 Halme × 3 plus Objekte und Staub).
**Zusatztests (`test/amiga-parallax-ground.test.mjs`):** Bänder decken `[horizon, height)` lückenlos ab; keine Operation oberhalb `horizon`; Themenwechsel läuft bandweise nacheinander und nur bei `count % 4 === 0`; Objekt-Pool ≤ 6, Staub-Pool ≤ 16; `dir`-Flip nur bei `count % 8 === 0`, Scroll bleibt endlich beim Nulldurchgang.

---

## 6. Registry-Einträge

Nur ergänzen, bestehende Einträge nicht verändern. Importe oben in `registry.js`, Einträge in den passenden Abschnitten:

```javascript
import { AmigaRotoZoomer } from './amiga/rotozoomer.js';
import { AmigaTechTech } from './amiga/tech-tech.js';
import { AmigaTwister } from './amiga/twister.js';
import { AmigaVectorBalls } from './amiga/vector-balls.js';
import { AmigaVoxelHills } from './amiga/voxel-hills.js';
import { AmigaParallaxGround } from './amiga/parallax-ground.js';

// --- BACKGROUNDS (Amiga) ---
RegisterDSE(AmigaRotoZoomer).systems('amiga').layer('background').weight(12).duration(14.0).climaxHold(12.0).build(),
RegisterDSE(AmigaTechTech).systems('amiga').layer('background').weight(12).duration(13.0).climaxHold(12.0).build(),

// --- FLOORS (Amiga) ---
RegisterDSE(AmigaVoxelHills).systems('amiga').layer('floor').weight(12).duration(15.0).climaxHold(15.0).build(),
RegisterDSE(AmigaParallaxGround).systems('amiga').layer('floor').weight(12).duration(14.0).climaxHold(12.0).build(),

// --- FOREGROUNDS (Amiga) ---
RegisterDSE(AmigaTwister).systems('amiga').layer('foreground').weight(12).duration(14.0).climaxHold(14.0).build(),
RegisterDSE(AmigaVectorBalls).systems('amiga').layer('foreground').weight(11).duration(15.0).climaxHold(15.0).build(),
```

- `maxInstances` bleibt beim Standard `1`. `.exclusive()` darf lokal zum Isolationstest gesetzt werden, **nicht** im Commit.
- Der Amiga-Floor-Layer enthält künftig `KefrensCheckerboard` (12), `AmigaVoxelHills` (12), `AmigaParallaxGround` (12) und `VoidFloor` (15). Die Chance auf einen sichtbaren Boden steigt gegenüber heute deutlich. Resultierende Verteilung im Lieferbericht nennen, Gewichte bei Bedarf nachjustieren.
- Prüfen, wie `SetlistManager` mehrere Foreground-Kandidaten behandelt (`AmigaCube`, `AmigaBoingBall`, `Copperbars`, `AmigaTwister`, `AmigaVectorBalls`: eine Instanz je Layer oder je DSE?), und das Ergebnis als Annahme dokumentieren.

## 7. Zusammenspiel und Kontrast (Pflicht-Stills)

Je Kombination Stills in 390×844, 844×390 und 2560×1080, in `climax` und `afterglow`:

| Kombination | Worauf achten |
| --- | --- |
| `AmigaRotoZoomer` × `KefrensCheckerboard` | Schachbrett-Textur `T1` hinter Schachbrett-Boden: Textur-Familie wechseln oder dunkler halten, der Boden muss lesbar bleiben |
| `AmigaRotoZoomer` × `AmigaTwister` / `AmigaVectorBalls` | `INK`-Outline vor hellen Texturen, Kanalfarben dürfen nicht in der Textur verschwinden |
| `AmigaTechTech` × `AmigaVoxelHills` | Wand hinter Hügeln, Nebelfarbe am Horizont, keine harte Kante |
| `AmigaTechTech` × `AmigaTwister` | beides sind Zeilenversatz-Effekte: auf visuelles Rauschen prüfen |
| `AmigaRetroSunset` × `AmigaVoxelHills` / `AmigaParallaxGround` | Horizont und Farbfamilie passen zur Sonne |
| `AmigaCastleFireworks` × `AmigaParallaxGround` | Burg steht oberhalb des Horizonts, der Boden übermalt sie nicht |
| `PaulaSiliconBg` × `AmigaTwister` | beide benutzen die Kanalreihenfolge: Farbcodes dürfen sich nicht widersprechen |
| `AmigaCube` / `AmigaBoingBall` × neue Foregrounds | nur prüfen, wenn mehrere Foregrounds gleichzeitig aktiv sein können |
| `Copperbars` × `AmigaTwister` | beide laufen im Layer `foreground`: auf Überlappung prüfen (nur melden, nicht ändern) |
| jeder Floor × `VoidBackground` / `VoidFloor` | keine Lücken, kein Zeichnen oberhalb des Horizonts |

## 8. Tests

Für jede der sechs Klassen sind alle elf Mindesttests aus den DSE-Entwicklungsregeln §9.1 Pflicht (Smoke, Numerik, Determinismus, Beat, Beat-Intensität, Beat an/aus, Zustände, Rotation, Palette, Viewport, Lifecycle). Dazu die DSE-spezifischen Tests aus §5.

- **Harness:** `makeMetrics(...)`, `runBeatIntensity(...)`, `GRADED_BEAT_STRENGTHS` (`soft 0.20`, `medium 0.50`, `hard 0.90`) aus `tools/dse-baseline/harness.js`. Nicht vorhandene Hilfen minimal selbst ergänzen und als Annahme melden.
- **Fake-Canvas:** strikt wie in §9.1 (Integer, Bounds, Palette, kein `globalAlpha`, `save()`/`clip()`, `getImageData()`, `fillText()`).
- **Palette:** jede `fillStyle` ist ein gültiger 12-Bit-Wert (Nibble-verdoppelt) und je DSE gibt es höchstens 32 verschiedene.
- **Beat-Intensität:** Messgröße je DSE, die sich bei soft/medium/hard reproduzierbar und sichtbar unterscheidet:

| DSE | soft | medium | hard | Messgröße |
| --- | --- | --- | --- | --- |
| `AmigaRotoZoomer` | `shift +1` | `shift +2`, Kupferband `+2` | `shift +3`, Snap 1,25, Band 12 % | `shift`-Delta, max. `Z`, Bandhöhe |
| `AmigaTechTech` | `φ1 +0.4` | `φ1 +0.4`, `shift +1` | Shockwave-Band, `shift +2` | Phasen-Delta, Bandzeilen, `shift` |
| `AmigaTwister` | `bandPhase +1` | `twistKick 0.6` | Fläche in Stufe 5 | `bandPhase`, `twistKick`, Anzahl Stufe-5-Zeilen |
| `AmigaVectorBalls` | `ay +0.12` | `boom 1` | `boom 1.4`, Highlight | `ay`-Delta, max. `boom`, Anzahl Stufe-5-Bälle |
| `AmigaVoxelHills` | Band `+1` | Band `+2`, Rücken ×1,4 | Band `+3`, breit, `yawKick` | Bandstufe und -breite, Rückenwert, `yawKick` |
| `AmigaParallaxGround` | Kante Top | Bänder 6/7 `+1`, 4 Staub | Beben, 12 Staub | Top-Zeilen, Staubzahl, Versatz ±1 |

```sh
node --test \
  test/amiga-rotozoomer.test.mjs \
  test/amiga-tech-tech.test.mjs \
  test/amiga-twister.test.mjs \
  test/amiga-vector-balls.test.mjs \
  test/amiga-voxel-hills.test.mjs \
  test/amiga-parallax-ground.test.mjs
```

Zusätzlich die bestehenden Suites laufen lassen, die Registry, Stage und Layer betreffen (`test/dj-engine-lifecycle.test.mjs`, `test/scene-dj-integration.test.mjs`, `test/graded-beat-routing.test.mjs`) sowie die vorhandenen Amiga-Suites (`test/kefrens-checkerboard.test.mjs`, `test/paula-silicon-bg.test.mjs`).

## 9. Abnahme und Lieferbericht

**Messung:** je DSE `fillRect`-Anzahl und Renderzeit (p50/p95 über 600 Frames) in 390×844, 844×390 und 2560×1080 im Zustand `climax`; Werte mit den Budgets aus §5 vergleichen (RotoZoomer ≤ 6000, TechTech ≤ 6000, Twister ≤ 2000, VectorBalls ≤ 5000, VoxelHills ≤ 3500, ParallaxGround ≤ 1500). Überschreitungen mit Qualitätsreduktion lösen (Zellgröße, `rowH`, `zMax`, Ghost-Schritte), Palette und Determinismus bleiben unverändert. `AmigaVoxelHills` und `AmigaRotoZoomer` sind die Kandidaten für Performance-Probleme auf Mobile.

**Visuelle Nachweise** (Harness oder gleichwertig): Zustandsübersicht inkl. `afterglow`, Porträt/Querformat/Ultrawide, 1:3 und 3:1, Rotationsfilmstrip mit derselben Instanz, Motion-Clips für `playing`/`buildup`/`climax`/`afterglow`, je ein Clip mit soft, medium und hard, Kombinations-Stills aus §7. Für Rücken und Bänder (Voxel, Parallax) zusätzlich eine Sequenz, die den Wasserfall-Effekt über mindestens 3 s zeigt.

**Reale App** (DSE-Modus): Trackstart, Presenter-Verhalten, Fenster vergrößern/verkleinern, Vollbild, Mobile-Ausrichtung wechseln, Trackwechsel, `image-rendering: pixelated`, Konsole ohne neue Fehler.

**Lieferbericht (Pflicht):**

1. Neue und geänderte Dateien (inkl. `registry.js`, `hardware-constraints.js`, `amiga-kit.js`, Tests).
2. **Annahmen**, mindestens: Kanalreihenfolge aus `paula-silicon-bg.js`; `smooth[0..3]` steht auf dem Amiga zur Verfügung; reale Dauer von `starting`/`stopping`; Existenz von `bayerFadeCells` oder Extraktion; Layer-Instanzmodell; Fallback bei fehlendem `beatLevel`.
3. Messtabelle (§9 Messung).
4. Offene Punkte, Abweichungen von diesem Prompt mit Begründung.
5. Commit-Vorschläge im Conventional-Commit-Format, z. B. `feat(dse/amiga): add rotozoomer and tech-tech backgrounds`, `feat(dse/amiga): add twister and vector balls foregrounds`, `feat(dse/amiga): add voxel hills and parallax ground floors`, `chore(visuals): add amiga-kit ramps and shared dither helpers`.

**Zusätzliche Definition of Done (zu §11 der DSE-Regeln):**

- [ ] Alle sechs DSEs nutzen den Beat-Zustand aus §2 und lesen `beat[0]` nie als Trigger.
- [ ] hard-Sonderereignisse sind auf 1× je 0,25 s begrenzt; kein flächiger Hochkontrast-Blitz.
- [ ] Jede DSE bleibt bei höchstens 32 Palettenfarben (inkl. Wipe-Phasen); Farbmärsche laufen nur über `PP6`.
- [ ] Kanalzuordnung ist stabil und dokumentiert (Twister-Fläche, Kugelreihum, Lane, Bandzone, Zeilenzone, Bildschirmzone).
- [ ] Floors schreiben nachweislich nichts oberhalb `horizon`; Foregrounds blenden nie mit Schwarz-Vollbild-Dither.
- [ ] Ausblenden endet bei `vis = 0` vollständig (opake Layer warten darauf).
- [ ] Ohne Audio und ohne `smooth`/`beatImpulse` rendert jede DSE lebendig und fehlerfrei.

## 10. Empfohlene Implementierungsreihenfolge

1. **Helfer** in `hardware-constraints.js` (§4) und `amiga-kit.js`, mit eigenen Tests.
2. **Backgrounds:** `AmigaRotoZoomer` zuerst (prüft Palette, Wipes, Responsive und Zellraster), dann `AmigaTechTech`.
3. **Foregrounds:** `AmigaTwister`, dann `AmigaVectorBalls` (Template-Builder und Sortierung).
4. **Floors:** `AmigaParallaxGround` (einfach, Bänder und Pools), zuletzt `AmigaVoxelHills` wegen Performance-Messung und Rückenpuffer.
5. **Registry** je DSE einzeln aktivieren (lokal `.exclusive()`, vor dem Commit entfernen), danach Kombinationen aus §7.
6. **Reale App** testen, Lieferbericht schreiben.

Liefere nur neue oder geänderte Dateien.
