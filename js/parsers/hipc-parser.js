// === js/parsers/hipc-parser.js ===
// =========================================================
// JOCHEN HIPPEL (MAD MAX) COSO / TFMX DATA PROBE
// Phase 3: True TFMX Structure Dumper
// =========================================================

export async function loadHipcFile(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Datei nicht gefunden: ${url}`);
    
    const rawBuffer = await response.arrayBuffer();
    const data = new Uint8Array(rawBuffer);
    const view = new DataView(data.buffer);

    console.log(`\n=== [TFMX / COSO DATA PROBE] ${url.split('/').pop()} ===`);

    // 1. EXTRACT 32-BIT POINTERS
    const patPtrsTable = view.getUint32(0x08, false);
    const macPtrsTable = view.getUint32(0x0C, false);
    const patDataStart = view.getUint32(0x10, false);
    const macDataStart = view.getUint32(0x14, false);

    console.log(`[POINTERS] PatTable: $${patPtrsTable.toString(16).toUpperCase()} | MacTable: $${macPtrsTable.toString(16).toUpperCase()}`);
    console.log(`[POINTERS] PatData:  $${patDataStart.toString(16).toUpperCase()} | MacData:  $${macDataStart.toString(16).toUpperCase()}`);

    // 2. DUMP PATTERN POINTERS (First 8)
    console.log(`\n--- [DUMP] PATTERN POINTERS (@ $${patPtrsTable.toString(16).toUpperCase()}) ---`);
    let pTable = patPtrsTable;
    let patOffsets = [];
    for (let i = 0; i < 8; i++) {
        let p32 = view.getUint32(pTable, false);
        patOffsets.push(p32);
        console.log(`PAT_${i.toString().padStart(2,'0')} -> Absolute Offset: $${p32.toString(16).toUpperCase()}`);
        pTable += 4;
    }

    // 3. DUMP MACRO POINTERS (First 8)
    console.log(`\n--- [DUMP] MACRO POINTERS (@ $${macPtrsTable.toString(16).toUpperCase()}) ---`);
    let mTable = macPtrsTable;
    let macOffsets = [];
    for (let i = 0; i < 8; i++) {
        let m32 = view.getUint32(mTable, false);
        macOffsets.push(m32);
        console.log(`MAC_${i.toString().padStart(2,'0')} -> Absolute Offset: $${m32.toString(16).toUpperCase()}`);
        mTable += 4;
    }

    // 4. DUMP PATTERN 07 (Referenziert in Track 1)
    if (patOffsets[7] > 0 && patOffsets[7] < data.length) {
        console.log(`\n--- [DUMP] PATTERN 07 DATA (@ $${patOffsets[7].toString(16).toUpperCase()}) ---`);
        let ptr = patOffsets[7];
        let hexStr = [];
        for (let i = 0; i < 32; i++) {
            hexStr.push(data[ptr+i].toString(16).toUpperCase().padStart(2, '0'));
        }
        for (let row = 0; row < 4; row++) {
            console.log(`  ${hexStr.slice(row * 8, (row + 1) * 8).join(' ')}`);
        }
    }

    // 5. DUMP MACRO 00 (Referenziert in vielen Instrumenten)
    if (macOffsets[0] > 0 && macOffsets[0] < data.length) {
        console.log(`\n--- [DUMP] MACRO 00 DATA (@ $${macOffsets[0].toString(16).toUpperCase()}) ---`);
        let ptr = macOffsets[0];
        let hexStr = [];
        for (let i = 0; i < 32; i++) {
            hexStr.push(data[ptr+i].toString(16).toUpperCase().padStart(2, '0'));
        }
        for (let row = 0; row < 4; row++) {
            console.log(`  ${hexStr.slice(row * 8, (row + 1) * 8).join(' ')}`);
        }
    }

    console.log(`\n=== [TFMX PROBE FINISHED] ===\n`);

    // Failsafe Dummy Return
    return {
        isSequenced: false, frames: [], samples: {}, length: 0,
        metadata: {
            name: "TFMX PROBE", author: "MAD MAX", comment: "HEX DUMPER", type: "TFMX",
            instrumentCount: 0, patternCount: 0, fileSize: data.length
        }
    };
}