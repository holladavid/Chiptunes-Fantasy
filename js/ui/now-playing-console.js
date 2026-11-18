// === js/ui/now-playing-console.js ===
// Expanded, read-only fullscreen telemetry for the active emulation session.

const CHANNEL_LABELS = Object.freeze({
    c64: ['SID 1', 'SID 2', 'SID 3'],
    amiga: ['DMA 1', 'DMA 2', 'DMA 3', 'DMA 4'],
    atari: ['PSG A', 'PSG B', 'PSG C']
});

function cleanMetaValue(value) {
    const text = String(value ?? '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    return /^(?:(?:unknown|unbekannt)\b|none$|n\/?a$|<\?+>$|[-–—?]+$)/i.test(text) ? '' : text;
}

function displayValue(value, fallback = 'NOT IN FILE') {
    return cleanMetaValue(value) || fallback;
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
    const digidrums = Number(metadata.digidrumCount);
    return [
        '3 PSG',
        clock > 0 ? `${(clock / 1000000).toFixed(2)} MHZ` : '',
        playerRate > 0 ? `${playerRate} HZ` : '',
        digidrums > 0 ? `${digidrums} DIGI` : ''
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
        composer: displayValue(cleanMetaValue(metadata?.author) || cleanMetaValue(selectedSong?.composer), fallback),
        release: displayValue(
            cleanMetaValue(metadata?.released) ||
            cleanMetaValue(metadata?.year) ||
            cleanMetaValue(selectedSong?.released) ||
            cleanMetaValue(selectedSong?.year),
            fallback
        ),
        subsong: pending ? '—' : formatSubsong(system, metadata, currentSubsong),
        format: displayValue(cleanMetaValue(metadata?.type) || cleanMetaValue(selectedSong?.format), fallback),
        hardware: pending ? fallback : formatHardware(system, metadata || {}),
        next: nextTrack?.listTitle || nextTrack?.title || '—',
        channelLabels: CHANNEL_LABELS[system] || []
    };
}

export class NowPlayingConsole {
    constructor(root = document.getElementById('now-playing')) {
        this.root = root;
        const pick = (id) => this.root?.querySelector?.(`#${id}`) || document.getElementById(id);

        this.fields = {};
        this.lastFieldValues = {};
        for (const name of ['composer', 'release', 'subsong', 'format', 'hardware', 'next', 'time']) {
            this.fields[name] = pick(`now-playing-${name}`);
            this.lastFieldValues[name] = '';
        }

        this.progress = pick('now-playing-progress-fill');
        this.progressBar = pick('now-playing-progress');
        this.channels = [...(this.root?.querySelectorAll?.('.now-playing-channel[data-channel-index]')
            || document.querySelectorAll('.now-playing-channel[data-channel-index]'))];
        this.channelFills = this.channels.map(ch => ch.querySelector('.now-playing-channel-fill'));
        this.channelLabels = this.channels.map(ch => ch.querySelector('.now-playing-channel-label'));

        this.lastLiveUpdate = 0;
        this.lastTime = '';
        this.lastProgress = -1;
        this.lastSeekable = '';
        this.lastLevels = new Float32Array(this.channels.length).fill(-1);
        this.lastAriaValues = new Int16Array(this.channels.length).fill(-1);
        this.lastActiveStates = new Int8Array(this.channels.length).fill(-1);
        this.seekHandler = null;

        if (this.progressBar) {
            let scrubbing = false;
            const seekAtEvent = (e) => {
                if (!this.seekHandler || this.progressBar.dataset.seekable !== 'true') return;
                const rect = this.progressBar.getBoundingClientRect();
                if (rect.width <= 0) return;
                const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
                this.seekHandler(ratio);
            };
            this.progressBar.addEventListener('pointerdown', (e) => {
                if (!this.seekHandler || this.progressBar.dataset.seekable !== 'true') return;
                if (e.pointerType === 'mouse' && e.button !== 0) return;
                e.stopPropagation();
                scrubbing = true;
                this.progressBar.setPointerCapture?.(e.pointerId);
                seekAtEvent(e);
            });
            this.progressBar.addEventListener('pointermove', (e) => {
                if (!scrubbing) return;
                seekAtEvent(e);
            });
            const endScrub = (e) => {
                if (!scrubbing) return;
                scrubbing = false;
                if (this.progressBar.hasPointerCapture?.(e.pointerId)) {
                    this.progressBar.releasePointerCapture?.(e.pointerId);
                }
            };
            this.progressBar.addEventListener('pointerup', endScrub);
            this.progressBar.addEventListener('pointercancel', endScrub);
        }
    }

    bindSeek(handler) {
        this.seekHandler = typeof handler === 'function' ? handler : null;
    }

    setField(name, value) {
        const element = this.fields[name];
        if (!element) return;
        const nextText = String(value ?? '');
        if (this.lastFieldValues[name] === nextText && element.textContent === nextText) return;
        this.lastFieldValues[name] = nextText;
        element.textContent = nextText;
        element.title = nextText;
    }

    updateTrack(model) {
        if (this.root && this.root.dataset.system !== model.system) {
            this.root.dataset.system = model.system;
        }
        for (const name of ['composer', 'release', 'subsong', 'format', 'hardware', 'next']) {
            this.setField(name, model[name]);
        }

        for (let index = 0; index < this.channels.length; index++) {
            const channel = this.channels[index];
            const label = model.channelLabels[index] || '';
            channel.hidden = !label;
            if (!label) {
                this.lastLevels[index] = -1;
                this.lastAriaValues[index] = -1;
                this.lastActiveStates[index] = -1;
                const fill = this.channelFills[index];
                if (fill) fill.style.transform = 'scaleX(0)';
                channel.setAttribute('aria-valuenow', '0');
                channel.dataset.active = 'false';
                continue;
            }
            const ariaLabel = `${label} live activity`;
            if (channel.getAttribute('aria-label') !== ariaLabel) {
                channel.setAttribute('aria-label', ariaLabel);
            }
            const labelElement = this.channelLabels[index];
            if (labelElement && labelElement.textContent !== label) {
                labelElement.textContent = label;
            }
        }
    }

    updateLive({ currentTime = '00:00', totalTime = '00:00', progress = 0, levels = [], playing = false, seekable = false }, force = false) {
        const now = performance.now();
        if (!force && now - this.lastLiveUpdate < 66) return;
        this.lastLiveUpdate = now;

        const nextSeekable = String(Boolean(seekable));
        if (this.progressBar && this.lastSeekable !== nextSeekable) {
            this.lastSeekable = nextSeekable;
            this.progressBar.dataset.seekable = nextSeekable;
        }

        const time = `${currentTime} / ${totalTime}`;
        if (time !== this.lastTime) {
            this.setField('time', time);
            this.lastTime = time;
        }

        const clampedProgress = Math.min(1, Math.max(0, Number(progress) || 0));
        if (this.progress && (Math.abs(clampedProgress - this.lastProgress) > 0.0005 || force)) {
            this.lastProgress = clampedProgress;
            this.progress.style.transform = `scaleX(${clampedProgress.toFixed(4)})`;
        }

        for (let index = 0; index < this.channels.length; index++) {
            const channel = this.channels[index];
            if (channel.hidden) continue;

            const rawLevel = playing ? Number(levels[index]) : 0;
            const level = Number.isFinite(rawLevel) ? Math.min(1, Math.max(0, rawLevel)) : 0;
            if (!force && Math.abs(level - this.lastLevels[index]) < 0.004) continue;
            this.lastLevels[index] = level;

            const fill = this.channelFills[index];
            if (fill) fill.style.transform = `scaleX(${level.toFixed(3)})`;

            const ariaPct = Math.round(level * 100);
            if (this.lastAriaValues[index] !== ariaPct) {
                this.lastAriaValues[index] = ariaPct;
                channel.setAttribute('aria-valuenow', String(ariaPct));
            }

            const activeFlag = level > 0.01 ? 1 : 0;
            if (this.lastActiveStates[index] !== activeFlag) {
                this.lastActiveStates[index] = activeFlag;
                channel.dataset.active = activeFlag ? 'true' : 'false';
            }
        }
    }
}