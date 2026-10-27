# Amiga Exact Worklet — Phase 4: A500-Ausgangsstufe

Stand: v1.5.4-Arbeitsstand nach Phase 4  
Produktions-Worklet SHA-256: `3c5097caa01dc6d21418500b360d00216d1983836456af2cf3cda2a07098236f`

## Ergebnis

Die A500-Ausgangskette ist jetzt eine lineare, deterministische Filterapproximation. Die digitale Paula-Emulation, das MOD-/XM-Sequencing, die COSO-/HIP-Wiedergabe, das Panning und das 3,5-%-Crosstalk bleiben unverändert.

Die Messungen verwenden weiterhin das reale Produktions-Worklet ohne Master-Gain, Master-Crossfeed oder Limiter. Alle Hashes sind selbst erzeugte Regressionsanker, keine Hardware- oder UADE-Wahrheitsbeweise.

## Befunde und Korrekturen

### 1. Nicht kalibrierte Nichtlinearitäten

Die bisherige `LF347OpAmpStage` war kein gemessenes LF347-Slew-Rate-Modell, sondern ein weicher `tanh`-Begrenzer mit den nicht belegten Asymmetriefaktoren 1,12 und 0,90. Danach folgte eine zweite, ebenfalls nicht kalibrierte `tanh`-Sättigung.

Beide Zusatzstufen wurden entfernt. Es wurde kein Ersatz-Limiter und keine neue Pegelkorrektur eingefügt. Die vorhandenen linearen RC-/LED-Filter, der 255-Tap-FIR und der Ausgangsfaktor 0,7 bleiben erhalten.

Vor der Korrektur betrug der maximale Superpositionsfehler eines synthetischen MOD-Tests am `a500`-Abgriff `0,001213114708662033`. Nach der Korrektur ergeben die Float32-Messungen:

| Abgriff | maximaler absoluter Superpositionsfehler |
|---|---:|
| `paula` | `1,1175870895385742e-8` |
| `zoh` | `1,1175870895385742e-8` |
| `a500` | `7,450580596923828e-9` |

Die verbleibenden Fehler liegen auf Float32-Quantisierungsniveau; die verbindliche Testgrenze ist `1e-6`.

### 2. LED-Bypasshistorie

Bisher wurde das LED-Filter im Bypass nicht verarbeitet. Seine History fror ein und wurde beim Wiedereinschalten veraltet weiterverwendet.

`A500ChannelFilter` verarbeitet nun immer beide Stufen:

1. statisches RC-Filter,
2. LED-Filter,
3. Auswahl des RC- oder LED-Ausgangs entsprechend dem LED-Schalter.

Damit ist der LED-Filterzustand beim Wiedereinschalten bitgleich zu einem durchgehend aktiven Filter. Der anschließende FIR enthält erwartbar noch 64 Ausgabe-Frames aus der Bypass-Zeit; erst nach dieser FIR-History ist auch die Gesamtausgabe wieder bitgleich zum Dauerbetrieb.

### 3. Unveränderte Filterapproximation

Die vorhandenen Werte wurden nicht nachträglich als hardwarevermessen ausgegeben oder anhand allgemeiner Webangaben verändert:

- statisches RC-Filter: 4,421 kHz, Einpol-Approximation,
- LED-Filter: 3,09 kHz, Q = 0,707, RBJ-Biquad-Tiefpass,
- DC-Verstärkung beider Stufen: jeweils 1.

Gemessene Modellkennwerte:

| Abtastrate | RC bei 4,421 kHz | LED bei 3,09 kHz |
|---:|---:|---:|
| 44,1 kHz | −2,8691 dB | −3,0116 dB |
| 48 kHz | −2,8908 dB | −3,0116 dB |
| 96 kHz | −2,9801 dB | −3,0116 dB |

Als externe Plausibilitätskontrolle diente der [WinUAE-Audiocode](https://github.com/tonioni/WinUAE/blob/master/audio.cpp): Er trennt ebenfalls statisches RC- und LED-Filter und kennzeichnet das LED-Verhalten selbst als messbedürftige Näherung. Es wurden keine WinUAE-Koeffizienten oder Genauigkeitsansprüche übernommen.

## Änderungsgrenze gegenüber Phase 3

Alle vier Referenzmessungen sind deterministisch, blockunabhängig, neustartstabil und endlich. Die digitalen `paula`- und `zoh`-Hashes sind bitgleich zu Phase 3. Ausschließlich `a500` erhält neue Anker.

| Messung | Abgriff | Phase-4-SHA-256 |
|---|---|---|
| COSO Level 1, 1 s | `paula` | `42522e05c3238b7e26201e11a541e37ae1cb193c2a340932ddc457ef94c43c3b` |
|  | `zoh` | `16cc273bb5e462b7dadbc4c03c0fde08b94aef10551f6f6da6f35c92dddb41bb` |
|  | `a500` | `90aad350d90036b1838fd8aaecfacc218a64dbfb848e50e4dcb769c596dad38c` |
| HIP68K Title, 1 s | `paula` | `2d6ec3bcd1509f08f2728aa04affc99250f5600df5483e6103840450312eece5` |
|  | `zoh` | `0ab3b1c0b7e8da773626439aa097b7e256284539f3a59cca48fc5c5ac28371ac` |
|  | `a500` | `2174a4137ee894839b99e90d7db53023b31149a5240d8a3d0de43fe19bd63eef` |
| GSLINGER.MOD, 30 s | `paula` | `dc4ad212e76d8c475fe9db5200bb980c82e567707c2d4011efef0cd56237a108` |
|  | `zoh` | `1154c83554ea8e69a012b4658dc5cb31728c45ba5129e9a659d0aa5f324a5db1` |
|  | `a500` | `ee09d29ca60e6029ea8c4d5a1196303b0fb4f7efc145d795286512cec7f1cd66` |
| space_debris.xm, 1 s | `paula` | `78e35614664956ed7b1f49651f1c6ebac1e247f033270f31a6a18c2b79aa1235` |
|  | `zoh` | `716ad047588c67053ee697b665be629218cc9f0218794234977127290df068c4` |
|  | `a500` | `36aa78265a844ebc154d04b672c51b1dba8a7b5d35999152031c2e07b4d391e2` |

A500-Peakwerte dieser Messungen: COSO `0,7291646004`, HIP68K `0,6952218413`, MOD `0,5065404773`, XM `0,0235235151`.

Der vollständige MOD-/XM-Korpus umfasst weiterhin zehn reale Titel. Alle sind endlich; sämtliche digitalen Hashes entsprechen Phase 3. Der höchste A500-Peak im einsekündigen Korpusfenster beträgt `0,7813665867`.

## Historische Provenienz

Die Phase-2- und Phase-3-Berichte bleiben unverändert. Ihre Tests prüfen den historischen Worklet-Hash als Provenienz und die aktuellen digitalen Ausgaben gegen die alten `paula`-/`zoh`-Anker. Sie verlangen ausdrücklich nicht mehr, dass die in Phase 4 korrigierte A500-Ausgabe einem historischen Fehlverhalten entspricht.

## Verifikation

- Phase-4-Suite: 17/17 Tests bestanden, keine Auslassungen.
- Vollständige Amiga-/Replay-Suite: 203/203 Tests bestanden, keine Auslassungen.
- Frischer Overlay aus Originalarchiv und Phase 0–4: ebenfalls 203/203 Tests bestanden.
- Gesamte Projektsuite: 328/329 Tests bestanden, keine Auslassungen. Der einzige Fehler ist der bereits aus Phase 3 bekannte, nicht amigabezogene SID-Test `SID synthetic corpus matches the reviewed Phase 3 raw/trace/WAV hashes`.

## Reproduktion

```bash
node tools/amiga-a500-characterize.mjs \
  --report doc/verification/amiga/phase4-a500-characterization.json

node tools/amiga-worklet-render.mjs \
  --input wings-of-death/Wings_Of_Death-Level_1.hipc \
  --seconds 1 --sample-rate 48000 --repeat 2 --phase 4 \
  --report doc/verification/amiga/phase4-exact-level1.json

node tools/amiga-worklet-render.mjs \
  --input wings-of-death/Wings_Of_Death-Title.hip \
  --seconds 1 --sample-rate 48000 --repeat 2 --phase 4 \
  --report doc/verification/amiga/phase4-exact-hip68k.json

node tools/amiga-worklet-render.mjs --input GSLINGER.MOD \
  --seconds 30 --sample-rate 48000 --repeat 2 --phase 4 \
  --report doc/verification/amiga/phase4-exact-mod.json

node tools/amiga-worklet-render.mjs --input space_debris.xm \
  --seconds 1 --sample-rate 48000 --repeat 2 --phase 4 \
  --report doc/verification/amiga/phase4-exact-xm.json

node tools/amiga-modxm-corpus.mjs --seconds 1 --phase 4 \
  --report doc/verification/amiga/phase4-modxm-corpus.json

node --test test/amiga-phase4.test.mjs
```

## Verbleibende Grenzen

- Es liegen keine bereitgestellten Hardware- oder UADE-Referenz-WAVs für eine externe Klang- oder Pegelabnahme vor.
- RC- und LED-Filter bleiben Näherungen. Ihre Werte sind projektseitige Modellparameter, keine neu gewonnenen Schaltungsmessungen.
- Die Produktionsabnahme über den vollständigen Amiga-Korpus und die Browserintegration bleibt Phase 5 vorbehalten.
