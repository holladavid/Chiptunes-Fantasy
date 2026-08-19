// === js/parsers/hipc-parser.js ===
// =========================================================
// JOCHEN HIPPEL (MAD MAX) COSO / 4-VOICE RAW BINARY DUMPER
// "Step 1 True": Zero Assumptions, Zero Emulated Semantics.
// Dumps the structural truth of Wings of Death Level 1.
// =========================================================

export async function loadHipcFile(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Datei nicht gefunden: ${url}`);
    
    const rawBuffer = await response.arrayBuffer();
    const data = new Uint8Array(rawBuffer);

    console.log(`\n=== [HIPC RAW DUMPER] BOOTING WINGS OF DEATH LVL 1 PROBE ===`);
    console.log(`FILE: ${url.split('/').pop()} | SIZE: ${data.length} Bytes`);

    // =========================================================
    // 1. HARDCODED WINGS OF DEATH LEVEL 1 OFFSETS
    // (Beweisbasiert aus der IRA Disassembly)
    // =========================================================
    const trackPointers = [
        0x0074, // CH0
        0x008A, // CH1
        0x009E, // CH2
        0x00B0  // CH3
    ];
    const sampleHeaderOffset = 0x11FE;
    const NUM_CHANNELS = 4;

    console.log(`[POINTERS] CH0:$${trackPointers[0].toString(16).toUpperCase()} | CH1:$${trackPointers[1].toString(16).toUpperCase()} | CH2:$${trackPointers[2].toString(16).toUpperCase()} | CH3:$${trackPointers[3].toString(16).toUpperCase()}`);
    console.log(`[POINTERS] Sample/Macro Table: $${sampleHeaderOffset.toString(16).toUpperCase()}`);

    // =========================================================
    // 2. DUMP SAMPLE / MACRO TABLE (@ $11FE)
    // =========================================================
    console.log(`\n--- [TABLE DUMP] @ $11FE (First 16 Entries, 16 Bytes each) ---`);
    let tblPtr = sampleHeaderOffset;
    for (let i = 0; i < 16; i++) {
        let hexRow = [];
        for (let b = 0; b < 16; b++) {
            if (tblPtr + b < data.length) {
                hexRow.push(data[tblPtr + b].toString(16).toUpperCase().padStart(2, '0'));
            }
        }
        console.log(`ENTRY_${i.toString().padStart(2, '0')} | ${hexRow.slice(0, 8).join(' ')} - ${hexRow.slice(8, 16).join(' ')}`);
        tblPtr += 16;
    }

    // =========================================================
    // 3. DUMP RAW TRACK STREAMS (No Opcode Interpretation!)
    // =========================================================
    console.log(`\n--- [STREAM DUMP] RAW BYTE SEQUENCE FOR ALL 4 CHANNELS ---`);

    for (let c = 0; c < NUM_CHANNELS; c++) {
        let ptr = trackPointers[c];
        let streamLog = [];
        let addrLog = [];
        
        // Wir dumpen stumpf die ersten 48 Bytes jedes Kanals
        for (let step = 0; step < 48; step++) {
            if (ptr < data.length) {
                let byteVal = data[ptr];
                streamLog.push(byteVal.toString(16).toUpperCase().padStart(2, '0'));
                if (step % 8 === 0) addrLog.push(`$${ptr.toString(16).toUpperCase().padStart(4, '0')}`);
                ptr++;
            }
        }

        console.log(`\n[CH ${c}] Starting at: ${addrLog.join(' / ')}`);
        
        // Formatiere die Ausgabe in schönen 8-Byte Blöcken
        for (let row = 0; row < 6; row++) {
            console.log(`  ${streamLog.slice(row * 8, (row + 1) * 8).join(' ')}`);
        }
    }

    console.log(`\n=== [HIPC RAW DUMPER] FINISHED ===\n`);

    // =========================================================
    // 4. FAILSAFE DUMMY RETURN (Silences the Audio Engine)
    // =========================================================
    return {
        isSequenced: false, 
        frames: [], 
        samples: {}, 
        length: 0,
        metadata: {
            name: "WINGS OF DEATH LVL 1",
            author: "MAD MAX",
            comment: "PURE RAW HEX DUMPER - NO AUDIO",
            type: "COSO Probe",
            instrumentCount: 0,
            patternCount: 0,
            fileSize: data.length
        }
    };
}