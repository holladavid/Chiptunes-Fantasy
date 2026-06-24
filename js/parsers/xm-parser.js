// ==========================================
// FASTTRACKER II (.XM) BINARY PARSER
// ==========================================

export async function loadXmFile(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Datei nicht gefunden: ${url}`);
    
    const buffer = await response.arrayBuffer();
    const data = new Uint8Array(buffer);
    const view = new DataView(buffer);

    // 1. Verifiziere XM Header
    const magic = String.fromCharCode(...data.slice(0, 17));
    if (magic !== 'Extended Module: ') {
        throw new Error("Ungültiges Dateiformat! Kein FastTracker II XM-Header gefunden.");
    }

    let songName = String.fromCharCode(...data.slice(17, 37)).trim();
    let trackerName = String.fromCharCode(...data.slice(38, 58)).trim();
    
    let headerSize = view.getUint32(60, true);
    let songLength = view.getUint16(64, true);
    let numChannels = view.getUint16(68, true);
    let numPatterns = view.getUint16(70, true);
    let numInstruments = view.getUint16(72, true);
    
    // BUGFIX: Beide Werte (Speed & Tempo) sauber deklarieren
    let defaultSpeed = view.getUint16(76, true); 
    let defaultTempo = view.getUint16(78, true);
    
    let orderTable = [];
    for(let i=0; i<songLength; i++) orderTable.push(data[80 + i]);

    // 2. Pattern-Daten parsen (Run-Length Encoding)
    let offset = 60 + headerSize;
    let patterns = [];

    for (let p = 0; p < numPatterns; p++) {
        let patHeaderLen = view.getUint32(offset, true);
        let numRows = view.getUint16(offset + 5, true);
        let packedSize = view.getUint16(offset + 7, true);
        
        let patternData = [];
        let ptr = offset + patHeaderLen;
        
        for (let r = 0; r < numRows; r++) {
            let row = [];
            for (let c = 0; c < numChannels; c++) {
                let note=0, smp=0, vol=0, eff=0, param=0;
                if (packedSize > 0) {
                    let b = data[ptr++];
                    if (b & 0x80) {
                        if (b & 0x01) note = data[ptr++];
                        if (b & 0x02) smp = data[ptr++];
                        if (b & 0x04) vol = data[ptr++];
                        if (b & 0x08) eff = data[ptr++];
                        if (b & 0x10) param = data[ptr++];
                    } else {
                        note = b;
                        smp = data[ptr++];
                        vol = data[ptr++];
                        eff = data[ptr++];
                        param = data[ptr++];
                    }
                }
                row.push({note, smp, vol, eff, param});
            }
            patternData.push(row);
        }
        patterns.push({ numRows, rows: patternData });
        offset += patHeaderLen + packedSize;
    }

    // 3. Instrumente & Delta-Samples extrahieren
    let samples = {};
    let loadedSamplesCount = 0;

    for (let i = 1; i <= numInstruments; i++) {
        let instHeaderSize = view.getUint32(offset, true);
        let numSamples = view.getUint16(offset + 27, true);
        
        if (numSamples > 0) {
            let sampleHeaderSize = view.getUint32(offset + 29, true);
            let shOffset = offset + instHeaderSize;
            let sampleHeaders = [];
            
            for (let s = 0; s < numSamples; s++) {
                sampleHeaders.push({
                    length: view.getUint32(shOffset, true),
                    loopStart: view.getUint32(shOffset+4, true),
                    loopLen: view.getUint32(shOffset+8, true),
                    vol: view.getUint8(shOffset+12),
                    finetune: view.getInt8(shOffset+13),
                    type: view.getUint8(shOffset+14),
                    relNote: view.getInt8(shOffset+16),
                });
                shOffset += sampleHeaderSize;
            }
            
            let sDataOffset = shOffset;
            for (let s = 0; s < numSamples; s++) {
                let sh = sampleHeaders[s];
                if (sh.length > 0) {
                    let is16Bit = (sh.type & 16) !== 0;
                    let isLoop = (sh.type & 3) !== 0;
                    
                    let floatData = new Float32Array(is16Bit ? sh.length/2 : sh.length);
                    let old = 0;
                    
                    // --- FASTTRACKER DELTA DECOMPRESSION ---
                    if (is16Bit) {
                        for(let j=0; j<sh.length/2; j++) {
                            let v = view.getInt16(sDataOffset, true);
                            sDataOffset += 2;
                            old = (old + v) & 0xFFFF;
                            let signed = old < 32768 ? old : old - 65536;
                            floatData[j] = signed / 32768.0;
                        }
                    } else {
                        for(let j=0; j<sh.length; j++) {
                            let v = view.getInt8(sDataOffset);
                            sDataOffset += 1;
                            old = (old + v) & 0xFF;
                            let signed = old < 128 ? old : old - 256;
                            floatData[j] = signed / 128.0;
                        }
                    }
                    
                    // Speichere primäres Sample (für Paula ignorieren wir Advanced Keymaps)
                    samples[`xm_sample_${i}`] = {
                        data: floatData,
                        loopStart: is16Bit ? sh.loopStart/2 : sh.loopStart,
                        loopLen: isLoop ? (is16Bit ? sh.loopLen/2 : sh.loopLen) : 0,
                        baseVolume: sh.vol,
                        relNote: sh.relNote
                    };
                    loadedSamplesCount++;
                }
            }
            offset = sDataOffset;
        } else {
            offset += instHeaderSize;
        }
    }

    // 4. Sequenzer Entrollen
    // Amiga Periodentabelle (Präzise Berechnung für sauberes Tuning)
    const amigaPeriods = new Float32Array(97);
    for(let n=1; n<=96; n++) {
        // XM Note 49 = C-4. Amiga C-3 = 428 (Note 37).
        amigaPeriods[n] = 428.0 * Math.pow(2.0, (37 - n) / 12.0);
    }

    let frames = [];
    
    // BUGFIX: Nutze korrekt "defaultSpeed" für die Loop-Anzahl (Ticks pro Row)
    let speed = defaultSpeed > 0 ? defaultSpeed : 6;

    for (let order = 0; order < songLength; order++) {
        let patIdx = orderTable[order];
        let pattern = patterns[patIdx];
        if (!pattern) continue;

        for (let row = 0; row < pattern.numRows; row++) {
            for (let tick = 0; tick < speed; tick++) {
                let frameCmds = [];
                for (let ch = 0; ch < numChannels; ch++) {
                    let cell = pattern.rows[row][ch];
                    if (tick === 0) {
                        let cmdObj = { ch: ch };
                        let hasData = false;
                        
                        if (cell.note > 0 && cell.note < 97) {
                            let smpName = `xm_sample_${cell.smp}`;
                            cmdObj.smp = smpName;
                            
                            let relNote = 0;
                            if (samples[smpName]) {
                                cmdObj.vol = samples[smpName].baseVolume;
                                relNote = samples[smpName].relNote || 0;
                            }
                            
                            let actualNote = cell.note + relNote;
                            if(actualNote < 1) actualNote = 1;
                            if(actualNote > 96) actualNote = 96;
                            
                            cmdObj.per = amigaPeriods[actualNote];
                            hasData = true;
                        } else if (cell.note === 97) {
                            // Key Off
                            cmdObj.vol = 0;
                            hasData = true;
                        }

                        // Volume Column
                        if (cell.vol >= 0x10 && cell.vol <= 0x50) {
                            cmdObj.vol = cell.vol - 0x10;
                            hasData = true;
                        }
                        
                        // Basic Volume Effect
                        if (cell.eff === 0x0C) {
                            cmdObj.vol = cell.param;
                            hasData = true;
                        }

                        if (hasData) frameCmds.push(cmdObj);
                    }
                }
                frames.push({ isAmiga: true, cmds: frameCmds });
            }
        }
    }

    return {
        frames: frames,
        metadata: {
            name: songName || "UNTITLED XM TRACK",
            author: trackerName,
            comment: `16-BIT XM MODULE CRUNCHED THROUGH 8-BIT PAULA DAC`,
            type: `FastTracker II (${numChannels}-Channel)`,
            instrumentCount: loadedSamplesCount,
            patternCount: numPatterns,
            fileSize: data.length
        },
        samples: samples 
    };
}