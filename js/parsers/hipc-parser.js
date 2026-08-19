// === js/parsers/hipc-parser.js ===
// =========================================================
// JOCHEN HIPPEL (MAD MAX) COSO 7-VOICE RAW BYTECODE PROBE
// Phase 2: Authentic Stream Disassembler & Macro Logger
// Strictly logs Tracksteps and Pattern Commands for M68k Validation.
// =========================================================

export async function loadHipcFile(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Datei nicht gefunden: ${url}`);
    
    const rawBuffer = await response.arrayBuffer();
    const data = new Uint8Array(rawBuffer);
    const view = new DataView(data.buffer);

    console.log(`\n=== [HIPC PARSER] PHASE 2: STREAM DISASSEMBLER - ${url.split('/').pop()} ===`);

    // =========================================================
    // 1. EXTRACT 7 TRACK POINTERS FROM 0x0020
    // =========================================================
    const trackPointers = [];
    let pOffset = 0x0020;
    for (let c = 0; c < 7; c++) {
        let ptr = view.getUint16(pOffset, false);
        trackPointers.push(ptr);
        pOffset += 2;
    }
    console.log(`[HEADER] 7 Track Pointers: ${trackPointers.map(p => '$'+p.toString(16).toUpperCase()).join(', ')}`);

    // =========================================================
    // 2. DISASSEMBLE TRACKSTEPS (ORDER LIST)
    // =========================================================
    console.log(`\n--- [DUMP] TRACKSTEP TABLES (Order Lists) ---`);
    // Wir wissen, dass nach den Track-Pointern die Track-Listen beginnen.
    // Sie bestehen aus 2-Byte Tokens, bis ein End/Loop Token kommt.
    
    for (let c = 0; c < 7; c++) {
        let ptr = trackPointers[c];
        let steps = [];
        let safety = 64;
        
        while (safety > 0) {
            let b0 = data[ptr++];
            let b1 = data[ptr++];
            
            let hex = `${b0.toString(16).toUpperCase().padStart(2,'0')} ${b1.toString(16).toUpperCase().padStart(2,'0')}`;
            steps.push(hex);
            
            // Wenn b0 == $00 und b1 > $E0 ist es oft ein Loop oder End Command im Trackstep!
            if (b0 === 0x00 && b1 >= 0xE0) break;
            safety--;
        }
        console.log(`CH${c} Tracksteps: [ ${steps.join(' | ')} ]`);
    }

    // =========================================================
    // 3. DISASSEMBLE PATTERN DATA (ab $02E4)
    // =========================================================
    let patStart = view.getUint16(0x08, false);
    if (patStart === 0 || patStart >= data.length) patStart = 0x02E4;
    console.log(`\n--- [DUMP] PATTERN DATA STREAM (Starts @ $${patStart.toString(16).toUpperCase()}) ---`);

    let pPtr = patStart;
    let eventCount = 0;

    while (eventCount < 40 && pPtr < data.length) { // Dump the first 40 Pattern Events
        let b0 = data[pPtr++];
        let b1 = data[pPtr++];
        let logStr = `PC=$${(pPtr-2).toString(16).toUpperCase().padStart(4, '0')} | `;

        if (b0 === 0xFF) {
            logStr += `[OP: FF] End/Loop    -> Param: $${b1.toString(16).toUpperCase().padStart(2,'0')}`;
        } else if (b0 === 0xFE) {
            logStr += `[OP: FE] Wait/Delay  -> Ticks: $${b1.toString(16).toUpperCase().padStart(2,'0')} (${(b1 & 0x3F)+1} Frames)`;
        } else if (b0 === 0xFD) {
            logStr += `[OP: FD] Command     -> Param: $${b1.toString(16).toUpperCase().padStart(2,'0')}`;
        } else if (b0 === 0x00) {
            logStr += `[OP: 00] Rest/KeyOff -> Macro: $${b1.toString(16).toUpperCase().padStart(2,'0')}`;
        } else {
            // Reale Note (z.B. $13 = Note 19 = G-1 / C-2)
            logStr += `[NOTE: $${b0.toString(16).toUpperCase().padStart(2,'0')}] Play Note -> Macro: $${b1.toString(16).toUpperCase().padStart(2,'0')}`;
        }
        console.log(logStr);
        eventCount++;
    }

    console.log(`\n=== [HIPC PARSER] PROBE FINISHED ===\n`);

    // Dummy Return, damit die Audio-Engine nicht crasht
    return {
        isSequenced: false, 
        frames: [], 
        samples: {}, 
        length: 0,
        metadata: {
            name: url.split('/').pop().toUpperCase(),
            author: "JOCHEN HIPPEL",
            comment: "TRACK & PATTERN DISASSEMBLY ACTIVE - CHECK CONSOLE",
            type: "COSO Raw Scanner",
            instrumentCount: 0, patternCount: 0, fileSize: data.length
        }
    };
}