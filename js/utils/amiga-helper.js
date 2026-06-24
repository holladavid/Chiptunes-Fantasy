export function createKickSample() {
    let len = 4000; let data = new Float32Array(len); let phase = 0;
    for(let i=0; i<len; i++) {
        phase += ((150 * Math.exp(-i / 800)) * Math.PI * 2) / 8287; 
        data[i] = Math.sin(phase) * Math.exp(-i / 1000); 
    }
    return data;
}
export function createBassSample() {
    let len = 64; let data = new Float32Array(len);
    for(let i=0; i<len; i++) data[i] = 2.0 * (i / len) - 1.0; 
    return data;
}
export function createChordSample() {
    let len = 8000; let data = new Float32Array(len); let w = (261.63 * Math.PI * 2) / 8287; 
    for(let i=0; i<len; i++) data[i] = ((Math.sin(i * w) + Math.sin(i * w * 1.189) + Math.sin(i * w * 1.498)) / 3.0) * Math.exp(-i / 3000);
    return data;
}

// NEU: Synthetische Amiga-Snare (Weißes Rauschen mit exponentiellem Abklingen)
export function createSnareSample() {
    let len = 6000; let data = new Float32Array(len);
    for(let i=0; i<len; i++) {
        let noise = Math.random() * 2.0 - 1.0;
        let env = Math.exp(-i / 1500);
        data[i] = noise * env * 0.7;
    }
    return data;
}

// NEU: Synthetischer Amiga-Lead-Oszillator (Rechteck-Sägezahn-Hybrid)
export function createLeadSample() {
    let len = 4000; let data = new Float32Array(len);
    for(let i=0; i<len; i++) {
        let env = Math.exp(-i / 2000);
        let val = (i % 64 < 32) ? 1.0 : -1.0;
        data[i] = val * env * 0.5;
    }
    return data;
}