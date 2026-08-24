// === js/parsers/hipc-parser.js ===
// =========================================================
// JOCHEN HIPPEL (MAD MAX) COSO / HIPC BLOCK-RIPPER
// Master Edition — Calibrated Sample Descriptor Engine ($11FE..$1C3E):
// - Robust findWaveSignature() locates $1C3E (L1) / $17AC (L2)
// - Sample Descriptors strictly parsed from $11FE to actualWaveOffset
// - Intelligent Absolute vs. Relative Sample-Offset Resolution
// - Full Extraction of PCM Digidrums (Kicks, Snares, Slap Bass, Hi-Hats)
// - Word-Aligned DMA Pointers (& ~1) for Paula Hardware
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
            return scan; // Exakter Beginn von Waveform 0 ($1C3E / $17AC)
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
    const patTableOffset      = view.getUint32(0x08, false); // $02E4 (Level 1) / $01CE (Level 2)
    const macroTableOffset    = view.getUint32(0x0C, false); // $08E4 (Level 1) / $02F6 (Level 2)
    const sampleTableOffset   = view.getUint32(0x10, false); // $11FE (Level 1) / $0796 (Level 2)
    const sampleDataOffset    = view.getUint32(0x14, false); // $1C94 (Level 1) / $17AC (Level 2)

    // =========================================================
    // 2. ECHTEN WAVETABLE-START FINDEN ($1C3E / $17AC)
    // =========================================================
    const actualWaveOffset = findWaveSignature(data, sampleDataOffset, macroTableOffset);

    // =========================================================
    // 3. PATTERN-POINTER-TABELLE EXTRAHIEREN
    // =========================================================
    const firstPatternOffset = view.getUint16(patTableOffset, false);
    let numPatterns = 0;

    if (firstPatternOffset > patTableOffset && firstPatternOffset < macroTableOffset) {
        numPatterns = Math.max(1, Math.floor((firstPatternOffset - patTableOffset) / 2));
    } else {
        numPatterns = Math.max(1, Math.min(64, Math.floor((macroTableOffset - patTableOffset) / 2)));
    }

    const patternPointers = new Uint16Array(numPatterns);
    for (let i = 0; i < numPatterns; i++) {
        patternPointers[i] = view.getUint16(patTableOffset + (i * 2), false);
    }

    // =========================================================
    // 4. SOUND-MACRO-POINTER-TABELLE EXTRAHIEREN
    // =========================================================
    const firstMacroOffset = view.getUint16(macroTableOffset, false);
    let numMacros = 0;

    if (firstMacroOffset > macroTableOffset && firstMacroOffset < sampleTableOffset) {
        numMacros = Math.max(1, Math.floor((firstMacroOffset - macroTableOffset) / 2));
    } else {
        numMacros = Math.max(1, Math.min(64, Math.floor((sampleTableOffset - macroTableOffset) / 2)));
    }

    const macroPointers = new Uint16Array(numMacros);
    for (let i = 0; i < numMacros; i++) {
        macroPointers[i] = view.getUint16(macroTableOffset + (i * 2), false);
    }

    // =========================================================
    // 5. 4-VOICE TRACK-START-POINTER ERMITTELN
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

    let voiceTrackPointers = [0x0094, 0x009E, 0x00A8, 0x00B0]; // Subsong 1 Hauptthema
    
    for (let offset = 0x0020; offset < patTableOffset - 8; offset += 2) {
        let p0 = view.getUint16(offset, false) & ~1;
        let p1 = view.getUint16(offset + 2, false) & ~1;
        let p2 = view.getUint16(offset + 4, false) & ~1;
        let p3 = view.getUint16(offset + 6, false) & ~1;

        if (p0 >= 0x0040 && p0 < p1 && p1 < p2 && p2 < p3 && p3 < patTableOffset &&
            isValidTrackSequence(p0) && isValidTrackSequence(p1)) {
            if (p0 >= 0x0090 || voiceTrackPointers[0] === 0x0094) {
                voiceTrackPointers = [p0, p1, p2, p3];
                break;
            }
        }
    }

    // =========================================================
    // 6. BLOCK-RIPPER (ISOLIERTE SUBARRAYS)
    // =========================================================
    const trackBlock        = data.subarray(0x0020, patTableOffset);
    const patternBlock      = data.subarray(patTableOffset, macroTableOffset);
    const macroBlock        = data.subarray(macroTableOffset, sampleTableOffset);
    const sampleHeaderBlock = data.subarray(sampleTableOffset, actualWaveOffset); // $11FE..$1C3E
    const sampleDataBlock   = data.subarray(actualWaveOffset);                  // $1C3E..EOF

    // =========================================================
    // 7. 32-BYTE SYNTHESIZER WAVETABLES (SIGNED 8-BIT)
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
    // 8. SAMPLE-DESKRIPTOREN EXTRAKTION ($11FE..$1C3E)
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

        const smpLenBytes = smpLenWords * 2;
        
        // Intelligente Auflösung: Absoluter vs. Relativer Offset
        let absStart = 0;
        if (rawStartOffset >= actualWaveOffset && rawStartOffset < data.length) {
            absStart = rawStartOffset & ~1; // Absoluter Dateioffset
        } else {
            absStart = (actualWaveOffset + rawStartOffset) & ~1; // Relativer Offset ab $1C3E
        }

        sampleDescriptors[i + 1] = {
            sampleStartOffset: rawStartOffset,
            absStart: absStart,
            sampleLengthWords: smpLenWords,
            loopStartWords: smpLoopStart,
            loopLengthWords: smpLoopLen,
            baseVolume: smpVol > 64 ? 64 : smpVol
        };

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

    console.log(`[COSO PARSER] Module geladen: ${url}`);
    console.log(`[COSO PARSER] Header: Patterns@$${patTableOffset.toString(16)} (${patternPointers.length} Ptrs), Macros@$${macroTableOffset.toString(16)} (${macroPointers.length} Ptrs), Descriptors@$${sampleTableOffset.toString(16)} (${loadedPcmCount} PCM Samples extrahiert), WaveBank@$${actualWaveOffset.toString(16)}`);
    console.log(`[COSO PARSER] Voices: [0:$${voiceTrackPointers[0].toString(16)}, 1:$${voiceTrackPointers[1].toString(16)}, 2:$${voiceTrackPointers[2].toString(16)}, 3:$${voiceTrackPointers[3].toString(16)}]`);

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
            comment: `PHASE 4 COMPLETE: CALIBRATED PCM SAMPLE DESCRIPTORS`,
            type: "Hippel-COSO (4-Channel Paula DMA)",
            instrumentCount: NUM_WAVEFORMS + loadedPcmCount,
            patternCount: patternPointers.length,
            fileSize: rawBuffer.byteLength
        }
    };
}