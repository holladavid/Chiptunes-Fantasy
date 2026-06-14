// ==========================================
// PAULA 8364 (Amiga) AudioWorkletProcessor
// ==========================================

class PaulaProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.clock = 3546895; 
        this.channels = [
            { pos: 0, period: 0, vol: 0, data: null, loopStart: 0, loopLen: 0, pan: -1 }, // L
            { pos: 0, period: 0, vol: 0, data: null, loopStart: 0, loopLen: 0, pan: 1 },  // R
            { pos: 0, period: 0, vol: 0, data: null, loopStart: 0, loopLen: 0, pan: 1 },  // R
            { pos: 0, period: 0, vol: 0, data: null, loopStart: 0, loopLen: 0, pan: -1 }  // L
        ];

        this.port.onmessage = (e) => {
            const msg = e.data;
            const ch = this.channels[msg.channel];
            if (!ch) return;
            
            if (msg.type === 'SET_SAMPLE') {
                ch.data = msg.data;
                ch.loopStart = msg.loopStart || 0;
                ch.loopLen = msg.loopLen || 0;
                ch.pos = 0; 
            } else if (msg.type === 'SET_REG') {
                if (msg.period !== undefined) ch.period = msg.period;
                if (msg.vol !== undefined) ch.vol = msg.vol / 64.0; 
                if (msg.trigger) ch.pos = 0;
            }
        };
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const outL = output[0]; // Linker Lautsprecher
        // Falls der Browser nur Mono ausgibt, fangen wir das hier ab!
        const outR = output.length > 1 ? output[1] : null; 

        let oscValue = 0;

        for (let i = 0; i < outL.length; i++) {
            let mixedL = 0;
            let mixedR = 0;

            for (let c = 0; c < 4; c++) {
                const ch = this.channels[c];
                
                if (ch.data && ch.period > 0 && ch.vol > 0) {
                    let posInt = Math.floor(ch.pos);
                    
                    if (posInt < ch.data.length) {
                        let sampleVal = ch.data[posInt] * ch.vol;
                        if (ch.pan < 0) mixedL += sampleVal;
                        else mixedR += sampleVal;
                    }

                    // Amiga Playback Math!
                    let playbackFreq = this.clock / ch.period;
                    ch.pos += playbackFreq / sampleRate;

                    if (ch.pos >= ch.data.length) {
                        if (ch.loopLen > 2) {
                            ch.pos = ch.loopStart + (ch.pos - ch.data.length);
                        } else {
                            ch.data = null; 
                        }
                    }
                }
            }
            
            // Ausgabe: Schutz vor Stereo-Fehlern
            outL[i] = mixedL / 2.0;
            if (outR) {
                outR[i] = mixedR / 2.0;
            } else {
                outL[i] += mixedR / 2.0; // Mixdown auf Mono, falls nötig
            }
            
            if (i === 0) oscValue = (mixedL + mixedR) / 2.0;
        }

// BUGFIX 2: Performance Boost
        if (this.visCounter === undefined) this.visCounter = 0;
        if (this.visCounter++ % 4 === 0) {
            this.port.postMessage({ type: 'VISUAL_DATA', value: oscValue });
        }
        return true;
    }
}

registerProcessor('paula-processor', PaulaProcessor);