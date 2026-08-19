// === js/parsers/hipc-parser.js ===
// =========================================================
// JOCHEN HIPPEL (MAD MAX) COSO HEX HEADER PROBE
// Dumps the first 128 bytes to crack the pointer structure!
// =========================================================

export async function loadHipcFile(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Datei nicht gefunden: ${url}`);
    
    const rawBuffer = await response.arrayBuffer();
    const data = new Uint8Array(rawBuffer);

    console.log(`\n=== [HIPC HEADER DUMP] ${url.split('/').pop()} ===`);
    console.log(`FILE SIZE: ${data.length} Bytes`);

    let hexDump = "";
    for (let i = 0; i < 128; i++) {
        hexDump += data[i].toString(16).toUpperCase().padStart(2, '0') + " ";
        if ((i + 1) % 16 === 0) {
            console.log(`$${(i - 15).toString(16).toUpperCase().padStart(4, '0')} | ${hexDump}`);
            hexDump = "";
        }
    }

    console.log(`\n=== [END OF DUMP] ===\n`);

    // Dummy Return
    return {
        isSequenced: false, frames: [], samples: {}, length: 0,
        metadata: {
            name: "HEADER PROBE", author: "MAD MAX", comment: "CHECK CONSOLE",
            type: "COSO Probe", instrumentCount: 0, patternCount: 0, fileSize: data.length
        }
    };
}