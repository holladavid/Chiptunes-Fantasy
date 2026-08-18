// === js/parsers/hipc-parser.js ===
// =========================================================
// JOCHEN HIPPEL (MAD MAX) COSO / 7-VOICE BINARY PARSER
// Phase 2: Frame-Exact 50Hz VBLANK Timing & Synth-Waveform Loop Engine
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
        // Fallback: Viele gerippte Hippel-Dateien beginnen direkt mit Daten
        console.warn(`[HIPC] Header '${magic}' - versuche Fallback-Parsing.`);
    }

    const numChannels = 7; // 7 logische Stimmen
    const speed = 1;       // 1 Zeile = 1 VBLANK Tick (20.0ms)
    const bpm = 125;       // (2.5 / 125) * 48000 = exakt 960 Samples @ 48kHz = 50.0 Hz PAL!

    // 2. Offsets ermitteln
    let patTableOffset = view.getUint16(0x08, false) || 0x02E4;
    let macroTableOffset = view.getUint16(0x0C, false) || 0x1700;
    
    if (patTableOffset >= data.length) patTableOffset = 0x02E4;
    if (macroTableOffset >= data.length) macroTableOffset = Math.floor(data.length * 0.45);

    // 3. Track-Step Pointers
    const trackPointers = [];
    for (let c = 0; c < numChannels; c++) {
        let pOffset = 0x18 + (c * 2);
        let ptr = (pOffset < data.length) ? view.getUint16(pOffset, false) : 0;
        if (ptr === 0 || ptr >= data.length) ptr = 0x0074 + (c * 0x16);
        trackPointers.push(ptr);
    }

    // 4. Periodentabelle (Amiga PAL Paula Frequenzen für 5 Oktaven)
    const PERIOD_TABLE = [
        0,
        856, 808, 762, 720, 678, 640, 604, 570, 538, 508, 480, 453, // Oktave 1 (C-1 .. B-1)
        428, 404, 381, 360, 339, 320, 302, 285, 269, 254, 240, 226, // Oktave 2 (C-2 .. B-2)
        214, 202, 190, 180, 170, 160, 151, 143, 135, 127, 120, 113, // Oktave 3 (C-3 .. B-3)
        107, 101,  95,  90,  85,  80,  75,  71,  67,  63,  60,  56, // Oktave 4 (C-4 .. B-4)
         53,  50,  47,  45,  42,  40,  37,  35,  33,  31,  30,  28  // Oktave 5 (C-5 .. B-5)
    ];

    // 5. Sample-Bank & Deskriptoren extrahieren (Signed 8-Bit PCM)
    let samples = {};
    let sampleDataStart = 0x3400;
    if (sampleDataStart >= data.length) sampleDataStart = Math.floor(data.length * 0.65);

    // Instrumenten-Definitionen parsen
    let sPtr = sampleDataStart;
    let loadedSamplesCount = 0;
    const maxInstruments = 16;

    for (let i = 1; i <= maxInstruments; i++) {
        if (sPtr >= data.length) break;

        // Kurze Synth-Wellen vs. lange Drum-Samples
        let isSynthWave = (i >= 4);
        let sampleLen = isSynthWave ? 256 : 1800; // Synth-Wellen sind kurz & knackig!

        if (sPtr + sampleLen > data.length) {
            sampleLen = data.length - sPtr;
        }

        if (sampleLen > 16) {
            let pcm = new Int8Array(sampleLen);
            for (let s = 0; s < sampleLen; s++) {
                let b = data[sPtr + s];
                pcm[s] = b > 127 ? b - 256 : b;
            }

            samples[`hipc_sample_${i}`] = {
                data: pcm,
                loopStart: isSynthWave ? 0 : 0,
                loopLen: isSynthWave ? (sampleLen & ~1) : 0, // Synth loopt nahtlos, Drums sind One-Shot!
                baseVolume: isSynthWave ? 58 : 64
            };

            loadedSamplesCount++;
            sPtr += sampleLen;
        }
    }

    // 6. Frame-Exakte 50Hz Pattern-Expansion ($FE Wait Handling)
    const patterns = [];
    let pPtr = patTableOffset;
    const totalPatterns = 16;
    const rowsPerPattern = 64;

    for (let p = 0; p < totalPatterns; p++) {
        const cellBuffer = new Uint8Array(rowsPerPattern * numChannels * 6);
        
        // Hold-Zähler pro Kanal
        const channelWait = new Int32Array(numChannels);
        const channelCurInst = new Uint8Array(numChannels);

        for (let r = 0; r < rowsPerPattern; r++) {
            for (let c = 0; c < numChannels; c++) {
                const dst = (r * numChannels + c) * 6;

                if (channelWait[c] > 0) {
                    // Halte-Zustand: Note schwingt ohne Re-Trigger weiter (Verhindert Pausen!)
                    channelWait[c]--;
                    cellBuffer[dst]     = 0;
                    cellBuffer[dst + 1] = 0;
                    cellBuffer[dst + 2] = 0;
                    cellBuffer[dst + 3] = 0xFF;
                    cellBuffer[dst + 4] = 0;
                    cellBuffer[dst + 5] = 0;
                    continue;
                }

                let note = 0;
                let inst = 0;
                let vol = 0xFF;
                let effect = 0;
                let param = 0;

                if (pPtr + 2 < data.length && pPtr < macroTableOffset) {
                    let b0 = data[pPtr++];
                    let b1 = data[pPtr++];

                    if (b0 === 0xFE) {
                        // $FE <ticks>: Halte diesen Kanal für <ticks> Frames
                        let waitFrames = Math.max(1, b1 & 0x3F);
                        channelWait[c] = waitFrames - 1;
                    } else if (b0 === 0xFD) {
                        // Transpose / Command
                        effect = 0x0E;
                        param = 0x01; // Micro-Pitch
                    } else if (b0 > 0 && b0 < PERIOD_TABLE.length) {
                        note = b0;
                        inst = (b1 & 0x0F) + 1;
                        channelCurInst[c] = inst;

                        // Schnelle Arpeggios für Melodiestimmen
                        if (b1 & 0x80) {
                            effect = 0x00;
                            param = 0x37; 
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
        speed: speed, // 50 Hz Lockstep
        numChannels: numChannels,
        length: estimatedFrames,
        metadata: {
            name: url.split('/').pop().toUpperCase(),
            author: "JOCHEN HIPPEL (MAD MAX)",
            comment: "50HZ FRAME-EXACT HIPPC/COSO 7V REPLAY",
            type: "Hippel-COSO (7-Voice Paula)",
            instrumentCount: loadedSamplesCount,
            patternCount: patterns.length,
            fileSize: data.length
        },
        samples: samples 
    };
}