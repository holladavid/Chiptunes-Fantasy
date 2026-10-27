function eventsAtCycleZero(values) {
    return values.map(([register, value]) => ({ cycle: 0, register, value }));
}

const envelopeEvents = eventsAtCycleZero([
    [7, 0x3F],
    [8, 0x10],
    [11, 1],
    [12, 0]
]);
for (let shape = 0; shape < 16; shape++) {
    envelopeEvents.push({ cycle: shape * 2048, register: 13, value: shape });
}

export const YM_SYNTHETIC_CORPUS = [
    {
        name: 'tone-a',
        cycles: 4096,
        events: eventsAtCycleZero([[0, 100], [1, 0], [7, 0x3E], [8, 0x0F]])
    },
    {
        name: 'noise-a',
        cycles: 8192,
        events: eventsAtCycleZero([[6, 3], [7, 0x37], [8, 0x0F]])
    },
    {
        name: 'envelope-shapes',
        cycles: 32768,
        events: envelopeEvents
    },
    {
        name: 'period-zero-mixer',
        cycles: 4096,
        events: eventsAtCycleZero([[0, 0], [1, 0], [6, 0], [7, 0x00], [8, 0x0F], [11, 0], [12, 0], [13, 0x0E]])
    }
];
