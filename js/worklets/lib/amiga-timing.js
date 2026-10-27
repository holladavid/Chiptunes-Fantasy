// Gemeinsame PAL-Zeitbasis für die Amiga-Replay-Pfade.
// COSO und der unkomprimierte HIP68K-Player werden durch denselben CIA-Takt
// angestoßen. Die Werte folgen den UADE-Messungen in der verifizierten Spec.
export const PAL_PAULA_CLOCK = 3546895;
export const PAL_CIA_CLOCK = PAL_PAULA_CLOCK / 5;
export const COSO_CIA_TIMER_PERIOD = 14188;
export const COSO_TICK_HZ = PAL_CIA_CLOCK / COSO_CIA_TIMER_PERIOD;

// Eine PAL-Rasterzeile entspricht 227 Paula-Takten (ca. 64 µs). Der HIP-Player
// verbringt pro Warteschleife zwei VHPOSR-Zugriffe: Anfangswert und Flanke.
export const HIP_RASTER_LINE_CLOCKS = 227;
export const HIP_VHPOS_READS_PER_LINE = 2;
