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

    let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    let dy = Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = (dx > dy ? dx : -dy) / 2;

    while (true) {
        ctx.fillRect(x0, y0, 1, 1);
        if (x0 === x1 && y0 === y1) break;
        let e2 = err;
        if (e2 > -dx) { err -= dy; x0 += sx; }
        if (e2 < dy) { err += dx; y0 += sy; }
    }
}