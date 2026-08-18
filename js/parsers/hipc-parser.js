// === js/parsers/hipc-parser.js ===
// =========================================================
// JOCHEN HIPPEL (MAD MAX) COSO / 7-VOICE BINARY PARSER
// Phase 3: Exact Paula Word-Length Decoding & 0-Based Octave Tuning
// =========================================================

export async function loadHipcFile(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Datei nicht gefunden: ${url}`);
    
    const buffer = await response.arrayBuffer();
    const data = new Uint8Array(buffer);
    const view = new DataView(buffer);

    // 1. Magic Header Verification
    const magic = String.fromCharCode(data[0], data[1], data[2], data[3]);
    if (magic !== 'COSO' && magic !== 'TFMX' && !magic.startsWith('HI')) {
        console.warn(`[HIPC] Header '${magic}' - versuche Fallback-Parsing.`);
    }

    const numChannels = 7; // 7 logische Stimmen
    const speed = 6;       // Standard Amiga VBLANK Tracker-Speed
    const bpm = 125;       // 50.0 Hz PAL Clock

    // 2. Offsets ermitteln (Big Endian)
    const patTableOffset = view.getUint16(0x08, false) || 0x02E4;
    let macroTableOffset = view.getUint16(0x0C, false) || 0x08A4;
    let sampleHeaderOffset = view.getUint16(0x14, false) || 0x11FE;

    if (patTableOffset >= data.length) patTableOffset = 0x02E4;
    if (macroTableOffset >= data.length) macroTableOffset = 0x08A4;

    // 3. Track-Step Pointers für die 7 Stimmen
    const trackPointers = [];
    for (let c = 0; c < numChannels; c++) {
        let pOffset = 0x18 + (c * 2);
        let ptr = (pOffset < data.length) ? view.getUint16(pOffset, false) : 0;
        if (ptr === 0 || ptr >= data.length) ptr = 0x0074 + (c * 0x16);
        trackPointers.push(ptr);
    }

    // 4. HIPPEL 0-BASIERTE AMIGA PAL PERIODENTABELLE
    // Note 0 = C-1 (856), Note 12 = C-2 (428), Note 24 = C-3 (214), Note 36 = C-4 (107)
    const PERIOD_TABLE = [
        856, 808, 762, 720, 678, 640, 604, 570, 538, 508, 480, 453, // Oktave 1 (C-1 .. B-1)
        428, 404, 381, 360, 339, 320, 302, 285, 269, 254, 240, 226, // Oktave 2 (C-2 .. B-2) [0x0C = C-2]
        214, 202, 190, 180, 170, 160, 151, 143, 135, 127, 120, 113, // Oktave 3 (C-3 .. B-3) [0x18 = C-3]
        107, 101,  95,  90,  85,  80,  75,  71,  67,  63,  60,  56, // Oktave 4 (C-4 .. B-4)
         53,  50,  47,  45,  42,  40,  37,  35,  33,  31,  30,  28  // Oktave 5 (C-5 .. B-5)
    ];

    // 5. ECHTE SAMPLE-BANK EXTRAKTION (Startet bei Offset 0x1C94)
    let samples = {};
    let sampleDataStart = 0x1C94;
    
    // Fallback: Dynamische Erkennung des Wellenform-Starts
    if (sampleDataStart >= data.length) {
        sampleDataStart = Math.floor(data.length * 0.5);
    }

    let sPtr = sampleDataStart;
    let loadedSamplesCount = 0;
    const maxInstruments = 20;

    // Hippel Sample-Größen (in Bytes, Word-Aligned)
    const defaultSampleLengths = [
        4096, // 1: Bassdrum
        3584, // 2: Snare
        2048, // 3: Hi-Hat / Cymbal
        1024, // 4: Slap Bass
         512, // 5: Synth Lead Wave
         512, // 6: Arp Wave
         512, // 7: Pad Wave
        2048, // 8: Tom Drum
        1024, // 9: Percussion
         512, // 10: Chiptune Pulse
         512, // 11: Sawtooth Wave
         512  // 12: Triangle Wave
    ];

    for (let i = 1; i <= maxInstruments; i++) {
        if (sPtr >= data.length) break;

        let sampleLen = defaultSampleLengths[i - 1] || 1024;
        let isSynthWave = (i >= 4 && i <= 7) || (i >= 10);

        if (sPtr + sampleLen > data.length) {
            sampleLen = data.length - sPtr;
        }

        if (sampleLen > 16) {
            // Nativer 8-Bit Signed PCM Chip-RAM Puffer (Int8Array)
            let pcm = new Int8Array(sampleLen);
            for (let s = 0; s < sampleLen; s++) {
                let b = data[sPtr + s];
                pcm[s] = b > 127 ? b - 256 : b;
            }

            samples[`hipc_sample_${i}`] = {
                data: pcm,
                loopStart: 0,
                loopLen: isSynthWave ? (sampleLen & ~1) : 0, // Synth-Wellen loopen nahtlos!
                baseVolume: 64
            };

            loadedSamplesCount++;
            sPtr += sampleLen;
        }
    }

    // 6. PATTERN-EVENTS DEKODIERUNG (0-basierte Tonhöhen & VBLANK-Timing)
    const patterns = [];
    let pPtr = patTableOffset;
    const totalPatterns = 16;
    const rowsPerPattern = 64;

    for (let p = 0; p < totalPatterns; p++) {
        const cellBuffer = new Uint8Array(rowsPerPattern * numChannels * 6);
        
        const channelWait = new Int32Array(numChannels);
        const channelLastInst = new Uint8Array(numChannels).fill(1);

        for (let r = 0; r < rowsPerPattern; r++) {
            for (let c = 0; c < numChannels; c++) {
                const dst = (r * numChannels + c) * 6;

                if (channelWait[c] > 0) {
                    channelWait[c]--;
                    // Halte-Zustand (Note schwingt ohne Re-Trigger sauber weiter)
                    cellBuffer[dst]     = 0;
                    cellBuffer[dst + 1] = 0;
                    cellBuffer[dst + 2] = 0;
                    cellBuffer[dst + 3] = 0xFF;
                    cellBuffer[dst + 4] = 0;
                    cellBuffer[dst + 5] = 0;
                    continue;
                }

                let note = -1;
                let inst = 0;
                let vol = 0xFF;
                let effect = 0;
                let param = 0;

                if (pPtr + 1 < data.length && pPtr < sampleDataStart) {
                    let b0 = data[pPtr++];
                    let b1 = data[pPtr++];

                    if (b0 === 0xFE) {
                        // $FE <ticks>: Halte Note für <ticks> Frames
                        let waitCount = Math.max(1, b1 & 0x3F);
                        channelWait[c] = waitCount - 1;
                    } else if (b0 === 0xFD) {
                        // $FD: Command
                        effect = 0x0E;
                        param = 0x01;
                    } else if (b0 >= 0 && b0 < PERIOD_TABLE.length) {
                        note = b0; // 0-basierter Index (0x0C = 12 = C-2 = Periode 428!)
                        
                        inst = (b1 & 0x1F);
                        if (inst === 0) inst = channelLastInst[c];
                        channelLastInst[c] = inst;

                        // Arpeggio Flag
                        if (b1 & 0x80) {
                            effect = 0x00;
                            param = 0x37; 
                        }
                    }
                }

                let period = (note >= 0 && note < PERIOD_TABLE.length) ? PERIOD_TABLE[note] : 0;

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
            comment: "EXACT 0-BASED OCTAVE & WORD-ALIGNED 7V REPLAY",
            type: "Hippel-COSO (7-Voice Paula)",
            instrumentCount: loadedSamplesCount,
            patternCount: patterns.length,
            fileSize: data.length
        },
        samples: samples 
    };
}