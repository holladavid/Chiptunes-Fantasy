// === js/visuals/dj/setlist-manager.js ===
export class SetlistManager {
    constructor() {
        this.registeredDSEs = [];
    }

    registerDSE(dse) {
        dse.state = 'idle';
        dse.stateTime = 0.0;
        dse._markedForRemoval = false;
        if (!dse.metadata) dse.metadata = { name: dse.constructor.name, minPlayTime: 5.0, weight: 10, climaxHoldTime: 10.0, isVoid: false };
        dse.currentWeight = dse.metadata.weight || 10.0;
        this.registeredDSEs.push(dse);
    }

    resetWeightsForLayer(layer) {
        for (let d of this.registeredDSEs) {
            if (d.metadata.placementType === layer) d.currentWeight = d.metadata.weight || 10.0;
        }
    }

    selectWeightedDSE(candidates) {
        if (candidates.length === 0) return null;
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
        for (let dse of stageManager.activeDSEs) {
            if (!dse._markedForRemoval) layerFilled[dse.metadata.placementType] = true;
        }

        const layers = ['background', 'floor', 'foreground', 'overlay'];
        for (let layer of layers) {
            if (!layerFilled[layer]) {
                let candidates = this.registeredDSEs.filter(d => 
                    d.state === 'idle' && !d._markedForRemoval &&
                    d.metadata.placementType === layer &&
                    (d.metadata.computerType.includes(info.system) || d.metadata.computerType.includes('all'))
                );
                
                if (candidates.length > 0) {
                    this.resetWeightsForLayer(layer);
                    let chosen = this.selectWeightedDSE(candidates);
                    chosen.state = initialState;
                    chosen.stateTime = 0.0;
                    chosen._markedForRemoval = false;
                    stageManager.activeDSEs.push(chosen);
                }
            }
        }

        let nonVoidCount = 0;
        let activeNonOverlays = stageManager.activeDSEs.filter(d => d.metadata.placementType !== 'overlay' && !d._markedForRemoval);
        for (let d of activeNonOverlays) if (!d.metadata.isVoid) nonVoidCount++;

        if (activeNonOverlays.length > 0 && nonVoidCount === 0) {
            let dseToReplace = activeNonOverlays[Math.floor(Math.random() * activeNonOverlays.length)];
            let realCandidates = this.registeredDSEs.filter(d => 
                !d.metadata.isVoid && d.metadata.placementType === dseToReplace.metadata.placementType &&
                (d.metadata.computerType.includes(info.system) || d.metadata.computerType.includes('all'))
            );
            
            if (realCandidates.length > 0) {
                let idx = stageManager.activeDSEs.indexOf(dseToReplace);
                if (idx !== -1) {
                    dseToReplace.state = 'idle'; dseToReplace.stateTime = 0.0;
                    stageManager.activeDSEs.splice(idx, 1);
                }
                this.resetWeightsForLayer(dseToReplace.metadata.placementType);
                let chosen = this.selectWeightedDSE(realCandidates);
                chosen.state = initialState; chosen.stateTime = 0.0; chosen._markedForRemoval = false;
                if (!stageManager.activeDSEs.includes(chosen)) stageManager.activeDSEs.push(chosen);
            }
        }
        stageManager.sortZOrder();
    }

    forceSystemChange(stageManager, info) {
        for (let i = stageManager.activeDSEs.length - 1; i >= 0; i--) {
            let dse = stageManager.activeDSEs[i];
            if (dse.metadata.minPlayTime === Infinity && dse.metadata.computerType.includes('all')) continue; 
            if (!dse.metadata.computerType.includes(info.system) && !dse.metadata.computerType.includes('all')) {
                dse.state = 'idle';
                stageManager.activeDSEs.splice(i, 1);
            }
        }
        this.fillEmptyLayers(stageManager, info, 'idle');
    }

    manageSwaps(stageManager, info, macroState, dt) {
        if (macroState === 'climax') return;
        let swapOccurred = false;

        for (let dse of stageManager.activeDSEs) {
            if (dse._markedForRemoval) continue;
            if ((dse.state === 'playing' || dse.state === 'buildup') && dse.metadata.minPlayTime !== Infinity) {
                if (dse.stateTime >= dse.metadata.minPlayTime) {
                    let overTime = dse.stateTime - dse.metadata.minPlayTime;
                    if (Math.random() < overTime * 0.1 * dt) {
                        let candidates = this.registeredDSEs.filter(alt => 
                            (alt.state === 'idle' || alt === dse) && !alt._markedForRemoval &&
                            alt.metadata.placementType === dse.metadata.placementType &&
                            (alt.metadata.computerType.includes(info.system) || alt.metadata.computerType.includes('all'))
                        );
                        if (candidates.length > 0) {
                            let chosen = this.selectWeightedDSE(candidates);
                            if (chosen === dse) {
                                dse.stateTime = Math.max(0, dse.metadata.minPlayTime - 5.0);
                                dse.currentWeight = Math.max(1.0, dse.currentWeight * 0.5);
                            } else {
                                dse._markedForRemoval = true;
                                swapOccurred = true;
                            }
                        }
                    }
                }
            }
        }
        if (swapOccurred) this.fillEmptyLayers(stageManager, info, 'starting');
    }
}