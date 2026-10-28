# Chiptunes Fantasy v1.5.4 — Amiga Exact, Phase 1

## 1. Ergebnis und Abgrenzung

Phase 1 korrigiert den digitalen Paula-Zeitfortschritt bei stummgeschalteter Lautstärke und macht `PLAY_TRACK` zu einem vollständigen, reproduzierbaren Neustart. Die vier untersuchten Formate COSO, HIP68K, MOD und XM liefern nach einem erneuten Start auf allen drei Messstufen (`paula`, `zoh`, `a500`) bitidentisch dieselbe Ausgabe wie ein frisch instanziiertes Worklet. Ein zusätzlicher Wechsel von COSO zu XM erfüllt dieselbe Bedingung.

Nicht verändert wurden PAL-Takt, Oversampling, DMA-Wortformat, LC/LEN-Reloadsemantik, L-R-R-L-Panning, Crosstalk, Filterkoeffizienten, Sättigung, FIR-Kernel, Pegel, COSO-Tickrate und die kontinuierliche MOD/XM-Effektsemantik. Die Korrektur der COSO-/HIP-Zeit- und Audiosemantik bleibt Phase 2 vorbehalten, die Tracker-Effekte Phase 3 und eine inhaltliche Neubewertung der A500-Analogstufe Phase 4. Die Trackauswahl bleibt unverändert.

Die neuen Hashes sind selbst erzeugte Regressionsanker, keine Hardware- oder UADE-Wahrheitsbeweise. Die Phase-0-Dateien bleiben als historische Messbefunde unverändert erhalten.

## 2. Digitale Paula-Korrektur

### AUDxVOL ist kein DMA-Stopp

Der bisherige frühe Rücksprung in `PaulaChannel.step()` behandelte `AUDxVOL = 0` wie einen angehaltenen Kanal. Dadurch blieben Periodenzähler, Bytephase, DMA-Zeiger, Wortfetch und Loop-Reload stehen. Beim erneuten Anheben der Lautstärke klang die Stimme dadurch an einer falschen Sampleposition weiter.

Jetzt wirkt `AUDxVOL` ausschließlich im DAC-Multiplikator `(heldValue * audVol) / 8128`. Ein deaktivierter DMA-Kanal bleibt weiterhin gestoppt; ein aktiver Kanal mit Lautstärke null läuft dagegen digital vollständig weiter und gibt lediglich null aus.

Der Regressionstest betreibt zwei echte `PaulaChannel`-Instanzen mit identischen Sampledaten und Taktfolgen, eine mit `AUDxVOL = 64` und eine mit `AUDxVOL = 0`. Nach jedem Teilschritt müssen DMA-Status, Zeiger, Restlänge, Periodenzähler, Bytephase, Wortpuffer, `AUDxDAT` und DAC-Latch exakt übereinstimmen. Nach dem Aufheben der Stummschaltung müssen beide Kanäle denselben Pegel liefern.

## 3. Vollständiger PLAY_TRACK-Reset

`PaulaChannel.reset()` stellt denselben Zustand wieder her wie ein neu erzeugter Kanal. Das umfasst Hardware- und DMA-Register, Loop- und Prefetch-Zustände sowie die im Kanal gehaltenen Tracker- und Effektzustände. Alle 64 vorhandenen Kanäle werden bei jedem `PLAY_TRACK` zurückgesetzt, nicht nur die gerade hörbaren vier beziehungsweise logischen Kanäle.

Zusätzlich werden im Processor zurückgesetzt:

- LF347-Ausgangspegel;
- RC-Filterhistorie;
- LED-Biquad-Ein- und Ausgangshistorie;
- FIR-Ringpuffer und Ringindex;
- Sequenzer-, Pattern-, Break-, Delay- und Tickzustände;
- COSO-VM-, Direct-Track- und Visualisierungszustände.

Die Resetmethoden verändern keine Filterkoeffizienten. `STOP_TRACK` und `RESUME_TRACK` bleiben bewusst davon getrennt: Pause und Fortsetzen dürfen weder Sampleposition noch Effekt- oder Analoghistorie verwerfen.

## 4. Messergebnisse

Alle Läufe verwenden den echten Produktions-Worklet bei 48 kHz, vierfachem Oversampling und den Phase-0-Abgriffen. Wiederholung und Blockmuster `[1, 17, 64, 255, 3, 128]` bleiben bitidentisch; alle Messwerte sind endlich. Master-Gain, Master-Crossfeed und Limiter sind weiterhin ausgeschlossen.

| Fall | Dauer | Wiederholt | Blockunabhängig | Neustart = frisch | Gegenüber Phase-0-Frischlauf geändert |
|---|---:|---|---|---|---|
| COSO Level 1 | 1 s | ja | ja | **ja** | keine Stufe |
| HIP68K Title | 1 s | ja | ja | **ja** | keine Stufe |
| MOD GSLINGER | 5 s | ja | ja | **ja** | `paula`, `zoh`, `a500` |
| XM Space Debris | 1 s | ja | ja | **ja** | keine Stufe |

Die Änderung im MOD-Frischlauf ist die erwartete Folge des korrigierten Verhaltens bei `AUDxVOL = 0`. Bei den drei anderen untersuchten Titeln bleibt die Frischausgabe unverändert; dort beseitigt Phase 1 ausschließlich die zuvor gemessene Neustartabweichung. Daraus wird keine allgemeine Hardwaretreue der übrigen Kette abgeleitet.

### Neue Float64LE-Regressionsanker

Worklet-SHA-256 in Phase 0: `973d7c17d1e9af6fd423c7bf0268917749652df51f1e78d786068178ff6bf90d`  
Worklet-SHA-256 in Phase 1: `5eff4044743d8343b6c6de39bc2aa38efce4ba571167e8071b4d718d870000db`

| Fall | `paula` | `zoh` | `a500` |
|---|---|---|---|
| COSO Level 1 | `619f88d41bbcdd63897255ddff61df37bb364d49c32b0be9a9bfdfe8ff9617a9` | `b4e376d8cfe49de0fe977edc6c92c4c88f6ced4bada102779badee2c4a01cafd` | `c470a5e4ed8377dac2af3adbf59ad058c5904d2580c0583d6156eccad36cf10e` |
| HIP68K Title | `f6f1789087a38acf5cbc2bbc45f0aa21cab9fbc7a92130d078bd0fbe5d6f14b7` | `0640d6df77451cc5b6341cadfb3a775993f7464bfec2f9d9116bda60de28cb09` | `07a50a83c6e3143007b093bc60acbeeca93df49c1cf02de740a8521b06eff1d8` |
| MOD GSLINGER | `e82978f89420173220008e2b6065faa579bcad3319d6b6058c8a11b6c875553b` | `4c4cbd3b79d65d492a837d07160e83dd3bb861963fa41a9b02130d9cf8028263` | `8ba4eee9c26db5d5bb8eb63ebf72b565241ec65e5df31dbbe29170d01e007120` |
| XM Space Debris | `4f9364c90633ccbb0a610188f67802f9ade37afe7a7c6da8d8935bdda6d9f0ee` | `2f5fdfb886ab347098ca2d9b440fefa9ea487f9c96726da1db6cca22386aa778` | `3cf653988004894fedc5aac922ea2b271c1f0bc6dc50b5ce97694198d43e507e` |

Die vollständigen Messdaten stehen in `phase1-exact-level1.json`, `phase1-exact-hip68k.json`, `phase1-exact-mod.json` und `phase1-exact-xm.json`.

## 5. Reproduktionskommandos

Alle Kommandos laufen aus dem Projektstamm mit Node.js 22 oder neuer.

```bash
# Digitale Paula-Semantik, vier Neustartfälle, Formatwechsel und Regressionsanker
node --test test/amiga-phase1.test.mjs

# Historische Phase-0-Nachweise und bestehende Hardware-DMA-Tests
node --test test/amiga-phase0.test.mjs test/paula-hw.test.mjs

# Beispiel: Phase-1-Messung mit verbindlicher Neustartabnahme
node tools/amiga-worklet-render.mjs \
  --input wings-of-death/Wings_Of_Death-Level_1.hipc \
  --seconds 1 --sample-rate 48000 --repeat 2 --phase 1 \
  --report doc/verification/amiga/phase1-exact-level1.json

# Weitere Fälle
node tools/amiga-worklet-render.mjs --input wings-of-death/Wings_Of_Death-Title.hip \
  --seconds 1 --repeat 2 --phase 1 \
  --report doc/verification/amiga/phase1-exact-hip68k.json
node tools/amiga-worklet-render.mjs --input GSLINGER.MOD \
  --seconds 5 --repeat 2 --phase 1 \
  --report doc/verification/amiga/phase1-exact-mod.json
node tools/amiga-worklet-render.mjs --input space_debris.xm \
  --seconds 1 --repeat 2 --phase 1 \
  --report doc/verification/amiga/phase1-exact-xm.json
```

Ohne `--phase` bleibt das Werkzeug aus Kompatibilitätsgründen im Phase-0-Modus. Ab `--phase 1` führt eine Abweichung zwischen Neustart und frischem Worklet zusätzlich zu einem Fehlerausgang. Damit kann der dokumentierte alte Resetbefund nicht mehr still als akzeptables Ergebnis zurückkehren.

Die fokussierte Amiga-Suite mit `--expose-gc` besteht aus 160 Tests und endet mit 160 bestandenen Tests ohne Fehler oder Skips. Die vollständige Suite umfasst nun 286 Tests: 285 bestehen, keiner wird übersprungen. Der einzige Fehler bleibt `SID synthetic corpus matches the reviewed Phase 3 raw/trace/WAV hashes`, derselbe bereits in Phase 0 dokumentierte SID-Altfehler außerhalb des Amiga-Änderungsumfangs.

## 6. Umgang mit historischen Baselines

Die Phase-0-Reports beschreiben absichtlich den damaligen Worklet-Stand. Ihre Hashes werden nicht nachträglich durch neue Ausgaben ersetzt. `test/amiga-phase0.test.mjs` prüft deshalb nun die interne Provenienz und den dokumentierten historischen Resetbefund, statt den korrigierten Worklet fälschlich gegen alte Audio-Hashes laufen zu lassen.

`test/amiga-phase1.test.mjs` prüft den aktuellen Worklet-Hash, reproduziert den COSO-Regressionsanker mit dem echten Offline-Harness und verlangt für alle vier Formate sowie für den Formatwechsel bitidentische Neustarts.

## 7. Phase-1-Abnahme und offene Arbeiten

- [x] `AUDxVOL = 0` stummt nur noch den DAC; DMA und Periodenzähler laufen weiter.
- [x] LC/LEN-, Loop-, Fetch- und Bytephase bleiben bei stummer Wiedergabe synchron zur hörbaren Referenz.
- [x] RC-, LED-, LF347- und FIR-Historien werden bei `PLAY_TRACK` zurückgesetzt.
- [x] Kanalgebundene Tracker-/Effektzustände und Processor-Schedulerzustände werden zurückgesetzt.
- [x] COSO, HIP68K, MOD und XM starten auf allen drei Abgriffen bitidentisch neu.
- [x] Ein COSO-zu-XM-Wechsel startet ohne messbare Historie des vorherigen Titels.
- [x] Wiederholung, Blockgrößenunabhängigkeit und finite Ausgabe bleiben nachgewiesen.
- [x] Keine vorgezogenen Tick-, Tracker- oder Analogparameteränderungen aus Phase 2 bis 4.

Offen bleiben die referenzpflichtigen COSO-/HIP-Diagnosen, die exakte Tick- und Playersemantik, kontinuierliche MOD/XM-Effekte sowie die messtechnische Bewertung der A500-Analogstufe. Die noch fehlenden externen UADE-WAVs werden durch diese Phase nicht ersetzt.
