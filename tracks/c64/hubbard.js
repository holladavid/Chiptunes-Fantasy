export const hubbardTrack = {
    title: "1. Rob Hubbard - Commando (Style)",
    composerInfo: `
        <h3>MOS Technology 6581 (SID)</h3>
        <p>Der Sound Interface Device (SID), 1981 von Bob Yannes entworfen, ist eine absolute Ausnahmeerscheinung in der Welt der Homecomputer. Während andere Chips nur starre Töne abspielten, ist der SID ein echter, subtraktiver Analogsynthesizer in einem einzigen Silizium-Chip.</p>
        <p><strong>Tech-Deep-Dive:</strong><br>
        Der Chip besitzt 3 Oszillatoren mit Dreieck, Sägezahn, Rechteck und Noise. Das Geheimnis des fetten Sounds ist die <em>Pulsweitenmodulation (PWM)</em>. Durch dynamisches Verändern der Rechteckbreite entsteht ein "wabernder", schwebender Klang.</p>
        <hr style="border:1px dashed var(--text-color); margin: 10px 0;">
        <h3>Composer: Rob Hubbard</h3>
        <p>Der britische Komponist Rob Hubbard ist der unangefochtene Rockgott des C64. Er ignorierte die von Commodore gelieferten Sound-Routinen und schrieb eigene, pfeilschnelle Maschinencode-Treiber.</p>
    `,
    generator: function() {
        let data = [];
        const fC2 = 2227, fDs2 = 2649; 
        const fC3 = 4454, fDs3 = 5298, fF3 = 5947, fG3 = 6675;
        for (let i = 0; i < 400; i++) {
            let frame = { isC64: true, regs: new Uint8Array(29) };
            let cutoff = 50 + Math.floor(Math.sin(i * 0.05) * 40); 
            frame.regs[21] = cutoff & 7; frame.regs[22] = cutoff >> 3; 
            frame.regs[23] = (8 << 4) | 3; frame.regs[24] = 16 | 15; 
            let bassNote = (Math.floor(i / 20) % 2 === 0) ? fC2 : fDs2;
            frame.regs[0] = bassNote & 0xFF; frame.regs[1] = (bassNote >> 8) & 0xFF;
            let pw = 2048 + Math.floor(Math.sin(i * 0.1) * 1500);
            frame.regs[2] = pw & 0xFF; frame.regs[3] = (pw >> 8) & 0x0F;
            frame.regs[4] = (i % 10 === 9) ? 64 : 65; 
            let leadNotes = [fC3, fC3, fDs3, fG3, fF3, fDs3];
            let leadNote = leadNotes[Math.floor(i / 15) % leadNotes.length];
            frame.regs[7] = leadNote & 0xFF; frame.regs[8] = (leadNote >> 8) & 0xFF;
            frame.regs[11] = (i % 15 === 14) ? 32 : 33; 
            if (i % 20 === 0) { frame.regs[14] = 0; frame.regs[15] = 10; frame.regs[18] = 129; } 
            else if ((i + 10) % 20 === 0) { frame.regs[14] = 0; frame.regs[15] = 40; frame.regs[18] = 129; } 
            else { frame.regs[18] = 128; }
            data.push(frame);
        }
        return data;
    }
};