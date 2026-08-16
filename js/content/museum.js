// === js/content/museum.js ===
// ==========================================
// DAS DIGITALE MUSEUM (Texte & Handbücher)
// Mit integrierten Hardware-Spezifikations-Tabellen
// Deep-Dive Edition: Cycle-Exact Silicon Physics
// ==========================================

export const systemDescriptions = {
c64: `
        <!-- === TECHNICAL SPECIFICATION GRID (C64 SID 6581) === -->
        <div style="padding: 8px 12px; margin-bottom: 20px; font-size: calc(var(--font-size-base) * 0.85); background: rgba(0,0,0,0.3); font-family: inherit;">
            <p style="color: var(--highlight-color); margin-bottom: 8px; font-weight: bold; border-bottom: 1px dashed var(--text-color); padding-bottom: 4px;">>>> HARDWARE SPECIFICATIONS:</p>
            <div style="display: grid; grid-template-columns: 140px 1fr; gap: 6px; line-height: 1.4;">
                <div><strong>Synthesizer:</strong></div><div>MOS Technology 6581 R3 (Analoger Subtraktiv-Synthesizer)</div>
                <div><strong>Kanäle:</strong></div><div>3 unabhängige Stimmen + 1 routbares 12dB/Okt Multimode-VCF</div>
                <div><strong>Taktfrequenz:</strong></div><div>985.248 Hz (PAL) / Cycle-Exact Lockstep mit 6502 CPU</div>
                <div><strong>D/A-Wandlung:</strong></div><div>Nicht-lineare R-2R Leitern + 255-Tap Sinc-FIR Decimator (20kHz Brickwall)</div>
                <div><strong>Analog-Filter:</strong></div><div>2MHz Zero-Delay Feedback (ZDF) State-Space OTA-Solver (30Hz–6.2kHz R3 S-Kurve)</div>
                <div><strong>Wellenformen:</strong></div><div>Dreieck, Sägezahn, 12-Bit PWM, 23-Bit LFSR Noise, NMOS Wire-AND Kombinationen</div>
                <div><strong>Hüllkurven:</strong></div><div>3 x ADSR (15-Bit Rate-Counter mit hardwaregetreuen Ladekonstanten)</div>
                <div><strong>Digidrums:</strong></div><div>4-Bit $D418 VCA-Modulation via PlaySID Traps (3.6x Paula-Teiler) o. CIA/NMI</div>
            </div>
        </div>

        <div style="border-left: 4px solid var(--text-color); padding: 10px 15px; margin-bottom: 15px; background: rgba(0,0,0,0.2); line-height: 1.6;">
            <h3 style="color: var(--highlight-color); margin-bottom: 15px;">[ DEEP DIVE: MOS TECHNOLOGY SID 6581 ]</h3>
            <p>Der Sound Interface Device (SID), 1981 von Robert "Bob" Yannes entworfen, ist ein vollwertiger analoger subtraktiver Synthesizer auf einem einzigen Silizium-Chip. Er besitzt 3 Oszillatoren mit synchronisierten Phasen-Akkumulatoren, individuelle ADSR-Generatoren, programmierbare Ringmodulation und ein echtes analoges Multimode-Filter.</p>

            <h4 style="color: var(--highlight-color); margin: 25px 0 5px 0;">> HISTORIE: DER 24-JÄHRIGE REBELL</h4>
            <p>In der zweiten Hälfte des Jahres 1981 stand der erst 24-jährige Robert "Bob" Yannes vor einer monumentalen Aufgabe. Commodore-Gründer Jack Tramiel gab der Halbleiter-Sparte MOS Technology ein knallhartes Ultimatum: Der Sound- und Grafikchip für das geplante "Project Red" (den späteren Commodore 64) musste in genau <strong>fünf Monaten</strong> fertig sein. Yannes verabscheute die damals typischen simplen Pieps-Generatoren der Spielhallen-Ära. Unter extremem Zeitdruck entwarf er ein revolutionäres Design mit drei physisch getrennten Stimmen, flexiblen ADSR-Hüllkurven und einem echten analogen Multimode-Filter.</p>

            <h3 style="color: var(--highlight-color); margin: 30px 0 15px 0;">[ HARDWARE-ARCHITEKTUR & DIE FUNKTIONSBLÖCKE ]</h3>
            <p>Der MOS 6581 ist modular aufgebaut. Seine innere Struktur unterteilt sich in hochpräzise, analoge und digitale Funktionsblöcke, die flexibel miteinander verschaltet werden können:</p>

            <h4 style="color: var(--highlight-color); margin: 20px 0 5px 0;">> DIE STIMMEN-ARCHITEKTUR (VOICE PATHS)</h4>
            <p>Jede der drei Stimmen besitzt einen vollkommen eigenständigen Signalpfad, bestehend aus einem Oszillator-Kern, einem Hüllkurven-Generator (ADSR) und einem Wellenform-Mischer. Erst am Ende des Pfads entscheidet die Filter-Routing-Matrix (Register <code>$D417</code>), ob das Signal in das gemeinsame analoge Filter gespeist oder ungefiltert direkt zum VCA-Ausgang geschickt wird.</p>

            <h4 style="color: var(--highlight-color); margin: 20px 0 5px 0;">> DIE WELLENFORMEN & DIE PWM-STEUERUNG</h4>
            <p>Jeder Oszillator-Kern verfügt über einen 24-Bit-Akkumulator, der bei einer PAL-Taktfrequenz von ca. 0,985 MHz eine Frequenzauflösung von winzigen 0,058 Hz ermöglicht. Der Kern generiert vier klassische Wellenformen parallel:
            <ul>
                <li><strong>Dreieck (Triangle):</strong> Sehr grundtonstark, weich, perfekt für Flöten und sanfte Leads.</li>
                <li><strong>Sägezahn (Sawtooth):</strong> Obertonreich, aggressiv, das Fundament für fette Bässe und Brass-Klänge.</li>
                <li><strong>Rechteck (Pulse):</strong> Bietet eine hochauflösende, programmierbare 12-Bit Pulsbreite (PWM) von 0 % bis 100 %. Durch die kontinuierliche Modulation der Pulsbreite (z. B. via Software-LFOs) entsteht der berühmte, schwebende Chorus-Effekt des SID.</li>
                <li><strong>Rauschen (Noise):</strong> Erzeugt durch ein 23-Bit-LFSR, das an festverdrahteten Taps abgegriffen wird (ideal für Snares, Explosions-Effekte und Hi-Hats).</li>
            </ul>
            </p>

            <h4 style="color: var(--highlight-color); margin: 20px 0 5px 0;">> DIE KREUZMODULATIONS-MATRIX (HARD-SYNC & RINGMODULATION)</h4>
            <p>Der SID erlaubt es, die Stimmen ringförmig miteinander zu koppeln (Stimme 1 moduliert Stimme 3, Stimme 2 moduliert Stimme 1, Stimme 3 moduliert Stimme 2):
            <ul>
                <li><strong>Hard-Sync (Register Bit 1):</strong> Erzwingt, dass die Phase des Oszillators augenblicklich auf 0 zurückgesetzt wird, sobald der modulierende Nachbar-Oszillator sein höchstes Bit (MSB) umschaltet. Verschiebt man die Frequenz des synchronisierten Oszillators per Software-Sweep, entsteht der kreischende, obertonreiche "Sync-Lead"-Sound (bekannt aus Hubbards <em>Commando</em>).</li>
                <li><strong>Ring-Modulation (Register Bit 2):</strong> Multipliziert das MSB der Dreieckswelle mit dem MSB des modulierenden Nachbarchips (logische XOR-Kopplung). Das erzeugt unharmonische, metallische Frequenzen – das Geheimnis hinter Hülsbecks Glocken- und Rhodes-Klängen in <em>The Great Giana Sisters</em>.</li>
            </ul>
            </p>

            <h4 style="color: var(--highlight-color); margin: 20px 0 5px 0;">> DAS ANALOGE MULTIMODE-FILTER (2MHz ZDF STATE-SPACE OTA)</h4>
            <p>Das Herzstück des analogen SID-Klangs ist sein programmierbares 12dB/Oktave State-Variable-Filter. Es bietet vier routbare Charakteristiken: Tiefpass (LP), Bandpass (BP), Hochpass (HP) und eine Kerbfilter-Mischung (Notch). Die Grenzfrequenz ist mit 11-Bit Auflösung steuerbar, und die Resonanz (Güte) kann in 15 Stufen geregelt werden. Unsere Engine berechnet dieses Filter über einen <strong>2MHz Zero-Delay Feedback (ZDF) Trapezoidal-Integrator</strong>, der selbst bei extremer Maximal-Resonanz ($R=15$) absolut phasenstarr und ohne digitales Pfeifen schwingt.</p>

            <h3 style="color: var(--highlight-color); margin: 30px 0 15px 0;">[ DIE ANOMALIEN: DIE SILIZIUM-GEHEIMNISSE DES 6581 ]</h3>
            <p>Die unerreichte Seele des SID-Klangs liegt in seinen physikalischen Unvollkommenheiten. Unser Emulator bildet die parasitären Kapazitäten und Halbleiter-Macken bitgenau ab:</p>

            <h4 style="color: var(--highlight-color); margin: 25px 0 5px 0;">> 255-TAP SINC-FIR DECIMATOR (ZERO ALIASING BEI 1 MHz)</h4>
            <p>Ein echter SID läuft mit 985.248 Hz. Die harten Kanten von Rechteckwellen und $D418-Drums erzeugen theoretisch unendlich hohe Spiegelfrequenzen jenseits der Hörgrenze. Herkömmliche Emulatoren mitteln Zyklen oft nur simpel ("Box-Filter"), was zu schrillem Aliasing-Klirren führt. Unser Core sammelt die 1-MHz-Samples in einem <strong>512-Element Ringpuffer</strong> und faltet sie über einen <strong>255-Tap Blackman-windowed Sinc-FIR Filter</strong> aliasing-frei auf 48 kHz herunter ($>75\text{ dB}$ Sperrdämpfung bei 20 kHz).</p>

            <h4 style="color: var(--highlight-color); margin: 25px 0 5px 0;">> SUB-CYCLE INSTRUCTION WRITE PIPELINING (6510 BUS-TIMING)</h4>
            <p>Ein Befehl wie <code>STA $D418</code> benötigt auf der 6502-CPU 4 Zyklen. Das Datum schlägt jedoch erst auf dem <strong>allerletzten Takt (Zyklus 4)</strong> physisch auf den SID-Bus durch! Unser CPU-Emulator puffert Schreibzugriffe (Staging) und committet sie exakt im letzten Instruktionstakt. Das eliminiert jeglichen Sub-Instruction-Jitter bei rasanten Galway-Digidrums und timergesteuerten Arpeggios.</p>

            <h4 style="color: var(--highlight-color); margin: 25px 0 5px 0;">> DER 3.6× PLAYSID AMIGA-PAULA TRAP-TEILER (GIANA SISTERS FIX)</h4>
            <p>Als Per Håkan Sundell 1990 den ersten <em>PlaySID</em>-Player für den Amiga erfand, bauten Ripper die C64-Sample-Routinen so um, dass Periodenwerte direkt in Amiga-Paula-Zyklen (3,55 MHz) in <code>$D45D/$D45E</code> geschrieben wurden (z. B. Periode 907 für Bassdrums). Da der C64 mit 985 kHz exakt <strong>3,6-mal langsamer</strong> taktet, erkennt unsere Engine Amiga-Paula-Werte ($\ge 280$) automatisch und rechnet sie via $\text{Period} / 3.6$ auf 252 C64-Zyklen (3,91 kHz) um. Gekoppelt mit der <strong>Big-Endian High-Nibble-Zuerst-Dekodierung</strong> klingen die Drums in <em>The Great Giana Sisters</em> knackig, druckvoll und phasenrein.</p>

            <h4 style="color: var(--highlight-color); margin: 25px 0 5px 0;">> VOICE 3 DC-LEAKAGE BEI STUMMSCHALTUNG ($D418 BIT 7 "3OFF")</h4>
            <p>Wird Stimme 3 über Bit 7 in <code>$D418</code> stummgeschaltet, trennt die Hardware nur das AC-Wellenformsignal ab. Der <strong>Gleichspannungs-Arbeitspunkt des D/A-Wandlers leckt weiterhin ungehindert in den VCA-Summenbus</strong>. Coder wie Martin Galway (in <em>Arkanoid</em> und <em>Wizball</em>) nutzten dieses Leck, um druckvolle 4-Bit-Samples über den Master-Volume-Multiplizierer abzufeuern, während Stimme 3 scheinbar "stumm" war.</p>

            <h4 style="color: var(--highlight-color); margin: 25px 0 5px 0;">> ILLEGALE WELLENFORMEN & WIRE-AND PULL-DOWN ($50 ENGELSSTIMME)</h4>
            <p>Werden mehrere Wellenformen (z. B. Dreieck + Puls = <code>$50</code> oder Sägezahn + Puls = <code>$60</code>) kombiniert, entsteht im 6581 ein physischer Kurzschluss. Der Pull-Down-Transistor der Pulswelle zieht das Signal auf Masse, aber durch den Innenwiderstand des Dreiecks-DACs sickert ein Teilsignal durch. Unsere <code>WAVE_LUT_TRIPULSE</code> bildet diesen Innenwiderstand mit <code>tri * 0.86 + 14</code> exakt ab – das Geheimnis hinter Hülsbecks perlender "Engelsstimme".</p>

            <h4 style="color: var(--highlight-color); margin: 25px 0 5px 0;">> WIZBALL-STABILE 6581 R3 S-KURVE (30 Hz BIS 6.200 Hz)</h4>
            <p>Ein echter MOS 6581 R3 besitzt keine lineare Filterkurve bis 16 kHz, sondern eine hardware-gemessene, asymmetrische S-Kurve mit einer Obergrenze von ca. 6,2 kHz. Durch die Begrenzung auf diesen authentischen Frequenzbereich und symmetrisches JFET-Resonance-Quenching in der ZDF-Schleife meistert unser Core extreme $R=15$-Sweeps (*Wizball Title*) absolut klangtreu und ohne Resonanz-Kippen.</p>

            <h4 style="color: var(--highlight-color); margin: 25px 0 5px 0;">> FLOATING DAC DISCHARGE (DIE WEICHEN GALWAY-FADES)</h4>
            <p>Setzt man das Wellenform-Register auf <code>$00</code>, trennt die Hardware den D/A-Wandler von den Oszillatoren. Doch die parasitäre Gate-Kapazität ($C_{\text{gate}} \approx 0,8\text{ pF}$) speichert die letzte Ladung! Das Audiosignal "blutet" über ca. 15 Millisekunden weich auf einen schwebenden Ruhepegel (DC-Bias <code>$18</code>) aus. Dieser Hardware-Fehler erzeugt die berühmten, organisch fließenden Übergänge in Hubbards und Galways Soli.</p>

            <h4 style="color: var(--highlight-color); margin: 25px 0 5px 0;">> THERMAL DRIFT & DER TEMP-REGLER</h4>
            <p>Der analoge Filter besaß keine Temperaturkompensation. Wenn sich der Rechner im Betrieb erwärmte (50°C bis 75°C), sank der Widerstand der FET-Transistoren, wodurch die Filter-Grenzfrequenz sachte abrutschte und Bässe weicher sättigten. Über unseren <em>TEMP</em>-Fader im Panel lässt sich dieses analoge Verhalten in Echtzeit modulieren.</p>
        </div>
    `,
    amiga: `
        <!-- === TECHNICAL SPECIFICATION GRID (AMIGA MOS PAULA 8364) === -->
        <div style="padding: 4px 0; margin-bottom: 20px; font-size: calc(var(--font-size-base) * 0.85); background: transparent; font-family: inherit;">
            <p style="color: var(--highlight-color); margin-bottom: 12px; font-weight: bold; border-bottom: 1px dashed var(--text-color); padding-bottom: 4px;">>>> HARDWARE SPECIFICATIONS:</p>
            <div style="display: grid; grid-template-columns: 140px 1fr; gap: 6px; line-height: 1.4;">
                <div><strong>Kanäle:</strong></div><div>4 x DMA-PCM-Kanäle (L-R-R-L Hard-Panning mit 3.5% Crosstalk)</div>
                <div><strong>Taktfrequenz:</strong></div><div>3.546.895 Hz (PAL) / Internes 4x Oversampling (192 kHz)</div>
                <div><strong>D/A-Wandlung:</strong></div><div>Zero-Order Hold (ZOH) ohne Interpolation + Sinc-FIR Decimator</div>
                <div><strong>Audioauflösung:</strong></div><div>8-Bit Sample × 6-Bit Volume = 14-Bit Multiplying DAC (MDAC)</div>
                <div><strong>Analog-Filter:</strong></div><div>6dB/Okt statischer Lowpass (4.42kHz) + 12dB/Okt LED-Butterworth (3.09kHz)</div>
                <div><strong>Sequenzierung:</strong></div><div>ProTracker (MOD) o. FastTracker (XM) Patterns via CIA-A-BPM-Timer</div>
            </div>
        </div>

        <div style="border-left: 4px solid var(--text-color); padding: 10px 15px; margin-bottom: 15px; background: rgba(0,0,0,0.2); line-height: 1.6;">
            <h3 style="color: var(--highlight-color); margin-bottom: 15px;">[ DEEP DIVE: MOS TECHNOLOGY PAULA 8364 ]</h3>
            <p>Paula war das Herzstück des Amiga-Audiosystems und einer der fortschrittlichsten Soundchips seiner Epoche. Während die Konkurrenz noch Töne synthetisierte, brachte Paula echten Direct Memory Access (DMA) PCM-Sound in die Wohnzimmer.</p>

            <h4 style="color: var(--highlight-color); margin: 25px 0 5px 0;">> HISTORIE: JAY MINERS MENTORSHIP & GLENN KELLERS ERSTER CHIP</h4>
            <p>In der frühen Entwicklungsphase der Amiga-Lorraine-Prototypen trug Paula den internen Namen <strong>Portia</strong> (abgeleitet von I/O "Ports"). Die Schaltung wurde vom jungen Ingenieur <strong>Glenn Keller</strong> entworfen, der von Amiga-Urvater Jay Miner persönlich betreut wurde. Faszinierend dabei: Paula war Glenn Kellers <strong>allerliebstes und erstes Chip-Design überhaupt</strong>! Und er lieferte ein absolutes Meisterwerk ab. Während der Amiga im Laufe der Jahre technologisch weiterentwickelt wurde und Chips wie Agnus oder Denise mehrfach neu designt wurden, blieb Paula über die gesamte Lebensspanne des Amiga von 1985 bis 1992 <strong>völlig unverändert</strong>.</p>

            <h3 style="color: var(--highlight-color); margin: 30px 0 15px 0;">[ CHIP-SPECS: EMULIERTE HARDWARE-KOMPONENTEN ]</h3>
            <p>Um den typischen, druckvollen "Amiga 500 Sound" exakt nachzubilden, bricht unser <em>Exact-Core</em> mit modernen Konventionen und emuliert die physikalischen Limitationen des Chips:</p>

            <h4 style="color: var(--highlight-color); margin: 20px 0 5px 0;">> ZERO-ORDER HOLD (ZOH) & OVERSAMPLING</h4>
            <p>Paula kennt keine Interpolation. Ein über DMA ausgelesener 8-Bit-Wert wird als analoge Spannung exakt so lange gehalten (Zero-Order Hold), bis der nächste Fetch kommt. Diese eckigen Treppenstufen erzeugen massive Spiegelfrequenzen im Ultraschallbereich – den berühmten perlenden <strong>Amiga-Schimmer</strong>. Normale Emulatoren falten diese Frequenzen klirrend in den hörbaren Bereich zurück (Aliasing). Unser Core taktet die D/A-Wandlung deshalb mit <strong>192 kHz (4x Oversampling)</strong>, jagt die ZOH-Treppen durch die echten analogen Filter-Gleichungen und dezimiert sie danach mit einem 255-Tap Sinc-FIR Filter aliasing-frei auf 48 kHz.</p>

            <h4 style="color: var(--highlight-color); margin: 15px 0 5px 0;">> L-R-R-L HARD-PANNING & CROSSTALK</h4>
            <p>Der Amiga 500 besitzt keinen Panning-Mixer. Die Ausgabe ist physisch auf dem Mainboard verlötet: Kanäle 0 und 3 gehen zu 100% auf den linken Cinch-Ausgang, 1 und 2 zu 100% auf den rechten. Unser <em>Exact-Core</em> ignoriert moderne Tracker-Panning-Befehle rigoros und simuliert stattdessen nur ein winziges induktives Übersprechen (Crosstalk von 3,5%) der Motherboard-Leiterbahnen. Das garantiert die gnadenlose, breite Stereo-Trennung, die das Mischen von Amiga-MODs damals so unglaublich schwer machte.</p>

            <h4 style="color: var(--highlight-color); margin: 25px 0 5px 0;">> DMA WORD ALIGNMENT</h4>
            <p>Paula greift über den Systembus (gesteuert durch Agnus) immer im 16-Bit-Raster (Words = 2 Bytes) auf das Chip-RAM zu. Moderne PC-Tracker erlauben oft ungerade Loop-Marker oder Sample-Offsets. Unsere Engine zwingt alle Speicher-Pointer physikalisch korrekt per Bitmaske (<code>& ~1</code>) auf gerade Adressen. Nur so "snappen" die Loops historisch akkurat.</p>

            <h4 style="color: var(--highlight-color); margin: 25px 0 5px 0;">> DIE ANALOGEN FILTER-STUFEN</h4>
            <p>Das Signal passiert nach dem D/A-Wandler zwei analoge Hürden:<br>
            1. Einen permanenten <strong>RC-Tiefpass (6 dB/oct)</strong> bei 4.42 kHz, der hochfrequentes Digitalrauschen sachte abfedert.<br>
            2. Einen zuschaltbaren <strong>LED-Filter (12 dB/oct Butterworth)</strong> bei 3.09 kHz, der an die Helligkeit der Power-LED gekoppelt war und den Klang extrem "dumpf" und warm abdunkeln konnte.</p>
        </div>
    `,
    atari: `
        <!-- === TECHNICAL SPECIFICATION GRID (ATARI YM2149F) === -->
        <div style="padding: 4px 0; margin-bottom: 20px; font-size: calc(var(--font-size-base) * 0.85); background: transparent; font-family: inherit;">
            <p style="color: var(--highlight-color); margin-bottom: 8px; font-weight: bold; border-bottom: 1px dashed var(--text-color); padding-bottom: 4px;">>>> HARDWARE SPECIFICATIONS:</p>
            <div style="display: grid; grid-template-columns: 140px 1fr; gap: 6px; line-height: 1.4;">
                <div><strong>Kanäle:</strong></div><div>3 Oszillatoren (Rechteck) + 1 LFSR Noise-Generator</div>
                <div><strong>Taktfrequenz:</strong></div><div>2.000.000 Hz (2.0 MHz True Lockstep Emulation)</div>
                <div><strong>D/A-Wandler:</strong></div><div>Logarithmisch, 32 diskrete Stufen (-1.5dB pro Stufe)</div>
                <div><strong>Audioauflösung:</strong></div><div>8-Bit Sample × 6-Bit Volume = 14-Bit Multiplying DAC (MDAC)</div>
                <div><strong>Analog-Filter:</strong></div><div>6dB/Okt statischer Lowpass (4.42kHz) + 12dB/Okt LED-Butterworth (3.09kHz)</div>
                <div><strong>Sequenzierung:</strong></div><div>ProTracker (MOD) o. FastTracker (XM) Patterns via CIA-A-BPM-Timer</div>
            </div>
        </div>

        <div style="border-left: 4px solid var(--text-color); padding: 10px 15px; margin-bottom: 15px; background: rgba(0,0,0,0.2); line-height: 1.6;">
            <h3 style="color: var(--highlight-color); margin-bottom: 15px;">[ DEEP DIVE: YAMAHA YM2149F (ATARI ST) ]</h3>
            <p>Der Yamaha YM2149F war der akustische Herzschlag der 16-Bit Atari ST Serie. Oft fälschlicherweise für einen simplen Klon des GI AY-3-8910 gehalten, barg der Yamaha-Chip ein massives Geheimnis, das ihn klanglich überlegen machte.</p>

            <h4 style="color: var(--highlight-color); margin: 25px 0 5px 0;">> HISTORIE: SHIRAZ SHIVJIS COST-CUT-HACK & DIE RETTUNG DES 'JACKINTOSH'</h4>
            <p>Als Jack Tramiel Commodore im Streit verließ und 1984 die Reste von Atari kaufte, beauftragte er seinen genialen Chefdesigner <strong>Shiraz Shivji</strong> (der zuvor am C64 mitgearbeitet hatte), in weniger als einem Jahr einen extrem günstigen Macintosh-Killer (den "Atari ST") zu entwerfen. Jedes Bauteil musste auf den Cent genau kalkuliert werden. Um den Preis für teure dedizierte I/O-Controller-Chips zu sparen, vollbrachte Shivji einen legendären Hacker-Trick: Er wählte den spottbilligen Yamaha YM2149 und <strong>missbrauchte dessen freie I/O-Ports als System-Rückgrat</strong>.</p>
            <p>Auf dem Atari ST steuert der Soundchip deshalb nicht nur Töne, sondern über seine physischen Pins (I/O Port A) direkt das Diskettenlaufwerk, den Druckerport, die RS-232-Schnittstelle und die Tastatur! Ein Ausfall des Soundchips führte somit zum sofortigen Stillstand des gesamten Computers.</p>

            <h4 style="color: var(--highlight-color); margin: 25px 0 5px 0;">> DER 32-STEP LOG-DAC SKANDAL</h4>
            <p>Während Konkurrenz-Chips (wie im ZX Spectrum) Lautstärken in simplen 16 Stufen linear auflösten, verbaute Yamaha im YM2149 einen <strong>echten 32-stufigen logarithmischen D/A-Wandler</strong>. Die Dämpfung beträgt exakt -1.5dB pro Stufe. <br>
            <strong>Hardware-Hacking:</strong> Die normalen Lautstärkeregister des Chips akzeptieren zwar nur 4-Bit Werte (0-15), aber die Hardware mappt diese intern auf die 5-Bit Struktur via <code>(Vol * 2) + 1</code>. Unser Core bildet diesen physikalischen Schaltplan bitgenau nach. Dadurch klingen die Drums fetter, und die berüchtigten Hardware-Envelopes nutzen die vollen 32 Sub-Stufen für butterweiche Volume-Sweeps ("Zipper-Noise").</p>

            <h3 style="color: var(--highlight-color); margin: 30px 0 15px 0;">[ CHIP-SPECS: EMULIERTE HARDWARE-KOMPONENTEN & SCENE-TRICKS ]</h3>
            <p>Der YM2149 besitzt keinerlei analoge Filter oder native PCM-Sample-Wandler. Um dem Chip dennoch komplexe Töne zu entlocken, mussten die Musik-Magier der ST-Demoszene tief in die Trickkiste greifen. Unsere Synthese-Cores emulieren diese Hardware-Kniffe auf der 2-MHz-Ebene detailgetreu:</p>

            <h4 style="color: var(--highlight-color); margin: 20px 0 5px 0;">> SYNC-BUZZER & HIPPEL-ARPEGGIOS</h4>
            <p>Da der Chip nur simple Rechteckwellen ausspuckt, programmierten Coder wie Jochen Hippel hochfrequente CPU-Interrupts (Timer-B). Indem sie die Register hunderte Male pro Frame überschrieben, erzwangen sie Oszillator-Resets und mischten Rechteck mit Noise in aberwitzigen Geschwindigkeiten. Dadurch entstanden die berühmten rasselnden "ST-SID-Voices". Da unsere Engine mit <strong>2.000.000 Hz Lockstep</strong> läuft, schwingen diese Interrupt-Hacks phasenstarr und ohne digitales Artefakt-Zittern.</p>

            <h4 style="color: var(--highlight-color); margin: 20px 0 5px 0;">> ZERO ALIASING (SINC-FIR DECIMATION)</h4>
            <p>Rechteckwellen produzieren theoretisch unendlich hohe Obertöne. Wenn wir 2 MHz auf die 48 kHz der Soundkarte komprimieren, würde das ohne Schutz grauenhaft klirren (Aliasing). Unser Core jagt das rohe Signal deshalb in Echtzeit durch einen 255-Tap Polyphase Sinc-FIR Filter. Das wirkt wie eine analoge "Brickwall" bei 12.5 kHz – der Sound bleibt warm, druckvoll und kristallklar.</p>

            <h4 style="color: var(--highlight-color); margin: 20px 0 5px 0;">> YM6 SPEC: DIE DIGIDRUMS (DAC INJECTION)</h4>
            <p>Da der YM2149 keine D/A-Wandler für Samples besitzt, missbrauchten die Coder die 4-Bit-Lautstärkeregister. In unserem <em>Exact-Core</em> mischen wir Digidrums nicht einfach linear als Audio dazu. Wir injizieren die PCM-Samples "virtuell" in das Volume-Register der Oszillatoren. Dadurch werden sie durch die logarithmische 32-Step Yamaha-Tabelle gepresst, was ihnen den absolut rohen, verzerrten 4-Bit Atari-Crunch verleiht.</p>
        </div>
    `
};