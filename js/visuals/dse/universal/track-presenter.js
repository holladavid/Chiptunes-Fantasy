// === js/visuals/dse/universal/track-presenter.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: TRACK PRESENTER (PLATFORM-SPECIFIC)
// v3.0.0 - Aliased bitmap typography, exact beat events and
// hardware-specific layout, palette and macro-state choreography.
// =========================================================

import { C64_PALETTE, rgbToHex, quantizeAmiga12Bit, quantizeAtari9Bit, drawAliasedLine } from '../../utils/hardware-constraints.js';

const TWO_PI = Math.PI * 2;

// 5x7 bitmap font. Every pixel is an opaque integer rectangle; Canvas text
// anti-aliasing never enters any of the three hardware renderers.
const GLYPHS = {
    ' ': [0, 0, 0, 0, 0, 0, 0],
    'A': [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
    'B': [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
    'C': [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
    'D': [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
    'E': [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
    'F': [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
    'G': [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
    'H': [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
    'I': [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
    'J': [0x07, 0x02, 0x02, 0x02, 0x12, 0x12, 0x0c],
    'K': [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
    'L': [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
    'M': [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
    'N': [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
    'O': [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
    'P': [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
    'Q': [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
    'R': [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
    'S': [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
    'T': [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
    'U': [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
    'V': [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
    'W': [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
    'X': [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
    'Y': [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
    'Z': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
    '0': [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
    '1': [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
    '2': [0x0e, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1f],
    '3': [0x1e, 0x01, 0x01, 0x0e, 0x01, 0x01, 0x1e],
    '4': [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
    '5': [0x1f, 0x10, 0x10, 0x1e, 0x01, 0x01, 0x1e],
    '6': [0x0e, 0x10, 0x10, 0x1e, 0x11, 0x11, 0x0e],
    '7': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
    '8': [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
    '9': [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x01, 0x0e],
    '.': [0, 0, 0, 0, 0, 0x0c, 0x0c],
    ',': [0, 0, 0, 0, 0x0c, 0x04, 0x08],
    ':': [0, 0x0c, 0x0c, 0, 0x0c, 0x0c, 0],
    ';': [0, 0x0c, 0x0c, 0, 0x0c, 0x04, 0x08],
    '!': [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04],
    '?': [0x0e, 0x11, 0x01, 0x02, 0x04, 0, 0x04],
    '-': [0, 0, 0, 0x1f, 0, 0, 0],
    '_': [0, 0, 0, 0, 0, 0, 0x1f],
    '+': [0, 0x04, 0x04, 0x1f, 0x04, 0x04, 0],
    '=': [0, 0, 0x1f, 0, 0x1f, 0, 0],
    '/': [0x01, 0x01, 0x02, 0x04, 0x08, 0x10, 0x10],
    '\\': [0x10, 0x10, 0x08, 0x04, 0x02, 0x01, 0x01],
    '(': [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
    ')': [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
    '[': [0x0e, 0x08, 0x08, 0x08, 0x08, 0x08, 0x0e],
    ']': [0x0e, 0x02, 0x02, 0x02, 0x02, 0x02, 0x0e],
    '<': [0x02, 0x04, 0x08, 0x10, 0x08, 0x04, 0x02],
    '>': [0x08, 0x04, 0x02, 0x01, 0x02, 0x04, 0x08],
    '*': [0, 0x15, 0x0e, 0x1f, 0x0e, 0x15, 0],
    '#': [0x0a, 0x1f, 0x0a, 0x0a, 0x1f, 0x0a, 0],
    '%': [0x19, 0x19, 0x02, 0x04, 0x08, 0x13, 0x13],
    '&': [0x0c, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0d],
    '@': [0x0e, 0x11, 0x17, 0x15, 0x17, 0x10, 0x0e],
    "'": [0x04, 0x04, 0x08, 0, 0, 0, 0],
    '"': [0x0a, 0x0a, 0x0a, 0, 0, 0, 0],
    '•': [0, 0, 0x04, 0x0e, 0x04, 0, 0]
};

function normalizeText(value, fallback) {
    return String(value || fallback)
        .replace(/[–—]/g, '-')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase();
}

function measurePixelText(text, scale = 1) {
    if (!text.length) return 0;
    return (text.length * 6 - 1) * scale;
}

function truncatePixelText(text, maxWidth, scale = 1) {
    if (measurePixelText(text, scale) <= maxWidth) return text;
    let result = text;
    while (result.length > 1 && measurePixelText(result + '...', scale) > maxWidth) {
        result = result.slice(0, -1);
    }
    return measurePixelText('...', scale) <= maxWidth ? result + '...' : '';
}

function drawPixelText(ctx, text, x, y, scale, color, align = 'center') {
    const textWidth = measurePixelText(text, scale);
    let startX = Math.floor(x - textWidth / 2);
    if (align === 'left') startX = Math.floor(x);
    else if (align === 'right') startX = Math.floor(x - textWidth);
    const startY = Math.floor(y - (7 * scale) / 2);
    ctx.fillStyle = color;

    for (let charIndex = 0; charIndex < text.length; charIndex++) {
        const glyph = GLYPHS[text[charIndex]] || GLYPHS['?'];
        const glyphX = startX + charIndex * 6 * scale;
        for (let row = 0; row < 7; row++) {
            for (let column = 0; column < 5; column++) {
                if (glyph[row] & (1 << (4 - column))) {
                    ctx.fillRect(glyphX + column * scale, startY + row * scale, scale, scale);
                }
            }
        }
    }
}

function drawTitle(ctx, title, left, center, right, y, maxWidth, scale, color,
    layout, time, scrollSpeed, nudgeX = 0) {
    const textWidth = measurePixelText(title, scale);
    if (textWidth > maxWidth) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(left, y - 5 * scale, maxWidth, 10 * scale);
        ctx.clip();
        const span = textWidth + maxWidth + 30 * scale;
        const scrollX = (time * scrollSpeed) % span;
        drawPixelText(ctx, title, right - scrollX, y, scale, color, 'left');
        ctx.restore();
        return;
    }

    const align = layout === 1 ? 'left' : layout === 2 ? 'right' : 'center';
    const anchor = layout === 1 ? left : layout === 2 ? right : center;
    drawPixelText(ctx, title, anchor + nudgeX, y, scale, color, align);
}

export class TrackPresenter {
    constructor() {
        this.name = 'Universal Track Presenter';
        this.trackInfo = null;
        this.sinLUT = new Float32Array(256);
        for (let i = 0; i < 256; i++) this.sinLUT[i] = Math.sin(i / 256 * TWO_PI);

        this.lastState = 'idle';
        this.stateAge = 0;
        this.lastT = 0;
        this.internalT = 0;
        this.layout = 0;
        this.palettePhase = 0;
        this.lastBeatCount = 0;
        this.beatDirection = 1;

        const c64 = rows => rows.map(index => rgbToHex(...C64_PALETTE[index]));
        this.c64Themes = [
            c64([6, 6, 14, 14, 12, 1, 12, 14, 14, 6, 6]),
            c64([9, 2, 2, 8, 10, 1, 10, 8, 2, 2, 9]),
            c64([5, 5, 12, 13, 13, 1, 13, 13, 12, 5, 5])
        ];
        this.c64Afterglow = c64([6, 6, 6, 11, 11, 12, 11, 11, 6, 6, 6]);

        const amiga = rows => rows.map(color => rgbToHex(...quantizeAmiga12Bit(...color)));
        this.amigaThemes = [
            amiga([[0, 0, 34], [0, 0, 68], [85, 0, 85], [170, 0, 85], [255, 102, 0], [255, 255, 255]]),
            amiga([[0, 0, 34], [0, 0, 85], [0, 68, 170], [0, 136, 255], [0, 255, 255], [255, 255, 255]]),
            amiga([[34, 0, 0], [85, 0, 0], [170, 34, 0], [255, 85, 0], [255, 170, 0], [255, 255, 255]]),
            amiga([[0, 34, 0], [0, 85, 34], [0, 170, 68], [0, 255, 136], [136, 255, 136], [255, 255, 255]])
        ];
        this.amigaAfterglow = amiga([[0, 0, 17], [0, 0, 34], [0, 0, 68], [0, 34, 85], [0, 68, 136], [0, 136, 204]]);

        const atari = (border, accent) => ({
            border: rgbToHex(...quantizeAtari9Bit(...border)),
            accent: rgbToHex(...quantizeAtari9Bit(...accent))
        });
        this.atariThemes = [
            atari([0, 170, 0], [255, 136, 0]),
            atari([0, 170, 170], [0, 255, 255]),
            atari([170, 170, 0], [255, 255, 0]),
            atari([170, 85, 0], [255, 170, 85])
        ];
        this.atariAfterglow = atari([0, 72, 144], [108, 180, 216]);
    }

    setTrackInfo(info) {
        this.trackInfo = info;
        this.lastState = 'idle';
        this.stateAge = 0;
        this.lastT = 0;
        this.layout = 0;
        this.palettePhase = 0;
        this.lastBeatCount = 0;
    }

    resize(width, height) {}

    render(ctx, width, height, t, state, stateTime, metrics) {
        if (!this.trackInfo || width <= 0 || height <= 0 || !isFinite(width / height)) return;
        if (state === 'idle') {
            this.lastT = t;
            this.lastState = state;
            return;
        }

        const displayTime = this.metadata ? this.metadata.duration : 5.0;
        if (state !== 'starting' && state !== 'stopping' && stateTime > displayTime && !this._markedForRemoval) {
            this._markedForRemoval = true;
        }

        const dt = this.lastT === 0 ? 0.02 : Math.max(0, Math.min(0.1, t - this.lastT));
        this.lastT = t;
        if (this.lastState !== state) {
            this.lastState = state;
            this.stateAge = 0;
        } else {
            this.stateAge += dt;
        }

        if (metrics.beatStarted) {
            const count = Number.isFinite(metrics.beatCount)
                ? metrics.beatCount
                : this.lastBeatCount + 1;
            this.lastBeatCount = count;
            this.palettePhase = count & 3;
            this.beatDirection = (count & 1) ? 1 : -1;
            if (count > 0 && count % 4 === 0) this.layout = (this.layout + 1) % 3;
        }

        const beat = metrics.beat?.[0] || 0;
        const smooth = metrics.smooth || [];
        const fallbackTension = state === 'afterglow' ? Math.max(0, 1 - this.stateAge / 5) : 0.5;
        const tension = Math.max(0, Math.min(1,
            Number.isFinite(metrics.tensionPct) ? metrics.tensionPct : fallbackTension));

        let motionSpeed = 1;
        let motionAmp = 0.55;
        let scrollSpeed = 45;
        if (state === 'buildup') {
            motionSpeed = 1.35;
            motionAmp = 1;
            scrollSpeed = 62;
        } else if (state === 'climax') {
            motionSpeed = 1.9;
            motionAmp = 1.55;
            scrollSpeed = 82;
        } else if (state === 'afterglow') {
            motionSpeed = 0.2 + tension * 0.35;
            motionAmp = 0.25 + tension * 0.45;
            scrollSpeed = 18 + tension * 20;
        }
        this.internalT += dt * motionSpeed;

        const tQuant = Math.floor(stateTime * 15);
        const progress = Math.min(1, tQuant / 15);
        const ease = (1 - Math.cos(progress * Math.PI)) * 0.5;
        const horizon = Math.floor(height * 0.55);
        const cx = Math.floor(width / 2);
        const isPortrait = width < height;
        const isUltraNarrow = width < 160;
        const titleScale = isUltraNarrow ? 1 : 2;

        const titleText = normalizeText(this.trackInfo.name, 'UNKNOWN');
        const authorText = normalizeText(`BY ${this.trackInfo.author || 'UNKNOWN'}`, 'BY UNKNOWN');
        const typeText = normalizeText(this.trackInfo.type, 'RAW DATA');
        const panelNudge = state === 'climax' ? Math.round(beat * 2)
            : state === 'buildup' ? Math.round(beat) : 0;
        const titleNudge = state === 'climax' ? Math.round(beat) * this.beatDirection : 0;

        if (metrics.system === 'c64') {
            const barH = 55;
            const targetY = Math.floor(horizon * 0.28);
            const marginX = Math.max(12, Math.floor(width * 0.08));
            const boxW = width - marginX * 2;
            let currentY = targetY;
            if (state === 'starting') {
                currentY = Math.floor(-barH - 10 + (targetY + barH + 10) * ease);
            } else if (state === 'stopping') {
                currentY = Math.floor(targetY + (-barH - 10 - targetY) * ease);
            } else {
                currentY += panelNudge;
            }

            const rasterColors = state === 'afterglow'
                ? this.c64Afterglow
                : this.c64Themes[this.palettePhase % this.c64Themes.length];
            const bandH = 5;
            for (let i = 0; i < rasterColors.length; i++) {
                const direction = this.layout === 1 && (i & 1) ? -1 : 1;
                const phase = (Math.floor(this.internalT * 48) + i * (this.layout === 2 ? 11 : 6)) & 255;
                const channel = smooth[i % 3] || 0;
                const amplitude = (0.8 + channel * 2.2) * motionAmp;
                let wobbleX = Math.round(this.sinLUT[phase] * amplitude) * direction;
                if (this.layout === 2) wobbleX = Math.round(wobbleX / 2) * 2;
                ctx.fillStyle = rasterColors[i];
                ctx.fillRect(marginX + wobbleX, currentY + i * bandH, boxW, bandH);
            }

            const left = marginX + 8;
            const right = marginX + boxW - 8;
            const maxTextW = boxW - 16;
            const titleColor = rgbToHex(...C64_PALETTE[0]);
            drawTitle(ctx, titleText, left, cx, right, currentY + 18, maxTextW,
                titleScale, titleColor, this.layout, t, scrollSpeed, titleNudge);

            const currentSubsong = this.trackInfo.currentSubsong || this.trackInfo.startSong || 1;
            const subtracks = this.trackInfo.songs ? ` • SUB ${currentSubsong}/${this.trackInfo.songs}` : '';
            const subtitle = truncatePixelText(authorText + subtracks, maxTextW, 1);
            drawPixelText(ctx, subtitle, cx, currentY + 38, 1,
                rgbToHex(...C64_PALETTE[state === 'afterglow' ? 14 : 6]));
        } else if (metrics.system === 'amiga') {
            const paneH = 44 + (this.layout === 2 ? 4 : 0);
            const targetY = Math.floor(horizon * 0.38);
            const copLineH = 4;
            const curtainH = 24;
            let topY = targetY;
            let botY = targetY + paneH;
            if (state === 'starting') {
                topY = Math.floor(-curtainH + (targetY + curtainH) * ease);
                botY = Math.floor(height - (height - targetY - paneH) * ease);
            } else if (state === 'stopping') {
                topY = Math.floor(targetY + (-curtainH - targetY) * ease);
                botY = Math.floor(targetY + paneH + (height - targetY - paneH) * ease);
            } else {
                topY += panelNudge;
                botY -= panelNudge;
            }

            const copColors = state === 'afterglow'
                ? this.amigaAfterglow
                : this.amigaThemes[this.palettePhase];
            for (let i = 0; i < copColors.length; i++) {
                ctx.fillStyle = copColors[i];
                ctx.fillRect(0, Math.floor(topY - curtainH + i * copLineH), width, copLineH);
                ctx.fillStyle = copColors[copColors.length - 1 - i];
                ctx.fillRect(0, Math.floor(botY + i * copLineH), width, copLineH);
            }

            ctx.fillStyle = rgbToHex(...quantizeAmiga12Bit(0, 0, state === 'afterglow' ? 17 : 34));
            ctx.fillRect(0, Math.floor(topY), width, Math.max(1, Math.floor(botY - topY)));

            const left = 10;
            const right = width - 10;
            const maxTextW = width - 20;
            const textY1 = Math.floor(topY + (botY - topY) * 0.32);
            const textY2 = Math.floor(topY + (botY - topY) * 0.68);
            drawTitle(ctx, titleText, left, cx, right, textY1, maxTextW,
                titleScale, copColors[4], this.layout, t, scrollSpeed + 5, titleNudge);
            const subtitle = truncatePixelText(`${authorText} • ${typeText}`, maxTextW, 1);
            const align = this.layout === 1 ? 'left' : this.layout === 2 ? 'right' : 'center';
            const anchor = this.layout === 1 ? left : this.layout === 2 ? right : cx;
            drawPixelText(ctx, subtitle, anchor, textY2, 1, copColors[5], align);
        } else {
            const boxW = Math.min(Math.floor(width * (isPortrait ? 0.94 : 0.85)), 280);
            const boxH = 50;
            const boxX = Math.floor((width - boxW) / 2);
            const targetY = Math.floor(horizon * 0.25);
            let currentY = targetY;
            if (state === 'starting') {
                currentY = Math.floor(-boxH - 10 + (targetY + boxH + 10) * ease);
            } else if (state === 'stopping') {
                currentY = Math.floor(targetY + (-boxH - 10 - targetY) * ease);
            } else {
                currentY += panelNudge;
            }

            const theme = state === 'afterglow' ? this.atariAfterglow : this.atariThemes[this.palettePhase];
            const bgHex = state === 'afterglow'
                ? rgbToHex(...quantizeAtari9Bit(0, 0, 36))
                : rgbToHex(...quantizeAtari9Bit(17, 34, 17));
            const textHex = state === 'afterglow'
                ? rgbToHex(...quantizeAtari9Bit(108, 180, 216))
                : rgbToHex(...quantizeAtari9Bit(255, 255, 255));

            ctx.fillStyle = bgHex;
            ctx.fillRect(boxX, currentY, boxW, boxH);
            drawAliasedLine(ctx, boxX, currentY, boxX + boxW, currentY, theme.border);
            drawAliasedLine(ctx, boxX, currentY + boxH, boxX + boxW, currentY + boxH, theme.border);
            drawAliasedLine(ctx, boxX, currentY, boxX, currentY + boxH, theme.border);
            drawAliasedLine(ctx, boxX + boxW, currentY, boxX + boxW, currentY + boxH, theme.border);
            if (state === 'climax') {
                drawAliasedLine(ctx, boxX + 2, currentY + 2, boxX + boxW - 2, currentY + 2, theme.accent);
                drawAliasedLine(ctx, boxX + 2, currentY + boxH - 2, boxX + boxW - 2, currentY + boxH - 2, theme.accent);
            }

            const corner = 2 + this.layout + Math.round((smooth[0] || 0) * 2);
            drawAliasedLine(ctx, boxX - corner, currentY - corner, boxX + corner, currentY + corner, theme.border);
            drawAliasedLine(ctx, boxX + boxW - corner, currentY - corner, boxX + boxW + corner, currentY + corner, theme.border);
            drawAliasedLine(ctx, boxX - corner, currentY + boxH - corner, boxX + corner, currentY + boxH + corner, theme.border);
            drawAliasedLine(ctx, boxX + boxW - corner, currentY + boxH - corner,
                boxX + boxW + corner, currentY + boxH + corner, theme.border);

            const left = boxX + 8;
            const right = boxX + boxW - 8;
            const maxTextW = boxW - 16;
            drawTitle(ctx, titleText, left, cx, right, currentY + 16, maxTextW,
                titleScale, theme.accent, this.layout, t, scrollSpeed, titleNudge);
            const subtitle = truncatePixelText(`${authorText} • ${typeText}`, maxTextW, 1);
            const align = this.layout === 1 ? 'left' : this.layout === 2 ? 'right' : 'center';
            const anchor = this.layout === 1 ? left : this.layout === 2 ? right : cx;
            drawPixelText(ctx, subtitle, anchor, currentY + 37, 1, textHex, align);
        }

        ctx.globalAlpha = 1.0;
    }
}
