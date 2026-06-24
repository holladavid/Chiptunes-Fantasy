// ==========================================
// AMIGA PROTRACKER (.MOD) BINARY PARSER
// ==========================================

export async function loadModFile(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Datei nicht gefunden: ${url}`);
    
    const buffer = await response.arrayBuffer();
    const data = new Uint8Array(buffer);

    // 1. Verifiziere das Format anhand des Magic-Tags (Offset 1080)
    let magic = String.fromCharCode(data[1080], data[1081], data[1082], data[1083]);
    let is31Instruments = false;
    
    // Gültige ProTracker / NoiseTracker Tags (4 Kanäle)
    if (magic === 'M.K.' || magic === 'M!K!' || magic === '4CHN' || magic === 'FLT4') {
        is31Instruments = true;
    } else {
        throw new Error(`Kein gültiges 4-Kanal ProTracker MOD-Format. Tag gefunden: ${magic}`);
    }

    // 2. Song-Titel auslesen (Offset 0-19)
    let songName = "";
    for (let i = 0; i < 20; i++) {
        if (data[i] === 0) break;
        songName += String.fromCharCode(data[i]);
    }

    // 3. Instrumenten-Header auslesen (31 Instrumente, ab Offset 20)
    let samples = {};
    let sampleDataOffset = 1084; // Hier beginnen bei ProTracker die echten Audiodaten
    
    // Pattern-Tabelle auslesen, um zu berechnen, wo die Sample-Daten beginnen
    let songLength = data[950]; 
    let maxPattern = 0;
    for (let i = 0; i < 128; i++) {
        if (data[952 + i] > maxPattern) maxPattern = data[952 + i];
    }
    sampleDataOffset += (maxPattern + 1) * 1024; // Jedes Pattern ist exakt 1024 Bytes groß

    let loadedSamplesCount = 0;
    let currentSampleOffset = sampleDataOffset;

    for (let i = 0; i < 31; i++) {
        let offset = 20 + (i * 30);
        let sampleLenBytes = ((data[offset + 22] << 8) | data[offset + 23]) * 2;
        let finetune = data[offset + 24];
        let volume = data[offset + 25];
        let loopStart = ((data[offset + 26] << 8) | data[offset + 27]) * 2;
        let loopLen = ((data[offset + 28] << 8) | data[offset + 29]) * 2;

        if (sampleLenBytes > 2) {
            let floatData = new Float32Array(sampleLenBytes);
            // Konvertiere vorzeichenbehaftete 8-Bit Amiga-Samples
            for (let s = 0; s < sampleLenBytes; s++) {
                let signedByte = data[currentSampleOffset + s];
                if (signedByte > 127) signedByte -= 256;
                floatData[s] = signedByte / 128.0;
            }

            samples[`mod_sample_${i + 1}`] = {
                data: floatData,
                loopStart: loopStart,
                loopLen: loopLen,
                baseVolume: volume
            };
            loadedSamplesCount++;
            currentSampleOffset += sampleLenBytes;
        }
    }

    let metadata = {
        name: songName.trim() || "UNTITLED AMIGA TRACK",
        author: "UNKNOWN SCENER",
        comment: `REAL PROTRACKER .MOD PARSED. TAG: ${magic}`,
        type: `ProTracker 4-Channel`,
        instrumentCount: loadedSamplesCount,
        patternCount: maxPattern + 1,
        fileSize: data.length
    };

    // 4. Pattern-Daten parsen und in 50Hz-VBLANK-Frames entrollen
    let frames = [];
    let speed = 6;  // Standard Amiga Tracker Speed (Ticks pro Row)
    let bpm = 125;  // Standard BPM

    // Iteriere durch die Song-Positionen
    for (let pos = 0; pos < songLength; pos++) {
        let patternIdx = data[952 + pos];
        let patternOffset = 1084 + (patternIdx * 1024);

        for (let row = 0; row < 64; row++) {
            let rowOffset = patternOffset + (row * 16);
            
            // Jeden Step für "speed" Ticks halten
            for (let tick = 0; tick < speed; tick++) {
                let frameData = { isAmiga: true, cmds: [] };

                for (let ch = 0; ch < 4; ch++) {
                    let chOffset = rowOffset + (ch * 4);
                    let b0 = data[chOffset];
                    let b1 = data[chOffset + 1];
                    let b2 = data[chOffset + 2];
                    let b3 = data[chOffset + 3];

                    // ProTracker Noten-Entschlüsselung (12-Bit Period)
                    let sampleNumber = (b0 & 0xF0) | (b2 >> 4);
                    let period = ((b0 & 0x0F) << 8) | b1;
                    let effectCmd = b2 & 0x0F;
                    let effectVal = b3;

                    if (tick === 0) {
                        let cmdObj = { ch: ch };
                        let hasData = false;

                        if (period > 0) {
                            cmdObj.per = period;
                            hasData = true;
                        }
                        if (sampleNumber > 0) {
                            cmdObj.smp = `mod_sample_${sampleNumber}`;
                            // Standard-Lautstärke des Instruments setzen
                            if (samples[cmdObj.smp]) {
                                cmdObj.vol = samples[cmdObj.smp].baseVolume;
                            }
                            hasData = true;
                        }

                        // Effekt C: Set Volume
                        if (effectCmd === 0x0C) {
                            cmdObj.vol = effectVal > 64 ? 64 : effectVal;
                            hasData = true;
                        }

                        // Effekt F: Set Speed (Wir vereinfachen BPM hier auf Speed-Ticks)
                        if (effectCmd === 0x0F && effectVal > 0 && effectVal < 32) {
                            speed = effectVal;
                        }

                        if (hasData) frameData.cmds.push(cmdObj);
                    } else {
                        // Tick > 0: Hardware-Arpeggio-Modulation (Effekt 0)
                        if (effectCmd === 0x00 && effectVal > 0) {
                            let arpOffsets = [0, (effectVal >> 4) & 0x0F, effectVal & 0x0F];
                            let currentOffset = arpOffsets[tick % 3];
                            
                            // Approximation: Eine halbe Note verringert die Periode um ca. 5.9%
                            let arpPeriod = period * Math.pow(0.9438, currentOffset);
                            frameData.cmds.push({ ch: ch, per: Math.floor(arpPeriod) });
                        }
                    }
                }
                frames.push(frameData);
            }
        }
    }

    return {
        frames: frames,
        metadata: metadata,
        samples: samples 
    };
}