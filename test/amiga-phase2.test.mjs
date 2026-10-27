import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
    PAL_PAULA_CLOCK, PAL_CIA_CLOCK, COSO_CIA_TIMER_PERIOD, COSO_TICK_HZ,
    HIP_RASTER_LINE_CLOCKS
} from '../js/worklets/lib/amiga-timing.js';
import { CosoVirtualMachine } from '../js/worklets/lib/coso-vm.js';
import { HipVirtualMachine } from '../js/worklets/lib/hip-vm.js';
import {
    AMIGA_HARNESS_ROOT, loadAmigaTrack, createExactProcessor, renderExact,
    tapHashes, sha256
} from '../tools/lib/amiga-exact-harness.mjs';

const L1 = 'wings-of-death/Wings_Of_Death-Level_1.hipc';
const HIP = 'wings-of-death/Wings_Of_Death-Title.hip';

class TimingChannel {
    constructor() {
        this.calls = [];
        this.chipRam = null;
        this.dmaEnabled = false;
    }
    hwAttach(ram) { this.chipRam = ram; }
    hwWriteLC(value) { this.calls.push(['LC', value]); }
    hwWriteLEN(value) { this.calls.push(['LEN', value]); }
    writeAUDxPER(value) { this.calls.push(['PER', value]); }
    writeAUDxVOL(value) { this.calls.push(['VOL', value]); }
    hwStartDMA() { this.dmaEnabled = true; this.calls.push(['START']); }
    hwStopDMA() { this.dmaEnabled = false; this.calls.push(['STOP']); }
}
const timingChannels = () => [0, 1, 2, 3].map(() => new TimingChannel());
const starts = channels => channels.map(channel => channel.calls.filter(call => call[0] === 'START').length);

test('COSO/HIP: CIA-Timer 14188 ergibt den dokumentierten Tick statt exakt 50 Hz', async () => {
    assert.equal(PAL_PAULA_CLOCK, 3546895);
    assert.equal(PAL_CIA_CLOCK, 709379);
    assert.equal(COSO_CIA_TIMER_PERIOD, 14188);
    assert.equal(COSO_TICK_HZ, 709379 / 14188);
    assert.ok(Math.abs(COSO_TICK_HZ - 49.99851987595151) < 1e-12);
    assert.equal(HIP_RASTER_LINE_CLOCKS, 227);

    const coso = new CosoVirtualMachine((await loadAmigaTrack(L1)).track, {});
    const hip = new HipVirtualMachine((await loadAmigaTrack(HIP)).track, {});
    assert.equal(coso.tickHz, COSO_TICK_HZ);
    assert.equal(hip.tickHz, COSO_TICK_HZ);
});

test('Exact-Worklet: der COSO/HIP-Sampleakkumulator verwendet den CIA-Tick', async () => {
    const loaded = await loadAmigaTrack(L1);
    const processor = createExactProcessor(loaded.track, 48000);
    renderExact(processor, { seconds: 1 / 48000, outputRate: 48000, blockSize: 1 });
    assert.equal(processor.sampleCounter, 48000 / COSO_TICK_HZ - 1);
});

test('HIP68K: DMA-Start und Loop-Latches folgen den drei plus eine Rasterzeilen des Originalplayers', async () => {
    const loaded = await loadAmigaTrack(HIP);
    const vm = new HipVirtualMachine(loaded.track, {}, null, { rasterTiming: true });
    const channels = timingChannels();
    vm.processTick(channels);

    assert.deepEqual(starts(channels), [0, 0, 0, 0], 'DMA darf nicht mehr sofort starten');
    vm.advance(3 * HIP_RASTER_LINE_CLOCKS - 1);
    assert.deepEqual(starts(channels), [0, 0, 0, 0]);
    vm.advance(1);
    assert.deepEqual(starts(channels), [1, 0, 1, 1]);

    const initialLc = channels[0].calls.filter(call => call[0] === 'LC').at(-1)[1];
    assert.equal(initialLc, 0x3C408, 'der Start muss noch den initialen Sample-Zeiger verwenden');

    vm.advance(HIP_RASTER_LINE_CLOCKS - 1);
    assert.equal(channels[0].calls.filter(call => call[0] === 'LC').at(-1)[1], initialLc);
    vm.advance(1);
    assert.equal(channels[0].calls.filter(call => call[0] === 'LC').at(-1)[1], 0x40346,
        'erst nach der vierten Zeile darf der Loop-Zeiger gelatcht werden');
});

test('Exact-Worklet: HIP68K aktiviert die Rasterzeit und bleibt endlich', async () => {
    const loaded = await loadAmigaTrack(HIP);
    const processor = createExactProcessor(loaded.track, 48000);
    assert.equal(processor.cosoVM.rasterTiming, true);
    const run = renderExact(processor, { seconds: 0.05, outputRate: 48000, blockSize: 128 });
    assert.equal(run.taps.reduce((sum, tap) => sum + tap.nonFiniteSamples, 0), 0);
    assert.ok(run.taps.find(tap => tap.id === 'paula').rms > 0.05, 'HIP68K muss mit Rasterzeit hörbar bleiben');
    assert.equal(processor.cosoVM.failed, false);
});

test('HIP68K: ohne Rasteroption bleibt die synchrone Registerprüfung kompatibel', async () => {
    const loaded = await loadAmigaTrack(HIP);
    const vm = new HipVirtualMachine(loaded.track, {});
    const channels = timingChannels();
    vm.processTick(channels);
    assert.deepEqual(starts(channels), [1, 0, 1, 1]);
});

for (const name of ['level1', 'hip68k']) {
    test(`Phase-2-Regressionsanker ${name}: aktuelle Exact-Ausgabe und Provenienz`, async () => {
        const filename = path.join(AMIGA_HARNESS_ROOT, `doc/verification/amiga/phase2-exact-${name}.json`);
        const report = JSON.parse(readFileSync(filename, 'utf8'));
        const loaded = await loadAmigaTrack(report.input);
        assert.equal(sha256(loaded.bytes), report.tuneSha256);
        const worklet = readFileSync(path.join(AMIGA_HARNESS_ROOT, 'js/worklets/amiga/paula-exact.js'));
        assert.equal(sha256(worklet), report.workletSha256);
        const run = renderExact(createExactProcessor(loaded.track), {
            seconds: report.seconds,
            outputRate: report.sampleRate,
            blockSize: report.blockSize
        });
        assert.deepEqual(tapHashes(run), tapHashes(report.runs[0]));
        assert.equal(report.deterministic, true);
        assert.equal(report.finite, true);
        assert.equal(report.blockComparison.bitIdentical, true);
        assert.equal(report.restartComparison.bitIdenticalToFreshWorklet, true);
    });
}

test('HIP68K-Rasterzeit: processTick und advance allokieren im Dauerbetrieb nichts', {
    skip: typeof globalThis.gc !== 'function' ? 'benötigt --expose-gc' : false
}, async () => {
    const loaded = await loadAmigaTrack(HIP);
    const vm = new HipVirtualMachine(loaded.track, {}, null, { rasterTiming: true });
    const channels = [0, 1, 2, 3].map(() => ({
        chipRam: null,
        hwAttach(ram) { this.chipRam = ram; },
        hwWriteLC() {}, hwWriteLEN() {}, writeAUDxPER() {}, writeAUDxVOL() {},
        hwStartDMA() {}, hwStopDMA() {}
    }));
    for (let tick = 0; tick < 1000; tick++) {
        vm.processTick(channels);
        vm.advance(71000);
    }
    globalThis.gc();
    const before = process.memoryUsage().heapUsed;
    for (let tick = 0; tick < 10000; tick++) {
        vm.processTick(channels);
        vm.advance(71000);
    }
    globalThis.gc();
    const delta = process.memoryUsage().heapUsed - before;
    assert.ok(delta < 512 * 1024, `Heap-Zuwachs ${delta} Byte`);
});
