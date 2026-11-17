// === tracks/c64/museum.js ===
// Kuratierte Museumstexte für die C64-Playlist von Chiptunes Fantasy.
// Fokus: SID-Hardwaretricks, Player-Technik, Komponisten-Anekdoten & Demoscene-History.

const HVSC_SOURCE = {
    label: 'HVSC #85',
    url: 'https://www.hvsc.c64.org/downloads'
};

function renderMuseum(title, history, replay, sources) {
    const links = sources
        .map(source => `<a href="${source.url}" target="_blank" rel="noopener noreferrer">${source.label}</a>`)
        .join(' · ');
    return `
        <h3>[ MUSEUM: ${title} ]</h3>
        <p><strong>Historie:</strong> ${history}</p>
        <p><strong>SID &amp; Replay:</strong> ${replay}</p>
        <p class="museum-sources"><strong>Quellen:</strong> ${links}</p>
    `;
}

function museum(title, history, replay, ...sources) {
    return renderMuseum(title, history, replay, [HVSC_SOURCE, ...sources]);
}

function museumCustom(title, history, replay, ...sources) {
    return renderMuseum(title, history, replay, sources);
}

const deepsid = hvscPath => ({
    label: 'DeepSID',
    url: `https://deepsid.chordian.net/?file=${hvscPath}`
});
const csdb = (id, label) => ({ label: `CSDb: ${label}`, url: `https://csdb.dk/release/?id=${id}` });
const csdbSid = (id, label) => ({ label: `CSDb SID: ${label}`, url: `https://csdb.dk/sid/?id=${id}` });
const demozoo = (id, label) => ({ label: `Demozoo: ${label}`, url: `https://demozoo.org/productions/${id}/` });

export const c64MuseumMetadata = {
    // =========================================================================
    // GAMES: 1984–1986 (Die frühen SID-Pioniere)
    // =========================================================================
    "games/lazy-jones.sid": museum(
        'DAVID WHITTAKER — LAZY JONES (1984)',
        `Bevor <strong>David Whittaker</strong> hauptberuflich Spielmusik schrieb, spielte er in der New-Romantic-Band <em>Beu Leisure</em>. Für Terminal Software entwickelte er <strong>Lazy Jones</strong> im Alleingang – inklusive aller 14 enthaltenen Minispiele, die er zuerst komplett in BASIC schrieb und dann Zeile für Zeile in 6502-Maschinensprache übersetzte. Der Soundtrack zitiert fröhlich quer durch die frühen 80er (u. a. Nena, Visage, Blancmange und die Tonfolge aus <em>Unheimliche Begegnung der dritten Art</em>). Legendär wurde Subsong 21 (<em>Star Dust</em>): 1999 samplete das Projekt Zombie Nation die Melodie für den weltweiten Club-Hit <em>Kernkraft 400</em>.`,
        `<strong>PSID v2 · 21 Subsongs (Start 1)</strong>. 1984 gab es noch kaum komfortable C64-Musikeditoren: Whittaker hackte seine Musikdaten direkt über einen Maschinensprache-Monitor bzw. Assembler in den Speicher. Jeder der 21 Subsongs versorgt einen anderen Raum oder ein Minispiel des Hotel-Settings – roher, ungeschliffener 6581-Sound der ersten Stunde.`,
        deepsid('/MUSICIANS/W/Whittaker_David/Lazy_Jones.sid')
    ),
    "games/commando.sid": museum(
        'ROB HUBBARD — COMMANDO (1985)',
        `Der Startschuss für die moderne C64-Musik: <strong>Rob Hubbard</strong>, eigentlich gelernter Studiomusiker, bekam von Elite Systems 1985 einen Arcade-Automaten von <em>Commando</em> ins Büro gestellt – und legte eine einzige legendäre Nachtschicht hin. Statt Tamayo Kawamotos knappe Arcade-Schleife brav nachzuklimpern, komponierte er ein fast siebenminütiges Synth-Epos, das die Arcade-Vorlage in Grund und Boden spielte. Damit bewies Hubbard der Spielebranche, dass der C64 kein besseres Pieps-Spielzeug war, sondern ein eigenständiges elektronisches Instrument.`,
        `<strong>PSID v2 · 19 Subsongs (Start 1)</strong>. Technisch ist <em>Commando</em> ein Lehrstück im <strong>Channel-Multiplexing</strong>: Weil der SID nur drei Stimmen hat, quetscht Hubbard Kick-Drums, treibende Bassline und 1-Frame-Noise-Snares abwechselnd auf einen Kanal, während eine zweite Stimme rasende Dreiklang-Arpeggios abfeuert und die dritte die Lead-Melodie trägt. Ausgelegt auf die schmutzig-warmen Eigenheiten des frühen <strong>MOS 6581</strong>.`,
        deepsid('/MUSICIANS/H/Hubbard_Rob/Commando.sid'),
        { label: 'C64 Audio: Rob Hubbard 1985', url: 'https://c64audio.com/blogs/rob-hubbard-master-of-magic/rob-hubbard-1985-on-the-run' }
    ),
    "games/monty-on-the-run.sid": museum(
        'ROB HUBBARD — MONTY ON THE RUN (1985)',
        `Gremlin Graphics suchte für den Flucht-Platformer rund um Maulwurf Monty Mole einen gehetzten, atemlosen Soundtrack. <strong>Rob Hubbard</strong> nahm sich Charles Williams’ <em>The Devil’s Gallop</em> – die Titelmelodie der alten britischen Detektiv-Radioserie <em>Dick Barton</em> – als Sprungbrett und verwandelte sie in eine knapp sechsminütige Adrenalin-Achterbahn. Noch Jahrzehnte später gehört das Stück zu den meistgecoverten Chiptunes überhaupt, ob als Orchester-Arrangement oder Metal-Cover.`,
        `<strong>PSID v2 · 19 Subsongs (Start 1)</strong>. Der berühmte, dramatisch anschwellende Mittelteil diente Hubbard ganz pragmatisch als Spielwiese: Er hatte für das Projekt gerade eine brandneue <strong>Pitch-Bend-Routine</strong> in seinen 6502-Player programmiert und wollte hören, wie weit man stufenlose Tonhöhen-Slides auf dem <strong>6581</strong> ausreizen kann. Dazu gesellen sich eine Alternativfassung und knackige Event-Jingles.`,
        deepsid('/MUSICIANS/H/Hubbard_Rob/Monty_on_the_Run.sid'),
        { label: 'C64 Audio: Rob Hubbard 1985', url: 'https://c64audio.com/blogs/rob-hubbard-master-of-magic/rob-hubbard-1985-on-the-run' }
    ),
    "games/crazy-comets.sid": museum(
        'ROB HUBBARD — CRAZY COMETS (1985)',
        `Martechs Weltraum-Shooter <strong>Crazy Comets</strong> wurde nicht wegen des Gameplays unsterblich, sondern wegen seines Soundtracks: <strong>Rob Hubbard</strong> lieferte eine knackige Space-Funk-Nummer, die sich so tief ins kollektive Gedächtnis brannte, dass er selbst sie später sogar dem bekannteren Nachfolger <em>Mega Apocalypse</em> vorzog. Ohne Sprachsamples, ohne Effekthascherei – pure Melodie und Rhythmus auf dem nackten Chip.`,
        `<strong>PSID v2 · 17 Subsongs (Start 1)</strong>. Ein Paradebeispiel für Hubbards frühes „Channel-Packing“: Auf den Zählzeiten 1 und 3 sitzen Bassnoten und Kick auf demselben Kanal, auf 2 und 4 schaltet die Routine blitzschnell auf kurzes weißes Rauschen (Noise) als Snare um – so bleibt dem SID trotz Schlagzeug volle Luft für Arpeggios und Melodie (Hauptstück 4:36 min, gefolgt von 16 Jingles/SFX).`,
        deepsid('/MUSICIANS/H/Hubbard_Rob/Crazy_Comets.sid'),
        { label: 'C64 Audio: Rob Hubbard 1985', url: 'https://c64audio.com/blogs/rob-hubbard-master-of-magic/rob-hubbard-1985-on-the-run' }
    ),
    "games/ocean-loader-1.sid": museum(
        'MARTIN GALWAY — OCEAN LOADER 1 (1985)',
        `Wer in den 80ern ein C64-Spiel von Kassette lud, starrte fünf bis zehn Minuten auf flackernde Ladebalken. Ocean-Programmierer <strong>Paul Hughes</strong> erfand deshalb ein System, das während des Ladevorgangs ein Titelbild samt Hintergrundmusik im Speicher hielt – den legendären <strong>Ocean Loader</strong>. Nach einem Prototyp bei <em>Daley Thompson’s Supertest</em> ging Version 1 erstmals mit Konamis <strong>Hyper Sports</strong> in Serie. <strong>Martin Galway</strong> komponierte damit einen der meistgehörten Tracks der C64-Geschichte: selbst wer das Spiel gar nicht mochte, kannte jede Note aus der Warteschleife.`,
        `<strong>PSID v2 · 1 Subsong</strong>. Die frühe Ocean-Loader-Architektur musste extrem speicherschonend sein, damit während des laufenden Band-I/O-Interrupts sowohl der Lader als auch Galways Musikroutine stabil im Hintergrund liefen. Aus dieser Ur-Fassung entwickelte Galway wenig später direkt seinen noch berühmteren Remix für <em>Ocean Loader 2</em>.`,
        deepsid('/MUSICIANS/G/Galway_Martin/Ocean_Loader_1.sid')
    ),
    "games/ocean-loader-2.sid": museum(
        'MARTIN GALWAY — OCEAN LOADER 2 (1985)',
        `Eigentlich wollte <strong>Martin Galway</strong> für jedes Ocean-Spiel eine eigene Lademusik schreiben – doch bei der schieren Release-Flut in Manchester ging ihm schlicht die Zeit aus. Also baute er Ende 1985 aus seiner <em>Ocean-Loader-1</em>-Melodie (<em>Hyper Sports</em>) eine tiefere, verträumtere Überarbeitung. Bis Mitte 1987 begleitete <strong>Ocean Loader 2</strong> unzählige Ocean- und Imagine-Kassetten und löste das Gefühl aus, dass gleich etwas Großes auf dem Röhrenfernseher startet.`,
        `<strong>PSID v2 · 1 Subsong · Länge 4:13</strong>. Galways frühe „1st-Generation“-Routine nutzt subtile Pulsweitenmodulation und fein abgestimmte Hüllkurven, um aus drei Stimmen maximale Wärme zu holen. Wie viele seiner 1985er/86er Stücke entfaltet der Track seine volle Gänsehaut auf einem originalen <strong>MOS 6581</strong>.`,
        deepsid('/MUSICIANS/G/Galway_Martin/Ocean_Loader_2.sid')
    ),
    "games/sanxion.sid": museum(
        'ROB HUBBARD — SANXION (1986)',
        `Als der junge Finne Stavros Fasoulas 1986 das erste Spiel des neuen Kultlabels <strong>Thalamus</strong> ablieferte, sorgte nicht nur das zweigeteilte Radar-Scrolling für offene Münder: Beim Laden erklang John Twiddys neues Schnellladesystem <em>Cyberload</em> (mit der berüchtigten versteckten Botschaft <em>„hackers f*** off and die“</em> im Speicher) – untermalt von <strong>Thalamusik</strong>, laut zahllosen Fans <strong>Rob Hubbards</strong> beste Lademusik aller Zeiten. Inspiriert von Jean-Michel Jarres <em>Zoolook</em> schraubte Hubbard hier fünf Minuten reinen Synth-Wahnsinn zusammen; im Spiel selbst adaptiert Subsong 2 Prokofjews <em>Tanz der Ritter</em>.`,
        `<strong>PSID v2 · 2 Subsongs (Start 1)</strong>. Während <em>Thalamusik</em> (5:34) mit pulsierenden Sequenzen hypnotisiert, dreht Subsong 2 (3:06) technisch voll auf: Hubbard kombiniert hier <strong>Hard Sync</strong>, Filter-Sweeps und Pulsweitenmodulation (PWM), sodass der <strong>6581</strong> fast wie ein ausgewachsener Analog-Synthesizer klingt.`,
        deepsid('/MUSICIANS/H/Hubbard_Rob/Sanxion.sid')
    ),
    "games/lightforce.sid": museum(
        'ROB HUBBARD — LIGHTFORCE (1986)',
        `Faster Than Light schickte 1986 den Vertikal-Shooter <strong>Lightforce</strong> ins Rennen, und natürlich saß <strong>Rob Hubbard</strong> am SID. Spannender Kontrast zur Fan-Liebe: Während <em>Lightforce</em> bis heute zu den beliebtesten Remix-Vorlagen der Szene gehört, ging Hubbard später selbstkritisch mit dem Stück ins Gericht – den treibenden Rhythmus fand er stark, den Rest eher mittelmäßig. Für C64-Fans bleibt die über siebenminütige Weltraum-Odyssee dennoch ein Pflichtkapitel.`,
        `<strong>PSID v2 · 1 Subsong · Länge 7:13,481</strong>. Ein gewaltiges Monolith-File: Komplette 6510-Replay-Routine und Sequenzdaten stecken zusammen in einem über sieben Minuten laufenden Arrangement, das stark von straffen Bass-Grooves und scharfen Sync-/Filterwechseln lebt.`,
        deepsid('/MUSICIANS/H/Hubbard_Rob/Lightforce.sid')
    ),
    "games/comic-bakery.sid": museum(
        'MARTIN GALWAY — COMIC BAKERY (1986)',
        `Was als Auftragsversion von Level 42s Funk-Hit <em>Hot Water</em> begann, mutierte unter den Fingern von <strong>Martin Galway</strong> zu einer der fröhlichsten Eigenkompositionen der 8-Bit-Ära. Imagine Software veröffentlichte das hektische Bäckerei-Spiel <strong>Comic Bakery</strong> 1986, und Galways schwebendes Hauptthema wurde prompt in zahllosen Demos, Cracktros und Musicdisks der späten 80er recycelt. Subsong 6 schmuggelt zudem das Jazz-Standard-Stück <em>Tea for Two</em> ins Backhaus.`,
        `<strong>PSID v2 · 14 Subsongs (Start 1)</strong>. Galway war berühmt dafür, während eines laufenden Tons dynamisch in die SID-Register einzugreifen, statt bloß statische Instrumente abzuspielen. Im 3:09-minütigen Hauptthema sorgt genau das für den charakteristischen, leicht schwebenden Echo-Glanz – komplett aus drei Stimmen ohne digitale Samples.`,
        deepsid('/MUSICIANS/G/Galway_Martin/Comic_Bakery.sid')
    ),
    "games/miami-vice.sid": museum(
        'MARTIN GALWAY — MIAMI VICE (1986)',
        `Ocean kaufte 1986 teure TV-Lizenzen – und lieferte bei <strong>Miami Vice</strong> ein berüchtigt katastrophales Spiel mit explodierenden Autos am laufenden Band ab. Gerettet wurde die Ehre allein durch <strong>Martin Galway</strong>: Neben Jan Hammers <em>Miami Vice Theme</em> (Subsong 2) wollte er dessen Instrumental <em>Evan</em> umsetzen. Doch während der Arbeit verlor ein Filter-Sweep die Synchronisation – Galway verliebte sich in den psychedelischen Klang und dehnte das Stück zu einem epischen elfeinhalbminütigen Ambient-Trip aus.`,
        `<strong>PSID v2 · 2 Subsongs (Start 1)</strong>. Ein absolutes Paradebeispiel für den <strong>analogen Filter des MOS 6581</strong>: Der berühmte, 11:29,503 Minuten lange erste Track lebt von langsamen, organischen Filter-Verläufen, die auf dem späteren, lineareren 8580-Chip völlig anders (oft deutlich dünner) klingen.`,
        deepsid('/MUSICIANS/G/Galway_Martin/Miami_Vice.sid')
    ),
    "games/rambo-first-blood-part-ii.sid": museum(
        'MARTIN GALWAY — RAMBO: FIRST BLOOD PART II (1986)',
        `<strong>Rambo</strong> war eines der ganz wenigen Ocean-Spiele der mittleren 80er, die statt des Standard-Loaders eine eigene Lademusik bekamen – und was für eine! <strong>Martin Galway</strong> arrangierte Jerry Goldsmiths Filmthema für den SID, baute im Intro selbst programmierten <strong>Morsecode</strong> ein (der im Klartext die Entwicklernamen funkt!) und versteckte in Subsong 22 noch einen kurzen Gruß an Richard Wagners <em>Ritt der Walküren</em>. Martin Galway erzählte später, dass sich Oceans Verkäufer persönlich bei ihm bedankten, weil seine Musik so manches mittelmäßige Lizenzspiel überhaupt erst verkäuflich machte.`,
        `<strong>PSID v2 · 23/24 Subsongs (Start 1)</strong>. Der lange Titeltrack nutzt tiefe, dröhnende Sägezahn-Bässe und dramatische Filterkurven auf dem 6581, während Subsong 2 eine korrigierte Fassung bereithält und die übrigen Subsongs das Spiel mit Morse-Signalen und Action-Jingles versorgen.`,
        deepsid('/MUSICIANS/G/Galway_Martin/Rambo_First_Blood_Part_II.sid')
    ),
    "games/parallax.sid": museum(
        'MARTIN GALWAY — PARALLAX (1986)',
        `Sensible Softwares Sci-Fi-Epos <strong>Parallax</strong> (später berühmt für <em>Wizball</em> und <em>Sensible Soccer</em>) sollte sich riesig und isoliert anfühlen – also schrieb <strong>Martin Galway</strong> ein passendes Monsterstück. Zwei Wochen feilte er allein am Hauptthema; die ersten zwei Drittel bestehen nur aus dem sich langsam aufbauenden Intro! Während der Arbeit lief bei Galway täglich Jean-Michel Jarres Album <em>Rendez-Vous</em> im Hintergrund – erst nach Release merkte er, wie tief sich Jarre in die Melodielinien eingeschlichen hatte. Berüchtigt ist auch das völlig schräge, experimentelle Ende der Highscore-Musik.`,
        `<strong>PSID v2 · 5 Subsongs (Start 1)</strong>. Subsong 1 erstreckt sich über monumentale <strong>11:23,2 Minuten</strong> und nutzt Galways 1st-Gen-Player für schillernde Pulsweiten-Flächen und verhallte Lead-Linien, wie man sie 1986 auf keinem Konkurrenz-Homecomputer gehört hatte.`,
        deepsid('/MUSICIANS/G/Galway_Martin/Parallax.sid')
    ),
    "games/way-of-the-tiger.sid": museum(
        'BEN DAGLISH — WAY OF THE TIGER (1986)',
        `Lange bevor <em>The Last Ninja</em> alles überstrahlte, vertonte <strong>Ben Daglish</strong> für Gremlin Graphics dieses fernöstliche Beat-’em-up nach den berühmten Spielbüchern von Mark Smith und Jamie Thomson. Statt generischem „Asien-Gedudel“ griff Daglish tief in seine Plattensammlung und arrangierte den Klassiker <em>Firecracker</em> – ursprünglich 1959 von Exotica-Pionier Martin Denny komponiert, aber vor allem durch die legendäre Synth-Pop-Fassung des <strong>Yellow Magic Orchestra (YMO)</strong> (1978) weltberühmt.`,
        `<strong>PSID v2 · 1 Subsong · Länge 2:49</strong>. Daglish zeigt hier früh seine Liebe für präzise perkussive Noise-Tricks und knackige Bass-Oktaven, die den YMO-Electro-Groove erstaunlich druckvoll in die drei Kanäle des 6581 pressen.`
    ),
    "games/ghosts-n-goblins.sid": museum(
        'MARK COOKSEY — GHOSTS’N GOBLINS (1986)',
        `Capcoms Münzschlucker-Automat bekam 1986 von Elite Systems eine knallharte C64-Portierung – und <strong>Mark Cooksey</strong> tat etwas Mutiges: Während der Highscore (Subsong 1, 2:27) noch Ayako Moris knackige Arcade-Vorlage zitiert, warf er für das eigentliche Spiel das Original komplett über Bord und komponierte stattdessen eine schaurig-hypnotische Eigenkreation. Kenner hören darin Anklänge an Chopins düsteres <em>Prélude op. 28 Nr. 20</em> sowie Klaus Wunderlichs Orgel-Fassung von <em>Dangerous Dreams</em>.`,
        `<strong>PSID v2 · 2 Subsongs (Start 2)</strong>. Der Start liegt bewusst auf Subsong 2 (3:50): Cooksey setzt auf kühle, hallige Arpeggios und langsame Akkordwechsel, die die Friedhofsatmosphäre des Spiels auf dem 6581 weit intensiver einfangen als die heitere Marschmelodie des Spielautomaten.`,
        deepsid('/MUSICIANS/C/Cooksey_Mark/Ghosts_n_Goblins.sid')
    ),
    "games/glider-rider.sid": museum(
        'DAVID WHITTAKER — GLIDER RIDER (1986)',
        `Bei Quicksilvas 3D-Gleiter-Actioner <strong>Glider Rider</strong> zeigte <strong>David Whittaker</strong> (inzwischen als reiner Hauskomponist bei Binary Design statt als Einzelkämpfer wie bei <em>Lazy Jones</em>), wie weit sich sein Stil binnen zwei Jahren entwickelt hatte: Treibende, fast tranceartige Synth-Linien statt simplen Arcade-Gepieps. Für treue Fans baute er im ersten Subsong ab 1:13 und 1:26 ein schönes Easter Egg ein – zwei direkte Selbstzitate aus seinen eigenen <em>Lazy-Jones</em>-Stücken.`,
        `<strong>PSID v2 · 3 Subsongs (Start 1)</strong>. Alle drei offiziellen Tracks laufen jeweils 1:40 Minuten. Whittakers Player setzt stark auf knackige, fast Hubbard-ähnliche Hüllkurven-Instrumente und schnelle Arpeggio-Teppiche, die dem 6581 eine überraschend dichte Atmosphäre entlocken.`,
        deepsid('/MUSICIANS/W/Whittaker_David/Glider_Rider.sid')
    ),

    // =========================================================================
    // GAMES: 1987–1989 (Das goldene Zeitalter & Digi-Samples)
    // =========================================================================
    "games/delta.sid": museum(
        'ROB HUBBARD — DELTA (1987)',
        `Nach <em>Sanxion</em> legten Programmierer Stavros Fasoulas und Thalamus 1987 mit dem knüppelharten Horizontal-Shooter <strong>Delta</strong> nach – und lieferten gleich eine echte C64-Weltneuheit mit: <strong>Mix-E-Load</strong>! Während das Spiel lud, konnte man mit den Tasten live Drums, Bass und Melodiespuren von <strong>Rob Hubbards</strong> Musik ein- und ausblenden. Im Titelthema verbeugte sich Hubbard tief vor Philip Glass’ hypnotischem Minimalismus aus <em>Koyaanisqatsi</em> (<em>Pruit Igoe</em>), während der ewig lange Ingame-Trip auf Wunsch von Thalamus’ Gary Liddon nach Pink Floyds <em>On the Run</em> klingen sollte.`,
        `<strong>PSID v2 · Original-Thalamus-Rip</strong>. Ein Meilenstein des <strong>6581-Sounddesigns</strong>: Vom minimalistischen Einzelkanal-Einstieg des Titelthemas über die schneidenden Filter-Sequenzen bis hin zu Subsong 12 (der später zahllose Demoscene-Musiker wie Tomas Danko zu Cover-Versionen inspirierte) und versteckten <em>Thalamusik</em>-Zitaten im Code steckt hier alles drin, was Hubbard legendär machte.`,
        deepsid('/MUSICIANS/H/Hubbard_Rob/Delta.sid')
    ),
    "games/wizball.sid": museum(
        'MARTIN GALWAY — WIZBALL (1987)',
        `Sensible Softwares surreales Meisterwerk <strong>Wizball</strong> (96 % in der <em>ZZAP!64</em>!) war spielerisch wie musikalisch ein Ausnahmezustand. <strong>Martin Galway</strong> verließ sich nicht auf schnelle Beats, sondern auf schwebendes Klangdesign: Das Bonusstück steuerte Sensible-Gründer <strong>John Hare</strong> am Bass bei, das legendäre wimmernde Game-over-Riff spielte Co-Entwickler <strong>Chris Yates</strong> auf der Gitarre vor. Jahrzehnte später, im April 2026, stellte Galway sogar seinen originalen 6502-Assembler-Quellcode zu <em>Wizball</em> für alle Fans auf GitHub.`,
        `<strong>PSID v2 · 9 Subsongs (Start 4)</strong>. Der Blick in Galways Original-Quellcode enthüllte ein technisches Hammer-Detail: Seine „1st-Generation“-Routine lief bei <strong>Wizball</strong> nicht mit 50 Hz, sondern mit <strong>200-Hz-Interrupts</strong> (4× Multispeed auf PAL & NTSC)! Dadurch konnte er Stimmen minimal versetzt doppeln und so einen echten Studio-Delay-/Echo-Effekt auf dem SID simulieren.`,
        deepsid('/MUSICIANS/G/Galway_Martin/Wizball.sid')
    ),
    "games/arkanoid.sid": museum(
        'MARTIN GALWAY — ARKANOID (1987)',
        `Musikgeschichte auf 8 Bit: <strong>Arkanoid</strong> ist das erste veröffentlichte C64-Spiel, das <strong>digitalisierte Samples mitten in einem Musikstück</strong> einsetzt. <strong>Martin Galway</strong> gab freimütig zu, die Technik nicht selbst erfunden zu haben: Er disassemblierte das Drum-Tool <em>Digidrums</em>, um zu kapieren, wie man über das Master-Volume-Register einen vierten Kanal erzwingt. Da er damals aber keinen eigenen Sampler besaß, berechnete sein Code die Trommeln in Echtzeit – Galways eigene Beschreibung dafür: <em>„eine Collage aus Fürzen und Rülpsern“</em>. Das Titelthema rettete er übrigens aus seiner ZX-Spectrum-Musik zu <em>Cobra</em>; erst bei Game Over konnte er später echte aufgenommene Samples nachschieben.`,
        `<strong>RSID v2 · 20 Subsongs (Start 1)</strong>. Der Container-Typ <strong>RSID</strong> ist hier Pflicht: Damit das berühmte <strong><code>$D418</code>-Digi-Verfahren</strong> (das einen Hardware-DC-Offset bzw. knackenden Pegelsprung des 6581-Verstärkers als 4-Bit-PCM-Kanal missbraucht) sauber läuft, verlangt der Code exaktes C64-CPU-/CIA-Timing statt einer simplen PSID-Interrupt-Schleife.`,
        deepsid('/MUSICIANS/G/Galway_Martin/Arkanoid.sid')
    ),
    "games/ocean-loader-3.sid": museum(
        'PETER CLARKE — OCEAN LOADER 3 (1987)',
        `1987 erbte <strong>Peter Clarke</strong> (<em>Bubble Bobble</em>) die wohl undankbarste Aufgabe bei Ocean: einen Nachfolger für Martin Galways übermächtigen <em>Ocean Loader 2</em> zu schreiben. Clarke löste das Problem mit einem genialen Twist – intern nannte er das Stück scherzhaft <em>„Ocean Dries Up“</em>. Die ersten Takte täuschen den Hörer mit Galways vertrautem Eröffnungsmotiv, bevor der Track plötzlich ausbricht und in ein völlig eigenes, treibendes High-Energy-Thema explodiert. Clarke tüftelte das Stück heimlich zu Hause aus und legte Ocean erst das fertige Ergebnis vor.`,
        `<strong>PSID v2 · 1 Subsong · Länge 2:47</strong>. Technisch ist <em>Ocean Loader 3</em> berüchtigt für seinen massiven Einsatz des <strong>6581-Resonanzfilters</strong>: Auf echter 6581-Hardware beißt und sägt die Lead-Stimme geradezu, während ein 8580 den Klang deutlich zahmer macht. Bis heute einer der meistgeliebten Loader der C64-Historie.`,
        deepsid('/MUSICIANS/C/Clarke_Peter/Ocean_Loader_3.sid')
    ),
    "games/mega-apocalypse.sid": museum(
        'ROB HUBBARD & SIMON NICOL — MEGA APOCALYPSE (1987)',
        `Die Fortsetzung von <em>Crazy Comets</em> schob die Messlatte noch einmal höher: Martech-Coder <strong>Simon Nicol</strong> programmierte hochauflösende digitale Sprachsamples (<em>„Fire!“</em>, <em>„Prepare to die!“</em>), während <strong>Rob Hubbard</strong> parallel alle drei regulären SID-Stimmen für ein über siebenminütiges Synth-Feuerwerk ausfuhr – im Intro sogar mit direktem Rückgriff auf sein <em>Crazy-Comets</em>-Thema. Während des aktiven Spielgeschehens gleichzeitig Sprachausgabe und volle Musik zu fahren, galt 1987 als echtes kleines Programmierwunder.`,
        `<strong>RSID v2 · 11 Subsongs (Start 1)</strong>. Genau wie <em>Arkanoid</em> steckt der Rip im echten C64-Umfeld eines <strong>RSID-Containers</strong>, weil die <code>$D418</code>-Sample-Wiedergabe exaktes Hardware-Timing braucht. Auf das 7:21 Minuten lange Hauptstück folgen zehn kurze Ingame-Signale und Effekte.`,
        deepsid('/MUSICIANS/H/Hubbard_Rob/Mega_Apocalypse.sid')
    ),
    "games/last-ninja.sid": museum(
        'BEN DAGLISH & ANTHONY LEES — THE LAST NINJA (1987)',
        `Hinter einem der größten C64-Bestseller steckt eine der skurrilsten Entdeckungsgeschichten der 80er: 1986 veranstaltete das Kultmagazin <em>ZZAP!64</em> einen <strong>Aprilscherz-Wettbewerb</strong> für ein gar nicht existierendes Spiel namens <em>Mindsmear</em>. Ein junger Klarinettist und Fagottist namens <strong>Anthony Lees</strong> gewann mit einer selbst gecodeten SID-Routine – und erregte damit sofort die Aufmerksamkeit von System-3-Chef Mark Cale. Cale teilte die zwölf Stücke für <strong>The Last Ninja</strong> auf: Der etablierte Profi <strong>Ben Daglish</strong> schrieb die eine Hälfte (darunter <em>The Wastelands</em>), Newcomer Lees die andere (darunter die von <em>Apocalypse Now</em> inspirierten Dschungelklänge des <em>Wilderness</em>-Loaders sowie die schaurigen <em>Dungeons</em>).`,
        `<strong>PSID v2 · 11 Subsongs (Start 3)</strong>. Der Start liegt auf Subsong 3 (<em>The Wastelands</em> Loader), einem der ewigen Nummer-1-Kandidaten sämtlicher HVSC-Umfragen. Wichtig beim Hören: Jede Spielwelt besitzt ein eigenes atmosphärisches Lade- und ein separates Ingame-Stück – komponiert für den charaktervollen Filter des <strong>6581</strong>.`,
        deepsid('/MUSICIANS/D/Daglish_Ben/Last_Ninja.sid')
    ),
    "games/great-giana-sisters.sid": museum(
        'CHRIS HÜLSBECK — THE GREAT GIANA SISTERS (1987)',
        `Programmiert von Armin Gessert und gepixelt von Manfred Trenz, wurde Rainbow Arts’ Jump-’n’-Run 1987 weltberühmt – auch weil Level 1 so dreist an <em>Super Mario Bros.</em> erinnerte, dass Nintendo das Spiel kurz nach Veröffentlichung aus den Regalen klagte. Was blieb, war der unsterbliche Soundtrack eines 19-jährigen Deutschen: <strong>Chris Hülsbeck</strong> schrieb mit dem Titelthema eine rockig-melancholische Hommage an Madonnas <em>True Blue</em>, während die leicht Reggae-angehauchte Ingame-Musik sofort im Ohr kleben bleibt.`,
        `<strong>RSID v2 · 23 Subsongs (Start 1)</strong>. Hülsbeck nutzte als Unterbau seinen selbst entwickelten <strong>Soundmonitor</strong> (mit dem er 1986 das „Listing des Monats“ im deutschen <em>64’er</em>-Magazin gewonnen hatte), erweitert um eigene Raster-/Routine-Tricks und knackige Bass-Drums. Der RSID-Header stellt sicher, dass alle 23 Subsongs vom Titel bis zu den Bonus-Jingles originalgetreu laufen.`,
        deepsid('/MUSICIANS/H/Huelsbeck_Chris/Great_Giana_Sisters.sid')
    ),
    "games/to-be-on-top.sid": museum(
        'CHRIS HÜLSBECK — TO BE ON TOP (1987)',
        `Ein echtes Passion-Project: <strong>Chris Hülsbeck</strong> war bei <strong>To Be on Top</strong> nicht nur Komponist, sondern gleich Hauptprogrammierer und Gamedesigner eines kompletten Musik-Baukasten-Adventures! Man sammelt auf der Straße musikalische Ideen (Bass, Begleitung, Melodie) ein, weicht Ghettoblaster-Dieben aus und mixt am Synthesizer seinen eigenen Chart-Hit zusammen – inklusive des berühmten digitalen Sprachsamples <em>„Nineteen!“</em> (gesprochen von Hülsbeck selbst, angelehnt an Paul Hardcastles 80er-Hit).`,
        `<strong>RSID v2 · 19 Subsongs (Start 1)</strong>. Technisch ist der SID ein kurioses Archivstück: Hülsbecks <strong>Soundmonitor</strong> trifft hier auf eine eigene Sample-Routine, und <strong>Subsong 12</strong> bündelt die modularen musikalischen Schnipsel, aus denen sich der Spieler im Game seinen eigenen Song live zusammenklicken kann.`,
        deepsid('/MUSICIANS/H/Huelsbeck_Chris/To_be_on_Top.sid')
    ),
    "games/agent-x-ii.sid": museum(
        'TIM FOLLIN — AGENT X II (1987)',
        `Mastertronics Budget-Titel für 1,99 Pfund – und plötzlich klingt aus den Fernsehlautsprechern eine Klangwand, die Vollpreisspiele in den Schatten stellt: <strong>Tim Follin</strong> liefert mit gerade einmal 16 Jahren eines seiner frühesten C64-Meisterwerke ab. Mitten in seinen halsbrecherischen Prog-Rock- und Synth-Läufen schmuggelt er mit typisch britischem Humor das <em>Peanuts</em>-Thema (Subsongs 2 & 6) sowie in Subsong 3 den Werbejingle des Teppichreinigers <em>Shake ’n’ Vac</em>.`,
        `<strong>PSID v2 · 6 Subsongs (Start 2)</strong>. Follin besaß damals keinen C64-Tracker, sondern tippte seine Musik am Computer <em>Tatung Einstein</em> als rohe Zahlenpaare (Tonhöhe und Frame-Länge) direkt in den Assembler von Programmierer Stephen Ruddy. Bereits hier hört man seinen Markenzeichen-Trick: extrem schnelle Arpeggios und messerscharfe Pulsweiten-Wechsel für mehrstimmig klingende Gitarren-Riffs.`
    ),
    "games/ocean-loader-4.sid": museum(
        'JONATHAN DUNN — OCEAN LOADER 4 (1988)',
        `Als Martin Galway Ocean Software verließ, schickte ein junger Musiker namens <strong>Jonathan Dunn</strong> – der gerade noch als Ferienjobber in einem <em>Argos</em>-Warenlager Kisten schleppte – sein Demo-Tape an Ocean und bekam sofort den Job. Für <strong>Ocean Loader 4</strong> (im Einsatz auf zahlreichen Ocean- und Imagine-Hits von 1988/89) verabschiedete er sich vom elegischen Synth-Pop seiner Vorgänger und brachte klirrende, kristalline Melodien im neuen Ocean-Sound auf das Kassettenband.`,
        `<strong>PSID v2 · 1 Subsong · Länge 3:12</strong>. Während Dunn auf seinen allerersten Spielen noch Galways Treiber nutzte, liefen seine späteren Ocean-Werke über die hausinterne Musikroutine von Loader-Erfinder <strong>Paul Hughes</strong>, die Dunn selbst laufend erweiterte – so intensiv, dass Hughes später staunte, welche Klänge Dunn aus seinem Code herauskitzelte. Charakteristisch sind hier u. a. kombinierte Wellenformen für glockige Leads.`,
        deepsid('/MUSICIANS/D/Dunn_Jonathan/Ocean_Loader_4.sid')
    ),
    "games/platoon.sid": museum(
        'JONATHAN DUNN — PLATOON (1988)',
        `Mit Oceans Filmumsetzung <strong>Platoon</strong> lieferte <strong>Jonathan Dunn</strong> seinen wohl gefeiertsten C64-Score ab – atmosphärisch, düster und weit weg von fröhlichem Arcade-Gedudel. In einem späteren Rückblick verriet er, dass er die Stücke seiner Mutter im Restaurant an freien Abenden auf dem Klavier vorarbeitete, bevor er sie in Assembler goss. Subsong 2 trägt den Titel <em>Sigh of the Eye</em> und ist ein Remix einer früheren eigenen Komposition.`,
        `<strong>PSID v2 · 9 Subsongs (Start 1)</strong>. Alle neun Subsongs sind voll ausarrangierte Stücke zwischen einer und über vier Minuten – ein kompletter Soundtrack für Dschungel-Patrouille, Bunkerkampf und Finale, gespielt über Dunns präzise weiterentwickelte Ocean-Routine.`,
        deepsid('/MUSICIANS/D/Dunn_Jonathan/Platoon.sid')
    ),
    "games/bionic-commando.sid": museum(
        'TIM FOLLIN — BIONIC COMMANDO (1988)',
        `Als Software Creations für Go!/Capcom die europäische C64-Fassung von <strong>Bionic Commando</strong> baute (nicht zu verwechseln mit der lahmen US-C64-Fassung mit „Fahrstuhlmusik“!), warfen <strong>Tim Follin</strong> und Programmierer Stephen Ruddy gleich jede falsche Bescheidenheit über Bord: Follin begann mit einer Umsetzung von Harumi Fujitas Arcade-Melodie, ließ die Stücke dann aber immer weiter in epische, treibende Progressive-Synth-Kompositionen ausufern – inklusive eines kurzen <em>Star-Wars</em>-Zitats (<em>Binary Sunset</em>) in Subsong 6.`,
        `<strong>PSID v2 · 10 Subsongs (Start 1)</strong>. Besonders die eigenständigen Stücke 1 und 10 zeigen Follins unnachahmliche Arbeit mit Stephen Ruddys 6502-Driver: Knackig schneidende Bässe, rasende 50-Hz-Drum-Simulationen und glockenklare Harmonien, die weit mehr als drei Stimmen vorgaukeln.`,
        deepsid('/MUSICIANS/F/Follin_Tim/Bionic_Commando.sid')
    ),
    "games/last-ninja-2.sid": museum(
        'MATT GRAY — LAST NINJA 2 (1988)',
        `Ninja Armakuni per Zeitsprung im modernen New York – und <strong>Matt Gray</strong> (der Anthony Lees’ verworfene Entwürfe für den Nachfolger ersetzte) lieferte einen Soundtrack ab, der bis heute zu den härtesten und ikonischsten Rock-/Electro-Alben auf 8 Bit zählt. Gray begann mit dem <em>Central Park</em>-Thema, um den Grundton zu setzen, und packte in die Großstadt-Level geschickt Anleihen bei <em>Bomb the Bass</em>, <em>Tangerine Dream</em> und Rob Hubbard. Später startete Gray eine erfolgreiche Karriere als UK-Dance-Produzent (u. a. Remixe für die <em>Pet Shop Boys</em>) und kehrte mit seinem Album <em>Reformation</em> triumphal zu <em>Last Ninja 2</em> zurück.`,
        `<strong>PSID v2 · 13 Subsongs (Start 1)</strong>. Technisch markiert <em>Last Ninja 2</em> den Einstand von <strong>Matt Grays brandneuem eigenem SID-Player</strong>. Die 13 Subsongs trennen exakt die treibenden Lade-Tracks von den düsteren Ingame-Themes für <em>Central Park</em>, <em>The Street</em>, <em>The Sewers</em>, <em>The Basement</em>, <em>The Office</em> und <em>The Mansion</em>.`,
        deepsid('/MUSICIANS/G/Gray_Matt/Last_Ninja_2.sid')
    ),
    "games/cybernoid-ii.sid": museum(
        'JEROEN TEL — CYBERNOID II (1988)',
        `Der 16-jährige Niederländer <strong>Jeroen Tel</strong> hatte 1987 zusammen mit Charles Deenen auf den legendären monatlichen Computer-Treffen in Venlo die Audio-Schmiede <strong>Maniacs of Noise (MoN)</strong> gegründet. Mit <strong>Cybernoid II</strong> für Hewson Consultants zementierte Tel ein Jahr später seinen Legendenstatus: Die Titelmusik gilt bei zahllosen Szenegängern als eine der emotionalsten, melancholisch-elektronischsten Kompositionen, die jemals aus einem C64 gekitzelt wurden.`,
        `<strong>PSID v2 · 2 Subsongs (Start 1)</strong>. Angetrieben vom frühen <strong>Maniacs-of-Noise-Player</strong> (entwickelt von Deenen und Tel), kombiniert das 5:46 Minuten lange Titelstück wuchtige Bässe, weinende Lead-Glides und blitzschnelle Arpeggio-Fills, während Subsong 2 ein kurzes 8-Sekunden-Game-over liefert. Puristischer <strong>6581</strong>-Sound ohne Digi-Tricks.`,
        deepsid('/MUSICIANS/T/Tel_Jeroen/Cybernoid_II.sid')
    ),
    "games/hawkeye.sid": museum(
        'JEROEN TEL — HAWKEYE (1988)',
        `Thalamus holte für das Action-Spektakel <strong>Hawkeye</strong> wieder <strong>Jeroen Tel</strong> ins Boot – natürlich inklusive der Rückkehr von Thalamus’ berühmtem <em>Mix-E-Load</em>-Ladesystem. Doch das heimliche Highlight des Soundtracks ist kein Sound-Overkill, sondern das krasse Gegenteil: Weil während der Ballerei auf dem Bildschirm noch zwei Stimmen für knallige Soundeffekte frei bleiben mussten, komponierte Tel fünf Ingame-Tracks für eine <strong>einzige SID-Stimme</strong>!`,
        `<strong>PSID v2 · 12 Subsongs (Start 1)</strong>. Während das 6:25-minütige Titelstück im <strong>Future-Composer-v3.x</strong>-Player alle Register zieht, vollbringen die <strong>Subsongs 7–11</strong> echte Chiptune-Akrobatik: Bass, Kick, Snare und Melodie wechseln sich innerhalb von Millisekunden auf einem einzigen Kanal so geschickt ab, dass das Ohr einen kompletten Beat hört.`,
        deepsid('/MUSICIANS/T/Tel_Jeroen/Hawkeye.sid')
    ),
    "games/katakis.sid": museum(
        'CHRIS HÜLSBECK — KATAKIS (1988)',
        `Manfred Trenz und Andreas Escher erschufen mit <strong>Katakis</strong> Rainbow Arts’ Antwort auf <em>R-Type</em> – so verblüffend nah am Automaten, dass Rechteinhaber Activision die Entwickler später sogar direkt für die offizielle <em>R-Type</em>-Portierung anheuerte. <strong>Chris Hülsbeck</strong> steuerte einen wuchtigen, von Spacesynth-Größen wie <em>Laserdance</em> und Filmkomponist Alan Silvestri inspirierten Action-Score bei. Die ersten beiden Stücke feierten 1999 in <em>Crush</em> noch einmal ein offizielles Comeback.`,
        `<strong>PSID v2 · 34 Subsongs (Start 1)</strong>. Vom 5:33 Minuten langen Titelthema über treibende Level-Loops bis hin zu kurzen Boss- und Event-Signalen deckt die 34-Subsong-Architektur das komplette Audio-Gerüst des Shooters ab.`,
        deepsid('/MUSICIANS/H/Huelsbeck_Chris/Katakis.sid')
    ),
    "games/armalyte.sid": museum(
        'MARTIN WALKER — ARMALYTE (1988)',
        `<strong>Martin Walker</strong> – gelernter Radar- und Hi-Fi-Ingenieur, der schon in der Schule eigene E-Gitarren und Effektgeräte baute – war bereits als Programmierer und Musiker hinter Thalamus’ Geheimtipp <em>Hunter’s Moon</em> bekannt. Als Cyberdyne Systems 1988 mit <strong>Armalyte</strong> den geistigen <em>Delta</em>-Nachfolger bauten, beauftragten sie Walker mit Musik und SFX. Walker nutzte das Projekt, um seinen eigenen <strong>C64-Player und Editor</strong> von Grund auf zu perfektionieren – in Interviews nannte er <em>Armalyte</em> stets eines seiner liebsten Werke.`,
        `<strong>PSID v2 · 4 Subsongs (Start 1)</strong>. Walker verfolgte einen betont cineastischen Ansatz: komplexe, sich organisch entwickelnde Akkordfolgen, extrem tiefe Bass-Fundamente und eigenwillige Perkussion aus seiner maßgeschneiderten Sound-Engine.`,
        deepsid('/MUSICIANS/W/Walker_Martin/Armalyte.sid'),
        { label: 'Commodore Format: Martin Walker', url: 'https://commodoreformatarchive.com/the-martin-walker-interview/' }
    ),
    "games/turbo-outrun.sid": museum(
        'JEROEN TEL — TURBO OUTRUN (1989)',
        `Wie kriegt man Segas Arcade-Klassiker auf den C64? Indem man <strong>Jeroen Tel</strong> an einem Freitagabend inspiriert nach Hause schickt! Tel berichtete später, er habe viele der <strong>Turbo-OutRun</strong>-Stücke bis zu dreimal komplett neu geschrieben, bis am nächsten Morgen alles saß – darunter mitreißende Adaptionen von Hiroshi Kawaguchis <em>Magical Sound Shower</em> und Yasuhiro Takagis <em>OutRun</em>-Motiven. Als Kickstart brüllt im Intro sogar Tels eigene digitalisierte Stimme aus dem Rechner.`,
        `<strong>RSID v2 · 12 Subsongs (Start 1)</strong>. Der Container läuft zwingend als <strong>RSID</strong>, damit die gesampelte Intro-Stimme vor dem nahtlosen Übergang in die krachenden Arcade-Arrangements (Titel, Level 1–4, Tune-up, Finale) exakt im Takt sitzt.`,
        deepsid('/MUSICIANS/T/Tel_Jeroen/Turbo_Outrun.sid')
    ),
    "games/myth.sid": museum(
        'JEROEN TEL — MYTH (1989)',
        `System 3s Edel-Platformer <strong>Myth: History in the Making</strong> schickt den Helden quer durch griechische Sagenwelten, Wikinger-Schiffe und das alte Ägypten – mit butterweichen Animationen und einem der beliebtesten <strong>Jeroen-Tel</strong>-Titelthemes überhaupt. Während im eigentlichen Spiel nur knackige Soundeffekte laufen, zündet das Titelmenü ein mitreißendes Synth-Feuerwerk. Programmierer Peter Baron erzählte später, wie Grafiker Bob Stevenson quasi in letzter Sekunde vor Release noch ein aufgenommenes Sprachsample zulieferte.`,
        `<strong>RSID v2 · 3 Subsongs (Start 1)</strong>. Ein klassischer <strong>RSID</strong>-Kandidat: Zwei vollwertige Musikstücke plus das kurze Event mit Stevensons Sprachsample in Subsong 2 – ein eindrucksvolles Beispiel für die Spät-80er-High-End-Produktionen von Maniacs of Noise.`,
        deepsid('/MUSICIANS/T/Tel_Jeroen/Myth.sid')
    ),
    "games/eliminator.sid": museum(
        'JEROEN TEL — ELIMINATOR (1989)',
        `Hewson Consultants lieferte mit <strong>Eliminator</strong> einen schnellen 3D-Tunnel-Shooter, und <strong>Jeroen Tel</strong> steuerte dafür eine seiner energiegeladensten 1989er Kompositionen bei – inklusive einer über siebenminütigen Ingame-Dauerbeschallung! Wer genau hinhört, entdeckt in der Highscore-Musik ein augenzwinkerndes elfsekündiges Zitat: <em>Gyroscope</em> aus einer britischen TV-Werbung von Graham Jarvis und Rob Hartshorne.`,
        `<strong>PSID v2 · 4 Subsongs (Start 3)</strong>. Der Player springt direkt auf Subsong 3 (das 2:55-minütige Titelthema); auf Subsong 1 wartet das epische 7:18-Minuten-Ingame-Stück, das Tels typischen Hex-Assembler-Stil mit treibenden MoN-Grooves verbindet.`,
        deepsid('/MUSICIANS/T/Tel_Jeroen/Eliminator.sid')
    ),
    "games/led-storm.sid": museum(
        'TIM FOLLIN — L.E.D. STORM (1989)',
        `Capcoms futuristischer Rallye-Racer <strong>L.E.D. Storm</strong> bekam von Software Creations eine bärenstarke Umsetzung – für die Musik vergab die knallharte <em>ZZAP!64</em> satte <strong>94 %</strong>! <strong>Tim Follin</strong> verzichtete erneut auf eine brave Arcade-Kopie und zimmerte einen eigenen High-Speed-Soundtrack samt versteckten Grüßen an Deep Purple und Yello (Subsong 1). Ein genialer Gimmick des Originalspiels: Auf dem Titelbildschirm konnte der Spieler mit <code>+</code> und <code>−</code> den <strong>SID-Filter live nach Gehör verstellen</strong>!`,
        `<strong>PSID v2 · 7 Subsongs (Start 1)</strong>. Auch hier hackte Follin am Tatung Einstein Zahlenpaare direkt in <strong>Stephen Ruddys Sound-Driver</strong> – und erzielte damit eine klangliche Wucht und Präzision, die viele Tracker-Produktionen der 90er alt aussehen ließ.`
    ),
    "games/ghouls-n-ghosts.sid": museum(
        'TIM FOLLIN — GHOULS ’N’ GHOSTS (1989)',
        `Während Mark Cooksey bei <em>Ghosts ’n Goblins</em> noch eigene Wege ging, setzte <strong>Tim Follin</strong> beim Nachfolger <strong>Ghouls ’n’ Ghosts</strong> Tamayo Kawamotos legendäre Arcade-Kompositionen für den C64 um – allerdings mit voller Follin-Wucht. Besonders die Themen aus Stage 2 (Subsong 8) und Stage 4 (Subsong 10) zeigen, wie perfekt der SID zwischen schauriger Orgel-Dramatik und hartem Metal-Riffing umschalten kann.`,
        `<strong>PSID v2 · 32 Subsongs (Start 1)</strong>. Wieder im Gespann mit <strong>Stephen Ruddys Musik-Driver</strong> entstanden, trennt die Datei die langen Level-Themen sauber von dutzenden kurzen Übergangs- und Ereignissignalen.` ,
        deepsid('/MUSICIANS/F/Follin_Tim/Ghouls_n_Ghosts.sid')
    ),
    "games/citadel.sid": museum(
        'MARTIN WALKER — CITADEL (1989)',
        `Nach <em>Armalyte</em> erschien 1989 <strong>Martin Walkers</strong> letztes Komplett-Projekt als Programmierer und Musiker bei Electric Dreams, bevor er sich komplett auf Game-Audio (u. a. <em>SWIV</em>, <em>Speedball II</em>) konzentrierte. Im Rückblick stellte Walker <strong>Citadel</strong> direkt neben <em>Armalyte</em>: Beide entstanden auf seinem eigenen Musikplayer mit betont <strong>cinematischem Anspruch</strong> – getragen von satten Bässen, perkussiver Wucht und ungewöhnlichen, sich langsam verschiebenden Akkordfolgen.`,
        `<strong>PSID v2 · 4 Subsongs (Start 1)</strong>. Die vier Stücke (4:02, 2:08, 0:42 und 2:56) nutzen Walkers hauseigene Engine ohne fremde Tracker-Schablonen – perfekt für Freunde dunkler, komplex harmonisierter Spät-80er-SIDs.`,
        { label: 'Commodore Format: Martin Walker', url: 'https://commodoreformatarchive.com/the-martin-walker-interview/' }
    ),

    // =========================================================================
    // GAMES: 1990–1993 (Die C64-Spätphase)
    // =========================================================================
    "games/turrican.sid": museum(
        'VACA, HÜLSBECK & HARTWIG — TURRICAN (1990)',
        `Viele schreiben den C64-Soundtrack zu Manfred Trenz’ Über-Actionspiel reflexartig allein Chris Hülsbeck zu – dabei ist der C64-SID von <strong>Turrican</strong> eine echte deutsche Teamarbeit! <strong>Stefan Hartwig</strong> komponierte das stimmungsvolle Intro (Subsong 1), <strong>Ramiro Vaca</strong> arrangierte das Titelthema nach Hülsbecks Amiga-Musik sowie Themen von Vince DiCola, <strong>Michael Hendriks</strong> steuerte Subsong 4 bei, und <strong>Chris Hülsbeck</strong> selbst ist mit dem bereits 1988 entstandenen <em>The Deep</em> (Subsong 3) vertreten.`,
        `<strong>PSID v2 · 6 Subsongs (Start 1)</strong>. Durch die beteiligten Demo- und Spiele-Veteranen zeigt das SID-File einen spannenden Stilmix aus klassischem Rainbow-Arts-Pathos und moderneren Spät-80er-Treibertricks – ein Brückenschlag zwischen C64 und Amiga.`
    ),
    "games/flimbos-quest.sid": museum(
        'JOHANNES BJERREGAARD — FLIMBO’S QUEST (1990)',
        `Niederländische Demoscene-Power für System 3: Programmiert wurde <strong>Flimbo’s Quest</strong> (später eines der vier Pack-In-Spiele für die gefloppte Spielkonsole C64GS!) von Laurens van der Donk aus den Gruppen <em>Boys Without Brains</em> und <em>Hotline</em>. Die Audio-Betreuung übernahmen die <strong>Maniacs of Noise</strong>: Der Däne <strong>Johannes Bjerregaard</strong> schrieb den verspielten Haupt-Soundtrack, während ein weiterer Ladevorschlag von ihm abgelehnt wurde – Entwickler van der Donk zog stattdessen Reyn Ouwehands berühmtes Intro vor. Bjerregaards ungenutzter Loader überlebte trotzdem versteckt in der Musikdatei!`,
        `<strong>PSID v2 · 8 Subsongs (Start 1)</strong>. Diese Hauptmusik-Datei bündelt Bjerregaards vier längere Level- und Weltenthemen samt kurzen Spielereignissen – butterweiche Arpeggios und federnde MoN-Bässe in Reinkultur.`,
        deepsid('/MUSICIANS/B/Bjerregaard_Johannes/Flimbos_Quest_main.sid')
    ),
    "games/last-ninja-3.sid": museum(
        'REYN OUWEHAND — LAST NINJA 3 (1991)',
        `Für den dritten Teil der Ninja-Saga engagierte System 3 den jungen Niederländer <strong>Reyn Ouwehand</strong>, der in der späten C64-Demoscene gerade zum Superstar aufstieg. Nach Ben Daglish (Teil 1) und Matt Gray (Teil 2) drückte Ouwehand der Serie seinen ganz eigenen, technisch extrem ausgefeilten Stempel auf und vertonte die fünf Element-Tempel (Mountains, Wind, Water, Fire, Void) mit verblüffender Detailverliebtheit.`,
        `<strong>PSID v2 · 10 Subsongs (Start 3)</strong>. Direkt beim Start läuft das 4:47 Minuten lange Intro (in früheren Rips hatte der Loop einen kleinen Fehler, der später mithilfe von Ouwehands eigenen Originaldaten restauriert wurde). Ouwehand reizt hier das Timing und die Hüllkurven-Präzision seines Players bis aufs Letzte aus.`,
        deepsid('/MUSICIANS/O/Ouwehand_Reyn/Last_Ninja_3.sid')
    ),
    "games/supremacy.sid": museum(
        'JEROEN TEL — SUPREMACY / OVERLORD (1991)',
        `Weltraum-Globalstrategie für den C64: Virgins <strong>Supremacy</strong> (in den USA als <em>Overlord</em> veröffentlicht) erhielt von <strong>Jeroen Tel</strong> einen bemerkenswert düsteren, beinahe industriellen Sci-Fi-Soundtrack, der hervorragend zur kalten Planeten-Eroberung passt und weit entfernt ist von seinen verspielteren Hewson-Jahren.`,
        `<strong>PSID v2 · 3 Subsongs (Start 1)</strong>. Drei straff aufgebaute Kompositionen (3:51, 0:39 und 2:31), die mit kalten, metallischen Klangfarben, langsamen Spannungsbögen und satten Basspulsen ein eigenes akustisches Universum erschaffen.`,
        deepsid('/MUSICIANS/T/Tel_Jeroen/Supremacy.sid')
    ),
    "games/robocop-3.sid": museum(
        'JEROEN TEL — ROBOCOP 3 (1992)',
        `Ein perfektes Beispiel für die enge Verzahnung von Demoscene und kommerzieller Spieleindustrie Anfang der 90er: Bevor Oceans C64-Fassung von <strong>RoboCop 3</strong> überhaupt erschien, feierte <strong>Jeroen Tels</strong> gewaltiger erster Track bereits im Dezember 1991 Premiere in der legendären C64-Demo <em>Dutch Breeze</em>! Und noch ein verblüffendes Detail zur Entstehung: Tel verriet später, dass er zunächst in einer einzigen Nacht im Londoner Büro von Probe Software die <strong>NES-Fassung</strong> komponierte und die Ideen erst danach für den C64 adaptierte.`,
        `<strong>PSID v2 · 20 Subsongs (Start 1)</strong>. Neben dem wuchtigen Hauptthema steckt ein technisches Gustostückerl in der Datei: Laut Tel selbst verwenden die <strong>Subsongs 4 und 5 jeweils nur eine einzige SID-Stimme</strong> – reine 90er-Chip-Artistik auf höchstem Niveau.`,
        deepsid('/MUSICIANS/T/Tel_Jeroen/Robocop_3.sid'),
        csdb(11584, 'Dutch Breeze')
    ),
    "games/creatures-2.sid": museum(
        'STEVE ROWLANDS — CREATURES 2 (1992)',
        `Die Brüder John und <strong>Steve Rowlands</strong> (Apex Computer Productions) trieben den alten Brotkasten 1992 zu Höchstleistungen, die kaum jemand noch für möglich hielt. Für das Kultspiel <strong>Creatures 2</strong> rund um Held Clyde Radcliffe lieferte Steve Rowlands einen extrem abwechslungsreichen Score, der jede Spielsituation – inklusive sechs berüchtigter <em>Torture Screens</em> (Folterkammern!) und versteckter Räume – musikalisch untermalt. Subsong 16 ist zudem ein Self-Remix seines Stücks <em>Funky Music B</em>.`,
        `<strong>PSID v2 · 18 Subsongs (Start 2)</strong>. Der Start auf Subsong 2 führt direkt in das 3:46 Minuten lange Hauptthema. Die 18 kurzen und langen Tracks machen hörbar, wie stark Spätphase-Spiele auf dynamische, szenenbezogene Musikwechsel setzten.`
    ),
    "games/mayhem-in-monsterland.sid": museum(
        'STEVE ROWLANDS — MAYHEM IN MONSTERLAND (1993)',
        `1993 – als die Welt längst auf 16 Bit und Konsolen schaute – veröffentlichten die Rowlands-Brüder das vielleicht farbenfrohste und technisch beeindruckendste Jump-’n’-Run der gesamten C64-Geschichte (erste 100-%-Wertung überhaupt in der <em>Commodore Format</em>!). Genial war das dynamische Audio-Konzept von <strong>Steve Rowlands</strong>: Jeder der fünf Welten (<em>Jellyland</em>, <em>Pipeland</em>, <em>Spottyland</em>, <em>Cherryland</em>, <em>Rockland</em>) beginnt im düsteren „Sad Mode“ – sobald Dinosaurier Mayhem genug Magie einsammelt und die Welt fröhlich wird, schaltet nicht nur die Grafik in bunte Farben um, sondern auch die Musik sofort in eine ausgelassene, jazzige „Happy“-Variante! Subsong 3 orientiert sich dabei augenzwinkernd an Bruce Broughtons <em>Tiny Toons</em>-Melodie.`,
        `<strong>PSID v2 · 24 Subsongs (Start 2)</strong>. Mit Subsong 2 beginnt das Intro (statt des kurzen Mayhem-TV-Signals). Ein spätes Meisterwerk der C64-Spielmusik, das volle Spielegrafik-Rastertricks und interaktive Soundtrack-Übergänge unter einen Hut bringt.`,
        deepsid('/MUSICIANS/R/Rowlands_Steve/Mayhem_In_Monsterland.sid')
    ),

    // =========================================================================
    // MUSICDISKS (1988–1989)
    // =========================================================================
    "musicdisks/compilation-i.sid": museum(
        'CHRIS HÜLSBECK — COMPILATION I (1988/89)',
        `Ende der 80er begann die Ära der kommerziellen und halb-offiziellen C64-Musicdisks – Alben direkt für den Heimcomputer. In <strong>Compilation I</strong> versammelte <strong>Chris Hülsbeck</strong> vier eigenständige Kompositionen ohne Spielzwang: <em>Elladita</em>, <em>Time</em>, <em>Old Imagines</em> und <em>Trioly</em> (eine Anspielung auf die markanten Triolen-Läufe). Obwohl im Header 1989 steht, entstanden die Stücke laut Hülsbeck bereits im September und Oktober 1988.`,
        `<strong>PSID v2 · 4 Subsongs (Start 3)</strong>. Da Start-Subsong 3 aktiv ist, öffnet die Sammlung direkt mit <em>Old Imagines</em>. Alle vier Tracks zeigen Hülsbecks gereiften späten C64-Stil kurz vor seinem endgültigen Wechsel zum Amiga.`,
        deepsid('/MUSICIANS/H/Huelsbeck_Chris/Compilation_I.sid')
    ),
    "musicdisks/compilation-iii.sid": museum(
        'CHRIS HÜLSBECK — COMPILATION III (1988/89)',
        `1989 über A.U.D.I.O.S.-Entertainment erschienen, entstand <strong>Compilation III</strong> laut <strong>Chris Hülsbeck</strong> ebenfalls bereits im August und September 1988 – und beherbergt einen echten C64-Mythos: Die vier Stücke heißen <em>Moodolo</em>, <em>Try It Hard</em>, <em>Dreamlights</em> (das mit dem alten Arbeitstitel „Hurrican“ verknüpft ist) und <strong><em>The Deep</em></strong>. Letzteres wurde zwei Jahre später weltberühmt, als es als Subsong 3 in Manfred Trenz’ <em>Turrican</em> landete!`,
        `<strong>PSID v2 · 4 Subsongs (Start 3)</strong>. Der Player startet auf Subsong 3 (<em>Dreamlights</em>), Subsong 4 liefert das berühmte <em>The Deep</em> in der ursprünglichen Musicdisk-Fassung.`,
        deepsid('/MUSICIANS/H/Huelsbeck_Chris/Compilation_III.sid'),
        csdbSid(13988, 'Compilation III')
    ),

    // =========================================================================
    // DEMOSCENE (1989–2024)
    // =========================================================================
    "demoscene/delta-tomas-danko.sid": museum(
        'TOMAS DANKO — DELTA REINTERPRETATION (1989)',
        `In den späten 80ern war es unter jungen schwedischen und europäischen Demoscene-Musikern ein beliebter Ritterschlag, die großen Vorbilder von Rob Hubbard neu zu interpretieren. <strong>Tomas Danko</strong> veröffentlichte 1989 diese knappe, druckvolle Hommage an Hubbards <em>Delta</em>: Der Einstieg zitiert direkt den Anfang von Philip Glass’ <em>Koyaanisqatsi</em>, bevor ab Sekunde 0:52 Dankos eigenes Cover des berühmten Abschnitts aus Hubbards Subsong 12 einsetzt.`,
        `<strong>PSID v2 · 1 Subsong · Länge 1:17</strong>. Ein wunderbares Zeitdokument dafür, wie Demoscene-Musiker Ende der 80er aus den großen kommerziellen C64-Vorbildern eigene Tracker- und Filter-Experimente formten.`
    ),
    "demoscene/radio-napalm.sid": museum(
        'PVCF — RADIO NAPALM (1995)',
        `Willkommen in der goldenen Mitte der 90er-Trackmo-Ära: Die niederländische C64-Party <strong>X’95</strong> gilt als Geburtsstunde der modernen Party-Kultur rund um die holländische Top-Gruppe Reflex – deren gleichnamige Trackmo <strong>Radio Napalm</strong> prompt den Demo-Wettbewerb gewann. <strong>Kai Walter (PVCF)</strong> lieferte dazu einen kühl-hypnotischen Techno-Soundtrack mit extrem markanten Filterfahrten, der perfekt zu den endlosen, rastergenauen Code-Effekten passte.`,
        `<strong>PSID v2 · 1 Subsong · Länge 4:28,098</strong>. Ein Lehrstück in <strong>Hardware-Limitierungen</strong>: PVCF komponierte im beliebten Demo-Tool <strong>DMC (Demo Music Creator)</strong>, das jedoch auf nur 16 Instrumenten-Slots beschränkt war – die charakteristisch „stufigen“ Filterbewegungen im ersten Part sind eine direkte Folge dieses Limits! Zudem entstand das Stück ursprünglich für den neueren <strong>MOS 8580</strong> (später erschien zusätzlich eine auf den 6581 abgestimmte Version).`,
        csdb(11665, 'Radio Napalm'),
        csdbSid(23582, 'Radio Napalm')
    ),
    "demoscene/edge-of-disgrace.sid": museum(
        'DANE — EDGE OF DISGRACE (2008)',
        `Einer der größten Donnerschläge der modernen C64-Demoscene: Auf der <strong>X’2008</strong> fegte Booze Design mit <strong>Edge of Disgrace</strong> alles vom Tisch und holte Platz 1 im Demo-Wettbewerb. Das Verrückteste daran: <strong>Stellan Andersson (Dane)</strong> stemmte nicht nur Code und Grafik mit, sondern komponierte im Alleingang auch den fast viertelstündigen, nahtlos durchlaufenden Demo-Soundtrack! Sogar Brad Fiedels <em>Terminator-2</em>-Motiv blitzt darin kurz auf.`,
        `<strong>PSID v2 · 16 Subsongs (Start 1)</strong>. Technisch ist dies ein echtes <strong>8580-R5-Meisterwerk</strong>: Subsong 1 spielt den kompletten, <strong>14:34 Minuten</strong> langen Trackmo-Score am Stück, während die Subsongs 2–16 als direkte Sprungmarken in die einzelnen Demo-Parts dienen. Volle Filter-Präzision, glasklare Drums und ein Groove, der jeden Effekt exakt auf den Frame trifft.`,
        csdb(72550, 'Edge of Disgrace')
    ),
    "demoscene/coma-light-13-tune-1.sid": museum(
        'FANTA — COMA LIGHT 13 / TUNE 1 (2012)',
        `Vier Jahre nach <em>Edge of Disgrace</em> folgte der nächste legendäre X-Party-Triumph: Die deutsche Gruppe Oxyron gewann am 28. Oktober 2012 auf der <strong>X’2012</strong> mit <strong>Coma Light 13</strong> (nach langer Serie kultiger <em>Coma-Light</em>-Teile) den ersten Platz. <strong>Alexander Rotzsch (Fanta)</strong> eröffnete die fünfteilige Demo-Musik mit diesem augenzwinkernden 38-Sekunden-Opener – einer direkten musikalischen Verneigung vor Danes erstem <em>Edge-of-Disgrace</em>-Part.`,
        `<strong>PSID v2 · 1 Subsong · Länge 0:38</strong>. Abgestimmt auf den kristallklaren <strong>MOS 8580</strong>, funktioniert Tune 1 als kurzes musikalisches „Hallo“ zwischen zwei der einflussreichsten C64-Demos des 21. Jahrhunderts.`,
        deepsid('/MUSICIANS/F/Fanta/Coma_Light_13_tune_1.sid'),
        { label: 'Oxyron: Coma Light 13', url: 'https://www.oxyron.de/html/demos.html' },
        csdb(112378, 'Coma Light 13')
    ),
    "demoscene/playhorse.sid": museum(
        'ASSEMBLY 2012 — CONSERVATIVE MEGADEMO / PLAYHORSE',
        `Finnischer Szenewitz in Höchstform: Pers’ Wastaiset Produktiot (PWP) traten auf der riesigen <strong>Assembly Summer 2012</strong> in der plattformübergreifenden <em>Oldskool Demo Competition</em> an – und holten mit ihrer lediglich <strong>9.367 Bytes</strong> großen Polit-Satire <strong>Conservative Megademo</strong> sensationell Platz 1! Code und Design stammten von <strong>Viznut</strong>, die Grafik teilten sich ccr, parkitus und Viznut, und die treibende Musik <strong>Playhorse</strong> kam von <strong>Paavo Pessi (Ilmarque)</strong>. Der Gag der Demo: absichtlich eingebaute Grafik- und Sound-Glitches als bissiger Kommentar.`,
        `<strong>PSID v2 · 2 Subsongs (PAL/6581, Start 1)</strong>. Genau die Glitch-Geschichte erklärt die zwei Subsongs: Subsong 1 (1:58) ist die hochgepitchte, schnellere Demo-Fassung, während Subsong 2 (2:33) Ilmarques unberührtes, langsameres Original bewahrt. Load und Init sitzen bei <code>$3FF0</code>, Replay bei <code>$4003</code>.`,
        csdb(110508, 'Conservative Megademo'),
        csdbSid(47820, 'Playhorse')
    ),
    "demoscene/comaland-100-facetime.sid": museum(
        'MAGNAR HARESTAD — COMALAND 100% / FACETIME (2015)',
        `Als sich die schwedischen Legenden Censor Design und die deutschen Hardware-Magier von Oxyron zusammentaten, entstand <strong>Comaland</strong>: Sieger der X’2014 und am 20. Juni 2015 auf der Nordlicht als gefixte Finalversion <strong>Comaland 100%</strong> veröffentlicht. Neben Tracks von dEViLOCk und Fanta steuerte der Norweger <strong>Magnar Harestad</strong> den unvergesslichen Endpart <strong>FaceTime (v.0.2.7)</strong> bei – komplett mit glasklar abgemischten Sprachsamples über treibendem SID-Groove.`,
        `<strong>RSID v2 · 1 Subsong · Länge 6:02,201</strong>. Der <strong>RSID-Container</strong> garantiert exaktes Interrupt- und CIA-Timing, damit die eingebetteten Sprachsamples synchron über alle drei laufenden Musikstimmen geschoben werden können.`,
        demozoo(140070, 'Comaland 100%'),
        csdb(139278, 'Comaland 100%')
    ),
    "demoscene/nine-nights-from-the-black-moon.sid": museum(
        'ASSEMBLY 2020 — FANTOMAS / NINE NIGHTS FROM THE BLACK MOON',
        `Entstanden an einem finnischen Sommerabend 2020 auf der Veranda von Musiker <strong>Jani Joeli (Jojeli)</strong>, als Coder <strong>Adder</strong> kurzentschlossen per Nachricht vorschlug, doch schnell eine neue Demo für die Assembly Online 2020 zu bauen: Mit Grafiker <strong>Aomeba</strong> im Boot gewannen Siesta prompt die <em>Oldskool Demo Competition</em>! Der poetische Titel <strong>Nine Nights from the Black Moon</strong> stammt aus alter finnischer Folklore: Birkenzweige für den Saunabesen (<em>Vihta</em>) schneidet man demnach genau neun Nächte nach Neumond, damit die Blätter beim Saunieren nicht abfallen.`,
        `<strong>PSID v2 · 1 Subsong · PAL/8580 · Länge 4:38,985</strong>. Ein moderner, straff durchproduzierter Demo-Track (<code>$1000</code> Init/Load, <code>$1003</code> Play), der zeigt, wie warm und druckvoll zeitgenössische Tracker-Kompositionen auf dem <strong>MOS 8580</strong> klingen.`,
        csdb(196684, 'Fantomas'),
        csdbSid(58136, 'Nine Nights from the Black Moon')
    ),
    "demoscene/scroll-of-antonius.sid": museum(
        'ASSEMBLY 2023 — THE SCROLL OF ANTONIUS',
        `Ein augenzwinkernder Szenegruß mit ordentlich Verspätung: Fairlight-Coder <strong>Trident</strong> erklärte die Story hinter <strong>The Scroll of Antonius</strong> damit, dass die befreundete Gruppe <em>Padua</em> in früheren Demos versehentlich vergessen worden war – also spann er um sie gleich ein ganzes Fantasie-Epos rund um eine Schriftrolle aus dem 13. Jahrhundert und eine geheimnisvolle Flüssigkeit voller Demoscene-Energie. Zusammen mit Grafiker <strong>Soya</strong>, <strong>tNG</strong> (Charset/DirArt) und SID-Musiker <strong>Figge Wasberger (Fegolhuzz)</strong> reichte das auf der Assembly Summer 2023 souverän für Platz 1 der <em>Oldskool Demo Competition</em>.`,
        `<strong>PSID v2 · 1 Subsong · PAL/8580 · Länge 3:04,940</strong>. Klassisches Standard-Layout (Load/Init <code>$1000</code>, Play <code>$1003</code>) für den <strong>MOS 8580</strong> mit modernen Demo-Arpeggios, straffer Lead-Führung und breiten Akkorden.`,
        csdb(234200, 'The Scroll of Antonius'),
        csdbSid(62736, 'The Scroll of Antonius')
    ),
    "demoscene/transcend-the-game.sid": museum(
        'ASSEMBLY 2024 — TRANSCEND THE GAME',
        `Die finnische One-Man-Show der Assembly Summer 2024: <strong>Ville-Matias Heikkilä (Viznut)</strong> – in der Computerkunstszene berühmt als Erfinder von <strong>Bytebeat</strong> (Musik aus winzigen mathematischen C-Einzeilern) sowie für seine extrem minimalistischen VIC-20-Demos – gewann mit <strong>Transcend the Game</strong> für Pers’ Wastaiset Produktiot (PWP) die <em>Oldskool Demo Competition</em> im Alleingang (Code, Grafik und Musik aus einer Hand, unter 32 KB als C64-Onefiler!). Damit ist es der jüngste C64-Gesamtsieg in der Assembly-Oldskool-Reihe.`,
        `<strong>PSID v2 · 1 Subsong · PAL/6581</strong>. Ein handgefertigter Direct-Rip direkt aus dem Original-Onefiler: Load und Init sitzen unkonventionell weit unten im RAM bei <code>$0400</code>, der 6510-Replay bei <code>$0403</code> (Musikdaten von <code>$0400–$0AFF</code>). Minimalistischer, kantiger 6581-Eigenbau ohne dicken Tracker-Overhead.`,
        demozoo(354251, 'Transcend the Game'),
        csdb(244634, 'Transcend the Game'),
        { label: 'Pouët: Transcend the Game', url: 'https://www.pouet.net/prod.php?which=97441' }
    ),

    // =========================================================================
    // TECHNIK / TESTSUITE
    // =========================================================================
    "tests/sid-emulation-test.sid": museumCustom(
        'CHIPTUNES FANTASY — SID EMULATION TEST SUITE',
        `Kein Spiel, keine Demo – sondern das Stethoskop für den Emulator: Diese speziell für <em>Chiptunes Fantasy</em> gebaute <strong>PSID-v2-Diagnosedatei</strong> macht auf einen Durchgang hör- und messbar, wie sauber ein Web-Audio- oder JavaScript-SID-Kern arbeitet.`,
        `<strong>PSID v2 · 1 Subsong · 91.72 Sekunden Loop</strong>. Im Sekundentakt feuert die Testsuite 61 gezielte Register-Stresstests ab: 8 Wellenform-Kombinationen über 5 Frequenzstufen, 5 ADSR-Hüllkurven-Profile inklusive Release-Phase, Filter-Modi (Lowpass/Bandpass/Highpass) mit variierender Cutoff- und Resonanz-Steilheit sowie Zwei-Oszillator-Tests für <strong>Hard Sync</strong> und <strong>Ringmodulation</strong>.`
    )
};