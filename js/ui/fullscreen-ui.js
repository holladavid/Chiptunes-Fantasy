// === js/ui/fullscreen-ui.js ===
// =========================================================
// FULLSCREEN OVERLAY UI MANAGER
// Encapsulates playback controls and track info rendering 
// decoupled from the main app.js state machine.
// =========================================================

export class FullscreenUI {
    constructor(callbacks) {
        this.trackInfo = document.getElementById('fs-track-info');
        this.btnPlay = document.getElementById('fs-btn-play');
        this.btnPrev = document.getElementById('fs-btn-prev');
        this.btnNext = document.getElementById('fs-btn-next');
        this.btnEco = document.getElementById('fs-btn-eco');
        this.playbackStatus = document.getElementById('fs-playback-status');
        
        if (this.btnPlay) this.btnPlay.addEventListener('click', (e) => { e.stopPropagation(); callbacks.onTogglePlay(); });
        if (this.btnPrev) this.btnPrev.addEventListener('click', (e) => { e.stopPropagation(); callbacks.onPrev(); });
        if (this.btnNext) this.btnNext.addEventListener('click', (e) => { e.stopPropagation(); callbacks.onNext(); });
        if (this.btnEco) this.btnEco.addEventListener('click', (e) => { e.stopPropagation(); callbacks.onToggleEco(); });

        // NEU: Sofortige Synchronisation des Play-Zustands beim Laden der Klasse
        this.updatePlayState(false);
    }

    updateTrack(title) {
        if (this.trackInfo) {
            this.trackInfo.innerText = title;
            this.trackInfo.title = title;
        }
    }

    updatePlayState(isPlaying) {
        this.updatePlaybackState(isPlaying ? 'playing' : 'idle');
    }

    updatePlaybackState(state) {
        const labels = {
            idle: '[ INJECT ROM ]',
            loading: '[ DECODING ]',
            playing: '[ HALT BUS ]',
            paused: '[ RESUME BUS ]',
            error: '[ RETRY ROM ]'
        };
        const label = labels[state] || labels.idle;
        const isLoading = state === 'loading';
        const mainPlayBtn = document.getElementById('btn-play');
        const statusLabels = {
            idle: 'STANDBY',
            loading: 'DECODING',
            playing: 'BUS ACTIVE',
            paused: 'BUS HALTED',
            error: 'FAULT'
        };
        if (this.playbackStatus) {
            this.playbackStatus.dataset.state = state;
            this.playbackStatus.textContent = statusLabels[state] || statusLabels.idle;
        }

        for (const button of [this.btnPlay, mainPlayBtn]) {
            if (!button) continue;
            button.innerText = label;
            button.disabled = isLoading;
            button.setAttribute('aria-busy', String(isLoading));
            button.dataset.state = state;
        }
    }
}
