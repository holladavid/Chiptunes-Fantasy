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
        this.playbackState = 'idle';
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

    setPlaybackState(state = 'idle') {
        this.playbackState = state;
        const labels = {
            idle: 'STANDBY',
            loading: 'DECODING',
            playing: 'LIVE BUS',
            paused: 'BUS HALTED',
            error: 'FAULT'
        };
        this.container.dataset.playbackState = state;
        const status = document.getElementById('silicon-playback-status');
        if (status) {
            status.dataset.state = state;
            status.textContent = labels[state] || labels.idle;
        }
    }

    update(channelVolumes, currentRegs, t, sidRegisterWriteRate = 0) {
        if (!this.activeChip) return;
        if (this.playbackState === 'playing') {
            // Delegation an das gekapselte Chip-Objekt
            this.activeChip.update(channelVolumes, currentRegs, t, sidRegisterWriteRate);
        }
        this.activeChip.syncReadout();
    }
}
