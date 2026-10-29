// === js/visuals/scroller.js ===
// Adaptive, restrained 50 Hz-inspired text scroller.
// Track, technology and museum channels share the production metadata model.

const SEPARATOR = '   +++   ';
const baseGreets = "AT LAST, THE ULTIMATE HTML5 MUSIC DISK IS COMPLETE +++ CODE & DSP MAGIK RUNNING AT A SOLID 50 HZ VBLANK +++ DEEP CHIP EMULATION VIA AUDIOWORKLETS +++ NO MP3, NO BULLSHIT, JUST PURE MATHEMATICS +++ GREETS FLY OUT TO ALL THE PIXEL PUSHERS, CYCLE CRUNCHERS AND WAVEFORM WIZARDS OUT THERE +++ TO EVERYONE WHO STILL KEEPS THE SPIRIT OF THE 8-BIT AND 16-BIT ERA ALIVE +++ TO THE TRUE LOVERS OF DEMOSCENE ART AND CHIPTUNE MAGIC +++ LET THE ANALOG FILTERS BURN +++ WRAP AROUND";
const systemLabels = { c64: 'C64 / MOS 6581 SID', amiga: 'AMIGA / MOS 8364 PAULA', atari: 'ATARI ST / YM2149F' };
const channelNames = ['track', 'tech', 'story'];

function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function decodeEntities(text) {
    const entities = {
        amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
        ndash: '–', mdash: '—', hellip: '…', auml: 'ä', ouml: 'ö',
        uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß'
    };
    return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code) => {
        if (code[0] === '#') {
            const radix = code[1]?.toLowerCase() === 'x' ? 16 : 10;
            const value = Number.parseInt(code.slice(radix === 16 ? 2 : 1), radix);
            return Number.isFinite(value) ? String.fromCodePoint(value) : entity;
        }
        return entities[code] ?? entities[code.toLowerCase()] ?? entity;
    });
}

export function htmlToPlainText(html) {
    return cleanText(decodeEntities(String(html || '')
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<\/(?:p|div|h[1-6]|li|details)>/gi, ' ')
        .replace(/<[^>]*>/g, ' ')));
}

function truncateAtWord(text, maximum = 420) {
    if (text.length <= maximum) return text;
    const excerpt = text.slice(0, maximum + 1);
    return `${excerpt.slice(0, excerpt.lastIndexOf(' ')).trim()} …`;
}

function museumStory(html) {
    const text = htmlToPlainText(html).split(/Quellen\s*:/i)[0].trim();
    const history = text.match(/Historie\s*:\s*(.*?)(?=Datei\s*&\s*Replay\s*:|$)/i)?.[1] || text;
    const sentences = history.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [history];
    return truncateAtWord(sentences.slice(0, 2).join(' ').trim());
}

function optional(value) {
    const text = cleanText(value);
    return text && !/^(?:(?:unknown|unbekannt)\b|none$|n\/?a$|-+$)/i.test(text) ? text : '';
}

function number(value) {
    return Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : 0;
}

function trackTechnology(system, metadata, core, loaded) {
    if (!loaded) return `${systemLabels[system] || system} / READING BINARY METADATA`;
    if (!metadata) return `${systemLabels[system] || system} / LIVE SYNTHESIS · NO PRERECORDED AUDIO`;

    if (system === 'amiga') {
        const details = [optional(metadata.type) || 'REPLAY', '4 DMA VOICES'];
        if (number(metadata.patternCount)) details.push(`${number(metadata.patternCount)} PATTERNS`);
        if (number(metadata.instrumentCount)) details.push(`${number(metadata.instrumentCount)} SAMPLES`);
        if (number(metadata.fileSize)) details.push(`${Math.floor(number(metadata.fileSize) / 1024)} KB`);
        if (optional(core)) details.push(optional(core));
        return `PAULA TECH / ${details.join(' · ')}`;
    }
    if (system === 'c64') {
        const details = [optional(metadata.type) || 'SID REPLAY'];
        if (optional(metadata.loadAddress)) details.push(`LOAD ${optional(metadata.loadAddress)}`);
        if (optional(metadata.playAddress)) details.push(`PLAY ${optional(metadata.playAddress)}`);
        if (number(metadata.songs)) details.push(`${number(metadata.songs)} SUBSONGS`);
        if (optional(core)) details.push(optional(core));
        return `SID TECH / ${details.join(' · ')}`;
    }
    const details = [optional(metadata.type) || 'YM REGISTER DUMP', '3 PSG VOICES'];
    if (number(metadata.playerRate)) details.push(`${number(metadata.playerRate)} HZ`);
    if (number(metadata.masterClock)) details.push(`${(number(metadata.masterClock) / 1000000).toFixed(2)} MHZ`);
    details.push(`${number(metadata.digidrumCount)} DIGIDRUMS`);
    if (optional(core)) details.push(optional(core));
    return `YM TECH / ${details.join(' · ')}`;
}

export function buildScrollerContent({
    system = 'c64', song = null, metadata = null, currentSubsong = 1,
    core = '', fallbackText = '', loaded = false
} = {}) {
    const fallback = cleanText(fallbackText).replace(/^\+{3}|\+{3}$/g, '').trim() || 'SYSTEM READY';
    if (!song) return { track: fallback, tech: fallback, story: fallback };

    const title = optional(song.listTitle) || optional(metadata?.name) || optional(song.title) || 'UNTITLED TRACK';
    if (!loaded) return {
        track: `${fallback} · ${title}`,
        tech: trackTechnology(system, metadata, core, false),
        story: museumStory(song.composerInfo) || `${title} · ${optional(song.path)}`
    };

    const artist = optional(metadata?.author) || optional(song.composer);
    const songs = number(metadata?.songs);
    const trackParts = [`NOW PLAYING / ${title}`];
    if (artist) trackParts.push(artist);
    if (songs > 1) trackParts.push(`SUB ${currentSubsong} / ${songs}`);
    trackParts.push(systemLabels[system] || system);

    const story = museumStory(song.composerInfo);
    return {
        track: trackParts.join(' · '),
        tech: trackTechnology(system, metadata, core, true),
        story: story ? `FROM THE MUSEUM / ${story}` :
            `ARCHIVE / ${optional(song.path) || title} · SYNTHESIZED LIVE FROM THE ORIGINAL BINARY · NO PRERECORDED AUDIO`
    };
}

export function advanceScrollerOffset(offset, deltaSeconds, unitWidth, viewportWidth, speed = 52) {
    if (unitWidth <= 0 || viewportWidth <= 0 || deltaSeconds <= 0) return offset;
    let next = offset + Math.min(deltaSeconds, 0.05) * speed;
    const wrapAt = unitWidth + viewportWidth;
    if (next >= wrapAt) next = (next - wrapAt) % unitWidth + viewportWidth;
    return next;
}

export function initScroller(getScrollerText, getEcoMode, getScrollerContext = () => ({})) {
    const canvas = document.getElementById('scroller-canvas');
    const zone = document.getElementById('scroller-zone');
    if (!canvas || !zone) {
        console.warn('[SCROLLER] Canvas-Element #scroller-canvas nicht gefunden.');
        return;
    }

    const ctx = canvas.getContext('2d', { alpha: false });
    const modeButtons = [...zone.querySelectorAll('[data-scroller-mode]')];
    const toggle = document.getElementById('scroller-toggle');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let dpr = window.devicePixelRatio || 1;
    let mode = 'track';
    let userPaused = reducedMotion.matches;
    let hoverPaused = false;
    let offset = 0;
    let phase = 0;
    let lastText = '';
    let lastSignature = '';
    let content = { track: '', tech: '', story: '' };
    let previousTime = performance.now();

    function resizeCanvas() {
        dpr = window.devicePixelRatio || 1;
        const width = Math.max(1, canvas.clientWidth);
        const height = Math.max(1, canvas.clientHeight);
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.imageSmoothingEnabled = false;
    }

    function isPaused() {
        return userPaused || hoverPaused;
    }

    function syncPauseUI() {
        zone.dataset.paused = String(isPaused());
        if (!toggle) return;
        toggle.textContent = userPaused ? 'RUN' : 'HOLD';
        toggle.setAttribute('aria-pressed', String(userPaused));
        toggle.setAttribute('aria-label', userPaused ? 'Lauftext fortsetzen' : 'Lauftext anhalten');
        toggle.title = userPaused ? 'Lauftext fortsetzen' : 'Lauftext anhalten';
    }

    function setMode(nextMode) {
        if (!channelNames.includes(nextMode)) return;
        mode = nextMode;
        zone.dataset.scrollerMode = mode;
        for (const button of modeButtons) {
            button.setAttribute('aria-pressed', String(button.dataset.scrollerMode === mode));
        }
        lastText = '';
    }

    for (const button of modeButtons) {
        button.addEventListener('click', () => setMode(button.dataset.scrollerMode));
    }
    toggle?.addEventListener('click', () => {
        userPaused = !userPaused;
        hoverPaused = false;
        syncPauseUI();
    });
    zone.addEventListener('pointerenter', event => {
        if (event.pointerType === 'touch') return;
        hoverPaused = true;
        syncPauseUI();
    });
    zone.addEventListener('pointerleave', () => {
        hoverPaused = false;
        syncPauseUI();
    });
    reducedMotion.addEventListener('change', event => {
        userPaused = event.matches;
        syncPauseUI();
    });
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    setMode('track');
    syncPauseUI();

    function updateContent() {
        const context = getScrollerContext() || {};
        const metadata = context.metadata;
        const signature = JSON.stringify([
            getScrollerText(), context.system, context.song?.path, context.song?.listTitle,
            context.song?.title, context.loaded, context.currentSubsong, context.core,
            metadata?.name, metadata?.type, metadata?.songs, metadata?.patternCount
        ]);
        if (signature !== lastSignature) {
            content = buildScrollerContent({ ...context, fallbackText: getScrollerText() });
            lastSignature = signature;
        }
        return content[mode] || content.track;
    }

    function draw(now) {
        const deltaSeconds = Math.max(0, (now - previousTime) / 1000);
        previousTime = now;
        if (getEcoMode()) {
            requestAnimationFrame(draw);
            return;
        }

        const cssWidth = canvas.width / dpr;
        const cssHeight = canvas.height / dpr;
        const isAmiga = document.body.classList.contains('theme-amiga');
        const isAtari = document.body.classList.contains('theme-atari');
        const currentText = updateContent();
        if (currentText !== lastText) {
            // New content starts at the left edge instead of leaving a long empty lead-in.
            offset = cssWidth;
            phase = 0;
            lastText = currentText;
            const accessible = mode === 'track' ? `${currentText} ${SEPARATOR} ${baseGreets}` : currentText;
            canvas.setAttribute('aria-label', accessible);
            const liveText = document.getElementById('scroller-accessible-text');
            if (liveText) liveText.textContent = accessible;
        }

        const fontSize = Math.max(12, Math.min(isAmiga || isAtari ? 28 : 18,
            cssHeight * (isAmiga || isAtari ? 0.62 : 0.34)));
        ctx.fillStyle = '#0e0e0e';
        ctx.fillRect(0, 0, cssWidth, cssHeight);
        ctx.font = `${fontSize}px ${isAmiga || isAtari ? "'VT323'" : "'Press Start 2P'"}, monospace`;
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'transparent';
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.shadowBlur = 0;

        const scrollUnit = `${currentText}${SEPARATOR}${mode === 'track' ? `${baseGreets}${SEPARATOR}` : ''}`;
        const charWidth = ctx.measureText('M').width || fontSize;
        const unitWidth = charWidth * scrollUnit.length;
        if (!isPaused()) {
            offset = advanceScrollerOffset(offset, deltaSeconds, unitWidth, cssWidth);
            phase += Math.min(deltaSeconds, 0.05);
        }

        const accent = getComputedStyle(document.body).getPropertyValue('--bus-active-color').trim() || '#f8f8f8';
        const startX = cssWidth - offset;
        const copies = Math.ceil((cssWidth + unitWidth - startX) / unitWidth) + 1;
        const amplitude = Math.min(4, cssHeight * 0.07);
        for (let copy = 0; copy < copies; copy++) {
            const copyX = startX + copy * unitWidth;
            for (let index = 0; index < scrollUnit.length; index++) {
                const x = copyX + index * charWidth;
                if (x < -charWidth || x > cssWidth + charWidth) continue;
                const wave = Math.sin(x * 0.009 + phase * 1.35) * amplitude +
                    Math.cos(x * 0.017 + phase * 0.8) * amplitude * 0.35;
                const y = cssHeight / 2 + wave;
                ctx.globalAlpha = 0.22;
                ctx.fillStyle = accent;
                ctx.fillText(scrollUnit[index], x, y + 1);
                ctx.globalAlpha = 1;
                ctx.fillStyle = '#f8f8f8';
                ctx.fillText(scrollUnit[index], x, y);
            }
        }
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = accent;
        ctx.fillRect(0, cssHeight - 1, cssWidth, 1);
        ctx.globalAlpha = 1;
        requestAnimationFrame(draw);
    }

    requestAnimationFrame(draw);
}
