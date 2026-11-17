# Atari-ST-Musik: Quellen und Aufnahme

## Datenquelle der 13 neuen YM-Dateien

Die neuen Registerdumps stammen aus dem öffentlichen Referenzarchiv **YM Jukebox**:

- Projekt: <https://github.com/nguillaumin/ym-jukebox>
- Verwendeter Stand: `a0acaa0867cd5473e679b8c952393128e24b7948`
- Die Quelldateien waren LH5-komprimiert. Für die Aufnahme wurde jeweils genau der enthaltene YM-Datenstrom entpackt. Registerdaten, eingebettete Metadaten und Digidrums wurden nicht verändert.
- Das Archiv weist selbst darauf hin, dass Metadaten und Duplikate fehlerhaft sein können. Titel, Autor, Format und Szenenangaben wurden deshalb nach dem Entpacken mit dem Parser des Projekts geprüft. Die Museumstexte unterscheiden Dateimetadaten von redaktionellem Kontext.

Das Referenzarchiv enthält keine allgemeine Neulizenzierung der historischen Musikdateien. Die vorhandenen Urheber- und Konvertierungsangaben bleiben erhalten; durch die Aufnahme in dieses Projekt werden keine neuen Rechte an den Musikdateien beansprucht.

| Projektdatei | Pfad im Referenzarchiv | Innerer Dateiname |
|---|---|---|
| `ghouls-n-ghosts/Ghouls_1.YM` | `data/Follin Bros/Ghouls 1.ym` | `GNG2.YM` |
| `ghouls-n-ghosts/Ghouls_2.YM` | `data/Follin Bros/Ghouls 2.ym` | `GNG5.YM` |
| `ghouls-n-ghosts/Ghouls_3.YM` | `data/Follin Bros/Ghouls 3.ym` | `GNG6.YM` |
| `speedball/Speedball_1.YM` | `data/Whittaker David/Speedball 1.ym` | `SPEEDB~4.YM` |
| `stormlord/Stormlord_Title.YM` | `data/Mad Max (Jochen Hippel)/Stormlord 1 - title.ym` | `STORMLO2.YM` |
| `stormlord/Stormlord_Ingame.YM` | `data/Mad Max (Jochen Hippel)/Stormlord 2 - ingame.ym` | `STORML~1.YM` |
| `chambers-of-shaolin/Chambers_Title.YM` | `data/Mad Max (Jochen Hippel)/Chambers of Shaolin 2 - title.ym` | `CHAMTITL.YM` |
| `chambers-of-shaolin/Chambers_Loader.YM` | `data/Mad Max (Jochen Hippel)/Chambers of Shaolin 3 - loader.ym` | `CHAMLOAD.YM` |
| `xenon-2/Xenon_2_Megablast.YM` | `data/David Whittaker/xenon 2 megablast.ym` | `XENONII.BIN` |
| `led-storm/LED_Storm_1.YM` | `data/Follin Bros/Led Storm 1.ym` | `LED1.YM` |
| `synergy/Synergy_Main_Menu.YM` | `data/Scavenger (Joris de Man)/Synergy Main Menu.ym` | `MAIN` |
| `synergy/Synergy_Credits.YM` | `data/Scavenger (Joris de Man)/Synergy Credits.ym` | `CREDITS` |
| `punish-your-machine/PYM_Best_Part_of_Creation.YM` | `data/Big Alec (Gunnar Gaubatz)/PYM Best Part of Creation.ym` | `BESTP.BIN` |

## Redaktionelle Einordnung

Für die Museumsangaben haben die eingebetteten YM-Metadaten Vorrang vor Dateinamen. Wo ein Container nur eine Archivnummer oder einen generischen Titel enthält, wird keine konkrete Level-, Orts- oder Szenenzuordnung ergänzt.

Bei **Xenon 2 – Megablast** fehlen im YM3!-Container Titel- und Autorenmetadaten. Die redaktionelle Zuordnung zu David Whittakers Bearbeitung des Bomb-the-Bass-Stücks stützt sich auf die Spieldokumentation, unter anderem:

- <https://www.mobygames.com/game/277/xenon-2-megablast/>
- <https://vgmrips.net/packs/pack/xenon-2-megablast-atari-st>

Die physischen Pfade aller bereits vorhandenen YM-Dateien blieben unverändert. Die neue Browsing-Hierarchie verwendet `path` als logischen Anzeigepfad und `sourcePath` als Ladeort; dadurch bleiben insbesondere die vorhandenen Produktions-Baseline-Pfade stabil.
