// === js/content/museum.js ===
// ==========================================
// DAS DIGITALE MUSEUM (Texte & Handbücher)
// Mit integrierten Hardware-Spezifikations-Tabellen
// ==========================================

export const systemDescriptions = {
c64: `
        <!-- === TECHNICAL SPECIFICATION GRID (C64 SID 6581) === -->
        <div style="border: 2px solid var(--text-color); padding: 8px 12px; margin-bottom: 20px; font-size: calc(var(--font-size-base) * 1.2); background: rgba(0,0,0,0.3); font-family: monospace;">
            <p style="color: var(--highlight-color); margin-bottom: 8px; font-weight: bold; border-bottom: 1px dashed var(--text-color); padding-bottom: 4px;">>>> HARDWARE SPECIFICATIONS:</p>
            <div style="display: grid; grid-template-columns: 140px 1fr; gap: 6px; line-height: 1.4;">
                <div><strong>Kanäle:</strong></div><div>3 unabhängige Synthesestimmen + 1 routbares analoges VCF</div>
                <div><strong>Taktfrequenz:</strong></div><div>985.248 Hz (PAL) / 1.022.727 Hz (NTSC)</div>
                <div><strong>Wellenformen:</strong></div><div>Dreieck, Sägezahn, PWM, Rauschen (23-Bit LFSR), analoge Gatter-Mischungen</div>
                <div><strong>Analog-Filter:</strong></div><div>12dB/Okt Multimode-Filter (LP/BP/HP/Notch) mit frei wählbarer Stimmen-Zuweisung</div>
                <div><strong>Hüllkurven:</strong></div><div>3 x ADSR (15-Bit Rate-Counter, exponentielle Kondensator-Entladung)</div>
                <div><strong>Sequenzierung:</strong></div><div>Freie 6502-Assembler-Player via PAL-VBLANK (50Hz) o. CIA-Timer</div>
            </div>
        </div>

        <div style="border-left: 4px solid var(--text-color); padding: 10px 15px; margin-bottom: 15px; background: rgba(0,0,0,0.2); line-height: 1.6;">
            <h3 style="color: var(--highlight-color); margin-bottom: 15px;">[ DEEP DIVE: MOS TECHNOLOGY SID 6581 ]</h3>
            <p>Der Sound Interface Device (SID), 1981 von Bob Yannes entworfen, ist ein analoger subtraktiver Synthesizer auf einem einzigen Silizium-Chip. Er besitzt 3 Oszillatoren (Sägezahn, Dreieck, Rechteck, Rauschen), individuelle ADSR-Generatoren und ein analoges Multimode-Filter.</p>

            <h4 style="color: var(--highlight-color); margin: 25px 0 5px 0;">> HISTORIE: DER 24-JÄHRIGE REBELL & DAS JUBILÄUM DES SIDS</h4>
            <p>In der zweiten Hälfte des Jahres 1981 stand der erst 24-jährige Robert "Bob" Yannes vor einer monumentalen Aufgabe. Commodore-Gründer Jack Tramiel gab der Halbleiter-Sparte MOS Technology ein knallhartes Ultimatum: Der Sound- und Grafikchip für das geplante "Project Red" (den späteren Commodore 64) musste in genau <strong>fünf Monaten</strong> fertig sein, um pünktlich zur Consumer Electronics Show (CES) im Januar 1982 präsentiert werden zu können.</p>
            <p>Yannes, der kurz zuvor als junger Absolvent eingestellt worden war, verabscheute die damals typischen simplen Soundchips der Spielhallen-Ära (die er als "primitive Beep-Generatoren" bezeichnete). Da er in seiner Freizeit hobbymäßig eigene Synthesizer gebaut hatte, beschloss er, das Unmögliche zu wagen: Er wollte einen vollwertigen, professionellen subtraktiven Synthesizer auf ein winziges Stück Silizium bannen. Unter extremem Zeitdruck entwarf er ein revolutionäres Design mit drei physisch getrennten Stimmen, flexiblen ADSR-Hüllkurven und einem echten analogen Multimode-Filter.</p>

            <h4 style="color: var(--highlight-color); margin: 25px 0 5px 0;">> DIE ANOMALIEN: WARUM DER SID SCHWER ZU EMULIEREN IST</h4>
            <p>Die unerreichte Seele des SID-Klangs liegt in seinen physikalischen "Fehlern" und analogen Imperfektionen begründet. Das ist auch der Grund, weshalb einfache Emulationen oft steril und flach klingen. Unser cycle-genauer Mischer bildet diese Anomalien präzise ab:</p>
            <ul>
                <li><strong>NMOS Transistor Sättigung:</strong> Wenn Musiker mehrere Wellenformen auf einem Kanal mischten (z. B. Dreieck + Sägezahn), war dies kein logisches digitales ODER. Die analogen Signalströme belasteten sich auf dem Silizium physisch gegenseitig, was zu nicht-linearen harmonischen Verzerrungen (Sättigung) führte.</li>
                <li><strong>DC-Leakage & der Galway-Hack ($D418):</strong> Die analoge VCA-Lautstärkeregelung hatte ein leichtes Gleichspannungs-Leck. Martin Galway (Komponist von <em>Wizball</em>) fand heraus, dass man dieses Leck ausnutzen konnte: Durch blitzschnelles Beschreiben des Lautstärkeregisters mit mehreren Kilohertz erzeugte die CPU eine hörbare DC-Spannungsschwankung – der berühmte 4-Bit-Sample-Hack war geboren, den unser neuer 1-MHz-Mischer detailgetreu wiedergibt.</li>
                <li><strong>Thermal Cutoff Drift:</strong> Der analoge Filter besaß keine Temperaturkompensation. Wenn sich der Rechner im Betrieb erwärmte, sank der Widerstand der internen FET-Transistoren, wodurch die Filter-Grenzfrequenz (Cutoff) dramatisch abrutschte. Ein Track, der nachmittags im heißen Studio warm klang, klang morgens eisig und schrill. (Dies lässt sich über unseren <em>TEMP</em>-Regler manuell nachstellen).</li>
            </ul>

            <h4 style="color: var(--highlight-color); margin: 25px 0 5px 0;">> DIE ANALOGE FILTER-ROUTING-MATRIX ($D417)</h4>
            <p>Der SID besitzt auf dem Silizium genau einen physischen Filter-Schaltkreis (VCF). Coder konnten in Register <strong>$D417</strong> über einzelne Schalter (Bits) für jede der 3 Stimmen entscheiden, ob sie den Filter durchlaufen oder ihn umgehen (Bypass).<br>
            <strong>🎵 Szene-Trick:</strong> Komponisten schickten oft nur die fette Bassline (Stimme 1) in den Filter, um sie per LFO "wabbeln" zu lassen, während die schnellen Arpeggios und Drums (Stimme 2 & 3) ungefiltert direkt zum Master-Out liefen, um kristallklar und aggressiv zu bleiben. (Tipp: Beobachte im HUD die LEDs unter <em>Routing (V1/V2/V3)</em>!)</p>

            <h4 style="color: var(--highlight-color); margin: 25px 0 5px 0;">> DIE 3-STIMMEN-POLYPHONIE-FALLE (ARPEGGIOS)</h4>
            <p>Da der SID nur über 3 Stimmen verfügt, mussten Musiker tricksen, um dreistimmige Akkorde plus Bass und Melodie abzubilden. Sie koppelten die Akkord-Noten (z. B. Grundton, kleine Terz, Quinte) in einer schnellen 50Hz-VBLANK-Routine auf einer einzigen Stimme. Durch das rasant schnelle Umschalten der Frequenz entsteht das berühmte "Flirren" (Arpeggio), das dem menschlichen Ohr einen echten, dreistimmigen Akkord vorgaukelt.</p>

            <h4 style="color: var(--highlight-color); margin: 25px 0 5px 0;">> DYNAMISCHE PULSWEITENMODULATION (PWM)</h4>
            <p>Um dünne Synth-Klänge extrem "fett" und schwebend klingen zu lassen, modulierten Coder die Rechteckbreite (Pulse Width) über sinusförmige Software-LFOs. Das erzeugte ein sattes chorusschwebendes Klangbild, das klingt, als spielten mehrere Oszillatoren gleichzeitig.</p>
        </div>
    `,
   amiga: `
        <!-- === TECHNICAL SPECIFICATION GRID (AMIGA MOS PAULA 8364) === -->
        <div style="padding: 4px 0; margin-bottom: 20px; font-size: calc(var(--font-size-base) * 0.85); background: transparent; font-family: monospace;">
            <p style="color: var(--highlight-color); margin-bottom: 12px; font-weight: bold; padding-bottom: 4px;">>>> HARDWARE SPECIFICATIONS:</p>
            <div style="display: grid; grid-template-columns: 140px 1fr; gap: 6px; line-height: 1.4;">
                <div><strong>Kanäle:</strong></div><div>4 x ungeteilte DMA-PCM-Kanäle (festes Panning: 2 Links, 2 Rechts)</div>
                <div><strong>Taktfrequenz:</strong></div><div>3.546.895 Hz (PAL Master Clock / 3.55 MHz)</div>
                <div><strong>Audioauflösung:</strong></div><div>8-Bit signed PCM (multipliziert mit 6-Bit Vol zu 14-Bit Äquivalenzauflösung)</div>
                <div><strong>Analog-Filter:</strong></div><div>6dB/Okt statischer Lowpass (4.42kHz) + 12dB/Okt LED-Butterworth (3.09kHz)</div>
                <div><strong>Hüllkurven:</strong></div><div>Software-gesteuert (prozedural berechnet durch den Tracker-Sequenzer)</div>
                <div><strong>Sequenzierung:</strong></div><div>ProTracker (MOD) o. FastTracker (XM) Patterns via CIA-A-BPM-Timer</div>
            </div>
        </div>

        <div style="border-left: 4px solid var(--text-color); padding: 10px 15px; margin-bottom: 15px; background: rgba(0,0,0,0.2); line-height: 1.6;">
            <h3 style="color: var(--highlight-color); margin-bottom: 15px;">[ DEEP DIVE: MOS TECHNOLOGY PAULA 8364 ]</h3>
            <p>Paula war das Herzstück des Amiga-Audiosystems und einer der fortschrittlichsten Soundchips seiner Epoche.</p>

            <h4 style="color: var(--highlight-color); margin: 25px 0 5px 0;">> HISTORIE: JAY MINERS MENTORSHIP & GLENN KELLERS ERSTER CHIP</h4>
            <p>In der frühen Entwicklungsphase der Amiga-Lorraine-Prototypen trug die Paula noch einen ganz anderen Namen: Sie hieß intern <strong>Portia</strong> (abgeleitet von I/O "Ports"). Da der Custom-Chip neben der Tonausgabe auch für die Steuerung der Diskettenlaufwerke und der seriellen Schnittstelle zuständig war, lag dieser logische Name nah. Später bildeten die Ingenieure um Jay Miner daraus die alliterativen, freundlicheren Codenamen Agnus, Denise und schließlich <strong>Paula</strong>.</p>
            <p>Die Schaltung von Paula wurde vom jungen Ingenieur <strong>Glenn Keller</strong> entworfen, der von Amiga-Urvater Jay Miner persönlich als Mentor betreut wurde. Faszinierend dabei: Paula war Glenn Kellers **allerliebstes und erstes-Chip-Design überhaupt**! Und er lieferte ein absolutes Meisterwerk ab. Während der Amiga im Laufe der Jahre technologisch weiterentwickelt wurde und Agnus (Fat Agnus, Alice) sowie Denise (Lisa) mehrfach komplett neu designt wurden, blieb Paula über die gesamte Lebensspanne des Amiga von 1985 (Amiga 1000) bis zum Ende 1992 (Amiga 4000 / CD32) **völlig unverändert**. Sie war von Tag eins an schlicht fehlerfrei und perfekt ausgelegt.</p>

            <h3 style="color: var(--highlight-color); margin: 30px 0 15px 0;">[ CHIP-SPECS: EMULIERTE HARDWARE-KOMPONENTEN ]</h3>
            <p>Paula war ein reiner DMA-Sample-Player, der 4 unabhängige PCM-Kanäle direkt aus dem Chip-RAM auslas. Um den typischen "Amiga 500 Sound" exakt nachzubilden, emuliert dieser Standard-Core vier hardware-spezifische Bausteine:</p>

            <h4 style="color: var(--highlight-color); margin: 20px 0 5px 0;">> DIE VARIABLE D/A-WANDLUNGSRATE (DER AMIGA-SCHIMMER)</h4>
            <p>Paula arbeitet im Gegensatz zu modernen Soundkarten nicht mit einer starren, globalen Samplerate (wie 44.1 kHz oder 48 kHz). Jeder der 4 Kanäle liest sein Sample mit einer völlig eigenständigen Hardware-Geschwindigkeit aus!<br>
            Diese Rate wird direkt aus dem PAL-Haupttakt (3.546.895 Hz) geteilt durch den im Register hinterlegten Periodenwert berechnet. Dieses variable Auslesen erzeugt im Hochtonbereich die berühmten analogen Spiegelfrequenzen (Aliasing) – den legendären <strong>Amiga-Schimmer</strong>, der Tracker-Musik diesen unverwechselbar lebendigen Glanz verleiht.</p>

            <h4 style="color: var(--highlight-color); margin: 15px 0 5px 0;">> BIT-GENAUE DAC-MULTIPLIKATION</h4>
            <p>Das D/A-Wandler-System multipliziert das vorzeichenbehaftete 8-Bit-Sample in Echtzeit mit dem 6-Bit-Lautstärkeregister (0-64). Das resultiert in einer 14-Bit Digitalauflösung mit dem berühmt-berüchtigten, erdigen "Crunch" und metallischen Spiegelfrequenzen (Aliasing) im Hochtonbereich.</p>

            <h4 style="color: var(--highlight-color); margin: 15px 0 5px 0;">> STATISCHER ANALOG-FILTER (6 dB/oct)</h4>
            <p>Ein permanente Tiefpass-Filter (RC-Schaltung), der im originalen Amiga 500 bei genau <strong>4.420,97 Hz</strong> einsetzt, um hochfrequentes Digitalrauschen sachte abzufedern.</p>

            <h4 style="color: var(--highlight-color); margin: 15px 0 5px 0;">> DYNAMISCHER LED-FILTER (12 dB/oct)</h4>
            <p>Ein zuschaltbarer Butterworth-Filter 2. Ordnung bei genau <strong>3.090,53 Hz</strong> ($Q = 0,660$). Er wurde im Original durch das CIA-Register gesteuert (welches auch die Helligkeit der Power-LED dimmte), um den Ton besonders warm und dumpf klingen zu lassen.</p>
        </div>
    `,
    atari: `
        <!-- === TECHNICAL SPECIFICATION GRID (ATARI YM2149F) === -->
        <div style="padding: 4px 0; margin-bottom: 20px; font-size: calc(var(--font-size-base) * 0.75); background: transparent; font-family: monospace;">
            <p style="color: var(--highlight-color); margin-bottom: 8px; bold; border-bottom: 1px dashed var(--text-color); padding-bottom: 4px;">>>> HARDWARE SPECIFICATIONS:</p>
            <div style="display: grid; grid-template-columns: 140px 1fr; gap: 6px; line-height: 1.4;">
                <div><strong>Kanäle:</strong></div><div>3 analoge Hauptkanäle (A, B, C) mit zuschaltbarem Rauschen (kein 4. Kanal)</div>
                <div><strong>Taktfrequenz:</strong></div><div>2.000.000 Hz (2.0 MHz Master Clock)</div>
                <div><strong>Wellenformen:</strong></div><div>Rechteck (Kanal A/B/C), Rauschen (zuschaltbar), Ton+Rausch-Mix, 4-Bit Digidrums</div>
                <div><strong>Analog-Filter:</strong></div><div>Keine (Klangformung erfolgt rein digital über programmierbare Teiler)</div>
                <div><strong>Hüllkurven:</strong></div><div>1 x Hardware-Envelope (HEG) mit 16 vordefinierten Shapes (Sägezahn, Dreieck)</div>
                <div><strong>Sequenzierung:</strong></div><div>Register-Dump-Logging (YM3b/YM5/YM6) via 50Hz-VBLANK o. MFP-Interrupts</div>
            </div>
        </div>

        <div style="border-left: 4px solid var(--text-color); padding: 10px 15px; margin-bottom: 15px; background: rgba(0,0,0,0.2); line-height: 1.6;">
            <h3 style="color: var(--highlight-color); margin-bottom: 15px;">[ DEEP DIVE: YAMAHA YM2149 (ATARI ST) ]</h3>
            <p>Der Yamaha YM2149 war der akustische Herzschlag der 16-Bit Atari ST Serie – ein scheinbar primitiver Chip mit einer spektakulären Entwicklungsgeschichte.</p>

            <h4 style="color: var(--highlight-color); margin: 25px 0 5px 0;">> HISTORIE: SHIRAZ SHIVJIS COST-CUT-HACK & DIE RETTUNG DES 'JACKINTOSH'</h4>
            <p>Als Jack Tramiel Commodore im Streit verließ und 1984 die Reste von Atari kaufte, beauftragte er seinen genialen Chefdesigner <strong>Shiraz Shivji</strong> (der zuvor am C64 mitgearbeitet hatte), in weniger als einem Jahr einen extrem günstigen Macintosh-Killer (den "Atari ST") zu entwerfen. Jedes Bauteil musste auf den Cent genau kalkuliert werden. Um den Preis für teure dedizierte I/O-Controller-Chips zu sparen, vollbrachte Shivji einen legendären Hacker-Trick: Er wählte den spottbilligen Yamaha YM2149 (einen optimierten Lizenzbau des 1978er AY-3-8910 von General Instrument) und <strong>missbrauchte dessen freie I/O-Ports als System-Rückgrat</strong>.</p>
            <p>Auf dem Atari ST steuert der Soundchip deshalb nicht nur Töne, sondern über seine physischen Pins (I/O Port A) direkt: Die Laufwerksauswahl des Diskettenlaufwerks (Drive A/B Select, Side Select), das Strobe-Signal für den Druckerport, die Steuerleitungen für das RS-232-Modem sowie die Selektionssignale für die MIDI- und Tastatur-Controller! Ein Ausfall des Soundchips führte somit zum sofortigen Stillstand des gesamten Computers.</p>

            <h3 style="color: var(--highlight-color); margin: 30px 0 15px 0;">[ CHIP-SPECS: EMULIERTE HARDWARE-KOMPONENTEN & SCENE-TRICKS ]</h3>
            <p>Der YM2149 besitzt keinerlei analoge Filter oder native PCM-Sample-Wandler. Um dem Chip dennoch komplexe Klänge zu entlocken, mussten die Musik-Magier der ST-Demoszene tief in die Trickkiste greifen. Unsere Synthese-Cores emulieren diese Hardware-Kniffe detailgetreu:</p>

            <h4 style="color: var(--highlight-color); margin: 20px 0 5px 0;">> DIE OSZILLATOREN (CH A, B, C)</h4>
            <p>Drei reine, harsche Rechteck-Generatoren. Die Frequenzsteuerung erfolgt über einen 12-Bit-Teilerwert. Je kleiner der Registerwert, desto schneller schwingt die Phase. (Tipp: Beobachte im HUD die Sparklines im Live-Oszillogramm pro Kanal!)</p>

            <h4 style="color: var(--highlight-color); margin: 20px 0 5px 0;">> DER NOISE-GENERATOR (N-FREQ)</h4>
            <p>Ein 5-Bit Linear Feedback Shift Register (LFSR), das pseudozufälliges "weißes Rauschen" erzeugt. Durch rasant schnelles Umschalten der Noise-Frequenz emulierten Coder knackige Snare-Drums und zischende Hi-Hats, die im Mischer flexibel auf die 3 Spuren geroutet werden konnten.</p>

            <h4 style="color: var(--highlight-color); margin: 20px 0 5px 0;">> HARDWARE ENVELOPE GENERATOR (HEG) & DER HIPPEL-SID-HACK</h4>
            <p>Der Chip besitzt eigentlich nur eine einzige, starre Hüllkurve (HEG) mit 16 vordefinierten Mustern. <strong>Jochen Hippel (Mad Max)</strong> fand jedoch heraus: Wenn man die HEG-Frequenz über Software-Timer extrem hochreißt (in den hörbaren Bereich), fängt die Hüllkurve selbst an zu schwingen. Koppelmen wir diesen "Hippel-Hack" mit den Rechteck-Generatoren, entstehen resonante, synthetische Dreieckswellen – die berühmten "ST-SID-Voices", die im HUD das rote <em>HEG-LED</em> zum Leuchten bringen.</p>

            <h4 style="color: var(--highlight-color); margin: 20px 0 5px 0;">> YM6 SPEC: DIE DIGIDRUMS (DIGI HACK)</h4>
            <p>Da der YM2149 keine D/A-Wandler besitzt, nutzten Coder wie **Arnaud Carré (Leonard)** hochfrequente CPU-Timer-Interrupts, um die 4-Bit-Lautstärkeregister im Kilohertz-Bereich direkt mit Sample-Amplituden zu füttern (Pulse Code Modulation). Das von uns emulierte **YM6-Format** fängt diese Register-Hacks ab, leitet sie an die rote <em>Global-Trig-LED</em> im HUD weiter und rendert die legendären 4-Bit-Trommelschläge glasklar im Stereo-Raum.</p>
        </div>
    `
};