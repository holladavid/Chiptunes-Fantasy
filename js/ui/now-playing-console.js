// === js/ui/now-playing-console.js ===
// Expanded, read-only fullscreen telemetry for the active emulation session.

const CHANNEL_LABELS = Object.freeze({
    c64: ['SID 1', 'SID 2', 'SID 3'],
    amiga: ['DMA 1', 'DMA 2', 'DMA 3', 'DMA 4'],
    atari: ['PSG A', 'PSG B', 'PSG C']
});

function displayValue(value, fallback = 'NOT IN FILE') {
    const text = String(value ?? '').trim();
    return text || fallback;
}

function formatSubsong(system, metadata, currentSubsong) {
    if ((system !== 'c64' && system !== 'amiga') || !metadata?.songs) return '—';
    const current = Math.max(1, Number(currentSubsong) || 1);
    const total = Math.max(current, Number(metadata.songs) || 1);
    return `${String(current).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
}

function formatHardware(system, metadata = {}) {
    if (system === 'c64') {
        const details = [
            metadata.loadAddress ? `LOAD ${metadata.loadAddress}` : '',
            metadata.playAddress ? `PLAY ${metadata.playAddress}` : ''
        ].filter(Boolean);
        return details.join(' · ') || '3 SID VOICES · 6502 BUS';
    }

    if (system === 'amiga') {
        return [
            '4 DMA VOICES',
            Number.isFinite(Number(metadata.patternCount)) ? `${metadata.patternCount} PATTERNS` : '',
            Number.isFinite(Number(metadata.instrumentCount)) ? `${metadata.instrumentCount} SAMPLES` : ''
        ].filter(Boolean).join(' · ');
    }

    const clock = Number(metadata.masterClock);
    const playerRate = Number(metadata.playerRate);
    return [
        '3 PSG',
        clock > 0 ? `${(clock / 1000000).toFixed(2)} MHZ` : '',
        playerRate > 0 ? `${playerRate} HZ` : ''
    ].filter(Boolean).join(' · ');
}

export function buildNowPlayingModel({
    system,
    metadata = null,
    selectedSong = null,
    trackIndex = -1,
    tracks = [],
    currentSubsong = 1
}) {
    const hasMetadata = Boolean(metadata && Object.keys(metadata).length > 0);
    const pending = Boolean(selectedSong) && !hasMetadata;
    const fallback = pending ? 'READING METADATA' : (selectedSong ? 'NOT IN FILE' : '—');
    const nextTrack = trackIndex >= 0 && tracks.length > 0
        ? tracks[(trackIndex + 1) % tracks.length]
        : null;

    return {
        system,
        composer: displayValue(metadata?.author || selectedSong?.composer, fallback),
        release: displayValue(
            metadata?.released || metadata?.year || selectedSong?.released || selectedSong?.year,
            fallback
        ),
        subsong: pending ? '—' : formatSubsong(system, metadata, currentSubsong),
        format: displayValue(metadata?.type || selectedSong?.format, fallback),
        hardware: pending ? fallback : formatHardware(system, metadata || {}),
        next: nextTrack?.listTitle || nextTrack?.title || '—',
        channelLabels: CHANNEL_LABELS[system] || []
    };
}

export class NowPlayingConsole {
    constructor(root = document.getElementById('now-playing')) {
        this.root = root;
        this.fields = {};
        for (const name of ['composer', 'release', 'subsong', 'format', 'hardware', 'next', 'time']) {
            this.fields[name] = document.getElementById(`now-playing-${name}`);
        }
        this.progress = document.getElementById('now-playing-progress-fill');
        this.channels = [...document.querySelectorAll('.now-playing-channel[data-channel-index]')];
        this.lastLiveUpdate = 0;
        this.lastTime = '';
        this.lastProgress = -1;
        this.lastLevels = new Array(this.channels.length).fill(-1);
    }

    setField(name, value) {
        const element = this.fields[name];
        if (!element) return;
        element.textContent = value;
        element.title = value;
    }

    updateTrack(model) {
        if (this.root) this.root.dataset.system = model.system;
        for (const name of ['composer', 'release', 'subsong', 'format', 'hardware', 'next']) {
            this.setField(name, model[name]);
        }

        this.channels.forEach((channel, index) => {
            const label = model.channelLabels[index] || '';
            channel.hidden = !label;
            if (!label) return;
            channel.setAttribute('aria-label', `${label} live activity`);
            const labelElement = channel.querySelector('.now-playing-channel-label');
            if (labelElement) labelElement.textContent = label;
        });
    }

    updateLive({ currentTime = '00:00', totalTime = '00:00', progress = 0, levels = [], playing = false }, force = false) {
        const now = performance.now();
        if (!force && now - this.lastLiveUpdate < 66) return;
        this.lastLiveUpdate = now;

        const time = `${currentTime} / ${totalTime}`;
        if (time !== this.lastTime) {
            this.setField('time', time);
            this.lastTime = time;
        }

        const clampedProgress = Math.min(1, Math.max(0, Number(progress) || 0));
        if (this.progress && Math.abs(clampedProgress - this.lastProgress) > 0.0005) {
            this.progress.style.transform = `scaleX(${clampedProgress})`;
            this.lastProgress = clampedProgress;
        }

        this.channels.forEach((channel, index) => {
            if (channel.hidden) return;
            const level = playing ? Math.min(1, Math.max(0, Number(levels[index]) || 0)) : 0;
            if (Math.abs(level - this.lastLevels[index]) < 0.004 && !force) return;
            this.lastLevels[index] = level;
            const fill = channel.querySelector('.now-playing-channel-fill');
            if (fill) fill.style.transform = `scaleX(${level})`;
            channel.setAttribute('aria-valuenow', String(Math.round(level * 100)));
            channel.dataset.active = String(level > 0.01);
        });
    }
}
