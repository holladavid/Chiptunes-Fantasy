// === js/parsers/hipc-parser.js ===
// =========================================================
// JOCHEN HIPPEL (MAD MAX) COSO / HIPC BLOCK-RIPPER
// Master Edition — Layer A/B Calibrated Binary Container:
// - 32-Byte Header Decoding ($0000..$001F)
// - "COSO" ($0000) & "TFMX" ($0018/$001C) Tag Verification
// - 4-Byte-Descriptor Stride Resolution für patternPointers[]
// - Sample-Descriptor Table Parsing (PCM Digidrums & Lengths)
// - 32-Byte Synthesizer Wavetable Extraction (Signed 8-Bit)
// =========================================================

export async function loadHipcFile(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Datei nicht gefunden: ${url}`);
    
    const rawBuffer = await response.arrayBuffer();
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

    const initFlags           = view.getUint16(0x04, false);
    const subsongInfo         = view.getUint16(0x06, false);
    const patTableOffset      = view.getUint32(0x08, false); // Start der Pattern-Pointer-Tabelle
    const patDataOffset       = view.getUint32(0x0C, false); // Start der Pattern-Daten / Pattern 0
    const macroTableOffset    = view.getUint32(0x10, false); // Start der Sound-Macros
    const sampleTableOffset   = view.getUint32(0x14, false); // Start der Sample-Deskriptoren

    // =========================================================
    // 2. PATTERN-POINTER-TABELLE
    // =========================================================
    const numDescriptorEntries = Math.max(1, Math.floor((patDataOffset - patTableOffset) / 4));
    const patternPointers = [];
    
    for (let i = 0; i < numDescriptorEntries; i++) {
        const patPtr = view.getUint16(patTableOffset + (i * 4), false);
        if (patPtr >= patTableOffset && patPtr < macroTableOffset) {
            patternPointers.push(patPtr);
        }
    }

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
    // 3. SOUND-MACRO-POINTER-TABELLE
    // =========================================================
    const numMacros = Math.max(1, Math.min(64, Math.floor((sampleTableOffset - macroTableOffset) / 2)));
    const macroPointers = new Uint16Array(numMacros);
    for (let i = 0; i < numMacros; i++) {
        macroPointers[i] = view.getUint16(macroTableOffset + (i * 2), false);
    }

    // =========================================================
    // 4. DYNAMISCHE 4-VOICE TRACK-START-POINTER ERMITTELN
    // =========================================================
    function isValidTrackSequence(startPtr) {
        if (startPtr < 0x0040 || startPtr >= patTableOffset) return false;
        let ptr = startPtr;
        let steps = 0;
        while (ptr < patTableOffset - 1 && steps < 128) {
            let cmd = data[ptr];
            if (cmd === 0xE0 || cmd === 0xE8 || cmd === 0xFF) return true;
            ptr += 2;
            steps++;
        }
        return false;
    }

    let voiceTrackPointers = [0x0074, 0x008A, 0x009E, 0x00B0];
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

    // Lokalisierung des 32-Byte-Wavetable-Starts
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

    const samples = {};

    // =========================================================
    // 5. 32-BYTE SYNTHESIZER WAVETABLES (SIGNED 8-BIT)
    // =========================================================
    const NUM_WAVEFORMS = 16;
    const WAVE_LEN = 32;

    for (let i = 0; i < NUM_WAVEFORMS; i++) {
        const waveOffset = actualWaveOffset + (i * WAVE_LEN);
        if (waveOffset + WAVE_LEN <= data.length) {
            const pcm = new Int8Array(WAVE_LEN);
            for (let s = 0; s < WAVE_LEN; s++) {
                const b = data[waveOffset + s];
                pcm[s] = (b > 127) ? (b - 256) : b;
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

    // =========================================================
    // 6. SAMPLE-DESKRIPTOREN EXTRAKTION (PCM DIGIDRUMS)
    // =========================================================
    const maxDescriptors = Math.floor((actualWaveOffset - sampleTableOffset) / 16);
    let loadedPcmCount = 0;

    const sampleDescriptors = [];
    for (let i = 0; i < maxDescriptors; i++) {
        const descOffset = sampleTableOffset + (i * 16);
        if (descOffset + 12 > actualWaveOffset) break;

        const smpStartOffset = view.getUint32(descOffset, false);
        const smpLenWords     = view.getUint16(descOffset + 4, false);
        const smpLoopStart    = view.getUint16(descOffset + 6, false);
        const smpLoopLen      = view.getUint16(descOffset + 8, false);
        const smpVol          = data[descOffset + 10] || 64;

        sampleDescriptors[i + 1] = {
            sampleStartOffset: smpStartOffset,
            absStart: actualWaveOffset + smpStartOffset,
            sampleLengthWords: smpLenWords,
            loopStartWords: smpLoopStart,
            loopLengthWords: smpLoopLen,
            baseVolume: smpVol > 64 ? 64 : smpVol
        };
        const smpLenBytes = smpLenWords * 2;
        const absStart = actualWaveOffset + smpStartOffset;

        if (smpLenBytes > 32 && absStart + smpLenBytes <= data.length) {
            const pcm = new Int8Array(smpLenBytes);
            for (let s = 0; s < smpLenBytes; s++) {
                const b = data[absStart + s];
                pcm[s] = (b > 127) ? (b - 256) : b;
            }

            const pcmObj = {
                data: pcm,
                loopStart: smpLoopStart * 2,
                loopLen: smpLoopLen > 1 ? (smpLoopLen * 2) : 0,
                baseVolume: smpVol > 64 ? 64 : smpVol
            };

            samples[`hipc_pcm_${i + 1}`] = pcmObj;
            loadedPcmCount++;
        }
    }

    for (let i = 0; i < 4; i++) {
        voiceTrackPointers[i] = voiceTrackPointers[i] & ~1; // Zwingt auf gerade 16-Bit Word-Grenzen!
    }
    console.log(`[COSO PARSER] Module geladen: ${url}`);
    console.log(`[COSO PARSER] Header: PtrTable@$${patTableOffset.toString(16)} (${patternPointers.length} Ptrs), Macros@$${macroTableOffset.toString(16)} (${macroPointers.length} Ptrs), Samples@$${sampleTableOffset.toString(16)} (${loadedPcmCount} PCM), Waves@$${actualWaveOffset.toString(16)}`);

    return {
        isSequenced: true,
        type: 'HIPC',
        numChannels: 4,
        fullData: data,
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
        macroPointers: macroPointers,
        voiceTrackPointers: voiceTrackPointers,
        samples: samples,
        length: 50 * 180,
        metadata: {
            name: url.split('/').pop().toUpperCase(),
            author: "JOCHEN HIPPEL (MAD MAX)",
            comment: `PHASE 4 COMPLETE: MACRO VM & PCM DIGIDRUMS ACTIVE`,
            type: "Hippel-COSO (4-Channel Paula DMA)",
            instrumentCount: NUM_WAVEFORMS + loadedPcmCount,
            patternCount: patternPointers.length,
            fileSize: rawBuffer.byteLength
        }
    };
}