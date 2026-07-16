// === js/visuals/dj/setlist-manager.js ===
// =========================================================
// SCENE-DJ SKILL: SETLIST MANAGER (Fatigue Edition)
// Flawless Anti-Blackout prevention at source and organic
// Round-Robin weight recovery (Fatigue System).
// =========================================================

export class SetlistManager {
    constructor() {
        this.registeredDSEs = [];
    }

    registerDSE(dse) {
        dse.state = 'idle';
        dse.stateTime = 0.0;
        dse._markedForRemoval = false;
        // Dynamisches Gewicht für das Roulette (startet auf Basiswert)
        dse.currentWeight = dse.metadata.weight || 10.0;
        this.registeredDSEs.push(dse);
    }

    // =========================================================
    // FATIGUE SYSTEM (Ersetzt hard-coded Penaltys)
    // Wenn ein Effekt gewählt wird, fällt er ans Ende der Schlange.
    // Alle Konkurrenten erholen ihre Gewichte sachte.
    // =========================================================
    applyFatigue(selectedDse) {
        selectedDse.currentWeight = 0.1; // Erschöpfung!
        
        for (let d of this.registeredDSEs) {
            if (d !== selectedDse && d.metadata.layer === selectedDse.metadata.layer) {
                let baseWeight = d.metadata.weight || 10.0;
                // Erholt sich um 50% der Basis pro verpasstem Swap (Maximal BaseWeight)
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

        const layers = ['background', 'floor', 'foreground', 'overlay'];
        
        for (let layer of layers) {
            if (!layerFilled[layer]) {
                
                // ANTI-BLACKOUT: Wieviele sichtbare Elemente sind BEREITS im Aufbau/Aktiv?
                let visibleCount = stageManager.activeDSEs.filter(d => 
                    !d._markedForRemoval && 
                    d.metadata.lifecycle === 'managed' && 
                    !d.metadata.isVoid
                ).length;

                let candidates = this.registeredDSEs.filter(alt => {
                    if (alt.state !== 'idle' || alt._markedForRemoval) return false;
                    if (alt.metadata.layer !== layer) return false;
                    
                    // KORREKTUR: Nur 'oneshot' ausschließen! 
                    // Erlaubt 'managed' und 'permanent' (z.B. LimitBar) das Eintreten auf die Bühne.
                    if (alt.metadata.lifecycle === 'oneshot') return false; 
                    
                    if (!alt.metadata.systems.includes(info.system) && !alt.metadata.systems.includes('all')) return false;
                    if ((activeInstanceCount[alt.metadata.name] || 0) >= alt.metadata.maxInstances) return false;
                    
                    // ANTI-BLACKOUT: Ist dies das einzige Element, darf es nicht Void sein!
                    if (alt.metadata.isVoid && visibleCount === 0) return false;

                    return true;
                });
                
                if (candidates.length > 0) {
                    let chosen = this.selectWeightedDSE(candidates);
                    this.applyFatigue(chosen); // Verringert Wahrscheinlichkeit beim nächsten Roll
                    
                    chosen.state = initialState;
                    chosen.stateTime = 0.0;
                    chosen._markedForRemoval = false;
                    stageManager.activeDSEs.push(chosen);
                    
                    activeInstanceCount[chosen.metadata.name] = (activeInstanceCount[chosen.metadata.name] || 0) + 1;
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
        
        // Frischer Start beim Systemwechsel: Gewichte normalisieren
        for (let d of this.registeredDSEs) {
            d.currentWeight = d.metadata.weight || 10.0;
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
                        
                        // ANTI-BLACKOUT: Wieviele ANDERE Elemente halten das Bild gerade lebendig?
                        let otherVisibleCount = stageManager.activeDSEs.filter(d => 
                            d !== dse && 
                            !d._markedForRemoval && 
                            d.metadata.lifecycle === 'managed' && 
                            !d.metadata.isVoid
                        ).length;

                        let candidates = this.registeredDSEs.filter(alt => {
                            if (alt._markedForRemoval) return false;
                            if (alt.state !== 'idle' && alt !== dse) return false;
                            if (alt.metadata.layer !== dse.metadata.layer) return false;
                            if (alt.metadata.lifecycle !== 'managed') return false;
                            if (!alt.metadata.systems.includes(info.system) && !alt.metadata.systems.includes('all')) return false;
                            
                            // Wenn alles andere auf der Bühne Void ist, darf der Nachfolger von 'dse' nicht ebenfalls Void sein!
                            if (alt.metadata.isVoid && otherVisibleCount === 0) return false;

                            return true;
                        });
                        
                        if (candidates.length > 0) {
                            let chosen = this.selectWeightedDSE(candidates);
                            
                            if (chosen === dse) {
                                // Hat sich selbst gezogen (z.B. weil es mangels Alternativen das einzige DSE ist).
                                // Darf weiterspielen! Timer Reset + Fatigue anwenden
                                dse.stateTime = 0.0;
                                this.applyFatigue(dse);
                            } else {
                                // Neuer Star auf der Bühne! Alter geht ab.
                                dse._markedForRemoval = true;
                                
                                this.applyFatigue(chosen);
                                
                                chosen.state = 'starting';
                                chosen.stateTime = 0.0;
                                chosen._markedForRemoval = false;
                                stageManager.activeDSEs.push(chosen);
                                stageManager.sortZOrder();
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