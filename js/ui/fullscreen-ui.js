// =========================================================
// FULLSCREEN OVERLAY UI MANAGER
// Encapsulates playback controls, compact track telemetry and
// optional scrubbing decoupled from the main app.js state machine.
// =========================================================

export class FullscreenUI {
    constructor(callbacks) {
        this.trackInfo = document.getElementById('fs-track-info');
        this.trackTime = document.getElementById('fs-track-time');
        this.progressBar = document.getElementById('fs-progress-bar');
        this.progressFill = document.getElementById('fs-progress-fill');
        this.btnPlay = document.getElementById('fs-btn-play');
        this.btnPrev = document.getElementById('fs-btn-prev');
        this.btnNext = document.getElementById('fs-btn-next');
        this.btnEco = document.getElementById('fs-btn-eco');
        this.playbackStatus = document.getElementById('fs-playback-status');
        this.lastTimeText = '';
        this.lastProgress = -1;

        if (this.btnPlay) this.btnPlay.addEventListener('click', (e) => { e.stopPropagation(); callbacks.onTogglePlay(); });
        if (this.btnPrev) this.btnPrev.addEventListener('click', (e) => { e.stopPropagation(); callbacks.onPrev(); });
        if (this.btnNext) this.btnNext.addEventListener('click', (e) => { e.stopPropagation(); callbacks.onNext(); });
        if (this.btnEco) this.btnEco.addEventListener('click', (e) => { e.stopPropagation(); callbacks.onToggleEco(); });

        if (this.progressBar && typeof callbacks.onSeek === 'function') {
            let scrubbing = false;
            const seekAtEvent = (e) => {
                if (this.progressBar.dataset.seekable !== 'true') return;
                const rect = this.progressBar.getBoundingClientRect();
                if (rect.width <= 0) return;
                const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
                callbacks.onSeek(ratio);
            };
            this.progressBar.addEventListener('pointerdown', (e) => {
                if (this.progressBar.dataset.seekable !== 'true') return;
                e.stopPropagation();
                scrubbing = true;
                this.progressBar.setPointerCapture?.(e.pointerId);
                seekAtEvent(e);
            });
            this.progressBar.addEventListener('pointermove', (e) => {
                if (!scrubbing) return;
                seekAtEvent(e);
            });
            const endScrub = () => { scrubbing = false; };
            this.progressBar.addEventListener('pointerup', endScrub);
            this.progressBar.addEventListener('pointercancel', endScrub);
        }

        this.updatePlayState(false);
    }

    updateTrack(title) {
        if (this.trackInfo) {
            this.trackInfo.innerText = title;
            this.trackInfo.title = title;
        }
    }

    updateTimeline({ currentTime = '00:00', totalTime = '00:00', progress = 0, seekable = false } = {}) {
        const timeText = `${currentTime} / ${totalTime}`;
        if (this.trackTime && timeText !== this.lastTimeText) {
            this.trackTime.textContent = timeText;
            this.lastTimeText = timeText;
        }

        const clamped = Math.min(1, Math.max(0, Number(progress) || 0));
        if (this.progressFill && Math.abs(clamped - this.lastProgress) > 0.0005) {
            this.progressFill.style.transform = `scaleX(${clamped})`;
            this.lastProgress = clamped;
        }

        if (this.progressBar) {
            this.progressBar.dataset.seekable = String(Boolean(seekable));
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