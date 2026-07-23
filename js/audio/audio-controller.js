// === js/audio/audio-controller.js ===
// =========================================================
// CENTRAL WEB AUDIO ENGINE & WORKLET CONTROLLER
// 3-Channel Hardware Mixing Desk Stage with Calibrated Headroom
// =========================================================

let audioCtx = null;
let ymNode = null;
let paulaNode = null;
let sidNode = null;

// Individual System Gain Nodes for Perfect Balance
let sidGain = null;
let paulaGain = null;
let ymGain = null;

let masterGain = null;
let analyserNode = null;

export function getAudioContext() { return audioCtx; }
export function getAnalyserNode() { return analyserNode; }
export function getMasterGain() { return masterGain; }
export function getYmNode() { return ymNode; }
export function getPaulaNode() { return paulaNode; }
export function getSidNode() { return sidNode; }

export async function initAudioEngine() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    try {
        analyserNode = audioCtx.createAnalyser();
        analyserNode.fftSize = 4096; 

        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.70; // 0.70 (-3dB Headroom) prevents clipping without dynamic ducking

        // Dedicated Channel Gains for Hard-Mixing
        sidGain = audioCtx.createGain();
        sidGain.gain.value = 0.85; // SID 6581 Headroom

        paulaGain = audioCtx.createGain();
        paulaGain.gain.value = 0.75; // Paula 8364 4-Channel Mix

        ymGain = audioCtx.createGain();
        ymGain.gain.value = 0.80; // YM2149 3-Channel Mix

        // Connect Channel Bus -> Master Bus -> Analyser -> Speakers
        sidGain.connect(masterGain);
        paulaGain.connect(masterGain);
        ymGain.connect(masterGain);

        masterGain.connect(analyserNode);
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
        
        // Clean System Channel Routing without duplicate filtering or compressor ducking
        if (system === 'c64') {
            newNode.connect(sidGain);
            sidNode = newNode;
        } else if (system === 'amiga') {
            newNode.connect(paulaGain);
            paulaNode = newNode;
        } else if (system === 'atari') {
            newNode.connect(ymGain);
            ymNode = newNode;
        }

        newNode.port.onmessage = onMessageCallback;

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