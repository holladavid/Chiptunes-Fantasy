export const hippelTrack = {
    title: "1. Jochen Hippel - Wings of Death (Style)",
    composerInfo: `
        <h3>Yamaha YM2149 (Atari ST)</h3>
        <p>Der YM2149 ist ein rudimentärer Programmable Sound Generator (PSG). Er besitzt 3 reine Rechteckwellen-Kanäle und einen Noise-Generator (LFSR).</p>
        <hr style="border:1px dashed var(--text-color); margin: 10px 0;">
        <h3>Composer: Jochen Hippel (Mad Max)</h3>
        <p>Als Mitglied der Gruppe 'The Carebears' dominierte Hippel die Atari-Szene. Er brachte den starren Atari-Chip durch brutale Interrupt-Programmierung zum Singen.</p>
    `,
    generator: function() {
        let data = [];
        const arpCMinor = [478, 401, 318], arpDSharp = [401, 318, 253];
        const bassC = [955], bassDSharp = [803];
        for (let i = 0; i < 200; i++) {
            let frame = new Uint8Array(14);
            frame[7] = 0xDC;
            let bar = Math.floor(i / 100);
            let currentBass = bar === 0 ? bassC[0] : bassDSharp[0];
            frame[0] = currentBass & 0xFF; frame[1] = (currentBass >> 8) & 0x0F;
            frame[8] = Math.max(15 - (i % 12), 0);
            let currentArpChord = bar === 0 ? arpCMinor : arpDSharp;
            let arpNote = currentArpChord[i % 3];
            frame[2] = arpNote & 0xFF; frame[3] = (arpNote >> 8) & 0x0F;
            frame[9] = 10;
            frame[6] = 15; 
            if (i % 24 === 0) frame[10] = 15; else if (i % 12 === 0) frame[10] = 8; else frame[10] = 0;
            data.push(frame);
        }
        return data;
    }
};