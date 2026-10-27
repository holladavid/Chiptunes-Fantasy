export const DEFAULT_PLAYER_RATE = 50;

export function getPlayerRate(track) {
    const rate = track?.metadata?.playerRate;
    return Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_PLAYER_RATE;
}

export function framesToSeconds(frames, track) {
    return frames / getPlayerRate(track);
}

export function secondsToFrames(seconds, track) {
    return Math.floor(seconds * getPlayerRate(track));
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
        currentFrame === loopFrame && previousFrame >= currentFrame && previousFrame >= track.length - 2;
}
