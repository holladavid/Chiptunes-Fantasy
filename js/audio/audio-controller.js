// === js/audio/audio-controller.js ===
// =========================================================
// CENTRAL WEB AUDIO ENGINE & WORKLET CONTROLLER
// 3-Channel Hardware Mixing Desk Stage with Calibrated Headroom
// & Master DSP AudioWorklet (Bauer Crossfeed + Lookahead Limiter)
// =========================================================

const VALID_SYSTEMS = new Set(['atari', 'c64', 'amiga']);

let audioCtx = null;
let ymNode = null;
let paulaNode = null;
let sidNode = null;
let masterDspNode = null;

// Individual System Gain Nodes for Perfect Balance
let sidGain = null;
let paulaGain = null;
let ymGain = null;

let masterGain = null;
let analyserNode = null;
let isCrossfeedActive = false;

const coreLoadTokens = {
    atari: 0,
    c64: 0,
    amiga: 0
};

export function getAudioContext() { return audioCtx; }
export function getAnalyserNode() { return analyserNode; }
export function getMasterGain() { return masterGain; }
export function getYmNode() { return ymNode; }
export function getPaulaNode() { return paulaNode; }
export function getSidNode() { return sidNode; }

export function setMasterCrossfeed(enabled) {
    isCrossfeedActive = !!enabled;
    if (masterDspNode) {
        masterDspNode.port.postMessage({ type: 'SET_CROSSFEED', enabled: isCrossfeedActive });
    }
}

export function getMasterCrossfeed() {
    return isCrossfeedActive;
}

function teardownWorkletNode(node) {
    if (!node) return;
    try {
        node.port?.postMessage({ type: 'STOP_TRACK' });
    } catch {
        // Port may already be closed during teardown.
    }
    try {
        node.disconnect();
    } catch {
        // Already disconnected.
    }
    if (node.port) {
        node.port.onmessage = null;
        if (typeof node.port.close === 'function') {
            node.port.close();
        }
    }
}

async function teardownAudioEngine() {
    teardownWorkletNode(ymNode);
    teardownWorkletNode(paulaNode);
    teardownWorkletNode(sidNode);
    teardownWorkletNode(masterDspNode);

    for (const node of [sidGain, paulaGain, ymGain, masterGain, analyserNode]) {
        if (!node) continue;
        try {
            node.disconnect();
        } catch {
            // Ignore already-disconnected nodes.
        }
    }

    const previousCtx = audioCtx;
    audioCtx = null;
    ymNode = null;
    paulaNode = null;
    sidNode = null;
    masterDspNode = null;
    sidGain = null;
    paulaGain = null;
    ymGain = null;
    masterGain = null;
    analyserNode = null;

    if (previousCtx && previousCtx.state !== 'closed' && typeof previousCtx.close === 'function') {
        try {
            await previousCtx.close();
        } catch {
            // Ignore close errors on already-closing contexts.
        }
    }
}

export async function initAudioEngine(sampleRate) {
    if (sampleRate !== undefined && (!Number.isFinite(sampleRate) || sampleRate <= 0)) {
        throw new RangeError('sampleRate must be a positive finite number');
    }

    await teardownAudioEngine();
    coreLoadTokens.atari++;
    coreLoadTokens.c64++;
    coreLoadTokens.amiga++;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    // Die Produktions-App verwendet weiterhin die Host-Rate. Die optionale
    // Rate ermöglicht reproduzierbare Browserabnahmen bei 44,1/48/96 kHz.
    const nextCtx = sampleRate === undefined
        ? new AudioContextClass()
        : new AudioContextClass({ sampleRate });

    try {
        const nextAnalyser = nextCtx.createAnalyser();
        nextAnalyser.fftSize = 4096;

        const nextMasterGain = nextCtx.createGain();
        nextMasterGain.gain.value = 0.85;

        // Dedicated Channel Gains for Hard-Mixing
        const nextSidGain = nextCtx.createGain();
        nextSidGain.gain.value = 0.90;

        const nextPaulaGain = nextCtx.createGain();
        nextPaulaGain.gain.value = 0.85;

        const nextYmGain = nextCtx.createGain();
        nextYmGain.gain.value = 0.88;

        // Master DSP Worklet laden (explizites Stereo-Bus-Routing erzwingen)
        await nextCtx.audioWorklet.addModule('js/worklets/lib/master-processor.js', { type: 'module' });
        const nextMasterDsp = new AudioWorkletNode(nextCtx, 'master-dsp-processor', {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            channelCount: 2,
            channelCountMode: 'explicit',
            outputChannelCount: [2]
        });

        // Connect Channel Bus -> Master Bus -> Master DSP (Crossfeed + Limiter) -> Analyser -> Speakers
        nextSidGain.connect(nextMasterGain);
        nextPaulaGain.connect(nextMasterGain);
        nextYmGain.connect(nextMasterGain);

        nextMasterGain.connect(nextMasterDsp);
        nextMasterDsp.connect(nextAnalyser);
        nextAnalyser.connect(nextCtx.destination);

        audioCtx = nextCtx;
        analyserNode = nextAnalyser;
        masterGain = nextMasterGain;
        sidGain = nextSidGain;
        paulaGain = nextPaulaGain;
        ymGain = nextYmGain;
        masterDspNode = nextMasterDsp;

        // Vorab gesetzten Crossfeed-Zustand synchronisieren
        masterDspNode.port.postMessage({ type: 'SET_CROSSFEED', enabled: isCrossfeedActive });
    } catch (e) {
        if (nextCtx && nextCtx.state !== 'closed' && typeof nextCtx.close === 'function') {
            try {
                await nextCtx.close();
            } catch {
                // Ignore cleanup failure after init error.
            }
        }
        console.error("[AUDIO ENGINE] Initialisierung fehlgeschlagen:", e);
        throw e;
    }
}

export async function loadEmuCore(system, coreConfig, onMessageCallback) {
    if (!VALID_SYSTEMS.has(system)) {
        throw new RangeError(`Unknown emulation system: ${system}`);
    }
    if (!audioCtx) return;

    const ctx = audioCtx;
    const loadToken = ++coreLoadTokens[system];

    try {
        await ctx.audioWorklet.addModule(coreConfig.file, { type: 'module' });

        // Veralteten Ladevorgang abbrechen, falls zwischenzeitlich neu geladen/re-initialisiert wurde
        if (ctx !== audioCtx || loadToken !== coreLoadTokens[system]) {
            return;
        }

        const newNode = new AudioWorkletNode(ctx, coreConfig.processor, {
            numberOfInputs: 0,
            numberOfOutputs: 1,
            outputChannelCount: [2]
        });

        if (system === 'c64') {
            teardownWorkletNode(sidNode);
            newNode.connect(sidGain);
            sidNode = newNode;
        } else if (system === 'amiga') {
            teardownWorkletNode(paulaNode);
            newNode.connect(paulaGain);
            paulaNode = newNode;
        } else if (system === 'atari') {
            teardownWorkletNode(ymNode);
            newNode.connect(ymGain);
            ymNode = newNode;
        }

        newNode.port.onmessage = typeof onMessageCallback === 'function' ? onMessageCallback : null;

        console.log(`[AUDIO ENGINE] Soundprozessor erfolgreich getauscht: ${system.toUpperCase()} -> ${coreConfig.name}`);
    } catch (e) {
        console.error(`[AUDIO ENGINE] Fehler beim Einhängen des Cores ${coreConfig.name}:`, e);
        throw e;
    }
}

export async function resumeAudioContext() {
    if (audioCtx && (audioCtx.state === 'suspended' || audioCtx.state === 'interrupted')) {
        await audioCtx.resume();
    }
}