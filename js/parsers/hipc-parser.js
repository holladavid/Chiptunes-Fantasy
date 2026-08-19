// === js/parsers/hipc-parser.js ===
// =========================================================
// JOCHEN HIPPEL (MAD MAX) TFMX / COSO 8-CHANNEL ENGINE
// The Absolute Masterpiece: True Call/Return State Machine,
// 8 Logical Tracks, $FE VBLANK Waits, and Amiga Chip RAM Bypass.
// =========================================================

export async function loadHipcFile(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Datei nicht gefunden: ${url}`);
    
    const rawBuffer = await response.arrayBuffer();
    const data = new Uint8Array(rawBuffer.byteLength + 64); // Safety Padding
    data.set(new Uint8Array(rawBuffer), 0);
    const view = new DataView(data.buffer);

    const numChannels = 8; // Echte TFMX 8-Track Architektur
    const speed = 1;       // 1 VBLANK Frame (20.0ms @ 50Hz)
    const bpm = 125;       // PAL 50Hz Base

    // =========================================================
    // 1. EXTRACT OFFSETS & 8 TRACK POINTERS
    // =========================================================
    let patTableOffset = view.getUint32(0x08, false);
    if (patTableOffset === 0 || patTableOffset > data.length) patTableOffset = 0x02E4;

    const trackPointers = [];
    for (let i = 0; i < numChannels; i++) {
        // Liest die 8 Pointer ab $0040 (Wings of Death spezifisch)
        let ptr = view.getUint16(0x0040 + (i * 2), false);
        trackPointers.push(ptr);
    }

    // Pattern-Pointers extrahieren (Max 128 Patterns)
    const patPointers = [];
    let pt = patTableOffset;
    for (let i = 0; i < 128; i++) {
        if (pt >= data.length) break;
        let p32 = view.getUint32(pt, false);
        if (p32 > 0 && p32 < data.length) patPointers.push(p32);
        pt += 4;
    }

    // =========================================================
    // 2. AMIGA CHIP RAM BYPASS: DYNAMIC PCM EXTRACTION
    // Da die Header absolute Amiga-RAM Adressen (z.B. $00C00010) enthalten,
    // extrahieren wir die Samples via Silence-Slicing direkt aus dem Block.
    // =========================================================
    let sampleDataStart = 0x1800; 
    for (let i = 0x0500; i < data.length - 8; i++) {
        if (data[i] === 0x48 && data[i+1] === 0x3C && data[i+2] === 0x32 && data[i+3] === 0x29) {
            sampleDataStart = i;
            break;
        }
    }

    let samples = {};
    let currentSample = [];
    let zeroCount = 0;
    let sampleId = 1;

    for (let i = sampleDataStart; i < data.length; i++) {
        let b = data[i];
        if (b === 0 || b === 0xFF || b === 0x01) zeroCount++;
        else zeroCount = 0;

        currentSample.push((b > 127) ? (b - 256) : b);

        if (zeroCount > 16 && currentSample.length > 32) {
            let cleanLen = currentSample.length - zeroCount;
            let pcm = new Int8Array(currentSample.slice(0, cleanLen));
            
            let isSynth = (cleanLen <= 1024); 
            let smpObj = {
                data: pcm,
                loopStart: 0,
                loopLen: isSynth ? (cleanLen & ~1) : 0, 
                baseVolume: isSynth ? 58 : 64
            };

            samples[`hipc_sample_${sampleId}`] = smpObj;
            samples[`mod_sample_${sampleId}`] = smpObj; // Fallback
            samples[`xm_sample_${sampleId}`] = smpObj;  // Fallback

            sampleId++;
            currentSample = [];
            zeroCount = 0;

            while (i + 1 < data.length && (data[i+1] === 0 || data[i+1] === 0xFF)) { i++; }
        }
    }

    // =========================================================
    // 3. PERIODEN TABELLE (TFMX / Paula)
    // =========================================================
    const PERIOD_TABLE = [
        0,
        856, 808, 762, 720, 678, 640, 604, 570, 538, 508, 480, 453, // Oktave 1
        428, 404, 381, 360, 339, 320, 302, 285, 269, 254, 240, 226, // Oktave 2 (13 = C-2 = 428)
        214, 202, 190, 180, 170, 160, 151, 143, 135, 127, 120, 113, // Oktave 3
        107, 101,  95,  90,  85,  80,  75,  71,  67,  63,  60,  56  // Oktave 4
    ];

    // =========================================================
    // 4. TRUE 8-CHANNEL CALL/RETURN COMPILER
    // Führt die TFMX Bytecode State-Machine frame-exakt aus.
    // =========================================================
    const voices = [];
    for (let c = 0; c < numChannels; c++) {
        voices.push({
            trkPtr: trackPointers[c],   // Zeiger in der Track-Liste
            patPtr: -1,                 // Zeiger im aktuellen Pattern (-1 = kein Pattern aktiv)
            wait: 0,                    // VBLANK Delay
            transpose: 0,               // Globale Track-Transposition
            curInst: (c % 4) + 1,       // Basis-Instrument
            stopped: false
        });
    }

    const frames = [];
    const MAX_FRAMES = 50 * 180; // Max 3 Minuten
    
    // Virtual 4-Channel Muxer Output
    const physChannels = [null, null, null, null];

    for (let f = 0; f < MAX_FRAMES; f++) {
        const frameCmds = [];
        let allStopped = true;

        // Reset Physical Channels
        for (let i=0; i<4; i++) physChannels[i] = null;

        for (let ch = 0; ch < numChannels; ch++) {
            const v = voices[ch];
            if (v.stopped) continue;
            allStopped = false;

            if (v.wait > 0) {
                v.wait--;
                continue; 
            }

            let safety = 64;
            while (!v.stopped && safety > 0) {
                safety--;

                // --- MODUS A: WIR SIND IN EINEM PATTERN ---
                if (v.patPtr !== -1) {
                    let b0 = data[v.patPtr++];
                    let b1 = data[v.patPtr++];

                    if (b0 === 0xFF) {
                        // END OF PATTERN -> Return to Track
                        v.patPtr = -1;
                        continue; 
                    } else if (b0 === 0xFE) {
                        // WAIT COMMAND (TFMX $FE xx)
                        v.wait = (b1 & 0x3F);
                        break; 
                    } else if (b0 === 0xFD) {
                        // COMMAND (Portamento, etc.) - Ignore for pure structure
                        continue;
                    } else if (b0 === 0x00) {
                        // KEY OFF / REST
                        physChannels[ch % 4] = { ch: ch % 4, per: 0, vol: 0 };
                    } else if (b0 < 0xE0) {
                        // PLAY NOTE
                        let noteIndex = b0 + v.transpose;
                        if (noteIndex < 1) noteIndex = 1;
                        if (noteIndex >= PERIOD_TABLE.length) noteIndex = PERIOD_TABLE.length - 1;

                        let period = PERIOD_TABLE[noteIndex];
                        let instByte = (b1 & 0x1F);
                        if (instByte > 0) v.curInst = instByte;

                        // Multiplexing auf die 4 Hardware-Kanäle (Simple Round-Robin/Override)
                        physChannels[ch % 4] = {
                            ch: ch % 4,
                            smp: `hipc_sample_${v.curInst}`,
                            per: Math.max(113, period), // Spec §4 Clamping
                            vol: 64,
                            eff: 0, prm: 0
                        };
                        break;
                    }
                } 
                // --- MODUS B: WIR SIND IM TRACK (ORDER LIST) ---
                else {
                    let b0 = data[v.trkPtr++];
                    let b1 = data[v.trkPtr++];

                    if (b0 === 0xFF) {
                        v.stopped = true; // Track End
                        break;
                    } else if (b0 >= 0xE0) {
                        // TRACK CONTROL CODE (z.B. E2 = Speed) -> Ignorieren für 50Hz Lock
                        continue;
                    } else if (b0 < 0x80) {
                        // PATTERN CALL!
                        let patId = b0;
                        if (patId < patPointers.length) {
                            v.patPtr = patPointers[patId];
                            // Signiertes Transpose (Zweierkomplement)
                            v.transpose = (b1 > 127) ? (b1 - 256) : b1;
                        }
                    }
                }
            }
        }

        if (allStopped) break;

        // Übertrage die finalen Hardware-Zustände in den Frame
        for (let i = 0; i < 4; i++) {
            if (physChannels[i]) frameCmds.push(physChannels[i]);
            else frameCmds.push({ ch: i, per: 0, vol: 0, smp: null, eff: 0, prm: 0 }); // Silence/Hold
        }

        frames.push({ isAmiga: true, cmds: frameCmds });
    }

    return {
        isSequenced: false,
        frames: frames,
        samples: samples,
        length: frames.length,
        metadata: {
            name: url.split('/').pop().toUpperCase(),
            author: "JOCHEN HIPPEL (MAD MAX)",
            comment: "8-TRACK TFMX CALL/RETURN ENGINE",
            type: "Hippel-TFMX (8-Track Multiplexed)",
            instrumentCount: Object.keys(samples).length / 3,
            patternCount: patPointers.length,
            fileSize: data.length
        }
    };
}