// ==========================================
// Atari ST YM2149 Jukebox Playlist Registry
// Kuratierte Spiele- und Demo-Sammlung
// ==========================================

import { loadYmFile } from '../../js/parsers/ym-parser.js';

const trackDefinitions = [];
const basename = path => path.split('/').pop();

function museumText(section, title, context, archiveNote) {
    return `
        <h3>[ ${section} ]</h3>
        <p><strong>${title}</strong></p>
        <p>${context}</p>
        <p><strong>YM-Archiv:</strong> ${archiveNote}</p>
    `;
}

function addRootTrack(sourcePath, title, section, context, archiveNote, listTitle = title) {
    trackDefinitions.push({
        path: basename(sourcePath), sourcePath, title, listTitle,
        composerInfo: museumText(section, title, context, archiveNote)
    });
}

function addGameTrack(folder, sourcePath, title, context, archiveNote, listTitle = title) {
    trackDefinitions.push({
        path: `spiele/${folder}/${basename(sourcePath)}`, sourcePath, title, listTitle,
        composerInfo: museumText('ATARI ST · SPIELMUSIK', title, context, archiveNote)
    });
}

function addDemoTrack(folder, sourcePath, title, context, archiveNote, listTitle = title) {
    trackDefinitions.push({
        path: `demo-szene/${folder}/${basename(sourcePath)}`, sourcePath, title, listTitle,
        composerInfo: museumText('ATARI ST · DEMO-SZENE', title, context, archiveNote)
    });
}

// Redaktionelle Einstiege bleiben direkt in der Wurzel sichtbar.
addRootTrack(
    'thalion_loader.YM', 'Thalion – Intro', 'ATARI ST · THALION',
    'Dieser Registerdump trägt den eingebetteten Titel <em>Thalion Intro</em> und nennt Jochen Hippel als Autor. Er bündelt die melodiöse Seite der ST-Musik, ohne aus der Datei heraus eine bestimmte Spielszene zu behaupten.',
    'YM5!, 50 Hz, 8.868 Frames. Der gespeicherte Loop beginnt bei Frame 1.016; die Konvertierung wird Oedipus zugeschrieben.',
    'Thalion – Intro'
);

addRootTrack(
    'BIONIC1.YM', 'Bionic Commando', 'ATARI ST · TIM FOLLIN',
    'Die Datei nennt <strong>Tim Follin</strong> als Autor und <em>Bionic Commando</em> als Titel. Aufgenommen ist die ST-Fassung als eigenständiger YM-Registerdump, nicht eine Sample- oder SID-Aufnahme.',
    'YM5!, 4.735 Frames bei 50 Hz, ohne eingebettete Digidrums. Frühere Behauptungen über CPU-Last oder Phasing lassen sich aus diesem Container nicht belegen und wurden entfernt.'
);

addGameTrack(
    'dragonflight', 'dragonflight/Dragonflight_Title.YM', 'Dragonflight – Titel',
    'Jochen Hippel wird im Autorenfeld ausdrücklich als Mad Max geführt. Der eingebettete Name bezeichnet diese Fassung eindeutig als Titelmusik zu Thalions Fantasy-Rollenspiel.',
    'YM6!, 21.250 Frames beziehungsweise 425 Sekunden bei 50 Hz. Konvertiert von Jochen Knaus.',
    'Titel'
);
addGameTrack(
    'dragonflight', 'dragonflight/Dragonflight_City_1.YM', 'Dragonflight – Stadt 1',
    'Eine der drei im Archiv ausgewiesenen Stadt-Fassungen. Jochen Hippel ist als Autor eingetragen; die Nummer dient der Unterscheidung der Dumps und benennt keinen konkreten Spielort.',
    'Der Container nennt <em>Dragonflight: City</em>. YM6!, 9.200 Frames, konvertiert von Leonard.',
    'Stadt 1'
);
addGameTrack(
    'dragonflight', 'dragonflight/Dragonflight_City_2.YM', 'Dragonflight – Stadt 2',
    'Die zweite Stadt-Fassung der Dragonflight-Auswahl. Wie bei den übrigen Dumps bleibt die Zuordnung zu einem bestimmten Ort bewusst offen.',
    'Eingebetteter Name: <em>Dragonflight: City #2</em>; Autor Jochen Hippel. YM6!, 12.300 Frames.',
    'Stadt 2'
);
addGameTrack(
    'dragonflight', 'dragonflight/Dragonflight_City_3.YM', 'Dragonflight – Stadt 3',
    'Die dritte Stadt-Fassung ergänzt die beiden längeren Stadt-Dumps um eine kürzere Variante aus demselben Spielkontext.',
    'Eingebetteter Name: <em>Dragonflight: City #3</em>; Autor Jochen Hippel. YM6!, 7.150 Frames.',
    'Stadt 3'
);
addGameTrack(
    'dragonflight', 'dragonflight/Dragonflight_unspec.YM', 'Dragonflight – Szene nicht bezeichnet',
    'Jochen Hippel ist als Autor belegt, die konkrete Verwendung im Spiel jedoch nicht. Der Titel wird deshalb nicht nachträglich als Stadt-, Lade- oder Endmusik etikettiert.',
    'Der eingebettete Name lautet lediglich <em>Dragonflight: ?</em>. YM6!, 4.600 Frames, konvertiert von Leonard.',
    'Szene unbekannt'
);

for (let fileNumber = 1; fileNumber <= 20; fileNumber += 1) {
    const archiveNumber = 21 - fileNumber;
    const filename = `AMBER${String(fileNumber).padStart(2, '0')}.YM`;
    addGameTrack(
        'amberstar', `amberstar/${filename}`, `Amberstar – Musik #${archiveNumber}`,
        'Ein Musikdump aus Jochen Hippels Arbeit an Thalions Rollenspiel <em>Amberstar</em>. Die Archivnummer erhält die Reihenfolge des Containers; sie wird nicht mit einem erfundenen Orts- oder Szenentitel gleichgesetzt.',
        `Eingebetteter Name: <em>Amberstar #${archiveNumber}</em>; Autor Mad Max. Die Datei ${filename} wurde mit SainT erzeugt. Eine konkrete Zuordnung wie Twinlake, Taverne oder Titelthema ist aus den YM-Metadaten nicht ableitbar.`,
        `Musik #${archiveNumber}`
    );
}

const wingDigidrums = [4, 2, 2, 3, 3, 2, 3, 4, 3];
for (let level = 1; level <= 9; level += 1) {
    addGameTrack(
        'wings-of-death', `wings-of-death/WINGLEV${level}.YM`, `Wings of Death – Musikdump ${String(level).padStart(2, '0')}`,
        'Jochen Hippels Musik zu <em>Wings of Death</em> liegt hier in der Reihenfolge der vorhandenen Dateien vor. Die Nummer bezeichnet den Dump und wird nicht unbelegt als Levelname ausgegeben.',
        `Alle neun Dateien tragen intern nur den generischen Namen <em>Wing of Death Level</em>. Dieser YM6!-Container enthält ${wingDigidrums[level - 1]} Digidrum-Blöcke; eine konkrete Levelbezeichnung fehlt.`,
        `Musikdump ${String(level).padStart(2, '0')}`
    );
}
addGameTrack(
    'wings-of-death', 'wings-of-death/WINGLOAD.YM', 'Wings of Death – Loader',
    'Der Loader ist die einzige Datei dieser Gruppe, deren Verwendung im eingebetteten Namen ausdrücklich genannt wird. Jochen Hippel ist als Autor eingetragen.',
    'YM6!, 1.550 Frames beziehungsweise 31 Sekunden, mit fünf eingebetteten Digidrum-Blöcken. Konvertiert von Leonard.',
    'Loader'
);

for (let musicNumber = 1; musicNumber <= 7; musicNumber += 1) {
    addGameTrack(
        'lethal-xcess', `LethalXcess${musicNumber}.YM`, `Lethal Xcess – Musik ${musicNumber}`,
        'Ein Musikdump aus <em>Lethal Xcess</em> mit Jochen Hippel beziehungsweise Mad Max im Autorenfeld. Die Sammlung nutzt die vorhandene Musiknummer statt nicht verifizierter Level- oder Credits-Titel.',
        `Eingebetteter Name: <em>Lethal XCess Music ${musicNumber}</em>. YM5! mit vier Digidrum-Blöcken. Die Datei belegt weder einen konkreten Levelnamen noch ein Stereo-Panning oder Nachhall-Verhalten.`,
        `Musik ${musicNumber}`
    );
}

addGameTrack(
    'turrican', 'turrican1_world_1_1.YM', 'Turrican – World 1-1',
    'Der Dateiname ordnet den Dump World 1-1 zu. Das Autorenfeld nennt Jochen Hippel und in Klammern Chris Hülsbeck; diese gemeinsame Nennung wird unverändert dokumentiert.',
    'Eingebetteter Titel: <em>Turrican</em>. YM5!, 6.480 Frames, drei Digidrum-Blöcke; Konvertierung durch Oedipus.',
    'World 1-1'
);
addGameTrack(
    'turrican', 'Turrican2_TheDesertRocks.YM', 'Turrican 2 – The Desert Rocks',
    'Der eingebettete Titel identifiziert <em>The Desert Rocks</em>. Auch hier nennt das Autorenfeld Jochen Hippel und in Klammern Chris Hülsbeck.',
    'YM6!, 10.080 Frames, zehn Digidrum-Blöcke. Die Zahl beschreibt den Inhalt des Containers und ist keine Behauptung über zusätzliche Hardwarekanäle.',
    'The Desert Rocks'
);

addGameTrack(
    'xenon', 'XN3.YM', 'Xenon – Titel',
    'David Whittakers Titelmusik zu <em>Xenon</em>. Diese Datei war zuvor fälschlich als Highscore- oder Endthema beschrieben; der eingebettete Titel legt die Verwendung eindeutig fest.',
    'Eingebetteter Name: <em>Xenon (Title)</em>. YM5!, 5.759 Frames, ohne Digidrums; konvertiert von Oedipus.',
    'Titel'
);
addGameTrack(
    'xenon', 'XN1.YM', 'Xenon – Ingame',
    'Die Ingame-Fassung von David Whittakers Xenon-Musik. Sie ist nicht das Titelthema; die frühere Beschreibung wurde anhand der Datei-Metadaten korrigiert.',
    'Eingebetteter Name: <em>Xenon (Ingame)</em>. YM5!, 12.287 Frames, ohne Digidrums.',
    'Ingame'
);
addGameTrack(
    'xenon', 'XN2.YM', 'Xenon – End-of-Level-Battle',
    'Eine kurze, eigenständig ausgewiesene Musik für den End-of-Level-Kampf. Die Datei wird dadurch von Ingame- und Titelmusik unterschieden.',
    'Eingebetteter Name: <em>Xenon (End of level battle)</em>; Autor David Whittaker. YM5!, 3.071 Frames.',
    'End-of-Level-Battle'
);

const gianaTracks = [
    ['Giana_Title.YM', 'Titel', 'Great Giana Sisters (title)', 'Jochen Hippel'],
    ['Giana_InGame1.YM', 'Ingame 1', 'Great Giana Sisters (ingame1)', 'Jochen Hippel'],
    ['Giana_InGame2.YM', 'Ingame 2', 'Great Giana Sisters (ingame2)', 'Jochen Hippel'],
    ['Giana_InGame3.YM', 'Ingame 3', 'Great Giana Sisters', 'Jochen Hippel (Chris Huelsbeck)'],
    ['Giana_Bonus.YM', 'Bonus Stage', 'Great Giana Sisters (bonus stage)', 'Jochen Hippel'],
    ['Giana_Highscore.YM', 'Highscore', 'Great Giana Sisters', 'Jochen Hippel (Chris Huelsbeck)']
];
for (const [sourcePath, listTitle, embeddedName, author] of gianaTracks) {
    addGameTrack(
        'giana-sisters', sourcePath, `The Great Giana Sisters – ${listTitle}`,
        'Ein Dump aus der ST-Fassung von <em>The Great Giana Sisters</em>. Titel und Autorenangabe folgen dem jeweiligen Container statt einer pauschalen Beschreibung für alle sechs Stücke.',
        `Eingebetteter Name: <em>${embeddedName}</em>; Autor: ${author}. Die kurzen Bonus- und Highscore-Dumps bleiben als eigene Einträge erhalten.`,
        listTitle
    );
}

for (let version = 1; version <= 3; version += 1) {
    addGameTrack(
        'ghouls-n-ghosts', `ghouls-n-ghosts/Ghouls_${version}.YM`, `Ghouls ’n Ghosts – Archivfassung ${version}`,
        'Eine von drei neu aufgenommenen YM-Fassungen mit <strong>Tim Follin</strong> im Autorenfeld. Die Auswahl erweitert den bisherigen Follin-Einstieg über Bionic Commando hinaus.',
        `Eingebetteter Titel: <em>Ghouls'n Ghosts</em>. Die Quelldatei war als <em>Ghouls ${version}</em> benannt; eine Titel- oder Levelzuordnung ist daraus nicht ableitbar und wird deshalb nicht ergänzt.`,
        `Archivfassung ${version}`
    );
}

addGameTrack(
    'speedball', 'speedball/Speedball_1.YM', 'Speedball – Archivfassung 1',
    'Neu in der Auswahl: ein langer YM5!-Dump mit <strong>David Whittaker</strong> als Autor. Er ergänzt die vorhandenen Xenon-Stücke um eine weitere Spielmusik des Bitmap-Brothers-Umfelds.',
    'Eingebetteter Titel: <em>Speedball</em>, 7.529 Frames bei 50 Hz. Die Quelldatei trägt lediglich die Nummer 1; eine genauere Szenenbezeichnung ist nicht belegt.',
    'Archivfassung 1'
);

addRootTrack(
    'stormlord/Stormlord_Title.YM', 'Stormlord – Titel', 'ATARI ST · JOCHEN HIPPEL',
    'Neu aufgenommen und direkt als Titelmusik ausgewiesen. Der Container nennt Jochen Hippel und bezeichnet die Fassung zusätzlich als MoN-Konvertierung.',
    'Eingebetteter Name: <em>Stormlord: Title (MoN conversion)</em>. YM5!, 18.624 Frames, konvertiert von Leonard.',
    'Stormlord – Titel'
);
addGameTrack(
    'stormlord', 'stormlord/Stormlord_Ingame.YM', 'Stormlord – Ingame',
    'Die zweite neue Stormlord-Fassung ist ausdrücklich als Ingame-Musik bezeichnet. Dadurch sind Titel und Spielmusik getrennt erreichbar.',
    'Eingebetteter Name: <em>Stormlord Ingame (MoN conversion)</em>; Autor Jochen Hippel. YM5!, 24.576 Frames.',
    'Ingame'
);

addGameTrack(
    'chambers-of-shaolin', 'chambers-of-shaolin/Chambers_Title.YM', 'Chambers of Shaolin – Titel',
    'Neu in der Sammlung: die ausdrücklich benannte Titelmusik mit Jochen Hippel im Autorenfeld. Sie ergänzt die bereits gut vertretenen Thalion-Soundtracks um ein weiteres Spiel.',
    'Eingebetteter Name: <em>Chambers of Shaolin Title Track</em>. YM6!, 24.600 Frames, konvertiert von Leonard.',
    'Titel'
);
addGameTrack(
    'chambers-of-shaolin', 'chambers-of-shaolin/Chambers_Loader.YM', 'Chambers of Shaolin – Loader',
    'Die Loader-Fassung ist kürzer als der Titel-Dump und besitzt eine eigene, eingebettete Szenenbezeichnung. Der Schreibfehler „Shalolin“ im Originalmetadatum wird hier nicht als neuer Titel übernommen.',
    'Eingebetteter Name: <em>Chambers of Shalolin Loader</em>; Autor Jochen Hippel. YM6!, 8.550 Frames.',
    'Loader'
);

addGameTrack(
    'xenon-2', 'xenon-2/Xenon_2_Megablast.YM', 'Xenon 2 – Megablast',
    'Neu aufgenommen: die ST-Fassung von <em>Megablast</em>. David Whittaker bearbeitete das Stück von Bomb the Bass für das Spiel; die ST-Version wird hier als YM3!-Registerdump und nicht als Amiga-Samplefassung präsentiert.',
    'Der YM3!-Container enthält selbst weder Titel- noch Autorenmetadaten. Die Einordnung folgt der Spieldokumentation; die Herkunft der Datei ist in <em>tracks/atari/SOURCES.md</em> festgehalten.',
    'Megablast'
);

addGameTrack(
    'led-storm', 'led-storm/LED_Storm_1.YM', 'LED Storm – Archivfassung 1',
    'Ein weiterer neuer Tim-Follin-Track. Der eingebettete Titel nennt <em>Led Storm</em>; die Nummer stammt aus der Quelldatei und ist keine unbelegte Levelangabe.',
    'YM5!, 8.109 Frames bei 50 Hz, Autor Tim Follin. Der gespeicherte Loop beginnt bei Frame 8.099; Konvertierung durch Oedipus.',
    'Archivfassung 1'
);

addRootTrack(
    'GOLDRUN.YM', 'Goldrunner', 'ATARI ST · ROB HUBBARD',
    'Der Container nennt <strong>Rob Hubbard</strong> als Autor und <em>Goldrunner</em> als Titel. Die Museumskarte beschränkt sich auf diese belegte Zuordnung statt auf nicht nachgewiesene Aussagen zur Sound-Engine.',
    'YM5!, 9.408 Frames beziehungsweise 188,16 Sekunden bei 50 Hz, ohne Digidrums; Konvertierung durch Oedipus.'
);

addGameTrack(
    'enchanted-land', 'EnchantedLands_Intro.YM', 'Enchanted Land – Intro',
    'Der eingebettete Titel lautet <em>Enchanted Lands: Intro</em> und nennt Jochen Hippel als Autor. Die Mehrzahl im Metadatum wird als historische Bezeichnung dokumentiert, die Listenzeile verwendet den geläufigen Spieltitel.',
    'YM6!, 11.650 Frames beziehungsweise 233 Sekunden, ohne Digidrums; Konvertierung durch Leonard.',
    'Intro'
);

const unionTracks = [
    ['UnionDemo_Mega_Apocalypse.YM', 'Sphericool Screen', 'Sphericool Screen (UNION DEMO)', 'Mad Max; als Originalkomponist ist Rob Hubbard eingetragen', 1344],
    ['UnionDemo_Level_16_Fullscreen.YM', 'L16 FullScreen', 'L16 FullScreen (Union Demo)', 'Mad Max', 0],
    ['UnionDemo_ThatsTheWayItIs.YM', 'Copier', 'UNION DEMO Copier', 'Mad Max; als Originalkomponist ist M.O.N. eingetragen', 0],
    ['UnionDemo_NinjaRemix.YM', 'TNT Vector Screen', 'TNT Vector Screen (UNION DEMO)', 'Mad Max; als Originalkomponist ist M.O.N. eingetragen', 0],
    ['UnionDemo_Thundercats.YM', 'TCB Scroller', 'TCB Scroller (UNION DEMO)', 'Mad Max; das Autorenfeld verweist auf Thundercats und Rob Hubbard', 384],
    ['UnionDemo_ChildrenSongs.YM', 'Wobbly Sprites', 'Replicants Wobbly Sprites (UNION DEMO)', 'Mad Max; das Autorenfeld nennt Children Songs und M.O.N.', 0],
    ['UnionDemo_Pandora.YM', 'Starballs Screen', 'Starballs Screen (UNION DEMO)', 'Mad Max; als Originalkomponist ist Rob Hubbard eingetragen', 1],
    ['UndionDemo_ThinkTwice.YM', 'Loader', 'Union Demo LOADER', 'Mad Max; das Autorenfeld verweist auf Maniacs of Noise', 1],
    ['UnionDemo_ProBMX.YM', 'Beat Dis Screen', 'Beat Dis Screen (Union Demo)', 'Mad Max; als Originalkomponist ist Fred Gray eingetragen', 384],
    ['UnionDemo_AlloyRun.YM', 'Menu', 'Union Demo MENU', 'Mad Max; das Autorenfeld nennt Alloyrun und M.O.N.', 1],
    ['UnionDemo_Cybernoid.YM', 'SuperScroller Screen', 'SuperScroller Screen (UNION DEMO)', 'Mad Max; das Autorenfeld nennt Cybernoid und M.O.N.', 12]
];
for (const [sourcePath, listTitle, embeddedName, credits, loopFrame] of unionTracks) {
    addDemoTrack(
        'union-demo', sourcePath, `The Union Demo – ${listTitle}`,
        'Ein screenbezogener Musikdump aus <em>The Union Demo</em>. Die Karte unterscheidet die tatsächliche Screenbezeichnung von Dateinamen und nennt die im Container dokumentierten Bearbeitungs- und Originalcredits.',
        `Eingebetteter Name: <em>${embeddedName}</em>; ${credits}. YM5!, erzeugt unter PaCifiST; gespeicherter Loop-Frame: ${loopFrame}.`,
        listTitle
    );
}

addDemoTrack(
    'syntax-terror', 'SyntaxTerror.YM', 'Syntax Terror – Screen nicht bezeichnet',
    'Der Container nennt eindeutig <strong>Jochen Hippel</strong>, nicht Big Alec. Die frühere Komponistenzuordnung wurde deshalb korrigiert; die konkrete Screenverwendung bleibt offen.',
    'Eingebetteter Name: <em>Syntax Terror: ? screen</em>. YM6!, 5.350 Frames, konvertiert von Leonard.',
    'Screen unbekannt'
);
addDemoTrack(
    'syntax-terror', 'SyntaxTerror_tex.YM', 'Syntax Terror – TeX 24hours Screen',
    'Diese Fassung ist im Gegensatz zum unbestimmten Hauptdump konkret einem Screen zugeordnet. Jochen Hippel ist als Autor eingetragen.',
    'Eingebetteter Name: <em>Syntax Terror: TeX 24hours screen</em>. YM6!, 9.248 Frames; Loop-Frame 32; Konvertierung durch Jochen Knaus.',
    'TeX 24hours'
);
addDemoTrack(
    'syntax-terror', 'SyntaxTerror_tlb.YM', 'Syntax Terror – TLB Screen',
    'Der dritte Syntax-Terror-Dump besitzt ebenfalls eine eigene Screenbezeichnung und wird Jochen Hippel zugeschrieben.',
    'Eingebetteter Name: <em>Syntax Terror: TLB screen</em>. YM6!, 11.150 Frames, konvertiert von Leonard.',
    'TLB Screen'
);

addDemoTrack(
    'spherical', 'spherical_intro.YM', 'Spherical – Intro',
    'Der eingebettete Name lautet <em>Spherical: Spherical I (Intro)</em>. Als Autor ist ausdrücklich <strong>unknown</strong> eingetragen; die Karte erfindet deshalb keine Komponistenzuordnung.',
    'YM6!, 10.930 Frames beziehungsweise 218,6 Sekunden. Die Konvertierung wird Jochen Knaus zugeschrieben, was nicht mit der Urheberschaft der Musik gleichzusetzen ist.',
    'Intro'
);

addDemoTrack(
    'synergy', 'synergy/Synergy_Main_Menu.YM', 'Synergy – Main Menu',
    'Neu aufgenommen: die ausdrücklich benannte Main-Menu-Musik. Das Autorenfeld nennt <strong>Scavenger / Synergy</strong> und ergänzt damit eine weitere Demo-Szene-Stimme.',
    'Eingebetteter Name: <em>Synergy MainMenu.</em> YM6!, 9.217 Frames, konvertiert von Leonard.',
    'Main Menu'
);
addDemoTrack(
    'synergy', 'synergy/Synergy_Credits.YM', 'Synergy – Credits',
    'Die Credits-Musik ist separat vom Main Menu verfügbar. Auch dieser neue Dump nennt Scavenger / Synergy als Autor.',
    'Eingebetteter Name: <em>Synergy Credits Screen.</em> YM6!, 5.377 Frames, konvertiert von Leonard.',
    'Credits'
);

addRootTrack(
    'punish-your-machine/PYM_Best_Part_of_Creation.YM', 'Punish Your Machine – Best Part of Creation',
    'ATARI ST · BIG ALEC',
    'Neu als Demo-Highlight: <em>Best Part Of The Creation</em> mit <strong>Big Alec / Delta Force</strong> im Autorenfeld. Der Track ergänzt die bisher von Mad Max dominierte Demo-Auswahl.',
    'YM5!, 9.604 Frames, mit zwei eingebetteten Digidrum-Blöcken. Der Container kennzeichnet die Sampledaten als bereits 4-Bit; Konvertierung durch Leonard.',
    'Punish Your Machine – Best Part of Creation'
);

addDemoTrack(
    'remixes', 'C64_Convertion_Shades_Giana.YM', 'Shades & Giana Sisters – Remix',
    'Dieser lange Dump ist bewusst bei den Demo- und Remix-Beiträgen statt bei den sechs Spielszenen einsortiert. Das Autorenfeld nennt Jochen Hippel und verweist auf Chris Hülsbeck als Originalkomponisten.',
    'Eingebetteter Name: <em>Shades & Giana Sisters Remix</em>. YM6!, 18.200 Frames beziehungsweise 364 Sekunden; Konvertierung durch Leonard.',
    'Shades & Giana Sisters'
);

export const atariPlaylist = trackDefinitions.map(definition => ({
    path: definition.path,
    sourcePath: definition.sourcePath,
    title: definition.title,
    listTitle: definition.listTitle,
    composerInfo: definition.composerInfo,
    generator: function() { return []; },
    loadAsync: async function() {
        return await loadYmFile(`tracks/atari/${definition.sourcePath}`);
    }
}));
