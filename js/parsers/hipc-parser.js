// === js/parsers/hipc-parser.js ===
// =========================================================
// JOCHEN HIPPEL (MAD MAX) COSO / HIPC BLOCK-RIPPER
// Production Master Edition — Corrected Header Layout:
// - Header $0008 = ptr_macro_table
// - Header $000C = ptr_pattern_table (89 Patterns in L1, 57 in L2)
// - Flat 16-Bit Pattern Pointer Array Resolution
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

    let replayerMode = 'COSO_NATIVE_VARIANT';
    if (magic18 === 'TFMX' || magic1C === 'TFMX') {
        replayerMode = 'WINGS_TFMX_VARIANT';
    }

    const initFlags           = view.getUint16(0x04, false);
    const subsongInfo         = view.getUint16(0x06, false);

    // =========================================================
    // DIE KORREKTUR: $0008 = MACROS, $000C = PATTERNS
    // =========================================================
    const macroTableOffset    = view.getUint32(0x08, false); // Start Block 2 (Sound-Macros!)
    const patTableOffset      = view.getUint32(0x0C, false); // Start Block 3 (Patterns!)
    const sampleTableOffset   = view.getUint32(0x10, false); // Start Block 4 (Sample-Deskriptoren)
    const sampleDataOffset    = view.getUint32(0x14, false); // Start Block 5 (Audio-Bank)

    // =========================================================
    // 2. UNIVERSELLE SUBSONG-TABELLE EXTRAHIEREN ($0020..firstTrackOffset)
    // =========================================================
    function isValidTrackSequence(startPtr) {
        if (startPtr < 0x0040 || startPtr >= macroTableOffset) return false;
        let ptr = startPtr;
        let steps = 0;
        while (ptr < macroTableOffset - 1 && steps < 128) {
            let cmd = data[ptr];
            if (cmd === 0xE0 || cmd === 0xE8 || cmd === 0xFF) return true;
            ptr += 2;
            steps++;
        }
        return false;
    }

    const subsongs = [];
    let firstTrackOffset = macroTableOffset;

    for (let pos = 0x0020; pos < firstTrackOffset - 8; pos += 8) {
        let v0 = view.getUint16(pos, false) & ~1;
        let v1 = view.getUint16(pos + 2, false) & ~1;
        let v2 = view.getUint16(pos + 4, false) & ~1;
        let v3 = view.getUint16(pos + 6, false) & ~1;

        if (v0 >= 0x0040 && v0 < macroTableOffset &&
            v1 >= 0x0040 && v1 < macroTableOffset &&
            v2 >= 0x0040 && v2 < macroTableOffset &&
            v3 >= 0x0040 && v3 < macroTableOffset &&
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
    const actualWaveOffset = findWaveSignature(data, sampleDataOffset, patTableOffset);

    // =========================================================
    // 4. SOUND-MACRO-POINTER EXTRAHIEREN (AB $0008)
    // =========================================================
    const firstMacroTarget = view.getUint16(macroTableOffset, false);
    let numMacros = 0;

    if (firstMacroTarget > macroTableOffset && firstMacroTarget < patTableOffset) {
        numMacros = Math.floor((firstMacroTarget - macroTableOffset) / 2);
    } else {
        numMacros = Math.floor((patTableOffset - macroTableOffset) / 2);
    }

    const macroPointers = new Uint16Array(numMacros);
    for (let i = 0; i < numMacros; i++) {
        macroPointers[i] = view.getUint16(macroTableOffset + (i * 2), false);
    }

    // =========================================================
    // 5. PATTERN-POINTER EXTRAKTION (AB $000C, FLACHE 16-BIT TABELLE)
    // =========================================================
    const firstPatternTarget = view.getUint16(patTableOffset, false);
    let numPatterns = 0;

    if (firstPatternTarget > patTableOffset && firstPatternTarget < sampleTableOffset) {
        numPatterns = Math.floor((firstPatternTarget - patTableOffset) / 2);
    } else {
        numPatterns = Math.floor((sampleTableOffset - patTableOffset) / 2);
    }

    const patternPointers = [];
    for (let i = 0; i < numPatterns; i++) {
        patternPointers.push(view.getUint16(patTableOffset + (i * 2), false));
    }

    // =========================================================
    // 6. BLOCK-RIPPER
    // =========================================================
    const trackBlock        = data.subarray(0x0020, macroTableOffset);
    const macroBlock        = data.subarray(macroTableOffset, patTableOffset);
    const patternBlock      = data.subarray(patTableOffset, sampleTableOffset);
    const sampleHeaderBlock = data.subarray(sampleTableOffset, actualWaveOffset);
    const sampleDataBlock   = data.subarray(sampleDataOffset);

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

            samples[`hipc_sample_${i}`]     = smpObj; 
            samples[`hipc_sample_${i + 1}`] = smpObj; 
            samples[`mod_sample_${i + 1}`]  = smpObj;
            samples[`xm_sample_${i + 1}`]   = smpObj;
        }
    }

    // =========================================================
    // 8. SAMPLE-DESKRIPTOREN & PCM EXTRAKTION
    // =========================================================
    const sampleDescriptors = [];
    const maxDescriptors = Math.floor((actualWaveOffset - sampleTableOffset) / 16);
    let loadedPcmCount = 0;

    const baseAmigaAddress = view.getUint32(sampleTableOffset, false);

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
        const relativeOffset = rawStartOffset - baseAmigaAddress;
        let absStart = (actualWaveOffset + relativeOffset) & ~1; 

        if (absStart < 0 || absStart >= data.length || smpLenBytes <= 0) {
            absStart = actualWaveOffset; 
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

        sampleDescriptors[i] = descObj;     
        sampleDescriptors[i + 1] = descObj; 

        if (pcm) {
            const pcmObj = {
                data: pcm,
                loopStart: smpLoopStart * 2, 
                loopLen: smpLoopLen > 1 ? (smpLoopLen * 2) : 0,
                baseVolume: smpVol > 64 ? 64 : smpVol
            };

            samples[`hipc_pcm_${i}`]     = pcmObj; 
            samples[`hipc_pcm_${i + 1}`] = pcmObj; 
            loadedPcmCount++;
        }
    }

    console.log(`[COSO PARSER] Module geladen: ${url}`);
    console.log(`[COSO PARSER] Subsongs erkannt: ${subsongs.length} (Aktiver Subsong: ${defaultSubsongIdx})`);
    console.log(`[COSO PARSER] Replayer Mode: ${replayerMode}`);
    console.log(`[COSO PARSER] Header: Macros@$${macroTableOffset.toString(16)} (${macroPointers.length} Ptrs), Patterns@$${patTableOffset.toString(16)} (${patternPointers.length} Ptrs), Descriptors@$${sampleTableOffset.toString(16)} (${loadedPcmCount} PCM), WaveBank@$${actualWaveOffset.toString(16)}`);

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
            sampleDataOffset,
            actualWaveOffset,
            numPatterns: patternPointers.length,
            numMacros: macroPointers.length,
            subsongs: subsongs,
            selectedSubsong: defaultSubsongIdx,
            voiceTrackPointers,
            replayerMode
        },
        blocks: {
            tracks: trackBlock,
            macros: macroBlock,
            patterns: patternBlock,
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
            comment: `GENERIC COSO DECODER (REPLAYER: ${replayerMode})`,
            type: `COSO Container / ${replayerMode}`,
            instrumentCount: NUM_WAVEFORMS + loadedPcmCount,
            patternCount: patternPointers.length,
            subsongCount: subsongs.length,
            fileSize: rawBuffer.byteLength
        }
    };
}