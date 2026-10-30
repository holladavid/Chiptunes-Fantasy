import { dseRegistry } from '../../js/visuals/dse/registry.js';
import { C64_PALETTE, SYSTEM_RESOLUTIONS } from '../../js/visuals/utils/hardware-constraints.js';

const SYSTEMS = ['c64', 'amiga', 'atari'];
const STATES = ['playing', 'buildup', 'climax'];
const VIEWPORTS = {
    portrait: { width: 390, height: 844 },
    landscape: { width: 844, height: 390 }
};
const FPS = 18;
const instanceIds = new WeakMap();
let nextInstanceId = 1;
let randomState = 0x5eed1234;

function seededRandom() {
    randomState |= 0;
    randomState = (randomState + 0x6D2B79F5) | 0;
    let value = randomState;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

Math.random = seededRandom;

function instanceId(dse) {
    if (!instanceIds.has(dse)) instanceIds.set(dse, nextInstanceId++);
    return instanceIds.get(dse);
}

export function inventory() {
    const combinations = [];
    for (const entry of dseRegistry) {
        const meta = entry.metadata;
        if (meta.lifecycle !== 'managed' || meta.isDisabled || meta.isVoid) continue;
        for (const system of SYSTEMS) {
            if (!meta.systems.includes('all') && !meta.systems.includes(system)) continue;
            combinations.push({
                id: `${system}-${entry.Class.name}`,
                dse: entry.Class.name,
                displayName: meta.name,
                system,
                layer: meta.layer,
                duration: meta.duration,
                climaxHold: meta.climaxHold
            });
        }
    }
    return combinations;
}

function bufferSize(system, orientation) {
    const viewport = VIEWPORTS[orientation];
    const height = SYSTEM_RESOLUTIONS[system] || 200;
    return {
        width: Math.max(8, Math.floor(height * viewport.width / viewport.height)),
        height,
        viewport: { ...viewport }
    };
}

function makeMetrics(system, state, frame, beatMode = 'pattern') {
    const phase = frame % 9;
    const stateGain = state === 'climax' ? 1 : state === 'buildup' ? 0.72 : 0.48;
    const patternedBeat = phase === 0 ? 1 : Math.max(0, 0.82 - phase * 0.19);
    const beat = beatMode === 'zero' ? 0 : beatMode === 'one' ? 1 : patternedBeat * stateGain;
    const energy = Math.min(1, (0.32 + 0.18 * Math.sin(frame * 0.17) + stateGain * 0.42));
    const regs = new Uint8Array(32);
    for (let i = 0; i < regs.length; i++) regs[i] = (i * 37 + frame * 11 + (i % 5) * 19) & 255;
    if (system === 'atari') {
        regs[8] = Math.round(15 * energy);
        regs[9] = Math.round(15 * Math.max(0, energy - 0.12));
        regs[10] = Math.round(15 * beat);
    }
    return {
        energy,
        pulse: beat,
        beat: [beat, beat * 0.72, beat * 0.45, beat * 0.3],
        smooth: [
            energy,
            Math.max(0, energy - 0.13),
            Math.max(0, energy - 0.25),
            Math.max(0, energy - 0.34)
        ],
        rawEnergyState: state,
        system,
        tensionPct: state === 'climax' ? 0.94 : state === 'buildup' ? 0.68 : 0.38,
        isClimaxLocked: state === 'climax',
        climaxTimer: state === 'climax' ? frame / FPS : 0,
        climaxHoldTime: 12,
        regs
    };
}

const COUNTED_METHODS = [
    'fillRect', 'strokeRect', 'clearRect', 'fillText', 'strokeText', 'drawImage',
    'beginPath', 'closePath', 'moveTo', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo',
    'arc', 'arcTo', 'ellipse', 'rect', 'fill', 'stroke', 'clip',
    'createLinearGradient', 'createRadialGradient', 'createPattern',
    'getImageData', 'putImageData', 'save', 'restore', 'translate', 'rotate', 'scale'
];

function instrumentContext(ctx) {
    const counts = Object.create(null);
    for (const name of COUNTED_METHODS) {
        counts[name] = 0;
        const original = ctx[name];
        if (typeof original !== 'function') continue;
        ctx[name] = function (...args) {
            counts[name]++;
            return original.apply(this, args);
        };
    }
    return {
        counts,
        reset() { for (const name of COUNTED_METHODS) counts[name] = 0; },
        snapshot() {
            const result = {};
            for (const name of COUNTED_METHODS) {
                if (counts[name]) result[name] = counts[name];
            }
            result.imageSmoothingEnabled = ctx.imageSmoothingEnabled;
            result.globalAlpha = ctx.globalAlpha;
            result.globalCompositeOperation = ctx.globalCompositeOperation;
            return result;
        }
    };
}

function createTarget(system, orientation) {
    const size = bufferSize(system, orientation);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    return { canvas, ctx, monitor: instrumentContext(ctx), size };
}

function resizeTarget(target, system, orientation, dse) {
    const size = bufferSize(system, orientation);
    if (target.canvas.width !== size.width || target.canvas.height !== size.height) {
        target.canvas.width = size.width;
        target.canvas.height = size.height;
        target.ctx.imageSmoothingEnabled = false;
    }
    // SceneDJ.resize() receives CSS-pixel viewport dimensions, not retro-buffer dimensions.
    if (typeof dse.resize === 'function') dse.resize(size.viewport.width, size.viewport.height);
    target.size = size;
}

function hashPixels(data) {
    let hash = 2166136261;
    for (let i = 0; i < data.length; i += 4) {
        hash ^= data[i]; hash = Math.imul(hash, 16777619);
        hash ^= data[i + 1]; hash = Math.imul(hash, 16777619);
        hash ^= data[i + 2]; hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

function paletteMember(system, r, g, b) {
    if (system === 'c64') {
        return C64_PALETTE.some(color => color[0] === r && color[1] === g && color[2] === b);
    }
    if (system === 'amiga') return r % 17 === 0 && g % 17 === 0 && b % 17 === 0;
    const valid = value => value % 36 === 0 && value >= 0 && value <= 252;
    return valid(r) && valid(g) && valid(b);
}

function analyzePixels(target, system, previous = null) {
    const { width, height } = target.canvas;
    const pixels = target.ctx.getImageData(0, 0, width, height).data;
    const colors = new Set();
    const invalidColors = new Set();
    let invalidPixels = 0;
    let nonBlackPixels = 0;
    let changedPixels = 0;
    let absoluteDifference = 0;
    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
        const key = (r << 16) | (g << 8) | b;
        colors.add(key);
        if (r || g || b) nonBlackPixels++;
        if (!paletteMember(system, r, g, b)) {
            invalidColors.add(key);
            invalidPixels++;
        }
        if (previous) {
            if (r !== previous[i] || g !== previous[i + 1] || b !== previous[i + 2]) changedPixels++;
            absoluteDifference += Math.abs(r - previous[i]) + Math.abs(g - previous[i + 1]) + Math.abs(b - previous[i + 2]);
        }
    }
    const count = width * height;
    return {
        hash: hashPixels(pixels),
        uniqueColors: colors.size,
        paletteViolationColors: invalidColors.size,
        paletteViolationPixelRatio: invalidPixels / count,
        nonBlackPixelRatio: nonBlackPixels / count,
        changedPixelRatio: previous ? changedPixels / count : null,
        meanAbsoluteRgbDifference: previous ? absoluteDifference / (count * 3) : null,
        pixels: new Uint8ClampedArray(pixels)
    };
}

function createDSE(dseName, seed) {
    randomState = seed | 0;
    const entry = dseRegistry.find(item => item.Class.name === dseName);
    if (!entry) throw new Error(`Unbekanntes DSE: ${dseName}`);
    const dse = new entry.Class();
    return { dse, id: instanceId(dse), metadata: entry.metadata };
}

function summarizeProfile(profile) {
    const sorted = [...profile.frameMs].sort((a, b) => a - b);
    const sum = profile.frameMs.reduce((total, value) => total + value, 0);
    const operationTotals = {};
    let smoothingTrueFrames = 0;
    for (const operations of profile.operations) {
        if (operations.imageSmoothingEnabled === true) smoothingTrueFrames++;
        for (const [key, value] of Object.entries(operations)) {
            if (typeof value !== 'number') continue;
            operationTotals[key] = (operationTotals[key] || 0) + value;
        }
    }
    const operationAverages = {};
    for (const [key, value] of Object.entries(operationTotals)) {
        operationAverages[key] = value / Math.max(1, profile.frameMs.length);
    }
    return {
        frames: profile.frameMs.length,
        meanFrameMs: profile.frameMs.length ? sum / profile.frameMs.length : 0,
        p95FrameMs: sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : 0,
        maxFrameMs: sorted.length ? sorted[sorted.length - 1] : 0,
        smoothingTrueFrames,
        meanOperations: operationAverages
    };
}

function renderFrame(target, dse, meta, frame, state, beatMode, profile, errors) {
    target.ctx.fillStyle = '#000000';
    target.ctx.fillRect(0, 0, target.canvas.width, target.canvas.height);
    target.monitor.reset();
    const t = 1 + frame / FPS;
    const stateTime = 3 + frame / FPS;
    const started = performance.now();
    try {
        dse.render(target.ctx, target.canvas.width, target.canvas.height, t, state, stateTime,
            makeMetrics(meta.system, state, frame, beatMode));
    } catch (error) {
        errors.push({ frame, message: String(error && error.stack || error) });
    }
    profile.frameMs.push(performance.now() - started);
    profile.operations.push(target.monitor.snapshot());
    return analyzePixels(target, meta.system);
}

function publicAnalysis(analysis) {
    if (!analysis) return null;
    const { pixels, ...publicData } = analysis;
    return publicData;
}

export function runStill(request) {
    const { dse, system, state, orientation, seed = 0x5eed1234, warmup = 8 } = request;
    const meta = { dse, system, state, orientation };
    const errors = [];
    const profile = { frameMs: [], operations: [] };
    const created = createDSE(dse, seed);
    const target = createTarget(system, orientation);
    let analysis = null;
    for (let frame = 0; frame <= warmup; frame++) {
        analysis = renderFrame(target, created.dse, meta, frame, state, 'pattern', profile, errors);
    }
    return {
        kind: 'still', ...meta, instanceId: created.id, buffer: target.size,
        errors, profile: summarizeProfile(profile), color: publicAnalysis(analysis),
        png: target.canvas.toDataURL('image/png')
    };
}

export function runMotion(request) {
    const { dse, system, state = 'playing', orientation, seed = 0x5eed1234, warmup = 4, frames = 36 } = request;
    const meta = { dse, system, state, orientation };
    const errors = [];
    const profile = { frameMs: [], operations: [] };
    const created = createDSE(dse, seed);
    const target = createTarget(system, orientation);
    for (let frame = 0; frame < warmup; frame++) {
        renderFrame(target, created.dse, meta, frame, state, 'pattern', profile, errors);
    }
    const images = [];
    const analyses = [];
    let previous = null;
    for (let frame = warmup; frame < warmup + frames; frame++) {
        let current = renderFrame(target, created.dse, meta, frame, state, 'pattern', profile, errors);
        if (previous) {
            current = analyzeWithPrevious(target, system, previous);
        }
        analyses.push(publicAnalysis(current));
        images.push(target.canvas.toDataURL('image/png'));
        previous = current.pixels;
    }
    const motionFrames = analyses.filter(item => item.changedPixelRatio !== null);
    return {
        kind: 'motion', ...meta, instanceId: created.id, buffer: target.size, fps: FPS,
        errors, profile: summarizeProfile(profile),
        color: {
            maxUniqueColors: Math.max(...analyses.map(item => item.uniqueColors)),
            maxPaletteViolationColors: Math.max(...analyses.map(item => item.paletteViolationColors)),
            maxPaletteViolationPixelRatio: Math.max(...analyses.map(item => item.paletteViolationPixelRatio))
        },
        motion: {
            frames: analyses.length,
            meanChangedPixelRatio: motionFrames.reduce((sum, item) => sum + item.changedPixelRatio, 0) / Math.max(1, motionFrames.length),
            meanAbsoluteRgbDifference: motionFrames.reduce((sum, item) => sum + item.meanAbsoluteRgbDifference, 0) / Math.max(1, motionFrames.length),
            identicalConsecutiveFrames: motionFrames.filter(item => item.changedPixelRatio === 0).length
        },
        frames: analyses,
        images
    };
}

function analyzeWithPrevious(target, system, previous) {
    return analyzePixels(target, system, previous);
}

function diagnosticSequence(dse, system, state, orientation, seed, beatMode) {
    const meta = { dse, system, state, orientation };
    const errors = [];
    const profile = { frameMs: [], operations: [] };
    const created = createDSE(dse, seed);
    const target = createTarget(system, orientation);
    let analysis = null;
    for (let frame = 0; frame <= 8; frame++) {
        analysis = renderFrame(target, created.dse, meta, frame, state, beatMode, profile, errors);
    }
    return { analysis, errors, instanceId: created.id };
}

export function runDiagnostics(request) {
    const { dse, system, state = 'playing', orientation, seed = 0x5eed1234 } = request;
    const first = diagnosticSequence(dse, system, state, orientation, seed, 'pattern');
    const second = diagnosticSequence(dse, system, state, orientation, seed, 'pattern');
    const noBeat = diagnosticSequence(dse, system, state, orientation, seed, 'zero');
    const fullBeat = diagnosticSequence(dse, system, state, orientation, seed, 'one');
    const target = createTarget(system, orientation);
    const noBeatPixels = noBeat.analysis.pixels;
    target.ctx.putImageData(new ImageData(fullBeat.analysis.pixels, target.canvas.width, target.canvas.height), 0, 0);
    const beatComparison = analyzePixels(target, system, noBeatPixels);
    return {
        kind: 'diagnostics', dse, system, state, orientation,
        determinism: {
            pass: first.analysis.hash === second.analysis.hash && first.errors.length === 0 && second.errors.length === 0,
            firstHash: first.analysis.hash,
            secondHash: second.analysis.hash
        },
        beatResponse: {
            changed: noBeat.analysis.hash !== fullBeat.analysis.hash,
            changedPixelRatio: beatComparison.changedPixelRatio,
            meanAbsoluteRgbDifference: beatComparison.meanAbsoluteRgbDifference,
            noBeatHash: noBeat.analysis.hash,
            fullBeatHash: fullBeat.analysis.hash
        },
        errors: [...first.errors, ...second.errors, ...noBeat.errors, ...fullBeat.errors]
    };
}

export function runRotation(request) {
    const { dse, system, state = 'playing', seed = 0x5eed1234, phaseFrames = 10 } = request;
    const created = createDSE(dse, seed);
    const target = createTarget(system, 'portrait');
    const errors = [];
    const profile = { frameMs: [], operations: [] };
    const phases = [];
    const orientations = ['portrait', 'landscape', 'portrait'];
    let globalFrame = 0;
    for (let phaseIndex = 0; phaseIndex < orientations.length; phaseIndex++) {
        const orientation = orientations[phaseIndex];
        if (phaseIndex > 0) resizeTarget(target, system, orientation, created.dse);
        const meta = { dse, system, state, orientation };
        let analysis = null;
        for (let frame = 0; frame < phaseFrames; frame++, globalFrame++) {
            analysis = renderFrame(target, created.dse, meta, globalFrame, state, 'pattern', profile, errors);
        }
        phases.push({
            phase: ['before', 'landscape', 'after'][phaseIndex],
            orientation,
            instanceId: created.id,
            buffer: { ...target.size },
            color: publicAnalysis(analysis),
            png: target.canvas.toDataURL('image/png')
        });
    }
    return {
        kind: 'rotation', dse, system, state, instanceId: created.id,
        sameInstance: phases.every(phase => phase.instanceId === created.id),
        errors, profile: summarizeProfile(profile), phases
    };
}

window.DSEBaseline = { inventory, runStill, runMotion, runDiagnostics, runRotation, SYSTEMS, STATES, VIEWPORTS };
window.dispatchEvent(new Event('dse-baseline-ready'));
