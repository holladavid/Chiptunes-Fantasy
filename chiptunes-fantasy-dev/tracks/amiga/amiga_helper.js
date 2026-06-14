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