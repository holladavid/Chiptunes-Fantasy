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
            const metadataInit = {
                title: title || 'Chiptunes Fantasy',
                artist: artist || '',
                album: album || 'Chiptunes Fantasy'
            };
            if (Array.isArray(artwork)) {
                metadataInit.artwork = artwork;
            }
            this.mediaSession.metadata = new this.Metadata(metadataInit);
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

        this.setActionHandler(
            'seekbackward',
            nextSeekable && typeof this.onSeekBackward === 'function'
                ? details => {
                    const offset = Number.isFinite(details?.seekOffset) && details.seekOffset > 0
                        ? details.seekOffset
                        : DEFAULT_SEEK_OFFSET_SECONDS;
                    this.onSeekBackward(offset);
                }
                : null
        );
        this.setActionHandler(
            'seekforward',
            nextSeekable && typeof this.onSeekForward === 'function'
                ? details => {
                    const offset = Number.isFinite(details?.seekOffset) && details.seekOffset > 0
                        ? details.seekOffset
                        : DEFAULT_SEEK_OFFSET_SECONDS;
                    this.onSeekForward(offset);
                }
                : null
        );
        this.setActionHandler(
            'seekto',
            nextSeekable && typeof this.onSeekTo === 'function'
                ? details => {
                    if (Number.isFinite(details?.seekTime)) {
                        this.onSeekTo(Math.max(0, details.seekTime));
                    }
                }
                : null
        );
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
            if (typeof this.mediaSession.setPositionState === 'function') {
                try {
                    this.mediaSession.setPositionState(null);
                } catch {
                    try {
                        this.mediaSession.setPositionState({});
                    } catch {
                        // Keep reset best-effort on partial Media Session implementations.
                    }
                }
            }
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

    destroy() {
        this.clear();
        for (const action of ['play', 'pause', 'stop', 'nexttrack', 'previoustrack']) {
            this.setActionHandler(action, null);
        }
    }
}

export const DEFAULT_PLAYER_RATE = 50;

export function getPlayerRate(track) {
    const rate = track?.metadata?.playerRate;
    return Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_PLAYER_RATE;
}

export function framesToSeconds(frames, track) {
    if (!Number.isFinite(frames) || frames <= 0) return 0;
    return frames / getPlayerRate(track);
}

export function secondsToFrames(seconds, track) {
    if (!Number.isFinite(seconds) || seconds <= 0) return 0;
    return Math.floor((seconds * getPlayerRate(track)) + 1e-9);
}

export function formatFrameTime(frames, track) {
    if (!Number.isFinite(frames) || frames <= 0) return '00:00';
    const totalSeconds = Math.floor(framesToSeconds(frames, track));
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
}

export function isStoredLoopTransition(previousFrame, currentFrame, track) {
    const loopFrame = track?.metadata?.loopFrame;
    return Number.isInteger(loopFrame) && loopFrame >= 0 && loopFrame < track.length &&
        currentFrame === loopFrame && previousFrame > currentFrame && previousFrame >= track.length - 2;
}