// MOS 6581 triangle+pulse calibration for the hardware-oriented Exact path.
// Independently fitted from public-output black-box observations of libresidfp
// revision c1791383ca843a855e5d4366da6a7277e34e801d, MOS6581/AVERAGE.
// No reference implementation code or internal waveform table is imported.
// This is reference-model agreement, not a physical-chip capture.

// The transfer is phase-indexed: folding to the triangle value would merge
// different rising/falling-phase observations. Values above the 12-bit output
// range after external-output normalization are clamped at the model boundary.
const TRIANGLE_PULSE_LOW = new Uint16Array([
    1461, 1462, 1462, 1461, 1462, 1461, 1462, 1461, 1461, 1461, 1461, 1462,
    1462, 1461, 1462, 1462, 1462, 1462, 1462, 1462, 1462, 1462, 1462, 1462,
    1462, 1462, 1462, 1462, 1462, 1462, 1462, 1463, 1462, 1462, 1462, 1462,
    1462, 1462, 1462, 1462, 1462, 1462, 1463, 1462, 1462, 1462, 1463, 1462,
    1462, 1462, 1463, 1463, 1463, 1463, 1463, 1463, 1463, 1463, 1463, 1463,
    1463, 1463, 1538, 1610, 2026, 1719, 1579, 1516, 1487, 1474, 1468, 1465,
    1464, 1463, 1463, 1463, 1463, 1463, 1463, 1463, 1608, 1529, 1493, 1477,
    1469, 1466, 1465, 1464, 1608, 1529, 1493, 1477, 1614, 1532, 1639, 1725,
    2502, 1936, 1678, 1561, 1508, 1483, 1473, 1467, 1682, 1563, 1509, 1484,
    1690, 1566, 1977, 2439, 2920, 2126, 1765, 1600, 2126, 1909, 2267, 2759,
    3232, 2412, 2620, 3045, 3429, 3647, 4095, 4095, 4095, 4095, 4095, 4095,
    3781, 4015, 3387, 2912, 2449, 3330, 2968, 2627, 2298, 2146, 1772, 1601,
    1833, 2765, 2623, 2175, 2049, 1728, 1581, 1515, 1749, 1592, 1520, 1487,
    1472, 1465, 1462, 1461, 1730, 2481, 2101, 1752, 1769, 1600, 1523, 1489,
    1649, 1546, 1499, 1477, 1468, 1463, 1462, 1460, 1636, 1540, 1496, 1476,
    1468, 1463, 1462, 1460, 1460, 1460, 1459, 1460, 1459, 1460, 1460, 1460,
    1647, 1980, 1788, 1609, 1528, 1491, 1474, 1467, 1463, 1462, 1461, 1461,
    1461, 1461, 1460, 1460, 1460, 1460, 1460, 1461, 1461, 1460, 1460, 1460,
    1461, 1461, 1460, 1460, 1460, 1460, 1461, 1461, 1461, 1461, 1461, 1461,
    1461, 1461, 1461, 1461, 1461, 1461, 1461, 1461, 1461, 1461, 1461, 1461,
    1461, 1461, 1461, 1461, 1461, 1461, 1460, 1461, 1461, 1461, 1461, 1461,
    1461, 1462, 1462, 1462, 1462, 1462,
]);

// The slowly drifting external-reference DC is not a DAC measurement. The
// constant state therefore uses the fitted low-state plateau, which also
// matches wide-pulse held-out observations after block-local DC removal.
const TRIANGLE_PULSE_HIGH = 1461;

export function trianglePulse12Bit6581R3(phase12, pulse) {
    if (pulse !== 0) return TRIANGLE_PULSE_HIGH;

    const index = phase12 >>> 4;
    const fraction = phase12 & 15;
    const lower = TRIANGLE_PULSE_LOW[index];
    const upper = TRIANGLE_PULSE_LOW[index + 1];
    return ((lower * (16 - fraction)) + (upper * fraction) + 8) >>> 4;
}
