// ==========================================
// YM BINARY FILE PARSER (YM3b / YM5! / YM6!)
// ==========================================

export async function loadYmFile(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Datei nicht gefunden: ${url}`);
    
    const buffer = await response.arrayBuffer();
    const data = new Uint8Array(buffer);

    const sig = String.fromCharCode(data[0], data[1], data[2], data[3]);
    const lhaCheck = String.fromCharCode(data[2], data[3], data[4], data[5], data[6]);
    if (lhaCheck === '-lh5-' || lhaCheck === '-lh0-') {
        throw new Error("DATEI IST KOMPRIMIERT! Bitte entpacke sie zuerst lokal mit 7-Zip.");
    }

    let frames = 0;
    let regDataStart = 0;
    let numRegs = 14;
    
    let digidrums = []; 
    let frameArray = [];
    
    // Die Basisstruktur für die Metadaten
    let metadata = { 
        name: "Unknown", 
        author: "Unknown", 
        comment: "", 
        type: sig, 
        digidrumCount: 0, 
        digidrumSizes: [] 
    };

    if (sig === 'YM3!' || sig === 'YM3b') {
        frames = (data.length - 4) / 16;
        regDataStart = 4;
    } 
    else if (sig === 'YM5!' || sig === 'YM6!') {
        frames = data[12]*16777216 + data[13]*65536 + data[14]*256 + data[15];
        
        let additionalDataSize = (data[32] << 8) | data[33];
        let pos = 34 + additionalDataSize; 
        
        // --- DIGIDRUMS EXTRAHIEREN ---
        let numDigidrums = (data[20] << 8) | data[21];
        let digiSizes = [];
        
        for (let d = 0; d < numDigidrums; d++) {
            let sampleSize = data[pos]*16777216 + data[pos+1]*65536 + data[pos+2]*256 + data[pos+3];
            pos += 4;
            
            // Größe abspeichern für das Info-Panel
            digiSizes.push(sampleSize);
            
            let pcm = new Float32Array(sampleSize);
            for (let i = 0; i < sampleSize; i++) {
                pcm[i] = (data[pos + i] - 128) / 128.0; 
            }
            digidrums.push(pcm);
            pos += sampleSize;
        }

        // --- METADATEN EXTRAHIEREN ---
        let nulls = 0;
        let infoArray = [];
        let currentStr = "";
        while (nulls < 3 && pos < data.length) {
            if (data[pos] === 0) {
                nulls++;
                infoArray.push(currentStr);
                currentStr = "";
            } else {
                currentStr += String.fromCharCode(data[pos]);
            }
            pos++;
        }
        
        metadata.name = infoArray[0] || "Unknown";
        metadata.author = infoArray[1] || "Unknown";
        metadata.comment = infoArray[2] || "";
        metadata.digidrumCount = numDigidrums;
        metadata.digidrumSizes = digiSizes;
        
        regDataStart = pos;
        numRegs = 16; 
    } 

    // --- DE-INTERLEAVE ---
    for (let i = 0; i < frames; i++) {
        let frame = new Uint8Array(16); 
        for (let r = 0; r < numRegs; r++) {
            let bytePos = regDataStart + (r * frames) + i;
            if (bytePos < data.length) frame[r] = data[bytePos];
        }
        frameArray.push(frame);
    }

    // Saubere Übergabe aller Daten (ohne Syntax-Error!)
    return {
        frames: frameArray,
        digidrums: digidrums,
        metadata: metadata
    };
}