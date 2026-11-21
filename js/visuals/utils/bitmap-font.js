// === js/visuals/utils/bitmap-font.js ===
// =========================================================
// ALIASED 5x7 BITMAP FONT & PRECOMPUTED GLYPH RUNS
// Extrahiert aus track-presenter.js (zero behavior change) +
// vorberechnete Spalten-/Zeilenläufe für C64SineScroller.
// =========================================================

export const GLYPH_WIDTH = 5;
export const GLYPH_HEIGHT = 7;
export const GLYPH_STEP = 6;

export const GLYPHS = Object.freeze({
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
});

// Vorberechnete Spalten- & Zeilenläufe je Zeichen (zero per-frame allocations)
export const GLYPH_COL_RUNS = Object.freeze((() => {
    const map = Object.create(null);
    for (const [ch, rows] of Object.entries(GLYPHS)) {
        const cols = new Array(GLYPH_WIDTH);
        for (let col = 0; col < GLYPH_WIDTH; col++) {
            const bit = 1 << (4 - col);
            const runs = [];
            let runStart = -1;
            for (let row = 0; row <= GLYPH_HEIGHT; row++) {
                const on = row < GLYPH_HEIGHT && (rows[row] & bit) !== 0;
                if (on) {
                    if (runStart === -1) runStart = row;
                } else if (runStart !== -1) {
                    runs.push(Object.freeze({ start: runStart, len: row - runStart }));
                    runStart = -1;
                }
            }
            cols[col] = Object.freeze(runs);
        }
        map[ch] = Object.freeze(cols);
    }
    return map;
})());

export const GLYPH_ROW_RUNS = Object.freeze((() => {
    const map = Object.create(null);
    for (const [ch, rows] of Object.entries(GLYPHS)) {
        const rowRuns = new Array(GLYPH_HEIGHT);
        for (let row = 0; row < GLYPH_HEIGHT; row++) {
            const runs = [];
            let runStart = -1;
            for (let col = 0; col <= GLYPH_WIDTH; col++) {
                const on = col < GLYPH_WIDTH && (rows[row] & (1 << (4 - col))) !== 0;
                if (on) {
                    if (runStart === -1) runStart = col;
                } else if (runStart !== -1) {
                    runs.push(Object.freeze({ start: runStart, len: col - runStart }));
                    runStart = -1;
                }
            }
            rowRuns[row] = Object.freeze(runs);
        }
        map[ch] = Object.freeze(rowRuns);
    }
    return map;
})());

export function getGlyphColRuns(ch) {
    return GLYPH_COL_RUNS[ch] || GLYPH_COL_RUNS['?'];
}

export function getGlyphRowRuns(ch) {
    return GLYPH_ROW_RUNS[ch] || GLYPH_ROW_RUNS['?'];
}

export function normalizeText(value, fallback) {
    return String(value || fallback)
        .replace(/[–—]/g, '-')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase();
}

export function measurePixelText(text, scale = 1) {
    if (!text.length) return 0;
    return (text.length * 6 - 1) * scale;
}

export function truncatePixelText(text, maxWidth, scale = 1) {
    if (measurePixelText(text, scale) <= maxWidth) return text;
    let result = text;
    while (result.length > 1 && measurePixelText(result + '...', scale) > maxWidth) {
        result = result.slice(0, -1);
    }
    return measurePixelText('...', scale) <= maxWidth ? result + '...' : '';
}

export function drawPixelText(ctx, text, x, y, scale, color, align = 'center') {
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

export function drawBitmapRun(ctx, text, x, y, scale, color, align = 'left') {
    if (!ctx || !text || !text.length) return;
    const textWidth = measurePixelText(text, scale);
    let startX = Math.floor(x);
    if (align === 'center') startX = Math.floor(x - textWidth / 2);
    else if (align === 'right') startX = Math.floor(x - textWidth);
    const startY = Math.floor(y);
    ctx.fillStyle = color;

    for (let charIndex = 0; charIndex < text.length; charIndex++) {
        const rowRuns = getGlyphRowRuns(text[charIndex]);
        const glyphX = startX + charIndex * GLYPH_STEP * scale;
        for (let row = 0; row < GLYPH_HEIGHT; row++) {
            const runs = rowRuns[row];
            const py = startY + row * scale;
            for (let r = 0; r < runs.length; r++) {
                const run = runs[r];
                ctx.fillRect(glyphX + run.start * scale, py, run.len * scale, scale);
            }
        }
    }
}