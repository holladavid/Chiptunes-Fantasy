// === js/visuals/dj/stage-manager.js ===
import { getBeatLevel } from './track-monitor.js';

const TRANSITION_TIME = 1.5;
const PAL_FRAME_RATE = 50;
const MAX_DT = 0.1;
const Z_ORDER = { 'background': 0, 'floor': 1, 'foreground': 2, 'overlay': 3 };

function sanitizeDt(dt) {
    return Number.isFinite(dt) && dt > 0.0 ? Math.min(dt, MAX_DT) : 0.0;
}

export class StageManager {
    constructor(options = {}) {
        this.activeDSEs = [];
        this.frameCaches = new WeakMap();
        this.createCanvas = typeof options.createCanvas === 'function'
            ? options.createCanvas
            : () => document.createElement('canvas');
        // Einmaliger Puffer fuer alte Metriken ohne beatImpulse. Der Renderloop
        // erzeugt dadurch auch im Kompatibilitaetsfall keine neuen Arrays.
        this.legacyBeatImpulse = new Float32Array(1);
        // Einmalige Puffer fuer Beats, die auf einem gecachten PAL-Tick lagen
        // (z.B. 60/120/144 Hz) und am naechsten PAL-Tick nachgeliefert werden.
        this.latchedBeatEnvelope = new Float32Array(1);
        this.latchedBeatImpulse = new Float32Array(1);
        this.latchedPulse = new Float32Array(1);
    }

    clearPendingBeat(dse) {
        const cache = this.frameCaches.get(dse);
        if (cache) cache.hasPendingBeat = false;
    }

    invalidateCache(dse) {
        const cache = this.frameCaches.get(dse);
        if (cache) {
            cache.tick = null;
            cache.hasPendingBeat = false;
        }
    }

    sortZOrder() {
        this.activeDSEs.sort((a, b) => Z_ORDER[a.metadata.layer] - Z_ORDER[b.metadata.layer]);
    }

    getMaxClimaxHoldTime() {
        let maxHold = 0.0;
        let hasCandidate = false;
        for (let i = 0; i < this.activeDSEs.length; i++) {
            const dse = this.activeDSEs[i];
            const meta = dse && dse.metadata;
            if (!meta) continue;
            if (dse._markedForRemoval || dse.state === 'idle' || dse.state === 'stopping') continue;
            if (meta.isVoid || meta.lifecycle === 'oneshot' || meta.lifecycle === 'permanent') continue;
            if (Number.isFinite(meta.climaxHold) && meta.climaxHold > 0.0) {
                maxHold = Math.max(maxHold, meta.climaxHold);
                hasCandidate = true;
            }
        }
        return hasCandidate ? maxHold : 10.0;
    }

    clearNonPermanentDSEs() {
        for (let i = this.activeDSEs.length - 1; i >= 0; i--) {
            const dse = this.activeDSEs[i];
            const lifecycle = dse.metadata ? dse.metadata.lifecycle : 'managed';
            if (lifecycle === 'managed' || (lifecycle === 'oneshot' && (dse.state === 'idle' || dse.state === 'stopping'))) {
                dse.state = 'idle';
                dse.stateTime = 0.0;
                dse._markedForRemoval = false;
                this.clearPendingBeat(dse);
                this.activeDSEs.splice(i, 1);
            }
        }
    }

    updateCrossfades(macroState, dt) {
        const safeDt = sanitizeDt(dt);

        for (let i = this.activeDSEs.length - 1; i >= 0; i--) {
            const dse = this.activeDSEs[i];
            const meta = dse.metadata || {};

            // --- DIAGNOSTISCHER DIAG-HARD-KILL (Debugging) ---
            if (meta.isDisabled) {
                dse.state = 'idle';
                dse.stateTime = 0.0;
                dse._markedForRemoval = false;
                this.clearPendingBeat(dse);
                this.activeDSEs.splice(i, 1);
                continue;
            }

            dse.stateTime += safeDt;

            const isOneshot = meta.lifecycle === 'oneshot';
            const transitionTime = isOneshot ? 1.0 : TRANSITION_TIME;
            const isActiveOnstage = dse.state !== 'idle' && dse.state !== 'starting' && dse.state !== 'stopping';

            if (isOneshot && !dse._markedForRemoval && macroState !== 'idle' && isActiveOnstage) {
                if (dse.stateTime >= meta.duration) {
                    dse._markedForRemoval = true;
                }
            }

            if (dse._markedForRemoval) {
                if (dse.state !== 'stopping') {
                    dse.state = 'stopping';
                    dse.stateTime = 0.0;
                } else if (dse.stateTime >= transitionTime) {
                    dse.state = 'idle';
                    dse.stateTime = 0.0;
                    dse._markedForRemoval = false;
                    this.clearPendingBeat(dse);
                    this.activeDSEs.splice(i, 1);
                }
                continue;
            }

            if (macroState === 'idle') {
                if (dse.state !== 'idle' && dse.state !== 'stopping') {
                    dse.state = 'stopping';
                    dse.stateTime = 0.0;
                } else if (dse.state === 'stopping' && dse.stateTime >= transitionTime) {
                    dse.state = 'idle';
                    dse.stateTime = 0.0;
                    this.clearPendingBeat(dse);
                    if (isOneshot) {
                        this.activeDSEs.splice(i, 1);
                    }
                } else if (dse.state === 'idle' && isOneshot) {
                    this.clearPendingBeat(dse);
                    this.activeDSEs.splice(i, 1);
                }
            } else {
                if (dse.state === 'idle' || dse.state === 'stopping') {
                    dse.state = 'starting';
                    dse.stateTime = dse.state === 'stopping' ? Math.max(0.0, transitionTime - dse.stateTime) : 0.0;
                } else if (dse.state === 'starting' && dse.stateTime >= transitionTime) {
                    dse.state = macroState;
                    dse.stateTime = 0.0;
                } else if (dse.state === 'playing' || dse.state === 'buildup' || dse.state === 'climax' || dse.state === 'afterglow') {
                    if (dse.state !== macroState) {
                        dse.state = macroState;
                    }
                }
            }
        }
    }

    renderAll(ctx, width, height, t, dynamics, info, metricsWrapper) {
        if (width <= 0 || height <= 0 || !Number.isFinite(width / height) || !Number.isFinite(t)) {
            return;
        }

        const system = info ? info.system : undefined;
        const liveBeatStarted = Boolean(dynamics.beatStarted);
        const liveBeatCount = dynamics.beatCount;

        metricsWrapper.energy = dynamics.masterEnergy;
        metricsWrapper.pulse = dynamics.transientPulse;
        metricsWrapper.beat = dynamics.beatEnvelope;
        metricsWrapper.beatStarted = liveBeatStarted;
        metricsWrapper.beatCount = liveBeatCount;

        const envelope = dynamics.beatEnvelope && Number.isFinite(dynamics.beatEnvelope[0])
            ? Math.max(0.0, Math.min(1.0, dynamics.beatEnvelope[0]))
            : 0.0;
        const strength = Number.isFinite(dynamics.beatStrength)
            ? Math.max(0.0, Math.min(1.0, dynamics.beatStrength))
            : (envelope > 0.0 || liveBeatStarted ? 1.0 : 0.0);
        const beatLevel = Number.isInteger(dynamics.beatLevel)
            && dynamics.beatLevel >= 0 && dynamics.beatLevel <= 3
            ? dynamics.beatLevel
            : getBeatLevel(strength);

        metricsWrapper.beatStrength = strength;
        metricsWrapper.beatLevel = beatLevel;

        let liveBeatImpulse;
        if (dynamics.beatImpulse && Number.isFinite(dynamics.beatImpulse[0])) {
            liveBeatImpulse = dynamics.beatImpulse;
        } else {
            this.legacyBeatImpulse[0] = envelope * strength;
            liveBeatImpulse = this.legacyBeatImpulse;
        }
        metricsWrapper.beatImpulse = liveBeatImpulse;

        const liveImpulseValue = Number.isFinite(liveBeatImpulse[0])
            ? Math.max(0.0, Math.min(1.0, liveBeatImpulse[0]))
            : 0.0;
        const livePulseValue = dynamics.transientPulse && Number.isFinite(dynamics.transientPulse[0])
            ? Math.max(0.0, Math.min(1.0, dynamics.transientPulse[0]))
            : 0.0;

        metricsWrapper.smooth = dynamics.channelSmooth;
        metricsWrapper.rawEnergyState = dynamics.rawEnergyState;
        metricsWrapper.system = system;

        const palTick = Math.floor(t * PAL_FRAME_RATE + 1e-7);
        for (let i = 0; i < this.activeDSEs.length; i++) {
            const dse = this.activeDSEs[i];
            if (dse.state === 'idle') {
                const existingCache = this.frameCaches.get(dse);
                if (existingCache) {
                    existingCache.hasPendingBeat = false;
                    existingCache.state = 'idle';
                }
                continue;
            }

            let cache = this.frameCaches.get(dse);
            if (!cache) {
                const canvas = this.createCanvas();
                cache = {
                    canvas,
                    ctx: canvas.getContext('2d'),
                    tick: null,
                    state: null,
                    system: null
                };
                this.frameCaches.set(dse, cache);
            }

            if (cache.canvas.width !== width || cache.canvas.height !== height) {
                cache.canvas.width = width;
                cache.canvas.height = height;
                cache.tick = null;
            }

            const restartedStarting = dse.state === 'starting'
                && Number.isFinite(dse.stateTime)
                && Number.isFinite(cache.lastStateTime)
                && dse.stateTime < cache.lastStateTime;

            const needsRender = restartedStarting
                || cache.tick !== palTick
                || cache.state !== dse.state
                || cache.system !== system;

            if (needsRender) {
                const useLatchedBeat = !liveBeatStarted && Boolean(cache.hasPendingBeat);
                if (useLatchedBeat) {
                    this.latchedBeatEnvelope[0] = Math.max(envelope, cache.pendingBeatEnvelope);
                    this.latchedBeatImpulse[0] = Math.max(liveImpulseValue, cache.pendingBeatImpulse);
                    this.latchedPulse[0] = Math.max(livePulseValue, cache.pendingPulse);

                    metricsWrapper.beatStarted = true;
                    metricsWrapper.beatCount = cache.pendingBeatCount;
                    metricsWrapper.beatStrength = cache.pendingBeatStrength;
                    metricsWrapper.beatLevel = cache.pendingBeatLevel;
                    metricsWrapper.beat = this.latchedBeatEnvelope;
                    metricsWrapper.beatImpulse = this.latchedBeatImpulse;
                    metricsWrapper.pulse = this.latchedPulse;
                }

                cache.hasPendingBeat = false;

                cache.ctx.clearRect(0, 0, width, height);
                cache.ctx.globalAlpha = 1.0;
                cache.ctx.imageSmoothingEnabled = false;
                dse.render(cache.ctx, width, height, t, dse.state, dse.stateTime, metricsWrapper);

                if (useLatchedBeat) {
                    metricsWrapper.beatStarted = liveBeatStarted;
                    metricsWrapper.beatCount = liveBeatCount;
                    metricsWrapper.beatStrength = strength;
                    metricsWrapper.beatLevel = beatLevel;
                    metricsWrapper.beat = dynamics.beatEnvelope;
                    metricsWrapper.beatImpulse = liveBeatImpulse;
                    metricsWrapper.pulse = dynamics.transientPulse;
                }

                cache.tick = palTick;
                cache.state = dse.state;
                cache.system = system;
                cache.lastStateTime = dse.stateTime;
            } else if (liveBeatStarted) {
                cache.hasPendingBeat = true;
                cache.pendingBeatCount = Number.isFinite(liveBeatCount) ? liveBeatCount : 0;
                cache.pendingBeatStrength = strength;
                cache.pendingBeatLevel = beatLevel;
                cache.pendingBeatEnvelope = envelope;
                cache.pendingBeatImpulse = liveImpulseValue;
                cache.pendingPulse = livePulseValue;
            }

            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(cache.canvas, 0, 0);
        }
    }
}