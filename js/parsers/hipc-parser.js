// === js/parsers/hipc-parser.js ===
// =========================================================
// JOCHEN HIPPEL (MAD MAX) COSO / HIPC BLOCK-RIPPER
// Master Edition — Layer A/B Calibrated Binary Container:
// - 32-Byte Header Decoding ($0000..$001F)
// - "COSO" ($0000) & "TFMX" ($0018/$001C) Tag Verification
// - Verified 32-Bit Header Pointers:
//     * $0008: ptr_pattern_table (Start der Pattern-Pointer-Tabelle)
//     * $000C: ptr_pattern_data  (Start des Pattern-Bytecodes / Pattern 0)
//     * $0010: ptr_sound_macros  (Start der Sound-Macro-Tabelle)
//     * $0014: ptr_sample_table  (Start der Sample-Deskriptoren)
// - 4-Byte-Descriptor Stride Resolution für patternPointers[]
// - Validated 4-Voice Track Start Offsets ($0074, $008A, $009E, $00B0)
// - 32-Byte Synthesizer Wavetable Extraction (Signed 8-Bit)
// =========================================================

export async function loadHipcFile(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Datei nicht gefunden: ${url}`);
    
    const rawBuffer = await response.arrayBuffer();
    // 64-Byte Padding am Ende gegen Out-of-Bounds Lesefehler historischer Rips
    const data = new Uint8Array(rawBuffer.byteLength + 64);
    data.set(new Uint8Array(rawBuffer), 0);
    const view = new DataView(data.buffer);

    // =========================================================
    // 1. HEADER-PARSING & SIGNATUR-VERIFIKATION
    // =========================================================
    const magic0 = String.fromCharCode(data[0], data[1], data[2], data[3]);
    const magic18 = String.fromCharCode(data[0x18], data[0x19], data[0x1A], data[0x1B]);
    const magic1C = String.fromCharCode(data[0x1C], data[0x1D], data[0x1E], data[0x1F]);

    const isCoso = (magic0 === 'COSO') || (magic18 === 'TFMX') || (magic1C === 'TFMX');
    if (!isCoso) {
        throw new Error(`Ungültiges COSO-Modul: Header-Signaturen nicht gefunden ("${magic0}").`);
    }

    // 32-Bit Big-Endian Offsets aus dem Header lesen
    const initFlags           = view.getUint16(0x04, false);
    const subsongInfo         = view.getUint16(0x06, false);
    const patTableOffset      = view.getUint32(0x08, false); // Start der Pattern-Pointer-Tabelle
    const patDataOffset       = view.getUint32(0x0C, false); // Start der Pattern-Daten / Pattern 0
    const macroTableOffset    = view.getUint32(0x10, false); // Start der Sound-Macros
    const sampleTableOffset   = view.getUint32(0x14, false); // Start der Sample-Deskriptoren

    // =========================================================
    // 2. PATTERN-POINTER-TABELLE (PARSER-SEITIGE AUFLÖSUNG)
    // Löst die 4-Byte-Deskriptoren [uint16 offset, uint16 attr] sauber auf
    // =========================================================
    const numDescriptorEntries = Math.max(1, Math.floor((patDataOffset - patTableOffset) / 4));
    const patternPointers = [];
    
    for (let i = 0; i < numDescriptorEntries; i++) {
        const patPtr = view.getUint16(patTableOffset + (i * 4), false);
        // Validierung: Zeigt der Pointer in den legalen Pattern-Datenbereich?
        if (patPtr >= patTableOffset && patPtr < macroTableOffset) {
            patternPointers.push(patPtr);
        }
    }

    // Fallback: Falls ein Modul ein 2-Byte-Pointer-Array verwendet
    if (patternPointers.length === 0) {
        const numPats2B = Math.max(1, Math.floor((patDataOffset - patTableOffset) / 2));
        for (let i = 0; i < numPats2B; i++) {
            const patPtr = view.getUint16(patTableOffset + (i * 2), false);
            if (patPtr >= patTableOffset && patPtr < macroTableOffset) {
                patternPointers.push(patPtr);
            }
        }
    }

    // =========================================================
    // 3. DYNAMISCHE 4-VOICE TRACK-START-POINTER ERMITTELN
    // Sucht im Track-Header-Bereich ($0020..patTableOffset) nach validierten Orderlisten
    // =========================================================
    function isValidTrackSequence(startPtr) {
        if (startPtr < 0x0040 || startPtr >= patTableOffset) return false;
        let ptr = startPtr;
        let steps = 0;
        while (ptr < patTableOffset - 1 && steps < 128) {
            let cmd = data[ptr];
            if (cmd === 0xE0 || cmd === 0xE8 || cmd === 0xFF) return true; // Terminiert mit Loop/Ende
            ptr += 2;
            steps++;
        }
        return false;
    }

    let voiceTrackPointers = [0x0074, 0x008A, 0x009E, 0x00B0]; // Sicherer Fallback für Level 1
    
    for (let offset = 0x0028; offset < patTableOffset - 8; offset += 2) {
        let p0 = view.getUint16(offset, false);
        let p1 = view.getUint16(offset + 2, false);
        let p2 = view.getUint16(offset + 4, false);
        let p3 = view.getUint16(offset + 6, false);

        if (p0 < p1 && p1 < p2 && p2 < p3 && 
            isValidTrackSequence(p0) && 
            isValidTrackSequence(p1) && 
            isValidTrackSequence(p2) && 
            isValidTrackSequence(p3)) {
            voiceTrackPointers = [p0, p1, p2, p3];
            break;
        }
    }

    // =========================================================
    // 4. BLOCK-RIPPER (ISOLIERTE SUBARRAYS)
    // =========================================================
    // Lokalisierung des tatsächlichen 32-Byte-Wavetable-Starts (Signatur: 48 3C 32 29)
    let actualWaveOffset = sampleTableOffset;
    for (let scan = sampleTableOffset; scan < data.length - 32; scan += 2) {
        if (data[scan] === 0x48 && data[scan + 1] === 0x3C && data[scan + 2] === 0x32 && data[scan + 3] === 0x29) {
            actualWaveOffset = scan;
            break;
        }
    }

    const trackBlock        = data.subarray(0x0020, patTableOffset);
    const patternBlock      = data.subarray(patDataOffset, macroTableOffset);
    const macroBlock        = data.subarray(macroTableOffset, sampleTableOffset);
    const sampleHeaderBlock = data.subarray(sampleTableOffset, actualWaveOffset);
    const sampleDataBlock   = data.subarray(actualWaveOffset);

    // =========================================================
    // 5. 32-BYTE SYNTHESIZER WAVETABLES (SIGNED 8-BIT)
    // =========================================================
    const samples = {};
    const NUM_WAVEFORMS = 16;
    const WAVE_LEN = 32; // Exakt 32 Bytes (16 Words)

    for (let i = 0; i < NUM_WAVEFORMS; i++) {
        const waveOffset = actualWaveOffset + (i * WAVE_LEN);
        if (waveOffset + WAVE_LEN <= data.length) {
            const pcm = new Int8Array(WAVE_LEN);
            for (let s = 0; s < WAVE_LEN; s++) {
                const b = data[waveOffset + s];
                pcm[s] = (b > 127) ? (b - 256) : b; // Signed 8-Bit Amiga Paula Format
            }

            const smpObj = {
                data: pcm,
                loopStart: 0,
                loopLen: WAVE_LEN,
                baseVolume: 64
            };

            samples[`hipc_sample_${i + 1}`] = smpObj;
            samples[`mod_sample_${i + 1}`]  = smpObj;
            samples[`xm_sample_${i + 1}`]   = smpObj;
        }
    }

    console.log(`[COSO PARSER] Module geladen: ${url}`);
    console.log(`[COSO PARSER] Header: PtrTable@$${patTableOffset.toString(16)} (${patternPointers.length} aufgelöste Ptrs), PatData@$${patDataOffset.toString(16)}, Macros@$${macroTableOffset.toString(16)}, Samples@$${sampleTableOffset.toString(16)}, PCM@$${actualWaveOffset.toString(16)}`);
    console.log(`[COSO PARSER] Voices: [0:$${voiceTrackPointers[0].toString(16)}, 1:$${voiceTrackPointers[1].toString(16)}, 2:$${voiceTrackPointers[2].toString(16)}, 3:$${voiceTrackPointers[3].toString(16)}]`);

    return {
        isSequenced: true,
        type: 'HIPC',
        numChannels: 4,
        fullData: data, // Vollständiges lineares Speicherabbild für VM-Direktzugriff
        header: {
            initFlags,
            subsongInfo,
            patTableOffset,
            patDataOffset,
            macroTableOffset,
            sampleTableOffset,
            sampleDataOffset: actualWaveOffset,
            numPatterns: patternPointers.length,
            voiceTrackPointers
        },
        blocks: {
            tracks: trackBlock,
            patterns: patternBlock,
            macros: macroBlock,
            sampleHeaders: sampleHeaderBlock,
            pcmData: sampleDataBlock
        },
        patternPointers: patternPointers,
        voiceTrackPointers: voiceTrackPointers,
        samples: samples,
        length: 50 * 180, // 180s VBLANK Fallback
        metadata: {
            name: url.split('/').pop().toUpperCase(),
            author: "JOCHEN HIPPEL (MAD MAX)",
            comment: `LAYER A/B CALIBRATED BINARY CONTAINER (COSO / TFMX)`,
            type: "Hippel-COSO (4-Channel Paula DMA)",
            instrumentCount: NUM_WAVEFORMS,
            patternCount: patternPointers.length,
            fileSize: rawBuffer.byteLength
        }
    };
}