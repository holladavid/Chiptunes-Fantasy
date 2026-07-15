// === js/visuals/dj/setlist-manager.js ===
// =========================================================
// SCENE-DJ SKILL: SETLIST MANAGER (Bug-Free Edition)
// Safe Black-Screen protection and deterministic weight decaying.
// =========================================================

export class SetlistManager {
    constructor() {
        this.registeredDSEs = [];
    }

    registerDSE(dse) {
        dse.state = 'idle';
        dse.stateTime = 0.0;
        dse._markedForRemoval = false;
        dse.currentWeight = dse.metadata.weight || 10.0;
        this.registeredDSEs.push(dse);
    }

    resetWeightsForLayer(layer) {
        for (let d of this.registeredDSEs) {
            if (d.metadata.layer === layer) d.currentWeight = d.metadata.weight || 10.0;
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
        let activeInstanceCount = {};

        for (let dse of stageManager.activeDSEs) {
            if (!dse._markedForRemoval) {
                layerFilled[dse.metadata.layer] = true;
                activeInstanceCount[dse.metadata.name] = (activeInstanceCount[dse.metadata.name] || 0) + 1;
            }
        }

        const layers = ['background', 'floor', 'foreground', 'overlay'];
        
        // 1. Reguläres Auffüllen fehlender Layer
        for (let layer of layers) {
            if (!layerFilled[layer]) {
                let candidates = this.registeredDSEs.filter(d => 
                    d.state === 'idle' && !d._markedForRemoval &&
                    d.metadata.layer === layer &&
                    d.metadata.lifecycle !== 'oneshot' && 
                    (d.metadata.systems.includes(info.system) || d.metadata.systems.includes('all')) &&
                    ((activeInstanceCount[d.metadata.name] || 0) < d.metadata.maxInstances)
                );
                
                if (candidates.length > 0) {
                    this.resetWeightsForLayer(layer);
                    let chosen = this.selectWeightedDSE(candidates);
                    chosen.state = initialState;
                    chosen.stateTime = 0.0;
                    chosen._markedForRemoval = false;
                    stageManager.activeDSEs.push(chosen);
                    activeInstanceCount[chosen.metadata.name] = (activeInstanceCount[chosen.metadata.name] || 0) + 1;
                }
            }
        }

        // =========================================================
        // 2. BLACK-SCREEN PROTECTION (Schutzschaltung-Upgrade)
        // =========================================================
        let activeManaged = stageManager.activeDSEs.filter(d => d.metadata.lifecycle === 'managed' && !d._markedForRemoval);
        let nonVoidCount = activeManaged.filter(d => !d.metadata.isVoid).length;

        if (activeManaged.length > 0 && nonVoidCount === 0) {
            // GFX FIX: Wir filtern nach aktiven Layern, für die es auf dem aktuellen System
            // WIRKLICH ein sichtbares Gegenstück in der Registry gibt (löst C64-Foreground Bug!)
            let replaceable = activeManaged.filter(activeDse => {
                return this.registeredDSEs.some(d => 
                    !d.metadata.isVoid && 
                    d.metadata.layer === activeDse.metadata.layer &&
                    d.metadata.lifecycle === 'managed' &&
                    (d.metadata.systems.includes(info.system) || d.metadata.systems.includes('all'))
                );
            });

            if (replaceable.length > 0) {
                // Nur aus den physikalisch ersetzbaren Layern zufällig wählen
                let dseToReplace = replaceable[Math.floor(Math.random() * replaceable.length)];
                
                let realCandidates = this.registeredDSEs.filter(d => 
                    !d.metadata.isVoid && 
                    d.metadata.layer === dseToReplace.metadata.layer &&
                    d.metadata.lifecycle === 'managed' &&
                    (d.metadata.systems.includes(info.system) || d.metadata.systems.includes('all'))
                );
                
                if (realCandidates.length > 0) {
                    let idx = stageManager.activeDSEs.indexOf(dseToReplace);
                    if (idx !== -1) {
                        dseToReplace.state = 'idle'; 
                        dseToReplace.stateTime = 0.0;
                        stageManager.activeDSEs.splice(idx, 1);
                    }
                    
                    this.resetWeightsForLayer(dseToReplace.metadata.layer);
                    let chosen = this.selectWeightedDSE(realCandidates);
                    chosen.state = initialState; 
                    chosen.stateTime = 0.0; 
                    chosen._markedForRemoval = false;
                    stageManager.activeDSEs.push(chosen);
                }
            }
        }
        stageManager.sortZOrder();
    }

    forceSystemChange(stageManager, info) {
        for (let i = stageManager.activeDSEs.length - 1; i >= 0; i--) {
            let dse = stageManager.activeDSEs[i];
            if (dse.metadata.lifecycle === 'permanent' && dse.metadata.systems.includes('all')) continue; 
            if (!dse.metadata.systems.includes(info.system) && !dse.metadata.systems.includes('all')) {
                dse.state = 'idle';
                stageManager.activeDSEs.splice(i, 1);
            }
        }
        this.fillEmptyLayers(stageManager, info, 'idle');
    }

    manageSwaps(stageManager, info, macroState, dt) {
        for (let dse of stageManager.activeDSEs) {
            if (dse._markedForRemoval) continue;
            
            if (dse.metadata.lifecycle === 'managed' && (dse.state === 'playing' || dse.state === 'buildup' || dse.state === 'climax')) {
                if (dse.stateTime >= dse.metadata.duration) {
                    let overTime = dse.stateTime - dse.metadata.duration;
                    let swapChance = overTime * 0.1 * dt; 

                    if (Math.random() < swapChance) {
                        let candidates = this.registeredDSEs.filter(alt => 
                            (alt.state === 'idle' || alt === dse) && !alt._markedForRemoval &&
                            alt.metadata.layer === dse.metadata.layer &&
                            alt.metadata.lifecycle === 'managed' &&
                            (alt.metadata.systems.includes(info.system) || alt.metadata.systems.includes('all'))
                        );
                        
                        if (candidates.length > 0) {
                            let chosen = this.selectWeightedDSE(candidates);
                            
                            if (chosen === dse) {
                                // Re-Roll Strafe: Zeit kürzen und Gewicht halbieren
                                dse.stateTime = Math.max(0, dse.metadata.duration - 5.0);
                                dse.currentWeight = Math.max(1.0, dse.currentWeight * 0.5);
                            } else {
                                // GFX FIX: Hard-Swap direkt im Frame ausführen (kein Double-Rolling mehr!)
                                dse._markedForRemoval = true;
                                
                                chosen.state = 'starting';
                                chosen.stateTime = 0.0;
                                chosen._markedForRemoval = false;
                                stageManager.activeDSEs.push(chosen);
                                stageManager.sortZOrder();
                                
                                // Setzt die Gewichte für diesen Layer erst NACH dem erfolgreichen Tausch zurück
                                this.resetWeightsForLayer(dse.metadata.layer);
                            }
                        }
                    }
                }
            }
        }
    }

    triggerPresenter(stageManager, info, trackMetadata) {
        let candidates = this.registeredDSEs.filter(d => 
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
            if (idx !== -1) {
                presenter.state = 'starting';
                presenter.stateTime = 0.0;
                presenter._markedForRemoval = false;
            } else {
                presenter.state = 'starting';
                presenter.stateTime = 0.0;
                presenter._markedForRemoval = false;
                stageManager.activeDSEs.push(presenter);
                stageManager.sortZOrder();
            }
        }
    }
}