# Pre-Prompt: DSE-Paket C64 — 6 neue Demo Scene Elements für Chiptunes Fantasy

## 0. Auftrag

Du bist ein erfahrener C64-Demoscener und JavaScript-Entwickler. Implementiere sechs neue DSEs für das System **C64** (VIC-II, SID mit 3 Stimmen), je zwei für die Layer `background`, `foreground` und `floor`.

Verbindliche Referenzen, die diesem Prompt beiliegen: **DSE-Entwicklungsregeln**, `js/visuals/dse/registry.js`, `js/visuals/utils/hardware-constraints.js`. Dieser Prompt ergänzt sie und hebt keine Regel auf. Bei Konflikt gelten die DSE-Entwicklungsregeln. Dateien, die nicht beiliegen (z. B. Test-Harness, Font-Module), nicht raten: eigenständig implementieren und im Lieferbericht als **Annahme** auflisten.

| Layer | DSE (Klasse) | Datei unter `js/visuals/dse/c64/` |
| --- | --- | --- |
| background | `C64RasterTunnel` | `raster-tunnel.js` |
| background | `C64FireWall` | `fire-wall.js` |
| foreground | `C64SineScroller` | `sine-scroller.js` |
| foreground | `C64BorderRasters` | `border-rasters.js` |
| floor | `C64RasterRoad` | `raster-road.js` |
| floor | `C64DanceFloor` | `dance-floor.js` |

Bisher existieren auf dem C64 nur Backgrounds und `C64VectorStar`. Es gibt **keinen** C64-Floor. Die beiden Floors schließen diese Lücke.

## 1. Nicht verhandelbar (Kurzfassung der DSE-Regeln)

- Signatur `render(ctx, width, height, t, state, stateTime, metrics)`; `ctx` = niedrig aufgelöster Retro-Buffer; optional `resize(width, height)`. Größenwechsel auch erst im nächsten `render()` korrekt behandeln, **dieselbe Instanz**, Simulationszustand erhalten, größenabhängige Caches neu bauen und Objekte auf den neuen Sichtbereich abbilden.
- Eingangsschutz am Anfang von `render()`: `width <= 0 || height <= 0 || !Number.isFinite(width / height)` → `this.lastT = t; return;`. `dt` aus `t` ableiten und auf max. `0.1 s` begrenzen (erster Frame: `0.02`). Keine Division durch `0`.
- **PAL-Tick-Caching (50 Hz):** Bewegung rein zeitbasiert. Exakte Beat-Events niemals als Pegel lesen.
- **Ohne Audio lebendig:** Grundbewegung aus `t`, `energy`, `smooth[c]`. Beats sind nur Akzent. Fehlende Metriken → endliche Fallbacks (`0`).
- **Diskrete Wechsel** (Pattern, Palette, Richtung, Modus) **nur** bei `metrics.beatStarted` (mit `beatCount`). Kontinuierliche Ausschläge nur über `beatImpulse[0]` (Fallback: begrenztes `beat[0]`). `beat[0] > x` ist als Trigger verboten.
- **Retro-Stil:** Höhe laut `SYSTEM_RESOLUTIONS.c64 = 200`, Breite dynamisch. Ausschließlich `C64_PALETTE`-Farben (zur Initialisierung per `rgbToHex` in Hex-Strings umsetzen, nie pro Frame berechnen). Nur ganzzahlige opake `fillRect`; kein `globalAlpha`, `arc`, `lineTo`-Konturen, Schatten, Filter, Gradienten, `fillText`, `measureText`, `getImageData`.
- Linien, Kreise und Polygone nur über Bresenham-/Scanline-Helfer. Die Helfer **clippen nicht**: jedes Primitiv hart auf `[0..width]`×`[0..height]` begrenzen (Floors zusätzlich auf `y >= horizon`).
- **Layer-Regeln:** `background` darf vollflächig mit Bayer-Dither aus Schwarz ein-/ausblenden. `floor` nur **unterhalb** `horizon = Math.floor(height * 0.55)`; Bereich `0 .. horizon-1` bleibt unberührt. `foreground` blendet **nie** per Schwarz-Vollbild-Dither, sondern über Geometrie, Objektzahl oder Schrittsichtbarkeit.
- **Kontrast-Vertrag:** Foreground-Formen und Bitmap-Schrift brauchen dunkle Outline oder klare Rampen-Kontraste.
- Kein `Math.random()`. Instanzeigener **Xorshift32** mit festem Seed. Feste Pools. Keine Allokation im Renderloop. Resize allokiert gezielt neu.
- **Strobe-Schutz:** Beat-Akzente betreffen max. ca. 25 % der Bildfläche und max. 2 Rampenstufen. Keine Schwarz↔Weiß-Flächenwechsel im Beat-Takt (bis ca. 6,7 Beats/s möglich).
- Fehlt `DOM`-freies Dither: nativen Bayer-Zellen-Fade nutzen (siehe §4), nicht `applyOrderedDitherFade`.
- Jedes Modul exportiert nur seine Klasse und importiert `registry.js` **nicht**.

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

// Kanal (SID-Stimme c = 0..2), defensiv
const ch = c => clamp01(metrics?.smooth?.[c] ?? 0);

// eigener Zustandszaehler (stateTime wird nicht zuverlaessig zurueckgesetzt)
if (this.lastState !== state) { this.lastState = state; this.stateAge = 0; } else this.stateAge += dt;
```

- **Simulationen** (Feuer, Pools) laufen mit festem 50-Hz-Schritt: `acc += dt; let n = 0; while (acc >= 0.02 && n++ < 4) { step(); acc -= 0.02; }`.
- **Tension-Bänder** in den Tabellen: *low* = `ten < 0.35` (≙ `playing`), *mid* = `0.35–0.70` (≙ `buildup`), *high* = `> 0.70` (≙ `climax`). `afterglow` ist ein eigener Zustand mit gekühlter Palette. Strukturgrößen (Objektzahl, Sektoren) nur per **Index-Aktivierung** in festen Pools ändern, nie per Re-Seed.
- **Beat-Stufen** (identisch zu `getBeatLevel`):

| Stufe | `beatLevel` | `beatStrength` | Rolle in diesem Paket |
| --- | ---: | --- | --- |
| soft | 1 | `> 0` und `< 1/3` | Mikro-Nudge, nur kleinster diskreter Schritt |
| medium | 2 | `1/3` bis `< 2/3` | Nudge + Form- oder Palettenschritt |
| hard | 3 | `>= 2/3` | Nudge + lokales Sonderereignis (max. 1 pro 0,25 s je DSE) |
| jeder 4. Beat | `count > 0 && count % 4 === 0` | | Pattern-/Paletten-/Themenfamilie |
| jeder 8. Beat | `count > 0 && count % 8 === 0` | | Richtungs- oder Modus-Wechsel |

- **Afterglow-Regel:** letzte Formation und Objektpositionen übernehmen, Geschwindigkeit ca. ×0,3, Palette auf kühle Rampen (`BLUE`/`GREY`), Wechsel der Palette erst am nächsten Beat oder nach 1,2 s ohne Beat.
- **Warteregel für Strukturwechsel:** ein pendender Wechsel wird beim nächsten `beatStarted` übernommen, spätestens nach 1,2 s ohne Beat (Tracks ohne Perkussion).

## 3. C64-Hardware-Fingerabdruck

- **VIC-II, 16 Farben.** Index → `C64_PALETTE`: 0 Schwarz, 1 Weiß, 2 Rot, 3 Cyan, 4 Violett, 5 Grün, 6 Blau, 7 Gelb, 8 Orange, 9 Braun, 10 Hellrot, 11 Dunkelgrau, 12 Mittelgrau, 13 Hellgrün, 14 Hellblau, 15 Hellgrau.
- **Luminanz-Rampen** (dunkel → hell), nur Indizes verwenden:

| Rampe | Indizes |
| --- | --- |
| `GREY` | 0, 11, 12, 15, 1 |
| `BLUE` | 0, 6, 14, 3, 1 |
| `FIRE` | 0, 9, 2, 8, 7, 1 |
| `GREEN` | 0, 11, 5, 13, 1 |
| `PURPLE` | 0, 6, 4, 10, 1 |

- **Zeichentricks, die der Look zitieren soll:** Raster-IRQ pro Zeile (`$D021`/`$D020` wechseln), Color-RAM-Kachelwechsel, 2×1-Multicolor-Pixel (hier als 2×2-Chunky-Zellen), 8×8-Zeichenzellen, 8 Hardware-Sprites à 24×21 (max. 8 pro Zeile, **kein Flackern**), DYCP, FLD, Open Border.
- **Zwischentöne nur per Dither** zwischen zwei Rampenstufen (2×2-Bayer). Kein Mischen.

## 4. Empfohlene Erweiterungen von `hardware-constraints.js`

Nur anlegen, wenn nicht schon im Repo vorhanden. Existiert ein nativer Bayer-Fade in `ChunkyPlasma` oder `KefrensCheckerboard`, **extrahieren statt neu schreiben**. Reine Zusätze, keine Änderung bestehender Exporte.

- `createXorshift32(seed)` → `{ next(), float(), int(n), reset(seed) }`.
- `bayerFadeCells(ctx, x, y, w, h, visibility, cell = 2, color = '#000000')`: DOM-freier 4×4-Bayer-Fade aus `fillRect`-Zellen mit horizontalem Run-Merging, hart auf die Region geclippt, max. ca. 4000 `fillRect` pro Aufruf.
- `fillAliasedPolygonClipped(...)` und `drawAliasedLineClipped(...)`: wie die vorhandenen Helfer, aber mit Clip-Rechteck als letztem Parameter.
- Optional `js/visuals/utils/bitmap-font.js` (Glyphtabelle, `drawBitmapRun(...)`). Enthält `track-presenter.js` schon eine 5×7/8×8-Schrift, diese ohne Verhaltensänderung extrahieren und mit den bestehenden Tests absichern.


---

## 5. DSE-Spezifikationen

### 5.0 Gemeinsame Bausteine (in allen sechs DSEs gleich umsetzen)

- **Farben:** `const HEX = C64_PALETTE.map(([r, g, b]) => rgbToHex(r, g, b));` einmalig pro Modul. `RAMP.*` sind die Indexlisten aus §3.
- **Ping-Pong-Indexfolge** `pp(L) = [0, 1, …, L-1, L-2, …, 1]`. Jeder Farbmarsch (Rampenzyklus) läuft über `pp(rampLength)`: die mittlere Luminanz bleibt konstant, ein Beat verschiebt nur Bänder und lässt nie die Fläche blitzen.
- **Familien:** `FAM = [RAMP.BLUE, RAMP.PURPLE, RAMP.GREEN, RAMP.FIRE]`, Index `fam`. `fam` ändert sich nur durch die 4.-/8.-Beat-Regel des jeweiligen DSE. `afterglow` erzwingt `BLUE`; die Rückkehr beim Verlassen von `afterglow` läuft ebenfalls per Wipe.
- **Wipe statt Blitz:** `setFamily(next)` merkt `wipeFrom`, `wipeTo`, `wipeT0 = t`. Jedes Element hat eine Koordinate `q ∈ [0..1]` (Definition je DSE, `0` = zuerst betroffen) und nimmt die neue Familie, sobald `q <= clamp01((t - wipeT0) / 0.6)`.
- **Sichtbarkeit `vis`:** `starting` → `clamp01(stateTime / T_IN)`; `stopping` → `1 - clamp01(stateTime / T_OUT)`; sonst `1`. Startwerte `T_IN = T_OUT = 1.0 s` (background/floor) bzw. `0.8 s` (foreground). **In `stage-manager.js` nachlesen, wie lange `starting`/`stopping` real dauern, Konstanten angleichen, Ergebnis im Lieferbericht als Annahme melden.** Auf opaken Layern (`background`, `floor`) wartet der Nachfolger auf das Ende von `stopping`: das Ausblenden MUSS bei `vis = 0` vollständig enden und danach nichts mehr zeichnen.
- **Clip-Helfer (privat im Modul):** `fr(x, y, w, h)` rundet auf Integer, schneidet auf `[0..width]×[yMin..height]` zu (`yMin = horizon` bei Floors, sonst `0`) und verwirft `w <= 0 || h <= 0`. Jede Zeichenoperation läuft durch ihn.
- **Horizont:** `const horizon = Math.floor(height * 0.55)`. Floors schreiben nur `y >= horizon`; Backgrounds legen ihr Hauptmotiv oberhalb ab.
- **Fade:** `bayerFadeCells(ctx, x, y, w, h, vis)` aus §4, **nur** bei `background` und (unterhalb `horizon`) `floor`. Bei `vis >= 1` nicht aufrufen.
- **Beat-Limits:** hard-Sonderereignisse max. 1 pro 0,25 s je DSE (`this.hardCooldown -= dt`).
- **Idle:** `state === 'idle'` → sofort `return`, keine Simulation.

---

### 5.1 `C64RasterTunnel` — background

**Vorbild:** Raster-Tunnel aus C64-Intros: ineinandergesteckte Rahmen, jede Rahmenfarbe kommt aus einer Rastertabelle; Farbmarsch und Scroll erzeugen den Flug durch den Tunnel.
**Registry:** `.systems('c64').layer('background').weight(11).duration(14.0).climaxHold(12.0)`

**Aufbau (Zeichenreihenfolge)**

1. Basis: Gesamtfläche in Index 0.
2. Fluchtpunkt `VP = (width/2 + swayX, horizon − 1 + swayY)`, `swayX = 0.05·width·bend·sin(0.31 t) + dir·0.02·width·impulse`, `swayY = 0.02·height·bend·sin(0.23 t) − 0.03·height·impulse`. Der VP liegt auf dem Horizont: ein aktiver Floor wird zum Tunnelboden.
3. Ring `r` (ganzzahlige ID) hat Tiefe `d = r − S` (`S` = Scrollposition in Ringen, zeitbasiert, wächst). Skalierung `sc = 1 / (0.35 + 0.55·d)`, `M = max(width, height)`, Halbachsen `(0.5·M·sc·width/M, 0.5·M·sc·height/M)`: die Rahmen haben das Seitenverhältnis des Buffers und bespielen Porträt wie Ultrawide. Ringmitte `VP + A·sc·(sin(0.55 r + 0.9 t), 0.6·cos(0.43 r + 0.7 t))` mit `A = 0.05·minDim·bend` (der Tunnel schlängelt sich, Biegung wächst zum Betrachter).
4. Zeichnen von nah (`d` klein) nach fern als gefüllte, geclippte Rechtecke. Farbe `RAMP[fam][min(L−1, PP[(r + shift) % PP.length] + lv[r & 31])]` mit `L` = Rampenlänge, `PP = pp(L)`. Nebel: für `d > 0.75·N` nur die Stufen `r & 1` (die zwei dunkelsten).
5. Climax-Split (`ten > 0.70`): jeder Ring als zwei Hälften, rechts von `VP.x` mit `+2` Indexversatz (geclippt auf `L−1`).
6. Pulsringe (Pool 6): Rahmen mit `1 + round(impulse)` px Stärke in Rampen-Top, innen 1 px Index 0; wandern mit 2,2 Ringen/s von `d = N` nach `d = 0.15`, dann frei.
7. Zuletzt `bayerFadeCells(..., vis)`.

**`lv[]` (Uint8Array 32):** wird **nur beim Eintritt eines Rings am fernen Ende** gesetzt: `lv[r & 31] = round(ch(r % 3) · 2)`. Die Pegel der drei SID-Stimmen wandern so als hellere Ringe auf den Betrachter zu (Wasserfall-Prinzip).

**Tension → Verhalten** (`N = round(lerp(20, 32, smoothstep(0.2, 0.8, ten)))`, `Sdot = lerp(0.8, 4.2, ten)` Ringe/s, `bend = lerp(0.15, 1.0, ten)`, `pulseMax = ten < 0.35 ? 2 : ten < 0.70 ? 4 : 6`)

| Zustand / Band | Sichtbares Verhalten |
| --- | --- |
| `starting` | Ringe mit `d < (1 − vis)·0.8·N` werden übersprungen: der Tunnel wächst vom Fluchtpunkt zum Betrachter. Zusätzlich Bayer-Fade. |
| `playing` / low | ruhiger Flug (0,8–1,7 Ringe/s), kaum Biegung, Farbmarsch langsam, Pulsringe nur bei medium/hard |
| `buildup` / mid | schnellerer Flug, deutliche Schlängelung, `N ≈ 26`, bis 4 Pulsringe, `lv` wirkt sichtbar |
| `climax` / high | `N = 32`, volle Biegung, Split-Tunnel, Pulsringe bei jedem medium/hard-Beat, 2-px-Rahmen in Top-Stufe |
| `afterglow` | Familie `BLUE`, `Sdot × 0.3`, `bend ≤ 0.2`, Split aus, `lv` wird nicht mehr neu geschrieben, Pulsringe nur bei soft; Formation (`S`, VP-Pfad) bleibt erhalten |
| `stopping` | `vis` fällt: nahe Ringe verschwinden zuerst (Spiegelbild von `starting`), danach Bayer-Fade bis Schwarz |

**Beat → Verhalten**

| Auslöser | Reaktion |
| --- | --- |
| `impulse` (kontinuierlich) | `Sdot × (1 + 1.2·impulse)` (Flugschub), VP-Nicken (siehe Aufbau 2), Pulsring-Rahmenstärke +`round(impulse)` px |
| soft (`level 1`) | `shift += 1` (Farbmarsch um einen Ring), Pulsring in Stufe `L−3` |
| medium (`level 2`) | `shift += 1`, Pulsring in Stufe `L−2`, `lv` des nächsten einlaufenden Rings `+1` |
| hard (`level 3`) | `shift += 2`, Pulsring in Top-Stufe plus Zwilling 0,5 Ringe dahinter (max. 1×/0,25 s) |
| jeder 4. Beat | `setFamily((fam + 1) % 4)`, Wipe-Koordinate `q = 1 − d/N` (Wechsel läuft vom Betrachter in die Ferne) |
| jeder 8. Beat | `bendDir = −bendDir`, mit 0,4 s Slew auf die neue Schlängelrichtung |

**Kanäle:** `smooth[0..2]` wirken über `lv` (siehe oben). Fehlt `smooth`, bleibt `lv = 0`; Flug, Biegung und Farbmarsch laufen trotzdem.
**Responsive:** keine feste 4:3-Annahme. Porträt (z. B. 92×200): hohe schmale Rahmen, Biegeamplitude über `minDim`. Ultrawide: breite Rahmen, Pulsringe laufen über die volle Breite. 1:3 und 3:1 müssen ohne negative Rechtecke laufen.
**Budget:** ≤ 100 `fillRect` pro Frame (32 Ringe, 32 Split-Hälften, 6×8 Pulsrahmen). Keine Allokation im Renderloop.
**Zusatztests (`test/c64-raster-tunnel.test.mjs`):** `lv` ändert sich nur bei Ringeintritt; Pulsringe entstehen nur bei `beatStarted`; Familienwechsel nur bei `count % 4 === 0`; `afterglow` verwendet ausschließlich `BLUE`-Indizes; Ringe mit `d <= 0` oder `d > N` werden nicht gezeichnet.

---

### 5.2 `C64FireWall` — background

**Vorbild:** Feuerwand aus C64-Demos: Hitzefeld in Chunky-Zellen (Multicolor-Zeichenblöcke), Rampe Schwarz → Braun → Rot → Orange → Gelb → Weiß, dazu aufsteigende Funken.
**Registry:** `.systems('c64').layer('background').weight(12).duration(12.0).climaxHold(12.0)`

**Aufbau**

1. Raster: `cell = clamp(ceil(width / 120), 2, 4)`, `cols = ceil(width / cell)`, `hRow = floor(horizon / cell)` (Quellzeile = Horizont, Flammen steigen nach oben). `heat = Uint8Array(cols · (hRow + 2))` gehört der Instanz. Bei Resize per Nearest-Resample übernehmen: die Flammen laufen weiter, kein Re-Seed.
2. Himmel: Index 0. Die 12 Zeilen über dem Horizont als Glutschein: obere Hälfte 25-%-Checker `0/6`, untere Hälfte 50-%-Checker `0/6` (2×2-Zellen).
3. Simulation im festen 50-Hz-Schritt: Quellzeile `heat[hRow][x] = clamp(255 · srcLevel · zoneW(x) · (0.80 + 0.20·rnd()))`. Danach für `y = 0 … hRow−1`: `heat[y][x] = max(0, ((H[y+1][x−1+w] + H[y+1][x+w] + H[y+1][x+1+w] + H[y+2][x+w]) >> 2) − coolEff·(0.6 + 0.8·rnd()))` (`w` = Windversatz in Zellen, Ränder klemmen, `rnd` = Xorshift32). `coolEff = coolBase · cell / 2` hält die Flammenhöhe in Pixeln unabhängig von der Zellgröße.
4. Darstellung: Stufe `s = floor(heat · L / 256)`, Farbe `FAM[fam][s]`. Je Zeile Läufe gleicher Stufe zu einem `fillRect` verschmelzen, Stufe 0 überspringen. An Stufengrenzen (Nachkommaanteil 0,4–0,6) 2×2-Checker zur nächsthöheren Stufe (Dither statt Mischfarbe).
5. Glutbett (Zeilen `>= horizon`, reine Darstellung, keine Simulation): `e = clamp(4 − 4·r/rowsBelow + flick, 0, 4)`, `flick` aus 12,5-Hz-Zeilenjitter (Xorshift32), Spalten-Checker `(x + r) & 1` wechselt zwischen `e` und `e−1`. Ein aktiver Floor überdeckt es.
6. Funken (Pool 24; `Int16Array` für x, y, vx, vy, life): 1-Zellen-Quadrate in Stufe `L−2` (gelb) bzw. `L−1` (weiß), steigen mit Wind, Lebensdauer 0,5–1,2 s, danach frei.
7. Zuletzt `bayerFadeCells(..., vis)`.

**Tension → Verhalten** (`srcLevel = lerp(0.40, 1.00, ten)`, `coolBase = lerp(14, 4, ten)`: bei `ten = 1` erreichen die Flammen die Oberkante, bei `ten = 0` ca. 40 % der Fläche über dem Horizont; `sparkMax = ten < 0.35 ? 0 : ten < 0.70 ? 12 : 24`; `windAmp = ten < 0.35 ? 0 : ten < 0.70 ? 1 : 2` Zellen)

| Zustand / Band | Sichtbares Verhalten |
| --- | --- |
| `starting` | Quellzeile aktiviert sich von der Mitte nach außen (aktive Breite = `vis · cols`), zusätzlich Bayer-Fade |
| `playing` / low | niedrige, ruhige Zungen, kein Wind, keine Funken |
| `buildup` / mid | höhere Flammen, Wind ±1 Zelle alle 0,8 s, bis 12 Funken |
| `climax` / high | Inferno bis zur Oberkante, sinusförmige Windböen ±2 Zellen, bis 24 Funken |
| `afterglow` | Familie `BLUE` („kaltes Feuer“), `srcLevel × 0.35`, `coolBase × 1.8`, Funken aus. Hitzefeld bleibt erhalten, die Flammen sinken von selbst |
| `stopping` | Quelle fährt auf 0, das Feuer erlischt durch Abkühlung; in den letzten 0,6 s Bayer-Fade bis Schwarz |

**Beat → Verhalten**

| Auslöser | Reaktion |
| --- | --- |
| `impulse` (kontinuierlich) | `srcLevel × (1 + 0.9·impulse)` (Flackern der Quelle), Windversatz `+ dir·round(impulse·1.5)` Zellen |
| soft | Segment `hash(count) % 6` (1/6 der Breite) bekommt 2 Schritte lang `+60` Hitze |
| medium | 3 Segmente (`hash`-gewählt, Xorshift32) wie soft, dazu 4 Funken aus diesen Segmenten |
| hard | Feuersäule: Breite `max(3, cols/16)` an `hash(count)`-Position, Quelle 6 Schritte (0,12 s) auf 255, dazu 10 Funken (max. 1×/0,25 s) |
| jeder 4. Beat | `setFamily((fam + 1) % 4)`, Wipe-Koordinate `q = 1 − y/rows` (Farbfront klettert von unten nach oben) |
| jeder 8. Beat | Windrichtung kippt (`windSign = −windSign`), Böe 0,6 s |

**Kanäle:** `zoneW(x)` interpoliert kosinusförmig zwischen den Ankern `[1/6, 1/2, 5/6]·cols` mit den Werten `0.25 + 0.75·ch(v)`. Stimme 0 speist die linke, 1 die mittlere, 2 die rechte Flammenzone. Ohne `smooth` gilt `ch = 0` (Mindestflamme 0,25), das Feuer lebt dank Rauschen weiter.
**Responsive:** Zellgröße und Spaltenzahl folgen dem Buffer; Porträt (≈ 46 Spalten) zeigt drei schmale Flammensäulen, Ultrawide eine breite Feuerwand mit denselben drei Zonen.
**Budget:** Simulation ≤ 8000 Zellupdates/Schritt, ≤ 3000 `fillRect`/Frame (Run-Merging), Funken ≤ 24, `rnd` nur aus dem Instanz-Xorshift32.
**Zusatztests (`test/c64-fire-wall.test.mjs`):** gleiche Eingabesequenz → identische Operationsfolge über 300 Frames; Resize Porträt → Querformat erhält Hitzefeld (kein Nullfeld); Funkenpool wächst nie über 24; `hard` löst höchstens 1 Säule je 0,25 s aus; ohne `beatStarted` bleibt `fam` unverändert.

---

### 5.3 `C64SineScroller` — foreground

**Vorbild:** DYCP-Sinus-Scroller: jede Zeichenspalte hat eine eigene Y-Position, die Farbe wechselt pro Rasterzeile (Raster-IRQ), der Text läuft endlos.
**Registry:** `.systems('c64').layer('foreground').weight(12).duration(15.0).climaxHold(12.0)`

**Aufbau**

1. **Font:** Bitmap-Schrift aus `track-presenter.js` bzw. `bitmap-font.js` (§4) verwenden, kein `fillText`. Glyphzelle `GW×GH` aus dem Fontmodul. Zeichenvorrat Großbuchstaben, Ziffern, Leerzeichen und `.,:!?-+*'`; Unbekanntes wird zu `?`. Der Text ist eine Konstante `SCROLL_TEXT` im Modul (Beispiel: `"   CHIPTUNES FANTASY   *   GREETZ TO ALL SID FANS   *   KEEP THE BEAT ALIVE   *   "`), nicht aus Track-Metadaten abgeleitet (dafür ist `TrackPresenter` zuständig).
2. `scale = clamp(floor(minDim / 52), 2, 4)`, `gw = GW·scale`, `gh = GH·scale`.
3. **Layout-Modus** `wide` bei `width >= 0.75·height`, sonst `tall`. Der Moduswechsel bei Resize läuft ohne Reset, `scrollPos` (Float, in Glyphbreiten) bleibt erhalten.
   - `wide`: horizontales Band, Grundlinie `y0 = floor(0.30·height − gh/2)`, Versatz je Fontspalte `dy(x)` (DYCP).
   - `tall`: vertikales Band bei `x0 = floor(width/2 − gw/2)`, Text steht aufrecht und scrollt aufwärts, Versatz je Pixelzeile `dx(y)` (Dist-Look). So nutzt Porträt die lange Achse statt nur 5–6 Zeichen zu zeigen.
4. **Versatz:** `off(s) = Aeff(s) · (sin(2π·s/λ + φ) + h2·sin(2π·s/(0.43·λ) − 1.3·φ))`, `s` = Spalten-x bzw. Zeilen-y, `λ = lerp(14, 7, ten)·gw`, `h2 = ten > 0.70 ? 0.4 : 0`, `φ` wandert mit `0.9 + 1.6·ten` rad/s plus Beat-Zucken `0.6·impulse·dir`. `Aeff(s) = A·(0.55 + 0.9·wch(s))`, `A = lerp(0.015, 0.075, ten)·height·(1 + 0.9·impulse)`, in `wide` so geklemmt, dass das Band zwischen `y = 3` und `horizon − 3` bleibt.
5. **Rasterfarbe:** `bandRows = scale·2`, Farbe je Absolutzeile `yAbs`: `RAMP[fam][PP[floor((yAbs + rasterPhase) / bandRows) % PP.length]]`, `rasterPhase += lerp(8, 40, ten)·dt`.
6. **Zeichnen:** je Fontspalte (`wide`) bzw. Pixelzeile (`tall`) die gesetzten Pixel zu Läufen bündeln. Erst Outline-Pass: jeder Lauf als schwarzes `fillRect`, in allen Richtungen 1 px größer (Kontrast vor hellen Backgrounds wie `ChunkyPlasma`). Dann Farbpass: Lauf an Rasterband-Grenzen zerlegen.
7. **Echo-Zeile** (nur `ten >= 0.35`, Hysterese: aus bei `ten < 0.25`): dieselbe Schleife 1,6·Glyphhöhe versetzt, `RAMP.GREY`, Amplitude ×0,6, Phase +0,8. Die Aktivierung wird beim nächsten `beatStarted` übernommen, spätestens nach 1,2 s.

**Tension → Verhalten** (`speed = lerp(32, 96, ten)` Retro-px/s, in `afterglow` ×0,4)

| Zustand / Band | Sichtbares Verhalten |
| --- | --- |
| `starting` | `scrollPos = −sichtbareGlyphen`: die Zeile ist leer, der erste Buchstabe läuft vom Rand ein. Amplitude `A · vis`, Text zunächst gerade. Kein Schwarz-Vollbild. |
| `playing` / low | flache Welle (≈ 3 px), lange Wellenlänge, Raster `BLUE`/`GREY` träge (8 Zeilen/s), eine Textzeile |
| `buildup` / mid | Amplitude ≈ 8 px, Raster `PURPLE`, Echo-Zeile aktiv, Wellenlänge kürzer |
| `climax` / high | Amplitude ≈ 15 px, zweite Harmonische, Raster `FIRE` schnell (40 Zeilen/s), Echo-Zeile |
| `afterglow` | Welle beruhigt sich (Amplitude × `ten`, `ten ≤ 0.30`), Raster `BLUE`, Echo aus, Text läuft weiter |
| `stopping` | `A · vis`, `speed × 2`, die Textquelle liefert nur noch Leerzeichen: der Text läuft aus dem Bild, kein Nachspawnen |

**Beat → Verhalten**

| Auslöser | Reaktion |
| --- | --- |
| `impulse` (kontinuierlich) | Amplitude `× (1 + 0.9·impulse)`, Phasenzucken `0.6·impulse·dir`, Grundlinie `− round(impulse·scale·2)` px (Hüpfen) |
| soft | `rasterPhase += bandRows` (Farbmarsch um ein Band) |
| medium | `rasterPhase += 2·bandRows`, Glyphen der Zone mit dem höchsten `ch` für 0,2 s eine Rampenstufe heller |
| hard | `rasterPhase += 3·bandRows`, die drei Glyphen um die Bandmitte 0,12 s in Rampen-Top (max. 1×/0,25 s) |
| jeder 4. Beat | `setFamily((fam + 1) % 4)`, Wipe-Koordinate `q` = relative Bandposition (von links bzw. oben) |
| jeder 8. Beat | Wellenlaufrichtung kippt (`phiSign = −phiSign`). Die Scrollrichtung bleibt, damit der Text lesbar bleibt. |

**Kanäle:** `wch(s)` interpoliert linear zwischen den Ankern `[1/6, 1/2, 5/6]` der Bandachse mit `ch(0..2)`. Jede Drittel-Zone des Scrollers tanzt also zu „ihrer“ SID-Stimme; Glyphen darin sind zusätzlich `round(1.5·ch)` Rampenstufen heller. Ohne `smooth`: `wch = 0`, die Welle läuft aus `t`.
**Responsive:** `scale` und Amplitude über `minDim`; `tall`-Modus unter Seitenverhältnis 0,75 (Porträt), `wide` sonst (Querformat, Fenster, Vollbild, Ultrawide). Auf Ultrawide mehr Glyphen sichtbar, die Welle behält ihre Wellenlänge in Glyphbreiten. Mindestgröße `scale = 2`.
**Budget:** ≤ 2500 `fillRect`/Frame (Outline + Farbbänder); keine Allokation, Glyphlaufdaten vorberechnet.
**Zusatztests (`test/c64-sine-scroller.test.mjs`):** kein `fillText`/`measureText`; alle `fillRect` ganzzahlig und im Buffer; Moduswechsel Porträt ↔ Querformat erhält `scrollPos`; in `stopping` werden keine neuen Nicht-Leerzeichen mehr eingespeist; `fam` wechselt nur bei `count % 4 === 0`; Outline wird vor dem Farbpass gezeichnet.

---

### 5.4 `C64BorderRasters` — foreground

**Vorbild:** Der C64-Rahmen als Instrument: Rasterbalken im Border (`$D020` pro Zeile), Open-Border-Sprites, die durch den Rand laufen.
**Registry:** `.systems('c64').layer('foreground').weight(11).duration(14.0).climaxHold(10.0)`

**Aufbau**

1. Rahmenstärke `bt = clamp(round(minDim·0.07), 4, 14)`, `btEff = min(floor(minDim/4), floor(bt·vis) + round(impulse·2))` (Rahmenatmung ≤ 2 px).
2. **Zeilenfarbe** `lineColor[y]` (`Uint8Array(height)`, Instanzbesitz, bei Resize neu): Start Index 0. Balkengruppen `g = 0..2` (eine je SID-Stimme) mit `nb` Balken (`ten < 0.35 ? 1 : ten < 0.70 ? 2 : 3`). Balken `k`: Mitte `yc = height·(0.5 + 0.42·sin(2π·fg·t·sinSign + φg + 2π·k/nb)) + dir·0.06·height·impulse`, `fg = lerp(0.16, 0.45, ten)·(1 + 0.12·g)`, `φg = g·2π/3`. Halbdicke `th = round(lerp(3, 6, ten)·(0.6 + 0.9·ch(g))·(1 + 0.2·impulse))`. Profil: `u = |y − yc|/th`, Rampenstufe `round((1 − u)·(L−1))`, Zeilen mit Stufe 0 bleiben unverändert. Reihenfolge `g = 0,1,2`, spätere Gruppen überdecken frühere.
3. **Stimmenfamilien:** `voiceRamp(g) = [RAMP.FIRE, RAMP.GREEN, RAMP.BLUE][(g + rot) % 3]`. So lässt sich jeder Balken einer Stimme zuordnen.
4. **Zeichnen:** links und rechts für `y ∈ [btEff, height − btEff)`: Läufe gleicher `lineColor` als `fillRect(0, y, btEff, run)` und `fillRect(width − btEff, y, btEff, run)`. Oben und unten (je `btEff` Zeilen): Vollbreite je Lauf. Ab climax Schrägstreifen in 16-px-Segmenten mit Farbe `lineColor[(y + (x >> 4)·2) % height]` (Cycle-exact-Look).
5. **Innenkante:** 1 px Index 0 am inneren Rahmenrand (4 `fillRect`) für Kontrast vor hellen Backgrounds.
6. **Border-Sprites** (Pool 8, entspricht den 8 Hardware-Sprites): 7×7-Sternbitmap (hartkodiert), Skalierung `s = max(1, floor(bt/4))`, 1 px schwarze Kontur. Bahn: Umlauf auf der Rahmenmittellinie, Länge `Lp = 2·((width − bt) + (height − bt))`, Richtung `loopDir`. Speed `lerp(50, 120, ten)` px/s, Lebensdauer ein Umlauf oder max. 4 s. Farbe: Stufe `L−2` der Familie der Stimme mit dem höchsten `ch` zum Spawn-Zeitpunkt.
7. Kein Schwarz-Fade: Ein- und Ausblenden nur über `btEff`.

**Tension → Verhalten**

| Zustand / Band | Sichtbares Verhalten |
| --- | --- |
| `starting` | `btEff` wächst in ganzzahligen Schritten von 0 auf `bt`: der Rahmen „öffnet sich“; Balken erscheinen mit |
| `playing` / low | 1 Balken je Stimme, dünn, träge (0,16–0,24 Hz), oben/unten einfarbige Streifen, keine Sprites |
| `buildup` / mid | 2 Balken je Stimme, doppelte Frequenz, Rahmenatmung aktiv, Sprites nur bei hard |
| `climax` / high | 3 Balken je Stimme (9 Balken), Schrägstreifen oben/unten, Sprites bei medium und hard (Pool 8) |
| `afterglow` | alle Stimmen `RAMP.BLUE`, Dicke ×0,6, Frequenz ×0,4, Schrägstreifen aus, keine neuen Sprites (laufende laufen aus) |
| `stopping` | `btEff` schrumpft ganzzahlig auf 0, Sprites verlassen den Rahmen |

**Beat → Verhalten**

| Auslöser | Reaktion |
| --- | --- |
| `impulse` (kontinuierlich) | Balken-Nudge `dir·0.06·height·impulse`, Rahmenatmung bis +2 px, Balkendicke +20 % |
| soft | Kernzeile (1 px Balkenmitte) der Stimme mit dem höchsten `ch` springt bis zum nächsten Beat eine Stufe höher |
| medium | Kern +2 Stufen und alle Balken dieser Stimme +1 Stufe für 0,2 s |
| hard | Sprite-Start (max. 1×/0,25 s, Pool ≤ 8), alle Kerne 0,12 s in Top-Stufe |
| jeder 4. Beat | `rot += 1` (Familienrotation der Stimmen), Wipe-Koordinate `q = y/height` (von oben nach unten) |
| jeder 8. Beat | `sinSign = −sinSign` (Balkenlauf kippt) und `loopDir = −loopDir` (Spritumlauf kippt) |

**Kanäle:** Stimme `g` besitzt Balkengruppe `g`, Dicke und Kernhelligkeit folgen `ch(g)`. Ohne `smooth` pendeln die Balken mit Grunddicke weiter.
**Responsive:** `bt` über `minDim`; Porträt ≈ 6 px, Querformat ≈ 14 px. Der Rahmen folgt immer dem Buffer-Rand, Balken laufen über die volle Höhe, bei Ultrawide verlängert sich nur die Top-/Bottom-Border.
**Budget:** ≤ 600 `fillRect` (Läufe), ≤ 8 Sprites × 20 `fillRect`; Schrägstreifen oben/unten ≤ 1000 `fillRect` bei Ultrawide.
**Zusatztests (`test/c64-border-rasters.test.mjs`):** Pool nie > 8; Sprites nur bei `beatStarted` mit `level 3` (oder medium im climax); `btEff` bleibt in allen Viewports `<= floor(minDim/4)`; keine Zeichenoperation im Inneren (`x ∈ [bt, width−bt)`, `y ∈ [bt, height−bt)`) außer Sprites; `rot` wechselt nur bei `count % 4 === 0`.

---

### 5.5 `C64RasterRoad` — floor

**Vorbild:** Raster-Straße aus C64-Rennspielen und Demos: Breite und Farbe je Scanline aus Tabellen, alternierende Streifen erzeugen Tempo, die Kurve wird als Zeilenversatz gerechnet.
**Registry:** `.systems('c64').layer('floor').weight(12).duration(15.0).climaxHold(14.0)`

**Aufbau (alles geclippt auf `y >= horizon`)**

1. `H = height − horizon`; Zeile `r = 1..H` ↔ `y = horizon + r − 1`; `p = r/H`; Tiefe `z = 1/p`.
2. Straßenhalbbreite `hw = hwB·p·(1 + 0.04·impulse)`, `hwB = 0.5·min(0.92·width, 1.05·height)`. Das ergibt im Porträt 92 % der Breite, im Querformat/Ultrawide eine Straße von ≈ 1,05·Höhe mit Gras-Seitenflächen.
3. Kurvenversatz `cx(r) = width/2 + curve·(1 − p)²·0.30·width`, `curve = curveAmp·curveSign·(0.7·sin(0.37 t) + 0.3·sin(0.91 t + 1.3))`.
4. Streifen: `band = floor((z + dist) / period) & 1`, `period = 0.28` z-Einheiten. **Dunstzone:** Zeilen mit Bandstärke `period·r²/H < 1.5` (sonst Moiré) zeichnen die Farben A/B zeilenweise abwechselnd (Zeilen-Dither), unabhängig von `dist`.
5. Segmente je Zeile von links: Gras `[0, xl−kw)`, Kerb `[xl−kw, xl)`, Straße in 3 Lanen `[xl, xr)`, Kerb, Gras. `xl = cx − hw`, `xr = cx + hw`, `kw = max(1, round(hw·0.10))`. Mittelstriche an den Lanengrenzen nur bei `band == 0` und `hw >= 6`, Breite `max(1, round(hw·0.02))`.
6. Pylonen (ab mid, ≤ 10 je Seite): `z_k = ((k·0.55 − dist) mod 5.5) + 1.0`, `r_k = H/z_k`, Höhe `max(2, round(0.12·minDim·p_k))`, Breite `max(1, round(höhe/4))`, x = `cx(r_k) ± hw_k·1.18`, weiß mit rotem 2-px-Kopf, 1 px schwarze Kontur.
7. Gate (Pool 3): zwei Pylonen plus Querbalken in Top-Stufe, `z` von 5,5 nach 1,0 mit Straßengeschwindigkeit.
8. Speed-Streaks (nur high, Pool 12): kurze Linien (Index 1/15) außerhalb der Straße, vom Fluchtpunkt weg, Positionen aus Xorshift32, geclippt.
9. Zuletzt `bayerFadeCells(ctx, 0, horizon, width, H, vis)`.

**Familien** (Gras A/B · Straße A/B · Kerb A/B · Mittelstrich): Gras `13/5 · 11/12 · 2/1 · 1`; Wüste `7/8 · 12/15 · 9/1 · 1`; Eis `1/15 · 11/12 · 14/1 · 3`; Nacht `6/0 · 0/11 · 4/3 · 7`. Die Familie `famIdx` rotiert unabhängig von den 4 Rampenfamilien aus §5.0; `afterglow` erzwingt `Nacht`.

**Tension → Verhalten** (`v = lerp(0.28, 1.10, ten)` z/s, `vEff = min(1.7, v·(1 + 1.5·impulse))`: Streifenwechsel am unteren Rand bleiben ≤ 6/s; `curveAmp = lerp(0.15, 0.90, ten)`)

| Zustand / Band | Sichtbares Verhalten |
| --- | --- |
| `starting` | Straßenbreite wächst von der Mittellinie (`hw · vis`), Gras erscheint per Bayer-Fade unterhalb des Horizonts |
| `playing` / low | langsame Fahrt, sanfte Kurve, keine Pylonen, Lanen-Licht nur durch Stimmen |
| `buildup` / mid | Pylonen beidseitig, Mittelstriche, deutlichere Kurve, Kerb-Animation |
| `climax` / high | schnellste Fahrt, volle Kurve, Speed-Streaks, bei hard Regenbogen-Kerb (Zyklus `2→8→7→5` über Zeilenbänder, 0,3 s) |
| `afterglow` | Familie `Nacht`, `v × 0.35`, `curveAmp ≤ 0.2`, keine Pylonen, keine Streaks |
| `stopping` | `hw · vis` schrumpft zur Mittellinie, Bayer-Fade unterhalb des Horizonts bis Schwarz |

**Beat → Verhalten**

| Auslöser | Reaktion |
| --- | --- |
| `impulse` (kontinuierlich) | `dist += vEff·dt` (Tempostoß: die Streifen springen mit jedem Beat sichtbar vor), Straßenbreite ±4 % |
| soft | Kerbphase +1 (A/B tauschen für diesen Beat) |
| medium | Kerbphase +1 und Pylonenköpfe 0,2 s in Index 7 (gelb) |
| hard | Gate-Spawn (Pool 3, max. 1×/0,25 s) und Regenbogen-Kerb 0,3 s |
| jeder 4. Beat | `famIdx = (famIdx + 1) % 4` per Wipe, `q = p` (der Wechsel rollt vom Horizont zum Betrachter) |
| jeder 8. Beat | `curveSign = −curveSign` mit 0,5 s Slew |

**Kanäle:** Die drei Lanen gehören den drei Stimmen (links, Mitte, rechts). `lit(k)` mit Hysterese (an ab `ch(k) >= 0.6`, aus ab `< 0.4`): Straßenfarben der Lane werden eine Stufe heller (`11/12` → `12/15`), die angrenzenden Mittelstriche in Index 1. Ohne `smooth` bleibt `lit = false`; Fahrt und Kurve laufen aus `t`.
**Responsive:** Porträt: Straße füllt die Breite, Pylonen am Rand begrenzt. Querformat/Ultrawide: Straße zentriert, Gras-Streifen laufen über die volle Breite (Speed-Streaks nutzen die Seitenflächen). 3:1 und 1:3 dürfen nur endliche, nichtnegative Rechtecke erzeugen.
**Budget:** ≤ 1500 `fillRect`/Frame (Zeilensegmente ≈ 8 je Zeile × ≤ 100 Zeilen, Pylonen, Streaks).
**Zusatztests (`test/c64-raster-road.test.mjs`):** Fake-Canvas meldet jede Operation mit `y < horizon`; `vEff <= 1.7` in jedem Frame; in der Dunstzone hängt die Farbe nicht von `dist` ab; Gate nur bei `beatStarted` und `level 3`; Lane-`lit` flackert nicht bei `ch` um 0,5 (Hysterese).

---

### 5.6 `C64DanceFloor` — floor

**Vorbild:** Disco-Kachelboden: Kachelfarben wie aus dem Color-RAM, Lichtmuster laufen als Chase, Ripple und Suchscheinwerfer über das Raster.
**Registry:** `.systems('c64').layer('floor').weight(12).duration(14.0).climaxHold(12.0)`

**Aufbau (alles geclippt auf `y >= horizon`)**

1. Basis unterhalb des Horizonts in Index 0 (Fugenfarbe). `H = height − horizon`, `p = r/H`, `z = 1/p`.
2. Kachelreihen `j = 0..8` (`J = 9`, `j = 0` vorne): `z_j = 1 + j·0.45`, Zeilenbereich `[H/z_{j+1}, H/z_j)`. Oberhalb von `H/5.05` (≈ 20 % des Floors) bleibt Index 0.
3. Spalten `i ∈ [−30, 30]` (`NC = 61`): Grenze `i` bei `x = width/2 + i·Wb·p`, `Wb = max(8, round(min(width, 1.6·height)/8))·(1 + 0.03·impulse)`. Muster sind in Kachelkoordinaten relativ zur Mitte definiert, nicht normiert auf die Breite: Ultrawide zeigt mehr Kacheln, nicht gestreckte.
4. `lvl = Uint8Array(NC·J)` (0..4), Instanzbesitz. Darstellung je Zeile: Segment `[xl, xr − (p > 0.45 ? 1 : 0))` pro Kachel, Farbe `lvl == 0 ? OFF : RAMP[fam][LVL_IDX[lvl]]`; benachbarte gleiche Farben verschmelzen. Fuge zwischen Reihen: erste Zeile jeder Reihe bleibt Index 0. `OFF = 11`, in `afterglow` `6`. `LVL_IDX = L == 6 ? [0,1,2,4,5] : [0,1,2,3,4]`.
5. Zuletzt `bayerFadeCells(ctx, 0, horizon, width, H, vis)`.

**Musterengine (50-Hz-Schritte).** Zerfall: alle `lvl − 1` alle `decayEvery` Schritte, `decayEvery = ten < 0.35 ? 8 : ten < 0.70 ? 6 : 5` (`afterglow`: 10). Muster `pat = floor(count/4) % 4` (deterministisch aus `beatCount`). Ohne `beatStarted` seit > 1,2 s läuft ein interner Takt mit 2 Hz, der nur soft-Events erzeugt und nie das Muster wechselt.

| `pat` | Muster | Wirkung bei Beat |
| --- | --- | --- |
| 0 | Diagonal-Chase | Kacheln mit `(i + j) mod 4 == count mod 4` (25 %) auf `amp` |
| 1 | Stimmen-Wasserfall | alle 5 Schritte rutschen die Reihen um eins nach hinten, Vorderreihe `lvl = round(ch(zone)·4)`; Zonen = Drittel der Breite. Beat setzt zusätzlich die Vorderreihe auf `amp` |
| 2 | Ripple (Pool 3) | Beat startet Ring von `(0, 2)`; Radius `R = (t − t0)·9` Kacheln, Kacheln mit `abs(hypot(i, j−2) − R) < 0.6` auf `amp` |
| 3 | Suchscheinwerfer | Linie durch `(0, 3)`, Winkel `φ = φ0 + 0.6·(1 + ten)·t`, Kacheln mit Abstand `< 0.7` auf Stufe 3; Beat: `φ0 += 0.15·level` |

`amp = soft 2, medium 3, hard 4`, immer `min(amp, lvlCap)`.
**Funkeln (alle Muster):** alle 4 Schritte je Stimme `n = floor(ch(v)·3 + 0.4)` zufällige Kacheln der Zone (Xorshift32) auf Stufe 3.

**Tension → Verhalten** (`lvlCap = ten < 0.35 ? 2 : ten < 0.70 ? 3 : 4`)

| Zustand / Band | Sichtbares Verhalten |
| --- | --- |
| `starting` | Reihen „booten“ von hinten nach vorn (`jVis = ceil(J·vis)`, sichtbar `j >= J − jVis`), dazu Bayer-Fade |
| `playing` / low | wenige Kacheln, lange Nachleuchtzeit, Stufen ≤ 2, Rampe aus `fam` (zunächst `BLUE`) |
| `buildup` / mid | dichter, Stufen ≤ 3, kürzere Nachleuchtzeit, Muster wirken auf jedem Beat |
| `climax` / high | Stufen ≤ 4, Doppelmuster (aktuelles Muster plus Chase auf jedem Beat), Regenbogenreihen `fam_j = (fam + j) % 4` |
| `afterglow` | `lvlCap = 2`, Familie `BLUE`, Zerfall langsam, Funkeln ×0,3, nur soft schreibt noch Kacheln, Muster bleibt eingefroren |
| `stopping` | Reihen verschwinden von vorn nach hinten (`jVis` fällt), danach Bayer-Fade bis Schwarz |

**Beat → Verhalten**

| Auslöser | Reaktion |
| --- | --- |
| `impulse` (kontinuierlich) | Kachelbreite ±3 %, Darstellung aller Kacheln mit `lvl >= 2` um `round(impulse)` Stufe heller (nur Anzeige, ändert `lvl` nicht) |
| soft | Muster-Tick mit `amp 2` |
| medium | Tick mit `amp 3` plus 6 Funken in der Zone mit dem höchsten `ch` |
| hard | Tick mit `amp 4` plus vier Eckkacheln der Vorderreihe auf Stufe 4 (max. 1×/0,25 s) |
| jeder 4. Beat | Musterwechsel (`pat`), ohne Re-Seed der Kacheln |
| jeder 8. Beat | `setFamily((fam + 1) % 4)`, Wipe-Koordinate `q = p` (Horizont zuerst) |

**Kanäle:** Zonen links/Mitte/rechts gehören den Stimmen 0/1/2 (Funkeln in allen Mustern, Wasserfall in Muster 1). Ohne `smooth`: kein Funkeln, Muster laufen über den Takt.
**Responsive:** Kachelgröße über `min(width, 1.6·height)`; Porträt ≈ 8 Kacheln breit, Ultrawide ≈ 12–14 sichtbare Spalten am unteren Rand. `NC = 61` deckt auch 3:1 ab, nicht abgedeckte Randspalten bleiben Fuge (Index 0).
**Budget:** ≤ 2500 `fillRect`/Frame, `lvl` 61·9 Bytes, keine Allokation im Renderloop.
**Zusatztests (`test/c64-dance-floor.test.mjs`):** `pat` wechselt nur bei `count % 4 === 0`; Ripple-Pool nie > 3; `lvl` bleibt in `0..4`; keine Operation oberhalb `horizon`; ohne `beatStarted` bleibt `pat` stabil, aber der interne Takt erzeugt Bewegung; Ultrawide und 1:3 erzeugen nur Operationen im Buffer.

---

## 6. Registry-Einträge

Nur ergänzen, bestehende Einträge nicht verändern. Importe oben in `registry.js`, Einträge in den passenden Abschnitten:

```javascript
import { C64RasterTunnel } from './c64/raster-tunnel.js';
import { C64FireWall } from './c64/fire-wall.js';
import { C64SineScroller } from './c64/sine-scroller.js';
import { C64BorderRasters } from './c64/border-rasters.js';
import { C64RasterRoad } from './c64/raster-road.js';
import { C64DanceFloor } from './c64/dance-floor.js';

// --- BACKGROUNDS (C64) ---
RegisterDSE(C64RasterTunnel).systems('c64').layer('background').weight(11).duration(14.0).climaxHold(12.0).build(),
RegisterDSE(C64FireWall).systems('c64').layer('background').weight(12).duration(12.0).climaxHold(12.0).build(),

// --- FLOORS (C64, bisher keine) ---
RegisterDSE(C64RasterRoad).systems('c64').layer('floor').weight(12).duration(15.0).climaxHold(14.0).build(),
RegisterDSE(C64DanceFloor).systems('c64').layer('floor').weight(12).duration(14.0).climaxHold(12.0).build(),

// --- FOREGROUNDS (C64) ---
RegisterDSE(C64SineScroller).systems('c64').layer('foreground').weight(12).duration(15.0).climaxHold(12.0).build(),
RegisterDSE(C64BorderRasters).systems('c64').layer('foreground').weight(11).duration(14.0).climaxHold(10.0).build(),
```

- `maxInstances` bleibt beim Standard `1`. `.exclusive()` darf lokal zum Isolationstest gesetzt werden, **nicht** im Commit.
- Auf dem C64 existiert bisher nur `VoidFloor` im Layer `floor`. Mit zwei neuen Floors (je Gewicht 12) gegen `VoidFloor` (Gewicht 15) erscheint künftig häufiger ein sichtbarer Boden. Im Lieferbericht die resultierende Verteilung nennen und bei Bedarf die Gewichte nachjustieren.
- `Copperbars` ist universell und liegt im Layer `foreground`. Prüfen, wie `SetlistManager` mehrere Foreground-Kandidaten behandelt (eine Instanz je Layer oder je DSE), und das Ergebnis als Annahme dokumentieren.

## 7. Zusammenspiel und Kontrast (Pflicht-Stills)

Je Kombination Stills in 390×844, 844×390 und 2560×1080, in `climax` und `afterglow`:

| Kombination | Worauf achten |
| --- | --- |
| `C64RasterTunnel` × `C64RasterRoad` | gemeinsamer Fluchtpunkt auf dem Horizont: die Straße wirkt als Tunnelboden. Tunnel dunkler als die Straße, damit der Boden lesbar bleibt. |
| `C64RasterTunnel` × `C64SineScroller` | Scroller-Outline vor hellen Ringen (Climax-Split, `FIRE`) |
| `C64FireWall` × `C64RasterRoad` / `C64DanceFloor` | Floor überdeckt das Glutbett sauber ab `horizon`, Flammen bleiben darüber |
| `C64RetroSunset` × `C64RasterRoad` | Horizont und Gras-Farbfamilie passen zur Sonne (Outrun-Look) |
| `ChunkyPlasma` × `C64SineScroller` / `C64BorderRasters` | helles, bewegtes Background: Kontur und Innenkante tragen |
| `C64VectorStar` × `C64BorderRasters` | Rahmen verdeckt nur den Rand, Sprites laufen nicht über das Hauptobjekt hinweg (Sprite-Pfad im Rand halten) |
| `Copperbars` × `C64BorderRasters` | beide sind Rasterbalken: prüfen, ob sie sich optisch gegenseitig stören (nur melden, nicht ändern) |
| jeder Floor × `VoidBackground` / `VoidFloor` | keine Lücken, kein Zeichnen oberhalb des Horizonts |

## 8. Tests

Für jede der sechs Klassen sind alle elf Mindesttests aus den DSE-Entwicklungsregeln §9.1 Pflicht (Smoke, Numerik, Determinismus, Beat, Beat-Intensität, Beat an/aus, Zustände, Rotation, Palette, Viewport, Lifecycle). Dazu die DSE-spezifischen Tests aus §5.

- **Harness:** `makeMetrics(...)`, `runBeatIntensity(...)`, `GRADED_BEAT_STRENGTHS` (`soft 0.20`, `medium 0.50`, `hard 0.90`) aus `tools/dse-baseline/harness.js` verwenden. Nicht vorhandene Hilfen minimal selbst ergänzen und als Annahme melden.
- **Fake-Canvas:** strikt wie in §9.1 (Integer, Bounds, Palette, kein `globalAlpha`, `save()`/`clip()`, `getImageData()`, `fillText()`).
- **Palette:** jede `fillStyle` ∈ die 16 Hex-Werte aus `C64_PALETTE`.
- **Beat-Intensität:** Messgröße je DSE, die sich bei soft/medium/hard reproduzierbar und sichtbar unterscheidet:

| DSE | soft | medium | hard | Messgröße |
| --- | --- | --- | --- | --- |
| `C64RasterTunnel` | `shift +1`, Pulsring `L−3` | `shift +1`, Pulsring `L−2` | `shift +2`, Pulsring Top plus Zwilling | `shift`-Delta, Pulsringstufe und -anzahl |
| `C64FireWall` | 1 Segment `+60` | 3 Segmente, 4 Funken | Säule, 10 Funken | Summe der Quellhitze (6 Schritte), Funkenanzahl |
| `C64SineScroller` | `rasterPhase +1` Band | `+2` Bänder, Zone heller | `+3` Bänder, Mitten-Flash | `rasterPhase`-Delta, Anzahl Top-Glyphen |
| `C64BorderRasters` | Kern `+1` | Kern `+2`, Balken `+1` | Sprite, Kerne Top | Kernstufe, Spritezahl |
| `C64RasterRoad` | Kerbphase `+1` | Kerbphase `+1`, Köpfe gelb | Gate, Regenbogen-Kerb | Kerbfarbe, Gate-Pool |
| `C64DanceFloor` | `amp 2` | `amp 3`, Funken | `amp 4`, Ecken | max `lvl`, Anzahl leuchtender Kacheln |

```sh
node --test \
  test/c64-raster-tunnel.test.mjs \
  test/c64-fire-wall.test.mjs \
  test/c64-sine-scroller.test.mjs \
  test/c64-border-rasters.test.mjs \
  test/c64-raster-road.test.mjs \
  test/c64-dance-floor.test.mjs
```

Zusätzlich die bestehenden Suites laufen lassen, die Registry, Stage und Layer betreffen (`test/dj-engine-lifecycle.test.mjs`, `test/scene-dj-integration.test.mjs`, `test/graded-beat-routing.test.mjs`).

## 9. Abnahme und Lieferbericht

**Messung:** je DSE `fillRect`-Anzahl und Renderzeit (p50/p95 über 600 Frames) in 390×844, 844×390 und 2560×1080 im Zustand `climax`; Werte mit den Budgets aus §5 vergleichen. Überschreitungen mit Qualitätsreduktion lösen (Zellgröße, Ringzahl, Zeilenschritt), Palette und Determinismus bleiben unverändert.

**Visuelle Nachweise** (Harness oder gleichwertig): Zustandsübersicht inkl. `afterglow`, Porträt/Querformat/Ultrawide, 1:3 und 3:1, Rotationsfilmstrip mit derselben Instanz, Motion-Clips für `playing`/`buildup`/`climax`/`afterglow`, je ein Clip mit soft, medium und hard, Kombinations-Stills aus §7.

**Reale App** (DSE-Modus): Trackstart, Presenter-Verhalten, Fenster vergrößern/verkleinern, Vollbild, Mobile-Ausrichtung wechseln, Trackwechsel, `image-rendering: pixelated`, Konsole ohne neue Fehler.

**Lieferbericht (Pflicht):**

1. Neue und geänderte Dateien (inkl. `registry.js`, `hardware-constraints.js`, ggf. `bitmap-font.js`, Tests).
2. **Annahmen**, mindestens: Font-Modul vorhanden oder neu; reale Dauer von `starting`/`stopping`; Existenz von `bayerFadeCells` oder Extraktion; Kanalzuordnung `smooth[0..2]` = SID-Stimmen; Layer-Instanzmodell; Fallback bei fehlendem `beatLevel`.
3. Messtabelle (§9 Messung).
4. Offene Punkte, Abweichungen von diesem Prompt mit Begründung.
5. Commit-Vorschläge im Conventional-Commit-Format, z. B. `feat(dse/c64): add raster road and dance floor`, `feat(dse/c64): add raster tunnel and fire wall backgrounds`, `feat(dse/c64): add sine scroller and border rasters foregrounds`, `chore(visuals): add bayerFadeCells and xorshift32 helpers`.

**Zusätzliche Definition of Done (zu §11 der DSE-Regeln):**

- [ ] Alle sechs DSEs nutzen den Beat-Zustand aus §2 und lesen `beat[0]` nie als Trigger.
- [ ] hard-Sonderereignisse sind auf 1× je 0,25 s begrenzt; kein flächiger Hochkontrast-Blitz.
- [ ] Farbmärsche laufen nur über `pp(...)`; Familienwechsel nur per Wipe und nur an 4./8. Beat bzw. beim Verlassen von `afterglow`.
- [ ] Floors schreiben nachweislich nichts oberhalb `horizon`; Foregrounds blenden nie mit Schwarz-Vollbild-Dither.
- [ ] Ausblenden endet bei `vis = 0` vollständig (opake Layer warten darauf).
- [ ] Ohne Audio und ohne `smooth`/`beatImpulse` rendert jede DSE lebendig und fehlerfrei.

## 10. Empfohlene Implementierungsreihenfolge

1. **Helfer** in `hardware-constraints.js` (§4) mit eigenen Tests: Xorshift32, `bayerFadeCells`, geclippte Linie/Polygon.
2. **Floors zuerst** (`C64RasterRoad`, `C64DanceFloor`): sie schließen die Lücke am schnellsten und lassen sich gegen die vorhandenen C64-Backgrounds prüfen.
3. **Backgrounds** (`C64RasterTunnel`, `C64FireWall`).
4. **Foregrounds**: zuerst Font extrahieren (`bitmap-font.js`, Presenter-Tests müssen grün bleiben), dann `C64SineScroller`, dann `C64BorderRasters`.
5. **Registry** je DSE einzeln aktivieren (lokal `.exclusive()` zum Testen, vor dem Commit entfernen), danach Kombinationen aus §7.
6. **Reale App** testen, Lieferbericht schreiben.

Liefere nur neue oder geänderte Dateien.
