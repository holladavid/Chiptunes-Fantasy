// === js/visuals/utils/hardware-constraints.js ===
// =========================================================
// HARDWARE VIDEO CHIP CONSTRAINTS & PALETTES
// Single Source of Truth für historische Farbtiefen.
// =========================================================

// Die authentische 16-Farben VIC-II Palette (Colodore matched)
export const C64_PALETTE = [
    [0, 0, 0], [255, 255, 255], [139, 73, 67], [123, 191, 199],
    [139, 69, 171], [104, 169, 65], [53, 40, 121], [255, 255, 51],
    [221, 139, 69], [92, 71, 0], [255, 138, 138], [51, 51, 51],
    [119, 119, 119], [170, 255, 102], [108, 94, 181], [181, 181, 181]
];

export function rgbToHex(r, g, b) {
    return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1);
}

export function getNearestC64Color(r, g, b) {
    let minDist = Infinity;
    let bestColor = C64_PALETTE[0];
    for (let i = 0; i < 16; i++) {
        let c = C64_PALETTE[i];
        let dist = (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2;
        if (dist < minDist) {
            minDist = dist;
            bestColor = c;
        }
    }
    return bestColor;
}

export function quantizeAmiga12Bit(r, g, b) {
    return [
        Math.round(r / 255 * 15) * 17,
        Math.round(g / 255 * 15) * 17,
        Math.round(b / 255 * 15) * 17
    ];
}

export function quantizeAtari9Bit(r, g, b) {
    return [
        Math.round(r / 255 * 7) * 36,
        Math.round(g / 255 * 7) * 36,
        Math.round(b / 255 * 7) * 36
    ];
}

export const SYSTEM_RESOLUTIONS = {
    'c64': 200,    
    'atari': 200,  
    'amiga': 256   
};

// Ein-/Ausblendungen bleiben als ordered Dither vollstaendig in der
// Systempalette. CanvasPatterns vermeiden zehntausende Einzelpixel-Aufrufe.
const ORDERED_FADE_MATRIX = [
     0,  8,  2, 10,
    12,  4, 14,  6,
     3, 11,  1,  9,
    15,  7, 13,  5
];
const ORDERED_FADE_PATTERNS = new WeakMap();

export function applyOrderedDitherFade(ctx, width, height, visibility) {
    const alpha = Number.isFinite(visibility) ? visibility : 1;
    const level = Math.max(0, Math.min(16, Math.round(alpha * 16)));
    ctx.globalAlpha = 1.0;

    if (level === 16) return;
    if (level === 0) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);
        return;
    }

    let patterns = ORDERED_FADE_PATTERNS.get(ctx);
    if (!patterns) {
        patterns = new Array(17);
        ORDERED_FADE_PATTERNS.set(ctx, patterns);
    }
    if (!patterns[level]) {
        const patternCanvas = document.createElement('canvas');
        patternCanvas.width = 4;
        patternCanvas.height = 4;
        const patternCtx = patternCanvas.getContext('2d');
        patternCtx.fillStyle = '#000000';
        for (let i = 0; i < ORDERED_FADE_MATRIX.length; i++) {
            if (ORDERED_FADE_MATRIX[i] >= level) {
                patternCtx.fillRect(i & 3, i >> 2, 1, 1);
            }
        }
        patterns[level] = ctx.createPattern(patternCanvas, 'repeat');
    }

    ctx.fillStyle = patterns[level];
    ctx.fillRect(0, 0, width, height);
}

export function fillAliasedCircle(ctx, xc, yc, r, color) {
    ctx.fillStyle = color;
    xc = Math.floor(xc);
    yc = Math.floor(yc);
    r = Math.floor(r);
    for (let y = -r; y <= r; y++) {
        let dx = Math.round(Math.sqrt(r * r - y * y));
        ctx.fillRect(xc - dx, yc + y, dx * 2, 1);
    }
}

// =========================================================
// GENERAL PURPOSE OPTIMIZATION ROUTINES (v2.1.0 Lib)
// =========================================================

/**
 * Der klassische Midpoint-Kreis-Algorithmus (Bresenham)
 * Zeichnet pixelgenaue Kreisumrisse extrem schnell über 8-Oktanten-Plots
 */
export function drawAliasedCircleOutline(ctx, xc, yc, r, color) {
    ctx.fillStyle = color;
    xc = Math.floor(xc);
    yc = Math.floor(yc);
    r = Math.floor(r);

    let x = 0;
    let y = r;
    let d = 3 - 2 * r;
    
    while (y >= x) {
        ctx.fillRect(xc + x, yc + y, 1, 1);
        ctx.fillRect(xc - x, yc + y, 1, 1);
        ctx.fillRect(xc + x, yc - y, 1, 1);
        ctx.fillRect(xc - x, yc - y, 1, 1);
        ctx.fillRect(xc + y, yc + x, 1, 1);
        ctx.fillRect(xc - y, yc + x, 1, 1);
        ctx.fillRect(xc + y, yc - x, 1, 1);
        ctx.fillRect(xc - y, yc - x, 1, 1);
        
        x++;
        if (d > 0) {
            y--;
            d = d + 4 * (x - y) + 10;
        } else {
            d = d + 4 * x + 6;
        }
    }
}

export function drawAliasedLine(ctx, x0, y0, x1, y1, color) {
    ctx.fillStyle = color;
    x0 = Math.floor(x0); y0 = Math.floor(y0);
    x1 = Math.floor(x1); y1 = Math.floor(y1);

    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = (dx > dy ? dx : -dy) / 2;

    // Exakt dieselbe Bresenham-Punktfolge, aber zusammenhaengende Pixel
    // werden als horizontale oder vertikale Spanne ausgegeben.
    if (dx >= dy) {
        let runStartX = x0;
        while (true) {
            const oldX = x0, oldY = y0;
            if (x0 === x1 && y0 === y1) {
                ctx.fillRect(Math.min(runStartX, x0), y0, Math.abs(x0 - runStartX) + 1, 1);
                break;
            }
            const e2 = err;
            if (e2 > -dx) { err -= dy; x0 += sx; }
            if (e2 < dy) { err += dx; y0 += sy; }
            if (y0 !== oldY) {
                ctx.fillRect(Math.min(runStartX, oldX), oldY, Math.abs(oldX - runStartX) + 1, 1);
                runStartX = x0;
            }
        }
        return;
    }

    let runStartY = y0;
    while (true) {
        const oldX = x0, oldY = y0;
        if (x0 === x1 && y0 === y1) {
            ctx.fillRect(x0, Math.min(runStartY, y0), 1, Math.abs(y0 - runStartY) + 1);
            break;
        }
        const e2 = err;
        if (e2 > -dx) { err -= dy; x0 += sx; }
        if (e2 < dy) { err += dx; y0 += sy; }
        if (x0 !== oldX) {
            ctx.fillRect(oldX, Math.min(runStartY, oldY), 1, Math.abs(oldY - runStartY) + 1);
            runStartY = y0;
        }
    }
}

/**
 * Ganzzahliger Scanline-Rasterizer fuer kleine DSE-Polygone.
 * Er ersetzt Canvas-fill(), dessen Kanten sonst Browser-AA und damit
 * unerwuenschte Zwischenfarben erzeugen. Im Dither-Modus bleibt jedes
 * zweite Pixel transparent, wie bei einem klassischen Glenz-Effekt.
 */
export function fillAliasedPolygon(ctx, points, color, transparentDither = false) {
    if (!points || points.length < 3) return;

    let minY = points[0].y;
    let maxY = points[0].y;
    for (let i = 1; i < points.length; i++) {
        minY = Math.min(minY, points[i].y);
        maxY = Math.max(maxY, points[i].y);
    }

    minY = Math.ceil(minY);
    maxY = Math.floor(maxY);
    const intersections = [];
    ctx.fillStyle = color;

    for (let y = minY; y <= maxY; y++) {
        intersections.length = 0;
        for (let i = 0; i < points.length; i++) {
            const p0 = points[i];
            const p1 = points[(i + 1) % points.length];
            if (p0.y === p1.y) continue;

            const crossesScanline = (p0.y <= y && p1.y > y) || (p1.y <= y && p0.y > y);
            if (crossesScanline) {
                intersections.push(p0.x + ((y - p0.y) / (p1.y - p0.y)) * (p1.x - p0.x));
            }
        }

        intersections.sort((a, b) => a - b);
        for (let i = 0; i + 1 < intersections.length; i += 2) {
            const startX = Math.ceil(intersections[i]);
            const endX = Math.floor(intersections[i + 1]);
            if (endX < startX) continue;

            if (transparentDither) {
                for (let x = startX; x <= endX; x++) {
                    if (((x + y) & 1) === 0) ctx.fillRect(x, y, 1, 1);
                }
            } else {
                ctx.fillRect(startX, y, endX - startX + 1, 1);
            }
        }
    }
}

// =========================================================
// DOM-FREIE DETERMINISTIK-, FADE- & CLIPPING-HELFER
// =========================================================

export function createXorshift32(seed = 0x9E3779B9) {
    const initialSeed = (seed | 0) || 0x9E3779B9;
    let state = initialSeed;

    function next() {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        return state >>> 0;
    }

    function float() {
        return next() / 4294967296;
    }

    function int(n) {
        if (!Number.isFinite(n) || n <= 0) return 0;
        return Math.floor(float() * Math.floor(n));
    }

    function reset(newSeed = initialSeed) {
        state = (newSeed | 0) || 0x9E3779B9;
    }

    return { next, float, int, reset };
}

export function bayerFadeCells(ctx, x, y, w, h, visibility, cell = 2, color = '#000000') {
    if (!ctx || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) {
        return;
    }
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = Math.floor(x + w);
    const y1 = Math.floor(y + h);
    const rw = x1 - x0;
    const rh = y1 - y0;
    if (rw <= 0 || rh <= 0) return;

    const alpha = Number.isFinite(visibility) ? visibility : 1;
    const level = Math.max(0, Math.min(16, Math.round(alpha * 16)));
    if (level >= 16) return;

    ctx.fillStyle = color;
    if (level <= 0) {
        ctx.fillRect(x0, y0, rw, rh);
        return;
    }

    let effCell = Number.isFinite(cell) ? Math.max(1, Math.floor(cell)) : 2;
    while (Math.ceil(rw / effCell) * Math.ceil(rh / effCell) * 0.5 > 3600) {
        effCell++;
    }

    const cols = Math.ceil(rw / effCell);
    const rows = Math.ceil(rh / effCell);

    for (let row = 0; row < rows; row++) {
        const py = y0 + row * effCell;
        const ch = Math.min(effCell, y1 - py);
        if (ch <= 0) break;

        const bayerRow = (row & 3) * 4;
        let runStart = -1;

        for (let col = 0; col <= cols; col++) {
            const masked = col < cols && ORDERED_FADE_MATRIX[bayerRow + (col & 3)] >= level;
            if (masked) {
                if (runStart === -1) runStart = col;
            } else if (runStart !== -1) {
                const px = x0 + runStart * effCell;
                const pw = Math.min(x1, x0 + col * effCell) - px;
                if (pw > 0) ctx.fillRect(px, py, pw, ch);
                runStart = -1;
            }
        }
    }
}

function normalizeClipRect(clipRect) {
    if (!clipRect) return null;
    let minX, minY, maxX, maxY;
    if (Number.isFinite(clipRect.minX) && Number.isFinite(clipRect.maxX)) {
        minX = Math.floor(clipRect.minX);
        maxX = Math.floor(clipRect.maxX);
        minY = Math.floor(clipRect.minY ?? 0);
        maxY = Math.floor(clipRect.maxY ?? 0);
    } else {
        const x = Number.isFinite(clipRect.x) ? clipRect.x : 0;
        const y = Number.isFinite(clipRect.y) ? clipRect.y : 0;
        const w = Number.isFinite(clipRect.w) ? clipRect.w : clipRect.width;
        const h = Number.isFinite(clipRect.h) ? clipRect.h : clipRect.height;
        if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
        minX = Math.floor(x);
        minY = Math.floor(y);
        maxX = Math.floor(x + w);
        maxY = Math.floor(y + h);
    }
    if (maxX <= minX || maxY <= minY) return null;
    return { minX, minY, maxX, maxY };
}

function emitClippedRect(ctx, rx, ry, rw, rh, clip) {
    if (!clip) {
        if (rw > 0 && rh > 0) ctx.fillRect(rx, ry, rw, rh);
        return;
    }
    const x0 = Math.max(clip.minX, rx);
    const y0 = Math.max(clip.minY, ry);
    const x1 = Math.min(clip.maxX, rx + rw);
    const y1 = Math.min(clip.maxY, ry + rh);
    const cw = x1 - x0;
    const ch = y1 - y0;
    if (cw > 0 && ch > 0) {
        ctx.fillRect(x0, y0, cw, ch);
    }
}

export function drawAliasedLineClipped(ctx, x0, y0, x1, y1, color, clipRect = null) {
    if (!ctx || !Number.isFinite(x0) || !Number.isFinite(y0) || !Number.isFinite(x1) || !Number.isFinite(y1)) {
        return;
    }

    const hasClip = clipRect !== null && clipRect !== undefined;
    const clip = hasClip ? normalizeClipRect(clipRect) : null;
    if (hasClip && !clip) return;

    let cx0 = x0, cy0 = y0, cx1 = x1, cy1 = y1;
    if (clip) {
        const left = clip.minX - 1;
        const right = clip.maxX;
        const top = clip.minY - 1;
        const bottom = clip.maxY;
        const dxF = cx1 - cx0;
        const dyF = cy1 - cy0;
        let t0 = 0;
        let t1 = 1;
        const p = [-dxF, dxF, -dyF, dyF];
        const q = [cx0 - left, right - cx0, cy0 - top, bottom - cy0];
        for (let i = 0; i < 4; i++) {
            if (p[i] === 0) {
                if (q[i] < 0) return;
            } else {
                const r = q[i] / p[i];
                if (p[i] < 0) {
                    if (r > t1) return;
                    if (r > t0) t0 = r;
                } else {
                    if (r < t0) return;
                    if (r < t1) t1 = r;
                }
            }
        }
        cx1 = cx0 + t1 * dxF;
        cy1 = cy0 + t1 * dyF;
        cx0 = cx0 + t0 * dxF;
        cy0 = cy0 + t0 * dyF;
    }

    ctx.fillStyle = color;
    let ix0 = Math.floor(cx0), iy0 = Math.floor(cy0);
    const ix1 = Math.floor(cx1), iy1 = Math.floor(cy1);

    const dx = Math.abs(ix1 - ix0), sx = ix0 < ix1 ? 1 : -1;
    const dy = Math.abs(iy1 - iy0), sy = iy0 < iy1 ? 1 : -1;
    let err = (dx > dy ? dx : -dy) / 2;

    if (dx >= dy) {
        let runStartX = ix0;
        while (true) {
            const oldX = ix0, oldY = iy0;
            if (ix0 === ix1 && iy0 === iy1) {
                emitClippedRect(ctx, Math.min(runStartX, ix0), iy0, Math.abs(ix0 - runStartX) + 1, 1, clip);
                break;
            }
            const e2 = err;
            if (e2 > -dx) { err -= dy; ix0 += sx; }
            if (e2 < dy) { err += dx; iy0 += sy; }
            if (iy0 !== oldY) {
                emitClippedRect(ctx, Math.min(runStartX, oldX), oldY, Math.abs(oldX - runStartX) + 1, 1, clip);
                runStartX = ix0;
            }
        }
        return;
    }

    let runStartY = iy0;
    while (true) {
        const oldX = ix0, oldY = iy0;
        if (ix0 === ix1 && iy0 === iy1) {
            emitClippedRect(ctx, ix0, Math.min(runStartY, iy0), 1, Math.abs(iy0 - runStartY) + 1, clip);
            break;
        }
        const e2 = err;
        if (e2 > -dx) { err -= dy; ix0 += sx; }
        if (e2 < dy) { err += dx; iy0 += sy; }
        if (ix0 !== oldX) {
            emitClippedRect(ctx, oldX, Math.min(runStartY, oldY), 1, Math.abs(oldY - runStartY) + 1, clip);
            runStartY = iy0;
        }
    }
}

export function fillAliasedPolygonClipped(ctx, points, color, transparentDither = false, clipRect = null) {
    if (!ctx || !points || points.length < 3) return;

    const hasClip = clipRect !== null && clipRect !== undefined;
    const clip = hasClip ? normalizeClipRect(clipRect) : null;
    if (hasClip && !clip) return;

    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < points.length; i++) {
        const pt = points[i];
        if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) return;
        if (pt.y < minY) minY = pt.y;
        if (pt.y > maxY) maxY = pt.y;
    }

    minY = Math.ceil(minY);
    maxY = Math.floor(maxY);
    if (clip) {
        minY = Math.max(clip.minY, minY);
        maxY = Math.min(clip.maxY - 1, maxY);
    }
    if (maxY < minY) return;

    const intersections = [];
    ctx.fillStyle = color;

    for (let y = minY; y <= maxY; y++) {
        intersections.length = 0;
        for (let i = 0; i < points.length; i++) {
            const p0 = points[i];
            const p1 = points[(i + 1) % points.length];
            if (p0.y === p1.y) continue;

            const crossesScanline = (p0.y <= y && p1.y > y) || (p1.y <= y && p0.y > y);
            if (crossesScanline) {
                intersections.push(p0.x + ((y - p0.y) / (p1.y - p0.y)) * (p1.x - p0.x));
            }
        }

        intersections.sort((a, b) => a - b);
        for (let i = 0; i + 1 < intersections.length; i += 2) {
            let startX = Math.ceil(intersections[i]);
            let endX = Math.floor(intersections[i + 1]);
            if (clip) {
                startX = Math.max(clip.minX, startX);
                endX = Math.min(clip.maxX - 1, endX);
            }
            if (endX < startX) continue;

            if (transparentDither) {
                for (let x = startX; x <= endX; x++) {
                    if (((x + y) & 1) === 0) ctx.fillRect(x, y, 1, 1);
                }
            } else {
                ctx.fillRect(startX, y, endX - startX + 1, 1);
            }
        }
    }
}

function emitClippedHLine(ctx, x0, x1, y, clip) {
    if (x1 < x0) return;
    emitClippedRect(ctx, x0, y, x1 - x0 + 1, 1, clip);
}

function emitClippedVLine(ctx, x, y0, y1, clip) {
    if (y1 < y0) return;
    emitClippedRect(ctx, x, y0, 1, y1 - y0 + 1, clip);
}

function flushEllipseHRun(ctx, cx, cy, startX, endX, y, clip) {
    if (startX === 0) {
        emitClippedHLine(ctx, cx - endX, cx + endX, cy + y, clip);
        if (y > 0) emitClippedHLine(ctx, cx - endX, cx + endX, cy - y, clip);
        return;
    }
    emitClippedHLine(ctx, cx - endX, cx - startX, cy + y, clip);
    emitClippedHLine(ctx, cx + startX, cx + endX, cy + y, clip);
    if (y > 0) {
        emitClippedHLine(ctx, cx - endX, cx - startX, cy - y, clip);
        emitClippedHLine(ctx, cx + startX, cx + endX, cy - y, clip);
    }
}

function flushEllipseVRun(ctx, cx, cy, x, startY, endY, clip) {
    if (endY === 0) {
        emitClippedVLine(ctx, cx + x, cy - startY, cy + startY, clip);
        if (x > 0) emitClippedVLine(ctx, cx - x, cy - startY, cy + startY, clip);
        return;
    }
    emitClippedVLine(ctx, cx + x, cy - startY, cy - endY, clip);
    emitClippedVLine(ctx, cx + x, cy + endY, cy + startY, clip);
    if (x > 0) {
        emitClippedVLine(ctx, cx - x, cy - startY, cy - endY, clip);
        emitClippedVLine(ctx, cx - x, cy + endY, cy + startY, clip);
    }
}

export function drawAliasedEllipseOutlineClipped(ctx, xc, yc, rx, ry, color, clipRect = null) {
    if (!ctx || !Number.isFinite(xc) || !Number.isFinite(yc) || !Number.isFinite(rx) || !Number.isFinite(ry)) {
        return;
    }

    const hasClip = clipRect !== null && clipRect !== undefined;
    const clip = hasClip ? normalizeClipRect(clipRect) : null;
    if (hasClip && !clip) return;

    const cx = Math.round(xc);
    const cy = Math.round(yc);
    const irx = Math.round(rx);
    const iry = Math.round(ry);
    if (irx < 0 || iry < 0 || irx > 16384 || iry > 16384) return;

    if (clip && (cx + irx < clip.minX || cx - irx >= clip.maxX || cy + iry < clip.minY || cy - iry >= clip.maxY)) {
        return;
    }

    ctx.fillStyle = color;

    if (irx === 0 && iry === 0) {
        emitClippedRect(ctx, cx, cy, 1, 1, clip);
        return;
    }
    if (irx === 0) {
        emitClippedVLine(ctx, cx, cy - iry, cy + iry, clip);
        return;
    }
    if (iry === 0) {
        emitClippedHLine(ctx, cx - irx, cx + irx, cy, clip);
        return;
    }

    const rx2 = irx * irx;
    const ry2 = iry * iry;
    const twoRx2 = 2 * rx2;
    const twoRy2 = 2 * ry2;

    let x = 0;
    let y = iry;
    let px = 0;
    let py = twoRx2 * y;
    let p1 = Math.round(ry2 - (rx2 * iry) + (0.25 * rx2));

    let runStartX = -1;
    let runEndX = -1;
    let runY = y;

    // Region 1 (flache obere/untere Boegen -> horizontales Run-Merging)
    while (px < py) {
        if (runStartX === -1) {
            runStartX = x;
            runEndX = x;
            runY = y;
        } else {
            runEndX = x;
        }

        x++;
        px += twoRy2;
        if (p1 < 0) {
            p1 += ry2 + px;
        } else {
            y--;
            py -= twoRx2;
            p1 += ry2 + px - py;
            flushEllipseHRun(ctx, cx, cy, runStartX, runEndX, runY, clip);
            runStartX = -1;
        }
    }
    if (runStartX !== -1) {
        flushEllipseHRun(ctx, cx, cy, runStartX, runEndX, runY, clip);
    }

    // Region 2 (steile linke/rechte Flanken -> vertikales Run-Merging)
    let p2 = Math.round(ry2 * (x + 0.5) * (x + 0.5) + rx2 * (y - 1) * (y - 1) - rx2 * ry2);
    let runX = -1;
    let runStartY = y;
    let runEndY = y;

    while (y >= 0) {
        if (runX === -1) {
            runX = x;
            runStartY = y;
            runEndY = y;
        } else {
            runEndY = y;
        }

        y--;
        py -= twoRx2;
        if (p2 > 0) {
            p2 += rx2 - py;
        } else {
            x++;
            px += twoRy2;
            p2 += rx2 - py + px;
            flushEllipseVRun(ctx, cx, cy, runX, runStartY, runEndY, clip);
            runX = -1;
        }
    }
    if (runX !== -1) {
        flushEllipseVRun(ctx, cx, cy, runX, runStartY, runEndY, clip);
    }
}