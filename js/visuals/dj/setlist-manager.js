// === js/visuals/dj/setlist-manager.js ===
// =========================================================
// SCENE-DJ SKILL: SETLIST MANAGER
// Verwaltet die DSE-Registry, das Roulette-Wheel (Swapping)
// und die lebenswichtige Black-Screen Schutzschaltung.
// =========================================================

export class SetlistManager {
    constructor() {
        this.registeredDSEs = [];
    }

    registerDSE(dse) {
        dse.state = 'idle';
        dse.stateTime = 0.0;
        dse._markedForRemoval = false;
        // Dynamische Gewichtung (wird zur Laufzeit bei Re-Rolls reduziert)
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
                // Zählt, wie oft dasselbe DSE gerade aktiv ist (für künftige Partikel-Swärme)
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
                    d.metadata.lifecycle !== 'oneshot' && // One-Shots (Presenter) werden niemals auto-gerollt!
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
        // 2. BLACK-SCREEN PROTECTION (Die Schutzschaltung)
        // Stellt sicher, dass das Canvas niemals komplett schwarz/leer wird!
        // =========================================================
        let activeManaged = stageManager.activeDSEs.filter(d => d.metadata.lifecycle === 'managed' && !d._markedForRemoval);
        let nonVoidCount = 0;
        
        for (let d of activeManaged) {
            if (!d.metadata.isVoid) nonVoidCount++;
        }

        // Wenn alle managed DSEs Platzhalter sind (Canvas ist schwarz) -> Not-Reroll erzwingen!
        if (activeManaged.length > 0 && nonVoidCount === 0) {
            let dseToReplace = activeManaged[Math.floor(Math.random() * activeManaged.length)];
            
            let realCandidates = this.registeredDSEs.filter(d => 
                !d.metadata.isVoid && 
                d.metadata.layer === dseToReplace.metadata.layer &&
                d.metadata.lifecycle === 'managed' &&
                (d.metadata.systems.includes(info.system) || d.metadata.systems.includes('all'))
            );
            
            if (realCandidates.length > 0) {
                // Den Platzhalter hart rauswerfen
                let idx = stageManager.activeDSEs.indexOf(dseToReplace);
                if (idx !== -1) {
                    dseToReplace.state = 'idle'; 
                    dseToReplace.stateTime = 0.0;
                    stageManager.activeDSEs.splice(idx, 1);
                }
                
                // Ein echtes, gezeichnetes Gimmick erzwingen
                this.resetWeightsForLayer(dseToReplace.metadata.layer);
                let chosen = this.selectWeightedDSE(realCandidates);
                chosen.state = initialState; 
                chosen.stateTime = 0.0; 
                chosen._markedForRemoval = false;
                stageManager.activeDSEs.push(chosen);
            }
        }
        stageManager.sortZOrder();
    }

    forceSystemChange(stageManager, info) {
        for (let i = stageManager.activeDSEs.length - 1; i >= 0; i--) {
            let dse = stageManager.activeDSEs[i];
            
            // Permanente, universelle Overlays (wie LimitBar) bleiben erhalten
            if (dse.metadata.lifecycle === 'permanent' && dse.metadata.systems.includes('all')) continue; 
            
            if (!dse.metadata.systems.includes(info.system) && !dse.metadata.systems.includes('all')) {
                dse.state = 'idle';
                stageManager.activeDSEs.splice(i, 1);
            }
        }
        this.fillEmptyLayers(stageManager, info, 'idle');
    }

    manageSwaps(stageManager, info, macroState, dt) {
        let swapOccurred = false;

        for (let dse of stageManager.activeDSEs) {
            if (dse._markedForRemoval) continue;
            
            // Nur 'managed' DSEs werden vom Crate-Digger wegrotiert
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
                            
                            // =========================================================
                            // PENALTY SYSTEM: Re-Roll Strafe!
                            // Zieht das Roulette denselben Effekt erneut, sinkt seine
                            // Chance massiv und er fliegt 5 Sekunden früher wieder raus!
                            // =========================================================
                            if (chosen === dse) {
                                dse.stateTime = Math.max(0, dse.metadata.duration - 5.0);
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

    // =========================================================
    // ONE-SHOT TRIGGER (z.B. TrackPresenter)
    // Wird vom SceneDJ aufgerufen, wenn ein neuer Track startet
    // =========================================================
    triggerPresenter(stageManager, info, trackMetadata) {
        // Suche nach einem registrierten 'oneshot' DSE (wie dem TrackPresenter)
        let candidates = this.registeredDSEs.filter(d => 
            d.metadata.lifecycle === 'oneshot' &&
            (d.metadata.systems.includes(info.system) || d.metadata.systems.includes('all'))
        );

        if (candidates.length > 0) {
            let presenter = candidates[0]; 
            
            // Injiziert die neuen Metadaten des Tracks in das DSE
            if (typeof presenter.setTrackInfo === 'function') {
                presenter.setTrackInfo(trackMetadata);
            }

            // Wenn das Element bereits aktiv ist (z.B. bei schnellem Weiterklicken),
            // setzen wir seinen Timer und State einfach wieder hart auf Null zurück!
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