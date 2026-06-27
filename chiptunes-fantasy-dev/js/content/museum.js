// === js/content/museum.js ===
// ==========================================
// DAS DIGITALE MUSEUM (Texte & Handbücher)
// Mit präzisierten C64 SID Filter-Spezifikationen
// ==========================================

export const systemDescriptions = {
c64: `
        <!-- === TECHNICAL SPECIFICATION GRID (C64 SID 6581) === -->
        <!-- Schriftgröße vergrößert auf 1.2x (entspricht 12px bei 10px Basis) -->
        <div style="border: 2px solid var(--text-color); padding: 8px 12px; margin-bottom: 20px; font-size: calc(var(--font-size-base) * 1.2); background: rgba(0,0,0,0.3); font-family: monospace;">
            <p style="color: var(--highlight-color); margin-bottom: 8px; font-weight: bold; border-bottom: 1px dashed var(--text-color); padding-bottom: 4px;">>>> HARDWARE SPECIFICATIONS:</p>
            <div style="display: grid; grid-template-columns: 140px 1fr; gap: 6px; line-height: 1.4;">
                <!-- KORREKTUR: Filter-Architektur präzisiert -->
                <div><strong>Kanäle:</strong></div><div>3 unabhängige Synthesestimmen + 1 routbares analoges VCF</div>
                <div><strong>Taktfrequenz:</strong></div><div>985.248 Hz (PAL) / 1.022.727 Hz (NTSC)</div>
                <div><strong>Wellenformen:</strong></div><div>Dreieck, Sägezahn, PWM, Rauschen (23-Bit LFSR), analoge Gatter-Mischungen</div>
                <div><strong>Analog-Filter:</strong></div><div>12dB/Okt Multimode-Filter (LP/BP/HP/Notch) mit frei wählbarer Stimmen-Zuweisung</div>
                <div><strong>Hüllkurven:</strong></div><div>3 x ADSR (15-Bit Rate-Counter, exponentielle Kondensator-Entladung)</div>
                <div><strong>Sequenzierung:</strong></div><div>Freie 6502-Assembler-Player via PAL-VBLANK (50Hz) o. CIA-Timer</div>
            </div>
        </div>

        <div style="border-left: 4px solid var(--text-color); padding: 10px 15px; margin-bottom: 15px; background: rgba(0,0,0,0.2); line-height: 1.6;">
            <h3 style="color: var(--highlight-color); margin-bottom: 5px;">[ DEEP DIVE: MOS TECHNOLOGY SID 6581 ]</h3>
            <p>Der Sound Interface Device (SID), 1981 von Bob Yannes entworfen, ist ein analoger subtraktiver Synthesizer auf einem einzigen Silizium-Chip. Er besitzt 3 Oszillatoren (Sägezahn, Dreieck, Rechteck, Rauschen), individuelle ADSR-Generatoren und ein analoges Multimode-Filter.</p>

            <h4 style="color: var(--highlight-color); margin: 20px 0 5px 0;">> DIE ANALOGE FILTER-ROUTING-MATRIX ($D417)</h4>
            <p>Der SID besitzt auf dem Silizium genau einen physischen Filter-Schaltkreis (VCF). Coder konnten in Register <strong>$D417</strong> über einzelne Schalter (Bits) für jede der 3 Stimmen entscheiden, ob sie den Filter durchlaufen oder ihn umgehen (Bypass).<br>
            <strong>🎵 Szene-Trick:</strong> Komponisten schickten oft nur die fette Bassline (Stimme 1) in den Filter, um sie per LFO "wabbeln" zu lassen, während die schnellen Arpeggios und Drums (Stimme 2 & 3) ungefiltert direkt zum Master-Out liefen, um kristallklar und aggressiv zu bleiben. (Tipp: Beobachte im HUD die LEDs unter <em>Routing (V1/V2/V3)</em>!)</p>

            <h4 style="color: var(--highlight-color); margin: 20px 0 5px 0;">> THERMAL CUTOFF DRIFT (DIE HITZE DES C64)</h4>
            <p>Der analoge Filter des MOS 6581 war extrem temperaturempfindlich. Wenn der C64 lief, heizte sich der Chip im Gehäuse massiv auf, was den Widerstand der internen FET-Transistoren veränderte. Das Resultat: Die Grenzfrequenz (Cutoff) des Filters rutschte ab. Ein Track, den Rob Hubbard nach 5 Stunden an einem heißen Sommernachmittag perfekt und "cremig" abgemischt hatte, klang am nächsten Morgen im eiskalten Studio plötzlich viel zu schrill und beißend!</p>
            <p style="margin-top: 5px;"><strong>Mit dem <em>TEMP</em>-Regler</strong> kannst du genau dieses Klima nun selbst steuern. Zieh ihn auf eiskalte <strong>15°C</strong> für brillante, aggressiv schneidende Höhen, oder auf glühende <strong>75°C</strong> für den legendären, warm-sättigenden und dumpfen Sound. Was damals der Albtraum für C64-Coder war, ist heute dein Spielplatz.</p>

            <h4 style="color: var(--highlight-color); margin: 20px 0 5px 0;">> DER HUBBARD'SCHE RAUSCH-ZUFALLS-HACK ($D41B)</h4>
            <p>Rob Hubbard (Komponist von <em>Commando</em> und <em>Delta</em>) stand vor dem Problem, dass der C64 keinen mathematischen Zufallsgenerator besitzt, um dynamische Snare-Drums und Hi-Hats zu berechnen. Seine geniale Lösung: Er schaltete Oszillator 3 auf Rauschen und las in seiner Play-Routine kontinuierlich das Hardware-Register <strong>$D41B (Voice 3 Waveform Output)</strong> aus. Die fluktuierenden Rohdaten nutzte er direkt als Hardware-Zufallszahlen für seine peitschenden Percussions!</p>

            <h4 style="color: var(--highlight-color); margin: 20px 0 5px 0;">> DIE 3-STIMMEN-POLYPHONIE-FALLE (ARPEGGIOS)</h4>
            <p>Da der SID nur über 3 Stimmen verfügt, mussten Musiker tricksen, um dreistimmige Akkorde plus Bass und Melodie abzubilden. Sie koppelten die Akkord-Noten (z. B. Grundton, kleine Terz, Quinte) in einer schnellen 50Hz-VBLANK-Routine auf einer einzigen Stimme. Durch das rasant schnelle Umschalten der Frequenz entsteht das berühmte "Flirren" (Arpeggio), das dem menschlichen Ohr einen echten, dreistimmigen Akkord vorgaukelt.</p>

            <h4 style="color: var(--highlight-color); margin: 20px 0 5px 0;">> DER GALWAY VOLUME-ECHO-HACK ($D418)</h4>
            <p>Martin Galway (Komponist von <em>Wizball</em>) fand heraus, dass man den SID zwingen kann, digitale Samples (PCM) abzuspielen, indem man das globale Lautstärkeregister <strong>$D418</strong> mit einer Frequenz von mehreren Kilohertz beschreibt. Dieser Hardware-Hack modulierte die DC-Spannung des Chips so schnell, dass ein hörbarer digitaler 4-Bit Soundstrom entstand.</p>

            <h4 style="color: var(--highlight-color); margin: 20px 0 5px 0;">> DYNAMISCHE PULSWEITENMODULATION (PWM)</h4>
            <p>Um dünne Synth-Klänge extrem "fett" und schwebend klingen zu lassen, modulierten Coder die Rechteckbreite (Pulse Width) über sinusförmige Software-LFOs. Das erzeugte ein sattes chorusschwebendes Klangbild, das klingt, als spielten mehrere Oszillatoren gleichzeitig.</p>
        </div>
    `,
   amiga: `
        <!-- === TECHNICAL SPECIFICATION GRID (AMIGA MOS PAULA 8364) === -->
        <!-- Schriftgröße auf harmonische 0.85x zurückgesetzt (entspricht 15.3px bei 18px Basis) -->
        <div style="border: 2px solid var(--text-color); padding: 8px 12px; margin-bottom: 20px; font-size: calc(var(--font-size-base) * 0.85); background: rgba(0,0,0,0.3); font-family: monospace;">
            <p style="color: var(--highlight-color); margin-bottom: 8px; font-weight: bold; border-bottom: 1px dashed var(--text-color); padding-bottom: 4px;">>>> HARDWARE SPECIFICATIONS:</p>
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
            <h3 style="color: var(--highlight-color); margin-bottom: 5px;">[ CHIP-SPECS: MOS PAULA 8364 (AMIGA 500) ]</h3>
            <p>Paula war ein reiner DMA-Sample-Player, der 4 unabhängige PCM-Kanäle direkt aus dem Chip-RAM auslas. Um den typischen "Amiga 500 Sound" exakt nachzubilden, emuliert dieser Standard-Core zwei hardware-spezifische Bausteine:</p>

            <h4 style="color: var(--highlight-color); margin: 15px 0 5px 0;">> BIT-GENAUE DAC-MULTIPLIKATION</h4>
            <p>Das D/A-Wandler-System multipliziert das vorzeichenbehaftete 8-Bit-Sample in Echtzeit mit dem 6-Bit-Lautstärkeregister (0-64). Das resultiert in einer 14-Bit Digitalauflösung mit dem berühmt-berüchtigten, erdigen "Crunch" und metallischen Spiegelfrequenzen (Aliasing) im Hochtonbereich.</p>

            <h4 style="color: var(--highlight-color); margin: 15px 0 5px 0;">> STATISCHER ANALOG-FILTER (6 dB/oct)</h4>
            <p>Ein permanenter Tiefpass-Filter (RC-Schaltung), der im originalen Amiga 500 bei genau <strong>4.420,97 Hz</strong> einsetzt, um hochfrequentes Digitalrauschen sachte abzufedern.</p>

            <h4 style="color: var(--highlight-color); margin: 15px 0 5px 0;">> DYNAMISCHER LED-FILTER (12 dB/oct)</h4>
            <p>Ein zuschaltbarer Butterworth-Filter 2. Ordnung bei genau <strong>3.090,53 Hz</strong> ($Q = 0,660$). Er wurde im Original durch das CIA-Register gesteuert (welches auch die Helligkeit der Power-LED dimmte), um den Ton besonders warm und dumpf klingen zu lassen.</p>
        </div>
    `,
    atari: `
        <!-- === TECHNICAL SPECIFICATION GRID (ATARI YM2149F) === -->
        <div style="border: 2px solid var(--text-color); padding: 8px 12px; margin-bottom: 20px; font-size: calc(var(--font-size-base) * 0.75); background: rgba(0,0,0,0.3); font-family: monospace;">
            <p style="color: var(--highlight-color); margin-bottom: 8px; font-weight: bold; border-bottom: 1px dashed var(--text-color); padding-bottom: 4px;">>>> HARDWARE SPECIFICATIONS:</p>
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
            <h3 style="color: var(--highlight-color); margin-bottom: 15px;">[ DEEP DIVE: YM2149F ARCHITEKTUR ]</h3>
            <p>Der Yamaha YM2149 (im Atari ST mit 2 MHz getaktet) ist ein puristischer Rechteck-Synthesizer. Er hat keine analogen Filter, aber eine geniale, rohe digitale Architektur. Hier erfährst du, was die Live-Werte im DSP-Analyzer (oben rechts) bedeuten:</p>

            <h4 style="color: var(--highlight-color); margin: 20px 0 5px 0;">> DIE OSZILLATOREN (CH A, B, C)</h4>
            <p>Drei reine Rechteckwellen. Die Tonhöhe (Pitch) wird über einen 12-Bit Timer gesteuert. <em>Vorsicht, Counter-Logic:</em> Es ist ein Teiler-Wert! Je kleiner die Zahl im Register, desto höher der Ton (Hertz = Takt / (16 * Period)).</p>

            <h4 style="color: var(--highlight-color); margin: 20px 0 5px 0;">> DER NOISE-GENERATOR (N-FREQ)</h4>
            <p>Ein 5-Bit Linear Feedback Shift Register (LFSR), das pseudozufälliges "weißes Rauschen" generiert. Die Frequenz bestimmt, wie "hell" oder "dumpf" das Rauschen klingt.<br>
            <strong>🎵 Szene-Trick:</strong> Musiker änderten die Noise-Frequenz rasend schnell, um aus dem statischen Rauschen knackige Snare-Drums und zischende Hi-Hats zu formen.</p>

            <h4 style="color: var(--highlight-color); margin: 20px 0 5px 0;">> DER MIXER (TONE & NOISE)</h4>
            <p>Das logische Herz des Chips. Für jeden der 3 Kanäle kann man Rechteckwelle (Tone) und Rauschen (Noise) separat ein- oder ausschalten.<br>
            <strong>🎵 Szene-Trick:</strong> Legt man auf einen Kanal Tone UND Noise gleichzeitig, entsteht ein rauer, metallischer Klang – perfekt für elektronische Percussion.</p>

            <h4 style="color: var(--highlight-color); margin: 20px 0 5px 0;">> HARDWARE ENVELOPE GENERATOR (HEG)</h4>
            <p>Eigentlich gedacht, die Lautstärke ohne CPU-Last zu formen (16 feste Shapes). Ein Kanal nutzt den HEG, wenn die <strong>HEG-LED</strong> im HUD leuchtet.<br>
            <strong>💡 Der Hippel-Hack:</strong> Jochen Hippel setzte die HEG-Frequenz so extrem hoch an, dass die Hüllkurve selbst hörbar wurde! Er nutzte die wilden HEG-Shapes, um die menschliche Stimme ("Tha-li-on" Intro) zu simulieren.</p>

            <h4 style="color: var(--highlight-color); margin: 20px 0 5px 0;">> YM6 SPEC: DIE DIGIDRUMS (DIGI HACK)</h4>
            <p>Hardwareseitig besitzt der YM2149 **keine** D/A-Wandler für PCM-Sprachsamples oder Trommeln. ST-Coder behalfen sich mit hochfrequenten CPU-Software-Timern (wie dem MFP 68901), um die 4-Bit-Lautstärkeregister (R8, R9, R10) direkt im Kilohertz-Bereich mit analogen Pegeln zu beschreiben.</p>
            <p style="margin-top: 5px;"><strong>Das Format-Geheimnis von Arnaud Carré (Leonard):</strong> Um diese emulierten Trommel-Hits platzsparend im datei-komprimierten <code>.ym</code>-Registerdump zu hinterlegen, erfand er ein geniales Meta-Protokoll für das <strong>YM6-Format</strong>. Da die oberen Bits der Pitch-Feinabstimmungsregister (R1 und R3) physisch ungenutzt sind, codierte er dort die Trigger!</p>
            <p style="font-size: 0.9em; margin-left: 10px; color: var(--text-color); opacity: 0.8;">
                &gt; <strong>Bit 6-7 von R1 oder R3 = 01:</strong> Signaliert unserer Engine einen aktiven Digidrum-Start!<br>
                &gt; <strong>Bit 4-5 von R1 oder R3:</strong> Bestimmt, welcher Kanal (01: Voice A, 10: Voice B, 11: Voice C) gehijackt wird.<br>
                &gt; Das zugehörige Volume-Register (R8, R9 oder R10) transportiert in diesem Frame anstelle der Lautstärke die 5-Bit ID des eingebetteten PCM-Trommelsamples.<br>
                &gt; Unsere Engine fängt diesen Hardware-Hack ab, startet das Sample, leitet die emulierten Trigger-Infos an die rote <strong>Global-Trig-LED</strong> im HUD weiter und schreibt die Sample-Nummer live in die Zeile <strong>Digi Hack</strong> des betroffenen Kanals!
            </p>
        </div>
    `
};

export const chipCheatSheets = {
    atari: `
        <strong>YM2149 Cheat Sheet:</strong><br>
        <span style="color:#fff">R00-R05:</span> Pitch A/B/C (Fine & Coarse)<br>
        <span style="color:#fff">R06:</span> Noise Frequency<br>
        <span style="color:#fff">R07:</span> Mixer (Bit 0-2 Tone, 3-5 Noise)<br>
        <span style="color:#fff">R08-R0A:</span> Volume A/B/C (Bit 4 = HEG Mode)<br>
        <span style="color:#fff">R0B-R0C:</span> Hardware Envelope (HEG) Period<br>
        <span style="color:#fff">R0D:</span> HEG Shape (Saw, Triangle, etc.)<br>
        <span style="color:#fff">R0F:</span> Geheimer Digidrum-Trigger!
    `,
    c64: `
        <strong>SID 6581 Cheat Sheet:</strong><br>
        <span style="color:#fff">R00-R06:</span> Voice 1 (Freq, PW, Ctrl, AD, SR)<br>
        <span style="color:#fff">R07-R0D:</span> Voice 2 (Freq, PW, Ctrl, AD, SR)<br>
        <span style="color:#fff">R0E-R14:</span> Voice 3 (Freq, PW, Ctrl, AD, SR)<br>
        <span style="color:#fff">R15-R16:</span> Filter Cutoff Frequency<br>
        <span style="color:#fff">R17:</span> Resonance & Voice Routing<br>
        <span style="color:#fff">R18:</span> Filter Mode & Master Volume
    `,
    amiga: `
        <strong>PAULA DMA Cheat Sheet:</strong><br>
        (Hardware via Software repräsentiert)<br>
        <span style="color:#fff">CH1-CH4 (je 4 Bytes):</span><br>
        [0-1]: Periode (Pitch)<br>
        [2]: Volume (0-64)<br>
        [3]: Trigger-Status (Aktiv/Inaktiv)
    `
};