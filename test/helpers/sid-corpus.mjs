const CYCLES = 65536;
const write = (cycle, register, value) => ({ cycle, register, value });

function eventsAtCycleZero(values) {
    return values.map(([register, value]) => write(0, register, value));
}

function adsrCase(name, waveform) {
    return {
        name,
        cycles: CYCLES,
        events: [
            ...eventsAtCycleZero([
                [0, 0x00], [1, 0x20],
                [2, 0x00], [3, 0x08],
                [5, 0x11], [6, 0xF1],
                [24, 0x0F],
                [4, waveform | 0x01]
            ]),
            write(49152, 4, waveform)
        ]
    };
}

export const SID_SYNTHETIC_CORPUS = [
    { name: 'silence', cycles: CYCLES, events: [] },
    adsrCase('pulse-adsr', 0x40),
    adsrCase('saw-adsr', 0x20),
    adsrCase('triangle-adsr', 0x10),
    adsrCase('noise-adsr', 0x80),
    adsrCase('combined-triangle-pulse', 0x50),
    {
        name: 'hard-sync-ring',
        cycles: CYCLES,
        events: [
            ...eventsAtCycleZero([
                [0, 0x00], [1, 0x20], [5, 0x11], [6, 0xF1], [4, 0x21],
                [7, 0x00], [8, 0x18], [12, 0x11], [13, 0xF1], [11, 0x15],
                [24, 0x0F]
            ]),
            write(49152, 4, 0x20),
            write(49152, 11, 0x14)
        ]
    },
    {
        name: 'filter-sweep',
        cycles: CYCLES,
        events: [
            ...eventsAtCycleZero([
                [0, 0x00], [1, 0x20], [5, 0x11], [6, 0xF1], [4, 0x21],
                [23, 0xF1], [24, 0x1F]
            ]),
            write(49152, 4, 0x20),
            ...Array.from({ length: 256 }, (_, index) => write(index * 256, 22, index))
        ]
    },
    {
        name: 'd418-volume-writes',
        cycles: CYCLES,
        events: Array.from({ length: 256 }, (_, index) => write(index * 256, 24, index & 0x0F))
    },
    {
        name: 'test-bit-reset',
        cycles: CYCLES,
        events: [
            ...eventsAtCycleZero([
                [0, 0x00], [1, 0x20],
                [2, 0x00], [3, 0x08],
                [5, 0x11], [6, 0xF1],
                [24, 0x0F],
                [4, 0x49]
            ]),
            write(16384, 4, 0x41),
            write(32768, 4, 0x40)
        ]
    }
];
