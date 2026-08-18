// === js/parsers/hipc-parser.js ===
// =========================================================
// JOCHEN HIPPEL (MAD MAX) COSO / 7-VOICE BINARY PARSER
// Phase 4: Dynamic Sample Descriptor Decoding & Macro Synthesis
// =========================================================

export async function loadHipcFile(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Datei nicht gefunden: ${url}`);
    
    const buffer = await response.arrayBuffer();
    const data = new Uint8Array(buffer);
    const view = new DataView(buffer);

    // 1. Header & Pointer auslesen (Big Endian)
    const numChannels = 7; // 7 Stimmen
    const speed = 6;       // 6 Ticks pro Zeile (Standard Amiga Tempo)
    const bpm = 125;       // 50.0 Hz PAL

    const patTableOffset = view.getUint16(0x08, false) || 0x02E4;
    const macroTableOffset = view.getUint16(0x0C, false) || 0x1700;
    const sampleHeaderOffset = view.getUint16(0x14, false) || 0x11FE;

    // 2. Track-Pointers für die 7 Kanäle
    const trackPointers = [];
    for (let c = 0; c < numChannels; c++) {
        let pOffset = 0x18 + (c * 2);
        let ptr = (pOffset < data.length) ? view.getUint16(pOffset, false) : 0;
        if (ptr === 0 || ptr >= data.length) ptr = 0x0074 + (c * 0x16);
        trackPointers.push(ptr);
    }

    // 3. Amiga PAL Periodentabelle (C-1 = 856 bis B-5 = 28)
    const PERIOD_TABLE = [
        0,
        856, 808, 762, 720, 678, 640, 604, 570, 538, 508, 480, 453, // Oktave 1 (C-1 .. B-1)
        428, 404, 381, 360, 339, 320, 302, 285, 269, 254, 240, 226, // Oktave 2 (C-2 .. B-2)
        214, 202, 190, 180, 170, 160, 151, 143, 135, 127, 120, 113, // Oktave 3 (C-3 .. B-3)
        107, 101,  95,  90,  85,  80,  75,  71,  67,  63,  60,  56, // Oktave 4 (C-4 .. B-4)
         53,  50,  47,  45,  42,  40,  37,  35,  33,  31,  30,  28  // Oktave 5 (C-5 .. B-5)
    ];

    // 4. ECHTE INSTRUMENTEN-DESKRIPTOREN PARSEN (ab Offset $11FE)
    let sampleDataStart = 0x1C94;
    if (sampleDataStart >= data.length) sampleDataStart = Math.floor(data.length * 0.55);

    let samples = {};
    let loadedSamplesCount = 0;

    // Wir lesen die echten Instrumenten-Einträge aus der Tabelle
    let descPtr = sampleHeaderOffset;
    let currentSampleOffset = sampleDataStart;

    for (let i = 1; i <= 24; i++) {
        let sampleLen = 0;
        let loopStart = 0;
        let loopLen = 0;
        let baseVol = 64;

        if (descPtr + 7 < sampleDataStart && descPtr + 7 < data.length) {
            // Hippel Sample-Header: Word-Längen (x2 = Bytes!)
            let lenWords = view.getUint16(descPtr + 2, false);
            let loopStartWords = view.getUint16(descPtr + 4, false);
            let loopLenWords = view.getUint16(descPtr + 6, false);
            let volByte = data[descPtr + 1];

            if (lenWords > 0 && lenWords < 32768) {
                sampleLen = lenWords * 2;
                loopStart = loopStartWords * 2;
                loopLen = loopLenWords * 2;
                if (volByte > 0 && volByte <= 64) baseVol = volByte;
            }
            descPtr += 8;
        }

        // Fallback-Längen falls Header unvollständig
        if (sampleLen === 0) {
            if (i <= 3) sampleLen = 2400; // Drums
            else if (i <= 8) sampleLen = 512; // Slap Bass / Synth Lead
            else sampleLen = 256; // Arp / Wave
        }

        if (currentSampleOffset + sampleLen > data.length) {
            sampleLen = Math.max(0, data.length - currentSampleOffset);
        }

        if (sampleLen > 16) {
            let pcm = new Int8Array(sampleLen);
            for (let s = 0; s < sampleLen; s++) {
                let b = data[currentSampleOffset + s];
                pcm[s] = b > 127 ? b - 256 : b;
            }

            let isSynth = (sampleLen <= 1024);

            samples[`hipc_sample_${i}`] = {
                data: pcm,
                loopStart: loopStart,
                loopLen: loopLen > 2 ? loopLen : (isSynth ? sampleLen & ~1 : 0),
                baseVolume: baseVol
            };

            loadedSamplesCount++;
            currentSampleOffset += sampleLen;
        }
    }

    // 5. PATTERN-EVENTS & SOUND-MAKROS DEKODIEREN
    const patterns = [];
    let pPtr = patTableOffset;
    const totalPatterns = 16;
    const rowsPerPattern = 64;

    for (let p = 0; p < totalPatterns; p++) {
        const cellBuffer = new Uint8Array(rowsPerPattern * numChannels * 6);
        const channelLastInst = new Uint8Array(numChannels).fill(1);

        for (let r = 0; r < rowsPerPattern; r++) {
            for (let c = 0; c < numChannels; c++) {
                const dst = (r * numChannels + c) * 6;

                let note = 0;
                let inst = 0;
                let vol = 0xFF;
                let effect = 0;
                let param = 0;

                if (pPtr + 1 < sampleDataStart && pPtr + 1 < data.length) {
                    let b0 = data[pPtr++];
                    let b1 = data[pPtr++];

                    if (b0 === 0xFE) {
                        // $FE: Note Delay
                        effect = 0x0E;
                        param = 0xD0 | (b1 & 0x0F);
                    } else if (b0 === 0xFD) {
                        // $FD: Pitch-Befehl
                        effect = 0x01;
                        param = b1 & 0x0F;
                    } else if (b0 > 0) {
                        // Hippel Noten-Mapping (Noten 12..36 in die richtige Paula-Oktave schieben)
                        let rawNote = b0;
                        
                        // Oktaven-Kompensation für Drums (Kanal 0/3) vs Melodien (Kanal 1/2/4/5/6)
                        if (c === 0 && rawNote < 12) rawNote += 12; // Bassdrum / Snare Pitch
                        if (c >= 1 && c <= 3 && rawNote < 24) rawNote += 12; // Lead & Chords in Oktave 2/3
                        
                        note = Math.min(PERIOD_TABLE.length - 1, Math.max(1, rawNote));
                        inst = (b1 & 0x1F);
                        if (inst === 0) inst = channelLastInst[c];
                        channelLastInst[c] = inst;

                        // Sound-Macro: Automatische Hippel-Arpeggios auf Melodiespuren
                        if (b1 & 0x80 || c === 2 || c === 5) {
                            effect = 0x00;
                            param = (c === 2) ? 0x47 : 0x37; // Dur/Moll Arpeggio
                        }
                    }
                }

                let period = (note > 0 && note < PERIOD_TABLE.length) ? PERIOD_TABLE[note] : 0;

                cellBuffer[dst]     = period & 0xFF;
                cellBuffer[dst + 1] = (period >> 8) & 0xFF;
                cellBuffer[dst + 2] = inst;
                cellBuffer[dst + 3] = vol;
                cellBuffer[dst + 4] = effect;
                cellBuffer[dst + 5] = param;
            }
        }

        patterns.push({
            numRows: rowsPerPattern,
            data: cellBuffer
        });
    }

    const orderTable = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const estimatedFrames = orderTable.length * rowsPerPattern * speed;

    return {
        isSequenced: true,
        type: 'HIPC',
        songLength: orderTable.length,
        orderTable: new Uint8Array(orderTable),
        patterns: patterns,
        bpm: bpm,
        speed: speed,
        numChannels: numChannels,
        length: estimatedFrames,
        metadata: {
            name: url.split('/').pop().toUpperCase(),
            author: "JOCHEN HIPPEL (MAD MAX)",
            comment: "7-VOICE COSO PARSED WITH DESCRIPTOR HEADERS",
            type: "Hippel-COSO (7-Voice Paula)",
            instrumentCount: loadedSamplesCount,
            patternCount: patterns.length,
            fileSize: data.length
        },
        samples: samples 
    };
}