// === js/parsers/hipc-parser.js ===
// =========================================================
// JOCHEN HIPPEL (MAD MAX) COSO / HIPC BLOCK-RIPPER
// Layer A — Proven Binary Container Specification:
// - Dynamic 32-Byte Header decoding ($0000..$001F)
// - "COSO" ($0000) & "TFMX" ($0018) Tag Verification
// - 32-Bit Table Pointers: Patterns, Macros, Samples, PCM Data
// - Dynamic 16-Bit Pattern Pointer Table ($02E4 / $02F6)
// - Dynamic 4-Voice Track Start Offsets ($0028)
// - 32-Byte Signed 8-Bit Wavetable Extractions
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
    // 1. LAYER A: HEADER-PARSING & SIGNATUR-VERIFIKATION
    // =========================================================
    const magic0 = String.fromCharCode(data[0], data[1], data[2], data[3]);
    const magicTfmx = String.fromCharCode(data[0x18], data[0x19], data[0x1A], data[0x1B]);

    const isCoso = (magic0 === 'COSO') || (magicTfmx === 'TFMX');
    if (!isCoso) {
        throw new Error(`Ungültiges COSO-Modul: Header-Signaturen nicht gefunden ("${magic0}" / "${magicTfmx}").`);
    }

    // 32-Bit Big-Endian Longword Offsets aus dem Header auslesen
    const initFlags        = view.getUint16(0x04, false);
    const subsongInfo      = view.getUint16(0x06, false);
    const patTableOffset   = view.getUint32(0x08, false);
    const macroTableOffset = view.getUint32(0x0C, false);
    const sampleTableOffset= view.getUint32(0x10, false);
    const sampleDataOffset = view.getUint32(0x14, false);

    // Plausibilitätsprüfung der Blockgrenzen
    if (!(0 < patTableOffset && 
          patTableOffset < macroTableOffset && 
          macroTableOffset < sampleTableOffset && 
          sampleTableOffset < sampleDataOffset && 
          sampleDataOffset <= data.length)) {
        throw new Error(`Korrupte COSO-Pointer-Tabelle im Header: [Pat:$${patTableOffset.toString(16)}, Mac:$${macroTableOffset.toString(16)}, Smp:$${sampleTableOffset.toString(16)}, PCM:$${sampleDataOffset.toString(16)}]`);
    }

    // =========================================================
    // 2. LAYER A: 16-BIT PATTERN-POINTER-TABELLE
    // =========================================================
    const firstPatternOffset = view.getUint16(patTableOffset, false);
    const numPatterns = Math.max(1, Math.floor((firstPatternOffset - patTableOffset) / 2));
    
    const patternPointers = new Uint16Array(numPatterns);
    for (let i = 0; i < numPatterns; i++) {
        patternPointers[i] = view.getUint16(patTableOffset + (i * 2), false);
    }

    // =========================================================
    // 3. LAYER A: 4-VOICE TRACK START-POINTER ($0028)
    // =========================================================
    const voiceTrackPointers = [
        view.getUint16(0x0028, false),
        view.getUint16(0x002A, false),
        view.getUint16(0x002C, false),
        view.getUint16(0x002E, false)
    ];

    // =========================================================
    // 4. LAYER A: BLOCK-RIPPER (ISOLIERTE SUBARRAYS)
    // =========================================================
    const trackBlock        = data.subarray(0x0020, patTableOffset);
    const patternBlock      = data.subarray(patTableOffset, macroTableOffset);
    const macroBlock        = data.subarray(macroTableOffset, sampleTableOffset);
    const sampleHeaderBlock = data.subarray(sampleTableOffset, sampleDataOffset);
    const sampleDataBlock   = data.subarray(sampleDataOffset);

    // =========================================================
    // 5. LAYER A: 32-BYTE SYNTHESIZER WAVETABLES ($1C94 / $0EDC)
    // =========================================================
    const samples = {};
    const NUM_WAVEFORMS = 16;
    const WAVE_LEN = 32; // Exakt 32 Bytes (16 Words)

    for (let i = 0; i < NUM_WAVEFORMS; i++) {
        const waveOffset = sampleDataOffset + (i * WAVE_LEN);
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
    console.log(`[COSO PARSER] Header: Patterns@$${patTableOffset.toString(16)} (${numPatterns} Ptrs), Macros@$${macroTableOffset.toString(16)}, Samples@$${sampleTableOffset.toString(16)}, PCM@$${sampleDataOffset.toString(16)}`);
    console.log(`[COSO PARSER] Voices: [0:$${voiceTrackPointers[0].toString(16)}, 1:$${voiceTrackPointers[1].toString(16)}, 2:$${voiceTrackPointers[2].toString(16)}, 3:$${voiceTrackPointers[3].toString(16)}]`);

    return {
        isSequenced: true,
        type: 'HIPC',
        numChannels: 4,
        header: {
            initFlags,
            subsongInfo,
            patTableOffset,
            macroTableOffset,
            sampleTableOffset,
            sampleDataOffset,
            numPatterns,
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
        length: 50 * 180, // Fallback-Schätzung 180s VBLANK
        metadata: {
            name: url.split('/').pop().toUpperCase(),
            author: "JOCHEN HIPPEL (MAD MAX)",
            comment: `LAYER A PROVEN BINARY CONTAINER (COSO / TFMX)`,
            type: "Hippel-COSO (4-Channel Paula DMA)",
            instrumentCount: NUM_WAVEFORMS,
            patternCount: numPatterns,
            fileSize: rawBuffer.byteLength
        }
    };
}