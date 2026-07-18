// === js/parsers/dw-parser.js ===
// =========================================================
// DAVID WHITTAKER (DW) CUSTOM REPLAY PARSER
// Universal Whittaker Adapter (UWA)
// Translates proprietary .dw memory dumps into internal 
// ProTracker/FastTracker compatible sequence structures.
// =========================================================

export async function loadDwFile(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Datei nicht gefunden: ${url}`);
    
    const buffer = await response.arrayBuffer();
    const data = new Uint8Array(buffer);
    const view = new DataView(buffer);

    // 1. DW Header Parsing
    const songSpeed = data[0] || 6;
    const bpm = data[1] || 125;
    const numChannels = data[2] || 4;
    const numSongs = data[3] || 1;

    // Pointer-Layout (Big Endian)
    const seqPtr = view.getUint32(4, false);
    const patPtr = view.getUint32(8, false);
    const instPtr = view.getUint32(12, false);
    const smpPtr = view.getUint32(16, false);

    // 2. Sequence Table (Order Table)
    const orderTable = [];
    const seqLength = patPtr - seqPtr;
    if (seqLength > 0 && seqPtr < data.length) {
        // Sequenz-Einträge sind meist 16-Bit Words
        for (let i = 0; i < seqLength; i += 2) {
            let patIdx = view.getUint16(seqPtr + i, false);
            // Wenn der Tracker absolute Pointer verwendet, mappen wir sie später, 
            // ansonsten übernehmen wir sie als direkte Indizes.
            orderTable.push(patIdx > 255 ? Math.floor(i / 2) : patIdx);
        }
    } else {
        orderTable.push(0); // Failsafe
    }

    // 3. Pattern Data (Variable Length Parsing)
    const patterns = [];
    let p = patPtr;
    
    // Die klassischen Amiga-Perioden für die Noten 1-36
    const periodTable = [
        0,
        856, 808, 762, 720, 678, 640, 604, 570, 538, 508, 480, 453,
        428, 404, 381, 360, 339, 320, 302, 285, 269, 254, 240, 226,
        214, 202, 190, 180, 170, 160, 151, 143, 135, 127, 120, 113
    ];

    let patIdx = 0;
    while (p < instPtr && p < data.length) {
        let rows = [];
        let isEnd = false;
        
        while (!isEnd && p < instPtr) {
            let row = new Uint8Array(numChannels * 6);
            let dst = 0;
            
            for (let c = 0; c < numChannels; c++) {
                if (p >= instPtr) break;
                
                let note = data[p++];
                let inst = data[p++];
                let cmd = data[p++];
                let param = data[p++];

                let period = (note > 0 && note < periodTable.length) ? periodTable[note] : 0;

                // Whittaker Custom Commands -> ProTracker MOD Commands
                let modCmd = 0;
                let modParam = param;
                
                switch (cmd) {
                    case 0x01: modCmd = 0x0C; break; // Set Volume
                    case 0x02: modCmd = 0x01; break; // Portamento Up
                    case 0x03: modCmd = 0x02; break; // Portamento Down
                    case 0x04: modCmd = 0x03; break; // Tone Portamento
                    case 0x05: modCmd = 0x04; break; // Vibrato
                    case 0x08: modCmd = 0x0D; isEnd = true; break; // Break Pattern
                    case 0x09: modCmd = 0x0F; break; // Speed
                    case 0x0F: isEnd = true; break;  // End Pattern
                    default: modCmd = 0; modParam = 0; break;
                }

                // Internes 6-Byte Format für den Worklet-Mischer
                row[dst++] = (period >> 8) & 0xFF;
                row[dst++] = period & 0xFF;
                row[dst++] = inst;
                row[dst++] = 0xFF; // Volume Column (Unused in generic MOD)
                row[dst++] = modCmd;
                row[dst++] = modParam;
            }
            rows.push(row);
            if (isEnd) break;
        }
        
        // Rows flachklopfen
        let patData = new Uint8Array(rows.length * numChannels * 6);
        for (let r = 0; r < rows.length; r++) {
            patData.set(rows[r], r * numChannels * 6);
        }
        
        patterns.push({
            numRows: rows.length,
            data: patData
        });
        patIdx++;
    }

    if (patterns.length === 0) {
        // Fallback, falls Pattern-Parsing fehlschlägt
        patterns.push({ numRows: 64, data: new Uint8Array(64 * 4 * 6) });
    }

    // 4. Instrument & Sample Table
    let samples = {};
    
    // Heuristik: Instrument-Struct ist in vielen Whittaker-Playern 32-48 Bytes groß.
    // Wir iterieren bis zum Sample-Pointer.
    let instStructSize = Math.floor((smpPtr - instPtr) / 31);
    if (instStructSize < 16) instStructSize = 32;

    let sPtr = smpPtr;
    for (let i = 0; i < 31; i++) {
        let offset = instPtr + i * instStructSize;
        if (offset + 16 > smpPtr) break; // Grenze erreicht
        
        let sampleStart = view.getUint32(offset, false);
        let sampleLength = view.getUint32(offset + 4, false);
        let loopStart = view.getUint32(offset + 8, false);
        let loopLength = view.getUint32(offset + 12, false);
        let volume = view.getUint16(offset + 16, false);

        if (sampleLength > 2 && sPtr + sampleLength <= data.length) {
            // Nativer 8-Bit PCM Rip für den Paula-Core
            let pcm = new Int8Array(data.buffer, sPtr, sampleLength);
            samples[`dw_sample_${i + 1}`] = {
                data: pcm,
                loopStart: loopStart,
                loopLen: loopLength,
                baseVolume: volume > 64 ? 64 : volume
            };
            sPtr += sampleLength;
        }
    }

    let estimatedFrames = orderTable.length * 64 * songSpeed; 

    return {
        isSequenced: true,
        type: 'DW',
        songLength: orderTable.length,
        orderTable: new Uint8Array(orderTable),
        patterns: patterns,
        bpm: bpm,
        speed: songSpeed,
        numChannels: numChannels,
        length: estimatedFrames,
        metadata: {
            name: url.split('/').pop().toUpperCase(),
            author: "DAVID WHITTAKER",
            comment: "CUSTOM REPLAY PARSED ON-THE-FLY",
            type: "DW M68K Driver",
            instrumentCount: Object.keys(samples).length,
            patternCount: patterns.length,
            fileSize: data.length
        },
        samples: samples 
    };
}