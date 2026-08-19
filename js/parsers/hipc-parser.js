// === js/parsers/hipc-parser.js ===
// =========================================================
// JOCHEN HIPPEL (MAD MAX) COSO / HIPC RAW BYTECODE SCANNER
// Phase 1: Pure Binary Probe & Semantic Structure Logging
// Dumps Sample Headers and Track Streams to the console
// for 1:1 validation against the M68k Disassembly.
// =========================================================

export async function loadHipcFile(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Datei nicht gefunden: ${url}`);
    
    const rawBuffer = await response.arrayBuffer();
    const data = new Uint8Array(rawBuffer);
    const view = new DataView(data.buffer);

    console.log(`\n=== [HIPC PARSER] BOOTING RAW BINARY PROBE: ${url.split('/').pop()} ===`);

    // =========================================================
    // 1. CONTAINER & POINTER EXTRACTION (No Guessing!)
    // =========================================================
    const subParam = view.getUint16(0x0A, false);
    console.log(`[HEADER] Subsong/Param Offset: $${subParam.toString(16).toUpperCase().padStart(4, '0')}`);

    let trackPointers = [];
    let sampleHeaderOffset = 0;
    let sampleDataStart = 0;

    // Hard-Routing für Level 1 & Level 2 basierend auf subParam
    if (subParam === 0x02E4) {
        trackPointers = [0x0074, 0x008A, 0x009E, 0x00B0];
        sampleHeaderOffset = 0x11FE;
        sampleDataStart = 0x1C94;
    } else if (subParam === 0x02F6) {
        trackPointers = [0x0088, 0x008C, 0x0094, 0x009F];
        sampleHeaderOffset = 0x0EDC;
        sampleDataStart = 0x1804;
    } else {
        console.error("[HEADER] Unbekanntes COSO-Derivat! Breche Scan ab.");
        throw new Error("Only Level 1 and Level 2 are mapped for raw probing.");
    }

    console.log(`[HEADER] Track Pointers: ${trackPointers.map(p => '$'+p.toString(16).toUpperCase()).join(', ')}`);
    console.log(`[HEADER] Sample Table Offset: $${sampleHeaderOffset.toString(16).toUpperCase()}`);
    console.log(`[HEADER] PCM Data Start: $${sampleDataStart.toString(16).toUpperCase()}`);

    // =========================================================
    // 2. SAMPLE TABLE DUMPER (Read 16 Bytes per Entry)
    // Wir raten keine Längen mehr! Wir dumpen den RAM, um den Struct zu sehen.
    // =========================================================
    console.log(`\n--- [DUMP] SAMPLE DESCRIPTOR TABLE (@ $${sampleHeaderOffset.toString(16).toUpperCase()}) ---`);
    let descPtr = sampleHeaderOffset;
    let samples = {}; // Dummy für den Player

    for (let i = 1; i <= 10; i++) { // Dump der ersten 10 Einträge
        let hexDump = [];
        for (let b = 0; b < 16; b++) {
            if (descPtr + b < data.length) {
                hexDump.push(data[descPtr + b].toString(16).toUpperCase().padStart(2, '0'));
            }
        }
        console.log(`SMP_${i.toString().padStart(2, '0')} | ${hexDump.slice(0,8).join(' ')} - ${hexDump.slice(8,16).join(' ')}`);
        
        // Dummy-Sample generieren, damit der Player nicht abstürzt
        samples[`hipc_sample_${i}`] = { data: new Int8Array(16), loopStart: 0, loopLen: 0, baseVolume: 64 };
        descPtr += 16;
    }

    // =========================================================
    // 3. COSO BYTECODE RAW DECODER (Track Stream Dumper)
    // =========================================================
    console.log(`\n--- [DUMP] RAW COSO BYTECODE STREAM ---`);
    
    const voices = trackPointers.map((ptr, id) => ({
        id: id,
        ptr: ptr,
        startPtr: ptr,
        stopped: false
    }));

    const frames = [];
    const MAX_CYCLES = 50; // Wir dumpen nur die ersten 50 Zyklen, um Endlosschleifen zu verhindern

    for (let cycle = 0; cycle < MAX_CYCLES; cycle++) {
        // Ein leerer Dummy-Frame für das AudioWorklet
        frames.push({ isAmiga: true, cmds: [] });

        for (let v of voices) {
            if (v.stopped) continue;

            let op = data[v.ptr];
            let bytesConsumed = 1;
            let logStr = `CH${v.id} PC=$${(v.ptr).toString(16).toUpperCase().padStart(4, '0')} | `;

            // Wir werten die Opcodes noch NICHT musikalisch aus,
            // wir isolieren nur die bekannten Steuer-Bytes!
            switch (op) {
                case 0xFF:
                    logStr += `[OP: FF (Track End/Loop?)] `;
                    bytesConsumed = 2; // Wir vermuten FF xx (z.B. FF FE)
                    v.stopped = true;  // Wir stoppen die Spur zur Sicherheit
                    break;
                case 0xFE:
                    logStr += `[OP: FE (Duration?)]       `;
                    bytesConsumed = 2; // Wir vermuten FE xx
                    break;
                case 0xFD:
                    logStr += `[OP: FD (Command?)]        `;
                    bytesConsumed = 2; // Wir vermuten FD xx
                    break;
                default:
                    // Alles < $E0 könnte Note + Instrument sein
                    logStr += `[OP: ${op.toString(16).toUpperCase().padStart(2, '0')} (Note/Event?)]   `;
                    bytesConsumed = 2; // Wir raten 2 Bytes (Note + Inst)
                    break;
            }

            // Hex-Dump der konsumierten Bytes
            let byteHex = [];
            for (let i = 0; i < bytesConsumed; i++) {
                byteHex.push(data[v.ptr + i].toString(16).toUpperCase().padStart(2, '0'));
            }
            logStr += `BYTES: ${byteHex.join(' ')}`;
            console.log(logStr);

            v.ptr += bytesConsumed;
        }
    }

    console.log(`\n=== [HIPC PARSER] PROBE FINISHED ===\n`);

    return {
        isSequenced: false, 
        frames: frames, // Dummy Silence
        samples: samples, // Dummy Silence
        length: frames.length,
        metadata: {
            name: url.split('/').pop().toUpperCase(),
            author: "JOCHEN HIPPEL",
            comment: "RAW BYTECODE PROBE ACTIVE - CHECK CONSOLE",
            type: "COSO Raw Scanner",
            instrumentCount: 0,
            patternCount: 0,
            fileSize: data.length
        }
    };
}