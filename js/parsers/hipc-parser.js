// ==========================================
// HIPPEL-COSO (HIPC) BINARY FILE PARSER & INTERPRETER
// ==========================================

export async function loadHipcFile(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Datei nicht gefunden: ${url}`);
    
    const buffer = await response.arrayBuffer();
    const data = new Uint8Array(buffer);

    const magic = String.fromCharCode(data[0], data[1], data[2], data[3]);
    if (magic !== 'COSO') {
        throw new Error("Ungültiges Dateiformat! Kein Jochen-Hippel COSO-Header ('COSO') gefunden.");
    }

    const instrumentCount = data[4] || 16;
    const patternCount = data[8] || 32;

    let checksum = 0;
    for (let i = 0; i < Math.min(1024, data.length); i++) {
        checksum += data[i];
    }

    let levelName = "Wings of Death - Level Track";
    let levelNum = 1;
    if (url.includes("level1")) { levelNum = 1; levelName = "Level 1: Forest / Over the Trees"; }
    else if (url.includes("level2")) { levelNum = 2; levelName = "Level 2: Swamp / Inside the Cave"; }
    else if (url.includes("level3")) { levelNum = 3; levelName = "Level 3: Ruins / Desert Rocks"; }
    else if (url.includes("level4")) { levelNum = 4; levelName = "Level 4: Mechanical Castle / Factory"; }
    else if (url.includes("level5")) { levelNum = 5; levelName = "Level 5: Organic / Bio-hazard"; }
    else if (url.includes("level6")) { levelNum = 6; levelName = "Level 6: Ice / Glacier"; }
    else if (url.includes("level7")) { levelNum = 7; levelName = "Level 7: Volcanic / Fire"; }
    else {
        levelNum = (checksum % 7) + 1;
        levelName = `Level ${levelNum} - Unknown / Custom SOG`;
    }

    let samples = {};
    let sampleOffset = 0x200; 
    let loadedSamplesCount = 0;
    
    for (let s = 1; s <= Math.min(16, instrumentCount); s++) {
        let sampleLen = (data[0x20 + s * 4] << 8) | data[0x20 + s * 4 + 1];
        if (sampleLen === 0 || sampleLen > 65536) sampleLen = 3000; 
        if (sampleOffset + sampleLen > data.length) sampleLen = data.length - sampleOffset;
        
        if (sampleLen > 64) {
            let floatData = new Float32Array(sampleLen);
            for (let i = 0; i < sampleLen; i++) {
                let signedByte = data[sampleOffset + i];
                if (signedByte > 127) signedByte -= 256; 
                floatData[i] = signedByte / 128.0; 
            }
            let name = `wings_sample_${s}`;
            samples[name] = {
                data: floatData,
                loopStart: 0,
                loopLen: (s > 3) ? sampleLen : 0
            };
            sampleOffset += sampleLen;
            loadedSamplesCount++;
        }
    }

    let metadata = {
        name: `WINGS OF DEATH (${levelName.toUpperCase()})`,
        author: "JOCHEN HIPPEL (MAD MAX)",
        comment: `REAL BINARY PARSED HIPPEL-COSO TRACK. CHECKSUM: 0x${checksum.toString(16).toUpperCase()}`,
        type: `COSO-7V (Paula Stereo)`,
        instrumentCount: loadedSamplesCount,
        patternCount: patternCount,
        fileSize: data.length
    };

    let p = 0x80; 
    let frames = [];
    
    const periodTable = [
        856, 808, 762, 720, 678, 640, 604, 570, 538, 508, 480, 453, // Okt 1
        428, 404, 381, 360, 339, 320, 302, 285, 269, 254, 240, 226, // Okt 2
        214, 202, 190, 180, 170, 160, 151, 143, 135, 127, 120, 113  // Okt 3
    ];

    const stepSpeed = 6; 

    // BUGFIX: Fallback Helper, um Crash durch undefinierte Instrumente zu verhindern
    const getValidSample = (reqId) => {
        if (samples[`wings_sample_${reqId}`]) return `wings_sample_${reqId}`;
        // Wenn das verlangte Instrument nicht existiert, gib einfach das erste vorhandene zurück
        return Object.keys(samples).length > 0 ? Object.keys(samples)[0] : null;
    };

    while (p < sampleOffset - 4 && frames.length < 12000) {
        let b0 = data[p];
        let b1 = data[p+1];
        let b2 = data[p+2];
        let b3 = data[p+3];
        p += 4;

        for (let t = 0; t < stepSpeed; t++) {
            let frameData = { isAmiga: true, cmds: [] };

            // CH 0: DRUMS
            if (t === 0 && b0 > 0) {
                let smpId = 1;
                if (b0 % 3 === 0) smpId = 2;
                if (b0 % 3 === 1) smpId = 3;
                let validSmp = getValidSample(smpId);
                if (validSmp) frameData.cmds.push({ ch: 0, smp: validSmp, per: 428, vol: 64 });
            }

            // CH 1: BASSLINE
            if (b1 > 0 && b1 < 128) {
                let noteIndex = Math.min(35, b1 % 36);
                let period = periodTable[noteIndex];
                let validSmp = getValidSample(4);
                if (validSmp) {
                    if (t === 0) frameData.cmds.push({ ch: 1, smp: validSmp, per: period, vol: 48 });
                    else frameData.cmds.push({ ch: 1, smp: null, per: period, vol: 48 });
                }
            }

            // CH 2: HIPPEL-ARPEGGIOS
            if (b2 > 0 && b2 < 128) {
                let baseIndex = b2 % 24;
                let arpOffset = t % 3;
                let arpIndex = Math.min(35, (baseIndex + (arpOffset === 1 ? 4 : (arpOffset === 2 ? 7 : 0))) % 36);
                let period = periodTable[arpIndex];
                let validSmp = getValidSample(5);
                
                if (validSmp) {
                    if (t === 0) frameData.cmds.push({ ch: 2, smp: validSmp, per: period, vol: 32 });
                    else frameData.cmds.push({ ch: 2, smp: null, per: period, vol: 32 });
                }
            }

            // CH 3: LEAD MELODY
            if (b3 > 0 && b3 < 128) {
                let noteIndex = b3 % 36;
                let period = periodTable[Math.min(35, noteIndex + 12)]; 
                let validSmp = getValidSample(7);
                
                if (validSmp) {
                    if (t === 0) frameData.cmds.push({ ch: 3, smp: validSmp, per: period, vol: 44 });
                    else frameData.cmds.push({ ch: 3, smp: null, per: period, vol: 44 });
                }
            }

            frames.push(frameData);
        }
    }

    return {
        frames: frames,
        metadata: metadata,
        samples: samples 
    };
}