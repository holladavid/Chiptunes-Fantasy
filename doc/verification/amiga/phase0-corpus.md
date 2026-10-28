# Amiga Phase 0 — Korpus- und Diagnoseinventar

Umfang: **45 Playlist-Titel**. Erzeugt mit `tools/amiga-corpus-inventory.mjs`; Datei- und Quell-Hashes stehen im JSON-Bericht.

Die Klassifikation ist eine Untersuchungsentscheidung, kein Hardwarebeweis. `reference-required` bedeutet ausdrücklich nicht, dass ein Fehler bestätigt ist.

## Zusammenfassung

| Merkmal | Wert |
|---|---:|
| Format COSO | 33 |
| Format HIP68K | 2 |
| Format MOD | 7 |
| Format XM | 3 |
| Parserwarnungen | 34 |
| silentNotes | 48 |
| Titel mit Diagnosen | 14 |
| Diagnosen: confirmed-benign | 0 |
| Diagnosen: reference-required | 37 |
| Diagnosen: defect | 0 |

## Titelmatrix

| # | Titel | Format | Kanäle | Ticks | Effekte / wesentliche Merkmale | Diagnosen |
|---:|---|---|---:|---:|---|---|
| 1 | `ELYSIUM.MOD` | MOD | 4 | 11136 | 01:4, 0A:1207, 0B:1, 0C:801, 0E:1, 0F:1 | keine |
| 2 | `space_debris.xm` | XM | 32 | 11136 | 10:257, 01:1394, 02:2427, 03:1270, 08:6577, 09:4489, 0F:73, 1B:5072; linearFreq; variable Zeilen | keine |
| 3 | `GSLINGER.MOD` | MOD | 4 | 15744 | 00:1, 01:35, 02:15, 03:310, 04:527, 05:40, 06:562, 07:546, 09:104, 0A:239, 0C:735, 0D:17, 0E:364, 0F:562 | keine |
| 4 | `agony_intro.mod` | MOD | 4 | 15744 | 0C:364, 0E:1, 0F:1 | keine |
| 5 | `turrican_2_title.xm` | XM | 16 | 22016 | 01:14, 02:70, 03:258, 04:6, 06:402, 0A:3076, 0C:96, 0D:12, 0E:1 | keine |
| 6 | `dragonflight/dragonflight_titletune.HIPC` | COSO | 4 | 22880 | Opcodes 10/15/00/09/0C/0F/E1/E2/E3/E7; PCM 177402 B | keine |
| 7 | `dragonflight/dragonflight_surface.HIPC` | COSO | 4 | 3072 | Opcodes 10/11/13/18/98/00/03/04/07/0C/0E/0F/1A/1C/1F/9C/E0/E1/E2/E4/E7/E8; PCM 7546 B | keine |
| 8 | `dragonflight/dragonflight_town.HIPC` | COSO | 4 | 7168 | Opcodes 18/00/02/03/05/07/08/09/0A/E0/E1/E2/E4/E7; PCM 724 B | reference-required: Timbre 16: Element kürzer als der 5-Byte-Header.<br>reference-required: Timbre 17: Element kürzer als der 5-Byte-Header.<br>reference-required: Timbre 18: Element kürzer als der 5-Byte-Header.<br>reference-required: Timbre 19: Element kürzer als der 5-Byte-Header. |
| 9 | `dragonflight/dragonflight_dungeon.HIPC` | COSO | 4 | 10368 | Opcodes 18/00/01/03/04/05/07/08/0C/E0/E1/E2/E4/E7; PCM 992 B | keine |
| 10 | `dragonflight/dragonflight_endsequence.HIPC` | COSO | 4 | 4320 | Opcodes 18/00/03/04/07/08/0C/E0/E1/E2/E4/E7; PCM 992 B | keine |
| 11 | `dragonflight/dragonflight_ani.HIPC` | COSO | 4 | 3072 | Opcodes 18/00/03/07/0C/E0/E1/E2/E4/E7; PCM 850 B | keine |
| 12 | `dragonflight/dragonflight_always.HIPC` | COSO | 4 | 4224 | Opcodes 00/04/05/0C/1A/9B/9C/9F/E0/E1/E2/E4; PCM 4078 B | keine |
| 13 | `amberstar/City_Walk.hipc` | COSO | 4 | 4864 | Opcodes 10/20/00/03/06/AA/E1/E2/E5; PCM 57576 B | keine |
| 14 | `amberstar/Dreamcave.hipc` | COSO | 4 | 7200 | Opcodes 00/03/06/0C/E1/E2/E5/E7; PCM 57576 B | keine |
| 15 | `amberstar/Eriks_Revenge.hipc` | COSO | 4 | 6400 | Opcodes 10/11/00/03/08/E1/E2/E5; PCM 57576 B | reference-required: Timbre 13: Element kürzer als der 5-Byte-Header.<br>reference-required: Timbre 14: Element kürzer als der 5-Byte-Header.<br>reference-required: Timbre 15: Element kürzer als der 5-Byte-Header.<br>reference-required: Timbre 16: Element kürzer als der 5-Byte-Header. |
| 16 | `amberstar/Fanfares.hipc` | COSO | 4 | 8064 | Opcodes 10/11/00/03/06/07/08/E0/E1/E2/E5/E7; PCM 57576 B | reference-required: Timbre 13: Element kürzer als der 5-Byte-Header.<br>reference-required: Timbre 14: Element kürzer als der 5-Byte-Header.<br>reference-required: Timbre 15: Element kürzer als der 5-Byte-Header.<br>reference-required: Timbre 16: Element kürzer als der 5-Byte-Header.<br>reference-required: Timbre 17: Element kürzer als der 5-Byte-Header.<br>reference-required: Timbre 18: Element kürzer als der 5-Byte-Header. |
| 17 | `amberstar/Flying_High.hipc` | COSO | 4 | 6144 | Opcodes 88/00/03/06/8D/8F/A7/E1/E2/E5/E7; PCM 57576 B | keine |
| 18 | `amberstar/Funkey_Dungeon.hipc` | COSO | 4 | 6144 | Opcodes 12/00/03/E1/E2/E5/E7; PCM 57576 B | reference-required: Timbre 10: Element kürzer als der 5-Byte-Header. |
| 19 | `amberstar/Gwens_Lament.hipc` | COSO | 4 | 4896 | Opcodes 11/00/03/AA/E1/E2/E5; PCM 57576 B | reference-required: Timbre 13: Element kürzer als der 5-Byte-Header.<br>reference-required: Timbre 14: Element kürzer als der 5-Byte-Header.<br>reference-required: Timbre 15: Element kürzer als der 5-Byte-Header. |
| 20 | `amberstar/Hasta_La_Vista.hipc` | COSO | 4 | 11328 | Opcodes 12/00/03/06/0C/E1/E2/E5/E7; PCM 57576 B | reference-required: Timbre 13: Element kürzer als der 5-Byte-Header.<br>reference-required: Timbre 14: Element kürzer als der 5-Byte-Header. |
| 21 | `amberstar/High_Seas.hipc` | COSO | 4 | 5760 | Opcodes 94/00/03/05/06/07/0A/0C/0E/0F/A0/A7/A8/AA/AC/AF/E0/E1/E2/E5/E7; PCM 57576 B | keine |
| 22 | `amberstar/Horse_Song.hipc` | COSO | 4 | 6336 | Opcodes 00/06/AA/E1/E2/E5; PCM 57576 B | keine |
| 23 | `amberstar/Irish_Spring.hipc` | COSO | 4 | 6528 | Opcodes 10/20/00/03/AA/E1/E2/E5; PCM 57576 B | keine |
| 24 | `amberstar/Lullaby.hipc` | COSO | 4 | 3840 | Opcodes 00/03/05/0C/E1/E2/E5/E7; PCM 57576 B | reference-required: Timbre 16: Element kürzer als der 5-Byte-Header. |
| 25 | `amberstar/Lurking_Horror.hipc` | COSO | 4 | 9984 | Opcodes 00/03/06/E1/E2; PCM 57576 B | reference-required: Timbre 10: Element kürzer als der 5-Byte-Header.<br>reference-required: Timbre 11: Element kürzer als der 5-Byte-Header. |
| 26 | `amberstar/Minor_Quarrels.hipc` | COSO | 4 | 15400 | Opcodes 00/03/05/0C/E1/E2/E5/E7; PCM 57576 B | reference-required: Timbre 16: Element kürzer als der 5-Byte-Header.<br>reference-required: Timbre 17: Element kürzer als der 5-Byte-Header.<br>reference-required: Timbre 18: Element kürzer als der 5-Byte-Header. |
| 27 | `amberstar/Misty_Orc_Hop.hipc` | COSO | 4 | 6144 | Opcodes 12/20/40/00/03/E1/E2/E5/E7; PCM 57576 B | keine |
| 28 | `amberstar/Mystic_Moments.hipc` | COSO | 4 | 8974 | Opcodes 00/03/06/0C/A0/E1/E2/E6/E7/E8; PCM 57576 B | keine |
| 29 | `amberstar/Ode_To_Schnism.hipc` | COSO | 4 | 4320 | Opcodes 10/11/00/03/05/06/07/08/0A/0C/0E/0F/E0/E1/E2/E5/E7; PCM 57576 B | reference-required: Timbre 13: Element kürzer als der 5-Byte-Header.<br>reference-required: Timbre 14: Element kürzer als der 5-Byte-Header.<br>reference-required: Timbre 15: Element kürzer als der 5-Byte-Header.<br>reference-required: Timbre 16: Element kürzer als der 5-Byte-Header.<br>reference-required: Timbre 17: Element kürzer als der 5-Byte-Header.<br>reference-required: Timbre 18: Element kürzer als der 5-Byte-Header. |
| 30 | `amberstar/Travellers_Tune.hipc` | COSO | 4 | 5632 | Opcodes 00/03/05/0C/E1/E2/E5/E7; PCM 57576 B | reference-required: Timbre 16: Element kürzer als der 5-Byte-Header. |
| 31 | `amberstar/Ingame.hipc` | COSO | 4 | 6400 | Opcodes 12/26/00/E1/E2/E5; PCM 57576 B | keine |
| 32 | `wings-of-death/Wings_Of_Death-Title.hip` | HIP68K | 4 | 16896 | Original-68k; 39 Instrumente; PCM 190110 B | keine |
| 33 | `wings-of-death/Wings_Of_Death-Level_1.hipc` | COSO | 4 | 10752 | Opcodes 10/11/93/94/98/00/07/0C/0E/0F/A8/E0/E1/E2/E4; PCM 13308 B | keine |
| 34 | `wings-of-death/Wings_Of_Death-Level_2.hipc` | COSO | 4 | 8000 | Opcodes 10/11/16/18/19/20/21/22/23/24/25/26/27/28/29/30/81/82/83/88/90/92/93/94/95/98/00/07/0C/0E/0F/1B/1D/1E/1F/2A/2B/2C/2D/2E/2F/3C/A8/E0/E1/E2/E4; PCM 13308 B | reference-required: silentNotes=8 |
| 35 | `wings-of-death/Wings_Of_Death-Level_3.hipc` | COSO | 4 | 8960 | Opcodes 11/94/00/9A/9F/E0/E1/E2/E4; PCM 13308 B | reference-required: Instrument 7: Opcode $E4 überragt das Elementende.<br>reference-required: silentNotes=16 |
| 36 | `wings-of-death/Wings_Of_Death-Level_4.hipc` | COSO | 4 | 12416 | Opcodes 11/13/94/98/00/03/04/05/07/0C/0F/9F/A8/E0/E1/E2/E4; PCM 13308 B | reference-required: silentNotes=24 |
| 37 | `wings-of-death/Wings_Of_Death-Level_5.hipc` | COSO | 4 | 10368 | Opcodes 10/11/95/98/00/07/0C/0E/0F/9F/E0/E1/E2/E4; PCM 13308 B | keine |
| 38 | `wings-of-death/Wings_Of_Death-Level_6.hipc` | COSO | 4 | 10496 | Opcodes 11/93/95/00/03/05/07/08/09/9F/AF/E0/E1/E2/E4; PCM 13308 B | keine |
| 39 | `wings-of-death/Wings_Of_Death-Level_7.hipc` | COSO | 4 | 8768 | Opcodes 10/11/94/98/00/07/0C/0F/A8/AF/E0/E1/E2/E4/E7; PCM 13308 B | keine |
| 40 | `wings-of-death/Wings_Of_Death-End.hipc` | HIP68K | 4 | 4864 | Original-68k; 10 Instrumente; PCM 73998 B | keine |
| 41 | `blood_money_title.mod` | MOD | 4 | 11904 | 0C:266, 0F:8 | keine |
| 42 | `moongazr.mod` | MOD | 4 | 22656 | 00:7, 01:23, 02:5, 03:190, 04:63, 0A:207, 0C:1181, 0D:2, 0F:22 | keine |
| 43 | `immortal.mod` | MOD | 4 | 15360 | 00:1, 01:3, 02:28, 03:163, 04:4, 0A:1510, 0C:1153, 0D:3, 0E:2, 0F:61 | keine |
| 44 | `lotus2-title.mod` | MOD | 4 | 8448 | 00:1, 01:1, 03:24, 04:165, 0A:1, 0C:511, 0F:1 | keine |
| 45 | `DEADLOCK.XM` | XM | 24 | 14592 | 01:18, 02:505, 03:405, 04:2778, 08:1472, 09:213, 0A:10623, 0D:5, 0F:28; linearFreq | keine |

## Diagnoselegende

- **confirmed-benign:** Durch vorhandene externe Referenz oder Spezifikation gedeckt; kein Phase-1-Fehler allein aufgrund dieser Meldung.
- **reference-required:** Nicht automatisch ein Fehler; erst mit UADE/Originalquelle entscheiden.
- **defect:** Struktur-, Lade- oder Replayfehler beziehungsweise Integritätswarnung.
