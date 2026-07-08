// === js/visuals/utils/hardware-constraints.js ===
// =========================================================
// HARDWARE VIDEO CHIP CONSTRAINTS & PALETTES
// Single Source of Truth für historische Farbtiefen.
// =========================================================

// Die authentische 16-Farben VIC-II Palette (Colodore matched)
export const C64_PALETTE = [
    [0, 0, 0],       // 0: Black
    [255, 255, 255], // 1: White
    [139, 73, 67],   // 2: Red
    [123, 191, 199], // 3: Cyan
    [139, 69, 171],  // 4: Purple
    [104, 169, 65],  // 5: Green
    [53, 40, 121],   // 6: Blue (Dark Blue / Theme)
    [255, 255, 51],  // 7: Yellow
    [221, 139, 69],  // 8: Orange
    [92, 71, 0],     // 9: Brown
    [255, 138, 138], // 10: Light Red
    [51, 51, 51],    // 11: Dark Grey
    [119, 119, 119], // 12: Grey
    [170, 255, 102], // 13: Light Green
    [108, 94, 181],  // 14: Light Blue (Theme)
    [181, 181, 181]  // 15: Light Grey
];

/** Wandelt ein [R, G, B] Array in einen Canvas-tauglichen Hex-String um */
export function rgbToHex(r, g, b) {
    return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1);
}

/** Holt sich aus einem beliebigen RGB-Wert die physikalisch nächste C64-Farbe (Für hartes Banding) */
export function getNearestC64Color(r, g, b) {
    let minDist = Infinity;
    let bestColor = C64_PALETTE[0];
    for (let i = 0; i < 16; i++) {
        let c = C64_PALETTE[i];
        // Euklidische Distanz im RGB-Raum
        let dist = (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2;
        if (dist < minDist) {
            minDist = dist;
            bestColor = c;
        }
    }
    return bestColor;
}

/** Amiga OCS (Original Chip Set) - 4 Bits per Channel (4096 Farben) */
export function quantizeAmiga12Bit(r, g, b) {
    return [
        Math.round(r / 255 * 15) * 17,
        Math.round(g / 255 * 15) * 17,
        Math.round(b / 255 * 15) * 17
    ];
}

/** Atari ST Shifter - 3 Bits per Channel (512 Farben) */
export function quantizeAtari9Bit(r, g, b) {
    return [
        Math.round(r / 255 * 7) * 36,
        Math.round(g / 255 * 7) * 36,
        Math.round(b / 255 * 7) * 36
    ];
}

// Historische vertikale Auflösungen (Scanlines)
export const SYSTEM_RESOLUTIONS = {
    'c64': 200,    // 320x200 (NTSC/PAL Hires)
    'atari': 200,  // 320x200 (Low-Res, 16-Color)
    'amiga': 256   // 320x256 (PAL Standard Low-Res)
};