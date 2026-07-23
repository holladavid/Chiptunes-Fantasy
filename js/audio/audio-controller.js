// === js/audio/audio-controller.js ===
// =========================================================
// CENTRAL WEB AUDIO ENGINE & WORKLET CONTROLLER
// Pure ES6 Module - Cleaned up and Optimized
// Updated with Transparent Brickwall Peak Limiter (Zero Pumping)
// =========================================================

let audioCtx = null;
let ymNode = null;
let paulaNode = null;
let sidNode = null;
let masterGain = null;
let analyserNode = null;
let amigaFilter = null;
let masterLimiter = null; 

export function getAudioContext() { return audioCtx; }
export function getAnalyserNode() { return analyserNode; }
export function getMasterGain() { return masterGain; }
export function getYmNode() { return ymNode; }
export function getPaulaNode() { return paulaNode; }
export function getSidNode() { return sidNode; }

export async function initAudioEngine() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    try {
        amigaFilter = audioCtx.createBiquadFilter();
        amigaFilter.type = 'lowpass';
        amigaFilter.frequency.value = 6000; 

        analyserNode = audioCtx.createAnalyser();
        analyserNode.fftSize = 4096; 

        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.5; 
        
        // =========================================================
        // DSP UPGRADE: TRANSPARENT BRICKWALL LIMITER (Zero Pumping)
        // Ersetzt träge Kompressor-Attributwerte durch ultra-schnellen Peak-Schutz.
        // =========================================================
        masterLimiter = audioCtx.createDynamicsCompressor();
        masterLimiter.threshold.value = -0.5; // Greift erst knapp unter Vollanschlag
        masterLimiter.knee.value = 0.0;       // Harte Kante für sofortigen Peak-Schutz
        masterLimiter.ratio.value = 20.0;     // Hohe Ratio verhindert Digital-Clipping
        masterLimiter.attack.value = 0.0005;  // Ultra-schnelle 0.5ms (Keine lauten Transienten-Ausbrüche)
        masterLimiter.release.value = 0.02;   // Fast 20ms Erholung (Eliminiert Lautstärke-Pumpen vollständig!)
        
        masterGain.connect(masterLimiter);
        masterLimiter.connect(analyserNode);
        analyserNode.connect(audioCtx.destination);
    } catch (e) {
        console.error("[AUDIO ENGINE] Initialisierung fehlgeschlagen:", e);
        throw e;
    }
}

export async function loadEmuCore(system, coreConfig, onMessageCallback) {
    if (!audioCtx) return;

    try {
        await audioCtx.audioWorklet.addModule(coreConfig.file, { type: 'module' });
        
        if (system === 'atari' && ymNode) { ymNode.disconnect(); ymNode = null; }
        if (system === 'c64' && sidNode) { sidNode.disconnect(); sidNode = null; }
        if (system === 'amiga' && paulaNode) { paulaNode.disconnect(); paulaNode = null; }

        const newNode = new AudioWorkletNode(audioCtx, coreConfig.processor);
        
        if (system === 'amiga') {
            newNode.connect(amigaFilter).connect(masterGain);
        } else {
            newNode.connect(masterGain);
        }

        newNode.port.onmessage = onMessageCallback;

        if (system === 'atari') ymNode = newNode;
        if (system === 'c64') sidNode = newNode;
        if (system === 'amiga') paulaNode = newNode;

        console.log(`[AUDIO ENGINE] Soundprozessor erfolgreich getauscht: ${system.toUpperCase()} -> ${coreConfig.name}`);
    } catch (e) {
        console.error(`[AUDIO ENGINE] Fehler beim Einhängen des Cores ${coreConfig.name}:`, e);
        throw e;
    }
}

export async function resumeAudioContext() {
    if (audioCtx && audioCtx.state === 'suspended') {
        await audioCtx.resume();
    }
}