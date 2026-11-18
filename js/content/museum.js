// ==========================================
// DAS DIGITALE MUSEUM (Texte & Handbücher)
// Mit integrierten Hardware-Spezifikations-Tabellen
// Deep-Dive Edition: Cycle-Exact Silicon Physics
// ==========================================

export const systemDescriptions = {
    c64: `
        <div class="museum-hardware-dossier">
            <!-- === TECHNICAL SPECIFICATION GRID (C64 SID 6581) === -->
            <section class="museum-spec-card" aria-label="Hardware-Spezifikationen Commodore 64 SID">
                <h4 class="museum-spec-title">&gt;&gt;&gt; HARDWARE SPECIFICATIONS</h4>
                <dl class="museum-spec-grid">
                    <dt>Synthesizer:</dt><dd>MOS Technology 6581 R3 (12V NMOS) · Nachfolger: 8580 (9V HMOS-II)</dd>
                    <dt>Kanäle:</dt><dd>3 unabhängige Stimmen + 1 routbares 12dB/Okt Multimode-VCF</dd>
                    <dt>Taktfrequenz:</dt><dd>985.248 Hz (PAL) / Cycle-Exact Lockstep mit MOS 6510 CPU (6502-Kern)</dd>
                    <dt>D/A-Wandlung:</dt><dd>Nicht-lineare R-2R Leitern + 255-Tap Sinc-FIR Decimator (20kHz Brickwall)</dd>
                    <dt>Analog-Filter:</dt><dd>2MHz Zero-Delay Feedback (ZDF) OTA-Solver (30Hz–6.2kHz R3 S-Kurve; extern 470pF)</dd>
                    <dt>Wellenformen:</dt><dd>Dreieck, Sägezahn, 12-Bit PWM, 23-Bit LFSR Noise, NMOS Wire-AND Kombinationen</dd>
                    <dt>Hüllkurven:</dt><dd>3 x ADSR (15-Bit Rate-Counter mit hardwaregetreuen Ladekonstanten)</dd>
                    <dt>Digidrums:</dt><dd>4-Bit $D418 VCA-Modulation via PlaySID Traps (3.6x Paula-Teiler) o. CIA/NMI</dd>
                    <dt>Extra-I/O:</dt><dd>2 × 8-Bit Paddle-ADCs ($D419/$D41A) · OSC3/ENV3-Readback ($D41B/$D41C)</dd>
                </dl>
            </section>

            <article class="museum-essay">
                <h3>[ DEEP DIVE: MOS TECHNOLOGY SID 6581 ]</h3>
                <p>Der Sound Interface Device (SID), 1981 von Robert „Bob“ Yannes entworfen, ist ein vollwertiger analoger subtraktiver Synthesizer auf einem einzigen Silizium-Chip. Er besitzt 3 Oszillatoren mit synchronisierten Phasen-Akkumulatoren, individuelle ADSR-Generatoren, programmierbare Ringmodulation und ein echtes analoges Multimode-Filter.</p>

                <h4>&gt; HISTORIE: DER 24-JÄHRIGE REBELL &amp; DAS 5-MONATS-ULTIMATUM</h4>
                <p>In der zweiten Hälfte des Jahres 1981 stand der erst 24-jährige Robert „Bob“ Yannes vor einer schier unmöglichen Aufgabe. Commodore-Gründer Jack Tramiel gab der Halbleiter-Sparte MOS Technology ein knallhartes Ultimatum: Der Sound- und Grafikchip für das geplante „Project Red“ (den späteren Commodore 64) musste in genau <strong>fünf Monaten</strong> fertig sein. Mit einem winzigen Team – im Kern Yannes selbst, zwei Techniker und ein CAD-Operator – verabscheute er die damals typischen simplen Pieps-Generatoren der Spielhallen-Ära.</p>
                <p>Statt eines gewöhnlichen Programmierbaren Soundgenerators baute er das Silizium nach dem Vorbild großer Analog-Synthesizer: drei physisch getrennte Stimmen, ADSR-Hüllkurven und ein echtes analoges Multimode-Filter. Nur rund drei Viertel seiner Ideen passten unter dem Zeitdruck auf den Die (am Filter fehlte am Ende die Zeit für volle Feinkalibrierung). 1983 verließ Yannes Commodore gemeinsam mit VIC-II-Entwickler Al Charpentier und gründete die legendäre Synthesizer-Schmiede <strong>Ensoniq</strong> (Mirage-Sampler, ESQ-1).</p>

                <h3>[ HARDWARE-ARCHITEKTUR &amp; DIE FUNKTIONSBLÖCKE ]</h3>
                <p>Der MOS 6581 ist ein echtes Hybrid-IC aus digitaler Logik und analogen Schaltkreisen in 28-Pin-DIP-Bauform. Seine innere Struktur unterteilt sich in hochpräzise Funktionsblöcke, die flexibel miteinander verschaltet werden können:</p>

                <h4>&gt; DIE STIMMEN-ARCHITEKTUR, PADDLE-ADCS &amp; ZUFALLSGENERATOR</h4>
                <p>Jede der drei Stimmen besitzt einen vollkommen eigenständigen Signalpfad aus 24-Bit-Oszillator, 15-Bit-ADSR-Hüllkurve und Wellenform-Mischer. Erst am Ende des Pfads entscheidet die Filter-Routing-Matrix (Register <code>$D417</code>), ob das Signal in das gemeinsame analoge Filter gespeist oder ungefiltert direkt zum VCA-Ausgang geschickt wird. Weniger bekannt sind die „Nebenjobs“ im selben Gehäuse: Pins 23 und 24 (<code>POTX</code>/<code>POTY</code>, Register <code>$D419/$D41A</code>) enthalten zwei 8-Bit-A/D-Wandler für Paddles und die Commodore-1351-Maus – und über <code>$D41B/$D41C</code> lassen sich Oszillator und Hüllkurve von Stimme 3 direkt zurücklesen, weshalb unzählige C64-Spiele eine stummgeschaltete Rausch-Stimme 3 als extrem schnellen Hardware-Zufallszahlengenerator nutzen!</p>

                <h4>&gt; DIE WELLENFORMEN &amp; DIE PWM-STEUERUNG</h4>
                <p>Jeder Oszillator-Kern verfügt über einen 24-Bit-Phasenakkumulator, der bei der PAL-Taktfrequenz von 985.248 Hz eine Frequenzauflösung von winzigen 0,058 Hz ermöglicht. Der Kern generiert vier klassische Wellenformen parallel:</p>
                <ul>
                    <li><strong>Dreieck (Triangle):</strong> Sehr grundtonstark, weich, perfekt für Flöten und sanfte Leads.</li>
                    <li><strong>Sägezahn (Sawtooth):</strong> Obertonreich, aggressiv, das Fundament für fette Bässe und Brass-Klänge.</li>
                    <li><strong>Rechteck (Pulse):</strong> Bietet eine hochauflösende, programmierbare 12-Bit Pulsbreite (PWM) von 0 % bis 100 %. Durch die kontinuierliche Modulation der Pulsbreite (z. B. via Software-LFOs) entsteht der berühmte, schwebende Chorus-Effekt des SID.</li>
                    <li><strong>Rauschen (Noise):</strong> Erzeugt durch ein 23-Bit-LFSR, das an festverdrahteten Taps abgegriffen wird (ideal für Snares, Explosions-Effekte und Hi-Hats). Vorsicht vor der berüchtigten „Noise-Lockup“-Macke: Kombiniert man Noise auf echter Hardware gleichzeitig mit anderen Wellenformen, ziehen Pull-Downs das Schieberegister mitunter auf lauter Nullen fest, bis das <code>TEST</code>-Bit (Bit 3) es wieder löst.</li>
                </ul>

                <h4>&gt; DIE KREUZMODULATIONS-MATRIX (HARD-SYNC &amp; RINGMODULATION)</h4>
                <p>Der SID erlaubt es, die Stimmen ringförmig miteinander zu koppeln (Stimme 1 moduliert Stimme 3, Stimme 2 moduliert Stimme 1, Stimme 3 moduliert Stimme 2):</p>
                <ul>
                    <li><strong>Hard-Sync (Register Bit 1):</strong> Erzwingt, dass die Phase des Oszillators augenblicklich auf 0 zurückgesetzt wird, sobald der modulierende Nachbar-Oszillator sein höchstes Bit (MSB) umschaltet. Verschiebt man die Frequenz des synchronisierten Oszillators per Software-Sweep, entsteht der kreischende, obertonreiche „Sync-Lead“-Sound (bekannt aus Hubbards <em>Commando</em>).</li>
                    <li><strong>Ring-Modulation (Register Bit 2):</strong> Multipliziert das MSB der Dreieckswelle mit dem MSB des modulierenden Nachbarchips (logische XOR-Kopplung). Das erzeugt unharmonische, metallische Frequenzen – das Geheimnis hinter Hülsbecks Glocken- und Rhodes-Klängen in <em>The Great Giana Sisters</em>.</li>
                </ul>

                <h4>&gt; DAS ANALOGE MULTIMODE-FILTER (6581 VS. 8580)</h4>
                <p>Das Herzstück des analogen SID-Klangs ist sein programmierbares 12dB/Oktave State-Variable-Filter, das über zwei externe Polystyrol-Kondensatoren an Pins 1–4 arbeitet (<strong>470 pF</strong> auf regulären 6581-Boards, auf ganz frühen Rev.-326298-Boards sogar <strong>2200 pF</strong>). Es bietet vier routbare Charakteristiken: Tiefpass (LP), Bandpass (BP), Hochpass (HP) und Notch. Die Grenzfrequenz ist mit 11-Bit Auflösung steuerbar, und die Resonanz lässt sich in 15 Stufen regeln. Unsere Engine berechnet dieses Filter über einen <strong>2MHz Zero-Delay Feedback (ZDF) Trapezoidal-Integrator</strong>, der selbst bei extremer Maximal-Resonanz (<code>R=15</code>) phasenstarr schwingt. Im späteren flachen C64C ersetzte Commodore den 12V-NMOS-6581 durch den saubereren 9V-HMOS-II-<strong>8580</strong> (mit 22nF-Kondensatoren): extrem präzise Filter, aber ohne das schmutzige Brummen und den lauten <code>$D418</code>-DC-Klick – weshalb alte Digis auf einem unmodifizierten 8580 ohne den bekannten „DigiBoost“-Widerstand an Pin 26 (<code>EXT IN</code>) fast unhörbar bleiben.</p>

                <h3>[ DIE ANOMALIEN: DIE SILIZIUM-GEHEIMNISSE DES 6581 ]</h3>
                <p>Die unerreichte Seele des SID-Klangs liegt in seinen physikalischen Unvollkommenheiten – kein 6581 klingt durch Wafer-Streuungen exakt wie sein Nachbar. Unser Emulator bildet die parasitären Kapazitäten und Halbleiter-Macken bitgenau ab:</p>

                <h4>&gt; 255-TAP SINC-FIR DECIMATOR (ZERO ALIASING BEI 1 MHz)</h4>
                <p>Ein echter SID läuft mit 985.248 Hz. Die harten Kanten von Rechteckwellen und <code>$D418</code>-Drums erzeugen theoretisch unendlich hohe Spiegelfrequenzen jenseits der Hörgrenze. Herkömmliche Emulatoren mitteln Zyklen oft nur simpel („Box-Filter“), was zu schrillem Aliasing-Klirren führt. Unser Core sammelt die 1-MHz-Samples in einem <strong>512-Element Ringpuffer</strong> und faltet sie über einen <strong>255-Tap Blackman-windowed Sinc-FIR Filter</strong> aliasing-frei auf 48 kHz herunter (&gt; 75 dB Sperrdämpfung bei 20 kHz).</p>

                <h4>&gt; SUB-CYCLE WRITE PIPELINING &amp; VIC-II BAD LINES (6510 BUS-TIMING)</h4>
                <p>Ein Befehl wie <code>STA $D418</code> benötigt auf der 6510-CPU 4 Zyklen. Das Datum schlägt jedoch erst auf dem <strong>allerletzten Takt (Zyklus 4)</strong> physisch auf den SID-Bus durch! Zudem teilt sich die CPU den Bus mit dem Grafikchip VIC-II, der alle acht Rasterzeilen in einer „Bad Line“ die CPU über <code>AEC/BA</code> für 40–43 Zyklen anhält. Unser CPU-Emulator puffert Schreibzugriffe (Staging) und committet sie exakt im letzten Instruktionstakt – das eliminiert jeglichen Sub-Instruction-Jitter bei rasanten Galway-Digidrums und Arpeggios.</p>

                <h4>&gt; DER 3.6× PLAYSID AMIGA-PAULA TRAP-TEILER (GIANA SISTERS FIX)</h4>
                <p>Als Per Håkan Sundell 1990 den ersten <em>PlaySID</em>-Player für den Amiga erfand, bauten Ripper die C64-Sample-Routinen so um, dass Periodenwerte direkt in Amiga-Paula-Zyklen (3,55 MHz) in <code>$D45D/$D45E</code> geschrieben wurden (z. B. Periode 907 für Bassdrums). Da der C64 mit 985 kHz exakt <strong>3,6-mal langsamer</strong> taktet, erkennt unsere Engine Amiga-Paula-Werte (&ge; 280) automatisch und rechnet sie via <code>Period / 3.6</code> auf 252 C64-Zyklen (3,91 kHz) um. Gekoppelt mit der <strong>Big-Endian High-Nibble-Zuerst-Dekodierung</strong> klingen die Drums in <em>The Great Giana Sisters</em> knackig, druckvoll und phasenrein.</p>

                <h4>&gt; VOICE 3 DC-LEAKAGE BEI STUMMSCHALTUNG ($D418 BIT 7 „3OFF“)</h4>
                <p>Wird Stimme 3 über Bit 7 in <code>$D418</code> stummgeschaltet, trennt die Hardware nur das AC-Wellenformsignal ab. Der <strong>Gleichspannungs-Arbeitspunkt des D/A-Wandlers leckt weiterhin ungehindert in den VCA-Summenbus</strong>. Coder wie Martin Galway (in <em>Arkanoid</em> und <em>Wizball</em>) nutzten genau dieses Leck – zusammen mit dem hohen DC-Offset des 6581 –, um druckvolle 4-Bit-Samples über den Master-Volume-Multiplizierer abzufeuern, während Stimme 3 scheinbar „stumm“ war.</p>

                <h4>&gt; ILLEGALE WELLENFORMEN &amp; WIRE-AND PULL-DOWN ($50 ENGELSSTIMME)</h4>
                <p>Werden mehrere Wellenformen (z. B. Dreieck + Puls = <code>$50</code> oder Sägezahn + Puls = <code>$60</code>) kombiniert, entsteht im 6581 ein physischer Kurzschluss auf dem Bit-Bus. Der Pull-Down-Transistor der Pulswelle zieht das Signal auf Masse, aber durch den Innenwiderstand des Dreiecks-DACs sickert ein charakteristisches Teilsignal durch. Unsere <code>WAVE_LUT_TRIPULSE</code> bildet diesen Innenwiderstand exakt ab – das Geheimnis hinter Hülsbecks perlender „Engelsstimme“.</p>

                <h4>&gt; WIZBALL-STABILE 6581 R3 S-KURVE (30 Hz BIS 6.200 Hz)</h4>
                <p>Ein echter MOS 6581 R3 besitzt keine lineare Filterkurve bis 16 kHz, sondern eine stark nicht-lineare, asymmetrische S-Kurve durch seine internen FET-Widerstände mit einer Obergrenze von ca. 6,2 kHz. Durch die Begrenzung auf diesen authentischen Frequenzbereich und symmetrisches JFET-Resonance-Quenching in der ZDF-Schleife meistert unser Core extreme <code>R=15</code>-Sweeps (<em>Wizball Title</em>) absolut klangtreu und ohne Resonanz-Kippen.</p>

                <h4>&gt; FLOATING DAC DISCHARGE (DIE WEICHEN GALWAY-FADES)</h4>
                <p>Setzt man das Wellenform-Register auf <code>$00</code>, trennt die Hardware den D/A-Wandler von den Oszillatoren. Doch die parasitäre Gate-Kapazität (C<sub>gate</sub> &approx; 0,8 pF) speichert die letzte Ladung! Das Audiosignal „blutet“ über ca. 15 Millisekunden weich auf einen schwebenden Ruhepegel (DC-Bias <code>$18</code>) aus. Dieser Hardware-Effekt erzeugt die berühmten, organisch fließenden Übergänge in Hubbards und Galways Soli.</p>

                <h4>&gt; THERMAL DRIFT &amp; DER TEMP-REGLER</h4>
                <p>Der analoge 6581-Filter besaß keinerlei Temperaturkompensation. Wenn sich der Rechner unter der Tastatur im Betrieb erwärmte (50 °C bis 75 °C), sank der Widerstand der FET-Transistoren, wodurch die Filter-Grenzfrequenz sachte abrutschte und Bässe weicher sättigten. Über unseren <em>TEMP</em>-Fader lässt sich genau dieses analoge Verhalten in Echtzeit modulieren.</p>
            </article>
        </div>
    `,
    amiga: `
        <div class="museum-hardware-dossier">
            <!-- === TECHNICAL SPECIFICATION GRID (AMIGA MOS PAULA 8364) === -->
            <section class="museum-spec-card" aria-label="Hardware-Spezifikationen Amiga Paula">
                <h4 class="museum-spec-title">&gt;&gt;&gt; HARDWARE SPECIFICATIONS</h4>
                <dl class="museum-spec-grid">
                    <dt>Kanäle:</dt><dd>4 × 8-Bit-DMA-PCM-Kanäle (L-R-R-L Hard-Panning mit ~3,5 % Crosstalk)</dd>
                    <dt>Taktfrequenz:</dt><dd>3.546.895 Hz (PAL Color-Clock) / Internes 4× Oversampling (192 kHz)</dd>
                    <dt>DMA-Grenze:</dt><dd>Min. Periode 124 NTSC / 123 PAL (&approx; 28,87 kHz im TV-Modus; ~57 kHz in ECS/AGA-VGA)</dd>
                    <dt>D/A-Wandlung:</dt><dd>Zero-Order Hold (ZOH) ohne Interpolation + Sinc-FIR Decimator</dd>
                    <dt>Audioauflösung:</dt><dd>8-Bit Sample × 6-Bit Volume (0–64) = 14-Bit Multiplying DAC (MDAC)</dd>
                    <dt>Analog-Filter:</dt><dd>6dB/Okt statischer RC-Lowpass (~4,42 kHz) + 12dB/Okt LED-Butterworth (~3,09 kHz)</dd>
                    <dt>Nebenfunktionen:</dt><dd>Floppy-Controller, serielle UART, Interrupts (INTENA/INTREQ) &amp; Analog-Joysticks</dd>
                    <dt>Sequenzierung:</dt><dd>ProTracker (MOD), Hippel-COSO oder FastTracker (XM) via CIA-Timer</dd>
                </dl>
            </section>

            <article class="museum-essay">
                <h3>[ DEEP DIVE: MOS TECHNOLOGY PAULA 8364 ]</h3>
                <p>Paula war das Herzstück des Amiga-Audiosystems und einer der fortschrittlichsten Soundchips seiner Epoche. Während die Konkurrenz noch Rechtecktöne synthetisierte oder die CPU mit Timer-Interrupts quälte, brachte Paula 1985 echten Direct Memory Access (DMA) PCM-Stereo-Sound fast ohne CPU-Last in die Wohnzimmer.</p>

                <h4>&gt; HISTORIE: TARNCODES, 300-WATT-BREADBOARDS &amp; GLENN KELLERS ERSTER CHIP</h4>
                <p>In der frühen Entwicklungsphase der Amiga-„Lorraine“-Prototypen (1983) vergab Jay Miners Hardware-Crew allen Custom-Chips bewusst unverdächtige Frauennamen (<em>Agnus, Daphne/Denise, Portia/Paula</em>), damit bei möglichen Telefon-Abhöraktionen im Silicon Valley niemand merkte, dass hier Computer-Silizium entstand. Der spätere Name <strong>Paula</strong> stand offiziell für <strong>P</strong>orts, <strong>A</strong>udio, <strong>U</strong>ART und <strong>L</strong>ogic – und laut Überlieferung nebenbei für die Freundin ihres Erfinders. Entwickelt wurde sie vom jungen Ingenieur <strong>Glenn Keller</strong> unter der Mentorschaft von Jay Miner.</p>
                <p>Das Erstaunliche: Paula war Glenn Kellers <strong>allererstes Chip-Design überhaupt</strong>! Vor der Fertigung im Silizium musste er sie im Prototypen aus rund 250 einzelnen Standard-TTL-Chips auf riesigen „Labdec“-Steckplatinen zusammenbauen, die zusammen über 300 Watt Abwärme schluckten. Und als das finale 48-Pin-DIP-IC <code>MOS 8364</code> endlich lief, war es so zeitlos gut geraten, dass es über alle drei Amiga-Generationen (<strong>OCS, ECS und AGA</strong> – vom A1000 und A500 bis zu A1200 und A4000, 1985–1994+) funktional <strong>völlig unverändert</strong> blieb, während Agnus zu Alice und Denise zu Lisa wuchsen.</p>

                <h3>[ CHIP-SPECS: EMULIERTE HARDWARE-KOMPONENTEN &amp; TRICKS ]</h3>
                <p>Um den typischen, druckvollen „Amiga 500 Sound“ exakt nachzubilden, bricht unser <em>Exact-Core</em> mit modernen Konventionen und emuliert die physikalischen Grenzen und Besonderheiten des Chips:</p>

                <h4>&gt; AGNUS-DMAL-KOPPLUNG &amp; DER GEHEIME 56-kHz-VGA-TRICK</h4>
                <p>Paula besitzt keinen eigenen Bus-Master: Pro Video-Rasterzeile (15,625 kHz im PAL-TV-Modus) weist Grafik-/DMA-Chip <em>Agnus</em> jedem der vier Audiokanäle über die serielle <code>DMAL</code>-Leitung genau einen 16-Bit-Word-Slot (2 Samples) im Chip-RAM zu. Daraus ergibt sich das im Handbuch berühmte Limit: die kleinste sichere Periodenzahl <strong>124 (123 PAL)</strong> bzw. maximal <strong>~28,87 kHz</strong> Abtastrate. Wenige wissen: Weil die Slots strikt an die horizontale Zeilenfrequenz gekoppelt sind, verdoppelt sich Paulas DMA-Bandbreite im 31-kHz-VGA-Modus auf ECS-/AGA-Amigas auf rund <strong>57 kHz</strong>!</p>

                <h4>&gt; ZERO-ORDER HOLD (ZOH) &amp; 4× OVERSAMPLING</h4>
                <p>Paula kennt keine lineare Interpolation. Ein über DMA ausgelesener 8-Bit-Wert im Zweierkomplement wird als analoge Spannung exakt so lange gehalten (Zero-Order Hold), bis der nächste Perioden-Countdown auf 0 fällt. Diese eckigen Treppenstufen erzeugen charakteristische Obertöne im Ultraschallbereich – den berühmten perlenden <strong>Amiga-Schimmer</strong>. Normale Tracker falten diese Frequenzen als klirrendes Aliasing zurück. Unser Core taktet die D/A-Wandlung deshalb mit <strong>192 kHz (4× Oversampling)</strong>, jagt die ZOH-Treppen durch die echten analogen Filter-Gleichungen und dezimiert sie danach mit einem 255-Tap Sinc-FIR Filter sauber auf 48 kHz.</p>

                <h4>&gt; L-R-R-L HARD-PANNING, 14-BIT-TRICK &amp; VERGESSENE HARDWARE-AM/FM</h4>
                <p>Der Amiga besitzt keinen Panning-Mixer: Kanäle 0 und 3 hängen fest auf dem linken Cinch-Ausgang, 1 und 2 auf dem rechten – getrennt nur durch ca. 3,5 % induktives Platinen-Übersprechen (Crosstalk). Genau diese Trennung gab dem A500 seine breite Klangbühne. Noch verrückter waren die zwei „versteckten“ Fähigkeiten im Chip:</p>
                <ul>
                    <li><strong>14-Bit-Audio-Trick:</strong> Da jeder Kanal einen 8-Bit-Samplewert mit einer 6-Bit-Lautstärke (0–64) im MDAC multipliziert, koppelten clevere Programmierer (etwa in <em>Symphonie</em> oder <em>AHI</em>) zwei Kanäle derselben Stereoseite: Der erste spielte die oberen 8 Bit mit voller Lautstärke <code>64</code>, der zweite die unteren 6 Bit mit Lautstärke <code>1</code> (1/64 Pegel) – rechnerisch bis zu 14 Bit Auflösung!</li>
                    <li><strong>Vergessene AM/FM-Modulation (<code>ADKCON</code>):</strong> Über das Kontrollregister <code>ADKCON</code> kann ein Paula-Kanal seinen Nachbarkanal direkt in Hardware in Lautstärke (AM) oder Periodenlänge/Tonhöhe (FM) modulieren – ein verkapptes Synthesizer-Feature, das kommerzielle Tracker praktisch nie anrührten.</li>
                </ul>

                <h4>&gt; DMA WORD ALIGNMENT</h4>
                <p>Paula greift über Agnus immer im 16-Bit-Raster (Words = 2 Bytes) auf das Chip-RAM zu. Moderne PC-Tracker erlauben oft ungerade Loop-Marker oder Sample-Offsets. Unsere Engine zwingt alle Speicher-Pointer physikalisch korrekt per Bitmaske (<code>&amp; ~1</code>) auf gerade Adressen, damit Loops wie am echten Amiga einrasten.</p>

                <h4>&gt; DIE ANALOGEN FILTER-STUFEN &amp; DIE POWER-LED ($BFE001)</h4>
                <p>Nach den 14-Bit-MDACs durchläuft das Stereosignal auf dem A500-Mainboard zwei analoge Stufen:<br>
                1. Einen permanenten <strong>RC-Tiefpass (6 dB/Okt)</strong> bei ca. 4,42 kHz, der hochfrequente ZOH-Treppen sachte glättet.<br>
                2. Ein zuschaltbares <strong>12-dB/Okt-Butterworth-Filter</strong> bei ca. 3,09 kHz (auf frühen A1000-Boards noch fehlend), das aus Spargründen dieselbe Steuerleitung wie die Gehäuse-<strong>Power-LED</strong> teilt (CIA-A Port A, Register <code>$BFE001</code> Bit 1)! Per <code>E01</code> (Filter aus / LED gedimmt) oder <code>E00</code> (Filter an / LED hell) schalteten ProTracker-Musiker buchstäblich das Lämpchen am Gehäuse, um ihren Samples entweder seidige Wärme oder kristallklare Höhen zu geben.</p>
            </article>
        </div>
    `,
    atari: `
        <div class="museum-hardware-dossier">
            <!-- === TECHNICAL SPECIFICATION GRID (ATARI YM2149F) === -->
            <section class="museum-spec-card" aria-label="Hardware-Spezifikationen Atari ST YM2149F">
                <h4 class="museum-spec-title">&gt;&gt;&gt; HARDWARE SPECIFICATIONS</h4>
                <dl class="museum-spec-grid">
                    <dt>Kanäle:</dt><dd>3 Oszillatoren (Rechteck, unipolar) + 1 shared 17-Bit LFSR Noise-Generator</dd>
                    <dt>Taktfrequenz:</dt><dd>2.000.000 Hz im zyklischen YM-Modell (Pin 26 /SEL unterstützt auch 4-MHz-Teiler)</dd>
                    <dt>D/A-Modell:</dt><dd>Logarithmisch, 32 diskrete Stufen (Modellwert −1,5 dB pro Stufe)</dd>
                    <dt>Hüllkurve (HEG):</dt><dd>1 globale 5-Bit-Hardware-Envelope (32 Stufen statt 16 beim GI AY-3-8910)</dd>
                    <dt>System-I/O:</dt><dd>Port A (R14: Floppy Drive/Side, RS-232 RTS/DTR, Strobe) · Port B (R15: Centronics D0–D7)</dd>
                    <dt>Ausgabemodell:</dt><dd>Passives 1-k&Omega;-Summennetzwerk (R43–R45) · 15,9 kHz Tiefpass + 25 Hz Hochpass</dd>
                    <dt>Sequenzierung:</dt><dd>50-Hz-YM-Registerframes + YM5!/YM6!-Digidrum-Blöcke via MC68901 MFP-Timer</dd>
                </dl>
            </section>

            <article class="museum-essay">
                <h3>[ DEEP DIVE: YAMAHA YM2149F (ATARI ST) ]</h3>
                <p>Der Yamaha YM2149F war der akustische Herzschlag der 16-Bit-Atari-ST-Serie. Oft fälschlicherweise für einen simplen Klon des General Instrument AY-3-8910 (aus ZX Spectrum 128, Amstrad CPC und MSX) abgetan, barg der lizenzierte Yamaha-Chip entscheidende Verbesserungen – und bildete nebenbei das Rückgrat für zentrale Schnittstellen des Computers.</p>

                <h4>&gt; HISTORIE: SHIRAZ SHIVJIS „RBP“-HACK &amp; DIE RETTUNG DES „JACKINTOSH“</h4>
                <p>Als Jack Tramiel Commodore im Streit verließ und 1984 die Consumer-Sparte von Atari kaufte, beauftragte er seinen genialen Chefdesigner <strong>Shiraz Shivji</strong> (der zuvor am C64 mitgearbeitet hatte), unter dem Codenamen <strong>„RBP“ (Rock Bottom Price)</strong> in kaum mehr als fünf Monaten einen extrem günstigen Macintosh-Rivalen zu bauen. Jedes Bauteil musste auf den Cent genau kalkuliert werden. Während der Konkurrent Amiga auf teure Custom-Sound-DMA setzte, wählte Shivji den spottbilligen Yamaha YM2149F und <strong>missbrauchte dessen zwei freie 8-Bit-I/O-Ports als System-Schnittstellen</strong>.</p>
                <p>Deshalb erledigt der Soundchip im Atari ST weit mehr als nur Pieptöne: Über <strong>Port A (Register 14)</strong> wählt er Diskettenlaufwerk 0/1 und Diskettenseite aus, sendet <code>RTS</code>/<code>DTR</code> an die serielle RS-232-Schnittstelle, feuert den <code>/STROBE</code>-Impuls für den Drucker und steuert den Monitor-Ausgang – während <strong>Port B (Register 15)</strong> direkt alle acht Datenleitungen (<code>D0–D7</code>) des Centronics-Druckerports treibt! (Tastatur und Maus laufen separat über einen Hitachi <code>HD6301V1</code>-Prozessor am <code>MC6850</code> ACIA.) Schrieb eine unsaubere Demo-Routine aus Versehen Müll in <code>R7</code> oder <code>R14</code>, blinkte sofort die Floppy-LED oder das Diskettenlaufwerk reagierte nicht mehr!</p>

                <h4>&gt; YM2149F VS. AY-3-8910: 32-STEP-ENVELOPE &amp; PIN 26 (/SEL)</h4>
                <p>Obwohl der YM2149F pinkompatibel zu GIs AY-3-8910 ist, steckt in Yamahas Silizium ein echtes Upgrade: Neben einem wählbaren internen Taktteiler an <strong>Pin 26 (<code>/SEL</code>)</strong> für bis zu 4 MHz Eingangstakt arbeitet Yamahas Hardware-Hüllkurvengenerator (HEG) mit vollen <strong>5 Bit (32 diskrete Stufen)</strong> bei doppelter Taktrate statt der groben 16 Stufen (4 Bit) des AY-Originals! Die drei Lautstärkeregister (<code>R8–R10</code>) bleiben zwar 4-Bit-breit (0–15, bei uns im digitalen Modell über <code>(Vol * 2) + 1</code> auf die 5-Bit-Kurve mit −1,5 dB/Stufe abgebildet) – schaltet man jedoch per Bit 4 auf die Hardware-Hüllkurve um, laufen alle 32 feinen Sub-Stufen butterweich durch.</p>

                <h3>[ CHIP-SPECS: SCENE-TRICKS &amp; WIE MAN RECHTECKEN SEELE EINHAUCHT ]</h3>
                <p>Der YM2149 kennt im Gegensatz zum SID weder Pulsweitenmodulation noch analoge Filter und im Gegensatz zu Paula keine PCM-Samples. Warum klingen Jochen Hippel, Big Alec oder Scavenger dann oft fast wie ein Synthesizer? Weil der Chip <strong>unipolare Ausgänge</strong> liefert (nur positive Spannungsschritte zwischen 0 und Pegel) und die ST-Demoszene in Kombination mit den Timern des <strong>MC68901 MFP</strong> echte Physik-Hacks ersann:</p>

                <h4>&gt; SYNC-BUZZER VS. SID-VOICE (MFP-TIMER-MAGIE)</h4>
                <ul>
                    <li><strong>Sync-Buzzer (5-Bit-HEG als 4. Oszillator):</strong> Statt der normalen 16-Bit-Tonperioden stellten Musiker die Hüllkurven-Periode (<code>R11/R12</code>) auf extrem hohe Audiofrequenzen und triggerten das Shape-Register (<code>R13</code>) über MFP-Interrupts im Takt nach. So mutierte die 32-stufige Lautstärke-Hüllkurve selbst zu einem knarzenden Sägezahn-/Dreieck-Oszillator – der legendäre brummende „Hippel-Buzzer-Bass“!</li>
                    <li><strong>SID-Voice (Software-PWM):</strong> Um die fehlende Pulsweitenmodulation des C64 nachzuahmen, schaltete ein MFP-Timer den Kanal oder dessen Lautstärke hunderte Male pro Frame hart ein und aus und formte so echte, variierende Rechteck-Tastverhältnisse. Da unsere Engine im <strong>2.000.000-Hz-Lockstep</strong> rechnet, stehen diese Interrupt-Hacks absolut phasenstarr.</li>
                </ul>

                <h4>&gt; YM6 SPEC: WARUM DIGIDRUMS ÜBERHAUPT FUNKTIONIEREN (DAC INJECTION)</h4>
                <p>Deaktiviert man im Mixer-Register <code>R7</code> für einen Kanal gleichzeitig <strong>Ton und Noise</strong>, klemmt die Ausgangslogik des YM2149 nicht etwa auf 0 – sondern auf einem <strong>konstanten logischen HIGH-Pegel („1“)</strong>! Jede Zahl, die ein MFP-Timer daraufhin tausende Male pro Sekunde in das 4-Bit-Lautstärkeregister (<code>R8–R10</code>) schreibt, schlägt unmittelbar als steuerbare Gleichspannung durch die logarithmische 32-Step-Tabelle durch. Unser <em>Exact-Core</em> mischt Digidrums deshalb nicht einfach linear dazu, sondern injiziert die 4-Bit-PCM-Samples virtuell genau in dieses Register – das verleiht ihnen den unverwechselbaren, rauen Atari-Crunch. (Erst 1989 schenkte Atari dem <strong>Atari STE</strong> einen separaten 8-Bit-Stereo-DMA-Soundchip samt LMC1992-Equalizer.)</p>

                <h4>&gt; PASSIVE 1-k&Omega;-SUMMIERUNG &amp; KAISER-SINC-RESAMPLING</h4>
                <p>Die drei unipolaren Ausgänge (Pins 4, 3 und 38) werden auf dem ST-Mainboard über drei simple <code>1 k&Omega;</code>-Widerstände (<code>R43, R44, R45</code>) passiv zu einem Mono-Signal summiert. Da perfekte Rechteckstufen theoretisch unendlich viele Obertöne bis weit über 2 MHz erzeugen, dezimiert unser Core über zwei kaskadierte 256-Phasen Kaiser-Windowed-Sinc-Polyphase-Stufen (20-kHz-Passband, 96 dB Zieldämpfung), gefolgt von einem linearen Ausgabemodell mit 15,9-kHz-Tiefpass und 25-Hz-Hochpass.</p>
            </article>
        </div>
    `
};