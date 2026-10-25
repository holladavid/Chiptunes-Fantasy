# SID Deterministic Measurement Harness

## Scope

Introduced in Phase 0, the harness measures the SID implementation directly without hidden output processing. Phase 2 extended its waveform trace to the full 12-bit DAC input. Phase 3 adds a separate analog entry point and an archived external-reference comparison for the filter/mixer. It runs against `SIDChip` in Node or another ES-module runtime and requires neither a DOM nor an `AudioWorklet`.

It provides one fixed signal tap:

```text
register events -> SIDChip.clock() -> raw Float32 chip output -> IEEE-float WAV
                                      |
                                      +-> cycle/state trace
```

The tap is explicitly **before** the polyphase FIR, `C64AnalogFilter`, motherboard processing and master DSP. No resampling is hidden in the measurement path. WAV files therefore use the native PAL SID clock of 985248 Hz.

The optional constructor calibration value makes offline runs reproducible. Normal browser construction keeps the original random per-instance `vcfOffset` behavior.

## Event and cycle contract

An event is a plain setup-time object:

```js
{ cycle: 19656, register: 24, value: 0x0F }
```

- `cycle` is zero-based and must lie inside the requested render.
- `register` is a SID register index from 0 through 28 (`$D400` offset `$00` through `$1C`).
- `value` is one byte.
- All writes for a cycle are applied at the start of that cycle, in input order; then exactly one `SIDChip.clock()` executes.
- Input events may be unsorted. The harness normalizes them during setup without mutating the caller's array.
- The cycle loop uses preallocated typed arrays and performs no object or array allocation.

## Outputs

`renderSidOffline()` returns the completed harness:

- `raw`: one `Float32Array` sample per SID clock.
- `trace`: preallocated snapshots on a configurable cycle grid.
- `sid`: final chip state for focused assertions.

Each trace frame contains cycle number, raw output, filter states, active cutoff, all 29 registers, and per-voice phase, 12-bit waveform (`Uint16`), envelope level/state, rate counter, exponential counter and LFSR. `traceStride = 1` records every cycle; larger strides reduce storage without altering emulation.

`encodeSidWav()` writes deterministic mono IEEE-float32 WAV. It deliberately performs no normalization, DC removal, dither or PCM quantization. `sidTraceToCsv()` exports the snapshots for external analysis.

## Commands

```bash
# Render one synthetic case with raw PCM and CSV trace.
node tools/sid-render.mjs --case pulse-adsr --out artifacts/sid --raw --trace

# Reproduce every archived Phase 3 hash.
node tools/sid-render.mjs --case all --check

# Run the harness, digital-model and analog-routing regression tests.
node --test test/sid-offline.test.mjs test/sid-digital.test.mjs test/sid-filter.test.mjs

# Compare the production filter/mixer against the external R3 fixture.
node tools/sid-filter-measure.mjs --check

# Export all 639 response-comparison rows for independent inspection.
node tools/sid-filter-measure.mjs --out artifacts/sid/filter-r3-report.json

# Intentionally re-pin after a reviewed emulation change.
node tools/sid-render.mjs --case all --update-baseline
```

Each artifact directory contains a JSON manifest with event semantics, signal-tap location, calibration settings and SHA-256 hashes for raw output, state trace and WAV.

## Baseline meaning and limits

`test/fixtures/sid-baseline.json` is the current **self-generated Phase 3 regression pin**, not a hardware truth reference. `sid-phase2-baseline.json` and `sid-phase0-baseline.json` preserve earlier output for historical comparison. These fixtures make changes visible and reproducible; they do not prove that the current model sounds like a MOS 6581.

`test/fixtures/sid-r3-filter-reference.json` is a different kind of evidence: externally generated black-box observations from libresidfp revision `c1791383ca843a855e5d4366da6a7277e34e801d`, with source-archive hash, stimulus and measurement conditions. `tools/sid-filter-measure.mjs` compares those observations with the production `processFilterMixer()` path using one global API output-scale alignment. It currently covers 639 responses and enforces a median absolute error of at most 2.5dB and p95 of at most 8dB. See `sid-filter-model.md` for the full method and limitations.

The synthetic corpus covers silence, basic waveforms, ADSR/gate activity, a combined waveform, hard sync/ring modulation, a filter sweep, `$D418` writes and TEST-bit reset. Real PSID tunes and aligned reSIDfp/VICE captures remain necessary for musical and external-reference validation. Those binary assets are not included in this source export.

For further external comparisons, render the same event stream and calibration conditions in the reference implementation, align the write/clock convention and filter delay, and compare the raw tap before introducing any output-stage processing. The Phase-3 EXT-IN fixture isolates the analog path; it does not replace aligned whole-tune, real-hardware or listening validation.
