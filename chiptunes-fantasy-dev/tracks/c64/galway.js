export const galwayTrack = {
    title: "2. Martin Galway - Ocean Loader (Style)",
    composerInfo: `
        <h3>Der Galway Echo-Hack</h3>
        <p>Wenn Hubbard der Rocker des C64 war, war Martin Galway der Pink Floyd der Chiptunes. Er erschuf extrem atmosphärische, melancholische Soundscapes (wie in der bekannten *Ocean Loader* Musik). Er nutzte bevorzugt die Dreieckswelle für glockenartige Melodien.</p>
        <p><strong>Tech-Deep-Dive:</strong><br>
        Der SID-Chip hatte keine eingebauten Echo- oder Delay-Effekte. Galway fand heraus, dass man die CPU nutzen konnte, um das 4-Bit-Lautstärkeregister (Master Volume) des SID 50 Mal pro Sekunde blitzschnell laut und leise zu schalten. So entstand in Software ein Echo-Effekt.</p>
    `,
    generator: function() {
        let data = [];
        const fC4 = 8908, fD4 = 10000, fE4 = 11223, fG4 = 13350;
        for (let i = 0; i < 400; i++) {
            let frame = { isC64: true, regs: new Uint8Array(29) };
            frame.regs[21] = 0; frame.regs[22] = 200; frame.regs[23] = 0;
            let echoVol = 15 - (i % 8); 
            frame.regs[24] = Math.max(echoVol, 5);
            let melody = [fC4, fD4, fE4, fG4, fE4, fD4];
            let note = melody[Math.floor(i / 16) % melody.length];
            frame.regs[0] = note & 0xFF; frame.regs[1] = (note >> 8) & 0xFF;
            frame.regs[4] = (i % 16 < 14) ? 17 : 16;
            let arpNotes = [fC4 / 2, fE4 / 2, fG4 / 2];
            let arpNote = arpNotes[i % 3];
            frame.regs[7] = arpNote & 0xFF; frame.regs[8] = (arpNote >> 8) & 0xFF;
            frame.regs[11] = 33; 
            frame.regs[14] = (fC4 / 4) & 0xFF; frame.regs[15] = ((fC4 / 4) >> 8) & 0xFF;
            frame.regs[16] = 2048 & 0xFF; frame.regs[17] = (2048 >> 8) & 0x0F;
            frame.regs[18] = (i % 10 === 0) ? 65 : 64;
            data.push(frame);
        }
        return data;
    }
};