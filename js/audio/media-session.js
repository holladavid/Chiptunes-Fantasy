// === js/audio/media-session.js ===
// Browser system controls for Chiptunes Fantasy.
// This adapter owns no playback state and never talks to an emulation core.

const DEFAULT_SEEK_OFFSET_SECONDS = 10;

export class MediaSessionController {
    constructor({
        mediaSession = globalThis.navigator?.mediaSession,
        Metadata = globalThis.MediaMetadata,
        now = () => performance.now(),
        positionIntervalMs = 1000,
        onPlay,
        onPause,
        onNext,
        onPrevious,
        onSeekBackward,
        onSeekForward,
        onSeekTo
    } = {}) {
        this.mediaSession = mediaSession || null;
        this.Metadata = Metadata || null;
        this.now = now;
        this.positionIntervalMs = positionIntervalMs;
        this.seekable = false;
        this.lastPositionUpdate = -Infinity;
        this.lastDuration = -1;
        this.lastPosition = -1;

        if (!this.mediaSession) return;

        this.setActionHandler('play', onPlay);
        this.setActionHandler('pause', onPause);
        this.setActionHandler('stop', onPause);
        this.setActionHandler('nexttrack', onNext);
        this.setActionHandler('previoustrack', onPrevious);

        this.onSeekBackward = onSeekBackward;
        this.onSeekForward = onSeekForward;
        this.onSeekTo = onSeekTo;
    }

    setActionHandler(action, handler) {
        if (!this.mediaSession || typeof this.mediaSession.setActionHandler !== 'function') return;
        try {
            this.mediaSession.setActionHandler(action, typeof handler === 'function' ? handler : null);
        } catch {
            // Individual actions are optional on some browsers and embedded webviews.
        }
    }

    setMetadata(title, artist, album, artwork) {
        if (!this.mediaSession || !this.Metadata) return;
        try {
            this.mediaSession.metadata = new this.Metadata({
                title: title || 'Chiptunes Fantasy',
                artist: artist || '',
                album: album || 'Chiptunes Fantasy',
                artwork
            });
        } catch {
            // Metadata must never prevent actual audio playback.
        }
    }

    setPlaybackState(state) {
        if (!this.mediaSession) return;
        try {
            this.mediaSession.playbackState = state;
        } catch {
            // Older implementations may expose metadata but not playbackState.
        }
    }

    setSeekable(seekable) {
        const nextSeekable = Boolean(seekable);
        if (!this.mediaSession || nextSeekable === this.seekable) return;
        this.seekable = nextSeekable;

        this.setActionHandler('seekbackward', nextSeekable ? details => {
            const offset = Number.isFinite(details?.seekOffset)
                ? details.seekOffset
                : DEFAULT_SEEK_OFFSET_SECONDS;
            this.onSeekBackward?.(offset);
        } : null);
        this.setActionHandler('seekforward', nextSeekable ? details => {
            const offset = Number.isFinite(details?.seekOffset)
                ? details.seekOffset
                : DEFAULT_SEEK_OFFSET_SECONDS;
            this.onSeekForward?.(offset);
        } : null);
        this.setActionHandler('seekto', nextSeekable ? details => {
            if (Number.isFinite(details?.seekTime)) this.onSeekTo?.(details.seekTime);
        } : null);
    }

    updatePosition(duration, position, force = false) {
        if (!this.mediaSession || typeof this.mediaSession.setPositionState !== 'function') return;
        if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(position)) return;

        const clampedPosition = Math.min(Math.max(position, 0), duration);
        const timestamp = this.now();
        if (!force && timestamp - this.lastPositionUpdate < this.positionIntervalMs) return;
        if (!force && clampedPosition === this.lastPosition && duration === this.lastDuration) return;

        try {
            this.mediaSession.setPositionState({
                duration,
                position: clampedPosition,
                playbackRate: 1
            });
            this.lastPositionUpdate = timestamp;
            this.lastDuration = duration;
            this.lastPosition = clampedPosition;
        } catch {
            // Position reporting is optional and stricter on some implementations.
        }
    }

    clear() {
        this.setSeekable(false);
        this.setPlaybackState('none');
        if (this.mediaSession) {
            try {
                this.mediaSession.metadata = null;
            } catch {
                // Keep reset best-effort on partial Media Session implementations.
            }
        }
        this.lastPositionUpdate = -Infinity;
        this.lastDuration = -1;
        this.lastPosition = -1;
    }
}
