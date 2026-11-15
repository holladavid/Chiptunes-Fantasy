// === js/visuals/dj/setlist-manager.js ===
// =========================================================
// SCENE-DJ SKILL: SETLIST MANAGER (Fatigue Edition)
// Flawless Anti-Blackout prevention at source and organic
// Round-Robin weight recovery (Fatigue System).
// Upgraded with Diagnostic Testing constraints (disabled & exclusive)
// =========================================================

const SWAP_BEATLESS_TIMEOUT = 2.0;
const MAX_DT = 0.1;
const OPAQUE_LAYERS = new Set(['background', 'floor']);

function sanitizeDt(dt) {
    return Number.isFinite(dt) && dt > 0.0 ? Math.min(dt, MAX_DT) : 0.0;
}

function getBaseWeight(dse) {
    const w = dse && dse.metadata ? dse.metadata.weight : undefined;
    return Number.isFinite(w) ? w : 10.0;
}

function getMaxInstances(dse) {
    const m = dse && dse.metadata ? dse.metadata.maxInstances : undefined;
    return Number.isFinite(m) ? m : 1;
}

export class SetlistManager {
    constructor() {
        this.registeredDSEs = [];
        this.pendingSwaps = new Map();
        this.queuedTransitions = new Map();
    }

    clearQueuedTransitions() {
        this.queuedTransitions.clear();
    }

    isQueuedIncoming(dse) {
        for (let entry of this.queuedTransitions.values()) {
            if (entry.incoming === dse) return true;
        }
        return false;
    }

    registerDSE(dse) {
        if (this.registeredDSEs.includes(dse)) return;

        dse.state = 'idle';
        dse.stateTime = 0.0;
        dse._markedForRemoval = false;
        dse.currentWeight = getBaseWeight(dse);
        this.registeredDSEs.push(dse);
    }

    applyFatigue(selectedDse) {
        selectedDse.currentWeight = 0.1; // Erschöpfung!

        for (let d of this.registeredDSEs) {
            if (d !== selectedDse && d.metadata.layer === selectedDse.metadata.layer) {
                let baseWeight = getBaseWeight(d);
                d.currentWeight = Math.min(baseWeight, d.currentWeight + (baseWeight * 0.5));
            }
        }
    }

    selectWeightedDSE(candidates) {
        if (candidates.length === 0) return null;
        if (candidates.length === 1) return candidates[0];

        let totalWeight = 0.0;
        for (let c of candidates) totalWeight += c.currentWeight;

        const roll = Math.random() * totalWeight;
        let runningSum = 0.0;
        for (let c of candidates) {
            runningSum += c.currentWeight;
            if (roll <= runningSum) return c;
        }
        return candidates[0];
    }

    fillEmptyLayers(stageManager, info, initialState = 'starting') {
        let layerFilled = { 'background': false, 'floor': false, 'foreground': false, 'overlay': false };
        let activeInstanceCount = {};

        for (let dse of stageManager.activeDSEs) {
            if (!dse._markedForRemoval) {
                layerFilled[dse.metadata.layer] = true;
                activeInstanceCount[dse.metadata.name] = (activeInstanceCount[dse.metadata.name] || 0) + 1;
            }
        }

        for (let [layer, entry] of this.queuedTransitions) {
            if (stageManager.activeDSEs.includes(entry.outgoing)) {
                layerFilled[layer] = true;
                const inc = entry.incoming;
                activeInstanceCount[inc.metadata.name] = (activeInstanceCount[inc.metadata.name] || 0) + 1;
            } else {
                this.queuedTransitions.delete(layer);
            }
        }

        const layers = ['background', 'floor', 'foreground', 'overlay'];

        // --- PRÜFUNG AUF EXKLUSIVES TEST-ELEMENT ---
        const hasExclusive = this.registeredDSEs.some(d =>
            d.metadata.isExclusive &&
            !d.metadata.isDisabled &&
            (d.metadata.systems.includes(info.system) || d.metadata.systems.includes('all'))
        );

        for (let layer of layers) {
            if (!layerFilled[layer]) {

                let visibleCount = stageManager.activeDSEs.filter(d =>
                    !d._markedForRemoval &&
                    d.metadata.lifecycle === 'managed' &&
                    !d.metadata.isVoid
                ).length;

                let candidates = this.registeredDSEs.filter(alt => {
                    // 1. Diagnose-Ausschluss (Hart genullt)
                    if (alt.metadata.isDisabled) return false;

                    // 2. Exklusives Testing-Gate (Sperrt alle anderen managed Elemente)
                    if (hasExclusive && alt.metadata.lifecycle === 'managed' && !alt.metadata.isExclusive) {
                        return false;
                    }

                    if (alt.state !== 'idle' || alt._markedForRemoval) return false;
                    if (this.isQueuedIncoming(alt)) return false;
                    if (alt.metadata.layer !== layer) return false;
                    if (alt.metadata.lifecycle === 'oneshot') return false;
                    if (!alt.metadata.systems.includes(info.system) && !alt.metadata.systems.includes('all')) return false;
                    if ((activeInstanceCount[alt.metadata.name] || 0) >= getMaxInstances(alt)) return false;
                    if (alt.metadata.isVoid && visibleCount === 0) return false;

                    return true;
                });

                if (candidates.length > 0) {
                    let chosen = this.selectWeightedDSE(candidates);
                    this.applyFatigue(chosen);

                    chosen.state = initialState;
                    chosen.stateTime = 0.0;
                    chosen._markedForRemoval = false;
                    if (typeof stageManager.invalidateCache === 'function') {
                        stageManager.invalidateCache(chosen);
                    }
                    stageManager.activeDSEs.push(chosen);

                    activeInstanceCount[chosen.metadata.name] = (activeInstanceCount[chosen.metadata.name] || 0) + 1;
                }
            }
        }
        stageManager.sortZOrder();
    }

    forceSystemChange(stageManager, info) {
        this.pendingSwaps.clear();
        this.queuedTransitions.clear();

        for (let i = stageManager.activeDSEs.length - 1; i >= 0; i--) {
            let dse = stageManager.activeDSEs[i];
            if (!dse.metadata.systems.includes(info.system) && !dse.metadata.systems.includes('all')) {
                dse.state = 'idle';
                dse.stateTime = 0.0;
                dse._markedForRemoval = false;
                if (typeof stageManager.clearPendingBeat === 'function') {
                    stageManager.clearPendingBeat(dse);
                }
                stageManager.activeDSEs.splice(i, 1);
            }
        }

        for (let d of this.registeredDSEs) {
            d.currentWeight = getBaseWeight(d);
        }
    }

    manageSwaps(stageManager, info, macroState, dt, beatStarted = false) {
        const safeDt = sanitizeDt(dt);

        // --- PRÜFUNG AUF EXKLUSIVES TEST-ELEMENT ---
        const hasExclusive = this.registeredDSEs.some(d =>
            d.metadata.isExclusive &&
            !d.metadata.isDisabled &&
            (d.metadata.systems.includes(info.system) || d.metadata.systems.includes('all'))
        );

        // 1. Vorgemerkte sequenzielle Uebergaenge auf opaken Layern freigeben,
        // sobald der ausgehende DSE vollstaendig ausgeblendet wurde.
        for (let [layer, entry] of this.queuedTransitions) {
            if (stageManager.activeDSEs.includes(entry.outgoing)) continue;

            this.queuedTransitions.delete(layer);
            const incoming = entry.incoming;
            const validSystem = incoming.metadata.systems.includes(info.system) || incoming.metadata.systems.includes('all');
            const blockedByExclusive = hasExclusive && incoming.metadata.lifecycle === 'managed' && !incoming.metadata.isExclusive;
            const layerAlreadyOccupied = stageManager.activeDSEs.some(
                active => active.metadata.layer === layer && !active._markedForRemoval
            );

            if (!incoming.metadata.isDisabled && !blockedByExclusive && validSystem && incoming.state === 'idle' && !layerAlreadyOccupied) {
                incoming.state = 'starting';
                incoming.stateTime = 0.0;
                incoming._markedForRemoval = false;
                if (typeof stageManager.invalidateCache === 'function') {
                    stageManager.invalidateCache(incoming);
                }
                stageManager.activeDSEs.push(incoming);
                stageManager.sortZOrder();
            }
        }

        // Swaps bewusst nur in playing/buildup, damit Climax & Afterglow nicht abgeschnitten werden.
        const swappableStates = ['playing', 'buildup'];
        const canSwap = dse => dse.metadata.lifecycle === 'managed' && swappableStates.includes(dse.state);

        for (let [dse] of this.pendingSwaps) {
            if (!stageManager.activeDSEs.includes(dse) || dse._markedForRemoval || !canSwap(dse)) {
                this.pendingSwaps.delete(dse);
            }
        }

        for (let dse of stageManager.activeDSEs) {
            if (dse._markedForRemoval) continue;

            // --- EXKLUSIVES TESTING-FADE-OUT ---
            if (hasExclusive && dse.metadata.lifecycle === 'managed' && !dse.metadata.isExclusive) {
                dse._markedForRemoval = true;
                this.pendingSwaps.delete(dse);
                continue;
            }

            if (canSwap(dse) && dse.stateTime >= dse.metadata.duration && !this.pendingSwaps.has(dse)) {
                this.pendingSwaps.set(dse, { wait: 0.0 });
            }
        }

        for (let [dse, pending] of this.pendingSwaps) {
            pending.wait += safeDt;
            if (!beatStarted && pending.wait < SWAP_BEATLESS_TIMEOUT) continue;

            let otherVisibleCount = stageManager.activeDSEs.filter(d =>
                d !== dse &&
                !d._markedForRemoval &&
                d.metadata.lifecycle === 'managed' &&
                !d.metadata.isVoid
            ).length;

            let activeInstanceCount = {};
            for (let active of stageManager.activeDSEs) {
                if (active !== dse && !active._markedForRemoval) {
                    activeInstanceCount[active.metadata.name] = (activeInstanceCount[active.metadata.name] || 0) + 1;
                }
            }
            for (let entry of this.queuedTransitions.values()) {
                activeInstanceCount[entry.incoming.metadata.name] = (activeInstanceCount[entry.incoming.metadata.name] || 0) + 1;
            }

            let candidates = this.registeredDSEs.filter(alt => {
                if (alt.metadata.isDisabled) return false;
                if (hasExclusive && alt.metadata.lifecycle === 'managed' && !alt.metadata.isExclusive) return false;
                if (alt._markedForRemoval) return false;
                if (alt.state !== 'idle' && alt !== dse) return false;
                if (this.isQueuedIncoming(alt)) return false;
                if (alt.metadata.layer !== dse.metadata.layer) return false;
                if (alt.metadata.lifecycle !== 'managed') return false;
                if (!alt.metadata.systems.includes(info.system) && !alt.metadata.systems.includes('all')) return false;
                if ((activeInstanceCount[alt.metadata.name] || 0) >= getMaxInstances(alt)) return false;
                if (alt.metadata.isVoid && otherVisibleCount === 0) return false;
                return true;
            });

            if (candidates.length === 0) {
                pending.wait = 0.0;
                continue;
            }

            let chosen = this.selectWeightedDSE(candidates);
            this.pendingSwaps.delete(dse);

            if (chosen === dse) {
                dse.stateTime = 0.0;
                this.applyFatigue(dse);
            } else {
                const layer = dse.metadata.layer;
                const sequentialOpaqueSwap = OPAQUE_LAYERS.has(layer)
                    && !dse.metadata.isVoid
                    && !chosen.metadata.isVoid;

                dse._markedForRemoval = true;
                this.applyFatigue(chosen);

                if (sequentialOpaqueSwap) {
                    this.queuedTransitions.set(layer, { outgoing: dse, incoming: chosen });
                } else {
                    chosen.state = 'starting';
                    chosen.stateTime = 0.0;
                    chosen._markedForRemoval = false;
                    if (typeof stageManager.invalidateCache === 'function') {
                        stageManager.invalidateCache(chosen);
                    }
                    stageManager.activeDSEs.push(chosen);
                    stageManager.sortZOrder();
                }
            }
        }
    }

    triggerPresenter(stageManager, info, trackMetadata) {
        let candidates = this.registeredDSEs.filter(d =>
            !d.metadata.isDisabled &&
            d.metadata.lifecycle === 'oneshot' &&
            (d.metadata.systems.includes(info.system) || d.metadata.systems.includes('all'))
        );

        if (candidates.length > 0) {
            let presenter = candidates[0];

            if (typeof presenter.setTrackInfo === 'function') {
                presenter.setTrackInfo(trackMetadata);
            } else {
                presenter.trackInfo = trackMetadata;
            }

            let idx = stageManager.activeDSEs.indexOf(presenter);
            presenter.state = 'starting';
            presenter.stateTime = 0.0;
            presenter._markedForRemoval = false;
            if (typeof stageManager.invalidateCache === 'function') {
                stageManager.invalidateCache(presenter);
            }
            if (idx === -1) {
                stageManager.activeDSEs.push(presenter);
                stageManager.sortZOrder();
            }
        }
    }
}