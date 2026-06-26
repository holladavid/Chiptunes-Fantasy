// === js/content/museum.js ===
// ==========================================
// DAS DIGITALE MUSEUM (Texte & Handbücher)
// ==========================================

export const systemDescriptions = {
c64: `
        <div style="border-left: 4px solid var(--text-color); padding: 10px 15px; margin-bottom: 15px; background: rgba(0,0,0,0.2); line-height: 1.6;">
            <h3 style="color: var(--highlight-color); margin-bottom: 5px;">[ DEEP DIVE: MOS TECHNOLOGY SID 6581 ]</h3>
            <p>Der Sound Interface Device (SID), 1981 von Bob Yannes entworfen, ist ein analoger subtraktiver Synthesizer auf einem einzigen Silizium-Chip. Er besitzt 3 Oszillatoren (Sägezahn, Dreieck, Rechteck, Rauschen), individuelle ADSR-Generatoren und ein analoges Multimode-Filter.</p>

            <h4 style="color: var(--highlight-color); margin: 20px 0 5px 0;">> THERMAL CUTOFF DRIFT (DIE HITZE DES C64)</h4>
            <p>Der analoge Filter des MOS 6581 war extrem temperaturempfindlich. Wenn der C64 lief, heizte sich der Chip im Gehäuse massiv auf, was den Widerstand der internen FET-Transistoren veränderte. Das Resultat: Die Grenzfrequenz (Cutoff) des Filters rutschte ab. Ein Track, den Rob Hubbard nach 5 Stunden an einem heißen Sommernachmittag perfekt und "cremig" abgemischt hatte, klang am nächsten Morgen im eiskalten Studio plötzlich viel zu schrill und beißend!</p>
            <p style="margin-top: 5px;"><strong>Mit dem <em>TEMP</em>-Regler</strong> kannst du genau dieses Klima nun selbst steuern. Zieh ihn auf eiskalte <strong>15°C</strong> für brillante, aggressiv schneidende Höhen, oder auf glühende <strong>75°C</strong> für den legendären, warm-sättigenden und dumpfen Sound. Was damals der Albtraum für C64-Coder war, ist heute dein Spielplatz.</p>

            <h4 style="color: var(--highlight-color); margin: 20px 0 5px 0;">> DER HUBBARD'SCHE RAUSCH-ZUFALLS-HACK ($D41B)</h4>
            <p>Rob Hubbard (Komponist von <em>Commando</em> und <em>Delta</em>) stand vor dem Problem, dass der C64 keinen mathematischen Zufallsgenerator besitzt, um dynamische Snare-Drums und Hi-Hats zu berechnen. Seine geniale Lösung: Er schaltete Oszillator 3 auf Rauschen und las in seiner Play-Routine kontinuierlich das Hardware-Register <strong>$D41B (Voice 3 Waveform Output)</strong> aus. Die fluktuierenden Rohdaten nutzte er direkt als Hardware-Zufallszahlen für seine peitschenden Percussions!</p>

            <h4 style="color: var(--highlight-color); margin: 20px 0 5px 0;">> DIE 3-STIMMEN-POLYPHONIE-FALLE (ARPEGGIOS)</h4>
            <p>Da der SID nur über 3 Stimmen verfügt, mussten Musiker tricksen, um dreistimmige Akkorde plus Bass und Melodie abzubilden. Sie koppelten die Akkord-Noten (z. B. Grundton, kleine Terz, Quinte) in einer schnellen 50Hz-VBLANK-Routine auf einer einzigen Stimme. Durch das rasing schnelle Umschalten der Frequenz entsteht das berühmte "Flirren" (Arpeggio), das dem menschlichen Ohr einen echten, dreistimmigen Akkord vorgaukelt.</p>

            <h4 style="color: var(--highlight-color); margin: 20px 0 5px 0;">> DER GALWAY VOLUME-ECHO-HACK ($D418)</h4>
            <p>Martin Galway (Komponist von <em>Wizball</em>) fand heraus, dass man den SID zwingen kann, digitale Samples (PCM) abzuspielen, indem man das globale Lautstärkeregister <strong>$D418</strong> mit einer Frequenz von mehreren Kilohertz beschreibt. Dieser Hardware-Hack modulierte die DC-Spannung des Chips so schnell, dass ein hörbarer digitaler 4-Bit Soundstrom entstand.</p>

            <h4 style="color: var(--highlight-color); margin: 20px 0 5px 0;">> DYNAMISCHE PULSWEITENMODULATION (PWM)</h4>
            <p>Um dünne Synth-Klänge extrem "fett" und schwebend klingen zu lassen, modulierten Coder die Rechteckbreite (Pulse Width) über sinusförmige Software-LFOs. Das erzeugte ein sattes chorusschwebendes Klangbild, das klingt, als spielten mehrere Oszillatoren gleichzeitig.</p>
        </div>
    `,
   amiga: `
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
            <strong>🔥 Der Hippel-Hack:</strong> Jochen Hippel setzte die HEG-Frequenz so extrem hoch an, dass die Hüllkurve selbst hörbar wurde! Er nutzte die wilden HEG-Shapes, um die menschliche Stimme ("Tha-li-on" Intro) zu simulieren.</p>

            <h4 style="color: var(--highlight-color); margin: 20px 0 5px 0;">> PCM SAMPLES (DIGI HACK)</h4>
            <p>Hardwareseitig unterstützt der Chip <strong>keine</strong> Sprachsamples. Coder nutzten CPU-Timer, um 12.000 Mal pro Sekunde das Lautstärkeregister direkt zu überschreiben.<br>
            <strong>💾 Format-Geheimnis:</strong> Um diese PCM-Trigger in kleinen <code>.ym</code> Dateien zu speichern, versteckte Arnaud Carré (Leonard) die Sample-Nummer genial in den physikalisch ungenutzten Bits (Bit 4-7) der Pitch-Register.</p>
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