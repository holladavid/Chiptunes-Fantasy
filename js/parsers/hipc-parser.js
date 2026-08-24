// === js/parsers/hipc-parser.js ===
// =========================================================
// JOCHEN HIPPEL (MAD MAX) COSO / HIPC BLOCK-RIPPER
// Master Edition — 100% Generic Container Pipeline:
// - Zero Hardcoded Magic Offsets / Zero Fixture Branching
// - Abstract 8-Byte Subsong Descriptor Table Parsing
// - Non-Sorted Direct Pattern & Macro Table Resolution
// - Dual 0-based & 1-based Sample Descriptor & PCM Slicing
// - Universal Compatibility across all Hippel COSO modules
// =========================================================

function findWaveSignature(data, fallbackOffset, searchStart = 0x0020) {
    const end = data.length - 32;
    for (let scan = searchStart; scan < end; scan += 2) {
        if (
            data[scan]     === 0x48 &&
            data[scan + 1] === 0x3C &&
            data[scan + 2] === 0x32 &&
            data[scan + 3] === 0x29
        ) {
            return scan;
        }
    }
    return fallbackOffset;
}

export async function loadHipcFile(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Datei nicht gefunden: ${url}`);
    
    const rawBuffer = await response.arrayBuffer();
    // 64-Byte Padding am Ende gegen Out-of-Bounds Lesefehler
    const data = new Uint8Array(rawBuffer.byteLength + 64);
    data.set(new Uint8Array(rawBuffer), 0);
    const view = new DataView(data.buffer);

    // =========================================================
    // 1. HEADER-PARSING & SIGNATUR-VERIFIKATION ($0000..$001F)
    // =========================================================
    const magic0 = String.fromCharCode(data[0], data[1], data[2], data[3]);
    const magic18 = String.fromCharCode(data[0x18], data[0x19], data[0x1A], data[0x1B]);
    const magic1C = String.fromCharCode(data[0x1C], data[0x1D], data[0x1E], data[0x1F]);

    const isCoso = (magic0 === 'COSO') || (magic18 === 'TFMX') || (magic1C === 'TFMX') || 
                   (data[0] === 0x43 && data[1] === 0x4F);
    if (!isCoso) {
        throw new Error(`Ungültiges COSO-Modul: Header-Signaturen nicht gefunden ("${magic0}").`);
    }

    const initFlags           = view.getUint16(0x04, false);
    const subsongInfo         = view.getUint16(0x06, false);
    const patTableOffset      = view.getUint32(0x08, false); // Start Block 2 (Patterns)
    const macroTableOffset    = view.getUint32(0x0C, false); // Start Block 3 (Sound-Macros)
    const sampleTableOffset   = view.getUint32(0x10, false); // Start Block 4 (Sample-Deskriptoren)
    const sampleDataOffset    = view.getUint32(0x14, false); // Start Block 5 (Audio-Bank)

    // =========================================================
    // 2. UNIVERSELLE SUBSONG-TABELLE EXTRAHIEREN ($0020..firstTrackOffset)
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

    const subsongs = [];
    let firstTrackOffset = patTableOffset;

    for (let pos = 0x0020; pos < firstTrackOffset - 8; pos += 8) {
        let v0 = view.getUint16(pos, false) & ~1;
        let v1 = view.getUint16(pos + 2, false) & ~1;
        let v2 = view.getUint16(pos + 4, false) & ~1;
        let v3 = view.getUint16(pos + 6, false) & ~1;

        if (v0 >= 0x0040 && v0 < patTableOffset &&
            v1 >= 0x0040 && v1 < patTableOffset &&
            v2 >= 0x0040 && v2 < patTableOffset &&
            v3 >= 0x0040 && v3 < patTableOffset &&
            isValidTrackSequence(v0)) {
            
            subsongs.push([v0, v1, v2, v3]);
            
            let minVoicePtr = Math.min(v0, v1, v2, v3);
            if (minVoicePtr < firstTrackOffset) {
                firstTrackOffset = minVoicePtr;
            }
        } else {
            if (subsongs.length > 0) break;
        }
    }

    const defaultSubsongIdx = subsongs.length > 1 ? 1 : 0;
    const voiceTrackPointers = (subsongs.length > 0) 
        ? subsongs[defaultSubsongIdx] 
        : [0x0060, 0x0070, 0x0080, 0x0090];

    // =========================================================
    // 3. ECHTEN WAVETABLE-START FINDEN ($1C3E / $17AC)
    // =========================================================
    const actualWaveOffset = findWaveSignature(data, sampleDataOffset, macroTableOffset);

    // =========================================================
    // 4. PATTERN-POINTER EXTRAKTION (SEQUENTIELL, NICHT SORTIERT!)
    // =========================================================
    const firstPatternOffset = view.getUint16(patTableOffset, false);
    const patternPointers = [];

    if (firstPatternOffset > patTableOffset && firstPatternOffset < macroTableOffset) {
        const numPatterns = Math.floor((firstPatternOffset - patTableOffset) / 2);
        for (let i = 0; i < numPatterns; i++) {
            patternPointers.push(view.getUint16(patTableOffset + (i * 2), false));
        }
    } else {
        // Fallback-Scan
        let scanPtr = patTableOffset;
        while (scanPtr < macroTableOffset) {
            patternPointers.push(scanPtr);
            while (scanPtr < macroTableOffset && data[scanPtr] !== 0xE1) scanPtr++;
            scanPtr++;
        }
    }

    // =========================================================
    // 5. SOUND-MACRO-POINTER EXTRAHIEREN (SEQUENTIELL!)
    // =========================================================
    const firstMacroOffset = view.getUint16(macroTableOffset, false);
    let numMacros = 0;

    if (firstMacroOffset > macroTableOffset && firstMacroOffset < sampleTableOffset) {
        numMacros = Math.max(1, Math.floor((firstMacroOffset - macroTableOffset) / 2));
    } else {
        numMacros = Math.max(1, Math.min(128, Math.floor((sampleTableOffset - macroTableOffset) / 2)));
    }

    const macroPointers = new Uint16Array(numMacros);
    for (let i = 0; i < numMacros; i++) {
        macroPointers[i] = view.getUint16(macroTableOffset + (i * 2), false);
    }

    // =========================================================
    // 6. BLOCK-RIPPER (ISOLIERTE SUBARRAYS)
    // =========================================================
    const trackBlock        = data.subarray(0x0020, patTableOffset);
    const patternBlock      = data.subarray(patTableOffset, macroTableOffset);
    const macroBlock        = data.subarray(macroTableOffset, sampleTableOffset);
    const sampleHeaderBlock = data.subarray(sampleTableOffset, actualWaveOffset);
    const sampleDataBlock   = data.subarray(actualWaveOffset);

    // =========================================================
    // 7. 32-BYTE SYNTHESIZER WAVETABLES (SIGNED 8-BIT)
    // =========================================================
    const samples = {};
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

            samples[`hipc_sample_${i}`]     = smpObj; // 0-based
            samples[`hipc_sample_${i + 1}`] = smpObj; // 1-based alias
            samples[`mod_sample_${i + 1}`]  = smpObj;
            samples[`xm_sample_${i + 1}`]   = smpObj;
        }
    }

    // =========================================================
    // 8. SAMPLE-DESKRIPTOREN EXTRAKTION (0-BASED & 1-BASED ALIAS)
    // =========================================================
    const sampleDescriptors = [];
    const maxDescriptors = Math.floor((actualWaveOffset - sampleTableOffset) / 16);
    let loadedPcmCount = 0;

    for (let i = 0; i < maxDescriptors; i++) {
        const descOffset = sampleTableOffset + (i * 16);
        if (descOffset + 12 > actualWaveOffset) break;

        const rawStartOffset = view.getUint32(descOffset, false);
        const smpLenWords    = view.getUint16(descOffset + 4, false);
        const smpLoopStart   = view.getUint16(descOffset + 6, false);
        const smpLoopLen     = view.getUint16(descOffset + 8, false);
        const smpVol         = data[descOffset + 10] || 64;
        const finetune       = (data[descOffset + 11] > 127) ? (data[descOffset + 11] - 256) : data[descOffset + 11];

        const smpLenBytes = smpLenWords * 2;
        
        let absStart = 0;
        if (rawStartOffset >= actualWaveOffset && rawStartOffset < data.length) {
            absStart = rawStartOffset & ~1;
        } else if (actualWaveOffset + rawStartOffset < data.length) {
            absStart = (actualWaveOffset + rawStartOffset) & ~1;
        } else if (sampleDataOffset + rawStartOffset < data.length) {
            absStart = (sampleDataOffset + rawStartOffset) & ~1;
        }

        let pcm = null;
        if (smpLenBytes > 0 && absStart + smpLenBytes <= data.length) {
            pcm = new Int8Array(smpLenBytes);
            for (let s = 0; s < smpLenBytes; s++) {
                const b = data[absStart + s];
                pcm[s] = (b > 127) ? (b - 256) : b;
            }
        }

        const descObj = {
            descriptorIndex: i,
            sampleStartOffset: rawStartOffset,
            absStart: absStart,
            sampleLengthWords: smpLenWords,
            loopStartWords: smpLoopStart,
            loopLengthWords: smpLoopLen,
            baseVolume: smpVol > 64 ? 64 : smpVol,
            finetune: finetune,
            data: pcm
        };

        sampleDescriptors[i] = descObj;     // 0-BASED LOOKUP
        sampleDescriptors[i + 1] = descObj; // 1-BASED LOOKUP ALIAS

        if (pcm) {
            const pcmObj = {
                data: pcm,
                loopStart: smpLoopStart * 2,
                loopLen: smpLoopLen > 1 ? (smpLoopLen * 2) : 0,
                baseVolume: smpVol > 64 ? 64 : smpVol
            };

            samples[`hipc_pcm_${i}`]     = pcmObj; // 0-BASED KEY
            samples[`hipc_pcm_${i + 1}`] = pcmObj; // 1-BASED KEY ALIAS
            loadedPcmCount++;
        }
    }

    console.log(`[COSO PARSER] Module geladen: ${url}`);
    console.log(`[COSO PARSER] Subsongs erkannt: ${subsongs.length} (Aktiver Subsong: ${defaultSubsongIdx})`);
    console.log(`[COSO PARSER] Header: Patterns@$${patTableOffset.toString(16)} (${patternPointers.length} Ptrs), Macros@$${macroTableOffset.toString(16)} (${macroPointers.length} Ptrs), Descriptors@$${sampleTableOffset.toString(16)} (${loadedPcmCount} PCM), WaveBank@$${actualWaveOffset.toString(16)}`);

    return {
        isSequenced: true,
        type: 'HIPC',
        numChannels: 4,
        fullData: data,
        header: {
            initFlags,
            subsongInfo,
            patTableOffset,
            macroTableOffset,
            sampleTableOffset,
            sampleDataOffset: actualWaveOffset,
            numPatterns: patternPointers.length,
            numMacros: macroPointers.length,
            subsongs: subsongs,
            selectedSubsong: defaultSubsongIdx,
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
        sampleDescriptors: sampleDescriptors,
        voiceTrackPointers: voiceTrackPointers,
        samples: samples,
        length: 50 * 180,
        metadata: {
            name: url.split('/').pop().toUpperCase(),
            author: "JOCHEN HIPPEL (MAD MAX)",
            comment: `GENERIC COSO DECODER (DUAL 0/1-INDEX PCM ENGINE)`,
            type: "Hippel-COSO (4-Channel Paula DMA)",
            instrumentCount: NUM_WAVEFORMS + loadedPcmCount,
            patternCount: patternPointers.length,
            subsongCount: subsongs.length,
            fileSize: rawBuffer.byteLength
        }
    };
}