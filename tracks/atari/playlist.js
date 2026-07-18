// === tracks/atari/external.js ===
// ==========================================
// Atari ST YM2149 Jukebox Playlist Registry
// Curated Legendary Showcase Edition + Full Archive
// ==========================================

import { loadYmFile } from '../../js/parsers/ym-parser.js';

const myYmFiles = [
    // --- SPOTLIGHT TRACKS (Die legendären 5) ---
    "thalion_loader.YM",           
    "SyntaxTerror.YM",             
    "UnionDemo_Mega_Apocalypse.YM",
    "BIONIC1.YM",                  
    "Dragonflight_City_1.YM",      
    
    // --- EXTENDED ARCHIVE (Die restlichen Dumps) ---
    "turrican1_world_1_1.YM",      
    "Turrican2_TheDesertRocks.YM",
    "WINGLEV1.YM",               
    "WINGLEV2.YM",
    "WINGLEV3.YM",
    "WINGLEV4.YM",
    "WINGLEV5.YM",
    "WINGLEV6.YM",
    "WINGLEV7.YM",
    "WINGLEV8.YM",
    "WINGLEV9.YM",
    "WINGLOAD.YM",
    "LethalXcess1.YM",
    "LethalXcess2.YM",
    "LethalXcess3.YM",
    "LethalXcess4.YM",
    "LethalXcess5.YM",
    "LethalXcess6.YM",
    "LethalXcess7.YM",
    "XN1.YM",
    "XN2.YM",
    "XN3.YM",
    "GOLDRUN.YM",
    "spherical_intro.YM",
    "Dragonflight_Title.YM",
    "Dragonflight_City_2.YM",
    "Dragonflight_City_3.YM",
    "Dragonflight_unspec.YM",
    "EnchantedLands_Intro.YM",    
    "Giana_Title.YM",
    "Giana_InGame1.YM",
    "Giana_InGame2.YM",
    "Giana_InGame3.YM",
    "Giana_Bonus.YM",
    "Giana_Highscore.YM",
    "C64_Convertion_Shades_Giana.YM",
    "UnionDemo_Level_16_Fullscreen.YM",
    "UnionDemo_ThatsTheWayItIs.YM",
    "UnionDemo_NinjaRemix.YM",
    "UnionDemo_Thundercats.YM",
    "UnionDemo_ChildrenSongs.YM",
    "UnionDemo_Pandora.YM",
    "UndionDemo_ThinkTwice.YM",
    "UnionDemo_ProBMX.YM",
    "UnionDemo_AlloyRun.YM",
    "UnionDemo_Cybernoid.YM",
    "SyntaxTerror_tex.YM",
    "SyntaxTerror_tlb.YM",
    "AMBER01.YM",
    "AMBER02.YM",
    "AMBER03.YM",
    "AMBER04.YM",
    "AMBER05.YM",
    "AMBER06.YM",
    "AMBER07.YM",
    "AMBER08.YM",
    "AMBER09.YM",
    "AMBER10.YM",
    "AMBER11.YM",
    "AMBER12.YM",
    "AMBER13.YM",
    "AMBER14.YM",
    "AMBER15.YM",
    "AMBER16.YM",
    "AMBER17.YM"
];

const composerMetadata = {
    "AMBER01.YM": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p>Das legendäre Titelthema des epischen Rollenspiels <strong>Amberstar</strong> (Thalion, 1992), komponiert von Jochen Hippel (Mad Max). Der Soundtrack gilt weithin als das absolute <strong>Reife- und Meisterwerk</strong> in Hippels 16-Bit-Karriere und besitzt unter RPG-Enthusiasten einen unantastbaren Kultstatus.</p>
        <p><strong>DSP-Fokus:</strong> Hippel inszeniert hier eine dichte, orchestrale Fantasy-Melodie, die an Erhabenheit kaum zu überbieten ist. Er knackt die Beschränkungen des YM2149F, indem er die drei Rechteckkanäle über präzise Software-ADSR-Hüllkurven und subtile Vibrato-LFOs in ein atmendes, fast analoges Synthesizer-Gespinst verwandelt.</p>
    `,
    "AMBER02.YM": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p>Die unvergessliche Begleitmusik zur Startstadt <strong>Twinlake</strong> aus <em>Amberstar</em> (1992). Jochen Hippel entwirft hier eine warme, getragene Melodieführung, die das geschäftige Treiben der mittelalterlichen Fantasy-Metropole perfekt einfängt.</p>
        <p><strong>DSP-Fokus:</strong> Der Track glänzt durch seine fließenden, beinahe geigenartigen Pitch-Slides und ein warmes Fundament. Unser cycle-genauer ST-Mischer verarbeitet die dichten Registerdaten völlig artefakt- und aliasingfrei, wodurch die feinen, chorusschwebenden Frequenzbuchtungen glasklar zur Geltung kommen.</p>
    `,
    "AMBER03.YM": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p>Das mitreißende <strong>Tavernen- und Tanzthema (Dance Theme)</strong> aus <em>Amberstar</em> (1992) von Jochen Hippel. Ein absolut grooviges, fast schon folk-rockiges Chiptune-Stück, das in Lyramions Spelunken für Stimmung sorgt.</p>
        <p><strong>DSP-Fokus:</strong> Hippel nutzt hier extrem knackig gesnapte ADSR-Softwarehüllkurven, um perkussive Kastagnetten- und Trommelakzente direkt auf den Rechteckoszillatoren zu simulieren. Das sorgt für ein ungemein tightes, rhythmisches Fundament.</p>
    `,
    "AMBER04.YM": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p>Ein atmosphärisches Begleitthema aus dem Rollenspiel-Meisterwerk <strong>Amberstar</strong> (Thalion, 1992), komponiert von Jochen Hippel. Dieser Soundtrack gilt als sein absolutes chiptunetechnisches Magnum Opus.</p>
        <p><strong>DSP-Fokus:</strong> Durch das meisterhafte, direkte Beschreiben der Register im 50Hz-Takt erzeugt Hippel orchestrale Synthesizer-Strukturen, die dem YM2149F eine bis dato unvorstellbare Tiefe entlocken. Unser stahlharter Emulator bringt diese dichten Registerdaten absolut phasenstarr zur Geltung.</p>
    `,"AMBER05.YM": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p>Ein atmosphärisches Begleitthema aus dem Rollenspiel-Meisterwerk <strong>Amberstar</strong> (Thalion, 1992), komponiert von Jochen Hippel. Dieser Soundtrack gilt als sein absolutes chiptunetechnisches Magnum Opus.</p>
        <p><strong>DSP-Fokus:</strong> Durch das meisterhafte, direkte Beschreiben der Register im 50Hz-Takt erzeugt Hippel orchestrale Synthesizer-Strukturen, die dem YM2149F eine bis dato unvorstellbare Tiefe entlocken. Unser stahlharter Emulator bringt diese dichten Registerdaten absolut phasenstarr zur Geltung.</p>
    `,
    "AMBER06.YM": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p>Ein atmosphärisches Begleitthema aus dem Rollenspiel-Meisterwerk <strong>Amberstar</strong> (Thalion, 1992), komponiert von Jochen Hippel. Dieser Soundtrack gilt als sein absolutes chiptunetechnisches Magnum Opus.</p>
        <p><strong>DSP-Fokus:</strong> Durch das meisterhafte, direkte Beschreiben der Register im 50Hz-Takt erzeugt Hippel orchestrale Synthesizer-Strukturen, die dem YM2149F eine bis dato unvorstellbare Tiefe entlocken. Unser stahlharter Emulator bringt diese dichten Registerdaten absolut phasenstarr zur Geltung.</p>
    `,
    "AMBER07.YM": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p>Ein atmosphärisches Begleitthema aus dem Rollenspiel-Meisterwerk <strong>Amberstar</strong> (Thalion, 1992), komponiert von Jochen Hippel. Dieser Soundtrack gilt als sein absolutes chiptunetechnisches Magnum Opus.</p>
        <p><strong>DSP-Fokus:</strong> Durch das meisterhafte, direkte Beschreiben der Register im 50Hz-Takt erzeugt Hippel orchestrale Synthesizer-Strukturen, die dem YM2149F eine bis dato unvorstellbare Tiefe entlocken. Unser stahlharter Emulator bringt diese dichten Registerdaten absolut phasenstarr zur Geltung.</p>
    `,
    "AMBER08.YM": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p>Ein atmosphärisches Begleitthema aus dem Rollenspiel-Meisterwerk <strong>Amberstar</strong> (Thalion, 1992), komponiert von Jochen Hippel. Dieser Soundtrack gilt als sein absolutes chiptunetechnisches Magnum Opus.</p>
        <p><strong>DSP-Fokus:</strong> Durch das meisterhafte, direkte Beschreiben der Register im 50Hz-Takt erzeugt Hippel orchestrale Synthesizer-Strukturen, die dem YM2149F eine bis dato unvorstellbare Tiefe entlocken. Unser stahlharter Emulator bringt diese dichten Registerdaten absolut phasenstarr zur Geltung.</p>
    `,
    "AMBER09.YM": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p>Ein atmosphärisches Begleitthema aus dem Rollenspiel-Meisterwerk <strong>Amberstar</strong> (Thalion, 1992), komponiert von Jochen Hippel. Dieser Soundtrack gilt als sein absolutes chiptunetechnisches Magnum Opus.</p>
        <p><strong>DSP-Fokus:</strong> Durch das meisterhafte, direkte Beschreiben der Register im 50Hz-Takt erzeugt Hippel orchestrale Synthesizer-Strukturen, die dem YM2149F eine bis dato unvorstellbare Tiefe entlocken. Unser stahlharter Emulator bringt diese dichten Registerdaten absolut phasenstarr zur Geltung.</p>
    `,
    "AMBER10.YM": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p>Ein atmosphärisches Begleitthema aus dem Rollenspiel-Meisterwerk <strong>Amberstar</strong> (Thalion, 1992), komponiert von Jochen Hippel. Dieser Soundtrack gilt als sein absolutes chiptunetechnisches Magnum Opus.</p>
        <p><strong>DSP-Fokus:</strong> Durch das meisterhafte, direkte Beschreiben der Register im 50Hz-Takt erzeugt Hippel orchestrale Synthesizer-Strukturen, die dem YM2149F eine bis dato unvorstellbare Tiefe entlocken. Unser stahlharter Emulator bringt diese dichten Registerdaten absolut phasenstarr zur Geltung.</p>
    `,
    "AMBER11.YM": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p>Ein atmosphärisches Begleitthema aus dem Rollenspiel-Meisterwerk <strong>Amberstar</strong> (Thalion, 1992), komponiert von Jochen Hippel. Dieser Soundtrack gilt als sein absolutes chiptunetechnisches Magnum Opus.</p>
        <p><strong>DSP-Fokus:</strong> Durch das meisterhafte, direkte Beschreiben der Register im 50Hz-Takt erzeugt Hippel orchestrale Synthesizer-Strukturen, die dem YM2149F eine bis dato unvorstellbare Tiefe entlocken. Unser stahlharter Emulator bringt diese dichten Registerdaten absolut phasenstarr zur Geltung.</p>
    `,
    "AMBER12.YM": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p>Ein atmosphärisches Begleitthema aus dem Rollenspiel-Meisterwerk <strong>Amberstar</strong> (Thalion, 1992), komponiert von Jochen Hippel. Dieser Soundtrack gilt als sein absolutes chiptunetechnisches Magnum Opus.</p>
        <p><strong>DSP-Fokus:</strong> Durch das meisterhafte, direkte Beschreiben der Register im 50Hz-Takt erzeugt Hippel orchestrale Synthesizer-Strukturen, die dem YM2149F eine bis dato unvorstellbare Tiefe entlocken. Unser stahlharter Emulator bringt diese dichten Registerdaten absolut phasenstarr zur Geltung.</p>
    `,
    "AMBER13.YM": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p>Ein atmosphärisches Begleitthema aus dem Rollenspiel-Meisterwerk <strong>Amberstar</strong> (Thalion, 1992), komponiert von Jochen Hippel. Dieser Soundtrack gilt als sein absolutes chiptunetechnisches Magnum Opus.</p>
        <p><strong>DSP-Fokus:</strong> Durch das meisterhafte, direkte Beschreiben der Register im 50Hz-Takt erzeugt Hippel orchestrale Synthesizer-Strukturen, die dem YM2149F eine bis dato unvorstellbare Tiefe entlocken. Unser stahlharter Emulator bringt diese dichten Registerdaten absolut phasenstarr zur Geltung.</p>
    `,
    "AMBER14.YM": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p>Ein atmosphärisches Begleitthema aus dem Rollenspiel-Meisterwerk <strong>Amberstar</strong> (Thalion, 1992), komponiert von Jochen Hippel. Dieser Soundtrack gilt als sein absolutes chiptunetechnisches Magnum Opus.</p>
        <p><strong>DSP-Fokus:</strong> Durch das meisterhafte, direkte Beschreiben der Register im 50Hz-Takt erzeugt Hippel orchestrale Synthesizer-Strukturen, die dem YM2149F eine bis dato unvorstellbare Tiefe entlocken. Unser stahlharter Emulator bringt diese dichten Registerdaten absolut phasenstarr zur Geltung.</p>
    `,
    "AMBER15.YM": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p>Ein atmosphärisches Begleitthema aus dem Rollenspiel-Meisterwerk <strong>Amberstar</strong> (Thalion, 1992), komponiert von Jochen Hippel. Dieser Soundtrack gilt als sein absolutes chiptunetechnisches Magnum Opus.</p>
        <p><strong>DSP-Fokus:</strong> Durch das meisterhafte, direkte Beschreiben der Register im 50Hz-Takt erzeugt Hippel orchestrale Synthesizer-Strukturen, die dem YM2149F eine bis dato unvorstellbare Tiefe entlocken. Unser stahlharter Emulator bringt diese dichten Registerdaten absolut phasenstarr zur Geltung.</p>
    `,
    "AMBER16.YM": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p>Ein atmosphärisches Begleitthema aus dem Rollenspiel-Meisterwerk <strong>Amberstar</strong> (Thalion, 1992), komponiert von Jochen Hippel. Dieser Soundtrack gilt als sein absolutes chiptunetechnisches Magnum Opus.</p>
        <p><strong>DSP-Fokus:</strong> Durch das meisterhafte, direkte Beschreiben der Register im 50Hz-Takt erzeugt Hippel orchestrale Synthesizer-Strukturen, die dem YM2149F eine bis dato unvorstellbare Tiefe entlocken. Unser stahlharter Emulator bringt diese dichten Registerdaten absolut phasenstarr zur Geltung.</p>
    `,
    "AMBER17.YM": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p>Ein atmosphäoptisches Begleitthema aus dem Rollenspiel-Meisterwerk <strong>Amberstar</strong> (Thalion, 1992), komponiert von Jochen Hippel. Dieser Soundtrack gilt als sein absolutes chiptunetechnisches Magnum Opus.</p>
        <p><strong>DSP-Fokus:</strong> Durch das meisterhafte, direkte Beschreiben der Register im 50Hz-Takt erzeugt Hippel orchestrale Synthesizer-Strukturen, die dem YM2149F eine bis dato unvorstellbare Tiefe entlocken. Unser stahlharter Emulator bringt diese dichten Registerdaten absolut phasenstarr zur Geltung.</p>
    `,
    "GOLDRUN.YM": `
        <h3>[ COMPOSER SPOTLIGHT: ROB HUBBARD ]</h3>
        <p>Der legendäre Soundtrack zum vertikalen Shoot-'em-up-Klassiker <strong>Goldrunner</strong> (1987), programmiert von Steve Bak und Pete Lyon. Die Musik wurde vom C64-Rockgott <strong>Rob Hubbard</strong> höchstpersönlich für den ST arrangiert und basiert auf seinem wegweisenden C64-Track <em>Human Race</em>.</p>
        <p><strong>DSP-Fokus:</strong> Hubbard portierte hier nicht nur Melodien, sondern sein gesamtes technisches Musik-Verständnis auf den ST. Der Track demonstriert, wie man mit einer schnellen, in Assembler handgeschriebenen Sound-Engine dichte, synkopierte Rhythmen und fließende Portamentos (Pitch-Slides) erzeugt. Unser zyklengenauer YM-Mischer löst die rasanten Tonhöhen-Sweeps absolut phasenstarr auf.</p>
    `,
    "XN1.YM": `
        <h3>[ COMPOSER SPOTLIGHT: DAVID WHITTAKER ]</h3>
        <p>Das ikonische Titelthema (Main Title) des wegweisenden Bitmap-Brothers-Shoot-'em-ups <strong>Xenon</strong> (1988), komponiert von <strong>David Whittaker</strong>. Whittaker war einer der produktivsten und genialsten Pioniere der frühen ST- und Amiga-Ära, berühmt für seine pfeilschnellen, hochoptimierten Assembly-Treiber.</p>
        <p><strong>DSP-Fokus:</strong> Whittaker beweist hier seine absolute Beherrschung des YM2149F. Da 1988 komplexe Sample-Hacks noch in den Kinderschuhen steckten, zaubert er aus drei nackten PSG-Rechteckkanälen über präzise, mikro-verzögerte Lautstärke-Hüllkurven (Echo-Effekte auf einer einzigen Stimme) einen unfassbar dichten und treibenden Elektro-Groove.</p>
    `,
    "XN2.YM": `
        <h3>[ COMPOSER SPOTLIGHT: DAVID WHITTAKER ]</h3>
        <p>Die fesselnde In-Game-Musik zu <strong>Xenon</strong> (1988) von David Whittaker. Der Track treibt den Spieler mit seinen unbarmherzigen, techno-artigen Sequenzen durch die vertikal scrollenden Sektoren.</p>
        <p><strong>DSP-Fokus:</strong> Whittaker nutzt hier extrem schnelle Software-LFOs für schwebende Pitch-Modulationen. Jede Register-Frequenzänderung wird von unserem cycle-genauen Emulator absolut phasenstarr aufgelöst, was den markanten, schneidenden und kristallklaren Charakter der Whittaker-Leads perfekt bewahrt.</p>
    `,
    "XN3.YM": `
        <h3>[ COMPOSER SPOTLIGHT: DAVID WHITTAKER ]</h3>
        <p>Das triumphale <strong>Highscore-/End-Thema (Game Over Tune)</strong> von <strong>Xenon</strong> (1988), komponiert von David Whittaker. Ein klassischer, erhabener Abschieds-Track für furchtlose ST-Sternenpiloten.</p>
        <p><strong>DSP-Fokus:</strong> Der Track demonstriert Whittakers meisterhaften Einsatz der Hardware-Hüllkurve (HEG) des YM2149. Durch das extrem präzise Triggern von Register 13 im VBLANK-Takt erzeugt er einen voluminösen Bass-Effekt, der wie eine analoge Sägezahnwelle schwingt und dem Stück ein gewaltiges Fundament verleiht.</p>
    `,
    "LethalXcess1.YM": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p>Das epische Titelthema (Main Title) von <strong>Lethal Xcess: Wings of Death II</strong> (1991), komponiert von Jochen Hippel (Mad Max). Dieses vertikale Thalion-Shoot-'em-up ist der direkte, wegweisende Nachfolger von <em>Wings of Death</em>.</p>
        <p><strong>DSP-Fokus:</strong> Hippel nutzt hier seine absolute Peak-Erfahrung der späten ST-Ära. Der Track brilliert durch meisterhaft modulierte 4-Bit-PCM Digidrums und unglaublich dichte, schwebende Arpeggio-Kaskaden, die das absolute Maximum aus den Registern des YM2149F herausholen.</p>
    `,
    "LethalXcess2.YM": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p>Die fesselnde Begleitmusik zu <strong>Level 1: Ruins of Methallycha</strong> aus <em>Lethal Xcess</em> (1991). Jochen Hippel inszeniert hier ein treibendes Chiptune-Epos, das perfekt zum hektischen Geschehen auf dem Bildschirm passt.</p>
        <p><strong>DSP-Fokus:</strong> Hippel umgeht die starre Dreistimmigkeit des YM-Chips durch extrem schnellen Registerwechsel und den meisterhaften Einsatz des <strong>Buzzer-Effekts</strong> über den Hardware-Envelope (Register 13), was dem Bass eine phänomenale Wärme und Breite verleiht.</p>
    `,
    "LethalXcess3.YM": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p>Die atmosphärische Begleitmusik zu <strong>Level 2: Desert of no Return</strong> aus <em>Lethal Xcess</em> (1991) von Jochen Hippel. Ein hervorragendes Beispiel für mystisch-schwebendes Melodie-Wobbeln auf dem Atari ST.</p>
        <p><strong>DSP-Fokus:</strong> Der Track glänzt durch feine, pulsweitenmodulierte Sequenzen. Da unser Emulator die 2-MHz-Ebene phasenstarr auflöst, schwingen diese sachte gleitenden Tonhöhen-Modulationen vollkommen frei von digitalem Zittern oder Phasen-Glitchings.</p>
    `,
    "LethalXcess4.YM": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p>Das melodische Thema zu <strong>Level 3: The evil Garden</strong> aus <em>Lethal Xcess</em> (1991), komponiert von Jochen Hippel. Der Track verbindet heroische Leads mit dichten, komplexen Bass-Rhythmen.</p>
        <p><strong>DSP-Fokus:</strong> Hippel nutzt hier im VBLANK-Takt synchronisierte Pitch-Slides. Jedes Mal, wenn die Melodiestimme eine neue Note triggert, blitzt ein kurzes, registergesteuertes Signalpaket auf unserem Silicon-Analyzer auf und spiegelt das exakte Timing der 68000er CPU wider.</p>
    `,
    "LethalXcess5.YM": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p>Das epische Thema zu <strong>Level 4: Vulcanic Plateaus</strong> aus <em>Lethal Xcess</em> (1991) von Jochen Hippel. Ein rasanter Track, der perfekt die flirrende, kochende Hitze feuriger Welten inszeniert.</p>
        <p><strong>DSP-Fokus:</strong> Das absolute Highlight sind die dichten, rauen 4-Bit-Digidrums. Die virtuell in die YM-Lautstärkeregister injizierten PCM-Drums erzeugen genau jenen unnachahmlichen ST-Crunch, der den Soundtracks von Mad Max ihre legendäre Wucht und Durchsetzungskraft verlieh.</p>
    `,
    "LethalXcess6.YM": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p>Das dramatische Thema zu <strong>Level 5: Fortress of Methallycha</strong> aus <em>Lethal Xcess</em> (1991). Jochen Hippel inszeniert hier die unerbittliche, mechanische Kälte der finalen Festung.</p>
        <p><strong>DSP-Fokus:</strong> Der Track koppelt das "Weiße Rauschen" (Noise) extrem dicht mit den Bass-Oszillatoren, um metallisch klirrende, synthetische Snare-Hacks zu simulieren. Unser 17-Bit-LFSR-Rauschgenerator auf 2-MHz-Ebene fängt diesen rohen, atonale Klangcharakter perfekt ein.</p>
    `,
    "LethalXcess7.YM": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p>Das glorreiche, melancholische <strong>End-Thema (Credits/End Tune)</strong> von <em>Lethal Xcess</em> (1991) von Jochen Hippel (Mad Max). Ein triumphaler Abschieds-Track für alle furchtlosen ST-Piloten, die das Spiel gemeistert haben.</p>
        <p><strong>DSP-Fokus:</strong> Der Track glänzt durch seine breiten, orchestralen Akkord-Pads und schwebenden Ausklingphasen. Dank der Dynamic-Staging-Weiche unseres Emulators wandern die Stereo-Pan-Werte und der Nachhall fließend im Raum umher und verleihen dem Chiptune eine beispiellose, cineastische Tiefe.</p>
    `,
    "WINGLOAD.YM": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p>Das Titelthema (Loader) des bahnbrechenden Shoot-'em-ups <strong>Wings of Death</strong> (1990) von Thalion ist ein unumstrittenes Meisterwerk der 16-Bit-Chiptune-Geschichte. Komponist Jochen Hippel trieb den YM2149F hier an seine absoluten physikalischen Grenzen.</p>
        <p><strong>DSP-Fokus:</strong> Da der Atari ST keinen eingebauten D/A-Wandler für PCM-Samples besaß, hängte Hippel hochfrequente CPU-Interrupts (Timer-B) ein, um im Millisekundentakt das 4-Bit-Lautstärkeregister des Chips zu überschreiben (der berühmte "YM-Sample-Hack"). Die so injizierten Digidrums verleihen dem treibenden Synth-Rock-Track seinen unfassbar rohen, verzerrten 4-Bit-Grit, den unser cycle-genauer Atari-Mischer originalgetreu wiedergibt.</p>
    `,
    "WINGLEV1.YM": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p>Das Titelthema für <strong>Level 1: Over the Trees</strong> aus <em>Wings of Death</em> (Atari ST, 1990). Jochen Hippel inszeniert hier eine dichte, treibende Melodieführung, die perfekt zum rasanten Fullscreen-Scrolling passt.</p>
        <p><strong>DSP-Fokus:</strong> Achte auf die extrem tighten <strong>Buzzer-Bässe</strong>. Durch das rasant schnelle Beschreiben des Hardware-Envelopes (HEG Shape, Register 13) direkt über den VBLANK-Interrupt erzeugt Hippel einen fülligen, schwebenden Sägezahn-Effekt, der die nackte Dreistimmigkeit des PSG-Chips vergessen lässt.</p>
    `,
    "EnchantedLands_Intro.YM": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p>Das Intro-Thema des Thalion-Plattformers <strong>Enchanted Land</strong> (1990) von Jochen Hippel (Mad Max) ist ein Meisterwerk der melodischen YM2149-Synthese. Das Spiel selbst wurde von der legendären Demogruppe <strong>The Carebears (TCB)</strong> programmiert und setzte neue Maßstäbe für flüssiges ST-Fullscreen-Scrolling.</p>
        <p><strong>DSP-Fokus:</strong> Hippel nutzt hier ausgefeilte Software-LFO-Modulationen und synchronisierte Pitch-Slides auf dem Yamaha-Chip. Da das Spiel von den talentiertesten Coder-Cracks der schwedischen Szene geschrieben wurde, durfte der Sound absolut keine CPU-Ressourcen verschwenden – und klingt dank Hippels genialer Register-Ökonomie dennoch wie ein orchestrales Synth-Gewitter.</p>
    `,
    "thalion_loader.YM": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (MAD MAX) ]</h3>
        <p><strong>Jochen Hippel</strong> (Mad Max) von der Demogruppe <em>The Carebears</em> ist der unumstrittene Meister des Yamaha YM2149. Während die meisten Musiker den Chip für seine starren Rechteckwellen hassten, bog Hippel ihn durch brachiale CPU-Programmierung nach seinem Willen.</p>
        <p><strong>DSP-Fokus:</strong> Der <em>Thalion Loader</em> demonstriert die berühmten "Hippel-Arpeggios". Statt einfache Noten zu spielen, feuert die CPU über Timer-Interrupts winzige 5-Bit-Hardware-Envelopes ab. Unser 2MHz Lockstep-Core berechnet dieses "Zipper-Noise" exakt auf dem Hardware-Divider, was dem Track sein legendäres, kratziges Schimmern verleiht.</p>
    `,
    "SyntaxTerror.YM": `
        <h3>[ COMPOSER SPOTLIGHT: BIG ALEC (DELTA FORCE) ]</h3>
        <p><strong>Big Alec</strong> pfeift auf sanfte Emulationen. Er umarmte den rohen, aggressiven Charakter des Atari ST. Sein Track zur wegweisenden <em>Syntax Terror</em> Megademo ist eine Masterclass in treibendem Chiptune-Minimalismus.</p>
        <p><strong>DSP-Fokus:</strong> Achte auf die extrem tiefen, unaufhaltsamen Basslines. Big Alec kombiniert hier nackte, drückende Rechteckwellen mit rasanten Oktav-Sprüngen im 50Hz-Raster. Dank unseres Sinc-FIR Anti-Aliasing-Filters bleibt der Bassdruck selbst bei höchsten Amplituden vollkommen frei von digitalem Klirren.</p>
    `,
    "UnionDemo_Mega_Apocalypse.YM": `
        <h3>[ COMPOSER SPOTLIGHT: ROB HUBBARD / MAD MAX ]</h3>
        <p>Für die legendäre <em>The Union Demo</em> portierte Jochen Hippel die größten C64-Klassiker auf den Atari ST. Rob Hubbards <em>Mega Apocalypse</em> auf einem Chip zum Laufen zu bringen, der gar keine eingebauten PCM-Wandler besitzt, war reine Hexerei.</p>
        <p><strong>DSP-Fokus:</strong> Hier spielen die <strong>Digidrums</strong> die Hauptrolle. Der YM-Chip wird über den CPU-Timer Tausende Male pro Sekunde "gehackt", um rohe Audiodaten in das 4-Bit-Lautstärkeregister zu schreiben. Unsere Audio-Engine injiziert diese PCM-Daten physisch in das logarithmische Yamaha DAC-Widerstandsnetzwerk, was den Drums ihren unfassbar brutalen 4-Bit-Grit verleiht.</p>
    `,
    "BIONIC1.YM": `
        <h3>[ COMPOSER SPOTLIGHT: TIM FOLLIN ]</h3>
        <p><strong>Tim Follin</strong> ist ein britischer Programmier-Gott, der die Atari ST Architektur an ihr absolutes Limit trieb. Sein Soundtrack zu <em>Bionic Commando</em> verbrauchte so viel CPU-Zeit, dass das restliche Spiel spürbar ruckelte – aber es klang unglaublich.</p>
        <p><strong>DSP-Fokus:</strong> Follin nutzt hier "Software-Envelopes", die weit jenseits der normalen 50Hz-Bildwiederholrate operieren. Durch verschachtelte Zählerschleifen erzeugt er Phasenverschiebungen und Phasing-Effekte, die auf einem YM-Chip eigentlich physikalisch unmöglich sein sollten.</p>
    `,
    "Dragonflight_City_1.YM": `
        <h3>[ COMPOSER SPOTLIGHT: JOCHEN HIPPEL (HIGH FANTASY) ]</h3>
        <p>Neben harten Demo-Beats konnte <strong>Jochen Hippel</strong> auch epische, orchestrale RPG-Welten auf dem YM2149 erschaffen, wie dieser Track aus dem Thalion-Meisterwerk <em>Dragonflight</em> beweist.</p>
        <p><strong>DSP-Fokus:</strong> Um voluminöse Flöten und Streicher zu simulieren, Hippel koppelte das "Weiße Rauschen" (Noise) des Chips extrem subtil mit den regulären Tönen. In unserem Core wird das Noise-LFSR mit exakt 17 Bit auf der 2-MHz-Ebene geschoben, wodurch das Rauschen seinen charakteristischen "hölzernen", fast schon atonalen Atari-Charakter erhält.</p>
    `
};

export const atariPlaylist = myYmFiles.map((filename, index) => {
    const metaInfo = composerMetadata[filename] || `
        <h3>[ CLASSIC ATARI ST YM2149F ]</h3>
        <p>Ein historischer YM-Register-Dump (YM5/YM6). Dieses Format enthält die rohen Hardware-Befehle, die ursprünglich 50-mal pro Sekunde an den Soundchip geschickt wurden, verarbeitet durch unsere zyklengenaue 2MHz-Emulation.</p>
    `;

    return {
        title: `${index + 1}. LOAD YM: ${filename}`,
        composerInfo: metaInfo,
        generator: function() { return []; },
        loadAsync: async function() {
            return await loadYmFile(`tracks/atari/${filename}`);
        }
    };
});