// ==========================================
// MOS TECHNOLOGY PAULA 8364 CHIP EMULATION
// Cycle-Exact DMA & Zero-Order Hold (ZOH)
// ==========================================

// Statischer RC-Rekonstruktionsfilter (6 dB/oct bei 4421 Hz)
class StaticRCFilter {
    constructor(sampleRate) {
        this.lastOut = 0;
        this.alpha = Math.exp(-2.0 * Math.PI * 4421.0 / sampleRate);
    }
    process(input) {
        let out = (1.0 - this.alpha) * input + this.alpha * this.lastOut;
        this.lastOut = out;
        return out;
    }
}

// Biquad Butterworth Filter (12 dB/oct bei 3090 Hz, Q=0.707) - Stabilisiert!
class AmigaLEDFilter {
    constructor(sampleRate) {
        const fc = 3090; 
        const q = 0.707; 
        const w0 = 2 * Math.PI * fc / sampleRate;
        const alpha = Math.sin(w0) / (2 * q);
        const cosw0 = Math.cos(w0);
        
        const a0 = 1 + alpha;
        this.b0 = ((1 - cosw0) / 2) / a0;
        this.b1 = (1 - cosw0) / a0;
        this.b2 = ((1 - cosw0) / 2) / a0;
        this.a1 = (-2 * cosw0) / a0;
        this.a2 = (1 - alpha) / a0;
        
        this.x1 = 0; this.x2 = 0;
        this.y1 = 0; this.y2 = 0;
    }
    process(x) {
        let y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
        this.x2 = this.x1; this.x1 = x;
        this.y2 = this.y1; this.y1 = y;
        return y;
    }
}

// Emuliert einen Paula DMA-Kanal auf Byte-Ebene (Agnus-Anbindung)
class PaulaChannel {
    constructor() {
        this.vol = 0;       // 0 - 64
        this.per = 428;     // Period (Amiga Clock Ticks)
        this.data = null;   // RAM-Pointer
        
        // Emulierte Hardware-Register
        this.pointer = 0;   // Current Location (AUDxLC)
        this.length = 0;    // Remaining Bytes in DMA loop
        this.repPointer = 0;// Reload Location
        this.repLength = 0; // Reload Length
        
        this.phase = 0;     // Sub-Tick Akkumulator
    }

    trigger(data, loopStart, loopLen) {
        this.data = data;
        this.pointer = 0;
        this.length = data.length;
        this.phase = 0;
        
        if (loopLen > 2) {
            // Gelooptes Instrument: Reload-Register mit Loop-Daten füllen
            this.repPointer = loopStart;
            this.repLength = loopLen;
        } else {
            // One-Shot Instrument (Drum): Reload-Register blockieren (-1 flag)
            // Paula würde in Hardware auf einen Dummy-Buffer zeigen, wir stoppen virtuell.
            this.repPointer = -1; 
            this.repLength = 0;
        }
    }

    step(clockTicksPerSample) {
        if (!this.data || this.vol === 0 || this.per === 0 || this.length <= 0) return 0;

        // Paula addiert die Amiga-Clock-Ticks auf den Period-Counter
        this.phase += clockTicksPerSample / this.per;
        
        while (this.phase >= 1.0) {
            this.phase -= 1.0;
            this.pointer++;
            this.length--;
            
            if (this.length <= 0) {
                // DMA Block zu Ende! Agnus lädt die Backup-Register in Paula neu.
                if (this.repPointer === -1) {
                    this.data = null; // One-Shot sauber abgeklemmt!
                    return 0;
                } else {
                    this.pointer = this.repPointer;
                    this.length = this.repLength;
                }
            }
        }

        if (!this.data) return 0;
        
        // ZERO-ORDER HOLD: Paula interpoliert nicht. Der rohe Byte-Wert wird gehalten!
        let rawByte = this.data[this.pointer];
        if (isNaN(rawByte)) rawByte = 0; // Airbag
        
        // 14-BIT DAC MULTIPLICATION (Paula Hardware Quantisierung)
        let sample8 = Math.round(rawByte * 127.0); 
        let vol6 = Math.round(this.vol);
        return (sample8 * vol6) / 8128.0; 
    }
}

class PaulaProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.clock = 3546895; // PAL Amiga Master-Clock
        
        // NEU: Wir rüsten Paula heimlich auf 32 DMA-Kanäle hoch (für XM-Support)
        this.channels = [];
        for (let i = 0; i < 32; i++) {
            this.channels.push(new PaulaChannel());
        }
        
        this.samples = {}; 
        this.trackData = null;
        this.currentFrame = 0;
        this.sampleCounter = 0;
        this.isPlaying = false;

        this.staticL = new StaticRCFilter(sampleRate);
        this.staticR = new StaticRCFilter(sampleRate);
        this.ledL = new AmigaLEDFilter(sampleRate);
        this.ledR = new AmigaLEDFilter(sampleRate);
        this.ledFilterOn = true; 

        this.port.onmessage = (e) => {
            const msg = e.data;
            if (msg.type === 'UPLOAD_SAMPLE') {
                if (msg.data && msg.data.data instanceof Float32Array) {
                    this.samples[msg.name] = msg.data;
                } else {
                    this.samples[msg.name] = {
                        data: msg.data,
                        loopStart: msg.loopStart || 0,
                        loopLen: msg.loopLen !== undefined ? msg.loopLen : (msg.name === 'bass' || msg.name === 'chord' ? msg.data.length : 0)
                    };
                }
            } else if (msg.type === 'PLAY_TRACK') {
                this.trackData = msg.track;
                this.currentFrame = 0;
                this.sampleCounter = 0;
                this.isPlaying = true;
            } else if (msg.type === 'STOP_TRACK') {
                this.isPlaying = false;
            } else if (msg.type === 'RESUME_TRACK') {
                this.isPlaying = true;
            } else if (msg.type === 'SEEK_TRACK') {
                if (this.trackData) this.currentFrame = msg.frame % this.trackData.length;
            } else if (msg.type === 'SET_LED_FILTER') {
                this.ledFilterOn = msg.enabled;
            }
        };
    }

    process(inputs, outputs) {
        const outL = outputs[0][0]; 
        const outR = outputs[0].length > 1 ? outputs[0][1] : null; 
        let oscValue = 0;

        let clockTicksPerSample = this.clock / sampleRate;

        for (let i = 0; i < outL.length; i++) {
            if (!this.isPlaying) {
                outL[i] = 0; if (outR) outR[i] = 0;
                continue; 
            }
            
            if (this.isPlaying && this.trackData) {
                this.sampleCounter--;
                if (this.sampleCounter <= 0) {
                    this.sampleCounter += sampleRate / 50.0;
                    
                    let frame = this.trackData[this.currentFrame];
                    if (frame && frame.cmds) {
                        for (let cmd of frame.cmds) {
                            const ch = this.channels[cmd.ch];
                            if (cmd.smp) {
                                let sampleObj = this.samples[cmd.smp];
                                if (sampleObj && sampleObj.data) {
                                    ch.trigger(sampleObj.data, sampleObj.loopStart, sampleObj.loopLen);
                                }
                            }
                            if (cmd.per !== undefined) ch.per = cmd.per;
                            if (cmd.vol !== undefined) ch.vol = cmd.vol; 
                        }
                    }
                    this.currentFrame = (this.currentFrame + 1) % this.trackData.length;
                }
            }

            let mixedL = 0, mixedR = 0;
            
            // NEU: 32-Kanal Mixing mit Hardware LRRL-Panning!
            // Da inaktive Kanäle sofort "return 0;" feuern, bleibt die CPU-Last minimal.
            for (let c = 0; c < 32; c++) {
                let sampleVal = this.channels[c].step(clockTicksPerSample);
                if (sampleVal !== 0) {
                    if ((c % 4) === 0 || (c % 4) === 3) mixedL += sampleVal; // Left
                    else mixedR += sampleVal; // Right
                }
            }
            
            let filteredL = this.staticL.process(mixedL);
            let filteredR = this.staticR.process(mixedR);

            if (this.ledFilterOn) {
                filteredL = this.ledL.process(filteredL);
                filteredR = this.ledR.process(filteredR);
            }

            outL[i] = filteredL / 2.0;
            if (outR) outR[i] = filteredR / 2.0; else outL[i] += filteredR / 2.0; 
            if (i === 0) oscValue = (filteredL + filteredR) / 2.0;
        }

        this.visCounter = (this.visCounter || 0) + 1;
        if (this.visCounter % 4 === 0) {
            let isAudible = Math.abs(oscValue) > 0.001;
            if (isAudible || this.wasAudible) {
                let fakeRegs = new Uint8Array(28); 
                // Wir senden nur die ersten 4 Kanäle an das UI-HUD, damit es authentisch bleibt!
                for(let c = 0; c < 4; c++) {
                    let offset = c * 7;
                    let ch = this.channels[c];
                    
                    let simulatedAddress = ch.data ? 0x00020000 + c * 0x4000 + Math.floor(ch.pointer) : 0;
                    fakeRegs[offset] = (simulatedAddress >> 8) & 0xFF; 
                    fakeRegs[offset+1] = simulatedAddress & 0xFF;       
                    
                    let len = ch.data ? Math.floor(ch.data.length / 2) : 0;
                    fakeRegs[offset+2] = (len >> 8) & 0xFF;
                    fakeRegs[offset+3] = len & 0xFF;
                    
                    fakeRegs[offset+4] = (ch.per >> 8) & 0xFF;
                    fakeRegs[offset+5] = ch.per & 0xFF;
                    
                    fakeRegs[offset+6] = Math.round(ch.vol) & 0xFF;
                }
                this.port.postMessage({ type: 'VISUAL_DATA', value: oscValue, frame: this.currentFrame, regs: fakeRegs });
            }
            this.wasAudible = isAudible;
        }
        return true;
    }
}

registerProcessor('paula-processor', PaulaProcessor);