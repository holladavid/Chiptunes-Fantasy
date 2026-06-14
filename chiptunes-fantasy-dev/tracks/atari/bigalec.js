export const bigAlecTrack = {
    title: "2. Big Alec - Syntax Terror (Style)",
    composerInfo: `
        <h3>Der Sound der Megademos</h3>
        <p>Während viele versuchten, den YM2149 sanft klingen zu lassen, umarmte Big Alec (Delta Force) den rohen, aggressiven Charakter der Chiptune-Rechteckwellen. Seine treibenden Basslines nutzen rasend schnelle Oktavsprünge, die sofort ins Ohr gehen.</p>
    `,
    generator: function() {
        let data = [];
        const e2 = 1432, e3 = 716, g3 = 601, a3 = 536, b3 = 477;
        const melody = [e3, g3, a3, b3, e3, b3, a3, g3];
        for (let i = 0; i < 320; i++) {
            let frame = new Uint8Array(14);
            let bassNote = ((i % 10) >= 5) ? e3 : e2;
            frame[0] = bassNote & 0xFF; frame[1] = (bassNote >> 8) & 0x0F;
            frame[8] = Math.max(15 - (i % 5) * 2, 0);
            let leadNote = melody[Math.floor(i / 10) % melody.length];
            frame[2] = leadNote & 0xFF; frame[3] = (leadNote >> 8) & 0x0F;
            frame[9] = Math.max(12 - (i % 10), 0);
            if (i % 20 === 0) { frame[4] = 200; frame[5] = 2; frame[6] = 15; frame[10] = 15; frame[7] = 0xF4; } 
            else if ((i + 10) % 20 === 0) { frame[6] = 6; frame[10] = 15; frame[7] = 0xDC; } 
            else if (i % 5 === 0) { frame[6] = 2; frame[10] = 6; frame[7] = 0xDC; } 
            else { frame[10] = 0; frame[7] = 0xFC; }
            data.push(frame);
        }
        return data;
    }
};