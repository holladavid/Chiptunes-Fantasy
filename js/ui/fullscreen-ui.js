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
        
        // WICHTIG: stopPropagation verhindert, dass ein Klick auf "Pause" 
        // gleichzeitig das Easteregg-Gimmick (Logo-Klick-Event-Listener auf dem Container) umschaltet!
        if (this.btnPlay) this.btnPlay.addEventListener('click', (e) => { e.stopPropagation(); callbacks.onTogglePlay(); });
        if (this.btnPrev) this.btnPrev.addEventListener('click', (e) => { e.stopPropagation(); callbacks.onPrev(); });
        if (this.btnNext) this.btnNext.addEventListener('click', (e) => { e.stopPropagation(); callbacks.onNext(); });
    }

    updateTrack(title) {
        if (this.trackInfo) {
            this.trackInfo.innerText = title;
        }
    }

    updatePlayState(isPlaying) {
        if (this.btnPlay) {
            // Tracker-typische Play/Pause ASCII Symbole
            this.btnPlay.innerText = isPlaying ? '||' : '>';
        }
    }
}