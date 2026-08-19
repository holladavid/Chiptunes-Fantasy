// === js/parsers/hipc-parser.js ===
// =========================================================
// JOCHEN HIPPEL (MAD MAX) COSO 7-VOICE FRAME COMPILER
// Phase 4: True 32-Bit Pointer Decoding & Dynamic PCM Slicing
// =========================================================

export async function loadHipcFile(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Datei nicht gefunden: ${url}`);
    
    const rawBuffer = await response.arrayBuffer();
    const data = new Uint8Array(rawBuffer.byteLength + 64); // Failsafe Padding
    data.set(new Uint8Array(rawBuffer), 0);
    const view = new DataView(data.buffer);

    const numChannels = 7;
    const speed = 1;       // 1 VBLANK Frame (20.0ms @ 50Hz)
    const bpm = 125;       // PAL 50Hz

    // =========================================================
    // 1. EXTRACT TRUE 32-BIT POINTERS & TRACK STARTS
    // =========================================================
    // Die Pointer liegen ab Offset $0008 als 32-Bit Longwords vor!
    let patTableOffset = view.getUint32(0x08, false);
    if (patTableOffset === 0 || patTableOffset > data.length) patTableOffset = 0x02E4;

    // Track-Pointer Array ab $0040 auslesen
    const trackPointers = [];
    for (let i = 0; i < numChannels; i++) {
        let ptr = view.getUint16(0x0042 + (i * 2), false);
        trackPointers.push(ptr);
    }

    // =========================================================
    // 2. DYNAMIC PCM "SILENCE SLICER" (Demoscene Hacker Trick!)
    // Wir suchen die Signatur $48 3C 32 29 und schneiden die Samples
    // an den Nulldurchgängen (Stille) in perfekte Instrumente.
    // =========================================================
    let sampleDataStart = 0x1800; // Fallback
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
        
        // Zählt aufeinanderfolgende Nullen (Stille)
        if (b === 0 || b === 0xFF || b === 0x01) {
            zeroCount++;
        } else {
            zeroCount = 0;
        }

        // Signed 8-Bit Konvertierung
        currentSample.push((b > 127) ? (b - 256) : b);

        // Wenn 16 Nullen am Stück kommen -> Sample beenden und abspeichern!
        if (zeroCount > 16 && currentSample.length > 64) {
            // Die angehängten Nullen abschneiden
            let cleanLen = currentSample.length - zeroCount;
            let pcm = new Int8Array(currentSample.slice(0, cleanLen));
            
            let isSynth = (cleanLen <= 1024); // Kurze Samples sind Synthesizer-Wellen!
            samples[`hipc_sample_${sampleId}`] = {
                data: pcm,
                loopStart: 0,
                loopLen: isSynth ? (cleanLen & ~1) : 0, // Nahtloser Loop für Synths
                baseVolume: isSynth ? 58 : 64
            };

            // Aliases für die AudioWorklets
            samples[`mod_sample_${sampleId}`] = samples[`hipc_sample_${sampleId}`];
            samples[`xm_sample_${sampleId}`] = samples[`hipc_sample_${sampleId}`];

            sampleId++;
            currentSample = [];
            zeroCount = 0;

            // Restliche Nullen überspringen
            while (i + 1 < data.length && (data[i+1] === 0 || data[i+1] === 0xFF)) { i++; }
        }
    }

    // Letztes Sample im Puffer retten
    if (currentSample.length > 64) {
        samples[`hipc_sample_${sampleId}`] = {
            data: new Int8Array(currentSample), loopStart: 0, loopLen: 0, baseVolume: 64
        };
    }

    // =========================================================
    // 3. AMIGA PAL PERIODENTABELLE
    // =========================================================
    const PERIOD_TABLE = [
        0,
        856, 808, 762, 720, 678, 640, 604, 570, 538, 508, 480, 453, // Oktave 1
        428, 404, 381, 360, 339, 320, 302, 285, 269, 254, 240, 226, // Oktave 2 (C-2 = 428)
        214, 202, 190, 180, 170, 160, 151, 143, 135, 127, 120, 113, // Oktave 3
        107, 101,  95,  90,  85,  80,  75,  71,  67,  63,  60,  56  // Oktave 4
    ];

    // =========================================================
    // 4. 50HZ VBLANK FRAME-COMPILER (Ausführung der 7 Tracks)
    // =========================================================
    const voices = [];
    for (let c = 0; c < numChannels; c++) {
        voices.push({
            ptr: trackPointers[c],
            startPtr: trackPointers[c],
            wait: 0,
            curInst: (c === 0 ? 1 : (c === 3 ? 4 : 5)),
            transpose: 0,
            stopped: false
        });
    }

    const frames = [];
    const MAX_FRAMES = 50 * 180; // Maximal 3 Minuten Spielzeit

    for (let f = 0; f < MAX_FRAMES; f++) {
        const frameCmds = [];
        let allStopped = true;

        for (let ch = 0; ch < numChannels; ch++) {
            const v = voices[ch];
            if (v.stopped) continue;
            allStopped = false;

            if (v.wait > 0) {
                v.wait--;
                continue; // Ton hält
            }

            let safety = 64; // Anti-Endlosschleifen-Schutz
            while (v.ptr + 1 < sampleDataStart && !v.stopped && safety > 0) {
                safety--;
                let b0 = data[v.ptr++];
                let b1 = data[v.ptr++];

                if (b0 === 0xFF) {
                    // $FF: End / Loop
                    v.ptr = v.startPtr;
                } else if (b0 === 0xFE) {
                    // $FE <ticks>: VBLANK Noten-Länge
                    v.wait = (b1 & 0x3F);
                    break;
                } else if (b0 === 0xFD) {
                    // $FD <transpose>: Tonlagenverschiebung
                    v.transpose = (b1 > 127) ? (b1 - 256) : b1;
                } else if (b0 === 0x00) {
                    // $00: KeyOff / Note Mute
                    frameCmds.push({ ch: ch, per: 0, vol: 0 });
                } else if (b0 > 0 && b0 < 60) {
                    // Note Event!
                    let noteIndex = b0 + v.transpose;
                    if (noteIndex < 1) noteIndex = 1;
                    if (noteIndex >= PERIOD_TABLE.length) noteIndex = PERIOD_TABLE.length - 1;

                    let period = PERIOD_TABLE[noteIndex];
                    let instByte = (b1 & 0x1F);
                    if (instByte > 0) v.curInst = instByte;

                    // Arpeggio Macro für Melodien
                    let effect = 0, param = 0;
                    if (b1 & 0x80) { effect = 0x00; param = 0x47; }

                    frameCmds.push({
                        ch: ch,
                        smp: `hipc_sample_${v.curInst}`,
                        per: period,
                        vol: 64,
                        eff: effect,
                        prm: param
                    });
                    break;
                }
            }
        }

        if (allStopped) break;
        frames.push({ isAmiga: true, cmds: frameCmds });
    }

    return {
        isSequenced: false, // Wird vom Core als fertiger Stream abgespielt!
        frames: frames,
        samples: samples,
        length: frames.length,
        metadata: {
            name: url.split('/').pop().toUpperCase(),
            author: "JOCHEN HIPPEL (MAD MAX)",
            comment: "DYNAMIC SILENCE-SLICED 7-VOICE VBLANK REPLAY",
            type: "Hippel-COSO (7-Channel Paula)",
            instrumentCount: Object.keys(samples).length / 3,
            patternCount: 1,
            fileSize: data.length
        }
    };
}