export const jesterTrack = {
    title: "1. Jester (Sanity) - Elysium (Style)",
    composerInfo: `
        <h3>MOS Paula 8364 (Amiga)</h3>
        <p>1985 veränderte der Commodore Amiga alles. Paula war ein reiner PCM-Sample-Player mit DMA (Direct Memory Access). Er griff autark auf den Arbeitsspeicher zu und spielte echte, digitalisierte Klänge ab.</p>
        <hr style="border:1px dashed var(--text-color); margin: 10px 0;">
        <h3>Composer: Jester (Volker Tripp)</h3>
        <p>Jester von der Demogroup 'Sanity' war ein absoluter Meister des 4-Kanal MOD-Formats. Er überzeugte durch extrem saubere, perkussive Samples und funkige Grooves.</p>
    `,
    generator: function() {
        let data = [];
        const pC3 = 428, pDs3 = 360, pG3 = 285, pAs3 = 240;
        const pC2 = 856, pDs2 = 720;
        for (let i = 0; i < 400; i++) {
            let frameData = { isAmiga: true, cmds: [] };
            if (i % 20 === 0) frameData.cmds.push({ ch: 0, smp: 'kick', per: pC3, vol: 64 });
            let bassNote = ((i % 10) >= 5) ? pDs2 : pC2;
            if (i % 5 === 0) frameData.cmds.push({ ch: 1, smp: 'bass', per: bassNote, vol: 40 });
            else frameData.cmds.push({ ch: 1, smp: null, per: bassNote, vol: Math.max(40 - (i % 5) * 8, 0) });
            if (i % 80 === 40) frameData.cmds.push({ ch: 2, smp: 'chord', per: pC3, vol: 48 });
            else if (i % 80 === 70) frameData.cmds.push({ ch: 2, smp: 'chord', per: pDs3, vol: 24 });
            let leadNotes = [pC3, pDs3, pG3, pAs3];
            if (i % 4 === 0) frameData.cmds.push({ ch: 3, smp: 'bass', per: leadNotes[(i / 4) % leadNotes.length], vol: 20 });
            data.push(frameData);
        }
        return data;
    }
};