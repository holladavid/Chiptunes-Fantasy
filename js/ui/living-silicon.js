// === js/ui/living-silicon.js ===
// =========================================================
// LIVING SILICON ORCHESTRATOR
// Delegates visualization to highly modular, system-specific
// chip implementations (Strategy Pattern).
// =========================================================

import { Sid6581 } from './silicon/sid-6581.js';
import { Paula8364 } from './silicon/paula-8364.js';
import { Ym2149 } from './silicon/ym-2149.js';

export class LivingSilicon {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.activeSystem = null;
        this.activeChip = null;
    }

    setSystem(system) {
        if (this.activeSystem === system) return;
        this.activeSystem = system;
        
        // Strategy/Factory Routing
        if (system === 'c64') {
            this.activeChip = new Sid6581(this.container);
        } else if (system === 'amiga') {
            this.activeChip = new Paula8364(this.container);
        } else if (system === 'atari') {
            this.activeChip = new Ym2149(this.container);
        }

        if (this.activeChip) {
            this.activeChip.mount();
        }
    }

    update(channelVolumes, currentRegs, t) {
        if (this.activeChip) {
            // Delegation an das gekapselte Chip-Objekt
            this.activeChip.update(channelVolumes, currentRegs, t);
        }
    }
}