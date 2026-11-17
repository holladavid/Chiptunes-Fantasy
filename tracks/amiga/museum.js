// === tracks/amiga/museum.js ===
// Kuratierte Museumstexte für die Amiga- & Tracker-Playlist von Chiptunes Fantasy.
// Fokus: Paula-Chip-Technik, Tracker-Formate, Spielegeschichte & Demoscene-History.

function museum(title, history, replay, ...sources) {
    const links = sources
        .map(source => `<a href="${source.url}" target="_blank" rel="noopener noreferrer">${source.label}</a>`)
        .join(' · ');
    return `
        <h3>[ MUSEUM: ${title} ]</h3>
        <p><strong>Historie:</strong> ${history}</p>
        <p><strong>Technik &amp; Replay:</strong> ${replay}</p>
        <p class="museum-sources"><strong>Quellen:</strong> ${links}</p>
    `;
}

const exotica = (slug, label = slug) => ({ label: `ExoticA: ${label}`, url: `https://www.exotica.org.uk/wiki/${slug}` });
const demozooMusic = (id, label) => ({ label: `Demozoo: ${label}`, url: `https://demozoo.org/music/${id}/` });
const demozooScener = (id, label) => ({ label: `Demozoo: ${label}`, url: `https://demozoo.org/sceners/${id}/` });
const janeway = (id, label) => ({ label: `Janeway: ${label}`, url: `https://janeway.exotica.org.uk/release.php?id=${id}` });
const hol = (id, label) => ({ label: `Hall of Light: ${label}`, url: `https://amiga.abime.net/${id}` });
const pouet = (id, label) => ({ label: `Pouët: ${label}`, url: `https://www.pouet.net/prod.php?which=${id}` });

export const amigaMuseumMetadata = {
    // =========================================================================
    // GAMES: 1988 (THE GREAT GIANA SISTERS)
    // =========================================================================
    "games/giana-sisters/title-screen.mod": museum(
        'THOMAS LOPATIC / CHRIS HÜLSBECK — GIANA SISTERS / TITLE SCREEN (1988)',
        `Auf dem C64 machte Chris Hülsbeck <strong>The Great Giana Sisters</strong> 1987 unsterblich – als Time Warp und Rainbow Arts ein Jahr später die Amiga-Fassung veröffentlichten, saß jedoch nicht Hülsbeck selbst an den Reglern: <strong>Thomas Lopatic</strong> setzte Hülsbecks Themen für den Amiga um. Dabei nutzte Lopatic keinen Tracker, sondern seinen eigenen <strong>Beathoven Synthesizer</strong> (über den später u. a. auch sein Klassiker <em>Katakis</em> auf dem Amiga lief).`,
        `<strong>4-Kanal-ProTracker-MOD (Konversion) · 25 Orders · 23 Patterns · 8 Samples</strong>. Da der Original-Beathoven-Code nur mit eigener Replay-Engine läuft, liegt hier eine späte ProTracker-Konvertierung vor. Alle vier Giana-Dateien tragen exakt dieselbe 64.922-Byte-Samplebank im Bauch, um die synthetischen Beathoven-Klangfarben sauber über Paula abzuspielen.`,
        exotica('The_Great_Giana_Sisters', 'The Great Giana Sisters'),
        { label: 'Amiga Paradise: Stückliste', url: 'https://www.amigaparadise.com/card.php?id=1092' },
        { label: 'EAB: ProTracker-Konvertierungen', url: 'https://eab.abime.net/showthread.php?t=80428' }
    ),
    "games/giana-sisters/get-ready.mod": museum(
        'THOMAS LOPATIC / CHRIS HÜLSBECK — GIANA SISTERS / GET READY! (1988)',
        `Der ikonische Auftakt vor jedem Levelstart von <strong>The Great Giana Sisters</strong> (1988): Nur ein kurzer Atemzug Spannung, bevor die Schwestern durch die Mario-inspirierte Traumwelt hüpfen. Wie der gesamte Amiga-Score übersetzt <strong>Thomas Lopatic</strong> hier <strong>Chris Hülsbecks</strong> unverkennbares Motiv in den Klang seines hauseigenen Beathoven-Systems.`,
        `<strong>4-Kanal-ProTracker-MOD · 1 Order · 1 Pattern · 8 Samples (67.030 Bytes)</strong>. Kurioses Detail unter der Haube: Die Musik selbst ist exakt ein einziges Pattern lang – über 96 % der Dateigröße entfallen auf die eingebettete 64,9-KB-Samplebank der Giana-Suite.`,
        exotica('The_Great_Giana_Sisters', 'The Great Giana Sisters'),
        { label: 'Amiga Paradise: Get Ready', url: 'https://www.amigaparadise.com/card.php?id=1092' }
    ),
    "games/giana-sisters/ingame-1-ground.mod": museum(
        'THOMAS LOPATIC / CHRIS HÜLSBECK — GIANA SISTERS / IN-GAME 1 GROUND (1988)',
        `Das unvergessliche Oberwelt-Thema von <strong>The Great Giana Sisters</strong>: Während Hülsbeck am C64 noch mit Arpeggios und SID-Pulswellen trippelte, verleiht <strong>Thomas Lopatics</strong> Amiga-Bearbeitung (1988) der Reggae-angehauchten Melodie durch gesampelte Bass- und Synth-Instrumente ein völlig eigenes, luftiges 16-Bit-Flair – komplett anders als die späteren Atari-ST-YM-Fassungen.`,
        `<strong>4-Kanal-ProTracker-MOD · 12 Orders · 12 Patterns · 8 Samples (78.294 Bytes)</strong>. Zwölf knackig durchlaufende Patterns auf vier diskreten 8-Bit-Paula-Kanälen – das ideale Vergleichsstück, um den C64-SID direkt gegen den frühen Amiga-Sound antreten zu lassen.`,
        exotica('The_Great_Giana_Sisters', 'The Great Giana Sisters'),
        { label: 'Amiga Paradise: Ground BGM', url: 'https://www.amigaparadise.com/card.php?id=1092' }
    ),
    "games/giana-sisters/ingame-2-cave.mod": museum(
        'THOMAS LOPATIC / CHRIS HÜLSBECK — GIANA SISTERS / IN-GAME 2 CAVE (1988)',
        `Sobald Armin und Maria in die dunklen Untergrund-Level abtauchen, wechselt der Soundtrack zur treibenden <strong>Cave BGM</strong>. Erneut arrangiert <strong>Thomas Lopatic</strong> Hülsbecks düster-rockige Bassfigur von 1987 für seinen Beathoven-Synthesizer auf dem Amiga.`,
        `<strong>4-Kanal-ProTracker-MOD · 17 Orders · 13 Patterns · 8 Samples (79.318 Bytes)</strong>. Die Orderliste springt am Ende sauber auf vier bereits gespielte Patterns zurück – ein klassischer Endlos-Loop für endlose Höhlenpassagen.`,
        exotica('The_Great_Giana_Sisters', 'The Great Giana Sisters'),
        { label: 'Amiga Paradise: Cave BGM', url: 'https://www.amigaparadise.com/card.php?id=1092' }
    ),

    // =========================================================================
    // GAMES: 1989
    // =========================================================================
    "games/blood-money-title.mod": museum(
        'RAY NORRISH — BLOOD MONEY TITLE (1989)',
        `Bevor DMA Design Jahre später <em>Lemmings</em> und <em>Grand Theft Auto</em> erfand, sorgte 1989 ihr gnadenloser Sci-Fi-Shooter <strong>Blood Money</strong> (bei Psygnosis) für Kinnladen-Alarm: schon beim Booten schmetterte das Intro digitalisierte Breakbeats, markante Voice-Samples (<em>„Blood Money!“</em>) und fette Synth-Riffs aus dem Fernseher! Viele Fans verwechselten den Komponisten wegen der Soundeffekte mit David Whittaker – dabei stammt der mitreißende Titeltrack vom Musiker <strong>Ray Norrish</strong> (Whittaker lieferte die Ingame-SFX).`,
        `<strong>4-Kanal-MOD · 31 Orders · 15 Patterns · 15 Samples</strong>. Ein Lehrbuchbeispiel für die frühe Psygnosis-Wucht von 1989: harte, druckvolle 8-Bit-Drum-Loops treffen auf kompakte 15 Patterns, die über cleveres Order-Sequencing volle Titel-Länge gewinnen.`,
        { label: 'MobyGames: Blood Money', url: 'https://www.mobygames.com/game/6173/blood-money/' }
    ),
    "games/shadow-of-the-beast-title.mod": museum(
        'DAVID WHITTAKER / JOGEIR LILJEDAHL — SHADOW OF THE BEAST (1989)',
        `Reflections’ Parallax-Wunder <strong>Shadow of the Beast</strong> definierte 1989 die grafische und akustische Messlatte des Amiga: <strong>David Whittaker</strong> setzte erstmals im großen Stil auf atmosphärisch klingende Korg-M1-Samples statt reiner Synth-Piepserei und schuf eine weltfremde, melancholische Klangwelt. Da Whittakers Original-Treiber in einem eigenen Format (<code>.dw</code>) steckt, bewahrt diese Playlist die liebevolle <strong>4-Kanal-MOD-Rekonstruktion</strong> des norwegischen Tracker-Stars <strong>Jogeir Liljedahl</strong> (Sampletexte: <code>by jogeir liljedahl</code> / <code>original: d.whittaker</code>).`,
        `<strong>4-Kanal-ProTracker-MOD (<code>M.K.</code>) · 15 Orders · 14 Patterns · nur 3 Samples (56.838 Bytes)</strong>. Verblüffend minimalistisch: Mit gerade einmal drei genutzten Samples fängt Liljedahl die ganze mystische Weite von Whittakers Intro auf Standard-Paula-Hardware ein.`,
        { label: 'Wikipedia: Shadow of the Beast', url: 'https://en.wikipedia.org/wiki/Shadow_of_the_Beast_(1989_video_game)' },
        { label: 'Modland: Originaldatei', url: 'https://modland.com/pub/modules/Protracker/Jogeir%20Liljedahl/beast-title.mod' }
    ),

    // =========================================================================
    // GAMES: 1990 — JOCHEN HIPPEL / DRAGONFLIGHT
    // =========================================================================
    "games/dragonflight/titletune.hipc": museum(
        'JOCHEN HIPPEL — DRAGONFLIGHT / TITLETUNE (1990)',
        `Mit dem ambitionierten Rollenspiel <strong>Dragonflight</strong> legte das junge deutsche Kultstudio <strong>Thalion</strong> (gegründet u. a. von Ex-The-Exceptions-Legende Erik Simon und Holger Flöttmann in Gütersloh) 1990 sein erstes echtes Mammutwerk auf dem Amiga vor. Mit an Bord: <strong>Jochen Hippel</strong> alias <strong>Mad Max</strong>, einer der berühmtesten Atari-ST-Chip-Zauberer aller Zeiten – und enger Freund wie Rivale von Chris Hülsbeck. Für Dragonflights gewaltiges Titelthema ließ Hippel alle Sparsamkeit fallen und spendierte ein episches, über 177 KB schweres Sample-Arrangement.`,
        `<strong>HIPPEL-COSO (<code>.hipc</code>) · 1 Song · 13 Instrumente · 23 Timbres · 94 Monopatterns · 177.402 Bytes PCM</strong>. Hippel übertrug Hülsbecks TFMX-Idee in sein eigenes Format <strong>COSO (COmpressed SOng)</strong>: Pattern-, Timbre- und Instrumenten-Tabellen werden mit PAL-CIA-Timing separat verarbeitet, sodass lange Kompositionen winzig bleiben – hier gepaart mit 10 fetten Titel-Samples.`,
        hol(412, 'Dragonflight'),
        exotica('Jochen_Hippel', 'Jochen Hippel')
    ),
    "games/dragonflight/surface.hipc": museum(
        'JOCHEN HIPPEL — DRAGONFLIGHT / SURFACE (1990)',
        `Während man auf der weitläufigen Oberwelt von <strong>Dragonflight</strong> Städte, Türme und versteckte Portale sucht, wechselt <strong>Jochen Hippel</strong> radikal die Technik: Statt riesiger PCM-Aufnahmen aus dem Titelthema packt er vier komplette Wander-Melodien in ein winziges Ingame-Paket, damit auf den Amiga-Disketten genügend Platz für die gigantische Rollenspiel-Welt bleibt.`,
        `<strong>HIPPEL-COSO · 4 Songs · 16 Instrumente · 19 Timbres · 64 Monopatterns · nur 7.546 Bytes PCM</strong>. Reiner Atari-ST-/Chip-Einfluss im Amiga-Gewand: 32 winzige, teils zyklische Mini-Samples (durchschnittlich kaum über 230 Bytes!) werden durch Hippels komplexe Timbre-Modulationen und Arpeggio-Hüllkurven lebendig geformt.`,
        hol(412, 'Dragonflight')
    ),
    "games/dragonflight/town.hipc": museum(
        'JOCHEN HIPPEL — DRAGONFLIGHT / TOWN (1990)',
        `Sobald die Party eine Stadt oder Taverne in <strong>Dragonflight</strong> betritt, erklingen Hippels heimelige, beinahe mittelalterlich anmutende Stadtmelodien. Kaum zu glauben beim Zuhören: Die gesamte Städte-Sammlung passt rechnerisch fast auf den Zettel einer Einkaufsliste!`,
        `<strong>HIPPEL-COSO · 3 Songs · 13 Instrumente · 20 Timbres · 40 Monopatterns · sagenhafte 724 Bytes PCM</strong>. Gerade einmal 724 Bytes Sampledaten verteilen sich auf 28 Wellenform-Schnipsel! Genau dafür erfand Hippel <strong>COSO</strong>: synthetische Paula-Klänge aus kurzen Wellenform-Loops und dynamischen Hüllkurven statt speicherfressender MOD-Samples.`,
        hol(412, 'Dragonflight')
    ),
    "games/dragonflight/dungeon.hipc": museum(
        'JOCHEN HIPPEL — DRAGONFLIGHT / DUNGEON (1990)',
        `Dunkle Gewölbe, Fallen und rundenbasierte Kämpfe: Für die tiefen Dungeons von Thalions <strong>Dragonflight</strong> schraubte <strong>Jochen Hippel</strong> gleich sieben eigenständige, spannungsgeladene Subsongs in eine einzige komprimierte Container-Datei.`,
        `<strong>HIPPEL-COSO · 7 Songs · 21 Instrumente · 27 Timbres · 133 Monopatterns · 238 Divisions · 992 Bytes PCM</strong>. Umfangreichstes Multi-Tune-Paket der Suite: Obwohl nur knapp 1 KB an rohen Wellenformen beiliegt, erzeugt Hippels 27-Timbre-Engine sieben völlig unterschiedliche Dungeon-Stimmungen.`,
        hol(412, 'Dragonflight')
    ),
    "games/dragonflight/endsequence.hipc": museum(
        'JOCHEN HIPPEL — DRAGONFLIGHT / END SEQUENCE (1990)',
        `Wer Thalions komplexes Rollenspiel 1990 tatsächlich bis zum Sieg durchspielte, wurde von <strong>Jochen Hippel</strong> mit drei feierlichen Abschluss-Themen belohnt. Stilistisch schließt die Musik den Kreis zwischen den erdigen Synthesizer-Arpeggios der Dungeons und dem Pathos des Intros.`,
        `<strong>HIPPEL-COSO · 3 Songs · 12 Instrumente · 20 Timbres · 75 Monopatterns · 156 Divisions · 992 Bytes PCM</strong>. Nutzt ebenfalls die hochkomprimierte COSO-Chip-Bibliothek (29 Mikro-Samples) mit PAL-CIA-Timing.`,
        hol(412, 'Dragonflight')
    ),
    "games/dragonflight/ani.hipc": museum(
        'JOCHEN HIPPEL — DRAGONFLIGHT / ANIMATION (1990)',
        `Thalion legte großen Wert auf bildschirmfüllende Zwischensequenzen und atmosphärische Story-Einblendungen. Die Datei <strong>Ani</strong> liefert dafür zwei punktgenaue Begleitstücke aus <strong>Jochen Hippels</strong> Feder.`,
        `<strong>HIPPEL-COSO · 2 Songs · 8 Instrumente · 9 Timbres · 27 Monopatterns · 45 Divisions · 850 Bytes PCM</strong>. Schlankes, zweckoptimiertes COSO-Modul mit direkter Song-Umschaltung auf Kommando der Animationsroutine.`,
        hol(412, 'Dragonflight')
    ),
    "games/dragonflight/always.hipc": museum(
        'JOCHEN HIPPEL — DRAGONFLIGHT / ALWAYS (1990)',
        `Ein echtes Schweizer Taschenmesser des <strong>Dragonflight</strong>-Soundtracks: Unter dem archivierten Namen <strong>Always</strong> bündelte <strong>Jochen Hippel</strong> fünf vielseitige Stücke, die unabhängig von einzelnen Dungeons oder Städten abgerufen werden konnten.`,
        `<strong>HIPPEL-COSO · 5 Songs · 12 Instrumente · 16 Timbres · 101 Monopatterns · 44 Samples (4.078 Bytes PCM)</strong>. Mit 44 referenzierten Samples und gut 4 KB PCM-Material deutlich klangreicher instrumentiert als die extrem reduzierten Stadt- und Dungeon-Dateien.`,
        hol(412, 'Dragonflight')
    ),

    // =========================================================================
    // GAMES: 1990 — JOCHEN HIPPEL / WINGS OF DEATH
    // =========================================================================
    "games/wings-of-death/title.hip": museum(
        'JOCHEN HIPPEL — WINGS OF DEATH / TITLE (1990)',
        `Als Eclipse Software und Thalion 1990 den furiosen Vertikal-Shooter <strong>Wings of Death</strong> entwickelten, stellte Producer Marc Rosocha seinem Komponisten eine klare Ansage: <em>„Bitte mach eine Titelmusik, die mindestens 200 KB groß ist!“</em> <strong>Jochen Hippel</strong> nahm die Herausforderung wörtlich, feuerte fette digitalisierte Sprach- und Orchester-Samples in den Speicher und lieferte eine der wuchtigsten Titelhymnen des Jahres 1990 ab.`,
        `<strong>HIPPEL-HIP68K (<code>.hip</code>) · 3 Songs · 39 Instrumente · 48 Timbres · 153 Patterns · 132 Divisions</strong>. Anders als die Levelmusiken läuft das Titelstück nicht als reines COSO-Datenpaket, sondern als <strong>eigenständiger 68000-Maschinencode-Replay</strong> mit Raster-Timing – erkennbar am gewaltigen Instrumentenpark und den satten Titel-Samples.`,
        { label: 'VGMPF: Wings of Death (Amiga)', url: 'https://vgmpf.com/Wiki/index.php?title=Wings_of_Death_(AMI)' },
        exotica('Jochen_Hippel', 'Jochen Hippel')
    ),
    "games/wings-of-death/level-1.hipc": museum(
        'JOCHEN HIPPEL — WINGS OF DEATH / LEVEL 1: OVER THE TREES (1990)',
        `Der Startschuss über die Wälder von <strong>Wings of Death</strong>: Während das Spiel butterweich bei 50 Frames scrollte (programmiert von Michael Bittner, während Hippel parallel gleich noch für die Soundeffekte zuständig war), trieb <strong>Over the Trees</strong> die Action mit messerscharfen Synth-Leads voran. Berühmt wurde übrigens auch Hippels eigene Atari-ST-Fassung – dort sogar mit software-gemischten Digi-Drums auf dem alten YM-Chip!`,
        `<strong>HIPPEL-COSO (4 logische Voices) · 2 Songs · 22 Instrumente · 12 Timbres · 89 Patterns · 172 Divisions</strong>. Alle sieben Leveldateien zapfen gemeinsam eine extrem kompakte Bibliothek aus 34 Samples (nur 13.308 Bytes!) an – damit während des Dauerfeuers auf Paula noch Luft für Explosionen bleibt.`,
        { label: 'VGMPF: Wings of Death (Amiga)', url: 'https://vgmpf.com/Wiki/index.php?title=Wings_of_Death_(AMI)' }
    ),
    "games/wings-of-death/level-2.hipc": museum(
        'JOCHEN HIPPEL — WINGS OF DEATH / LEVEL 2: INSIDE THE CAVE (1990)',
        `Abstieg in die unterirdischen Tunnel von Stage 2: Für <strong>Inside the Cave</strong> drosselt <strong>Jochen Hippel</strong> die Euphorie von Level 1 zugunsten einer geheimnisvollen, halligen Höhlen-Spannung mit treibender Bassfigur.`,
        `<strong>HIPPEL-COSO (4 Voices) · 1 Song · 15 Instrumente · 16 Timbres · 57 Patterns · 125 Divisions</strong>. Cleveres 4-Kanal-Arrangement innerhalb des 13-KB-Samplebudgets: Ein Kanal hält oft das rhythmische Grundgerüst aus Bass und Noise-Perkussion, während die anderen die Melodie tragen.`,
        { label: 'VGMPF: Wings of Death (Amiga)', url: 'https://vgmpf.com/Wiki/index.php?title=Wings_of_Death_(AMI)' }
    ),
    "games/wings-of-death/level-3.hipc": museum(
        'JOCHEN HIPPEL — WINGS OF DEATH / LEVEL 3: DESERT ROCKS (1990)',
        `Flimmernde Hitze über der Felsenwüste von Level 3: <strong>Desert Rocks</strong> beweist, dass man für gnadenlosen Shooter-Drive kein gigantisches Orchester braucht – Hippels trockener Synth-Groove treibt erbarmungslos nach vorn.`,
        `<strong>HIPPEL-COSO (4 Voices) · 1 Song · 8 Instrumente · 8 Timbres · 25 Patterns · 70 Divisions</strong>. Das minimalistischste und fokussierteste Level-Arrangement der gesamten <em>Wings-of-Death</em>-Suite.`,
        { label: 'VGMPF: Wings of Death (Amiga)', url: 'https://vgmpf.com/Wiki/index.php?title=Wings_of_Death_(AMI)' }
    ),
    "games/wings-of-death/level-4.hipc": museum(
        'JOCHEN HIPPEL — WINGS OF DEATH / LEVEL 4: MECHANICAL CASTLE (1990)',
        `Mitte des Spiels schwenkt das Design auf stählerne Festungsmauern und mechanische Abwehrtürme um – und <strong>Jochen Hippel</strong> antwortet mit <strong>Mechanical Castle</strong>, einem der längsten und präzisesten Tracks des gesamten Shooters.`,
        `<strong>HIPPEL-COSO (4 Voices) · 1 Song · 19 Instrumente · 20 Timbres · 71 Patterns · 194 Divisions</strong>. Mit 194 Divisions der umfangreichste Ablauf unter den sieben COSO-Leveln – voller kantiger, metallischer Timbre-Wechsel.`,
        { label: 'VGMPF: Wings of Death (Amiga)', url: 'https://vgmpf.com/Wiki/index.php?title=Wings_of_Death_(AMI)' }
    ),
    "games/wings-of-death/level-5.hipc": museum(
        'JOCHEN HIPPEL — WINGS OF DEATH / LEVEL 5: BIO-HAZARD / ORGANIC (1990)',
        `Fremdartige Alien-Strukturen und pulsierende organische Wände bilden Stage 5: Mit <strong>Bio-Hazard / Organic</strong> erschafft <strong>Jochen Hippel</strong> eine unruhige, schillernde Begleitung passend zu den bizarren Gegnerformationen.`,
        `<strong>HIPPEL-COSO (4 Voices) · 1 Song · 11 Instrumente · 12 Timbres · 43 Patterns · 108 Divisions</strong>. Schöpft erneut aus den 34 gemeinsamen Level-Samples (13.308 PCM-Bytes) über den COSO-Interpreter.`,
        { label: 'VGMPF: Wings of Death (Amiga)', url: 'https://vgmpf.com/Wiki/index.php?title=Wings_of_Death_(AMI)' }
    ),
    "games/wings-of-death/level-6.hipc": museum(
        'JOCHEN HIPPEL — WINGS OF DEATH / LEVEL 6: GLACIER / ICE (1990)',
        `Eisiger Kontrast vor dem Finale: In Stage 6 (<strong>Glacier / Ice</strong>) kombiniert <strong>Jochen Hippel</strong> kühle, gläserne Synth-Timbres mit einer überraschend weitläufigen 164-Divisions-Komposition.`,
        `<strong>HIPPEL-COSO (4 Voices) · 1 Song · 12 Instrumente · 11 Timbres · 61 Patterns · 164 Divisions</strong>. Zeigt sehr schön, wie Hippel mit leicht veränderten Hüllkurven-Timbres aus denselben Basis-Samples völlig neue Klangtemperaturen herausholt.`,
        { label: 'VGMPF: Wings of Death (Amiga)', url: 'https://vgmpf.com/Wiki/index.php?title=Wings_of_Death_(AMI)' }
    ),
    "games/wings-of-death/level-7.hipc": museum(
        'JOCHEN HIPPEL — WINGS OF DEATH / LEVEL 7: VOLCANIC / FIRE (1990)',
        `Die letzte Feuerprobe über brodelnder Lava: Mit <strong>Volcanic / Fire</strong> zieht <strong>Jochen Hippel</strong> das Tempo zum Showdown noch einmal gnadenlos an und peitscht den Spieler durch die schwerste Stage des Spiels.`,
        `<strong>HIPPEL-COSO (4 Voices) · 1 Song · 14 Instrumente · 16 Timbres · 70 Patterns · 137 Divisions</strong>. Das letzte der sieben kompakten COSO-Levelmodule – bevor der Abspann technisch wieder eine ganz andere Richtung einschlägt.`,
        { label: 'VGMPF: Wings of Death (Amiga)', url: 'https://vgmpf.com/Wiki/index.php?title=Wings_of_Death_(AMI)' }
    ),
    "games/wings-of-death/end.hipc": museum(
        'JOCHEN HIPPEL — WINGS OF DEATH / END (1990)',
        `Der erlösende Abspann nach sieben knüppelharten Bullet-Hell-Stages! Ein klassischer Amiga-Detektivfund am Rande: Obwohl diese Datei historisch mit der Endung <code>.hipc</code> archiviert wurde, steckt in Wahrheit – genau wie beim großen Titelstück – kein reines COSO-Datenpaket darin, sondern voller 68000-Replay-Code.`,
        `<strong>HIPPEL-HIP68K (trotz <code>.hipc</code>-Endung!) · 2 Songs · 10 Instrumente · 19 Timbres · 49 Patterns · 76 Divisions</strong>. Der Worklet erkennt den echten binären Replaytyp und führt wie beim Titelstück den originalen 68000-Code mit Raster-Timing aus.`,
        { label: 'VGMPF: Wings of Death (Amiga)', url: 'https://vgmpf.com/Wiki/index.php?title=Wings_of_Death_(AMI)' }
    ),

    // =========================================================================
    // GAMES: 1990–1991
    // =========================================================================
    "games/speedball-2-title.mod": museum(
        'RICHARD JOSEPH / NATION 12 — SPEEDBALL 2 TITLE (1990)',
        `Kaum ein Intro riss Amiga-Spieler 1990 so von den Stühlen wie der Start von The Bitmap Brothers’ futuristischem Prügelsport <strong>Speedball 2: Brutal Deluxe</strong> – gekrönt vom legendären Stadion-Sample <em>„Ice cream! Ice cream!“</em>. Hinter dem Projekt <strong>Nation 12</strong> steckte echte britische Pop-Prominenz rund um Ultravox-Gründer <strong>John Foxx</strong> und <em>Bomb-the-Bass</em>-Produzent <strong>Tim Simenon</strong>: Produzent <strong>Richard Joseph</strong> presste deren Studio-Sound meisterhaft in ein 4-Kanal-Amiga-Modul (im Header verewigt mit <code>#Nation 12</code> und <code>Richard Joseph</code>).`,
        `<strong>4-Kanal-MOD (<code>M.K.</code>) · 26 Orders · 19 Patterns · 30 Samples (201.688 Bytes)</strong>. Eingebetteter Titel: <code>SB2_Intro</code>. Fast alle 31 möglichen ProTracker-Sample-Slots (30 von 31) sind hier belegt, um Breakbeats, fette Rave-Stabs und Vocal-Fetzen knackig auf Paula abzufeuern.`,
        exotica('Nation_12', 'Nation 12'),
        { label: 'The Ransom Note: Bitmap Brothers', url: 'https://www.theransomnote.com/music/news/the-bitmap-brothers-remembering-the-music-of-amiga-pioneers/' }
    ),
    "games/gods.mod": museum(
        'RICHARD JOSEPH / NATION 12 — GODS (1991)',
        `Nach <em>Speedball 2</em> setzten die Bitmap Brothers 1991 bei ihrem mythologischen Action-Platformer <strong>Gods</strong> („Into the Wonderful“) erneut auf die Erfolgsformel <strong>Nation 12 &amp; Richard Joseph</strong>. Ein epischer, fast schon opernhaft-düsterer Techno-Track, der sich sofort im Titelbildschirm einbrennt – im Spiel selbst verzichtete man dafür ganz bewusst auf Musik zugunsten reiner Kampfgeräusche.`,
        `<strong>4-Kanal-MOD (<code>M.K.</code>) · 40 Orders · 31 Patterns · 27 Samples (320.044 Bytes)</strong>. Eingebetteter Modultitel: <code>gods17</code>. Knapp 287 KB reine Sampledaten auf vier Paula-Kanälen verleihen diesem MOD eine fast schon CD-nahe Studio-Dichte der frühen 90er.`,
        exotica('Nation_12', 'Nation 12'),
        { label: 'The Ransom Note: Bitmap Brothers', url: 'https://www.theransomnote.com/music/news/the-bitmap-brothers-remembering-the-music-of-amiga-pioneers/' }
    ),
    "games/lemmings.mod": museum(
        'TIM WRIGHT & BRIAN JOHNSTON — LEMMINGS (1991)',
        `Eine der besten Rettungsgeschichten der Spielemusik: Ursprünglich hatte Scott Johnstons jüngerer Bruder <strong>Brian Johnston</strong> die Musik für DMA Designs Überraschungshit <strong>Lemmings</strong> programmiert – vollgepackt mit urheberrechtlich geschützten Song-Samples! Kurz vor Release schrillten bei Psygnosis die Anwalts-Alarmglocken. In höchster Eile heuerte man Hauskomponist <strong>Tim Wright</strong> (später berühmt als <em>CoLD SToRAGE</em>) an, der binnen kürzester Zeit einen bunten, lizenzfreien Mix aus eigenen Melodien, Volksliedern (<em>How Much Is That Doggie in the Window</em>) und Klassik (Mozart, Rossini, Chopin) zusammenschraubte.`,
        `<strong>4-Kanal-MOD (<code>M.K.</code>) · 77 Orders · 64 Patterns · 14 Samples (152.808 Bytes)</strong>. Mit 77 Orders und 64 Patterns ist dieses einzige Modul ein gewaltiges Medley, das durch einen schmalen Satz von 14 vielseitig einsetzbaren Instrumenten-Samples erstaunlich leichtfüßig bleibt.`,
        exotica('Lemmings', 'Lemmings'),
        { label: 'Wikipedia: Lemmings', url: 'https://en.wikipedia.org/wiki/Lemmings_(video_game)' },
        { label: 'Square Enix Music: Tim Wright Interview', url: 'https://www.squareenixmusic.com/features/interviews/timwright.shtml' }
    ),
    "games/another-world-intro.mod": museum(
        'JEAN-FRANÇOIS FREITAS — ANOTHER WORLD INTRO (1991)',
        `Éric Chahis filmisches Meisterwerk <strong>Another World</strong> (1991) kam fast völlig ohne Text aus – getragen allein von Vektor-Animationen und <strong>Jean-François Freitas’</strong> spartanischer, Gänsehaut-erzeugender Synthesizer-Musik. Vom sanften Labor-Einstieg über den drohenden Blitzschlag bis zur fremdartigen Welt hinter dem Partikelbeschleuniger sitzt jede einzelne Note wie im Kino.`,
        `<strong>4-Kanal-MOD (<code>M.K.</code>) · 14 Orders · 14 Patterns · 6 Samples (85.760 Bytes)</strong>. Besonderheit der Archivdatei: Delphine Software verwendete im Originalspiel ein eigenes SoundFX-Format – diese saubere ProTracker-Konversion erstellte Gabriele Priarone laut Modulnotiz am 14. September 1997 von Hand.`,
        { label: 'Wikipedia: Another World', url: 'https://en.wikipedia.org/wiki/Another_World_(video_game)' },
        { label: 'Discogs: Another World OST', url: 'https://www.discogs.com/release/10834621-Jean-Fran%C3%A7ois-Freitas-Another-World-Official-Soundtrack' }
    ),
    "games/lotus-2-title.mod": museum(
        'BARRY LEITCH — LOTUS II TITLE (1991)',
        `Wer 1991 <strong>Lotus Turbo Challenge 2</strong> bootete, wurde von einem der mitreißendsten Elektro-Funk-Intros der Amiga-Geschichte begrüßt – komplett mit der geheimen Subliminal-Botschaft für Adlerohren beim Ausfaden des Titeltracks (<em>„You will not copy this game“</em> rückwärts/leise im Mix!). Der Schotte <strong>Barry Leitch</strong> (damals bei Magnetic Fields) schuf damit eines seiner absoluten Signature-Stücke.`,
        `<strong>4-Kanal-MOD (<code>M.K.</code>) · 22 Orders · 15 Patterns · 13 Samples</strong>. Im Modul schlicht als <code>bootup</code> benannt, packt Leitch maximale Energie in kompakte 15 Patterns mit schmatzenden Slap-Bässen und kristallinen Synth-Stabs.`,
        demozooMusic(57599, 'Lotus II bootup')
    ),
    "games/moongazr.mod": museum(
        'BJØRN LYNNE — MOONGAZR / CUBULUS (1991)',
        `Hinter dem kryptischen DOS-Dateinamen <code>moongazr.mod</code> verbirgt sich der Norweger <strong>Bjørn Lynne</strong> (in der Demoscene als <em>Dr. Awesome / Crusaders</em> berühmt und später Stammkomponist von Team17 für <em>Worms</em> &amp; <em>Alien Breed</em>). <strong>Moongazer</strong> schrieb er 1991 für das charmante 3D-Kugel-Puzzlespiel <strong>Cubulus</strong> von Software 2000 – ein wunderbar verträumtes Beispiel für Lynnes frühe Synth-Melodik.`,
        `<strong>4-Kanal-MOD · 59 Orders · 37 Patterns · 17 Samples</strong>. 59 Orders schaffen einen gemächlichen, hypnotischen Spannungsbogen über 37 Patterns, perfekt zum Nachdenken vor dem nächsten Puzzle-Zug.`,
        exotica('Cubulus', 'Cubulus'),
        { label: 'Lemon Amiga: Cubulus', url: 'https://www.lemonamiga.com/game/cubulus' },
        { label: 'MobyGames: Cubulus', url: 'https://www.mobygames.com/game/14567/cubulus/' }
    ),

    // =========================================================================
    // GAMES: 1992 — AGONY, AMBERSTAR & KLASSIKER
    // =========================================================================
    "games/agony-intro.mod": museum(
        'TIM WRIGHT — AGONY INTRO (1992)',
        `Einer der wildesten Musik-Krimis der 90er! Für Psygnosis’ traumhaft schönes Eulen-Shoot-’em-up <strong>Agony</strong> schrieb <strong>Tim Wright</strong> (Modulnotiz: <code>written 16/09/91</code>) ein melancholisches Piano-Titelstück. Doch Programmierer/Artist <strong>Franck Sauer</strong> tauschte die Pianosamples aus – und wegen Paulas unterer Tonhöhengrenze musste eine ganze Passage <strong>um eine Oktave verschoben</strong> werden! Genau diese leicht abgewandelte Amiga-Version erlangte traurige Berühmtheit, als die norwegische Black-Metal-Band <strong>Dimmu Borgir</strong> sie 1996 auf ihrem Album <em>Stormblåst</em> Note für Note als <em>„Sorgens Kammer“</em> klaute (und bei der Neuauflage 2005 komplett entfernen musste).`,
        `<strong>4-Kanal-MOD · 41 Orders · 17 Patterns · nur 4 Samples</strong>. Kaum zu glauben, wie viel Dramatik Wright aus gerade einmal vier Samples (inklusive des geschichtsträchtigen Klaviers und Streicherteppichs) auf den Amiga zaubert.`,
        exotica('Agony', 'Agony'),
        { label: 'Franck Sauer: Agony Story', url: 'https://www.francksauer.com/index.php/games?view=article&amp;id=10:agony&amp;catid=15:published-games' },
        { label: 'Wikipedia: Agony', url: 'https://en.wikipedia.org/wiki/Agony_(video_game)' }
    ),
    "games/amberstar/city-walk.hipc": museum(
        'JOCHEN HIPPEL — AMBERSTAR / CITY WALK (1992)',
        `Mit dem Mammut-Rollenspiel <strong>Amberstar</strong> schuf Thalion 1992 den direkten Vorgänger zu <em>Ambermoon</em> und <em>Albion</em> – ein gewaltiges Fantasy-Epos (gebaut in nur zwölf Monaten von einem Kernteam rund um Karsten Köper, Jurie Horneman und Erik Simon). Für die geschäftigen Städte von Lyramion lieferte <strong>Jochen Hippel</strong> mit <strong>City Walk</strong> ein einladendes, beschwingtes Bummellied.`,
        `<strong>HIPPEL-COSO (<code>envSpec</code>) · 8 Instrumente · 13 Timbres · 34 Monopatterns · 38 Divisions</strong>. Genialer Speicher-Trick des gesamten 19-teiligen <em>Amberstar</em>-Soundtracks: Alle Stücke greifen gemeinsam auf eine einzige <strong>57.576 Bytes große Samplebank (<code>hipc.samp</code>)</strong> zu, sodass Hippel fast zwanzig völlig eigenständige Kompositionen auf Diskette unterbringen konnte.`,
        exotica('Amberstar', 'Amberstar'),
        hol(3257, 'Amberstar')
    ),
    "games/amberstar/dreamcave.hipc": museum(
        'JOCHEN HIPPEL — AMBERSTAR / DREAMCAVE (1992)',
        `Während <em>Lurking Horror</em> in den Gewölben das Fürchten lehrt, klingt <strong>Dreamcave</strong> exakt nach seinem Namen: geheimnisvoll schwebend, entrückt und wie geschaffen für schimmernde Untergrundgrotten in <strong>Amberstar</strong>.`,
        `<strong>HIPPEL-COSO · 6 Instrumente · 7 Timbres · 14 Monopatterns · 60 Divisions</strong>. Besonders sparsames Arrangement innerhalb der gemeinsamen <code>hipc.samp</code>-Bank: Nur 14 kurze Monopatterns werden durch geschickte Pattern-Wiederholungen und <code>envSpec</code>-Hüllkurven auf volle 60 Divisions gedehnt.`,
        exotica('Amberstar', 'Amberstar'),
        hol(3257, 'Amberstar')
    ),
    "games/amberstar/eriks-revenge.hipc": museum(
        'JOCHEN HIPPEL — AMBERSTAR / ERIK’S REVENGE (1992)',
        `Thalion-WG-Humor mitten im Fantasy-Soundtrack: <strong>Erik’s Revenge</strong> ist höchstwahrscheinlich ein augenzwinkernder Gruß an Thalion-Mitgründer und Art Director <strong>Erik Simon</strong>, mit dem Jochen Hippel seit alten Atari-ST-Tagen bei <em>The Exceptions</em> Seite an Seite arbeitete.`,
        `<strong>HIPPEL-COSO · 9 Instrumente · 17 Timbres · 50 Monopatterns · 41 Divisions</strong>. Auffällig viele Timbre-Schattierungen (17 Stück bei nur 9 Basis-Instrumenten) sorgen aus der gemeinsamen Samplebank für spürbare Dynamik.`,
        exotica('Amberstar', 'Amberstar'),
        hol(3257, 'Amberstar')
    ),
    "games/amberstar/fanfares.hipc": museum(
        'JOCHEN HIPPEL — AMBERSTAR / FANFARES (1992)',
        `Anders als der schlichte Name vermuten lässt, versteckt sich hinter <strong>Fanfares</strong> kein schneller 3-Sekunden-Tusch, sondern eine vollwertige, heroisch aufgezogene Rollenspiel-Suite für große Triumphe und Festlichkeiten in <strong>Amberstar</strong>.`,
        `<strong>HIPPEL-COSO · 11 Instrumente · 19 Timbres · 45 Monopatterns · 63 Divisions</strong>. Kräftige 12-Sample-Auswahl aus <code>hipc.samp</code> über Hippels COSO-Interpreter mit präzisem <code>envSpec</code>-Envelope-Verhalten.`,
        exotica('Amberstar', 'Amberstar'),
        hol(3257, 'Amberstar')
    ),
    "games/amberstar/flying-high.hipc": museum(
        'JOCHEN HIPPEL — AMBERSTAR / FLYING HIGH (1992)',
        `Freiheit über den Wolken: Wer in <strong>Amberstar</strong> im späteren Spielverlauf endlich per Adler über die Weltkarte von Lyramion abheben durfte, bekam mit <strong>Flying High</strong> das passende Hochgefühl geliefert – ein wohltuender Kontrast zu den vielen dunklen Dungeon-Stücken.`,
        `<strong>HIPPEL-COSO · 8 Instrumente · 12 Timbres · 26 Monopatterns · 64 Divisions</strong>. Schöpft aus 10 Einträgen der gemeinsamen Samplebank und zieht daraus einen schwungvollen 64-Divisions-Höhenflug.`,
        exotica('Amberstar', 'Amberstar'),
        hol(3257, 'Amberstar')
    ),
    "games/amberstar/funkey-dungeon.hipc": museum(
        'JOCHEN HIPPEL — AMBERSTAR / FUNKEY DUNGEON (1992)',
        `Ein Dungeon-Track, der einfach Spaß macht – schon der charmant eigenwillig geschriebene Originaltitel <strong>Funkey Dungeon</strong> (bewusst mit „ey“) beweist, dass sich <strong>Jochen Hippel</strong> bei den Dutzenden <em>Amberstar</em>-Tracks nie zu ernst nahm und gerne klassische Fantasy-Klischees mit Groove brach.`,
        `<strong>HIPPEL-COSO · 6 Instrumente · 11 Timbres · 43 Monopatterns · 64 Divisions</strong>. Schlanke 6-Instrumente-Besetzung mit 7 Sample-Referenzen, deren rhythmische Basslinien über die Paula-Kanäle ordentlich federn.`,
        exotica('Amberstar', 'Amberstar'),
        hol(3257, 'Amberstar')
    ),
    "games/amberstar/gwens-lament.hipc": museum(
        'JOCHEN HIPPEL — AMBERSTAR / GWEN’S LAMENT (1992)',
        `Eines der emotionalsten Stücke des ganzen Spiels: <strong>Gwen’s Lament</strong> trägt einen der wenigen direkt narrativen Personennamen der Suite und liefert eine bewegende, sehnsüchtige Rollenspiel-Ballade aus <strong>Jochen Hippels</strong> wohl melodischster Schaffensphase.`,
        `<strong>HIPPEL-COSO · 9 Instrumente · 16 Timbres · 52 Monopatterns · 68 Divisions</strong>. Teilt sich mit <em>Irish Spring</em> den zweitlängsten Divisions-Umfang der Sammlung und setzt 12 Samples aus der <code>hipc.samp</code>-Bank klangfarbenreich ein.`,
        exotica('Amberstar', 'Amberstar'),
        hol(3257, 'Amberstar')
    ),
    "games/amberstar/hasta-la-vista.hipc": museum(
        'JOCHEN HIPPEL — AMBERSTAR / HASTA LA VISTA (1992)',
        `Kurz nachdem Arnold Schwarzenegger im Sommer 1991 im Kino <em>„Hasta la vista, Baby“</em> in die Popkultur meißelte, schmuggelte <strong>Jochen Hippel</strong> den markigen Spruch in die Dateiliste von <strong>Amberstar</strong>. Ein wunderbarer Schnappschuss des Zeitgeists von 1992.`,
        `<strong>HIPPEL-COSO · 9 Instrumente · 15 Timbres · 24 Monopatterns · 59 Divisions</strong>. Straffe 24 Monopatterns entfalten durch geschicktes Looping und 15 Timbres eine ausgewachsene 59-Divisions-Nummer.`,
        exotica('Amberstar', 'Amberstar'),
        hol(3257, 'Amberstar')
    ),
    "games/amberstar/high-seas.hipc": museum(
        'JOCHEN HIPPEL — AMBERSTAR / HIGH SEAS (1992)',
        `Leinen los auf den Ozeanen von Lyramion! <strong>High Seas</strong> begleitet die Seefahrt-Passagen von <strong>Amberstar</strong> und fängt die Weite und Abenteuerlust klassischer Rollenspiel-Schiffspassagen ein.`,
        `<strong>HIPPEL-COSO · 13 Instrumente · 13 Timbres · 26 Monopatterns · 36 Divisions</strong>. Trotz des kompakten Ablaufs (36 Divisions) fährt Hippel hier satte 13 Instrumente und 12 Samples aus <code>hipc.samp</code> für vollen Wellengang auf.`,
        exotica('Amberstar', 'Amberstar'),
        hol(3257, 'Amberstar')
    ),
    "games/amberstar/horse-song.hipc": museum(
        'JOCHEN HIPPEL — AMBERSTAR / HORSE SONG (1992)',
        `Bevor man sich in <strong>Amberstar</strong> auf Adler-Schwingen erhob, trabte die Abenteurer-Truppe hoch zu Ross über die Wiesen – genau dafür schuf <strong>Jochen Hippel</strong> den galoppierenden, augenzwinkernden <strong>Horse Song</strong>.`,
        `<strong>HIPPEL-COSO · 8 Instrumente · 13 Timbres · 23 Monopatterns · 66 Divisions</strong>. Paradebeispiel für Hippels Pattern-Ökonomie: Gerade einmal 23 Bausteine halten den Ritt über stolze 66 Divisions in Bewegung.`,
        exotica('Amberstar', 'Amberstar'),
        hol(3257, 'Amberstar')
    ),
    "games/amberstar/irish-spring.hipc": museum(
        'JOCHEN HIPPEL — AMBERSTAR / IRISH SPRING (1992)',
        `Neben Metal, Synth-Pop und klassischem Demo-Sound hatte <strong>Jochen Hippel</strong> stets ein großes Herz für keltische und Folk-Melodien: <strong>Irish Spring</strong> ist eines der beliebtesten Stücke aus <strong>Amberstar</strong> überhaupt und verwandelt den Amiga in ein kleines irisches Pub-Ensemble.`,
        `<strong>HIPPEL-COSO · 8 Instrumente · 13 Timbres · 41 Monopatterns · 68 Divisions</strong>. Mit 68 Divisions gleichauf mit <em>Gwen’s Lament</em>, aber dank 41 eigenständiger Monopatterns noch deutlich variationsreicher ausgeschmückt.`,
        exotica('Amberstar', 'Amberstar'),
        hol(3257, 'Amberstar')
    ),
    "games/amberstar/lullaby.hipc": museum(
        'JOCHEN HIPPEL — AMBERSTAR / LULLABY (1992)',
        `Wenn sich der Tag im Inn dem Ende neigt und die erschöpfte Party neue Kräfte sammelt: <strong>Lullaby</strong> zeigt <strong>Jochen Hippel</strong> von seiner zartesten, beinahe kammermusikalischen Seite.`,
        `<strong>HIPPEL-COSO · 17 Instrumente · 17 Timbres · 47 Monopatterns · 40 Divisions</strong>. Zusammen mit <em>Travellers Tune</em> bietet dieses Wiegenlied die <strong>größte Instrumenten- und Timbre-Vielfalt</strong> aller 19 Amberstar-Stücke!`,
        exotica('Amberstar', 'Amberstar'),
        hol(3257, 'Amberstar')
    ),
    "games/amberstar/lurking-horror.hipc": museum(
        'JOCHEN HIPPEL — AMBERSTAR / LURKING HORROR (1992)',
        `Der dunkle Gegenpol zu Taverne, Meer und Wiegenlied: <strong>Lurking Horror</strong> legt sich wie dichter Nebel über finstere Tempel und Katakomben, in denen hinter jeder Ecke tödliche Fallen lauern.`,
        `<strong>HIPPEL-COSO · 8 Instrumente · 12 Timbres · 26 Monopatterns · 52 Divisions</strong>. Mit nur 7 referenzierten Samples aus <code>hipc.samp</code> erzeugt die düstere Harmonik genau das richtige Unbehagen.`,
        exotica('Amberstar', 'Amberstar'),
        hol(3257, 'Amberstar')
    ),
    "games/amberstar/minor-quarrels.hipc": museum(
        'JOCHEN HIPPEL — AMBERSTAR / MINOR QUARRELS (1992)',
        `Kleine Reibereien in der Abenteurer-Truppe oder zankende NPCs – unter dem bescheidenen Titel <strong>Minor Quarrels</strong> verbirgt sich in Wahrheit das epischste Einzelstück des gesamten <strong>Amberstar</strong>-Soundtracks!`,
        `<strong>HIPPEL-COSO · 10 Instrumente · 19 Timbres · 65 Monopatterns · 113 Divisions</strong>. Mit überwältigenden <strong>113 Divisions</strong> (und 65 Patterns!) ist dies die längste und am reichsten ausgearbeitete Sequenz des gesamten Amberstar-COSO-Archivs.`,
        exotica('Amberstar', 'Amberstar'),
        hol(3257, 'Amberstar')
    ),
    "games/amberstar/misty-orc-hop.hipc": museum(
        'JOCHEN HIPPEL — AMBERSTAR / MISTY ORC HOP (1992)',
        `Schräge Fantasy-Folklore direkt aus der Gütersloher Spieleschmiede: Bei <strong>Misty Orc Hop</strong> hört man förmlich, wie eine Horde leicht angesäuselter Orks schwerfällig durch den Sumpf stapft.`,
        `<strong>HIPPEL-COSO · 6 Instrumente · 7 Timbres · 39 Monopatterns · 49 Divisions</strong>. Beweist, wie viel Charakter <strong>Jochen Hippel</strong> mit der zweitkleinsten Instrumenten- und Timbre-Ausstattung der ganzen Sammlung auf die Beine stellt.`,
        exotica('Amberstar', 'Amberstar'),
        hol(3257, 'Amberstar')
    ),
    "games/amberstar/mystic-moments.hipc": museum(
        'JOCHEN HIPPEL — AMBERSTAR / MYSTIC MOMENTS (1992)',
        `Magische Begegnungen, alte Ruinen und geheimnisvolle Prophezeiungen: <strong>Mystic Moments</strong> fängt jene ruhigen Schlüsselmomente in <strong>Amberstar</strong> ein, in denen das Rollenspiel tief in die Lore von Lyramion eintaucht.`,
        `<strong>HIPPEL-COSO · 7 Instrumente · 12 Timbres · 31 Monopatterns · 42 Divisions</strong>. Reduzierte 7 Basis-Instrumente werden über 12 geschmeidige Timbres aus der <code>hipc.samp</code>-Bank geformt.`,
        exotica('Amberstar', 'Amberstar'),
        hol(3257, 'Amberstar')
    ),
    "games/amberstar/ode-to-schnism.hipc": museum(
        'JOCHEN HIPPEL — AMBERSTAR / ODE TO SCHNISM (1992)',
        `Einer der mysteriösesten Insider-Namen in <strong>Jochen Hippels</strong> gesamter Diskografie: Was genau hinter „Schnism“ im Thalion-Büro steckte, bleibt ein Rätsel der frühen 90er – musikalisch bekam dieses mysteriöse Etwas jedenfalls eine prachtvoll ausgearbeitete Ode spendiert.`,
        `<strong>HIPPEL-COSO · 12 Instrumente · 19 Timbres · 46 Monopatterns · 45 Divisions</strong>. Hohe Klangdichte dank 12 benutzter Sample-Einträge und 19 fein abgestimmter Timbres.`,
        exotica('Amberstar', 'Amberstar'),
        hol(3257, 'Amberstar')
    ),
    "games/amberstar/travellers-tune.hipc": museum(
        'JOCHEN HIPPEL — AMBERSTAR / TRAVELLERS TUNE (1992)',
        `Der perfekte Soundtrack für lange Reisen über die Landkarten von <strong>Amberstar</strong>: Optimistisch, leicht folkig und so eingängig, dass man selbst bei langen Fußmärschen von Stadt zu Stadt nicht genervt den Ton abdreht.`,
        `<strong>HIPPEL-COSO · 17 Instrumente · 17 Timbres · 19 Monopatterns · 44 Divisions</strong>. Technischer Kontrastmeister: Während nur 19 Monopatterns recycelt werden, fährt Hippel wie bei <em>Lullaby</em> die maximale Palette von 17 Instrumenten und 17 Timbres auf!`,
        exotica('Amberstar', 'Amberstar'),
        hol(3257, 'Amberstar')
    ),
    "games/amberstar/ingame.hipc": museum(
        'JOCHEN HIPPEL — AMBERSTAR / INGAME (1992)',
        `Ein unscheinbarer, schlichter Dateiname für ein überraschendes Minimalismus-Kleinod: <strong>Ingame</strong> verlässt sich komplett auf starke Melodien statt auf große Klangkulissen.`,
        `<strong>HIPPEL-COSO · 5 Instrumente · 7 Timbres · 26 Monopatterns · 40 Divisions</strong>. Das schlankste Besteck im gesamten 19-Teile-Set: Gerade einmal fünf Instrumente reichen hier völlig für einen waschechten Hippel-Ohrwurm.`,
        exotica('Amberstar', 'Amberstar'),
        hol(3257, 'Amberstar')
    ),
    "games/dune-wormsign.mod": museum(
        'STÉPHANE PICQ — DUNE / WORMSIGN (1992)',
        `Cryo Interactives bildgewaltige Romanverfilmung von <strong>Dune</strong> (1992) trug <strong>Stéphane Picqs</strong> hypnotische, orientalisch-elektronische Klangwelten im Herzen – ein Score, den Picq (zusammen mit Beiträgen von Philippe Ulrich) kurz darauf sogar als eigenes Studio-Album <em>Dune – Spice Opera</em> herausbrachte! Während die PC-Fassung stark auf AdLib Gold und Roland MT-32 setzte, belegt dieses Amiga-Modul eindrucksvoll, wie wuchtig der Sandplanet über vier 8-Bit-Paula-Stimmen klingt.`,
        `<strong>4-Kanal-MOD (<code>FLT4</code>) · 26 Orders · 25 Patterns · 11 Samples (148.686 Bytes)</strong>. Eingebetteter Titel: <code>WORMSIGN</code>. Die Signatur <code>FLT4</code> stammt ursprünglich aus dem frühen Amiga-Tracker <em>StarTrekker</em> und markiert hier ein sauberes Vierkanal-Layout.`,
        { label: 'VGMPF: Dune', url: 'https://vgmpf.com/Wiki/index.php/Dune_(DOS)' }
    ),
    "games/pinball-dreams-beatbox.mod": museum(
        'OLOF GUSTAFSSON — PINBALL DREAMS / BEAT BOX (1992)',
        `Bevor aus der schwedischen Firma Digital Illusions der Blockbuster-Riese <strong>DICE</strong> (<em>Battlefield</em>, <em>Mirror’s Edge</em>) wurde, startete das Studio direkt aus der legendären Amiga-Demogruppe <strong>The Silents (TSL)</strong>! Demo-Musiker <strong>Olof Gustafsson</strong> (<em>Blaizer/TSL</em>) lieferte 1992 für den Meilenstein-Flipper <strong>Pinball Dreams</strong> einen der ersten Soundtracks mit echten Club- und Hip-Hop-Vibes: Der Tisch <strong>Beat Box</strong> klingt bis heute wie eine leibhaftige Amiga-Rave-Party.`,
        `<strong>4-Kanal-MOD (<code>M.K.</code>) · 49 Orders · 49 Patterns · 27 Samples (152.792 Bytes)</strong>. Eingebetteter Titel: <code>pinball-stage-3</code>. Jeder der 49 Orders verweist auf ein eigenes der 49 Patterns – fast ohne Wiederholungsschleifen komponiert, damit die Flipper-Kugel unentwegt frische Breaks serviert bekommt.`,
        { label: 'Wikipedia: DICE', url: 'https://en.wikipedia.org/wiki/DICE_(company)' },
        { label: 'MobyGames: Pinball Dreams', url: 'https://www.mobygames.com/game/703/pinball-dreams/' }
    ),
    "games/pinball-fantasies-party-land.mod": museum(
        'OLOF GUSTAFSSON — PINBALL FANTASIES / PARTY LAND (1992)',
        `Nur wenige Monate nach <em>Pinball Dreams</em> legten die Ex-Silents-Jungs von Digital Illusions im Oktober 1992 mit <strong>Pinball Fantasies</strong> nach – und <strong>Olof Gustafsson</strong> übertraf sich noch einmal selbst. Der Jahrmarkt-Tisch <strong>Party Land</strong> versprüht pure gute Laune, glasklare Synth-Leads und fetteste Paula-Basslines. Die Modulnotiz verrät noch den Arbeitstitel aus der Entwicklungszeit: <code>for pinball dreams 2</code>.`,
        `<strong>4-Kanal-MOD (<code>M.K.</code>) · 64 Orders · 64 Patterns · 26 Samples (210.760 Bytes)</strong>. Eingebetteter Titel: <code>pinball2-table1</code>. Auch hier spendiert Gustafsson ganze 64 einzigartige Patterns über 64 Orders – ein wahrer Luxus für 1992.`,
        { label: 'Wikipedia: Pinball Fantasies', url: 'https://en.wikipedia.org/wiki/Pinball_Fantasies' }
    ),
    "games/project-x-bladswede.mod": museum(
        'ALLISTER BRIMBLE — PROJECT-X / BLADSWEDE REMIX (1992)',
        `Team17s berühmt-berüchtigter Horizontal-Shooter <strong>Project-X</strong> (1992) war knüppelhart – und hatte mit <strong>Allister Brimble</strong> einen der fleißigsten und beliebtesten Amiga-Komponisten an den Reglern (Brimble baute Anfang der 90er auch für <em>Alien Breed</em> und <em>Assassin</em> unvergessliche Stücke). Besonders legendär in der Tracker-Szene wurde diese euphorische Rave-Fassung mit dem Originalnamen <strong>px.bladswede remix!</strong>`,
        `<strong>4-Kanal-MOD (<code>M.K.</code>) · 37 Orders · 21 Patterns · 26 Samples (117.450 Bytes)</strong>. Knallharte Rave-Pianos, schneidende Synth-Stabs und knackige Breaks auf 26 perfekt genutzten Sample-Slots – reiner britischer 1992er Amiga-Rave.`,
        demozooScener(2965, 'Allister Brimble'),
        { label: 'Project-X Music (Amiga)', url: 'https://thecakeisaliegaming.wordpress.com/2019/11/26/project-x-music-amiga/' }
    ),

    // =========================================================================
    // GAMES: 1993
    // =========================================================================
    "games/cannon-fodder.mod": museum(
        'JON HARE & RICHARD JOSEPH — CANNON FODDER (1993)',
        `<em>„War has never been so much fun!“</em> – Mit diesem zynischen Titelsong löste Sensible Softwares Antikriegs-Hit <strong>Cannon Fodder</strong> 1993 in Großbritannien sogar einen Boulevard-Skandal im <em>Daily Star</em> aus (wegen der Soldaten-Gedenk-Mohnblume auf dem Cover). Entwickler-Chef <strong>Jon Hare</strong> schrieb und sang den Reggae-Ohrwurm selbst ein, während <strong>Richard Joseph</strong> alles zu diesem denkwürdigen Amiga-MOD arrangierte – komplett mit digitalisierten Gesangssamples wie <code>War.snd</code>, <code>Brother.snd</code> und <code>DyingInTheSun.snd</code>. Obendrauf drehte das Team für 500 Pfund ein herrlich schräges Musikvideo im <em>Monty-Python</em>-Stil!`,
        `<strong>4-Kanal-MOD (<code>M.K.</code>) · 30 Orders · 18 Patterns · 13 Samples (248.058 Bytes)</strong>. Über 228 KB dieser Datei sind pure, aufwendig geschnittene 8-Bit-Vocal- und Band-Samples, die einen erstaunlich überzeugenden Pseudo-Gesangstrack auf vier Paula-Kanäle zaubern.`,
        { label: 'Wikipedia: Cannon Fodder', url: 'https://en.wikipedia.org/wiki/Cannon_Fodder_(video_game)' },
        { label: 'Remix64: Cannon Fodder — War', url: 'https://remix64.com/track/war/cannon-fodder-war/' }
    ),
    "games/chaos-engine-k8.mod": museum(
        'RICHARD JOSEPH — THE CHAOS ENGINE / K8 (1993)',
        `Steampunk-Viktorianik trifft auf kompromisslosen Top-Down-Shooter: Die Bitmap Brothers landeten 1993 mit <strong>The Chaos Engine</strong> einen weiteren Megahit. <strong>Richard Joseph</strong> lieferte dazu einen schweißtreibenden Industrial-Groove voller dampfbetriebener Beats und metallischer Synth-Flächen. Die archivierte Titeldatei trägt im Inneren schlicht das Kürzel <code>k8</code>.`,
        `<strong>4-Kanal-MOD (<code>FLT4</code>) · 16 Orders · 18 Patterns · 22 Samples (307.558 Bytes)</strong>. Knapp 288 KB pure, druckvolle Samples auf nur 16 Orders – jeder Takt strotzt vor fetten Drum-Loops und präzise geschnittenen Effekten unter der klassischen <code>FLT4</code>-Vierkanal-Signatur.`,
        { label: 'The Ransom Note: Bitmap Brothers', url: 'https://www.theransomnote.com/music/news/the-bitmap-brothers-remembering-the-music-of-amiga-pioneers/' }
    ),
    "games/superfrog-title.mod": museum(
        'ALLISTER BRIMBLE — SUPERFROG (1993)',
        `Team17s grüner Hüpf-Prinz im roten Cape gehört zu den liebenswertesten Amiga-Maskottchen der frühen 90er – und <strong>Allister Brimble</strong> spendierte <strong>Superfrog</strong> 1993 einen herrlich verspielten, energiegeladenen Jump-’n’-Run-Soundtrack zwischen Eurodance und klassischer Videospiel-Fröhlichkeit. Im Inneren der Datei steht übrigens <code>Superfrog World 1</code> neben dem Titelfund.`,
        `<strong>4-Kanal-MOD (<code>M.K.</code>) · 19 Orders · 16 Patterns · 12 Samples (73.836 Bytes)</strong>. Spannender Blick hinter die Kulissen der Amiga-Archivierung: Im Originalspiel nutzte Team17 den gepackten Ingame-Treiber <strong>Player 4.1A</strong>; diese perfekt abspielbare ProTracker-Datei wurde später mit dem Szene-Werkzeug <strong>ProWizard</strong> wieder sauber ins Standard-MOD-Format zurückgerechnet.`,
        demozooScener(2965, 'Allister Brimble'),
        { label: 'Wikipedia: Allister Brimble', url: 'https://en.wikipedia.org/wiki/Allister_Brimble' }
    ),

    // =========================================================================
    // DEMOSCENE: 1989–1996 (4-KANAL-AMIGA-MODS)
    // =========================================================================
    "demoscene/occ-san-geen.mod": museum(
        'UNCLE TOM / SCOOPEX — OCC-SAN-GEEN (1989)',
        `Die späten 80er – als das <em>Soundtracker</em>-Format gerade erst erwachsen wurde: Im Oktober 1989 veröffentlichte <strong>Uncle Tom</strong> von der schwedisch-europäischen Elite-Gruppe <strong>Scoopex</strong> den Klassiker <strong>Occ-San-Geen</strong>. Das Stück fängt exakt den Übergang ein, als Demo-Musiker nicht mehr bloß ein paar Pieps-Samples aneinanderreihten, sondern epische Synth-Pop-Arrangements auf vier Stimmen komponierten.`,
        `<strong>4-Kanal-MOD (<code>M.K.</code>) · 73 Orders · 46 Patterns · 19 Samples (232.298 Bytes)</strong>. Satte 73 Orders zeigen, wie weitläufig und erzählerisch Demo-Kompositionen schon Ende 1989 gebaut wurden – lange vor dem Boom der großen 90er-Trackmos.`,
        demozooMusic(22230, 'Occ-San-Geen')
    ),
    "demoscene/cream-of-the-earth.mod": museum(
        'ROMEO KNIGHT / RED SECTOR INC. — CREAM OF THE EARTH (1989)',
        `Einer der legendärsten Soundtracks der frühen Demoscene-Geschichte: <strong>Romeo Knight</strong> (Michael Scheid) komponierte <strong>Cream of the Earth</strong> Ende 1989 für Red Sector Inc. (RSI) – und vertonte damit die berühmte <strong>CeBIT 90 Demo (Revenge of Babbnaasen)</strong> von RSI &amp; TCC Design, die auf der großen Hannover-Messe im März 1990 prompt den Demo-Wettbewerb gewann! Das eingängige Piano-/Synth-Thema wurde zum unvergessenen Ohrwurm einer ganzen Generation.`,
        `<strong>4-Kanal-MOD (<code>M.K.</code>) · 27 Orders · 28 Patterns · 16 Samples (130.382 Bytes)</strong>. Ein frühes Kunststück auf 100 KB Sampledaten: Alle 28 Patterns sitzen extrem straff und beweisen, dass Romeo Knight aus der deutschen Szene den Soundtracker-Workflow im Schlaf beherrschte.`,
        demozooMusic(21557, 'Cream of the Earth'),
        { label: 'Remix64: Romeo Knight Interview', url: 'https://remix64.com/interviews/an-interview-with-romeo-knight.html' }
    ),
    "demoscene/red-sector-theme.mod": museum(
        '4-MAT / ANARCHY — RED SECTOR THEME (1990)',
        `Wenn der Brite Matthew Simmonds alias <strong>4-Mat</strong> Anfang der 90er in die Tasten griff, blieb kein Tracker-Auge trocken. Dieses Stück – datiert auf den <strong>5. Juli 1990</strong> – erschien unter gleich mehreren Namen in den größten Amiga-Produktionen seiner Zeit: in Anarchys Demo <em>Phantasmagoria</em> ebenso wie als <em>Electric Revenge</em> und <em>Shockwave</em> auf der Kult-Musicdisk <em>Captured Imagination</em>, bevor es in der Szene endgültig als <strong>Red Sector Theme</strong> legendär wurde.`,
        `<strong>4-Kanal-MOD (<code>M.K.</code>) · 50 Orders · 33 Patterns · 12 Samples (214.418 Bytes)</strong>. 4-Mats Markenzeichen: extrem treibende Arpeggio-Läufe (eine tiefe Verneigung vor dem C64-SID!) kombiniert mit druckvollen, sauberen Amiga-Drums auf nur 12 genutzten Samples.`,
        exotica('Red_Sector_Theme', 'Red Sector Theme'),
        demozooMusic(46142, 'Red Sector Theme')
    ),
    "demoscene/macrocosm.mod": museum(
        'FIREFOX / PHENOMENA — MACROCOSM (1990)',
        `Wettbewerbs-Gold von 1990: Mit <strong>Macrocosm</strong> holte der schwedische Kult-Musiker <strong>Firefox</strong> (von der Top-Gruppe <em>Phenomena</em>, bekannt durch Mega-Demos wie <em>Enigma</em>; Kataloge nennen im Umfeld teils auch Tip) den 1. Platz bei der Musik-Competition der <strong>Amiga Halloween Conference 1990</strong>.`,
        `<strong>4-Kanal-MOD (<code>M.K.</code>) · 32 Orders · 26 Patterns · 27 Samples (165.658 Bytes)</strong>. Mit 27 aktiv genutzten Samples füllt Firefox fast das komplette ProTracker-Instrumentenrad aus, um in 26 Patterns ein dichtes, party-erprobtes Gewinnerstück auf die Hallen-PA zu drücken.`,
        demozooMusic(69710, 'Macrocosm'),
        janeway(15194, 'Macrocosm')
    ),
    "demoscene/obvious-disaster.mod": museum(
        'TIP / PHENOMENA — OBVIOUS DISASTER (1990/91)',
        `Direkt aus der Phenomena-Schmiede neben Firefox stammte auch <strong>Tip</strong>: Sein gefeiertes <strong>Obvious Disaster</strong> debütierte im Dezember 1990 als Party-Version, bevor diese ausgefeilte Final-Fassung 1991 ihren Siegeszug durch Diskmags, BBS-Mailboxen und Musicdisks antrat.`,
        `<strong>4-Kanal-MOD (<code>M.K.</code>) · 53 Orders · 50 Patterns · 26 Samples (212.512 Bytes)</strong>. Auch dieses File dokumentiert echte Szenearchäologie: Aus platzsparenden Demo-Gründen ursprünglich in <strong>NoisePacker v2</strong> komprimiert, wurde es später per <strong>ProWizard</strong> sauber wieder ins lesbare MOD-Format entpackt.`,
        janeway(7129, 'Obvious Disaster (Final)'),
        janeway(326, 'Obvious Disaster (Party)')
    ),
    "demoscene/hysteria.mod": museum(
        'AUDIOMONSTER / THE SILENTS — HYSTERIA (1991)',
        `Schweden-Power von <em>The Silents</em> im Frühling 1991: <strong>Audiomonster</strong> datierte sein Stück <strong>Hysteria</strong> genau auf den <strong>19. April 1991</strong> – und bewies Sinn für Selbstinszenierung in den Sample-Namen: Liest man die 31 Instrumenten-Slots von oben nach unten, buchstabieren sie Schritt für Schritt seinen eigenen Namen „Audiomonster“ durch das ganze Modul.`,
        `<strong>4-Kanal-MOD (<code>M.K.</code>) · 43 Orders · 27 Patterns · 14 Samples (84.158 Bytes)</strong>. Trotz gerade einmal 55 KB reinen Sampledaten entsteht über 43 Orders ein energiegeladener, messerscharfer Demo-Groove – perfekt komprimierte Tracker-Kunst der Vor-Trackmo-Ära.`,
        demozooMusic(57578, 'Hysteria')
    ),
    "demoscene/elysium.mod": museum(
        'JESTER / SANITY — ELYSIUM (1991)',
        `Eines der unangefochtenen Kronjuwelen der gesamten Amiga-Demoscene! Am <strong>28. April 1991</strong> (weit vor späteren Sanity-Wundern wie <em>Arte</em> oder <em>World of Commodore</em>) erschien die legendäre Demo <strong>Elysium</strong> der deutschen Ausnahmegruppe Sanity – untermalt von diesem träumerischen, vorwärtsstrebenden Track von <strong>Jester</strong> (Volker Tripp).`,
        `<strong>4-Kanal-MOD (<code>M.K.</code>) · 29 Orders · 23 Patterns · 16 Samples</strong>. Ein technischer Leckerbissen für Paula-Puristen gleich im allerersten Pattern: Der ProTracker-Befehl <strong><code>E01</code></strong>! Auf dem Amiga 500 war der feste analoge Tiefpassfilter direkt an die grüne <strong>Power-LED</strong> gekoppelt – erst durch <code>E01</code> schaltet sich die LED und damit der dumpfe Filter ab, sodass Jesters schillernde Akkord-Samples völlig kristallklar glänzen können.`,
        exotica('Elysium', 'Elysium'),
        demozooMusic(19935, 'Elysium'),
        pouet(1505, 'Elysium')
    ),
    "demoscene/guardian-dragon.mod": museum(
        'S.L.L. — GUARDIAN DRAGON (1991)',
        `Ein echtes Stück dänischer Demo-Nostalgie von 1991: <strong>Guardian Dragon</strong> untermalte die gleichnamige Produktion der legendären Amiga-Gruppe <strong>Kefrens</strong>, komponiert von <strong>S.L.L.</strong> Atmosphärische Synth-Melodien treffen genau den Geist der frühen 90er-Kefrens-Disks.`,
        `<strong>4-Kanal-MOD (<code>M.K.</code>) · 47 Orders · 35 Patterns · 20 Samples (163.246 Bytes)</strong>. Ursprünglich im gepackten <strong>UNIC Tracker</strong> für die Demo gespeichert und später über <strong>ProWizard</strong> verlustfrei in Standard-ProTracker rekonstruiert.`,
        demozooScener(669, 'S.L.L.'),
        janeway(881, 'Guardian Dragon')
    ),
    "demoscene/towards-immortality.mod": museum(
        'GROO / THE BLACK ROBES — TOWARDS IMMORTALITY (1992)',
        `Ein Stück finnische Demo-Geschichte von der allerersten <strong>Assembly 1992</strong> (dem Beginn einer der größten Demopartys der Welt)! Mit <strong>Towards Immortality</strong> (im Modul fertiggestellt am <strong>16. Juli 1992</strong>) stürmte <strong>Groo</strong> (The Black Robes) direkt aufs Treppchen und holte einen sensationellen <strong>2. Platz</strong> im Musikwettbewerb.`,
        `<strong>4-Kanal-MOD (<code>M.K.</code>) · 40 Orders · 37 Patterns · 19 Samples</strong>. 37 Patterns auf 40 Orders ohne nennenswerte Lückenfüller: Groo verwebt hier melancholische Melodiebögen mit klassischen 92er-Break-Elementen zu einem echten Party-Favoriten.`,
        demozooMusic(6410, 'Towards Immortality'),
        { label: 'Pouët: Assembly 1992 Results', url: 'https://www.pouet.net/party_results.php?which=7&amp;when=1992' }
    ),
    "demoscene/sanctuary.mod": museum(
        'MOBY — SANCTUARY / IMPACT16 (1992)',
        `Wenn der Franzose Frédéric Motte alias <strong>Moby</strong> (Sanity, bekannt durch Meisterwerke wie <em>Elekfunk</em> und <em>Knulla Kuk</em>) an den ProTracker ging, klang jeder Akkord wie aus einem High-End-Studio. <strong>Sanctuary</strong> – im Modul selbst noch schlicht als <code>impact16</code> betitelt – beweist eindrucksvoll, wie wenig Rohmaterial echte Virtuosen brauchen.`,
        `<strong>4-Kanal-MOD (<code>M.K.</code>) · 27 Orders · 11 Patterns · nur 6 Samples (47.236 Bytes)</strong>. Gerade einmal 34.888 Bytes an Sampledaten und elf Patterns reichen Moby aus, um mit messerscharfen Chord-Tricks und perfektem Timing eine erstaunlich volle Komposition zu bauen.`,
        janeway(37854, 'Sanctuary'),
        demozooScener(416, 'Moby')
    ),
    "demoscene/guitar-slinger.mod": museum(
        'JOGEIR LILJEDAHL — GUITAR SLINGER (1993)',
        `Der Titel sagt alles: Norwegens bekanntester ProTracker-Meister <strong>Jogeir Liljedahl</strong> (<em>Noiseless</em>, Modulsignatur <code>(c) 1992/93 noiseless</code>) holte mit <strong>Guitar Slinger</strong> 1993 den <strong>1. Platz</strong> auf der Party <em>Rendezvous 1993</em>! Damals staunte die gesamte Szene ungläubig, wie authentisch gezupfte und verzerrte E-Gitarren aus einem 4-Kanal-Heimcomputer klingen können.`,
        `<strong>4-Kanal-MOD (<code>M.K.</code>) · 41 Orders · 41 Patterns · 31 Samples (406.354 Bytes)</strong>. Fast jeder der 31 möglichen ProTracker-Slots ist gefüllt mit exakt getimten Gitarren-Slides, Obertönen und Bass-Phrasen: Keine Zauberei eines 32-Stimmen-Synths, sondern pures Sample-Handwerk und virtuoses 4-Kanal-Pitch-Bending auf Paula.`,
        janeway(47991, 'Guitar Slinger')
    ),
    "demoscene/trans-atlantic.mod": museum(
        'LIZARDKING / ALCATRAZ — TRANS ATLANTIC (1993)',
        `Der Schwede <strong>Lizardking</strong> (Gustaf Grefberg, bei <em>Alcatraz</em> und später Komponist für <em>Starbreeze</em> / <em>Chronicles of Riddick</em>) gehörte 1993 zu den absoluten Superstars des ProTrackers – bekannt für seinen klaren, fast schon „dos-trackmo-haften“ Synth-Sound auf dem Amiga. Ein Sampletext im Modul verrät auch die Party-Wurzeln vom Mai 1993: Ein Wettbewerb im schwedischen Mora, organisiert von Renegade.`,
        `<strong>4-Kanal-MOD (<code>M.K.</code>) · 63 Orders · 51 Patterns · 31 Samples (315.418 Bytes)</strong>. Vollausbau im ProTracker: Alle 31 Sample-Slots sind belegt und treiben 51 verschiedene Patterns durch eine epische, gut 262 KB schwere Sample-Show.`,
        demozooScener(232, 'Lizardking')
    ),
    "demoscene/acid-injection.mod": museum(
        'NUKE / OPTIK — ACID INJECTION (1993)',
        `Ein herrliches Stück nächtliche Tracker-Romantik, direkt im Modul für die Nachwelt konserviert: <strong>Nuke / Optik</strong> verewigte in den Sampletexten von <strong>Acid Injection</strong> exakt wann der letzte Ton saß – <code>On 12-28-93</code> und <code>FiNiShEd At 2:50am</code>! Treibender Acid-Rave zwischen Weihnachten und Neujahr 1993.`,
        `<strong>4-Kanal-MOD (<code>M.K.</code>) · 32 Orders · 25 Patterns · 8 Samples (113.646 Bytes)</strong>. Reduziert auf acht präzise Rave- und 303-artige Samples, befeuert das Stück 25 straffe Patterns voller Tempo und roher Acid-Energie.`,
        { label: 'Demozoo: Acid Injection Index', url: 'https://demozoo.org/music/?order=title&amp;dir=desc&amp;platform=&amp;production_type=&amp;page=2636' }
    ),
    "demoscene/phantazia.mod": museum(
        'QUAZAR — PHANTAZIA.2 (1995)',
        `Als 1995 immer mehr Musiker auf PC-Mehrspur-Tracker abwanderten, zog <strong>Quazar</strong> noch einmal einen glanzvollen Schlussstrich unter die klassische 4-Kanal-Ära: Eine Notiz direkt im Modul bezeichnet <strong>Phantazia.2</strong> ausdrücklich als letztes Amiga-MOD des Autors und unterstreicht stolz <code>only 4 channels</code>.`,
        `<strong>4-Kanal-MOD (<code>M.K.</code>) · 50 Orders · 44 Patterns · 30 Samples (429.748 Bytes)</strong>. Mit fast 430 KB (davon über 383 KB schwelgerische Sampledaten) das wuchtigste 4-Kanal-Modul dieser Sammlung – ein Abgesang auf den Amiga, der sich vor keinem 16-Kanal-PC-Tracker verstecken muss.`,
        { label: 'Archivbefund: Modulnotiz „phantazia.2 (only 4 channels)“', url: '#top' }
    ),
    "demoscene/carillon.mod": museum(
        'DIZZY / CARILLON & CYBERIAD — CARILLON (1996)',
        `Die ultimative Demonstration finnischer Minimalismus-Kunst: Am <strong>2. April 1996</strong> veröffentlichte <strong>Dizzy</strong> (Mitgründer der bekannten Gruppe <em>Carillon &amp; Cyberiad</em>) dieses Modul, das auf dem Aminet schlicht als <strong>12-KB-Archiv</strong> landete – ein ganzes, glockenhelles Musikstück auf dem kleinsten denkbaren Raum!`,
        `<strong>4-Kanal-MOD (<code>M.K.</code>) · 2 Orders · 2 Patterns · genau 1 Sample (27.708 Bytes)</strong>. Kein Parser-Bug, sondern pure Absicht: Aus einem <strong>einzigen</strong> 24-KB-Sample zaubert Dizzy auf vier Paula-Kanälen Akkorde, Bass, Echo und Melodie in nur zwei Patterns – das kleinste Wunder der gesamten Amiga-Liste.`,
        { label: 'Aminet: Carillon', url: 'https://aminet.net/package/mods/dizzy/Carillon' }
    ),

    // =========================================================================
    // TRACKER-XM (MULTI-CHANNEL-COVERS & PC-FASTTRACKER-2-KLASSIKER)
    // =========================================================================
    "tracker-xm/space-debris.xm": museum(
        'CAPTAIN / MARKUS KAARLONEN — SPACE DEBRIS (XM-REMAKE)',
        `1991 erschuf der junge Finne <strong>Markus „Captain“ Kaarlonen</strong> das wahrscheinlich meistgehörte Amiga-MOD aller Zeiten: <strong>Space Debris</strong> – berühmt für seine nahtlosen Crossfade-Loops, geschichteten Akkord-Samples und selbst programmierten Echo-Delays. Jahre später stieg Kaarlonen als Keyboarder und Produzent bei der erfolgreichen finnischen Rockband <strong>Poets of the Fall</strong> ein (und prägte damit u. a. den Kult-Soundtrack zu <em>Alan Wake</em>, <em>Max Payne 2</em> und <em>Old Gods of Asgard</em>!).`,
        `<strong>FastTracker-XM (32 Kanäle!) · 58 Orders · 60 Patterns · 45 Samples</strong>. Wichtig für Puristen: Dies ist <strong>nicht</strong> das ursprüngliche 4-Kanal-Amiga-MOD von 1991, sondern eine stark ausgebaute 32-Spur-XM-Neubearbeitung. Sie zeigt eindrucksvoll, wie aus einem winzigen 4-Spur-Klassiker durch die Möglichkeiten späterer PC-Tracker ein monumentales Breitwand-Arrangement wurde.`,
        exotica('Captain', 'Captain'),
        { label: 'Markus Kaarlonen: Space Debris', url: 'https://markuskaarlonen.com/space-debris' },
        { label: 'Wikipedia: Markus Kaarlonen', url: 'https://en.wikipedia.org/wiki/Markus_Kaarlonen' }
    ),
    "tracker-xm/turrican-2-title.xm": museum(
        'CHRIS HÜLSBECK — TURRICAN II TITLE (XM-COVER)',
        `<strong>Turrican II: The Final Fight</strong> (Factor 5 / Rainbow Arts, 1991) gilt als Gipfel der Amiga-Spielemusik: <strong>Chris Hülsbeck</strong> schuf ein unsterbliches Hauptthema – und sprengte dafür scheinbar das 4-Kanal-Limit des Amiga! Mit seiner <strong>TFMX-7-Voice-Engine</strong> (technisch inspiriert von Jochen Hippels Software-Mixer) rechnete die 68000-CPU vier virtuelle Stimmen in Echtzeit auf einen einzigen Paula-Kanal zusammen, sodass drei weitere Kanäle frei für fette Drums, Bässe und Melodien blieben.`,
        `<strong>FastTracker-XM (16 Spuren) · 86 Orders · 73 Patterns · 12 Samples</strong>. Da das native TFMX-Original (<code>mdat</code> + <code>smpl</code>) einen eigenen 68000-Mixer verlangt, konserviert dieser Track eine sorgfältig arrangierte 16-Kanal-XM-Adaption, die den legendären 7-Stimmen-Druck über unseren XM-Sequencer hörbar macht.`,
        exotica('Turrican_II_-_The_Final_Fight', 'Turrican II'),
        exotica('TFMX', 'TFMX')
    ),
    "tracker-xm/deadlock.xm": museum(
        'ELWOOD — DEAD LOCK (1995)',
        `Mitte der 90er verlagerte sich das Zentrum der Tracker-Szene vom Amiga auf den PC mit Gravis Ultrasound, SoundBlaster und dem schwedischen Kult-Tool <strong>FastTracker 2</strong> (entwickelt von Triton). Der Finne Jussi-Matti Salmela alias <strong>Elwood</strong> komponierte 1995 mit <strong>Dead Lock</strong> eines der berühmtesten Aushängeschilder dieser neuen XM-Ära – bis heute eines der meistzitierten Referenzstücke der gesamten <code>.xm</code>-Geschichte.`,
        `<strong>FastTracker-XM (24 Spuren) · 76 Orders · 59 Patterns · 32 Samples</strong>. Kein Amiga-MOD, sondern ein reiner MS-DOS-Mehrkanal-Klassiker: Glasklare 16-Bit-Samples, Volumehüllkurven und bis zu 24 parallel laufende Spuren markieren genau den historischen Moment, in dem das Tracker-Erbe des Amiga auf dem PC explodierte.`,
        exotica('Dead_Lock', 'Dead Lock'),
        demozooMusic(51819, 'Dead Lock'),
        { label: 'Wikipedia: FastTracker 2', url: 'https://en.wikipedia.org/wiki/FastTracker_2' }
    )
};